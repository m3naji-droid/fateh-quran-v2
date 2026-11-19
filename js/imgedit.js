// محرر صور الإعلانات وتصاميم «صمّم من النص» — كله في المتصفح، دون خوادم.
// openImageEditor(blob) → Blob | null ، openDesigner({ title, body }) → Blob | null

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const OUT = 1280; // أطول ضلع للصورة الناتجة

export const FONTS = [
  { k: 'naskh', name: 'نسخ', fam: 'Amiri', w: 700 },
  { k: 'ruqaa', name: 'رقعة', fam: 'Aref Ruqaa', w: 700 },
  { k: 'kufi', name: 'كوفي', fam: 'Reem Kufi', w: 700 },
  { k: 'modern', name: 'عصري', fam: 'IBM Plex Sans Arabic', w: 700 },
  { k: 'bold', name: 'عريض', fam: 'Lalezar', w: 400 },
  { k: 'title', name: 'عناوين', fam: 'Readex Pro', w: 700 },
];
const fontOf = (k) => FONTS.find((f) => f.k === k) || FONTS[3];
const fontCss = (f, px) => `${f.w} ${Math.round(px)}px "${f.fam}", "IBM Plex Sans Arabic", sans-serif`;
let fontsP = null;
/** تحميل خطوط التصميم (من Google Fonts) قبل الرسم على اللوحة */
export function loadFonts() {
  if (!fontsP) {
    if (!document.querySelector('link[data-imgfonts]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.imgfonts = '1';
      l.href = 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@700&family=Lalezar&display=swap';
      document.head.appendChild(l);
    }
    fontsP = Promise.race([
      Promise.all(FONTS.map((f) => document.fonts.load(fontCss(f, 40), 'بسم')).concat(document.fonts.load('400 40px "Lalezar"', 'بسم'))).catch(() => {}),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  }
  return fontsP;
}
const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('تعذر قراءة الصورة.')); im.src = src; });
const blobImage = async (b) => { const u = URL.createObjectURL(b); try { return await loadImage(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 1000); } };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const toBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((res) => c.toBlob(res, type, q));

