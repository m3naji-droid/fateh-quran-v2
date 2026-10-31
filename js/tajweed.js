// محرك تلوين أحكام التجويد آلياً على الرسم العثماني (رواية حفص عن عاصم)
// يعمل على أي آية في المصحف، وليس على قائمة مكتوبة يدوياً.

export const RULES = {
  ikhfa: { name: 'إخفاء حقيقي', group: 'النون الساكنة والتنوين', tip: 'أخفِ النون مع غنة بمقدار حركتين، وهيّئ الفم للحرف التالي.' },
  idgham_g: { name: 'إدغام بغنة', group: 'النون الساكنة والتنوين', tip: 'أدغم النون في الحرف التالي (ي ن م و) مع غنة حركتين.' },
  idgham_ng: { name: 'إدغام بلا غنة', group: 'النون الساكنة والتنوين', tip: 'أدغم النون إدغاماً كاملاً في اللام أو الراء دون غنة.' },
  iqlab: { name: 'إقلاب', group: 'النون الساكنة والتنوين', tip: 'اقلب النون ميماً مخفاة عند الباء مع غنة حركتين.' },
  izhar: { name: 'إظهار حلقي', group: 'النون الساكنة والتنوين', tip: 'أظهر النون واضحة دون غنة عند حروف الحلق (ء هـ ع ح غ خ).' },
  ikhfa_sh: { name: 'إخفاء شفوي', group: 'الميم الساكنة', tip: 'أخفِ الميم عند الباء مع غنة، دون إطباق الشفتين بقوة.' },
  idgham_sh: { name: 'إدغام شفوي', group: 'الميم الساكنة', tip: 'أدغم الميم في الميم مع غنة حركتين.' },
  ghunnah: { name: 'غنة مشددة', group: 'الغنة', tip: 'النون والميم المشددتان: غنة كاملة بمقدار حركتين.' },
  qalqala: { name: 'قلقلة', group: 'القلقلة', tip: 'حروف (قطب جد) الساكنة: اضطراب الصوت عند النطق دون إضافة حركة.' },
  madd_lazim: { name: 'مد لازم', group: 'المدود', tip: 'يُمد ست حركات لزوماً.' },
  madd_muttasil: { name: 'مد واجب متصل', group: 'المدود', tip: 'حرف المد والهمزة في كلمة واحدة: يُمد 4 أو 5 حركات.' },
  madd_munfasil: { name: 'مد جائز منفصل', group: 'المدود', tip: 'حرف المد آخر الكلمة والهمزة أول التالية: 4 أو 5 حركات (أو حركتان قصراً).' },
  madd_arid: { name: 'مد عارض للسكون', group: 'المدود', tip: 'عند الوقف على آخر الآية: يجوز 2 أو 4 أو 6 حركات مع ثبات المقدار.' },
  silent: { name: 'حرف لا يُنطق', group: 'أخرى', tip: 'يُكتب ولا يُلفظ وصلاً (همزة وصل أو حرف عليه علامة الزيادة).' },
};

const HARAKAT = /[ً-ْٰۡ]/;
const TANWEEN = /[ًࣰٌٍ-ࣲ]/;
const SUKUN = /[ْۡ]/;
const SHADDA = 'ّ';
const MADDAH = 'ٓ';
const ZERO = /[۟۠]/; // علامة الزيادة (لا يُنطق)
const SMALL_MEEM = /[ۭۢ]/;

const IZHAR = 'ءأإؤئهعحغخ';
const IDGHAM_G = 'ينمو';
const IDGHAM_NG = 'لر';
const IKHFA = 'تثجدذزسشصضطظفقك';
const QALQALA = 'قطبجد';
const HAMZA = 'ءأإؤئ';

const isLetter = (c) => /[ء-يٱ]/.test(c);

/** تقسيم كلمة إلى وحدات: حرف + علاماته */
export function graphemes(word) {
  const out = [];
  for (const ch of word) {
    if (isLetter(ch) || !out.length) out.push({ base: ch, marks: '' });
    else out[out.length - 1].marks += ch;
  }
  return out;
}

const noVowel = (g) => !HARAKAT.test(g.marks) && !g.marks.includes(SHADDA);
const isSakin = (g) => SUKUN.test(g.marks) || noVowel(g);

/** أول حرف منطوق في كلمة (لتحديد الحرف التالي للنون الساكنة عبر الكلمات) */
function firstSpoken(gs) {
  for (const g of gs) {
    if (g.base === 'ٱ') return null; // همزة وصل: الحكم يتغير، نتجاوز التلوين
    if (ZERO.test(g.marks)) continue;
    return g;
  }
  return null;
}

/** بعد الحرف رقم k في الكلمة: الحرف المنطوق التالي (داخل الكلمة أو في الكلمة التالية) */
function nextSpoken(gsList, w, k) {
  const gs = gsList[w];
  for (let i = k + 1; i < gs.length; i++) {
    const g = gs[i];
    if (ZERO.test(g.marks)) continue;
    // ألف التنوين أو الألف المقصورة بعد التنوين لا تُنطق
    if ((g.base === 'ا' || g.base === 'ى') && noVowel(g)) continue;
    return { g, cross: false };
  }
  if (w + 1 < gsList.length) {
    const g = firstSpoken(gsList[w + 1]);
    return g ? { g, cross: true } : null;
  }
  return null;
}

