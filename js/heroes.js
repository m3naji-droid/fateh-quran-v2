// بطولة «الأبطال»: خروج المغلوب.
// المرحلة الأولى داخل كل صف حتى يبقى بطل واحد، ثم قرعة بين أبطال الصفوف حتى البطل.
// التقييم آلي فقط (دقة الكلمات)، والنصف نهائي والنهائي مباشران (١٠ دقائق) ويُحتسب فيهما تحليل التجويد الآلي.
import { ayahCount, surahName, toArabicDigits as ar } from './quran.js';

export const TIE_GAP = 1;            // فرق أقل من ١٪ = تعادل
export const LIVE_MIN = 10;          // نافذة النصف والنهائي بالدقائق
export const AI_PENALTY = 0.5;       // خصم كل ملاحظة تجويد آلية في النصف والنهائي
export const AI_MAX = 15;            // أقصى خصم
export const PTS = { classWin: 3, interWin: 5, classChamp: 5, third: 5, runnerUp: 8, champ: 15 };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** المقطع المفاجئ (النصف والثالث والنهائي) لا يُكشف قبل بدء المباراة */
export const isHidden = (m, now = Date.now()) => !!(m?.surprise && m.live && (!m.startAt || now < new Date(m.startAt).getTime()));
export const rangeText = (m, { reveal = false } = {}) => (!reveal && isHidden(m) ? `🎁 مقطع مفاجئ من ${ar(m.to - m.from + 1)} ${m.to - m.from + 1 <= 10 ? 'آيات' : 'آية'} يُكشف عند البدء`
  : `سورة ${surahName(m.surah)}${m.from === 1 && m.to === ayahCount(m.surah) ? '' : ` ${ar(m.from)}–${ar(m.to)}`}`);
export const kindLabel = (m) => (m.kind === 'final' ? 'النهائي' : m.kind === 'third' ? 'مباراة المركز الثالث' : m.kind === 'semi' ? 'نصف النهائي' : `الدور ${ar(m.round)}`);

/** المقاطع التي تلاها الطالب في البطولة (ومنها جولات التعادل) */
export function usedBy(matches, pn) {
  const out = [];
  matches.forEach((m) => { if (!m.bye && (m.a?.pn === pn || m.b?.pn === pn)) { out.push([m.surah, m.from, m.to]); (m.hist || []).forEach((h) => out.push([h.surah, h.from, h.to])); } });
  return out;
}
/** يختار مقطعاً من مجموعة سور البطولة: سورة عشوائية ثم n آية متتالية من موضع عشوائي، ويتجنب ما تلاه المتنافسان */
export function pickPassage(t, n, avoid = []) {
  const pool = (t.pool || []).filter((x) => x >= 1 && x <= 114);
  if (!pool.length) return { surah: 112, from: 1, to: 4 };
  n = Math.max(1, n | 0);
  const hit = (s, a, b) => avoid.some(([S, F, T]) => S === s && a <= T && F <= b);
  const cands = (s) => { const c = ayahCount(s); if (c <= n) return [[s, 1, c]]; return Array.from({ length: c - n + 1 }, (_, i) => [s, i + 1, i + n]); };
  const free = pool.map((s) => cands(s).filter((x) => !hit(...x))).filter((L) => L.length);
  const from = free.length ? free : pool.map(cands);
  const L = from[Math.floor(Math.random() * from.length)], [surah, a, b] = L[Math.floor(Math.random() * L.length)];
  return { surah, from: a, to: b };
}
/** عدد الآيات لمباراة: النهائي والثالث والنصف لكل منها رقمه، وغيرها رقم دورها */
export function countFor(t, round, kind) {
  if (kind === 'final') return t.finalN || 10;
  if (kind === 'third') return t.thirdN || t.semiN || 10;
  if (kind === 'semi') return t.semiN || 10;
  const c = t.counts || []; return c[round - 1] || c[c.length - 1] || 7;
}

/** جولة فاصلة عند التعادل: مقطع جديد بالطول نفسه (أو المقطع التالي/السورة التالية في البطولات القديمة) */
export function tiebreak(m, t = null, avoid = []) {
  const n = ayahCount(m.surah), len = m.to - m.from + 1;
  if (t?.pool?.length) return pickPassage(t, len, [...avoid, [m.surah, m.from, m.to]]);
  if (!(m.from === 1 && m.to === n) && m.to + len <= n) return { surah: m.surah, from: m.to + 1, to: m.to + len };
  let s = m.surah >= 114 ? 78 : m.surah + 1;
  const c = ayahCount(s);
  return { surah: s, from: 1, to: Math.min(c, Math.max(len, c <= 20 ? c : 10)) };
}

