// بطاقات دخول الطلاب: ٨ بطاقات في صفحة A4، كل بطاقة فيها رمز QR للموقع وملاحظات واسم الطالب وكلمة سره.
// الرسم على canvas مباشرة (لا لقطة HTML) حتى تتصل الحروف العربية بشكل صحيح في PDF.

export const LIBS = {
  qr: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
};
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('تعذر تحميل مكتبة من الإنترنت. تحقق من الاتصال.'));
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

export const DEFAULT_NOTES = [
  'امسح الرمز أو افتح الرابط، ثم اختر «الطالب».',
  'اختر صفك ثم اسمك، واكتب كلمة السر.',
  'يمكنك تغيير كلمة السر من حسابك. احفظها ولا تعطها لأحد.',
].join('\n');

// صفحة A4 بدقة ١٥٠ نقطة في البوصة
const PAGE_W = 1240, PAGE_H = 1754, MARGIN = 56, GAP = 28, COLS = 2, ROWS = 4;
const CARD_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
const CARD_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;
export const PER_PAGE = COLS * ROWS;

const C = { green: '#0d5c46', gold: '#a77a1c', ink: '#15231e', muted: '#5b6b64', line: '#d9cfae', paper: '#fffdf7', box: '#f3efe2' };
const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW) {
  const out = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).filter(Boolean).forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
  });
  return out;
}

function fitText(ctx, text, weight, size, maxW, min = 16) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > min) { s -= 2; ctx.font = `${weight} ${s}px ${FONT}`; }
  return s;
}

function drawQR(ctx, qr, x, y, size) {
  const n = qr.getModuleCount();
  const cell = size / (n + 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + (c + 1) * cell), Math.floor(y + (r + 1) * cell), Math.ceil(cell), Math.ceil(cell));
  }
}

function drawCard(ctx, x, y, card, opts, qr) {
  const w = CARD_W, h = CARD_H, pad = 22;
  // الإطار
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = C.paper; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.gold; ctx.stroke();
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 13);
  ctx.lineWidth = 1; ctx.strokeStyle = C.line; ctx.stroke();
  // الشريط العلوي
  roundRect(ctx, x + 7, y + 7, w - 14, 58, 13);
  ctx.save(); ctx.clip(); ctx.fillStyle = C.green; ctx.fillRect(x + 7, y + 7, w - 14, 58); ctx.restore();
  ctx.direction = 'rtl'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(opts.title, x + w - pad, y + 37);
  ctx.textAlign = 'left'; ctx.font = `500 20px ${FONT}`;
  ctx.fillText(card.className || '', x + pad, y + 37);

  // رمز QR على اليسار
  const qrSize = 168, qrX = x + pad, qrY = y + 84;
  drawQR(ctx, qr, qrX, qrY, qrSize);
  ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = `500 15px ${FONT}`;
  ctx.direction = 'ltr';
  const shortUrl = opts.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  let us = 15; while (ctx.measureText(shortUrl).width > qrSize + 30 && us > 10) { us--; ctx.font = `500 ${us}px ${FONT}`; }
  ctx.fillText(shortUrl, qrX + qrSize / 2, qrY + qrSize + 16);
  ctx.direction = 'rtl';

  // الاسم وكلمة السر على اليمين
  const right = x + w - pad, colW = w - pad * 3 - qrSize;
  ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = `500 18px ${FONT}`;
  ctx.fillText('اسم الطالب', right, y + 96);
  ctx.fillStyle = C.ink;
  fitText(ctx, card.name, 700, 32, colW);
  ctx.fillText(card.name, right, y + 132);

  ctx.fillStyle = C.muted; ctx.font = `500 18px ${FONT}`;
  ctx.fillText('كلمة السر', right, y + 178);
  const boxW = colW, boxH = 62, boxX = right - boxW, boxY = y + 196;
  roundRect(ctx, boxX, boxY, boxW, boxH, 10);
  ctx.fillStyle = C.box; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  if (card.password) {
    ctx.direction = 'ltr';
    ctx.font = `700 42px ui-monospace, 'Courier New', monospace`;
    ctx.fillText(card.password.split('').join(' '), boxX + boxW / 2, boxY + boxH / 2 + 2);
    ctx.direction = 'rtl';
  } else {
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText('غيّرها الطالب بنفسه', boxX + boxW / 2, boxY + boxH / 2);
  }

  // الملاحظات
  ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = `400 16px ${FONT}`;
  const notesTop = y + 282, maxLines = Math.floor((y + h - 22 - notesTop) / 22);
  const lines = wrap(ctx, opts.notes, w - pad * 2).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, right, notesTop + i * 22));
  ctx.restore();
}

/** يرسم صفحات البطاقات ويعيد مصفوفة canvas */
export async function renderPages(cards, opts) {
  await loadScript(LIBS.qr);
  try { await Promise.all([document.fonts.load(`700 28px ${FONT}`), document.fonts.load(`400 16px ${FONT}`), document.fonts.load(`500 18px ${FONT}`)]); } catch {}
  const qr = window.qrcode(0, 'M');
  qr.addData(opts.url);
  qr.make();
  const pages = [];
  for (let p = 0; p < cards.length; p += PER_PAGE) {
    const cv = document.createElement('canvas');
    cv.width = PAGE_W; cv.height = PAGE_H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    // خطوط قص خفيفة بين البطاقات
    ctx.strokeStyle = '#e4e4e4'; ctx.setLineDash([8, 8]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAGE_W / 2, MARGIN / 2); ctx.lineTo(PAGE_W / 2, PAGE_H - MARGIN / 2); ctx.stroke();
    for (let r = 1; r < ROWS; r++) { const yy = MARGIN + r * (CARD_H + GAP) - GAP / 2; ctx.beginPath(); ctx.moveTo(MARGIN / 2, yy); ctx.lineTo(PAGE_W - MARGIN / 2, yy); ctx.stroke(); }
    ctx.setLineDash([]);
    cards.slice(p, p + PER_PAGE).forEach((card, k) => {
      const col = k % COLS, row = Math.floor(k / COLS);
      // الترتيب من اليمين إلى اليسار
      const x = PAGE_W - MARGIN - (col + 1) * CARD_W - col * GAP;
      const y = MARGIN + row * (CARD_H + GAP);
      drawCard(ctx, x, y, card, opts, qr);
    });
    pages.push(cv);
  }
  return pages;
}

export async function downloadPDF(pages, filename, onProgress = () => {}) {
  await loadScript(LIBS.pdf);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  pages.forEach((cv, i) => {
    if (i) pdf.addPage();
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    onProgress(i + 1, pages.length);
  });
  pdf.save(filename);
}

/** طباعة مباشرة: نضع صور الصفحات في عنصر الطباعة ثم نفتح نافذة الطباعة */
export function printPages(pages) {
  let root = document.getElementById('printRoot');
  if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
  root.innerHTML = pages.map((cv) => `<img src="${cv.toDataURL('image/png')}" alt="">`).join('');
  const done = () => { root.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
}
