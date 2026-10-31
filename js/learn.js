// محرك التعلّم السريع من تقييمات المعلم
// يتعلم من كل تقييم: (١) احتمال أن يخطئ كل طالب في كل حكم تجويد، (٢) طريقة المعلم في منح الدرجة من ١٠.
// يعمل في المتصفح دون خادم، ويتحسن بعد كل تقييم مباشرة (تقدير بايزي + انحدار خطي منتظم).
import { ayahWords } from './quran.js';
import { analyzeAyah, RULES } from './tajweed.js';

export const EXTRA = {
  makhraj: { name: 'مخرج حرف', tip: 'خطأ في مخرج حرف أو صفته (مثل الضاد والظاء، الحاء والهاء).' },
  haraka: { name: 'خطأ في الحركة', tip: 'تبديل حركة بحركة (فتحة/ضمة/كسرة) أو سكون.' },
  madd_tabii: { name: 'مد طبيعي', tip: 'يُمد حركتين.' },
  madd_leen: { name: 'مد اللين', tip: 'الواو والياء الساكنتان بعد فتح عند الوقف.' },
  tajweed_other: { name: 'حكم تجويد آخر', tip: '' },
};

/** موثوقية اقتراحات الذكاء الاصطناعي لكل حكم: كم منها قبله المعلم */
export function aiReliability(subs) {
  const t = {};
  subs.forEach((x) => {
    if (!x.ai?.errors || !x.tjDone || !x.teacher) return;
    const marked = new Set((x.tj || []).map((m) => `${m.i}:${m.r}`));
    x.ai.errors.forEach((e) => {
      t[e.r] = t[e.r] || [0, 0];
      t[e.r][0]++;
      if (marked.has(`${e.i}:${e.r}`)) t[e.r][1]++;
    });
  });
  return t; // { rule: [suggested, accepted] }
}
export const ruleName = (k) => (RULES[k] || EXTRA[k] || { name: k }).name;

// احتمالات أولية قبل أي تقييم
const PRIOR = { default: 0.15, makhraj: 0.03, haraka: 0.03 };
const PRIOR_N = 6; // قوة الاحتمال الأولي (كم تقييماً "افتراضياً")
const STUDENT_K = 4; // كم يزن المتوسط العام مقابل سجل الطالب

const cache = new Map();
/** الأحكام في كل كلمة من المقطع: مصفوفة من مجموعات */
export function segmentRules(surah, from, to) {
  const key = `${surah}:${from}:${to}`;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (let a = from; a <= to; a++) {
    analyzeAyah(ayahWords(surah, a)).forEach((parts) => {
      out.push([...new Set(parts.map((p) => p.rule).filter((r) => r && r !== 'silent'))]);
    });
  }
  cache.set(key, out);
  return out;
}

/** عدّ مواضع الأحكام والأخطاء في التسليمات المقيّمة */
function tally(subs) {
  const t = {};
  const add = (r, occ, err) => { t[r] = t[r] || [0, 0]; t[r][0] += occ; t[r][1] += err; };
  subs.forEach((x) => {
    if (!x.teacher || !x.tjDone) return;
    const words = segmentRules(x.surah, x.from, x.to);
    words.forEach((rs) => rs.forEach((r) => add(r, 1, 0)));
    add('makhraj', words.length, 0);
    add('haraka', words.length, 0);
    (x.tj || []).forEach((m) => add(m.r, 0, 1));
  });
  return t;
}

const priorOf = (r) => PRIOR[r] ?? PRIOR.default;
const globalRate = (model, r) => {
  const [occ, err] = model?.rates?.[r] || [0, 0];
  return (err + PRIOR_N * priorOf(r)) / (occ + PRIOR_N);
};

/** معدلات الخطأ الخاصة بطالب: سجله مدموجاً مع المتوسط العام */
export function studentRates(model, mySubs) {
  const mine = tally(mySubs);
  const keys = new Set([...Object.keys(RULES), ...Object.keys(EXTRA), ...Object.keys(model?.rates || {})]);
  const rates = {};
  keys.forEach((r) => {
    if (r === 'silent') return;
    const g = globalRate(model, r);
    const [occ, err] = mine[r] || [0, 0];
    rates[r] = (err + STUDENT_K * g) / (occ + STUDENT_K);
  });
  return rates;
}

