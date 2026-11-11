// تحويل نص مشكول (حرف أو كلمة من دروس «اقرأ وارتقِ») إلى الرسم الصوتي الذي يخرجه نموذج «المعلّم القرآني»،
// ثم مقارنته بما نطقه الطالب. القراءة بالوصل (كما يقرأ الطالب الكلمة منفردة بحركتها الأخيرة).
// أبجدية النموذج: الحروف، والحركات الثلاث، ومد الألف «ا» والواو «ۥ» والياء «ۦ» (حرفان للمد الطبيعي)،
// والقلقلة «ڇ»، والمشدد حرفان، والساكن بلا علامة.

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SHADDA = 'ّ';
const TF = 'ً', TD = 'ٌ', TK = 'ٍ'; // التنوين
const DAGGER = 'ٰ', MADDA = 'ٓ', SUKUN2 = 'ۡ', ROUND0 = '۟', RECT0 = '۠';
const QALQALA = new Set(['ق', 'ط', 'ب', 'ج', 'د']);
const HAMZAS = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ']);
const MARKS = /[ً-ٰٕۖ-ۭ]/;

/** يقسم النص إلى حروف أساسية مع علاماتها */
function units(text) {
  const out = [];
  for (const ch of text.replace(/ـ/g, '')) {
    if (MARKS.test(ch)) { if (out.length) out[out.length - 1].m += ch; }
    else out.push({ c: ch, m: '' });
  }
  return out;
}
const harakaOf = (m) => (m.includes(FATHA) || m.includes(TF) ? FATHA : m.includes(DAMMA) || m.includes(TD) ? DAMMA : m.includes(KASRA) || m.includes(TK) ? KASRA : '');

const SMALL_WAW = 'ۥ', SMALL_YAA = 'ۦ', SMALL_YAA2 = 'ۧ', SMALL_MEEM = 'ۢ', SMALL_MEEM2 = 'ۭ', SMALL_NOON = 'ۨ';
// أسماء تبدأ بهمزة وصل مكسورة دائماً (وإن كان ثالثها مضموماً)
const WASL_NOUNS = /^ٱ(?:سْ?م|بْ?ن|ثْ?ن|مْ?ر)/;

