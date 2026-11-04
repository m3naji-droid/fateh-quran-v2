// عامل الخدمة: يجعل المقرأة قابلة للتثبيت كتطبيق، ويفتح الصفحة من الذاكرة إن انقطع الاتصال.
// الشبكة أولاً دائماً لملفات الموقع حتى تصل التحديثات فوراً؛ والذاكرة احتياط فقط.
// لا يتدخل في طلبات Firebase وخادم التجويد والقرّاء (نطاقات أخرى).
const CACHE = 'maqraa-v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // الفيديو يُطلب على أجزاء (Range) ولا يُخزَّن: نتركه للمتصفح مباشرة
  if (req.headers.has('range') || /\.(mp4|webm|mov)$/i.test(url.pathname)) return;
  e.respondWith(
    // يتحقق من الخادم كل مرة فتصل التحديثات فوراً (طلب الصفحة نفسها يُعاد بنائه برابطه)
    fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' }))
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});

// ------------------------------------------------ الإشعارات
// خادم الإشعارات يرسل رسائل بيانات (data) عبر Firebase Cloud Messaging، فنعرضها هنا بأنفسنا.
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { body: e.data && e.data.text() } }; }
  const d = { ...(p.notification || {}), ...(p.data || {}) };
  const title = d.title || 'مقرأة الفاتح';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-192.png',
      dir: 'rtl', lang: 'ar',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { link: d.link || './#/student' },
    }),
    // إن كان الموقع مفتوحاً: حدّث الجرس
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'notif' }))),
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.link || './#/student', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    if (c) return c.focus().then(() => c.navigate ? c.navigate(url) : c.postMessage({ type: 'open', url }));
    return self.clients.openWindow(url);
  }));
});
