// الاتصال بخادم تحليل التجويد (نموذج «المعلّم القرآني» على Hugging Face)
import { TAJWEED_API } from './firebase-config.js';
import { ayahWords, toArabicDigits as ar } from './quran.js';

export const AI_NOTICE = 'هذا المعلّم القرآني نموذج ذكاء اصطناعي قد يخطئ؛ فهو للإعانة فقط ولا يُعتمد عليه، وليس بديلاً عن معلّمٍ مُتقِنٍ مُجاز؛ لأنّ القرآن لا يُؤخذ إلا بالمشافهة.';
export const aiEnabled = () => !!(TAJWEED_API && TAJWEED_API.url);
let tokenProvider = async () => null;
/** يعطي الخادم رمز دخول Firebase ليتأكد أن الطلب من مستخدمي الموقع */
export const setTokenProvider = (fn) => { tokenProvider = fn; };
const base = () => TAJWEED_API.url.replace(/\/+$/, '');

export async function health() {
  const r = await fetch(base() + '/health', { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/** يرسل التسجيل ويتابع المهمة حتى تنتهي. onProgress يستقبل نصاً لعرضه. */
export async function analyze(blob, { surah, from, to }, onProgress = () => {}, signal) {
  const fd = new FormData();
  fd.append('file', blob, 'recitation.' + ((blob.type || '').includes('mp4') ? 'mp4' : 'webm'));
  fd.append('surah', surah);
  fd.append('start', from);
  fd.append('end', to);
  const m = TAJWEED_API.madd || {};
  fd.append('madd_monfasel', m.monfasel ?? 4);
  fd.append('madd_mottasel', m.mottasel ?? 4);
  fd.append('madd_aared', m.aared ?? 4);
  const sync = TAJWEED_API.sync !== false;
  fd.append('wait', sync ? 'true' : 'false');
  const headers = {};
  try { const t = await tokenProvider(); if (t) headers.Authorization = 'Bearer ' + t; } catch {}
  onProgress('جارٍ رفع التسجيل…');
  const t0 = Date.now();
  let busyUntil = 0;
  const tick = sync ? setInterval(() => {
    const secs = Math.round((Date.now() - t0) / 1000);
    if (Date.now() < busyUntil) onProgress(`الخادم مشغول بتلاوات طلاب آخرين، ستُعاد المحاولة تلقائياً… (${ar(secs)} ث)`);
    else onProgress(`يحلّل النموذج تلاوتك… (${ar(secs)} ث)${secs > 40 ? ' — أول تحليل بعد فترة خمول يتأخر حتى يستيقظ الخادم.' : ''}`);
  }, 1000) : null;
  let r, j;
  try {
    // عند ازدحام الخادم (429/503) نعيد المحاولة تلقائياً بفواصل متزايدة لمدة تصل إلى نحو ٨ دقائق
    for (let attempt = 0; ; attempt++) {
      r = await fetch(base() + '/analyze', { method: 'POST', body: fd, headers, signal });
      j = await r.json().catch(() => ({}));
      const busy = r.status === 429 || (r.status === 503 && !/النموذج/.test(String(j.detail || '')));
      if (!busy || attempt >= 12) break;
      const wait = Math.min(60, 8 + attempt * 6) * 1000 + Math.random() * 4000;
      busyUntil = Date.now() + wait;
      await new Promise((res, rej) => {
        const t = setTimeout(res, wait);
        signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true });
      });
    }
  } catch (e) {
    if (signal?.aborted) throw new Error('أُلغي التحليل.');
    throw new Error('تعذر الوصول إلى خادم التحليل. تحقق من الاتصال وأعد المحاولة.');
  } finally {
    if (tick) clearInterval(tick);
  }
  if (r.status === 429 || r.status === 503) throw new Error('الخادم مزدحم جداً الآن. أرسل تسميعك للمعلم، أو أعد التحليل بعد قليل.');
  if (!r.ok) throw new Error((typeof j.detail === 'string' && j.detail) || 'رفض الخادم الطلب (' + r.status + ').');
  if (j.status === 'done' && j.result) return compact(j.result, { surah, from, to });
  const started = Date.now();
  for (;;) {
    if (signal?.aborted) throw new Error('أُلغي التحليل.');
    await new Promise((res) => setTimeout(res, 2500));
    const s = await fetch(`${base()}/jobs/${j.job}`, { cache: 'no-store', signal }).then((x) => x.json()).catch(() => null);
    if (!s) continue;
    if (s.status === 'done') return compact(s.result, { surah, from, to });
    if (s.status === 'error') throw new Error(s.error || 'فشل التحليل.');
    const secs = Math.round((Date.now() - started) / 1000);
    if (s.status === 'queued') onProgress(s.ahead ? `في الانتظار: قبلك ${s.ahead} تسجيل…` : (j.model_ready ? 'يبدأ التحليل الآن…' : 'الخادم يستيقظ ويحمّل النموذج (قد يستغرق دقيقة أو دقيقتين أول مرة)…'));
    else onProgress(`يحلّل النموذج تلاوتك… (${secs} ث)`);
    if (secs > 600) throw new Error('استغرق التحليل وقتاً طويلاً. أعد المحاولة لاحقاً.');
  }
}

/** الرسم الصوتي لتسجيل قصير (حرف أو كلمة في «اقرأ وارتقِ»). يعيد النص الصوتي أو يرمي خطأ. */
export async function phonemes(blob, signal) {
  const fd = new FormData();
  fd.append('file', blob, 'say.' + ((blob.type || '').includes('mp4') ? 'mp4' : 'webm'));
  const headers = {};
  try { const t = await tokenProvider(); if (t) headers.Authorization = 'Bearer ' + t; } catch {}
  let r, j;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await fetch(base() + '/phonemes', { method: 'POST', body: fd, headers, signal });
    j = await r.json().catch(() => ({}));
    if (r.status !== 429 && r.status !== 503) break;
    await new Promise((res) => setTimeout(res, 2500 * (attempt + 1)));
  }
  if (!r.ok) throw new Error((typeof j.detail === 'string' && j.detail) || 'HTTP ' + r.status);
  return String(j.pred || '');
}

