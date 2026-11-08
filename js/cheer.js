// تشجيع المباريات المباشرة في «الأبطال»: الجمهور (كل طلاب المدرسة) يرسل إيموجي أو عبارة جاهزة
// لأحد المتنافسَين، فيطير الإيموجي على الشاشة وتمرّ العبارة في شريط أسفلها.
// يرى التشجيعَ الجمهورُ وشاشةُ العرض، ويراه المتنافس قبل بدء المباراة فقط (لا يتشتت أثناء تلاوته).
// الإيموجي والعبارات يختارها المعلم (leaderboard/cheerCfg)، ويُرسل الطالب رقمها فقط لا نصاً حراً.
import { store } from './store.js';
import { toArabicDigits as ar } from './quran.js';

export const CHEER_DEFAULT = {
  emojis: ['👏', '🔥', '💪', '🤲', '⭐'],
  phrases: ['ما شاء الله تبارك الله', 'بارك الله فيك', 'ثبّتك الله', 'أحسنت يا بطل', 'اللهم يسّر'],
};
export const CHEER_MAX = 8, PHRASE_MAX = 40, PHRASE_BASE = 100, GAP_MS = 3000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let cfgCache = null;
export async function cheerCfg(fresh = false) {
  if (cfgCache && !fresh) return cfgCache;
  let c = null;
  try { c = await store.getCheerCfg(); } catch {}
  cfgCache = cleanCfg(c);
  return cfgCache;
}
export function cleanCfg(c) {
  const em = (Array.isArray(c?.emojis) ? c.emojis : CHEER_DEFAULT.emojis).map((x) => String(x).trim()).filter(Boolean).slice(0, CHEER_MAX);
  const ph = (Array.isArray(c?.phrases) ? c.phrases : CHEER_DEFAULT.phrases).map((x) => String(x).trim().slice(0, PHRASE_MAX)).filter(Boolean).slice(0, CHEER_MAX);
  return { emojis: em.length ? em : CHEER_DEFAULT.emojis, phrases: ph, off: !!c?.off };
}
export function setCfgCache(c) { cfgCache = cleanCfg(c); }

/** يفصل نص الإيموجي إلى رموز (يحترم الإيموجي المركّب) */
export function splitEmojis(text) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(text)].map((x) => x.segment) : Array.from(text);
  return seg.map((x) => x.trim()).filter((x) => x && !/^[\s,،]+$/.test(x));
}

/**
 * يركّب التشجيع في host.
 * opts: { tid, m (المباراة), me ({id,name}) أو null, canSend, compact (شاشة المتنافس), big (شاشة العرض) }
 * يعيد دالة الإيقاف.
 */
export function mountCheer(host, { tid, m, me = null, canSend = false, big = false, title = true }) {
  let cfg = cfgCache || cleanCfg(null), alive = true, to = 'a', lastSend = 0;
  const seen = new Map(); let first = true;
  host.classList.add('cheer-box'); if (big) host.classList.add('big');
  host.innerHTML = `${title ? '<div class="ch-head"><b>🎉 شجّع زميلك</b><span class="small muted" data-cnt></span></div>' : '<div class="ch-head" style="justify-content:flex-end"><span class="small" data-cnt></span></div>'}
    <div class="cheer-fly" aria-hidden="true"></div>
    <div class="cheer-feed" aria-live="polite"></div>
    ${canSend ? '<div class="cheer-send"><div class="cheer-to" role="radiogroup"></div><div class="cheer-em"></div><div class="cheer-ph"></div></div>' : ''}`;
  const fly = host.querySelector('.cheer-fly'), feed = host.querySelector('.cheer-feed'), cnt = host.querySelector('[data-cnt]');
  const name = (side) => (side === 'a' ? m.a?.name : m.b?.name) || '';
  const paintSend = () => {
    if (!canSend) return;
    host.querySelector('.cheer-to').innerHTML = ['a', 'b'].map((s) => `<button type="button" role="radio" aria-checked="${to === s}" class="chip${to === s ? ' on' : ''}" data-to="${s}">${esc(name(s))}</button>`).join('');
    host.querySelector('.cheer-em').innerHTML = cfg.emojis.map((e, i) => `<button type="button" class="cheer-e" data-k="${i}" aria-label="أرسل ${esc(e)}">${esc(e)}</button>`).join('');
    host.querySelector('.cheer-ph').innerHTML = cfg.phrases.map((p, i) => `<button type="button" class="chip" data-k="${PHRASE_BASE + i}">${esc(p)}</button>`).join('');
    host.querySelectorAll('[data-to]').forEach((b) => (b.onclick = () => { to = b.dataset.to; paintSend(); }));
    host.querySelectorAll('[data-k]').forEach((b) => (b.onclick = async () => {
      const now = Date.now();
      if (now - lastSend < GAP_MS) { b.classList.add('wait'); setTimeout(() => b.classList.remove('wait'), 400); return; }
      lastSend = now;
      const k = +b.dataset.k;
      show({ name: me?.name || '', to, k }, true);
      try { await store.sendCheer(tid, m.id, me.id, me.name, to, k); } catch (e) { console.warn('cheer', e); }
    }));
  };
  const show = (c, mine = false) => {
    if (c.k < PHRASE_BASE) {
      const e = cfg.emojis[c.k]; if (!e) return;
      const s = document.createElement('span'); s.className = 'cheer-float'; s.textContent = e;
      s.style.insetInlineStart = (c.to === 'a' ? 8 + Math.random() * 34 : 56 + Math.random() * 34) + '%';
      s.style.animationDuration = (2.4 + Math.random() * 1.2) + 's';
      fly.appendChild(s); setTimeout(() => s.remove(), 4000);
    } else {
      const p = cfg.phrases[c.k - PHRASE_BASE]; if (!p) return;
      const d = document.createElement('div'); d.className = 'cheer-line' + (mine ? ' mine' : '');
      d.innerHTML = `<b>${esc(c.name)}</b> ← ${esc(name(c.to))}: «${esc(p)}»`;
      feed.prepend(d);
      while (feed.children.length > (big ? 4 : 3)) feed.lastChild.remove();
      setTimeout(() => d.classList.add('old'), 6000);
    }
  };
  const off = store.watchCheers(tid, m.id, (L) => {
    if (!alive) return;
    let na = 0, nb = 0;
    L.forEach((c) => {
      na += c.na || 0; nb += c.nb || 0;
      const prev = seen.get(c.pn);
      if (!first && (prev == null || (c.seq || 0) > prev) && c.pn !== me?.id) show(c);
      seen.set(c.pn, c.seq || 0);
    });
    first = false;
    if (cnt) cnt.textContent = na + nb ? `📣 ${name('a')}: ${ar(na)} · ${name('b')}: ${ar(nb)}` : '';
  });
  cheerCfg().then((c) => { cfg = c; if (alive) paintSend(); });
  paintSend();
  return () => { alive = false; off?.(); host.innerHTML = ''; host.classList.remove('cheer-box', 'big'); };
}
