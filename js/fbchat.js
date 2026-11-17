// محادثات «رأيك يهمنا»: كل ملاحظة محادثة متتابعة بين الطالب والمعلم (نص وصورة ورسالة صوتية، و«✓✓ قرأها»)
import { compressImage, blobToB64, b64ToBlob, openLightbox } from './images.js';

const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const FB_CLOSE_DAYS = 7;
const VOICE_MAX = 60, VOICE_BYTES = 450 * 1024;

export const QUICK_DEFAULT = [
  'شكراً لك على ملاحظتك، سأعمل عليها بإذن الله 🌟',
  'تم الإصلاح بحمد الله، جرّب الآن وأخبرني.',
  'هل يمكنك إرسال صورة للشاشة حتى أفهم المشكلة؟',
  'جزاك الله خيراً على الاقتراح الجميل 💡',
  'سأتابع الأمر وأردّ عليك قريباً إن شاء الله.',
];

/** آخر نشاط في المحادثة */
export const fbLast = (t) => [t.lastAt, t.repliedAt, t.reopenAt, t.createdAt].filter(Boolean).sort().pop() || '';
/** تُغلق المحادثة يدوياً أو تلقائياً بعد ٧ أيام بلا رسائل */
export const fbClosed = (t) => !!t.closed || (Date.now() - Date.parse(fbLast(t) || 0) > FB_CLOSE_DAYS * 864e5);
/** رسالة لم يقرأها الطالب */
export const fbUnreadS = (t) => (t.lastFrom === 't' && (t.lastAt || '') > (t.sSeenAt || '')) || (!t.lastFrom && !!t.reply && !t.replySeen);
/** رسالة لم يقرأها المعلم */
export const fbUnreadT = (t) => !t.seen || (t.lastFrom === 's' && (t.lastAt || '') > (t.tSeenAt || ''));
/** معاينة آخر رسالة */
export const fbPreview = (t) => (t.lastFrom ? (t.lastFrom === 't' ? 'المعلم: ' : '') + (t.lastText || '') : t.reply ? 'المعلم: ' + t.reply : t.text || '');

const hm = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'), p = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return ar(`${h}:${m}`) + ' ' + p; };
const dayLbl = (iso) => {
  const d = new Date(iso), t = new Date(); if (isNaN(d)) return '';
  const k = (x) => x.toDateString(), y = new Date(t); y.setDate(t.getDate() - 1);
  if (k(d) === k(t)) return 'اليوم';
  if (k(d) === k(y)) return 'أمس';
  return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' });
};

/**
 * يعرض المحادثة داخل host ويتابعها مباشرة.
 * side: 's' للطالب، 't' للمعلم. hooks.onSent(m, thread) بعد إرسال رسالة (للتنبيهات).
 * يعيد دالة الإيقاف.
 */
