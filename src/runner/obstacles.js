// ── Hazards for the 3D runner: things you run into that cost points ──
// Themed per world (jungle / park / school / city / snow / candy / beach / space).
// Real CC0 models where we have them (public/models/hazards, items, animals — see CREDITS.md),
// otherwise well-made procedural meshes. Every hazard is either
//   low  → jump over it (a yellow ⬆ chevron floats above it), or
//   tall → must change lane (red glow on the road under it).
//
//   const hz = createHazards({ THREE, BASE, theme, glow });
//   await hz.prepare()            → preloads this theme's models (never throws; falls back to procedural)
//   hz.pick(rand, { tall })       → kind id
//   hz.spawn(kindId)              → { obj, kind, tall, name, update(dt, t) }
//   hz.dispose()
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";

// kind → { name (Thai), tall, model?, fit:{ h | len }, ry, tint, anim }
const KINDS = {
  log:        { name:"ขอนไม้",        tall:false, model:"models/hazards/log_moss.glb", len:1.9, ry:Math.PI / 2 },
  logsnow:    { name:"ขอนไม้หิมะ",     tall:false, model:"models/hazards/log_snow.glb", len:1.9, ry:Math.PI / 2 },
  stump:      { name:"ตอไม้",         tall:false, model:"models/hazards/stump.glb", h:.72 },
  mud:        { name:"บ่อโคลน",        tall:false, flat:true },
  rock:       { name:"ก้อนหิน",        tall:true },
  puddle:     { name:"แอ่งน้ำ",        tall:false, flat:true },
  trashcan:   { name:"ถังขยะ",        tall:true,  model:"models/items/trash_can.glb", h:1.5 },
  bucket:     { name:"ถังน้ำ",         tall:false, model:"models/items/bucket.glb", h:.7 },
  box:        { name:"กล่อง",          tall:false, model:"models/hazards/kk_box.glb", h:.8 },
  trashbag:   { name:"ถุงขยะ",        tall:false, model:"models/hazards/kk_trash_bag.glb", h:.6, len:1.2 },
  homework:   { name:"กองการบ้าน",     tall:false },
  cone:       { name:"กรวยจราจร",      tall:false },
  barrier:    { name:"แผงกั้น",        tall:true },
  dumpster:   { name:"ถังขยะใหญ่",     tall:true,  model:"models/hazards/kk_dumpster.glb", h:1.45, len:2.0 },
  hydrant:    { name:"หัวดับเพลิง",    tall:false, model:"models/hazards/kk_hydrant.glb", h:.8 },
  snowman:    { name:"ตุ๊กตาหิมะ",      tall:true },
  ice:        { name:"ก้อนน้ำแข็ง",     tall:false },
  cake:       { name:"เค้กพัง",        tall:false },
  gum:        { name:"หมากฝรั่งหนาม",  tall:false, model:"models/hazards/spiky_ball.glb", h:.78, tint:"#f472b6" },
  jelly:      { name:"เยลลี่บูด",       tall:true },
  crab:       { name:"ปู",            tall:false, model:"models/animals/crab.glb", h:.7, anim:"Walk", skinned:true },
  sandcastle: { name:"ปราสาททราย",     tall:true },
  beachball:  { name:"ลูกบอลชายหาด",   tall:false },
  meteor:     { name:"อุกกาบาต",       tall:true },
  slime:      { name:"เมือกเอเลี่ยน",   tall:false, flat:true },
  spiky:      { name:"ลูกหนามอวกาศ",   tall:false, model:"models/hazards/spiky_ball.glb", h:.78, tint:"#a855f7", glow:true },
};
// theme → kinds (low first, then tall). Tall kinds are picked less often.
const THEME_HAZ = {
  jungle: { low:["log", "mud", "stump"], tall:["rock"] },
  park:   { low:["puddle", "bucket", "box"], tall:["trashcan"] },
  school: { low:["homework", "puddle", "box"], tall:["trashcan"] },
  city:   { low:["cone", "puddle", "hydrant", "trashbag"], tall:["barrier", "dumpster"] },
  snow:   { low:["ice", "logsnow"], tall:["snowman"] },
  candy:  { low:["cake", "gum"], tall:["jelly"] },
  beach:  { low:["crab", "beachball"], tall:["sandcastle"] },
  space:  { low:["slime", "spiky"], tall:["meteor"] },
};
export const hazardKindsFor = theme => THEME_HAZ[theme] || THEME_HAZ.park;
export const HAZARD_INFO = KINDS;

