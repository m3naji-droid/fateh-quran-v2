// عداد «بقي حتى إعلان الفائزين هذا الشهر» ومربع مواقيت الصلاة (البحرين) مع عداد الصلاة القادمة وتنبيهها
import { nextMonthStart, thisMonthStart, nextPrayer, dayTimes, fmtClock, PRAYERS } from './prayer.js';

const AR = (s) => String(s).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]);
const two = (n) => AR(String(n).padStart(2, '0'));
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const TIPS = [
  'كل تسميع اليوم يقرّبك من المنصة ✨',
  'شيخ المرحلة وقارئ الصف… هل يكون اسمك هذا الشهر؟',
  'تسميع واحد كل يوم يصنع الفرق 🌱',
  'المتصدر اليوم قد يتغير غداً؛ فلا تتوقف 🚀',
  '﴿وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ﴾',
  'الإتقان قبل السرعة، والمداومة قبل الكثرة 💎',
  'الأيام الأخيرة تحسم السباق؛ اجعلها أقوى أيامك 🔥',
];
const TIPS_T = ['يُعلن الفائزون تلقائياً، ويصل الطلابَ إشعار بالنتائج.', 'شجّع طلابك: الأيام الأخيرة تحسم السباق 🔥', 'ذكّر المتأخرين: تسميع واحد يومياً يكفي ليصعدوا 🌱'];

/** حلقة تحديث كل ثانية تتوقف وحدها حين تُزال البطاقة من الصفحة */
function ticker(host, fn) {
  fn();
  const id = setInterval(() => { if (!host.isConnected) return clearInterval(id); fn(); }, 1000);
}

/** بطاقة الكأس: العد التنازلي لإعلان الفائزين. teacher=true لنص المعلم. onHonor يفتح لوحة الشرف */
export function mountMonthCountdown(host, { teacher = false, onHonor } = {}) {
  if (!host) return;
  let tip = Math.floor(Math.random() * 100);
  const tips = teacher ? TIPS_T : TIPS;
  host.innerHTML = `<div class="cdA" role="timer" aria-live="off"><span class="cdA-cup" aria-hidden="true">🏆</span>
    <h3>⏳ بقي حتى إعلان الفائزين هذا الشهر</h3><p class="cdA-sub"></p>
    <div class="cdA-boxes" dir="rtl"><div><b data-u="d">٠٠</b><span data-l="d">يوماً</span></div><div><b data-u="h">٠٠</b><span>ساعة</span></div><div><b data-u="m">٠٠</b><span>دقيقة</span></div><div><b data-u="s">٠٠</b><span>ثانية</span></div></div>
    <div class="cdA-tip"></div>
    <div class="cdA-won" hidden></div></div>`;
  const $ = (s) => host.querySelector(s);
  let lastTip = 0;
  ticker(host, () => {
    const now = Date.now(), end = nextMonthStart(now), started = thisMonthStart(now);
    // أول يوم من الشهر: الفائزون أُعلنوا
    const won = now - started < 864e5;
    const prev = new Date(started - 1);
    $('.cdA-won').hidden = !won;
    if (won) $('.cdA-won').innerHTML = `🎉 أُعلن فائزو شهر ${MONTHS[prev.getUTCMonth()]}! ${onHonor ? '<button type="button" class="btn sm">افتح لوحة الشرف</button>' : ''}`;
    const b = $('.cdA-won button'); if (b && !b.onclick) b.onclick = onHonor;
    let r = Math.max(0, Math.floor((end - now) / 1000));
    const d = Math.floor(r / 86400); r %= 86400;
    const h = Math.floor(r / 3600); r %= 3600;
    $('[data-u=d]').textContent = AR(d); $('[data-l=d]').textContent = d === 1 ? 'يوم' : d === 2 ? 'يومان' : d >= 3 && d <= 10 ? 'أيام' : 'يوماً';
    $('[data-u=h]').textContent = two(h); $('[data-u=m]').textContent = two(Math.floor(r / 60)); $('[data-u=s]').textContent = two(r % 60);
    const last = (end - now) < 3 * 864e5;
    host.firstElementChild.classList.toggle('hot', last);
    $('.cdA-sub').textContent = last ? '🔥 الأيام الأخيرة! كل تسميع الآن له وزن' : `يُعلن الفائزون ١ ${MONTHS[new Date(end).getUTCMonth()]} بإذن الله`;
    if (now - lastTip > 7000) { lastTip = now; tip++; const t = $('.cdA-tip'); t.classList.remove('in'); void t.offsetWidth; t.textContent = tips[tip % tips.length]; t.classList.add('in'); }
  });
}

/** مربع مواقيت الصلاة: الصلاة القادمة ووقتها وعدّاد دخولها، والمواقيت الست صغيرة بالأسفل */
export function mountPrayerTile(host) {
  if (!host) return;
  host.innerHTML = `<div class="pr-tile" role="timer" aria-live="off">
    <span class="pr-ic" aria-hidden="true">🕌</span><small class="pr-lb">الصلاة القادمة</small>
    <b class="pr-n"></b><small class="pr-at"></small><div class="pr-cd" dir="ltr"></div>
    <ul class="pr-all"></ul></div>`;
  const $ = (s) => host.querySelector(s);
  let day = '';
  ticker(host, () => {
    const now = Date.now(), n = nextPrayer(now);
    $('.pr-n').textContent = n.name;
    $('.pr-at').textContent = `${fmtClock(n.at)}${n.tomorrow ? ' · غداً' : ''} · البحرين`;
    let r = Math.max(0, Math.floor((n.at - now) / 1000));
    $('.pr-cd').textContent = `${two(Math.floor(r / 3600))}:${two(Math.floor((r % 3600) / 60))}:${two(r % 60)}`.replace(/[٠-٩]/g, (c) => c);
    host.firstElementChild.classList.toggle('soon', r <= 600);
    const key = n.key + n.at;
    if (key !== day) {
      day = key;
      const T = n.tomorrow ? n.today : dayTimes(now);
      $('.pr-all').innerHTML = PRAYERS.map(([k, name]) => `<li class="${k === n.key ? 'on' : ''}${k === 'sunrise' ? ' sr' : ''}"><span>${name}</span><b>${fmtClock(T[k]).replace(/ [صم]$/, '')}</b></li>`).join('');
    }
  });
}

/** تنبيه داخل الموقع قبل الصلاة بعشر دقائق وعند دخول وقتها (مرة لكل صلاة) */
let alertsOn = false;
export function startPrayerAlerts(show) {
  if (alertsOn) return; alertsOn = true;
  const said = new Set();
  const check = () => {
    const now = Date.now(), n = nextPrayer(now), left = n.at - now;
    const k10 = 'p10' + n.at;
    if (left <= 10 * 60e3 && left > 9 * 60e3 && !said.has(k10)) { said.add(k10); show(`🕌 بقي عشر دقائق على صلاة ${n.name}. أكمل تسميعك واستعد للصلاة.`); }
    // دخل الوقت: الصلاة التي مضى عليها أقل من دقيقة
    const T = dayTimes(now);
    for (const [key, name] of PRAYERS) if (key !== 'sunrise' && now >= T[key] && now - T[key] < 60e3 && !said.has('p0' + T[key])) { said.add('p0' + T[key]); show(`🕌 حان الآن وقت صلاة ${name}. حيّ على الصلاة.`); }
  };
  setInterval(check, 15e3); check();
}
