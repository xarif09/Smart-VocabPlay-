// Action Stage 3D — "ใครกำลังทำ?" หมวดคำกริยา (actions)
// สวนสาธารณะ 3 มิติ: ตัวละคร 3 ตัวยืนบนแท่นกลม แต่ละตัวทำท่าต่างกันพร้อมกัน (แอนิเมชันโครงกระดูกจริง)
// โจทย์ = เสียง + คำ (Prompt) · เด็กแตะตัวที่ทำท่านั้น → ตัวนั้นดีใจ + พลุกระดาษ + สปอตไลต์ · ผิด → ตัวที่แตะส่ายหัว
// โมเดล: KayKit Adventurers 2.0 + KayKit animations (CC0) ใน public/models/actors · robot / bunnykid / redpanda (CC0) ใน public/models
// สีในโลก 3D เป็นงานศิลป์ของฉาก · ปุ่ม/HUD ใช้ ui.tokens
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { setupEnvironment } from "./runner/environment.js";
import { loadPropKit } from "./runner/props.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
// 5 ด่าน = 30 รอบ (≈ 5 นาที): ตัวละคร 3 → 4 → 5 ตัว · ฉากเปลี่ยนทุกด่าน · ด่าน 3 และ 5 ตัวละครสลับที่กันระหว่างรอบ (swap = ทุกกี่วินาที)
const LEVELS = [
  { n:3, rounds:6, theme:"park",   swap:0,   name:"สวนสาธารณะ", sub:"3 คน" },
  { n:4, rounds:6, theme:"beach",  swap:0,   name:"ชายหาด",     sub:"4 คน" },
  { n:4, rounds:6, theme:"school", swap:5,   name:"สนามโรงเรียน", sub:"4 คน · สลับที่! 🔀" },
  { n:5, rounds:6, theme:"snow",   swap:0,   name:"เมืองหิมะ",   sub:"5 คน" },
  { n:5, rounds:6, theme:"candy",  swap:3.4, name:"เมืองขนม",   sub:"5 คน · สลับเร็ว! 🔀" },
];
const TOTAL = LEVELS.reduce((a, L) => a + L.rounds, 0);
// ตำแหน่งแท่นตามจำนวนตัวละคร (แถวหน้า/หลังสลับกัน ไม่บังกัน) + ขนาด + ครึ่งความกว้างฉากที่กล้องต้องเห็น
const LAYOUT = {
  3: { pos:[[-1.72, .15], [0, -.25], [1.72, .15]], s:1, halfW:2.5 },
  4: { pos:[[-2.4, .25], [-.8, -.4], [.8, -.4], [2.4, .25]], s:.95, halfW:3.2 },
  5: { pos:[[-2.75, .35], [-1.38, -.6], [0, .35], [1.38, -.6], [2.75, .35]], s:.9, halfW:3.5 },
};
const GROUND_TINT = { park:["#7fd35a", .75], school:["#7fd35a", .75], beach:["#ffffff", 0], snow:["#ffffff", 0], candy:["#ffb3d4", 1] };

// ── ตัวละคร ── ("kaykit" = สุ่มหนึ่งใน 4 ชุด ใช้ชุดคลิปร่วมกัน · ทุกตัวหันหน้าไป +Z)
const SKINS = {
  knight:    { url:"models/actors/knight.glb" },
  mage:      { url:"models/actors/mage.glb" },
  barbarian: { url:"models/actors/barbarian.glb" },
  ranger:    { url:"models/actors/ranger.glb" },
  robot:     { url:"models/robot.glb",    idle:"Idle",   cheer:"Yes" },
  bunnykid:  { url:"models/bunnykid.glb", idle:"Idle",   cheer:"Yes" },
  redpanda:  { url:"models/redpanda.glb", idle:"Idle",   cheer:"Yes" },
};
const KAYKIT = ["knight", "mage", "barbarian", "ranger"];
const KAY_ANIMS = ["models/actors/anim-general.glb", "models/actors/anim-move.glb", "models/actors/anim-tools.glb", "models/actors/anim-extra.glb"];
const KAY_IDLE = "Idle_A", KAY_CHEER = "Cheer";

// คำกริยา → { model, clip } (+ alt = ตัวเลือกอื่นที่ทำท่าเดียวกัน, prop = ของประกอบ, once = เล่นจบแล้วพักก่อนเล่นซ้ำ)
// model: "kaykit" (knight/mage/barbarian/ranger) | "robot" | "bunnykid" | "redpanda"
export const ACTION_CLIPS = {
  "RUN":    { model:"kaykit",   clip:"Running_A", alt:[{ model:"bunnykid", clip:"Run" }, { model:"redpanda", clip:"Run" }, { model:"robot", clip:"Running" }] },
  "WALK":   { model:"kaykit",   clip:"Walking_A", alt:[{ model:"bunnykid", clip:"Walk" }, { model:"redpanda", clip:"Walk" }, { model:"robot", clip:"Walking" }] },
  "JUMP":   { model:"kaykit",   clip:"Jump_Full_Short", alt:[{ model:"robot", clip:"Jump" }] },
  "DANCE":  { model:"robot",    clip:"Dance" },
  "WAVE":   { model:"robot",    clip:"Wave", alt:[{ model:"bunnykid", clip:"Wave" }, { model:"redpanda", clip:"Wave" }] },
  "LIKE":   { model:"robot",    clip:"ThumbsUp" },
  "SIT":    { model:"kaykit",   clip:"Sit_Floor_Idle", prop:"blanket" },
  "SLEEP":  { model:"kaykit",   clip:"Lie_Idle", prop:"pillow" },
  "GET UP": { model:"kaykit",   clip:"Lie_StandUp", prop:"pillow", once:1.4 },
  "THROW":  { model:"kaykit",   clip:"Throw", prop:"throwball" },
  "KICK":   { model:"kaykit",   clip:"Unarmed_Melee_Attack_Kick", prop:"kickball", gap:.5 },
  "DIG":    { model:"kaykit",   clip:"Digging", prop:"shovel" },
  "BUILD":  { model:"kaykit",   clip:"Hammering", prop:"hammer" },
  "DRINK":  { model:"kaykit",   clip:"Use_Item", prop:"mug", gap:.6 },
};
export const ACTION_VERBS = Object.keys(ACTION_CLIPS);
const CONFLICT = [["SLEEP", "GET UP"]];                          // ห้ามอยู่รอบเดียวกัน (ท่าเริ่มเหมือนกัน)
const ONLY_ROBOT = v => { const a = ACTION_CLIPS[v]; return a.model === "robot" && !(a.alt || []).length; };

