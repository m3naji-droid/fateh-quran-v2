"""منطق تحليل التلاوة (بدون النموذج): تقطيع الصوت، الرسم الصوتي المرجعي، توزيع المخرجات على الآيات، وشرح الأخطاء.

يستخدم مكتبة quran-transcript (رخصة MIT) من مشروع «المعلّم القرآني».
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np
import Levenshtein as lv
from quran_transcript import Aya, MoshafAttributes, explain_error, quran_phonetizer

SR = 16000
ISTIADHA = "أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَٰنِ ٱلرَّجِيمِ"

# أسماء أحكام «المعلّم» -> مفاتيح الأحكام في المقرأة
RULE_KEYS = {
    "المد اللازم": "madd_lazim",
    "المد المتصل": "madd_muttasil",
    "المد المتصل وقفا": "madd_muttasil",
    "المد المنفصل": "madd_munfasil",
    "المد العارض للسكون": "madd_arid",
    "مد اللين": "madd_leen",
    "المد الطبيعي": "madd_tabii",
    "قلقة": "qalqala",
    "قلقلة": "qalqala",
}
GHUNNAH_CHARS = set("ںۨ۾")  # رموز الغنة في الرسم الصوتي


def moshaf(madd_monfasel: int = 4, madd_mottasel: int = 4, madd_aared: int = 4) -> MoshafAttributes:
    return MoshafAttributes(
        rewaya="hafs",
        madd_monfasel_len=madd_monfasel,
        madd_mottasel_len=madd_mottasel,
        madd_mottasel_waqf=madd_mottasel,
        madd_aared_len=madd_aared,
    )


# ---------------------------------------------------------------- الصوت
def split_on_silence(wave: np.ndarray, sr: int = SR, max_s: float = 14.5, min_s: float = 3.0, min_gap: float = 0.18) -> list[np.ndarray]:
    """تقسيم التلاوة إلى مقاطع لا تتجاوز max_s ثانية، والقطع في مواضع السكوت (الوقف بين الكلمات أو الآيات)."""
    if len(wave) == 0:
        return []
    hop = int(0.02 * sr)
    n = len(wave) // hop
    if n == 0:
        return [wave]
    frames = wave[: n * hop].reshape(n, hop)
    rms = np.sqrt((frames.astype(np.float64) ** 2).mean(axis=1))
    peak = float(rms.max()) or 1.0
    noise, speech = float(np.percentile(rms, 5)), float(np.percentile(rms, 60))
    thr = max(noise + 0.2 * (speech - noise), peak * 0.02)
    silent = rms < thr

    # حذف السكوت في البداية والنهاية
    voiced = np.where(~silent)[0]
    if len(voiced) == 0:
        return []
    first, last = max(0, voiced[0] - 5), min(n, voiced[-1] + 6)

    # مراكز فترات السكوت الطويلة بما يكفي
    gaps, run_start = [], None
    min_frames = int(min_gap / 0.02)
    for i in range(first, last):
        if silent[i] and run_start is None:
            run_start = i
        elif not silent[i] and run_start is not None:
            if i - run_start >= min_frames:
                gaps.append(((run_start + i) // 2, i - run_start))
            run_start = None

    max_f, min_f = int(max_s / 0.02), int(min_s / 0.02)
    cuts, start = [], first
    while last - start > max_f:
        window = [g for g in gaps if start + min_f < g[0] <= start + max_f]
        cut = max(window, key=lambda g: (g[1], g[0]))[0] if window else start + max_f
        cuts.append((start, cut))
        start = cut
    cuts.append((start, last))
    return [wave[a * hop: b * hop] for a, b in cuts if b - a > 10]


# ---------------------------------------------------------------- المرجع
@lru_cache(maxsize=4096)
def _phonetize(text: str, m_key: tuple) -> tuple:
    out = quran_phonetizer(text, moshaf(*m_key), remove_spaces=True)
    return out.phonemes, out.mappings


def reference(surah: int, start: int, end: int, m_key: tuple = (4, 4, 4)) -> list[dict]:
    """الرسم الصوتي لكل آية مع الوقف على رأسها (كما يقرأ الطلاب عادة)."""
    out = []
    for a in range(start, end + 1):
        uth = Aya(surah, a).get().uthmani
        ph, mappings = _phonetize(uth, m_key)
        out.append({"ayah": a, "uthmani": uth, "phonemes": ph, "mappings": mappings})
    return out


def strip_prefixes(pred: str, refs: list[dict], m_key: tuple) -> str:
    """إزالة الاستعاذة والبسملة من بداية التلاوة إن لم تكونا من المقطع المطلوب."""
    first = refs[0]["phonemes"] if refs else ""
    for text in (ISTIADHA, Aya(1, 1).get().uthmani):
        ph, _ = _phonetize(text, m_key)
        if first.startswith(ph[: max(4, len(ph) // 2)]):
            continue  # المقطع نفسه يبدأ بها
        best, best_len = 1.0, 0
        for L in range(int(len(ph) * 0.7), int(len(ph) * 1.3) + 1):
            if L > len(pred):
                break
            d = lv.distance(pred[:L], ph) / max(1, len(ph))
            if d < best:
                best, best_len = d, L
        if best <= 0.35:
            pred = pred[best_len:]
    return pred


def split_by_ayah(pred: str, refs: list[dict]) -> list[str]:
    """توزيع الرسم الصوتي المتوقع على الآيات بالترتيب: لكل آية نبحث عن أفضل مقطع مطابق بعد موضع الآية السابقة.

    - إن لم تُطابَق الآية بدرجة كافية تُعدّ متروكة ولا يتقدم المؤشر (فلا تختلط بنهاية الآية السابقة).
    - ما بين الآيات من تكرار أو تردد يُتجاهل بدل أن يُحسب خطأً.
    """
    out, p, n = [], 0, len(pred)
    for k, r in enumerate(refs):
        ref = r["phonemes"]
        L = len(ref)
        if L == 0:
            out.append("")
            continue
        last = k == len(refs) - 1
        best = (1e9, p, p)
        slack = int(L * 0.35) + 8
        for s0 in range(p, min(n, p + slack) + 1):
            lo, hi = s0 + int(L * 0.5), min(n, s0 + int(L * 1.6) + 6)
            if last:
                lo = max(lo, min(n, s0 + int(L * 0.5)))
            for e in range(lo, hi + 1):
                d = lv.distance(ref, pred[s0:e]) / L + (s0 - p) * 0.002
                if d < best[0]:
                    best = (d, s0, e)
            if best[0] < 0.02:
                break
        d, s0, e = best
        if d > 0.6:  # الآية متروكة
            out.append("")
            continue
        out.append(pred[s0:e])
        p = e
    return out


def _rule_key(err) -> str:
    rules = err.ref_tajweed_rules or err.missing_tajweed_rules or err.replaced_tajweed_rules or err.inserted_tajweed_rules or []
    for r in rules:
        k = RULE_KEYS.get(r.name.ar)
        if k:
            return k
    if err.error_type == "tashkeel":
        return "haraka"
    if GHUNNAH_CHARS & set(err.expected_ph or "") or GHUNNAH_CHARS & set(err.preditected_ph or ""):
        return "ghunnah"
    return "makhraj" if err.error_type == "normal" else "tajweed_other"


def explain(refs: list[dict], parts: list[str]) -> list[dict]:
    """الأخطاء لكل آية، مع رقم الكلمة داخل الآية."""
    ayat = []
    for ref, part in zip(refs, parts):
        uth = ref["uthmani"]
        words = uth.split(" ")
        item = {"ayah": ref["ayah"], "ref": ref["phonemes"], "pred": part, "errors": [], "skipped": False}
        if len(part) < max(2, len(ref["phonemes"]) * 0.25):
            item["skipped"] = True
            ayat.append(item)
            continue
        try:
            errs = explain_error(uthmani_text=uth, ref_ph_text=ref["phonemes"], predicted_ph_text=part, mappings=ref["mappings"])
        except Exception as e:  # نكمل بقية الآيات
            item["error"] = str(e)[:200]
            ayat.append(item)
            continue
        seen = set()
        for e in errs:
            key = (tuple(e.uthmani_pos), tuple(e.ph_pos), e.error_type)
            if key in seen:
                continue
            seen.add(key)
            w = uth[: e.uthmani_pos[0]].count(" ")
            rules = [r.name.ar for r in (e.ref_tajweed_rules or [])]
            item["errors"].append({
                "w": w,
                "word": words[w] if w < len(words) else "",
                "type": e.error_type,
                "op": e.speech_error_type,
                "rule": _rule_key(e),
                "rules": rules,
                "exp": e.expected_ph,
                "got": e.preditected_ph,
                "exp_len": e.expected_len,
                "got_len": e.predicted_len,
            })
        ayat.append(item)
    return ayat


def summarize(refs: list[dict], pred: str, ayat: list[dict]) -> dict:
    full = "".join(r["phonemes"] for r in refs)
    acc = 1 - lv.distance(full, pred) / max(1, len(full))
    errs = [e for a in ayat for e in a["errors"]]
    by = {}
    for e in errs:
        by[e["rule"]] = by.get(e["rule"], 0) + 1
    return {
        "phoneme_accuracy": round(max(0.0, acc), 4),
        "errors": len(errs),
        "tajweed_errors": sum(1 for e in errs if e["type"] == "tajweed"),
        "by_rule": by,
        "skipped_ayat": [a["ayah"] for a in ayat if a["skipped"]],
    }
