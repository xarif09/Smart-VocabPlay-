// Word Runner 3D — วิ่ง 3 เลน ฟังคำ แล้ววิ่งชนป้ายรูปที่ถูก (three.js โหลดเฉพาะตอนเปิดเกม)
// ฉากเปลี่ยนตามหมวด: ป่า · ถนนขนม · เมือง (ขับรถ) · หิมะ · อวกาศ · ชายหาด · โรงเรียน · สวน
// สีของฉาก 3D เป็นงานศิลป์ของโลกในเกม (ไม่ใช่สี UI) · สี UI/HUD ใช้โทเค็นจาก App
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const THEMES = {
  jungle: { name:"ป่าใหญ่", sky:["#38bdf8","#d9f99d"], ground:"#4ade80", road:"#b45309", line:"#fde68a", fog:"#c7f0c0", prop:"tree", sun:"#fff7d6" },
  candy:  { name:"ถนนขนมหวาน", sky:["#f472b6","#fde68a"], ground:"#f9a8d4", road:"#fff1f2", line:"#f472b6", fog:"#fcd5e8", prop:"lollipop", sun:"#fff1f2" },
  city:   { name:"เมืองใหญ่", sky:["#60a5fa","#e0f2fe"], ground:"#94a3b8", road:"#334155", line:"#facc15", fog:"#cbd5e1", prop:"building", car:true, sun:"#ffffff" },
  snow:   { name:"ภูเขาหิมะ", sky:["#7dd3fc","#f8fafc"], ground:"#f1f5f9", road:"#cbd5e1", line:"#38bdf8", fog:"#e2f2fb", prop:"pine", snow:true, sun:"#ffffff" },
  space:  { name:"ถนนอวกาศ", sky:["#0b1026","#6d28d9"], ground:"#1e1b4b", road:"#312e81", line:"#22d3ee", fog:"#2e1065", prop:"crystal", stars:true, sun:"#c4b5fd" },
  beach:  { name:"ชายหาด", sky:["#22d3ee","#fef3c7"], ground:"#fde68a", road:"#fcd34d", line:"#0ea5e9", fog:"#d6f3f5", prop:"palm", sun:"#fffbeb" },
  school: { name:"ทางไปโรงเรียน", sky:["#93c5fd","#fef9c3"], ground:"#86efac", road:"#fbbf24", line:"#ffffff", fog:"#dbeafe", prop:"pencil", sun:"#ffffff" },
  park:   { name:"สวนสนุก", sky:["#a78bfa","#fde68a"], ground:"#86efac", road:"#c4b5fd", line:"#ffffff", fog:"#e9d5ff", prop:"balloon", sun:"#ffffff" },
};
const CAT_THEME = { animals:"jungle", nature:"jungle", fruits:"candy", food:"candy", vegetables:"candy", vehicles:"city", places:"city", jobs:"city",
  weather:"snow", time:"snow", technology:"space", music:"space", shapes:"space", numbers:"space", countries:"beach", school:"school",
  sports:"park", toys:"park", family:"park", feelings:"park", body:"park", clothes:"park", home:"park", colors:"candy", actions:"park", opposites:"space" };
export const themeOf = catId => THEMES[CAT_THEME[catId] || "park"];

const LANES = [-2.4, 0, 2.4];
const ROW_Z = -58;          // ป้ายเกิดที่ระยะนี้
const ROUNDS = 10;

// สีจาก CSS var (oklch) → THREE.Color ผ่าน canvas
function cssColor(v, fallback = "#7c3aed") {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d");
    x.fillStyle = fallback; x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fallback;
    x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255);
  } catch (_) { return new THREE.Color(fallback); }
}
function emojiTexture(emoji, c1, c2) {
  const c = document.createElement("canvas"); c.width = 320; c.height = 240; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 320, 240); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 320, 240);
  x.font = "150px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji || "⭐", 160, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roadTexture(th) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512; const x = c.getContext("2d");
  x.fillStyle = th.road; x.fillRect(0, 0, 256, 512);
  x.globalAlpha = .12; for (let i = 0; i < 300; i++) { x.fillStyle = i % 2 ? "#000" : "#fff"; x.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); } x.globalAlpha = 1;
  x.fillStyle = th.line; [256 / 3, 512 / 3].forEach(px => { for (let y = 0; y < 512; y += 128) x.fillRect(px - 4, y, 8, 70); });
  x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(0, 0, 10, 512); x.fillRect(246, 0, 10, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 8); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ── ของประกอบฉาก (สร้างจากรูปทรงพื้นฐาน) ──
