import { loadQuran, getSurahs, surahName, ayahCount, ayahWords, rangeWords, toArabicDigits as ar } from './quran.js';
import { align, score } from './align.js';
import { analyzeAyah, wordHtml, summarize, RULES } from './tajweed.js';
import { RecitationSession, AyahPlayer, RECITERS, hasRecognition, hasRecorder } from './speech.js';
import { initStore, store, cloudError } from './store.js';

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
  let last = null; // آخر نتيجة
  let sess = null;
  let lastBlob = null, lastDuration = 0, lastTranscript = '';

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
        <div class="small muted">التصحيح الآلي يقيس صحة الكلمات والحفظ. أحكام التجويد والمخارج يقيّمها المعلم بالاستماع.</div>
        <div class="row">${submitBtn}<button class="btn" id="rcRetry" type="button">إعادة المحاولة</button></div>
      </div>`;
      $$('[data-play]', box).forEach((b) => (b.onclick = () => playRange(+b.dataset.play, +b.dataset.play)));
      opts.onResult && opts.onResult(buildSubmission());
    }
    $('#rcRetry', box).onclick = () => { box.innerHTML = ''; wEls.forEach((el) => el.classList.remove('correct', 'wrong', 'missing', 'cursor', 'revealed')); if (mode === 'hifz') text.classList.add('hide'); $('#rcTimer', root).textContent = '00:00'; $('#rcProg', root).style.width = '0'; $('#rcStatus', root).textContent = 'جاهز. اضغط الزر وابدأ.'; };
    const sb = $('#rcSubmit', box);
    if (sb) sb.onclick = async () => {
      sb.disabled = true; sb.textContent = 'جارٍ الإرسال…';
      try { await opts.onSubmit(buildSubmission(), lastBlob); }
      catch (e) { console.error(e); toast('تعذر الإرسال: ' + (e.message || e)); sb.disabled = false; sb.textContent = 'إرسال للمعلم'; }
    };
  }

  function buildSubmission() {
    const base = { surah, from, to, mode, duration: lastDuration, transcript: lastTranscript.slice(0, 5000) };
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

  return { destroy() { player.stop(); sess?.cancel(); pop?.remove(); } };
}

/* عرض خريطة الكلمات لتسليم محفوظ */
function wordMapHtml(sub) {
  const ws = rangeWords(sub.surah, sub.from, sub.to);
  const cls = { c: 'correct', w: 'wrong', m: 'missing' };
  let h = '', cur = null;
  ws.forEach((w, i) => {
    if (w.ayah !== cur) { if (cur) h += `<span class="ayah-end">۝${ar(cur)}</span> `; cur = w.ayah; }
    h += `<span class="w ${cls[sub.statuses?.[i]] || ''}">${esc(w.text)}</span> `;
  });
  if (cur) h += `<span class="ayah-end">۝${ar(cur)}</span>`;
  return `<div class="sheet"><div class="quran" style="--qsize:24px">${h}</div></div>`;
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
  $('#nav').innerHTML = [['', 'الرئيسية'], ['practice', 'تدريب حر'], ['student', 'الطالب'], ['teacher', 'المعلم']]
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
      <div class="grid3">
        <a class="entry" href="#/practice"><b>تدريب حر</b><span>اختر أي سورة وتدرّب تلاوةً أو تسميعاً من الحفظ، دون تسجيل دخول.</span></a>
        <a class="entry" href="#/student"><b>دخول الطالب</b><span>واجباتك، سجل تسميعك، ودفتر أخطائك للمراجعة.</span></a>
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
    <li><b>للمعلم:</b> تقييم بثلاثة معايير، ملاحظات، تقارير بالكلمات الأكثر خطأً، وتصدير Excel.</li>
  </ul>`;
}

