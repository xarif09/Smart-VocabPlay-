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
const ROUNDS = 8;
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
  const [hud, setHud] = useState({ load:0, ready:false, on:false, round:0, score:0, target:null, msg:null, bubble:null, done:false });

  useEffect(() => {
    const el = host.current; if (!el) return;
    let alive = true;
    const timers = new Set(); const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
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
        const it = { key, root, box, base:root.position.clone(), baseRot:root.rotation.clone(), words:(o.w || []).map(norm), wordsRaw:o.w || [], big:!!o.big, hop:0, shake:0 };
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

    // ── เกม ──
    const S = { started:false, over:false, round:0, score:0, target:null, misses:0, busy:false, t:0, yaw:0, pitch:0, zoom:1 };
    const wordMap = new Map(); words.forEach(w => { const k = norm(w.word); if (!wordMap.has(k)) wordMap.set(k, w); });
    let plan = [];
    const makePlan = () => {
      const cands = items.filter(it => it.words.some(k => wordMap.has(k)));
      const shuffle = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
      const small = shuffle(cands.filter(c => !c.big)), big = shuffle(cands.filter(c => c.big));
      let list = [...small.slice(0, ROUNDS - Math.min(2, big.length)), ...big.slice(0, 2)];
      if (list.length < ROUNDS) list = [...list, ...shuffle([...small, ...big].filter(c => !list.includes(c)))];
      list = shuffle(list.slice(0, ROUNDS));
      while (list.length && list.length < ROUNDS) list.push(list[list.length % Math.max(1, cands.length)] || list[0]);
      return list.map(it => ({ it, w:wordMap.get(it.words.find(k => wordMap.has(k))) }));
    };

    // วงแหวน + คำใบ้ + ประกาย
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial("#fde047")); ring.renderOrder = 10; ring.visible = false; scene.add(ring);
    const hint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial("#ffffff")); hint.material.uniforms.uPulse.value = 1; hint.material.uniforms.uP.value = 1; hint.renderOrder = 9; hint.visible = false; scene.add(hint);
    const glow = keep(glowTexture());
    const hintGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:"#fff7c2", transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 })); hintGlow.renderOrder = 8; scene.add(hintGlow);
    const PN = 260, pPos = new Float32Array(PN * 3).fill(-99), pCol = new Float32Array(PN * 3), pVel = Array.from({ length:PN }, () => new THREE.Vector3()), pLife = new Float32Array(PN);
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:.09, map:glow, vertexColors:true, transparent:true, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    pts.frustumCulled = false; pts.renderOrder = 11; scene.add(pts); let pIdx = 0;
    const burst = (pos, r, n = 90) => { const C = ["#fde047", "#ffffff", "#f472b6", "#67e8f9", "#a3e635"]; for (let k = 0; k < n; k++) { const i = pIdx++ % PN;
      const d = new THREE.Vector3(Math.random() - .5, Math.random() - .2, Math.random() - .5).normalize();
      pPos.set([pos.x + d.x * r * .6, pos.y + d.y * r * .6, pos.z + d.z * r * .6], i * 3); const c = new THREE.Color(C[k % C.length]); pCol.set([c.r, c.g, c.b], i * 3);
      pVel[i].copy(d).multiplyScalar(1.2 + Math.random() * 2.2).add(new THREE.Vector3(0, 1.4, 0)); pLife[i] = .7 + Math.random() * .6; } };

    const sayTarget = () => { if (S.target) ui.say(S.target.w); };
    const nextRound = (first) => {
      if (S.round >= ROUNDS || !plan.length) return finish();
      S.target = plan[S.round]; S.round += 1; S.misses = 0; S.busy = false;
      ring.visible = false; hint.visible = false; hintGlow.material.opacity = 0;
      setHud(h => ({ ...h, round:S.round, target:S.target.w, bubble:null }));
      S.pan = 2.6;                                  // ของอยู่นอกจอ → ค่อยๆ หันกล้องจนเห็น (แค่ขอบจอ ไม่ชี้ให้)
      if (!first) sayTarget();
    };
    const finish = () => { if (S.over) return; S.over = true; S.target = null; setHud(h => ({ ...h, on:false, done:true, target:null }));
      later(() => track.finish(S.score, ROUNDS, { label:`หาเจอ ${S.score}/${ROUNDS} ชิ้น` }), 900); };

    const showRing = (it, mesh, color, pulse) => {
      const r = Math.min(1.25, Math.max(.17, it.radius * 1.15 + .06));
      mesh.position.copy(it.center); mesh.scale.setScalar(r * 2); mesh.visible = true;
      mesh.material.uniforms.uColor.value.set(color); if (!pulse) mesh.material.uniforms.uP.value = 0;
    };
    const onFound = (it) => {
      S.busy = true; const t = S.target; const clean = S.misses < 2; if (clean) S.score += 1;
      ui.correct(t.w); showRing(it, ring, "#fde047", false); hint.visible = false; hintGlow.material.opacity = 0;
      it.hop = 1; burst(it.center, it.radius, 120);
      setHud(h => ({ ...h, score:S.score, bubble:{ ok:true, text:`${t.w.word} ✓`, id:Math.random() } }));
      later(() => burst(it.center, it.radius, 60), 450);
      later(() => nextRound(false), 1900);
    };
    const onMiss = (it, px, py) => {
      S.misses += 1; ui.wrong(S.target.w);
      if (it) it.shake = 1;
      const name = it?.wordsRaw?.[0] && wordMap.has(norm(it.wordsRaw[0])) ? it.wordsRaw[0] : null;
      setHud(h => ({ ...h, bubble:{ ok:false, x:px, y:py, text:name ? `ไม่ใช่ · ${name}` : "ไม่ใช่", id:Math.random() } }));
      if (S.misses >= 2) { showRing(S.target.it, hint, "#ffffff", true); S.pan = 3; later(sayTarget, 500); }
    };

    // ── การแตะ (raycast + พื้นที่แตะเผื่อรอบชิ้นของ) ──
    const ray = new THREE.Raycaster();
    const screenRect = it => { const r = renderer.domElement.getBoundingClientRect(); const b = it.root.userData.liveBox || it.box; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
        if (v.z > 1) continue; const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return [x0, y0, x1, y1]; };
    const inRect = (q, x, y, pad) => x >= q[0] - pad && x <= q[2] + pad && y >= q[1] - pad && y <= q[3] + pad;
    const tap = (cx, cy) => {
      if (!S.started || S.over || S.busy || !S.target) return;
      const r = renderer.domElement.getBoundingClientRect(); const x = cx - r.left, y = cy - r.top;
      ray.setFromCamera(new THREE.Vector2(x / r.width * 2 - 1, -(y / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(itemsGroup, true).find(h => h.object.userData.item);
      const hitIt = hit?.object.userData.item || null;
      const tgt = S.target.it;
      // small objects get a bigger forgiving margin
      const tr = screenRect(tgt), small = (tr[2] - tr[0]) * (tr[3] - tr[1]) < 70 * 70;
      if (hitIt === tgt || inRect(tr, x, y, small ? 30 : 14)) return onFound(tgt);
      if (hitIt && hitIt.words.length) return onMiss(hitIt, x, y);
      const near = items.filter(it => it.words.length && it !== tgt).find(it => inRect(screenRect(it), x, y, 6));
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
      start: () => { if (S.started || !plan.length) return; S.started = true; setHud(h => ({ ...h, on:true })); nextRound(true); sayTarget(); }, // เสียงแรกใน onClick (iOS)
      say: sayTarget,
      zoom: d => { S.zoom = Math.min(2.2, Math.max(1, S.zoom * d)); },
    };

    loadAll.then(() => { if (!alive) return; build(); plan = makePlan();
      if (typeof window !== "undefined" && window.__FR_DEBUG) window.__FR = { S, items, camera, screenRect, renderer, plan, tap };
      setHud(h => ({ ...h, ready:true, load:1, msg:plan.length ? null : "หมวดนี้ยังไม่มีของในห้องให้หา" })); });

    // ── ลูปหลัก ──
    const clock = new THREE.Clock(); let raf = 0; const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(); look.copy(LOOK);
    const tick = () => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const dt = Math.min(.05, clock.getDelta()); S.t += dt;
      // กล้องโคจรรอบจุดกลางห้อง (จำกัดมุม) · ก่อนเริ่มส่ายช้าๆ ให้เห็นทั้งห้อง
      const idle = !S.started ? Math.sin(S.t * .35) * .22 : 0;
      const yaw = S.yaw + idle, asp = camera.aspect;
      const dist = asp < 1 ? 3.75 : 3.5;
      camPos.set(Math.sin(yaw * .6) * dist, 2.2 + S.pitch * 3.2, Math.cos(yaw * .6) * dist).add(tmpL.set(LOOK.x, 0, LOOK.z));
      camera.position.lerp(camPos, Math.min(1, dt * 8));
      // ซูม: เลื่อนจุดมองเข้าไปหาจุดที่กล้องเล็ง
      const fov0 = asp < 1 ? 64 : 52; camera.fov += (fov0 / S.zoom - camera.fov) * Math.min(1, dt * 8);
      look.lerp(tmpL.set(LOOK.x - Math.sin(yaw) * 3.2, LOOK.y, LOOK.z), Math.min(1, dt * 8)); camera.lookAt(look); camera.updateProjectionMatrix();
      if (S.pan > 0 && S.target) { S.pan -= dt; const v = tmpV.copy(S.target.it.center).project(camera), m = S.misses >= 2 ? .4 : .6;
        if (v.x > m) S.yaw = Math.max(-.7, S.yaw - dt * .9); else if (v.x < -m) S.yaw = Math.min(.7, S.yaw + dt * .9);
        if (v.y < -m) S.pitch = Math.min(.2, S.pitch + dt * .3); else if (v.y > .8) S.pitch = Math.max(-.16, S.pitch - dt * .3);
        if (S.zoom > 1 && (Math.abs(v.x) > .85 || Math.abs(v.y) > .85)) S.zoom = Math.max(1, S.zoom - dt * 1.5); }
      // ของเด้ง (ถูก) / สั่น (ผิด)
      for (const it of items) {
        if (it.hop > 0) { it.hop = Math.max(0, it.hop - dt * .9); const k = 1 - it.hop; const h = Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * .28;
          it.root.position.y = it.base.y + h; it.root.rotation.y = it.baseRot.y + Math.sin(k * Math.PI * 2) * .35 * (1 - k); }
        if (it.shake > 0) { it.shake = Math.max(0, it.shake - dt * 2.2); it.root.rotation.z = Math.sin(S.t * 42) * .07 * it.shake; it.root.position.x = it.base.x + Math.sin(S.t * 50) * .015 * it.shake; if (it.shake === 0) { it.root.rotation.z = 0; it.root.position.x = it.base.x; } }
      }
      // วงแหวนหันหน้าเข้าหากล้อง
      for (const m of [ring, hint]) { if (!m.visible) continue; m.quaternion.copy(camera.quaternion); m.material.uniforms.uT.value = S.t; }
      if (ring.visible) { const u = ring.material.uniforms; u.uP.value = Math.min(1, u.uP.value + dt * 1.9); }
      if (hint.visible) { const tgt = S.target?.it; const p = .5 + .5 * Math.sin(S.t * 6); hint.material.uniforms.uA.value = .55 + .45 * p;
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
  const small = { width:48, height:48, borderRadius:24, border:"none", background:tk.card, color:tk.ink, fontSize:22, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"auto" };
  const pct = Math.round((hud.load || 0) * 100);
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:6 }}>
      {hud.on && hud.target && <Prompt w={hud.target} onClick={() => api.current.say?.()} />}
      <div style={{ position:"relative", height:hud.on ? "min(60vh, 580px)" : "min(68vh, 640px)", minHeight:300, borderRadius:28, overflow:"hidden", background:"#2a2320" }}>
        <div ref={host} data-findroom3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.22))" }} />
        {hud.on && <>
          <div style={{ position:"absolute", left:10, top:10, padding:"6px 12px", borderRadius:18, background:tk.card, color:tk.ink, fontWeight:900, fontSize:15, boxShadow:tk.shadow, pointerEvents:"none" }}>
            🔎 {Math.min(hud.round, ROUNDS)}/{ROUNDS} · ⭐ {hud.score}
          </div>
          <div style={{ position:"absolute", right:10, top:10, display:"flex", flexDirection:"column", gap:8 }}>
            <button aria-label="ซูมเข้า" className="m3-press" style={small} onClick={() => api.current.zoom?.(1.25)}>＋</button>
            <button aria-label="ซูมออก" className="m3-press" style={small} onClick={() => api.current.zoom?.(.8)}>－</button>
          </div>
          <div style={{ position:"absolute", left:10, bottom:12, padding:"4px 10px", borderRadius:14, background:"rgba(0,0,0,.35)", color:"#fff", fontSize:12, fontWeight:700, pointerEvents:"none" }}>👆 แตะของ · ลากเพื่อมองรอบห้อง</div>
        </>}
        {hud.bubble && (hud.bubble.ok
          ? <div key={hud.bubble.id} style={{ position:"absolute", left:"50%", top:"14%", transform:"translateX(-50%)", padding:"8px 18px", borderRadius:22, background:tk.primary, color:tk.onPrimary, fontWeight:900, fontSize:22, boxShadow:tk.shadow, pointerEvents:"none", whiteSpace:"nowrap", animation:"vpBounce .6s ease-out" }}>{hud.bubble.text}</div>
          : <div key={hud.bubble.id} style={{ position:"absolute", left:`clamp(70px, ${hud.bubble.x}px, calc(100% - 70px))`, top:Math.max(8, hud.bubble.y - 64), transform:"translateX(-50%)", padding:"6px 14px", borderRadius:18, background:tk.card, color:tk.ink, fontWeight:900, fontSize:17, boxShadow:tk.shadow, pointerEvents:"none", whiteSpace:"nowrap" }}>🙅 {hud.bubble.text}</div>)}
        {!hud.on && !hud.done && !hud.msg && <>
          <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", pointerEvents:"none", padding:"0 12px" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.6)" }}>Find It! 3D</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.75)" }}>{room.name}รกมาก! · ฟังคำ แล้วแตะของชิ้นนั้น</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"34px 12px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"linear-gradient(180deg, transparent, rgba(0,0,0,.55))" }}>
            {!hud.ready && <div style={{ color:"#fff", fontWeight:800, fontSize:14 }}>กำลังจัดห้อง… {pct}%</div>}
            <button disabled={!hud.ready} onClick={() => { ui.unlock?.(); api.current.start?.(); }} className="m3-press"
              style={{ minWidth:200, minHeight:60, borderRadius:30, border:"none", background:hud.ready ? tk.primary : tk.card, color:hud.ready ? tk.onPrimary : tk.ink, fontSize:22, fontWeight:900, cursor:hud.ready ? "pointer" : "wait", boxShadow:tk.shadow, opacity:hud.ready ? 1 : .8 }}>
              {hud.ready ? "▶ เริ่ม!" : "⏳ รอแป๊บ…"}
            </button>
          </div>
        </>}
        {hud.msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", padding:20, textAlign:"center", color:"#fff", fontWeight:900, fontSize:18 }}>{hud.msg}</div>}
      </div>
    </div>
  );
}
