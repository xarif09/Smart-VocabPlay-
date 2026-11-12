// ─────────────────────────────────────────────────────────────────────────────
// environment.js — photoreal sky / image-based lighting / PBR ground + road
// for the 3D endless runner. Plain ESM, no React. Assets are CC0 (Poly Haven):
//   <BASE>3d/sky/<theme>.jpg  (2048×1024 tonemapped equirect → visible background)
//   <BASE>3d/sky/<theme>.hdr  (1k HDR → PMREM environment lighting)
//   <BASE>3d/tex/<id>_{diff,nor,rough}.jpg  (PBR sets, OpenGL normals)
//
// Never throws: every asset failure falls back to plain colours / procedural
// canvases, so the game always starts.
//
// Notes for the caller
//  • Lane markings / tyre tracks are baked into the road shader (second
//    CanvasTexture sampled in onBeforeCompile) → NO overlay plane needed, and
//    roadScroll(dz) scrolls both the PBR maps and the markings.
//  • The sun disc is clamped out of the HDR before PMREM so the directional light
//    you create from sunDir/sunColor/sunIntensity doesn't double the sunlight.
//  • Terrain vertex colours are applied as a soft *hue* tint on photo textures
//    (dark greens would otherwise crush the grass photo). Strength per theme is
//    in groundMaterial.userData.uniforms.uTintStrength.value (0 = ignore tint).
//  • Fog: set scene.fog = new THREE.Fog(fogColor, near, far) yourself; fogColor is
//    the sRGB horizon colour of the sky JPG (fog is applied after tone mapping and
//    the sRGB background isn't tone mapped, so they match exactly).
// ─────────────────────────────────────────────────────────────────────────────
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// sun = direction toward the sun disc measured from the brightest HDR pixel
// (three's equirect convention: u = atan(z,x)/2π + .5, v = asin(y)/π + .5).
// city/candy are sunsets (sun ~2–5° above horizon) → light raised to ~22–24°
// on the same azimuth so the track isn't in deep shadow. space = night: "moon"
// placed over the glowing horizon. All sit at +z (behind the camera), so the
// scene is front-lit and shadows fall forward along the track.
// fog = mean sRGB colour of the JPG rows just above the horizon (48–50% height).
const THEMES = {
  jungle: { ground:"leafy_grass", road:"stony_dirt_path", sun:[.553, .743, .377], sunColor:"#fff4e0", sunI:3.0, env:.80, hemi:.15, fog:"#999eac",
            tint:[0, .35], marks:"tracks", roadRep:[3, 150], roadTint:"#ffffff", roadRough:1 },
  park:   { ground:"leafy_grass", road:"gravel_road", sun:[.591, .683, .430], sunColor:"#ffe2bd", sunI:2.8, env:.80, hemi:.15, fog:"#a3aaa3",
            tint:[0, .35], marks:"white", roadRep:[3, 150], roadTint:"#ffffff", roadRough:1 },
  school: { ground:"leafy_grass", road:"red_sandstone_pavement", sun:[.523, .763, .380], sunColor:"#fff8ee", sunI:3.4, env:1.0, hemi:.15, fog:"#bcc4cc",
            tint:[0, .35], marks:"white", roadRep:[2, 100], roadTint:"#ffffff", roadRough:1 },
  snow:   { ground:"snow_02", road:"snow_02", sun:[.591, .683, .430], sunColor:"#fff1df", sunI:2.6, env:.75, hemi:.15, fog:"#b2bbc6",
            tint:[1, .8], marks:"snow", roadRep:[3, 150], roadTint:"#b9c4d0", roadRough:.85 },
  city:   { ground:"gravel_road", road:"asphalt_02", sun:[.704, .375, .603], sunColor:"#ffc48a", sunI:2.2, env:.90, hemi:.15, fog:"#a29b95",
            tint:[0, .2], marks:"city", roadRep:[4, 200], roadTint:"#ffffff", roadRough:1 },
  beach:  { ground:"coast_sand_01", road:"coast_sand_01", sun:[.611, .655, .444], sunColor:"#fff6ea", sunI:3.4, env:1.0, hemi:.15, fog:"#c4c9d0",
            tint:[0, .3], marks:"tracks", roadRep:[3, 150], roadTint:"#cbbca6", roadRough:.8 },
  // candy ground: snow_02 used as "frosting" (white, soft bumps) and multiplied by
  // the caller's raw pink vertex tint → reads as icing rather than pink grass.
  candy:  { ground:"snow_02", road:null, sun:[.723, .407, .559], sunColor:"#ffc6c0", sunI:2.2, env:.70, hemi:.20, fog:"#94877a",
            tint:[1, 1], marks:null, roadRep:[1, 25] },
  space:  { ground:"moon_01", road:null, sun:[.600, .574, .558], sunColor:"#b9c3ff", sunI:1.2, env:.60, hemi:.30, fog:"#8e938a", bgI:.75,
            tint:[0, .55], marks:null, roadRep:[1, 25] },
};
const FALLBACK = { // plain colours if textures fail
  jungle:["#5d8a3a", "#8a6a48"], park:["#6a9a45", "#9c9488"], school:["#6aa64c", "#a8644a"], snow:["#e9eef4", "#c3ccd6"],
  city:["#8a8f96", "#3a3e44"], beach:["#e2cc98", "#c9b088"], candy:["#ffd6e8", "#6b3a22"], space:["#4b3f7a", "#1d1147"],
};
const GROUND_REP = [90, 42]; // 260×120 m tile → ~2.9 m per texture repeat (both integers → seamless leap-frog)
const LINE_TILE = 32;        // marking canvas repeats 32× along the 400 m road (12.5 m per tile)

