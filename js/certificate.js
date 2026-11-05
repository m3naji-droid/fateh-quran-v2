// شهادة تقدير للفائزين في نتائج الشهر: A4 أفقية، مرسومة على canvas لتتصل الحروف العربية في PDF
import { loadScript, LIBS } from './cards.js';

const W = 1754, H = 1240; // A4 أفقية بدقة ١٥٠ نقطة في البوصة
const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
const QFONT = "'Amiri Quran', 'Amiri', serif";
const C = { green: '#0d5c46', green2: '#1f8a3c', gold: '#a77a1c', gold2: '#d9b45a', ink: '#15231e', muted: '#5b6b64', paper: '#fffdf5' };
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]).replace('.', '٫');

function star(ctx, cx, cy, r, fill) {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = fill;
  [0, Math.PI / 4].forEach((rot) => { ctx.save(); ctx.rotate(rot); ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.restore(); });
  ctx.restore();
}

function fit(ctx, text, weight, size, maxW, family = FONT) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
}

function medal(ctx, cx, cy, rank) {
  const g = ctx.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, 90);
  const [a, b] = rank === 1 ? ['#ffe9a8', '#c9971f'] : rank === 2 ? ['#f4f6f8', '#9aa4ad'] : rank === 3 ? ['#f3c79b', '#b06a33'] : ['#e3efe9', '#4cc09a'];
  g.addColorStop(0, a); g.addColorStop(1, b);
  // الشريطان
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.moveTo(cx - 55, cy + 40); ctx.lineTo(cx - 85, cy + 150); ctx.lineTo(cx - 50, cy + 128); ctx.lineTo(cx - 25, cy + 160); ctx.lineTo(cx - 5, cy + 60); ctx.fill();
  ctx.fillStyle = C.green2; ctx.beginPath(); ctx.moveTo(cx + 55, cy + 40); ctx.lineTo(cx + 85, cy + 150); ctx.lineTo(cx + 50, cy + 128); ctx.lineTo(cx + 25, cy + 160); ctx.lineTo(cx + 5, cy + 60); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 82, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = C.gold; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,64,10,.5)'; ctx.stroke();
  ctx.fillStyle = '#5a400a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  ctx.font = `800 76px ${FONT}`; ctx.fillText(ar(rank), cx, cy + 4);
  ctx.direction = 'rtl';
}

/** يرسم الشهادة ويعيد canvas */
export async function renderCertificate(c) {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 30px ${FONT}`), document.fonts.load(`400 40px ${QFONT}`)]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // الورق
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 900);
  bg.addColorStop(0, 'rgba(243,231,198,0)'); bg.addColorStop(1, 'rgba(243,231,198,.55)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // الإطار المزدوج
  ctx.strokeStyle = C.green; ctx.lineWidth = 18; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = C.gold2; ctx.lineWidth = 4; ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5; ctx.strokeRect(84, 84, W - 168, H - 168);
  // زخارف الأركان
  [[84, 84], [W - 84, 84], [84, H - 84], [W - 84, H - 84]].forEach(([x, y]) => { star(ctx, x, y, 34, C.green); star(ctx, x, y, 22, C.gold2); star(ctx, x, y, 10, C.paper); });
  // شريط زخرفي علوي
  for (let i = 0; i < 9; i++) star(ctx, W / 2 + (i - 4) * 46, 150, i === 4 ? 16 : 8, i === 4 ? C.gold : C.gold2);

  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.color || C.green; ctx.font = `700 34px ${FONT}`; ctx.fillText(c.season ? `${c.season} · مقرأة الفاتح` : 'مقرأة الفاتح', W / 2, 215);
  ctx.fillStyle = C.gold; ctx.font = `800 96px ${FONT}`; ctx.fillText('شهادة تقدير', W / 2, 330);
  ctx.fillStyle = C.ink; ctx.font = `400 34px ${FONT}`;
  ctx.fillText('يسرّ مقرأة الفاتح أن تقدّم هذه الشهادة إلى الطالب', W / 2, 410);
  // الاسم
  fit(ctx, c.name, 800, 92, W - 700);
  ctx.fillStyle = C.green; ctx.fillText(c.name, W / 2, 530);
  ctx.strokeStyle = C.gold2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 380, 560); ctx.lineTo(W / 2 + 380, 560); ctx.stroke();
  // اللقب
  ctx.fillStyle = C.ink; ctx.font = `500 36px ${FONT}`;
  ctx.fillText(`${c.className ? c.className + ' · ' : ''}لحصوله على`, W / 2, 630);
  fit(ctx, c.title, 800, 76, W - 600);
  ctx.fillStyle = C.gold; ctx.fillText(c.title, W / 2, 722);
  star(ctx, W / 2 - ctx.measureText(c.title).width / 2 - 40, 700, 12, C.gold2);
  star(ctx, W / 2 + ctx.measureText(c.title).width / 2 + 40, 700, 12, C.gold2);
  ctx.fillStyle = C.ink; ctx.font = `400 34px ${FONT}`;
  ctx.fillText(`${c.line} ${c.period || 'في شهر ' + c.month}، بمجموع ${ar(c.points)} نقطة في التسميع والحفظ والتجويد.`, W / 2, 790);
  // الحديث
  ctx.fillStyle = C.green; ctx.font = `400 44px ${QFONT}`;
  ctx.fillText('﴿ وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا ﴾', W / 2, 880);
  ctx.fillStyle = C.muted; ctx.font = `400 26px ${FONT}`;
  ctx.fillText('بارك الله فيه، وجعله من أهل القرآن الذين هم أهل الله وخاصته', W / 2, 935);
  // الميدالية
  medal(ctx, 290, 980, c.rank || 1);
  // التوقيع والتاريخ
  ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = `500 28px ${FONT}`;
  const sx = W - 360;
  ctx.fillText('معلم القرآن الكريم', sx, 1010);
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 170, 1080); ctx.lineTo(sx + 170, 1080); ctx.stroke();
  fit(ctx, c.teacher || '', 700, 34, 340);
  ctx.fillStyle = C.green; ctx.fillText(c.teacher || '', sx, 1068);
  ctx.fillStyle = C.muted; ctx.font = `400 24px ${FONT}`; ctx.fillText(c.date || '', sx, 1120);
  return cv;
}

const safe = (s) => String(s || '').replace(/[^\w؀-ۿ-]+/g, '-').slice(0, 40);

export async function downloadCertificatePNG(cert) {
  const cv = await renderCertificate(cert);
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = `certificate-${cert.ym || ''}.png`;
  document.body.appendChild(a); a.click(); a.remove();
}

/** شهادة أو عدة شهادات في ملف PDF واحد */
export async function downloadCertificatesPDF(certs, filename, onProgress = () => {}) {
  await loadScript(LIBS.pdf);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < certs.length; i++) {
    const cv = await renderCertificate(certs[i]);
    if (i) pdf.addPage();
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
    onProgress(i + 1, certs.length);
  }
  pdf.save(filename || `certificates-${safe(certs[0]?.ym)}.pdf`);
}
