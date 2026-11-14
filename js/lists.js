// قائمتان في لوحة الشرف:
// 🗡️ «المتحدي الأكبر»: أكثر الطلاب فوزاً في تحدّي الزملاء (حد أدنى ٣ تحديات سمّع فيها).
// 🌟 «صاحب الهمة العالية»: أكثر الطلاب تدرّباً: نقطة لكل آية صحيحة في التدريب (الآية حتى ٣ مرات يومياً،
//    وسقف ٢٠٠ نقطة يومياً)، ومن لا يعمل عنده التعرّف على الكلام: نقطة لكل دقيقة تلاوة (حتى ٣٠ يومياً).
//    وتُضاف إلى نقاط لوحة الشرف بنسبة نقطة لكل ١٠ نقاط همّة.
// لكل قائمة «هذا الشهر» و«منذ البداية»، وعلى مستوى المدرسة وكل صف، وأفضل ١٠ مع ترتيب الطالب نفسه.
import { chStatus, chWinner, chView } from './challenge.js';
import { ayahScores } from './mushaf.js';
import { toArabicDigits as ar } from './quran.js';

export const HM = { perAyah: 3, dayCap: 200, minCap: 30, okP: 80, ratio: 10, minCh: 3, top: 10 };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ymOf = (iso) => (iso || '').slice(0, 7);

/* ---------- جمع نقاط الهمة على جهاز الطالب (مع السقوف اليومية) ---------- */
function dayState(pn, day) {
  try { return JSON.parse(localStorage.getItem(`hm_${pn}_${day}`)) || { pts: 0, mins: 0, k: {} }; } catch { return { pts: 0, mins: 0, k: {} }; }
}
function saveState(pn, day, st) {
  try {
    localStorage.setItem(`hm_${pn}_${day}`, JSON.stringify(st));
    // تنظيف أيام قديمة
    Object.keys(localStorage).filter((k) => k.startsWith(`hm_${pn}_`) && k !== `hm_${pn}_${day}`).forEach((k) => localStorage.removeItem(k));
  } catch {}
}
/**
 * يحسب ما يستحقه تسميع تدريب: { pts, ayat, mins } بعد تطبيق السقوف، ويحدّث حالة اليوم.
 * sub: { surah, from, to, percent, statuses, duration }، srOK: هل يعمل التعرّف على الكلام
 */
export function earnHimma(pn, day, sub, srOK) {
  const st = dayState(pn, day);
  let pts = 0, ayat = 0, mins = 0;
  const room = () => HM.dayCap - st.pts - pts;
  const sc = ayahScores(sub).filter((x) => x.p >= HM.okP);
  if (sc.length) {
    sc.forEach(({ a }) => {
      const key = sub.surah + ':' + a;
      if ((st.k[key] || 0) >= HM.perAyah || room() <= 0) return;
      st.k[key] = (st.k[key] || 0) + 1; pts++; ayat++;
    });
  } else if (!srOK && sub.duration >= 60) {
    mins = Math.min(Math.floor(sub.duration / 60), HM.minCap - st.mins, Math.max(0, room()));
    if (mins > 0) { st.mins += mins; pts += mins; } else mins = 0;
  }
  st.pts += pts;
  saveState(pn, day, st);
  return { pts, ayat, mins };
}

/** نقاط الهمة في لوحة الشرف: نقطة لكل HM.ratio من نقاط الهمة، مؤرّخة بيومها */
export function himmaBonus(himma) {
  return (himma || []).filter((h) => h.hp > 0).map((h) => ({ pn: h.pn, bonus: Math.round((h.hp / HM.ratio) * 10) / 10, createdAt: h.d + 'T12:00:00+03:00' }));
}