const loadTex = (loader, url) => new Promise(res => { try { loader.load(url, t => res(t), undefined, () => res(null)); } catch (e) { res(null); } });

export async function setupEnvironment({ THREE, renderer, scene, theme, BASE = "/", onProgress }) {
  const cfg = THEMES[theme] || THEMES.park, fb = FALLBACK[theme] || FALLBACK.park;
  const owned = new Set();           // textures / render targets to dispose
  const keep = x => { if (x) owned.add(x); return x; };
  let aniso = 4; try { aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1); } catch (e) {}

  // ── progress bookkeeping ──
  const jobs = [];
  let done = 0;
  const track = p => { jobs.push(p); p.then(() => { done++; try { onProgress?.(done / jobs.length); } catch (e) {} }); return p; };

  const texLoader = new THREE.TextureLoader();
  const cache = new Map(); // url → Promise<Texture|null>  (ground & road may share a set)
  const getTex = url => { if (!cache.has(url)) cache.set(url, track(loadTex(texLoader, url))); return cache.get(url); };
  const setUrls = id => ["diff", "nor", "rough"].map(k => `${BASE}3d/tex/${id}_${k}.jpg`);

  const skyP = track(loadTex(texLoader, `${BASE}3d/sky/${theme}.jpg`));
  const hdrP = track(new Promise(res => { try { new RGBELoader().load(`${BASE}3d/sky/${theme}.hdr`, t => res(t), undefined, () => res(null)); } catch (e) { res(null); } }));
  const groundP = Promise.all(setUrls(cfg.ground).map(getTex));
  const roadP = cfg.road ? Promise.all(setUrls(cfg.road).map(getTex)) : Promise.resolve(null);
  try { onProgress?.(0); } catch (e) {}

  const [skyTex, hdrTex, groundSet, roadSet] = await Promise.all([skyP, hdrP, groundP, roadP]);

  // a loaded texture may be used by two materials → clone (shares the image Source, one GPU upload)
  const used = new Set();
  const prep = (t, srgb, rep) => {
    if (!t) return null;
    const x = keep(used.has(t) ? t.clone() : t); used.add(t);
    x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(rep[0], rep[1]); x.anisotropy = aniso;
    x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; x.needsUpdate = true; return x;
  };

  // ── 1. background ──
  const fogColor = new THREE.Color(cfg.fog);
  const bgI = cfg.bgI ?? 1;
  if (bgI !== 1) fogColor.multiplyScalar(bgI); // background intensity is applied in linear space too
  if (skyTex) {
    keep(skyTex); skyTex.mapping = THREE.EquirectangularReflectionMapping; skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex; scene.backgroundIntensity = bgI; scene.backgroundBlurriness = 0;
  } else scene.background = fogColor.clone();

  // ── 2. image-based lighting ──
  let envRT = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    if (hdrTex) {
      clampSun(THREE, hdrTex, 16);
      hdrTex.mapping = THREE.EquirectangularReflectionMapping;
      envRT = pmrem.fromEquirectangular(hdrTex);
      hdrTex.dispose();
    } else if (skyTex) envRT = pmrem.fromEquirectangular(skyTex); // LDR fallback still beats nothing
    pmrem.dispose();
  } catch (e) { envRT = null; }
  if (envRT) { keep(envRT); scene.environment = envRT.texture; scene.environmentIntensity = cfg.env; }

  // ── 3. ground ──
  let groundMaterial;
  {
    const [d, n, r] = groundSet || [];
    const map = prep(d, true, GROUND_REP);
    if (map) {
      groundMaterial = new THREE.MeshStandardMaterial({ map, normalMap:prep(n, false, GROUND_REP), roughnessMap:prep(r, false, GROUND_REP),
        roughness:1, metalness:0, vertexColors:true, color:"#ffffff" });
      if (theme === "snow" || theme === "candy") groundMaterial.normalScale.set(.8, .8);
      patchPBR(THREE, groundMaterial, { key:"envGround", tintRaw:cfg.tint[0], tintStrength:cfg.tint[1], antiTile:1, rep:GROUND_REP, cells:[10, 4] });
    } else groundMaterial = new THREE.MeshStandardMaterial({ color:fb[0], vertexColors:true, roughness:.95, metalness:0 });
  }

  // ── 4. road ──
  let roadMaterial; const scrollTex = []; let linesTex = null;
  if (cfg.road) {
    const [d, n, r] = roadSet || [];
    const map = prep(d, true, cfg.roadRep);
    linesTex = keep(markingsTexture(THREE, cfg.marks, aniso));
    if (map) {
      roadMaterial = new THREE.MeshStandardMaterial({ map, normalMap:prep(n, false, cfg.roadRep), roughnessMap:prep(r, false, cfg.roadRep),
        roughness:cfg.roadRough, metalness:0, color:cfg.roadTint });
      for (const t of [roadMaterial.map, roadMaterial.normalMap, roadMaterial.roughnessMap]) if (t) scrollTex.push(t);
    } else roadMaterial = new THREE.MeshStandardMaterial({ color:fb[1], roughness:.9, metalness:0 });
    patchPBR(THREE, roadMaterial, { key:map ? "envRoad" : "envRoadPlain", antiTile:map ? .6 : 0, rep:cfg.roadRep, cells:[64, 64], lines:linesTex });
  } else {
    const p = theme === "candy" ? candyRoad(THREE, aniso) : spaceRoad(THREE, aniso);
    p.forEach(keep);
    roadMaterial = theme === "candy"
      ? new THREE.MeshStandardMaterial({ map:p[0], bumpMap:p[0], bumpScale:1, roughness:.42, metalness:0 })
      : new THREE.MeshStandardMaterial({ map:p[0], emissiveMap:p[1], emissive:"#ffffff", emissiveIntensity:1.8, roughness:.35, metalness:.35 });
    scrollTex.push(...p);
  }

  const roadLen = 400;
  const roadScroll = dz => {
    for (const t of scrollTex) t.offset.y += dz / roadLen * t.repeat.y;
    const u = roadMaterial.userData.uniforms;
    if (u?.uLineXf) u.uLineXf.value.y += dz / roadLen * LINE_TILE;
    // keep offsets small (float precision on long runs)
    for (const t of scrollTex) if (t.offset.y > 1e4) t.offset.y %= 1;
    if (u?.uLineXf && u.uLineXf.value.y > 1e4) u.uLineXf.value.y %= 1;
  };

  try { onProgress?.(1); } catch (e) {}

  const sunColor = new THREE.Color(cfg.sunColor);
  return {
    sunDir:new THREE.Vector3(...cfg.sun).normalize(),
    sunColor, sunIntensity:cfg.sunI,
    hemiIntensity:envRT ? cfg.hemi : .6,   // no IBL → caller's hemisphere light must do the ambient work
    envIntensity:cfg.env, hasEnvironment:!!envRT, hasSky:!!skyTex,
    fogColor,
    groundMaterial, roadMaterial,
    roadScroll,
    dispose() {
      if (skyTex && scene.background === skyTex) scene.background = null;
      if (envRT && scene.environment === envRT.texture) scene.environment = null;
      for (const x of owned) { try { x.dispose(); } catch (e) {} }
      owned.clear();
      try { groundMaterial.dispose(); } catch (e) {}
      try { roadMaterial.dispose(); } catch (e) {}
    },
  };
}

