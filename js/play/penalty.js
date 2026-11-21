// ⚽ ركلات الترجيح: كل سؤال ركلة. أجب ثم اختر مكان التسديد: الصحيح هدف، والخطأ يصدّه الحارس.
// وبعد كل ركلة يسدد الخصم فتكون أنت الحارس: اختر جهة القفز.
import { createGame, rand, FONT, ar, rr, countdown, drawCountdown, stepFx, drawFx, stepParts, drawParts, burst } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage);
    const c = g.c, Q = api.qs.length, st = { cd: 0 };
    let state = 'count', T = 0, qi = 0, me = 0, cpu = 0, ok = false, pick = null, shot = null, keeper = { col: 1, row: 0, t: 0 }, phaseT = 0, msg = '', endT = 0, mine = true;
    const fx = [], parts = [], crowd = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), c: ['#ef4444', '#3b82f6', '#fde047', '#fff', '#22c55e'][Math.floor(Math.random() * 5)] }));
    const G = () => { const gw = Math.min(g.W * 0.88, 440), gh = gw * 0.42; return { gx: (g.W - gw) / 2, gy: g.H * 0.2, gw, gh }; };
    const zone = (col, row) => { const z = G(); return { x: z.gx + z.gw * (0.17 + col * 0.33), y: z.gy + z.gh * (0.3 + row * 0.42) }; };
    const ballHome = () => ({ x: g.W / 2, y: g.H * 0.8 });
    const hud = () => api.hud({ a: `⚽ أنت <b>${ar(me)}</b> – ${ar(cpu)} الخصم`, b: `<span>ركلة ${ar(Math.min(qi + 1, Q))}/${ar(Q)}</span>`, p: qi / Q });
    hud();
    g.on(g.cv, 'pointerdown', (e) => {
      const r = g.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, z = G();
      const col = Math.max(0, Math.min(2, Math.floor(((x - z.gx) / z.gw) * 3)));
      if (state === 'aim') { if (y > z.gy + z.gh + 60) return; const row = y < z.gy + z.gh * 0.5 ? 0 : 1; kick(col, row); }
      else if (state === 'def') dive(col);
    });
    const ask = () => {
      if (qi >= Q) { state = 'done'; endT = T; if (me > cpu) api.sfx.win(); msg = me > cpu ? '🏆 فزت بالمباراة!' : me === cpu ? '🤝 تعادل!' : 'خسرت هذه المرة… أعد المحاولة'; return; }
      state = 'q'; msg = '';
      api.ask(api.qs[qi]).then((r) => { if (!K.G) return; ok = r; qi++; state = 'aim'; phaseT = 0; msg = 'اختر مكان التسديد في المرمى 👆'; mine = true; keeper = { col: 1, row: 0, t: 0 }; g.last = performance.now(); hud(); });
    };
    const kick = (col, row) => {
      state = 'shot'; phaseT = 0; api.sfx.tap(); msg = '';
      const kc = ok ? [0, 1, 2].filter((x) => x !== col)[Math.floor(Math.random() * 2)] : col;
      keeper = { col: kc, row, t: 0 };
      shot = { from: ballHome(), to: zone(col, row), t: 0, goal: ok, post: false };
    };
    const startDef = () => { state = 'def'; phaseT = 0; mine = false; msg = 'دورك حارساً! اضغط جهة القفز ⬅ ⬆ ➡'; keeper = { col: 1, row: 0, t: 0 }; pick = null; };
    const dive = (col) => {
      if (state !== 'def') return;
      api.sfx.tap(); pick = col;
      const sc = Math.floor(Math.random() * 3), row = Math.random() < 0.5 ? 0 : 1, post = Math.random() < 0.15;
      keeper = { col, row, t: 0 }; state = 'shot'; phaseT = 0; msg = '';
      shot = { from: ballHome(), to: post ? { x: zone(sc, 0).x + (sc === 1 ? 0 : (sc === 0 ? -1 : 1) * G().gw * 0.17), y: G().gy } : zone(sc, row), t: 0, goal: !post && col !== sc, post };
    };
    function update(dt) {
      if (state === 'count') { if (countdown(st, dt, api.sfx)) ask(); return; }
      if (state === 'q') return;
      T += dt; phaseT += dt;
      if (state === 'def' && phaseT > 3) dive(1);
      if (state === 'shot') {
        shot.t += dt / 0.55; keeper.t = Math.min(1, keeper.t + dt / 0.4);
        if (shot.t >= 1) {
          shot.t = 1; state = 'after'; phaseT = 0;
          const p = shot.to;
          if (mine) { if (shot.goal) { me++; api.sfx.win(); burst(parts, p.x, p.y, 26, ['#fde047', '#fff', '#22c55e'], 240); fx.push({ txt: '⚽ هدف!', color: '#fde047', t: 0 }); } else { api.sfx.bad(); fx.push({ txt: '🧤 صدّها الحارس', color: '#fca5a5', t: 0 }); } }
          else { if (shot.goal) { cpu++; api.sfx.bump(); fx.push({ txt: 'سجّل الخصم', color: '#fca5a5', t: 0 }); } else { api.sfx.ok(); burst(parts, p.x, p.y, 16, ['#60a5fa', '#fff'], 200); fx.push({ txt: shot.post ? '🥅 في القائم!' : '🧤 تصدٍّ رائع!', color: '#4ade80', t: 0 }); } }
          hud();
        }
      }
      if (state === 'after' && phaseT > 1.1) { shot = null; if (mine) startDef(); else ask(); }
      if (state === 'done' && T - endT > 2) { const out = { stats: [{ v: `${ar(me)} – ${ar(cpu)}`, l: me > cpu ? 'فزت بالمباراة 🏆' : me === cpu ? 'تعادل' : 'نتيجة المباراة' }] }; K.stop(); resolve(out); return; }
      stepFx(fx, dt); stepParts(parts, dt);
    }
    function person(x, y, color, rot = 0) {
      c.save(); c.translate(x, y); c.rotate(rot);
      c.fillStyle = color; rr(c, -14, -36, 28, 34, 8); c.fill();
      c.strokeStyle = color; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-12, -30); c.lineTo(-30, -44); c.moveTo(12, -30); c.lineTo(30, -44); c.stroke();
      c.fillStyle = '#fde047'; c.beginPath(); c.arc(-31, -45, 5, 0, 7); c.arc(31, -45, 5, 0, 7); c.fill();
      c.strokeStyle = '#1f2937'; c.lineWidth = 6; c.beginPath(); c.moveTo(-6, -4); c.lineTo(-9, 16); c.moveTo(6, -4); c.lineTo(9, 16); c.stroke();
      c.fillStyle = '#f1c27d'; c.beginPath(); c.arc(0, -46, 10, 0, 7); c.fill();
      c.restore();
    }
    function draw() {
      const W = g.W, H = g.H, z = G();
      c.fillStyle = '#1e293b'; c.fillRect(0, 0, W, z.gy + z.gh * 0.3);
      crowd.forEach((p) => { c.fillStyle = p.c; c.beginPath(); c.arc(p.x * W, p.y * (z.gy - 6) + Math.sin(T * 6 + p.x * 20) * (state === 'after' ? 2 : 0.5), 3, 0, 7); c.fill(); });
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#16a34a' : '#15803d'; const y0 = z.gy + z.gh * 0.3 + i * ((H - z.gy) / 8); c.fillRect(0, y0, W, (H - z.gy) / 8 + 1); }
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.strokeRect(z.gx - z.gw * 0.25, z.gy + z.gh, z.gw * 1.5, H * 0.22); c.beginPath(); c.arc(W / 2, H * 0.8, 4, 0, 7); c.fillStyle = '#fff'; c.fill();
      // المرمى والشبكة
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(z.gx, z.gy, z.gw, z.gh);
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; for (let x = z.gx; x < z.gx + z.gw; x += 14) { c.beginPath(); c.moveTo(x, z.gy); c.lineTo(x, z.gy + z.gh); c.stroke(); } for (let y = z.gy; y < z.gy + z.gh; y += 14) { c.beginPath(); c.moveTo(z.gx, y); c.lineTo(z.gx + z.gw, y); c.stroke(); }
      c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.moveTo(z.gx, z.gy + z.gh); c.lineTo(z.gx, z.gy); c.lineTo(z.gx + z.gw, z.gy); c.lineTo(z.gx + z.gw, z.gy + z.gh); c.stroke();
      if (state === 'aim') { for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) { const p = zone(col, row); c.strokeStyle = `rgba(253,224,71,${0.5 + Math.sin(T * 5) * 0.3})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 16, 0, 7); c.stroke(); } }
      if (state === 'def') { for (let col = 0; col < 3; col++) { c.fillStyle = 'rgba(96,165,250,.18)'; c.fillRect(z.gx + (col * z.gw) / 3 + 3, z.gy + 3, z.gw / 3 - 6, z.gh - 6); c.fillStyle = '#fff'; c.font = `700 26px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['⬅', '⬆', '➡'][col], z.gx + ((col + 0.5) * z.gw) / 3, z.gy + z.gh * 0.55); } }
      // الحارس
      const k = keeper, home = { x: W / 2, y: z.gy + z.gh - 2 }, tgt = zone(k.col, k.row), e = k.t * (2 - k.t);
      const kx = home.x + (tgt.x - home.x) * e, ky = home.y - (k.row === 0 ? z.gh * 0.25 : 0) * e, rot = (k.col - 1) * 1.1 * e;
      person(kx, ky, mine ? '#f97316' : api.color, rot);
      // الكرة
      let b = ballHome(), s = 1;
      if (shot) { const t = shot.t, p = shot.to; b = { x: shot.from.x + (p.x - shot.from.x) * t, y: shot.from.y + (p.y - shot.from.y) * t - Math.sin(t * Math.PI) * 40 }; s = 1 - 0.55 * t; }
      if (state !== 'def' || !mine) {
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(b.x, (shot ? shot.from.y + (shot.to.y - shot.from.y) * shot.t : b.y) + 12 * s, 12 * s, 4 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, 13 * s, 0, 7); c.fill(); c.fillStyle = '#111827'; c.beginPath(); c.arc(b.x, b.y, 5 * s, 0, 7); c.fill();
        for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + T * (shot ? 10 : 0); c.beginPath(); c.arc(b.x + Math.cos(a) * 10 * s, b.y + Math.sin(a) * 10 * s, 2.5 * s, 0, 7); c.fill(); }
      }
      if (mine && (state === 'aim' || state === 'shot' || state === 'q')) person(W / 2 + 30, H * 0.8 + 50, api.color);
      drawParts(c, parts);
      if (msg) { c.save(); c.font = `800 18px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; const w = c.measureText(msg).width + 30; c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, W / 2 - w / 2, H * 0.62 - 20, w, 40, 20); c.fill(); c.fillStyle = '#fff'; c.fillText(msg, W / 2, H * 0.62); c.restore(); }
      drawFx(c, fx, W / 2, z.gy + z.gh + 50, 1.4, 28);
      if (state === 'count') drawCountdown(c, W, H, st.cd, 0.55);
    }
    K.loop(update, draw);
  });
}