/** خصائص التسليم المستخدمة في توقع الدرجة */
function features(x, rates) {
  const words = segmentRules(x.surah, x.from, x.to);
  const n = Math.max(1, words.length);
  let risk = 0;
  words.forEach((rs) => rs.forEach((r) => (risk += rates[r] ?? priorOf(r))));
  risk += n * ((rates.makhraj ?? PRIOR.makhraj) + (rates.haraka ?? PRIOR.haraka));
  const acc = x.percent != null ? x.percent / 100 : 0.85;
  const fast = x.wpm > 140 ? 1 : 0;
  return [1, acc, risk / n, risk, fast];
}

// أوزان أولية معقولة: الدرجة ≈ ١٠×دقة الحفظ − خصم لكثافة أخطاء التجويد المتوقعة ولعددها
// الخصائص: [ثابت، دقة الحفظ، كثافة الأخطاء المتوقعة لكل كلمة، عدد الأخطاء المتوقعة، سرعة زائدة]
const W0 = [0, 10, -3, -0.25, -0.5];
const LAMBDA = [1.5, 1.5, 1.5, 0.5, 1.5];
const NF = W0.length;

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** تدريب النموذج من كل التسليمات المقيّمة (يُعاد بعد كل تقييم، ويستغرق أجزاء من الثانية) */
export function train(subs) {
  const graded = subs.filter((x) => x.teacher && typeof x.teacher.total === 'number');
  const model = { rates: tally(graded), w: W0.slice(), n: graded.length, tjN: graded.filter((x) => x.tjDone).length, at: new Date().toISOString() };
  if (graded.length) {
    const byStudent = new Map();
    graded.forEach((x) => { if (!byStudent.has(x.pn)) byStudent.set(x.pn, []); byStudent.get(x.pn).push(x); });
    const A = Array.from({ length: NF }, () => new Array(NF).fill(0));
    const b = new Array(NF).fill(0);
    graded.forEach((x) => {
      // نستبعد التسليم نفسه من معدلات الطالب حتى لا "يغش" النموذج
      const others = byStudent.get(x.pn).filter((y) => y !== x);
      const f = features(x, studentRates(model, others));
      for (let i = 0; i < NF; i++) { b[i] += f[i] * x.teacher.total; for (let j = 0; j < NF; j++) A[i][j] += f[i] * f[j]; }
    });
    for (let i = 0; i < NF; i++) { A[i][i] += LAMBDA[i]; b[i] += LAMBDA[i] * W0[i]; }
    const w = solve(A, b);
    if (w && w.every(Number.isFinite)) model.w = w;
  }
  return model;
}

/** توقع درجة المعلم من ١٠ */
export function predict(model, x, rates) {
  const f = features(x, rates);
  const w = model?.w?.length === NF ? model.w : W0;
  const y = f.reduce((s, v, i) => s + v * w[i], 0);
  return Math.max(0, Math.min(10, Math.round(y * 2) / 2));
}

/** الكلمات الأعلى احتمالاً لخطأ تجويدي عند هذا الطالب */
export function riskyWords(x, rates, limit = 8) {
  const words = segmentRules(x.surah, x.from, x.to);
  const out = [];
  words.forEach((rs, i) => {
    if (!rs.length) return;
    let ok = 1;
    let top = null;
    rs.forEach((r) => { const p = rates[r] ?? priorOf(r); ok *= 1 - p; if (!top || p > top.p) top = { r, p }; });
    out.push({ i, risk: 1 - ok, rule: top.r });
  });
  return out.sort((a, b) => b.risk - a.risk).slice(0, limit);
}

/** أضعف الأحكام عند الطالب، مع درجة الثقة (عدد المواضع التي قيّمها المعلم) */
export function weakRules(model, mySubs, limit = 4) {
  const mine = tally(mySubs);
  const rates = studentRates(model, mySubs);
  return Object.entries(rates)
    .map(([r, p]) => ({ r, p, seen: (mine[r] || [0, 0])[0], errs: (mine[r] || [0, 0])[1] }))
    .filter((x) => x.errs > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, limit);
}

/** ضغط النموذج للحفظ في قاعدة البيانات */
export const pack = (m) => ({ rates: m.rates, w: m.w.map((v) => Math.round(v * 1000) / 1000), n: m.n, tjN: m.tjN, at: m.at });
