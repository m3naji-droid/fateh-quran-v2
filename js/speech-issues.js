// شكاوى التعرف على الكلام: الطالب يختار مشكلته بالضبط، ويُكتشف جهازه تلقائياً، ويُفحص الميكروفون والتعرف،
// وتظهر له حلول فورية بحسب مشكلته وجهازه. والمعلم يرى الإحصاءات (أكثر المشكلات والأجهزة) ويتابع كل شكوى.
import { openMic, isIOS, inAppBrowser } from './speech.js';
import { toArabicDigits as ar } from './quran.js';

const AR = (s) => String(s).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const ISSUE_TYPES = {
  perm: ['🚫', 'الميكروفون لا يفتح، أو يرفض الإذن'],
  nowords: ['🙊', 'يسجّل لكن لا تظهر الكلمات'],
  wrong: ['❌', 'يُخطئ في كلمات قرأتها صحيحة'],
  stops: ['⏹️', 'يتوقف التسجيل وحده أو ينقطع'],
  slow: ['🐢', 'الكلمات تظهر متأخرة جداً'],
  once: ['1️⃣', 'يعمل مرة واحدة ثم لا يسجّل'],
  error: ['⚠️', 'تظهر لي رسالة خطأ'],
  other: ['❓', 'مشكلة أخرى'],
};
export const WHERE = { tasmee: '📝 التسميع والواجبات', practice: '🎯 التدريب الحر', iqra: '📖 اقرأ وارتقِ', challenge: '⚔️ التحديات والمباريات' };
export const STATUS = { new: ['🆕', 'جديدة'], work: ['🛠️', 'قيد الحل'], solved: ['✅', 'حُلّت'] };
export const REASSURE = 'لا تقلق 🌿 سنعمل على حلّها قريباً بإذن الله. وتسجيلك في التسميع يصل إلى معلمك حتى لو لم يتعرف عليه النظام، فيسمعه بنفسه ويقيّمه.';

/* ---------------- اكتشاف الجهاز ---------------- */
export async function detectDevice() {
  const ua = navigator.userAgent || '';
  const d = { os: 'غير معروف', osv: '', model: '', browser: 'غير معروف', bv: '', app: false, inApp: inAppBrowser, sr: !!SR, rec: !!window.MediaRecorder, mime: '', lang: navigator.language || '', ua: ua.slice(0, 300) };
  d.app = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  let m;
  if (isIOS) { d.os = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPadOS' : 'iOS'; d.model = d.os === 'iOS' ? 'iPhone' : 'iPad'; if ((m = ua.match(/OS (\d+)[_.](\d+)/))) d.osv = m[1] + '.' + m[2]; else if ((m = ua.match(/Version\/(\d+(\.\d+)?)/))) d.osv = m[1]; }
  else if ((m = ua.match(/Android (\d+(\.\d+)?)/))) { d.os = 'Android'; d.osv = m[1]; const mm = ua.match(/Android [^;)]*;\s*([^;)]+?)(?:\s+Build|\))/); if (mm && !/^K$|wv/.test(mm[1])) d.model = mm[1].trim(); }
  else if (/Windows NT/.test(ua)) { d.os = 'Windows'; d.osv = (ua.match(/Windows NT (\d+\.\d+)/) || [])[1] || ''; }
  else if (/Mac OS X/.test(ua)) { d.os = 'macOS'; d.osv = ((ua.match(/Mac OS X (\d+[_.]\d+)/) || [])[1] || '').replace('_', '.'); }
  else if (/CrOS/.test(ua)) d.os = 'ChromeOS';
  else if (/Linux/.test(ua)) d.os = 'Linux';
  if ((m = ua.match(/SamsungBrowser\/(\d+)/))) { d.browser = 'Samsung Internet'; d.bv = m[1]; }
  else if ((m = ua.match(/Edg[A-Z]*\/(\d+)/))) { d.browser = 'Edge'; d.bv = m[1]; }
  else if ((m = ua.match(/OPR\/(\d+)/))) { d.browser = 'Opera'; d.bv = m[1]; }
  else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) { d.browser = 'Firefox'; d.bv = m[1]; }
  else if ((m = ua.match(/CriOS\/(\d+)/))) { d.browser = 'Chrome'; d.bv = m[1]; }
  else if ((m = ua.match(/Chrome\/(\d+)/))) { d.browser = 'Chrome'; d.bv = m[1]; }
  else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) { d.browser = 'Safari'; d.bv = m[1]; }
  if (inAppBrowser) d.browser = (ua.match(/WhatsApp|Instagram|Snapchat|Telegram|TikTok|FBAN|FBAV/) || ['تطبيق'])[0].replace(/FBA[NV]/, 'Facebook') + ' (متصفح داخلي)';
  // كروم أندرويد يعطي اسم الجهاز الدقيق وإصدار النظام عند الطلب
  try {
    const h = await navigator.userAgentData?.getHighEntropyValues?.(['model', 'platformVersion']);
    if (h?.model) d.model = h.model;
    if (h?.platformVersion && d.os === 'Android') d.osv = h.platformVersion.split('.').slice(0, 2).join('.').replace(/\.0$/, '');
  } catch {}
  if (window.MediaRecorder?.isTypeSupported) d.mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  return d;
}
const OS_AR = { iOS: 'آيفون', iPadOS: 'آيباد', Android: 'أندرويد', Windows: 'ويندوز', macOS: 'ماك', ChromeOS: 'كروم بوك', Linux: 'لينكس' };
/** وصف الجهاز بالعربية: «آيفون (iOS 17.4) · Safari 17 · التطبيق المثبّت» */
export function devLabel(d) {
  if (!d) return '—';
  const os = d.os === 'Android' && d.model ? `${d.model} (أندرويد ${d.osv})` : `${OS_AR[d.os] || d.os}${d.osv ? ` (${d.os} ${d.osv})` : ''}`;
  return `${os} · ${d.browser}${d.bv ? ' ' + d.bv : ''}${d.app ? ' · التطبيق المثبّت' : ''}`;
}
/** مجموعة للإحصاء: النظام + المتصفح + مثبّت أم لا */
export const devGroup = (d) => (d ? `${OS_AR[d.os] || d.os} · ${String(d.browser || '').replace(/ \(.*/, '')}${d.app ? ' · مثبّت' : ''}` : 'غير معروف');

