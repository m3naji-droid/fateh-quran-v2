// أدوات مشتركة لألعاب «العب وتعلّم»: لوحة الرسم، حلقة التحديث، العدّ التنازلي، النصوص الطائرة
export const rand = (a, b) => a + Math.random() * (b - a);
export const FONT = '"Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif';
export const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
const AR = '٠١٢٣٤٥٦٧٨٩';
export const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);

/** لعبة واحدة في كل مرة: boot يجهّز اللوحة، وloop يشغّل التحديث والرسم */
export function createGame() {
  let G = null;
  const K = {
    get G() { return G; },
    stop() { if (G) { G.dead = true; cancelAnimationFrame(G.raf); G.cleanup.forEach((f) => { try { f(); } catch {} }); G = null; } },
    pause(p) { if (G) { G.paused = p; G.last = performance.now(); } },
    boot(stage, ctlHtml = '', { canvas = true } = {}) {
      K.stop();
      const g = { dead: false, paused: false, raf: 0, last: performance.now(), cleanup: [], W: 0, H: 0, dpr: 1, stage };
      g.on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); g.cleanup.push(() => el.removeEventListener(ev, fn, opt)); };
      if (canvas) {
        g.cv = document.createElement('canvas'); g.cv.className = 'pg-cv'; stage.append(g.cv); g.c = g.cv.getContext('2d');
      }
      if (ctlHtml) { g.ctl = document.createElement('div'); g.ctl.className = 'pg-ctl'; g.ctl.innerHTML = ctlHtml; stage.append(g.ctl); }
      g.resize = () => {
        g.dpr = Math.min(2, window.devicePixelRatio || 1); g.W = stage.clientWidth; g.H = stage.clientHeight;
        if (g.cv) { g.cv.width = g.W * g.dpr; g.cv.height = g.H * g.dpr; g.cv.style.width = g.W + 'px'; g.cv.style.height = g.H + 'px'; g.c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); }
        g.onResize?.();
      };
      g.resize(); g.on(window, 'resize', g.resize);
      G = g; return g;
    },
    loop(update, draw) {
      const me = G;
      const f = (now) => {
        if (me.dead) return;
        const dt = Math.min(0.05, (now - me.last) / 1000); me.last = now;
        if (!me.paused) update(dt);
        if (!me.dead) { draw?.(); me.raf = requestAnimationFrame(f); }
      };
      me.raf = requestAnimationFrame(f);
    },
  };
  return K;
}

/** عدّ تنازلي ٣-٢-١: يعيد true حين ينتهي */
export function countdown(st, dt, sfx) {
  const k0 = Math.ceil(3 - st.cd); st.cd = (st.cd || 0) + dt; const k1 = Math.ceil(3 - st.cd);
  if (k1 !== k0) (k1 > 0 ? sfx.beep : sfx.go)();
  return st.cd >= 3;
}
export function drawCountdown(c, W, H, cd, y = 0.4) {
  const k = Math.ceil(3 - cd), t = 3 - cd - Math.floor(3 - cd);
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `900 ${Math.round(90 + 40 * t)}px ${FONT}`; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.45)'; c.fillStyle = '#fde047';
  const s = k > 0 ? ar(k) : 'انطلق!'; c.strokeText(s, W / 2, H * y); c.fillText(s, W / 2, H * y); c.restore();
}
/** نصوص طائرة: fx.push({ txt, color, t: 0 }) */
export function stepFx(fx, dt, life = 1.4) { fx.forEach((f) => (f.t += dt)); for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > life) fx.splice(i, 1); }
export function drawFx(c, fx, x, y, life = 1.4, size = 24) {
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  fx.forEach((f) => { c.globalAlpha = Math.max(0, 1 - f.t / life); c.font = `800 ${size}px ${FONT}`; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.5)'; const yy = (f.y ?? y) - f.t * 45; c.strokeText(f.txt, f.x ?? x, yy); c.fillStyle = f.color; c.fillText(f.txt, f.x ?? x, yy); });
  c.restore();
}
/** جسيمات بسيطة: { x, y, vx, vy, life, c, r, g } */
export function stepParts(P, dt) { P.forEach((p) => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 500) * dt; }); for (let i = P.length - 1; i >= 0; i--) if (P[i].life <= 0) P.splice(i, 1); }
export function drawParts(c, P) { P.forEach((p) => { c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.8)); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }); c.globalAlpha = 1; }
export const burst = (P, x, y, n, colors, sp = 200) => { for (let i = 0; i < n; i++) P.push({ x, y, vx: rand(-sp, sp), vy: rand(-sp * 1.3, -sp * 0.2), life: rand(0.5, 0.9), c: colors[i % colors.length], r: rand(2.5, 4.5) }); };
