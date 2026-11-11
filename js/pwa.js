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
 * يتحقق كل بضع دقائق (وعند العودة إلى الصفحة) من بصمة ملفات الموقع الأساسية على الخادم (ETag).
 * إن تغيّرت عما فُتحت به الصفحة: صدر تحديث، فيظهر شريط «يوجد تحديث، اضغط هنا».
 * لا يحتاج رقم إصدار يدوياً: أي نشر جديد يغيّر البصمة تلقائياً. */
// كل ملفات الموقع التي تتغير كثيراً: أي تعديل فيها يُظهر رسالة التحديث
const WATCH = ['./', 'js/app.js', 'js/store.js', 'assets/style.css', 'js/iqra.js', 'js/iqra-audio.js', 'js/iqra-taj.js', 'js/iqra-data.js', 'js/tajweed-ai.js'];
async function fingerprint() {
  const parts = await Promise.all(WATCH.map((u) => fetch(u, { method: 'HEAD', cache: 'no-store' })
    .then((r) => (r.ok ? r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '' : null))
    .catch(() => null)));
  return parts.some((p) => p == null) ? null : parts.join('|'); // تعذر الاتصال: لا نحكم
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
      else if (fp && fp !== base) { shown = true; onUpdate(); }
    } finally { busy = false; }
  };
  setTimeout(check, 4000);
  setInterval(check, every);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  addEventListener('focus', check);
  addEventListener('online', check);
}
