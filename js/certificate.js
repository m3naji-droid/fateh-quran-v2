// شهادة تقدير للفائزين في نتائج الشهر: A4 أفقية، مرسومة على canvas لتتصل الحروف العربية في PDF
import { loadScript, LIBS } from './cards.js';

const W = 1754, H = 1240; // A4 أفقية بدقة ١٥٠ نقطة في البوصة
const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
const QFONT = "'Amiri Quran', 'Amiri', serif";
const RFONT = "'Aref Ruqaa', 'Amiri', serif";
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

// ألوان الشهادة حسب المركز: الأول ذهبي، الثاني فضي، الثالث برونزي، وما بعده أخضر فاتح
const TIERS = {
  gold: { bg: ['#fffaf0', '#fbefc8', '#f1d58a'], frame: '#9a6b0f', frame2: '#d9b45a', accent: '#a77a1c', head: '#8a5d06', name: '#0d5c46', ink: '#2b2110', muted: '#6b5a33', pat: '#c9971f', medal: ['#ffe9a8', '#c9971f'] },
  silver: { bg: ['#fbfcfd', '#eef1f4', '#cfd6dd'], frame: '#6b7785', frame2: '#aab4bf', accent: '#5f6b78', head: '#4b5663', name: '#0d5c46', ink: '#1f262d', muted: '#5f6b78', pat: '#8a96a3', medal: ['#f4f6f8', '#9aa4ad'] },
  bronze: { bg: ['#fffaf5', '#f8e6d3', '#e7bf98'], frame: '#8a4a1f', frame2: '#c98a55', accent: '#9a5526', head: '#7a3f17', name: '#0d5c46', ink: '#2b1a0e', muted: '#7a5a43', pat: '#b06a33', medal: ['#f3c79b', '#b06a33'] },
  green: { bg: ['#f7fcf9', '#e6f4ec', '#c4e4d2'], frame: '#0d5c46', frame2: '#d9b45a', accent: '#0f6b51', head: '#0d5c46', name: '#0a4a39', ink: '#15231e', muted: '#4b6b5f', pat: '#1f8a5f', medal: ['#e3efe9', '#4cc09a'] },
};
const tierOf = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'green');

/* الموقّعون: يضبطهم المعلم من الإعدادات (leaderboard/certCfg) */
export const CERT_SIGN_DEFAULT = { principal: { name: 'أ. محمد مصباح يوسف', role: 'مدير المدرسة' }, head: { name: 'د. أحمد عسكر', role: 'المعلم الأول' } };
let SIGN = null;
export function setCertSigners(c) { SIGN = { principal: { ...CERT_SIGN_DEFAULT.principal, ...(c?.principal || {}) }, head: { ...CERT_SIGN_DEFAULT.head, ...(c?.head || {}) } }; }
async function signers() {
  if (SIGN) return SIGN;
  try { const { store } = await import('./store.js'); setCertSigners(await store.getCertCfg()); } catch { setCertSigners(null); }
  return SIGN;
}

/** شعار المقرأة: نجمة ثمانية ذهبية وفي وسطها دائرة خضراء */
function logo(ctx, cx, cy, r) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#f0d27a'); g.addColorStop(1, '#b8871a');
  ctx.fillStyle = g;
  [0, Math.PI / 4].forEach((rot) => { ctx.save(); ctx.rotate(rot); const a = r * 0.72; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-a, -a, a * 2, a * 2, r * 0.1); else ctx.rect(-a, -a, a * 2, a * 2); ctx.fill(); ctx.restore(); });
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = '#0d5c46'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fillStyle = '#f3e7c6'; ctx.fill();
  ctx.restore();
}

/** زخرفة الشاشة الرئيسية: نجوم ثمانية مفرّغة كبيرة ودوائر، بشفافية خفيفة */
function pattern(ctx, color, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  const S = 260;
  ctx.translate(W / 2, H / 2); ctx.rotate(Math.PI / 16);
  for (let x = -W; x <= W; x += S) for (let y = -H; y <= H; y += S) {
    [0, Math.PI / 4].forEach((rot) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeRect(-S / 4, -S / 4, S / 2, S / 2); ctx.restore(); });
    ctx.beginPath(); ctx.arc(x, y, S / 10, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function medal(ctx, cx, cy, rank, T) {
  const g = ctx.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, 90);
  g.addColorStop(0, T.medal[0]); g.addColorStop(1, T.medal[1]);
  ctx.fillStyle = C.green; ctx.beginPath(); ctx.moveTo(cx - 55, cy + 40); ctx.lineTo(cx - 85, cy + 150); ctx.lineTo(cx - 50, cy + 128); ctx.lineTo(cx - 25, cy + 160); ctx.lineTo(cx - 5, cy + 60); ctx.fill();
  ctx.fillStyle = C.green2; ctx.beginPath(); ctx.moveTo(cx + 55, cy + 40); ctx.lineTo(cx + 85, cy + 150); ctx.lineTo(cx + 50, cy + 128); ctx.lineTo(cx + 25, cy + 160); ctx.lineTo(cx + 5, cy + 60); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 82, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = T.frame; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,30,10,.35)'; ctx.stroke();
  ctx.fillStyle = rank <= 3 ? '#3d2c08' : '#0a4a39'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
  ctx.font = `800 76px ${FONT}`; ctx.fillText(ar(rank), cx, cy + 4);
  ctx.direction = 'rtl'; ctx.textBaseline = 'alphabetic';
}

