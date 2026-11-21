// لعبة العدّاء (منظر جانبي): يجري الطالب ويقفز فوق العوائق ويجمع العملات، وعند كل بوابة سؤال.
// الإجابة الصحيحة: درع ذهبي وسرعة، والخاطئة: دوار وبطء. الاصطدام يُنقص قلباً، ولا تنتهي الجولة قبل آخر سؤال.
import { toArabicDigits as ar } from '../quran.js';

let G = null;
export function stop() { if (G) { G.dead = true; cancelAnimationFrame(G.raf); G.cleanup?.(); G = null; } }
export function pause(p) { if (G) { G.paused = p; G.last = performance.now(); } }

const rand = (a, b) => a + Math.random() * (b - a);
const FONT = '"Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif';
const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };

export function run(stage, api) {
  stop();
  return new Promise((resolve) => {
    const cv = document.createElement('canvas'); cv.className = 'pg-cv';
    const ctl = document.createElement('div'); ctl.className = 'pg-ctl';
    ctl.innerHTML = '<span class="pg-tip">اضغط على الشاشة أو زر القفز (مرتين للقفزة المزدوجة)</span><button type="button" class="pg-btn big" data-jump aria-label="اقفز">⤒ اقفز</button>';
    stage.append(cv, ctl);
    const c = cv.getContext('2d');
    const Q = api.qs.length, S = 1300, F = (Q + 1) * S;
    let W = 0, H = 0, dpr = 1;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = stage.clientWidth; H = stage.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const gy = () => Math.round(H * 0.74), px = () => Math.round(W * 0.72);
    const P = { s: 0, y: 0, vy: 0, jumps: 0 };
    const gates = api.qs.map((_, i) => ({ s: (i + 1) * S, i, done: false, ok: null }));
    const obs = [], coins = [];
    for (let s = 650; s < F - 200; s += rand(430, 720)) {
      if (gates.some((g) => s > g.s - 260 && s < g.s + 200)) continue;
      const k = Math.random(), o = k < 0.4 ? { w: 34, h: 26, kind: 'rock' } : k < 0.75 ? { w: 30, h: 30, kind: 'crate' } : { w: 22, h: 46, kind: 'cactus' };
      obs.push({ s, ...o, hit: false });
      if (Math.random() < 0.55) for (let j = -2; j <= 2; j++) coins.push({ s: s + j * 26, h: o.h + 40 + (2 - Math.abs(j)) * 22, got: false });
    }
    for (let s = 400; s < F - 100; s += rand(500, 900)) { if (obs.some((o) => Math.abs(o.s - s) < 140) || gates.some((g) => Math.abs(g.s - s) < 200)) continue; for (let j = 0; j < 4; j++) coins.push({ s: s + j * 28, h: 30, got: false }); }
    const clouds = Array.from({ length: 7 }, () => ({ x: rand(0, 1600), y: rand(0.06, 0.32), s: rand(0.7, 1.4) }));
    const fx = [], parts = [];
    let T = 0, state = 'count', cdT = 0, okN = 0, hearts = 3, nCoins = 0, invU = 0, shieldU = 0, boostU = 0, slowU = 0, shake = 0, endT = 0, falls = 0;
    G = { dead: false, paused: false, raf: 0, last: performance.now() };
    const me = G;
    const jump = () => {
      if (state !== 'run' && state !== 'done') return;
      if (P.y <= 0.5) { P.vy = 780; P.jumps = 1; api.sfx.tap(); }
      else if (P.jumps < 2) { P.vy = 640; P.jumps = 2; api.sfx.tap(); }
    };
    ctl.querySelector('[data-jump]').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    const key = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { jump(); e.preventDefault(); } };
    window.addEventListener('keydown', key); window.addEventListener('resize', resize);
    G.cleanup = () => { window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); };
    const float = (txt, color) => fx.push({ txt, color, t: 0 });
    const hud = () => api.hud({ a: `${'❤️'.repeat(hearts)}${'🤍'.repeat(3 - hearts)}`, b: `<span>✔ ${ar(okN)}/${ar(Q)}</span> <span>🪙 ${ar(nCoins)}</span>`, p: P.s / F });
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
      const V = (250 + Math.min(90, T * 1.5)) * (T < boostU ? 1.35 : 1) * (T < slowU ? 0.6 : 1) * (state === 'done' ? 0.6 : 1) * Math.min(1, 0.4 + T);
      P.s += V * dt;
      P.vy -= 2100 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; P.jumps = 0; }
      if (state === 'run') {
        for (const o of obs) {
          if (o.hit || Math.abs(o.s - P.s) > o.w / 2 + 10) continue;
          if (P.y < o.h - 4) {
            o.hit = true;
            if (T < shieldU) { float('🛡️', '#fde047'); continue; }
            if (T < invU) continue;
            hearts--; invU = T + 1.3; slowU = Math.max(slowU, T + 0.6); shake = 0.35; api.sfx.bump();
            if (hearts <= 0) { hearts = 3; falls++; const lost = Math.min(nCoins, 5); nCoins -= lost; float(lost ? `تعثّرت! −${ar(lost)} 🪙` : 'تعثّرت! قم من جديد', '#f87171'); }
            else float('💥', '#f87171');
            hud();
          }
        }
        for (const k of coins) { if (k.got || Math.abs(k.s - P.s) > 16) continue; const top = P.y + 58; if (k.h > P.y - 6 && k.h < top + 6) { k.got = true; nCoins++; api.sfx.coin(); hud(); for (let i = 0; i < 4; i++) parts.push({ x: px(), y: gy() - k.h, vx: rand(-80, 80), vy: rand(-160, -40), life: 0.5, c: '#fde047', r: 3 }); } }
        const g = gates.find((x) => !x.done && P.s >= x.s);
        if (g) {
          g.done = true; state = 'q'; P.y = 0; P.vy = 0;
          api.ask(api.qs[g.i]).then((ok) => {
            if (me.dead) return;
            g.ok = ok;
            if (ok) { okN++; shieldU = T + 3; boostU = T + 2; nCoins += 3; float('✨ أحسنت! درع ذهبي', '#4ade80'); for (let i = 0; i < 14; i++) parts.push({ x: px(), y: gy() - 40, vx: rand(-160, 160), vy: rand(-260, -60), life: 0.8, c: i % 2 ? '#fde047' : '#4ade80', r: 3.5 }); }
            else { slowU = T + 2; float('😵 دوار!', '#f87171'); }
            state = 'run'; me.last = performance.now(); hud();
          });
        }
        if (P.s >= F) { state = 'done'; endT = T; api.sfx.win(); float('🏁 وصلت!', '#fde047'); hud(); }
      }
      if (state === 'done' && T - endT > 1.6) { finish(); return; }
      fx.forEach((f) => (f.t += dt)); for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > 1.5) fx.splice(i, 1);
      parts.forEach((p) => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      shake = Math.max(0, shake - dt);
      if (Math.random() < 0.1) hud();
    }
    const X = (s) => px() - (s - P.s);
    function kid(x, y) {
      const run = P.y <= 0 && state !== 'q', a = run ? Math.sin(T * 16) * 0.7 : 0.4;
      c.save(); c.translate(x, y);
      if (T < invU && Math.floor(T * 12) % 2) c.globalAlpha = 0.35;
      if (T < shieldU) { const g = c.createRadialGradient(0, -34, 8, 0, -34, 46); g.addColorStop(0, 'rgba(253,224,71,.45)'); g.addColorStop(1, 'rgba(253,224,71,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -34, 46, 0, 7); c.fill(); }
      c.strokeStyle = '#7c4a1e'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-2, -18); c.lineTo(-2 + Math.sin(a) * 12, -2 + (run ? 0 : -6)); c.stroke();
      c.beginPath(); c.moveTo(4, -18); c.lineTo(4 - Math.sin(a) * 12, -2 + (run ? 0 : -6)); c.stroke();
      c.fillStyle = '#fff'; c.strokeStyle = '#cbd5e1'; c.lineWidth = 1.5; rr(c, -11, -50, 22, 36, 7); c.fill(); c.stroke();
      c.strokeStyle = '#f1c27d'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -42); c.lineTo(-10 - Math.sin(a) * 6, -30); c.stroke();
      c.fillStyle = '#f1c27d'; c.beginPath(); c.arc(0, -60, 10, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -63, 10.5, Math.PI, 0); c.fill();
      c.fillStyle = '#1f2937'; c.beginPath(); c.arc(-5, -60, 1.8, 0, 7); c.fill();
      c.strokeStyle = '#1f2937'; c.lineWidth = 1.4; c.beginPath(); c.arc(-4, -56, 3, 0.2, 1.4); c.stroke();
      if (T < slowU && state === 'run') { c.font = '16px serif'; c.textAlign = 'center'; c.fillText('💫', 0, -78); }
      c.restore();
    }
    function draw() {
      const g0 = gy();
      c.save();
      if (shake > 0) c.translate(rand(-4, 4) * shake * 2, rand(-4, 4) * shake * 2);
      const sky = c.createLinearGradient(0, 0, 0, g0); sky.addColorStop(0, '#60a5fa'); sky.addColorStop(1, '#e0f2fe');
      c.fillStyle = sky; c.fillRect(-10, -10, W + 20, g0 + 10);
      c.fillStyle = '#fde68a'; c.beginPath(); c.arc(W * 0.18, H * 0.16, 30, 0, 7); c.fill();
      clouds.forEach((k) => { const x = ((k.x + P.s * 0.08) % (W + 200)) - 100, y = H * k.y; c.fillStyle = 'rgba(255,255,255,.9)'; [[0, 0, 18], [18, -8, 22], [40, 0, 18]].forEach(([a, b, r]) => { c.beginPath(); c.arc(x + a * k.s, y + b * k.s, r * k.s, 0, 7); c.fill(); }); });
      const hills = (f, amp, base, col, per) => { c.fillStyle = col; c.beginPath(); c.moveTo(-10, g0); for (let x = -10; x <= W + 10; x += 10) c.lineTo(x, g0 - base - amp * (0.5 + 0.5 * Math.sin((x - P.s * f) / per))); c.lineTo(W + 10, g0); c.closePath(); c.fill(); };
      hills(0.2, 50, 40, '#a7f3d0', 140); hills(0.45, 30, 10, '#6ee7b7', 90);
      c.fillStyle = '#22c55e'; c.fillRect(-10, g0, W + 20, 10);
      c.fillStyle = '#b45309'; c.fillRect(-10, g0 + 10, W + 20, H - g0);
      c.fillStyle = '#92400e'; for (let x = -((-P.s) % 60) - 60; x < W + 60; x += 60) { c.fillRect(x, g0 + 24, 26, 6); c.fillRect(x + 28, g0 + 46, 18, 5); }
      // خط النهاية
      { const x = X(F); if (x > -40 && x < W + 40) { c.fillStyle = '#374151'; c.fillRect(x - 2, g0 - 110, 5, 110); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(x - 2 - (i + 1) * 9, g0 - 110 + j * 9, 9, 9); } } }
      // بوابات الأسئلة
      for (const g of gates) {
        const x = X(g.s); if (x < -60 || x > W + 60) continue;
        const col = g.done ? (g.ok ? '#22c55e' : '#94a3b8') : api.color;
        c.save(); c.shadowColor = col; c.shadowBlur = g.done ? 0 : 18; c.strokeStyle = col; c.lineWidth = 7;
        c.beginPath(); c.ellipse(x, g0 - 52, 24, 52, 0, 0, 7); c.stroke(); c.restore();
        c.fillStyle = g.done ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x, g0 - 52, 18, 46, 0, 0, 7); c.fill();
        c.font = `900 26px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 4;
        const t = g.done ? (g.ok ? '✔' : '✘') : '؟'; c.strokeText(t, x, g0 - 52); c.fillText(t, x, g0 - 52);
      }
      for (const o of obs) {
        const x = X(o.s); if (x < -50 || x > W + 50) continue;
        c.globalAlpha = o.hit ? 0.45 : 1;
        if (o.kind === 'rock') { c.fillStyle = '#78716c'; c.beginPath(); c.ellipse(x, g0 - o.h / 2 + 2, o.w / 2, o.h / 2 + 2, 0, Math.PI, 0); c.lineTo(x + o.w / 2, g0); c.lineTo(x - o.w / 2, g0); c.fill(); c.fillStyle = '#a8a29e'; c.beginPath(); c.arc(x - 5, g0 - o.h + 9, 5, 0, 7); c.fill(); }
        else if (o.kind === 'crate') { c.fillStyle = '#d97706'; c.fillRect(x - o.w / 2, g0 - o.h, o.w, o.h); c.strokeStyle = '#92400e'; c.lineWidth = 3; c.strokeRect(x - o.w / 2 + 1.5, g0 - o.h + 1.5, o.w - 3, o.h - 3); c.beginPath(); c.moveTo(x - o.w / 2, g0 - o.h); c.lineTo(x + o.w / 2, g0); c.stroke(); }
        else { c.fillStyle = '#15803d'; rr(c, x - 7, g0 - o.h, 14, o.h, 7); c.fill(); rr(c, x - 17, g0 - o.h * 0.7, 8, 18, 4); c.fill(); rr(c, x + 9, g0 - o.h * 0.8, 8, 16, 4); c.fill(); }
        c.globalAlpha = 1;
      }
      for (const k of coins) { if (k.got) continue; const x = X(k.s); if (x < -20 || x > W + 20) continue; const sq = Math.abs(Math.cos(T * 4 + k.s)); c.fillStyle = '#facc15'; c.beginPath(); c.ellipse(x, g0 - k.h, 8 * sq + 2, 8, 0, 0, 7); c.fill(); c.strokeStyle = '#ca8a04'; c.lineWidth = 2; c.stroke(); }
      for (const p of parts) { c.globalAlpha = Math.max(0, p.life * 1.6); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(px(), g0 + 2, Math.max(6, 16 - P.y / 12), 4, 0, 0, 7); c.fill();
      kid(px(), g0 - P.y);
      c.restore();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      fx.forEach((f) => { c.globalAlpha = Math.max(0, 1 - f.t / 1.5); c.font = `800 22px ${FONT}`; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.5)'; const y = g0 - 120 - f.t * 40; c.strokeText(f.txt, W / 2, y); c.fillStyle = f.color; c.fillText(f.txt, W / 2, y); });
      c.globalAlpha = 1;
      if (state === 'count') {
        const k = Math.ceil(3 - cdT), t = 3 - cdT - Math.floor(3 - cdT);
        c.font = `900 ${Math.round(90 + 40 * t)}px ${FONT}`; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.45)'; c.fillStyle = '#fde047';
        const s = k > 0 ? ar(k) : 'انطلق!'; c.strokeText(s, W / 2, H * 0.36); c.fillText(s, W / 2, H * 0.36);
      }
    }
    function finish() { if (me.dead) return; const out = { coins: nCoins, falls }; stop(); resolve(out); }
    function loop(now) {
      if (me.dead) return;
      const dt = Math.min(0.05, (now - me.last) / 1000); me.last = now;
      if (!me.paused) update(dt);
      if (!me.dead) { draw(); me.raf = requestAnimationFrame(loop); }
    }
    me.raf = requestAnimationFrame(loop);
  });
}
