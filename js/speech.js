// التسجيل الصوتي + التعرف على الكلام مباشرة مع إعادة التشغيل التلقائي ومقياس مستوى الصوت
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const hasRecognition = !!SR;
export const hasRecorder = typeof window !== 'undefined' && !!(navigator.mediaDevices && window.MediaRecorder);

const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
export const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
/** متصفح داخل تطبيق (واتساب، إنستغرام، تيليجرام، سناب…): غالباً بلا ميكروفون ولا تعرف على الكلام */
export const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|Snapchat|WhatsApp|Telegram|TikTok|musical_ly|\bwv\)|; wv\b|GSA\//.test(UA);
const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
const openHint = isIOS ? 'افتح رابط المقرأة في Safari' : 'افتح رابط المقرأة في Chrome';

/** رسالة واضحة لسبب تعذّر فتح الميكروفون، بحسب نوع الخطأ والجهاز */
export function micErrorText(e) {
  const n = e?.name || '';
  if (!navigator.mediaDevices?.getUserMedia) return inAppBrowser ? `هذا المتصفح داخل تطبيق (مثل واتساب) ولا يسمح بالميكروفون. ${openHint} مباشرةً ثم أعد المحاولة.` : `متصفحك لا يسمح بالميكروفون. ${openHint} حديثاً.`;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError')
    return isIOS ? 'لم يُسمح باستخدام الميكروفون. من «الإعدادات» ← Safari ← الميكروفون اختر «اسمح»، أو اضغط «aA» في شريط العنوان ← إعدادات موقع الويب ← الميكروفون ← اسمح، ثم أعد تحميل الصفحة.'
      : 'لم يُسمح باستخدام الميكروفون. اضغط رمز القفل 🔒 بجانب عنوان الموقع ← الأذونات ← الميكروفون ← اسمح، ثم أعد تحميل الصفحة.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return 'لم يُعثر على ميكروفون في هذا الجهاز. صِل سماعة بميكروفون أو استخدم جوالاً.';
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'الميكروفون مشغول بتطبيق آخر (مكالمة، أو تسجيل، أو تبويب آخر مفتوح فيه المقرأة). أغلقه ثم أعد المحاولة.';
  return 'تعذّر تشغيل الميكروفون. أعد تحميل الصفحة ثم حاول مرة أخرى.';
}

/** يفتح الميكروفون بإعدادات الجودة، ويتراجع إلى الإعداد البسيط إن رفضها الجهاز، ويعيد المحاولة مرة إن كان مشغولاً للحظة */
export async function openMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(micErrorText(null));
  const best = { audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true, sampleRate: { ideal: 48000 } } };
  const tries = [best, { audio: true }, { audio: true }];
  let last;
  for (let i = 0; i < tries.length; i++) {
    try { return await navigator.mediaDevices.getUserMedia(tries[i]); }
    catch (e) {
      last = e;
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || e?.name === 'NotFoundError') break;
      if (i === 1) await new Promise((r) => setTimeout(r, 600)); // مشغول لحظة بعد تسجيل سابق
    }
  }
  const err = new Error(micErrorText(last)); err.code = last?.name || 'mic'; throw err;
}

/** رسالة حين لا يلتقط التعرف الفوري أي كلام (يسجّل الصوت لكن لا تظهر الكلمات) */
export const SILENT_MSG = () => (/Android/.test(navigator.userAgent)
  ? 'التعرف الفوري لا يلتقط كلامك على هذا الجهاز. لا تقلق: تسميعك يُسجَّل ويصل إلى معلمك فيسمعه ويقيّمه. ولتشغيله: الإعدادات ← التطبيقات ← التطبيقات الافتراضية ← «الإدخال الصوتي» أو «المساعد الرقمي» ← اختر Google، ثم حدّث تطبيق «خدمات الكلام من Google» من المتجر.'
  : 'التعرف الفوري لا يلتقط كلامك على هذا الجهاز. لا تقلق: تسميعك يُسجَّل ويصل إلى معلمك فيسمعه ويقيّمه.');
