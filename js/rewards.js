// المكافآت: أوسمة تُفتح بالإنجاز، ومتجر إطارات وألقاب وألوان ورموز وتأثيرات يُشترى بـ«🪙 المكافآت»،
// وزينة الاسم (الإطار واللقب واللون والرمز) تظهر بجانب اسم الطالب في كل مكان.
// المكافآت = نقاط لوحة الشرف (منذ البداية) + مكافآت الأوسمة − ما أنفقه. الشراء لا يُنقص نقاط لوحة الشرف.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ar = (n) => String(n).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);

/* ---------------- المتجر ---------------- */
// kind: frame إطار | title لقب | color لون الاسم | icon رمز | fx تأثير احتفال | badge وسام (يمنحه المعلم أو يُشترى)
export const KINDS = { frame: '🖼️ إطارات', title: '🏷️ ألقاب', color: '🎨 ألوان الاسم', icon: '✨ رموز', fx: '🎆 تأثيرات الاحتفال', badge: '🏅 أوسمة خاصة' };
export const SLOT = { frame: 'f', title: 't', color: 'c', icon: 'i', fx: 'x' }; // مكان كل نوع في زينة الاسم
export const CATALOG = [
  { id: 'f-green', kind: 'frame', name: 'إطار زمردي', v: 'green', price: 30 },
  { id: 'f-silver', kind: 'frame', name: 'إطار فضي', v: 'silver', price: 40 },
  { id: 'f-stars', kind: 'frame', name: 'إطار النجوم', v: 'stars', price: 60 },
  { id: 'f-gold', kind: 'frame', name: 'إطار ذهبي', v: 'gold', price: 90 },
  { id: 'f-crown', kind: 'frame', name: 'إطار التاج الملكي', v: 'crown', price: 0, need: 'streak:3', rare: true },
  // الألقاب لا تُشترى: تُنال بالإنجاز (earn) أو يمنحها المعلم
  // لكل لقب ثلاثة مستويات: 🥉 برونزي بالعدد المكتوب، 🥈 فضي بضعفه، 🥇 ذهبي بثلاثة أضعافه
  { id: 't-flag', kind: 'title', name: 'حامل الراية', v: 'حامل الراية', earn: 'days:10' },
  { id: 't-himma', kind: 'title', name: 'صاحب الهمّة', v: 'صاحب الهمّة', earn: 'streak:15' },
  { id: 't-rafiq', kind: 'title', name: 'رفيق القرآن', v: 'رفيق القرآن', earn: 'streak:20' },
  { id: 't-faris', kind: 'title', name: 'فارس التحديات', v: 'فارس التحديات', earn: 'wins:15' },
  { id: 't-star', kind: 'title', name: 'نجم المقرأة', v: 'نجم المقرأة', earn: 'voices:2' },
  { id: 't-mutqin', kind: 'title', name: 'المُتقِن', v: 'المُتقِن', earn: 'perfect:10' },
  { id: 't-fajr', kind: 'title', name: 'فجر الهمّة', v: 'فجر الهمّة', earn: 'fajr:5' },
  { id: 't-night', kind: 'title', name: 'قارئ الليل', v: 'قارئ الليل', earn: 'night:10' },
  { id: 't-back', kind: 'title', name: 'العائد بقوة', v: 'العائد بقوة', earn: 'back:7' },
  { id: 't-amma', kind: 'title', name: 'حافظ جزء عمّ', v: 'حافظ جزء عمّ', earn: 'amma:1' },
  { id: 't-brave', kind: 'title', name: 'المقدام', v: 'المقدام', earn: 'brave:20' },
  { id: 't-champ', kind: 'title', name: 'بطل الدوري', v: 'بطل الدوري', earn: 'champ:1' },
  { id: 't-athar', kind: 'title', name: 'صاحب الأثر', v: 'صاحب الأثر', earn: 'top:1' },
  { id: 't-iqra', kind: 'title', name: 'صاعد اقرأ وارتقِ', v: 'صاعد اقرأ وارتقِ', earn: 'iqra:10' },
  { id: 't-fix', kind: 'title', name: 'مُصحِّح أخطائه', v: 'مُصحِّح أخطائه', earn: 'fixed:20' },
  { id: 'c-emerald', kind: 'color', name: 'زمردي', v: '#0f8a5f', price: 15 },
  { id: 'c-ruby', kind: 'color', name: 'ياقوتي', v: '#c0263e', price: 15 },
  { id: 'c-royal', kind: 'color', name: 'أزرق ملكي', v: '#2554c7', price: 15 },
  { id: 'c-violet', kind: 'color', name: 'بنفسجي', v: '#7b3fbf', price: 20 },
  { id: 'c-gold', kind: 'color', name: 'ذهبي', v: '#b8860b', price: 35 },
  { id: 'i-moon', kind: 'icon', name: 'هلال', v: '🌙', price: 10 },
  { id: 'i-star', kind: 'icon', name: 'نجمة', v: '⭐', price: 10 },
  { id: 'i-book', kind: 'icon', name: 'مصحف', v: '📖', price: 10 },
  { id: 'i-gem', kind: 'icon', name: 'جوهرة', v: '💎', price: 25 },
  { id: 'i-lion', kind: 'icon', name: 'أسد', v: '🦁', price: 25 },
  { id: 'i-dove', kind: 'icon', name: 'حمامة', v: '🕊️', price: 20 },
  { id: 'x-fire', kind: 'fx', name: 'ألعاب نارية', v: 'fire', price: 40 },
  { id: 'x-stars', kind: 'fx', name: 'مطر النجوم', v: 'stars', price: 40 },
  { id: 'x-moon', kind: 'fx', name: 'أهلّة ذهبية', v: 'moon', price: 50 },
];
/** المتجر الفعلي: القائمة الأساسية مع تعديلات المعلم (السعر، الإخفاء) وما أضافه.
    الألقاب لا تُباع أبداً: لقب بلا شرط إنجاز يمنحه المعلم فقط */
