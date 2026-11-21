// «العب وتعلّم»: رحلة دروس المنهج على شكل ألعاب (سباق سيارات، عدّاء)
// كل درس مرحلة: ٨–١٠ أسئلة تظهر عند المنعطفات والبوابات، والنجوم حسب نسبة الإجابات الصحيحة.
// النقاط: لكل نجمة جديدة نقاط شرف بحد يومي يضبطه المعلم (تُحسب في جهاز المعلم وتُنشر في اللوحة).
// تقدّم الطالب: roster/{pn}/progress/play ← { st: { L01: { s, b, n, at, t1, t2, t3, w } } }
import { store } from '../store.js';
import { loadQuran, ayahText, normalize, toArabicDigits as ar } from '../quran.js';
import { TERM, DOMAINS, LESSONS } from './g8s1.js';

export const PLAY_DEFAULT = { mode: 'none', classes: [], pns: [], on: {}, pts: 1, cap: 6 };
export const GAMES = { race: { ic: '🏎️', t: 'سباق السيارات' }, runner: { ic: '🏃', t: 'العدّاء' } };
const STARS = [50, 75, 90];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(d);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const starsOf = (pct) => STARS.filter((t) => pct >= t).length;
const pctTxt = (n) => ar(Math.round(n)) + '٪';
const starRow = (n, big) => `<span class="pg-stars${big ? ' big' : ''}" aria-label="${ar(n)} من ٣ نجوم">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

/* ---------------- الإعداد والنقاط ---------------- */
export async function playCfg() {
  let c = null;
  try { c = await store.getPlayCfg(); } catch {}
  return { ...PLAY_DEFAULT, ...(c || {}) };
}
export function playOnFor(cfg, me) {
  if (!cfg || !me) return false;
  if (cfg.mode === 'all') return true;
  if (cfg.mode === 'classes') return (cfg.classes || []).includes(me.classId);
  if (cfg.mode === 'pns') return (cfg.pns || []).includes(me.id);
  return false;
}
/** من تظهر لهم الميزة من قائمة الطلاب */
export const playStudents = (cfg, students) => students.filter((s) => playOnFor(cfg, { id: s.id, classId: s.classId }));
/** من نقرأ تقدّمهم: المفعّلون الآن ومن فُعّل لهم سابقاً (حتى لا تسقط نقاطهم من اللوحة إذا أُخفي عنهم التبويب) */
export const playPns = (cfg, students) => [...new Set([...(cfg.ever || []), ...playStudents(cfg, students).map((s) => s.id)])].filter((p) => students.some((s) => s.id === p));

/** نقاط لوحة الشرف: لكل نجمة جديدة pts نقطة، ولا يزيد مجموع اليوم (بتوقيت الرياض) على cap */
export function playBonus(states, cfg = PLAY_DEFAULT) {
  const pts = Number(cfg?.pts ?? PLAY_DEFAULT.pts), cap = Number(cfg?.cap ?? PLAY_DEFAULT.cap), out = [];
  if (!(pts > 0)) return out;
  Object.entries(states || {}).forEach(([pn, st]) => {
    const T = [];
    Object.values(st?.st || {}).forEach((r) => ['t1', 't2', 't3'].forEach((k) => { if (r && r[k]) T.push(r[k]); }));
    T.sort();
    const used = {};
    T.forEach((t) => {
      const d = rday(new Date(t)), left = cap > 0 ? cap - (used[d] || 0) : pts, b = Math.min(pts, left);
      if (b > 0) { used[d] = (used[d] || 0) + b; out.push({ pn, bonus: b, createdAt: t, kind: 'play' }); }
    });
  });
  return out;
}
export const playTotal = (pn, st, cfg) => playBonus({ [pn]: st }, cfg).reduce((k, x) => k + x.bonus, 0);
const todayPts = (pn, st, cfg) => { const d = rday(); return playBonus({ [pn]: st }, cfg).filter((x) => rday(new Date(x.createdAt)) === d).reduce((k, x) => k + x.bonus, 0); };

/** الدروس بعد تعديلات المعلم على الأسئلة */
export function lessonsWith(over) {
  return LESSONS.map((L) => {
    const o = over?.[L.id];
    return { ...L, qs: Array.isArray(o?.qs) ? o.qs : L.qs, ayat: L.ayat ? { ...L.ayat, n: o?.n ?? L.ayat.n } : null, edited: !!o };
  });
}
const domainOf = (id) => DOMAINS.find((d) => d.id === id);
const gameOf = (L) => domainOf(L.d)?.game || 'race';

/* ---------------- أسئلة المصحف (تُولَّد من نص المصحف نفسه فلا يُخطأ فيه) ---------------- */
const words = (s, a) => ayahText(s, a).split(' ').filter(Boolean);
const cut = (w, n) => (w.length > n ? w.slice(0, n).join(' ') + ' …' : w.join(' '));
function genAyat(spec) {
  const { s, from, to } = spec, n = Math.max(0, spec.n | 0);
  if (!n || !ayahText(s, from)) return [];
  const R = []; for (let a = from; a <= to; a++) R.push(a);
  const total = (() => { let k = from; while (ayahText(s, k + 1)) k++; return Math.max(k, to); })();
  const near = []; for (let a = Math.max(1, from - 12); a <= Math.min(total, to + 12); a++) near.push(a);
  const out = [], seen = new Set();
  const kinds = shuffle([...(R.length >= 4 ? ['ord', 'next'] : []), 'miss', 'comp', 'miss', 'comp', ...(R.length >= 3 ? ['next', 'ord'] : []), 'miss', 'comp']);
  let guard = 0;
  while (out.length < n && guard++ < 80) {
    const k = kinds[out.length % kinds.length];
    if (k === 'miss') {
      const a = pick(R), w = words(s, a); if (w.length < 3) continue;
      const idx = shuffle(w.map((_, i) => i).filter((i) => normalize(w[i]).length >= 3 && i > 0));
      const i = idx[0]; if (i == null || seen.has('m' + a + i)) continue;
      const right = w[i], nr = normalize(right);
      const pool = shuffle(near.flatMap((b) => words(s, b)).filter((x) => normalize(x).length >= 3 && normalize(x) !== nr));
      const wrong = []; pool.forEach((x) => { if (wrong.length < 3 && !wrong.some((y) => normalize(y) === normalize(x))) wrong.push(x); });
      if (wrong.length < 3) continue;
      seen.add('m' + a + i);
      const v = w.map((x, j) => (j === i ? '<b class="pg-blank">⬚⬚⬚</b>' : esc(x))).join(' ');
      out.push({ t: 'mcq', q: `ما الكلمة الناقصة؟ (الآية ${ar(a)})`, vh: v, a: [right, ...wrong], qf: 1, auto: 1 });
    } else if (k === 'comp') {
      const a = pick(R.filter((b) => words(s, b).length >= 6)); if (!a || seen.has('c' + a)) continue;
      const w = words(s, a), h = Math.ceil(w.length / 2), right = cut(w.slice(h), 6);
      const others = shuffle(near.filter((b) => b !== a && words(s, b).length >= 5)).map((b) => { const x = words(s, b); return cut(x.slice(Math.ceil(x.length / 2)), 6); }).filter((x, i, A) => x !== right && A.indexOf(x) === i).slice(0, 3);
      if (others.length < 3) continue;
      seen.add('c' + a);
      out.push({ t: 'mcq', q: `أكمل الآية ${ar(a)}:`, v: w.slice(0, h).join(' ') + ' …', a: [right, ...others], qf: 1, auto: 1 });
    } else if (k === 'next') {
      const a = pick(R.slice(0, -1)); if (!a || seen.has('n' + a)) continue;
      const right = cut(words(s, a + 1), 5);
      const others = shuffle(near.filter((b) => b !== a + 1 && b !== a)).map((b) => cut(words(s, b), 5)).filter((x, i, A) => x !== right && A.indexOf(x) === i).slice(0, 3);
      if (others.length < 3) continue;
      seen.add('n' + a);
      out.push({ t: 'mcq', q: 'ما الآية التي تلي هذه الآية؟', v: cut(words(s, a), 9), a: [right, ...others], qf: 1, auto: 1 });
    } else if (k === 'ord') {
      const L = Math.min(4, R.length), st = R[Math.floor(Math.random() * (R.length - L + 1))]; if (seen.has('o' + st)) continue;
      const items = []; for (let a = st; a < st + L; a++) items.push(cut(words(s, a), 4));
      if (new Set(items).size < items.length) continue;
      seen.add('o' + st);
      out.push({ t: 'ord', q: `رتّب الآيات (${ar(st)}–${ar(st + L - 1)}) كما في المصحف:`, a: items, qf: 1, auto: 1 });
    }
  }
  return out;
}
/** أسئلة جولة واحدة: ١٠ أسئلة (أو أقل إن قلّ بنك الدرس)، بلا تكرار، مخلوطة */
async function roundQs(L, count = 10) {
  let auto = [];
  if (L.ayat?.n) { try { await loadQuran(); auto = genAyat(L.ayat); } catch (e) { console.warn('quran', e); } }
  const hand = shuffle(L.qs || []);
  // نصف الجولة تقريباً من أسئلة الحفظ إن وُجدت، والباقي من أسئلة الدرس
  const nAuto = Math.min(auto.length, L.ayat ? Math.max(Math.ceil(count / 2), count - hand.length) : 0);
  const Q = [...auto.slice(0, nAuto), ...hand.slice(0, count - nAuto)];
  return shuffle(Q).slice(0, count);
}

/* ---------------- الأصوات (مولّدة، بلا ملفات) ---------------- */
let AC = null, muted = (() => { try { return localStorage.getItem('fp_pgMute') === '1'; } catch { return false; } })();
function tone(f, d = 0.12, type = 'sine', vol = 0.12, at = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state !== 'running') AC.resume();
    const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  } catch {}
}
export const sfx = {
  ok: () => { tone(660, 0.1, 'triangle'); tone(880, 0.16, 'triangle', 0.12, 0.09); },
  bad: () => { tone(220, 0.22, 'sawtooth', 0.07); tone(160, 0.25, 'sawtooth', 0.06, 0.12); },
  tap: () => tone(520, 0.05, 'square', 0.04),
  bump: () => tone(110, 0.15, 'square', 0.08),
  coin: () => { tone(988, 0.06, 'square', 0.05); tone(1319, 0.1, 'square', 0.05, 0.06); },
  go: () => tone(880, 0.3, 'triangle', 0.12),
  beep: () => tone(440, 0.15, 'triangle', 0.1),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.11, i * 0.12)),
  unlock: () => { if (!muted) tone(1, 0.01, 'sine', 0.0001); },
};

/* ---------------- بطاقة السؤال ---------------- */
function askQ(box, q, i, n) {
  return new Promise((resolve) => {
    const lim = q.t === 'ord' || q.t === 'mat' ? 50 : q.qf ? 30 : 25;
    let done = false, raf = 0;
    const t0 = performance.now();
    const qcls = q.qf ? ' quran' : '';
    const head = `<div class="pq-time"><i></i></div><div class="pq-h"><span>سؤال ${ar(i + 1)} من ${ar(n)}</span><span class="pq-tl"></span></div>
      <p class="pq-q">${esc(q.q)}</p>${q.vh ? `<div class="pq-v quran">${q.vh}</div>` : q.v ? `<div class="pq-v quran">${esc(q.v)}</div>` : ''}`;
    let body = '';
    let opts = [];
    if (q.t === 'mcq') { opts = shuffle(q.a.map((x, k) => ({ x, ok: k === 0 }))); body = `<div class="pq-opts">${opts.map((o, k) => `<button type="button" class="pq-o${qcls}" data-k="${k}">${esc(o.x)}</button>`).join('')}</div>`; }
    if (q.t === 'tf') body = '<div class="pq-opts tf"><button type="button" class="pq-o" data-tf="1">✔ صواب</button><button type="button" class="pq-o" data-tf="0">✘ خطأ</button></div>';
    let ordSel = [], ordPool = [], matKeys = [], matVals = [], matSel = null, matPair = {};
    if (q.t === 'ord') { ordPool = shuffle(q.a.map((x, k) => ({ x, k }))); if (ordPool.every((o, k) => o.k === k)) ordPool.reverse(); body = '<div class="pq-ord"><ol class="pq-ans"></ol><div class="pq-pool"></div></div><button type="button" class="btn primary pq-chk" disabled>تحقّق</button>'; }
    if (q.t === 'mat') { matKeys = q.a.map((p, k) => ({ x: p[0], k })); matVals = shuffle(q.a.map((p, k) => ({ x: p[1], k }))); body = '<p class="small pq-hint">اضغط كلمة ثم معناها.</p><div class="pq-mat"><div class="pq-mk"></div><div class="pq-mv"></div></div><button type="button" class="btn primary pq-chk" disabled>تحقّق</button>'; }
    box.innerHTML = `<div class="pq-card" role="dialog" aria-live="polite">${head}${body}<div class="pq-fb" hidden></div></div>`;
    box.hidden = false;
    const card = box.firstElementChild, bar = card.querySelector('.pq-time i'), tl = card.querySelector('.pq-tl');
    if (location.hostname === 'localhost') { card._q = q; card._opts = opts; } // للاختبار المحلي فقط
    const COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444'];
    const paintOrd = () => {
      card.querySelector('.pq-ans').innerHTML = ordSel.map((o, k) => `<li><button type="button" class="pq-chip on${qcls}" data-back="${k}">${esc(o.x)}</button></li>`).join('') || '<li class="pq-ph">اضغط العناصر بالترتيب الصحيح</li>';
      card.querySelector('.pq-pool').innerHTML = ordPool.map((o, k) => `<button type="button" class="pq-chip${qcls}" data-take="${k}">${esc(o.x)}</button>`).join('');
      card.querySelector('.pq-chk').disabled = ordPool.length > 0;
      card.querySelectorAll('[data-take]').forEach((b) => (b.onclick = () => { sfx.tap(); ordSel.push(ordPool.splice(+b.dataset.take, 1)[0]); paintOrd(); }));
      card.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { ordPool.push(ordSel.splice(+b.dataset.back, 1)[0]); paintOrd(); }));
    };
    const paintMat = () => {
      const colorOf = (k) => { const keys = Object.keys(matPair).map(Number).sort((a, b) => a - b); const at = keys.indexOf(k); return at < 0 ? null : COLORS[at % COLORS.length]; };
      card.querySelector('.pq-mk').innerHTML = matKeys.map((o) => { const c = colorOf(o.k); return `<button type="button" class="pq-chip${matSel === o.k ? ' sel' : ''}${c ? ' paired' : ''}" data-mk="${o.k}" ${c ? `style="--pc:${c}"` : ''}>${esc(o.x)}</button>`; }).join('');
      card.querySelector('.pq-mv').innerHTML = matVals.map((o) => { const key = Object.keys(matPair).find((k) => matPair[k] === o.k); const c = key != null ? colorOf(+key) : null; return `<button type="button" class="pq-chip${c ? ' paired' : ''}" data-mv="${o.k}" ${c ? `style="--pc:${c}"` : ''}>${esc(o.x)}</button>`; }).join('');
      card.querySelector('.pq-chk').disabled = Object.keys(matPair).length < matKeys.length;
      card.querySelectorAll('[data-mk]').forEach((b) => (b.onclick = () => { const k = +b.dataset.mk; sfx.tap(); if (matPair[k] != null && matSel !== k) { delete matPair[k]; matSel = k; } else matSel = matSel === k ? null : k; paintMat(); }));
      card.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => { const v = +b.dataset.mv; if (matSel == null) { const key = Object.keys(matPair).find((k) => matPair[k] === v); if (key != null) { delete matPair[key]; paintMat(); } return; } sfx.tap(); Object.keys(matPair).forEach((k) => { if (matPair[k] === v) delete matPair[k]; }); matPair[matSel] = v; matSel = matKeys.find((o) => matPair[o.k] == null)?.k ?? null; paintMat(); }));
    };
    const finish = (ok, why) => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      card.querySelectorAll('button').forEach((b) => (b.disabled = true));
      card.classList.add(ok ? 'ok' : 'bad');
      (ok ? sfx.ok : sfx.bad)();
      const fb = card.querySelector('.pq-fb'); fb.hidden = false;
      let right = '';
      if (!ok) {
        if (q.t === 'mcq') right = `الصحيح: <b class="${q.qf ? 'pq-qf' : ''}">${esc(q.a[0])}</b>`;
        if (q.t === 'tf') right = `العبارة <b>${q.a ? 'صحيحة' : 'خاطئة'}</b>`;
        if (q.t === 'ord') right = `الترتيب الصحيح:<ol class="pq-right${q.qf ? ' pq-qf' : ''}">${q.a.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
        if (q.t === 'mat') right = `<ul class="pq-right">${q.a.map((p) => `<li><b>${esc(p[0])}</b>: ${esc(p[1])}</li>`).join('')}</ul>`;
      }
      fb.innerHTML = ok ? `<b class="pq-yes">${pick(['أحسنت! 🌟', 'ممتاز! 🚀', 'رائع! 👏', 'إجابة صحيحة ✔', 'بارك الله فيك! ✨'])}</b>`
        : `<b class="pq-no">${why === 'time' ? '⏰ انتهى الوقت' : 'إجابة غير صحيحة'}</b><div>${right}</div>${q.x ? `<p class="pq-x">${esc(q.x)}</p>` : ''}<button type="button" class="btn primary pq-go">متابعة ←</button>`;
      requestAnimationFrame(() => fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      const go = () => { box.hidden = true; box.innerHTML = ''; resolve(ok); };
      if (ok) setTimeout(go, 750);
      else { const b = fb.querySelector('.pq-go'); b.disabled = false; b.onclick = go; b.focus({ preventScroll: true }); }
    };
    if (q.t === 'mcq') card.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { const o = opts[+b.dataset.k]; b.classList.add(o.ok ? 'right' : 'wrong'); if (!o.ok) card.querySelectorAll('[data-k]').forEach((x) => { if (opts[+x.dataset.k].ok) x.classList.add('right'); }); finish(o.ok); }));
    if (q.t === 'tf') card.querySelectorAll('[data-tf]').forEach((b) => (b.onclick = () => { const ok = (b.dataset.tf === '1') === !!q.a; b.classList.add(ok ? 'right' : 'wrong'); finish(ok); }));
    if (q.t === 'ord') { paintOrd(); card.querySelector('.pq-chk').onclick = () => { const ok = ordSel.every((o, k) => o.x === q.a[k]); card.querySelectorAll('.pq-ans .pq-chip').forEach((b, k) => b.classList.add(ordSel[k].x === q.a[k] ? 'right' : 'wrong')); finish(ok); }; }
    if (q.t === 'mat') { paintMat(); card.querySelector('.pq-chk').onclick = () => { const ok = matKeys.every((o) => matPair[o.k] === o.k); card.querySelectorAll('[data-mk]').forEach((b) => b.classList.add(matPair[+b.dataset.mk] === +b.dataset.mk ? 'right' : 'wrong')); finish(ok); }; }
    const tick = () => {
      const left = Math.max(0, lim - (performance.now() - t0) / 1000);
      bar.style.width = (left / lim) * 100 + '%'; bar.classList.toggle('low', left < 6);
      tl.textContent = ar(Math.ceil(left)) + ' ث';
      if (left <= 0) return finish(false, 'time');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    box._abort = () => { if (!done) { done = true; cancelAnimationFrame(raf); resolve(false); } };
  });
}

