// 🏰 المشاهد ثلاثية الأبعاد لأرض المقرأة: الخريطة، والقصر من الخارج والداخل، ودار وقف المصاحف.
// تُحمَّل مكتبة Three.js (js/vendor/three) عند فتح الصفحة فقط، ويتوقف الرسم إذا خرج المشهد من الصفحة.
let T = null;
export async function loadThree() { if (!T) T = await import('./vendor/three/three.module.js'); return T; }

export const isNight = () => { const h = new Date().getHours(); return h >= 18 || h < 5; };
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

/* ------------------------------------------------ المشهد العام: كاميرا تدور بالإصبع، ولمس الأجسام، وعناوين فوقها */
export class Scene3D {
  constructor(host, { night = isNight(), shadows = true, onTap = null, minD = 8, maxD = 90, target = [0, 2, 0], dist = 40, ang = 0.55, el = 0.42, fov = 42, bg = null } = {}) {
    this.host = host; this.night = night; this.onTap = onTap; this.minD = minD; this.maxD = maxD;
    this.cam = { ang, el, dist, tx: target[0], ty: target[1], tz: target[2] }; this.anim = []; this.labels = []; this.tween = null; this.dead = false;
    const W = host.clientWidth || 360, H = host.clientHeight || 420;
    this.R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.R.setSize(W, H);
    this.R.shadowMap.enabled = shadows; this.R.shadowMap.type = T.PCFSoftShadowMap;
    this.R.toneMapping = T.ACESFilmicToneMapping; this.R.toneMappingExposure = 1.1; this.R.outputColorSpace = T.SRGBColorSpace;
    this.R.domElement.className = 'q3-cv'; host.prepend(this.R.domElement);
    this.lbl = document.createElement('div'); this.lbl.className = 'q3-lbls'; host.append(this.lbl);
    this.S = new T.Scene(); if (bg != null) this.S.background = new T.Color(bg);
    this.C = new T.PerspectiveCamera(fov, W / H, 0.1, 400);
    this.clock = new T.Clock(); this.ray = new T.Raycaster(); this.pick = [];
    this.place();
    this._wire();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    const loop = () => { if (this.dead) return; if (!this.host.isConnected) { this.dispose(); return; } this.raf = requestAnimationFrame(loop); if (document.hidden) return; this.frame(); };
    this.raf = requestAnimationFrame(loop);
  }
  resize() { const W = this.host.clientWidth, H = this.host.clientHeight; if (!W || !H) return; this.R.setSize(W, H); this.C.aspect = W / H; this.C.updateProjectionMatrix(); }
  place() {
    const c = this.cam;
    this.C.position.set(c.tx + Math.sin(c.ang) * c.dist * Math.cos(c.el), c.ty + Math.sin(c.el) * c.dist, c.tz + Math.cos(c.ang) * c.dist * Math.cos(c.el));
    this.C.lookAt(c.tx, c.ty, c.tz);
  }
  /** انتقال سلس للكاميرا */
  fly(to, ms = 900) { const from = { ...this.cam }; this.tween = { from, to: { ...from, ...to }, t: 0, ms }; }
  _wire() {
    const el = this.R.domElement, pts = new Map(); let moved = 0, pinch = 0;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; this.tween = null; });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const [x0, y0] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) this.zoom(pinch / d); pinch = d; moved += 10; return; }
      const dx = e.clientX - x0, dy = e.clientY - y0; moved += Math.abs(dx) + Math.abs(dy);
      if (this.pan && (e.shiftKey || e.buttons === 2)) return;
      this.cam.ang -= dx * 0.008; this.cam.el = Math.min(1.35, Math.max(0.12, this.cam.el + dy * 0.005)); this.place();
    });
    const up = (e) => { const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (was && moved < 8 && e.type === 'pointerup') this.tap(e); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  }
  zoom(f) { this.cam.dist = Math.min(this.maxD, Math.max(this.minD, this.cam.dist * f)); this.place(); }
  tap(e) {
    if (!this.onTap) return;
    const r = this.R.domElement.getBoundingClientRect(), v = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.C);
    const hit = this.ray.intersectObjects(this.pick, true)[0];
    let o = hit?.object; while (o && !o.userData?.tap) o = o.parent;
    this.onTap(o?.userData?.tap || null);
  }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    if (this.tween) { const w = this.tween; w.t += dt * 1000; const k = Math.min(1, w.t / w.ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; for (const key of Object.keys(w.to)) this.cam[key] = w.from[key] + (w.to[key] - w.from[key]) * e; this.place(); if (k >= 1) this.tween = null; }
    for (let i = this.anim.length - 1; i >= 0; i--) if (this.anim[i](dt, t) === false) this.anim.splice(i, 1);
    this.R.render(this.S, this.C);
    if (this.labels.length) this.drawLabels();
  }
  drawLabels() {
    const W = this.host.clientWidth, H = this.host.clientHeight, v = new T.Vector3();
    if (this.lbl.childElementCount !== this.labels.length) this.lbl.innerHTML = this.labels.map((l) => `<div class="q3-l ${l.cls || ''}">${l.html}</div>`).join('');
    this.labels.forEach((l, i) => {
      const d = this.lbl.children[i]; v.set(...l.p).project(this.C);
      const hide = v.z > 1 || (l.maxD && this.cam.dist > l.maxD);
      d.style.display = hide ? 'none' : ''; if (hide) return;
      d.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    });
  }
  setLabels(L) { this.labels = L; this.lbl.innerHTML = ''; }
  snapshot() { this.R.render(this.S, this.C); return this.R.domElement.toDataURL('image/png'); }
  dispose() {
    if (this.dead) return; this.dead = true; cancelAnimationFrame(this.raf); this.ro?.disconnect();
    this.S.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
    this.R.dispose(); this.R.forceContextLoss?.(); this.R.domElement.remove(); this.lbl.remove();
  }
}