/* ---------------- الفحص التلقائي ---------------- */
/** اختبار التعرف على الكلام لمدة ms: يعيد {sr, heard, errs, ev} */
function srTest(ms) {
  return new Promise((res) => {
    const out = { sr: '', heard: '', errs: [], ev: [] };
    let done = false; const fin = () => { if (done) return; done = true; try { s.abort(); } catch {} out.sr = out.heard ? 'ok' : out.errs.length ? 'error' : 'silent'; res(out); };
    const s = new SR(); s.lang = 'ar-SA'; s.continuous = true; s.interimResults = true;
    ['audiostart', 'soundstart', 'speechstart', 'nomatch'].forEach((k) => (s['on' + k] = () => { if (!out.ev.includes(k)) out.ev.push(k); }));
    s.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' '; out.heard = t.trim().slice(0, 120); };
    s.onerror = (e) => { out.errs.push(e.error); if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network'].includes(e.error)) fin(); };
    s.onend = () => setTimeout(fin, 50);
    try { s.start(); } catch (e) { out.errs.push('start:' + (e.name || 'err')); fin(); }
    setTimeout(() => { try { s.stop(); } catch {} setTimeout(fin, 1200); }, ms);
  });
}

/** فحص من ثلاث خطوات: التعرف وحده، ثم الميكروفون (إذن ومستوى وتسجيل)، ثم التعرف والميكروفون مفتوح معاً كما في التسميع */
export async function runDiag(onStep = () => {}, onLevel = () => {}) {
  const r = { at: new Date().toISOString(), perm: '', mic: '', peak: 0, bytes: 0, sr: '', heard: '', srErr: [], ev: [], sr2: '', heard2: '', ev2: [] };
  try { r.perm = (await navigator.permissions?.query({ name: 'microphone' }))?.state || ''; } catch { r.perm = 'unknown'; }
  const steps = SR ? 3 : 1;
  if (SR) {
    onStep(`١/${AR(steps)} · التعرف على الكلام: قل «بسم الله الرحمن الرحيم»…`);
    const t = await srTest(6000);
    Object.assign(r, { sr: t.sr, heard: t.heard, srErr: t.errs, ev: t.ev });
  } else r.sr = 'unsupported';
  onStep(`${SR ? '٢' : '١'}/${AR(steps)} · الميكروفون: تكلّم بأي كلام…`);
  let stream = null, ac = null;
  try {
    stream = await openMic();
    r.mic = 'ok';
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC(); try { await ac.resume(); } catch {}
    const an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let rec = null; const chunks = [];
    try { rec = new MediaRecorder(stream); rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data); rec.start(500); } catch (e) { r.recErr = e.name || 'err'; }
    let measuring = true;
    const tick = () => { if (!measuring) return; an.getByteTimeDomainData(buf); let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v - 128) / 128); r.peak = Math.max(r.peak, pk); onLevel(pk); requestAnimationFrame(tick); };
    tick();
    await new Promise((res) => setTimeout(res, 4000));
    // ٣) التعرف والميكروفون مفتوح (هكذا يعمل التسميع): بعض أجهزة أندرويد لا تعطي التعرف صوتاً حينها
    if (SR && r.sr === 'ok') {
      onStep(`٣/${AR(steps)} · كما في التسميع: قل «الحمد لله رب العالمين»…`);
      const t2 = await srTest(6000);
      Object.assign(r, { sr2: t2.sr, heard2: t2.heard, ev2: t2.ev, srErr2: t2.errs });
    }
    measuring = false;
    if (rec && rec.state !== 'inactive') await new Promise((res) => { rec.onstop = res; rec.stop(); setTimeout(res, 1500); });
    r.bytes = chunks.reduce((n, c) => n + c.size, 0);
    r.peak = Math.round(r.peak * 100) / 100;
  } catch (e) { r.mic = e?.name || 'Error'; }
  stream?.getTracks().forEach((t) => t.stop());
  try { ac?.close(); } catch {}
  onLevel(0); onStep('');
  return r;
}
/** نتيجة الفحص بكلام مفهوم: [{ok, t}] */
export function diagLines(r) {
  if (!r) return [];
  const L = [];
  if (r.mic === 'ok') {
    L.push({ ok: true, t: 'الميكروفون يفتح ✓' });
    L.push(r.peak >= 0.08 ? { ok: true, t: 'يسمع صوتك جيداً ✓' } : r.peak >= 0.02 ? { ok: false, t: 'صوتك يصل ضعيفاً جداً: قرّب الجوال من فمك' } : { ok: false, t: 'الميكروفون يفتح لكنه لا يلتقط أي صوت' });
    if (r.recErr || !r.bytes) L.push({ ok: false, t: 'التسجيل الصوتي لا يعمل على هذا المتصفح' });
  } else L.push({ ok: false, t: r.mic === 'NotAllowedError' || r.mic === 'SecurityError' ? 'إذن الميكروفون مرفوض' : r.mic === 'NotFoundError' ? 'لم يُعثر على ميكروفون في الجهاز' : r.mic === 'NotReadableError' ? 'الميكروفون مشغول بتطبيق آخر' : 'تعذّر فتح الميكروفون (' + r.mic + ')' });
  if (r.sr === 'ok') L.push({ ok: true, t: `التعرف على الكلام يعمل ✓ وسمع: «${r.heard}»` });
  else if (r.sr === 'unsupported') L.push({ ok: false, t: 'هذا المتصفح لا يدعم التعرف على الكلام' });
  else if (r.sr === 'silent') L.push({ ok: false, t: 'التعرف على الكلام لم يلتقط أي كلمة' });
  else L.push({ ok: false, t: 'التعرف على الكلام لا يعمل (' + (r.srErr || []).join('، ') + ')' });
  if (r.sr === 'silent' && !(r.ev || []).includes('soundstart')) L.push({ ok: false, t: 'خدمة التعرف لم تسمع أي صوت؛ غالباً خدمة الإدخال الصوتي في الجهاز ليست Google' });
  if (r.sr2 === 'ok') L.push({ ok: true, t: 'يعمل التعرف والتسجيل معاً ✓' });
  else if (r.sr2) L.push({ ok: false, t: 'التعرف يتوقف حين يكون التسجيل مفتوحاً (هذا ما يحدث في التسميع)' });
  return L;
}