const PLAT_COLORS = ["#ff7aa2", "#ffd166", "#6ec6ff", "#a3e635", "#c084fc"];
const H_TARGET = 1.55;                                            // ความสูงตัวละครหลังปรับขนาด

const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export default function ActionStage3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const [hud, setHud] = useState({ on:false, round:0, score:0, level:0, sec:0, target:null, banner:null, paused:false, loading:true, err:null, done:false });
  const avail = (words || []).filter(w => ACTION_CLIPS[(w.word || "").toUpperCase()]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    let alive = true, raf = 0;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
    } catch (e) { setHud(h => ({ ...h, loading:false, err:"เครื่องนี้แสดงภาพ 3 มิติไม่ได้ ลองเกมอื่นนะ" })); return; }
    renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width:"100%", height:"100%", display:"block", touchAction:"manipulation" });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bfe3ff");
    scene.fog = new THREE.Fog("#cfe8ff", 22, 70);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
    const look = new THREE.Vector3(0, .95, 0);

    // ── แสง ──
    const hemi = new THREE.HemisphereLight("#dff1ff", "#5b8a3a", .9); scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff1dc", 2.6);
    sun.position.set(4, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left:-5, right:5, top:5, bottom:-3, near:1, far:30 });
    sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);

    // ── พื้น ──
    const gGeo = new THREE.PlaneGeometry(120, 120, 1, 1); gGeo.rotateX(-Math.PI / 2);
    { const n = gGeo.attributes.position.count, c = new THREE.Color("#7fd35a"), arr = []; for (let i = 0; i < n; i++) arr.push(c.r, c.g, c.b); gGeo.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3)); }
    const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ color:"#79b956", roughness:1 })); ground.receiveShadow = true; scene.add(ground);
    // ทางเดินโค้งหลังเวที (สีครีม)
    const path = new THREE.Mesh(new THREE.RingGeometry(5.2, 6.4, 64, 1, Math.PI * 1.08, Math.PI * .84), new THREE.MeshStandardMaterial({ color:"#e9d8b4", roughness:.95 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, .01, 1.5); path.receiveShadow = true; scene.add(path);

    let env = null, kit = null, scenery = null, themeNow = null, themeWant = null;
    const tintGround = theme => { const [c, k] = GROUND_TINT[theme] || GROUND_TINT.park; const col = new THREE.Color(c), a = gGeo.attributes.color;
      for (let i = 0; i < a.count; i++) a.setXYZ(i, col.r, col.g, col.b); a.needsUpdate = true; const u = ground.material.userData?.uniforms; if (u?.uTintStrength) u.uTintStrength.value = k; };
    // เปลี่ยนฉากตามด่าน: โหลดท้องฟ้า/พื้น/ต้นไม้ชุดใหม่ แล้วค่อยสลับ (ชุดเก่าคืนหน่วยความจำ)
    const applyTheme = theme => {
      if (theme === themeWant) return; themeWant = theme;
      const envP = setupEnvironment({ THREE, renderer, scene, theme, BASE }).catch(() => null);
      const kitP = loadPropKit({ THREE, theme, BASE, renderer }).catch(() => null);
      Promise.all([envP, kitP]).then(([e, k]) => {
        if (!alive || themeWant !== theme) { e?.dispose(); k?.dispose(); return; }
        if (e) { const old = env; env = e; themeNow = theme;
          ground.material = e.groundMaterial; tintGround(theme);
          if (e.hasSky) scene.fog.color.copy(e.fogColor);
          sun.color.copy(e.sunColor); sun.intensity = e.sunIntensity * .95; hemi.intensity = e.hemiIntensity + .25;
          const d = e.sunDir.clone(); d.y = Math.max(d.y, .55); d.normalize(); sun.position.copy(d.multiplyScalar(12)); // ไฟส่องจากด้านหน้า-บน
          old?.dispose(); }
        if (k) { const oldK = kit, oldS = scenery; kit = k; scenery = new THREE.Group(); scene.add(scenery); placeScenery(k, scenery, theme);
          if (oldS) scene.remove(oldS); oldK?.dispose(); }
      });
    };
    const placeScenery = (k, grp, theme) => {
      const spots = [[-8.5, -6], [-4.5, -8.5], [0.5, -10], [4.5, -8], [8, -5.5], [-10, -2], [10.5, -1.5], [-2.5, -13], [7, -12], [-6.5, -12.5], [12, -9], [-12, -8]];
      spots.forEach(([x, z], i) => {
        let kind = k.kinds[i % k.kinds.length]; if (i < 5 && kind === "painted_wooden_bench" && i !== 1) kind = k.kinds.find(x => x !== "painted_wooden_bench") || kind;
        const o = k.spawn(kind, Math.random()); o.position.set(x + (Math.random() - .5), 0, z + (Math.random() - .5)); o.rotation.y = kind === "painted_wooden_bench" ? Math.atan2(-x, -z) + Math.PI : Math.random() * 6;
        o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
        grp.add(o);
      });
      for (let i = 0; i < 6; i++) { if (!k.variants?.flowers?.length) break; const o = k.spawn("flowers", Math.random()); o.position.set((i - 2.5) * 2.4 + (Math.random() - .5), 0, -3.2 - Math.random() * 1.2); grp.add(o); }
    };
    applyTheme("park");

    // ── แท่นกลม 3 แท่น ──
    const slots = PLAT_COLORS.map((_, i) => {
      const g = new THREE.Group(); g.position.set(0, 0, -.2); g.visible = false; scene.add(g);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.82, .9, .16, 48), new THREE.MeshStandardMaterial({ color:"#ffffff", roughness:.45 }));
      base.position.y = .08; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .04, 48), new THREE.MeshStandardMaterial({ color:PLAT_COLORS[i], roughness:.4, emissive:PLAT_COLORS[i], emissiveIntensity:0 }));
      top.position.y = .17; top.receiveShadow = true; g.add(top);
      const ringMat = new THREE.MeshBasicMaterial({ color:"#fff3a0", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending });
      const ring = new THREE.Mesh(new THREE.RingGeometry(.74, 1.05, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .2; g.add(ring);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, 2.1, 12), new THREE.MeshBasicMaterial({ visible:false })); hit.position.y = 1.05; hit.userData.slot = i; g.add(hit);
      return { g, top, ring, hit, actor:null, hint:0, bad:0, to:new THREE.Vector3(0, 0, -.2), from:null, k:1, sc:1, on:false };
    });
    let nSlots = 3, halfW = 2.5;
    const active = () => slots.slice(0, nSlots);
    // จัดแท่นตามจำนวนตัวละคร (แท่นใหม่เด้งขึ้น แท่นเกินยุบหาย)
    const setLayout = (n, instant) => {
      const L = LAYOUT[n] || LAYOUT[3]; nSlots = n; halfW = L.halfW; fit();
      slots.forEach((s, i) => {
        if (i < n) { const [x, z] = L.pos[i]; s.from = s.g.visible ? s.g.position.clone() : new THREE.Vector3(x, 0, z); s.to.set(x, 0, z); s.k = instant ? 1 : 0; s.sc = L.s;
          if (!s.g.visible) { s.g.visible = true; s.g.scale.setScalar(.001); s.grow = 0; } s.on = true; if (instant) { s.g.position.copy(s.to); s.g.scale.setScalar(L.s); s.grow = 1; } }
        else { s.on = false; s.shrink = s.g.visible ? 1 : 0; }
      });
    };
    // สลับที่ (เหมือนเกมทายถ้วย): สลับตำแหน่งแท่น 2 แท่น ตัวละครเดินทางไปด้วย
    const swapSlots = () => {
      const act = active(); const a = Math.floor(Math.random() * act.length); let b = Math.floor(Math.random() * (act.length - 1)); if (b >= a) b++;
      const A = act[a], B = act[b]; const ta = A.to.clone();
      A.from = A.g.position.clone(); A.to.copy(B.to); A.k = 0; A.arc = 1;
      B.from = B.g.position.clone(); B.to.copy(ta); B.k = 0; B.arc = -1;
      sfx.tap?.();
    };

    // ── สปอตไลต์ + ลำแสง ──
    const spot = new THREE.SpotLight("#fff6d8", 0, 12, .42, .5, 0); spot.position.set(0, 7, 2.2); scene.add(spot); scene.add(spot.target);
    const beamMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      uniforms:{ uO:{ value:0 } }, vertexShader:"varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader:"uniform float uO; varying float vY; void main(){ gl_FragColor=vec4(1.,.95,.75, uO*(.05+.4*(1.-vY))); }" });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, 1.05, 6, 32, 1, true), beamMat); beam.visible = false; scene.add(beam);

    // ── พลุกระดาษ ──
    const NC = 180;
    const confGeo = new THREE.PlaneGeometry(.09, .05);
    const conf = new THREE.InstancedMesh(confGeo, new THREE.MeshBasicMaterial({ side:THREE.DoubleSide }), NC); conf.frustumCulled = false; conf.count = 0; scene.add(conf);
    const CC = ["#f43f5e", "#facc15", "#22d3ee", "#a3e635", "#c084fc", "#fb923c", "#ffffff"].map(c => new THREE.Color(c));
    for (let i = 0; i < NC; i++) conf.setColorAt(i, CC[i % CC.length]);
    const parts = []; const dummy = new THREE.Object3D();
    const burst = (x, z) => { parts.length = 0; for (let i = 0; i < NC; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.6;
      parts.push({ p:new THREE.Vector3(x, 1.7, z), v:new THREE.Vector3(Math.cos(a) * s * .8, 3 + Math.random() * 3.5, Math.sin(a) * s * .6 + .6), r:new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w:(Math.random() - .5) * 14, life:2.6 + Math.random() }); } conf.count = NC; };

    // ── ตัว Z ลอย (นอนหลับ) ──
    const zTex = canvasTex(64, 64, (x) => { x.font = "900 52px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 8; x.strokeStyle = "#3b82f6"; x.strokeText("z", 32, 34); x.fillStyle = "#ffffff"; x.fillText("z", 32, 34); });

    // ── โหลดโมเดล ──
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const cache = {};
    const load = u => cache[u] || (cache[u] = loader.loadAsync(BASE + u).catch(() => null));
    const clips = { kaykit:{} };
    const modelOK = {};
    const ready = (async () => {
      const urls = [...new Set(Object.values(SKINS).map(s => s.url))];
      const res = await Promise.all([...urls.map(load), ...KAY_ANIMS.map(load), load("models/actors/mug.glb")]);
      for (const a of res.slice(urls.length, urls.length + KAY_ANIMS.length)) if (a) for (const c of a.animations) clips.kaykit[c.name] = c;
      for (const [id, s] of Object.entries(SKINS)) { const g = await load(s.url); if (!g) continue; modelOK[id] = true; if (!KAYKIT.includes(id)) { clips[id] = {}; for (const c of g.animations) clips[id][c.name] = c; } }
    })();

    // ── ของประกอบ ──
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color:c, roughness:.7, ...o });
    const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.userData.own = true; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
    const findBone = (root, re) => { let b = null; root.traverse(o => { if (!b && re.test(o.name)) b = o; }); return b; };
    function addProps(actor, kind) {
      const { model, holder } = actor; const hand = findBone(model, /^handslotr$/i);
      const u = 1 / actor.scale;                     // หน่วยของมือ = หน่วยโมเดลก่อนย่อ → ของในมือต้องขยายกลับ
      const inHand = g => { if (hand) { g.scale.setScalar(1); hand.add(g); } };
      if (kind === "shovel") {
        const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.035, .035, 1.3, 8), M("#a0683a")), mesh(new THREE.BoxGeometry(.28, .36, .04), M("#b8c2cc", { metalness:.6, roughness:.35 }), 0, .8, 0));
        g.children[0].position.y = .25 - .4; g.children[1].position.y = 1.05 - .4; inHand(g);
        const mound = mesh(new THREE.SphereGeometry(.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M("#7a4b2a", { roughness:1 }), -.32, 0, .52); mound.scale.y = .45; holder.add(mound);
        for (let i = 0; i < 5; i++) holder.add(mesh(new THREE.DodecahedronGeometry(.05 + Math.random() * .03), M("#6b4226", { roughness:1 }), -.32 + (Math.random() - .5) * .6, .03, .52 + (Math.random() - .5) * .4));
      } else if (kind === "hammer") {
        const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.035, .035, .6, 8), M("#a0683a"), 0, .2, 0), mesh(new THREE.BoxGeometry(.34, .14, .14), M("#94a3b8", { metalness:.7, roughness:.3 }), 0, .5, 0)); inHand(g);
        const bench = new THREE.Group(); bench.position.set(-.3, 0, .5);
        bench.add(mesh(new THREE.CylinderGeometry(.2, .24, .42, 14), M("#8b5a2b", { roughness:.9 }), 0, .21, 0));
        const house = new THREE.Group(); house.position.y = .42; bench.add(house);
        house.add(mesh(new THREE.BoxGeometry(.3, .24, .26), M("#e0a96d")), mesh(new THREE.BoxGeometry(.36, .04, .32), M("#c2410c"), 0, .14, 0));
        const hole = new THREE.Mesh(new THREE.CircleGeometry(.05, 16), M("#3b2414")); hole.position.set(0, .02, .131); house.add(hole);
        holder.add(bench);
      } else if (kind === "mug") {
        const g = new THREE.Group(); const mg = cache["models/actors/mug.glb"]; mg?.then?.(m => { if (m && alive) { const c = m.scene.clone(); c.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(c); } }); inHand(g);
      } else if (kind === "throwball") {
        const ball = mesh(new THREE.SphereGeometry(.12 * u, 20, 14), M("#ef4444", { roughness:.35 })); ball.position.set(0, .05 * u, 0); if (hand) hand.add(ball);
        const fly = mesh(new THREE.SphereGeometry(.12, 20, 14), ball.material); fly.visible = false; scene.add(fly);
        actor.fx = { type:"throw", ball, fly, hand, v:new THREE.Vector3(), launched:false };
      } else if (kind === "kickball") {
        const ball = mesh(new THREE.SphereGeometry(.13, 24, 16), new THREE.MeshStandardMaterial({ map:canvasTex(128, 64, (x, w, h) => { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.fillStyle = "#111827"; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(i * 22 + 10, (i % 2) * 30 + 16, 9, 0, 7); x.fill(); } }), roughness:.4 }), -.14, .13, .42);
        holder.add(ball); actor.fx = { type:"kick", ball, home:ball.position.clone(), z:0 };
      } else if (kind === "pillow") {
        const pillow = mesh(new THREE.BoxGeometry(.42, .12, .3, 4, 2, 4), M("#ffffff", { roughness:.8 })); holder.parent.add(pillow);
        const head = findBone(model, /^head$/i);
        const zs = [0, 1, 2].map(i => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:zTex, transparent:true, depthWrite:false })); s.userData.k = i / 3; holder.parent.add(s); return s; });
        actor.fx = { type:"sleep", pillow, head, zs, extra:[pillow, ...zs] };
      } else if (kind === "blanket") {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map:canvasTex(128, 128, (x, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? "#ffffff" : "#ef4444"; x.fillRect(i * w / 8, j * w / 8, w / 8, w / 8); } }), roughness:.95 }));
        b.rotation.x = -Math.PI / 2; b.position.y = .195; b.receiveShadow = true; holder.parent.add(b); actor.fx = { type:"none", extra:[b] };
      }
    }

    // ── สร้าง/ลบนักแสดง ──
    function makeActor(slotIdx, skin, verb) {
      const S = SKINS[skin]; const src = cache[S.url];
      const holder = new THREE.Group(); slots[slotIdx].g.add(holder); holder.position.y = .19;
      const actor = { skin, verb, holder, mixer:null, actions:{}, scale:1, t:0, shake:0, cheer:false, fx:null, pop:0, onceWait:0 };
      return src.then(g => {
        const model = SkeletonUtils.clone(g.scene); actor.model = model;
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model, true); const h = Math.max(.01, box.max.y - box.min.y);
        actor.scale = H_TARGET / h * (KAYKIT.includes(skin) ? 1 : (skin === "robot" ? .98 : .92));
        model.scale.setScalar(actor.scale); model.position.y = -box.min.y * actor.scale;
        holder.add(model);
        const lib = KAYKIT.includes(skin) ? clips.kaykit : clips[skin];
        const A = ACTION_CLIPS[verb]; const want = KAYKIT.includes(skin) ? "kaykit" : skin;
        const clipName = ([{ model:A.model, clip:A.clip }, ...(A.alt || [])].find(o => o.model === want) || {}).clip;
        actor.mixer = new THREE.AnimationMixer(model);
        const mk = n => { const c = lib[n]; if (!c) return null; const a = actor.mixer.clipAction(c); return a; };
        actor.main = mk(clipName); actor.idle = mk(S.idle || KAY_IDLE); actor.cheerA = mk(S.cheer || KAY_CHEER);
        actor.head = findBone(model, /^head$/i);
        if (actor.main) {
          if (A.once) { actor.main.setLoop(THREE.LoopOnce, 1); actor.main.clampWhenFinished = true; actor.once = A.once; }
          actor.main.play(); actor.main.time = Math.random() * .3 * actor.main.getClip().duration;
          if (A.gap) actor.gap = A.gap;
          if (actor.gap) { actor.main.setLoop(THREE.LoopOnce, 1); actor.main.clampWhenFinished = true; }
        } else actor.idle?.play();
        if ((verb === "SLEEP" || verb === "GET UP") && actor.head && actor.main) {   // นอนตามแนวลึก (หัวไปด้านหลัง เฉียงเข้ากลาง) ไม่ล้นแท่น
          const t0 = actor.main.time; actor.main.time = 0; actor.mixer.update(0); holder.updateMatrixWorld(true);
          const hp = actor.head.getWorldPosition(new THREE.Vector3()); holder.worldToLocal(hp);
          const px = slots[slotIdx].to.x; const sx = px < -.5 ? .45 : px > .5 ? -.45 : .3;
          holder.rotation.y = Math.atan2(sx, -1) - Math.atan2(hp.x, hp.z); actor.main.time = t0;
        }
        if (A.prop) addProps(actor, A.prop);
        holder.scale.setScalar(.001);
        return actor;
      });
    }
    function removeActor(a) {
      if (!a) return;
      a.mixer?.stopAllAction();
      const kill = o => { o.parent?.remove(o); o.traverse?.(x => { if (x.userData.own || x.isSprite) { if (x.isMesh) x.geometry?.dispose?.(); const m = x.material; if (m) { if (m.map && m.map !== zTex) m.map.dispose(); m.dispose(); } } }); };
      kill(a.holder); (a.fx?.extra || []).forEach(kill); if (a.fx?.fly) kill(a.fx.fly);
    }

    // ── เลือกท่าในแต่ละรอบ ──
    const optionsFor = v => { const A = ACTION_CLIPS[v]; return [{ model:A.model, clip:A.clip }, ...(A.alt || [])].filter(o => o.model === "kaykit" ? KAYKIT.some(k => modelOK[k]) && clips.kaykit[o.clip] : modelOK[o.model] && clips[o.model]?.[o.clip]); };
    const usable = v => optionsFor(v).length > 0;
    function cast(target, n = 3) {
      const verbs = [target];
      const conflicts = v => verbs.some(x => x === v || CONFLICT.some(c => c.includes(x) && c.includes(v)) || (ONLY_ROBOT(x) && ONLY_ROBOT(v)));
      for (const v of shuffle(ACTION_VERBS)) { if (verbs.length >= n) break; if (usable(v) && !conflicts(v)) verbs.push(v); }
      // ให้แต่ละท่ามีตัวละครไม่ซ้ำกัน
      const used = new Set(); const out = [];
      const order = [...verbs].sort((a, b) => optionsFor(a).length - optionsFor(b).length);
      const skinFor = {};
      for (const v of order) {
        const opts = shuffle(optionsFor(v));
        const choices = opts.flatMap(o => o.model === "kaykit" ? shuffle(KAYKIT.filter(k => modelOK[k])) : [o.model]);
        const s = choices.find(c => !used.has(c)) || choices[0]; used.add(s); skinFor[v] = s;
      }
      const slotsOrder = shuffle(verbs);
      for (const v of slotsOrder) out.push({ verb:v, skin:skinFor[v] });
      return out;
    }

    // ── เกม: 5 ด่าน (ตัวละครเพิ่มขึ้น · ฉากเปลี่ยน · สลับที่) ──
    const G = { round:0, lr:0, level:0, score:0, target:null, cast:[], wrong:0, busy:true, started:false, over:false, paused:false, queue:[], gt:0, playT:0, sec:-1, swapT:0, swaps:0 };
    const FAST = (typeof window !== "undefined" && +window.__VP_FAST) || 1;  // ชุดทดสอบเร่งจังหวะได้
    const events = [];
    const later = (fn, ms) => { events.push({ at:G.gt + ms / 1000 / FAST, fn }); };
    const targetsQueue = () => { const pool = shuffle(avail.filter(w => usable(w.word.toUpperCase()))); const out = []; let last = null;
      while (out.length < TOTAL && pool.length) { const c = shuffle(pool); for (const w of c) { if (out.length >= TOTAL) break; if (w === last && pool.length > 1) continue; out.push(w); last = w; } } return out; };
    let pendingSwap = null;
    async function setupRound(word) {
      const verb = word.word.toUpperCase();
      const lineup = cast(verb, nSlots);
      const old = slots.map(s => s.actor);
      slots.forEach(s => { s.actor = null; s.hint = 0; });
      old.forEach(a => { if (a) a.leaving = 1; });
      const made = await Promise.all(lineup.map((c, i) => makeActor(i, c.skin, c.verb)));
      if (!alive) { made.forEach(removeActor); return; }
      pendingSwap = { old, made };
      made.forEach((a, i) => { slots[i].actor = a; a.pop = -i * .12; });
      G.cast = lineup; G.target = word; G.wrong = 0;
    }
    const hudSync = (x = {}) => setHud(h => ({ ...h, on:true, round:G.round, score:G.score, level:G.level, ...x }));
    const nextRound = (first) => {
      if (G.over) return;
      const L = LEVELS[G.level];
      if (G.lr >= L.rounds) return levelDone();
      if (!G.queue.length) return finish();
      const w = G.queue.shift(); G.round++; G.lr++; G.busy = true; G.swapT = Math.max(0, L.swap - 1.6); G.swaps = 0;   // ด่านสลับที่: สลับครั้งแรกเร็ว (ตอนกำลังฟังคำ)
      hudSync({ target:w });
      if (first) ui.say(w);                                       // คำแรก: พูดตรงในคลิก (iOS)
      setupRound(w).then(() => { if (!alive) return; G.busy = false; if (!first) ui.say(w); });
    };
    const levelDone = () => {
      G.busy = true; const last = G.level >= LEVELS.length - 1 || !G.queue.length;
      const L = LEVELS[G.level]; const got = G.lvScore; const stars = got >= L.rounds * .9 ? 3 : got >= L.rounds * .6 ? 2 : 1;
      sfx.win?.(); burst(-1.2, 0); later(() => burst(1.2, 0), 350);
      hudSync({ target:null, banner:{ kind:"done", title:last ? "เก่งมาก! ครบทุกด่าน 🏆" : `ผ่านด่าน ${G.level + 1}! 🎉`, stars, id:Math.random() } });
      if (last) { later(finish, 2600); return; }
      const N = LEVELS[G.level + 1];
      applyTheme(N.theme);                                        // เริ่มโหลดฉากใหม่ระหว่างฉลอง
      later(() => {
        G.level++; G.lr = 0; G.lvScore = 0;
        slots.forEach(s => { if (s.actor) s.actor.leaving = 1; }); pendingSwap = { old:slots.map(s => s.actor), made:[] }; slots.forEach(s => { s.actor = null; s.hint = 0; });
        setLayout(N.n);
        hudSync({ target:null, banner:{ kind:"next", title:`ด่าน ${G.level + 1} · ${N.name}`, sub:N.sub, id:Math.random() } });
        later(() => { hudSync({ banner:null }); nextRound(false); }, 2600);
      }, 2400);
    };
    const finish = (early) => {
      if (G.over) return; G.busy = true; G.over = true;
      const total = Math.max(1, early ? G.answered : G.round);     // จบก่อน = นับเฉพาะรอบที่ตอบแล้ว
      setHud(h => ({ ...h, on:false, done:true, paused:false, banner:null, target:null }));
      setTimeout(() => { if (alive) track.finish(G.score, total, { label:`ตอบถูก ${G.score}/${total} ท่า` }); }, early ? 50 : 900);
    };
    let spotT = 0, spotSlot = -1;
    const answer = i => {
      if (G.busy || G.over || G.paused || !G.target) return;
      const s = slots[i]; const a = s.actor; if (!a || a.shake > .3 || s.k < 1) return;
      const ok = a.verb === G.target.word.toUpperCase();
      if (ok) {
        G.busy = true; G.answered++; if (G.wrong === 0) { G.score++; G.lvScore++; } ui.correct(G.target); sfx.ok?.(); later(() => sfx.win?.(), 120);
        hudSync();
        const wp = new THREE.Vector3(); s.g.getWorldPosition(wp); burst(wp.x, wp.z);
        spotT = 0.0001; spotSlot = i; spot.position.set(wp.x * .6, 7, 2.4); spot.target.position.copy(wp);
        if (a.cheerA) { a.cheer = true; a.fx?.ball && (a.fx.ball.visible = false); a.main?.fadeOut(.25); a.cheerA.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(.25).play(); }
        slots.forEach((o, j) => { const b = o.actor; if (j !== i && b && b.idle) { b.main?.fadeOut(.4); b.idle.reset().fadeIn(.4).play(); b.calm = true; } });
        later(() => { spotT = -1; nextRound(false); }, 2600);
      } else {
        G.wrong++; sfx.bad?.(); ui.wrong(G.target); a.shake = 1; s.bad = 1;
        if (G.wrong >= 2) slots.forEach(o => { if (o.actor && o.actor.verb === G.target.word.toUpperCase()) o.hint = 1; });
        later(() => { if (!G.over) ui.say(G.target); }, 700);
      }
    };
    G.lvScore = 0; G.answered = 0;

    // ── แตะ ──
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const onDown = e => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(active().map(s => s.hit), false);
      let i = hits.length ? hits[0].object.userData.slot : -1;
      if (i < 0) { // แตะใกล้ๆ ก็นับ: เลือกแท่นที่ใกล้จุดแตะที่สุดบนจอ
        let best = 1e9; active().forEach((s, j) => { const p = new THREE.Vector3(); s.g.getWorldPosition(p); p.y = .9; p.project(camera); const d = Math.hypot(p.x - ptr.x, (p.y - ptr.y) * .6); if (d < best && d < (nSlots > 3 ? .26 : .35)) { best = d; i = j; } });
      }
      if (i >= 0) answer(i);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);

    // ── ขนาดจอ / กล้อง ──
    const fit = () => {
      const w = el.clientWidth || 360, h = el.clientHeight || 400; renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const needH = 1.25;                                         // ครึ่งความกว้างฉากที่ต้องเห็น (ตามจำนวนตัวละคร) · ครึ่งความสูง
      const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const d = Math.max(halfW / (tv * camera.aspect), needH / tv) + .8;
      camTo.set(0, .9 + d * .2, d); if (!camInit) { camInit = true; camera.position.copy(camTo); } look.set(0, .62, 0); camera.lookAt(look); camera.updateProjectionMatrix();
    };
    const camTo = new THREE.Vector3(); let camInit = false;
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);

    // ── วงจร ──
    const clock = new THREE.Clock(); const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dtR0 = Math.min(FAST > 1 ? .5 : .25, clock.getDelta()), T = clock.elapsedTime;
      const dtR = G.paused ? 0 : dtR0, dt = Math.min(FAST > 1 ? .4 : .05, dtR);     // พัก = ทุกอย่างหยุดนิ่ง (ชุดทดสอบบนเครื่องช้า: ก้าวเวลาใหญ่ขึ้น)
      // เวลาเกม + คิวเหตุการณ์ + นาฬิกาบนจอ
      if (!G.paused) { G.gt += dt; if (G.started && !G.over) { G.playT += dtR; const sec = Math.floor(G.playT); if (sec !== G.sec) { G.sec = sec; setHud(h => ({ ...h, sec })); } } }
      for (let i = 0; i < events.length; i++) if (events[i].at <= G.gt) { const ev = events.splice(i, 1)[0]; i--; if (alive) ev.fn(); }
      // กล้องถอย/เข้าตามจำนวนตัวละคร
      camera.position.lerp(camTo, Math.min(1, dtR0 * 2.5)); camera.lookAt(look);
      // แท่น: ย้ายตำแหน่ง (จัดใหม่/สลับที่ เป็นโค้งกระโดด) · เด้งขึ้น/ยุบหาย
      slots.forEach(s => {
        if (s.k < 1 && s.from) { s.k = Math.min(1, s.k + dt / (s.arc ? Math.max(.5, .95 / Math.sqrt(FAST)) : .7)); const e = s.k * s.k * (3 - 2 * s.k);
          s.g.position.lerpVectors(s.from, s.to, e); if (s.arc) { s.g.position.z += Math.sin(s.k * Math.PI) * .9 * s.arc; s.g.position.y = Math.sin(s.k * Math.PI) * .25; }
          if (s.k >= 1) { s.g.position.copy(s.to); s.arc = 0; } }
        if (s.on && s.grow < 1) { s.grow = Math.min(1, (s.grow || 0) + dt * 2.4); const k = s.grow; s.g.scale.setScalar(Math.max(.001, s.sc * (1 + Math.sin(k * Math.PI) * .15 - (1 - k) * (1 - k) * .99))); }
        else if (s.on) s.g.scale.setScalar(s.sc + (s.g.scale.x - s.sc) * .8);
        if (!s.on && s.shrink > 0) { s.shrink = Math.max(0, s.shrink - dt * 3); s.g.scale.setScalar(Math.max(.001, s.shrink * s.sc)); if (s.shrink <= 0) { s.g.visible = false; removeActor(s.actor); s.actor = null; } }
      });
      // ด่านสลับที่: ระหว่างรอคำตอบ แท่น 2 แท่นสลับกันเป็นระยะ (สูงสุด 3 ครั้ง/รอบ)
      { const L = LEVELS[G.level]; if (L.swap && G.started && !G.busy && !G.paused && !pendingSwap && G.swaps < 3 && active().every(s => s.k >= 1)) {
        G.swapT += dt * FAST; if (G.swapT > L.swap) { G.swapT = 0; G.swaps++; swapSlots(); } } }
      // สลับนักแสดง: ตัวเก่าย่อหาย ตัวใหม่เด้งขึ้น
      if (pendingSwap) {
        let gone = true;
        for (const a of pendingSwap.old) if (a) { a.leaving = Math.max(0, a.leaving - dtR * 4); a.holder.scale.setScalar(Math.max(.001, a.leaving)); if (a.leaving > 0) gone = false; }
        if (gone) { pendingSwap.old.forEach(removeActor); pendingSwap.old = []; }
        let all = true;
        for (const a of pendingSwap.made) { if (!gone) { all = false; continue; } a.pop = Math.min(1, a.pop + dtR * 2.6); const p = Math.max(0, a.pop); const s = p <= 0 ? .001 : 1 + Math.sin(p * Math.PI) * .18 * (1 - p) * 2 - (1 - p) * (1 - p) * .99; a.holder.scale.setScalar(Math.max(.001, Math.min(1.25, s))); if (a.pop < 1) all = false; }
        if (gone && all) { pendingSwap.made.forEach(a => a.holder.scale.setScalar(1)); pendingSwap = null; }
      }
      slots.forEach((s, i) => {
        const a = s.actor;
        // แท่น: ไฮไลต์คำใบ้ / แดงเมื่อผิด
        s.bad = Math.max(0, s.bad - dt * 2);
        const glow = s.hint ? .35 + .35 * Math.sin(T * 6) : 0;
        s.ring.material.opacity = Math.max(glow, spotSlot === i && spotT > 0 ? Math.min(1, spotT * 3) * .9 : 0);
        s.top.material.emissive.set(s.bad > 0 ? "#ff0000" : PLAT_COLORS[i]); s.top.material.emissiveIntensity = s.bad > 0 ? s.bad * .8 : glow * .5;
        if (!a || !a.mixer) return;
        a.mixer.update(dt);
        // เล่นซ้ำแบบมีช่วงพัก
        if (!a.cheer && !a.calm && a.main && (a.once || a.gap)) {
          const done = a.main.time >= a.main.getClip().duration - 1e-3 || !a.main.isRunning();
          if (done) { a.onceWait += dt; if (a.onceWait > (a.once || a.gap)) { a.onceWait = 0; a.main.reset().play(); if (a.fx?.type === "kick") a.fx.z = 0; } }
        }
        // ส่ายหัว
        if (a.shake > 0 && a.head) {
          a.shake = Math.max(0, a.shake - dt * 1.1);
          a.model.updateMatrixWorld(true);
          const ang = Math.sin(a.shake * 30) * .55 * Math.min(1, a.shake * 2.5);
          a.head.getWorldQuaternion(qA); qB.setFromAxisAngle(UP, ang).multiply(qA);
          a.head.parent.getWorldQuaternion(qA); a.head.quaternion.copy(qA.invert().multiply(qB));
          a.holder.position.x = Math.sin(a.shake * 40) * .03 * a.shake;
        }
        // เอฟเฟกต์ของประกอบ
        const fx = a.fx; if (!fx) return;
        if (fx.type === "throw" && a.main) {
          const k = a.main.time / a.main.getClip().duration;
          if (a.cheer || a.calm) { fx.ball.visible = false; fx.fly.visible = false; }
          else if (k < .42) { fx.ball.visible = true; fx.launched = false; fx.fly.visible = false; }
          else if (!fx.launched) { fx.launched = true; fx.ball.visible = false; fx.ball.getWorldPosition(fx.fly.position); fx.fly.visible = true;
            tmp.set(0, 0, 1).applyQuaternion(a.holder.getWorldQuaternion(qA)); fx.v.copy(tmp.multiplyScalar(4.5)).add(new THREE.Vector3(0, 3, 0)); }
          if (fx.fly.visible) { fx.v.y -= 9.8 * dt; fx.fly.position.addScaledVector(fx.v, dt); if (fx.fly.position.y < .1) fx.fly.visible = false; }
        } else if (fx.type === "kick" && a.main) {
          const k = a.main.time / a.main.getClip().duration;
          if (!a.cheer && !a.calm && k > .42 && fx.z === 0) fx.z = .0001;
          if (fx.z > 0) { fx.z += dt * 3.2; fx.ball.position.set(fx.home.x - fx.z * .15, fx.home.y + Math.max(0, Math.sin(Math.min(1, fx.z / 1.6) * Math.PI)) * .35, fx.home.z + fx.z); fx.ball.rotation.x += dt * 12; fx.ball.scale.setScalar(Math.max(.001, 1 - Math.max(0, fx.z - 1.4) * 2)); }
          if (fx.z === 0 || fx.z > 2) { if (fx.z > 2) fx.z = -1; fx.ball.position.copy(fx.home); fx.ball.scale.setScalar(1); }
        } else if (fx.type === "sleep" && fx.head) {
          fx.head.getWorldPosition(tmp); s.g.worldToLocal(tmp);
          const awake = a.cheer || a.calm || a.verb === "GET UP" && a.main && a.main.time > .35 * a.main.getClip().duration;
          fx.pillow.position.set(tmp.x, .25, tmp.z);
          fx.pillow.visible = true;
          fx.zs.forEach(z => { const p = (T * .45 + z.userData.k) % 1; z.visible = a.verb === "SLEEP" && !awake; z.position.set(tmp.x + .1 + p * .35, tmp.y + .25 + p * .75, tmp.z); z.scale.setScalar(.14 + p * .2); z.material.opacity = Math.sin(p * Math.PI); });
        }
      });
      // สปอตไลต์
      if (spotT > 0) { spotT += dt; spot.intensity = Math.min(1, spotT * 3) * 7; beam.visible = true; beamMat.uniforms.uO.value = Math.min(1, spotT * 3);
        const wp = new THREE.Vector3(); slots[spotSlot].g.getWorldPosition(wp); beam.position.set(wp.x, 3, wp.z); }
      else if (spotT < 0) { spot.intensity = Math.max(0, spot.intensity - dt * 20); beamMat.uniforms.uO.value = Math.max(0, beamMat.uniforms.uO.value - dt * 3); if (beamMat.uniforms.uO.value <= 0) { beam.visible = false; spotT = 0; spotSlot = -1; } }
      // พลุกระดาษ
      if (conf.count) { let alive2 = 0;
        parts.forEach((p, i) => { p.life -= dt; if (p.life > 0) alive2++; p.v.y -= 6 * dt; p.v.multiplyScalar(1 - dt * 1.4); p.p.addScaledVector(p.v, dt); if (p.p.y < .02) { p.p.y = .02; p.v.set(0, 0, 0); }
          p.r.x += p.w * dt; p.r.y += p.w * .7 * dt; dummy.position.copy(p.p); dummy.rotation.copy(p.r); dummy.scale.setScalar(p.life > 0 ? Math.min(1, p.life * 2) : .0001); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix); });
        conf.instanceMatrix.needsUpdate = true; if (!alive2) conf.count = 0; }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    ready.then(() => {
      if (!alive) return;
      const n = avail.filter(w => usable(w.word.toUpperCase())).length;
      if (!n) { setHud(h => ({ ...h, loading:false, err:"ยังไม่มีคำในหมวดนี้ที่มีท่าทาง 3 มิติ" })); return; }
      setLayout(3, true);
      // ฉากตัวอย่างหลังปุ่มเริ่ม: ตัวละคร 3 ตัวทำท่า (ยังไม่มีโจทย์)
      const demo = cast(pick(ACTION_VERBS.filter(usable)));
      Promise.all(demo.map((c, i) => makeActor(i, c.skin, c.verb))).then(made => { if (!alive) { made.forEach(removeActor); return; } made.forEach((a, i) => { slots[i].actor = a; a.pop = -i * .12; }); pendingSwap = { old:[], made }; });
      setHud(h => ({ ...h, loading:false }));
    });

    if (typeof window !== "undefined" && window.__ASDBG) window.__AS = { G, slots, active, camera, renderer, answer, swapSlots,
      correctSlot: () => slots.findIndex((s, i) => i < nSlots && s.actor && G.target && s.actor.verb === G.target.word.toUpperCase()),
      screenOf: i => { const p = new THREE.Vector3(); slots[i].g.getWorldPosition(p); p.y = .9 * slots[i].g.scale.y; p.project(camera); const r = renderer.domElement.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; } };
    api.current.start = () => {
      if (G.started) return; G.started = true; G.queue = targetsQueue(); hudSync({ banner:{ kind:"start", title:`ด่าน 1 · ${LEVELS[0].name}`, sub:LEVELS[0].sub, id:Math.random() } });
      later(() => hudSync({ banner:null }), 1600); nextRound(true);
    };
    api.current.pause = p => { if (G.over || !G.started) return; G.paused = p; setHud(h => ({ ...h, paused:p })); };
    api.current.end = () => finish(true);

    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener("pointerdown", onDown);
      slots.forEach(s => removeActor(s.actor)); if (pendingSwap) { pendingSwap.old.forEach(removeActor); }
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
      Object.values(cache).forEach(p => p.then(g => g?.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); })));
      zTex.dispose(); env?.dispose?.(); kit?.dispose?.(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []); // eslint-disable-line

  const tk = ui.tokens;
  const btn = { minHeight:64, minWidth:200, borderRadius:32, border:"none", background:tk.primary, color:tk.onPrimary, fontSize:22, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, fontFamily:"inherit" };
  const started = hud.on || hud.round > 0;
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const prog = Math.min(1, Math.max(0, (hud.round - (hud.target ? 1 : 0)) / TOTAL));
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:6 }}>
      <style>{`@keyframes asPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}20%{transform:translate(-50%,-50%) scale(1.08);opacity:1}30%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
      {hud.target && hud.on && <Prompt w={hud.target} onClick={() => ui.say(hud.target)} />}
      <div style={{ position:"relative", height:started ? "min(54vh, 540px)" : "min(62vh, 600px)", minHeight:300, borderRadius:28, overflow:"hidden", background:"#bfe3ff" }}>
        <div ref={host} data-actionstage3d style={{ position:"absolute", inset:0 }} />
        {hud.on && <>
          <div data-hud style={{ position:"absolute", left:10, top:10, padding:"6px 12px 8px", borderRadius:18, background:tk.card, color:tk.ink, fontWeight:900, fontSize:14, boxShadow:tk.shadow, pointerEvents:"none", minWidth:150 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}><span>ด่าน {hud.level + 1}/{LEVELS.length}</span><span>⏱ {mmss(hud.sec || 0)}</span></div>
            <div style={{ position:"relative", height:8, borderRadius:4, background:tk.ink, marginTop:5, overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:tk.card, opacity:.75 }} />
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${prog * 100}%`, background:tk.primary, transition:"width .4s" }} />
            </div>
            <div style={{ fontSize:12, marginTop:3, fontWeight:800 }}>🎬 {Math.min(hud.round, TOTAL)}/{TOTAL} · ⭐ {hud.score}</div>
          </div>
          <button aria-label="พัก" className="m3-press" onClick={() => api.current.pause?.(true)} style={{ position:"absolute", right:10, top:10, width:48, height:48, borderRadius:24, border:"none", background:tk.card, color:tk.ink, fontSize:22, fontWeight:900, boxShadow:tk.shadow, cursor:"pointer", fontFamily:"inherit" }}>⏸</button>
        </>}
        {hud.banner && <div key={hud.banner.id} style={{ position:"absolute", left:"50%", top:"50%", width:"min(86%, 340px)", padding:"14px 16px", borderRadius:28, background:hud.banner.kind === "done" ? tk.primary : tk.card, color:hud.banner.kind === "done" ? tk.onPrimary : tk.ink,
          boxShadow:tk.shadow, textAlign:"center", pointerEvents:"none", animation:"asPop .5s ease-out forwards", boxSizing:"border-box" }}>
          <div style={{ fontWeight:900, fontSize:hud.banner.kind === "start" ? 22 : 26, lineHeight:1.2 }}>{hud.banner.title}</div>
          {hud.banner.stars != null && <div style={{ fontSize:34, marginTop:4, letterSpacing:4 }}>{"⭐".repeat(hud.banner.stars)}<span style={{ opacity:.3 }}>{"⭐".repeat(3 - hud.banner.stars)}</span></div>}
          {hud.banner.sub && <div style={{ fontWeight:800, fontSize:15, marginTop:6 }}>{hud.banner.sub}</div>}
        </div>}
        {hud.on && hud.paused && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:16 }}>
          <div style={{ color:"#fff", fontWeight:900, fontSize:26 }}>⏸ พักก่อน</div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>⭐ {hud.score} · ⏱ {mmss(hud.sec || 0)}</div>
          <button className="m3-press" onClick={() => api.current.pause?.(false)} style={btn}>▶ เล่นต่อ</button>
          <button className="m3-press" onClick={() => api.current.end?.()} style={{ ...btn, minHeight:52, fontSize:18, background:tk.card, color:tk.ink }}>🏁 จบเกม</button>
        </div>}
        {!started && !hud.done && <>
          <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.5)" }}>ใครกำลังทำ?</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.65)" }}>ฟังคำ แล้วแตะตัวที่ทำท่านั้น 👆</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.65)", marginTop:2 }}>{LEVELS.length} ด่าน · เพื่อนมาเพิ่มเรื่อยๆ!</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"30px 12px 16px", display:"flex", justifyContent:"center", background:"linear-gradient(180deg, transparent, rgba(0,0,0,.35))" }}>
            {hud.err ? <div style={{ background:tk.card, color:tk.ink, borderRadius:20, padding:"12px 16px", fontWeight:800, textAlign:"center" }}>{hud.err}</div>
              : <button disabled={hud.loading} onClick={() => { ui.unlock?.(); sfx.tap?.(); api.current.start?.(); }} className="m3-press" style={{ ...btn, opacity:hud.loading ? .7 : 1 }}>{hud.loading ? "กำลังโหลด…" : "▶ เริ่ม!"}</button>}
          </div>
        </>}
      </div>
    </div>
  );
}