/* ---------------- شاشة اللعب (ملء الشاشة) ---------------- */
/** يشغّل جولة ويعيد { ok, n, pct, extra } أو null إن خرج الطالب */
async function runRound(L, game, { name = '' } = {}) {
  const qs = await roundQs(L);
  if (!qs.length) return { empty: true };
  const dom = domainOf(L.d);
  const ov = document.createElement('div');
  ov.className = 'pg-ov'; ov.style.setProperty('--dc', dom?.color || '#0f766e');
  ov.innerHTML = `<div class="pg-top"><button type="button" class="pg-x" aria-label="خروج">✕</button>
      <div class="pg-hud"><span class="pg-a"></span><div class="pg-bar" aria-hidden="true"><i></i></div><span class="pg-b"></span></div>
      <button type="button" class="pg-snd" aria-label="الصوت">${muted ? '🔇' : '🔊'}</button></div>
    <div class="pg-stage"></div><div class="pg-qbox" hidden></div><div class="pg-conf" hidden></div>`;
  document.body.appendChild(ov); document.documentElement.classList.add('pg-lock');
  const stage = ov.querySelector('.pg-stage'), qbox = ov.querySelector('.pg-qbox');
  let stopped = false, mod = null;
  const close = () => { stopped = true; qbox._abort?.(); mod?.stop?.(); ov.remove(); document.documentElement.classList.remove('pg-lock'); };
  ov.querySelector('.pg-snd').onclick = (e) => { muted = !muted; try { localStorage.setItem('fp_pgMute', muted ? '1' : '0'); } catch {} e.currentTarget.textContent = muted ? '🔇' : '🔊'; };
  const exitAsk = () => new Promise((res) => {
    const c = ov.querySelector('.pg-conf'); c.hidden = false; mod?.pause?.(true);
    c.innerHTML = '<div class="pq-card"><p class="pq-q">تخرج من هذه الجولة؟ لن تُحسب نتيجتها.</p><div class="row" style="justify-content:center"><button type="button" class="btn danger" data-y>خروج</button><button type="button" class="btn primary" data-n>أكمل اللعب</button></div></div>';
    c.querySelector('[data-y]').onclick = () => res(true);
    c.querySelector('[data-n]').onclick = () => { c.hidden = true; mod?.pause?.(false); res(false); };
  });
  let resolveExit; const exited = new Promise((r) => (resolveExit = r));
  ov.querySelector('.pg-x').onclick = async () => { if (await exitAsk()) { close(); resolveExit(null); } };
  const hud = ({ a, b, p }) => { if (a != null) ov.querySelector('.pg-a').innerHTML = a; if (b != null) ov.querySelector('.pg-b').innerHTML = b; if (p != null) ov.querySelector('.pg-bar i').style.width = Math.max(0, Math.min(1, p)) * 100 + '%'; };
  let nOk = 0, asked = 0; const wrong = [];
  const ask = async (q) => { const i = asked++; const ok = await askQ(qbox, q, i, qs.length); if (ok) nOk++; else wrong.push(q); return ok; };
  try {
    stage.innerHTML = '<div class="loading" style="color:#fff">جارٍ تجهيز اللعبة…</div>';
    mod = await (game === 'runner' ? import('./runner.js') : import('./race.js'));
    stage.innerHTML = '';
    const played = mod.run(stage, { qs, ask, sfx, hud, color: dom?.color || '#0f766e', name, stopped: () => stopped });
    const extra = await Promise.race([played, exited]);
    if (extra === null || stopped) return null;
    // الأسئلة التي لم تُعرض (لو انتهت اللعبة قبلها) تُحسب خطأ
    for (let i = asked; i < qs.length; i++) wrong.push(qs[i]);
    const pct = (nOk / qs.length) * 100;
    return { ok: nOk, n: qs.length, pct, extra, wrong, ov, close };
  } catch (e) {
    console.warn('play', e); close();
    throw e;
  }
}

