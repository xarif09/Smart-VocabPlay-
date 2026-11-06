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
const ROUNDS = 8;

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

const SLOT_X = [-1.72, 0, 1.72];
const PLAT_COLORS = ["#ff7aa2", "#ffd166", "#6ec6ff"];
const H_TARGET = 1.55;                                            // ความสูงตัวละครหลังปรับขนาด

const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export default function ActionStage3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const [hud, setHud] = useState({ on:false, round:0, score:0, target:null, loading:true, err:null, done:false });
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

    let env = null, kit = null;
    setupEnvironment({ THREE, renderer, scene, theme:"park", BASE }).then(e => {
      if (!alive) { e.dispose(); return; } env = e;
      ground.material = e.groundMaterial; { const u = e.groundMaterial.userData?.uniforms; if (u?.uTintStrength) u.uTintStrength.value = .75; }
      if (e.hasSky) scene.fog.color.copy(e.fogColor);
      sun.color.copy(e.sunColor); sun.intensity = e.sunIntensity * .95; hemi.intensity = e.hemiIntensity + .25;
      const d = e.sunDir.clone(); d.y = Math.max(d.y, .55); d.normalize(); sun.position.copy(d.multiplyScalar(12)); // ไฟส่องจากด้านหน้า-บน
    }).catch(() => {});
    loadPropKit({ THREE, theme:"park", BASE, renderer }).then(k => {
      if (!alive) { k.dispose(); return; } kit = k;
      const spots = [[-7.5, -6], [-4, -8.5], [0.5, -10], [4.5, -8], [8, -5.5], [-10, -2], [10.5, -1.5], [-2.5, -13], [7, -12], [-6.5, -12.5], [12, -9], [-12, -8]];
      spots.forEach(([x, z], i) => {
        let kind = k.kinds[i % k.kinds.length]; if (i < 5 && kind === "painted_wooden_bench" && i !== 1) kind = "tree";
        const o = k.spawn(kind, Math.random()); o.position.set(x + (Math.random() - .5), 0, z + (Math.random() - .5)); o.rotation.y = kind === "painted_wooden_bench" ? Math.atan2(-x, -z) + Math.PI : Math.random() * 6;
        o.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
        scene.add(o);
      });
      for (let i = 0; i < 6; i++) { if (!k.variants?.flowers?.length) break; const o = k.spawn("flowers", Math.random()); o.position.set((i - 2.5) * 2.4 + (Math.random() - .5), 0, -3.2 - Math.random() * 1.2); scene.add(o); }
    }).catch(() => {});

    // ── แท่นกลม 3 แท่น ──
    const slots = SLOT_X.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, i === 1 ? -.25 : .15); scene.add(g);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.82, .9, .16, 48), new THREE.MeshStandardMaterial({ color:"#ffffff", roughness:.45 }));
      base.position.y = .08; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .04, 48), new THREE.MeshStandardMaterial({ color:PLAT_COLORS[i], roughness:.4, emissive:PLAT_COLORS[i], emissiveIntensity:0 }));
      top.position.y = .17; top.receiveShadow = true; g.add(top);
      const ringMat = new THREE.MeshBasicMaterial({ color:"#fff3a0", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending });
      const ring = new THREE.Mesh(new THREE.RingGeometry(.74, 1.05, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .2; g.add(ring);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, 2.1, 12), new THREE.MeshBasicMaterial({ visible:false })); hit.position.y = 1.05; hit.userData.slot = i; g.add(hit);
      return { g, top, ring, hit, actor:null, hint:0, bad:0 };
    });

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
          const sx = slotIdx === 0 ? .45 : slotIdx === 2 ? -.45 : .3;
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
    function cast(target) {
      const verbs = [target];
      const conflicts = v => verbs.some(x => x === v || CONFLICT.some(c => c.includes(x) && c.includes(v)) || (ONLY_ROBOT(x) && ONLY_ROBOT(v)));
      for (const v of shuffle(ACTION_VERBS)) { if (verbs.length >= 3) break; if (usable(v) && !conflicts(v)) verbs.push(v); }
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

    // ── เกม ──
    const G = { round:0, score:0, target:null, cast:[], wrong:0, busy:true, started:false, queue:[] };
    const targetsQueue = () => { const pool = shuffle(avail.filter(w => usable(w.word.toUpperCase()))); const out = []; let last = null;
      while (out.length < ROUNDS && pool.length) { const c = shuffle(pool); for (const w of c) { if (out.length >= ROUNDS) break; if (w === last && pool.length > 1) continue; out.push(w); last = w; } } return out; };
    let pendingSwap = null;
    async function setupRound(word) {
      const verb = word.word.toUpperCase();
      const lineup = cast(verb);
      const old = slots.map(s => s.actor);
      slots.forEach(s => { s.actor = null; s.hint = 0; });
      old.forEach(a => { if (a) a.leaving = 1; });
      const made = await Promise.all(lineup.map((c, i) => makeActor(i, c.skin, c.verb)));
      if (!alive) { made.forEach(removeActor); return; }
      pendingSwap = { old, made };
      made.forEach((a, i) => { slots[i].actor = a; a.pop = -i * .12; });
      G.cast = lineup; G.target = word; G.wrong = 0;
    }
    const nextRound = (first) => {
      if (G.round >= ROUNDS || !G.queue.length) return finish();
      const w = G.queue.shift(); G.round++; G.busy = true;
      setHud(h => ({ ...h, on:true, round:G.round, target:w }));
      if (first) ui.say(w);                                       // คำแรก: พูดตรงในคลิก (iOS)
      setupRound(w).then(() => { if (!alive) return; G.busy = false; if (!first) ui.say(w); });
    };
    const finish = () => {
      G.busy = true; G.over = true; setHud(h => ({ ...h, on:false, done:true }));
      setTimeout(() => { if (alive) track.finish(G.score, ROUNDS, { label:`ตอบถูก ${G.score}/${ROUNDS} ท่า` }); }, 900);
    };
    let spotT = 0, spotSlot = -1;
    const answer = i => {
      if (G.busy || G.over || !G.target) return;
      const s = slots[i]; const a = s.actor; if (!a || a.shake > .3) return;
      const ok = a.verb === G.target.word.toUpperCase();
      if (ok) {
        G.busy = true; if (G.wrong === 0) { G.score++; ui.correct(G.target); } sfx.ok?.(); setTimeout(() => sfx.win?.(), 120);
        setHud(h => ({ ...h, score:G.score }));
        const wp = new THREE.Vector3(); s.g.getWorldPosition(wp); burst(wp.x, wp.z);
        spotT = 0.0001; spotSlot = i; spot.position.set(wp.x * .6, 7, 2.4); spot.target.position.copy(wp);
        if (a.cheerA) { a.cheer = true; a.fx?.ball && (a.fx.ball.visible = false); a.main?.fadeOut(.25); a.cheerA.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(.25).play(); }
        slots.forEach((o, j) => { const b = o.actor; if (j !== i && b && b.idle) { b.main?.fadeOut(.4); b.idle.reset().fadeIn(.4).play(); b.calm = true; } });
        setTimeout(() => { if (!alive) return; spotT = -1; nextRound(false); }, 2600);
      } else {
        G.wrong++; sfx.bad?.(); ui.wrong(G.target); a.shake = 1; s.bad = 1;
        if (G.wrong >= 2) slots.forEach(o => { if (o.actor && o.actor.verb === G.target.word.toUpperCase()) o.hint = 1; });
        setTimeout(() => { if (alive && !G.over) ui.say(G.target); }, 700);
      }
    };

    // ── แตะ ──
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const onDown = e => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(slots.map(s => s.hit), false);
      let i = hits.length ? hits[0].object.userData.slot : -1;
      if (i < 0) { // แตะใกล้ๆ ก็นับ: เลือกแท่นที่ใกล้จุดแตะที่สุดบนจอ
        let best = 1e9; slots.forEach((s, j) => { const p = new THREE.Vector3(); s.g.getWorldPosition(p); p.y = .9; p.project(camera); const d = Math.hypot(p.x - ptr.x, (p.y - ptr.y) * .6); if (d < best && d < .35) { best = d; i = j; } });
      }
      if (i >= 0) answer(i);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);

    // ── ขนาดจอ / กล้อง ──
    const fit = () => {
      const w = el.clientWidth || 360, h = el.clientHeight || 400; renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const halfW = 2.5, needH = 1.25;                            // ครึ่งความกว้างฉากที่ต้องเห็น · ครึ่งความสูง
      const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const d = Math.max(halfW / (tv * camera.aspect), needH / tv) + .8;
      camera.position.set(0, .9 + d * .2, d); look.set(0, .62, 0); camera.lookAt(look); camera.updateProjectionMatrix();
    };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);

    // ── วงจร ──
    const clock = new THREE.Clock(); const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dtR = Math.min(.25, clock.getDelta()), dt = Math.min(.05, dtR), T = clock.elapsedTime;
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
      // ฉากตัวอย่างหลังปุ่มเริ่ม: ตัวละคร 3 ตัวทำท่า (ยังไม่มีโจทย์)
      const demo = cast(pick(ACTION_VERBS.filter(usable)));
      Promise.all(demo.map((c, i) => makeActor(i, c.skin, c.verb))).then(made => { if (!alive) { made.forEach(removeActor); return; } made.forEach((a, i) => { slots[i].actor = a; a.pop = -i * .12; }); pendingSwap = { old:[], made }; });
      setHud(h => ({ ...h, loading:false }));
    });

    if (typeof window !== "undefined" && window.__ASDBG) window.__AS = { show: verbs => { const old = slots.map(s => s.actor); slots.forEach(s => { s.actor = null; }); old.forEach(a => { if (a) a.leaving = 1; });
      return Promise.all(verbs.map((v, i) => makeActor(i, cast(v)[0].skin === "robot" && !optionsFor(v).some(o => o.model === "robot") ? "knight" : (optionsFor(v)[0].model === "kaykit" ? KAYKIT[i] : optionsFor(v)[0].model), v))).then(made => { made.forEach((a, i) => { slots[i].actor = a; a.pop = 0; }); pendingSwap = { old, made }; }); } };
    api.current.start = () => {
      if (G.started) return; G.started = true; G.queue = targetsQueue(); nextRound(true);
    };

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
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:6 }}>
      {hud.target && hud.on && <Prompt w={hud.target} onClick={() => ui.say(hud.target)} />}
      <div style={{ position:"relative", height:started ? "min(52vh, 520px)" : "min(62vh, 600px)", minHeight:300, borderRadius:28, overflow:"hidden", background:"#bfe3ff" }}>
        <div ref={host} data-actionstage3d style={{ position:"absolute", inset:0 }} />
        {hud.on && <div style={{ position:"absolute", left:12, top:10, right:12, display:"flex", justifyContent:"space-between", pointerEvents:"none", fontWeight:900, fontSize:16, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.55)" }}>
          <span>🎬 {Math.min(hud.round, ROUNDS)}/{ROUNDS}</span><span>⭐ {hud.score}</span>
        </div>}
        {!started && !hud.done && <>
          <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.5)" }}>ใครกำลังทำ?</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.65)" }}>ฟังคำ แล้วแตะตัวที่ทำท่านั้น 👆</div>
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