/** يلفّ النص العربي على عرض محدد، ويحترم أسطر المستخدم */
function wrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean); let line = '';
    if (!words.length) { out.push(''); return; }
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
/** زخرفة نجمية ثمانية خفيفة تملأ اللوحة */
function islamicPattern(ctx, W, H, color, alpha = 0.08, step = 90) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, step / 45);
  for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) {
    const cx = x + (Math.round(y / step) % 2 ? step / 2 : 0), cy = y, r = step * 0.42;
    for (const rot of [0, Math.PI / 4]) { ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = rot + (i * Math.PI) / 2; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
let iconP = null;
const maqraaIcon = () => (iconP = iconP || loadImage('./assets/icons/icon-192.png').catch(() => null));
/** شريط «مقرأة الفاتح» وإطار ذهبي */
async function drawFrame(ctx, W, H) {
  const g = Math.round(Math.min(W, H) * 0.022), rb = Math.round(Math.min(W, H) * 0.085);
  ctx.save();
  ctx.strokeStyle = '#c9a54a'; ctx.lineWidth = g * 0.55; ctx.strokeRect(g, g, W - 2 * g, H - 2 * g);
  ctx.lineWidth = g * 0.18; ctx.strokeRect(g * 1.9, g * 1.9, W - 3.8 * g, H - 3.8 * g);
  ctx.fillStyle = 'rgba(11, 61, 46, .92)'; ctx.fillRect(0, H - rb, W, rb);
  ctx.fillStyle = '#c9a54a'; ctx.fillRect(0, H - rb, W, Math.max(2, rb * 0.05));
  const ic = await maqraaIcon(), fs = rb * 0.42;
  ctx.font = fontCss(fontOf('title'), fs); ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const label = 'مقرأة الفاتح', tw = ctx.measureText(label).width, isz = rb * 0.62, gap = rb * 0.2, total = tw + (ic ? isz + gap : 0);
  const x0 = (W + total) / 2;
  ctx.fillStyle = '#f3d48a'; ctx.textAlign = 'right'; ctx.fillText(label, x0, H - rb / 2 + rb * 0.03);
  if (ic) ctx.drawImage(ic, x0 - total, H - rb / 2 - isz / 2, isz, isz);
  ctx.restore();
}

/* ======================= التصاميم الجاهزة ======================= */
export const TEMPLATES = [
  { k: 'alert', name: 'تنبيه', icon: '⚠️', c: ['#7a1d1d', '#b8452e'], acc: '#ffd27a' },
  { k: 'congrats', name: 'تهنئة', icon: '🎉', c: ['#0b4a39', '#1f8a68'], acc: '#f3d48a' },
  { k: 'exam', name: 'موعد اختبار', icon: '📝', c: ['#16264d', '#2f5aa8'], acc: '#ffd27a' },
  { k: 'holiday', name: 'إجازة', icon: '🌴', c: ['#0b5f68', '#38a89e'], acc: '#fff1b8' },
  { k: 'contest', name: 'مسابقة', icon: '🏆', c: ['#3c2066', '#8a4fd1'], acc: '#ffd27a' },
  { k: 'honor', name: 'تكريم طالب', icon: '🌟', c: ['#5a3d0a', '#c9952b'], acc: '#fff4d1' },
];
export const SIZES = [
  { k: 'sq', name: 'مربع', w: 1080, h: 1080 },
  { k: 'story', name: 'طولي (حالة)', w: 1080, h: 1920 },
  { k: 'wide', name: 'عرضي', w: 1600, h: 900 },
];
/** يرسم بطاقة إعلان مصممة من العنوان والنص */
export async function designCard({ tpl = 'alert', size = 'sq', title = '', body = '', extra = '', frame = true } = {}) {
  await loadFonts();
  const T = TEMPLATES.find((x) => x.k === tpl) || TEMPLATES[0], Z = SIZES.find((x) => x.k === size) || SIZES[0];
  const W = Z.w, H = Z.h, c = canvas(W, H), ctx = c.getContext('2d'), u = Math.min(W, H) / 100;
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, T.c[0]); g.addColorStop(1, T.c[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  islamicPattern(ctx, W, H, '#ffffff', 0.07, u * 11);
  const rg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(255,255,255,.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const bottom = frame ? H - u * 8.5 - u * 3 : H - u * 5;
  let y = H > W * 1.3 ? H * 0.14 : u * 12;
  // شارة نوع الإعلان
  ctx.font = fontCss(fontOf('title'), u * 4.2);
  const pw = ctx.measureText(T.name).width + u * 7, ph = u * 7.5;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; roundRect(ctx, W / 2 - pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
  ctx.fillStyle = T.acc; ctx.fillText(T.name, W / 2, y + u * 0.3);
  y += ph / 2 + u * 9;
  ctx.font = `${u * 13}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.fillText(T.icon, W / 2, y); y += u * 11;
  // العنوان: يصغر حتى يتسع في سطرين
  const maxW = W - u * 16;
  let ts = u * 9.5, tl;
  for (;;) { ctx.font = fontCss(fontOf('title'), ts); tl = wrap(ctx, title || T.name, maxW); if (tl.length <= 2 || ts < u * 5) break; ts *= 0.9; }
  ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = u;
  tl.forEach((l) => { ctx.fillText(l, W / 2, y + ts / 2); y += ts * 1.35; });
  ctx.shadowBlur = 0;
  // خط زخرفي
  y += u * 1.5; ctx.strokeStyle = T.acc; ctx.lineWidth = u * 0.5; ctx.beginPath(); ctx.moveTo(W / 2 - u * 12, y); ctx.lineTo(W / 2 + u * 12, y); ctx.stroke();
  ctx.fillStyle = T.acc; ctx.beginPath(); ctx.arc(W / 2, y, u * 1.1, 0, 7); ctx.fill(); y += u * 6;
  // النص: يصغر حتى يتسع للمساحة الباقية
  const room = bottom - y - (extra ? u * 10 : 0);
  let bs = u * (H > W * 1.3 ? 7 : 5.6), bl;
  for (;;) { ctx.font = fontCss(fontOf('modern'), bs); bl = wrap(ctx, body, maxW); if (bl.length * bs * 1.6 <= room || bs < u * 2.6) break; bs *= 0.92; }
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  const bh = bl.length * bs * 1.6; let by = y + Math.max(0, (room - bh) / 2);
  bl.forEach((l) => { ctx.fillText(l, W / 2, by + bs * 0.8); by += bs * 1.6; });
  if (extra) {
    ctx.font = fontCss(fontOf('title'), u * 4.6); const ew = ctx.measureText(extra).width + u * 8, eh = u * 8, ey = bottom - eh - u;
    ctx.fillStyle = T.acc; roundRect(ctx, W / 2 - ew / 2, ey, ew, eh, eh / 2); ctx.fill();
    ctx.fillStyle = T.c[0]; ctx.fillText(extra, W / 2, ey + eh / 2 + u * 0.3);
  }
  if (frame) await drawFrame(ctx, W, H);
  return toBlob(c, 'image/jpeg', 0.92);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* ======================= واجهة نافذة كاملة ======================= */
function overlay(html) {
  const box = document.createElement('div');
  box.className = 'ie-ov'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<div class="ie-box">${html}</div>`;
  document.body.appendChild(box); document.body.classList.add('ie-lock');
  return { box, close: () => { box.remove(); document.body.classList.remove('ie-lock'); } };
}

/** «صمّم من النص»: يختار المعلم القالب والمقاس، ويرى المعاينة فوراً */
export function openDesigner({ title = '', body = '' } = {}) {
  return new Promise((resolve) => {
    const st = { tpl: 'alert', size: 'sq', title, body, extra: '', frame: true };
    const { box, close } = overlay(`
      <div class="ie-head"><b>🎨 صمّم من النص</b><button type="button" class="btn sm" data-x>✕</button></div>
      <div class="ie-main"><div class="ie-stage"><img class="ie-prev" alt="معاينة التصميم"><div class="ie-busy" hidden>جارٍ التصميم…</div></div>
      <div class="ie-side">
        <div class="ie-lbl">القالب</div><div class="ie-chips" data-g="tpl">${TEMPLATES.map((t) => `<button type="button" data-v="${t.k}" style="--c1:${t.c[0]};--c2:${t.c[1]}">${t.icon} ${t.name}</button>`).join('')}</div>
        <div class="ie-lbl">المقاس</div><div class="ie-chips" data-g="size">${SIZES.map((z) => `<button type="button" data-v="${z.k}">${z.name}</button>`).join('')}</div>
        <label class="field">العنوان<input type="text" data-f="title" maxlength="60" value="${esc(title)}"></label>
        <label class="field">النص<textarea data-f="body" maxlength="300" rows="4">${esc(body)}</textarea></label>
        <label class="field">سطر مميز (اختياري)<input type="text" data-f="extra" maxlength="40" placeholder="مثال: الخميس ٢٠ نوفمبر · أو اسم الطالب"></label>
        <label class="ie-check"><input type="checkbox" data-f="frame" checked> إطار «مقرأة الفاتح»</label>
      </div></div>
      <div class="ie-foot"><button type="button" class="btn" data-edit>✏️ عدّله في المحرر</button><button type="button" class="btn primary" data-ok>✓ استخدمه</button></div>`);
    let blob = null, seq = 0, t = 0;
    const paint = async () => {
      const my = ++seq; box.querySelector('.ie-busy').hidden = false;
      const b = await designCard(st); if (my !== seq) return;
      blob = b; const im = box.querySelector('.ie-prev'); if (im.src) URL.revokeObjectURL(im.src); im.src = URL.createObjectURL(b);
      box.querySelector('.ie-busy').hidden = true;
    };
    const sel = () => box.querySelectorAll('.ie-chips').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', st[g.dataset.g] === b.dataset.v)));
    box.querySelectorAll('.ie-chips button').forEach((b) => (b.onclick = () => { st[b.closest('.ie-chips').dataset.g] = b.dataset.v; sel(); paint(); }));
    box.querySelectorAll('[data-f]').forEach((i) => (i.oninput = () => { st[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; clearTimeout(t); t = setTimeout(paint, 250); }));
    const done = (v) => { close(); resolve(v); };
    box.querySelector('[data-x]').onclick = () => done(null);
    box.querySelector('[data-ok]').onclick = () => blob && done(blob);
    box.querySelector('[data-edit]').onclick = async () => { if (!blob) return; const b = blob; close(); resolve(await openImageEditor(b)); };
    sel(); paint();
  });
}

/* ======================= المحرر ======================= */
const ASPECTS = [['orig', 'الأصل', 0], ['1:1', 'مربع', 1], ['4:5', '٤:٥', 4 / 5], ['9:16', 'طولي', 9 / 16], ['16:9', 'عرضي', 16 / 9]];
const FILTERS = [['none', 'بلا', []], ['warm', 'دافئ', [['sepia', 0.25], ['sat', 1.2]]], ['cool', 'بارد', [['hue', -12], ['sat', 0.9]]], ['bw', 'أبيض وأسود', [['sat', 0]]], ['vivid', 'زاهٍ', [['sat', 1.5], ['con', 1.08]]], ['soft', 'ناعم', [['con', 0.9], ['bri', 1.06]]]];
/* الضبط والفلاتر بحساب الألوان مباشرة (مصفوفة ٣×٤ كما في CSS)، لأن ctx.filter لا يعمل في سفاري والآيفون */
const M_ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const mMul = (A, B) => { const o = []; for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c]; o[r * 4 + 3] = A[r * 4] * B[3] + A[r * 4 + 1] * B[7] + A[r * 4 + 2] * B[11] + A[r * 4 + 3]; } return o; };
function opM(k, v) {
  if (k === 'bri') return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
  if (k === 'con') { const o = 127.5 * (1 - v); return [v, 0, 0, o, 0, v, 0, o, 0, 0, v, o]; }
  if (k === 'sat') return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0];
  if (k === 'sepia') { const a = 1 - v; return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0]; }
  if (k === 'hue') { const t = (v * Math.PI) / 180, C = Math.cos(t), S = Math.sin(t); return [0.213 + C * 0.787 - S * 0.213, 0.715 - C * 0.715 - S * 0.715, 0.072 - C * 0.072 + S * 0.928, 0, 0.213 - C * 0.213 + S * 0.143, 0.715 + C * 0.285 + S * 0.14, 0.072 - C * 0.072 - S * 0.283, 0, 0.213 - C * 0.213 - S * 0.787, 0.715 - C * 0.715 + S * 0.715, 0.072 + C * 0.928 + S * 0.072, 0]; }
  return M_ID;
}
/** يطبّق الإضاءة والتباين والتشبع والفلتر على اللوحة كلها */
function applyAdjust(c, W, H, S) {
  let M = M_ID;
  [['bri', S.b / 100], ['con', S.c / 100], ['sat', S.s / 100], ...((FILTERS.find((f) => f[0] === S.f) || FILTERS[0])[2])].forEach(([k, v]) => { M = mMul(opM(k, v), M); });
  if (M.every((v, i) => Math.abs(v - M_ID[i]) < 1e-6)) return;
  const im = c.getImageData(0, 0, W, H), d = im.data;
  const [a, b, e, f, g, h, i, j, k, l, m, n] = M;
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p], gg = d[p + 1], bb = d[p + 2];
    d[p] = a * r + b * gg + e * bb + f; d[p + 1] = g * r + h * gg + i * bb + j; d[p + 2] = k * r + l * gg + m * bb + n; // Uint8Clamped يقصّ تلقائياً
  }
  c.putImageData(im, 0, 0);
}
/** تمويه بالتصغير ثم التكبير (يعمل في كل المتصفحات) */
function softBlur(img, w, h) {
  const sm = canvas(Math.max(2, Math.round(w / 28)), Math.max(2, Math.round(h / 28))), sx = sm.getContext('2d');
  sx.imageSmoothingQuality = 'high'; sx.drawImage(img, 0, 0, sm.width, sm.height);
  const md = canvas(Math.max(4, Math.round(w / 7)), Math.max(4, Math.round(h / 7))), mx = md.getContext('2d');
  mx.imageSmoothingQuality = 'high'; mx.drawImage(sm, 0, 0, md.width, md.height);
  return md;
}
const STICKERS = ['🏆', '⭐', '🌟', '📖', '🕌', '🌙', '✨', '🎉', '🎁', '👏', '❤️', '🔥', '📢', '⏰', '✅', '📝', '🤲', '💡', '۞', '❁', '✿', '❖', '﴾ ﴿'];
const COLORS = ['#ffffff', '#111111', '#0f5c46', '#c9a54a', '#f3d48a', '#b8452e', '#2f5aa8', '#8a4fd1', '#e85d9c'];
const BGS = [['white', 'أبيض', '#ffffff'], ['cream', 'كريمي', '#f6efe0'], ['green', 'أخضر', '#0f5c46'], ['navy', 'كحلي', '#16264d'], ['g1', 'تدرّج أخضر', 'grad:#0b4a39:#1f8a68'], ['g2', 'تدرّج ذهبي', 'grad:#5a3d0a:#e0b354'], ['g3', 'تدرّج بنفسجي', 'grad:#3c2066:#8a4fd1'], ['pat', 'زخرفة', 'pat:#0f5c46'], ['blur', 'الأصل مموّهاً', 'blur']];

