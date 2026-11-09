// التلقين المتدرج: تُقسَّم كل آية إلى مقاطع من ٣–٥ كلمات تتراكم.
// لكل مقطع: 🎧 استمع (يتكرر) ← 👁 ردّد نظراً ← 🎙️ سمّع غيباً (لا ينتقل إلا بدقة ٨٥٪ فأكثر).
// وبعد كل آية (عدا الأولى): ربط الآية السابقة بالحالية غيباً.
// الاستماع لجزء من الآية: توقيتات الكلمات لتلاوة مشاري العفاسي من Quran.com، وإن تعذرت نقدّرها من صوت الآية.
import { rangeWords, surahName, toArabicDigits as ar } from './quran.js';
import { RecitationSession, hasRecognition, ayahAudioUrl, RECITERS } from './speech.js';
import { align, score } from './align.js';
import { confetti } from './celebrate.js';

const PASS = 85;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** يقسم كلمات الآية إلى مقاطع متقاربة الطول (٣–٥ كلمات) */
export function chunkWords(n) {
  if (n <= 5) return [[0, n]];
  const m = Math.ceil(n / 4), out = [];
  let s = 0;
  for (let k = 0; k < m; k++) { const len = Math.round((n - s) / (m - k)); out.push([s, s + len]); s += len; }
  return out;
}

/* ---------- الصوت ---------- */
// أرقام القرّاء في Quran.com (للتلاوة نفسها مع توقيت كل كلمة)
const QDC = { Alafasy_128kbps: 7, Husary_128kbps: 6, Husary_Muallim_128kbps: 12, Minshawy_Murattal_128kbps: 9, Abdul_Basit_Murattal_192kbps: 2, khalefa_al_tunaiji_64kbps: 161 };
const timingCache = new Map();
async function chapterTimings(surah, reciter) {
  const rid = QDC[reciter];
  if (!rid) return null;
  const ck = rid + ':' + surah;
  if (timingCache.has(ck)) return timingCache.get(ck);
  const p = (async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(`https://api.qurancdn.com/api/qdc/audio/reciters/${rid}/audio_files?chapter=${surah}&segments=true`, { signal: ctl.signal });
      if (!r.ok) return null;
      const j = await r.json();
      const f = j.audio_files?.[0] || j.audio_file;
      const vt = f?.verse_timings || f?.timestamps;
      if (!f?.audio_url || !vt?.length) return null;
      const by = {};
      vt.forEach((v) => { by[+String(v.verse_key).split(':')[1]] = { from: v.timestamp_from, to: v.timestamp_to, seg: (v.segments || []).filter((s) => s.length >= 3) }; });
      return { url: f.audio_url, by };
    } catch { return null; } finally { clearTimeout(t); }
  })();
  timingCache.set(ck, p);
  return p;
}

class ClipPlayer {
  constructor() { this.a = new Audio(); this.a.preload = 'auto'; this.token = 0; }
  stop() { this.token++; this.a.pause(); }
  /** يشغّل من الثانية start إلى end من الملف url، reps مرات */
  async play(url, start, end, reps, onRep = () => {}) {
    const my = ++this.token;
    if (this.a.src !== url) { this.a.src = url; }
    await new Promise((res) => { if (this.a.readyState >= 1) return res(); const ok = () => { this.a.removeEventListener('loadedmetadata', ok); res(); }; this.a.addEventListener('loadedmetadata', ok); setTimeout(res, 8000); });
    if (end == null || !isFinite(end) || end <= start) end = this.a.duration || start + 5;
    for (let i = 0; i < reps; i++) {
      if (my !== this.token) return false;
      onRep(i + 1);
      this.a.currentTime = Math.max(0, start);
      try { await this.a.play(); } catch { return false; }
      await new Promise((res) => {
        const tick = () => { if (my !== this.token || this.a.currentTime >= end || this.a.ended) { this.a.removeEventListener('timeupdate', tick); res(); } };
        this.a.addEventListener('timeupdate', tick);
        const iv = setInterval(() => { if (my !== this.token || this.a.currentTime >= end || this.a.ended) { clearInterval(iv); res(); } }, 60);
      });
      this.a.pause();
      if (i < reps - 1) await sleep(700);
    }
    return my === this.token;
  }
}