/* ---------- أجهزة لا تجمع التسجيل والتعرف معاً ----------
   بعض الأجهزة (مثل أجهزة أندرويد القديمة واللوحية الرخيصة) يعمل فيها التعرف على الكلام وحده، ويعمل التسجيل وحده،
   لكن إذا فُتحا معاً لم يصل التعرفَ أي صوت. يكتشف الموقع ذلك ويحفظه في الجهاز:
   noDual: الجهاز لا يجمعهما · srOk: التعرف وحده نجح هنا من قبل · tryNoDual: جرّب التعرف وحده في المرة القادمة لنعرف */
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
export const devCaps = {
  get noDual() { return lsGet('fp_noDual') === '1'; },
  get tryNoDual() { return lsGet('fp_tryNoDual') === '1'; },
  get srOk() { return lsGet('fp_srOk') === '1'; },
  setNoDual(v) { lsSet('fp_noDual', v ? '1' : null); lsSet('fp_tryNoDual', null); },
  setTry(v) { lsSet('fp_tryNoDual', v ? '1' : null); },
  setSrOk() { lsSet('fp_srOk', '1'); },
};

export class RecitationSession {
  // stream/ac: ميكروفون وسياق صوتي مشتركان يُعاد استعمالهما ولا يُغلقان هنا. noSR: بلا تعرف على الكلام
  // noRec: تعرف على الكلام فقط بلا تسجيل ولا ميكروفون من الموقع (للأجهزة التي لا تجمعهما)
  constructor({ onTranscript, onLevel, onError, onTick, maxSeconds = 300, stream = null, ac = null, noSR = false, noRec = false } = {}) {
    this.extStream = stream; this.extAc = ac; this.noSR = noSR; this.noRec = noRec && !!SR;
    this.onTranscript = onTranscript || (() => {});
    this.onLevel = onLevel || (() => {});
    this.onError = onError || (() => {});
    this.onTick = onTick || (() => {});
    this.onAutoStop = null;
    this.maxSeconds = maxSeconds;
    this.finalText = '';
    this.interim = '';
    this.active = false;
  }

  get transcript() { return (this.finalText + ' ' + this.interim).trim(); }

  async start() {
    this.finalText = '';
    this.interim = '';
    this.lastFinal = '';
    this.diag = { sr: !!SR, restarts: 0, errs: [], finals: 0, dups: 0, results: 0, voiced: 0, ev: [] };
    this.chunks = [];
    this.active = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    if (this.noRec) return this._startNoRec();
    try {
      // صوت خام قدر الإمكان: كبت الضوضاء وإلغاء الصدى يشوّهان الغنة والمدود فيضعف حكم التحليل الآلي
      this.stream = this.extStream || await openMic();
    } catch (e) {
      this.active = false;
      throw e;
    }
    // أُلغي التسجيل أثناء انتظار إذن الميكروفون (ضغطة ثانية أو مغادرة الصفحة): نغلق الميكروفون فوراً
    if (this.cancelled) { this.stream.getTracks().forEach((t) => t.stop()); this.active = false; const err = new Error('أُلغي التسجيل.'); err.code = 'cancelled'; throw err; }
    this.startedAt = Date.now();
    // انقطع الميكروفون أثناء التسجيل (مكالمة واردة، أو الخروج من التطبيق في آيفون)
    this.stream.getAudioTracks().forEach((t) => (t.onended = () => { if (this.active) { this.onError('انقطع الميكروفون (ربما مكالمة أو خروج من الصفحة). أُوقف التسجيل، فأعد المحاولة.'); this.stop(); this.onAutoStop && this.onAutoStop(); } }));
    // جودة أعلى للكلام (٣٢ كيلوبت/ث، ضعف وضوح الإعداد السابق تقريباً) ليكون التحليل الآلي أدق
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const opts = mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 };
    this.rec = new MediaRecorder(this.stream, opts);
    this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.rec.start(500);