/* ---------- حساب القائمتين (على جهاز المعلم، وتُنشر في لوحة الشرف) ---------- */
function rankList(rows, key, tie) {
  return rows.sort((a, b) => b[key] - a[key] || tie(a, b));
}
export function computeLists(challenges, himma, students, now = new Date()) {
  const ym = now.toISOString().slice(0, 7);
  const byPn = Object.fromEntries(students.map((s) => [s.id, s]));
  const out = { ch: {}, hm: {} }, ranks = {};
  const setRank = (pn, list, period, scope, r) => { ((ranks[pn] = ranks[pn] || {})[list] = ranks[pn][list] || {})[period + scope] = r; };
  for (const period of ['m', 'a']) {
    // المتحدي الأكبر
    const st = {};
    (challenges || []).forEach((c) => {
      if (period === 'm' && ymOf(c.createdAt) !== ym) return;
      const s0 = chStatus(c);
      if (s0 === 'open' || s0 === 'declined' || s0 === 'review') return;
      if (c.cancel?.free) return;
      const w = chWinner(c);
      [c.a, c.b].forEach((p) => {
        const v = chView(c, p.pn);
        if (!byPn[p.pn]) return;
        const x = (st[p.pn] = st[p.pn] || { pn: p.pn, wins: 0, played: 0, accSum: 0, seq: [] });
        if (!v.mine && w !== p.pn) return; // لم يسمّع ولم يفز
        x.played++; if (v.mine) x.accSum += v.mine.p || 0;
        if (w === p.pn) x.wins++;
        x.seq.push({ at: c.createdAt || '', win: w === p.pn });
      });
    });
    let rows = Object.values(st).filter((x) => x.played >= HM.minCh).map((x) => {
      let best = 0, cur = 0; x.seq.sort((a, b) => a.at.localeCompare(b.at)).forEach((s) => { cur = s.win ? cur + 1 : 0; best = Math.max(best, cur); });
      return { pn: x.pn, name: byPn[x.pn].name, classId: byPn[x.pn].classId, wins: x.wins, played: x.played, rate: Math.round((x.wins / x.played) * 100), acc: Math.round(x.accSum / x.played), streak: best };
    });
    rows = rankList(rows, 'wins', (a, b) => b.rate - a.rate || b.acc - a.acc || a.name.localeCompare(b.name, 'ar'));
    out.ch[period] = pack(rows, (r, scope, i) => setRank(r.pn, 'ch', period, scope, i + 1));
    // صاحب الهمة العالية
    const hs = {};
    (himma || []).forEach((h) => {
      if (period === 'm' && (h.d || '').slice(0, 7) !== ym) return;
      if (!byPn[h.pn] || !(h.hp > 0)) return;
      const x = (hs[h.pn] = hs[h.pn] || { pn: h.pn, pts: 0, ayat: 0, mins: 0, days: 0 });
      x.pts += h.hp || 0; x.ayat += h.ha || 0; x.mins += h.hm || 0; x.days++;
    });
    let hr = Object.values(hs).map((x) => ({ ...x, name: byPn[x.pn].name, classId: byPn[x.pn].classId }));
    hr = rankList(hr, 'pts', (a, b) => b.days - a.days || a.name.localeCompare(b.name, 'ar'));
    out.hm[period] = pack(hr, (r, scope, i) => setRank(r.pn, 'hm', period, scope, i + 1));
  }
  out.ym = ym;
  return { lists: out, ranks };
}
/** أفضل ١٠ على مستوى المدرسة وفي كل صف، مع ترتيب كل طالب */
function pack(rows, onRank) {
  const all = rows.slice(0, HM.top);
  rows.forEach((r, i) => onRank(r, 's', i));
  const byClass = {};
  rows.forEach((r) => (byClass[r.classId] = byClass[r.classId] || []).push(r));
  Object.values(byClass).forEach((L) => L.forEach((r, i) => onRank(r, 'c', i)));
  return { all, byClass: Object.fromEntries(Object.entries(byClass).map(([k, L]) => [k, L.slice(0, HM.top)])), n: rows.length };
}

/* ---------- العرض (للطالب والمعلم) ---------- */
/**
 * host: العنصر، lists: من computeLists، opts: { me, myClass, myRank (ranks[pn]), classes, onExport }
 */
