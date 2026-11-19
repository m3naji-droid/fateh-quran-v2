// صفحة التقارير: فلتر زمني موحّد، ومؤشرات بمقارنة، وتقدّم الصفوف، وعدّاد الإنجاز، ومصفوفة الواجبات،
// والنجوم الصاعدة، ومقارنة الطالب بنفسه، والتقرير الشهري، وتصدير Excel شامل، ووضع العرض في الحصة.
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]).replace(/(\S)\.(\S)/g, '$1٫$2');
const num = (n) => ar(Math.round(n).toLocaleString('en-US').replace(/,/g, '٬'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const COLORS = ['#0d5c46', '#c08a1e', '#2f7fb5', '#b5512f', '#7a4fa0', '#4f8a3a', '#a33b6b', '#2a9d8f'];
const ayatOf = (x) => Math.max(0, (+x.to || 0) - (+x.from || 0) + 1);
/** ثواني التلاوة: وقت التدريب الحر المسجَّل (أو دقائقه القديمة) + مدة التسميعات */
const trainSec = (him, subs) => him.reduce((a, h) => a + (h.hs != null ? h.hs : (h.hm || 0) * 60), 0) + subs.reduce((a, x) => a + Math.min(1800, +x.duration || 0), 0);
const avg = (L) => (L.length ? L.reduce((a, b) => a + b, 0) / L.length : null);
const bhDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(ms));
const ymOf = (ms) => bhDay(ms).slice(0, 7);
const ymLabel = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ar(ym.slice(0, 4))}`;
const dLabel = (ms) => { const [y, m, d] = bhDay(ms).split('-'); return `${ar(+d)} ${MONTHS[+m - 1]}`; };
// حدود زمنية بتوقيت البحرين
const atBh = (y, m, d = 1) => Date.parse(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+03:00`);
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return { from: atBh(y, m), to: m === 12 ? atBh(y + 1, 1) : atBh(y, m + 1) }; };
const prevYm = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

