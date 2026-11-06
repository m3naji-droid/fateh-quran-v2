// التقييم الميسّر (النظام الثاني): خصم مخفف بسقف لكل نوع، وحد أدنى لمن أكمل المقطع
//  - كل خطأ لفظي (كلمة خاطئة أو متروكة داخل ما قرأه) ربع درجة، وأقصى خصم اللفظي ٣
//  - كل ملاحظة تجويد ثُمن درجة، وأقصى خصم التجويد درجة واحدة
//  - من أكمل المقطع (قرأ ٩٠٪ منه فأكثر) لا تقل درجته عن ٦
//  - من توقف قبل ذلك: درجته بنسبة ما قرأ
//  - التسليمات قبل اعتماد النظام لا تنزل درجتها عما كانت عليه

export const G = { vd: 0.25, vmax: 3, td: 0.125, tmax: 1, floor: 6, full: 0.9, since: '2026-11-06T22:00:00+03:00' };
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

/** الدرجة من الخصم (لفظي وتجويد) ونسبة الإكمال */
export function gradeV2(ded, cov = 1) {
  const base = 10 - Math.min(ded.verbal || 0, G.vmax) - Math.min(ded.tajweed || 0, G.tmax);
  return q4(cov >= G.full ? Math.max(G.floor, base) : base * cov);
}

/** الدرجة الآلية لتسليم: من التصحيح الآلي للكلمات، ومن تحليل التجويد إن وُجد */
export function autoGrade(x) {
  if (!x || !x.statuses) return null;
  const end = readEnd(x.statuses);
  let v = 0;
  for (let i = 0; i < end; i++) if (x.statuses[i] === 'w' || x.statuses[i] === 'm') v++;
  const t = x.ai?.errors ? x.ai.errors.filter((e) => e.i < end).length : 0;
  const cov = coverage(x.statuses);
  let total = gradeV2({ verbal: v * G.vd, tajweed: t * G.td }, cov);
  const legacy = isLegacy(x);
  if (legacy && x.percent != null) total = Math.max(total, q4(x.percent / 10));
  return {
    total, v, t, cov,
    verbal: Math.min(v * G.vd, G.vmax), tajweed: Math.min(t * G.td, G.tmax),
    // بانتظار تحليل التجويد: واجب جديد له تسجيل ولم يُحلَّل بعد
    pending: !legacy && !x.ai && !x.aiFail && !!x.hasAudio && !!(x.taskId || x.retakeId),
  };
}

/** درجة تقييم المعلم من علاماته بالنظام الجديد (لإعادة حساب الدرجات السابقة) */
export function teacherGradeV2(x, ded) {
  return gradeV2(ded, coverage(x.statuses));
}