/* ------------------------------------------------ أدوات البناء */
function kit(S) {
  const std = (o) => new T.MeshStandardMaterial(o);
  const tex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const add = (geo, mat, x, y, z, p) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, p) => add(new T.BoxGeometry(w, h, d), mat, x, y, z, p);
  const archGeo = (w, h, depth) => { const s = new T.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0); return new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 }); };
  const arch = (w, h, mat, x, y, z, p, ry = 0, depth = 0.1) => { const m = add(archGeo(w, h, depth), mat, x, y, z, p); m.rotation.y = ry; return m; };
  const cren = (len, axis, x, y, z, mat, p, step = 0.9) => { const g = new T.BoxGeometry(0.45, 0.5, 0.45); for (let t = -len / 2 + 0.3; t <= len / 2 - 0.2; t += step) add(g, mat, axis === 'x' ? x + t : x, y, axis === 'x' ? z : z + t, p); };
  return { std, tex, add, box, arch, cren };
}
const MATS = {};
function mats(night) {
  const k = night ? 'n' : 'd'; if (MATS[k]) return MATS[k];
  const std = (o) => new T.MeshStandardMaterial(o);
  return (MATS[k] = {
    stone: [std({ color: 0xf1dfbd, roughness: 0.8 }), std({ color: 0xfbf8f2, roughness: 0.35 }), std({ color: 0xfbf1d8, roughness: 0.3, metalness: 0.15 })],
    stone2: std({ color: 0xd4b583, roughness: 0.85 }), trim: [std({ color: 0xb98f52, roughness: 0.7 }), std({ color: 0xc9c2b4, roughness: 0.4 }), std({ color: 0xffc23d, metalness: 0.8, roughness: 0.3 })],
    gold: std({ color: 0xffc23d, metalness: 0.85, roughness: 0.25, emissive: 0x4a2e00, emissiveIntensity: 0.3 }),
    dome: { teal: std({ color: 0x14857a, metalness: 0.3, roughness: 0.35 }), blue: std({ color: 0x2554c7, metalness: 0.3, roughness: 0.35 }), gold: std({ color: 0xffc23d, metalness: 0.85, roughness: 0.25 }), green: std({ color: 0x0d5c46, metalness: 0.2, roughness: 0.4 }) },
    green: std({ color: 0x0d5c46, roughness: 0.5 }), wood: std({ color: 0x8a5a2b, roughness: 0.7 }),
    win: std({ color: 0x1a2c52, emissive: night ? 0xffb84a : 0x000000, emissiveIntensity: night ? 1.3 : 0 }),
    grass: std({ color: 0x4a9a55, roughness: 1 }), sand: std({ color: 0xe3c890, roughness: 1 }), road: std({ color: 0xe8d3a6, roughness: 1 }),
    water: std({ color: 0x5ec8f5, roughness: 0.1, emissive: 0x0a4a6a, emissiveIntensity: 0.4 }),
    trunk: std({ color: 0x7a4a1c }), leaf: std({ color: 0x2f9a4a, side: T.DoubleSide }),
    lamp: std({ color: 0xffcf4a, emissive: 0xffa21a, emissiveIntensity: night ? 2 : 0.5 }),
    ghost: new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }),
    flags: [0x0d5c46, 0xc0263e, 0xffc23d, 0x2554c7].map((c) => std({ color: c, side: T.DoubleSide })),
    flower: [0xff6b9a, 0xffd23f, 0xffffff, 0xff8c42].map((c) => std({ color: c })),
    noor: std({ color: 0xfff1c4, emissive: 0xffc860, emissiveIntensity: night ? 2.4 : 1 }),
  });
}

export function sky(sc, night) {
  const S = sc.S, { tex } = kit(S);
  S.background = tex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); if (night) { g.addColorStop(0, '#071330'); g.addColorStop(0.7, '#1d3a78'); g.addColorStop(1, '#3a5aa0'); } else { g.addColorStop(0, '#4f9fe8'); g.addColorStop(1, '#d9eeff'); } x.fillStyle = g; x.fillRect(0, 0, w, h); });
  S.add(new T.HemisphereLight(night ? 0x6d8cff : 0xffffff, 0x8a6a3a, night ? 0.55 : 1.1));
  const sun = new T.DirectionalLight(night ? 0xaac4ff : 0xfff1d0, night ? 0.8 : 2.2); sun.position.set(20, 32, 16); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 120 }); sun.shadow.camera.updateProjectionMatrix(); S.add(sun);
  if (night) { const p = []; for (let i = 0; i < 300; i++) { const th = Math.random() * 6.28, ph = 0.15 + Math.random() * 1.2; p.push(150 * Math.cos(th) * Math.cos(ph), 150 * Math.sin(ph), 150 * Math.sin(th) * Math.cos(ph)); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); S.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.7 }))); }
}