export function mountReports(body, X) {
  const { D, pref, toast, openModal, closeModal, confirmBox, className, surahName, subScore, taskFor, taskStarted, taskClosed, taskEnd, normSegs, khDone } = X;
  const R = { per: 'month', from: '', to: '', cls: 'all', cmp: true, ...(pref.get('repF', {}) || {}) };
  const save = () => pref.set('repF', R);
  const stu = (pn) => D.students.find((s) => s.id === pn);
  const clsOf = (pn) => stu(pn)?.classId;
  const tms = (x) => Date.parse(x.createdAt || '') || 0;

  /* ---------- الفترة ---------- */
  function period() {
    const now = Date.now(), today = bhDay(now), [y, m, d] = today.split('-').map(Number);
    let from, to = now, label, prev;
    if (R.per === 'week') {
      const dow = new Date(atBh(y, m, d) + 3 * 3600e3).getUTCDay(); // ٠ = الأحد
      from = atBh(y, m, d) - dow * DAY; label = 'هذا الأسبوع'; prev = { from: from - 7 * DAY, to: to - 7 * DAY };
    } else if (R.per === 'term') {
      const ty = m >= 9 ? y : m === 1 ? y - 1 : y, tm = m >= 9 || m === 1 ? 9 : 2;
      from = atBh(ty, tm); label = 'الفصل الدراسي'; const len = to - from; prev = { from: from - len, to: from };
    } else if (R.per === 'custom' && R.from && R.to) {
      from = Date.parse(R.from + 'T00:00:00+03:00'); to = Math.min(now, Date.parse(R.to + 'T23:59:59+03:00') + 1000); label = 'فترة مخصصة';
      const len = to - from; prev = { from: from - len, to: from };
    } else if (R.per === 'all') {
      from = 0; label = 'منذ البداية'; prev = null;
    } else {
      from = atBh(y, m); label = 'هذا الشهر';
      const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
      prev = { from: atBh(py, pm), to: Math.min(atBh(py, pm) + (to - from), atBh(y, m)) };
    }
    return { from, to, label, prev: R.cmp ? prev : null };
  }
  const studentsIn = (cls = R.cls) => D.students.filter((s) => cls === 'all' || s.classId === cls);
  const subsIn = (p, cls = R.cls) => D.subs.filter((x) => { const t = tms(x); return t >= p.from && t < p.to && (cls === 'all' || x.classId === cls || (!x.classId && clsOf(x.pn) === cls)); });
  const himIn = (p, cls = R.cls) => (D.himma || []).filter((h) => { const t = Date.parse(h.d + 'T12:00:00+03:00'); return t >= p.from && t < p.to && (cls === 'all' || clsOf(h.pn) === cls); });
  const accOf = (L) => { const a = avg(L.filter((x) => x.percent != null).map((x) => x.percent)); return a == null ? null : Math.round(a); };
  /** واجبات كانت مفتوحة في الفترة، وطلابها، ومن سلّم */
  function taskStats(p, cls = R.cls) {
    const S = studentsIn(cls), done = new Set(D.subs.filter((x) => x.taskId).map((x) => x.pn + '|' + x.taskId));
    let exp = 0, got = 0;
    D.tasks.forEach((t) => {
      const st = Date.parse(t.startAt || t.createdAt || '') || 0, en = Date.parse(taskEnd(t) || '') || Infinity;
      if (st >= p.to || en < p.from || !taskStarted(t)) return;
      S.forEach((s) => { if (!taskFor(t, s)) return; if ((s.accountAt || s.createdAt || '') > (taskEnd(t) || '9')) return; if (!taskClosed(t) && !done.has(s.id + '|' + t.id)) return; exp++; if (done.has(s.id + '|' + t.id)) got++; });
    });
    return { exp, got, rate: exp ? Math.round((got / exp) * 100) : null };
  }
  function kpis(p, cls = R.cls) {
    const subs = subsIn(p, cls), him = himIn(p, cls), S = studentsIn(cls);
    const act = new Set([...subs.map((x) => x.pn), ...him.filter((h) => h.hp || h.ha).map((h) => h.pn)]);
    return {
      acc: accOf(subs), rate: taskStats(p, cls).rate,
      ayat: subs.reduce((a, x) => a + ayatOf(x), 0) + him.reduce((a, h) => a + (h.ha || 0), 0),
      active: S.length ? Math.round((S.filter((s) => act.has(s.id)).length / S.length) * 100) : null, actN: S.filter((s) => act.has(s.id)).length, S: S.length,
      mins: Math.round(trainSec(him, subs) / 60), subs: subs.length, any: subs.length + him.length > 0,
    };
  }
  const delta = (a, b, unit = '', inv = false) => {
    if (a == null || b == null) return '';
    const d = Math.round(a - b); if (!d) return '<span class="rp-eq">= كما كان</span>';
    const good = inv ? d < 0 : d > 0;
    return `<span class="${good ? 'rp-up' : 'rp-dn'}">${d > 0 ? '▲' : '▼'} ${ar(Math.abs(d).toLocaleString('en-US').replace(/,/g, '٬'))}${unit}</span>`;
  };
  /** أسابيع الفترة (من الأقدم) */
  const weeks = (p) => { const L = [], from = p.from || Math.min(...D.subs.map(tms).filter(Boolean), Date.now()); for (let a = from; a < p.to && L.length < 26; a += 7 * DAY) L.push({ from: a, to: Math.min(a + 7 * DAY, p.to) }); return L; };

  /* ---------- رسوم SVG (الزمن من اليمين إلى اليسار) ---------- */
  function lineChart(series, labels, { h = 220, big = false } = {}) {
    const W = 760, P = big ? 50 : 50, n = labels.length, top = 16, bot = h - (big ? 40 : 30);
    const vals = series.flatMap((s) => s.vals).filter((v) => v != null);
    if (!vals.length) return '<div class="rp-none">لا توجد بيانات كافية في هذه الفترة.</div>';
    let lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 10) * 10); if (hi - lo < 20) lo = Math.max(0, hi - 20);
    const X = (i) => (n === 1 ? W / 2 : W - P - (i * (W - 2 * P)) / (n - 1)), Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
    const fs = big ? 20 : 19, sw = big ? 5 : 4;
    let g = '';
    [lo, (lo + hi) / 2, hi].forEach((v) => (g += `<line x1="${P - 10}" x2="${W - P + 10}" y1="${Y(v)}" y2="${Y(v)}" class="rp-grid"/><text x="${W - 4}" y="${Y(v) + 4}" class="rp-ax" text-anchor="end">${ar(Math.round(v))}</text>`));
    const step = Math.ceil(n / (big ? 6 : 7));
    labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${X(i)}" y="${h - 8}" class="rp-ax" text-anchor="middle">${esc(l)}</text>`; });
    series.forEach((s) => {
      let d = '', pen = false;
      s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)} `; pen = true; });
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      s.vals.forEach((v, i) => { if (v != null && (i === s.vals.length - 1 || s.vals[i + 1] == null || s.vals[i - 1] == null)) g += `<circle cx="${X(i)}" cy="${Y(v)}" r="${big ? 8 : 5}" fill="${s.color}"><title>${esc(s.name)}: ${ar(v)}٪</title></circle>`; });
    });
    return `<svg viewBox="0 0 ${W} ${h}" class="rp-svg" direction="ltr" style="--fs:${fs}px" role="img">${g}</svg>`;
  }
  const legend = (series, last = true) => `<div class="rp-lg">${series.map((s) => { const v = [...s.vals].reverse().find((x) => x != null); return `<span><i style="background:${s.color}"></i>${esc(s.name)}${last && v != null ? `: <b>${ar(v)}٪</b>` : ''}</span>`; }).join('')}</div>`;
  function classProgress(p, big = false) {
    const W = weeks(p), cls = R.cls === 'all' ? D.classes : D.classes.filter((c) => c.id === R.cls);
    const series = cls.map((c, i) => ({ name: c.name, color: COLORS[i % COLORS.length], vals: W.map((w) => accOf(subsIn(w, c.id))) })).filter((s) => s.vals.some((v) => v != null));
    const labels = W.map((w, i) => (W.length <= 6 ? `الأسبوع ${ar(i + 1)}` : dLabel(w.from)));
    return { svg: lineChart(series, labels, { big, h: big ? 360 : 300 }), lg: legend(series) };
  }

  /* ---------- عدّاد الإنجاز ---------- */
  function achieve(p) {
    const subs = subsIn(p), him = himIn(p);
    const ayS = subs.reduce((a, x) => a + ayatOf(x), 0), ayH = him.reduce((a, h) => a + (h.ha || 0), 0);
    const mins = trainSec(him, subs) / 60;
    const ch = (D.challenges || []).filter((c) => { const t = Date.parse(c.createdAt || '') || 0; return t >= p.from && t < p.to && !c.cancel && (R.cls === 'all' || clsOf(c.a?.pn) === R.cls || clsOf(c.b?.pn) === R.cls); }).length;
    const kh = (D.khatmas || []).filter((k) => { const t = Date.parse(k.createdAt || '') || 0; return t < p.to && (R.cls === 'all' || !k.classId || k.classId === R.cls || (k.classIds || []).includes(R.cls)) && k.segs && khDone(k) >= normSegs(k.segs).length; }).length;
    const byCls = D.classes.map((c) => ({ c, n: subsIn(p, c.id).reduce((a, x) => a + ayatOf(x), 0) + himIn(p, c.id).reduce((a, h) => a + (h.ha || 0), 0) })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    return { ayat: ayS + ayH, ayS, ayH, hours: mins / 60, ch, kh, byCls, subs: subs.length };
  }
  const achHtml = (A, p, big = false) => `<div class="rp-ach${big ? ' big' : ''}">
      <div><b>${num(A.ayat)}</b><span>آية مسمَّعة ومتدرَّب عليها</span></div>
      <div><b>${ar(A.hours < 10 ? A.hours.toFixed(1) : Math.round(A.hours))}</b><span>ساعة تلاوة وتدريب</span></div>
      <div><b>${num(A.subs)}</b><span>تسميعاً أُرسل</span></div>
      <div><b>${num(A.ch)}</b><span>تحدٍّ بين الزملاء</span></div></div>
    <p class="rp-ach-n">≈ ما يعادل ${ar((A.ayat / 6236).toFixed(1))} ختمة للمصحف${A.kh ? `، ومعها ${ar(A.kh)} ${A.kh === 1 ? 'ختمة جماعية مكتملة' : 'ختمات جماعية مكتملة'}` : ''}.</p>`;
  const barsHtml = (rows, fmt = num) => { const mx = Math.max(1, ...rows.map((r) => r.n)); return rows.map((r) => `<div class="rp-bar"><span>${esc(r.label)}</span><div><i style="width:${Math.max(2, (r.n / mx) * 100)}%"></i></div><b>${fmt(r.n)}</b></div>`).join(''); };

  /* ---------- المصفوفة ---------- */
  let matCls = R.cls !== 'all' ? R.cls : (D.classes[0]?.id || '');
  function matrix(p, cls) {
    const S = studentsIn(cls).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const T = D.tasks.filter((t) => { const st = Date.parse(t.startAt || t.createdAt || '') || 0, en = Date.parse(taskEnd(t) || '') || Infinity; return st < p.to && en >= p.from && S.some((s) => taskFor(t, s)); })
      .sort((a, b) => (a.startAt || a.createdAt || '').localeCompare(b.startAt || b.createdAt || '')).slice(-12);
    const best = new Map();
    D.subs.forEach((x) => { if (!x.taskId) return; const k = x.pn + '|' + x.taskId, sc = subScore(x); const o = best.get(k); if (!o || (sc ?? -1) > (o.sc ?? -1)) best.set(k, { x, sc }); });
    const rows = S.map((s) => {
      let n = 0, d = 0; const scs = [];
      const cells = T.map((t) => {
        if (!taskFor(t, s)) return { k: 'na' };
        const b = best.get(s.id + '|' + t.id);
        if (b) { n++; d++; const v = b.sc == null ? null : Math.round(b.sc * 10); if (v != null) scs.push(v); return { k: v == null ? 'a' : v >= 85 ? 'a' : v >= 70 ? 'b' : 'x', v, x: b.x }; }
        if (!taskStarted(t)) return { k: 'o', t: 'لم يبدأ' };
        if (!taskClosed(t)) return { k: 'w', t: 'لم يسلّم بعد' };
        n++;
        return { k: 'x', t: 'لم يسلّم' };
      });
      return { s, cells, n, d, avg: scs.length ? Math.round(avg(scs)) : null };
    });
    const colAvg = T.map((t, i) => { const v = rows.map((r) => r.cells[i].v).filter((v) => v != null); return v.length ? Math.round(avg(v)) : null; });
    return { S, T, rows, colAvg };
  }
  const tTitle = (t) => { const s = String(t.title || 'واجب'); return s.length > 22 ? s.slice(0, 22) + '…' : s; };
  function matrixHtml(M, { hideWeak = false } = {}) {
    if (!M.T.length) return '<div class="rp-none">لا توجد واجبات لهذا الصف في الفترة المختارة.</div>';
    if (!M.S.length) return '<div class="rp-none">لا يوجد طلاب في هذا الصف.</div>';
    return `<div class="rp-mx-w"><table class="rp-mx"><thead><tr><th></th>${M.T.map((t) => `<th title="${esc(t.title)}">${esc(tTitle(t))}</th>`).join('')}<th>الإنجاز</th></tr></thead><tbody>
      ${M.rows.map((r, ri) => { const weak = (r.n && r.d / r.n < 0.6) || (r.avg != null && r.avg < 70); return `<tr><td class="rp-nm">${hideWeak && weak ? '<span class="muted">طالب</span>' : esc(r.s.name)}</td>${r.cells.map((c, ci) => c.k === 'na' ? '<td><span class="rp-c na">—</span></td>' : `<td><span class="rp-c ${c.k}"${c.x ? ` data-mx="${ri}|${ci}" role="button" tabindex="0"` : ''}>${c.v != null ? ar(c.v) : c.t || '✓'}</span></td>`).join('')}
        <td class="rp-done ${r.n && r.d === r.n ? 'full' : r.n && r.d / r.n < 0.6 ? 'low' : ''}">${ar(r.d)}/${ar(r.n)}${r.n && r.d === r.n ? ' ⭐' : ''}</td></tr>`; }).join('')}
      <tr class="rp-avg"><td class="rp-nm">متوسط الصف</td>${M.colAvg.map((v) => `<td>${v == null ? '—' : ar(v)}</td>`).join('')}<td></td></tr></tbody></table></div>
      <div class="rp-lg"><span><i class="a"></i>٨٥ فأعلى</span><span><i class="b"></i>٧٠–٨٤</span><span><i class="x"></i>أقل من ٧٠ أو لم يسلّم</span><span><i class="w"></i>مفتوح، لم يسلّم بعد</span><span><i class="o"></i>لم يبدأ</span><span class="muted">الدرجة من ١٠٠ (درجتك إن قيّمت، وإلا الآلية)</span></div>`;
  }

  /* ---------- النجوم الصاعدة ---------- */
  function rising(p) {
    if (!p.prev) return [];
    const out = [];
    studentsIn().forEach((s) => {
      const A = D.subs.filter((x) => x.pn === s.id), H = (D.himma || []).filter((h) => h.pn === s.id);
      const part = (q) => { const sb = A.filter((x) => { const t = tms(x); return t >= q.from && t < q.to; }), hb = H.filter((h) => { const t = Date.parse(h.d + 'T12:00:00+03:00'); return t >= q.from && t < q.to; });
        const au = sb.filter((x) => x.percent != null); return { acc: au.length >= 2 ? Math.round(avg(au.map((x) => x.percent))) : null, days: new Set([...sb.map((x) => bhDay(tms(x))), ...hb.filter((h) => h.hp || h.ha).map((h) => h.d)]).size, ayat: sb.reduce((a, x) => a + ayatOf(x), 0) + hb.reduce((a, h) => a + (h.ha || 0), 0) }; };
      const now = part(p), was = part(p.prev);
      const dA = now.acc != null && was.acc != null ? now.acc - was.acc : 0, dD = now.days - was.days, dY = now.ayat - was.ayat;
      const gain = dA + dD * 1.5 + dY / 25;
      if (gain >= 3 && (dA > 0 || dD > 0) && now.days >= 2 && was.days >= 1) out.push({ s, now, was, dA, dD, dY, gain });
    });
    return out.sort((a, b) => b.gain - a.gain).slice(0, 5);
  }
  const riseWhy = (r) => [r.dA > 0 && `الدقة من ${ar(r.was.acc)}٪ إلى ${ar(r.now.acc)}٪`, r.dD > 0 && `المواظبة من ${X.nWord(r.was.days, 'يوم', 'يومين', 'أيام', 'يوماً').replace(/^يوم$/, 'يوم واحد')} إلى ${X.nWord(r.now.days, 'يوم', 'يومين', 'أيام', 'يوماً')}`, r.dY > 30 && `${num(r.now.ayat)} آية بعد ${num(r.was.ayat)}`].filter(Boolean).join('، ');
  const riseBadge = (r) => (r.dA > 0 ? `+${ar(r.dA)} نقطة` : `+${ar(r.dD)} ${r.dD === 1 ? 'يوم' : r.dD === 2 ? 'يومان' : r.dD <= 10 ? 'أيام' : 'يوماً'}`);
  function spark(s, p) {
    const q = { from: p.prev.from, to: p.to }, W = weeks(q).slice(-8);
    const v = W.map((w) => accOf(D.subs.filter((x) => x.pn === s.id && tms(x) >= w.from && tms(x) < w.to)));
    const pts = v.map((y, i) => (y == null ? null : [110 - (i * 104) / Math.max(1, v.length - 1) - 3, 32 - ((y - 40) / 60) * 28])).filter(Boolean);
    return pts.length > 1 ? `<svg width="110" height="36" class="rp-spark"><polyline points="${pts.map((p) => p.map((n) => Math.max(2, Math.min(n, 108)).toFixed(1)).join(',')).join(' ')}"/></svg>` : '';
  }
  const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const av = (s) => `<span class="rp-av" style="--h:${hue(s.id)}">${esc((s.name || 'ط').trim()[0])}</span>`;
  const riseHtml = (L, big = false) => L.length ? L.map((r, i) => `<div class="rp-star${big ? ' big' : ''}"><b class="rp-rk">${['🥇', '🥈', '🥉'][i] || ar(i + 1)}</b>${av(r.s)}<div class="rp-st-m"><b>${esc(r.s.name)}</b> <small class="muted">${esc(className(r.s.classId))}</small><div class="small muted">${esc(riseWhy(r))}</div></div>${big ? '' : spark(r.s, period())}<b class="rp-up rp-gain">${riseBadge(r)}</b></div>`).join('')
    : '<div class="rp-none">لا يوجد تحسّن واضح بعد مقارنة بالفترة السابقة.</div>';

  /* ---------- مقارنة الطالب بنفسه ---------- */
  const thisYm = ymOf(Date.now());
  const SC = { pn: '', a: thisYm, b: prevYm(thisYm) };
  function selfData(pn, ym) {
    const r = monthRange(ym), sb = D.subs.filter((x) => x.pn === pn && tms(x) >= r.from && tms(x) < r.to), hb = (D.himma || []).filter((h) => h.pn === pn && h.d.startsWith(ym));
    const wk = [0, 1, 2, 3, 4].map((i) => accOf(sb.filter((x) => { const d = +bhDay(tms(x)).slice(8, 10); return Math.min(4, Math.floor((d - 1) / 7)) === i; })));
    const bySu = new Map(); sb.filter((x) => x.percent != null).forEach((x) => { const a = bySu.get(+x.surah) || []; a.push(x.percent); bySu.set(+x.surah, a); });
    const mis = new Map(); sb.forEach((x) => mis.set(+x.surah, (mis.get(+x.surah) || 0) + (x.mistakes || []).length));
    return { acc: accOf(sb), days: new Set([...sb.map((x) => bhDay(tms(x))), ...hb.filter((h) => h.hp || h.ha).map((h) => h.d)]).size,
      ayat: sb.reduce((a, x) => a + ayatOf(x), 0) + hb.reduce((a, h) => a + (h.ha || 0), 0), mis: sb.reduce((a, x) => a + (x.mistakes || []).length, 0), n: sb.length, wk, bySu, misSu: mis };
  }
  function selfHtml() {
    const S = studentsIn().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (!S.length) return '<div class="rp-none">لا يوجد طلاب.</div>';
    if (!S.some((s) => s.id === SC.pn)) SC.pn = (S.find((s) => D.subs.some((x) => x.pn === s.id)) || S[0]).id;
    const s = stu(SC.pn), A = selfData(SC.pn, SC.a), B = selfData(SC.pn, SC.b);
    const yms = []; for (let k = 0, y = thisYm; k < 12; k++, y = prevYm(y)) yms.push(y);
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    const kp = (l, a, b, unit, inv) => `<div class="rp-kpi"><small>${l}</small><b>${a == null ? '—' : ar(a) + (unit === '٪' ? '٪' : '')}</b>${delta(a, b, unit === '٪' ? ' نقاط' : unit, inv)} <span class="small muted">${b == null ? '' : `كان ${ar(b)}${unit === '٪' ? '٪' : ''}`}</span></div>`;
    // ملاحظة: أكبر تحسّن في سورة، وأكثر سورة تتكرر فيها الأخطاء
    let tip = '';
    let bestSu = null; A.bySu.forEach((v, su) => { const w = B.bySu.get(su); if (!w) return; const d = avg(v) - avg(w); if (d > 3 && (!bestSu || d > bestSu.d)) bestSu = { su, d, a: Math.round(avg(v)), b: Math.round(avg(w)) }; });
    const worst = [...A.misSu.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
    if (bestSu) tip += `أكبر تحسّن في سورة ${esc(surahName(bestSu.su))} (من ${ar(bestSu.b)}٪ إلى ${ar(bestSu.a)}٪)`;
    if (worst) tip += `${tip ? '، و' : ''}أكثر أخطائه هذا الشهر في سورة ${esc(surahName(worst[0]))} (${ar(worst[1])} ${worst[1] <= 10 ? 'أخطاء' : 'خطأً'})`;
    if (!A.n && !B.n) tip = 'لا توجد تسميعات لهذا الطالب في الشهرين المختارين.';
    const bars = () => {
      const W = 760, H = 190, bot = 150, top = 14, lo = 40, Y = (v) => bot - ((Math.max(lo, v) - lo) / (100 - lo)) * (bot - top);
      let g = ''; [50, 75, 100].forEach((v) => (g += `<line x1="0" x2="${W - 40}" y1="${Y(v)}" y2="${Y(v)}" class="rp-grid"/><text x="${W - 4}" y="${Y(v) + 4}" class="rp-ax" text-anchor="end">${ar(v)}</text>`));
      for (let i = 0; i < 5; i++) {
        const cx = W - 110 - i * 145;
        if (B.wk[i] != null) g += `<rect x="${cx - 2}" y="${Y(B.wk[i])}" width="34" height="${bot - Y(B.wk[i])}" rx="5" fill="var(--rp-old)"><title>${ar(B.wk[i])}٪</title></rect>`;
        if (A.wk[i] != null) g += `<rect x="${cx - 40}" y="${Y(A.wk[i])}" width="34" height="${bot - Y(A.wk[i])}" rx="5" fill="var(--green)"><title>${ar(A.wk[i])}٪</title></rect>`;
        g += `<text x="${cx - 4}" y="${H - 10}" class="rp-ax" text-anchor="middle">${i === 4 ? 'آخر الشهر' : 'الأسبوع ' + ar(i + 1)}</text>`;
      }
      return `<svg viewBox="0 0 ${W} ${H}" class="rp-svg" direction="ltr" style="--fs:19px" role="img">${g}</svg>`;
    };
    return `<div class="row rp-self-h">${av(s)}<select id="scP" style="flex:2 1 180px">${S.map((x) => opt(x.id, `${x.name}${R.cls === 'all' ? ' (' + className(x.classId) + ')' : ''}`, SC.pn)).join('')}</select>
        <select id="scA" style="flex:1 1 120px">${yms.map((y) => opt(y, ymLabel(y), SC.a)).join('')}</select><span class="muted small">مقابل</span><select id="scB" style="flex:1 1 120px">${yms.map((y) => opt(y, ymLabel(y), SC.b)).join('')}</select></div>
      <div class="rp-kpis">${kp('متوسط الدقة', A.acc, B.acc, '٪')}${kp('أيام المواظبة', A.days, B.days, ' أيام')}${kp('آيات مسمَّعة ومتدرَّب عليها', A.ayat, B.ayat, ' آية')}${kp('الأخطاء', A.mis, B.mis, ' أخطاء', true)}</div>
      <div class="row" style="justify-content:space-between;margin-top:10px"><b class="small">الدقة أسبوعاً بأسبوع</b><div class="rp-lg" style="margin:0"><span><i style="background:var(--green)"></i>${esc(ymLabel(SC.a))}</span><span><i style="background:var(--rp-old)"></i>${esc(ymLabel(SC.b))}</span></div></div>
      ${A.n || B.n ? bars() : ''}${tip ? `<p class="rp-tip">💡 ${tip}</p>` : ''}`;
  }

  /* ---------- أكثر الكلمات خطأً (للتقرير الشهري والعرض) ---------- */
  function topWords(subs, k = 6) {
    const m = new Map();
    subs.forEach((x) => (x.mistakes || []).forEach((e) => { const key = `${x.surah}:${e.a}:${e.w}`; const o = m.get(key) || { s: +x.surah, a: e.a, w: e.w, who: new Set() }; o.who.add(x.pn); m.set(key, o); }));
    return [...m.values()].filter((e) => e.w).sort((a, b) => b.who.size - a.who.size).slice(0, k);
  }

  /* ---------- الرسم ---------- */
  function draw() {
    const p = period(), K = kpis(p), P0 = p.prev ? kpis(p.prev) : null, P = P0?.any ? P0 : null;
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    const seg = [['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['term', 'الفصل'], ['all', 'منذ البداية'], ['custom', '📅 مخصص']];
    const kp = (l, v, pv, unit, fmt = (x) => ar(x)) => `<div class="rp-kpi"><small>${l}</small><b>${v == null ? '—' : fmt(v) + (unit === '٪' ? '٪' : '')}</b>${P ? delta(v, pv, unit === '٪' ? ' نقاط' : '') : ''}</div>`;
    const cp = classProgress(p), A = achieve(p), RS = rising(p);
    if (R.cls !== 'all') matCls = R.cls;
    if (!D.classes.some((c) => c.id === matCls)) matCls = D.classes[0]?.id || '';
    const M = matrix(p, matCls);
    // يحتاجون متابعة، ولم يُرسلوا في الفترة
    const S = studentsIn(), sub = subsIn(p);
    const need = S.map((s) => ({ s, a: accOf(sub.filter((x) => x.pn === s.id)) })).filter((x) => x.a != null && x.a < 70).sort((a, b) => a.a - b.a).slice(0, 10);
    const act = new Set([...sub.map((x) => x.pn), ...himIn(p).filter((h) => h.hp || h.ha).map((h) => h.pn)]);
    const silent = S.filter((s) => !act.has(s.id));
    // تنبيه التقرير الشهري: أول أسبوع من الشهر
    const lastYm = prevYm(thisYm), seenRep = pref.get('repSeen', '');
    const newRep = +bhDay(Date.now()).slice(8, 10) <= 10 && seenRep !== lastYm && D.subs.some((x) => ymOf(tms(x)) === lastYm);
    body.innerHTML = `<div class="rp">
      <div class="card rp-filter"><div class="row" style="justify-content:space-between;gap:10px">
        <div class="seg rp-seg" role="tablist">${seg.map(([k, l]) => `<button type="button" class="${R.per === k ? 'on' : ''}" data-per="${k}">${l}</button>`).join('')}</div>
        <div class="row" style="gap:8px"><select id="rpC">${opt('all', 'كل الصفوف', R.cls)}${D.classes.map((c) => opt(c.id, c.name, R.cls)).join('')}</select>
        <label class="chip-ck"><input type="checkbox" id="rpCmp" ${R.cmp ? 'checked' : ''}> مقارنة بالفترة السابقة</label></div></div>
        ${R.per === 'custom' ? `<div class="row" style="margin-top:10px;gap:8px"><label class="small">من <input type="date" id="rpF" value="${esc(R.from)}"></label><label class="small">إلى <input type="date" id="rpT" value="${esc(R.to)}"></label>
          ${[['7', 'آخر ٧ أيام'], ['30', 'آخر ٣٠ يوماً'], ['90', 'آخر ٩٠ يوماً']].map(([n, l]) => `<button type="button" class="chip" data-last="${n}">${l}</button>`).join('')}</div>` : ''}
        <div class="row" style="justify-content:space-between;margin-top:10px;gap:8px"><span class="small muted">يعرض: <b class="rp-ink">${p.from ? `${esc(dLabel(p.from))} – ${esc(dLabel(p.to - 1))}` : 'منذ البداية'}</b>، ${esc(className(R.cls))}${p.prev ? `، مقارنة بـ ${esc(dLabel(p.prev.from))} – ${esc(dLabel(p.prev.to - 1))}` : ''}</span>
        <span class="row" style="gap:6px"><button class="btn sm" type="button" id="rpX">⬇ Excel</button><button class="btn sm gold" type="button" id="rpShow">📺 اعرضها في الحصة</button></span></div></div>

      <div class="card rp-month${newRep ? ' new' : ''}"><div class="row" style="justify-content:space-between;gap:10px"><div><b>${newRep ? `🔔 تقرير شهر ${esc(ymLabel(lastYm))} جاهز` : '📄 التقرير الشهري'}</b><div class="small muted">ملخص شهر كامل في صفحة واحدة: الأرقام والأوائل والنجوم الصاعدة ومن يحتاج متابعة، تحفظه PDF أو ترسله للإدارة.</div></div>
        <div class="row" style="gap:6px"><select id="rpM">${(() => { const L = []; for (let k = 0, y = lastYm; k < 12; k++, y = prevYm(y)) L.push(y); return [thisYm, ...L].map((y) => opt(y, ymLabel(y) + (y === thisYm ? ' (حتى الآن)' : ''), newRep ? lastYm : pref.get('repM', lastYm))).join(''); })()}</select><button class="btn primary sm" type="button" id="rpMGo">عرض التقرير</button></div></div></div>

      <div class="rp-kpis">${kp('متوسط الدقة', K.acc, P?.acc, '٪')}${kp('نسبة تسليم الواجبات', K.rate, P?.rate, '٪')}${kp('آيات مسمَّعة ومتدرَّب عليها', K.ayat, P?.ayat, '', num)}${kp(`طلاب نشطون (${ar(K.actN)} من ${ar(K.S)})`, K.active, P?.active, '٪')}</div>

      <div class="card"><div class="row" style="justify-content:space-between"><h3>📈 تقدّم ${R.cls === 'all' ? 'الصفوف' : 'الصف'} أسبوعاً بأسبوع</h3><span class="small muted">متوسط الدقة</span></div>${cp.svg}${cp.lg}</div>
        <div class="card rp-ach-c"><h3>🌿 عدّاد الإنجاز</h3><p class="small muted" style="margin:-4px 0 10px">${esc(p.label)}${R.cls === 'all' ? '' : '، ' + esc(className(R.cls))}</p>${achHtml(A, p)}
          ${R.cls === 'all' && A.byCls.length > 1 ? `<div class="rp-bars">${barsHtml(A.byCls.map((x) => ({ label: x.c.name, n: x.n })))}</div>` : ''}
          <div class="row" style="gap:6px;margin-top:10px"><button class="btn sm" type="button" id="rpAchAnn">📢 انشره كإعلان</button></div></div>

      <div class="card"><div class="row" style="justify-content:space-between;gap:8px"><h3>🧩 مصفوفة الطلاب × الواجبات</h3>
        <div class="row" style="gap:6px">${R.cls === 'all' ? `<select id="rpMC">${D.classes.map((c) => opt(c.id, c.name, matCls)).join('')}</select>` : ''}
        <span class="small muted">${M.T.length ? `${ar(M.T.length)} ${M.T.length <= 10 ? 'واجبات' : 'واجباً'}، سلّم ${ar(M.rows.reduce((a, r) => a + r.d, 0))} من ${ar(M.rows.reduce((a, r) => a + r.n, 0))}` : ''}</span></div></div>
        ${matrixHtml(M)}
        ${M.T.length ? `<div class="row" style="gap:6px;margin-top:10px"><button class="btn sm" type="button" id="rpMxX">⬇ Excel</button><button class="btn sm" type="button" id="rpMxShow">📺 اعرضها في الحصة</button>${(() => { const n = M.rows.reduce((a, r) => a + r.cells.filter((c) => c.k === 'w').length, 0); return n ? `<button class="btn sm" type="button" id="rpRemind">🔔 ذكّر من لم يسلّم (${ar(n)})</button>` : ''; })()}</div>` : ''}</div>

      <div class="card"><h3>🚀 النجوم الصاعدة</h3><p class="small muted" style="margin:-4px 0 6px">أكثر الطلاب تحسّناً مقارنة بالفترة السابقة، لا أعلاهم درجة.</p>
          ${p.prev ? riseHtml(RS) : '<div class="rp-none">فعّل «مقارنة بالفترة السابقة» واختر فترة محددة لتظهر النجوم الصاعدة.</div>'}
          ${RS.length ? `<div class="row" style="gap:6px;margin-top:10px"><button class="btn sm gold" type="button" id="rpRsAnn">🎖️ كرّمهم في إعلان</button><button class="btn sm" type="button" id="rpRsCheer">💚 أرسل لكل واحد تهنئة</button></div>` : ''}</div>
        <div class="card stack" style="gap:8px"><h3>⚠️ يحتاجون متابعة${need.length + silent.length ? ` <span class="pill">${ar(need.length + silent.length)}</span>` : ''}</h3>
          ${need.length ? need.map((x) => `<div class="row" style="justify-content:space-between"><span>${esc(x.s.name)} <span class="small muted">${esc(className(x.s.classId))}</span></span><span class="pill ${x.a >= 60 ? 'warn' : 'bad'}">${ar(x.a)}٪</span></div>`).join('') : '<span class="muted">لا يوجد طالب متوسطه أقل من ٧٠٪ في هذه الفترة.</span>'}
          <h3 style="margin-top:8px">💤 بلا نشاط في الفترة (${ar(silent.length)})</h3>
          ${silent.length ? `<div class="row" style="gap:6px">${silent.slice(0, 40).map((s) => `<span class="pill mute">${esc(s.name)}</span>`).join('')}${silent.length > 40 ? `<span class="small muted">و${ar(silent.length - 40)} غيرهم</span>` : ''}</div>` : '<span class="muted">كل الطلاب نشطون. ما شاء الله!</span>'}</div>

      <div class="card"><h3>🪞 مقارنة الطالب بنفسه</h3><p class="small muted" style="margin:-4px 0 10px">أين تقدّم وأين تراجع بين شهرين، بلا مقارنة بزملائه.</p><div id="rpSelf">${selfHtml()}</div></div>
      <div id="rpOld"></div></div>`;
    wire(p, M, RS, A);
  }

  function wire(p, M, RS, A) {
    const $ = (s) => body.querySelector(s), $$ = (s) => [...body.querySelectorAll(s)];
    $$('[data-per]').forEach((b) => (b.onclick = () => { R.per = b.dataset.per; if (R.per === 'custom' && !R.from) { R.to = bhDay(Date.now()); R.from = bhDay(Date.now() - 29 * DAY); } save(); draw(); }));
    $('#rpC').onchange = (e) => { R.cls = e.target.value; save(); draw(); };
    $('#rpCmp').onchange = (e) => { R.cmp = e.target.checked; save(); draw(); };
    $('#rpF') && ($('#rpF').onchange = (e) => { R.from = e.target.value; save(); draw(); });
    $('#rpT') && ($('#rpT').onchange = (e) => { R.to = e.target.value; save(); draw(); });
    $$('[data-last]').forEach((b) => (b.onclick = () => { R.to = bhDay(Date.now()); R.from = bhDay(Date.now() - (+b.dataset.last - 1) * DAY); save(); draw(); }));
    $('#rpMC') && ($('#rpMC').onchange = (e) => { matCls = e.target.value; draw(); });
    $$('[data-mx]').forEach((c) => { const go = () => { const [ri, ci] = c.dataset.mx.split('|').map(Number); X.openSubmission(M.rows[ri].cells[ci].x); }; c.onclick = go; c.onkeydown = (e) => e.key === 'Enter' && go(); });
    $('#rpMxX') && ($('#rpMxX').onclick = () => exportXlsx(['mx']));
    $('#rpMxShow') && ($('#rpMxShow').onclick = () => present('mx'));
    $('#rpRemind') && ($('#rpRemind').onclick = () => remind(M));
    $('#rpX').onclick = () => exportDialog();
    $('#rpShow').onclick = () => present();
    $('#rpMGo').onclick = () => { const ym = $('#rpM').value; pref.set('repM', ym); monthReport(ym); };
    $('#rpAchAnn').onclick = () => X.goAnn('🌿 حصيلة مقرأة الفاتح', `${p.label}${R.cls === 'all' ? '' : ' في ' + className(R.cls)}: ${num(A.ayat)} آية مسمَّعة ومتدرَّب عليها، و${ar(A.hours < 10 ? A.hours.toFixed(1) : Math.round(A.hours))} ساعة تلاوة وتدريب، و${num(A.subs)} تسميعاً، و${num(A.ch)} تحدٍّ بين الزملاء. ≈ ${ar((A.ayat / 6236).toFixed(1))} ختمة للمصحف. بارك الله في جهودكم وزادكم حرصاً 🌟`);
    $('#rpRsAnn') && ($('#rpRsAnn').onclick = () => X.goAnn('🚀 النجوم الصاعدة', `أكثر الطلاب تحسّناً ${p.label === 'هذا الشهر' ? 'هذا الشهر' : 'في ' + p.label}:\n${RS.map((r, i) => `${['🥇', '🥈', '🥉'][i] || '⭐'} ${r.s.name} (${className(r.s.classId)})`).join('\n')}\nبارك الله فيكم، الاجتهاد يصنع الفرق!`));
    $('#rpRsCheer') && ($('#rpRsCheer').onclick = () => cheer(RS));
    const self = $('#rpSelf');
    const wireSelf = () => {
      self.querySelector('#scP').onchange = (e) => { SC.pn = e.target.value; self.innerHTML = selfHtml(); wireSelf(); };
      self.querySelector('#scA').onchange = (e) => { SC.a = e.target.value; self.innerHTML = selfHtml(); wireSelf(); };
      self.querySelector('#scB').onchange = (e) => { SC.b = e.target.value; self.innerHTML = selfHtml(); wireSelf(); };
    };
    if (self.querySelector('#scP')) wireSelf();
    X.drawOld($('#rpOld'), p, R.cls);
  }

  /* ---------- تذكير وتهنئة ---------- */
  async function remind(M) {
    const items = [];
    M.rows.forEach((r) => r.cells.forEach((c, i) => { if (c.k === 'w') items.push({ s: r.s, t: M.T[i] }); }));
    if (!items.length || !(await confirmBox(`إرسال تذكير إلى ${X.nWord(new Set(items.map((x) => x.s.id)).size, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')} لم يسلّموا واجبات مفتوحة؟`, 'أرسل'))) return;
    const by = new Map(); items.forEach((x) => { const a = by.get(x.s.id) || []; a.push(x.t); by.set(x.s.id, a); });
    const batch = [];
    try {
      for (const [pn, T] of by) {
        const nid = await X.store.addStudentNotif(pn, { type: 'remind', title: '⏰ تذكير من معلمك', body: `لم تسلّم بعد: ${T.map((t) => '«' + t.title + '»').join('، ')}. لا تفوّتها 🌟`, link: './#/student', tag: 'remind-' + pn });
        batch.push({ notif: nid, student: pn });
      }
      let msg = `أُرسل التذكير إلى ${X.nWord(by.size, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}.`;
      try { const r = await X.sendPushBatch(batch); if (r?.sent) msg += ` ووصل إلى ${ar(r.sent)} ${r.sent <= 10 ? 'أجهزة' : 'جهازاً'}.`; } catch {}
      toast(msg);
    } catch (e) { toast('تعذر الإرسال: ' + (e.code || e.message)); }
  }
  async function cheer(RS) {
    if (!(await confirmBox(`إرسال تهنئة «نجم صاعد» إلى ${X.nWord(RS.length, 'طالب واحد', 'طالبين', 'طلاب', 'طالباً')}؟`, 'أرسل'))) return;
    const batch = [];
    try {
      for (const r of RS) {
        const nid = await X.store.addStudentNotif(r.s.id, { type: 'cheer', title: '🚀 أنت نجم صاعد!', body: `ما شاء الله يا ${r.s.name.split(' ')[0]}! ${riseWhy(r) || 'تحسّن مستواك بوضوح'}. استمر، فخورون بك 💚`, link: './#/student', tag: 'rise-' + r.s.id });
        batch.push({ notif: nid, student: r.s.id });
      }
      try { await X.sendPushBatch(batch); } catch {}
      toast('أُرسلت التهنئة إلى النجوم الصاعدة 🌟');
    } catch (e) { toast('تعذر الإرسال: ' + (e.code || e.message)); }
  }

  /* ---------- التقرير الشهري ---------- */
  function monthReport(ym) {
    pref.set('repSeen', ym === prevYm(thisYm) ? ym : pref.get('repSeen', ''));
    const mr = monthRange(ym), p = { from: mr.from, to: Math.min(mr.to, Date.now()), label: 'شهر ' + ymLabel(ym) }, pr = monthRange(prevYm(ym));
    p.prev = { from: pr.from, to: pr.to };
    const cls = R.cls, K = kpis(p, cls), P0 = kpis(p.prev, cls), P = P0.any ? P0 : {}, subs = subsIn(p, cls);
    const tops = (cls === 'all' ? D.classes : D.classes.filter((c) => c.id === cls)).map((c) => {
      const L = studentsIn(c.id).map((s) => { const sc = subs.filter((x) => x.pn === s.id).map(subScore).filter((v) => v != null); return { s, n: sc.length, v: sc.length >= 2 ? avg(sc) * 10 : null }; }).filter((x) => x.v != null).sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 3);
      return { c, L };
    }).filter((x) => x.L.length);
    const RS = rising(p);
    const S = studentsIn(cls), act = new Set([...subs.map((x) => x.pn), ...himIn(p, cls).filter((h) => h.hp || h.ha).map((h) => h.pn)]);
    const need = S.map((s) => ({ s, a: accOf(subs.filter((x) => x.pn === s.id)) })).filter((x) => x.a != null && x.a < 70).sort((a, b) => a.a - b.a);
    const silent = S.filter((s) => !act.has(s.id));
    const words = topWords(subs, 5), A = achieve(p);
    const W = weeks(p), cs = (cls === 'all' ? D.classes : D.classes.filter((c) => c.id === cls)).map((c, i) => ({ name: c.name, color: COLORS[i % COLORS.length], vals: W.map((w) => accOf(subsIn(w, c.id))) })).filter((s) => s.vals.some((v) => v != null));
    const chart = lineChart(cs, W.map((w, i) => `الأسبوع ${ar(i + 1)}`), { h: 200 });
    const noteKey = 'repNote_' + ym + '_' + cls;
    const dl = (a, b, u) => (a == null || b == null ? '' : `<small class="${a - b > 0 ? 'up' : a - b < 0 ? 'dn' : ''}">${a - b > 0 ? '▲' : a - b < 0 ? '▼' : '='} ${a === b ? '' : ar(Math.abs(Math.round(a - b))) + u}</small>`);
    const rep = (note) => `<div class="mr" dir="rtl">
      <header><div><h1>مقرأة الفاتح</h1><p>تقرير ${esc(p.label)}${cls === 'all' ? '' : '، ' + esc(className(cls))}${ym === thisYm ? ' (حتى ' + esc(dLabel(Date.now())) + ')' : ''}</p></div><span class="mr-logo">🌿</span></header>
      <div class="mr-k"><div><b>${K.acc == null ? '—' : ar(K.acc) + '٪'}</b><span>متوسط الدقة</span>${dl(K.acc, P.acc, ' نقاط')}</div><div><b>${K.rate == null ? '—' : ar(K.rate) + '٪'}</b><span>تسليم الواجبات</span>${dl(K.rate, P.rate, ' نقاط')}</div>
        <div><b>${num(K.ayat)}</b><span>آية مسمَّعة ومتدرَّب عليها</span>${dl(K.ayat, P.ayat, '')}</div><div><b>${ar(K.actN)}/${ar(K.S)}</b><span>طلاب نشطون</span>${dl(K.actN, P.actN, '')}</div></div>
      <div class="mr-2"><section><h2>🏆 الأوائل</h2>${tops.length ? tops.map((t) => `<p class="mr-c">${esc(t.c.name)}</p><ol>${t.L.map((x) => `<li>${esc(x.s.name)} <small>${ar(Math.round(x.v))}٪</small></li>`).join('')}</ol>`).join('') : '<p class="mr-m">لا توجد درجات كافية.</p>'}</section>
        <section><h2>🚀 النجوم الصاعدة</h2>${RS.length ? `<ol>${RS.map((r) => `<li>${esc(r.s.name)} <small>${esc(riseWhy(r))}</small></li>`).join('')}</ol>` : '<p class="mr-m">لا يوجد تحسّن واضح مقارنة بالشهر السابق.</p>'}</section></div>
      <section><h2>📈 تقدّم ${cls === 'all' ? 'الصفوف' : 'الصف'} خلال الشهر</h2>${chart}${legend(cs)}</section>
      <div class="mr-2"><section><h2>⚠️ يحتاجون متابعة (${ar(need.length + silent.length)})</h2>${need.length ? `<p>${need.slice(0, 12).map((x) => `${esc(x.s.name)} <small>(${ar(x.a)}٪)</small>`).join('، ')}</p>` : ''}${silent.length ? `<p><b>بلا نشاط:</b> ${silent.slice(0, 20).map((s) => esc(s.name)).join('، ')}${silent.length > 20 ? ` و${ar(silent.length - 20)} غيرهم` : ''}</p>` : ''}${!need.length && !silent.length ? '<p class="mr-m">لا أحد، ما شاء الله.</p>' : ''}</section>
        <section><h2>🗺️ أكثر الكلمات خطأً</h2>${words.length ? `<ol>${words.map((w) => `<li><span class="mr-q">${esc(w.w)}</span> <small>${esc(surahName(w.s))}: ${ar(w.a)}، ${ar(w.who.size)} ${w.who.size <= 10 ? 'طلاب' : 'طالباً'}</small></li>`).join('')}</ol>` : '<p class="mr-m">لا أخطاء مسجّلة.</p>'}</section></div>
      <section class="mr-ach"><h2>🌿 الإنجاز</h2><p>${num(A.ayat)} آية، و${ar(A.hours < 10 ? A.hours.toFixed(1) : Math.round(A.hours))} ساعة تلاوة وتدريب، و${num(A.subs)} تسميعاً، و${num(A.ch)} تحدٍّ بين الزملاء (≈ ${ar((A.ayat / 6236).toFixed(1))} ختمة).</p></section>
      ${note ? `<section class="mr-note"><h2>✍️ ملاحظة المعلم</h2><p>${esc(note).replace(/\n/g, '<br>')}</p></section>` : ''}
      <footer>أُعدّ آلياً من منصة مقرأة الفاتح، ${esc(dLabel(Date.now()))} ${ar(bhDay(Date.now()).slice(0, 4))}</footer></div>`;
    const summary = () => `📄 تقرير مقرأة الفاتح، ${p.label}${cls === 'all' ? '' : '، ' + className(cls)}\n• متوسط الدقة: ${K.acc == null ? '—' : ar(K.acc) + '٪'}\n• تسليم الواجبات: ${K.rate == null ? '—' : ar(K.rate) + '٪'}\n• آيات مسمَّعة ومتدرَّب عليها: ${num(K.ayat)}\n• طلاب نشطون: ${ar(K.actN)} من ${ar(K.S)}\n${tops.length ? '🏆 الأوائل: ' + tops.map((t) => t.c.name + ': ' + t.L.map((x) => x.s.name).join('، ')).join(' | ') + '\n' : ''}${RS.length ? '🚀 النجوم الصاعدة: ' + RS.map((r) => r.s.name).join('، ') + '\n' : ''}${pref.get(noteKey, '') ? '✍️ ' + pref.get(noteKey, '') : ''}`;
    openModal(`<div class="stack"><div class="row" style="justify-content:space-between"><h2 style="margin:0">📄 التقرير الشهري</h2></div>
      <div class="row" style="gap:6px"><button class="btn primary" type="button" id="mrPdf">⬇ حفظ PDF / طباعة</button><button class="btn" type="button" id="mrShare">✉️ أرسل الملخص للإدارة</button><button class="btn" type="button" id="mrNoteB">✍️ ملاحظتك</button></div>
      <div id="mrNoteW" hidden><textarea id="mrNote" rows="3" maxlength="600" placeholder="تظهر في آخر التقرير، مثل: تحسّن ملحوظ في التجويد بعد مسابقة الشهر…">${esc(pref.get(noteKey, ''))}</textarea></div>
      <div class="mr-prev" id="mrPrev">${rep(pref.get(noteKey, ''))}</div></div>`, (m) => {
      m.querySelector('#mrNoteB').onclick = () => { const w = m.querySelector('#mrNoteW'); w.hidden = !w.hidden; if (!w.hidden) m.querySelector('#mrNote').focus(); };
      m.querySelector('#mrNote').oninput = (e) => { pref.set(noteKey, e.target.value.trim()); m.querySelector('#mrPrev').innerHTML = rep(e.target.value.trim()); };
      m.querySelector('#mrPdf').onclick = () => printReport(rep(pref.get(noteKey, '')), `تقرير-مقرأة-الفاتح-${ym}`);
      m.querySelector('#mrShare').onclick = async () => {
        const t = summary();
        try { if (navigator.share) { await navigator.share({ title: 'تقرير مقرأة الفاتح', text: t }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(t); toast('نُسخ الملخص. الصقه في رسالتك للإدارة، وأرفق ملف الـ PDF.'); } catch { open('https://wa.me/?text=' + encodeURIComponent(t), '_blank'); }
      };
    });
  }
  function printReport(html, title) {
    const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].filter((r) => /(^|\s|,)\.(mr|rp-)/.test(r.selectorText || '') || r.type === CSSRule.FONT_FACE_RULE || r.selectorText === ':root').map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
    document.body.appendChild(f);
    const d = f.contentDocument; d.open();
    d.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}@page{size:A4;margin:12mm}body{margin:0;font-family:${getComputedStyle(document.body).fontFamily};-webkit-print-color-adjust:exact;print-color-adjust:exact}.mr{box-shadow:none;border:0;max-width:none}</style></head><body>${html}</body></html>`);
    d.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 400);
  }

  /* ---------- تصدير Excel شامل ---------- */
  const SHEETS = [['sum', 'ملخص الصفوف', true], ['mx', 'درجات الطلاب (المصفوفة)', true], ['att', 'المواظبة والنشاط', true], ['words', 'أكثر الكلمات خطأً', true], ['him', 'نقاط الهمة والتدريب', true], ['subs', 'كل التسليمات بالتفصيل', false], ['ch', 'التحديات', false]];
  function exportDialog() {
    const sel = new Set(pref.get('repXs', SHEETS.filter((s) => s[2]).map((s) => s[0])));
    const p = period();
    openModal(`<div class="stack"><h2>⬇ تصدير التقارير إلى Excel</h2><p class="small muted" style="margin:0">${esc(p.label)}، ${esc(className(R.cls))}. ملف واحد بورقة لكل تقرير.</p>
      <div class="stack" style="gap:2px">${SHEETS.map(([k, l]) => `<label class="rp-ck"><input type="checkbox" value="${k}" ${sel.has(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="modal-actions row"><button class="btn primary" type="button" id="rxGo">⬇ تنزيل الملف</button><button class="btn" type="button" data-close>إلغاء</button></div></div>`, (m) => {
      m.querySelector('#rxGo').onclick = () => { const ks = [...m.querySelectorAll('input:checked')].map((i) => i.value); if (!ks.length) return toast('اختر ورقة واحدة على الأقل.'); pref.set('repXs', ks); closeModal(); exportXlsx(ks); };
    });
  }
  function exportXlsx(keys) {
    if (!window.XLSX) { toast('مكتبة Excel لم تُحمّل بعد. أعد المحاولة بعد لحظات.'); return; }
    const p = period(), wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const add = (name, rows) => { if (!rows.length) rows = [{ 'ملاحظة': 'لا توجد بيانات في هذه الفترة' }]; const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(12, Math.min(40, k.length + 4)) })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
    const cls = R.cls === 'all' ? D.classes : D.classes.filter((c) => c.id === R.cls);
    if (keys.includes('sum')) add('ملخص الصفوف', cls.map((c) => { const k = kpis(p, c.id), q = p.prev ? kpis(p.prev, c.id) : null; return { 'الصف': c.name, 'عدد الطلاب': k.S, 'طلاب نشطون': k.actN, 'التسميعات': k.subs, 'متوسط الدقة %': k.acc ?? '', 'تسليم الواجبات %': k.rate ?? '', 'الآيات': k.ayat, 'دقائق التلاوة والتدريب': k.mins, ...(q ? { 'الدقة في الفترة السابقة %': q.acc ?? '', 'التسليم في الفترة السابقة %': q.rate ?? '' } : {}) }; }));
    if (keys.includes('mx')) cls.forEach((c) => { const M = matrix(p, c.id); if (!M.T.length) return; add('درجات ' + c.name, M.rows.map((r) => ({ 'الطالب': r.s.name, ...Object.fromEntries(M.T.map((t, i) => [t.title || 'واجب ' + (i + 1), r.cells[i].v ?? (r.cells[i].k === 'na' ? '—' : r.cells[i].t || '')])), 'سلّم': `${r.d}/${r.n}`, 'المتوسط': r.avg ?? '' }))); });
    const S = studentsIn();
    if (keys.includes('att')) { const sb = subsIn(p), hb = himIn(p); add('المواظبة', S.map((s) => { const a = sb.filter((x) => x.pn === s.id), h = hb.filter((x) => x.pn === s.id && (x.hp || x.ha)); const days = new Set([...a.map((x) => bhDay(tms(x))), ...h.map((x) => x.d)]); const last = [...a.map((x) => x.createdAt), ...h.map((x) => x.d)].sort().pop(); return { 'الطالب': s.name, 'الرقم': s.id, 'الصف': className(s.classId), 'أيام النشاط': days.size, 'التسميعات': a.length, 'متوسط الدقة %': accOf(a) ?? '', 'الآيات': a.reduce((n, x) => n + ayatOf(x), 0) + h.reduce((n, x) => n + (x.ha || 0), 0), 'آخر نشاط': last ? bhDay(Date.parse(last.length === 10 ? last + 'T12:00:00+03:00' : last)) : '' }; })); }
    if (keys.includes('words')) add('أكثر الكلمات خطأً', topWords(subsIn(p), 50).map((w) => ({ 'الكلمة': w.w, 'السورة': surahName(w.s), 'الآية': w.a, 'عدد من أخطأ': w.who.size })));
    if (keys.includes('him')) { const hb = himIn(p); add('الهمة والتدريب', S.map((s) => { const h = hb.filter((x) => x.pn === s.id); return { 'الطالب': s.name, 'الصف': className(s.classId), 'نقاط الهمة': h.reduce((n, x) => n + (x.hp || 0), 0), 'آيات التدريب': h.reduce((n, x) => n + (x.ha || 0), 0), 'دقائق التدريب': Math.round(h.reduce((n, x) => n + (x.hs != null ? x.hs / 60 : x.hm || 0), 0)), 'أيام التدريب': h.filter((x) => x.hp || x.ha).length }; }).sort((a, b) => b['نقاط الهمة'] - a['نقاط الهمة'])); }
    if (keys.includes('subs')) add('التسليمات', subsIn(p).sort((a, b) => tms(a) - tms(b)).map((x) => ({ 'الطالب': x.studentName || stu(x.pn)?.name || x.pn, 'الصف': x.className || className(x.classId), 'الواجب': x.taskTitle || 'تدريب', 'السورة': surahName(x.surah), 'من': x.from, 'إلى': x.to, 'التاريخ': bhDay(tms(x)), 'الدقة %': x.percent ?? '', 'درجة المعلم /10': x.teacher?.total ?? '', 'عدد الأخطاء': (x.mistakes || []).length })));
    if (keys.includes('ch')) add('التحديات', (D.challenges || []).filter((c) => { const t = Date.parse(c.createdAt || '') || 0; return t >= p.from && t < p.to && !c.cancel && (R.cls === 'all' || clsOf(c.a?.pn) === R.cls || clsOf(c.b?.pn) === R.cls); }).map((c) => ({ 'التاريخ': bhDay(Date.parse(c.createdAt)), 'المتحدّي': c.a?.name || '', 'المتحدَّى': c.b?.name || '', 'السورة': c.surah ? surahName(c.surah) : '', 'نسبة الأول %': c.ra?.p ?? c.ra?.percent ?? '', 'نسبة الثاني %': c.rb?.p ?? c.rb?.percent ?? '' })));
    XLSX.writeFile(wb, `تقارير-المقرأة-${bhDay(Date.now())}.xlsx`);
    toast('نُزّل ملف Excel.');
  }

  /* ---------- وضع العرض في الحصة ---------- */
  function present(start = null) {
    const p = period(), K = kpis(p), P0 = p.prev ? kpis(p.prev) : null, P = P0?.any ? P0 : null, A = achieve(p), RS = rising(p), cp = classProgress(p, true), M = matrix(p, matCls), words = topWords(subsIn(p), 8);
    const big = (v, l, d) => `<div class="pv-k"><b>${v}</b><span>${l}</span>${d || ''}</div>`;
    const slides = [
      { k: 'kpi', t: `📊 ${p.label}${R.cls === 'all' ? '' : '، ' + className(R.cls)}`, h: `<div class="pv-ks">${big(K.acc == null ? '—' : ar(K.acc) + '٪', 'متوسط الدقة', P ? delta(K.acc, P.acc, ' نقاط') : '')}${big(K.rate == null ? '—' : ar(K.rate) + '٪', 'تسليم الواجبات', P ? delta(K.rate, P.rate, ' نقاط') : '')}${big(num(K.ayat), 'آية', P ? delta(K.ayat, P.ayat, '') : '')}${big(`${ar(K.actN)}/${ar(K.S)}`, 'طلاب نشطون', '')}</div>` },
      { k: 'cp', t: `📈 تقدّم ${R.cls === 'all' ? 'الصفوف' : 'الصف'}`, h: cp.svg + cp.lg },
      { k: 'ach', t: '🌿 عدّاد الإنجاز', h: achHtml(A, p, true) + (R.cls === 'all' && A.byCls.length > 1 ? `<div class="rp-bars big">${barsHtml(A.byCls.map((x) => ({ label: x.c.name, n: x.n })))}</div>` : '') },
      ...(RS.length ? [{ k: 'rs', t: '🚀 النجوم الصاعدة', h: riseHtml(RS, true) }] : []),
      ...(M.T.length ? [{ k: 'mx', t: `🧩 واجبات ${className(matCls)}`, h: matrixHtml(M, { hideWeak: true }) }] : []),
      ...(words.length ? [{ k: 'w', t: '🗺️ انتبهوا لهذه الكلمات', h: `<div class="pv-ws">${words.map((w) => `<div><span class="qw">${esc(w.w)}</span><small>${esc(surahName(w.s))}: ${ar(w.a)}</small></div>`).join('')}</div>` }] : []),
    ];
    let i = Math.max(0, slides.findIndex((s) => s.k === start));
    const box = document.createElement('div'); box.className = 'pv'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const paint = () => {
      box.innerHTML = `<div class="pv-top"><h2>${esc(slides[i].t)}</h2><span>${ar(i + 1)} / ${ar(slides.length)}</span><button type="button" class="btn" data-x>إغلاق ✕</button></div>
        <div class="pv-body">${slides[i].h}</div>
        <button type="button" class="pv-nav nx" aria-label="التالي" ${i === slides.length - 1 ? 'disabled' : ''}>‹</button><button type="button" class="pv-nav pr" aria-label="السابق" ${i === 0 ? 'disabled' : ''}>›</button>
        <div class="pv-dots">${slides.map((_, j) => `<button type="button" class="${j === i ? 'on' : ''}" data-j="${j}" aria-label="${ar(j + 1)}"></button>`).join('')}</div>`;
      box.querySelector('[data-x]').onclick = close;
      box.querySelector('.nx').onclick = () => go(1); box.querySelector('.pr').onclick = () => go(-1);
      box.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => { i = +b.dataset.j; paint(); }));
    };
    const go = (d) => { const j = i + d; if (j >= 0 && j < slides.length) { i = j; paint(); } };
    const key = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') go(1); else if (e.key === 'ArrowRight' || e.key === 'PageUp') go(-1); };
    let x0 = null; box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true }); box.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx > 0 ? 1 : -1); x0 = null; });
    function close() { removeEventListener('keydown', key); box.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
    document.addEventListener('fullscreenchange', function f() { if (!document.fullscreenElement && box.isConnected && box.dataset.fs) { close(); document.removeEventListener('fullscreenchange', f); } });
    addEventListener('keydown', key);
    paint(); document.body.appendChild(box);
    box.requestFullscreen?.().then(() => (box.dataset.fs = '1')).catch(() => {});
  }

  draw();
  return { monthReport };
}