/** شاشة النتيجة داخل نافذة اللعب نفسها */
function showResult(R, { L, earned, newStars, capHit, game, onAgain, onMap, saveErr }) {
  const st = starsOf(R.pct);
  const msg = st === 3 ? 'إنجاز مذهل! أتقنت الدرس 🌟' : st === 2 ? 'أحسنت! اقتربت من الإتقان' : st === 1 ? 'بداية طيبة، أعد اللعب لتجمع نجوماً أكثر' : 'لا بأس، راجع الدرس ثم حاول مرة أخرى 💪';
  const ex = R.extra || {};
  const box = document.createElement('div'); box.className = 'pg-res';
  box.innerHTML = `<div class="pq-card pg-res-card">
      <div class="pg-res-ic">${st >= 2 ? '🏆' : st === 1 ? '🎖️' : '📘'}</div>
      <h2>${esc(L.t)}</h2>${starRow(st, true)}
      <p class="pg-res-m">${msg}</p>
      <div class="pg-res-k"><div><b>${ar(R.ok)}/${ar(R.n)}</b><span>إجابات صحيحة</span></div><div><b>${pctTxt(R.pct)}</b><span>النسبة</span></div>
        ${ex.pos ? `<div><b>${ex.pos === 1 ? '🥇' : ex.pos === 2 ? '🥈' : ex.pos === 3 ? '🥉' : ''} ${ar(ex.pos)}/${ar(ex.of || 4)}</b><span>مركزك في السباق</span></div>` : ''}
        ${ex.coins != null ? `<div><b>🪙 ${ar(ex.coins)}</b><span>جمعتها في الطريق</span></div>` : ''}</div>
      ${newStars > 0 ? `<p class="pg-res-new">⭐ نجوم جديدة: ${ar(newStars)}${earned > 0 ? ` · <b>+${ar(earned)} ${earned === 1 ? 'نقطة' : 'نقاط'} شرف</b>` : ''}</p>` : ''}
      ${capHit ? '<p class="small pg-res-cap">بلغت حدّ نقاط اللعب لهذا اليوم، والنجوم محفوظة لك.</p>' : ''}
      ${saveErr ? '<p class="small pg-res-cap">تعذّر حفظ النتيجة الآن. تأكد من الاتصال ثم العب مرة أخرى.</p>' : ''}
      ${R.wrong.length ? `<details class="pg-rev"><summary>راجع ما أخطأت فيه (${ar(R.wrong.length)})</summary><ul>${R.wrong.map((q) => `<li><span>${esc(q.q)}</span>${q.v ? `<div class="pq-qf">${esc(q.v)}</div>` : ''}<b class="${q.qf ? 'pq-qf' : ''}">${q.t === 'mcq' ? esc(q.a[0]) : q.t === 'tf' ? (q.a ? 'صواب' : 'خطأ') : q.t === 'ord' ? q.a.map(esc).join(' ← ') : q.a.map((p) => esc(p[0]) + ': ' + esc(p[1])).join(' · ')}</b></li>`).join('')}</ul></details>` : ''}
      <div class="row pg-res-b"><button type="button" class="btn primary" data-again>🔁 العب مرة أخرى</button><button type="button" class="btn" data-map>🗺️ الخريطة</button></div>
    </div>`;
  R.ov.querySelector('.pg-stage').appendChild(box);
  if (st >= 2) sfx.win();
  box.querySelector('[data-again]').onclick = () => { R.close(); onAgain(game); };
  box.querySelector('[data-map]').onclick = () => { R.close(); onMap(); };
}

