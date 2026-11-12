// تبويب «اقرأ وارتقِ»: تدريب الطلاب المحتاجين لعناية مكثفة على نطق الحروف والكلمات.
// اختبار تكيّفي لتحديد المستوى، ثم درس يومي يُختبر فيه الطالب بنطق كل كلمة تظهر أمامه،
// وتمرين حر على أي درس. التحقق: التعرف الفوري للكلمات، وخادم التجويد للحروف والحركات،
// وما لم يتأكد منه النظام يصل إلى المعلم ليسمعه ويحكم عليه.
import { store, blobToB64, b64ToBlob } from './store.js';
import { toArabicDigits as ar } from './quran.js';
import { RecitationSession, hasRecorder, micErrorText } from './speech.js';
import { aiEnabled, phonemes, ttsGen, warm } from './tajweed-ai.js';
import { judgePhonemes, judgeTranscript } from './phon.js';
import { LESSONS, CONCEPTS, itemOf, lessonByN } from './iqra-data.js';
import { audioIndex, playItem, playSeq, stopAudio, sourcesFor, keyOf, hasRec, KIND_LABEL, prefetch, probeReciter, setGen, srcFor, GEN_VOICES, genOn, playGenSample, normText, recordingPlan, recordClip, saveRecording, deleteRecording, playBlob, toWav } from './iqra-audio.js';
import { tajSteps } from './iqra-taj.js';

export const IQ_DEFAULT = { count: 15, pass: 85, pts: 3, taj: 13, dayPts: 1, echo: true, color: true, ease: true, big: false };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت مكة
const ready = () => LESSONS.filter((l) => l.items.length);
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const pctTxt = (p) => ar(Math.round(p)) + '٪';
const addDays = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const ikey = (n, i) => n + ':' + i;
const SRS_GAP = [1, 3, 7]; // المراجعة المتباعدة: بعد يوم، ثم ٣ أيام، ثم أسبوع
const EASE = [1, 0.7, 0.5]; // التخفيف التلقائي لعدد الكلمات
const PRAISE = ['أَحْسَنْتَ', 'مُمْتَازٌ', 'بَارَكَ اللّٰهُ فِيكَ'];
const streakTxt = (n) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان متتاليان' : n <= 10 ? ar(n) + ' أيام متتالية' : ar(n) + ' يوماً متتالياً');

/** إعدادات الطالب الفعلية: العامة، ثم ما خصّه به المعلم */
export function effCfg(cfg, pn) {
  const p = cfg?.per?.[pn] || {};
  return { ...IQ_DEFAULT, ...cfg, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null)) };
}

/* ---------- تلوين الحركات: لكل حرف لون حركته (فتحة/كسرة/ضمة/سكون) ---------- */
const MARKS = /[\u064B-\u0670\u0610-\u061A\u06D6-\u06ED]/;
const NOJOIN = new Set([...'اأإآٱدذرزوؤةء']);
const vcls = (m) => (/[\u064B\u064E]/.test(m) ? 'vf' : /[\u064D\u0650]/.test(m) ? 'vk' : /[\u064C\u064F]/.test(m) ? 'vd' : /\u0652/.test(m) ? 'vs' : '');
export function colorize(text) {
  const Z = '\u200d';
  return String(text).split(' ').map((w) => {
    const U = [];
    for (const ch of w) { if (ch === 'ـ') continue; if (MARKS.test(ch) && U.length) U[U.length - 1].m += ch; else U.push({ c: ch, m: '' }); }
    return U.map((u, i) => {
      const joinPrev = i > 0 && !NOJOIN.has(U[i - 1].c) && u.c !== 'ء';
      const joinNext = i < U.length - 1 && !NOJOIN.has(u.c) && U[i + 1].c !== 'ء';
      const t = (joinPrev ? Z : '') + esc(u.c + u.m) + (joinNext ? Z : '');
      const c = vcls(u.m);
      return c ? `<span class="${c}">${t}</span>` : t;
    }).join('');
  }).join(' ');
}
const LEGEND = '<div class="iq-legend small"><span class="vf">فتحة</span><span class="vk">كسرة</span><span class="vd">ضمة</span><span class="vs">سكون</span></div>';

/* ---------- لعبة تمييز الحروف المتشابهة ---------- */
const PAIRS = [['ح', 'ه', 'خ'], ['س', 'ص', 'ث'], ['د', 'ض'], ['ت', 'ط'], ['ذ', 'ز', 'ظ'], ['ء', 'ع'], ['ك', 'ق'], ['غ', 'خ'], ['ح', 'ع']];
const HR = ['\u064E', '\u0650', '\u064F'];
const sylOf = (c, h) => (c === 'ء' ? (h === '\u0650' ? 'إ' : 'أ') : c) + h;
export const GAME_TEXTS = () => PAIRS.flat().flatMap((c) => HR.map((h) => sylOf(c, h)));
/** الحروف التي يخلط فيها الطالب: [{c, n, ok, as: أكثر ما يظنه بدلاً منه}] */
export function confusions(st) {
  return Object.entries(st?.conf || {}).filter(([, x]) => x.n >= 3 && x.ok / x.n < 0.75)
    .map(([c, x]) => ({ c, n: x.n, ok: x.ok, as: Object.entries(x.as || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '' }))
    .sort((a, b) => a.ok / a.n - b.ok / b.n);
}

export async function iqraCfg() {
  let c = null;
  try { c = await store.getIqraCfg(); } catch {}
  return { ...IQ_DEFAULT, pns: [], ...(c || {}) };
}

/** نقاط لوحة الشرف: لكل درس أتقنه الطالب في الدرس اليومي (لا في اختبار المستوى) */
// وللمواظبة: نقاط لكل يوم تدرّب فيه
export function iqraBonus(states, pts = IQ_DEFAULT.pts, dayPts = IQ_DEFAULT.dayPts) {
  const out = [];
  Object.entries(states || {}).forEach(([pn, st]) => {
    Object.values(st?.mastered || {}).forEach((m) => { if (m && !m.skip && m.at) out.push({ pn, bonus: pts, createdAt: m.at }); });
    if (dayPts > 0) (st?.days || []).forEach((d) => out.push({ pn, bonus: dayPts, createdAt: d + 'T12:00:00.000Z' }));
  });
  return out;
}

/* ---------- تسجيل كلمة واحدة: يتوقف وحده بعد سكوت الطالب ---------- */
function recordOnce({ onLevel, onLive, expect, quiet = 1100 }) {
  const s = new RecitationSession({ maxSeconds: 9, onLevel: (l) => tick(l), onTranscript: (t) => { onLive?.(t); if (expect && expect(t)) setTimeout(stop, 250); } });
  let voiced = false, lastLoud = 0, loudSince = 0, t0 = Date.now(), stopped = false, resolve;
  const done = new Promise((r) => (resolve = r));
  const empty = { blob: null, transcript: '' };
  // لا يعلق أبداً: إن لم ينتهِ الإيقاف خلال ٣ ثوانٍ يُلغى التسجيل ويُفتح الطريق للمحاولة التالية
  const stop = async () => { if (stopped) return; stopped = true; const t = setTimeout(() => { try { s.cancel(); } catch {} resolve(empty); }, 3000); try { resolve(await s.stop()); } catch { resolve(empty); } clearTimeout(t); };
  const cap = setTimeout(stop, 12000);
  done.then(() => clearTimeout(cap));
  function tick(l) {
    onLevel?.(l);
    const now = Date.now();
    // أول ٤٠٠ م.ث يُتجاهل (طقطقة فتح الميكروفون وبقايا الصوت المشغَّل)، ولا يُعدّ كلاماً إلا صوت متصل ١٢٠ م.ث
    if (now - t0 > 400 && l > 0.14) { if (!loudSince) loudSince = now; if (now - loudSince >= 120) voiced = true; lastLoud = now; }
    else if (l <= 0.14) loudSince = 0;
    if (voiced && now - lastLoud > quiet) stop();
    if (!voiced && now - t0 > 7000) stop();
  }
  s.onAutoStop = () => { stopped = true; (s._done || Promise.resolve(empty)).then(resolve, () => resolve(empty)); };
  return { start: () => s.start(), stop, done, cancel: () => { stopped = true; try { s.cancel(); } catch {} resolve(empty); }, get stopped() { return stopped; } };
}
/** مدة السكوت التي تُنهي التسجيل: أقصر للمقاطع، وأطول للعبارات حتى لا يُقطع الطالب وهو يتنفس */
const quietFor = (it) => (/\s/.test(it.s) ? 1200 : it.k === 'name' ? 1000 : it.k === 'word' ? 900 : 800);

/** الحكم الفوري في المتصفح: الكلمات وأسماء الحروف التي تعرّف عليها المتصفح */
const judgeASR = (item, rec) => (item.k === 'word' || item.k === 'name') && judgeTranscript(item.s, rec.transcript, { names: item.k === 'name' }).ok;
/** حكم خادم التجويد (الحروف والحركات): يُرسَل الصوت ١٦ك أحادياً مقصوص الصمت. يعيد {ok|empty|unsure} */
async function judgeAI(item, rec) {
  if (!rec.blob || rec.blob.size < 1500) return { ok: false, empty: true };
  if (!aiEnabled()) return { ok: false, unsure: true };
  let blob = rec.blob;
  try { blob = await toWav(rec.blob); } catch (e) { if (/لم يُسمع/.test(e.message || '')) return { ok: false, empty: true }; }
  try {
    const pred = await Promise.race([phonemes(blob), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))]);
    if (!pred) return { ok: false, empty: true };
    const j = judgePhonemes(item.s, pred, { strict: item.k === 'syl' });
    return { ok: j.ok, via: 'ai', score: j.score, got: j.got, ref: j.ref };
  } catch (e) { console.warn('iqra ai', e); return { ok: false, unsure: true }; }
}

/* ---------- اختيار عناصر الاختبار ---------- */
function pickDaily(lesson, n, wrongIdx = []) {
  const all = lesson.items.map((x, i) => ({ ...itemOf(x, lesson.n), i }));
  const again = all.filter((x) => wrongIdx.includes(x.i)).slice(0, Math.ceil(n / 2));
  const rest = shuffle(all.filter((x) => !wrongIdx.includes(x.i)));
  const syl = rest.filter((x) => x.k !== 'word'), word = rest.filter((x) => x.k === 'word');
  const out = again.slice();
  // نصف من جدول الحروف ونصف من الكلمات حين يوجد الاثنان
  while (out.length < Math.min(n, all.length) && (syl.length || word.length)) {
    const takeSyl = word.length === 0 || (syl.length && out.filter((x) => x.k !== 'word').length <= out.filter((x) => x.k === 'word').length);
    out.push(takeSyl ? syl.shift() : word.shift());
  }
  return shuffle(out);
}
function pickPlacement(concept) {
  const Ls = ready().filter((l) => l.c === concept);
  const out = [];
  Ls.forEach((l, k) => {
    const all = l.items.map((x, i) => ({ ...itemOf(x, l.n), i, n: l.n }));
    const syl = shuffle(all.filter((x) => x.k !== 'word')), word = shuffle(all.filter((x) => x.k === 'word'));
    out.push(...(k % 2 ? [word[0] || syl[0]] : [syl[0] || word[0]]).filter(Boolean));
  });
  // ثلاثة على الأقل من كل مفهوم
  const extra = shuffle(Ls.flatMap((l) => l.items.map((x, i) => ({ ...itemOf(x, l.n), i, n: l.n })))).filter((x) => !out.some((o) => o.n === x.n && o.i === x.i));
  while (out.length < 3 && extra.length) out.push(extra.shift());
  return out.slice(0, 4);
}

/* =====================================================================
   واجهة الطالب
   ===================================================================== */
