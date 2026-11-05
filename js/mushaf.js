// «مصحفي»: خريطة حفظ الطالب. لكل آية: أفضل دقة (b) ويوم آخر إتقان (g).
// الإتقان: دقة آلية ٨٥٪ فأكثر. تبهت الآية المتقنة بعد ٣٠ يوماً بلا مراجعة فتصير «تحتاج مراجعة».
import { getSurahs, surahName, ayahCount, rangeWords, toArabicDigits as ar } from './quran.js';

export const MASTER = 85;
export const FADE_DAYS = 30;
export const today = () => Math.floor((Date.now() + 3 * 3600e3) / 864e5); // يوم الرياض بالأرقام
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** دقة كل آية في محاولة: من حالات الكلمات إن وُجدت، وإلا دقة المقطع كله */
export function ayahScores(sub) {
  if (!sub || sub.percent == null || !sub.surah) return [];
  const out = [];
  if (sub.statuses) {
    const words = rangeWords(sub.surah, sub.from, sub.to);
    const per = {};
    words.forEach((w, i) => { const c = sub.statuses[i]; if (!c) return; const r = (per[w.ayah] = per[w.ayah] || { ok: 0, n: 0 }); r.n++; if (c === 'c') r.ok++; });
    Object.entries(per).forEach(([a, r]) => { if (r.ok > 0) out.push({ a: +a, p: Math.round((r.ok / r.n) * 100) }); }); // آية لم يصلها الطالب لا تُحسب
  } else {
    for (let a = sub.from; a <= sub.to; a++) out.push({ a, p: sub.percent });
  }
  return out;
}

/** يدمج محاولة في الخريطة ويعيد مفاتيح السور التي تغيرت */
export function mergeAttempt(map, sub, day = today()) {
  const sc = ayahScores(sub);
  if (!sc.length) return [];
  const key = 's' + sub.surah, n = ayahCount(sub.surah);
  const cur = map[key] || { b: [], g: [] };
  const b = Array.from({ length: n }, (_, i) => cur.b?.[i] || 0), g = Array.from({ length: n }, (_, i) => cur.g?.[i] || 0);
  sc.forEach(({ a, p }) => { if (a < 1 || a > n) return; b[a - 1] = Math.max(b[a - 1], p); if (p >= MASTER) g[a - 1] = Math.max(g[a - 1], day); });
  map[key] = { b, g };
  return [key];
}

/** يبني الخريطة من تسليمات سابقة (للمرة الأولى، أو للمعلم إن لم تُحفظ بعد) */
export function mapFromSubs(subs) {
  const map = {};
  [...subs].sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || '')).forEach((s) => mergeAttempt(map, s, s.createdAt ? Math.floor((new Date(s.createdAt).getTime() + 3 * 3600e3) / 864e5) : today()));
  return map;
}

/** حالة آية: 0 لم تبدأ، 1 بدأها، 2 متقنة، 3 تحتاج مراجعة. و fade بين 0 و1 */
function ayahState(e, i, day) {
  const b = e?.b?.[i] || 0, g = e?.g?.[i] || 0;
  if (!b) return 0;
  if (!g) return 1;
  return day - g <= FADE_DAYS ? 2 : 3;
}
export function surahStats(map, s, day = today()) {
  const n = ayahCount(s), e = map['s' + s];
  const st = { n, started: 0, mastered: 0, review: 0, fresh: 0 };
  if (!e) return st;
  for (let i = 0; i < n; i++) { const k = ayahState(e, i, day); if (k === 1) st.started++; else if (k === 2) st.mastered++; else if (k === 3) st.review++; }
  st.fresh = n - st.started - st.mastered - st.review;
  return st;
}

const FILTERS = [['all', 'كل المصحف'], ['amma', 'جزء عمّ'], ['tabarak', 'جزء تبارك'], ['mine', 'ما بدأته'], ['review', 'تحتاج مراجعة']];
const inFilter = (f, s, st) => f === 'amma' ? s >= 78 : f === 'tabarak' ? s >= 67 && s <= 77 : f === 'mine' ? st.n - st.fresh > 0 : f === 'review' ? st.review > 0 : true;