/* ======================= واجهة الطالب ======================= */
export function mountPlayStudent(host, { me, toast = () => {}, confetti = () => {} }) {
  let cfg = null, over = null, state = null, alive = true, term = 's1';
  host.innerHTML = '<div class="loading">جارٍ تحميل الرحلة…</div>';
  const load = async () => {
    [cfg, over, state] = await Promise.all([playCfg(), store.getPlayQ().catch(() => null), store.getPlay(me.id).catch(() => null)]);
    state = state || { st: {} }; state.st = state.st || {};
    if (alive) draw();
  };
  load().catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });

  const recOf = (id) => state.st[id] || null;
  function lessonsState() {
    const Ls = lessonsWith(over);
    let prevOk = true;
    return Ls.map((L) => {
      const on = !!cfg.on?.[L.id], r = recOf(L.id);
      const open = on && prevOk;
      if (on) prevOk = (r?.s || 0) >= 1;
      return { L, on, open, r };
    });
  }
  function draw() {
    if (!alive) return;
    const LS = lessonsState();
    const totStars = LS.reduce((k, x) => k + (x.r?.s || 0), 0), maxStars = LS.filter((x) => x.on).length * 3;
    const tp = todayPts(me.id, state, cfg);
    const next = LS.find((x) => x.open && !(x.r?.s >= 1)) || LS.find((x) => x.open && (x.r?.s || 0) < 3);
    host.innerHTML = `<div class="pg">
      <div class="pg-terms" role="tablist"><button type="button" class="${term === 's1' ? 'on' : ''}" data-term="s1">📗 ${esc(TERM.t)}</button><button type="button" class="${term === 's2' ? 'on' : ''}" data-term="s2">📘 الفصل الثاني <small>قريباً</small></button></div>
      ${term === 's2' ? '<div class="card pg-soon"><div class="pg-soon-ic">🚧</div><h3>الفصل الثاني قادم قريباً</h3><p class="muted">سيُضاف منهج الفصل الثاني هنا بإذن الله. أكمل رحلة الفصل الأول واجمع نجومها الآن.</p></div>' : `
      <div class="pg-head card">
        <div class="pg-head-t"><b>🎮 العب وتعلّم</b><span class="small muted">${esc(TERM.book)}</span></div>
        <div class="pg-kpis"><div><b>⭐ ${ar(totStars)}${maxStars ? `<small>/${ar(maxStars)}</small>` : ''}</b><span>نجومك</span></div>
          <div><b>${ar(tp)}<small>/${ar(cfg.cap)}</small></b><span>نقاط اليوم</span></div></div>
        ${next ? `<button type="button" class="btn primary pg-cont" data-open="${next.L.id}">▶ ${next.r ? 'تابع' : 'ابدأ'}: ${esc(next.L.t)}</button>` : ''}
      </div>
      ${!LS.some((x) => x.on) ? '<div class="card pg-soon"><div class="pg-soon-ic">⏳</div><h3>لم يفتح معلمك أي درس بعد</h3><p class="muted">ستظهر هنا مراحل الرحلة حين يفعّلها معلمك.</p></div>' : ''}
      <div class="pg-map">
        ${DOMAINS.map((D) => { const items = LS.filter((x) => x.L.d === D.id); const sDom = items.reduce((k, x) => k + (x.r?.s || 0), 0);
          return `<section class="pg-st" style="--dc:${D.color}"><div class="pg-st-h"><span class="pg-st-ic">${D.ic}</span><div><b>${esc(D.t)}</b><small>${GAMES[D.game].ic} ${esc(GAMES[D.game].t)} · ⭐ ${ar(sDom)}/${ar(items.length * 3)}</small></div></div>
            <ol class="pg-path">${items.map((x) => { const s = x.r?.s || 0, n = LESSONS.findIndex((l) => l.id === x.L.id) + 1;
              return `<li class="pg-node${x.open ? ' open' : ''}${!x.on ? ' off' : ''}${s === 3 ? ' full' : ''}${next?.L.id === x.L.id ? ' next' : ''}">
                <button type="button" data-open="${x.L.id}" ${x.open ? '' : 'aria-disabled="true"'}><span class="pg-dot">${!x.on || !x.open ? '🔒' : s === 3 ? '👑' : ar(n)}</span>
                  <span class="pg-nt"><b>${esc(x.L.t)}</b>${x.on ? starRow(s) : '<small class="muted">لم يفتحه المعلم بعد</small>'}${x.on && !x.open ? '<small class="muted">أنهِ المرحلة السابقة بنجمة لتفتحه</small>' : ''}</span></button></li>`; }).join('')}</ol></section>`; }).join('')}
      </div>`}
    </div>`;
    host.querySelectorAll('[data-term]').forEach((b) => (b.onclick = () => { term = b.dataset.term; draw(); }));
    host.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => {
      const x = LS.find((y) => y.L.id === b.dataset.open); if (!x) return;
      if (!x.on) return toast('هذا الدرس لم يفتحه معلمك بعد.');
      if (!x.open) return toast('أنهِ المرحلة التي قبله بنجمة واحدة على الأقل لتفتحه.');
      openLesson(x);
    }));
  }
  function openLesson(x) {
    const { L, r } = x, def = gameOf(L);
    const sh = document.createElement('div'); sh.className = 'modal pg-sheet';
    sh.innerHTML = `<div class="modal-card pq-card" role="dialog" aria-label="${esc(L.t)}">
      <button type="button" class="btn sm modal-x" data-x aria-label="إغلاق">✕</button>
      <div class="pg-sh-ic" style="--dc:${domainOf(L.d)?.color}">${domainOf(L.d)?.ic}</div>
      <h2>${esc(L.t)}</h2><p class="small muted" style="margin:0">${esc(domainOf(L.d)?.t)} · صفحة ${ar(L.p)} في الكتاب</p>
      ${starRow(r?.s || 0, true)}
      ${r ? `<p class="small muted">أفضل نتيجة: ${pctTxt(r.b || 0)} · لعبتها ${ar(r.n || 0)} ${(r.n || 0) === 1 ? 'مرة' : 'مرات'}</p>` : '<p class="small muted">أجب عن الأسئلة لتتقدّم: كل إجابة صحيحة تدفعك للأمام، والخطأ يبطئك.</p>'}
      <p class="small pg-sh-rule">⭐ ٥٠٪ · ⭐⭐ ٧٥٪ · ⭐⭐⭐ ٩٠٪${cfg.pts > 0 ? ` — كل نجمة جديدة = ${ar(cfg.pts)} ${cfg.pts === 1 ? 'نقطة' : 'نقاط'} شرف` : ''}</p>
      <b class="small">اختر لعبتك:</b>
      <div class="pg-games">${Object.entries(GAMES).map(([k, g]) => `<button type="button" class="pg-game${k === def ? ' on' : ''}" data-g="${k}"><span>${g.ic}</span><b>${esc(g.t)}</b><small>${k === 'race' ? 'عند كل منعطف سؤال: الصحيح تسارع، والخطأ تباطؤ' : 'اقفز فوق العوائق، وأجب عند كل بوابة'}</small></button>`).join('')}</div>
      <button type="button" class="btn primary pg-start" data-go>▶ ابدأ</button>
    </div>`;
    document.body.appendChild(sh);
    let game = def;
    const shut = () => sh.remove();
    sh.onclick = (e) => { if (e.target === sh) shut(); };
    sh.querySelector('[data-x]').onclick = shut;
    sh.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { game = b.dataset.g; sh.querySelectorAll('[data-g]').forEach((y) => y.classList.toggle('on', y === b)); }));
    sh.querySelector('[data-go]').onclick = () => { sfx.unlock(); shut(); play(L, game); };
  }
  async function play(L, game) {
    let R;
    try { R = await runRound(L, game, { name: me.name }); } catch (e) { toast('تعذّر تشغيل اللعبة: ' + e.message); return; }
    if (!R) return draw();
    if (R.empty) { toast('لا توجد أسئلة في هذا الدرس بعد.'); return; }
    const old = recOf(L.id) || {}, st = starsOf(R.pct), nowIso = new Date().toISOString();
    const rec = { s: Math.max(old.s || 0, st), b: Math.max(old.b || 0, Math.round(R.pct)), n: (old.n || 0) + 1, at: nowIso, g: game };
    ['t1', 't2', 't3'].forEach((k, i) => { if (old[k]) rec[k] = old[k]; else if (st >= i + 1) rec[k] = nowIso; });
    if (old.w || R.extra?.pos) rec.w = Math.min(old.w || 9, R.extra?.pos || 9);
    const before = playTotal(me.id, state, cfg);
    const next = { ...state, st: { ...state.st, [L.id]: rec } };
    const after = playTotal(me.id, next, cfg);
    const newStars = rec.s - (old.s || 0);
    let saveErr = false;
    try { await store.savePlay(me.id, L.id, rec); state = next; } catch (e) { console.warn('savePlay', e); saveErr = true; }
    if (newStars > 0 && !saveErr) confetti();
    showResult(R, { L, game, earned: saveErr ? 0 : after - before, newStars: saveErr ? 0 : newStars, capHit: !saveErr && newStars > 0 && after - before < newStars * cfg.pts && cfg.pts > 0, saveErr,
      onAgain: (g) => play(L, g), onMap: () => draw() });
    draw();
  }
  return () => { alive = false; };
}

