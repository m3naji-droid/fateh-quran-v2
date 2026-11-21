// 🕌 ابنِ المسجد: كل إجابة صحيحة تعطيك حجراً تتأرجح به الرافعة، فتسقطه بدقة فوق المئذنة.
// الخطأ يضع سقالة رمادية مكان الحجر. ويكبر المسجد بجانبها مع كل إجابة صحيحة، وفي النهاية يُرفع الأذان.
import { createGame, rand, FONT, ar, rr, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage, '<span class="pg-tip">حين تتأرجح الرافعة فوق المئذنة اضغط لتُسقط الحجر</span><button type="button" class="pg-btn big" data-drop>⬇ أسقط</button>');
    const c = g.c, Q = api.qs.length, st = { cd: 0 };
    let state = 'count', T = 0, qi = 0, okN = 0, prec = [], swing = 0, fall = null, animT = 0, endT = 0, adhan = false;
    const blocks = [], fx = [], parts = [], birds = [];
    const L = () => { const gy = g.H * 0.86, bw = Math.min(74, g.W * 0.19), bh = Math.max(16, Math.min(30, (g.H * 0.52) / (Q + 1))), bx = g.W * 0.74; return { gy, bw, bh, bx, top: gy - blocks.length * bh }; };
    const drop = () => {
      if (state !== 'crane') return;
      const l = L(); state = 'fall'; api.sfx.tap();
      fall = { x: craneX(), y: Math.max(54, l.top - 150) + 30, vy: 0 };
    };
    const craneX = () => L().bx + Math.sin(swing) * g.W * 0.2;
    g.on(g.ctl.querySelector('[data-drop]'), 'pointerdown', (e) => { e.preventDefault(); drop(); });
    g.on(g.cv, 'pointerdown', (e) => { e.preventDefault(); drop(); });
    g.on(window, 'keydown', (e) => { if (e.key === ' ' || e.key === 'ArrowDown') { drop(); e.preventDefault(); } });
    const hud = () => api.hud({ a: `🧱 ${ar(okN)}/${ar(Q)}`, b: `<span>🎯 ${prec.length ? ar(Math.round((prec.reduce((a, b) => a + b, 0) / prec.length) * 100)) + '٪' : '—'}</span>`, p: qi / Q });
    hud();
    const next = () => {
      if (qi >= Q) { state = 'done'; endT = T; adhan = okN / Q >= 0.5; if (adhan) { api.sfx.win(); fx.push({ txt: 'اكتمل البناء! الله أكبر 🕌', color: '#fde047', t: 0 }); for (let i = 0; i < 6; i++) birds.push({ x: rand(-200, 0), y: rand(40, g.H * 0.3), v: rand(60, 110), ph: rand(0, 6) }); } else fx.push({ txt: 'البناء لم يكتمل… أعد المحاولة', color: '#fca5a5', t: 0 }); return; }
      state = 'q'; const q = api.qs[qi];
      api.ask(q).then((ok) => {
        if (!K.G) return;
        qi++;
        if (ok) { okN++; state = 'crane'; swing = rand(0, 6); }
        else { const l = L(); blocks.push({ dx: blocks.length ? blocks[blocks.length - 1].dx : 0, ok: false, born: T }); state = 'land'; animT = 0; fx.push({ txt: '🪵 سقالة مؤقتة', color: '#fca5a5', t: 0, y: l.top - 40 }); }
        g.last = performance.now(); hud();
      });
    };
    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) next(); return; }
      if (state === 'q') return;
      T += dt;
      if (state === 'crane') swing += dt * (1.6 + qi * 0.12);
      if (state === 'fall') {
        const l = L(); fall.vy += 1600 * dt; fall.y += fall.vy * dt;
        if (fall.y >= l.top) {
          const prev = blocks.length ? blocks[blocks.length - 1].dx : 0;
          let off = fall.x - l.bx - prev; const lim = l.bw * 0.45;
          const p = Math.max(0, 1 - Math.abs(off) / lim); off = Math.max(-lim, Math.min(lim, off));
          blocks.push({ dx: prev + off * 0.6, ok: true, born: T }); prec.push(p);
          const perfect = p > 0.85;
          fx.push({ txt: perfect ? '✨ مثالي!' : p > 0.5 ? '👍 جيد' : 'مائل قليلاً', color: perfect ? '#fde047' : '#e5e7eb', t: 0, y: l.top - 40 });
          if (perfect) { api.sfx.coin(); burst(parts, l.bx, l.top - l.bh, 14, ['#fde047', '#fff'], 150); } else api.sfx.bump();
          state = 'land'; animT = 0; fall = null; hud();
        }
      }
      if (state === 'land') { animT += dt; if (animT > 0.6) next(); }
      birds.forEach((b) => { b.x += b.v * dt; });
      if (state === 'done' && T - endT > 2.8) { const avg = prec.length ? Math.round((prec.reduce((a, b) => a + b, 0) / prec.length) * 100) : 0; const out = { stats: [{ v: `🧱 ${ar(okN)}/${ar(Q)}`, l: 'أحجار بنيتها' }, { v: `🎯 ${ar(avg)}٪`, l: 'دقة البناء' }] }; K.stop(); resolve(out); return; }
      stepFx(fx, dt); stepParts(parts, dt);
    }
    function mosque(l, f) {
      const x0 = g.W * 0.06, w = g.W * 0.5, h = Math.min(130, g.H * 0.2), y0 = l.gy - h;
      if (f <= 0) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([6, 6]); c.strokeRect(x0, y0, w, h); c.setLineDash([]); return; }
      const wallH = h * Math.min(1, f / 0.3);
      c.fillStyle = '#f5f5f4'; c.fillRect(x0, l.gy - wallH, w, wallH);
      c.fillStyle = '#d6d3d1'; c.fillRect(x0, l.gy - wallH, w, 8);
      if (f >= 0.3) { const n = 4; for (let i = 0; i < n; i++) { const ax = x0 + w * (0.12 + i * 0.22), aw = w * 0.12; c.fillStyle = f >= 0.6 ? '#0e7490' : '#a8a29e'; rr(c, ax, y0 + h * 0.3, aw, h * 0.35, [aw / 2, aw / 2, 0, 0]); c.fill(); } }
      if (f >= 0.4) { c.fillStyle = '#78350f'; rr(c, x0 + w / 2 - w * 0.08, l.gy - h * 0.45, w * 0.16, h * 0.45, [w * 0.08, w * 0.08, 0, 0]); c.fill(); }
      if (f >= 0.5) { const s = Math.min(1, (f - 0.5) / 0.3), r = w * 0.22 * s; c.fillStyle = '#0f766e'; c.beginPath(); c.arc(x0 + w / 2, y0, r, Math.PI, 0); c.fill(); c.fillStyle = '#115e59'; c.fillRect(x0 + w / 2 - r, y0 - 3, r * 2, 6); }
      if (f >= 0.8) { const cx = x0 + w / 2, cy = y0 - w * 0.22 - 14; c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, y0 - w * 0.22); c.lineTo(cx, cy + 6); c.stroke(); c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(cx, cy, 7, 0.6, 5.7); c.fill(); }
      if (f >= 1 && adhan) { for (let i = 0; i < 8; i++) { c.fillStyle = `hsla(${(T * 80 + i * 45) % 360},90%,65%,.9)`; c.beginPath(); c.arc(x0 + 10 + (i * (w - 20)) / 7, y0 + 4, 3, 0, 7); c.fill(); } }
    }
    function draw() {
      const W = g.W, H = g.H, l = L(), f = okN / Q;
      const sky = c.createLinearGradient(0, 0, 0, l.gy); sky.addColorStop(0, adhan ? '#f59e0b' : '#38bdf8'); sky.addColorStop(1, adhan ? '#fde68a' : '#e0f2fe');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = adhan ? '#fef3c7' : '#fde68a'; c.beginPath(); c.arc(W * 0.15, H * 0.14, 26, 0, 7); c.fill();
      c.fillStyle = '#d6b98c'; c.fillRect(0, l.gy, W, H - l.gy);
      c.fillStyle = '#c4a574'; for (let x = 0; x < W; x += 34) c.fillRect(x, l.gy + 10, 18, 4);
      mosque(l, f);
      // المئذنة
      c.fillStyle = '#a8a29e'; c.fillRect(l.bx - l.bw * 0.6, l.gy - 6, l.bw * 1.2, 6);
      blocks.forEach((b, i) => {
        const y = l.gy - (i + 1) * l.bh, x = l.bx + b.dx - l.bw / 2, drop = Math.max(0, 1 - (T - b.born) / 0.25);
        if (b.ok) { c.fillStyle = i % 2 ? '#fafaf9' : '#e7e5e4'; c.fillRect(x, y - drop * 8, l.bw, l.bh - 1); c.fillStyle = api.color; c.fillRect(x, y + l.bh - 5 - drop * 8, l.bw, 4); if (i % 3 === 1) { c.fillStyle = '#0e7490'; rr(c, x + l.bw / 2 - 5, y + 4, 10, l.bh - 10, [5, 5, 0, 0]); c.fill(); } }
        else { c.strokeStyle = '#78716c'; c.lineWidth = 2; c.strokeRect(x + 4, y, l.bw - 8, l.bh - 1); c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + l.bw - 4, y + l.bh - 1); c.moveTo(x + l.bw - 4, y); c.lineTo(x + 4, y + l.bh - 1); c.stroke(); }
      });
      if (state === 'done' && okN / Q >= 0.5) {
        const top = l.top, x = l.bx + (blocks[blocks.length - 1]?.dx || 0);
        c.fillStyle = '#e7e5e4'; c.fillRect(x - l.bw * 0.65, top - 8, l.bw * 1.3, 8);
        c.fillStyle = '#0f766e'; c.beginPath(); c.moveTo(x - l.bw * 0.45, top - 8); c.lineTo(x, top - 8 - l.bw * 0.9); c.lineTo(x + l.bw * 0.45, top - 8); c.fill();
        c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(x, top - 18 - l.bw * 0.9, 8, 0.6, 5.7); c.fill();
      }
      // الرافعة
      if (state === 'crane' || state === 'fall') {
        const hy = Math.max(54, l.top - 150);
        c.fillStyle = '#facc15'; c.fillRect(0, hy - 34, W, 8);
        c.strokeStyle = '#a16207'; c.lineWidth = 2; for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, hy - 34); c.lineTo(x + 8, hy - 26); c.stroke(); }
        const cx = state === 'crane' ? craneX() : fall.x;
        c.fillStyle = '#374151'; c.fillRect(cx - 14, hy - 30, 28, 10);
        if (state === 'crane') { c.strokeStyle = '#111827'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, hy - 20); c.lineTo(cx, hy + 26); c.stroke(); }
        const by = state === 'crane' ? hy + 30 : fall.y;
        c.fillStyle = '#fafaf9'; c.fillRect(cx - l.bw / 2, by - l.bh, l.bw, l.bh - 1); c.fillStyle = api.color; c.fillRect(cx - l.bw / 2, by - 5, l.bw, 4);
        if (state === 'crane') { c.strokeStyle = 'rgba(255,255,255,.6)'; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(l.bx + (blocks[blocks.length - 1]?.dx || 0), l.top - 4); c.lineTo(l.bx + (blocks[blocks.length - 1]?.dx || 0), by + 6); c.stroke(); c.setLineDash([]); }
      }
      birds.forEach((b) => { const y = b.y + Math.sin(T * 3 + b.ph) * 8, w = Math.sin(T * 12 + b.ph) * 6; c.strokeStyle = '#1f2937'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x - 10, y - w); c.quadraticCurveTo(b.x - 4, y - 4, b.x, y); c.quadraticCurveTo(b.x + 4, y - 4, b.x + 10, y - w); c.stroke(); });
      drawParts(c, parts);
      drawFx(c, fx, W / 2, H * 0.3, 1.4, 22);
      if (state === 'count') drawCountdown(c, W, H, st.cd, 0.36);
    }
    K.loop(update, draw);
  });
}
