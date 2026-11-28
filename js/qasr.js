// 🏰 أرض المقرأة و📖 وقف المصاحف
// - خريطة واحدة لكل الطلاب: يشتري الطالب قطعة أرض بعملاته ويبني عليها قصره (١٢ مرحلة)، ثم قطعة ثانية للتوسعة بعد إكمال قصره.
// - من داخل القصر: أثاث وغرف تُشترى وتُرقّى، وقاعة أوسمة تعرض ألقابه وشهاداته.
// - في وسط الخريطة «دار وقف المصاحف»: يتبرع الطلاب بعملاتهم، وعند بلوغ الهدف تُهدى مصاحف حقيقية عن الجميع ويُوثَّق ذلك بفيديو.
// - المعلم يحدد من يرى كل ميزة: الجميع، أو طلاب معيّنون، أو لا أحد.
import { store } from './store.js';
import { toArabicDigits as ar } from './quran.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => ar(Math.round(n || 0).toLocaleString('en-US').replace(/,/g, '٬'));
const nWord = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${ar(n)} ${few}` : `${ar(n)} ${many}`);

/* ------------------------------------------------ الأسعار والمراحل */
export const PLOT_PRICE = 300, EXT_PLOT_PRICE = 500;
export const STAGES = [
  [1, '🧱', 'الأساس والسور', 100], [2, '🏛️', 'المبنى الرئيسي والباب', 200], [3, '🪟', 'النوافذ والشرفة', 300], [4, '🏯', 'الشرفات المسننة', 400],
  [5, '🗼', 'برجا الواجهة', 700], [6, '🚪', 'بوابة السور واسم القصر', 800], [7, '⛲', 'الفناء والنافورة والفوانيس', 1200], [8, '🕌', 'قبة الزينة', 1500],
  [9, '🏰', 'برجا الخلف', 2000], [10, '🚩', 'الرايات والزخارف الذهبية', 2500], [11, '🌴', 'النخيل وحديقة الزهور', 2500], [12, '✨', 'قصر من نور', 5000],
];
export const MAT = [[0, 'حجر رملي', 0], [1, 'رخام أبيض', 1500], [2, 'مرصّع بالذهب', 4000]];
export const DOMES = [['teal', 'فيروزي', 0], ['blue', 'أزرق ملكي', 300], ['green', 'زمردي', 300], ['gold', 'ذهبي', 600]];
export const EXT = [[1, '🌴', 'بستان النخيل', 800], [2, '🐎', 'إسطبل وخيل عربية', 1500], [3, '🌉', 'بحيرة وجسر', 2500], [4, '🕌', 'دار الضيافة', 4000]];
// أثاث الداخل: lv = درجات (خشب، نحاس، ذهب) أو رفوف
export const ROOM = [
  { k: 'rug', ic: '🧶', t: 'سجادة مزخرفة', p: [150], v: 'all' },
  { k: 'majlis', ic: '🛋️', t: 'جلسة عربية', p: [300, 600, 1200], lv: ['خشب', 'نحاس', 'ذهب'], v: 'majlis' },
  { k: 'dallah', ic: '☕', t: 'دلّة وفناجين', p: [150], v: 'majlis' },
  { k: 'shelf', ic: '📚', t: 'رفوف المكتبة', p: [300, 400], lv: ['رف أول', 'رف ثانٍ'], v: 'library' },
  { k: 'plaque', ic: '🖼️', t: 'لوحة «وَقُل رَّبِّ زِدْنِي عِلْمًا»', p: [200], v: 'library' },
  { k: 'trophy', ic: '🏆', t: 'خزانة الكؤوس (بعدد ألقابك)', p: [400], v: 'trophy' },
  { k: 'certw', ic: '📜', t: 'جدار الشهادات (بعدد شهاداتك)', p: [300], v: 'trophy' },
  { k: 'chand', ic: '✨', t: 'ثريا ذهبية', p: [400], v: 'all' },
  { k: 'lanterns', ic: '🏮', t: 'فوانيس جدارية', p: [200], v: 'all' },
];
export const QASR_DEFAULT = { vis: 'none', pns: [], n: 9 };
export const visibleTo = (c, pn) => !!c && (c.vis === 'all' || (c.vis === 'some' && (c.pns || []).includes(pn)));

/* ------------------------------------------------ الوقف */
export const WAQF_TYPES = {
  mushaf: { ic: '📖', t: 'وقف المصاحف', unit: 'مصحف', units: 'مصاحف', unitsMany: 'مصحفاً' },
  masjid: { ic: '🕌', t: 'وقف مسجد', unit: 'سهم', units: 'أسهم', unitsMany: 'سهماً' },
  water: { ic: '💧', t: 'سقيا ماء', unit: 'سقيا', units: 'سقيا', unitsMany: 'سقيا' },
  lib: { ic: '📚', t: 'وقف كتب علمية', unit: 'كتاب', units: 'كتب', unitsMany: 'كتاباً' },
  custom: { ic: '🤲', t: 'وقف خيري', unit: 'سهم', units: 'أسهم', unitsMany: 'سهماً' },
};
export const WAQF_TEXTS = [
  { id: 'q1', q: 1, t: 'إِنَّ الَّذِينَ يَتْلُونَ كِتَابَ اللَّهِ وَأَقَامُوا الصَّلَاةَ وَأَنفَقُوا مِمَّا رَزَقْنَاهُمْ سِرًّا وَعَلَانِيَةً يَرْجُونَ تِجَارَةً لَّن تَبُورَ', s: 'فاطر: ٢٩' },
  { id: 'q2', q: 1, t: 'مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنبُلَةٍ مِّائَةُ حَبَّةٍ', s: 'البقرة: ٢٦١' },
  { id: 'q3', q: 1, t: 'لَن تَنَالُوا الْبِرَّ حَتَّىٰ تُنفِقُوا مِمَّا تُحِبُّونَ', s: 'آل عمران: ٩٢' },
  { id: 'q4', q: 1, t: 'وَمَا تُقَدِّمُوا لِأَنفُسِكُم مِّنْ خَيْرٍ تَجِدُوهُ عِندَ اللَّهِ', s: 'البقرة: ١١٠' },
  { id: 'q5', q: 1, t: 'إِنَّا نَحْنُ نُحْيِي الْمَوْتَىٰ وَنَكْتُبُ مَا قَدَّمُوا وَآثَارَهُمْ', s: 'يس: ١٢' },
  { id: 'q6', q: 1, t: 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ', s: 'المائدة: ٢' },
  { id: 'h1', t: 'إنَّ مما يلحقُ المؤمنَ من عملِه وحسناتِه بعد موتِه: علمًا علَّمه ونشره، وولدًا صالحًا تركه، ومصحفًا ورَّثه، أو مسجدًا بناه…', s: 'رواه ابن ماجه، وحسّنه الألباني' },
  { id: 'h2', t: 'إذا مات الإنسانُ انقطع عنه عملُه إلا من ثلاثة: إلا من صدقةٍ جارية، أو علمٍ يُنتفع به، أو ولدٍ صالح يدعو له', s: 'رواه مسلم' },
  { id: 'h3', t: 'خيرُكم من تعلَّم القرآنَ وعلَّمه', s: 'رواه البخاري' },
  { id: 'h4', t: 'من دلَّ على خيرٍ فله مثلُ أجرِ فاعله', s: 'رواه مسلم' },
  { id: 'h5', t: 'ما نقصت صدقةٌ من مال', s: 'رواه مسلم' },
];
export const WAQF_DEFAULT_TEXTS = ['q1', 'h1', 'q2', 'h2'];
/** مجموع التبرعات ومشاركات كل طالب (لوقف بعينه) */
export function waqfSum(W, don) {
  const L = Object.entries(don || {}).filter(([k, v]) => k !== '_id' && v?.pn && v.w === W?.id && (don._id === W?.id)).map(([k, v]) => ({ k, ...v }));
  const by = {}; L.forEach((x) => { if (!by[x.pn] || by[x.pn].amt < x.amt) by[x.pn] = x; });
  const list = Object.values(by).sort((a, b) => b.amt - a.amt || (a.at || '').localeCompare(b.at || ''));
  return { list, sum: list.reduce((n, x) => n + (x.amt || 0), 0), mine: (pn) => by[pn] || null };
}
/** رابط تضمين الفيديو (يوتيوب أو Google Drive) */
export function videoEmbed(url) {
  const u = String(url || '').trim(); if (!u) return null;
  let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/); if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
}
const unitsTxt = (W, n) => { const T = WAQF_TYPES[W?.type] || WAQF_TYPES.mushaf; return n === 1 ? T.unit + ' واحد' : n === 2 ? (T.unit === 'مصحف' ? 'مصحفان' : T.unit + 'ان') : n <= 10 ? `${ar(n)} ${T.units}` : `${ar(n)} ${T.unitsMany}`; };

/* ================================================================= الطالب */
export function mountQasrStudent(host, ctx) {
  const { me, toast, confetti, openModal, closeModal, confirmBox } = ctx;
  let view = ctx.view || 'map', sc = null, gone = false, CFG = null, W = null, DON = {}, PLOTS = [], sel = null, visit = null, room = 'all', extView = false, M3 = null;
  const coins = () => ctx.coins();
  const N = () => Math.max(5, Math.min(13, (CFG?.n || 9) | 1));
  const center = () => { const c = (N() - 1) / 2; return c + '_' + c; };
  const myPlots = () => PLOTS.filter((p) => p.pn === me.id);
  const mainPlot = () => myPlots().find((p) => !p.main) || null;
  const extPlot = () => myPlots().find((p) => p.main) || null;
  const qOn = () => visibleTo(CFG, me.id), wOn = () => !!W && visibleTo(W, me.id) && W.status !== 'off';
  host.innerHTML = '<div class="loading">جارٍ تجهيز أرض المقرأة…</div>';

  async function load() {
    const [c, w, d, p, m] = await Promise.all([store.getQasrCfg().catch(() => null), store.getWaqf().catch(() => null), store.getWaqfDon().catch(() => ({})), store.listPlots().catch(() => []), import('./qasr3d.js')]);
    CFG = c; W = w; DON = d || {}; PLOTS = p || []; M3 = m; await m.loadThree();
  }
  const kill = () => { sc?.dispose(); sc = null; };
  function shell(tools = '') {
    const tabs = [...(qOn() ? [['map', '🗺️ الخريطة'], ['mine', '🏰 قصري']] : []), ...(wOn() ? [['waqf', `${(WAQF_TYPES[W.type] || WAQF_TYPES.mushaf).ic} الوقف`]] : [])];
    host.innerHTML = `<div class="qs">
      ${tabs.length > 1 ? `<div class="qs-tabs">${tabs.map(([k, l]) => `<button type="button" data-qv="${k}" class="${view === k || (k === 'mine' && ['interior', 'visit'].includes(view) && !visit) ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="q3" id="q3"><div class="q3-top"><span class="q3-pill" id="q3T"></span><span class="q3-pill c">🪙 ${num(coins())}</span></div><div class="q3-tools">${tools}</div><div class="q3-hint" id="q3H"></div></div>
      <div class="card stack qs-card" id="qsCard"></div></div>`;
    host.querySelectorAll('[data-qv]').forEach((b) => (b.onclick = () => go(b.dataset.qv)));
    return host.querySelector('#q3');
  }
  const card = (h) => { const c = host.querySelector('#qsCard'); if (c) c.innerHTML = h; return c; };
  const title = (t) => { const e = host.querySelector('#q3T'); if (e) e.textContent = t; };
  const hint = (t) => { const e = host.querySelector('#q3H'); if (e) { e.textContent = t; e.hidden = !t; } };
  function go(v, opt = {}) { if (gone) return; kill(); view = v; visit = opt.visit || null; if (v === 'map') sel = opt.sel || null; extView = !!opt.ext; draw(); }
  async function spend(price, fn) {
    if (coins() < price) { toast(`رصيدك ${num(coins())} عملة، وتحتاج ${num(price)}. سمّع وتدرّب لتجمع المزيد!`); return false; }
    const spent = ctx.spent() + price;
    try { await fn(spent); ctx.onSpend(spent); return true; } catch (e) { console.warn(e); toast(e.code === 'already-exists' || e.message === 'taken' ? 'سبقك زميل إلى هذه القطعة! اختر غيرها.' : e.code === 'permission-denied' ? 'تعذّر الشراء: تأكد من رصيدك ثم أعد المحاولة.' : 'تعذّر: ' + (e.code || e.message)); return false; }
  }
  function draw() {
    if (gone) return;
    if (!qOn() && !wOn()) { host.innerHTML = '<div class="card">لا يوجد شيء هنا الآن.</div>'; return; }
    if (!qOn() && view !== 'waqf') view = 'waqf';
    if (!wOn() && view === 'waqf') view = 'map';
    if (view === 'map') return drawMap();
    if (view === 'mine' || view === 'visit') return drawPalace();
    if (view === 'interior') return drawInterior();
    if (view === 'waqf') return drawWaqf();
  }

  /* ---------------- الخريطة */
  function drawMap() {
    const el = shell(`<button type="button" class="q3-b" id="qFind" title="ابحث عن زميل">🔍</button>${mainPlot() ? '<button type="button" class="q3-b" id="qMe" title="قصري">🏰</button>' : ''}<button type="button" class="q3-b" id="qIn">＋</button><button type="button" class="q3-b" id="qOut">－</button>`);
    title('🏝️ أرض المقرأة');
    const n = N(), P = 34, span = n * P;
    sc = new M3.Scene3D(el, { dist: span * 0.62, el: 0.85, ang: 0.35, minD: 25, maxD: span * 1.4, target: [0, 0, 0], fov: 45, onTap: (t) => tapMap(t) });
    const W0 = wOn() ? waqfSum(W, DON) : null;
    const M = M3.buildMap(sc, { N: n, plots: PLOTS, me: me.id, sel, center: center(), waqfFill: W0 && W.target ? W0.sum / W.target : 0 });
    sc._tiles = M.tiles;
    hint('👆 اسحب للتنقل، قرّب بإصبعين، اضغط على أي قطعة');
    const mp = mainPlot();
    if (sel) { const [x, z] = M3.plotXY(sel, n); sc.fly({ tx: x, tz: z, ty: 0, dist: 70, el: 0.75 }, 700); }
    host.querySelector('#qIn').onclick = () => sc.zoom(0.75); host.querySelector('#qOut').onclick = () => sc.zoom(1.3);
    const qm = host.querySelector('#qMe'); if (qm) qm.onclick = () => { const [x, z] = M3.plotXY(mp.id, n); sc.fly({ tx: x, tz: z, dist: 60, el: 0.7 }); tapMap({ kind: 'plot', id: mp.id }); };
    host.querySelector('#qFind').onclick = findFriend;
    if (!sel) mapIdle();
    else tapMap({ kind: 'plot', id: sel });
  }
  function mapIdle() {
    const mp = mainPlot(), freeN = N() * N() - 1 - PLOTS.length;
    card(`<b>🏝️ أرض المقرأة</b><p class="small muted" style="margin:0">${nWord(PLOTS.length, 'قصر واحد', 'قصران', 'قصور', 'قصراً')} مبنية، و${nWord(freeN, 'قطعة فارغة', 'قطعتان فارغتان', 'قطع فارغة', 'قطعة فارغة')}.</p>
      ${mp ? `<p style="margin:0">قصرك في القطعة رقم ${plotNo(mp.id)}، المرحلة ${ar(mp.lv || 0)} من ١٢</p><button type="button" class="btn primary" id="qGoMine">🏰 اذهب إلى قصري</button>`
        : `<p style="margin:0">اختر قطعة فارغة على الخريطة لتبني عليها قصرك (${num(PLOT_PRICE)} عملة). تستطيع أن تختار بجوار زملائك 👥</p>`}
      ${wOn() ? `<button type="button" class="btn gold" id="qGoW">${(WAQF_TYPES[W.type] || WAQF_TYPES.mushaf).ic} ${esc(W.title || 'الوقف')}</button>` : ''}`);
    const a = host.querySelector('#qGoMine'); if (a) a.onclick = () => go('mine');
    const b = host.querySelector('#qGoW'); if (b) b.onclick = () => go('waqf');
  }
  const plotNo = (id) => { const [c, r] = id.split('_').map(Number); return ar(r * N() + c + 1); };
  const neighbors = (id) => { const [c, r] = id.split('_').map(Number); return PLOTS.filter((p) => { const [c2, r2] = p.id.split('_').map(Number); return p.pn !== me.id && Math.abs(c2 - c) <= 1 && Math.abs(r2 - r) <= 1 && !(c2 === c && r2 === r); }); };
  function highlight(id) {
    const T = sc?._tiles; if (!T) return;
    Object.entries(T).forEach(([k, m]) => { if (m.userData.base == null) m.userData.base = m.material; m.material = k === id ? (sc._selM ||= m.material.clone()) : m.userData.base; });
    if (sc._selM) { sc._selM.color.set(0xffd666); sc._selM.emissive?.set(0xffb000); sc._selM.emissiveIntensity = 0.7; sc._selM.opacity = 1; }
  }
  function tapMap(t) {
    if (!t) return;
    if (t.kind === 'waqf') { if (wOn()) go('waqf'); return; }
    const id = t.id; sel = id; highlight(id);
    const p = PLOTS.find((x) => x.id === id), mp = mainPlot(), ep = extPlot();
    if (p) {
      const mine = p.pn === me.id, likes = Object.keys(p.likes || {}).length;
      card(`<b>${mine ? '⭐ ' : '🏰 '}قصر ${esc(p.name)}${p.main ? '، توسعة' : ''}</b>
        <p class="small muted" style="margin:0">القطعة رقم ${plotNo(id)}، ${p.main ? `المرحلة ${ar(p.ext || 0)} من ٤` : `المرحلة ${ar(p.lv || 0)} من ١٢`}، ❤ ${ar(likes)} «ما شاء الله»</p>
        <div class="row"><button type="button" class="btn primary" id="qVisit">${mine ? '🏰 ادخل قصري' : '👀 زيارة القصر'}</button><button type="button" class="btn" id="qBack">✕</button></div>`);
      host.querySelector('#qVisit').onclick = () => (mine ? go('mine', { ext: !!p.main }) : go('visit', { visit: p }));
      host.querySelector('#qBack').onclick = () => { sel = null; highlight(null); mapIdle(); };
      return;
    }
    const nb = neighbors(id), can = !mp ? 'main' : !ep && (mp.lv || 0) >= 12 ? 'ext' : null, price = can === 'ext' ? EXT_PLOT_PRICE : PLOT_PRICE;
    card(`<b>📍 قطعة رقم ${plotNo(id)}، فارغة</b>
      <p class="small muted" style="margin:0">${nb.length ? `بجوار: ${nb.slice(0, 4).map((x) => `<b>${esc(x.name.split(' ')[0])}</b>`).join('، ')}` : 'لا جيران بعد. كن أول من يبني هنا!'}</p>
      ${can ? `<button type="button" class="btn gold" id="qBuy">🏗️ ${can === 'ext' ? 'اشترِ قطعة التوسعة' : 'اختر هذه الأرض وابدأ البناء'}، 🪙 ${num(price)}</button>`
        : `<p class="small" style="margin:0">${ep ? 'لديك قصر وتوسعة، ما شاء الله!' : `تستطيع شراء قطعة ثانية للتوسعة بعد إكمال قصرك (المرحلة ١٢). أنت الآن في المرحلة ${ar(mp.lv || 0)}.`}</p>`}
      <button type="button" class="btn" id="qBack">✕</button>`);
    host.querySelector('#qBack').onclick = () => { sel = null; highlight(null); mapIdle(); };
    const bb = host.querySelector('#qBuy'); if (bb) bb.onclick = async () => {
      if (!(await confirmBox(`${can === 'ext' ? 'شراء قطعة التوسعة' : 'شراء هذه القطعة لقصرك'} رقم ${plotNo(id)} بـ${num(price)} عملة؟`, 'اشترِ'))) return;
      bb.disabled = true;
      const v = { pn: me.id, name: me.name, classId: me.classId || '', lv: 0, mat: 0, dome: 'teal', items: {}, at: new Date().toISOString(), likes: {}, ...(can === 'ext' ? { main: mp.id, ext: 0 } : {}) };
      const ok = await spend(price, (spent) => store.claimPlot(id, v, me.id, spent));
      if (ok) { PLOTS = await store.listPlots().catch(() => PLOTS); confetti(); toast(can === 'ext' ? '🎉 صارت لك قطعة التوسعة!' : '🎉 صارت الأرض لك! ابدأ ببناء الأساس.'); go('mine', { ext: can === 'ext' }); } else bb.disabled = false;
    };
  }
  function findFriend() {
    const L = PLOTS.filter((p) => !p.main && p.pn !== me.id).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    openModal(`<div class="stack"><h3>🔍 ابحث عن زميل</h3><input class="input" id="ffQ" placeholder="اكتب اسم زميلك" autocomplete="off"><div class="qs-ff" id="ffL"></div><button class="btn" type="button" data-close>إغلاق</button></div>`, (m) => {
      const q = m.querySelector('#ffQ'), box = m.querySelector('#ffL');
      const paint = () => { const s = q.value.trim(); const R = L.filter((p) => !s || p.name.includes(s)).slice(0, 30); box.innerHTML = R.length ? R.map((p) => `<button type="button" data-id="${esc(p.id)}">🏰 ${esc(p.name)} <small>، المرحلة ${ar(p.lv || 0)}</small></button>`).join('') : '<p class="small muted">لا نتائج.</p>';
        box.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { closeModal(); const id = b.dataset.id, [x, z] = M3.plotXY(id, N()); sc?.fly({ tx: x, tz: z, dist: 75, el: 0.75 }); tapMap({ kind: 'plot', id }); const nb = freeNear(id); if (nb.length) toast(`حول قصره ${nWord(nb.length, 'قطعة فارغة', 'قطعتان فارغتان', 'قطع فارغة', 'قطعة فارغة')}، اضغط عليها لتختار بجواره.`); })); };
      q.oninput = paint; paint(); setTimeout(() => q.focus(), 50);
    });
  }
  const freeNear = (id) => { const [c, r] = id.split('_').map(Number), out = []; for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const k = c + dc + '_' + (r + dr); if ((dc || dr) && c + dc >= 0 && r + dr >= 0 && c + dc < N() && r + dr < N() && k !== center() && !PLOTS.some((p) => p.id === k)) out.push(k); } return out; };

  /* ---------------- القصر من الخارج */
  function drawPalace() {
    const own = view === 'mine', p = own ? (extView ? extPlot() : mainPlot()) : visit;
    if (own && !p) { const el = shell(); title('🏰 قصري'); el.innerHTML += '<div class="q3-empty">🏝️<p>لم تختر أرضك بعد</p></div>'; card(`<b>ابدأ قصرك</b><p style="margin:0">اختر قطعة فارغة من الخريطة (${num(PLOT_PRICE)} عملة)، ثم ابنِ قصرك مرحلة بعد مرحلة.</p><button type="button" class="btn primary" id="qGo">🗺️ إلى الخريطة</button>`); host.querySelector('#qGo').onclick = () => go('map'); return; }
    const isExt = !!p.main;
    const el = shell(`<button type="button" class="q3-b" id="qMap" title="الخريطة">🗺️</button>${!isExt && (p.lv || 0) >= 2 ? '<button type="button" class="q3-b" id="qEnter" title="ادخل القصر">🚪</button>' : ''}${own && extPlot() ? `<button type="button" class="q3-b" id="qSw" title="${isExt ? 'القصر' : 'التوسعة'}">${isExt ? '🏰' : '🌴'}</button>` : ''}<button type="button" class="q3-b" id="qPic" title="صورة">📸</button>`);
    title(isExt ? `🌴 توسعة ${p.name}` : `🏰 قصر ${p.name}، المرحلة ${ar(p.lv || 0)} من ١٢`);
    sc = new M3.Scene3D(el, { dist: 46, el: 0.42, ang: 0.55, minD: 14, maxD: 80, target: [0, 2.6, 0], onTap: (t) => { if (t?.kind === 'gate' && (p.lv || 0) >= 2 && !isExt) go('interior', { visit: own ? null : p }); } });
    M3.sky(sc, sc.night);
    const st = { lv: p.lv || 0, mat: p.mat || 0, dome: p.dome || 'teal', name: p.name.split(' ')[0] };
    const built = isExt ? M3.buildExt(sc, p.ext || 0, { ghost: own }) : M3.buildPalace(sc, st, { ghost: own });
    sc.S.add(built.G); sc.pick.push(built.G);
    if (sc._justBuilt) M3.buildAnim(sc, built.P[sc._justBuilt]);
    if (ctx._anim && built.P?.[ctx._anim]) { M3.buildAnim(sc, built.P[ctx._anim]); ctx._anim = 0; }
    hint(own ? ((p.lv || 0) >= 2 && !isExt ? '👆 اسحب للتدوير، اضغط على البوابة للدخول' : '👆 اسحب للتدوير، الجزء الشفاف هو مرحلتك القادمة') : '👆 اسحب للتدوير');
    host.querySelector('#qMap').onclick = () => go('map', { sel: p.id });
    const en = host.querySelector('#qEnter'); if (en) en.onclick = () => go('interior', { visit: own ? null : p });
    const sw = host.querySelector('#qSw'); if (sw) sw.onclick = () => go('mine', { ext: !isExt });
    host.querySelector('#qPic').onclick = () => { const a = document.createElement('a'); a.href = sc.snapshot(); a.download = `qasr-${p.name}.png`; document.body.append(a); a.click(); a.remove(); };
    const likes = Object.keys(p.likes || {}).length, liked = !!(p.likes || {})[ctx.uid?.() || ''];
    if (!own) {
      card(`<b>🏰 قصر ${esc(p.name)}</b><p class="small muted" style="margin:0">المرحلة ${ar(p.lv || 0)} من ١٢، ❤ <span id="qLk">${ar(likes)}</span> «ما شاء الله»</p>
        <div class="row"><button type="button" class="btn primary" id="qLike" ${liked ? 'disabled' : ''}>${liked ? '❤ قلتَ ما شاء الله' : '❤ ما شاء الله'}</button>${(p.lv || 0) >= 2 ? '<button type="button" class="btn" id="qIn2">🚪 ادخل</button>' : ''}<button type="button" class="btn" id="qBk">⟵ الخريطة</button></div>`);
      host.querySelector('#qBk').onclick = () => go('map', { sel: p.id });
      const i2 = host.querySelector('#qIn2'); if (i2) i2.onclick = () => go('interior', { visit: p });
      host.querySelector('#qLike').onclick = async (e) => { e.target.disabled = true; try { await store.likePlot(p.id, ctx.uid?.() || 'u' + me.id); p.likes = { ...(p.likes || {}), [ctx.uid?.() || 'u' + me.id]: true }; host.querySelector('#qLk').textContent = ar(Object.keys(p.likes).length); e.target.textContent = '❤ قلتَ ما شاء الله'; toast('بارك الله لزميلك! ❤'); } catch (er) { e.target.disabled = false; toast('تعذّر: ' + (er.code || er.message)); } };
      return;
    }
    if (isExt) return extCard(p);
    palaceCard(p);
  }
  function palaceCard(p) {
    const lv = p.lv || 0, next = STAGES[lv], likes = Object.keys(p.likes || {}).length;
    const c = card(`${next ? `<div class="qs-next"><span class="qs-ic">${next[1]}</span><div><b>التالي: ${esc(next[2])}</b><small>المرحلة ${ar(next[0])} من ١٢، الجزء الشفاف في المجسّم</small></div><button type="button" class="btn gold" id="qBuild">🔨 ابنِ، 🪙 ${num(next[3])}</button></div>`
        : `<div class="qs-done">✨ اكتمل قصرك، ما شاء الله تبارك الله!${extPlot() ? '' : ` <button type="button" class="btn sm gold" id="qExt">🌴 اشترِ قطعة للتوسعة</button>`}</div>`}
      <div class="qs-prog"><i style="width:${(lv / 12) * 100}%"></i></div>
      <p class="small muted" style="margin:0">❤ ${ar(likes)} «ما شاء الله» من الزوار، القطعة رقم ${plotNo(p.id)}</p>
      <details class="qs-more"><summary>🧱 مراحل القصر</summary><div class="qs-list">${STAGES.map(([n, ic, t, pr]) => `<div class="${n <= lv ? 'done' : n === lv + 1 ? 'next' : ''}"><span>${ic}</span><b>${esc(t)}</b><i>${n <= lv ? '✓' : '🪙 ' + num(pr)}</i></div>`).join('')}</div></details>
      ${lv >= 2 ? `<details class="qs-more"><summary>🎨 الخامة ولون القبة</summary>
        <div class="qs-opts">${MAT.map(([k, t, pr]) => `<button type="button" data-mat="${k}" class="${(p.mat || 0) === k ? 'on' : ''}" ${(p.mat || 0) >= k ? '' : ''}>${esc(t)}${(p.mat || 0) >= k ? (p.mat || 0) === k ? ' ✓' : '' : `، 🪙 ${num(pr - (MAT[p.mat || 0][2]))}`}</button>`).join('')}</div>
        ${lv >= 8 ? `<div class="qs-opts">${DOMES.map(([k, t, pr]) => `<button type="button" data-dome="${k}" class="${(p.dome || 'teal') === k ? 'on' : ''}">قبة ${esc(t)}${(p.items?.['d_' + k] || k === 'teal') ? (p.dome || 'teal') === k ? ' ✓' : '' : `، 🪙 ${num(pr)}`}</button>`).join('')}</div>` : '<p class="small muted" style="margin:0">ألوان القبة تُفتح بعد بناء القبة (المرحلة ٨).</p>'}
      </details>` : ''}`);
    const b = c.querySelector('#qBuild'); if (b) b.onclick = async () => {
      b.disabled = true;
      const ok = await spend(next[3], (spent) => store.savePlot(p.id, { lv: lv + 1, at: new Date().toISOString() }, me.id, spent));
      if (ok) { p.lv = lv + 1; ctx._anim = p.lv; toast(`🎉 بُني «${next[2]}»!`); if (p.lv === 12) confetti(); go('mine'); } else b.disabled = false;
    };
    const ex = c.querySelector('#qExt'); if (ex) ex.onclick = () => { toast('اختر قطعة فارغة للتوسعة، ويفضّل بجوار قصرك.'); go('map', { sel: null }); };
    c.querySelectorAll('[data-mat]').forEach((x) => (x.onclick = async () => {
      const k = +x.dataset.mat, cur = p.mat || 0; if (k <= cur) { if (k === cur) return; toast('لا يمكن الرجوع لخامة أقل.'); return; }
      const price = MAT[k][2] - MAT[cur][2];
      if (!(await confirmBox(`ترقية الخامة إلى «${MAT[k][1]}» بـ${num(price)} عملة؟`, 'رقِّ'))) return;
      if (await spend(price, (spent) => store.savePlot(p.id, { mat: k }, me.id, spent))) { p.mat = k; toast('✨ تغيّرت خامة قصرك!'); go('mine'); }
    }));
    c.querySelectorAll('[data-dome]').forEach((x) => (x.onclick = async () => {
      const k = x.dataset.dome, has = k === 'teal' || p.items?.['d_' + k];
      if (has) { if (await save({ dome: k })) { p.dome = k; go('mine'); } return; }
      const price = DOMES.find((d) => d[0] === k)[2];
      if (!(await confirmBox(`قبة بلون «${DOMES.find((d) => d[0] === k)[1]}» بـ${num(price)} عملة؟`, 'اشترِ'))) return;
      const items = { ...(p.items || {}), ['d_' + k]: 1 };
      if (await spend(price, (spent) => store.savePlot(p.id, { dome: k, items }, me.id, spent))) { p.dome = k; p.items = items; go('mine'); }
    }));
    async function save(patch) { try { await store.savePlot(p.id, patch); return true; } catch (e) { toast('تعذّر: ' + (e.code || e.message)); return false; } }
  }
  function extCard(p) {
    const n = p.ext || 0, next = EXT[n];
    const c = card(`${next ? `<div class="qs-next"><span class="qs-ic">${next[1]}</span><div><b>التالي: ${esc(next[2])}</b><small>التوسعة ${ar(n + 1)} من ٤</small></div><button type="button" class="btn gold" id="qBuild">🔨 ابنِ، 🪙 ${num(next[3])}</button></div>` : '<div class="qs-done">🌴 اكتملت توسعتك، ما شاء الله!</div>'}
      <div class="qs-list">${EXT.map(([k, ic, t, pr]) => `<div class="${k <= n ? 'done' : k === n + 1 ? 'next' : ''}"><span>${ic}</span><b>${esc(t)}</b><i>${k <= n ? '✓' : '🪙 ' + num(pr)}</i></div>`).join('')}</div>`);
    const b = c.querySelector('#qBuild'); if (b) b.onclick = async () => { b.disabled = true; if (await spend(next[3], (spent) => store.savePlot(p.id, { ext: n + 1, at: new Date().toISOString() }, me.id, spent))) { p.ext = n + 1; toast(`🎉 بُني «${next[2]}»!`); go('mine', { ext: true }); } else b.disabled = false; };
  }

  /* ---------------- داخل القصر */
  function drawInterior() {
    const p = visit || mainPlot(), own = !visit; if (!p) return go('mine');
    const el = shell(`<button type="button" class="q3-b" id="qOutP" title="خروج">🚪</button>${['majlis', 'library', 'trophy', 'all'].map((k) => `<button type="button" class="q3-b sm${room === k ? ' on' : ''}" data-room="${k}">${{ majlis: '🛋️', library: '📚', trophy: '🏆', all: '🏠' }[k]}</button>`).join('')}`);
    title(own ? '🛋️ داخل قصري' : `🛋️ داخل قصر ${p.name}`);
    const V = M3.ROOM_VIEWS[room] || M3.ROOM_VIEWS.all;
    sc = new M3.Scene3D(el, { ...V, target: [V.tx, V.ty, V.tz], minD: 4, maxD: 22, fov: 62, shadows: true, onTap: (t) => { if (t?.kind && M3.ROOM_VIEWS[t.kind]) setRoom(t.kind); } });
    const stats = own ? ctx.stats() : { cups: 0, certs: 0 };
    M3.buildInterior(sc, p.items || {}, { ...stats, waqf: own ? !!myWaqfAny() : false });
    hint('👆 اسحب للنظر حولك، الأزرار تنقلك بين الأركان');
    host.querySelector('#qOutP').onclick = () => (own ? go('mine') : go('visit', { visit: p }));
    host.querySelectorAll('[data-room]').forEach((b) => (b.onclick = () => setRoom(b.dataset.room)));
    function setRoom(k) { room = k; const v = M3.ROOM_VIEWS[k]; sc.fly(v); host.querySelectorAll('[data-room]').forEach((b) => b.classList.toggle('on', b.dataset.room === k)); }
    if (!own) { card(`<b>🛋️ داخل قصر ${esc(p.name)}</b><p class="small muted" style="margin:0">تجوّل في أركان القصر بالأزرار أعلاه.</p><button type="button" class="btn" id="qBk2">⟵ خروج</button>`); host.querySelector('#qBk2').onclick = () => go('visit', { visit: p }); return; }
    const it = p.items || {};
    const c = card(`<b>🛋️ أثاث قصرك</b><p class="small muted" style="margin:0">كل ما تشتريه يظهر فوراً داخل قصرك، والكؤوس والشهادات تُعرض بعدد ألقابك وشهاداتك الحقيقية.</p>
      <div class="qs-list">${ROOM.map((r) => { const have = it[r.k] || 0, max = r.p.length, nxt = have < max ? r.p[have] : null;
        return `<div class="${have >= max ? 'done' : ''}"><span>${r.ic}</span><b>${esc(r.t)}${r.lv && have ? ` <small>(${esc(r.lv[have - 1])})</small>` : ''}</b>${nxt != null ? `<button type="button" class="btn sm ${have ? '' : 'gold'}" data-buy="${r.k}">${have && r.lv ? `⬆️ ${esc(r.lv[have])}` : 'اشترِ'}، 🪙 ${num(nxt)}</button>` : '<i>✓</i>'}</div>`; }).join('')}</div>`);
    c.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = async () => {
      const r = ROOM.find((x) => x.k === b.dataset.buy), have = it[r.k] || 0, price = r.p[have];
      b.disabled = true;
      const items = { ...(p.items || {}), [r.k]: have + 1 };
      if (await spend(price, (spent) => store.savePlot(p.id, { items }, me.id, spent))) { p.items = items; room = r.v; toast(`🎉 «${r.t}» في قصرك الآن!`); go('interior'); } else b.disabled = false;
    }));
  }

  /* ---------------- الوقف */
  const myWaqfAny = () => (W ? waqfSum(W, DON).mine(me.id) : null);
  let txtIv = null;
  function drawWaqf() {
    clearInterval(txtIv);
    const TY = WAQF_TYPES[W.type] || WAQF_TYPES.mushaf, S = waqfSum(W, DON), target = W.target || 1, fill = Math.min(1, S.sum / target), mine = S.mine(me.id);
    const per = W.per || 400, unitsDone = Math.floor(S.sum / per), unitsAll = W.units || Math.round(target / per), full = S.sum >= target || W.status !== 'open';
    const el = shell(`${qOn() ? '<button type="button" class="q3-b" id="qMap2" title="الخريطة">🗺️</button>' : ''}`);
    title(`${TY.ic} ${unitsTxt(W, Math.min(unitsDone, unitsAll))} من ${ar(unitsAll)}`);
    sc = new M3.Scene3D(el, { dist: 10.5, el: 0.2, ang: 0.12, minD: 5, maxD: 16, target: [0, 2.6, -2], fov: 60 });
    M3.buildWaqfHall(sc, fill, unitsAll);
    hint(full ? '' : '👆 كل رف يمتلئ مع تبرعاتكم، والفارغ شفاف');
    const mq = host.querySelector('#qMap2'); if (mq) mq.onclick = () => go('map', { sel: null });
    const texts = (W.texts?.length ? W.texts : WAQF_DEFAULT_TEXTS).map((id) => WAQF_TEXTS.find((x) => x.id === id)).filter(Boolean);
    if (W.custom) texts.push({ id: 'c', t: W.custom, s: '' });
    const myUnits = mine ? Math.floor(mine.amt / per) : 0, emb = videoEmbed(W.video);
    const st = W.status === 'delivered' ? 'delivered' : full ? 'full' : 'open';
    const c = card(`<div class="wq-h"><b>${TY.ic} ${esc(W.title || TY.t)}</b>${W.desc ? `<p>${esc(W.desc)}</p>` : ''}${W.to ? `<small>🎯 الجهة المستفيدة: ${esc(W.to)}</small>` : ''}</div>
      ${st === 'delivered' ? `<div class="wq-done">✅ تمّ الوقف بحمد الله${W.deliveredAt ? `، ${esc(W.deliveredNote || '')}` : ''}</div>` : st === 'full' ? '<div class="wq-done">🎉 اكتمل الهدف بحمد الله! جارٍ تسليم الوقف عن جميع المشاركين.</div>' : ''}
      <div class="wq-big"><b>🪙 ${num(S.sum)}</b><span>من ${num(target)}، ${ar(Math.round(fill * 100))}٪</span></div>
      <div class="qs-prog wq"><i style="width:${fill * 100}%"></i></div>
      <div class="wq-mu"><span>كل <b>${num(per)} عملة = ${esc(TY.unit)}</b></span><span>${full ? `<b>${unitsTxt(W, unitsAll)}</b> اكتملت` : `باقٍ <b>${unitsTxt(W, Math.max(0, unitsAll - unitsDone))}</b>`}</span></div>
      ${st === 'open' ? `<div class="wq-amt">${[[Math.round(per / 4), 'ربع'], [Math.round(per / 2), 'نصف'], [per, TY.unit], [per * 2, unitsTxt(W, 2)]].map(([v, l], i) => `<button type="button" data-amt="${v}" class="${i === 2 ? 'on' : ''}">${num(v)}<small>${esc(l)}</small></button>`).join('')}<button type="button" data-amt="x">أخرى</button></div>
        <button type="button" class="btn gold" id="wGo">🤲 ${TY.unit === 'مصحف' ? 'أهدِ مصحفاً' : 'تبرّع'}، 🪙 <span id="wAmt">${num(per)}</span></button>` : ''}
      ${mine ? `<div class="wq-mine ${myUnits >= 1 ? 'gold' : ''}">${myUnits >= 1 ? '🥇' : '📖'} <span>شاركت بـ<b>${num(mine.amt)}</b> عملة${myUnits >= 1 ? ` (${unitsTxt(W, myUnits)} كاملة)` : ''}، واسمك مع المشاركين${myUnits >= 1 ? ' في القائمة الذهبية' : ''}.</span></div>` : ''}
      ${mine && st !== 'open' ? `<div class="wq-badge ${myUnits >= 1 ? 'gold' : ''}"><b>🎖️ وسام «${myUnits >= 1 ? 'واقف ' + esc(TY.units === 'مصاحف' ? 'المصاحف' : 'الخير') + ' الذهبي' : 'المشارك في الوقف'}»</b><span>${myUnits >= 1 ? 'لمشاركتك بوقفٍ كامل أو أكثر' : 'جزاك الله خيراً على مشاركتك'}</span></div>
        <div class="row"><button type="button" class="btn gold" id="wCert">📜 شهادة المشاركة (صورة)</button><button type="button" class="btn" id="wCertPdf">PDF</button></div>` : ''}
      ${emb ? `<div class="wq-vid"><b>🎬 توثيق الوقف</b><div class="wq-frame"><iframe src="${esc(emb)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" title="توثيق الوقف"></iframe></div></div>` : W.video ? `<a class="btn" href="${esc(W.video)}" target="_blank" rel="noopener">🎬 شاهد توثيق الوقف</a>` : ''}
      <div class="wq-txt" id="wTxt"></div>
      <details class="qs-more"><summary>📜 فضل الوقف والصدقة الجارية</summary><div class="wq-txts">${texts.map((x) => `<div class="${x.q ? 'q' : ''}"><p>${x.q ? '﴿' : '«'}${esc(x.t)}${x.q ? '﴾' : '»'}</p>${x.s ? `<small>${esc(x.s)}</small>` : ''}</div>`).join('')}</div></details>
      <details class="qs-more" ${S.list.length <= 30 ? 'open' : ''}><summary>👥 المشاركون (${ar(S.list.length)})</summary>
        <div class="wq-names">${S.list.length ? S.list.map((x) => `<span class="${x.amt >= per ? 'g' : ''}${x.pn === me.id ? ' me' : ''}">${x.amt >= per ? '🥇 ' : ''}${esc(x.name)}</span>`).join('') : '<p class="small muted">كن أول المشاركين!</p>'}</div>
        <p class="small muted" style="margin:6px 0 0">🥇 = شارك بـ${esc(TY.unit)} كامل أو أكثر. لا تُعرض المبالغ.</p></details>
      <p class="small muted" style="margin:0">ℹ️ العملات رمزية، و${TY.unit === 'مصحف' ? 'المصاحف' : 'الوقف'} حقيقي يُقدَّم عن جميع المشاركين عند بلوغ الهدف${W.video ? '' : '، ويُوثَّق بالفيديو هنا'}.</p>`);
    // نص متجدد
    let ti = 0; const paintT = () => { const x = texts[ti % texts.length]; const b = c.querySelector('#wTxt'); if (b && x) b.innerHTML = `<p>${x.q ? '﴿' : '«'}${esc(x.t)}${x.q ? '﴾' : '»'}</p>${x.s ? `<small>${esc(x.s)}</small>` : ''}`; ti++; };
    if (texts.length) { paintT(); txtIv = setInterval(() => (host.isConnected && view === 'waqf' ? paintT() : clearInterval(txtIv)), 9000); }
    let amt = per;
    c.querySelectorAll('[data-amt]').forEach((b) => (b.onclick = async () => {
      if (b.dataset.amt === 'x') { const v = prompt('كم عملة تريد أن تتبرع؟', String(per)); const n = Math.floor(+String(v || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); if (!n || n < 1) return; amt = n; } else amt = +b.dataset.amt;
      c.querySelectorAll('[data-amt]').forEach((x) => x.classList.toggle('on', x === b)); c.querySelector('#wAmt').textContent = num(amt);
    }));
    const go2 = c.querySelector('#wGo'); if (go2) go2.onclick = async () => {
      const left = Math.max(0, target - S.sum), a = Math.min(amt, left);
      if (!a) return toast('اكتمل الهدف، جزاكم الله خيراً!');
      if (coins() < a) return toast(`رصيدك ${num(coins())} عملة فقط.`);
      if (!(await confirmBox(`التبرع بـ${num(a)} عملة في «${W.title || TY.t}»؟ التبرع نهائي ولا يُسترد.`, 'تبرّع'))) return;
      go2.disabled = true;
      const prev = mine?.amt || 0, entry = { pn: me.id, name: me.name, classId: me.classId || '', amt: prev + a, at: new Date().toISOString(), w: W.id };
      if (await spend(a, (spent) => store.donateWaqf(me.id, entry, spent))) {
        DON = await store.getWaqfDon().catch(() => DON); confetti();
        const S2 = waqfSum(W, DON), u0 = Math.floor(S.sum / per), u1 = Math.floor(S2.sum / per);
        toast(u1 > u0 ? `📖 اكتمل ${TY.unit} جديد بمشاركتك! جزاك الله خيراً` : '🤲 تقبّل الله منك، جزاك الله خيراً'); drawWaqf();
      } else go2.disabled = false;
    };
    const cert = (pdf) => async () => {
      const { downloadCertificatePNG, downloadCertificatesPDF } = await import('./certificate.js');
      const units = Math.floor((mine?.amt || 0) / per), C = { name: me.name, head: 'شهادة شكر وتقدير', lead: `${ctx.className || ''}${ctx.className ? '، ' : ''}لمشاركته في`, title: W.title || TY.t, main: `${units >= 1 ? `بـ${unitsTxt(W, units)} ` : ''}ضمن ${unitsTxt(W, unitsAll)}${W.to ? ` لـ${W.to}` : ''}، جعله الله في ميزان حسناته صدقةً جارية.`, tier: units >= 1 ? 'gold' : 'green', noMedal: true, teacher: W.teacher || '', date: ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })), at: new Date().toISOString() };
      try { if (pdf) await downloadCertificatesPDF([C], `waqf-${me.id}.pdf`); else await downloadCertificatePNG({ ...C, ym: 'waqf' }); } catch (e) { toast('تعذّر: ' + e.message); }
    };
    const cp = c.querySelector('#wCert'); if (cp) { cp.onclick = cert(false); c.querySelector('#wCertPdf').onclick = cert(true); }
  }

  if (location.hostname === 'localhost') host._q = { tap: (t) => tapMap(t), go, state: () => ({ view, PLOTS, W, DON }) }; // للاختبار المحلي فقط
  load().then(() => { if (!gone) draw(); }).catch((e) => { console.warn(e); host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });
  return () => { gone = true; clearInterval(txtIv); kill(); };
}

/* ================================================================= المعلم */
export function mountQasrTeacher(host, ctx) {
  const { toast, openModal, closeModal, confirmBox, students, classes } = ctx;
  let CFG = null, W = null, DON = {}, PLOTS = [], ARCH = [], edit = false;
  const clsName = (id) => classes.find((c) => c.id === id)?.name || '';
  host.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  async function load() { [CFG, W, DON, PLOTS, ARCH] = await Promise.all([store.getQasrCfg().catch(() => null), store.getWaqf().catch(() => null), store.getWaqfDon().catch(() => ({})), store.listPlots().catch(() => []), store.listWaqfArchive().catch(() => [])]); CFG = { ...QASR_DEFAULT, ...(CFG || {}) }; }
  const visHtml = (pre, c) => `<div class="qt-vis"><b class="small">من يرى هذه الميزة؟</b><div class="qs-opts">${[['all', '👥 الجميع'], ['some', '🎯 طلاب معيّنون'], ['none', '🚫 لا أحد']].map(([k, l]) => `<button type="button" data-${pre}vis="${k}" class="${(c.vis || 'none') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${c.vis === 'some' ? `<button type="button" class="btn sm" id="${pre}Pick">🎯 اختر الطلاب (${ar((c.pns || []).length)})</button>` : ''}</div>`;
  function pick(cur, done) {
    const sel = new Set(cur || []);
    openModal(`<div class="stack"><h3>🎯 اختر الطلاب</h3><input class="input" id="pkQ" placeholder="ابحث بالاسم"><div class="qt-pick" id="pkL"></div><div class="row"><button class="btn primary" type="button" id="pkOk">تم</button><button class="btn" type="button" data-close>إلغاء</button></div></div>`, (m) => {
      const L = m.querySelector('#pkL'), q = m.querySelector('#pkQ');
      const paint = () => { const s = q.value.trim(); L.innerHTML = classes.map((c) => { const st = students.filter((x) => x.classId === c.id && (!s || x.name.includes(s))); if (!st.length) return ''; const all = st.every((x) => sel.has(x.id)); return `<details ${s ? 'open' : ''}><summary><label><input type="checkbox" data-cls="${esc(c.id)}" ${all ? 'checked' : ''}> ${esc(c.name)}</label> <small>${ar(st.filter((x) => sel.has(x.id)).length)}/${ar(st.length)}</small></summary>${st.map((x) => `<label class="qt-pk"><input type="checkbox" data-pn="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</details>`; }).join('');
        L.querySelectorAll('[data-pn]').forEach((i) => (i.onchange = () => { i.checked ? sel.add(i.dataset.pn) : sel.delete(i.dataset.pn); }));
        L.querySelectorAll('[data-cls]').forEach((i) => (i.onchange = (e) => { e.stopPropagation(); students.filter((x) => x.classId === i.dataset.cls).forEach((x) => (i.checked ? sel.add(x.id) : sel.delete(x.id))); paint(); })); };
      q.oninput = paint; paint();
      m.querySelector('#pkOk').onclick = () => { closeModal(); done([...sel]); };
    });
  }
  function draw() {
    const S = W ? waqfSum(W, DON) : null, TY = WAQF_TYPES[W?.type] || WAQF_TYPES.mushaf;
    const byPn = {}; PLOTS.forEach((p) => { (byPn[p.pn] ||= []).push(p); });
    host.innerHTML = `
    <div class="card stack" id="qtQ">
      <div class="row" style="justify-content:space-between"><h3>🏰 أرض المقرأة (قصور الطلاب)</h3><button type="button" class="btn sm" id="qtMap">👁️ معاينة الخريطة</button></div>
      <p class="small muted" style="margin:0">خريطة ثلاثية الأبعاد لكل الطلاب: يشتري الطالب قطعة بعملاته (${num(PLOT_PRICE)}) ويبني قصره على ١٢ مرحلة (المجموع ${num(STAGES.reduce((n, x) => n + x[3], 0))} عملة)، ثم أثاث الداخل والتوسعة. لا تؤثر العملات على نقاط الشرف.</p>
      ${visHtml('q', CFG)}
      <label class="field" style="max-width:220px">حجم الخريطة<select id="qtN">${[7, 9, 11, 13].map((n) => `<option value="${n}" ${CFG.n === n ? 'selected' : ''}>${ar(n)}×${ar(n)} (${ar(n * n - 1)} قطعة)</option>`).join('')}</select></label>
      <div class="qt-st"><div><b>${ar(PLOTS.filter((p) => !p.main).length)}</b><span>قصر</span></div><div><b>${ar(PLOTS.filter((p) => (p.lv || 0) >= 12).length)}</b><span>مكتمل</span></div><div><b>${ar(PLOTS.filter((p) => p.main).length)}</b><span>توسعة</span></div></div>
      ${PLOTS.length ? `<details class="qs-more"><summary>📋 القصور (${ar(PLOTS.length)})</summary><div class="qt-tbl"><table><thead><tr><th>الطالب</th><th>الصف</th><th>المرحلة</th><th>❤</th><th></th></tr></thead><tbody>${PLOTS.slice().sort((a, b) => (b.lv || 0) - (a.lv || 0)).map((p) => `<tr><td>${esc(p.name)}${p.main ? ' <small>(توسعة)</small>' : ''}</td><td>${esc(clsName(p.classId))}</td><td>${p.main ? `${ar(p.ext || 0)}/٤` : `${ar(p.lv || 0)}/١٢`}</td><td>${ar(Object.keys(p.likes || {}).length)}</td><td><button type="button" class="btn sm danger" data-free="${esc(p.id)}">إخلاء</button></td></tr>`).join('')}</tbody></table></div></details>` : ''}
    </div>
    <div class="card stack" id="qtW">
      <h3>${TY.ic} الوقف</h3>
      ${!W || edit ? waqfForm() : waqfAdmin(S, TY)}
      ${ARCH.length ? `<details class="qs-more"><summary>🗂️ الأوقاف السابقة (${ar(ARCH.length)})</summary>${ARCH.map((a) => `<div class="qt-arch"><b>${esc(a.title)}</b> <small>${ar(a.units || 0)}، ${ar(a.n || 0)} مشاركاً${a.video ? '، 🎬' : ''}</small></div>`).join('')}</details>` : ''}
    </div>`;
    wire();
  }
  function waqfForm() {
    const w = edit && W ? W : { type: 'mushaf', title: 'وقف مصاحف مقرأة الفاتح', desc: 'نهدي مصاحف حقيقية عن جميع المشاركين', units: 50, per: 400, to: '', texts: WAQF_DEFAULT_TEXTS, custom: '', vis: 'all', pns: [] };
    return `<form class="stack" id="wForm">
      <div class="field">نوع الوقف<div class="qs-opts">${Object.entries(WAQF_TYPES).map(([k, t]) => `<button type="button" data-wt="${k}" class="${w.type === k ? 'on' : ''}">${t.ic} ${esc(t.t)}</button>`).join('')}</div></div>
      <label class="field">العنوان<input class="input" id="wT" value="${esc(w.title)}" required maxlength="80"></label>
      <label class="field">الوصف (يظهر للطلاب)<textarea class="input" id="wD" rows="2" maxlength="300">${esc(w.desc || '')}</textarea></label>
      <div class="row" style="gap:8px"><label class="field" style="flex:1">العدد الحقيقي<input class="input" id="wU" type="number" min="1" max="10000" value="${w.units}"></label><label class="field" style="flex:1">عملات لكل وحدة<input class="input" id="wP" type="number" min="10" max="100000" value="${w.per}"></label></div>
      <p class="small muted" style="margin:0" id="wGoal"></p>
      <label class="field">الجهة المستفيدة (اختياري)<input class="input" id="wTo" value="${esc(w.to || '')}" maxlength="80" placeholder="مثال: مسجد الحي"></label>
      <div class="field">الآيات والأحاديث المعروضة<div class="qt-txts">${WAQF_TEXTS.map((x) => `<label><input type="checkbox" data-tx="${x.id}" ${(w.texts || []).includes(x.id) ? 'checked' : ''}> <span>${x.q ? '﴿' : '«'}${esc(x.t.length > 70 ? x.t.slice(0, 70) + '…' : x.t)}${x.q ? '﴾' : '»'} <small>${esc(x.s)}</small></span></label>`).join('')}</div></div>
      <label class="field">نص خاص (اختياري)<textarea class="input" id="wC" rows="2" maxlength="400">${esc(w.custom || '')}</textarea></label>
      ${visHtml('w', w)}
      <div class="row"><button class="btn primary" type="submit">${edit ? 'حفظ التعديل' : 'انشر الوقف'}</button>${edit ? '<button class="btn" type="button" id="wCancel">إلغاء</button>' : ''}</div></form>`;
  }
  function waqfAdmin(S, TY) {
    const per = W.per || 400, fill = Math.min(1, S.sum / (W.target || 1)), units = Math.floor(S.sum / per), emb = videoEmbed(W.video);
    const st = W.status === 'delivered' ? 'delivered' : W.status === 'off' ? 'off' : S.sum >= W.target ? 'full' : W.status || 'open';
    return `<div class="wq-h"><b>${esc(W.title)}</b>${W.desc ? `<p>${esc(W.desc)}</p>` : ''}</div>
      <div class="wq-big"><b>🪙 ${num(S.sum)}</b><span>من ${num(W.target)}، ${ar(Math.round(fill * 100))}٪، ${unitsTxt(W, Math.min(units, W.units))} من ${ar(W.units)}</span></div>
      <div class="qs-prog wq"><i style="width:${fill * 100}%"></i></div>
      <div class="qt-st"><div><b>${ar(S.list.length)}</b><span>مشاركاً</span></div><div><b>${ar(S.list.filter((x) => x.amt >= per).length)}</b><span>بوحدة كاملة 🥇</span></div><div><b>${ar(Math.max(0, W.units - units))}</b><span>متبقٍّ</span></div></div>
      <div class="field">الحالة<div class="qs-opts">${[['open', '🟢 مفتوح'], ['full', '🎉 اكتمل'], ['delivered', '✅ تمّ التسليم'], ['off', '⏸️ موقوف']].map(([k, l]) => `<button type="button" data-ws="${k}" class="${st === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label class="field">🎬 رابط فيديو التوثيق (يوتيوب غير مُدرج، أو Google Drive)<input class="input" id="wV" value="${esc(W.video || '')}" placeholder="https://youtu.be/…" dir="ltr"></label>
      <label class="field">ملاحظة التسليم (تظهر للطلاب)<input class="input" id="wN" value="${esc(W.deliveredNote || '')}" placeholder="مثال: سُلّمت لمسجد الحي يوم الجمعة"></label>
      ${emb ? `<div class="wq-frame"><iframe src="${esc(emb)}" allowfullscreen loading="lazy" title="الفيديو"></iframe></div>` : W.video ? '<p class="small" style="color:#b45309;margin:0">⚠️ لم أتعرف على الرابط كفيديو يوتيوب أو Drive، سيظهر للطلاب زراً يفتح الرابط.</p>' : ''}
      ${visHtml('w', W)}
      <div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn primary sm" type="button" id="wSave">حفظ</button><button class="btn sm" type="button" id="wEdit">✏️ تعديل البيانات</button><button class="btn sm" type="button" id="wCopy">📋 نسخ أسماء المشاركين</button><button class="btn sm" type="button" id="wNew">🆕 وقف جديد</button></div>
      <details class="qs-more"><summary>👥 المشاركون (${ar(S.list.length)})</summary><div class="qt-tbl"><table><thead><tr><th>الطالب</th><th>الصف</th><th>العملات</th><th>${esc(TY.units)}</th></tr></thead><tbody>${S.list.map((x) => `<tr><td>${x.amt >= per ? '🥇 ' : ''}${esc(x.name)}</td><td>${esc(clsName(x.classId))}</td><td>${num(x.amt)}</td><td>${ar(Math.floor(x.amt / per))}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function wire() {
    const q = host.querySelector('#qtQ');
    q.querySelectorAll('[data-qvis]').forEach((b) => (b.onclick = async () => { CFG.vis = b.dataset.qvis; await saveCfg(); }));
    const qp = q.querySelector('#qPick'); if (qp) qp.onclick = () => pick(CFG.pns, async (L) => { CFG.pns = L; await saveCfg(); });
    q.querySelector('#qtN').onchange = async (e) => { const n = +e.target.value; if (PLOTS.length && n < CFG.n && !(await confirmBox('تصغير الخريطة قد يُخرج بعض القصور منها. متابعة؟', 'متابعة'))) { e.target.value = CFG.n; return; } CFG.n = n; await saveCfg(); };
    q.querySelector('#qtMap').onclick = previewMap;
    q.querySelectorAll('[data-free]').forEach((b) => (b.onclick = async () => { const p = PLOTS.find((x) => x.id === b.dataset.free); if (!(await confirmBox(`إخلاء قطعة «${p?.name}»؟ يُحذف القصر ولا تُعاد العملات.`, 'إخلاء'))) return; try { await store.delPlot(b.dataset.free); PLOTS = PLOTS.filter((x) => x.id !== b.dataset.free); draw(); toast('أُخليت القطعة.'); } catch (e) { toast('تعذّر: ' + (e.code || e.message)); } }));
    const w = host.querySelector('#qtW');
    const f = w.querySelector('#wForm');
    if (f) {
      let type = (edit && W?.type) || 'mushaf', vis = (edit && W?.vis) || 'all', pns = (edit && W?.pns) || [];
      const goal = () => { const u = +f.querySelector('#wU').value || 0, p = +f.querySelector('#wP').value || 0; f.querySelector('#wGoal').textContent = `الهدف: ${num(u * p)} عملة (${ar(u)} × ${num(p)}). اجعل السعر مناسباً لعملات طلابك.`; };
      f.querySelectorAll('input[type=number]').forEach((i) => (i.oninput = goal)); goal();
      f.querySelectorAll('[data-wt]').forEach((b) => (b.onclick = () => { type = b.dataset.wt; f.querySelectorAll('[data-wt]').forEach((x) => x.classList.toggle('on', x === b)); }));
      f.querySelectorAll('[data-wvis]').forEach((b) => (b.onclick = () => { vis = b.dataset.wvis; f.querySelectorAll('[data-wvis]').forEach((x) => x.classList.toggle('on', x === b)); if (vis === 'some') pick(pns, (L) => { pns = L; toast(`اخترت ${ar(L.length)} طالباً.`); }); }));
      const wp = f.querySelector('#wPick'); if (wp) wp.onclick = () => pick(pns, (L) => { pns = L; });
      const cc = f.querySelector('#wCancel'); if (cc) cc.onclick = () => { edit = false; draw(); };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const units = Math.max(1, Math.round(+f.querySelector('#wU').value || 0)), per = Math.max(10, Math.round(+f.querySelector('#wP').value || 0));
        const texts = [...f.querySelectorAll('[data-tx]:checked')].map((x) => x.dataset.tx);
        const base = { type, title: f.querySelector('#wT').value.trim() || WAQF_TYPES[type].t, desc: f.querySelector('#wD').value.trim(), units, per, target: units * per, to: f.querySelector('#wTo').value.trim(), texts, custom: f.querySelector('#wC').value.trim(), vis, pns, teacher: ctx.teacherName || '' };
        try {
          if (edit && W) { W = { ...W, ...base }; await store.setWaqf(W); edit = false; toast('حُفظ.'); }
          else {
            const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
            W = { ...base, id, status: 'open', video: '', createdAt: new Date().toISOString() };
            await store.resetWaqfDon(id); await store.setWaqf(W); DON = { _id: id };
            if (vis === 'all') try { const nid = await store.addNotif({ type: 'waqf', title: `${WAQF_TYPES[type].ic} ${W.title}`, body: `شارك بعملاتك في ${W.title}: ${unitsTxt(W, units)} حقيقية تُهدى عن جميع المشاركين. ادخل «🏰 أرض المقرأة».`, link: './#/student', tag: 'waqf-' + id, classId: 'all' }); await ctx.sendPush?.(nid); } catch {}
            toast('نُشر الوقف، وظهر للطلاب.');
          }
          draw();
        } catch (er) { toast('تعذّر الحفظ: ' + (er.code || er.message)); }
      };
      return;
    }
    if (!W) return;
    w.querySelectorAll('[data-wvis]').forEach((b) => (b.onclick = async () => { W.vis = b.dataset.wvis; await saveW(); }));
    const wp = w.querySelector('#wPick'); if (wp) wp.onclick = () => pick(W.pns, async (L) => { W.pns = L; await saveW(); });
    w.querySelectorAll('[data-ws]').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.ws, was = W.status; W.status = k; if (k === 'delivered' && !W.deliveredAt) W.deliveredAt = new Date().toISOString();
      await saveW();
      if (k === 'delivered' && was !== 'delivered') try { const nid = await store.addNotif({ type: 'waqf', title: `✅ تمّ ${W.title} بحمد الله`, body: W.video ? 'شاهد فيديو التوثيق، وحمّل شهادة مشاركتك من صفحة الوقف.' : 'جزاكم الله خيراً. حمّل شهادة مشاركتك من صفحة الوقف.', link: './#/student', tag: 'waqf-' + W.id, classId: 'all' }); await ctx.sendPush?.(nid); } catch {}
    }));
    w.querySelector('#wSave').onclick = async () => { W.video = w.querySelector('#wV').value.trim(); W.deliveredNote = w.querySelector('#wN').value.trim(); await saveW(); };
    w.querySelector('#wEdit').onclick = () => { edit = true; draw(); };
    w.querySelector('#wCopy').onclick = async () => { const S = waqfSum(W, DON), per = W.per || 400; const txt = S.list.map((x, i) => `${i + 1}. ${x.name} (${clsName(x.classId)})${x.amt >= per ? ' 🥇' : ''}`).join('\n'); try { await navigator.clipboard.writeText(`${W.title}\nالمشاركون (${S.list.length}):\n${txt}`); toast('نُسخت الأسماء.'); } catch { openModal(`<div class="stack"><h3>أسماء المشاركين</h3><textarea class="input" rows="12">${esc(txt)}</textarea><button class="btn" data-close type="button">إغلاق</button></div>`); } };
    w.querySelector('#wNew').onclick = async () => {
      if (!(await confirmBox('بدء وقف جديد؟ يُحفظ الحالي في «الأوقاف السابقة» مع فيديوه وأسماء المشاركين.', 'وقف جديد'))) return;
      const S = waqfSum(W, DON);
      try { await store.archiveWaqf({ ...W, n: S.list.length, sum: S.sum, names: S.list.map((x) => ({ pn: x.pn, name: x.name, amt: x.amt })) }); ARCH = await store.listWaqfArchive().catch(() => ARCH); W = null; edit = false; draw(); } catch (e) { toast('تعذّر: ' + (e.code || e.message)); }
    };
  }
  async function saveCfg() { try { await store.setQasrCfg(CFG); toast('حُفظ.'); draw(); } catch (e) { toast('تعذّر الحفظ: ' + (e.code || e.message)); } }
  async function saveW() { try { await store.setWaqf(W); toast('حُفظ.'); draw(); } catch (e) { toast('تعذّر الحفظ: ' + (e.code || e.message)); } }
  async function previewMap() {
    openModal(`<div class="stack"><h3>🏝️ أرض المقرأة</h3><div class="q3 qt-prev" id="qtPv"></div><button class="btn" type="button" data-close>إغلاق</button></div>`, async (m) => {
      const M3 = await import('./qasr3d.js'); await M3.loadThree();
      const el = m.querySelector('#qtPv'), n = CFG.n || 9, span = n * 34;
      const sc = new M3.Scene3D(el, { dist: span * 0.95, el: 0.95, ang: 0.35, minD: 25, maxD: span * 1.6, target: [0, 0, 0], fov: 45 });
      const S = W ? waqfSum(W, DON) : null; M3.buildMap(sc, { N: n, plots: PLOTS, me: '', sel: null, center: ((n - 1) / 2) + '_' + ((n - 1) / 2), waqfFill: S && W.target ? S.sum / W.target : 0 });
    });
  }
  load().then(() => {
    // اكتمل الهدف: يُحدَّث تلقائياً ويُبلَّغ الطلاب
    if (W && W.status === 'open' && waqfSum(W, DON).sum >= W.target) { W.status = 'full'; store.setWaqf(W).then(async () => { try { const nid = await store.addNotif({ type: 'waqf', title: `🎉 اكتمل ${W.title}!`, body: 'جزاكم الله خيراً، سيُقدَّم الوقف عن جميع المشاركين ويُوثَّق بالفيديو.', link: './#/student', tag: 'waqf-' + W.id, classId: 'all' }); await ctx.sendPush?.(nid); } catch {} }).catch(() => {}); }
    draw();
  }).catch((e) => { host.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; });
}