/** يرسم الخريطة داخل host. onOpen(surah) عند الضغط على سورة */
export function renderMushaf(host, map, { filter = 'all', onFilter, onOpen, who = 'student' } = {}) {
  const day = today();
  const all = getSurahs().map((x) => ({ s: x.n, st: surahStats(map, x.n, day) }));
  const tot = all.reduce((t, { st }) => ({ n: t.n + st.n, m: t.m + st.mastered, r: t.r + st.review, sd: t.sd + st.started }), { n: 0, m: 0, r: 0, sd: 0 });
  const full = all.filter(({ st }) => st.mastered === st.n).length, rev = all.filter(({ st }) => st.review > 0).length;
  const pct = (x, n) => (n ? (x / n) * 100 : 0);
  host.innerHTML = `<div class="mushaf">
    <div class="mf-kpis">
      <div><b>${ar(tot.m)}</b><span>آية متقنة من ${ar(tot.n)}</span><i class="mf-meter"><i style="width:${Math.max(tot.m ? 1 : 0, pct(tot.m, tot.n))}%"></i></i></div>
      <div><b>${ar(full)}</b><span>${full === 1 ? 'سورة متقنة كاملة' : 'سور متقنة كاملة'}</span></div>
      <div class="${rev ? 'warn' : ''}"><b>${ar(rev)}</b><span>${who === 'student' ? 'سور تحتاج مراجعتك' : 'سور تحتاج مراجعة'}</span></div>
    </div>
    <div class="mf-legend"><span><i class="k2"></i>متقنة (٨٥٪ فأكثر)</span><span><i class="k1"></i>بدأها وتحتاج تثبيتاً</span><span><i class="k3"></i>تحتاج مراجعة (مضى ${ar(FADE_DAYS)} يوماً)</span><span><i class="k0"></i>لم تبدأ</span></div>
    <div class="mf-filters">${FILTERS.map(([k, l]) => `<button type="button" class="chip${k === filter ? ' on' : ''}" data-mf="${k}">${l}</button>`).join('')}</div>
    <div class="mf-grid">${all.filter(({ s, st }) => inFilter(filter, s, st)).map(({ s, st }) => {
      const k = st.mastered === st.n ? 'k2' : st.review ? 'k3' : st.started || st.mastered ? 'k1' : 'k0';
      return `<button type="button" class="mf-cell ${k}" data-s="${s}" title="${esc(surahName(s))}: ${ar(st.mastered)} متقنة، ${ar(st.started)} بدأها، ${ar(st.review)} تحتاج مراجعة من ${ar(st.n)}">
        <span class="mf-n">${ar(s)}</span><span class="mf-name">${esc(surahName(s))}</span>
        <span class="mf-bar"><i class="k2" style="width:${pct(st.mastered, st.n)}%"></i><i class="k3" style="width:${pct(st.review, st.n)}%"></i><i class="k1" style="width:${pct(st.started, st.n)}%"></i></span></button>`;
    }).join('') || '<div class="empty" style="grid-column:1/-1">لا توجد سور هنا بعد.</div>'}</div>
  </div>`;
  host.querySelectorAll('[data-mf]').forEach((b) => (b.onclick = () => onFilter?.(b.dataset.mf)));
  host.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => onOpen?.(+b.dataset.s)));
}

/** تفاصيل سورة: مربع لكل آية، واقتراح مقطع للمراجعة */
export function surahDetailHtml(map, s) {
  const day = today(), e = map['s' + s], st = surahStats(map, s, day);
  const cells = Array.from({ length: st.n }, (_, i) => { const k = ayahState(e, i, day); const b = e?.b?.[i] || 0; return `<i class="k${k}" title="آية ${ar(i + 1)}${b ? `: أفضل دقة ${ar(b)}٪` : ''}">${ar(i + 1)}</i>`; }).join('');
  return `<h2>${esc(surahName(s))}</h2>
    <div class="row small" style="gap:6px"><span class="pill ok">${ar(st.mastered)} متقنة</span>${st.review ? `<span class="pill bad">${ar(st.review)} تحتاج مراجعة</span>` : ''}${st.started ? `<span class="pill warn">${ar(st.started)} تحتاج تثبيتاً</span>` : ''}<span class="pill mute">${ar(st.fresh)} لم تبدأ</span></div>
    <div class="mf-ayat">${cells}</div>`;
}
/** أول مقطع يحتاج عملاً (مراجعة ثم تثبيت ثم جديد)، بحد ١٠ آيات */
export function suggestRange(map, s) {
  const day = today(), e = map['s' + s], n = ayahCount(s);
  if (n <= 10) return { surah: s, from: 1, to: n };
  for (const want of [3, 1, 0]) {
    const i = Array.from({ length: n }, (_, k) => k).find((k) => ayahState(e, k, day) === want);
    if (i != null) return { surah: s, from: i + 1, to: Math.min(n, i + 10) };
  }
  return { surah: s, from: 1, to: 10 };
}
