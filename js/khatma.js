// ختمة الصف الجماعية: المعلم يحدد مقطعاً (سورة، جزء، أو من–إلى) لصف أو للجميع.
// كل آية يسمّعها أي طالب بدقة ٨٥٪ فأكثر تُملأ في شريط الصف (مرة واحدة باسم أول من أتقنها).
// عند الاكتمال: احتفال وإشعار للصف، و+٥ نقاط في لوحة الشرف لكل من أسهم، وشهادة جماعية.
import { ayahCount, surahName, toArabicDigits as ar } from './quran.js';
import { ayahScores, MASTER } from './mushaf.js';

export const KH_PTS = 5;
export const PRESETS = {
  amma: { label: 'جزء عمّ', segs: [[78, 1, 40], ...Array.from({ length: 36 }, (_, i) => [79 + i, 1, null])] },
  tabarak: { label: 'جزء تبارك', segs: Array.from({ length: 11 }, (_, i) => [67 + i, 1, null]) },
  qadsami: { label: 'جزء قد سمع', segs: Array.from({ length: 9 }, (_, i) => [58 + i, 1, null]) },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** يحوّل المقاطع [سورة، من، إلى|null] إلى مقاطع كاملة الأرقام */
export const normSegs = (segs) => segs.map(([s, f, t]) => ({ s, f, t: t || ayahCount(s) }));
export const khTotal = (k) => normSegs(k.segs).reduce((n, x) => n + (x.t - x.f + 1), 0);
export const khKey = (s, a) => `${s}_${a}`;
export const inKh = (k, s, a) => normSegs(k.segs).some((x) => x.s === s && a >= x.f && a <= x.t);
export const khDone = (k) => Object.keys(k.done || {}).length;
export const khActive = (k, now = new Date().toISOString()) => !k.completedAt && (!k.endAt || k.endAt >= now.slice(0, 10)) && (k.startAt || '') <= now;
export const khForClass = (list, classId) => list.filter((k) => k.classId === 'all' || k.classId === classId);

/** مفاتيح الآيات الجديدة التي أتقنها الطالب في هذه المحاولة ضمن الختمة */
export function newKeys(k, sub) {
  if (!inKh(k, sub.surah, sub.from) && !inKh(k, sub.surah, sub.to)) return [];
  return ayahScores(sub).filter(({ a, p }) => p >= MASTER && inKh(k, sub.surah, a) && !k.done?.[khKey(sub.surah, a)]).map(({ a }) => khKey(sub.surah, a));
}
/** أول مقطع لم يُتقن بعد (حتى ١٠ آيات) لزر «ساهم الآن» */
export function nextGap(k) {
  for (const x of normSegs(k.segs)) {
    for (let a = x.f; a <= x.t; a++) {
      if (!k.done?.[khKey(x.s, a)]) { let to = a; while (to < x.t && to - a < 9 && !k.done?.[khKey(x.s, to + 1)]) to++; return { surah: x.s, from: a, to }; }
    }
  }
  return null;
}
export function contributors(k) {
  const m = new Map();
  Object.values(k.done || {}).forEach((v) => { const pn = typeof v === 'string' ? v : v?.pn; const name = typeof v === 'object' ? v.name : ''; const e = m.get(pn) || { pn, name, n: 0 }; e.n++; if (name) e.name = name; m.set(pn, e); });
  return [...m.values()].sort((a, b) => b.n - a.n);
}
/** نقاط لوحة الشرف للختمات المكتملة */
export const khBonus = (list) => list.filter((k) => k.completedAt).flatMap((k) => contributors(k).map((c) => ({ pn: c.pn, bonus: KH_PTS, createdAt: k.completedAt })));
export const khLabel = (k) => k.title || (k.preset ? PRESETS[k.preset]?.label : normSegs(k.segs).map((x) => `${surahName(x.s)}${x.f === 1 && x.t === ayahCount(x.s) ? '' : ` ${ar(x.f)}–${ar(x.t)}`}`).join('، '));

export function daysLeft(k) {
  if (!k.endAt) return '';
  const d = Math.ceil((new Date(k.endAt + 'T23:59:59+03:00') - Date.now()) / 864e5);
  return d <= 0 ? 'اليوم آخر يوم' : d === 1 ? 'يتبقى يوم واحد' : d === 2 ? 'يتبقى يومان' : `يتبقى ${ar(d)} ${d <= 10 ? 'أيام' : 'يوماً'}`;
}

/** تفاصيل الختمة: شريط لكل سورة، والمساهمون */
export function detailHtml(k, me = null) {
  const segs = normSegs(k.segs), total = khTotal(k), done = khDone(k);
  const rows = segs.map((x) => { let n = 0; for (let a = x.f; a <= x.t; a++) if (k.done?.[khKey(x.s, a)]) n++; const all = x.t - x.f + 1; return `<div class="kh-row${n === all ? ' full' : ''}"><span>${esc(surahName(x.s))}</span><i><b style="width:${(n / all) * 100}%"></b></i><small>${ar(n)}/${ar(all)}</small></div>`; }).join('');
  const cs = contributors(k);
  return `<h2>📿 ${esc(khLabel(k))}</h2>
    <p style="margin:0">أُتقنت <b>${ar(done)}</b> من ${ar(total)} آية (${ar(Math.round((done / total) * 100))}٪)${k.endAt && !k.completedAt ? ` · ${daysLeft(k)}` : ''}</p>
    <div class="kh-rows">${rows}</div>
    ${cs.length ? `<div><b class="small">المساهمون (${ar(cs.length)})</b><div class="row" style="gap:6px;margin-top:6px">${cs.map((c) => `<span class="pill${c.pn === me ? ' ok' : ' mute'}">${esc(c.name || '—')}: ${ar(c.n)} ${c.n === 1 ? 'آية' : c.n === 2 ? 'آيتان' : 'آيات'}</span>`).join('')}</div></div>` : '<p class="small muted" style="margin:0">لم يُسهم أحد بعد. كن الأول!</p>'}`;
}

/* ---------- الشهادة الجماعية ---------- */
export async function groupCertificate(k, { className = '', teacher = '' } = {}) {
  const W = 1754, H = 1240; // A4 بالعرض
  try { await Promise.all([document.fonts.load('700 80px "Aref Ruqaa"'), document.fonts.load('500 30px "IBM Plex Sans Arabic"'), document.fonts.load('700 30px "IBM Plex Sans Arabic"')]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#fffdf7'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#a77a1c'; c.lineWidth = 6; c.strokeRect(40, 40, W - 80, H - 80);
  c.strokeStyle = '#d9cfae'; c.lineWidth = 2; c.strokeRect(62, 62, W - 124, H - 124);
  const logo = (cx, cy, r) => { c.save(); c.translate(cx, cy); c.fillStyle = '#d9b45a'; for (const a of [0, Math.PI / 4]) { c.save(); c.rotate(a); c.fillRect(-r, -r, 2 * r, 2 * r); c.restore(); } c.fillStyle = '#0d5c46'; c.beginPath(); c.arc(0, 0, r * 0.55, 0, 7); c.fill(); c.fillStyle = '#f3e7c6'; c.beginPath(); c.arc(0, 0, r * 0.33, 0, 7); c.fill(); c.restore(); };
  logo(W / 2, 140, 40);
  c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#0d5c46'; c.font = '700 96px "Aref Ruqaa", "Amiri", serif'; c.fillText('شهادة ختمة جماعية', W / 2, 270);
  c.fillStyle = '#15231e'; c.font = '500 36px "IBM Plex Sans Arabic", sans-serif';
  c.fillText(`تشهد مقرأة الفاتح بأن ${className ? `طلاب ${className}` : 'الطلاب'} أتمّوا بفضل الله حفظ وتسميع`, W / 2, 370);
  c.fillStyle = '#a77a1c'; c.font = '700 56px "Aref Ruqaa", "Amiri", serif'; c.fillText(khLabel(k), W / 2, 450);
  c.fillStyle = '#5b6b64'; c.font = '500 28px "IBM Plex Sans Arabic", sans-serif';
  c.fillText(`${ar(khTotal(k))} آية · اكتملت في ${ar(new Date(k.completedAt || Date.now()).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }))}`, W / 2, 515);
  // الأسماء في أعمدة
  const names = contributors(k).map((x) => x.name).filter(Boolean);
  const cols = names.length > 24 ? 4 : names.length > 12 ? 3 : names.length > 5 ? 2 : 1;
  const per = Math.ceil(names.length / cols), colW = (W - 300) / cols, size = per > 10 ? 26 : 32;
  c.fillStyle = '#15231e'; c.font = `500 ${size}px "IBM Plex Sans Arabic", sans-serif`;
  names.forEach((n, i) => { const col = Math.floor(i / per), row = i % per; c.fillText(`✦ ${n}`, W - 150 - colW * col - colW / 2, 600 + row * (size * 1.6)); });
  c.fillStyle = '#0d5c46'; c.font = '700 30px "IBM Plex Sans Arabic", sans-serif';
  c.fillText('«خيرُكم من تعلّم القرآن وعلّمه»', W / 2, H - 190);
  c.fillStyle = '#5b6b64'; c.font = '500 26px "IBM Plex Sans Arabic", sans-serif';
  if (teacher) c.fillText(`المعلم: ${teacher}`, W / 2, H - 130);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `شهادة-ختمة-${(className || 'الصف').replace(/\s+/g, '-')}.png` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