/* ---------------- حلول فورية بحسب المشكلة والجهاز ---------------- */
export function tipsFor(type, d) {
  const ios = d?.os === 'iOS' || d?.os === 'iPadOS', and = d?.os === 'Android', app = d?.app, T = [];
  if (d?.inApp) T.push('أنت تفتح الموقع من داخل تطبيق (مثل واتساب). افتح الرابط في ' + (ios ? 'Safari' : 'Chrome') + ' مباشرة؛ المتصفح الداخلي لا يسمح بالميكروفون غالباً.');
  if (type === 'perm') {
    if (ios) T.push('الإعدادات ← Safari ← الميكروفون ← «سماح». ثم أغلق الموقع وافتحه من جديد.', 'إن ظهرت نافذة تطلب الإذن فاضغط «سماح».');
    else if (and) T.push('اضغط رمز القفل 🔒 بجانب عنوان الموقع ← الأذونات ← الميكروفون ← «سماح».', 'إعدادات الجوال ← التطبيقات ← Chrome ← الأذونات ← الميكروفون ← «سماح».');
    else T.push('اضغط رمز القفل 🔒 بجانب عنوان الموقع، واسمح بالميكروفون، ثم حدّث الصفحة.');
    T.push('أغلق أي تطبيق آخر يستعمل الميكروفون (مكالمة، تسجيل صوتي).');
  }
  if (type === 'nowords') {
    if (ios && app) T.push('في التطبيق المثبّت على آيفون لا تظهر الكلمات أثناء القراءة؛ هذا من آيفون نفسه. للمتابعة الحية افتح الموقع من Safari.');
    else if (ios) T.push('فعّل الإملاء: الإعدادات ← عام ← لوحة المفاتيح ← «تفعيل الإملاء»، وتأكد أن «Siri» مفعّل.');
    if (and) T.push('اجعل Google خدمة الإدخال الصوتي: الإعدادات ← التطبيقات ← التطبيقات الافتراضية ← «المساعد الرقمي والإدخال الصوتي» ← اختر Google. (في أجهزة تكنو وفيفو وأوبو يكون الافتراضي خدمة الشركة فلا يعمل التعرف).', 'حدّث تطبيقَي «Google» و«خدمات الكلام من Google» من متجر Play.', 'أضف العربية: الإعدادات ← النظام ← اللغات ← الكتابة الصوتية من Google ← اللغات ← العربية.');
    T.push('التعرف على الكلام يحتاج إنترنت؛ تأكد من الاتصال.');
  }
  if (type === 'wrong') T.push('اقرأ في مكان هادئ، وقرّب الجوال من فمك نحو شبر.', 'اقرأ بوضوح وبسرعة متوسطة، وقف قليلاً بين الآيات.', 'الأخطاء التي يظهرها النظام تقديرية؛ ومعلمك يسمع تسجيلك ويصحح الدرجة.');
  if (type === 'stops' && and) T.push('اجعل Chrome «بلا قيود» في البطارية: الإعدادات ← التطبيقات ← Chrome ← البطارية ← بلا قيود (أجهزة تكنو وشاومي توقف الميكروفون لتوفير الطاقة).');
  if ((type === 'once' || type === 'stops' || type === 'nowords') && and && d?.app) T.push('جرّب فتح الموقع من Chrome مباشرة بدل التطبيق المثبّت، وأخبرنا هل يختلف.');
  if (type === 'stops') T.push('لا تقفل الشاشة ولا تنتقل لتطبيق آخر أثناء التسجيل.', 'أوقف «توفير الطاقة» مؤقتاً؛ فهو يوقف الميكروفون في الخلفية.', 'تأكد من الإنترنت إن كانت الكلمات تتوقف.');
  if (type === 'slow') T.push('الإنترنت الضعيف يؤخر ظهور الكلمات؛ جرّب شبكة واي فاي.', 'أغلق التطبيقات المفتوحة الأخرى لتخفيف الجهاز.');
  if (type === 'once') T.push(ios ? 'أغلق التطبيق تماماً (اسحبه من قائمة التطبيقات المفتوحة) ثم افتحه.' : 'حدّث الصفحة ثم جرّب مرة أخرى.', 'تأكد من تحديث الموقع لآخر نسخة (زر التحديث ↻ أعلى الصفحة).');
  if (type === 'error') T.push('اقرأ نص الرسالة جيداً؛ كثير منها يذكر الحل. واختر نوعها هنا ليصلنا بالضبط.');
  if (!T.length) T.push('جرّب تحديث الصفحة، ثم أعد المحاولة.');
  return T;
}

