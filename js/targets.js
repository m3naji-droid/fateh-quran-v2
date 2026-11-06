// لمن الواجب؟ صفوف و/أو طلاب بأسمائهم، مع الحذف عن صف أو طالب لاحقاً.
// الحقول: classId = 'all' | معرّف صف | 'custom' (عندها classIds + studentIds)
//         exClasses: صفوف حُذف عنها الواجب، exStudents: طلاب حُذف عنهم
// التسليمات السابقة تبقى في السجل عند الحذف عن صف أو طالب.

export const tClasses = (t) => (t.classId === 'all' ? ['all'] : t.classId === 'custom' ? t.classIds || [] : t.classId ? [t.classId] : []);
export const tStudents = (t) => (t.classId === 'custom' ? t.studentIds || [] : []);

/** هل الواجب موجّه لهذا الطالب الآن؟ s: {id, classId} */
export function taskFor(t, s) {
  if (!t || !s) return false;
  if ((t.exStudents || []).includes(s.id)) return false;
  if (tStudents(t).includes(s.id)) return true;
  if ((t.exClasses || []).includes(s.classId)) return false;
  const cl = tClasses(t);
  return cl.includes('all') || cl.includes(s.classId);
}
/** كل الطلاب الموجّه لهم الواجب */
export const taskStudents = (t, students) => students.filter((s) => taskFor(t, s));

/** وصف قصير: «كل الصفوف»، «الثاني ١ + ٣ طلاب»… */
export function targetLabel(t, className, studentName) {
  const cl = tClasses(t).filter((c) => !(t.exClasses || []).includes(c));
  const st = tStudents(t).filter((x) => !(t.exStudents || []).includes(x));
  const parts = [];
  if (cl.includes('all')) parts.push('كل الصفوف');
  else cl.forEach((c) => parts.push(className(c)));
  if (st.length === 1) parts.push(studentName(st[0]));
  else if (st.length === 2) parts.push('طالبان');
  else if (st.length) parts.push(`${st.length} طلاب`.replace(/\d+/g, (d) => d.replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[x])));
  let s = parts.join(' + ') || 'لا أحد';
  const ex = (t.exClasses || []).length + (t.exStudents || []).length;
  if (ex) s += ' (مع استثناءات)';
  return s;
}

/** يبني حقول الاستهداف من اختيار المعلم */
export function buildTarget({ all, classIds, studentIds }) {
  if (all) return { classId: 'all', classIds: [], studentIds: [] }; // كل الصفوف تشمل الجميع
  if (classIds.length === 1 && !studentIds.length) return { classId: classIds[0], classIds: [], studentIds: [] };
  return { classId: 'custom', classIds: [...classIds], studentIds: [...studentIds] };
}

/* ---------- وقت البداية والنهاية ---------- */
/** نهاية الواجب: endAt، أو آخر يوم due بتوقيت الرياض للواجبات القديمة */
export const taskEnd = (t) => t?.endAt || (t?.due ? `${t.due}T23:59:59+03:00` : null);
export const taskStarted = (t, now = Date.now()) => !t?.startAt || new Date(t.startAt).getTime() <= now;
export const taskClosed = (t, now = Date.now()) => { const e = taskEnd(t); return !!e && new Date(e).getTime() < now; };
/** تاريخ اليوم بتوقيت الرياض لوقت ISO */
export const riyadhDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(iso));
/** قيمة حقل datetime-local من ISO (بتوقيت الجهاز) */
export const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