/* ------------------------------------------------ القصر: ١٢ مرحلة تُبنى بالترتيب */
// st = { lv, mat: 0|1|2, dome: 'teal'|'blue'|'gold'|'green', name } ؛ ghost: يرسم المرحلة التالية شبحاً
export function buildPalace(sc, st, { detail = true, ghost = false, night = sc.night, onPart = null } = {}) {
  const K = kit(sc.S), M = mats(night), G = new T.Group(), lv = st.lv || 0, mi = Math.min(2, st.mat || 0);
  const STONE = M.stone[mi], TRIM = M.trim[mi], DOME = M.dome[st.dome] || M.dome.teal;
  const P = {};
  const part = (n, fn) => { const show = lv >= n, gh = ghost && n === lv + 1; if (!show && !gh) return; const g = new T.Group(); g.userData.stage = n; fn(g, gh ? M.ghost : null); if (gh) g.traverse((o) => { if (o.isMesh) { o.material = M.ghost; o.castShadow = false; } }); G.add(g); P[n] = g; onPart?.(n, g, gh); };
  const { box, add, arch, cren } = K, WX = 22, WZ = 17;
  part(1, (g) => { // الأساس والسور
    add(new T.CylinderGeometry(15.5, 15.5, 0.3, 48), M.grass, 0, -0.15, 0, g);
    for (const s of [-1, 1]) { box(WX, 1.4, 0.6, M.stone2, 0, 0.7, -WZ / 2, g); box(0.6, 1.4, WZ, M.stone2, s * WX / 2, 0.7, 0, g); box(8.6, 1.4, 0.6, M.stone2, s * 6.7, 0.7, WZ / 2, g); }
    box(12, 0.5, 8, TRIM, 0, 0.25, -2.5, g); box(2.4, 0.05, 9, M.sand, 0, 0.03, 9.5, g);
    if (detail) { cren(WX, 'x', 0, 1.65, -WZ / 2, M.stone2, g); cren(WZ, 'z', -WX / 2, 1.65, 0, M.stone2, g); cren(WZ, 'z', WX / 2, 1.65, 0, M.stone2, g); for (const s of [-1, 1]) cren(8, 'x', s * 7, 1.65, WZ / 2, M.stone2, g); }
  });
  part(2, (g) => { box(11, 4.4, 7, STONE, 0, 2.7, -2.5, g); arch(2, 3, M.green, 0, 0.5, 1.01, g); box(11.4, 0.35, 7.4, TRIM, 0, 5.05, -2.5, g); });
  part(3, (g) => { for (const x of [-3.6, -2.1, 2.1, 3.6]) { arch(0.85, 1.5, M.win, x, 1.6, 1.01, g, 0, 0.06); arch(0.85, 1.3, M.win, x, 3.4, 1.01, g, 0, 0.06); } for (const s of [-1, 1]) for (const z of [-4.5, -1]) { const a = arch(0.85, 1.4, M.win, s * 5.51, 2.2, z, g, s * Math.PI / 2, 0.06); a.position.x = s * 5.51; }
    box(3.2, 0.2, 1, TRIM, 0, 3.7, 1.4, g); if (detail) for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) box(0.12, 0.5, 0.12, M.gold, x, 4, 1.85, g); });
  part(4, (g) => { cren(11, 'x', 0, 5.45, 1, STONE, g); cren(11, 'x', 0, 5.45, -6, STONE, g); cren(7, 'z', -5.5, 5.45, -2.5, STONE, g); cren(7, 'z', 5.5, 5.45, -2.5, STONE, g); });
  const tower = (g, x, z, h) => { box(2.2, h, 2.2, STONE, x, h / 2, z, g); box(2.6, 0.35, 2.6, TRIM, x, h + 0.1, z, g); if (detail) { for (const [dx, dz, ax] of [[0, 1.05, 'x'], [0, -1.05, 'x'], [1.05, 0, 'z'], [-1.05, 0, 'z']]) cren(2.4, ax, x + dx, h + 0.55, z + dz, STONE, g, 0.8); for (const y of [2.5, 4.5]) arch(0.55, 1, M.win, x, y, z + 1.11, g, 0, 0.05); } };
  part(5, (g) => { tower(g, -6, 1, 7.5); tower(g, 6, 1, 7.5); });
  part(6, (g) => { // بوابة السور واسم القصر
    for (const s of [-1, 1]) { box(1.6, 4.2, 1.6, STONE, s * 2.6, 2.1, WZ / 2, g); if (detail) cren(1.4, 'x', s * 2.6, 4.45, WZ / 2 + 0.55, STONE, g, 0.7); }
    box(3.6, 1, 1.4, STONE, 0, 3.6, WZ / 2, g); arch(3.2, 3.1, M.wood, 0, 0, WZ / 2 + 0.7, g);
    if (detail && st.name) { const t = K.tex(512, 96, (x, w, h) => { x.fillStyle = '#0d5c46'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffd666'; x.lineWidth = 6; x.strokeRect(4, 4, w - 8, h - 8); x.fillStyle = '#ffd666'; x.font = 'bold 50px "Noto Sans Arabic", sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('قصر ' + st.name, w / 2, 64); }); add(new T.PlaneGeometry(3, 0.55), new T.MeshBasicMaterial({ map: t }), 0, 3.75, WZ / 2 + 0.72, g); }
    const gate = new T.Group(); gate.userData.tap = { kind: 'gate' }; g.add(gate); box(3.4, 3.6, 0.4, new T.MeshBasicMaterial({ visible: false }), 0, 1.8, WZ / 2 + 0.8, gate);
  });
  part(7, (g) => { // الفناء
    add(new T.CylinderGeometry(1.5, 1.6, 0.45, 28), M.stone2, 0, 0.22, 5, g); const w = add(new T.CylinderGeometry(1.3, 1.3, 0.1, 28), M.water, 0, 0.46, 5, g); add(new T.CylinderGeometry(0.15, 0.2, 1, 10), STONE, 0, 0.9, 5, g);
    if (detail) { const jet = add(new T.ConeGeometry(0.35, 0.9, 12, 1, true), new T.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55 }), 0, 1.7, 5, g); jet.rotation.x = Math.PI; sc.anim.push((dt, t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.12; w.rotation.y += dt * 0.3; }); }
    for (const s of [-1, 1]) for (const z of [3, 7]) { box(0.12, 1.6, 0.12, TRIM, s * 1.6, 0.8, z, g); box(0.32, 0.42, 0.32, M.lamp, s * 1.6, 1.75, z, g); }
  });
  part(8, (g) => { add(new T.CylinderGeometry(1.6, 1.6, 0.9, 32), STONE, 0, 5.7, -2.5, g); add(new T.SphereGeometry(1.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), DOME, 0, 6.15, -2.5, g); add(new T.SphereGeometry(0.18, 12, 8), M.gold, 0, 8, -2.5, g); });
  part(9, (g) => { tower(g, -6, -6, 6.5); tower(g, 6, -6, 6.5); });
  part(10, (g) => { // الرايات والزخارف
    const flag = (x, y, z, i) => { box(0.07, 2.2, 0.07, TRIM, x, y + 1.1, z, g); const f = add(new T.PlaneGeometry(1.1, 0.7, 6, 1), M.flags[i % 4], x + 0.58, y + 1.85, z, g); f.rotation.y = 0.3; if (detail) { const p = f.geometry.attributes.position, base = p.array.slice(); sc.anim.push((dt, t) => { for (let k = 0; k < p.count; k++) { const xx = base[k * 3]; p.array[k * 3 + 2] = Math.sin(t * 4 + xx * 4) * 0.08 * (xx + 0.55); } p.needsUpdate = true; }); } };
    flag(-6, 7.8, 1, 0); flag(6, 7.8, 1, 2); flag(-2.6, 4.2, WZ / 2, 0); flag(2.6, 4.2, WZ / 2, 1);
    box(11.5, 0.18, 0.1, M.gold, 0, 4.6, 1.06, g); for (const x of [-4.5, 4.5]) add(new T.SphereGeometry(0.22, 12, 8), M.gold, x, 5.4, 1.1, g);
  });
  part(11, (g) => { // النخيل والزهور
    const palm = (x, z, h) => { add(new T.CylinderGeometry(0.16, 0.24, h, 8), M.trunk, x, h / 2, z, g); const top = new T.Group(); top.position.set(x, h, z); g.add(top); for (let i = 0; i < 8; i++) { const r = new T.Group(); r.rotation.y = i * 0.785; top.add(r); const l = box(0.5, 0.06, 2.2, M.leaf, 0, -0.35, 1.05, r); l.rotation.x = 0.45; } if (detail) { const ph = Math.random() * 6; sc.anim.push((dt, t) => { top.rotation.z = Math.sin(t * 1.2 + ph) * 0.05; }); } };
    for (const [x, z, h] of [[-8.5, 5, 3.8], [8.5, 5.5, 3.8], [-8.6, -1, 3.6], [8.4, -1.5, 3.6], [-4, 6.5, 3], [4.2, 6.8, 3]]) palm(x, z, h);
    if (detail) { const fg = new T.SphereGeometry(0.2, 8, 6); for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) add(fg, M.flower[i % 4], sx * (3 + (i % 6) * 0.45), 0.2, 2.6 + Math.floor(i / 6) * 0.5, g); }
  });
  part(12, (g) => { // قصر من نور
    for (const [x, z] of [[-6, 1], [6, 1], [-6, -6], [6, -6]]) add(new T.TorusGeometry(1.5, 0.08, 8, 32), M.noor, x, 8.4, z, g).rotation.x = Math.PI / 2;
    add(new T.TorusGeometry(1.75, 0.08, 8, 40), M.noor, 0, 6.2, -2.5, g).rotation.x = Math.PI / 2;
    if (detail) { const pts = []; for (let i = 0; i < 120; i++) pts.push((Math.random() - 0.5) * 20, 1 + Math.random() * 10, (Math.random() - 0.5) * 16); const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); const pp = new T.Points(pg, new T.PointsMaterial({ color: 0xffd666, size: 0.18, transparent: true, opacity: 0.9 })); g.add(pp); sc.anim.push((dt, t) => { pp.rotation.y = t * 0.08; pp.material.opacity = 0.6 + Math.sin(t * 2) * 0.3; }); }
  });
  return { G, P };
}

