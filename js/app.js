import { loadQuran, getSurahs, surahName, ayahCount, ayahWords, rangeWords, toArabicDigits as ar } from './quran.js';
import { align, score } from './align.js';
import { analyzeAyah, wordHtml, summarize, RULES } from './tajweed.js';
import { RecitationSession, AyahPlayer, RECITERS, hasRecognition, hasRecorder } from './speech.js';
import { initStore, store, cloudError } from './store.js';
import { TAJWEED_API, PUSH } from './firebase-config.js';
import { registerSW, platform, promptInstall, onInstallChange } from './pwa.js';
import { mergeAttempt, mapFromSubs, renderMushaf, surahDetailHtml, suggestRange } from './mushaf.js';
import { compressImage, blobToB64, annImage, openLightbox, pruneImageCache, fmtKB, IMG_DAILY_LIMIT, IMG_DAYS } from './images.js';
import { pushState, enablePush, disablePush, refreshPush, testNotification, sendPush, sendPushBatch, sendAnnouncement, pushConfigured, getMute, setMute, notifyFeedback } from './push.js';
import { renderPages, downloadPDF, printPages, DEFAULT_NOTES, PER_PAGE } from './cards.js';
import { confetti, pickHigh, pickLow } from './celebrate.js';
import { computeBoard, boardHtml, rankBadge, computeMonth, monthTitle } from './leaderboard.js';
import { downloadCertificatePNG, downloadCertificatesPDF } from './certificate.js';
import { CATS, defaultCatalog, mergeCatalog, findErr, makeMark, deduction, gradeFrom } from './errors.js';
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
// تذكّر كلمة السر على هذا الجهاز (اختياري، بطلب المستخدم)
const remember = {
  get(k) { const v = pref.get('rem_' + k, null); if (!v?.p) return null; try { return { ...v, p: decodeURIComponent(escape(atob(v.p))) }; } catch { return null; } },
  set(k, data, pw) { pref.set('rem_' + k, { ...data, p: btoa(unescape(encodeURIComponent(pw))) }); },
  clear(k) { try { localStorage.removeItem('fp_pref_rem_' + k); } catch {} },
};
// رأيك يهمنا: أنواع الملاحظات
const FB_KINDS = { comment: ['💬', 'تعليق'], complaint: ['⚠️', 'شكوى'], suggest: ['💡', 'اقتراح'], note: ['📝', 'ملاحظة'] };
const fbKindChip = (k) => `<span class="fb-kind fb-${k}">${FB_KINDS[k]?.[0] || '💬'} ${FB_KINDS[k]?.[1] || 'ملاحظة'}</span>`;
const rememberBox = (id, on) => `<label class="row small remember" style="gap:8px;cursor:pointer"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> تذكّر كلمة السر على هذا الجهاز</label>`;
const timeAgo = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!(m >= 0)) return '';
  if (m < 1) return 'الآن';
  if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${ar(m)} دقائق` : `قبل ${ar(m)} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${ar(h)} ساعات` : `قبل ${ar(h)} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? 'أمس' : d === 2 ? 'قبل يومين' : d <= 10 ? `قبل ${ar(d)} أيام` : `قبل ${ar(d)} يوماً`;
};
const fmtDate = (iso) => { try { return ar(new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' })); } catch { return ''; } };
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const latinDigits = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
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
/** ينفّذ fn حين تكون النافذة المنبثقة مغلقة (لا تتراكب نافذتان) */
function whenModalFree(fn) {
  const m = $('#modal');
  if (m.hidden) return fn();
  const ob = new MutationObserver(() => { if (m.hidden) { ob.disconnect(); setTimeout(fn, 250); } });
  ob.observe(m, { attributes: true, attributeFilter: ['hidden'] });
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
// تحديث يدوي: مهم في وضع التطبيق المثبّت (لا يوجد فيه زر تحديث للمتصفح)
$('#refreshBtn').onclick = async () => {
  const b = $('#refreshBtn'); b.classList.add('spin'); b.disabled = true;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  location.reload();
};
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

const ONE_SHOT_NOTE = 'ملاحظة: لك محاولة واحدة لتسجيل الآيات، لا تستعجل، تدرّب جيداً قبل التسجيل، ولا تخف إن حدث خطأ في التسجيل سيرسل لك المعلم طلباً لإعادة التسجيل.';
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
        ${opts.oneShot ? `<div class="one-shot"><b>محاولة واحدة</b><span>${ONE_SHOT_NOTE}</span>${opts.onPractice ? '<button class="btn sm" type="button" id="rcPractice">تدرّب على المقطع أولاً</button>' : ''}</div>` : ''}
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
    if (opts.onActivity && duration >= 60) opts.onActivity(duration); // تدريب دقيقة فأكثر يُحسب في السلسلة
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
  let sent = false; // في وضع المحاولة الواحدة: أُرسل التسليم
  $('#rcMic', root).onclick = async () => {
    if (sess?.active) return finishRec();
    if (opts.oneShot) {
      if (sent) return toast('أرسلت محاولتك لهذا الواجب. انتظر تقييم معلمك.');
      if (!(await confirmBox('هذه محاولتك الوحيدة لهذا الواجب، وستُرسل للمعلم تلقائياً عند إيقاف التسجيل. هل أنت مستعد؟', 'ابدأ التسجيل'))) return;
    }
    startRec();
  };
  const pr = $('#rcPractice', root);
  if (pr) pr.onclick = () => opts.onPractice();

  function showResult() {
    const box = $('#rcResult', root);
    const audioUrl = lastBlob ? URL.createObjectURL(lastBlob) : '';
    // المحاولة الواحدة: التسجيل الصامت أو القصير جداً لا يُحسب، وما عداه يُرسل تلقائياً
    const oneShot = !!opts.oneShot;
    const counts = !!lastBlob && lastDuration >= 3;
    const submitBtn = opts.onSubmit && !oneShot ? `<button class="btn primary" id="rcSubmit" type="button">إرسال للمعلم</button>` : '';
    const retryBtn = !oneShot || !counts ? '<button class="btn" id="rcRetry" type="button">إعادة المحاولة</button>' : '';
    const sendBox = oneShot && counts ? '<div class="send-state" id="rcSendState">جارٍ إرسال تسميعك إلى المعلم…</div>' : '';
    if (!last) {
      box.innerHTML = `<div class="card stack" style="gap:10px">
        ${sendBox}
        <h3>${hasRecognition ? 'لم نسمع تلاوة واضحة' : 'تم التسجيل'}</h3>
        <p class="muted small" style="margin:0">${oneShot && !counts ? 'التسجيل قصير جداً أو صامت، فلم يُحسب محاولة. تأكد من السماح للميكروفون ثم أعد المحاولة.' : hasRecognition ? 'تأكد من السماح للميكروفون، واقرأ بصوت أعلى قليلاً في مكان هادئ.' : 'لا يدعم متصفحك التصحيح الآلي؛ يمكنك إرسال التسجيل ليقيّمه المعلم.'}</p>
        ${audioUrl ? `<audio controls src="${audioUrl}" style="width:100%"></audio>` : ''}
        <div class="row">${lastBlob && opts.onSubmit ? submitBtn : ''}${retryBtn}</div></div>`;
    } else {
      const sc = score(last, lastDuration);
      const mist = [];
      last.status.forEach((s, i) => { if (s === 'wrong' || s === 'missing') mist.push(i); });
      const color = sc.percent >= 85 ? 'var(--ok)' : sc.percent >= 60 ? 'var(--warn)' : 'var(--bad)';
      box.innerHTML = `<div class="card stack" style="gap:14px">
        ${sendBox}
        ${cheerHtml(sc.outOf10)}
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
        <div class="row">${submitBtn}${retryBtn}</div>
      </div>`;
      $$('[data-play]', box).forEach((b) => (b.onclick = () => playRange(+b.dataset.play, +b.dataset.play)));
      if (sc.outOf10 >= 8) confetti();
      box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      opts.onResult && opts.onResult(buildSubmission());
    }
    if (lastBlob && aiEnabled()) mountAi(box);
    const rr = $('#rcRetry', box);
    if (rr) rr.onclick = () => { aiCtl?.abort(); aiRes = null; wEls.forEach((el) => el.classList.remove('tjai')); box.innerHTML = ''; wEls.forEach((el) => el.classList.remove('correct', 'wrong', 'missing', 'cursor', 'revealed')); if (mode === 'hifz') text.classList.add('hide'); $('#rcTimer', root).textContent = '00:00'; $('#rcProg', root).style.width = '0'; $('#rcStatus', root).textContent = 'جاهز. اضغط الزر وابدأ.'; };
    if (oneShot && counts) autoSend(box);
    const sb = $('#rcSubmit', box);
    if (sb) sb.onclick = async () => {
      sb.disabled = true; sb.textContent = 'جارٍ الإرسال…';
      try { await opts.onSubmit(buildSubmission(), lastBlob); }
      catch (e) { console.error(e); toast('تعذر الإرسال: ' + (e.message || e)); sb.disabled = false; sb.textContent = 'إرسال للمعلم'; }
    };
  }

  let sentId = null;
  async function autoSend(box) {
    const st = $('#rcSendState', box);
    const sub = buildSubmission(), blob = lastBlob;
    const attempt = async () => {
      st.className = 'send-state'; st.textContent = 'جارٍ إرسال تسميعك إلى المعلم…';
      try {
        sentId = await opts.onSubmit(sub, blob);
        sent = true;
        st.className = 'send-state ok'; st.innerHTML = '✓ أُرسل تسميعك إلى المعلم. جزاك الله خيراً، وانتظر تقييمه.';
        if (aiRes && opts.onAi) opts.onAi(sentId, aiRes).catch(() => {});
      } catch (e) {
        st.className = 'send-state bad';
        st.innerHTML = `${esc(e.message || 'تعذر الإرسال.')} ${/سبق/.test(e.message || '') ? '' : '<button class="btn sm" type="button" id="rcResend">أعد الإرسال</button>'}`;
        const b = $('#rcResend', st); if (b) b.onclick = attempt;
        if (/سبق/.test(e.message || '')) sent = true;
      }
    };
    attempt();
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
      card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><div class="small" id="aiProg">جارٍ التحضير…</div><div class="progress"><i class="indet"></i></div>${opts.oneShot ? '<p class="small muted" style="margin:0">أُرسل تسميعك، وتُضاف نتيجة التحليل إليه عند انتهائه.</p>' : opts.onSubmit ? '<p class="small muted" style="margin:0">يمكنك الإرسال الآن؛ إن لم ينتهِ التحليل فسيُجريه المعلم لاحقاً.</p>' : ''}`;
      try {
        aiRes = await aiAnalyze(lastBlob, { surah, from, to }, (t) => { const el = $('#aiProg', card); if (el) el.textContent = t; }, aiCtl.signal);
        renderAi(card);
        if (sentId && opts.onAi) opts.onAi(sentId, aiRes).catch((e) => console.warn('ai save', e));
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

/* الاحتفال (٨ من ١٠ فأعلى) والتحفيز لما دونها */
const fmt10 = (v) => ar(Number.isInteger(v) ? v : Number(v).toFixed(1).replace('.', '٫'));
/** للخصومات والدرجات بالربع: حتى منزلتين بلا أصفار زائدة */
const negQ = (v) => `<bdi dir="ltr">−${fmtQ(v)}</bdi>`;
const fmtQ = (v) => ar(String(Math.round(Number(v || 0) * 100) / 100).replace('.', '٫'));
function cheerHtml(score10, { who = 'auto' } = {}) {
  if (score10 >= 8) {
    const { phrase, hadith } = pickHigh();
    return `<div class="cheer high" role="status">
      <div class="cheer-badge" aria-hidden="true">★</div>
      <div class="cheer-score">${fmt10(score10)} <span>/ ١٠</span></div>
      <b class="cheer-title">${esc(phrase)}</b>
      <blockquote>«${esc(hadith.text)}» <small>${esc(hadith.src)}</small></blockquote></div>`;
  }
  const { phrase, hadith } = pickLow();
  const gap = Math.max(0.5, Math.ceil((8 - score10) * 2) / 2);
  return `<div class="cheer low" role="status">
    <b class="cheer-title">${esc(phrase)}</b>
    <div>${who === 'teacher' ? 'درجتك من معلمك' : 'درجتك الآن'} <b>${fmt10(score10)} من ١٠</b>، وتحتاج <b>${fmt10(gap)}</b> ${gap > 2 ? 'درجات' : 'درجة'} فقط لتصل إلى ٨. ${who === 'teacher' ? 'اقرأ ملاحظات معلمك وتدرّب عليها.' : 'راجع المواضع المظللة ثم أعد المحاولة.'}</div>
    <blockquote>«${esc(hadith.text)}» <small>${esc(hadith.src)}</small></blockquote></div>`;
}

/* السلسلة: الأيام بتوقيت الرياض */
const riyadhDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(d);
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** طول السلسلة: الأيام المتتالية حتى اليوم (أو حتى أمس إن لم ينشط اليوم بعد) */
function streakOf(days) {
  const today = riyadhDay();
  let d = days.has(today) ? today : addDays(today, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return { days: n, today: days.has(today), start: addDays(d, 1) };
}
const STREAK_MILESTONES = [[30, '🏆 شهر كامل!', 'ثلاثون يوماً متتالية مع القرآن. هذا ثبات الكبار، بارك الله فيك وجعله حجة لك.'], [14, '🌟 أسبوعان متتاليان!', 'أربعة عشر يوماً بلا انقطاع. أنت تبني عادة عظيمة، فواصل.'], [7, '🔥 أسبوع كامل!', 'سبعة أيام متتالية مع القرآن. «أحب الأعمال إلى الله أدومها وإن قلّ».']];

/** ملاحظة للمعلم إن أُجّل الإشعار لأوقات الهدوء */
const deferNote = (r) => (r && r.deferred && !r.sent ? '، وسيصل إشعار الجوال الساعة ٦ صباحاً (أوقات الهدوء)' : r && r.deferred ? '، ويصل الباقي صباحاً (أوقات الهدوء)' : '');

/* عبارة تشجيع قصيرة تناسب الإشعار */
function gradeCheer(g) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (g >= 9.5) return pick(['ما شاء الله! إتقان كامل، بارك الله فيك.', 'تبارك الله! تلاوة تسرّ القلب، زادك الله نوراً.']);
  if (g >= 8) return pick(['ما شاء الله، تلاوة متقنة! واصل يا بطل.', 'أحسنت! رفع الله قدرك بالقرآن.', 'بارك الله فيك، هذا إتقان يُفتخر به.']);
  if (g >= 6) return pick(['أنت قريب من الإتقان، راجع ملاحظات معلمك وأعد المحاولة.', 'أنت قريب من ٨، والمحاولة القادمة أفضل بإذن الله.']);
  return pick(['كل محاولة تقرّبك من الإتقان، ولك أجران على اجتهادك.', 'لا تستسلم! الحفظ يثبت بالتكرار، وأنت على الطريق.']);
}

/* مساحة قاعدة البيانات: تقدير من حجم التسجيلات ومستندات التسليمات */
const DB_QUOTA = 1024 ** 3; // الحصة المجانية في Firestore: ١ GB
const fmtBytes = (b) => (b >= 1024 ** 3 ? `${ar((b / 1024 ** 3).toFixed(2).replace('.', '٫'))} GB` : b >= 1024 ** 2 ? `${ar(Math.round(b / 1024 ** 2))} MB` : `${ar(Math.max(1, Math.round(b / 1024)))} KB`);
function audioBytesOf(x) {
  if (!x.hasAudio) return 0;
  if (x.audioBytes) return x.audioBytes;
  return Math.round((x.duration || 30) * 3400); // تقدير للتسجيلات القديمة: ٢٠ كيلوبت/ث بعد ترميز base64
}
const monthsText = (n) => (n === 1 ? 'شهر واحد' : n === 2 ? 'شهرين' : n <= 10 ? `${ar(n)} أشهر` : `${ar(n)} شهراً`);
function dbUsage(subs, students = []) {
  let audio = 0, docs = 0, withAudio = 0, recent = 0;
  const monthAgo = Date.now() - 30 * 864e5;
  subs.forEach((x) => {
    const a = audioBytesOf(x);
    audio += a;
    if (a) withAudio++;
    docs += JSON.stringify(x).length + 300;
    if (new Date(x.createdAt).getTime() > monthAgo) recent += a + JSON.stringify(x).length + 300;
  });
  docs += students.length * 1500 + 200 * 1024; // الطلاب والبطاقات والصفوف والواجبات ولوحة الشرف
  const total = audio + docs;
  const pct = total / DB_QUOTA;
  const monthsLeft = recent > 0 ? (DB_QUOTA - total) / recent : null;
  return { audio, docs, total, pct, withAudio, recent, monthsLeft, level: pct >= 0.9 ? 'bad' : pct >= 0.7 ? 'warn' : 'ok' };
}

/* استهلاك خادم تحليل التجويد (Cloud Run): الحصة المجانية الشهرية والتكلفة بعدها */
const RUN_FREE = { cpu: 180000, mem: 360000 }; // ثانية vCPU و ثانية GiB شهرياً
const RUN_PRICE = { cpu: 0.000024, mem: 0.0000025 }; // دولار لكل ثانية vCPU / GiB (الفوترة حسب الطلب)
const utcMonth = () => new Date().toISOString().slice(0, 7);
const nWord = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n % 100 >= 3 && n % 100 <= 10 ? `${ar(n)} ${few}` : `${ar(n)} ${many}`);
const nAnalyses = (n) => (n === 0 ? 'لا تحليلات' : nWord(n, 'تحليل واحد', 'تحليلان', 'تحليلات', 'تحليلاً'));
const fmtDur = (sec) => { sec = Math.round(sec); if (sec < 60) return `${ar(sec)} ث`; const m = Math.round(sec / 60); if (m < 120) return nWord(m, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'); const h = sec / 3600; return h < 10 ? `${ar(h.toFixed(1).replace('.', '٫'))} ساعة` : nWord(Math.round(h), 'ساعة', 'ساعتان', 'ساعات', 'ساعة'); };
const fmtUsd = (d) => (d <= 0 ? '٠ $' : `${ar(d < 0.01 ? d.toFixed(4) : d < 1 ? d.toFixed(3) : d.toFixed(2)).replace('.', '٫')} $`);
function runCost(sec, inst) {
  return Math.max(0, sec * inst.vcpu - RUN_FREE.cpu) * RUN_PRICE.cpu + Math.max(0, sec * inst.gib - RUN_FREE.mem) * RUN_PRICE.mem;
}
function aiUsage(doc, subs) {
  const inst = TAJWEED_API.instance || { vcpu: 2, gib: 8 };
  const free = Math.min(RUN_FREE.cpu / inst.vcpu, RUN_FREE.mem / inst.gib); // ثوانٍ مجانية في الشهر
  const month = utcMonth();
  const mine = subs.filter((x) => x.ai?.took && (x.ai.at || x.createdAt || '').slice(0, 7) === month);
  let est = false, n, billed, req, cold, startup, failed, audio;
  if (doc) {
    n = doc.analyses || 0; failed = doc.failed || 0; cold = doc.cold_starts || 0;
    req = doc.billed_seconds || 0; startup = doc.startup_seconds || 0; audio = doc.audio_seconds || 0;
    billed = req + startup;
  } else { // قبل أول تسجيل من الخادم: تقدير من نتائج التحليل المحفوظة في التسليمات
    est = true; n = mine.length; failed = 0; cold = 0; startup = 0;
    req = mine.reduce((t, x) => t + x.ai.took + 3, 0); audio = mine.reduce((t, x) => t + (x.duration || 0), 0);
    billed = req;
  }
  const done = n + failed;
  const per = done ? billed / done : 40; // يشمل نصيب المقطع من وقت الإيقاظ
  const perReq = done ? req / done : 35;
  const perAudioMin = audio > 30 ? (req / audio) * 60 : null; // ثوانٍ محتسبة لكل دقيقة تلاوة
  const pct = billed / free;
  const remaining = Math.max(0, free - billed);
  const d = new Date(), day = d.getUTCDate(), days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const projected = day >= 3 ? (billed / day) * days : null;
  return {
    inst, free, month, est, n, failed, cold, startup, req, billed, audio, per, perReq, perAudioMin, pct, remaining,
    remainingN: Math.floor(remaining / per),
    perPct: per / free,
    perCost: per * (inst.vcpu * RUN_PRICE.cpu + inst.gib * RUN_PRICE.mem),
    cost: runCost(billed, inst),
    projected, projectedPct: projected == null ? null : projected / free, projectedCost: projected == null ? 0 : runCost(projected, inst),
    level: pct >= 0.9 ? 'bad' : pct >= 0.7 ? 'warn' : 'ok',
    updatedAt: doc?.updatedAt?.toDate ? doc.updatedAt.toDate().toISOString() : null,
  };
}

/* لوحة الشرف المشتركة بين الطالب والمعلم */
function mountBoard(host, board, opts = {}) {
  if (!board) { host.innerHTML = '<div class="empty">لم تُنشر لوحة الشرف بعد. تظهر بعد أن يفتح المعلم لوحته وتُقيَّم أول الواجبات.</div>'; return; }
  let per = pref.get('lbPeriod', 'month');
  let cls = opts.myClass || null;
  const paint = () => {
    const p = board[per] || board.all;
    host.innerHTML = `<div class="stack">
      <div class="row" style="justify-content:space-between">
        <div class="seg" role="group" aria-label="الفترة"><button type="button" data-per="month" class="${per === 'month' ? 'on' : ''}">${esc(board.month?.label || 'هذا الشهر')}</button><button type="button" data-per="all" class="${per === 'all' ? 'on' : ''}">منذ البداية</button></div>
        ${board.at ? `<span class="small muted">آخر تحديث: ${fmtDate(board.at)}</span>` : ''}
      </div>
      ${boardHtml(p, { ...opts, classId: cls, myRank: opts.myRank ? opts.myRank[per] : null })}</div>`;
    $$('[data-per]', host).forEach((b) => (b.onclick = () => { per = b.dataset.per; pref.set('lbPeriod', per); paint(); }));
    const sel = $('#lbCls', host);
    if (sel) sel.onchange = () => { cls = sel.value; paint(); };
  };
  paint();
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
  return `<div><b class="small">الأخطاء التي حددها المعلم</b><ul class="mistakes">${sub.tj.map((m) => `<li><span><span class="qw">${esc(words[m.i]?.text || '')}</span> <span class="small muted">آية ${ar(words[m.i]?.ayah || 0)}</span></span><span class="pill bad">${esc(m.n || ruleName(m.r))}${m.d ? ` ${negQ(m.d)}` : ''}</span></li>`).join('')}</ul></div>`;
}

/* ================= التوجيه ================= */
let current = null;
let booted = false; // اكتمل تحميل المصحف وقاعدة البيانات
const routes = { '': viewHome, practice: viewPractice, student: viewStudent, teacher: viewTeacher };
function navTo(r) { location.hash = '#/' + r; }
function render() {
  current?.destroy?.();
  current = null;
  $('#tip-pop')?.remove();
  if (!$('#modal').hidden) closeModal(); // لا تبقى نافذة صفحة سابقة مفتوحة
  const r = location.hash.replace(/^#\/?/, '').split('/')[0];
  const fn = routes[r] || viewHome;
  document.body.classList.toggle('home-green', fn === viewHome);
  // قبل اكتمال تحميل المصحف وقاعدة البيانات لا تُفتح إلا الرئيسية (لا تحتاج بيانات)
  if (!booted && fn !== viewHome) { $('#app').innerHTML = '<div class="loading">جارٍ التحميل…</div>'; return; }
  $('#nav').innerHTML = [['', 'الرئيسية'], ['student', 'الطالب'], ['teacher', 'المعلم']]
    .map(([k, l]) => `<a href="#/${k}" class="${k === r || (!routes[r] && !k) ? 'on' : ''}">${l}</a>`).join('');
  const app = $('#app');
  app.innerHTML = '';
  scrollTo(0, 0);
  current = fn(app) || null;
}
addEventListener('hashchange', render);
registerSW();
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'open' && e.data.url) location.href = e.data.url; });

/* ================= الرئيسية ================= */
function viewHome(app) {
  const feats = [
    ['🎙️', 'متابعة حية', 'مؤشر يتقدم مع قراءتك، وتلوين فوري للكلمة الصحيحة أو المتروكة.'],
    ['🙈', 'تسميع غيباً', 'النص مخفي، وتظهر كل كلمة عندما تقرؤها صحيحة، مع زر تلميح.'],
    ['🎯', 'تصحيح دقيق وصادق', 'مطابقة ذكية تفهم الرسم العثماني، بلا درجات دنيا مصطنعة.'],
    ['🎨', 'ألوان التجويد آلياً', 'الإخفاء والإدغام والإقلاب والقلقلة والمدود في أي آية.'],
    ['🎧', `${ar(RECITERS.length)} قارئاً`, 'استماع للآية أو المقطع مع التكرار والتحكم بالسرعة.'],
    ['🤖', 'تحليل التجويد بالذكاء الاصطناعي', 'المدود والغنة والقلقلة والحركات لكل كلمة، للإعانة لا للاعتماد.'],
    ['👨‍🏫', 'للمعلم', 'درجة من ١٠ وملاحظات، ونظام يتعلم من تقييماتك، وتقارير بالكلمات الأكثر خطأً، وتصدير Excel.'],
  ];
  app.innerHTML = `
  <section class="hero hero-solo">
    <div>
      <div class="hero-brand"><svg class="hero-logo" viewBox="0 0 32 32" aria-hidden="true"><g fill="#d9b45a"><rect x="7" y="7" width="18" height="18" rx="2"/><rect x="7" y="7" width="18" height="18" rx="2" transform="rotate(45 16 16)"/></g><circle cx="16" cy="16" r="5" fill="#0d5c46"/><circle cx="16" cy="16" r="3" fill="#f3e7c6"/></svg><div class="hero-name">مقرأة الفاتح</div><svg class="hero-orn" viewBox="0 0 540 40" aria-hidden="true"><g fill="#d9b45a"><g transform="translate(30 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(90 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(150 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(210 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(270 20)"><rect x="-12" y="-12" width="24" height="24"/><rect x="-12" y="-12" width="24" height="24" transform="rotate(45)"/></g><g transform="translate(330 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(390 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(450 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><g transform="translate(510 20)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g></g><path d="M20 20H250M290 20H520" stroke="#d9b45a" stroke-width="1.5" opacity=".6"/></svg></div>
      <h1 class="hero-tag">اقرأ، ونحن نتابعك كلمةً بكلمة</h1>
      <span class="pill hero-pill">المصحف كاملاً · ١١٤ سورة</span>
      <p class="lead">مقرأة إلكترونية للمدارس وحلقات التحفيظ: يقرأ الطالب من أي سورة، فتظهر الكلمات الصحيحة والمحذوفة والخاطئة أثناء القراءة، ثم يُرسل تسجيله إلى المعلم ليقيّم التجويد والأداء.</p>
      <div class="grid2">
        <a class="entry" href="#/student"><b>دخول الطالب</b><span>واجباتك، والتدريب الحر على أي سورة، وسجل تسميعك، ودفتر أخطائك.</span></a>
        <a class="entry" href="#/teacher"><b>لوحة المعلم</b><span>الصفوف والطلاب والواجبات، والاستماع والتقييم والتقارير.</span></a>
      </div>
    </div>
  </section>
  <ul class="feature-list">
    ${feats.map(([i, h, d]) => `<li><span class="fi" aria-hidden="true">${i}</span><span><b>${h}:</b> ${d}</span></li>`).join('')}
  </ul>`;
}

/* ================= التدريب الحر (للطلاب المسجلين والمعلم فقط) ================= */
let pendingPractice = null;
function mountPractice(host, learn, onActivity, onResult) {
  const init = pendingPractice || pref.get('lastRange', { surah: 36, from: 1, to: 12 });
  pendingPractice = null;
  host.innerHTML = `<p class="muted" style="margin:0 0 12px">اختر أي مقطع ثم اضغط زر الميكروفون وابدأ القراءة. التدريب لا يُرسل للمعلم.</p>
    <div class="card" style="margin-bottom:16px">${rangePicker('pr', init)}</div>
    <div id="prBody"></div>`;
  let comp = null;
  const mount = (r) => { comp?.destroy(); pref.set('lastRange', r); comp = mountRecite($('#prBody', host), { ...r, mode: init.mode, learn, onActivity, onResult }); };
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
function installStepsHtml(p) {
  const share = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>';
  const plus = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="vertical-align:-3px"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const steps = p.ios
    ? [
        p.inApp ? 'افتح المقرأة في متصفح <b>Safari</b> (من القائمة ⋯ اختر «فتح في Safari»).' : null,
        `اضغط زر <b>المشاركة</b> ${share} أسفل الشاشة (أو أعلاها في الآيباد). إن لم تجده فاضغط <b>⋯</b> ثم «مشاركة».`,
        `مرّر للأسفل واختر <b>«إضافة إلى الشاشة الرئيسية»</b> ${plus}.`,
        'اضغط <b>«إضافة»</b> أعلى الشاشة. ستظهر أيقونة المقرأة بجانب تطبيقاتك.',
      ].filter(Boolean)
    : p.android
      ? [
          'افتح المقرأة في متصفح <b>Chrome</b> (أو Samsung Internet).',
          'اضغط القائمة <b>⋮</b> أعلى الشاشة (في Samsung Internet: <b>≡</b> أسفلها).',
          'اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.',
          'اضغط <b>«تثبيت»</b>. ستظهر أيقونة المقرأة بجانب تطبيقاتك.',
        ]
      : [
          'في Chrome أو Edge: اضغط أيقونة التثبيت في نهاية شريط العنوان، أو القائمة ⋮ ثم «تثبيت مقرأة الفاتح».',
          'على الجوال يكون التثبيت أسهل: امسح رمز بطاقتك أو افتح الرابط من جوالك ثم اضغط هذا الزر.',
        ];
  return `<div class="stack"><h2>ثبّت المقرأة على ${p.ios ? 'الآيفون' : p.android ? 'جوالك' : 'جهازك'}</h2>
    <ol class="install-steps">${steps.map((t) => `<li><span>${t}</span></li>`).join('')}</ol>
    <p class="small muted" style="margin:0">بعدها افتح المقرأة من أيقونتها، وادخل مرة واحدة فقط؛ يبقى دخولك محفوظاً.</p>
    <div class="row"><button class="btn primary" type="button" data-close>حسناً</button></div></div>`;
}

function viewStudent(app) {
  const s = session.get();
  if (!s || s.role !== 'student') return studentLogin(app);
  let comp = null;
  let tab = studentStartTab || 'tasks';
  studentStartTab = null;
  let data = { tasks: [], subs: [], classes: [], retakes: [], activity: [] };
  const me = s.student;
  const activeDays = () => new Set([...(data.activity || []).map((a) => a.d), ...data.subs.map((x) => (x.createdAt ? riyadhDay(new Date(x.createdAt)) : ''))].filter(Boolean));
  function logAct(kind, sec) {
    const day = riyadhDay();
    const before = streakOf(activeDays()).days;
    const a = (data.activity || []).find((x) => x.d === day);
    if (a) a[kind === 'task' ? 'tasks' : 'practice']++; else (data.activity = data.activity || []).push({ d: day, practice: kind === 'task' ? 0 : 1, tasks: kind === 'task' ? 1 : 0 });
    store.logActivity(me.id, day, kind, sec).catch((e) => console.warn('activity', e));
    const st = streakOf(activeDays());
    const k = $('#kpiStreak', app); if (k) k.innerHTML = `<b>🔥 ${ar(st.days)}</b><span>أيام متتالية</span>`;
    if (st.days > before && before > 0 && !celebrateStreak()) toast(`🔥 سلسلتك الآن ${ar(st.days)} أيام متتالية. أحسنت!`);
  }
  /** احتفال عند ٧ و١٤ و٣٠ يوماً (مرة لكل سلسلة) */
  function celebrateStreak() {
    const st = streakOf(activeDays());
    const m = STREAK_MILESTONES.find(([n]) => st.days >= n);
    if (!m) return false;
    const key = 'streakCele_' + me.id, done = new Set(pref.get(key, []));
    const id = `${m[0]}@${st.start}`;
    if (done.has(id)) return false;
    done.add(id); pref.set(key, [...done].slice(-50));
    openModal(`<div class="stack streak-cele"><div class="streak-num">${ar(st.days)}</div><h2>${m[1]}</h2><p style="margin:0">${m[2]}</p><div class="row"><button class="btn primary" type="button" data-close>الحمد لله</button></div></div>`);
    setTimeout(() => confetti(), 150);
    return true;
  }
  const openRetakes = () => (data.retakes || []).filter((r) => !data.subs.some((x) => x.retakeId === r.id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  function startRetake(rid) {
    const r = (data.retakes || []).find((x) => x.id === rid);
    if (!r) return toast('طلب الإعادة غير موجود.');
    openTask(data.tasks.find((t) => t.id === r.taskId) || null, r);
  }
  const owner = { id: me.id, info: { role: 'student', studentId: me.id, classId: me.classId } };
  let notifs = [], offNotifs = null;
  const deep = location.hash.match(/^#\/student\/(task|grade|retake|ann|month|fb)\/([\w-]+)/);
  let openFbId = deep && deep[1] === 'fb' ? deep[2] : null;
  let myFb = [];
  let openMonthYm = deep && deep[1] === 'month' ? deep[2] : null;
  let openAnnId = deep && deep[1] === 'ann' ? deep[2] : null;
  let openRetakeId = deep && deep[1] === 'retake' ? deep[2] : null;
  let openTaskId = deep && deep[1] === 'task' ? deep[2] : null;
  let openSubId = deep && deep[1] === 'grade' ? deep[2] : null;
  if (/^#\/student\/(practice|honor)/.test(location.hash)) { tab = location.hash.includes('honor') ? 'honor' : 'practice'; history.replaceState(null, '', '#/student'); }
  if (deep) history.replaceState(null, '', '#/student');
  if (openSubId) tab = 'history';
  const seenKey = 'notifSeen_' + me.id;
  const unread = () => { const seen = pref.get(seenKey, ''); return notifs.filter((n) => (n.createdAt || '') > seen).length; };
  function paintBell() {
    const b = $('#stBell', app); if (!b) return;
    const n = unread();
    b.querySelector('.bell-n').textContent = n ? (n > 9 ? '+٩' : ar(n)) : '';
    b.classList.toggle('has', n > 0);
    b.setAttribute('aria-label', n ? `التنبيهات: ${ar(n)} جديدة` : 'التنبيهات');
  }
  async function openSub(subId) {
    try { data.subs = (await store.studentSubmissions(me.id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch {}
    tab = 'history'; draw();
    const i = data.subs.findIndex((x) => x.id === subId);
    const row = i >= 0 && $(`tr[data-i="${i}"]`, app);
    if (row) row.click(); else toast('هذا التسليم لم يعد موجوداً.');
  }
  const ackKey = 'annAck_' + me.id;
  const anns = () => notifs.filter((n) => n.type === 'ann').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  function ackAnn(aid) {
    const acked = new Set(pref.get(ackKey, []));
    if (!acked.has(aid)) { acked.add(aid); pref.set(ackKey, [...acked].slice(-200)); store.markAnnRead(aid, me.id).catch(() => {}); }
    paintAnnBar();
  }
  function paintAnnBar() {
    const host = $('#annBar', app); if (!host) return;
    const acked = new Set(pref.get(ackKey, []));
    const L = anns().filter((n) => !acked.has(n.annId));
    host.innerHTML = L.slice(0, 3).map((n) => `<div class="ann-bar" role="status"><span class="ann-ico">📢</span>
      <div class="ann-tx"><b>${esc((n.title || '').replace(/^📢\s*/, ''))}</b><span>${esc(n.body || '')}</span><small class="muted">${esc(timeAgo(n.createdAt))}</small></div>
      ${n.hasImage ? `<button class="btn sm gold" type="button" data-annopen="${esc(n.annId)}">📷 الصورة</button>` : ''}<button class="btn sm primary" type="button" data-ack="${esc(n.annId)}">فهمت</button></div>`).join('');
    $$('[data-ack]', host).forEach((b) => (b.onclick = () => ackAnn(b.dataset.ack)));
    $$('[data-annopen]', host).forEach((b) => (b.onclick = () => openAnn(b.dataset.annopen)));
  }
  function openAnn(aid) {
    const n = anns().find((x) => x.annId === aid);
    if (!n) return toast('هذا الإعلان لم يعد موجوداً.');
    openModal(`<div class="stack"><h2>📢 ${esc((n.title || '').replace(/^📢\s*/, ''))}</h2><p style="margin:0;white-space:pre-wrap;line-height:2">${esc(n.body || '')}</p>
      ${n.hasImage ? '<div class="ann-img" id="annImg"><div class="loading">جارٍ تحميل الصورة…</div></div>' : ''}
      <small class="muted">${esc(timeAgo(n.createdAt))}</small><div class="row"><button class="btn primary" type="button" data-close>فهمت</button></div></div>`, (m) => {
      if (!n.hasImage) return;
      annImage(aid, (id) => store.getAnnImage(id)).then((blob) => {
        const box = $('#annImg', m); if (!box) return;
        if (!blob) { box.innerHTML = `<div class="small muted">انتهت مدة عرض الصورة (${ar(IMG_DAYS)} يوماً).</div>`; return; }
        const url = URL.createObjectURL(blob);
        box.innerHTML = `<button type="button" class="ann-img-btn" aria-label="تكبير الصورة"><img alt="صورة الإعلان" src="${url}"><span class="ann-zoom">🔍 اضغط للتكبير</span></button>`;
        $('button', box).onclick = () => openLightbox(blob, 'صورة الإعلان');
      }).catch(() => { const box = $('#annImg', m); if (box) box.innerHTML = '<div class="small muted">تعذر تحميل الصورة. تحقق من الاتصال ثم افتح الإعلان مرة أخرى.</div>'; });
    });
    ackAnn(aid);
  }
  /** نافذة «نتائج شهرك» (تظهر تلقائياً مرة واحدة، وتُفتح من الجرس) */
  function openMonth(n) {
    if (!n) return;
    const seen = new Set(pref.get('monthSeen_' + me.id, [])); seen.add(n.ym); pref.set('monthSeen_' + me.id, [...seen].slice(-24));
    const r = n.r || {}, w = n.win, cp = n.classPos;
    const tile = (label, val, sub = '') => `<div><span>${label}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    openModal(`<div class="stack month-modal">
      <h2>نتائج شهرك · ${esc(n.label || '')}</h2>
      ${w ? `<div class="month-win"><div class="mw-badge">${rankBadge(w.rank)}</div><div><b>${esc(w.key === 'stage1' ? 'شيخ المرحلة' : w.key === 'cls1' ? 'قارئ الصف' : w.title)}</b><span>${esc(w.line)}. ما شاء الله تبارك الله!</span></div></div>` : `<p style="margin:0">${esc(n.body || '')}</p>`}
      <div class="usage-grid">
        ${tile('ترتيبك في الصف', r.cls ? `${ar(r.cls)} من ${ar(r.clsOf)}` : '—')}
        ${tile('على المرحلة', r.stage ? `${ar(r.stage)} من ${ar(r.stageOf)}` : '—')}
        ${tile('نقاطك', fmt10(r.points || 0), 'مجموع أفضل درجاتك في الواجبات')}
        ${tile('أطول سلسلة', `🔥 ${ar(n.streak || 0)}`, ((k) => (k === 0 ? 'لا أيام بعد' : k === 1 ? 'يوم واحد' : k === 2 ? 'يومان متتاليان' : k <= 10 ? 'أيام متتالية' : 'يوماً متتالياً'))(n.streak || 0))}
        ${cp && cp.pos ? tile('صفك في التحدي', `${ar(cp.pos)} من ${ar(cp.of)}`, esc(n.className || '')) : ''}
      </div>
      ${w ? `<div class="row"><button class="btn gold" type="button" id="cfPng">🏅 حمّل شهادتك (صورة)</button><button class="btn" type="button" id="cfPdf">PDF</button></div>` : ''}
      <div class="row"><button class="btn primary" type="button" data-close>${w ? 'الحمد لله' : 'سأجتهد بإذن الله'}</button></div></div>`, (m) => {
      if (!w) return;
      const cert = { ym: n.ym, name: me.name, title: w.title, line: w.line, rank: w.rank, month: n.label, points: r.points, className: n.className, teacher: n.teacher, date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) };
      $('#cfPng', m).onclick = (e) => { e.currentTarget.disabled = true; downloadCertificatePNG(cert).catch((x) => toast(x.message)).finally(() => (e.currentTarget.disabled = false)); };
      $('#cfPdf', m).onclick = (e) => { const b = e.currentTarget; b.disabled = true; downloadCertificatesPDF([cert], `certificate-${n.ym}.pdf`).catch((x) => toast(x.message)).finally(() => (b.disabled = false)); };
    });
    if (w) setTimeout(() => confetti(), 150);
  }
  /* --- مصحفي: خريطة الحفظ --- */
  let progress = null, mfFilter = 'all';
  async function loadProgress() {
    if (progress) return progress;
    let p = null;
    try { p = await store.getProgress(me.id); } catch (e) { console.warn(e); }
    if (!p?.seeded) { // أول مرة: نبنيها من التسميعات السابقة
      const built = mapFromSubs(data.subs.filter((x) => x.percent != null));
      p = { ...built, ...(p || {}), seeded: true };
      store.saveProgress(me.id, p).catch(() => {});
    }
    return (progress = p);
  }
  async function recordProgress(sub) {
    try {
      const p = await loadProgress();
      const keys = mergeAttempt(p, sub);
      if (keys.length) await store.saveProgress(me.id, Object.fromEntries(keys.map((k) => [k, p[k]])));
    } catch (e) { console.warn('progress', e); }
  }
  async function drawMushaf(body) {
    body.innerHTML = '<div class="loading">جارٍ تجهيز مصحفك…</div>';
    const p = await loadProgress();
    if (tab !== 'mushaf') return;
    const paint = () => renderMushaf(body, p, {
      filter: mfFilter, onFilter: (f) => { mfFilter = f; paint(); },
      onOpen: (s) => openModal(`<div class="stack">${surahDetailHtml(p, s)}
        <div class="row"><button class="btn primary" type="button" id="mfGo">🎙️ راجع الآن (تسميع غيباً)</button><button class="btn" type="button" data-close>إغلاق</button></div></div>`, (m) => {
        $('#mfGo', m).onclick = () => { closeModal(); pendingPractice = { ...suggestRange(p, s), mode: 'hifz' }; tab = 'practice'; draw(); scrollTo(0, 0); };
      }),
    });
    paint();
  }

  /* --- رأيك يهمنا --- */
  function paintFbCta() {
    const b = $('#stFb', app); if (!b) return;
    const n = myFb.filter((x) => x.reply && !x.replySeen).length;
    b.querySelector('.fb-n').textContent = n ? ` · ${n === 1 ? 'ردّ جديد' : ar(n) + ' ردود جديدة'}` : '';
    b.classList.toggle('has', n > 0);
  }
  function openFeedback(focusId = null) {
    const mine = [...myFb].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const fresh = new Set(mine.filter((x) => x.reply && !x.replySeen).map((x) => x.id));
    const item = (x) => `<li class="fb-item${x.id === focusId ? ' focus' : ''}" id="fb-${esc(x.id)}">
      <div class="row" style="justify-content:space-between;gap:8px">${fbKindChip(x.kind)}<small class="muted">${esc(timeAgo(x.createdAt))}</small></div>
      <p class="fb-text">${esc(x.text)}</p>
      ${x.reply ? `<div class="fb-reply${fresh.has(x.id) ? ' new' : ''}"><b>ردّ المعلم${fresh.has(x.id) ? ' <span class="pill">جديد</span>' : ''}</b><p>${esc(x.reply)}</p><small class="muted">${esc(timeAgo(x.repliedAt))}</small></div>` : '<small class="muted">✓ وصلت إلى المعلم</small>'}</li>`;
    openModal(`<div class="stack fb-modal">
      <h2>💬 رأيك يهمنا</h2>
      <p class="muted" style="margin:0">ملاحظتك مهمة لتطوير الموقع. تصل إلى المعلم باسمك وصفّك، وقد يردّ عليك هنا.</p>
      <form id="fbF" class="stack" style="gap:12px">
        <div class="fb-kinds" role="radiogroup" aria-label="نوع الملاحظة">${Object.entries(FB_KINDS).map(([k, [i, l]], n) => `<label><input type="radio" name="fbK" value="${k}" ${n === 0 ? 'checked' : ''}><span>${i} ${l}</span></label>`).join('')}</div>
        <label class="field">اكتب ملاحظتك<textarea id="fbT" rows="4" maxlength="1000" required placeholder="مثلاً: أقترح إضافة… / واجهت مشكلة عند…"></textarea></label>
        <div class="row" style="justify-content:space-between"><small class="muted" id="fbC">٠ / ١٠٠٠</small><button class="btn primary" type="submit">إرسال</button></div>
        <div id="fbErr" class="notice" hidden></div>
      </form>
      ${mine.length ? `<h3 style="margin:8px 0 0">ملاحظاتي السابقة</h3><ul class="fb-list">${mine.map(item).join('')}</ul>` : ''}
    </div>`, (m) => {
      const T = $('#fbT', m);
      T.oninput = () => ($('#fbC', m).textContent = `${ar(T.value.length)} / ١٠٠٠`);
      if (focusId) setTimeout(() => $('#fb-' + CSS.escape(focusId), m)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
      else setTimeout(() => T.focus(), 100);
      $('#fbF', m).onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.submitter, err = $('#fbErr', m), text = T.value.trim();
        err.hidden = true;
        if (text.length < 3) { err.hidden = false; err.textContent = 'اكتب ملاحظتك أولاً.'; return; }
        btn.disabled = true;
        const cls = data.classes.find((c) => c.id === me.classId);
        const f = { name: me.name, classId: me.classId || '', className: cls?.name || '', kind: $('input[name=fbK]:checked', m).value, text };
        try {
          const id = await store.addFeedback(me.id, f);
          myFb.push({ ...f, id, pn: me.id, createdAt: new Date().toISOString() });
          notifyFeedback(me.id, id).catch(() => {});
          closeModal(); paintFbCta();
          toast('شكراً لك! وصلت ملاحظتك إلى المعلم 🌟');
        } catch (x) { err.hidden = false; err.textContent = 'تعذر الإرسال: ' + (x.code || x.message); btn.disabled = false; }
      };
    });
    // تسجيل قراءة الردود الجديدة
    mine.filter((x) => fresh.has(x.id)).forEach((x) => { x.replySeen = true; store.updateFeedback(me.id, x.id, { replySeen: true }).catch(() => {}); });
    paintFbCta();
  }
  function openBell() {
    const seen = pref.get(seenKey, '');
    const L = [...notifs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    pref.set(seenKey, new Date().toISOString());
    paintBell();
    openModal(`<div class="stack"><h2>التنبيهات</h2>
      ${L.length ? `<ul class="notif-list">${L.map((n) => `<li><button type="button" class="notif-item${(n.createdAt || '') > seen ? ' new' : ''}" data-nid="${esc(n.id)}">
        <span class="notif-ico">${n.type === 'board' ? '🏆' : n.type === 'month' ? (n.win ? '🏅' : '📊') : n.type === 'streak' ? '🔥' : n.type === 'ann' ? '📢' : n.type === 'remind' ? '⏰' : n.type === 'retake' ? '🔁' : n.type === 'fbReply' ? '💬' : n.type === 'grade' ? (n.score >= 8 ? '🎉' : '⭐') : n.type === 'task-edit' ? '✎' : '📖'}</span>
        <span class="notif-tx"><b>${esc((n.title || '').replace(/^(🎉|📢|⏰|🔁|🔥|👑|🏆|🏅|📊|🌟|🏁|💬)\s*/u, ''))}</b><span>${esc(n.body || '')}</span><small class="muted">${esc(timeAgo(n.createdAt))}</small></span></button></li>`).join('')}</ul>`
        : '<div class="empty">لا توجد تنبيهات خلال آخر ٣٠ يوماً.</div>'}
      ${pushState(me.id) === 'ready' ? '<p class="small muted" style="margin:0">لتصلك التنبيهات على جوالك حتى والمقرأة مغلقة، فعّلها من «الإعدادات».</p>' : ''}</div>`, (m) => {
      $$('[data-nid]', m).forEach((b) => (b.onclick = () => {
        const n = notifs.find((x) => x.id === b.dataset.nid);
        closeModal();
        if (n?.type === 'grade') { openSub(n.subId); return; }
        if (n?.type === 'fbReply') { openFeedback(n.fid); return; }
        if (n?.type === 'ann') { openAnn(n.annId); return; }
        if (n?.type === 'month') { openMonth(n); return; }
        if (n?.type === 'board') { tab = 'honor'; draw(); return; }
        if (n?.type === 'streak') { tab = 'practice'; draw(); return; }
        if (n?.type === 'retake') { store.listRetakes(me.id).then((L) => { data.retakes = L; startRetake(n.retakeId); }).catch(() => startRetake(n.retakeId)); return; }
        const t = n?.taskId && data.tasks.find((x) => x.id === n.taskId);
        if (t) { tab = 'tasks'; openTask(t); } else if (n?.taskId) toast('هذا الواجب لم يعد موجوداً.');
      }));
    });
  }

  async function load() {
    app.innerHTML = '<div class="loading">جارٍ تحميل بياناتك…</div>';
    if (!(await store.isStudentAuthed(me))) { session.set(null); studentLogin(app, 'انتهت جلسة الدخول. اختر صفك واسمك واكتب كلمة السر من جديد.'); return; }
    try {
      const [tasks, subs, classes, rank, retakes, activity] = await Promise.all([store.listTasks(), store.studentSubmissions(me.id), store.listClasses(), store.getMyRank(me).catch(() => null), store.listRetakes(me.id).catch(() => []), store.listActivity(me.id, addDays(riyadhDay(), -400)).catch(() => [])]);
      data.retakes = retakes;
      me.rankInfo = rank;
      data = { retakes, activity, tasks: tasks.filter((t) => t.classId === 'all' || t.classId === me.classId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), subs: subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), classes };
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="empty">تعذر تحميل البيانات: ${esc(e.message)}</div>`;
      return;
    }
    draw();
    pruneImageCache();
    store.listMyFeedback(me.id).then((L) => { myFb = L; paintFbCta(); if (openFbId) { const id = openFbId; openFbId = null; openFeedback(id); } }).catch(() => {});
    if (openTaskId) { const t = data.tasks.find((x) => x.id === openTaskId); openTaskId = null; if (t) { openTask(t); return; } }
    if (openRetakeId) { const id = openRetakeId; openRetakeId = null; if ((data.retakes || []).some((r) => r.id === id)) { startRetake(id); return; } }
    openSubId = null; // درجة من إشعار: نفتح «سجل التسميع» ويعرض announceGrades الاحتفال
    announceGrades();
    whenModalFree(() => { if ($('#stBody', app)) celebrateStreak(); });
    if (!offNotifs) offNotifs = store.watchNotifs(me.classId, async (L) => {
      // درجة جديدة وصلت والصفحة مفتوحة: نحدّث التسليمات ونعرض الاحتفال
      if (L.some((n) => n.type === 'retake' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { data.retakes = await store.listRetakes(me.id); } catch {}
        if ($('#stBody', app) && tab === 'tasks') draw();
      }
      if (L.some((n) => n.type === 'fbReply' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { myFb = await store.listMyFeedback(me.id); paintFbCta(); } catch {}
      }
      if (L.some((n) => n.type === 'grade' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { data.subs = (await store.studentSubmissions(me.id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch {}
        if ($('#stBody', app)) { draw(); announceGrades(); }
      }
      const first = !notifs.length && !paintBell.done;
      notifs = L; paintBell(); paintBell.done = true; paintAnnBar();
      if (openAnnId && anns().some((n) => n.annId === openAnnId)) { const id = openAnnId; openAnnId = null; openAnn(id); }
      const months = L.filter((n) => n.type === 'month');
      const mDeep = openMonthYm && months.find((n) => n.ym === openMonthYm);
      if (mDeep) { openMonthYm = null; openMonth(mDeep); }
      else if ($('#stBody', app)) { const seen = new Set(pref.get('monthSeen_' + me.id, [])); const fresh = months.find((n) => !seen.has(n.ym)); if (fresh && !openMonth.pending) { openMonth.pending = true; whenModalFree(() => { openMonth.pending = false; if ($('#stBody', app) && !new Set(pref.get('monthSeen_' + me.id, [])).has(fresh.ym)) openMonth(fresh); }); } }
      const onList = $('#stBody', app) && tab === 'tasks';
      // واجب جديد وصل والطالب على صفحة الواجبات: نحدّث القائمة
      if (L.some((n) => n.taskId && !data.tasks.some((t) => t.id === n.taskId))) {
        try { const tasks = await store.listTasks(); data.tasks = tasks.filter((t) => t.classId === 'all' || t.classId === me.classId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch {}
        if ($('#stBody', app) && tab === 'tasks') draw();
      } else if (onList && first) draw();
    }, me.id);
    refreshPush(owner);
  }

  /** عند وصول تقييم جديد من المعلم: احتفال (٨ فأعلى) أو تحفيز، مرة واحدة لكل تقييم */
  function announceGrades() {
    const seen = new Set(pref.get('seenGrades_' + me.id, []));
    const fresh = data.subs.filter((x) => x.teacher && typeof x.teacher.total === 'number' && !seen.has(x.id + '@' + x.teacher.at));
    if (!fresh.length) return;
    fresh.forEach((x) => seen.add(x.id + '@' + x.teacher.at));
    pref.set('seenGrades_' + me.id, [...seen].slice(-300));
    const x = fresh.sort((a, b) => (b.teacher.at || '').localeCompare(a.teacher.at || ''))[0];
    const more = fresh.length - 1;
    openModal(`<div class="stack">
      <h2>${x.teacher.total >= 8 ? 'مبارك! وصل تقييم معلمك' : 'وصل تقييم معلمك'}</h2>
      <p class="muted" style="margin:0">${esc(x.taskTitle || 'تسميع')} · ${esc(rangeLabel(x.surah, x.from, x.to))}</p>
      ${cheerHtml(x.teacher.total, { who: 'teacher' })}
      ${x.teacher.notes ? `<div class="card"><b class="small">ملاحظة معلمك</b><p style="margin:6px 0 0">${esc(x.teacher.notes)}</p></div>` : ''}
      ${more ? `<p class="small muted" style="margin:0">ولديك ${more === 1 ? 'تقييم آخر جديد' : more === 2 ? 'تقييمان آخران جديدان' : `${ar(more)} تقييمات أخرى جديدة`} في «سجل التسميع».</p>` : ''}
      <div class="row"><button class="btn primary" type="button" data-close>${x.teacher.total >= 8 ? 'الحمد لله' : 'سأجتهد بإذن الله'}</button></div></div>`);
    if (x.teacher.total >= 8) setTimeout(() => confetti(), 150);
  }

  function draw() {
    comp?.destroy(); comp = null;
    const cls = data.classes.find((c) => c.id === me.classId);
    const graded = data.subs.filter((x) => x.percent != null);
    const avg = graded.length ? Math.round(graded.reduce((n, x) => n + x.percent, 0) / graded.length) : null;
    const doneTasks = new Set(data.subs.map((x) => x.taskId).filter(Boolean));
    const streak = streakOf(activeDays()).days;
    app.innerHTML = `
      <div class="page-head">
        <div><span class="muted small">${esc(cls?.name || '')}</span><h1>السلام عليكم، ${esc(me.name)}</h1>
          ${me.rankInfo?.month?.stage === 1 ? `<span class="title-pill">${rankBadge(1)} شيخ المرحلة هذا الشهر</span>` : me.rankInfo?.month?.cls === 1 ? `<span class="title-pill">${rankBadge(1)} قارئ الصف هذا الشهر</span>` : ''}</div>
        <div class="row"><button class="btn bell-btn" id="stBell" type="button" aria-label="التنبيهات"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg><span class="bell-n"></span></button><button class="btn gear-btn${tab === 'settings' ? ' on' : ''}" id="stSet" type="button" aria-pressed="${tab === 'settings'}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg> الإعدادات</button><button class="btn" id="stOut" type="button">تسجيل الخروج</button></div>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${ar(doneTasks.size)}/${ar(data.tasks.length)}</b><span>واجبات منجزة</span></div>
        <div class="kpi"><b>${avg == null ? '—' : ar(avg) + '٪'}</b><span>متوسط دقة الحفظ</span></div>
        <div class="kpi"><b>${ar(data.subs.length)}</b><span>مرات التسميع</span></div>
        <div class="kpi" id="kpiStreak" title="تُحسب الأيام التي سمّعت فيها واجباً أو تدرّبت دقيقة فأكثر"><b>🔥 ${ar(streak)}</b><span>أيام متتالية</span></div>
      </div>
      <div id="annBar"></div>
      <div class="tabs" role="tablist">
        ${[['tasks', 'واجباتي'], ['practice', 'تدريب حر'], ['mushaf', 'مصحفي'], ['honor', 'لوحة الشرف'], ['history', 'سجل التسميع'], ['notebook', 'دفتر الأخطاء']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div id="stBody" style="margin-top:16px"></div>
      <div class="fb-cta" id="fbCta"><span class="fb-ico" aria-hidden="true">💬</span><div><b>رأيك يهمنا</b><span>ملاحظتك مهمة لتطوير الموقع: تعليق، شكوى، اقتراح، أو ملاحظة.</span></div><button class="btn gold" type="button" id="stFb">أرسل ملاحظتك<span class="fb-n"></span></button></div>`;
    $('#stFb', app).onclick = () => openFeedback();
    paintFbCta();
    $('#stOut', app).onclick = async () => { await disablePush().catch(() => {}); offNotifs?.(); await store.signOut(); session.set(null); render(); };
    $('#stBell', app).onclick = openBell;
    paintBell(); paintAnnBar();
    $('#stSet', app).onclick = () => { tab = tab === 'settings' ? 'tasks' : 'settings'; draw(); if (tab === 'settings') $('#stBody', app)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    const body = $('#stBody', app);
    if (tab === 'tasks') drawTasks(body, doneTasks);
    if (tab === 'history') drawHistory(body);
    if (tab === 'notebook') drawNotebook(body);
    if (tab === 'practice') drawPractice(body);
    if (tab === 'honor') drawHonor(body);
    if (tab === 'mushaf') drawMushaf(body);
    if (tab === 'settings') drawStSettings(body);
  }

  /* --- إعدادات الطالب: تثبيت التطبيق وكلمة السر --- */
  let offInstall = null;
  function drawStSettings(body) {
    const cls = data.classes.find((c) => c.id === me.classId);
    body.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">الإعدادات</h2><button class="btn sm" type="button" id="setBack">رجوع إلى واجباتي</button></div>
      <div class="grid2" style="align-items:start">
      <div class="card stack install-card" id="instCard" style="gap:12px"></div>
      <div class="card stack" id="pushCard" style="gap:12px"></div>
      <form class="card stack" id="pwF" style="gap:12px">
        <button type="button" class="pw-toggle" id="pwTog" aria-expanded="false" aria-controls="pwBox">
          <span class="install-ico"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3zm3 4a1.5 1.5 0 0 0-1 2.6V18h2v-1.4a1.5 1.5 0 0 0-1-2.6z"/></svg></span>
          <span class="pw-tt"><b>تغيير كلمة السر</b><small class="muted">حسابك: ${esc(me.name)}${cls ? ` · ${esc(cls.name)}` : ''}</small></span>
          <svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
        </button>
        <div id="pwBox" class="stack" style="gap:12px" hidden>
          <label class="field">كلمة السر الحالية<input type="password" id="pwC" autocomplete="current-password" inputmode="numeric" required></label>
          <label class="field">كلمة السر الجديدة (٦ خانات على الأقل)<input type="password" id="pwN" autocomplete="new-password" minlength="6" required></label>
          <label class="field">أعد كتابة الجديدة<input type="password" id="pwN2" autocomplete="new-password" minlength="6" required></label>
          <label class="row small" style="gap:6px"><input type="checkbox" id="pwShow"> إظهار كلمات السر</label>
          <div id="pwErr" class="notice" hidden></div>
          <p class="small muted" style="margin:0">احفظ كلمتك الجديدة جيداً ولا تعطها لأحد. إن نسيتها فاطلب من معلمك كلمة سر جديدة.</p>
          <div class="row"><button class="btn primary" type="submit">حفظ كلمة السر</button><button class="btn" type="button" id="pwCancel">إلغاء</button></div>
        </div>
      </form>
    </div>`;
    $('#setBack', body).onclick = () => { tab = 'tasks'; draw(); };
    const pwOpen = (open) => {
      const box = $('#pwBox', body), tog = $('#pwTog', body);
      box.hidden = !open; tog.setAttribute('aria-expanded', open);
      if (open) $('#pwC', body).focus(); else { $('#pwF', body).reset(); $('#pwErr', body).hidden = true; ['#pwC', '#pwN', '#pwN2'].forEach((q) => ($(q, body).type = 'password')); }
    };
    $('#pwTog', body).onclick = () => pwOpen($('#pwBox', body).hidden);
    $('#pwCancel', body).onclick = () => pwOpen(false);
    $('#pwShow', body).onchange = (e) => ['#pwC', '#pwN', '#pwN2'].forEach((q) => ($(q, body).type = e.target.checked ? 'text' : 'password'));
    $('#pwF', body).onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#pwErr', body), btn = e.submitter;
      const cur = latinDigits($('#pwC', body).value).trim(), n1 = latinDigits($('#pwN', body).value).trim(), n2 = latinDigits($('#pwN2', body).value).trim();
      err.hidden = true;
      if (n1.length < 6) { err.hidden = false; err.textContent = 'كلمة السر الجديدة يجب أن تكون ٦ خانات على الأقل.'; return; }
      if (n1 !== n2) { err.hidden = false; err.textContent = 'الكلمتان الجديدتان غير متطابقتين.'; return; }
      if (n1 === cur) { err.hidden = false; err.textContent = 'اختر كلمة سر مختلفة عن الحالية.'; return; }
      btn.disabled = true;
      try {
        await store.changePassword(me, cur, n1);
        const rm = remember.get('student'); if (rm && rm.id === me.id) remember.set('student', { classId: rm.classId, id: rm.id }, n1);
        pwOpen(false); toast('تم تغيير كلمة السر.');
      }
      catch (x) { err.hidden = false; err.textContent = x.message; }
      btn.disabled = false;
    };
    drawInstall(body);
    drawPushCard(body);
    offInstall?.();
    offInstall = onInstallChange(() => { if (tab === 'settings') { drawInstall(body); drawPushCard(body); } });
  }

  function drawPushCard(body) {
    const host = $('#pushCard', body); if (!host) return;
    const st = pushState(me.id);
    const msg = {
      'off-config': '<span class="pill">داخل الموقع</span> تظهر التنبيهات في الجرس 🔔 أعلى الصفحة. الإشعارات على الجوال لم يفعّلها معلمك بعد.',
      unsupported: '<span class="pill warn">غير مدعوم</span> هذا المتصفح لا يدعم الإشعارات. جرّب Chrome على أندرويد، أو ثبّت المقرأة على الآيفون. تبقى التنبيهات في الجرس 🔔.',
      'needs-install': '<span class="pill warn">ثبّت أولاً</span> على الآيفون والآيباد تصل الإشعارات بعد تثبيت المقرأة على الشاشة الرئيسية (iOS 16.4 أو أحدث). ثبّتها من البطاقة المجاورة، ثم افتحها من أيقونتها وعُد إلى هنا.',
      denied: '<span class="pill bad">مرفوضة</span> رفض جهازك الإشعارات لهذا الموقع. لتفعيلها: افتح إعدادات الجوال ← الإشعارات ← مقرأة الفاتح (أو إعدادات الموقع في المتصفح) واسمح بها، ثم حدّث الصفحة.',
      ready: 'فعّلها ليصلك إشعار لحظة إرسال معلمك واجباً جديداً أو تعديله، حتى والمقرأة مغلقة.',
      on: '<span class="pill ok">مفعّلة</span> تصلك التنبيهات على هذا الجهاز. لإيقافها اضغط «إيقاف».',
    }[st];
    host.innerHTML = `<div class="row" style="gap:10px"><span class="install-ico">🔔</span><h3 style="margin:0">الإشعارات</h3></div>
      <p class="small" style="margin:0">${msg}</p>
      ${st === 'ready' ? '<button class="btn primary" type="button" id="pushOn" style="align-self:flex-start">فعّل الإشعارات</button>' : ''}
      ${st === 'on' ? `<div class="mute-list"><b class="small">ما يصلني على الجوال:</b>
        <label><input type="checkbox" checked disabled> الواجبات والدرجات وطلبات الإعادة والإعلانات وتذكير المواعيد <span class="muted small">(دائماً)</span></label>
        <label><input type="checkbox" data-mute="streak" ${getMute().includes('streak') ? '' : 'checked'}> 🔥 تذكير «حافظ على سلسلتك»</label>
        <label><input type="checkbox" data-mute="board" ${getMute().includes('board') ? '' : 'checked'}> 🏆 أخبار لوحة الشرف</label>
        <span class="small muted">لا تصلك إشعارات بين ١٠ مساءً و٦ صباحاً، وما يُرسل فيها يصلك صباحاً. تبقى كل التنبيهات في الجرس 🔔.</span></div>
        <div class="row"><button class="btn" type="button" id="pushTest">جرّب إشعاراً</button><button class="btn ghost" type="button" id="pushOff">إيقاف</button></div>` : ''}`;
    const on = $('#pushOn', host);
    if (on) on.onclick = async () => { on.disabled = true; try { await enablePush(owner); toast('تم تفعيل الإشعارات.'); } catch (e) { toast(e.message); } drawPushCard(body); };
    const off = $('#pushOff', host);
    if (off) off.onclick = async () => { await disablePush().catch(() => {}); toast('أُوقفت الإشعارات على هذا الجهاز. تبقى التنبيهات في الجرس 🔔.'); drawPushCard(body); };
    const tst = $('#pushTest', host);
    if (tst) tst.onclick = () => testNotification().catch((e) => toast(e.message));
    $$('[data-mute]', host).forEach((c) => (c.onchange = async () => {
      const mute = $$('[data-mute]', host).filter((x) => !x.checked).map((x) => x.dataset.mute);
      try { await setMute(mute); toast('حُفظ اختيارك.'); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); c.checked = !c.checked; }
    }));
  }

  function drawInstall(body) {
    const host = $('#instCard', body); if (!host) return;
    const p = platform();
    const phone = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 3v13h8V5H8zm4 14.2a1 1 0 1 0 0 .01z"/></svg>';
    host.innerHTML = `<div class="row" style="gap:10px"><span class="install-ico">${phone}</span><h3 style="margin:0">المقرأة تطبيقاً على جوالك</h3></div>
      ${p.standalone
        ? '<p style="margin:0"><span class="pill ok">مثبّت</span> أنت تستخدم المقرأة الآن كتطبيق. تجدها في الشاشة الرئيسية لجوالك.</p>'
        : `<p class="small" style="margin:0">ضع أيقونة المقرأة على الشاشة الرئيسية لجوالك، فتفتحها بلمسة كأي تطبيق، بشاشة كاملة ودون كتابة الرابط. لا يحتاج متجر التطبيقات، ولا يأخذ مساحة تُذكر.</p>
          ${p.ios && p.inApp ? '<div class="notice small">أنت تفتح المقرأة من داخل تطبيق آخر (مثل واتساب). افتحها في متصفح <b>Safari</b> أولاً: اضغط ⋯ أو أيقونة البوصلة ثم «فتح في Safari».</div>' : ''}
          <button class="btn primary install-btn" type="button" id="instBtn">${phone} ثبّت التطبيق</button>
          <p class="small muted" style="margin:0">${p.ios ? 'على الآيفون والآيباد: يعرض لك الزر الخطوات (ثلاث لمسات)، لأن Apple لا تسمح بالتثبيت المباشر من المواقع.' : p.canPrompt ? 'يعمل على أندرويد والحاسوب: تظهر نافذة التثبيت فاضغط «تثبيت».' : 'إن لم تظهر نافذة التثبيت، يعرض لك الزر الخطوات حسب متصفحك.'}</p>`}`;
    const btn = $('#instBtn', host);
    if (btn) btn.onclick = async () => {
      if (platform().canPrompt) {
        const r = await promptInstall();
        if (r === 'accepted') toast('تم التثبيت. تجد المقرأة في الشاشة الرئيسية.');
        return;
      }
      openModal(installStepsHtml(platform()));
    };
  }

  async function drawHonor(body) {
    body.innerHTML = '<div class="loading">جارٍ تحميل لوحة الشرف…</div>';
    let board = null, myRank = null;
    try { [board, myRank] = await Promise.all([store.getBoard(), store.getMyRank(me).catch(() => null)]); }
    catch (e) { body.innerHTML = `<div class="empty">تعذر تحميل لوحة الشرف: ${esc(e.code || e.message)}</div>`; return; }
    if (tab !== 'honor') return;
    mountBoard(body, board, { me: me.id, myClass: me.classId, myRank, classes: data.classes });
    // احتفال أول مرة يدخل فيها الخمسة الأوائل في صفه أو المرحلة (لكل شهر)
    const r = myRank?.month;
    if (r && ((r.cls && r.cls <= 5) || (r.stage && r.stage <= 5))) {
      const key = `lbCheer_${me.id}_${board?.month?.ym || ''}_${r.stage && r.stage <= 5 ? 's' : 'c'}`;
      if (!pref.get(key, false)) { pref.set(key, true); setTimeout(() => confetti(), 200); toast(r.stage && r.stage <= 5 ? 'مبارك! أنت من الخمسة الأوائل في المرحلة كلها هذا الشهر.' : 'مبارك! أنت من الخمسة الأوائل في صفك هذا الشهر.'); }
    }
  }

  async function drawPractice(body) {
    let learn = null;
    try {
      const model = await store.getModel();
      learn = { model, rates: studentRates(model, data.subs), weak: weakRules(model, data.subs, 3) };
    } catch {}
    if (tab !== 'practice') return;
    comp?.destroy();
    comp = mountPractice(body, learn, (sec) => logAct('practice', sec), (sub) => recordProgress(sub));
  }

  function pushInvite() {
    const st = pushState(me.id);
    if (!['ready', 'needs-install'].includes(st) || pref.get('pushInviteOff_' + me.id, false)) return '';
    return `<div class="card push-invite" id="pushInv"><span class="install-ico">🔔</span>
      <div class="stack" style="gap:4px;flex:1"><b>${st === 'ready' ? 'فعّل التنبيهات ليصلك كل واجب جديد' : 'ثبّت المقرأة لتصلك التنبيهات'}</b>
      <span class="small muted">${st === 'ready' ? 'يصلك إشعار على جوالك لحظة إرسال معلمك واجباً، حتى والمقرأة مغلقة.' : 'على الآيفون تصل الإشعارات بعد تثبيت المقرأة على الشاشة الرئيسية فقط.'}</span></div>
      <div class="row"><button class="btn primary sm" type="button" id="pushInvGo">${st === 'ready' ? 'فعّل التنبيهات' : 'طريقة التثبيت'}</button><button class="btn sm ghost" type="button" id="pushInvNo">لاحقاً</button></div></div>`;
  }
  function retakeCards() {
    const L = openRetakes();
    if (!L.length) return '';
    return `<div class="stack" style="gap:10px;margin-bottom:12px">${L.map((r) => `<div class="card retake-card">
      <div class="t-main"><b>🔁 معلمك يطلب إعادة التسميع</b><h3 style="margin:4px 0 0">${esc(r.taskTitle || 'تسميع')}</h3><div class="t-range">${esc(rangeLabel(r.surah, r.from, r.to))}</div>
      ${r.notes ? `<p class="small" style="margin:6px 0 0">«${esc(r.notes)}»</p>` : ''}
      <div class="small muted">${r.due ? `أعده قبل ${fmtDate(r.due)}` : 'بلا موعد محدد'}</div></div>
      <div class="row"><button class="btn primary" type="button" data-retake="${esc(r.id)}">أعد التسميع</button></div></div>`).join('')}</div>`;
  }
  function bindPushInvite(body) {
    const go = $('#pushInvGo', body); if (!go) return;
    $('#pushInvNo', body).onclick = () => { pref.set('pushInviteOff_' + me.id, true); $('#pushInv', body)?.remove(); toast('يمكنك تفعيلها لاحقاً من «الإعدادات».'); };
    go.onclick = async () => {
      if (pushState(me.id) === 'needs-install') { tab = 'settings'; draw(); return; }
      go.disabled = true;
      try { await enablePush(owner); $('#pushInv', body)?.remove(); toast('تم تفعيل التنبيهات على هذا الجهاز.'); }
      catch (e) { toast(e.message); go.disabled = false; }
    };
  }
  function drawTasks(body, done) {
    if (!data.tasks.length) { body.innerHTML = pushInvite() + retakeCards() + '<div class="empty">لا توجد واجبات حالياً. يمكنك التدرب على أي سورة من تبويب «تدريب حر».</div>'; $$('[data-retake]', body).forEach((b) => (b.onclick = () => startRetake(b.dataset.retake))); bindPushInvite(body); return; }
    const fresh = new Set(notifs.filter((n) => n.taskId && (n.createdAt || '') > pref.get(seenKey, '')).map((n) => n.taskId));
    body.innerHTML = pushInvite() + retakeCards() + `<div class="stack">${data.tasks.map((t) => {
      const mySubs = data.subs.filter((x) => x.taskId === t.id);
      const best = mySubs.reduce((m, x) => Math.max(m, x.percent ?? -1), -1);
      const overdue = t.due && !done.has(t.id) && new Date(t.due) < new Date(new Date().toDateString());
      return `<div class="card task">
        <div class="t-main"><h3>${esc(t.title)}${fresh.has(t.id) && !done.has(t.id) ? ' <span class="pill new-pill">جديد</span>' : ''}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
          <div class="small muted">${t.mode === 'hifz' ? 'تسميع غيباً' : 'تلاوة نظراً'}${t.due ? ` · التسليم ${fmtDate(t.due)}` : ''}${t.notes ? ` · ${esc(t.notes)}` : ''}</div></div>
        <div class="row">${done.has(t.id) ? `<span class="pill ok">أُرسل${best >= 0 ? ` · ${ar(best)}٪` : ''}</span>` : overdue ? '<span class="pill bad">متأخر</span>' : '<span class="pill warn">لم يُنجز</span>'}
        ${done.has(t.id) ? `<button class="btn" type="button" data-prac="${esc(t.id)}">تدرّب عليه</button>` : `<button class="btn primary" type="button" data-task="${esc(t.id)}">ابدأ التسميع</button>`}</div></div>`;
    }).join('')}</div>`;
    $$('[data-task]', body).forEach((b) => (b.onclick = () => openTask(data.tasks.find((t) => t.id === b.dataset.task))));
    $$('[data-prac]', body).forEach((b) => (b.onclick = () => { const t = data.tasks.find((x) => x.id === b.dataset.prac); pendingPractice = { surah: t.surah, from: t.from, to: t.to, mode: t.mode }; tab = 'practice'; draw(); }));
    $$('[data-retake]', body).forEach((b) => (b.onclick = () => startRetake(b.dataset.retake)));
    bindPushInvite(body);
  }

  /** واجب أو طلب إعادة: محاولة واحدة تُرسل تلقائياً */
  async function openTask(t, rt = null) {
    comp?.destroy();
    const sid = rt ? 'r_' + rt.id : 't_' + t.id;
    const already = rt ? data.subs.some((x) => x.retakeId === rt.id) : data.subs.some((x) => x.taskId === t.id && !x.retakeId);
    let learn = null;
    try {
      const model = await store.getModel();
      const rates = studentRates(model, data.subs);
      learn = { model, rates, weak: weakRules(model, data.subs, 3) };
    } catch {}
    const range = rt ? { surah: rt.surah, from: rt.from, to: rt.to } : { surah: t.surah, from: t.from, to: t.to };
    const note = rt ? (rt.notes ? `ملاحظة معلمك: ${rt.notes}` : 'معلمك يطلب منك إعادة هذا المقطع.') : (t.notes || 'اقرأ المقطع كاملاً، ويُرسل تسجيلك للمعلم تلقائياً عند الإيقاف.');
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="tkBack" type="button">→ رجوع للواجبات</button><h1>${rt ? 'إعادة: ' : ''}${esc(t?.title || rt?.taskTitle || 'تسميع')}</h1>
      <p class="muted" style="margin:4px 0 0">${rt ? esc(rangeLabel(range.surah, range.from, range.to)) + ' · ' : ''}${esc(note)}</p></div></div><div id="tkBody"></div>`;
    $('#tkBack', app).onclick = () => { comp?.destroy(); comp = null; load(); };
    if (already) { $('#tkBody', app).innerHTML = `<div class="empty">أرسلت محاولتك لهذا ${rt ? 'الطلب' : 'الواجب'}. لكل ${rt ? 'طلب' : 'واجب'} محاولة واحدة، ويمكن لمعلمك أن يطلب منك إعادته.</div>`; return; }
    const cls = data.classes.find((c) => c.id === me.classId);
    comp = mountRecite($('#tkBody', app), {
      ...range, mode: rt?.mode || t?.mode, learn, oneShot: true,
      onPractice: () => { comp?.destroy(); comp = null; pendingPractice = { ...range, mode: rt?.mode || t?.mode }; tab = 'practice'; draw(); },
      onSubmit: async (sub, blob) => {
        const extra = rt ? { retakeId: rt.id, retakeOf: rt.subId || null } : {};
        const id = await store.addSubmission(me.id, { ...sub, ...range, taskId: t?.id || rt?.taskId || null, taskTitle: t?.title || rt?.taskTitle || '', studentName: me.name, classId: me.classId, className: cls?.name || '', teacher: null, ...extra }, blob, sid);
        data.subs.unshift({ ...sub, id, pn: me.id, taskId: t?.id || rt?.taskId, ...extra, createdAt: new Date().toISOString() });
        logAct('task', sub.duration || 0);
        recordProgress({ ...sub, ...range });
        return id;
      },
      onAi: (id, ai) => store.updateOwnAi(me.id, id, ai),
    });
  }

  function drawHistory(body) {
    if (!data.subs.length) { body.innerHTML = '<div class="empty">لم تُرسل أي تسميع بعد.</div>'; return; }
    body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المقطع</th><th>الدقة الآلية</th><th>تقييم المعلم</th><th>ملاحظات</th></tr></thead><tbody>
      ${data.subs.map((x, i) => `<tr class="click" data-i="${i}"><td class="num">${fmtDate(x.createdAt)}</td><td>${esc(x.taskTitle || rangeLabel(x.surah, x.from, x.to))}</td>
      <td>${x.percent == null ? '<span class="pill mute">بانتظار المعلم</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td>
      <td>${x.teacher ? `${x.teacher.total >= 8 ? '<span class="star" title="درجة متميزة">★</span> ' : ''}<b class="num">${ar(x.teacher.total)}</b>/١٠` : '<span class="muted">—</span>'}</td><td style="white-space:normal;min-width:160px">${esc(x.teacher?.notes || '')}</td></tr>`).join('')}
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
  return { destroy: () => { comp?.destroy(); offNotifs?.(); offInstall?.(); } };
}

async function studentLogin(app, msg = '') {
  app.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  let classes = [];
  try { classes = sortClasses(await store.listClasses()); } catch (e) {
    console.warn(e);
    const why = e?.code === 'permission-denied' || e?.code === 'unauthenticated' ? 'لم يكتمل الاتصال الآمن بقاعدة البيانات.' : e?.code === 'unavailable' || !navigator.onLine ? 'يبدو أن الاتصال بالإنترنت ضعيف أو مقطوع.' : 'حدث خطأ مؤقت.';
    app.innerHTML = `<div class="empty stack" style="align-items:center">تعذر تحميل الصفوف. ${why}<button class="btn primary" type="button" id="slRetry">إعادة المحاولة</button></div>`;
    $('#slRetry', app).onclick = () => studentLogin(app, msg);
    return;
  }
  const rem = remember.get('student');
  const last = rem ? { classId: rem.classId, id: rem.id } : pref.get('lastLogin', {});
  app.innerHTML = `<div class="card auth stack">
    <h2>دخول الطالب</h2>
    ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
    <form id="slForm" class="stack" style="gap:12px">
      <label class="field">الصف<select id="slClass" required><option value="">اختر صفك</option>${classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field">الاسم<select id="slName" required disabled><option value="">اختر صفك أولاً</option></select></label>
      <label class="field">كلمة السر
        <span class="row" style="gap:6px;flex-wrap:nowrap"><input type="text" id="slUser" name="username" autocomplete="username" hidden><input type="password" id="slPw" name="password" inputmode="numeric" autocomplete="current-password" required style="flex:1"><button class="btn sm" type="button" id="slEye" aria-label="إظهار كلمة السر">إظهار</button></span></label>
      ${rememberBox('slRem', !!rem)}
      <div id="slErr" class="notice" hidden></div>
      <button class="btn primary" type="submit">دخول</button>
    </form>
    <p class="small muted" style="margin:0">كلمة السر مكتوبة في بطاقتك التي أعطاك إياها المعلم. إن نسيتها فاطلب منه كلمة جديدة.</p>
  </div>`;
  const C = $('#slClass', app), N = $('#slName', app), P = $('#slPw', app);
  const loadNames = async (selectId) => {
    N.disabled = true;
    if (!C.value) { N.innerHTML = '<option value="">اختر صفك أولاً</option>'; return; }
    N.innerHTML = '<option value="">جارٍ التحميل…</option>';
    try {
      const list = await store.listDirectory(C.value);
      N.innerHTML = list.length
        ? '<option value="">اختر اسمك</option>' + list.map((x) => `<option value="${esc(x.id)}" ${x.hasAccount ? '' : 'disabled'}>${esc(x.name)}${x.hasAccount ? '' : ' (لم يُنشأ حسابه)'}</option>`).join('')
        : '<option value="">لا يوجد طلاب في هذا الصف بعد</option>';
      N.disabled = !list.length;
      if (selectId && list.some((x) => x.id === selectId)) N.value = selectId;
      fillPw();
    } catch (e) { N.innerHTML = '<option value="">تعذر تحميل الأسماء</option>'; }
  };
  // تعبئة كلمة السر المحفوظة إن كان الاسم المختار هو صاحبها
  const fillPw = () => {
    $('#slUser', app).value = N.value ? `${C.value}/${N.value}` : '';
    const r = remember.get('student');
    if (r && r.classId === C.value && r.id === N.value) { P.value = r.p; $('#slRem', app).checked = true; }
    else if (P.dataset.auto) P.value = '';
    P.dataset.auto = r && r.id === N.value ? '1' : '';
  };
  N.onchange = fillPw;
  $('#slRem', app).onchange = (e) => { if (!e.target.checked) { remember.clear('student'); toast('لن تُحفظ كلمة السر على هذا الجهاز.'); } };
  C.onchange = () => loadNames();
  $('#slEye', app).onclick = (e) => { const show = P.type === 'password'; P.type = show ? 'text' : 'password'; e.target.textContent = show ? 'إخفاء' : 'إظهار'; };
  if (last.classId && classes.some((c) => c.id === last.classId)) { C.value = last.classId; loadNames(last.id); }
  $('#slForm', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    const box = $('#slErr', app); box.hidden = true;
    try {
      const student = await store.studentSignIn(C.value, N.value, latinDigits(P.value).trim());
      pref.set('lastLogin', { classId: C.value, id: N.value });
      if ($('#slRem', app).checked) remember.set('student', { classId: C.value, id: N.value }, latinDigits(P.value).trim());
      else remember.clear('student');
      session.set({ role: 'student', student });
      render();
    } catch (err) {
      box.hidden = false; box.textContent = err.message; btn.disabled = false;
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
  if (/^#\/teacher\/feedback/.test(location.hash)) { tab = 'fb'; history.replaceState(null, '', '#/teacher'); }
  let D = { classes: [], students: [], tasks: [], subs: [] };
  let errCat = defaultCatalog();
  store.getErrorCatalog().then((c) => { errCat = mergeCatalog(c); }).catch(() => {});
  let errSaveT = null;
  const saveErrCat = () => { clearTimeout(errSaveT); errSaveT = setTimeout(() => store.saveErrorCatalog({ ...errCat, updatedAt: new Date().toISOString() }).then(() => toast('حُفظت قائمة الأخطاء.')).catch((e) => toast('تعذر حفظ قائمة الأخطاء: ' + (e.code || e.message))), 700); };
  let aiDoc, aiDocLoading = false; // مستند usage/ai-الشهر
  const loadAiDoc = async (force) => {
    if (aiDocLoading || (aiDoc !== undefined && !force) || !aiEnabled()) return;
    aiDocLoading = true;
    try { aiDoc = await store.getAiUsage(utcMonth()); } catch { aiDoc = null; }
    aiDocLoading = false;
    drawHead();
    if (tab === 'settings') { const b = $('#tBody', app); if (b && $('#aiUse', b)) drawAiCard(b); }
  };
  let unsub = null;
  let filters = { cls: 'all', task: 'all', q: '', status: 'all' };
  // التحديد المتعدد (يبقى عند تحديث الجدول)
  const selSubs = new Set(), selStu = new Set();
  const openGroups = new Set(pref.get('openGroups', [])); // الصفوف المفتوحة في قائمة الطلاب
  const subKey = (x) => `${x.pn}/${x.id}`;
  /** مربع «تحديد الكل» في رأس الجدول: محدد أو جزئي أو فارغ */
  function headBox(box, visibleKeys, set) {
    const n = visibleKeys.filter((k) => set.has(k)).length;
    box.checked = !!visibleKeys.length && n === visibleKeys.length;
    box.indeterminate = n > 0 && n < visibleKeys.length;
  }
  async function runBulk(title, items, fn) {
    openModal(`<div class="stack"><h2>${esc(title)}</h2><div id="bkTxt">جارٍ التنفيذ…</div><div class="progress"><i id="bkBar"></i></div></div>`);
    let ok = 0, fail = 0;
    for (let i = 0; i < items.length; i++) {
      try { await fn(items[i]); ok++; } catch (e) { console.warn(e); fail++; }
      const t = $('#bkTxt'), bar = $('#bkBar');
      if (t) t.textContent = `تم ${ar(i + 1)} من ${ar(items.length)}`;
      if (bar) bar.style.width = ((i + 1) / items.length) * 100 + '%';
    }
    closeModal();
    return { ok, fail };
  }

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
    refreshPush(tOwner);
    loadFb();
    unsub?.();
    unsub = store.watchSubmissions((subs) => { D.subs = subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); schedulePublish(); if (!load.mb) { load.mb = true; setTimeout(checkMonthBar, 300); } if (tab === 'subs' || tab === 'reports' || tab === 'honor') drawBody(); else drawHead(); }, (e) => toast('تعذر تحديث التسليمات: ' + (e.code || e.message)));
    draw();
  }
  const reload = async (redraw = true) => {
    const [classes, students, tasks] = await Promise.all([store.listClasses(), store.listStudents(), store.listTasks()]);
    D = { ...D, classes: sortClasses(classes), students, tasks };
    if (!reload.cleaned) { reload.cleaned = true; store.cleanupNotifs().catch(() => {}); store.cleanupAnnImages().catch(() => {}); }
    if (redraw) drawBody();
  };
  const className = (id) => (id === 'all' ? 'كل الصفوف' : D.classes.find((c) => c.id === id)?.name || '—');

  function draw() {
    app.innerHTML = `
      <div class="page-head">
        <div><span class="muted small">لوحة المعلم</span><h1>${esc(s.name || 'المعلم')}</h1></div>
        <div class="row"><a class="btn" href="#/practice">معاينة التدريب</a><button class="btn" id="tOut" type="button">تسجيل الخروج</button></div>
      </div>
      <div id="dbWarn"></div>
      <div id="monthBar"></div>
      <div class="kpis" id="tKpis"></div>
      <div class="tabs" role="tablist">${[['subs', 'التسليمات'], ['tasks', 'الواجبات'], ['people', 'الصفوف والطلاب'], ['ann', 'الإعلانات'], ['errors', 'الأخطاء ودرجاتها'], ['honor', 'لوحة الشرف'], ['fb', 'رأيك يهمنا'], ['reports', 'التقارير'], ['settings', 'الإعدادات']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'fb' ? '<span class="tab-n" id="fbTabN"></span>' : ''}</button>`).join('')}</div>
      <div id="tBody" style="margin-top:16px"></div>`;
    $('#tOut', app).onclick = async () => { unsub?.(); if (pushState('teacher') === 'on') await disablePush().catch(() => {}); await store.signOut(); session.set(null); render(); };
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
      <div class="kpi"><b>${ar(D.students.length)}</b><span>طالباً في ${ar(D.classes.length)} صفوف</span></div>
      ${(() => { const u = dbUsage(D.subs, D.students); return `<button type="button" class="kpi kpi-btn usage-${u.level}" id="kpiDb" title="تفاصيل المساحة">
        <b>${ar(Math.round(u.pct * 100))}٪</b><span>مساحة قاعدة البيانات (${fmtBytes(u.total)} من ١ GB)</span>
        <span class="meter"><i style="width:${Math.min(100, Math.max(1, u.pct * 100))}%"></i></span></button>`; })()}
      ${aiEnabled() ? (() => { const a = aiUsage(aiDoc, D.subs); return `<button type="button" class="kpi kpi-btn usage-${a.level}" id="kpiAi" title="تفاصيل استهلاك خادم التحليل">
        <b>${aiDoc === undefined ? '…' : ar(Math.round(a.pct * 100)) + '٪'}</b><span>خادم التجويد هذا الشهر (${nAnalyses(a.n)}، ويتبقى مجاناً نحو ${ar(a.remainingN)})</span>
        <span class="meter"><i style="width:${Math.min(100, Math.max(1, a.pct * 100))}%"></i></span></button>`; })() : ''}`;
    const kb = $('#kpiDb', app);
    const toSettings = () => { tab = 'settings'; pref.set('tTab', tab); $$('[data-tab]', app).forEach((x) => x.classList.toggle('on', x.dataset.tab === 'settings')); drawBody(); };
    if (kb) kb.onclick = toSettings;
    const ka = $('#kpiAi', app);
    if (ka) ka.onclick = () => { toSettings(); $('#aiUse', app)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    loadAiDoc();
    const u = dbUsage(D.subs, D.students);
    const warnBox = $('#dbWarn', app);
    if (warnBox) warnBox.innerHTML = u.level === 'ok' ? '' : `<div class="db-warn ${u.level}" role="alert">
      <b>${u.level === 'bad' ? 'تنبيه: مساحة قاعدة البيانات شبه ممتلئة' : 'تنبيه: اقتربت مساحة قاعدة البيانات من الامتلاء'} (${ar(Math.round(u.pct * 100))}٪ من ١ GB المجانية).</b>
      التسجيلات الصوتية تشغل ${fmtBytes(u.audio)}. احذف التسجيلات القديمة من «الإعدادات ← مساحة قاعدة البيانات»، وتبقى الدرجات والتقييمات كما هي.</div>`;
    if (warnBox && aiEnabled() && aiDoc !== undefined) {
      const a = aiUsage(aiDoc, D.subs);
      if (a.level !== 'ok') warnBox.insertAdjacentHTML('beforeend', `<div class="db-warn ${a.level}" role="alert">
        <b>${a.pct >= 1 ? 'تنبيه: انتهت الحصة المجانية لخادم التجويد هذا الشهر' : a.level === 'bad' ? 'تنبيه: الحصة المجانية لخادم التجويد شبه منتهية' : 'تنبيه: استُهلك معظم الحصة المجانية لخادم التجويد'} (${ar(Math.round(a.pct * 100))}٪).</b>
        ${a.pct >= 1 ? `كل تحليل إضافي يكلف نحو ${fmtUsd(a.perCost)}، والتكلفة هذا الشهر حتى الآن ${fmtUsd(a.cost)}.` : `يتبقى مجاناً نحو ${nAnalyses(a.remainingN)} حتى بداية الشهر القادم.`} لإيقاف التحليل مؤقتاً اجعل «الحد الأقصى للنسخ» صفراً في Cloud Run.</div>`);
    }
  }
  function drawBody() {
    drawHead();
    const body = $('#tBody', app); if (!body) return;
    ({ subs: drawSubs, tasks: drawTasks, people: drawPeople, ann: drawAnn, errors: drawErrors, honor: drawHonorT, fb: drawFb, reports: drawReports, settings: drawSettings })[tab](body);
  }

  /* --- مصحف الطالب (للمعلم) --- */
  async function openStudentMushaf(st) {
    if (!st) return;
    openModal('<div class="loading">جارٍ تحميل خريطة الحفظ…</div>');
    let p = null;
    try { p = await store.getProgress(st.id); } catch (e) { console.warn(e); }
    if (!p?.seeded) p = { ...mapFromSubs(D.subs.filter((x) => x.pn === st.id && x.percent != null)), ...(p || {}) };
    let f = 'all';
    const show = () => {
      $('#modalBody').innerHTML = `<div class="stack"><h2>📖 مصحف ${esc(st.name)}</h2><span class="small muted">${esc(className(st.classId))}</span><div id="mfHost"></div></div>`;
      renderMushaf($('#mfHost'), p, { who: 'teacher', filter: f, onFilter: (x) => { f = x; show(); }, onOpen: (s) => {
        $('#modalBody').innerHTML = `<div class="stack">${surahDetailHtml(p, s)}<div class="row"><button class="btn" type="button" id="mfBack">→ رجوع للخريطة</button></div></div>`;
        $('#mfBack').onclick = show;
      } });
    };
    show();
  }

  /* --- رأيك يهمنا --- */
  let FB = null;
  const fbF = { kind: 'all', status: 'all', cls: 'all' };
  async function loadFb() {
    try { FB = (await store.listAllFeedback()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch (e) { FB = FB || []; console.warn(e); }
    paintFbTab();
    if (tab === 'fb') drawBody();
  }
  function paintFbTab() {
    const el = $('#fbTabN', app); if (!el) return;
    const n = (FB || []).filter((x) => !x.seen).length;
    el.textContent = n ? (n > 9 ? '+٩' : ar(n)) : '';
  }
  function drawFb(body) {
    if (!FB) { body.innerHTML = '<div class="loading">جارٍ تحميل الملاحظات…</div>'; return; }
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    const L = FB.filter((x) => (fbF.kind === 'all' || x.kind === fbF.kind) && (fbF.cls === 'all' || x.classId === fbF.cls)
      && (fbF.status === 'all' || (fbF.status === 'new' && !x.seen) || (fbF.status === 'open' && !x.reply) || (fbF.status === 'done' && x.reply)));
    const count = (k) => FB.filter((x) => x.kind === k).length;
    body.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div><h2 style="margin:0">💬 رأيك يهمنا</h2><p class="small muted" style="margin:4px 0 0">ملاحظات الطلاب عن الموقع. يصلك تنبيه عند كل ملاحظة جديدة، ويصل ردّك إلى الطالب كتنبيه.</p></div><button class="btn sm" type="button" id="fbRe">⟳ تحديث</button></div>
      <div class="fb-stats">${Object.entries(FB_KINDS).map(([k, [i, l]]) => `<button type="button" class="kpi kpi-btn${fbF.kind === k ? ' on' : ''}" data-fk="${k}"><b>${i} ${ar(count(k))}</b><span>${l}</span></button>`).join('')}</div>
      <div class="row" style="margin:12px 0">
        <select id="fbK" style="flex:1 1 130px">${opt('all', 'كل الأنواع', fbF.kind)}${Object.entries(FB_KINDS).map(([k, [i, l]]) => opt(k, `${i} ${l}`, fbF.kind)).join('')}</select>
        <select id="fbS" style="flex:1 1 130px">${opt('all', 'كل الحالات', fbF.status)}${opt('new', 'جديدة', fbF.status)}${opt('open', 'بلا رد', fbF.status)}${opt('done', 'تم الرد', fbF.status)}</select>
        <select id="fbC" style="flex:1 1 130px">${opt('all', 'كل الصفوف', fbF.cls)}${D.classes.map((c) => opt(c.id, c.name, fbF.cls)).join('')}</select>
      </div>
      ${L.length ? `<ul class="fb-list">${L.map((x) => `<li class="fb-item${x.seen ? '' : ' new'}" data-fb="${esc(x.pn)}|${esc(x.id)}">
        <div class="row" style="justify-content:space-between;gap:8px">
          <div class="row" style="gap:8px">${fbKindChip(x.kind)}<b>${esc(x.name || 'طالب')}</b><span class="small muted">${esc(x.className || '')}</span>${x.seen ? '' : '<span class="pill">جديدة</span>'}</div>
          <small class="muted" title="${esc(fmtDate(x.createdAt))}">${esc(timeAgo(x.createdAt))}</small></div>
        <p class="fb-text">${esc(x.text)}</p>
        ${x.reply ? `<div class="fb-reply"><b>ردّك</b> <small class="muted">${esc(timeAgo(x.repliedAt))}${x.replySeen ? ' · قرأه الطالب ✓' : ''}</small><p>${esc(x.reply)}</p></div>` : ''}
        <form class="fb-rf" hidden><textarea rows="3" maxlength="1000" required placeholder="اكتب ردّك على ${esc(x.name || 'الطالب')}…">${esc(x.reply || '')}</textarea><div class="row"><button class="btn primary sm" type="submit">إرسال الرد</button><button class="btn sm" type="button" data-cancel>إلغاء</button></div></form>
        <div class="row fb-acts"><button class="btn sm" type="button" data-reply>${x.reply ? '✎ تعديل الرد' : '↩ ردّ'}</button><button class="btn sm danger" type="button" data-del>حذف</button></div>
      </li>`).join('')}</ul>` : `<div class="empty">${FB.length ? 'لا توجد ملاحظات بهذه الاختيارات.' : 'لم تصل ملاحظات بعد. يجد الطلاب زر «رأيك يهمنا» أسفل صفحتهم.'}</div>`}`;
    $('#fbRe', body).onclick = () => { FB = null; drawFb(body); loadFb(); };
    $$('[data-fk]', body).forEach((b) => (b.onclick = () => { fbF.kind = fbF.kind === b.dataset.fk ? 'all' : b.dataset.fk; drawFb(body); }));
    $('#fbK', body).onchange = (e) => { fbF.kind = e.target.value; drawFb(body); };
    $('#fbS', body).onchange = (e) => { fbF.status = e.target.value; drawFb(body); };
    $('#fbC', body).onchange = (e) => { fbF.cls = e.target.value; drawFb(body); };
    $$('[data-fb]', body).forEach((li) => {
      const [pn, id] = li.dataset.fb.split('|');
      const x = FB.find((f) => f.id === id && f.pn === pn);
      const form = $('.fb-rf', li);
      $('[data-reply]', li).onclick = () => { form.hidden = false; $('.fb-acts', li).hidden = true; $('textarea', form).focus(); };
      $('[data-cancel]', li).onclick = () => { form.hidden = true; $('.fb-acts', li).hidden = false; };
      $('[data-del]', li).onclick = async () => {
        if (!(await confirmBox(`حذف ملاحظة ${x.name || 'الطالب'}؟`))) return;
        try { await store.deleteFeedback(pn, id); FB = FB.filter((f) => f !== x); paintFbTab(); drawFb(body); toast('حُذفت الملاحظة.'); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const reply = $('textarea', form).value.trim(); if (!reply) return;
        const btn = e.submitter; btn.disabled = true;
        try {
          const patch = { reply, repliedAt: new Date().toISOString(), replySeen: false, seen: true };
          await store.updateFeedback(pn, id, patch); Object.assign(x, patch);
          const nid = await store.addStudentNotif(pn, { type: 'fbReply', fid: id, title: '💬 ردّ معلمك على ملاحظتك', body: reply.length > 120 ? reply.slice(0, 120) + '…' : reply, link: `./#/student/fb/${id}`, tag: 'fb-' + id });
          let msg = `أُرسل ردّك إلى ${x.name || 'الطالب'}.`;
          try { const p = await sendPush(nid, pn); if (p?.sent) msg += ' ووصل الإشعار إلى جواله.'; else if (p?.deferred) msg += ' ويصل إشعار جواله الساعة ٦ صباحاً.'; } catch (err) { console.warn(err); }
          toast(msg); drawFb(body);
        } catch (err) { toast('تعذر إرسال الرد: ' + (err.code || err.message)); btn.disabled = false; }
      };
    });
    // ما عُرض من الملاحظات الجديدة يُعلَّم مقروءاً (ويبقى مميزاً في هذا العرض)
    const unseen = L.filter((x) => !x.seen);
    if (unseen.length) setTimeout(() => { unseen.forEach((x) => { x.seen = true; store.updateFeedback(x.pn, x.id, { seen: true }).catch(() => {}); }); paintFbTab(); }, 1200);
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
      const all = new Set(D.subs.map(subKey));
      [...selSubs].forEach((k) => { if (!all.has(k)) selSubs.delete(k); });
      $('#subList', body).innerHTML = (selSubs.size ? `<div class="bulk"><b>المحدد: ${ar(selSubs.size)}</b><button class="btn sm danger" type="button" id="bsDel">حذف المحدد</button><button class="btn sm" type="button" id="bsClr">إلغاء التحديد</button></div>` : '')
        + (L.length ? `<div class="table-wrap"><table><thead><tr><th class="sel"><input type="checkbox" id="bsAll" aria-label="تحديد كل التسليمات الظاهرة"></th><th>الطالب</th><th>الصف</th><th>الواجب / المقطع</th><th>التاريخ</th><th>الدقة الآلية</th><th>المدة</th><th>تقييمك</th></tr></thead><tbody>
        ${L.map((x) => `<tr class="click ${selSubs.has(subKey(x)) ? 'picked' : ''}" data-id="${esc(x.id)}" data-pn="${esc(x.pn)}"><td class="sel"><input type="checkbox" data-sk="${esc(subKey(x))}" ${selSubs.has(subKey(x)) ? 'checked' : ''} aria-label="تحديد"></td><td><b>${esc(x.studentName)}</b>${x.retakeId ? ' <span class="pill gold-pill">إعادة</span>' : ''}${x.retakeRequested && !D.subs.some((y) => y.retakeId === x.retakeRequested.id) ? ' <span class="pill mute">طُلبت إعادته</span>' : ''}<div class="small muted num">${esc(x.pn)}</div></td><td>${esc(x.className || className(x.classId))}</td>
        <td>${esc(x.taskTitle || 'تدريب')}<div class="small muted">${esc(rangeLabel(x.surah, x.from, x.to))}</div></td><td class="num">${fmtDate(x.createdAt)}</td>
        <td>${x.percent == null ? '<span class="pill mute">يدوي</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td><td class="num">${fmtTime(x.duration || 0)}</td>
        <td>${x.teacher ? `<span class="pill ok">${ar(x.teacher.total)}/١٠</span>` : '<span class="pill warn">بانتظارك</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لا توجد تسليمات مطابقة.</div>');
      $$('tr[data-id]', body).forEach((r) => (r.onclick = (e) => { if (e.target.closest('.sel')) return; openSubmission(D.subs.find((x) => x.id === r.dataset.id && x.pn === r.dataset.pn)); }));
      $$('[data-sk]', body).forEach((c) => (c.onchange = () => { c.checked ? selSubs.add(c.dataset.sk) : selSubs.delete(c.dataset.sk); paint(); }));
      const allBox = $('#bsAll', body);
      if (allBox) {
        headBox(allBox, L.map(subKey), selSubs);
        allBox.onchange = () => { L.forEach((x) => (allBox.checked ? selSubs.add(subKey(x)) : selSubs.delete(subKey(x)))); paint(); };
      }
      const clr = $('#bsClr', body);
      if (clr) clr.onclick = () => { selSubs.clear(); paint(); };
      const del = $('#bsDel', body);
      if (del) del.onclick = async () => {
        const items = D.subs.filter((x) => selSubs.has(subKey(x)));
        if (!(await confirmBox(`حذف ${items.length === 1 ? 'تسليم واحد' : `${ar(items.length)} من التسليمات`} مع تسجيلاتها الصوتية؟ لا يمكن التراجع.`))) return;
        const { ok, fail } = await runBulk('حذف التسليمات', items, (x) => store.deleteSubmission(x.pn, x.id));
        const done = new Set(items.map(subKey));
        D.subs = D.subs.filter((x) => !done.has(subKey(x)));
        if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
        selSubs.clear();
        toast(fail ? `حُذف ${ar(ok)}، وتعذر حذف ${ar(fail)}.` : `حُذف ${ar(ok)} من التسليمات.`);
        drawBody();
      };
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
    let marks = (x.tj || []).map((m) => (m.n ? { ...m } : makeMark(errCat, m.i, m.r)));
    let manual = !!x.teacher && x.teacher.total !== gradeFrom(deduction(marks, errCat).total);
    let aiRes = x.ai || null;
    const weak = weakRules(model, mine, 3);
    openModal(`
      <div class="stack">
        <div><h2>${esc(x.studentName)} <span class="muted small num">${esc(x.pn)}</span></h2>
        <p class="muted" style="margin:4px 0 0">${esc(x.taskTitle || 'تدريب')} · ${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)} · ${x.mode === 'hifz' ? 'غيباً' : 'نظراً'}</p></div>
        ${(() => { const prev = x.retakeOf && D.subs.find((y) => y.id === x.retakeOf && y.pn === x.pn); return x.retakeId ? `<div class="retake-info">🔁 هذا التسليم <b>إعادة</b> طلبتها${prev ? ` لتسليم ${fmtDate(prev.createdAt)}${prev.teacher ? ` (درجته ${fmtQ(prev.teacher.total)} من ١٠)` : ''} <button class="btn sm" type="button" id="sbPrev">افتح التسليم السابق للمقارنة</button>` : '.'}</div>` : ''; })()}
        ${x.retakeRequested ? `<div class="retake-info">🔁 طلبت من الطالب إعادة ${esc(rangeLabel(x.retakeRequested.surah, x.retakeRequested.from, x.retakeRequested.to))} بتاريخ ${fmtDate(x.retakeRequested.at)}.</div>` : ''}
        <div class="row">${x.percent != null ? `<span class="pill ${pctClass(x.percent)}">الدقة الآلية ${ar(x.percent)}٪</span><span class="pill mute">صحيحة ${ar(x.counts?.correct || 0)} · خطأ ${ar(x.counts?.wrong || 0)} · محذوفة ${ar(x.counts?.missing || 0)}</span>` : '<span class="pill mute">بدون تصحيح آلي</span>'}<span class="pill mute">المدة ${fmtTime(x.duration || 0)}</span></div>
        <div id="sbAudio">${x.hasAudio ? '<button class="btn" id="sbLoad" type="button">تشغيل تسجيل الطالب</button>' : '<span class="muted small">لا يوجد تسجيل صوتي.</span>'}</div>
        ${risky.length ? `<div class="learn-note">استمع أولاً إلى المواضع المسطّرة: هي الأرجح أن يخطئ فيها هذا الطالب${weak.length ? `، فقد أخطأ سابقاً في ${weak.map((w) => `«${esc(ruleName(w.r))}»`).join(' و')}` : ''}.</div>` : ''}
        <div id="sbMap">${wordMapHtml({ ...x, tj: marks }, { colored: true, risky: riskSet })}</div>
        <div class="tj-menu small" id="sbMenu"><b>لتحديد خطأ:</b> اضغط على الكلمة في المصحف أعلاه، ثم اختر الخطأ (لفظي أو تجويد)، فيُخصم من الدرجة حسب «الأخطاء ودرجاتها».</div>
        <div id="sbAuto"></div>
        <div id="sbMarks"></div>
        <div id="sbAi"></div>
        ${x.transcript ? `<details><summary class="small">النص الذي التقطه التعرف على الكلام</summary><p class="small muted">${esc(x.transcript)}</p></details>` : ''}
        <form id="sbForm" class="card stack" style="gap:12px">
          <h3>درجة المقطع</h3>
          <div id="gDed"></div>
          <div class="grade-box">
            <input type="number" id="gTotal" min="0" max="10" step="0.25" value="${t.total ?? 10}" aria-label="الدرجة من ١٠"><b>/ ١٠</b>
            <span class="small muted" id="gHint"></span>
          </div>
          <div class="small muted">توقّع النظام من تقييماتك السابقة: <b>${ar(suggested)}</b>${model.n ? ` (تعلّم من ${ar(model.n)} تقييماً)` : ' (تقدير أولي)'}</div>
          <label class="row small" style="gap:6px"><input type="checkbox" id="gTjDone" ${x.tjDone !== false ? 'checked' : ''}> استمعت وحددت أخطاء التجويد في هذا المقطع (إن لم تحدد شيئاً فهذا يعني أن التجويد سليم)</label>
          <label class="field">ملاحظات للطالب<textarea id="gN" placeholder="مثال: انتبه للإخفاء في «من قبل»، وأطل المد المتصل.">${esc(t.notes || '')}</textarea></label>
          <label class="row small notify-opt" style="gap:8px"><input type="checkbox" id="gNotify" checked> <span>أشعر الطالب بدرجته <span class="muted">${x.teacher ? '(يُرسل فقط إن تغيّرت الدرجة)' : '(في الجرس داخل الموقع، وعلى جواله إن فعّلها)'}</span></span></label>
          <div class="row"><button class="btn primary" type="submit">حفظ التقييم</button><button class="btn gold" type="button" id="sbRetake">🔁 اطلب إعادة</button><button class="btn danger" type="button" id="sbDel">حذف التسليم</button></div>
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
      const toggleMark = (i, r) => { if (marks.some((k) => k.i === i && k.r === r)) marks = marks.filter((k) => !(k.i === i && k.r === r)); else marks.push(makeMark(errCat, i, r)); };
      const autoErr = [...(x.statuses || '')].map((c, i) => (c === 'w' ? { i, r: 'v_wrong' } : c === 'm' ? { i, r: 'v_missing' } : null)).filter(Boolean);
      const paintMarks = () => {
        $('#sbMap', m).innerHTML = wordMapHtml({ ...x, tj: marks }, { colored: true, risky: riskSet, ai: aiRes ? new Set(aiRes.errors.map((e) => e.i)) : null });
        const ded = deduction(marks, errCat);
        // أخطاء التصحيح الآلي: تُقترح ويؤكدها المعلم
        const pend = autoErr.filter((a) => !marks.some((k) => k.i === a.i && (k.r === 'v_wrong' || k.r === 'v_missing')));
        $('#sbAuto', m).innerHTML = autoErr.length ? `<div class="card stack auto-errs" style="gap:8px"><div class="row" style="justify-content:space-between"><h3>أخطاء لفظية اكتشفها التصحيح الآلي (${ar(autoErr.length)})</h3>${pend.length ? `<button class="btn sm" type="button" id="auAll">أكّد الكل (${ar(pend.length)})</button>` : ''}</div>
          <p class="small muted" style="margin:0">التعرف الآلي قد يخطئ؛ أكّد ما سمعته خطأً فعلاً، فيُخصم حسب القائمة.</p>
          <div class="row" style="gap:6px">${autoErr.map((a, k) => { const on = marks.some((q) => q.i === a.i && q.r === a.r); return `<button type="button" class="chip ${on ? 'on' : ''}" data-au="${k}"><span class="qw">${esc(words[a.i]?.text || '')}</span> ${a.r === 'v_missing' ? 'محذوفة' : 'خاطئة'}${on ? ' ✓' : ''}</button>`; }).join('')}</div></div>` : '';
        $$('[data-au]', m).forEach((b) => (b.onclick = () => { const a = autoErr[+b.dataset.au]; toggleMark(a.i, a.r); paintMarks(); }));
        const au = $('#auAll', m); if (au) au.onclick = () => { pend.forEach((a) => toggleMark(a.i, a.r)); paintMarks(); };
        // ملخص الأخطاء والخصم
        $('#sbMarks', m).innerHTML = marks.length ? `<div class="card stack ded-box" style="gap:8px"><h3>الأخطاء المحددة (${ar(marks.length)})</h3>
          ${Object.entries(CATS).map(([c, label]) => { const gs = ded.groups.filter((g) => g.c === c); return gs.length ? `<div><b class="small">${label} · ${negQ(ded[c])}</b><ul class="ded-list">${gs.map((g) => `<li><span>${esc(g.name)}${g.count > 1 ? ` ×${ar(g.count)}` : ''}</span><span class="small muted">${marks.filter((k) => k.r === g.key).map((k) => `<button type="button" class="word-x" data-rm="${k.i}|${esc(k.r)}" title="إزالة">${esc(words[k.i]?.text || '')} ✕</button>`).join(' ')}</span><b class="num">${negQ(g.sum)}${g.max && g.count * g.d > g.max ? ' <span class="small muted">(الحد)</span>' : ''}</b></li>`).join('')}</ul></div>` : ''; }).join('')}
          </div>` : '';
        $$('[data-rm]', m).forEach((b) => (b.onclick = () => { const [i, r] = b.dataset.rm.split('|'); marks = marks.filter((k) => !(k.i === +i && k.r === r)); paintMarks(); }));
        const g = gradeFrom(ded.total);
        $('#gDed', m).innerHTML = `<div class="ded-sum"><span>١٠</span><span>− ${fmtQ(ded.total)} خصم${ded.total ? ` <small>(لفظي ${fmtQ(ded.verbal)} · تجويد ${fmtQ(ded.tajweed)})</small>` : ''}</span><b>= ${fmtQ(g)}</b></div>`;
        const inp = $('#gTotal', m);
        if (!manual) inp.value = g;
        $('#gHint', m).innerHTML = manual && +inp.value !== g ? `عدّلتها يدوياً · حسب الأخطاء: <b>${fmtQ(g)}</b> <button type="button" class="btn sm" id="gUse">استخدمها</button>` : 'تتحدّث تلقائياً مع كل خطأ، ويمكنك تعديلها';
        const use = $('#gUse', m); if (use) use.onclick = () => { manual = false; paintMarks(); };
        paintAi();
      };
      $('#gTotal', m).addEventListener('input', () => { manual = true; const h = $('#gHint', m); if (h) h.textContent = 'عدّلتها يدوياً'; });
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
          toggleMark(e.i, e.r);
          paintMarks();
        }));
        const all = $('#aiAll', box);
        if (all) all.onclick = () => { pending.forEach((e) => marks.push(makeMark(errCat, e.i, e.r))); paintMarks(); };
      }
      paintMarks();
      $('#sbMap', m).addEventListener('click', (e) => {
        const w = e.target.closest('.w'); if (!w) return;
        const i = +w.dataset.i;
        const drawMenu = () => {
          const on = new Set(marks.filter((k) => k.i === i).map((k) => k.r));
          const live = errCat.items.filter((x) => !x.off);
          const wordTj = [...new Set([...segRules[i], ...(aiRes ? aiRes.errors.filter((e) => e.i === i).map((e) => e.r) : [])])].filter((r) => findErr(errCat, r)?.cat === 'tajweed' && !findErr(errCat, r)?.off);
          const chip = (e) => `<button type="button" class="chip ${on.has(e.key) ? 'on' : ''}" data-r="${esc(e.key)}">${esc(e.name)} <small>${negQ(e.d)}</small></button>`;
          const otherTj = live.filter((e) => e.cat === 'tajweed' && !wordTj.includes(e.key));
          $('#sbMenu', m).innerHTML = `<div class="row" style="gap:8px"><span class="qw" style="font-family:var(--f-quran);font-size:22px">${esc(words[i].text)}</span><span class="muted">آية ${ar(words[i].ayah)}: ما الخطأ؟</span></div>
            <div class="menu-sec"><b class="small">${CATS.verbal}</b><div class="row" style="gap:6px">${live.filter((e) => e.cat === 'verbal').map(chip).join('')}</div></div>
            <div class="menu-sec"><b class="small">${CATS.tajweed}${wordTj.length ? ' (في هذه الكلمة)' : ''}</b><div class="row" style="gap:6px">${wordTj.map((r) => chip(findErr(errCat, r))).join('') || '<span class="small muted">لا أحكام ظاهرة في الكلمة.</span>'}</div>
              ${otherTj.length ? `<details ${otherTj.some((e) => on.has(e.key)) ? 'open' : ''}><summary class="small">أحكام أخرى</summary><div class="row" style="gap:6px;margin-top:6px">${otherTj.map(chip).join('')}</div></details>` : ''}</div>
            <details class="menu-sec" id="mnNew"><summary class="small">➕ خطأ غير موجود في القائمة</summary>
              <div class="row" style="align-items:flex-end;margin-top:6px">
                <label class="field" style="flex:2 1 160px">اسم الخطأ<input type="text" id="mnName" maxlength="40" placeholder="مثال: الوقف في غير موضعه"></label>
                <label class="field" style="flex:1 1 120px">النوع<select id="mnCat"><option value="verbal">لفظي</option><option value="tajweed">تجويد</option></select></label>
                <label class="field" style="flex:1 1 90px">الخصم<input type="number" id="mnD" min="0" max="10" step="0.25" value="0.5"></label>
                <button class="btn sm primary" type="button" id="mnAdd">أضف وحدّده</button>
              </div><span class="small muted">يُضاف إلى «الأخطاء ودرجاتها» لتستعمله في كل التقييمات.</span></details>`;
          $$('[data-r]', $('#sbMenu', m)).forEach((b) => (b.onclick = () => { toggleMark(i, b.dataset.r); drawMenu(); paintMarks(); }));
          $('#mnAdd', m).onclick = () => {
            const name = $('#mnName', m).value.trim();
            if (!name) return toast('اكتب اسم الخطأ.');
            const d = Math.max(0, Math.min(10, parseFloat($('#mnD', m).value) || 0));
            const key = 'c_' + Date.now().toString(36);
            errCat.items.push({ key, name, d, max: null, cat: $('#mnCat', m).value, builtin: false });
            saveErrCat();
            toggleMark(i, key); drawMenu(); paintMarks();
          };
        };
        drawMenu();
      });
      $('#sbForm', m).onsubmit = async (e) => {
        e.preventDefault();
        const v = parseFloat($('#gTotal', m).value);
        if (isNaN(v)) return toast('اكتب الدرجة من ١٠.');
        const teacher = { total: Math.max(0, Math.min(10, Math.round(v * 4) / 4)), notes: $('#gN', m).value.trim(), suggested, deduction: deduction(marks, errCat).total, at: new Date().toISOString() };
        const patch = { teacher, tj: marks, tjDone: $('#gTjDone', m).checked, ...(aiRes ? { ai: aiRes } : {}) };
        const prevTotal = x.teacher ? x.teacher.total : null;
        const wantNotify = $('#gNotify', m).checked && prevTotal !== teacher.total;
        try {
          await store.updateSubmission(x.pn, x.id, patch);
          if (wantNotify) notifyGrade(x, teacher, prevTotal).then((r) => r && setTimeout(() => toast(r), 1200)).catch((err) => { console.warn(err); setTimeout(() => toast('تعذر إرسال تنبيه الدرجة: ' + (err.code || err.message)), 1200); });
          Object.assign(x, patch);
          closeModal();
          if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
          const all = D.subs.map((y) => (y.id === x.id && y.pn === x.pn ? { ...y, ...patch } : y));
          store.setModel(pack(train(all))).catch((err) => console.warn('model save', err));
          toast(`حُفظت الدرجة${marks.length ? ` و${ar(marks.length)} من الأخطاء` : ''}، وتعلّم منها النظام.`);
          drawBody();
        } catch (err) { toast('تعذر الحفظ: ' + err.message); }
      };
      const pv = $('#sbPrev', m);
      if (pv) pv.onclick = () => openSubmission(D.subs.find((y) => y.id === x.retakeOf && y.pn === x.pn));
      $('#sbRetake', m).onclick = () => openRetakeForm(x, $('#gN', m).value.trim());
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
  /* --- الأخطاء ودرجاتها --- */
  function drawErrors(body) {
    const row = (e) => `<tr class="${e.off ? 'off' : ''}"><td><input type="text" data-ek="${esc(e.key)}" data-f="name" value="${esc(e.name)}" maxlength="40" aria-label="اسم الخطأ"></td>
      <td><input type="number" data-ek="${esc(e.key)}" data-f="d" value="${e.d}" min="0" max="10" step="0.25" aria-label="الخصم لكل مرة"></td>
      <td><input type="number" data-ek="${esc(e.key)}" data-f="max" value="${e.max ?? ''}" min="0" max="10" step="0.25" placeholder="بلا حد" aria-label="الحد الأقصى"></td>
      <td>${e.builtin ? `<label class="small" style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-ek="${esc(e.key)}" data-f="on" ${e.off ? '' : 'checked'}> مفعّل</label>` : `<button class="btn sm danger" type="button" data-edel="${esc(e.key)}">حذف</button>`}</td></tr>`;
    body.innerHTML = `<div class="stack">
      <div class="card stack" style="gap:10px"><h3>⚖️ الأخطاء ودرجاتها</h3>
        <p class="small" style="margin:0">الدرجة = ١٠ − مجموع الخصم. يُخصم الخطأ في كل مرة يتكرر، ولا يتجاوز مجموع النوع الواحد حدّه الأقصى في المقطع. يمكنك تعديل الدرجة يدوياً عند التقييم. تعديل هذه القائمة لا يغيّر الدرجات المحفوظة سابقاً.</p>
        <form class="row" id="erAdd" style="align-items:flex-end">
          <label class="field" style="flex:2 1 180px">خطأ جديد<input type="text" id="erName" maxlength="40" required placeholder="مثال: الوقف في غير موضعه"></label>
          <label class="field" style="flex:1 1 120px">النوع<select id="erCat"><option value="verbal">لفظي</option><option value="tajweed">تجويد</option></select></label>
          <label class="field" style="flex:1 1 90px">الخصم<input type="number" id="erD" min="0" max="10" step="0.25" value="0.5"></label>
          <label class="field" style="flex:1 1 90px">الحد الأقصى<input type="number" id="erMax" min="0" max="10" step="0.25" placeholder="بلا حد"></label>
          <button class="btn primary" type="submit">إضافة</button>
        </form>
      </div>
      ${Object.entries(CATS).map(([c, label]) => `<div class="card stack" style="gap:8px"><h3>${c === 'verbal' ? '🗣️' : '🎼'} ${label} (${ar(errCat.items.filter((e) => e.cat === c).length)})</h3>
        <div class="table-wrap"><table class="err-table"><thead><tr><th>الخطأ</th><th>الخصم لكل مرة</th><th>الحد الأقصى في المقطع</th><th></th></tr></thead>
        <tbody>${errCat.items.filter((e) => e.cat === c).map(row).join('')}</tbody></table></div></div>`).join('')}
      <div class="row"><button class="btn ghost" type="button" id="erReset">استعادة القائمة الافتراضية</button></div>
    </div>`;
    $$('[data-ek]', body).forEach((inp) => (inp.onchange = () => {
      const e = findErr(errCat, inp.dataset.ek); if (!e) return;
      const f = inp.dataset.f;
      if (f === 'name') { const v = inp.value.trim(); if (!v) { inp.value = e.name; return; } e.name = v; }
      else if (f === 'd') e.d = Math.max(0, Math.min(10, parseFloat(inp.value) || 0));
      else if (f === 'max') e.max = inp.value === '' ? null : Math.max(0, Math.min(10, parseFloat(inp.value) || 0));
      else if (f === 'on') { e.off = !inp.checked; inp.closest('tr').classList.toggle('off', e.off); }
      saveErrCat();
    }));
    $$('[data-edel]', body).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('حذف هذا الخطأ من القائمة؟ تبقى الدرجات المحفوظة كما هي.'))) return;
      errCat.items = errCat.items.filter((e) => e.key !== b.dataset.edel); saveErrCat(); drawErrors(body);
    }));
    $('#erAdd', body).onsubmit = (ev) => {
      ev.preventDefault();
      const mx = $('#erMax', body).value;
      errCat.items.push({ key: 'c_' + Date.now().toString(36), name: $('#erName', body).value.trim(), d: Math.max(0, Math.min(10, parseFloat($('#erD', body).value) || 0)), max: mx === '' ? null : Math.max(0, parseFloat(mx) || 0), cat: $('#erCat', body).value, builtin: false });
      saveErrCat(); drawErrors(body);
    };
    $('#erReset', body).onclick = async () => {
      if (!(await confirmBox('استعادة القائمة الافتراضية؟ تُحذف الأخطاء التي أضفتها وتعود الخصومات إلى قيمها الأولى.', 'استعادة'))) return;
      errCat = defaultCatalog(); saveErrCat(); drawErrors(body);
    };
  }

  /* --- الإعلانات والتذكير --- */
  let notifySettings = { eveTime: '19:00' };
  store.getNotifySettings().then((v) => { notifySettings = { ...notifySettings, ...v }; }).catch(() => {});
  function remindTimeLabel() { const [h, m] = (notifySettings.eveTime || '19:00').split(':').map(Number); return ar(`${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`) + (h >= 12 ? ' مساءً' : ' صباحاً'); }
  const annTargetLabel = (t) => !t || t.type === 'all' ? 'كل الصفوف' : t.type === 'classes' ? (t.classIds || []).map(className).join('، ') : `${D.students.find((x) => x.id === t.studentId)?.name || 'طالب'} (${className(D.students.find((x) => x.id === t.studentId)?.classId)})`;
  const annRecipients = (t) => !t || t.type === 'all' ? D.students : t.type === 'classes' ? D.students.filter((x) => (t.classIds || []).includes(x.classId)) : D.students.filter((x) => x.id === t.studentId);
  const whenText = (iso) => { try { return ar(new Date(iso).toLocaleString('ar', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })); } catch { return iso; } };
  async function drawAnn(body) {
    const first = D.classes[0]?.id || '';
    const today = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const d0 = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <form class="card stack" id="anForm" style="gap:12px">
        <h3>📢 إعلان جديد</h3>
        <label class="field">العنوان (اختياري)<input type="text" id="anTitle" maxlength="80" placeholder="مثال: تنبيه مهم"></label>
        <label class="field">نص الإعلان<textarea id="anBody" maxlength="500" required placeholder="مثال: لا تسميع غداً بسبب الاختبارات، ونكمل يوم الأحد بإذن الله."></textarea></label>
        <div class="ann-pic" id="anPic">
          <label class="btn" id="anPickL"><input type="file" id="anFile" accept="image/*" hidden> 📷 إرفاق صورة (اختياري)</label>
          <div class="ann-pic-prev" id="anPrev" hidden><img alt="معاينة الصورة"><div class="small"><b id="anPicInfo"></b><br><span class="muted">تُحذف تلقائياً بعد ${ar(IMG_DAYS)} يوماً.</span></div><button class="btn sm danger" type="button" id="anPicX">إزالة</button></div>
          <div class="small muted" id="anPicQuota"></div>
        </div>
        <fieldset class="seg-field"><legend>لمن؟</legend>
          <label><input type="radio" name="anT" value="all" checked> كل الصفوف</label>
          <label><input type="radio" name="anT" value="classes"> صفوف محددة</label>
          <label><input type="radio" name="anT" value="student"> طالب بعينه</label>
        </fieldset>
        <div id="anCls" class="chk-grid" hidden>${D.classes.map((c) => `<label><input type="checkbox" value="${esc(c.id)}"> ${esc(c.name)}</label>`).join('')}</div>
        <div id="anStu" class="row" hidden>
          <label class="field" style="flex:1 1 160px">الصف<select id="anStuC">${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:2 1 200px">الطالب<select id="anStuS"></select></label>
        </div>
        <fieldset class="seg-field"><legend>متى يُرسل؟</legend>
          <label><input type="radio" name="anW" value="now" checked> الآن</label>
          <label><input type="radio" name="anW" value="later"> في موعد محدد</label>
        </fieldset>
        <div id="anLater" class="row" hidden>
          <label class="field" style="flex:1 1 150px">اليوم<input type="date" id="anDate" value="${d0}" min="${d0}"></label>
          <label class="field" style="flex:1 1 120px">الساعة<input type="time" id="anTime" value="07:00"></label>
        </div>
        <p class="small muted" style="margin:0">يظهر الإعلان للطلاب شريطاً أعلى صفحتهم وفي الجرس، ويصل إشعاراً إلى جوالات من فعّلها. الإعلان المجدول يُرسل خلال ١٠ دقائق من موعده.</p>
        <button class="btn primary" type="submit">أرسل الإعلان</button>
      </form>
      <div class="stack">
        <div class="card stack" style="gap:10px"><h3>⏰ تذكير الواجبات</h3>
          <p class="small" style="margin:0">في كل واجب له موعد، يمكنك تفعيل تذكير مساء اليوم السابق للموعد (من نموذج الواجب). اختر هنا ساعة التذكير:</p>
          <div class="row"><input type="time" id="evT" value="${esc(notifySettings.eveTime || '19:00')}" style="max-width:150px"><button class="btn" type="button" id="evSave">حفظ</button></div>
          <h3 style="margin-top:6px">🔥 حافظ على سلسلتك</h3>
          <p class="small" style="margin:0">يصل لمن سمّع أو تدرّب يومين متتاليين فأكثر ولم ينشط اليوم بعد: «لديك ٥ أيام متتالية، لا تقطعها!»</p>
          <div class="row"><select id="stkT" style="max-width:220px">${[['off', 'متوقف'], ['10:00', '١٠:٠٠ صباحاً'], ['12:00', '١٢:٠٠ ظهراً'], ['14:00', '٢:٠٠ عصراً'], ['16:00', '٤:٠٠ عصراً'], ['18:00', '٦:٠٠ مساءً'], ['20:00', '٨:٠٠ مساءً'], ['21:00', '٩:٠٠ مساءً']].map(([v, l]) => `<option value="${v}" ${(notifySettings.streakTime || '12:00') === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn" type="button" id="stkSave">حفظ</button></div>
          <h3 style="margin-top:6px">🏆 لوحة الشرف</h3>
          <p class="small" style="margin:0">مرة يومياً يُبشَّر من دخل الخمسة الأوائل في صفه أو على المرحلة، أو صعد إلى المركز الأول، أو تقدّم صفه في التحدي (إشعار واحد في اليوم على الأكثر).</p>
          <div class="row"><select id="bdT" style="max-width:220px">${[['off', 'متوقف'], ['18:00', '٦:٠٠ مساءً'], ['19:30', '٧:٣٠ مساءً'], ['20:30', '٨:٣٠ مساءً'], ['21:30', '٩:٣٠ مساءً']].map(([v, l]) => `<option value="${v}" ${(notifySettings.boardTime || '20:30') === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn" type="button" id="bdSave">حفظ</button></div>
          <div class="small muted" id="cronStat"></div>
        </div>
        <div class="stack" id="anList"><div class="loading">جارٍ تحميل الإعلانات…</div></div>
      </div>
    </div>`;
    const fillStu = () => { const c = $('#anStuC', body).value; $('#anStuS', body).innerHTML = D.students.filter((x) => x.classId === c).sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''); };
    if (first) { $('#anStuC', body).value = first; fillStu(); }
    $('#anStuC', body).onchange = fillStu;
    // الصورة المرفقة: تُصغَّر فوراً وتُعرض معاينتها
    let pic = null;
    const todayKey = new Date().toDateString();
    const imgsToday = (L) => L.filter((a) => a.hasImage && new Date(a.createdAt).toDateString() === todayKey).length;
    const paintQuota = (L) => { const q = $('#anPicQuota', body); if (!q) return; const n = imgsToday(L); q.textContent = `صور اليوم: ${ar(n)} من ${ar(IMG_DAILY_LIMIT)}`; const full = n >= IMG_DAILY_LIMIT; $('#anFile', body).disabled = full; $('#anPickL', body).classList.toggle('disabled', full); if (full) q.textContent += ' · وصلت إلى الحد اليومي، ويمكنك إرسال إعلانات نصية.'; };
    $('#anFile', body).onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const info = $('#anPicInfo', body); $('#anPrev', body).hidden = false; info.textContent = 'جارٍ تجهيز الصورة…';
      try {
        const c = await compressImage(f);
        pic = c;
        const img = $('#anPrev img', body); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(c.blob);
        info.textContent = `${fmtKB(c.blob.size)} · ${ar(c.w)}×${ar(c.h)}${f.size > c.blob.size * 1.5 ? ` (كانت ${fmtKB(f.size)})` : ''}`;
        $('#anPickL', body).hidden = true;
      } catch (x) { pic = null; $('#anPrev', body).hidden = true; toast(x.message); }
    };
    $('#anPicX', body).onclick = () => { pic = null; $('#anPrev', body).hidden = true; $('#anPickL', body).hidden = false; };
    $$('[name=anT]', body).forEach((r) => (r.onchange = () => { const v = $('[name=anT]:checked', body).value; $('#anCls', body).hidden = v !== 'classes'; $('#anStu', body).hidden = v !== 'student'; }));
    $$('[name=anW]', body).forEach((r) => (r.onchange = () => { $('#anLater', body).hidden = $('[name=anW]:checked', body).value !== 'later'; }));
    $('#evSave', body).onclick = async () => {
      const v = $('#evT', body).value || '19:00';
      try { await store.setNotifySettings({ eveTime: v }); notifySettings.eveTime = v; toast(`سيصل تذكير الواجبات الساعة ${remindTimeLabel()} من اليوم السابق للموعد.`); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
    };
    $('#bdSave', body).onclick = async () => {
      const v = $('#bdT', body).value;
      try { await store.setNotifySettings({ boardTime: v }); notifySettings.boardTime = v; toast(v === 'off' ? 'أُوقفت إشعارات لوحة الشرف.' : `تُفحص لوحة الشرف يومياً الساعة ${$('#bdT', body).selectedOptions[0].textContent}.`); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
    };
    $('#stkSave', body).onclick = async () => {
      const v = $('#stkT', body).value;
      try { await store.setNotifySettings({ streakTime: v }); notifySettings.streakTime = v; toast(v === 'off' ? 'أُوقف تذكير السلسلة.' : `سيصل تذكير السلسلة يومياً الساعة ${$('#stkT', body).selectedOptions[0].textContent}.`); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
    };
    $('#anForm', body).onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      const tt = $('[name=anT]:checked', body).value;
      const target = tt === 'classes' ? { type: 'classes', classIds: $$('#anCls input:checked', body).map((x) => x.value) } : tt === 'student' ? { type: 'student', studentId: $('#anStuS', body).value } : { type: 'all' };
      if (tt === 'classes' && !target.classIds.length) return toast('اختر صفاً واحداً على الأقل.');
      if (tt === 'student' && !target.studentId) return toast('اختر الطالب.');
      const later = $('[name=anW]:checked', body).value === 'later';
      let sendAt = null;
      if (later) {
        const when = new Date(`${$('#anDate', body).value}T${$('#anTime', body).value || '07:00'}`);
        if (isNaN(when) || when < Date.now()) return toast('اختر موعداً في المستقبل.');
        sendAt = when.toISOString();
      }
      btn.disabled = true;
      try {
        if (pic && imgsToday(await store.listAnnouncements()) >= IMG_DAILY_LIMIT) { btn.disabled = false; return toast(`وصلت إلى حد ${ar(IMG_DAILY_LIMIT)} صور اليوم. أزل الصورة أو أرسلها غداً.`); }
        const fields = { title: $('#anTitle', body).value.trim(), body: $('#anBody', body).value.trim(), target, status: later ? 'scheduled' : 'pending', sendAt, recipients: annRecipients(target).length };
        // الحالة «مسودة» حتى تُرفع الصورة، فلا يُنشر إعلان مجدول قبل اكتمال صورته
        const id = await store.saveAnnouncement(pic ? { ...fields, status: 'draft', hasImage: true, imageBytes: Math.ceil(pic.blob.size * 4 / 3) } : fields);
        if (pic) {
          try {
            const exp = new Date(Math.max(Date.now(), sendAt ? new Date(sendAt).getTime() : 0) + IMG_DAYS * 864e5).toISOString();
            await store.saveAnnImage(id, { b64: await blobToB64(pic.blob), type: 'image/jpeg', w: pic.w, h: pic.h, bytes: pic.blob.size, exp });
          } catch (x) { await store.deleteAnnouncement({ id }).catch(() => {}); throw x; }
          await store.saveAnnouncement({ id, status: fields.status });
        }
        if (later) toast(`جُدول الإعلان ليُرسل ${whenText(sendAt)}.`);
        else { const r = await sendAnnouncement(id); toast(`أُرسل الإعلان${r && r.sent ? `، ووصل إشعار إلى ${ar(r.sent)} ${r.sent === 1 ? 'جهاز' : r.sent <= 10 ? 'أجهزة' : 'جهازاً'}` : ''}${deferNote(r)}.`); }
        drawAnn(body);
      } catch (x) { toast('تعذر الإرسال: ' + (x.code || x.message)); btn.disabled = false; }
    };
    // حالة المؤقت (Cloud Scheduler): آخر مرة استيقظ فيها
    if (store.mode === 'cloud') store.getCronStatus().then((c) => {
      const el = $('#cronStat', body); if (!el) return;
      const age = c?.lastRun ? (Date.now() - new Date(c.lastRun)) / 60000 : null;
      el.innerHTML = age == null ? '<span class="pill warn">المؤقت غير مفعّل</span> لن تُرسل الإعلانات المجدولة ولا التذكيرات حتى يُضبط المؤقت في Google Cloud Scheduler.'
        : age < 25 ? `<span class="pill ok">المؤقت يعمل</span> آخر فحص ${esc(timeAgo(c.lastRun))}.` : `<span class="pill bad">المؤقت متوقف</span> آخر فحص ${esc(timeAgo(c.lastRun))}. تحقق من Cloud Scheduler.`;
    }).catch(() => {});
    // القائمة
    let L = [];
    try { L = await store.listAnnouncements(); } catch (e) { $('#anList', body).innerHTML = `<div class="empty">تعذر التحميل: ${esc(e.code || e.message)}</div>`; return; }
    if (store.mode === 'local') { // لا مؤقت في الوضع المحلي: ننشر المستحق عند فتح الصفحة
      for (const a of L.filter((x) => x.status === 'scheduled' && x.sendAt <= new Date().toISOString())) await store.publishAnnouncementLocal(a.id);
      L = await store.listAnnouncements();
    }
    L.sort((a, b) => (b.sentAt || b.sendAt || b.createdAt || '').localeCompare(a.sentAt || a.sendAt || a.createdAt || ''));
    const host = $('#anList', body); if (!host) return;
    host.innerHTML = L.length ? L.slice(0, 30).map((a) => `<div class="card ann-item" data-an="${esc(a.id)}">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div><b>${esc(a.title || 'إعلان من معلمك')}</b><div class="small muted">إلى: ${esc(annTargetLabel(a.target))}</div></div>
        ${a.status === 'scheduled' ? `<span class="pill warn">مجدول · ${esc(whenText(a.sendAt))}</span>` : a.status === 'sent' ? `<span class="pill ok">أُرسل ${esc(timeAgo(a.sentAt) === 'الآن' ? 'للتو' : timeAgo(a.sentAt))}</span>` : '<span class="pill mute">لم يُرسل</span>'}</div>
      <p style="margin:6px 0;white-space:pre-wrap">${esc(a.body)}</p>
      ${a.hasImage ? `<button class="ann-thumb" type="button" data-anpic="${esc(a.id)}" aria-label="عرض صورة الإعلان"><span>📷 عرض الصورة</span><small class="muted">${esc(fmtKB(a.imageBytes || 0))}</small></button>` : ''}
      <div class="row" style="justify-content:space-between">
        <span class="small" data-reads="${esc(a.id)}">${a.status === 'sent' ? 'جارٍ عدّ القراءات…' : ''}</span>
        <span class="row" style="gap:4px">${a.status === 'scheduled' || a.status === 'pending' ? `<button class="btn sm" type="button" data-now="${esc(a.id)}">أرسل الآن</button>` : `<button class="btn sm" type="button" data-unread="${esc(a.id)}">من لم يقرأ؟</button>`}<button class="btn sm danger" type="button" data-andel="${esc(a.id)}">${a.status === 'scheduled' ? 'إلغاء' : 'حذف'}</button></span>
      </div></div>`).join('') : '<div class="empty">لم ترسل أي إعلان بعد.</div>';
    paintQuota(L);
    $$('[data-anpic]', host).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { const blob = await annImage(b.dataset.anpic, (id) => store.getAnnImage(id)); if (blob) openLightbox(blob); else toast(`حُذفت الصورة (مضى عليها ${ar(IMG_DAYS)} يوماً).`); }
      catch (e) { toast('تعذر تحميل الصورة: ' + (e.code || e.message)); }
      b.disabled = false;
    }));
    const reads = {};
    L.filter((a) => a.status === 'sent').slice(0, 30).forEach(async (a) => {
      try {
        const r = new Set(await store.listAnnReads(a.id));
        const rec = annRecipients(a.target);
        reads[a.id] = { read: rec.filter((x) => r.has(x.id)), unread: rec.filter((x) => !r.has(x.id)) };
        const el = $(`[data-reads="${a.id}"]`, host);
        if (el) el.innerHTML = `<b>قرأه ${ar(reads[a.id].read.length)} من ${ar(rec.length)}</b>`;
      } catch { const el = $(`[data-reads="${a.id}"]`, host); if (el) el.textContent = ''; }
    });
    $$('[data-now]', host).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { await store.saveAnnouncement({ id: b.dataset.now, status: 'pending' }); const r = await sendAnnouncement(b.dataset.now); toast(`أُرسل الإعلان${r && r.sent ? `، ووصل إلى ${ar(r.sent)} جهازاً` : ''}.`); drawAnn(body); }
      catch (e) { toast('تعذر الإرسال: ' + e.message); b.disabled = false; }
    }));
    $$('[data-andel]', host).forEach((b) => (b.onclick = async () => {
      const a = L.find((x) => x.id === b.dataset.andel);
      if (!(await confirmBox(a.status === 'scheduled' ? 'إلغاء هذا الإعلان المجدول؟' : 'حذف هذا الإعلان؟ يختفي من صفحات الطلاب (الإشعار الذي وصل الجوال لا يُسحب).', a.status === 'scheduled' ? 'إلغاء الإعلان' : 'حذف'))) return;
      await store.deleteAnnouncement(a); toast('حُذف الإعلان.'); drawAnn(body);
    }));
    $$('[data-unread]', host).forEach((b) => (b.onclick = () => {
      const a = L.find((x) => x.id === b.dataset.unread), r = reads[a.id];
      if (!r) return toast('انتظر حتى يكتمل العدّ.');
      openModal(`<div class="stack"><h2>من لم يقرأ الإعلان؟</h2><p class="muted" style="margin:0">قرأه ${ar(r.read.length)} من ${ar(r.read.length + r.unread.length)}.</p>
        ${r.unread.length ? `<ul class="name-list">${r.unread.map((x) => `<li>${esc(x.name)} <span class="muted small">${esc(className(x.classId))}</span></li>`).join('')}</ul>
        <button class="btn primary" type="button" id="anResend">🔔 أعد إرسال الإشعار لهؤلاء (${ar(r.unread.length)})</button>` : '<div class="pill ok">قرأه الجميع. بارك الله فيهم.</div>'}</div>`, (m) => {
        const rs = $('#anResend', m);
        if (rs) rs.onclick = async () => {
          rs.disabled = true;
          try { const x = await sendAnnouncement(a.id, r.unread.map((u) => u.id)); closeModal(); toast(x ? (x.sent ? `أُعيد الإشعار إلى ${ar(x.sent)} جهازاً.` : 'لم يفعّل هؤلاء الطلاب إشعارات الجوال، والإعلان ظاهر لهم في الموقع.') : 'الإشعارات على الجوال غير مفعّلة في الوضع المحلي.'); }
          catch (e) { toast('تعذر الإرسال: ' + e.message); rs.disabled = false; }
        };
      });
    }));
  }

  let editTask = null; // الواجب الجاري تعديله
  const dueText = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/\d/g, (x) => ar(x)); } catch { return d; } };
  const taskNotifBody = (t) => `${rangeLabel(t.surah, t.from, t.to)} · ${t.mode === 'hifz' ? 'تسميع غيباً' : 'تلاوة نظراً'} · ${t.due ? 'التسليم ' + dueText(t.due) : 'بلا موعد محدد'}`;
  /** طلب إعادة تسميع لتسليم: المقطع كله أو آيات منه، مع ملاحظة وموعد اختياري */
  function openRetakeForm(x, notes0 = '') {
    const n = ayahCount(x.surah);
    const opt = (sel) => Array.from({ length: x.to - x.from + 1 }, (_, k) => x.from + k).map((a) => `<option value="${a}" ${a === sel ? 'selected' : ''}>${ar(a)}</option>`).join('');
    openModal(`<form id="rtF" class="stack" style="gap:12px">
      <h2>🔁 طلب إعادة تسميع</h2>
      <p class="muted" style="margin:0">${esc(x.studentName)} · ${esc(x.taskTitle || 'تسميع')} · سورة ${esc(surahName(x.surah))}</p>
      <div class="row">
        <label class="field" style="flex:1 1 120px">من الآية<select id="rtF1">${opt(x.from)}</select></label>
        <label class="field" style="flex:1 1 120px">إلى الآية<select id="rtT1">${opt(x.to)}</select></label>
        <label class="field" style="flex:1 1 160px">أعده قبل (اختياري)<input type="date" id="rtDue"></label>
      </div>
      <p class="small muted" style="margin:0">اترك الآيات كما هي لإعادة المقطع كله، أو ضيّقها إلى المواضع التي أخطأ فيها.</p>
      <label class="field">ملاحظة للطالب<textarea id="rtN" placeholder="مثال: أعد الآيات ٥–٨ وانتبه للإخفاء.">${esc(notes0)}</textarea></label>
      <label class="row small notify-opt" style="gap:8px"><input type="checkbox" id="rtNotify" checked> <span>أشعر الطالب بالطلب</span></label>
      <div class="row"><button class="btn primary" type="submit">أرسل الطلب</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      const F = $('#rtF1', m), T = $('#rtT1', m);
      F.onchange = () => { if (+T.value < +F.value) T.value = F.value; };
      T.onchange = () => { if (+T.value < +F.value) F.value = T.value; };
      $('#rtF', m).onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.submitter; btn.disabled = true;
        const r = { subId: x.id, taskId: x.taskId || null, taskTitle: x.taskTitle || rangeLabel(x.surah, x.from, x.to), surah: x.surah, from: +F.value, to: +T.value, mode: x.mode || 'recite', notes: $('#rtN', m).value.trim(), due: $('#rtDue', m).value || '' };
        try {
          const id = await store.addRetake(x.pn, r);
          const req = { id, surah: r.surah, from: r.from, to: r.to, at: new Date().toISOString() };
          await store.updateSubmission(x.pn, x.id, { retakeRequested: req });
          x.retakeRequested = req;
          closeModal();
          let msg = `أُرسل طلب الإعادة إلى ${x.studentName}.`;
          if ($('#rtNotify', m)?.checked !== false) {
            const nid = await store.addStudentNotif(x.pn, {
              type: 'retake', retakeId: id, title: '🔁 طلب إعادة تسميع',
              body: `معلمك يطلب إعادة «${r.taskTitle}»: ${rangeLabel(r.surah, r.from, r.to)}${r.due ? ` قبل ${dueText(r.due)}` : ''}.${r.notes ? ' ومعه ملاحظة لك.' : ''}`,
              link: `./#/student/retake/${id}`, tag: 'retake-' + id,
            });
            try { const p = await sendPush(nid, x.pn); if (p && p.sent) msg += ' ووصل الإشعار إلى جواله.'; else if (p && p.deferred) msg += ' ويصل إشعار جواله الساعة ٦ صباحاً (أوقات الهدوء).'; } catch (err) { console.warn(err); }
          }
          toast(msg);
          if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
          drawBody();
        } catch (err) { toast('تعذر إرسال الطلب: ' + (err.code || err.message)); btn.disabled = false; }
      };
    });
  }
  /** إشعار الطالب بدرجته (خاص به وحده) */
  async function notifyGrade(x, teacher, prevTotal) {
    const g = teacher.total, title = x.taskTitle || rangeLabel(x.surah, x.from, x.to);
    const n = {
      type: 'grade', score: g, subId: x.id,
      title: prevTotal != null ? 'عدّل معلمك درجتك' : g >= 8 ? '🎉 وصل تقييم معلمك' : 'وصل تقييم معلمك',
      body: `${prevTotal != null ? 'صارت درجتك' : 'درجتك'} ${fmt10(g)} من ١٠ في «${title}». ${gradeCheer(g)}${teacher.notes ? ' ومعلمك كتب لك ملاحظة.' : ''}`,
      link: `./#/student/grade/${x.id}`, tag: 'grade-' + x.id,
    };
    const id = await store.addStudentNotif(x.pn, n);
    try {
      const r = await sendPush(id, x.pn);
      if (!r) return '';
      const who = x.studentName || 'الطالب';
      return r.sent ? `وصل إشعار الدرجة إلى جوال ${who}.` : r.deferred ? `ظهرت الدرجة لـ${who} في الموقع، ويصل إشعار جواله الساعة ٦ صباحاً (أوقات الهدوء).` : r.already ? '' : `ظهرت الدرجة لـ${who} في الموقع. لم يصل إشعار للجوال لأنه لم يفعّل الإشعارات على جهازه بعد.`;
    } catch (e) { return `تعذر إرسال إشعار الجوال (${e.message})، لكن التنبيه ظاهر للطالب في الموقع.`; }
  }
  /** يحفظ التنبيه (للجرس) ثم يطلب إرساله إلى الجوالات */
  async function notifyTask(t, kind, changes = '') {
    const n = kind === 'new'
      ? { type: 'task', title: `واجب جديد: ${t.title}`, body: taskNotifBody(t) }
      : { type: 'task-edit', title: `تعديل على واجب: ${t.title}`, body: `${changes} · ${taskNotifBody(t)}` };
    const id = await store.addNotif({ ...n, classId: t.classId, taskId: t.id, link: `./#/student/task/${t.id}`, tag: 'task-' + t.id });
    try {
      const r = await sendPush(id);
      return !r ? '' : r.sent ? `، ووصل إشعار إلى ${r.sent === 1 ? 'جهاز واحد' : r.sent === 2 ? 'جهازين' : `${ar(r.sent)} ${r.sent <= 10 ? 'أجهزة' : 'جهازاً'}`}${deferNote(r)}` : r.deferred ? deferNote(r) : '، ولم يفعّل أحد من طلاب الصف إشعارات الجوال بعد';
    } catch (e) { console.warn(e); return `. تعذر إرسال إشعار الجوال (${e.message})، لكن التنبيه ظاهر في الموقع`; }
  }
  function drawTasks(body) {
    const last = pref.get('lastRange', { surah: 36, from: 1, to: 12 });
    const E = editTask;
    const r0 = E ? { surah: E.surah, from: E.from, to: E.to } : last;
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <form class="card stack${E ? ' editing' : ''}" id="tkForm" style="gap:12px">
        <h3>${E ? 'تعديل الواجب' : 'واجب جديد'}</h3>
        <label class="field">العنوان<input type="text" id="tkTitle" required placeholder="مثال: حفظ أول سورة يس"></label>
        ${rangePicker('tk', r0)}
        <div class="row">
          <label class="field" style="flex:1 1 140px">الصف<select id="tkClass"><option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:1 1 140px">النوع<select id="tkMode"><option value="hifz">تسميع غيباً</option><option value="recite">تلاوة نظراً</option></select></label>
          <label class="field" style="flex:1 1 140px">آخر موعد<input type="date" id="tkDue"></label>
        </div>
        <label class="field">تعليمات للطلاب (اختياري)<input type="text" id="tkNotes" placeholder="مثال: ركّز على أحكام النون الساكنة"></label>
        <div class="remind-opt"><label class="row small" style="gap:8px"><input type="checkbox" id="tkRemind" ${E ? (E.remindEve ? 'checked' : '') : 'checked'}> <span>⏰ ذكّر الطلاب مساء اليوم السابق للموعد <span class="muted">(الساعة ${esc(remindTimeLabel())}، يحتاج موعداً)</span></span></label>
          <select id="tkRemindT" aria-label="لمن التذكير"><option value="pending">لمن لم يسلّم فقط</option><option value="all" ${E?.remindTarget === 'all' ? 'selected' : ''}>لكل طلاب الصف</option></select></div>
        <label class="row small notify-opt" style="gap:8px"><input type="checkbox" id="tkNotify" checked> <span>${E ? 'أشعر الطلاب بالتعديل <span class="muted">(يُرسل فقط إن تغيّر الموعد أو الآيات)</span>' : 'أرسل إشعاراً للطلاب <span class="muted">(في الجرس داخل الموقع، وعلى جوالات من فعّلها)</span>'}</span></label>
        <div class="row"><button class="btn primary" type="submit">${E ? 'حفظ التعديل' : 'إضافة الواجب'}</button>${E ? '<button class="btn" type="button" id="tkCancel">إلغاء التعديل</button>' : ''}</div>
      </form>
      <div class="stack" id="tkList"></div>
    </div>`;
    const readRange = bindRangePicker(body, 'tk', (r) => { if (!$('#tkTitle', body).dataset.touched) $('#tkTitle', body).value = `${surahName(r.surah)} ${ar(r.from)}–${ar(r.to)}`; });
    if (E) {
      $('#tkTitle', body).value = E.title; $('#tkTitle', body).dataset.touched = '1';
      $('#tkClass', body).value = E.classId || 'all'; $('#tkMode', body).value = E.mode || 'hifz';
      $('#tkDue', body).value = E.due || ''; $('#tkNotes', body).value = E.notes || '';
      $('#tkCancel', body).onclick = () => { editTask = null; drawTasks(body); };
    } else $('#tkTitle', body).value = `${surahName(last.surah)} ${ar(last.from)}–${ar(last.to)}`;
    $('#tkTitle', body).oninput = (e) => (e.target.dataset.touched = '1');
    $('#tkForm', body).onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true;
      const r = readRange();
      const t = { title: $('#tkTitle', body).value.trim(), ...r, classId: $('#tkClass', body).value, mode: $('#tkMode', body).value, due: $('#tkDue', body).value || '', notes: $('#tkNotes', body).value.trim() };
      t.remindEve = $('#tkRemind', body).checked && !!t.due;
      t.remindTarget = $('#tkRemindT', body).value;
      const wantNotify = $('#tkNotify', body).checked;
      try {
        if (E) {
          const changes = [];
          if (t.surah !== E.surah || t.from !== E.from || t.to !== E.to) changes.push('تغيّرت الآيات');
          if ((t.due || '') !== (E.due || '')) changes.push(t.due ? 'تغيّر موعد التسليم' : 'أُلغي موعد التسليم');
          await store.saveTask({ id: E.id, ...t });
          editTask = null;
          const extra = wantNotify && changes.length ? await notifyTask({ id: E.id, ...t }, 'edit', changes.join(' و')) : '';
          toast(`حُفظ التعديل${wantNotify && changes.length ? ' وأُرسل التنبيه' + extra : wantNotify ? '. لم يتغير الموعد أو الآيات، فلم يُرسل تنبيه' : ''}.`);
        } else {
          const id = await store.saveTask(t);
          const extra = wantNotify ? await notifyTask({ id, ...t }, 'new') : '';
          toast(`أُضيف الواجب${wantNotify ? ' ووصل تنبيه لطلاب الصف' + extra : ' دون إشعار'}.`);
        }
      } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); btn.disabled = false; return; }
      await reload();
    };
    const L = [...D.tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('#tkList', body).innerHTML = L.length ? L.map((t) => {
      const target = D.students.filter((st) => t.classId === 'all' || st.classId === t.classId);
      const doneSet = new Set(D.subs.filter((x) => x.taskId === t.id).map((x) => x.pn));
      const done = target.filter((st) => doneSet.has(st.id)).length;
      return `<div class="card task${E && E.id === t.id ? ' editing' : ''}"><div class="t-main"><h3>${esc(t.title)}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
        <div class="small muted">${esc(className(t.classId))} · ${t.mode === 'hifz' ? 'غيباً' : 'نظراً'}${t.due ? ` · حتى ${fmtDate(t.due)}` : ''}</div>
        <div class="progress" style="margin-top:8px;max-width:260px"><i style="width:${target.length ? (done / target.length) * 100 : 0}%"></i></div><div class="small muted">${ar(done)} من ${ar(target.length)} طالباً أرسلوا</div></div>
        <div class="row"><button class="btn sm" type="button" data-edit="${esc(t.id)}">تعديل</button><button class="btn sm danger" type="button" data-del="${esc(t.id)}">حذف</button></div></div>`;
    }).join('') : '<div class="empty">لم تُنشئ أي واجب بعد. أنشئ الأول من النموذج.</div>';
    $$('[data-edit]', body).forEach((b) => (b.onclick = () => { editTask = D.tasks.find((t) => t.id === b.dataset.edit); drawTasks(body); $('#tkForm', body).scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#tkTitle', body).focus({ preventScroll: true }); }));
    $$('[data-del]', body).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('حذف هذا الواجب؟ تبقى تسليمات الطلاب محفوظة.'))) return; if (editTask?.id === b.dataset.del) editTask = null; await store.deleteTask(b.dataset.del); await reload(); }));
  }

  /* --- حسابات الطلاب وبطاقات الدخول --- */
  const hasAcc = (s) => !!(s.email || s.hasAccount);
  const noAccount = () => D.students.filter((s) => !hasAcc(s));
  async function syncDirectory(classIds) {
    try { await store.rebuildDirectory(classIds.filter(Boolean), D.students); }
    catch (e) { console.warn(e); toast('تعذر تحديث قائمة الأسماء في شاشة الدخول: ' + (e.code || e.message)); }
  }
  async function makeAccounts(list) {
    if (!list.length) { toast('كل الطلاب لديهم حسابات.'); drawBody(); return; }
    openModal(`<div class="stack"><h2>إنشاء حسابات الطلاب</h2><div id="mkTxt">جارٍ إنشاء ${ar(list.length)} حساباً…</div><div class="progress"><i id="mkBar"></i></div>
      <p class="small muted" style="margin:0">لا تغلق الصفحة حتى ينتهي.</p></div>`);
    const res = await store.createAccounts(list, (k, n) => {
      const t = $('#mkTxt'), bar = $('#mkBar');
      if (t) t.textContent = `تم ${ar(k)} من ${ar(n)}…`;
      if (bar) bar.style.width = (k / n) * 100 + '%';
    });
    await reload(false);
    await syncDirectory(list.map((s) => s.classId));
    drawBody();
    const ids = res.created.map((c) => c.id);
    openModal(`<div class="stack"><h2>اكتمل إنشاء الحسابات</h2><p style="margin:0">عدد الحسابات الجديدة: <b>${ar(res.created.length)}</b></p>
      ${res.failed.length ? `<div class="notice">لم يُنشأ ${ar(res.failed.length)}: ${esc(res.failed[0].error)}</div>` : ''}
      <p style="margin:0">اطبع بطاقات الدخول ووزعها على الطلاب. كل بطاقة فيها اسم الطالب وكلمة سره ورمز للدخول إلى الموقع.</p>
      <div class="row">${ids.length ? '<button class="btn primary" type="button" id="mkCards">بطاقات هؤلاء الطلاب</button>' : ''}<button class="btn" type="button" data-close>لاحقاً</button></div></div>`, (m) => {
      const b = $('#mkCards', m);
      if (b) b.onclick = () => openCards({ ids });
    });
  }
  async function openCards({ ids = null } = {}) {
    openModal('<div class="loading">جارٍ تجهيز البطاقات…</div>');
    let secrets;
    try { secrets = await store.listCards(); } catch (e) { $('#modalBody').innerHTML = `<div class="notice">تعذر قراءة كلمات السر: ${esc(e.code || e.message)}. تأكد من نشر قواعد الحماية الجديدة.</div>`; return; }
    const clsName = (id) => D.classes.find((c) => c.id === id)?.name || '';
    const siteUrl = location.origin + location.pathname;
    const videoUrl = new URL('promo/', location.origin + location.pathname.replace(/[^/]*$/, '')).href;
    $('#modalBody').innerHTML = `<div class="stack">
      <h2>بطاقات دخول الطلاب</h2>
      <div class="row" style="align-items:flex-end">
        <label class="field" style="flex:1 1 180px">الصف<select id="cdCls">${ids ? '<option value="sel">الطلاب المحددون</option>' : ''}<option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
        <label class="row small" style="gap:6px;flex:1 1 220px"><input type="checkbox" id="cdSkip" checked> استبعاد من غيّروا كلمة السر</label>
      </div>
      <label class="row small" style="gap:6px"><input type="checkbox" id="cdVid" ${pref.get('cardVideo', true) ? 'checked' : ''}> إضافة رمز «فيديو الشرح» بجانب رمز الدخول 🎬</label>
      <label class="field">ملاحظات تظهر في كل بطاقة<textarea id="cdNotes" rows="3">${esc(pref.get('cardNotes', DEFAULT_NOTES))}</textarea></label>
      <div class="small muted">رابط الموقع في رمز QR: <span dir="ltr">${esc(siteUrl)}</span><br>رابط فيديو الشرح: <a href="${esc(videoUrl)}" target="_blank" rel="noopener" dir="ltr">${esc(videoUrl)}</a></div>
      <div id="cdInfo" class="small"></div>
      <div class="row"><button class="btn primary" type="button" id="cdPdf">تنزيل PDF</button><button class="btn" type="button" id="cdPrint">طباعة</button><span id="cdProg" class="small muted"></span></div>
      <div id="cdPrev" class="cards-prev"></div></div>`;
    const m = $('#modalBody');
    const pick = () => {
      const c = $('#cdCls', m).value, skip = $('#cdSkip', m).checked;
      return D.students
        .filter((s) => hasAcc(s) && (c === 'sel' ? ids.includes(s.id) : c === 'all' || s.classId === c))
        .map((s) => ({ name: s.name, className: clsName(s.classId), password: s.pwChanged ? null : secrets[s.id]?.password || null, classId: s.classId }))
        .filter((x) => !(skip && !x.password))
        .sort((a, b) => a.className.localeCompare(b.className, 'ar', { numeric: true }) || a.name.localeCompare(b.name, 'ar'));
    };
    const opts = () => ({ url: siteUrl, videoUrl: $('#cdVid', m).checked ? videoUrl : null, notes: $('#cdNotes', m).value.trim(), title: 'مقرأة الفاتح' });
    let tm;
    const preview = async () => {
      const cards = pick();
      $('#cdInfo', m).textContent = cards.length ? `عدد البطاقات: ${ar(cards.length)} — عدد الصفحات: ${ar(Math.ceil(cards.length / PER_PAGE))}` : 'لا توجد بطاقات بهذه الاختيارات.';
      $('#cdPrev', m).innerHTML = '';
      if (!cards.length) return;
      try {
        const [page] = await renderPages(cards.slice(0, PER_PAGE), opts());
        $('#cdPrev', m).innerHTML = `<img src="${page.toDataURL('image/png')}" alt="معاينة الصفحة الأولى من البطاقات">`;
      } catch (e) { $('#cdPrev', m).innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
    };
    $('#cdCls', m).onchange = preview;
    $('#cdSkip', m).onchange = preview;
    $('#cdVid', m).onchange = (e) => { pref.set('cardVideo', e.target.checked); preview(); };
    $('#cdNotes', m).oninput = () => { pref.set('cardNotes', $('#cdNotes', m).value); clearTimeout(tm); tm = setTimeout(preview, 500); };
    const run = async (kind) => {
      const cards = pick();
      if (!cards.length) return toast('لا توجد بطاقات للطباعة.');
      const prog = $('#cdProg', m);
      prog.textContent = 'جارٍ التجهيز…';
      try {
        const pages = await renderPages(cards, opts());
        if (kind === 'pdf') await downloadPDF(pages, `maqraa-login-cards-${new Date().toISOString().slice(0, 10)}.pdf`, (k, n) => (prog.textContent = `صفحة ${ar(k)} من ${ar(n)}…`));
        else printPages(pages);
        prog.textContent = '';
      } catch (e) { prog.textContent = e.message; }
    };
    $('#cdPdf', m).onclick = () => run('pdf');
    $('#cdPrint', m).onclick = () => run('print');
    preview();
  }

  /* --- الصفوف والطلاب --- */
  function drawPeople(body) {
    const firstCls = D.classes[0]?.id || '';
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="stack">
        <div class="card stack" style="gap:10px"><h3>الصفوف</h3>
          ${D.classes.map((c) => `<div class="row" style="justify-content:space-between"><span>${esc(c.name)} <span class="muted small">(${((n) => (n ? nWord(n, 'طالب واحد', 'طالبان', 'طلاب', 'طالباً') : 'لا طلاب'))(D.students.filter((s) => s.classId === c.id).length)})</span></span><span class="row" style="gap:4px"><button class="btn sm" data-ren="${esc(c.id)}" type="button">تعديل</button><button class="btn sm danger" data-delc="${esc(c.id)}" type="button">حذف</button></span></div>`).join('') || '<span class="muted">لا توجد صفوف.</span>'}
          ${G2.some((g) => !D.classes.find((c) => c.id === g.id)) ? `<button class="btn gold" id="clSeed" type="button">إنشاء صفوف الثاني الإعدادي (١–٥)</button>` : ''}
          <form id="clForm" class="row"><input type="text" id="clName" placeholder="اسم صف جديد" required style="flex:1"><button class="btn primary" type="submit">إضافة</button></form>
        </div>
        <div class="card stack" style="gap:10px"><h3>إضافة طلاب</h3>
          <label class="field">الصف<select id="stClass">${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field">اسم طالب في كل سطر (ويمكن إضافة الرقم الشخصي بعد فاصلة)<textarea id="stBulk" placeholder="عبدالله أحمد&#10;يوسف خالد، 1024"></textarea></label>
          <label class="row small" style="gap:6px"><input type="checkbox" id="stAuto" checked> إنشاء حساب وكلمة سر لكل طالب تلقائياً</label>
          <div class="row"><button class="btn primary" id="stAdd" type="button">إضافة</button><label class="btn">استيراد من Excel أو CSV<input type="file" id="stFile" accept=".xlsx,.xls,.csv" hidden></label></div>
          <p class="small muted" style="margin:0">في ملف Excel: العمود الأول الاسم، والثاني الرقم الشخصي (اختياري)، والثالث اسم الصف كما هو مكتوب هنا (اختياري).</p>
        </div>
      </div>
      <div class="card stack" style="gap:10px">
        <div class="row" style="justify-content:space-between"><h3>الطلاب (${ar(D.students.length)})</h3><input type="search" id="stQ" placeholder="بحث" style="max-width:200px"></div>
        <div class="row" style="gap:8px">
          <button class="btn gold" id="stCards" type="button">بطاقات الدخول (طباعة و PDF)</button>
          ${noAccount().length ? `<button class="btn" id="stMake" type="button">إنشاء حسابات لـ ${ar(noAccount().length)} طالباً بلا حساب</button>` : ''}
        </div>
        <div id="stSelBar"></div>
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
    const normPn = (v) => latinDigits(v).replace(/\s/g, '');
    const addMany = async (arr) => {
      const clean = arr.filter((x) => x.name).map((x) => ({ ...x, id: x.id || 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }));
      if (!clean.length) return toast('لم نجد أسماء صالحة.');
      await store.saveStudents(clean);
      await reload(false);
      const fresh = D.students.filter((s) => clean.some((c) => c.id === s.id));
      if ($('#stAuto', body)?.checked) await makeAccounts(fresh.filter((s) => !hasAcc(s)));
      else { await syncDirectory(clean.map((c) => c.classId)); toast(`أُضيف ${clean.length} طالباً.`); drawBody(); }
    };
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
      const arr = rows.filter((r) => r && r[0] && !/^(الاسم|اسم|name)$/i.test(String(r[0]).trim())).map((r) => {
        const cName = r[2] ? String(r[2]).trim() : '';
        const c = cName && D.classes.find((x) => x.name === cName);
        return { name: String(r[0]).trim(), id: normPn(r[1]), classId: c ? c.id : cid };
      });
      e.target.value = '';
      addMany(arr);
    };
    $('#stCards', body).onclick = () => openCards();
    const mk = $('#stMake', body);
    if (mk) mk.onclick = () => makeAccounts(noAccount());
    const paint = (q = '') => {
      // الترتيب بحسب الصفوف (بترتيب قائمة الصفوف)، ثم بالاسم داخل كل صف
      const clsIdx = new Map(D.classes.map((c, i) => [c.id, i]));
      const ci = (s) => (clsIdx.has(s.classId) ? clsIdx.get(s.classId) : 1e9);
      const L = D.students.filter((s) => !q || s.name.includes(q) || s.id.includes(q)).sort((a, b) => ci(a) - ci(b) || a.name.localeCompare(b.name, 'ar'));
      const groups = [];
      L.forEach((st) => { const g = groups[groups.length - 1]; if (g && g.id === (clsIdx.has(st.classId) ? st.classId : '_')) g.list.push(st); else groups.push({ id: clsIdx.has(st.classId) ? st.classId : '_', list: [st] }); });
      const accPill = (s) => !hasAcc(s) ? '<span class="pill warn">بلا حساب</span>' : s.pwChanged ? '<span class="pill mute">غيّر كلمة سره</span>' : '<span class="pill ok">جاهز</span>';
      const ids = new Set(D.students.map((x) => x.id));
      [...selStu].forEach((k) => { if (!ids.has(k)) selStu.delete(k); });
      $('#stSelBar', body).innerHTML = selStu.size ? `<div class="bulk"><b>المحدد: ${ar(selStu.size)}</b>
        <button class="btn sm danger" type="button" id="bsSDel">حذف المحدد</button>
        <span class="row" style="gap:4px;flex-wrap:nowrap"><select id="bsSCls" aria-label="الصف الجديد">${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" type="button" id="bsSMove">نقل إلى الصف</button></span>
        <button class="btn sm gold" type="button" id="bsSCards">بطاقات المحدد</button>
        <button class="btn sm" type="button" id="bsSClr">إلغاء التحديد</button></div>` : '';
      $('#stList', body).innerHTML = L.length ? `<div class="table-wrap"><table><thead><tr><th class="sel"><input type="checkbox" id="bsSAll" aria-label="تحديد كل الطلاب الظاهرين"></th><th>الاسم</th><th>الصف</th><th>الحساب</th><th>تسميع</th><th></th></tr></thead><tbody>
        ${groups.map((g) => { const open = !!q || openGroups.has(g.id); return `<tr class="grp${open ? ' open' : ''}" data-grp="${esc(g.id)}" tabindex="0" aria-expanded="${open}"><td class="sel"><input type="checkbox" data-sg="${esc(g.id)}" ${g.list.every((x) => selStu.has(x.id)) ? 'checked' : ''} aria-label="تحديد طلاب الصف"></td><td colspan="5"><span class="grp-chev" aria-hidden="true">▾</span> <b>${esc(g.id === '_' ? 'بلا صف' : className(g.id))}</b> <span class="muted small">· ${nWord(g.list.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالباً')}${!open && g.list.some((x) => selStu.has(x.id)) ? ` · المحدد ${ar(g.list.filter((x) => selStu.has(x.id)).length)}` : ''}</span><span class="small muted grp-hint">${open ? 'اضغط للإخفاء' : 'اضغط لعرض الطلاب'}</span></td></tr>
        ${!open ? '' : g.list.map((s) => `<tr class="${selStu.has(s.id) ? 'picked' : ''}"><td class="sel"><input type="checkbox" data-ss="${esc(s.id)}" ${selStu.has(s.id) ? 'checked' : ''} aria-label="تحديد"></td><td>${esc(s.name)}${s.streak && s.streak.days >= 2 && s.streak.on >= addDays(riyadhDay(), -1) ? ` <span class="streak-pill" title="أيام متتالية من التسميع والتدريب">🔥 ${ar(s.streak.days)}</span>` : ''}${/^st/.test(s.id) ? '' : `<div class="small muted num">${esc(s.id)}</div>`}</td><td><select data-mv="${esc(s.id)}">${D.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === s.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td>
        <td>${accPill(s)}</td><td class="num">${ar(D.subs.filter((x) => x.pn === s.id).length)}</td>
        <td><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-mfs="${esc(s.id)}" type="button" title="خريطة الحفظ">📖 مصحفه</button><button class="btn sm" data-rpw="${esc(s.id)}" type="button">${hasAcc(s) ? 'كلمة سر جديدة' : 'إنشاء حساب'}</button><button class="btn sm danger" data-dels="${esc(s.id)}" type="button">حذف</button></span></td></tr>`).join('')}`; }).join('')}</tbody></table></div>` : '<div class="empty">لا يوجد طلاب. أضفهم من النموذج.</div>';
      $$('[data-ss]', body).forEach((c) => (c.onchange = () => { c.checked ? selStu.add(c.dataset.ss) : selStu.delete(c.dataset.ss); paint(q); }));
      $$('[data-mfs]', body).forEach((b) => (b.onclick = () => openStudentMushaf(D.students.find((x) => x.id === b.dataset.mfs))));
      $$('[data-grp]', body).forEach((r) => {
        const toggle = () => { const id = r.dataset.grp; openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id); pref.set('openGroups', [...openGroups]); paint(q); };
        r.onclick = (e) => { if (e.target.closest('.sel')) return; toggle(); };
        r.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.sel')) { e.preventDefault(); toggle(); } };
      });
      $$('[data-sg]', body).forEach((c) => {
        const g = groups.find((x) => x.id === c.dataset.sg);
        const n = g.list.filter((x) => selStu.has(x.id)).length;
        c.indeterminate = n > 0 && n < g.list.length;
        c.onchange = () => { g.list.forEach((x) => (c.checked ? selStu.add(x.id) : selStu.delete(x.id))); paint(q); };
      });
      const sAll = $('#bsSAll', body);
      if (sAll) {
        headBox(sAll, L.map((x) => x.id), selStu);
        sAll.onchange = () => { L.forEach((x) => (sAll.checked ? selStu.add(x.id) : selStu.delete(x.id))); paint(q); };
      }
      const sClr = $('#bsSClr', body);
      if (sClr) sClr.onclick = () => { selStu.clear(); paint(q); };
      const sCards = $('#bsSCards', body);
      if (sCards) sCards.onclick = () => openCards({ ids: [...selStu] });
      const sMove = $('#bsSMove', body);
      if (sMove) sMove.onclick = async () => {
        const to = $('#bsSCls', body).value;
        const items = D.students.filter((x) => selStu.has(x.id) && x.classId !== to);
        if (!items.length) return toast('الطلاب المحددون في هذا الصف أصلاً.');
        const from = [...new Set(items.map((x) => x.classId))];
        await store.saveStudents(items.map((x) => ({ ...x, classId: to })));
        items.forEach((x) => (x.classId = to));
        await syncDirectory([...from, to]);
        selStu.clear();
        toast(`نُقل ${ar(items.length)} إلى ${className(to)}.`);
        drawBody();
      };
      const sDel = $('#bsSDel', body);
      if (sDel) sDel.onclick = () => {
        const items = D.students.filter((x) => selStu.has(x.id));
        const subsN = D.subs.filter((x) => selStu.has(x.pn)).length;
        openModal(`<div class="stack"><h2>حذف ${items.length === 1 ? 'طالب واحد' : `${ar(items.length)} من الطلاب`}؟</h2>
          <p style="margin:0">لن يستطيعوا الدخول بعد الحذف، وتختفي أسماؤهم من شاشة الدخول. لا يمكن التراجع.</p>
          ${subsN ? `<label class="row" style="gap:6px"><input type="checkbox" id="bdSubs"> حذف تسليماتهم أيضاً (${ar(subsN)})</label><p class="small muted" style="margin:0">إن لم تحددها تبقى تسليماتهم ظاهرة في سجل التسليمات.</p>` : ''}
          <div class="row"><button class="btn primary" id="bdYes" type="button">حذف</button><button class="btn" type="button" data-close>إلغاء</button></div></div>`, (m) => {
          $('#bdYes', m).onclick = async () => {
            const withSubs = !!$('#bdSubs', m)?.checked;
            const classes = [...new Set(items.map((x) => x.classId))];
            const subs = withSubs ? D.subs.filter((x) => selStu.has(x.pn)) : [];
            const r1 = await runBulk('حذف الطلاب', items, (x) => store.deleteStudent(x.id));
            if (subs.length) await runBulk('حذف تسليماتهم', subs, (x) => store.deleteSubmission(x.pn, x.id));
            await reload(false);
            await syncDirectory(classes);
            if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
            else if (subs.length) { const gone = new Set(subs.map(subKey)); D.subs = D.subs.filter((x) => !gone.has(subKey(x))); }
            selStu.clear();
            toast(r1.fail ? `حُذف ${ar(r1.ok)}، وتعذر حذف ${ar(r1.fail)}.` : `حُذف ${ar(r1.ok)} من الطلاب${subs.length ? ' مع تسليماتهم' : ''}.`);
            drawBody();
          };
        });
      };
      $$('[data-mv]', body).forEach((sel) => (sel.onchange = async () => {
        const st = D.students.find((x) => x.id === sel.dataset.mv);
        const old = st.classId;
        await store.saveStudents([{ ...st, classId: sel.value }]);
        st.classId = sel.value;
        await syncDirectory([old, sel.value]);
        toast('نُقل الطالب.');
      }));
      $$('[data-dels]', body).forEach((b) => (b.onclick = async () => {
        const st = D.students.find((x) => x.id === b.dataset.dels);
        if (!(await confirmBox('حذف هذا الطالب؟ تبقى تسليماته في السجل.'))) return;
        await store.deleteStudent(st.id);
        await reload(false);
        await syncDirectory([st.classId]);
        drawBody();
      }));
      $$('[data-rpw]', body).forEach((b) => (b.onclick = async () => {
        const st = D.students.find((x) => x.id === b.dataset.rpw);
        if (hasAcc(st) && !(await confirmBox(`إنشاء كلمة سر جديدة لـ ${st.name}؟ ستتوقف كلمة سره الحالية.`, 'إنشاء كلمة جديدة'))) return;
        b.disabled = true;
        try {
          const pw = await store.resetPassword(st);
          await reload(false);
          await syncDirectory([st.classId]);
          drawBody();
          openModal(`<div class="stack"><h2>كلمة السر الجديدة</h2><p style="margin:0">${esc(st.name)}</p><div class="pw-big">${esc(pw)}</div>
            <div class="row"><button class="btn gold" type="button" id="oneCard">طباعة بطاقته</button><button class="btn" type="button" data-close>تم</button></div></div>`, (m) => {
            $('#oneCard', m).onclick = () => openCards({ ids: [st.id] });
          });
        } catch (e) { toast(e.message); b.disabled = false; }
      }));
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

  /* --- لوحة الشرف: تُحسب هنا وتُنشر للطلاب --- */
  let lastBoardJson = null, boardTimer = null, lastBoard = null;
  function schedulePublish() {
    clearTimeout(boardTimer);
    boardTimer = setTimeout(publishBoard, 2500);
  }
  async function publishBoard() {
    if (!D.students.length) return;
    const { board, ranks } = computeBoard(D.subs, D.students, D.classes);
    lastBoard = board;
    const json = JSON.stringify(board);
    if (json === lastBoardJson) return;
    try {
      await store.setBoard({ ...board, at: new Date().toISOString() });
      await store.saveRanks(ranks, D.students);
      lastBoardJson = json;
    } catch (e) { console.warn('board publish', e); }
  }
  function drawHonorT(body) {
    const { board } = computeBoard(D.subs, D.students, D.classes);
    const months = [...new Set(D.subs.map((x) => (x.createdAt || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    const cur = new Date().toISOString().slice(0, 7);
    body.innerHTML = `<div class="card stack month-card" style="gap:10px;margin-bottom:16px">
        <div class="row" style="justify-content:space-between"><h3>📅 نتائج الشهر والشهادات</h3><span class="small muted" id="mStat"></span></div>
        <p class="small" style="margin:0">في أول كل شهر راجع نتائج الشهر الماضي ثم أعلنها: يصل لكل طالب إشعار بترتيبه، ويحصل الخمسة الأوائل في كل صف وفي المرحلة على شهادة تقدير.</p>
        <div class="row">${months.length ? `<select id="mPick" style="max-width:220px">${months.map((m) => `<option value="${m}">${esc(monthLabel(m))}${m === cur ? ' (الشهر الحالي)' : ''}</option>`).join('')}</select><button class="btn primary" type="button" id="mGo">راجع النتائج</button>` : '<span class="muted small">لا توجد تسليمات بعد.</span>'}</div>
      </div><div id="hbBoard"></div>`;
    mountBoard($('#hbBoard', body), { ...board, at: null }, { classes: D.classes, pickClass: true });
    const pick = $('#mPick', body);
    if (pick) {
      const stat = () => store.getMonthResult(pick.value).then((r) => { const el = $('#mStat', body); if (el) el.innerHTML = r ? `<span class="pill ok">أُعلنت ${esc(fmtDate(r.announcedAt))}</span>` : '<span class="pill warn">لم تُعلن بعد</span>'; }).catch(() => {});
      pick.onchange = stat; stat();
      $('#mGo', body).onclick = () => openMonthReview(pick.value);
    }
    schedulePublish();
  }

  /* --- نتائج الشهر --- */
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return ar(new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('ar', { month: 'long', year: 'numeric' })); };
  const prevYm = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
  async function checkMonthBar() {
    const ym = prevYm();
    const host = $('#monthBar', app); if (!host) return;
    if (!D.subs.some((x) => (x.createdAt || '').slice(0, 7) === ym)) { host.innerHTML = ''; return; }
    let r = null; try { r = await store.getMonthResult(ym); } catch {}
    if (r || pref.get('monthBarOff_' + ym, false)) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="month-bar"><span>📅 <b>نتائج شهر ${esc(monthLabel(ym))} جاهزة.</b> راجعها ثم أعلنها لتصل الإشعارات والشهادات للطلاب.</span>
      <span class="row" style="gap:6px"><button class="btn sm primary" type="button" id="mbGo">راجع وأعلن</button><button class="btn sm ghost" type="button" id="mbNo">لاحقاً</button></span></div>`;
    $('#mbGo', host).onclick = () => openMonthReview(ym);
    $('#mbNo', host).onclick = () => { pref.set('monthBarOff_' + ym, true); host.innerHTML = ''; };
  }
  function certFor(res, st, r) {
    const w = monthTitle(r); if (!w) return null;
    return { ym: res.ym, name: st.name, title: w.title, line: w.line, rank: w.rank, month: monthLabel(res.ym), points: r.points, className: className(st.classId), teacher: s.name || '', date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) };
  }
  async function openMonthReview(ym) {
    const res = computeMonth(D.subs, D.students, D.classes, ym);
    const ungraded = D.subs.filter((x) => (x.createdAt || '').slice(0, 7) === ym && x.taskId && !x.teacher).length;
    let done = null; try { done = await store.getMonthResult(ym); } catch {}
    const isCur = ym === new Date().toISOString().slice(0, 7);
    const winners = D.students.map((st) => certFor(res, st, res.ranks[st.id])).filter(Boolean);
    const row = (x, i) => `<li><span class="mr-n">${ar(i + 1)}</span><span>${esc(x.name)}</span><b class="num">${fmt10(x.points)}</b></li>`;
    openModal(`<div class="stack month-review">
      <h2>📅 نتائج شهر ${esc(monthLabel(ym))}</h2>
      ${isCur ? '<div class="notice">هذا الشهر لم ينتهِ بعد. الأفضل إعلان نتائجه في أول الشهر القادم.</div>' : ''}
      ${ungraded ? `<div class="notice">يوجد ${ar(ungraded)} من تسليمات هذا الشهر لم تقيّمها بعد، فتُحسب بدرجتها الآلية. قيّمها أولاً إن أردت.</div>` : ''}
      ${done ? `<div class="pill ok" style="align-self:flex-start">أُعلنت هذه النتائج ${esc(fmtDate(done.announcedAt))}</div>` : ''}
      <div class="mr-grid">
        <div class="card"><h3>👑 شيخ المرحلة</h3><ol class="mr-list">${res.stage.map(row).join('') || '<li class="muted">لا نقاط</li>'}</ol></div>
        <div class="card"><h3>🏁 تحدي الصفوف</h3><ol class="mr-list">${res.challenge.map((c, i) => `<li><span class="mr-n">${ar(i + 1)}</span><span>${esc(c.name)}</span><b class="num">${fmt10(c.score)}</b></li>`).join('')}</ol></div>
        ${D.classes.filter((c) => (res.byClass[c.id] || []).length).map((c) => `<div class="card"><h3>🏆 قارئ ${esc(c.name)}</h3><ol class="mr-list">${res.byClass[c.id].map(row).join('')}</ol></div>`).join('')}
      </div>
      <p class="small muted" style="margin:0">سيصل لكل طالب إشعار بنتيجته الخاصة (ترتيبه في صفه وعلى المرحلة، ونقاطه، وأطول سلسلة له). الفائزون (${ar(winners.length)}) يحصلون على شهادة تقدير يحمّلونها من حسابهم.</p>
      <div class="row">
        <button class="btn primary" type="button" id="mrGo" ${done ? 'disabled' : ''}>📣 أعلن النتائج وأرسل الإشعارات</button>
        <button class="btn gold" type="button" id="mrCerts" ${winners.length ? '' : 'disabled'}>شهادات الفائزين (PDF)</button>
      </div></div>`, (m) => {
      $('#mrCerts', m).onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'جارٍ التجهيز…';
        try { await downloadCertificatesPDF(winners, `maqraa-certificates-${ym}.pdf`, (i, n) => (b.textContent = `جارٍ التجهيز ${ar(i)} من ${ar(n)}…`)); toast('حُمّلت الشهادات.'); }
        catch (x) { toast('تعذر التجهيز: ' + x.message); }
        b.disabled = false; b.textContent = 'شهادات الفائزين (PDF)';
      };
      $('#mrGo', m).onclick = () => announceMonth(res, ym);
    });
  }
  /** أطول سلسلة للطالب في الشهر */
  async function bestStreak(st, ym) {
    let act = [];
    try { act = await store.listActivity(st.id, ym + '-01'); } catch {}
    const days = new Set([...act.map((a) => a.d), ...D.subs.filter((x) => x.pn === st.id && x.createdAt).map((x) => riyadhDay(new Date(x.createdAt)))].filter((d) => d && d.slice(0, 7) === ym));
    let best = 0;
    days.forEach((d) => { if (!days.has(addDays(d, -1))) { let n = 0, k = d; while (days.has(k)) { n++; k = addDays(k, 1); } best = Math.max(best, n); } });
    return best;
  }
  async function announceMonth(res, ym) {
    if (!(await confirmBox(`إعلان نتائج شهر ${monthLabel(ym)} لكل الطلاب (${ar(D.students.length)})؟ يصل لكل طالب إشعار بنتيجته.`, 'أعلن النتائج'))) return;
    const label = monthLabel(ym), items = [];
    const { ok, fail } = await runBulk('إعلان نتائج الشهر', D.students, async (st) => {
      const r = res.ranks[st.id] || { points: 0 };
      const w = monthTitle(r);
      const streak = await bestStreak(st, ym);
      const cp = res.classPos[st.classId] || null;
      const title = w ? (w.key === 'stage1' ? `👑 مبارك! أنت شيخ المرحلة لشهر ${label}` : w.key === 'cls1' ? `🏆 مبارك! أنت قارئ الصف لشهر ${label}` : `🏅 مبارك! ${w.title} لشهر ${label}`) : `📊 نتائج شهر ${label}`;
      const body = w ? `${w.line} بـ${fmt10(r.points)} نقطة. شهادة التقدير تنتظرك في المقرأة، فبارك الله فيك وزادك.`
        : r.points > 0 ? `ترتيبك ${ar(r.cls)} في صفك بـ${fmt10(r.points)} نقطة. الشهر الجديد فرصة جديدة، وكل واجب ترفع به ترتيبك.`
        : 'لم تُحسب لك نقاط هذا الشهر. ابدأ الشهر الجديد بواجب واحد، وستجد اسمك في لوحة الشرف بإذن الله.';
      const id = 'month-' + ym;
      await store.addStudentNotifId(st.id, id, { type: 'month', ym, label, title, body, link: './#/student/month/' + ym, tag: id, r: { points: r.points, cls: r.cls || null, clsOf: r.clsOf || null, stage: r.stage || null, stageOf: r.stageOf || null }, classPos: cp, streak, win: w, teacher: s.name || '', className: className(st.classId) });
      items.push({ notif: id, student: st.id });
    });
    await store.saveMonthResult(ym, { ym, label, stage: res.stage, byClass: res.byClass, challenge: res.challenge, announcedAt: new Date().toISOString(), teacher: s.name || '', students: ok });
    let pushed = null;
    try { for (let i = 0; i < items.length; i += 200) { const r = await sendPushBatch(items.slice(i, i + 200)); if (r) pushed = { sent: (pushed?.sent || 0) + r.sent, deferred: (pushed?.deferred || 0) + (r.deferred || 0) }; } } catch (e) { console.warn(e); }
    toast(`أُعلنت نتائج ${label} لـ${nWord(ok, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}${pushed && pushed.sent ? `، ووصل إشعار إلى ${ar(pushed.sent)} جهازاً` : ''}${deferNote(pushed)}${fail ? `، وتعذر ${ar(fail)}` : ''}.`);
    checkMonthBar();
    if (tab === 'honor') drawBody();
  }

  /* --- إشعارات جوال المعلم --- */
  const tOwner = { id: 'teacher', info: { role: 'teacher' } };
  function drawTeacherPush(body) {
    const host = $('#tPush', body); if (!host) return;
    const st = pushState('teacher');
    const msg = {
      'off-config': 'الإشعارات على الجوال غير مفعّلة في الموقع بعد.',
      unsupported: '<span class="pill warn">غير مدعوم</span> هذا المتصفح لا يدعم الإشعارات. افتح لوحة المعلم من Chrome على جوالك، أو ثبّت المقرأة على الآيفون.',
      'needs-install': '<span class="pill warn">ثبّت أولاً</span> على الآيفون: ثبّت المقرأة على الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، ثم افتحها من أيقونتها وادخل كمعلم وعُد إلى هنا.',
      denied: '<span class="pill bad">مرفوضة</span> رفض جهازك الإشعارات لهذا الموقع. اسمح بها من إعدادات الجوال أو المتصفح ثم حدّث الصفحة.',
      ready: 'فعّلها على هذا الجهاز ليصلك: ملخّص التسليمات الجديدة كل ساعة، وخبر وصول الإعادات التي طلبتها، وتنبيه عند ٧٠٪ و٩٠٪ من الاستهلاك. لا شيء بين ١٠ مساءً و٦ صباحاً.',
      on: '<span class="pill ok">مفعّلة</span> يصلك على هذا الجهاز ملخّص التسليمات كل ساعة، وخبر الإعادات، وتنبيهات الاستهلاك (لا شيء بين ١٠ مساءً و٦ صباحاً).',
    }[st];
    host.innerHTML = `<h3>🔔 إشعارات جوالك (المعلم)</h3><p class="small" style="margin:0">${msg}</p>
      ${st === 'ready' ? '<button class="btn primary" type="button" id="tpOn" style="align-self:flex-start">فعّل إشعاراتي على هذا الجهاز</button>' : ''}
      ${st === 'on' ? '<div class="row"><button class="btn" type="button" id="tpTest">جرّب إشعاراً</button><button class="btn ghost" type="button" id="tpOff">إيقاف</button></div>' : ''}`;
    const on = $('#tpOn', host);
    if (on) on.onclick = async () => { on.disabled = true; try { await enablePush(tOwner); toast('تم تفعيل إشعاراتك على هذا الجهاز.'); } catch (e) { toast(e.message); } drawTeacherPush(body); };
    const off = $('#tpOff', host);
    if (off) off.onclick = async () => { await disablePush().catch(() => {}); toast('أُوقفت إشعاراتك على هذا الجهاز.'); drawTeacherPush(body); };
    const tst = $('#tpTest', host);
    if (tst) tst.onclick = () => testNotification().catch((e) => toast(e.message));
  }

  /* --- عدّاد خادم التجويد --- */
  function drawAiCard(body) {
    const host = $('#aiUse', body); if (!host) return;
    const a = aiUsage(aiDoc, D.subs);
    const monthName = ar(new Date(a.month + '-15').toLocaleDateString('ar', { month: 'long', year: 'numeric' }));
    const bar = Math.min(100, Math.max(1, a.pct * 100));
    host.innerHTML = `
      <div class="row" style="justify-content:space-between"><h3>استهلاك خادم تحليل التجويد · ${esc(monthName)}</h3>
        <div class="row"><span class="pill ${a.level}">${ar(Math.round(a.pct * 100))}٪ من الحصة المجانية</span><button class="btn sm" type="button" id="aiRef">تحديث</button></div></div>
      <div class="meter big"><i class="usage-${a.level}" style="width:${bar}%"></i><span class="mark m70" title="٧٠٪"></span><span class="mark m90" title="٩٠٪"></span>${a.projectedPct != null && a.projectedPct > a.pct ? `<span class="mark proj" style="inset-inline-start:${Math.min(100, a.projectedPct * 100)}%" title="المتوقع بنهاية الشهر"></span>` : ''}</div>
      <div class="usage-grid">
        <div><span>المستخدم هذا الشهر</span><b>${fmtDur(a.billed)}</b><small>${nAnalyses(a.n)}${a.failed ? `، وفشل ${ar(a.failed)}` : ''}</small></div>
        <div><span>المتبقي مجاناً</span><b>${fmtDur(a.remaining)}</b><small>${a.remainingN ? `يكفي نحو ${nAnalyses(a.remainingN)}` : 'كل تحليل الآن مدفوع'}</small></div>
        <div><span>المقطع الواحد</span><b>≈ ${ar(Math.round(a.per))} ث</b><small>${a.perPct * 100 < 0.01 ? 'أقل من ٠٫٠١٪' : ar((a.perPct * 100).toFixed(2).replace('.', '٫')) + '٪'} من حصة الشهر${a.perAudioMin ? ` · ${ar(Math.round(a.perAudioMin))} ث لكل دقيقة تلاوة` : ''}</small></div>
        <div><span>تكلفة المقطع بعد المجاني</span><b>≈ ${fmtUsd(a.perCost)}</b><small>الدولار يكفي نحو ${nAnalyses(Math.floor(1 / a.perCost))} · هذا الشهر: ${fmtUsd(a.cost)}</small></div>
      </div>
      <div class="small" style="line-height:1.9">
        ${a.projected != null ? `<div>• بهذا المعدل يصل استهلاك الشهر إلى نحو <b>${ar(Math.round(a.projectedPct * 100))}٪</b>${a.projectedCost > 0 ? `، بتكلفة تقديرية ${fmtUsd(a.projectedCost)}` : '، ضمن المجاني'}.</div>` : ''}
        ${!a.est ? `<div>• مرات الإيقاظ (تشغيل بارد): <b>${ar(a.cold)}</b>${a.cold ? `، استغرقت ${fmtDur(a.startup)}. المقطع الأول بعد خمول الخادم أبطأ لهذا السبب.` : '.'}</div>` : ''}
        <div>• الحصة المجانية: <b>${fmtDur(a.free)}</b> شهرياً لنسخة ${ar(a.inst.vcpu)} vCPU و${ar(a.inst.gib)} GiB، وتتجدد أول كل شهر.</div>
      </div>
      <p class="small muted" style="margin:0">${a.est ? '<span class="pill warn">تقدير</span> لم يسجّل الخادم استهلاكه بعد، فالأرقام محسوبة من مدة التحليلات المحفوظة في التسليمات. يبدأ العدّ الدقيق بعد تحديث الخادم. ' : `يسجّل الخادم كل تحليل بنفسه${a.updatedAt ? `، وآخر تسجيل ${fmtDate(a.updatedAt)}` : ''}. `}الأرقام تقريبية؛ المرجع النهائي صفحة الفوترة في Google Cloud وتنبيه الميزانية (٥ $). لا يُحتسب شيء والخادم نائم.</p>`;
    $('#aiRef', host).onclick = () => { aiDoc = undefined; host.querySelector('#aiRef').disabled = true; loadAiDoc(true); };
  }

  /* --- الإعدادات --- */
  function drawSettings(body) {
    const u = dbUsage(D.subs, D.students);
    const graded = D.subs.filter((x) => x.hasAudio && x.teacher);
    body.innerHTML = `<div class="grid2" style="align-items:start">
      <div class="card stack usage-card" style="gap:12px;grid-column:1 / -1">
        <div class="row" style="justify-content:space-between"><h3>مساحة قاعدة البيانات</h3><span class="pill ${u.level}">${ar(Math.round(u.pct * 100))}٪ مستخدمة</span></div>
        <div class="meter big"><i class="usage-${u.level}" style="width:${Math.min(100, Math.max(1, u.pct * 100))}%"></i><span class="mark m70" title="٧٠٪"></span><span class="mark m90" title="٩٠٪"></span></div>
        <div class="usage-grid">
          <div><span>المستخدم</span><b>${fmtBytes(u.total)}</b><small>من ١ GB مجانية</small></div>
          <div><span>التسجيلات الصوتية</span><b>${fmtBytes(u.audio)}</b><small>${ar(u.withAudio)} تسجيلاً</small></div>
          <div><span>الدرجات والبيانات</span><b>${fmtBytes(u.docs)}</b><small>صغيرة جداً</small></div>
          <div><span>آخر ٣٠ يوماً</span><b>${fmtBytes(u.recent)}</b><small>${u.monthsLeft == null ? 'لا نشاط بعد' : u.monthsLeft > 60 ? 'تكفي سنوات بهذا المعدل' : u.monthsLeft <= 0 ? 'تجاوزت الحصة المجانية' : `تكفي نحو ${monthsText(Math.max(1, Math.round(u.monthsLeft)))} بهذا المعدل`}</small></div>
        </div>
        <p class="small muted" style="margin:0">الأرقام تقديرية من حجم التسجيلات. بعد ١ GB تحتسب Google رسوماً شهرية صغيرة لكل GB إضافي، ويصلك تنبيه الميزانية إن تجاوزت دولاراً. التسجيل الذي مدته دقيقة يشغل نحو ٢٠٠ KB.</p>
        <div class="cleanup">
          <h3>تفريغ المساحة</h3>
          <p class="small" style="margin:0">يحذف <b>التسجيلات الصوتية فقط</b>. تبقى التسليمات والدرجات والملاحظات وأخطاء التجويد ولوحة الشرف كما هي، ولكن لن تستطيع الاستماع لتلك التسجيلات بعد حذفها.</p>
          <div class="row" style="align-items:flex-end">
            <label class="field" style="flex:1 1 200px">احذف تسجيلات
              <select id="clWhich"><option value="graded">التسليمات التي قيّمتُها (${ar(graded.length)})</option><option value="30">الأقدم من ٣٠ يوماً</option><option value="60">الأقدم من ٦٠ يوماً</option><option value="90">الأقدم من ٩٠ يوماً</option><option value="all">كل التسجيلات</option></select></label>
            <button class="btn danger" type="button" id="clRun">حذف التسجيلات</button>
          </div>
          <div id="clInfo" class="small muted"></div>
        </div>
      </div>
      <div class="card stack" style="gap:10px"><h3>حفظ البيانات</h3>
        ${store.mode === 'cloud' ? '<p style="margin:0"><span class="pill ok">سحابي</span> البيانات محفوظة في Firebase وتظهر على كل الأجهزة.</p>' : '<p style="margin:0"><span class="pill warn">محلي</span> البيانات محفوظة في هذا المتصفح فقط. للعمل بين أجهزة الطلاب والمعلم فعّل Firebase (راجع ملف README).</p>'}
      </div>
      ${aiEnabled() ? '<div class="card stack usage-card" id="aiUse" style="gap:12px;grid-column:1 / -1"></div>' : ''}
 <div class="card stack" style="gap:10px" id="tPush"></div>
      <div class="card stack" style="gap:10px"><h3>الإشعارات على الجوال</h3><div id="pushStat" class="small muted">${pushConfigured() && PUSH.url ? 'جارٍ العدّ…' : '<span class="pill warn">غير مفعّلة</span> تظهر التنبيهات للطلاب داخل الموقع فقط. لتفعيل إشعارات الجوال ضع <code>vapidKey</code> و<code>url</code> في ملف js/firebase-config.js (راجع notify-service/README.md).'}</div></div>
      <div class="card stack" style="gap:10px"><h3>خادم تحليل التجويد</h3><div id="aiStatus" class="small muted">${aiEnabled() ? 'جارٍ الفحص…' : 'غير مفعّل. ضع رابط الخادم في ملف js/firebase-config.js (راجع muaalem-space/README.md).'}</div></div>
      ${store.mode === 'cloud' ? `<div class="card stack" style="gap:10px"><h3>نقل بيانات النسخة السابقة</h3>
        <p class="muted small" style="margin:0">ينسخ الطلاب وواجبات سورة يس من «مقرأة الفاتح» القديمة إلى النظام الجديد. التسليمات القديمة لا تُنقل.</p>
        <button class="btn" id="mig" type="button">نقل البيانات القديمة</button></div>` : ''}
    </div>`;
    if (aiEnabled()) drawAiCard(body);
    drawTeacherPush(body);
    if (pushConfigured() && PUSH.url) store.listPushTokens().then((L) => {
      const el = $('#pushStat', body); if (!el) return;
      const st = L.filter((x) => x.role === 'student');
      const by = (k) => st.filter((x) => x.platform === k).length;
      const people = new Set(st.map((x) => x.studentId)).size;
      el.innerHTML = `<span class="pill ok">مفعّلة</span> ${ar(people)} طالباً فعّلوها على ${ar(st.length)} جهازاً (أندرويد ${ar(by('android'))}، آيفون ${ar(by('ios'))}، حاسوب ${ar(by('desktop'))}). يفعّلها الطالب من «الإعدادات» في صفحته.`;
    }).catch((e) => { const el = $('#pushStat', body); if (el) el.textContent = 'تعذر العدّ: ' + (e.code || e.message); });
    if (aiEnabled()) aiHealth().then((h) => { const el = $('#aiStatus', body); if (el) el.innerHTML = h.model_error ? `<span class="pill bad">خطأ</span> ${esc(h.model_error)}` : h.model_ready ? `<span class="pill ok">جاهز</span> النموذج محمّل على ${esc(h.device)}${h.queue ? `، وفي الانتظار ${ar(h.queue)}` : ''}.` : '<span class="pill warn">يستيقظ</span> النموذج قيد التحميل.'; })
      .catch(() => { const el = $('#aiStatus', body); if (el) el.innerHTML = '<span class="pill warn">لا يستجيب</span> قد يكون الخادم نائماً؛ يستيقظ مع أول تحليل خلال دقيقة أو دقيقتين.'; });
    const pickAudio = () => {
      const w = $('#clWhich', body).value;
      return D.subs.filter((x) => x.hasAudio && (w === 'all' || (w === 'graded' ? !!x.teacher : Date.now() - new Date(x.createdAt).getTime() > +w * 864e5)));
    };
    const info = () => { const L = pickAudio(); $('#clInfo', body).textContent = L.length ? `سيُحذف ${ar(L.length)} تسجيلاً، ويتوفر نحو ${fmtBytes(L.reduce((n, x) => n + audioBytesOf(x), 0))}.` : 'لا توجد تسجيلات بهذا الاختيار.'; };
    $('#clWhich', body).onchange = info;
    info();
    $('#clRun', body).onclick = async () => {
      const L = pickAudio();
      if (!L.length) return toast('لا توجد تسجيلات بهذا الاختيار.');
      if (!(await confirmBox(`حذف ${ar(L.length)} تسجيلاً صوتياً؟ تبقى الدرجات والتقييمات، لكن لا يمكن استرجاع الصوت.`, 'حذف التسجيلات'))) return;
      const { ok, fail } = await runBulk('حذف التسجيلات الصوتية', L, (x) => store.deleteAudio(x.pn, x.id));
      L.forEach((x) => { x.hasAudio = false; x.audioBytes = 0; });
      if (store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); }
      toast(fail ? `حُذف ${ar(ok)}، وتعذر ${ar(fail)}.` : `حُذف ${ar(ok)} تسجيلاً وتوفرت المساحة.`);
      drawBody();
    };
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
  const rem = remember.get('teacher');
  app.innerHTML = `<div class="card auth stack">
    <h2>دخول المعلم</h2>
    <p class="muted" style="margin:0">${cloud ? 'ادخل بالبريد وكلمة المرور لحساب المعلم في Firebase.' : st.hasPassword ? 'أدخل كلمة مرور المعلم.' : 'أول دخول: اختر اسمك وكلمة مرور لحماية لوحة المعلم على هذا الجهاز.'}</p>
    <form id="tlForm" class="stack" style="gap:12px">
      ${cloud ? '<label class="field">البريد الإلكتروني<input type="email" id="tlU" autocomplete="username" required></label>' : st.hasPassword ? '' : '<label class="field">اسم المعلم<input type="text" id="tlU" required></label>'}
      <label class="field">كلمة المرور
        <span class="row" style="gap:6px;flex-wrap:nowrap"><input type="password" id="tlP" name="password" autocomplete="current-password" minlength="4" required style="flex:1"><button class="btn sm" type="button" id="tlEye" aria-label="إظهار كلمة المرور">إظهار</button></span></label>
      ${rememberBox('tlRem', !!rem)}
      <div id="tlErr" class="notice" hidden></div>
      <button class="btn primary" type="submit">دخول</button>
    </form>
  </div>`;
  const TP = $('#tlP', app);
  if (rem) { TP.value = rem.p; if (cloud && $('#tlU', app)) $('#tlU', app).value = rem.u || ''; }
  $('#tlEye', app).onclick = (e) => { const show = TP.type === 'password'; TP.type = show ? 'text' : 'password'; e.target.textContent = show ? 'إخفاء' : 'إظهار'; };
  $('#tlRem', app).onchange = (e) => { if (!e.target.checked) { remember.clear('teacher'); toast('لن تُحفظ كلمة المرور على هذا الجهاز.'); } };
  $('#tlForm', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    const box = $('#tlErr', app); box.hidden = true;
    try {
      const r = await store.teacherSignIn($('#tlU', app)?.value || '', $('#tlP', app).value);
      if ($('#tlRem', app).checked) remember.set('teacher', { u: cloud ? $('#tlU', app)?.value || '' : '' }, TP.value);
      else remember.clear('teacher');
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
  // الرئيسية لا تحتاج بيانات: نرسمها فوراً لتستقبل شعار الشاشة الافتتاحية دون انتظار التحميل
  const isHome = () => !routes[location.hash.replace(/^#\/?/, '').split('/')[0]] || location.hash.replace(/^#\/?/, '').split('/')[0] === '';
  const homeFirst = isHome();
  if (homeFirst) { render(); window.__splashReady?.(); }
  try {
    await Promise.all([loadQuran(), initStore()]);
  } catch (e) {
    $('#app').innerHTML = `<div class="empty">تعذر تحميل المصحف. تأكد من الاتصال ثم أعد تحميل الصفحة.</div>`;
    window.__splashReady?.();
    return;
  }
  setTokenProvider(() => store.idToken());
  $('#modeTag').textContent = store.mode === 'cloud' ? 'الحفظ: سحابي' : 'الحفظ: محلي على هذا الجهاز';
  if (cloudError) { const b = $('#banner'); b.hidden = false; b.textContent = 'تعذر الاتصال بقاعدة البيانات السحابية؛ تعمل المنصة الآن بالحفظ المحلي على هذا الجهاز.'; }
  booted = true;
  if (!(homeFirst && isHome())) render();
  window.__splashReady?.();
})();
