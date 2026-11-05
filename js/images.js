// صور الإعلانات: تصغير الصورة في المتصفح قبل الرفع، وحفظ مؤقت في جوال الطالب حتى لا تُنزَّل مرتين.

export const IMG_MAX_SIDE = 1280;        // أطول ضلع بالبكسل
export const IMG_TARGET = 170 * 1024;     // الحجم المستهدف بعد الضغط (بايت)
export const IMG_DAILY_LIMIT = 5;         // حد الصور اليومي للمعلم
export const IMG_DAYS = 30;               // تُحذف بعد ٣٠ يوماً

const loadImg = (file) => new Promise((res, rej) => {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => { URL.revokeObjectURL(url); res(im); };
  im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('تعذر قراءة الصورة. جرّب صورة بصيغة JPG أو PNG.')); };
  im.src = url;
});
const toBlob = (cv, q) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));

/** يصغّر الصورة إلى JPEG خفيف. يعيد { blob, w, h } */
export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name || '')) throw new Error('اختر ملف صورة.');
  const im = await loadImg(file);
  let side = IMG_MAX_SIDE, blob = null, w = 0, h = 0;
  for (let round = 0; round < 3; round++) {
    const k = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight));
    w = Math.max(1, Math.round(im.naturalWidth * k)); h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // الخلفية الشفافة تصير بيضاء
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, w, h);
    for (const q of [0.82, 0.72, 0.62, 0.52]) {
      blob = await toBlob(cv, q);
      if (blob && blob.size <= IMG_TARGET) return { blob, w, h };
    }
    side = Math.round(side * 0.8);
  }
  if (!blob) throw new Error('تعذر ضغط الصورة.');
  return { blob, w, h };
}

export const blobToB64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
export function b64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}
export const fmtKB = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

/* ---- الحفظ المؤقت في الجهاز (IndexedDB) ---- */
let dbp = null;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('fp-images', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function cacheGet(key) {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('img').objectStore('img').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; }
}
async function cachePut(key, v) {
  try { const db = await idb(); db.transaction('img', 'readwrite').objectStore('img').put(v, key); } catch {}
}
/** يحذف من الجهاز الصور التي مضى عليها أكثر من ٣٠ يوماً */
export async function pruneImageCache() {
  try {
    const db = await idb(); const from = Date.now() - IMG_DAYS * 864e5;
    const st = db.transaction('img', 'readwrite').objectStore('img');
    st.openCursor().onsuccess = (e) => { const c = e.target.result; if (!c) return; if (!(c.value?.at > from)) c.delete(); c.continue(); };
  } catch {}
}

/** يعيد Blob الصورة: من الجهاز إن وُجدت، وإلا من قاعدة البيانات (مرة واحدة) */
export async function annImage(aid, fetcher) {
  const hit = await cacheGet(aid);
  if (hit?.blob) return hit.blob;
  const d = await fetcher(aid);
  if (!d?.b64) return null;
  const blob = b64ToBlob(d.b64, d.type || 'image/jpeg');
  cachePut(aid, { blob, at: Date.now() });
  return blob;
}

/** حفظ الصورة في الجوال: مشاركة (فيها «حفظ الصورة» على الآيفون) أو تنزيل */
export async function saveImage(blob, name = 'إعلان-مقرأة-الفاتح.jpg') {
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** عرض الصورة بملء الشاشة مع زرّي الحفظ والإغلاق */
export function openLightbox(blob, alt = '') {
  const url = URL.createObjectURL(blob);
  const box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<img alt=""><div class="lbx-bar"><button type="button" class="btn gold" data-save>⬇ حفظ الصورة</button><button type="button" class="btn" data-x>إغلاق ✕</button></div>`;
  box.querySelector('img').src = url; box.querySelector('img').alt = alt;
  const close = () => { box.remove(); URL.revokeObjectURL(url); removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = (e) => { if (e.target === box) close(); };
  box.querySelector('[data-x]').onclick = close;
  box.querySelector('[data-save]').onclick = () => saveImage(blob);
  addEventListener('keydown', key);
  document.body.appendChild(box);
  box.querySelector('[data-x]').focus();
}