export function toPhonemes(text) {
  // لفظ الجلالة: ألف المد بعد اللام وإن لم تُرسم
  text = String(text).normalize('NFC').replace(/(ٱل|ال|لِ)ل(َّ|َّ)(?=ه[َ-ِ])/g, (m) => m + 'ٰ');
  // «آ» داخل الكلمة بعد حركة هي ألف مدّ عليها علامة المد (لا همزة)، و«ـَٔ» همزة على كرسي
  text = text.replace(/([\u064B-\u0652])\u0622/g, '$1\u0627\u0653').replace(/\u0640([\u064E-\u0650]?)\u0654/g, '\u0621$1');
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const U = [];
  words.forEach((w, wi) => { units(w).forEach((u, i) => U.push({ ...u, ws: i === 0, wi, w })); });
  let out = '';
  let prevH = ''; // حركة الحرف السابق المنطوق
  let dbl = false; // إدغام بغنة: يُضعَّف أول حرف في الكلمة التالية
  for (let i = 0; i < U.length; i++) {
    const { c, m, ws } = U[i];
    const next = U[i + 1];
    // أول حرف منطوق بعده (يتخطى الألف الفارقة ونحوها)
    let nx = i + 1; while (U[nx] && (U[nx].m.includes(ROUND0) || U[nx].m.includes(RECT0) || (U[nx].c === 'ا' && !U[nx].m && U[nx - 1]?.c === 'و'))) nx++;
    const nextSpoken = U[nx];
    const h = harakaOf(m);
    const tanween = /[ً-ٍ]/.test(m);
    const shadda = m.includes(SHADDA);
    const silentMark = m.includes(ROUND0) || m.includes(RECT0);
    const smallMadd = m.includes(SMALL_WAW) ? 'ۥۥ' : (m.includes(SMALL_YAA) || m.includes(SMALL_YAA2)) ? 'ۦۦ' : '';
    // همزة الوصل: تُنطق في أول الكلام فقط، وتسقط في الدرج
    if (c === 'ٱ') {
      if (i === 0) {
        const isAl = next && next.c === 'ل';
        const third = U[i + 2];
        const v = isAl ? FATHA : !WASL_NOUNS.test(U[i].w) && third && third.m.includes(DAMMA) ? DAMMA : KASRA;
        out += 'ء' + v; prevH = v;
      }
      continue;
    }
    if (c === 'آ') { out += 'ء' + FATHA + 'اا'; prevH = 'madd'; continue; }
    // حروف المد
    if (c === 'ا' || c === 'ى') {
      if (silentMark) continue;
      if (h) { const b = c === 'ى' ? 'ي' : 'ء'; out += (shadda ? b + b : b) + h; prevH = h; continue; }
      if (nextSpoken?.c === 'ٱ') continue; // مد قبل همزة وصل: يسقط لالتقاء الساكنين
      if (prevH === FATHA && !/[ً]/.test(U[i - 1]?.m || '')) { out += m.includes(MADDA) ? 'اااا' : 'اا'; prevH = 'madd'; }
      else if (c === 'ى' && prevH === KASRA) { out += m.includes(MADDA) ? 'ۦۦۦۦ' : 'ۦۦ'; prevH = 'madd'; }
      continue; // ألف بعد تنوين الفتح أو بلا حركة قبلها: لا تُنطق
    }
    // واو أو ياء عليها ألف خنجرية (ٱلصَّلَوٰةَ): تُقرأ ألفاً
    if ((c === 'و' || c === 'ي') && m.includes(DAGGER) && !h) { out += m.includes(MADDA) ? 'اااا' : 'اا'; prevH = 'madd'; continue; }
    if ((c === 'و' || c === 'ي') && !h && !shadda && !m.includes(SUKUN) && !m.includes(SUKUN2)) {
      const madd = (c === 'و' && prevH === DAMMA) || (c === 'ي' && prevH === KASRA);
      if (silentMark) continue;
      if (madd && nextSpoken?.c === 'ٱ') continue;
      if (madd) { out += (c === 'و' ? 'ۥ' : 'ۦ').repeat(m.includes(MADDA) ? 4 : 2); prevH = 'madd'; continue; }
      if (i === U.length - 1 || next?.ws) { out += c; prevH = ''; continue; }
    }
    if (m.includes(DAGGER) && !h) { out += normC(c) + FATHA + 'اا'; prevH = 'madd'; continue; }
    if (silentMark && !h) continue;
    const base = normC(c);
    // الساكن غير المرسوم قبل حرف مشدد (اللام الشمسية، وإدغام «قُل رَّبِّ»): لا يُنطق
    if (!m && nextSpoken && nextSpoken.m.includes(SHADDA) && !HAMZAS.has(c) && c !== 'ة') continue;
    // النون الساكنة في آخر الكلمة قبل ياء أو واو: تُدغم فيهما بغنة «مَن يَقُولُ» = مَيَّقُولُ
    if (c === 'ن' && (!m || m.includes(SUKUN) || m.includes(SUKUN2)) && next?.ws && (next.c === 'ي' || next.c === 'و')) { dbl = true; continue; }
    // حرف بلا أي علامة: ساكن (لام ونون وميم)، أو حرف زائد لا يُنطق
    if (!m && !HAMZAS.has(c) && c !== 'ة') {
      if (c === 'ل' || c === 'ن' || c === 'م' || c === 'د' || c === 'ت' || c === 'ر' || c === 'ذ') { out += base; prevH = ''; if (QALQALA.has(c)) out += 'ڇ'; continue; }
      if (i > 0) continue;
    }
    // نون عليها ميم صغيرة (إقلاب): تُقرأ ميماً
    out += c === 'ن' && m.includes(SMALL_MEEM) ? 'م' : shadda || (dbl && ws) ? base + base : base;
    dbl = false;
    if (h) out += h;
    if (m.includes(SMALL_NOON)) out += 'ن';
    if (m.includes(DAGGER)) { out += m.includes(MADDA) ? 'اااا' : 'اا'; prevH = 'madd'; } else prevH = h;
    if (smallMadd) {
      if (nextSpoken?.c !== 'ٱ') out += m.includes(MADDA) ? smallMadd + smallMadd : smallMadd;
      prevH = 'madd';
    }
    if (tanween) {
      // التنوين: يُدغم في الحرف المشدد بعده، ويُقلب ميماً مع الميم الصغيرة، ويُكسر قبل همزة الوصل
      if (m.includes(SMALL_MEEM) || m.includes(SMALL_MEEM2)) out += 'م';
      else {
        // نتخطى ألف تنوين الفتح وياءه الصامتة («هُدًى»، «قَوْمًا») إلى أول الكلمة التالية
        let k = i + 1; while (U[k] && !U[k].ws && (U[k].c === 'ا' || U[k].c === 'ى') && !harakaOf(U[k].m)) k++;
        const nn = U[k];
        if (nn && nn.ws && (nn.c === 'ي' || nn.c === 'و') && !nn.m.includes(SHADDA)) dbl = true;
        else if (!(nn && nn.ws && nn.m.includes(SHADDA))) out += nn?.c === 'ٱ' ? 'ن' + KASRA : 'ن';
      }
      prevH = '';
    }
    // القلقلة: الحرف الساكن من «قطب جد»
    if (!h && !shadda && QALQALA.has(c)) out += 'ڇ';
  }
  return out;
}
function normC(c) {
  if (HAMZAS.has(c)) return 'ء';
  if (c === 'ة') return 'ت';
  if (c === 'ى') return 'ي';
  return c;
}

