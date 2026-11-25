// 🏅 ترتيب الشهادات: يختار المعلم أساس الترتيب (الشرف على المرحلة، الشرف في الصف، الهمة، التحديات، مجموع الجوائز)
// ويمكنه الجمع بين أكثر من أساس بثلاث طرق: بالأولوية، أو بمجموع نقاط المراكز، أو بأفضل مركز.
// يأخذ الشهادة كل من له مركز ضمن العدد المحدد في أي فئة مختارة، ويُرتَّبون ترتيباً عاماً واحداً:
// الأول ذهبية، والثاني فضية، والثالث برونزية، والبقية خضراء. وتُكتب في كل شهادة مراكز الطالب (بلا مبالغ).
// يُحفظ في leaderboard/certOrd: { on, by: ['hs', ...], mode: 'prio'|'sum'|'best', n: { hs, hc, hm, ch } }
export const ORD_CATS = [
  { k: 'hs', ic: '👑', t: 'الشرف على المرحلة', s: 'شرف' },
  { k: 'hc', ic: '🏆', t: 'الشرف في الصف', s: 'صف', d: 'لكل صف مراكزه' },
  { k: 'hm', ic: '⚡', t: 'الهمة العالية', s: 'همة' },
  { k: 'ch', ic: '⚔️', t: 'التحديات', s: 'تحديات' },
  { k: 'pz', ic: '💰', t: 'مجموع الجوائز', s: 'جوائز', d: 'من حاسبة الجوائز، ولا تظهر المبالغ في الشهادة' },
];
export const ORD_MODES = [
  ['prio', 'بالأولوية', 'يُرتَّب بالطريقة الأولى، ومن تساووا فيها يُفصل بينهم بالثانية ثم الثالثة'],
  ['sum', 'بمجموع نقاط المراكز', 'الأول = ١٠ نقاط، والثاني = ٩… وتُجمع من كل الفئات المختارة'],
  ['best', 'بأفضل مركز', 'يُرتَّب كل طالب بأعلى مركز حصل عليه في أي فئة، ثم بعدد مراكزه'],
];
export const ORD_DEFAULT = { on: false, by: ['hs', 'hm', 'ch'], mode: 'prio', n: { hs: 10, hc: 3, hm: 5, ch: 5 } };
const KS = ORD_CATS.map((c) => c.k);
export function normOrd(o) {
  const d = ORD_DEFAULT, by = (Array.isArray(o?.by) ? o.by : d.by).filter((k, i, a) => KS.includes(k) && a.indexOf(k) === i);
  const n = {}; ['hs', 'hc', 'hm', 'ch'].forEach((k) => (n[k] = Math.min(10, Math.max(1, Math.round(+o?.n?.[k] || d.n[k])))));
  return { on: !!o?.on && by.length > 0, by: by.length ? by : d.by.slice(), mode: ORD_MODES.some(([m]) => m === o?.mode) ? o.mode : 'prio', n };
}

const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ord = (r) => ORD[r] || String(r);
/** نص شارة المركز في الشهادة */
export function placeText(k, r) {
  return k === 'hs' ? `👑 ${ord(r)} على المرحلة في الشرف` : k === 'hc' ? `🏆 ${ord(r)} في صفه` : k === 'hm' ? `⚡ ${ord(r)} في الهمة العالية` : k === 'ch' ? `⚔️ ${ord(r)} في التحديات` : '';
}
/** نص مختصر للجدول: «👑 ١ شرف» */
export const placeShort = (k, r, arD = String) => { const c = ORD_CATS.find((x) => x.k === k); return c ? `${c.ic} ${arD(r)} ${c.s}` : ''; };
/** لقب الشهادة وسطرها حين لا يكون الطالب من فائزي لوحة الشرف المعتادين */
export function placeTitle(p) {
  const r = ord(p.r);
  if (p.k === 'hs') return { title: `المركز ${r} على المرحلة`, line: `المركز ${r} على المرحلة في لوحة الشرف` };
  if (p.k === 'hc') return { title: `المركز ${r} في الصف`, line: `المركز ${r} في صفه في لوحة الشرف` };
  if (p.k === 'hm') return { title: 'صاحب الهمة العالية', line: `المركز ${r} على المرحلة في الهمة العالية`, special: 'hm' };
  return { title: 'فارس التحديات', line: `المركز ${r} على المرحلة في تحديات الزملاء`, special: 'ch' };
}

/**
 * rows: [{ pn, name, hs, hc, hm, ch }] (المراكز أرقام أو null)
 * prizes: ناتج computePrizes إن كان «مجموع الجوائز» مختاراً
 * يعيد { list: [{ pn, name, rank, places: [{k, r}], score }], by: { pn: item } }
 */
export function orderCerts(rows, cfg, prizes = null) {
  const C = normOrd({ ...cfg, on: true }), BY = C.by;
  const pz = {};
  if (BY.includes('pz') && prizes?.list) {
    // مركز الطالب في مجموع الجوائز (من يتساوى مبلغه يتساوى مركزه)
    let last = null, rk = 0;
    prizes.list.forEach((x, i) => { if (x.total !== last) { rk = i + 1; last = x.total; } pz[x.pn] = { r: rk, items: x.items.filter((y) => !y.off) }; });
  }
  const out = [];
  rows.forEach((row) => {
    const R = {}, places = [];
    BY.forEach((k) => {
      if (k === 'pz') { if (pz[row.pn]) { R.pz = pz[row.pn].r; pz[row.pn].items.forEach((y) => { if (!places.some((p) => p.k === y.k)) places.push({ k: y.k, r: y.rank }); }); } return; }
      const r = row[k]; if (r && r <= C.n[k]) { R[k] = r; if (!places.some((p) => p.k === k)) places.push({ k, r }); }
    });
    if (!Object.keys(R).length) return;
    // تُكتب في الشهادة مراكزه في بقية الفئات أيضاً (ضمن العدد المحدد لكل فئة) وإن لم تكن أساساً للترتيب
    ['hs', 'hc', 'hm', 'ch'].forEach((k) => { const r = row[k]; if (r && r <= C.n[k] && !places.some((p) => p.k === k)) places.push({ k, r }); });
    places.sort((a, b) => a.r - b.r || BY.indexOf(a.k) - BY.indexOf(b.k));
    const score = Object.values(R).reduce((s, r) => s + Math.max(1, 11 - r), 0);
    out.push({ pn: row.pn, name: row.name || '', R, places, score, best: Math.min(...Object.values(R)) });
  });
  const prio = (a, b) => { for (const k of BY) { const x = a.R[k] || Infinity, y = b.R[k] || Infinity; if (x !== y) return x - y; } return 0; };
  const cmp = C.mode === 'sum' ? (a, b) => b.score - a.score || prio(a, b)
    : C.mode === 'best' ? (a, b) => a.best - b.best || b.places.length - a.places.length || b.score - a.score || prio(a, b)
    : prio;
  out.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, 'ar'));
  out.forEach((x, i) => (x.rank = i + 1));
  return { list: out, by: Object.fromEntries(out.map((x) => [x.pn, x])), cfg: C };
}
