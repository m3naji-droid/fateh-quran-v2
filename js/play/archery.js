// 🎯 الرماية: يظهر السؤال في الأعلى، وتصعد بالونات تحمل الإجابات، فيرمي الطالب البالون الصحيح.
// أسئلة الترتيب والتوصيل تظهر في بطاقتها المعتادة.
import { createGame, rand, ar, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);
const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899'];

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage);
    const c = g.c, Q = api.qs.length, st = { cd: 0 }, esc = api.esc;
    const top = document.createElement('div'); top.className = 'ar-q'; top.hidden = true;
    const field = document.createElement('div'); field.className = 'ar-field';
    stage.append(field, top);
    let state = 'count', T = 0, qi = 0, hits = 0, balloons = [], arrow = null, aim = -Math.PI / 2, qT = 0, lim = 25, cur = null;
    const fx = [], parts = [], clouds = Array.from({ length: 5 }, () => ({ x: Math.random(), y: rand(0.08, 0.5), s: rand(0.6, 1.2) }));
    const hud = () => api.hud({ a: `🎯 ${ar(hits)}/${ar(Q)}`, b: `<span>سؤال ${ar(Math.min(qi + 1, Q))}</span>`, p: qi / Q });
    hud();
    const bow = () => ({ x: g.W / 2, y: g.H - 70 });
    const clear = () => { field.innerHTML = ''; balloons = []; top.hidden = true; };
    const next = () => {
      clear();
      if (qi >= Q) { state = 'done'; T = 0; api.sfx.win(); return; }
      const q = api.qs[qi]; cur = q; hud();
      if (q.t !== 'mcq' && q.t !== 'tf') {
        state = 'q';
        api.ask(q).then((ok) => { if (!K.G) return; if (ok) hits++; qi++; g.last = performance.now(); next(); });
        return;
      }
      const opts = q.t === 'tf' ? [{ x: '✔ صواب', ok: !!q.a }, { x: '✘ خطأ', ok: !q.a }] : q.a.map((x, i) => ({ x, ok: i === 0 })).sort(() => Math.random() - 0.5);
      top.innerHTML = `<div class="ar-qt"><span>سؤال ${ar(qi + 1)} من ${ar(Q)}</span><i class="ar-tm"><b></b></i></div><p>${esc(q.q)}</p>${q.vh ? `<div class="pq-v quran">${q.vh}</div>` : q.v ? `<div class="pq-v quran">${esc(q.v)}</div>` : ''}`;
      top.hidden = false;
      const cols = opts.length <= 2 ? [0.27, 0.73] : [0.27, 0.73, 0.27, 0.73];
      balloons = opts.map((o, i) => {
        const el = document.createElement('button'); el.type = 'button'; el.className = 'ar-b' + (q.qf ? ' qf' : '');
        el.style.setProperty('--bc', COLORS[(qi + i) % COLORS.length]);
        el.innerHTML = `<i class="ar-ball" aria-hidden="true"></i><span class="ar-t">${esc(o.x)}</span>`;
        field.append(el);
        if (location.hostname === 'localhost') el._ok = o.ok; // للاختبار المحلي فقط
        const b = { el, o, cx: cols[i % cols.length], y: g.H * (opts.length <= 2 ? 0.5 : 0.36 + Math.floor(i / 2) * 0.27) + (i % 2) * 36, v: rand(18, 26), ph: rand(0, 6), dead: false };
        g.on(el, 'click', () => shoot(b));
        return b;
      });
      lim = q.qf ? 30 : 25; qT = 0; state = 'aim';
    };
    const shoot = (b) => {
      if (state !== 'aim' || b.dead) return;
      state = 'fly'; api.sfx.tap();
      const r = b.el.getBoundingClientRect(), s = g.cv.getBoundingClientRect();
      const tx = r.left - s.left + r.width / 2, ty = r.top - s.top + 30, o = bow();
      aim = Math.atan2(ty - o.y, tx - o.x);
      arrow = { x: o.x, y: o.y, tx, ty, t: 0, b };
    };
    const settle = (ok, why) => {
      state = 'q';
      const q = cur;
      if (ok) hits++;
      balloons.forEach((x) => { if (!x.dead) x.el.classList.add('gone'); });
      setTimeout(() => {
        if (!K.G) return;
        top.hidden = true;
        api.report(q, ok, why).then(() => { if (!K.G) return; qi++; g.last = performance.now(); next(); });
      }, ok ? 650 : 450);
    };
    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) next(); return; }
      T += dt;
      if (state === 'done') { if (T > 1.6) { const out = { stats: [{ v: `🎯 ${ar(hits)}/${ar(Q)}`, l: 'إصابات صحيحة' }] }; K.stop(); resolve(out); } return; }
      if (state === 'q') return;
      if (state === 'aim') {
        qT += dt; const bar = top.querySelector('.ar-tm b'); if (bar) { bar.style.width = Math.max(0, 1 - qT / lim) * 100 + '%'; bar.classList.toggle('low', lim - qT < 6); }
        if (qT >= lim) { settle(false, 'time'); return; }
      }
      balloons.forEach((b) => {
        if (b.dead) return;
        b.y -= b.v * dt; if (b.y < -b.el.offsetHeight - 10) b.y = g.H + 20;
        const minY = top.hidden ? 0 : top.offsetHeight + 4;
        if (b.y < minY - b.el.offsetHeight) b.y = g.H + 20;
        const x = b.cx * g.W + Math.sin(T * 1.4 + b.ph) * 10 - b.el.offsetWidth / 2;
        b.el.style.transform = `translate(${x}px, ${b.y}px)`;
      });
      if (arrow) {
        arrow.t += dt / 0.22;
        if (arrow.t >= 1) {
          const b = arrow.b; arrow = null; b.dead = true; b.el.classList.add('pop', b.o.ok ? 'right' : 'wrong');
          const r = b.el.getBoundingClientRect(), s = g.cv.getBoundingClientRect();
          burst(parts, r.left - s.left + r.width / 2, r.top - s.top + 30, 18, b.o.ok ? ['#fde047', '#4ade80', '#fff'] : ['#f87171', '#fca5a5'], 220);
          fx.push({ txt: b.o.ok ? '🎯 إصابة!' : '✘', color: b.o.ok ? '#4ade80' : '#f87171', t: 0, x: r.left - s.left + r.width / 2, y: r.top - s.top + 10 });
          if (!b.o.ok) balloons.forEach((x) => { if (x.o.ok) x.el.classList.add('right'); });
          settle(b.o.ok);
        }
      }
      stepFx(fx, dt); stepParts(parts, dt);
    }
    function draw() {
      const W = g.W, H = g.H;
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#38bdf8'); sky.addColorStop(1, '#bae6fd');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      clouds.forEach((k) => { const x = ((k.x * W + T * 12 * k.s) % (W + 160)) - 80, y = H * k.y; c.fillStyle = 'rgba(255,255,255,.85)'; [[0, 0, 16], [16, -7, 20], [34, 0, 16]].forEach(([a, b, r]) => { c.beginPath(); c.arc(x + a * k.s, y + b * k.s, r * k.s, 0, 7); c.fill(); }); });
      c.fillStyle = '#86efac'; c.beginPath(); c.moveTo(0, H - 40); for (let x = 0; x <= W; x += 20) c.lineTo(x, H - 50 - Math.sin(x / 70) * 12); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      const o = bow();
      c.save(); c.translate(o.x, o.y); c.rotate(aim + Math.PI / 2);
      c.strokeStyle = '#92400e'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(0, 12, 34, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
      c.strokeStyle = '#e5e7eb'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(Math.cos(Math.PI * 1.12) * 34, 12 + Math.sin(Math.PI * 1.12) * 34); c.lineTo(0, arrow ? -8 : 10); c.lineTo(Math.cos(Math.PI * 1.88) * 34, 12 + Math.sin(Math.PI * 1.88) * 34); c.stroke();
      if (!arrow && state === 'aim') { c.strokeStyle = '#78350f'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -40); c.stroke(); c.fillStyle = '#6b7280'; c.beginPath(); c.moveTo(0, -48); c.lineTo(-5, -38); c.lineTo(5, -38); c.fill(); }
      c.restore();
      if (arrow) { const x = arrow.x + (arrow.tx - arrow.x) * arrow.t, y = arrow.y + (arrow.ty - arrow.y) * arrow.t; c.save(); c.translate(x, y); c.rotate(aim); c.strokeStyle = '#78350f'; c.lineWidth = 3; c.beginPath(); c.moveTo(-40, 0); c.lineTo(0, 0); c.stroke(); c.fillStyle = '#6b7280'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-2, -5); c.lineTo(-2, 5); c.fill(); c.restore(); }
      drawParts(c, parts);
      drawFx(c, fx, W / 2, H / 2, 1.4, 22);
      if (state === 'count') drawCountdown(c, W, H, st.cd, 0.42);
      if (state === 'done') { c.save(); c.textAlign = 'center'; c.font = '800 28px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 5; const s = `🏹 ${ar(hits)}/${ar(Q)}`; c.strokeText(s, W / 2, H * 0.4); c.fillText(s, W / 2, H * 0.4); c.restore(); }
    }
    K.loop(update, draw);
  });
}