function sign(ctx, x, role, name, T) {
  ctx.textAlign = 'center'; ctx.fillStyle = T.muted; ctx.font = `500 27px ${FONT}`;
  ctx.fillText(role || '', x, 1000);
  fit(ctx, name || '', 700, 34, 380);
  ctx.fillStyle = T.name; ctx.fillText(name || '', x, 1058);
  ctx.strokeStyle = T.frame2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 170, 1080); ctx.lineTo(x + 170, 1080); ctx.stroke();
}

/** يرسم الشهادة ويعيد canvas */
export async function renderCertificate(c) {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 30px ${FONT}`), document.fonts.load(`400 40px ${QFONT}`), document.fonts.load(`700 60px ${RFONT}`)]); } catch {}
  const SG = await signers();
  const rank = c.rank || 1, T = TIERS[tierOf(rank)];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // الورق بلون المركز، مع زخرفة الشاشة الرئيسية وتوهّج في الوسط
  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 120, W / 2, H / 2, 1050);
  bg.addColorStop(0, T.bg[0]); bg.addColorStop(0.55, T.bg[1]); bg.addColorStop(1, T.bg[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  pattern(ctx, T.pat, 0.09);
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 620); glow.addColorStop(0, 'rgba(255,255,255,.75)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // الإطار المزدوج
  ctx.strokeStyle = T.frame; ctx.lineWidth = 18; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = T.frame2; ctx.lineWidth = 4; ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5; ctx.strokeRect(84, 84, W - 168, H - 168);
  [[84, 84], [W - 84, 84], [84, H - 84], [W - 84, H - 84]].forEach(([x, y]) => { star(ctx, x, y, 34, T.frame); star(ctx, x, y, 22, T.frame2); star(ctx, x, y, 10, T.bg[0]); });

  // الشعار واسم المقرأة
  logo(ctx, W / 2, 158, 72);
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.green; ctx.font = `700 50px ${RFONT}`; ctx.fillText('مقرأة الفاتح', W / 2, 270);
  for (let i = 0; i < 9; i++) if (i !== 4) star(ctx, W / 2 + (i - 4) * 34, 298, 5, T.frame2);
  star(ctx, W / 2, 298, 9, T.accent);

  ctx.fillStyle = T.head; ctx.font = `800 84px ${FONT}`; ctx.fillText('شهادة تقدير', W / 2, 395);
  ctx.fillStyle = T.ink; ctx.font = `400 32px ${FONT}`;
  ctx.fillText('يسرّ مقرأة الفاتح أن تقدّم هذه الشهادة إلى الطالب', W / 2, 455);
  // الاسم
  fit(ctx, c.name, 800, 86, W - 760);
  ctx.fillStyle = T.name; ctx.fillText(c.name, W / 2, 558);
  ctx.strokeStyle = T.frame2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 380, 585); ctx.lineTo(W / 2 + 380, 585); ctx.stroke();
  // اللقب
  ctx.fillStyle = T.ink; ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`${c.className ? c.className + ' · ' : ''}لحصوله على`, W / 2, 645);
  fit(ctx, c.title, 800, 70, W - 640);
  ctx.fillStyle = T.head; ctx.fillText(c.title, W / 2, 728);
  const tw = ctx.measureText(c.title).width;
  star(ctx, W / 2 - tw / 2 - 40, 706, 12, T.frame2); star(ctx, W / 2 + tw / 2 + 40, 706, 12, T.frame2);
  ctx.fillStyle = T.ink; fit(ctx, `${c.line} ${c.period || 'في شهر ' + c.month}، بمجموع ${ar(c.points)} نقطة في التسميع والحفظ والتجويد.`, 400, 32, W - 320);
  ctx.fillText(`${c.line} ${c.period || 'في شهر ' + c.month}، بمجموع ${ar(c.points)} نقطة في التسميع والحفظ والتجويد.`, W / 2, 790);
  ctx.fillStyle = C.green; ctx.font = `400 42px ${QFONT}`;
  ctx.fillText('﴿ وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا ﴾', W / 2, 862);
  ctx.fillStyle = T.muted; ctx.font = `400 25px ${FONT}`;
  ctx.fillText('بارك الله فيه، وجعله من أهل القرآن الذين هم أهل الله وخاصته', W / 2, 912);
  // المركز أعلى اليسار
  medal(ctx, 250, 235, rank, T);
  // التوقيعات: معلم المادة يميناً، المعلم الأول وسطاً، مدير المدرسة يساراً
  sign(ctx, W - 330, 'معلم المادة', c.teacher || '', T);
  sign(ctx, W / 2, SG.head.role, SG.head.name, T);
  sign(ctx, 330, SG.principal.role, SG.principal.name, T);
  if (c.date) { ctx.fillStyle = T.muted; ctx.font = `400 23px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`حُرّرت في ${c.date}`, W / 2, 1128); }
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
