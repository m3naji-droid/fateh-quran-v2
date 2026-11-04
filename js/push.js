// الإشعارات على الجوال: تفعيلها للطالب، وإرسالها من المعلم عبر خادم الإشعارات.
import { PUSH } from './firebase-config.js';
import { store } from './store.js';
import { platform } from './pwa.js';

const TOKEN_KEY = 'fp_pushToken';
const getLocal = () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; } };
const setLocal = (v) => { try { v ? localStorage.setItem(TOKEN_KEY, JSON.stringify(v)) : localStorage.removeItem(TOKEN_KEY); } catch {} };

export const pushConfigured = () => !!(PUSH.vapidKey && store.mode === 'cloud');

/**
 * حالة الإشعارات على هذا الجهاز:
 * off-config: لم يُعدّ المعلم الإشعارات بعد · unsupported: المتصفح لا يدعمها
 * needs-install: آيفون/آيباد قبل تثبيت التطبيق · denied: رفضها الطالب من إعدادات الجهاز
 * on: مفعّلة لهذا الحساب · ready: يمكن تفعيلها
 */
export function pushState(ownerId) {
  if (!pushConfigured()) return 'off-config';
  const p = platform();
  const supported = 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
  if (p.ios && !p.standalone) return 'needs-install';
  if (!supported) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const t = getLocal();
  if (Notification.permission === 'granted' && t && t.owner === ownerId) return 'on';
  return 'ready';
}

/** يُستدعى من ضغطة زر (شرط في الآيفون): يطلب الإذن ثم يسجّل الجهاز */
export async function enablePush(owner) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'رُفض الإذن. فعّله من إعدادات الجهاز ثم أعد المحاولة.' : 'لم يُمنح الإذن.');
  const reg = await navigator.serviceWorker.ready;
  const token = await store.pushToken(PUSH.vapidKey, reg);
  if (!token) throw new Error('تعذر تسجيل الجهاز للإشعارات.');
  const p = platform();
  await store.savePushToken(token, { ...owner.info, platform: p.ios ? 'ios' : p.android ? 'android' : 'desktop' });
  setLocal({ token, owner: owner.id, at: Date.now() });
  return token;
}

export async function disablePush() {
  const t = getLocal();
  setLocal(null);
  if (t) await store.deletePushToken(t.token);
}

/** يجدد تسجيل الجهاز بصمت عند فتح الموقع (الرمز قد يتغير)، دون أي سؤال للطالب */
export async function refreshPush(owner) {
  try {
    if (pushState(owner.id) !== 'on') return;
    const reg = await navigator.serviceWorker.ready;
    const token = await store.pushToken(PUSH.vapidKey, reg);
    const old = getLocal();
    if (token && (token !== old.token || Date.now() - old.at > 7 * 864e5)) {
      if (old.token !== token) await store.deletePushToken(old.token);
      await store.savePushToken(token, { ...owner.info, platform: old.platform || (platform().ios ? 'ios' : platform().android ? 'android' : 'desktop') });
      setLocal({ token, owner: owner.id, at: Date.now() });
    }
  } catch (e) { console.warn('push refresh', e); }
}

/** إشعار تجريبي محلي على هذا الجهاز */
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('مقرأة الفاتح', { body: 'الإشعارات تعمل على جهازك بإذن الله.', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', dir: 'rtl', lang: 'ar', tag: 'test' });
}

/** ينشر إعلاناً عبر الخادم، أو يعيد إرسال إشعاره لطلاب بأعينهم (من لم يقرأ) */
export async function sendAnnouncement(annId, resend = null) {
  if (!PUSH.url || store.mode !== 'cloud') { if (!resend) await store.publishAnnouncementLocal(annId); return null; }
  const token = await store.idToken();
  const res = await fetch(PUSH.url.replace(/\/$/, '') + '/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(resend ? { ann: annId, resend } : { ann: annId }),
  });
  if (!res.ok) { let m = ''; try { m = (await res.json()).detail; } catch {} throw new Error(m || 'تعذر الإرسال (' + res.status + ').'); }
  return res.json();
}

/** إرسال تنبيهات خاصة بعدة طلاب دفعة واحدة: items = [{notif, student}] */
export async function sendPushBatch(items) {
  if (!PUSH.url || store.mode !== 'cloud' || !items.length) return null;
  const token = await store.idToken();
  const res = await fetch(PUSH.url.replace(/\/$/, '') + '/send-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) { let m = ''; try { m = (await res.json()).detail; } catch {} throw new Error(m || 'تعذر الإرسال (' + res.status + ').'); }
  return res.json();
}

/** يطلب من خادم الإشعارات إرسال تنبيه محفوظ إلى أجهزة صفه. يعيد {sent, failed} أو null إن لم يُعدّ الخادم */
export async function sendPush(notifId, student = null) {
  if (!PUSH.url || store.mode !== 'cloud') return null;
  const token = await store.idToken();
  const res = await fetch(PUSH.url.replace(/\/$/, '') + '/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(student ? { notif: notifId, student } : { notif: notifId }),
  });
  if (!res.ok) { let m = ''; try { m = (await res.json()).detail; } catch {} throw new Error(m || 'تعذر إرسال الإشعار (' + res.status + ').'); }
  return res.json();
}