/**
 * يحلل آية ويعيد لكل كلمة مصفوفة من {html-safe text, rule}
 * words: مصفوفة كلمات الآية
 */
export function analyzeAyah(words) {
  const gsList = words.map(graphemes);
  const tags = gsList.map((gs) => gs.map(() => null));
  const lastW = gsList.length - 1;

  gsList.forEach((gs, w) => {
    gs.forEach((g, k) => {
      const set = (rule, kk = k, ww = w) => { if (!tags[ww][kk]) tags[ww][kk] = rule; };

      // حروف لا تُنطق
      if (ZERO.test(g.marks) || (g.base === 'ٱ' && !(w === 0 && k === 0))) { set('silent'); return; }

      // الغنة المشددة
      if ((g.base === 'ن' || g.base === 'م') && g.marks.includes(SHADDA)) { set('ghunnah'); return; }

      // النون الساكنة والتنوين
      const ayahEnd = w === lastW && k === gs.length - 1;
      const isNoonSakin = g.base === 'ن' && isSakin(g) && !ayahEnd;
      const hasTanween = TANWEEN.test(g.marks) && !ayahEnd;
      if (isNoonSakin || hasTanween) {
        if (SMALL_MEEM.test(g.marks)) { set('iqlab'); return; }
        const nx = nextSpoken(gsList, w, k);
        if (nx && !(hasTanween && w === lastW)) {
          const c = nx.g.base;
          if (c === 'ب') set('iqlab');
          else if (IKHFA.includes(c)) set('ikhfa');
          else if (IDGHAM_G.includes(c) && (nx.cross || hasTanween)) set('idgham_g');
          else if (IDGHAM_NG.includes(c) && (nx.cross || hasTanween)) set('idgham_ng');
          else if (IZHAR.includes(c)) set('izhar');
        }
        if (tags[w][k]) return;
      }

      // الميم الساكنة
      if (g.base === 'م' && isSakin(g) && !(w === lastW && k === gs.length - 1)) {
        const nx = nextSpoken(gsList, w, k);
        if (nx && nx.g.base === 'ب') { set('ikhfa_sh'); return; }
        if (nx && nx.g.base === 'م') { set('idgham_sh'); return; }
      }

      // القلقلة: ساكن صريح أو آخر الآية
      if (QALQALA.includes(g.base)) {
        const atEnd = w === lastW && k === gs.length - 1;
        if (SUKUN.test(g.marks) || atEnd) { set('qalqala'); return; }
      }

      // المدود ذات العلامة (~)
      if (g.marks.includes(MADDAH)) {
        let rule = 'madd_lazim';
        const nextInWord = gs.slice(k + 1).find((x) => isLetter(x.base));
        if (nextInWord && HAMZA.includes(nextInWord.base)) rule = 'madd_muttasil';
        else if (!nextInWord && w < lastW) {
          const f = gsList[w + 1][0];
          if (f && HAMZA.includes(f.base)) rule = 'madd_munfasil';
        } else if (!nextInWord && gs.length <= 2 && /[ٓ]/.test(g.marks)) rule = 'madd_lazim';
        // ألف بعدها همزة ضمن الكلمة كُتبت مع مدة: متصل
        if (rule === 'madd_lazim' && nextInWord && nextInWord.base === 'ء') rule = 'madd_muttasil';
        set(rule);
        return;
      }
    });
  });

  // مد عارض للسكون على آخر كلمة في الآية
  const lastGs = gsList[lastW];
  if (lastGs && lastGs.length >= 3) {
    const k = lastGs.length - 2; // الحرف قبل الأخير
    const g = lastGs[k], p = lastGs[k - 1];
    const maddLetter =
      (g.base === 'ا' && /َ/.test(p.marks)) ||
      (g.base === 'و' && /ُ/.test(p.marks) && noVowel(g)) ||
      (g.base === 'ي' && /ِ/.test(p.marks) && noVowel(g));
    if (maddLetter && !tags[lastW][k]) tags[lastW][k] = 'madd_arid';
  }

  return gsList.map((gs, w) => gs.map((g, k) => ({ text: g.base + g.marks, rule: tags[w][k] })));
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** HTML لكلمة واحدة بعد التلوين */
export function wordHtml(parts) {
  // دمج الأجزاء المتجاورة ذات الحكم نفسه، والحفاظ على اتصال الحروف العربية
  let html = '';
  let cur = null, buf = '';
  const flush = () => {
    if (!buf) return;
    html += cur ? `<span class="tj tj-${cur}" data-rule="${cur}">${esc(buf)}</span>` : esc(buf);
    buf = '';
  };
  for (const p of parts) {
    if (p.rule !== cur) { flush(); cur = p.rule; }
    buf += p.text;
  }
  flush();
  return html;
}

/** ملخص الأحكام الموجودة في مجموعة آيات */
export function summarize(analyzedAyahs) {
  const map = new Map();
  analyzedAyahs.forEach(({ ayah, words }) => {
    words.forEach((parts, wi) => {
      parts.forEach((p) => {
        if (!p.rule || p.rule === 'silent') return;
        if (!map.has(p.rule)) map.set(p.rule, []);
        const word = parts.map((x) => x.text).join('');
        const arr = map.get(p.rule);
        if (!arr.some((x) => x.ayah === ayah && x.wi === wi)) arr.push({ ayah, wi, word });
      });
    });
  });
  return map;
}