    // مقياس مستوى الصوت
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = this.extAc || new AC();
      // يبدأ موقوفاً في بعض المتصفحات فيبقى مقياس الصوت ساكناً كأن الميكروفون لا يعمل
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      const src = this.ac.createMediaStreamSource(this.stream); this.src = src;
      const an = this.ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      let lastT = performance.now();
      const loop = () => {
        if (!this.active) return;
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) * (v - 128);
        const lvl = Math.min(1, Math.sqrt(sum / data.length) / 40);
        this.onLevel(lvl);
        const now = performance.now(), dt = Math.min(200, now - lastT); lastT = now;
        if (lvl > 0.18) this.diag.voiced += dt;
        this._checkSilentSR();
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {}

    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      this.onTick(s);
      if (s >= this.maxSeconds) { this.reason = 'max'; this.stop(); this.onAutoStop && this.onAutoStop(); }
    }, 250);

    if (SR && !this.noSR) this._startRecognition();
  }
  /** تعرف فقط: لا ميكروفون من الموقع ولا تسجيل، فتأخذ خدمة التعرف الميكروفون وحدها */
  _startNoRec() {
    this.diag.noRec = 1;
    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      this.onTick(s);
      // نبض بسيط لزر الميكروفون حين تصل كلمات
      this.onLevel(this.diag.results && Date.now() - (this.lastRes || 0) < 600 ? 0.6 : 0.15);
      // تجربة: ٢٠ ثانية بلا أي كلمة حتى والتعرف وحده يعمل → المشكلة في خدمة التعرف نفسها لا في جمعه مع التسجيل
      if (devCaps.tryNoDual && !this.diag.results && s >= 20 && !this.silentWarned) { this.silentWarned = true; devCaps.setTry(false); this.diag.silent = true; this.onError(SILENT_MSG()); }
      if (s >= this.maxSeconds) { this.reason = 'max'; this.stop(); this.onAutoStop && this.onAutoStop(); }
    }, 250);
    this._startRecognition();
  }
  /** الطالب يتكلم بوضوح (٨ ثوانٍ من الصوت) والتعرف لم يُرجع شيئاً ولا خطأ: التعرف «صامت» على هذا الجهاز */
  _checkSilentSR() {
    if (this.silentWarned || !this.recog || this.srDead || this.diag.results > 0 || this.diag.voiced < 8000) return;
    this.silentWarned = true; this.diag.silent = true;
    try { localStorage.setItem('fp_srSilent', String(Date.now())); } catch {}
    // إن كان التعرف وحده قد نجح هنا من قبل، فالجهاز لا يجمع التسجيل والتعرف؛ وإلا نجرّب التعرف وحده في المرة القادمة
    if (devCaps.srOk) devCaps.setNoDual(true); else devCaps.setTry(true);
    this.onError(SILENT_MSG());
  }
  _release() {
    if (!this.extStream) this.stream?.getTracks().forEach((t) => t.stop());
    try { this.src?.disconnect(); } catch {}
    if (!this.extAc) try { if (this.ac && this.ac.state !== 'closed') this.ac.close(); } catch {}
  }

  _startRecognition() {
    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    ['audiostart', 'soundstart', 'speechstart', 'nomatch'].forEach((k) => (r['on' + k] = () => { if (this.diag.ev.length < 12 && !this.diag.ev.includes(k)) this.diag.ev.push(k); }));
    r.onresult = (e) => {
      this.diag.results++; this.lastRes = Date.now();
      if (this.diag.results === 1) { if (this.noRec) { devCaps.setSrOk(); if (devCaps.tryNoDual) devCaps.setNoDual(true); } else if (this.stream) devCaps.setNoDual(false); }
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) this._addFinal(res[0].transcript);
        else interim += ' ' + res[0].transcript;
      }
      this.interim = interim.trim();
      this.onTranscript(this.transcript);
    };
    r.onerror = (e) => {
      if (this.diag && this.diag.errs.length < 12) this.diag.errs.push(e.error);
      // أخطاء لا ينفع معها إعادة التشغيل: نتوقف عن المحاولة ويكمل التسجيل الصوتي وحده
      if (['not-allowed', 'service-not-allowed', 'language-not-supported'].includes(e.error)) this.srDead = true;
      if (e.error === 'audio-capture') { this.srFails = (this.srFails || 0) + 1; if (this.srFails >= 3) { this.srDead = true; if (this.stream) { if (devCaps.srOk) devCaps.setNoDual(true); else devCaps.setTry(true); } } this.onError('تعذّر على المتصفح الاستماع للتعرف على الكلام (الميكروفون مشغول). يستمر تسجيلك ويُقيَّم من الصوت.'); }
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.onError(isIOS && standalone ? 'التعرف على الكلام لا يعمل في المقرأة المثبّتة على آيفون. يستمر تسجيلك ويُقيَّم من الصوت، وللمتابعة الحية افتح المقرأة في Safari.' : isIOS ? 'التعرف على الكلام مرفوض. فعّل «Siri والإملاء» من إعدادات آيفون (الإعدادات ← عام ← لوحة المفاتيح ← تفعيل الإملاء). يستمر تسجيلك ويُقيَّم من الصوت.' : 'التعرف على الكلام غير متاح في هذا المتصفح أو مرفوض. يستمر تسجيلك ويُقيَّم من الصوت.');
      else if (e.error === 'language-not-supported') this.onError('التعرف على العربية غير متاح في هذا المتصفح. يستمر تسجيلك ويُقيَّم من الصوت.');
      else if (e.error === 'network') this.onError('التعرف على الكلام يحتاج اتصالاً بالإنترنت. يستمر تسجيلك.');
    };
    // المتصفح يوقف التعرف بعد فترة صمت؛ نعيد تشغيله ما دامت التلاوة مستمرة
    r.onend = () => {
      if (this.interim) { this.finalText += ' ' + this.interim; this.interim = ''; }
      if (!this.active || this.srDead) return;
      // إعادة تشغيل متتالية بلا نتائج تعني عطلاً: نبطئها حتى لا تتكرر أصوات التنبيه ويثقل الجهاز
      const now = Date.now(); this._rsT = (this._rsT || []).filter((t) => now - t < 10e3); this._rsT.push(now);
      this.diag.restarts++;
      const again = () => { if (this.active && !this.srDead) try { r.start(); } catch { setTimeout(() => { if (this.active && !this.srDead) try { r.start(); } catch {} }, 500); } };
      if (this._rsT.length > 6) setTimeout(again, 1500); else again();
    };
    this.recog = r;
    try { r.start(); } catch {}
  }

  /** يضيف نتيجة نهائية مع حذف التكرار: بعض متصفحات أندرويد تعيد الجملة السابقة كاملة في النتيجة التالية */
  _addFinal(text) {
    const t = (text || '').trim();
    if (!t) return;
    this.diag.finals++;
    const prev = this.lastFinal;
    if (prev && t.startsWith(prev)) { // النتيجة الجديدة امتداد للسابقة: نضيف الزيادة فقط
      this.diag.dups++;
      const extra = t.slice(prev.length).trim();
      if (extra) this.finalText += ' ' + extra;
    } else if (prev && prev.endsWith(t)) { this.diag.dups++; return; } // تكرار لما سبق
    else this.finalText += ' ' + t;
    this.lastFinal = t;
  }

  stop() {
    if (this.active && !this.stream && !this.noRec) { this.cancelled = true; this.active = false; return Promise.resolve({ blob: null, duration: 0, transcript: '', diag: this.diag }); }
    if (!this.active) return this._done;
    this.active = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    const duration = Math.round((Date.now() - this.startedAt) / 1000);
    this._done = new Promise((resolve) => {
      let over = false;
      const finish = () => {
        if (over) return; over = true;
        this._release();
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.rec?.mimeType || 'audio/webm' }) : null;
        // ننتظر قليلاً لوصول آخر نتيجة من التعرف
        setTimeout(() => {
          if (this.interim) { this.finalText += ' ' + this.interim; this.interim = ''; }
          resolve({ blob, duration, transcript: this.finalText.trim(), diag: this.diag });
        }, 600);
      };
      try { this.recog?.stop(); } catch {}
      // في آيفون قد لا يصل حدث الإيقاف أحياناً فيعلق التسجيل التالي: ننهي بعد مهلة قصيرة على كل حال
      if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = finish; try { this.rec.stop(); } catch { finish(); } setTimeout(finish, 1500); } else finish();
    });
    return this._done;
  }

  cancel() {
    this.active = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    try { this.recog?.abort(); } catch {}
    try { this.rec?.state !== 'inactive' && this.rec.stop(); } catch {}
    this._release();
  }
}

