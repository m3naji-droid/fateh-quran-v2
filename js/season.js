// المواسم والمسابقات: فترة محددة تُحتسب فيها كل النقاط (واجبات، تحديات، ختمات)، مع مضاعف اختياري.
// للمرحلة كلها مع ترتيب لكل صف. الجوائز: شهادة موسم للخمسة الأوائل، وشارة دائمة، وإعلان النتائج بإشعار.
import { subScore } from './leaderboard.js';
import { toArabicDigits as ar } from './quran.js';

export const TEMPLATES = {
  ramadan: { name: 'مسابقة رمضان', icon: '🌙', color: '#5b3fa0' },
  dhul: { name: 'مسابقة العشر الأوائل', icon: '🕋', color: '#8a5a12' },
  summer: { name: 'تحدي الإجازة', icon: '☀️', color: '#d9661f' },
  school: { name: 'مسابقة العودة للمدارس', icon: '🎒', color: '#2a62c9' },
  custom: { name: '', icon: '🏆', color: '#0d5c46' },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
export const seasonStatus = (s, t = todayStr()) => (s.announcedAt ? 'announced' : t < s.from ? 'soon' : t > s.to ? 'ended' : 'live');
export const activeSeason = (list) => list.filter((s) => seasonStatus(s) === 'live').sort((a, b) => a.from.localeCompare(b.from))[0] || null;
const dayOf = (iso) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : '');
export const inSeason = (s, iso) => { const d = dayOf(iso); return d && d >= s.from && d <= s.to; };
/** حدود الموسم كتواريخ ISO لاحتساب النقاط */
export const seasonRange = (s) => [new Date(s.from + 'T00:00:00+03:00').toISOString(), new Date(s.to + 'T23:59:59+03:00').toISOString()];

/** النقاط الإضافية من المضاعف (×٢ مثلاً) لكل ما سُجّل خلال المواسم */
export function seasonExtra(entries, seasons) {
  const out = [];
  seasons.filter((s) => (s.mult || 1) > 1).forEach((s) => {
    const k = s.mult - 1, best = new Map();
    entries.forEach((x) => {
      if (!inSeason(s, x.createdAt)) return;
      if (x.bonus) { out.push({ pn: x.pn, bonus: x.bonus * k, createdAt: x.createdAt }); return; }
      if (!x.taskId) return;
      const sc = subScore(x); if (sc == null) return;
      const key = x.pn + '|' + x.taskId, cur = best.get(key);
      if (!cur || cur.sc < sc) best.set(key, { pn: x.pn, sc, at: x.createdAt });
    });
    best.forEach((v) => out.push({ pn: v.pn, bonus: Math.round(v.sc * k * 10) / 10, createdAt: v.at }));
  });
  return out;
}

export function daysLeftText(s) {
  const t = todayStr();
  if (t < s.from) { const d = Math.round((new Date(s.from) - new Date(t)) / 864e5); return d === 1 ? 'يبدأ غداً' : `يبدأ بعد ${ar(d)} ${d <= 10 ? 'أيام' : 'يوماً'}`; }
  const d = Math.round((new Date(s.to) - new Date(t)) / 864e5);
  return d <= 0 ? 'اليوم آخر يوم!' : d === 1 ? 'يتبقى يوم واحد' : d === 2 ? 'يتبقى يومان' : `يتبقى ${ar(d)} ${d <= 10 ? 'أيام' : 'يوماً'}`;
}
export const fmtDay = (d) => { try { return ar(new Date(d + 'T12:00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long' })); } catch { return d; } };

/** شريط الموسم للطالب. r: مرتبته في الموسم {points, stage, stageOf, cls, clsOf} */
export function seasonBarHtml(s, r) {
  const live = seasonStatus(s) === 'live';
  return `<div class="season-bar" style="--sc:${esc(s.color || '#0d5c46')}">
    <div class="sb-ico">${esc(s.icon || '🏆')}</div>
    <div class="sb-tx"><b>${esc(s.name)}</b><span>${live ? `${daysLeftText(s)} · حتى ${fmtDay(s.to)}` : `يبدأ ${fmtDay(s.from)}`}${(s.mult || 1) > 1 ? ` · <em>النقاط مضاعفة ×${ar(s.mult)}</em>` : ''}</span>
      ${live && r ? `<small>${r.points ? `نقاطك ${ar(Math.round(r.points * 10) / 10)}${r.cls ? ` · ترتيبك ${ar(r.cls)} في صفك` : ''}${r.stage ? ` و${ar(r.stage)} على المرحلة` : ''}` : 'سلّم واجباً أو اربح تحدياً لتدخل الترتيب!'}</small>` : ''}</div>
    <button class="btn sm" type="button" data-season="${esc(s.id)}">لوحة الموسم</button></div>`;
}
export function seasonBoardHtml(s, myClass, me) {
  const L = s.live || {};
  const row = (x, i) => `<li class="${x.id === me ? 'me' : ''}"><span class="mr-n">${ar(i + 1)}</span><span>${esc(x.name)}${x.className ? ` <small class="muted">${esc(x.className)}</small>` : ''}</span><b class="num">${ar(Math.round(x.points * 10) / 10)}</b></li>`;
  return `<h2>${esc(s.icon)} ${esc(s.name)}</h2>
    <p class="small muted" style="margin:0">${fmtDay(s.from)} – ${fmtDay(s.to)}${(s.mult || 1) > 1 ? ` · النقاط مضاعفة ×${ar(s.mult)}` : ''} · يُحدَّث الترتيب عند مراجعة المعلم للتسليمات.</p>
    <div class="mr-grid"><div class="card"><h3>على المرحلة</h3><ol class="mr-list">${(L.stage || []).map(row).join('') || '<li class="muted">لا نقاط بعد</li>'}</ol></div>
    ${myClass ? `<div class="card"><h3>في صفك</h3><ol class="mr-list">${(L.byClass?.[myClass] || []).map(row).join('') || '<li class="muted">لا نقاط بعد</li>'}</ol></div>` : ''}</div>`;
}
