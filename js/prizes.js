// 💰 حاسبة الجوائز: يحدد المعلم مبلغ كل مركز في كل فئة (الشرف، الهمة، التحديات)، فتُحسب جوائز الفترة،
// ويُجمع لمن فاز في أكثر من فئة، مع تفصيل لكل طالب وجدول كامل وتنزيله PDF.
import { LIBS, loadScript } from './cards.js';
import { toArabicDigits as ar } from './quran.js';

export const PRIZE_CATS = [
  { k: 'hs', t: 'لوحة الشرف — المرحلة', s: 'الشرف على المرحلة', ic: '👑' },
  { k: 'hc', t: 'لوحة الشرف — كل صف', s: 'الشرف في الصف', ic: '🏆' },
  { k: 'hm', t: 'الهمة العالية', s: 'الهمة العالية', ic: '⚡' },
  { k: 'ch', t: 'تحدي الزملاء', s: 'تحدي الزملاء', ic: '⚔️' },
];
export const PRIZE_DEFAULT = { cur: 'د.ب', mode: 'sum', cats: { hs: { on: true, a: [10, 7, 5] }, hc: { on: false, a: [3, 2, 1] }, hm: { on: true, a: [5, 3, 2] }, ch: { on: true, a: [5, 3, 2] } } };
const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => { const n = Math.round(v * 100) / 100; return ar(String(n)).replace('.', '٫'); };
export const normCfg = (c) => { const d = PRIZE_DEFAULT; const o = { cur: c?.cur ?? d.cur, mode: c?.mode === 'max' ? 'max' : 'sum', cats: {} }; PRIZE_CATS.forEach(({ k }) => { const x = c?.cats?.[k] || d.cats[k]; o.cats[k] = { on: !!x.on, a: (Array.isArray(x.a) ? x.a : d.cats[k].a).slice(0, 10).map((v) => Math.max(0, +v || 0)) }; }); return o; };

/** rows: [{ pn, name, cls, hs, hc, hm, ch }] حيث كل مركز رقم أو null */
export function computePrizes(rows, cfg) {
  const C = normCfg(cfg), out = [];
  rows.forEach((r) => {
    const items = [];
    PRIZE_CATS.forEach(({ k, t, s, ic }) => { const c = C.cats[k], p = r[k]; if (!c.on || !p || p > c.a.length || !(c.a[p - 1] > 0)) return; items.push({ k, t, s, ic, rank: p, amt: c.a[p - 1] }); });
    if (!items.length) return;
    items.sort((a, b) => b.amt - a.amt);
    const total = C.mode === 'max' ? items[0].amt : items.reduce((s, x) => s + x.amt, 0);
    if (C.mode === 'max') items.forEach((x, i) => (x.off = i > 0));
    out.push({ ...r, items, total });
  });
  out.sort((a, b) => b.total - a.total || b.items.length - a.items.length || a.name.localeCompare(b.name, 'ar'));
  const byCat = {}; PRIZE_CATS.forEach(({ k }) => (byCat[k] = out.flatMap((r) => r.items.filter((x) => x.k === k).map((x) => ({ ...x, name: r.name, cls: r.cls, off: x.off }))).sort((a, b) => a.rank - b.rank || a.cls.localeCompare(b.cls, 'ar'))));
  return { list: out, byCat, sum: out.reduce((s, r) => s + r.total, 0), cfg: C };
}

