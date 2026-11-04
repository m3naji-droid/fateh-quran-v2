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