export function mountIqraStudent(host, { me, toast = () => {}, confetti = () => {} }) {
  let st = null, cfg = null, E = null, alive = true, runner = null;
  host.innerHTML = '<div class="loading">جارٍ تحميل دروسك…</div>';
  const save = (patch) => { Object.assign(st, patch); return store.saveIqra(me.id, patch).catch((e) => { console.warn('iqra save', e); toast('تعذّر حفظ تقدمك. تحقق من الاتصال.'); }); };

  (async () => {
    probeReciter();
    [cfg, st] = await Promise.all([iqraCfg(), store.getIqra(me.id).catch(() => null), audioIndex()]);
    E = effCfg(cfg, me.id);
    warm(); // يوقظ خادم التصحيح الآن، قبل أول كلمة
    setGen({ on: !!cfg.genOn, voice: cfg.genVoice || 'ar-XA-Wavenet-B', rate: cfg.genRate || 0.8 });
    st = st || { placed: false, cur: 1, mastered: {}, wrong: {}, sessions: [] };
    st.mastered = st.mastered || {}; st.wrong = st.wrong || {}; st.sessions = st.sessions || [];
    st.lv = st.lv || {}; st.srs = st.srs || {}; st.conf = st.conf || {}; st.days = st.days || []; st.stars = st.stars || 0;
    await settleAwaiting();
    if (alive) home();
  })().catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });

  /* --- النجوم والمواظبة والمراجعة المتباعدة --- */
  function touchDay() {
    const d = today();
    if (st.days[st.days.length - 1] === d) return;
    const s = st.streak || {};
    st.streak = { day: d, n: s.day === addDays(d, -1) ? (s.n || 0) + 1 : 1 };
    st.days = [...st.days, d].slice(-400);
  }
  const streakN = () => (st.streak && (st.streak.day === today() || st.streak.day === addDays(today(), -1)) ? st.streak.n : 0);
  const dueList = () => Object.values(st.srs).filter((x) => x.due <= today()).sort((a, b) => a.due.localeCompare(b.due));
  const srsItem = (x) => { const L = lessonByN(x.n); const raw = L?.items[x.i]; return raw ? { ...itemOf(raw, x.n), i: x.i, n: x.n, rev: true } : null; };
  function srsHit(it, ok) {
    const k = ikey(it.n, it.i), x = st.srs[k];
    if (ok) {
      if (!x || x.due > today()) return;
      x.b = (x.b || 0) + 1;
      if (x.b >= SRS_GAP.length) delete st.srs[k]; else x.due = addDays(today(), SRS_GAP[x.b]);
    } else {
      st.srs[k] = { n: it.n, i: it.i, b: 0, due: addDays(today(), 1) };
      const all = Object.entries(st.srs);
      if (all.length > 150) all.sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, all.length - 150).forEach(([kk]) => delete st.srs[kk]);
    }
  }
  const persist = () => save({ lv: st.lv, srs: st.srs, stars: st.stars, streak: st.streak || null, days: st.days, conf: st.conf });

  /** الجلسات التي تنتظر حكم المعلم: إن حكم على كل كلماتها تُحسم النتيجة */
  async function settleAwaiting() {
    const aw = st.sessions.filter((s) => s.status === 'await');
    if (!aw.length) return;
    let revs = [];
    try { revs = await store.listIqraRev(me.id); } catch { return; }
    let changed = false;
    for (const s of aw) {
      const R = revs.filter((r) => r.sid === s.id);
      if (R.some((r) => r.status === 'pending')) continue;
      const okT = R.filter((r) => r.status === 'ok').length;
      const ok = s.ok + okT, pct = Math.round((ok / s.total) * 100);
      s.okT = okT; s.pct = pct; s.status = pct >= (s.pass || E.pass) ? 'pass' : 'fail';
      const redo = R.filter((r) => r.status !== 'ok').map((r) => r.i);
      applyResult(s, [...(s.wrongIdx || []), ...redo]);
      changed = true;
      s.toldStudent = false;
    }
    if (changed) await save({ sessions: st.sessions, mastered: st.mastered, wrong: st.wrong, cur: st.cur, ease: st.ease || 0, alert: st.alert || null, srs: st.srs });
  }
  function applyResult(s, wrongIdx) {
    if (s.status === 'pass') {
      st.mastered[s.n] = { pct: s.pct, at: new Date().toISOString(), day: s.day };
      delete st.wrong[s.n];
      if (st.cur === s.n) st.cur = nextLesson(s.n);
    } else if (s.status === 'fail') st.wrong[s.n] = [...new Set(wrongIdx)].slice(0, 30);
    autoEase(s);
  }
  const nextLesson = (n) => (LESSONS.find((l) => l.n > n) || { n: n + 1 }).n;

  /* --- التخفيف التلقائي: يومان متتاليان متعثران ← كلمات أقل ومراجعة من الدرس السابق، ويُنبَّه المعلم --- */
  function autoEase(s) {
    if (E.ease === false) return;
    if (s.status === 'pass') { if (st.ease) { st.ease = Math.max(0, st.ease - 1); if (!st.ease) st.alert = null; } return; }
    const D = st.sessions.filter((x) => x.kind === 'daily' && x.status && x.status !== 'await' && x.id !== s.id).concat(s);
    const byDay = {}; D.forEach((x) => (byDay[x.day] = x));
    const days = Object.keys(byDay).sort().slice(-2);
    if (days.length < 2 || days[1] !== s.day || days[0] !== addDays(s.day, -1)) return;
    if (!days.every((d) => byDay[d].status === 'fail' && byDay[d].pct < 60)) return;
    if (st.easeDay === s.day) return;
    st.easeDay = s.day;
    st.ease = Math.min(EASE.length - 1, (st.ease || 0) + 1);
    const prev = [...ready()].reverse().find((l) => l.n < s.n);
    if (prev) shuffle(prev.items.map((_, i) => i)).slice(0, 3).forEach((i) => { st.srs[ikey(prev.n, i)] = { n: prev.n, i, b: 0, due: today() }; });
    st.alert = { at: new Date().toISOString(), n: s.n, msg: `تعثّر يومين متتاليين في الدرس ${ar(s.n)}؛ فخُفِّف عدد كلماته${prev ? ` وأُضيفت مراجعة من الدرس ${ar(prev.n)}` : ''}.` };
  }
  const dailyCount = () => Math.max(3, Math.round(E.count * EASE[E.ease === false ? 0 : st.ease || 0]));

  function home() {
    if (!alive) return;
    runner?.cancel?.(); runner = null;
    if (!st.placed) return placementIntro();
    const L = lessonByN(st.cur);
    const day = today();
    const todays = st.sessions.filter((s) => s.day === day && s.kind === 'daily');
    const lastToday = todays[todays.length - 1];
    const doneN = Object.values(st.mastered).filter((m) => !m.skip).length;
    const total = LESSONS.length;
    const fresh = st.sessions.filter((s) => s.status !== 'await' && s.toldStudent === false);
    const due = dueList().length, cnt = Math.min(dailyCount(), L?.items.length || 0), sk = streakN();
    host.innerHTML = `<div class="iq stack${E.big ? ' iq-bigtxt' : ''}">
      <div class="iq-stats"><span>⭐ <b>${ar(st.stars)}</b> نجمة</span><span>🔥 <b>${sk ? streakTxt(sk) : 'ابدأ اليوم'}</b></span>${due ? `<span>🔁 <b>${ar(due)}</b> للمراجعة</span>` : ''}</div>
      ${st.note && !st.note.heard ? `<div class="card iq-noteT"><span>📩 رسالة صوتية من معلمك</span><button class="btn primary" type="button" id="iqNote">▶ استمع</button></div>` : ''}
      ${fresh.length ? `<div class="iq-note ok" role="status">✓ سمع معلمك كلماتك في ${fresh.map((s) => 'الدرس ' + ar(s.n)).join('، ')}: ${fresh.map((s) => s.status === 'pass' ? `أتقنتَ الدرس ${ar(s.n)} (${pctTxt(s.pct)})` : `تعيد الدرس ${ar(s.n)} (${pctTxt(s.pct)})`).join('، ')}.</div>` : ''}
      <div class="card iq-today">
        <div class="iq-head"><span class="iq-n">${ar(st.cur)}</span><div><span class="small muted">${L ? `درسك الحالي · ${esc(CONCEPTS.find((c) => c.c === L.c)?.t || '')} · ص ${ar(L.p)}` : ''}</span><h2>${L ? esc(L.t) : 'أتممت الدروس'}</h2></div></div>
        ${L?.hint ? `<p class="iq-hint">💡 ${esc(L.hint)}</p>` : ''}
        ${!L ? '<p>ما شاء الله! أتممت دروس الكتاب كلها. واصل التمرين الحر للمراجعة.</p>'
          : !L.items.length ? '<p class="muted">هذا الدرس قيد الإعداد وسيُضاف قريباً بإذن الله. راجع الدروس السابقة في التمرين الحر.</p>'
          : lastToday?.status === 'await' ? `<p>أنهيت درس اليوم: ${ar(lastToday.ok)} صحيحة من ${ar(lastToday.total)}، و${ar(lastToday.pend)} ${lastToday.pend === 1 ? 'كلمة' : 'كلمات'} ينتظر معلمك أن يسمعها ليحكم عليها. ⏳</p>`
          : lastToday ? `<p>${lastToday.status === 'pass' ? `🎉 أتقنت الدرس اليوم (${pctTxt(lastToday.pct)}). درسك الجديد غداً بإذن الله.` : `نتيجتك اليوم ${pctTxt(lastToday.pct)}، والمطلوب ${pctTxt(lastToday.pass || E.pass)}. كل محاولة تقرّبك 🌱 تدرّب على كلماتك، وتعيد الدرس غداً بإذن الله.`}</p>`
          : `<p class="muted" style="margin:0">${due ? `نبدأ بمراجعة سريعة لكلمات سابقة، ثم ` : 'ستظهر أمامك '}${ar(cnt)} ${cnt > 10 ? 'كلمة' : 'كلمات'} من الدرس. الكلمة الجديدة تسمعها أولاً وتكررها، ثم تقرؤها وحدك حين تتقنها. تتقن الدرس إذا أصبت ${pctTxt(E.pass)}.</p>
             ${st.ease ? '<p class="small" style="margin:0">🌱 خفّفنا عدد كلماتك لتتقنها خطوة خطوة.</p>' : ''}
             <div class="row"><button class="btn primary iq-big" type="button" id="iqGo">🎤 ابدأ درس اليوم</button></div>`}
        ${due && (lastToday || !L?.items.length) ? `<div class="row"><button class="btn" type="button" id="iqRv">🔁 راجع كلماتك الآن (${ar(due)})</button></div>` : ''}
        ${(st.wrong[st.cur] || []).length && L?.items.length ? `<div class="iq-wrong"><b class="small">كلمات تحتاج تدريباً:</b> ${(st.wrong[st.cur] || []).map((i) => L.items[i] && `<button type="button" class="iq-chip" data-pw="${i}">${esc(itemOf(L.items[i], L.n).t)}</button>`).filter(Boolean).join('')}</div>` : ''}
      </div>
      <div class="card stack" id="iqGame"></div>
      <div class="card stack">
        <div class="row" style="justify-content:space-between"><h3>طريقك في الكتاب</h3><span class="small muted">أتقنت ${doneN === 0 ? 'صفراً' : doneN === 1 ? 'درساً واحداً' : doneN === 2 ? 'درسين' : ar(doneN) + (doneN > 10 ? ' درساً' : ' دروس')} من ${ar(total)} · ${ar(E.pts)} نقاط لكل درس${E.dayPts ? ` و${ar(E.dayPts)} لكل يوم تتدرب فيه` : ''} في لوحة الشرف</span></div>
        <div class="iq-path">${LESSONS.map((l) => { const m = st.mastered[l.n]; const cls = l.n === st.cur ? 'cur' : m ? (m.skip ? 'skip' : 'done') : !l.items.length ? 'soon' : l.n < st.cur ? 'skip' : ''; return `<span class="iq-dot ${cls}" title="${esc(l.t)}${!l.items.length ? ' (قريباً)' : ''}">${m && !m.skip ? '✓' : ar(l.n)}</span>`; }).join('')}</div>
      </div>
      <div class="card stack" id="iqFree"></div>
      ${st.sessions.filter((s) => s.kind === 'daily').length ? `<div class="card"><h3 style="margin-bottom:8px">آخر دروسك</h3><ul class="iq-log">${st.sessions.filter((s) => s.kind === 'daily').slice(-6).reverse().map((s) => `<li><span>الدرس ${ar(s.n)} · ${esc(lessonByN(s.n)?.t || '')}</span><span class="small muted">${esc(s.day)}</span><span class="pill ${s.status === 'pass' ? 'ok' : s.status === 'await' ? 'warn' : 'bad'}">${s.status === 'pass' ? 'أتقن' : s.status === 'await' ? 'عند المعلم' : 'يعيد'} ${s.pct != null ? pctTxt(s.pct) : ''}</span></li>`).join('')}</ul></div>` : ''}
    </div>`;
    if (fresh.length) { fresh.forEach((s) => (s.toldStudent = true)); save({ sessions: st.sessions }); if (fresh.some((s) => s.status === 'pass')) confetti(); }
    const go = host.querySelector('#iqGo');
    if (go) go.onclick = () => runDaily(L);
    const rv = host.querySelector('#iqRv');
    if (rv) rv.onclick = () => runReview();
    const nt = host.querySelector('#iqNote');
    if (nt) nt.onclick = async () => {
      nt.disabled = true; nt.textContent = '…';
      try { const a = await store.getIqraAudio(st.note.key); if (!a) throw new Error('لم تُعثر على الرسالة'); await playBlob(b64ToBlob(a.b64, a.mime)); st.note = { ...st.note, heard: true }; save({ note: st.note }); nt.textContent = '↺ أعد'; }
      catch (e) { toast('تعذّر التشغيل: ' + e.message); nt.textContent = '▶ استمع'; }
      nt.disabled = false;
    };
    host.querySelectorAll('[data-pw]').forEach((b) => (b.onclick = () => practiceItem(L, +b.dataset.pw)));
    drawGame(host.querySelector('#iqGame'));
    drawFree(host.querySelector('#iqFree'));
  }

  /* --- لعبة: ميّز الحروف المتشابهة (استماع فقط، بلا تسجيل) --- */
  function drawGame(box) {
    const C = confusions(st);
    box.innerHTML = `<div class="row" style="justify-content:space-between"><h3>👂 ميّز الحروف المتشابهة</h3><span class="small muted">تسمع صوتاً فتختار حرفه · ١٠ أسئلة</span></div>
      ${C.length ? `<p class="small" style="margin:0">تحتاج تدريباً على: ${C.slice(0, 4).map((x) => `<b class="iq-cf">${esc(x.c)}</b>${x.as ? ` <span class="muted">(تظنه ${esc(x.as)})</span>` : ''}`).join('، ')}</p>` : ''}
      <div class="row"><button class="btn" type="button" id="iqGm">🎧 ابدأ اللعبة</button></div>`;
    box.querySelector('#iqGm').onclick = runGame;
  }
  function runGame() {
    const weak = new Set(confusions(st).map((x) => x.c));
    const groups = PAIRS.flatMap((g) => (g.some((c) => weak.has(c)) ? [g, g, g] : [g]));
    const qs = Array.from({ length: 10 }, () => { const g = groups[Math.floor(Math.random() * groups.length)]; const w = g.filter((c) => weak.has(c)); const c = w.length && Math.random() < 0.6 ? w[Math.floor(Math.random() * w.length)] : g[Math.floor(Math.random() * g.length)]; return { g: shuffle(g), c, h: HR[Math.floor(Math.random() * 3)] }; });
    let q = 0, okN = 0, done = false;
    const play = () => playSeq([srcFor(sylOf(qs[q].c, qs[q].h))]);
    const finish = () => { runner = null; stopAudio(); touchDay(); persist(); home(); };
    runner = { cancel: () => { runner = null; stopAudio(); persist(); } };
    const paintQ = (msg = '', cls = '') => {
      const Q = qs[q];
      host.innerHTML = `<div class="card stack iq iq-run${E.big ? ' iq-bigtxt' : ''}">
        <div class="row" style="justify-content:space-between"><span class="small muted">👂 ميّز الحروف · ${ar(q + 1)} من ${ar(qs.length)}</span><button class="btn sm ghost" type="button" id="iqX">✕ خروج</button></div>
        <div class="iq-prog" aria-hidden="true"><i style="width:${(q / qs.length) * 100}%"></i></div>
        <div class="row" style="justify-content:center"><button class="btn iq-say iq-big" type="button" id="gPlay">🔊 استمع</button></div>
        <p class="small muted" style="text-align:center;margin:0">أيّ حرف سمعت؟</p>
        <div class="iq-opts">${Q.g.map((c) => `<button type="button" class="iq-opt" data-o="${esc(c)}" lang="ar">${esc(sylOf(c, Q.h))}</button>`).join('')}</div>
        <div class="iq-msg ${cls}" role="status">${msg}</div>
      </div>`;
      host.querySelector('#iqX').onclick = finish;
      host.querySelector('#gPlay').onclick = play;
      host.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => {
        if (done) return; done = true;
        const pick = b.dataset.o, ok = pick === Q.c, x = (st.conf[Q.c] = st.conf[Q.c] || { n: 0, ok: 0, as: {} });
        x.n++; if (ok) { x.ok++; okN++; st.stars += 1; } else x.as[pick] = (x.as[pick] || 0) + 1;
        host.querySelectorAll('[data-o]').forEach((o) => { o.disabled = true; if (o.dataset.o === Q.c) o.classList.add('ok'); else if (o === b) o.classList.add('bad'); });
        const m = host.querySelector('.iq-msg'); m.className = 'iq-msg ' + (ok ? 'ok' : 'warn'); m.textContent = ok ? 'أحسنت! ⭐' : `هذا صوت «${sylOf(Q.c, Q.h)}». استمع مرة أخرى 👂`;
        const after = () => { done = false; q++; if (q < qs.length) { paintQ(); play(); } else end(); };
        if (ok) setTimeout(after, 800); else play().done.then(() => setTimeout(after, 700));
      }));
    };
    const end = () => {
      runner = null; touchDay(); persist();
      if (okN >= 8) confetti();
      host.innerHTML = `<div class="card stack iq" style="text-align:center;align-items:center">
        <div class="iq-score ${okN >= 8 ? 'pass' : 'await'}">${ar(okN)} / ${ar(qs.length)}</div>
        <h2>${okN >= 8 ? 'أذنك ممتازة! 🎉' : okN >= 5 ? 'أحسنت، وتتحسن مع التدريب 🌱' : 'بداية طيبة، كرّرها كل يوم 🌱'}</h2>
        <p style="margin:0">حصلت على ${ar(okN)} ${okN === 1 ? 'نجمة' : 'نجوم'} ⭐</p>
        <div class="row" style="justify-content:center"><button class="btn primary" type="button" id="gAgain">العب مرة أخرى</button><button class="btn" type="button" id="iqHome">رجوع</button></div></div>`;
      host.querySelector('#gAgain').onclick = runGame;
      host.querySelector('#iqHome').onclick = home;
    };
    paintQ(); play();
  }

  /* --- التمرين الحر --- */
  let freeN = null, freeK = 'syl', freeTaj = null, freeTajN = null;
  function drawFree(box) {
    const R = ready();
    if (freeN == null) freeN = (R.find((l) => l.n === st.cur) || R[R.length - 1])?.n;
    const L = lessonByN(freeN);
    const items = (L?.items || []).map((x, i) => ({ ...itemOf(x, L.n), i }));
    const grp = (x) => (x.k === 'word' ? 'word' : 'syl');
    const hasSyl = items.some((x) => grp(x) === 'syl'), hasWord = items.some((x) => grp(x) === 'word');
    if (freeTaj == null || freeTajN !== freeN) { freeTaj = L.n >= 4 && L.n <= (E.taj ?? IQ_DEFAULT.taj); freeTajN = freeN; }
    if (!hasSyl) freeK = 'word'; if (!hasWord) freeK = 'syl';
    box.innerHTML = `<div class="row" style="justify-content:space-between"><h3>🎯 تمرين حر</h3><span class="small muted">بلا درجات: اختر درساً، ثم الحروف أو الكلمات، واضغط أيّها لتتمرن عليه</span></div>
      <label class="field">الدرس<select id="iqFL">${R.map((l) => `<option value="${l.n}" ${l.n === freeN ? 'selected' : ''}>${ar(l.n)}. ${esc(l.t)}</option>`).join('')}</select></label>
      <div class="row" role="radiogroup">${hasSyl ? `<button type="button" class="chip iq-tg${freeK === 'syl' ? ' sel' : ''}" data-fk="syl" role="radio" aria-checked="${freeK === 'syl'}">الحروف</button>` : ''}${hasWord ? `<button type="button" class="chip iq-tg${freeK === 'word' ? ' sel' : ''}" data-fk="word" role="radio" aria-checked="${freeK === 'word'}">الكلمات</button>` : ''}</div>
      ${L.n >= 4 ? `<label class="iq-tajtg"><input type="checkbox" id="iqFT" ${freeTaj ? 'checked' : ''}> بالتجريد (حرفاً حرفاً كما في الكتاب)</label>` : ''}
      <div class="iq-grid">${items.filter((x) => grp(x) === freeK).map((x) => `<button type="button" class="iq-cell" data-fi="${x.i}">${E.color ? colorize(x.t) : esc(x.t)}</button>`).join('')}</div>`;
    box.querySelector('#iqFL').onchange = (e) => { freeN = +e.target.value; drawFree(box); };
    box.querySelectorAll('[data-fk]').forEach((b) => (b.onclick = () => { freeK = b.dataset.fk; drawFree(box); }));
    const ft = box.querySelector('#iqFT'); if (ft) ft.onchange = () => { freeTaj = ft.checked; };
    box.querySelectorAll('[data-fi]').forEach((b) => (b.onclick = () => practiceItem(L, +b.dataset.fi, items.filter((x) => grp(x) === freeK).map((x) => x.i))));
  }
  function practiceItem(L, i, seq) {
    const order = seq || [i];
    const at = order.indexOf(i);
    const list = order.slice(at).concat(order.slice(0, at)).map((k) => ({ ...itemOf(L.items[k], L.n), i: k, n: L.n }));
    run({ mode: 'practice', items: list, title: `تمرين حر · الدرس ${ar(L.n)}`, taj: freeTaj ? 'opt' : null }).then(() => { if (alive) home(); });
  }

  /* --- اختبار تحديد المستوى --- */
  function placementIntro() {
    host.innerHTML = `<div class="card stack iq">
      <div class="iq-head"><span class="iq-n">📖</span><div><span class="small muted">اقرأ وارتقِ · القواعد الأساسية لتعليم لغة القرآن</span><h2>أهلاً بك! نبدأ باختبار قصير لنعرف مستواك</h2></div></div>
      <p style="margin:0">ستظهر أمامك حروف وكلمات من دروس الكتاب، من الأسهل إلى الأصعب. انطق كل واحدة بعد ضغط الميكروفون. يتوقف الاختبار حين تصل إلى ما يحتاج تدريباً، ونبدأ دروسك منه.</p>
      <ul class="small muted" style="margin:0;padding-inline-start:18px;line-height:2"><li>اجلس في مكان هادئ، وقرّب الجوال من فمك.</li><li>انطق بصوت واضح، ثم اسكت لحظة فيتوقف التسجيل وحده.</li><li>يستغرق الاختبار بضع دقائق.</li></ul>
      ${hasRecorder ? '<div class="row"><button class="btn primary iq-big" type="button" id="iqPl">ابدأ الاختبار</button></div>' : `<p class="iq-note bad">${esc(micErrorText(null))}</p>`}
    </div>`;
    const b = host.querySelector('#iqPl'); if (b) b.onclick = runPlacement;
  }
  async function runPlacement() {
    const cs = [...new Set(ready().map((l) => l.c))];
    let startN = null;
    const log = [];
    for (const c of cs) {
      const items = pickPlacement(c);
      const res = await run({ mode: 'place', items, title: `تحديد المستوى · ${CONCEPTS.find((x) => x.c === c)?.t}`, step: [cs.indexOf(c) + 1, cs.length] });
      if (!res) return home(); // خرج قبل النهاية
      log.push({ c, ok: res.filter((r) => r.ok).length, n: res.length });
      const okN = res.filter((r) => r.ok).length;
      if (okN < Math.ceil(res.length * 0.67)) { startN = Math.min(...res.filter((r) => !r.ok).map((r) => r.item.n)); break; }
    }
    const last = ready().slice(-1)[0];
    if (startN == null) startN = nextLesson(last.n);
    const mastered = { ...st.mastered };
    LESSONS.filter((l) => l.n < startN).forEach((l) => { if (!mastered[l.n]) mastered[l.n] = { skip: true, day: today() }; });
    st.sessions.push({ id: 'p' + Date.now().toString(36), kind: 'place', day: today(), start: startN, log });
    await save({ placed: true, cur: startN, mastered, placedAt: new Date().toISOString(), sessions: st.sessions.slice(-40) });
    const L = lessonByN(startN);
    host.innerHTML = `<div class="card stack iq" style="text-align:center;align-items:center">
      <div style="font-size:48px">🌟</div><h2>بارك الله فيك!</h2>
      <p style="margin:0">${L ? `تبدأ دروسك من <b>الدرس ${ar(L.n)}: ${esc(L.t)}</b>.` : 'أتقنت كل الدروس المتاحة الآن. واصل التمرين الحر حتى تُضاف الدروس الجديدة.'}</p>
      <button class="btn primary" type="button" id="iqHome">إلى دروسي</button></div>`;
    confetti();
    host.querySelector('#iqHome').onclick = home;
  }

  /* --- المراجعة وحدها --- */
  async function runReview() {
    const items = dueList().map(srsItem).filter(Boolean).slice(0, 12);
    if (!items.length) return home();
    const res = await run({ mode: 'review', items, title: '🔁 مراجعة كلماتك' });
    if (!res) return home();
    const ok = res.filter((r) => r.ok).length;
    if (ok === res.length) confetti();
    host.innerHTML = `<div class="card stack iq" style="text-align:center;align-items:center">
      <div class="iq-score ${ok === res.length ? 'pass' : 'await'}">${ar(ok)} / ${ar(res.length)}</div>
      <h2>${ok === res.length ? 'ثبتت كلماتك! 🎉' : 'أحسنت المحاولة 🌱'}</h2>
      <p style="margin:0">${ok < res.length ? 'ما لم يثبت يعود إليك غداً، حتى يرسخ بإذن الله.' : 'ستعود إليك بعد أيام لتبقى راسخة.'}</p>
      <button class="btn primary" type="button" id="iqHome">رجوع</button></div>`;
    host.querySelector('#iqHome').onclick = home;
  }

  /* --- الدرس اليومي --- */
  async function runDaily(L) {
    const cnt = dailyCount();
    const lesson = pickDaily(L, cnt, st.wrong[L.n] || []).map((x) => ({ ...x, n: L.n }));
    const have = new Set(lesson.map((x) => ikey(x.n, x.i)));
    const due = dueList().map(srsItem).filter((x) => x && !have.has(ikey(x.n, x.i)));
    const revs = due.slice(0, Math.max(2, Math.round(cnt / 3)));
    const items = [...revs, ...lesson];
    const sid = 's' + Date.now().toString(36);
    const res = await run({ mode: 'daily', items, title: `درس اليوم · ${ar(L.n)}. ${L.t}`, sid, taj: L.n >= 4 && L.n <= (E.taj ?? IQ_DEFAULT.taj) ? 'must' : null });
    if (!res) return home();
    const R = res.filter((r) => !r.item.rev);
    const total = R.length, ok = R.filter((r) => r.ok).length, pend = R.filter((r) => r.pending).length;
    const pct = Math.round((ok / total) * 100);
    const s = { id: sid, kind: 'daily', n: L.n, day: today(), total, ok, pend, pct, pass: E.pass, at: new Date().toISOString(),
      wrongIdx: R.filter((r) => !r.ok && !r.pending).map((r) => r.item.i) };
    if (!pend) s.status = pct >= E.pass ? 'pass' : 'fail';
    else if (((ok + pend) / total) * 100 < E.pass) s.status = 'fail';
    else s.status = 'await';
    if (s.status !== 'await') applyResult(s, [...s.wrongIdx, ...R.filter((r) => r.pending).map((r) => r.item.i)]);
    st.sessions.push(s);
    await save({ sessions: st.sessions.slice(-40), mastered: st.mastered, wrong: st.wrong, cur: st.cur, ease: st.ease || 0, easeDay: st.easeDay || null, alert: st.alert || null, srs: st.srs });
    if (s.status === 'pass') confetti();
    const revOk = res.filter((r) => r.item.rev && r.ok).length, revN = res.filter((r) => r.item.rev).length;
    host.innerHTML = `<div class="card stack iq" style="text-align:center;align-items:center">
      <div class="iq-score ${s.status}">${pctTxt(pct)}</div>
      <h2>${s.status === 'pass' ? 'أحسنت! أتقنت الدرس 🎉' : s.status === 'await' ? 'أنهيت درس اليوم' : 'أحسنت المحاولة 🌱'}</h2>
      <p style="margin:0">${ar(ok)} صحيحة من ${ar(total)}${pend ? `، و${ar(pend)} ينتظر معلمك أن يسمعها` : ''}.${revN ? ` وفي المراجعة ${ar(revOk)} من ${ar(revN)}.` : ''}
        ${s.status === 'pass' ? `حصلت على ${ar(E.pts)} نقاط في لوحة الشرف، ودرسك الجديد غداً بإذن الله.` : s.status === 'await' ? 'ستظهر نتيجتك حين يسمع معلمك كلماتك.' : `المطلوب ${pctTxt(E.pass)}. كل يوم تتدرب فيه تقترب أكثر، وتعيد الدرس غداً بإذن الله.`}</p>
      <p class="small muted" style="margin:0">⭐ مجموع نجومك: ${ar(st.stars)}</p>
      <button class="btn primary" type="button" id="iqHome">رجوع</button></div>`;
    host.querySelector('#iqHome').onclick = home;
  }

  /* --- مشغّل العناصر (اختبار المستوى، الدرس اليومي، المراجعة، التمرين) --- */
  // مراحل الكلمة: ٠ «اسمع ثم كرّر» (يُسمَع الصوت تلقائياً)، ١ «اقرأ مع المساعدة»، ٢ «اقرأ وحدك» (يُخفى الصوت حتى يخطئ)
  const STAGE = ['👂 اسمع ثم كرّر', '🤝 اقرأ مع المساعدة', '💪 اقرأ وحدك'];
  function run({ mode, items, title, step, sid, taj = null }) {
    return new Promise((resolve) => {
      let k = 0, tries = 0, rec = null, busy = false, busyAt = 0, ts = taj ? 0 : -1, steps = null, autoK = -1, acted = false, live = true, srv = aiEnabled() ? 'wait' : 'ok';
      const pend = new Set(), marks = [];
      warm().then((ok) => { srv = ok ? 'ok' : 'fail'; const e = host.querySelector('#iqSrv'); if (e) e.textContent = ''; });
      const results = [];
      const stageOf = (it) => (mode === 'place' || E.echo === false ? 2 : st.lv[ikey(it.n, it.i)] ?? 0);
      const setStage = (it, v) => { if (mode === 'place' || E.echo === false) return; st.lv[ikey(it.n, it.i)] = Math.max(0, Math.min(2, v)); };
      const finish = (v) => { live = false; runner = null; rec?.cancel(); stopAudio(); if (mode !== 'place' && acted) { touchDay(); persist(); } resolve(v); };
      const flagged = new Set();
      const flag = (it) => {
        if (flagged.has(it.s)) return; flagged.add(it.s);
        store.addIqraFlag({ key: keyOf(it.s), t: it.t, s: it.s, n: it.n, pn: me.id, name: me.name }).then(() => toast('شكراً! أُبلغ معلمك ليصحّح النطق.')).catch(() => toast('تعذّر الإرسال.'));
      };
      /* --- مرحلة التجريد: الكلمة حرفاً حرفاً --- */
      // كل خطوة كما في الكتاب: اسم الحرف، ثم اسم حركته، ثم صوته، ثم ما بُني مجموعاً بتشكيله
      // «فا فتحة فَ» ← «را ساكنة فَرْ» ← «قاف فتحتان فَرْقًا». والخطوة الأخيرة تُختم بالكلمة كاملة (صوت القارئ أو المعلم)
      const src1 = (t) => srcFor(t);
      const stepAudio = (sp) => {
        const spoken = steps.filter((x) => !x.silent), last = spoken[spoken.length - 1] === sp, firstOfWord = !steps.some((x) => !x.silent && x.wi === sp.wi && steps.indexOf(x) < steps.indexOf(sp));
        const list = sp.say.map(src1);
        if (sp.syl && (firstOfWord || sp.syl !== sp.cum)) list.push(src1(sp.syl));
        if (last) list.push(...sourcesFor(items[k]).list);
        else if (!firstOfWord || !sp.syl) list.push(src1(sp.cum.replace(/[ٱ]/g, 'ا')));
        return playSeq(list, { gap: 0.12 });
      };
      const paintTaj = () => {
        const it = items[k];
        steps = steps || tajSteps(it.s);
        if (ts === 0) { steps.slice(0, 3).forEach((x) => prefetch((x.say || []).concat(x.syl ? [x.syl] : [], x.cum ? [x.cum.replace(/ٱ/g, 'ا')] : []).map(srcFor))); prefetch(sourcesFor(it).list); }
        else if (steps[ts + 1]) { const x = steps[ts + 1]; prefetch((x.say || []).concat(x.syl ? [x.syl] : [], x.cum ? [x.cum.replace(/ٱ/g, 'ا')] : []).map(srcFor)); }
        const sp = steps[ts];
        const T = it.s, Z = '‍';
        const hl = sp ? esc(T.slice(0, sp.at)) + (sp.at && T[sp.at - 1] !== ' ' ? Z : '') + '<mark class="' + (sp.silent ? 'sil' : '') + '">' + (sp.at && T[sp.at - 1] !== ' ' ? Z : '') + esc(T.slice(sp.at, sp.end)) + (sp.end < T.length && T[sp.end] !== ' ' ? Z : '') + '</mark>' + (sp.end < T.length && T[sp.end] !== ' ' ? Z : '') + esc(T.slice(sp.end)) : esc(T);
        host.innerHTML = `<div class="card stack iq iq-run${E.big ? ' iq-bigtxt' : ''}">
          <div class="row" style="justify-content:space-between"><span class="small muted">${esc(title)} · التجريد</span><button class="btn sm ghost" type="button" id="iqX">✕ ${mode === 'practice' ? 'إغلاق' : 'خروج'}</button></div>
          ${progHtml()}
          <div class="iq-word iq-taj" lang="ar">${hl}</div>
          <div class="iq-tstep">${sp.silent ? `<span class="iq-sil">${esc(sp.note)}</span>` : `<span class="iq-names">${sp.say.map(esc).join(' <i>+</i> ')}</span>${sp.syl ? ` <i>=</i> <b class="iq-syl">${esc(sp.syl)}</b>` : ''}${steps.some((x) => !x.silent && x.wi === sp.wi && steps.indexOf(x) < steps.indexOf(sp)) || !sp.syl ? ` <i>←</i> <b class="iq-syl">${esc(sp.cum)}</b>` : ''}`}</div>
          <div class="iq-cum"><span class="small muted">ما بنيتَه حتى الآن</span><b lang="ar">${esc(sp.cum)}</b></div>
          ${sp.note && !sp.silent ? `<span class="small muted" style="text-align:center">💡 ${esc(sp.note)}</span>` : ''}
          <div class="iq-ctrl">
            <button class="btn iq-say" type="button" id="iqTs" ${sp.silent ? 'disabled' : ''}>🔊 أعد</button>
            <button class="btn primary" type="button" id="iqTn">${ts < steps.length - 1 ? 'التالي ←' : 'اقرأ الكلمة كاملة ←'}</button>
          </div>
          <div class="iq-tdots">${steps.map((x, j) => `<i class="${j < ts ? 'd' : j === ts ? 'c' : ''}${x.silent ? ' s' : ''}"></i>`).join('')}</div>
          <p class="small muted" style="text-align:center;margin:0">ردِّد بعده بصوتك: اسم الحرف، ثم حركته، ثم صوته، ثم ما بنيتَه.${taj === 'opt' ? ' <button class="btn sm ghost" type="button" id="iqTk">تخطَّ التجريد</button>' : ''}</p>
        </div>`;
        host.querySelector('#iqX').onclick = () => finish(null);
        if (!sp.silent) stepAudio(sp);
        host.querySelector('#iqTs').onclick = () => stepAudio(sp);
        host.querySelector('#iqTn').onclick = () => { stopAudio(); if (ts < steps.length - 1) { ts++; paintTaj(); } else { ts = -1; autoK = k; paint('الآن اقرأ الكلمة كاملة دون تقطيع.'); } };
        const tk = host.querySelector('#iqTk'); if (tk) tk.onclick = () => { stopAudio(); ts = -1; paint(); };
      };
      // شريط التقدم: نقطة لكل كلمة تتلوّن حين يصل حكمها (✓ أخضر، ↺ برتقالي تعود إليه، ✗ أحمر، رمادي ينتظر التصحيح)
      const dotsHtml = () => `<div class="iq-dots2" aria-hidden="true">${items.map((_, j) => `<i class="${marks[j] || ''}${j === k ? ' cur' : ''}"></i>`).join('')}</div>`;
      const progHtml = () => (mode === 'practice' ? '' : `${dotsHtml()}<span class="small muted" style="text-align:center">${ar(Math.min(k + 1, items.length))} من ${ar(items.length)} <span id="iqSrv">${srv === 'wait' ? '· ⏳ يجهَّز المصحّح…' : ''}</span></span>`);
      const updDots = () => { const d = host.querySelector('.iq-dots2'); if (d) d.outerHTML = dotsHtml(); };
      const bgNote = (t, c) => { const e = host.querySelector('#iqBg'); if (!e) return; e.className = 'iq-bg ' + c; e.textContent = t; clearTimeout(e._t); e._t = setTimeout(() => { e.textContent = ''; }, 3500); };
      runner = { cancel: () => finish(null) };
      const paint = (msg = '', cls = '') => {
        const it = items[k];
        if (ts >= 0) return paintTaj();
        const src = sourcesFor(it);
        prefetch(src.list);
        const stg = stageOf(it);
        const showSay = mode === 'practice' || stg < 2 || tries > 0 || (it.replay && mode !== 'place');
        host.innerHTML = `<div class="card stack iq iq-run${E.big ? ' iq-bigtxt' : ''}">
          <div class="row" style="justify-content:space-between"><span class="small muted">${esc(title)}${step ? ` · ${ar(step[0])}/${ar(step[1])}` : ''}</span>
            <button class="btn sm ghost" type="button" id="iqX">✕ ${mode === 'practice' ? 'إغلاق' : 'خروج'}</button></div>
          ${progHtml()}
          <div class="row" style="justify-content:center;gap:6px">${mode !== 'place' && E.echo !== false ? `<span class="iq-stage s${stg}">${STAGE[stg]}</span>` : ''}${it.rev ? `<span class="iq-stage rv">🔁 مراجعة · الدرس ${ar(it.n)}</span>` : ''}${it.again ? '<span class="iq-stage rv">↺ عدنا إليها</span>' : ''}</div>
          <div class="iq-word" lang="ar">${E.color ? colorize(it.t) : esc(it.t)}</div>
          ${E.color ? LEGEND : ''}
          ${it.k === 'name' ? '<span class="small muted" style="text-align:center">اقرأ أسماء الحروف</span>' : it.s !== it.t ? '<span class="small muted" style="text-align:center">انتبه: تُقرأ بخلاف رسمها</span>' : ''}
          <div class="iq-ctrl">
            ${showSay ? '<button class="btn iq-say" type="button" id="iqSay" aria-label="استمع للنطق">🔊 استمع</button>' : ''}
            <button class="iq-mic" type="button" id="iqMic" aria-label="سجّل نطقك">🎤</button>
            ${mode === 'practice' ? `<button class="btn" type="button" id="iqNext">التالي ←</button>` : `<button class="btn ghost small" type="button" id="iqSkip">${mode === 'place' ? 'لا أعرفها' : 'ساعدني'}</button>`}
          </div>
          <div class="iq-level"><i id="iqLv"></i></div>
          <div class="row" style="justify-content:center;gap:8px">${showSay ? `<span class="small muted">🔊 ${esc(KIND_LABEL[src.kind])}</span>` : ''}${taj ? '<button class="btn sm ghost" type="button" id="iqTa">↺ التجريد مرة أخرى</button>' : ''}<button class="btn sm ghost" type="button" id="iqFl" title="أبلغ معلمك أن النطق المسموع غير صحيح">🚩 النطق خاطئ</button></div>
          <div class="iq-msg ${cls}" role="status" id="iqMsg">${msg || (it.replay && mode !== 'place' ? 'عدنا إليها: استمع جيداً، ثم كرّر بعده 👂' : tries ? 'حاول مرة أخرى بهدوء ووضوح.' : stg === 0 && mode !== 'place' ? 'استمع جيداً، ثم اضغط الميكروفون وكرّر.' : 'اضغط الميكروفون ثم انطق.')}</div>
          <div class="iq-bg" id="iqBg" role="status"></div>
        </div>`;
        host.querySelector('#iqX').onclick = () => finish(null);
        const say = host.querySelector('#iqSay'); if (say) say.onclick = () => playItem(it);
        host.querySelector('#iqFl').onclick = (e) => { flag(it); e.currentTarget.disabled = true; };
        const ta = host.querySelector('#iqTa'); if (ta) ta.onclick = () => { ts = 0; paintTaj(); };
        host.querySelector('#iqMic').onclick = () => {
          if (rec && rec.stopped) { rec.cancel(); rec = null; busy = false; return listen(); } // تسجيل سابق عالق
          if (rec) return rec.stop();
          if (busy && Date.now() - busyAt > 8000) busy = false;
          listen();
        };
        const nx = host.querySelector('#iqNext'); if (nx) nx.onclick = () => next();
        const sk = host.querySelector('#iqSkip');
        if (sk) sk.onclick = () => {
          if (mode === 'place') { results.push({ item: items[k], ok: false, skip: true }); return next(); }
          // «ساعدني»: لا يُحسب خطأ؛ يسمع النطق ويكرره (ويرجع للمرحلة الأولى)
          setStage(it, 0); tries = Math.max(tries, 1); paint('استمع جيداً، ثم كرّر بعده 👂', 'warn'); playItem(it);
        };
        if ((stg === 0 || it.replay) && mode !== 'place' && autoK !== k && !msg) { autoK = k; setTimeout(() => { if (runner && items[k] === it && ts < 0 && !rec && !busy) playItem(it); }, 300); }
      };
      const next = () => {
        k++; tries = 0; steps = null; ts = taj ? 0 : -1; stopAudio();
        if (k >= items.length) { if (mode === 'practice') { k = 0; return paint('أكملت القائمة! تبدأ من جديد.'); } return waitEnd(); }
        paint();
      };
      // آخر الكلمات قد يكون تصحيحها لم يصل بعد: ننتظره، وما عاد منها يُعرض قبل النهاية
      const waitEnd = async () => {
        while (pend.size && live) {
          host.innerHTML = `<div class="card stack iq iq-run" style="text-align:center;align-items:center"><span class="small muted">${esc(title)}</span>${dotsHtml()}<div style="font-size:40px">⏳</div><p style="margin:0">نُكمل تصحيح آخر كلماتك…</p></div>`;
          await Promise.all([...pend]);
        }
        if (!live) return;
        if (k < items.length) return paint();
        finish(results);
      };
      const praise = () => { const p = PRAISE[Math.floor(Math.random() * PRAISE.length)]; if (hasRec(p) || genOn()) { playSeq([srcFor(p)]); return 1300; } return 800; };
      /** نتيجة كلمة (فورية أو وصلت من الخادم في الخلفية) */
      function settle(it, j, v, r) {
        if (!live) return;
        const stg = stageOf(it);
        if (v.ok) {
          marks[j] = 'ok';
          if (mode !== 'place') { st.stars += 1; setStage(it, stg + 1); srsHit(it, true); }
          if (mode !== 'practice') results.push({ item: it, ok: true });
          if (j !== k) bgNote(`✓ «${it.t}» صحيحة`, 'ok');
        } else if (mode === 'practice') {
          if (!v.empty && !v.unsure) { marks[j] = 'bad'; setStage(it, stg - 1); srsHit(it, false); }
        } else if (!it.again) {
          // أول تعثّر: لا نوقف الطالب؛ تعود الكلمة في آخر الدرس ويسمع نطقها الصحيح قبلها
          marks[j] = 'again';
          if (mode !== 'place' && !v.empty) srsHit(it, false);
          items.push({ ...it, again: true, replay: true });
          bgNote(v.empty ? `لم يُسمع صوتك في «${it.t}»، نعود إليها بعد قليل.` : `↺ «${it.t}» نعود إليها بعد قليل.`, 'warn');
        } else {
          marks[j] = 'bad';
          if (mode !== 'place') { setStage(it, stg - 1); srsHit(it, false); }
          // عادت ولم تثبت: في الدرس اليومي يسمعها المعلم
          if (mode === 'daily' && !it.rev && r?.blob && !v.empty) {
            results.push({ item: it, ok: false, pending: true });
            blobToB64(r.blob).then((b64) => store.addIqraRev(me.id, { sid, n: it.n, i: it.i, t: it.t, s: it.s, b64, mime: r.blob.type, got: v.got || '', said: r.transcript || '' })).catch((e) => console.warn('iqra rev', e));
            if (j !== k) bgNote(`«${it.t}» سيسمعها معلمك.`, 'warn');
          } else results.push({ item: it, ok: false });
        }
        updDots();
      }
      async function listen() {
        if (busy) return;
        busy = true; busyAt = Date.now();
        stopAudio();
        await new Promise((r) => setTimeout(r, 150)); // يهدأ مكبّر الصوت قبل فتح الميكروفون
        const it = items[k], j = k;
        const mic = host.querySelector('#iqMic'), lv = host.querySelector('#iqLv'), msg = host.querySelector('#iqMsg');
        mic.classList.add('on'); msg.className = 'iq-msg'; msg.textContent = 'أستمع… انطق الآن';
        rec = recordOnce({ quiet: quietFor(it), onLevel: (l) => { if (lv) lv.style.width = Math.round(l * 100) + '%'; }, expect: it.k !== 'syl' ? (t) => judgeTranscript(it.s, t, { names: it.k === 'name' }).ok : null });
        try { await rec.start(); } catch (e) { rec = null; busy = false; mic.classList.remove('on'); msg.className = 'iq-msg bad'; msg.textContent = e.message || micErrorText(e); return; }
        const r = await rec.done;
        rec = null; mic.classList.remove('on'); if (lv) lv.style.width = '0';
        busy = false;
        if (!host.isConnected || runner == null || items[k] !== it) return;
        if (!r.transcript && (!r.blob || r.blob.size < 1500)) { paint('لم أسمع صوتك. قرّب الجوال وانطق بصوت أوضح.', 'warn'); return; }
        acted = true;
        if (mode !== 'place') st.stars += 1; // نجمة على كل محاولة
        // ١) حكم فوري من المتصفح
        if (judgeASR(it, r)) {
          settle(it, j, { ok: true }, r);
          const stg = stageOf(it);
          msg.className = 'iq-msg ok'; msg.textContent = ['أحسنت! ⭐', 'ممتاز! ⭐', 'بارك الله فيك ⭐', 'صحيح ⭐'][Math.floor(Math.random() * 4)] + (mode !== 'place' && stg === 2 && E.echo !== false ? ' في المرة القادمة تقرؤها وحدك 💪' : '');
          setTimeout(() => { if (items[k] === it) next(); }, mode === 'place' ? 700 : praise());
          return;
        }
        // التمرين الحر بلا عجلة: ينتظر الحكم ثم يُسمَع النطق الصحيح إن لزم
        if (mode === 'practice') {
          msg.className = 'iq-msg'; msg.textContent = 'جارٍ التحقق من نطقك…';
          const v = await judgeAI(it, r);
          if (!live || items[k] !== it) return;
          settle(it, j, v, r);
          if (v.ok) { msg.className = 'iq-msg ok'; msg.textContent = 'أحسنت! ⭐'; setTimeout(() => { if (items[k] === it) next(); }, praise()); return; }
          tries++;
          paint(v.empty ? 'لم أسمع صوتك. قرّب الجوال وانطق بصوت أوضح.' : v.unsure ? 'تعذّر التحقق الآن. استمع ثم كرّر بعده 👂' : 'قريب! استمع جيداً ثم كرّر بعده 👂', 'warn');
          if (!v.empty) playItem(it);
          return;
        }
        // ٢) خادم التجويد في الخلفية: ينتقل الطالب فوراً، ويصل الحكم على شريط التقدم
        marks[j] = 'wait'; updDots();
        const p = judgeAI(it, r).then((v) => settle(it, j, v, r));
        pend.add(p); p.finally(() => pend.delete(p));
        msg.className = 'iq-msg'; msg.textContent = '✓ سُجّل نطقك، ويصلك التصحيح على الشريط بعد لحظة.';
        setTimeout(() => { if (items[k] === it) next(); }, 650);
      }
      paint();
    });
  }

  return () => { alive = false; runner?.cancel(); try { speechSynthesis.cancel(); } catch {} };
}

