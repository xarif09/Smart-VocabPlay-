// Penalty Kick 3D — ฟังคำ แล้วแตะ/ปัดไปที่รูปที่ถูกในประตู → ยิงจุดโทษ! (three.js โหลดเฉพาะตอนเปิดเกม)
// ฉาก: สนามฟุตบอลในสเตเดียมเล็ก · หญ้า PBR (Poly Haven) + ลายตัดหญ้า/เส้นสนามวาดเอง · ประตูมีตาข่ายพลิ้ว/โป่งเมื่อบอลเข้า
//      อัฒจันทร์ + คนดู (instanced) · เสาไฟสนาม · ป้าย LED · ท้องฟ้า HDRI (setupEnvironment "park")
// ตัวละคร: ผู้รักษาประตู + คนยิง = KayKit Mannequin + ท่าจาก KayKit Character Animations (CC0) · ลูกบอล Poly Haven "Dirty Football" (CC0)
// สีของโลก 3D เป็นงานศิลป์ของฉาก (ไม่ใช่สี UI) · ปุ่ม/HUD ใช้ ui.tokens
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { setupEnvironment } from "./runner/environment.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
// ทัวร์นาเมนต์ 3 นัด × 10 ลูก (≈ 5–6 นาที): รอบแบ่งกลุ่ม → รองชนะเลิศ → ชิงชนะเลิศ
// คู่แข่งยิงสลับกับเรา (จำลอง · ตามคะแนนให้สูสี) · ผู้รักษาประตูขยับไวขึ้น/พุ่งถูกทางบ่อยขึ้นทุกนัด · นัดชิงรูปสลับที่ก่อนยิง
// ไม่มีตกรอบ: แพ้ก็ได้ไปต่อ · จบด้วยถ้วย (ชนะนัดชิง = ทอง · ไม่ชนะ = เงิน)
const MATCHES = [
  { name:"รอบแบ่งกลุ่ม", opp:{ name:"TIGERS", emoji:"🐯", kit:{ shirt:"#f97316", trim:"#111827", legs:"#1f2937" } }, shots:10, p:.42, sway:.45, speed:1.5, near:.15, swap:false },
  { name:"รอบรองชนะเลิศ", opp:{ name:"SHARKS", emoji:"🦈", kit:{ shirt:"#0ea5e9", trim:"#ffffff", legs:"#0c4a6e" } }, shots:10, p:.5, sway:1.1, speed:2.1, near:.45, swap:false },
  { name:"รอบชิงชนะเลิศ", opp:{ name:"LIONS", emoji:"🦁", kit:{ shirt:"#facc15", trim:"#111827", legs:"#1f2937" } }, shots:10, p:.55, sway:1.7, speed:2.7, near:.7, swap:true },
];
const ROUNDS = MATCHES.reduce((a, m) => a + m.shots, 0);
const GZ = -9;                    // เส้นประตู (จุดโทษอยู่ที่ z = 0 · ย่อสนามลงเล็กน้อยให้เด็กเห็นรูปชัด)
const GW = 7.32, GH = 2.44;       // ขนาดประตูจริง
const CARD_Z = GZ + 2.1, CARD_Y = 1.42, CARD_X = [-2.78, 0, 2.78];
const BALL_R = .15;               // ใหญ่กว่าจริงนิดหน่อย มองเห็นง่าย
const KIT = {
  keeper: { shirt:"#facc15", trim:"#111827", legs:"#1f2937", num:"1" },
  kicker: { shirt:"#e11d2e", trim:"#ffffff", legs:"#f8fafc", num:"10" },
};

