// عامل الخدمة: يجعل المقرأة قابلة للتثبيت كتطبيق، ويفتح الصفحة من الذاكرة إن انقطع الاتصال.
// الشبكة أولاً دائماً لملفات الموقع حتى تصل التحديثات فوراً؛ والذاكرة احتياط فقط.
// لا يتدخل في طلبات Firebase وخادم التجويد والقرّاء (نطاقات أخرى).
const CACHE = 'maqraa-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
