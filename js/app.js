import { loadQuran, getSurahs, surahName, ayahCount, ayahWords, rangeWords, toArabicDigits as ar } from './quran.js';
import { align, score } from './align.js';
import { analyzeAyah, wordHtml, summarize, RULES } from './tajweed.js';
import { RecitationSession, AyahPlayer, RECITERS, hasRecognition, hasRecorder } from './speech.js';
import { initStore, store, cloudError } from './store.js';
import { train, predict, studentRates, riskyWords, weakRules, segmentRules, pack, ruleName, EXTRA, aiReliability } from './learn.js';
import { aiEnabled, analyze as aiAnalyze, describe as aiDescribe, AI_NOTICE, health as aiHealth, setTokenProvider } from './tajweed-ai.js';

/* ================= أدوات عامة ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pref = {
  get(k, d) { try { const v = localStorage.getItem('fp_pref_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fp_pref_' + k, JSON.stringify(v)); } catch {} },
};
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const rangeLabel = (s, f, t) => `${surahName(s)} ${f === t ? `(${ar(f)})` : `(${ar(f)}–${ar(t)})`}`;
const pctClass = (p) => (p >= 85 ? 'ok' : p >= 60 ? 'warn' : 'bad');

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200);
}
function openModal(html, onMount) {
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  onMount && onMount($('#modalBody'));
}
function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
function confirmBox(text, okLabel = 'حذف') {
  return new Promise((res) => {
    openModal(`<h3>${esc(text)}</h3><div class="row" style="margin-top:20px"><button class="btn primary" id="cfYes">${esc(okLabel)}</button><button class="btn" id="cfNo">إلغاء</button></div>`, (m) => {
      $('#cfYes', m).onclick = () => { closeModal(); res(true); };
      $('#cfNo', m).onclick = () => { closeModal(); res(false); };
    });
  });
}

/* تنبيه الذكاء الاصطناعي (شرط ترخيص نموذج «المعلّم القرآني»): يُعرض قبل أول استخدام ويبقى متاحاً من «عن المقرأة» */
function ensureAiNotice() {
  if (pref.get('aiNoticeOk', false)) return Promise.resolve(true);
  return new Promise((res) => {
    openModal(`<div class="stack"><h2>قبل استخدام تحليل التجويد الآلي</h2>
      <p class="ai-notice">${AI_NOTICE}</p>
      <p class="muted" style="margin:0">يُرسَل تسجيلك إلى خادم التحليل ليقارن نطقك بالرسم الصوتي للآيات، ثم تظهر لك المواضع المحتملة للخطأ. الحكم النهائي لمعلمك.</p>
      <div class="row"><button class="btn primary" id="aiOk" type="button">فهمت، تابع</button><button class="btn" id="aiNo" type="button">ليس الآن</button></div></div>`, (m) => {
      $('#aiOk', m).onclick = () => { pref.set('aiNoticeOk', true); closeModal(); res(true); };
      $('#aiNo', m).onclick = () => { closeModal(); res(false); };
    });
  });
}
function openAbout() {
  openModal(`<div class="stack"><h2>عن مقرأة الفاتح</h2>
    <p style="margin:0">مقرأة إلكترونية لتصحيح التلاوة وتسميع الحفظ للطلاب، مع لوحة للمعلم.</p>
    <h3>تنبيه الذكاء الاصطناعي</h3>
    <p class="ai-notice">${AI_NOTICE}</p>
    <p class="ai-notice" dir="ltr" lang="en" style="text-align:left">This Quranic Teacher is an artificial-intelligence model that may make mistakes. It is intended for assistance only and must not be relied upon. It is not a replacement for a proficient, authorized teacher, because the Quran is only received through oral transmission (mushafahah).</p>
    <h3>المصادر والتراخيص</h3>
    <ul style="margin:0;padding-inline-start:20px">
      <li>النص القرآني: الرسم العثماني برواية حفص، من مشروع Tanzil.</li>
      <li>التلاوات الصوتية: موقع EveryAyah.</li>
      <li>تحليل التجويد: نموذج «المعلّم القرآني» (Quran Muaalem) من obadx والمساهمين، بترخيص Quran Muaalem License (QML) 1.0.</li>
    </ul></div>`);
}
$('#aboutLink').onclick = (e) => { e.preventDefault(); openAbout(); };

/* الوضع الليلي */
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
applyTheme(pref.get('theme', null));
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? 'light' : 'dark';
  pref.set('theme', t); applyTheme(t);
};

/* الجلسة */
const session = {
  get() { try { return JSON.parse(localStorage.getItem('fp_session') || 'null'); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem('fp_session', JSON.stringify(v)) : localStorage.removeItem('fp_session'); } catch {} },
};

/* ================= أداة اختيار المقطع ================= */
function surahOptions(sel) {
  return getSurahs().map((s) => `<option value="${s.n}" ${s.n === sel ? 'selected' : ''}>${ar(s.n)}. ${esc(s.name)}</option>`).join('');
}
function ayahOptions(s, sel) {
  let h = '';
  for (let i = 1; i <= ayahCount(s); i++) h += `<option value="${i}" ${i === sel ? 'selected' : ''}>${ar(i)}</option>`;
  return h;
}
function rangePicker(prefix, { surah, from, to }) {
  return `<div class="row" style="align-items:flex-end">
    <label class="field" style="flex:2 1 180px">السورة<select id="${prefix}S">${surahOptions(surah)}</select></label>
    <label class="field" style="flex:1 1 80px">من الآية<select id="${prefix}F">${ayahOptions(surah, from)}</select></label>
    <label class="field" style="flex:1 1 80px">إلى الآية<select id="${prefix}T">${ayahOptions(surah, to)}</select></label>
  </div>`;
}
function bindRangePicker(root, prefix, onChange) {
  const S = $(`#${prefix}S`, root), F = $(`#${prefix}F`, root), T = $(`#${prefix}T`, root);
  const read = () => ({ surah: +S.value, from: +F.value, to: +T.value });
  S.onchange = () => {
    const s = +S.value, n = ayahCount(s);
    F.innerHTML = ayahOptions(s, 1);
    T.innerHTML = ayahOptions(s, Math.min(n, 7));
    onChange && onChange(read());
  };
  F.onchange = () => { if (+T.value < +F.value) T.value = F.value; onChange && onChange(read()); };
  T.onchange = () => { if (+T.value < +F.value) F.value = T.value; onChange && onChange(read()); };
  return read;
}

/* ================= مكوّن التسميع ================= */
const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>';
const STOP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';

