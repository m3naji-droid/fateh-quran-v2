// أصوات «اقرأ وارتقِ»: تسجيلات المعلم (اللَّبِنات والكلمات)، وصوت القارئ كلمةً كلمة للكلمات القرآنية،
// وتركيب الأصوات المسجلة (أسماء الحروف، وسلاسل التجريد)، وصوت الجهاز احتياطاً.
// تسجيلات المعلم تُحفظ WAV أحادياً (١٦ كيلوهرتز) بعد قصّ الصمت، فتعمل على كل الأجهزة.
import { store, blobToB64 } from './store.js';
import { WBW } from './iqra-wbw.js';
import { ttsGen, aiEnabled } from './tajweed-ai.js';
import { LESSONS, NAMES, LETTERS, itemOf } from './iqra-data.js';
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

const WBW_BASE = 'https://audio.qurancdn.com/wbw/';
const pad3 = (n) => String(n).padStart(3, '0');

/* ---------- المفتاح الثابت لكل نص منطوق ---------- */
export function normText(t) {
  return String(t || '').normalize('NFC').replace(/ـ/g, '').replace(/ۡ/g, 'ْ')
    .replace(/َٰ/g, 'َا') // «بَٰ» تُسجَّل مثل «بَا»
    .replace(/[ۖ-ۜ۞]/g, '').replace(/\s+/g, ' ').trim();
}
export function keyOf(t) {
  const s = normText(t);
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'k' + h.toString(16).padStart(8, '0') + s.length.toString(36);
}

/* ---------- قائمة اللَّبِنات المطلوب تسجيلها بالترتيب ---------- */
export const MARK_NAMES = {
  fatha: 'فَتْحَة', kasra: 'كَسْرَة', damma: 'ضَمَّة', sukun: 'سَاكِنَة', shadda: 'شَدَّة',
  tf: 'فَتْحَتَان', td: 'ضَمَّتَان', tk: 'كَسْرَتَان',
  dagger: 'أَلِفْ مَدِّيَّة صَغِيرَة', maqsura: 'أَلِفْ مَقْصُورَة', swaw: 'وَاوْ مَدِّيَّة صَغِيرَة', syaa: 'يَاءْ مَدِّيَّة صَغِيرَة',
  madda: 'عَلَامَةُ ٱلْمَدّ', wasl: 'هَمْزَةُ وَصْل',
};
export function recordingPlan() {
  const groups = [];
  groups.push({ id: 'names', t: 'أسماء الحروف (بالنطق القرآني)', note: 'انطق اسم الحرف كما في حاشية ص ٢٣: «بَا، تَا، جِيمْ…» دون مدّ زائد.',
    items: ['ا', ...LETTERS, 'ء'].map((l) => ({ t: l, s: NAMES[l] })) });
  groups.push({ id: 'marks', t: 'أسماء الحركات والعلامات (للتجريد)', note: 'تُستعمل في سلاسل التجريد: «فاء، فتحة = فَ».',
    items: Object.values(MARK_NAMES).map((s) => ({ t: s, s })) });
  const seen = new Set(groups.flatMap((g) => g.items.map((x) => keyOf(x.s))));
  for (const n of [4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16]) {
    const L = LESSONS.find((l) => l.n === n);
    const items = L.items.map((x) => itemOf(x, n)).filter((x) => x.k === 'syl' && !seen.has(keyOf(x.s)));
    items.forEach((x) => seen.add(keyOf(x.s)));
    if (items.length) groups.push({ id: 'l' + n, t: `جدول الدرس ${toAr(n)}: ${L.t}`, note: L.hint, items });
  }
  // كلمات ليست في المصحف (لا يوجد لها صوت قارئ): اختيارية
  const words = [];
  LESSONS.forEach((L) => L.items.forEach((x) => { const it = itemOf(x, L.n); if (it.k === 'word' && !reciterUrl(it) && !seen.has(keyOf(it.s))) { seen.add(keyOf(it.s)); words.push({ ...it, n: L.n }); } }));
  groups.push({ id: 'words', t: 'كلمات ليس لها صوت قارئ (اختياري)', note: 'كلمات من الكتاب لم تُوجد بنصها في المصحف، أو تُقرأ وقفاً أو وصلاً بين كلمتين. ما لا تسجّله يُنطق بصوت الجهاز.', items: words, optional: true });
  return groups;
}

