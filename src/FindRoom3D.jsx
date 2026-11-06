// Find It! 3D — หาของในห้องรก: ฟังคำ แล้วแตะของชิ้นนั้นในห้อง 3 มิติ (three.js โหลดเฉพาะตอนเปิดเกม)
// ห้อง: นั่งเล่น+ครัว (home) · ห้องของเล่น (toys) · ห้องเรียน (school) · ห้องนอน (clothes)
// โมเดล CC0 (KayKit · Quaternius · Poly Haven · Khronos) + ของปั้นด้วยโค้ด · ดู public/models/room/CREDITS.md
// สีในโลก 3D เป็นงานศิลป์ของฉาก · ปุ่ม/HUD ใช้ ui.tokens
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ROOMS, CATALOG, CAT_ROOM, FIND_ROOM_WORDS } from "./findroom/rooms.js";
import { makeProcedural } from "./findroom/procedural.js";

export { FIND_ROOM_WORDS };

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
// 4 ด่าน (~33 ชิ้น ≈ 5–6 นาที): show = สัดส่วนของชิ้นเล็กที่โผล่ในห้อง · scatter = ลมพัดของบนพื้นสลับที่ · plan: S = หา 1 อย่าง, T = หา 3 อย่าง
const LEVELS = [
  { name:"ห้องเริ่มรก", sub:"", show:.45, scatter:false, plan:["S", "S", "S", "S", "S", "S"] },
  { name:"รกขึ้นอีก!", sub:"🌪️ ลมพัดของกระจาย · ของโผล่มาเพิ่ม", show:.75, scatter:true, plan:["S", "S", "S", "S", "S", "S", "S"] },
  { name:"รกสุดๆ!", sub:"🔎 มีรอบหา 3 อย่าง!", show:1, scatter:true, plan:["S", "S", "T", "S", "S", "T"] },
  { name:"ภารกิจหา 3 อย่าง", sub:"🌙 ตอนเย็นแล้ว · หาให้ครบ!", show:1, scatter:true, plan:["T", "T", "S", "T"] },
];
const RW = 3, RD = 2.5, RH = 2.7;            // ครึ่งกว้าง · ครึ่งลึก · สูง (เมตร)
const LOOK = new THREE.Vector3(0, .32, -.75);
const norm = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
const DEG = Math.PI / 180;

// ห้องที่เหมาะกับหมวด: ตามตาราง หรือห้องที่มีคำตรงกับคำในหมวดมากที่สุด
function pickRoom(catId, words) {
  if (CAT_ROOM[catId]) return CAT_ROOM[catId];
  const have = new Set(words.map(w => norm(w.word)));
  let best = "kidroom", n = -1;
  for (const [k, r] of Object.entries(ROOMS)) { const c = r.items.filter(it => (it[3]?.w || []).some(x => have.has(norm(x)))).length; if (c > n) { n = c; best = k; } }
  return best;
}

const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const glowTexture = () => canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });

