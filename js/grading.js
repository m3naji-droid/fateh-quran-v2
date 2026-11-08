import { ayahWords } from './quran.js';
// التقييم الميسّر (النظام الثاني): خصم مخفف بسقف لكل نوع، وحد أدنى لمن أكمل المقطع
//  - كل خطأ لفظي (كلمة خاطئة أو متروكة داخل ما قرأه) ربع درجة، وأقصى خصم اللفظي ٣
//  - خطأ الحركة أو الحرف ومخرجه ثُمن درجة، وأقصى خصمها درجتان
//  - كل ملاحظة تجويد ثُمن درجة، وأقصى خصم التجويد درجة واحدة
//  - المد العارض للسكون صحيح إن مُدّ ٢ أو ٤ أو ٦ حركات
//  - من أكمل المقطع (قرأ ٩٠٪ منه فأكثر) لا تقل درجته عن ٦
//  - من توقف قبل ذلك: درجته بنسبة ما قرأ
//  - التسليمات قبل اعتماد النظام لا تنزل درجتها عما كانت عليه

export const G = { vd: 0.25, vmax: 3, ld: 0.125, lmax: 2, td: 0.125, tmax: 1, floor: 6, full: 0.9, since: '2026-11-06T22:00:00+03:00' };
const q4 = (v) => Math.max(0, Math.min(10, Math.round(v * 4) / 4));
const isLegacy = (x) => (x.createdAt || '') !== '' && new Date(x.createdAt) < new Date(G.since);

/** نهاية ما قرأه الطالب: الكلمات المتروكة في آخر المقطع لا تُعد أخطاء، بل نقصاً في الإكمال */
export function readEnd(statuses) {
  const s = statuses || '';
  let end = s.length;
  while (end > 0 && s[end - 1] === 'm') end--;
  return end;
}
export const coverage = (statuses) => (statuses ? readEnd(statuses) / statuses.length : 1);

/** أخطاء الحركة والحرف/المخرج: لها خصمها وسقفها الخاص */
export const LETTER_KEYS = new Set(['haraka', 'makhraj']);
/** ملاحظة التحليل الآلي معتبرة؟ المد العارض للسكون يجوز ٢ أو ٤ أو ٦ حركات */
export const aiErrCounts = (e) => !(e.r === 'madd_arid' && [2, 4, 6].includes(Number(e.gl)));
export const aiErrors = (ai) => (ai?.errors || []).filter(aiErrCounts);

/** يقسم خصم المعلم (من deduction) إلى: لفظي، وحركات وحروف، وتجويد */
export function splitDed(ded) {
  if (!ded.groups) return ded;
  const letters = ded.groups.filter((g) => LETTER_KEYS.has(g.key)).reduce((n, g) => n + g.sum, 0);
  return { verbal: Math.max(0, (ded.verbal || 0) - letters), letters, tajweed: ded.tajweed || 0 };
}
export const capped = (ded) => { const d = splitDed(ded); return { verbal: Math.min(d.verbal || 0, G.vmax), letters: Math.min(d.letters || 0, G.lmax), tajweed: Math.min(d.tajweed || 0, G.tmax), raw: d }; };

/** الدرجة من الخصم (لفظي، حركات وحروف، تجويد) ونسبة الإكمال */
export function gradeV2(ded, cov = 1) {
  const c = capped(ded);
  const base = 10 - c.verbal - c.letters - c.tajweed;
  return q4(cov >= G.full ? Math.max(G.floor, base) : base * cov);
}

/** رقم الآية لكل كلمة في المقطع */
function ayahOf(x) {
  const out = [];
  try { for (let a = x.from; a <= x.to; a++) ayahWords(x.surah, a).forEach(() => out.push(a)); } catch {}
  return out;
}
/**
 * حماية من انقطاع التعرف على الكلام في المتصفح: إن سمع تحليلُ الصوت الآياتِ التي لم يلتقطها التعرف،
 * فالنقص من المتصفح لا من الطالب. آخر المقطع غير الملتقط لا يُنقص الإكمال، وكل فجوة من ٣ كلمات فأكثر
 * داخل آية سمعها التحليل تُحسب خطأً واحداً.
 */
export function asrGuard(x) {
  const st = x?.statuses || '';
  if (!x?.ai || !st || x.aiFail) return null;
  const A = ayahOf(x);
  if (A.length !== st.length) return null;
  const skipped = new Set((x.ai.skipped || []).map(Number));
  const end = readEnd(st);
  const tailAyat = new Set(A.slice(end));
  // مدة التسجيل تكفي لتلاوة المقطع كله (أسرع ترتيل معقول نحو ١٥٠ كلمة في الدقيقة)، فالتوقف ليس من الطالب
  const longEnough = !x.duration || x.duration >= st.length * 0.38;
  const tail = end < st.length && longEnough && [...tailAyat].every((a) => !skipped.has(a)) ? st.length - end : 0;
  const gaps = [];
  for (let i = 0; i < end;) {
    if (st[i] !== 'm') { i++; continue; }
    let j = i; while (j < end && st[j] === 'm') j++;
    if (j - i >= 3 && !A.slice(i, j).some((a) => skipped.has(a))) gaps.push([i, j]);
    i = j;
  }
  return tail || gaps.length ? { tail, gaps } : null;
}

/** الدرجة الآلية لتسليم: من التصحيح الآلي للكلمات، ومن تحليل التجويد إن وُجد */
export function autoGrade(x) {
  if (!x || !x.statuses) return null;
  const guard = asrGuard(x);
  const end = guard?.tail ? x.statuses.length : readEnd(x.statuses);
  const inGap = (i) => guard?.gaps.some(([a, b]) => i >= a && i < b);
  let v = 0;
  for (let i = 0; i < end; i++) {
    if (guard?.tail && i >= x.statuses.length - guard.tail) break; // ذيل لم يلتقطه التعرف: ليس خطأً
    if (inGap(i)) continue;
    if (x.statuses[i] === 'w' || x.statuses[i] === 'm') v++;
  }
  v += guard?.gaps.length || 0; // كل فجوة خطأ واحد
  const errs = aiErrors(x.ai).filter((e) => e.i < end);
  const l = errs.filter((e) => LETTER_KEYS.has(e.r)).length, t = errs.length - l;
  const cov = guard?.tail ? 1 : coverage(x.statuses);
  let total = gradeV2({ verbal: v * G.vd, letters: l * G.ld, tajweed: t * G.td }, cov);
  const legacy = isLegacy(x);
  if (legacy && x.percent != null) total = Math.max(total, q4(x.percent / 10));
  return {
    total, v, l, t, cov, asr: guard,
    verbal: Math.min(v * G.vd, G.vmax), letters: Math.min(l * G.ld, G.lmax), tajweed: Math.min(t * G.td, G.tmax),
    // بانتظار تحليل التجويد: واجب جديد له تسجيل ولم يُحلَّل بعد
    pending: !legacy && !x.ai && !x.aiFail && !!x.hasAudio && !!(x.taskId || x.retakeId),
  };
}

/** درجة تقييم المعلم من علاماته بالنظام الجديد (لإعادة حساب الدرجات السابقة) */
export function teacherGradeV2(x, ded) {
  return gradeV2(ded, coverage(x.statuses));
}