/* ---------------- تقرير تقني لنسخه ---------------- */
export function techReport(L) {
  const by = (f) => { const o = {}; L.forEach((x) => { const k = f(x); o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const lines = ['# تقرير شكاوى التعرف على الكلام — مقرأة الفاتح', `عدد الشكاوى: ${L.length} (مفتوحة ${L.filter((x) => x.status !== 'solved').length})`, '',
    '## حسب المشكلة', ...by((x) => ISSUE_TYPES[x.type]?.[1] || x.type).map(([k, n]) => `- ${k}: ${n}`), '',
    '## حسب الجهاز', ...by((x) => devGroup(x.dev)).map(([k, n]) => `- ${k}: ${n}`), '',
    '## حسب المكان', ...by((x) => WHERE[x.where] || x.where || '—').map(([k, n]) => `- ${k}: ${n}`), '',
    '## آخر الشكاوى (بلا أسماء)'];
  L.slice(0, 40).forEach((x) => {
    const g = x.diag;
    lines.push(`- ${(x.createdAt || '').slice(0, 10)} | ${x.type} | ${x.where || '—'} | ${STATUS[x.status || 'new']?.[1]} | ${devLabel(x.dev)} | sr=${x.dev?.sr ? 1 : 0} rec=${x.dev?.rec ? 1 : 0} mime=${x.dev?.mime || '—'}`
      + (g ? ` | diag: perm=${g.perm} mic=${g.mic} peak=${g.peak} bytes=${g.bytes} sr=${g.sr}${g.ev?.length ? ' ev=' + g.ev.join(',') : ''}${g.srErr?.length ? ' err=' + g.srErr.join(',') : ''}${g.sr2 ? ' sr+mic=' + g.sr2 + (g.ev2?.length ? ' ev2=' + g.ev2.join(',') : '') + (g.srErr2?.length ? ' err2=' + g.srErr2.join(',') : '') : ''}` : ' | بلا فحص')
      + (x.text ? ` | «${String(x.text).replace(/\s+/g, ' ').slice(0, 160)}»` : '') + (x.dev?.ua ? `\n  UA: ${x.dev.ua}` : ''));
  });
  return lines.join('\n');
}

/* ---------------- نافذة الطالب ---------------- */
/**
 * المربع المميز في الشاشة الرئيسية + نافذة الشكوى.
 * ctx: { me, cls, store, openModal, closeModal, toast }
 */
export function mountIssueTile(host, ctx) {
  let mine = [];
  const paint = () => {
    const open = mine.filter((x) => x.status !== 'solved').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    const solved = mine.find((x) => x.status === 'solved' && !x.solvedSeen);
    host.innerHTML = `<button type="button" class="sp-tile${solved ? ' solved' : ''}" id="spTile">
      <span class="sp-ic" aria-hidden="true">${solved ? '✅' : '🎙️'}</span>
      <b>${solved ? 'حُلّت مشكلتك!' : 'لا يتعرف على كلامك؟'}</b>
      <span>${solved ? 'جرّب التسميع الآن، وأخبرنا إن بقيت' : open ? `شكواك ${STATUS[open.status || 'new'][1] === 'جديدة' ? 'وصلت' : 'قيد الحل'} ⏳` : 'أخبرنا بالمشكلة لنحلّها'}</span>
    </button>`;
    host.querySelector('#spTile').onclick = () => {
      if (solved) { solved.solvedSeen = true; ctx.store.updateSpeechIssue(ctx.me.id, solved.id, { solvedSeen: true }).catch(() => {}); paint(); }
      openForm();
    };
  };
  const load = () => ctx.store.listMySpeechIssues(ctx.me.id).then((L) => { mine = L; if (host.isConnected) paint(); }).catch(() => {});
  paint(); load();

  async function openForm() {
    const dev = await detectDevice();
    let type = '', where = '', diag = null, testing = false, nudged = false;
    ctx.openModal(`<div class="stack sp-modal">
      <h2>🎙️ مشكلة في التعرف على الكلام</h2>
      <p class="sp-calm">${esc(REASSURE)}</p>
      <div><b>١. ما المشكلة بالضبط؟</b><div class="sp-chips" role="radiogroup" id="spT">${Object.entries(ISSUE_TYPES).map(([k, [i, t]]) => `<button type="button" class="sp-chip" role="radio" aria-checked="false" data-t="${k}">${i} ${esc(t)}</button>`).join('')}</div></div>
      <div id="spTips" hidden></div>
      <label class="field" id="spTxtW" hidden>اكتب المشكلة باختصار<textarea id="spTxt" rows="3" maxlength="400" placeholder="مثلاً: نص الرسالة التي ظهرت، أو ما يحدث بالضبط"></textarea></label>
      <div><b>٢. أين حدثت؟</b><div class="sp-chips" role="radiogroup" id="spW">${Object.entries(WHERE).map(([k, t]) => `<button type="button" class="sp-chip" role="radio" aria-checked="false" data-w="${k}">${esc(t)}</button>`).join('')}</div></div>
      <div class="sp-box"><b>٣. جهازك</b> <span class="small muted">(عُرف تلقائياً)</span><p style="margin:6px 0">📱 ${esc(devLabel(dev))}</p>
        <label class="small"><input type="checkbox" id="spOk" checked> أوافق على إرسال نوع جهازي ومتصفحي؛ لنعرف أكثر الأجهزة التي تظهر فيها المشكلة ونحلّها.</label></div>
      <div class="sp-box"><b>٤. فحص سريع</b> <span class="small muted">(نحو ١٦ ثانية، يساعدنا كثيراً)</span>
        <p class="small" style="margin:6px 0">يفحص الميكروفون ثم التعرف على الكلام. اتبع ما يظهر لك.</p>
        <div class="row"><button class="btn" type="button" id="spDiag">🔍 ابدأ الفحص</button><span class="small" id="spStep"></span></div>
        <div class="iq-level" id="spLvW" hidden><i id="spLv"></i></div>
        <ul class="sp-res" id="spRes"></ul></div>
      <div class="notice" id="spErr" hidden></div>
      <div class="row"><button class="btn primary" type="button" id="spSend">إرسال الشكوى</button><button class="btn" type="button" data-close>إلغاء</button></div>
    </div>`, (m) => {
      const $ = (s) => m.querySelector(s);
      const pick = (sel, attr, set) => m.querySelectorAll(sel).forEach((b) => (b.onclick = () => { m.querySelectorAll(sel).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); set(b.dataset[attr]); }));
      pick('[data-t]', 't', (v) => {
        type = v;
        $('#spTxtW').hidden = !(v === 'other' || v === 'error');
        const T = tipsFor(v, dev);
        $('#spTips').hidden = false;
        $('#spTips').innerHTML = `<div class="sp-tips"><b>💡 جرّب هذا الآن، فقد يحلّها فوراً:</b><ol>${T.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><span class="small muted">إن لم تُحلّ، أكمل وأرسل الشكوى.</span></div>`;
      });
      pick('[data-w]', 'w', (v) => (where = v));
      $('#spDiag').onclick = async () => {
        if (testing) return; testing = true;
        const b = $('#spDiag'); b.disabled = true; $('#spLvW').hidden = false; $('#spRes').innerHTML = '';
        diag = await runDiag((t) => ($('#spStep').textContent = t), (l) => { const e = $('#spLv'); if (e) e.style.width = Math.round(l * 100) + '%'; });
        if (!m.isConnected) return;
        $('#spLvW').hidden = true; b.disabled = false; b.textContent = '↺ أعد الفحص'; testing = false;
        $('#spRes').innerHTML = diagLines(diag).map((x) => `<li class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '✗'} ${esc(x.t)}</li>`).join('');
      };
      $('#spSend').onclick = async () => {
        const err = $('#spErr'); err.hidden = true;
        const text = ($('#spTxt').value || '').trim();
        if (!type) { err.hidden = false; err.textContent = 'اختر نوع المشكلة أولاً.'; return; }
        if (!where) { err.hidden = false; err.textContent = 'اختر أين حدثت المشكلة.'; return; }
        if (type === 'other' && text.length < 3) { err.hidden = false; err.textContent = 'اكتب المشكلة باختصار.'; return; }
        if (testing) { err.hidden = false; err.textContent = 'انتظر حتى ينتهي الفحص.'; return; }
        if (!diag && !nudged) { nudged = true; err.hidden = false; err.textContent = '🔍 الفحص السريع يساعدنا كثيراً في معرفة السبب. اضغط «ابدأ الفحص» أولاً، أو اضغط «إرسال» مرة أخرى للإرسال بدونه.'; $('#spDiag').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        const btn = $('#spSend'); btn.disabled = true;
        const f = { name: ctx.me.name || '', classId: ctx.me.classId || '', className: ctx.cls?.name || '', type, where, text, status: 'new',
          dev: $('#spOk').checked ? dev : null, diag: diag || null };
        try {
          const id = await ctx.store.addSpeechIssue(ctx.me.id, f);
          mine.push({ ...f, id, pn: ctx.me.id, createdAt: new Date().toISOString() });
          paint();
          m.innerHTML = `<div class="stack" style="text-align:center;align-items:center">
            <div style="font-size:48px">🤝</div><h2>وصلت شكواك، جزاك الله خيراً</h2>
            <p class="sp-calm" style="text-align:start">${esc(REASSURE)}</p>
            <p class="small muted" style="margin:0">سيظهر لك هنا حين تُحلّ، ويصلك تنبيه بإذن الله.</p>
            <button class="btn primary" type="button" data-close>حسناً</button></div>`;
        } catch (e) { btn.disabled = false; err.hidden = false; err.textContent = 'تعذّر الإرسال: ' + (e.code || e.message); }
      };
    });
  }
  return { reload: load };
}

/* ---------------- لوحة المعلم ---------------- */
/** ctx: { store, toast, confirmBox, notify(pn, issue) , classes, onCount(n) } */
export function drawIssuesTeacher(host, L, ctx, f = { status: 'open', type: 'all', dev: 'all' }) {
  const by = (fn, list = L) => { const o = {}; list.forEach((x) => { const k = fn(x); o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const bars = (rows, total, label = (k) => k) => rows.length ? `<ul class="sp-bars">${rows.map(([k, n]) => `<li><span>${esc(label(k))}</span><i style="--w:${Math.round((n / total) * 100)}%"></i><b>${ar(n)}</b></li>`).join('')}</ul>` : '<p class="small muted">—</p>';
  const open = L.filter((x) => x.status !== 'solved');
  const V = L.filter((x) => (f.status === 'all' || (f.status === 'open' ? x.status !== 'solved' : x.status === f.status)) && (f.type === 'all' || x.type === f.type) && (f.dev === 'all' || devGroup(x.dev) === f.dev));
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
  host.innerHTML = `<div class="stack">
    <div class="row" style="justify-content:space-between"><div><h2 style="margin:0">🎙️ شكاوى التعرف على الكلام</h2><p class="small muted" style="margin:4px 0 0">يرسلها الطلاب من مربع «لا يتعرف على كلامك؟» في صفحتهم، مع نوع الجهاز ونتيجة فحص الميكروفون.</p></div>
      <button class="btn" type="button" id="spRep" ${L.length ? '' : 'disabled'}>📋 نسخ تقرير تقني لـ Claude</button></div>
    ${L.length ? `<div class="sp-stats">
      <div class="card"><b>حسب المشكلة</b>${bars(by((x) => x.type, open.length ? open : L), (open.length ? open : L).length, (k) => (ISSUE_TYPES[k] || ['', k]).join(' '))}</div>
      <div class="card"><b>حسب الجهاز</b>${bars(by((x) => devGroup(x.dev), open.length ? open : L), (open.length ? open : L).length)}</div>
      <div class="card"><b>حسب المكان</b>${bars(by((x) => x.where || '—', open.length ? open : L), (open.length ? open : L).length, (k) => WHERE[k] || k)}</div>
    </div><p class="small muted" style="margin:0">الإحصاءات للشكاوى المفتوحة (${ar(open.length)} من ${ar(L.length)}).</p>` : ''}
    <div class="row">
      <select id="spfS" style="flex:1 1 130px">${opt('open', 'المفتوحة', f.status)}${opt('all', 'كل الحالات', f.status)}${Object.entries(STATUS).map(([k, [i, t]]) => opt(k, `${i} ${t}`, f.status)).join('')}</select>
      <select id="spfT" style="flex:1 1 160px">${opt('all', 'كل المشكلات', f.type)}${Object.entries(ISSUE_TYPES).map(([k, [i, t]]) => opt(k, `${i} ${t}`, f.type)).join('')}</select>
      <select id="spfD" style="flex:1 1 160px">${opt('all', 'كل الأجهزة', f.dev)}${by((x) => devGroup(x.dev)).map(([k]) => opt(k, k, f.dev)).join('')}</select>
    </div>
    ${V.length ? `<ul class="fb-list">${V.map((x) => `<li class="fb-item${x.status === 'new' || !x.status ? ' new' : ''}" data-sp="${esc(x.pn)}|${esc(x.id)}">
      <div class="row" style="justify-content:space-between;gap:8px"><div class="row" style="gap:8px"><span class="pill">${(ISSUE_TYPES[x.type] || ['❓', x.type]).join(' ')}</span><b>${esc(x.name || 'طالب')}</b><span class="small muted">${esc(x.className || '')}</span></div>
        <small class="muted">${esc((x.createdAt || '').slice(0, 10))}</small></div>
      <div class="small">📍 ${esc(WHERE[x.where] || x.where || '—')} · 📱 ${esc(x.dev ? devLabel(x.dev) : 'لم يسمح بإرسال جهازه')}</div>
      ${x.text ? `<p class="fb-text">${esc(x.text)}</p>` : ''}
      ${x.diag ? `<ul class="sp-res">${diagLines(x.diag).map((d) => `<li class="${d.ok ? 'ok' : 'bad'}">${d.ok ? '✓' : '✗'} ${esc(d.t)}</li>`).join('')}</ul>` : '<span class="small muted">بلا فحص</span>'}
      <div class="row fb-acts"><select data-st aria-label="حالة الشكوى">${Object.entries(STATUS).map(([k, [i, t]]) => opt(k, `${i} ${t}`, x.status || 'new')).join('')}</select><button class="btn sm danger" type="button" data-del>حذف</button></div>
    </li>`).join('')}</ul>` : `<div class="empty">${L.length ? 'لا شكاوى بهذه الاختيارات.' : 'لم تصل شكاوى بعد. الحمد لله.'}</div>`}
  </div>`;
  const redraw = () => drawIssuesTeacher(host, L, ctx, f);
  host.querySelector('#spfS').onchange = (e) => { f.status = e.target.value; redraw(); };
  host.querySelector('#spfT').onchange = (e) => { f.type = e.target.value; redraw(); };
  host.querySelector('#spfD').onchange = (e) => { f.dev = e.target.value; redraw(); };
  const rep = host.querySelector('#spRep');
  if (rep) rep.onclick = async () => {
    const t = techReport([...L].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    try { await navigator.clipboard.writeText(t); ctx.toast('نُسخ التقرير. الصقه في محادثتك مع Claude ليصلح أكثر المشكلات تكراراً.'); }
    catch { ctx.openModal(`<div class="stack"><h3>انسخ التقرير</h3><textarea rows="14" style="direction:rtl" readonly>${esc(t)}</textarea><button class="btn" type="button" data-close>إغلاق</button></div>`, (m) => m.querySelector('textarea').select()); }
  };
  host.querySelectorAll('[data-sp]').forEach((li) => {
    const [pn, id] = li.dataset.sp.split('|');
    const x = L.find((y) => y.pn === pn && y.id === id);
    li.querySelector('[data-st]').onchange = async (e) => {
      const st = e.target.value, patch = { status: st, ...(st === 'solved' ? { solvedAt: new Date().toISOString(), solvedSeen: false } : {}) };
      try {
        await ctx.store.updateSpeechIssue(pn, id, patch); Object.assign(x, patch);
        let msg = 'حُدّثت الحالة.';
        if (st === 'solved') { const r = await ctx.notify(pn, x).catch(() => null); msg = 'حُدّثت الحالة، ' + (r?.sent ? 'ووصل الطالبَ إشعارٌ على جواله.' : 'ويظهر للطالب أن مشكلته حُلّت.'); }
        ctx.toast(msg); ctx.onCount?.(); redraw();
      } catch (err) { ctx.toast('تعذّر الحفظ: ' + (err.code || err.message)); e.target.value = x.status || 'new'; }
    };
    li.querySelector('[data-del]').onclick = async () => {
      if (!(await ctx.confirmBox(`حذف شكوى ${x.name || 'الطالب'}؟`))) return;
      try { await ctx.store.deleteSpeechIssue(pn, id); L.splice(L.indexOf(x), 1); ctx.onCount?.(); redraw(); } catch (err) { ctx.toast('تعذّر الحذف: ' + (err.code || err.message)); }
    };
  });
}
