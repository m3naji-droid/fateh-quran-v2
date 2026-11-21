// 🌳 شجرة الأخلاق: اجمع قطرات المطر بالدلو، ثم أجب لتسقي شجرتك.
// كل إجابة صحيحة غصن أخضر، والخطأ غصن يابس، وتثمر الشجرة إذا أتقنت الدرس.
import { createGame, rand, FONT, ar, rr, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage, '<button type="button" class="pg-btn" data-dir="-1" aria-label="يسار">◀</button><span class="pg-tip">حرّك الدلو لتجمع القطرات 💧</span><button type="button" class="pg-btn" data-dir="1" aria-label="يمين">▶</button>');
    const c = g.c, Q = api.qs.length, st = { cd: 0 }, CATCH = 4.5;
    let state = 'count', T = 0, qi = 0, okN = 0, drops = 0, phaseT = 0, bx = 0.5, hold = 0, grow = 0, endT = 0, cloudX = 0.5;
    const branches = [], rain = [], fx = [], parts = [], birds = [];
    const gy = () => g.H * 0.8;
    g.ctl.querySelectorAll('[data-dir]').forEach((b) => { g.on(b, 'pointerdown', (e) => { e.preventDefault(); hold = +b.dataset.dir; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => g.on(b, ev, () => (hold = 0))); });
    let dragging = false;
    const setX = (e) => { const r = g.cv.getBoundingClientRect(); bx = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / g.W)); };
    g.on(g.cv, 'pointerdown', (e) => { dragging = true; setX(e); });
    g.on(window, 'pointermove', (e) => { if (dragging) setX(e); });
    g.on(window, 'pointerup', () => (dragging = false));
    g.on(window, 'keydown', (e) => { if (e.key === 'ArrowLeft') hold = -1; if (e.key === 'ArrowRight') hold = 1; });
    g.on(window, 'keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') hold = 0; });
    const hud = () => api.hud({ a: `🌿 ${ar(okN)}/${ar(Q)}`, b: `<span>💧 ${ar(drops)}</span>`, p: qi / Q });
    hud();
    const ask = () => {
      state = 'q'; rain.length = 0;
      api.ask(api.qs[qi]).then((ok) => {
        if (!K.G) return;
        qi++; if (ok) okN++;
        branches.push({ ok, side: branches.length % 2 ? -1 : 1, at: 0.35 + (branches.length / Math.max(1, Q)) * 0.55, len: rand(0.75, 1), born: T });
        fx.push({ txt: ok ? '🌿 نما غصن جديد' : '🍂 غصن يابس', color: ok ? '#4ade80' : '#fca5a5', t: 0 });
        if (ok) burst(parts, g.W / 2, gy() - 120, 12, ['#4ade80', '#86efac'], 140);
        state = 'grow'; phaseT = 0; g.last = performance.now(); hud();
      });
    };
    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) { state = 'catch'; phaseT = 0; } return; }
      if (state === 'q') return;
      T += dt; phaseT += dt;
      if (hold) bx = Math.max(0.06, Math.min(0.94, bx + hold * dt * 1.1));
      cloudX = 0.5 + Math.sin(T * 0.9) * 0.34;
      if (state === 'catch') {
        if (Math.random() < dt * 7) rain.push({ x: cloudX * g.W + rand(-40, 40), y: g.H * 0.16, vy: rand(160, 240) });
        const by = gy() - 40;
        for (let i = rain.length - 1; i >= 0; i--) {
          const r = rain[i]; r.vy += 300 * dt; r.y += r.vy * dt;
          if (r.y > by - 6 && r.y < by + 16 && Math.abs(r.x - bx * g.W) < 30) { rain.splice(i, 1); drops++; api.sfx.tap(); hud(); continue; }
          if (r.y > gy()) { rain.splice(i, 1); }
        }
        if (phaseT > CATCH) ask();
      }
      if (state === 'grow') { grow = Math.min(qi / Q, grow + dt * 0.6); if (phaseT > 1) { if (qi >= Q) { state = 'done'; endT = T; if (okN / Q >= 0.75) { api.sfx.win(); fx.push({ txt: '🍎 أثمرت شجرتك!', color: '#fde047', t: 0 }); for (let i = 0; i < 4; i++) birds.push({ x: rand(-160, 0), y: rand(40, g.H * 0.3), v: rand(60, 100), ph: rand(0, 6) }); } } else { state = 'catch'; phaseT = 0; } } }
      birds.forEach((b) => (b.x += b.v * dt));
      if (state === 'done' && T - endT > 2.6) { const out = { stats: [{ v: `🌿 ${ar(okN)}/${ar(Q)}`, l: 'أغصان خضراء' }, { v: `💧 ${ar(drops)}`, l: 'قطرات جمعتها' }] }; K.stop(); resolve(out); return; }
      stepFx(fx, dt); stepParts(parts, dt);
    }
    function leaves(x, y, r, ok) {
      if (!ok) return;
      [[0, 0, 1], [-0.7, 0.3, 0.75], [0.7, 0.3, 0.75], [0, -0.6, 0.8]].forEach(([a, b, s]) => { c.fillStyle = s === 1 ? '#16a34a' : '#22c55e'; c.beginPath(); c.arc(x + a * r, y + b * r, r * s, 0, 7); c.fill(); });
    }
    function draw() {
      const W = g.W, H = g.H, g0 = gy(), fr = state === 'done' && okN / Q >= 0.75;
      const sky = c.createLinearGradient(0, 0, 0, g0); sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#f0f9ff');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = '#fde68a'; c.beginPath(); c.arc(W * 0.85, H * 0.1, 24, 0, 7); c.fill();
      // الغيمة
      const cx = cloudX * W, cy = H * 0.12;
      c.fillStyle = state === 'catch' ? '#94a3b8' : '#f8fafc';
      [[0, 0, 30], [-32, 8, 22], [32, 8, 22], [-14, -14, 22], [16, -12, 20]].forEach(([a, b, r]) => { c.beginPath(); c.arc(cx + a, cy + b, r, 0, 7); c.fill(); });
      c.fillStyle = '#60a5fa'; rain.forEach((r) => { c.beginPath(); c.moveTo(r.x, r.y - 8); c.quadraticCurveTo(r.x + 5, r.y, r.x, r.y + 4); c.quadraticCurveTo(r.x - 5, r.y, r.x, r.y - 8); c.fill(); });
      // الأرض
      c.fillStyle = '#4ade80'; c.beginPath(); c.moveTo(0, g0 + 10); c.quadraticCurveTo(W / 2, g0 - 26, W, g0 + 10); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.fillStyle = '#16a34a'; c.fillRect(0, g0 + 30, W, H);
      // الشجرة
      const tx = W / 2, base = g0 - 8, th = 50 + grow * H * 0.36, tw = 10 + grow * 12;
      c.fillStyle = '#92400e'; c.beginPath(); c.moveTo(tx - tw, base); c.quadraticCurveTo(tx - tw * 0.4, base - th * 0.5, tx - tw * 0.35, base - th); c.lineTo(tx + tw * 0.35, base - th); c.quadraticCurveTo(tx + tw * 0.4, base - th * 0.5, tx + tw, base); c.fill();
      branches.forEach((b) => {
        const k = Math.min(1, (T - b.born) / 0.6), y = base - th * b.at, len = (36 + grow * 60) * b.len * k, ex = tx + b.side * len, ey = y - len * 0.45;
        c.strokeStyle = b.ok ? '#92400e' : '#a8a29e'; c.lineWidth = b.ok ? 6 : 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(tx, y); c.quadraticCurveTo(tx + b.side * len * 0.5, y - 4, ex, ey); c.stroke();
        if (!b.ok) { c.lineWidth = 2; c.beginPath(); c.moveTo(ex - b.side * 10, ey + 2); c.lineTo(ex - b.side * 4, ey + 12); c.stroke(); }
        leaves(ex, ey, (12 + grow * 10) * k, b.ok);
        if (fr && b.ok) { c.fillStyle = '#ef4444'; c.beginPath(); c.arc(ex + 4, ey + 8, 6, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(ex + 2, ey + 5, 2, 2); }
      });
      leaves(tx, base - th - 6, 16 + grow * 22, true);
      if (fr) { c.fillStyle = '#ef4444'; [[-14, 4], [12, 10], [0, -14]].forEach(([a, b]) => { c.beginPath(); c.arc(tx + a, base - th + b, 6, 0, 7); c.fill(); }); }
      // الدلو
      if (state === 'catch' || state === 'count') {
        const x = bx * W, y = g0 - 40;
        c.fillStyle = api.color; c.beginPath(); c.moveTo(x - 24, y); c.lineTo(x + 24, y); c.lineTo(x + 18, y + 30); c.lineTo(x - 18, y + 30); c.fill();
        c.strokeStyle = '#334155'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 22, Math.PI, 0); c.stroke();
        c.fillStyle = '#60a5fa'; c.fillRect(x - 20, y + 2, 40, 5);
        const left = Math.max(0, CATCH - phaseT); if (state === 'catch') { c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, W / 2 - 70, 8, 140, 26, 13); c.fill(); c.fillStyle = '#fff'; c.font = `700 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`💧 اجمع القطرات: ${ar(Math.ceil(left))}`, W / 2, 21); }
      }
      birds.forEach((b) => { const y = b.y + Math.sin(T * 3 + b.ph) * 8, w = Math.sin(T * 12 + b.ph) * 6; c.strokeStyle = '#1f2937'; c.lineWidth = 2; c.beginPath(); c.moveTo(b.x - 10, y - w); c.quadraticCurveTo(b.x - 4, y - 4, b.x, y); c.quadraticCurveTo(b.x + 4, y - 4, b.x + 10, y - w); c.stroke(); });
      drawParts(c, parts);
      drawFx(c, fx, W / 2, H * 0.3, 1.4, 22);
      if (state === 'count') drawCountdown(c, W, H, st.cd, 0.4);
    }
    K.loop(update, draw);
  });
}