/** صوت القارئ (كلمةً كلمة من quran.com) لكلمات الكتاب الموجودة في المصحف: قائمة روابط بالترتيب، أو null */
const wbwKey = (t) => String(t || '').normalize('NFC').replace(/\u0640/g, '').replace(/[\u06D6-\u06DC\u06DE\u06E9]/g, '').replace(/\u06E1/g, '\u0652').replace(/\s+/g, ' ').trim();
const wordsIn = (t) => wbwKey(t).split(' ').filter((w) => /[\u0621-\u064A\u0671]/.test(w)).length;
export function reciterUrls(item) {
  const v = item && WBW[wbwKey(item.t)];
  if (!v) return null;
  const locs = v.length === 1 && wordsIn(item.t) > 1 ? Array.from({ length: wordsIn(item.t) }, (_, k) => [v[0][0], v[0][1], v[0][2] + k]) : v;
  return locs.map(([s, a, w]) => `${WBW_BASE}${pad3(s)}_${pad3(a)}_${pad3(w)}.mp3`);
}
export const reciterUrl = (item) => reciterUrls(item)?.[0] || null;

/* ---------- فهرس التسجيلات ---------- */
let idx = null, idxP = null;
export async function audioIndex(fresh = false) {
  if (idx && !fresh) return idx;
  if (!idxP || fresh) idxP = store.getIqraAudioIdx().then((x) => (idx = x || {})).catch(() => (idx = {}));
  return idxP;
}
export const hasRec = (text) => !!(idx && idx[keyOf(text)]);
export function setIdxLocal(key, v) { idx = idx || {}; if (v) idx[key] = v; else delete idx[key]; }

/* ---------- التشغيل ---------- */
// عنصر صوت واحد يُعاد استعماله: آيفون يسمح بتشغيله لاحقاً بعد أن يُفتح بلمسة واحدة من المستخدم
let ac = null;
const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
let el = null;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const audioEl = () => { if (!el) { el = new Audio(); el.preload = 'auto'; } return el; };
let unlocked = false;
function unlock() {
  if (unlocked) return; unlocked = true;
  try { const a = audioEl(); a.src = SILENT; a.play().catch(() => { unlocked = false; }); } catch {}
}
if (typeof document !== 'undefined') ['pointerdown', 'touchend', 'keydown'].forEach((e) => document.addEventListener(e, unlock, { capture: true, passive: true }));

// تسجيلات المعلم: تُحمَّل مسبقاً وتُحوَّل إلى رابط محلي
const urlCache = new Map(), urlReady = new Map();
function teacherUrl(key) {
  if (urlCache.has(key)) return urlCache.get(key);
  const p = store.getIqraAudio(key).then((d) => {
    if (!d?.b64) return null;
    const bin = atob(d.b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([arr], { type: d.mime || 'audio/wav' }));
    urlReady.set(key, u); return u;
  }).catch((e) => { console.warn('iqra audio', e); urlCache.delete(key); return null; });
  urlCache.set(key, p);
  return p;
}
export function dropCache(key) { urlCache.delete(key); urlReady.delete(key); }
/** تحميل أصوات العنصر مسبقاً (عند عرضه) ليبدأ التشغيل فوراً عند الضغط */
export function prefetch(list) { (list || []).forEach((s) => { if (s.key) teacherUrl(s.key); else if (s.gen) genUrl(s.gen, s.opt || gen); }); }

export function probeReciter() {}

