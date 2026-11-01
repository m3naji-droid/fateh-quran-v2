// لوحة الشرف: تحدي الصفوف، وقارئ الصف، وشيخ المرحلة
// نقاط الطالب = مجموع أفضل درجة له في كل واجب (درجة المعلم إن وُجدت، وإلا الدرجة الآلية من ١٠)
// نقاط الصف = متوسط نقاط طلابه (من لم يسلّم يُحسب صفراً)، فلا يتفوق صف بكثرة عدده

const TOP = 5;
const round1 = (v) => Math.round(v * 10) / 10;

export function subScore(x) {
  if (x.teacher && typeof x.teacher.total === 'number') return x.teacher.total;
  if (x.percent != null) return x.percent / 10;
  return null;
}

function rankList(students, subs, classes) {
  const best = new Map(); // `${pn}|${task}` -> score
  subs.forEach((x) => {
    if (!x.taskId) return;
    const sc = subScore(x);
    if (sc == null) return;
    const k = `${x.pn}|${x.taskId}`;
    if (!best.has(k) || best.get(k) < sc) best.set(k, sc);
  });
  const pts = new Map(), tasks = new Map();
  best.forEach((sc, k) => {
    const pn = k.split('|')[0];
    pts.set(pn, (pts.get(pn) || 0) + sc);
    tasks.set(pn, (tasks.get(pn) || 0) + 1);
  });
  const cname = (id) => classes.find((c) => c.id === id)?.name || '';
  const all = students.map((s) => ({ id: s.id, name: s.name, classId: s.classId, className: cname(s.classId), points: round1(pts.get(s.id) || 0), tasks: tasks.get(s.id) || 0 }))
    .sort((a, b) => b.points - a.points || b.tasks - a.tasks || a.name.localeCompare(b.name, 'ar'));
  return all;
}

function period(students, subs, classes) {
  const list = rankList(students, subs, classes);
  const active = list.filter((s) => s.points > 0);
  const byClass = {};
  classes.forEach((c) => {
    byClass[c.id] = active.filter((s) => s.classId === c.id).slice(0, TOP).map(({ id, name, points, tasks }) => ({ id, name, points, tasks }));
  });
  const classRank = classes.map((c) => {
    const members = list.filter((s) => s.classId === c.id);
    const total = members.reduce((n, s) => n + s.points, 0);
    return { id: c.id, name: c.name, score: members.length ? round1(total / members.length) : 0, students: members.length, active: members.filter((s) => s.points > 0).length };
  }).filter((c) => c.students).sort((a, b) => b.score - a.score || b.active - a.active);
  return {
    classes: classRank.slice(0, TOP),
    stage: active.slice(0, TOP).map(({ id, name, className, classId, points, tasks }) => ({ id, name, className, classId, points, tasks })),
    byClass,
    _list: list,
  };
}

/** يحسب لوحة الشرف للشهر الحالي ومنذ البداية، ومرتبة كل طالب */
export function computeBoard(subs, students, classes, now = new Date()) {
  const ym = now.toISOString().slice(0, 7);
  const monthName = now.toLocaleDateString('ar', { month: 'long', year: 'numeric' });
  const all = period(students, subs, classes);
  const month = period(students, subs.filter((x) => (x.createdAt || '').slice(0, 7) === ym), classes);
  const ranks = {};
  const fill = (p, key) => {
    const list = p._list;
    const fifthStage = list.filter((s) => s.points > 0)[TOP - 1]?.points ?? 0;
    list.forEach((s, i) => {
      const cls = list.filter((x) => x.classId === s.classId);
      const ci = cls.findIndex((x) => x.id === s.id);
      const fifthClass = cls.filter((x) => x.points > 0)[TOP - 1]?.points ?? 0;
      ranks[s.id] = ranks[s.id] || {};
      ranks[s.id][key] = {
        points: s.points,
        stage: s.points > 0 ? i + 1 : null, stageOf: list.length,
        cls: s.points > 0 ? ci + 1 : null, clsOf: cls.length,
        toClassTop: ci + 1 > TOP || s.points === 0 ? round1(Math.max(0.1, fifthClass - s.points + 0.1)) : 0,
        toStageTop: i + 1 > TOP || s.points === 0 ? round1(Math.max(0.1, fifthStage - s.points + 0.1)) : 0,
      };
    });
  };
  fill(all, 'all');
  fill(month, 'month');
  delete all._list;
  delete month._list;
  return { board: { month: { ...month, label: monthName, ym }, all: { ...all, label: 'منذ البداية' } }, ranks };
}

