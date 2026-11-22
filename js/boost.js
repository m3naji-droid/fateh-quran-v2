// 🔥 النقاط المضاعفة: فترة يحددها المعلم (من يوم إلى يوم) تُضاعف فيها نقاط التدريب الحر و/أو تحديات الزملاء،
// ويظهر فيها إعلان في الصفحة الرئيسية وصفحة الطالب، ويختفي تلقائياً بعد آخر يوم.
// تُحفظ في leaderboard/limits.boosts: [{ id, from, to, x, hm, ch, t, d }] والأيام بتوقيت الرياض/البحرين.
import { toArabicDigits as ar } from './quran.js';

let BOOSTS = [];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const todayR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
export const dayOfIso = (iso) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : '');
export function setBoosts(list) { BOOSTS = (Array.isArray(list) ? list : []).filter((b) => b && DAY.test(b.from) && DAY.test(b.to) && +b.x > 1 && b.from <= b.to); }
export const getBoosts = () => BOOSTS;
/** المضاعف في يوم معيّن لنوع معيّن: 'hm' التدريب الحر، 'ch' التحديات (أكبر مضاعف إن تداخلت فترتان) */
export function boostX(day, kind) { let x = 1; for (const b of BOOSTS) if (b[kind] !== false && b.from <= day && day <= b.to) x = Math.max(x, +b.x); return x; }
export const activeBoost = (day = todayR()) => BOOSTS.filter((b) => b.from <= day && day <= b.to).sort((a, b) => b.x - a.x)[0] || null;
export const boostStatus = (b, day = todayR()) => (day < b.from ? 'soon' : day > b.to ? 'ended' : 'live');

const wd = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('ar', { weekday: 'long' }); } catch { return ''; } };
const dm = (d) => { try { return ar(new Date(d + 'T12:00:00').toLocaleDateString('ar', { day: 'numeric', month: 'long' })); } catch { return d; } };
export const fmtBoostDay = (d) => `${wd(d)} ${dm(d)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const boostWhat = (b) => (b.hm !== false && b.ch !== false ? 'في التدريب الحر وتحديات الزملاء' : b.ch !== false ? 'في تحديات الزملاء' : 'في التدريب الحر');
function leftTxt(b, day) {
  const n = Math.round((new Date(b.to + 'T12:00:00') - new Date(day + 'T12:00:00')) / 864e5);
  return n <= 0 ? '⏳ اليوم آخر يوم!' : n === 1 ? '⏳ يتبقى يوم واحد' : n === 2 ? '⏳ يتبقى يومان' : `⏳ يتبقى ${ar(n)} ${n <= 10 ? 'أيام' : 'يوماً'}`;
}
/** إعلان الفترة الجارية (أو b لمعاينة المعلم) */
export function boostBannerHtml(b = activeBoost(), { preview = false } = {}) {
  if (!b) return '';
  const day = todayR(), live = boostStatus(b, day) === 'live';
  return `<div class="bst${preview ? ' prev' : ''}" role="note">
    <div class="bst-x" aria-hidden="true"><small>×</small>${ar(b.x)}</div>
    <div class="bst-t"><b>${esc(b.t || `🔥 نقاط مضاعفة ×${ar(b.x)}`)}</b>
      <span>${esc(b.d || `${boostWhat(b)} — فرصتك لتغيير مركزك في لوحة الشرف!`)}</span>
      <small>📅 من ${fmtBoostDay(b.from)} حتى ${fmtBoostDay(b.to)}${live ? `<em>${leftTxt(b, day)}</em>` : ''}</small></div>
    <i class="bst-s s1" aria-hidden="true">✦</i><i class="bst-s s2" aria-hidden="true">✦</i><i class="bst-s s3" aria-hidden="true">✦</i>
  </div>`;
}
