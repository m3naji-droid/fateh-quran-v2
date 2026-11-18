// تثبيت المقرأة كتطبيق على الجوال (أندرويد وآيفون) والحاسوب.
// أندرويد/Chrome/Edge: نافذة التثبيت الأصلية بضغطة زر (beforeinstallprompt).
// آيفون/آيباد: لا يسمح Apple بالتثبيت البرمجي، فنعرض خطوات «مشاركة ← إضافة إلى الشاشة الرئيسية».

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => { try { f(); } catch {} });

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('fp_installed', '1'); } catch {} notify(); });

export function registerSW() {
  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

export function platform() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|WhatsApp|Twitter|MicroMessenger/i.test(ua);
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { ios, android, inApp, iosOtherBrowser, standalone, canPrompt: !!deferred };
}

/** يعرض نافذة التثبيت الأصلية إن توفرت. يعيد 'accepted' أو 'dismissed' أو null إن لم تتوفر */
export async function promptInstall() {
  if (!deferred) return null;
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  notify();
  return outcome;
}

/* ---------- تنبيه التحديث ----------
 * يتحقق كل بضع دقائق (وعند العودة إلى الصفحة) من رقم أحدث إصدار في VERSIONS.md على الخادم.
 * الرقم يزيد دائماً، فلا يظهر الشريط إلا لإصدار أحدث فعلاً مما فُتحت به الصفحة.
 * (كانت المقارنة سابقاً ببصمة الملفات ETag، وخوادم الاستضافة الموزعة قد تعطي بصمات مختلفة
 *  للملف نفسه بعد النشر، فيتكرر الشريط كل دقيقتين بلا تحديث حقيقي.) */
const AR_D = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
async function fingerprint() {
  try {
    const r = await fetch('VERSIONS.md', { cache: 'no-store' });
    if (!r.ok) return null;
    const t = await r.text();
    let max = 0;
    for (const m of t.matchAll(/^\|\s*([٠-٩0-9]+)\s*\|/gm)) { const n = +[...m[1]].map((c) => AR_D[c] ?? c).join(''); if (n > max) max = n; }
    return max || null;
  } catch { return null; } // تعذر الاتصال: لا نحكم
}

export function watchUpdates(onUpdate, every = 3 * 60e3) {
  if (!isSecureContext && location.hostname !== 'localhost') return;
  let base = null, shown = false, busy = false;
  const check = async () => {
    if (busy || shown || document.hidden) return;
    busy = true;
    try {
      const fp = await fingerprint();
      if (fp && base == null) base = fp;
      else if (fp && fp > base) { shown = true; onUpdate(); }
    } finally { busy = false; }
  };
  setTimeout(check, 4000);
  setInterval(check, every);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  addEventListener('focus', check);
  addEventListener('online', check);
}