/* ---------------- الواجهة ---------------- */
export function mountPrizes(host, { periods, compute, loadCfg, saveCfg, toast }) {
  let cfg = normCfg(null), per = periods[0]?.v || '', R = null;
  const draw = () => {
    host.innerHTML = `<div class="row" style="justify-content:space-between"><h3>💰 حاسبة الجوائز</h3><span class="small muted">تُحفظ المبالغ للمرة القادمة</span></div>
      <p class="small muted" style="margin:0">حدّد مبلغ كل مركز في كل فئة، ثم اختر الفترة: تُحسب الجوائز من مراكز الطلاب فيها، ومن فاز في أكثر من فئة تُجمع جوائزه.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:end">
        <label class="field" style="min-width:170px">الفترة<select id="pzPer">${periods.map((p) => `<option value="${esc(p.v)}" ${p.v === per ? 'selected' : ''}>${esc(p.t)}</option>`).join('')}</select></label>
        <label class="field" style="width:110px">العملة / الوحدة<input id="pzCur" maxlength="12" value="${esc(cfg.cur)}"></label>
        <label class="field" style="min-width:200px">من فاز في أكثر من فئة<select id="pzMode"><option value="sum" ${cfg.mode === 'sum' ? 'selected' : ''}>تُجمع جوائزه كلها</option><option value="max" ${cfg.mode === 'max' ? 'selected' : ''}>يأخذ أعلى جائزة فقط</option></select></label>
      </div>
      <div class="pz-cats">${PRIZE_CATS.map(({ k, t, ic }) => { const c = cfg.cats[k]; return `<div class="pz-cat${c.on ? ' on' : ''}" data-cat="${k}">
        <label class="row" style="gap:6px"><input type="checkbox" data-on ${c.on ? 'checked' : ''}> <b>${ic} ${t}</b></label>
        <label class="small row" style="gap:6px">عدد المراكز <select data-n>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option ${n === c.a.length ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="pz-am">${c.a.map((v, i) => `<label><span>${ORD[i + 1]}</span><input type="number" min="0" step="0.5" inputmode="decimal" data-i="${i}" value="${v}"></label>`).join('')}</div>
        ${k === 'hc' ? '<small class="muted">لكل صف مراكزه الخاصة.</small>' : '<small class="muted">على المرحلة كلها.</small>'}</div>`; }).join('')}</div>
      <div class="row" style="gap:8px"><button type="button" class="btn primary" id="pzGo">احسب الجوائز</button><button type="button" class="btn" id="pzSave">💾 حفظ المبالغ</button></div>
      <div id="pzOut"></div>`;
    const sync = () => {
      cfg.cur = host.querySelector('#pzCur').value.trim(); cfg.mode = host.querySelector('#pzMode').value; per = host.querySelector('#pzPer').value;
      host.querySelectorAll('[data-cat]').forEach((el) => { const k = el.dataset.cat; cfg.cats[k] = { on: el.querySelector('[data-on]').checked, a: [...el.querySelectorAll('[data-i]')].map((x) => Math.max(0, +x.value || 0)) }; });
    };
    host.querySelectorAll('[data-cat]').forEach((el) => {
      el.querySelector('[data-on]').onchange = () => { sync(); draw(); };
      el.querySelector('[data-n]').onchange = (e) => { sync(); const c = cfg.cats[el.dataset.cat], n = +e.target.value; c.a = Array.from({ length: n }, (_, i) => c.a[i] ?? Math.max(0, (c.a[c.a.length - 1] || 1) - 1)); draw(); };
    });
    host.querySelector('#pzSave').onclick = async () => { sync(); try { await saveCfg(cfg); toast('حُفظت مبالغ الجوائز.'); } catch (e) { toast('تعذر الحفظ: ' + e.message); } };
    host.querySelector('#pzGo').onclick = async () => { sync(); const b = host.querySelector('#pzGo'); b.disabled = true; try { const d = await compute(per); R = { ...computePrizes(d.rows, cfg), label: d.label, perT: periods.find((p) => p.v === per)?.t || per }; paintOut(); } catch (e) { toast('تعذّر الحساب: ' + e.message); } finally { b.disabled = false; } };
    if (R) paintOut();
  };
  const money = (v) => `${num(v)} ${esc(cfg.cur)}`;
  function paintOut() {
    const o = host.querySelector('#pzOut'); if (!o || !R) return;
    if (!R.list.length) { o.innerHTML = '<p class="muted">لا فائزين في الفئات المفعّلة لهذه الفترة.</p>'; return; }
    o.innerHTML = `<div class="pz-sum"><div><b>${money(R.sum)}</b><span>مجموع الجوائز</span></div><div><b>${ar(R.list.length)}</b><span>طالباً فائزاً</span></div><div><b>${ar(R.list.filter((r) => r.items.length > 1).length)}</b><span>فاز في أكثر من فئة</span></div></div>
      <div class="table-wrap"><table class="pz-t"><thead><tr><th>#</th><th>الطالب</th><th>الصف</th><th>التفصيل</th><th>المجموع</th></tr></thead><tbody>
      ${R.list.map((r, i) => `<tr><td>${ar(i + 1)}</td><td><b>${esc(r.name)}</b></td><td class="small">${esc(r.cls)}</td><td class="small">${r.items.map((x) => `<span class="pz-it${x.off ? ' off' : ''}">${x.ic} ${esc(x.s)}: ${ORD[x.rank]} <b>${money(x.amt)}</b></span>`).join('')}</td><td><b>${money(r.total)}</b></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">المجموع</td><td><b>${money(R.sum)}</b></td></tr></tfoot></table></div>
      <details><summary class="small"><b>المراكز في كل فئة</b></summary><div class="pz-bycat">${PRIZE_CATS.filter(({ k }) => R.cfg.cats[k].on).map(({ k, t, ic }) => `<div><b>${ic} ${t}</b><ol>${R.byCat[k].map((x) => `<li>${ORD[x.rank]}: ${esc(x.name)} <small class="muted">(${esc(x.cls)})</small> — ${money(x.amt)}${x.off ? ' <small class="muted">(لم تُحتسب)</small>' : ''}</li>`).join('') || '<li class="muted">—</li>'}</ol></div>`).join('')}</div></details>
      <div class="row"><button type="button" class="btn primary" id="pzPdf">⬇️ تنزيل PDF</button></div>`;
    o.querySelector('#pzPdf').onclick = async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = 'جارٍ التجهيز…'; try { await prizesPDF(R, cfg.cur); } catch (x) { toast('تعذّر إنشاء الملف: ' + x.message); } finally { b.disabled = false; b.textContent = '⬇️ تنزيل PDF'; } };
  }
  draw();
  loadCfg().then((c) => { if (c) { cfg = normCfg(c); draw(); } }).catch(() => {});
}

/* ---------------- ملف PDF (يُرسم بالعربية على صفحات A4) ---------------- */
const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
export async function prizesPDF(R, cur) {
  try { await Promise.all([document.fonts.load(`700 30px ${FONT}`), document.fonts.load(`400 24px ${FONT}`)]); } catch {}
  await loadScript(LIBS.pdf);
  const W = 1240, H = 1754, M = 80, pages = [];
  let cv, c, y;
  const money = (v) => `${num(v)} ${cur}`;
  const page = () => {
    cv = document.createElement('canvas'); cv.width = W; cv.height = H; c = cv.getContext('2d'); pages.push(cv);
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.direction = 'rtl'; c.textBaseline = 'middle';
    c.fillStyle = '#0d5c46'; c.fillRect(0, 0, W, 14);
    c.fillStyle = '#9aa'; c.font = `400 20px ${FONT}`; c.textAlign = 'left'; c.fillText(`صفحة ${ar(pages.length)}`, M, H - 40);
    c.textAlign = 'right'; c.fillText('مقرأة الفاتح — كشف الجوائز', W - M, H - 40);
    y = 70;
  };
  const need = (h) => { if (y + h > H - 90) page(); };
  const fit = (t, w, size, weight = 400) => { c.font = `${weight} ${size}px ${FONT}`; let s = size; while (c.measureText(t).width > w && s > 12) { s -= 1; c.font = `${weight} ${s}px ${FONT}`; } };
  page();
  c.textAlign = 'center'; c.fillStyle = '#0d5c46'; c.font = `800 46px ${FONT}`; c.fillText('كشف جوائز مقرأة الفاتح', W / 2, y + 20); y += 72;
  c.fillStyle = '#444'; c.font = `500 26px ${FONT}`; c.fillText(`${R.perT} — حُرّر في ${ar(new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }))}`, W / 2, y); y += 56;
  // الملخص
  const box = (x, w, big, small) => { c.fillStyle = '#f1f7f4'; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, 96, 14); else c.rect(x, y, w, 96); c.fill(); c.textAlign = 'center'; c.fillStyle = '#0d5c46'; c.font = `800 34px ${FONT}`; c.fillText(big, x + w / 2, y + 36); c.fillStyle = '#556'; c.font = `400 21px ${FONT}`; c.fillText(small, x + w / 2, y + 72); };
  const bw = (W - 2 * M - 40) / 3;
  box(W - M - bw, bw, money(R.sum), 'مجموع الجوائز'); box(W - M - 2 * bw - 20, bw, ar(R.list.length), 'طالباً فائزاً'); box(M, bw, ar(R.list.filter((r) => r.items.length > 1).length), 'فاز في أكثر من فئة');
  y += 126;
  // المبالغ المعتمدة
  c.textAlign = 'right'; c.fillStyle = '#0d5c46'; c.font = `700 26px ${FONT}`; c.fillText('المبالغ المعتمدة', W - M, y); y += 36;
  PRIZE_CATS.filter(({ k }) => R.cfg.cats[k].on).forEach(({ k, t, ic }) => { need(34); c.fillStyle = '#333'; fit(`${ic} ${t}: ${R.cfg.cats[k].a.map((v, i) => `${ORD[i + 1]} ${money(v)}`).join('، ')}`, W - 2 * M, 21); c.fillText(`${ic} ${t}: ${R.cfg.cats[k].a.map((v, i) => `${ORD[i + 1]} ${money(v)}`).join('، ')}`, W - M, y); y += 32; });
  c.fillStyle = '#666'; c.font = `400 20px ${FONT}`; c.fillText(R.cfg.mode === 'max' ? 'من فاز في أكثر من فئة يأخذ أعلى جائزة فقط.' : 'من فاز في أكثر من فئة تُجمع جوائزه.', W - M, y); y += 46;
  // الجدول
  const cols = [{ t: '#', w: 50 }, { t: 'الطالب', w: 250 }, { t: 'الصف', w: 170 }, { t: 'التفصيل', w: 460 }, { t: 'المجموع', w: 150 }];
  const head = () => { need(60); c.fillStyle = '#0d5c46'; c.fillRect(M, y, W - 2 * M, 46); let x = W - M; c.fillStyle = '#fff'; c.font = `700 22px ${FONT}`; c.textAlign = 'center'; cols.forEach((col) => { c.fillText(col.t, x - col.w / 2, y + 23); x -= col.w; }); y += 46; };
  head();
  R.list.forEach((r, i) => {
    const lines = r.items.map((x) => `${x.ic} ${x.s}: ${ORD[x.rank]} (${money(x.amt)})${x.off ? ' — لم تُحتسب' : ''}`);
    const h = Math.max(50, 16 + lines.length * 30);
    if (y + h > H - 90) { page(); head(); }
    c.fillStyle = i % 2 ? '#fafcfb' : '#fff'; c.fillRect(M, y, W - 2 * M, h);
    c.strokeStyle = '#e3ebe7'; c.lineWidth = 1; c.beginPath(); c.moveTo(M, y + h); c.lineTo(W - M, y + h); c.stroke();
    let x = W - M; const mid = y + h / 2;
    c.fillStyle = '#333'; c.textAlign = 'center'; c.font = `500 22px ${FONT}`; c.fillText(ar(i + 1), x - cols[0].w / 2, mid); x -= cols[0].w;
    c.textAlign = 'right'; fit(r.name, cols[1].w - 16, 23, 700); c.fillStyle = '#111'; c.fillText(r.name, x - 8, mid); x -= cols[1].w;
    fit(r.cls, cols[2].w - 16, 20); c.fillStyle = '#555'; c.fillText(r.cls, x - 8, mid); x -= cols[2].w;
    lines.forEach((l, j) => { fit(l, cols[3].w - 16, 19); c.fillStyle = r.items[j].off ? '#999' : '#333'; c.fillText(l, x - 8, y + 23 + j * 30); }); x -= cols[3].w;
    c.textAlign = 'center'; c.fillStyle = '#0d5c46'; c.font = `800 23px ${FONT}`; c.fillText(money(r.total), x - cols[4].w / 2, mid);
    y += h;
  });
  need(56); c.fillStyle = '#f1f7f4'; c.fillRect(M, y, W - 2 * M, 52); c.fillStyle = '#0d5c46'; c.font = `800 25px ${FONT}`; c.textAlign = 'right'; c.fillText('المجموع الكلي', W - M - 20, y + 26); c.textAlign = 'center'; c.fillText(money(R.sum), M + cols[4].w / 2, y + 26); y += 80;
  // المراكز في كل فئة
  PRIZE_CATS.filter(({ k }) => R.cfg.cats[k].on).forEach(({ k, t, ic }) => {
    need(90); c.textAlign = 'right'; c.fillStyle = '#0d5c46'; c.font = `700 26px ${FONT}`; c.fillText(`${ic} ${t}`, W - M, y); y += 38;
    (R.byCat[k].length ? R.byCat[k] : [null]).forEach((x) => { need(32); c.fillStyle = x?.off ? '#999' : '#333'; c.font = `400 21px ${FONT}`; c.fillText(x ? `${ORD[x.rank]}: ${x.name} (${x.cls}) — ${money(x.amt)}${x.off ? ' — لم تُحتسب' : ''}` : '—', W - M - 20, y); y += 32; });
    y += 18;
  });
  need(120); y += 30; c.textAlign = 'center'; c.fillStyle = '#555'; c.font = `500 22px ${FONT}`;
  [['معلم المادة', W - M - 180], ['المعلم الأول', W / 2], ['مدير المدرسة', M + 180]].forEach(([l, x]) => { c.fillText(l, x, y); c.strokeStyle = '#bbb'; c.beginPath(); c.moveTo(x - 140, y + 60); c.lineTo(x + 140, y + 60); c.stroke(); });
  const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  pages.forEach((p, i) => { if (i) pdf.addPage(); pdf.addImage(p.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297); });
  pdf.save(`jawaez-${String(R.perT).replace(/\s+/g, '-')}.pdf`);
}