/** النطق المولَّد: يولّد غير المحفوظ ويحفظه في الخادم. audio=true يعيد الصوت base64 */
export async function ttsGen(texts, { voice, rate = 0.8, audio = false } = {}, signal) {
  const headers = { 'Content-Type': 'application/json' };
  try { const t = await tokenProvider(); if (t) headers.Authorization = 'Bearer ' + t; } catch {}
  const r = await fetch(base() + '/tts', { method: 'POST', headers, body: JSON.stringify({ texts, voice, rate, audio }), signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((typeof j.detail === 'string' && j.detail) || 'HTTP ' + r.status);
  return j;
}

/** تحويل نتيجة الخادم إلى صيغة مختصرة مرتبطة بأرقام كلمات المقطع */
function compact(res, { surah, from, to }) {
  const offset = {};
  let gi = 0;
  for (let a = from; a <= to; a++) { offset[a] = gi; gi += ayahWords(surah, a).length; }
  const errors = [];
  (res.ayat || []).forEach((ay) => (ay.errors || []).forEach((e) => {
    if (offset[ay.ayah] == null) return;
    if (e.rule === 'madd_arid' && [2, 4, 6].includes(Number(e.got_len))) return; // العارض للسكون: ٢ أو ٤ أو ٦ كلها صحيحة
    errors.push({ i: offset[ay.ayah] + e.w, r: e.rule, t: e.type, op: e.op, el: e.exp_len ?? null, gl: e.got_len ?? null });
  }));
  return {
    at: new Date().toISOString(),
    acc: res.summary?.phoneme_accuracy ?? null,
    skipped: res.summary?.skipped_ayat || [],
    errors: errors.slice(0, 300),
    took: res.took,
  };
}

/** وصف خطأ بالعربية */
export function describe(e, ruleName) {
  const name = ruleName(e.r);
  if (e.el != null && e.gl != null && e.el !== e.gl) return `${name}: المطلوب ${ar(e.el)} حركات، وسُمع ${ar(e.gl)}`;
  if (e.op === 'delete') return `${name}: لم يُنطق`;
  if (e.op === 'insert') return `${name}: زيادة في النطق`;
  return name;
}
