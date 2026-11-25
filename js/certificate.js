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
/** خيارات الشهادة (يتحكم بها المعلم من الإعدادات) */
export const CERT_OPT_DEFAULT = { merge: true, ch: true, hm: true, ayat: true, special: true, qr: true, streak: true, hijri: true, gold: true };
export const CERT_OPT_LABELS = [
  ['merge', 'دمج إنجازات المرحلة والصف في شهادة واحدة', 'مثل: «شيخ المرحلة وقارئ الصف»'],
  ['ch', 'مركزه في التحديات (إن كان من العشرة الأوائل على المرحلة)', ''],
  ['hm', 'مركزه في الهمة العالية (إن كان من العشرة الأوائل على المرحلة)', ''],
  ['ayat', 'عدد الآيات التي سمّعها وتدرّب عليها', ''],
  ['special', 'شهادة خاصة لأوائل التحديات والهمة من غير الفائزين', '«فارس التحديات» و«صاحب الهمة العالية» بالأخضر'],
  ['streak', 'أطول سلسلة أيام ومتوسط الدقة', ''],
  ['gold', 'ألقابه الذهبية', 'مثل: 🥇 حامل الراية'],
  ['qr', 'رقم تحقق ورمز QR', 'يُمسح فيفتح صفحة تؤكد أن الشهادة صادرة من المقرأة'],
  ['hijri', 'التاريخ الهجري بجانب الميلادي', ''],
];
export function setCertSigners(c) { SIGN = { principal: { ...CERT_SIGN_DEFAULT.principal, ...(c?.principal || {}) }, head: { ...CERT_SIGN_DEFAULT.head, ...(c?.head || {}) }, opt: { ...CERT_OPT_DEFAULT, ...(c?.opt || {}) } }; }
export const certOpt = () => SIGN?.opt || CERT_OPT_DEFAULT;
export async function loadCertCfg() { return signers(); }
/** رقم التحقق: مختصر ثابت من الشهر ورقم الطالب واللقب */
export function certCode(c) {
  let h = 2166136261; const str = `${c.ym}|${c.pn}|${c.title}`;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${String(c.ym || '').replace('-', '').slice(2)}-${c.pn}-${(h >>> 0).toString(36).toUpperCase().slice(0, 5)}`;
}
export const certUrl = (c) => `${location.origin}${location.pathname}#/verify/${encodeURIComponent(c.ym)}/${encodeURIComponent(c.pn)}/${certCode(c)}`;
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
  ctx.fillText(role || '', x, 1012);
  fit(ctx, name || '', 700, 34, 380);
  ctx.fillStyle = T.name; ctx.fillText(name || '', x, 1064);
  ctx.strokeStyle = T.frame2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 170, 1084); ctx.lineTo(x + 170, 1084); ctx.stroke();
}