/** تبسيط للمقارنة: مقدار المد (طبيعي/أطول) لا يُحاسَب عليه المبتدئ، والقلقلة والغنة تُتسامح */
export function simplify(p) {
  return String(p || '')
    .replace(/[ڇۜ]/g, '').replace(/ں/g, 'ن').replace(/۾/g, 'م').replace(/ٲ/g, 'ء').replace(/ـ/g, 'ا').replace(/۪/g, FATHA).replace(/ؙ/g, DAMMA)
    .replace(/ا{2,}/g, 'اا').replace(/ۥ{2,}/g, 'ۥۥ').replace(/ۦ{2,}/g, 'ۦۦ')
    .replace(/([^اۥۦَ-ِ])\1{2,}/g, '$1$1');
}

export function lev(a, b) {
  const A = [...a], B = [...b];
  let p = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const c = [i];
    for (let j = 1; j <= B.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    p = c;
  }
  return p[B.length];
}

/**
 * يحكم على نطق الطالب (الرسم الصوتي من الخادم) مقابل النص.
 * strict: للحروف والمقاطع القصيرة لا يُقبل أي خطأ في الحرف أو الحركة.
 * يعيد { ok, score, ref, got }
 */
export function judgePhonemes(text, pred, { strict = false } = {}) {
  const ref = simplify(toPhonemes(text));
  let got = simplify(pred);
  // قد يكرر الطالب المقطع أو يسبقه بصوت: نأخذ أقرب جزء من نطقه إلى المرجع
  if (got.length > ref.length + 2) {
    let best = got, bd = Infinity;
    for (let L = Math.max(1, ref.length - 2); L <= ref.length + 2; L++) for (let s = 0; s + L <= got.length; s++) {
      const d = lev(got.slice(s, s + L), ref); if (d < bd) { bd = d; best = got.slice(s, s + L); }
    }
    got = best;
  }
  const d = lev(got, ref);
  const score = ref.length ? Math.max(0, 1 - d / ref.length) : 0;
  const allow = strict ? (ref.length >= 8 ? 1 : 0) : Math.floor(ref.length * 0.2);
  return { ok: !!got && d <= allow, score, ref, got };
}

/* ---------- مقارنة نص التعرف الفوري (بلا تشكيل) ---------- */
export function bare(s) {
  return String(s || '').normalize('NFC')
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[^ء-ي\s]/g, '').replace(/\s+/g, ' ').trim();
}
/** النص المتوقع من التعرف الفوري: الحروف التي تُكتب عادة (تسقط الألف الفارقة الصامتة) */
export function judgeTranscript(expected, said, { names = false } = {}) {
  const e = bare(expected).replace(/وا(\s|$)/g, 'و$1');
  const s = bare(said);
  if (!s) return { ok: false, score: 0 };
  const E = e.replace(/\s/g, ''), S = s.replace(/\s/g, '');
  // أسماء الحروف: «با» و«باء» سواء، و«ألف» قد تُسمع «الف»
  const norm = (x) => (names ? x.replace(/ء/g, '').replace(/ا+/g, 'ا') : x);
  const a = norm(E), b = norm(S);
  let best = lev(a, b);
  // التعرف قد يضيف كلمة قبل أو بعد: نبحث عن أقرب مقطع
  if (b.length > a.length) for (let st = 0; st + a.length <= b.length; st++) best = Math.min(best, lev(a, b.slice(st, st + a.length)));
  const score = Math.max(0, 1 - best / Math.max(1, a.length));
  return { ok: a.length <= 3 ? best === 0 : score >= 0.8, score };
}
