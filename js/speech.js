// التسجيل الصوتي + التعرف على الكلام مباشرة مع إعادة التشغيل التلقائي ومقياس مستوى الصوت
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const hasRecognition = !!SR;
export const hasRecorder = typeof window !== 'undefined' && !!(navigator.mediaDevices && window.MediaRecorder);

export class RecitationSession {
  constructor({ onTranscript, onLevel, onError, onTick, maxSeconds = 300 } = {}) {
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
    this.diag = { sr: !!SR, restarts: 0, errs: [], finals: 0, dups: 0 };
    this.chunks = [];
    this.active = true;
    this.startedAt = Date.now();
    try {
      // صوت خام قدر الإمكان: كبت الضوضاء وإلغاء الصدى يشوّهان الغنة والمدود فيضعف حكم التحليل الآلي
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true, sampleRate: { ideal: 48000 } } });
    } catch (e) {
      this.active = false;
      throw new Error('لم يُسمح باستخدام الميكروفون. اسمح للموقع بالوصول إلى الميكروفون من إعدادات المتصفح ثم أعد المحاولة.');
    }
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
      this.ac = new AC();
      const src = this.ac.createMediaStreamSource(this.stream);
      const an = this.ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const loop = () => {
        if (!this.active) return;
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) * (v - 128);
        this.onLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {}

    this.timer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      this.onTick(s);
      if (s >= this.maxSeconds) { this.stop(); this.onAutoStop && this.onAutoStop(); }
    }, 250);

    if (SR) this._startRecognition();
  }

  _startRecognition() {
    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
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
      if (e.error === 'audio-capture') this.onError('تعذّر على المتصفح الاستماع للتعرف على الكلام (الميكروفون مشغول). سيُحفظ تسجيلك ويُقيَّم من الصوت.');
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.onError('التعرف على الكلام غير متاح في هذا المتصفح أو مرفوض. سيُحفظ التسجيل ليقيّمه المعلم.');
      else if (e.error === 'network') this.onError('التعرف على الكلام يحتاج اتصالاً بالإنترنت.');
    };
    // المتصفح يوقف التعرف بعد فترة صمت؛ نعيد تشغيله ما دامت التلاوة مستمرة
    r.onend = () => {
      if (this.interim) { this.finalText += ' ' + this.interim; this.interim = ''; }
      if (this.active) { this.diag.restarts++; try { r.start(); } catch { setTimeout(() => { if (this.active) try { r.start(); } catch {} }, 300); } }
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
    if (!this.active) return this._done;
    this.active = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    const duration = Math.round((Date.now() - this.startedAt) / 1000);
    this._done = new Promise((resolve) => {
      const finish = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        try { if (this.ac && this.ac.state !== 'closed') this.ac.close(); } catch {}
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.rec?.mimeType || 'audio/webm' }) : null;
        // ننتظر قليلاً لوصول آخر نتيجة من التعرف
        setTimeout(() => {
          if (this.interim) { this.finalText += ' ' + this.interim; this.interim = ''; }
          resolve({ blob, duration, transcript: this.finalText.trim(), diag: this.diag });
        }, 600);
      };
      try { this.recog?.stop(); } catch {}
      if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = finish; this.rec.stop(); } else finish();
    });
    return this._done;
  }

  cancel() {
    this.active = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    try { this.recog?.abort(); } catch {}
    try { this.rec?.state !== 'inactive' && this.rec.stop(); } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
    try { if (this.ac && this.ac.state !== 'closed') this.ac.close(); } catch {}
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