// วงแหวนเรืองแสง: uP = ความยาวเส้นที่วาดแล้ว (0..1), uPulse = โหมดกะพริบ (คำใบ้)
function ringMaterial(color) {
  return new THREE.ShaderMaterial({ transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    uniforms:{ uP:{ value:0 }, uT:{ value:0 }, uA:{ value:1 }, uColor:{ value:new THREE.Color(color) }, uPulse:{ value:0 } },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec2 vUv; uniform float uP, uT, uA, uPulse; uniform vec3 uColor;
      void main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=atan(p.x,p.y)/6.2831853+.5;
        float w=.055+.02*uPulse*sin(uT*8.);
        float edge=smoothstep(1.,.93,r); float band=smoothstep(w,0.,abs(r-.84))*edge; float glow=smoothstep(.13,0.,abs(r-.84))*.5*edge;
        float dash=uPulse>.5 ? .6+.4*step(.5,fract(a*14.-uT*1.5)) : 1.;
        float m=step(a,uP)*(band+glow)*dash;
        float head=uPulse>.5 ? 0. : smoothstep(.09,0.,length(p-vec2(sin((uP-.5)*6.2831853),cos((uP-.5)*6.2831853))*.84))*edge*step(uP,.999);
        vec3 c=mix(uColor, vec3(1.), band*.55+head);
        gl_FragColor=vec4(c*(m+head*1.5)*uA, 1.); }` });
}

export default function FindRoom3D({ words = [], speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const roomKey = useRef(pickRoom(catId, words)).current;
  const room = ROOMS[roomKey];
  const [hud, setHud] = useState({ load:0, ready:false, on:false, level:0, lr:0, nr:0, found:0, total:0, sec:0, score:0, target:null, multi:null, banner:null, paused:false, msg:null, bubble:null, done:false });

  useEffect(() => {
    const el = host.current; if (!el) return;
    let alive = true;
    const timers = new Set();
    const W = () => Math.max(1, el.clientWidth), H = () => Math.max(1, el.clientHeight);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
      if (!renderer.getContext()) throw new Error("no gl");
    } catch (e) { setHud(h => ({ ...h, msg:"อุปกรณ์นี้เปิดภาพ 3 มิติไม่ได้ 😢 ลองเกมอื่นนะ" })); return; }
    renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    renderer.setSize(W(), H());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a2320");
    const camera = new THREE.PerspectiveCamera(55, W() / H(), .05, 60);
    const owned = new Set(); const keep = x => { if (x) owned.add(x); return x; };

    // ── แสง: IBL ห้อง + แดดลอดหน้าต่าง + ไฟเพดานโทนอุ่น ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = keep(pmrem.fromScene(new RoomEnvironment(), .04)); pmrem.dispose();
    scene.environment = envRT.texture; scene.environmentIntensity = .42;
    scene.add(new THREE.HemisphereLight("#fff4e2", "#7a5c44", .55));
    const winSide = room.window || "left";
    const sun = new THREE.DirectionalLight("#ffe7c2", 3.2);
    sun.position.set(...(winSide === "left" ? [-9, 5.2, 1.5] : [1.5, 5.2, -9])); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
    Object.assign(sun.shadow.camera, { left:-5, right:5, top:5, bottom:-5, near:1, far:22 }); sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    const lamp = new THREE.PointLight("#ffd29e", 9, 0, 2); lamp.position.set(0, 2.4, .2); scene.add(lamp);
    const fill = new THREE.PointLight("#ffe9d0", 4, 0, 2); fill.position.set(0, 1.8, 3.2); scene.add(fill);

    // ── วัสดุผนัง/พื้น (Poly Haven CC0) ──
    const texLoader = new THREE.TextureLoader();
    let aniso = 4; try { aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1); } catch (e) {}
    const loadTex = (url, srgb, rep) => { const t = keep(texLoader.load(url, undefined, undefined, () => {})); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; };
    const T = id => `${BASE}models/room/tex/${id}`;
    const fr = room.floorRep || 3;
    const floorMat = new THREE.MeshStandardMaterial({ map:loadTex(T(`${room.floor}_diff.jpg`), true, [fr, fr * RD / RW]), normalMap:loadTex(T(`${room.floor}_nor.jpg`), false, [fr, fr * RD / RW]),
      roughnessMap:loadTex(T(`${room.floor}_rough.jpg`), false, [fr, fr * RD / RW]), roughness:1, metalness:0 });
    const plaster = (color) => new THREE.MeshStandardMaterial({ color, normalMap:loadTex(T("painted_plaster_wall_nor.jpg"), false, [1, 1]),
      normalScale:new THREE.Vector2(.35, .35), roughness:.92, metalness:0, shadowSide:THREE.DoubleSide });
    const shell = new THREE.Group(); scene.add(shell);
    const ZC = .45;                                            // side walls / floor reach a bit past the open front (z = RD) so the camera never sees the edge
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2 + ZC * 2), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = ZC; floor.receiveShadow = true; shell.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2 + .2, RD * 2 + ZC * 2 + .2), new THREE.MeshStandardMaterial({ color:"#f6efe6", roughness:.95, shadowSide:THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, RH, ZC); ceil.castShadow = true; shell.add(ceil);
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, .06, 32), new THREE.MeshStandardMaterial({ color:"#fff", emissive:"#ffe2b8", emissiveIntensity:2.2 }));
    lampShade.position.set(0, RH - .03, .2); shell.add(lampShade);

    // ── สร้างผนัง (เจาะช่องหน้าต่าง) หลังจากวางของแล้ว ──
    const buildWalls = holes => {
      // wall local frame: x along the wall, y up; returns mesh placed into room
      const wall = (len, side, color) => {
        const s = new THREE.Shape(); s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, RH); s.lineTo(-len / 2, RH); s.closePath();
        (holes[side] || []).forEach(([a, b, y0, y1]) => { const hp = new THREE.Path(); hp.moveTo(a, y0); hp.lineTo(a, y1); hp.lineTo(b, y1); hp.lineTo(b, y0); hp.closePath(); s.holes.push(hp); });
        const geo = new THREE.ShapeGeometry(s); const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2.2, p.getY(i) / 2.2);
        const m = new THREE.Mesh(geo, plaster(color)); m.receiveShadow = true; m.castShadow = true;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(len, .1, .025), new THREE.MeshStandardMaterial({ color:room.trim || "#fff", roughness:.5 })); trim.position.set(0, .05, .012); trim.receiveShadow = true;
        const g = new THREE.Group(); g.add(m, trim);
        if (side === "back") g.position.z = -RD; else if (side === "left") { g.rotation.y = Math.PI / 2; g.position.set(-RW, 0, ZC); } else { g.rotation.y = -Math.PI / 2; g.position.set(RW, 0, ZC); }
        shell.add(g);
      };
      wall(RW * 2, "back", room.wall); wall(RD * 2 + ZC * 2, "left", room.wallR || room.wall); wall(RD * 2 + ZC * 2, "right", room.wallR || room.wall);
      // the view outside every window: a slice of the park sky photo + a sunny lawn strip
      for (const side of Object.keys(holes)) for (const [a, b, y0, y1] of holes[side]) {
        const sky = keep(texLoader.load(`${BASE}3d/sky/park.jpg`)); sky.colorSpace = THREE.SRGBColorSpace; sky.repeat.set(.16, .3); sky.offset.set(.32, .42);
        const v = new THREE.Mesh(new THREE.PlaneGeometry((b - a) + 1.6, (y1 - y0) + 1.2), new THREE.MeshBasicMaterial({ map:sky, color:"#ffffff", toneMapped:false }));
        const c = (a + b) / 2, cy = (y0 + y1) / 2;
        if (side === "back") v.position.set(c, cy, -RD - .9); else if (side === "left") { v.rotation.y = Math.PI / 2; v.position.set(-RW - .9, cy, ZC - c); } else { v.rotation.y = -Math.PI / 2; v.position.set(RW + .9, cy, c + ZC); }
        shell.add(v);
      }
    };

    // ── โหลดโมเดล ──
    const gltfLoader = new GLTFLoader();
    const files = [...new Set(room.items.map(it => CATALOG[it[0]]?.f).filter(Boolean))];
    let loaded = 0; const gltfs = {};
    const fabric = { nor:null, denim:null };
    const loadAll = Promise.all(files.map(f => gltfLoader.loadAsync(`${BASE}models/room/${f}${f.endsWith(".glb") ? "" : ".glb"}`)
      .then(g => { gltfs[f] = g; }).catch(() => { gltfs[f] = null; })
      .finally(() => { loaded++; if (alive) setHud(h => ({ ...h, load:loaded / files.length })); })));
    if (room.items.some(it => CATALOG[it[0]]?.p)) {
      fabric.nor = loadTex(T("denim_fabric_nor.jpg"), false, [3, 3]);
      fabric.denim = loadTex(T("denim_fabric_diff.jpg"), true, [2, 2]);
    }

    const itemsGroup = new THREE.Group(); scene.add(itemsGroup);
    const items = []; const byId = {}; const mixers = [];
    const procTex = [];

    const fit = (obj, spec) => {
      const inner = new THREE.Group(); inner.add(obj); obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const s = spec.h ? spec.h / Math.max(1e-4, sz.y) : (spec.l || .3) / Math.max(1e-4, sz.x, sz.y, sz.z);
      const sx = spec.sx || 1; obj.scale.multiplyScalar(s); obj.scale.x *= sx; obj.position.set(-c.x * s * sx, -b.min.y * s, -c.z * s);
      return inner;
    };
    const build = () => {
      const holes = {};
      for (const [key, px, pz, o = {}] of room.items) {
        const spec = CATALOG[key]; if (!spec) continue;
        let obj = null;
        if (spec.p) obj = makeProcedural(THREE, spec.p, { ...(spec.opts || {}), owned:procTex, fabricNor:fabric.nor, denim:spec.opts?.denim ? fabric.denim : null });
        else { const g = gltfs[spec.f]; if (!g) continue; obj = skClone(g.scene);
          if (spec.anim && g.animations?.length) { const mx = new THREE.AnimationMixer(obj); const clip = g.animations.find(a => a.name === spec.anim) || g.animations[0]; mx.clipAction(clip).play(); mixers.push(mx); } }
        obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.isSkinnedMesh) m.frustumCulled = false;
          if (spec.color) { m.material = m.material.clone(); m.material.color.set(spec.color); } } });
        const inner = fit(obj, spec);
        const pivot = new THREE.Group(); pivot.add(inner);
        const root = new THREE.Group(); root.add(pivot);
        const tilt = o.tilt || [0, 0]; pivot.rotation.set(tilt[0] * DEG, 0, tilt[1] * DEG);
        let ry = (o.ry || 0) * DEG;
        if (o.wall === "left") ry = Math.PI / 2 + (o.ry || 0) * DEG; else if (o.wall === "right") ry = -Math.PI / 2 + (o.ry || 0) * DEG;
        root.rotation.y = ry; root.updateMatrixWorld(true);
        const b0 = new THREE.Box3().setFromObject(root), c0 = b0.getCenter(new THREE.Vector3()), s0 = b0.getSize(new THREE.Vector3());
        let x = px, z = pz, y = o.y ?? 0;
        if (o.on && byId[o.on]) { const ref = byId[o.on]; const at = o.at ?? CATALOG[ref.key].top ?? 1; y = ref.box.min.y + (ref.box.max.y - ref.box.min.y) * at; }
        const push = o.push || 0;
        if (o.wall === "back") z = -RD + s0.z / 2 + .004 + push;
        else if (o.wall === "left") x = -RW + s0.x / 2 + .004 + push;     // side walls: position along the wall = pz
        else if (o.wall === "right") x = RW - s0.x / 2 - .004 - push;
        root.position.set(x - c0.x, y - b0.min.y, z - c0.z);
        itemsGroup.add(root); root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const it = { key, root, box, base:root.position.clone(), baseRot:root.rotation.clone(), words:(o.w || []).map(norm), wordsRaw:o.w || [], big:!!o.big, hop:0, shake:0, opt:o, spot:new THREE.Vector3(x, 0, z), hidden:false, pop:1, fly:null, asked:0 };
        it.center = box.getCenter(new THREE.Vector3()); it.radius = Math.max(.09, box.getSize(new THREE.Vector3()).length() / 2);
        root.traverse(m => { if (m.isMesh) m.userData.item = it; });
        items.push(it); if (o.id) byId[o.id] = it;
        // window → hole in the wall
        if (spec.f && /window/.test(spec.f) && o.wall) {
          const m = .03;
          if (o.wall === "back") (holes.back ||= []).push([box.min.x + m, box.max.x - m, box.min.y + m, box.max.y - m]);
          else if (o.wall === "left") (holes.left ||= []).push([ZC - box.max.z + m, ZC - box.min.z - m, box.min.y + m, box.max.y - m]);
          else (holes.right ||= []).push([box.min.z - ZC + m, box.max.z - ZC - m, box.min.y + m, box.max.y - m]);
        }
      }
      buildWalls(holes);
    };

    // ── เกม: 4 ด่าน ห้องรกขึ้นเรื่อยๆ (ของโผล่เพิ่ม + ลมพัดของสลับที่) · ด่านหลังมีรอบ "หา 3 อย่าง" ──
    const S = { started:false, over:false, paused:false, level:-1, lr:0, rounds:[], round:null, focus:0, score:0, done:0, n:0, busy:false, t:0, gt:0, playT:0, sec:-1, yaw:0, pitch:0, zoom:1, bigUsed:0, lvClean:0, lvTotal:0 };
    const wordMap = new Map(); words.forEach(w => { const k = norm(w.word); if (!wordMap.has(k)) wordMap.set(k, w); });
    const shuffle = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    // เวลาเกม (หยุดเมื่อพัก) · window.__VP_FAST = เร่งจังหวะสำหรับชุดทดสอบ
    const FAST = (typeof window !== "undefined" && +window.__VP_FAST) || 1;
    const events = [];
    const later = (fn, ms) => { events.push({ at:S.gt + ms / 1000 / FAST, fn }); };
    const FIXED = new Set(["bed", "couch", "chair", "table", "tvstand", "lampstand", "wallshelf", "bookshelf", "rugstripes", "rugoval", "rugrect", "picture", "plant", "fridge", "sink", "stove", "curtains", "window", "window2", "door", "dresser", "nightstand", "desk", "schoolchair", "chalkboard", "mirror", "map", "lamptable", "booksdeco", "pillowb", "clock"]);
    const wordOf = it => wordMap.get(it.words.find(k => wordMap.has(k)));
    let hideable = [], floorItems = [];
    const classify = () => {
      const supports = new Set(room.items.map(r => r[3]?.on).filter(Boolean));
      for (const it of items) {
        const o = it.opt || {};
        it.fixed = it.big || FIXED.has(it.key) || (o.id && supports.has(o.id));
        it.floor = !it.fixed && !o.on && !o.wall && o.y == null && it.radius < .62;
      }
      hideable = items.filter(it => !it.fixed); floorItems = items.filter(it => it.floor);
    };
    const totalTargets = LEVELS.reduce((a, L) => a + L.plan.reduce((b, k) => b + (k === "T" ? 3 : 1), 0), 0);
    // เลือกของที่จะให้หาในด่าน (ของที่ยังไม่เคยถามมาก่อน → ของที่ถามน้อยสุด)
    const pickTargets = (n, avoid) => {
      const cands = items.filter(it => !it.hidden && wordOf(it) && !avoid.has(it) && (!it.big || S.bigUsed < 3));
      const seenW = new Set([...avoid].map(it => norm(wordOf(it)?.word)));
      const out = [];
      for (const it of shuffle(cands).sort((a, b) => a.asked - b.asked)) {
        if (out.length >= n) break; const k = norm(wordOf(it).word); if (seenW.has(k)) continue;
        seenW.add(k); out.push(it); if (it.big) S.bigUsed++;
      }
      return out;
    };
    const planLevel = L => {
      const rounds = []; const used = new Set();
      for (const k of L.plan) {
        const n = k === "T" ? 3 : 1;
        let got = pickTargets(n, used);
        if (got.length < n) { used.clear(); got = got.concat(pickTargets(n - got.length, new Set(got))); }
        if (!got.length) continue;
        got.forEach(it => { used.add(it); it.asked++; });
        if (k === "T" && got.length === 3) rounds.push({ kind:"three", list:got.map(it => ({ it, w:wordOf(it), found:false, misses:0 })) });
        else got.forEach(it => rounds.push({ kind:"one", list:[{ it, w:wordOf(it), found:false, misses:0 }] }));
      }
      return rounds;
    };
    const refreshBox = it => { it.root.updateMatrixWorld(true); it.box.setFromObject(it.root); it.box.getCenter(it.center); };
    // เปิดของเพิ่ม (ให้มีคำให้หาพอเสมอ) แล้วลมพัดของบนพื้นสลับที่กัน
    const messUp = (L, animate) => {
      const want = Math.ceil(hideable.length * L.show);
      let shown = hideable.filter(it => !it.hidden).length;
      const need = L.plan.reduce((b, k) => b + (k === "T" ? 3 : 1), 0);
      const hiddenC = shuffle(hideable.filter(it => it.hidden)).sort((a, b) => (wordOf(a) ? 0 : 1) - (wordOf(b) ? 0 : 1));
      let visCands = items.filter(it => !it.hidden && wordOf(it)).length;
      for (const it of hiddenC) {
        if (shown >= want && visCands >= need + 2) break;
        it.hidden = false; it.root.visible = true; shown++; if (wordOf(it)) visCands++;
        if (animate) { it.pop = 0; it.root.scale.setScalar(.001); }
      }
      if (!L.scatter) return 0;
      // จับกลุ่มของขนาดใกล้กัน แล้วสลับตำแหน่งในกลุ่ม
      const fl = floorItems.filter(it => !it.hidden).sort((a, b) => a.radius - b.radius);
      let moved = 0;
      for (let i = 0; i < fl.length; i += 4) {
        const grp = fl.slice(i, i + 4); if (grp.length < 2) continue;
        const spots = grp.map(it => it.spot.clone()); let perm = shuffle(spots.map((_, j) => j));
        if (perm.every((p, j) => p === j)) perm = perm.map((_, j) => (j + 1) % perm.length);
        grp.forEach((it, j) => {
          const to = spots[perm[j]].clone().add(new THREE.Vector3((Math.random() - .5) * .12, 0, (Math.random() - .5) * .12));
          to.x = Math.max(-RW + .3, Math.min(RW - .3, to.x)); to.z = Math.max(-RD + .3, Math.min(RD - .1, to.z));
          const d = to.clone().sub(it.spot); it.spot.copy(to);
          const end = it.base.clone().add(d);
          if (animate) { it.fly = { from:it.base.clone(), to:end, t:-Math.random() * .35, spin:(Math.random() < .5 ? -1 : 1) * Math.PI * 2 }; }
          else { it.root.position.copy(end); it.base.copy(end); refreshBox(it); }
          moved++;
        });
      }
      return moved;
    };

    // วงแหวน (3 วงสำหรับรอบหา 3 อย่าง) + คำใบ้ + ประกาย
    const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial("#fde047")); m.renderOrder = 10; m.visible = false; scene.add(m); return m; });
    const ring = rings[0];
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial("#ffffff")); hint.material.uniforms.uPulse.value = 1; hint.material.uniforms.uP.value = 1; hint.renderOrder = 9; hint.visible = false; scene.add(hint);
    const glow = keep(glowTexture());
    const hintGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:"#fff7c2", transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 })); hintGlow.renderOrder = 8; scene.add(hintGlow);
    const PN = 320, pPos = new Float32Array(PN * 3).fill(-99), pCol = new Float32Array(PN * 3), pVel = Array.from({ length:PN }, () => new THREE.Vector3()), pLife = new Float32Array(PN);
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:.09, map:glow, vertexColors:true, transparent:true, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    pts.frustumCulled = false; pts.renderOrder = 11; scene.add(pts); let pIdx = 0;
    const burst = (pos, r, n = 90) => { const C = ["#fde047", "#ffffff", "#f472b6", "#67e8f9", "#a3e635"]; for (let k = 0; k < n; k++) { const i = pIdx++ % PN;
      const d = new THREE.Vector3(Math.random() - .5, Math.random() - .2, Math.random() - .5).normalize();
      pPos.set([pos.x + d.x * r * .6, pos.y + d.y * r * .6, pos.z + d.z * r * .6], i * 3); const c = new THREE.Color(C[k % C.length]); pCol.set([c.r, c.g, c.b], i * 3);
      pVel[i].copy(d).multiplyScalar(1.2 + Math.random() * 2.2).add(new THREE.Vector3(0, 1.4, 0)); pLife[i] = .7 + Math.random() * .6; } };

    const cur = () => S.round?.list[S.focus];
    const sayTarget = () => { const c = cur(); if (c) ui.say(c.w); };
    const hudRound = (extra = {}) => setHud(h => ({ ...h, level:S.level, lr:S.lr, nr:S.rounds.length, found:S.done, score:S.score, target:cur()?.w || null,
      multi:S.round?.kind === "three" ? S.round.list.map((c, i) => ({ w:c.w, found:c.found, focus:i === S.focus })) : null, ...extra }));
    const hideRings = () => { rings.forEach(r => { r.visible = false; }); hint.visible = false; hintGlow.material.opacity = 0; };
    const nextRound = (first) => {
      if (S.over) return;
      if (S.lr >= S.rounds.length) return levelDone();
      S.round = S.rounds[S.lr]; S.lr += 1; S.focus = 0; S.busy = false;
      hideRings();
      hudRound({ bubble:null });
      S.pan = 2.6;                                  // ของอยู่นอกจอ → ค่อยๆ หันกล้องจนเห็น (แค่ขอบจอ ไม่ชี้ให้)
      if (!first) sayTarget();
    };
    const LIGHT = [["#ffe7c2", 3.2, 9], ["#fff3dc", 3.6, 8], ["#ffd9a8", 3.0, 10], ["#ffb27a", 2.2, 13]];
    S.light = 0;
    const startLevel = (k, first) => {
      S.level = k; S.lr = 0; S.lvClean = 0; S.lvTotal = 0; const L = LEVELS[k];
      S.light = k;
      const moved = messUp(L, !first);
      S.rounds = planLevel(L);
      if (!S.rounds.length) return finish();
      if (first) { hudRound({ banner:{ kind:"start", title:`ด่าน 1 · ${L.name}`, id:Math.random() } }); later(() => setHud(h => ({ ...h, banner:null })), 1700); nextRound(true); return; }
      S.busy = true; S.round = null; hideRings();
      hudRound({ target:null, multi:null, banner:{ kind:"next", title:`ด่าน ${k + 1} · ${L.name}`, sub:L.sub, id:Math.random() } });
      if (moved) { S.yaw = 0; S.pitch = 0; S.zoom = 1; }
      later(() => { setHud(h => ({ ...h, banner:null })); nextRound(false); }, moved ? 2900 : 2200);
    };
    const levelDone = () => {
      S.busy = true; S.round = null; hideRings();
      const stars = S.lvTotal ? (S.lvClean / S.lvTotal >= .9 ? 3 : S.lvClean / S.lvTotal >= .6 ? 2 : 1) : 1;
      const lastLevel = S.level >= LEVELS.length - 1;
      sfx?.win?.();
      hudRound({ target:null, multi:null, banner:{ kind:"done", title:lastLevel ? "เก่งมาก! หาครบทุกด่าน 🏆" : `ผ่านด่าน ${S.level + 1}! 🎉`, stars, id:Math.random() } });
      const spots = [[-1.6, 1.2, -1], [0, 1.6, -.6], [1.6, 1.2, -1], [0, .9, .6]];
      spots.forEach(([x, y, z], i) => later(() => burst(new THREE.Vector3(x, y, z), .5, 80), i * 260));
      later(() => { if (lastLevel) finish(); else startLevel(S.level + 1, false); }, 2900);
    };
    const finish = (early) => { if (S.over) return; S.over = true; S.round = null; hideRings();
      const total = Math.max(1, S.done);              // นับเฉพาะชิ้นที่ได้ถามจริง (จบก่อนก็ไม่เสียเปรียบ)
      setHud(h => ({ ...h, on:false, done:true, finished:true, target:null, multi:null, paused:false, banner:null }));
      setTimeout(() => { if (alive) track.finish(S.score, total, { label:`หาเจอ ${S.score}/${total} ชิ้น` }); }, early ? 50 : 900); };

    const showRing = (it, mesh, color, pulse) => {
      const r = Math.min(1.25, Math.max(.17, it.radius * 1.15 + .06));
      mesh.position.copy(it.center); mesh.scale.setScalar(r * 2); mesh.visible = true;
      mesh.material.uniforms.uColor.value.set(color); if (!pulse) mesh.material.uniforms.uP.value = 0;
    };
    const onFound = (c) => {
      const it = c.it; const R = S.round; c.found = true;
      const clean = c.misses < 2; if (clean) { S.score += 1; S.lvClean += 1; } S.lvTotal += 1; S.done += 1;
      ui.correct(c.w); const k = R.list.filter(x => x.found).length - 1;
      showRing(it, rings[Math.min(2, k)], "#fde047", false); hint.visible = false; hintGlow.material.opacity = 0;
      it.hop = 1; burst(it.center, it.radius, 120);
      const left = R.list.filter(x => !x.found);
      if (!left.length) {
        S.busy = true;
        hudRound({ bubble:{ ok:true, text:R.kind === "three" ? "ครบ 3 อย่าง! 🎉" : `${c.w.word} ✓`, id:Math.random() } });
        later(() => burst(it.center, it.radius, 60), 450);
        if (R.kind === "three") R.list.forEach((x, i) => later(() => { x.it.hop = 1; burst(x.it.center, x.it.radius, 50); }, 300 + i * 220));
        later(() => nextRound(false), R.kind === "three" ? 2400 : 1900);
      } else {
        S.focus = R.list.indexOf(left[0]); S.busy = true; S.pan = 2.4;
        hudRound({ bubble:{ ok:true, text:`${c.w.word} ✓`, id:Math.random() } });
        later(() => { S.busy = false; sayTarget(); }, 900);
      }
    };
    const onMiss = (it, px, py) => {
      const c = cur(); if (!c) return;
      c.misses += 1; ui.wrong(c.w);
      if (it) it.shake = 1;
      const name = it?.wordsRaw?.[0] && wordMap.has(norm(it.wordsRaw[0])) ? it.wordsRaw[0] : null;
      setHud(h => ({ ...h, bubble:{ ok:false, x:px, y:py, text:name ? `ไม่ใช่ · ${name}` : "ไม่ใช่", id:Math.random() } }));
      if (c.misses >= 2) { showRing(c.it, hint, "#ffffff", true); S.pan = 3; later(sayTarget, 500); }
    };

    // ── การแตะ (raycast + พื้นที่แตะเผื่อรอบชิ้นของ) ──
    const ray = new THREE.Raycaster();
    const screenRect = it => { const r = renderer.domElement.getBoundingClientRect(); const b = it.root.userData.liveBox || it.box; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
        if (v.z > 1) continue; const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return [x0, y0, x1, y1]; };
    const inRect = (q, x, y, pad) => x >= q[0] - pad && x <= q[2] + pad && y >= q[1] - pad && y <= q[3] + pad;
    const tap = (cx, cy) => {
      if (!S.started || S.over || S.busy || S.paused || !S.round) return;
      const r = renderer.domElement.getBoundingClientRect(); const x = cx - r.left, y = cy - r.top;
      ray.setFromCamera(new THREE.Vector2(x / r.width * 2 - 1, -(y / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(itemsGroup, true).find(h => h.object.userData.item && !h.object.userData.item.hidden);
      const hitIt = hit?.object.userData.item || null;
      const open = S.round.list.filter(c => !c.found);
      // ของที่แตะโดน = ของที่ต้องหา (หรือของอื่นที่ชื่อเดียวกัน)
      const byHit = hitIt && open.find(c => c.it === hitIt || hitIt.words.includes(norm(c.w.word)));
      if (byHit) return onFound(byHit);
      // ของชิ้นเล็กได้ขอบแตะเผื่อกว้างกว่า
      for (const c of [cur(), ...open].filter(Boolean)) { const tr = screenRect(c.it), small = (tr[2] - tr[0]) * (tr[3] - tr[1]) < 70 * 70; if (!c.found && inRect(tr, x, y, small ? 30 : 14)) return onFound(c); }
      if (hitIt && hitIt.words.length) return onMiss(hitIt, x, y);
      const near = items.filter(it => it.words.length && !it.hidden && !open.some(c => c.it === it)).find(it => inRect(screenRect(it), x, y, 6));
      if (near) return onMiss(near, x, y);
      if (hitIt) { hitIt.shake = .5; sfx?.tap?.(); } // แตะของตกแต่ง: แค่สั่นเบาๆ ไม่นับผิด
    };

    // ── กล้อง: ลากเพื่อหมุนมอง · หยิก/ล้อเลื่อนเพื่อซูม ──
    const ptrs = new Map(); let downAt = null, pinch0 = null, zoom0 = 1;
    const onDown = e => { renderer.domElement.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
      S.pan = 0;
      if (ptrs.size === 1) downAt = { x:e.clientX, y:e.clientY, t:performance.now(), yaw:S.yaw, pitch:S.pitch, moved:false };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = S.zoom; if (downAt) downAt.moved = true; } };
    const onMove = e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; S.zoom = Math.min(2.2, Math.max(1, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); return; }
      if (downAt) { const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y; if (Math.hypot(dx, dy) > 8) downAt.moved = true;
        if (downAt.moved) { S.yaw = Math.max(-.7, Math.min(.7, downAt.yaw - dx * .0045)); S.pitch = Math.max(-.16, Math.min(.2, downAt.pitch + dy * .003)); } } };
    const onUp = e => { const d = downAt; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null;
      if (ptrs.size === 0) { if (d && !d.moved && performance.now() - d.t < 1200) tap(e.clientX, e.clientY); downAt = null; } };
    const onWheel = e => { e.preventDefault(); S.zoom = Math.min(2.2, Math.max(1, S.zoom * (e.deltaY > 0 ? .9 : 1.1))); };
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("wheel", onWheel, { passive:false });
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); }); ro.observe(el);

    api.current = {
      start: () => { if (S.started || !items.length) return; S.started = true; setHud(h => ({ ...h, on:true })); startLevel(0, true); sayTarget(); }, // เสียงแรกใน onClick (iOS)
      say: sayTarget,
      sayWord: i => { const R = S.round; if (!R || !R.list[i] || R.list[i].found) return; S.focus = i; S.pan = 2; hudRound(); ui.say(R.list[i].w); },
      zoom: d => { S.zoom = Math.min(2.2, Math.max(1, S.zoom * d)); },
      pause: p => { if (S.over || !S.started) return; S.paused = p; setHud(h => ({ ...h, paused:p })); },
      end: () => finish(true),
    };

    loadAll.then(() => { if (!alive) return; build(); classify();
      // เริ่มจากห้องที่รกน้อยกว่า: ซ่อนของบางส่วนไว้ก่อน (ด่านต่อไปของจะโผล่มาเพิ่ม)
      hideable.forEach(it => { it.hidden = true; it.root.visible = false; });
      const ok = items.some(it => wordOf(it));
      if (!ok) hideable.forEach(it => { it.hidden = false; it.root.visible = true; });
      if (typeof window !== "undefined" && window.__FR_DEBUG) window.__FR = { S, items, camera, screenRect, renderer, tap, api:api.current, cur };
      setHud(h => ({ ...h, ready:true, load:1, total:totalTargets, msg:ok ? null : "หมวดนี้ยังไม่มีของในห้องให้หา" })); });

    // ── ลูปหลัก ──
    const clock = new THREE.Clock(); let raf = 0; const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpC = new THREE.Color(); look.copy(LOOK);
    const tick = () => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const dt = Math.min(.05, clock.getDelta()); S.t += dt;
      // เวลาเกม: เดินเฉพาะตอนไม่ได้พัก → คิวเหตุการณ์ (later) + นาฬิกาบนจอ
      if (!S.paused) { S.gt += dt; if (S.started && !S.over) { S.playT += dt; const sec = Math.floor(S.playT); if (sec !== S.sec) { S.sec = sec; setHud(h => ({ ...h, sec })); } } }
      for (let i = 0; i < events.length; i++) if (events[i].at <= S.gt) { const ev = events.splice(i, 1)[0]; i--; if (alive) ev.fn(); }
      // แสงตามด่าน (เช้า → เย็น)
      { const L = LIGHT[S.light] || LIGHT[0]; sun.color.lerp(tmpC.set(L[0]), Math.min(1, dt * 1.5)); sun.intensity += (L[1] - sun.intensity) * Math.min(1, dt * 1.5); lamp.intensity += (L[2] - lamp.intensity) * Math.min(1, dt * 1.5); }
      // กล้องโคจรรอบจุดกลางห้อง (จำกัดมุม) · ก่อนเริ่มส่ายช้าๆ ให้เห็นทั้งห้อง
      const idle = !S.started ? Math.sin(S.t * .35) * .22 : 0;
      const yaw = S.yaw + idle, asp = camera.aspect;
      const dist = asp < 1 ? 3.75 : 3.5;
      camPos.set(Math.sin(yaw * .6) * dist, 2.2 + S.pitch * 3.2, Math.cos(yaw * .6) * dist).add(tmpL.set(LOOK.x, 0, LOOK.z));
      camera.position.lerp(camPos, Math.min(1, dt * 8));
      // ซูม: เลื่อนจุดมองเข้าไปหาจุดที่กล้องเล็ง
      const fov0 = asp < 1 ? 64 : 52; camera.fov += (fov0 / S.zoom - camera.fov) * Math.min(1, dt * 8);
      look.lerp(tmpL.set(LOOK.x - Math.sin(yaw) * 3.2, LOOK.y, LOOK.z), Math.min(1, dt * 8)); camera.lookAt(look); camera.updateProjectionMatrix();
      const ct = cur();
      if (S.pan > 0 && ct && !S.paused) { S.pan -= dt; const v = tmpV.copy(ct.it.center).project(camera), m = ct.misses >= 2 ? .4 : .6;
        if (v.x > m) S.yaw = Math.max(-.7, S.yaw - dt * .9); else if (v.x < -m) S.yaw = Math.min(.7, S.yaw + dt * .9);
        if (v.y < -m) S.pitch = Math.min(.2, S.pitch + dt * .3); else if (v.y > .8) S.pitch = Math.max(-.16, S.pitch - dt * .3);
        if (S.zoom > 1 && (Math.abs(v.x) > .85 || Math.abs(v.y) > .85)) S.zoom = Math.max(1, S.zoom - dt * 1.5); }
      // ของเด้ง (ถูก) / สั่น (ผิด)
      for (const it of items) {
        if (it.pop < 1 && !it.hidden) { it.pop = Math.min(1, it.pop + dt * 2.2); const k = it.pop; it.root.scale.setScalar(Math.max(.001, k < 1 ? 1 + Math.sin(k * Math.PI) * .25 - (1 - k) * (1 - k) * .9 : 1)); }
        if (it.fly) { const f = it.fly; f.t += dt / 1.15; const k = Math.max(0, Math.min(1, f.t)), e = k * k * (3 - 2 * k);
          it.root.position.lerpVectors(f.from, f.to, e); it.root.position.y += Math.sin(k * Math.PI) * 1.1; it.root.rotation.y = it.baseRot.y + f.spin * e;
          if (k >= 1) { it.fly = null; it.root.position.copy(f.to); it.root.rotation.y = it.baseRot.y; it.base.copy(f.to); refreshBox(it); } continue; }
        if (it.hop > 0) { it.hop = Math.max(0, it.hop - dt * .9); const k = 1 - it.hop; const h = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * .28;
          it.root.position.y = it.base.y + h; it.root.rotation.y = it.baseRot.y + Math.sin(k * Math.PI * 2) * .35 * (1 - k); }
        if (it.shake > 0) { it.shake = Math.max(0, it.shake - dt * 2.2); it.root.rotation.z = Math.sin(S.t * 42) * .07 * it.shake; it.root.position.x = it.base.x + Math.sin(S.t * 50) * .015 * it.shake; if (it.shake === 0) { it.root.rotation.z = 0; it.root.position.x = it.base.x; } }
      }
      // วงแหวนหันหน้าเข้าหากล้อง
      for (const m of [...rings, hint]) { if (!m.visible) continue; m.quaternion.copy(camera.quaternion); m.material.uniforms.uT.value = S.t; }
      rings.forEach(r => { if (r.visible) { const u = r.material.uniforms; u.uP.value = Math.min(1, u.uP.value + dt * 1.9); } });
      if (hint.visible) { const tgt = ct?.it; const p = .5 + .5 * Math.sin(S.t * 6); hint.material.uniforms.uA.value = .55 + .45 * p;
        if (tgt) { hintGlow.position.copy(tgt.center); hintGlow.scale.setScalar(tgt.radius * (1.6 + p * .5)); hintGlow.material.opacity = .08 + p * .14; } }
      for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; const q = pVel[i]; q.y -= 3.2 * dt; q.multiplyScalar(1 - dt * 1.2);
        pPos[i * 3] += q.x * dt; pPos[i * 3 + 1] += q.y * dt; pPos[i * 3 + 2] += q.z * dt; if (pLife[i] <= 0) pPos[i * 3 + 1] = -99; }
      pg.attributes.position.needsUpdate = true;
      mixers.forEach(m => m.update(dt));
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect();
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp); cv.removeEventListener("wheel", onWheel);
      const mats = new Set(), geos = new Set(), texs = new Set();
      scene.traverse(o => { if (o.geometry) geos.add(o.geometry); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => mats.add(x)); });
      Object.values(gltfs).forEach(g => g?.scene?.traverse(o => { if (o.geometry) geos.add(o.geometry); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => mats.add(x)); }));
      mats.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); } if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) texs.add(u.value); m.dispose(); });
      geos.forEach(g => g.dispose()); texs.forEach(t => t.dispose()); owned.forEach(x => x.dispose?.()); procTex.forEach(t => t.dispose());
      mixers.forEach(m => m.stopAllAction());
      renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove();
    };
  }, []); // eslint-disable-line

  // ฟองข้อความหายเอง
  useEffect(() => { if (!hud.bubble) return; const t = setTimeout(() => setHud(h => ({ ...h, bubble:null })), hud.bubble.ok ? 1500 : 1100); return () => clearTimeout(t); }, [hud.bubble?.id]); // eslint-disable-line

  const tk = ui.tokens;
  const small = { width:48, height:48, borderRadius:24, border:"none", background:tk.card, color:tk.ink, fontSize:22, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"auto", fontFamily:"inherit" };
  const big = { minWidth:200, minHeight:60, borderRadius:30, border:"none", fontSize:22, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, fontFamily:"inherit" };
  const pct = Math.round((hud.load || 0) * 100);
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const prog = hud.total ? Math.min(1, hud.found / hud.total) : 0;
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:6 }}>
      <style>{`@keyframes frPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}20%{transform:translate(-50%,-50%) scale(1.08);opacity:1}30%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
      {hud.on && hud.target && <Prompt w={hud.target} onClick={() => api.current.say?.()} />}
      {hud.on && hud.multi && <div style={{ display:"flex", gap:6, marginTop:-6 }}>
        {hud.multi.map((m, i) => <button key={i} onClick={() => api.current.sayWord?.(i)} className="m3-press" aria-label={`ฟัง ${m.w.word}`}
          style={{ flex:1, minWidth:0, minHeight:44, borderRadius:22, border:m.focus && !m.found ? `3px solid ${tk.primary}` : "3px solid transparent", background:m.found ? tk.primary : tk.card, color:m.found ? tk.onPrimary : tk.ink, boxShadow:tk.shadow,
            fontWeight:900, fontSize:13, padding:"2px 6px", cursor:"pointer", fontFamily:"inherit", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.found ? "✓ " : "🔊 "}{m.w.word}</button>)}
      </div>}
      <div style={{ position:"relative", height:hud.on ? (hud.multi ? "min(54vh, 540px)" : "min(60vh, 580px)") : "min(68vh, 640px)", minHeight:290, borderRadius:28, overflow:"hidden", background:"#2a2320" }}>
        <div ref={host} data-findroom3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.22))" }} />
        {hud.on && <>
          <div data-hud style={{ position:"absolute", left:10, top:10, padding:"6px 12px 8px", borderRadius:18, background:tk.card, color:tk.ink, fontWeight:900, fontSize:14, boxShadow:tk.shadow, pointerEvents:"none", minWidth:148 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}><span>ด่าน {hud.level + 1}/{LEVELS.length}</span><span>⏱ {mmss(hud.sec || 0)}</span></div>
            <div style={{ position:"relative", height:8, borderRadius:4, background:tk.ink, opacity:.9, marginTop:5, overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, background:tk.card, opacity:.75 }} />
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${prog * 100}%`, background:tk.primary, transition:"width .4s" }} />
            </div>
            <div style={{ fontSize:12, marginTop:3, fontWeight:800 }}>🔎 {hud.found}/{hud.total} · ⭐ {hud.score}</div>
          </div>
          <div style={{ position:"absolute", right:10, top:10, display:"flex", flexDirection:"column", gap:8 }}>
            <button aria-label="พัก" className="m3-press" style={small} onClick={() => api.current.pause?.(true)}>⏸</button>
            <button aria-label="ซูมเข้า" className="m3-press" style={small} onClick={() => api.current.zoom?.(1.25)}>＋</button>
            <button aria-label="ซูมออก" className="m3-press" style={small} onClick={() => api.current.zoom?.(.8)}>－</button>
          </div>
          <div style={{ position:"absolute", left:10, bottom:12, padding:"4px 10px", borderRadius:14, background:"rgba(0,0,0,.35)", color:"#fff", fontSize:12, fontWeight:700, pointerEvents:"none" }}>👆 แตะของ · ลากเพื่อมองรอบห้อง</div>
        </>}
        {hud.banner && <div key={hud.banner.id} style={{ position:"absolute", left:"50%", top:hud.banner.kind === "next" ? "30%" : "50%", width:"min(86%, 340px)", padding:"14px 16px", borderRadius:28, background:hud.banner.kind === "done" ? tk.primary : tk.card, color:hud.banner.kind === "done" ? tk.onPrimary : tk.ink,
          boxShadow:tk.shadow, textAlign:"center", pointerEvents:"none", animation:"frPop .5s ease-out forwards", boxSizing:"border-box" }}>
          <div style={{ fontWeight:900, fontSize:hud.banner.kind === "start" ? 22 : 26, lineHeight:1.2 }}>{hud.banner.title}</div>
          {hud.banner.stars != null && <div style={{ fontSize:34, marginTop:4, letterSpacing:4 }}>{"⭐".repeat(hud.banner.stars)}<span style={{ opacity:.3 }}>{"⭐".repeat(3 - hud.banner.stars)}</span></div>}
          {hud.banner.sub && <div style={{ fontWeight:800, fontSize:15, marginTop:6 }}>{hud.banner.sub}</div>}
        </div>}
        {hud.bubble && (hud.bubble.ok
          ? <div key={hud.bubble.id} style={{ position:"absolute", left:"50%", top:"14%", transform:"translateX(-50%)", padding:"8px 18px", borderRadius:22, background:tk.primary, color:tk.onPrimary, fontWeight:900, fontSize:22, boxShadow:tk.shadow, pointerEvents:"none", whiteSpace:"nowrap", animation:"vpBounce .6s ease-out" }}>{hud.bubble.text}</div>
          : <div key={hud.bubble.id} style={{ position:"absolute", left:`clamp(70px, ${hud.bubble.x}px, calc(100% - 70px))`, top:Math.max(8, hud.bubble.y - 64), transform:"translateX(-50%)", padding:"6px 14px", borderRadius:18, background:tk.card, color:tk.ink, fontWeight:900, fontSize:17, boxShadow:tk.shadow, pointerEvents:"none", whiteSpace:"nowrap" }}>🙅 {hud.bubble.text}</div>)}
        {hud.on && hud.paused && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:16 }}>
          <div style={{ color:"#fff", fontWeight:900, fontSize:26 }}>⏸ พักก่อน</div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>หาเจอแล้ว {hud.found} ชิ้น · ⏱ {mmss(hud.sec || 0)}</div>
          <button className="m3-press" onClick={() => api.current.pause?.(false)} style={{ ...big, background:tk.primary, color:tk.onPrimary }}>▶ เล่นต่อ</button>
          <button className="m3-press" onClick={() => api.current.end?.()} style={{ ...big, minHeight:52, fontSize:18, background:tk.card, color:tk.ink }}>🏁 จบเกม</button>
        </div>}
        {!hud.on && !hud.done && !hud.msg && <>
          <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", pointerEvents:"none", padding:"0 12px" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.6)" }}>Find It! 3D</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.75)" }}>{room.name}รกมาก! · ฟังคำ แล้วแตะของชิ้นนั้น</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.75)", marginTop:2 }}>{LEVELS.length} ด่าน · ยิ่งเล่นยิ่งรก!</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"34px 12px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"linear-gradient(180deg, transparent, rgba(0,0,0,.55))" }}>
            {!hud.ready && <div style={{ color:"#fff", fontWeight:800, fontSize:14 }}>กำลังจัดห้อง… {pct}%</div>}
            <button disabled={!hud.ready} onClick={() => { ui.unlock?.(); api.current.start?.(); }} className="m3-press"
              style={{ ...big, background:hud.ready ? tk.primary : tk.card, color:hud.ready ? tk.onPrimary : tk.ink, cursor:hud.ready ? "pointer" : "wait", opacity:hud.ready ? 1 : .8 }}>
              {hud.ready ? "▶ เริ่ม!" : "⏳ รอแป๊บ…"}
            </button>
          </div>
        </>}
        {hud.msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", padding:20, textAlign:"center", color:"#fff", fontWeight:900, fontSize:18 }}>{hud.msg}</div>}
      </div>
    </div>
  );
}