// صوت الجهاز: كما كان يعمل أولاً (اختيار الصوت العربي نفسه، وإلغاء ثم نطق داخل لمسة المستخدم)
let voice = null;
const SS = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
function pickVoice() { const V = (SS()?.getVoices?.() || []).filter((v) => /^ar/i.test(v.lang)); voice = V.find((v) => /SA|Maged|Majed|Tarik/i.test(v.lang + v.name)) || V[0] || null; return voice; }
if (SS()) { pickVoice(); try { SS().onvoiceschanged = pickVoice; } catch {} }
export const canSpeak = () => !!SS();
const held = new Set(); // يمنع حذف النطق من الذاكرة قبل انتهائه (خلل في كروم)
function speakNow(text, done, first) {
  const ss = SS(); if (!ss || !text) return done();
  if (!voice) pickVoice();
  let fin = false; const u = new SpeechSynthesisUtterance(text);
  const end = () => { if (fin) return; fin = true; held.delete(u); done(); };
  u.lang = voice?.lang || 'ar-SA'; if (voice) u.voice = voice; u.rate = 0.72; u.pitch = 1;
  u.onend = end; u.onerror = end; held.add(u);
  try { if (first) ss.cancel(); ss.speak(u); } catch { end(); }
  setTimeout(end, 3000 + text.length * 400);
}

/* ---------- الصوت المولَّد (Google): يُولَّد مرة ويُحفظ، ويُسمع ملفاً عادياً على كل الأجهزة ---------- */
export const GEN_VOICES = [['ar-XA-Wavenet-B', 'رجل ١'], ['ar-XA-Wavenet-C', 'رجل ٢'], ['ar-XA-Wavenet-A', 'امرأة ١'], ['ar-XA-Wavenet-D', 'امرأة ٢']];
let gen = { on: false, voice: 'ar-XA-Wavenet-B', rate: 0.8 };
export function setGen(c) { gen = { ...gen, ...(c || {}) }; }
export const genOn = () => gen.on && aiEnabled();
const genReady = new Map(), genCache = new Map();
async function sha1(t) { const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(t)); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
export async function genId(text, voice = gen.voice, rate = gen.rate) { return (await sha1(`${voice}|${rate.toFixed(2)}|${normText(text).slice(0, 120)}`)).slice(0, 28); }
const b64url = (b64, mime) => { const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([arr], { type: mime || 'audio/mpeg' })); };
/** رابط الصوت المولَّد لنص: من المحفوظ، وإلا يُولَّد الآن ويُحفظ */
export function genUrl(text, opt = gen) {
  const t = normText(text).slice(0, 120), ck = opt.voice + '|' + opt.rate + '|' + t;
  if (genCache.has(ck)) return genCache.get(ck);
  const p = (async () => {
    const id = await genId(t, opt.voice, opt.rate);
    let d = await store.getIqraTts(id).catch(() => null);
    let b64 = d?.b64;
    if (!b64) { const r = await ttsGen([t], { voice: opt.voice, rate: opt.rate, audio: true }); b64 = r.items?.[0]?.b64; }
    if (!b64) return null;
    const u = b64url(b64, 'audio/mpeg'); genReady.set(ck, u); return u;
  })().catch((e) => { console.warn('gen tts', e); genCache.delete(ck); return null; });
  genCache.set(ck, p);
  return p;
}
const genReadyUrl = (text, opt = gen) => genReady.get(opt.voice + '|' + opt.rate + '|' + normText(text).slice(0, 120));
/** مصدر نص قصير: تسجيل المعلم، ثم المولَّد، ثم صوت الجهاز */
export const srcFor = (t) => (hasRec(t) ? { key: keyOf(t), fallback: t } : genOn() ? { gen: t, fallback: t } : { tts: t });
export function playGenSample(text, voice) { return playSeq([{ gen: text, fallback: text, opt: { ...gen, voice } }]); }

let playing = null;
export function stopAudio() { playing?.stop(); playing = null; try { SS()?.cancel(); } catch {} try { el?.pause(); } catch {} }

