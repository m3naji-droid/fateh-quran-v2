// لعبة سباق السيارات (منظر من الأعلى): عند كل منعطف بوابة سؤال.
// الإجابة الصحيحة تسارع، والخاطئة تباطؤ، والاصطدام بالأقماع يبطئ لحظة. المركز الأخير يُحسب عند خط النهاية.
import { toArabicDigits as ar } from '../quran.js';

let G = null;
export function stop() { if (G) { G.dead = true; cancelAnimationFrame(G.raf); G.cleanup?.(); G = null; } }
export function pause(p) { if (G) { G.paused = p; G.last = performance.now(); } }

const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); } };
const rand = (a, b) => a + Math.random() * (b - a);
const FONT = '"Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif';

export function run(stage, api) {
  stop();
  return new Promise((resolve) => {
    const cv = document.createElement('canvas'); cv.className = 'pg-cv';
    const ctl = document.createElement('div'); ctl.className = 'pg-ctl';
    ctl.innerHTML = '<button type="button" class="pg-btn" data-dir="-1" aria-label="يسار">◀</button><span class="pg-tip">اضغط يميناً أو يساراً لتغيير المسار</span><button type="button" class="pg-btn" data-dir="1" aria-label="يمين">▶</button>';
    stage.append(cv, ctl);
    const c = cv.getContext('2d');
    const Q = api.qs.length, S = 1500, F = (Q + 1) * S, V = 330;
    let W = 0, H = 0, dpr = 1, RW = 0, LW = 0, A = 0;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1); W = stage.clientWidth; H = stage.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      RW = Math.max(210, Math.min(420, W * 0.62)); LW = RW / 3; A = Math.max(0, (W - RW) / 2 - 16);
    };
    resize();
    const cx = (d) => W / 2 + A * Math.sin(d / 700) * Math.sin(d / 2300 + 1);
    const P = { d: 0, lane: 1, xo: 0, tilt: 0 };
    const RV = [{ d: 120, lane: 0, color: '#ef4444', base: 1.02, ph: 0 }, { d: 240, lane: 2, color: '#3b82f6', base: 0.96, ph: 2 }, { d: 360, lane: 1, color: '#f59e0b', base: 0.9, ph: 4 }];
    const gates = api.qs.map((_, i) => ({ d: (i + 1) * S, i, done: false }));
    const obs = [];
    for (let d = 700; d < F - 250; d += rand(380, 640)) {
      if (gates.some((g) => d > g.d - 300 && d < g.d + 220)) continue;
      obs.push({ d, lane: Math.floor(Math.random() * 3), kind: Math.random() < 0.7 ? 'cone' : 'oil', hit: false });
    }
    const deco = [];
    for (let d = -400; d < F + 900; d += rand(90, 170)) deco.push({ d, side: Math.random() < 0.5 ? -1 : 1, off: rand(16, 60), kind: Math.random() < 0.65 ? 'tree' : Math.random() < 0.5 ? 'bush' : 'rock', s: rand(0.8, 1.25) });
    const fx = [], parts = [];
    let T = 0, state = 'count', cdT = 0, okN = 0, boostU = 0, slowU = 0, hitU = 0, shake = 0, endT = 0, pos = 4;
    G = { dead: false, paused: false, raf: 0, last: performance.now() };
    const me = G;
    const steer = (dir) => { if (state === 'done') return; P.lane = Math.max(0, Math.min(2, P.lane + dir)); api.sfx.tap(); };
    ctl.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); steer(+b.dataset.dir); }));
    let sx = null;
    cv.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    cv.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 30) steer(dx > 0 ? 1 : -1); else steer(e.clientX - cv.getBoundingClientRect().left > W / 2 ? 1 : -1); });
    const key = (e) => { if (e.key === 'ArrowLeft') { steer(-1); e.preventDefault(); } if (e.key === 'ArrowRight') { steer(1); e.preventDefault(); } };
    window.addEventListener('keydown', key); window.addEventListener('resize', resize);
    G.cleanup = () => { window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); };
    const float = (txt, color) => fx.push({ txt, color, t: 0 });
    const posNow = () => 1 + RV.filter((r) => r.d > P.d).length;
    const hud = () => api.hud({ a: `🏁 المركز <b>${ar(state === 'done' ? pos : posNow())}</b>/${ar(4)}`, b: `✔ ${ar(okN)}/${ar(Q)}`, p: P.d / F });
    hud();

    function update(dt) {
      if (state === 'count') {
        const k0 = Math.ceil(3 - cdT); cdT += dt; const k1 = Math.ceil(3 - cdT);
        if (k1 !== k0) (k1 > 0 ? api.sfx.beep : api.sfx.go)();
        if (cdT >= 3) { state = 'run'; T = 0; }
        return;
      }
      if (state === 'q') return;
      T += dt;
      const ramp = Math.min(1, 0.35 + T / 1.2);
      if (state === 'run' || state === 'done') {
        const mult = (T < boostU ? 1.55 : 1) * (T < slowU ? 0.55 : 1) * (T < hitU ? 0.6 : 1);
        const v = state === 'done' ? V * 0.5 : V * mult * ramp;
        P.d += v * dt;
        RV.forEach((r) => { if (r.fin == null || state !== 'done') r.d += V * r.base * (1 + 0.05 * Math.sin(T * 0.6 + r.ph)) * ramp * dt; if (r.d >= F && r.fin == null) r.fin = T; if (Math.random() < 0.002) r.lane = Math.max(0, Math.min(2, r.lane + (Math.random() < 0.5 ? -1 : 1))); });
        const tx = (P.lane - 1) * LW; P.tilt = (tx - P.xo) * 0.004; P.xo += (tx - P.xo) * Math.min(1, dt * 10);
        if (T < boostU && Math.random() < 0.6) parts.push({ x: cx(P.d) + P.xo + rand(-6, 6), d: P.d - 30, vx: 0, life: 0.4, c: Math.random() < 0.5 ? '#fbbf24' : '#f97316', r: rand(3, 6) });
        if (T < slowU && Math.random() < 0.3) parts.push({ x: cx(P.d) + P.xo + rand(-8, 8), d: P.d - 30, vx: rand(-20, 20), life: 0.8, c: 'rgba(120,120,120,.6)', r: rand(5, 9) });
      }
      if (state === 'run') {
        for (const o of obs) {
          if (o.hit || Math.abs(o.d - P.d) > 24) continue;
          const ox = (o.lane - 1) * LW;
          if (Math.abs(ox - P.xo) < LW * 0.45 && T > boostU) { o.hit = true; hitU = T + 0.9; shake = 0.35; api.sfx.bump(); float(o.kind === 'oil' ? 'انزلاق!' : '💥', '#f87171'); }
          else if (Math.abs(ox - P.xo) < LW * 0.45) { o.hit = true; float('🛡️', '#fde047'); }
        }
        const g = gates.find((x) => !x.done && P.d >= x.d);
        if (g) {
          g.done = true; state = 'q'; hud();
          api.ask(api.qs[g.i]).then((ok) => {
            if (me.dead) return;
            if (ok) { okN++; boostU = T + 2.6; slowU = 0; float('🚀 تسارع!', '#4ade80'); }
            else { slowU = T + 2.4; boostU = 0; float('🐢 تباطؤ', '#f87171'); }
            state = 'run'; me.last = performance.now(); hud();
          });
        }
        if (P.d >= F) { state = 'done'; endT = T; pos = 1 + RV.filter((r) => r.fin != null).length; hud(); if (pos === 1) api.sfx.win(); float(pos === 1 ? '🏆 الأول!' : `المركز ${ar(pos)}`, '#fde047'); }
      }
      if (state === 'done' && T - endT > 1.8) { finish(); return; }
      fx.forEach((f) => (f.t += dt)); for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > 1.4) fx.splice(i, 1);
      parts.forEach((p) => { p.life -= dt; p.x += p.vx * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      shake = Math.max(0, shake - dt);
      if (Math.random() < 0.1) hud();
    }
    const py = () => H * 0.74;
    const Y = (d) => py() - (d - P.d);
    function car(x, y, color, tilt, mine) {
      const s = Math.min(1.25, LW / 64), w = 30 * s, h = 54 * s;
      c.save(); c.translate(x, y); c.rotate(tilt);
      c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -w / 2 + 3, -h / 2 + 5, w, h, 8 * s); c.fill();
      c.fillStyle = '#111'; [[-w / 2 - 3 * s, -h / 2 + 8 * s], [w / 2 - 2 * s, -h / 2 + 8 * s], [-w / 2 - 3 * s, h / 2 - 18 * s], [w / 2 - 2 * s, h / 2 - 18 * s]].forEach(([a, b]) => { rr(c, a, b, 5 * s, 11 * s, 2); c.fill(); });
      c.fillStyle = color; rr(c, -w / 2, -h / 2, w, h, 9 * s); c.fill();
      if (mine) { c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-3 * s, -h / 2 + 2, 6 * s, h - 4); }
      c.fillStyle = '#bfe3ff'; rr(c, -w / 2 + 4 * s, -h / 2 + 10 * s, w - 8 * s, 10 * s, 3); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -w / 2 + 4 * s, -h / 2 + 21 * s, w - 8 * s, 16 * s, 4); c.fill();
      c.fillStyle = '#9cc9ea'; rr(c, -w / 2 + 5 * s, h / 2 - 14 * s, w - 10 * s, 6 * s, 2); c.fill();
      c.fillStyle = '#fef08a'; c.fillRect(-w / 2 + 3 * s, -h / 2 + 1, 6 * s, 3 * s); c.fillRect(w / 2 - 9 * s, -h / 2 + 1, 6 * s, 3 * s);
      c.restore();
      if (mine) { c.font = `700 ${Math.round(12 * s)}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.strokeText('أنت', x, y + h / 2 + 15 * s); c.fillText('أنت', x, y + h / 2 + 15 * s); }
    }
    function draw() {
      c.save();
      if (shake > 0) c.translate(rand(-5, 5) * shake * 2, rand(-5, 5) * shake * 2);
      const step = 6;
      for (let y = -12; y < H + 12; y += step) {
        const d = P.d + (py() - y), x0 = cx(d);
        c.fillStyle = Math.floor(d / 90) % 2 ? '#4caf50' : '#43a047'; c.fillRect(-10, y, W + 20, step + 1);
        c.fillStyle = Math.floor(d / 40) % 2 ? '#e53935' : '#fafafa';
        c.fillRect(x0 - RW / 2 - 10, y, 10, step + 1); c.fillRect(x0 + RW / 2, y, 10, step + 1);
        c.fillStyle = '#4b5563'; c.fillRect(x0 - RW / 2, y, RW, step + 1);
        if (Math.floor(d / 55) % 2) { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x0 - LW / 2 - 2, y, 4, step + 1); c.fillRect(x0 + LW / 2 - 2, y, 4, step + 1); }
      }
      // الزينة على الجانبين
      for (const t of deco) {
        const y = Y(t.d); if (y < -60 || y > H + 60) continue;
        const x = cx(t.d) + t.side * (RW / 2 + 22 + t.off), s = t.s;
        if (t.kind === 'tree') { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + 5, y + 5, 17 * s, 0, 7); c.fill(); c.fillStyle = '#2e7d32'; c.beginPath(); c.arc(x, y, 17 * s, 0, 7); c.fill(); c.fillStyle = '#388e3c'; c.beginPath(); c.arc(x - 5 * s, y - 5 * s, 9 * s, 0, 7); c.fill(); }
        else if (t.kind === 'bush') { c.fillStyle = '#66bb6a'; [[-7, 0], [6, 2], [0, -6]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a * s, y + b * s, 8 * s, 0, 7); c.fill(); }); c.fillStyle = '#f472b6'; c.beginPath(); c.arc(x + 2, y - 2, 2.5, 0, 7); c.fill(); }
        else { c.fillStyle = '#9e9e9e'; c.beginPath(); c.ellipse(x, y, 10 * s, 7 * s, 0.4, 0, 7); c.fill(); }
      }
      // خط النهاية
      { const y = Y(F); if (y > -30 && y < H + 30) { const x0 = cx(F) - RW / 2, n = 12, w = RW / n; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(x0 + i * w, y + j * 10 - 10, w, 10); } } }
      // بوابات الأسئلة
      for (const g of gates) {
        const y = Y(g.d); if (y < -80 || y > H + 40) continue;
        const x0 = cx(g.d), L = x0 - RW / 2 - 8, R = x0 + RW / 2 + 8;
        c.fillStyle = g.done ? 'rgba(255,255,255,.25)' : 'rgba(250,204,21,.35)'; c.fillRect(x0 - RW / 2, y - 3, RW, 6);
        c.fillStyle = '#374151'; c.fillRect(L - 4, y - 46, 8, 46); c.fillRect(R - 4, y - 46, 8, 46);
        c.fillStyle = g.done ? '#9ca3af' : api.color; rr(c, L - 6, y - 64, R - L + 12, 24, 8); c.fill();
        c.font = `800 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
        c.fillText(g.done ? '✔' : `❓ سؤال ${ar(g.i + 1)}`, x0, y - 52);
      }
      for (const o of obs) {
        const y = Y(o.d); if (y < -30 || y > H + 30) continue;
        const x = cx(o.d) + (o.lane - 1) * LW;
        if (o.kind === 'cone') { c.globalAlpha = o.hit ? 0.35 : 1; c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 10, y + 10); c.lineTo(x - 10, y + 10); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 6, y - 1, 12, 4); c.globalAlpha = 1; }
        else { c.fillStyle = o.hit ? 'rgba(17,24,39,.3)' : 'rgba(17,24,39,.85)'; c.beginPath(); c.ellipse(x, y, 18, 10, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(147,51,234,.5)'; c.beginPath(); c.ellipse(x - 4, y - 2, 6, 3, 0, 0, 7); c.fill(); }
      }
      for (const p of parts) { const y = Y(p.d); c.globalAlpha = Math.max(0, p.life * 2); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, y, p.r, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      RV.forEach((r) => { const y = Y(r.d); if (y > -60 && y < H + 60) car(cx(r.d) + (r.lane - 1) * LW, y, r.color, 0, false); });
      car(cx(P.d) + P.xo, py(), api.color, P.tilt, true);
      if (T < boostU && state !== 'q') { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const x = rand(0, W), y = rand(0, H); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 40); c.stroke(); } }
      c.restore();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      fx.forEach((f) => { c.globalAlpha = Math.max(0, 1 - f.t / 1.4); c.font = `800 24px ${FONT}`; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; const y = py() - 70 - f.t * 50; c.strokeText(f.txt, W / 2, y); c.fillStyle = f.color; c.fillText(f.txt, W / 2, y); });
      c.globalAlpha = 1;
      if (state === 'count') {
        const k = Math.ceil(3 - cdT), t = 3 - cdT - Math.floor(3 - cdT);
        c.font = `900 ${Math.round(90 + 40 * t)}px ${FONT}`; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.5)'; c.fillStyle = '#fde047';
        const s = k > 0 ? ar(k) : 'انطلق!'; c.strokeText(s, W / 2, H * 0.42); c.fillText(s, W / 2, H * 0.42);
      }
    }
    function finish() { if (me.dead) return; const out = { pos, of: 4 }; stop(); resolve(out); }
    function loop(now) {
      if (me.dead) return;
      const dt = Math.min(0.05, (now - me.last) / 1000); me.last = now;
      if (!me.paused) update(dt);
      if (!me.dead) { draw(); me.raf = requestAnimationFrame(loop); }
    }
    me.raf = requestAnimationFrame(loop);
  });
}
