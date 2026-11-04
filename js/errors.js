// الأخطاء ودرجاتها: قائمة يضبطها المعلم (لفظية وتجويد)، لكل خطأ خصم وحد أقصى في المقطع الواحد
import { RULES } from './tajweed.js';
import { EXTRA } from './learn.js';

export const CATS = { verbal: 'الأخطاء اللفظية', tajweed: 'أخطاء التجويد' };

/** القائمة الافتراضية */
export function defaultCatalog() {
  const verbal = [
    ['v_missing', 'نسيان كلمة', 0.5, 3],
    ['v_wrong', 'تبديل كلمة', 0.5, 3],
    ['v_extra', 'زيادة كلمة', 0.5, 2],
    ['haraka', 'خطأ في الحركة', 0.5, 2],
    ['makhraj', 'خطأ في الحرف أو المخرج', 0.5, 2],
    ['v_ayah', 'نسيان آية', 1, 3],
    ['v_hesitate', 'تردد أو تكرار', 0.25, 1],
    ['v_prompt', 'فتح المعلم عليه', 0.5, 2],
  ];
  const heavy = new Set(['madd_lazim', 'madd_muttasil']);
  const tajweed = [
    ...Object.keys(RULES).filter((k) => k !== 'silent').map((k) => [k, RULES[k].name, heavy.has(k) ? 0.5 : 0.25, 1]),
    ...['madd_tabii', 'madd_leen', 'tajweed_other'].map((k) => [k, EXTRA[k].name, 0.25, 1]),
  ];
  const map = (arr, cat) => arr.map(([key, name, d, max]) => ({ key, name, d, max, cat, builtin: true }));
  return { items: [...map(verbal, 'verbal'), ...map(tajweed, 'tajweed')], v: 1 };
}

/** يدمج قائمة المعلم المحفوظة مع الافتراضية (لتظهر أي أخطاء افتراضية جديدة) */
export function mergeCatalog(saved) {
  const def = defaultCatalog();
  if (!saved?.items?.length) return def;
  const have = new Set(saved.items.map((x) => x.key));
  return { ...saved, items: [...saved.items, ...def.items.filter((x) => !have.has(x.key))] };
}

export const findErr = (cat, key) => cat.items.find((x) => x.key === key);
export const catOfKey = (cat, key) => findErr(cat, key)?.cat || (RULES[key] || ['madd_tabii', 'madd_leen', 'tajweed_other'].includes(key) ? 'tajweed' : 'verbal');

/** خطأ محدد في كلمة: نحفظ معه اسمه وخصمه وقت التقييم، فلا تتغير الدرجات القديمة إن عُدّلت القائمة */
export function makeMark(cat, i, key) {
  const e = findErr(cat, key);
  return { i, r: key, n: e?.name || key, d: e?.d ?? 0.25, max: e?.max ?? null, c: e?.cat || catOfKey(cat, key) };
}

/** مجموع الخصم: لكل مرة، ولا يتجاوز مجموع النوع الواحد حده الأقصى */
export function deduction(marks, cat) {
  const by = new Map();
  (marks || []).forEach((m) => {
    const e = findErr(cat, m.r);
    const d = m.d ?? e?.d ?? 0.25, max = m.max ?? e?.max ?? null;
    const g = by.get(m.r) || { key: m.r, name: m.n || e?.name || m.r, c: m.c || e?.cat || catOfKey(cat, m.r), d, max, count: 0 };
    g.count++;
    by.set(m.r, g);
  });
  const groups = [...by.values()].map((g) => ({ ...g, sum: Math.round((g.max != null && g.max > 0 ? Math.min(g.count * g.d, g.max) : g.count * g.d) * 100) / 100 }));
  const tot = (c) => groups.filter((g) => !c || g.c === c).reduce((n, g) => n + g.sum, 0);
  return { groups, total: Math.round(tot() * 100) / 100, verbal: tot('verbal'), tajweed: tot('tajweed') };
}

/** الدرجة من ١٠ بعد الخصم (بأقرب ربع درجة، ولا تقل عن صفر) */
export const gradeFrom = (ded) => Math.max(0, Math.round((10 - ded) * 4) / 4);
