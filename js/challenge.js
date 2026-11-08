// التحدي الودّي بين زميلين من الصف نفسه: المقطع نفسه، تسميع غيباً، محاولة واحدة لكل منهما خلال ٤٨ ساعة.
// الفائز: الأدق، ثم الأسرع (كلمات في الدقيقة) عند التعادل. النقاط: الفائز ٣، والمشارك ١، والتعادل ٢ لكلٍّ منهما.
export const CH_HOURS = 48;
export const CH_DAILY = 3;
export const CH_DEFAULT_PTS = { win: 3, lose: 1, tie: 2 };
/** نقاط التحدي في لوحة الشرف: يضبطها المعلم (leaderboard/challengeCfg.pts)، وهذه قيمها الافتراضية */
export const CH_PTS = { ...CH_DEFAULT_PTS };
export function setChPts(p) {
  const n = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 20 ? Math.round(+v * 2) / 2 : d);
  Object.assign(CH_PTS, { win: n(p?.win, CH_DEFAULT_PTS.win), lose: n(p?.lose, CH_DEFAULT_PTS.lose), tie: n(p?.tie, CH_DEFAULT_PTS.tie) });
}

export const chStatus = (c, now = Date.now()) =>
  c.declined ? 'declined' : c.ra && c.rb ? 'done' : now > new Date(c.expiresAt).getTime() ? 'expired' : 'open';

/** الفائز: رقم الطالب، أو 'tie'، أو null (لم يُحسم/لا أحد) */
export function chWinner(c, now = Date.now()) {
  const st = chStatus(c, now);
  if (st === 'done') {
    const A = c.ra, B = c.rb;
    if (A.p !== B.p) return A.p > B.p ? c.a.pn : c.b.pn;
    if ((A.wpm || 0) !== (B.wpm || 0)) return (A.wpm || 0) > (B.wpm || 0) ? c.a.pn : c.b.pn;
    return 'tie';
  }
  if (st === 'expired') { if (c.ra && !c.rb) return c.a.pn; if (c.rb && !c.ra) return c.b.pn; }
  return null;
}

/** نقاط لوحة الشرف من التحديات المحسومة: [{pn, bonus, createdAt}] */
export function chBonus(list, now = Date.now()) {
  const out = [];
  list.forEach((c) => {
    const w = chWinner(c, now);
    if (!w) return;
    const at = [c.ra?.at, c.rb?.at].filter(Boolean).sort().pop() || c.expiresAt;
    if (w === 'tie') { out.push({ pn: c.a.pn, bonus: CH_PTS.tie, createdAt: at }, { pn: c.b.pn, bonus: CH_PTS.tie, createdAt: at }); return; }
    out.push({ pn: w, bonus: CH_PTS.win, createdAt: at });
    const other = w === c.a.pn ? c.b : c.a, r = w === c.a.pn ? c.rb : c.ra;
    if (r) out.push({ pn: other.pn, bonus: CH_PTS.lose, createdAt: at });
  });
  return out;
}

/** الطرف الآخر ونتيجتي ونتيجته من منظور الطالب pn */
export function chView(c, pn) {
  const mineA = c.a.pn === pn;
  return { me: mineA ? c.a : c.b, other: mineA ? c.b : c.a, mine: mineA ? c.ra : c.rb, theirs: mineA ? c.rb : c.ra, side: mineA ? 'ra' : 'rb', incoming: !mineA };
}

export function timeLeft(c, now = Date.now()) {
  const ms = new Date(c.expiresAt).getTime() - now;
  if (ms <= 0) return 'انتهى الوقت';
  const h = Math.floor(ms / 3600e3);
  return h >= 1 ? `يتبقى ${h} ساعة` : `يتبقى ${Math.max(1, Math.round(ms / 60e3))} دقيقة`;
}
