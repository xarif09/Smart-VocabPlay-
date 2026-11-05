// ── Roadside scenery kit for the 3D runner ──
// Real CC0 scanned models (Poly Haven, public/3d/models) + procedural trees
// (bark PBR tubes + alpha-tested leaf cards, merged → 2 draw calls per tree).
//
//   const kit = await loadPropKit({ THREE, theme, BASE, renderer, onProgress });
//   kit.kinds            → weighted list of kinds to pick from for this theme
//   kit.spawn(kind, rnd) → NEW Object3D (origin at ground contact, y=0 = base)
//   kit.dispose()        → frees every geometry / material / texture of the kit
//
// spawn() never throws: an unknown / failed kind returns the theme fallback
// (tree / pine / palm / lollipop / crystal). The caller may overwrite the
// returned object's position and rotation.y — all random variation lives on
// an inner group. Objects with userData.faceRoad want rotation.y = x > 0 ? Math.PI : 0
// (their front faces +x by default).

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ───────── per-theme kinds (repetition = weight) ─────────
const THEME_KINDS = {
  jungle: ["tree", "tree", "tree", "tree", "fern_02", "fern_02", "fern_02", "shrub_03", "rock_07", "rock_09"],
  park:   ["tree", "tree", "tree", "painted_wooden_bench", "potted_plant_02", "shrub_03", "rock_09", "flowers", "flowers"],
  school: ["tree", "tree", "tree", "painted_wooden_bench", "potted_plant_02", "shrub_03", "flowers"],
  snow:   ["pine", "pine", "pine", "pine", "pine", "rock_07", "rock_09", "shrub_02"],
  city:   ["street_lamp_01", "street_lamp_01", "tree", "tree", "painted_wooden_bench", "potted_plant_02"],
  beach:  ["palm", "palm", "palm", "palm", "palm", "quiver_tree_02", "rock_07", "rock_09", "shrub_03"],
  candy:  ["food_apple_01", "food_kiwi_01", "food_pomegranate_01", "lemon", "croissant", "lollipop", "lollipop", "lollipop"],
  space:  ["moon_rock_01", "moon_rock_01", "moon_rock_01", "crystal", "crystal", "crystal"],
};
const FALLBACK = { jungle:"tree", park:"tree", school:"tree", snow:"pine", city:"tree", beach:"palm", candy:"lollipop", space:"crystal" };
const PROCEDURAL = ["tree", "pine", "palm", "lollipop", "crystal", "flowers"];

// Scanned models. Sizing: h = target height range (m), size = target largest
// dimension, scale = multiplier of the real-world size. sink = fraction of the
// height pushed below ground. every = min spawns between two of this kind (tri budget).
const MODELS = {
  rock_07:              { h:[.6, 1.5], sink:.12, wide:1.25 },
  rock_09:              { size:[1.1, 2.2], sink:.1 },
  shrub_02:             { split:true, scale:[.85, 1.2] },
  shrub_03:             { split:true, cluster:[4, 7], spread:.55, scale:[2.2, 3.1] },
  fern_02:              { split:true, cluster:[2, 4], spread:.7,  scale:[1.8, 2.6] },
  street_lamp_01:       { scale:[1, 1.08], every:4, lamp:true },
  painted_wooden_bench: { scale:[1.05, 1.15], faceRoad:true, rotY:Math.PI / 2 },
  potted_plant_02:      { scale:[1.3, 1.6], dirt:true },
  quiver_tree_02:       { h:[3.2, 4.4], every:10, alt:"palm" },
  food_apple_01:        { size:[1.6, 2.6] },
  food_kiwi_01:         { size:[1.5, 2.4] },
  food_pomegranate_01:  { size:[1.8, 2.8] },
  lemon:                { size:[1.6, 2.5], rotZ:Math.PI / 2 },
  croissant:            { size:[2.4, 3.3] },
  moon_rock_01:         { lod:["_LOD2", "_LOD1"], size:[.8, 5.5], sizePow:2.2, sink:.08 },
};