/** يفتح المحرر على صورة. يعيد Blob جديداً (JPEG) أو null عند الإلغاء */
export async function openImageEditor(blob) {
  await loadFonts();
  const orig = await blobImage(blob);
  return new Promise((resolve) => {
    const S = { rot: 0, flip: false, aspect: 'orig', cx: 0.5, cy: 0.5, zoom: 1, b: 100, c: 100, s: 100, f: 'none', cut: null, bg: 'white', layers: [], blurs: [], frame: false, sel: -1, tool: 'crop' };
    const hist = [];
    const snap = () => { hist.push(JSON.stringify({ ...S, cut: null, _cut: !!S.cut })); if (hist.length > 30) hist.shift(); };
    const { box, close } = overlay(`
      <div class="ie-head"><b>✏️ تعديل الصورة</b><span class="ie-hint small"></span><button type="button" class="btn sm" data-undo title="تراجع">↶ تراجع</button><button type="button" class="btn sm" data-x>✕</button></div>
      <div class="ie-main"><div class="ie-stage"><canvas class="ie-cv"></canvas><div class="ie-busy" hidden></div></div>
      <div class="ie-side">
        <div class="ie-tabs">${[['crop', '✂️ قص'], ['adj', '🎚️ ضبط'], ['bg', '🪄 الخلفية'], ['text', '🔤 نص'], ['stk', '😊 ملصقات'], ['blur', '🫥 تمويه'], ['frame', '🖼️ إطار']].map(([k, l]) => `<button type="button" data-t="${k}">${l}</button>`).join('')}</div>
        <div class="ie-panel"></div>
      </div></div>
      <div class="ie-foot"><button type="button" class="btn" data-x2>إلغاء</button><button type="button" class="btn primary" data-ok>✓ حفظ التعديل</button></div>`);
    const cv = box.querySelector('.ie-cv'), ctx = cv.getContext('2d'), panel = box.querySelector('.ie-panel'), hint = box.querySelector('.ie-hint'), busy = box.querySelector('.ie-busy');
    let boxes = []; // مواضع الطبقات في آخر رسم (للسحب)
    /* ---- الرسم ---- */
    const srcCanvas = () => {
      const base = S.cut || orig, w = base.naturalWidth || base.width, h = base.naturalHeight || base.height;
      let src = base;
      if (S.cut) { // الخلفية الجديدة تحت الصورة المقصوصة
        const c = canvas(w, h), x = c.getContext('2d'), bg = (BGS.find((b) => b[0] === S.bg) || BGS[0])[2];
        if (bg === 'blur') { x.imageSmoothingQuality = 'high'; x.drawImage(softBlur(orig, w, h), -w * 0.05, -h * 0.05, w * 1.1, h * 1.1); x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(0, 0, w, h); }
        else if (bg.startsWith('grad:')) { const [, a, b] = bg.split(':'); const g = x.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); }
        else if (bg.startsWith('pat:')) { x.fillStyle = '#f6efe0'; x.fillRect(0, 0, w, h); islamicPattern(x, w, h, bg.split(':')[1], 0.22, Math.max(w, h) / 9); }
        else { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
        x.drawImage(base, 0, 0, w, h); src = c;
      }
      const r = S.rot % 180 !== 0, c2 = canvas(r ? h : w, r ? w : h), x2 = c2.getContext('2d');
      x2.translate(c2.width / 2, c2.height / 2); x2.rotate((S.rot * Math.PI) / 180); if (S.flip) x2.scale(-1, 1);
      x2.drawImage(src, -w / 2, -h / 2, w, h);
      return c2;
    };
    let srcCache = null, srcKey = '';
    const geom = (src) => {
      const sw = src.width, sh = src.height, a = ASPECTS.find((x) => x[0] === S.aspect)[2] || sw / sh;
      let cw = Math.min(sw, sh * a) / S.zoom, ch = cw / a;
      const x = Math.min(Math.max(0, S.cx * sw - cw / 2), sw - cw), y = Math.min(Math.max(0, S.cy * sh - ch / 2), sh - ch);
      const W = a >= 1 ? OUT : Math.round(OUT * a), H = a >= 1 ? Math.round(OUT / a) : OUT;
      return { x, y, cw, ch, W, H, sw, sh };
    };
    async function render(target, preview) {
      const key = [S.rot, S.flip, S.bg, !!S.cut].join('|');
      if (!srcCache || key !== srcKey) { srcCache = srcCanvas(); srcKey = key; }
      const G = geom(srcCache), W = G.W, H = G.H;
      target.width = W; target.height = H; const c = target.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
      c.imageSmoothingQuality = 'high'; c.drawImage(srcCache, G.x, G.y, G.cw, G.ch, 0, 0, W, H);
      applyAdjust(c, W, H, S);
      // التمويه: تكسير المنطقة إلى مربعات كبيرة فلا تُقرأ
      S.blurs.forEach((r) => {
        const x = Math.round(r.x * W), y = Math.round(r.y * H), w = Math.max(4, Math.round(r.w * W)), h = Math.max(4, Math.round(r.h * H)), k = Math.max(6, Math.round(Math.min(w, h) / 6));
        const t = canvas(Math.max(1, w / k), Math.max(1, h / k)), tx = t.getContext('2d'); tx.drawImage(target, x, y, w, h, 0, 0, t.width, t.height);
        c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, t.width, t.height, x, y, w, h); c.imageSmoothingEnabled = true;
        if (preview) { c.save(); c.strokeStyle = '#ffd400'; c.setLineDash([8, 6]); c.lineWidth = 3; c.strokeRect(x, y, w, h); c.restore(); }
      });
      if (S.frame) await drawFrame(c, W, H);
      boxes = [];
      S.layers.forEach((L, i) => {
        c.save(); c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const px = L.size * W;
        if (L.type === 'stk') {
          c.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Amiri",sans-serif`; c.fillStyle = L.color || '#c9a54a';
          c.fillText(L.text, L.x * W, L.y * H);
          const w = c.measureText(L.text).width; boxes[i] = { x: L.x * W - w / 2, y: L.y * H - px / 2, w, h: px };
        } else {
          const f = fontOf(L.font); c.font = fontCss(f, px);
          const lines = wrap(c, L.text, W * 0.9), lh = px * 1.45, tw = Math.max(...lines.map((l) => c.measureText(l).width), 1), th = lines.length * lh;
          const bx = L.x * W - tw / 2, by = L.y * H - th / 2, pad = px * 0.35;
          if (L.box) { c.fillStyle = L.box; c.globalAlpha = 0.82; roundRect(c, bx - pad, by - pad * 0.5, tw + 2 * pad, th + pad, pad * 0.8); c.fill(); c.globalAlpha = 1; }
          if (L.shadow) { c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = px * 0.18; c.shadowOffsetY = px * 0.05; }
          lines.forEach((l, k) => {
            const y = by + lh * k + lh / 2;
            if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = px * 0.12; c.strokeStyle = L.stroke; c.strokeText(l, L.x * W, y); }
            c.fillStyle = L.color; c.fillText(l, L.x * W, y);
          });
          boxes[i] = { x: bx - pad, y: by - pad * 0.5, w: tw + 2 * pad, h: th + pad };
        }
        c.restore();
        if (preview && i === S.sel) { const B = boxes[i]; c.save(); c.strokeStyle = '#2f8cff'; c.setLineDash([10, 6]); c.lineWidth = 3; c.strokeRect(B.x - 4, B.y - 4, B.w + 8, B.h + 8); c.restore(); }
      });
      if (preview && S.tool === 'crop' && (S.zoom > 1 || S.aspect !== 'orig')) { c.save(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; for (const k of [1, 2]) { c.beginPath(); c.moveTo((W * k) / 3, 0); c.lineTo((W * k) / 3, H); c.moveTo(0, (H * k) / 3); c.lineTo(W, (H * k) / 3); c.stroke(); } c.restore(); }
      return G;
    }
    let rq = 0;
    const draw = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => render(cv, true)); };
    /* ---- السحب على اللوحة ---- */
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height, nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height }; };
    let drag = null;
    cv.onpointerdown = (e) => {
      const p = pt(e); cv.setPointerCapture(e.pointerId);
      if (S.tool === 'blur') { snap(); const r = { x: p.nx, y: p.ny, w: 0, h: 0 }; S.blurs.push(r); drag = { k: 'blur', r, p }; return; }
      if (S.tool === 'crop') { drag = { k: 'crop', p, cx: S.cx, cy: S.cy }; return; }
      const i = boxes.map((B, i) => [B, i]).reverse().find(([B]) => B && p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h)?.[1];
      if (i != null) { snap(); S.sel = i; drag = { k: 'layer', i, p, x: S.layers[i].x, y: S.layers[i].y }; if (S.tool !== 'text' && S.tool !== 'stk') setTool(S.layers[i].type === 'stk' ? 'stk' : 'text'); else paintPanel(); }
      else { S.sel = -1; paintPanel(); }
      draw();
    };
    cv.onpointermove = (e) => {
      if (!drag) return; const p = pt(e);
      if (drag.k === 'layer') { const L = S.layers[drag.i]; L.x = Math.min(0.98, Math.max(0.02, drag.x + (p.x - drag.p.x) / cv.width)); L.y = Math.min(0.98, Math.max(0.02, drag.y + (p.y - drag.p.y) / cv.height)); }
      else if (drag.k === 'blur') { const r = drag.r; r.x = Math.min(drag.p.nx, p.nx); r.y = Math.min(drag.p.ny, p.ny); r.w = Math.abs(p.nx - drag.p.nx); r.h = Math.abs(p.ny - drag.p.ny); }
      else if (drag.k === 'crop') { const G = geom(srcCache); S.cx = drag.cx - ((p.x - drag.p.x) / cv.width) * (G.cw / G.sw); S.cy = drag.cy - ((p.y - drag.p.y) / cv.height) * (G.ch / G.sh); const hw = G.cw / G.sw / 2, hh = G.ch / G.sh / 2; S.cx = Math.min(1 - hw, Math.max(hw, S.cx)); S.cy = Math.min(1 - hh, Math.max(hh, S.cy)); }
      draw();
    };
    cv.onpointerup = () => { if (drag?.k === 'blur' && (drag.r.w < 0.02 || drag.r.h < 0.02)) { S.blurs.pop(); hist.pop(); } drag = null; draw(); };
    /* ---- اللوحات ---- */
    const seg = (name, items, cur) => `<div class="ie-chips" data-g="${name}">${items.map(([k, l]) => `<button type="button" data-v="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const range = (k, l, min, max, v) => `<label class="ie-range">${l}<input type="range" data-r="${k}" min="${min}" max="${max}" value="${v}"></label>`;
    const sw = (k, cur, extra = []) => `<div class="ie-sw" data-s="${k}">${[...extra, ...COLORS].map((c) => `<button type="button" data-v="${c}" title="${c}" class="${cur === c ? 'on' : ''}" style="--sw:${c === '' ? 'transparent' : c}">${c === '' ? '∅' : ''}</button>`).join('')}</div>`;
    function paintPanel() {
      box.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === S.tool));
      const L = S.layers[S.sel];
      const tips = { crop: 'اسحب الصورة لتحريكها داخل الإطار.', adj: '', bg: '', text: 'اسحب النص لتحريكه.', stk: 'اسحب الملصق لتحريكه.', blur: 'ارسم بإصبعك مستطيلاً فوق ما تريد إخفاءه.', frame: '' };
      hint.textContent = tips[S.tool] || '';
      if (S.tool === 'crop') panel.innerHTML = `<div class="ie-lbl">المقاس</div>${seg('aspect', ASPECTS.map((a) => [a[0], a[1]]), S.aspect)}
        ${range('zoom', '🔍 تقريب', 100, 300, Math.round(S.zoom * 100))}
        <div class="ie-row"><button type="button" class="btn sm" data-a="rotL">↺ تدوير</button><button type="button" class="btn sm" data-a="rotR">↻ تدوير</button><button type="button" class="btn sm" data-a="flip">⇋ قلب</button></div>`;
      else if (S.tool === 'adj') panel.innerHTML = `${range('b', '☀️ الإضاءة', 50, 160, S.b)}${range('c', '◐ التباين', 50, 160, S.c)}${range('s', '🎨 التشبع', 0, 200, S.s)}
        <div class="ie-lbl">فلاتر</div>${seg('f', FILTERS.map((f) => [f[0], f[1]]), S.f)}<button type="button" class="btn sm ghost" data-a="resetAdj">إعادة الضبط</button>`;
      else if (S.tool === 'bg') panel.innerHTML = S.cut ? `<p class="small" style="margin:0">✓ أُزيلت الخلفية. اختر خلفية جديدة:</p><div class="ie-bgs">${BGS.map(([k, l, v]) => `<button type="button" data-bg="${k}" class="${S.bg === k ? 'on' : ''}" style="${v.startsWith('#') ? `background:${v}` : v.startsWith('grad:') ? `background:linear-gradient(160deg,${v.split(':')[1]},${v.split(':')[2]})` : ''}">${l}</button>`).join('')}</div><button type="button" class="btn sm ghost" data-a="uncut">↺ أعِد الخلفية الأصلية</button>`
        : `<p class="small" style="margin:0">تُزال خلفية الصورة ويبقى الشخص أو الشيء الأساسي فيها، ثم تختار خلفية جديدة.</p><button type="button" class="btn primary" data-a="cut">🪄 أزل الخلفية</button><p class="small muted" style="margin:0">أول مرة يُنزَّل نموذج صغير (نحو ٤٠ ميغابايت) يُحفظ في جهازك، ثم تصير أسرع. تعمل المعالجة في جهازك ولا تُرسل الصورة لأي جهة.</p>`;
      else if (S.tool === 'text') panel.innerHTML = `<button type="button" class="btn sm primary" data-a="addText">＋ أضف نصاً</button>${L && L.type === 'text' ? `
        <label class="field">النص<textarea data-l="text" rows="2" maxlength="160">${esc(L.text)}</textarea></label>
        <div class="ie-lbl">الخط</div><div class="ie-chips" data-g="font">${FONTS.map((f) => `<button type="button" data-v="${f.k}" class="${L.font === f.k ? 'on' : ''}" style="font-family:'${f.fam}';font-weight:${f.w}">${f.name}</button>`).join('')}</div>
        ${range('lsize', '🔠 الحجم', 3, 18, Math.round(L.size * 100))}
        <div class="ie-lbl">اللون</div>${sw('color', L.color)}
        <div class="ie-lbl">خلفية النص</div>${sw('box', L.box || '', [''])}
        <div class="ie-row"><label class="ie-check"><input type="checkbox" data-l="shadow" ${L.shadow ? 'checked' : ''}> ظل</label><label class="ie-check"><input type="checkbox" data-l="stroke" ${L.stroke ? 'checked' : ''}> حدّ حول الحروف</label></div>
        <button type="button" class="btn sm danger" data-a="del">🗑 احذف النص</button>` : '<p class="small muted" style="margin:0">أو اضغط على نص في الصورة لتعديله.</p>'}`;
      else if (S.tool === 'stk') panel.innerHTML = `<div class="ie-stk">${STICKERS.map((s) => `<button type="button" data-stk="${esc(s)}">${esc(s)}</button>`).join('')}</div>${L && L.type === 'stk' ? `${range('lsize', '🔠 الحجم', 4, 40, Math.round(L.size * 100))}<div class="ie-lbl">لون الزخارف</div>${sw('color', L.color)}<button type="button" class="btn sm danger" data-a="del">🗑 احذف الملصق</button>` : ''}`;
      else if (S.tool === 'blur') panel.innerHTML = `<p class="small" style="margin:0">لإخفاء وجه أو اسم أو رقم قبل الإرسال: ارسم مستطيلاً فوقه.</p><p class="small muted" style="margin:0">المناطق المموّهة: ${ar(S.blurs.length)}</p>${S.blurs.length ? '<button type="button" class="btn sm" data-a="unblur">↶ أزل آخر تمويه</button>' : ''}`;
      else if (S.tool === 'frame') panel.innerHTML = `<label class="ie-check"><input type="checkbox" data-a="frame" ${S.frame ? 'checked' : ''}> إطار ذهبي وشريط «مقرأة الفاتح» بشعارها</label><p class="small muted" style="margin:0">فتكون إعلاناتك كلها بهوية واحدة.</p>`;
      wire();
    }
    function wire() {
      panel.querySelectorAll('.ie-chips[data-g] button').forEach((b) => (b.onclick = () => {
        const g = b.closest('.ie-chips').dataset.g; snap();
        if (g === 'font') S.layers[S.sel].font = b.dataset.v; else { S[g] = b.dataset.v; if (g === 'aspect') { S.cx = 0.5; S.cy = 0.5; } }
        paintPanel(); draw();
      }));
      panel.querySelectorAll('[data-r]').forEach((r) => {
        r.onpointerdown = () => snap();
        r.oninput = () => { const k = r.dataset.r, v = +r.value; if (k === 'zoom') S.zoom = v / 100; else if (k === 'lsize') S.layers[S.sel].size = v / 100; else S[k] = v; draw(); };
      });
      panel.querySelectorAll('.ie-sw').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => { snap(); S.layers[S.sel][g.dataset.s] = b.dataset.v; paintPanel(); draw(); })));
      panel.querySelectorAll('[data-l]').forEach((i) => {
        i.onfocus = () => snap();
        i.oninput = () => { const L = S.layers[S.sel]; if (i.dataset.l === 'text') L.text = i.value || ' '; else if (i.dataset.l === 'shadow') L.shadow = i.checked; else if (i.dataset.l === 'stroke') L.stroke = i.checked ? (L.color === '#111111' ? '#ffffff' : '#111111') : ''; draw(); };
      });
      panel.querySelectorAll('[data-bg]').forEach((b) => (b.onclick = () => { snap(); S.bg = b.dataset.bg; paintPanel(); draw(); }));
      panel.querySelectorAll('[data-stk]').forEach((b) => (b.onclick = () => { snap(); S.layers.push({ type: 'stk', text: b.dataset.stk, size: 0.12, color: '#c9a54a', x: 0.5, y: 0.5 }); S.sel = S.layers.length - 1; paintPanel(); draw(); }));
      panel.querySelectorAll('[data-a]').forEach((b) => {
        const a = b.dataset.a, act = {
          rotL: () => { S.rot = (S.rot + 270) % 360; }, rotR: () => { S.rot = (S.rot + 90) % 360; }, flip: () => { S.flip = !S.flip; },
          resetAdj: () => Object.assign(S, { b: 100, c: 100, s: 100, f: 'none' }),
          addText: () => { S.layers.push({ type: 'text', text: 'اكتب هنا', font: 'title', size: 0.08, color: '#ffffff', box: '#0f5c46', shadow: false, stroke: '', x: 0.5, y: 0.2 + (S.layers.length % 4) * 0.15 }); S.sel = S.layers.length - 1; },
          del: () => { S.layers.splice(S.sel, 1); S.sel = -1; },
          unblur: () => { S.blurs.pop(); }, frame: () => { S.frame = b.checked; },
          uncut: () => { S.cut = null; }, cut: () => removeBg(),
        }[a];
        if (b.type === 'checkbox') b.onchange = () => { snap(); act(); draw(); };
        else b.onclick = () => { if (a !== 'cut') snap(); act(); paintPanel(); draw(); };
      });
    }
    async function removeBg() {
      busy.hidden = false; busy.textContent = 'جارٍ تجهيز أداة إزالة الخلفية…';
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm');
        const fn = mod.removeBackground || mod.default;
        const out = await fn(blob, { progress: (k, cur, tot) => { busy.textContent = /fetch/.test(k) ? `تنزيل النموذج (مرة واحدة)… ${ar(Math.round((cur / Math.max(1, tot)) * 100))}٪` : 'جارٍ إزالة الخلفية…'; } });
        snap(); S.cut = await blobImage(out); S.bg = 'white'; srcCache = null;
        paintPanel(); draw();
      } catch (e) { console.warn('bg', e); alertBox('تعذرت إزالة الخلفية. تأكد من الاتصال بالإنترنت وجرّب مرة أخرى، أو جرّب من متصفح آخر (Chrome أو Safari الحديث).'); }
      busy.hidden = true;
    }
    const alertBox = (m) => { busy.hidden = false; busy.textContent = m; setTimeout(() => (busy.hidden = true), 4500); };
    box.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => setTool(b.dataset.t)));
    function setTool(t) { S.tool = t; if (t !== 'text' && t !== 'stk') S.sel = -1; else if (S.sel >= 0 && S.layers[S.sel].type !== (t === 'text' ? 'text' : 'stk')) S.sel = -1; paintPanel(); draw(); }
    box.querySelector('[data-undo]').onclick = () => { const h = hist.pop(); if (!h) return; const o = JSON.parse(h), cut = S.cut; Object.assign(S, o); S.cut = o._cut ? cut : null; delete S._cut; srcCache = null; paintPanel(); draw(); };
    const done = async (ok) => {
      if (!ok) { close(); resolve(null); return; }
      busy.hidden = false; busy.textContent = 'جارٍ الحفظ…';
      const out = canvas(1, 1); await render(out, false);
      const b = await toBlob(out, 'image/jpeg', 0.92); close(); resolve(b);
    };
    box.querySelector('[data-x]').onclick = () => done(false);
    box.querySelector('[data-x2]').onclick = () => done(false);
    box.querySelector('[data-ok]').onclick = () => done(true);
    paintPanel(); draw();
  });
}