export const isLive = (m) => !!m.live;
/** الفائز: رقم الطالب، أو 'tie'، أو null */
export function matchWinner(m, now = Date.now()) {
  if (m.winner) return m.winner;
  if (m.bye || !m.b) return m.a.pn;
  const { ra, rb } = m;
  if (ra?.pend || rb?.pend) return null; // تسجيل لم يتعرف عليه الجهاز: ينتظر تقييم المعلم
  if (ra && rb) return Math.abs(ra.s - rb.s) < TIE_GAP ? 'tie' : ra.s > rb.s ? m.a.pn : m.b.pn;
  const end = m.live ? (m.startAt ? new Date(m.startAt).getTime() + (LIVE_MIN + 2) * 60e3 : Infinity) : new Date(m.deadline || 0).getTime();
  if (now > end) { if (ra && !rb) return m.a.pn; if (rb && !ra) return m.b.pn; }
  return null;
}
export const sideOf = (m, pn) => (m.a?.pn === pn ? 'a' : m.b?.pn === pn ? 'b' : null);

/** المباريات الأولى: كل صف على حدة، أزواج بالقرعة، والفرد يتأهل بالقرعة */
export function firstRound(t, students, now = new Date()) {
  const out = [];
  t.classIds.forEach((cid) => {
    const L = shuffle(students.filter((s) => s.classId === cid).map((s) => ({ pn: s.id, name: s.name, classId: cid })));
    pairUp(L, { t, round: 1, stage: 'class', classId: cid, now, byes: new Set() }).forEach((m) => out.push(m));
  });
  return out;
}
function roundCfg(t, round) { const r = t.rounds?.[round - 1] || t.rounds?.[t.rounds.length - 1]; return r ? { surah: r.surah, from: r.from, to: r.to } : { surah: 112, from: 1, to: 4 }; }
/** مقطع المباراة: في البطولات الجديدة لكل متنافسَين مقطعهما، وفي القديمة سورة الدور */
function passageFor(t, round, kind, a, b, used) {
  if (!t.pool?.length) return roundCfg(t, round);
  return pickPassage(t, countFor(t, round, kind), [...(used ? used(a?.pn) : []), ...(used && b ? used(b.pn) : [])]);
}
function pairUp(L, { t, round, stage, classId, now, byes, live = false, used = null }) {
  const out = [], list = [...L];
  const kind = live ? (list.length <= 2 ? 'final' : 'semi') : null;
  const sp = live && t.pool?.length ? { kind, surprise: true } : live ? { kind } : {};
  if (list.length % 2) { // القرعة: من لم يسترح من قبل
    const cand = list.filter((x) => !byes.has(x.pn));
    const pick = (cand.length ? cand : list)[Math.floor(Math.random() * (cand.length || list.length))];
    list.splice(list.indexOf(pick), 1);
    out.push({ id: rid(), round, stage, classId, slot: 999, a: pick, b: null, bye: true, done: true, winner: pick.pn, ...passageFor(t, round, kind, pick, null, null), createdAt: now.toISOString() });
  }
  for (let i = 0; i < list.length; i += 2) {
    out.push({ id: rid(), round, stage, classId, slot: i / 2, a: list[i], b: list[i + 1], ...passageFor(t, round, kind, list[i], list[i + 1], used), live, ...sp, startAt: null, deadline: live ? null : new Date(now.getTime() + (t.hours || 48) * 3600e3).toISOString(), ra: null, rb: null, tb: 0, hist: [], done: false, createdAt: now.toISOString() });
  }
  return out;
}

/**
 * يحرّك البطولة: يحسم المباريات المنتهية، ويُنشئ الدور التالي، ويتوّج البطل.
 * يعيد { updates:[{id,patch}], creates:[], tour:patch|null, events:[{type,...}] }
 */