export function createHazards({ THREE, BASE = "/", theme = "park", glow, timeoutMs = 12000 }) {
  const T = THREE;
  const set = hazardKindsFor(theme);
  const owned = { geo:new Set(), mat:new Set(), tex:new Set() };
  const own = o => { o.traverse(m => { if (m.geometry) owned.geo.add(m.geometry); const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    ms.forEach(x => { owned.mat.add(x); for (const k in x) { const v = x[k]; if (v && v.isTexture) owned.tex.add(v); } }); }); return o; };
  let scope = null;   // resources created for the hazard being spawned (disposed by release())
  const keep = (kind, x) => { owned[kind].add(x); if (scope) scope.push([kind, x]); return x; };
  const trackM = m => keep("mat", m);
  const M = {}; const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M[k]) { M[k] = new T.MeshStandardMaterial({ color:c, roughness:.7, ...o }); owned.mat.add(M[k]); } return M[k]; };
  const phys = o => trackM(new T.MeshPhysicalMaterial(o));
  const geo = g => keep("geo", g);
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return keep("tex", t); };
  const proto = new Map();

  // ── shared markers ──
  const chevTex = canvasTex(128, 128, (x, w, h) => {
    x.lineCap = x.lineJoin = "round";
    for (const [y, a] of [[78, 1], [46, .75]]) { x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 26; x.beginPath(); x.moveTo(22, y + 26); x.lineTo(64, y - 8); x.lineTo(106, y + 26); x.stroke();
      x.strokeStyle = `rgba(253,224,71,${a})`; x.lineWidth = 16; x.beginPath(); x.moveTo(22, y + 24); x.lineTo(64, y - 10); x.lineTo(106, y + 24); x.stroke(); } });
  const chevMat = new T.SpriteMaterial({ map:chevTex, transparent:true, depthWrite:false, fog:false, toneMapped:false }); owned.mat.add(chevMat);
  const ringTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,.0)"); g.addColorStop(.55, "rgba(255,255,255,.55)"); g.addColorStop(.8, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const ringGeo = geo(new T.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2));
  const ringMats = [false, true].map(tall => { const m = new T.MeshBasicMaterial({ map:ringTex, color:tall ? "#ef4444" : "#f59e0b", transparent:true, opacity:.75, depthWrite:false, blending:T.AdditiveBlending, toneMapped:false }); owned.mat.add(m); return m; });
  const ringMat = tall => ringMats[tall ? 1 : 0];

  // ── model loading ──
  const loader = new GLTFLoader();
  const timed = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), timeoutMs))]);
  async function prepare() {
    const urls = [...new Set([...set.low, ...set.tall].map(k => KINDS[k].model).filter(Boolean))];
    await Promise.all(urls.map(u => timed(loader.loadAsync(BASE + u)).then(g => {
      if (!g) return; const sc = g.scene; sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      own(sc); proto.set(u, { scene:sc, anims:g.animations || [] });
    }).catch(() => {})));
    return proto.size;
  }

  function pick(rand = Math.random(), { tall = false } = {}) { const arr = tall ? set.tall : set.low; return arr[Math.floor(rand * arr.length) % arr.length]; }

  // fit a loaded model to the requested height / length, standing on y=0
  function fromModel(def) {
    const p = proto.get(def.model); if (!p) return null;
    const inst = def.skinned ? skClone(p.scene) : p.scene.clone(true);
    const holder = new T.Group(); const spin = new T.Group(); spin.rotation.y = def.ry || 0; spin.add(inst); holder.add(spin);
    holder.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(holder); const sz = new T.Vector3(); b.getSize(sz);
    let s = def.h ? def.h / Math.max(.001, sz.y) : 1;
    if (def.len) s = Math.min(def.h ? s : 1e9, def.len / Math.max(.001, Math.max(sz.x, sz.z)));
    inst.scale.multiplyScalar(s); holder.updateMatrixWorld(true);
    const b2 = new T.Box3().setFromObject(holder); const c = new T.Vector3(); b2.getCenter(c);
    inst.position.x -= c.x; inst.position.z -= c.z; inst.position.y -= b2.min.y;
    if (def.tint) inst.traverse(o => { if (o.isMesh) { const m = o.material.clone(); m.color = new T.Color(def.tint); if (def.glow) { m.emissive = new T.Color(def.tint); m.emissiveIntensity = .6; } trackM(m); o.material = m; } });
    let mixer = null;
    if (p.anims.length) { mixer = new T.AnimationMixer(inst); const clip = p.anims.find(a => a.name === def.anim) || p.anims[0]; const a = mixer.clipAction(clip); a.play(); a.time = Math.random() * clip.duration; }
    return { g:holder, mixer };
  }

  // ── procedural builders (all stand on y=0, centred, face +z) ──
  const add = (g, gm, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo(gm), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const wobbly = (rx, rz, n = 22, amp = .16) => { const s = new T.Shape(); const ph = Math.random() * 6;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const r = 1 + Math.sin(a * 3 + ph) * amp + Math.sin(a * 5 - ph) * amp * .5; const x = Math.cos(a) * rx * r, z = Math.sin(a) * rz * r; i ? s.lineTo(x, z) : s.moveTo(x, z); } return s; };
  function puddle(kind) {
    const g = new T.Group();
    const cfg = { puddle:{ c:"#5aa9e6", rim:"#3b6f99", o:.85 }, mud:{ c:"#5b3a1e", rim:"#3b2410", o:1 }, slime:{ c:"#84cc16", rim:"#3f6212", o:.92, glow:true } }[kind];
    const rim = add(g, new T.ShapeGeometry(wobbly(1.05, .85)).rotateX(-Math.PI / 2), mat(cfg.rim, { roughness:.9 }), 0, .035, 0); rim.castShadow = false;
    const top = add(g, new T.ShapeGeometry(wobbly(.9, .7)).rotateX(-Math.PI / 2), phys({ color:cfg.c, roughness:kind === "mud" ? .35 : .04, clearcoat:1, clearcoatRoughness:.05, transparent:cfg.o < 1, opacity:cfg.o,
      emissive:cfg.glow ? cfg.c : "#000000", emissiveIntensity:cfg.glow ? .7 : 0 }), 0, .05, 0); top.castShadow = false;
    // bubbles / splashes so it reads at distance
    const bub = [];
    for (let i = 0; i < (kind === "puddle" ? 0 : 5); i++) { const b = add(g, new T.SphereGeometry(.07 + Math.random() * .08, 10, 8), phys({ color:cfg.c, roughness:.1, clearcoat:1, emissive:cfg.glow ? cfg.c : "#000", emissiveIntensity:cfg.glow ? .9 : 0 }), (Math.random() - .5) * 1.1, .07, (Math.random() - .5) * .8); b.userData.ph = Math.random() * 6; bub.push(b); }
    if (kind === "puddle") for (let i = 0; i < 3; i++) { const r = add(g, new T.TorusGeometry(.18 + i * .16, .015, 6, 28).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color:"#e0f2fe", transparent:true, opacity:.6 }), (i - 1) * .25, .07, (i % 2 - .5) * .2); trackM(r.material); r.userData.ph = i * 2; bub.push(r); }
    return { g, update(dt, t) { bub.forEach(b => { if (b.geometry.type === "TorusGeometry") { const k = (t * .8 + b.userData.ph) % 1.6 / 1.6; b.scale.setScalar(.5 + k * 1.4); b.material.opacity = .6 * (1 - k); } else b.position.y = .07 + Math.abs(Math.sin(t * 2.2 + b.userData.ph)) * .06; }); } };
  }
  function cones() {
    const g = new T.Group();
    const stripe = canvasTex(64, 128, (x, w, h) => { x.fillStyle = "#f97316"; x.fillRect(0, 0, w, h); x.fillStyle = "#ffffff"; x.fillRect(0, h * .35, w, h * .18); x.fillRect(0, h * .65, w, h * .1); });
    const cm = phys({ map:stripe, roughness:.45, clearcoat:.4 });
    for (const x of [-.5, .5]) { add(g, new T.BoxGeometry(.6, .06, .6), mat("#1f2937", { roughness:.8 }), x, .03, 0); add(g, new T.ConeGeometry(.24, .72, 20, 1, true), cm, x, .42, 0); }
    return { g };
  }
  function barrier() {
    const g = new T.Group();
    const stripe = canvasTex(256, 32, (x, w, h) => { x.fillStyle = "#ffffff"; x.fillRect(0, 0, w, h); x.fillStyle = "#dc2626"; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, 0); x.fill(); } });
    const bm = phys({ map:stripe, roughness:.4, clearcoat:.5 });
    for (const y of [.75, 1.25]) add(g, new T.BoxGeometry(2.0, .3, .1), bm, 0, y, 0);
    for (const x of [-.85, .85]) { add(g, new T.BoxGeometry(.1, 1.45, .1), mat("#9ca3af", { metalness:.6, roughness:.35 }), x, .72, 0); add(g, new T.BoxGeometry(.5, .08, .5), mat("#374151"), x, .04, 0); }
    const lamp = add(g, new T.SphereGeometry(.12, 14, 10), new T.MeshStandardMaterial({ color:"#fbbf24", emissive:"#f59e0b", emissiveIntensity:3 }), -.85, 1.55, 0); trackM(lamp.material);
    return { g, update(dt, t) { lamp.material.emissiveIntensity = Math.sin(t * 8) > 0 ? 4 : .4; } };
  }
  function snowman() {
    const g = new T.Group(); const w = phys({ color:"#ffffff", roughness:.55, sheen:1, sheenColor:new T.Color("#dbeafe") });
    add(g, new T.SphereGeometry(.62, 24, 18), w, 0, .55); add(g, new T.SphereGeometry(.45, 24, 18), w, 0, 1.3); add(g, new T.SphereGeometry(.33, 24, 18), w, 0, 1.88);
    const nose = add(g, new T.ConeGeometry(.06, .35, 10), mat("#f97316"), 0, 1.88, .42); nose.rotation.x = Math.PI / 2;
    for (const x of [-.11, .11]) add(g, new T.SphereGeometry(.045, 8, 6), mat("#111827", { roughness:.2 }), x, 1.98, .29);
    for (let i = 0; i < 3; i++) add(g, new T.SphereGeometry(.05, 8, 6), mat("#111827"), 0, 1.15 + i * .17, .44 - Math.abs(i - 1) * .02);
    add(g, new T.CylinderGeometry(.36, .38, .1, 20), mat("#dc2626"), 0, 1.62);
    add(g, new T.CylinderGeometry(.24, .24, .32, 18), mat("#1f2937", { roughness:.5 }), 0, 2.28); add(g, new T.CylinderGeometry(.36, .36, .04, 18), mat("#1f2937"), 0, 2.13);
    for (const s of [-1, 1]) { const a = add(g, new T.CylinderGeometry(.025, .035, .8, 6), mat("#6b4423"), s * .7, 1.45, 0); a.rotation.z = s * -1.0; }
    return { g };
  }
  function iceBlock() {
    const g = new T.Group();
    const m = phys({ color:"#a5e3ff", roughness:.08, clearcoat:1, clearcoatRoughness:.05, transparent:true, opacity:.78, emissive:"#7dd3fc", emissiveIntensity:.25 });
    add(g, new T.BoxGeometry(1.5, .8, .9, 2, 2, 2), m, 0, .4, 0).rotation.y = .08;
    add(g, new T.BoxGeometry(.6, .5, .6), phys({ color:"#e0f2fe", roughness:.05, clearcoat:1, transparent:true, opacity:.85 }), .55, .25, .25).rotation.y = .6;
    const edges = new T.LineSegments(geo(new T.EdgesGeometry(new T.BoxGeometry(1.5, .8, .9))), new T.LineBasicMaterial({ color:"#ffffff", transparent:true, opacity:.8 })); trackM(edges.material); edges.position.y = .4; edges.rotation.y = .08; g.add(edges);
    return { g };
  }
  function brokenCake() {
    const g = new T.Group();
    add(g, new T.CylinderGeometry(.9, .9, .05, 28), mat("#e5e7eb", { roughness:.3 }), 0, .03, 0);
    const sponge = add(g, new T.CylinderGeometry(.68, .72, .5, 28, 1, false, .9, Math.PI * 1.45), mat("#a16207", { roughness:.9 }), 0, .3, 0); sponge.rotation.z = .12;
    const icing = add(g, new T.CylinderGeometry(.7, .7, .12, 28, 1, false, .9, Math.PI * 1.45), phys({ color:"#a3b18a", roughness:.5, clearcoat:.3 }), -.02, .58, 0); icing.rotation.z = .12;   // mouldy green-grey icing
    for (let i = 0; i < 7; i++) { const a = .9 + Math.random() * Math.PI * 1.45; add(g, new T.SphereGeometry(.06 + Math.random() * .05, 8, 6), mat(i % 2 ? "#4d7c0f" : "#57534e"), Math.sin(a) * .5, .62, Math.cos(a) * .5); }
    for (let i = 0; i < 6; i++) add(g, new T.DodecahedronGeometry(.07 + Math.random() * .06), mat("#92400e"), (Math.random() - .3) * 1.4, .07, (Math.random() - .2) * 1.0);
    const flies = []; for (let i = 0; i < 3; i++) { const f = add(g, new T.SphereGeometry(.05, 8, 6), mat("#111827"), 0, 1, 0); f.castShadow = false; f.userData.ph = i * 2.1; flies.push(f); }
    return { g, update(dt, t) { flies.forEach(f => { const a = t * 5 + f.userData.ph; f.position.set(Math.cos(a) * .55, .95 + Math.sin(a * 1.7) * .15, Math.sin(a) * .45); }); } };
  }
  function jelly() {
    const g = new T.Group(); const inner = new T.Group(); g.add(inner);
    const m = phys({ color:"#65a30d", roughness:.15, clearcoat:1, transparent:true, opacity:.82, emissive:"#365314", emissiveIntensity:.3 });
    add(inner, new T.BoxGeometry(1.3, 1.0, 1.0, 3, 3, 3), m, 0, .5, 0);
    add(inner, new T.BoxGeometry(1.0, .75, .8, 3, 3, 3), m, .05, 1.35, 0).rotation.y = .3;
    for (let i = 0; i < 6; i++) add(inner, new T.SphereGeometry(.06 + Math.random() * .06, 8, 6), phys({ color:"#d9f99d", transparent:true, opacity:.8, roughness:.1 }), (Math.random() - .5) * .9, .3 + Math.random() * 1.3, .3 + Math.random() * .2);
    add(g, new T.CylinderGeometry(.95, 1.0, .06, 24), mat("#3f6212", { roughness:.3 }), 0, .03, 0);
    return { g, update(dt, t) { const s = Math.sin(t * 6) * .05; inner.scale.set(1 + s, 1 - s, 1 + s); } };
  }
  function sandcastle() {
    const g = new T.Group(); const sand = mat("#e9c77b", { roughness:1 }), dark = mat("#c9a35a", { roughness:1 });
    add(g, new T.BoxGeometry(1.7, .55, 1.0), sand, 0, .28, 0);
    for (const [x, h] of [[-.62, 1.15], [.62, 1.15], [0, 1.55]]) { add(g, new T.CylinderGeometry(.27, .32, h, 14), sand, x, h / 2, .05); add(g, new T.ConeGeometry(.32, .38, 14), dark, x, h + .19, .05);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, new T.BoxGeometry(.09, .1, .09), sand, x + Math.cos(a) * .25, h + .02, .05 + Math.sin(a) * .25); } }
    add(g, new T.BoxGeometry(.32, .38, .05), mat("#7c5a2a"), 0, .2, .51);
    add(g, new T.CylinderGeometry(.015, .015, .5, 6), mat("#f8fafc"), 0, 2.35, .05);
    const flag = add(g, new T.PlaneGeometry(.32, .2), new T.MeshStandardMaterial({ color:"#ef4444", side:T.DoubleSide }), .16, 2.5, .05); trackM(flag.material);
    for (let i = 0; i < 3; i++) add(g, new T.TorusGeometry(.08, .03, 6, 12, Math.PI), mat(["#f472b6","#fde68a","#ffffff"][i]), -.7 + i * .7, .03, .58).rotation.x = -Math.PI / 2;
    return { g, update(dt, t) { flag.rotation.y = Math.sin(t * 5) * .4; } };
  }
  function beachBall() {
    const g = new T.Group(); const ball = new T.Group(); g.add(ball);
    const tex = canvasTex(256, 128, (x, w, h) => { const c = ["#ef4444", "#ffffff", "#3b82f6", "#ffffff", "#facc15", "#ffffff"]; c.forEach((k, i) => { x.fillStyle = k; x.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
    add(ball, new T.SphereGeometry(.45, 28, 20), phys({ map:tex, roughness:.25, clearcoat:1 }), 0, 0, 0);
    ball.position.y = .45;
    return { g, update(dt, t) { ball.position.y = .45 + Math.abs(Math.sin(t * 3.2)) * .22; ball.rotation.x += dt * 3; ball.rotation.z += dt * 1.3; } };
  }
  function meteor() {
    const g = new T.Group(); const rock = new T.Group(); g.add(rock);
    const gm = new T.DodecahedronGeometry(.8, 1); const p = gm.attributes.position; const col = [];
    for (let i = 0; i < p.count; i++) { const v = new T.Vector3().fromBufferAttribute(p, i); const n = Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7 - v.y) * .22; v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z);
      const hot = n < -.08; col.push(hot ? 1 : .22, hot ? .45 : .18, hot ? .1 : .25); }
    gm.setAttribute("color", new T.Float32BufferAttribute(col, 3)); gm.computeVertexNormals();
    add(rock, gm, new T.MeshStandardMaterial({ vertexColors:true, roughness:.9, emissive:"#ff6a00", emissiveIntensity:.35 }), 0, 0, 0); trackM(rock.children[0].material);
    rock.position.y = 1.05;
    add(g, new T.RingGeometry(.6, 1.05, 28).rotateX(-Math.PI / 2), mat("#1e1b4b", { roughness:1 }), 0, .03, 0);
    if (glow) { const fl = new T.Sprite(new T.SpriteMaterial({ map:glow, color:"#ff7a1a", transparent:true, opacity:.75, depthWrite:false, blending:T.AdditiveBlending, fog:false })); trackM(fl.material); fl.scale.set(2.8, 2.8, 1); fl.position.y = 1.05; g.add(fl); }
    return { g, update(dt, t) { rock.rotation.x += dt * .7; rock.rotation.y += dt * 1.1; rock.position.y = 1.05 + Math.sin(t * 2) * .08; } };
  }
  function homework() {
    const g = new T.Group();
    const paper = canvasTex(128, 160, (x, w, h) => { x.fillStyle = "#fffdf5"; x.fillRect(0, 0, w, h); x.strokeStyle = "#93c5fd"; x.lineWidth = 2; for (let y = 24; y < h; y += 14) { x.beginPath(); x.moveTo(8, y); x.lineTo(w - 8, y); x.stroke(); }
      x.strokeStyle = "#ef4444"; x.beginPath(); x.moveTo(20, 0); x.lineTo(20, h); x.stroke(); x.fillStyle = "#1f2937"; x.font = "bold 18px sans-serif"; x.fillText("ABC 123", 26, 40); x.fillStyle = "#ef4444"; x.font = "bold 44px sans-serif"; x.fillText("?!", 60, 120); });
    const pm = trackM(new T.MeshStandardMaterial({ map:paper, roughness:.9 }));
    const cols = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
    for (let i = 0; i < 4; i++) { const b = add(g, new T.BoxGeometry(1.2, .14, .85), mat(cols[i], { roughness:.6 }), (Math.random() - .5) * .15, .07 + i * .15, 0); b.rotation.y = (Math.random() - .5) * .5; }
    for (let i = 0; i < 4; i++) { const s = add(g, new T.PlaneGeometry(.55, .7).rotateX(-Math.PI / 2), pm, (Math.random() - .5) * 1.1, .66 + i * .02, (Math.random() - .5) * .5); s.rotation.y = Math.random() * 3; }
    const fly = add(g, new T.PlaneGeometry(.45, .58), new T.MeshStandardMaterial({ map:paper, side:T.DoubleSide, roughness:.9 }), 0, 1.0, 0); trackM(fly.material);
    return { g, update(dt, t) { fly.position.set(Math.sin(t * 1.3) * .4, 1.0 + Math.sin(t * 2.1) * .12, .1); fly.rotation.set(Math.sin(t * 2) * .6, t * 1.5, Math.cos(t * 1.7) * .4); } };
  }
  function procRock() { const g = new T.Group();
    const boulder = (r, x, z, sy) => { const gm = new T.DodecahedronGeometry(r, 1); const p = gm.attributes.position; const col = []; const ph = Math.random() * 6;
      for (let i = 0; i < p.count; i++) { const v = new T.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + Math.sin(v.x * 3.3 + v.y * 2.1 + ph) * Math.cos(v.z * 2.5) * .16); p.setXYZ(i, v.x, v.y, v.z);
        const k = .45 + (v.y / r) * .18 + Math.random() * .06; col.push(k * .95, k * .93, k * .88); }
      gm.setAttribute("color", new T.Float32BufferAttribute(col, 3)); gm.computeVertexNormals();
      const m = add(g, gm, trackM(new T.MeshStandardMaterial({ vertexColors:true, roughness:.95, flatShading:true })), x, r * sy * .85, z); m.scale.set(1.15, sy, 1); return m; };
    boulder(.78, -.1, 0, 1.0); boulder(.42, .62, .25, .8);
    const moss = add(g, new T.SphereGeometry(.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat("#4d7c0f", { roughness:1 }), -.15, 1.05, 0); moss.scale.set(1.2, .5, 1);
    return { g }; }
  function procLog(snowy) { const g = new T.Group(); const l = add(g, new T.CylinderGeometry(.27, .3, 1.9, 14), mat("#7c4a1e", { roughness:.95 }), 0, .3, 0); l.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) { const e = add(g, new T.CircleGeometry(.27, 14), mat("#d6a46a"), s * .951, .3, 0); e.rotation.y = s * Math.PI / 2; }
    if (snowy) add(g, new T.BoxGeometry(1.7, .08, .3), mat("#ffffff"), 0, .6, 0); return { g }; }
  function procBox(c = "#b45309") { const g = new T.Group(); add(g, new T.BoxGeometry(.9, .8, .9), mat(c, { roughness:.85 }), 0, .4, 0); add(g, new T.BoxGeometry(.92, .12, .92), mat("#78350f"), 0, .45, 0); return { g }; }
  function procCan(h = 1.5) { const g = new T.Group(); add(g, new T.CylinderGeometry(.42, .36, h, 18), mat("#64748b", { metalness:.6, roughness:.35 }), 0, h / 2, 0); add(g, new T.CylinderGeometry(.46, .46, .1, 18), mat("#475569", { metalness:.6 }), 0, h + .05, 0); return { g }; }
  function procCrab() { const g = new T.Group(); add(g, new T.SphereGeometry(.4, 18, 12), mat("#ef4444", { roughness:.4 }), 0, .32, 0).scale.y = .6;
    for (const s of [-1, 1]) { add(g, new T.SphereGeometry(.14, 10, 8), mat("#dc2626"), s * .48, .38, .22); add(g, new T.SphereGeometry(.06, 8, 6), mat("#111827"), s * .12, .55, .3); }
    return { g, update(dt, t) { g.children[0].position.x = Math.sin(t * 6) * .03; } }; }
  function spikyBall(c) { const g = new T.Group(); add(g, new T.IcosahedronGeometry(.3, 1), mat(c, { roughness:.4 }), 0, .4, 0); const sp = new T.ConeGeometry(.08, .28, 8);
    const ico = new T.IcosahedronGeometry(.3, 0).attributes.position; for (let i = 0; i < ico.count; i += 3) { const v = new T.Vector3().fromBufferAttribute(ico, i).normalize(); const m = add(g, sp, mat(c), v.x * .38, .4 + v.y * .38, v.z * .38); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v); } return { g }; }

  const BUILD = {
    mud:() => puddle("mud"), puddle:() => puddle("puddle"), slime:() => puddle("slime"), cone:cones, barrier, snowman, ice:iceBlock, cake:brokenCake, jelly,
    sandcastle, beachball:beachBall, meteor, homework,
    // fallbacks for model kinds
    log:() => procLog(false), logsnow:() => procLog(true), stump:() => procLog(false), rock:procRock, trashcan:() => procCan(1.5), bucket:() => procCan(.7), box:() => procBox(), trashbag:() => procBox("#1f2937"),
    dumpster:() => procBox("#15803d"), hydrant:() => procCan(.8), gum:() => spikyBall("#f472b6"), spiky:() => spikyBall("#a855f7"), crab:procCrab,
  };

  function spawn(kind) {
    const def = KINDS[kind] || KINDS.puddle;
    scope = [];
    let built = def.model ? fromModel(def) : null; let mixer = built?.mixer || null;
    if (!built) built = BUILD[kind] ? BUILD[kind]() : puddle("puddle");
    const obj = new T.Group(); obj.add(built.g);
    if (kind === "crab") built.g.rotation.y = Math.PI / 2;   // crabs scuttle sideways
    const ring = new T.Mesh(ringGeo, ringMat(def.tall)); ring.position.y = .045; obj.add(ring);
    let chev = null;
    if (!def.tall) { chev = new T.Sprite(chevMat); chev.scale.set(.85, .85, 1); chev.position.y = def.flat ? 1.0 : 1.65; obj.add(chev); }
    const res = scope; scope = null;
    const ph = Math.random() * 6;
    const crabDir = Math.random() < .5 ? -1 : 1;
    return { obj, kind, tall:def.tall, flat:!!def.flat, name:def.name, ph, res, mixer,
      update(dt, t) {
        built.update?.(dt, t); if (mixer) mixer.update(dt);
        if (chev) chev.position.y = (def.flat ? 1.0 : 1.65) + Math.sin(t * 4 + ph) * .1;
        ring.material.opacity = .55 + Math.sin(t * 5 + ph) * .2;
        if (kind === "crab") built.g.position.x = Math.sin(t * 1.4 + ph) * .35 * crabDir;
      } };
  }

  // free what this one hazard created (shared materials/prototypes stay until dispose())
  function release(h) { (h?.res || []).forEach(([k, x]) => { owned[k].delete(x); try { x.dispose(); } catch { /* ignore */ } }); if (h?.mixer) { h.mixer.stopAllAction(); h.mixer.uncacheRoot(h.mixer.getRoot()); } if (h) h.res = []; }
  function dispose() { owned.geo.forEach(g => g.dispose()); owned.mat.forEach(m => m.dispose()); owned.tex.forEach(t => t.dispose()); proto.clear(); }
  return { prepare, pick, spawn, release, dispose, kinds:set };
}
