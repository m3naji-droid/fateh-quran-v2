// مواقيت الصلاة لمملكة البحرين (المنامة)، تُحسب في الجهاز بلا إنترنت.
// طريقة أم القرى: الفجر ١٨٫٥° تحت الأفق، والعشاء بعد المغرب بـ٩٠ دقيقة، والعصر على المذهب الشافعي (ظل المثل).
const LAT = 26.2235, LNG = 50.5876, TZ = 3; // توقيت البحرين UTC+3 بلا توقيت صيفي
const FAJR = 18.5, ISHA_MIN = 90;
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}
const julian = (y, m, d) => { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; };

/** أوقات يوم (تاريخ البحرين y,m,d) بالساعات العشرية بتوقيت البحرين */
function hours(y, m, d) {
  const jd = julian(y, m, d) - LNG / (15 * 24);
  const noonAt = (t) => { const s = sun(jd + t); return fix(12 - s.eqt, 24); };
  const angleT = (angle, t, ccw) => {
    const s = sun(jd + t), noon = noonAt(t);
    const v = deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(s.decl)) * Math.sin(rad(LAT))) / (Math.cos(rad(s.decl)) * Math.cos(rad(LAT))))) / 15;
    return noon + (ccw ? -v : v);
  };
  const asrT = (t) => { const s = sun(jd + t); const a = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(LAT - s.decl)))))); return angleT(a, t, false); };
  // تكراران لتحسين الدقة
  let T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v / 24]));
    T = { fajr: angleT(FAJR, p.fajr, true), sunrise: angleT(0.833, p.sunrise, true), dhuhr: noonAt(p.dhuhr), asr: asrT(p.asr), maghrib: angleT(0.833, p.maghrib, false) };
  }
  const adj = (h) => h + TZ - LNG / 15;
  const out = { fajr: adj(T.fajr), sunrise: adj(T.sunrise), dhuhr: adj(T.dhuhr), asr: adj(T.asr), maghrib: adj(T.maghrib) };
  out.isha = out.maghrib + ISHA_MIN / 60;
  return out;
}

export const PRAYERS = [['fajr', 'الفجر'], ['sunrise', 'الشروق'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];
/** تاريخ البحرين الآن {y,m,d} */
const bhDate = (t) => { const x = new Date(t + TZ * 3600e3); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
/** مواقيت يوم بصيغة طوابع زمنية (ms) */
export function dayTimes(t = Date.now()) {
  const { y, m, d } = bhDate(t);
  const H = hours(y, m, d), base = Date.UTC(y, m - 1, d) - TZ * 3600e3;
  return Object.fromEntries(Object.entries(H).map(([k, h]) => [k, base + Math.round(h * 60) * 60e3])); // تقريب للدقيقة
}
/** الصلاة القادمة (بلا الشروق) {key, name, at} */
export function nextPrayer(t = Date.now()) {
  const today = dayTimes(t);
  for (const [k, n] of PRAYERS) if (k !== 'sunrise' && today[k] > t) return { key: k, name: n, at: today[k], today };
  const tm = dayTimes(t + 864e5);
  return { key: 'fajr', name: 'الفجر', at: tm.fajr, today: tm, tomorrow: true };
}
/** «٤:٣٨ ص» */
export function fmtClock(ms) {
  const x = new Date(ms + TZ * 3600e3); let h = x.getUTCHours(); const mi = x.getUTCMinutes(), pm = h >= 12;
  h = h % 12 || 12;
  return `${h}:${String(mi).padStart(2, '0')} ${pm ? 'م' : 'ص'}`.replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
}
/** بداية الشهر القادم كما تحسبه لوحة الشرف (بالتوقيت العالمي = ٣ فجراً بتوقيت البحرين يوم ١) */
export function nextMonthStart(t = Date.now()) {
  const x = new Date(t);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1);
}
export const thisMonthStart = (t = Date.now()) => { const x = new Date(t); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1); };
