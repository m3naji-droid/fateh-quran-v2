// وضع عرض الفصل (للبروجكتر): شرائح تتبدل كل ١٥ ثانية، ويتنقل المعلم بالأسهم أو بالنقر.
// ١) منصة الأوائل (قارئ الصف أو شيخ المرحلة) ٢) تحدي الصفوف ٣) آية اليوم ٤) أبطال الأسبوع
import { toArabicDigits as ar, surahName } from './quran.js';
import { todayAyah } from './ayahday.js';
import { confetti } from './celebrate.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLIDE_MS = 15000;
const pts = (n) => `${ar(Math.round(n * 10) / 10)} <small>نقطة</small>`;

function podium(top, title, sub) {
  if (!top.length) return `<div class="cr-slide"><h1 class="cr-title">${esc(title)}</h1><p class="cr-sub">لم تُسجَّل نقاط هذا الشهر بعد… كن أول من يسمّع!</p></div>`;
  const order = [1, 0, 2].filter((i) => top[i]); // الثاني، الأول، الثالث
  const medal = ['👑', '🥈', '🥉'];
  return `<div class="cr-slide"><h1 class="cr-title">${esc(title)}</h1><p class="cr-sub">${esc(sub)}</p>
    <div class="cr-podium">${order.map((i) => `<div class="cr-step s${i + 1}" style="--d:${[1.6, 0.9, 0.3][i]}s"><div class="cr-medal">${medal[i]}</div><div class="cr-name">${esc(top[i].name)}</div>${top[i].className ? `<div class="cr-cls">${esc(top[i].className)}</div>` : ''}<div class="cr-pts">${pts(top[i].points)}</div><div class="cr-block">${ar(i + 1)}</div></div>`).join('')}</div>
    ${top.length > 3 ? `<div class="cr-rest">${top.slice(3, 5).map((x, j) => `<div style="--d:${2.4 + j * 0.3}s"><b>${ar(j + 4)}</b> ${esc(x.name)} <span>${pts(x.points)}</span></div>`).join('')}</div>` : ''}</div>`;
}
function race(classes, focus) {
  if (!classes.length) return '<div class="cr-slide"><h1 class="cr-title">تحدي الصفوف</h1><p class="cr-sub">لا نقاط بعد هذا الشهر.</p></div>';
  const max = Math.max(...classes.map((c) => c.score), 1);
  return `<div class="cr-slide"><h1 class="cr-title">🏁 تحدي الصفوف</h1><p class="cr-sub">مجموع نقاط طلاب كل صف هذا الشهر</p>
    <div class="cr-race">${classes.map((c, i) => `<div class="cr-lane${c.id === focus ? ' me' : ''}"><span class="cr-pos">${['👑', '🥈', '🥉'][i] || ar(i + 1)}</span><span class="cr-lname">${esc(c.name)}</span><span class="cr-track"><i style="--w:${Math.max(3, (c.score / max) * 100)}%;--d:${0.3 + i * 0.25}s"></i></span><b>${ar(Math.round(c.score))}</b></div>`).join('')}</div></div>`;
}
function ayahSlide(x) {
  if (!x) return '';
  return `<div class="cr-slide"><h1 class="cr-title">✨ آية اليوم</h1><p class="cr-ayah">${esc(x.text)} <span>﴿${ar(x.a)}﴾</span></p><p class="cr-sub">سورة ${esc(surahName(x.s))} · الآية ${ar(x.a)}</p><p class="cr-mean">${esc(x.t)}</p></div>`;
}
function khSlide(k) {
  if (!k) return '';
  const pct = Math.round((k.done / k.total) * 100), C = 2 * Math.PI * 120;
  return `<div class="cr-slide"><h1 class="cr-title">📿 ${k.complete ? 'اكتملت الختمة!' : 'ختمة الصف'}</h1><p class="cr-sub">${esc(k.label)}${k.left && !k.complete ? ' · ' + esc(k.left) : ''}</p>
    <div class="cr-kh"><svg viewBox="0 0 280 280" class="cr-ring"><circle cx="140" cy="140" r="120" class="bg"/><circle cx="140" cy="140" r="120" class="fg" style="--c:${C};--o:${C * (1 - pct / 100)}"/></svg>
      <div class="cr-kh-n"><b>${ar(pct)}٪</b><span>${ar(k.done)} من ${ar(k.total)} آية</span></div></div>
    ${k.top.length ? `<div class="cr-rest">${k.top.map((c, j) => `<div style="--d:${1 + j * 0.2}s">${['🥇', '🥈', '🥉', '⭐', '⭐'][j]} ${esc(c.name)} <span>${ar(c.n)} <small>آية</small></span></div>`).join('')}</div>` : ''}</div>`;
}
function heroes(h) {
  const card = (ico, t, x, unit) => `<div class="cr-hero" style="--d:${0.3 + ico.length * 0}s"><div class="cr-hico">${ico}</div><div class="cr-ht">${t}</div>${x ? `<div class="cr-hname">${esc(x.name)}</div><div class="cr-hval">${ar(x.v)} ${unit}</div>` : '<div class="cr-hval muted">— لم يُحسم بعد</div>'}</div>`;
  return `<div class="cr-slide"><h1 class="cr-title">🌟 أبطال الأسبوع</h1><p class="cr-sub">آخر ٧ أيام</p>
    <div class="cr-heroes">${card('🔥', 'أطول سلسلة', h.streak, 'يوماً متتالياً')}${card('🎙️', 'الأكثر تسميعاً', h.subs, 'تسميع')}${card('⚔️', 'بطل التحديات', h.wins, 'انتصار')}</div></div>`;
}