/* ---------------- الرموز ---------------- */
export function rankBadge(n) {
  const id = 'g' + n + Math.random().toString(36).slice(2, 6);
  if (n === 1) {
    return `<svg class="rank-badge" viewBox="0 0 48 48" aria-label="المركز الأول" role="img">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#c9971f"/></linearGradient></defs>
      <path d="M8 34 L6 14 L16 22 L24 9 L32 22 L42 14 L40 34 Z" fill="url(#${id})" stroke="#8a6512" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="8" y="34" width="32" height="6" rx="2" fill="#a77a1c"/>
      <circle cx="24" cy="9" r="2.6" fill="#fff6d8"/><circle cx="6" cy="14" r="2.2" fill="#fff6d8"/><circle cx="42" cy="14" r="2.2" fill="#fff6d8"/>
      <text x="24" y="31" text-anchor="middle" font-size="11" font-weight="700" fill="#5a400a">1</text></svg>`;
  }
  if (n === 2 || n === 3) {
    const [a, b, edge] = n === 2 ? ['#f4f6f8', '#a9b2ba', '#6d7780'] : ['#f3c79b', '#b7703a', '#7a4520'];
    return `<svg class="rank-badge" viewBox="0 0 48 48" aria-label="المركز ${n === 2 ? 'الثاني' : 'الثالث'}" role="img">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <path d="M15 4 L22 18 L18 20 L11 6 Z" fill="#0d5c46"/><path d="M33 4 L26 18 L30 20 L37 6 Z" fill="#1f8a3c"/>
      <circle cx="24" cy="30" r="13" fill="url(#${id})" stroke="${edge}" stroke-width="1.6"/>
      <circle cx="24" cy="30" r="9.5" fill="none" stroke="${edge}" stroke-width="0.8" opacity=".6"/>
      <text x="24" y="34.5" text-anchor="middle" font-size="13" font-weight="700" fill="${edge}">${n}</text></svg>`;
  }
  return `<svg class="rank-badge" viewBox="0 0 48 48" aria-label="المركز ${n === 4 ? 'الرابع' : 'الخامس'}" role="img">
    <path d="M14 38 C6 32 5 20 10 11" fill="none" stroke="#1f8a3c" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M34 38 C42 32 43 20 38 11" fill="none" stroke="#1f8a3c" stroke-width="2.2" stroke-linecap="round"/>
    ${[0, 1, 2, 3].map((k) => `<ellipse cx="${9 - k * 0.3}" cy="${16 + k * 6}" rx="2.8" ry="1.4" transform="rotate(-50 ${9 - k * 0.3} ${16 + k * 6})" fill="#4cc09a"/><ellipse cx="${39 + k * 0.3}" cy="${16 + k * 6}" rx="2.8" ry="1.4" transform="rotate(50 ${39 + k * 0.3} ${16 + k * 6})" fill="#4cc09a"/>`).join('')}
    <circle cx="24" cy="26" r="10" fill="#e3efe9" stroke="#0d5c46" stroke-width="1.4"/>
    <text x="24" y="30.5" text-anchor="middle" font-size="12" font-weight="700" fill="#0d5c46">${n}</text></svg>`;
}

/* ---------------- العرض ---------------- */
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (v) => String(v).replace(/\d/g, (d) => AR[d]).replace('.', '٫');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

function rows(items, me, valueFn, subFn) {
  if (!items.length) return '<div class="empty small">لا توجد نتائج بعد. أول من يسلّم واجباته يتصدر!</div>';
  return `<ol class="lb-list">${items.map((x, i) => `<li class="${me && x.id === me ? 'me' : ''} r${i + 1}">
    ${rankBadge(i + 1)}
    <span class="lb-name"><b>${esc(x.name)}</b>${subFn ? `<small>${subFn(x)}</small>` : ''}</span>
    <span class="lb-val">${valueFn(x)}</span></li>`).join('')}</ol>`;
}

function podium(items, me) {
  if (items.length < 3) return '';
  const order = [1, 0, 2];
  return `<div class="podium" aria-hidden="true">${order.map((i) => `<div class="pod p${i + 1} ${me && items[i].id === me ? 'me' : ''}">
    ${rankBadge(i + 1)}<b>${esc(items[i].name)}</b><small>${esc(items[i].className)}</small><div class="step"><span>${ar(items[i].points)}</span></div></div>`).join('')}</div>`;
}

/**
 * يرسم لوحة الشرف.
 * opts: { me: id الطالب، myClass، myRank: {points, cls, clsOf, stage, stageOf, toClassTop, toStageTop}، classId: صف العرض في «قارئ الصف»، classes }
 */