/* ======================= واجهة المعلم ======================= */
const TYPE_LABEL = { mcq: 'اختيار من متعدد', tf: 'صواب وخطأ', ord: 'ترتيب', mat: 'توصيل' };
export function mountPlayTeacher(host, { students, classes, toast = () => {}, onChange = () => {} }) {
  let cfg = null, over = {}, states = {}, alive = true, q = '', cls = 'all', editing = null;
  host.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const cname = (id) => classes.find((c) => c.id === id)?.name || '';
  const load = async () => {
    cfg = await playCfg();
    over = (await store.getPlayQ().catch(() => null)) || {};
    delete over.at;
    const pns = playPns(cfg, students);
    const S = await Promise.all(pns.map((p) => store.getPlay(p).catch(() => null)));
    states = Object.fromEntries(pns.map((p, i) => [p, S[i]]).filter(([, x]) => x));
    onChange({ cfg, states });
    if (alive) draw();
  };
  load().catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });
  const saveCfg = async (patch, msg = 'تم الحفظ.') => {
    const prev = cfg; cfg = { ...cfg, ...patch };
    cfg.ever = [...new Set([...(prev.ever || []), ...playStudents(prev, students).map((s) => s.id), ...playStudents(cfg, students).map((s) => s.id), ...Object.keys(states)])];
    try { await store.setPlayCfg(cfg); toast(msg); onChange({ cfg, states }); } catch (e) { cfg = prev; toast('تعذّر الحفظ: ' + e.message); }
    draw();
  };

  function draw() {
    if (!alive) return;
    if (editing) return drawEditor();
    const Ls = lessonsWith(over);
    const shown = students.filter((s) => (cls === 'all' || s.classId === cls) && (!q || s.name.includes(q)));
    const enabled = playStudents(cfg, students);
    const pnSet = new Set(cfg.pns || []), clSet = new Set(cfg.classes || []);
    const nOn = Ls.filter((L) => cfg.on?.[L.id]).length;
    const rows = enabled.map((s) => {
      const st = states[s.id]?.st || {}, R = Object.values(st);
      return { s, stars: R.reduce((k, r) => k + (r.s || 0), 0), done: R.filter((r) => r.s >= 1).length, plays: R.reduce((k, r) => k + (r.n || 0), 0), last: R.map((r) => r.at).sort().pop() || '', pts: playTotal(s.id, states[s.id], cfg) };
    }).sort((a, b) => b.stars - a.stars || b.plays - a.plays);
    host.innerHTML = `<div class="stack pgt">
      <div class="card stack">
        <div><h2>🎮 «العب وتعلّم» — ${esc(TERM.t)}</h2><p class="small muted" style="margin:4px 0 0">دروس المنهج (${esc(TERM.book)}) على شكل ألعاب: سباق سيارات يظهر فيه سؤال عند كل منعطف، وعدّاء يجيب عند كل بوابة. لكل درس ٣ نجوم حسب نسبة الإجابات (٥٠٪ / ٧٥٪ / ٩٠٪).</p></div>
        <b class="small">من يرى التبويب؟</b>
        <div class="pg-modes">${[['none', 'لا أحد'], ['pns', 'طلاب أختارهم (تجربة)'], ['classes', 'صفوف كاملة'], ['all', 'جميع الطلاب']].map(([k, l]) => `<label class="pg-mode${cfg.mode === k ? ' on' : ''}"><input type="radio" name="pgMode" value="${k}" ${cfg.mode === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        ${cfg.mode === 'classes' ? `<div class="pg-cls">${classes.map((c) => `<label class="chip-check"><input type="checkbox" data-cl="${esc(c.id)}" ${clSet.has(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>` : ''}
        ${cfg.mode === 'pns' ? `<div class="row"><select id="pgCls" aria-label="الصف"><option value="all">كل الصفوف</option>${classes.map((c) => `<option value="${esc(c.id)}" ${cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <input type="search" id="pgQ" placeholder="ابحث باسم الطالب" value="${esc(q)}" style="flex:1;min-width:140px"><span class="small muted">المختارون: ${ar(pnSet.size)}</span></div>
          <div class="pg-pick">${shown.map((s) => `<label class="chip-check${pnSet.has(s.id) ? ' on' : ''}"><input type="checkbox" data-pn="${esc(s.id)}" ${pnSet.has(s.id) ? 'checked' : ''}> ${esc(s.name)} <small class="muted">${esc(cname(s.classId))}</small></label>`).join('') || '<span class="small muted">لا طلاب.</span>'}</div>
          <div class="row"><button type="button" class="btn sm" id="pgAllShown">اختر الظاهرين</button><button type="button" class="btn sm ghost" id="pgNoneShown">ألغِ الظاهرين</button></div>` : ''}
        <div class="row">
          <label class="field" style="min-width:150px">نقاط كل نجمة جديدة<input type="number" id="pgPts" min="0" max="5" value="${cfg.pts}"></label>
          <label class="field" style="min-width:170px">حدّ نقاط اللعب في اليوم<input type="number" id="pgCap" min="0" max="50" value="${cfg.cap}"></label>
          <button type="button" class="btn primary" id="pgSave" style="align-self:end">حفظ النقاط</button>
        </div>
        <p class="small muted" style="margin:0">أقصى ما يجمعه الطالب: ${ar(LESSONS.length * 3)} نجمة. الحد اليومي يمنع جمع كل النقاط في يوم واحد، والنجوم الزائدة تبقى محفوظة بلا نقاط. (٠ في الحد = بلا حد)</p>
      </div>

      <div class="card stack">
        <div class="row" style="justify-content:space-between"><h3>📚 الدروس (${ar(nOn)}/${ar(Ls.length)} مفعّل)</h3><div class="row"><button type="button" class="btn sm" id="pgOnAll">فعّل الكل</button><button type="button" class="btn sm ghost" id="pgOffAll">أوقف الكل</button></div></div>
        <p class="small muted" style="margin:0">الطالب يتقدّم بالترتيب: لا يُفتح الدرس حتى يأخذ نجمة في الدرس المفعّل الذي قبله. راجع الأسئلة وجرّب اللعبة بنفسك قبل التفعيل.</p>
        ${DOMAINS.map((D) => `<div class="pgt-dom" style="--dc:${D.color}"><b>${D.ic} ${esc(D.t)}</b> <span class="small muted">${GAMES[D.game].ic} ${esc(GAMES[D.game].t)}</span>
          <ul>${Ls.filter((L) => L.d === D.id).map((L) => { const n = L.qs.length + (L.ayat?.n ? L.ayat.n : 0);
            return `<li><label class="switch"><input type="checkbox" data-on="${L.id}" ${cfg.on?.[L.id] ? 'checked' : ''}><span></span></label>
              <span class="pgt-lt"><b>${esc(L.t)}</b><small class="muted">ص ${ar(L.p)} · ${ar(L.qs.length)} سؤالاً${L.ayat?.n ? ` + ${ar(L.ayat.n)} من المصحف` : ''}${L.edited ? ' · <span class="pill warn">معدّل</span>' : ''}</small></span>
              <button type="button" class="btn sm" data-edit="${L.id}">📝 الأسئلة</button><button type="button" class="btn sm ghost" data-try="${L.id}" title="جرّب اللعبة (لا تُحفظ)">▶ جرّب</button></li>`; }).join('')}</ul></div>`).join('')}
      </div>

      <div class="card stack">
        <h3>👥 تقدّم الطلاب (${ar(enabled.length)})</h3>
        ${rows.length ? `<div class="table-wrap"><table class="pgt-table"><thead><tr><th>الطالب</th><th>⭐ النجوم</th><th>دروس منجزة</th><th>مرات اللعب</th><th>نقاط الشرف</th><th>آخر لعب</th></tr></thead><tbody>
          ${rows.map((x) => `<tr><td>${esc(x.s.name)}<div class="small muted">${esc(cname(x.s.classId))}</div></td><td><b>${ar(x.stars)}</b></td><td>${ar(x.done)}</td><td>${ar(x.plays)}</td><td>${ar(x.pts)}</td><td class="small">${x.last ? esc(rday(new Date(x.last))) : '<span class="muted">لم يلعب</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted" style="margin:0">لا طلاب مفعّلون بعد.</p>'}
      </div>
    </div>`;
    host.querySelectorAll('[name=pgMode]').forEach((r) => (r.onchange = () => saveCfg({ mode: r.value }, r.value === 'none' ? 'أُخفي التبويب عن الجميع.' : 'تم الحفظ.')));
    host.querySelectorAll('[data-cl]').forEach((c) => (c.onchange = () => { const S = new Set(cfg.classes || []); c.checked ? S.add(c.dataset.cl) : S.delete(c.dataset.cl); saveCfg({ classes: [...S] }); }));
    host.querySelectorAll('[data-pn]').forEach((c) => (c.onchange = () => { const S = new Set(cfg.pns || []); c.checked ? S.add(c.dataset.pn) : S.delete(c.dataset.pn); saveCfg({ pns: [...S] }); }));
    const sel = host.querySelector('#pgCls'); if (sel) sel.onchange = () => { cls = sel.value; draw(); };
    const qi = host.querySelector('#pgQ'); if (qi) qi.oninput = () => { q = qi.value.trim(); const pos = qi.selectionStart; draw(); const n = host.querySelector('#pgQ'); n.focus(); n.setSelectionRange(pos, pos); };
    const allS = host.querySelector('#pgAllShown'); if (allS) allS.onclick = () => saveCfg({ pns: [...new Set([...(cfg.pns || []), ...shown.map((s) => s.id)])] });
    const noS = host.querySelector('#pgNoneShown'); if (noS) noS.onclick = () => { const H = new Set(shown.map((s) => s.id)); saveCfg({ pns: (cfg.pns || []).filter((p) => !H.has(p)) }); };
    host.querySelector('#pgSave').onclick = () => {
      const pts = Math.max(0, Math.min(5, Math.round(+host.querySelector('#pgPts').value || 0))), cap = Math.max(0, Math.min(50, Math.round(+host.querySelector('#pgCap').value || 0)));
      saveCfg({ pts, cap });
    };
    host.querySelectorAll('[data-on]').forEach((c) => (c.onchange = () => saveCfg({ on: { ...(cfg.on || {}), [c.dataset.on]: c.checked } }, c.checked ? 'فُعّل الدرس.' : 'أُوقف الدرس.')));
    host.querySelector('#pgOnAll').onclick = () => saveCfg({ on: Object.fromEntries(LESSONS.map((L) => [L.id, true])) }, 'فُعّلت كل الدروس.');
    host.querySelector('#pgOffAll').onclick = () => saveCfg({ on: {} }, 'أُوقفت كل الدروس.');
    host.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { editing = { id: b.dataset.edit, qs: JSON.parse(JSON.stringify(lessonsWith(over).find((L) => L.id === b.dataset.edit).qs)), n: lessonsWith(over).find((L) => L.id === b.dataset.edit).ayat?.n ?? null, open: -1 }; draw(); host.scrollIntoView({ block: 'start' }); }));
    host.querySelectorAll('[data-try]').forEach((b) => (b.onclick = async () => { const L = lessonsWith(over).find((x) => x.id === b.dataset.try); try { const R = await runRound(L, gameOf(L), { name: 'المعلم' }); if (R && !R.empty) showResult(R, { L, game: gameOf(L), earned: 0, newStars: 0, onAgain: () => b.click(), onMap: () => {} }); } catch (e) { toast('تعذّر التشغيل: ' + e.message); } }));
  }

  /* ---- محرر أسئلة درس ---- */
  function drawEditor() {
    const L = LESSONS.find((x) => x.id === editing.id), E = editing;
    const ans = (x) => x.t === 'mcq' ? `<b>✔ ${esc(x.a[0])}</b> <span class="muted">✘ ${x.a.slice(1).map(esc).join(' · ')}</span>` : x.t === 'tf' ? `<b>${x.a ? '✔ صواب' : '✘ خطأ'}</b>` : x.t === 'ord' ? x.a.map(esc).join(' ← ') : x.a.map((p) => `${esc(p[0])} = ${esc(p[1])}`).join(' · ');
    host.innerHTML = `<div class="stack pgt">
      <div class="card stack">
        <div class="row" style="justify-content:space-between"><h2>📝 أسئلة «${esc(L.t)}»</h2><button type="button" class="btn" id="edBack">رجوع</button></div>
        <p class="small muted" style="margin:0">في كل جولة تُختار ١٠ أسئلة عشوائياً من هذا البنك. التعديل يصل للطلاب بعد «حفظ».</p>
        ${L.ayat ? `<label class="field" style="max-width:340px">أسئلة تُولَّد من نص المصحف (الآيات ${ar(L.ayat.from)}–${ar(L.ayat.to)})<input type="number" id="edN" min="0" max="10" value="${E.n ?? L.ayat.n}"><small class="muted">أكمل الآية، الكلمة الناقصة، الآية التالية، رتّب الآيات — نصها من المصحف نفسه.</small></label>` : ''}
        <ol class="pgt-qs">${E.qs.map((x, i) => `<li class="${E.open === i ? 'open' : ''}">${E.open === i ? qForm(x, i) : `<div class="pgt-q"><span class="pill mute">${TYPE_LABEL[x.t]}</span> <b>${esc(x.q)}</b><div class="small">${ans(x)}</div></div>
          <div class="row"><button type="button" class="btn sm" data-qe="${i}">تعديل</button><button type="button" class="btn sm ghost danger" data-qd="${i}">حذف</button></div>`}</li>`).join('')}</ol>
        <div class="row"><span class="small">أضف سؤالاً:</span>${Object.entries(TYPE_LABEL).map(([k, l]) => `<button type="button" class="btn sm" data-qa="${k}">＋ ${l}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn primary" id="edSave">💾 حفظ الأسئلة</button>${over[L.id] ? '<button type="button" class="btn ghost" id="edReset">↺ أعد الأسئلة الأصلية</button>' : ''}</div>
      </div></div>`;
    host.querySelector('#edBack').onclick = () => { editing = null; draw(); };
    host.querySelectorAll('[data-qe]').forEach((b) => (b.onclick = () => { E.open = +b.dataset.qe; draw(); }));
    host.querySelectorAll('[data-qd]').forEach((b) => (b.onclick = () => { E.qs.splice(+b.dataset.qd, 1); E.open = -1; draw(); }));
    host.querySelectorAll('[data-qa]').forEach((b) => (b.onclick = () => { const t = b.dataset.qa; E.qs.push(t === 'mcq' ? { t, q: '', a: ['', '', '', ''] } : t === 'tf' ? { t, q: '', a: true } : t === 'ord' ? { t, q: 'رتّب ما يأتي:', a: ['', '', ''] } : { t, q: 'صِل الكلمة بمعناها:', a: [['', ''], ['', ''], ['', '']] }); E.open = E.qs.length - 1; draw(); }));
    const f = host.querySelector('.pgt-form');
    if (f) {
      f.querySelector('[data-fc]').onclick = () => { if (E.qs[E.open] && !E.qs[E.open].q) E.qs.splice(E.open, 1); E.open = -1; draw(); };
      f.onsubmit = (e) => {
        e.preventDefault();
        const x = E.qs[E.open], g = (n) => f.querySelector(`[name=${n}]`)?.value.trim() || '';
        const lines = (n) => g(n).split('\n').map((s) => s.trim()).filter(Boolean);
        const nx = { t: x.t, q: g('q') };
        if (g('x')) nx.x = g('x');
        if (x.t === 'mcq') { nx.a = [g('c'), ...lines('w')].filter(Boolean); if (nx.a.length < 2 || !g('c')) return toast('اكتب الإجابة الصحيحة وخياراً خاطئاً واحداً على الأقل.'); }
        if (x.t === 'tf') nx.a = g('tf') === '1';
        if (x.t === 'ord') { nx.a = lines('items'); if (nx.a.length < 2) return toast('اكتب عنصرين على الأقل، كل عنصر في سطر.'); }
        if (x.t === 'mat') { nx.a = lines('pairs').map((s) => s.split('=').map((y) => y.trim())).filter((p) => p.length >= 2 && p[0] && p[1]).map((p) => [p[0], p.slice(1).join('=')]); if (nx.a.length < 2) return toast('اكتب زوجين على الأقل بصيغة: الكلمة = معناها'); }
        if (!nx.q) return toast('اكتب نص السؤال.');
        E.qs[E.open] = nx; E.open = -1; draw();
      };
    }
    host.querySelector('#edSave').onclick = async () => {
      const n = host.querySelector('#edN') ? Math.max(0, Math.min(10, Math.round(+host.querySelector('#edN').value || 0))) : null;
      if (!E.qs.length && !n) return toast('أضف سؤالاً واحداً على الأقل.');
      const next = { ...over, [L.id]: { qs: E.qs, ...(n != null ? { n } : {}) } };
      try { await store.setPlayQ(next); over = next; toast('حُفظت الأسئلة.'); editing = null; draw(); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
    };
    const rs = host.querySelector('#edReset');
    if (rs) rs.onclick = async () => { const next = { ...over }; delete next[L.id]; try { await store.setPlayQ(next); over = next; toast('أُعيدت الأسئلة الأصلية.'); editing = null; draw(); } catch (e) { toast('تعذّر الحفظ: ' + e.message); } };
  }
  function qForm(x) {
    const ta = (n, v, rows = 3, ph = '') => `<textarea name="${n}" rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
    return `<form class="pgt-form stack"><span class="pill mute">${TYPE_LABEL[x.t]}</span>
      <label class="field">${x.t === 'tf' ? 'العبارة' : 'نص السؤال'}<input name="q" value="${esc(x.q)}" required></label>
      ${x.t === 'mcq' ? `<label class="field">الإجابة الصحيحة<input name="c" value="${esc(x.a[0] || '')}" required></label><label class="field">الخيارات الخاطئة (كل خيار في سطر)${ta('w', x.a.slice(1).join('\n'), 3)}</label>` : ''}
      ${x.t === 'tf' ? `<label class="field">الحكم<select name="tf"><option value="1" ${x.a ? 'selected' : ''}>صواب</option><option value="0" ${x.a ? '' : 'selected'}>خطأ</option></select></label>` : ''}
      ${x.t === 'ord' ? `<label class="field">العناصر بترتيبها الصحيح (كل عنصر في سطر)${ta('items', x.a.join('\n'), 4)}</label>` : ''}
      ${x.t === 'mat' ? `<label class="field">الأزواج (كل زوج في سطر: الكلمة = معناها)${ta('pairs', x.a.map((p) => p.join(' = ')).join('\n'), 4, 'السكينة = الطمأنينة')}</label>` : ''}
      <label class="field">شرح يظهر عند الخطأ (اختياري)<input name="x" value="${esc(x.x || '')}"></label>
      <div class="row"><button type="submit" class="btn primary sm">تم</button><button type="button" class="btn sm" data-fc>إلغاء</button></div></form>`;
  }
  return () => { alive = false; };
}