/* =====================================================================
   واجهة المعلم
   ===================================================================== */
export function mountIqraTeacher(host, { students, classes, toast = () => {}, onChange = () => {} }) {
  let cfg = null, states = {}, revs = [], flags = [], q = '', cls = 'all', alive = true, prevN = 4, studio = null, editPn = null, note = null;
  host.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const load = async () => {
    cfg = await iqraCfg();
    const pns = cfg.pns.filter((p) => byId[p]);
    const S = await Promise.all(pns.map((p) => store.getIqra(p).catch(() => null)));
    states = Object.fromEntries(pns.map((p, i) => [p, S[i]]));
    const R = await Promise.all(pns.map((p) => store.listIqraRev(p).catch(() => [])));
    revs = R.flat().filter((r) => r.status === 'pending');
    await audioIndex(true); probeReciter();
    setGen({ on: !!cfg.genOn, voice: cfg.genVoice || 'ar-XA-Wavenet-B', rate: cfg.genRate || 0.8 });
    flags = await store.listIqraFlags().catch(() => []);
    onChange({ cfg, states });
    if (alive) draw();
  };
  load().catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });

  function draw() {
    if (studio) return studio.paint();
    const on = new Set(cfg.pns);
    const shown = students.filter((s) => (cls === 'all' || s.classId === cls) && (!q || s.name.includes(q)));
    const enabled = students.filter((s) => on.has(s.id));
    const G = { ...IQ_DEFAULT, ...cfg };
    host.innerHTML = `<div class="stack iq">
      <div class="card stack">
        <div><h2>⚙️ إعدادات «اقرأ وارتقِ» <span class="small muted" style="font-weight:400">· إصدار ١٢/١١ (٩)</span></h2><p class="small muted" style="margin:4px 0 0">تدريب على نطق الحروف والكلمات من كتاب «اقرأ وارتقِ» (الفصول ١–٤)، للطلاب الذين تختارهم فقط. يظهر لهم تبويب خاص: اختبار مستوى، ثم درس يومي، وتمرين حر.</p></div>
        <div class="row">
          <label class="field" style="min-width:150px">عدد الكلمات في الدرس اليومي<input type="number" id="iqC" min="5" max="40" value="${cfg.count}"></label>
          <label class="field" style="min-width:150px">نسبة الإتقان للانتقال (٪)<input type="number" id="iqP" min="50" max="100" value="${cfg.pass}"></label>
          <label class="field" style="min-width:150px">نقاط كل درس في لوحة الشرف<input type="number" id="iqPts" min="0" max="20" value="${cfg.pts}"></label>
          <label class="field" style="min-width:170px">التجريد إلزامي حتى الدرس<input type="number" id="iqTj" min="0" max="43" value="${cfg.taj ?? IQ_DEFAULT.taj}"></label>
          <label class="field" style="min-width:150px">نقاط كل يوم تدريب<input type="number" id="iqDp" min="0" max="5" value="${G.dayPts}"></label>
        </div>
        ${flagBoxes(G, 'g')}
        <div class="row"><button class="btn primary" type="button" id="iqSave">حفظ</button><span class="small muted">ولكل طالب إعدادات خاصة من زر ⚙ في «تقدّم الطلاب».</span></div>
      </div>

      ${genCard()}
      ${studioCard()}
      ${flagsCard()}
      ${previewCard()}
      <div class="card stack" id="iqRev">
        <div class="row" style="justify-content:space-between"><h3>🎧 كلمات تنتظر سماعك <span class="pill ${revs.length ? 'warn' : 'mute'}">${ar(revs.length)}</span></h3>${revs.length ? '<span class="small muted">لم يتأكد منها النظام بعد محاولتين. استمع واحكم.</span>' : ''}</div>
        ${revs.length ? `<ul class="iq-revs">${revs.sort((a, b) => (a.at || '').localeCompare(b.at || '')).map((r) => `<li data-r="${esc(r.pn)}|${esc(r.id)}">
            <div><b>${esc(byId[r.pn]?.name || '')}</b><span class="small muted"> · الدرس ${ar(r.n)}</span></div>
            <span class="iq-rw" lang="ar">${esc(r.t)}</span>
            <div class="row" style="gap:6px"><button class="btn sm" type="button" data-play>▶ استمع</button><button class="btn sm primary" type="button" data-dec="ok">✓ صحيح</button><button class="btn sm danger" type="button" data-dec="redo">✗ يعيدها</button></div></li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">لا شيء الآن.</p>'}
      </div>

      <div class="card stack">
        <h3>👥 تقدّم الطلاب (${ar(enabled.length)})</h3>
        ${enabled.length ? `<div class="table-wrap"><table class="iq-table"><thead><tr><th>الطالب</th><th>الدرس الحالي</th><th>أتقن</th><th>آخر درس يومي</th><th>تغيير الدرس</th><th>خاص</th></tr></thead><tbody>
          ${enabled.map((s) => { const x = states[s.id]; const last = (x?.sessions || []).filter((z) => z.kind !== 'place').slice(-1)[0]; const L = x ? lessonByN(x.cur) : null;
            return `<tr><td>${esc(s.name)}<div class="small muted">${esc(classes.find((c) => c.id === s.classId)?.name || '')}</div></td>
              <td>${!x ? '<span class="pill mute">لم يبدأ</span>' : !x.placed ? '<span class="pill mute">لم يُكمل اختبار المستوى</span>' : `${ar(x.cur)}. ${esc(L?.t || '')}`}${x?.alert ? `<div class="iq-alert small">⬇ ${esc(x.alert.msg)} <button class="btn sm ghost" type="button" data-unease="${esc(s.id)}">↺ أعد العدد الطبيعي</button></div>` : ''}</td>
              <td>${ar(Object.values(x?.mastered || {}).filter((m) => !m.skip).length)}</td>
              <td>${last ? `<span class="pill ${last.status === 'pass' ? 'ok' : last.status === 'await' ? 'warn' : 'bad'}">${last.status === 'pass' ? 'أتقن' : last.status === 'await' ? 'ينتظرك' : 'يعيد'} ${last.pct != null ? pctTxt(last.pct) : ''}</span> <span class="small muted">${esc(last.day)}</span>` : '—'}</td>
              <td><select data-cur="${esc(s.id)}" aria-label="درس ${esc(s.name)}"><option value="">—</option>${LESSONS.map((l) => `<option value="${l.n}" ${x?.cur === l.n ? 'selected' : ''}>${ar(l.n)}${l.items.length ? '' : ' (قريباً)'}</option>`).join('')}</select></td>
              <td><button class="btn sm ${cfg.per?.[s.id] ? 'primary' : 'ghost'}" type="button" data-per="${esc(s.id)}" aria-label="إعدادات ${esc(s.name)} الخاصة">⚙</button></td></tr>`; }).join('')}
          </tbody></table></div>${editPn && byId[editPn] ? perForm(editPn) : ''}` : '<p class="small muted" style="margin:0">لم تختر أحداً بعد. اختر الطلاب من قسم «✅ اختيار الطلاب».</p>'}
      </div>

      ${reportCard(enabled)}
      <div class="card stack">
        <h3>✅ اختيار الطلاب</h3><p class="small muted" style="margin:0">اختر الطلاب المحتاجين لعناية مكثفة في النطق والقراءة.</p>
        <div class="row"><input type="search" id="iqQ" placeholder="ابحث بالاسم" value="${esc(q)}" style="flex:1;min-width:160px">
          <select id="iqCls"><option value="all">كل الصفوف</option>${classes.map((c) => `<option value="${esc(c.id)}" ${cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="iq-pick">${shown.map((s) => `<label class="iq-st${on.has(s.id) ? ' on' : ''}"><input type="checkbox" data-pn="${esc(s.id)}" ${on.has(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('') || '<span class="small muted">لا نتائج.</span>'}</div>
        <p class="small muted" style="margin:0">التغيير يُحفظ فوراً، ويظهر التبويب للطالب عند فتحه المقرأة.</p>
      </div>
    </div>`;
    host.querySelector('#iqSave').onclick = async () => {
      const c = Math.min(40, Math.max(5, +host.querySelector('#iqC').value || IQ_DEFAULT.count));
      const p = Math.min(100, Math.max(50, +host.querySelector('#iqP').value || IQ_DEFAULT.pass));
      const pts = Math.min(20, Math.max(0, +host.querySelector('#iqPts').value || 0));
      const tj = Math.min(43, Math.max(0, +host.querySelector('#iqTj').value || 0));
      const dp = Math.min(5, Math.max(0, +host.querySelector('#iqDp').value || 0));
      cfg = { ...cfg, count: c, pass: p, pts, taj: tj, dayPts: dp, ...readFlags('g') };
      try { await store.setIqraCfg(cfg); toast('حُفظت إعدادات «اقرأ وارتقِ».'); onChange({ cfg, states }); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
      draw();
    };
    { // الترتيب: ما يحتاج متابعة يومية أولاً، والإعدادات آخراً
      const root = host.querySelector('.stack.iq'), order = ['🎧', '👥', '📊', '✅', '🚩', '🎙', '🗣', '📖', '⚙️'];
      if (root) [...root.children].sort((a, b) => { const i = (el) => { const t = el.querySelector('h2, h3')?.textContent.trim() || ''; const k = order.findIndex((e) => t.startsWith(e)); return k < 0 ? 99 : k; }; return i(a) - i(b); }).forEach((el) => root.append(el));
    }
    wireAudio(); wireGen(); wirePer(); wireReport();
    host.querySelector('#iqQ').oninput = (e) => { q = e.target.value.trim(); const pos = e.target.selectionStart; draw(); const i = host.querySelector('#iqQ'); i.focus(); i.setSelectionRange(pos, pos); };
    host.querySelector('#iqCls').onchange = (e) => { cls = e.target.value; draw(); };
    host.querySelectorAll('[data-pn]').forEach((b) => (b.onchange = async () => {
      const set = new Set(cfg.pns);
      b.checked ? set.add(b.dataset.pn) : set.delete(b.dataset.pn);
      cfg = { ...cfg, pns: [...set] };
      try { await store.setIqraCfg(cfg); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
      if (b.checked && !(b.dataset.pn in states)) states[b.dataset.pn] = await store.getIqra(b.dataset.pn).catch(() => null);
      onChange({ cfg, states });
      draw();
    }));
    host.querySelectorAll('[data-cur]').forEach((sel) => (sel.onchange = async () => {
      const pn = sel.dataset.cur, n = +sel.value; if (!n) return;
      const x = states[pn] || { mastered: {}, wrong: {}, sessions: [] };
      const patch = { cur: n, placed: true };
      try { await store.saveIqra(pn, patch); states[pn] = { ...x, ...patch }; toast(`صار درس ${byId[pn]?.name || ''} الحالي: ${ar(n)}.`); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
      draw();
    }));
    let audio = null;
    host.querySelectorAll('[data-r]').forEach((li) => {
      const [pn, id] = li.dataset.r.split('|');
      li.querySelector('[data-play]').onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = '…';
        try { const a = await store.getIqraRevAudio(pn, id); if (!a) throw new Error('لا يوجد تسجيل'); audio?.pause(); audio = new Audio(URL.createObjectURL(b64ToBlob(a.b64, a.mime))); await audio.play(); }
        catch (err) { toast('تعذّر التشغيل: ' + err.message); }
        b.disabled = false; b.textContent = '▶ استمع';
      };
      li.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = async () => {
        li.style.opacity = '.4';
        try { await store.decideIqraRev(pn, id, { status: b.dataset.dec }); revs = revs.filter((r) => !(r.pn === pn && r.id === id)); draw(); }
        catch (err) { li.style.opacity = ''; toast('تعذّر الحفظ: ' + err.message); }
      }));
    });
  }

  /* ---------- خيارات المساعدة (عامة أو لطالب) ---------- */
  const FLAGS = [['echo', '👂 «اسمع ثم كرّر» للكلمات الجديدة'], ['color', '🎨 تلوين الحركات'], ['ease', '⬇ تخفيف تلقائي عند التعثر'], ['big', '🔠 خط أكبر']];
  function flagBoxes(v, p) {
    return `<div class="iq-flags">${FLAGS.map(([k, t]) => `<label class="iq-tajtg"><input type="checkbox" id="${p}F_${k}" ${v[k] !== false && v[k] ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
  }
  const readFlags = (p) => Object.fromEntries(FLAGS.map(([k]) => [k, !!host.querySelector(`#${p}F_${k}`)?.checked]));
  function perForm(pn) {
    const v = effCfg(cfg, pn), own = cfg.per?.[pn] || {};
    return `<div class="iq-per stack" id="iqPer">
      <div class="row" style="justify-content:space-between"><b>⚙ إعدادات خاصة: ${esc(byId[pn].name)}</b><button class="btn sm ghost" type="button" id="perX">✕</button></div>
      <p class="small muted" style="margin:0">للطالب الضعيف جداً: كلمات أقل (٥–٨)، ونسبة إتقان أخف في البداية، وتجريد لمدة أطول، وخط أكبر.</p>
      <div class="row">
        <label class="field" style="min-width:120px">عدد الكلمات<input type="number" id="pC" min="3" max="40" value="${own.count ?? ''}" placeholder="${ar(cfg.count)} (العام)"></label>
        <label class="field" style="min-width:120px">نسبة الإتقان ٪<input type="number" id="pP" min="40" max="100" value="${own.pass ?? ''}" placeholder="${ar(cfg.pass)} (العام)"></label>
        <label class="field" style="min-width:140px">التجريد إلزامي حتى الدرس<input type="number" id="pT" min="0" max="43" value="${own.taj ?? ''}" placeholder="${ar(cfg.taj ?? IQ_DEFAULT.taj)} (العام)"></label>
      </div>
      ${flagBoxes(v, 'p')}
      <div class="row"><button class="btn primary" type="button" id="perS">حفظ لهذا الطالب</button>${cfg.per?.[pn] ? '<button class="btn ghost" type="button" id="perR">↺ كالإعدادات العامة</button>' : ''}</div>
    </div>`;
  }
  async function saveCfg(msg) { try { await store.setIqraCfg(cfg); if (msg) toast(msg); onChange({ cfg, states }); } catch (e) { toast('تعذّر الحفظ: ' + e.message); } }
  function wirePer() {
    host.querySelectorAll('[data-per]').forEach((b) => (b.onclick = () => { editPn = editPn === b.dataset.per ? null : b.dataset.per; draw(); host.querySelector('#iqPer')?.scrollIntoView({ block: 'nearest' }); }));
    host.querySelectorAll('[data-unease]').forEach((b) => (b.onclick = async () => {
      const pn = b.dataset.unease;
      try { await store.saveIqra(pn, { ease: 0, alert: null }); states[pn] = { ...states[pn], ease: 0, alert: null }; toast('أُعيد عدد الكلمات الطبيعي.'); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
      draw();
    }));
    const f = host.querySelector('#iqPer'); if (!f) return;
    f.querySelector('#perX').onclick = () => { editPn = null; draw(); };
    f.querySelector('#perS').onclick = async () => {
      const num = (id, lo, hi) => { const v = f.querySelector(id).value.trim(); return v === '' ? null : Math.min(hi, Math.max(lo, +v || lo)); };
      const o = { count: num('#pC', 3, 40), pass: num('#pP', 40, 100), taj: num('#pT', 0, 43), ...readFlags('p') };
      FLAGS.forEach(([k]) => { if (o[k] === !!({ ...IQ_DEFAULT, ...cfg })[k]) delete o[k]; });
      Object.keys(o).forEach((k) => o[k] == null && delete o[k]);
      const per = { ...(cfg.per || {}) }; if (Object.keys(o).length) per[editPn] = o; else delete per[editPn];
      cfg = { ...cfg, per };
      await saveCfg(`حُفظت إعدادات ${byId[editPn]?.name || 'الطالب'} الخاصة.`); editPn = null; draw();
    };
    const r = f.querySelector('#perR'); if (r) r.onclick = async () => { const per = { ...(cfg.per || {}) }; delete per[editPn]; cfg = { ...cfg, per }; await saveCfg('عاد للإعدادات العامة.'); editPn = null; draw(); };
  }

  /* ---------- تقرير الأسبوع، ورسالة صوتية للطالب، ومشاركة مع ولي الأمر ---------- */
  function weekOf(pn) {
    const x = states[pn] || {}, from = addDays(today(), -6);
    const D = (x.sessions || []).filter((z) => z.kind === 'daily' && z.day >= from);
    const sc = D.filter((z) => z.pct != null);
    return { x, act: (x.days || []).filter((d) => d >= from).length, n: D.length, avg: sc.length ? Math.round(sc.reduce((a, z) => a + z.pct, 0) / sc.length) : null,
      mastered: Object.values(x.mastered || {}).filter((m) => !m.skip && m.day >= from).length, conf: confusions(x), srs: Object.keys(x.srs || {}).length };
  }
  function reportCard(enabled) {
    return `<div class="card stack"><h3>📊 تقرير الأسبوع</h3>
      ${enabled.length ? `<p class="small muted" style="margin:0">آخر ٧ أيام. «يخلط في» من لعبة تمييز الحروف، و«متعثرة» كلمات تعود إليه في المراجعة.</p><ul class="iq-rep">${enabled.map((s) => { const w = weekOf(s.id), nr = note?.pn === s.id ? note : null;
        return `<li><div class="row" style="justify-content:space-between"><b>${esc(s.name)}</b><span class="small muted">⭐ ${ar(w.x.stars || 0)}${w.x.streak?.n ? ` · 🔥 ${ar(w.x.streak.n)}` : ''}</span></div>
          <div class="iq-repst small"><span>أيام التدريب <b>${ar(w.act)}</b>/٧</span><span>دروس يومية <b>${ar(w.n)}</b></span><span>المعدل <b>${w.avg == null ? '—' : pctTxt(w.avg)}</b></span><span>أتقن <b>${ar(w.mastered)}</b></span><span>متعثرة <b>${ar(w.srs)}</b></span></div>
          ${w.conf.length ? `<div class="small">يخلط في: ${w.conf.slice(0, 4).map((c) => `<b class="iq-cf">${esc(c.c)}</b>${c.as ? ` ← ${esc(c.as)}` : ''} <span class="muted">(${pctTxt((c.ok / c.n) * 100)})</span>`).join('، ')}</div>` : ''}
          ${w.x.alert ? `<div class="iq-alert small">⬇ ${esc(w.x.alert.msg)}</div>` : ''}
          <div class="row" style="gap:6px">
            ${nr?.rec ? '<button class="btn sm danger" type="button" data-nstop>⏹ إيقاف</button>' : nr?.blob ? `<button class="btn sm" type="button" data-nplay>▶</button><button class="btn sm primary" type="button" data-nsend="${esc(s.id)}">✓ أرسل للطالب</button><button class="btn sm ghost" type="button" data-ncancel>✕</button>` : `<button class="btn sm" type="button" data-nrec="${esc(s.id)}">🎙 رسالة صوتية${w.x.note ? (w.x.note.heard ? ' (سمع السابقة ✓)' : ' (السابقة لم تُسمع)') : ''}</button>`}
            <button class="btn sm ghost" type="button" data-share="${esc(s.id)}">📤 لولي الأمر</button>
          </div></li>`; }).join('')}</ul>` : '<p class="small muted" style="margin:0">لا طلاب مختارون بعد.</p>'}</div>`;
  }
  function shareText(pn) {
    const s = byId[pn], w = weekOf(pn), L = lessonByN(w.x.cur);
    return [`تقرير «اقرأ وارتقِ» الأسبوعي — ${s.name}`,
      L ? `الدرس الحالي: ${ar(L.n)}. ${L.t}` : '',
      `أيام التدريب هذا الأسبوع: ${ar(w.act)} من ٧`,
      w.avg != null ? `معدل الدروس اليومية: ${pctTxt(w.avg)}` : '',
      `الدروس التي أتقنها من الكتاب: ${ar(Object.values(w.x.mastered || {}).filter((m) => !m.skip).length)}`,
      w.conf.length ? `يحتاج تدريباً على الحروف: ${w.conf.slice(0, 4).map((c) => c.c).join('، ')}` : '',
      `نجومه: ${ar(w.x.stars || 0)} ⭐`,
      'شجّعوه على التدريب اليومي ولو خمس دقائق، جزاكم الله خيراً.'].filter(Boolean).join('\n');
  }
  function wireReport() {
    host.querySelectorAll('[data-share]').forEach((b) => (b.onclick = async () => {
      const text = shareText(b.dataset.share);
      try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    }));
    host.querySelectorAll('[data-nrec]').forEach((b) => (b.onclick = async () => {
      const pn = b.dataset.nrec;
      try {
        const r = await recordClip({ maxSec: 15, silenceMs: 2500 });
        note = { pn, rec: r }; draw();
        const blob = await r.done; note = { pn, blob }; draw(); playBlob(blob);
      } catch (e) { note = null; toast('تعذّر التسجيل: ' + (e.message || e.name)); draw(); }
    }));
    host.querySelector('[data-nstop]')?.addEventListener('click', () => note?.rec?.stop());
    host.querySelector('[data-nplay]')?.addEventListener('click', () => note?.blob && playBlob(note.blob));
    host.querySelector('[data-ncancel]')?.addEventListener('click', () => { note = null; draw(); });
    host.querySelector('[data-nsend]')?.addEventListener('click', async (e) => {
      const pn = e.currentTarget.dataset.nsend, b = e.currentTarget; b.disabled = true;
      try {
        const key = 'note_' + pn, at = new Date().toISOString();
        await store.saveIqraAudio(key, { b64: await blobToB64(note.blob), mime: 'audio/wav', at });
        const nt = { key, at, heard: false };
        await store.saveIqra(pn, { note: nt }); states[pn] = { ...(states[pn] || {}), note: nt };
        note = null; toast('أُرسلت الرسالة الصوتية، وتظهر للطالب في تبويبه.');
      } catch (err) { b.disabled = false; toast('تعذّر الإرسال: ' + err.message); return; }
      draw();
    });
  }

  /* ---------- الأصوات: استوديو التسجيل، والمعاينة، والبلاغات ---------- */
  const plan = () => recordingPlan();
  function studioCard() {
    const G = plan();
    const req = G.filter((g) => !g.optional), done = (g) => g.items.filter((x) => hasRec(x.s)).length;
    const tot = req.reduce((n, g) => n + g.items.length, 0), dn = req.reduce((n, g) => n + done(g), 0);
    return `<div class="card stack">
      <div class="row" style="justify-content:space-between"><h3>🎙 استوديو التسجيل</h3><span class="pill ${dn >= tot ? 'ok' : 'warn'}">${ar(dn)} / ${ar(tot)}</span></div>
      <p class="small muted" style="margin:0">سجّل «اللبنات» بصوتك مرة واحدة: أسماء الحروف، وأسماء الحركات، ومقاطع جداول الدروس. منها يُبنى صوت التجريد كله، وتسمعها الطلاب في الدروس. الكلمات القرآنية بصوت القارئ تلقائياً. سجّل في مكان هادئ، واضغط 🎙 ثم انطق واسكت فيتوقف وحده.</p>
      <div class="iq-groups">${G.map((g, gi) => { const d = done(g); return `<div class="iq-grp"><div><b>${ar(gi + 1)}. ${esc(g.t)}</b>${g.optional ? ' <span class="small muted">(اختياري)</span>' : ''}<div class="small muted">${ar(d)} من ${ar(g.items.length)}</div></div>
        <button class="btn sm ${d < g.items.length ? 'primary' : ''}" type="button" data-grp="${gi}">${d === 0 ? 'ابدأ' : d < g.items.length ? 'تابع' : 'راجع'}</button>
        <div class="meter"><i style="width:${g.items.length ? (d / g.items.length) * 100 : 0}%"></i></div></div>`; }).join('')}</div>
    </div>`;
  }
  function flagsCard() {
    const by = {}; flags.forEach((f) => { (by[f.key] = by[f.key] || { ...f, n: 0, who: [] }).n++; by[f.key].who.push(f.name); });
    const L = Object.values(by);
    return `<div class="card stack"><div class="row" style="justify-content:space-between"><h3>🚩 بلاغات «النطق خاطئ» <span class="pill ${L.length ? 'warn' : 'mute'}">${ar(L.length)}</span></h3></div>
      ${L.length ? `<ul class="iq-prev">${L.map((f) => `<li data-fk="${esc(f.key)}"><b lang="ar">${esc(f.t)}</b><span class="small muted">الدرس ${ar(f.n || 0)} · ${esc(f.who.slice(0, 3).join('، '))}</span>
        <span class="row" style="gap:6px"><button class="btn sm" type="button" data-fplay>▶ الحالي</button><button class="btn sm primary" type="button" data-frec>🎙 سجّل بصوتك</button><button class="btn sm ghost" type="button" data-fok>تجاهل</button></span></li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">لا بلاغات. يظهر هنا ما يُبلغ عنه الطلاب بزر «🚩 النطق خاطئ».</p>'}</div>`;
  }
  function previewCard() {
    const L = lessonByN(prevN);
    const items = (L?.items || []).map((x, i) => ({ ...itemOf(x, L.n), i, n: L.n }));
    return `<div class="card stack"><h3>📖 معاينة الدروس وإعادة التسجيل</h3>
      <label class="field">الدرس<select id="iqPv">${LESSONS.filter((l) => l.items.length).map((l) => `<option value="${l.n}" ${l.n === prevN ? 'selected' : ''}>${ar(l.n)}. ${esc(l.t)}</option>`).join('')}</select></label>
      <ul class="iq-prev">${items.map((x) => { const k = sourcesFor(x).kind; return `<li data-pi="${x.i}"><b lang="ar">${esc(x.t)}</b><span class="row" style="gap:6px"><span class="pill ${k === 'teacher' ? 'rec' : k === 'reciter' ? 'ok' : 'mute'}">${esc(KIND_LABEL[k])}</span>
        <button class="btn sm" type="button" data-pplay>▶</button><button class="btn sm" type="button" data-prec>🎙</button>${hasRec(x.s) ? '<button class="btn sm danger" type="button" data-pdel title="احذف تسجيلك">🗑</button>' : ''}</span></li>`; }).join('')}</ul></div>`;
  }
  function wireAudio() {
    host.querySelectorAll('[data-grp]').forEach((b) => (b.onclick = () => { const g = plan()[+b.dataset.grp]; const first = Math.max(0, g.items.findIndex((x) => !hasRec(x.s))); openStudio(g.items, g.t, g.note, first); }));
    const pv = host.querySelector('#iqPv'); if (pv) pv.onchange = () => { prevN = +pv.value; draw(); };
    const L = lessonByN(prevN);
    host.querySelectorAll('[data-pi]').forEach((li) => {
      const it = { ...itemOf(L.items[+li.dataset.pi], L.n), n: L.n };
      li.querySelector('[data-pplay]').onclick = () => playItem(it);
      li.querySelector('[data-prec]').onclick = () => openStudio([it], 'إعادة تسجيل · الدرس ' + ar(L.n), '');
      const d = li.querySelector('[data-pdel]'); if (d) d.onclick = async () => { await deleteRecording(it.s).catch((e) => toast(e.message)); draw(); };
    });
    host.querySelectorAll('[data-fk]').forEach((li) => {
      const f = flags.find((x) => x.key === li.dataset.fk); const it = { t: f.t, s: f.s, k: 'word', n: f.n };
      li.querySelector('[data-fplay]').onclick = () => playItem(it);
      li.querySelector('[data-frec]').onclick = () => openStudio([it], 'بلاغ نطق · الدرس ' + ar(f.n || 0), '', 0, async () => { await store.deleteIqraFlags(f.key).catch(() => {}); flags = flags.filter((x) => x.key !== f.key); });
      li.querySelector('[data-fok]').onclick = async () => { await store.deleteIqraFlags(f.key).catch(() => {}); flags = flags.filter((x) => x.key !== f.key); draw(); };
    });
  }
  /* --- الصوت المولَّد --- */
  const SAMPLES = ['بَ', 'بِ', 'بُ', 'أَمْ', 'أَبْ', 'أَبَّ', 'بًا', 'بٌ', 'بٍ', 'بَا', 'بُو', 'بِي', 'فَرْ', 'فَرْقًا', 'يَشْ', 'يَشَّ', 'قَافْ', 'فَتْحَة', 'سَاكِنَة', 'فَتْحَتَان', 'كَتَبَ', 'ٱلشَّمْسُ'];
  let genV = null, genJob = null;
  function genCard() {
    genV = genV || cfg.genVoice || 'ar-XA-Wavenet-B';
    return `<div class="card stack">
      <div class="row" style="justify-content:space-between"><h3>🗣 الصوت المولَّد</h3><span class="pill ${cfg.genOn ? 'ok' : 'mute'}">${cfg.genOn ? 'مفعّل: ' + esc((GEN_VOICES.find((v) => v[0] === cfg.genVoice) || [])[1] || '') : 'غير مفعّل'}</span></div>
      <p class="small muted" style="margin:0">صوت عربي عالي الجودة من Google يُولَّد مرة ويُحفظ، ويُسمع على كل الأجهزة (ومنها آيفون). يُستعمل لما ليس له تسجيل منك ولا صوت قارئ: المقاطع وأجزاء التجريد. اختر صوتاً واستمع للعيّنة، ثم اعتمده.</p>
      <div class="row" role="radiogroup">${GEN_VOICES.map(([v, l]) => `<button type="button" class="chip iq-tg${v === genV ? ' sel' : ''}" data-gv="${v}">${l}</button>`).join('')}</div>
      <div class="iq-grid">${SAMPLES.map((t) => `<button type="button" class="iq-cell" data-gs="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" type="button" id="gOn">${cfg.genOn && cfg.genVoice === genV ? '✓ معتمد' : 'اعتمد هذا الصوت'}</button>
        ${cfg.genOn ? '<button class="btn" type="button" id="gAll">ولّد كل أصوات الكتاب مسبقاً</button><button class="btn ghost" type="button" id="gOff">إيقاف الصوت المولَّد</button>' : ''}</div>
      <div class="small muted" id="gMsg"></div></div>`;
  }
  /** كل النصوص التي قد تُنطق بالصوت المولَّد: اللبنات، وأجزاء التجريد، وما ليس له صوت قارئ */
  function allGenTexts() {
    const set = new Set();
    recordingPlan().forEach((g) => g.items.forEach((x) => set.add(normText(x.s))));
    PRAISE.concat(GAME_TEXTS()).forEach((t) => set.add(normText(t)));
    LESSONS.forEach((L) => L.items.forEach((x) => {
      const it = itemOf(x, L.n);
      if (!sourcesFor(it).kind.match(/reciter|teacher/)) set.add(normText(it.s));
      if (L.n >= 4) tajSteps(it.s).forEach((sp) => { if (sp.silent) return; if (sp.syl) set.add(normText(sp.syl)); if (sp.cum) set.add(normText(sp.cum.replace(/\u0671/g, 'ا'))); });
    }));
    return [...set].filter((t) => t && t.length <= 120);
  }
  function wireGen() {
    host.querySelectorAll('[data-gv]').forEach((b) => (b.onclick = () => { genV = b.dataset.gv; draw(); }));
    host.querySelectorAll('[data-gs]').forEach((b) => (b.onclick = () => { const m = host.querySelector('#gMsg'); if (m) m.textContent = 'يُولَّد الصوت أول مرة (ثوانٍ)…'; playGenSample(b.dataset.gs, genV).done.then(() => { const m2 = host.querySelector('#gMsg'); if (m2 && m2.textContent.startsWith('يُولَّد')) m2.textContent = ''; }); }));
    const on = host.querySelector('#gOn');
    if (on) on.onclick = async () => { cfg = { ...cfg, genOn: true, genVoice: genV, genRate: 0.8 }; setGen({ on: true, voice: genV, rate: 0.8 }); try { await store.setIqraCfg(cfg); toast('اعتُمد الصوت المولَّد.'); } catch (e) { toast('تعذّر الحفظ: ' + e.message); } draw(); };
    const off = host.querySelector('#gOff');
    if (off) off.onclick = async () => { cfg = { ...cfg, genOn: false }; setGen({ on: false }); try { await store.setIqraCfg(cfg); } catch {} draw(); };
    const all = host.querySelector('#gAll');
    if (all) all.onclick = async () => {
      if (genJob) { genJob.stop = true; return; }
      const T = allGenTexts(), msg = () => host.querySelector('#gMsg');
      genJob = { stop: false }; all.textContent = '⏸ إيقاف';
      let done = 0, made = 0;
      for (let i = 0; i < T.length && !genJob.stop; i += 30) {
        try { const r = await ttsGen(T.slice(i, i + 30), { voice: cfg.genVoice, rate: cfg.genRate || 0.8 }); made += r.made || 0; }
        catch (e) { if (msg()) msg().textContent = 'توقف: ' + e.message; break; }
        done = Math.min(T.length, i + 30);
        if (msg()) msg().textContent = `جارٍ التوليد: ${ar(done)} من ${ar(T.length)} (جديد ${ar(made)}). لا تُغلق الصفحة.`;
      }
      if (msg() && done >= T.length) msg().textContent = `✓ اكتمل: ${ar(T.length)} صوتاً جاهزاً.`;
      genJob = null; const b = host.querySelector('#gAll'); if (b) b.textContent = 'ولّد كل أصوات الكتاب مسبقاً';
    };
  }
  function openStudio(list, title, note, start = 0, onSaved = null) {
    let i = start, blob = null, rec = null, msg = '';
    const close = () => { rec?.stop(); stopAudio(); studio = null; draw(); };
    studio = { paint: () => {
      const it = list[i];
      host.innerHTML = `<div class="card stack iq iq-studio">
        <div class="row" style="justify-content:space-between"><span class="small muted">🎙 ${esc(title)} · ${ar(i + 1)} من ${ar(list.length)}</span><button class="btn sm ghost" type="button" id="sX">✕ إنهاء</button></div>
        ${note ? `<p class="iq-hint" style="margin:0">💡 ${esc(note)}</p>` : ''}
        <div class="iq-word" lang="ar">${esc(it.t)}</div>
        ${it.s !== it.t ? `<div class="iq-src">انطق: <b style="font:28px var(--f-quran)">${esc(it.s)}</b></div>` : ''}
        <div class="iq-src">${hasRec(it.s) ? '<span class="pill rec">✓ مسجّل بصوتك</span>' : '<span class="pill mute">غير مسجّل</span>'}</div>
        <div class="iq-ctrl">
          <button class="btn" type="button" id="sPrev" ${i ? '' : 'disabled'}>→ السابق</button>
          <button class="iq-mic${rec ? ' on' : ''}" type="button" id="sRec" aria-label="سجّل">🎙</button>
          <button class="btn" type="button" id="sNext" ${i < list.length - 1 ? '' : 'disabled'}>التالي ←</button>
        </div>
        <div class="iq-level"><i id="sLv"></i></div>
        <div class="row" style="justify-content:center">
          <button class="btn" type="button" id="sPlay" ${blob ? '' : 'disabled'}>▶ استمع لتسجيلك</button>
          <button class="btn primary" type="button" id="sSave" ${blob ? '' : 'disabled'}>✓ احفظ وانتقل</button>
          <button class="btn ghost" type="button" id="sCur">🔊 الصوت الحالي</button>
        </div>
        <div class="iq-msg" id="sMsg">${esc(msg || (blob ? 'استمع، ثم احفظ أو أعد التسجيل.' : 'اضغط 🎙 ثم انطق، واسكت لحظة فيتوقف التسجيل وحده.'))}</div>
      </div>`;
      host.querySelector('#sX').onclick = close;
      host.querySelector('#sPrev').onclick = () => { if (i) { i--; blob = null; msg = ''; studio.paint(); } };
      host.querySelector('#sNext').onclick = () => { if (i < list.length - 1) { i++; blob = null; msg = ''; studio.paint(); } };
      host.querySelector('#sCur').onclick = () => playItem(it);
      host.querySelector('#sPlay').onclick = () => blob && playBlob(blob);
      host.querySelector('#sRec').onclick = async () => {
        if (rec) return rec.stop();
        stopAudio(); blob = null;
        const lv = () => host.querySelector('#sLv');
        try { rec = await recordClip({ onLevel: (l) => { const e = lv(); if (e) e.style.width = Math.round(l * 100) + '%'; } }); }
        catch (e) { msg = 'تعذّر فتح الميكروفون: ' + (e.message || e.name); studio.paint(); return; }
        msg = 'أستمع… انطق الآن'; studio.paint();
        try { blob = await rec.done; msg = ''; rec = null; studio.paint(); playBlob(blob); }
        catch (e) { rec = null; blob = null; msg = e.message; studio.paint(); }
      };
      host.querySelector('#sSave').onclick = async (e) => {
        if (!blob) return; e.currentTarget.disabled = true;
        try { await saveRecording(it.s, blob); await onSaved?.(); blob = null; msg = '✓ حُفظ.'; if (i < list.length - 1) { i++; msg = ''; } studio.paint(); }
        catch (err) { msg = 'تعذّر الحفظ: ' + err.message; studio.paint(); }
      };
    } };
    studio.paint();
  }
  return () => { alive = false; };
}