/* ------------------------------------------------ مبانٍ التوسعة (القطعة الثانية) */
export function buildExt(sc, n, { detail = true, ghost = false } = {}) {
  const K = kit(sc.S), M = mats(sc.night), G = new T.Group(), { box, add } = K;
  const part = (k, fn) => { if (n >= k) { const g = new T.Group(); fn(g); G.add(g); } else if (ghost && k === n + 1) { const g = new T.Group(); fn(g); g.traverse((o) => { if (o.isMesh) o.material = M.ghost; }); G.add(g); } };
  add(new T.CylinderGeometry(15.5, 15.5, 0.3, 48), M.grass, 0, -0.15, 0, G);
  part(1, (g) => { for (let i = 0; i < 9; i++) { const x = -8 + (i % 3) * 8, z = -6 + Math.floor(i / 3) * 6; add(new T.CylinderGeometry(0.18, 0.25, 3.4, 8), M.trunk, x, 1.7, z, g); for (let j = 0; j < 8; j++) { const r = new T.Group(); r.position.set(x, 3.4, z); r.rotation.y = j * 0.785; g.add(r); const l = box(0.5, 0.06, 2, M.leaf, 0, -0.3, 1, r); l.rotation.x = 0.45; } } });
  part(2, (g) => { box(8, 3, 4, M.wood, -4, 1.5, -2, g); box(8.6, 0.3, 4.6, M.trim[0], -4, 3.1, -2, g); for (const x of [-6, -4, -2]) { const h = new T.Group(); h.position.set(x, 0, 1.5); g.add(h); box(0.6, 0.9, 1.8, new T.MeshStandardMaterial({ color: [0x7a4a1c, 0xf5f5f5, 0x2b2b2b][(x + 6) / 2] }), 0, 1.2, 0, h); box(0.35, 0.9, 0.5, new T.MeshStandardMaterial({ color: 0x7a4a1c }), 0, 1.75, 0.9, h); for (const dx of [-0.2, 0.2]) for (const dz of [-0.6, 0.6]) box(0.14, 0.8, 0.14, M.trunk, dx, 0.4, dz, h); } });
  part(3, (g) => { const w = add(new T.CylinderGeometry(4.5, 4.5, 0.2, 40), M.water, 4, 0.1, 2, g); const br = box(1.4, 0.3, 9.5, M.wood, 4, 0.4, 2, g); br.rotation.y = 0.6; });
  part(4, (g) => { box(6, 4, 5, M.stone[1], 4, 2, -5, g); add(new T.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.dome.gold, 4, 4, -5, g); K.arch(1.6, 2.6, M.green, 4, 0, -2.49, g); });
  return { G };
}