/** يشغّل قائمة مصادر متتالية: {key} تسجيل المعلم، {url} صوت القارئ، {tts} صوت الجهاز */
export function playSeq(list, { gap = 0.18 } = {}) {
  playing?.stop(); try { el?.pause(); } catch {}
  let cancelled = false, first = true, urlFailed = false;
  const me = { stop: () => { cancelled = true; try { el?.pause(); } catch {} try { SS()?.cancel(); } catch {} } };
  playing = me;
  const playUrl = (u, res, fail) => {
    const a = audioEl(); let ok = false, over = false;
    const once = (fn) => () => { if (over) return; over = true; fn(); };
    res = once(res); fail = once(fail);
    const t = setTimeout(() => (ok ? res() : fail()), 12000);
    a.onended = () => { clearTimeout(t); res(); }; a.onerror = () => { clearTimeout(t); fail(); };
    a.onplaying = () => { ok = true; };
    a.src = u; a.currentTime = 0;
    a.play().catch(() => { clearTimeout(t); fail(); });
  };
  const one = (src) => new Promise((res) => {
    if (cancelled) return res();
    const f = first; first = false;
    const tts = (txt) => speakNow(txt, res, f);
    if (src.key) {
      const ready = urlReady.get(src.key);
      if (ready) return playUrl(ready, res, () => tts(src.fallback));
      teacherUrl(src.key).then((u) => (cancelled ? res() : u ? playUrl(u, res, () => tts(src.fallback)) : tts(src.fallback)));
    } else if (src.url) {
      if (urlFailed) return res();
      playUrl(src.url, res, () => { urlFailed = true; tts(src.fallback); });
    } else if (src.gen) {
      const o = src.opt || gen, ready = genReadyUrl(src.gen, o);
      if (ready) return playUrl(ready, res, () => tts(src.fallback));
      genUrl(src.gen, o).then((u) => (cancelled ? res() : u ? playUrl(u, res, () => tts(src.fallback)) : tts(src.fallback)));
    } else if (src.tts) tts(src.tts);
    else res();
  });
  me.done = (async () => { for (const s of list) { if (cancelled) break; await one(s); if (gap) await new Promise((r) => setTimeout(r, gap * 1000)); } if (playing === me) playing = null; })();
  return me;
}

/** مصادر صوت العنصر: تسجيل المعلم، ثم صوت القارئ، ثم تركيب المسجَّل، ثم صوت الجهاز */
export function sourcesFor(item) {
  const s = item.s;
  if (hasRec(s)) return { list: [{ key: keyOf(s), fallback: s }], kind: 'teacher' };
  const urls = reciterUrls(item);
  if (urls) return { list: urls.map((url, i) => ({ url, fallback: i ? '' : s })), kind: 'reciter' };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => hasRec(p))) return { list: parts.map((p) => ({ key: keyOf(p), fallback: p })), kind: 'teacher' };
  return genOn() ? { list: [{ gen: s, fallback: s }], kind: 'gen' } : { list: [{ tts: s }], kind: 'tts' };
}
export const playItem = (item) => playSeq(sourcesFor(item).list);
export const KIND_LABEL = { teacher: 'بصوت معلمك', reciter: 'بصوت القارئ', gen: 'صوت مولَّد', tts: 'صوت الجهاز' };