/** موضع المقطع [ws, we) من الآية بالثواني: {url, start, end} */
async function clipFor(surah, ayah, words, ws, we, reciter) {
  const t = await chapterTimings(surah, reciter);
  const v = t?.by?.[ayah];
  if (v && v.seg.length) {
    const max = Math.max(...v.seg.map((s) => s[0]));
    const idx = (i) => (max === words.length ? i + 1 : Math.max(1, Math.round(((i + 0.5) / words.length) * max))); // تقابل الكلمات إن اختلف العدد
    const s1 = v.seg.find((s) => s[0] === idx(ws)) || v.seg[0];
    const s2 = [...v.seg].reverse().find((s) => s[0] === idx(we - 1)) || v.seg[v.seg.length - 1];
    // التوقيتات قد تكون من بداية ملف السورة أو من بداية الآية: نتحقق أيهما
    const abs = v.from > 0 && v.seg[0][1] >= v.from - 1500;
    const base = abs ? 0 : v.from;
    return { url: t.url, start: Math.max(0, (base + s1[1]) / 1000 - 0.05), end: (base + s2[2]) / 1000 + 0.15 };
  }
  // تقدير بطول الحروف من صوت الآية كاملة
  const url = ayahAudioUrl(reciter, surah, ayah);
  const len = words.map((w) => (w.text || '').replace(/[ً-ٰٟۖ-ۭ\s]/g, '').length + 1);
  const tot = len.reduce((a, b) => a + b, 0);
  const before = len.slice(0, ws).reduce((a, b) => a + b, 0), upto = len.slice(0, we).reduce((a, b) => a + b, 0);
  return { url, frac: [before / tot, upto / tot] };
}

/* ---------- الواجهة ---------- */
/**
 * opts: { surah, from, to, reps, reciter, onActivity(sec), onAyahDone({surah, from, to, percent}), onFinish(), finishLabel }
 */