/** opts: { scopeName, top, classes, focusClass, heroes, podiumTitle } */
export async function openClassroom(opts) {
  let ayah = null;
  try { ayah = await todayAyah(); } catch {}
  const slides = [
    { html: podium(opts.top, opts.podiumTitle, `${opts.scopeName} · ${opts.monthLabel}`), party: true },
    { html: race(opts.classes, opts.focusClass) },
    opts.khatma && { html: khSlide(opts.khatma), party: opts.khatma.complete },
    ayah && { html: ayahSlide(ayah) },
    { html: heroes(opts.heroes) },
  ].filter(Boolean);
  const box = document.createElement('div');
  box.className = 'cr';
  box.innerHTML = `<div class="cr-bg"></div><div class="cr-stage"></div>
    <div class="cr-bar"><div class="cr-brand">مقرأة الفاتح</div><div class="cr-dots">${slides.map((_, i) => `<button type="button" data-go="${i}" aria-label="الشريحة ${ar(i + 1)}"></button>`).join('')}</div>
      <div class="cr-ctl"><button type="button" data-prev aria-label="السابق">→</button><button type="button" data-pp aria-label="إيقاف مؤقت">⏸</button><button type="button" data-next aria-label="التالي">←</button><button type="button" data-x aria-label="إغلاق">✕</button></div></div>
    <div class="cr-timer"><i></i></div>`;
  document.body.appendChild(box);
  box.requestFullscreen?.().catch(() => {});
  const stage = box.querySelector('.cr-stage'), timer = box.querySelector('.cr-timer i');
  let i = 0, t = null, paused = false, partyT = null;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    stage.innerHTML = slides[i].html;
    box.querySelectorAll('[data-go]').forEach((d, k) => d.classList.toggle('on', k === i));
    clearTimeout(partyT);
    if (slides[i].party && (opts.top.length || i > 0)) partyT = setTimeout(() => { confetti(3500); document.querySelectorAll('.confetti').forEach((c) => (c.style.zIndex = 9700)); }, 2000);
    timer.style.animation = 'none'; void timer.offsetWidth; timer.style.animation = paused ? 'none' : `crTimer ${SLIDE_MS}ms linear forwards`;
    clearTimeout(t); if (!paused) t = setTimeout(() => show(i + 1), SLIDE_MS);
  };
  const close = () => { clearTimeout(t); clearTimeout(partyT); removeEventListener('keydown', key); box.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  const key = (e) => {
    if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); show(i + 1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
    else if (e.key === 'Escape') close();
  };
  addEventListener('keydown', key);
  document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement && document.body.contains(box)) { document.removeEventListener('fullscreenchange', f); close(); } });
  box.querySelector('[data-next]').onclick = () => show(i + 1);
  box.querySelector('[data-prev]').onclick = () => show(i - 1);
  box.querySelector('[data-x]').onclick = close;
  box.querySelector('[data-pp]').onclick = (e) => { paused = !paused; e.currentTarget.textContent = paused ? '▶' : '⏸'; show(i); };
  box.querySelectorAll('[data-go]').forEach((d) => (d.onclick = () => show(+d.dataset.go)));
  stage.onclick = (e) => { const r = box.getBoundingClientRect(); show(e.clientX < r.width / 2 ? i + 1 : i - 1); }; // النقر يساراً للتالي (اتجاه القراءة)
  show(0);
}