function makeProp(kind, rnd) {
  const g = new THREE.Group(); const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color:c, roughness:.6, ...o });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === "tree") { add(new THREE.CylinderGeometry(.25, .35, 2, 8), M("#92400e"), 0, 1); const s = 1 + rnd * .6; add(new THREE.SphereGeometry(1.4 * s, 12, 10), M(["#16a34a","#22c55e","#15803d"][Math.floor(rnd * 3)]), 0, 2.6 * s); add(new THREE.SphereGeometry(.9 * s, 10, 8), M("#4ade80"), .7, 3.2 * s, .3); }
  else if (kind === "pine") { add(new THREE.CylinderGeometry(.2, .3, 1.2, 8), M("#78350f"), 0, .6); for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(1.5 - i * .35, 1.6, 10), M(i === 2 ? "#f8fafc" : "#166534"), 0, 1.6 + i * .9); }
  else if (kind === "lollipop") { add(new THREE.CylinderGeometry(.09, .09, 3, 8), M("#ffffff"), 0, 1.5); add(new THREE.TorusGeometry(.8, .35, 12, 24), M(["#f43f5e","#a855f7","#22c55e","#f59e0b"][Math.floor(rnd * 4)], { emissive:"#330018", emissiveIntensity:.25 }), 0, 3.4); }
  else if (kind === "building") { const h = 4 + rnd * 9; const b = add(new THREE.BoxGeometry(3, h, 3), M(["#64748b","#475569","#0ea5e9","#a78bfa"][Math.floor(rnd * 4)], { roughness:.4, metalness:.2 }), 0, h / 2);
    for (let y = 1; y < h - .5; y += 1.4) for (const x of [-.8, .8]) add(new THREE.BoxGeometry(.6, .7, .05), new THREE.MeshStandardMaterial({ color:"#fde68a", emissive:"#fbbf24", emissiveIntensity:rnd > .4 ? 1.4 : .2 }), x, y, 1.53); b.receiveShadow = true; }
  else if (kind === "crystal") { const m = add(new THREE.OctahedronGeometry(.9 + rnd, 0), new THREE.MeshStandardMaterial({ color:["#22d3ee","#a855f7","#f472b6"][Math.floor(rnd * 3)], emissive:["#0891b2","#7e22ce","#db2777"][Math.floor(rnd * 3)], emissiveIntensity:1.2, roughness:.1, metalness:.3 }), 0, 1.6 + rnd); m.scale.y = 1.8; }
  else if (kind === "palm") { const tr = add(new THREE.CylinderGeometry(.18, .3, 4, 8), M("#a16207"), 0, 2); tr.rotation.z = .15; for (let i = 0; i < 6; i++) { const l = add(new THREE.ConeGeometry(.35, 2.4, 6), M("#16a34a"), .3, 4, 0); l.rotation.set(Math.PI / 2.4, 0, i * Math.PI / 3); l.position.set(.3 + Math.cos(i) * .8, 3.9, Math.sin(i) * .8); } }
  else if (kind === "pencil") { add(new THREE.CylinderGeometry(.45, .45, 4, 6), M(["#facc15","#3b82f6","#ef4444"][Math.floor(rnd * 3)]), 0, 2); add(new THREE.ConeGeometry(.45, 1, 6), M("#fde4c3"), 0, 4.5); add(new THREE.ConeGeometry(.15, .35, 6), M("#1f2937"), 0, 4.85); }
  else { add(new THREE.CylinderGeometry(.03, .03, 3, 4), M("#ffffff"), 0, 1.5); add(new THREE.SphereGeometry(.7, 16, 12), M(["#f43f5e","#22d3ee","#facc15","#a855f7"][Math.floor(rnd * 4)], { roughness:.2, emissive:"#220022", emissiveIntensity:.2 }), 0, 3.4); }
  return g;
}
function makeRunner(primary, car) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color:c, roughness:.35, ...o });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const feet = [];
  if (car) {
    add(body, new THREE.BoxGeometry(1.6, .55, 2.4), M(primary, { metalness:.4, roughness:.25 }), 0, .55, 0);
    add(body, new THREE.BoxGeometry(1.2, .5, 1.1), M("#e0f2fe", { metalness:.1, roughness:.05, transparent:true, opacity:.85 }), 0, 1.05, .15);
    for (const [x, z] of [[-.8, .8], [.8, .8], [-.8, -.8], [.8, -.8]]) { const w = add(body, new THREE.CylinderGeometry(.33, .33, .3, 16), M("#111827"), x, .33, z); w.rotation.z = Math.PI / 2; feet.push(w); }
    for (const x of [-.5, .5]) add(body, new THREE.SphereGeometry(.12, 8, 8), new THREE.MeshStandardMaterial({ color:"#fff", emissive:"#fffbe6", emissiveIntensity:3 }), x, .6, -1.21);
  }
  const head = new THREE.Group(); head.position.y = car ? 1.55 : .95; body.add(head);
  add(head, new THREE.SphereGeometry(.62, 24, 20), M(primary), 0, 0, 0).scale.set(1, 1.08, 1);
  add(head, new THREE.SphereGeometry(.42, 20, 16), M("#ffffff"), 0, -.12, -.3).scale.set(1, .9, .6);
  for (const x of [-.2, .2]) { add(head, new THREE.SphereGeometry(.11, 12, 10), M("#111827", { roughness:.1 }), x, .14, -.53); add(head, new THREE.SphereGeometry(.04, 8, 6), M("#ffffff"), x + .03, .18, -.63); }
  for (const x of [-.32, .32]) add(head, new THREE.SphereGeometry(.07, 8, 6), M("#f472b6"), x, -.02, -.5);
  for (const x of [-.4, .4]) add(head, new THREE.ConeGeometry(.16, .32, 10), M(primary), x, .6, 0);
  if (!car) for (const x of [-.28, .28]) feet.push(add(body, new THREE.SphereGeometry(.2, 12, 10), M(primary), x, .2, 0));
  return { g, body, head, feet };
}
function makeCard(tex, aspect, frameColor) {
  const g = new THREE.Group();
  const W = 2.25, H = 1.7;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + .22, H + .22, .14), new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:frameColor, emissiveIntensity:.3, roughness:.3, fog:false }));
  frame.castShadow = true; g.add(frame);
  let pw = W, ph = W / aspect; if (ph > H) { ph = H; pw = H * aspect; }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map:tex, toneMapped:false, fog:false }));
  pic.position.z = -.08; pic.rotation.y = Math.PI; g.add(pic);   // หันหน้าเข้าหาผู้เล่น (ผู้เล่นอยู่ทาง +z)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.4, 8), new THREE.MeshStandardMaterial({ color:"#e5e7eb", metalness:.6, roughness:.3 }));
  pole.position.y = -(H / 2) - .7; pole.castShadow = true; g.add(pole);
  g.rotation.y = Math.PI;
  return { g, frame, pic };
}

