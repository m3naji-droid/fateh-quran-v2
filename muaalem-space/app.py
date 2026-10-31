"""خادم تحليل التجويد لمقرأة الفاتح (Hugging Face Space).

يشغّل نموذج «المعلّم القرآني» (obadx/muaalem-model-v3_2) لتحويل التلاوة إلى رسم صوتي،
ثم يقارنه بالرسم الصوتي المرجعي للآيات المطلوبة ويستخرج أخطاء الحروف والحركات والتجويد.

النموذج ومكتبتاه مرخّصة بـ Quran Muaalem License (QML) 1.0 - راجع LICENSE وNOTICE.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoFeatureExtractor

from quran_muaalem.decode import phonemes_level_greedy_decode
from quran_muaalem.modeling.modeling_multi_level_ctc import Wav2Vec2BertForMultilevelCTC
from quran_muaalem.modeling.multi_level_tokenizer import MultiLevelTokenizer

import analysis as A

MODEL_ID = os.environ.get("MUAALEM_MODEL", "obadx/muaalem-model-v3_2")
MAX_SECONDS = float(os.environ.get("MAX_SECONDS", "300"))
CHUNK_SECONDS = 15.0
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "https://m3naji-droid.github.io,http://localhost:8000,http://127.0.0.1:8000"
).split(",") if o.strip()]

# حماية الفاتورة: لا يُقبل إلا مستخدمو موقعك المسجلون في Firebase (طالب أو معلم).
# اترك FIREBASE_PROJECT فارغاً لتعطيل التحقق (للتجربة المحلية فقط).
FIREBASE_PROJECT = os.environ.get("FIREBASE_PROJECT", "").strip()

NOTICE_AR = "هذا المعلّم القرآني نموذج ذكاء اصطناعي قد يخطئ؛ فهو للإعانة فقط ولا يُعتمد عليه، وليس بديلاً عن معلّمٍ مُتقِنٍ مُجاز؛ لأنّ القرآن لا يُؤخذ إلا بالمشافهة."
NOTICE_EN = ("This Quranic Teacher is an artificial-intelligence model that may make mistakes. It is intended for "
             "assistance only and must not be relied upon. It is not a replacement for a proficient, authorized "
             "teacher, because the Quran is only received through oral transmission (mushafahah).")

app = FastAPI(
    title="Fateh Maqraa - Tajweed Analysis",
    description=f"{NOTICE_AR}\n\n{NOTICE_EN}\n\nAny interface built on this API must show this notice to its users "
                "before first use and keep it reachable (Quran Muaalem License, section 2.1).",
)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

# ------------------------------------------------------------ النموذج
STATE = {"ready": False, "error": None, "loaded_at": None}
device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.bfloat16 if device == "cuda" else torch.float32
model = processor = vocab = None
model_lock = threading.Lock()


def load_model():
    global model, processor, vocab
    try:
        token = os.environ.get("HF_TOKEN") or None
        processor = AutoFeatureExtractor.from_pretrained(MODEL_ID, token=token)
        tok = MultiLevelTokenizer(MODEL_ID)
        vocab = tok.id_to_vocab["phonemes"]
        m = Wav2Vec2BertForMultilevelCTC.from_pretrained(MODEL_ID, token=token)
        m.to(device, dtype=dtype)
        m.eval()
        model = m
        if device == "cpu":
            torch.set_num_threads(max(1, os.cpu_count() or 2))
        STATE.update(ready=True, loaded_at=time.time())
    except Exception as e:  # نعرض السبب في /health
        STATE["error"] = f"{type(e).__name__}: {e}"[:500]


threading.Thread(target=load_model, daemon=True).start()

MAX_FEATURES = int(np.ceil((A.SR * CHUNK_SECONDS - 400) / (160 * 2)))


def transcribe(chunks: list[np.ndarray]) -> str:
    """الرسم الصوتي لكل مقطع ثم وصلها (مقطع واحد في كل مرة لتقليل الذاكرة على المعالج)."""
    out = []
    for ch in chunks:
        feats = processor(ch, sampling_rate=A.SR, return_tensors="pt", padding="max_length", max_length=MAX_FEATURES)
        x = feats["input_features"].to(device, dtype=dtype)
        mask = feats["attention_mask"].to(device, dtype=dtype)
        with model_lock, torch.inference_mode():
            logits = model(x, mask, return_dict=False)[0]["phonemes"]
        probs = torch.nn.functional.softmax(logits.float().cpu(), dim=-1)
        out.append(phonemes_level_greedy_decode(probs, vocab)[0].text)
    return "".join(out)


def decode_audio(data: bytes) -> np.ndarray:
    """تحويل أي صيغة (webm/ogg/mp4/wav) إلى موجة 16kHz أحادية عبر ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".bin") as f:
        f.write(data)
        f.flush()
        proc = subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", f.name, "-ac", "1", "-ar", str(A.SR), "-f", "f32le", "-"],
            capture_output=True, timeout=120,
        )
    if proc.returncode != 0:
        raise HTTPException(400, "تعذر قراءة الملف الصوتي: " + proc.stderr.decode(errors="ignore")[:200])
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def check_auth(authorization: str | None):
    if not FIREBASE_PROJECT:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "يجب تسجيل الدخول في الموقع لاستخدام التحليل.")
    try:
        from google.auth.transport import requests as g_requests
        from google.oauth2 import id_token
        claims = id_token.verify_firebase_token(authorization[7:], g_requests.Request(), audience=FIREBASE_PROJECT)
    except Exception:
        claims = None
    if not claims or claims.get("aud") != FIREBASE_PROJECT:
        raise HTTPException(401, "انتهت جلسة الدخول. حدّث الصفحة ثم أعد المحاولة.")