export function shopItems(shop) {
  const mods = shop?.items || {};
  const base = CATALOG.map((x) => ({ ...x, ...(mods[x.id] || {}) }));
  const extra = Object.values(mods).filter((x) => x && x.custom && !CATALOG.some((c) => c.id === x.id));
  return [...base, ...extra].filter((x) => !x.deleted).map((x) => (x.kind === 'title' ? { ...x, price: 0, grantOnly: !x.earn } : x));
}

/* ---------------- شروط الألقاب ومستوياتها ---------------- */
// ctx: { days, streak, wins, voices, perfect, fajr, night, back, amma:[عدد مرات تسميع كل سورة من جزء عمّ], brave, champ, top, iqra, fixed }
// المستوى k (١ برونزي، ٢ فضي، ٣ ذهبي) يحتاج need(n, k)؛ والأصل n × k
const cnt = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${ar(n)} ${few}` : `${ar(n)} ${many}`);
const times = (n) => cnt(n, 'مرة واحدة', 'مرتين', 'مرات', 'مرة');
export const MEDALS = ['🥉', '🥈', '🥇'];
export const AMMA = 37; // سور جزء عمّ (٧٨–١١٤)
export const EARN = {
  days: { txt: (n) => `يراجع ${cnt(n, 'يوماً', 'يومين', 'أيام', 'يوماً')} (متتالية أو متفرقة)` },
  streak: { txt: (n) => `يراجع ${cnt(n, 'يوماً', 'يومين', 'أيام', 'يوماً')} دون انقطاع` },
  wins: { need: (n, k) => n * k + 1, txt: (n) => `يفوز في التحديات أكثر من ${ar(n - 1)} مرة` },
  voices: { txt: (n) => `يُختار صوته «صوت الأسبوع» ${times(n)}` },
  perfect: { txt: (n) => `يسمّع ${cnt(n, 'تسميعاً', 'تسميعين', 'تسميعات', 'تسميعاً')} بدقة ١٠٠٪` },
  fajr: { txt: (n) => `يسمّع بين الفجر والشروق في ${cnt(n, 'يوم', 'يومين', 'أيام', 'يوماً')}` },
  night: { txt: (n) => `يسمّع بعد صلاة العشاء في ${cnt(n, 'ليلة', 'ليلتين', 'ليالٍ', 'ليلة')}` },
  back: { txt: (n) => `يعود بعد انقطاع أسبوع فأكثر ثم يواظب ${cnt(n, 'يوماً', 'يومين', 'أيام', 'يوماً')} متتالية` },
  amma: { need: (n, k) => k, txt: (k) => `يسمّع سور جزء عمّ كلها بدقة ٨٥٪ فأكثر${k > 1 ? ` (${times(k)})` : ''}`,
    val: (ctx) => (ctx.amma?.length ? Math.min(...ctx.amma) : 0), prog: (ctx, k) => ({ have: (ctx.amma || []).filter((c) => c >= k).length, need: AMMA, unit: 'سورة' }) },
  brave: { txt: (n) => `يقبل ${cnt(n, 'تحدياً', 'تحديين', 'تحديات', 'تحدياً')} ويشارك فيها، فاز أو خسر` },
  champ: { txt: (n) => `يفوز بنهائي مسابقة الأبطال ${times(n)}` },
  top: { txt: (n) => `يكون الأول في لوحة الشرف (في صفه أو على المرحلة) ${n === 1 ? 'شهراً' : n === 2 ? 'شهرين' : ar(n) + ' أشهر'}` },
  iqra: { txt: (n) => `يُتقن ${cnt(n, 'درساً', 'درسين', 'دروس', 'درساً')} في «اقرأ وارتقِ»` },
  fixed: { txt: (n) => `يُصلح ${cnt(n, 'خطأً', 'خطأين', 'أخطاء', 'خطأً')} من دفتر الأخطاء (يعيد الموضع صحيحاً)` },
};
const parseEarn = (e) => { const [k, n] = String(e || '').split(':'); return EARN[k] ? { k, n: +n || 1, E: EARN[k] } : null; };
const needOf = (e, k) => (e.E.need ? e.E.need(e.n, k) : e.n * k);
const valOf = (e, ctx) => (e.E.val ? e.E.val(ctx) : ctx?.[e.k] || 0);
/** نص شرط المستوى k (١ افتراضاً) */
export const earnText = (it, k = 1) => { const e = parseEarn(it.earn); return e ? e.E.txt(needOf(e, k)) : ''; };
/** أعداد المستويات الثلاثة، مثل «🥉 ١٠ · 🥈 ٢٠ · 🥇 ٣٠» */
export const earnSteps = (it) => { const e = parseEarn(it.earn); return e ? [1, 2, 3].map((k) => `${MEDALS[k - 1]} ${e.k === 'amma' ? '×' + ar(k) : e.k === 'wins' ? '+' + ar(needOf(e, k) - 1) : ar(needOf(e, k))}`).join(' · ') : ''; };
/** المستوى المستحق (٠ لم يُنل، ١ برونزي، ٢ فضي، ٣ ذهبي) */
export function earnLevel(it, ctx) {
  const e = parseEarn(it.earn); if (!e) return 0;
  const v = valOf(e, ctx);
  return [1, 2, 3].filter((k) => v >= needOf(e, k)).length;
}
/** {lvl, next, have, need, unit, txt} تقدّم اللقب نحو مستواه التالي (next=null عند الذهبي) */
export function earnProgress(it, ctx) {
  const e = parseEarn(it.earn); if (!e) return null;
  const lvl = earnLevel(it, ctx), next = lvl < 3 ? lvl + 1 : null;
  if (!next) return { lvl, next, done: true };
  const need = needOf(e, next), p = e.E.prog ? e.E.prog(ctx, next) : { have: valOf(e, ctx), need };
  return { lvl, next, have: Math.min(p.have, p.need), need: p.need, unit: p.unit || '', txt: e.E.txt(need), done: lvl >= 1 };
}
export const itemById = (shop, id) => shopItems(shop).find((x) => x.id === id);

/* ---------------- الأوسمة ---------------- */
// مستويات: برونزي، فضي، ذهبي. coins: مكافأة كل مستوى. المخفية تظهر «؟» حتى تُفتح
export const LEVELS = ['🥉 برونزي', '🥈 فضي', '🥇 ذهبي'];
export const ACH = [
  { id: 'streak', icon: '🔥', name: 'المداوم', desc: (n) => `${ar(n)} أيام متتالية مع القرآن`, at: [7, 30, 100], coins: [10, 25, 60] },
  { id: 'count', icon: '🎙️', name: 'المسمِّع', desc: (n) => `${ar(n)} تسميعاً`, at: [10, 50, 200], coins: [10, 25, 60] },
  { id: 'fajr', icon: '🌅', name: 'فجر الهمّة', desc: () => 'سمّع بين الفجر والشروق', hidden: true, coins: [20] },
  { id: 'back', icon: '🌱', name: 'العائد', desc: () => 'عاد إلى التسميع بعد انقطاع أسبوعين', hidden: true, coins: [15] },
  { id: 'jumuah', icon: '🕌', name: 'سبّاق الجمعة', desc: () => 'سمّع يوم الجمعة قبل الظهر', hidden: true, coins: [15] },
];
/** المستوى المستحق لكل وسام من بيانات الطالب. ctx: {streak, best, count, subs[], days:Set, prayer(dayMs)->times} */
export function achLevels(ctx) {
  const out = {};
  const best = Math.max(ctx.streak || 0, ctx.best || 0);
  const lv = (a, v) => a.at.reduce((n, t, i) => (v >= t ? i + 1 : n), 0);
  out.streak = lv(ACH[0], best);
  out.count = lv(ACH[1], ctx.count || 0);
  const times = (ctx.subs || []).map((x) => Date.parse(x.createdAt)).filter(Boolean);
  if (ctx.prayer) {
    if (times.some((t) => { const p = ctx.prayer(t); return t >= p.fajr && t < p.sunrise; })) out.fajr = 1;
    if (times.some((t) => { const p = ctx.prayer(t); const d = new Date(t + 3 * 3600e3); return d.getUTCDay() === 5 && t < p.dhuhr; })) out.jumuah = 1;
  }
  const days = [...(ctx.days || [])].sort();
  for (let i = 1; i < days.length; i++) if ((Date.parse(days[i]) - Date.parse(days[i - 1])) / 864e5 >= 14) { out.back = 1; break; }
  return out;
}
/** مكافآت الأوسمة المفتوحة */
export const achCoins = (ach) => ACH.reduce((n, a) => n + a.coins.slice(0, ach?.[a.id] || 0).reduce((s, c) => s + c, 0), 0);
/** هل يحقق شرط القطعة النادرة؟ need = 'streak:3' (وسام بمستوى) */
export function meetsNeed(it, ach) {
  if (!it.need) return true;
  const [id, l] = it.need.split(':');
  return (ach?.[id] || 0) >= (+l || 1);
}

/* ---------------- الرصيد ---------------- */
/** الرصيد: نقاط لوحة الشرف كلها + مكافآت الأوسمة والمعلم − المنفَق */
export function balance(points, wallet) {
  return Math.max(0, Math.floor(points || 0) + Math.floor(wallet?.bonus || 0) - Math.floor(wallet?.spent || 0));
}

/* ---------------- زينة الاسم ---------------- */
let LOOKS = {};
export const setLooks = (m) => { LOOKS = m || {}; decorateAll(); };
export const lookOf = (pn) => LOOKS[pn] || null;
export function setLook(pn, look) { LOOKS = { ...LOOKS, [pn]: look }; decorateAll(); }

/** يُطبّق الزينة على كل عنصر يحمل data-lk="رقم الطالب" (الاسم يبقى نصاً كما هو) */
function decorate(el) {
  const pn = el.dataset.lk, L = LOOKS[pn];
  const sig = JSON.stringify(L || {});
  if (el.dataset.lkSig === sig) return;
  el.dataset.lkSig = sig;
  el.querySelectorAll(':scope > .lk-i, :scope > .lk-t').forEach((x) => x.remove());
  el.classList.remove('lk', 'lk-f-green', 'lk-f-silver', 'lk-f-stars', 'lk-f-gold', 'lk-f-crown');
  el.style.removeProperty('--lkc');
  if (!L) return;
  el.classList.add('lk');
  if (L.f) el.classList.add('lk-f-' + L.f);
  if (L.c) el.style.setProperty('--lkc', L.c);
  if (L.i) el.insertAdjacentHTML('afterbegin', `<span class="lk-i" aria-hidden="true">${esc(L.i)}</span>`);
  if (L.t && el.dataset.lkNoTitle == null) el.insertAdjacentHTML('beforeend', `<span class="lk-t${L.tl ? ' tl' + L.tl : ''}">${L.tl ? MEDALS[L.tl - 1] + ' ' : ''}${esc(L.t)}</span>`);
}
let dq = 0;
export function decorateAll(root = document) {
  root.querySelectorAll?.('[data-lk]').forEach(decorate);
}
if (typeof document !== 'undefined') {
  new MutationObserver(() => { if (dq) return; dq = requestAnimationFrame(() => { dq = 0; decorateAll(); }); }).observe(document.documentElement, { childList: true, subtree: true });
}
/** عنوان الاسم مع الزينة: <b data-lk> */
export const nameTag = (pn, name, tag = 'b') => `<${tag} data-lk="${esc(pn)}">${esc(name)}</${tag}>`;

/* ---------------- تأثير الاحتفال ---------------- */
export function playFx(kind) {
  if (!kind || typeof document === 'undefined') return;
  const sym = kind === 'stars' ? ['⭐', '✨', '🌟'] : kind === 'moon' ? ['🌙', '✨'] : ['🎆', '🎇', '✨'];
  const box = document.createElement('div'); box.className = 'fx-rain'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = Array.from({ length: 26 }, (_, i) => `<span style="--x:${Math.random() * 100}%;--d:${(Math.random() * 0.9).toFixed(2)}s;--s:${(0.8 + Math.random() * 0.9).toFixed(2)}">${sym[i % sym.length]}</span>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}
