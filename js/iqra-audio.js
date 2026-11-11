// أصوات «اقرأ وارتقِ»: تسجيلات المعلم (اللَّبِنات والكلمات)، وصوت القارئ كلمةً كلمة للكلمات القرآنية،
// وتركيب الأصوات المسجلة (أسماء الحروف، وسلاسل التجريد)، وصوت الجهاز احتياطاً.
// تسجيلات المعلم تُحفظ WAV أحادياً (١٦ كيلوهرتز) بعد قصّ الصمت، فتعمل على كل الأجهزة.
import { store, blobToB64 } from './store.js';
import { WBW } from './iqra-wbw.js';
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

/** صوت القارئ للكلمة المفردة الموجودة بنصها في المصحف (لا للعبارات ولا لصيغ الوقف) */
export function reciterUrl(item) {
  if (!item || item.s !== item.t || /\s/.test(item.t.trim())) return null;
  const p = WBW[normText(item.t)];
  return p ? `${WBW_BASE}${pad3(p[0])}_${pad3(p[1])}_${pad3(p[2])}.mp3` : null;
}

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
let ac = null;
const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
const bufCache = new Map();
async function teacherBuffer(key) {
  if (bufCache.has(key)) return bufCache.get(key);
  const p = (async () => {
    const d = await store.getIqraAudio(key);
    if (!d?.b64) return null;
    const bin = atob(d.b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return await ctx().decodeAudioData(arr.buffer);
  })().catch((e) => { console.warn('iqra audio', e); return null; });
  bufCache.set(key, p);
  return p;
}
export function dropCache(key) { bufCache.delete(key); }

let playing = null;
const SS = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
/** إيقاف صوت الجهاز فقط إن كان يتكلم: الإلغاء ثم النطق فوراً يُسقط النطق في بعض المتصفحات */
function hush() { const ss = SS(); try { if (ss && (ss.speaking || ss.pending)) { ss.cancel(); return true; } } catch {} return false; }
export function stopAudio() { playing?.stop(); playing = null; hush(); }

/* آيفون وبعض متصفحات أندرويد لا تسمح بالصوت إلا بعد لمسة من المستخدم:
   عند أول لمسة نفتح سياق الصوت ونُطلق نطقاً فارغاً، فيعمل الصوت بعدها حتى لو بدأ متأخراً (بعد تحميل) */
let unlocked = false;
function unlock() {
  try { const a = ctx(); if (a.state === 'suspended') a.resume().catch(() => {}); } catch {}
  if (unlocked) return; unlocked = true;
  try { const ss = SS(); if (ss) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; ss.speak(u); } } catch {}
}
if (typeof document !== 'undefined') ['pointerdown', 'touchend', 'keydown'].forEach((e) => document.addEventListener(e, unlock, { capture: true, passive: true }));

const held = new Set(); // يمنع حذف النطق من الذاكرة قبل انتهائه (خلل معروف في كروم)
let arVoice = null;
const pickAr = () => { const V = SS()?.getVoices?.() || []; arVoice = V.find((v) => /^ar[-_]SA/i.test(v.lang)) || V.find((v) => /^ar/i.test(v.lang)) || arVoice; return arVoice; };
if (SS()) { pickAr(); try { SS().addEventListener?.('voiceschanged', pickAr); } catch {} }
function speakNow(text, done) {
  const ss = SS(); if (!ss || !text) return done();
  let fin = false; const end = () => { if (fin) return; fin = true; held.delete(u); done(); };
  const u = new SpeechSynthesisUtterance(text);
  const v = pickAr(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'ar-SA';
  u.rate = 0.75; u.onend = end; u.onerror = end; held.add(u);
  const go = () => { try { ss.resume?.(); ss.speak(u); } catch { end(); } };
  if (hush()) setTimeout(go, 90); else go();
  setTimeout(end, 2500 + text.length * 350);
}

/** يشغّل قائمة مصادر متتالية: {key} تسجيل المعلم، {url} صوت القارئ، {tts} صوت الجهاز */
export function playSeq(list, { gap = 0.18 } = {}) {
  stopAudio();
  let cancelled = false, cur = null;
  const me = { stop: () => { cancelled = true; try { cur?.stop?.(); cur?.pause?.(); } catch {} hush(); } };
  playing = me;
  const one = (src) => new Promise((res) => {
    if (cancelled) return res();
    if (src.key) {
      teacherBuffer(src.key).then((b) => {
        if (!b || cancelled) return res(b ? undefined : one({ tts: src.fallback }));
        const n = ctx().createBufferSource(); n.buffer = b; n.connect(ctx().destination); n.onended = () => res(); cur = n;
        if (ctx().state === 'suspended') ctx().resume().catch(() => {});
        n.start();
      });
    } else if (src.url) {
      const a = new Audio(src.url); cur = a;
      let failed = false; const fail = () => { if (failed) return; failed = true; res(one({ tts: src.fallback })); };
      a.onended = () => res(); a.onerror = fail;
      a.play().catch(fail);
    } else if (src.tts) {
      speakNow(src.tts, res);
    } else res();
  });
  const done = (async () => { for (const s of list) { if (cancelled) break; await one(s); if (gap) await new Promise((r) => setTimeout(r, gap * 1000)); } if (playing === me) playing = null; })();
  me.done = done;
  return me;
}

/** مصادر صوت العنصر: تسجيل المعلم، ثم صوت القارئ، ثم تركيب المسجَّل، ثم صوت الجهاز */
export function sourcesFor(item) {
  const s = item.s;
  if (hasRec(s)) return { list: [{ key: keyOf(s), fallback: s }], kind: 'teacher' };
  const url = reciterUrl(item);
  if (url) return { list: [{ url, fallback: s }], kind: 'reciter' };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => hasRec(p))) return { list: parts.map((p) => ({ key: keyOf(p), fallback: p })), kind: 'teacher' };
  return { list: [{ tts: s }], kind: 'tts' };
}
export const playItem = (item) => playSeq(sourcesFor(item).list);
export const KIND_LABEL = { teacher: 'بصوت معلمك', reciter: 'بصوت القارئ', tts: 'صوت آلي' };

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
export function playBlob(blob) { stopAudio(); const a = new Audio(URL.createObjectURL(blob)); a.play().catch(() => {}); playing = { stop: () => a.pause() }; return a; }
