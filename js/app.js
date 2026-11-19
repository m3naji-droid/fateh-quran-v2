import { loadQuran, getSurahs, surahName, ayahCount, ayahWords, rangeWords, toArabicDigits as ar } from './quran.js';
import { align, score } from './align.js';
import { analyzeAyah, wordHtml, summarize, RULES } from './tajweed.js';
import { RecitationSession, devCaps, AyahPlayer, RECITERS, hasRecognition, hasRecorder, inAppBrowser, isIOS, micErrorText } from './speech.js';
import { initStore, store, cloudError } from './store.js';
import { TAJWEED_API, PUSH } from './firebase-config.js';
import { registerSW, platform, promptInstall, onInstallChange, watchUpdates } from './pwa.js';
import { CH_HOURS, CH_DAILY, CH_PTS, CH_DEFAULT_PTS, CH_V, isStrict, setChPts, chStatus, chWinner, chBonus, chView, timeLeft } from './challenge.js';
import { mountTalqeen } from './talqeen.js';
import { earnHimma, himmaPeek, himmaToday, himmaBonus, computeLists, mountLists, HM } from './lists.js';
import { mountCheer, cheerCfg, cleanCfg, setCfgCache, splitEmojis, CHEER_MAX, PHRASE_MAX } from './cheer.js';
import { mountAyahOfDay } from './ayahday.js';
import { mountIqraStudent, mountIqraTeacher, iqraCfg, iqraBonus, IQ_DEFAULT } from './iqra.js';
import { openClassroom } from './classroom.js';
import { LIVE_MIN, AI_PENALTY, AI_MAX, PTS as HPTS, matchWinner, sideOf, tiebreak, rangeText as hRange, firstRound, advance as heroAdvance, heroBonus, stageLabel, bracketHtml, usedBy as heroUsed, kindLabel } from './heroes.js';
import { taskFor, taskStudents, targetLabel, buildTarget, tClasses, tStudents, taskEnd, taskStarted, taskClosed, riyadhDate, toLocalInput } from './targets.js';
import { TEMPLATES, seasonStatus, activeSeason, seasonRange, seasonExtra, seasonBarHtml, seasonBoardHtml, daysLeftText, fmtDay, todayStr } from './season.js';
import { PRESETS, KH_PTS, normSegs, khTotal, khDone, khActive, khForClass, newKeys, nextGap, contributors, khBonus, khLabel, daysLeft, detailHtml as khDetailHtml, groupCertificate } from './khatma.js';
import { mergeAttempt, mapFromSubs, renderMushaf, surahDetailHtml, suggestRange } from './mushaf.js';
import { mountReports } from './reports.js';
import { mountChat, fbLast, fbClosed, fbUnreadS, fbUnreadT, fbPreview, QUICK_DEFAULT } from './fbchat.js';
import { compressImage, blobToB64, b64ToBlob, annImage, openLightbox, pruneImageCache, fmtKB, IMG_DAILY_LIMIT, IMG_DAYS } from './images.js';
import { openImageEditor, openDesigner } from './imgedit.js';
import { pushState, enablePush, disablePush, refreshPush, testNotification, sendPush, sendPushBatch, sendAnnouncement, pushConfigured, getMute, setMute, notifyFeedback, notifyChallenge, notifyKhatma, notifyLate, requestServerAi, notifyReview, notifyOnline, notifyFbMsg } from './push.js';
import { mountIssueTile, drawIssuesTeacher, capCheck } from './speech-issues.js';
import { mountMonthCountdown, mountPrayerTile, startPrayerAlerts, fmtWhen } from './countdown.js';
import { renderPages, downloadPDF, printPages, DEFAULT_NOTES, PER_PAGE } from './cards.js';
import { confetti as confetti0, pickHigh, pickLow } from './celebrate.js';
import { CATALOG, KINDS, SLOT, earnText, earnSteps, earnLevel, earnProgress, MEDALS, shopItems, ACH, LEVELS, achLevels, meetsNeed, balance, setLooks, setLook, playFx, EARN_KEYS, GLOWS } from './rewards.js';
import { dayTimes, thisMonthStart } from './prayer.js';
/** الاحتفال، ومعه تأثير الطالب الخاص من المتجر إن اختاره */
const FX = { kind: '' };
function confetti(...a) { confetti0(...a); if (FX.kind) setTimeout(() => playFx(FX.kind), 250); }
/** خريطة الزينة من مستند looks (مفاتيحه معرّفات الحسابات وفي كل قيمة رقم الطالب) */
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** أسبوع الدراسة (الأحد إلى السبت) بتوقيت البحرين: k=0 هذا الأسبوع، ١ الماضي… */
function weekRange(k) {
  const TZ = 3 * 3600e3, now = new Date(Date.now() + TZ);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay() - 7 * k) - TZ;
  const end = start + 7 * 864e5;
  const a = new Date(start + TZ), z = new Date(end - 1 + TZ);
  const label = a.getUTCMonth() === z.getUTCMonth() ? `${ar(a.getUTCDate())}–${ar(z.getUTCDate())} ${MONTHS_AR[z.getUTCMonth()]}` : `${ar(a.getUTCDate())} ${MONTHS_AR[a.getUTCMonth()]} – ${ar(z.getUTCDate())} ${MONTHS_AR[z.getUTCMonth()]}`;
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString(), label, name: k === 0 ? 'هذا الأسبوع' : k === 1 ? 'الأسبوع الماضي' : k === 2 ? 'قبل أسبوعين' : `قبل ${ar(k)} أسابيع` };
}
/** أسبوع صوت الأسبوع (بداية الأحد ISO). الأصوات القديمة بلا wk: من نص أسبوعها، وإلا من تاريخ اختيارها */
function voiceWk(v) {
  if (!v) return '';
  if (v.wk) return v.wk;
  for (let k = 0; k < 26; k++) { const r = weekRange(k); if (v.week && v.week === r.label) return r.from; }
  const t = Date.parse(v.at || ''); if (!t) return '';
  for (let k = 0; k < 26; k++) { const r = weekRange(k); if (t >= Date.parse(r.from) && t < Date.parse(r.to)) return r.from; }
  return '';
}
/* ---- إعلانات غنية: ألبوم صور، ورسالة صوتية، وزر ينقل الطالب ---- */
/* أقسام المعلم: [المفتاح، الاسم، الرمز، رئيسي في شريط الجوال] */
const TNAV = [['home', 'لوحة اليوم', '🏠', 1], ['subs', 'الواجبات والتسليم', '📥', 1], ['watch', 'المتابعة', '👀', 1], ['honor', 'لوحة الشرف', '🏆', 1],
  ['ann', 'الإعلانات', '📢'], ['fb', 'رأيك يهمنا', '💬'], ['reports', 'التقارير', '📊'], ['settings', 'الإعدادات', '⚙️']];
/* أقسام «الواجبات والتسليم» الداخلية: [المفتاح، الاسم، الرمز] */
const TSUB = [['subs', 'التسليمات', '📥'], ['tasks', 'الواجبات', '📝'], ['people', 'الصفوف والطلاب', '👥'], ['errors', 'الأخطاء والدرجات', '🎯'], ['iqra', 'اقرأ وارتقِ', '📖']];
const TGROUP = Object.fromEntries(TSUB.map(([k]) => [k, 'subs']));
/** كل الأقسام (للوحة اليوم والبحث) */
const TALL = [...TNAV.slice(0, 2), ...TSUB.slice(1).map(([k, l, i]) => [k, l, i]), ...TNAV.slice(2)];
const TBADGE = { watch: 1, iqra: 1, fb: 1 };
const CDCFG = { v: undefined }; // موعد العد التنازلي الذي حدده المعلم (يُحمّل مرة)
const ANN_MAX_IMGS = 4;
const ANN_ACTS = [
  { k: 'tasks', label: 'سمّع واجباتك', btn: '📋 سمّع واجباتك' }, { k: 'practice', label: 'التدريب الحر', btn: '🎯 تدرّب الآن' },
  { k: 'honor', label: 'لوحة الشرف', btn: '🏆 لوحة الشرف' }, { k: 'rewards', label: 'خزانتي', btn: '🏅 افتح خزانتي' },
  { k: 'iqra', label: 'اقرأ وارتقِ', btn: '📖 اقرأ وارتقِ' }, { k: 'heroes', label: 'الأبطال', btn: '⚔️ الأبطال' },
  { k: 'url', label: 'رابط خارجي', btn: '🔗 افتح الرابط' },
];
const annKey = (aid, i) => (i ? `${aid}__${i}` : aid);
/** ألبوم صور الإعلان: تمرير أفقي، والضغط يكبّر */
function mountAlbum(host, aid, n) {
  if (!host) return;
  host.innerHTML = `<div class="alb-track">${Array.from({ length: n }, (_, i) => `<button type="button" class="alb-it" data-i="${i}"><div class="loading">…</div></button>`).join('')}</div>${n > 1 ? `<div class="alb-dots">${Array.from({ length: n }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}`;
  const tr = host.querySelector('.alb-track');
  tr.onscroll = () => { const i = Math.round(Math.abs(tr.scrollLeft) / Math.max(1, tr.clientWidth)); host.querySelectorAll('.alb-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); };
  host.querySelectorAll('.alb-it').forEach(async (b) => {
    const i = +b.dataset.i;
    try {
      const blob = await annImage(annKey(aid, i), (k) => store.getAnnImage(k));
      if (!blob) { b.innerHTML = `<small class="muted">انتهت مدة عرض الصورة (${ar(IMG_DAYS)} يوماً).</small>`; return; }
      b.innerHTML = `<img alt="صورة ${ar(i + 1)}" src="${URL.createObjectURL(blob)}"><span class="ann-zoom">🔍 ${n > 1 ? `${ar(i + 1)}/${ar(n)}` : 'اضغط للتكبير'}</span>`;
      b.onclick = () => openLightbox(blob, 'صورة الإعلان');
    } catch { b.innerHTML = '<small class="muted">تعذر تحميل الصورة.</small>'; }
  });
}
/** مشغّل رسالة المعلم الصوتية */
async function mountAnnVoice(host, aid, sec) {
  if (!host) return;
  host.innerHTML = `<div class="ann-vo"><span>🎙️ رسالة صوتية من معلمك${sec ? ` · ${ar(sec)} ث` : ''}</span><div class="loading small">جارٍ التحميل…</div></div>`;
  try {
    const d = await store.getAnnImage(`${aid}__voice`);
    if (!d?.b64) { host.querySelector('.loading').textContent = `انتهت مدة الرسالة الصوتية (${ar(IMG_DAYS)} يوماً).`; return; }
    host.querySelector('.loading').outerHTML = `<audio controls preload="auto" src="${URL.createObjectURL(b64ToBlob(d.b64, d.type || 'audio/webm'))}"></audio>`;
  } catch { host.querySelector('.loading').textContent = 'تعذر تحميل الرسالة الصوتية.'; }
}
let annAu = null;
async function playAnnVoice(b, aid) {
  if (annAu && !annAu.paused) { annAu.pause(); b.textContent = b.textContent.replace('⏸', '🎙️'); return; }
  b.disabled = true;
  try { const d = await store.getAnnImage(`${aid}__voice`); if (!d?.b64) throw new Error('انتهت مدته'); annAu = new Audio(URL.createObjectURL(b64ToBlob(d.b64, d.type || 'audio/webm'))); annAu.onended = () => (b.textContent = b.textContent.replace('⏸', '🎙️')); await annAu.play(); b.textContent = b.textContent.replace('🎙️', '⏸'); }
  catch (e) { toast('تعذر التشغيل: ' + e.message); }
  b.disabled = false;
}
const looksMap = (d) => { const m = {}; Object.values(d || {}).forEach((v) => { if (v && v.pn) m[v.pn] = v; }); return m; };
import { computeBoard, boardHtml, rankBadge, computeMonth, computeRange, monthTitle, subScore } from './leaderboard.js';
import { downloadCertificatePNG, downloadCertificatesPDF } from './certificate.js';
import { CATS, defaultCatalog, mergeCatalog, findErr, makeMark, deduction, gradeFrom } from './errors.js';
import { G, autoGrade, coverage, readEnd, gradeV2, capped, aiErrors } from './grading.js';
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
/** نوع المحادثة، ومنها ما يبدؤه المعلم */
const FBK = (k) => FB_KINDS[k] || (k === 'teacher' ? ['✉️', 'رسالة من المعلم'] : ['💬', 'ملاحظة']);
const fbKindChip = (k) => `<span class="fb-kind fb-${k}">${FBK(k)[0]} ${FBK(k)[1]}</span>`;
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
let srNoticeShown = false; // نافذة إعلان التعرف: مرة لكل فتح للموقع
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
// آيفون (خاصة التطبيق المثبّت): بعد إغلاق قائمة الاختيار أو لوحة المفاتيح قد يبقى الشريط السفلي الثابت
// مرفوعاً في منتصف الشاشة. نُخفيه أثناء فتح لوحة المفاتيح، ونعيد رسمه في مكانه بعد إغلاقها.
(() => {
  const vv = window.visualViewport; if (!vv) return;
  let t = 0;
  const kbOpen = () => vv.height < window.innerHeight * 0.78;
  const settle = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      document.body.classList.toggle('kb-open', kbOpen());
      if (kbOpen()) return;
      document.querySelectorAll('.tnav').forEach((n) => { n.style.display = 'none'; void n.offsetHeight; n.style.display = ''; });
      window.scrollTo(window.scrollX, window.scrollY);
    }, 150);
  };
  vv.addEventListener('resize', settle);
  document.addEventListener('focusin', (e) => { if (e.target.matches?.('input, select, textarea')) document.body.classList.add('kb-open'); settle(); });
  document.addEventListener('focusout', settle);
  document.addEventListener('change', (e) => { if (e.target.matches?.('select')) settle(); });
  window.addEventListener('pageshow', settle); document.addEventListener('visibilitychange', settle);
})();

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
        <div class="seg" role="group" aria-label="نوع التدريب" ${opts.lockMode ? 'hidden' : ''}>
          <button type="button" data-mode="recite" class="${mode === 'recite' ? 'on' : ''}">تلاوة نظراً</button>
          <button type="button" data-mode="hifz" class="${mode === 'hifz' ? 'on' : ''}">تسميع غيباً</button>
          ${opts.onTalqeen ? '<button type="button" data-mode="talqeen">تلقين متدرج</button>' : ''}
        </div>
        <label class="btn sm"><input type="checkbox" id="rcTaj" ${tajOn ? 'checked' : ''}> ألوان التجويد</label>
        <button class="btn sm" id="rcHint" type="button" ${mode === 'hifz' && !opts.noHint ? '' : 'hidden'}>تلميح بالكلمة التالية</button>
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
        <div id="rcGo"></div>
        ${opts.oneShot ? `<div class="one-shot"><b>محاولة واحدة</b><span>${ONE_SHOT_NOTE}</span>${opts.onPractice ? '<button class="btn sm" type="button" id="rcPractice">تدرّب على المقطع أولاً</button>' : ''}</div>` : ''}
        <div id="rcNotice"></div>
        <button class="mic" id="rcMic" type="button" aria-label="ابدأ التسميع">${MIC_SVG}</button>
        <div class="timer" id="rcTimer">00:00</div>
        <div class="progress"><i id="rcProg"></i></div>
        <div class="small muted" id="rcStatus">اضغط الزر وابدأ القراءة، وسيتابعك الموقع كلمة بكلمة.</div>
        <div class="live-text" id="rcLive"></div>
        ${opts.practice ? '<div class="live-sc" id="rcLiveSc" hidden></div>' : ''}
      </div>
      <div id="rcResult"></div>
      <div class="card stack" style="gap:10px" ${opts.noListen ? 'hidden' : ''}>
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
  let lastBlob = null, lastDuration = 0, lastTranscript = '', lastDiag = null;
  let aiRes = null, aiCtl = null;

  // أدوات العرض
  $$('[data-mode]', root).forEach((b) => (b.onclick = () => {
    if (b.dataset.mode === 'talqeen') { opts.onTalqeen({ surah, from, to }); return; }
    mode = b.dataset.mode;
    $$('[data-mode]', root).forEach((x) => x.classList.toggle('on', x === b));
    text.classList.toggle('hide', mode === 'hifz');
    $('#rcHint', root).hidden = mode !== 'hifz' || !!opts.noHint;
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
    if (end) { if (!opts.noListen) playRange(+end.dataset.a, +end.dataset.a); return; }
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
    onAyah: (a) => { $$('.ayah', text).forEach((x) => x.classList.toggle('playing', +x.dataset.a === a)); follow($(`.ayah[data-a="${a}"]`, text)); },
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
  $('#rcPlay', root).onclick = () => { showSheet(); text.scrollTo({ top: 0 }); playRange(from, to); };
  $('#rcStopPlay', root).onclick = () => player.stop();

  // متابعة النص: يبقى موضع القراءة أو التلاوة ظاهراً داخل إطار المصحف
  let followT = 0;
  function follow(el) {
    if (!el || !text.isConnected) return;
    const now = Date.now(); if (now - followT < 350) return; followT = now;
    const box = text.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < box.top + 40 || r.bottom > box.bottom - 40) text.scrollTo({ top: text.scrollTop + (r.top - box.top) - text.clientHeight / 3, behavior: 'smooth' });
  }
  const showSheet = () => { const sh = $('.sheet', root); const r = sh?.getBoundingClientRect(); if (r && (r.top < 56 || r.top > innerHeight * 0.4)) sh.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  /* النتيجة الحية في التدريب الحر: دقة الكلمات، وكل آية تكتمل تظهر نتيجتها ونقطتها فوراً */
  const ayahIdx = {}; words.forEach((w, i) => { (ayahIdx[w.ayah] = ayahIdx[w.ayah] || []).push(i); });
  const LV = { seen: new Map(), pts: 0, hm: null };
  const liveReset = () => { LV.seen = new Map(); LV.pts = 0; LV.hm = opts.hmPeek ? opts.hmPeek() : null; const b = $('#rcLiveSc', root); if (b) { b.hidden = true; b.innerHTML = ''; } };
  function paintLiveScore(res) {
    const box = $('#rcLiveSc', root); if (!box) return;
    let ok = 0, bad = 0;
    for (let i = 0; i < res.position && i < words.length; i++) { const st = res.status[i]; if (st === 'correct') ok++; else if (st === 'wrong' || st === 'missing') bad++; }
    const done = ok + bad; if (!done) return;
    // الآيات التي تجاوزها الطالب: نتيجتها ثابتة
    Object.entries(ayahIdx).forEach(([a, ix]) => {
      if (LV.seen.has(+a) || res.position <= ix[ix.length - 1]) return;
      const c = ix.filter((i) => res.status[i] === 'correct').length, p = Math.round((c / ix.length) * 100);
      let pt = 0;
      if (p >= HM.okP && LV.hm) { const k = surah + ':' + a; if ((LV.hm.k[k] || 0) < HM.perAyah && LV.hm.pts + LV.pts < HM.dayCap) { pt = 1; LV.pts++; LV.hm.k[k] = (LV.hm.k[k] || 0) + 1; } }
      LV.seen.set(+a, { p, pt, fresh: true });
    });
    const acc = Math.round((ok / done) * 100), col = acc >= 85 ? 'var(--ok)' : acc >= 60 ? 'var(--warn)' : 'var(--bad)';
    const chips = [...LV.seen.entries()].slice(-6).map(([a, v]) => `<span class="lv-a ${v.p >= HM.okP ? 'ok' : 'bad'}${v.fresh ? ' pop' : ''}">آية ${ar(a)}: ${ar(v.p)}٪${v.pt ? ' <b>+١🌟</b>' : v.p >= HM.okP ? '' : ' ↻'}</span>`).join('');
    LV.seen.forEach((v) => (v.fresh = false));
    const okA = [...LV.seen.values()].filter((v) => v.p >= HM.okP).length;
    box.hidden = false;
    box.innerHTML = `<div class="lv-top"><div class="lv-acc" style="--c:${col}"><b>${ar(acc)}٪</b><span>دقتك الآن</span></div>
      <div class="lv-n"><span>✅ <b>${ar(ok)}</b> صحيحة</span><span>❌ <b>${ar(bad)}</b> ${bad === 1 ? 'خطأ' : 'أخطاء'}</span><span>📖 <b>${ar(okA)}</b> من ${ar(LV.seen.size)} ${LV.seen.size === 1 ? 'آية' : 'آيات'} متقنة</span>${LV.hm ? `<span>🌟 <b>+${ar(LV.pts)}</b> همّة حتى الآن</span>` : ''}</div></div>
      ${chips ? `<div class="lv-as">${chips}</div>` : ''}`;
  }
  // التلوين حسب النتيجة
  function paint(res, live) {
    text.classList.toggle('live', !!live);
    wEls.forEach((el, i) => {
      el.classList.remove('correct', 'wrong', 'missing', 'cursor');
      const s = res.status[i];
      if (s !== 'pending') el.classList.add(s);
    });
    if (live && wEls[res.position]) { wEls[res.position].classList.add('cursor'); follow(wEls[res.position]); }
    if (live && opts.onLive) opts.onLive(res);
    if (live && opts.practice) paintLiveScore(res);
    $('#rcProg', root).style.width = (res.total ? (res.done / res.total) * 100 : 0) + '%';
  }

  if (inAppBrowser) $('#rcNotice', root).innerHTML = `<div class="notice">⚠️ فتحت المقرأة من داخل تطبيق (مثل واتساب)، وفيه قد لا يعمل الميكروفون أو التصحيح الآلي. ${isIOS ? 'اضغط ⋯ أو زر المشاركة واختر «فتح في Safari».' : 'اضغط ⋮ واختر «فتح في Chrome».'}</div>`;
  else if (!hasRecorder) $('#rcNotice', root).innerHTML = '<div class="notice">متصفحك لا يدعم التسجيل الصوتي. استخدم Chrome أو Edge أو Safari حديثاً.</div>';
  else if (!hasRecognition) $('#rcNotice', root).innerHTML = '<div class="notice">المتابعة الحية تعمل في Chrome وEdge وSafari. في هذا المتصفح سيُحفظ تسجيلك فقط ليقيّمه المعلم.</div>';

  // إذن الميكروفون مرفوض سابقاً: ننبّه بالحل قبل أن يضغط الطالب
  try { navigator.permissions?.query({ name: 'microphone' }).then((p) => { const warn = () => { if (p.state === 'denied' && !$('#rcNotice', root).textContent) $('#rcNotice', root).innerHTML = `<div class="notice">🎙️ ${esc(micErrorText({ name: 'NotAllowedError' }))}</div>`; }; warn(); p.onchange = () => { if (p.state !== 'denied') $('#rcNotice', root).innerHTML = ''; warn(); }; }).catch(() => {}); } catch {}

  if (store.mode === 'local') window.__rcLive = (t) => { if (!LV.hm) liveReset(); onTranscript(t); }; // للتجارب المحلية فقط
  let throttle = 0, pendingT = null;
  function onTranscript(t) {
    $('#rcLive', root).textContent = t.split(' ').slice(-14).join(' ');
    const now = Date.now();
    const run = () => { last = align(words, t, { partial: true }); paint(last, true); throttle = Date.now(); $('#rcStatus', root).textContent = `وصلت إلى الكلمة ${ar(last.position)} من ${ar(words.length)}`; };
    clearTimeout(pendingT);
    if (now - throttle > 250) run(); else pendingT = setTimeout(run, 250);
  }

  /* فحص الجهاز قبل أول تحدٍّ أو مباراة: يُعرف من أول مرة هل تظهر الكلمات، فلا تضيع محاولته */
  const iosApp = isIOS && !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  const needCap = () => opts.capCheck && hasRecognition && !iosApp && !devCaps.capChecked && !devCaps.noDual;
  function openCapCheck() {
    openModal(`<div class="stack cap-chk" style="text-align:center;align-items:center">
      <div style="font-size:42px">🎙️</div><h2 style="margin:0">قبل أن تبدأ: فحص سريع لجهازك</h2>
      <p style="margin:0">مرة واحدة فقط (١٢ ثانية)، لنعرف هل تظهر الكلمات على جوالك أثناء القراءة، فلا تضيع محاولتك.</p>
      <div class="cap-step" id="capStep"></div><ul class="sp-res" id="capRes" style="text-align:start"></ul>
      <div class="row" style="justify-content:center"><button class="btn primary" type="button" id="capGo">ابدأ الفحص</button><button class="btn ghost" type="button" id="capSkip">تخطَّ</button></div></div>`, (m) => {
      const go = m.querySelector('#capGo');
      m.querySelector('#capSkip').onclick = () => { devCaps.setCapChecked(); closeModal(); };
      go.onclick = async () => {
        if (go.dataset.done) { closeModal(); return; }
        go.disabled = true; m.querySelector('#capSkip').hidden = true;
        const r = await capCheck((t) => { const e = m.querySelector('#capStep'); if (e) e.textContent = t; });
        if (!m.isConnected) return;
        const and = /Android/.test(navigator.userAgent);
        m.querySelector('#capRes').innerHTML = r.sr === 'ok'
          ? (r.dual ? '<li class="ok">✓ جهازك جاهز: تظهر الكلمات أثناء التسميع.</li>' : '<li class="ok">✓ ضبطنا جهازك: ستظهر الكلمات في التحديات والمباريات والتدريب.</li>')
          : `<li class="bad">✗ جوالك لا يتعرف على الكلام الآن. لا بأس: ادخل، وسيصل تسجيلك إلى المعلم فيسمعه ويقيّمك.</li>${and ? '<li>💡 للحل: الإعدادات ← التطبيقات ← التطبيقات الافتراضية ← الإدخال الصوتي ← اختر Google، ثم حدّث «خدمات الكلام من Google».</li>' : ''}`;
        go.disabled = false; go.dataset.done = '1'; go.textContent = 'تم، اضغط الميكروفون وابدأ';
        if (r.sr !== 'ok') { const again = document.createElement('button'); again.className = 'btn ghost'; again.type = 'button'; again.textContent = '↺ أعد الفحص'; again.onclick = () => { closeModal(); openCapCheck(); }; go.after(again); }
      };
    });
  }
  /** لماذا لم تظهر الكلمات؟ يُرسل مع التسجيل ليعرف المعلم السبب */
  function noWordsWhy() {
    const d = lastDiag || {};
    if (iosApp) return 'ios-app';
    if (!hasRecognition) return 'no-sr';
    if ((d.errs || []).some((e) => /not-allowed/.test(e))) return 'sr-blocked';
    if (d.noRec) return 'sr-broken';
    if ((d.voiced || 0) < 3000) return 'quiet';
    if (devCaps.capChecked && !devCaps.srOk) return 'sr-broken';
    if (!devCaps.srOk) return 'unknown-dev';
    return 'silent';
  }

  async function startRec() {
    if (needCap()) return openCapCheck();
    player.stop();
    pop?.remove();
    $('#rcResult', root).innerHTML = ''; $('#rcLive', root).innerHTML = ''; $('#rcGo', root).innerHTML = '';
    wEls.forEach((el) => el.classList.remove('correct', 'wrong', 'missing', 'cursor', 'revealed'));
    last = null; liveReset();
    // جهاز لا يجمع التسجيل والتعرف: في الواجبات يُسجَّل للمعلم فقط، وفي التدريب والتحديات تظهر الكلمات بلا تسجيل
    const nd = devCaps.noDual || devCaps.tryNoDual;
    // التجربة (التعرف وحده قبل التأكد) في التدريب فقط؛ أما التحديات والمباريات فلا تُجرَّب إلا بعد التأكد حتى لا تضيع المحاولة
    const recOnly = devCaps.noDual && !!opts.onSubmit, srOnly = hasRecognition && !opts.onSubmit && (devCaps.noDual || (nd && opts.practice));
    $('#rcNotice', root).innerHTML = recOnly ? '<div class="notice">🎙️ جهازك لا يستطيع إظهار الكلمات أثناء التسجيل؛ لذلك يُسجَّل تسميعك فقط، ويسمعه معلمك ويقيّمه بنفسه.</div>'
      : srOnly ? '<div class="notice">📝 على جهازك تظهر الكلمات أثناء القراءة، ولا يُحفظ تسجيل صوتي في التدريب والتحديات.</div>' : '';
    sess = new RecitationSession({
      noSR: recOnly, noRec: srOnly,
      onTranscript,
      onLevel: (l) => $('#rcMic', root).style.setProperty('--lvl', l.toFixed(2)),
      onTick: (s) => { $('#rcTimer', root).textContent = fmtTime(s); },
      onError: (m) => { $('#rcNotice', root).innerHTML = `<div class="notice">${esc(m)}</div>`; if (opts.onSubmit && sess?.diag?.silent) goOn(); },
      maxSeconds: opts.maxSeconds || 300,
    });
    sess.onAutoStop = () => { if (sess?.reason === 'max') toast('انتهى الحد الأقصى لمدة التسجيل.'); finishRec(); };
    const micB = $('#rcMic', root);
    micB.disabled = true; // لا تُقبل ضغطة ثانية أثناء انتظار إذن الميكروفون فيبقى مفتوحاً بلا تسجيل
    $('#rcStatus', root).textContent = 'جارٍ فتح الميكروفون…';
    try {
      await sess.start();
      $('#rcNotice', root).innerHTML = hasRecognition && !recOnly ? '' : $('#rcNotice', root).innerHTML;
      // التسميع على جهاز لا تظهر فيه الكلمات: رسالة واضحة تطمئن الطالب أن يواصل
      if (opts.onSubmit && (recOnly || !hasRecognition || isIOS && !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone))) goOn();
      showSheet(); text.scrollTo({ top: 0 });
    } catch (e) {
      micB.disabled = false; sess = null;
      $('#rcStatus', root).textContent = '';
      if (e.code !== 'cancelled') $('#rcNotice', root).innerHTML = `<div class="notice">🎙️ ${esc(e.message)}</div>`;
      return;
    }
    micB.disabled = false;
    const mic = $('#rcMic', root);
    mic.classList.add('rec'); mic.innerHTML = STOP_SVG; mic.setAttribute('aria-label', 'إنهاء التسميع');
    $('#rcStatus', root).textContent = hasRecognition ? 'أستمع إليك… اقرأ بصوت واضح.' : 'جارٍ التسجيل…';
  }
  let finishing = false;
  function goOn() { const el = $('#rcGo', root); if (el && !el.querySelector('.rc-go')) el.innerHTML = '<div class="rc-go">واصِل.. 🎙️<br>تسجيلك سوف يصل إلى المعلم ويقيّمه، ثم تأتيك الدرجة</div>'; }
  async function finishRec() {
    if (finishing || !sess) return;
    finishing = true;
    const mic = $('#rcMic', root);
    mic.disabled = true;
    $('#rcStatus', root).textContent = 'جارٍ التحليل…';
    const { blob, duration, transcript, diag } = await sess.stop();
    $('#rcGo', root).innerHTML = '';
    lastDiag = diag || null;
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
    if (opts.confirmStart && !(await confirmBox(opts.confirmStart, 'ابدأ'))) return;
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
    if (opts.onFinal) { opts.onFinal(buildSubmission(), lastBlob, lastDuration); return; } // المباريات: النتيجة تُدار خارجياً
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
        ${opts.onNoTranscript && lastBlob && lastDuration >= 5 ? '<p class="small" style="margin:0">قرأت لكن الجهاز لم يتعرف على كلامك؟ أرسل تسجيلك فيسمعه معلمك ويضع نتيجتك بنفسه.</p>' : ''}
        <div class="row">${opts.onNoTranscript && lastBlob && lastDuration >= 5 ? '<button class="btn primary" id="rcToT" type="button">📤 أرسل تسجيلي ليقيّمه المعلم</button>' : ''}${lastBlob && opts.onSubmit ? submitBtn : ''}${retryBtn}</div></div>`;
      const tt = $('#rcToT', box); if (tt) tt.onclick = () => { tt.disabled = true; opts.onNoTranscript(buildSubmission(), lastBlob, lastDuration); };
    } else {
      const sc = score(last, lastDuration);
      const mist = [];
      last.status.forEach((s, i) => { if (s === 'wrong' || s === 'missing') mist.push(i); });
      const color = sc.percent >= 85 ? 'var(--ok)' : sc.percent >= 60 ? 'var(--warn)' : 'var(--bad)';
      box.innerHTML = `<div class="card stack" style="gap:14px">
        ${sendBox}
        ${cheerHtml(opts.graded ? autoGrade({ statuses: buildSubmission().statuses }).total : sc.outOf10)}
        ${opts.graded ? '<div class="grade-card" id="rcGrade"></div>' : ''}
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
        ${L && !opts.graded ? `<div class="learn-note">الدرجة المتوقعة من معلمك: <b>${ar(predict(L.model, { surah, from, to, percent: sc.percent, wpm: sc.wpm }, L.rates))} / ١٠</b><br><span class="small">تقدير يتعلمه النظام من تقييمات المعلم السابقة، والدرجة النهائية للمعلم.</span></div>` : ''}
        ${opts.graded ? '' : '<div class="small muted">التصحيح الآلي يقيس صحة الكلمات والحفظ. أحكام التجويد والمخارج يقيّمها المعلم بالاستماع.</div>'}
        <div class="row">${submitBtn}${retryBtn}</div>
      </div>`;
      $$('[data-play]', box).forEach((b) => (b.onclick = () => playRange(+b.dataset.play, +b.dataset.play)));
      if ((opts.graded ? autoGrade({ statuses: buildSubmission().statuses }).total : sc.outOf10) >= 8) confetti();
      paintGrade();
      box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      opts.onResult && opts.onResult(buildSubmission());
    }
    if (lastBlob && aiEnabled() && !opts.noAi) mountAi(box);
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

  /** درجة الواجب الآلية الميسّرة: تظهر فوراً، وتكتمل بعد تحليل التجويد */
  let aiFailed = false;
  function paintGrade() {
    const el = $('#rcGrade', root); if (!el || !last) return;
    const sub = buildSubmission();
    const g = autoGrade({ ...sub, hasAudio: !!lastBlob, taskId: 'x', createdAt: new Date().toISOString() });
    const wait = g.pending && aiEnabled() && !aiFailed;
    el.innerHTML = `<div class="gc-num"><b>${fmtQ(g.total)}</b><span>/ ١٠</span></div><div class="gc-tx"><b>${wait ? 'درجتك المبدئية' : 'درجتك'}</b>
      <span class="small">${g.v ? `${ar(g.v)} ${g.v === 1 ? 'خطأ' : g.v === 2 ? 'خطآن' : 'أخطاء'} في الكلمات` : 'كلماتك سليمة'}${sub.ai ? ` · ${g.l ? `${ar(g.l)} في الحركات والحروف · ` : ''}${g.t ? `${ar(g.t)} ${g.t <= 10 ? 'ملاحظات' : 'ملاحظة'} تجويد` : 'تجويدك سليم'}` : ''}${g.cov < G.full ? ` · قرأت ${ar(Math.round(g.cov * 100))}٪ من المقطع` : ''}</span>
      <span class="small muted">${wait ? '⏳ تكتمل بعد تحليل التجويد الآلي (دقيقة أو دقيقتان). يمكنك الخروج، وتُحسب تلقائياً.' : 'تقييم آلي ميسّر، ولمعلمك أن يراجعه.'}</span></div>`;
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
        st.className = 'send-state ok'; st.innerHTML = opts.graded && last ? '✓ أُرسل تسميعك. جزاك الله خيراً، ودرجتك تُحسب آلياً ولمعلمك أن يراجعها.' : '✓ أُرسل تسميعك إلى المعلم. جزاك الله خيراً، وانتظر تقييمه.';
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
      if (!opts.graded && !(await ensureAiNotice())) return;
      aiCtl = new AbortController();
      card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><div class="small" id="aiProg">جارٍ التحضير…</div><div class="progress"><i class="indet"></i></div>${opts.oneShot ? '<p class="small muted" style="margin:0">أُرسل تسميعك، وتُضاف نتيجة التحليل إليه عند انتهائه.</p>' : opts.onSubmit ? '<p class="small muted" style="margin:0">يمكنك الإرسال الآن؛ إن لم ينتهِ التحليل فسيُجريه المعلم لاحقاً.</p>' : ''}`;
      try {
        aiRes = await aiAnalyze(lastBlob, { surah, from, to }, (t) => { const el = $('#aiProg', card); if (el) el.textContent = t; }, aiCtl.signal);
        renderAi(card); paintGrade();
        if (sentId && opts.onAi) opts.onAi(sentId, aiRes).catch((e) => console.warn('ai save', e));
      } catch (e) {
        if (aiCtl.signal.aborted) return;
        aiFailed = true; paintGrade();
        if (sentId && opts.onAiFail) opts.onAiFail(sentId);
        card.innerHTML = `<h3>تحليل التجويد بالذكاء الاصطناعي</h3><div class="notice">${esc(e.message)}${opts.graded ? ' لا تقلق: أُرسل تسميعك، وسيُكمل النظام التحليل لاحقاً.' : ''}</div><button class="btn" type="button" id="aiGo">أعد المحاولة</button>`;
        $('#aiGo', card).onclick = start;
      }
    };
    if (opts.graded || pref.get('aiNoticeOk', false)) start(); else idle(); // الواجب: التحليل إلزامي
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
    const base = { surah, from, to, mode, duration: lastDuration, transcript: lastTranscript.slice(0, 5000), dev: devInfo(lastDiag), ...(aiRes ? { ai: aiRes } : aiCtl && !aiFailed && !aiCtl.signal.aborted ? { aiRunning: true } : {}) };
    if (!last) return { ...base, auto: false, percent: null, statuses: '', mistakes: [], counts: null, wpm: 0, why: noWordsWhy() };
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

/** وصف مختصر للجهاز والمتصفح وحال التعرف على الكلام، يُحفظ مع التسليم لتشخيص شكاوى التعرف */
function devInfo(diag) {
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : 'other';
  const br = inAppBrowser ? 'InApp' : /SamsungBrowser/.test(ua) ? 'Samsung' : /EdgA?\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'other';
  const d = diag || {};
  return { os, br, sr: !!d.sr, rs: d.restarts || 0, fin: d.finals || 0, dup: d.dups || 0, err: (d.errs || []).slice(0, 6), ...(d.silent ? { sil: 1 } : {}) };
}

/* الاحتفال (٨ من ١٠ فأعلى) والتحفيز لما دونها */
const fmt10 = (v) => ar(Number.isInteger(v) ? v : Number(v).toFixed(1).replace('.', '٫'));
/** للخصومات والدرجات بالربع: حتى منزلتين بلا أصفار زائدة */
const negQ = (v) => `<bdi dir="ltr">−${fmtQ(v)}</bdi>`;
const fmtDT = (iso) => { try { return ar(new Date(iso).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })); } catch { return iso; } };
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
  sub = { ...sub, ai: { ...sub.ai, errors: aiErrors(sub.ai) } };
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
// صدر تحديث للموقع: شريط بزر التحديث (لا يُعاد التحميل تلقائياً حتى لا يضيع تسميع جارٍ)
watchUpdates(() => {
  if (document.getElementById('updBar')) return;
  const bar = document.createElement('div');
  bar.id = 'updBar'; bar.className = 'upd-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span class="upd-ico">✨</span><div><b>يوجد تحديث جديد للمقرأة</b><span>اضغط هنا لتحصل على أحدث المزايا والإصلاحات.</span></div><button type="button" class="btn sm primary" id="updGo">تحديث الآن</button><button type="button" class="upd-x" id="updX" aria-label="لاحقاً">✕</button>';
  document.body.appendChild(bar);
  const go = () => {
    if (document.querySelector('.mic.rec')) { toast('أكمل تسميعك أولاً، ثم اضغط «تحديث الآن».'); return; }
    bar.querySelector('#updGo').textContent = 'جارٍ التحديث…';
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {}).finally(() => location.reload());
  };
  bar.onclick = (e) => { if (e.target.closest('#updX')) { bar.remove(); return; } go(); };
});
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
      <div id="aodHome" class="aod-home"></div>
    </div>
  </section>
  <ul class="feature-list">
    ${feats.map(([i, h, d]) => `<li><span class="fi" aria-hidden="true">${i}</span><span><b>${h}:</b> ${d}</span></li>`).join('')}
  </ul>`;
  mountAyahOfDay($('#aodHome', app));
}

/* ================= التدريب الحر (للطلاب المسجلين والمعلم فقط) ================= */
let pendingPractice = null;
function mountPractice(host, learn, onActivity, onResult, hmPeek = null) {
  const init = pendingPractice || pref.get('lastRange', { surah: 36, from: 1, to: 12 });
  pendingPractice = null;
  host.innerHTML = `<p class="muted" style="margin:0 0 12px">اختر أي مقطع ثم اضغط زر الميكروفون وابدأ القراءة. التدريب لا يُرسل للمعلم.</p>
    <div class="card" style="margin-bottom:16px">${rangePicker('pr', init)}</div>
    <div id="prBody"></div>`;
  let comp = null;
  let mode0 = init.mode;
  const talqeen = (r) => {
    comp?.destroy();
    comp = mountTalqeen($('#prBody', host), { ...r, reciter: pref.get('reciter', RECITERS[0].id), onActivity, onAyahDone: onResult,
      onExit: () => mount(r), onFinish: () => { mode0 = 'hifz'; mount(r); } });
  };
  const mount = (r) => { comp?.destroy(); pref.set('lastRange', r); comp = mountRecite($('#prBody', host), { ...r, mode: mode0, learn, onActivity, onResult, hmPeek, noAi: true, practice: true, onTalqeen: onResult ? talqeen : null }); }; // التدريب الحر بلا تحليل تجويد آلي
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
  /** نقاط «الهمة العالية» من التدريب: نقطة لكل آية صحيحة بسقوفها، أو دقائق لمن لا يعمل عنده التعرّف */
  function earnTraining(sub) {
    try {
      const day = riyadhDay(), before = himmaToday(me.id, day).pts, r = earnHimma(me.id, day, sub, hasRecognition);
      HS.n++;
      // وقت التدريب الفعلي (بالثواني) يُسجَّل لكل تلاوة تدريب، سواء كسبت نقاطاً أم لا، بسقف ٤ ساعات في اليوم
      const tk = `hsec_${me.id}_${day}`, used = +(localStorage.getItem(tk) || 0), secs = Math.max(0, Math.min(Math.round(sub.duration || 0), 14400 - used));
      if (secs >= 3) { try { localStorage.setItem(tk, String(used + secs)); } catch {} }
      if (!r.pts) { if (secs >= 3) hmEnqueue(day, { pts: 0, ayat: 0, mins: 0, secs }); paintHmBar(); return; }
      hmEnqueue(day, { ...r, secs: secs >= 3 ? secs : 0 }); // تُحفظ في الجهاز أولاً ثم تُرسل، وتُعاد المحاولة حتى تصل
      HS.pts += r.pts;
      const total = before + r.pts, newHonor = Math.floor(total / HM.ratio) > Math.floor(before / HM.ratio);
      hmPop(`<b>🌟 <bdi dir="ltr">+${ar(r.pts)}</bdi> ${r.mins ? 'همّة (دقائق تدريب)' : 'همّة'}</b><span>⭐ <bdi dir="ltr">+${arDec(r.pts / HM.ratio)}</bdi> شرف</span><small>مجموعك اليوم: ${ar(total)} همّة${total >= HM.dayCap ? ' · بلغت سقف اليوم 🎉' : ''}</small>${newHonor ? '<em>🎉 نقطة شرف جديدة!</em>' : ''}`);
      paintHmBar();
    } catch (e) { console.warn('himma', e); }
  }
  /* --- نقاط الهمّة والشرف أثناء التدريب وبعده --- */
  const HS = { pts: 0, n: 0 };
  if (store.mode === 'local') window.__earnTraining = earnTraining; // للتجارب المحلية فقط
  const arDec = (x) => ar(String(Math.round(x * 10) / 10).replace('.', '٫'));
  /* --- حفظ نقاط الهمّة بلا ضياع: طابور في الجهاز يُرسل ويُعاد إرساله حتى يصل --- */
  const HQ = { err: '', busy: false };
  const hqKey = () => 'hmQ_' + me.id, hlKey = () => 'hmLog_' + me.id;
  const hmQueue = () => pref.get(hqKey(), []);
  function hmEnqueue(day, r) {
    pref.set(hqKey(), [...hmQueue(), { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), day, pts: r.pts, ayat: r.ayat, mins: r.mins, secs: r.secs || 0, t: Date.now() }].slice(-400));
    // سجل محلي بما كُسب ووقته: لعرض «نقاطك الآن» قبل أن تُحدَّث اللوحة
    pref.set(hlKey(), [...pref.get(hlKey(), []).filter((x) => Date.now() - x.t < 40 * 864e5), { t: Date.now(), pts: r.pts }]);
    flushHimma(); window.__honorPaint?.();
  }
  async function flushHimma() {
    if (HQ.busy || !me) return; HQ.busy = true;
    try {
      for (;;) {
        const it = hmQueue()[0]; if (!it) { HQ.err = ''; break; }
        try { await store.logHimma(me.id, it.day, it); }
        catch (e) {
          const c = String(e.code || e.message || '');
          if (/permission|unauthenticated/i.test(c)) {
            // هل المشكلة في الدخول أم في هذا السجل وحده (تجاوز سقف اليوم من جهازين)؟
            const okAuth = await store.logHimma(me.id, it.day, { pts: 0, ayat: 0, mins: 0 }).then(() => true, () => false);
            if (okAuth) { pref.set(hqKey(), hmQueue().filter((x) => x.id !== it.id)); continue; }
            HQ.err = 'auth';
          } else HQ.err = 'net';
          console.warn('himma save', e); break;
        }
        pref.set(hqKey(), hmQueue().filter((x) => x.id !== it.id)); HQ.err = '';
      }
    } finally { HQ.busy = false; paintHmBar(); paintHmWarn(); }
  }
  /** استرجاع ما ضاع قبل الإصدار ٤٠: يقارن حصيلة الجهاز لآخر يوم تدرّب فيه بما في قاعدة البيانات، ويرسل الفرق فقط (لا يزيد على ما سجّله الجهاز) */
  async function recoverHimma() {
    if (!me) return;
    for (const k of Object.keys(localStorage).filter((x) => x.startsWith(`hm_${me.id}_`))) {
      const day = k.slice(`hm_${me.id}_`.length); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      let st; try { st = JSON.parse(localStorage.getItem(k)); } catch { continue; }
      if (!st?.pts) continue;
      let srv; try { srv = await store.getMyHimma(me.id, day); } catch (e) { console.warn('himma recover', e); return; } // الجلسة منتهية: يُعاد بعد الدخول
      const queued = hmQueue().filter((x) => x.day === day), qPts = queued.reduce((n, x) => n + (x.pts || 0), 0), qMins = queued.reduce((n, x) => n + (x.mins || 0), 0);
      const diff = Math.min(st.pts - (srv?.hp || 0) - qPts, 200 - (srv?.hp || 0) - qPts);
      if (diff <= 0) continue;
      const mins = Math.max(0, Math.min(diff, (st.mins || 0) - (srv?.hm || 0) - qMins, 30 - (srv?.hm || 0) - qMins));
      pref.set(hqKey(), [...hmQueue(), { id: 'rc' + Date.now().toString(36), day, pts: diff, ayat: diff - mins, mins, t: Date.now(), rec: 1 }]);
      HQ.recovered = (HQ.recovered || 0) + diff;
    }
    if (HQ.recovered) { flushHimma(); toast(`☁️ استُرجعت ${ar(HQ.recovered)} نقطة همّة من تدريب سابق لم تُحفظ، وأُضيفت إلى رصيدك.`); }
  }
  /** تنبيه ظاهر إن لم تُحفظ النقاط لانتهاء جلسة الدخول */
  function paintHmWarn() {
    let el = $('#hmWarn', app);
    const n = hmQueue().reduce((k, x) => k + (x.pts || 0), 0);
    if (HQ.err !== 'auth' || !n) { el?.remove(); return; }
    if (!el) { const host = $('#stBody', app); if (!host) return; el = document.createElement('div'); el.id = 'hmWarn'; el.className = 'hm-warn'; host.before(el); }
    el.innerHTML = `<b>⚠️ نقاط تدريبك (${ar(n)} همّة) لم تُحفظ بعد</b><span>انتهت جلسة دخولك على هذا الجهاز. سجّل الدخول من جديد، وستُحفظ النقاط المعلّقة تلقائياً ولن تضيع.</span><button type="button" class="btn sm primary" id="hmRelog">سجّل الدخول من جديد</button>`;
    $('#hmRelog', el).onclick = async () => { await store.signOut().catch(() => {}); session.set(null); render(); };
  }
  if (!window.__hqT) { window.__hqT = setInterval(() => { if (hmQueue().length) flushHimma(); }, 60e3); addEventListener('online', () => flushHimma()); }
  /** بطاقة عائمة بعد كل تسميع تدريب */
  function hmPop(html) {
    document.querySelector('.hm-pop')?.remove();
    const el = document.createElement('div'); el.className = 'hm-pop'; el.setAttribute('role', 'status'); el.innerHTML = html;
    document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300);
  }
  /** شريط أعلى التدريب: همّة اليوم، وشرفه، وكم تفصله عن نقطة الشرف التالية */
  function paintHmBar() {
    const el = $('#hmBar', app); if (!el) return;
    const t = himmaToday(me.id, riyadhDay()).pts, cap = t >= HM.dayCap, rem = HM.ratio - (t % HM.ratio);
    el.innerHTML = `<div class="hm-row"><span>🌟 همّتك اليوم <b>${ar(t)}</b><small> / ${ar(HM.dayCap)}</small></span><span>⭐ شرف اليوم <b>${arDec(t / HM.ratio)}</b></span>${HS.pts ? `<button type="button" class="btn sm ghost" id="hmEnd">إنهاء وعرض الملخص</button>` : ''}</div>
      <div class="hm-track"><i style="width:${cap ? 100 : ((t % HM.ratio) / HM.ratio) * 100}%"></i></div>
      ${(() => { const q = hmQueue().reduce((k, x) => k + (x.pts || 0), 0); return q ? `<small class="hm-sync ${HQ.err === 'auth' ? 'bad' : ''}">${HQ.err === 'auth' ? `⚠️ ${ar(q)} همّة لم تُحفظ: سجّل الدخول من جديد` : `⏳ جارٍ حفظ ${ar(q)} همّة…`}</small>` : '<small class="hm-sync ok">☁️ نقاطك محفوظة وتُحسب في لوحة الشرف</small>'; })()}
      <small class="muted">${cap ? '🎉 بلغت سقف اليوم، ما شاء الله! تدريبك بعده لا يزيد النقاط، وعُد غداً.' : `${rem === 1 ? 'نقطة همّة واحدة تفصلك' : rem === 2 ? 'نقطتا همّة تفصلانك' : `${ar(rem)} نقاط همّة تفصلك`} عن نقطة الشرف التالية · كل آية صحيحة (٨٠٪ فأكثر) = نقطة همّة.`}</small>`;
    const b = $('#hmEnd', el); if (b) b.onclick = () => practiceSummary();
  }
  /** ملخص الجلسة عند الخروج من التدريب */
  async function practiceSummary() {
    if (!HS.n) return;
    const s0 = { ...HS }; HS.pts = 0; HS.n = 0; paintHmBar();
    const t = himmaToday(me.id, riyadhDay()).pts;
    let rk = me.rankInfo?.lists?.hm;
    try { rk = (await store.getMyRank(me))?.lists?.hm || rk; } catch {}
    const rkTxt = rk?.ms ? `<div class="hm-sum-rk">🏅 ترتيبك في «صاحب الهمة العالية» هذا الشهر: <b>${ar(rk.ms)}</b> على المقرأة${rk.mc ? `، و<b>${ar(rk.mc)}</b> في صفك` : ''}<small class="muted">حسب آخر تحديث للوحة الشرف، ويُضاف تدريب اليوم عند تحديثها.</small></div>` : '<div class="hm-sum-rk small muted">يظهر ترتيبك في «صاحب الهمة العالية» بعد أن يحدّث معلمك لوحة الشرف.</div>';
    whenModalFree(() => {
      openModal(`<div class="stack hm-sum"><h2 style="margin:0">🎯 ملخص تدريبك</h2>
        <div class="hm-sum-g"><div><b>${ar(s0.n)}</b><span>${s0.n === 1 ? 'تسميع' : s0.n === 2 ? 'تسميعان' : s0.n <= 10 ? 'تسميعات' : 'تسميعاً'}</span></div><div><b dir="ltr">+${ar(s0.pts)}</b><span>🌟 همّة</span></div><div><b dir="ltr">+${arDec(s0.pts / HM.ratio)}</b><span>⭐ شرف</span></div></div>
        <p style="margin:0">مجموعك اليوم: <b>${ar(t)}</b> همّة = <b>${arDec(t / HM.ratio)}</b> نقطة شرف${t >= HM.dayCap ? ' (بلغت السقف 🎉)' : ''}.</p>
        ${s0.pts ? '' : '<p class="small muted" style="margin:0">لم تُحسب نقاط في هذه الجلسة: تُحسب الآية إذا قرأتها بدقة ٨٠٪ فأكثر، وحتى ٣ مرات في اليوم.</p>'}
        ${rkTxt}<div class="row" style="justify-content:center"><button class="btn primary" type="button" data-close>أحسنت، بارك الله فيك</button></div></div>`);
      if (s0.pts) setTimeout(() => confetti(), 150);
    });
  }
  function logAct(kind, sec) {
    const day = riyadhDay();
    const before = streakOf(activeDays()).days;
    const a = (data.activity || []).find((x) => x.d === day);
    if (a) a[kind === 'task' ? 'tasks' : 'practice']++; else (data.activity = data.activity || []).push({ d: day, practice: kind === 'task' ? 0 : 1, tasks: kind === 'task' ? 1 : 0 });
    store.logActivity(me.id, day, kind, sec).catch((e) => console.warn('activity', e));
    const st = streakOf(activeDays());
    const k = $('#kpiStreak', app); if (k) k.innerHTML = `<b>🔥 ${ar(st.days)}</b><span>أيام متتالية</span>`;
    if (st.days > before && before > 0 && !celebrateStreak()) toast(`🔥 سلسلتك الآن ${ar(st.days)} أيام متتالية. أحسنت!`);
    const T = pref.get('actT_' + me.id, []); T.push(Date.now()); pref.set('actT_' + me.id, T.slice(-60));
    setTimeout(() => checkAch(), 800);
  }
  /** احتفال عند ٧ و١٤ و٣٠ يوماً (مرة لكل سلسلة) */
  function showSrNotice() {
    openModal(`<div class="srn">
      <div class="srn-hd"><span class="srn-ic">🎙️</span><span class="srn-tag">مهم</span><h2>لمن لا يتعرّف جواله على الصوت</h2></div>
      <div class="srn-card ok"><span class="srn-e">🎯</span><div><b>التدريبات والتحديات</b><p>تمّ تعديل التعرّف على الصوت، فتظهر لك الكلمات الآن 👏🏻👏🏻</p></div></div>
      <div class="srn-card"><span class="srn-e">📝</span><div><b>التسميعات</b><p>لا يظهر التعرّف، لكن تسجيلك يصل إلى المعلم، وسوف يسمعه ويقيّمك 👏🏻👏🏻</p></div></div>
      <button class="btn primary srn-ok" type="button" id="srnOk">حسناً 👍</button>
      <button class="btn ghost srn-never" type="button" id="srnNever">✓ فهمت، لا تظهرها مرة أخرى</button>
    </div>`, (m) => {
      m.querySelector('#srnOk').onclick = () => closeModal();
      m.querySelector('#srnNever').onclick = () => { pref.set('srNotice2_' + me.id, 1); closeModal(); };
    });
  }
  /* ================= المكافآت: الأوسمة والمتجر وزينة الاسم ================= */
  let RW = null, SHOP = null, achBusy = false;
  const myCoins = () => balance(me.rankInfo?.all?.points || 0, RW?.wallet);
  const bestStreak = (days) => { const L = [...days].sort(); let b = 0, n = 0, prev = null; L.forEach((d) => { n = prev && addDays(prev, 1) === d ? n + 1 : 1; b = Math.max(b, n); prev = d; }); return b; };
  /** ما أنجزه الطالب لشروط الألقاب */
  let iqraN = 0;
  function earnCtx() {
    const days = activeDays(), L = [...days].sort(), dd = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    // العائد بقوة: أطول مواظبة متتالية بدأت بعد انقطاع أسبوع فأكثر
    let back = 0, run = 0, after = false;
    L.forEach((d, i) => { const g = i ? dd(L[i - 1], d) : 0; if (i && g >= 8) { after = true; run = 1; } else if (i && g === 1) run++; else { after = false; run = 1; } if (after) back = Math.max(back, run); });
    // أوقات التسميع: الفجر (بين الفجر والشروق) والليل (بعد العشاء حتى الفجر)
    const T = [...data.subs.map((x) => Date.parse(x.createdAt)), ...pref.get('actT_' + me.id, [])].filter(Boolean);
    const fajr = new Set(), night = new Set();
    T.forEach((t) => { const p = dayTimes(t), d = riyadhDay(new Date(t)); if (t >= p.fajr && t < p.sunrise) fajr.add(d); else if (t >= p.isha) night.add(d); else if (t < p.fajr) night.add(addDays(d, -1)); });
    // جزء عمّ: عدد مرات تسميع كل سورة كاملة بدقة ٨٥٪ فأكثر (أقل آية فيها)
    const amma = [];
    for (let su = 78; su <= 114; su++) {
      const n = ayahCount(su), c = new Array(n + 1).fill(0);
      data.subs.forEach((x) => { if (+x.surah === su && (x.percent ?? 0) >= 85) for (let a = Math.max(1, +x.from || 1); a <= Math.min(n, +x.to || 0); a++) c[a]++; });
      amma.push(n ? Math.min(...c.slice(1)) : 0);
    }
    // مُصحِّح أخطائه: كلمة أخطأ فيها ثم سمّع آيتها بعدها دون خطأ فيها
    const last = new Map();
    data.subs.forEach((x) => (x.mistakes || []).forEach((m) => { const k = `${x.surah}:${m.a}:${m.w}`; if (!last.has(k) || (x.createdAt || '') > last.get(k).at) last.set(k, { at: x.createdAt || '', su: +x.surah, a: m.a }); }));
    let fixed = 0;
    last.forEach((v, k) => { if (data.subs.some((x) => (x.createdAt || '') > v.at && +x.surah === v.su && x.from <= v.a && x.to >= v.a && x.percent != null && !(x.mistakes || []).some((m) => `${x.surah}:${m.a}:${m.w}` === k))) fixed++; });
    const badges = me.rankInfo?._badges || [];
    return {
      days: L.length, streak: bestStreak(days), wins: myCh.filter((c) => chWinner(c) === me.id).length,
      voices: badges.filter((b) => String(b.id || '').startsWith('voice-')).length,
      goldt: shopItems(SHOP).filter((x) => x.kind === 'title' && x.earn && (RW?.ach?.[x.id] || 0) >= 3).length,
      perfect: data.subs.filter((x) => (x.percent ?? 0) >= 100).length, fajr: fajr.size, night: night.size, back, amma,
      brave: myCh.filter((c) => chView(c, me.id).mine).length,
      champ: badges.filter((b) => String(b.id || '').startsWith('hero-')).length,
      top: new Set(notifs.filter((n) => n.type === 'month' && ['stage1', 'cls1'].includes(n.win?.key)).map((n) => n.ym)).size,
      iqra: iqraN, fixed,
    };
  }
  /** مستوى اللقب الذي ناله (لقب قديم بلا مستوى محفوظ = برونزي) */
  const titleLv = (it) => (it.earn ? Math.max(RW.ach?.[it.id] || 0, (RW.owned || []).includes(it.id) ? 1 : 0) : 0);
  /** الألقاب التي تحققت شروطها تُضاف، ويرتقي مستواها (برونزي ← فضي ← ذهبي)، مع تهنئة */
  async function checkTitles() {
    if (iqraOn) iqraN = await store.getIqra(me.id).then((st) => Object.values(st?.mastered || {}).filter((m) => !m.skip).length).catch(() => iqraN);
    const ctx = earnCtx(), own = new Set(RW.owned || []), ach = { ...(RW.ach || {}) }, up = [];
    shopItems(SHOP).filter((x) => x.kind === 'title' && x.earn && !x.hidden).forEach((x) => {
      const old = titleLv(x), lv = earnLevel(x, ctx);
      if (lv > old) { up.push({ t: x, lv, old }); ach[x.id] = lv; own.add(x.id); }
    });
    // الأنوار (وغيرها) التي جعلها المعلم تُنال بإنجاز: مستوى واحد
    shopItems(SHOP).filter((x) => x.kind !== 'title' && x.earn && !x.hidden && !own.has(x.id)).forEach((x) => {
      if (earnLevel(x, ctx) >= 1) { up.push({ t: x, lv: 1, old: 0 }); own.add(x.id); }
    });
    if (!up.length) return;
    const owned = [...own], patch = { owned, ach };
    const worn = up.find((u) => u.t.kind === 'title' && RW.look?.t === u.t.v);
    if (worn) patch.look = { ...RW.look, tl: worn.lv };
    await store.saveRewards(me.id, patch);
    RW = { ...RW, ...patch };
    if (worn) { await store.setMyLook(me.id, RW.look).catch(() => {}); setLook(me.id, RW.look); }
    const { t, lv, old } = up[up.length - 1], isWorn = worn && worn.t === t;
    whenModalFree(() => {
      const isT = t.kind === 'title', why = esc(earnText(t, lv).replace(/^يُختار صوته/, 'اختير صوتك').replace(/^ي/, 'ت').replace(' ثم يواظب', ' ثم تواظب'));
      openModal(`<div class="stack ach-new" style="text-align:center;align-items:center"><div class="ach-big">${isT ? MEDALS[lv - 1] : t.kind === 'glow' ? `<span data-lk="__pv_${esc(t.v)}" style="font-size:24px">${esc(me.name)}</span>` : '🎁'}</div><span class="srn-tag">${isT ? (old ? 'ارتقى لقبك' : 'لقب جديد') : t.kind === 'glow' ? '✨ نور جديد لاسمك' : '🎁 مكافأة جديدة'}</span>
        <h2 style="margin:0">«${esc(isT ? t.v : t.name)}»${isT ? ` · ${esc(LEVELS[lv - 1])}` : ''}</h2><p style="margin:0">نلته لأنك ${why}. ما شاء الله!</p>
        ${!isT ? '' : lv < 3 ? `<p class="small muted" style="margin:0">المستوى التالي ${esc(LEVELS[lv])}: ${esc(earnText(t, lv + 1))}</p>` : '<p class="small" style="margin:0">🏆 بلغت أعلى مستوى!</p>'}
        ${up.length > 1 ? `<p class="small muted" style="margin:0">ومعه ${up.length === 2 ? 'لقب آخر' : ar(up.length - 1) + ' ألقاب أخرى'} في خزانتك</p>` : ''}
        <div class="row" style="justify-content:center">${isWorn ? '' : '<button class="btn primary" type="button" id="ttWear">ضعه تحت اسمي</button>'}<button class="btn" type="button" data-close>${isWorn ? 'الحمد لله' : 'لاحقاً'}</button></div></div>`, (m) => {
        const w = m.querySelector('#ttWear'); if (w) w.onclick = async () => {
          const slot = SLOT[t.kind]; if (!slot) { closeModal(); tab = 'rewards'; draw(); return; }
          const lk = isT ? { ...(RW.look || {}), t: t.v, tl: lv } : { ...(RW.look || {}), [slot]: t.v };
          try { await store.saveRewards(me.id, { look: lk }); await store.setMyLook(me.id, lk).catch(() => {}); RW = { ...RW, look: lk }; setLook(me.id, lk); } catch {}
          closeModal(); tab = 'rewards'; draw();
        };
      });
      setTimeout(() => confetti(), 150);
    });
    if ($('#stBody', app)) draw();
  }
  /** يفتح الأوسمة المستحقة ويضيف مكافآتها، مع احتفال لكل وسام جديد */
  async function checkAch() {
    if (!RW || achBusy) return;
    achBusy = true;
    try {
      await checkTitles().catch((e) => console.warn('titles', e));
      const days = activeDays();
      const lv = achLevels({ streak: streakOf(days).days, best: bestStreak(days), count: data.subs.length, subs: [...data.subs, ...pref.get('actT_' + me.id, []).map((t) => ({ createdAt: new Date(t).toISOString() }))], days, prayer: (t) => dayTimes(t) });
      const old = RW.ach || {}, fresh = [];
      let coins = 0;
      ACH.forEach((a) => { const o = old[a.id] || 0, n = lv[a.id] || 0; if (n > o) { fresh.push({ a, n }); coins += a.coins.slice(o, n).reduce((x, c) => x + c, 0); } });
      if (!fresh.length) return;
      const ach = { ...old }; fresh.forEach(({ a, n }) => (ach[a.id] = n));
      coins = Math.min(coins, 200);
      const wallet = { ...RW.wallet, bonus: (RW.wallet?.bonus || 0) + coins };
      await store.saveRewards(me.id, { ach, wallet });
      RW = { ...RW, ach, wallet };
      const f = fresh[fresh.length - 1];
      whenModalFree(() => {
        openModal(`<div class="stack ach-new" style="text-align:center;align-items:center"><div class="ach-big">${f.a.icon}</div>
          <span class="srn-tag">${f.a.hidden ? '🎁 وسام مخفي اكتشفته!' : '🏅 وسام جديد'}</span>
          <h2 style="margin:0">${esc(f.a.name)}${f.a.at ? ` · ${LEVELS[f.n - 1]}` : ''}</h2><p style="margin:0">${esc(f.a.desc(f.a.at ? f.a.at[f.n - 1] : 0))}</p>
          <p class="ach-coins">+${ar(coins)} 🪙 مكافأة</p>${fresh.length > 1 ? `<p class="small muted" style="margin:0">ومعه ${fresh.length === 2 ? 'وسام آخر' : ar(fresh.length - 1) + ' أوسمة أخرى'} في خزانتك</p>` : ''}
          <div class="row" style="justify-content:center"><button class="btn primary" type="button" id="achGo">افتح خزانتي</button><button class="btn" type="button" data-close>لاحقاً</button></div></div>`, (m) => {
          m.querySelector('#achGo').onclick = () => { closeModal(); tab = 'rewards'; draw(); };
        });
        setTimeout(() => confetti(), 150);
      });
      if ($('#stBody', app)) draw();
    } catch (e) { console.warn('ach', e); } finally { achBusy = false; }
  }
  /* صوت الأسبوع في صفحة الطالب: اسمعه، وقل «ما شاء الله» */
  /* --- الحضور: نبضة كل دقيقة ما دامت الصفحة ظاهرة، ودقائق الاستخدام في كل ساعة --- */
  const HB = { pg: '', since: Date.now(), acc: {}, n: 0, hid: 0 };
  const UA = navigator.userAgent, hbDev = /iPad|Tablet/i.test(UA) ? 't' : /Mobi|Android|iPhone/i.test(UA) ? 'm' : 'd';
  const hbAlive = () => me && /^#\/student/.test(location.hash || '#/student') && $('#stBody', app);
  function hbBeat(minute) {
    if (document.hidden || !hbAlive()) return;
    store.beat(me.id, { cls: me.classId || '', pg: HB.pg || tab, dev: hbDev, since: HB.since }).catch(() => {});
    if (!minute) return;
    const d = new Date(Date.now() + 3 * 3600e3), day = d.toISOString().slice(0, 10), h = String(d.getUTCHours()).padStart(2, '0');
    (HB.acc[day] = HB.acc[day] || {})[h] = (HB.acc[day][h] || 0) + 1;
    if (++HB.n >= 5) hbFlush();
  }
  function hbFlush() { if (!HB.n || !me) return; const a = HB.acc; HB.acc = {}; HB.n = 0; store.addUsage(me.id, me.classId || '', a).catch(() => {}); }
  function hbStart() {
    clearInterval(window.__hbT); clearInterval(window.__onT);
    HB.since = Date.now(); HB.pg = tab; setTimeout(() => hbBeat(true), 1200); // بعد رسم الصفحة
    window.__hbT = setInterval(() => hbBeat(true), 60e3);
    window.__onT = setInterval(paintOnline, 120e3); setTimeout(paintOnline, 2500);
    if (window.__hbVis) document.removeEventListener('visibilitychange', window.__hbVis);
    window.__hbVis = () => {
      if (document.hidden) { HB.hid = Date.now(); hbFlush(); if (me) store.beatOff(me.id).catch(() => {}); }
      else { if (Date.now() - HB.hid > 180e3) HB.since = Date.now(); hbBeat(false); paintOnline(); }
    };
    document.addEventListener('visibilitychange', window.__hbVis);
    addEventListener('pagehide', hbFlush);
    // تنبيه المعلم مرة في اليوم إن كان على الطالب واجبات ناقصة (الخادم يتحقق ويحسب)
    const k = 'onl_' + me.id, today = riyadhDay();
    if (pref.get(k, '') !== today) { pref.set(k, today); notifyOnline(me.id).catch(() => {}); }
  }
  /** «٥ من زملائك يراجعون الآن 🔥» */
  async function paintOnline() {
    const el = $('#onStu', app); if (!el || document.hidden) return;
    try {
      if (!HB.oc || Date.now() - HB.oc.at > 60e3) HB.oc = { at: Date.now(), n: Math.max(0, (await store.onlineCount()) - 1) };
      const n = HB.oc.n;
      el.hidden = !n;
      if (n) el.innerHTML = `<span class="on-dot"></span> ${n === 1 ? 'زميل واحد يراجع' : n === 2 ? 'زميلان يراجعان' : `${ar(n)} ${n <= 10 ? 'من زملائك يراجعون' : 'من زملائك يراجعون'}`} معك الآن 🔥`;
    } catch (e) { console.warn('online', e); }
  }
  let voiceCache = null, voicesCache = null;
  /** صوت هذا الأسبوع وصوت الأسبوع الماضي معاً (الإعجاب للصوت الحالي فقط) */
  async function mountVoiceStu(host) {
    if (!host) return;
    try { voiceCache = voiceCache || (await store.getVoice()); } catch {}
    try { voicesCache = voicesCache || (await store.listVoices()); } catch { voicesCache = []; }
    if (!host.isConnected) return;
    const W0 = weekRange(0).from, W1 = weekRange(1).from, recent = (v) => voiceWk(v) === W0 || voiceWk(v) === W1;
    const cur = voiceCache && (recent(voiceCache) || Date.now() - Date.parse(voiceCache.at) <= 8 * 864e5) ? voiceCache : null;
    // صوت لكل أسبوع (الأحدث اختياراً)، والحالي أولاً
    const seen = new Set(cur ? [voiceWk(cur)] : []);
    const others = (voicesCache || []).filter((v) => v.id !== cur?.id && recent(v)).sort((a, b) => voiceWk(b).localeCompare(voiceWk(a)) || (b.at || '').localeCompare(a.at || '')).filter((v) => { const w = voiceWk(v); if (seen.has(w)) return false; seen.add(w); return true; });
    const L = [...(cur ? [cur] : []), ...others].slice(0, 2).sort((a, b) => voiceWk(b).localeCompare(voiceWk(a))); // هذا الأسبوع أولاً
    if (!L.length) { host.innerHTML = ''; return; }
    const tag = (v) => (voiceWk(v) === W0 ? 'صوت هذا الأسبوع' : voiceWk(v) === W1 ? 'صوت الأسبوع الماضي' : 'صوت الأسبوع');
    const card = (v, i) => {
      const live = v.id === cur?.id, mine = v.pn === me.id, n = Object.keys(v.likes || {}).length, liked = pref.get('vLiked_' + v.id, false);
      return `<div class="voice-card${mine ? ' mine' : ''}${i ? ' sm' : ''}"><div class="vc-ic">🎙️</div><div class="vc-tx"><span class="vc-tag">${tag(v)}</span>
        <b data-lk="${esc(v.pn)}">${esc(v.name)}</b><small>${esc(v.className || '')} · ${esc(v.range || '')}${v.week ? ` · ${esc(v.week)}` : ''}</small></div>
        <div class="vc-act"><button class="btn sm primary" type="button" data-vcp="${i}">▶ استمع</button>
        ${live ? `<button class="btn sm vc-like${liked ? ' on' : ''}" type="button" data-vcl="${i}" ${liked || mine ? 'disabled' : ''}>❤️ ما شاء الله${n ? ` · ${ar(n)}` : ''}</button>` : n ? `<span class="vc-n">❤️ ${ar(n)}</span>` : ''}</div></div>`;
    };
    const au = [];
    const paint = () => {
      host.innerHTML = L.map(card).join('');
      $$('[data-vcp]', host).forEach((b) => (b.onclick = async () => {
        const i = +b.dataset.vcp, v = L[i];
        au.forEach((a, k) => { if (a && k !== i && !a.paused) { a.pause(); const o = host.querySelector(`[data-vcp="${k}"]`); if (o) o.textContent = '▶ استمع'; } });
        if (au[i] && !au[i].paused) { au[i].pause(); b.textContent = '▶ استمع'; return; }
        b.disabled = true; b.textContent = '…';
        try {
          if (!au[i]) { const d = await store.getVoiceAudio(v.id); if (!d) throw new Error('غير متاح'); au[i] = new Audio(`data:${d.mime};base64,${d.b64}`); au[i].onended = () => { b.textContent = '▶ استمع'; }; }
          await au[i].play(); b.textContent = '⏸ إيقاف';
        } catch (x) { toast('تعذر التشغيل: ' + x.message); b.textContent = '▶ استمع'; }
        b.disabled = false;
      }));
      $$('[data-vcl]', host).forEach((b) => (b.onclick = () => {
        const v = L[+b.dataset.vcl];
        pref.set('vLiked_' + v.id, true); v.likes = { ...(v.likes || {}), ['me' + me.id]: true };
        au.forEach((a) => a?.pause()); au.length = 0; paint();
        store.likeVoice(me.id).catch((e) => console.warn('like', e));
      }));
    };
    paint();
  }
  let rwKind = 'frame', rwConfirm = '';
  function drawRewards(body) {
    if (!RW) { body.innerHTML = '<div class="loading">جارٍ التحميل…</div>'; return; }
    const coins = myCoins(), items = shopItems(SHOP).filter((x) => !x.hidden && !(String(x.earn || '').startsWith('iqra') && !iqraOn && !(RW.owned || []).includes(x.id)));
    const owned = new Set(RW.owned || []), look = RW.look || {}, ectx = earnCtx();
    const days = activeDays(), cur = { streak: Math.max(streakOf(days).days, bestStreak(days)), count: data.subs.length };
    const achCard = (a) => {
      const n = RW.ach?.[a.id] || 0;
      if (a.hidden) return n ? `<div class="ach on"><span class="ach-i">${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc())}</small></div>`
        : '<div class="ach off"><span class="ach-i">❓</span><b>وسام مخفي</b><small>اكتشفه بنفسك!</small></div>';
      const next = a.at[n];
      return `<div class="ach ${n ? 'on l' + n : 'off'}"><span class="ach-i">${a.icon}</span><b>${esc(a.name)}</b><small>${n ? LEVELS[n - 1] : 'لم يُفتح بعد'}</small>
        ${next ? `<div class="ach-bar"><i style="width:${Math.min(100, Math.round((cur[a.id] / next) * 100))}%"></i></div><small class="muted">${ar(Math.min(cur[a.id], next))} / ${ar(next)} · التالي ${LEVELS[n]}</small>` : '<small>🏆 أعلى مستوى</small>'}</div>`;
    };
    const myBadges = [...(me.rankInfo?._badges || []), ...items.filter((x) => x.kind === 'badge' && owned.has(x.id)).map((x) => ({ icon: x.v || '🏅', label: x.name, color: x.color }))];
    const preview = (it) => it.kind === 'glow' ? `<span data-lk="__pv_${esc(it.v)}">${esc(me.name)}</span>` : it.kind === 'frame' ? `<span class="lk lk-f-${esc(it.v)}">${esc(me.name)}</span>` : it.kind === 'title' ? `<span class="lk-t" style="display:inline-block">${esc(it.v)}</span>`
      : it.kind === 'color' ? `<b style="color:${esc(it.v)}">${esc(me.name)}</b>` : it.kind === 'icon' || it.kind === 'badge' ? `<span style="font-size:30px">${esc(it.v || '🏅')}</span>` : `<span style="font-size:28px">${it.v === 'stars' ? '⭐✨' : it.v === 'moon' ? '🌙✨' : '🎆🎇'}</span>`;
    const card = (it) => {
      const has = owned.has(it.id), slot = SLOT[it.kind], worn = slot && look[slot] === it.v, can = meetsNeed(it, RW.ach), pr = it.earn && (it.kind === 'title' || !has) ? earnProgress(it, ectx) : null, tl = it.kind === 'title' ? titleLv(it) : 0;
      const prog = pr && pr.next ? `<small class="muted">${has ? `التالي ${LEVELS[pr.next - 1]}: ` : it.kind === 'title' ? '🔒 ' : '🏆 يُنال: '}${esc(pr.txt)}</small><div class="ach-bar"><i style="width:${Math.round((pr.have / pr.need) * 100)}%"></i></div><small class="muted">${ar(pr.have)} / ${ar(pr.need)}${pr.unit ? ' ' + pr.unit : ''}</small>` : '';
      const btn = has ? (it.earn && tl ? `<span class="tl-lv tl${tl}">${esc(LEVELS[tl - 1])}</span>` : '') + (slot ? `<button class="btn sm ${worn ? 'primary' : ''}" type="button" data-wear="${esc(it.id)}">${worn ? '✓ مستخدَم' : 'استخدِم'}</button>` : '<span class="pill ok">✓ لك</span>') + (pr && !pr.next ? '<small>🏆 أعلى مستوى</small>' : prog)
        : pr ? prog
        : it.grantOnly ? '<span class="small muted">🎖️ يمنحه المعلم</span>'
        : !can ? `<span class="small muted">🔒 ${esc(it.needTxt || 'يُفتح بوسام المداوم الذهبي')}</span>`
        : rwConfirm === it.id ? `<button class="btn sm primary" type="button" data-buy="${esc(it.id)}">تأكيد الشراء بـ ${ar(it.price)} 🪙</button>`
        : `<button class="btn sm" type="button" data-pre="${esc(it.id)}" ${coins < it.price ? 'disabled' : ''}>${it.price ? `اشترِ · ${ar(it.price)} 🪙` : 'احصل عليه'}</button>${coins < it.price ? `<small class="muted">ينقصك ${ar(it.price - coins)}</small>` : ''}`;
      return `<div class="shop-it${has ? ' own' : ''}${it.rare ? ' rare' : ''}"><div class="shop-pv">${preview(it)}</div><b>${esc(it.name)}</b>${btn}</div>`;
    };
    const kinds = Object.keys(KINDS).filter((k) => items.some((x) => x.kind === k));
    if (!kinds.includes(rwKind)) rwKind = kinds[0] || 'frame';
    const hasLook = Object.keys(look).some((k) => look[k] && k !== 'pn');
    body.innerHTML = `<div class="stack" style="gap:16px">
      <div class="card rw-head"><div><span class="small muted">رصيدك</span><div class="rw-coins">🪙 ${ar(coins)}</div><small class="muted">تكسب مكافأة مع كل نقطة في لوحة الشرف، وأكثر مع الأوسمة. الشراء لا ينقص نقاطك ولا ترتيبك.</small></div>
        <div class="rw-me"><span class="small muted">اسمك كما يراه الجميع</span><div class="rw-name"><span data-lk="${esc(me.id)}">${esc(me.name)}</span></div>${hasLook ? '<button class="btn sm ghost" type="button" id="rwPlain">بلا زينة</button>' : ''}</div></div>
      <div class="card stack"><h3>🏅 أوسمتي</h3><div class="ach-grid">${ACH.map(achCard).join('')}</div>
        ${myBadges.length ? `<div class="badges">${myBadges.map((b) => `<span class="badge-pill" style="--bc:${esc(b.color || '#a77a1c')}">${esc(b.icon || '🏅')} ${esc(b.label)}</span>`).join('')}</div>` : ''}</div>
      <div class="card stack"><h3>🛍️ المتجر</h3>
        <div class="seg shop-tabs" role="tablist">${kinds.map((k) => `<button type="button" role="tab" class="${k === rwKind ? 'on' : ''}" data-rk="${k}">${KINDS[k]}</button>`).join('')}</div>
        <div class="shop-grid">${items.filter((x) => x.kind === rwKind).map(card).join('') || '<p class="muted">لا شيء هنا بعد.</p>'}</div></div></div>`;
    $$('[data-rk]', body).forEach((b) => (b.onclick = () => { rwKind = b.dataset.rk; rwConfirm = ''; drawRewards(body); }));
    $$('[data-pre]', body).forEach((b) => (b.onclick = () => { rwConfirm = b.dataset.pre; drawRewards(body); }));
    $$('[data-buy]', body).forEach((b) => (b.onclick = async () => {
      const it = items.find((x) => x.id === b.dataset.buy); if (!it || myCoins() < (it.price || 0)) return;
      b.disabled = true;
      const wallet = { ...RW.wallet, spent: (RW.wallet?.spent || 0) + (it.price || 0) }, ow = [...new Set([...(RW.owned || []), it.id])];
      try { await store.saveRewards(me.id, { wallet, owned: ow }); RW = { ...RW, wallet, owned: ow }; rwConfirm = ''; toast(`🎉 صار «${it.name}» لك!`); confetti(); draw(); }
      catch (e) { b.disabled = false; toast('تعذر الشراء: ' + (e.code || e.message)); }
    }));
    const saveLook = async (lk) => {
      try { await store.saveRewards(me.id, { look: lk }); await store.setMyLook(me.id, lk).catch((e) => console.warn('look', e)); RW = { ...RW, look: lk }; FX.kind = lk.x || ''; setLook(me.id, lk); drawRewards(body); }
      catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
    };
    $$('[data-wear]', body).forEach((b) => (b.onclick = () => {
      const it = items.find((x) => x.id === b.dataset.wear); if (!it) return;
      const slot = SLOT[it.kind], lk = { ...(RW.look || {}) };
      if (lk[slot] === it.v) { delete lk[slot]; if (slot === 't') delete lk.tl; } else { lk[slot] = it.v; if (slot === 't') { if (it.earn) lk.tl = titleLv(it); else delete lk.tl; } }
      saveLook(lk); if (it.kind === 'fx' && lk.x) playFx(lk.x);
    }));
    const pl = $('#rwPlain', body); if (pl) pl.onclick = () => saveLook({});
  }
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
  let notifs = [], offNotifs = null, knownTasks = new Set(), loadedAt = '';
  const deep = location.hash.match(/^#\/student\/(task|grade|retake|ann|month|fb|challenge|khatma|hero)\/([\w-]+)/);
  let openKhId = deep && deep[1] === 'khatma' ? deep[2] : null;
  let myKh = [];
  let openChId = deep && deep[1] === 'challenge' ? deep[2] : null;
  let myCh = [], chCfg = { off: false };
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
      ${n.hasImage || n.hasVoice || n.poll || n.act ? `<button class="btn sm gold" type="button" data-annopen="${esc(n.annId)}">${n.hasImage ? '📷 ' : ''}${n.hasVoice ? '🎙️ ' : ''}${n.poll ? '📊 ' : ''}افتح</button>` : ''}<button class="btn sm primary" type="button" data-ack="${esc(n.annId)}">فهمت</button></div>`).join('');
    $$('[data-ack]', host).forEach((b) => (b.onclick = () => ackAnn(b.dataset.ack)));
    $$('[data-annopen]', host).forEach((b) => (b.onclick = () => openAnn(b.dataset.annopen)));
  }
  /** استطلاع الإعلان: يختار الطالب خياراً (ويستطيع تغييره) */
  async function mountPoll(host, n) {
    if (!host) return;
    const k = 'vote_' + n.annId; let mine = pref.get(k, null);
    const paint = () => {
      host.innerHTML = `<b>📊 ${esc(n.poll.q)}</b><div class="poll-opts">${n.poll.opts.map((o, i) => `<button type="button" class="btn${mine === i ? ' primary' : ''}" data-vo="${i}">${mine === i ? '✓ ' : ''}${esc(o)}</button>`).join('')}</div>
        <small class="muted">${mine == null ? 'اختر إجابتك، ويراها معلمك.' : 'وصل اختيارك إلى معلمك. يمكنك تغييره.'}</small>`;
      $$('[data-vo]', host).forEach((b) => (b.onclick = async () => {
        const i = +b.dataset.vo; if (i === mine) return;
        $$('[data-vo]', host).forEach((x) => (x.disabled = true));
        try { await store.voteAnn(n.annId, me.id, i); mine = i; pref.set(k, i); toast('✓ وصل اختيارك.'); } catch (e) { toast('تعذر الإرسال: ' + (e.code || e.message)); }
        paint();
      }));
    };
    paint();
    if (mine == null) { const v = await store.getMyVote(n.annId, me.id).catch(() => null); if (v != null) { mine = v; pref.set(k, v); paint(); } }
  }
  /** إعلان «صفحة منبثقة» لم يقرأه: يظهر في وسط الشاشة فور الفتح (الأقدم أولاً) */
  function checkPopAnn() {
    if (!$('#stBody', app) || openAnn.pending) return;
    const acked = new Set(pref.get(ackKey, [])), pop = anns().filter((n) => n.popup && !acked.has(n.annId)).pop();
    if (!pop) return;
    openAnn.pending = true;
    whenModalFree(() => { openAnn.pending = false; if ($('#stBody', app) && !new Set(pref.get(ackKey, [])).has(pop.annId)) openAnn(pop.annId, true); setTimeout(checkPopAnn, 800); });
  }
  function openAnn(aid, pop = false) {
    const n = anns().find((x) => x.annId === aid);
    if (!n) return toast('هذا الإعلان لم يعد موجوداً.');
    openModal(`<div class="stack${pop || n.popup ? ' ann-pop' : ''}">${pop || n.popup ? '<div class="ann-pop-ic">📢</div><span class="ann-pop-tag">إعلان من معلمك</span>' : ''}<h2>${pop || n.popup ? '' : '📢 '}${esc((n.title || '').replace(/^📢\s*/, ''))}</h2><p style="margin:0;white-space:pre-wrap;line-height:2">${esc(n.body || '')}</p>
      ${n.hasImage && (n.imgN || 1) > 1 ? '<div class="ann-album" id="annAlb"></div>' : n.hasImage ? '<div class="ann-img" id="annImg"><div class="loading">جارٍ تحميل الصورة…</div></div>' : ''}
      ${n.hasVoice ? '<div id="annVo"></div>' : ''}${n.poll ? '<div class="ann-poll" id="annPoll"></div>' : ''}
      <small class="muted">${esc(timeAgo(n.createdAt))}</small><div class="row">${n.act ? `<button class="btn gold" type="button" id="annAct">${esc(n.act.label)}</button>` : ''}<button class="btn primary" type="button" data-close>فهمت</button></div></div>`, (m) => {
      if (n.hasVoice) mountAnnVoice($('#annVo', m), aid, n.voiceSec);
      if (n.poll) mountPoll($('#annPoll', m), n);
      const ab = $('#annAct', m); if (ab) ab.onclick = () => {
        closeModal();
        if (n.act.k === 'url') { if (/^https:\/\//.test(n.act.url || '')) window.open(n.act.url, '_blank', 'noopener'); return; }
        if (n.act.k === 'iqra' && !iqraOn) return toast('«اقرأ وارتقِ» غير مفعّل لك.');
        tab = n.act.k; draw(); scrollTo(0, 0);
      };
      if (n.hasImage && (n.imgN || 1) > 1) { mountAlbum($('#annAlb', m), aid, n.imgN); return; }
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
      <h2>${n.type === 'season' ? `${esc(n.icon || '🏆')} نتائجك في ${esc(n.label || '')}` : n.round ? `🏁 نتائجك في ${esc(n.label || '')}` : `نتائج شهرك · ${esc(n.label || '')}`}</h2>
      ${w ? `<div class="month-win"><div class="mw-badge">${rankBadge(w.rank)}</div><div><b>${esc(w.key === 'stage1' ? 'شيخ المرحلة' : w.key === 'cls1' ? 'قارئ الصف' : w.title)}</b><span>${esc(w.line)}. ما شاء الله تبارك الله!</span></div></div>` : `<p style="margin:0">${esc(n.body || '')}</p>`}
      <div class="usage-grid">
        ${tile('ترتيبك في الصف', r.cls ? `${ar(r.cls)} من ${ar(r.clsOf)}` : '—')}
        ${tile('على المرحلة', r.stage ? `${ar(r.stage)} من ${ar(r.stageOf)}` : '—')}
        ${tile('نقاطك', fmt10(r.points || 0), n.type === 'season' ? 'نقاط الموسم' : 'مجموع أفضل درجاتك في الواجبات')}
        ${n.type === 'season' ? '' : tile('أطول سلسلة', `🔥 ${ar(n.streak || 0)}`, ((k) => (k === 0 ? 'لا أيام بعد' : k === 1 ? 'يوم واحد' : k === 2 ? 'يومان متتاليان' : k <= 10 ? 'أيام متتالية' : 'يوماً متتالياً'))(n.streak || 0))}
        ${cp && cp.pos ? tile('صفك في التحدي', `${ar(cp.pos)} من ${ar(cp.of)}`, esc(n.className || '')) : ''}
      </div>
      ${w ? `<div class="row"><button class="btn gold" type="button" id="cfPng">🏅 حمّل شهادتك (صورة)</button><button class="btn" type="button" id="cfPdf">PDF</button></div>` : ''}
      <div class="row"><button class="btn primary" type="button" data-close>${w ? 'الحمد لله' : 'سأجتهد بإذن الله'}</button></div></div>`, (m) => {
      if (!w) return;
      const cert = { ym: n.ym, name: me.name, title: w.title, line: w.line, rank: w.rank, month: n.label, points: r.points, className: n.className, teacher: n.teacher, ...(n.type === 'season' ? { season: n.label, period: `في ${n.label}`, color: n.color } : {}), date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) };
      $('#cfPng', m).onclick = (e) => { e.currentTarget.disabled = true; downloadCertificatePNG(cert).catch((x) => toast(x.message)).finally(() => (e.currentTarget.disabled = false)); };
      $('#cfPdf', m).onclick = (e) => { const b = e.currentTarget; b.disabled = true; downloadCertificatesPDF([cert], `certificate-${n.ym}.pdf`).catch((x) => toast(x.message)).finally(() => (b.disabled = false)); };
    });
    if (w) setTimeout(() => confetti(), 150);
  }
  /* --- بطولة الأبطال --- */
  let heroT = null, hM = [], offHero = null, offLive = null, hView = null, heroPend = null, offCheer = null;
  let iqraOn = false, offIqra = null, offHonor = null;
  const stopCheer = () => { offCheer?.(); offCheer = null; };
  if (deep && deep[1] === 'hero') heroPend = deep[2];
  async function loadHeroes() {
    try {
      const L = (await store.listTourneys()).filter((x) => x.status === 'running' || (x.doneAt && Date.now() - new Date(x.doneAt) < 14 * 864e5) || x.status === 'done').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const had = !!heroT; heroT = L[0] || null;
      if (!heroT) return;
      offHero?.(); offHero = store.watchMatches(heroT.id, (ms) => {
        hM = ms; paintHeroBar();
        if (tab === 'heroes' && $('#stBody', app) && !hView) drawHeroes($('#stBody', app));
        if (hView?.refresh) hView.refresh();
      });
      if (!had && $('#stBody', app)) draw();
      if (heroPend) { const id = heroPend; heroPend = null; setTimeout(() => openMatch(id), 600); }
    } catch (e) { console.warn('heroes', e); }
  }
  const myMatch = () => hM.filter((m) => !m.done && !m.bye && sideOf(m, me.id)).sort((a, b) => b.round - a.round)[0];
  function paintHeroBar() {
    const host = $('#heroBar', app); if (!host) return;
    const m = heroT?.status === 'running' && myMatch();
    if (!m || tab !== 'tasks') { host.innerHTML = ''; return; }
    const side = sideOf(m, me.id), other = side === 'a' ? m.b : m.a, mine = side === 'a' ? m.ra : m.rb;
    const when = m.live ? (m.startAt ? `📺 مباشرة ${fmtTimeOf(m.startAt)}` : 'مباراة مباشرة، ينتظر تحديد الموعد') : `حتى ${fmtTimeOf(m.deadline)}`;
    host.innerHTML = `<div class="hero-bar"><span class="hb-ico">🏆</span><div><b>الأبطال: ${mine ? 'سلّمت، بانتظار' : 'مباراتك ضد'} ${esc(other.name)}</b><span class="small">${esc(hRange(m))} · ${esc(when)}</span></div><button class="btn sm gold" type="button" id="hbGo">${mine ? 'المباراة' : 'ابدأ'}</button></div>`;
    $('#hbGo', host).onclick = () => openMatch(m.id);
  }
  const fmtTimeOf = (iso) => { try { return ar(new Date(iso).toLocaleString('ar', { weekday: 'long', hour: 'numeric', minute: '2-digit' })); } catch { return ''; } };
  let hTab = null;
  function drawHeroes(body) {
    if (!heroT) { body.innerHTML = '<div class="empty">لا توجد بطولة الآن.</div>'; return; }
    const m = myMatch();
    const lost = hM.find((x) => x.done && !x.bye && sideOf(x, me.id) && x.winner !== me.id);
    const lives = hM.filter((x) => x.live && !x.done && x.startAt);
    const myStage = hM.some((x) => x.stage === 'inter') ? 'inter' : 'class';
    hTab = hTab || (myStage === 'inter' ? 'inter' : me.classId);
    const clsIds = heroT.classIds || [];
    body.innerHTML = `<div class="heroes stack">
      <div class="hero-top"><div><h2 style="margin:0">🏆 ${esc(heroT.name || 'الأبطال')}</h2><span class="small muted">${esc(stageLabel(heroT, hM))}</span></div></div>
      ${heroT.status === 'done' && heroT.champion ? `<div class="hero-champ"><div class="hc-cup">🏆</div><div><span class="small">بطل الأبطال</span><b>${esc(heroT.champion.name)}</b>${heroT.runnerUp ? `<span class="small">الوصيف: ${esc(heroT.runnerUp.name)}</span>` : ''}${heroT.third ? `<span class="small">المركز الثالث: ${esc(heroT.third.name)}</span>` : ''}</div></div>` : ''}
      ${m ? (() => { const side = sideOf(m, me.id), other = side === 'a' ? m.b : m.a, mine = side === 'a' ? m.ra : m.rb; return `<div class="card hero-my"><b>⚔️ مباراتك${m.live ? ' المباشرة' : ''}: ضد ${esc(other.name)}</b><span>${esc(hRange(m))}${m.tb ? ` · جولة فاصلة ${ar(m.tb)}` : ''}</span>
        <span class="small muted">${m.live ? (m.startAt ? `تبدأ ${fmtTimeOf(m.startAt)}، ولديك ${ar(LIVE_MIN)} دقائق للتسليم` : 'ينتظر أن يحدد المعلم موعدها') : `آخر موعد ${fmtTimeOf(m.deadline)}`}</span>
        <button class="btn primary" type="button" data-om="${esc(m.id)}">${mine ? 'نتيجتي' : 'ادخل المباراة'}</button></div>`; })() : heroT.status === 'running' ? `<div class="card hero-my">${lost ? `<b>انتهت مشاركتك في الدور ${ar(lost.round)} 🌟</b><span class="small muted">بارك الله فيك. تابع المنافسة وشجّع زملاءك!</span>` : '<b>بانتظار الدور القادم…</b>'}</div>` : ''}
      ${lives.length ? `<div class="card stack" style="gap:8px"><b>📺 مباريات مباشرة</b>${lives.map((x) => `<div class="row" style="justify-content:space-between"><span>${esc(x.a.name)} ⚔️ ${esc(x.b.name)} <small class="muted">${fmtTimeOf(x.startAt)}</small></span><button class="btn sm gold" type="button" data-watch="${esc(x.id)}">شاهد</button></div>`).join('')}</div>` : ''}
      <div class="hero-tabs">${clsIds.map((c) => `<button type="button" class="chip${hTab === c ? ' on' : ''}" data-ht="${esc(c)}">${esc(data.classes.find((x) => x.id === c)?.name || '')}</button>`).join('')}<button type="button" class="chip${hTab === 'inter' ? ' on' : ''}" data-ht="inter">🌍 النخبة</button></div>
      ${bracketHtml(hM, { stage: hTab === 'inter' ? 'inter' : 'class', classId: hTab, me: me.id })}
      <p class="small muted" style="margin:0">التقييم آلي فقط بدقة الكلمات، ولا يتدخل المعلم. فرق أقل من ١٪ تعادل تُعاد فيه المباراة بمقطع آخر. ${heroT.pool?.length ? 'لكل متنافسَين مقطعهما يختاره البرنامج من سور البطولة، ومقطع النصف والثالث والنهائي مفاجأة يُكشف لحظة البدء. ' : ''}النصف والنهائي${heroT.pool?.length ? ' ومباراة المركز الثالث' : ''} مباشرة (${ar(LIVE_MIN)} دقائق) ويُخصم فيها ${ar(AI_PENALTY)} لكل ملاحظة تجويد آلية (حتى ${ar(AI_MAX)}).</p></div>`;
    $$('[data-om]', body).forEach((b) => (b.onclick = () => openMatch(b.dataset.om)));
    $$('[data-watch]', body).forEach((b) => (b.onclick = () => watchMatch(b.dataset.watch)));
    $$('[data-ht]', body).forEach((b) => (b.onclick = () => { hTab = b.dataset.ht; drawHeroes(body); }));
    $$('.hb-m[data-mid]', body).forEach((b) => (b.onclick = () => { const x = hM.find((y) => y.id === b.dataset.mid); if (x && !x.bye) (sideOf(x, me.id) && !x.done ? openMatch : watchMatch)(x.id); }));
  }
  /** صفحة المباراة: تسميع غيباً (أو تلاوة نظراً إن اختارها المعلم للبطولة) بمحاولة واحدة، والنتيجة آلية */
  function openMatch(mid) {
    const m = hM.find((x) => x.id === mid); if (!m) return toast('المباراة غير موجودة.');
    const side = sideOf(m, me.id); if (!side || m.done) return watchMatch(mid);
    const mine = side === 'a' ? m.ra : m.rb;
    if (mine) return watchMatch(mid);
    comp?.destroy(); comp = null; offLive?.(); stopCheer();
    const other = side === 'a' ? m.b : m.a;
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="hmBack" type="button">→ رجوع</button><h1>⚔️ ${esc(me.name)} ضد ${esc(other.name)}</h1><p class="muted" style="margin:4px 0 0">${esc(heroT.name || 'الأبطال')} · ${esc(hRange(m))}</p></div></div><div id="hmBody"></div>`;
    const back = () => { comp?.destroy(); comp = null; hView = null; offLive?.(); stopCheer(); tab = 'heroes'; draw(); };
    $('#hmBack', app).onclick = back;
    const body = $('#hmBody', app);
    hView = { refresh: () => { const x = hM.find((y) => y.id === mid); if (x && (x.surah !== m.surah || x.from !== m.from || x.tb !== m.tb)) openMatch(mid); } };
    const startMs = m.startAt ? new Date(m.startAt).getTime() : 0, endMs = startMs + LIVE_MIN * 60e3;
    if (!hasRecognition) { body.innerHTML = '<div class="notice">التصحيح الآلي غير متاح في هذا المتصفح. افتح المقرأة في Chrome أو Safari الحديث لتخوض المباراة.</div>'; return; }
    if (m.live && (!m.startAt || Date.now() < startMs)) {
      body.innerHTML = `<div class="card stack hero-wait"><b>📺 مباراة مباشرة</b><p style="margin:0">${m.startAt ? `تبدأ ${fmtTimeOf(m.startAt)}. ابقَ في هذه الصفحة، وسيُفتح التسميع تلقائياً.` : 'لم يحدد المعلم الموعد بعد.'}</p><div class="hero-count" id="hmCount"></div></div><div id="hmCheer" class="card" style="margin-top:12px"></div>`;
      // يرى المتنافس تشجيع زملائه قبل البدء فقط، ويُخفى أثناء تلاوته
      offCheer = mountCheer($('#hmCheer', body), { tid: heroT.id, m, me, canSend: false, title: false });
      const tick = () => { const s = Math.max(0, Math.round((startMs - Date.now()) / 1000)); const el = $('#hmCount', body); if (!el) return clearInterval(iv); el.textContent = m.startAt ? `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0'))}` : ''; if (m.startAt && s <= 0) { clearInterval(iv); openMatch(mid); } };
      const iv = setInterval(tick, 500); tick(); return;
    }
    stopCheer();
    if (m.live && Date.now() > endMs) { body.innerHTML = '<div class="notice">انتهت نافذة المباراة.</div>'; return; }
    body.innerHTML = `<div class="notice" style="margin-bottom:12px">🎯 ${heroT.mode === 'recite' ? '📖 تلاوة نظراً (النص أمامك)' : '🙈 تسميع غيباً'} بلا تلميح، <b>محاولة واحدة</b> تُحتسب عند الإيقاف. ${m.live ? `أمامك حتى ${fmtTimeOf(new Date(endMs).toISOString())} (${ar(LIVE_MIN)} دقائق)، ويُحلَّل تجويدك آلياً ويُخصم ${ar(AI_PENALTY)} لكل ملاحظة.` : 'النتيجة بدقة الكلمات الآلية فقط.'}</div>${m.live ? '<div class="hero-count live" id="hmLeft"></div>' : ''}<div id="hmRc"></div>`;
    if (m.live) { const iv = setInterval(() => { const el = $('#hmLeft', body); if (!el) return clearInterval(iv); const s = Math.max(0, Math.round((endMs - Date.now()) / 1000)); el.textContent = `⏱ ${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0'))}`; }, 500); }
    let liveT = 0;
    comp = mountRecite($('#hmRc', body), {
      surah: m.surah, from: m.from, to: m.to, mode: heroT.mode === 'recite' ? 'recite' : 'hifz', lockMode: true, noHint: true, noAi: true, noListen: true, capCheck: true,
      maxSeconds: m.live ? Math.max(30, Math.round((endMs - Date.now()) / 1000)) : 600,
      confirmStart: 'محاولة واحدة فقط تُحتسب عند الإيقاف. هل أنت مستعد؟',
      onActivity: (sec) => logAct('practice', sec),
      onLive: m.live ? (res) => { const now = Date.now(); if (now - liveT < 1500) return; liveT = now; store.setLive(heroT.id, m.id, side, { done: res.done, total: res.total, ok: res.counts?.correct || 0, on: true }).catch(() => {}); } : null,
      onFinal: (sub, blob, dur) => setTimeout(() => submitMatch(m, side, sub, blob, dur, body), 0),
    });
  }
  async function submitMatch(m, side, sub, blob, dur, body) {
    comp?.destroy(); comp = null;
    // قرأ لكن الجهاز لم يتعرف على كلامه: لا يُعطى صفراً، بل يذهب تسجيله إلى المعلم ليضع النتيجة
    if (sub.percent == null && blob && dur >= 5) {
      body.innerHTML = '<div class="loading">جارٍ إرسال تسجيلك إلى المعلم…</div>';
      try {
        if (m.live) store.setLive(heroT.id, m.id, side, { done: 1, total: 1, ok: 0, on: false, fin: true }).catch(() => {});
        await store.saveMatchAudio(heroT.id, `${m.id}_${side}_${m.tb || 0}`, blob);
        const r = { pend: 1, p: null, s: null, wpm: 0, dur: Math.round(dur || 0), at: new Date().toISOString(), why: sub.why || '', dev: { os: sub.dev?.os || '', br: sub.dev?.br || '' } };
        await store.updateMatch(heroT.id, m.id, { [side === 'a' ? 'ra' : 'rb']: r });
        notifyReview({ kind: 'm', tid: heroT.id, id: m.id, side: side === 'a' ? 'ra' : 'rb' }).catch(() => {});
        toast('لم يتعرف جهازك على كلامك، فأُرسل تسجيلك إلى المعلم ليقيّمه بنفسه.');
        watchMatch(m.id, r);
      } catch (e) { body.innerHTML = `<div class="notice">تعذر الإرسال: ${esc(e.code || e.message)}</div>`; }
      return;
    }
    const p = sub.percent == null ? 0 : sub.percent;
    let ai = null, pen = 0;
    if (m.live) {
      store.setLive(heroT.id, m.id, side, { done: 1, total: 1, ok: 0, on: false, fin: true }).catch(() => {});
      body.innerHTML = '<div class="card stack"><b>🤖 جارٍ تحليل التجويد آلياً (إلزامي في هذه المرحلة)…</b><div class="small" id="hmAi"></div><div class="progress"><i class="indet"></i></div></div>';
      if (blob && aiEnabled()) {
        for (let k = 0; k < 2 && !ai; k++) { try { ai = await aiAnalyze(blob, { surah: m.surah, from: m.from, to: m.to }, (x) => { const el = $('#hmAi', body); if (el) el.textContent = x; }); } catch (e) { console.warn('ai', e); } }
      }
      pen = ai ? Math.min(AI_MAX, (ai.errors?.length || 0) * AI_PENALTY) : 0;
      if (blob) store.saveMatchAudio(heroT.id, `${m.id}_${side}_${m.tb || 0}`, blob).catch(() => {});
    }
    const r = { p, s: Math.max(0, Math.round((p - pen) * 10) / 10), wpm: sub.wpm || 0, dur: Math.round(dur || 0), at: new Date().toISOString(), ...(m.live ? { ai: ai ? ai.errors.length : null, pen } : {}) };
    body.innerHTML = '<div class="loading">جارٍ حفظ نتيجتك…</div>';
    try { await store.updateMatch(heroT.id, m.id, { [side === 'a' ? 'ra' : 'rb']: r }); } catch (e) { body.innerHTML = `<div class="notice">تعذر حفظ النتيجة: ${esc(e.code || e.message)}</div>`; return; }
    const x = { ...m, [side === 'a' ? 'ra' : 'rb']: r };
    recordProgress({ ...sub, surah: m.surah, from: m.from, to: m.to });
    // تعادل: يعيد المباراة بمقطع آخر من سلّم أخيراً
    if (x.ra && x.rb && matchWinner(x) === 'tie') {
      const nx = tiebreak(x, heroT, [...heroUsed(hM, x.a.pn), ...heroUsed(hM, x.b.pn)]);
      try { await store.updateMatch(heroT.id, m.id, { ra: null, rb: null, tb: (x.tb || 0) + 1, hist: [...(x.hist || []), { surah: x.surah, from: x.from, to: x.to, ra: x.ra, rb: x.rb }], ...nx, ...(x.live ? { startAt: new Date(Date.now() + 60e3).toISOString() } : { deadline: new Date(Date.now() + 24 * 3600e3).toISOString() }) }); } catch (e) { console.warn('tie', e); }
      toast(`🤝 تعادل! جولة فاصلة في ${hRange({ ...x, ...nx })}`);
    }
    watchMatch(m.id, r);
  }
  /** متابعة مباراة: السباق المباشر، ثم النتيجة وإعادة الاستماع */
  function watchMatch(mid, fresh = null) {
    comp?.destroy(); comp = null; offLive?.(); stopCheer();
    const box = document.createElement('div');
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="hwBack" type="button">→ رجوع</button><h1 id="hwT"></h1><p class="muted" id="hwS" style="margin:4px 0 0"></p></div></div><div id="hwBody"></div><div id="hwCheer" class="card" style="margin-top:12px" hidden></div>`;
    $('#hwBack', app).onclick = () => { hView = null; offLive?.(); stopCheer(); tab = 'heroes'; draw(); };
    // التشجيع في المباريات المباشرة: يرسله كل طلاب المدرسة ويراه الجمهور؛ المتنافس يراه قبل البدء فقط
    const cheerOn = () => { const x = hM.find((y) => y.id === mid); if (!x?.live || x.done || !x.b) return false; return !sideOf(x, me.id) || !x.startAt || Date.now() < new Date(x.startAt).getTime(); };
    const syncCheer = () => { const host = $('#hwCheer', app); if (!host) return; const on = cheerOn(); if (on && !offCheer) { host.hidden = false; const x = hM.find((y) => y.id === mid); offCheer = mountCheer(host, { tid: heroT.id, m: x, me, canSend: !sideOf(x, me.id) }); } else if (!on && offCheer) { stopCheer(); host.hidden = true; } };
    let live = {};
    const paint = () => {
      const m = hM.find((x) => x.id === mid); if (!m) return;
      $('#hwT', app).textContent = `${m.a.name} ⚔️ ${m.b?.name || ''}`;
      $('#hwS', app).textContent = `${hRange(m)}${m.tb ? ` · جولة فاصلة ${ar(m.tb)}` : ''}`;
      const w = m.done ? m.winner : null;
      const lane = (p, r, side) => { const L = live[side] || {}; const pct = r ? 100 : L.total ? Math.round((L.done / L.total) * 100) : 0; const acc = r ? r.s : L.done ? Math.round((L.ok / Math.max(1, L.done)) * 100) : 0;
        return `<div class="race-lane${w === p.pn ? ' win' : ''}"><div class="rl-name"><span data-lk="${esc(p.pn)}">${esc(p.name)}</span>${p.pn === me.id ? ' (أنت)' : ''} ${L.on && !r ? '<span class="rl-on">🎙️ يقرأ الآن</span>' : ''}</div>
          <div class="rl-track"><i style="width:${pct}%"></i><span>${r?.pend ? '⏳ بانتظار تقييم المعلم لتسجيله' : r ? `النتيجة ${ar(r.s)}٪${r.pen ? ` (دقة ${ar(r.p)}٪ − تجويد ${ar(r.pen)})` : ''}` : L.total ? `${ar(pct)}٪ من المقطع · دقة ${ar(acc)}٪` : 'لم يبدأ بعد'}</span></div>
          ${r && (m.live || r.pend) ? `<button class="btn sm" type="button" data-aud="${esc(`${m.id}_${side}_${m.tb || 0}`)}">🔊 استمع لتلاوته</button>` : ''}</div>`; };
      $('#hwBody', app).innerHTML = `<div class="race">${lane(m.a, m.ra, 'a')}${m.b ? lane(m.b, m.rb, 'b') : ''}</div>
        ${w ? `<div class="hero-res">🏆 الفائز: <b>${esc(w === m.a.pn ? m.a.name : m.b.name)}</b>${m.draw ? ' (بالقرعة لغياب الطرفين)' : ''}</div>` : (m.ra || m.rb) ? '<div class="small muted">بانتظار الطرف الآخر…</div>' : ''}
        ${(m.hist || []).length ? `<details><summary class="small">الجولات السابقة (تعادل)</summary>${m.hist.map((h) => `<div class="small">${esc(hRange(h))}: ${ar(h.ra?.s ?? 0)}٪ مقابل ${ar(h.rb?.s ?? 0)}٪</div>`).join('')}</details>` : ''}
        ${!m.done && sideOf(m, me.id) && !(sideOf(m, me.id) === 'a' ? m.ra : m.rb) ? `<button class="btn primary" type="button" id="hwGo" style="margin-top:12px">⚔️ ادخل المباراة${m.tb ? ' (جولة فاصلة)' : ''}</button>` : ''}
        ${fresh ? `<div class="card" style="margin-top:12px">نتيجتك: <b>${ar(fresh.s)}٪</b>${fresh.pen ? ` (دقة ${ar(fresh.p)}٪، خصم تجويد ${ar(fresh.pen)})` : ''}</div>` : ''}`;
      $('#hwGo', app) && ($('#hwGo', app).onclick = () => openMatch(mid));
      $$('[data-aud]', app).forEach((b) => (b.onclick = async () => { b.disabled = true; try { const d = await store.getMatchAudio(heroT.id, b.dataset.aud); if (!d) { toast('التسجيل غير متاح.'); b.disabled = false; return; } const a = new Audio(`data:${d.mime};base64,${d.b64}`); a.play(); b.textContent = '▶ يُشغَّل…'; a.onended = () => { b.disabled = false; b.textContent = '🔊 استمع لتلاوته'; }; } catch { b.disabled = false; } }));
      if (w && !paint.party && (w === me.id)) { paint.party = true; confetti(); }
    };
    hView = { refresh: () => { paint(); syncCheer(); } };
    const m = hM.find((x) => x.id === mid);
    if (m?.live) offLive = store.watchLive(heroT.id, mid, (d) => { live = d || {}; paint(); });
    paint(); syncCheer();
  }

  /* --- الموسم --- */
  let mySeasons = [];
  function paintSeason() {
    const host = $('#seasonBar', app); if (!host) return;
    const s = activeSeason(mySeasons) || mySeasons.filter((x) => seasonStatus(x) === 'soon').sort((a, b) => a.from.localeCompare(b.from))[0];
    if (!s || (tab !== 'tasks' && tab !== 'honor')) { host.innerHTML = ''; return; }
    const r = me.rankInfo?.season?.id === s.id ? me.rankInfo.season : null;
    host.innerHTML = seasonBarHtml(s, r);
    $('[data-season]', host).onclick = () => openModal(`<div class="stack">${seasonBoardHtml(s, me.classId, me.id)}<div class="row"><button class="btn primary" type="button" data-close>حسناً</button></div></div>`);
  }
  /* --- ختمة الصف --- */
  async function loadKhatmas() {
    try { myKh = khForClass(await store.listKhatmas(), me.classId).filter((k) => !k.completedAt || Date.now() - new Date(k.completedAt).getTime() < 7 * 864e5 || openKhId === k.id); } catch (e) { console.warn('khatmas', e); }
    myKh.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    paintKhBar();
  }
  function paintKhBar() {
    const host = $('#khBar', app); if (!host) return;
    host.innerHTML = myKh.filter((k) => khActive(k) || k.completedAt).slice(0, 2).map((k) => {
      const total = khTotal(k), done = khDone(k), mine = contributors(k).find((c) => c.pn === me.id)?.n || 0, pct = Math.round((done / total) * 100);
      return `<div class="kh-bar${k.completedAt ? ' done' : ''}"><div class="kh-head"><b>📿 ختمة ${k.classId === 'all' ? 'المرحلة' : 'الصف'}: ${esc(khLabel(k))}</b><span class="small">${k.completedAt ? '🎉 اكتملت بفضل الله!' : esc(daysLeft(k))}</span></div>
        <div class="kh-meter"><i style="width:${Math.max(1, pct)}%"></i><span>${ar(done)} من ${ar(total)} آية (${ar(pct)}٪)</span></div>
        <div class="row" style="justify-content:space-between"><span class="small">${mine ? `ساهمتَ بـ${ar(mine)} ${mine === 1 ? 'آية' : mine === 2 ? 'آيتين' : 'آيات'} 🌟` : k.completedAt ? 'بارك الله في الجميع' : 'أتقن آية منها (٨٥٪+) لتضيفها لصفك'}</span>
        <span class="row" style="gap:6px">${k.completedAt ? `<button class="btn sm gold" type="button" data-khcert="${esc(k.id)}">🏅 الشهادة</button>` : `<button class="btn sm gold" type="button" data-khgo="${esc(k.id)}">ساهم الآن</button>`}<button class="btn sm" type="button" data-khinfo="${esc(k.id)}">التفاصيل</button></span></div></div>`;
    }).join('');
    $$('[data-khinfo]', host).forEach((b) => (b.onclick = () => openKhatma(b.dataset.khinfo)));
    $$('[data-khcert]', host).forEach((b) => (b.onclick = () => { const k = myKh.find((x) => x.id === b.dataset.khcert); groupCertificate(k, { className: k.classId === 'all' ? '' : data.classes.find((c) => c.id === k.classId)?.name || '' }); }));
    $$('[data-khgo]', host).forEach((b) => (b.onclick = () => { const g = nextGap(myKh.find((x) => x.id === b.dataset.khgo)); if (!g) return; pendingPractice = { ...g, mode: 'hifz' }; tab = 'practice'; draw(); scrollTo(0, 0); }));
  }
  function openKhatma(id) {
    const k = myKh.find((x) => x.id === id);
    if (!k) return toast('هذه الختمة لم تعد موجودة.');
    openModal(`<div class="stack">${khDetailHtml(k, me.id)}<div class="row"><button class="btn primary" type="button" data-close>حسناً</button></div></div>`);
    if (k.completedAt) confetti();
  }
  async function contributeKhatma(sub) {
    for (const k of myKh.filter((x) => khActive(x))) {
      const keys = newKeys(k, sub);
      if (!keys.length) continue;
      const entries = Object.fromEntries(keys.map((key) => [key, { pn: me.id, name: me.name }]));
      const complete = khDone(k) + keys.length >= khTotal(k);
      const at = complete ? new Date().toISOString() : null;
      try {
        await store.addKhatmaDone(k.id, entries, at);
        k.done = { ...(k.done || {}), ...entries }; if (at) k.completedAt = at;
        toast(`📿 أضفتَ ${keys.length === 1 ? 'آية' : keys.length === 2 ? 'آيتين' : ar(keys.length) + ' آيات'} إلى ختمة ${k.classId === 'all' ? 'المرحلة' : 'صفك'}!`);
        if (complete) { notifyKhatma(k.id).catch(() => {}); setTimeout(() => { confetti(); openKhatma(k.id); }, 600); }
        paintKhBar();
      } catch (e) { console.warn('khatma', e); }
    }
  }

  /* --- التحدي الودّي --- */
  async function loadChallenges() {
    try { [myCh, chCfg] = await Promise.all([store.listMyChallenges(me.id), store.getChallengeCfg().catch(() => ({ off: false }))]); setChPts(chCfg?.pts); } catch (e) { console.warn('challenges', e); }
    myCh.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    paintChBar();
    setTimeout(() => checkAch(), 2500);
    const host = $('#chCard', app); if (host) drawChCard(host);
    // تحدٍّ انتهى وقته ولم يُبلَّغ: نطلب إشعار النتيجة (يكفي طرف واحد)
    myCh.filter((c) => chStatus(c) === 'done' && !c.nDone).forEach((c) => notifyChallenge(c.id, 'done').catch(() => {}));
  }
  const chLabel = (c) => `«سورة ${surahName(c.surah)}» ${c.from === c.to ? `الآية ${ar(c.from)}` : `${ar(c.from)}–${ar(c.to)}`}${c.mode === 'recite' ? '، تلاوة نظراً' : ''}`;
  /** نوع المنافسة: غيباً (الأصل) أو نظراً */
  const modeTxt = (m) => (m === 'recite' ? 'تلاوة نظراً (النص ظاهر)' : 'تسميع غيباً');
  const chModes = () => (chCfg?.modes === 'hifz' || chCfg?.modes === 'recite' ? [chCfg.modes] : ['hifz', 'recite']);
  function paintChBar() {
    const host = $('#chBar', app); if (!host) return;
    const L = myCh.filter((c) => chStatus(c) === 'open' && !chView(c, me.id).mine);
    host.innerHTML = L.slice(0, 2).map((c) => { const v = chView(c, me.id); return `<div class="ann-bar ch-bar" role="status"><span class="ann-ico">⚔️</span>
      <div class="ann-tx"><b>${v.incoming ? `${esc(v.other.name)} يتحداك!` : `تحديك مع ${esc(v.other.name)} بانتظار تسميعك`}</b><span>${esc(chLabel(c))} · ${esc(ar(timeLeft(c)))}</span></div>
      <button class="btn sm gold" type="button" data-chgo="${esc(c.id)}">${isStrict(c) && v.incoming && !c.acceptedAt ? 'اطّلع واقبل' : 'ابدأ التحدي'}</button></div>`; }).join('');
    $$('[data-chgo]', host).forEach((b) => (b.onclick = () => openChallenge(b.dataset.chgo)));
  }
  function drawChCard(host) {
    const today = riyadhDay();
    const sentToday = myCh.filter((c) => c.a.pn === me.id && riyadhDay(new Date(c.createdAt)) === today).length;
    const wins = myCh.filter((c) => chWinner(c) === me.id).length, played = myCh.filter((c) => chView(c, me.id).mine).length;
    const active = myCh.filter((c) => chStatus(c) === 'open');
    const recent = myCh.filter((c) => chStatus(c) !== 'open').slice(0, 5);
    const row = (c) => {
      const v = chView(c, me.id), st = chStatus(c), w = chWinner(c);
      const strict = isStrict(c), pending = strict && v.incoming && !c.acceptedAt;
      const cancelBtn = st === 'open' && !pending && (!v.incoming || strict || v.mine) ? ` <button class="btn sm ghost" type="button" data-chx="${esc(c.id)}">${strict ? `إلغاء (−${ar(CH_PTS.cancel)})` : 'إلغاء مجاني'}</button>` : '';
      const res = st === 'open' ? (pending ? `<button class="btn sm gold" type="button" data-chgo="${esc(c.id)}">اطّلع واقبل</button> <button class="btn sm ghost" type="button" data-chno="${esc(c.id)}">اعتذار</button>`
        : v.mine ? `<span class="pill mute">سمّعت (${ar(v.mine.p)}٪) · بانتظار ${esc(v.other.name)}</span>${cancelBtn}` : `<button class="btn sm gold" type="button" data-chgo="${esc(c.id)}">ابدأ</button>${v.incoming && !strict ? ` <button class="btn sm ghost" type="button" data-chno="${esc(c.id)}">اعتذار</button>` : cancelBtn}`)
        : st === 'review' ? '<span class="pill warn">⏳ عند المعلم</span>'
        : st === 'declined' ? '<span class="pill mute">اعتذر</span>'
        : st === 'cancelled' ? (w === me.id ? '<span class="pill ok">🏆 فزت (ألغاه زميلك)</span>' : `<span class="pill mute">أُلغي${!c.cancel.free && c.cancel.by === me.id ? ` (−${ar(CH_PTS.cancel)})` : ''}</span>`)
        : w === me.id ? '<span class="pill ok">🏆 فزت</span>' : w === 'tie' ? '<span class="pill warn">🤝 تعادل</span>' : w ? '<span class="pill mute">خسرت</span>' : '<span class="pill mute">انتهى الوقت</span>';
      return `<li><div><b>${v.incoming ? '⬅' : '➡'} <span data-lk="${esc(v.other.pn)}" data-lk-no-title>${esc(v.other.name)}</span></b><span class="small muted">${esc(chLabel(c))}${st === 'open' ? ' · ' + esc(ar(timeLeft(c))) : v.mine && v.theirs ? ` · ${ar(v.mine.p)}٪ مقابل ${ar(v.theirs.p)}٪` : ''}</span></div><div class="row" style="gap:4px;flex-wrap:nowrap">${res}</div></li>`;
    };
    host.innerHTML = `<div class="card ch-card stack" style="gap:10px;margin-bottom:16px">
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">⚔️ تحدّي الزملاء</h3><span class="small muted">انتصاراتك: <b>${ar(wins)}</b> من ${ar(played)}</span></div>
      <p class="small muted" style="margin:0">تحدَّ زميلاً من صفك في مقطع تختاره: ${chModes().length > 1 ? 'تسميع غيباً أو تلاوة نظراً' : modeTxt(chModes()[0])}، محاولة واحدة لكلٍّ منكما خلال ${ar(CH_HOURS)} ساعة. الأدق يفوز (+${ar(CH_PTS.win)} نقاط)، والمشارك +${ar(CH_PTS.lose)}.</p>
      ${chCfg.off ? '<div class="notice">أوقف المعلم التحديات مؤقتاً.</div>' : `<div class="row"><button class="btn primary" type="button" id="chNew" ${sentToday >= CH_DAILY ? 'disabled' : ''}>تحدَّ زميلاً</button><span class="small muted">${sentToday >= CH_DAILY ? `وصلت إلى ${ar(CH_DAILY)} تحديات اليوم. عُد غداً!` : `يتبقى لك اليوم ${ar(CH_DAILY - sentToday)} من ${ar(CH_DAILY)}`}</span></div>`}
      ${active.length ? `<b class="small">تحديات جارية</b><ul class="ch-list">${active.map(row).join('')}</ul>` : ''}
      ${recent.length ? `<b class="small">آخر النتائج</b><ul class="ch-list">${recent.map(row).join('')}</ul>` : ''}
    </div>`;
    const nb = $('#chNew', host); if (nb) nb.onclick = newChallenge;
    $$('[data-chgo]', host).forEach((b) => (b.onclick = () => openChallenge(b.dataset.chgo)));
    $$('[data-chno]', host).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('الاعتذار عن هذا التحدي؟ لن تُحسب نقاط لأحد.', 'اعتذار'))) return;
      try { await store.updateChallenge(b.dataset.chno, { declined: true }); await loadChallenges(); } catch (e) { toast('تعذر: ' + (e.code || e.message)); }
    }));
    $$('[data-chx]', host).forEach((b) => (b.onclick = () => cancelChallenge(myCh.find((c) => c.id === b.dataset.chx))));
  }
  /** إلغاء تحدٍّ جارٍ: القديم مجاناً، والجديد يخسر من يلغيه نقطة (وإن كان زميله قد سمّع فالفوز له) */
  async function cancelChallenge(c) {
    if (!c || chStatus(c) !== 'open') return;
    const v = chView(c, me.id), strict = isStrict(c);
    const msg = strict ? `إلغاء التحدي مع ${v.other.name}؟ ستخسر ${CH_PTS.cancel === 1 ? 'نقطة واحدة' : ar(CH_PTS.cancel) + ' نقاط'} من لوحة الشرف${v.theirs ? `، وبما أن ${v.other.name} سمّع فالفوز له` : ''}. لا يمكن التراجع.` : `إلغاء التحدي مع ${v.other.name}؟ هذا التحدي من قبل نظام الإلغاء الجديد، فإلغاؤه مجاني بلا خصم.`;
    if (!(await confirmBox(msg, strict ? `ألغِ وأخسر ${ar(CH_PTS.cancel)}` : 'ألغِ مجاناً'))) return;
    const cancel = { by: me.id, at: new Date().toISOString(), free: !strict };
    try { await store.updateChallenge(c.id, { cancel }); c.cancel = cancel; toast(strict ? 'أُلغي التحدي.' : 'أُلغي التحدي مجاناً.'); await loadChallenges(); draw(); }
    catch (e) { toast('تعذر الإلغاء: ' + (e.code || e.message)); }
  }
  /** عدد ما أرسله الطالب اليوم: الأكبر بين عدّاد الخادم والقائمة المحدّثة */
  async function chSentToday() {
    try { myCh = await store.listMyChallenges(me.id); } catch {}
    const today = riyadhDay(new Date()), local = myCh.filter((c) => c.a.pn === me.id && riyadhDay(new Date(c.createdAt)) === today).length;
    const srv = await store.chToday(me.id).catch(() => null);
    return Math.max(local, srv || 0);
  }
  async function newChallenge() {
    openModal('<div class="loading">جارٍ تحميل زملائك…</div>');
    chCfg = (await store.getChallengeCfg().catch(() => null)) || chCfg; // أحدث إعداد للمعلم (الإيقاف ونوع التحدي)
    if (chCfg.off) { closeModal(); return toast('أوقف المعلم التحديات مؤقتاً.'); }
    if ((await chSentToday()) >= CH_DAILY) { closeModal(); toast(`وصلت إلى ${ar(CH_DAILY)} تحديات اليوم. عُد غداً!`); if ($('#stBody', app) && tab === 'honor') draw(); return; }
    let mates = [];
    try { mates = (await store.listDirectory(me.classId)).filter((x) => x.id !== me.id && x.hasAccount); } catch (e) { $('#modalBody').innerHTML = `<div class="notice">تعذر تحميل الزملاء: ${esc(e.code || e.message)}</div>`; return; }
    const busy = new Set(myCh.filter((c) => chStatus(c) === 'open').map((c) => chView(c, me.id).other.pn));
    const init = pref.get('lastRange', { surah: 78, from: 1, to: 10 });
    $('#modalBody').innerHTML = `<form class="stack" id="chForm"><h2>⚔️ تحدٍّ جديد</h2>
      <label class="field">زميلك<select id="chMate" required><option value="">اختر زميلاً من صفك</option>${mates.map((x) => `<option value="${esc(x.id)}" ${busy.has(x.id) ? 'disabled' : ''}>${esc(x.name)}${busy.has(x.id) ? ' (بينكما تحدٍّ جارٍ)' : ''}</option>`).join('')}</select></label>
      <div class="card">${rangePicker('cx', init)}</div>
      ${chModes().length > 1 ? `<div class="field">نوع التحدي<div class="seg ch-mode" role="radiogroup"><label><input type="radio" name="chM" value="hifz" ${pref.get('chMode', 'hifz') !== 'recite' ? 'checked' : ''}> 🙈 تسميع غيباً</label><label><input type="radio" name="chM" value="recite" ${pref.get('chMode', 'hifz') === 'recite' ? 'checked' : ''}> 📖 تلاوة نظراً</label></div></div>` : `<p class="small" style="margin:0">نوع التحدي: <b>${modeTxt(chModes()[0])}</b> (حدده المعلم)</p>`}
      <p class="small muted" style="margin:0">المقطع حتى ٢٠ آية. بلا تلميح، ومحاولة واحدة لكلٍّ منكما، وكلاكما بالنوع نفسه. يصل زميلك إشعار، وأمامكما ${ar(CH_HOURS)} ساعة.</p>
      <div class="row"><button class="btn primary" type="submit">أرسل التحدي</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`;
    const m = $('#modalBody');
    let rng = { ...init };
    bindRangePicker(m, 'cx', (r) => (rng = r));
    $('#chForm', m).onsubmit = async (e) => {
      e.preventDefault();
      const mate = mates.find((x) => x.id === $('#chMate', m).value); if (!mate) return toast('اختر زميلك.');
      // يُقرأ النوع قبل نافذة التأكيد (لأنها تستبدل محتوى النافذة)
      const mode = chModes().length > 1 ? ($('input[name=chM]:checked', m)?.value === 'recite' ? 'recite' : 'hifz') : chModes()[0]; pref.set('chMode', mode);
      if (rng.to - rng.from + 1 > 20) return toast('اختر مقطعاً لا يزيد على ٢٠ آية.');
      const btn = e.submitter;
      if (!(await confirmBox(`⚠️ قبل الإرسال: التحدي لا يُلغى. إن أردت إلغاءه بعد إرساله ستخسر ${CH_PTS.cancel === 1 ? 'نقطة واحدة' : ar(CH_PTS.cancel) + ' نقاط'} من لوحة الشرف مباشرة. هل أنت مستعد لتحدي ${mate.name}؟`, 'نعم، أرسل التحدي'))) return;
      btn.disabled = true;
      if ((await chSentToday()) >= CH_DAILY) { closeModal(); toast(`وصلت إلى ${ar(CH_DAILY)} تحديات اليوم. عُد غداً!`); if ($('#stBody', app) && tab === 'honor') draw(); return; }
      const cls = data.classes.find((c) => c.id === me.classId);
      const now = new Date();
      const c = { mode, pns: [me.id, mate.id], a: { pn: me.id, name: me.name }, b: { pn: mate.id, name: mate.name }, classId: me.classId, className: cls?.name || '', surah: rng.surah, from: rng.from, to: rng.to, label: '', createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + CH_HOURS * 3600e3).toISOString(), ra: null, rb: null, v: CH_V };
      c.label = chLabel(c);
      try {
        const id = await store.createChallenge(c);
        myCh.unshift({ ...c, id });
        notifyChallenge(id, 'new').catch(() => {});
        closeModal(); toast(`أُرسل التحدي إلى ${mate.name} ⚔️`);
        openChallenge(id);
      } catch (x) { if (x.code === 'daily-limit') { closeModal(); toast(x.message); return; } toast('تعذر إرسال التحدي: ' + (x.code || x.message)); btn.disabled = false; }
    };
  }
  /** شاشة التحدي: التسميع (مرة واحدة) أو النتيجة */
  async function openChallenge(id) {
    let c = myCh.find((x) => x.id === id);
    try { c = (await store.getChallenge(id)) || c; } catch {}
    if (!c) return toast('هذا التحدي لم يعد موجوداً.');
    const i = myCh.findIndex((x) => x.id === id); if (i >= 0) myCh[i] = c; else myCh.unshift(c);
    const v = chView(c, me.id), st = chStatus(c);
    comp?.destroy(); comp = null;
    app.innerHTML = `<div class="page-head"><div><button class="btn sm ghost" id="chBack" type="button">→ رجوع</button><h1>⚔️ تحدٍّ مع ${esc(v.other.name)}</h1>
      <p class="muted" style="margin:4px 0 0">${esc(chLabel(c))} · ${st === 'open' ? esc(ar(timeLeft(c))) : 'انتهى'}</p></div></div><div id="chBody"></div>`;
    $('#chBack', app).onclick = () => { comp?.destroy(); comp = null; tab = 'honor'; draw(); };
    const body = $('#chBody', app);
    if (v.mine || st !== 'open') return showChResult(body, c);
    // التحديات الجديدة: شاشة قبول قبل البدء، تنبّه أن التحدي لا يُلغى إلا بخسارة نقطة
    if (isStrict(c) && v.incoming && !c.acceptedAt) {
      body.innerHTML = `<div class="card stack ch-accept" style="gap:12px"><h2 style="margin:0">⚔️ ${esc(v.other.name)} يتحداك!</h2>
        <p style="margin:0">المقطع: <b>${esc(chLabel(c))}</b> · ${modeTxt(c.mode)}، ومحاولة واحدة لكلٍّ منكما · ${esc(ar(timeLeft(c)))}.</p>
        <div class="notice">⚠️ <b>التحدي لا يُلغى بعد قبوله.</b> إن قبلته ثم أردت إلغاءه ستخسر ${CH_PTS.cancel === 1 ? 'نقطة واحدة' : ar(CH_PTS.cancel) + ' نقاط'} من لوحة الشرف مباشرة. أما الاعتذار الآن قبل القبول فلا خصم فيه.</div>
        <div class="row"><button class="btn gold" type="button" id="chAcc">أقبل التحدي</button><button class="btn ghost" type="button" id="chDec">أعتذر الآن (بلا خصم)</button></div></div>`;
      $('#chAcc', body).onclick = async (e) => {
        e.target.disabled = true;
        try { const at = new Date().toISOString(); await store.updateChallenge(c.id, { acceptedAt: at }); c.acceptedAt = at; openChallenge(c.id); }
        catch (x) { e.target.disabled = false; toast('تعذر: ' + (x.code || x.message)); }
      };
      $('#chDec', body).onclick = async () => {
        if (!(await confirmBox('الاعتذار عن هذا التحدي؟ لا خصم لأنك لم تقبله بعد.', 'اعتذار'))) return;
        try { await store.updateChallenge(c.id, { declined: true }); await loadChallenges(); tab = 'honor'; draw(); } catch (x) { toast('تعذر: ' + (x.code || x.message)); }
      };
      return;
    }
    body.innerHTML = `<div class="notice" style="margin-bottom:12px">🎯 ${c.mode === 'recite' ? '📖 تلاوة نظراً (النص أمامك)' : '🙈 تسميع غيباً'}، بلا تلميح، ومحاولة واحدة فقط: النتيجة تُحتسب عند أول إيقاف. استعد جيداً ثم ابدأ.</div><div id="chRc"></div>`;
    comp = mountRecite($('#chRc', body), {
      surah: c.surah, from: c.from, to: c.to, mode: c.mode === 'recite' ? 'recite' : 'hifz', lockMode: true, noHint: true, noAi: true, noListen: true, capCheck: true,
      onActivity: (sec) => logAct('practice', sec),
      // الجهاز لم يتعرف على الكلام: يُرسل التسجيل ليقيّمه المعلم
      onNoTranscript: (sub, blob, dur) => setTimeout(async () => {
        comp?.destroy(); comp = null;
        body.innerHTML = '<div class="loading">جارٍ إرسال تسجيلك…</div>';
        try {
          if (!(await store.saveChAudio(c.id, v.side, blob))) throw new Error('التسجيل طويل جداً');
          const r = { pend: 1, p: null, wpm: 0, dur: Math.round(dur || 0), at: new Date().toISOString(), why: sub.why || '', dev: { os: sub.dev?.os || '', br: sub.dev?.br || '' } };
          await store.updateChallenge(c.id, { [v.side]: r });
          c[v.side] = r;
          notifyReview({ kind: 'ch', id: c.id, side: v.side }).catch(() => {});
        } catch (x) { body.innerHTML = `<div class="notice">تعذر الإرسال: ${esc(x.code || x.message)}</div>`; return; }
        showChResult(body, c, true);
        paintChBar();
      }),
      onResult: (sub) => setTimeout(async () => {
        const r = { p: sub.percent, wpm: sub.wpm || 0, dur: Math.round(sub.duration || 0), at: new Date().toISOString() };
        comp?.destroy(); comp = null;
        body.innerHTML = '<div class="loading">جارٍ حفظ نتيجتك…</div>';
        try {
          await store.updateChallenge(c.id, { [v.side]: r });
          c[v.side] = r;
          recordProgress(sub);
          if (chStatus(c) === 'done') notifyChallenge(c.id, 'done').catch(() => {});
        } catch (x) { body.innerHTML = `<div class="notice">تعذر حفظ النتيجة: ${esc(x.code || x.message)}</div>`; return; }
        showChResult(body, c, true);
        paintChBar();
      }),
    });
  }
  function showChResult(body, c, fresh = false) {
    const v = chView(c, me.id), st = chStatus(c), w = chWinner(c);
    const tile = (who, r) => `<div class="ch-tile${w === who.pn ? ' win' : ''}"><span data-lk="${esc(who.pn)}">${esc(who.name)}</span><b>${r?.pend ? '⏳' : r ? ar(r.p) + '٪' : '—'}</b><small>${r ? `${ar(r.wpm)} كلمة/دقيقة` : st === 'open' ? 'لم يسمّع بعد' : 'لم يشارك'}</small>${w === who.pn ? '<i>🏆</i>' : ''}</div>`;
    const head = st === 'review' ? `⏳ وصل تسجيل ${v.mine?.pend ? 'ك' : esc(v.other.name)} إلى المعلم ليقيّمه بنفسه، وتظهر النتيجة بعد تقييمه.`
      : st === 'open' ? `سمّعت بدقة ${ar(v.mine.p)}٪، والآن ننتظر ${esc(v.other.name)} (${esc(ar(timeLeft(c)))}).`
      : st === 'declined' ? 'اعتذر عن التحدي.'
      : st === 'cancelled' ? (w === me.id ? `🏆 ألغى ${esc(v.other.name)} التحدي بعد تسميعك، فالفوز لك! +${ar(CH_PTS.win)} نقاط.` : c.cancel.by === me.id ? `أُلغي التحدي${c.cancel.free ? ' مجاناً' : ` (−${ar(CH_PTS.cancel)})`}.` : `ألغى ${esc(v.other.name)} التحدي.`)
      : w === 'tie' ? `🤝 تعادل! +${ar(CH_PTS.tie)} نقطة لكلٍّ منكما.` : w === me.id ? `🏆 فزت بالتحدي! +${ar(CH_PTS.win)} نقاط في لوحة الشرف.` : w ? `انتهى التحدي لصالح ${esc(v.other.name)}. ${v.mine ? `+${ar(CH_PTS.lose)} نقطة على مشاركتك.` : ''}` : 'انتهى الوقت ولم يسمّع أحد.';
    body.innerHTML = `<div class="card stack ch-result" style="gap:14px"><h2 style="margin:0">${head}</h2>
      <div class="ch-vs">${tile(v.me, v.mine)}<span class="ch-x">⚔️</span>${tile(v.other, v.theirs)}</div>
      <div class="row"><button class="btn primary" type="button" id="chHome">إلى لوحة الشرف</button>${st !== 'open' && chCfg.off !== true ? '<button class="btn gold" type="button" id="chAgain">تحدٍّ جديد</button>' : ''}</div></div>`;
    if (fresh && w === me.id) setTimeout(() => confetti(), 150);
    $('#chHome', body).onclick = () => { tab = 'honor'; draw(); };
    const ag = $('#chAgain', body); if (ag) ag.onclick = () => { tab = 'honor'; draw(); newChallenge(); };
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
    contributeKhatma(sub);
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
    const n = myFb.filter(fbUnreadS).length;
    b.querySelector('.fb-n').textContent = n ? `، ${n === 1 ? 'رسالة جديدة' : ar(n) + ' محادثات فيها جديد'}` : '';
    b.classList.toggle('has', n > 0);
  }
  /** رأيك يهمنا: قائمة محادثاتي، وملاحظة جديدة، وفتح المحادثة */
  function openFeedback(focusId = null) {
    const cls = data.classes.find((c) => c.id === me.classId);
    const openChat = (x) => {
      const m = $('#modalBody'); m.innerHTML = '<div class="fb-chat-wrap"></div>';
      mountChat($('.fb-chat-wrap', m), {
        store, side: 's', pn: me.id, fid: x.id, title: 'معلمك', sub: `${FBK(x.kind)[1]}، بدأت ${timeAgo(x.createdAt)}`, toast,
        onBack: () => paintList(),
        onState: (t) => { const i = myFb.findIndex((f) => f.id === t.id); if (i >= 0) myFb[i] = { ...myFb[i], ...t }; paintFbCta(); },
        onSent: (msg) => notifyFbMsg(me.id, x.id, msg.id).catch(() => {}),
      });
    };
    const paintList = () => {
      const mine = [...myFb].sort((a, b) => fbLast(b).localeCompare(fbLast(a)));
      const row = (x) => { const u = fbUnreadS(x), cl = fbClosed(x); return `<li><button type="button" class="fb-th${u ? ' unread' : ''}" data-th="${esc(x.id)}">
        <span class="fb-th-ico">${FBK(x.kind)[0]}</span>
        <span class="fb-th-m"><span class="row" style="justify-content:space-between;gap:6px"><b>${esc(FBK(x.kind)[1])}${cl ? ' <small class="muted">🔒 مغلقة</small>' : ''}</b><small class="muted">${esc(timeAgo(fbLast(x)))}</small></span>
        <span class="fb-th-p">${esc(fbPreview(x))}</span></span>${u ? '<span class="fb-th-n" aria-label="جديد"></span>' : ''}</button></li>`; };
      openModal(`<div class="stack fb-modal">
        <h2>💬 رأيك يهمنا</h2>
        <p class="muted" style="margin:0">اكتب ملاحظتك أو شكواك أو اقتراحك، ويردّ عليك المعلم هنا، ثم تكمل معه الحديث في المحادثة نفسها.</p>
        <details class="fb-new" ${mine.length ? '' : 'open'}><summary class="btn primary">✍️ ملاحظة جديدة</summary>
        <form id="fbF" class="stack" style="gap:12px;margin-top:10px">
          <div class="fb-kinds" role="radiogroup" aria-label="نوع الملاحظة">${Object.entries(FB_KINDS).map(([k, [i, l]], n) => `<label><input type="radio" name="fbK" value="${k}" ${n === 0 ? 'checked' : ''}><span>${i} ${l}</span></label>`).join('')}</div>
          <label class="field">اكتب ملاحظتك<textarea id="fbT" rows="4" maxlength="1000" required placeholder="مثلاً: أقترح إضافة… / واجهت مشكلة عند…"></textarea></label>
          <div class="row" style="justify-content:space-between"><small class="muted" id="fbC">٠ / ١٠٠٠</small><button class="btn primary" type="submit">إرسال</button></div>
          <div id="fbErr" class="notice" hidden></div>
        </form></details>
        ${mine.length ? `<h3 style="margin:8px 0 0">محادثاتي</h3><ul class="fb-ths">${mine.map(row).join('')}</ul>` : ''}
      </div>`, (m) => {
        const T = $('#fbT', m);
        T.oninput = () => ($('#fbC', m).textContent = `${ar(T.value.length)} / ١٠٠٠`);
        $$('[data-th]', m).forEach((b) => (b.onclick = () => openChat(myFb.find((x) => x.id === b.dataset.th))));
        $('#fbF', m).onsubmit = async (e) => {
          e.preventDefault();
          const btn = e.submitter, err = $('#fbErr', m), text = T.value.trim();
          err.hidden = true;
          if (text.length < 3) { err.hidden = false; err.textContent = 'اكتب ملاحظتك أولاً.'; return; }
          btn.disabled = true;
          const f = { name: me.name, classId: me.classId || '', className: cls?.name || '', kind: $('input[name=fbK]:checked', m).value, text };
          try {
            const id = await store.addFeedback(me.id, f);
            const x = { ...f, id, pn: me.id, createdAt: new Date().toISOString() };
            myFb.push(x);
            notifyFeedback(me.id, id).catch(() => {});
            paintFbCta(); toast('شكراً لك! وصلت ملاحظتك إلى المعلم 🌟');
            openChat(x);
          } catch (x) { err.hidden = false; err.textContent = 'تعذر الإرسال: ' + (x.code || x.message); btn.disabled = false; }
        };
      });
    };
    const x = focusId && myFb.find((f) => f.id === focusId);
    if (x) { openModal('', () => {}); openChat(x); } else paintList();
    // تحديث القائمة من الخادم (ردود وصلت بعد فتح الصفحة)
    store.listMyFeedback(me.id).then((L) => { myFb = L; paintFbCta(); if (!x && $('#modalBody .fb-ths, #modalBody .fb-modal') && !$('#modalBody .chat')) paintList(); }).catch(() => {});
  }
  function openBell() {
    const seen = pref.get(seenKey, '');
    const L = [...notifs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    pref.set(seenKey, new Date().toISOString());
    paintBell();
    openModal(`<div class="stack"><h2>التنبيهات</h2>
      ${L.length ? `<ul class="notif-list">${L.map((n) => `<li><button type="button" class="notif-item${(n.createdAt || '') > seen ? ' new' : ''}" data-nid="${esc(n.id)}">
        <span class="notif-ico">${n.type === 'board' ? '🏆' : n.type === 'month' ? (n.win ? '🏅' : '📊') : n.type === 'season' ? (n.icon || '🏆') : n.type === 'streak' ? '🔥' : n.type === 'ann' ? '📢' : n.type === 'remind' ? '⏰' : n.type === 'retake' ? '🔁' : n.type === 'fbReply' ? '💬' : n.type === 'speechFix' ? '🎙️' : n.type === 'voice' ? '🎙️' : n.type === 'reward' ? '🎁' : n.type === 'challenge' ? '⚔️' : n.type === 'cheer' ? '💚' : n.type === 'khatma' ? '📿' : n.type === 'hero' ? '🏆' : n.type === 'late' ? '⏰' : n.type === 'grade' ? (n.score >= 8 ? '🎉' : '⭐') : n.type === 'task-edit' ? '✎' : '📖'}</span>
        <span class="notif-tx"><b>${esc((n.title || '').replace(/^(🎉|📢|⏰|🔁|🔥|👑|🏆|🏅|📊|🌟|🏁|💬|⚔️|🤝|💚|📿)\s*/u, ''))}</b><span>${esc(n.body || '')}</span><small class="muted">${esc(timeAgo(n.createdAt))}</small></span></button></li>`).join('')}</ul>`
        : '<div class="empty">لا توجد تنبيهات خلال آخر ٣٠ يوماً.</div>'}
      ${pushState(me.id) === 'ready' ? '<p class="small muted" style="margin:0">لتصلك التنبيهات على جوالك حتى والمقرأة مغلقة، فعّلها من «الإعدادات».</p>' : ''}</div>`, (m) => {
      $$('[data-nid]', m).forEach((b) => (b.onclick = () => {
        const n = notifs.find((x) => x.id === b.dataset.nid);
        closeModal();
        if (n?.type === 'grade') { openSub(n.subId); return; }
        if (n?.type === 'fbReply') { openFeedback(n.fid); return; }
        if (n?.type === 'khatma') { loadKhatmas().then(() => openKhatma(n.khId)); return; }
        if (n?.type === 'cheer') { openModal(`<div class="stack"><h2>💚 رسالة من معلمك</h2><p style="margin:0;line-height:2;white-space:pre-wrap">${esc(n.body || '')}</p><div class="row"><button class="btn primary" type="button" data-close>جزاك الله خيراً</button></div></div>`); return; }
        if (n?.type === 'challenge') { loadChallenges().then(() => openChallenge(n.chId)); return; }
        if (n?.type === 'ann') { openAnn(n.annId); return; }
        if (n?.type === 'hero') { if (n.mid && hM.some((x) => x.id === n.mid)) openMatch(n.mid); else { tab = 'heroes'; draw(); } return; }
        if (n?.type === 'month' || n?.type === 'season') { openMonth(n); return; }
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
      const [tasks, subs, classes, rank, retakes, activity, late] = await Promise.all([store.listTasks(), store.studentSubmissions(me.id), store.listClasses(), store.getMyRank(me).catch(() => null), store.listRetakes(me.id).catch(() => []), store.listActivity(me.id, addDays(riyadhDay(), -400)).catch(() => []), store.listMyLate(me.id).catch(() => [])]);
      data.retakes = retakes;
      me.rankInfo = rank;
      knownTasks = new Set(tasks.filter((t) => taskStarted(t)).map((t) => t.id)); loadedAt = new Date().toISOString();
      data = { retakes, activity, late, tasks: tasks.filter((t) => taskFor(t, me) && taskStarted(t)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), subs: subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), classes };
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="empty">تعذر تحميل البيانات: ${esc(e.message)}</div>`;
      return;
    }
    RW = { wallet: { spent: 0, bonus: 0 }, owned: [], ach: {}, look: null, ...(me.rankInfo?._rw || {}) };
    hbStart();
    setTimeout(checkPopAnn, 1600);
    setTimeout(() => flushHimma().then(recoverHimma), 2000); // نقاط معلّقة من جلسة سابقة، ثم استرجاع ما ضاع
    FX.kind = RW.look?.x || '';
    if (RW.look) setLook(me.id, RW.look);
    draw();
    pruneImageCache();
    Promise.all([store.getShop().catch(() => null), store.getLooks().catch(() => ({}))]).then(([sh, lk]) => { SHOP = sh; setLooks({ ...looksMap(lk), ...(RW.look ? { [me.id]: RW.look } : {}) }); if (tab === 'rewards' && $('#stBody', app)) draw(); });
    store.listSeasons().then((L) => { mySeasons = L; paintSeason(); }).catch(() => {});
    loadHeroes();
    iqraCfg().then((c) => { const on = (c.pns || []).includes(me.id); if (on !== iqraOn) { iqraOn = on; if ($('#stBody', app) && !offIqra) draw(); } }).catch(() => {});
    loadKhatmas().then(() => { if (openKhId) { const id = openKhId; openKhId = null; openKhatma(id); } });
    // تقييمات المعلم تصل فوراً (حتى أثناء التلاوة)
    const gSig = (L) => JSON.stringify(L.map((x) => [x.id, x.teacher?.total ?? null, x.teacher?.at || '', x.retakeRequested?.id || '']).sort());
    let lastG = gSig(data.subs);
    store.watchMySubs(me.id, (L) => {
      const sig = gSig(L); if (sig === lastG) return; lastG = sig;
      const old = new Map(data.subs.map((x) => [x.id, x]));
      data.subs = L.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const fresh = data.subs.filter((x) => x.teacher && typeof x.teacher.total === 'number' && (old.get(x.id)?.teacher?.at || '') !== (x.teacher.at || ''));
      if (!$('#stBody', app)) return;
      if (comp || $('#modal')?.classList.contains('open') || !$('#modal')?.hidden) {
        // في منتصف التلاوة أو نافذة مفتوحة: تنبيه صغير لا يقطع التسميع، والاحتفال لاحقاً
        if (fresh.length) { const x = fresh[0]; toast(`🎓 قيّم معلمك «${x.taskTitle || 'تسميعك'}»: ${ar(x.teacher.total)} من ١٠`); }
        if (!comp && ['history', 'tasks'].includes(tab) && $('#modal')?.hidden !== false) draw();
        return;
      }
      draw(); if (fresh.length) announceGrades();
    });
    loadChallenges().then(() => { if (openChId) { const id = openChId; openChId = null; openChallenge(id); } });
    store.listMyFeedback(me.id).then((L) => { myFb = L; paintFbCta(); if (openFbId) { const id = openFbId; openFbId = null; openFeedback(id); } }).catch(() => {});
    if (openTaskId) { const t = data.tasks.find((x) => x.id === openTaskId); openTaskId = null; if (t) { openTask(t); return; } }
    if (openRetakeId) { const id = openRetakeId; openRetakeId = null; if ((data.retakes || []).some((r) => r.id === id)) { startRetake(id); return; } }
    openSubId = null; // درجة من إشعار: نفتح «سجل التسميع» ويعرض announceGrades الاحتفال
    announceGrades();
    whenModalFree(() => { if ($('#stBody', app)) celebrateStreak(); });
    setTimeout(() => checkAch(), 1500);
    if (!offNotifs) offNotifs = store.watchNotifs(me.classId, async (L) => {
      // درجة جديدة وصلت والصفحة مفتوحة: نحدّث التسليمات ونعرض الاحتفال
      if (L.some((n) => n.type === 'retake' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { data.retakes = await store.listRetakes(me.id); } catch {}
        if ($('#stBody', app) && tab === 'tasks') draw();
      }
      if (L.some((n) => n.type === 'challenge' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        await loadChallenges(); if ($('#stBody', app) && tab === 'honor') draw();
      }
      if (L.some((n) => n.type === 'fbReply' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { myFb = await store.listMyFeedback(me.id); paintFbCta(); } catch {}
      }
      if (L.some((n) => n.type === 'grade' && !notifs.some((o) => o.id === n.id)) && paintBell.done) {
        try { data.subs = (await store.studentSubmissions(me.id)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch {}
        if ($('#stBody', app)) { draw(); announceGrades(); }
      }
      const first = !notifs.length && !paintBell.done;
      // تنبيهات واجب حُذف أو حُذف عن الطالب أو صفه: لا تظهر
      notifs = L.filter((n) => !(n.taskId && ['task', 'task-edit', 'remind'].includes(n.type) && knownTasks.has(n.taskId) && !data.tasks.some((x) => x.id === n.taskId)) && !(n.taskId && ['task', 'task-edit', 'remind'].includes(n.type) && knownTasks.size && !knownTasks.has(n.taskId) && n.createdAt < (loadedAt || '')));
      paintBell(); paintBell.done = true; paintAnnBar();
      if (openAnnId && anns().some((n) => n.annId === openAnnId)) { const id = openAnnId; openAnnId = null; openAnn(id); }
      else checkPopAnn();
      const months = L.filter((n) => n.type === 'month');
      const mDeep = openMonthYm && months.find((n) => n.ym === openMonthYm);
      if (mDeep) { openMonthYm = null; openMonth(mDeep); }
      else if ($('#stBody', app)) { const seen = new Set(pref.get('monthSeen_' + me.id, [])); const fresh = months.find((n) => !seen.has(n.ym)); if (fresh && !openMonth.pending) { openMonth.pending = true; whenModalFree(() => { openMonth.pending = false; if ($('#stBody', app) && !new Set(pref.get('monthSeen_' + me.id, [])).has(fresh.ym)) openMonth(fresh); }); } }
      if (L.some((n) => n.type === 'late' && (n.createdAt || '') > (loadedAt || '') && !(data.lateSeen || new Set()).has(n.id))) {
        data.lateSeen = new Set(L.filter((n) => n.type === 'late').map((n) => n.id));
        store.listMyLate(me.id).then((x) => { data.late = x; if ($('#stBody', app) && tab === 'tasks') draw(); }).catch(() => {});
      }
      const onList = $('#stBody', app) && tab === 'tasks';
      // واجب جديد وصل والطالب على صفحة الواجبات: نحدّث القائمة
      if (L.some((n) => n.taskId && !knownTasks.has(n.taskId))) {
        try { const tasks = await store.listTasks(); knownTasks = new Set(tasks.filter((t) => taskStarted(t)).map((t) => t.id)); data.tasks = tasks.filter((t) => taskFor(t, me) && taskStarted(t)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch {}
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
    comp?.destroy(); comp = null; stopCheer(); offIqra?.(); offIqra = null; offHonor?.(); offHonor = null;
    if (tab === 'iqra' && !iqraOn) tab = 'tasks';
    if (tab !== HB.pg) { if (HB.pg === 'practice') practiceSummary(); HB.pg = tab; hbBeat(false); }
    const cls = data.classes.find((c) => c.id === me.classId);
    const graded = data.subs.filter((x) => x.percent != null);
    const avg = graded.length ? Math.round(graded.reduce((n, x) => n + x.percent, 0) / graded.length) : null;
    const doneTasks = new Set(data.subs.map((x) => x.taskId).filter(Boolean));
    const streak = streakOf(activeDays()).days;
    app.innerHTML = `
      <div class="page-head">
        <div><span class="muted small">${esc(cls?.name || '')}</span><h1>السلام عليكم، <span data-lk="${esc(me.id)}">${esc(me.name)}</span></h1>
          ${me.rankInfo?.month?.stage === 1 ? `<span class="title-pill">${rankBadge(1)} شيخ المرحلة هذا الشهر</span>` : me.rankInfo?.month?.cls === 1 ? `<span class="title-pill">${rankBadge(1)} قارئ الصف هذا الشهر</span>` : ''}
          ${(me.rankInfo?._badges || []).length ? `<div class="badges">${me.rankInfo._badges.slice(-6).map((b) => `<span class="badge-pill" style="--bc:${esc(b.color || '#a77a1c')}" title="${esc(b.title || '')}">${esc(b.icon || '🏅')} ${esc(b.label)}</span>`).join('')}</div>` : ''}</div>
        <div class="row"><button class="btn bell-btn" id="stBell" type="button" aria-label="التنبيهات"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg><span class="bell-n"></span></button><button class="btn gear-btn${tab === 'settings' ? ' on' : ''}" id="stSet" type="button" aria-pressed="${tab === 'settings'}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg> الإعدادات</button><button class="btn" id="stOut" type="button">تسجيل الخروج</button></div>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${ar(doneTasks.size)}/${ar(data.tasks.length)}</b><span>واجبات منجزة</span></div>
        <div class="kpi"><b>${avg == null ? '—' : ar(avg) + '٪'}</b><span>متوسط دقة الحفظ</span></div>
        <div class="kpi"><b>${ar(data.subs.length)}</b><span>مرات التسميع</span></div>
        <div class="kpi" id="kpiStreak" title="تُحسب الأيام التي سمّعت فيها واجباً أو تدرّبت دقيقة فأكثر"><b>🔥 ${ar(streak)}</b><span>أيام متتالية</span></div>
      </div>
      ${RW ? (() => { const nAch = Object.values(RW.ach || {}).filter(Boolean).length, nOwn = (RW.owned || []).length; return `<button type="button" class="rw-kpi${tab === 'rewards' ? ' on' : ''}" id="rwKpi">
        <span class="rw-kpi-ic" aria-hidden="true">🏅</span><span class="rw-kpi-tx"><b>خزانتي</b><small>${nAch ? `${ar(nAch)} ${nAch === 1 ? 'وسام' : 'أوسمة'}` : 'لا أوسمة بعد'} · ${nOwn ? `${ar(nOwn)} من المتجر` : 'المتجر بانتظارك 🛍️'}</small></span>
        <span class="rw-kpi-c">🪙 ${ar(myCoins())}</span><span class="rw-kpi-go" aria-hidden="true">←</span></button>`; })() : ''}
      ${tab === 'tasks' ? '<div id="cdMonth"></div><div id="onStu" class="on-stu" hidden></div><div id="voiceStu"></div>' : ''}
      <div id="heroBar"></div><div id="seasonBar"></div><div id="annBar"></div><div id="chBar"></div><div id="khBar"></div><div id="aodStu"></div>${tab === 'tasks' ? '<div class="sp-wrap"><div id="prTileW"></div><div id="spTileW"></div></div>' : ''}
      <div class="tabs" role="tablist">
        ${[['tasks', 'واجباتي'], ['practice', 'تدريب حر'], ['mushaf', 'مصحفي'], ['honor', 'لوحة الشرف'], ...(heroT ? [['heroes', '🏆 الأبطال']] : []), ...(iqraOn ? [['iqra', '📖 اقرأ وارتقِ']] : []), ['rewards', `🏅 خزانتي${RW ? ` · 🪙 ${ar(myCoins())}` : ''}`], ['history', 'سجل التسميع'], ['notebook', 'دفتر الأخطاء']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div id="stBody" style="margin-top:16px"></div>
      <div class="fb-cta" id="fbCta"><span class="fb-ico" aria-hidden="true">💬</span><div><b>رأيك يهمنا</b><span>ملاحظتك مهمة لتطوير الموقع: تعليق، شكوى، اقتراح، أو ملاحظة.</span></div><button class="btn gold" type="button" id="stFb">أرسل ملاحظتك<span class="fb-n"></span></button></div>`;
    $('#stFb', app).onclick = () => openFeedback();
    paintFbCta();
    $('#stOut', app).onclick = async () => { await disablePush().catch(() => {}); offNotifs?.(); await store.signOut(); session.set(null); render(); };
    $('#stBell', app).onclick = openBell;
    paintBell(); paintAnnBar(); paintChBar(); paintKhBar(); paintSeason(); paintHeroBar();
    if (tab === 'tasks') mountAyahOfDay($('#aodStu', app), { compact: true });
    if (tab === 'tasks') {
      mountIssueTile($('#spTileW', app), { me, cls, store, openModal, closeModal, toast });
      mountPrayerTile($('#prTileW', app));
      const cdS = () => mountMonthCountdown($('#cdMonth', app), { cfg: CDCFG.v, onHonor: () => { tab = 'honor'; draw(); } });
      cdS(); if (CDCFG.v === undefined) store.getCountdown().then((c) => { CDCFG.v = c || null; cdS(); }).catch(() => { CDCFG.v = null; });
      mountVoiceStu($('#voiceStu', app)); paintOnline();
    }
    startPrayerAlerts((m) => toast(m));
    // إعلان تعديل التعرف على الصوت: يظهر عند كل فتح للموقع، حتى يضغط الطالب «فهمت، لا تظهرها مرة أخرى»
    if (!pref.get('srNotice2_' + me.id) && !srNoticeShown) {
      srNoticeShown = true;
      setTimeout(() => whenModalFree(() => { if ($('#stBody', app) && !pref.get('srNotice2_' + me.id)) showSrNotice(); }), 1200);
    }
    const rk = $('#rwKpi', app); if (rk) rk.onclick = () => { tab = 'rewards'; draw(); $('#stBody', app)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('#stSet', app).onclick = () => { tab = tab === 'settings' ? 'tasks' : 'settings'; draw(); if (tab === 'settings') $('#stBody', app)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    const body = $('#stBody', app);
    if (tab === 'tasks') drawTasks(body, doneTasks);
    if (tab === 'history') drawHistory(body);
    if (tab === 'notebook') drawNotebook(body);
    if (tab === 'practice') drawPractice(body);
    if (tab === 'honor') drawHonor(body);
    if (tab === 'mushaf') drawMushaf(body);
    if (tab === 'rewards') drawRewards(body);
    if (tab === 'heroes') drawHeroes(body);
    if (tab === 'iqra') offIqra = mountIqraStudent(body, { me, toast, confetti });
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

  /** لوحة الشرف للطالب: تتحدّث لحظة نشرها، ومعها «نقاطك الآن» بما كسبه بعد آخر تحديث */
  async function drawHonor(body) {
    body.innerHTML = '<div class="loading">جارٍ تحميل لوحة الشرف…</div>';
    let board, myRank, first = true;
    const paint = () => {
      if (tab !== 'honor' || board === undefined || myRank === undefined) return;
      if (first) {
        body.innerHTML = '<div id="hbLive"></div><div id="chCard"></div><div id="hbB"></div><div id="lsB" class="lists-wrap"></div>';
        drawChCard($('#chCard', body));
      }
      // ما كسبه الطالب من التدريب بعد آخر نشر للوحة (يظهر فوراً، ويدخل الترتيب عند النشر)
      const at = Date.parse(board?.at || '') || 0, pend = pref.get('hmLog_' + me.id, []).filter((x) => x.t > at).reduce((k, x) => k + x.pts, 0) / HM.ratio;
      const pts = (myRank?.month?.points || 0) + pend;
      $('#hbLive', body).innerHTML = `<div class="hb-live"><span class="on-dot"></span><div><b>نقاطك الآن: ${fmt10(Math.round(pts * 10) / 10)}</b>${myRank?.month?.cls ? ` · ترتيبك في صفك ${ar(myRank.month.cls)}` : ''}${myRank?.month?.stage ? ` · وعلى المرحلة ${ar(myRank.month.stage)}` : ''}
        <small class="muted">${pend > 0 ? `منها <b dir="ltr">+${arDec(pend)}</b> من تدريبك الأخير، وتدخل في الترتيب لحظة تحديث اللوحة.` : `اللوحة محدّثة${at ? ` · آخر تحديث ${esc(timeAgo(board.at))}` : ''}، وتتحدّث هنا تلقائياً.`}</small></div></div>`;
      mountBoard($('#hbB', body), board, { me: me.id, myClass: me.classId, myRank, classes: data.classes });
      mountLists($('#lsB', body), board?.lists, { me: me.id, myClass: me.classId, myRank: myRank?.lists, classes: data.classes });
      if (first) {
        first = false;
        // احتفال أول مرة يدخل فيها الخمسة الأوائل في صفه أو المرحلة (لكل شهر)
        const r = myRank?.month;
        if (r && ((r.cls && r.cls <= 5) || (r.stage && r.stage <= 5))) {
          const key = `lbCheer_${me.id}_${board?.month?.ym || ''}_${r.stage && r.stage <= 5 ? 's' : 'c'}`;
          if (!pref.get(key, false)) { pref.set(key, true); setTimeout(() => confetti(), 200); toast(r.stage && r.stage <= 5 ? 'مبارك! أنت من الخمسة الأوائل في المرحلة كلها هذا الشهر.' : 'مبارك! أنت من الخمسة الأوائل في صفك هذا الشهر.'); }
        }
      }
    };
    offHonor?.();
    try {
      const o1 = store.watchBoard((b) => { board = b; paint(); });
      const o2 = store.watchMyRank(me, (r) => { myRank = r ? { ...(me.rankInfo || {}), ...r } : null; paint(); });
      window.__honorPaint = paint;
      offHonor = () => { o1?.(); o2?.(); window.__honorPaint = null; };
    } catch (e) { body.innerHTML = `<div class="empty">تعذر تحميل لوحة الشرف: ${esc(e.code || e.message)}</div>`; }
  }

  async function drawPractice(body) {
    let learn = null;
    try {
      const model = await store.getModel();
      learn = { model, rates: studentRates(model, data.subs), weak: weakRules(model, data.subs, 3) };
    } catch {}
    if (tab !== 'practice') return;
    comp?.destroy();
    body.innerHTML = '<div class="card hm-bar" id="hmBar"></div><div id="prWrap"></div>';
    HS.pts = 0; HS.n = 0; paintHmBar();
    comp = mountPractice($('#prWrap', body), learn, (sec) => logAct('practice', sec), (sub) => { recordProgress(sub); earnTraining(sub); }, hasRecognition ? () => himmaPeek(me.id, riyadhDay()) : null);
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
      <div class="t-main"><b>${r.byStudent ? '🔁 وافق معلمك على طلب الإعادة' : '🔁 معلمك يطلب إعادة التسميع'}</b><h3 style="margin:4px 0 0">${esc(r.taskTitle || 'تسميع')}</h3><div class="t-range">${esc(rangeLabel(r.surah, r.from, r.to))}</div>
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
      const best = mySubs.reduce((m, x) => Math.max(m, subScore(x) ?? -1), -1);
      const overdue = !done.has(t.id) && taskClosed(t);
      const lr = (data.late || []).find((x) => x.id === t.id), allowed = lr?.status === 'ok';
      return `<div class="card task">
        <div class="t-main"><h3>${esc(t.title)}${fresh.has(t.id) && !done.has(t.id) ? ' <span class="pill new-pill">جديد</span>' : ''}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
          <div class="small muted">${t.mode === 'hifz' ? 'تسميع غيباً' : 'تلاوة نظراً'}${taskEnd(t) ? ` · ${overdue ? 'انتهى' : 'التسليم حتى'} ${esc(fmtDT(taskEnd(t)))}` : ''}${t.notes ? ` · ${esc(t.notes)}` : ''}</div></div>
        <div class="row">${done.has(t.id) ? `<span class="pill ok">أُرسل${best >= 0 ? ` · ${fmtQ(best)} من ١٠` : ''}</span>` : overdue ? (allowed ? '<span class="pill ok">✓ سمح لك المعلم</span>' : lr?.status === 'pending' ? '<span class="pill warn">⏳ بانتظار موافقة المعلم</span>' : lr?.status === 'no' ? '<span class="pill mute">اعتذر المعلم</span>' : '<span class="pill bad">انتهى الموعد</span>') : '<span class="pill warn">لم يُنجز</span>'}
        ${done.has(t.id) ? `<button class="btn" type="button" data-prac="${esc(t.id)}">تدرّب عليه</button>${redoCell(t)}` : overdue && !allowed ? (!lr ? `<button class="btn gold" type="button" data-lreq="${esc(t.id)}">اطلب السماح بالتسليم</button>` : `<button class="btn" type="button" data-prac="${esc(t.id)}">تدرّب عليه</button>`) : `<button class="btn primary" type="button" data-task="${esc(t.id)}">ابدأ التسميع</button>`}</div></div>`;
    }).join('')}</div>`;
    $$('[data-task]', body).forEach((b) => (b.onclick = () => openTask(data.tasks.find((t) => t.id === b.dataset.task))));
    $$('[data-lreq]', body).forEach((b) => (b.onclick = () => requestLate(data.tasks.find((x) => x.id === b.dataset.lreq))));
    $$('[data-redo]', body).forEach((b) => (b.onclick = () => requestRedo(data.tasks.find((x) => x.id === b.dataset.redo))));
    $$('[data-prac]', body).forEach((b) => (b.onclick = () => { const t = data.tasks.find((x) => x.id === b.dataset.prac); pendingPractice = { surah: t.surah, from: t.from, to: t.to, mode: t.mode }; tab = 'practice'; draw(); }));
    $$('[data-retake]', body).forEach((b) => (b.onclick = () => startRetake(b.dataset.retake)));
    bindPushInvite(body);
  }
  /** طلب إعادة التسميع: مرة لكل واجب، بموافقة المعلم، وتُعتمد الدرجة الأعلى */
  function redoCell(t) {
    const rq = (data.late || []).find((x) => x.id === 'redo-' + t.id);
    const hasRetake = (data.retakes || []).some((r) => r.taskId === t.id) || data.subs.some((x) => x.taskId === t.id && x.retakeId);
    if (rq?.status === 'pending') return ' <span class="pill warn">⏳ طلبت إعادة التسميع</span>';
    if (rq?.status === 'no') return ' <span class="pill mute">اعتذر المعلم عن الإعادة</span>';
    if (rq || hasRetake) return '';
    return ` <button class="btn" type="button" data-redo="${esc(t.id)}">🔁 اطلب إعادة التسميع</button>`;
  }
  function requestRedo(t) {
    if (!t) return;
    const sub = data.subs.find((x) => x.taskId === t.id && !x.retakeId);
    openModal(`<form id="rdF" class="stack" style="gap:12px">
      <h2>🔁 طلب إعادة التسميع</h2>
      <p class="muted" style="margin:0">«${esc(t.title)}» · ${esc(rangeLabel(t.surah, t.from, t.to))}${sub && subScore(sub) != null ? ` · درجتك الآن ${fmtQ(subScore(sub))} من ١٠` : ''}</p>
      <label class="field">سبب الطلب (اختياري)<textarea id="rdWhy" maxlength="300" placeholder="مثال: لم يتعرف الموقع على بعض الكلمات، أو أخطأت وأريد أن أُحسن."></textarea></label>
      <p class="small muted" style="margin:0">لك طلب واحد لكل واجب. إن وافق معلمك تُفتح لك محاولة جديدة خلال ٢٤ ساعة، وتُعتمد درجتك الأعلى من المحاولتين.</p>
      <div class="row"><button class="btn primary" type="submit">أرسل الطلب</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      $('#rdF', m).onsubmit = async (e) => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const id = 'redo-' + t.id, reason = $('#rdWhy', m).value.trim().slice(0, 300);
        try {
          await store.requestLate(me.id, id, { kind: 'redo', taskId: t.id, subId: sub?.id || null, reason, taskTitle: t.title, name: me.name, classId: me.classId });
          data.late = [...(data.late || []).filter((x) => x.id !== id), { id, kind: 'redo', pn: me.id, status: 'pending', at: new Date().toISOString() }];
          notifyLate(me.id, id).catch(() => {});
          closeModal(); toast('أُرسل طلبك لمعلمك، ويصلك إشعار بقراره.'); draw();
        } catch (err) { btn.disabled = false; toast('تعذر الإرسال: ' + (err.code || err.message)); }
      };
    });
  }

  async function requestLate(t) {
    if (!t) return;
    if (!(await confirmBox(`انتهى موعد «${t.title}». أرسل طلباً لمعلمك ليسمح لك بالتسليم؟`, 'أرسل الطلب'))) return;
    try {
      await store.requestLate(me.id, t.id, { taskTitle: t.title, name: me.name, classId: me.classId });
      data.late = [...(data.late || []).filter((x) => x.id !== t.id), { id: t.id, pn: me.id, status: 'pending', at: new Date().toISOString() }];
      notifyLate(me.id, t.id).catch(() => {});
      toast('أُرسل طلبك للمعلم، ويصلك إشعار بقراره.');
      draw();
    } catch (e) { toast('تعذر الإرسال: ' + (e.code || e.message)); }
  }
  /** واجب أو طلب إعادة: محاولة واحدة تُرسل تلقائياً */
  async function openTask(t, rt = null) {
    // انتهى الموعد: لا يُقبل التسليم إلا بإذن المعلم
    if (t && !rt && taskClosed(t) && !data.subs.some((x) => x.taskId === t.id && !x.retakeId)) {
      try { data.late = await store.listMyLate(me.id); } catch {}
      if ((data.late || []).find((x) => x.id === t.id)?.status !== 'ok') { tab = 'tasks'; draw(); toast('انتهى موعد هذا الواجب. اطلب من معلمك السماح بالتسليم.'); return; }
    }
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
    // واجب تسميع غيباً: يمكن حفظه أولاً بالتلقين المتدرج (لا يُستهلك به التسميع)
    if (!already && (rt?.mode || t?.mode) === 'hifz') {
      $('#tkBody', app).insertAdjacentHTML('beforebegin', '<div class="tq-invite"><span>📖 لم تحفظه بعد؟ احفظه خطوة بخطوة بالتلقين المتدرج، ثم ارجع للتسميع. التلقين لا يُرسل للمعلم ولا يستهلك محاولتك.</span><button class="btn gold" type="button" id="tkTalq">احفظه بالتلقين أولاً</button></div>');
      $('#tkTalq', app).onclick = () => {
        comp?.destroy();
        $('.tq-invite', app)?.remove();
        comp = mountTalqeen($('#tkBody', app), { ...range, reciter: pref.get('reciter', RECITERS[0].id), onActivity: (sec) => logAct('practice', sec), onAyahDone: (x) => { recordProgress(x); earnTraining(x); },
          onExit: () => openTask(t, rt), onFinish: () => openTask(t, rt), finishLabel: '🎙️ إلى التسميع (محاولتك الواحدة)' });
      };
    }
    if (already) { $('#tkBody', app).innerHTML = `<div class="empty">أرسلت محاولتك لهذا ${rt ? 'الطلب' : 'الواجب'}. لكل ${rt ? 'طلب' : 'واجب'} محاولة واحدة، ويمكن لمعلمك أن يطلب منك إعادته.</div>`; return; }
    const cls = data.classes.find((c) => c.id === me.classId);
    comp = mountRecite($('#tkBody', app), {
      ...range, mode: rt?.mode || t?.mode, learn, oneShot: true, graded: true,
      onPractice: () => { comp?.destroy(); comp = null; pendingPractice = { ...range, mode: rt?.mode || t?.mode }; tab = 'practice'; draw(); },
      onSubmit: async (sub, blob) => {
        const extra = rt ? { retakeId: rt.id, retakeOf: rt.subId || null, ...(rt.byStudent ? { retakeByStudent: true } : {}) } : {};
        const id = await store.addSubmission(me.id, { ...sub, ...range, taskId: t?.id || rt?.taskId || null, taskTitle: t?.title || rt?.taskTitle || '', studentName: me.name, classId: me.classId, className: cls?.name || '', teacher: null, ...extra, ...(t && !rt && taskClosed(t) ? { late: true } : {}) }, blob, sid);
        data.subs.unshift({ ...sub, id, pn: me.id, taskId: t?.id || rt?.taskId, ...extra, createdAt: new Date().toISOString() });
        logAct('task', sub.duration || 0);
        recordProgress({ ...sub, ...range });
        // لم يكتمل تحليل التجويد على الجهاز: يتولاه الخادم (فوراً إن لم يكن جارياً هنا، وإلا بعد مهلة إن أُغلقت الصفحة)
        if (!sub.ai && blob && aiEnabled()) {
          store.enqueueAi(me.id, id, !!sub.aiRunning).then(() => { if (!sub.aiRunning) requestServerAi(me.id, id).catch(() => {}); }).catch((e) => console.warn('aiq', e));
        }
        return id;
      },
      onAi: (id, ai) => store.updateOwnAi(me.id, id, ai),
      onAiFail: (id) => requestServerAi(me.id, id).catch(() => {}),
    });
  }

  function drawHistory(body) {
    if (!data.subs.length) { body.innerHTML = '<div class="empty">لم تُرسل أي تسميع بعد.</div>'; return; }
    const gradeCell = (x) => { if (x.teacher) return `${x.teacher.total >= 8 ? '<span class="star" title="درجة متميزة">★</span> ' : ''}<b class="num">${fmtQ(x.teacher.total)}</b>/١٠ <small class="muted">المعلم</small>`; const g = (x.taskId || x.retakeId) && autoGrade(x); return g ? `<b class="num">${fmtQ(g.total)}</b>/١٠ <small class="muted">${g.pending && aiEnabled() ? '⏳ مبدئية' : 'آلية'}</small>` : '<span class="muted">—</span>'; };
    body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المقطع</th><th>الدقة الآلية</th><th>الدرجة</th><th>ملاحظات</th></tr></thead><tbody>
      ${data.subs.map((x, i) => `<tr class="click" data-i="${i}"><td class="num">${fmtDate(x.createdAt)}</td><td>${esc(x.taskTitle || rangeLabel(x.surah, x.from, x.to))}</td>
      <td>${x.percent == null ? '<span class="pill mute">بانتظار المعلم</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td>
      <td>${gradeCell(x)}${x.late ? ' <span class="pill warn">متأخر</span>' : ''}</td><td style="white-space:normal;min-width:160px">${esc(x.teacher?.notes || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
    $$('tr[data-i]', body).forEach((r) => (r.onclick = () => {
      const x = data.subs[+r.dataset.i];
      openModal(`<h2>${esc(x.taskTitle || 'تسميع')}</h2><p class="muted">${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)}</p>
        ${!x.teacher && (x.taskId || x.retakeId) && autoGrade(x) ? (() => { const g = autoGrade(x); return `<div class="card" style="margin-bottom:12px"><b>الدرجة الآلية: ${fmtQ(g.total)} / ١٠</b><div class="small muted">${ar(g.v)} خطأ في الكلمات${x.ai ? ` · ${ar(g.t)} ملاحظة تجويد` : g.pending && aiEnabled() ? ' · ⏳ تكتمل بعد تحليل التجويد' : ''}</div></div>`; })() : ''}
        ${x.teacher ? `<div class="card" style="margin-bottom:12px"><b>درجة المعلم: ${fmtQ(x.teacher.total)} / ١٠</b>${x.teacher.notes ? `<p style="margin:8px 0 0">${esc(x.teacher.notes)}</p>` : ''}</div>` : ''}
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
  return { destroy: () => { comp?.destroy(); offNotifs?.(); offInstall?.(); offHero?.(); offLive?.(); stopCheer(); } };
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
  let tab = 'home'; // تبدأ كل زيارة من «لوحة اليوم»
  let fbSelInit = null, fbViewInit = null;
  if (/^#\/teacher\/feedback/.test(location.hash)) { tab = 'fb'; const k = location.hash.split('/')[3]; if (k) { fbSelInit = decodeURIComponent(k).replace('~', '|'); fbViewInit = 'fb'; } history.replaceState(null, '', '#/teacher'); }
  let repMonthDeep = null;
  if (/^#\/teacher\/report/.test(location.hash)) { tab = 'reports'; repMonthDeep = location.hash.split('/')[3] || null; history.replaceState(null, '', '#/teacher'); }
  if (/^#\/teacher\/review/.test(location.hash)) { tab = 'honor'; history.replaceState(null, '', '#/teacher'); }
  if (/^#\/teacher\/late/.test(location.hash)) { tab = 'tasks'; history.replaceState(null, '', '#/teacher'); }
  if (/^#\/teacher\/redo/.test(location.hash)) { tab = 'subs'; history.replaceState(null, '', '#/teacher'); }
  if (/^#\/teacher\/watch/.test(location.hash)) { tab = 'watch'; history.replaceState(null, '', '#/teacher'); }
  let lateReqs = [];
  /* تحليل التجويد الإلزامي: ما لم يكتمل على جهاز الطالب (فشل أو أغلق الصفحة) يحلّله جهاز المعلم فوراً، واحداً بعد الآخر */
  let aiQT = null, aiQBusy = false, aiQForce = false;
  const aiQ = { done: 0, total: 0, cur: null };
  // الخادم يحلّل ما فات فوراً؛ جهاز المعلم احتياط لما بقي بعد ١٥ دقيقة (إن تعطّل الخادم)
  const SERVER_GRACE = 15 * 60e3;
  const aiNeeds = (y, force = false) => {
    const g = autoGrade(y);
    if (!g) return false;
    if (force) return !y.ai && !!y.hasAudio && !!(y.taskId || y.retakeId) && !y.teacher;
    return g.pending && (y.aiTries || 0) < 3 && Date.now() - new Date(y.createdAt || 0) > SERVER_GRACE;
  };
  const aiPendingList = (force = false) => D.subs.filter((y) => aiNeeds(y, force));
  function pendingAiQueue() {
    clearTimeout(aiQT);
    const tick = async () => {
      if (aiQBusy || !aiEnabled()) return;
      if (document.hidden && !aiQForce) { aiQT = setTimeout(tick, 20e3); return; }
      const x = aiPendingList(aiQForce)[0];
      if (!x) { if (aiQForce) { aiQForce = false; aiQ.cur = null; paintAiBar(); if (aiQ.done) toast(`✓ اكتمل تحليل ${ar(aiQ.done)} ${aiQ.done <= 10 ? 'تسليمات' : 'تسليماً'} ورُصدت درجاتها.`); } aiQT = setTimeout(tick, 20e3); return; }
      aiQBusy = true; aiQ.cur = x; paintAiBar();
      try {
        const blob = await store.getAudio(x.pn, x.id);
        if (!blob) { await store.updateSubmission(x.pn, x.id, { aiFail: true }); x.aiFail = true; }
        else {
          const ai = await aiAnalyze(blob, x, () => {});
          await store.updateSubmission(x.pn, x.id, { ai, aiFail: false }); x.ai = ai; x.aiFail = false;
          aiQ.done++;
          notifyAutoGrade(x);
        }
        schedulePublish();
      } catch (e) {
        console.warn('ai queue', e);
        const n = (x.aiTries || 0) + 1;
        await store.updateSubmission(x.pn, x.id, { aiTries: n, ...(n >= 3 ? { aiFail: true } : {}) }).catch(() => {});
        x.aiTries = n; if (n >= 3) x.aiFail = true;
        if (aiQForce) x._skip = true;
      }
      aiQBusy = false; aiQ.cur = null; paintAiBar();
      if (tab === 'subs') { const sl = document.getElementById('subList'); if (sl) drawBody(); }
      aiQT = setTimeout(tick, 1500); // التالي مباشرة
    };
    pendingAiQueue.tick = tick;
    aiQT = setTimeout(tick, 3e3);
  }
  /** زر أعلى التسليمات: يحلّل كل ما لم يُحلَّل الآن، ومنه ما فشل سابقاً */
  function runAiNow() {
    D.subs.forEach((y) => { if (aiNeeds(y, true)) { y.aiTries = 0; y.aiFail = false; y.aiRunning = false; delete y._skip; } });
    aiQForce = true; aiQ.done = 0; aiQ.total = aiPendingList(true).length;
    paintAiBar();
    clearTimeout(aiQT); if (!aiQBusy) pendingAiQueue.tick?.();
  }
  function paintAiBar() {
    const el = document.getElementById('aiBar');
    if (!el) return;
    const n = aiEnabled() ? aiPendingList(true).filter((y) => !y._skip).length : 0;
    if (!n && !aiQ.cur) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = aiQ.cur
      ? `<div class="row" style="gap:10px;align-items:center"><span>⏳ 🤖 جارٍ تحليل تجويد <b>${esc(aiQ.cur.studentName || '')}</b>… ${aiQForce && aiQ.total ? `(${ar(Math.min(aiQ.done + 1, aiQ.total))} من ${ar(aiQ.total)})` : `· بقي ${ar(n)}`}</span></div><div class="small muted">تُرصد الدرجة تلقائياً بعد كل تحليل، ولك تعديلها من التسليم. أبقِ هذه الصفحة مفتوحة حتى ينتهي.</div>`
      : `<div class="row" style="gap:10px;align-items:center;justify-content:space-between"><span>🤖 <b>${ar(n)}</b> ${n === 1 ? 'تسليم لم يُحلَّل تجويده' : n === 2 ? 'تسليمان لم يُحلَّل تجويدهما' : 'تسليمات لم يُحلَّل تجويدها'} بعد</span><button class="btn gold sm" type="button" id="aiRun">حلّل التسليمات غير المحلّلة ورصد درجاتها</button></div>`;
    const b = document.getElementById('aiRun'); if (b) b.onclick = runAiNow;
  }
  /** إشعار الطالب بدرجته الآلية بعد اكتمال تحليل التجويد من جهاز المعلم */
  async function notifyAutoGrade(x) {
    try {
      const g = autoGrade(x); if (!g || x.teacher) return;
      const nid = await store.addStudentNotif(x.pn, { type: 'grade', score: g.total, subId: x.id, title: '⭐ اكتمل تحليل تسميعك ورُصدت درجتك', body: `اكتمل تحليل تجويد «${x.taskTitle || rangeLabel(x.surah, x.from, x.to)}» ورُصدت درجتك مبدئياً ${fmtQ(g.total)} من ١٠. سيطّلع عليها معلمك قريباً ويتأكد منها، وتصلك رسالة أخرى بتأكيد الدرجة.`, link: `./#/student/grade/${x.id}`, tag: 'grade-' + x.id });
      sendPush(nid, x.pn).catch(() => {});
    } catch (e) { console.warn('notify grade', e); }
  }
  const loadLate = () => store.listAllLate().then((L) => { lateReqs = L; if (tab === 'tasks') drawBody(); else if (tab === 'subs') paintRedo(); else drawHead?.(); }).catch((e) => console.warn('late', e));
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
      app.innerHTML = e.code === 'permission-denied' || e.code === 'unauthenticated'
        ? `<div class="empty"><div style="font-size:40px">🔐</div><b>انتهت جلسة المعلم على هذا الجهاز</b><br>يحدث هذا غالباً إذا دخلت بحساب طالب على الجهاز نفسه، فيحلّ محلّ دخول المعلم.<br>سجّل دخول المعلم من جديد وتعود لوحتك كما هي.<br><br><button class="btn primary" id="tOut2">دخول المعلم من جديد</button></div>`
        : `<div class="empty">تعذر تحميل البيانات (${esc(e.code || e.message)}). تحقق من الاتصال ثم أعد المحاولة.<br><br><button class="btn" id="tOut2">تسجيل الخروج</button></div>`;
      $('#tOut2', app).onclick = async () => { await store.signOut(); session.set(null); render(); };
      return;
    }
    refreshPush(tOwner);
    loadFb(); loadLate(); pendingAiQueue();
    Promise.all([store.listAllChallenges(), store.getChallengeCfg().catch(() => null), store.listAllHimma().catch((e) => { console.warn('himma', e); return []; })]).then(([L, cfg, H]) => {
      setChPts(cfg?.pts); D.challenges = L; D.himma = H; schedulePublish(); if (tab === 'honor') drawBody();
      // بعد التحميل الأول: متابعة لحظية، فكل تدريب أو تحدٍّ يعيد حساب اللوحة ونشرها خلال ثوانٍ
      D._offHm?.(); D._offCh?.();
      let hj = '', cj = '';
      D._offHm = store.watchAllHimma((H2) => { const j = JSON.stringify(H2.map((h) => [h.pn, h.d, h.hp, h.hm, h.hs])); if (j === hj) return; const first = !hj; hj = j; D.himma = H2; if (!first) { liveBump('hm'); schedulePublish(1000); } });
      D._offCh = store.watchAllChallenges((L2) => { const j = JSON.stringify(L2.map((c) => [c.id, c.status, c.ra?.p, c.rb?.p, c.cancelled])); if (j === cj) return; const first = !cj; cj = j; D.challenges = L2; if (!first) { liveBump('ch'); schedulePublish(1000); } });
    }).catch((e) => console.warn('challenges', e));
    store.listSeasons().then((L) => { D.seasons = L; schedulePublish(); if (tab === 'honor') drawBody(); }).catch((e) => console.warn('seasons', e));
    store.listKhatmas().then((L) => { D.khatmas = L; schedulePublish(); if (tab === 'honor') drawBody(); }).catch((e) => console.warn('khatmas', e));
    loadHeroesT();
    loadIqraT();
    loadRewardsT().catch((e) => console.warn('rewards', e));
    unsub?.();
    watchPresenceT();
    unsub = store.watchSubmissions((subs) => { D.subs = subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); schedulePublish(); if (!load.mb) { load.mb = true; setTimeout(checkMonthBar, 300); setTimeout(migrateGrades, 1500); } setTimeout(replaceRetaken, 800); if (tab === 'subs' || tab === 'reports' || tab === 'honor') drawBody(); else drawHead(); }, (e) => toast('تعذر تحديث التسليمات: ' + (e.code || e.message)));
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
      <div class="tshell">
        <nav class="tnav" aria-label="أقسام المعلم">${TNAV.map(([k, l, i, main]) => `<button type="button" data-tab="${k}" class="${(TGROUP[tab] || tab) === k ? 'on' : ''}${main ? ' tn-main' : ''}"><i aria-hidden="true">${i}</i><span>${l}</span>${TBADGE[k] || k === 'subs' ? `<b class="tab-n${k === 'watch' ? ' on-n' : ''}" data-badge="${k === 'subs' ? 'subsg' : k}"></b>` : ''}</button>`).join('')}
          <button type="button" class="tn-more" id="tnMore"><i aria-hidden="true">☰</i><span>المزيد</span><b class="tab-n" data-badge="more"></b></button></nav>
        <div class="tmain">
          <div class="tsearch"><input type="search" id="tSearch" placeholder="🔍 ابحث عن طالب أو قسم… (مثلاً: يوسف، الإعلانات)" autocomplete="off" aria-label="بحث"><div class="tsr" id="tSR" hidden></div></div>
          <div id="tHero"></div>
          <div id="tHomeTop"><div id="monthBar"></div><div id="attn"></div></div>
          <div class="tsub" id="tSub" hidden></div>
          <div id="tBody" style="margin-top:16px"></div>
          <div id="tHome">
            <h3 class="th-sub">📈 أرقام المقرأة</h3>
            <div class="kpis" id="tKpis"></div>
            <div id="cdMonthT" style="margin-top:12px"></div>
          </div>
        </div>
      </div>`;
    mountCdT();
    if (CDCFG.v === undefined) store.getCountdown().then((c) => { CDCFG.v = c || null; mountCdT(); checkMonthBar(); roundTick(); }).catch(() => { CDCFG.v = null; });
    if (!window.__roundT) window.__roundT = setInterval(() => roundTick(), 30e3);
    $('#tOut', app).onclick = async () => { unsub?.(); if (pushState('teacher') === 'on') await disablePush().catch(() => {}); await store.signOut(); session.set(null); render(); };
    $$('[data-tab]', app).forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
    $('#tnMore', app).onclick = openMoreSheet;
    wireSearch();
    drawBody();
  }
  /** الانتقال إلى قسم من أي مكان (الشريط، والمربعات، والبحث) */
  function goTab(k) {
    tab = k; pref.set('tTab', tab);
    $$('.tnav [data-tab]', app).forEach((x) => x.classList.toggle('on', x.dataset.tab === (TGROUP[k] || k)));
    $('#tnMore', app)?.classList.toggle('on', !TNAV.find((t) => t[0] === (TGROUP[k] || k))?.[3]);
    closeModal(); drawBody(); scrollTo({ top: 0 });
  }
  /** «☰ المزيد» على الجوال: بقية الأقسام */
  function openMoreSheet() {
    openModal(`<div class="stack"><h3 style="margin:0">☰ كل الأقسام</h3><div class="more-g">${TNAV.filter((t) => !t[3]).map(([k, l, i]) => `<button type="button" data-go="${k}" class="${tab === k ? 'on' : ''}"><i>${i}</i><span>${l}</span>${TBADGE[k] ? `<b class="tab-n" data-badge="${k}">${esc(badgeVal[k] || '')}</b>` : ''}</button>`).join('')}</div></div>`, (m) => {
      m.classList.add('sheet-modal');
      $$('[data-go]', m).forEach((b) => (b.onclick = () => goTab(b.dataset.go)));
    });
  }
  /** شارات الأرقام على الأقسام (في الشريط والمزيد والمربعات) */
  const badgeVal = {};
  function setBadge(k, n) {
    badgeVal[k] = n ? ar(n) : '';
    $$(`[data-badge="${k}"]`).forEach((b) => (b.textContent = badgeVal[k]));
    if (k === 'iqra') $$('[data-badge="subsg"]').forEach((b) => (b.textContent = badgeVal[k]));
    const more = TNAV.filter((t) => !t[3] && t[0] !== 'watch').reduce((x, t) => x + (+String(badgeVal[t[0]] || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)) || 0), 0);
    $$('[data-badge="more"]').forEach((b) => (b.textContent = more ? ar(more) : ''));
  }
  /* --- البحث السريع: طالب أو قسم --- */
  function wireSearch() {
    const inp = $('#tSearch', app), out = $('#tSR', app); if (!inp) return;
    const norm = (x) => String(x || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652]/g, '').trim();
    const show = () => {
      const q = norm(inp.value); if (!q) { out.hidden = true; return; }
      const secs = TALL.filter(([, l]) => norm(l).includes(q)).slice(0, 4);
      const stus = D.students.filter((x) => norm(x.name).includes(q) || x.id.includes(inp.value.trim())).slice(0, 6);
      out.innerHTML = [...secs.map(([k, l, i]) => `<button type="button" data-go="${k}"><i>${i}</i> ${esc(l)} <small class="muted">قسم</small></button>`),
        ...stus.map((x) => `<button type="button" data-stu="${esc(x.id)}">${isOnline(D.presence?.[x.id]) ? '<span class="on-dot"></span>' : '👤'} <b data-lk="${esc(x.id)}" data-lk-no-title>${esc(x.name)}</b> <small class="muted">${esc(className(x.classId))} · ${esc(x.id)}</small></button>`)].join('') || '<div class="muted small" style="padding:10px">لا نتائج.</div>';
      out.hidden = false;
      $$('[data-go]', out).forEach((b) => (b.onclick = () => { inp.value = ''; out.hidden = true; goTab(b.dataset.go); }));
      $$('[data-stu]', out).forEach((b) => (b.onclick = () => { inp.value = ''; out.hidden = true; openStudentQuick(b.dataset.stu); }));
    };
    inp.oninput = show; inp.onfocus = show;
    inp.onkeydown = (e) => { if (e.key === 'Enter') out.querySelector('button')?.click(); if (e.key === 'Escape') { inp.value = ''; out.hidden = true; } };
    document.addEventListener('click', (e) => { if (!e.target.closest('.tsearch')) out.hidden = true; });
  }
  /** بطاقة سريعة لطالب من البحث */
  function openStudentQuick(pn) {
    const st = D.students.find((x) => x.id === pn); if (!st) return;
    const P = D.presence?.[pn], miss = missingOf(st, doneMap()), subs = D.subs.filter((x) => x.pn === pn).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const pend = subs.filter((x) => !x.teacher).length, last = subs[0];
    openModal(`<div class="stack"><h2 style="margin:0"><span data-lk="${esc(pn)}">${esc(st.name)}</span></h2>
      <p class="small muted" style="margin:0">${esc(className(st.classId))} · الرقم ${esc(pn)} · ${isOnline(P) ? '<span class="on-dot"></span> متصل الآن' : P ? 'آخر ظهور ' + esc(agoTxt(Math.min(P.t || 0, P.off || Infinity))) : 'لم يظهر منذ تفعيل المتابعة'}</p>
      <div class="wu-kpi"><div><b>${ar(subs.length)}</b><span>تسميعاً</span></div><div><b>${ar(pend)}</b><span>بانتظار تقييمك</span></div><div><b>${ar(miss.length)}</b><span>واجبات ناقصة</span></div></div>
      ${last ? `<p class="small" style="margin:0">آخر تسميع: ${esc(rangeLabel(last.surah, last.from, last.to))} · ${last.percent != null ? ar(last.percent) + '٪ · ' : ''}${esc(timeAgo(last.createdAt))}</p>` : ''}
      ${miss.length ? `<div class="wm-ts">${miss.map((t) => `<span class="wm-t${taskClosed(t) ? ' closed' : ''}">${esc(t.title)}</span>`).join('')}</div>` : ''}
      <div class="row"><button class="btn" type="button" id="sqM">📖 مصحفه وأخطاؤه</button>${miss.length ? '<button class="btn" type="button" id="sqR">🔔 ذكّره بواجباته</button>' : ''}<button class="btn" type="button" id="sqS">📥 تسليماته</button><button class="btn" type="button" id="sqW">👀 في المتابعة</button><button class="btn primary" type="button" data-close>إغلاق</button></div></div>`, (m) => {
      $('#sqM', m).onclick = () => { closeModal(); openStudentMushaf(st); };
      $('#sqW', m).onclick = () => goTab('watch');
      $('#sqS', m).onclick = () => { filters = { cls: 'all', task: 'all', q: st.name, status: 'all' }; goTab('subs'); };
      const r = $('#sqR', m); if (r) r.onclick = async () => {
        r.disabled = true;
        const names = miss.slice(0, 3).map((t) => `«${t.title}»`).join('، ') + (miss.length > 3 ? ` و${ar(miss.length - 3)} غيرها` : '');
        const nid = await store.addStudentNotif(pn, { type: 'remind', title: '📋 تذكير من معلمك', body: `بقي عليك ${nWord(miss.length, 'واجب واحد', 'واجبان', 'واجبات', 'واجباً')}: ${names}.`, link: './#/student', tag: 'remind-' + pn + '-' + riyadhDay() }).catch(() => null);
        if (nid) sendPush(nid, pn).catch(() => {});
        r.textContent = nid ? '✓ ذُكّر' : 'تعذر';
      };
    });
  }
  /* --- «لوحة اليوم»: ملخّص اليوم ومربع لكل قسم بحاله --- */
  function drawHome(body) {
    const dm = doneMap(), pending = D.subs.filter((x) => !x.teacher).length;
    const missStu = D.students.filter((x) => missingOf(x, dm).length).length;
    const online = Object.values(D.presence || {}).filter(isOnline).length;
    const open = D.tasks.filter((t) => taskStarted(t) && !taskClosed(t));
    const soon = open.map((t) => taskEnd(t)).filter(Boolean).sort()[0];
    const today = new Date(Date.now() + 3 * 3600e3), ymEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    const daysLeft = Math.ceil((ymEnd - today) / 864e5);
    const hr = today.getUTCHours(), hi = hr < 12 ? 'صباح الخير' : 'مساء الخير';
    const hero = $('#tHero', app);
    if (hero) hero.innerHTML = `<div class="th-hero"><div><b>${hi} يا ${esc((s.name || 'أستاذ').split(' ')[0])}</b><small>${esc(ar(new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Bahrain' })))}</small></div>
      <div class="th-k"><button type="button" data-hk="subs"><b>${ar(pending)}</b>تنتظر تقييمك</button><button type="button" data-hk="watch"><b>${ar(missStu)}</b>لم يسمّعوا</button><button type="button" data-hk="watch"><b>${ar(online)}</b><span>${online ? '<span class="on-dot"></span>' : ''}متصل الآن</span></button></div></div>`;
    $$('[data-hk]', hero || body).forEach((b) => (b.onclick = () => goTab(b.dataset.hk)));
    const relDay = (iso) => { const d = Math.round((Date.parse(riyadhDay(new Date(iso))) - Date.parse(riyadhDay())) / 864e5); return d <= 0 ? 'اليوم' : d === 1 ? 'غداً' : `بعد ${nWord(d, 'يوم', 'يومين', 'أيام', 'يوماً')}`; };
    const T = {
      subs: [pending ? `${ar(pending)} تسليماً ينتظر التقييم` : 'لا شيء ينتظرك ✓', pending, 'r'],
      watch: [`${missStu ? `${ar(missStu)} لم يسمّعوا` : 'سمّع الجميع ✓'}${online ? ` · ${ar(online)} متصل` : ''}`, online, 'g'],
      tasks: [open.length ? `${ar(open.length)} مفتوحة${soon ? ` · ينتهي أحدها ${relDay(soon)}` : ''}` : 'لا واجبات مفتوحة'],
      people: [`${ar(D.students.length)} طالباً · ${ar(D.classes.length)} صفوف`],
      ann: ['أرسل إعلاناً أو صمّمه'],
      honor: [`الفائزون بعد ${nWord(daysLeft, 'يوم', 'يومين', 'أيام', 'يوماً')} · المتجر وصوت الأسبوع`],
      iqra: [badgeVal.iqra ? `${badgeVal.iqra} بانتظار مراجعتك` : 'خطة الضعاف في القراءة', badgeVal.iqra ? 1 : 0, 'r'],
      errors: ['أكثر الأخطاء ودرجاتها'],
      fb: [badgeVal.fb ? `${badgeVal.fb} رسائل جديدة` : 'آراء الطلاب وشكاواهم', badgeVal.fb ? 1 : 0, 'r'],
      reports: ['تقارير وتصدير Excel'],
      settings: ['الإعداد والمساحة والتنبيهات'],
    };
    body.innerHTML = `<div class="th-tiles">${TALL.filter((t) => t[0] !== 'home').map(([k, l, i, main]) => `<button type="button" class="th-tile${main ? ' big' : ''}" data-go="${k}">${T[k]?.[1] ? `<b class="th-n ${T[k][2]}">${k === 'iqra' || k === 'fb' ? esc(badgeVal[k]) : ar(T[k][1])}</b>` : ''}<i>${i}</i><b>${l}</b><small>${esc(T[k]?.[0] || '')}</small></button>`).join('')}</div>`;
    $$('[data-go]', body).forEach((b) => (b.onclick = () => goTab(b.dataset.go)));
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
    paintAttention();
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
  let offIqraT = null;
  function drawIqraT(body) {
    offIqraT = mountIqraTeacher(body, { students: D.students.filter(hasAcc), classes: D.classes, toast, onChange: ({ cfg, states }) => { D.iqraCfg = cfg; D.iqra = states; schedulePublish(); } });
  }
  /** «اقرأ وارتقِ»: الإعداد وتقدم الطلاب المختارين (لنقاط لوحة الشرف) وعدد الكلمات المنتظرة */
  async function loadIqraT() {
    try {
      const cfg = await iqraCfg(); D.iqraCfg = cfg;
      const pns = cfg.pns.filter((p) => D.students.some((s) => s.id === p));
      const S = await Promise.all(pns.map((p) => store.getIqra(p).catch(() => null)));
      D.iqra = Object.fromEntries(pns.map((p, i) => [p, S[i]]));
      schedulePublish();
      const R = await Promise.all(pns.map((p) => store.listIqraRev(p).catch(() => [])));
      const n = R.flat().filter((r) => r.status === 'pending').length;
      setBadge('iqra', n); if (tab === 'home' && $('#tBody', app)) drawHome($('#tBody', app));
    } catch (e) { console.warn('iqra', e); }
  }
  function drawBody() {
    drawHead();
    const body = $('#tBody', app); if (!body) return;
    offIqraT?.(); offIqraT = null;
    $('#tHome', app)?.toggleAttribute('hidden', tab !== 'home'); $('#tHomeTop', app)?.toggleAttribute('hidden', tab !== 'home');
    const sub = $('#tSub', app);
    if (sub) {
      sub.hidden = !TGROUP[tab];
      if (TGROUP[tab]) {
        sub.innerHTML = TSUB.map(([k, l, i]) => `<button type="button" data-st="${k}" class="${tab === k ? 'on' : ''}"><i>${i}</i><span>${l}</span>${k === 'iqra' ? `<b class="tab-n" data-badge="iqra">${esc(badgeVal.iqra || '')}</b>` : k === 'subs' && D.subs.filter((x) => !x.teacher).length ? `<b class="tab-n">${ar(D.subs.filter((x) => !x.teacher).length)}</b>` : ''}</button>`).join('');
        $$('[data-st]', sub).forEach((b) => (b.onclick = () => goTab(b.dataset.st)));
        sub.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    }
    if (tab !== 'home') { const h = $('#tHero', app); if (h) h.innerHTML = ''; }
    ({ home: drawHome, subs: drawSubs, watch: drawWatch, tasks: drawTasks, people: drawPeople, ann: drawAnn, errors: drawErrors, honor: drawHonorT, iqra: drawIqraT, fb: drawFb, reports: drawReports, settings: drawSettings })[tab](body);
    sectionize(body);
  }

  /* --- الأقسام مربعات: التبويبات الطويلة تُعرض أقسامها مربعات في الأعلى، والنقر يفتح القسم وحده --- */
  const SECT_TABS = new Set(['iqra', 'settings', 'honor', 'reports', 'watch']);
  const FIXED_SEC = new Set(['honor']); // أقسام ثابتة الشريط، يظهر قسم واحد دائماً
  let secObs = null;
  let secGen = 0;
  function sectionize(body) {
    secObs?.disconnect(); secObs = null;
    const gen = ++secGen; // كل استدعاء يُبطل ما قبله: مؤقت قديم معلّق كان يعيد إدراج شريطه فتتكرر الأشرطة
    body.querySelectorAll('.sec-bar').forEach((x) => x.remove());
    if (!SECT_TABS.has(tab)) return;
    const myTab = tab, key = 'tSec_' + myTab;
    const bar = document.createElement('div'); bar.className = 'sec-bar';
    body.prepend(bar);
    let last = '', timer = 0;
    const titleOf = (el) => { const h = el.querySelector('h2, h3'); if (!h) return null; const c = h.cloneNode(true); c.querySelectorAll('.pill, .small, .tab-n').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
    const badgeOf = (el) => { const b = (el.querySelector('h2 .pill, h3 .pill')?.textContent || '').trim(); return /^[0٠]$/.test(b) ? '' : b; };
    const sections = () => {
      let c = body;
      for (;;) { const kids = [...c.children].filter((x) => x !== bar); if (kids.length === 1 && !kids[0].classList.contains('card') && kids[0].children.length) c = kids[0]; else break; }
      return [...c.children].filter((x) => x !== bar && !x.matches('.sec-bar')).map((el) => ({ el, t: titleOf(el), b: badgeOf(el) })).filter((x) => x.t);
    };
    const keyOf = (t) => t.replace(/[\d٠-٩]+/g, '').replace(/[^\p{L}\s]/gu, '').trim();
    const render = () => {
      if (gen !== secGen) { bar.remove(); return; }
      if (tab !== myTab || !body.isConnected) return;
      if (!bar.isConnected) { body.querySelectorAll('.sec-bar').forEach((x) => x.remove()); body.prepend(bar); last = ''; } // أعاد القسم رسم الصفحة كلها
      const S = sections();
      if (S.length < 2) { bar.hidden = true; S.forEach((x) => (x.el.style.display = '')); return; }
      bar.hidden = false;
      const sel = pref.get(key, null), fixed = FIXED_SEC.has(myTab);
      const cur = S.find((x) => keyOf(x.t) === sel) || (fixed ? S[0] : null); // الأقسام الثابتة: يُفتح الأول افتراضاً
      const sig = (cur ? keyOf(cur.t) : '') + '|' + S.map((x) => x.t + x.b).join('|');
      if (sig !== last) {
        last = sig;
        bar.className = 'sec-bar' + (cur ? ' strip' : '') + (fixed ? ' fixed' : '');
        bar.innerHTML = (cur && !fixed ? '<button type="button" class="sec-all" data-sec="">☰ كل الأقسام</button>' : '') + S.map((x) => {
          const m = x.t.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u);
          const ICON = [[/مساحة/, '💾'], [/حفظ/, '🗄️'], [/استهلاك/, '📊'], [/إشعار/, '🔔'], [/خادم/, '🤖'], [/شيخ/, '👑'], [/متوسط|دقة/, '📈'], [/خريطة/, '🗺️'], [/طلاب|الطالب/, '👥'], [/أخطاء/, '⚠️']];
          const ic = m ? m[1] : (ICON.find(([r]) => r.test(x.t)) || [0, '📌'])[1], name = (m ? x.t.slice(m[0].length) : x.t).replace(/\s*[·•].*$/, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
          return `<button type="button" class="sec-tile${cur && cur.el === x.el ? ' on' : ''}" data-sec="${esc(keyOf(x.t))}"><span class="sec-ic">${ic}</span><span class="sec-name">${esc(name)}</span>${x.b ? `<span class="sec-b">${esc(x.b)}</span>` : ''}</button>`;
        }).join('');
        bar.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => { pref.set(key, b.dataset.sec || null); last = ''; render(); if (fixed) { if (bar.getBoundingClientRect().top < 0 || body.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start' }); } else body.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
        if (fixed) bar.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
      S.forEach((x) => (x.el.style.display = cur && cur.el === x.el ? '' : 'none'));
    };
    secObs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(render, 80); });
    secObs.observe(body, { childList: true, subtree: true, characterData: true });
    render();
  }

  /* --- يحتاجون انتباهك --- */
  let attnDone = null, attnOpen = false;
  const ATTN_DAYS = 14;
  function attentionList() {
    const today = riyadhDay(), now = Date.now();
    const byPn = {};
    D.subs.forEach((x) => (byPn[x.pn] = byPn[x.pn] || []).push(x));
    const out = [];
    D.students.filter(hasAcc).forEach((s) => {
      const subs = (byPn[s.id] || []).slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      const reasons = [];
      // ١) تراجع: متوسط آخر ٣ أقل من متوسط ما قبلها بـ١٫٥ من ١٠ فأكثر
      const sc = subs.map(subScore).filter((v) => v != null);
      if (sc.length >= 5) {
        const last = sc.slice(-3), prev = sc.slice(0, -3);
        const a = last.reduce((n, v) => n + v, 0) / last.length, b = prev.reduce((n, v) => n + v, 0) / prev.length;
        if (b - a >= 1.5) reasons.push({ k: 'drop', t: `📉 تراجعت درجاته: ${fmtQ(Math.round(b * 10) / 10)} ← ${fmtQ(Math.round(a * 10) / 10)}` });
      }
      // ٢) انقطاع أسبوع: لا تسميع ولا تدريب منذ ٧ أيام
      const lastSub = subs.length ? riyadhDay(new Date(subs[subs.length - 1].createdAt)) : '';
      const lastAct = [lastSub, s.streak?.on || ''].sort().pop() || '';
      const since = lastAct || (s.accountAt || s.createdAt ? riyadhDay(new Date(s.accountAt || s.createdAt)) : '');
      if (since && since <= addDays(today, -7)) {
        const d = Math.round((new Date(today) - new Date(since)) / 864e5);
        reasons.push({ k: 'idle', t: lastAct ? `💤 منقطع منذ ${nWord(d, 'يوم', 'يومين', 'أيام', 'يوماً')}` : `💤 لم يبدأ بعد (حسابه منذ ${nWord(d, 'يوم', 'يومين', 'أيام', 'يوماً')})` });
      }
      // ٣) فاته واجبان فأكثر انتهى موعدهما
      const done = new Set(subs.map((x) => x.taskId).filter(Boolean));
      const missed = D.tasks.filter((t) => taskClosed(t) && taskFor(t, s) && !done.has(t.id) && (t.createdAt || '') >= (s.accountAt || s.createdAt || '')).length; // لا يُحاسب على واجبات قبل إضافته
      if (missed >= 2) reasons.push({ k: 'miss', t: `📋 فاته ${nWord(missed, 'واجب واحد', 'واجبان', 'واجبات', 'واجباً')}` });
      if (!reasons.length) return;
      const keys = reasons.map((r) => r.k).sort().join(',');
      const dn = attnDone?.[s.id];
      if (dn && now - new Date(dn.at).getTime() < ATTN_DAYS * 864e5 && reasons.every((r) => dn.keys.split(',').includes(r.k))) return; // تابعه المعلم ولم يظهر سبب جديد
      out.push({ s, reasons, keys });
    });
    return out.sort((a, b) => b.reasons.length - a.reasons.length || a.s.name.localeCompare(b.s.name, 'ar'));
  }
  const CHEER = {
    drop: (n) => `${n}، لاحظتُ أن درجاتك الأخيرة أقل من مستواك المعتاد. أنا واثق أنك قادر على العودة أقوى؛ راجع المقطع جيداً وسمّع من جديد بإذن الله 🌱`,
    idle: (n) => `${n}، افتقدناك في المقرأة هذه الأيام! دقيقة واحدة من التدريب اليوم تعيدك إلى سلسلتك، وأنا أنتظر تسميعك 🔥`,
    miss: (n) => `${n}، فاتتك بعض الواجبات. لا بأس، ابدأ بأقربها اليوم، وأنا معك خطوة بخطوة 🤍`,
  };
  async function paintAttention() {
    const host = $('#attn', app); if (!host) return;
    if (attnDone === null) { attnDone = {}; store.getAttention().then((v) => { attnDone = v || {}; paintAttention(); }).catch(() => {}); return; }
    const L = attentionList();
    if (!L.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="attn card">
      <button type="button" class="attn-head" id="attnT" aria-expanded="${attnOpen}"><span>👀 <b>${nWord(L.length, 'طالب واحد يحتاج', 'طالبان يحتاجان', 'طلاب يحتاجون', 'طالباً يحتاجون')} انتباهك</b></span><span class="small muted">${attnOpen ? 'إخفاء ▴' : 'عرض ▾'}</span></button>
      ${attnOpen ? `<ul class="attn-list">${L.map(({ s, reasons }) => `<li>
        <div class="attn-who"><b>${esc(s.name)}</b><span class="small muted">${esc(className(s.classId))}</span></div>
        <div class="attn-why">${reasons.map((r) => `<span class="chip">${esc(r.t)}</span>`).join('')}</div>
        <div class="row attn-act"><button class="btn sm gold" type="button" data-cheer="${esc(s.id)}">💚 رسالة تشجيع</button><button class="btn sm" type="button" data-asubs="${esc(s.id)}">📋 تسليماته</button><button class="btn sm" type="button" data-amf="${esc(s.id)}">📖 مصحفه</button><button class="btn sm ghost" type="button" data-adone="${esc(s.id)}">✓ تمت المتابعة</button></div></li>`).join('')}</ul>` : ''}</div>`;
    $('#attnT', host).onclick = () => { attnOpen = !attnOpen; paintAttention(); };
    const find = (id) => L.find((x) => x.s.id === id);
    $$('[data-amf]', host).forEach((b) => (b.onclick = () => openStudentMushaf(find(b.dataset.amf).s)));
    $$('[data-asubs]', host).forEach((b) => (b.onclick = () => { const s = find(b.dataset.asubs).s; filters = { cls: 'all', task: 'all', q: s.name, status: 'all' }; tab = 'subs'; pref.set('tTab', tab); $$('[data-tab]', app).forEach((x) => x.classList.toggle('on', x.dataset.tab === 'subs')); drawBody(); $('#tBody', app)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $$('[data-adone]', host).forEach((b) => (b.onclick = async () => {
      const it = find(b.dataset.adone); const v = { at: new Date().toISOString(), keys: it.keys };
      attnDone[it.s.id] = v; paintAttention();
      try { await store.saveAttention(it.s.id, v); toast(`تمت متابعة ${it.s.name}. يعود إلى القائمة بعد ${ar(ATTN_DAYS)} يوماً إن بقي السبب، أو فوراً إن ظهر سبب جديد.`); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
    }));
    $$('[data-cheer]', host).forEach((b) => (b.onclick = () => {
      const it = find(b.dataset.cheer), first = it.s.name.split(' ')[0];
      openModal(`<form class="stack" id="chrF"><h2>💚 رسالة تشجيع إلى ${esc(it.s.name)}</h2>
        <div class="row" style="gap:6px">${it.reasons.map((r) => `<span class="chip">${esc(r.t)}</span>`).join('')}</div>
        <label class="field">نص الرسالة (يمكنك تعديله)<textarea id="chrT" rows="4" maxlength="400" required>${esc(CHEER[it.reasons[0].k](first))}</textarea></label>
        <p class="small muted" style="margin:0">تصل إليه في جرس الموقع وإشعاراً على جواله، ويظهر في الإشعار أنها من معلمه.</p>
        <div class="row"><button class="btn primary" type="submit">أرسل</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
        $('#chrF', m).onsubmit = async (e) => {
          e.preventDefault(); const btn = e.submitter; btn.disabled = true;
          const body = $('#chrT', m).value.trim();
          try {
            const nid = await store.addStudentNotif(it.s.id, { type: 'cheer', title: '💚 رسالة من معلمك', body, link: './#/student', tag: 'cheer-' + Date.now() });
            let msg = `أُرسلت الرسالة إلى ${it.s.name}.`;
            try { const p = await sendPush(nid, it.s.id); if (p?.sent) msg += ' ووصلت إلى جواله.'; else if (p?.deferred) msg += ' وتصل جواله الساعة ٦ صباحاً.'; } catch {}
            const v = { at: new Date().toISOString(), keys: it.keys, cheer: true };
            attnDone[it.s.id] = v; store.saveAttention(it.s.id, v).catch(() => {});
            closeModal(); toast(msg); paintAttention();
          } catch (x) { toast('تعذر الإرسال: ' + (x.code || x.message)); btn.disabled = false; }
        };
      });
    }));
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
  let FB = null, offFb = null, QR = null, fbSel = fbSelInit;
  const fbF = { kind: 'all', status: 'all', cls: 'all', q: '' };
  let SP = null, fbView = fbViewInit || 'fb';
  const spF = { status: 'open', type: 'all', dev: 'all' };
  const fbSort = (L) => L.sort((a, b) => fbLast(b).localeCompare(fbLast(a)));
  async function loadFb() {
    try { FB = fbSort(await store.listAllFeedback()); } catch (e) { FB = FB || []; console.warn(e); }
    try { SP = (await store.listAllSpeechIssues()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } catch (e) { SP = SP || []; console.warn('speech issues', e); }
    store.getQuickReplies().then((L) => (QR = L)).catch(() => {});
    paintFbTab();
    if (tab === 'fb') drawBody();
    // متابعة مباشرة: رسالة جديدة من طالب تظهر فوراً في صندوق الوارد
    if (!offFb) offFb = store.watchAllFeedback((L) => { FB = fbSort(L); paintFbTab(); paintFbList(); });
  }
  function paintFbTab() {
    const n = (FB || []).filter(fbUnreadT).length + (SP || []).filter((x) => (x.status || 'new') === 'new').length;
    setBadge('fb', n);
  }
  const fbMatch = (x) => (fbF.kind === 'all' || x.kind === fbF.kind) && (fbF.cls === 'all' || x.classId === fbF.cls)
    && (!fbF.q || (x.name || '').includes(fbF.q) || String(x.pn).includes(fbF.q))
    && (fbF.status === 'all' || (fbF.status === 'new' && fbUnreadT(x)) || (fbF.status === 'wait' && !fbClosed(x) && (x.lastFrom ? x.lastFrom === 's' : !x.reply))
      || (fbF.status === 'open' && !fbClosed(x)) || (fbF.status === 'closed' && fbClosed(x)));
  /** صندوق الوارد: يعيد رسم القائمة فقط (المحادثة المفتوحة تبقى كما هي) */
  function paintFbList() {
    const box = $('#fbInbox'); if (!box || !FB) return;
    const L = FB.filter(fbMatch);
    const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    box.innerHTML = L.length ? L.map((x) => { const k = `${x.pn}|${x.id}`, u = fbUnreadT(x), cl = fbClosed(x), wait = !cl && (x.lastFrom ? x.lastFrom === 's' : !x.reply);
      return `<button type="button" class="ib-row${u ? ' unread' : ''}${k === fbSel ? ' sel' : ''}" data-fb="${esc(k)}">
        <span class="ib-av" style="--h:${hue(x.pn)}">${esc((x.name || 'ط').trim()[0])}</span>
        <span class="ib-m"><span class="ib-top"><b>${esc(x.name || 'طالب')}</b><small class="muted">${esc(timeAgo(fbLast(x)))}</small></span>
          <span class="ib-sub">${FBK(x.kind)[0]} <span class="muted">${esc(x.className || '')}</span>${cl ? ' <span class="muted">🔒</span>' : wait && !u ? ' <span class="ib-wait">بانتظار ردك</span>' : ''}</span>
          <span class="ib-p">${x.lastFrom === 't' ? '<span class="tk' + ((x.sSeenAt || '') >= (x.lastAt || '') ? ' read' : '') + '">✓✓</span> ' : ''}${esc(fbPreview(x).replace(/^المعلم: /, ''))}</span></span>
        ${u ? '<span class="ib-dot" aria-label="جديد"></span>' : ''}</button>`; }).join('')
      : `<div class="empty">${FB.length ? 'لا توجد محادثات بهذه الاختيارات.' : 'لم تصل ملاحظات بعد. يجد الطلاب زر «رأيك يهمنا» أسفل صفحتهم.'}</div>`;
    $$('[data-fb]', box).forEach((b) => (b.onclick = () => openFbThread(b.dataset.fb)));
  }
  function openFbThread(k) {
    fbSel = k; const pane = $('#fbChat'); if (!pane) return;
    const [pn, id] = k.split('|'), x = FB.find((f) => f.id === id && f.pn === pn); if (!x) return;
    $('.fb-inbox')?.classList.add('chatting');
    if (!matchMedia('(min-width: 860px)').matches) setTimeout(() => $('.fb-inbox')?.scrollIntoView({ block: 'start' }), 50);
    $$('#fbInbox [data-fb]').forEach((b) => b.classList.toggle('sel', b.dataset.fb === k));
    mountChat(pane, {
      store, side: 't', pn, fid: id, title: x.name || 'طالب', sub: `${x.className || ''}، ${FBK(x.kind)[1]}`, toast,
      quick: QR, saveQuick: async (L) => { await store.saveQuickReplies(L); QR = L; },
      onBack: () => { fbSel = null; $('.fb-inbox')?.classList.remove('chatting'); pane.innerHTML = '<div class="empty ib-empty">اختر محادثة من القائمة</div>'; paintFbList(); },
      onState: (t) => { Object.assign(x, t); paintFbTab(); paintFbList(); },
      onSent: async (m) => {
        const body = m.text ? (m.text.length > 120 ? m.text.slice(0, 120) + '…' : m.text) : m.voice ? '🎙️ رسالة صوتية' : '📷 صورة';
        try { const nid = await store.addStudentNotif(pn, { type: 'fbReply', fid: id, title: '💬 ردّ معلمك على ملاحظتك', body, link: `./#/student/fb/${id}`, tag: 'fb-' + id }); await sendPush(nid, pn); } catch (e) { console.warn(e); }
      },
    });
    const del = document.createElement('button'); del.type = 'button'; del.className = 'btn sm ghost danger'; del.textContent = '🗑'; del.title = 'حذف المحادثة';
    del.onclick = async () => {
      if (!(await confirmBox(`حذف محادثة ${x.name || 'الطالب'} كاملة؟`))) return;
      try { await store.deleteFeedback(pn, id); FB = FB.filter((f) => f !== x); fbSel = null; paintFbTab(); drawFb($('#tBody', app)); toast('حُذفت المحادثة.'); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
    };
    $('.chat-h', pane)?.append(del);
  }
  /** المعلم يبدأ محادثة: يختار الصف ثم الطالب ثم يكتب رسالته */
  function newFbToStudent(fbBody) {
    const last = pref.get('fbNewCls', D.classes[0]?.id || '');
    openModal(`<form id="nfF" class="stack" style="gap:12px"><h2>✉️ رسالة لطالب</h2>
      <p class="small muted" style="margin:0">تصل الطالب إشعاراً، وتظهر له في «رأيك يهمنا»، ويستطيع الرد عليك في المحادثة نفسها.</p>
      <label class="field">الصف<select id="nfC">${D.classes.map((c) => `<option value="${esc(c.id)}" ${c.id === last ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field">الطالب<select id="nfS" required></select></label>
      <label class="field">رسالتك<textarea id="nfT" rows="4" maxlength="1000" required placeholder="مثلاً: أحسنت في تسميع اليوم، وأريدك أن تراجع…"></textarea></label>
      <div class="modal-actions row"><button class="btn primary" type="submit">أرسل</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      const fill = () => { const c = $('#nfC', m).value; pref.set('fbNewCls', c); $('#nfS', m).innerHTML = '<option value="">اختر الطالب</option>' + D.students.filter((x) => x.classId === c).sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''); };
      $('#nfC', m).onchange = fill; fill();
      $('#nfF', m).onsubmit = async (e) => {
        e.preventDefault();
        const st = D.students.find((x) => x.id === $('#nfS', m).value), text = $('#nfT', m).value.trim();
        if (!st) return toast('اختر الطالب.');
        if (!text) return toast('اكتب رسالتك.');
        const btn = e.submitter; btn.disabled = true;
        const at = new Date().toISOString(), f = { name: st.name, classId: st.classId || '', className: className(st.classId), kind: 'teacher', text, byT: true, seen: true, tSeenAt: at, lastAt: at, lastFrom: 't', lastText: text.slice(0, 120) };
        try {
          const id = await store.startFeedback(st.id, f, at);
          FB = fbSort([{ ...f, id, pn: st.id, createdAt: at }, ...(FB || []).filter((x) => !(x.id === id && x.pn === st.id))]);
          try { const nid = await store.addStudentNotif(st.id, { type: 'fbReply', fid: id, title: '✉️ رسالة من معلمك', body: text.length > 120 ? text.slice(0, 120) + '…' : text, link: `./#/student/fb/${id}`, tag: 'fb-' + id }); await sendPush(nid, st.id); } catch (x) { console.warn(x); }
          closeModal(); toast(`أُرسلت الرسالة إلى ${st.name}.`);
          fbView = 'fb'; fbSel = `${st.id}|${id}`; fbSelInit = fbSel; drawFb(fbBody);
        } catch (x) { toast('تعذر الإرسال: ' + (x.code || x.message)); btn.disabled = false; }
      };
    });
  }
  function drawFb(body) {
    if (!FB) { body.innerHTML = '<div class="loading">جارٍ تحميل الملاحظات…</div>'; return; }
    const spNew = (SP || []).filter((x) => (x.status || 'new') === 'new').length, fbNew = FB.filter(fbUnreadT).length;
    const sw = `<div class="seg" role="tablist" style="margin-bottom:14px"><button type="button" role="tab" class="${fbView === 'fb' ? 'on' : ''}" data-fv="fb">💬 المحادثات${fbNew ? ` <span class="tab-n">${ar(fbNew)}</span>` : ''}</button><button type="button" role="tab" class="${fbView === 'sp' ? 'on' : ''}" data-fv="sp">🎙️ شكاوى التعرف على الكلام${spNew ? ` <span class="tab-n">${ar(spNew)}</span>` : ''}</button></div>`;
    const wireSw = () => $$('[data-fv]', body).forEach((b) => (b.onclick = () => { fbView = b.dataset.fv; drawFb(body); }));
    if (fbView === 'sp') {
      body.innerHTML = sw + '<div id="spT"></div>'; wireSw();
      drawIssuesTeacher($('#spT', body), SP || [], { store, toast, confirmBox, openModal, onCount: paintFbTab,
        notify: async (pn) => { const nid = await store.addStudentNotif(pn, { type: 'speechFix', title: '🎙️ حُلّت مشكلة التعرف على الكلام', body: 'جرّب التسميع الآن بإذن الله، وأخبرنا إن بقيت المشكلة.', link: './#/student', tag: 'sp-' + pn }); return sendPush(nid, pn); } }, spF);
      return;
    }
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    const count = (k) => FB.filter((x) => x.kind === k).length, waitN = FB.filter((x) => !fbClosed(x) && (x.lastFrom ? x.lastFrom === 's' : !x.reply)).length;
    body.innerHTML = sw + `<div class="fb-wrap"><div class="row" style="justify-content:space-between;margin-bottom:10px"><div><h2 style="margin:0">💬 رأيك يهمنا</h2><p class="small muted" style="margin:4px 0 0">كل ملاحظة محادثة: تردّ ويكمل الطالب على ردّك. يصلك تنبيه بكل رسالة جديدة، وتُغلق المحادثة تلقائياً بعد ${ar(7)} أيام بلا رسائل.</p></div><div class="row" style="gap:8px"><span class="ib-sum">${waitN ? `⏳ ${ar(waitN)} بانتظار ردك` : '✓ لا شيء بانتظارك'}</span><button type="button" class="btn primary sm" id="fbNew">✉️ رسالة لطالب</button></div></div>
      <div class="fb-stats">${Object.entries(FB_KINDS).map(([k, [i, l]]) => `<button type="button" class="kpi kpi-btn${fbF.kind === k ? ' on' : ''}" data-fk="${k}"><b>${i} ${ar(count(k))}</b><span>${l}</span></button>`).join('')}</div>
      <div class="row" style="margin:12px 0">
        <input type="search" id="fbQ" placeholder="بحث باسم الطالب" value="${esc(fbF.q)}" style="flex:2 1 160px">
        <select id="fbS" style="flex:1 1 120px">${opt('all', 'كل المحادثات', fbF.status)}${opt('new', 'غير مقروءة', fbF.status)}${opt('wait', 'بانتظار ردك', fbF.status)}${opt('open', 'مفتوحة', fbF.status)}${opt('closed', 'مغلقة', fbF.status)}</select>
        <select id="fbK" style="flex:1 1 120px">${opt('all', 'كل الأنواع', fbF.kind)}${Object.entries(FB_KINDS).map(([k, [i, l]]) => opt(k, `${i} ${l}`, fbF.kind)).join('')}${opt('teacher', '✉️ من المعلم', fbF.kind)}</select>
        <select id="fbC" style="flex:1 1 120px">${opt('all', 'كل الصفوف', fbF.cls)}${D.classes.map((c) => opt(c.id, c.name, fbF.cls)).join('')}</select>
      </div>
      <div class="fb-inbox"><div class="ib-list" id="fbInbox"></div><div class="ib-chat" id="fbChat"><div class="empty ib-empty">اختر محادثة من القائمة</div></div></div></div>`;
    wireSw();
    $$('[data-fk]', body).forEach((b) => (b.onclick = () => { fbF.kind = fbF.kind === b.dataset.fk ? 'all' : b.dataset.fk; drawFb(body); }));
    $('#fbK', body).onchange = (e) => { fbF.kind = e.target.value; drawFb(body); };
    $('#fbNew', body).onclick = () => newFbToStudent(body);
    $('#fbS', body).onchange = (e) => { fbF.status = e.target.value; paintFbList(); };
    $('#fbC', body).onchange = (e) => { fbF.cls = e.target.value; paintFbList(); };
    $('#fbQ', body).oninput = (e) => { fbF.q = e.target.value.trim(); paintFbList(); };
    paintFbList();
    const wide = matchMedia('(min-width: 860px)').matches, deep = fbSelInit && fbSel === fbSelInit; fbSelInit = null;
    if (fbSel && (wide || deep) && FB.some((x) => `${x.pn}|${x.id}` === fbSel)) openFbThread(fbSel);
    else if (wide) { const f = FB.find(fbMatch); if (f) openFbThread(`${f.pn}|${f.id}`); }
    else fbSel = null;
  }

  /* --- التسليمات --- */
  function drawSubs(body) {
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    body.innerHTML = `<div id="aiBar" class="card ai-bar" hidden></div><div class="row" style="margin-bottom:12px">
      <input type="search" id="fQ" placeholder="بحث باسم الطالب أو رقمه" value="${esc(filters.q)}" style="flex:2 1 200px">
      <select id="fC" style="flex:1 1 140px">${opt('all', 'كل الصفوف', filters.cls)}${D.classes.map((c) => opt(c.id, c.name, filters.cls)).join('')}</select>
      <select id="fT" style="flex:1 1 160px">${opt('all', 'كل الواجبات', filters.task)}${opt('free', 'بدون واجب', filters.task)}${D.tasks.map((t) => opt(t.id, t.title, filters.task)).join('')}</select>
      <select id="fS" style="flex:1 1 140px">${opt('all', 'كل الحالات', filters.status)}${opt('pending', 'لم تراجعها بعد', filters.status)}${opt('graded', 'راجعتها', filters.status)}</select>
      <button class="btn" id="fX" type="button">تصدير Excel</button>
    </div><div id="redoBox"></div><div id="subList"></div>`;
    paintAiBar(); paintRedo();
    const list = () => D.subs.filter((x) =>
      (filters.cls === 'all' || x.classId === filters.cls) &&
      (filters.task === 'all' || (filters.task === 'free' ? !x.taskId : x.taskId === filters.task)) &&
      (filters.status === 'all' || (filters.status === 'pending' ? !x.teacher : !!x.teacher)) &&
      (!filters.q || (x.studentName || '').includes(filters.q) || (x.pn || '').includes(filters.q)));
    const paint = () => {
      const L = list();
      const all = new Set(D.subs.map(subKey));
      [...selSubs].forEach((k) => { if (!all.has(k)) selSubs.delete(k); });
      $('#subList', body).innerHTML = (selSubs.size ? `<div class="bulk"><b>المحدد: ${ar(selSubs.size)}</b><button class="btn sm primary" type="button" id="bsOk">✓ أكّد الدرجات الآلية</button><button class="btn sm danger" type="button" id="bsDel">حذف المحدد</button><button class="btn sm" type="button" id="bsClr">إلغاء التحديد</button></div>` : '')
        + (L.length ? `<div class="table-wrap"><table><thead><tr><th class="sel"><input type="checkbox" id="bsAll" aria-label="تحديد كل التسليمات الظاهرة"></th><th>الطالب</th><th>الصف</th><th>الواجب / المقطع</th><th>التاريخ</th><th>الدقة الآلية</th><th>المدة</th><th>تقييمك</th></tr></thead><tbody>
        ${L.map((x) => `<tr class="click ${selSubs.has(subKey(x)) ? 'picked' : ''}" data-id="${esc(x.id)}" data-pn="${esc(x.pn)}"><td class="sel"><input type="checkbox" data-sk="${esc(subKey(x))}" ${selSubs.has(subKey(x)) ? 'checked' : ''} aria-label="تحديد"></td><td><b>${esc(x.studentName)}</b>${x.retakeId ? ' <span class="pill gold-pill">إعادة</span>' : ''}${x.retakeRequested && !D.subs.some((y) => y.retakeId === x.retakeRequested.id) ? ' <span class="pill mute">طُلبت إعادته</span>' : ''}<div class="small muted num">${esc(x.pn)}</div></td><td>${esc(x.className || className(x.classId))}</td>
        <td>${esc(x.taskTitle || 'تدريب')}<div class="small muted">${esc(rangeLabel(x.surah, x.from, x.to))}</div></td><td class="num">${fmtDate(x.createdAt)}</td>
        <td>${x.percent == null ? '<span class="pill mute">يدوي</span>' : `<span class="pill ${pctClass(x.percent)}">${ar(x.percent)}٪</span>`}</td><td class="num">${fmtTime(x.duration || 0)}</td>
        <td>${x.teacher ? `<span class="pill ok">${fmtQ(x.teacher.total)}/١٠</span>` : (() => { const g = (x.taskId || x.retakeId) && autoGrade(x); return g ? `<span class="pill" title="درجة آلية، ولك أن تراجعها">🤖 ${fmtQ(g.total)}/١٠${g.pending && aiEnabled() ? ' ⏳' : ''}</span>` : '<span class="pill warn">بانتظارك</span>'; })()}${x.late ? ' <span class="pill warn">متأخر</span>' : ''}</td></tr>`).join('')}
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
      const okb = $('#bsOk', body);
      if (okb) okb.onclick = async () => {
        const items = D.subs.filter((x) => selSubs.has(subKey(x)) && !x.teacher && (x.taskId || x.retakeId)).map((x) => ({ x, g: autoGrade(x) })).filter((o) => o.g && !o.g.pending);
        if (!items.length) return toast('لا توجد في المحدد درجات آلية مكتملة بانتظار التأكيد.');
        if (!(await confirmBox(`تأكيد ${items.length === 1 ? 'درجة واحدة' : `${ar(items.length)} درجات`} كما رصدها التحليل الآلي، وإرسال رسالة التأكيد ${items.length === 1 ? 'للطالب' : 'للطلاب'}؟`, 'أكّد وأرسل'))) return;
        const { ok, fail } = await runBulk('تأكيد الدرجات', items, async ({ x, g }) => {
          const teacher = { total: g.total, notes: '', suggested: g.total, deduction: 0, gv: 3, confirmed: true, at: new Date().toISOString() };
          await store.updateSubmission(x.pn, x.id, { teacher });
          await notifyGrade(x, teacher, null).catch((e) => console.warn(e));
          Object.assign(x, { teacher });
        });
        selSubs.clear(); schedulePublish();
        toast(fail ? `أُكّد ${ar(ok)}، وتعذر ${ar(fail)}.` : `أُكّدت ${ar(ok)} ${ok === 1 ? 'درجة' : 'درجات'} ووصلت رسائل التأكيد.`);
        drawBody();
      };
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
    const cov = coverage(x.statuses), rEnd = x.statuses ? readEnd(x.statuses) : Infinity;
    const autoErr = [...(x.statuses || '')].map((c, i) => (i >= rEnd ? null : c === 'w' ? { i, r: 'v_wrong' } : c === 'm' ? { i, r: 'v_missing' } : null)).filter(Boolean);
    let aiRes = x.ai ? { ...x.ai, errors: aiErrors(x.ai) } : null; // العارض للسكون ٢/٤/٦ صحيح
    // لم يقيّمه المعلم بعد: التقييم الآلي هو الأساس (أخطاء الكلمات وملاحظات التجويد محددة مسبقاً، ويستطيع إلغاء ما يراه)
    let marks = x.teacher || (x.tj || []).length ? (x.tj || []).map((m) => (m.n ? { ...m } : makeMark(errCat, m.i, m.r))) : [...autoErr, ...(aiRes ? aiRes.errors.filter((e) => e.i < rEnd && findErr(errCat, e.r)) : [])].map((e) => ({ ...makeMark(errCat, e.i, e.r), p: 1 }));
    const gradeOf = () => gradeFrom(deduction(marks, errCat), cov);
    let manual = !!x.teacher && x.teacher.total !== gradeOf();
    const weak = weakRules(model, mine, 3);
    openModal(`
      <div class="stack">
        <div><h2>${esc(x.studentName)} <span class="muted small num">${esc(x.pn)}</span></h2>
        <p class="muted" style="margin:4px 0 0">${esc(x.taskTitle || 'تدريب')} · ${esc(rangeLabel(x.surah, x.from, x.to))} · ${fmtDate(x.createdAt)} · ${x.mode === 'hifz' ? 'غيباً' : 'نظراً'}</p></div>
        ${(() => { const prev = x.retakeOf && D.subs.find((y) => y.id === x.retakeOf && y.pn === x.pn); return x.retakeId ? `<div class="retake-info">🔁 هذا التسليم <b>إعادة</b> ${x.retakeByStudent ? 'طلبها الطالب ووافقت عليها' : 'طلبتها'}${prev ? ` لتسليم ${fmtDate(prev.createdAt)}${prev.teacher ? ` (درجته ${fmtQ(prev.teacher.total)} من ١٠)` : ''} <button class="btn sm" type="button" id="sbPrev">افتح التسليم السابق للمقارنة</button>` : x.retakeOf && !x.retakeByStudent ? '، وحلّت محل التسليم القديم فحُذف.' : '.'}</div>` : ''; })()}
        ${x.retakeRequested ? `<div class="retake-info">🔁 طلبت من الطالب إعادة ${esc(rangeLabel(x.retakeRequested.surah, x.retakeRequested.from, x.retakeRequested.to))} بتاريخ ${fmtDate(x.retakeRequested.at)}.</div>` : ''}
        <div class="row">${x.percent != null ? `<span class="pill ${pctClass(x.percent)}">الدقة الآلية ${ar(x.percent)}٪</span><span class="pill mute">صحيحة ${ar(x.counts?.correct || 0)} · خطأ ${ar(x.counts?.wrong || 0)} · محذوفة ${ar(x.counts?.missing || 0)}</span>` : '<span class="pill mute">بدون تصحيح آلي</span>'}<span class="pill mute">المدة ${fmtTime(x.duration || 0)}</span></div>
        <div id="sbAudio">${x.hasAudio ? '<button class="btn" id="sbLoad" type="button">تشغيل تسجيل الطالب</button>' : '<span class="muted small">لا يوجد تسجيل صوتي.</span>'}</div>
        ${risky.length ? `<div class="learn-note">استمع أولاً إلى المواضع المسطّرة: هي الأرجح أن يخطئ فيها هذا الطالب${weak.length ? `، فقد أخطأ سابقاً في ${weak.map((w) => `«${esc(ruleName(w.r))}»`).join(' و')}` : ''}.</div>` : ''}
        <div id="sbMap">${wordMapHtml({ ...x, tj: marks }, { colored: true, risky: riskSet })}</div>
        <div class="tj-menu small" id="sbMenu"><b>لتحديد خطأ:</b> اضغط على الكلمة في المصحف أعلاه، ثم اختر الخطأ (لفظي أو تجويد)، فيُخصم من الدرجة حسب «الأخطاء ودرجاتها».</div>
        <div id="sbAuto"></div>
        <div id="sbMarks"></div>
        <div id="sbAi"></div>
        ${(() => { const g = (x.taskId || x.retakeId) && autoGrade(x); if (!g?.asr) return ''; const n = (g.asr.tail || 0) + g.asr.gaps.reduce((k, [a1, b1]) => k + b1 - a1, 0); return `<div class="notice small">⚠️ لم يلتقط التعرف على الكلام في جهاز الطالب ${ar(n)} ${n <= 10 ? 'كلمات' : 'كلمة'}${g.asr.tail ? ' في آخر المقطع' : ''}، لكن تحليل الصوت سمع آياتها، فلم تُحسب كلها أخطاءً${g.asr.gaps.length ? ` (حُسبت كل فجوة خطأً واحداً: ${ar(g.asr.gaps.length)})` : ''}. استمع للتسجيل إن أردت التحقق.</div>`; })()}
        ${x.dev ? `<div class="small muted">الجهاز: ${esc(x.dev.os)} · ${x.dev.br === 'InApp' ? 'متصفح داخل تطبيق' : esc(x.dev.br)} · التعرف على الكلام: ${x.dev.sr ? 'متاح' : 'غير متاح في هذا المتصفح'}${x.dev.rs ? ` · أُعيد تشغيله ${ar(x.dev.rs)} مرة` : ''}${(x.dev.err || []).length ? ` · أخطاء: ${esc(x.dev.err.join('، '))}` : ''}</div>` : ''}
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
        const g = gradeOf();
        const C = capped(ded), mx = (k, cap) => (C.raw[k] > cap ? ' بحده الأقصى' : '');
        $('#gDed', m).innerHTML = `<div class="ded-sum"><span>١٠</span><span>− ${fmtQ(C.verbal + C.letters + C.tajweed)} خصم${ded.total ? ` <small>(كلمات ${fmtQ(C.verbal)}${mx('verbal', G.vmax)} · حركات وحروف ${fmtQ(C.letters)}${mx('letters', G.lmax)} · تجويد ${fmtQ(C.tajweed)}${mx('tajweed', G.tmax)})</small>` : ''}</span><b>= ${fmtQ(g)}</b></div>
          <div class="small muted">التقييم الميسّر: أقصى خصم للكلمات ${ar(G.vmax)}، وللحركات والحروف ${ar(G.lmax)}، وللتجويد ${ar(G.tmax)}، ومن أكمل المقطع لا تقل درجته عن ${ar(G.floor)}. المد العارض للسكون صحيح بـ٢ أو ٤ أو ٦ حركات.${cov < G.full ? ` <b>قرأ ${ar(Math.round(cov * 100))}٪ من المقطع فقط، فالدرجة بنسبة ما قرأ.</b>` : ''}</div>`;
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
              if (!x.teacher && !manual) aiRes.errors.filter((e) => e.i < rEnd && findErr(errCat, e.r) && !has(e)).forEach((e) => marks.push({ ...makeMark(errCat, e.i, e.r), p: 1 }));
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
        const teacher = { total: Math.max(0, Math.min(10, Math.round(v * 4) / 4)), notes: $('#gN', m).value.trim(), suggested, deduction: deduction(marks, errCat).total, gv: 3, at: new Date().toISOString() };
        const patch = { teacher, tj: marks, tjDone: $('#gTjDone', m).checked, ...(aiRes ? { ai: aiRes } : {}) };
        const prevTotal = x.teacher ? x.teacher.total : null;
        const wantNotify = $('#gNotify', m).checked && prevTotal !== teacher.total;
        try {
          await store.updateSubmission(x.pn, x.id, patch);
          { const k = D.subs.find((y) => y.id === x.id && y.pn === x.pn); if (k) Object.assign(k, patch); schedulePublish(150); }
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
        D.subs = D.subs.filter((y) => !(y.pn === x.pn && y.id === x.id));
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
          <div class="ann-thumbs" id="anThumbs"></div>
          <div class="row" style="gap:6px">
            <label class="btn" id="anPickL"><input type="file" id="anFile" accept="image/*" multiple hidden> 📷 أضف صوراً</label>
            <button class="btn" type="button" id="anDesign">🎨 صمّم من النص</button>
            <button class="btn" type="button" id="anRec">🎙️ رسالة صوتية</button>
          </div>
          <div class="ann-voice" id="anVoice" hidden></div>
          <div class="small muted" id="anPicQuota"></div>
          <div class="small muted">حتى ${ar(ANN_MAX_IMGS)} صور في الإعلان، ولكل صورة زر ✏️ للتعديل (قص، نص، إزالة خلفية، تمويه…). تُحذف الصور والصوت بعد ${ar(IMG_DAYS)} يوماً.</div>
        </div>
        <details class="ann-more" id="anMore"><summary>📊 استطلاع سريع · 🔗 زر في الإعلان</summary>
          <label class="ie-check"><input type="checkbox" id="anPollOn"> أضف استطلاعاً</label>
          <div id="anPoll" class="stack" style="gap:6px" hidden>
            <label class="field">السؤال<input type="text" id="anPollQ" maxlength="100" placeholder="مثال: هل يناسبكم الاختبار يوم الخميس؟"></label>
            <div id="anPollOpts" class="stack" style="gap:4px"></div>
            <button class="btn sm ghost" type="button" id="anPollAdd">＋ خيار</button>
          </div>
          <label class="field">زر في الإعلان<select id="anAct"><option value="">بلا زر</option>${ANN_ACTS.map((a) => `<option value="${a.k}">${a.label}</option>`).join('')}</select></label>
          <div id="anActX" class="row" hidden>
            <label class="field" style="flex:1 1 140px">نص الزر<input type="text" id="anActL" maxlength="30"></label>
            <label class="field" style="flex:2 1 200px" id="anActUW" hidden>الرابط<input type="url" id="anActU" placeholder="https://"></label>
          </div>
        </details>
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
        <fieldset class="seg-field"><legend>طريقة العرض</legend>
          <label><input type="radio" name="anM" value="bar" checked> 📌 شريط أعلى الصفحة</label>
          <label><input type="radio" name="anM" value="popup"> 🪟 صفحة منبثقة</label>
        </fieldset>
        <p class="small muted" id="anMNote" style="margin:-6px 0 0" hidden>تظهر للطالب نافذة في وسط الشاشة فور فتحه الموقع (مرة واحدة)، ويبقى الإعلان بعدها في الجرس. مناسبة للتنبيهات المهمة.</p>
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
    // الصور (ألبوم حتى ٤)، والتصميم من النص، والرسالة الصوتية، والاستطلاع، والزر
    const pics = []; let voice = null;
    const todayKey = new Date().toDateString();
    const imgsToday = (L) => L.filter((a) => a.hasImage && new Date(a.createdAt).toDateString() === todayKey).reduce((n, a) => n + (a.imgN || 1), 0);
    let quotaL = [];
    const paintQuota = (L) => { if (L) quotaL = L; const q = $('#anPicQuota', body); if (!q) return; const n = imgsToday(quotaL), left = IMG_DAILY_LIMIT - n - pics.length; q.textContent = `صور اليوم: ${ar(n + pics.length)} من ${ar(IMG_DAILY_LIMIT)}`; const full = left <= 0 || pics.length >= ANN_MAX_IMGS; $('#anFile', body).disabled = full; $('#anPickL', body).classList.toggle('disabled', full); $('#anDesign', body).disabled = full; if (left <= 0) q.textContent += ' · وصلت إلى الحد اليومي.'; };
    const paintThumbs = () => {
      const h = $('#anThumbs', body); if (!h) return;
      h.innerHTML = pics.map((p, i) => `<div class="ann-th"><img alt="صورة ${ar(i + 1)}" src="${p.url}"><small>${esc(fmtKB(p.blob.size))}</small>
        <div class="ann-th-b"><button type="button" class="btn sm" data-pe="${i}" title="تعديل">✏️</button>${i ? `<button type="button" class="btn sm" data-pu="${i}" title="قدّمها">→</button>` : ''}<button type="button" class="btn sm danger" data-px="${i}" title="إزالة">✕</button></div></div>`).join('');
      $$('[data-px]', h).forEach((b) => (b.onclick = () => { const [p] = pics.splice(+b.dataset.px, 1); URL.revokeObjectURL(p.url); paintThumbs(); }));
      $$('[data-pu]', h).forEach((b) => (b.onclick = () => { const i = +b.dataset.pu; [pics[i - 1], pics[i]] = [pics[i], pics[i - 1]]; paintThumbs(); }));
      $$('[data-pe]', h).forEach((b) => (b.onclick = async () => {
        const p = pics[+b.dataset.pe]; b.disabled = true;
        try { const nb = await openImageEditor(p.src); if (nb) { const c = await compressImage(nb); URL.revokeObjectURL(p.url); Object.assign(p, { src: nb, ...c, url: URL.createObjectURL(c.blob) }); paintThumbs(); } }
        catch (x) { toast('تعذر فتح المحرر: ' + x.message); } b.disabled = false;
      }));
      paintQuota();
    };
    const addPic = async (src) => { const c = await compressImage(src); pics.push({ src, ...c, url: URL.createObjectURL(c.blob) }); paintThumbs(); };
    $('#anFile', body).onchange = async (e) => {
      const fs = [...e.target.files], room = ANN_MAX_IMGS - pics.length; e.target.value = '';
      for (const f of fs.slice(0, room)) { try { await addPic(f); } catch (x) { toast(x.message); } }
      if (fs.length > room) toast(`الحد ${ar(ANN_MAX_IMGS)} صور في الإعلان الواحد، فأُضيف أولها فقط.`);
    };
    $('#anDesign', body).onclick = async () => {
      const t = $('#anTitle', body).value.trim(), b = $('#anBody', body).value.trim();
      if (!t && !b) { toast('اكتب العنوان أو نص الإعلان أولاً، ثم صمّم منه.'); $('#anBody', body).focus(); return; }
      try { const out = await openDesigner({ title: t, body: b }); if (out) await addPic(out); } catch (x) { toast('تعذر التصميم: ' + x.message); }
    };
    // الرسالة الصوتية (حتى ٩٠ ثانية)
    let rec = null;
    const paintVoice = () => {
      const v = $('#anVoice', body), btn = $('#anRec', body); if (!v) return;
      if (rec) { v.hidden = false; v.innerHTML = `<span class="rec-dot"></span> جارٍ التسجيل… <b id="anRecT">٠:٠٠</b> <button type="button" class="btn sm primary" id="anRecStop">⏹ إيقاف</button>`; $('#anRecStop', body).onclick = () => rec?.stop(); btn.disabled = true; return; }
      btn.disabled = false; v.hidden = !voice;
      if (voice) { v.innerHTML = `<audio controls src="${voice.url}"></audio><span class="small">${ar(voice.sec)} ث · ${esc(fmtKB(voice.blob.size))}</span><button type="button" class="btn sm danger" id="anVoX">✕ احذف</button>`; $('#anVoX', body).onclick = () => { URL.revokeObjectURL(voice.url); voice = null; paintVoice(); }; }
      btn.textContent = voice ? '🎙️ أعد التسجيل' : '🎙️ رسالة صوتية';
    };
    $('#anRec', body).onclick = async () => {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return toast('لم يُسمح باستخدام المايك. اسمح به من إعدادات المتصفح.'); }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
      const mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 }), parts = [], t0 = Date.now();
      rec = mr; paintVoice();
      const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000), el = $('#anRecT', body); if (el) el.textContent = `${ar(Math.floor(s / 60))}:${ar(String(s % 60).padStart(2, '0'))}`; if (s >= 90) mr.stop(); }, 250);
      mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
      mr.onstop = () => {
        clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); rec = null;
        const blob = new Blob(parts, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] }), sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
        if (blob.size > 500 * 1024) { toast('التسجيل كبير جداً. سجّل رسالة أقصر.'); paintVoice(); return; }
        if (voice) URL.revokeObjectURL(voice.url);
        voice = { blob, sec, url: URL.createObjectURL(blob) }; paintVoice();
      };
      mr.start(1000);
    };
    // الاستطلاع
    const pollOpts = ['نعم', 'لا'];
    const paintPoll = () => {
      const h = $('#anPollOpts', body);
      h.innerHTML = pollOpts.map((o, i) => `<div class="row" style="gap:4px"><input type="text" data-po="${i}" maxlength="40" value="${esc(o)}" placeholder="الخيار ${ar(i + 1)}" style="flex:1">${pollOpts.length > 2 ? `<button type="button" class="btn sm ghost" data-pox="${i}">✕</button>` : ''}</div>`).join('');
      $$('[data-po]', h).forEach((i) => (i.oninput = () => (pollOpts[+i.dataset.po] = i.value)));
      $$('[data-pox]', h).forEach((b) => (b.onclick = () => { pollOpts.splice(+b.dataset.pox, 1); paintPoll(); }));
      $('#anPollAdd', body).hidden = pollOpts.length >= 4;
    };
    $('#anPollOn', body).onchange = (e) => { $('#anPoll', body).hidden = !e.target.checked; };
    $('#anPollAdd', body).onclick = () => { if (pollOpts.length < 4) { pollOpts.push(''); paintPoll(); } };
    paintPoll();
    // الزر
    $('#anAct', body).onchange = (e) => { const a = ANN_ACTS.find((x) => x.k === e.target.value); $('#anActX', body).hidden = !a; $('#anActUW', body).hidden = a?.k !== 'url'; if (a) $('#anActL', body).value = a.btn; };
    /** حقول الاستطلاع والزر للحفظ، أو رسالة خطأ */
    const annExtras = () => {
      const fields = {};
      if ($('#anPollOn', body).checked) {
        const q = $('#anPollQ', body).value.trim(), opts = pollOpts.map((o) => o.trim()).filter(Boolean);
        if (!q) return { err: 'اكتب سؤال الاستطلاع.' };
        if (opts.length < 2) return { err: 'اكتب خيارين على الأقل في الاستطلاع.' };
        fields.poll = { q, opts };
      }
      const k = $('#anAct', body).value;
      if (k) {
        const label = $('#anActL', body).value.trim() || ANN_ACTS.find((x) => x.k === k).btn;
        let url = '';
        if (k === 'url') { url = $('#anActU', body).value.trim(); if (!/^https:\/\/[^\s]+\.[^\s]+/.test(url)) return { err: 'اكتب رابطاً صحيحاً يبدأ بـ https://' }; }
        fields.act = { k, label, ...(url ? { url } : {}) };
      }
      return { fields };
    };
    $$('[name=anT]', body).forEach((r) => (r.onchange = () => { const v = $('[name=anT]:checked', body).value; $('#anCls', body).hidden = v !== 'classes'; $('#anStu', body).hidden = v !== 'student'; }));
    $$('[name=anM]', body).forEach((r) => (r.onchange = () => { $('#anMNote', body).hidden = $('[name=anM]:checked', body).value !== 'popup'; }));
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
        if (pics.length && imgsToday(await store.listAnnouncements()) + pics.length > IMG_DAILY_LIMIT) { btn.disabled = false; return toast(`تتجاوز حد ${ar(IMG_DAILY_LIMIT)} صور اليوم. قلّل الصور أو أرسلها غداً.`); }
        const extra = annExtras(); if (extra.err) { btn.disabled = false; return toast(extra.err); }
        const fields = { title: $('#anTitle', body).value.trim(), body: $('#anBody', body).value.trim(), target, status: later ? 'scheduled' : 'pending', sendAt, recipients: annRecipients(target).length, popup: $('[name=anM]:checked', body).value === 'popup', ...extra.fields };
        // الحالة «مسودة» حتى تُرفع الصورة، فلا يُنشر إعلان مجدول قبل اكتمال صورته
        const media = pics.length || voice;
        const id = await store.saveAnnouncement(media ? { ...fields, status: 'draft', hasImage: !!pics.length, imgN: pics.length, imageBytes: pics.reduce((n, p) => n + Math.ceil(p.blob.size * 4 / 3), 0), hasVoice: !!voice, voiceSec: voice?.sec || 0 } : fields);
        if (media) {
          try {
            const exp = new Date(Math.max(Date.now(), sendAt ? new Date(sendAt).getTime() : 0) + IMG_DAYS * 864e5).toISOString();
            for (let i = 0; i < pics.length; i++) { const p = pics[i]; btn.textContent = `جارٍ رفع الصور ${ar(i + 1)}/${ar(pics.length)}…`; await store.saveAnnImage(i ? `${id}__${i}` : id, { b64: await blobToB64(p.blob), type: 'image/jpeg', w: p.w, h: p.h, bytes: p.blob.size, exp }); }
            if (voice) await store.saveAnnImage(`${id}__voice`, { b64: await blobToB64(voice.blob), type: voice.blob.type || 'audio/webm', sec: voice.sec, bytes: voice.blob.size, exp });
          } catch (x) { await store.deleteAnnouncement({ id, hasImage: !!pics.length, imgN: pics.length, hasVoice: !!voice }).catch(() => {}); btn.textContent = 'أرسل الإعلان'; throw x; }
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
      <div class="row" style="gap:6px">${a.popup ? '<span class="pill gold-pill">🪟 صفحة منبثقة</span>' : ''}${a.hasImage ? `<button class="ann-thumb" type="button" data-anpic="${esc(a.id)}" data-n="${a.imgN || 1}" aria-label="عرض صور الإعلان"><span>📷 ${(a.imgN || 1) > 1 ? `${ar(a.imgN)} صور` : 'عرض الصورة'}</span><small class="muted">${esc(fmtKB(a.imageBytes || 0))}</small></button>` : ''}${a.hasVoice ? `<button class="btn sm" type="button" data-anvo="${esc(a.id)}">🎙️ استمع (${ar(a.voiceSec || 0)} ث)</button>` : ''}${a.act ? `<span class="pill">🔗 ${esc(a.act.label)}</span>` : ''}</div>
      ${a.poll ? `<div class="ann-poll-res" data-poll="${esc(a.id)}"><b>📊 ${esc(a.poll.q)}</b><div class="small muted">جارٍ عدّ الأصوات…</div></div>` : ''}
      <div class="row" style="justify-content:space-between">
        <span class="small" data-reads="${esc(a.id)}">${a.status === 'sent' ? 'جارٍ عدّ القراءات…' : ''}</span>
        <span class="row" style="gap:4px">${a.status === 'scheduled' || a.status === 'pending' ? `<button class="btn sm" type="button" data-now="${esc(a.id)}">أرسل الآن</button>` : `<button class="btn sm" type="button" data-unread="${esc(a.id)}">من لم يقرأ؟</button>`}<button class="btn sm danger" type="button" data-andel="${esc(a.id)}">${a.status === 'scheduled' ? 'إلغاء' : 'حذف'}</button></span>
      </div></div>`).join('') : '<div class="empty">لم ترسل أي إعلان بعد.</div>';
    paintQuota(L);
    $$('[data-anpic]', host).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try {
        const n = +b.dataset.n || 1, id = b.dataset.anpic;
        if (n === 1) { const blob = await annImage(id, (k) => store.getAnnImage(k)); if (blob) openLightbox(blob); else toast(`حُذفت الصورة (مضى عليها ${ar(IMG_DAYS)} يوماً).`); }
        else openModal(`<div class="stack"><h3>📷 صور الإعلان</h3><div class="ann-album" id="tAlb"></div><div class="row"><button class="btn primary" type="button" data-close>إغلاق</button></div></div>`, (m) => mountAlbum($('#tAlb', m), id, n));
      } catch (e) { toast('تعذر تحميل الصورة: ' + (e.code || e.message)); }
      b.disabled = false;
    }));
    $$('[data-anvo]', host).forEach((b) => (b.onclick = () => playAnnVoice(b, b.dataset.anvo)));
    L.filter((a) => a.poll).slice(0, 30).forEach(async (a) => {
      const el = $(`[data-poll="${a.id}"]`, host); if (!el) return;
      try {
        const V = await store.listAnnVotes(a.id), tot = V.length, cnt = a.poll.opts.map((_, i) => V.filter((v) => v.o === i).length), mx = Math.max(1, ...cnt);
        el.innerHTML = `<b>📊 ${esc(a.poll.q)}</b> <span class="small muted">${ar(tot)} ${tot === 1 ? 'صوت' : 'أصوات'}</span>
          ${a.poll.opts.map((o, i) => `<div class="poll-r"><span>${esc(o)}</span><span class="poll-bar"><i style="width:${Math.round((cnt[i] / mx) * 100)}%"></i></span><b>${ar(cnt[i])}${tot ? ` <small class="muted">${ar(Math.round((cnt[i] / tot) * 100))}٪</small>` : ''}</b></div>`).join('')}
          ${tot ? `<details class="small"><summary>من صوّت؟</summary>${a.poll.opts.map((o, i) => `<div><b>${esc(o)}:</b> ${V.filter((v) => v.o === i).map((v) => esc(D.students.find((s) => s.id === v.pn)?.name || v.pn)).join('، ') || '—'}</div>`).join('')}</details>` : ''}`;
      } catch (e) { el.querySelector('.small').textContent = 'تعذر عدّ الأصوات: ' + (e.code || e.message); }
    });
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
      <p class="small muted" style="margin:0">اترك الآيات كما هي لإعادة المقطع كله، أو ضيّقها إلى المواضع التي أخطأ فيها. إعادة المقطع كله تحلّ محل التسليم القديم: يُحذف القديم تلقائياً حين تصل الإعادة.</p>
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
    // كانت للطالب درجة آلية رُصدت مبدئياً: هذه رسالة تأكيدها أو تعديلها بعد مراجعة المعلم
    const auto = prevTotal == null && x.ai && (x.taskId || x.retakeId) ? autoGrade(x) : null;
    const same = auto && !auto.pending && auto.total === g;
    const n = {
      type: 'grade', score: g, subId: x.id,
      title: prevTotal != null ? 'عدّل معلمك درجتك' : same ? '✓ أكّد معلمك درجتك' : auto ? 'راجع معلمك درجتك' : g >= 8 ? '🎉 وصل تقييم معلمك' : 'وصل تقييم معلمك',
      body: `${prevTotal != null ? 'صارت درجتك' : same ? 'راجع معلمك تسميعك وأكّد درجتك' : auto ? `راجع معلمك تسميعك، وصارت درجتك النهائية` : 'درجتك'} ${fmt10(g)} من ١٠ في «${title}». ${gradeCheer(g)}${teacher.notes ? ' ومعلمك كتب لك ملاحظة.' : ''}`,
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
    const base = { ...n, taskId: t.id, link: `./#/student/task/${t.id}`, tag: 'task-' + t.id };
    try {
      // صف أو كل الصفوف: تنبيه واحد للصف. واستهداف مخصص: تنبيه لكل صف مختار، ولكل طالب بعينه
      let r = { sent: 0, deferred: 0 };
      const addUp = (x) => { if (x) { r.sent += x.sent || 0; r.deferred += x.deferred || 0; } };
      const cls = tClasses(t).filter((c) => !(t.exClasses || []).includes(c));
      for (const c of cls) { const id = await store.addNotif({ ...base, classId: c }); addUp(await sendPush(id)); }
      const solo = tStudents(t).filter((pn) => !(t.exStudents || []).includes(pn) && !cls.includes(D.students.find((x) => x.id === pn)?.classId));
      if (solo.length) {
        const items = [];
        for (const pn of solo) items.push({ notif: await store.addStudentNotif(pn, base), student: pn });
        addUp(await sendPushBatch(items));
      }
      return !r.sent && !r.deferred ? '، ولم يفعّل أحد من المستهدفين إشعارات الجوال بعد' : r.sent ? `، ووصل إشعار إلى ${r.sent === 1 ? 'جهاز واحد' : r.sent === 2 ? 'جهازين' : `${ar(r.sent)} ${r.sent <= 10 ? 'أجهزة' : 'جهازاً'}`}${deferNote(r)}` : r.deferred ? deferNote(r) : '، ولم يفعّل أحد من طلاب الصف إشعارات الجوال بعد';
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
          <label class="field" style="flex:1 1 140px">النوع<select id="tkMode"><option value="hifz">تسميع غيباً</option><option value="recite">تلاوة نظراً</option></select></label>
        </div>
        <div class="row tk-time">
          <label class="field" style="flex:1 1 200px">يبدأ <small class="muted">(فارغ = الآن، أو وقت قادم لجدولته)</small><input type="datetime-local" id="tkStart"></label>
          <label class="field" style="flex:1 1 200px">ينتهي <small class="muted">(بعده بإذنك فقط)</small><input type="datetime-local" id="tkEnd"></label>
        </div>
        <div class="small muted" id="tkWhen"></div>
        <div class="field"><span>لمن الواجب؟</span><div class="tgt" id="tkTgt"></div></div>
        <label class="field">تعليمات للطلاب (اختياري)<input type="text" id="tkNotes" placeholder="مثال: ركّز على أحكام النون الساكنة"></label>
        <div class="remind-opt"><label class="row small" style="gap:8px"><input type="checkbox" id="tkRemind" ${E ? (E.remindEve ? 'checked' : '') : 'checked'}> <span>⏰ ذكّر الطلاب مساء اليوم السابق للموعد <span class="muted">(الساعة ${esc(remindTimeLabel())}، يحتاج موعداً)</span></span></label>
          <select id="tkRemindT" aria-label="لمن التذكير"><option value="pending">لمن لم يسلّم فقط</option><option value="all" ${E?.remindTarget === 'all' ? 'selected' : ''}>لكل طلاب الصف</option></select></div>
        <label class="row small notify-opt" style="gap:8px"><input type="checkbox" id="tkNotify" checked> <span>${E ? 'أشعر الطلاب بالتعديل <span class="muted">(يُرسل فقط إن تغيّر الموعد أو الآيات)</span>' : 'أرسل إشعاراً للطلاب <span class="muted">(في الجرس داخل الموقع، وعلى جوالات من فعّلها)</span>'}</span></label>
        <div class="row"><button class="btn primary" type="submit">${E ? 'حفظ التعديل' : 'إضافة الواجب'}</button>${E ? '<button class="btn" type="button" id="tkCancel">إلغاء التعديل</button>' : ''}</div>
      </form>
      <div class="stack"><div id="tkLate"></div><div class="stack" id="tkList"></div></div>
    </div>`;
    drawLateCard($('#tkLate', body));
    const readRange = bindRangePicker(body, 'tk', (r) => { if (!$('#tkTitle', body).dataset.touched) $('#tkTitle', body).value = `${surahName(r.surah)} ${ar(r.from)}–${ar(r.to)}`; });
    if (E) {
      $('#tkTitle', body).value = E.title; $('#tkTitle', body).dataset.touched = '1';
      $('#tkMode', body).value = E.mode || 'hifz';
      $('#tkStart', body).value = E.startAt && !taskStarted(E) ? toLocalInput(E.startAt) : ''; $('#tkEnd', body).value = toLocalInput(taskEnd(E)); $('#tkNotes', body).value = E.notes || '';
      $('#tkCancel', body).onclick = () => { editTask = null; drawTasks(body); };
    } else $('#tkTitle', body).value = `${surahName(last.surah)} ${ar(last.from)}–${ar(last.to)}`;
    $('#tkTitle', body).oninput = (e) => (e.target.dataset.touched = '1');
    // افتراضياً: ينتهي بعد ٣ أيام الساعة ١١:٥٩ مساءً
    if (!E) { const d = new Date(Date.now() + 3 * 864e5); d.setHours(23, 59, 0, 0); $('#tkEnd', body).value = toLocalInput(d.toISOString()); }
    const when = () => {
      const s = $('#tkStart', body).value, e = $('#tkEnd', body).value, el = $('#tkWhen', body);
      const sD = s ? new Date(s) : null, eD = e ? new Date(e) : null;
      el.innerHTML = eD && eD <= (sD || new Date()) ? '<span style="color:var(--bad)">وقت الانتهاء قبل وقت البداية.</span>' : sD && sD > new Date() ? `⏳ يُجدول الواجب ويظهر للطلاب ${esc(fmtDT(sD.toISOString()))}، ويصلهم الإشعار حينها.` : '';
    };
    $('#tkStart', body).oninput = when; $('#tkEnd', body).oninput = when; when();
    const tgt = targetPicker($('#tkTgt', body), E ? { all: E.classId === 'all', classIds: tClasses(E).filter((c) => c !== 'all' && !(E.exClasses || []).includes(c)), studentIds: tStudents(E).filter((x) => !(E.exStudents || []).includes(x)) } : { all: true, classIds: [], studentIds: [] });
    $('#tkForm', body).onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true;
      const r = readRange();
      const sel = tgt.value();
      if (!sel.all && !sel.classIds.length && !sel.studentIds.length) { btn.disabled = false; return toast('اختر لمن الواجب: كل الصفوف، أو صفاً، أو طالباً.'); }
      const sv = $('#tkStart', body).value, ev = $('#tkEnd', body).value;
      const startAt = sv ? new Date(sv).toISOString() : (E?.startAt && taskStarted(E) ? E.startAt : new Date().toISOString());
      const endAt = ev ? new Date(ev).toISOString() : null;
      if (endAt && endAt <= startAt) { btn.disabled = false; return toast('وقت الانتهاء يجب أن يكون بعد وقت البداية.'); }
      const scheduled = new Date(startAt) > Date.now() + 60e3;
      const t = { title: $('#tkTitle', body).value.trim(), ...r, ...buildTarget(sel), mode: $('#tkMode', body).value, startAt, endAt, due: endAt ? riyadhDate(endAt) : '', startPending: scheduled, notes: $('#tkNotes', body).value.trim() };
      // ما اختاره المعلم صراحةً يُلغي حذفاً سابقاً عنه
      if (E) { t.exClasses = (E.exClasses || []).filter((c) => !sel.classIds.includes(c) && !sel.all); t.exStudents = (E.exStudents || []).filter((x) => !sel.studentIds.includes(x)); }
      t.remindEve = $('#tkRemind', body).checked && !!t.due;
      t.remindTarget = $('#tkRemindT', body).value;
      const wantNotify = $('#tkNotify', body).checked;
      try {
        if (E) {
          const changes = [];
          if (t.surah !== E.surah || t.from !== E.from || t.to !== E.to) changes.push('تغيّرت الآيات');
          if ((t.endAt || '') !== (taskEnd(E) || '')) changes.push(t.endAt ? 'تغيّر موعد التسليم' : 'أُلغي موعد التسليم');
          if (!scheduled && E.startPending) t.startPending = false; // صار يبدأ الآن
          await store.saveTask({ id: E.id, ...t });
          editTask = null;
          const startNow = !scheduled && E.startPending && taskStarted(E) === false; // كان مجدولاً وبدأ الآن بالتعديل
          const extra = wantNotify && !scheduled && (changes.length || startNow) ? await notifyTask({ id: E.id, ...t }, startNow ? 'new' : 'edit', changes.join(' و')) : '';
          toast(scheduled ? `حُفظ التعديل. الواجب مجدول ويبدأ ${fmtDT(startAt)}.` : `حُفظ التعديل${wantNotify && (changes.length || startNow) ? ' وأُرسل التنبيه' + extra : wantNotify ? '. لم يتغير الموعد أو الآيات، فلم يُرسل تنبيه' : ''}.`);
        } else {
          if (scheduled && !wantNotify) t.startPending = false;
          const id = await store.saveTask(t);
          if (scheduled) toast(`⏳ جُدول الواجب لـ${targetLabel(t, className, stuName)}: يظهر للطلاب ${fmtDT(startAt)}${wantNotify ? ' ويصلهم الإشعار حينها' : ''}.`);
          else { const extra = wantNotify ? await notifyTask({ id, ...t }, 'new') : ''; toast(`أُضيف الواجب لـ${targetLabel(t, className, stuName)}${wantNotify ? ' ووصل تنبيه للطلاب' + extra : ' دون إشعار'}.`); }
        }
      } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); btn.disabled = false; return; }
      await reload();
    };
    const L = [...D.tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('#tkList', body).innerHTML = L.length ? L.map((t) => {
      const target = taskStudents(t, D.students);
      const doneSet = new Set(D.subs.filter((x) => x.taskId === t.id).map((x) => x.pn));
      const done = target.filter((st) => doneSet.has(st.id)).length;
      return `<div class="card task${E && E.id === t.id ? ' editing' : ''}"><div class="t-main"><h3>${esc(t.title)}</h3><div class="t-range">${esc(rangeLabel(t.surah, t.from, t.to))}</div>
        <div class="small muted">👥 ${esc(targetLabel(t, className, stuName))} · ${t.mode === 'hifz' ? 'غيباً' : 'نظراً'}${taskEnd(t) ? ` · حتى ${esc(fmtDT(taskEnd(t)))}` : ''}</div>
        ${!taskStarted(t) ? `<span class="pill gold-pill">⏳ مجدول: يبدأ ${esc(fmtDT(t.startAt))}</span>` : taskClosed(t) ? '<span class="pill mute">انتهى موعده</span>' : ''}${(lateReqs || []).filter((x) => x.id === t.id && x.status === 'pending').length ? ` <span class="pill warn">⏰ ${ar((lateReqs || []).filter((x) => x.id === t.id && x.status === 'pending').length)} طلب تسليم متأخر</span>` : ''}
        <div class="progress" style="margin-top:8px;max-width:260px"><i style="width:${target.length ? (done / target.length) * 100 : 0}%"></i></div><div class="small muted">${ar(done)} من ${ar(target.length)} طالباً أرسلوا</div></div>
        <div class="row"><button class="btn sm gold" type="button" data-dist="${esc(t.id)}">👥 التوزيع</button><button class="btn sm" type="button" data-edit="${esc(t.id)}">تعديل</button><button class="btn sm danger" type="button" data-del="${esc(t.id)}">حذف</button></div></div>`;
    }).join('') : '<div class="empty">لم تُنشئ أي واجب بعد. أنشئ الأول من النموذج.</div>';
    $$('[data-edit]', body).forEach((b) => (b.onclick = () => { editTask = D.tasks.find((t) => t.id === b.dataset.edit); drawTasks(body); $('#tkForm', body).scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#tkTitle', body).focus({ preventScroll: true }); }));
    $$('[data-del]', body).forEach((b) => (b.onclick = () => deleteTaskDialog(D.tasks.find((x) => x.id === b.dataset.del))));
    $$('[data-dist]', body).forEach((b) => (b.onclick = () => taskDistribution(D.tasks.find((x) => x.id === b.dataset.dist))));
  }

  /* --- التقييم الميسّر: إعادة حساب الدرجات السابقة مرة واحدة (لا تنزل أي درجة) --- */
  /**
   * الإعادة التي يطلبها المعلم للمقطع كله تحلّ محل التسليم القديم: حين تصل يُحذف القديم (مع تسجيله)
   * ويبقى الجديد. يسري على الطلبات السابقة أيضاً. إعادة جزء من المقطع لا تحذف الأصل، وإعادة يطلبها
   * الطالب تُبقي المحاولتين لتُعتمد الأعلى.
   */
  let cleaningRetakes = false;
  async function replaceRetaken() {
    if (cleaningRetakes) return;
    const olds = [];
    D.subs.forEach((y) => {
      if (!y.retakeId || !y.retakeOf || y.retakeByStudent) return;
      const old = D.subs.find((o) => o.pn === y.pn && o.id === y.retakeOf && !o.retakeId);
      if (old && old.surah === y.surah && old.from === y.from && old.to === y.to) olds.push(old);
    });
    if (!olds.length) return;
    cleaningRetakes = true;
    let n = 0;
    for (const o of olds) {
      try { await store.deleteSubmission(o.pn, o.id); n++; D.subs = D.subs.filter((y) => !(y.pn === o.pn && y.id === o.id)); } catch (e) { console.warn('replace retake', e); }
    }
    cleaningRetakes = false;
    if (n) { schedulePublish(); if (tab === 'subs') drawBody(); toast(n === 1 ? '🔁 حلّت الإعادة محل التسليم القديم، فحُذف القديم.' : `🔁 حلّت ${ar(n)} إعادات محل التسليمات القديمة، فحُذفت القديمة.`); }
  }

  async function migrateGrades() {
    try {
      const cfg = await store.getNotifySettings();
      if (cfg.gradingV3At) return;
      const cat = mergeCatalog(await store.getErrorCatalog().catch(() => null));
      const ups = [];
      D.subs.filter((x) => x.teacher && typeof x.teacher.total === 'number' && (x.teacher.gv || 0) < 3).forEach((x) => {
        const end = x.statuses ? readEnd(x.statuses) : Infinity;
        const marks = (x.tj || []).filter((k) => !(k.r === 'v_missing' && k.i >= end)).map(({ d, max, ...k }) => k); // بالخصم الجديد
        const g = marks.length ? gradeFrom(deduction(marks, cat), coverage(x.statuses)) : autoGrade(x)?.total ?? x.teacher.total;
        const total = Math.max(x.teacher.total, g);
        ups.push({ x, teacher: { ...x.teacher, total, gv: 3, ...(total !== x.teacher.total ? { prevTotal: x.teacher.prevTotal ?? x.teacher.total } : {}) }, up: total > x.teacher.total });
      });
      let raised = 0;
      if (ups.length) {
        const r = await runBulk('تحديث الدرجات السابقة بالتقييم الميسّر', ups, async (u) => { await store.updateSubmission(u.x.pn, u.x.id, { teacher: u.teacher }); u.x.teacher = u.teacher; if (u.up) raised++; });
        if (r.fail) { toast(`تعذر تحديث ${ar(r.fail)} من الدرجات، وسيُعاد المحاولة لاحقاً.`); return; }
      }
      await store.setNotifySettings({ gradingV3At: new Date().toISOString() });
      schedulePublish();
      const autoN = D.subs.filter((x) => !x.teacher && (x.taskId || x.retakeId) && x.statuses).length;
      if (ups.length || autoN) toast(`✓ طُبّق التقييم الميسّر على الدرجات السابقة: ارتفعت ${ar(raised)} من درجاتك، و${ar(autoN)} درجة آلية، ولم تنزل أي درجة.`);
      if (tab === 'subs' || tab === 'honor') drawBody();
    } catch (e) { console.warn('grades v2', e); }
  }

  /* --- التسليم بعد انتهاء الموعد: طلبات الطلاب وقرار المعلم --- */
  function drawLateCard(host) {
    const P = lateReqs.filter((x) => x.status === 'pending' && D.tasks.some((t) => t.id === x.id));
    if (!P.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="card stack late-card" style="gap:8px"><h3 style="margin:0">⏰ طلبات تسليم بعد انتهاء الموعد (${ar(P.length)})</h3>
      ${P.map((x) => `<div class="row" style="justify-content:space-between;gap:6px"><span><b>${esc(stuName(x.pn))}</b> <span class="small muted">${esc(className(D.students.find((s) => s.id === x.pn)?.classId))} · ${esc(D.tasks.find((t) => t.id === x.id)?.title || x.taskTitle || '')} · ${fmtDate(x.at)}</span></span>
        <span class="row" style="gap:4px"><button class="btn sm primary" type="button" data-lok="${esc(x.pn)}|${esc(x.id)}">اسمح</button><button class="btn sm" type="button" data-lno="${esc(x.pn)}|${esc(x.id)}">اعتذر</button></span></div>`).join('')}</div>`;
    $$('[data-lok]', host).forEach((b) => (b.onclick = () => { const [pn, id] = b.dataset.lok.split('|'); decideLate(pn, id, 'ok'); }));
    $$('[data-lno]', host).forEach((b) => (b.onclick = () => { const [pn, id] = b.dataset.lno.split('|'); decideLate(pn, id, 'no'); }));
  }
  async function decideLate(pn, taskId, status, after) {
    const t = D.tasks.find((x) => x.id === taskId);
    try {
      await store.decideLate(pn, taskId, status, { taskTitle: t?.title || '', name: stuName(pn) });
      const i = lateReqs.findIndex((x) => x.pn === pn && x.id === taskId);
      const d = { ...(i >= 0 ? lateReqs[i] : { id: taskId, pn }), status, decidedAt: new Date().toISOString() };
      if (i >= 0) lateReqs[i] = d; else lateReqs.push(d);
      const n = status === 'ok'
        ? { type: 'late', title: `✓ سمح لك معلمك بتسليم «${t?.title || 'الواجب'}»`, body: 'يمكنك الآن تسجيل تسميعك رغم انتهاء الموعد. لا تؤجّل!', taskId, link: `./#/student/task/${taskId}`, tag: 'late-' + taskId }
        : { type: 'late', title: `اعتذر معلمك عن قبول «${t?.title || 'الواجب'}» متأخراً`, body: 'حاول في الواجبات القادمة أن تسلّم قبل انتهاء الموعد، بارك الله فيك.', taskId, link: './#/student', tag: 'late-' + taskId };
      try { const id = await store.addStudentNotif(pn, n); await sendPush(id, pn); } catch (e) { console.warn(e); }
      toast(status === 'ok' ? `سُمح لـ${stuName(pn)} بالتسليم، ووصله إشعار.` : 'أُبلغ الطالب بالاعتذار.');
      if (after) after(); else if (tab === 'tasks') drawBody();
    } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
  }

  /* --- طلبات إعادة التسميع من الطلاب: موافقة تفتح محاولة جديدة خلال ٢٤ ساعة، وتُعتمد الأعلى --- */
  function paintRedo() {
    const host = document.getElementById('redoBox'); if (!host) return;
    const P = lateReqs.filter((x) => x.kind === 'redo' && x.status === 'pending');
    if (!P.length) { host.innerHTML = ''; return; }
    const subOf = (x) => D.subs.find((y) => y.pn === x.pn && (y.id === x.subId || (y.taskId === x.taskId && !y.retakeId)));
    host.innerHTML = `<div class="card stack late-card" style="gap:8px;margin-bottom:12px"><h3 style="margin:0">🔁 طلبات إعادة التسميع (${ar(P.length)})</h3>
      ${P.map((x) => { const sb = subOf(x), sc = sb ? subScore(sb) : null; return `<div class="stack" style="gap:4px;border-top:1px solid var(--line);padding-top:8px"><div class="row" style="justify-content:space-between;gap:6px"><span><b>${esc(stuName(x.pn))}</b> <span class="small muted">${esc(className(D.students.find((s) => s.id === x.pn)?.classId))} · ${esc(D.tasks.find((t) => t.id === x.taskId)?.title || x.taskTitle || '')}${sc != null ? ` · درجته ${fmtQ(sc)} من ١٠` : ''} · ${fmtDate(x.at)}</span></span>
        <span class="row" style="gap:4px">${sb ? `<button class="btn sm" type="button" data-rdv="${esc(x.pn)}|${esc(x.id)}">استمع</button>` : ''}<button class="btn sm primary" type="button" data-rdok="${esc(x.pn)}|${esc(x.id)}">وافق</button><button class="btn sm" type="button" data-rdno="${esc(x.pn)}|${esc(x.id)}">اعتذر</button></span></div>
        ${x.reason ? `<div class="small">«${esc(x.reason)}»</div>` : ''}</div>`; }).join('')}</div>`;
    const find = (v) => { const [pn, id] = v.split('|'); return lateReqs.find((x) => x.pn === pn && x.id === id); };
    $$('[data-rdv]', host).forEach((b) => (b.onclick = () => { const x = find(b.dataset.rdv), sb = x && subOf(x); if (sb) openSubmission(sb); }));
    $$('[data-rdok]', host).forEach((b) => (b.onclick = () => { b.disabled = true; decideRedo(find(b.dataset.rdok), 'ok', subOf); }));
    $$('[data-rdno]', host).forEach((b) => (b.onclick = () => { b.disabled = true; decideRedo(find(b.dataset.rdno), 'no', subOf); }));
  }
  async function decideRedo(x, status, subOf) {
    if (!x) return;
    const t = D.tasks.find((y) => y.id === x.taskId), sb = subOf(x), title = t?.title || x.taskTitle || 'الواجب';
    try {
      let extra = {};
      if (status === 'ok') {
        const src = sb || t; if (!src) throw new Error('لم يُعثر على الواجب.');
        const due = addDays(riyadhDay(), 1);
        const r = { subId: sb?.id || null, taskId: x.taskId, taskTitle: title, surah: src.surah, from: src.from, to: src.to, mode: src.mode || t?.mode || 'recite', notes: 'وافق معلمك على طلبك. أعد التسميع، وتُعتمد درجتك الأعلى.', due, byStudent: true };
        const rid = await store.addRetake(x.pn, r);
        extra = { retakeId: rid };
        if (sb) { const req = { id: rid, surah: r.surah, from: r.from, to: r.to, at: new Date().toISOString() }; await store.updateSubmission(sb.pn, sb.id, { retakeRequested: req }).catch(() => {}); sb.retakeRequested = req; }
        try { const nid = await store.addStudentNotif(x.pn, { type: 'retake', retakeId: rid, title: '🔁 وافق معلمك على إعادة التسميع', body: `أعد تسميع «${title}» قبل ${dueText(due)}، وتُعتمد درجتك الأعلى.`, link: `./#/student/retake/${rid}`, tag: 'retake-' + rid }); await sendPush(nid, x.pn); } catch (e) { console.warn(e); }
      } else {
        try { const nid = await store.addStudentNotif(x.pn, { type: 'late', title: `اعتذر معلمك عن إعادة «${title}»`, body: 'تبقى درجتك كما هي. استعدّ جيداً للواجب القادم، بارك الله فيك.', link: './#/student', tag: 'redo-' + x.taskId }); await sendPush(nid, x.pn); } catch (e) { console.warn(e); }
      }
      await store.decideLate(x.pn, x.id, status, { ...extra, name: stuName(x.pn) });
      Object.assign(x, { status, decidedAt: new Date().toISOString(), ...extra });
      toast(status === 'ok' ? `فُتحت لـ${stuName(x.pn)} محاولة جديدة ووصله إشعار.` : 'أُبلغ الطالب بالاعتذار.');
      paintRedo(); if (tab === 'subs') { const sl = document.getElementById('subList'); if (sl && store.mode === 'local') { D.subs = await store.allSubmissions(); D.subs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); } }
    } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); paintRedo(); }
  }

  /* --- لمن الواجب: الاختيار، والتوزيع، والحذف عن صف أو طالب --- */
  const stuName = (pn) => D.students.find((x) => x.id === pn)?.name || 'طالب';
  /** منتقي المستهدفين: كل الصفوف، أو صفوف، و/أو طلاب بأسمائهم */
  function targetPicker(host, init) {
    const st = { all: !!init.all, classIds: new Set(init.classIds), studentIds: new Set(init.studentIds) };
    let q = '';
    const count = () => taskStudents(buildTarget({ all: st.all, classIds: [...st.classIds], studentIds: [...st.studentIds] }), D.students).length;
    const paint = () => {
      const groups = D.classes.map((c) => ({ c, list: D.students.filter((s) => s.classId === c.id && (!q || s.name.includes(q))) })).filter((g) => g.list.length);
      host.innerHTML = `<div class="tgt-row"><label class="tgt-chip${st.all ? ' on' : ''}"><input type="checkbox" data-tall ${st.all ? 'checked' : ''}> 🏫 كل الصفوف</label>
          ${D.classes.map((c) => `<label class="tgt-chip${!st.all && st.classIds.has(c.id) ? ' on' : ''}${st.all ? ' dim' : ''}"><input type="checkbox" data-tcls="${esc(c.id)}" ${!st.all && st.classIds.has(c.id) ? 'checked' : ''} ${st.all ? 'disabled' : ''}> ${esc(c.name)}</label>`).join('')}</div>
        <details class="tgt-stu" ${st.studentIds.size || q ? 'open' : ''}><summary>👤 طلاب بأسمائهم${st.studentIds.size ? ` (${ar(st.studentIds.size)})` : ''} <span class="muted small">— لإرسال الواجب لطالب معيّن</span></summary>
          ${st.all ? '<p class="small muted" style="margin:6px 0">«كل الصفوف» تشمل الجميع. ألغِ اختيارها لتختار طلاباً بأعينهم.</p>' : `<input type="search" data-tq placeholder="ابحث باسم الطالب" value="${esc(q)}">
          <div class="tgt-list">${groups.map((g) => `<div class="tgt-g"><b class="small">${esc(g.c.name)}${st.classIds.has(g.c.id) ? ' <span class="muted">(الصف كله مختار)</span>' : ''}</b>${g.list.map((s) => `<label class="tgt-s"><input type="checkbox" data-tstu="${esc(s.id)}" ${st.studentIds.has(s.id) || st.classIds.has(g.c.id) ? 'checked' : ''} ${st.classIds.has(g.c.id) ? 'disabled' : ''}> ${esc(s.name)}</label>`).join('')}</div>`).join('') || '<span class="small muted">لا نتائج</span>'}</div>`}
        </details>
        <div class="small tgt-sum">سيصل الواجب إلى <b>${ar(count())}</b> ${count() === 1 ? 'طالب' : 'طالباً'}</div>`;
      $('[data-tall]', host).onchange = (e) => { st.all = e.target.checked; paint(); };
      $$('[data-tcls]', host).forEach((c) => (c.onchange = () => { c.checked ? st.classIds.add(c.dataset.tcls) : st.classIds.delete(c.dataset.tcls); paint(); }));
      $$('[data-tstu]', host).forEach((c) => (c.onchange = () => { c.checked ? st.studentIds.add(c.dataset.tstu) : st.studentIds.delete(c.dataset.tstu); paint(); }));
      const qi = $('[data-tq]', host); if (qi) qi.oninput = (e) => { q = e.target.value.trim(); const pos = e.target.selectionStart; paint(); const n = $('[data-tq]', host); n.focus(); n.setSelectionRange(pos, pos); };
    };
    paint();
    return { value: () => ({ all: st.all, classIds: [...st.classIds], studentIds: [...st.studentIds].filter((pn) => !st.classIds.has(D.students.find((x) => x.id === pn)?.classId)) }) };
  }
  /** شاشة توزيع الواجب: الصفوف والطلاب (موجود/محذوف) وحالة كل طالب */
  function taskDistribution(t) {
    if (!t) return;
    const subs = D.subs.filter((x) => x.taskId === t.id);
    const subOf = (pn) => subs.filter((x) => x.pn === pn).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    const cl = tClasses(t), ex = new Set(t.exClasses || []), exS = new Set(t.exStudents || []), solo = new Set(tStudents(t));
    const classRows = D.classes.map((c) => {
      const inT = cl.includes('all') || cl.includes(c.id), removed = inT && ex.has(c.id);
      const studs = D.students.filter((s) => s.classId === c.id);
      const recv = studs.filter((s) => taskFor(t, s));
      if (!inT && !recv.length && !studs.some((s) => solo.has(s.id) || exS.has(s.id))) return { c, state: 'none', studs, recv };
      return { c, state: removed ? 'removed' : inT ? 'on' : 'partial', studs, recv };
    });
    const stuState = (s) => {
      if (!taskFor(t, s)) return exS.has(s.id) || (ex.has(s.classId) && (cl.includes('all') || cl.includes(s.classId))) ? 'removed' : 'none';
      const x = subOf(s.id);
      return !x ? 'pending' : x.teacher?.total != null ? 'graded' : autoGrade(x) ? 'auto' : 'done';
    };
    const lbl = { on: '<span class="pill ok">✓ موجود</span>', removed: '<span class="pill bad">✕ محذوف عنه</span>', partial: '<span class="pill warn">طلاب بأسمائهم</span>', none: '<span class="pill mute">غير مُرسل</span>' };
    const sl = { pending: '<span class="pill warn">⏳ لم يسلّم</span>', done: '<span class="pill">🎙️ سلّم</span>', graded: (s) => `<span class="pill ok">✓ قيّمته ${fmtQ(subOf(s.id).teacher.total)}</span>`, auto: (s) => { const g = autoGrade(subOf(s.id)); return `<span class="pill">🤖 ${fmtQ(g.total)}${g.pending && aiEnabled() ? ' ⏳' : ''}</span>`; }, removed: '<span class="pill bad">✕ محذوف عنه</span>', none: '<span class="pill mute">غير مُرسل</span>' };
    const tot = taskStudents(t, D.students), doneN = tot.filter((s) => subOf(s.id)).length;
    openModal(`<div class="stack dist"><h2>👥 توزيع الواجب: ${esc(t.title)}</h2>
      <p class="small muted" style="margin:0">${esc(rangeLabel(t.surah, t.from, t.to))}${taskEnd(t) ? ` · ${taskClosed(t) ? 'انتهى موعده' : 'ينتهي'} ${esc(fmtDT(taskEnd(t)))}` : ''}${!taskStarted(t) ? ` · ⏳ يبدأ ${esc(fmtDT(t.startAt))}` : ''} · موجّه الآن إلى <b>${ar(tot.length)}</b> طالباً، سلّم منهم ${ar(doneN)}.</p>
      <div class="dist-legend small"><span>✓ موجود</span><span>✕ محذوف عنه (تسليماته السابقة محفوظة)</span><span>غير مُرسل</span></div>
      ${classRows.map(({ c, state, studs, recv }) => `<details class="dist-c ${state}" ${state === 'partial' ? 'open' : ''}><summary><b>${esc(c.name)}</b> ${lbl[state]} <span class="small muted">${ar(recv.length)} من ${ar(studs.length)}</span>
          <span class="dist-act">${state === 'on' ? `<button class="btn sm danger" type="button" data-rmc="${esc(c.id)}">احذفه عن الصف</button>` : `<button class="btn sm" type="button" data-adc="${esc(c.id)}">${state === 'removed' ? '↺ أعِده للصف' : '+ أرسله للصف'}</button>`}</span></summary>
        <ul class="dist-s">${studs.map((s) => { const k = stuState(s); const lr = lateReqs.find((x) => x.pn === s.id && x.id === t.id), closed = k === 'pending' && taskClosed(t);
          const lateUi = closed ? (lr?.status === 'ok' ? '<span class="pill ok">مسموح له متأخراً</span>' : lr?.status === 'pending' ? `<span class="pill warn">⏰ يطلب السماح</span><button class="btn sm primary" type="button" data-lok="${esc(s.id)}">اسمح</button><button class="btn sm" type="button" data-lno="${esc(s.id)}">اعتذر</button>` : `${lr?.status === 'no' ? '<span class="pill mute">اعتذرت له</span>' : ''}<button class="btn sm" type="button" data-lok="${esc(s.id)}">اسمح له بالتسليم</button>`) : '';
          const late = subOf(s.id)?.late ? ' <span class="pill warn">متأخر</span>' : '';
          return `<li><span>${esc(s.name)}</span>${typeof sl[k] === 'function' ? sl[k](s) : sl[k]}${late}${lateUi}<span class="dist-act">${k === 'removed' || k === 'none' ? `<button class="btn sm ghost" type="button" data-ads="${esc(s.id)}">${k === 'removed' ? '↺ أعِده' : '+ أرسله'}</button>` : `<button class="btn sm ghost danger" type="button" data-rms="${esc(s.id)}">احذفه عنه</button>`}</span></li>`; }).join('') || '<li class="muted">لا طلاب</li>'}</ul></details>`).join('')}
      <div class="row"><button class="btn primary" type="button" data-close>تم</button></div></div>`, (m) => {
      const apply = async (patch, msg, notifyPns = []) => {
        const nt = { ...t, ...patch };
        if (!taskStudents(nt, D.students).length && !(await confirmBox('بعد هذا لن يبقى أحد يصله الواجب. احذفه نهائياً؟', 'احذفه نهائياً'))) return;
        try {
          if (!taskStudents(nt, D.students).length) { await store.deleteTask(t.id); toast('حُذف الواجب نهائياً. تبقى تسليمات الطلاب محفوظة.'); await reload(); closeModal(); return; }
          await store.saveTask({ id: t.id, ...patch }); Object.assign(t, patch);
          let extra = '';
          if (notifyPns.length) { const items = []; for (const pn of notifyPns) items.push({ notif: await store.addStudentNotif(pn, { type: 'task', title: `واجب جديد: ${t.title}`, body: taskNotifBody(t), taskId: t.id, link: `./#/student/task/${t.id}`, tag: 'task-' + t.id }), student: pn }); try { const r = await sendPushBatch(items); if (r?.sent) extra = ` ووصل إشعار إلى ${ar(r.sent)} جهازاً`; } catch {} }
          toast(msg + extra + '.'); await reload(); taskDistribution(D.tasks.find((x) => x.id === t.id));
        } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
      };
      $$('[data-lok]', m).forEach((b) => (b.onclick = () => decideLate(b.dataset.lok, t.id, 'ok', () => taskDistribution(t))));
      $$('[data-lno]', m).forEach((b) => (b.onclick = () => decideLate(b.dataset.lno, t.id, 'no', () => taskDistribution(t))));
      const cls = () => (t.classId === 'custom' ? [...(t.classIds || [])] : t.classId === 'all' ? [] : [t.classId]);
      $$('[data-rmc]', m).forEach((b) => (b.onclick = () => apply({ exClasses: [...new Set([...(t.exClasses || []), b.dataset.rmc])], exStudents: (t.exStudents || []), studentIds: tStudents(t).filter((pn) => D.students.find((x) => x.id === pn)?.classId !== b.dataset.rmc), ...(t.classId === 'custom' ? {} : {}) }, `حُذف الواجب عن ${className(b.dataset.rmc)}`)));
      $$('[data-adc]', m).forEach((b) => (b.onclick = () => {
        const c = b.dataset.adc, wasEx = (t.exClasses || []).includes(c);
        const patch = { exClasses: (t.exClasses || []).filter((x) => x !== c), exStudents: (t.exStudents || []).filter((pn) => D.students.find((x) => x.id === pn)?.classId !== c) };
        if (!wasEx && t.classId !== 'all') Object.assign(patch, { classId: 'custom', classIds: [...new Set([...cls(), c])], studentIds: tStudents(t).filter((pn) => D.students.find((x) => x.id === pn)?.classId !== c) });
        const newly = D.students.filter((s) => s.classId === c && !taskFor(t, s)).map((s) => s.id);
        apply(patch, `${wasEx ? 'أُعيد' : 'أُرسل'} الواجب إلى ${className(c)}`, newly);
      }));
      $$('[data-rms]', m).forEach((b) => (b.onclick = () => { const pn = b.dataset.rms; apply({ exStudents: [...new Set([...(t.exStudents || []), pn])], studentIds: tStudents(t).filter((x) => x !== pn), ...(t.classId === 'custom' ? {} : {}) }, `حُذف الواجب عن ${stuName(pn)}`); }));
      $$('[data-ads]', m).forEach((b) => (b.onclick = () => {
        const pn = b.dataset.ads, patch = { exStudents: (t.exStudents || []).filter((x) => x !== pn) };
        const s = D.students.find((x) => x.id === pn);
        if (!taskFor({ ...t, ...patch }, s)) Object.assign(patch, { classId: 'custom', classIds: t.classId === 'all' ? D.classes.map((c) => c.id).filter((c) => !(t.exClasses || []).includes(c)) : cls(), studentIds: [...new Set([...tStudents(t), pn])], exClasses: t.classId === 'all' ? [] : (t.exClasses || []) });
        apply(patch, `${(t.exStudents || []).includes(pn) ? 'أُعيد' : 'أُرسل'} الواجب إلى ${stuName(pn)}`, [pn]);
      }));
    });
  }
  /** حذف الواجب: عن الجميع نهائياً، أو عن صف، أو عن طالب */
  function deleteTaskDialog(t) {
    if (!t) return;
    const studs = taskStudents(t, D.students);
    const clsIn = [...new Set(studs.map((s) => s.classId))];
    openModal(`<form class="stack" id="dtF"><h2>🗑️ حذف الواجب «${esc(t.title)}»</h2>
      <label class="dt-opt"><input type="radio" name="dt" value="all" checked> <span><b>عن الجميع (حذف نهائي)</b><small>يختفي من كل الصفوف والطلاب.</small></span></label>
      ${clsIn.length ? `<label class="dt-opt"><input type="radio" name="dt" value="cls"> <span><b>عن صف معيّن</b><select id="dtC">${clsIn.map((c) => `<option value="${esc(c)}">${esc(className(c))}</option>`).join('')}</select></span></label>` : ''}
      ${studs.length ? `<label class="dt-opt"><input type="radio" name="dt" value="stu"> <span><b>عن طالب معيّن</b><select id="dtS">${studs.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => `<option value="${esc(s.id)}">${esc(s.name)} — ${esc(className(s.classId))}</option>`).join('')}</select></span></label>` : ''}
      <p class="small muted" style="margin:0">في كل الحالات تبقى التسليمات السابقة ودرجاتها ونقاطها محفوظة في السجل.</p>
      <div class="row"><button class="btn danger" type="submit">احذف</button><button class="btn" type="button" id="dtDist">👥 افتح التوزيع</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      $$('select', m).forEach((sel) => (sel.onfocus = sel.onchange = () => { const r = sel.closest('.dt-opt').querySelector('input'); r.checked = true; }));
      $('#dtDist', m).onclick = () => taskDistribution(t);
      $('#dtF', m).onsubmit = async (e) => {
        e.preventDefault();
        const how = $('input[name=dt]:checked', m).value;
        try {
          if (how === 'all') { if (editTask?.id === t.id) editTask = null; await store.deleteTask(t.id); closeModal(); toast('حُذف الواجب عن الجميع. تبقى التسليمات محفوظة.'); await reload(); return; }
          const patch = how === 'cls'
            ? { exClasses: [...new Set([...(t.exClasses || []), $('#dtC', m).value])], studentIds: tStudents(t).filter((pn) => D.students.find((x) => x.id === pn)?.classId !== $('#dtC', m).value) }
            : { exStudents: [...new Set([...(t.exStudents || []), $('#dtS', m).value])], studentIds: tStudents(t).filter((x) => x !== $('#dtS', m).value) };
          const nt = { ...t, ...patch };
          if (!taskStudents(nt, D.students).length) { await store.deleteTask(t.id); closeModal(); toast('لم يبقَ أحد يصله الواجب، فحُذف نهائياً.'); await reload(); return; }
          await store.saveTask({ id: t.id, ...patch });
          closeModal(); toast(how === 'cls' ? `حُذف الواجب عن ${className($('#dtC', m).value)}.` : `حُذف الواجب عن ${stuName($('#dtS', m).value)}.`); await reload();
        } catch (x) { toast('تعذر الحذف: ' + (x.code || x.message)); }
      };
    });
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
    const videoUrl = new URL('guide/', location.origin + location.pathname.replace(/[^/]*$/, '')).href;
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
  let repApi = null, repMonthInit = repMonthDeep;
  function drawReports(body) {
    repApi = mountReports(body, {
      D, store, pref, toast, openModal, closeModal, confirmBox, className, surahName, subScore, taskFor, taskStarted, taskClosed, taskEnd, normSegs, khDone, nWord, sendPushBatch,
      openSubmission: (x) => openSubmission(x),
      goAnn: (title, text) => { goTab('ann'); setTimeout(() => { const t = $('#anTitle', app), b = $('#anBody', app); if (t) t.value = title; if (b) { b.value = text.slice(0, 500); b.dispatchEvent(new Event('input')); b.focus(); b.scrollIntoView({ block: 'center' }); } toast('جهّزت لك نص الإعلان. راجعه ثم انشره.'); }, 150); },
      drawOld: (host, p, cls) => drawRepOld(host, p, cls),
    });
    if (repMonthInit) { const ym = repMonthInit; repMonthInit = null; repApi.monthReport(ym); }
  }
  /** متوسط الدقة لكل صف، وتعلّم التقييم، وخريطة الأخطاء (تتبع الفلتر الزمني) */
  function drawRepOld(host, p, cls) {
    const inP = (x) => { const t = Date.parse(x.createdAt || '') || 0; return t >= p.from && t < p.to; };
    const byClass = D.classes.filter((c) => cls === 'all' || c.id === cls).map((c) => {
      const subs = D.subs.filter((x) => x.classId === c.id && inP(x));
      const auto = subs.filter((x) => x.percent != null);
      const graded = subs.filter((x) => x.teacher);
      return { c, n: subs.length, avg: auto.length ? Math.round(auto.reduce((a, x) => a + x.percent, 0) / auto.length) : null, tavg: graded.length ? Math.round((graded.reduce((a, x) => a + x.teacher.total, 0) / graded.length) * 10) / 10 : null };
    });
    host.innerHTML = `<div class="card stack emap" id="emap" style="margin-bottom:16px"></div><div class="grid2" style="align-items:start">
      <div class="card stack" style="gap:12px"><h3>متوسط الدقة الآلية لكل صف</h3>
        ${byClass.map((r) => `<div class="bar-row"><span>${esc(r.c.name)}</span><div class="bar"><i style="width:${r.avg ?? 0}%"></i></div><b class="num">${r.avg == null ? '—' : ar(r.avg) + '٪'}</b></div>
        <div class="small muted" style="margin-top:-8px">${ar(r.n)} تسميع${r.tavg != null ? `، متوسط درجتك ${ar(r.tavg)}/١٠` : ''}</div>`).join('') || '<span class="muted">لا توجد صفوف.</span>'}
      </div>
      ${learnCard()}
    </div>`;
    emF.range = { from: p.from, to: p.to }; emF.cls = cls;
    drawErrMap($('#emap', host));
  }

  /* --- خريطة أخطاء الصف على المصحف --- */
  const emF = { cls: 'all', period: 'all', surah: null, range: null };
  function errData() {
    const from = emF.range ? emF.range.from : emF.period === '30' ? Date.now() - 30 * 864e5 : emF.period === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : 0, to = emF.range ? emF.range.to : Infinity;
    const subs = D.subs.filter((x) => { const t = new Date(x.createdAt).getTime(); return x.surah && (emF.cls === 'all' || x.classId === emF.cls) && (!from || t >= from) && t < to; });
    const W = new Map(); // `${s}:${a}:${i}` -> { s, a, i, w, rec:Set, err:Map(pn->st), tj:Map(rule->Set) }
    const get = (s, w) => { const k = `${s}:${w.ayah}:${w.idx}`; let e = W.get(k); if (!e) W.set(k, (e = { s, a: w.ayah, i: w.idx, w: w.text, rec: new Set(), err: new Map(), tj: new Map() })); return e; };
    subs.forEach((x) => {
      const words = rangeWords(x.surah, x.from, x.to);
      const reached = x.statuses ? x.statuses.length : 0;
      words.forEach((w, j) => { if (j < reached) get(x.surah, w).rec.add(x.pn); });
      (x.mistakes || []).forEach((m) => { const w = words[m.i]; if (w) { const e = get(x.surah, w); e.rec.add(x.pn); e.err.set(x.pn, m.st || 'w'); } });
      (x.tj || []).forEach((m) => { const w = words[m.i]; if (!w) return; const e = get(x.surah, w); e.rec.add(x.pn); const r = m.n || ruleName(m.r); if (!e.tj.has(r)) e.tj.set(r, new Set()); e.tj.get(r).add(x.pn); });
    });
    W.forEach((e) => { e.who = new Set([...e.err.keys(), ...[...e.tj.values()].flatMap((s) => [...s])]); e.rate = e.rec.size ? e.who.size / e.rec.size : 0; });
    return W;
  }
  const lvl = (e) => (!e || !e.who.size ? 0 : e.rate >= 0.4 ? 3 : e.rate >= 0.2 ? 2 : 1);
  function drawErrMap(host) {
    if (!host) return;
    const W = errData();
    const errs = [...W.values()].filter((e) => e.who.size);
    const bySurah = new Map(); errs.forEach((e) => bySurah.set(e.s, (bySurah.get(e.s) || 0) + e.who.size));
    const surahs = [...bySurah.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    if (!surahs.includes(emF.surah)) emF.surah = surahs[0] || null;
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`;
    const top = errs.slice().sort((a, b) => b.who.size - a.who.size || b.rate - a.rate).slice(0, 12);
    const mapHtml = (big = false) => {
      if (!emF.surah) return '';
      const ws = [...W.values()].filter((e) => e.s === emF.surah && e.rec.size);
      const ayahs = [...new Set(ws.map((e) => e.a))].sort((a, b) => a - b);
      let html = '';
      ayahs.forEach((a) => {
        const words = rangeWords(emF.surah, a, a);
        html += words.map((w) => { const e = W.get(`${emF.surah}:${a}:${w.idx}`); const l = lvl(e); return `<span class="em-w em${l}${e?.tj.size ? ' em-tj' : ''}" data-k="${emF.surah}:${a}:${w.idx}"${l ? ` title="${ar(e.who.size)} من ${ar(e.rec.size)}"` : ''}>${esc(w.text)}${l && !big ? `<sup>${ar(e.who.size)}</sup>` : ''}</span>`; }).join(' ') + ` <span class="ayah-end">۝${ar(a)}</span> `;
      });
      return `<div class="quran em-text${big ? ' em-big' : ''}">${html}</div>`;
    };
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">🗺️ خريطة أخطاء الصف على المصحف</h3>${emF.surah ? '<button class="btn sm gold" type="button" id="emShow">📺 اعرضها في الحصة</button>' : ''}</div>
      <div class="row">
        ${emF.range ? '<span class="small muted" style="flex:1 1 140px">حسب الفترة والصف المختارين أعلى الصفحة</span>' : `<select id="emC" style="flex:1 1 140px">${opt('all', 'كل الصفوف', emF.cls)}${D.classes.map((c) => opt(c.id, c.name, emF.cls)).join('')}</select>
        <select id="emP" style="flex:1 1 140px">${opt('all', 'منذ البداية', emF.period)}${opt('30', 'آخر ٣٠ يوماً', emF.period)}${opt('month', 'هذا الشهر', emF.period)}</select>`}
        <select id="emS" style="flex:2 1 180px" ${surahs.length ? '' : 'disabled'}>${surahs.length ? surahs.map((s) => opt(s, `${surahName(s)} (${ar(bySurah.get(s))} خطأ)`, emF.surah)).join('') : '<option>لا أخطاء بعد</option>'}</select>
      </div>
      ${emF.surah ? `<div class="em-legend small"><span><i class="em1"></i>أقل من ٢٠٪ من الطلاب</span><span><i class="em2"></i>٢٠–٤٠٪</span><span><i class="em3"></i>٤٠٪ فأكثر</span><span><i class="em-tjk"></i>خطأ تجويد حدده المعلم</span><span class="muted">الرقم: عدد من أخطأ فيها · اضغط الكلمة للتفاصيل</span></div>
      ${mapHtml()}
      <div><b class="small">أكثر الكلمات خطأً${emF.cls === 'all' ? '' : ' في هذا الصف'}</b><div class="row em-top" style="gap:6px;margin-top:6px">${top.map((e) => `<button type="button" class="word-chip em-chip" data-k="${e.s}:${e.a}:${e.i}"><span class="qw">${esc(e.w)}</span> <small>${esc(surahName(e.s))}:${ar(e.a)} · ${ar(e.who.size)} من ${ar(e.rec.size)}</small></button>`).join('')}</div></div>` : '<div class="empty">لا توجد أخطاء مسجّلة بهذه الاختيارات بعد.</div>'}`;
    if ($('#emC', host)) $('#emC', host).onchange = (e) => { emF.cls = e.target.value; drawErrMap(host); };
    if ($('#emP', host)) $('#emP', host).onchange = (e) => { emF.period = e.target.value; drawErrMap(host); };
    const S = $('#emS', host); if (S) S.onchange = (e) => { emF.surah = +e.target.value; drawErrMap(host); };
    const detail = (k) => {
      const e = W.get(k); if (!e) return;
      const nm = (pn) => esc(D.students.find((x) => x.id === pn)?.name || pn);
      const autoW = [...e.err.entries()];
      openModal(`<div class="stack"><h2><span class="qw" style="font-size:30px">${esc(e.w)}</span> <span class="small muted">${esc(surahName(e.s))} · الآية ${ar(e.a)}</span></h2>
        <p style="margin:0">أخطأ فيها <b>${ar(e.who.size)}</b> من ${ar(e.rec.size)} ${e.rec.size === 1 ? 'طالب سمّعها' : 'طلاب سمّعوها'} (${ar(Math.round(e.rate * 100))}٪).</p>
        ${autoW.length ? `<div><b class="small">في الحفظ (آلياً)</b><div class="row" style="gap:6px;margin-top:4px">${autoW.map(([pn, st]) => `<span class="pill ${st === 'm' ? 'bad' : 'warn'}">${nm(pn)} · ${st === 'm' ? 'حذفها' : 'أخطأ نطقها'}</span>`).join('')}</div></div>` : ''}
        ${e.tj.size ? `<div><b class="small">في التجويد (حددها المعلم)</b>${[...e.tj.entries()].map(([r, set]) => `<div class="row" style="gap:6px;margin-top:4px"><span class="pill">${esc(r)}</span>${[...set].map((pn) => `<span class="pill mute">${nm(pn)}</span>`).join('')}</div>`).join('')}</div>` : ''}
        <div class="row"><button class="btn primary" type="button" data-close>حسناً</button></div></div>`);
    };
    $$('.em-w[data-k]', host).forEach((b) => (b.onclick = () => { if (b.classList.contains('em0')) return; detail(b.dataset.k); }));
    $$('.em-chip', host).forEach((b) => (b.onclick = () => { const s = +b.dataset.k.split(':')[0]; if (s !== emF.surah) { emF.surah = s; drawErrMap(host); } setTimeout(() => { const el = $(`.em-w[data-k="${b.dataset.k}"]`, host); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.classList.add('em-flash'); setTimeout(() => el?.classList.remove('em-flash'), 1600); }, 50); }));
    const sh = $('#emShow', host);
    if (sh) sh.onclick = () => {
      const box = document.createElement('div');
      box.className = 'em-screen';
      box.innerHTML = `<div class="em-sc-head"><h2>سورة ${esc(surahName(emF.surah))}</h2><span>انتبهوا لهذه الكلمات عند التسميع</span><button class="btn" type="button" data-x>إغلاق ✕</button></div>${mapHtml(true)}
        <div class="em-legend em-sc-leg"><span><i class="em1"></i>قليل</span><span><i class="em2"></i>متوسط</span><span><i class="em3"></i>يخطئ فيها كثيرون</span><span><i class="em-tjk"></i>انتبه للتجويد</span></div>`;
      const close = () => { box.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
      box.querySelector('[data-x]').onclick = close;
      document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement) { box.remove(); document.removeEventListener('fullscreenchange', f); } });
      document.body.appendChild(box);
      box.requestFullscreen?.().catch(() => {});
    };
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
  // التسليمات + نقاط التحديات الودّية المحسومة
  const boardSubs = () => {
    const base = D.subs.concat(voiceBonus(), D.himma?.length ? himmaBonus(D.himma) : [], D.challenges?.length ? chBonus(D.challenges) : [], D.khatmas?.length ? khBonus(D.khatmas) : [], D.tourneys?.length ? heroBonus(D.tourneys, D.hMatches || {}) : [], D.iqra ? iqraBonus(D.iqra, D.iqraCfg?.pts ?? IQ_DEFAULT.pts, D.iqraCfg?.dayPts ?? IQ_DEFAULT.dayPts) : []);
    return D.seasons?.length ? base.concat(seasonExtra(base, D.seasons)) : base; // مضاعف نقاط المواسم
  };
  /** نشر اللوحة: لا يؤجّل نشراً أقرب مُجدولاً (حتى لا تتأخر الدرجات بتتابع التحديثات) */
  let boardDue = 0;
  function schedulePublish(ms = 1200) {
    const due = Date.now() + ms;
    if (boardTimer && boardDue && boardDue <= due) return;
    clearTimeout(boardTimer); boardDue = due;
    boardTimer = setTimeout(() => { boardTimer = null; boardDue = 0; publishBoard(); }, ms);
  }
  /** تحديث لحظي: يُعاد رسم اللوحة المعروضة للمعلم في مكانها دون إعادة الصفحة */
  const liveBump = () => { liveBump.n = (liveBump.n || 0) + 1; };
  function refreshHonorInPlace() {
    if (tab !== 'honor' || !lastBoard) return;
    const hb = $('#hbBoard', app), ls = $('#lsT', app);
    if (hb) mountBoard(hb, { ...lastBoard, at: null }, { classes: D.classes, pickClass: true });
    if (ls) { const L = computeLists(D.challenges || [], D.himma || [], D.students); mountLists(ls, L.lists, { classes: D.classes, onExport: (k, st) => exportList(L.lists, k, st) }); }
  }
  async function publishBoard() {
    if (!D.students.length) return;
    // لا ننشر قبل أن تكتمل مصادر النقاط (حتى لا تنزل اللوحة لحظةً ثم تعود)
    if ((D.grants === undefined || D.khatmas === undefined || D.seasons === undefined) && (publishBoard.wait = (publishBoard.wait || 0) + 1) < 20) { schedulePublish(800); return; }
    const all = boardSubs();
    const { board, ranks } = computeBoard(all, D.students, D.classes, new Date(), roundPer());
    // الموسم الجاري: ترتيب كل طالب، وأوائل المرحلة وكل صف للطلاب
    const ss = activeSeason(D.seasons || []);
    if (ss) {
      const [f, to] = seasonRange(ss), res = computeRange(all, D.students, D.classes, f, to);
      Object.entries(res.ranks).forEach(([pn, r]) => { if (ranks[pn]) ranks[pn].season = { id: ss.id, ...r }; });
      const cn = (id) => D.classes.find((c) => c.id === id)?.name || '';
      const live = { stage: res.stage.map((x) => ({ ...x })), byClass: res.byClass };
      const lj = JSON.stringify(live);
      if (lj !== publishBoard.liveJson) { publishBoard.liveJson = lj; store.saveSeason({ id: ss.id, live: { ...live, at: new Date().toISOString() } }).catch(() => {}); }
    }
    // قائمتا «المتحدي الأكبر» و«صاحب الهمة العالية»: أفضل ١٠ للمدرسة ولكل صف، وترتيب كل طالب
    try {
      const L = computeLists(D.challenges || [], D.himma || [], D.students);
      board.lists = L.lists;
      Object.entries(L.ranks).forEach(([pn, r]) => { if (ranks[pn]) ranks[pn].lists = r; });
    } catch (e) { console.warn('lists', e); }
    lastBoard = board;
    const json = JSON.stringify(board);
    if (json === lastBoardJson) return;
    refreshHonorInPlace();
    try {
      await store.setBoard({ ...board, at: new Date().toISOString() });
      await store.saveRanks(ranks, D.students);
      lastBoardJson = json;
    } catch (e) { console.warn('board publish', e); }
  }
  /** تصدير قائمة «المتحدي الأكبر» أو «صاحب الهمة العالية» كاملة (لا أفضل ١٠ فقط) */
  function exportList(lists, kind, st) {
    if (!window.XLSX) return toast('مكتبة Excel لم تُحمّل بعد. أعد المحاولة بعد لحظات.');
    const full = computeLists(D.challenges || [], D.himma || [], D.students);
    const R = full.ranks, rows = [];
    D.students.forEach((s) => { const r = R[s.id]?.[kind]?.[st.p + 's']; if (r) rows.push({ s, r }); });
    rows.sort((a, b) => a.r - b.r);
    const per = st.p === 'm' ? new Date().toISOString().slice(0, 7) : null;
    const chStats = (pn) => full.lists.ch[st.p].all.find((x) => x.pn === pn);
    const data = rows.map(({ s, r }) => {
      const base = { 'الترتيب': r, 'الطالب': s.name, 'الرقم': s.id, 'الصف': className(s.classId) };
      if (kind === 'hm') { const H = (D.himma || []).filter((h) => h.pn === s.id && (!per || (h.d || '').startsWith(per))); return { ...base, 'نقاط الهمة': H.reduce((k, h) => k + (h.hp || 0), 0), 'آيات صحيحة': H.reduce((k, h) => k + (h.ha || 0), 0), 'دقائق': H.reduce((k, h) => k + (h.hm || 0), 0), 'أيام النشاط': H.filter((h) => h.hp > 0).length }; }
      const L = (D.challenges || []).filter((c) => c.pns?.includes(s.id) && (!per || (c.createdAt || '').startsWith(per)));
      const wins = L.filter((c) => chWinner(c) === s.id).length; const x = chStats(s.id);
      return { ...base, 'الانتصارات': wins, 'التحديات': x?.played ?? '', 'نسبة الفوز %': x?.rate ?? '' };
    });
    if (!data.length) return toast('لا أحد في القائمة بعد.');
    const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, kind === 'ch' ? 'المتحدي الأكبر' : 'الهمة العالية');
    XLSX.writeFile(wb, `${kind === 'ch' ? 'المتحدي-الأكبر' : 'الهمة-العالية'}-${per || 'الكل'}.xlsx`);
  }
  function drawHonorT(body) {
    const { board } = computeBoard(boardSubs(), D.students, D.classes, new Date(), roundPer());
    const months = [...new Set(D.subs.map((x) => (x.createdAt || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    const cur = new Date().toISOString().slice(0, 7);
    // الأقسام بترتيب ثابت: شيخ المرحلة، التحدي الأكبر، تحدي الزملاء، صوت الأسبوع، المتجر، ثم البقية، والشهادات أخيراً
    body.innerHTML = `<div class="card stack" style="gap:10px;margin-bottom:16px"><h3>👑 شيخ المرحلة</h3><p class="small muted" style="margin:0">لوحة الشرف كما يراها الطلاب: شيخ المرحلة، وقارئ كل صف، وتحدي الصفوف.</p><div id="hbBoard"></div></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px"><h3>🗡️ التحدي الأكبر</h3><p class="small muted" style="margin:0">قائمتا «المتحدي الأكبر» و«صاحب الهمة العالية».</p><div id="lsT" class="lists-wrap"></div></div>
      <div class="card stack" style="gap:8px;margin-bottom:16px" id="chAdm"></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px" id="voiceT"></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px" id="shopT"></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px" id="revT"></div>
      <div class="card stack hero-adm" style="gap:10px;margin-bottom:16px" id="hrAdm"></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px" id="ssAdm"></div>
      <div class="card stack" style="gap:10px;margin-bottom:16px" id="khAdm"></div>
      <div class="card cr-launch" style="margin-bottom:16px"><div><h3 style="margin:0">📺 وضع عرض الفصل</h3><span class="small muted">لوحة الشرف بحركة احتفالية، وتحدي الصفوف، وآية اليوم، وأبطال الأسبوع على البروجكتر. تتبدل كل ١٥ ثانية، وتتنقل بالأسهم.</span></div>
        <div class="row"><select id="crScope" aria-label="لمن العرض؟"><option value="stage">المرحلة كلها (شيخ المرحلة)</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (قارئ الصف)</option>`).join('')}</select><button class="btn primary" type="button" id="crGo">▶ ابدأ العرض</button></div></div>
      <div class="card stack month-card" style="gap:10px;margin-bottom:16px">
        <div class="row" style="justify-content:space-between"><h3>🎓 الشهادات والنتائج والأرشيف</h3><span class="small muted" id="mStat"></span></div>
        ${CDCFG.v?.start ? `<p class="small" style="margin:0">🏁 أنت على <b>نظام الجولات</b>: تُحسب النتائج عند موعد العداد ${CDCFG.v.auto ? 'وتُعلن تلقائياً' : 'ثم تراجعها وتعلنها'}، ${CDCFG.v.reset === false ? 'وتستمر النقاط في التراكم بعدها' : 'ثم تُصفَّر النقاط وتبدأ جولة جديدة'}. تعدّل ذلك من «⚙️ تعديل موعد العد التنازلي» في لوحة اليوم.</p>` : '<p class="small" style="margin:0">في أول كل شهر راجع نتائج الشهر الماضي ثم أعلنها: يصل لكل طالب إشعار بترتيبه، ويحصل الخمسة الأوائل في كل صف وفي المرحلة على شهادة تقدير.</p>'}
        <p class="small muted" style="margin:0">كل نتيجة معلنة (شهراً كانت أو جولة) تُحفظ مع فائزيها وشهاداتهم في «📚 أرشيف النتائج».</p>
        <div class="row">${months.length ? `<select id="mPick" style="max-width:220px">${months.map((m) => `<option value="${m}">${esc(monthLabel(m))}${m === cur ? ' (الشهر الحالي)' : ''}</option>`).join('')}</select><button class="btn primary" type="button" id="mGo">راجع النتائج</button>` : '<span class="muted small">لا توجد تسليمات بعد.</span>'}<button class="btn" type="button" id="mArch">📚 الأرشيف والشهادات</button><button class="btn gold" type="button" id="mAllC">⬇️ كل الشهادات دفعة واحدة</button></div>
      </div>`;
    drawRevT($('#revT', body)); drawVoiceT($('#voiceT', body)); drawShopT($('#shopT', body));
    drawKhAdmin($('#khAdm', body));
    drawHeroAdmin($('#hrAdm', body));
    drawSeasonAdmin($('#ssAdm', body));
    $('#crGo', body).onclick = () => startClassroom($('#crScope', body).value);
    drawChAdmin($('#chAdm', body));
    { const L = computeLists(D.challenges || [], D.himma || [], D.students);
      mountLists($('#lsT', body), L.lists, { classes: D.classes, onExport: (k, st) => exportList(L.lists, k, st) }); }
    mountBoard($('#hbBoard', body), { ...board, at: null }, { classes: D.classes, pickClass: true });
    $('#mArch', body).onclick = openResultsArchive;
    $('#mAllC', body).onclick = (e) => downloadAllCerts(e.currentTarget);
    const pick = $('#mPick', body);
    if (pick) {
      const stat = () => store.getMonthResult(pick.value).then((r) => { const el = $('#mStat', body); if (el) el.innerHTML = r ? `<span class="pill ok">أُعلنت ${esc(fmtDate(r.announcedAt))}</span>` : '<span class="pill warn">لم تُعلن بعد</span>'; }).catch(() => {});
      pick.onchange = stat; stat();
      $('#mGo', body).onclick = () => openMonthReview(pick.value);
    }
    schedulePublish();
  }

  /* --- المواسم والمسابقات (للمعلم) --- */
  function drawSeasonAdmin(host) {
    const L = (D.seasons || []).slice().sort((a, b) => (b.from || '').localeCompare(a.from || ''));
    const st = { soon: '<span class="pill mute">قادم</span>', live: '<span class="pill ok">جارٍ الآن</span>', ended: '<span class="pill warn">انتهى، بانتظار إعلان النتائج</span>', announced: '<span class="pill">أُعلنت النتائج</span>' };
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">🏆 المواسم والمسابقات</h3><button class="btn sm primary" type="button" id="ssNew">+ موسم جديد</button></div>
      <p class="small muted" style="margin:0">مسابقة لفترة محددة تُحتسب فيها كل النقاط (الواجبات والتحديات والختمات)، مع مضاعف اختياري. للمرحلة كلها مع ترتيب لكل صف. في نهايتها: إعلان النتائج بإشعار، وشهادة للخمسة الأوائل، وشارة دائمة باسمهم.</p>
      ${L.length ? `<ul class="kh-list">${L.map((x) => `<li style="--sc:${esc(x.color)}"><div><b>${esc(x.icon)} ${esc(x.name)}</b><span class="small muted">${fmtDay(x.from)} – ${fmtDay(x.to)}${(x.mult || 1) > 1 ? ` · ×${ar(x.mult)}` : ''} · ${st[seasonStatus(x)]}${seasonStatus(x) === 'live' || seasonStatus(x) === 'soon' ? ` <span>${esc(daysLeftText(x))}</span>` : ''}</span></div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm${seasonStatus(x) === 'ended' ? ' gold' : ''}" type="button" data-ssr="${esc(x.id)}">${seasonStatus(x) === 'ended' ? '📣 النتائج' : 'الترتيب'}</button><button class="btn sm danger" type="button" data-ssd="${esc(x.id)}">حذف</button></div></li>`).join('')}</ul>` : ''}`;
    $('#ssNew', host).onclick = () => newSeason(host);
    $$('[data-ssr]', host).forEach((b) => (b.onclick = () => seasonReview(L.find((x) => x.id === b.dataset.ssr))));
    $$('[data-ssd]', host).forEach((b) => (b.onclick = async () => {
      const x = L.find((y) => y.id === b.dataset.ssd);
      if (!(await confirmBox(`حذف «${x.name}»؟ تبقى الشارات التي مُنحت.`))) return;
      try { await store.deleteSeason(x.id); D.seasons = D.seasons.filter((y) => y.id !== x.id); schedulePublish(); drawSeasonAdmin(host); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
    }));
  }
  function newSeason(host) {
    const t0 = todayStr();
    openModal(`<form class="stack" id="ssF"><h2>🏆 موسم جديد</h2>
      <div class="ss-tpl" role="radiogroup">${Object.entries(TEMPLATES).map(([k, v], i) => `<label style="--sc:${v.color}"><input type="radio" name="ssT" value="${k}" ${i === 0 ? 'checked' : ''}><span>${v.icon} ${k === 'custom' ? 'مخصّص' : v.name}</span></label>`).join('')}</div>
      <div class="row"><label class="field" style="flex:3 1 200px">اسم الموسم<input id="ssN" maxlength="40" required></label><label class="field" style="flex:1 1 80px">الرمز<input id="ssI" maxlength="4"></label><label class="field" style="flex:1 1 80px">اللون<input type="color" id="ssC"></label></div>
      <div class="row"><label class="field" style="flex:1">من<input type="date" id="ssFrom" value="${t0}" required></label><label class="field" style="flex:1">إلى<input type="date" id="ssTo" value="${addDays(t0, 29)}" required></label></div>
      <label class="field">مضاعف النقاط خلال الموسم<select id="ssM"><option value="1">بدون (×١)</option><option value="2" selected>مضاعفة (×٢)</option><option value="3">ثلاثة أضعاف (×٣)</option></select></label>
      <p class="small muted" style="margin:0">المضاعف يرفع نقاط لوحة الشرف لكل ما يُنجز خلال الموسم (واجبات وتحديات وختمات)، فيشجع على المشاركة.</p>
      <div class="row"><button class="btn primary" type="submit">أنشئ الموسم</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      const fill = () => { const v = TEMPLATES[$('input[name=ssT]:checked', m).value]; $('#ssN', m).value = v.name ? `${v.name} ${ar(new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric' }).format(new Date()).replace(/[^\d٠-٩]/g, ''))}` : ''; $('#ssI', m).value = v.icon; $('#ssC', m).value = v.color; };
      $$('input[name=ssT]', m).forEach((r) => (r.onchange = fill)); fill();
      $('#ssF', m).onsubmit = async (e) => {
        e.preventDefault();
        const x = { name: $('#ssN', m).value.trim(), icon: $('#ssI', m).value.trim() || '🏆', color: $('#ssC', m).value, template: $('input[name=ssT]:checked', m).value, from: $('#ssFrom', m).value, to: $('#ssTo', m).value, mult: +$('#ssM', m).value, createdAt: new Date().toISOString(), announcedAt: null };
        if (x.to < x.from) return toast('تاريخ النهاية قبل البداية.');
        if ((D.seasons || []).some((y) => !y.announcedAt && !(x.to < y.from || x.from > y.to))) return toast('يتداخل هذا الموسم مع موسم آخر. اختر فترة مختلفة.');
        try { const id = await store.saveSeason(x); D.seasons = [...(D.seasons || []), { ...x, id }]; closeModal(); schedulePublish(); drawSeasonAdmin(host); toast(`أُنشئ «${x.name}». يظهر للطلاب شريط الموسم أعلى صفحتهم.`); }
        catch (er) { toast('تعذر الإنشاء: ' + (er.code || er.message)); }
      };
    });
  }
  function seasonReview(x) {
    const [f, to] = seasonRange(x), res = computeRange(boardSubs(), D.students, D.classes, f, to);
    const ended = seasonStatus(x) === 'ended', done = !!x.announcedAt;
    const certs = D.students.map((st) => { const w = monthTitle(res.ranks[st.id]); return w && { ym: 'season-' + x.id, name: st.name, title: w.title, line: w.line, rank: w.rank, month: x.name, season: x.name, period: `في ${x.name}`, color: x.color, points: res.ranks[st.id].points, className: className(st.classId), teacher: s.name || '', date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) }; }).filter(Boolean);
    const row = (y, i) => `<li><span class="mr-n">${ar(i + 1)}</span><span>${esc(y.name)}</span><b class="num">${fmt10(y.points)}</b></li>`;
    openModal(`<div class="stack month-review"><h2>${esc(x.icon)} ${esc(x.name)}</h2>
      <p class="small muted" style="margin:0">${fmtDay(x.from)} – ${fmtDay(x.to)}${(x.mult || 1) > 1 ? ` · النقاط مضاعفة ×${ar(x.mult)}` : ''}</p>
      ${!ended && !done ? '<div class="notice">الموسم لم ينتهِ بعد. هذا الترتيب الحالي، وتُعلن النتائج بعد انتهائه.</div>' : ''}
      ${done ? `<div class="pill ok" style="align-self:flex-start">أُعلنت النتائج ${esc(fmtDate(x.announcedAt))}</div>` : ''}
      <div class="mr-grid"><div class="card"><h3>👑 على المرحلة</h3><ol class="mr-list">${res.stage.map(row).join('') || '<li class="muted">لا نقاط</li>'}</ol></div>
        ${D.classes.filter((c) => (res.byClass[c.id] || []).length).map((c) => `<div class="card"><h3>🏆 ${esc(c.name)}</h3><ol class="mr-list">${res.byClass[c.id].map(row).join('')}</ol></div>`).join('')}</div>
      <p class="small muted" style="margin:0">عند الإعلان: يصل لكل طالب إشعار بنتيجته، ويحصل الفائزون (${ar(certs.length)}: الخمسة الأوائل في المرحلة وفي كل صف) على شهادة الموسم وشارة دائمة «${esc(x.icon)} ${esc(x.name)}» بجانب أسمائهم.</p>
      <div class="row"><button class="btn primary" type="button" id="ssGo" ${ended && !done ? '' : 'disabled'}>📣 أعلن النتائج</button><button class="btn gold" type="button" id="ssCerts" ${certs.length ? '' : 'disabled'}>شهادات الفائزين (PDF)</button></div></div>`, (m) => {
      $('#ssCerts', m).onclick = async (e) => { const b = e.currentTarget; b.disabled = true; try { await downloadCertificatesPDF(certs, `season-certificates.pdf`, (i, n) => (b.textContent = `جارٍ التجهيز ${ar(i)} من ${ar(n)}…`)); } catch (er) { toast(er.message); } b.disabled = false; b.textContent = 'شهادات الفائزين (PDF)'; };
      $('#ssGo', m).onclick = () => announceSeason(x, res);
    });
  }
  async function announceSeason(x, res) {
    if (!(await confirmBox(`إعلان نتائج «${x.name}» لكل الطلاب (${ar(D.students.length)})؟`, 'أعلن النتائج'))) return;
    const items = [], badges = {};
    const { ok, fail } = await runBulk('إعلان نتائج الموسم', D.students, async (st) => {
      const r = res.ranks[st.id] || { points: 0 }, w = monthTitle(r);
      const title = w ? `${x.icon} مبارك! ${w.key === 'stage1' ? 'الأول على المرحلة' : w.key === 'cls1' ? 'الأول في صفك' : w.title} في ${x.name}` : `${x.icon} نتائج ${x.name}`;
      const body = w ? `${w.line} بـ${fmt10(r.points)} نقطة. شهادة الموسم وشارتك الدائمة تنتظرانك في المقرأة!` : r.points > 0 ? `ترتيبك ${ar(r.cls)} في صفك بـ${fmt10(r.points)} نقطة. شكراً لمشاركتك، والموسم القادم فرصتك!` : `انتهى ${x.name}. ننتظر مشاركتك في الموسم القادم بإذن الله.`;
      const id = 'season-' + x.id;
      await store.addStudentNotifId(st.id, id, { type: 'season', ym: id, label: x.name, icon: x.icon, color: x.color, title, body, link: './#/student', tag: id, r: { points: r.points, cls: r.cls || null, clsOf: r.clsOf || null, stage: r.stage || null, stageOf: r.stageOf || null }, win: w, teacher: s.name || '', className: className(st.classId) });
      if (w) badges[st.id] = { id: 'season-' + x.id, icon: x.icon, color: x.color, label: x.name, title: w.line, at: new Date().toISOString() };
      items.push({ notif: id, student: st.id });
    });
    try { await store.addBadges(badges); } catch (e) { console.warn('badges', e); }
    await store.saveSeason({ id: x.id, announcedAt: new Date().toISOString(), results: { stage: res.stage, byClass: res.byClass } });
    x.announcedAt = new Date().toISOString();
    let pushed = null;
    try { for (let i = 0; i < items.length; i += 200) { const r = await sendPushBatch(items.slice(i, i + 200)); if (r) pushed = { sent: (pushed?.sent || 0) + r.sent, deferred: (pushed?.deferred || 0) + (r.deferred || 0) }; } } catch (e) { console.warn(e); }
    closeModal();
    toast(`أُعلنت نتائج ${x.name} لـ${nWord(ok, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}، ومُنحت ${nWord(Object.keys(badges).length, 'شارة واحدة', 'شارتان', 'شارات', 'شارة')}${pushed && pushed.sent ? `، ووصل إشعار إلى ${ar(pushed.sent)} جهازاً` : ''}${fail ? `، وتعذر ${ar(fail)}` : ''}.`);
    if (tab === 'honor') drawBody();
  }

  /* --- ختمات الصفوف (للمعلم) --- */
  function drawKhAdmin(host) {
    const L = (D.khatmas || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">📿 ختمات الصفوف</h3><button class="btn sm primary" type="button" id="khNew">+ ختمة جديدة</button></div>
      <p class="small muted" style="margin:0">كل آية يسمّعها أي طالب بدقة ٨٥٪ فأكثر (في الواجب أو التدريب أو التلقين أو التحدي) تُملأ في شريط صفه. عند الاكتمال: احتفال وإشعار للصف، و+${ar(KH_PTS)} نقاط لكل من أسهم، وشهادة جماعية.</p>
      ${L.length ? `<ul class="kh-list">${L.map((k) => { const total = khTotal(k), done = khDone(k), cs = contributors(k); return `<li><div><b>${esc(khLabel(k))}</b><span class="small muted">${esc(className(k.classId))} · ${k.completedAt ? '🎉 اكتملت' : khActive(k) ? esc(daysLeft(k)) || 'جارية' : 'انتهت مدتها'}، والمساهمون ${ar(cs.length)}</span>
        <div class="kh-meter sm"><i style="width:${Math.max(1, (done / total) * 100)}%"></i><span>${ar(done)} من ${ar(total)}</span></div></div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" type="button" data-khv="${esc(k.id)}">التفاصيل</button>${k.completedAt ? `<button class="btn sm gold" type="button" data-khc="${esc(k.id)}">🏅 الشهادة</button>` : ''}<button class="btn sm danger" type="button" data-khd="${esc(k.id)}">حذف</button></div></li>`; }).join('')}</ul>` : ''}`;
    $('#khNew', host).onclick = () => newKhatma(host);
    $$('[data-khv]', host).forEach((b) => (b.onclick = () => openModal(`<div class="stack">${khDetailHtml(L.find((k) => k.id === b.dataset.khv))}<div class="row"><button class="btn primary" type="button" data-close>حسناً</button></div></div>`)));
    $$('[data-khc]', host).forEach((b) => (b.onclick = () => { const k = L.find((x) => x.id === b.dataset.khc); groupCertificate(k, { className: k.classId === 'all' ? '' : className(k.classId), teacher: s.name || '' }); }));
    $$('[data-khd]', host).forEach((b) => (b.onclick = async () => {
      const k = L.find((x) => x.id === b.dataset.khd);
      if (!(await confirmBox(`حذف ختمة «${khLabel(k)}»؟${k.completedAt ? ' تُحذف نقاطها من لوحة الشرف.' : ''}`))) return;
      try { await store.deleteKhatma(k.id); D.khatmas = D.khatmas.filter((x) => x.id !== k.id); schedulePublish(); drawKhAdmin(host); toast('حُذفت الختمة.'); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
    }));
  }
  function newKhatma(host) {
    openModal(`<form class="stack" id="khF"><h2>📿 ختمة جديدة</h2>
      <label class="field">لمن؟<select id="khCls"><option value="all">المرحلة كلها (ختمة مشتركة)</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field">المقطع<select id="khType"><option value="amma">جزء عمّ (٥٦٤ آية)</option><option value="tabarak">جزء تبارك</option><option value="qadsami">جزء قد سمع</option><option value="surah">سورة كاملة</option><option value="range">آيات من سورة</option><option value="multi">من سورة إلى سورة</option></select></label>
      <div id="khSurah" hidden><label class="field">السورة<select id="khS1">${surahOptions(67)}</select></label></div>
      <div id="khRange" hidden class="card">${rangePicker('kr', { surah: 2, from: 1, to: 20 })}</div>
      <div id="khMulti" hidden class="row"><label class="field" style="flex:1">من سورة<select id="khM1">${surahOptions(78)}</select></label><label class="field" style="flex:1">إلى سورة<select id="khM2">${surahOptions(114)}</select></label></div>
      <label class="field">العنوان (اختياري)<input id="khT" maxlength="60" placeholder="مثال: ختمة جزء عمّ في رمضان"></label>
      <label class="field">آخر موعد (اختياري)<input type="date" id="khEnd" min="${riyadhDay()}"></label>
      <div id="khInfo" class="small muted"></div>
      <div class="row"><button class="btn primary" type="submit">أنشئ الختمة</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      let rng = { surah: 2, from: 1, to: 20 };
      bindRangePicker(m, 'kr', (r) => { rng = r; info(); });
      const segs = () => {
        const ty = $('#khType', m).value;
        if (PRESETS[ty]) return PRESETS[ty].segs;
        if (ty === 'surah') return [[+$('#khS1', m).value, 1, null]];
        if (ty === 'range') return [[rng.surah, rng.from, rng.to]];
        const a = +$('#khM1', m).value, b = +$('#khM2', m).value;
        return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => [Math.min(a, b) + i, 1, null]);
      };
      const info = () => { const n = khTotal({ segs: segs() }); $('#khInfo', m).textContent = `عدد الآيات: ${ar(n)}`; };
      const sync = () => { const ty = $('#khType', m).value; $('#khSurah', m).hidden = ty !== 'surah'; $('#khRange', m).hidden = ty !== 'range'; $('#khMulti', m).hidden = ty !== 'multi'; info(); };
      $('#khType', m).onchange = sync; ['#khS1', '#khM1', '#khM2'].forEach((q) => ($(q, m).onchange = info)); sync();
      $('#khF', m).onsubmit = async (e) => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const ty = $('#khType', m).value, sg = segs();
        const k = { classId: $('#khCls', m).value, preset: PRESETS[ty] ? ty : null, segs: sg.map(([a, f, t]) => [a, f, t]), title: $('#khT', m).value.trim(), endAt: $('#khEnd', m).value || null, startAt: new Date().toISOString(), createdAt: new Date().toISOString(), done: {}, completedAt: null };
        k.total = khTotal(k); k.label = khLabel(k);
        if (k.total > 2000) { btn.disabled = false; return toast('المقطع كبير جداً للختمة الواحدة (حتى ٢٠٠٠ آية).'); }
        try { const id = await store.saveKhatma(k); D.khatmas = [...(D.khatmas || []), { ...k, id }]; closeModal(); drawKhAdmin(host); toast(`أُنشئت ختمة «${k.label}» (${ar(k.total)} آية). تظهر للطلاب أعلى صفحتهم.`); }
        catch (x) { toast('تعذر الإنشاء: ' + (x.code || x.message)); btn.disabled = false; }
      };
    });
  }

  /* --- بطولة الأبطال: يديرها جهاز المعلم (حسم المباريات، الأدوار، التتويج) --- */
  let heroOffs = [], heroIv = null, projOff = null, heroBusy = false, heroDrawT = null;
  async function loadHeroesT() {
    try {
      D.tourneys = (await store.listTourneys()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      D.hMatches = D.hMatches || {};
      heroOffs.forEach((f) => f()); heroOffs = [];
      for (const x of D.tourneys) {
        if (x.status === 'running') heroOffs.push(store.watchMatches(x.id, (ms) => { D.hMatches[x.id] = ms; schedulePublish(); heroTick(x); heroRedraw(); }));
        else D.hMatches[x.id] = await store.listMatches(x.id).catch(() => []);
      }
      clearInterval(heroIv); heroIv = setInterval(() => (D.tourneys || []).filter((x) => x.status === 'running').forEach(heroTick), 60e3);
      schedulePublish(); heroRedraw();
    } catch (e) { console.warn('tourneys', e); }
  }
  const heroRedraw = () => { clearTimeout(heroDrawT); heroDrawT = setTimeout(() => { const h = document.getElementById('hrAdm'); if (h && tab === 'honor') drawHeroAdmin(h); heroModal?.(); }, 300); };
  let heroModal = null;
  async function heroTick(x) {
    if (heroBusy || x.status !== 'running' || !D.hMatches?.[x.id]) return;
    heroBusy = true;
    try {
      const ms = D.hMatches[x.id].map((m) => ({ ...m }));
      const r = heroAdvance(x, ms, new Date());
      for (const u of r.updates) await store.updateMatch(x.id, u.id, u.patch);
      if (r.creates.length) await store.saveMatches(x.id, r.creates);
      if (r.tour) { Object.assign(x, r.tour); await store.saveTourney({ id: x.id, ...r.tour }); }
      await heroNotify(x, r);
    } catch (e) { console.warn('hero tick', e); }
    heroBusy = false;
  }
  async function heroNotify(x, r) {
    const items = [], push = async (pn, n) => { try { items.push({ notif: await store.addStudentNotif(pn, { type: 'hero', link: `./#/student/hero/${n.mid || ''}`, tag: 'hero-' + (n.mid || x.id), ...n }), student: pn }); } catch (e) { console.warn(e); } };
    for (const m of r.creates.filter((y) => !y.bye)) {
      for (const [me1, op] of [[m.a, m.b], [m.b, m.a]]) {
        await push(me1.pn, m.live
          ? (m.third ? { mid: m.id, title: `🥉 ${x.name}: مباراة المركز الثالث`, body: `تنافس ${op.name} مباشرة على المركز الثالث في ${hRange(m)}. سيحدد المعلم موعدها ويصلك إشعار.` }
            : { mid: m.id, title: `🔥 تأهلت إلى ${m.kind ? kindLabel(m) : r.creates.filter((y) => !y.bye).length === 1 ? 'النهائي' : 'نصف النهائي'} في ${x.name}!`, body: `مباراتك المباشرة ضد ${op.name} في ${hRange(m)}. سيحدد المعلم موعدها ويصلك إشعار.` })
          : { mid: m.id, title: `⚔️ ${x.name}: الدور ${ar(m.round)}`, body: `مباراتك ضد ${op.name} في ${hRange(m)}. سلّم تلاوتك خلال ${ar(x.hours || 48)} ساعة.` });
      }
    }
    for (const m of r.creates.filter((y) => y.bye && !y.wait)) await push(m.a.pn, { title: `🍀 ${x.name}: تأهلت بالقرعة`, body: `عدد المتسابقين فردي، فتأهلت مباشرة إلى الدور ${ar(m.round + 1)}. استعد!` });
    for (const ev of r.events) {
      if (ev.type === 'ext') for (const p of [ev.m.a, ev.m.b]) await push(p.pn, { mid: ev.m.id, title: `⏳ ${x.name}: تمديد ٢٤ ساعة`, body: `لم يسلّم أي منكما. هذه فرصة أخيرة، وبعدها تُحسم المباراة بالقرعة.` });
      if (ev.type === 'classChamp') await push(ev.who.pn, { title: `🏅 أنت بطل صفك في ${x.name}!`, body: `مبارك! +${ar(HPTS.classChamp)} نقاط في لوحة الشرف، وتنتقل إلى مرحلة النخبة بين الصفوف.` });
    }
    const champ = r.events.find((e) => e.type === 'champ');
    if (champ) {
      const now = new Date().toISOString(), badges = { [champ.who.pn]: { id: 'hero-' + x.id, icon: '🏆', color: '#a77a1c', label: `بطل ${x.name}`, title: 'بطل الأبطال', at: now } };
      if (champ.runnerUp) badges[champ.runnerUp.pn] = { id: 'hero2-' + x.id, icon: '🥈', color: '#6b7a86', label: `وصيف ${x.name}`, title: 'الوصيف', at: now };
      if (champ.third && !badges[champ.third.pn]) badges[champ.third.pn] = { id: 'hero3-' + x.id, icon: '🥉', color: '#a0612b', label: `المركز الثالث في ${x.name}`, title: 'المركز الثالث', at: now };
      Object.values(x.classChamps || {}).forEach((c) => { if (!badges[c.pn]) badges[c.pn] = { id: 'heroc-' + x.id, icon: '🏅', color: '#0d5c46', label: `بطل صفه في ${x.name}`, title: 'بطل الصف', at: now }; });
      try { await store.addBadges(badges); } catch (e) { console.warn('badges', e); }
      try { const id = await store.addNotif({ type: 'hero', title: `🏆 ${champ.who.name} بطل ${x.name}!`, body: `مبارك للبطل${champ.runnerUp ? ` وللوصيف ${champ.runnerUp.name}` : ''}${champ.third ? ` ولصاحب المركز الثالث ${champ.third.name}` : ''}، وشكراً لكل من شارك. شاهد الشجرة كاملة في تبويب الأبطال.`, link: './#/student', tag: 'hero-' + x.id, classId: 'all' }); await sendPush(id); } catch (e) { console.warn(e); }
      confetti(); toast(`🏆 انتهت البطولة: ${champ.who.name} بطل ${x.name}!`);
    }
    if (items.length) { try { for (let i = 0; i < items.length; i += 200) await sendPushBatch(items.slice(i, i + 200)); } catch (e) { console.warn(e); } }
  }
  function heroCerts(x) {
    const date = ar(new Date(x.doneAt || Date.now()).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }));
    const mk = (p, title, line, rank) => ({ ym: 'hero-' + x.id, name: p.name, title, line, rank, month: x.name, season: x.name, period: `في ${x.name}`, color: '#a77a1c', points: 0, className: className(p.classId), teacher: s.name || '', date });
    const L = [];
    if (x.champion) L.push(mk(x.champion, 'بطل الأبطال', `بطل مسابقة ${x.name} على المرحلة`, 1));
    if (x.runnerUp) L.push(mk(x.runnerUp, 'وصيف البطل', `وصيف مسابقة ${x.name}`, 2));
    if (x.third) L.push(mk(x.third, 'المركز الثالث', `صاحب المركز الثالث في مسابقة ${x.name}`, 3));
    Object.values(x.classChamps || {}).filter((c) => c.pn !== x.champion?.pn && c.pn !== x.runnerUp?.pn && c.pn !== x.third?.pn).forEach((c) => L.push(mk(c, `بطل ${className(c.classId)}`, `بطل ${className(c.classId)} في ${x.name}`, 3)));
    return L;
  }
  function drawHeroAdmin(host) {
    const L = D.tourneys || [];
    const run = L.find((x) => x.status === 'running');
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">🏆 الأبطال (خروج المغلوب)</h3><span class="row" style="gap:4px"><button class="btn sm" type="button" id="hrCheer">🎉 عبارات التشجيع</button>${run ? '' : '<button class="btn sm primary" type="button" id="hrNew">+ بطولة جديدة</button>'}</span></div>
      <p class="small muted" style="margin:0">يتنافس كل طالبين من الصف نفسه، والفائز يستمر حتى يبقى بطل لكل صف، ثم قرعة بين أبطال الصفوف حتى بطل الأبطال. التقييم آلي بدقة الكلمات فقط ولا يتدخل المعلم. يختار البرنامج لكل متنافسَين مقطعاً من السور التي تحددها بعدد الآيات الذي تحدده لكل دور. النصف والنهائي ومباراة المركز الثالث مباشرة (${ar(LIVE_MIN)} دقائق) بمقطع مفاجئ وتحليل تجويد آلي إلزامي.</p>
      ${L.length ? `<ul class="kh-list">${L.slice(0, 6).map((x) => { const ms = D.hMatches?.[x.id] || [], need = ms.filter((m) => m.live && !m.done && !m.startAt).length;
        return `<li><div><b>${esc(x.name)}</b><span class="small muted">${esc(stageLabel(x, ms))}${x.champion ? ` · البطل: ${esc(x.champion.name)}` : ''}</span>${need ? `<span class="pill warn">📅 ${need === 1 ? 'مباراة مباشرة تنتظر موعداً' : `${ar(need)} مباريات مباشرة تنتظر مواعيدها`}</span>` : ''}</div>
        <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm${need ? ' gold' : ''}" type="button" data-hrv="${esc(x.id)}">إدارة</button>${x.status === 'done' ? `<button class="btn sm gold" type="button" data-hrc="${esc(x.id)}">🏅 الشهادات</button>` : ''}<button class="btn sm danger" type="button" data-hrd="${esc(x.id)}">حذف</button></div></li>`; }).join('')}</ul>` : ''}`;
    $('#hrNew', host) && ($('#hrNew', host).onclick = newTourney);
    $('#hrCheer', host).onclick = editCheers;
    $$('[data-hrv]', host).forEach((b) => (b.onclick = () => manageTourney(b.dataset.hrv)));
    $$('[data-hrc]', host).forEach((b) => (b.onclick = async () => { const x = L.find((y) => y.id === b.dataset.hrc); b.disabled = true; try { await downloadCertificatesPDF(heroCerts(x), 'heroes-certificates.pdf', (i, n) => (b.textContent = `${ar(i)}/${ar(n)}…`)); } catch (e) { toast(e.message); } b.disabled = false; b.textContent = '🏅 الشهادات'; }));
    $$('[data-hrd]', host).forEach((b) => (b.onclick = async () => {
      const x = L.find((y) => y.id === b.dataset.hrd);
      if (!(await confirmBox(`حذف بطولة «${x.name}» بكل مبارياتها؟ تُحذف نقاطها من لوحة الشرف.`))) return;
      try { await store.deleteTourney(x.id); D.tourneys = D.tourneys.filter((y) => y.id !== x.id); delete D.hMatches[x.id]; await loadHeroesT(); toast('حُذفت البطولة.'); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
    }));
  }
  const HERO_SURAHS = [87, 88, 89, 90, 91, 92, 93, 94, 95, 96];
  function newTourney() {
    const cls = D.classes.filter((c) => D.students.some((x) => x.classId === c.id));
    const rounds = (ids) => { const mx = Math.max(1, ...ids.map((c) => D.students.filter((x) => x.classId === c).length)); return Math.max(1, Math.ceil(Math.log2(mx)) + Math.ceil(Math.log2(Math.max(1, ids.length)))); };
    openModal(`<form class="stack" id="hrF"><h2>🏆 بطولة الأبطال</h2>
      <label class="field">اسم البطولة<input id="hrName" maxlength="50" required value="الأبطال"></label>
      <div class="field">الصفوف المشاركة (يشترك كل طلابها)<div class="row" style="gap:6px;flex-wrap:wrap">${cls.map((c) => `<label class="chip-ck"><input type="checkbox" value="${esc(c.id)}" checked> ${esc(c.name)} <small class="muted">(${ar(D.students.filter((x) => x.classId === c.id).length)})</small></label>`).join('')}</div></div>
      <label class="field">مهلة كل دور قبل النصف النهائي<select id="hrH"><option value="24">٢٤ ساعة</option><option value="48" selected>٤٨ ساعة</option><option value="72">٧٢ ساعة</option></select></label>
      <div class="field">سور البطولة <span class="small muted">(يختار البرنامج منها مقطعاً لكل متنافسَين)</span>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-pr="78-114">جزء عمّ</button><button class="btn sm" type="button" data-pr="67-77">جزء تبارك</button><button class="btn sm" type="button" data-pr="58-66">جزء قد سمع</button><button class="btn sm ghost" type="button" data-pr="none">مسح</button></div>
        <div id="hrPool" class="hr-pool">${getSurahs().map((x, i) => `<label class="chip-ck"><input type="checkbox" value="${i + 1}"${HERO_SURAHS.includes(i + 1) ? ' checked' : ''}> ${ar(i + 1)}. ${esc(x.name)} <small class="muted">(${ar(x.ayahs)})</small></label>`).join('')}</div></div>
      <div class="field">عدد الآيات <span class="small muted">(مقطع متتالٍ من موضع عشوائي، والسورة الأقصر من العدد تُعطى كاملة. التعادل يُعاد بمقطع جديد بالطول نفسه)</span><div id="hrRounds" class="stack" style="gap:6px"></div></div>
      <label class="field">نوع المنافسة<select id="hrMode"><option value="hifz">🙈 تسميع غيباً</option><option value="recite">📖 تلاوة نظراً (النص ظاهر)</option></select></label>
      <div class="small muted" id="hrInfo"></div>
      <div class="row"><button class="btn primary" type="submit">ابدأ البطولة والقرعة</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      const sel = () => $$('#hrF .field > .row input[type=checkbox]', m).filter((i) => i.checked).map((i) => i.value);
      const paintR = () => {
        const n = rounds(sel()), reg = Math.max(1, n - 2), host = $('#hrRounds', m);
        const old = {}; $$('input[data-n]', host).forEach((x) => (old[x.dataset.n] = x.value));
        const row = (k, label, def) => `<label class="row" style="gap:8px"><span style="min-width:120px" class="small">${label}</span><input type="number" data-n="${k}" min="1" max="60" inputmode="numeric" value="${old[k] || def}" style="width:90px"><span class="small muted">آية</span></label>`;
        host.innerHTML = Array.from({ length: reg }, (_, i) => row('r' + i, `الدور ${ar(i + 1)}`, Math.min(10, 5 + 2 * i))).join('')
          + `<div class="small muted" style="margin-top:4px">المباريات المباشرة (مقطع مفاجئ يُكشف لحظة البدء):</div>` + row('semi', '⚡ نصف النهائي', 10) + row('third', '🥉 المركز الثالث', 10) + row('final', '🏆 النهائي', 12);
        paintInfo();
      };
      const pool = () => $$('#hrPool input', m).filter((i) => i.checked).map((i) => +i.value);
      const paintInfo = () => {
        const n = rounds(sel()), P = pool(), A = P.reduce((k, x) => k + ayahCount(x), 0);
        const N = sel().reduce((k, c) => k + D.students.filter((x) => x.classId === c).length, 0);
        $('#hrInfo', m).textContent = `${ar(N)} متسابقاً في ${ar(sel().length)} ${sel().length === 1 ? 'صف' : 'صفوف'}، ونحو ${ar(n)} ${n <= 2 ? 'دور' : 'أدوار'}. السور المختارة: ${ar(P.length)} (${ar(A)} آية).`;
      };
      $$('#hrF .field > .row input[type=checkbox]', m).forEach((i) => (i.onchange = paintR));
      $$('#hrPool input', m).forEach((i) => (i.onchange = paintInfo));
      const toFirst = () => { const box = $('#hrPool', m), c = $('#hrPool input:checked', m)?.closest('label'); if (box && c) box.scrollTop = c.offsetTop - box.offsetTop - 6; };
      $$('[data-pr]', m).forEach((b) => (b.onclick = () => { const [a, z] = b.dataset.pr.split('-').map(Number); $$('#hrPool input', m).forEach((i) => (i.checked = b.dataset.pr !== 'none' && +i.value >= a && +i.value <= z)); paintInfo(); toFirst(); }));
      paintR(); requestAnimationFrame(toFirst);
      $('#hrF', m).onsubmit = async (e) => {
        e.preventDefault(); const btn = e.submitter, ids = sel();
        const studs = D.students.filter((x) => ids.includes(x.classId));
        if (studs.length < 2) return toast('يلزم طالبان على الأقل.');
        const P = pool(); if (!P.length) return toast('اختر سورة واحدة على الأقل للبطولة.');
        const num = (k) => Math.max(1, Math.min(60, Math.round(+$(`input[data-n="${k}"]`, m)?.value || 0) || 1));
        btn.disabled = true;
        const x = { mode: $('#hrMode', m).value === 'recite' ? 'recite' : 'hifz', name: $('#hrName', m).value.trim() || 'الأبطال', status: 'running', stage: 'class', classIds: ids, hours: +$('#hrH', m).value, pool: P, counts: $$('#hrRounds input[data-n^="r"]', m).map((i) => num(i.dataset.n)), semiN: num('semi'), thirdN: num('third'), finalN: num('final'), classChamps: {}, createdAt: new Date().toISOString() };
        try {
          x.id = await store.saveTourney(x);
          const ms = firstRound(x, studs, new Date());
          await store.saveMatches(x.id, ms);
          D.tourneys = [x, ...(D.tourneys || [])]; D.hMatches[x.id] = ms;
          closeModal();
          await heroNotify(x, { creates: ms, events: [] });
          try { const id = await store.addNotif({ type: 'hero', title: `🏆 انطلقت بطولة ${x.name}!`, body: 'جرت القرعة. ادخل تبويب «الأبطال» لترى خصمك في الدور الأول.', link: './#/student', tag: 'hero-' + x.id, classId: ids.length === D.classes.length ? 'all' : ids[0] }); await sendPush(id); } catch {}
          await loadHeroesT();
          toast(`انطلقت «${x.name}» بـ${ar(ms.filter((y) => !y.bye).length)} مباراة في الدور الأول.`);
          manageTourney(x.id);
        } catch (er) { toast('تعذر الإنشاء: ' + (er.code || er.message)); btn.disabled = false; }
      };
    });
  }
  function manageTourney(tid) {
    let view = null;
    const paint = (m) => {
      const x = (D.tourneys || []).find((y) => y.id === tid); if (!x) return;
      const ms = D.hMatches?.[tid] || [];
      view = view || (ms.some((y) => y.stage === 'inter') ? 'inter' : x.classIds[0]);
      const need = ms.filter((y) => y.live && !y.done);
      $('#hmgBody', m).innerHTML = `<p class="small muted" style="margin:0">${esc(stageLabel(x, ms))}${x.champion ? ` · 🏆 ${esc(x.champion.name)}` : ''}</p>
        ${need.length ? `<div class="card stack" style="gap:8px"><b>📺 المباريات المباشرة</b>${need.map((y) => `<div class="row" style="justify-content:space-between;gap:6px"><span>${esc(y.a.name)} ⚔️ ${esc(y.b.name)} <small class="muted">${y.third ? '🥉 ' : y.kind === 'final' ? '🏆 ' : ''}${esc(kindLabel(y))} · ${esc(hRange(y, { reveal: true }))}${y.surprise ? ' 🔒' : ''}</small></span>
          <span class="row" style="gap:4px"><input type="datetime-local" data-dt="${esc(y.id)}" value="${y.startAt ? toLocalInput(y.startAt) : ''}"><button class="btn sm primary" type="button" data-sch="${esc(y.id)}">${y.startAt ? 'غيّر الموعد' : 'حدد الموعد'}</button>${y.startAt ? `<button class="btn sm gold" type="button" data-proj="${esc(y.id)}">📺 اعرض</button>` : ''}</span></div>`).join('')}</div>` : ''}
        <div class="hero-tabs">${x.classIds.map((c) => `<button type="button" class="chip${view === c ? ' on' : ''}" data-v="${esc(c)}">${esc(className(c))}</button>`).join('')}<button type="button" class="chip${view === 'inter' ? ' on' : ''}" data-v="inter">🌍 النخبة</button></div>
        ${bracketHtml(ms, { stage: view === 'inter' ? 'inter' : 'class', classId: view, me: null })}`;
      $$('[data-v]', m).forEach((b) => (b.onclick = () => { view = b.dataset.v; paint(m); }));
      $$('[data-proj]', m).forEach((b) => (b.onclick = () => heroProjector(tid, b.dataset.proj)));
      $$('[data-sch]', m).forEach((b) => (b.onclick = async () => {
        const v = $(`[data-dt="${b.dataset.sch}"]`, m).value; if (!v) return toast('اختر الموعد أولاً.');
        const at = new Date(v); if (at < Date.now() - 60e3) return toast('الموعد في الماضي.');
        const y = ms.find((z) => z.id === b.dataset.sch); b.disabled = true;
        try {
          await store.updateMatch(tid, y.id, { startAt: at.toISOString() });
          const when = ar(at.toLocaleString('ar', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }));
          const items = [];
          for (const [p, o] of [[y.a, y.b], [y.b, y.a]]) items.push({ notif: await store.addStudentNotif(p.pn, { type: 'hero', title: `📺 موعد مباراتك ضد ${o.name}`, body: `${when}. افتح المقرأة قبل الموعد بدقائق، ولديك ${ar(LIVE_MIN)} دقائق للتسليم في ${hRange(y)}.`, link: `./#/student/hero/${y.id}`, tag: 'hero-' + y.id }), student: p.pn });
          await sendPushBatch(items).catch(() => {});
          const id = await store.addNotif({ type: 'hero', title: `📺 مباراة مباشرة: ${y.a.name} ⚔️ ${y.b.name}`, body: `${when}. تابعوا السباق مباشرة من تبويب «الأبطال».`, link: './#/student', tag: 'hero-live-' + y.id, classId: 'all' }); await sendPush(id).catch(() => {});
          toast('حُدد الموعد وأُبلغ المتسابقان والجميع.');
        } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); b.disabled = false; }
      }));
    };
    openModal(`<div class="stack hero-mg"><h2 style="margin:0">🏆 ${esc((D.tourneys || []).find((y) => y.id === tid)?.name || '')}</h2><div id="hmgBody"></div><div class="row"><button class="btn gold" type="button" id="hmgProj">📺 اعرض على البروجكتر</button><button class="btn" type="button" data-close>إغلاق</button></div></div>`, (m) => {
      heroModal = () => { if (document.body.contains(m) && !m.contains(document.activeElement?.closest?.('input') || null)) paint(m); else if (!document.body.contains(m)) heroModal = null; };
      $('#hmgProj', m).onclick = () => heroProjector(tid, null);
      paint(m);
    });
  }
  /** شاشة البروجكتر: الشجرة، أو السباق المباشر لمباراة */
  /** الإيموجي والعبارات الجاهزة التي يرسلها الطلاب تشجيعاً في المباريات المباشرة */
  async function editCheers() {
    const c = await cheerCfg(true);
    openModal(`<form id="cfF" class="stack" style="gap:12px">
      <h2>🎉 عبارات تشجيع المباريات المباشرة</h2>
      <p class="small muted" style="margin:0">يختار منها كل طلاب المدرسة ما يرسلونه للمتنافسَين في نصف النهائي والمركز الثالث والنهائي. يراها الجمهور وشاشة العرض، ويراها المتنافس قبل بدء مباراته فقط. لا يكتب الطلاب نصاً حراً.</p>
      <label class="field">الإيموجي (حتى ${ar(CHEER_MAX)})<input id="cfE" value="${esc(c.emojis.join(' '))}" placeholder="👏 🔥 💪 🤲 ⭐" style="font-size:1.4rem;letter-spacing:4px"></label>
      <label class="field">العبارات: عبارة في كل سطر (حتى ${ar(CHEER_MAX)}، وكل عبارة حتى ${ar(PHRASE_MAX)} حرفاً)<textarea id="cfP" rows="6">${esc(c.phrases.join('\n'))}</textarea></label>
      <div id="cfPrev" class="cheer-send"></div>
      <div class="row"><button class="btn primary" type="submit">حفظ</button><button class="btn" type="button" id="cfDef">الافتراضي</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      const read = () => cleanCfg({ emojis: splitEmojis($('#cfE', m).value), phrases: $('#cfP', m).value.split('\n') });
      const prev = () => { const x = read(); $('#cfPrev', m).innerHTML = `<div class="small muted">هكذا تظهر للطلاب:</div><div class="cheer-em">${x.emojis.map((e) => `<span class="cheer-e">${esc(e)}</span>`).join('')}</div><div class="cheer-ph">${x.phrases.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div>`; };
      $('#cfE', m).oninput = prev; $('#cfP', m).oninput = prev; prev();
      $('#cfDef', m).onclick = () => { const d = cleanCfg(null); $('#cfE', m).value = d.emojis.join(' '); $('#cfP', m).value = d.phrases.join('\n'); prev(); };
      $('#cfF', m).onsubmit = async (e) => {
        e.preventDefault();
        const x = read();
        if (splitEmojis($('#cfE', m).value).length > CHEER_MAX || $('#cfP', m).value.split('\n').filter((l) => l.trim()).length > CHEER_MAX) toast(`حُفظ أول ${ar(CHEER_MAX)} فقط.`);
        try { await store.setCheerCfg({ emojis: x.emojis, phrases: x.phrases }); setCfgCache(x); closeModal(); toast('حُفظت عبارات التشجيع، وتظهر للطلاب في المباريات المباشرة.'); }
        catch (err) { toast('تعذر الحفظ: ' + (err.code || err.message)); }
      };
    });
  }

  function heroProjector(tid, mid) {
    closeModal(); projOff?.();
    const x = D.tourneys.find((y) => y.id === tid);
    const el = document.createElement('div'); el.className = 'hero-proj'; document.body.appendChild(el);
    const pb = document.createElement('div'), ch = document.createElement('div'); ch.className = 'hp-cheer'; el.append(pb, ch);
    let live = {}, offL = null, view = null, chOff = null, chMid = null;
    const pickLive = () => mid || (D.hMatches[tid] || []).find((y) => y.live && !y.done && y.startAt && new Date(y.startAt) - Date.now() < 15 * 60e3)?.id || null;
    const paint = () => {
      const ms = D.hMatches[tid] || [], cur = pickLive(), m = cur && ms.find((y) => y.id === cur);
      if (m && !offL) { offL = () => {}; offL = store.watchLive(tid, m.id, (d) => { live = d || {}; if (offL) setTimeout(paint, 0); }); }
      view = view || (ms.some((y) => y.stage === 'inter') ? 'inter' : x.classIds[0]);
      const lane = (p, r, side) => { const L = live[side] || {}, pct = r ? 100 : L.total ? Math.round((L.done / L.total) * 100) : 0;
        return `<div class="race-lane big${m.done && m.winner === p.pn ? ' win' : ''}"><div class="rl-name">${esc(p.name)} <small>${esc(className(p.classId))}</small> ${L.on && !r ? '<span class="rl-on">🎙️</span>' : ''}</div><div class="rl-track"><i style="width:${pct}%"></i><span>${r?.pend ? '⏳' : r ? `${ar(r.s)}٪` : L.total ? `${ar(pct)}٪ · دقة ${ar(Math.round((L.ok / Math.max(1, L.done)) * 100))}٪` : 'ينتظر…'}</span></div></div>`; };
      const left = m?.startAt ? Math.max(0, Math.round((new Date(m.startAt).getTime() + LIVE_MIN * 60e3 - Date.now()) / 1000)) : 0;
      pb.innerHTML = `<button class="hp-x" type="button" aria-label="إغلاق">✕</button><h1>🏆 ${esc(x.name)}</h1><div class="hp-st">${esc(stageLabel(x, ms))}</div>
        ${x.champion ? `<div class="hero-champ big"><div class="hc-cup">🏆</div><div><span>بطل الأبطال</span><b>${esc(x.champion.name)}</b><span>${esc(className(x.champion.classId))}</span></div></div>` : ''}
        ${m ? `<div class="hp-race"><div class="hp-rh">${esc(hRange(m))} ${new Date(m.startAt) > Date.now() ? `· تبدأ ${ar(new Date(m.startAt).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' }))}` : m.done ? '' : `· ⏱ ${ar(Math.floor(left / 60))}:${ar(String(left % 60).padStart(2, '0'))}`}</div>${lane(m.a, m.ra, 'a')}${lane(m.b, m.rb, 'b')}${m.done ? `<div class="hero-res big">🏆 ${esc(m.winner === m.a.pn ? m.a.name : m.b.name)}</div>` : ''}</div>` : bracketHtml(ms, { stage: view === 'inter' ? 'inter' : 'class', classId: view, me: null })}
        ${!m ? `<div class="hero-tabs">${x.classIds.map((c) => `<button type="button" class="chip${view === c ? ' on' : ''}" data-v="${esc(c)}">${esc(className(c))}</button>`).join('')}<button type="button" class="chip${view === 'inter' ? ' on' : ''}" data-v="inter">🌍 النخبة</button></div>` : ''}`;
      $('.hp-x', el).onclick = () => projOff();
      $$('[data-v]', el).forEach((b) => (b.onclick = () => { view = b.dataset.v; paint(); }));
      if (m?.done && !paint.party) { paint.party = true; confetti(); }
      // تشجيع الجمهور على شاشة العرض طوال المباراة المباشرة
      const cheerM = m && m.live && !m.done && m.b ? m : null;
      if (cheerM && chMid !== cheerM.id) { chOff?.(); chOff = mountCheer(ch, { tid, m: cheerM, big: true, title: false }); chMid = cheerM.id; }
      else if (!cheerM && chOff) { chOff(); chOff = null; chMid = null; }
    };
    const iv = setInterval(paint, 1000);
    const key = (e) => { if (e.key === 'Escape') projOff(); };
    document.addEventListener('keydown', key);
    projOff = () => { clearInterval(iv); offL?.(); chOff?.(); el.remove(); document.removeEventListener('keydown', key); projOff = null; };
    try { el.requestFullscreen?.().catch(() => {}); } catch {}
    paint();
  }

  /* --- وضع عرض الفصل --- */
  function startClassroom(scope) {
    const { board } = computeBoard(boardSubs(), D.students, D.classes, new Date(), roundPer());
    const m = board.month, isStage = scope === 'stage';
    const cls = D.classes.find((c) => c.id === scope);
    const inScope = (pn) => { const s = D.students.find((x) => x.id === pn); return s && (isStage || s.classId === scope); };
    const since = Date.now() - 7 * 864e5, yday = addDays(riyadhDay(), -1);
    const best = (map) => { let b = null; map.forEach((v, pn) => { if (v > 0 && inScope(pn) && (!b || v > b.v)) b = { pn, v }; }); return b && { name: D.students.find((x) => x.id === b.pn)?.name || '', v: b.v }; };
    const streaks = new Map(D.students.filter((s) => s.streak?.days && s.streak.on >= yday).map((s) => [s.id, s.streak.days]));
    const subs = new Map(); D.subs.filter((x) => new Date(x.createdAt).getTime() >= since).forEach((x) => subs.set(x.pn, (subs.get(x.pn) || 0) + 1));
    const wins = new Map(); (D.challenges || []).forEach((c) => { const w = chWinner(c); const at = [c.ra?.at, c.rb?.at].filter(Boolean).sort().pop(); if (w && w !== 'tie' && at && new Date(at).getTime() >= since) wins.set(w, (wins.get(w) || 0) + 1); });
    openClassroom({
      scopeName: isStage ? 'المرحلة كلها' : cls?.name || '', monthLabel: ar(m.label || ''),
      podiumTitle: isStage ? '👑 شيخ المرحلة' : '🏆 قارئ الصف',
      top: isStage ? m.stage : (m.byClass?.[scope] || []),
      classes: m.classes || [], focusClass: isStage ? null : scope,
      heroes: { streak: best(streaks), subs: best(subs), wins: best(wins) },
      khatma: (() => { const k = (D.khatmas || []).filter((x) => (khActive(x) || (x.completedAt && Date.now() - new Date(x.completedAt) < 7 * 864e5)) && (x.classId === 'all' || x.classId === scope)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
        return k && { label: khLabel(k), done: khDone(k), total: khTotal(k), left: daysLeft(k), complete: !!k.completedAt, top: contributors(k).slice(0, 5) }; })(),
    });
  }

  /* --- إدارة التحديات الودّية --- */
  const chResult = (c) => { const w = chWinner(c), st = chStatus(c); return st === 'review' ? '⏳ بانتظار تقييمك' : st === 'open' ? (isStrict(c) && !c.acceptedAt ? 'بانتظار القبول' : 'جارٍ') : st === 'declined' ? 'اعتذار' : st === 'cancelled' ? `أُلغي من ${c.cancel.by === c.a.pn ? c.a.name : c.b.name}${c.cancel.free ? ' (مجاناً)' : ` (−${CH_PTS.cancel})`}${w ? ` · 🏆 ${w === c.a.pn ? c.a.name : c.b.name}` : ''}` : w === 'tie' ? 'تعادل' : w ? '🏆 ' + (w === c.a.pn ? c.a.name : c.b.name) : 'انتهى الوقت'; };
  /* تسجيلات لم يتعرف الجهاز على كلامها في التحديات والمباريات: يسمعها المعلم ويضع النتيجة */
  function pendingReviews() {
    const L = [];
    const rng = (x) => `«سورة ${surahName(x.surah)}» ${x.from === x.to ? `الآية ${ar(x.from)}` : `${ar(x.from)}–${ar(x.to)}`}`;
    (D.challenges || []).filter((c) => !c.cancel && !c.declined).forEach((c) => ['ra', 'rb'].forEach((k) => { if (c[k]?.pend) L.push({ kind: 'ch', id: c.id, k, who: k === 'ra' ? c.a : c.b, vs: k === 'ra' ? c.b : c.a, r: c[k], range: rng(c), c }); }));
    (D.tourneys || []).filter((t) => t.status === 'running').forEach((t) => (D.hMatches?.[t.id] || []).filter((m) => !m.done).forEach((m) => ['ra', 'rb'].forEach((k) => { if (m[k]?.pend) L.push({ kind: 'm', id: m.id, tid: t.id, k, who: k === 'ra' ? m.a : m.b, vs: k === 'ra' ? m.b : m.a, r: m[k], range: rng(m), m, t }); })));
    return L;
  }
  const WHY = {
    'ios-app': '🍎 آيفون (التطبيق المثبّت): لا يدعم التعرف على الكلام. للنتيجة الفورية يفتح الموقع من Safari.',
    'no-sr': '🌐 متصفحه لا يدعم التعرف على الكلام. يستعمل Chrome (أندرويد) أو Safari (آيفون).',
    'sr-blocked': '🚫 إذن التعرف على الكلام مرفوض في جهازه.',
    'sr-broken': '⚙️ خدمة التعرف في جواله لا تعمل: يحتاج خطوات Google (الإدخال الصوتي ← Google).',
    quiet: '🔈 لم يُسمع كلام واضح: صوته ضعيف، أو الجوال بعيد، أو لم يقرأ.',
    'unknown-dev': '🆕 جهاز لم يُضبط بعد؛ يُضبط بفحص قصير قبل تحدّيه القادم.',
    silent: '❔ قرأ بوضوح والتعرف لم يلتقط كلامه.',
  };
  function drawRevT(host) {
    if (!host) return;
    const L = pendingReviews();
    host.hidden = !L.length;
    if (!L.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<h3>🎧 تسجيلات بانتظار تقييمك <span class="pill">${ar(L.length)}</span></h3>
      <p class="small muted" style="margin:0">هؤلاء قرؤوا في تحدٍّ أو مباراة لكن أجهزتهم لم تتعرف على كلامهم، فأرسلوا تسجيلاتهم إليك. استمع وضع نسبة الدقة (٠–١٠٠)، فتُحسب النتيجة كأنها آلية.</p>
      <ul class="rev-list">${L.map((x, i) => `<li><div><b>${esc(x.who.name)}</b> <span class="small muted">${x.kind === 'ch' ? '⚔️ تحدٍّ' : '🏆 مباراة'} مع ${esc(x.vs?.name || '—')} · ${esc(x.range)}${x.r.dur ? ` · ${ar(Math.round(x.r.dur))} ث` : ''}</span>
        <div class="small rev-why">${esc(WHY[x.r.why] || 'السبب غير مسجّل (تسجيل قبل التحديث)')}${x.r.dev?.os ? ` · <span class="muted">📱 ${esc({ iOS: 'آيفون', Android: 'أندرويد' }[x.r.dev.os] || x.r.dev.os)} · ${esc(x.r.dev.br || '')}</span>` : ''}</div></div>
        <div class="row" style="gap:6px"><button class="btn sm" type="button" data-rvp="${i}">🔊 استمع</button><input type="number" min="0" max="100" inputmode="numeric" placeholder="٪" data-rvv="${i}" style="width:80px" aria-label="نسبة الدقة"><button class="btn sm primary" type="button" data-rvs="${i}">حفظ</button></div></li>`).join('')}</ul>`;
    host.querySelectorAll('[data-rvp]').forEach((b) => (b.onclick = async () => {
      const x = L[+b.dataset.rvp]; b.disabled = true;
      try {
        const d = x.kind === 'ch' ? await store.getChAudio(x.id, x.k) : await store.getMatchAudio(x.tid, `${x.id}_${x.k === 'ra' ? 'a' : 'b'}_${x.m.tb || 0}`);
        if (!d) { toast('التسجيل غير متاح.'); b.disabled = false; return; }
        const a = new Audio(`data:${d.mime};base64,${d.b64}`); a.play(); b.textContent = '▶ يُشغَّل…'; a.onended = () => { b.disabled = false; b.textContent = '🔊 استمع'; };
      } catch (e) { b.disabled = false; toast('تعذر التشغيل: ' + (e.code || e.message)); }
    }));
    host.querySelectorAll('[data-rvs]').forEach((b) => (b.onclick = async () => {
      const i = +b.dataset.rvs, x = L[i], v = Number(host.querySelector(`[data-rvv="${i}"]`).value);
      if (!Number.isFinite(v) || v < 0 || v > 100 || host.querySelector(`[data-rvv="${i}"]`).value === '') return toast('اكتب نسبة بين ٠ و١٠٠.');
      b.disabled = true;
      const r = { p: Math.round(v), wpm: 0, dur: x.r.dur || 0, at: x.r.at || new Date().toISOString(), byT: 1 };
      try {
        if (x.kind === 'ch') {
          await store.updateChallenge(x.id, { [x.k]: r }); x.c[x.k] = r;
          if (chStatus(x.c) === 'done') notifyChallenge(x.id, 'done').catch(() => {});
        } else {
          const rr = { ...r, s: r.p };
          await store.updateMatch(x.tid, x.id, { [x.k]: rr }); x.m[x.k] = rr;
          heroTick(x.t);
        }
        toast(`حُفظت نتيجة ${x.who.name}: ${ar(r.p)}٪`);
        schedulePublish(); drawRevT(host);
      } catch (e) { b.disabled = false; toast('تعذر الحفظ: ' + (e.code || e.message)); }
    }));
  }
  /* ================= المتابعة: من لم يسمّع، ومتصل الآن، وتحليل الاستخدام ================= */
  const PGL = { tasks: 'الرئيسية والواجبات', practice: 'التدريب الحر', mushaf: 'المصحف', honor: 'لوحة الشرف', heroes: 'الأبطال', iqra: 'اقرأ وارتقِ', rewards: 'خزانتي', history: 'سجل التسميع', notebook: 'دفتر الأخطاء' };
  const DEVL = { m: '📱 جوال', t: '📱 لوحي', d: '💻 حاسوب' };
  const ONLINE_MS = 150e3;
  const isOnline = (p) => p && !p.off && Date.now() - (p.t || 0) < ONLINE_MS;
  let wUse = null, wRange = 7, wCls = 'all';
  /** من الآن: «منذ ١٢ دقيقة» */
  const agoTxt = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60e3)); if (m < 60) return `منذ ${nWord(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`; const h = Math.round(m / 60); if (h < 24) return `منذ ${nWord(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`; const d = Math.round(h / 24); return d === 1 ? 'أمس' : `منذ ${nWord(d, 'يوم', 'يومين', 'أيام', 'يوماً')}`; };
  /** «٤–٥ مساءً» */
  const hourLbl = (h) => { const a = h % 12 || 12, b = (h + 1) % 12 || 12, p = h < 5 ? 'ليلاً' : h < 12 ? 'صباحاً' : h < 15 ? 'ظهراً' : h < 18 ? 'عصراً' : 'مساءً'; return `${ar(a)}–${ar(b)} ${p}`; };
  /** واجبات الطالب الناقصة: المفتوحة، والتي انتهت هذا الشهر (بتوقيت البحرين) */
  function missingOf(s, doneBy) {
    const ym = riyadhDay().slice(0, 7), done = doneBy[s.id] || new Set(), joined = s.accountAt || s.createdAt || '';
    return D.tasks.filter((t) => taskFor(t, s) && taskStarted(t) && !done.has(t.id) && (t.createdAt || '') >= joined
      && (!taskClosed(t) || riyadhDay(new Date(taskEnd(t))).slice(0, 7) === ym))
      .sort((a, b) => (taskEnd(a) || '9').localeCompare(taskEnd(b) || '9'));
  }
  const doneMap = () => { const m = {}; D.subs.forEach((x) => { if (x.taskId) (m[x.pn] = m[x.pn] || new Set()).add(x.taskId); }); return m; };
  /** تنبيه داخل الصفحة حين يدخل طالب عليه واجبات ناقصة (والخادم يرسل إشعاراً خارج التطبيق) */
  function watchPresenceT() {
    if (D._offPres) return;
    const was = {};
    let first = true;
    D._offPres = store.watchPresence((L) => {
      D.presence = {}; L.forEach((p) => p.pn && (D.presence[p.pn] = p));
      const dm = doneMap();
      L.forEach((p) => {
        const on = isOnline(p);
        if (on && !was[p.pn] && !first) {
          const s = D.students.find((x) => x.id === p.pn), miss = s ? missingOf(s, dm) : [];
          if (miss.length) toast(`📲 ${s.name} دخل الآن، وعليه ${nWord(miss.length, 'واجب واحد', 'واجبان', 'واجبات', 'واجباً')} لم يسمّعها. افتح «👀 المتابعة» لتذكيره.`, 7000);
        }
        was[p.pn] = on;
      });
      first = false;
      const n = L.filter(isOnline).length; setBadge('watch', n);
      if (tab === 'watch') paintOnlineT();
      if (tab === 'home' && $('#tHero', app)) drawHome($('#tBody', app));
    });
    setInterval(() => { if (tab === 'watch') paintOnlineT(); }, 30e3); // يتجدد «منذ…» ويخرج من انقطعت نبضته
  }
  function drawWatch(body) {
    body.innerHTML = `<div class="stack" style="gap:16px">
      <div class="card stack" id="wMiss"></div>
      <div class="card stack" id="wOnline"></div>
      <div class="card stack" id="wUse"><h3>📊 تحليل الاستخدام</h3><div class="loading">جارٍ التحميل…</div></div></div>`;
    paintMissing(); paintOnlineT(); paintUsage();
  }
  function paintMissing() {
    const host = $('#wMiss', app); if (!host) return;
    const dm = doneMap();
    const rows = D.classes.map((c) => ({ c, L: D.students.filter((s) => s.classId === c.id).map((s) => ({ s, miss: missingOf(s, dm) })).filter((x) => x.miss.length).sort((a, b) => b.miss.length - a.miss.length || a.s.name.localeCompare(b.s.name, 'ar')) })).filter((x) => x.L.length);
    const total = rows.reduce((n, r) => n + r.L.length, 0);
    const chip = (t) => `<span class="wm-t${taskClosed(t) ? ' closed' : ''}" title="${esc(rangeLabel(t.surah, t.from, t.to))}">${esc(t.title)} <small>${taskClosed(t) ? 'انتهى' : taskEnd(t) ? 'ينتهي ' + esc(fmtDT(taskEnd(t)).replace(/،.*$/, '')) : 'مفتوح'}</small></span>`;
    host.innerHTML = `<h3>📋 لم يسمّعوا <span class="pill warn">${ar(total)}</span></h3>
      <p class="small muted" style="margin:0">الواجبات المفتوحة، والتي انتهى موعدها هذا الشهر. 🟢 = متصل الآن.</p>
      ${rows.length ? rows.map(({ c, L }) => `<details class="wm-c" open><summary><b>${esc(c.name)}</b> <span class="small muted">${nWord(L.length, 'طالب واحد', 'طالبان', 'طلاب', 'طالباً')}</span>
          <button class="btn sm ghost" type="button" data-wrc="${esc(c.id)}">🔔 ذكّرهم كلهم</button></summary>
        <ul class="wm-l">${L.map(({ s, miss }) => `<li><div class="wm-n"><span class="on-dot" title="متصل الآن" data-wn="${esc(s.id)}"${isOnline(D.presence?.[s.id]) ? '' : ' hidden'}></span><b data-lk="${esc(s.id)}" data-lk-no-title>${esc(s.name)}</b> <span class="pill warn">${ar(miss.length)}</span></div>
          <div class="wm-ts">${miss.map(chip).join('')}</div><button class="btn sm" type="button" data-wr="${esc(s.id)}">🔔 ذكّره</button></li>`).join('')}</ul></details>`).join('')
        : '<p class="muted" style="margin:0">ما شاء الله، سمّع الجميع كل واجباتهم.</p>'}`;
    const remind = async (list) => {
      const items = [];
      for (const { s, miss } of list) {
        const open = miss.filter((t) => !taskClosed(t)), names = miss.slice(0, 3).map((t) => `«${t.title}»`).join('، ') + (miss.length > 3 ? ` و${ar(miss.length - 3)} غيرها` : '');
        const nid = await store.addStudentNotif(s.id, { type: 'remind', title: '📋 تذكير من معلمك', body: `بقي عليك ${nWord(miss.length, 'واجب واحد', 'واجبان', 'واجبات', 'واجباً')}: ${names}.${open.length === miss.length ? ` سمّع${miss.length > 1 ? 'ها' : 'ه'} قبل انتهاء الموعد.` : open.length ? ' سمّع المفتوح منها قبل انتهاء موعده، واطلب السماح بتسليم ما فات موعده.' : ' فات موعدها، فاطلب من معلمك السماح بالتسليم.'}`, link: './#/student', tag: 'remind-' + s.id + '-' + riyadhDay() }).catch(() => null);
        if (nid) items.push({ notif: nid, student: s.id });
      }
      let sent = 0; try { for (let i = 0; i < items.length; i += 200) sent += (await sendPushBatch(items.slice(i, i + 200)))?.sent || 0; } catch {}
      return { n: items.length, sent };
    };
    $$('[data-wr]', host).forEach((b) => (b.onclick = async () => {
      const s = D.students.find((x) => x.id === b.dataset.wr); b.disabled = true;
      const r = await remind([{ s, miss: missingOf(s, doneMap()) }]);
      b.textContent = '✓ ذُكّر'; toast(r.n ? `وصل التذكير إلى ${s.name}${r.sent ? ' (إشعار على جواله)' : ' (يراه عند فتح الموقع)'}.` : 'تعذر الإرسال.');
    }));
    $$('[data-wrc]', host).forEach((b) => (b.onclick = async (e) => {
      e.preventDefault(); const row = rows.find((r) => r.c.id === b.dataset.wrc); if (!row) return;
      if (!(await confirmBox(`إرسال تذكير إلى ${nWord(row.L.length, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')} في ${row.c.name} بواجباتهم الناقصة؟`, 'أرسل'))) return;
      b.disabled = true; const r = await remind(row.L); b.textContent = '✓ ذُكّروا';
      toast(`أُرسل التذكير إلى ${nWord(r.n, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}${r.sent ? `، ووصل إشعار إلى ${ar(r.sent)} جهازاً` : ''}.`);
    }));
  }
  function paintOnlineT() {
    const host = $('#wOnline', app); if (!host) return;
    const P = D.presence || {}, stu = (pn) => D.students.find((x) => x.id === pn);
    $$('[data-wn]', app).forEach((d) => (d.hidden = !isOnline(P[d.dataset.wn])));
    const on = Object.values(P).filter(isOnline).filter((p) => stu(p.pn)).sort((a, b) => (a.since || 0) - (b.since || 0));
    const off = D.students.filter((s) => !isOnline(P[s.id])).map((s) => ({ s, p: P[s.id] })).sort((a, b) => (b.p?.t || 0) - (a.p?.t || 0));
    const seen = (p) => (p ? agoTxt(Math.min(p.t || 0, p.off || Infinity)) : 'لم يظهر منذ تفعيل الميزة');
    const dm = doneMap();
    host.innerHTML = `<h3>🟢 متصل الآن <span class="pill ok">${ar(on.length)}</span></h3>
      ${on.length ? `<ul class="wo-l">${on.map((p) => { const s = stu(p.pn), miss = missingOf(s, dm).length; return `<li><span class="on-dot"></span><div><b data-lk="${esc(s.id)}" data-lk-no-title>${esc(s.name)}</b> <span class="small muted">${esc(className(s.classId))}</span>${miss ? ` <span class="pill warn" title="واجبات لم يسمّعها">📋 ${ar(miss)}</span>` : ''}
          <div class="small">📍 ${esc(PGL[p.pg] || p.pg || '—')} · ⏱️ ${esc(agoTxt(p.since || p.t))} · ${DEVL[p.dev] || ''}</div></div></li>`; }).join('')}</ul>`
        : '<p class="muted" style="margin:0">لا أحد متصل الآن.</p>'}
      <details class="sp-box"><summary><b>🕒 آخر ظهور لبقية الطلاب (${ar(off.length)})</b></summary>
        <ul class="wo-off">${off.map(({ s, p }) => `<li><span>${esc(s.name)} <small class="muted">${esc(className(s.classId))}</small></span><small class="${p ? '' : 'muted'}">${esc(seen(p))}${p?.dev ? ' · ' + DEVL[p.dev] : ''}</small></li>`).join('')}</ul></details>`;
  }
  /** ملخّص أسبوع: الدقائق، وأكثر الساعات، وأنشط الطلاب، ومن لم يدخل */
  function usageStats(U, days, cls) {
    const today = riyadhDay(), from = addDays(today, -(days - 1));
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0)), perStu = {}, perCls = {};
    U.forEach((u) => {
      const s = D.students.find((x) => x.id === u.pn); if (!s || (cls !== 'all' && s.classId !== cls)) return;
      Object.entries(u.d || {}).forEach(([day, hs]) => {
        if (day < from || day > today) return;
        const wd = new Date(day + 'T12:00:00Z').getUTCDay();
        Object.entries(hs || {}).forEach(([h, n]) => {
          n = +n || 0; grid[wd][+h] += n; perStu[s.id] = (perStu[s.id] || 0) + n;
          const c = (perCls[s.classId] = perCls[s.classId] || { min: 0, hours: new Array(24).fill(0), act: new Set() });
          c.min += n; c.hours[+h] += n; c.act.add(s.id);
        });
      });
    });
    const hours = new Array(24).fill(0); grid.forEach((r) => r.forEach((n, h) => (hours[h] += n)));
    const top = hours.map((n, h) => ({ h, n })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
    const total = hours.reduce((a, b) => a + b, 0);
    const pool = D.students.filter((s) => cls === 'all' || s.classId === cls);
    const ranked = pool.map((s) => ({ s, m: perStu[s.id] || 0 })).sort((a, b) => b.m - a.m);
    return { grid, hours, top, total, perCls, ranked, zero: ranked.filter((x) => !x.m), pool };
  }
  const minTxt = (m) => (m < 60 ? nWord(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة') : `${ar(Math.floor(m / 60))} س${m % 60 ? ` و${ar(m % 60)} د` : ''}`);
  async function paintUsage(force) {
    const host = $('#wUse', app); if (!host) return;
    if (!wUse || force || Date.now() - wUse.at > 300e3) {
      try { wUse = { at: Date.now(), L: await store.listUsage() }; } catch (e) { host.innerHTML = `<h3>📊 تحليل الاستخدام</h3><p class="bad small">تعذر التحميل: ${esc(e.code || e.message)}${/permission/i.test(e.code || e.message) ? ' — انشر قواعد Firestore الجديدة.' : ''}</p>`; return; }
      if (!$('#wUse', app)) return;
    }
    const S = usageStats(wUse.L, wRange, wCls), max = Math.max(1, ...S.grid.flat());
    const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const shown = [...Array(24).keys()].filter((h) => S.hours[h] || (h >= 6 && h <= 23)); // ساعات الليل تظهر إن استُخدمت فقط
    const clsRows = D.classes.map((c) => { const x = S.perCls[c.id], n = D.students.filter((s) => s.classId === c.id).length; if (!n) return null; const pk = x ? x.hours.indexOf(Math.max(...x.hours)) : -1; return { c, min: x?.min || 0, avg: x ? Math.round(x.min / n) : 0, act: x?.act.size || 0, n, pk: x?.min ? pk : -1 }; }).filter(Boolean).sort((a, b) => b.avg - a.avg);
    const cmax = Math.max(1, ...clsRows.map((r) => r.avg));
    host.innerHTML = `<h3>📊 تحليل الاستخدام</h3>
      <div class="row">
        <label class="field" style="flex:1 1 140px">المدة<select id="wRange"><option value="7" ${wRange === 7 ? 'selected' : ''}>آخر ٧ أيام</option><option value="14" ${wRange === 14 ? 'selected' : ''}>آخر أسبوعين</option><option value="28" ${wRange === 28 ? 'selected' : ''}>آخر ٤ أسابيع</option></select></label>
        <label class="field" style="flex:1 1 160px">الصف<select id="wCls"><option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}" ${wCls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <button class="btn sm ghost" type="button" id="wRef" style="align-self:end">↻ تحديث</button></div>
      ${!S.total ? '<p class="muted" style="margin:0">لا بيانات بعد. تُجمع الدقائق من لحظة تحديث الطلاب للتطبيق، فارجع بعد يوم أو يومين.</p>' : `
      <div class="wu-kpi"><div><b>${esc(minTxt(S.total))}</b><span>مجموع الاستخدام</span></div><div><b>${ar(S.ranked.filter((x) => x.m).length)} / ${ar(S.pool.length)}</b><span>طالباً دخلوا</span></div><div><b>${esc(minTxt(Math.round(S.total / Math.max(1, S.pool.length))))}</b><span>متوسط الطالب</span></div></div>
      <div class="wu-top"><b>⏰ أكثر الأوقات ازدحاماً:</b> ${S.top.map((x, i) => `<span class="wu-h${i ? '' : ' first'}">${['🥇', '🥈', '🥉'][i]} ${esc(hourLbl(x.h))} <small>${esc(minTxt(x.n))}</small></span>`).join('')}</div>
      <div class="wu-heat-wrap"><table class="wu-heat"><thead><tr><th></th>${shown.map((h) => `<th>${ar(h % 12 || 12)}<small>${h < 12 ? 'ص' : 'م'}</small></th>`).join('')}</tr></thead>
        <tbody>${S.grid.map((r, d) => `<tr><th>${DAYS[d]}</th>${shown.map((h) => { const n = r[h], a = n ? 0.12 + 0.88 * (n / max) : 0; return `<td style="--a:${a.toFixed(2)}" title="${DAYS[d]} ${esc(hourLbl(h))}: ${esc(minTxt(n))}">${n ? '' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin:0">كلما اشتد اللون زاد عدد دقائق الطلاب في تلك الساعة.</p>
      ${wCls === 'all' && clsRows.length > 1 ? `<h4 style="margin:6px 0 0">🏫 مقارنة الصفوف (متوسط الطالب)</h4><ul class="wu-cls">${clsRows.map((r) => `<li><span class="wu-cn">${esc(r.c.name)}</span><span class="wu-bar"><i style="width:${Math.round((r.avg / cmax) * 100)}%"></i></span><span class="small">${esc(minTxt(r.avg))} · دخل ${ar(r.act)}/${ar(r.n)}${r.pk >= 0 ? ` · ذروته ${esc(hourLbl(r.pk))}` : ''}</span></li>`).join('')}</ul>` : ''}
      <div class="wu-two"><div><h4 style="margin:6px 0">🌟 الأنشط</h4><ol class="small">${S.ranked.filter((x) => x.m).slice(0, 5).map((x) => `<li>${esc(x.s.name)} <span class="muted">${esc(minTxt(x.m))}</span></li>`).join('')}</ol></div>
        <div><h4 style="margin:6px 0">💤 لم يدخلوا (${ar(S.zero.length)})</h4><p class="small" style="margin:0">${S.zero.slice(0, 12).map((x) => esc(x.s.name)).join('، ') || '—'}${S.zero.length > 12 ? ` و${ar(S.zero.length - 12)} غيرهم` : ''}</p></div></div>
      <p class="small muted" style="margin:0">📩 يصلك كل سبت مساءً ملخّص أسبوعي بهذه الأرقام.</p>`}`;
    $('#wRange', host).onchange = (e) => { wRange = +e.target.value; paintUsage(); };
    $('#wCls', host).onchange = (e) => { wCls = e.target.value; paintUsage(); };
    $('#wRef', host).onclick = () => paintUsage(true);
  }
  /* ================= المكافآت (المعلم): المتجر، والمنح، وصوت الأسبوع ================= */
  async function loadRewardsT() {
    store.ensureLooks?.().catch(() => {});
    let [sh, lk, vs, v, gr] = await Promise.all([store.getShop().catch(() => null), store.getLooks().catch(() => ({})), store.listVoices().catch(() => []), store.getVoice().catch(() => null), store.listGrants().catch(() => [])]);
    D.shop = sh || { items: {} }; D.voices = vs || []; D.voice = v; D.grants = (gr || []).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    // الأصوات القديمة بلا تاريخ أسبوعها: يُحفظ لها مرة واحدة ليعرضها الطلاب في أسبوعها
    const fixWk = (x) => (x && !x.wk && voiceWk(x) ? { ...x, wk: voiceWk(x) } : null);
    D.voices = D.voices.map((x) => { const f = fixWk(x); if (f) store.archiveVoice(f).catch(() => {}); return f || x; });
    const fv = fixWk(D.voice); if (fv) { D.voice = fv; store.setVoice(fv).catch(() => {}); }
    // زينة اختارها طالب قبل إنشاء مستند الزينة المشترك: يضيفها المعلم من سجل الطالب
    const miss = {};
    D.students.forEach((x) => { if (x.look && x.uid && !lk?.[x.uid]) miss[x.uid] = { ...x.look, pn: x.id }; });
    if (Object.keys(miss).length && store.mode === 'cloud') { lk = { ...(lk || {}), ...miss }; store.setLooksAll?.(miss).catch(() => {}); }
    setLooks(looksMap(lk));
    schedulePublish();
    if (tab === 'honor') drawBody();
  }
  const voiceBonus = () => (D.voices || []).filter((v) => v.pn && v.pts).map((v) => ({ pn: v.pn, bonus: v.pts, createdAt: v.at }))
    .concat((D.grants || []).filter((g) => g.pn && g.pts).map((g) => ({ pn: g.pn, bonus: g.pts, createdAt: g.at }))); // ومعها نقاط الشرف الممنوحة
  let shopKind = 'title';
  function drawShopT(host) {
    if (!host) return;
    if (!D.shop) { host.innerHTML = '<h3>🛍️ المتجر والمكافآت</h3><div class="loading">جارٍ التحميل…</div>'; return; }
    const mods = D.shop.items || {};
    const all = [...CATALOG.map((x) => ({ ...x, ...(mods[x.id] || {}) })), ...Object.values(mods).filter((x) => x?.custom && !x.deleted)];
    const kinds = Object.keys(KINDS);
    const L = all.filter((x) => x.kind === shopKind && !x.deleted);
    const valLabel = { frame: 'الشكل', title: 'نص اللقب', color: 'اللون', icon: 'الرمز', fx: 'التأثير', badge: 'رمز الوسام' };
    host.innerHTML = `<h3>🛍️ المتجر والمكافآت</h3>
      <p class="small muted" style="margin:0">الطلاب يكسبون 🪙 مكافأة لكل نقطة في لوحة الشرف، ومع الأوسمة. عدّل الأسعار، أو أخفِ ما لا تريده، أو أضف أوسمة ورموزاً خاصة تُباع أو تمنحها أنت. <b>الألقاب لا تُشترى</b>: يُنال بعضها بالإنجاز تلقائياً، وما تضيفه أنت تمنحه لمن تشاء. و<b>💡 الأنوار</b> مخفية حتى تقرر طريقة نيلها.</p>
      <div class="seg" role="tablist">${kinds.map((k) => `<button type="button" class="${k === shopKind ? 'on' : ''}" data-sk="${k}">${KINDS[k]}</button>`).join('')}</div>
      ${shopKind === 'glow' ? `<p class="small" style="margin:0">💡 <b>الأنوار</b> تتحرك على اسم الطالب في كل مكان، ويلبس الطالب نوراً واحداً. كلها <b>مخفية</b> حتى تختار لكل نور: يُباع بسعر تحدده، أو يُنال بإنجاز تختاره، أو تمنحه أنت لمن تشاء.</p>
      <div class="glow-mgr">${L.map((x) => { const md = x.hidden ? 'hide' : x.earn ? 'earn' : x.grantOnly ? 'grant' : 'sell', [ek, en] = (x.earn || CATALOG.find((c) => c.id === x.id)?.earn || 'days:10').split(':');
        return `<div class="glow-row" data-it="${esc(x.id)}" data-glow><div class="glow-pv"><span data-lk="__pv_${esc(x.v)}">${esc(D.students[0]?.name || 'عبدالله')}</span></div>
          <div class="glow-ctl"><b>${esc(x.name)}</b>${x.rare ? ' <span class="pill">نادر</span>' : ''}
            <select data-mode aria-label="طريقة الحصول"><option value="hide" ${md === 'hide' ? 'selected' : ''}>🙈 مخفي</option><option value="sell" ${md === 'sell' ? 'selected' : ''}>🛒 يُباع</option><option value="earn" ${md === 'earn' ? 'selected' : ''}>🏆 يُنال بإنجاز</option><option value="grant" ${md === 'grant' ? 'selected' : ''}>🎖️ أمنحه أنا</option></select>
            <label class="glow-f" data-show="sell" ${md === 'sell' ? '' : 'hidden'}>السعر 🪙 <input type="number" min="0" max="5000" value="${x.price || 0}" data-price></label>
            <span class="glow-f" data-show="earn" ${md === 'earn' ? '' : 'hidden'}><select data-ek aria-label="الإنجاز">${EARN_KEYS.map(([k, l]) => `<option value="${k}" ${k === ek ? 'selected' : ''}>${l}</option>`).join('')}</select><input type="number" min="1" max="500" value="${+en || 1}" data-en aria-label="العدد"></span>
            <small class="muted" data-etxt>${md === 'earn' ? '🏆 ' + esc(earnText({ earn: `${ek}:${en}` })) : ''}</small></div></div>`; }).join('')}</div>` : `
      <div class="table-wrap"><table class="table"><thead><tr><th>العنصر</th><th>${shopKind === 'title' ? 'كيف يُنال' : 'السعر 🪙'}</th><th>${shopKind === 'title' ? 'الظهور' : 'في المتجر'}</th><th></th></tr></thead><tbody>
        ${L.map((x) => `<tr data-it="${esc(x.id)}"><td>${x.kind === 'icon' || x.kind === 'badge' ? esc(x.v) + ' ' : x.kind === 'color' ? `<span class="sw" style="background:${esc(x.v)}"></span> ` : ''}<b>${esc(x.name)}</b>${x.kind === 'title' ? ` <span class="small muted">«${esc(x.v)}»</span>` : ''}${x.need ? ' <span class="pill">نادر</span>' : ''}</td>
          ${x.kind === 'title' ? `<td class="small">${x.earn ? `🏆 ${esc(earnText(x))}<div class="muted">${esc(earnSteps(x))}</div>` : '🎖️ تمنحه أنت'}<input type="hidden" data-price value="0"></td>
          <td><select data-mode aria-label="الظهور"><option value="${x.earn ? 'sell' : 'grant'}" ${!x.hidden ? 'selected' : ''}>${x.earn ? 'يُنال بالإنجاز' : 'يمنحه المعلم'}</option><option value="hide" ${x.hidden ? 'selected' : ''}>مخفي</option></select></td>`
          : `<td><input type="number" min="0" max="5000" value="${x.price || 0}" data-price style="width:90px" aria-label="السعر"></td>
          <td><select data-mode aria-label="طريقة الحصول"><option value="sell" ${!x.hidden && !x.grantOnly ? 'selected' : ''}>يُباع</option><option value="grant" ${x.grantOnly ? 'selected' : ''}>يمنحه المعلم فقط</option><option value="hide" ${x.hidden ? 'selected' : ''}>مخفي</option></select></td>`}
          <td>${x.custom ? '<button class="btn sm danger" type="button" data-del>حذف</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">لا عناصر.</td></tr>'}
      </tbody></table></div>`}
      <details class="sp-box"><summary><b>➕ إضافة لقب أو وسام أو رمز</b></summary>
        <div class="row" style="margin-top:10px">
          <label class="field" style="flex:1 1 130px">النوع<select id="shK">${['title', 'badge', 'icon', 'color'].map((k) => `<option value="${k}" ${k === shopKind ? 'selected' : ''}>${KINDS[k]}</option>`).join('')}</select></label>
          <label class="field" style="flex:2 1 180px">الاسم<input id="shN" maxlength="40" placeholder="مثلاً: متقن الأسبوع"></label>
          <label class="field" style="flex:1 1 120px" id="shVL">${valLabel[shopKind] || 'القيمة'}<input id="shV" maxlength="30" placeholder="🏅 أو نص اللقب"></label>
          <label class="field" style="flex:1 1 90px">السعر 🪙<input id="shP" type="number" min="0" max="5000" value="30"></label>
          <label class="field" style="flex:1 1 140px">طريقة الحصول<select id="shM"><option value="sell">يُباع في المتجر</option><option value="grant">يمنحه المعلم فقط</option></select></label>
        </div><button class="btn primary" type="button" id="shAdd">إضافة</button></details>
      <details class="sp-box" id="grBox"><summary><b>🎖️ منح نقاط شرف أو عنصر لطالب أو مجموعة</b></summary>
        <p class="small muted" style="margin:8px 0 0">النقاط تُحسب في <b>لوحة الشرف</b> فوراً (في الشهر والجولة الحاليين)، وتزيد معها رصيده في المتجر، ويصله إشعار بها. للمقارنة: الدرجة الكاملة في واجب واحد = ١٠ نقاط.</p>
        <div class="row" style="margin-top:10px">
          <label class="field" style="flex:1 1 150px">الصف<select id="grCls"><option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:2 1 180px">بحث<input id="grQ" type="search" placeholder="اسم الطالب أو رقمه"></label>
        </div>
        <div class="gr-pick"><label class="gr-all"><input type="checkbox" id="grAll"> <b>تحديد الكل</b> <span class="small muted" id="grN"></span></label><div id="grList" class="gr-list"></div></div>
        <div class="row" style="margin-top:10px">
          <label class="field" style="flex:1 1 110px">نقاط شرف ⭐<input id="grC" type="number" min="0" max="50" step="0.5" value="2"></label>
          <label class="field" style="flex:2 1 180px">عنصر من المتجر (اختياري)<select id="grI"><option value="">— بلا عنصر —</option>${all.filter((x) => !x.deleted).map((x) => `<option value="${esc(x.id)}">${esc(KINDS[x.kind].split(' ')[0])} ${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:3 1 220px">السبب (يظهر للطالب، اختياري)<input id="grWhy" maxlength="80" placeholder="مثلاً: لحسن الإنصات في الحلقة"></label>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap" id="grQuick">${[1, 2, 3, 5, 10].map((n) => `<button type="button" class="chip" data-grc="${n}">+${ar(n)} ⭐</button>`).join('')}</div>
        <button class="btn primary" type="button" id="grGo" style="margin-top:10px">امنح</button>
        <div id="grLog"></div></details>
      <div class="row"><button class="btn primary" type="button" id="shSave">حفظ تعديلات المتجر</button></div>`;
    const kk = host.querySelector('#shK'), kv = host.querySelector('#shV');
    const ph = { title: 'نص اللقب', badge: '🏅 رمز', icon: '🌟 رمز', color: '#0f8a5f' };
    kk.onchange = () => {
      kv.placeholder = ph[kk.value]; kv.type = kk.value === 'color' ? 'color' : 'text'; host.querySelector('#shVL').firstChild.textContent = valLabel[kk.value];
      // الألقاب لا تُباع: تمنحها أنت
      const t = kk.value === 'title'; host.querySelector('#shP').closest('label').hidden = t; host.querySelector('#shM').closest('label').hidden = t;
    };
    kk.onchange();
    $$('[data-sk]', host).forEach((b) => (b.onclick = () => { shopKind = b.dataset.sk; drawShopT(host); }));
    // الأنوار: إظهار حقل السعر أو حقل الإنجاز حسب الاختيار
    $$('[data-glow]', host).forEach((r) => {
      const upd = () => {
        const md = r.querySelector('[data-mode]').value;
        r.querySelectorAll('[data-show]').forEach((f) => (f.hidden = f.dataset.show !== md));
        r.querySelector('[data-etxt]').textContent = md === 'earn' ? '🏆 ' + earnText({ earn: `${r.querySelector('[data-ek]').value}:${Math.max(1, +r.querySelector('[data-en]').value || 1)}` }) : md === 'hide' ? '' : md === 'grant' ? 'تمنحه من «منح طالب عنصراً» أسفل الصفحة.' : '';
      };
      r.querySelectorAll('select, input').forEach((i) => (i.oninput = i.onchange = upd));
    });
    const collect = () => {
      const m = { ...(D.shop.items || {}) };
      $$('[data-it]', host).forEach((tr) => {
        const id = tr.dataset.it, base = CATALOG.find((c) => c.id === id), cur = m[id] || {};
        const price = Math.max(0, Math.min(5000, +tr.querySelector('[data-price]').value || 0)), mode = tr.querySelector('[data-mode]').value;
        const patch = { price, hidden: mode === 'hide', grantOnly: mode === 'grant' };
        if (tr.dataset.glow != null) patch.earn = mode === 'earn' ? `${tr.querySelector('[data-ek]').value}:${Math.max(1, Math.min(500, +tr.querySelector('[data-en]').value || 1))}` : '';
        m[id] = base ? { ...cur, ...patch } : { ...cur, ...patch };
      });
      return m;
    };
    $$('[data-del]', host).forEach((b) => (b.onclick = () => { const id = b.closest('[data-it]').dataset.it; D.shop.items = { ...collect(), [id]: { ...(D.shop.items[id] || {}), deleted: true } }; drawShopT(host); }));
    host.querySelector('#shAdd').onclick = () => {
      const k = kk.value, n = host.querySelector('#shN').value.trim(), v = kv.value.trim() || (k === 'title' ? n : '');
      if (!n || !v) return toast('اكتب الاسم والقيمة.');
      const id = 'u-' + Date.now().toString(36);
      D.shop.items = { ...collect(), [id]: { id, kind: k, name: n, v, price: k === 'title' ? 0 : Math.max(0, +host.querySelector('#shP').value || 0), grantOnly: k === 'title' || host.querySelector('#shM').value === 'grant', custom: true } };
      shopKind = k; drawShopT(host); toast('أُضيف. لا تنسَ «حفظ تعديلات المتجر».');
    };
    host.querySelector('#shSave').onclick = async (e) => {
      e.target.disabled = true;
      try { D.shop = { items: collect() }; await store.setShop(D.shop); toast('حُفظ المتجر، ويظهر للطلاب الآن.'); } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); }
      e.target.disabled = false;
    };
    // اختيار الطلاب: صف، وبحث، وتحديد الكل
    const grSel = new Set();
    const grPool = () => { const c = host.querySelector('#grCls').value, q = host.querySelector('#grQ').value.trim();
      return D.students.filter((x) => (c === 'all' || x.classId === c) && (!q || x.name.includes(q) || String(x.id).includes(q))).sort((a, b) => a.name.localeCompare(b.name, 'ar')); };
    const grPaint = () => {
      const L = grPool(), box = host.querySelector('#grList');
      box.innerHTML = L.length ? L.map((x) => `<label class="gr-it${grSel.has(x.id) ? ' on' : ''}"><input type="checkbox" value="${esc(x.id)}" ${grSel.has(x.id) ? 'checked' : ''}> ${esc(x.name)}${host.querySelector('#grCls').value === 'all' ? ` <small class="muted">${esc(className(x.classId))}</small>` : ''}</label>`).join('') : '<span class="muted small">لا يوجد طلاب.</span>';
      $$('input', box).forEach((i) => (i.onchange = () => { i.checked ? grSel.add(i.value) : grSel.delete(i.value); i.parentElement.classList.toggle('on', i.checked); grCount(); }));
      grCount();
    };
    const grCount = () => { const L = grPool(); host.querySelector('#grAll').checked = L.length > 0 && L.every((x) => grSel.has(x.id)); host.querySelector('#grN').textContent = grSel.size ? `(المحدَّدون: ${ar(grSel.size)})` : ''; host.querySelector('#grGo').textContent = grSel.size > 1 ? `امنح ${ar(grSel.size)} طلاب` : 'امنح'; };
    host.querySelector('#grAll').onchange = (e) => { grPool().forEach((x) => (e.target.checked ? grSel.add(x.id) : grSel.delete(x.id))); grPaint(); };
    host.querySelector('#grCls').onchange = grPaint; host.querySelector('#grQ').oninput = grPaint;
    $$('[data-grc]', host).forEach((b) => (b.onclick = () => (host.querySelector('#grC').value = b.dataset.grc)));
    grPaint();
    // سجل آخر المنح، مع إمكانية الإلغاء
    const grLog = () => {
      const L = (D.grants || []).slice(0, 30), box = host.querySelector('#grLog'); if (!box) return;
      if (!L.length) { box.innerHTML = ''; return; }
      // تجميع المنح التي صدرت معاً (نفس الوقت والسبب)
      const G = []; L.forEach((g) => { const k = g.batch || g.id, o = G.find((x) => x.k === k); o ? o.L.push(g) : G.push({ k, L: [g] }); });
      box.innerHTML = `<h4 style="margin:14px 0 6px">آخر المنح</h4><div class="gr-log">${G.slice(0, 12).map((x) => { const g = x.L[0], names = x.L.map((y) => D.students.find((s) => s.id === y.pn)?.name || y.pn);
        return `<div class="gr-row"><b class="rp-up">+${ar(g.pts)} ⭐</b><span>${esc(names.length > 3 ? `${names.slice(0, 3).join('، ')} و${ar(names.length - 3)} غيرهم` : names.join('، '))}${g.why ? ` <small class="muted">(${esc(g.why)})</small>` : ''}</span><small class="muted">${esc(timeAgo(g.at))}</small><button type="button" class="btn sm ghost danger" data-gx="${esc(x.k)}" title="إلغاء هذه المنحة">إلغاء</button></div>`; }).join('')}</div>`;
      $$('[data-gx]', box).forEach((b) => (b.onclick = async () => {
        const grp = G.find((x) => x.k === b.dataset.gx); if (!grp || !(await confirmBox(`إلغاء منحة ${ar(grp.L[0].pts)} ⭐ عن ${ar(grp.L.length)} ${grp.L.length === 1 ? 'طالب' : 'طلاب'}؟ تُخصم من لوحة الشرف.`, 'ألغِها'))) return;
        try { for (const g of grp.L) await store.deleteGrant(g.id); const ids = new Set(grp.L.map((g) => g.id)); D.grants = D.grants.filter((g) => !ids.has(g.id)); grLog(); schedulePublish(100); toast('أُلغيت المنحة.'); } catch (e) { toast('تعذر الإلغاء: ' + (e.code || e.message)); }
      }));
    };
    grLog();
    host.querySelector('#grGo').onclick = async (e) => {
      const pns = [...grSel], id = host.querySelector('#grI').value, c = Math.max(0, Math.min(50, Math.round((+host.querySelector('#grC').value || 0) * 2) / 2)), why = host.querySelector('#grWhy').value.trim();
      if (!pns.length) return toast('اختر طالباً واحداً على الأقل.');
      if (!id && !c) return toast('اكتب عدد النقاط أو اختر عنصراً.');
      const it = all.find((x) => x.id === id), what = `${c ? `${ar(c)} ${c <= 2 ? (c === 1 ? 'نقطة شرف' : 'نقطتا شرف') : c <= 10 ? 'نقاط شرف' : 'نقطة شرف'} ⭐` : ''}${it && c ? ' و' : ''}${it ? `«${it.name}»` : ''}`;
      if (pns.length > 1 && !(await confirmBox(`منح ${what} لكل واحد من ${ar(pns.length)} طلاب؟`, 'امنح'))) return;
      e.target.disabled = true;
      const batch = [], failed = [], at = new Date().toISOString(), bid = 'b' + Date.now().toString(36);
      try {
        if (c) { const out = await store.addGrants(pns.map((pn) => ({ pn, pts: c, why, at, batch: bid, classId: D.students.find((s) => s.id === pn)?.classId || '' }))); D.grants = [...out, ...(D.grants || [])]; schedulePublish(100); }
      } catch (x) { e.target.disabled = false; return toast('تعذر منح النقاط: ' + (x.code || x.message)); }
      for (const pn of pns) {
        try {
          if (id) await store.grantItem(pn, id);
          const nid = await store.addStudentNotif(pn, { type: 'reward', title: '🎁 هدية من معلمك', body: `${what}${why ? ` ${why}` : ''}${c ? '. تظهر الآن في لوحة الشرف' : '. افتح «خزانتي»'}.`, link: './#/student', tag: 'reward-' + pn });
          if (nid) batch.push({ notif: nid, student: pn });
        } catch (x) { failed.push(D.students.find((s) => s.id === pn)?.name || pn); }
      }
      if (batch.length) (batch.length === 1 ? sendPush(batch[0].notif, batch[0].student) : sendPushBatch(batch)).catch(() => {});
      const ok = pns.length - failed.length, one = D.students.find((x) => x.id === pns[0]);
      toast(failed.length ? `مُنح ${ar(ok)}، وتعذر منح: ${failed.join('، ')}` : ok === 1 ? `مُنح ${one?.name || 'الطالب'} ${what}.` : `مُنح ${ar(ok)} طلاب ${what} لكل واحد.`);
      if (!failed.length) { grSel.clear(); grPaint(); host.querySelector('#grWhy').value = ''; }
      grLog();
      e.target.disabled = false;
    };
  }

  /* صوت الأسبوع: تختار الأسبوع، فيقترح الموقع أفضل تسميعاته، وتسمع وتختار؛ ومعه أرشيف الأصوات السابقة */
  let voiceWeek = 0, voiceAu = null;
  const playAudio = (getter) => async (e) => {
    const b = e.currentTarget, label = b.textContent;
    if (voiceAu && !voiceAu.paused && voiceAu._b === b) { voiceAu.pause(); b.textContent = label.replace('⏸ إيقاف', '🔊 استمع'); return; }
    voiceAu?.pause();
    try {
      b.disabled = true;
      const src = await getter(); if (!src) { toast('التسجيل غير متاح.'); return; }
      voiceAu = new Audio(src); voiceAu._b = b; voiceAu.onended = () => { b.textContent = '🔊 استمع'; };
      await voiceAu.play(); b.textContent = '⏸ إيقاف';
    } catch (x) { toast('تعذر التشغيل: ' + (x.code || x.message)); } finally { b.disabled = false; }
  };
  function drawVoiceT(host) {
    if (!host) return;
    const W = weekRange(voiceWeek);
    // معرّف تسليم الواجب واحد لكل الطلاب (t_رقم الواجب)، فالمفتاح رقم الطالب مع المعرّف
    const vk = (pn, sid) => `${pn}|${sid}`;
    const chosen = new Set((D.voices || []).filter((v) => v.sid).map((v) => vk(v.pn, v.sid)));
    const forWeek = (r) => (D.voices || []).filter((v) => voiceWk(v) === r.from);
    const wkOf = (v) => voiceWk(v) || v?.at || '';
    // ما يراه الطلاب الآن: صوت هذا الأسبوع وصوت الأسبوع الماضي
    const R0 = weekRange(0).from, R1 = weekRange(1).from;
    const weekVoices = forWeek(W);
    // كل تسميعات الأسبوع، المقيَّمة وغير المقيَّمة
    const inWeek = (D.subs || []).filter((x) => x.createdAt >= W.from && x.createdAt < W.to);
    const withAu = inWeek.filter((x) => x.hasAudio), gone = inWeek.filter((x) => x.audioDeletedAt).length;
    const best = withAu.filter((x) => (x.percent ?? 0) >= 85).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 10);
    const why = !inWeek.length ? `لا تسميعات في ${W.name}.`
      : !withAu.length ? `في ${W.name} ${ar(inWeek.length)} تسميعاً، لكن لا تسجيلات صوتية متاحة لها${gone ? ` (حُذفت تسجيلات ${ar(gone)} منها لتوفير المساحة)` : ''}.`
      : `في ${W.name} ${ar(withAu.length)} تسجيلاً، لكن لم تبلغ دقة أيٍّ منها ٨٥٪.`;
    const stu = (pn) => D.students.find((x) => x.id === pn);
    const v = D.voice, vLikes = v ? Object.keys(v.likes || {}).length : 0;
    const shown = new Set([v?.id, ...[R0, R1].filter((w) => w !== voiceWk(v)).map((w) => (D.voices || []).filter((x) => voiceWk(x) === w).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0]?.id)].filter(Boolean));
    const past = (D.voices || []).filter((x) => x.id !== v?.id).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    host.innerHTML = `<h3>🎙️ صوت الأسبوع</h3>
      ${v ? `<div class="voice-cur"><span class="small muted">يظهر للطلاب الآن · ${v.week ? `صوت ${esc(v.week)}` : `اختير ${esc((v.at || '').slice(0, 10))}`}</span><div><b data-lk="${esc(v.pn)}">${esc(v.name)}</b> · ${esc(v.className || '')} · ${esc(v.range || '')}</div>
        <div class="row" style="gap:8px"><span class="small">❤️ ${ar(vLikes)} «ما شاء الله»</span><button class="btn sm" type="button" id="vCurP">🔊 استمع</button></div>
        ${(D.voices || []).filter((x) => shown.has(x.id) && x.id !== v.id).map((x) => `<div class="small">ويظهر معه تحته: <b data-lk="${esc(x.pn)}">${esc(x.name)}</b> · صوت ${esc(x.week || '')}</div>`).join('')}</div>` : '<p class="small muted" style="margin:0">لم تختر صوتاً بعد.</p>'}
      <ol class="vw-steps small"><li>اختر الأسبوع.</li><li>استمع لأفضل تسميعاته (بتسجيل ودقة ٨٥٪ فأكثر).</li><li>حدّد النقاط والمكافآت، ثم اضغط «⭐ اختره».</li></ol>
      <div class="row">
        <label class="field" style="flex:2 1 200px">الأسبوع<select id="vWeek">${Array.from({ length: 8 }, (_, k) => { const r = weekRange(k), n = forWeek(r).length; return `<option value="${k}" ${k === voiceWeek ? 'selected' : ''}>${n ? '🎙️ ' : ''}${r.name} · ${r.label}${n ? ' · اخترت له' : ''}</option>`; }).join('')}</select></label>
        <label class="field" style="flex:1 1 110px">نقاط لوحة الشرف<input type="number" id="vPts" min="0" max="50" value="5"></label>
        <label class="field" style="flex:1 1 110px">مكافآت 🪙<input type="number" id="vCoins" min="0" max="500" value="20"></label>
      </div>
      ${weekVoices.length ? `<div class="small">🎙️ صوت ${esc(W.name)}: ${weekVoices.map((p) => `<b data-lk="${esc(p.pn)}">${esc(p.name)}</b>${shown.has(p.id) ? ' <span class="pill ok">يظهر للطلاب الآن</span>' : ''}`).join('، ')}</div>` : ''}
      ${best.length ? `<ul class="rev-list">${best.map((x, i) => `<li${chosen.has(vk(x.pn, x.id)) ? ' class="vw-done"' : ''}><div><b data-lk="${esc(x.pn)}">${esc(stu(x.pn)?.name || x.studentName || '')}</b> <span class="small muted">${esc(className(stu(x.pn)?.classId))} · ${esc(rangeLabel(x.surah, x.from, x.to))} · ${x.percent != null ? ar(x.percent) + '٪' : ''} · ${esc((x.createdAt || '').slice(0, 10))}</span>${chosen.has(vk(x.pn, x.id)) ? ' <span class="pill ok">اختير من قبل</span>' : ''}</div>
        <div class="row" style="gap:6px"><button class="btn sm" type="button" data-vp="${i}">🔊 استمع</button>${chosen.has(vk(x.pn, x.id)) ? '' : `<button class="btn sm primary" type="button" data-vc="${i}">⭐ اختره</button>`}</div></li>`).join('')}</ul>` : `<p class="small muted" style="margin:0">${esc(why)}</p>`}
      <details class="sp-box"${past.length ? '' : ' hidden'}><summary><b>📼 الأصوات السابقة (${ar(past.length)})</b></summary>
        <ul class="rev-list" style="margin-top:8px">${past.map((p, i) => `<li><div><b data-lk="${esc(p.pn)}">${esc(p.name)}</b> <span class="small muted">${esc(p.className || '')} · ${esc(p.range || '')} · ${p.week ? esc(p.week) : esc((p.at || '').slice(0, 10))}</span>${p.likes ? ` <span class="small">❤️ ${ar(Object.keys(p.likes).length)}</span>` : ''}</div>
          <div class="row" style="gap:6px"><button class="btn sm" type="button" data-pp="${i}">🔊 استمع</button><button class="btn sm ghost" type="button" data-pr="${i}" title="يظهر للطلاب من جديد دون نقاط أو مكافآت إضافية">↺ اعرضه من جديد</button></div></li>`).join('')}</ul></details>`;
    host.querySelector('#vWeek').onchange = (e) => { voiceWeek = +e.target.value; drawVoiceT(host); };
    const vc = host.querySelector('#vCurP'); if (vc) vc.onclick = playAudio(async () => { const d = await store.getVoiceAudio(v.id); return d && `data:${d.mime};base64,${d.b64}`; });
    $$('[data-vp]', host).forEach((b) => (b.onclick = playAudio(async () => { const x = best[+b.dataset.vp]; const blob = await store.getAudio(x.pn, x.id); return blob && URL.createObjectURL(blob); })));
    $$('[data-pp]', host).forEach((b) => (b.onclick = playAudio(async () => { const p = past[+b.dataset.pp]; const d = await store.getVoiceAudio(p.id); return d && `data:${d.mime};base64,${d.b64}`; })));
    $$('[data-pr]', host).forEach((b) => (b.onclick = async () => {
      const p = past[+b.dataset.pr];
      if (!(await confirmBox(`عرض صوت ${p.name} من جديد لكل الطلاب؟ (بلا نقاط أو مكافآت إضافية)`, 'اعرضه'))) return;
      try {
        if (D.voice) await store.archiveVoice(D.voice);
        const vv = { ...p, at: new Date().toISOString(), likes: p.likes || {}, again: true };
        await store.setVoice(vv); D.voice = vv; D.voices = (D.voices || []).map((x) => (x.id === vv.id ? vv : x));
        toast('يظهر الآن للطلاب.'); drawVoiceT(host);
      } catch (x) { toast('تعذر: ' + (x.code || x.message)); }
    }));
    $$('[data-vc]', host).forEach((b) => (b.onclick = async () => {
      const x = best[+b.dataset.vc], st = stu(x.pn); if (!st) return;
      if (!(await confirmBox(`اختيار ${st.name} «صوت الأسبوع» (${W.name})؟`, 'اختره'))) return;
      b.disabled = true;
      try {
        const blob = await store.getAudio(x.pn, x.id); if (!blob) throw new Error('التسجيل غير متاح');
        const id = 'v' + Date.now().toString(36), at = new Date().toISOString();
        const pts = Math.max(0, Math.min(50, +$('#vPts', host).value || 0)), coins = Math.max(0, Math.min(500, +$('#vCoins', host).value || 0));
        if (!(await store.saveVoiceAudio(id, blob))) throw new Error('التسجيل طويل جداً');
        const range = rangeLabel(x.surah, x.from, x.to);
        const vv = { id, sid: x.id, pn: st.id, name: st.name, classId: st.classId, className: className(st.classId), surah: x.surah, from: x.from, to: x.to, range, week: W.label, wk: W.from, at, pts, likes: {} };
        // صوت لأسبوع أقدم من الصوت الظاهر الآن: يُحفظ في الأرشيف ولا يحلّ محلّ صوت الأسبوع الأحدث
        const show = !D.voice || wkOf(D.voice) <= W.from;
        if (show) {
          if (D.voice) await store.archiveVoice(D.voice).catch(() => {}); // يُحفظ عدد «ما شاء الله» للصوت السابق
          await store.setVoice(vv);
          D.voices = [...(D.voices || []).map((p) => (p.id === D.voice?.id ? D.voice : p)), vv]; D.voice = vv;
        } else {
          await store.archiveVoice(vv);
          D.voices = [...(D.voices || []), vv];
        }
        await store.addBadges({ [st.id]: { id: 'voice-' + id, icon: '🎙️', color: '#0f5c46', label: 'صوت الأسبوع', title: `${range} · ${W.label}`, at } }).catch(() => {});
        if (coins) await store.grantCoins(st.id, coins).catch(() => {});
        const nid = await store.addStudentNotif(st.id, { type: 'voice', title: '🎙️ أنت «صوت الأسبوع»!', body: `اختار معلمك تلاوتك (${range}) صوتاً لـ${W.name}${show ? ' لتُسمَع في صفحة كل الطلاب' : ''}. +${ar(pts)} نقاط و${ar(coins)} 🪙 ووسام «صوت الأسبوع». ما شاء الله!`, link: './#/student', tag: 'voice-' + id }).catch(() => null);
        if (nid) sendPush(nid, st.id).catch(() => {});
        schedulePublish(); toast(show ? `صار ${st.name} «صوت الأسبوع». ما شاء الله!` : `اختير ${st.name} صوتاً لـ${W.name} (حُفظ في الأصوات السابقة، ويبقى صوت الأسبوع الأحدث ظاهراً للطلاب).`); drawVoiceT(host);
      } catch (e) { b.disabled = false; toast('تعذر: ' + (e.code || e.message)); }
    }));
  }
  async function drawChAdmin(host) {
    const L = D.challenges || [];
    const ym = new Date().toISOString().slice(0, 7);
    const month = L.filter((c) => (c.createdAt || '').slice(0, 7) === ym);
    const open = L.filter((c) => chStatus(c) === 'open');
    let cfg = { off: false };
    try { cfg = (await store.getChallengeCfg()) || cfg; } catch {}
    setChPts(cfg.pts);
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">⚔️ تحدّي الزملاء</h3>
        <label class="row small" style="gap:6px"><input type="checkbox" id="chOn" ${cfg.off ? '' : 'checked'}> التحديات مفعّلة</label></div>
      <label class="row small" style="gap:6px">نوع التحدي المسموح<select id="chModes"><option value="both" ${!cfg.modes || cfg.modes === 'both' ? 'selected' : ''}>الطالب يختار: غيباً أو نظراً</option><option value="hifz" ${cfg.modes === 'hifz' ? 'selected' : ''}>تسميع غيباً فقط</option><option value="recite" ${cfg.modes === 'recite' ? 'selected' : ''}>تلاوة نظراً فقط</option></select></label>
      <p class="small muted" style="margin:0">هذا الشهر: ${month.length ? nWord(month.length, 'تحدٍّ واحد', 'تحديان', 'تحديات', 'تحدياً') : 'لا تحديات بعد'}، وجارٍ الآن ${ar(open.length)}، ومنذ البداية ${ar(L.length)}. حد كل طالب ${ar(CH_DAILY)} تحديات يومياً.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" id="chLog">📋 سجل التحديات كاملاً</button><button class="btn sm" type="button" id="chPtsBtn">⚙️ نقاط التحدي: فوز ${ar(CH_PTS.win)} · مشاركة ${ar(CH_PTS.lose)} · تعادل ${ar(CH_PTS.tie)} · إلغاء −${ar(CH_PTS.cancel)}</button></div>
      ${month.length ? `<details><summary class="small">آخر تحديات هذا الشهر</summary><ul class="ch-list">${month.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 15).map((c) => `<li><div><b>${esc(c.a.name)} ⚔️ ${esc(c.b.name)}</b><span class="small muted">${esc(c.className || '')} · ${esc(c.label || '')}</span><span class="small ch-when">${chWhenTxt(c)}</span></div><span class="small">${esc(chResult(c))}${c.ra || c.rb ? ` · ${c.ra ? ar(c.ra.p) + '٪' : '—'} / ${c.rb ? ar(c.rb.p) + '٪' : '—'}` : ''}</span></li>`).join('')}</ul></details>` : ''}`;
    $('#chOn', host).onchange = async (e) => {
      try { cfg = { ...cfg, off: !e.target.checked }; await store.setChallengeCfg(cfg); toast(e.target.checked ? 'فُعّلت التحديات.' : 'أُوقفت التحديات مؤقتاً، ولا يستطيع الطلاب إنشاء تحدٍّ جديد.'); } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); e.target.checked = !e.target.checked; }
    };
    $('#chModes', host).onchange = async (e) => { const v = e.target.value; try { cfg = { ...cfg, modes: v }; await store.setChallengeCfg(cfg); toast(v === 'both' ? 'يختار الطالب نوع التحدي: غيباً أو نظراً.' : `التحديات الجديدة: ${v === 'hifz' ? 'تسميع غيباً' : 'تلاوة نظراً'} فقط.`); } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); } };
    $('#chLog', host).onclick = () => openChLog();
    $('#chPtsBtn', host).onclick = () => openModal(`<form id="cpF" class="stack" style="gap:12px">
        <h2>⚙️ نقاط تحدّي الزملاء</h2>
        <p class="small muted" style="margin:0">تُضاف إلى لوحة الشرف عند حسم كل تحدٍّ. التغيير يسري على حساب النقاط كله، ومنه التحديات السابقة، أما نتائج الأشهر المعلنة فتبقى كما هي.</p>
        ${[['win', '🏆 الفائز'], ['lose', '🤝 المشارك الخاسر (إن سمّع)'], ['tie', '⚖️ التعادل (لكلٍّ منهما)'], ['cancel', '✖️ خصم إلغاء التحدي بعد قبوله']].map(([k, l]) => `<label class="row" style="gap:10px;justify-content:space-between"><span>${l}</span><input type="number" id="cp_${k}" min="0" max="20" step="0.5" value="${CH_PTS[k]}" style="width:90px" inputmode="decimal"></label>`).join('')}
        <div class="row"><button class="btn primary" type="submit">حفظ</button><button class="btn" type="button" id="cpDef">القيم الافتراضية (٣ · ١ · ٢ · خصم ١)</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`, (m) => {
      $('#cpDef', m).onclick = () => Object.entries(CH_DEFAULT_PTS).forEach(([k, v]) => ($('#cp_' + k, m).value = v));
      $('#cpF', m).onsubmit = async (e) => {
        e.preventDefault();
        const pts = { win: +$('#cp_win', m).value, lose: +$('#cp_lose', m).value, tie: +$('#cp_tie', m).value, cancel: +$('#cp_cancel', m).value };
        if (Object.values(pts).some((v) => !Number.isFinite(v) || v < 0 || v > 20)) return toast('اكتب أرقاماً من ٠ إلى ٢٠.');
        try { cfg = { ...cfg, pts }; await store.setChallengeCfg(cfg); setChPts(pts); closeModal(); schedulePublish(); toast('حُفظت نقاط التحدي، وستُحدَّث لوحة الشرف.'); drawBody(); }
        catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); }
      };
    });
  }

  /** تاريخ التحدي ووقته: «📅 الثلاثاء ١٧ نوفمبر · ٥:٥٣ ص» ومعه وقت انتهائه إن انتهى */
  const chEndAt = (c) => [c.ra?.at, c.rb?.at].filter(Boolean).sort().pop();
  const chWhenTxt = (c) => {
    const yr = (iso) => (new Date(iso).getUTCFullYear() !== new Date().getUTCFullYear() ? ` ${ar(new Date(iso).getUTCFullYear())}` : '');
    const t0 = Date.parse(c.createdAt || ''), e = chEndAt(c), t1 = e && c.ra?.at && c.rb?.at ? Date.parse(e) : 0;
    return `${t0 ? `📅 ${fmtWhen(t0)}${yr(c.createdAt)}` : ''}${t1 ? ` · ✅ انتهى ${riyadhDay(new Date(t1)) === riyadhDay(new Date(t0)) ? fmtWhen(t1).split('، ')[1] : fmtWhen(t1)}` : ''}`;
  };
  /** سجل التحديات كاملاً: كل الأشهر، مع تصفية بالشهر والصف والطالب، وتصدير Excel */
  function openChLog() {
    const L = (D.challenges || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const months = [...new Set(L.map((c) => (c.createdAt || '').slice(0, 7)).filter(Boolean))];
    const f = { ym: 'all', cls: 'all', q: '' };
    const rows = () => L.filter((c) => (f.ym === 'all' || (c.createdAt || '').startsWith(f.ym)) && (f.cls === 'all' || c.classId === f.cls)
      && (!f.q || [c.a.name, c.b.name, c.a.pn, c.b.pn].some((v) => (v || '').includes(f.q))));
    const pc = (r) => (r ? ar(r.p) + '٪' + (r.wpm ? ` · ${ar(r.wpm)} ك/د` : '') : '—');
    openModal(`<div class="stack" style="gap:10px"><h2 style="margin:0">📋 سجل تحدّي الزملاء</h2>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <select id="clM" style="flex:1 1 130px"><option value="all">كل الأشهر</option>${months.map((m) => `<option value="${m}">${esc(monthLabel(m))}</option>`).join('')}</select>
        <select id="clC" style="flex:1 1 130px"><option value="all">كل الصفوف</option>${D.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
        <input type="search" id="clQ" placeholder="اسم الطالب أو رقمه" style="flex:2 1 160px">
        <button class="btn sm" type="button" id="clX">تصدير Excel</button></div>
      <div id="clSum" class="small muted"></div><div id="clT" style="max-height:60vh;overflow:auto"></div>
      <div class="row"><button class="btn" type="button" data-close>إغلاق</button></div></div>`, (m) => {
      const paint = () => {
        const R = rows();
        const wins = {}; R.forEach((c) => { const w = chWinner(c); if (w && w !== 'tie') wins[w] = (wins[w] || 0) + 1; });
        const top = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pn, n]) => `${esc(stuName(pn))} (${ar(n)})`).join('، ');
        $('#clSum', m).innerHTML = `${ar(R.length)} ${R.length === 1 ? 'تحدٍّ' : 'تحديات'}${top ? ` · الأكثر فوزاً: ${top}` : ''}`;
        $('#clT', m).innerHTML = R.length ? `<ul class="ch-list">${R.map((c) => `<li><div><b>${esc(c.a.name)} ⚔️ ${esc(c.b.name)}</b><span class="small ch-when">${chWhenTxt(c)}</span><span class="small muted">${esc(c.className || className(c.classId) || '')} · ${esc(c.label || '')}</span><span class="small muted">${esc(c.a.name)}: ${pc(c.ra)} — ${esc(c.b.name)}: ${pc(c.rb)}</span></div><span class="small"><b>${esc(chResult(c))}</b></span></li>`).join('')}</ul>` : '<div class="empty">لا تحديات بهذه التصفية.</div>';
      };
      $('#clM', m).onchange = (e) => { f.ym = e.target.value; paint(); };
      $('#clC', m).onchange = (e) => { f.cls = e.target.value; paint(); };
      $('#clQ', m).oninput = (e) => { f.q = e.target.value.trim(); paint(); };
      const ptsOf = (c, pn) => chBonus([c]).filter((x) => x.pn === pn).reduce((k, x) => k + x.bonus, 0);
      $('#clX', m).onclick = () => {
        if (!window.XLSX) { toast('مكتبة Excel لم تُحمّل بعد. أعد المحاولة بعد لحظات.'); return; }
        const data = rows().map((c) => { const w = chWinner(c); return {
          'التاريخ': fmtDate(c.createdAt), 'الوقت': c.createdAt ? fmtWhen(Date.parse(c.createdAt)).split('، الساعة ')[1] : '', 'وقت الانتهاء': chEndAt(c) && c.ra?.at && c.rb?.at ? fmtWhen(Date.parse(chEndAt(c))) : '', 'الصف': c.className || className(c.classId) || '', 'المقطع': c.label || '',
          'الطالب الأول': c.a.name, 'رقمه': c.a.pn, 'دقته %': c.ra?.p ?? '', 'سرعته (كلمة/دقيقة)': c.ra?.wpm ?? '',
          'الطالب الثاني': c.b.name, 'رقمه ': c.b.pn, 'دقته % ': c.rb?.p ?? '', 'سرعته (كلمة/دقيقة) ': c.rb?.wpm ?? '',
          'النتيجة': chResult(c).replace('🏆 ', 'فاز: '), 'نقاط الأول': ptsOf(c, c.a.pn), 'نقاط الثاني': ptsOf(c, c.b.pn) }; });
        const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 16 }));
        const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, 'التحديات');
        XLSX.writeFile(wb, `تحديات-الزملاء-${f.ym === 'all' ? 'الكل' : f.ym}.xlsx`);
      };
      paint();
    });
  }

  /* --- نتائج الشهر --- */
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return ar(new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('ar', { month: 'long', year: 'numeric' })); };
  const prevYm = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
  async function checkMonthBar() {
    const ym = prevYm();
    const host = $('#monthBar', app); if (!host) return;
    if (CDCFG.v === undefined) return; // ينتظر تحميل إعداد الجولات
    if (CDCFG.v?.start) { paintRoundBar(); return; } // نظام الجولات: لا إعلان شهري
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
    return { ym: res.ym, name: st.name, title: w.title, line: w.line, rank: w.rank, month: res.label && /^جولة/.test(res.label) ? res.label : monthLabel(res.ym), points: r.points, className: className(st.classId), teacher: s.name || '', date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) };
  }
  async function openMonthReview(ym, per = null, onDone = null) {
    const res = computeMonth(boardSubs(), D.students, D.classes, ym, per);
    const inP = (x) => (per ? Date.parse(x.createdAt) >= Date.parse(per.from) && Date.parse(x.createdAt) < Date.parse(per.to) : (x.createdAt || '').slice(0, 7) === ym);
    const ungraded = D.subs.filter((x) => inP(x) && x.taskId && !x.teacher).length;
    let done = null; try { done = await store.getMonthResult(ym); } catch {}
    const isCur = !per && ym === new Date().toISOString().slice(0, 7);
    const winners = D.students.map((st) => certFor(res, st, res.ranks[st.id])).filter(Boolean);
    const row = (x, i) => `<li><span class="mr-n">${ar(i + 1)}</span><span>${esc(x.name)}</span><b class="num">${fmt10(x.points)}</b></li>`;
    openModal(`<div class="stack month-review">
      <h2>${per ? `🏁 نتائج ${esc(per.label)}` : `📅 نتائج شهر ${esc(monthLabel(ym))}`}</h2>
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
      $('#mrGo', m).onclick = async () => { const ok = await announceMonth(res, ym, per ? { label: per.label, from: per.from, to: per.to } : {}); if (ok) { closeModal(); onDone?.(); } };
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
  async function announceMonth(res, ym, opts = {}) {
    const label = opts.label || monthLabel(ym), items = [], ofL = opts.label ? label : `شهر ${label}`, inL = opts.label ? `في ${label}` : `لشهر ${label}`;
    if (!opts.silent && !(await confirmBox(`إعلان نتائج ${ofL} لكل الطلاب (${ar(D.students.length)})؟ يصل لكل طالب إشعار بنتيجته.`, 'أعلن النتائج'))) return false;
    const { ok, fail } = await runBulk('إعلان نتائج الشهر', D.students, async (st) => {
      const r = res.ranks[st.id] || { points: 0 };
      const w = monthTitle(r);
      const streak = await bestStreak(st, ym);
      const cp = res.classPos[st.classId] || null;
      const title = w ? (w.key === 'stage1' ? `👑 مبارك! أنت شيخ المرحلة ${inL}` : w.key === 'cls1' ? `🏆 مبارك! أنت قارئ الصف ${inL}` : `🏅 مبارك! ${w.title} ${inL}`) : `📊 نتائج ${ofL}`;
      const body = w ? `${w.line} بـ${fmt10(r.points)} نقطة. شهادة التقدير تنتظرك في المقرأة، فبارك الله فيك وزادك.`
        : r.points > 0 ? `ترتيبك ${ar(r.cls)} في صفك بـ${fmt10(r.points)} نقطة. ${opts.label ? 'الجولة الجديدة' : 'الشهر الجديد'} فرصة جديدة، وكل واجب ترفع به ترتيبك.`
        : `لم تُحسب لك نقاط ${opts.label ? 'في هذه الجولة' : 'هذا الشهر'}. ابدأ ${opts.label ? 'الجولة الجديدة' : 'الشهر الجديد'} بواجب واحد، وستجد اسمك في لوحة الشرف بإذن الله.`;
      const id = 'month-' + ym;
      await store.addStudentNotifId(st.id, id, { type: 'month', ym, label, round: !!opts.label, title, body, link: './#/student/month/' + ym, tag: id, r: { points: r.points, cls: r.cls || null, clsOf: r.clsOf || null, stage: r.stage || null, stageOf: r.stageOf || null }, classPos: cp, streak, win: w, teacher: s.name || '', className: className(st.classId) });
      items.push({ notif: id, student: st.id });
    });
    await store.saveMonthResult(ym, { ym, label, round: !!opts.label, from: opts.from || null, to: opts.to || null, stage: res.stage, byClass: res.byClass, challenge: res.challenge, announcedAt: new Date().toISOString(), teacher: s.name || '', students: ok, auto: !!opts.silent });
    let pushed = null;
    try { for (let i = 0; i < items.length; i += 200) { const r = await sendPushBatch(items.slice(i, i + 200)); if (r) pushed = { sent: (pushed?.sent || 0) + r.sent, deferred: (pushed?.deferred || 0) + (r.deferred || 0) }; } } catch (e) { console.warn(e); }
    toast(`أُعلنت نتائج ${label} لـ${nWord(ok, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}${pushed && pushed.sent ? `، ووصل إشعار إلى ${ar(pushed.sent)} جهازاً` : ''}${deferNote(pushed)}${fail ? `، وتعذر ${ar(fail)}` : ''}.`);
    checkMonthBar();
    if (tab === 'honor') drawBody();
    return true;
  }
  function mountCdT() { mountMonthCountdown($('#cdMonthT', app), { teacher: true, cfg: CDCFG.v, onEdit: editCountdown, onHonor: () => goTab('honor') }); }
/** المعلم يحدد يوم وتاريخ ووقت نهاية العد التنازلي (بتوقيت البحرين) وعنوانه */
  function editCountdown() {
    const cur = Date.parse(CDCFG.v?.end || ''), d = new Date((cur && cur > Date.now() ? cur : Date.now() + 7 * 864e5) + 3 * 3600e3);
    const val = d.toISOString().slice(0, 16);
    openModal(`<div class="stack"><h3 style="margin:0">⚙️ موعد إعلان الفائزين</h3>
      <p class="small muted" style="margin:0">اختر اليوم والتاريخ والوقت الذي ينتهي عنده العد التنازلي (بتوقيت البحرين). يراه الطلاب في صفحتهم فوراً.</p>
      <label class="field">التاريخ والوقت<input type="datetime-local" id="cdEnd" value="${val}" min="${new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16)}"></label>
      <p class="small" id="cdPrev" style="margin:0"></p>
      <label class="field">العنوان فوق العداد<input type="text" id="cdTitle" maxlength="60" value="${esc(CDCFG.v?.title || 'بقي حتى إعلان الفائزين')}"></label>
      <div class="cd-opts">
        <label class="ie-check"><input type="checkbox" id="cdAutoA" ${CDCFG.v?.auto ? 'checked' : ''}> <span><b>احسب الفائزين وأعلنهم تلقائياً عند انتهاء العداد</b><br><small class="muted">تُجمَّد النقاط عند الموعد بالضبط، ويُرسل لكل طالب إشعار بنتيجته وشهادته دون مراجعة منك. إن لم تحدده ظهر لك عند الموعد «راجع وأعلن».</small></span></label>
        <label class="ie-check"><input type="checkbox" id="cdReset" ${CDCFG.v && CDCFG.v.start && CDCFG.v.reset === false ? '' : 'checked'}> <span><b>صفّر النقاط بعد الإعلان وابدأ جولة جديدة</b><br><small class="muted">إن لم تحدده تستمر النقاط في التراكم بعد الإعلان حتى الموعد القادم.</small></span></label>
      </div>
      <p class="small" style="margin:0">📌 سيتم احتساب النقاط بعد انتهاء العداد مباشرة. وتُحفظ كل نتيجة مع فائزيها في «📚 أرشيف النتائج» (لوحة الشرف).</p>
      <p class="small muted" style="margin:0">تُحسب الجولة من ${esc(dShort(CDCFG.v?.start || new Date(thisMonthStart()).toISOString()))} حتى الموعد الذي تختاره.</p>
      <div class="row modal-actions"><button class="btn primary" type="button" id="cdSave">حفظ الموعد</button>${CDCFG.v?.start || CDCFG.v?.end ? '<button class="btn" type="button" id="cdAuto">↺ رجوع للنظام الشهري</button>' : ''}<button class="btn ghost" type="button" data-close>إلغاء</button></div></div>`, (m) => {
      const inp = $('#cdEnd', m), pv = () => { const t = Date.parse(inp.value + ':00+03:00'); $('#cdPrev', m).textContent = t ? `📅 ${fmtWhen(t)}` : ''; };
      inp.oninput = pv; pv();
      $('#cdSave', m).onclick = async () => {
        const t = Date.parse(inp.value + ':00+03:00');
        if (!t || t <= Date.now()) return toast('اختر موعداً في المستقبل.');
        const x = { end: new Date(t).toISOString(), title: $('#cdTitle', m).value.trim() || 'بقي حتى إعلان الفائزين', auto: $('#cdAutoA', m).checked, reset: $('#cdReset', m).checked, start: CDCFG.v?.start || new Date(thisMonthStart()).toISOString(), lastEnd: CDCFG.v?.lastEnd || '', lastKey: CDCFG.v?.lastKey || '' };
        try { await store.setCountdown(x); CDCFG.v = x; closeModal(); mountCdT(); lastBoardJson = ''; schedulePublish(); checkMonthBar(); toast(`حُفظ الموعد: ${fmtWhen(t)}${x.auto ? ' · يُعلن الفائزون تلقائياً' : ''}`); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
      };
      const a = $('#cdAuto', m); if (a) a.onclick = async () => {
        if (!(await confirmBox('الرجوع للنظام الشهري: تُحسب النقاط من أول الشهر الميلادي، ويُعلن الفائزون أول كل شهر بعد مراجعتك. نتائج الجولات السابقة تبقى في الأرشيف.', 'ارجع'))) return;
        try { await store.setCountdown({ end: '' }); CDCFG.v = null; closeModal(); mountCdT(); lastBoardJson = ''; schedulePublish(); checkMonthBar(); toast('رجع العداد إلى بداية الشهر القادم.'); } catch (e) { toast('تعذر: ' + (e.code || e.message)); }
      };
    });
  }

  /* --- الجولات: موعد يحدده المعلم يُحسب عنده الفائزون (ويُعلَنون تلقائياً إن اختار)، ثم تُصفَّر النقاط أو تكتمل --- */
  const dShort = (iso) => { const d = new Date(Date.parse(iso) + 3 * 3600e3); return `${ar(d.getUTCDate())} ${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][d.getUTCMonth()]}`; };
  const roundKey = (end) => 'r' + new Date(Date.parse(end) + 3 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const roundLabel = (c) => `جولة ${dShort(c.start)} – ${c.end ? dShort(c.end) : 'الآن'}`;
  /** فترة لوحة الشرف الحالية في نظام الجولات (وإلا null = الشهر الميلادي) */
  function roundPer(c = CDCFG.v) {
    if (!c?.start) return null;
    return { from: c.start, to: c.end || null, key: 'r-cur', label: c.end ? roundLabel(c) : `الجولة الحالية (منذ ${dShort(c.start)})` };
  }
  /** بعد إعلان الجولة: تبدأ جولة جديدة من موعد الانتهاء (تصفير) أو تكتمل النقاط */
  async function closeRound(c, key) {
    const next = { title: c.title, auto: !!c.auto, reset: c.reset !== false, start: c.reset !== false ? c.end : c.start, end: '', lastEnd: c.end, lastKey: key };
    await store.setCountdown(next); CDCFG.v = next;
    mountCdT();
    lastBoardJson = ''; schedulePublish(); paintRoundBar();
  }
  let roundBusy = false, roundT0 = Date.now();
  /** يُفحص كل ٣٠ ثانية: انتهى العداد؟ */
  async function roundTick() {
    const c = CDCFG.v, end = Date.parse(c?.end || '');
    if (!end || Date.now() < end || roundBusy || !c.start) return;
    if (D.challenges === undefined || D.seasons === undefined || D.khatmas === undefined || Date.now() - roundT0 < 15e3) return; // ننتظر تحميل كل مصادر النقاط
    roundBusy = true;
    try {
      const key = roundKey(c.end);
      if (await store.getMonthResult(key).catch(() => null)) { await closeRound(c, key); return; } // أعلنها جهاز آخر
      if (!c.auto) { paintRoundBar(); return; }
      const per = { from: c.start, to: c.end, label: roundLabel(c) };
      const res = computeMonth(boardSubs(), D.students, D.classes, key, per);
      const ok = await announceMonth(res, key, { label: per.label, silent: true, from: c.start, to: c.end });
      if (ok) { await closeRound(c, key); toast('🏆 انتهى العداد، فحُسبت النقاط وأُعلن الفائزون تلقائياً.'); }
    } catch (e) { console.warn('round', e); } finally { roundBusy = false; }
  }
  /** شريط «انتهت الجولة: راجع وأعلن» حين لا يكون الإعلان تلقائياً */
  function paintRoundBar() {
    const host = $('#monthBar', app); if (!host) return;
    const c = CDCFG.v, end = Date.parse(c?.end || '');
    if (!end || Date.now() < end || c.auto) { host.innerHTML = ''; return; }
    const key = roundKey(c.end), per = { from: c.start, to: c.end, label: roundLabel(c) };
    host.innerHTML = `<div class="month-bar"><span>⏰ <b>انتهى العداد، ونتائج ${esc(per.label)} جاهزة.</b> راجعها ثم أعلنها.</span><span class="row" style="gap:6px"><button class="btn sm primary" type="button" id="rbGo">راجع وأعلن</button></span></div>`;
    $('#rbGo', host).onclick = () => openMonthReview(key, per, async () => closeRound(c, key));
  }
  /* --- الشهادات: لكل مسابقة (الأشهر والجولات، والمواسم، والأبطال) أو كلها دفعة واحدة --- */
  function resultCerts(r) {
    const ranksOf = {};
    (r.stage || []).forEach((x, i) => ((ranksOf[x.id] = ranksOf[x.id] || { points: x.points }).stage = i + 1));
    Object.values(r.byClass || {}).forEach((a) => (a || []).forEach((x, i) => ((ranksOf[x.id] = ranksOf[x.id] || { points: x.points }).cls = i + 1)));
    const res = { ym: r.ym, label: r.round ? r.label : null };
    return D.students.map((st) => ranksOf[st.id] && certFor(res, st, ranksOf[st.id])).filter(Boolean);
  }
  function seasonCerts(x) {
    const [f, to] = seasonRange(x), res = computeRange(boardSubs(), D.students, D.classes, f, to);
    return D.students.map((st) => { const w = monthTitle(res.ranks[st.id]); return w && { ym: 'season-' + x.id, name: st.name, title: w.title, line: w.line, rank: w.rank, month: x.name, season: x.name, period: `في ${x.name}`, color: x.color, points: res.ranks[st.id].points, className: className(st.classId), teacher: s.name || '', date: ar(new Date(x.announcedAt || Date.now()).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })) }; }).filter(Boolean);
  }
  /** كل المسابقات المنتهية التي لها شهادات */
  async function allCompetitions() {
    let R = [];
    try { R = await store.listResults(); } catch (e) { console.warn('results', e); }
    if (D.tourneys === undefined) await loadHeroesT().catch(() => {});
    const out = R.map((r) => ({ kind: r.round ? 'round' : 'month', id: r.ym, icon: r.round ? '🏁' : '📅', label: r.round ? r.label : 'شهر ' + r.label, at: r.announcedAt, r, certs: () => resultCerts(r) }));
    (D.seasons || []).filter((x) => x.announcedAt).forEach((x) => out.push({ kind: 'season', id: x.id, icon: x.icon || '🏆', label: x.name, at: x.announcedAt, certs: () => seasonCerts(x) }));
    (D.tourneys || []).filter((x) => x.champion).forEach((x) => out.push({ kind: 'hero', id: x.id, icon: '⚔️', label: 'الأبطال: ' + x.name, at: x.doneAt || x.createdAt, certs: () => heroCerts(x) }));
    return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  async function downloadAllCerts(btn) {
    const t0 = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ الجمع…';
    try {
      const C = await allCompetitions(), all = C.flatMap((c) => c.certs());
      if (!all.length) { toast('لا شهادات بعد: أعلن نتائج شهر أو جولة أو موسم أولاً.'); return; }
      await downloadCertificatesPDF(all, 'maqraa-all-certificates.pdf', (i, n) => (btn.textContent = `جارٍ التجهيز ${ar(i)} من ${ar(n)}…`));
      toast(`حُمّلت ${ar(all.length)} شهادة من ${ar(C.length)} مسابقة.`);
    } catch (e) { toast('تعذر: ' + e.message); } finally { btn.disabled = false; btn.textContent = t0; }
  }
  /** الأرشيف: كل النتائج المعلنة مع فائزيها، وشهادات كل مسابقة أو كلها */
  async function openResultsArchive() {
    let C = [];
    try { C = await allCompetitions(); } catch (e) { return toast('تعذر التحميل: ' + (e.code || e.message)); }
    const top = (arr, n) => (arr || []).slice(0, n).map((x, i) => `${['🥇', '🥈', '🥉', '٤', '٥'][i]} ${esc(x.name)} <small class="muted">${fmt10(x.points)}</small>`).join(' · ');
    const total = C.reduce((n, c) => n + c.certs().length, 0);
    const group = (title, L) => L.length ? `<h4 style="margin:6px 0 0">${title}</h4>${L.map((c, i) => `<details class="arch-it"${i || title.includes('المواسم') || title.includes('الأبطال') ? '' : ' open'}><summary><b>${esc(c.icon)} ${esc(c.label)}</b> <span class="small muted">${c.at ? esc(fmtDate(c.at)) : ''}${c.r?.auto ? ' · تلقائياً' : ''} · ${ar(c.certs().length)} شهادة</span></summary>
        ${c.r ? `<div class="small"><b>👑 شيخ المرحلة:</b> ${top(c.r.stage, 5) || '—'}</div>${Object.entries(c.r.byClass || {}).filter(([, a]) => a?.length).map(([cid, a]) => `<div class="small"><b>🏆 ${esc(className(cid))}:</b> ${top(a, 3)}</div>`).join('')}${(c.r.challenge || []).length ? `<div class="small"><b>🏁 تحدي الصفوف:</b> ${c.r.challenge.slice(0, 3).map((x, k) => `${['🥇', '🥈', '🥉'][k]} ${esc(x.name)}`).join(' · ')}</div>` : ''}`
          : `<div class="small">${c.certs().map((x) => `${x.rank === 1 ? '🥇' : x.rank === 2 ? '🥈' : '🏅'} ${esc(x.name)} <small class="muted">${esc(x.title)}</small>`).join(' · ') || '—'}</div>`}
        <button class="btn sm" type="button" data-cert="${esc(c.kind + ':' + c.id)}" ${c.certs().length ? '' : 'disabled'}>🎓 شهادات هذه المسابقة (PDF)</button></details>`).join('')}` : '';
    openModal(`<div class="stack"><h2 style="margin:0">🎓 الشهادات والأرشيف</h2>
      <div class="row"><button class="btn gold" type="button" id="arAll" ${total ? '' : 'disabled'}>⬇️ كل الشهادات دفعة واحدة (${ar(total)})</button></div>
      ${C.length ? group('📅 الأشهر والجولات', C.filter((c) => c.kind === 'month' || c.kind === 'round')) + group('🏆 المواسم والمسابقات', C.filter((c) => c.kind === 'season')) + group('⚔️ الأبطال', C.filter((c) => c.kind === 'hero')) : '<p class="muted">لا نتائج معلنة بعد.</p>'}
      <div class="row"><button class="btn primary" type="button" data-close>إغلاق</button></div></div>`, (m) => {
      $('#arAll', m).onclick = (e) => downloadAllCerts(e.currentTarget);
      $$('[data-cert]', m).forEach((b) => (b.onclick = async () => {
        const c = C.find((x) => x.kind + ':' + x.id === b.dataset.cert); if (!c) return;
        const L = c.certs(); if (!L.length) return toast('لا فائزون في هذه المسابقة.');
        const t0 = b.textContent; b.disabled = true;
        try { await downloadCertificatesPDF(L, `certificates-${c.id}.pdf`, (i, n) => (b.textContent = `${ar(i)}/${ar(n)}…`)); } catch (x) { toast('تعذر: ' + x.message); }
        b.disabled = false; b.textContent = t0;
      }));
    });
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
      <div class="card stack" style="gap:10px"><h3>📲 إشعارات الطلاب على الجوال</h3><div id="pushStat" class="small muted">${pushConfigured() && PUSH.url ? 'جارٍ العدّ…' : '<span class="pill warn">غير مفعّلة</span> تظهر التنبيهات للطلاب داخل الموقع فقط. لتفعيل إشعارات الجوال ضع <code>vapidKey</code> و<code>url</code> في ملف js/firebase-config.js (راجع notify-service/README.md).'}</div></div>
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
  return { destroy: () => { unsub?.(); heroOffs.forEach((f) => f()); clearInterval(heroIv); clearTimeout(aiQT); projOff?.(); } };
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