export function mountTalqeen(root, opts) {
  const { surah, from, to } = opts;
  const player = new ClipPlayer();
  let reps = opts.reps || 3, sess = null, dead = false, started = Date.now();
  let reciter = opts.reciter || 'Alafasy_128kbps';
  try { const r = JSON.parse(localStorage.getItem('fp_pref_talqeenReciter')); if (RECITERS.some((x) => x.id === r)) reciter = r; } catch {}
  const steps = [];
  for (let a = from; a <= to; a++) {
    const words = rangeWords(surah, a, a);
    const ch = chunkWords(words.length);
    ch.forEach(([ws, we], k) => {
      steps.push({ kind: 'listen', a, words, ws, we, k, of: ch.length });
      steps.push({ kind: 'read', a, words, we, k, of: ch.length });
      steps.push({ kind: 'recite', a, words, we, k, of: ch.length });
    });
    if (a > from) steps.push({ kind: 'link', a });
  }
  let i = 0;
  const wordsSpan = (w, upto, hi = null) => w.slice(0, upto).map((x, j) => `<span class="tq-w${hi && j >= hi[0] && j < hi[1] ? ' hi' : ''}" data-j="${j}">${esc(x.text)}</span>`).join(' ');
  const progress = () => {
    const s = steps[i];
    const ayahs = to - from + 1, n = s.a - from + 1;
    return `<div class="tq-top"><div><b>سورة ${esc(surahName(surah))}</b> · الآية ${ar(s.a)} <span class="muted">(${ar(n)} من ${ar(ayahs)})</span>${s.kind !== 'link' && s.of > 1 ? ` · المقطع ${ar(s.k + 1)} من ${ar(s.of)}` : ''}</div>
      <span class="row" style="gap:8px">${opts.onExit ? '<button class="btn sm ghost" type="button" id="tqExit">✕ خروج</button>' : ''}<label class="small">القارئ <select id="tqRec">${RECITERS.map((r) => `<option value="${r.id}" ${r.id === reciter ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><label class="small">التكرار <select id="tqReps">${[1, 2, 3, 4, 5].map((r) => `<option ${r === reps ? 'selected' : ''}>${r}</option>`).join('')}</select></label></span></div>
      <div class="tq-bar"><i style="width:${Math.round((i / steps.length) * 100)}%"></i></div>
      <div class="tq-steps">${['listen', 'read', 'recite'].map((k, j) => `<span class="${s.kind === k ? 'on' : s.kind === 'link' || ['listen', 'read', 'recite'].indexOf(s.kind) > j ? 'done' : ''}">${['🎧 استمع', '👁 ردّد نظراً', '🎙️ سمّع غيباً'][j]}</span>`).join('')}${s.kind === 'link' ? '<span class="on">🔗 اربط الآيتين</span>' : ''}</div>`;
  };
  async function listen(s) {
    const box = root.querySelector('#tqPlay');
    const set = (t) => { if (box) box.textContent = t; };
    set('جارٍ تجهيز الصوت…');
    const c = await clipFor(surah, s.a, s.words, s.ws, s.we, reciter);
    if (dead || steps[i] !== s) return;
    let start = c.start, end = c.end;
    if (c.frac) { // نحتاج مدة الآية أولاً
      await new Promise((res) => { player.a.src = c.url; player.a.onloadedmetadata = res; setTimeout(res, 6000); });
      const d = player.a.duration || 0; start = Math.max(0, d * c.frac[0] - 0.15); end = d * c.frac[1] + 0.35;
    }
    const ok = await player.play(c.url, start, end, reps, (r) => set(`🔊 يُتلى المقطع… (${ar(r)} من ${ar(reps)})`));
    if (ok) set('✓ انتهى الاستماع. ردّده بصوتك ثم اضغط «التالي».');
  }
  function draw() {
    if (dead) return;
    player.stop(); sess?.cancel(); sess = null;
    if (i >= steps.length) return finish();
    const s = steps[i];
    let body = '';
    if (s.kind === 'listen') {
      body = `<div class="tq-card"><p class="tq-hint">استمع جيداً للمقطع المظلَّل${s.k ? '، وما قبله حفظته' : ''}:</p>
        <div class="quran tq-text">${wordsSpan(s.words, s.we, [s.ws, s.we])}</div>
        <div class="tq-play" id="tqPlay"></div>
        <div class="row"><button class="btn" type="button" id="tqAgain">🔁 أعد الاستماع</button><button class="btn primary" type="button" id="tqNext">التالي ←</button></div></div>`;
    } else if (s.kind === 'read') {
      body = `<div class="tq-card"><p class="tq-hint">ردّد بصوتك ناظراً إلى النص ${reps > 1 ? `${ar(reps)} مرات` : ''}، حتى تشعر أنك حفظته:</p>
        <div class="quran tq-text">${wordsSpan(s.words, s.we)}</div>
        <div class="row"><button class="btn" type="button" id="tqBack">🎧 استمع مرة أخرى</button><button class="btn primary" type="button" id="tqNext">ردّدته، التالي ←</button></div></div>`;
    } else {
      const words = s.kind === 'link' ? rangeWords(surah, s.a - 1, s.a) : s.words.slice(0, s.we);
      s.target = words;
      body = `<div class="tq-card"><p class="tq-hint">${s.kind === 'link' ? `أحسنت! الآن اربط: سمّع الآيتين ${ar(s.a - 1)} و${ar(s.a)} معاً غيباً.` : 'أغمض عينيك عن النص، وسمّع غيباً. تظهر الكلمات كلما قرأتها صحيحة:'}</p>
        <div class="quran tq-text tq-hidden">${words.map((x, j) => `<span class="tq-w" data-j="${j}">${esc(x.text)}</span>`).join(' ')}</div>
        <div class="tq-mic"><button class="mic" type="button" id="tqMic" aria-label="ابدأ التسميع"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg></button>
          <div class="small" id="tqSt">${hasRecognition ? 'اضغط الميكروفون وابدأ.' : 'متصفحك لا يدعم التصحيح الآلي: سمّع بصوتك ثم قيّم نفسك.'}</div></div>
        <div class="row">${hasRecognition ? '' : '<button class="btn primary" type="button" id="tqSelf">سمّعتها صحيحة ✓</button>'}<button class="btn" type="button" id="tqPeek">👁 أظهر النص</button>${s.kind === 'link' ? '' : '<button class="btn ghost" type="button" id="tqBack">🎧 استمع مرة أخرى</button>'}</div></div>`;
    }
    root.innerHTML = `<div class="talqeen">${progress()}${body}</div>`;
    root.querySelector('#tqRec').onchange = (e) => { reciter = e.target.value; try { localStorage.setItem('fp_pref_talqeenReciter', JSON.stringify(reciter)); } catch {} if (steps[i]?.kind === 'listen') listen(steps[i]); };
    root.querySelector('#tqReps').onchange = (e) => { reps = +e.target.value; try { localStorage.setItem('fp_pref_talqeenReps', String(reps)); } catch {} };
    const $ = (q) => root.querySelector(q);
    if ($('#tqNext')) $('#tqNext').onclick = () => { i++; draw(); };
    if ($('#tqAgain')) $('#tqAgain').onclick = () => listen(s);
    if ($('#tqBack')) $('#tqBack').onclick = () => { i = Math.max(0, steps.findIndex((x) => x.kind === 'listen' && x.a === s.a && x.k === s.k)); draw(); };
    if ($('#tqExit')) $('#tqExit').onclick = () => opts.onExit?.();
    if ($('#tqPeek')) $('#tqPeek').onclick = () => $('.tq-text').classList.toggle('tq-hidden');
    if ($('#tqSelf')) $('#tqSelf').onclick = () => pass(s, 100);
    if ($('#tqMic')) $('#tqMic').onclick = () => toggleMic(s);
    if (s.kind === 'listen') listen(s);
  }
  async function toggleMic(s) {
    const st = root.querySelector('#tqSt'), btn = root.querySelector('#tqMic');
    if (sess) { const r = await sess.stop(); sess = null; btn.classList.remove('rec'); return judge(s, r.transcript, r.duration, true); }
    const els = [...root.querySelectorAll('.tq-text .tq-w')];
    const lvl = (v) => btn.style.setProperty('--lvl', v);
    sess = new RecitationSession({
      onLevel: lvl,
      onTranscript: (tx) => {
        const res = align(s.target, tx, { partial: true });
        res.status.forEach((x, j) => els[j]?.classList.toggle('ok', x === 'correct'));
        if (res.status.every((x) => x === 'correct')) { const ss = sess; sess = null; btn.classList.remove('rec'); ss.stop().then((r) => judge(s, r.transcript || tx, r.duration)); }
      },
      onError: (m) => { if (st) st.textContent = m; },
      maxSeconds: 120,
    });
    try { await sess.start(); btn.classList.add('rec'); st.textContent = '🎙️ أسمعك… سمّع الآن، واضغط مرة أخرى عند الانتهاء.'; }
    catch (e) { sess = null; if (e.code !== 'cancelled') st.textContent = '🎙️ ' + e.message; }
  }
  function judge(s, transcript, dur, manual = false) {
    const res = align(s.target, transcript || '');
    const sc = score(res, dur || 0, s.target);
    const els = [...root.querySelectorAll('.tq-text .tq-w')];
    res.status.forEach((x, j) => { els[j]?.classList.toggle('ok', x === 'correct'); els[j]?.classList.toggle('bad', x !== 'correct'); });
    if (sc.percent >= PASS) return pass(s, sc.percent);
    const st = root.querySelector('#tqSt');
    root.querySelector('.tq-text').classList.remove('tq-hidden');
    if (st) st.innerHTML = `<b>${ar(sc.percent)}٪</b>: الكلمات الحمراء تحتاج تثبيتاً. استمع أو ردّد ثم أعد المحاولة بالميكروفون.`;
  }
  async function pass(s, percent) {
    const st = root.querySelector('#tqSt');
    if (st) st.innerHTML = `<b class="ok-t">✓ ممتاز ${ar(percent)}٪</b>`;
    root.querySelector('.tq-text')?.classList.remove('tq-hidden');
    // الآية تُحتسب في «مصحفي» عند تسميعها كاملة
    if (s.kind === 'recite' && s.we === s.words.length) opts.onAyahDone?.({ surah, from: s.a, to: s.a, percent, statuses: '' });
    if (s.kind === 'link') opts.onAyahDone?.({ surah, from: s.a - 1, to: s.a, percent, statuses: '' });
    await sleep(900);
    if (dead || steps[i] !== s) return;
    i++; draw();
  }
  function finish() {
    const sec = Math.round((Date.now() - started) / 1000);
    if (sec >= 60) opts.onActivity?.(sec);
    root.innerHTML = `<div class="talqeen"><div class="tq-card tq-done"><div class="tq-big">🌟</div><h2>بارك الله فيك! حفظت ${to > from ? `الآيات ${ar(from)}–${ar(to)}` : `الآية ${ar(from)}`} من سورة ${esc(surahName(surah))}</h2>
      <p class="muted">ثبّت حفظك الآن بتسميع المقطع كاملاً غيباً.</p>
      <div class="row" style="justify-content:center"><button class="btn primary" type="button" id="tqFin">${esc(opts.finishLabel || '🎙️ سمّع المقطع كاملاً')}</button><button class="btn" type="button" id="tqRe">↺ من البداية</button></div></div></div>`;
    confetti();
    root.querySelector('#tqFin').onclick = () => opts.onFinish?.();
    root.querySelector('#tqRe').onclick = () => { i = 0; started = Date.now(); draw(); };
  }
  try { reps = +(localStorage.getItem('fp_pref_talqeenReps') || reps) || 3; } catch {}
  draw();
  return { destroy() { dead = true; player.stop(); sess?.cancel(); } };
}