export function advance(t, matches, now = new Date()) {
  const res = { updates: [], creates: [], tour: null, events: [] };
  if (t.status !== 'running') return res;
  const ms = now.getTime();
  const cur = Math.max(0, ...matches.map((m) => m.round));
  const roundM = matches.filter((m) => m.round === cur);
  // ١) حسم المباريات
  roundM.filter((m) => !m.done).forEach((m) => {
    const w = matchWinner(m, ms);
    if (w && w !== 'tie') { res.updates.push({ id: m.id, patch: { done: true, winner: w } }); m.done = true; m.winner = w; return; }
    if (w === 'tie') { // لم يُعِدها الطالب: نعيدها نحن
      const nx = tiebreak(m, t, [...usedBy(matches, m.a.pn), ...usedBy(matches, m.b.pn)]);
      res.updates.push({ id: m.id, patch: { ra: null, rb: null, tb: (m.tb || 0) + 1, hist: [...(m.hist || []), { surah: m.surah, from: m.from, to: m.to, ra: m.ra, rb: m.rb }], ...nx, ...(m.live ? { startAt: new Date(ms + 60e3).toISOString() } : { deadline: new Date(ms + 24 * 3600e3).toISOString() }) } });
      return;
    }
    const end = m.live ? (m.startAt ? new Date(m.startAt).getTime() + (LIVE_MIN + 2) * 60e3 : Infinity) : new Date(m.deadline).getTime();
    if (ms > end && !m.ra && !m.rb) {
      if (!m.ext && !m.live) { res.updates.push({ id: m.id, patch: { ext: true, deadline: new Date(ms + 24 * 3600e3).toISOString() } }); res.events.push({ type: 'ext', m }); }
      else { const w2 = Math.random() < 0.5 ? m.a.pn : m.b.pn; res.updates.push({ id: m.id, patch: { done: true, winner: w2, draw: true } }); m.done = true; m.winner = w2; }
    }
  });
  if (!roundM.length || roundM.some((m) => !m.done)) return res;
  // ٢) الدور التالي
  const winnerOf = (m) => (m.winner === m.a.pn ? m.a : m.b);
  const loserOf = (m) => (m.winner === m.a.pn ? m.b : m.a);
  const used = (pn) => usedBy(matches, pn);
  const thirdM = roundM.find((m) => m.third);
  const third = thirdM ? winnerOf(thirdM) : null;
  // بعد نصف النهائي (مباراتان مباشرتان): مباراة المركز الثالث بين الخاسرَين، مباشرة مع النهائي
  const semis = roundM.filter((m) => m.live && !m.bye && !m.third);
  const thirdMatch = () => {
    if (!t.pool?.length || semis.length !== 2) return [];
    const [a, b] = semis.map(loserOf);
    return [{ id: rid(), round: cur + 1, stage: semis[0].stage, classId: semis[0].classId, slot: 1, a, b, ...pickPassage(t, countFor(t, cur + 1, 'third'), [...used(a.pn), ...used(b.pn)]), live: true, kind: 'third', third: true, surprise: true, startAt: null, deadline: null, ra: null, rb: null, tb: 0, hist: [], done: false, createdAt: now.toISOString() }];
  };
  const byes = new Set(matches.filter((m) => m.bye).map((m) => m.a.pn));
  const stage = roundM[0].stage;
  if (stage === 'class') {
    const byClass = {};
    roundM.filter((m) => !m.third).sort((a, b) => a.slot - b.slot).forEach((m) => (byClass[m.classId] = byClass[m.classId] || []).push(winnerOf(m)));
    // صفوف حسمت بطلها قبل هذا الدور
    const champs = { ...(t.classChamps || {}) };
    Object.entries(byClass).forEach(([cid, L]) => { if (L.length === 1) champs[cid] = L[0]; });
    const going = Object.entries(byClass).filter(([, L]) => L.length > 1);
    if (going.length) {
      const total = going.reduce((n, [, L]) => n + L.length, 0) + Object.keys(champs).length;
      const liveNext = total <= 4 && t.classIds.length === 1;
      going.forEach(([cid, L]) => pairUp(L, { t, round: cur + 1, stage: 'class', classId: cid, now, byes, live: liveNext, used }).forEach((m) => res.creates.push(m)));
      if (liveNext && total === 2) thirdMatch().forEach((m) => res.creates.push(m));
      // أبطال الصفوف المحسومة يستريحون حتى تنتهي بقية الصفوف
      Object.entries(champs).filter(([cid]) => !byClass[cid] || byClass[cid].length === 1).forEach(([cid, c]) => res.creates.push({ id: rid(), round: cur + 1, stage: 'class', classId: cid, slot: 999, a: c, b: null, bye: true, wait: true, done: true, winner: c.pn, ...roundCfg(t, cur + 1), createdAt: now.toISOString() }));
      res.tour = { classChamps: champs };
      return res;
    }
    // كل الصفوف حسمت: قرعة النخبة
    res.tour = { classChamps: champs, stage: 'inter' };
    const L = shuffle(Object.values(champs));
    Object.values(champs).forEach((c) => res.events.push({ type: 'classChamp', who: c }));
    if (L.length === 1) { // صف واحد فقط: نهائي الصف هو النهائي
      const fin = roundM.find((m) => !m.bye && !m.third && m.winner === L[0].pn);
      const ru = fin ? (fin.winner === fin.a.pn ? fin.b : fin.a) : null;
      Object.assign(res.tour, { status: 'done', champion: L[0], runnerUp: ru, ...(third ? { third } : {}), doneAt: now.toISOString() }); res.events.push({ type: 'champ', who: L[0], runnerUp: ru, third }); return res;
    }
    res.events.push({ type: 'draw', list: L });
    pairUp(L, { t, round: cur + 1, stage: 'inter', classId: null, now, byes: new Set(), live: L.length <= 4, used }).forEach((m) => res.creates.push(m));
    return res;
  }
  // مرحلة النخبة
  const W = roundM.filter((m) => !m.third).sort((a, b) => a.slot - b.slot).map(winnerOf);
  if (W.length === 1) {
    const fin = roundM.find((m) => !m.bye && !m.third);
    const ru = fin ? (fin.winner === fin.a.pn ? fin.b : fin.a) : null;
    res.tour = { status: 'done', champion: W[0], runnerUp: ru, ...(third ? { third } : {}), doneAt: now.toISOString() };
    res.events.push({ type: 'champ', who: W[0], runnerUp: ru, third });
    return res;
  }
  pairUp(W, { t, round: cur + 1, stage: 'inter', classId: null, now, byes: new Set(roundM.filter((m) => m.bye).map((m) => m.a.pn)), live: W.length <= 4, used }).forEach((m) => res.creates.push(m));
  if (W.length === 2) thirdMatch().forEach((m) => res.creates.push(m));
  return res;
}