export function mountLists(host, lists, { me = null, myClass = null, myRank = null, classes = [], onExport = null } = {}) {
  if (!lists) { host.innerHTML = ''; return; }
  const state = { ch: { p: 'm', sc: 's' }, hm: { p: 'm', sc: 's' } };
  const cname = (id) => classes.find((c) => c.id === id)?.name || '';
  const card = (kind) => {
    const S = state[kind], L = lists[kind]?.[S.p];
    const rows = !L ? [] : S.sc === 's' ? L.all : (L.byClass?.[myClass || S.cls] || []);
    const title = kind === 'ch' ? '🗡️ المتحدي الأكبر' : '🌟 صاحب الهمة العالية';
    const desc = kind === 'ch' ? `أكثر الطلاب فوزاً في تحدّي الزملاء (لمن خاض ${ar(HM.minCh)} تحديات فأكثر).` : `نقطة لكل آية صحيحة في التدريب، ونقطة لكل ١٠ منها تُضاف إلى لوحة الشرف.`;
    const mine = myRank?.[kind]?.[S.p + S.sc];
    const inTop = rows.some((r) => r.pn === me);
    const classPick = !myClass && S.sc === 'c' ? `<select data-cls="${kind}" class="small">${classes.map((c) => `<option value="${esc(c.id)}"${c.id === S.cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : '';
    const line = (r, i) => `<li class="${r.pn === me ? 'me' : ''}"><span class="lr-n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : ar(i + 1)}</span><span class="lr-name"><b>${esc(r.name)}</b>${S.sc === 's' ? `<small class="muted">${esc(cname(r.classId))}</small>` : ''}</span>
      <span class="lr-v">${kind === 'ch' ? `<b>${ar(r.wins)}</b> فوز <small class="muted">من ${ar(r.played)} · ${ar(r.rate)}٪${r.streak >= 2 ? ` · 🔥${ar(r.streak)}` : ''}</small>` : `<b>${ar(r.pts)}</b> نقطة <small class="muted">${r.ayat ? `${ar(r.ayat)} آية` : ''}${r.mins ? `${r.ayat ? ' · ' : ''}${ar(r.mins)} د` : ''} · ${ar(r.days)} يوم</small>`}</span></li>`;
    return `<div class="card lists-card stack" style="gap:8px" data-k="${kind}">
      <div class="row" style="justify-content:space-between;gap:6px"><h3 style="margin:0">${title}</h3>${onExport ? `<button class="btn sm ghost" type="button" data-x="${kind}">Excel</button>` : ''}</div>
      <p class="small muted" style="margin:0">${desc}</p>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <span class="seg"><button type="button" data-p="m" class="${S.p === 'm' ? 'on' : ''}">هذا الشهر</button><button type="button" data-p="a" class="${S.p === 'a' ? 'on' : ''}">منذ البداية</button></span>
        <span class="seg"><button type="button" data-sc="s" class="${S.sc === 's' ? 'on' : ''}">المدرسة</button><button type="button" data-sc="c" class="${S.sc === 'c' ? 'on' : ''}">${myClass ? 'صفّي' : 'الصف'}</button></span>${classPick}
      </div>
      ${rows.length ? `<ol class="lists-ol">${rows.map(line).join('')}</ol>` : `<div class="empty small">${kind === 'ch' ? 'لا أحد بعد. خُض ' + ar(HM.minCh) + ' تحديات لتدخل القائمة!' : 'لا نقاط بعد. تدرّب في «تدريب حر» لتدخل القائمة!'}</div>`}
      ${me && !inTop ? `<div class="small lists-me">${mine ? `ترتيبك: <b>${ar(mine)}</b>` : kind === 'ch' ? `لم تدخل القائمة بعد: تحتاج ${ar(HM.minCh)} تحديات سمّعت فيها.` : 'لم تجمع نقاط همّة في هذه الفترة بعد.'}</div>` : ''}
    </div>`;
  };
  const paint = () => {
    host.innerHTML = card('ch') + card('hm');
    host.querySelectorAll('.lists-card').forEach((el) => {
      const k = el.dataset.k;
      el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { state[k].p = b.dataset.p; paint(); }));
      el.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => { state[k].sc = b.dataset.sc; if (!myClass && !state[k].cls) state[k].cls = classes[0]?.id; paint(); }));
      const cs = el.querySelector('[data-cls]'); if (cs) cs.onchange = () => { state[k].cls = cs.value; paint(); };
      const x = el.querySelector('[data-x]'); if (x) x.onclick = () => onExport(k, state[k]);
    });
  };
  paint();
}
