// الأخطاء ودرجاتها: قائمة يضبطها المعلم (لفظية وتجويد)، لكل خطأ خصم وحد أقصى في المقطع الواحد
import { RULES } from './tajweed.js';
import { EXTRA } from './learn.js';
import { gradeV2 } from './grading.js';

export const CATS = { verbal: 'الأخطاء اللفظية', tajweed: 'أخطاء التجويد' };

/** القائمة الافتراضية */
export function defaultCatalog() {
  const verbal = [
    ['v_missing', 'نسيان كلمة', 0.25, 3],
    ['v_wrong', 'تبديل كلمة', 0.25, 3],
    ['v_extra', 'زيادة كلمة', 0.25, 2],
    ['haraka', 'خطأ في الحركة', 0.25, 2],
    ['makhraj', 'خطأ في الحرف أو المخرج', 0.25, 2],
    ['v_ayah', 'نسيان آية', 0.5, 3],
    ['v_hesitate', 'تردد أو تكرار', 0.125, 1],
    ['v_prompt', 'فتح المعلم عليه', 0.25, 2],
  ];
  const heavy = new Set(['madd_lazim', 'madd_muttasil']);
  const tajweed = [
    ...Object.keys(RULES).filter((k) => k !== 'silent').map((k) => [k, RULES[k].name, heavy.has(k) ? 0.25 : 0.125, 1]),
    ...['madd_tabii', 'madd_leen', 'tajweed_other'].map((k) => [k, EXTRA[k].name, 0.125, 1]),
  ];
  const map = (arr, cat) => arr.map(([key, name, d, max]) => ({ key, name, d, max, cat, builtin: true }));
  return { items: [...map(verbal, 'verbal'), ...map(tajweed, 'tajweed')], v: 2 };
}

/** يدمج قائمة المعلم المحفوظة مع الافتراضية (لتظهر أي أخطاء افتراضية جديدة) */
export function mergeCatalog(saved) {
  const def = defaultCatalog();
  if (!saved?.items?.length) return def;
  // النظام الميسّر: الأخطاء الافتراضية التي لم يغيّر المعلم خصمها تأخذ الخصم الجديد
  const OLD = { v_missing: 0.5, v_wrong: 0.5, v_extra: 0.5, haraka: 0.5, makhraj: 0.5, v_ayah: 1, v_hesitate: 0.25, v_prompt: 0.5 };
  const items = (saved.v || 1) >= 2 ? saved.items : saved.items.map((x) => {
    const nd = def.items.find((d) => d.key === x.key);
    if (!x.builtin || !nd) return x;
    const old = OLD[x.key] ?? (nd.cat === 'tajweed' ? nd.d * 2 : null);
    return x.d === old ? { ...x, d: nd.d } : x;
  });
  const have = new Set(items.map((x) => x.key));
  return { ...saved, v: 2, items: [...items, ...def.items.filter((x) => !have.has(x.key))] };
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

/** الدرجة من ١٠ بعد الخصم بالنظام الميسّر: سقف ٣ للفظي و١ للتجويد، و٦ حد أدنى لمن أكمل المقطع */
export const gradeFrom = (ded, cov = 1) => (typeof ded === 'number' ? Math.max(0, Math.round((10 - ded) * 4) / 4) : gradeV2(ded, cov));
