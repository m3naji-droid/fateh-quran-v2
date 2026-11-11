// تبويب «اقرأ وارتقِ»: تدريب الطلاب المحتاجين لعناية مكثفة على نطق الحروف والكلمات.
// اختبار تكيّفي لتحديد المستوى، ثم درس يومي يُختبر فيه الطالب بنطق كل كلمة تظهر أمامه،
// وتمرين حر على أي درس. التحقق: التعرف الفوري للكلمات، وخادم التجويد للحروف والحركات،
// وما لم يتأكد منه النظام يصل إلى المعلم ليسمعه ويحكم عليه.
import { store, blobToB64, b64ToBlob } from './store.js';
import { toArabicDigits as ar } from './quran.js';
import { RecitationSession, hasRecorder, micErrorText } from './speech.js';
import { aiEnabled, phonemes } from './tajweed-ai.js';
import { judgePhonemes, judgeTranscript } from './phon.js';
import { LESSONS, CONCEPTS, itemOf, lessonByN } from './iqra-data.js';
import { audioIndex, playItem, playSeq, stopAudio, sourcesFor, keyOf, hasRec, KIND_LABEL, prefetch, probeReciter, recordingPlan, recordClip, saveRecording, deleteRecording, playBlob } from './iqra-audio.js';
import { tajSteps } from './iqra-taj.js';

export const IQ_DEFAULT = { count: 15, pass: 85, pts: 3, taj: 13 };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // توقيت مكة
const ready = () => LESSONS.filter((l) => l.items.length);
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const pctTxt = (p) => ar(Math.round(p)) + '٪';

export async function iqraCfg() {
  let c = null;
  try { c = await store.getIqraCfg(); } catch {}
  return { ...IQ_DEFAULT, pns: [], ...(c || {}) };
}

/** نقاط لوحة الشرف: لكل درس أتقنه الطالب في الدرس اليومي (لا في اختبار المستوى) */
export function iqraBonus(states, pts = IQ_DEFAULT.pts) {
  const out = [];
  Object.entries(states || {}).forEach(([pn, st]) => Object.values(st?.mastered || {}).forEach((m) => { if (m && !m.skip && m.at) out.push({ pn, bonus: pts, createdAt: m.at }); }));
  return out;
}

/* ---------- تسجيل كلمة واحدة: يتوقف وحده بعد سكوت الطالب ---------- */
function recordOnce({ onLevel, onLive, expect }) {
  const s = new RecitationSession({ maxSeconds: 9, onLevel: (l) => tick(l), onTranscript: (t) => { onLive?.(t); if (expect && expect(t)) setTimeout(stop, 350); } });
  let voiced = false, lastLoud = 0, t0 = Date.now(), stopped = false, resolve;
  const done = new Promise((r) => (resolve = r));
  const stop = async () => { if (stopped) return; stopped = true; const r = await s.stop(); resolve(r); };
  function tick(l) {
    onLevel?.(l);
    const now = Date.now();
    if (l > 0.14) { voiced = true; lastLoud = now; }
    if (voiced && now - lastLoud > 1100) stop();
    if (!voiced && now - t0 > 6000) stop();
  }
  s.onAutoStop = () => { stopped = true; s._done?.then(resolve); };
  return { start: () => s.start(), stop, done, cancel: () => { stopped = true; s.cancel(); resolve({ blob: null, transcript: '' }); } };
}

