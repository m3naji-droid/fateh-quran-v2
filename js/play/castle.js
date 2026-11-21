// 🏰 كنز القلعة: الفارس يمشي في ممرات القلعة، وعند كل باب سؤال.
// الصحيح: مفتاح ذهبي يفتح الباب، والخطأ: الباب يبقى مقفلاً فيسلك الممر السري الطويل. الخفافيش تُصاد بالنقر لعملات إضافية.
import { createGame, rand, FONT, ar, rr, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage, '<span class="pg-tip">انقر الخفافيش لتجمع عملات 🦇 — وأجب عند كل باب لتأخذ مفتاحه</span>');
    const c = g.c, Q = api.qs.length, S = 900, F = (Q + 1) * S, V = 190;
    const P = { s: 0 }, st = { cd: 0 };
    let state = 'count', T = 0, keys = 0, coins = 0, tunnelU = 0, endT = 0, openAt = -1, openT = 0;
    const doors = api.qs.map((_, i) => ({ s: (i + 1) * S, i, done: false, ok: null, open: 0 }));
    const bats = [], fx = [], parts = [];
    const torches = []; for (let s = 120; s < F + 600; s += 260) torches.push(s);
    const gy = () => Math.round(g.H * 0.74), px = () => Math.round(g.W * 0.7), X = (s) => px() - (s - P.s);
    g.on(g.cv, 'pointerdown', (e) => {
      const b = g.cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const hit = bats.find((t) => !t.dead && Math.hypot(t.x - x, t.y - y) < 34);
      if (hit) { hit.dead = true; coins++; api.sfx.coin(); burst(parts, hit.x, hit.y, 10, ['#fde047', '#a78bfa'], 160); fx.push({ txt: '+🪙', color: '#fde047', t: 0, x: hit.x, y: hit.y }); hud(); }
    });
    const hud = () => api.hud({ a: `🗝️ ${ar(keys)}/${ar(Q)}`, b: `<span>🪙 ${ar(coins)}</span>`, p: P.s / F });
    hud();
    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) state = 'run'; return; }
      if (state === 'q') return;
      T += dt;
      if (openAt >= 0) { openT += dt; doors[openAt].open = Math.min(1, openT / 0.7); if (openT > 0.8) { openAt = -1; } else return; }
      const v = V * (T < tunnelU ? 0.55 : 1) * (state === 'done' ? 0.4 : 1) * Math.min(1, 0.4 + T);
      P.s += v * dt;
      if (Math.random() < dt * 0.55 && state === 'run') { const fromL = Math.random() < 0.5; bats.push({ x: fromL ? -30 : g.W + 30, y: rand(g.H * 0.12, gy() - 140), vx: (fromL ? 1 : -1) * rand(90, 150), ph: rand(0, 6), dead: false }); }
      bats.forEach((b) => { b.x += b.vx * dt; b.y += Math.sin(T * 3 + b.ph) * 30 * dt; if (b.dead) b.y += 300 * dt; });
      for (let i = bats.length - 1; i >= 0; i--) if (bats[i].x < -60 || bats[i].x > g.W + 60 || bats[i].y > g.H) bats.splice(i, 1);
      if (state === 'run') {
        const d = doors.find((x) => !x.done && P.s >= x.s - 34);
        if (d) {
          d.done = true; state = 'q'; P.s = d.s - 34;
          api.ask(api.qs[d.i]).then((ok) => {
            if (!K.G) return;
            d.ok = ok;
            if (ok) { keys++; openAt = d.i; openT = 0; fx.push({ txt: '🗝️ فُتح الباب!', color: '#fde047', t: 0 }); burst(parts, X(d.s), gy() - 70, 16, ['#fde047', '#fbbf24'], 180); }
            else { tunnelU = T + 2.4; fx.push({ txt: '🕳️ الباب مقفل… الممر السري', color: '#fca5a5', t: 0 }); }
            state = 'run'; g.last = performance.now(); hud();
          });
        }
        if (P.s >= F) { state = 'done'; endT = T; api.sfx.win(); burst(parts, X(F) , gy() - 40, 40, ['#fde047', '#facc15', '#fff'], 260); fx.push({ txt: '💰 وجدت الكنز!', color: '#fde047', t: 0 }); }
      }
      if (state === 'done' && T - endT > 2) { const out = { stats: [{ v: `🗝️ ${ar(keys)}/${ar(Q)}`, l: 'مفاتيح جمعتها' }, { v: `🪙 ${ar(coins + keys * 3)}`, l: 'كنزك' }] }; K.stop(); resolve(out); return; }
      stepFx(fx, dt); stepParts(parts, dt);
    }
    function knight(x, y) {
      const walk = state === 'run' && openAt < 0, a = walk ? Math.sin(T * 12) * 0.6 : 0;
      c.save(); c.translate(x, y); c.lineCap = 'round';
      c.strokeStyle = '#374151'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(-3, -18); c.lineTo(-3 + Math.sin(a) * 11, 0); c.stroke(); c.beginPath(); c.moveTo(4, -18); c.lineTo(4 - Math.sin(a) * 11, 0); c.stroke();
      c.fillStyle = api.color; rr(c, -12, -50, 24, 34, 7); c.fill();
      c.fillStyle = '#fde047'; c.fillRect(-12, -30, 24, 4);
      c.fillStyle = '#9ca3af'; c.beginPath(); c.arc(0, -60, 11, 0, 7); c.fill(); c.fillStyle = '#1f2937'; c.fillRect(-9, -62, 12, 3);
      c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(0, -71); c.quadraticCurveTo(10, -82, 14, -72); c.fill();
      c.fillStyle = '#d1d5db'; rr(c, -24, -46, 10, 22, 4); c.fill();
      c.restore();
    }
    function draw() {
      const W = g.W, H = g.H, g0 = gy(), dark = T < tunnelU;
      c.fillStyle = dark ? '#111827' : '#44403c'; c.fillRect(0, 0, W, H);
      const off = (P.s * 1) % 60;
      c.strokeStyle = dark ? '#1f2937' : '#57534e'; c.lineWidth = 2;
      for (let y = 0; y < g0; y += 30) { const sh = (y / 30) % 2 ? 30 : 0; for (let x = -60 + ((off + sh) % 60); x < W + 60; x += 60) c.strokeRect(x, y, 60, 30); }
      if (!dark) for (const s of torches) {
        const x = X(s); if (x < -40 || x > W + 40) continue;
        const fl = 0.85 + Math.sin(T * 18 + s) * 0.15;
        const gr = c.createRadialGradient(x, g0 - 150, 2, x, g0 - 150, 90 * fl); gr.addColorStop(0, 'rgba(251,191,36,.35)'); gr.addColorStop(1, 'rgba(251,191,36,0)');
        c.fillStyle = gr; c.fillRect(x - 100, g0 - 250, 200, 200);
        c.fillStyle = '#78350f'; c.fillRect(x - 3, g0 - 140, 6, 22);
        c.fillStyle = '#f97316'; c.beginPath(); c.ellipse(x, g0 - 148, 6 * fl, 11 * fl, 0, 0, 7); c.fill(); c.fillStyle = '#fde047'; c.beginPath(); c.ellipse(x, g0 - 146, 3, 6 * fl, 0, 0, 7); c.fill();
      }
      c.fillStyle = dark ? '#0b0f19' : '#292524'; c.fillRect(0, g0, W, H - g0);
      c.fillStyle = dark ? '#111827' : '#3f3a36'; for (let x = -((-P.s) % 80) - 80; x < W + 80; x += 80) c.fillRect(x, g0 + 4, 76, 10);
      for (const d of doors) {
        const x = X(d.s); if (x < -80 || x > W + 80) continue;
        const h = 130, w = 66;
        c.fillStyle = '#1c1917'; rr(c, x - w / 2 - 8, g0 - h - 8, w + 16, h + 8, [40, 40, 0, 0]); c.fill();
        c.fillStyle = '#0c0a09'; rr(c, x - w / 2, g0 - h, w, h, [34, 34, 0, 0]); c.fill();
        const lift = d.open * (h - 10);
        c.save(); c.beginPath(); c.rect(x - w / 2, g0 - h, w, h); c.clip();
        c.fillStyle = d.done && !d.ok ? '#57534e' : '#92400e'; rr(c, x - w / 2, g0 - h - lift, w, h, [34, 34, 0, 0]); c.fill();
        c.strokeStyle = '#78350f'; c.lineWidth = 3; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - w / 2 + (i * w) / 4, g0 - h - lift + 8); c.lineTo(x - w / 2 + (i * w) / 4, g0 - lift); c.stroke(); }
        c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(x + 18, g0 - h / 2 - lift, 5, 0, 7); c.fill();
        c.restore();
        c.font = `900 24px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fde047';
        c.fillText(!d.done ? '🔒' : d.ok ? '' : '⛓️', x, g0 - h - 26);
      }
      { const x = X(F + 60); if (x > -80 && x < W + 80) { const o = state === 'done' ? Math.min(1, (T - endT) * 2) : 0; c.fillStyle = '#92400e'; rr(c, x - 34, g0 - 40, 68, 40, 4); c.fill(); c.fillStyle = '#b45309'; c.save(); c.translate(x - 34, g0 - 40); c.rotate(-o * 0.9); rr(c, 0, -22, 68, 22, [12, 12, 0, 0]); c.fill(); c.restore(); c.fillStyle = '#fbbf24'; c.fillRect(x - 34, g0 - 26, 68, 5); if (o > 0) { c.fillStyle = '#fde047'; c.beginPath(); c.arc(x, g0 - 44, 22 * o, 0, 7); c.fill(); } } }
      for (const b of bats) { c.save(); c.translate(b.x, b.y); c.scale(b.vx > 0 ? 1 : -1, 1); const fl = Math.sin(T * 20 + b.ph) * 0.6; c.fillStyle = b.dead ? '#6b7280' : '#1e1b4b'; c.beginPath(); c.ellipse(0, 0, 9, 7, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-18, -14 * fl - 4, -26, 2); c.quadraticCurveTo(-16, -2, -4, 4); c.fill(); c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(18, -14 * fl - 4, 26, 2); c.quadraticCurveTo(16, -2, 4, 4); c.fill(); c.fillStyle = '#fde047'; c.fillRect(2, -3, 2, 2); c.fillRect(-4, -3, 2, 2); c.restore(); }
      knight(px(), g0);
      if (dark) { const gr = c.createRadialGradient(px(), g0 - 40, 30, px(), g0 - 40, 200); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
      drawParts(c, parts);
      drawFx(c, fx, W / 2, g0 - 190, 1.4, 22);
      if (state === 'count') drawCountdown(c, W, H, st.cd, 0.36);
    }
    K.loop(update, draw);
  });
}