export function mountChat(host, { store, side, pn, fid, title = '', sub = '', toast = alert, onBack = null, onSent = null, onState = null, quick = null, saveQuick = null }) {
  const other = side === 's' ? 't' : 's';
  let T = null, MS = [], sending = false, rec = null, pendImg = null, pendVoice = null, first = true;
  host.innerHTML = `<div class="chat" dir="rtl">
    <div class="chat-h">${onBack ? '<button type="button" class="btn sm ghost chat-back" aria-label="رجوع">→</button>' : ''}
      <div class="chat-who"><b>${esc(title)}</b><small class="muted">${esc(sub)}</small></div><span class="chat-tools"></span></div>
    <div class="chat-msgs" aria-live="polite"><div class="loading">جارٍ تحميل المحادثة…</div></div>
    <div class="chat-foot"></div></div>`;
  const $ = (s) => host.querySelector(s);
  if (onBack) $('.chat-back').onclick = () => { stop(); onBack(); };
  const audioUrls = [];

  const msgList = () => {
    if (!T) return [];
    const L = [{ id: '_0', from: 's', text: T.text, at: T.createdAt }];
    if (T.reply && !MS.some((m) => m.legacy)) L.push({ id: '_1', from: 't', text: T.reply, at: T.repliedAt || T.createdAt });
    return [...L, ...MS].sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  };
  const seenBy = (m) => {
    if (m.id === '_1') return !!T.replySeen || (T.sSeenAt || '') >= (m.at || '');
    const s = other === 't' ? (T.tSeenAt || (T.seen ? T.createdAt : '')) : T.sSeenAt;
    return !!s && s >= (m.at || '');
  };
  const paintMsgs = () => {
    const box = $('.chat-msgs'); if (!box) return;
    const nearEnd = first || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    let lastDay = '';
    box.innerHTML = msgList().map((m) => {
      const mine = m.from === side, dl = dayLbl(m.at), sep = dl !== lastDay ? `<div class="chat-day"><span>${esc(dl)}</span></div>` : '';
      lastDay = dl;
      const tick = mine ? (seenBy(m) ? `<span class="tk read" title="${side === 's' ? 'قرأها المعلم' : 'قرأها الطالب'}">✓✓</span>` : '<span class="tk" title="أُرسلت">✓</span>') : '';
      const media = m.img ? `<button type="button" class="chat-img" data-img="${esc(m.id)}"><img alt="صورة" src="data:${esc(m.type || 'image/jpeg')};base64,${m.img}" ${m.w ? `width="${m.w}" height="${m.h}"` : ''}></button>`
        : m.voice ? `<div class="chat-voice" data-vo="${esc(m.id)}"><button type="button" class="btn sm">▶ تشغيل</button><small>${ar(m.sec || 0)} ث</small></div>` : '';
      return `${sep}<div class="bub ${mine ? 'me' : 'them'}${m.id === '_0' ? ' first' : ''}">${m.id === '_0' && T.kind ? `<small class="bub-k">${esc(KIND[T.kind] || '')}</small>` : ''}${media}${m.text ? `<p>${esc(m.text)}</p>` : ''}<small class="bub-t">${hm(m.at)} ${tick}</small></div>`;
    }).join('');
    box.querySelectorAll('[data-img]').forEach((b) => (b.onclick = () => { const m = MS.find((x) => x.id === b.dataset.img); if (m) openLightbox(b64ToBlob(m.img, m.type || 'image/jpeg'), 'صورة من المحادثة'); }));
    box.querySelectorAll('[data-vo]').forEach((v) => (v.querySelector('button').onclick = () => {
      const m = MS.find((x) => x.id === v.dataset.vo); if (!m) return;
      const url = URL.createObjectURL(b64ToBlob(m.voice, m.type || 'audio/webm')); audioUrls.push(url);
      v.innerHTML = `<audio controls autoplay src="${url}"></audio>`;
    }));
    if (nearEnd) box.scrollTop = box.scrollHeight;
    first = false;
  };
  const closed = () => T && fbClosed(T);
  const paintFoot = () => {
    const f = $('.chat-foot'), tools = $('.chat-tools'); if (!f || !T) return;
    if (side === 't') {
      tools.innerHTML = closed() ? '<button type="button" class="btn sm" data-reopen>↺ إعادة فتح</button>' : '<button type="button" class="btn sm ghost" data-close-th>🔒 إغلاق</button>';
      tools.querySelector('[data-reopen]')?.addEventListener('click', () => store.updateFeedback(pn, fid, { closed: false, reopenAt: new Date().toISOString() }).then(() => toast('أُعيد فتح المحادثة.')).catch((e) => toast('تعذر: ' + (e.code || e.message))));
      tools.querySelector('[data-close-th]')?.addEventListener('click', () => store.updateFeedback(pn, fid, { closed: true }).then(() => toast('أُغلقت المحادثة.')).catch((e) => toast('تعذر: ' + (e.code || e.message))));
    }
    if (closed() && side === 's') {
      f.innerHTML = `<div class="chat-closed">🔒 أُغلقت هذه المحادثة${T.closed ? '' : ` لمرور ${ar(FB_CLOSE_DAYS)} أيام بلا رسائل`}. لموضوع جديد اكتب ملاحظة جديدة.</div>`;
      return;
    }
    if (f.dataset.ready) return; // لا نعيد بناء خانة الكتابة (حتى لا يضيع ما يكتبه)
    f.dataset.ready = '1';
    const Q = side === 't' ? (quick || QUICK_DEFAULT) : null;
    f.innerHTML = `${closed() ? '<div class="chat-closed sm">المحادثة مغلقة، وردّك يعيد فتحها.</div>' : ''}
      ${Q ? `<div class="chat-quick">${Q.map((q, i) => `<button type="button" class="chip" data-q="${i}">${esc(q.length > 34 ? q.slice(0, 34) + '…' : q)}</button>`).join('')}<button type="button" class="chip ghost" data-qe title="تعديل الردود الجاهزة">⚙︎</button></div>` : ''}
      <div class="chat-pend" hidden></div>
      <form class="chat-in"><label class="btn sm ghost chat-att" title="صورة">📷<input type="file" accept="image/*" hidden></label>
        <textarea rows="1" maxlength="1000" placeholder="اكتب رسالة…" aria-label="اكتب رسالة"></textarea>
        <button type="button" class="btn sm ghost chat-mic" title="رسالة صوتية">🎙️</button>
        <button type="submit" class="btn primary sm chat-send" aria-label="إرسال">➤</button></form>`;
    const ta = f.querySelector('textarea');
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); f.querySelector('form').requestSubmit(); } };
    f.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { ta.value = (ta.value ? ta.value + ' ' : '') + Q[+b.dataset.q]; ta.oninput(); ta.focus(); }));
    f.querySelector('[data-qe]')?.addEventListener('click', () => editQuick(Q));
    f.querySelector('input[type=file]').onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try { const c = await compressImage(file); pendImg = { ...c, url: URL.createObjectURL(c.blob) }; pendVoice = null; paintPend(); } catch (x) { toast(x.message); }
    };
    f.querySelector('.chat-mic').onclick = () => (rec ? rec.stop() : record());
    f.querySelector('form').onsubmit = (e) => { e.preventDefault(); send(); };
  };
  const paintPend = () => {
    const p = $('.chat-pend'); if (!p) return;
    p.hidden = !pendImg && !pendVoice && !rec;
    if (rec) { p.innerHTML = `<span class="rec-dot"></span> جارٍ التسجيل… <b class="rec-t">٠:٠٠</b> <button type="button" class="btn sm primary">⏹ إيقاف</button>`; p.querySelector('button').onclick = () => rec?.stop(); return; }
    p.innerHTML = pendImg ? `<img alt="" src="${pendImg.url}"><span class="small muted">صورة جاهزة للإرسال</span><button type="button" class="btn sm ghost">✕</button>`
      : pendVoice ? `<audio controls src="${pendVoice.url}"></audio><small>${ar(pendVoice.sec)} ث</small><button type="button" class="btn sm ghost">✕</button>` : '';
    p.querySelector('.ghost')?.addEventListener('click', () => { pendImg = pendVoice = null; paintPend(); });
  };
  async function record() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return toast('لم يُسمح باستخدام المايك. اسمح به من إعدادات المتصفح.'); }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
    const mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 }), parts = [], t0 = Date.now();
    rec = mr; pendImg = pendVoice = null; paintPend(); $('.chat-mic').textContent = '⏹';
    const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000), el = host.querySelector('.rec-t'); if (el) el.textContent = ar(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); if (s >= VOICE_MAX) mr.stop(); }, 250);
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); rec = null;
      const mic = $('.chat-mic'); if (mic) mic.textContent = '🎙️';
      const blob = new Blob(parts, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] }), sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
      if (blob.size > VOICE_BYTES) { toast('التسجيل كبير جداً. سجّل رسالة أقصر.'); paintPend(); return; }
      pendVoice = { blob, sec, url: URL.createObjectURL(blob) }; paintPend();
    };
    mr.start(1000);
  }
  async function send() {
    if (sending) return;
    const f = $('.chat-foot'), ta = f.querySelector('textarea'), text = ta.value.trim();
    if (!text && !pendImg && !pendVoice) { ta.focus(); return; }
    if (side === 's' && closed()) return;
    sending = true; const btn = f.querySelector('.chat-send'); btn.disabled = true;
    try {
      const m = { from: side, ...(text ? { text } : {}) };
      if (pendImg) Object.assign(m, { img: await blobToB64(pendImg.blob), type: 'image/jpeg', w: pendImg.w, h: pendImg.h });
      else if (pendVoice) Object.assign(m, { voice: await blobToB64(pendVoice.blob), type: pendVoice.blob.type || 'audio/webm', sec: pendVoice.sec });
      const thread = side === 't' ? { seen: true, tSeenAt: new Date().toISOString(), ...(T.closed && { closed: false }) } : {};
      const r = await store.addFbMsg(pn, fid, m, thread);
      ta.value = ''; ta.oninput(); pendImg = pendVoice = null; paintPend();
      if (!MS.some((x) => x.id === r.id)) { MS.push({ ...m, id: r.id, at: r.at }); Object.assign(T, thread, { lastAt: r.at, lastFrom: side }); paintMsgs(); }
      onSent && onSent({ ...m, id: r.id, at: r.at }, T);
    } catch (x) { toast('تعذر الإرسال: ' + (x.code || x.message)); }
    sending = false; btn.disabled = false;
  }
  function editQuick(Q) {
    const f = $('.chat-quick'); if (!f) return;
    f.innerHTML = `<div class="stack" style="gap:6px;width:100%"><small class="muted">الردود الجاهزة: سطر لكل رد (حتى ١٢)</small><textarea rows="5" maxlength="2000">${esc(Q.join('\n'))}</textarea>
      <div class="row"><button type="button" class="btn sm primary" data-qs>حفظ</button><button type="button" class="btn sm" data-qd>استرجاع الافتراضية</button></div></div>`;
    f.querySelector('[data-qd]').onclick = () => (f.querySelector('textarea').value = QUICK_DEFAULT.join('\n'));
    f.querySelector('[data-qs]').onclick = async () => {
      const L = f.querySelector('textarea').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
      try { await saveQuick?.(L); quick = L; toast('حُفظت الردود الجاهزة.'); } catch (e) { toast('تعذر الحفظ: ' + (e.code || e.message)); }
      const foot = $('.chat-foot'); delete foot.dataset.ready; paintFoot();
    };
  }
  const markRead = () => {
    if (!T || document.hidden || !host.isConnected) return;
    const L = msgList().filter((m) => m.from === other), last = L.length ? L[L.length - 1].at || '' : '';
    if (side === 's') {
      const patch = {};
      if (last && last > (T.sSeenAt || '')) patch.sSeenAt = new Date().toISOString();
      if (T.reply && !T.replySeen) patch.replySeen = true;
      if (Object.keys(patch).length) { Object.assign(T, patch); store.updateFeedback(pn, fid, patch).catch(() => {}); onState?.(T); }
    } else if (!T.seen || (last && last > (T.tSeenAt || ''))) {
      const patch = { seen: true, tSeenAt: new Date().toISOString() }; Object.assign(T, patch); store.updateFeedback(pn, fid, patch).catch(() => {}); onState?.(T);
    }
  };
  const vis = () => markRead();
  document.addEventListener('visibilitychange', vis);
  let off = store.watchFbThread(pn, fid, (t, ms) => {
    if (!host.isConnected) return stop();
    if (!t) { $('.chat-msgs').innerHTML = '<div class="empty">حُذفت هذه المحادثة.</div>'; $('.chat-foot').innerHTML = ''; return; }
    T = { ...t, pn, id: fid }; MS = ms; paintMsgs(); paintFoot(); markRead(); onState?.(T);
  });
  const ob = new MutationObserver(() => { if (!host.isConnected || host.closest('[hidden]')) stop(); });
  ob.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  function stop() {
    if (!off) return; off(); off = null; ob.disconnect(); document.removeEventListener('visibilitychange', vis);
    rec?.stop(); audioUrls.forEach((u) => URL.revokeObjectURL(u));
  }
  return stop;
}
const KIND = { comment: '💬 تعليق', complaint: '⚠️ شكوى', suggest: '💡 اقتراح', note: '📝 ملاحظة' };
