// بيانات المصحف (رواية حفص - الرسم العثماني من Tanzil) وأدوات التطبيع
let QURAN = null;
let SURAHS = null;

let loading = null;
export function loadQuran() {
  if (!loading) loading = Promise.all([
    fetch('data/quran.json').then((r) => r.json()),
    fetch('data/surahs.json').then((r) => r.json()),
  ]).then(([q, s]) => { QURAN = q; SURAHS = s; return { QURAN, SURAHS }; }).catch((e) => { loading = null; throw e; });
  return loading;
}

export const getSurahs = () => SURAHS || [];
export const surahName = (n) => (SURAHS && SURAHS[n - 1] ? SURAHS[n - 1].name : `سورة ${n}`);
export const ayahCount = (n) => (SURAHS && SURAHS[n - 1] ? SURAHS[n - 1].ayahs : 0);
export const ayahText = (s, a) => (QURAN && QURAN[s - 1] ? QURAN[s - 1][a - 1] || '' : '');

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

/**
 * يحوّل الرسم العثماني والنص المنطوق (من التعرف على الكلام) إلى هيكل حروف موحد للمقارنة.
 * يراعي خصائص الرسم العثماني: الألف الخنجرية، ألف الوصل، الواو والياء الصغيرتين، الصلوٰة، يٰقوم...
 */
export function normalize(text) {
  if (!text) return '';
  let t = text;
  t = t.replace(/ـ/g, ''); // تطويل
  t = t.replace(/[وى]ٰ/g, 'ا'); // الصلوٰة، موسىٰ -> ألف
  t = t.replace(/ٰ/g, 'ا'); // ألف خنجرية
  t = t.replace(/[ۥۦۧ]/g, ''); // واو وياء صغيرة (صلة)
  t = t.replace(/[ؐ-ًؚ-ٟۖ-ۭ࣓-ࣿ]/g, ''); // التشكيل والعلامات
  t = t.replace(/[أإآٱ]/g, 'ا');
  t = t.replace(/ؤ/g, 'و');
  t = t.replace(/[ئى]/g, 'ي');
  t = t.replace(/ء/g, '');
  t = t.replace(/ة/g, 'ه');
  t = t.replace(/[^ء-ي\s]/g, '');
  // الألف بعد واو الجماعة تُكتب أحياناً ولا تُكتب في المخرجات
  t = t.replace(/وا(?=\s|$)/g, 'و');
  // توحيد الألف الممدودة المكررة
  t = t.replace(/اا+/g, 'ا');
  return t.trim();
}

export const SPECIAL_WORDS = {
  // كلمات تُكتب في المصحف بشكل يختلف كثيراً عن إملائها المعتاد
};

/** تقسيم آية إلى كلمات */
export function ayahWords(s, a) {
  return ayahText(s, a).split(' ').filter(Boolean);
}

/** كل كلمات مقطع (من آية إلى آية) مع موقع كل كلمة */
export function rangeWords(surah, from, to) {
  const out = [];
  for (let a = from; a <= to; a++) {
    const words = ayahWords(surah, a);
    words.forEach((w, i) => {
      out.push({ text: w, norm: normalize(w), ayah: a, idx: i, last: i === words.length - 1 });
    });
  }
  return out;
}