/* ------------------------------------------------ دار وقف المصاحف (مبنى وسط الخريطة) */
export function buildWaqfHouse(sc, { detail = true, fill = 0 } = {}) {
  const K = kit(sc.S), M = mats(sc.night), G = new T.Group(), { box, add, arch } = K, W = M.stone[1];
  box(16, 0.6, 14, M.stone2, 0, 0.3, 0, G);
  box(12, 6, 9, W, 0, 3.6, -1, G); box(12.6, 0.4, 9.6, M.gold, 0, 6.8, -1, G);
  add(new T.CylinderGeometry(3, 3, 1.2, 40), W, 0, 7.5, -1, G); add(new T.SphereGeometry(3.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, 0, 8.1, -1, G); add(new T.CylinderGeometry(0.07, 0.07, 1.4, 8), M.gold, 0, 11.9, -1, G);
  for (const s of [-1, 1]) { add(new T.CylinderGeometry(0.7, 0.85, 12, 20), W, s * 7, 6.6, -4.5, G); const b = add(new T.TorusGeometry(0.9, 0.14, 8, 24), M.gold, s * 7, 9.5, -4.5, G); b.rotation.x = Math.PI / 2; add(new T.ConeGeometry(0.75, 2, 20), M.gold, s * 7, 13.6, -4.5, G); }
  arch(3, 4.6, M.green, 0, 0.6, 3.51, G);
  for (const x of [-4, -2.2, 2.2, 4]) arch(1.1, 2.4, M.win, x, 2, 3.51, G, 0, 0.06);
  // مصحف مفتوح فوق المدخل
  const bk = new T.Group(); bk.position.set(0, 5.6, 3.9); G.add(bk);
  for (const s of [-1, 1]) { const pg = box(1.5, 0.08, 1.9, new T.MeshStandardMaterial({ color: 0xfffaf0 }), s * 0.76, 0, 0, bk); pg.rotation.z = -s * 0.28; const cv = box(1.56, 0.06, 1.96, M.green, s * 0.76, -0.06, 0, bk); cv.rotation.z = -s * 0.28; }
  bk.rotation.x = -0.5;
  G.userData.tap = { kind: 'waqf' };
  return { G };
}

/* ------------------------------------------------ الخريطة: N×N قطعة، والوسط لدار الوقف */
export function plotXY(id, N, P = 34) { const [c, r] = id.split('_').map(Number); return [(c - (N - 1) / 2) * P, (r - (N - 1) / 2) * P]; }
export function buildMap(sc, { N, plots, me, sel, center, waqfFill = 0 }) {
  const K = kit(sc.S), M = mats(sc.night), P = 34, half = (N * P) / 2, { box, add } = K;
  sky(sc, sc.night);
  add(new T.CylinderGeometry(half * 1.5, half * 1.55, 2, 64), M.sand, 0, -1.2, 0, sc.S);
  const sea = add(new T.CircleGeometry(half * 4, 64), new T.MeshStandardMaterial({ color: 0x2b8fd6, roughness: 0.2 }), 0, -1.6, 0, sc.S); sea.rotation.x = -Math.PI / 2; sea.receiveShadow = false;
  add(new T.CylinderGeometry(half * 1.38, half * 1.38, 0.3, 64), M.grass, 0, -0.25, 0, sc.S);
  for (let i = 0; i <= N; i++) { const o = (i - N / 2) * P; box(N * P + 3, 0.08, 3, M.road, 0, 0.05, o, sc.S); box(3, 0.08, N * P + 3, M.road, o, 0.05, 0, sc.S); }
  const tileG = new T.BoxGeometry(P - 4, 0.2, P - 4);
  const tm = { free: new T.MeshStandardMaterial({ color: 0x9fd3a8, transparent: true, opacity: 0.85 }), own: new T.MeshStandardMaterial({ color: 0x5fae6c }), mine: new T.MeshStandardMaterial({ color: 0x7cc98a, emissive: 0x0d5c46, emissiveIntensity: 0.25 }), sel: new T.MeshStandardMaterial({ color: 0xffd666, emissive: 0xffb000, emissiveIntensity: 0.7 }) };
  const pinG = new T.ConeGeometry(1, 2.4, 4), pinM = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const byId = Object.fromEntries(plots.map((p) => [p.id, p])), labels = [], tiles = {};
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const id = c + '_' + r, [x, z] = plotXY(id, N, P);
    if (id === center) {
      box(P - 4, 0.3, P - 4, new T.MeshStandardMaterial({ color: 0xf3e3c3 }), x, 0.15, z, sc.S);
      const { G } = buildWaqfHouse(sc, { detail: true, fill: waqfFill }); G.position.set(x, 0, z); G.scale.setScalar(1.3); sc.S.add(G); sc.pick.push(G);
      labels.push({ p: [x, 22, z], html: '📖 دار وقف المصاحف', cls: 'w' }); continue;
    }
    const p = byId[id], mine = p && p.pn === me;
    const tile = add(tileG, id === sel ? tm.sel : mine ? tm.mine : p ? tm.own : tm.free, x, 0.1, z, sc.S); tile.userData.tap = { kind: 'plot', id }; sc.pick.push(tile); tiles[id] = tile;
    if (p) {
      const { G } = p.main ? buildExt(sc, p.ext || 0, { detail: false }) : buildPalace(sc, { lv: p.lv || 0, mat: p.mat, dome: p.dome, name: '' }, { detail: false });
      mergeStatic(G); G.scale.setScalar(p.main ? 0.95 : 1.05); G.position.set(x, 0, z); G.traverse((o) => (o.castShadow = o.receiveShadow = false));
      G.userData.tap = { kind: 'plot', id }; sc.S.add(G); sc.pick.push(G);
      const likes = Object.keys(p.likes || {}).length;
      labels.push({ p: [x, (p.lv || 0) >= 5 ? 11 : 5, z], html: `${mine ? '⭐ ' : ''}${esc(first(p.name))}${p.main ? ' (توسعة)' : ''}${likes ? ` <small>❤${AR(likes)}</small>` : ''}`, cls: mine ? 'me' : '' });
    } else { const pin = add(pinG, pinM, x, 1.6, z, sc.S); pin.rotation.x = Math.PI; pin.castShadow = false; }
  }
  sc.setLabels(labels);
  return { tiles, P };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).join(' ');