// Clamp the sun disc (values up to ~1e5, some Infinity in half-float) so the PMREM
// holds only sky light; the caller's DirectionalLight supplies direct sun.
// Positive half floats sort like their uint16 bit patterns → integer compare is enough.
function clampSun(THREE, tex, max) {
  try {
    const data = tex.image && tex.image.data; if (!data) return;
    if (data instanceof Uint16Array) {
      const h = THREE.DataUtils.toHalfFloat(max);
      for (let i = 0; i < data.length; i += 4) { if (data[i] > h) data[i] = h; if (data[i + 1] > h) data[i + 1] = h; if (data[i + 2] > h) data[i + 2] = h; }
    } else if (data instanceof Float32Array) {
      for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) if (!(data[i + c] <= max)) data[i + c] = max;
    }
    tex.needsUpdate = true;
  } catch (e) {}
}

// onBeforeCompile patch for MeshStandardMaterial:
//  • anti-tiling (cells must be even so the half-frequency layer stays periodic): blend the albedo with a second sample (×1/3 scale, axes swapped)
//    using a periodic value noise + low-frequency brightness variation. Periodic over
//    the texture's repeat so the 3 leap-frogging terrain tiles stay seamless.
//  • soft vertex-colour tint (raw multiply or luminance-normalised hue).
//  • optional lane markings texture (alpha-blended paint / worn tracks).
function patchPBR(THREE, mat, o) {
  const u = {
    uAntiTile:{ value:o.antiTile || 0 }, uRep:{ value:new THREE.Vector2(...o.rep) }, uCells:{ value:new THREE.Vector2(...o.cells) },
    uTintStrength:{ value:o.tintStrength ?? 1 }, uTintRaw:{ value:o.tintRaw ?? 1 },
  };
  if (o.lines) { u.uLines = { value:o.lines }; u.uLineXf = { value:new THREE.Vector2(LINE_TILE, 0) }; }
  mat.userData.uniforms = u;
  const lines = !!o.lines;
  mat.customProgramCacheKey = () => o.key;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    if (lines) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform vec2 uLineXf;\nvarying vec2 vLineUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvLineUv = vec2(uv.x, uv.y * uLineXf.x + uLineXf.y);");
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uAntiTile; uniform vec2 uRep; uniform vec2 uCells; uniform float uTintStrength; uniform float uTintRaw;
${lines ? "uniform sampler2D uLines; varying vec2 vLineUv;" : ""}
float envHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float envNoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 j = mod(i + 1.0, per); i = mod(i, per);
  return mix(mix(envHash(i), envHash(vec2(j.x, i.y)), f.x), mix(envHash(vec2(i.x, j.y)), envHash(j), f.x), f.y);
}`)
      .replace("#include <color_fragment>", `#if defined( USE_COLOR )
  { vec3 vc = vColor.rgb; float vl = max(dot(vc, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
    vec3 tc = mix(vc / vl, vc, uTintRaw);
    diffuseColor.rgb *= mix(vec3(1.0), tc, uTintStrength); }
#endif`)
      .replace("#include <map_fragment>", `float envPaintA = 0.0;
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if (uAntiTile > 0.0) {
    vec2 q = vMapUv / uRep;                       // 0..1 per tile (periodic)
    vec2 duv = vMapUv.yx * (1.0 / 3.0) + vec2(0.37, 0.71);
    vec4 s2 = texture2D( map, duv );
    float n1 = envNoise(q * uCells, uCells);
    float n2 = envNoise(q * uCells * 0.5 + 3.7, uCells * 0.5);
    sampledDiffuseColor = mix(sampledDiffuseColor, s2, smoothstep(0.3, 0.7, n1) * uAntiTile);
    sampledDiffuseColor.rgb *= mix(1.0, 0.8 + 0.4 * n2, uAntiTile);
  }
  diffuseColor *= sampledDiffuseColor;
#endif
${lines ? `  { vec4 paint = texture2D( uLines, vLineUv ); diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb, paint.a); envPaintA = paint.a; }` : ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.55, envPaintA);`);
  };
  mat.needsUpdate = true;
}

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }

// Lane markings for an 8 m road: u 0..1 across (64 px/m), one canvas = 12.5 m along.
// Dividers at x = ±1.33 m (between lanes -2.4 / 0 / 2.4), edges at ±3.7 m.
function markingsTexture(THREE, kind, aniso) {
  const W = 512, H = 1024, [c, x] = canvas(W, H);
  const px = m => (m / 8 + .5) * W;
  const dash = (cx, col, wM, onFrac = .24) => { x.fillStyle = col; const w = wM * 64; x.fillRect(px(cx) - w / 2, H * .1, w, H * onFrac); };
  const solid = (cx, col, wM) => { x.fillStyle = col; const w = wM * 64; x.fillRect(px(cx) - w / 2, 0, w, H); };
  const worn = amount => { // chip the paint so it doesn't look like vector art
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < amount; i++) { x.fillStyle = `rgba(0,0,0,${.25 + Math.random() * .6})`; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * W, Math.random() * H, s, s); }
    x.globalCompositeOperation = "source-over";
  };
  if (kind === "tracks") {
    // trodden / tyre-worn darker strips along each lane (tile seamlessly in v)
    for (const lane of [-2.4, 0, 2.4]) for (const off of [-.45, .45]) {
      const cx = px(lane + off), hw = .32 * 64, g = x.createLinearGradient(cx - hw, 0, cx + hw, 0);
      g.addColorStop(0, "rgba(20,14,8,0)"); g.addColorStop(.5, "rgba(20,14,8,.26)"); g.addColorStop(1, "rgba(20,14,8,0)");
      x.fillStyle = g; x.fillRect(cx - hw, 0, hw * 2, H);
      for (let i = 0; i < 40; i++) { const sx = cx + (Math.random() - .5) * hw * 1.6, sy = Math.random() * H, len = 60 + Math.random() * 300;
        x.fillStyle = `rgba(15,10,6,${.05 + Math.random() * .1})`; x.fillRect(sx, sy, 1 + Math.random() * 2, len); x.fillRect(sx, sy - H, 1 + Math.random() * 2, len); }
    }
  } else if (kind === "city") {
    for (const s of [-1, 1]) { dash(s * 1.33, "rgba(245,196,0,.95)", .13, .3); solid(s * 3.7, "rgba(240,240,236,.92)", .15); }
    worn(2600);
  } else if (kind === "snow") {
    for (const s of [-1, 1]) { dash(s * 1.33, "rgba(56,170,235,.75)", .12); solid(s * 3.7, "rgba(56,170,235,.55)", .1); }
    worn(1500);
  } else if (kind === "white") {
    for (const s of [-1, 1]) { dash(s * 1.33, "rgba(250,250,246,.9)", .12); solid(s * 3.7, "rgba(250,250,246,.85)", .14); }
    worn(2600);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

// Candy: milk-chocolate bar segments (bevelled, also used as bumpMap) + sprinkles +
// pink frosting lane dashes. One canvas = 8 m × 16 m → repeat (1, 25).
function candyRoad(THREE, aniso) {
  const W = 512, H = 1024, [c, x] = canvas(W, H);
  x.fillStyle = "#5a2e17"; x.fillRect(0, 0, W, H);
  const cols = 4, rows = 8, cw = W / cols, ch = H / rows, b = 10;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x0 = i * cw + 4, y0 = j * ch + 4, w = cw - 8, h = ch - 8;
    x.fillStyle = "#8a4a26"; x.fillRect(x0, y0, w, h);            // bevel light (top/left)
    x.fillStyle = "#4a240f"; x.fillRect(x0 + b, y0 + b, w - b, h - b); // bevel shade (bottom/right)
    x.fillStyle = "#6b3a1e"; x.fillRect(x0 + b, y0 + b, w - 2 * b, h - 2 * b); // face
  }
  for (let i = 0; i < 4000; i++) { const v = Math.random(); x.fillStyle = `rgba(${v > .5 ? "255,220,190" : "0,0,0"},${Math.random() * .06})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  const cl = ["#f43f5e", "#facc15", "#22d3ee", "#a3e635", "#ffffff", "#c084fc", "#fb923c"];
  for (let i = 0; i < 520; i++) { x.save(); x.translate(Math.random() * W, Math.random() * H); x.rotate(Math.random() * 6.3); x.fillStyle = cl[i % cl.length]; x.beginPath(); x.roundRect ? x.roundRect(-7, -2, 14, 4, 2) : x.rect(-7, -2, 14, 4); x.fill(); x.restore(); }
  const px = m => (m / 8 + .5) * W;
  x.fillStyle = "#ffd1e6"; for (const s of [-1, 1]) { for (let y = 0; y < H; y += 256) { x.beginPath(); x.roundRect ? x.roundRect(px(s * 1.33) - 6, y + 30, 12, 150, 6) : x.rect(px(s * 1.33) - 6, y + 30, 12, 150); x.fill(); } }
  x.fillStyle = "#fff0f6"; for (const s of [-1, 1]) x.fillRect(px(s * 3.75) - 7, 0, 14, H);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 25); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return [t];
}

// Space: dark purple sci-fi panels + glowing cyan lane lines / magenta edges.
// Returns [map, emissiveMap] sharing the same layout (both scrolled).
function spaceRoad(THREE, aniso) {
  const W = 512, H = 1024, px = m => (m / 8 + .5) * W;
  const [c, x] = canvas(W, H);
  x.fillStyle = "#1a0f3d"; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) { const v = Math.random(); x.fillStyle = `rgba(${v > .5 ? "180,160,255" : "0,0,0"},${Math.random() * .08})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  x.strokeStyle = "rgba(140,120,255,.18)"; x.lineWidth = 3;
  for (let y = 0; y <= H; y += 128) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  for (const m of [-2.67, 0, 2.67]) { x.beginPath(); x.moveTo(px(m), 0); x.lineTo(px(m), H); x.stroke(); }
  const [ce, e] = canvas(W, H);
  e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
  const glowLines = (ctx, emissive) => {
    ctx.shadowBlur = emissive ? 14 : 0;
    for (const s of [-1, 1]) {
      ctx.shadowColor = ctx.fillStyle = "#22d3ee";
      for (let y = 0; y < H; y += 256) ctx.fillRect(px(s * 1.33) - 5, y + 30, 10, 160);
      ctx.shadowColor = ctx.fillStyle = "#e879f9";
      ctx.fillRect(px(s * 3.75) - 5, 0, 10, H);
    }
    ctx.shadowBlur = 0;
  };
  glowLines(x, false); glowLines(e, true);
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 25); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  return [mk(c), mk(ce)];
}