export function boardHtml(p, opts = {}) {
  const { me, myClass, myRank, classes = [] } = opts;
  const viewClass = opts.classId || myClass || p.classes[0]?.id || classes[0]?.id;
  const top = p.classes[0]?.score || 1;
  const clsTop = p.byClass[viewClass] || [];
  const myClassInChallenge = myClass ? p.classes.findIndex((c) => c.id === myClass) : -1;
  return `
  ${myRank ? `<div class="lb-me">
    ${myRank.stage === 1 ? `<div class="lb-title">${rankBadge(1)}<b>أنت شيخ المرحلة! ما شاء الله، تاج الثاني الإعدادي على رأسك.</b></div>`
      : myRank.cls === 1 ? `<div class="lb-title">${rankBadge(1)}<b>أنت قارئ صفك! حافظ على مكانك وارتقِ نحو مشيخة المرحلة.</b></div>` : ''}
    <div class="lb-me-grid">
      <div><span>نقاطك</span><b>${ar(myRank.points)}</b></div>
      <div><span>ترتيبك في صفك</span><b>${myRank.cls ? `${ar(myRank.cls)} <small>من ${ar(myRank.clsOf)}</small>` : '—'}</b></div>
      <div><span>ترتيبك في المرحلة</span><b>${myRank.stage ? `${ar(myRank.stage)} <small>من ${ar(myRank.stageOf)}</small>` : '—'}</b></div>
    </div>
    <p class="small" style="margin:0">${!myRank.points ? 'سلّم أول واجب لتدخل المنافسة، فكل درجة تُحسب لك ولصفك.'
      : myRank.toClassTop ? `تحتاج <b>${ar(myRank.toClassTop)}</b> نقطة لتدخل الخمسة الأوائل في صفك. أتقن واجبك القادم وستصل بإذن الله.`
      : myRank.toStageTop ? `أنت من الخمسة الأوائل في صفك! وتحتاج <b>${ar(myRank.toStageTop)}</b> نقطة لتدخل الخمسة الأوائل في المرحلة كلها.`
      : 'أنت من الخمسة الأوائل في المرحلة كلها. بارك الله فيك، ثبّتك الله على القرآن.'}</p>
  </div>` : ''}

  <section class="card lb-card">
    <div class="lb-head"><h3>شيخ المرحلة</h3><span class="muted small">أفضل خمسة في الثاني الإعدادي</span></div>
    ${podium(p.stage, me)}
    ${rows(p.stage, me, (x) => `${ar(x.points)} <small>نقطة</small>`, (x) => esc(x.className))}
  </section>

  <div class="grid2" style="align-items:start">
    <section class="card lb-card">
      <div class="lb-head"><h3>تحدي الصفوف</h3><span class="muted small">متوسط نقاط طلاب الصف</span></div>
      ${p.classes.length ? `<ol class="lb-list">${p.classes.map((c, i) => `<li class="${c.id === myClass ? 'myclass' : ''} r${i + 1}">${rankBadge(i + 1)}
        <span class="lb-name"><b>${esc(c.name)}</b><small>المشاركون: ${ar(c.active)} من ${ar(c.students)}</small><span class="lb-bar"><i style="width:${Math.max(4, (c.score / top) * 100)}%"></i></span></span>
        <span class="lb-val">${ar(c.score)}</span></li>`).join('')}</ol>` : '<div class="empty small">لا توجد نتائج بعد.</div>'}
      ${myClass && myClassInChallenge > 0 ? `<p class="small muted" style="margin:8px 0 0">صفك في المركز ${ORD[myClassInChallenge + 1] || ar(myClassInChallenge + 1)}، والفارق عن الأول ${ar(Math.round((p.classes[0].score - p.classes[myClassInChallenge].score) * 10) / 10)} نقطة. كل واجب متقن منك يرفع صفك!</p>` : myClass && myClassInChallenge === 0 ? '<p class="small" style="margin:8px 0 0"><b>صفك يتصدر التحدي!</b> حافظوا على القمة.</p>' : ''}
    </section>
    <section class="card lb-card">
      <div class="lb-head"><h3>قارئ الصف</h3>
        ${opts.pickClass ? `<select id="lbCls" aria-label="الصف">${classes.map((c) => `<option value="${esc(c.id)}" ${c.id === viewClass ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : `<span class="muted small">${esc(classes.find((c) => c.id === viewClass)?.name || '')}</span>`}
      </div>
      ${rows(clsTop, me, (x) => `${ar(x.points)} <small>نقطة</small>`, (x) => `الواجبات المنجزة: ${ar(x.tasks)}`)}
    </section>
  </div>
  <details class="small muted"><summary>كيف تُحسب النقاط؟</summary>
    <p>في كل واجب تُحسب أفضل محاولة لك فقط: درجة المعلم إن قيّمها، وإلا الدرجة الآلية (من ١٠). نقاطك مجموع درجات واجباتك، فالإتقان والإنجاز معاً يرفعانك. ونقاط الصف متوسط نقاط طلابه، ومن لم يسلّم يُحسب صفراً، فكل طالب يرفع صفه.</p>
  </details>`;
}
