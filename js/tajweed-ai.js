// الاتصال بخادم تحليل التجويد (نموذج «المعلّم القرآني» على Hugging Face)
import { TAJWEED_API } from './firebase-config.js';
import { ayahWords, toArabicDigits as ar } from './quran.js';

export const AI_NOTICE = 'هذا المعلّم القرآني نموذج ذكاء اصطناعي قد يخطئ؛ فهو للإعانة فقط ولا يُعتمد عليه، وليس بديلاً عن معلّمٍ مُتقِنٍ مُجاز؛ لأنّ القرآن لا يُؤخذ إلا بالمشافهة.';
export const aiEnabled = () => !!(TAJWEED_API && TAJWEED_API.url);
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
  onProgress('جارٍ رفع التسجيل…');
  let r;
  try {
    r = await fetch(base() + '/analyze', { method: 'POST', body: fd, signal });
  } catch (e) {
    throw new Error('تعذر الوصول إلى خادم التحليل. قد يكون في وضع السكون؛ أعد المحاولة بعد دقيقة.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || 'رفض الخادم الطلب (' + r.status + ').');
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

/** تحويل نتيجة الخادم إلى صيغة مختصرة مرتبطة بأرقام كلمات المقطع */
function compact(res, { surah, from, to }) {
  const offset = {};
  let gi = 0;
  for (let a = from; a <= to; a++) { offset[a] = gi; gi += ayahWords(surah, a).length; }
  const errors = [];
  (res.ayat || []).forEach((ay) => (ay.errors || []).forEach((e) => {
    if (offset[ay.ayah] == null) return;
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
