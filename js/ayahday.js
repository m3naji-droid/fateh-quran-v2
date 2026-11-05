// آية اليوم: آية من قائمة منتقاة تتغير يومياً (الآية نفسها للجميع في اليوم نفسه)، مع الاستماع والمعنى (التفسير الميسر) والمشاركة كصورة.
import { loadQuran, ayahText, surahName, toArabicDigits as ar } from './quran.js';
import { ayahAudioUrl, RECITERS } from './speech.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let listP = null;
const loadList = () => (listP = listP || fetch('data/ayah-of-day.json').then((r) => r.json()).catch((e) => { listP = null; throw e; }));
const riyadhDayNum = () => Math.floor((Date.now() + 3 * 3600e3) / 864e5);

export async function todayAyah() {
  const [L] = await Promise.all([loadList(), loadQuran()]);
  const x = L[(riyadhDayNum() * 37) % L.length]; // قفزات ثابتة حتى لا تتوالى آيات السورة نفسها
  return { ...x, text: ayahText(x.s, x.a) };
}

const player = new Audio();
const reciterId = () => { try { return JSON.parse(localStorage.getItem('fp_pref_reciter')) || RECITERS[0].id; } catch { return RECITERS[0].id; } };

/** يرسم بطاقة آية اليوم داخل host. compact: نسخة مصغّرة لصفحة الطالب */
export async function mountAyahOfDay(host, { compact = false } = {}) {
  if (!host) return;
  host.innerHTML = `<div class="aod${compact ? ' aod-compact' : ''}"><div class="aod-k">✨ آية اليوم</div><div class="loading small">…</div></div>`;
  let x;
  try { x = await todayAyah(); } catch { host.innerHTML = ''; return; }
  const ref = `سورة ${surahName(x.s)} · الآية ${ar(x.a)}`;
  host.innerHTML = `<div class="aod${compact ? ' aod-compact' : ''}">
    <div class="aod-k">✨ آية اليوم</div>
    <p class="aod-text">${esc(x.text)} <span class="aod-end">﴿${ar(x.a)}﴾</span></p>
    <div class="aod-ref">${esc(ref)}</div>
    <div class="aod-meaning" hidden><b>المعنى:</b> ${esc(x.t)}<small>التفسير الميسر</small></div>
    <div class="aod-acts">
      <button type="button" class="aod-btn" data-play>🔊 استمع</button>
      <button type="button" class="aod-btn" data-mean>📖 المعنى</button>
      <button type="button" class="aod-btn" data-share>📤 مشاركة</button>
    </div></div>`;
  const pb = host.querySelector('[data-play]');
  const stop = () => { player.pause(); pb.textContent = '🔊 استمع'; };
  pb.onclick = () => {
    if (!player.paused && player.dataset.k === `${x.s}:${x.a}`) return stop();
    player.src = ayahAudioUrl(reciterId(), x.s, x.a); player.dataset.k = `${x.s}:${x.a}`;
    player.onended = stop; player.play().then(() => (pb.textContent = '⏸ إيقاف')).catch(() => (pb.textContent = '🔊 تعذر التشغيل'));
  };
  host.querySelector('[data-mean]').onclick = (e) => { const m = host.querySelector('.aod-meaning'); m.hidden = !m.hidden; e.currentTarget.classList.toggle('on', !m.hidden); };
  host.querySelector('[data-share]').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; const old = b.textContent; b.textContent = '⏳ جارٍ التجهيز…';
    try { await shareImage(x, ref); } catch (err) { console.warn(err); }
    b.disabled = false; b.textContent = old;
  };
}

/* ---------- صورة للمشاركة ---------- */
function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = '';
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line);
  return lines;
}
async function shareImage(x, ref) {
  const W = 1080, H = 1350;
  try { await Promise.all([document.fonts.load('60px "Amiri Quran"'), document.fonts.load('700 80px "Aref Ruqaa"'), document.fonts.load('500 30px "IBM Plex Sans Arabic"')]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(W / 2, H * 0.32, 50, W / 2, H * 0.4, H * 0.85);
  g.addColorStop(0, '#0f6b51'); g.addColorStop(0.5, '#0a4a39'); g.addColorStop(1, '#052c22');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // زخرفة خفيفة
  c.save(); c.globalAlpha = 0.08; c.strokeStyle = '#d9b45a'; c.lineWidth = 2;
  for (let y = -60; y < H + 120; y += 180) for (let xx = -60; xx < W + 120; xx += 180) { c.save(); c.translate(xx, y); c.strokeRect(-45, -45, 90, 90); c.rotate(Math.PI / 4); c.strokeRect(-45, -45, 90, 90); c.restore(); }
  c.restore();
  c.strokeStyle = 'rgba(217,180,90,.5)'; c.lineWidth = 3; c.strokeRect(36, 36, W - 72, H - 72);
  // الشعار
  const logo = (cx, cy, r) => { c.save(); c.translate(cx, cy); c.fillStyle = '#d9b45a'; for (const a of [0, Math.PI / 4]) { c.save(); c.rotate(a); c.fillRect(-r, -r, 2 * r, 2 * r); c.restore(); } c.fillStyle = '#0d5c46'; c.beginPath(); c.arc(0, 0, r * 0.55, 0, 7); c.fill(); c.fillStyle = '#f3e7c6'; c.beginPath(); c.arc(0, 0, r * 0.33, 0, 7); c.fill(); c.restore(); };
  logo(W / 2, 150, 34);
  c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#f3e7c6'; c.font = '600 40px "IBM Plex Sans Arabic", sans-serif'; c.fillText('✨ آية اليوم', W / 2, 250);
  // نص الآية: نصغّر الخط حتى يتسع
  let size = 66, lines;
  for (; size >= 34; size -= 4) { c.font = `${size}px "Amiri Quran", "Amiri", serif`; lines = wrapLines(c, `${x.text} ﴿${ar(x.a)}﴾`, W - 200); if (lines.length * size * 1.9 <= 700) break; }
  const lh = size * 1.9, top = 330 + (720 - lines.length * lh) / 2;
  c.fillStyle = '#ffffff';
  lines.forEach((l, i) => c.fillText(l, W / 2, top + i * lh + lh / 2));
  c.fillStyle = '#d9b45a'; c.font = '500 38px "IBM Plex Sans Arabic", sans-serif'; c.fillText(ref, W / 2, 1095);
  c.font = '700 64px "Aref Ruqaa", "Amiri", serif'; c.fillText('مقرأة الفاتح', W / 2, 1195);
  c.fillStyle = 'rgba(243,231,198,.75)'; c.font = '400 26px "IBM Plex Sans Arabic", sans-serif'; c.direction = 'ltr';
  c.fillText(location.host + location.pathname.replace(/\/$/, ''), W / 2, 1262);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
  const file = new File([blob], `آية-اليوم-${x.s}-${x.a}.jpg`, { type: 'image/jpeg' });
  const text = `✨ آية اليوم\n${x.text}\n(${ref})\n\nمقرأة الفاتح: ${location.origin + location.pathname}`;
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