// ── ยูทิลิตี้ ──
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function emojiTexture(emoji) {
  return canvasTex(320, 240, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#fef3c7"); g.addColorStop(1, "#bae6fd"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.font = "150px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji || "⭐", w / 2, h / 2 + 8); });
}
function glowTexture() {
  return canvasTex(128, 128, x => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
}

// ลายสนาม (texture ข้อมูล): R = แถบตัดหญ้า · G = เส้นขาว · B = หญ้าสึก/ดินบริเวณจุดโทษและหน้าประตู
// ครอบคลุม x -30..30, z -40..20 (60×60 m) · บนสุดของ canvas = ฝั่งประตู
const PITCH = { x0:-30, z0:-40, size:60 };
function pitchTexture(aniso) {
  const N = 2048, k = N / PITCH.size, s = 9 / 11; // ย่อความลึกเส้นตามระยะจุดโทษ 9 m
  const X = x => (x - PITCH.x0) * k, Z = z => (z - PITCH.z0) * k;
  return (() => { const t = canvasTex(N, N, (c) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, N, N);
    c.globalCompositeOperation = "lighter";
    const band = 4.5;
    for (let z = PITCH.z0, i = 0; z < PITCH.z0 + PITCH.size; z += band, i++) { const zz = z + ((GZ - PITCH.z0) % band); if (i % 2) { c.fillStyle = "rgb(255,0,0)"; c.fillRect(0, Z(zz), N, band * k); } }
    // เส้นขาว
    c.strokeStyle = "rgb(0,255,0)"; c.lineWidth = .12 * k; c.lineCap = "butt";
    const line = (x1, z1, x2, z2) => { c.beginPath(); c.moveTo(X(x1), Z(z1)); c.lineTo(X(x2), Z(z2)); c.stroke(); };
    const box = (w, d) => { line(-w / 2, GZ, -w / 2, GZ + d); line(w / 2, GZ, w / 2, GZ + d); line(-w / 2, GZ + d, w / 2, GZ + d); };
    line(PITCH.x0, GZ, PITCH.x0 + PITCH.size, GZ);           // เส้นประตู
    box(18.32, 5.5 * s); box(40.32, 16.5 * s);
    c.fillStyle = "rgb(0,255,0)"; c.beginPath(); c.arc(X(0), Z(0), .2 * k, 0, Math.PI * 2); c.fill(); // จุดโทษ
    c.beginPath(); c.arc(X(0), Z(0), 9.15 * s * k, .62, Math.PI - .62); c.stroke();                       // วงโค้งหน้ากรอบเขตโทษ
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(X(sx * 30), Z(GZ), 1 * k, sx < 0 ? 0 : Math.PI / 2, sx < 0 ? Math.PI / 2 : Math.PI); c.stroke(); }
    // หญ้าสึก
    const wear = (x, z, r, a) => { const g = c.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), r * k); g.addColorStop(0, `rgba(0,0,255,${a})`); g.addColorStop(1, "rgba(0,0,255,0)"); c.fillStyle = g; c.fillRect(X(x) - r * k, Z(z) - r * k, 2 * r * k, 2 * r * k); };
    wear(0, 0, 1.3, .55); wear(0, GZ + .9, 2.4, .5); wear(-1.5, GZ + .7, 1.4, .35); wear(1.6, GZ + .7, 1.4, .35);
    for (let i = 0; i < 26; i++) wear((Math.random() - .5) * 7, GZ + .3 + Math.random() * 3, .2 + Math.random() * .5, .12 + Math.random() * .25);
    // เส้นขาวขอบขาดๆ เล็กน้อย
    c.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * .35})`; c.fillRect(Math.random() * N, Math.random() * N, 2, 2); }
  }, false); t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })();
}
// พื้นสนาม: ภาพหญ้าจริงเป็นรายละเอียด + ลายตัดหญ้า/เส้น/รอยสึกจาก pitchTexture
function pitchMaterial(pitchTex) {
  const REP = 30;
  const ph = new THREE.DataTexture(new Uint8Array([150, 160, 120, 255]), 1, 1); ph.needsUpdate = true; ph.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map:ph, roughness:.92, metalness:0 });
  const u = { uPitch:{ value:pitchTex }, uRep:{ value:REP }, uGreen:{ value:new THREE.Color("#3f8f2c") }, uDirt:{ value:new THREE.Color("#8a7a52") } };
  m.userData.uniforms = u; m.userData.REP = REP;
  m.customProgramCacheKey = () => "pk-pitch";
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uPitch; uniform float uRep; uniform vec3 uGreen; uniform vec3 uDirt;\nfloat pkLine = 0.0;")
      .replace("#include <map_fragment>", `
  vec4 ph = texture2D(map, vMapUv);
  float lum = dot(ph.rgb, vec3(.299, .587, .114));
  vec4 pm = texture2D(uPitch, vMapUv / uRep);
  vec3 g = uGreen * (.45 + 1.25 * lum) * mix(.84, 1.12, pm.r);
  g = mix(g, uDirt * (.6 + .8 * lum), pm.b * .75);
  pkLine = pm.g;
  g = mix(g, vec3(.93, .95, .92) * (.85 + .2 * lum), pm.g);
  diffuseColor.rgb *= g;`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, .7, pkLine);");
  };
  return m;
}
// ตาข่าย: alpha ตารางเพชร
function netTexture() {
  const t = canvasTex(64, 64, (x, w) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, w); x.strokeStyle = "#fff"; x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(w, w); x.moveTo(w, 0); x.lineTo(0, w); x.moveTo(-w / 2, w / 2); x.lineTo(w / 2, -w / 2); x.moveTo(w / 2, w * 1.5); x.lineTo(w * 1.5, w / 2); x.moveTo(-w / 2, w / 2); x.lineTo(w / 2, w * 1.5); x.moveTo(w / 2, -w / 2); x.lineTo(w * 1.5, w / 2); x.stroke(); }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// ป้าย LED หลังประตู
function boardTexture() {
  const t = canvasTex(2048, 64, (x, w, h) => {
    const P = [["#1d4ed8", "#ffffff", "VOCAB PLAY"], ["#f59e0b", "#1f2937", "⚽ KIDS CUP"], ["#16a34a", "#ffffff", "A B C"], ["#db2777", "#ffffff", "HELLO!"], ["#7c3aed", "#ffffff", "ENGLISH FUN"], ["#0ea5e9", "#ffffff", "★ ★ ★"], ["#ef4444", "#ffffff", "LET'S PLAY"], ["#111827", "#facc15", "1 2 3"]];
    const pw = w / P.length;
    P.forEach(([bg, fg, s], i) => { x.fillStyle = bg; x.fillRect(i * pw, 0, pw, h); x.fillStyle = fg; x.font = "bold 40px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, i * pw + pw / 2, h / 2 + 2); });
    x.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h); // LED grid
  });
  t.wrapS = THREE.RepeatWrapping; return t;
}
function lampTexture() {
  return canvasTex(128, 96, (x, w, h) => { x.fillStyle = "#1f2937"; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const g = x.createRadialGradient(12 + c * 21, 13 + r * 23, 0, 12 + c * 21, 13 + r * 23, 10); g.addColorStop(0, "#ffffff"); g.addColorStop(.6, "#fff6d8"); g.addColorStop(1, "#6b7280"); x.fillStyle = g; x.beginPath(); x.arc(12 + c * 21, 13 + r * 23, 9, 0, 7); x.fill(); } });
}
// เสื้อทีม: เปลี่ยนสีพาเลตของ KayKit mannequin (ครึ่งฟ้า/แดง = คอลัมน์ 5/9 · เทาเข้ม/เทา = 1/2) แยกตามชิ้น
// head: คงหน้ายิ้ม เปลี่ยนแค่ปกคอ · body/arms: เสื้อ + ขอบ · legs: กางเกง/ถุงเท้า
function kitTexture(img, kit, part) {
  const t = canvasTex(256, 256, (x, w) => {
    x.drawImage(img, 0, 0, w, w);
    const col = (i, c) => { x.fillStyle = c; x.fillRect(i * w / 10, 0, w / 10 + .5, w / 2); };
    if (part === "legs") { col(5, kit.legs); col(9, kit.legs); col(2, kit.shirt); }
    else { col(5, kit.shirt); col(9, kit.shirt); if (part !== "head") { col(1, kit.trim); col(2, kit.trim); } }
    if (part === "body") { x.fillStyle = kit.shirt; x.fillRect(w / 2, w / 2, w / 2, w / 2); }
  });
  t.flipY = false; return t;   // glTF UV (ไม่กลับแกน)
}
function makeCard(tex, aspect) {
  const g = new THREE.Group(); const W = 2.5, H = 1.85;
  const s = new THREE.Shape(); const w = W / 2 + .13, h = H / 2 + .13, r = .22;
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const fgeo = new THREE.ExtrudeGeometry(s, { depth:.08, bevelEnabled:true, bevelThickness:.04, bevelSize:.04, bevelSegments:3 }); fgeo.center();
  const frame = new THREE.Mesh(fgeo, new THREE.MeshPhysicalMaterial({ color:"#ffffff", roughness:.25, clearcoat:1, emissive:"#ffffff", emissiveIntensity:.35 }));
  frame.castShadow = true; g.add(frame);
  let pw = W, ph = W / aspect; if (ph > H) { ph = H; pw = H * aspect; }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map:tex, toneMapped:false, transparent:true }));
  pic.position.z = .09; g.add(pic);
  return { g, frame, pic };
}
// ตัวสำรองถ้าโหลดโมเดลไม่ได้
function makeProcPlayer(kit) {
  const g = new THREE.Group(); const m = c => new THREE.MeshStandardMaterial({ color:c, roughness:.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.28, .7, 6, 12), m(kit.shirt)); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 20, 14), m("#f2c9a0")); head.position.y = 1.75; g.add(head);
  for (const x of [-.13, .13]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .5, 4, 8), m(kit.trim)); l.position.set(x, .38, 0); g.add(l); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default function PenaltyKick3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const [hud, setHud] = useState({ phase:"intro", round:0, goals:0, match:0, mShot:0, res:[], opp:[], target:null, banner:null, inter:null, trophy:null, opBubble:null, sec:0, paused:false, ready:false, msg:null });

  useEffect(() => {
    const el = host.current; if (!el) return;
    const W = () => Math.max(1, el.clientWidth), H = () => Math.max(1, el.clientHeight);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" }); }
    catch (e) { setHud(h => ({ ...h, msg:"เครื่องนี้ไม่รองรับ 3D 😢" })); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement); Object.assign(renderer.domElement.style, { display:"block", touchAction:"none", width:"100%", height:"100%" });
    let aniso = 4; try { aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1); } catch (e) {}

    let alive = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a9c8e8");
    scene.fog = new THREE.Fog("#c9d6e2", 70, 260);
    const camera = new THREE.PerspectiveCamera(42, W() / H(), .1, 900);
    camera.position.set(9, 3, 2); camera.lookAt(0, 1.2, GZ);

    // ── แสง ──
    const hemi = new THREE.HemisphereLight("#cfe3ff", "#4d7a32", .6); scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff1dc", 2.8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
    Object.assign(sun.shadow.camera, { left:-16, right:16, top:16, bottom:-16, near:1, far:90 }); scene.add(sun, sun.target);
    const sunDir = new THREE.Vector3(.4, .75, .5).normalize();
    const placeSun = () => { sun.position.copy(sunDir).multiplyScalar(45).add(new THREE.Vector3(0, 0, GZ + 3)); sun.target.position.set(0, 0, GZ + 3); };
    placeSun();

    // ── พื้นสนาม ──
    const pTex = pitchTexture(aniso);
    const pMat = pitchMaterial(pTex);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH.size, PITCH.size), pMat);
    pitch.rotation.x = -Math.PI / 2; pitch.position.set(PITCH.x0 + PITCH.size / 2, 0, PITCH.z0 + PITCH.size / 2); pitch.receiveShadow = true; scene.add(pitch);
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color:"#5b6b4a", roughness:1 }));
    surround.rotation.x = -Math.PI / 2; surround.position.y = -.02; scene.add(surround);
    // หญ้าจริง (Poly Haven leafy_grass) เป็นรายละเอียดพื้น
    { const tl = new THREE.TextureLoader(); const REP = pMat.userData.REP;
      const ld = (k, srgb) => new Promise(res => tl.load(`${BASE}3d/tex/leafy_grass_${k}.jpg`, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(REP, REP); t.anisotropy = aniso; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; res(t); }, undefined, () => res(null)));
      Promise.all([ld("diff", true), ld("nor", false), ld("rough", false)]).then(([d, n, r]) => {
        if (!alive) { [d, n, r].forEach(t => t?.dispose()); return; }
        if (d) { pMat.map.dispose(); pMat.map = d; }
        if (n) { pMat.normalMap = n; pMat.normalScale.set(.6, .6); }
        if (r) pMat.roughnessMap = r;
        pMat.needsUpdate = true;
      }); }

    // ── ท้องฟ้า HDRI + IBL (park) ──
    let env = null;
    setupEnvironment({ THREE, renderer, scene, theme:"park", BASE }).then(e => {
      if (!alive) { e.dispose(); return; } env = e;
      sunDir.copy(e.sunDir); if (sunDir.z < .2) sunDir.z = .45; sunDir.normalize(); placeSun();   // ให้แดดส่องจากฝั่งกล้อง → ผู้รักษาประตูไม่มืด
      sun.color.copy(e.sunColor); sun.intensity = e.sunIntensity; hemi.intensity = e.hemiIntensity;
      scene.fog.color.copy(e.fogColor);
      try { e.groundMaterial.dispose(); e.roadMaterial.dispose(); } catch (_) {}
    }).catch(() => {});

    // ── ประตู + ตาข่าย ──
    const goal = new THREE.Group(); goal.position.z = GZ; scene.add(goal);
    const postMat = new THREE.MeshStandardMaterial({ color:"#ffffff", roughness:.28, metalness:.1 });
    const PR = .065;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, GH + PR, 20), postMat); p.position.set(sx * GW / 2, (GH + PR) / 2, 0); p.castShadow = true; goal.add(p); }
    { const bar = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, GW + PR * 2, 20), postMat); bar.rotation.z = Math.PI / 2; bar.position.y = GH; bar.castShadow = true; goal.add(bar); }
    // รูปตัดข้างของตาข่าย (z, y) จากพื้นด้านหลัง → หลังคา → คาน
    const PROF = [[-2.0, 0], [-1.7, 1.95], [-.9, 2.3], [0, GH]];
    const profLen = []; { let L = 0; profLen.push(0); for (let i = 1; i < PROF.length; i++) { L += Math.hypot(PROF[i][0] - PROF[i - 1][0], PROF[i][1] - PROF[i - 1][1]); profLen.push(L); } }
    const PL = profLen[profLen.length - 1];
    const profAt = v => { const d = v * PL; let i = 1; while (i < PROF.length - 1 && profLen[i] < d) i++; const t = (d - profLen[i - 1]) / (profLen[i] - profLen[i - 1]); return [PROF[i - 1][0] + (PROF[i][0] - PROF[i - 1][0]) * t, PROF[i - 1][1] + (PROF[i][1] - PROF[i - 1][1]) * t]; };
    const nTex = netTexture(); const CELL = .16;
    const netMat = new THREE.MeshStandardMaterial({ color:"#ffffff", alphaMap:nTex, transparent:true, side:THREE.DoubleSide, roughness:.85, depthWrite:false });
    const NU = 44, NV = 26;
    const netGeo = new THREE.PlaneGeometry(1, 1, NU, NV);
    const nBase = new Float32Array(netGeo.attributes.position.count * 3);
    { const p = netGeo.attributes.position, uv = netGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) { const u = uv.getX(i), v = uv.getY(i); const [z, y] = profAt(v); nBase.set([(u - .5) * GW, y, z], i * 3); p.setXYZ(i, (u - .5) * GW, y, z); uv.setXY(i, u * GW / CELL, v * PL / CELL); }
      netGeo.computeVertexNormals(); }
    const net = new THREE.Mesh(netGeo, netMat); net.frustumCulled = false; goal.add(net);
    for (const sx of [-1, 1]) { // ตาข่ายด้านข้าง
      const sh = new THREE.Shape(PROF.map(([z, y]) => new THREE.Vector2(z, y)).concat([new THREE.Vector2(0, 0)]));
      const sg = new THREE.ShapeGeometry(sh); const p = sg.attributes.position, uv = sg.attributes.uv;
      for (let i = 0; i < p.count; i++) { const z = p.getX(i), y = p.getY(i); p.setXYZ(i, sx * GW / 2, y, z); uv.setXY(i, z / CELL, y / CELL); }
      sg.computeVertexNormals(); goal.add(new THREE.Mesh(sg, netMat));
      // เสาค้ำด้านหลัง
      const curve = new THREE.CatmullRomCurve3(PROF.map(([z, y]) => new THREE.Vector3(sx * GW / 2, y, z)), false, "catmullrom", .1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .025, 6), new THREE.MeshStandardMaterial({ color:"#9ca3af", metalness:.6, roughness:.35 })); goal.add(tube);
    }
    { const back = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, GW, 6), new THREE.MeshStandardMaterial({ color:"#9ca3af", metalness:.6, roughness:.35 })); back.rotation.z = Math.PI / 2; back.position.set(0, .03, PROF[0][0]); goal.add(back); }
    const ripple = { x:0, y:1, t:99, a:0 };

    // ── ป้าย LED + อัฒจันทร์ + คนดู + เสาไฟ ──
    const bTex = boardTexture(); bTex.repeat.set(2, 1);
    const boardMat = new THREE.MeshStandardMaterial({ color:"#222", emissive:"#ffffff", emissiveMap:bTex, emissiveIntensity:1.05, roughness:.5 });
    { const b = new THREE.Mesh(new THREE.BoxGeometry(56, .95, .15), [new THREE.MeshStandardMaterial({ color:"#111827" }), new THREE.MeshStandardMaterial({ color:"#111827" }), new THREE.MeshStandardMaterial({ color:"#111827" }), new THREE.MeshStandardMaterial({ color:"#111827" }), boardMat, new THREE.MeshStandardMaterial({ color:"#111827" })]);
      b.position.set(0, .48, GZ - 4.6); b.castShadow = true; scene.add(b); }
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.15, .95, 26), boardMat); b.position.set(sx * 17, .48, GZ + 6); b.rotation.y = 0; scene.add(b); }
    const concrete = new THREE.MeshStandardMaterial({ color:"#9aa1a9", roughness:.95 });
    const seatMat = new THREE.MeshStandardMaterial({ color:"#1e40af", roughness:.6 });
    const crowdSpots = [];
    const stand = (cx, cz, len, rotY, tiers) => {
      const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; scene.add(g);
      for (let i = 0; i < tiers; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(len, .55 * (i + 1) + .4, .95), concrete); step.position.set(0, (.55 * (i + 1) + .4) / 2, -i * .95); step.receiveShadow = true; g.add(step);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(len, .12, .35), seatMat); seat.position.set(0, .55 * (i + 1) + .46, -i * .95 + .1); g.add(seat);
        for (let x = -len / 2 + .4; x < len / 2 - .3; x += .58) if (Math.random() < .86) crowdSpots.push({ g, x:x + (Math.random() - .5) * .14, y:.55 * (i + 1) + .4, z:-i * .95 - .05 });
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, .55 * tiers + 3.2, .4), concrete); wall.position.set(0, (.55 * tiers + 3.2) / 2, -tiers * .95 - .1); g.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 1, .25, tiers * .95 + 2.5), new THREE.MeshStandardMaterial({ color:"#e5e7eb", roughness:.5, metalness:.3 }));
      roof.position.set(0, .55 * tiers + 3.2, -tiers * .95 / 2 + .6); roof.rotation.x = -.08; roof.castShadow = true; g.add(roof);
      for (let x = -len / 2 + 2; x <= len / 2 - 2; x += 8) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .55 * tiers + 3.2, 8), new THREE.MeshStandardMaterial({ color:"#6b7280", metalness:.5, roughness:.4 })); col.position.set(x, (.55 * tiers + 3.2) / 2, -tiers * .95 + .2); g.add(col); }
      return g;
    };
    stand(0, GZ - 7.5, 46, 0, 9);
    stand(-19.5, GZ + 9, 30, Math.PI / 2, 7);
    stand(19.5, GZ + 9, 30, -Math.PI / 2, 7);
    // คนดู = ตัว + หัว (2 instanced meshes)
    const NC = crowdSpots.length;
    const bodyGeo = new THREE.CapsuleGeometry(.19, .32, 2, 6); bodyGeo.translate(0, .36, 0);
    const headGeo = new THREE.IcosahedronGeometry(.14, 1); headGeo.translate(0, .82, 0);
    const crowdBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness:.8 }), NC);
    const crowdHead = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness:.7 }), NC);
    const SHIRTS = ["#dc2626", "#dc2626", "#facc15", "#ffffff", "#2563eb", "#dc2626", "#16a34a", "#f97316", "#111827", "#ec4899", "#ffffff", "#dc2626"];
    const SKIN = ["#f1c8a0", "#d9a77a", "#a8774f", "#7a5236", "#f6d6b8"];
    const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cv = new THREE.Vector3(), cs = new THREE.Vector3(1, 1, 1), cw = new THREE.Vector3();
    const crowd = crowdSpots.map((s, i) => { s.g.updateMatrixWorld(true); const wp = s.g.localToWorld(new THREE.Vector3(s.x, s.y, s.z));
      crowdBody.setColorAt(i, new THREE.Color(SHIRTS[Math.floor(Math.random() * SHIRTS.length)])); crowdHead.setColorAt(i, new THREE.Color(SKIN[Math.floor(Math.random() * SKIN.length)]));
      return { p:wp, ry:s.g.rotation.y, ph:Math.random() * 6.3, sp:.8 + Math.random() * .6, sc:.9 + Math.random() * .25 }; });
    const cheerAmt = { v:0 };
    const updateCrowd = t => {
      const ch = cheerAmt.v;
      for (let i = 0; i < NC; i++) { const c = crowd[i];
        const jump = ch > 0 ? Math.max(0, Math.sin(t * 9 * c.sp + c.ph)) * .32 * ch : 0;
        const idle = Math.sin(t * 1.3 * c.sp + c.ph) * .025;
        cq.setFromAxisAngle(cw.set(0, 1, 0), c.ry + Math.sin(t * .7 + c.ph) * .15); cv.copy(c.p); cv.y += jump + idle; cs.setScalar(c.sc);
        cm.compose(cv, cq, cs); crowdBody.setMatrixAt(i, cm); crowdHead.setMatrixAt(i, cm); }
      crowdBody.instanceMatrix.needsUpdate = true; crowdHead.instanceMatrix.needsUpdate = true;
    };
    updateCrowd(0); scene.add(crowdBody, crowdHead);
    // ธง + แขนโบก (ป้ายสีๆ ในกลุ่มคนดู)
    const flags = [];
    { const fc = ["#dc2626", "#facc15", "#2563eb", "#16a34a", "#ffffff"];
      for (let i = 0; i < 16; i++) { const c = crowd[Math.floor(Math.random() * NC)]; if (!c) break;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(.9, .55), new THREE.MeshStandardMaterial({ color:fc[i % fc.length], side:THREE.DoubleSide, roughness:.8 }));
        f.position.copy(c.p).add(new THREE.Vector3(0, 1.45, 0)); f.rotation.y = c.ry; f.userData.ph = Math.random() * 6; scene.add(f); flags.push(f); } }
    // เสาไฟสนาม
    const glow = glowTexture();
    const lampMat = new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:"#ffffff", emissiveMap:lampTexture(), emissiveIntensity:2.2 });
    for (const [x, z] of [[-24, GZ - 11], [24, GZ - 11], [-26, 14], [26, 14]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.22, .4, 24, 10), new THREE.MeshStandardMaterial({ color:"#9ca3af", metalness:.6, roughness:.4 })); pole.position.y = 12; pole.castShadow = true; g.add(pole);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, .3), [concrete, concrete, concrete, concrete, lampMat, concrete]); panel.position.y = 25; g.add(panel);
      g.lookAt(0, 0, GZ + 4); panel.rotation.x = .35;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:"#fff6dc", transparent:true, opacity:.55, depthWrite:false, blending:THREE.AdditiveBlending })); halo.scale.set(9, 7, 1); halo.position.set(0, 25, .6); g.add(halo);
    }

    // ── ลูกบอล ──
    const ball = new THREE.Group(); scene.add(ball);
    const ballFallback = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 3), new THREE.MeshStandardMaterial({ map:canvasTex(256, 128, (x, w, h) => { x.fillStyle = "#f8fafc"; x.fillRect(0, 0, w, h); x.fillStyle = "#111827"; for (let i = 0; i < 10; i++) { const cx = (i % 5) * w / 5 + (i > 4 ? w / 10 : 0) + 20, cy = i > 4 ? h * .72 : h * .28; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); } x.fill(); } }), roughness:.45 }));
    ballFallback.castShadow = true; ball.add(ballFallback);
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.2, 24), new THREE.MeshBasicMaterial({ color:"#000", transparent:true, opacity:.3, depthWrite:false }));
    ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
    // หางลูกบอล
    const TN = 28, trail = [], trailPos = [];
    for (let i = 0; i < TN; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:i < 6 ? "#ffffff" : "#fde68a", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending })); sp.scale.setScalar(.4); scene.add(sp); trail.push(sp); }

    // วงเป้าที่ลูกพุ่งไปหา
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map:canvasTex(128, 128, x => { x.strokeStyle = "#fff"; x.shadowColor = "#fde047"; x.shadowBlur = 14; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.stroke(); x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 22, 0, 7); x.stroke(); }),
      color:"#fde047", transparent:true, opacity:0, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending }));
    ring.scale.setScalar(1.1); ring.visible = false; ring.renderOrder = 5; scene.add(ring);
    // ── อนุภาค (ฝุ่นหญ้า/ประกาย) ──
    const PN = 500, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = Array.from({ length:PN }, () => new THREE.Vector3()), pLife = new Float32Array(PN);
    for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:.32, map:glow, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false })); pts.frustumCulled = false; scene.add(pts); let pIdx = 0;
    const burst = (pos, colors, n = 80, power = 6, up = .9, grav = 9) => { for (let k = 0; k < n; k++) { const i = pIdx++ % PN; pPos.set([pos.x, pos.y, pos.z], i * 3); const c = new THREE.Color(colors[k % colors.length]); pCol.set([c.r, c.g, c.b], i * 3);
      pVel[i].set((Math.random() - .5) * power, Math.random() * power * up, (Math.random() - .5) * power); pVel[i].g = grav; pLife[i] = .7 + Math.random() * .6; } };
    // ── กระดาษสี ──
    const CN = 260;
    const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.13, .08), new THREE.MeshStandardMaterial({ side:THREE.DoubleSide, roughness:.5, emissive:"#222" }), CN);
    conf.frustumCulled = false; scene.add(conf);
    const CC = ["#f43f5e", "#facc15", "#22d3ee", "#a3e635", "#ffffff", "#c084fc", "#fb923c"];
    const confS = Array.from({ length:CN }, (_, i) => { conf.setColorAt(i, new THREE.Color(CC[i % CC.length])); return { p:new THREE.Vector3(0, -50, 0), v:new THREE.Vector3(), r:new THREE.Euler(), w:new THREE.Vector3(), life:0 }; });
    const hideM = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < CN; i++) conf.setMatrixAt(i, hideM);
    const confetti = () => { confS.forEach(c => { c.p.set((Math.random() - .5) * 9, 3 + Math.random() * 3.5, GZ + 1.5 + (Math.random() - .5) * 4); c.v.set((Math.random() - .5) * 2.5, Math.random() * 2.5, (Math.random() - .3) * 2.5);
      c.w.set(Math.random() * 9, Math.random() * 9, Math.random() * 9); c.life = 3 + Math.random() * 1.5; }); };

    // ── ตัวละคร ──
    const makeActor = kit => ({ root:new THREE.Group(), kit, mixer:null, actions:{}, cur:null });
    const keeper = makeActor(KIT.keeper), kicker = makeActor(KIT.kicker);
    scene.add(keeper.root, kicker.root);
    const play = (A, name, { once = false, fade = .15, speed = 1 } = {}) => {
      const a = A.actions[name]; if (!a) return null;
      a.reset(); a.timeScale = speed; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once;
      if (A.cur && A.cur !== a) { a.crossFadeFrom(A.cur, fade, false); } a.play(); A.cur = a; return a;
    };
    const ballLoader = new GLTFLoader();
    let kitImg = null; const kitTexs = new Set();
    // ชุดผู้รักษาประตู = สีทีมคู่แข่งของนัดนั้น
    const dressKeeper = kit => {
      if (!kitImg || !keeper.model) return; const tex = { head:kitTexture(kitImg, kit, "head"), body:kitTexture(kitImg, kit, "body"), legs:kitTexture(kitImg, kit, "legs") };
      keeper.model.traverse(o => { if (o.isMesh && o.material?.map) { const old = o.material.map; o.material.map = /Head/.test(o.name) ? tex.head : /Leg/.test(o.name) ? tex.legs : tex.body; o.material.needsUpdate = true; if (kitTexs.has(old)) { kitTexs.delete(old); old.dispose(); } } });
      Object.values(tex).forEach(t => kitTexs.add(t));
    };
    const P_SCALE = .84;  // mannequin สูง 2.2 → ~1.85 m
    const assetsP = Promise.all([
      ballLoader.loadAsync(`${BASE}models/sports/player.glb`).then(gltf => {
        if (!alive) return;
        let img = null; gltf.scene.traverse(o => { if (o.isMesh && o.material.map && !img) img = o.material.map.image; });
        kitImg = img;
        for (const A of [keeper, kicker]) {
          const m = cloneSkinned(gltf.scene); m.scale.setScalar(P_SCALE);
          const tex = img ? { head:kitTexture(img, A.kit, "head"), body:kitTexture(img, A.kit, "body"), legs:kitTexture(img, A.kit, "legs") } : null;
          if (tex && A === keeper) Object.values(tex).forEach(t => kitTexs.add(t));
          m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = .5;
            if (tex) o.material.map = /Head/.test(o.name) ? tex.head : /Leg/.test(o.name) ? tex.legs : tex.body; } });
          A.root.add(m); A.model = m; A.mixer = new THREE.AnimationMixer(m);
          gltf.animations.forEach(c => { A.actions[c.name] = A.mixer.clipAction(c); });
        }
        // ถุงมือผู้รักษาประตู
        const glove = new THREE.MeshStandardMaterial({ color:"#16a34a", roughness:.5 });
        for (const side of ["l", "r"]) { const hand = keeper.model.getObjectByName(`hand.${side}`) || keeper.model.getObjectByName(`wrist.${side}`);
          if (hand) { const gm = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), glove); gm.scale.set(1, 1.15, .7); gm.position.y = .08; gm.castShadow = true; hand.add(gm); } }
        play(keeper, "Melee_Unarmed_Idle"); play(kicker, "Idle_A");
      }).catch(() => { keeper.root.add(makeProcPlayer(KIT.keeper)); kicker.root.add(makeProcPlayer(KIT.kicker)); }),
      ballLoader.loadAsync(`${BASE}models/sports/football.glb`).then(gltf => {
        if (!alive) return;
        const m = gltf.scene; const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
        const s = BALL_R * 2 / Math.max(size.x, size.y, size.z); m.scale.setScalar(s); m.position.copy(c).multiplyScalar(-s);
        m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material.envMapIntensity = 1; } } });
        const w = new THREE.Group(); w.add(m); ball.remove(ballFallback); ball.add(w);
      }).catch(() => {}),
    ]);
    const readyTimer = setTimeout(() => alive && setHud(h => ({ ...h, ready:true })), 7000);
    assetsP.then(() => { if (alive) { clearTimeout(readyTimer); setHud(h => ({ ...h, ready:true })); } });

    // ── bloom ──
    let composer = null;
    try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), .32, .35, 1.0)); composer.addPass(new OutputPass()); } catch (e) { composer = null; }

    // ── สถานะเกม ──
    const S = { phase:"intro", round:0, goals:0, t:0, gt:0, pt:0, slow:1, row:null, shot:null, events:[], later:[], camMode:"intro", camT:0, shake:0, cheer:0,
      match:0, mShot:0, res:[], opp:[], shots:0, paused:false, playT:0, sec:-1, swapping:false, champ:false };
    const FAST = (typeof window !== "undefined" && +window.__VP_FAST) || 1;   // ชุดทดสอบเร่งจังหวะได้
    const after = (dt, fn) => S.events.push({ at:S.gt + dt, fn });                // เวลาในฉาก (ช้าลงตอนสโลว์)
    const later = (ms, fn) => S.later.push({ at:S.pt + ms / 1000 / FAST, fn });  // เวลาจริงของเกม (หยุดเมื่อพัก)
    const M = () => MATCHES[Math.min(S.match, MATCHES.length - 1)];
    const sum = a => a.reduce((x, y) => x + y, 0);
    const hudScore = (x = {}) => setHud(h => ({ ...h, round:S.round, goals:S.goals, match:S.match, mShot:S.mShot, res:S.res.slice(), opp:S.opp.slice(), ...x }));
    const KICK0 = new THREE.Vector3(-2.3, 0, 1.3), KICK1 = new THREE.Vector3(-.42, 0, .42);
    const resetActors = () => {
      keeper.root.position.set(0, 0, GZ + .45); keeper.root.rotation.set(0, 0, 0); keeper.dive = null;
      kicker.root.position.copy(KICK0); kicker.root.rotation.set(0, Math.atan2(KICK1.x - KICK0.x, KICK1.z - KICK0.z), 0); kicker.run = null;
      play(keeper, "Melee_Unarmed_Idle", { fade:.3 }); play(kicker, "Idle_A", { fade:.3 });
      ball.position.set(0, BALL_R, 0); ball.rotation.set(0, 0, 0); S.shot = null; S.ballV = null; S.held = false;
      trailPos.length = 0;
    };
    resetActors();

    const pool = words.length >= 3 ? words : words.concat(words, words);
    const loader = new THREE.TextureLoader(); const texCache = new Map();
    const texFor = w => new Promise(res => {
      if (texCache.has(w.id)) return res(texCache.get(w.id));
      let url = null; try { url = ui.imageUrl(w); } catch (_) {}
      const fb = () => { const t = { tex:emojiTexture(w.emoji), aspect:4 / 3 }; texCache.set(w.id, t); res(t); };
      if (!url) return fb();
      loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; const v = { tex:t, aspect:(t.image.width / t.image.height) || 4 / 3 }; texCache.set(w.id, v); res(v); }, undefined, fb);
    });
    const used = new Set();
    const pickTarget = () => { const cand = pool.filter(w => !used.has(w.id)); const arr = cand.length ? cand : pool; const w = arr[Math.floor(Math.random() * arr.length)]; used.add(w.id); return w; };
    const clearRow = () => { const r = S.row; if (!r) return; r.cards.forEach(c => { scene.remove(c.g); c.frame.geometry.dispose(); c.frame.material.dispose(); c.pic.geometry.dispose(); c.pic.material.dispose(); c.halo.material.dispose(); }); S.row = null; };
    const HALO = ["#22d3ee", "#f0abfc", "#fde047"];
    const startRound = async pre => {
      const target = pre || pickTarget();
      const others = pool.filter(w => w.id !== target.id && w.word !== target.word).sort(() => Math.random() - .5).slice(0, 2);
      const set = [target, ...others].sort(() => Math.random() - .5);
      S.round += 1; S.mShot += 1; const myRound = S.round;
      S.events.length = 0; resetActors(); S.camMode = "aim"; S.phase = "load"; S.swapping = false;
      hudScore({ phase:"aim", target, banner:null, opBubble:null });
      if (!pre) ui.say(target);
      const texs = await Promise.all(set.map(texFor));
      if (!alive || myRound !== S.round) return;
      clearRow();
      const cards = set.map((w, i) => { const c = makeCard(texs[i].tex, texs[i].aspect); c.g.position.set(CARD_X[i], CARD_Y, CARD_Z); c.g.scale.setScalar(.01); scene.add(c.g);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:HALO[i], transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending })); halo.scale.set(3.8, 3.1, 1); halo.position.z = -.15; c.g.add(halo);
        return { ...c, halo, w, i, slot:i, home:new THREE.Vector3(CARD_X[i], CARD_Y, CARD_Z), tilt:CARD_X[i] ? -Math.sign(CARD_X[i]) * .06 : 0, born:S.t + i * .08, state:"in", k:0 }; });
      S.row = { cards, target }; S.phase = "aim";
      el.dataset.answer = String(set.indexOf(target));   // ใช้ในชุดทดสอบอัตโนมัติ (ช่องซ้าย/กลาง/ขวา)
      // นัดชิง: รูป 2 ใบสลับที่กันก่อนยิง (ดูให้ดี!)
      if (M().swap) { S.swapping = true; later(900, () => { if (S.row !== cards.__row) return; const [a, b] = [0, 1, 2].sort(() => Math.random() - .5);
        const A = cards[a], B = cards[b]; A.sw = { from:A.home.clone(), to:B.home.clone(), k:0, arc:1 }; B.sw = { from:B.home.clone(), to:A.home.clone(), k:0, arc:-1 };
        [A.slot, B.slot] = [B.slot, A.slot]; el.dataset.answer = String(cards.find(c => c.w.id === target.id).slot); sfx.tap?.(); }); cards.__row = S.row; }
    };
    const finish = early => { if (S.phase === "over") return; S.phase = "over";
      const total = early ? Math.max(1, S.shots) : ROUNDS;
      setHud(h => ({ ...h, phase:"over", inter:null, paused:false, banner:null }));
      const label = early ? `ยิงเข้า ${S.goals}/${total}` : `${S.champ ? "🏆 แชมป์!" : "🥈 รองแชมป์!"} ยิงเข้า ${S.goals}/${total}`;
      setTimeout(() => { if (alive) track.finish(S.goals, total, { label }); }, early ? 50 : 900); };
    // คู่แข่งยิงสลับกับเรา (ผลจำลอง · ปรับให้สูสี ไม่ทิ้งห่าง)
    const oppShot = () => {
      const diff = sum(S.res) - sum(S.opp); let p = M().p; if (diff >= 2) p += .2; if (diff <= -1) p -= .3; p = clamp(p, .1, .9);
      const g = Math.random() < p ? 1 : 0; S.opp.push(g);
      hudScore({ opBubble:{ g, id:Math.random() } });
    };
    // จบนัด → สรุปผล → นัดต่อไป (หรือถ้วยรางวัล)
    const matchEnd = () => {
      S.phase = "inter"; clearRow(); S.camMode = "intro";
      const our = sum(S.res), op = sum(S.opp), last = S.match >= MATCHES.length - 1;
      const res = our > op ? "win" : our === op ? "draw" : "lose";
      if (res === "win") { confetti(); cheerAmt.v = 1; sfx.win?.(); } else sfx.coin?.();
      if (last) {
        S.champ = res !== "lose"; showTrophy(S.champ);   // เสมอนัดชิง = แชมป์ร่วม (เด็กไม่ผิดหวัง)
        hudScore({ phase:"inter", target:null, inter:null, trophy:{ gold:S.champ, our, op, id:Math.random() } });
        later(4200, () => finish(false)); return;
      }
      const N = MATCHES[S.match + 1];
      hudScore({ phase:"inter", target:null, inter:{ title:`จบ${M().name}`, our, op, opp:M().opp, res, next:N } });
      later(9000, () => nextMatch(false));
    };
    const nextMatch = fromClick => {
      if (S.phase !== "inter" || S.match >= MATCHES.length - 1) return;
      S.match += 1; S.mShot = 0; S.res = []; S.opp = []; cheerAmt.v = 0; dressKeeper(M().opp.kit);
      hudScore({ inter:null });
      if (fromClick) { const t = pickTarget(); ui.say(t); startRound(t); } else startRound();   // กดปุ่ม → พูดคำแรกในคลิก (iOS)
    };
    const banner = (kind, text) => { setHud(h => ({ ...h, banner:{ kind, text, id:Math.random() } })); };

    // ยิง!
    const chooseSlot = k => { const c = S.row?.cards.find(c => c.slot === k); if (c) choose(c.i); };
    const choose = i => {
      if (S.phase !== "aim" || !S.row || S.paused || S.swapping) return;
      const r = S.row; const card = r.cards[i]; if (!card) return;
      S.phase = "shot"; sfx.tap();
      const ok = card.w.id === r.target.id;
      const tx = card.home.x * .92, ty = .95 + Math.random() * .7;
      let kind = "goal";
      if (!ok) kind = Math.abs(card.home.x) < .5 ? "catch" : ((S.round % 2) ? "save" : "post");
      const aimPt = kind === "post" ? new THREE.Vector3(Math.sign(tx) * (GW / 2 - .02), 1.25, GZ) : kind === "catch" ? new THREE.Vector3(0, 1.15, GZ + .75) : new THREE.Vector3(tx, ty, GZ - 1.3);
      const curveSide = tx === 0 ? (Math.random() < .5 ? -1 : 1) : -Math.sign(tx);
      S.shot = { ok, kind, i, card, aimPt, p0:new THREE.Vector3(0, BALL_R, 0), ctrl:new THREE.Vector3(curveSide * 1.6 + tx * .3, 1.4 + ty * .3, (GZ) * .5), t:0, dur:kind === "catch" ? .85 : 1.0, launched:false, resolved:false };
      r.cards.forEach(c => { if (c !== card) { c.state = "out"; c.k = 0; } });
      card.state = "chosen";
      // คนยิงวิ่งเข้าหาลูก
      kicker.run = { t:0, dur:.55 }; play(kicker, "Running_A", { fade:.1, speed:1.2 });
      setHud(h => ({ ...h, phase:"shot" }));
    };
    const launch = () => {
      const sh = S.shot; if (!sh || sh.launched) return; sh.launched = true; S.camMode = "follow"; S.camT = 0;
      sh.card.state = "pop"; sh.card.k = 0; burst(sh.card.g.position.clone(), ["#fde047", "#ffffff", "#22d3ee"], 60, 4);
      ring.position.copy(sh.aimPt); if (sh.kind === "goal") ring.position.z = GZ - .05; ring.visible = true; ring.material.opacity = 0;
      burst(new THREE.Vector3(0, .05, 0), ["#c7d9a0", "#9fbf6a", "#ffffff"], 26, 2.4, .7);
      sfx.coin?.();
      // ผู้รักษาประตูพุ่ง
      const tx = sh.aimPt.x;
      let dir, reach;
      const near = sh.kind === "goal" && Math.abs(tx) > .5 && Math.random() < M().near;   // ผู้รักษาประตูเก่งขึ้น: พุ่งถูกทางแต่เอื้อมไม่ถึง
      if (near) { dir = Math.sign(tx); reach = Math.abs(tx) + .55; }
      else if (sh.kind === "goal") { dir = tx === 0 ? (Math.random() < .5 ? -1 : 1) : -Math.sign(tx); reach = 2.3; }
      else if (sh.kind === "save") { dir = Math.sign(tx); reach = Math.abs(tx); }
      else if (sh.kind === "post") { dir = Math.sign(tx); reach = 2.6; }
      else dir = 0;
      after(.12, () => {
        if (dir === 0) { play(keeper, "Melee_Block", { once:true, fade:.08, speed:1.3 }); return; }
        keeper.dive = { t:0, dur:near ? .5 : .55, dir, x0:keeper.root.position.x, x1:dir * Math.max(.6, reach - 1.25) };
        play(keeper, "Jump_Full_Short", { once:true, fade:.08, speed:1.6 });
      });
    };
    const resolve = () => {
      const sh = S.shot; if (!sh || sh.resolved) return; sh.resolved = true;
      S.camMode = "hold"; S.hold = { x:sh.ok ? clamp(ball.position.x, -3, 3) : 0 }; ring.visible = false;
      const r = S.row; const target = r.target;
      if (sh.ok) {
        S.goals += 1; S.res.push(1);
        ripple.x = ball.position.x; ripple.y = ball.position.y; ripple.t = 0; ripple.a = .55;
        S.ballV = new THREE.Vector3(0, -.5, -1.2); S.inNet = true;
        burst(ball.position.clone(), ["#fde047", "#f472b6", "#22d3ee", "#a3e635", "#ffffff"], 160, 7);
        confetti(); cheerAmt.v = 1; S.shake = .5;
        ui.correct(target); sfx.win?.();
        banner("goal", keeper.dive && Math.sign(keeper.dive.dir) === Math.sign(ball.position.x) ? "GOAL! เฉียดมือ! ⚽" : "GOAL! ⚽");
        play(kicker, "Cheering", { fade:.2 });
        if (keeper.dive) {} else play(keeper, "Hit_A", { once:true });
      } else {
        S.res.push(0);
        if (sh.kind === "catch") { S.held = true; S.ballV = null; banner("save", "เซฟได้! 🧤"); after(.7, () => play(keeper, "Cheering", { fade:.25 })); }
        else if (sh.kind === "save") { S.ballV = new THREE.Vector3(Math.sign(ball.position.x) * 3.5, 4.5, 7); banner("save", "เซฟได้! 🧤"); burst(ball.position.clone(), ["#ffffff", "#e5e7eb"], 40, 4); }
        else { S.ballV = new THREE.Vector3(-Math.sign(ball.position.x) * 2.5, 1.5, 8.5); banner("post", "โดนเสา! 💥"); burst(ball.position.clone(), ["#ffffff", "#fde68a"], 50, 5); S.shake = .7; }
        S.shake = Math.max(S.shake, .35);
        ui.wrong(target);
        play(kicker, "Hit_A", { once:true, fade:.15 });
        // โชว์รูปที่ถูก
        // โชว์รูปที่ถูกลอยกลางประตู
        r.cards.forEach(c => { if (c.w.id === target.id) { c.state = "reveal"; c.born = S.t + .35; c.k = 0; c.g.visible = true; c.g.rotation.z = 0; c.home.set(0, 2.2, GZ - .3); c.tilt = 0; c.g.position.copy(c.home);
          c.frame.material.emissive.set("#22c55e"); c.frame.material.emissiveIntensity = 1.3; } });
        later(1100, () => { if (S.row === r) ui.say(target); });
      }
      S.shots += 1;
      hudScore();
      later(sh.ok ? 1250 : 1500, oppShot);
      later(sh.ok ? 2600 : 3200, () => {
        cheerAmt.v = 0;
        if (S.mShot >= M().shots) { matchEnd(); return; }
        startRound();
      });
    };
    // ถ้วยรางวัล 3 มิติ (ทอง = แชมป์ · เงิน = รองแชมป์)
    let trophy = null;
    const showTrophy = gold => {
      const g = new THREE.Group(); const mat = new THREE.MeshPhysicalMaterial({ color:gold ? "#f5c542" : "#d7dde5", metalness:1, roughness:.22, clearcoat:.6, emissive:gold ? "#5a3d00" : "#30363d", emissiveIntensity:.35 });
      const prof = [[0, 0], [.42, 0], [.42, .12], [.16, .2], [.1, .42], [.09, .62], [.2, .7], [.4, .86], [.46, 1.22], [.44, 1.24], [.38, .9], [0, .8]].map(([x, y]) => new THREE.Vector2(x, y));
      const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat); cup.castShadow = true; g.add(cup);
      for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(.17, .035, 10, 24, Math.PI * 1.25), mat); h.position.set(sx * .47, 1.0, 0); h.rotation.z = sx > 0 ? -Math.PI * .62 : Math.PI * 1.62; g.add(h); }
      const base = new THREE.Mesh(new THREE.BoxGeometry(.7, .22, .7), new THREE.MeshStandardMaterial({ color:"#3b2a1a", roughness:.5 })); base.position.y = -.11; g.add(base);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), mat); star.position.y = 1.5; g.add(star);
      g.position.set(0, -1.5, GZ + 2.4); g.scale.setScalar(1.15); scene.add(g); trophy = { g, t:0 };
      kicker.root.visible = false;
      S.camMode = "trophy"; burst(new THREE.Vector3(0, 1.6, GZ + 2.4), ["#fde047", "#ffffff", "#f472b6"], 160, 6);
    };

    api.current = {
      start: () => { if (S.phase !== "intro") return; dressKeeper(M().opp.kit); const t0 = pickTarget(); ui.say(t0); startRound(t0);   // พูดคำแรกตรงใน onClick (iOS)
        hudScore({ banner:{ kind:"match", text:`${M().name} · พบ ${M().opp.emoji} ${M().opp.name}`, id:Math.random() } }); },
      choose, next: () => nextMatch(true),
      pause: p => { if (S.phase === "intro" || S.phase === "over") return; S.paused = p; setHud(h => ({ ...h, paused:p })); },
      end: () => finish(true),
    };
    if (typeof window !== "undefined" && window.__FR_DEBUG) window.__PK = { S, chooseSlot, answer:() => S.row ? S.row.cards.find(c => c.w.id === S.row.target.id)?.slot : -1 };

    // ── อินพุต: แตะรูป / ปัดไปทางรูป / แตะซ้าย-กลาง-ขวา ──
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let down = null;
    const pdn = e => { down = { x:e.clientX, y:e.clientY, t:performance.now() }; };
    const pup = e => {
      if (!down || S.phase !== "aim" || !S.row) { down = null; return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y; const rect = renderer.domElement.getBoundingClientRect(); down = null;
      if (Math.hypot(dx, dy) > 34) { // ปัด
        const a = Math.atan2(dx, -dy); chooseSlot(a < -.33 ? 0 : a > .33 ? 2 : 1); return; }
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(S.row.cards.flatMap(c => [c.frame, c.pic]), false);
      if (hits.length) { const c = S.row.cards.find(c => c.frame === hits[0].object || c.pic === hits[0].object); if (c) { choose(c.i); return; } }
      const fx = (e.clientX - rect.left) / rect.width; chooseSlot(fx < .36 ? 0 : fx > .64 ? 2 : 1);
    };
    renderer.domElement.addEventListener("pointerdown", pdn); renderer.domElement.addEventListener("pointerup", pup);
    const key = e => { if (e.key === "ArrowLeft" || e.key === "1") chooseSlot(0); if (e.key === "ArrowUp" || e.key === "2") chooseSlot(1); if (e.key === "ArrowRight" || e.key === "3") chooseSlot(2); };
    window.addEventListener("keydown", key);
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); composer?.setSize(W(), H()); }); ro.observe(el);

    // ── กล้อง ──
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(0, 1.2, GZ), tmpV = new THREE.Vector3(), lookTarget = new THREE.Vector3();
    const aimPose = () => { // ให้รูปทั้ง 3 ใบพอดีจอทุกขนาด (แนวตั้งก็เห็นครบ)
      const half = THREE.MathUtils.degToRad(camera.fov / 2); const need = 4.3;
      const d = clamp(need / (Math.tan(half) * camera.aspect), 12, 17);   // ≥12: คนยิงไม่บังกล้องตอนวิ่ง
      camPos.set(0, 1.55, CARD_Z + d); lookTarget.set(0, 1.12, CARD_Z - 1);
    };

    // ── ลูปหลัก ──
    const bez = (a, b, c, t, out) => { const u = 1 - t; return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z); };
    const prevBall = new THREE.Vector3();
    let raf = 0, last = performance.now();
    const tick = now => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const rdt0 = Math.min(FAST > 1 ? .2 : .05, (now - last) / 1000); last = now;
      const rdt = S.paused ? 0 : rdt0; S.t += rdt;               // พัก = ฉากหยุดนิ่ง
      S.pt += rdt;
      if (!S.paused && S.phase !== "intro" && S.phase !== "over") { S.playT += rdt; const sec = Math.floor(S.playT); if (sec !== S.sec) { S.sec = sec; setHud(h => ({ ...h, sec })); } }
      for (let i = 0; i < S.later.length; i++) if (S.later[i].at <= S.pt) { const ev = S.later.splice(i, 1)[0]; i--; ev.fn(); }
      // สโลว์โมชันช่วงลูกลอย
      const sh = S.shot;
      let wantSlow = 1;
      if (sh && sh.launched && !sh.resolved) wantSlow = sh.t > .18 && sh.t < .97 ? .32 : .8;
      S.slow += (wantSlow - S.slow) * Math.min(1, rdt * 8);
      const dt = rdt * S.slow; S.gt += dt;
      for (let i = S.events.length - 1; i >= 0; i--) if (S.events[i].at <= S.gt) { const ev = S.events[i]; S.events.splice(i, 1); ev.fn(); }

      // การ์ด
      const r = S.row;
      if (r) r.cards.forEach((c, i) => {
        const g = c.g;
        if (c.sw) { c.sw.k = Math.min(1, c.sw.k + rdt / .8); const e = ease(c.sw.k); c.home.lerpVectors(c.sw.from, c.sw.to, e); c.home.z += Math.sin(c.sw.k * Math.PI) * 1.1 * c.sw.arc; c.home.y += Math.sin(c.sw.k * Math.PI) * .25;
          if (c.sw.k >= 1) { c.home.copy(c.sw.to); c.tilt = c.home.x ? -Math.sign(c.home.x) * .06 : 0; c.sw = null; if (!r.cards.some(o => o.sw)) S.swapping = false; } }
        if (c.state === "in" || c.state === "chosen" || c.state === "reveal") {
          const k = clamp((S.t - c.born) / .45, 0, 1); const s = k < 1 ? easeOut(k) * (1 + Math.sin(k * Math.PI) * .15) : 1;
          const pulse = c.state === "reveal" ? .8 + Math.sin(S.t * 8) * .04 : c.state === "chosen" ? 1.08 + Math.sin(S.t * 14) * .03 : 1;
          g.scale.setScalar(Math.max(.01, s * pulse));
          g.position.set(c.home.x, c.home.y + Math.sin(S.t * 2.2 + i * 1.3) * .07, c.home.z); g.rotation.y = Math.sin(S.t * 1.4 + i) * .05 + c.tilt;
          c.halo.material.opacity = c.state === "chosen" ? .9 : c.state === "reveal" ? .55 + Math.sin(S.t * 8) * .3 : .38 + Math.sin(S.t * 4 + i) * .12;
          if (c.state === "reveal") c.halo.material.color.set("#4ade80");
        } else if (c.state === "out") { c.k += rdt * 4; g.scale.setScalar(Math.max(.01, 1 - c.k)); g.position.y += rdt * 2; if (c.k >= 1) { g.visible = false; } }
        else if (c.state === "pop") { c.k += rdt * 6; g.scale.setScalar(Math.max(.01, 1 - easeOut(Math.min(1, c.k)))); g.rotation.z += rdt * 9; c.halo.material.opacity = Math.max(0, .9 - c.k); if (c.k >= 1) g.visible = false; }
      });

      // คนยิงวิ่ง → เตะ
      if (kicker.run) { const kr = kicker.run; kr.t += dt; const p = clamp(kr.t / kr.dur, 0, 1);
        kicker.root.position.lerpVectors(KICK0, KICK1, p);
        if (p >= 1) { kicker.run = null; kicker.root.rotation.y = Math.PI + .3; play(kicker, "Melee_Unarmed_Attack_Kick", { once:true, fade:.08, speed:1.25 }); after(.26, launch); } }
      // ผู้รักษาประตูพุ่ง
      if (keeper.dive) { const d = keeper.dive; d.t += dt; const p = clamp(d.t / d.dur, 0, 1), e = easeOut(p);
        keeper.root.position.x = d.x0 + (d.x1 - d.x0) * e;
        keeper.root.position.y = Math.sin(Math.min(1, p * 1.15) * Math.PI) * .55 + (p >= 1 ? 0 : 0);
        keeper.root.rotation.z = -d.dir * 1.25 * e;
        keeper.root.rotation.x = -.12 * e; }
      else if (S.phase === "aim") keeper.root.position.x = Math.sin(S.t * M().speed) * M().sway; // ขยับซ้ายขวารอ (นัดหลังไวขึ้น กว้างขึ้น)

      // ลูกบอล
      prevBall.copy(ball.position);
      if (sh && sh.launched && !sh.resolved) {
        sh.t = Math.min(1, sh.t + dt / sh.dur);
        bez(sh.p0, sh.ctrl, sh.aimPt, ease(sh.t) * .25 + sh.t * .75, ball.position);
        // ป๊อปการ์ดที่เลือกเมื่อบอลผ่าน
        const hitZ = sh.kind === "goal" ? GZ - .55 : sh.kind === "catch" ? GZ + .8 : sh.kind === "save" ? GZ + .55 : GZ + .12;
        if (ball.position.z <= hitZ || sh.t >= 1) resolve();
      } else if (S.held) { const hand = keeper.model?.getObjectByName("chest") || keeper.root; hand.getWorldPosition(tmpV); ball.position.lerp(tmpV.add(new THREE.Vector3(0, -.05, .3)), Math.min(1, rdt * 12)); }
      else if (S.ballV) { // ฟิสิกส์หลังชน
        const v = S.ballV; v.y -= 9.8 * dt; ball.position.addScaledVector(v, dt);
        if (S.inNet) { const back = GZ + PROF[0][0] + .3; if (ball.position.z < back) { ball.position.z = back; v.z = Math.abs(v.z) * .2; } v.x *= .98; }
        if (ball.position.y < BALL_R) { ball.position.y = BALL_R; v.y = Math.abs(v.y) * .45; v.x *= .8; v.z *= .8; if (Math.abs(v.y) < .4) v.y = 0; }
      }
      const moved = tmpV.subVectors(ball.position, prevBall); const ml = moved.length();
      if (ml > 1e-4) { const axis = new THREE.Vector3(moved.z, 0, -moved.x).normalize(); if (axis.lengthSq() > 0) ball.rotateOnWorldAxis(axis, ml / BALL_R); if (sh && sh.launched && !sh.resolved) ball.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 14); }
      ballShadow.position.set(ball.position.x, .012, ball.position.z); ballShadow.material.opacity = clamp(.32 - ball.position.y * .1, .05, .32); ballShadow.scale.setScalar(1 + ball.position.y * .25);
      // หาง
      if (sh && sh.launched && !sh.resolved) { trailPos.unshift(ball.position.clone()); if (trailPos.length > TN) trailPos.pop(); } else if (trailPos.length) trailPos.pop();
      trail.forEach((sp, i) => { const p = trailPos[i]; if (!p) { sp.material.opacity = 0; return; } sp.position.copy(p); sp.material.opacity = (1 - i / TN) * .35; sp.scale.setScalar(.24 * (1 - i / TN) + .05); });

      if (ring.visible) { ring.material.opacity = Math.min(.95, ring.material.opacity + rdt * 4); ring.scale.setScalar(1 + Math.sin(S.t * 10) * .12); ring.material.rotation += rdt * 2; }
      // ตาข่ายพลิ้ว / โป่ง
      ripple.t += dt;
      { const p = netGeo.attributes.position; const wind = Math.sin(S.t * 1.3) * .012; const rt = ripple.t, ra = ripple.a * Math.exp(-rt * 2.2);
        for (let i = 0; i < p.count; i++) { const bx = nBase[i * 3], by = nBase[i * 3 + 1], bz = nBase[i * 3 + 2];
          let dz = wind * Math.sin(bx * 1.7 + S.t * 2) * (by / GH);
          if (ra > .002) { const dd = (bx - ripple.x) ** 2 + (by - ripple.y) ** 2; const dist = Math.sqrt(dd);
            dz -= ra * Math.exp(-dd / .9) * (1 + .3 * Math.cos(rt * 16)) + ra * .25 * Math.sin(dist * 7 - rt * 20) * Math.exp(-dist * .8); }
          p.setZ(i, bz + dz); }
        p.needsUpdate = true; }

      // อนิเมชัน
      keeper.mixer?.update(dt); kicker.mixer?.update(dt);
      // อนุภาค
      for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; const q = pVel[i]; q.y -= (q.g ?? 9) * dt; pPos[i * 3] += q.x * dt; pPos[i * 3 + 1] = Math.max(.03, pPos[i * 3 + 1] + q.y * dt); pPos[i * 3 + 2] += q.z * dt; if (pLife[i] <= 0) pPos[i * 3 + 1] = -999; }
      pg.attributes.position.needsUpdate = true;
      { let any = false; const q = new THREE.Quaternion(), e = new THREE.Euler();
        for (let i = 0; i < CN; i++) { const c = confS[i]; if (c.life <= 0) continue; any = true; c.life -= rdt; c.v.y -= 1.6 * rdt; c.v.multiplyScalar(1 - rdt * .9); c.p.addScaledVector(c.v, rdt); c.p.x += Math.sin(S.t * 3 + i) * rdt * .4;
          c.r.x += c.w.x * rdt; c.r.y += c.w.y * rdt; c.r.z += c.w.z * rdt; e.copy(c.r); q.setFromEuler(e);
          cm.compose(c.p, q, cs.setScalar(c.life > 0 && c.p.y > 0 ? 1 : 0)); conf.setMatrixAt(i, c.life > 0 ? cm : hideM); }
        if (any) conf.instanceMatrix.needsUpdate = true; }
      updateCrowd(S.t);
      flags.forEach(f => { f.rotation.z = Math.sin(S.t * (cheerAmt.v ? 8 : 2) + f.userData.ph) * (cheerAmt.v ? .5 : .15); f.position.y += Math.sin(S.t * 6 + f.userData.ph) * (cheerAmt.v ? .01 : 0); });
      bTex.offset.x = (bTex.offset.x + rdt * .02) % 1;

      // กล้อง
      if (trophy) { trophy.t += rdt; const k = Math.min(1, trophy.t / 1.2); trophy.g.position.y = -1.5 + easeOut(k) * 2.6 + Math.sin(S.t * 2) * .05; trophy.g.rotation.y += rdt * 1.2;
        if (Math.floor(trophy.t * 2) !== Math.floor((trophy.t - rdt) * 2) && trophy.t < 4) burst(new THREE.Vector3((Math.random() - .5) * 3, 2.2, GZ + 2.4), ["#fde047", "#ffffff", "#f472b6", "#22d3ee"], 50, 5); }
      if (S.camMode === "trophy") { camPos.set(0, 2.15, GZ + 2.4 + clamp(1.8 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 3.6, 5.5)); lookTarget.set(0, 2.15, GZ + 2.4); camera.position.lerp(camPos, Math.min(1, rdt * 2)); camLook.lerp(lookTarget, Math.min(1, rdt * 3)); }
      else if (S.camMode === "intro") { const a = S.t * .12; camPos.set(Math.sin(a) * 9, 2.6 + Math.sin(S.t * .3) * .3, GZ + 4 + Math.cos(a) * 9); lookTarget.set(0, 1.1, GZ); camera.position.lerp(camPos, Math.min(1, rdt * 2)); camLook.lerp(lookTarget, Math.min(1, rdt * 3)); }
      else if (S.camMode === "aim") { aimPose(); camera.position.lerp(camPos, Math.min(1, rdt * 2.6)); camLook.lerp(lookTarget, Math.min(1, rdt * 3)); }
      else if (S.camMode === "hold") { const hx = S.hold.x; const dh = clamp(4.4 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 8, 15);
        camPos.set(hx * .2 + .4, 2.3, Math.min(GZ + dh, -.9));   // หน้าคนยิงเสมอ (ไม่บังภาพ) lookTarget.set(hx * .3, 1.25, GZ - .4);
        camera.position.lerp(camPos, Math.min(1, rdt * 1.6)); camLook.lerp(lookTarget, Math.min(1, rdt * 2.5)); }
      else if (S.camMode === "follow") {
        S.camT += rdt;
        const minZ = GZ + 3.6;
        tmpV.set(ball.position.x * .5 + 1.15, Math.max(1.35, ball.position.y + .65), Math.max(ball.position.z + 3.2, minZ));
        camera.position.lerp(tmpV, Math.min(1, rdt * (sh && !sh.resolved ? 4.2 : 1.8)));
        lookTarget.set(ball.position.x * .8, ball.position.y * .7 + .5, Math.min(ball.position.z - 4, GZ - .5));
        camLook.lerp(lookTarget, Math.min(1, rdt * 5));
      }
      S.shake = Math.max(0, S.shake - rdt * 1.8);
      if (S.shake > 0) camera.position.add(tmpV.set((Math.random() - .5) * S.shake * .12, (Math.random() - .5) * S.shake * .12, 0));
      camera.lookAt(camLook);
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(readyTimer); ro.disconnect(); window.removeEventListener("keydown", key);
      renderer.domElement.removeEventListener("pointerdown", pdn); renderer.domElement.removeEventListener("pointerup", pup);
      keeper.mixer?.stopAllAction(); kicker.mixer?.stopAllAction();
      const texs = new Set();
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { for (const k in x) { const v = x[k]; if (v && v.isTexture) texs.add(v); } x.dispose?.(); }); });
      texs.forEach(t => t.dispose()); texCache.forEach(v => v.tex?.dispose?.()); pTex.dispose(); nTex.dispose(); bTex.dispose(); glow.dispose();
      env?.dispose?.(); composer?.dispose?.(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []); // eslint-disable-line

  const tk = ui.tokens;
  const { phase, round, goals, target, banner, ready, msg, match, mShot, res, opp, inter, trophy, opBubble, sec, paused } = hud;
  const playing = phase === "aim" || phase === "shot";
  const MT = MATCHES[Math.min(match, MATCHES.length - 1)];
  const bannerStyle = banner && (banner.kind === "goal"
    ? { background:tk.primary, color:tk.onPrimary }
    : { background:tk.card, color:tk.ink });
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const big = { minWidth:200, minHeight:60, borderRadius:30, border:"none", fontSize:22, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, fontFamily:"inherit" };
  const Dots = ({ arr }) => <span style={{ display:"flex", gap:2 }}>{Array.from({ length:MT.shots }, (_, i) => <span key={i} style={{ width:11, height:11, borderRadius:6, flex:"none", boxSizing:"border-box", fontSize:8, lineHeight:"11px", textAlign:"center",
    border:arr[i] == null ? `2px solid ${tk.ink}` : "none", opacity:arr[i] == null ? .25 : 1, background:arr[i] == null ? "transparent" : arr[i] ? tk.primary : tk.ink }}>{arr[i] === 0 ? <span style={{ color:tk.card }}>✕</span> : ""}</span>)}</span>;
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:6 }}>
      <style>{`@keyframes pkPop{0%{transform:scale(.2) rotate(-8deg);opacity:0}25%{transform:scale(1.18) rotate(3deg);opacity:1}40%{transform:scale(1) rotate(0)}85%{transform:scale(1);opacity:1}100%{transform:scale(.9);opacity:0}}
        @keyframes pkHint{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pkIn{0%{transform:scale(.4)}60%{transform:scale(1.05)}100%{transform:scale(1)}}`}</style>
      {target && playing && <Prompt w={target} onClick={() => ui.say(target)} />}
      <div style={{ position:"relative", height:phase !== "intro" ? "min(60vh, 560px)" : "min(68vh, 620px)", minHeight:300, borderRadius:28, overflow:"hidden", background:"#0b1d0f" }}>
        <div ref={host} data-penalty3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 60%, rgba(0,0,0,.25))" }} />
        {/* สกอร์บอร์ด: นัด · ลูก · เวลา · เรา vs คู่แข่ง */}
        {phase !== "intro" && phase !== "over" && !trophy && !inter && <div data-hud style={{ position:"absolute", left:8, top:8, right:64, maxWidth:300, padding:"6px 10px 7px", borderRadius:18, background:tk.card, color:tk.ink, boxShadow:tk.shadow, pointerEvents:"none", boxSizing:"border-box" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:6, fontWeight:900, fontSize:12 }}><span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>⚽ {MT.name} · ลูก {Math.min(mShot, MT.shots)}/{MT.shots}</span><span style={{ whiteSpace:"nowrap" }}>⏱ {mmss(sec || 0)}</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr auto", alignItems:"center", columnGap:5, rowGap:2, marginTop:4, fontWeight:900, fontSize:12 }}>
            <span style={{ whiteSpace:"nowrap" }}>⭐ เรา</span><Dots arr={res} /><span style={{ fontSize:18, minWidth:18, textAlign:"right" }}>{sum(res)}</span>
            <span style={{ whiteSpace:"nowrap" }}>{MT.opp.emoji} {MT.opp.name}</span><Dots arr={opp} /><span style={{ fontSize:18, minWidth:18, textAlign:"right" }}>{sum(opp)}</span>
          </div>
          <div style={{ position:"relative", height:5, borderRadius:3, marginTop:5, overflow:"hidden", background:tk.ink }}>
            <div style={{ position:"absolute", inset:0, background:tk.card, opacity:.75 }} />
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${Math.min(1, (round - (playing ? 1 : 0)) / ROUNDS) * 100}%`, background:tk.primary }} />
          </div>
        </div>}
        {phase !== "intro" && phase !== "over" && !trophy && <button aria-label="พัก" className="m3-press" onClick={() => api.current.pause?.(true)} style={{ position:"absolute", right:8, top:8, width:48, height:48, borderRadius:24, border:"none", background:tk.card, color:tk.ink, fontSize:22, fontWeight:900, boxShadow:tk.shadow, cursor:"pointer", fontFamily:"inherit" }}>⏸</button>}
        {opBubble && playing && <div key={opBubble.id} style={{ position:"absolute", right:8, top:64, padding:"4px 10px", borderRadius:14, background:tk.card, color:tk.ink, fontWeight:900, fontSize:13, boxShadow:tk.shadow, pointerEvents:"none", animation:"pkPop 1.8s ease-out forwards" }}>{MT.opp.emoji} {opBubble.g ? "ยิงเข้า" : "พลาด!"}</div>}
        {phase === "aim" && <div style={{ position:"absolute", left:0, right:0, bottom:12, textAlign:"center", pointerEvents:"none", animation:"pkHint 1.2s ease-in-out infinite" }}>
          <span style={{ display:"inline-block", padding:"6px 14px", borderRadius:16, background:tk.card, color:tk.ink, fontWeight:800, fontSize:15, boxShadow:tk.shadow }}>👆 แตะรูปที่ถูก แล้วยิงเลย!</span>
        </div>}
        {banner && <div key={banner.id} style={{ position:"absolute", left:0, right:0, top:banner.kind === "match" ? "66%" : "34%", display:"flex", justifyContent:"center", pointerEvents:"none", padding:"0 10px" }}>
          <div style={{ ...bannerStyle, padding:"10px 22px", borderRadius:26, fontWeight:900, fontSize:banner.kind === "goal" ? (banner.text.length > 10 ? 32 : 44) : banner.kind === "match" ? 20 : 32, boxShadow:tk.shadow, animation:"pkPop 1.9s ease-out forwards", whiteSpace:banner.kind === "match" ? "normal" : "nowrap", textAlign:"center" }}>{banner.text}</div>
        </div>}
        {inter && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", padding:14, background:"rgba(0,0,0,.35)" }}>
          <div style={{ width:"min(100%, 330px)", padding:"16px 14px", borderRadius:28, background:tk.card, color:tk.ink, boxShadow:tk.shadow, textAlign:"center", animation:"pkIn .5s ease-out", boxSizing:"border-box" }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{inter.title}</div>
            <div style={{ fontWeight:900, fontSize:30, margin:"4px 0" }}>⭐ {inter.our} – {inter.op} {inter.opp.emoji}</div>
            <div style={{ fontWeight:900, fontSize:20 }}>{inter.res === "win" ? "ชนะ! 🎉" : inter.res === "draw" ? "เสมอ! ได้ไปต่อ 🤝" : "เกือบแล้ว! ได้ไปต่อ 💪"}</div>
            <div style={{ fontWeight:800, fontSize:15, marginTop:10 }}>ต่อไป: {inter.next.name}<br />พบ {inter.next.opp.emoji} {inter.next.opp.name}</div>
            <button className="m3-press" onClick={() => api.current.next?.()} style={{ ...big, marginTop:12, background:tk.primary, color:tk.onPrimary }}>▶ ไปต่อ!</button>
          </div>
        </div>}
        {trophy && <div key={trophy.id} style={{ position:"absolute", left:0, right:0, top:12, display:"flex", justifyContent:"center", pointerEvents:"none", padding:"0 12px" }}>
          <div style={{ padding:"10px 18px", borderRadius:26, background:trophy.gold ? tk.primary : tk.card, color:trophy.gold ? tk.onPrimary : tk.ink, boxShadow:tk.shadow, textAlign:"center", animation:"pkIn .6s ease-out" }}>
            <div style={{ fontWeight:900, fontSize:28 }}>{trophy.gold ? "🏆 แชมป์!" : "🥈 รองแชมป์!"}</div>
            <div style={{ fontWeight:800, fontSize:15 }}>นัดชิง ⭐ {trophy.our} – {trophy.op} {MATCHES[MATCHES.length - 1].opp.emoji} · ยิงเข้ารวม {goals} ลูก</div>
          </div>
        </div>}
        {paused && phase !== "over" && phase !== "intro" && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:16 }}>
          <div style={{ color:"#fff", fontWeight:900, fontSize:26 }}>⏸ พักก่อน</div>
          <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>⚽ ยิงเข้า {goals} · ⏱ {mmss(sec || 0)}</div>
          <button className="m3-press" onClick={() => api.current.pause?.(false)} style={{ ...big, background:tk.primary, color:tk.onPrimary }}>▶ เล่นต่อ</button>
          <button className="m3-press" onClick={() => api.current.end?.()} style={{ ...big, minHeight:52, fontSize:18, background:tk.card, color:tk.ink }}>🏁 จบเกม</button>
        </div>}
        {phase === "intro" && <>
          <div style={{ position:"absolute", top:16, left:12, right:12, textAlign:"center", pointerEvents:"none" }}>
            <div style={{ fontWeight:900, fontSize:28, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.6)" }}>⚽ Penalty Kick</div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.75)" }}>ฟังคำ แล้วยิงประตูไปที่รูปที่ถูก</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.75)", marginTop:2 }}>🏆 ทัวร์นาเมนต์ {MATCHES.length} นัด · ชิงถ้วยแชมป์!</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"40px 12px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"linear-gradient(180deg, transparent, rgba(0,0,0,.5))" }}>
            <button onClick={() => { ui.unlock?.(); api.current.start?.(); }} className="m3-press" disabled={!ready && !msg}
              style={{ minWidth:210, minHeight:64, borderRadius:32, border:"none", background:tk.primary, color:tk.onPrimary, fontSize:24, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, opacity:ready ? 1 : .7, fontFamily:"inherit" }}>
              {ready ? "▶ เริ่ม!" : "กำลังโหลด…"}</button>
          </div>
        </>}
        {msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18, textAlign:"center", padding:20 }}>{msg}</div>}
      </div>
    </div>
  );
}
