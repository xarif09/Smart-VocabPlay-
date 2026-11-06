// Word Racer 3D — แข่งรถ 3 มิติ ฟังคำ แล้วขับผ่านประตูรูปที่ถูก = เทอร์โบ! (หมวดยานพาหนะ)
// • เลือกรถก่อนแข่ง: รถ 3D จริง (Kenney Car Kit / Starter Kit Racing · CC0/MIT) หมุนบนแท่น + ชื่ออังกฤษ + ไทย (แตะเพื่อฟัง)
// • สนาม: ถนนโค้งยาว ~2 กม. (ท้องฟ้า HDRI + พื้น PBR จาก setupEnvironment) ขอบทางแดงขาว ราวกันชน กรวย
//   ต้นไม้/ม้านั่ง (loadPropKit) อาคาร KayKit · คู่แข่ง AI 3 คัน · กล้องไล่หลัง FOV ตามความเร็ว + สั่น
// • ทุกช่วงจะได้ยินคำ (Prompt 🔊 + คำ + ไทย) แล้วมีประตูเรืองแสง 3 บาน (รูปจาก ui.imageUrl)
//   ผ่านบานที่ถูก = TURBO (ไฟพ่น เส้นความเร็ว แซง) · ผิด = หมุนคว้าง ช้าลง · 10 ประตู แล้วเส้นชัย
// • ผลลัพธ์: track.finish(ถูก, 10, { label:"อันดับ 1 · ถูก 8/10" })
// สีในโลก 3D เป็นงานศิลป์ของฉาก · ปุ่ม/HUD ใช้ ui.tokens
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { setupEnvironment } from "./runner/environment.js";
import { loadPropKit } from "./runner/props.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
const MDIR = `${BASE}models/vehicles/`;

// ── รถที่มีโมเดล 3D จริง (คำศัพท์ → ไฟล์ใน public/models/vehicles/) ──
// front: ทิศหน้ารถในไฟล์ (Kenney Car Kit = -Z, Starter Kit Racing = +Z)
export const RACER_VEHICLES = [
  { word:"RACE CAR",      th:"รถแข่ง",        emoji:"🏎️", file:"race.glb",         front:-1 },
  { word:"POLICE CAR",    th:"รถตำรวจ",       emoji:"🚓", file:"police.glb",       front:-1 },
  { word:"TAXI",          th:"แท็กซี่",        emoji:"🚕", file:"taxi.glb",         front:-1 },
  { word:"FIRETRUCK",     th:"รถดับเพลิง",     emoji:"🚒", file:"firetruck.glb",    front:-1, alias:["FIRE TRUCK", "FIRE ENGINE"] },
  { word:"AMBULANCE",     th:"รถพยาบาล",      emoji:"🚑", file:"ambulance.glb",    front:-1 },
  { word:"CAR",           th:"รถยนต์",        emoji:"🚗", file:"sedan.glb",        front:-1 },
  { word:"SPORTS CAR",    th:"รถสปอร์ต",      emoji:"🏎️", file:"sedanSports.glb",  front:-1 },
  { word:"JEEP",          th:"รถจี๊ป",         emoji:"🚙", file:"suv.glb",          front:-1, alias:["SUV"] },
  { word:"VAN",           th:"รถตู้",          emoji:"🚐", file:"van.glb",          front:-1 },
  { word:"PICKUP TRUCK",  th:"รถกระบะ",       emoji:"🛻", file:"truck.glb",        front:-1, alias:["TRUCK"] },
  { word:"LORRY",         th:"รถบรรทุก",      emoji:"🚚", file:"delivery.glb",     front:-1, alias:["DELIVERY TRUCK"] },
  { word:"GARBAGE TRUCK", th:"รถขยะ",         emoji:"🚛", file:"garbageTruck.glb", front:-1 },
  { word:"TRACTOR",       th:"รถแทรกเตอร์",   emoji:"🚜", file:"tractor.glb",      front:-1 },
  { word:"MOTORCYCLE",    th:"มอเตอร์ไซค์",    emoji:"🏍️", file:"motorcycle.glb",   front:1, alias:["MOTORBIKE"] },
];
// word (รวมคำพ้อง) → ไฟล์โมเดล เช่น RACER_MODEL_BY_WORD["TRUCK"] === "truck.glb"
export const RACER_MODEL_BY_WORD = Object.fromEntries(RACER_VEHICLES.flatMap(v => [[v.word, v.file], ...(v.alias || []).map(a => [a, v.file])]));
export const hasRacerModel = word => !!RACER_MODEL_BY_WORD[String(word || "").toUpperCase()];
// รถคู่แข่ง (ไม่ซ้ำกับรถผู้เล่น)
const AI_FILES = [
  { file:"raceFuture.glb", word:"RACE CAR", emoji:"🏎️" }, { file:"hatchbackSports.glb", word:"SPORTS CAR", emoji:"🚗" },
  { file:"sedanSports.glb", word:"SPORTS CAR", emoji:"🏎️" }, { file:"race.glb", word:"RACE CAR", emoji:"🏎️" },
  { file:"police.glb", word:"POLICE CAR", emoji:"🚓" }, { file:"taxi.glb", word:"TAXI", emoji:"🚕" },
  { file:"firetruck.glb", word:"FIRETRUCK", emoji:"🚒" }, { file:"ambulance.glb", word:"AMBULANCE", emoji:"🚑" },
  { file:"van.glb", word:"VAN", emoji:"🚐" }, { file:"suv.glb", word:"JEEP", emoji:"🚙" },
];
const VEH_KEY = "smart-vocabplay:racer-vehicle";
const loadVeh = () => { try { const v = localStorage.getItem(VEH_KEY); return RACER_VEHICLES.some(x => x.word === v) ? v : "RACE CAR"; } catch (_) { return "RACE CAR"; } };
const saveVeh = w => { try { localStorage.setItem(VEH_KEY, w); } catch (_) {} };

