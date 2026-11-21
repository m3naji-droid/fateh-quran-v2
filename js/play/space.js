// 🚀 مهمة فضائية: المركبة تطير بين الكواكب وتتفادى النيازك. عند كل كوكب سؤال:
// الصحيح يملأ الوقود ويضيء الكوكب، والخطأ يُدخل المركبة في عاصفة نيازك. الاصطدام يُنقص الدرع.
import { createGame, rand, FONT, ar, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);
const PLANETS = [['#f97316', '#fdba74'], ['#3b82f6', '#93c5fd'], ['#a855f7', '#d8b4fe'], ['#10b981', '#6ee7b7'], ['#ef4444', '#fca5a5'], ['#eab308', '#fde68a'], ['#06b6d4', '#a5f3fc'], ['#ec4899', '#f9a8d4']];

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage, '<button type="button" class="pg-btn" data-dir="-1" aria-label="يسار">◀</button><span class="pg-tip">اسحب المركبة أو اضغط الأسهم</span><button type="button" class="pg-btn" data-dir="1" aria-label="يمين">▶</button>');
    const c = g.c, Q = api.qs.length, S = 1250, F = (Q + 1) * S, V = 260;
    const P = { d: 0, x: 0.5, vx: 0 }, st = { cd: 0 };
    let state = 'count', T = 0, okN = 0, fuel = 100, shield = 3, crystals = 0, stormU = 0, boostU = 0, hitU = 0, shake = 0, endT = 0, hold = 0, drag = null;
    const planets = api.qs.map((_, i) => ({ d: (i + 1) * S, i, x: i % 2 ? 0.28 : 0.72, col: PLANETS[i % PLANETS.length], done: false, ok: null, r: rand(46, 62) }));
    const rocks = [], gems = [], fx = [], parts = [];
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.2, 1) }));
    for (let d = 500; d < F; d += rand(320, 520)) if (!planets.some((p) => Math.abs(p.d - d) < 260)) gems.push({ d, x: rand(0.15, 0.85), got: false });
    let nextRock = 300;
    const spawn = (d) => rocks.push({ d, x: rand(0.08, 0.92), r: rand(12, 24), vx: rand(-0.05, 0.05), rot: rand(0, 6), vr: rand(-2, 2), hit: false });
    for (let d = 400; d < 1200; d += rand(160, 260)) spawn(d);
    g.ctl.querySelectorAll('[data-dir]').forEach((b) => {
      g.on(b, 'pointerdown', (e) => { e.preventDefault(); hold = +b.dataset.dir; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => g.on(b, ev, () => (hold = 0)));
    });
    g.on(g.cv, 'pointerdown', (e) => { drag = e.clientX; });
    g.on(window, 'pointermove', (e) => { if (drag == null) return; P.x = Math.max(0.06, Math.min(0.94, P.x + (e.clientX - drag) / g.W)); drag = e.clientX; });
    g.on(window, 'pointerup', () => (drag = null));
    g.on(window, 'keydown', (e) => { if (e.key === 'ArrowLeft') hold = -1; if (e.key === 'ArrowRight') hold = 1; });
    g.on(window, 'keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') hold = 0; });
    const shipY = () => g.H * 0.78, Y = (d) => shipY() - (d - P.d);
    const hud = () => api.hud({ a: `🛡️ ${'●'.repeat(shield)}${'○'.repeat(3 - shield)} ⛽ ${ar(Math.round(fuel))}٪`, b: `<span>🪐 ${ar(okN)}/${ar(Q)}</span> <span>💎 ${ar(crystals)}</span>`, p: P.d / F });
    hud();
    const float = (txt, color) => fx.push({ txt, color, t: 0 });

    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) state = 'run'; return; }
      if (state === 'q') return;
      T += dt;
      const low = fuel <= 0;
      const v = V * (T < boostU ? 1.5 : 1) * (low ? 0.55 : 1) * (T < hitU ? 0.7 : 1) * (state === 'done' ? 0.4 : 1) * Math.min(1, 0.4 + T);
      P.d += v * dt;
      fuel = Math.max(0, fuel - dt * 5.5);
      if (hold) P.x = Math.max(0.06, Math.min(0.94, P.x + hold * dt * 0.9));
      if (P.d + g.H > nextRock) { spawn(nextRock); nextRock += T < stormU ? rand(70, 120) : rand(170, 300); }
      rocks.forEach((r) => { r.x += r.vx * dt; r.rot += r.vr * dt; });
      for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].d < P.d - 200) rocks.splice(i, 1);
      if (Math.random() < 0.7) parts.push({ x: P.x * g.W + rand(-5, 5), y: shipY() + 26, vx: rand(-20, 20), vy: rand(80, 160), life: 0.35, c: T < boostU ? '#fde047' : '#fb923c', r: rand(2, 4), g: 0 });
      if (state === 'run') {
        const sx = P.x * g.W;
        for (const r of rocks) {
          if (r.hit || Math.abs(r.d - P.d) > r.r + 12) continue;
          if (Math.abs(r.x * g.W - sx) < r.r + 14) { r.hit = true; if (T < boostU) { burst(parts, r.x * g.W, Y(r.d), 10, ['#a8a29e', '#fde047'], 160); continue; } shield--; hitU = T + 0.6; shake = 0.35; api.sfx.bump(); burst(parts, sx, shipY(), 12, ['#f87171', '#fdba74'], 180); if (shield <= 0) { shield = 3; const lost = Math.min(crystals, 3); crystals -= lost; float(lost ? `تضرّرت! −${ar(lost)} 💎` : 'تضرّرت المركبة!', '#f87171'); } else float('💥', '#f87171'); hud(); }
        }
        for (const k of gems) { if (k.got || Math.abs(k.d - P.d) > 20) continue; if (Math.abs(k.x * g.W - sx) < 26) { k.got = true; crystals++; api.sfx.coin(); hud(); } }
        const pl = planets.find((p) => !p.done && P.d >= p.d - 40);
        if (pl) {
          pl.done = true; state = 'q'; hud();
          api.ask(api.qs[pl.i]).then((ok) => {
            if (!K.G) return;
            pl.ok = ok;
            if (ok) { okN++; fuel = 100; boostU = T + 2.2; float('⛽ وقود كامل!', '#4ade80'); burst(parts, pl.x * g.W, Y(pl.d), 24, ['#fde047', '#4ade80', '#fff'], 220); }
            else { stormU = T + 4; nextRock = P.d + g.H * 0.6; float('☄️ عاصفة نيازك!', '#f87171'); }
            state = 'run'; g.last = performance.now(); hud();
          });
        }
        if (P.d >= F) { state = 'done'; endT = T; api.sfx.win(); float('🏁 وصلت إلى المحطة!', '#fde047'); }
        if (low && Math.random() < 0.01) float('⛽ الوقود منخفض! أجب لتملأه', '#fdba74');
      }
      if (state === 'done' && T - endT > 1.8) { const out = { stats: [{ v: `🪐 ${ar(okN)}/${ar(Q)}`, l: 'كواكب أضأتها' }, { v: `💎 ${ar(crystals)}`, l: 'بلورات جمعتها' }] }; K.stop(); resolve(out); return; }
      stepFx(fx, dt); stepParts(parts, dt); shake = Math.max(0, shake - dt);
      if (Math.random() < 0.08) hud();
    }
    function ship(x, y) {
      c.save(); c.translate(x, y); c.rotate(hold * 0.15);
      if (T < boostU) { c.fillStyle = 'rgba(253,224,71,.25)'; c.beginPath(); c.arc(0, 0, 38, 0, 7); c.fill(); }
      if (T < hitU && Math.floor(T * 14) % 2) c.globalAlpha = 0.4;
      c.fillStyle = '#e5e7eb'; c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(14, -10, 12, 18); c.lineTo(-12, 18); c.quadraticCurveTo(-14, -10, 0, -30); c.fill();
      c.fillStyle = api.color; c.beginPath(); c.moveTo(-12, 6); c.lineTo(-24, 24); c.lineTo(-10, 18); c.fill(); c.beginPath(); c.moveTo(12, 6); c.lineTo(24, 24); c.lineTo(10, 18); c.fill();
      c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(0, -8, 6, 0, 7); c.fill(); c.strokeStyle = '#0c4a6e'; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    function draw() {
      const W = g.W, H = g.H;
      c.save(); if (shake > 0) c.translate(rand(-5, 5) * shake * 2, rand(-5, 5) * shake * 2);
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1026'); bg.addColorStop(1, T < stormU ? '#3b0d0d' : '#1e1b4b');
      c.fillStyle = bg; c.fillRect(-10, -10, W + 20, H + 20);
      stars.forEach((s) => { const y = ((s.y * H + P.d * s.z * 0.4) % H); c.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.6})`; c.fillRect(s.x * W, y, s.z * 2, s.z * 2); });
      for (const p of planets) {
        const y = Y(p.d), x = p.x * W; if (y < -120 || y > H + 120) continue;
        const gr = c.createRadialGradient(x - p.r * 0.3, y - p.r * 0.3, p.r * 0.2, x, y, p.r);
        gr.addColorStop(0, p.done && !p.ok ? '#9ca3af' : p.col[1]); gr.addColorStop(1, p.done && !p.ok ? '#4b5563' : p.col[0]);
        if (!p.done) { c.save(); c.shadowColor = p.col[1]; c.shadowBlur = 30; }
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, p.r, 0, 7); c.fill(); if (!p.done) c.restore();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, p.r * 1.45, p.r * 0.35, -0.3, 0, 7); c.stroke();
        c.font = `800 22px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
        c.fillText(p.done ? (p.ok ? '🚩' : '✘') : '؟', x, y);
      }
      for (const k of gems) { if (k.got) continue; const y = Y(k.d); if (y < -20 || y > H + 20) continue; const x = k.x * W; c.fillStyle = '#67e8f9'; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 8, y); c.lineTo(x, y + 10); c.lineTo(x - 8, y); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - 2, y - 6, 3, 5); }
      for (const r of rocks) {
        const y = Y(r.d); if (y < -40 || y > H + 40) continue;
        c.save(); c.translate(r.x * W, y); c.rotate(r.rot); c.globalAlpha = r.hit ? 0.25 : 1;
        c.fillStyle = '#78716c'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, rad = r.r * (0.8 + ((i * 37) % 5) / 12); c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.fill();
        c.fillStyle = '#57534e'; c.beginPath(); c.arc(-r.r * 0.3, -r.r * 0.2, r.r * 0.25, 0, 7); c.fill(); c.restore();
      }
      drawParts(c, parts);
      ship(P.x * W, shipY());
      c.restore();
      drawFx(c, fx, W / 2, shipY() - 90);
      if (state === 'count') drawCountdown(c, W, H, st.cd);
    }
    K.loop(update, draw);
  });
}