/** يحكم على نطق عنصر: التعرف الفوري للكلمات وأسماء الحروف، ثم خادم التجويد. */
async function judge(item, lessonN, rec) {
  const names = item.k === 'name';
  if (item.k === 'word' || names) {
    const j = judgeTranscript(item.s, rec.transcript, { names });
    if (j.ok) return { ok: true, via: 'asr', score: j.score };
  }
  if (!rec.blob || rec.blob.size < 1500) return { ok: false, empty: !rec.transcript };
  if (!aiEnabled()) return { ok: false, unsure: true };
  try {
    const pred = await phonemes(rec.blob);
    if (!pred) return { ok: false, empty: true };
    const j = judgePhonemes(item.s, pred, { strict: item.k === 'syl' && !names });
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
  let st = null, cfg = null, alive = true, runner = null;
  host.innerHTML = '<div class="loading">جارٍ تحميل دروسك…</div>';
  const save = (patch) => { Object.assign(st, patch); return store.saveIqra(me.id, patch).catch((e) => { console.warn('iqra save', e); toast('تعذّر حفظ تقدمك. تحقق من الاتصال.'); }); };

  (async () => {
    probeReciter();
    [cfg, st] = await Promise.all([iqraCfg(), store.getIqra(me.id).catch(() => null), audioIndex()]);
    st = st || { placed: false, cur: 1, mastered: {}, wrong: {}, sessions: [] };
    st.mastered = st.mastered || {}; st.wrong = st.wrong || {}; st.sessions = st.sessions || [];
    await settleAwaiting();
    if (alive) home();
  })().catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });

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
      s.okT = okT; s.pct = pct; s.status = pct >= (s.pass || cfg.pass) ? 'pass' : 'fail';
      const redo = R.filter((r) => r.status !== 'ok').map((r) => r.i);
      applyResult(s, [...(s.wrongIdx || []), ...redo]);
      changed = true;
      s.toldStudent = false;
    }
    if (changed) await save({ sessions: st.sessions, mastered: st.mastered, wrong: st.wrong, cur: st.cur });
  }
  function applyResult(s, wrongIdx) {
    if (s.status === 'pass') {
      st.mastered[s.n] = { pct: s.pct, at: new Date().toISOString(), day: s.day };
      delete st.wrong[s.n];
      if (st.cur === s.n) st.cur = nextLesson(s.n);
    } else if (s.status === 'fail') st.wrong[s.n] = [...new Set(wrongIdx)].slice(0, 30);
  }
  const nextLesson = (n) => (LESSONS.find((l) => l.n > n) || { n: n + 1 }).n;

  function home() {
    if (!alive) return;
    runner?.cancel?.(); runner = null;
    if (!st.placed) return placementIntro();
    const L = lessonByN(st.cur);
    const day = today();
    const todays = st.sessions.filter((s) => s.day === day && s.kind !== 'place');
    const lastToday = todays[todays.length - 1];
    const doneN = Object.values(st.mastered).filter((m) => !m.skip).length;
    const total = LESSONS.length;
    const fresh = st.sessions.filter((s) => s.status !== 'await' && s.toldStudent === false);
    host.innerHTML = `<div class="iq stack">
      ${fresh.length ? `<div class="iq-note ok" role="status">✓ سمع معلمك كلماتك في ${fresh.map((s) => 'الدرس ' + ar(s.n)).join('، ')}: ${fresh.map((s) => s.status === 'pass' ? `أتقنتَ الدرس ${ar(s.n)} (${pctTxt(s.pct)})` : `تعيد الدرس ${ar(s.n)} (${pctTxt(s.pct)})`).join('، ')}.</div>` : ''}
      <div class="card iq-today">
        <div class="iq-head"><span class="iq-n">${ar(st.cur)}</span><div><span class="small muted">${L ? `درسك الحالي · ${esc(CONCEPTS.find((c) => c.c === L.c)?.t || '')} · ص ${ar(L.p)}` : ''}</span><h2>${L ? esc(L.t) : 'أتممت الدروس'}</h2></div></div>
        ${L?.hint ? `<p class="iq-hint">💡 ${esc(L.hint)}</p>` : ''}
        ${!L ? '<p>ما شاء الله! أتممت دروس الكتاب كلها. واصل التمرين الحر للمراجعة.</p>'
          : !L.items.length ? '<p class="muted">هذا الدرس قيد الإعداد وسيُضاف قريباً بإذن الله. راجع الدروس السابقة في التمرين الحر.</p>'
          : lastToday?.status === 'await' ? `<p>أنهيت درس اليوم: ${ar(lastToday.ok)} صحيحة من ${ar(lastToday.total)}، و${ar(lastToday.pend)} ${lastToday.pend === 1 ? 'كلمة' : 'كلمات'} ينتظر معلمك أن يسمعها ليحكم عليها. ⏳</p>`
          : lastToday ? `<p>${lastToday.status === 'pass' ? `🎉 أتقنت الدرس اليوم (${pctTxt(lastToday.pct)}). درسك الجديد غداً بإذن الله.` : `نتيجتك اليوم ${pctTxt(lastToday.pct)}، والمطلوب ${pctTxt(lastToday.pass || cfg.pass)}. تدرّب على الكلمات التي أخطأت فيها، وتعيد الدرس غداً بإذن الله.`}</p>`
          : `<p class="muted" style="margin:0">ستظهر أمامك ${ar(Math.min(cfg.count, L.items.length))} ${cfg.count > 10 ? 'كلمة' : 'كلمات'} من الدرس: استمع إن شئت، ثم اضغط الميكروفون وانطقها. تتقن الدرس إذا أصبت ${pctTxt(cfg.pass)} منها.</p>
             <div class="row"><button class="btn primary iq-big" type="button" id="iqGo">🎤 ابدأ درس اليوم</button></div>`}
        ${(st.wrong[st.cur] || []).length && L?.items.length ? `<div class="iq-wrong"><b class="small">كلمات تحتاج تدريباً:</b> ${(st.wrong[st.cur] || []).map((i) => L.items[i] && `<button type="button" class="iq-chip" data-pw="${i}">${esc(itemOf(L.items[i], L.n).t)}</button>`).filter(Boolean).join('')}</div>` : ''}
      </div>
      <div class="card stack">
        <div class="row" style="justify-content:space-between"><h3>طريقك في الكتاب</h3><span class="small muted">أتقنت ${doneN === 0 ? 'صفراً' : doneN === 1 ? 'درساً واحداً' : doneN === 2 ? 'درسين' : ar(doneN) + (doneN > 10 ? ' درساً' : ' دروس')} من ${ar(total)} · ${ar(cfg.pts)} نقاط لكل درس في لوحة الشرف</span></div>
        <div class="iq-path">${LESSONS.map((l) => { const m = st.mastered[l.n]; const cls = l.n === st.cur ? 'cur' : m ? (m.skip ? 'skip' : 'done') : !l.items.length ? 'soon' : l.n < st.cur ? 'skip' : ''; return `<span class="iq-dot ${cls}" title="${esc(l.t)}${!l.items.length ? ' (قريباً)' : ''}">${m && !m.skip ? '✓' : ar(l.n)}</span>`; }).join('')}</div>
      </div>
      <div class="card stack" id="iqFree"></div>
      ${st.sessions.filter((s) => s.kind !== 'place').length ? `<div class="card"><h3 style="margin-bottom:8px">آخر دروسك</h3><ul class="iq-log">${st.sessions.filter((s) => s.kind !== 'place').slice(-6).reverse().map((s) => `<li><span>الدرس ${ar(s.n)} · ${esc(lessonByN(s.n)?.t || '')}</span><span class="small muted">${esc(s.day)}</span><span class="pill ${s.status === 'pass' ? 'ok' : s.status === 'await' ? 'warn' : 'bad'}">${s.status === 'pass' ? 'أتقن' : s.status === 'await' ? 'عند المعلم' : 'يعيد'} ${s.pct != null ? pctTxt(s.pct) : ''}</span></li>`).join('')}</ul></div>` : ''}
    </div>`;
    if (fresh.length) { fresh.forEach((s) => (s.toldStudent = true)); save({ sessions: st.sessions }); if (fresh.some((s) => s.status === 'pass')) confetti(); }
    const go = host.querySelector('#iqGo');
    if (go) go.onclick = () => runDaily(L);
    host.querySelectorAll('[data-pw]').forEach((b) => (b.onclick = () => practiceItem(L, +b.dataset.pw)));
    drawFree(host.querySelector('#iqFree'));
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
    if (freeTaj == null || freeTajN !== freeN) { freeTaj = L.n >= 4 && L.n <= (cfg.taj ?? IQ_DEFAULT.taj); freeTajN = freeN; }
    if (!hasSyl) freeK = 'word'; if (!hasWord) freeK = 'syl';
    box.innerHTML = `<div class="row" style="justify-content:space-between"><h3>🎯 تمرين حر</h3><span class="small muted">بلا درجات: اختر درساً، ثم الحروف أو الكلمات، واضغط أيّها لتتمرن عليه</span></div>
      <label class="field">الدرس<select id="iqFL">${R.map((l) => `<option value="${l.n}" ${l.n === freeN ? 'selected' : ''}>${ar(l.n)}. ${esc(l.t)}</option>`).join('')}</select></label>
      <div class="row" role="radiogroup">${hasSyl ? `<button type="button" class="chip iq-tg${freeK === 'syl' ? ' sel' : ''}" data-fk="syl" role="radio" aria-checked="${freeK === 'syl'}">الحروف</button>` : ''}${hasWord ? `<button type="button" class="chip iq-tg${freeK === 'word' ? ' sel' : ''}" data-fk="word" role="radio" aria-checked="${freeK === 'word'}">الكلمات</button>` : ''}</div>
      ${L.n >= 4 ? `<label class="iq-tajtg"><input type="checkbox" id="iqFT" ${freeTaj ? 'checked' : ''}> بالتجريد (حرفاً حرفاً كما في الكتاب)</label>` : ''}
      <div class="iq-grid">${items.filter((x) => grp(x) === freeK).map((x) => `<button type="button" class="iq-cell" data-fi="${x.i}">${esc(x.t)}</button>`).join('')}</div>`;
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
      if (okN < Math.ceil(items.length * 0.67)) { startN = Math.min(...res.filter((r) => !r.ok).map((r) => r.item.n)); break; }
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

  /* --- الدرس اليومي --- */
  async function runDaily(L) {
    const items = pickDaily(L, cfg.count, st.wrong[L.n] || []).map((x) => ({ ...x, n: L.n }));
    const sid = 's' + Date.now().toString(36);
    const res = await run({ mode: 'daily', items, title: `درس اليوم · ${ar(L.n)}. ${L.t}`, sid, taj: L.n >= 4 && L.n <= (cfg.taj ?? IQ_DEFAULT.taj) ? 'must' : null });
    if (!res) return home();
    const total = res.length, ok = res.filter((r) => r.ok).length, pend = res.filter((r) => r.pending).length;
    const pct = Math.round((ok / total) * 100);
    const s = { id: sid, kind: 'daily', n: L.n, day: today(), total, ok, pend, pct, pass: cfg.pass, at: new Date().toISOString(),
      wrongIdx: res.filter((r) => !r.ok && !r.pending).map((r) => r.item.i) };
    if (!pend) s.status = pct >= cfg.pass ? 'pass' : 'fail';
    else if (((ok + pend) / total) * 100 < cfg.pass) s.status = 'fail';
    else s.status = 'await';
    if (s.status !== 'await') applyResult(s, [...s.wrongIdx, ...res.filter((r) => r.pending).map((r) => r.item.i)]);
    st.sessions.push(s);
    await save({ sessions: st.sessions.slice(-40), mastered: st.mastered, wrong: st.wrong, cur: st.cur });
    if (s.status === 'pass') confetti();
    host.innerHTML = `<div class="card stack iq" style="text-align:center;align-items:center">
      <div class="iq-score ${s.status}">${pctTxt(pct)}</div>
      <h2>${s.status === 'pass' ? 'أحسنت! أتقنت الدرس 🎉' : s.status === 'await' ? 'أنهيت درس اليوم' : 'تحتاج مزيداً من التدريب'}</h2>
      <p style="margin:0">${ar(ok)} صحيحة من ${ar(total)}${pend ? `، و${ar(pend)} ينتظر معلمك أن يسمعها` : ''}.
        ${s.status === 'pass' ? `حصلت على ${ar(cfg.pts)} نقاط في لوحة الشرف، ودرسك الجديد غداً بإذن الله.` : s.status === 'await' ? 'ستظهر نتيجتك حين يسمع معلمك كلماتك.' : `المطلوب ${pctTxt(cfg.pass)}. تدرّب على كلماتك، وتعيد الدرس غداً بإذن الله.`}</p>
      <button class="btn primary" type="button" id="iqHome">رجوع</button></div>`;
    host.querySelector('#iqHome').onclick = home;
  }

  /* --- مشغّل العناصر (اختبار المستوى، الدرس اليومي، التمرين) --- */
  function run({ mode, items, title, step, sid, taj = null }) {
    return new Promise((resolve) => {
      let k = 0, tries = 0, rec = null, busy = false, ts = taj ? 0 : -1, steps = null;
      const results = [];
      const finish = (v) => { runner = null; rec?.cancel(); stopAudio(); resolve(v); };
      const flagged = new Set();
      const flag = (it) => {
        if (flagged.has(it.s)) return; flagged.add(it.s);
        store.addIqraFlag({ key: keyOf(it.s), t: it.t, s: it.s, n: it.n, pn: me.id, name: me.name }).then(() => toast('شكراً! أُبلغ معلمك ليصحّح النطق.')).catch(() => toast('تعذّر الإرسال.'));
      };
      /* --- مرحلة التجريد: الكلمة حرفاً حرفاً --- */
      const stepAudio = (sp) => playSeq([...sp.say.map((n) => (hasRec(n) ? { key: keyOf(n), fallback: n } : { tts: n })), ...(sp.syl ? [hasRec(sp.syl) ? { key: keyOf(sp.syl), fallback: sp.syl } : { tts: sp.syl }] : [])], { gap: 0.12 });
      const paintTaj = () => {
        const it = items[k];
        steps = steps || tajSteps(it.s);
        if (ts === 0) { steps.forEach((x) => prefetch((x.say || []).concat(x.syl ? [x.syl] : []).filter((n) => hasRec(n)).map((n) => ({ key: keyOf(n) })))); prefetch(sourcesFor(it).list); }
        const sp = steps[ts];
        const T = it.s, Z = '\u200d';
        const hl = sp ? esc(T.slice(0, sp.at)) + (sp.at ? Z : '') + '<mark class="' + (sp.silent ? 'sil' : '') + '">' + Z + esc(T.slice(sp.at, sp.end)) + Z + '</mark>' + (sp.end < T.length ? Z : '') + esc(T.slice(sp.end)) : esc(T);
        host.innerHTML = `<div class="card stack iq iq-run">
          <div class="row" style="justify-content:space-between"><span class="small muted">${esc(title)} · التجريد</span><button class="btn sm ghost" type="button" id="iqX">✕ ${mode === 'practice' ? 'إغلاق' : 'خروج'}</button></div>
          ${mode !== 'practice' ? `<div class="iq-prog" aria-hidden="true"><i style="width:${(k / items.length) * 100}%"></i></div><span class="small muted" style="text-align:center">${ar(k + 1)} من ${ar(items.length)}</span>` : ''}
          <div class="iq-word iq-taj" lang="ar">${hl}</div>
          <div class="iq-tstep">${sp.silent ? `<span class="iq-sil">${esc(sp.note)}</span>` : `<span class="iq-names">${sp.say.map(esc).join(' <i>+</i> ')}</span>${sp.syl ? ` <i>=</i> <b class="iq-syl">${esc(sp.syl)}</b>` : ''}`}</div>
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
        host.querySelector('#iqTn').onclick = () => { stopAudio(); if (ts < steps.length - 1) { ts++; paintTaj(); } else { ts = -1; paint('الآن اقرأ الكلمة كاملة دون تقطيع.'); } };
        const tk = host.querySelector('#iqTk'); if (tk) tk.onclick = () => { stopAudio(); ts = -1; paint(); };
      };
      runner = { cancel: () => finish(null) };
      const paint = (msg = '', cls = '') => {
        const it = items[k];
        if (ts >= 0) return paintTaj();
        const src = sourcesFor(it);
        prefetch(src.list);
        host.innerHTML = `<div class="card stack iq iq-run">
          <div class="row" style="justify-content:space-between"><span class="small muted">${esc(title)}${step ? ` · ${ar(step[0])}/${ar(step[1])}` : ''}</span>
            <button class="btn sm ghost" type="button" id="iqX">✕ ${mode === 'practice' ? 'إغلاق' : 'خروج'}</button></div>
          ${mode !== 'practice' ? `<div class="iq-prog" aria-hidden="true"><i style="width:${(k / items.length) * 100}%"></i></div><span class="small muted" style="text-align:center">${ar(k + 1)} من ${ar(items.length)}</span>` : ''}
          <div class="iq-word" lang="ar">${esc(it.t)}</div>
          ${it.k === 'name' ? '<span class="small muted" style="text-align:center">اقرأ أسماء الحروف</span>' : it.s !== it.t ? '<span class="small muted" style="text-align:center">انتبه: تُقرأ بخلاف رسمها</span>' : ''}
          <div class="iq-ctrl">
            <button class="btn iq-say" type="button" id="iqSay" aria-label="استمع للنطق">🔊 استمع</button>
            <button class="iq-mic" type="button" id="iqMic" aria-label="سجّل نطقك">🎤</button>
            ${mode === 'practice' ? `<button class="btn" type="button" id="iqNext">التالي ←</button>` : `<button class="btn ghost small" type="button" id="iqSkip">لا أعرفها</button>`}
          </div>
          <div class="iq-level"><i id="iqLv"></i></div>
          <div class="row" style="justify-content:center;gap:8px"><span class="small muted">🔊 ${esc(KIND_LABEL[src.kind])}</span>${taj ? '<button class="btn sm ghost" type="button" id="iqTa">↺ التجريد مرة أخرى</button>' : ''}<button class="btn sm ghost" type="button" id="iqFl" title="أبلغ معلمك أن النطق المسموع غير صحيح">🚩 النطق خاطئ</button></div>
          <div class="iq-msg ${cls}" role="status" id="iqMsg">${msg || (tries ? 'حاول مرة أخرى بهدوء ووضوح.' : 'اضغط الميكروفون ثم انطق.')}</div>
        </div>`;
        host.querySelector('#iqX').onclick = () => finish(null);
        const say = host.querySelector('#iqSay'); if (say) say.onclick = () => playItem(it);
        host.querySelector('#iqFl').onclick = (e) => { flag(it); e.currentTarget.disabled = true; };
        const ta = host.querySelector('#iqTa'); if (ta) ta.onclick = () => { ts = 0; paintTaj(); };
        host.querySelector('#iqMic').onclick = () => (rec ? rec.stop() : listen());
        const nx = host.querySelector('#iqNext'); if (nx) nx.onclick = () => next();
        const sk = host.querySelector('#iqSkip'); if (sk) sk.onclick = () => { results.push({ item: items[k], ok: false, skip: true }); next(); };
      };
      const next = () => { k++; tries = 0; steps = null; ts = taj ? 0 : -1; stopAudio(); if (k >= items.length) return mode === 'practice' ? (k = 0, paint('أكملت القائمة! تبدأ من جديد.')) : finish(results); paint(); };
      async function listen() {
        if (busy) return;
        busy = true;
        const it = items[k];
        const mic = host.querySelector('#iqMic'), lv = host.querySelector('#iqLv'), msg = host.querySelector('#iqMsg');
        mic.classList.add('on'); msg.className = 'iq-msg'; msg.textContent = 'أستمع… انطق الآن';
        rec = recordOnce({ onLevel: (l) => { if (lv) lv.style.width = Math.round(l * 100) + '%'; }, expect: it.k !== 'syl' ? (t) => judgeTranscript(it.s, t, { names: it.k === 'name' }).ok : null });
        try { await rec.start(); } catch (e) { rec = null; busy = false; mic.classList.remove('on'); msg.className = 'iq-msg bad'; msg.textContent = e.message || micErrorText(e); return; }
        const r = await rec.done;
        rec = null; mic.classList.remove('on'); if (lv) lv.style.width = '0';
        if (!r.blob && !r.transcript) { busy = false; return; }
        msg.textContent = 'جارٍ التحقق من نطقك…';
        const j = await judge(it, it.n, r);
        busy = false;
        if (!host.isConnected || runner == null) return;
        if (j.ok) {
          msg.className = 'iq-msg ok'; msg.textContent = ['أحسنت! ✓', 'ممتاز! ✓', 'بارك الله فيك ✓', 'صحيح ✓'][Math.floor(Math.random() * 4)];
          if (mode !== 'practice') results.push({ item: it, ok: true });
          setTimeout(() => next(), 850);
          return;
        }
        tries++;
        if (j.empty) { tries--; paint('لم أسمع صوتك. قرّب الجوال وانطق بصوت أوضح.', 'warn'); return; }
        if (mode === 'practice') { paint(j.unsure ? 'تعذّر التحقق الآن. استمع للنطق ثم حاول مرة أخرى.' : 'ليس تماماً. استمع للنطق الصحيح ثم أعد المحاولة.', 'bad'); return; }
        if (tries < 2) { paint(j.unsure ? 'تعذّر التحقق، حاول مرة أخرى.' : 'ليس تماماً، استمع ثم أعد المحاولة.', 'bad'); return; }
        // المحاولة الثانية: في الدرس اليومي يسمعها المعلم، وفي اختبار المستوى تُحسب خطأ
        if (mode === 'daily' && r.blob) {
          results.push({ item: it, ok: false, pending: true });
          blobToB64(r.blob).then((b64) => store.addIqraRev(me.id, { sid, n: it.n, i: it.i, t: it.t, s: it.s, b64, mime: r.blob.type, got: j.got || '', said: r.transcript || '' })).catch((e) => console.warn('iqra rev', e));
          msg.className = 'iq-msg warn'; msg.textContent = 'سيستمع معلمك لنطقك ويحكم عليه. ننتقل للتالية.';
        } else { results.push({ item: it, ok: false }); msg.className = 'iq-msg bad'; msg.textContent = 'ننتقل للتالية.'; }
        setTimeout(() => next(), 1200);
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
  let cfg = null, states = {}, revs = [], flags = [], q = '', cls = 'all', alive = true, prevN = 4, studio = null;
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
    host.innerHTML = `<div class="stack iq">
      <div class="card stack">
        <div><h2>📖 اقرأ وارتقِ</h2><p class="small muted" style="margin:4px 0 0">تدريب على نطق الحروف والكلمات من كتاب «اقرأ وارتقِ» (الفصول ١–٤)، للطلاب الذين تختارهم فقط. يظهر لهم تبويب خاص: اختبار مستوى، ثم درس يومي، وتمرين حر.</p></div>
        <div class="row">
          <label class="field" style="min-width:150px">عدد الكلمات في الدرس اليومي<input type="number" id="iqC" min="5" max="40" value="${cfg.count}"></label>
          <label class="field" style="min-width:150px">نسبة الإتقان للانتقال (٪)<input type="number" id="iqP" min="50" max="100" value="${cfg.pass}"></label>
          <label class="field" style="min-width:150px">نقاط كل درس في لوحة الشرف<input type="number" id="iqPts" min="0" max="20" value="${cfg.pts}"></label>
          <label class="field" style="min-width:170px">التجريد إلزامي حتى الدرس<input type="number" id="iqTj" min="0" max="43" value="${cfg.taj ?? IQ_DEFAULT.taj}"></label>
          <button class="btn primary" type="button" id="iqSave" style="align-self:flex-end">حفظ</button>
        </div>
      </div>

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
        <h3>تقدّم الطلاب (${ar(enabled.length)})</h3>
        ${enabled.length ? `<div class="table-wrap"><table class="iq-table"><thead><tr><th>الطالب</th><th>الدرس الحالي</th><th>أتقن</th><th>آخر درس يومي</th><th>تغيير الدرس</th></tr></thead><tbody>
          ${enabled.map((s) => { const x = states[s.id]; const last = (x?.sessions || []).filter((z) => z.kind !== 'place').slice(-1)[0]; const L = x ? lessonByN(x.cur) : null;
            return `<tr><td>${esc(s.name)}<div class="small muted">${esc(classes.find((c) => c.id === s.classId)?.name || '')}</div></td>
              <td>${!x ? '<span class="pill mute">لم يبدأ</span>' : !x.placed ? '<span class="pill mute">لم يُكمل اختبار المستوى</span>' : `${ar(x.cur)}. ${esc(L?.t || '')}`}</td>
              <td>${ar(Object.values(x?.mastered || {}).filter((m) => !m.skip).length)}</td>
              <td>${last ? `<span class="pill ${last.status === 'pass' ? 'ok' : last.status === 'await' ? 'warn' : 'bad'}">${last.status === 'pass' ? 'أتقن' : last.status === 'await' ? 'ينتظرك' : 'يعيد'} ${last.pct != null ? pctTxt(last.pct) : ''}</span> <span class="small muted">${esc(last.day)}</span>` : '—'}</td>
              <td><select data-cur="${esc(s.id)}" aria-label="درس ${esc(s.name)}"><option value="">—</option>${LESSONS.map((l) => `<option value="${l.n}" ${x?.cur === l.n ? 'selected' : ''}>${ar(l.n)}${l.items.length ? '' : ' (قريباً)'}</option>`).join('')}</select></td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="small muted" style="margin:0">لم تختر أحداً بعد. اختر من القائمة التالية.</p>'}
      </div>

      <div class="card stack">
        <h3>اختر الطلاب المحتاجين لعناية مكثفة</h3>
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
      cfg = { ...cfg, count: c, pass: p, pts, taj: tj };
      try { await store.setIqraCfg(cfg); toast('حُفظت إعدادات «اقرأ وارتقِ».'); onChange({ cfg, states }); } catch (e) { toast('تعذّر الحفظ: ' + e.message); }
      draw();
    };
    wireAudio();
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