/* ---------- التسجيل: يتوقف بعد السكوت، ويُقصّ الصمت، ويُحفظ WAV ---------- */
/** يبدأ التسجيل ويعيد { done: وعد بملف WAV, stop } */
export async function recordClip({ onLevel = () => {}, maxSec = 8 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
  const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
  const mimeType = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = []; rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  const a = ctx(); if (a.state === 'suspended') await a.resume().catch(() => {});
  const src = a.createMediaStreamSource(stream), an = a.createAnalyser(); an.fftSize = 512; src.connect(an);
  const data = new Uint8Array(an.fftSize);
  let voiced = false, last = 0, raf = 0, stopped = false;
  const t0 = Date.now();
  let stopFn = () => {};
  const done = new Promise((resolve, reject) => {
    const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); try { rec.stop(); } catch {} };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop()); try { src.disconnect(); } catch {}
      try { resolve(await toWav(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))); } catch (e) { reject(e); }
    };
    const loop = () => {
      an.getByteTimeDomainData(data);
      let sum = 0; for (const v of data) sum += (v - 128) * (v - 128);
      const l = Math.min(1, Math.sqrt(sum / data.length) / 40); onLevel(l);
      const now = Date.now();
      if (l > 0.14) { voiced = true; last = now; }
      if ((voiced && now - last > 900) || now - t0 > maxSec * 1000 || (!voiced && now - t0 > 6000)) return stop();
      raf = requestAnimationFrame(loop);
    };
    rec.start(200); loop();
    stopFn = stop;
  });
  return { done, stop: () => stopFn() };
}
async function toWav(blob) {
  const buf = await ctx().decodeAudioData(await blob.arrayBuffer());
  const ch = buf.getChannelData(0), sr = buf.sampleRate;
  // قصّ الصمت: أول وآخر نافذة (٢٠ م.ث) فيها صوت، مع هامش صغير
  const W = Math.round(sr * 0.02); let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  if (peak < 0.01) throw new Error('لم يُسمع صوت. قرّب الجوال وأعد التسجيل.');
  const thr = Math.max(0.012, peak * 0.08);
  const rms = (s) => { let x = 0; for (let i = s; i < Math.min(ch.length, s + W); i++) x += ch[i] * ch[i]; return Math.sqrt(x / W); };
  let a = 0, b = ch.length;
  for (let s = 0; s < ch.length; s += W) if (rms(s) > thr) { a = s; break; }
  for (let s = ch.length - W; s > 0; s -= W) if (rms(s) > thr) { b = s + W; break; }
  a = Math.max(0, a - Math.round(sr * 0.12)); b = Math.min(ch.length, b + Math.round(sr * 0.18));
  const seg = ch.slice(a, b);
  // إعادة التشكيل إلى ١٦ كيلوهرتز وتطبيع الصوت
  const out = 16000, n = Math.max(1, Math.round(seg.length * out / sr));
  const pcm = new Int16Array(n), gain = 0.9 / peak;
  for (let i = 0; i < n; i++) { const x = i * sr / out, j = Math.floor(x), f = x - j; const v = ((seg[j] || 0) * (1 - f) + (seg[j + 1] || 0) * f) * gain; pcm[i] = Math.max(-1, Math.min(1, v)) * 32767; }
  const head = new DataView(new ArrayBuffer(44));
  const w = (o, s) => [...s].forEach((c, i) => head.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); head.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE'); w(12, 'fmt ');
  head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true); head.setUint32(24, out, true);
  head.setUint32(28, out * 2, true); head.setUint16(32, 2, true); head.setUint16(34, 16, true); w(36, 'data'); head.setUint32(40, pcm.byteLength, true);
  return new Blob([head, pcm], { type: 'audio/wav' });
}
/** يحفظ تسجيل المعلم لنص معين ويحدّث الفهرس */
export async function saveRecording(text, blob) {
  const key = keyOf(text), b64 = await blobToB64(blob);
  await store.saveIqraAudio(key, { b64, mime: 'audio/wav', t: normText(text), at: new Date().toISOString() });
  dropCache(key);
  const v = { t: normText(text), at: Date.now() };
  await store.setIqraAudioIdx(key, v);
  setIdxLocal(key, v); dropCache(key);
  return key;
}
export async function deleteRecording(text) {
  const key = keyOf(text);
  await store.deleteIqraAudio(key); await store.setIqraAudioIdx(key, null);
  setIdxLocal(key, null); dropCache(key);
}
export function playBlob(blob) { stopAudio(); const a = audioEl(); a.onended = a.onerror = a.onplaying = null; a.src = URL.createObjectURL(blob); a.play().catch(() => {}); return a; }