/** يرسم الشهادة ويعيد canvas */
export async function renderCertificate(c) {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 30px ${FONT}`), document.fonts.load(`400 40px ${QFONT}`), document.fonts.load(`700 60px ${RFONT}`)]); } catch {}
  const SG = await signers();
  const rank = c.rank || 1, T = TIERS[c.tier || tierOf(rank)];
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
  // اللقب (أو الإنجازان مدموجين)
  const O = SG.opt, wins = O.merge && Array.isArray(c.wins) && c.wins.length > 1 ? c.wins : null;
  const title = wins ? wins.map((w) => w.title).join(' و') : c.title;
  const line = wins ? wins.map((w) => w.line).join('، و') : c.line;
  ctx.fillStyle = T.ink; ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`${c.className ? c.className + '، ' : ''}لحصوله على`, W / 2, 640);
  fit(ctx, title, 800, 66, W - 640);
  ctx.fillStyle = T.head; ctx.fillText(title, W / 2, 716);
  const tw = ctx.measureText(title).width;
  star(ctx, W / 2 - tw / 2 - 40, 695, 12, T.frame2); star(ctx, W / 2 + tw / 2 + 40, 695, 12, T.frame2);
  const main = c.special ? `${line} ${c.period || 'في شهر ' + c.month}.` : `${line} ${c.period || 'في شهر ' + c.month}، بمجموع ${ar(c.points)} نقطة في التسميع والحفظ والتجويد.`;
  ctx.fillStyle = T.ink; fit(ctx, main, 400, 31, W - 320); ctx.fillText(main, W / 2, 772);
  // إنجازات إضافية (كلٌّ حسب إعداد المعلم)
  const X = c.extras || {}, ex = [];
  const ord = (n) => (['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'][n] || ar(n));
  const rk = [];
  if (O.ch && X.chR && X.chR <= 10 && !(c.special === 'ch' || c.special === 'both')) rk.push(`⚔️ ${ord(X.chR)} على المرحلة في التحديات`);
  if (O.hm && X.hmR && X.hmR <= 10 && !(c.special === 'hm' || c.special === 'both')) rk.push(`⚡ ${ord(X.hmR)} على المرحلة في الهمة العالية`);
  if (rk.length) ex.push(rk.join('   ،   '));
  if (O.ayat) {
    const rec = (X.ayT || 0) + (X.ayC || 0), pr = X.ayP || 0;
    const recTxt = rec ? `سمّع ${ar(rec)} آية${X.ayC && X.ayT ? ` (منها ${ar(X.ayC)} في التحديات)` : X.ayC && !X.ayT ? ' في التحديات' : ''}` : '';
    const prTxt = pr ? `تدرّب على ${ar(pr)} آية` : '';
    const t = recTxt && prTxt ? `📖 ${recTxt}، و${prTxt}` : recTxt ? `📖 ${recTxt}` : prTxt ? `📖 ${prTxt}` : '';
    if (t) ex.push(t);
  }
  if (O.streak && (X.streak > 1 || X.acc)) ex.push([X.streak > 1 ? `🔥 واظب ${ar(X.streak)} يوماً متتالية` : '', X.acc ? `🎯 متوسط دقته ${ar(X.acc)}٪` : ''].filter(Boolean).join('   ،   '));
  if (O.gold && X.gold?.length) ex.push('🥇 ' + X.gold.slice(0, 4).join('، '));
  let y = 818;
  let nRows = 0;
  if (c.places?.length) {
    // شارات «المراكز التي حصل عليها»
    ex.splice(0, rk.length ? 1 : 0);
    ctx.font = `700 23px ${FONT}`;
    const pads = 22, gap = 14, h = 44;
    const ws = c.places.map((p) => ctx.measureText(p).width + pads * 2);
    const rows = [[]]; let rw = 0; const maxW = W - 360;
    ws.forEach((w, i) => { if (rw + w > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push(i); rw += w + gap; });
    ctx.fillStyle = T.muted; ctx.font = `600 24px ${FONT}`; ctx.fillText('— المراكز التي حصل عليها —', W / 2, y - 6); y += 6;
    rows.forEach((r) => {
      const tot = r.reduce((s, i) => s + ws[i], 0) + gap * (r.length - 1);
      let x = W / 2 + tot / 2;
      r.forEach((i) => {
        const w = ws[i], x0 = x - w;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y, w, h, 24); else ctx.rect(x0, y, w, h); ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = i === 0 ? T.frame : T.frame2; ctx.stroke();
        ctx.fillStyle = i === 0 ? T.head : T.ink; ctx.font = `700 23px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(c.places[i], x0 + w / 2, y + 30);
        x = x0 - gap;
      });
      y += h + 10;
    });
    y += 28; nRows = rows.length;
  }
  ex.slice(0, c.places?.length ? (nRows > 1 ? 0 : 1) : 4).forEach((t) => { ctx.fillStyle = T.accent; fit(ctx, t, 500, 27, W - 420); ctx.fillText(t, W / 2, y); y += 40; });
  ctx.fillStyle = C.green; ctx.font = `400 ${ex.length > 2 || c.places?.length ? 34 : 40}px ${QFONT}`;
  ctx.fillText('﴿ وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا ﴾', W / 2, c.places?.length ? y + 14 : Math.max(y + 22, 870));
  if (ex.length <= 1 && !c.places?.length) { ctx.fillStyle = T.muted; ctx.font = `400 25px ${FONT}`; ctx.fillText('بارك الله فيه، وجعله من أهل القرآن الذين هم أهل الله وخاصته', W / 2, 922); }
  // المركز أعلى اليسار
  medal(ctx, 250, 235, rank, T);
  // التوقيعات: معلم المادة يميناً، المعلم الأول وسطاً، مدير المدرسة يساراً
  sign(ctx, W - 330, 'معلم المادة', c.teacher || '', T);
  sign(ctx, W / 2, SG.head.role, SG.head.name, T);
  sign(ctx, 330, SG.principal.role, SG.principal.name, T);
  // التاريخ أسفل اليمين
  if (c.date) {
    let hij = '';
    if (O.hijri) { try { hij = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(c.at ? new Date(c.at) : new Date()); } catch {} }
    ctx.fillStyle = T.muted; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(`حُرّرت في ${c.date}`, W - 330, 1118); if (hij) ctx.fillText(`الموافق ${ar(hij)}`, W - 330, 1146);
  }
  // رقم التحقق ورمز QR أعلى اليمين
  if (O.qr && c.pn && c.ym) {
    try {
      await loadScript(LIBS.qr);
      const qr = window.qrcode(0, 'M'); qr.addData(certUrl(c)); qr.make();
      const n = qr.getModuleCount(), size = 150, cell = size / n, x0 = W - 250 - size / 2, y0 = 150;
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 - 10, y0 - 10, size + 20, size + 20);
      ctx.strokeStyle = T.frame2; ctx.lineWidth = 2; ctx.strokeRect(x0 - 10, y0 - 10, size + 20, size + 20);
      ctx.fillStyle = '#111';
      for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) ctx.fillRect(Math.floor(x0 + q * cell), Math.floor(y0 + r * cell), Math.ceil(cell), Math.ceil(cell));
      ctx.fillStyle = T.muted; ctx.font = `500 19px ${FONT}`; ctx.textAlign = 'center'; ctx.direction = 'ltr';
      ctx.fillText(certCode(c), W - 250, y0 + size + 36); ctx.direction = 'rtl';
      ctx.font = `400 17px ${FONT}`; ctx.fillText('امسح للتحقق من الشهادة', W - 250, y0 + size + 60);
    } catch (e) { console.warn('qr', e); }
  }
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