/* ---------- مشغل تلاوات القرّاء (EveryAyah) ---------- */
export const RECITERS = [
  { id: 'Husary_Muallim_128kbps', name: 'الحصري (المصحف المعلم)' },
  { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
  { id: 'Husary_128kbps', name: 'محمود خليل الحصري' },
  { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'عبد الباسط عبد الصمد' },
  { id: 'MaherAlMuaiqly128kbps', name: 'ماهر المعيقلي' },
  { id: 'khalefa_al_tunaiji_64kbps', name: 'خليفة الطنيجي' },
  { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبد الرحمن السديس' },
  { id: 'Saood_ash-Shuraym_128kbps', name: 'سعود الشريم' },
  { id: 'Yasser_Ad-Dussary_128kbps', name: 'ياسر الدوسري' },
  { id: 'Abu_Bakr_Ash-Shaatree_128kbps', name: 'أبو بكر الشاطري' },
  { id: 'Ghamadi_40kbps', name: 'سعد الغامدي' },
  { id: 'Hudhaify_128kbps', name: 'علي الحذيفي' },
  { id: 'Muhammad_Ayyoub_128kbps', name: 'محمد أيوب' },
  { id: 'Nasser_Alqatami_128kbps', name: 'ناصر القطامي' },
];
const pad = (n) => String(n).padStart(3, '0');
export const ayahAudioUrl = (reciter, s, a) => `https://everyayah.com/data/${reciter}/${pad(s)}${pad(a)}.mp3`;

export class AyahPlayer {
  constructor({ onAyah, onState } = {}) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.onAyah = onAyah || (() => {});
    this.onState = onState || (() => {});
    this.reciter = RECITERS[0].id;
    this.rate = 1;
    this.repeat = 1;
    this.audio.addEventListener('ended', () => this._next());
    this.audio.addEventListener('error', () => { this.onState('error'); });
    this.playing = false;
  }
  play(surah, from, to, startAt = from) {
    this.surah = surah; this.from = from; this.to = to; this.cur = startAt; this.count = 1;
    this.playing = true;
    this._load();
  }
  _load() {
    this.audio.src = ayahAudioUrl(this.reciter, this.surah, this.cur);
    this.audio.playbackRate = this.rate;
    this.onAyah(this.cur);
    this.audio.play().then(() => this.onState('playing')).catch(() => this.onState('error'));
    // تحميل الآية التالية مسبقاً
    if (this.cur < this.to) { const p = new Audio(); p.preload = 'auto'; p.src = ayahAudioUrl(this.reciter, this.surah, this.cur + 1); }
  }
  _next() {
    if (!this.playing) return;
    if (this.count < this.repeat) { this.count++; this._load(); return; }
    if (this.cur < this.to) { this.cur++; this.count = 1; this._load(); return; }
    this.stop();
  }
  pause() { this.audio.pause(); this.playing = false; this.onState('paused'); }
  resume() { this.playing = true; this.audio.play().then(() => this.onState('playing')).catch(() => {}); }
  stop() { this.audio.pause(); this.playing = false; this.onAyah(null); this.onState('stopped'); }
  setRate(r) { this.rate = r; this.audio.playbackRate = r; }
}