function mountRecite(root, opts) {
  const { surah, from, to } = opts;
  let mode = opts.mode || 'recite'; // recite | hifz
  const words = rangeWords(surah, from, to);
  const analyzed = [];
  let gi = 0;
  let html = '';
  for (let a = from; a <= to; a++) {
    const ws = ayahWords(surah, a);
    const parts = analyzeAyah(ws);
    analyzed.push({ ayah: a, words: parts });
    html += `<span class="ayah" data-a="${a}">`;
    parts.forEach((p) => { html += `<span class="w" data-i="${gi++}">${wordHtml(p)}</span> `; });
    html += `<span class="ayah-end" data-a="${a}" title="استمع للآية ${ar(a)}">۝${ar(a)}</span> </span>`;
  }
  const rulesMap = summarize(analyzed);
  const L = opts.learn; // { model, rates, weak } للطالب المسجل
  const riskSet = L ? new Set(riskyWords({ surah, from, to }, L.rates, 6).filter((r) => r.risk >= 0.3).map((r) => r.i)) : null;
  const tajOn = pref.get('tajweed', true);
  const qsize = pref.get('qsize', 30);
  const reciter = pref.get('reciter', RECITERS[0].id);

  root.innerHTML = `
  <div class="reciter">
    <div class="stack">
      <div class="toolbar">
        <div class="seg" role="group" aria-label="نوع التدريب">
          <button type="button" data-mode="recite" class="${mode === 'recite' ? 'on' : ''}">تلاوة نظراً</button>
          <button type="button" data-mode="hifz" class="${mode === 'hifz' ? 'on' : ''}">تسميع غيباً</button>
        </div>
        <label class="btn sm"><input type="checkbox" id="rcTaj" ${tajOn ? 'checked' : ''}> ألوان التجويد</label>
        <button class="btn sm" id="rcHint" type="button" ${mode === 'hifz' ? '' : 'hidden'}>تلميح بالكلمة التالية</button>
        <span style="flex:1"></span>
        <button class="icon-btn" id="rcMinus" type="button" aria-label="تصغير الخط">ـ</button>
        <button class="icon-btn" id="rcPlus" type="button" aria-label="تكبير الخط">+</button>
      </div>
      <div class="sheet">
        <div class="sheet-head"><div class="sname">سورة ${esc(surahName(surah))}</div><div class="muted small">من الآية ${ar(from)} إلى ${ar(to)}، وعدد كلماتها ${ar(words.length)}</div></div>
        <div class="quran ${tajOn ? 'tajweed' : ''} ${mode === 'hifz' ? 'hide' : ''}" id="rcText" style="--qsize:${qsize}px">${html}</div>
      </div>
      ${L && L.weak.length ? `<div class="learn-note"><b>انتبه في هذا المقطع:</b> من تقييمات معلمك السابقة، تحتاج إلى عناية بـ ${L.weak.map((w) => `«${esc(ruleName(w.r))}»`).join(' و')}. المواضع المتوقعة مسطّرة بخط متموّج.</div>` : ''}
      ${opts.below || ''}
    </div>
    <aside class="side">
      <div class="card mic-panel" id="rcMicCard">
        <div id="rcNotice"></div>
        <button class="mic" id="rcMic" type="button" aria-label="ابدأ التسميع">${MIC_SVG}</button>
        <div class="timer" id="rcTimer">00:00</div>
        <div class="progress"><i id="rcProg"></i></div>
        <div class="small muted" id="rcStatus">اضغط الزر وابدأ القراءة، وسيتابعك الموقع كلمة بكلمة.</div>
        <div class="live-text" id="rcLive"></div>
      </div>
      <div id="rcResult"></div>
      <div class="card stack" style="gap:10px">
        <h3>استمع للقارئ</h3>
        <label class="field">القارئ<select id="rcReciter">${RECITERS.map((r) => `<option value="${r.id}" ${r.id === reciter ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        <div class="row">
          <label class="field" style="flex:1">السرعة<select id="rcRate"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option></select></label>
          <label class="field" style="flex:1">تكرار كل آية<select id="rcRep"><option>1</option><option>2</option><option>3</option><option>5</option><option>10</option></select></label>
        </div>
        <div class="row"><button class="btn primary" id="rcPlay" type="button">تشغيل المقطع</button><button class="btn" id="rcStopPlay" type="button" hidden>إيقاف</button></div>
        <div class="small muted">اضغط رقم أي آية في المصحف لسماعها وحدها.</div>
      </div>
      <div class="card">
        <details ${rulesMap.size ? '' : 'open'}>
          <summary>أحكام التجويد في هذا المقطع (${ar([...rulesMap.values()].reduce((n, a) => n + a.length, 0))})</summary>
          <div class="rules-list">${[...rulesMap.entries()].map(([k, arr]) => `
            <div><span class="dot" style="background:var(--tj-${k})"></span><b>${RULES[k].name}</b> <span class="muted">(${ar(arr.length)})</span><br>
            <span class="muted">${RULES[k].tip}</span><br>
            ${arr.slice(0, 8).map((x) => `<span class="qw">${esc(x.word)}</span> <span class="small muted">[${ar(x.ayah)}]</span>`).join(' ، ')}${arr.length > 8 ? ' …' : ''}</div>`).join('') || '<span class="muted small">لا توجد أحكام ملوّنة في هذا المقطع.</span>'}</div>
        </details>
      </div>
    </aside>
  </div>`;

  const text = $('#rcText', root);
  const wEls = $$('.w', text);
  if (riskSet) riskSet.forEach((i) => wEls[i]?.classList.add('risk'));
  let last = null; // آخر نتيجة
  let sess = null;
  let lastBlob = null, lastDuration = 0, lastTranscript = '';
  let aiRes = null, aiCtl = null;

  // أدوات العرض
  $$('[data-mode]', root).forEach((b) => (b.onclick = () => {
    mode = b.dataset.mode;
    $$('[data-mode]', root).forEach((x) => x.classList.toggle('on', x === b));
    text.classList.toggle('hide', mode === 'hifz');
    $('#rcHint', root).hidden = mode !== 'hifz';
  }));
  $('#rcTaj', root).onchange = (e) => { text.classList.toggle('tajweed', e.target.checked); pref.set('tajweed', e.target.checked); };
  const setSize = (d) => { const v = Math.max(20, Math.min(52, pref.get('qsize', 30) + d)); pref.set('qsize', v); text.style.setProperty('--qsize', v + 'px'); };
  $('#rcMinus', root).onclick = () => setSize(-3);
  $('#rcPlus', root).onclick = () => setSize(3);
  $('#rcHint', root).onclick = () => {
    const pos = last ? last.position : 0;
    const el = wEls.slice(pos).find((w) => !w.classList.contains('revealed') && !w.classList.contains('correct'));
    if (el) el.classList.add('revealed');
  };

  // تلميح حكم التجويد / ما سُمع
  let pop;
  text.addEventListener('click', (e) => {
    const end = e.target.closest('.ayah-end');
    if (end) { playRange(+end.dataset.a, +end.dataset.a); return; }
    const w = e.target.closest('.w');
    pop?.remove();
    if (!w) return;
    const i = +w.dataset.i;
    const tjs = [...new Set($$('.tj', w).map((t) => t.dataset.rule).filter((r) => r !== 'silent'))];
    let msg = tjs.map((r) => `• ${RULES[r].name}: ${RULES[r].tip}`).join('<br>');
    if (last && last.status[i] && last.status[i] !== 'pending') {
      const st = { correct: 'صحيحة', wrong: 'خطأ في النطق', missing: 'لم تُقرأ' }[last.status[i]];
      msg = `<b>${st}</b>${last.heard[i] ? ` — سُمعت: «${esc(last.heard[i])}»` : ''}${msg ? '<br>' + msg : ''}`;
    }
    if (mode === 'hifz' && !w.classList.contains('correct')) { w.classList.add('revealed'); }
    if (!msg) return;
    pop = document.createElement('div');
    pop.className = 'tip-pop';
    pop.innerHTML = msg;
    document.body.appendChild(pop);
    const r = w.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.top = scrollY + r.bottom + 6 + 'px';
    pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, scrollX + r.left + r.width / 2 - pw / 2)) + 'px';
    setTimeout(() => pop?.remove(), 4500);
  });

  // مشغل القارئ
  const player = new AyahPlayer({
    onAyah: (a) => { $$('.ayah', text).forEach((x) => x.classList.toggle('playing', +x.dataset.a === a)); },
    onState: (s) => {
      $('#rcPlay', root).hidden = s === 'playing';
      $('#rcStopPlay', root).hidden = s !== 'playing';
      if (s === 'error') toast('تعذر تشغيل التلاوة. تحقق من الاتصال بالإنترنت.');
    },
  });
  player.reciter = reciter;
  $('#rcReciter', root).onchange = (e) => { player.reciter = e.target.value; pref.set('reciter', e.target.value); };
  $('#rcRate', root).onchange = (e) => player.setRate(+e.target.value);
  $('#rcRep', root).onchange = (e) => (player.repeat = +e.target.value);
  const playRange = (f, t) => { if (sess?.active) return toast('أوقف التسجيل أولاً.'); player.play(surah, f, t); };
  $('#rcPlay', root).onclick = () => playRange(from, to);
  $('#rcStopPlay', root).onclick = () => player.stop();

  // التلوين حسب النتيجة
  function paint(res, live) {
    text.classList.toggle('live', !!live);
    wEls.forEach((el, i) => {
      el.classList.remove('correct', 'wrong', 'missing', 'cursor');
      const s = res.status[i];
      if (s !== 'pending') el.classList.add(s);
    });
    if (live && wEls[res.position]) wEls[res.position].classList.add('cursor');
    $('#rcProg', root).style.width = (res.total ? (res.done / res.total) * 100 : 0) + '%';
  }

  if (!hasRecorder) $('#rcNotice', root).innerHTML = '<div class="notice">متصفحك لا يدعم التسجيل الصوتي. استخدم Chrome أو Edge أو Safari حديثاً.</div>';
  else if (!hasRecognition) $('#rcNotice', root).innerHTML = '<div class="notice">المتابعة الحية تعمل في Chrome وEdge وSafari. في هذا المتصفح سيُحفظ تسجيلك فقط ليقيّمه المعلم.</div>';

  let throttle = 0, pendingT = null;
  function onTranscript(t) {
    $('#rcLive', root).textContent = t.split(' ').slice(-14).join(' ');
    const now = Date.now();
    const run = () => { last = align(words, t, { partial: true }); paint(last, true); throttle = Date.now(); $('#rcStatus', root).textContent = `وصلت إلى الكلمة ${ar(last.position)} من ${ar(words.length)}`; };
    clearTimeout(pendingT);
    if (now - throttle > 250) run(); else pendingT = setTimeout(run, 250);
  }

  async function startRec() {
    player.stop();
    pop?.remove();
    $('#rcResult', root).innerHTML = '';
    wEls.forEach((el) => el.classList.remove('correct', 'wrong', 'missing', 'cursor', 'revealed'));
    last = null;
    sess = new RecitationSession({
      onTranscript,
      onLevel: (l) => $('#rcMic', root).style.setProperty('--lvl', l.toFixed(2)),
      onTick: (s) => { $('#rcTimer', root).textContent = fmtTime(s); },
      onError: (m) => { $('#rcNotice', root).innerHTML = `<div class="notice">${esc(m)}</div>`; },
      maxSeconds: opts.maxSeconds || 300,
    });
    sess.onAutoStop = () => { toast('انتهى الحد الأقصى لمدة التسجيل.'); finishRec(); };
    try {
      await sess.start();
    } catch (e) {
      $('#rcNotice', root).innerHTML = `<div class="notice">${esc(e.message)}</div>`;
      return;
    }
    const mic = $('#rcMic', root);
    mic.classList.add('rec'); mic.innerHTML = STOP_SVG; mic.setAttribute('aria-label', 'إنهاء التسميع');
    $('#rcStatus', root).textContent = hasRecognition ? 'أستمع إليك… اقرأ بصوت واضح.' : 'جارٍ التسجيل…';
  }
  let finishing = false;
  async function finishRec() {
    if (finishing || !sess) return;
    finishing = true;
    const mic = $('#rcMic', root);
    mic.disabled = true;
    $('#rcStatus', root).textContent = 'جارٍ التحليل…';
    const { blob, duration, transcript } = await sess.stop();
    mic.disabled = false; mic.classList.remove('rec'); mic.innerHTML = MIC_SVG; mic.style.removeProperty('--lvl');
    finishing = false;
    lastBlob = blob; lastDuration = duration; lastTranscript = transcript;
    if (transcript) {
      last = align(words, transcript);
      paint(last, false);
      text.classList.remove('hide');
      showResult();
    } else {
      last = null;
      $('#rcStatus', root).textContent = hasRecognition ? 'لم يُلتقط كلام واضح.' : 'انتهى التسجيل.';
      showResult();
    }
  }
  $('#rcMic', root).onclick = () => (sess?.active ? finishRec() : startRec());

  function showResult() {
    const box = $('#rcResult', root);
    const audioUrl = lastBlob ? URL.createObjectURL(lastBlob) : '';
    const submitBtn = opts.onSubmit ? `<button class="btn primary" id="rcSubmit" type="button">إرسال للمعلم</button>` : '';
    if (!last) {
      box.innerHTML = `<div class="card stack" style="gap:10px">
        <h3>${hasRecognition ? 'لم نسمع تلاوة واضحة' : 'تم التسجيل'}</h3>
        <p class="muted small" style="margin:0">${hasRecognition ? 'تأكد من السماح للميكروفون، واقرأ بصوت أعلى قليلاً في مكان هادئ.' : 'لا يدعم متصفحك التصحيح الآلي؛ يمكنك إرسال التسجيل ليقيّمه المعلم.'}</p>
        ${audioUrl ? `<audio controls src="${audioUrl}" style="width:100%"></audio>` : ''}
        <div class="row">${lastBlob && opts.onSubmit ? submitBtn : ''}<button class="btn" id="rcRetry" type="button">إعادة المحاولة</button></div></div>`;
    } else {
      const sc = score(last, lastDuration);
      const mist = [];
      last.status.forEach((s, i) => { if (s === 'wrong' || s === 'missing') mist.push(i); });
      const color = sc.percent >= 85 ? 'var(--ok)' : sc.percent >= 60 ? 'var(--warn)' : 'var(--bad)';
      box.innerHTML = `<div class="card stack" style="gap:14px">
        <div class="score-ring" style="--p:${sc.percent};--c:${color}"><div><div><b>${ar(sc.percent)}٪</b><br><span class="small muted">${sc.grade}</span></div></div></div>
        <div class="stats">
          <div><b style="color:var(--ok)">${ar(last.counts.correct)}</b><span>صحيحة</span></div>
          <div><b style="color:var(--warn)">${ar(last.counts.wrong)}</b><span>خطأ نطق</span></div>
          <div><b style="color:var(--bad)">${ar(last.counts.missing)}</b><span>محذوفة</span></div>
        </div>
        <div class="small muted">المدة ${fmtTime(lastDuration)} · السرعة ${ar(sc.wpm)} كلمة/دقيقة (${sc.pace})${last.extras.length ? ` · ${ar(last.extras.length)} كلمة زائدة` : ''}</div>
        ${mist.length ? `<div><b class="small">مواضع تحتاج مراجعة</b><ul class="mistakes">${mist.slice(0, 40).map((i) => `
          <li><span><span class="qw">${esc(words[i].text)}</span> <span class="small muted">آية ${ar(words[i].ayah)}${last.heard[i] ? ` · سُمعت «${esc(last.heard[i])}»` : ''}</span></span>
          <button class="btn sm" type="button" data-play="${words[i].ayah}">استمع</button></li>`).join('')}</ul></div>` : '<div class="pill ok">لا أخطاء في الكلمات. بارك الله فيك.</div>'}
        ${audioUrl ? `<div><b class="small">تسجيلك</b><audio controls src="${audioUrl}" style="width:100%"></audio></div>` : ''}
        ${L ? `<div class="learn-note">الدرجة المتوقعة من معلمك: <b>${ar(predict(L.model, { surah, from, to, percent: sc.percent, wpm: sc.wpm }, L.rates))} / ١٠</b><br><span class="small">تقدير يتعلمه النظام من تقييمات المعلم السابقة، والدرجة النهائية للمعلم.</span></div>` : ''}
        <div class="small muted">التصحيح الآلي يقيس صحة الكلمات والحفظ. أحكام التجويد والمخارج يقيّمها المعلم بالاستماع.</div>
        <div class="row">${submitBtn}<button class="btn" id="rcRetry" type="button">إعادة المحاولة</button></div>
      </div>`;
      $$('[data-play]', box).forEach((b) => (b.onclick = () => playRange(+b.dataset.play, +b.dataset.play)));
      opts.onResult && opts.onResult(buildSubmission());
    }
    if (lastBlob && aiEnabled()) mountAi(box);
    $('#rcRetry', box).onclick = () => { aiCtl?.abort(); aiRes = null; wEls.forEach((el) => el.classList.remove('tjai')); box.innerHTML = ''; wEls.forEach((el) => el.classList.remove('correct', 'wrong', 'missing', 'cursor', 'revealed')); if (mode === 'hifz') text.classList.add('hide'); $('#rcTimer', root).textContent = '00:00'; $('#rcProg', root).style.width = '0'; $('#rcStatus', root).textContent = 'جاهز. اضغط الزر وابدأ.'; };
    const sb = $('#rcSubmit', box);
    if (sb) sb.onclick = async () => {
      sb.disabled = true; sb.textContent = 'جارٍ الإرسال…';
      try { await opts.onSubmit(buildSubmission(), lastBlob); }
      catch (e) { console.error(e); toast('تعذر الإرسال: ' + (e.message || e)); sb.disabled = false; sb.textContent = 'إرسال للمعلم'; }
    };
  }

  function mountAi(box) {
    aiRes = null;
    const card = document.createElement('div');
    card.className = 'card stack';
    card.style.gap = '10px';
    box.appendChild(card);
    const idle = () => {
      card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><p class="small muted" style="margin:0">يستمع النموذج لتسجيلك ويحدد أخطاء المدود والغنة والقلقلة والحركات والحروف.</p><button class="btn gold" type="button" id="aiGo">حلّل تجويدي</button>`;
      $('#aiGo', card).onclick = start;
    };
    const start = async () => {
      if (!(await ensureAiNotice())) return;
      aiCtl = new AbortController();
      card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><div class="small" id="aiProg">جارٍ التحضير…</div><div class="progress"><i class="indet"></i></div>${opts.onSubmit ? '<p class="small muted" style="margin:0">يمكنك الإرسال الآن؛ إن لم ينتهِ التحليل فسيُجريه المعلم لاحقاً.</p>' : ''}`;
      try {
        aiRes = await aiAnalyze(lastBlob, { surah, from, to }, (t) => { const el = $('#aiProg', card); if (el) el.textContent = t; }, aiCtl.signal);
        renderAi(card);
      } catch (e) {
        if (aiCtl.signal.aborted) return;
        card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><div class="notice">${esc(e.message)}</div><button class="btn" type="button" id="aiGo">أعد المحاولة</button>`;
        $('#aiGo', card).onclick = start;
      }
    };
    if (pref.get('aiNoticeOk', false)) start(); else idle();
  }

  function renderAi(card) {
    wEls.forEach((el) => el.classList.remove('tjai'));
    aiRes.errors.forEach((e) => wEls[e.i]?.classList.add('tjai'));
    const list = aiRes.errors.slice(0, 40);
    card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3>
      <div class="row"><span class="pill ${aiRes.errors.length ? 'warn' : 'ok'}">${aiRes.errors.length ? `${ar(aiRes.errors.length)} موضعاً محتملاً` : 'لم يجد النموذج أخطاء'}</span>${aiRes.acc != null ? `<span class="pill mute">تطابق النطق ${ar(Math.round(aiRes.acc * 100))}٪</span>` : ''}</div>
      ${aiRes.skipped.length ? `<div class="notice">آيات لم يسمعها النموذج: ${aiRes.skipped.map(ar).join('، ')}</div>` : ''}
      ${list.length ? `<ul class="mistakes">${list.map((e) => `<li><span><span class="qw">${esc(words[e.i]?.text || '')}</span> <span class="small muted">آية ${ar(words[e.i]?.ayah || 0)}</span></span><span class="small">${esc(aiDescribe(e, ruleName))}</span></li>`).join('')}</ul>` : ''}
      <p class="ai-notice small-notice">${AI_NOTICE}</p>`;
  }

  function buildSubmission() {
    const base = { surah, from, to, mode, duration: lastDuration, transcript: lastTranscript.slice(0, 5000), ...(aiRes ? { ai: aiRes } : {}) };
    if (!last) return { ...base, auto: false, percent: null, statuses: '', mistakes: [], counts: null, wpm: 0 };
    const sc = score(last, lastDuration);
    const code = { correct: 'c', wrong: 'w', missing: 'm', pending: 'm' };
    return {
      ...base,
      auto: true,
      percent: sc.percent,
      wpm: sc.wpm,
      counts: last.counts,
      extras: last.extras.length,
      statuses: last.status.map((s) => code[s]).join(''),
      mistakes: last.status.map((s, i) => (s === 'wrong' || s === 'missing' ? { i, a: words[i].ayah, w: words[i].text, st: s[0], h: last.heard[i] || '' } : null)).filter(Boolean).slice(0, 200),
    };
  }

  return { destroy() { player.stop(); sess?.cancel(); pop?.remove(); aiCtl?.abort(); } };
}

/* عرض خريطة الكلمات لتسليم محفوظ */
function wordMapHtml(sub, { colored = false, risky = null, ai = null } = {}) {
  const cls = { c: 'correct', w: 'wrong', m: 'missing' };
  const tjSet = new Set((sub.tj || []).map((m) => m.i));
  let h = '', gi = 0;
  for (let a = sub.from; a <= sub.to; a++) {
    const ws = ayahWords(sub.surah, a);
    const parts = colored ? analyzeAyah(ws) : null;
    ws.forEach((w, k) => {
      const i = gi++;
      const c = ['w', cls[sub.statuses?.[i]] || '', ai?.has(i) ? 'tjai' : '', tjSet.has(i) ? 'tjerr' : '', risky?.has(i) ? 'risk' : ''].join(' ').trim();
      h += `<span class="${c}" data-i="${i}">${colored ? wordHtml(parts[k]) : esc(w)}</span> `;
    });
    h += `<span class="ayah-end">${ar(a)}</span> `;
  }
  return `<div class="sheet"><div class="quran ${colored ? 'tajweed' : ''}" style="--qsize:24px">${h}</div></div>`;
}
function aiListHtml(sub) {
  if (!sub.ai) return '';
  const words = rangeWords(sub.surah, sub.from, sub.to);
  return `<div><b class="small">ملاحظات الذكاء الاصطناعي (${ar(sub.ai.errors.length)})</b>${sub.ai.errors.length ? `<ul class="mistakes">${sub.ai.errors.slice(0, 40).map((e) => `<li><span><span class="qw">${esc(words[e.i]?.text || '')}</span> <span class="small muted">آية ${ar(words[e.i]?.ayah || 0)}</span></span><span class="small">${esc(aiDescribe(e, ruleName))}</span></li>`).join('')}</ul>` : '<div class="small muted">لم يجد النموذج أخطاء.</div>'}<p class="ai-notice small-notice">${AI_NOTICE}</p></div>`;
}
function tjMarksHtml(sub) {
  if (!sub.tj?.length) return '';
  const words = rangeWords(sub.surah, sub.from, sub.to);
  return `<div><b class="small">أخطاء التجويد التي حددها المعلم</b><ul class="mistakes">${sub.tj.map((m) => `<li><span><span class="qw">${esc(words[m.i]?.text || '')}</span> <span class="small muted">آية ${ar(words[m.i]?.ayah || 0)}</span></span><span class="pill bad">${esc(ruleName(m.r))}</span></li>`).join('')}</ul></div>`;
}

/* ================= التوجيه ================= */
let current = null;
const routes = { '': viewHome, practice: viewPractice, student: viewStudent, teacher: viewTeacher };
function navTo(r) { location.hash = '#/' + r; }
function render() {
  current?.destroy?.();
  current = null;
  $('#tip-pop')?.remove();
  const r = location.hash.replace(/^#\/?/, '').split('/')[0];
  const fn = routes[r] || viewHome;
  $('#nav').innerHTML = [['', 'الرئيسية'], ['student', 'الطالب'], ['teacher', 'المعلم']]
    .map(([k, l]) => `<a href="#/${k}" class="${k === r || (!routes[r] && !k) ? 'on' : ''}">${l}</a>`).join('');
  const app = $('#app');
  app.innerHTML = '';
  scrollTo(0, 0);
  current = fn(app) || null;
}
addEventListener('hashchange', render);

/* ================= الرئيسية ================= */
function viewHome(app) {
  const sample = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]];
  const fat = sample.map(([s, a]) => analyzeAyah(ayahWords(s, a)).map(wordHtml).join(' ') + ` <span class="ayah-end">۝${ar(a)}</span>`).join(' ');
  app.innerHTML = `
  <section class="hero">
    <div>
      <span class="pill">المصحف كاملاً · ١١٤ سورة</span>
      <h1 style="margin-top:12px">اقرأ، ونحن نتابعك كلمةً بكلمة</h1>
      <p class="lead">مقرأة إلكترونية للمدارس وحلقات التحفيظ: يقرأ الطالب من أي سورة، فتظهر الكلمات الصحيحة والمحذوفة والخاطئة أثناء القراءة، ثم يُرسل تسجيله إلى المعلم ليقيّم التجويد والأداء.</p>
      <div class="grid2">
        <a class="entry" href="#/student"><b>دخول الطالب</b><span>واجباتك، والتدريب الحر على أي سورة، وسجل تسميعك، ودفتر أخطائك.</span></a>
        <a class="entry" href="#/teacher"><b>لوحة المعلم</b><span>الصفوف والطلاب والواجبات، والاستماع والتقييم والتقارير.</span></a>
      </div>
    </div>
    <div class="hero-sheet">
      <div class="sheet-head"><div class="sname" style="font-family:var(--f-quran);font-size:24px;color:var(--gold)">سورة الفاتحة</div></div>
      <div class="quran tajweed" style="--qsize:26px">${fat}</div>
      <div class="hero-legend">${['madd_lazim', 'madd_muttasil', 'ghunnah', 'ikhfa', 'idgham_g', 'qalqala', 'silent'].map((k) => `<span><span class="dot" style="background:var(--tj-${k})"></span>${RULES[k].name}</span>`).join('')}</div>
    </div>
  </section>
  <ul class="feature-list">
    <li><b>متابعة حية:</b> مؤشر يتقدم مع قراءتك، وتلوين فوري للكلمة الصحيحة أو المتروكة.</li>
    <li><b>تسميع غيباً:</b> النص مخفي، وتظهر كل كلمة عندما تقرؤها صحيحة، مع زر تلميح.</li>
    <li><b>تصحيح دقيق وصادق:</b> مطابقة ذكية تفهم الرسم العثماني، بلا درجات دنيا مصطنعة.</li>
    <li><b>ألوان التجويد آلياً:</b> الإخفاء والإدغام والإقلاب والقلقلة والمدود في أي آية.</li>
    <li><b>${ar(RECITERS.length)} قارئاً:</b> استماع للآية أو المقطع مع التكرار والتحكم بالسرعة.</li>
    <li><b>تحليل التجويد بالذكاء الاصطناعي:</b> المدود والغنة والقلقلة والحركات لكل كلمة، للإعانة لا للاعتماد.</li>
    <li><b>للمعلم:</b> درجة من ١٠ وملاحظات، ونظام يتعلم من تقييماتك، وتقارير بالكلمات الأكثر خطأً، وتصدير Excel.</li>
  </ul>`;
}

/* ================= التدريب الحر (للطلاب المسجلين والمعلم فقط) ================= */
let pendingPractice = null;
function mountPractice(host, learn) {
  const init = pendingPractice || pref.get('lastRange', { surah: 36, from: 1, to: 12 });
  pendingPractice = null;
  host.innerHTML = `<p class="muted" style="margin:0 0 12px">اختر أي مقطع ثم اضغط زر الميكروفون وابدأ القراءة. التدريب لا يُرسل للمعلم.</p>
    <div class="card" style="margin-bottom:16px">${rangePicker('pr', init)}</div>
    <div id="prBody"></div>`;
  let comp = null;
  const mount = (r) => { comp?.destroy(); pref.set('lastRange', r); comp = mountRecite($('#prBody', host), { ...r, mode: init.mode, learn }); };
  bindRangePicker(host, 'pr', mount);
  mount({ surah: init.surah, from: init.from, to: init.to });
  return { destroy: () => comp?.destroy() };
}
function viewPractice(app) {
  const s = session.get();
  if (s?.role === 'student') { studentStartTab = 'practice'; navTo('student'); return; }
  if (s?.role !== 'teacher') {
    app.innerHTML = `<div class="card auth stack"><h2>التدريب للطلاب المسجلين</h2>
      <p class="muted" style="margin:0">ادخل برقمك الشخصي لتتدرب على أي سورة، وتحفظ تقدمك ودفتر أخطائك.</p>
      <a class="btn primary" href="#/student">دخول الطالب</a></div>`;
    return null;
  }
  app.innerHTML = `<div class="page-head"><div><span class="muted small">معاينة المعلم</span><h1>تدريب حر</h1></div></div><div id="prHost"></div>`;
  return mountPractice($('#prHost', app), null);
}
let studentStartTab = null;

/* ================= الطالب ================= */
function viewStudent(app) {
  const s = session.get();
  if (!s || s.role !== 'student') return studentLogin(app);
  let comp = null;
  let tab = studentStartTab || 'tasks';
  studentStartTab = null;
  let data = { tasks: [], subs: [], classes: [] };
  const me = s.student;

  async function load() {
    app.innerHTML = '<div class="loading">جارٍ تحميل بياناتك…</div>';
    try {
      const [tasks, subs, classes] = await Promise.all([store.listTasks(), store.studentSubmissions(me.id), store.listClasses()]);
      data = { tasks: tasks.filter((t) => t.classId === 'all' || t.classId === me.classId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), subs: subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), classes };
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="empty">تعذر تحميل البيانات: ${esc(e.message)}</div>`;
      return;
    }
    draw();
  }

  function draw() {
    comp?.destroy(); comp = null;
    const cls = data.classes.find((c) => c.id === me.classId);
    const graded = data.subs.filter((x) => x.percent != null);
    const avg = graded.length ? Math.round(graded.reduce((n, x) => n + x.percent, 0) / graded.length) : null;
    const doneTasks = new Set(data.subs.map((x) => x.taskId).filter(Boolean));
    const days = new Set(data.subs.map((x) => (x.createdAt || '').slice(0, 10)));
    let streak = 0;
    for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { if (days.has(d.toISOString().slice(0, 10))) streak++; else if (streak || d.toDateString() !== new Date().toDateString()) break; }
    app.innerHTML = `
      <div class="page-head">
        <div><span class="muted small">${esc(cls?.name || '')}</span><h1>السلام عليكم، ${esc(me.name)}</h1></div>
        <button class="btn" id="stOut" type="button">تسجيل الخروج</button>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${ar(doneTasks.size)}/${ar(data.tasks.length)}</b><span>واجبات منجزة</span></div>
        <div class="kpi"><b>${avg == null ? '—' : ar(avg) + '٪'}</b><span>متوسط دقة الحفظ</span></div>
        <div class="kpi"><b>${ar(data.subs.length)}</b><span>مرات التسميع</span></div>
        <div class="kpi"><b>${ar(streak)}</b><span>أيام متتالية</span></div>
      </div>
      <div class="tabs" role="tablist">
        ${[['tasks', 'واجباتي'], ['practice', 'تدريب حر'], ['history', 'سجل التسميع'], ['notebook', 'دفتر الأخطاء']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div id="stBody" style="margin-top:16px"></div>`;
    $('#stOut', app).onclick = () => { session.set(null); render(); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    const body = $('#stBody', app);
    if (tab === 'tasks') drawTasks(body, doneTasks);
    if (tab === 'history') drawHistory(body);
    if (tab === 'notebook') drawNotebook(body);
    if (tab === 'practice') drawPractice(body);
  }

  async function drawPractice(body) {
    let learn = null;
    try {
      const model = await store.getModel();
      learn = { model, rates: studentRates(model, data.subs), weak: weakRules(model, data.subs, 3) };
    } catch {}
    if (tab !== 'practice') return;
    comp?.destroy();
    comp = mountPractice(body, learn);
  }

  function drawTasks(body, done) {
    if (!data.tasks.length) { body.innerHTML = '<div class="empty">لا توجد واجبات حالياً. يمكنك التدرب على أي سورة من تبويب «تدريب حر».</div>'; return; }
    body.innerHTML = `<div class="stack">${data.tasks.map((t) => {
      const mySubs = data.subs.filter((x) => x.taskId === t.id);
      const best = mySubs.reduce((m, x) => Math.max(m, x.percent ?? -1), -1);
      const overdue = t.due && !done.has(t.id) && new Date(t.due) < new Date(new Date().toDateString());
      return `<div class="card task">
        <div class="t-main"><h3>${esc(t.title)}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
          <div class="small muted">${t.mode === 'hifz' ? 'تسميع غيباً' : 'تلاوة نظراً'}${t.due ? ` · التسليم ${fmtDate(t.due)}` : ''}${t.notes ? ` · ${esc(t.notes)}` : ''}</div></div>
        <div class="row">${done.has(t.id) ? `<span class="pill ok">أُرسل${best >= 0 ? ` · ${ar(best)}٪` : ''}</span>` : overdue ? '<span class="pill bad">متأخر</span>' : '<span class="pill warn">لم يُنجز</span>'}
        <button class="btn primary" type="button" data-task="${esc(t.id)}">${done.has(t.id) ? 'تسميع مرة أخرى' : 'ابدأ التسميع'}</button></div></div>`;
    }).join('')}</div>`;
    $$('[data-task]', body).forEach((b) => (b.onclick = () => openTask(data.tasks.find((t) => t.id === b.dataset.task))));
  }

  async function openTask(t) {
    comp?.destroy();
    let learn = null;
    try {
      const model = await store.getModel();
      const rates = studentRates(model, data.subs);
      learn = { model, rates, weak: weakRules(model, data.subs, 3) };
    } catch {}
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="tkBack" type="button">→ رجوع للواجبات</button><h1>${esc(t.title)}</h1>
      <p class="muted" style="margin:4px 0 0">${t.notes ? esc(t.notes) : 'اقرأ المقطع كاملاً ثم أرسل تسجيلك للمعلم.'}</p></div></div><div id="tkBody"></div>`;
    $('#tkBack', app).onclick = () => { comp?.destroy(); draw(); };
    const cls = data.classes.find((c) => c.id === me.classId);
    comp = mountRecite($('#tkBody', app), {
      surah: t.surah, from: t.from, to: t.to, mode: t.mode, learn,
      onSubmit: async (sub, blob) => {
        await store.addSubmission(me.id, { ...sub, taskId: t.id, taskTitle: t.title, studentName: me.name, classId: me.classId, className: cls?.name || '', teacher: null }, blob);
        toast('تم إرسال التسميع إلى المعلم. جزاك الله خيراً.');
        await load();
      },
    });
  }

  function drawHistory(body) {
    if (!data.subs.length) { body.innerHTML = '<div class="empty">لم تُرسل أي تسميع بعد.</div>'; return; }
    body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المقطع</th><th>الدقة الآلية</th><th>تقييم المعلم</th><th>ملاحظات</th></tr></thead><tbody>
      ${data.subs.map((x, i) => `<tr class="click" data-i="${i}"><td class="num">${fmtDate(x.createdAt)}</td><td>${esc(x.taskTitle || rangeLabel(x.surah, x.from, x.to))}</td>
      <td>${x.percent == null ? '<span class="pill mute">بانتظار المعلم</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td>
      <td>${x.teacher ? `<b class="num">${ar(x.teacher.total)}</b>/١٠` : '<span class="muted">—</span>'}</td><td style="white-space:normal;min-width:160px">${esc(x.teacher?.notes || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
    $$('tr[data-i]', body).forEach((r) => (r.onclick = () => {
      const x = data.subs[+r.dataset.i];
      openModal(`<h2>${esc(x.taskTitle || 'تسميع')}</h2><p class="muted">${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)}</p>
        ${x.teacher ? `<div class="card" style="margin-bottom:12px"><b>درجة المعلم: ${ar(x.teacher.total)} / ١٠</b>${x.teacher.notes ? `<p style="margin:8px 0 0">${esc(x.teacher.notes)}</p>` : ''}</div>` : ''}
        <div class="stack">${x.statuses || x.tj?.length || x.ai ? wordMapHtml(x, { colored: true }) : ''}${tjMarksHtml(x)}${aiListHtml(x)}</div>`);
    }));
  }

  async function drawNotebook(body) {
    let weakHtml = '';
    try {
      const model = await store.getModel();
      const weak = weakRules(model, data.subs, 6);
      if (weak.length) weakHtml = `<div class="card stack" style="gap:8px;margin-bottom:16px"><h3>أحكام التجويد التي تحتاج تدريباً</h3>
        ${weak.map((w) => `<div class="row" style="justify-content:space-between"><span><b>${esc(ruleName(w.r))}</b> <span class="small muted">أخطأت فيه ${ar(w.errs)} من ${ar(w.seen)} موضعاً قيّمه المعلم</span></span><span class="pill ${w.p > 0.4 ? 'bad' : 'warn'}">${ar(Math.round(w.p * 100))}٪</span></div>`).join('')}</div>`;
    } catch {}
    const agg = new Map();
    data.subs.forEach((x) => (x.mistakes || []).forEach((m) => {
      const k = `${x.surah}:${m.a}:${m.w}`;
      const e = agg.get(k) || { surah: x.surah, a: m.a, w: m.w, n: 0, last: x.createdAt };
      e.n++; agg.set(k, e);
    }));
    const list = [...agg.values()].sort((a, b) => b.n - a.n).slice(0, 60);
    if (!list.length) { body.innerHTML = weakHtml + '<div class="empty">دفترك نظيف. الكلمات التي تخطئ فيها ستظهر هنا لتراجعها.</div>'; return; }
    body.innerHTML = weakHtml + `<p class="muted">الكلمات التي تكرر فيها الخطأ أو الترك، مرتبة من الأكثر. اضغط «راجع» للتدرّب على الآية.</p>
      <div class="grid3">${list.map((e, i) => `<div class="card row" style="justify-content:space-between"><div><span class="word-chip">${esc(e.w)}</span><div class="small muted" style="margin-top:6px">${esc(surahName(e.surah))} · آية ${ar(e.a)} · ${ar(e.n)} مرة</div></div><button class="btn sm" data-nb="${i}" type="button">راجع</button></div>`).join('')}</div>`;
    $$('[data-nb]', body).forEach((b) => (b.onclick = () => { const e = list[+b.dataset.nb]; pendingPractice = { surah: e.surah, from: e.a, to: e.a, mode: 'hifz' }; tab = 'practice'; draw(); scrollTo(0, 0); }));
  }

  load();
  return { destroy: () => comp?.destroy() };
}

function studentLogin(app) {
  app.innerHTML = `<div class="card auth stack">
    <h2>دخول الطالب</h2>
    <p class="muted" style="margin:0">أدخل رقمك الشخصي الذي سجّلك به المعلم.</p>
    <form id="slForm" class="stack" style="gap:12px">
      <label class="field">الرقم الشخصي<input type="text" id="slPn" inputmode="numeric" autocomplete="off" required></label>
      <div id="slErr" class="notice" hidden></div>
      <button class="btn primary" type="submit">دخول</button>
    </form>
    <p class="small muted" style="margin:0">لا تملك رقماً؟ اطلبه من معلمك.</p>
  </div>`;
  $('#slForm', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    const pn = $('#slPn', app).value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
    try {
      const student = await store.studentSignIn(pn);
      session.set({ role: 'student', student });
      render();
    } catch (err) {
      const box = $('#slErr', app); box.hidden = false; box.textContent = err.message; btn.disabled = false;
    }
  };
}

/* ================= المعلم ================= */
const sortClasses = (arr) => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
const G2 = [1, 2, 3, 4, 5].map((n) => ({ id: `g2-${n}`, name: `الثاني الإعدادي ${ar(n)}` }));
function viewTeacher(app) {
  const s = session.get();
  if (!s || s.role !== 'teacher') return teacherLogin(app);
  let tab = pref.get('tTab', 'subs');
  let D = { classes: [], students: [], tasks: [], subs: [] };
  let unsub = null;
  let filters = { cls: 'all', task: 'all', q: '', status: 'all' };

  async function load() {
    app.innerHTML = '<div class="loading">جارٍ تحميل لوحة المعلم…</div>';
    try {
      const [classes, students, tasks] = await Promise.all([store.listClasses(), store.listStudents(), store.listTasks()]);
      D = { ...D, classes: sortClasses(classes), students, tasks };
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="empty">تعذر تحميل البيانات (${esc(e.code || e.message)}). تأكد من صلاحيات المعلم في قاعدة البيانات.<br><br><button class="btn" id="tOut2">تسجيل الخروج</button></div>`;
      $('#tOut2', app).onclick = async () => { await store.signOut(); session.set(null); render(); };
      return;
    }
    unsub?.();
    unsub = store.watchSubmissions((subs) => { D.subs = subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); if (tab === 'subs' || tab === 'reports') drawBody(); else drawHead(); }, (e) => toast('تعذر تحديث التسليمات: ' + (e.code || e.message)));
    draw();
  }
  const reload = async () => {
    const [classes, students, tasks] = await Promise.all([store.listClasses(), store.listStudents(), store.listTasks()]);
    D = { ...D, classes: sortClasses(classes), students, tasks };
    drawBody();
  };
  const className = (id) => (id === 'all' ? 'كل الصفوف' : D.classes.find((c) => c.id === id)?.name || '—');

  function draw() {
    app.innerHTML = `
      <div class="page-head">
        <div><span class="muted small">لوحة المعلم</span><h1>${esc(s.name || 'المعلم')}</h1></div>
        <div class="row"><a class="btn" href="#/practice">معاينة التدريب</a><button class="btn" id="tOut" type="button">تسجيل الخروج</button></div>
      </div>
      <div class="kpis" id="tKpis"></div>
      <div class="tabs" role="tablist">${[['subs', 'التسليمات'], ['tasks', 'الواجبات'], ['people', 'الصفوف والطلاب'], ['reports', 'التقارير'], ['settings', 'الإعدادات']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="tBody" style="margin-top:16px"></div>`;
    $('#tOut', app).onclick = async () => { unsub?.(); await store.signOut(); session.set(null); render(); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; pref.set('tTab', tab); $$('[data-tab]', app).forEach((x) => x.classList.toggle('on', x === b)); drawBody(); }));
    drawBody();
  }
  function drawHead() {
    const k = $('#tKpis', app); if (!k) return;
    const pending = D.subs.filter((x) => !x.teacher).length;
    const auto = D.subs.filter((x) => x.percent != null);
    const avg = auto.length ? Math.round(auto.reduce((n, x) => n + x.percent, 0) / auto.length) : null;
    const week = D.subs.filter((x) => Date.now() - new Date(x.createdAt) < 7 * 864e5).length;
    k.innerHTML = `<div class="kpi"><b>${ar(pending)}</b><span>بانتظار تقييمك</span></div>
      <div class="kpi"><b>${ar(week)}</b><span>تسميع هذا الأسبوع</span></div>
      <div class="kpi"><b>${avg == null ? '—' : ar(avg) + '٪'}</b><span>متوسط الدقة الآلية</span></div>
      <div class="kpi"><b>${ar(D.students.length)}</b><span>طالباً في ${ar(D.classes.length)} صفوف</span></div>`;
  }
  function drawBody() {
    drawHead();
    const body = $('#tBody', app); if (!body) return;
    ({ subs: drawSubs, tasks: drawTasks, people: drawPeople, reports: drawReports, settings: drawSettings })[tab](body);
  }

  /* --- التسليمات --- */
  function drawSubs(body) {
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    body.innerHTML = `<div class="row" style="margin-bottom:12px">
      <input type="search" id="fQ" placeholder="بحث باسم الطالب أو رقمه" value="${esc(filters.q)}" style="flex:2 1 200px">
      <select id="fC" style="flex:1 1 140px">${opt('all', 'كل الصفوف', filters.cls)}${D.classes.map((c) => opt(c.id, c.name, filters.cls)).join('')}</select>
      <select id="fT" style="flex:1 1 160px">${opt('all', 'كل الواجبات', filters.task)}${opt('free', 'بدون واجب', filters.task)}${D.tasks.map((t) => opt(t.id, t.title, filters.task)).join('')}</select>
      <select id="fS" style="flex:1 1 140px">${opt('all', 'كل الحالات', filters.status)}${opt('pending', 'بانتظار التقييم', filters.status)}${opt('graded', 'مُقيَّمة', filters.status)}</select>
      <button class="btn" id="fX" type="button">تصدير Excel</button>
    </div><div id="subList"></div>`;
    const list = () => D.subs.filter((x) =>
      (filters.cls === 'all' || x.classId === filters.cls) &&
      (filters.task === 'all' || (filters.task === 'free' ? !x.taskId : x.taskId === filters.task)) &&
      (filters.status === 'all' || (filters.status === 'pending' ? !x.teacher : !!x.teacher)) &&
      (!filters.q || (x.studentName || '').includes(filters.q) || (x.pn || '').includes(filters.q)));
    const paint = () => {
      const L = list();
      $('#subList', body).innerHTML = L.length ? `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الصف</th><th>الواجب / المقطع</th><th>التاريخ</th><th>الدقة الآلية</th><th>المدة</th><th>تقييمك</th></tr></thead><tbody>
        ${L.map((x) => `<tr class="click" data-id="${esc(x.id)}" data-pn="${esc(x.pn)}"><td><b>${esc(x.studentName)}</b><div class="small muted num">${esc(x.pn)}</div></td><td>${esc(x.className || className(x.classId))}</td>
        <td>${esc(x.taskTitle || 'تدريب')}<div class="small muted">${esc(rangeLabel(x.surah, x.from, x.to))}</div></td><td class="num">${fmtDate(x.createdAt)}</td>
        <td>${x.percent == null ? '<span class="pill mute">يدوي</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td><td class="num">${fmtTime(x.duration || 0)}</td>
        <td>${x.teacher ? `<span class="pill ok">${ar(x.teacher.total)}/١٠</span>` : '<span class="pill warn">بانتظارك</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لا توجد تسليمات مطابقة.</div>';
      $$('tr[data-id]', body).forEach((r) => (r.onclick = () => openSubmission(D.subs.find((x) => x.id === r.dataset.id && x.pn === r.dataset.pn))));
    };
    $('#fQ', body).oninput = (e) => { filters.q = e.target.value.trim(); paint(); };
    $('#fC', body).onchange = (e) => { filters.cls = e.target.value; paint(); };
    $('#fT', body).onchange = (e) => { filters.task = e.target.value; paint(); };
    $('#fS', body).onchange = (e) => { filters.status = e.target.value; paint(); };
    $('#fX', body).onclick = () => exportXlsx(list());
    paint();
  }

  function openSubmission(x) {
    if (!x) return;
    const t = x.teacher || {};
    const model = train(D.subs.filter((y) => y !== x));
    const mine = D.subs.filter((y) => y.pn === x.pn && y !== x);
    const rates = studentRates(model, mine);
    const suggested = predict(model, x, rates);
    const risky = riskyWords(x, rates, 8).filter((r) => r.risk >= 0.3);
    const riskSet = new Set(risky.map((r) => r.i));
    const words = rangeWords(x.surah, x.from, x.to);
    const segRules = segmentRules(x.surah, x.from, x.to);
    let marks = (x.tj || []).map((m) => ({ ...m }));
    let aiRes = x.ai || null;
    const weak = weakRules(model, mine, 3);
    openModal(`
      <div class="stack">
        <div><h2>${esc(x.studentName)} <span class="muted small num">${esc(x.pn)}</span></h2>
        <p class="muted" style="margin:4px 0 0">${esc(x.taskTitle || 'تدريب')} · ${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)} · ${x.mode === 'hifz' ? 'غيباً' : 'نظراً'}</p></div>
        <div class="row">${x.percent != null ? `<span class="pill ${pctClass(x.percent)}">الدقة الآلية ${ar(x.percent)}٪</span><span class="pill mute">صحيحة ${ar(x.counts?.correct || 0)} · خطأ ${ar(x.counts?.wrong || 0)} · محذوفة ${ar(x.counts?.missing || 0)}</span>` : '<span class="pill mute">بدون تصحيح آلي</span>'}<span class="pill mute">المدة ${fmtTime(x.duration || 0)}</span></div>
        <div id="sbAudio">${x.hasAudio ? '<button class="btn" id="sbLoad" type="button">تشغيل تسجيل الطالب</button>' : '<span class="muted small">لا يوجد تسجيل صوتي.</span>'}</div>
        ${risky.length ? `<div class="learn-note">استمع أولاً إلى المواضع المسطّرة: هي الأرجح أن يخطئ فيها هذا الطالب${weak.length ? `، فقد أخطأ سابقاً في ${weak.map((w) => `«${esc(ruleName(w.r))}»`).join(' و')}` : ''}.</div>` : ''}
        <div id="sbMap">${wordMapHtml({ ...x, tj: marks }, { colored: true, risky: riskSet })}</div>
        <div class="tj-menu small" id="sbMenu"><b>لتحديد خطأ تجويد:</b> اضغط على الكلمة في المصحف أعلاه، ثم اختر الحكم الذي أخطأ فيه الطالب. كل خطأ تحدده يتعلم منه النظام فوراً.</div>
        <div id="sbMarks"></div>
        <div id="sbAi"></div>
        ${x.transcript ? `<details><summary class="small">النص الذي التقطه التعرف على الكلام</summary><p class="small muted">${esc(x.transcript)}</p></details>` : ''}
        <form id="sbForm" class="card stack" style="gap:12px">
          <h3>درجة المقطع</h3>
          <div class="grade-box">
            <input type="number" id="gTotal" min="0" max="10" step="0.5" value="${t.total ?? suggested}" aria-label="الدرجة من ١٠"><b>/ ١٠</b>
            <span class="small muted">اقتراح النظام: <b>${ar(suggested)}</b>${model.n ? ` (تعلّم من ${ar(model.n)} تقييماً)` : ' (تقدير أولي قبل أي تقييم)'}</span>
          </div>
          <label class="row small" style="gap:6px"><input type="checkbox" id="gTjDone" ${x.tjDone !== false ? 'checked' : ''}> استمعت وحددت أخطاء التجويد في هذا المقطع (إن لم تحدد شيئاً فهذا يعني أن التجويد سليم)</label>
          <label class="field">ملاحظات للطالب<textarea id="gN" placeholder="مثال: انتبه للإخفاء في «من قبل»، وأطل المد المتصل.">${esc(t.notes || '')}</textarea></label>
          <div class="row"><button class="btn primary" type="submit">حفظ التقييم</button><button class="btn danger" type="button" id="sbDel">حذف التسليم</button></div>
        </form>
      </div>`, (m) => {
      const lb = $('#sbLoad', m);
      if (lb) lb.onclick = async () => {
        lb.disabled = true; lb.textContent = 'جارٍ التحميل…';
        try {
          const blob = await store.getAudio(x.pn, x.id);
          $('#sbAudio', m).innerHTML = blob ? `<audio controls autoplay src="${URL.createObjectURL(blob)}" style="width:100%"></audio>` : '<span class="muted small">لم يُعثر على التسجيل.</span>';
        } catch (e) { $('#sbAudio', m).innerHTML = `<span class="muted small">تعذر تحميل التسجيل: ${esc(e.message)}</span>`; }
      };
      const paintMarks = () => {
        $('#sbMap', m).innerHTML = wordMapHtml({ ...x, tj: marks }, { colored: true, risky: riskSet, ai: aiRes ? new Set(aiRes.errors.map((e) => e.i)) : null });
        $('#sbMarks', m).innerHTML = tjMarksHtml({ ...x, tj: marks });
        paintAi();
      };
      const has = (e) => marks.some((k) => k.i === e.i && k.r === e.r);
      function paintAi() {
        const box = $('#sbAi', m);
        if (!aiEnabled() && !aiRes) { box.innerHTML = ''; return; }
        if (!aiRes) {
          box.innerHTML = x.hasAudio ? `<div class="card stack" style="gap:8px"><h3>تحليل التجويد بالذكاء الاصطناعي</h3><p class="small muted" style="margin:0">يحدد المواضع المحتملة لأخطاء المدود والغنة والقلقلة والحركات، فتقبل منها ما تؤكده بأذنك.</p><button class="btn gold" type="button" id="aiRun">حلّل التسجيل</button><div class="small" id="aiProg"></div></div>` : '';
          const b = $('#aiRun', box);
          if (b) b.onclick = async () => {
            if (!(await ensureAiNotice())) return;
            b.disabled = true;
            try {
              const blob = await store.getAudio(x.pn, x.id);
              if (!blob) throw new Error('لم يُعثر على التسجيل.');
              aiRes = await aiAnalyze(blob, x, (t) => { const el = $('#aiProg', box); if (el) el.textContent = t; });
              paintMarks();
            } catch (err) { const el = $('#aiProg', box); if (el) el.textContent = err.message; b.disabled = false; }
          };
          return;
        }
        const pending = aiRes.errors.filter((e) => !has(e));
        box.innerHTML = `<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><h3>اقتراحات الذكاء الاصطناعي (${ar(aiRes.errors.length)})</h3>${pending.length ? `<button class="btn sm" type="button" id="aiAll">قبول الكل</button>` : ''}</div>
          ${aiRes.skipped?.length ? `<div class="notice">آيات لم يسمعها النموذج: ${aiRes.skipped.map(ar).join('، ')}</div>` : ''}
          ${aiRes.errors.length ? `<ul class="mistakes">${aiRes.errors.slice(0, 60).map((e, k) => `<li><span><span class="qw">${esc(words[e.i]?.text || '')}</span> <span class="small muted">آية ${ar(words[e.i]?.ayah || 0)} · ${esc(aiDescribe(e, ruleName))}</span></span>
            <button class="btn sm ${has(e) ? 'primary' : ''}" type="button" data-ai="${k}">${has(e) ? 'مقبول ✓' : 'قبول'}</button></li>`).join('')}</ul>` : '<div class="small muted">لم يجد النموذج أخطاء.</div>'}
          <p class="small muted" style="margin:0">ما تقبله يُحفظ ضمن أخطاء التجويد ويتعلم منه النظام، وما تتركه يُحسب على دقة النموذج في التقارير.</p>
          <p class="ai-notice small-notice">${AI_NOTICE}</p></div>`;
        $$('[data-ai]', box).forEach((b) => (b.onclick = () => {
          const e = aiRes.errors[+b.dataset.ai];
          if (has(e)) marks = marks.filter((k) => !(k.i === e.i && k.r === e.r)); else marks.push({ i: e.i, r: e.r });
          paintMarks();
        }));
        const all = $('#aiAll', box);
        if (all) all.onclick = () => { pending.forEach((e) => marks.push({ i: e.i, r: e.r })); paintMarks(); };
      }
      paintMarks();
      $('#sbMap', m).addEventListener('click', (e) => {
        const w = e.target.closest('.w'); if (!w) return;
        const i = +w.dataset.i;
        const opts = [...new Set([...segRules[i], ...(aiRes ? aiRes.errors.filter((e) => e.i === i).map((e) => e.r) : []), 'makhraj', 'haraka'])];
        const on = new Set(marks.filter((k) => k.i === i).map((k) => k.r));
        $('#sbMenu', m).innerHTML = `<div class="row" style="gap:8px"><span class="qw" style="font-family:var(--f-quran);font-size:22px">${esc(words[i].text)}</span><span class="muted">آية ${ar(words[i].ayah)}: ما الخطأ؟</span></div>
          <div class="row" style="gap:6px;margin-top:8px">${opts.map((r) => `<button type="button" class="chip ${on.has(r) ? 'on' : ''}" data-r="${r}">${esc(ruleName(r))}</button>`).join('')}</div>`;
        $$('[data-r]', $('#sbMenu', m)).forEach((b) => (b.onclick = () => {
          const r = b.dataset.r;
          if (marks.some((k) => k.i === i && k.r === r)) marks = marks.filter((k) => !(k.i === i && k.r === r));
          else marks.push({ i, r });
          b.classList.toggle('on');
          paintMarks();
        }));
      });
      $('#sbForm', m).onsubmit = async (e) => {
        e.preventDefault();
        const v = parseFloat($('#gTotal', m).value);
        if (isNaN(v)) return toast('اكتب الدرجة من ١٠.');
        const teacher = { total: Math.max(0, Math.min(10, Math.round(v * 2) / 2)), notes: $('#gN', m).value.trim(), suggested, at: new Date().toISOString() };
        const patch = { teacher, tj: marks, tjDone: $('#gTjDone', m).checked, ...(aiRes ? { ai: aiRes } : {}) };
        try {
          await store.updateSubmission(x.pn, x.id, patch);
          Object.assign(x, patch);
          closeModal();
          if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
          const all = D.subs.map((y) => (y.id === x.id && y.pn === x.pn ? { ...y, ...patch } : y));
          store.setModel(pack(train(all))).catch((err) => console.warn('model save', err));
          toast(`حُفظت الدرجة${marks.length ? ` و${marks.length} من أخطاء التجويد` : ''}، وتعلّم منها النظام.`);
          drawBody();
        } catch (err) { toast('تعذر الحفظ: ' + err.message); }
      };
      $('#sbDel', m).onclick = async () => {
        if (!(await confirmBox(`حذف تسليم ${x.studentName}؟ لا يمكن التراجع.`))) return;
        await store.deleteSubmission(x.pn, x.id);
        if (store.mode === 'local') D.subs = D.subs.filter((y) => y !== x);
        toast('حُذف التسليم.'); drawBody();
      };
    });
  }

  function exportXlsx(rows) {
    const data = rows.map((x) => ({
      'الطالب': x.studentName, 'الرقم': x.pn, 'الصف': x.className || className(x.classId), 'الواجب': x.taskTitle || 'تدريب',
      'السورة': surahName(x.surah), 'من': x.from, 'إلى': x.to, 'التاريخ': fmtDate(x.createdAt), 'الدقة الآلية %': x.percent ?? '',
      'صحيحة': x.counts?.correct ?? '', 'خطأ': x.counts?.wrong ?? '', 'محذوفة': x.counts?.missing ?? '',
      'درجة المعلم /10': x.teacher?.total ?? '', 'أخطاء التجويد': (x.tj || []).map((k) => ruleName(k.r)).join('، '), 'ملاحظات': x.teacher?.notes ?? '',
    }));
    if (!window.XLSX) { toast('مكتبة Excel لم تُحمّل بعد. أعد المحاولة بعد لحظات.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0] || { a: 1 }).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'التسليمات');
    XLSX.writeFile(wb, `تسليمات-المقرأة-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /* --- الواجبات --- */
  function drawTasks(body) {
    const last = pref.get('lastRange', { surah: 36, from: 1, to: 12 });
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <form class="card stack" id="tkForm" style="gap:12px">
        <h3>واجب جديد</h3>
        <label class="field">العنوان<input type="text" id="tkTitle" required placeholder="مثال: حفظ أول سورة يس"></label>
        ${rangePicker('tk', last)}
        <div class="row">
          <label class="field" style="flex:1 1 140px">الصف<select id="tkClass"><option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:1 1 140px">النوع<select id="tkMode"><option value="hifz">تسميع غيباً</option><option value="recite">تلاوة نظراً</option></select></label>
          <label class="field" style="flex:1 1 140px">آخر موعد<input type="date" id="tkDue"></label>
        </div>
        <label class="field">تعليمات للطلاب (اختياري)<input type="text" id="tkNotes" placeholder="مثال: ركّز على أحكام النون الساكنة"></label>
        <button class="btn primary" type="submit">إضافة الواجب</button>
      </form>
      <div class="stack" id="tkList"></div>
    </div>`;
    const readRange = bindRangePicker(body, 'tk', (r) => { if (!$('#tkTitle', body).dataset.touched) $('#tkTitle', body).value = `${surahName(r.surah)} ${r.from}–${r.to}`; });
    $('#tkTitle', body).value = `${surahName(last.surah)} ${last.from}–${last.to}`;
    $('#tkTitle', body).oninput = (e) => (e.target.dataset.touched = '1');
    $('#tkForm', body).onsubmit = async (e) => {
      e.preventDefault();
      const r = readRange();
      await store.saveTask({ title: $('#tkTitle', body).value.trim(), ...r, classId: $('#tkClass', body).value, mode: $('#tkMode', body).value, due: $('#tkDue', body).value || '', notes: $('#tkNotes', body).value.trim() });
      toast('أُضيف الواجب وسيظهر لطلاب الصف.');
      await reload();
    };
    const L = [...D.tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('#tkList', body).innerHTML = L.length ? L.map((t) => {
      const target = D.students.filter((st) => t.classId === 'all' || st.classId === t.classId);
      const doneSet = new Set(D.subs.filter((x) => x.taskId === t.id).map((x) => x.pn));
      const done = target.filter((st) => doneSet.has(st.id)).length;
      return `<div class="card task"><div class="t-main"><h3>${esc(t.title)}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
        <div class="small muted">${esc(className(t.classId))} · ${t.mode === 'hifz' ? 'غيباً' : 'نظراً'}${t.due ? ` · حتى ${fmtDate(t.due)}` : ''}</div>
        <div class="progress" style="margin-top:8px;max-width:260px"><i style="width:${target.length ? (done / target.length) * 100 : 0}%"></i></div><div class="small muted">${ar(done)} من ${ar(target.length)} طالباً أرسلوا</div></div>
        <button class="btn sm danger" type="button" data-del="${esc(t.id)}">حذف</button></div>`;
    }).join('') : '<div class="empty">لم تُنشئ أي واجب بعد. أنشئ الأول من النموذج.</div>';
    $$('[data-del]', body).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('حذف هذا الواجب؟ تبقى تسليمات الطلاب محفوظة.'))) return; await store.deleteTask(b.dataset.del); await reload(); }));
  }

  /* --- الصفوف والطلاب --- */
  function drawPeople(body) {
    const firstCls = D.classes[0]?.id || '';
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="stack">
        <div class="card stack" style="gap:10px"><h3>الصفوف</h3>
          ${D.classes.map((c) => `<div class="row" style="justify-content:space-between"><span>${esc(c.name)} <span class="muted small">(${ar(D.students.filter((s) => s.classId === c.id).length)} طالباً)</span></span><span class="row" style="gap:4px"><button class="btn sm" data-ren="${esc(c.id)}" type="button">تعديل</button><button class="btn sm danger" data-delc="${esc(c.id)}" type="button">حذف</button></span></div>`).join('') || '<span class="muted">لا توجد صفوف.</span>'}
          ${G2.some((g) => !D.classes.find((c) => c.id === g.id)) ? `<button class="btn gold" id="clSeed" type="button">إنشاء صفوف الثاني الإعدادي (١–٥)</button>` : ''}
          <form id="clForm" class="row"><input type="text" id="clName" placeholder="اسم صف جديد" required style="flex:1"><button class="btn primary" type="submit">إضافة</button></form>
        </div>
        <div class="card stack" style="gap:10px"><h3>إضافة طلاب</h3>
          <label class="field">الصف<select id="stClass">${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field">طالب في كل سطر: الاسم، الرقم الشخصي<textarea id="stBulk" placeholder="عبدالله أحمد، 1023&#10;يوسف خالد، 1024"></textarea></label>
          <div class="row"><button class="btn primary" id="stAdd" type="button">إضافة</button><label class="btn">استيراد من Excel أو CSV<input type="file" id="stFile" accept=".xlsx,.xls,.csv" hidden></label></div>
          <p class="small muted" style="margin:0">في ملف Excel: العمود الأول الاسم، والثاني الرقم الشخصي، والثالث (اختياري) اسم الصف كما هو مكتوب هنا.</p>
        </div>
      </div>
      <div class="card stack" style="gap:10px">
        <div class="row" style="justify-content:space-between"><h3>الطلاب (${ar(D.students.length)})</h3><input type="search" id="stQ" placeholder="بحث" style="max-width:200px"></div>
        <div id="stList"></div>
      </div>
    </div>`;
    $('#stClass', body).value = firstCls;
    const seed = $('#clSeed', body);
    if (seed) seed.onclick = async () => {
      seed.disabled = true;
      for (const g of G2) if (!D.classes.find((c) => c.id === g.id)) await store.saveClass(g);
      toast('أُنشئت صفوف الثاني الإعدادي.');
      await reload();
    };
    $('#clForm', body).onsubmit = async (e) => { e.preventDefault(); await store.saveClass({ name: $('#clName', body).value.trim() }); toast('أُضيف الصف.'); await reload(); };
    $$('[data-ren]', body).forEach((b) => (b.onclick = () => {
      const c = D.classes.find((x) => x.id === b.dataset.ren);
      openModal(`<form id="rnF" class="stack"><h3>تعديل اسم الصف</h3><input type="text" id="rnN" value="${esc(c.name)}" required><button class="btn primary" type="submit">حفظ</button></form>`, (m) => {
        $('#rnF', m).onsubmit = async (e) => { e.preventDefault(); await store.saveClass({ id: c.id, name: $('#rnN', m).value.trim(), createdAt: c.createdAt }); closeModal(); await reload(); };
      });
    }));
    $$('[data-delc]', body).forEach((b) => (b.onclick = async () => {
      const n = D.students.filter((s) => s.classId === b.dataset.delc).length;
      if (n) return toast(`انقل طلاب هذا الصف (${n}) أو احذفهم أولاً.`);
      if (!(await confirmBox('حذف هذا الصف؟'))) return;
      await store.deleteClass(b.dataset.delc); await reload();
    }));
    const addMany = async (arr) => {
      const clean = arr.filter((x) => x.name && x.id);
      if (!clean.length) return toast('لم نجد أسماء وأرقاماً صالحة.');
      const dup = clean.filter((x) => D.students.some((s) => s.id === x.id && s.name !== x.name));
      await store.saveStudents(clean);
      toast(`أُضيف ${clean.length} طالباً${dup.length ? ` (حُدّثت بيانات ${dup.length} رقماً موجوداً)` : ''}.`);
      await reload();
    };
    const normPn = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\s/g, '');
    $('#stAdd', body).onclick = () => {
      const cid = $('#stClass', body).value;
      addMany($('#stBulk', body).value.split('\n').map((l) => l.split(/[,،\t;]/)).map(([n, p]) => ({ name: (n || '').trim(), id: normPn(p), classId: cid })));
    };
    $('#stFile', body).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!window.XLSX) return toast('مكتبة Excel لم تُحمّل بعد.');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const cid = $('#stClass', body).value;
      const arr = rows.filter((r) => r && r[0] && r[1] && !/اسم|name/i.test(String(r[0]))).map((r) => {
        const cName = r[2] ? String(r[2]).trim() : '';
        const c = cName && D.classes.find((x) => x.name === cName);
        return { name: String(r[0]).trim(), id: normPn(r[1]), classId: c ? c.id : cid };
      });
      e.target.value = '';
      addMany(arr);
    };
    const paint = (q = '') => {
      const L = D.students.filter((s) => !q || s.name.includes(q) || s.id.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      $('#stList', body).innerHTML = L.length ? `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الرقم</th><th>الصف</th><th>تسميع</th><th></th></tr></thead><tbody>
        ${L.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">${esc(s.id)}</td><td><select data-mv="${esc(s.id)}">${D.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === s.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td>
        <td class="num">${ar(D.subs.filter((x) => x.pn === s.id).length)}</td><td><button class="btn sm danger" data-dels="${esc(s.id)}" type="button">حذف</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا يوجد طلاب. أضفهم من النموذج.</div>';
      $$('[data-mv]', body).forEach((sel) => (sel.onchange = async () => { const s = D.students.find((x) => x.id === sel.dataset.mv); await store.saveStudents([{ ...s, classId: sel.value }]); s.classId = sel.value; toast('نُقل الطالب.'); }));
      $$('[data-dels]', body).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('حذف هذا الطالب؟ تبقى تسليماته في السجل.'))) return; await store.deleteStudent(b.dataset.dels); await reload(); }));
    };
    $('#stQ', body).oninput = (e) => paint(e.target.value.trim());
    paint();
  }

  /* --- التقارير --- */
  function drawReports(body) {
    const byClass = D.classes.map((c) => {
      const subs = D.subs.filter((x) => x.classId === c.id);
      const auto = subs.filter((x) => x.percent != null);
      const graded = subs.filter((x) => x.teacher);
      return { c, n: subs.length, avg: auto.length ? Math.round(auto.reduce((a, x) => a + x.percent, 0) / auto.length) : null, tavg: graded.length ? Math.round((graded.reduce((a, x) => a + x.teacher.total, 0) / graded.length) * 10) / 10 : null };
    });
    const agg = new Map();
    D.subs.forEach((x) => (x.mistakes || []).forEach((m) => { const k = `${x.surah}:${m.a}:${m.w}`; const e = agg.get(k) || { s: x.surah, a: m.a, w: m.w, n: 0, who: new Set() }; e.n++; e.who.add(x.pn); agg.set(k, e); }));
    const top = [...agg.values()].sort((a, b) => b.who.size - a.who.size || b.n - a.n).slice(0, 16);
    const students = D.students.map((s) => {
      const subs = D.subs.filter((x) => x.pn === s.id && x.percent != null);
      return { s, n: D.subs.filter((x) => x.pn === s.id).length, avg: subs.length ? Math.round(subs.reduce((a, x) => a + x.percent, 0) / subs.length) : null };
    });
    const need = students.filter((x) => x.avg != null && x.avg < 70).sort((a, b) => a.avg - b.avg).slice(0, 10);
    const silent = students.filter((x) => x.n === 0).slice(0, 30);
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack" style="gap:12px"><h3>متوسط الدقة الآلية لكل صف</h3>
        ${byClass.map((r) => `<div class="bar-row"><span>${esc(r.c.name)}</span><div class="bar"><i style="width:${r.avg ?? 0}%"></i></div><b class="num">${r.avg == null ? '—' : ar(r.avg) + '٪'}</b></div>
        <div class="small muted" style="margin-top:-8px">${ar(r.n)} تسميع${r.tavg != null ? ` · متوسط درجتك ${ar(r.tavg)}/١٠` : ''}</div>`).join('') || '<span class="muted">لا توجد صفوف.</span>'}
      </div>
      <div class="card stack" style="gap:12px"><h3>الكلمات الأكثر خطأً بين الطلاب</h3>
        ${top.length ? `<div class="row" style="gap:8px">${top.map((e) => `<span title="${esc(surahName(e.s))} ${e.a}"><span class="word-chip">${esc(e.w)}</span> <span class="small muted">${esc(surahName(e.s))}:${ar(e.a)} · ${ar(e.who.size)} طالب</span></span>`).join('')}</div>` : '<span class="muted">ستظهر هنا بعد أول تسليمات مصححة آلياً.</span>'}
        <p class="small muted" style="margin:0">استخدمها لتحديد مواضع الشرح في الحصة القادمة.</p>
      </div>
      ${learnCard()}
      <div class="card stack" style="gap:8px"><h3>طلاب يحتاجون متابعة</h3>
        ${need.length ? need.map((x) => `<div class="row" style="justify-content:space-between"><span>${esc(x.s.name)} <span class="small muted">${esc(className(x.s.classId))}</span></span><span class="pill ${pctClass(x.avg)}">${ar(x.avg)}٪</span></div>`).join('') : '<span class="muted">لا يوجد طالب متوسطه أقل من ٧٠٪.</span>'}
      </div>
      <div class="card stack" style="gap:8px"><h3>لم يرسلوا أي تسميع بعد (${ar(students.filter((x) => x.n === 0).length)})</h3>
        ${silent.length ? `<div class="row" style="gap:6px">${silent.map((x) => `<span class="pill mute">${esc(x.s.name)}</span>`).join('')}</div>` : '<span class="muted">كل الطلاب أرسلوا.</span>'}
      </div>
    </div>`;
  }

  function learnCard() {
    const model = train(D.subs);
    const withSug = D.subs.filter((x) => x.teacher && typeof x.teacher.suggested === 'number').sort((a, b) => (a.teacher.at || '').localeCompare(b.teacher.at || ''));
    const mae = (arr) => (arr.length ? arr.reduce((s, x) => s + Math.abs(x.teacher.total - x.teacher.suggested), 0) / arr.length : null);
    const recent = mae(withSug.slice(-10)), early = mae(withSug.slice(0, 10));
    const rates = Object.entries(model.rates).map(([r, [occ, err]]) => ({ r, occ, err, p: occ ? err / occ : 0 })).filter((x) => x.err > 0).sort((a, b) => b.p - a.p).slice(0, 6);
    return `<div class="card stack" style="gap:10px"><h3>ما تعلّمه النظام من تقييماتك</h3>
      <div class="small muted">${ar(model.n)} مقطعاً مقيّماً، منها ${ar(model.tjN)} حُددت فيها أخطاء التجويد.</div>
      ${recent != null ? `<div>متوسط الفرق بين اقتراح النظام ودرجتك في آخر التقييمات: <b>${ar(recent.toFixed(1))}</b> درجة${withSug.length > 10 ? ` <span class="small muted">(كان ${ar(early.toFixed(1))} في أول ١٠ تقييمات)</span>` : ''}</div>` : '<div class="small muted">قيّم بعض التسليمات ليبدأ النظام في اقتراح الدرجات ومقارنتها بدرجاتك.</div>'}
      ${(() => { const rel = Object.entries(aiReliability(D.subs)).filter(([, v]) => v[0] >= 3).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6);
        return rel.length ? `<b class="small">دقة اقتراحات الذكاء الاصطناعي (نسبة ما قبلته منها)</b>${rel.map(([r, [n, ok]]) => `<div class="bar-row"><span>${esc(ruleName(r))}</span><div class="bar"><i style="width:${Math.round((ok / n) * 100)}%"></i></div><b class="num">${ar(Math.round((ok / n) * 100))}٪</b></div>`).join('')}<div class="small muted">نسبة منخفضة لحكمٍ ما تعني أن النموذج يكثر من الإنذارات الخاطئة فيه مع طلابك.</div>` : ''; })()}
      ${rates.length ? `<b class="small">أكثر الأحكام خطأً بين الطلاب</b>${rates.map((x) => `<div class="bar-row"><span>${esc(ruleName(x.r))}</span><div class="bar"><i style="width:${Math.round(x.p * 100)}%;background:var(--bad)"></i></div><b class="num">${ar(Math.round(x.p * 100))}٪</b></div>`).join('')}` : ''}
    </div>`;
  }

  /* --- الإعدادات --- */
  function drawSettings(body) {
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack" style="gap:10px"><h3>حفظ البيانات</h3>
        ${store.mode === 'cloud' ? '<p style="margin:0"><span class="pill ok">سحابي</span> البيانات محفوظة في Firebase وتظهر على كل الأجهزة.</p>' : '<p style="margin:0"><span class="pill warn">محلي</span> البيانات محفوظة في هذا المتصفح فقط. للعمل بين أجهزة الطلاب والمعلم فعّل Firebase (راجع ملف README).</p>'}
      </div>
      <div class="card stack" style="gap:10px"><h3>خادم تحليل التجويد</h3><div id="aiStatus" class="small muted">${aiEnabled() ? 'جارٍ الفحص…' : 'غير مفعّل. ضع رابط الخادم في ملف js/firebase-config.js (راجع muaalem-space/README.md).'}</div></div>
      ${store.mode === 'cloud' ? `<div class="card stack" style="gap:10px"><h3>نقل بيانات النسخة السابقة</h3>
        <p class="muted small" style="margin:0">ينسخ الطلاب وواجبات سورة يس من «مقرأة الفاتح» القديمة إلى النظام الجديد. التسليمات القديمة لا تُنقل.</p>
        <button class="btn" id="mig" type="button">نقل البيانات القديمة</button></div>` : ''}
    </div>`;
    if (aiEnabled()) aiHealth().then((h) => { const el = $('#aiStatus', body); if (el) el.innerHTML = h.model_error ? `<span class="pill bad">خطأ</span> ${esc(h.model_error)}` : h.model_ready ? `<span class="pill ok">جاهز</span> النموذج محمّل على ${esc(h.device)}${h.queue ? `، وفي الانتظار ${ar(h.queue)}` : ''}.` : '<span class="pill warn">يستيقظ</span> النموذج قيد التحميل.'; })
      .catch(() => { const el = $('#aiStatus', body); if (el) el.innerHTML = '<span class="pill warn">لا يستجيب</span> قد يكون الخادم نائماً؛ يستيقظ مع أول تحليل خلال دقيقة أو دقيقتين.'; });
    const mg = $('#mig', body);
    if (mg) mg.onclick = async () => {
      mg.disabled = true; mg.textContent = 'جارٍ النقل…';
      try { const r = await store.migrateLegacy(); toast(`نُقل ${r.students} طالباً و${r.tasks} واجباً.`); await reload(); }
      catch (e) { toast('تعذر النقل: ' + (e.code || e.message)); mg.disabled = false; mg.textContent = 'نقل البيانات القديمة'; }
    };
  }

  load();
  return { destroy: () => unsub?.() };
}

async function teacherLogin(app) {
  const st = await store.teacherState();
  const cloud = store.mode === 'cloud';
  app.innerHTML = `<div class="card auth stack">
    <h2>دخول المعلم</h2>
    <p class="muted" style="margin:0">${cloud ? 'ادخل بالبريد وكلمة المرور لحساب المعلم في Firebase.' : st.hasPassword ? 'أدخل كلمة مرور المعلم.' : 'أول دخول: اختر اسمك وكلمة مرور لحماية لوحة المعلم على هذا الجهاز.'}</p>
    <form id="tlForm" class="stack" style="gap:12px">
      ${cloud ? '<label class="field">البريد الإلكتروني<input type="email" id="tlU" autocomplete="username" required></label>' : st.hasPassword ? '' : '<label class="field">اسم المعلم<input type="text" id="tlU" required></label>'}
      <label class="field">كلمة المرور<input type="password" id="tlP" autocomplete="current-password" minlength="4" required></label>
      <div id="tlErr" class="notice" hidden></div>
      <button class="btn primary" type="submit">دخول</button>
    </form>
  </div>`;
  $('#tlForm', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    const box = $('#tlErr', app); box.hidden = true;
    try {
      const r = await store.teacherSignIn($('#tlU', app)?.value || '', $('#tlP', app).value);
      session.set({ role: 'teacher', name: r.name });
      render();
    } catch (err) {
      box.hidden = false;
      box.innerHTML = esc(err.message) + (err.uid ? `<br>أضف مستنداً في مجموعة <b>teachers</b> في Firestore بالمعرّف التالي ثم أعد الدخول:<div class="uid-box" style="margin-top:6px">${esc(err.uid)}</div>` : '');
      btn.disabled = false;
    }
  };
}

/* ================= التشغيل ================= */
(async function boot() {
  try {
    await Promise.all([loadQuran(), initStore()]);
  } catch (e) {
    $('#app').innerHTML = `<div class="empty">تعذر تحميل المصحف. تأكد من الاتصال ثم أعد تحميل الصفحة.</div>`;
    return;
  }
  setTokenProvider(() => store.idToken());
  $('#modeTag').textContent = store.mode === 'cloud' ? 'الحفظ: سحابي' : 'الحفظ: محلي على هذا الجهاز';
  if (cloudError) { const b = $('#banner'); b.hidden = false; b.textContent = 'تعذر الاتصال بقاعدة البيانات السحابية؛ تعمل المنصة الآن بالحفظ المحلي على هذا الجهاز.'; }
  render();
})();