// ── สนาม ──
const THEME = "park";                 // ท้องฟ้าสดใส + หญ้า (ถนนเปลี่ยนเป็นยางมะตอย)
const ROAD_W = 13, HALF = ROAD_W / 2;
const LANES = [-4.3, 0, 4.3];
const GATES = 10;
const START_S = 40, GATE0 = 270, GATE_GAP = 180;
const GATE_S = Array.from({ length:GATES }, (_, i) => GATE0 + i * GATE_GAP);
const FINISH_S = GATE_S[GATES - 1] + 220;
const TRACK_LEN = FINISH_S + 220;
const GRID_D = [-4.95, -1.65, 1.65, 4.95];
const PLAYER_SLOT = 1;
const VSCALE = 1.4;                   // ขนาดรถ (Kenney ~2.6 m → ~3.6 m)
const BASE_V = 25, BOOST_V = 40, BOOST_T = 2.8, SPIN_T = 1.15;
const LANE_COL = ["#22d3ee", "#f472b6", "#facc15"];
const AI_PACE = [24.4, 25.3, 26.2];
const ORD = ["", "1st", "2nd", "3rd", "4th"];
const DT_MAX = (typeof window !== "undefined" && window.__RACER_DTMAX) || .05;   // ทดสอบอัตโนมัติบนเครื่องช้าเท่านั้น

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const softDot = () => canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.4, "rgba(255,255,255,.6)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
function emojiTexture(emoji) {
  return canvasTex(320, 240, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#e0f2fe"); g.addColorStop(1, "#fae8ff"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.font = "150px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji || "⭐", w / 2, h / 2 + 8); });
}
function labelTexture(text, bg, fg = "#fff") {
  return canvasTex(512, 128, (x, w, h) => { x.fillStyle = bg; const r = 56; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, r) : x.rect(4, 4, w - 8, h - 8); x.fill();
    x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,.9)"; x.stroke();
    x.fillStyle = fg; x.font = "900 64px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, w / 2, h / 2 + 4); });
}
function bannerTexture(text) {
  return canvasTex(1024, 192, (x, w, h) => {
    const sq = 24; for (let j = 0; j < 2; j++) for (let i = 0; i < w / sq; i++) { x.fillStyle = (i + j) % 2 ? "#111" : "#fff"; x.fillRect(i * sq, j * sq, sq, sq); x.fillRect(i * sq, h - (j + 1) * sq, sq, sq); }
    const g = x.createLinearGradient(0, 48, 0, h - 48); g.addColorStop(0, "#ef4444"); g.addColorStop(1, "#b91c1c"); x.fillStyle = g; x.fillRect(0, 48, w, h - 96);
    x.fillStyle = "#fff"; x.font = "900 86px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, w / 2, h / 2 + 4); });
}

// ── อนุภาค (จุดมีขนาด/ความโปร่ง/สีของตัวเอง) ──
class Particles {
  constructor(n, additive, map) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3).fill(-9999); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1)); g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.uniforms = { map:{ value:map }, uScale:{ value:500 } };
    const m = new THREE.ShaderMaterial({ uniforms:this.uniforms, transparent:true, depthWrite:false, blending:additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader:`attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.1, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader:`uniform sampler2D map; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.003) discard; ${additive ? "gl_FragColor = vec4(vC * a, a);" : "gl_FragColor = vec4(vC, a);"} }` });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5; this.geo = g; this.dirty = false;
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, color, alpha = 1, grav = 0, drag = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n; const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z; this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = color.r; this.col[k + 1] = color.g; this.col[k + 2] = color.b;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow; this.a0[i] = alpha; this.alpha[i] = alpha; this.grav[i] = grav; this.drag[i] = drag; this.dirty = true;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; const k = i * 3;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.pos[k + 1] = -9999; continue; }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < .03 && this.grav[i] > 0) { this.pos[k + 1] = .03; this.vel[k + 1] *= -.35; this.vel[k] *= .7; this.vel[k + 2] *= .7; }
      this.size[i] += this.grow[i] * dt; const f = this.life[i] / this.max[i]; this.alpha[i] = this.a0[i] * Math.min(1, f * 1.6);
    }
    const a = this.geo.attributes; a.position.needsUpdate = true; a.aSize.needsUpdate = true; a.aAlpha.needsUpdate = true;
    if (this.dirty) { a.aColor.needsUpdate = true; this.dirty = false; }
  }
}

// ── เส้นทาง (CatmullRom โค้งไปมา ไม่วกกลับ) → ตัวอย่างทุก 1 ม. ──
function buildTrack() {
  const pts = []; let h = 0, x = 0, z = 0; const step = 90, n = Math.ceil((TRACK_LEN + 300) / step) + 2;
  let dir = Math.random() < .5 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    pts.push(new THREE.Vector3(x, 0, z));
    const s = i * step;
    let dh = 0;
    if (s > 160 && s < FINISH_S - 260) { if (Math.random() < .35) dir = -dir; dh = dir * (.22 + Math.random() * .38); if (Math.abs(h + dh) > 1.0) dh = -dh; }
    else if (s >= FINISH_S - 260) dh = -h * .5;               // ทางตรงเข้าเส้นชัย
    h += dh; x += Math.sin(h) * step; z -= Math.cos(h) * step;
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const L = Math.floor(curve.getLength());
  const sp = curve.getSpacedPoints(L);
  const N = sp.length, px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N), curv = new Float32Array(N);
  for (let i = 0; i < N; i++) { px[i] = sp[i].x; pz[i] = sp[i].z; }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); let dx = px[b] - px[a], dz = pz[b] - pz[a]; const l = Math.hypot(dx, dz) || 1; tx[i] = dx / l; tz[i] = dz / l; }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 4), b = Math.min(N - 1, i + 4); curv[i] = (Math.atan2(tx[b], tz[b]) - Math.atan2(tx[a], tz[a])); if (curv[i] > Math.PI) curv[i] -= 2 * Math.PI; if (curv[i] < -Math.PI) curv[i] += 2 * Math.PI; curv[i] /= Math.max(1, b - a); }
  const len = N - 1;
  // ตำแหน่งโลก ณ ระยะ s และระยะข้าง d (+ = ขวา) · คืน yaw ที่ทำให้ +Z ของวัตถุหันไปตามทาง
  const at = (s, d, out) => {
    const ss = clamp(s, 0, len - .001), i = Math.floor(ss), f = ss - i;
    const x0 = lerp(px[i], px[i + 1], f), z0 = lerp(pz[i], pz[i + 1], f);
    let ux = lerp(tx[i], tx[i + 1], f), uz = lerp(tz[i], tz[i + 1], f); const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    if (out) { out.x = x0 - uz * d; out.y = 0; out.z = z0 + ux * d; }
    return Math.atan2(ux, uz);
  };
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]); }
  // ระยะใกล้สุดจากจุดถึงเส้นกลางถนน (ใช้กันของข้างทางทับถนนช่วงโค้ง)
  const nearDist = (x, z, s0) => { let m = 1e9; for (let i = Math.max(0, Math.floor(s0) - 260); i <= Math.min(len, Math.floor(s0) + 260); i += 3) m = Math.min(m, Math.hypot(px[i] - x, pz[i] - z)); return m; };
  return { at, len, px, pz, tx, tz, curv, bounds:{ minX, maxX, minZ, maxZ }, nearDist };
}

// แถบริบบอนตามแนวถนน: แนวนอน (d0..d1 ที่ความสูง y) หรือแนวตั้ง (d ที่ y0..y1)
function ribbon(T, { d0, d1, y0 = 0, y1 = 0, vertical = false, vPer = 1, s0 = 0, s1 = T.len, step = 2 }) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3(), q = new THREE.Vector3(); let row = 0;
  for (let s = s0; ; s += step) {
    const ss = Math.min(s, s1);
    if (vertical) { T.at(ss, d0, p); pos.push(p.x, y0, p.z, p.x, y1, p.z); }
    else { T.at(ss, d0, p); T.at(ss, d1, q); pos.push(p.x, y0, p.z, q.x, y0, q.z); }
    uv.push(0, ss / vPer, 1, ss / vPer);
    if (row > 0) { const a = (row - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    row++; if (ss >= s1) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); if (!vertical) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  return g;
}

// ── รถ: โหลด glTF → หันหน้า +Z, ขนาดมาตรฐาน, หาล้อ ──
function prepVehicle(template, def) {
  const root = new THREE.Group(); const inner = template.clone(true);
  if (def.front < 0) inner.rotation.y = Math.PI;
  inner.scale.setScalar(VSCALE); root.add(inner);
  const wheels = [];
  inner.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    const n = (o.name || "").toLowerCase();
    if (n.startsWith("wheel") && o.parent && !(o.parent.name || "").toLowerCase().startsWith("wheel")) wheels.push({ o, q0:o.quaternion.clone(), front:n.includes("front") });
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  return { g:root, inner, wheels, box, spin:0 };
}
function fallbackVehicle(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .7, 3.6), new THREE.MeshPhysicalMaterial({ color, roughness:.3, clearcoat:1 })); body.position.y = .65; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, .55, 1.6), new THREE.MeshStandardMaterial({ color:"#1e293b", roughness:.1, metalness:.4 })); cab.position.set(0, 1.2, -.2); g.add(cab);
  const wheels = [];
  for (const [x, z] of [[-.9, 1.2], [.9, 1.2], [-.9, -1.2], [.9, -1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .35, 16), new THREE.MeshStandardMaterial({ color:"#111" })); w.rotation.z = Math.PI / 2; w.position.set(x, .42, z); g.add(w); }
  const root = new THREE.Group(); root.add(g);
  return { g:root, inner:g, wheels, box:new THREE.Box3(new THREE.Vector3(-.9, 0, -1.8), new THREE.Vector3(.9, 1.5, 1.8)), spin:0 };
}

export default function Racer3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const barRef = useRef(null);
  const [hud, setHud] = useState({ phase:"select", ready:false, loadP:0, target:null, gate:0, correct:0, rank:PLAYER_SLOT + 1, count:0, fx:null, done:null, msg:null });
  const [veh, setVeh] = useState(loadVeh);
  const [racers, setRacers] = useState([]);   // [{ emoji, me }] สำหรับแถบความคืบหน้า
  const tk = ui.tokens;
  const vDef = RACER_VEHICLES.find(v => v.word === veh) || RACER_VEHICLES[0];
  const thOf = v => (words.find(w => String(w.word).toUpperCase() === v.word) || {}).meaning || v.th;
  const sayVeh = v => { const w = words.find(x => String(x.word).toUpperCase() === v.word); if (w) ui.say(w); else speak(v.word, v.th); };

  useEffect(() => {
    const el = host.current; if (!el) return;
    const W = () => Math.max(1, el.clientWidth), H = () => Math.max(1, el.clientHeight);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" }); if (!renderer.getContext()) throw new Error("no gl"); }
    catch (e) { setHud(h => ({ ...h, msg:"เครื่องนี้ไม่รองรับภาพ 3 มิติ 😢" })); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement); Object.assign(renderer.domElement.style, { display:"block", touchAction:"none", width:"100%", height:"100%" });

    let alive = true;
    const owned = [];   // textures/geometries ที่ไม่ได้อยู่ใน scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a9c7e8");
    scene.fog = new THREE.Fog("#c9d8e6", 90, 420);
    const camera = new THREE.PerspectiveCamera(60, W() / H(), .1, 1500); scene.add(camera);
    const T = buildTrack();
    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

    // ── แสง ──
    const hemi = new THREE.HemisphereLight("#dbeafe", "#4d7c0f", .6); scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff4e0", 2.6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left:-40, right:40, top:40, bottom:-40, near:1, far:160 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
    scene.add(sun); scene.add(sun.target);
    const sunDir = new THREE.Vector3(.5, .75, .4).normalize();

    // ── พื้น ──
    const b = T.bounds, gx0 = b.minX - 500, gx1 = b.maxX + 500, gz0 = b.minZ - 500, gz1 = b.maxZ + 500;
    const groundGeo = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0, 48, 48); groundGeo.rotateX(-Math.PI / 2); groundGeo.translate((gx0 + gx1) / 2, 0, (gz0 + gz1) / 2);
    { // หญ้าเขียว (สีจุดยอด = โทนสีบนรูปถ่ายใบไม้แห้ง) แต้มสีเหลือง/เขียวเข้มสลับกัน
      const p = groundGeo.attributes.position, uv = groundGeo.attributes.uv, col = [], c = new THREE.Color(), a = new THREE.Color("#4f9a2a"), b2 = new THREE.Color("#8fbf3a");
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); uv.setXY(i, x / 260, z / 120); c.copy(a).lerp(b2, .5 + .5 * Math.sin(x * .013 + Math.cos(z * .011) * 2)); col.push(c.r, c.g, c.b); }
      groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); }
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color:"#6a9a45", roughness:.95, vertexColors:true })); ground.receiveShadow = true; scene.add(ground);

    // ── ถนน + ขอบแดงขาว + ราวกันชน ──
    const ROAD_V = 645;
    const road = new THREE.Mesh(ribbon(T, { d0:-HALF, d1:HALF, y0:.02, vPer:ROAD_V }), new THREE.MeshStandardMaterial({ color:"#3a3e44", roughness:.9 })); road.receiveShadow = true; scene.add(road);
    const kerbTex = canvasTex(32, 128, (x, w, h) => { x.fillStyle = "#e11d48"; x.fillRect(0, 0, w, h / 2); x.fillStyle = "#f8fafc"; x.fillRect(0, h / 2, w, h / 2); });
    kerbTex.wrapS = kerbTex.wrapT = THREE.RepeatWrapping;
    const kerbMat = new THREE.MeshStandardMaterial({ map:kerbTex, roughness:.6 });
    for (const sd of [-1, 1]) { const k = new THREE.Mesh(ribbon(T, { d0:sd > 0 ? HALF : -HALF - 1.1, d1:sd > 0 ? HALF + 1.1 : -HALF, y0:.05, vPer:3.2 }), kerbMat); k.receiveShadow = true; scene.add(k); }
    const railMat = new THREE.MeshStandardMaterial({ color:"#dfe5ec", metalness:.75, roughness:.3, side:THREE.DoubleSide });
    const railStripe = new THREE.MeshStandardMaterial({ map:kerbTex, roughness:.5, side:THREE.DoubleSide });
    const RAIL_D = HALF + 3.4;
    for (const sd of [-1, 1]) {
      const r1 = new THREE.Mesh(ribbon(T, { d0:sd * RAIL_D, vertical:true, y0:.45, y1:.85, vPer:4, step:3 }), railMat); r1.castShadow = true; scene.add(r1);
      const r2 = new THREE.Mesh(ribbon(T, { d0:sd * (RAIL_D + .02), vertical:true, y0:.1, y1:.32, vPer:2.4, step:3 }), railStripe); scene.add(r2);
    }
    { // เสาราว (instanced) ทุก 4 ม.
      const n = Math.floor(T.len / 4) * 2; const post = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, .95, .14), new THREE.MeshStandardMaterial({ color:"#94a3b8", metalness:.6, roughness:.4 }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1); let k = 0;
      for (let s = 0; s < T.len && k < n; s += 4) for (const sd of [-1, 1]) { const yaw = T.at(s, sd * (RAIL_D + .12), tmpV); tmpV.y = .47; q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); m.compose(tmpV, q, sc); post.setMatrixAt(k++, m); }
      post.count = k; post.castShadow = true; scene.add(post);
    }
    { // กรวยที่โค้งด้านนอก
      const pos = [];
      for (let s = 80; s < T.len - 40; s += 7) { const c = T.curv[Math.floor(s)]; if (Math.abs(c) > .0045) pos.push([s, (c > 0 ? -1 : 1) * (HALF + 1.9)]); }
      const n = Math.max(1, pos.length), cone = new THREE.InstancedMesh(new THREE.ConeGeometry(.32, .85, 14), new THREE.MeshStandardMaterial({ color:"#f97316", roughness:.5 }), n);
      const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(.2, .245, .16, 14), new THREE.MeshStandardMaterial({ color:"#ffffff", roughness:.4, emissive:"#ffffff", emissiveIntensity:.3 }), n);
      const m = new THREE.Matrix4(); pos.forEach(([s, d], i) => { T.at(s, d, tmpV); m.makeTranslation(tmpV.x, .43, tmpV.z); cone.setMatrixAt(i, m); m.makeTranslation(tmpV.x, .52, tmpV.z); band.setMatrixAt(i, m); });
      cone.count = band.count = pos.length; cone.castShadow = true; scene.add(cone); scene.add(band);
    }

    // ── ซุ้ม START / FINISH ──
    const arch = (s, text) => {
      const g = new THREE.Group(); const yaw = T.at(s, 0, tmpV); g.position.copy(tmpV); g.rotation.y = yaw + Math.PI; scene.add(g);
      const pm = new THREE.MeshStandardMaterial({ color:"#1f2937", metalness:.5, roughness:.4 });
      for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.7, 7.4, .7), pm); p.position.set(sd * (HALF + 1.6), 3.7, 0); p.castShadow = true; g.add(p); }
      const ban = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 4, 1.9, .5), [pm, pm, pm, pm, new THREE.MeshStandardMaterial({ map:bannerTexture(text), roughness:.5, emissive:"#ffffff", emissiveIntensity:.15, emissiveMap:null }), pm]);
      ban.material[4].emissiveMap = ban.material[4].map; ban.position.y = 7.1; ban.castShadow = true; g.add(ban);
      const back = ban.material[4].clone(); ban.material[5] = back;
      return g;
    };
    const startArch = arch(START_S + 3, "START");
    const lights = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.SphereGeometry(.34, 18, 14), new THREE.MeshStandardMaterial({ color:"#330000", emissive:"#ff1a1a", emissiveIntensity:0 })); m.position.set((i - 1) * 1.1, 5.55, .1); startArch.add(m); return m; });
    arch(FINISH_S, "FINISH");
    { // เส้นชัยลายหมากรุกบนถนน
      for (const [s, c] of [[FINISH_S, true], [START_S, false]]) {
        const tex = canvasTex(256, 32, (x, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? "#111" : "#fff"; x.fillRect(i * 16, j * 16, 16, 16); } });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, c ? 2 : 1), new THREE.MeshStandardMaterial({ map:tex, roughness:.7 })); const yaw = T.at(s, 0, tmpV);
        m.rotation.order = "YXZ"; m.rotation.set(-Math.PI / 2, yaw, 0); m.position.set(tmpV.x, .045, tmpV.z); m.receiveShadow = true; scene.add(m);
      }
    }

    // ── ของข้างทาง (วัตถุไกลซ่อน) ──
    const props = []; // { o, s }
    const addProp = (o, s) => { props.push({ o, s }); scene.add(o); };
    const placeOK = (x, z, s, need) => T.nearDist(x, z, s) >= need;
    let kit = null, env = null;
    const gltf = new GLTFLoader();
    const templates = new Map();   // file → Promise<Object3D|null>
    const loadModel = file => { if (!templates.has(file)) templates.set(file, new Promise(res => { try { gltf.load(MDIR + file, g => res(g.scene), undefined, () => res(null)); } catch (e) { res(null); } })); return templates.get(file); };

    let loadN = 0; const loadTot = 3; const bump = () => { loadN++; if (alive) setHud(h => ({ ...h, loadP:loadN / loadTot })); };
    setupEnvironment({ THREE, renderer, scene, theme:THEME, BASE }).then(async e => {
      if (!alive) { e.dispose(); return; }
      env = e; scene.fog.color.copy(e.fogColor); if (!e.hasSky) scene.background = e.fogColor.clone();
      sunDir.copy(e.sunDir); sun.color.copy(e.sunColor); sun.intensity = e.sunIntensity; hemi.intensity = e.hemiIntensity;
      ground.material = e.groundMaterial; const gu = e.groundMaterial.userData.uniforms; if (gu?.uTintStrength) gu.uTintStrength.value = .78;
      // ถนนยางมะตอยจริง (asphalt_02) แทนลูกรังของธีม park
      const rm = e.roadMaterial; const rep = [3, ROAD_V / 4.3];
      try {
        const L = new THREE.TextureLoader(); const ld = u => new Promise(r => L.load(u, r, undefined, () => r(null)));
        const [d, n, r] = await Promise.all(["diff", "nor", "rough"].map(k => ld(`${BASE}3d/tex/asphalt_02_${k}.jpg`)));
        if (d && alive) {
          [[d, "map", true], [n, "normalMap", false], [r, "roughnessMap", false]].forEach(([t, key, srgb]) => { if (!t) return; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; const old = rm[key]; rm[key] = t; owned.push(t); if (old) old.dispose(); });
          rm.color.set("#b8bcc2"); rm.needsUpdate = true;
        } else { for (const t of [rm.map, rm.normalMap, rm.roughnessMap]) if (t) t.repeat.set(rep[0], rep[1]); }
      } catch (_) {}
      const u = rm.userData.uniforms; if (u?.uRep) u.uRep.value.set(rep[0], rep[1]); if (u?.uLineXf) u.uLineXf.value.x = ROAD_V / 13;
      road.material = rm; bump();
    }).catch(() => bump());
    loadPropKit({ THREE, theme:THEME, BASE, renderer }).then(k => {
      if (!alive) { k.dispose(); return; } kit = k;
      let side = 1;
      for (let s = 10; s < T.len; s += 9 + Math.random() * 7) {
        side = -side; const d = side * (RAIL_D + 2.5 + Math.random() * 9);
        const yaw = T.at(s, d, tmpV); if (!placeOK(tmpV.x, tmpV.z, s, Math.abs(d) - 1)) continue;
        const kind = k.kinds[Math.floor(Math.random() * k.kinds.length)]; const o = k.spawn(kind, Math.random());
        o.position.set(tmpV.x, 0, tmpV.z); o.rotation.y = o.userData.faceRoad ? (side > 0 ? yaw : yaw + Math.PI) : Math.random() * 6.28; addProp(o, s);
      }
      bump();
    }).catch(() => bump());
    // อาคาร KayKit (ไกลออกไป) + ป้ายไฟเสาธงข้างซุ้ม
    Promise.all("ABCDEFGH".split("").map(c => loadModel(`kk_building_${c}.glb`))).then(bs => {
      if (!alive) return; const ok = bs.filter(Boolean); if (!ok.length) return;
      ok.forEach(t => t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));
      for (const sd of [-1, 1]) for (let s = Math.random() * 20; s < T.len; s += 22 + Math.random() * 16) {
        if (Math.random() < .25) continue;
        const d = sd * (RAIL_D + 22 + Math.random() * 14), yaw = T.at(s, d, tmpV);
        if (!placeOK(tmpV.x, tmpV.z, s, Math.abs(d) - 4)) continue;
        const o = ok[Math.floor(Math.random() * ok.length)].clone(); const sc = 6.5 + Math.random() * 2.5; o.scale.setScalar(sc);
        o.position.set(tmpV.x, -.7, tmpV.z); o.rotation.y = sd > 0 ? Math.atan2(T.tz[Math.floor(s)], -T.tx[Math.floor(s)]) : Math.atan2(-T.tz[Math.floor(s)], T.tx[Math.floor(s)]); addProp(o, s);
      }
    });
    Promise.all([loadModel("rk_bannerTowerRed.glb"), loadModel("rk_flagCheckers.glb")]).then(([tower, flag]) => {
      if (!alive) return;
      const put = (tpl, s, d, hgt, faceIn) => { if (!tpl) return; const o = tpl.clone(true); o.traverse(m => { if (m.isMesh) m.castShadow = true; });
        const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3()); const sc = hgt / Math.max(.01, size.y);
        const wrap = new THREE.Group(); o.position.set(-c.x, -bb.min.y, -c.z); wrap.add(o); wrap.scale.setScalar(sc);
        const yaw = T.at(s, d, tmpV); wrap.position.copy(tmpV); wrap.rotation.y = yaw + (faceIn ? (d > 0 ? -Math.PI / 2 : Math.PI / 2) : 0); addProp(wrap, s); };
      for (const s of [START_S - 14, START_S + 20, FINISH_S - 30, FINISH_S + 12]) for (const sd of [-1, 1]) put(tower, s, sd * (RAIL_D + 1.6), 6.5, true);
      for (const s of [FINISH_S - 6, FINISH_S + 6]) for (const sd of [-1, 1]) put(flag, s, sd * (RAIL_D + .9), 4.2, true);
    });

    // ── แท่นโชว์รถ ──
    const podium = new THREE.Group(); scene.add(podium);
    { const top = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.1, .38, 48), new THREE.MeshPhysicalMaterial({ color:"#f8fafc", roughness:.25, clearcoat:1, metalness:.1 })); top.position.y = .19; top.receiveShadow = true; top.castShadow = true; podium.add(top);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.02, .07, 10, 64), new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:"#22d3ee", emissiveIntensity:2.2 })); ring.rotation.x = Math.PI / 2; ring.position.y = .3; podium.add(ring);
      const yaw = T.at(START_S, GRID_D[PLAYER_SLOT], tmpV); podium.position.copy(tmpV); podium.rotation.y = yaw; }

    // ── อนุภาค / เอฟเฟกต์ ──
    const dotTex = softDot(); owned.push(dotTex);
    const fxAdd = new Particles(900, true, dotTex), fxNorm = new Particles(1100, false, dotTex);
    scene.add(fxAdd.points); scene.add(fxNorm.points);
    const C = c => new THREE.Color(c);
    const COL = { smoke:C("#e5e7eb"), dust:C("#cbd5e1"), spark:C("#ffd166"), spark2:C("#ff8c42"), fire:C("#ff7a18"), fire2:C("#ffd23f"), blue:C("#60a5fa"), gold:C("#fde047"), green:C("#4ade80"), red:C("#ef4444") };
    const CONF = ["#f43f5e", "#facc15", "#22d3ee", "#a3e635", "#c084fc", "#fb923c", "#ffffff"].map(C);
    const burst = (p, cols, n, spd, size = .35, grav = 9, add = true) => { const sys = add ? fxAdd : fxNorm; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.2; sys.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * spd * Math.random(), Math.sin(e) * spd * (.4 + Math.random()), Math.sin(a) * Math.cos(e) * spd * Math.random(), .6 + Math.random() * .7, size * (.6 + Math.random() * .8), 0, cols[i % cols.length], 1, grav, .6); } };
    const flameTex = canvasTex(64, 128, (x, w, h) => { const g = x.createRadialGradient(32, 30, 2, 32, 50, 60); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,220,90,.95)"); g.addColorStop(.6, "rgba(255,100,20,.6)"); g.addColorStop(1, "rgba(255,40,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    owned.push(flameTex);
    // เส้นความเร็ว (ติดกล้อง)
    const SLN = 70, slPos = new Float32Array(SLN * 6), slSeed = Array.from({ length:SLN }, () => { const a = Math.random() * 6.283, r = 1.4 + Math.random() * 2.4; return { x:Math.cos(a) * r, y:Math.sin(a) * r * .7, z:-3 - Math.random() * 28 }; });
    const slg = new THREE.BufferGeometry(); slg.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
    const sline = new THREE.LineSegments(slg, new THREE.LineBasicMaterial({ color:"#ffffff", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
    sline.frustumCulled = false; camera.add(sline);

    // ── ประตูคำศัพท์ ──
    const gateGeo = { post:new THREE.CylinderGeometry(.13, .16, 6.3, 12), frame:new THREE.BoxGeometry(4.24, 3.24, .2), photo:new THREE.PlaneGeometry(3.98, 2.98), curtain:new THREE.PlaneGeometry(3.9, 3.1), cap:new THREE.SphereGeometry(.26, 16, 12) };
    Object.values(gateGeo).forEach(g => owned.push(g));
    const curtainMat = col => new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
      uniforms:{ uT:{ value:0 }, uC:{ value:new THREE.Color(col) }, uA:{ value:.55 } },
      vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:`uniform float uT; uniform vec3 uC; uniform float uA; varying vec2 vUv;
        void main(){ float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x);
          float chev = fract(vUv.y * 3.0 - abs(vUv.x - 0.5) * 1.6 + uT * 1.4); float band = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.18, 0.32, chev));
          float a = (0.10 + band * 0.55) * (0.35 + 0.65 * (1.0 - edge * 0.6)) * smoothstep(0.0, 0.35, vUv.y + 0.2) * uA;
          gl_FragColor = vec4(uC * a * 1.6, a); }` });
    const loaderT = new THREE.TextureLoader(); const texCache = new Map();
    const texFor = w => new Promise(res => {
      if (texCache.has(w.id)) return res(texCache.get(w.id));
      let url = null; try { url = ui.imageUrl(w); } catch (_) {}
      const fb = () => { const t = { tex:emojiTexture(w.emoji), aspect:4 / 3 }; texCache.set(w.id, t); res(t); };
      if (!url) return fb();
      loaderT.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const v = { tex:t, aspect:(t.image.width / t.image.height) || 4 / 3 }; texCache.set(w.id, v); res(v); }, undefined, fb);
    });
    const makeGate = (gi, set, texs) => {
      const g = new THREE.Group(); const yaw = T.at(GATE_S[gi], 0, tmpV); g.position.copy(tmpV); g.rotation.y = yaw + Math.PI; g.visible = false; scene.add(g);
      const subs = set.map((w, i) => {
        const sg = new THREE.Group(); sg.position.x = LANES[i]; g.add(sg);   // กลุ่มหมุน yaw+π: local +Z หันเข้าหาผู้เล่น, local +X = ขวาของถนน
        const col = LANE_COL[i];
        const glowM = new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:col, emissiveIntensity:2.0, roughness:.3 });
        for (const sx of [-2.05, 2.05]) { const p = new THREE.Mesh(gateGeo.post, glowM); p.position.set(sx, 3.15, 0); sg.add(p); const c = new THREE.Mesh(gateGeo.cap, glowM); c.position.set(sx, 6.35, 0); sg.add(c); }
        const panel = new THREE.Group(); panel.position.y = 4.85; sg.add(panel);
        const frameM = new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:col, emissiveIntensity:1.3, roughness:.4 });
        const frame = new THREE.Mesh(gateGeo.frame, frameM); frame.castShadow = true; panel.add(frame);
        const { tex, aspect } = texs[i]; const want = 3.98 / 2.98;
        const t = tex.clone(); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; owned.push(t);
        if (aspect > want) { t.repeat.set(want / aspect, 1); t.offset.set((1 - want / aspect) / 2, 0); } else { t.repeat.set(1, aspect / want); t.offset.set(0, (1 - aspect / want) / 2); }
        const photo = new THREE.Mesh(gateGeo.photo, new THREE.MeshBasicMaterial({ map:t, toneMapped:false, fog:false })); photo.position.z = .11; panel.add(photo);
        const back = new THREE.Mesh(gateGeo.photo, new THREE.MeshBasicMaterial({ map:t, toneMapped:false, fog:false })); back.rotation.y = Math.PI; back.position.z = -.11; panel.add(back);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:dotTex, color:col, transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); halo.scale.set(6.5, 5, 1); halo.position.z = -.3; panel.add(halo);
        const curtain = new THREE.Mesh(gateGeo.curtain, curtainMat(col)); curtain.position.y = 1.55; sg.add(curtain);
        return { sg, panel, frame, frameM, glowM, curtain, halo, w, lane:i };
      });
      return { g, subs, gi, set, born:-1, resolved:false };
    };

    // ── สถานะเกม ──
    const S = { phase:"select", t:0, cd:0, raceT:0, gate:0, correct:0, announced:-1, steer:0, keyL:false, keyR:false, btnL:false, btnR:false, drag:null, shake:0, flash:0, finishT:0, rankShown:0, camMode:"podium", camBlend:0, podSink:0, done:false, lastRank:0 };
    const P = { s:START_S, d:GRID_D[PLAYER_SLOT], v:0, lat:0, boost:0, spin:0, spinA:0, yawVis:0, roll:0, model:null, def:null, finished:false };
    const AIs = [0, 2, 3].map((slot, k) => ({ s:START_S, d:GRID_D[slot], v:0, lat:0, boost:0, spin:0, spinA:0, yawVis:0, roll:0, model:null, def:null, pace:AI_PACE[k], laneT:GRID_D[slot], acc:[.7, .78, .85][k], chosen:-1, nextG:0, finished:false, tag:null, avoid:0 }));
    const cars = [P, ...AIs];
    const finishOrder = [];
    const pool = words.length >= 3 ? words : words.concat(words, words);
    let gates = [];

    const mountModel = (car, def, color) => { car.req = def.file; return loadModel(def.file).then(tpl => {
      if (!alive || car.req !== def.file) return;
      if (car.model) { car.model.g.parent?.remove(car.model.g); }
      const m = tpl ? prepVehicle(tpl, def) : fallbackVehicle(color);
      car.model = m; car.def = def; scene.add(m.g);
      // ไฟพ่นเทอร์โบ 2 ดวงท้ายรถ
      const rearZ = m.box.min.z, hw = (m.box.max.x - m.box.min.x) / 2;
      m.flames = [-1, 1].map(sd => { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map:flameTex, color:"#ffffff", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); f.position.set(sd * Math.min(.45, hw * .4), .5, rearZ - .25); f.center.set(.5, .3); m.g.add(f); return f; });
      m.rearZ = rearZ; m.hw = hw;
      if (car.tag) { m.g.add(car.tag); car.tag.position.y = m.box.max.y + .9; }
    }); };

    const chooseAI = playerFile => shuffle(AI_FILES.filter(a => a.file !== playerFile)).slice(0, 3);
    let aiDefs = [];
    const setupAI = playerFile => {
      aiDefs = chooseAI(playerFile);
      AIs.forEach((a, i) => {
        const def = { ...aiDefs[i], front:-1 };
        if (a.tag) { a.tag.parent?.remove(a.tag); a.tag.material.map.dispose(); a.tag.material.dispose(); }
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map:labelTexture(def.word, ["#2563eb", "#db2777", "#16a34a"][i]), transparent:true, depthWrite:false, fog:false }));
        tag.scale.set(1.9, .48, 1); tag.renderOrder = 6; a.tag = tag;
        mountModel(a, def, "#64748b");
      });
      setRacers([{ emoji:RACER_VEHICLES.find(v => v.file === playerFile)?.emoji || "🚗", me:true }, ...aiDefs.map(d => ({ emoji:d.emoji, me:false }))]);
    };
    const setVehicleById = word => {
      const def = RACER_VEHICLES.find(v => v.word === word) || RACER_VEHICLES[0];
      return mountModel(P, def, "#ef4444").then(() => { if (alive && S.phase === "select") { const pf = def.file; if (!aiDefs.length || aiDefs.some(a => a.file === pf)) setupAI(pf); } });
    };
    setVehicleById(loadVeh()).then(() => { bump(); });

    // เลือกคำเป้าหมาย 10 คำ (เน้นคำที่มีรูป) + ตัวลวง 2 คำ → สร้างประตูล่วงหน้า
    const buildGates = async () => {
      let hasImg = pool.filter(w => { try { return !!ui.imageUrl(w); } catch (_) { return false; } });
      const src = hasImg.length >= 6 ? hasImg : pool;
      let order = shuffle(src); while (order.length < GATES) order = order.concat(shuffle(src));
      const targets = order.slice(0, GATES);
      const sets = targets.map(t => { const others = shuffle(pool.filter(w => w.id !== t.id && w.word !== t.word)); const dd = []; for (const o of others) { if (dd.length >= 2) break; if (!dd.some(x => x.word === o.word)) dd.push(o); } while (dd.length < 2) dd.push(others[0] || t); return { target:t, set:shuffle([t, ...dd]) }; });
      const out = [];
      for (let i = 0; i < GATES; i++) { const texs = await Promise.all(sets[i].set.map(texFor)); if (!alive) return; const gt = makeGate(i, sets[i].set, texs); gt.target = sets[i].target; out.push(gt); }
      gates = out;
    };

    // ── การผ่านประตู ──
    const resolveGate = gt => {
      if (gt.resolved) return; gt.resolved = true;
      let li = 0, best = 1e9; LANES.forEach((ld, i) => { const dd = Math.abs(P.d - ld); if (dd < best) { best = dd; li = i; } });
      const sub = gt.subs[li]; const ok = sub.w.id === gt.target.id || sub.w.word === gt.target.word;
      const wp = sub.panel.getWorldPosition(new THREE.Vector3());
      if (ok) {
        S.correct++; P.boost = BOOST_T; P.spin = 0; S.shake = Math.max(S.shake, .35);
        sub.panel.userData.fly = 1; burst(wp, [COL.gold, CONF[0], CONF[2], CONF[3], new THREE.Color("#ffffff")], 160, 14, .5, 6);
        try { ui.correct(gt.target); } catch (_) {}
        setHud(h => ({ ...h, correct:S.correct, fx:"turbo" }));
      } else {
        P.spin = SPIN_T; P.boost = 0; S.shake = 1; S.flash = 1;
        sub.panel.userData.fall = 1; burst(wp, [COL.red, new THREE.Color("#fecaca"), new THREE.Color("#ffffff")], 70, 8, .45, 9);
        try { ui.wrong(gt.target); } catch (_) {}
        setTimeout(() => { if (alive && !S.done) try { ui.say(gt.target); } catch (_) {} }, 900);
        setHud(h => ({ ...h, fx:"spin" }));
      }
      gt.subs.forEach(s2 => { if (s2.w.id === gt.target.id && s2 !== sub) { s2.frameM.emissive.set("#22c55e"); s2.frameM.emissiveIntensity = 2.2; } else if (s2 !== sub) s2.sg.userData.sink = 1; });
      setTimeout(() => { if (alive) setHud(h => ({ ...h, fx:null })); }, 1800);
      setTimeout(() => { if (alive) { gt.g.visible = false; } }, 2600);
    };

    // ── ควบคุม ──
    const startRace = () => {
      if (S.phase !== "select" || !gates.length) return false;
      S.phase = "countdown"; S.cd = 3.6; S.camMode = "chase"; S.camBlend = 0; S.lastCd = 4;
      setHud(h => ({ ...h, phase:"countdown", count:3 }));
      return true;
    };
    let gatesP = buildGates();
    api.current = {
      start: () => { if (S.phase !== "select") return; if (gates.length) startRace(); else gatesP.then(() => alive && startRace()); },
      setVehicle: word => { saveVeh(word); setVehicleById(word); },
      btn: (side, on) => { if (side < 0) S.btnL = on; else S.btnR = on; },
    };
    if (typeof window !== "undefined" && window.__RACER_TEST) window.__racer = { S, P, AIs, get gates() { return gates; }, LANES, GATE_S, FINISH_S, road, ground, T };   // ตะขอสำหรับทดสอบอัตโนมัติเท่านั้น
    const cv = renderer.domElement;
    const pd = e => { if (S.phase !== "race") return; S.drag = { x:e.clientX, d:P.d, id:e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
    const pm = e => { if (!S.drag || e.pointerId !== S.drag.id) return; const r = cv.getBoundingClientRect(); S.drag.target = clamp(S.drag.d + (e.clientX - S.drag.x) / r.width * 18, -HALF + 1.1, HALF - 1.1); };
    const pu = e => { if (S.drag && e.pointerId === S.drag.id) S.drag = null; };
    cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm); cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu);
    const kd = e => { if (e.key === "ArrowLeft") S.keyL = true; if (e.key === "ArrowRight") S.keyR = true; };
    const ku = e => { if (e.key === "ArrowLeft") S.keyL = false; if (e.key === "ArrowRight") S.keyR = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    let composer = null;
    try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), .45, .4, 2.2)); composer.addPass(new OutputPass()); } catch (e) { composer = null; }
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); composer?.setSize(W(), H()); }); ro.observe(el);

    // ── ฟิสิกส์รถ ──
    const desiredRank = () => (S.correct >= 8 ? 1 : S.correct >= 6 ? 2 : S.correct >= 4 ? 3 : 4);
    const driveCar = (c, dt, isP) => {
      let vt;
      if (S.phase !== "race" && S.phase !== "finish") vt = 0;
      else if (c.finished) vt = 0;
      else if (isP) vt = c.boost > 0 ? BOOST_V : BASE_V;
      else {
        vt = c.boost > 0 ? c.pace + 14 : c.pace;
        const gap = c.s - P.s;
        if (!P.finished && P.s < GATE_S[GATES - 1] + 4) { if (gap > 40) vt *= .86; else if (gap > 22) vt *= .95; if (gap < -40) vt *= 1.18; else if (gap < -22) vt *= 1.06; }
        else if (!P.finished) {   // ทางตรงสุดท้าย: จัดอันดับตามจำนวนข้อที่ถูก
          const ahead = desiredRank() - 1, myIdx = AIs.indexOf(c);
          const order = AIs.slice().sort((a, b2) => b2.pace - a.pace); const shouldBeAhead = order.indexOf(c) < ahead;
          const pv = Math.max(14, P.v), eta = Math.max(.3, (FINISH_S - P.s) / pv), rem = FINISH_S - c.s;
          if (rem > 0) vt = shouldBeAhead ? clamp(rem / Math.max(.25, eta * .82 - myIdx * .2), 15, 50) : clamp(rem / (eta * 1.18 + .6 + myIdx * .35), 12, 34);
          if (vt > c.pace + 6) c.boost = Math.max(c.boost, .2);
        } else vt = c.pace;
      }
      if (c.spin > 0) { vt = 8; c.spin -= dt; }
      if (c.boost > 0) c.boost -= dt;
      const acc = vt > c.v ? (c.boost > 0 ? 22 : 9) : (c.spin > 0 ? 26 : (c.finished ? 9 : 12));
      c.v += clamp(vt - c.v, -acc * dt, acc * dt);
      c.s += c.v * dt;
      if (c.s >= T.len - 15) { c.s = T.len - 15; c.v = 0; }
      if (!c.finished && c.s >= FINISH_S && (S.phase === "race" || S.phase === "finish")) { c.finished = true; finishOrder.push(c); }
    };

    // ── ลูปหลัก ──
    let raf = 0, last = performance.now(), lastCull = 0;
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camInit = { done:false };
    const q = new THREE.Quaternion(), qs = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0), ay = new THREE.Vector3(0, 1, 0);
    const placeCar = (c, dt, t) => {
      const m = c.model; if (!m) return;
      const yaw = T.at(c.s, c.d, tmpV);
      // หมุนคว้าง
      if (c.spin > 0) c.spinA = (1 - c.spin / SPIN_T); else c.spinA = 0;
      const spinYaw = c.spinA > 0 ? (1 - Math.pow(1 - c.spinA, 2.2)) * Math.PI * 4 : 0;
      const slip = c.v > 3 ? Math.atan2(c.lat, c.v) : 0;
      c.yawVis = lerp(c.yawVis, slip * 1.25, Math.min(1, dt * 8));
      c.roll = lerp(c.roll, -c.lat * .012, Math.min(1, dt * 6));
      m.g.position.copy(tmpV);
      m.g.rotation.set(0, yaw + c.yawVis + spinYaw, 0);
      m.inner.rotation.z = c.roll * (c.def?.front < 0 ? -1 : 1);
      m.inner.position.y = (c.v > 1 ? Math.sin(t * 38 + c.s) * .012 : 0);
      m.spin += c.v * dt / .42;
      for (const w of m.wheels) { q.copy(w.q0); qs.setFromAxisAngle(ax, m.spin * (c.def?.front < 0 ? -1 : 1)); q.multiply(qs); if (w.front) { const st = clamp(c.lat * .05, -.45, .45); qs.setFromAxisAngle(ay, st); q.premultiply(qs); } w.o.quaternion.copy(q); }
      // ไฟเทอร์โบ
      const on = c.boost > 0 ? 1 : 0;
      m.flames?.forEach((f, i) => { const k = on * (.75 + Math.random() * .5); f.material.opacity = lerp(f.material.opacity, on ? .95 : 0, Math.min(1, dt * 12)); f.scale.set(.75 * k + .01, 1.9 * k + .01, 1); f.material.rotation = Math.PI; });
      if (on && c.model) { const back = new THREE.Vector3(0, .5, m.rearZ - .5).applyMatrix4(m.g.matrixWorld); for (let i = 0; i < 2; i++) fxAdd.emit(back.x + (Math.random() - .5) * .5, back.y + Math.random() * .2, back.z + (Math.random() - .5) * .5, (Math.random() - .5) * 1.5, 1 + Math.random(), (Math.random() - .5) * 1.5, .32, .7, -1.2, Math.random() < .5 ? COL.fire : COL.fire2, .9, -1, 1); }
      // ควันดริฟต์ / หมุน
      const drift = Math.abs(c.lat) > 5.5 && c.v > 14, spinning = c.spin > 0;
      if ((drift || spinning) && Math.random() < (spinning ? .9 : .55)) {
        for (const sd of [-1, 1]) { const pnt = new THREE.Vector3(sd * m.hw * .8, .15, m.rearZ + .5).applyMatrix4(m.g.matrixWorld);
          fxNorm.emit(pnt.x, pnt.y, pnt.z, (Math.random() - .5) * 1.5, .8 + Math.random(), (Math.random() - .5) * 1.5, 1.1, .8, 2.4, COL.smoke, .55, -.3, 1.2); }
      }
    };

    const tick = now => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const dt = Math.min(DT_MAX, (now - last) / 1000); last = now; S.t += dt; S.frames = (S.frames || 0) + 1; const t = S.t;

      // ── นับถอยหลัง ──
      if (S.phase === "countdown") {
        S.cd -= dt; const n = Math.ceil(S.cd - .6);
        if (n !== S.lastCd) { S.lastCd = n; if (n >= 1 && n <= 3) { try { sfx.tap(); } catch (_) {} setHud(h => ({ ...h, count:n })); lights.forEach((l, i) => { l.material.emissive.set("#ff1a1a"); l.material.emissiveIntensity = i < 4 - n ? 3 : 0; }); } }
        if (S.cd <= .6) { S.phase = "race"; S.raceT = 0; try { sfx.coin(); } catch (_) {} lights.forEach(l => { l.material.emissive.set("#22ff55"); l.material.emissiveIntensity = 3.5; }); setHud(h => ({ ...h, phase:"race", count:0, go:true })); setTimeout(() => alive && setHud(h => ({ ...h, go:false })), 900); }
      }
      if (S.phase === "race") S.raceT += dt;

      // ── ผู้เล่น: บังคับเลี้ยว ──
      if (S.phase === "race" || S.phase === "finish") {
        const steer = (S.keyR || S.btnR ? 1 : 0) - (S.keyL || S.btnL ? 1 : 0);
        let latT;
        if (P.finished) latT = clamp((0 - P.d) * 1.5, -4, 4);
        else if (S.drag && S.drag.target != null) latT = clamp((S.drag.target - P.d) * 5, -12, 12);
        else latT = steer * 10.5;
        if (P.spin > 0) latT *= .2;
        P.lat += clamp(latT - P.lat, -40 * dt, 40 * dt);
        P.d += P.lat * dt;
        const lim = HALF - 1.0;
        if (Math.abs(P.d) > lim) { const sd = Math.sign(P.d); P.d = sd * lim; if (Math.abs(P.lat) > 3 && P.v > 8) { // เสียดสีขอบทาง → ประกายไฟ
            const m = P.model; if (m) { const pnt = new THREE.Vector3(sd * m.hw, .3, 0).applyMatrix4(m.g.matrixWorld); for (let i = 0; i < 3; i++) fxAdd.emit(pnt.x, pnt.y, pnt.z, (Math.random() - .5) * 5, 2 + Math.random() * 3, (Math.random() - .5) * 5, .35, .22, 0, Math.random() < .5 ? COL.spark : COL.spark2, 1, 12, .5); }
            P.v *= (1 - dt * .6); S.shake = Math.max(S.shake, .15); }
          P.lat *= .3; }
      }
      // ── AI ──
      AIs.forEach((a, k) => {
        if (S.phase !== "race" && S.phase !== "finish") return;
        // เลือกประตู
        const gi = a.nextG < GATES ? a.nextG : -1;
        if (gi >= 0 && gates[gi] && GATE_S[gi] - a.s < 75 && a.chosen !== gi) { a.chosen = gi; const gt = gates[gi]; const ci = Math.max(0, gt.subs.findIndex(s2 => s2.w.id === gt.target.id)); a.goodPick = Math.random() < a.acc; a.laneT = a.goodPick ? LANES[ci] : LANES[(ci + 1 + Math.floor(Math.random() * 2)) % 3]; }
        if (gi >= 0 && a.s >= GATE_S[gi]) { a.nextG++; if (a.goodPick) a.boost = BOOST_T * .85; else if (Math.random() < .7) a.spin = SPIN_T * .8; if (a.nextG >= GATES) a.laneT = GRID_D[[0, 2, 3][k]] * .8; }
        // หลบรถคันหน้า
        let target = a.laneT; const nearGate = gi >= 0 && GATE_S[gi] - a.s < 45;
        if (!nearGate) for (const o of cars) { if (o === a) continue; const ds = o.s - a.s; if (ds > 2 && ds < 16 && Math.abs(o.d - target) < 2.4 && a.v > o.v - 1) { target = o.d + (o.d > 0 ? -3 : 3); break; } }
        const latT = clamp((target - a.d) * 2.2, -8, 8) * (a.spin > 0 ? .2 : 1);
        a.lat += clamp(latT - a.lat, -26 * dt, 26 * dt); a.d = clamp(a.d + a.lat * dt, -HALF + 1, HALF - 1);
      });
      cars.forEach(c => driveCar(c, dt, c === P));
      // ชนกัน (ดันข้าง)
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b2 = cars[j]; const ds = b2.s - a.s, dd = b2.d - a.d;
        if (Math.abs(ds) < 3.4 && Math.abs(dd) < 2.0) {
          const push = (2.0 - Math.abs(dd)) / 2 * (dd >= 0 ? 1 : -1); a.d = clamp(a.d - push, -HALF + 1, HALF - 1); b2.d = clamp(b2.d + push, -HALF + 1, HALF - 1);
          if (Math.abs(dd) < 1.4) { const back = ds > 0 ? a : b2, front = ds > 0 ? b2 : a; if (back.v > front.v) { back.v = front.v * .98; } }
          if ((a === P || b2 === P) && S.t - (S.lastBump || 0) > .35) { S.lastBump = S.t; S.shake = Math.max(S.shake, .4); const mid = new THREE.Vector3(); T.at((a.s + b2.s) / 2, (a.d + b2.d) / 2, mid); mid.y = .6;
            for (let k = 0; k < 18; k++) fxAdd.emit(mid.x, mid.y, mid.z, (Math.random() - .5) * 7, 2 + Math.random() * 4, (Math.random() - .5) * 7, .45, .25, 0, k % 2 ? COL.spark : COL.spark2, 1, 12, .4); try { sfx.tap(); } catch (_) {} }
        }
      }
      cars.forEach(c => placeCar(c, dt, t));
      AIs.forEach(a => { if (!a.tag || !a.model) return; a.tag.visible = S.phase !== "select"; const dc = camera.position.distanceTo(a.model.g.position); a.tag.material.opacity = clamp((dc - 9) / 6, 0, 1); });

      // ── ประกาศคำ / ประตู ──
      if (S.phase === "race") {
        const nx = S.announced + 1;
        if (nx < GATES && gates[nx] && P.s >= GATE_S[nx] - 165) {
          S.announced = nx; const gt = gates[nx]; gt.g.visible = true; gt.born = t;
          try { ui.say(gt.target); } catch (_) {}
          setHud(h => ({ ...h, target:gt.target, gate:nx + 1 }));
        }
        for (const gt of gates) if (!gt.resolved && gt.g.visible && P.s >= GATE_S[gt.gi]) resolveGate(gt);
      }
      for (const gt of gates) {
        if (!gt.g.visible) continue;
        const age = t - gt.born, e = age < .7 ? 1 - Math.pow(1 - age / .7, 3) * Math.cos(age * 9) : 1;
        gt.g.scale.set(1, Math.max(.01, e), 1);
        gt.subs.forEach((s2, i) => {
          s2.curtain.material.uniforms.uT.value = t;
          s2.halo.material.opacity = .4 + Math.sin(t * 5 + i) * .15;
          const pnl = s2.panel;
          if (pnl.userData.fly) { pnl.position.y += dt * 9; pnl.rotation.y += dt * 12; pnl.scale.multiplyScalar(1 - dt * 1.2); }
          else if (pnl.userData.fall) { pnl.rotation.x = Math.min(1.5, pnl.rotation.x + dt * 4); pnl.position.y = Math.max(1, pnl.position.y - dt * 5); }
          else { pnl.position.y = 4.85 + Math.sin(t * 2.4 + i) * .1; pnl.rotation.y = Math.sin(t * 1.6 + i) * .05; }
          if (s2.sg.userData.sink) s2.sg.position.y = Math.max(-7, s2.sg.position.y - dt * 6);
        });
      }

      // ── อันดับ / ความคืบหน้า ──
      if (S.phase === "race" || S.phase === "finish") {
        const rank = P.finished ? finishOrder.indexOf(P) + 1 : 1 + cars.filter(c => c !== P && (c.finished || c.s > P.s)).length;
        if (rank !== S.lastRank) { S.lastRank = rank; setHud(h => ({ ...h, rank })); }
        if (barRef.current) { const kids = barRef.current.children; cars.forEach((c, i) => { const k = kids[i]; if (k) k.style.left = `${clamp((c.s - START_S) / (FINISH_S - START_S), 0, 1) * 100}%`; }); }
      }
      if (S.phase === "race" && P.finished) {
        S.phase = "finish"; S.done = true; const rank = finishOrder.indexOf(P) + 1;
        try { sfx.win(); } catch (_) {}
        for (let k = 0; k < 8; k++) setTimeout(() => { if (!alive) return; const p = new THREE.Vector3(); T.at(P.s + 6, 0, p); p.y = 6 + Math.random() * 2; p.x += (Math.random() - .5) * 10; p.z += (Math.random() - .5) * 6; for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283; fxNorm.emit(p.x, p.y, p.z, Math.cos(a) * (2 + Math.random() * 7), 3 + Math.random() * 7, Math.sin(a) * (2 + Math.random() * 7), 2.2 + Math.random() * 1.2, .32, 0, CONF[i % CONF.length], 1, 5, 1.1); } }, k * 260);
        S.camMode = "orbit"; S.orbitA = 0;
        setHud(h => ({ ...h, phase:"finish", target:null, done:{ rank, correct:S.correct } }));
        setTimeout(() => { if (alive) track.finish(S.correct, GATES, { label:`อันดับ ${rank} · ถูก ${S.correct}/${GATES}` }); }, 3400);
      }

      // ── แท่น ──
      if (S.phase === "select") {
        podium.position.y = 0; podium.rotation.y += dt * .6;
        if (P.model) { const yaw0 = T.at(START_S, GRID_D[PLAYER_SLOT]); P.model.g.position.set(podium.position.x, .38 + Math.sin(t * 2) * .03, podium.position.z); P.model.g.rotation.y = yaw0 + Math.PI * .8 + t * .6; }
      } else if (podium.position.y > -1) {
        podium.position.y -= dt * .8;
        if (P.model && S.phase === "countdown") P.model.g.position.y = Math.max(0, .38 + podium.position.y);
      }

      // ── อนุภาค + เส้นความเร็ว ──
      fxAdd.update(dt); fxNorm.update(dt);
      const sp = clamp((P.v - BASE_V - 2) / (BOOST_V - BASE_V - 2), 0, 1);
      sline.material.opacity = lerp(sline.material.opacity, sp * .55, Math.min(1, dt * 6));
      slSeed.forEach((s2, i) => { s2.z += dt * (30 + P.v * 1.5); if (s2.z > -2) s2.z = -32; slPos.set([s2.x, s2.y, s2.z, s2.x, s2.y, s2.z - 1 - sp * 4], i * 6); }); slg.attributes.position.needsUpdate = true;

      // ── กล้อง ──
      S.shake = Math.max(0, S.shake - dt * 2.2); const sh = S.shake * S.shake * .55;
      const pyaw = T.at(P.s, P.d, tmpV2); const pPos = tmpV2.clone();
      const fwd = new THREE.Vector3(Math.sin(pyaw), 0, Math.cos(pyaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      let cp, cl;
      if (S.camMode === "podium") { // มองรถจากด้านหน้าเฉียง
        const pp = podium.position, mb = P.model?.box, ext = mb ? Math.max(mb.max.z - mb.min.z, (mb.max.y - mb.min.y) * 2) : 3.6, dist = 3.6 + ext * 1.35;
        cp = pp.clone().addScaledVector(fwd, dist).addScaledVector(right, dist * .14); cp.y = 1.2 + dist * .17; cl = pp.clone(); cl.y = -.9; cl.addScaledVector(right, .4);
      } else if (S.camMode === "orbit") {
        S.orbitA = (S.orbitA || 0) + dt * .45; const a = S.orbitA + 0.4; cp = pPos.clone().addScaledVector(fwd, Math.cos(a) * 8).addScaledVector(right, Math.sin(a) * 8); cp.y = 3.0; cl = pPos.clone(); cl.y = 1.1;
      } else {
        const back = 7.6 + sp * 1.4, hgt = 3.2 - sp * .3;
        cp = pPos.clone().addScaledVector(fwd, -back).addScaledVector(right, -P.d * .12); cp.y = hgt; cl = pPos.clone().addScaledVector(fwd, 9); cl.y = 1.5;
      }
      if (!camInit.done) { camPos.copy(cp); camLook.copy(cl); camInit.done = true; }
      const k1 = S.camMode === "chase" ? Math.min(1, dt * (S.phase === "countdown" ? 2.2 : 7)) : Math.min(1, dt * 3);
      camPos.lerp(cp, k1); camLook.lerp(cl, Math.min(1, k1 * 2.5));
      camera.position.copy(camPos); camera.position.x += (Math.random() - .5) * sh; camera.position.y += (Math.random() - .5) * sh;
      camera.lookAt(camLook);
      const fov = S.camMode === "chase" ? 62 + clamp((P.v - 10) / 30, 0, 1) * 16 : 50;
      camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 4)); camera.updateProjectionMatrix();
      const ps = renderer.getPixelRatio() * H() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      fxAdd.uniforms.uScale.value = ps; fxNorm.uniforms.uScale.value = ps;
      // เงาตามผู้เล่น
      sun.position.copy(pPos).addScaledVector(sunDir, 80); sun.target.position.copy(pPos).addScaledVector(fwd, 14);
      // ซ่อนของไกล
      if (t - lastCull > .25) { lastCull = t; const s0 = S.camMode === "podium" ? START_S : P.s; for (const p of props) p.o.visible = p.s > s0 - 60 && p.s < s0 + 330; }
      S.flash = Math.max(0, S.flash - dt * 2); el.style.setProperty("--flash", S.flash.toFixed(2)); el.style.setProperty("--boost", (P.boost > 0 ? Math.min(1, P.boost) : 0).toFixed(2));
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      cv.removeEventListener("pointerdown", pd); cv.removeEventListener("pointermove", pm); cv.removeEventListener("pointerup", pu); cv.removeEventListener("pointercancel", pu);
      scene.traverse(o => {
        o.geometry?.dispose?.();
        const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { for (const k of ["map", "emissiveMap", "normalMap", "roughnessMap"]) x[k]?.dispose?.(); x.uniforms?.map?.value?.dispose?.(); x.dispose?.(); });
      });
      templates.forEach(p => p.then(tpl => tpl && tpl.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); })));
      texCache.forEach(v => v.tex?.dispose?.());
      owned.forEach(x => x?.dispose?.());
      env?.dispose?.(); kit?.dispose?.(); composer?.dispose?.(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []); // eslint-disable-line

  const btn = { minHeight:64, borderRadius:32, border:"none", background:tk.card, color:tk.ink, fontSize:30, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, fontFamily:"inherit", touchAction:"none", userSelect:"none", WebkitUserSelect:"none" };
  const holdProps = side => ({
    onPointerDown: e => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} api.current.btn?.(side, true); },
    onPointerUp: () => api.current.btn?.(side, false), onPointerCancel: () => api.current.btn?.(side, false), onLostPointerCapture: () => api.current.btn?.(side, false),
    onContextMenu: e => e.preventDefault(),
  });
  const racing = hud.phase !== "select";
  const shadowTxt = "0 2px 8px rgba(0,0,0,.65)";
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:8 }}>
      {racing && (hud.target
        ? <Prompt w={hud.target} onClick={() => ui.say(hud.target)} />
        : <div style={{ minHeight:96, margin:"2px auto 12px", width:"100%", maxWidth:480, borderRadius:28, background:tk.card, color:tk.ink, boxShadow:tk.shadow, display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontWeight:800, fontSize:17, padding:"0 14px", textAlign:"center" }}>
            🏁 ฟังคำ แล้วขับผ่านประตูรูปที่ถูก!</div>)}
      <div style={{ position:"relative", height:racing ? "min(56vh, 560px)" : "min(68vh, 640px)", minHeight:300, borderRadius:28, overflow:"hidden", background:"#0b1220" }}>
        <div ref={host} data-racer3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 58%, rgba(0,0,0,.25))" }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 40%, rgba(239,68,68,.75))", opacity:"var(--flash, 0)" }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 45%, rgba(255,140,30,.55))", opacity:"var(--boost, 0)" }} />

        {racing && <>
          <div style={{ position:"absolute", left:10, top:8, right:10, display:"flex", justifyContent:"space-between", alignItems:"flex-start", pointerEvents:"none", color:"#fff", textShadow:shadowTxt, fontWeight:900 }}>
            <div style={{ fontSize:16, lineHeight:1.3 }}>🚧 {Math.min(hud.gate, GATES)}/{GATES}<br />⭐ {hud.correct}</div>
            <div style={{ textAlign:"right", lineHeight:1 }}>
              <div style={{ fontSize:34 }}>{ORD[hud.rank]}</div>
              <div style={{ fontSize:13, marginTop:2 }}>อันดับ {hud.rank}/4</div>
            </div>
          </div>
          <div style={{ position:"absolute", left:"22%", right:"24%", top:16, height:8, borderRadius:4, background:"rgba(255,255,255,.45)", pointerEvents:"none" }}>
            <div style={{ position:"absolute", right:-6, top:-9, fontSize:16 }}>🏁</div>
            <div ref={barRef} style={{ position:"absolute", inset:0 }}>
              {racers.map((r, i) => <span key={i} style={{ position:"absolute", left:"0%", top:r.me ? -13 : -9, transform:"translateX(-50%)", fontSize:r.me ? 22 : 15, filter:r.me ? "drop-shadow(0 0 4px #fff)" : "none", zIndex:r.me ? 2 : 1 }}>{r.emoji}</span>)}
            </div>
          </div>
        </>}
        {hud.fx && <div style={{ position:"absolute", left:0, right:0, top:"30%", textAlign:"center", pointerEvents:"none", fontWeight:900, fontSize:38, color:hud.fx === "turbo" ? "#fde047" : "#fecaca", textShadow:"0 3px 0 rgba(0,0,0,.35), 0 0 18px rgba(0,0,0,.5)", animation:"none" }}>
          {hud.fx === "turbo" ? "🔥 TURBO!" : "💫 อุ๊ย!"}</div>}
        {hud.phase === "countdown" && hud.count > 0 && <div key={hud.count} style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", fontSize:120, fontWeight:900, color:"#fff", textShadow:"0 6px 0 rgba(0,0,0,.3), 0 0 30px rgba(0,0,0,.5)" }}>{hud.count}</div>}
        {hud.go && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", fontSize:96, fontWeight:900, color:"#4ade80", textShadow:"0 6px 0 rgba(0,0,0,.3), 0 0 30px rgba(0,0,0,.5)" }}>GO!</div>}
        {hud.done && <div style={{ position:"absolute", left:0, right:0, top:"13%", textAlign:"center", pointerEvents:"none", color:"#fff", textShadow:shadowTxt, fontWeight:900 }}>
          <div style={{ fontSize:56, lineHeight:1 }}>{hud.done.rank === 1 ? "🏆" : hud.done.rank === 2 ? "🥈" : hud.done.rank === 3 ? "🥉" : "🏁"}</div>
          <div style={{ fontSize:36 }}>อันดับ {hud.done.rank}!</div>
          <div style={{ fontSize:18 }}>ถูก {hud.done.correct}/{GATES}</div>
        </div>}

        {!racing && <>
          <div style={{ position:"absolute", top:12, left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:shadowTxt }}>Word Racer 3D</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:shadowTxt }}>ฟังคำ → ขับผ่านประตูรูปที่ถูก = เทอร์โบ!</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"28px 10px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"linear-gradient(180deg, transparent, rgba(0,0,0,.6))" }}>
            <button onClick={() => { sayVeh(vDef); try { sfx.tap(); } catch (_) {} }} className="m3-press" aria-label={`ฟังคำ ${vDef.word}`}
              style={{ ...btn, minHeight:52, fontSize:20, padding:"6px 18px", display:"flex", alignItems:"center", gap:10, maxWidth:"100%" }}>
              <span>🔊</span><span style={{ fontWeight:900, letterSpacing:.5 }}>{vDef.word}</span><span style={{ fontSize:15, fontWeight:700, opacity:.8 }}>{thOf(vDef)}</span>
            </button>
            <div style={{ display:"flex", gap:5, flexWrap:"nowrap", overflowX:"auto", maxWidth:"100%", padding:"2px 4px", scrollbarWidth:"none" }}>
              {RACER_VEHICLES.map(v => <button key={v.word} aria-label={v.word} className="m3-press"
                onClick={() => { setVeh(v.word); api.current.setVehicle?.(v.word); sayVeh(v); }}
                style={{ flex:"none", width:64, minHeight:58, padding:"4px 2px", borderRadius:18, border:`3px solid ${veh === v.word ? tk.primary : "transparent"}`, background:veh === v.word ? tk.card : "rgba(255,255,255,.78)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, fontFamily:"inherit" }}>
                <span style={{ fontSize:26, lineHeight:1 }}>{v.emoji}</span><span style={{ fontSize:9, fontWeight:800, color:tk.ink, lineHeight:1.05, textAlign:"center" }}>{v.word}</span></button>)}
            </div>
            <button disabled={!hud.ready && hud.loadP < 1} onClick={() => { ui.unlock?.(); sayVeh(vDef); api.current.start?.(); }} className="m3-press"
              style={{ ...btn, minWidth:210, fontSize:22, background:tk.primary, color:tk.onPrimary, opacity:hud.loadP < 1 ? .7 : 1 }}>
              {hud.loadP < 1 ? `กำลังโหลด… ${Math.round(hud.loadP * 100)}%` : "▶ เริ่ม!"}</button>
          </div>
        </>}
        {hud.msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18, textAlign:"center", padding:20 }}>{hud.msg}</div>}
      </div>
      {racing && !hud.done && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <button aria-label="เลี้ยวซ้าย" className="m3-press" style={btn} {...holdProps(-1)}>◀</button>
        <button aria-label="เลี้ยวขวา" className="m3-press" style={btn} {...holdProps(1)}>▶</button>
      </div>}
    </div>
  );
}