/* ================= التدريب الحر ================= */
let pendingPractice = null;
function viewPractice(app) {
  const init = pendingPractice || pref.get('lastRange', { surah: 36, from: 1, to: 12 });
  pendingPractice = null;
  app.innerHTML = `
    <div class="page-head"><div><h1>تدريب حر</h1><p class="muted" style="margin:4px 0 0">اختر المقطع ثم اضغط زر الميكروفون وابدأ القراءة.</p></div></div>
    <div class="card" style="margin-bottom:16px">${rangePicker('pr', init)}</div>
    <div id="prBody"></div>`;
  let comp = null;
  const mount = (r) => { comp?.destroy(); pref.set('lastRange', r); comp = mountRecite($('#prBody', app), { ...r, mode: init.mode }); };
  bindRangePicker(app, 'pr', mount);
  mount({ surah: init.surah, from: init.from, to: init.to });
  return { destroy: () => comp?.destroy() };
}

/* ================= الطالب ================= */
function viewStudent(app) {
  const s = session.get();
  if (!s || s.role !== 'student') return studentLogin(app);
  let comp = null;
  let tab = 'tasks';
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
        ${[['tasks', 'واجباتي'], ['history', 'سجل التسميع'], ['notebook', 'دفتر الأخطاء']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div id="stBody" style="margin-top:16px"></div>`;
    $('#stOut', app).onclick = () => { session.set(null); render(); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    const body = $('#stBody', app);
    if (tab === 'tasks') drawTasks(body, doneTasks);
    if (tab === 'history') drawHistory(body);
    if (tab === 'notebook') drawNotebook(body);
  }

  function drawTasks(body, done) {
    if (!data.tasks.length) { body.innerHTML = '<div class="empty">لا توجد واجبات حالياً. يمكنك التدرب من صفحة «تدريب حر».</div>'; return; }
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

  function openTask(t) {
    comp?.destroy();
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="tkBack" type="button">→ رجوع للواجبات</button><h1>${esc(t.title)}</h1>
      <p class="muted" style="margin:4px 0 0">${t.notes ? esc(t.notes) : 'اقرأ المقطع كاملاً ثم أرسل تسجيلك للمعلم.'}</p></div></div><div id="tkBody"></div>`;
    $('#tkBack', app).onclick = () => { comp?.destroy(); draw(); };
    const cls = data.classes.find((c) => c.id === me.classId);
    comp = mountRecite($('#tkBody', app), {
      surah: t.surah, from: t.from, to: t.to, mode: t.mode,
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
      <td>${x.teacher ? `<b class="num">${ar(x.teacher.total)}</b>/٣٠` : '<span class="muted">—</span>'}</td><td style="white-space:normal;min-width:160px">${esc(x.teacher?.notes || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
    $$('tr[data-i]', body).forEach((r) => (r.onclick = () => {
      const x = data.subs[+r.dataset.i];
      openModal(`<h2>${esc(x.taskTitle || 'تسميع')}</h2><p class="muted">${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)}</p>
        ${x.teacher ? `<div class="card" style="margin-bottom:12px"><b>تقييم المعلم: ${ar(x.teacher.total)}/٣٠</b><div class="small muted">الحفظ ${ar(x.teacher.hifz)} · التجويد ${ar(x.teacher.tajweed)} · الأداء والمخارج ${ar(x.teacher.ada)}</div>${x.teacher.notes ? `<p style="margin:8px 0 0">${esc(x.teacher.notes)}</p>` : ''}</div>` : ''}
        ${x.statuses ? wordMapHtml(x) : ''}`);
    }));
  }

  function drawNotebook(body) {
    const agg = new Map();
    data.subs.forEach((x) => (x.mistakes || []).forEach((m) => {
      const k = `${x.surah}:${m.a}:${m.w}`;
      const e = agg.get(k) || { surah: x.surah, a: m.a, w: m.w, n: 0, last: x.createdAt };
      e.n++; agg.set(k, e);
    }));
    const list = [...agg.values()].sort((a, b) => b.n - a.n).slice(0, 60);
    if (!list.length) { body.innerHTML = '<div class="empty">دفترك نظيف. الكلمات التي تخطئ فيها ستظهر هنا لتراجعها.</div>'; return; }
    body.innerHTML = `<p class="muted">الكلمات التي تكرر فيها الخطأ أو الترك، مرتبة من الأكثر. اضغط «راجع» للتدرّب على الآية.</p>
      <div class="grid3">${list.map((e, i) => `<div class="card row" style="justify-content:space-between"><div><span class="word-chip">${esc(e.w)}</span><div class="small muted" style="margin-top:6px">${esc(surahName(e.surah))} · آية ${ar(e.a)} · ${ar(e.n)} مرة</div></div><button class="btn sm" data-nb="${i}" type="button">راجع</button></div>`).join('')}</div>`;
    $$('[data-nb]', body).forEach((b) => (b.onclick = () => { const e = list[+b.dataset.nb]; pendingPractice = { surah: e.surah, from: e.a, to: e.a, mode: 'hifz' }; navTo('practice'); }));
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
    <p class="small muted" style="margin:0">لا تملك رقماً؟ يمكنك التدرب مباشرة من <a href="#/practice">التدريب الحر</a>.</p>
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
        <button class="btn" id="tOut" type="button">تسجيل الخروج</button>
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
        <td>${x.teacher ? `<span class="pill ok">${ar(x.teacher.total)}/٣٠</span>` : '<span class="pill warn">بانتظارك</span>'}</td></tr>`).join('')}
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
    const suggested = x.percent != null ? Math.round(x.percent / 10) : '';
    openModal(`
      <div class="stack">
        <div><h2>${esc(x.studentName)} <span class="muted small num">${esc(x.pn)}</span></h2>
        <p class="muted" style="margin:4px 0 0">${esc(x.taskTitle || 'تدريب')} · ${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)} · ${x.mode === 'hifz' ? 'غيباً' : 'نظراً'}</p></div>
        <div class="row">${x.percent != null ? `<span class="pill ${pctClass(x.percent)}">الدقة الآلية ${ar(x.percent)}٪</span><span class="pill mute">صحيحة ${ar(x.counts?.correct || 0)} · خطأ ${ar(x.counts?.wrong || 0)} · محذوفة ${ar(x.counts?.missing || 0)}</span>` : '<span class="pill mute">بدون تصحيح آلي</span>'}<span class="pill mute">المدة ${fmtTime(x.duration || 0)}</span></div>
        <div id="sbAudio">${x.hasAudio ? '<button class="btn" id="sbLoad" type="button">تشغيل تسجيل الطالب</button>' : '<span class="muted small">لا يوجد تسجيل صوتي.</span>'}</div>
        ${x.statuses ? wordMapHtml(x) : ''}
        ${x.transcript ? `<details><summary class="small">النص الذي التقطه التعرف على الكلام</summary><p class="small muted">${esc(x.transcript)}</p></details>` : ''}
        <form id="sbForm" class="card stack" style="gap:12px">
          <h3>تقييمك</h3>
          <div class="grid3">
            <label class="field">الحفظ وصحة الكلمات (من ١٠)<input type="number" id="gH" min="0" max="10" step="0.5" value="${t.hifz ?? suggested}"></label>
            <label class="field">أحكام التجويد (من ١٠)<input type="number" id="gT" min="0" max="10" step="0.5" value="${t.tajweed ?? ''}"></label>
            <label class="field">الأداء ومخارج الحروف (من ١٠)<input type="number" id="gA" min="0" max="10" step="0.5" value="${t.ada ?? ''}"></label>
          </div>
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
      $('#sbForm', m).onsubmit = async (e) => {
        e.preventDefault();
        const num = (id) => { const v = parseFloat($(id, m).value); return isNaN(v) ? 0 : Math.max(0, Math.min(10, v)); };
        const teacher = { hifz: num('#gH'), tajweed: num('#gT'), ada: num('#gA'), notes: $('#gN', m).value.trim(), at: new Date().toISOString() };
        teacher.total = Math.round((teacher.hifz + teacher.tajweed + teacher.ada) * 10) / 10;
        try { await store.updateSubmission(x.pn, x.id, { teacher }); x.teacher = teacher; closeModal(); toast('حُفظ التقييم وسيظهر للطالب.'); if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } drawBody(); }
        catch (err) { toast('تعذر الحفظ: ' + err.message); }
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
      'الحفظ': x.teacher?.hifz ?? '', 'التجويد': x.teacher?.tajweed ?? '', 'الأداء': x.teacher?.ada ?? '', 'المجموع /30': x.teacher?.total ?? '', 'ملاحظات': x.teacher?.notes ?? '',
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
        <div class="small muted" style="margin-top:-8px">${ar(r.n)} تسميع${r.tavg != null ? ` · متوسط تقييمك ${ar(r.tavg)}/٣٠` : ''}</div>`).join('') || '<span class="muted">لا توجد صفوف.</span>'}
      </div>
      <div class="card stack" style="gap:12px"><h3>الكلمات الأكثر خطأً بين الطلاب</h3>
        ${top.length ? `<div class="row" style="gap:8px">${top.map((e) => `<span title="${esc(surahName(e.s))} ${e.a}"><span class="word-chip">${esc(e.w)}</span> <span class="small muted">${esc(surahName(e.s))}:${ar(e.a)} · ${ar(e.who.size)} طالب</span></span>`).join('')}</div>` : '<span class="muted">ستظهر هنا بعد أول تسليمات مصححة آلياً.</span>'}
        <p class="small muted" style="margin:0">استخدمها لتحديد مواضع الشرح في الحصة القادمة.</p>
      </div>
      <div class="card stack" style="gap:8px"><h3>طلاب يحتاجون متابعة</h3>
        ${need.length ? need.map((x) => `<div class="row" style="justify-content:space-between"><span>${esc(x.s.name)} <span class="small muted">${esc(className(x.s.classId))}</span></span><span class="pill ${pctClass(x.avg)}">${ar(x.avg)}٪</span></div>`).join('') : '<span class="muted">لا يوجد طالب متوسطه أقل من ٧٠٪.</span>'}
      </div>
      <div class="card stack" style="gap:8px"><h3>لم يرسلوا أي تسميع بعد (${ar(students.filter((x) => x.n === 0).length)})</h3>
        ${silent.length ? `<div class="row" style="gap:6px">${silent.map((x) => `<span class="pill mute">${esc(x.s.name)}</span>`).join('')}</div>` : '<span class="muted">كل الطلاب أرسلوا.</span>'}
      </div>
    </div>`;
  }

  /* --- الإعدادات --- */
  function drawSettings(body) {
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack" style="gap:10px"><h3>حفظ البيانات</h3>
        ${store.mode === 'cloud' ? '<p style="margin:0"><span class="pill ok">سحابي</span> البيانات محفوظة في Firebase وتظهر على كل الأجهزة.</p>' : '<p style="margin:0"><span class="pill warn">محلي</span> البيانات محفوظة في هذا المتصفح فقط. للعمل بين أجهزة الطلاب والمعلم فعّل Firebase (راجع ملف README).</p>'}
      </div>
      ${store.mode === 'cloud' ? `<div class="card stack" style="gap:10px"><h3>نقل بيانات النسخة السابقة</h3>
        <p class="muted small" style="margin:0">ينسخ الطلاب وواجبات سورة يس من «مقرأة الفاتح» القديمة إلى النظام الجديد. التسليمات القديمة لا تُنقل.</p>
        <button class="btn" id="mig" type="button">نقل البيانات القديمة</button></div>` : ''}
    </div>`;
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
  $('#modeTag').textContent = store.mode === 'cloud' ? 'الحفظ: سحابي' : 'الحفظ: محلي على هذا الجهاز';
  if (cloudError) { const b = $('#banner'); b.hidden = false; b.textContent = 'تعذر الاتصال بقاعدة البيانات السحابية؛ تعمل المنصة الآن بالحفظ المحلي على هذا الجهاز.'; }
  render();
})();