/* ------------------------------------------------ داخل القصر */
// items: { rug, majlis: 0..3, dallah, shelf: 0..2, plaque, chand, lanterns, trophy, certw } ؛ stats: { cups, certs, waqf }
export const ROOM_VIEWS = { majlis: { tx: -4, ty: 1.4, tz: 0.5, ang: 0.9, el: 0.25, dist: 9 }, library: { tx: 0, ty: 2.4, tz: -5, ang: 0.15, el: 0.15, dist: 10 }, trophy: { tx: 6, ty: 2.2, tz: -1.5, ang: -1.2, el: 0.18, dist: 9 }, all: { tx: 0, ty: 2.4, tz: -1, ang: 0.35, el: 0.32, dist: 15 } };
export function buildInterior(sc, items = {}, stats = {}) {
  const K = kit(sc.S), M = mats(false), S = sc.S, { box, add, arch, tex } = K, std = K.std;
  S.background = new T.Color(0x1a1208);
  S.add(new T.HemisphereLight(0xfff1d6, 0x3a2a14, items.chand ? 0.8 : 0.6));
  const key = new T.PointLight(0xffd59a, items.chand ? 110 : 60, 30); key.position.set(0, 6.2, 0); key.castShadow = true; S.add(key);
  const fill = new T.DirectionalLight(0xffffff, 0.5); fill.position.set(4, 8, 10); S.add(fill);
  const W = 14, D = 12, H = 7;
  add(new T.PlaneGeometry(W, D), std({ map: tex(512, 512, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#efe6d4' : '#dcccad'; x.fillRect(i * 64, j * 64, 64, 64); } }), roughness: 0.3 }), 0, 0, 0, S).rotation.x = -Math.PI / 2;
  const wall = std({ color: 0xf3e6cc, roughness: 0.9 });
  box(W, H, 0.3, wall, 0, H / 2, -D / 2, S); box(0.3, H, D, wall, -W / 2, H / 2, 0, S); box(0.3, H, D, wall, W / 2, H / 2, 0, S); box(W, 0.4, D, std({ color: 0xe9d6ad }), 0, H, 0, S);
  const band = tex(1024, 64, (x, w, h) => { x.fillStyle = '#0d5c46'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8b84a'; x.lineWidth = 3; for (let i = 0; i < w; i += 48) { x.save(); x.translate(i + 24, 32); x.rotate(Math.PI / 4); x.strokeRect(-12, -12, 24, 24); x.restore(); x.strokeRect(i + 12, 20, 24, 24); } });
  add(new T.PlaneGeometry(W, 0.55), std({ map: band }), 0, 5.6, -D / 2 + 0.16, S); for (const s of [-1, 1]) { const b = add(new T.PlaneGeometry(D, 0.55), std({ map: band }), s * (W / 2 - 0.16), 5.6, 0, S); b.rotation.y = -s * Math.PI / 2; }
  for (const s of [-1, 1]) for (const z of [-3.5, 0, 3.5]) { add(new T.CylinderGeometry(0.22, 0.26, 4.6, 16), M.stone[0], s * 5.6, 2.3, z, S); box(0.6, 0.3, 0.6, M.gold, s * 5.6, 4.7, z, S); }
  const tap = (o, kind) => { o.userData.tap = { kind }; sc.pick.push(o); return o; };
  // السجادة
  if (items.rug) { const rug = add(new T.PlaneGeometry(7, 5), std({ map: tex(512, 360, (x, w, h) => { x.fillStyle = '#8f1d2c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8b84a'; x.lineWidth = 14; x.strokeRect(18, 18, w - 36, h - 36); x.lineWidth = 4; x.strokeRect(44, 44, w - 88, h - 88); x.fillStyle = '#1d3f7a'; x.beginPath(); for (let k = 0; k < 8; k++) { const an = (k * Math.PI) / 4; x.lineTo(w / 2 + Math.cos(an) * 90, h / 2 + Math.sin(an) * 90); x.lineTo(w / 2 + Math.cos(an + 0.39) * 50, h / 2 + Math.sin(an + 0.39) * 50); } x.fill(); }) }), 0, 0.01, 0.8, S); rug.rotation.x = -Math.PI / 2; rug.castShadow = false; }
  // المكتبة: رف أو رفان
  const shelfN = Math.min(2, items.shelf || 0);
  for (let k = 0; k < shelfN; k++) { const sx = k === 0 ? 1 : -1, x0 = sx * 3.6, g = new T.Group(); S.add(g); tap(g, 'library');
    box(4.2, 4.4, 0.15, M.wood, x0, 2.4, -D / 2 + 0.25, g); for (const e of [-1, 1]) box(0.12, 4.4, 0.7, M.wood, x0 + e * 2.05, 2.4, -D / 2 + 0.5, g);
    for (let r = 0; r < 4; r++) { box(4, 0.08, 0.55, std({ color: 0x5a3818 }), x0, 0.9 + r * 1.05, -D / 2 + 0.55, g); let x = x0 - 1.8, i = 0; while (x < x0 + 1.75) { const w = 0.12 + ((i * 37) % 9) / 100, h = 0.55 + ((i * 53) % 30) / 100, isM = r === 1; box(w, isM ? 0.7 : h, 0.38, isM ? std({ color: 0x0d5c46 }) : std({ color: [0x8f1d2c, 0x1d3f7a, 0x6b4a1c, 0x2f6b4a, 0x9a6a1c][i % 5] }), x + w / 2, 0.95 + r * 1.05 + (isM ? 0.35 : h / 2), -D / 2 + 0.55, g); if (isM) box(w * 0.6, 0.1, 0.39, M.gold, x + w / 2, 0.95 + r * 1.05 + 0.4, -D / 2 + 0.55, g); x += w + 0.03; i++; } } }
  if (stats.waqf) { const wm = std({ color: 0xffc23d, metalness: 0.7, roughness: 0.3, emissive: 0x5a3800, emissiveIntensity: 0.5 }); box(0.5, 0.7, 0.36, wm, 0, 1.3, -D / 2 + 0.6, S); }
  // لوحة الآية
  if (items.plaque) { arch(1.8, 3.2, M.green, 0, 0.6, -D / 2 + 0.2, S, 0, 0.08); const ay = tex(256, 160, (x, w) => { x.fillStyle = '#0d5c46'; x.fillRect(0, 0, w, 160); x.fillStyle = '#ffd666'; x.font = 'bold 30px "Noto Naskh Arabic", serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('وَقُل رَّبِّ', w / 2, 70); x.fillText('زِدْنِي عِلْمًا', w / 2, 115); }); add(new T.PlaneGeometry(1.5, 0.95), new T.MeshBasicMaterial({ map: ay }), 0, 2.4, -D / 2 + 0.3, S); }
  // المجلس بدرجاته
  const mj = items.majlis || 0;
  if (mj) { const g = new T.Group(); S.add(g); tap(g, 'majlis'); const col = [0, 0x8f1d2c, 0x9a5b2b, 0xb8860b][mj], back = std({ color: col, metalness: mj === 3 ? 0.4 : 0, roughness: 0.6 }), seat = std({ color: col }); const acc = mj >= 2 ? M.gold : M.trim[0];
    for (const z of [-3.5, -1.5, 0.5, 2.5]) { box(1.1, 0.45, 1.9, seat, -6.2, 0.23, z, g); box(0.35, 0.9, 1.9, back, -6.65, 0.7, z, g); box(0.5, 0.4, 0.5, acc, -6.0, 0.62, z - 0.6, g); } }
  if (items.dallah) { add(new T.CylinderGeometry(0.8, 0.8, 0.08, 24), M.gold, -3.6, 0.35, 0.5, S); add(new T.CylinderGeometry(0.06, 0.06, 0.3, 8), M.trim[0], -3.6, 0.15, 0.5, S); add(new T.LatheGeometry([[0, 0], [0.18, 0], [0.22, 0.15], [0.12, 0.35], [0.08, 0.45], [0.14, 0.55], [0, 0.62]].map(([a, b]) => new T.Vector2(a, b)), 24), M.gold, -3.4, 0.39, 0.4, S); }
  // قاعة الأوسمة: الكؤوس بعدد ألقابه، والشهادات بعدد شهاداته
  if (items.trophy) { const g = new T.Group(); S.add(g); tap(g, 'trophy'); box(0.5, 3.2, 5, M.wood, 6.6, 1.9, -1.5, g); for (const y of [1.05, 2.25]) box(0.6, 0.07, 5, std({ color: 0x5a3818 }), 6.35, y, -1.5, g);
    const cupG = new T.LatheGeometry([[0, 0], [0.2, 0], [0.2, 0.05], [0.06, 0.1], [0.06, 0.3], [0.25, 0.45], [0.28, 0.75], [0, 0.72]].map(([a, b]) => new T.Vector2(a, b)), 20);
    const n = Math.min(6, stats.cups || 0); for (let i = 0; i < n; i++) add(cupG, M.gold, 6.3, i < 3 ? 1.1 : 2.3, -3.2 + (i % 3) * 1.7, g); }
  if (items.certw) { const n = Math.min(3, Math.max(1, stats.certs || 0)); for (let i = 0; i < 3; i++) { const has = i < (stats.certs || 0), col = ['#c99a1d', '#8f8f8f', '#0d5c46'][i]; const t = tex(256, 180, (x, w, h) => { x.fillStyle = has ? '#fffaf0' : '#f3efe6'; x.fillRect(0, 0, w, h); x.strokeStyle = has ? col : '#ccc'; x.lineWidth = 12; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = has ? col : '#aaa'; x.font = 'bold 28px "Noto Sans Arabic", sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(has ? 'شهادة تقدير' : 'شهادتك القادمة', w / 2, 98); }); const p = add(new T.PlaneGeometry(1.4, 1), new T.MeshBasicMaterial({ map: t }), W / 2 - 0.18, 4.1, -3.2 + i * 1.7, S); p.rotation.y = -Math.PI / 2; } void n; }
  if (items.chand) { const ch = new T.Group(); ch.position.set(0, 5.6, 0.6); S.add(ch); box(0.05, 1.2, 0.05, M.gold, 0, 0.6, 0, ch); add(new T.TorusGeometry(1, 0.05, 8, 32), M.gold, 0, 0, 0, ch).rotation.x = Math.PI / 2; for (let i = 0; i < 10; i++) { const an = (i / 10) * 6.28; add(new T.SphereGeometry(0.11, 10, 8), std({ color: 0xfff1c4, emissive: 0xffc860, emissiveIntensity: 3 }), Math.cos(an), 0.05, Math.sin(an), ch); } sc.anim.push((dt) => { ch.rotation.y += dt * 0.1; }); }
  if (items.lanterns) for (const [x, z] of [[-6.8, -5], [6.8, 3.5], [-6.8, 4]]) add(new T.CylinderGeometry(0.18, 0.14, 0.45, 6), std({ color: 0xffcf4a, emissive: 0xffa21a, emissiveIntensity: 2 }), x, 3.5, z, S);
}

/* ------------------------------------------------ داخل دار الوقف: رفوف تمتلئ بالمصاحف */
export function buildWaqfHall(sc, fill = 0, units = 50) {
  const K = kit(sc.S), M = mats(false), S = sc.S, { box, add, arch, tex } = K, std = K.std, done = fill >= 1;
  S.background = new T.Color(0x20170c);
  S.add(new T.HemisphereLight(0xfff1d6, 0x3a2a14, 0.75));
  const key = new T.PointLight(0xffd59a, done ? 140 : 80, 30); key.position.set(0, 6, 2); key.castShadow = true; S.add(key);
  const dl = new T.DirectionalLight(0xffffff, 0.5); dl.position.set(3, 6, 10); S.add(dl);
  const W = 16, D = 10, H = 7.5;
  add(new T.PlaneGeometry(W, D), std({ map: tex(512, 320, (x, w) => { for (let r = 0; r < 8; r++) { x.fillStyle = r % 2 ? '#7a1626' : '#8f1d2c'; x.fillRect(0, r * 40, w, 40); x.strokeStyle = '#d9a640'; x.lineWidth = 2; for (let i = 0; i < w; i += 40) { x.beginPath(); x.moveTo(i + 6, r * 40 + 36); x.lineTo(i + 6, r * 40 + 14); x.arc(i + 20, r * 40 + 14, 14, Math.PI, 0); x.lineTo(i + 34, r * 40 + 36); x.stroke(); } } }), roughness: 0.9 }), 0, 0, 0, S).rotation.x = -Math.PI / 2;
  const wall = std({ color: 0xf3e6cc, roughness: 0.9 });
  box(W, H, 0.3, wall, 0, H / 2, -D / 2, S); box(0.3, H, D, wall, -W / 2, H / 2, 0, S); box(0.3, H, D, wall, W / 2, H / 2, 0, S);
  arch(2.6, 4.6, std({ color: 0x0d5c46 }), 0, 0, -D / 2 + 0.16, S); arch(2.1, 4.1, std({ color: 0xc99a1d, metalness: 0.6, roughness: 0.3 }), 0, 0.2, -D / 2 + 0.2, S); arch(1.8, 3.8, std({ color: 0x0b4a38 }), 0, 0.3, -D / 2 + 0.24, S);
  const band = tex(1600, 90, (x, w, h) => { x.fillStyle = '#0d5c46'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd666'; x.font = 'bold 50px "Noto Naskh Arabic", serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('إِنَّ الَّذِينَ يَتْلُونَ كِتَابَ اللَّهِ … يَرْجُونَ تِجَارَةً لَّن تَبُورَ', w / 2, 62); });
  add(new T.PlaneGeometry(W - 1, 0.9), std({ map: band }), 0, 6.3, -D / 2 + 0.17, S);
  const mush = std({ color: 0x0d5c46, roughness: 0.5 }), gold = std({ color: 0xffc23d, metalness: 0.8, roughness: 0.3 }), ghost = new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 }), wood = M.wood, dark = std({ color: 0x5a3818 });
  const slots = []; for (const sx of [-1, 1]) { const x0 = sx * 4.6; box(5.4, 5, 0.2, wood, x0, 2.6, -D / 2 + 0.3, S); for (const e of [-1, 1]) box(0.15, 5, 0.8, wood, x0 + e * 2.65, 2.6, -D / 2 + 0.6, S);
    for (let r = 0; r < 5; r++) { box(5.3, 0.08, 0.75, dark, x0, 0.35 + r, -D / 2 + 0.62, S); for (let i = 0; i < 22; i++) slots.push([x0 - 2.45 + i * 0.232, 0.35 + r + 0.38, -D / 2 + 0.62]); } }
  slots.sort((a, b) => a[1] - b[1] || Math.abs(a[0]) - Math.abs(b[0]));
  const nFull = Math.round(slots.length * Math.min(1, fill)), bg = new T.BoxGeometry(0.2, 0.66, 0.5), bandG = new T.BoxGeometry(0.205, 0.08, 0.51);
  slots.forEach(([x, y, z], i) => { if (i < nFull) { add(bg, mush, x, y, z, S); add(bandG, gold, x, y + 0.16, z, S); add(bandG, gold, x, y - 0.2, z, S); } else add(bg, ghost, x, y, z, S).castShadow = false; });
  const rahl = new T.Group(); rahl.position.set(0, 0, 0.8); S.add(rahl);
  for (const s of [-1, 1]) { const p = box(0.08, 1.3, 1.1, wood, s * 0.35, 0.65, 0, rahl); p.rotation.z = s * 0.5; }
  const book = new T.Group(); book.position.set(0, 1.22, 0); rahl.add(book);
  for (const s of [-1, 1]) { const pg = box(0.75, 0.04, 0.95, std({ color: 0xfffaf0 }), s * 0.38, 0, 0, book); pg.rotation.z = -s * 0.22; const cv = box(0.78, 0.03, 0.98, mush, s * 0.38, -0.03, 0, book); cv.rotation.z = -s * 0.22; }
  const ch = new T.Group(); ch.position.set(0, 5.4, 1.2); S.add(ch); box(0.05, 2, 0.05, gold, 0, 1, 0, ch); add(new T.TorusGeometry(1.3, 0.05, 8, 40), gold, 0, 0, 0, ch).rotation.x = Math.PI / 2;
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28; add(new T.SphereGeometry(0.12, 10, 8), std({ color: 0xfff1c4, emissive: 0xffc860, emissiveIntensity: done ? 4 : 2.2 }), Math.cos(a) * 1.3, 0.05, Math.sin(a) * 1.3, ch); }
  sc.anim.push((dt) => { ch.rotation.y += dt * 0.08; });
  if (done) { const pts = []; for (let i = 0; i < 300; i++) pts.push((Math.random() - 0.5) * 14, Math.random() * 7, (Math.random() - 0.5) * 6); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); const pp = new T.Points(g, new T.PointsMaterial({ color: 0xffd666, size: 0.08 })); S.add(pp); sc.anim.push((dt, t) => { pp.rotation.y = t * 0.05; }); }
  void units;
}

/** حركة بناء: الجزء ينزل من الأعلى ويكبر، مع غبار */
export function buildAnim(sc, g) {
  const y0 = g.position.y; g.position.y = y0 + 6; g.scale.setScalar(0.6); let t = 0;
  const dust = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 240 }, () => (Math.random() - 0.5) * 10), 3)), new T.PointsMaterial({ color: 0xd9c49a, size: 0.25, transparent: true, opacity: 0 }));
  sc.S.add(dust);
  sc.anim.push((dt) => { t += dt; const k = Math.min(1, t / 0.9), e = 1 - (1 - k) ** 3; g.position.y = y0 + 6 * (1 - e); g.scale.setScalar(0.6 + 0.4 * e); if (k >= 1) { dust.material.opacity = Math.max(0, 0.8 - (t - 0.9) * 0.8); dust.scale.setScalar(1 + (t - 0.9)); if (t > 2) { sc.S.remove(dust); return false; } } });
}

/** يدمج أجزاء المبنى حسب الخامة لتخفيف الرسم في الخريطة */
export function mergeStatic(G) {
  G.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(G.matrixWorld).invert(), groups = new Map();
  G.traverse((o) => { if (!o.isMesh || o.material?.map) return; const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); const k = o.material.uuid; if (!groups.has(k)) groups.set(k, { m: o.material, gs: [] }); groups.get(k).gs.push(g); });
  const keep = []; G.traverse((o) => { if (o.isMesh && o.material?.map) keep.push(o); });
  const tap = G.userData.tap; G.clear(); G.userData.tap = tap;
  for (const { m, gs } of groups.values()) {
    let n = 0; gs.forEach((g) => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    gs.forEach((g) => { pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(pos, 3)); bg.setAttribute('normal', new T.BufferAttribute(nor, 3));
    const mesh = new T.Mesh(bg, m); G.add(mesh);
  }
  keep.forEach((o) => G.add(o));
  return G;
}