# ------------------------------------------------------------ المهام
JOBS: dict[str, dict] = {}
pool = ThreadPoolExecutor(max_workers=1)  # مهمة واحدة في كل مرة على الخادم المجاني


def run_job(jid: str, wave: np.ndarray, surah: int, start: int, end: int, mk: tuple):
    job = JOBS[jid]
    try:
        t0 = time.time()
        job["status"] = "running"
        chunks = A.split_on_silence(wave)
        job["chunks"] = len(chunks)
        if not chunks:
            raise ValueError("التسجيل صامت أو ضعيف جداً.")
        pred = transcribe(chunks)
        refs = A.reference(surah, start, end, mk)
        pred = A.strip_prefixes(pred, refs, mk)
        ayat = A.explain(refs, A.split_by_ayah(pred, refs))
        job.update(status="done", result={
            "surah": surah, "from": start, "to": end,
            "summary": A.summarize(refs, pred, ayat),
            "ayat": ayat,
            "predicted_phonemes": pred,
            "seconds": round(len(wave) / A.SR, 1),
            "took": round(time.time() - t0, 1),
            "model": MODEL_ID,
            "notice": NOTICE_AR,
        })
    except Exception as e:
        job.update(status="error", error=str(e)[:300])
    finally:
        job["finished"] = time.time()
        for k in [k for k, v in JOBS.items() if time.time() - v.get("finished", time.time()) > 3600]:
            JOBS.pop(k, None)


@app.get("/")
@app.get("/health")
def health():
    return {"ok": True, "model_ready": STATE["ready"], "model_error": STATE["error"], "device": device,
            "queue": sum(1 for j in JOBS.values() if j["status"] in ("queued", "running")), "notice": NOTICE_AR}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    surah: int = Form(..., ge=1, le=114),
    start: int = Form(..., ge=1),
    end: int = Form(..., ge=1),
    madd_monfasel: int = Form(4),
    madd_mottasel: int = Form(4),
    madd_aared: int = Form(4),
    wait: bool = Form(False),
    authorization: str | None = Header(None),
):
    check_auth(authorization)
    if STATE["error"]:
        raise HTTPException(503, "تعذر تحميل النموذج: " + STATE["error"])
    if end < start or end - start > 60:
        raise HTTPException(400, "نطاق الآيات غير صالح.")
    if madd_monfasel not in (2, 3, 4, 5) or madd_mottasel not in (4, 5, 6) or madd_aared not in (2, 4, 6):
        raise HTTPException(400, "مقادير المدود غير صالحة.")
    try:
        A.Aya(surah, end).get()
    except Exception:
        raise HTTPException(400, "رقم الآية خارج السورة.")
    data = await file.read()
    if len(data) > 12 * 1024 * 1024:
        raise HTTPException(413, "الملف كبير جداً.")
    wave = decode_audio(data)
    if len(wave) / A.SR > MAX_SECONDS:
        raise HTTPException(413, f"التسجيل أطول من {int(MAX_SECONDS // 60)} دقائق.")
    jid = uuid.uuid4().hex
    JOBS[jid] = {"status": "queued", "created": time.time()}
    args = (jid, wave, surah, start, end, (madd_monfasel, madd_mottasel, madd_aared))
    if wait:
        # الوضع المتزامن (Cloud Run): التحليل كاملاً داخل الطلب، لأن المعالج لا يعمل إلا أثناء معالجة طلب
        await asyncio.get_running_loop().run_in_executor(pool, _wait_then_run, *args)
        j = JOBS.pop(jid, {})
        if j.get("status") != "done":
            raise HTTPException(500, j.get("error") or "فشل التحليل.")
        return {"status": "done", "result": j["result"]}
    pool.submit(_wait_then_run, *args)
    return {"job": jid, "status": "queued", "model_ready": STATE["ready"]}


def _wait_then_run(*args):
    while not STATE["ready"] and not STATE["error"]:
        time.sleep(1)
    if STATE["error"]:
        JOBS[args[0]].update(status="error", error="تعذر تحميل النموذج.", finished=time.time())
        return
    run_job(*args)


@app.get("/jobs/{jid}")
def job(jid: str):
    j = JOBS.get(jid)
    if not j:
        raise HTTPException(404, "المهمة غير موجودة أو انتهت صلاحيتها.")
    ahead = sum(1 for k, v in JOBS.items() if v["status"] in ("queued", "running") and v["created"] < j["created"])
    return {**{k: v for k, v in j.items() if k != "created"}, "ahead": ahead}