/** نقاط لوحة الشرف من البطولات */
export function heroBonus(tours, allMatches) {
  const out = [];
  tours.forEach((t) => {
    const ms = allMatches[t.id] || [];
    ms.filter((m) => m.done && !m.bye && !m.draw && m.winner).forEach((m) => out.push({ pn: m.winner, bonus: m.stage === 'inter' ? PTS.interWin : PTS.classWin, createdAt: m.ra?.at || m.rb?.at || m.createdAt }));
    Object.values(t.classChamps || {}).forEach((c) => out.push({ pn: c.pn, bonus: PTS.classChamp, createdAt: t.doneAt || t.createdAt }));
    if (t.champion) out.push({ pn: t.champion.pn, bonus: PTS.champ, createdAt: t.doneAt });
    if (t.runnerUp) out.push({ pn: t.runnerUp.pn, bonus: PTS.runnerUp, createdAt: t.doneAt });
    if (t.third) out.push({ pn: t.third.pn, bonus: PTS.third, createdAt: t.doneAt });
  });
  return out;
}

export const stageLabel = (t, matches) => {
  if (t.status === 'done') return '🏆 انتهت البطولة';
  const cur = Math.max(0, ...matches.map((m) => m.round)), rm = matches.filter((m) => m.round === cur && !m.bye);
  if (!rm.length) return '';
  const live = rm.some((m) => m.live), st = rm[0].stage;
  if (rm.some((m) => m.third)) return '🔥 النهائي ومباراة المركز الثالث';
  const left = rm.length * 2 + matches.filter((m) => m.round === cur && m.bye && !m.wait).length;
  if (live && left <= 2) return '🔥 النهائي';
  if (live) return '⚡ نصف النهائي';
  return st === 'inter' ? `🌍 النخبة: الدور ${ar(cur)}` : `🏫 تصفيات الصفوف: الدور ${ar(cur)}`;
};

const score = (r) => (r ? `${ar(Math.round(r.s * 10) / 10)}٪` : '—');
/** شجرة البطولة لمرحلة (صف أو النخبة) */
export function bracketHtml(matches, { stage, classId, me }) {
  const ms = matches.filter((m) => m.stage === stage && (stage === 'inter' || m.classId === classId) && !m.wait);
  const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
  if (!rounds.length) return '<div class="empty">لم تبدأ هذه المرحلة بعد.</div>';
  const card = (m) => {
    const w = m.done ? m.winner : null;
    const row = (p, r, side) => p ? `<div class="hb-p${w === p.pn ? ' win' : w ? ' lose' : ''}${p.pn === me ? ' me' : ''}"><span>${esc(p.name)}</span><b>${m.bye ? '' : score(r)}</b></div>` : '';
    return `<div class="hb-m${m.live ? ' live' : ''}${!m.done ? ' open' : ''}" data-mid="${esc(m.id)}">
      ${m.bye ? `${row(m.a)}<div class="hb-bye">تأهل بالقرعة</div>` : `${row(m.a, m.ra)}${row(m.b, m.rb)}`}
      ${!m.bye ? `<div class="hb-meta">${m.third ? '🥉 المركز الثالث · ' : m.kind === 'final' ? '🏆 النهائي · ' : ''}${m.live ? '📺 مباشر' : ''}${m.tb ? ` · ${ar(m.tb)} جولة فاصلة` : ''}${m.draw ? ' · حُسمت بالقرعة' : ''}${!m.done && !m.live ? ' · جارية' : ''}</div>` : ''}</div>`;
  };
  return `<div class="hb">${rounds.map((r) => `<div class="hb-col"><div class="hb-h">الدور ${ar(r)}</div>${ms.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot).map(card).join('')}</div>`).join('')}</div>`;
}