export default function Runner3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const [hud, setHud] = useState({ round:0, score:0, hearts:3, coins:0, target:null, on:false, msg:null });
  const th = themeOf(catId);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const W = () => el.clientWidth, H = () => el.clientHeight;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" }); } catch (e) { setHud(h => ({ ...h, msg:"เครื่องนี้ไม่รองรับ 3D" })); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement); renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(th.fog, 45, 140);
    const camera = new THREE.PerspectiveCamera(62, W() / H(), .1, 300);
    camera.position.set(0, 4.3, 7); camera.lookAt(0, 1.2, -8);

    // ท้องฟ้าไล่สี
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{ top:{ value:new THREE.Color(th.sky[0]) }, bot:{ value:new THREE.Color(th.sky[1]) } },
      vertexShader:"varying vec3 vp; void main(){ vp=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vp,1.); }",
      fragmentShader:"uniform vec3 top; uniform vec3 bot; varying vec3 vp; void main(){ float h=clamp(normalize(vp).y*1.6+.15,0.,1.); gl_FragColor=vec4(mix(bot,top,h),1.); }" }));
    scene.add(sky);
    if (th.stars) { const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(150); v.y = Math.abs(v.y); p.set([v.x, v.y, v.z], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(p, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:"#ffffff", size:.8, fog:false }))); }

    // แสง
    scene.add(new THREE.HemisphereLight(th.sky[1], th.ground, .9));
    const sun = new THREE.DirectionalLight(th.sun, 2.2); sun.position.set(6, 14, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left:-12, right:12, top:12, bottom:-12, near:1, far:40 }); scene.add(sun); scene.add(sun.target);

    // พื้น + ถนน
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 300), new THREE.MeshStandardMaterial({ color:th.ground, roughness:1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.01, -100); ground.receiveShadow = true; scene.add(ground);
    const rt = roadTexture(th);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 300), new THREE.MeshStandardMaterial({ map:rt, roughness:.8 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -100); road.receiveShadow = true; scene.add(road);

    // ของประกอบสองข้างทาง (วนกลับมาใหม่)
    const props = [];
    for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1; const pr = makeProp(th.prop, Math.random()); pr.position.set(side * (6 + Math.random() * 7), 0, -i * 6); pr.rotation.y = Math.random() * 6; scene.add(pr); props.push(pr); }

    // ผู้เล่น
    const primary = cssColor("--md-primary");
    const R = makeRunner(primary, !!th.car); scene.add(R.g);
    const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(.7, 24), new THREE.MeshBasicMaterial({ color:"#000", transparent:true, opacity:.22 }));
    shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = .02; R.g.add(shadowBlob);

    // อนุภาค (ระเบิดดาว/ประกาย)
    const PN = 500, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = Array.from({ length:PN }, () => new THREE.Vector3()), pLife = new Float32Array(PN);
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pm = new THREE.PointsMaterial({ size:.28, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false });
    scene.add(new THREE.Points(pg, pm)); let pIdx = 0;
    const burst = (pos, colors, n = 90, power = 9) => { for (let k = 0; k < n; k++) { const i = pIdx++ % PN; pPos.set([pos.x, pos.y, pos.z], i * 3); const c = new THREE.Color(colors[k % colors.length]); pCol.set([c.r, c.g, c.b], i * 3);
      pVel[i].set((Math.random() - .5) * power, Math.random() * power * .9, (Math.random() - .5) * power); pLife[i] = 1 + Math.random() * .5; } };

    // เส้นความเร็ว
    const SL = 60, slPos = new Float32Array(SL * 6); const slg = new THREE.BufferGeometry(); slg.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
    const sline = new THREE.LineSegments(slg, new THREE.LineBasicMaterial({ color:"#ffffff", transparent:true, opacity:.0 })); scene.add(sline);
    const slSeed = Array.from({ length:SL }, () => ({ x:(Math.random() - .5) * 14, y:Math.random() * 5 + .3, z:-Math.random() * 40 }));
    // หิมะ
    let snow = null, snowPos = null;
    if (th.snow) { const n = 400; snowPos = new Float32Array(n * 3); for (let i = 0; i < n; i++) snowPos.set([(Math.random() - .5) * 30, Math.random() * 14, -Math.random() * 60], i * 3);
      const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(snowPos, 3)); snow = new THREE.Points(g2, new THREE.PointsMaterial({ color:"#ffffff", size:.12, transparent:true, opacity:.9 })); scene.add(snow); }

    // เหรียญ
    const coinGeo = new THREE.CylinderGeometry(.42, .42, .1, 28), coinMat = new THREE.MeshStandardMaterial({ color:"#fde047", metalness:.6, roughness:.25, emissive:"#f59e0b", emissiveIntensity:1.6 });
    const coins = [];

    // แสงเรือง (bloom)
    let composer = null;
    try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), .5, .45, .95)); composer.addPass(new OutputPass()); } catch (e) { composer = null; }

    // ── สถานะเกม ──
    const S = { lane:1, x:0, speed:11, z:0, row:null, waiting:true, round:0, score:0, hearts:3, coinN:0, shake:0, flash:0, t:0, jump:0, over:false, started:false };
    const pool = words.length >= 3 ? words : words.concat(words, words);
    const loader = new THREE.TextureLoader();
    const texCache = new Map();
    const texFor = w => new Promise(res => {
      if (texCache.has(w.id)) return res(texCache.get(w.id));
      const url = ui.imageUrl(w);
      const fb = () => { const t = { tex:emojiTexture(w.emoji, th.sky[1], th.sky[0]), aspect:4 / 3 }; texCache.set(w.id, t); res(t); };
      if (!url) return fb();
      loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const v = { tex:t, aspect:(t.image.width / t.image.height) || 4 / 3 }; texCache.set(w.id, v); res(v); }, undefined, fb);
    });
    const used = new Set();
    const pickTarget = () => { const cand = pool.filter(w => !used.has(w.id)); const arr = cand.length ? cand : pool; const w = arr[Math.floor(Math.random() * arr.length)]; used.add(w.id); return w; };
    const spawnRow = async (pre) => {
      const target = pre || pickTarget();
      const others = pool.filter(w => w.id !== target.id).sort(() => Math.random() - .5).slice(0, 2);
      const set = [target, ...others].sort(() => Math.random() - .5);
      const texs = await Promise.all(set.map(texFor));
      if (S.over) return;
      const g = new THREE.Group(); g.position.z = ROW_Z; scene.add(g);
      const cards = set.map((w, i) => { const c = makeCard(texs[i].tex, texs[i].aspect, i % 2 ? "#a855f7" : "#22d3ee"); c.g.position.set(LANES[i], 2.5, 0); g.add(c.g); return { ...c, w, lane:i }; });
      // ประตูเรือง
      const arch = new THREE.Mesh(new THREE.TorusGeometry(4.6, .12, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:"#f0abfc", emissiveIntensity:2.2 }));
      arch.position.set(0, .2, -.4); g.add(arch);
      S.row = { g, cards, target, hit:false };
      S.round += 1;
      for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2; c.castShadow = true; c.position.set(LANES[Math.floor(Math.random() * 3)], .9, ROW_Z + 12 + k * 7); scene.add(c); coins.push(c); }
      setHud(h => ({ ...h, round:S.round, target }));
      if (!pre) ui.say(target);
    };
    const finish = () => { S.over = true; setHud(h => ({ ...h, on:false })); setTimeout(() => track.finish(S.score, ROUNDS, { label:`เก็บรูปถูก ${S.score}/${ROUNDS} · 🪙 ${S.coinN}` }), 900); };
    const resolveRow = () => {
      const r = S.row; if (!r || r.hit) return; r.hit = true;
      const card = r.cards.find(c => c.lane === S.lane);
      const ok = card && card.w.id === r.target.id;
      const wp = new THREE.Vector3(); (card ? card.g : r.g).getWorldPosition(wp);
      if (ok) { S.score += 1; S.jump = 1; burst(wp, ["#fde047","#f472b6","#22d3ee","#a3e635","#ffffff"], 160, 12); card.g.userData.fly = 1; S.speed = Math.min(26, S.speed + 1.3); ui.correct(r.target); }
      else { S.hearts -= 1; S.shake = 1; S.flash = 1; if (card) { burst(wp, ["#ef4444","#7f1d1d","#ffffff"], 70, 7); card.g.userData.fall = 1; } ui.wrong(r.target); }
      r.cards.forEach(c => { if (c.w.id === r.target.id && c !== card) c.frame.material.emissive.set("#22c55e"); });
      setHud(h => ({ ...h, score:S.score, hearts:S.hearts }));
      setTimeout(() => { scene.remove(r.g); if (S.row === r) S.row = null; if (S.hearts <= 0 || S.round >= ROUNDS) finish(); else { S.waiting = false; spawnRow(); } }, 900);
    };
    const move = d => { if (!S.started || S.over) return; const n = Math.max(0, Math.min(2, S.lane + d)); if (n !== S.lane) { S.lane = n; sfx.tap(); } };
    api.current = {
      start: () => { if (S.started) return; S.started = true; setHud(h => ({ ...h, on:true })); const t0 = pickTarget(); ui.say(t0); spawnRow(t0); },   // พูดคำแรกตรงใน onClick (iOS)
      left: () => move(-1), right: () => move(1),
      lane: i => { if (!S.started || S.over) return; if (i !== S.lane) { S.lane = i; sfx.tap(); } },
    };
    // ปัดนิ้ว / แป้นพิมพ์
    let sx = null; const dn = e => { sx = e.clientX; }; const up = e => { if (sx == null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 24) move(dx > 0 ? 1 : -1); else { const r = renderer.domElement.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; move(fx < .38 ? -1 : fx > .62 ? 1 : 0); } sx = null; };
    renderer.domElement.addEventListener("pointerdown", dn); renderer.domElement.addEventListener("pointerup", up);
    const key = e => { if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); }; window.addEventListener("keydown", key);
    const onResize = () => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); composer?.setSize(W(), H()); };
    const ro = new ResizeObserver(onResize); ro.observe(el);

    // ── ลูปหลัก ──
    let raf = 0, last = performance.now(), alive = true;
    const tick = now => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const dt = Math.min(.05, (now - last) / 1000); last = now; S.t += dt;
      const v = S.started && !S.over ? S.speed : 3;
      const dz = v * dt;
      rt.offset.y += dz / 37.5;
      props.forEach(p => { p.position.z += dz; if (p.position.z > 12) { p.position.z -= 26 * 6; } });
      // ผู้เล่น
      S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 12);
      R.g.position.x = S.x; R.g.rotation.z = (S.x - LANES[S.lane]) * .12;
      S.jump = Math.max(0, S.jump - dt * 2.2);
      const hop = Math.sin((1 - S.jump) * Math.PI) * (S.jump > 0 ? 1.6 : 0);
      const run = S.started && !S.over ? Math.abs(Math.sin(S.t * 14)) * (th.car ? .04 : .22) : Math.abs(Math.sin(S.t * 3)) * .06;
      R.body.position.y = run + hop; R.body.scale.set(1 + run * .25, 1 - run * .2, 1);
      R.feet.forEach((f, i) => { if (th.car) f.rotation.x -= dz * 3; else f.position.z = Math.sin(S.t * 14 + i * Math.PI) * .25; });
      R.head.rotation.y = Math.sin(S.t * 2) * .1;
      // แถวป้าย
      const r = S.row;
      if (r) {
        r.g.position.z += dz;
        r.cards.forEach((c, i) => { if (!c.g.userData.fly && !c.g.userData.fall) c.g.position.y = 2.5 + Math.sin(S.t * 3 + i) * .12; c.frame.material.emissiveIntensity = .3 + Math.sin(S.t * 6) * .15;
          if (c.g.userData.fly) { c.g.position.y += dt * 9; c.g.rotation.y += dt * 12; c.g.scale.multiplyScalar(1 - dt * 1.2); }
          if (c.g.userData.fall) { c.g.rotation.x -= dt * 4; c.g.position.y -= dt * 4; } });
        if (!r.hit && r.g.position.z > -.6) resolveRow();
      }
      // เหรียญ
      for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; c.position.z += dz; c.rotation.z += dt * 4;
        if (Math.abs(c.position.z) < .8 && Math.abs(c.position.x - S.x) < .9 && R.body.position.y < 1.2) { burst(c.position, ["#fde047","#fbbf24","#ffffff"], 26, 5); scene.remove(c); coins.splice(i, 1); S.coinN += 1; sfx.coin(); setHud(h => ({ ...h, coins:S.coinN })); }
        else if (c.position.z > 8) { scene.remove(c); coins.splice(i, 1); } }
      // อนุภาค
      for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; const v3 = pVel[i]; v3.y -= 14 * dt; pPos[i * 3] += v3.x * dt; pPos[i * 3 + 1] += v3.y * dt; pPos[i * 3 + 2] += v3.z * dt + dz;
        if (pLife[i] <= 0) pPos[i * 3 + 1] = -99; }
      pg.attributes.position.needsUpdate = true;
      // เส้นความเร็ว
      const sp = Math.max(0, (v - 14) / 16); sline.material.opacity = sp * .5;
      slSeed.forEach((s, i) => { s.z += dz * 2.2; if (s.z > 6) s.z = -40; slPos.set([s.x, s.y, s.z, s.x, s.y, s.z - 1.5 - sp * 3], i * 6); }); slg.attributes.position.needsUpdate = true;
      if (snow) { for (let i = 0; i < snowPos.length; i += 3) { snowPos[i + 1] -= dt * 2; snowPos[i + 2] += dz * .6; if (snowPos[i + 1] < 0) snowPos[i + 1] = 14; if (snowPos[i + 2] > 8) snowPos[i + 2] = -60; } snow.geometry.attributes.position.needsUpdate = true; }
      // กล้อง
      S.shake = Math.max(0, S.shake - dt * 2.5);
      const sh = S.shake * .35;
      camera.position.x += (S.x * .55 - camera.position.x) * Math.min(1, dt * 5) + (Math.random() - .5) * sh;
      camera.position.y = 4.3 + (Math.random() - .5) * sh + hop * .25;
      camera.fov = 62 + sp * 10; camera.updateProjectionMatrix();
      camera.lookAt(S.x * .7, 1.6, -12);
      sun.position.set(S.x + 6, 14, 6); sun.target.position.set(S.x, 0, -4);
      S.flash = Math.max(0, S.flash - dt * 2);
      el.style.setProperty("--flash", S.flash.toFixed(2));
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; S.over = true; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("keydown", key);
      renderer.domElement.removeEventListener("pointerdown", dn); renderer.domElement.removeEventListener("pointerup", up);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
      composer?.dispose?.(); renderer.dispose(); renderer.domElement.remove(); };
  }, []); // eslint-disable-line

  const btn = { minWidth:72, minHeight:64, borderRadius:32, border:"none", background:ui.tokens.card, color:ui.tokens.ink, fontSize:30, fontWeight:900, cursor:"pointer", boxShadow:ui.tokens.shadow };
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:8 }}>
      {hud.target && hud.on && <Prompt w={hud.target} onClick={() => ui.say(hud.target)} />}
      <div style={{ position:"relative", height:"min(58vh, 560px)", borderRadius:28, overflow:"hidden", background:th.sky[1] }}>
        <div ref={host} data-runner3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 40%, rgba(239,68,68,.75))", opacity:"var(--flash, 0)" }} />
        <div style={{ position:"absolute", left:10, top:10, right:10, display:"flex", justifyContent:"space-between", pointerEvents:"none", fontWeight:900, fontSize:16, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.5)" }}>
          <span>🏃 {Math.min(hud.round, ROUNDS)}/{ROUNDS} · ⭐ {hud.score}</span><span>🪙 {hud.coins} · {"❤️".repeat(Math.max(0, hud.hearts))}</span>
        </div>
        {!hud.on && !hud.round && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, background:"rgba(0,0,0,.25)" }}>
            <div style={{ fontWeight:900, fontSize:28, color:"#fff", textShadow:"0 3px 10px rgba(0,0,0,.5)" }}>🏃 Word Runner 3D</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textAlign:"center", padding:"0 20px", textShadow:"0 2px 6px rgba(0,0,0,.6)" }}>{th.name} · ฟังคำ แล้ววิ่งชนป้ายรูปที่ถูก<br/>ปัดนิ้ว ซ้าย/ขวา หรือแตะปุ่มด้านล่าง · เก็บเหรียญระหว่างทาง!</div>
            <button onClick={() => { ui.unlock?.(); api.current.start?.(); }} className="m3-press" style={{ ...btn, minWidth:180, fontSize:22, background:ui.tokens.primary, color:ui.tokens.onPrimary }}>▶ เริ่มวิ่ง!</button>
          </div>
        )}
        {hud.msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900 }}>{hud.msg}</div>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        <button aria-label="ซ้าย" onClick={() => api.current.left?.()} className="m3-press" style={btn}>◀</button>
        <button aria-label="กลาง" onClick={() => api.current.lane?.(1)} className="m3-press" style={btn}>●</button>
        <button aria-label="ขวา" onClick={() => api.current.right?.()} className="m3-press" style={btn}>▶</button>
      </div>
    </div>
  );
}