// ───────── small helpers ─────────
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = (r, k) => { const x = Math.sin((r * 9301.17 + k * 497.31 + 1.3) * 12.9898) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

function makeCanvas(w, h) {
  if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}

export async function loadPropKit({ THREE, theme, BASE = "/", renderer, onProgress, timeoutMs = 20000 } = {}) {
  const T = THREE;
  if (!THEME_KINDS[theme]) theme = "park";
  const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const owned = { geo:new Set(), mat:new Set(), tex:new Set() };
  const own = obj => { obj.traverse(o => { if (o.geometry) owned.geo.add(o.geometry);
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { owned.mat.add(m); for (const k in m) { const v = m[k]; if (v && v.isTexture) owned.tex.add(v); } }); }); return obj; };
  let aniso = 1, a2c = false;
  try { aniso = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() || 1); a2c = !!renderer?.getContext?.()?.getContextAttributes?.()?.antialias; } catch { /* ignore */ }
  const canvasTex = (c, srgb = true) => { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso; owned.tex.add(t); return t; };

  const kindsWanted = THEME_KINDS[theme];
  const modelIds = [...new Set(kindsWanted.filter(k => MODELS[k]))];
  if (theme === "space" && !modelIds.includes("moon_rock_01")) modelIds.push("moon_rock_01");
  const needProc = new Set(kindsWanted.filter(k => PROCEDURAL.includes(k)));
  needProc.add(FALLBACK[theme]);
  for (const id of modelIds) if (MODELS[id].alt) needProc.add(MODELS[id].alt);
  const needBark = needProc.has("tree") || needProc.has("pine") || needProc.has("palm");

  let done = 0; const total = modelIds.length + (needBark ? 1 : 0) + 1;
  const tick = () => { done++; try { onProgress?.(Math.min(1, done / total)); } catch { /* ignore */ } };
  try { onProgress?.(0); } catch { /* ignore */ }

  // ───────── loading ─────────
  const loader = new GLTFLoader();
  const timed = p => Promise.race([p, new Promise(res => setTimeout(() => res(null), timeoutMs))]); // a stalled request never blocks the game
  const loadModel = id => timed(loader.loadAsync(`${BASE}3d/models/${id}/${id}.gltf`).then(g => g, () => null)).finally(tick);
  const texLoader = new T.TextureLoader();
  const loadTex = (name, srgb) => timed(texLoader.loadAsync(`${BASE}3d/tex/${name}.jpg`).then(t => {
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = T.SRGBColorSpace; owned.tex.add(t); return t; }, () => null));
  const barkP = needBark ? Promise.all([loadTex("bark_brown_02_diff", true), loadTex("bark_brown_02_nor"), loadTex("bark_brown_02_rough")]).finally(tick) : Promise.resolve([]);
  let gltfs = [], bark = [];
  try { [gltfs, bark] = await Promise.all([Promise.all(modelIds.map(loadModel)), barkP]); } catch { /* never throw */ }

  // ───────── shader patches ─────────
  // Foliage cards: keep the authored (canopy-spherical) normal on both faces
  // instead of flipping it for back faces → soft, volumetric crown shading.
  const foliagePatch = m => {
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>",
      T.ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", "")); };
    m.customProgramCacheKey = () => "foliage";
    return m;
  };
  // Snow on upward-facing surfaces (world normal.y), for snow-theme rocks/shrubs.
  const snowify = (src, amount, tint) => {
    const m = src.clone(); if (tint && m.color) m.color.multiply(new T.Color(tint));
    const lo = (1 - amount).toFixed(3), hi = Math.min(1, 1.25 - amount).toFixed(3);
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vSnowUp;")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvSnowUp = normalize(mat3(modelMatrix) * objectNormal).y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vSnowUp;")
        .replace("#include <color_fragment>", `#include <color_fragment>\nfloat snowK = smoothstep(${lo}, ${hi}, vSnowUp);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .96, 1.), snowK);`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .55, snowK);");
    };
    m.customProgramCacheKey = () => "snow" + lo;
    return m;
  };

  // ───────── geometry helpers ─────────
  // Tapered tube along a curve; rFn(t, dist) = radius. Bark UV: u around, v along (metres).
  function tube(curve, rFn, segs, radial, around = 1, along = .8) {
    const g = new T.TubeGeometry(curve, segs, 1, radial, false);
    const pos = g.attributes.position, uv = g.attributes.uv, P = V3(), Q = V3(); const len = curve.getLength();
    for (let i = 0; i <= segs; i++) { const t = i / segs; curve.getPointAt(t, P); const r = rFn(t, t * len);
      for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; Q.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P);
        pos.setXYZ(k, Q.x, Q.y, Q.z); uv.setXY(k, j / radial * around, t * len * along); } }
    return g;
  }
  const taper = (r0, r1, flare = 0) => t => (r0 + (r1 - r0) * t) * (1 + flare * Math.pow(Math.max(0, 1 - t * 7), 2));
  // Generic vertex buffer for cards / strips.
  class Buf {
    constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
    v(p, n, u, v, c) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, v); this.c.push(c.r, c.g, c.b); return this.p.length / 3 - 1; }
    quad(c, U, V, uvr, col, nf) { // nf(pos) → normal
      const ids = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = c.clone().addScaledVector(U, a).addScaledVector(V, b);
        return this.v(p, nf(p), a < 0 ? uvr[0] : uvr[2], b < 0 ? uvr[1] : uvr[3], col); });
      this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
    geo() { const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2)); g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
  }
  const randDir = R => { let v; do v = V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); while (v.lengthSq() > 1 || v.lengthSq() < .01); return v; };
  const randInSphere = R => { let v; do v = V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); while (v.lengthSq() > 1); return v; };
  const perp = n => { const a = Math.abs(n.y) < .9 ? UP : V3(1, 0, 0); return V3().crossVectors(a, n).normalize(); };
  const meshOf = (geo, mat, cast = true, recv = true) => { const m = new T.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; };

  // ───────── materials ─────────
  const [barkMap, barkNor, barkRough] = bark;
  const barkMat = needBark ? new T.MeshStandardMaterial({ color:barkMap ? "#ffffff" : "#6b4a2f", map:barkMap || null, normalMap:barkNor || null, roughnessMap:barkRough || null, roughness:1, metalness:0 }) : null;

  // ───────── canvas textures ─────────
  function leafAtlas() { // 2×2 tiles of leaf clusters
    const S = 256, c = makeCanvas(S * 2, S * 2), x = c.getContext("2d"); const R = mulberry(7);
    for (let k = 0; k < 4; k++) { const ox = (k % 2) * S, oy = Math.floor(k / 2) * S;
      x.save(); x.beginPath(); x.rect(ox + 2, oy + 2, S - 4, S - 4); x.clip(); x.translate(ox + S / 2, oy + S / 2);
      x.strokeStyle = "#5a3d22"; x.lineCap = "round";
      for (let i = 0; i < 6; i++) { const a = R() * 6.283; x.lineWidth = 2.5 - i * .25; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(Math.cos(a + .4) * S * .15, Math.sin(a + .4) * S * .15, Math.cos(a) * S * .3, Math.sin(a) * S * .3); x.stroke(); }
      const leaves = []; for (let i = 0; i < 34; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * S * .25; leaves.push({ a, d, L:S * (.16 + R() * .08), w:.34 + R() * .14, rot:a + Math.PI / 2 + (R() - .5) * 1.1,
        h:82 + R() * 40, s:42 + R() * 22, l:28 + R() * 26 + (d / (S * .3)) * 6 }); }
      leaves.sort((p, q) => p.l - q.l);
      for (const f of leaves) { x.save(); x.translate(Math.cos(f.a) * f.d, Math.sin(f.a) * f.d); x.rotate(f.rot); const L = f.L, W = L * f.w;
        x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(W, -L * .45, 0, -L); x.quadraticCurveTo(-W, -L * .45, 0, 0); x.closePath();
        const g = x.createLinearGradient(-W, 0, W, 0); g.addColorStop(0, `hsl(${f.h},${f.s}%,${f.l - 6}%)`); g.addColorStop(.5, `hsl(${f.h},${f.s}%,${f.l + 4}%)`); g.addColorStop(1, `hsl(${f.h + 4},${f.s}%,${f.l - 10}%)`);
        x.fillStyle = g; x.fill(); x.strokeStyle = `hsla(${f.h - 10},40%,${f.l + 22}%,.45)`; x.lineWidth = 1; x.beginPath(); x.moveTo(0, -L * .05); x.lineTo(0, -L * .9); x.stroke(); x.restore(); }
      x.restore(); }
    return canvasTex(c);
  }
  function needleAtlas(snow) { // 2 frond tiles, base at canvas bottom (v=0), tip at top
    const W = 256, H = 512, c = makeCanvas(W * 2, H), x = c.getContext("2d"); const R = mulberry(snow ? 31 : 17); x.lineCap = "round";
    for (let k = 0; k < 2; k++) { const ox = k * W; x.save(); x.beginPath(); x.rect(ox + 2, 2, W - 4, H - 4); x.clip();
      const cx = ox + W / 2, stem = t => [cx + Math.sin(t * 3 + k) * 6, H * .97 - t * H * .92];
      const needles = (sx, sy, dx, dy, len, n, spread, lw) => { for (let i = 0; i < n; i++) { const t = i / n; const px = sx + dx * t * len, py = sy + dy * t * len;
          for (const side of [-1, 1]) { const ang = Math.atan2(dy, dx) + side * (spread + (R() - .5) * .3); const nl = (10 + R() * 9) * (1 - t * .5) * lw;
            x.strokeStyle = `hsl(${128 + R() * 25},${34 + R() * 20}%,${13 + R() * 17}%)`; x.lineWidth = 1.6 + R() * 1.2;
            x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * nl, py + Math.sin(ang) * nl); x.stroke(); } } };
      // branchlets
      for (let b = 0; b < 11; b++) { const t = .06 + b / 11 * .86; const [sx, sy] = stem(t);
        for (const side of [-1, 1]) { const a = -Math.PI / 2 + side * (.75 + R() * .25); const len = W * .43 * (1 - t * .55) * (.8 + R() * .25);
          const dx = Math.cos(a), dy = Math.sin(a); x.strokeStyle = "#4a3a22"; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + dx * len, sy + dy * len); x.stroke();
          needles(sx, sy, dx, dy, len, 14, .75, 1.1);
          if (snow) { x.fillStyle = "rgba(250,252,255,.96)"; for (let s = 0; s < 5; s++) { const tt = .15 + s * .17; x.beginPath(); x.ellipse(sx + dx * len * tt, sy + dy * len * tt - 3, 7 + R() * 6, 4 + R() * 3, a, 0, 6.283); x.fill(); } } } }
      // main stem
      x.strokeStyle = "#4a3a22"; x.lineWidth = 4; x.beginPath(); for (let i = 0; i <= 20; i++) { const [px, py] = stem(i / 20); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
      for (let i = 0; i < 40; i++) { const t = i / 40; const [sx, sy] = stem(t); needles(sx, sy, 0, -1, 1, 1, .9, 1.25 * (1 - t * .4)); }
      if (snow) { x.fillStyle = "rgba(252,253,255,.97)"; for (let i = 0; i < 16; i++) { const [sx, sy] = stem(.04 + i / 17 * .9); x.beginPath(); x.ellipse(sx, sy, 10 + R() * 8, 6 + R() * 4, 0, 0, 6.283); x.fill(); } }
      x.restore(); }
    return canvasTex(c);
  }
  function frondTex() { // palm frond: rachis vertical, leaflets toward the tip (top)
    const W = 128, H = 512, c = makeCanvas(W, H), x = c.getContext("2d"); const R = mulberry(5); const cx = W / 2; x.lineCap = "round";
    for (let y = H * .96; y > H * .03; y -= 6 + R() * 3) { const t = 1 - y / H; for (const side of [-1, 1]) { if (R() < .07) continue;
        const ex = cx + side * (W / 2 - 3), ey = y - 34 - t * 20; x.strokeStyle = `hsl(${88 + R() * 22},${42 + R() * 18}%,${28 + R() * 18}%)`; x.lineWidth = 3.2 + R() * 1.6;
        x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + side * W * .22, y - 8, ex, ey); x.stroke();
        if (R() < .25) { x.strokeStyle = "rgba(150,120,60,.8)"; x.lineWidth = 2; x.beginPath(); x.moveTo(ex - side * 6, ey + 3); x.lineTo(ex, ey); x.stroke(); } } }
    x.strokeStyle = "#c9c07a"; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, H); x.lineTo(cx, 0); x.stroke();
    return canvasTex(c);
  }
  function palmTrunkTex() {
    const S = 256, c = makeCanvas(S, S), x = c.getContext("2d"); const R = mulberry(3);
    x.fillStyle = "#8b7558"; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${60 + R() * 60},${45 + R() * 40},${30 + R() * 30},${.15 + R() * .2})`; x.fillRect(R() * S, R() * S, 1 + R() * 2, 6 + R() * 18); }
    for (let r = 0; r < 3; r++) { const y = r * S / 3; const g = x.createLinearGradient(0, y, 0, y + S / 3); g.addColorStop(0, "rgba(60,44,28,.9)"); g.addColorStop(.12, "rgba(170,148,112,.55)"); g.addColorStop(.6, "rgba(120,100,75,.1)"); g.addColorStop(1, "rgba(60,44,28,.5)");
      x.fillStyle = g; x.fillRect(0, y, S, S / 3);
      for (let k = 0; k < 6; k++) { const px = k * S / 6 + (r % 2) * S / 12; x.fillStyle = "rgba(70,52,34,.55)"; x.beginPath(); x.moveTo(px, y + 4); x.lineTo(px + S / 12, y + 14); x.lineTo(px + S / 6, y + 4); x.fill(); } }
    const t = canvasTex(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function flowerAtlas() { // 2×2: daisy, poppy, buttercup, violet
    const S = 128, c = makeCanvas(S * 2, S * 2), x = c.getContext("2d");
    const kinds = [["#ffffff", "#facc15", 12, .42], ["#ef4444", "#1f2937", 5, .55], ["#fde047", "#f59e0b", 5, .5], ["#a78bfa", "#fef3c7", 6, .5]];
    kinds.forEach(([pc, cc, n, w], k) => { const ox = (k % 2) * S + S / 2, oy = Math.floor(k / 2) * S + S / 2; x.save(); x.translate(ox, oy);
      for (let i = 0; i < n; i++) { x.save(); x.rotate(i / n * 6.283); x.beginPath(); x.ellipse(0, -S * .24, S * .22 * w, S * .23, 0, 0, 6.283);
        const g = x.createLinearGradient(0, 0, 0, -S * .46); g.addColorStop(0, pc); g.addColorStop(1, pc); x.fillStyle = g; x.globalAlpha = .97; x.fill();
        x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 1.5; x.stroke(); x.restore(); }
      x.globalAlpha = 1; x.fillStyle = cc; x.beginPath(); x.arc(0, 0, S * .1, 0, 6.283); x.fill(); x.restore(); });
    return canvasTex(c);
  }
  function spiralTex(cols) {
    const S = 256, c = makeCanvas(S, S), x = c.getContext("2d"); const img = x.createImageData(S, S); const rgb = cols.map(h => new T.Color(h));
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const dx = i - S / 2 + .5, dy = j - S / 2 + .5, r = Math.sqrt(dx * dx + dy * dy) / (S / 2);
      const band = Math.floor(((Math.atan2(dy, dx) / 6.283 + r * 3.2) * rgb.length * 2 % (rgb.length * 2) + rgb.length * 2)) % (rgb.length * 2);
      const col = band % 2 ? new T.Color("#ffffff") : rgb[(band >> 1) % rgb.length]; const shade = r > .97 ? .8 : 1; const o = (j * S + i) * 4;
      img.data[o] = col.r * 255 * shade; img.data[o + 1] = col.g * 255 * shade; img.data[o + 2] = col.b * 255 * shade; img.data[o + 3] = 255; }
    x.putImageData(img, 0, 0); return canvasTex(c);
  }

  // ───────── procedural: broadleaf tree ─────────
  const TREE_LOOK = {
    jungle: { h:1.15, spread:1.15, tint:[.6, .85, .45] },
    park:   { h:1,    spread:1,    tint:[.85, 1, .6] },
    school: { h:1,    spread:1,    tint:[.92, 1, .58] },
    city:   { h:.85,  spread:.78,  tint:[.86, 1, .7] },
  }[theme] || { h:1, spread:1, tint:[.92, 1.02, .72] };
  let leafMat = null;
  function buildTree(seed) {
    const R = mulberry(seed), o = TREE_LOOK; const bark = [], clusters = [];
    const H = (2.7 + R() * 1.3) * o.h, lx = (R() - .5) * .7, lz = (R() - .5) * .7;
    const trunk = new T.CatmullRomCurve3([V3(0, -.25, 0), V3(lx * .2, H * .3, lz * .2), V3(lx * .6 + (R() - .5) * .25, H * .66, lz * .6 + (R() - .5) * .25), V3(lx, H, lz)]);
    const r0 = (.2 + R() * .08) * o.h; const trunkR = taper(r0, r0 * .32, .65);
    bark.push(tube(trunk, trunkR, 14, 10, 2, .7));
    const nb = 5 + Math.floor(R() * 3), a0 = R() * 6.283;
    for (let b = 0; b < nb; b++) {
      const t0 = Math.min(.97, .5 + .45 * b / (nb - 1) + (R() - .5) * .05); const base = trunk.getPointAt(t0);
      const ang = a0 + b * 2.39996 + (R() - .5) * .5, out = V3(Math.cos(ang), 0, Math.sin(ang));
      const len = (1.5 + R() * 1.1) * (1.15 - .55 * (t0 - .5)) * o.spread * o.h, rise = .45 + R() * .35 + (t0 - .5) * .7;
      const pt = (f, up) => base.clone().addScaledVector(out, len * f).addScaledVector(UP, len * rise * up);
      const end = pt(1, .85).add(randInSphere(R).multiplyScalar(.25));
      const c = new T.CatmullRomCurve3([base.clone(), pt(.3, .22), pt(.65, .6), end]);
      const rb = trunkR(t0) * (.5 + R() * .1);
      bark.push(tube(c, taper(rb, .02), 8, 6, 1, .9));
      clusters.push({ p:c.getPointAt(1), r:.9 + R() * .35 }, { p:c.getPointAt(.62), r:.7 + R() * .25 });
      for (let s = 0; s < 2; s++) {
        const ts = .4 + R() * .35, sb = c.getPointAt(ts), tg = c.getTangentAt(ts);
        const dir = tg.clone().applyAxisAngle(UP, (s ? 1 : -1) * (.7 + R() * .5)).add(V3(0, .25, 0)).normalize(); const sl = len * (.35 + R() * .2);
        const se = sb.clone().addScaledVector(dir, sl).add(V3(0, sl * .2, 0));
        bark.push(tube(new T.CatmullRomCurve3([sb.clone(), sb.clone().addScaledVector(dir, sl * .5).add(V3(0, sl * .08, 0)), se]), taper(rb * .45, .015), 5, 5, 1, 1));
        clusters.push({ p:se, r:.65 + R() * .25 });
      }
    }
    clusters.push({ p:trunk.getPointAt(1).add(V3(0, .35, 0)), r:1.15 * o.h });
    // canopy frame
    const C = V3(); clusters.forEach(c => C.add(c.p)); C.divideScalar(clusters.length);
    let Rc = .1, yMin = 1e9, yMax = -1e9; clusters.forEach(c => { Rc = Math.max(Rc, c.p.distanceTo(C) + c.r); yMin = Math.min(yMin, c.p.y - c.r); yMax = Math.max(yMax, c.p.y + c.r); });
    const tint = new T.Color(...o.tint); const buf = new Buf(); const tmp = V3();
    for (const cl of clusters) { const n = Math.round(cl.r * cl.r * 22) + 6;
      for (let i = 0; i < n; i++) {
        const pos = cl.p.clone().addScaledVector(randInSphere(R), cl.r * .65);
        const nrm = pos.clone().sub(cl.p).add(randDir(R).multiplyScalar(.7)).add(V3(0, .3, 0)).normalize();
        const U = perp(nrm).applyAxisAngle(nrm, R() * 6.283), V = V3().crossVectors(nrm, U); const half = cl.r * (.58 + R() * .22);
        U.multiplyScalar(half); V.multiplyScalar(half);
        const depth = clamp01(pos.distanceTo(C) / Rc), hgt = clamp01((pos.y - yMin) / (yMax - yMin));
        const col = tint.clone().offsetHSL((R() - .5) * .04, (R() - .5) * .1, 0).multiplyScalar(.42 + .4 * depth + .2 * hgt + (R() - .5) * .2);
        const k = Math.floor(R() * 4), tx = (k % 2) * .5, ty = Math.floor(k / 2) * .5;
        buf.quad(pos, U, V, [tx + .004, ty + .004, tx + .496, ty + .496], col, p => tmp.copy(p).sub(C).multiply(V3(1, 1.25, 1)).normalize().multiplyScalar(.75).addScaledVector(nrm, .25).addScaledVector(UP, .25).normalize().clone());
      }
    }
    const g = new T.Group();
    g.add(meshOf(mergeGeometries(bark), barkMat));
    g.add(meshOf(buf.geo(), leafMat, true, false));
    bark.forEach(b => b.dispose());
    return own(g);
  }

  // ───────── procedural: pine (snow-dusted in the snow theme) ─────────
  let needleMat = null;
  function buildPine(seed) {
    const R = mulberry(seed), snow = theme === "snow"; const bark = []; const buf = new Buf(); const tmp = V3();
    const H = 4.6 + R() * 2.4, r0 = .19 + R() * .05;
    const trunk = new T.CatmullRomCurve3([V3(0, -.25, 0), V3(.05, H * .4, 0), V3(-.03, H * .75, .04), V3(0, H, 0)]);
    bark.push(tube(trunk, taper(r0, .02, .5), 12, 8, 2, .7));
    const tint = snow ? new T.Color(.82, .97, .92) : new T.Color(.85, 1, .85);
    const y0 = .6 + R() * .3, layers = 17 + Math.floor(R() * 5);
    const card = (a, b, width, roll, bright, radial) => { // card from a (base) to b (tip)
      const c = a.clone().add(b).multiplyScalar(.5), V = b.clone().sub(a).multiplyScalar(.52), vd = V.clone().normalize();
      const U = V3().crossVectors(vd, UP); if (U.lengthSq() < 1e-4) U.set(1, 0, 0); U.normalize().applyAxisAngle(vd, roll).multiplyScalar(width / 2);
      const k = Math.floor(R() * 2) * .5; const col = tint.clone().offsetHSL((R() - .5) * .03, 0, 0).multiplyScalar(bright);
      const out = radial.clone().setY(0).normalize();
      buf.quad(c, U, V, [k + .004, .004, k + .496, .996], col, () => tmp.copy(out).multiplyScalar(.7).addScaledVector(UP, .65).normalize().clone());
    };
    for (let k = 0; k < layers; k++) {
      const f = k / (layers - 1), y = y0 + (H * .97 - y0) * Math.pow(f, .92), bl = (2.5 * (1 - f) + .4) * (.85 + R() * .3);
      const nb = 8 + Math.floor(R() * 3) - (f > .8 ? 3 : 0), rot0 = R() * 6.283;
      for (let b = 0; b < nb; b++) {
        const a = rot0 + b * 6.283 / nb + (R() - .5) * .4, out = V3(Math.cos(a), 0, Math.sin(a)), droop = -.12 - .25 * (1 - f);
        const s = V3(0, y, 0).addScaledVector(out, .05), m = V3(0, y + droop * bl * .5, 0).addScaledVector(out, bl * .5), e = V3(0, y + droop * bl * .7 + .1 * bl, 0).addScaledVector(out, bl);
        if (bl > 1.1 && b % 2 === 0) bark.push(tube(new T.CatmullRomCurve3([s, m, e]), taper(.03 + .05 * (1 - f), .01), 3, 4, 1, 1));
        const bright = .62 + .25 * f + (R() - .5) * .14;
        card(s, e, .6 + bl * .35, (R() - .5) * .3, bright + .12, out);
        card(s.clone().addScaledVector(out, bl * .1), e, .55 + bl * .28, (R() < .5 ? 1 : -1) * (1 + R() * .3), bright, out);
        if (bl > .7) for (let j = 0; j < 3; j++) { const t = .3 + R() * .45, p = s.clone().lerp(e, t).add(V3(0, (m.y - (s.y + e.y) / 2) * .8, 0));
          const d = out.clone().applyAxisAngle(UP, (j % 2 ? 1 : -1) * (.5 + R() * .4)); card(p, p.clone().addScaledVector(d, bl * .45).add(V3(0, .08, 0)), .42, (R() - .5) * .4, bright + .05, out); }
      }
    }
    for (let j = 0; j < 3; j++) { const a = j * Math.PI / 3; const U = V3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(.28), c = V3(0, H + .25, 0);
      buf.quad(c, U, V3(0, .55, 0), [.004, .004, .496, .996], tint.clone().multiplyScalar(.95), () => UP.clone()); }
    const g = new T.Group();
    g.add(meshOf(mergeGeometries(bark), barkMat));
    g.add(meshOf(buf.geo(), needleMat, true, false));
    bark.forEach(b => b.dispose());
    return own(g);
  }

  // ───────── procedural: palm ─────────
  let palmTrunkMat = null, frondMat = null, nutMat = null, nutGeo = null;
  function buildPalm(seed) {
    const R = mulberry(seed); const buf = new Buf();
    const H = 4.2 + R() * 1.8, bend = .9 + R() * 1.3;
    const curve = new T.CatmullRomCurve3([V3(0, -.25, 0), V3(bend * .05, H * .3, 0), V3(bend * .3, H * .62, 0), V3(bend * .75, H * .88, 0), V3(bend, H, 0)]);
    const trunkGeo = tube(curve, (t, d) => (.25 - .09 * t) * (1 + .8 * Math.pow(Math.max(0, 1 - t * 9), 2)) * (1 + .055 * Math.pow(Math.abs(Math.sin(d * Math.PI / .3)), 3)), 56, 10, 2, 1 / .9);
    const top = curve.getPointAt(1);
    const n = 12 + Math.floor(R() * 4); const green = new T.Color(.58, .82, .42), dry = new T.Color(.95, .7, .4);
    const fr = new Buf(); const SEG = 10, AC = [-1, -.5, 0, .5, 1];
    for (let i = 0; i < n; i++) {
      const old = i >= n - 2, az = i * 6.283 / n + (R() - .5) * .3, F = V3(Math.cos(az), 0, Math.sin(az)), S = V3(-Math.sin(az), 0, Math.cos(az));
      const e = old ? -.7 - R() * .3 : .15 + R() * .75, L = (old ? 2 : 2.9 + R() * .8), Wd = 1.15 + R() * .3, g = old ? .1 : .2 + R() * .1;
      const col = (old ? dry : green).clone().multiplyScalar(.8 + R() * .3); const base = fr.p.length / 3;
      for (let sI = 0; sI <= SEG; sI++) { const u = sI / SEG, d = L * u; const fx = d * Math.cos(e), fy = d * Math.sin(e) - g * d * d;
        const w = u < .1 ? .03 : Wd * .5 * Math.pow(Math.sin(Math.PI * Math.min(1, (u - .1) / .9 * .95 + .05)), .6) + .03;
        for (const a of AC) { const p = top.clone().addScaledVector(F, fx).addScaledVector(UP, fy - Math.abs(a) * w * .38).addScaledVector(S, a * w);
          fr.v(p, UP, a * .5 + .5, u, col.clone().multiplyScalar(.85 + u * .25)); } }
      for (let sI = 0; sI < SEG; sI++) for (let a = 0; a < AC.length - 1; a++) { const q = base + sI * AC.length + a, r = q + AC.length; fr.i.push(q, q + 1, r + 1, q, r + 1, r); }
    }
    const frondGeo = fr.geo(); frondGeo.computeVertexNormals();
    const nn = frondGeo.attributes.normal; for (let k = 0; k < nn.count; k++) { const v = V3().fromBufferAttribute(nn, k); if (v.y < 0) v.negate(); v.multiplyScalar(.5).add(V3(0, .7, 0)).normalize(); nn.setXYZ(k, v.x, v.y, v.z); }
    const g = new T.Group();
    g.add(meshOf(trunkGeo, palmTrunkMat));
    g.add(meshOf(frondGeo, frondMat, true, false));
    const nuts = []; for (let k = 0; k < 3 + Math.floor(R() * 3); k++) { const a = R() * 6.283; nuts.push(nutGeo.clone().translate(top.x + Math.cos(a) * .2, top.y - .22 - R() * .12, top.z + Math.sin(a) * .2)); }
    g.add(meshOf(mergeGeometries(nuts), nutMat)); nuts.forEach(n => n.dispose());
    return own(g);
  }

  // ───────── procedural: lollipop, crystal, flowers ─────────
  function buildLollipop(seed) {
    const R = mulberry(seed); const sets = [["#f43f5e", "#a855f7"], ["#22c55e", "#facc15"], ["#38bdf8", "#f472b6"], ["#fb923c", "#ef4444"]];
    const tex = spiralTex(sets[seed % sets.length]); const g = new T.Group();
    const H = 1.8 + R() * .8, stick = new T.MeshPhysicalMaterial({ color:"#fffaf0", roughness:.35, clearcoat:.6 });
    const st = meshOf(new T.CylinderGeometry(.06, .07, H, 12), stick); st.position.y = H / 2; g.add(st);
    const candy = new T.MeshPhysicalMaterial({ map:tex, roughness:.18, clearcoat:1, clearcoatRoughness:.05 });
    if (seed % 3 === 2) { const b = meshOf(new T.SphereGeometry(.75, 32, 24), candy); b.position.y = H + .55; g.add(b); }
    else { const r = .7 + R() * .25, side = new T.MeshPhysicalMaterial({ color:sets[seed % sets.length][0], roughness:.2, clearcoat:1 });
      const d = meshOf(new T.CylinderGeometry(r, r, .3, 48, 1), [side, candy, candy]); d.rotation.x = Math.PI / 2; d.position.y = H + r * .9; g.add(d);
      const bow = new T.MeshPhysicalMaterial({ color:"#ffffff", roughness:.4, clearcoat:.5 });
      for (const s of [-1, 1]) { const w = meshOf(new T.ConeGeometry(.16, .32, 12), bow); w.rotation.z = s * Math.PI / 2; w.position.set(s * .17, H - .02, 0); g.add(w); } }
    return own(g);
  }
  const CRYSTAL_COLS = ["#22d3ee", "#a855f7", "#f472b6", "#34d399"];
  function buildCrystal(seed) {
    const R = mulberry(seed); const c = CRYSTAL_COLS[seed % CRYSTAL_COLS.length]; const parts = [];
    const n = 5 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const main = i === 0, h = main ? 1.6 + R() * 1.1 : .5 + R() * 1.1, r = h * (.13 + R() * .05), tip = r * 1.8;
      const body = new T.CylinderGeometry(r, r * 1.05, h, 6, 1, true); body.translate(0, h / 2, 0);
      const cone = new T.ConeGeometry(r, tip, 6, 1, true); cone.translate(0, h + tip / 2, 0);
      const geo = mergeGeometries([body, cone]); body.dispose(); cone.dispose();
      const a = R() * 6.283, tilt = main ? (R() - .5) * .2 : .35 + R() * .5;
      geo.rotateZ(tilt); geo.rotateY(a); geo.translate(main ? 0 : Math.cos(a) * .25, -.1, main ? 0 : Math.sin(a) * .25); parts.push(geo); }
    const geo = mergeGeometries(parts); parts.forEach(p => p.dispose());
    const g = new T.Group();
    g.add(meshOf(geo, new T.MeshPhysicalMaterial({ color:c, emissive:c, emissiveIntensity:.7, roughness:.1, metalness:.05, clearcoat:1, clearcoatRoughness:.05, flatShading:true })));
    const rockGeo = new T.DodecahedronGeometry(.55, 0); rockGeo.scale(1.2, .45, 1); const rock = meshOf(rockGeo, new T.MeshStandardMaterial({ color:"#2a1f4d", roughness:.9, flatShading:true }));
    g.add(rock);
    return own(g);
  }
  let flowerMat = null, bladeMat = null;
  function buildFlowers(seed) {
    const R = mulberry(seed); const blades = new Buf(), heads = new Buf(); const g1 = new T.Color(.25, .5, .16), g2 = new T.Color(.5, .78, .3);
    for (let i = 0; i < 70; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * .95, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .22 + R() * .32, ba = R() * 6.283;
      const w = V3(Math.cos(ba), 0, Math.sin(ba)).multiplyScalar(.025), tip = V3(x + (R() - .5) * .15, h, z + (R() - .5) * .15); const col = g1.clone().lerp(g2, R());
      const q = blades.v(V3(x, 0, z).sub(w), UP, 0, 0, col.clone().multiplyScalar(.6)), r = blades.v(V3(x, 0, z).add(w), UP, 1, 0, col.clone().multiplyScalar(.6)), t = blades.v(tip, UP, .5, 1, col);
      blades.i.push(q, r, t); }
    for (let i = 0; i < 22; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * .85, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .3 + R() * .32;
      for (const s of [0, 1]) { const U = (s ? V3(.012, 0, 0) : V3(0, 0, .012)); blades.quad(V3(x, h / 2, z), U, V3(0, h / 2, 0), [0, 0, 1, 1], g1, () => UP.clone()); }
      const nrm = V3((R() - .5) * .8, 1, (R() - .5) * .8).normalize(), U = perp(nrm).applyAxisAngle(nrm, R() * 6.283), V = V3().crossVectors(nrm, U), sz = .08 + R() * .05;
      const k = Math.floor(R() * 4), tx = (k % 2) * .5, ty = Math.floor(k / 2) * .5;
      heads.quad(V3(x, h, z), U.multiplyScalar(sz), V.multiplyScalar(sz), [tx, ty, tx + .5, ty + .5], new T.Color(1, 1, 1).multiplyScalar(.9 + R() * .15), () => nrm.clone()); }
    const g = new T.Group(); g.add(meshOf(blades.geo(), bladeMat, false, true)); g.add(meshOf(heads.geo(), flowerMat, true, false)); return own(g);
  }

  // ───────── build procedural variants ─────────
  const variants = {}; // kind → [{ node, size }]
  const asVariant = node => { const b = new T.Box3().setFromObject(node); return { node, size:b.getSize(V3()) }; };
  const N = { tree:4, pine:4, palm:3, lollipop:4, crystal:4, flowers:3 };
  try {
    if (needProc.has("tree")) { leafMat = foliagePatch(new T.MeshStandardMaterial({ map:leafAtlas(), alphaTest:.5, side:T.DoubleSide, vertexColors:true, roughness:.8, metalness:0, alphaToCoverage:a2c })); }
    if (needProc.has("pine")) { needleMat = foliagePatch(new T.MeshStandardMaterial({ map:needleAtlas(theme === "snow"), alphaTest:.5, side:T.DoubleSide, vertexColors:true, roughness:.85, metalness:0, alphaToCoverage:a2c })); }
    if (needProc.has("palm")) {
      const pt = palmTrunkTex(); palmTrunkMat = new T.MeshStandardMaterial({ map:pt, normalMap:barkNor || null, normalScale:new T.Vector2(.6, .6), roughness:.95 });
      frondMat = foliagePatch(new T.MeshStandardMaterial({ map:frondTex(), alphaTest:.5, side:T.DoubleSide, vertexColors:true, roughness:.7, metalness:0, alphaToCoverage:a2c }));
      nutMat = new T.MeshStandardMaterial({ color:"#5b4a1e", roughness:.6 }); nutGeo = new T.SphereGeometry(.15, 10, 8); owned.geo.add(nutGeo);
    }
    if (needProc.has("flowers")) { flowerMat = foliagePatch(new T.MeshStandardMaterial({ map:flowerAtlas(), alphaTest:.5, side:T.DoubleSide, vertexColors:true, roughness:.6, alphaToCoverage:a2c }));
      bladeMat = foliagePatch(new T.MeshStandardMaterial({ vertexColors:true, side:T.DoubleSide, roughness:.9 })); }
    const builders = { tree:buildTree, pine:buildPine, palm:buildPalm, lollipop:buildLollipop, crystal:buildCrystal, flowers:buildFlowers };
    for (const k of needProc) { variants[k] = []; for (let i = 0; i < N[k]; i++) { try { variants[k].push(asVariant(builders[k](i + 1 + (theme.length * 13)))); } catch (e) { console.warn("[props] build", k, e); } } }
  } catch (e) { console.warn("[props] procedural", e); }
  tick();

  // ───────── prepare scanned models ─────────
  const normalize = obj => { // origin → centre of base
    obj.updateMatrixWorld(true); const box = new T.Box3().setFromObject(obj); const c = box.getCenter(V3());
    const holder = new T.Group(); obj.removeFromParent?.(); holder.add(obj);
    obj.position.x -= c.x; obj.position.y -= box.min.y; obj.position.z -= c.z; holder.updateMatrixWorld(true);
    return { node:holder, size:box.getSize(V3()) };
  };
  modelIds.forEach((id, idx) => {
    const gl = gltfs[idx]; if (!gl?.scene) return; const cfg = MODELS[id];
    try {
      const root = gl.scene; root.updateMatrixWorld(true);
      root.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"]) if (m[k]) m[k].anisotropy = aniso;
          if (m.map && m.vertexColors) { m.vertexColors = false; m.needsUpdate = true; } }); }); // scan masks in COLOR_0 (rock_07) would darken the albedo
      if (cfg.dirt) { const dirt = []; root.traverse(o => { if (/dirt/i.test(o.name)) dirt.push(o); }); dirt.forEach(o => { o.traverse(m => { m.geometry?.dispose(); }); o.removeFromParent(); });
        const disc = meshOf(new T.CircleGeometry(.205, 24), new T.MeshStandardMaterial({ color:"#3a2a1c", roughness:1 }), false, true); disc.rotation.x = -Math.PI / 2; disc.position.y = .335; root.add(disc); }
      if (cfg.lamp) root.traverse(o => { if (!o.isMesh) return; const m = o.material, nm = (m.name || "").toLowerCase();
        if (nm.includes("bulb")) { m.emissive = new T.Color("#ffe2a8"); m.emissiveIntensity = 6; m.emissiveMap = null; o.castShadow = false; }
        else if (nm.includes("glass")) { m.emissive = new T.Color("#ffd58a"); m.emissiveIntensity = .9; m.depthWrite = false; o.castShadow = false; } });
      if (theme === "snow" && /rock|shrub/.test(id)) { const cache = new Map();
        root.traverse(o => { if (!o.isMesh) return; const m = o.material; if (!cache.has(m)) { cache.set(m, id.startsWith("shrub") ? snowify(m, .8, "#c8d6dc") : snowify(m, .55)); owned.mat.add(m); } o.material = cache.get(m); }); }
      if (theme === "space" && id === "moon_rock_01") root.traverse(o => { if (o.isMesh && o.material.color) o.material.color.multiply(new T.Color("#ebe6ff")); });
      let parts;
      if (cfg.split) parts = root.children.filter(c => { let has = false; c.traverse(o => { if (o.isMesh) has = true; }); return has; });
      else if (cfg.lod) { parts = cfg.lod.map(suf => root.children.find(c => c.name.endsWith(suf))).filter(Boolean); if (!parts.length) parts = [root]; }
      else parts = [root];
      if (cfg.rotY || cfg.rotZ) parts = parts.map(p => { const g = new T.Group(); g.rotation.set(0, cfg.rotY || 0, cfg.rotZ || 0); p.removeFromParent?.(); g.add(p); return g; });
      const list = parts.map(normalize).filter(v => v.size.y > 1e-4);
      list.forEach(v => own(v.node));
      if (list.length) variants[id] = list;
    } catch (e) { console.warn("[props] model", id, e); }
  });

  // ───────── spawn ─────────
  const sinceLast = {};
  const fallbackKind = FALLBACK[theme];
  const anyKind = () => Object.keys(variants)[0];
  function spawn(kind, rnd = Math.random()) {
    if (!(rnd >= 0 && rnd <= 1)) rnd = Math.random();
    let k = kind, cfg = MODELS[k];
    if (cfg?.every) { const s = sinceLast[k] ?? 1e9; if (s < cfg.every) k = cfg.alt && variants[cfg.alt] ? cfg.alt : fallbackKind; }
    for (const key in sinceLast) sinceLast[key]++;
    if (k === kind && MODELS[k]?.every) sinceLast[k] = 0;
    if (!variants[k]?.length) k = variants[fallbackKind]?.length ? fallbackKind : anyKind();
    const outer = new T.Group(); outer.userData.kind = k;
    if (!k) return outer; // nothing could be built — empty but valid
    cfg = MODELS[k]; const list = variants[k];
    const h = i => hash(rnd, i);
    const place = (v, scale, x, z, ry) => { const inner = new T.Group(); inner.add(v.node.clone()); inner.scale.setScalar(scale);
      inner.rotation.y = ry; inner.position.set(x, -(cfg?.sink || 0) * v.size.y * scale, z); outer.add(inner); return inner; };
    if (!cfg) { // procedural
      const v = list[Math.floor(h(1) * list.length)];
      const s = k === "flowers" ? .9 + h(2) * .5 : k === "crystal" ? .8 + h(2) * .7 : k === "lollipop" ? .8 + h(2) * .3 : .85 + h(2) * .35;
      place(v, s, 0, 0, h(3) * 6.283);
      if (k === "crystal" && h(5) < .5) { const v2 = list[Math.floor(h(6) * list.length)]; place(v2, .45 + h(7) * .3, (h(8) - .5) * 1.6, .7 + h(9) * .5, h(10) * 6.283); }
    } else {
      const pick = () => list[Math.floor(h(1) * list.length)];
      const scaleFor = (v, t) => cfg.h ? lerp(cfg.h[0], cfg.h[1], t) / v.size.y
        : cfg.size ? lerp(cfg.size[0], cfg.size[1], cfg.sizePow ? Math.pow(t, cfg.sizePow) : t) / Math.max(v.size.x, v.size.y, v.size.z)
        : cfg.scale ? lerp(cfg.scale[0], cfg.scale[1], t) : 1;
      if (cfg.cluster) { const n = cfg.cluster[0] + Math.floor(h(4) * (cfg.cluster[1] - cfg.cluster[0] + 1));
        for (let i = 0; i < n; i++) { const v = list[Math.floor(h(10 + i) * list.length)], a = h(30 + i) * 6.283, d = i ? (.3 + h(50 + i) * .7) * cfg.spread * (1 + n * .1) : 0;
          place(v, scaleFor(v, h(70 + i)) * (i ? .75 + h(90 + i) * .3 : 1), Math.cos(a) * d, Math.sin(a) * d, h(110 + i) * 6.283); } }
      else if (cfg.lod) { const t = h(2), sz = lerp(cfg.size[0], cfg.size[1], Math.pow(t, cfg.sizePow));
        const v = list[sz > 2.5 && list.length > 1 ? list.length - 1 : 0]; const s = sz / Math.max(v.size.x, v.size.y, v.size.z);
        const inner = place(v, s, 0, 0, h(3) * 6.283); inner.scale.y *= .8 + h(4) * .5;
        if (sz < 1.6 && h(5) < .5) { const s2 = s * (.35 + h(6) * .3); place(list[0], s2, (h(7) - .5) * 2.2, (h(8) - .5) * 2.2, h(9) * 6.283); } }
      else { const v = pick(); const s = scaleFor(v, h(2));
        const inner = place(v, s, 0, 0, cfg.faceRoad || cfg.lamp ? 0 : h(3) * 6.283);
        if (cfg.wide) inner.scale.x *= 1 + (h(4) - .3) * (cfg.wide - 1) * 1.4;
        if (cfg.faceRoad) outer.userData.faceRoad = true; }
    }
    return outer;
  }

  const kinds = kindsWanted.filter(k => variants[k]?.length);
  if (!kinds.length && variants[fallbackKind]) kinds.push(fallbackKind);
  if (!kinds.length && anyKind()) kinds.push(anyKind());

  function dispose() {
    owned.geo.forEach(g => g.dispose()); owned.mat.forEach(m => m.dispose()); owned.tex.forEach(t => t.dispose());
    owned.geo.clear(); owned.mat.clear(); owned.tex.clear();
  }
  try { onProgress?.(1); } catch { /* ignore */ }
  return { kinds, spawn, dispose, variants };
}

// Rotation that makes a faceRoad prop (bench) face the road: pass the prop's x.
export const faceRoadRotation = x => (x > 0 ? Math.PI : 0);
