// Word Runner 3D — วิ่ง 3 เลน ฟังคำ แล้ววิ่งชนป้ายรูปที่ถูก (three.js โหลดเฉพาะตอนเปิดเกม)
// กราฟิก: ท้องฟ้าจำลองบรรยากาศ (Sky) + แสงสะท้อนจากท้องฟ้า (PMREM) · เนินเขาต่อเนื่องไร้รอยต่อ · หญ้าหลายพันใบไหวตามลม
//         เมฆนุ่ม · น้ำทะเลสะท้อนแสง (ชายหาด) · เงานุ่ม · bloom · อนุภาค · กล้องสั่น
// ตัวละคร: สัตว์จากคลังคำศัพท์ 15 ตัว (มีท่าวิ่งจริง · Quaternius CC0 · Fox CC-BY) + เด็ก/หุ่นยนต์ · ของสะสมระหว่างทาง = คำศัพท์ในหมวด (runner/collectibles.js)
// สีของโลก 3D เป็นงานศิลป์ของฉาก (ไม่ใช่สี UI) · ปุ่ม/HUD ใช้โทเค็นจาก App ผ่าน ui.tokens
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { setupEnvironment } from "./runner/environment.js";
import { loadPropKit, faceRoadRotation } from "./runner/props.js";
import { createCollectibles, PICK_Y } from "./runner/collectibles.js";
import { createHazards } from "./runner/obstacles.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
const L = 120;                         // ความยาวช่วงพื้นที่วนซ้ำ (เนินเขา/หญ้าต่อกันพอดี)
const LANES = [-3, 0, 3];
const ROW_Z = -58;
const SESSION = 300;                   // เล่นได้ 5 นาทีต่อรอบ
const PTS = { gate:10, item:1, hazard:-5, wrong:-3 };
// ใช้ทดสอบเท่านั้น: window.__R3D_DEBUG = { time: 40 } → ย่อเวลาเล่น
const sessionLen = () => { try { const d = typeof window !== "undefined" && window.__R3D_DEBUG; if (d && d.time > 0) return d.time; } catch (_) { /* ignore */ } return SESSION; };
let MAX_DT = .05; try { if (typeof window !== "undefined" && window.__R3D_DEBUG?.maxDt) MAX_DT = window.__R3D_DEBUG.maxDt; } catch (_) { /* ignore */ }   // ทดสอบบนเครื่องช้า
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const THEMES = {
  jungle: { name:"ป่าใหญ่",       sky:["#1e6fd9", "#6fb6ff", "#e3f3ff"], elev:38, azim:200, turb:2.5, ray:3, fog:"#e3f3ff", hills:1.1, low:"#3d7a2a", high:"#79b955", grass:["#2f6b1f","#8fd14f"], road:"#9a5b2c", line:"#ffe39a", props:["tree","tree","bush","rock","flower"] },
  park:   { name:"สวนสนุก",       sky:["#3a7bd5", "#8ec5ff", "#f3f8ff"], elev:45, azim:150, turb:2, ray:3.2, fog:"#f3f8ff", hills:.7,  low:"#4f9a35", high:"#93d46a", grass:["#3f8a2a","#a6e36a"], road:"#b9a3e3", line:"#ffffff", props:["tree","balloon","flower","bush","tree"] },
  school: { name:"ทางไปโรงเรียน", sky:["#2f80ed", "#9cc9ff", "#fff7e0"], elev:50, azim:170, turb:1.8, ray:3.4, fog:"#fff7e0", hills:.5,  low:"#58a840", high:"#9be07a", grass:["#4a9a30","#b3ea7c"], road:"#d9a441", line:"#ffffff", props:["tree","pencil","book","flower","bush"] },
  snow:   { name:"ภูเขาหิมะ",     sky:["#4a88c7", "#a9d2f5", "#f4f8fc"], elev:22, azim:220, turb:1.2, ray:2.6, fog:"#f4f8fc", hills:1.8, low:"#c9d9ea", high:"#ffffff", road:"#b7c7d8", line:"#38bdf8", props:["pine","pine","snowman","rock","pine"], snow:true },
  city:   { name:"เมืองใหญ่",     sky:["#3d6fb6", "#93b9e6", "#e9eef5"], elev:28, azim:250, turb:2.6, ray:2.8, fog:"#e9eef5", hills:0,   low:"#7b8794", high:"#9aa5b1", road:"#2f3640", line:"#facc15", props:["building","building","lamp","building","tree"], car:true, sidewalk:true },
  beach:  { name:"ชายหาด",        sky:["#0f8fd8", "#6fd3ff", "#fff3d6"], elev:30, azim:120, turb:1.6, ray:3.6, fog:"#fff3d6", hills:.5,  low:"#e7cc8d", high:"#f6e5b8", road:"#e9c77b", line:"#0ea5e9", props:["palm","palm","rock","umbrella","palm"], water:true },
  candy:  { name:"ถนนขนมหวาน",    sky:["#ff7ab8", "#ffb0d5", "#ffe7a8"], fog:"#ffe7a8", hills:.8, low:"#f7a8cf", high:"#fff0f6", road:"#8b4a2b", line:"#ffd1e6", props:["lollipop","cupcake","candycane","lollipop","donut"], sprinkles:true },
  space:  { name:"ถนนอวกาศ",      sky:["#070b24", "#2a0f6b", "#5b21b6"], fog:"#5b21b6", hills:1.4, low:"#24124f", high:"#5c3fa8", road:"#1d1147", line:"#22d3ee", props:["crystal","crystal","planet","rock","crystal"], stars:true },
};
const CAT_THEME = { animals:"jungle", nature:"jungle", fruits:"candy", food:"candy", vegetables:"park", vehicles:"city", places:"city", jobs:"city",
  weather:"snow", time:"snow", technology:"space", music:"space", shapes:"space", numbers:"space", countries:"beach", school:"school",
  sports:"park", toys:"park", family:"park", feelings:"park", body:"park", clothes:"park", home:"park", colors:"candy", actions:"park", opposites:"space" };
export const themeKey = catId => CAT_THEME[catId] || "park";
export const themeOf = catId => THEMES[themeKey(catId)];

// ตัวละคร: สัตว์จากคลังคำศัพท์ (word = คำในหมวด Animals · h = ความสูงเป้าหมายในโลก 3D) + เด็ก/หุ่นยนต์ (ไม่ใช่คำศัพท์)
// ทุกตัวหน้าอยู่ทาง +z · ไฟล์ใน public/models และ public/models/animals (CREDITS.md)
export const CHARS = [
  { id:"fox",      word:"FOX",      name:"จิ้งจอก",   emoji:"🦊", url:"models/fox.glb",               h:1.15, run:"Run",     idle:"Survey" },
  { id:"shiba",    word:"DOG",      name:"หมา",      emoji:"🐕", url:"models/shiba.glb",             h:1.2,  run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"cow",      word:"COW",      name:"วัว",      emoji:"🐄", url:"models/animals/cow.glb",       h:1.45, run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"horse",    word:"HORSE",    name:"ม้า",      emoji:"🐴", url:"models/horse.glb",             h:1.6,  run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"stag",     word:"DEER",     name:"กวาง",     emoji:"🦌", url:"models/animals/stag.glb",      h:1.7,  run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"donkey",   word:"DONKEY",   name:"ลา",       emoji:"🫏", url:"models/animals/donkey.glb",    h:1.45, run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"llama",    word:"LLAMA",    name:"ลามะ",     emoji:"🦙", url:"models/animals/llama.glb",     h:1.55, run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"wolf",     word:"WOLF",     name:"หมาป่า",   emoji:"🐺", url:"models/animals/wolf.glb",      h:1.25, run:"Gallop",  idle:"Idle", happy:"Gallop_Jump" },
  { id:"trex",     word:"DINOSAUR", name:"ไดโนเสาร์", emoji:"🦖", url:"models/animals/trex.glb",      h:1.75, run:"Run",     idle:"Idle", happy:"Jump" },
  { id:"frog",     word:"FROG",     name:"กบ",       emoji:"🐸", url:"models/animals/frog.glb",      h:.6,   run:"Jump",    idle:"Idle", runRate:.75 },
  { id:"mouse",    word:"MOUSE",    name:"หนู",      emoji:"🐭", url:"models/animals/mouse.glb",     h:.6,   run:"Run",     idle:"Idle", happy:"Jump" },
  { id:"crab",     word:"CRAB",     name:"ปู",       emoji:"🦀", url:"models/animals/crab.glb",      h:.8,   run:"Walk",    idle:"Idle", happy:"Yes", sad:"No", runRate:1.5 },
  { id:"snake",    word:"SNAKE",    name:"งู",       emoji:"🐍", url:"models/animals/snake.glb",     h:.65,  run:"Walk",    idle:"Idle", happy:"Jump", runRate:1.4 },
  { id:"bee",      word:"BEE",      name:"ผึ้ง",      emoji:"🐝", url:"models/animals/bee.glb",       h:.9,   run:"Flying",  idle:"Flying", fly:.9 },
  { id:"spider",   word:"SPIDER",   name:"แมงมุม",   emoji:"🕷️", url:"models/animals/spider.glb",    h:.75,  run:"Walk",    idle:"Idle", happy:"Jump", runRate:1.4 },
  { id:"bunnykid", name:"กระต่ายน้อย", emoji:"🐰", url:"models/bunnykid.glb", scale:.5,   run:"Run",       idle:"Idle", happy:"Wave", sad:"No" },
  { id:"redpanda", name:"แพนด้าแดง", emoji:"🦝", url:"models/redpanda.glb", scale:.62,  run:"Run",       idle:"Idle", happy:"Wave", sad:"No" },
  { id:"mage",     name:"พ่อมดน้อย", emoji:"🧙", url:"models/mage.glb",     scale:.64,  run:"Running_A", idle:"Idle", happy:"Cheer" },
  { id:"robot",    name:"หุ่นยนต์",  emoji:"🤖", url:"models/robot.glb",    scale:.42,  run:"Running",   idle:"Idle", happy:"Jump", sad:"No" },
];
const ANIMAL_CHARS = CHARS.filter(c => c.word), KID_CHARS = CHARS.filter(c => !c.word);
// รายการตัวละครที่เลือกได้ตามหมวด: หมวดสัตว์ = สัตว์ในคลังคำเท่านั้น · ป่า/สวน = สัตว์ก่อน · หมวดอื่น = เด็ก + สัตว์
export const charsFor = (catId, words = []) => {
  const have = new Set(words.map(w => (w.word || "").toUpperCase()));
  const animals = [...ANIMAL_CHARS].sort((a, b) => have.has(b.word) - have.has(a.word));
  if (catId === "animals") return animals;
  const tk = themeKey(catId);
  return tk === "jungle" || tk === "park" ? [...animals, ...KID_CHARS] : [...KID_CHARS, ...animals];
};
const CHAR_KEY = "smart-vocabplay:runner-char";
const loadChar = list => { try { const v = localStorage.getItem(CHAR_KEY); return list.some(c => c.id === v) ? v : list[0].id; } catch (_) { return list[0].id; } };
const saveChar = id => { try { localStorage.setItem(CHAR_KEY, id); } catch (_) {} };

// ── ความสูงเนินเขา (ฟังก์ชันเดียวกันใน JS และ GLSL · วนซ้ำทุก L หน่วย จึงต่อกันไร้รอย) ──
const K = Math.PI * 2 / L;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const makeHeight = th => (x, z) => {
  if (th.water && x > 0) return -1.2 * smooth(4.8, 9, x);
  const e = smooth(4.8, 13, Math.abs(x)) * th.hills;
  return e * (1.3 + 1.1 * Math.sin(3 * K * z + x * .35) + .7 * Math.sin(5 * K * z + 1.7) * Math.cos(x * .23) + .45 * Math.sin(8 * K * z - x * .6) + Math.abs(x) * .07);
};
const HEIGHT_GLSL = th => `
float sm(float a,float b,float x){ float t=clamp((x-a)/(b-a),0.,1.); return t*t*(3.-2.*t); }
float hgt(float x,float z){
  ${th.water ? "if(x>0.) return -1.2*sm(4.8,9.,x);" : ""}
  float e=sm(4.8,13.,abs(x))*${th.hills.toFixed(3)};
  float k=${K.toFixed(6)};
  return e*(1.3+1.1*sin(3.*k*z+x*.35)+.7*sin(5.*k*z+1.7)*cos(x*.23)+.45*sin(8.*k*z-x*.6)+abs(x)*.07);
}`;

// ── ยูทิลิตี้ ──
function cssColor(v, fallback = "#7c3aed") {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d");
    x.fillStyle = fallback; x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fallback;
    x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255);
  } catch (_) { return new THREE.Color(fallback); }
}
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
function emojiTexture(emoji) {
  return canvasTex(320, 240, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#fef3c7"); g.addColorStop(1, "#fbcfe8"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.font = "150px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji || "⭐", w / 2, h / 2 + 8); });
}
function roadTexture(th) {
  const t = canvasTex(512, 1024, (x, w, h) => {
    x.fillStyle = th.road; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = Math.random(); x.fillStyle = `rgba(${v > .5 ? "255,255,255" : "0,0,0"},${Math.random() * .09})`; const s = Math.random() * 3 + 1; x.fillRect(Math.random() * w, Math.random() * h, s, s); }
    if (th.sprinkles) for (let i = 0; i < 700; i++) { x.save(); x.translate(Math.random() * w, Math.random() * h); x.rotate(Math.random() * 6); x.fillStyle = ["#f43f5e","#facc15","#22d3ee","#a3e635","#ffffff","#c084fc"][i % 6]; x.fillRect(-7, -2, 14, 4); x.restore(); }
    x.fillStyle = th.line; [w / 3, 2 * w / 3].forEach(px => { for (let y = 0; y < h; y += 256) { x.fillRect(px - 6, y + 20, 12, 150); } });
    x.fillStyle = "rgba(255,255,255,.75)"; x.fillRect(6, 0, 12, h); x.fillRect(w - 18, 0, 12, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); t.anisotropy = 8; return t;
}
function cloudTexture() {
  return canvasTex(256, 128, (x, w, h) => { for (let i = 0; i < 14; i++) { const cx = 40 + Math.random() * 176, cy = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(.6, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); } });
}
function glowTexture() {
  return canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
}
function waterNormalTexture() {
  const t = canvasTex(256, 256, (x, w, h) => { const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = (i / w) * Math.PI * 2, b = (j / h) * Math.PI * 2;
      const nx = Math.sin(a * 4 + Math.cos(b * 3)) * .5 + Math.sin(a * 9 + b * 2) * .25, ny = Math.cos(b * 5 + Math.sin(a * 2)) * .5 + Math.cos(b * 11 - a * 3) * .25;
      const k = (j * w + i) * 4; img.data[k] = 128 + nx * 90; img.data[k + 1] = 128 + ny * 90; img.data[k + 2] = 255; img.data[k + 3] = 255; }
    x.putImageData(img, 0, 0); }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function windowTexture() {
  return canvasTex(128, 256, (x, w, h) => { x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 14; r++) for (let c = 0; c < 5; c++) { const on = Math.random() > .45; x.fillStyle = on ? ["#fde68a","#fef3c7","#bae6fd"][Math.floor(Math.random() * 3)] : "#111827"; x.fillRect(8 + c * 24, 8 + r * 18, 16, 11); } });
}

// ── ของประกอบฉาก ──
const MAT = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color:c, roughness:.75, ...o })); };
function organic(geo, amt) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7 - v.y) * amt; v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; }
function shadeVerts(geo, c1, c2) { const p = geo.attributes.position, col = []; const a = new THREE.Color(c1), b = new THREE.Color(c2); let min = 1e9, max = -1e9;
  for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - min) / Math.max(.001, max - min); const c = a.clone().lerp(b, t + (Math.random() - .5) * .15); col.push(c.r, c.g, c.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return geo; }
function makeProp(kind, r, extra) {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const vc = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.85 });
  if (kind === "tree") {
    const s = .9 + r * .8;
    add(new THREE.CylinderGeometry(.18 * s, .32 * s, 2.4 * s, 9), mat("#6b4423", { roughness:.95 }), 0, 1.2 * s);
    for (let i = 0; i < 4; i++) { const geo = shadeVerts(organic(new THREE.IcosahedronGeometry((1 + Math.random() * .5) * s, 2), .12), "#1f5a1c", ["#5fae3c","#7ccf4a","#4c9a32"][Math.floor(r * 3)]);
      add(geo, vc, (Math.random() - .5) * 1.4 * s, (2.6 + Math.random() * 1.2) * s, (Math.random() - .5) * 1.4 * s); }
  } else if (kind === "bush") { for (let i = 0; i < 3; i++) add(shadeVerts(organic(new THREE.IcosahedronGeometry(.6 + Math.random() * .4, 2), .15), "#1e4d16", "#69b84a"), vc, (i - 1) * .6, .5, Math.random() * .4); }
  else if (kind === "flower") { for (let i = 0; i < 7; i++) { const x = (Math.random() - .5) * 2.4, z = (Math.random() - .5) * 2.4; add(new THREE.CylinderGeometry(.025, .025, .6, 5), mat("#3f8a2a"), x, .3, z);
      add(new THREE.SphereGeometry(.13, 10, 8), mat(["#f43f5e","#facc15","#c084fc","#fb923c","#ffffff"][i % 5], { roughness:.5 }), x, .62, z); } }
  else if (kind === "rock") { add(shadeVerts(organic(new THREE.DodecahedronGeometry(.8 + r * .9, 1), .2), extra.space ? "#3b2a73" : "#6b7280", extra.space ? "#7c5cd6" : "#b6bcc6"), vc, 0, .4, 0).scale.y = .7; }
  else if (kind === "pine") { const s = .9 + r * .9; add(new THREE.CylinderGeometry(.15 * s, .25 * s, 1.4 * s, 8), mat("#5b3a1e"), 0, .7 * s);
    for (let i = 0; i < 4; i++) { add(shadeVerts(organic(new THREE.ConeGeometry((1.7 - i * .35) * s, 1.5 * s, 12, 3), .06), "#14532d", "#2f7d4a"), vc, 0, (1.5 + i * .85) * s);
      add(new THREE.ConeGeometry((1.2 - i * .3) * s, .5 * s, 12), mat("#ffffff", { roughness:.5 }), 0, (2.05 + i * .85) * s); } }
  else if (kind === "snowman") { add(new THREE.SphereGeometry(.8, 20, 16), mat("#ffffff", { roughness:.4 }), 0, .8); add(new THREE.SphereGeometry(.55, 20, 16), mat("#ffffff", { roughness:.4 }), 0, 1.9); add(new THREE.SphereGeometry(.4, 20, 16), mat("#ffffff", { roughness:.4 }), 0, 2.7);
    add(new THREE.ConeGeometry(.08, .45, 8), mat("#f97316"), 0, 2.7, .45).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(.42, .42, .08, 20), mat("#ef4444"), 0, 2.35); }
  else if (kind === "lollipop") { add(new THREE.CylinderGeometry(.08, .08, 3.2, 10), mat("#ffffff", { roughness:.3 }), 0, 1.6);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .35, 40), new THREE.MeshPhysicalMaterial({ map:canvasTex(256, 256, (x, w) => { for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? "#ffffff" : ["#f43f5e","#a855f7","#22c55e","#f59e0b"][Math.floor(r * 4)]; x.beginPath(); x.moveTo(w / 2, w / 2); x.arc(w / 2, w / 2, w / 2, i * Math.PI / 6, (i + 1) * Math.PI / 6 + .3); x.fill(); } }), clearcoat:1, clearcoatRoughness:.1, roughness:.25 }));
    disc.rotation.x = Math.PI / 2; disc.position.y = 3.6; disc.castShadow = true; g.add(disc); }
  else if (kind === "cupcake") { add(new THREE.CylinderGeometry(.8, .6, .9, 18), mat("#f59e0b", { roughness:.6 }), 0, .45); add(organic(new THREE.SphereGeometry(.85, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), .08), new THREE.MeshPhysicalMaterial({ color:["#fbcfe8","#bfdbfe","#fef08a"][Math.floor(r * 3)], clearcoat:.6, roughness:.4 }), 0, .9); add(new THREE.SphereGeometry(.18, 12, 10), mat("#dc2626", { roughness:.2 }), 0, 1.8); }
  else if (kind === "candycane") { const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0), new THREE.Vector3(.3, 3.6, 0), new THREE.Vector3(.9, 3.5, 0), new THREE.Vector3(1.1, 3, 0)]);
    const tex = canvasTex(64, 512, (x, w, h) => { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); for (let y = -h; y < h * 2; y += 48) { x.fillStyle = "#ef4444"; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + 30); x.lineTo(w, y + 54); x.lineTo(0, y + 24); x.fill(); } }); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 3);
    const m = new THREE.Mesh(new THREE.TubeGeometry(path, 40, .16, 12), new THREE.MeshPhysicalMaterial({ color:"#fff", map:tex, clearcoat:1, roughness:.2 })); m.castShadow = true; g.add(m); }
  else if (kind === "donut") { const d = add(new THREE.TorusGeometry(.8, .4, 18, 36), mat("#d97706", { roughness:.7 }), 0, 1.3); d.rotation.y = r * 3; const ic = add(new THREE.TorusGeometry(.8, .42, 18, 36), new THREE.MeshPhysicalMaterial({ color:["#f472b6","#fde047","#a78bfa"][Math.floor(r * 3)], clearcoat:1, roughness:.25 }), 0, 1.38); ic.rotation.y = d.rotation.y; ic.scale.z = .6; }
  else if (kind === "building") { const h = 5 + r * 12, w = 3 + r * 1.5; const tex = extra.win.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, h / 6); tex.needsUpdate = true;
    const b = add(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color:["#64748b","#475569","#94a3b8","#334155"][Math.floor(r * 4)], roughness:.5, metalness:.3, emissive:"#ffffff", emissiveMap:tex, emissiveIntensity:1.1 }), 0, h / 2);
    add(new THREE.BoxGeometry(w + .3, .4, w + .3), mat("#1f2937"), 0, h + .2); add(new THREE.BoxGeometry(.8, .8, .8), mat("#9ca3af"), w * .2, h + .8, 0); b.receiveShadow = true; }
  else if (kind === "lamp") { add(new THREE.CylinderGeometry(.07, .1, 4.2, 8), mat("#374151", { metalness:.7, roughness:.3 }), 0, 2.1); add(new THREE.BoxGeometry(1.1, .12, .2), mat("#374151", { metalness:.7 }), .45, 4.15);
    add(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshStandardMaterial({ color:"#fff", emissive:"#fff1c1", emissiveIntensity:4 }), .9, 4.0); }
  else if (kind === "palm") { const curve = new THREE.CatmullRomCurve3([0, 1.5, 3, 4.5].map((y, i) => new THREE.Vector3(Math.sin(i * .5) * .25 * i, y, 0)));
    const tr = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .22, 10), mat("#a16207", { roughness:.95 })); tr.castShadow = true; g.add(tr);
    const top = curve.getPoint(1);
    for (let i = 0; i < 8; i++) { const leaf = new THREE.Mesh(organic(new THREE.ConeGeometry(.32, 2.8, 4, 6), .05), mat(i % 2 ? "#15803d" : "#22a34a", { side:THREE.DoubleSide })); leaf.scale.z = .25; leaf.position.copy(top); leaf.rotation.set(Math.PI / 2.3, i * Math.PI / 4, 0, "YXZ"); leaf.translateY(1.3); leaf.castShadow = true; g.add(leaf); }
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(.2, 10, 8), mat("#78350f"), top.x + (i - 1) * .25, top.y - .2, .15); }
  else if (kind === "umbrella") { add(new THREE.CylinderGeometry(.05, .05, 3, 8), mat("#f8fafc"), 0, 1.5); add(new THREE.ConeGeometry(1.6, .8, 16, 1, true), new THREE.MeshStandardMaterial({ map:canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#fff" : ["#ef4444","#0ea5e9","#f59e0b"][Math.floor(r * 3)]; x.fillRect(i * w / 8, 0, w / 8, h); } }), side:THREE.DoubleSide, roughness:.7 }), 0, 3.1); }
  else if (kind === "pencil") { const c = ["#facc15","#3b82f6","#ef4444","#22c55e"][Math.floor(r * 4)]; add(new THREE.CylinderGeometry(.42, .42, 4.2, 6), mat(c, { roughness:.4 }), 0, 2.1); add(new THREE.ConeGeometry(.42, 1, 6), mat("#f6d7b0"), 0, 4.7); add(new THREE.ConeGeometry(.14, .34, 6), mat("#111827"), 0, 5.05); add(new THREE.CylinderGeometry(.43, .43, .4, 12), mat("#cbd5e1", { metalness:.8, roughness:.3 }), 0, .2); }
  else if (kind === "book") { for (let i = 0; i < 4; i++) { const bk = add(new THREE.BoxGeometry(1.6, .35, 1.2), mat(["#ef4444","#3b82f6","#22c55e","#f59e0b"][i]), (Math.random() - .5) * .2, .18 + i * .36, 0); bk.rotation.y = (Math.random() - .5) * .4; } }
  else if (kind === "crystal") { for (let i = 0; i < 3; i++) { const c = ["#22d3ee","#a855f7","#f472b6"][(i + Math.floor(r * 3)) % 3];
      const m = add(new THREE.OctahedronGeometry(.5 + Math.random() * .7, 0), new THREE.MeshPhysicalMaterial({ color:c, emissive:c, emissiveIntensity:.9, roughness:.05, metalness:.1, clearcoat:1 }), (i - 1) * .7, 1 + Math.random(), (Math.random() - .5)); m.scale.y = 2; m.rotation.z = (i - 1) * .3; } }
  else if (kind === "planet") { const p = add(new THREE.SphereGeometry(1.2 + r, 32, 24), new THREE.MeshStandardMaterial({ map:canvasTex(256, 128, (x, w, h) => { for (let y = 0; y < h; y += 6) { x.fillStyle = `hsl(${(r * 360 + y) % 360},70%,${45 + Math.sin(y * .2) * 15}%)`; x.fillRect(0, y, w, 6); } }), roughness:.8 }), 0, 4 + r * 3);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8 + r, 2.6 + r, 48), new THREE.MeshStandardMaterial({ color:"#fde68a", side:THREE.DoubleSide, transparent:true, opacity:.7 })); ring.position.copy(p.position); ring.rotation.x = 1.2; g.add(ring); }
  else if (kind === "balloon") { for (let i = 0; i < 3; i++) { const x = (i - 1) * .7; add(new THREE.CylinderGeometry(.015, .015, 2.6, 4), mat("#e5e7eb"), x * .3, 1.3, 0);
      const b = add(new THREE.SphereGeometry(.55, 24, 18), new THREE.MeshPhysicalMaterial({ color:["#f43f5e","#22d3ee","#facc15","#a855f7"][(i + Math.floor(r * 4)) % 4], clearcoat:1, clearcoatRoughness:.05, roughness:.2 }), x, 3 + i * .3, 0); b.scale.y = 1.15; } }
  return g;
}

// ── ตัวละครปั้นด้วยโค้ด (มีแขนขาวิ่ง · หน้าอยู่ทาง +z) ──
function makeProcChar(kind, primary) {
  const P = {
    cat:   { body:"#f59e0b", belly:"#fff7ed", ear:"cat", tail:true },
    bunny: { body:"#f5f5f4", belly:"#ffe4e6", ear:"bunny", tail:"puff" },
    panda: { body:"#fafafa", belly:"#fafafa", ear:"round", dark:"#1f2937", tail:"puff" },
  }[kind] || { body:"#" + primary.getHexString(), belly:"#ffffff", ear:"cat" };
  const fur = c => new THREE.MeshPhysicalMaterial({ color:c, roughness:.85, sheen:1, sheenRoughness:.6, sheenColor:new THREE.Color(c).lerp(new THREE.Color("#ffffff"), .5) });
  const glossy = c => new THREE.MeshPhysicalMaterial({ color:c, roughness:.15, clearcoat:1 });
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const dark = P.dark ? fur(P.dark) : fur(P.body);
  add(body, new THREE.CapsuleGeometry(.4, .45, 8, 20), fur(P.body), 0, .95, 0);
  add(body, new THREE.SphereGeometry(.32, 20, 16), fur(P.belly), 0, .92, .2).scale.set(1, 1.2, .7);
  const head = new THREE.Group(); head.position.set(0, 1.75, 0); body.add(head);
  add(head, new THREE.SphereGeometry(.5, 32, 24), fur(P.body)).scale.set(1.08, .98, 1);
  add(head, new THREE.SphereGeometry(.26, 20, 16), fur(P.belly), 0, -.12, .36).scale.set(1.2, .8, .7);
  add(head, new THREE.SphereGeometry(.06, 10, 8), glossy("#3b1f1f"), 0, -.04, .55);
  for (const x of [-.19, .19]) {
    if (P.dark) add(head, new THREE.SphereGeometry(.15, 16, 12), dark, x, .06, .38).scale.set(1, 1.25, .5);
    add(head, new THREE.SphereGeometry(.085, 16, 12), glossy("#111827"), x, .07, .44);
    add(head, new THREE.SphereGeometry(.028, 8, 6), new THREE.MeshBasicMaterial({ color:"#ffffff" }), x + .03, .11, .52);
    add(head, new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshStandardMaterial({ color:"#fb7185", transparent:true, opacity:.6 }), x * 1.6, -.1, .4);
  }
  for (const s of [-1, 1]) {
    if (P.ear === "cat") { const e = add(head, new THREE.ConeGeometry(.16, .34, 12), fur(P.body), s * .3, .45, 0); e.rotation.z = -s * .3; add(e, new THREE.ConeGeometry(.09, .2, 10), fur("#fda4af"), 0, -.02, .05); }
    else if (P.ear === "bunny") { const e = add(head, new THREE.CapsuleGeometry(.09, .55, 6, 12), fur(P.body), s * .17, .75, -.05); e.rotation.z = -s * .12; add(e, new THREE.CapsuleGeometry(.05, .45, 6, 10), fur("#fda4af"), 0, 0, .05); }
    else add(head, new THREE.SphereGeometry(.15, 16, 12), dark, s * .36, .4, 0);
  }
  const limb = (x, y, len, r, m) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); body.add(piv); add(piv, new THREE.CapsuleGeometry(r, len, 6, 12), m, 0, -len / 2 - r * .5, 0); return piv; };
  const legs = [limb(-.2, .55, .32, .14, dark), limb(.2, .55, .32, .14, dark)];
  const arms = [limb(-.45, 1.25, .3, .1, dark), limb(.45, 1.25, .3, .1, dark)];
  arms[0].rotation.z = .25; arms[1].rotation.z = -.25;
  if (P.tail === true) add(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, .7, -.35), new THREE.Vector3(0, .9, -.75), new THREE.Vector3(0, 1.4, -.85), new THREE.Vector3(0, 1.6, -.7)]), 20, .07, 8), fur(P.body));
  else if (P.tail) add(body, new THREE.SphereGeometry(.16, 14, 10), fur("#ffffff"), 0, .75, -.4);
  return { g, body, head, legs, arms, proc:true };
}
function makeCar(primary) {
  const g = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(-1.25, 0); shape.lineTo(1.25, 0); shape.quadraticCurveTo(1.4, 0, 1.35, .3); shape.lineTo(1.2, .55); shape.quadraticCurveTo(.6, .62, .45, .65);
  shape.quadraticCurveTo(.15, 1.05, -.35, 1.05); shape.quadraticCurveTo(-.85, 1.05, -1.05, .65); shape.lineTo(-1.3, .55); shape.quadraticCurveTo(-1.42, .3, -1.25, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth:1.5, bevelEnabled:true, bevelThickness:.12, bevelSize:.1, bevelSegments:4 }); geo.center(); geo.rotateY(Math.PI / 2);
  const paint = new THREE.MeshPhysicalMaterial({ color:primary, metalness:.55, roughness:.22, clearcoat:1, clearcoatRoughness:.05 });
  const bodyM = new THREE.Mesh(geo, paint); bodyM.position.y = .78; bodyM.castShadow = true; g.add(bodyM);
  const wheels = [];
  for (const [x, z] of [[-.82, .82], [.82, .82], [-.82, -.82], [.82, -.82]]) { const w = new THREE.Group(); w.position.set(x, .36, z); g.add(w); wheels.push(w);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(.26, .13, 12, 24), new THREE.MeshStandardMaterial({ color:"#111827", roughness:.9 })); tire.rotation.y = Math.PI / 2; tire.castShadow = true; w.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .2, 12), new THREE.MeshStandardMaterial({ color:"#e5e7eb", metalness:1, roughness:.2 })); rim.rotation.z = Math.PI / 2; w.add(rim); }
  for (const x of [-.55, .55]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshStandardMaterial({ color:"#fff", emissive:"#fffbe6", emissiveIntensity:4 })); hl.position.set(x, .78, -1.42); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, .05), new THREE.MeshStandardMaterial({ color:"#ef4444", emissive:"#ef4444", emissiveIntensity:2 })); tl.position.set(x, .85, 1.43); g.add(tl); }
  return { g, wheels };
}
function makeCard(tex, aspect) {
  const g = new THREE.Group(); const W = 2.7, H = 3.6;   // ป้ายแนวตั้ง 3:4 ให้ตรงกับรูปมาตรฐาน
  const s = new THREE.Shape(); const w = W / 2 + .14, h = H / 2 + .14, r = .22;
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const fgeo = new THREE.ExtrudeGeometry(s, { depth:.1, bevelEnabled:true, bevelThickness:.05, bevelSize:.05, bevelSegments:3 }); fgeo.center();
  const frame = new THREE.Mesh(fgeo, new THREE.MeshPhysicalMaterial({ color:"#ffffff", roughness:.25, clearcoat:1, emissive:"#ffffff", emissiveIntensity:.12, fog:false }));
  frame.castShadow = true; g.add(frame);
  const pw = W, ph = H, pa = W / H;   // เต็มป้ายแบบ cover (ไม่มีขอบว่าง)
  if (tex && tex.repeat) { if (aspect > pa) { tex.repeat.set(pa / aspect, 1); tex.offset.set((1 - pa / aspect) / 2, 0); } else { tex.repeat.set(1, aspect / pa); tex.offset.set(0, (1 - aspect / pa) * .58); } tex.needsUpdate = true; }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map:tex, toneMapped:false, fog:false })); pic.position.z = .11; g.add(pic);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.6, 10), new THREE.MeshStandardMaterial({ color:"#e5e7eb", metalness:.8, roughness:.25 })); pole.position.y = -(H / 2) - .8; pole.scale.y = 1.3; pole.castShadow = true; g.add(pole);
  return { g, frame, pic };   // ภาพหันไปทาง +z (หาผู้เล่น)
}

export default function Runner3D({ words, speak, track, catId, sfx, Prompt, ui }) {
  const host = useRef(null);
  const api = useRef({});
  const [LEN] = useState(sessionLen);
  const [hud, setHud] = useState({ started:false, score:0, correct:0, total:0, combo:0, left:LEN, basket:[], target:null, on:false, paused:false, banner:null, msg:null, loading:false });
  const [pops, setPops] = useState([]);       // คำที่ลอยขึ้นตอนเก็บของ (HTML label ~1 วิ)
  const charList = useRef(null); if (!charList.current) charList.current = charsFor(catId, words);
  const [charId, setCharId] = useState(() => loadChar(charList.current));
  const th = themeOf(catId);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const W = () => el.clientWidth, H = () => el.clientHeight;
    const hgt = makeHeight(th);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" }); } catch (e) { setHud(h => ({ ...h, msg:"เครื่องนี้ไม่รองรับ 3D" })); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement); renderer.domElement.style.display = "block"; renderer.domElement.style.touchAction = "none";

    let alive = true;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(th.fog, 60, 190);
    const camera = new THREE.PerspectiveCamera(54, W() / H(), .1, 1200);
    camera.position.set(0, 2.1, 4.4); camera.lookAt(0, 1.45, -2);

    // ── ท้องฟ้า + แสง ──
    const sunDir = new THREE.Vector3();
    const pmrem = new THREE.PMREMGenerator(renderer);
    // ท้องฟ้าไล่สี 3 ระดับ + ดวงอาทิตย์เรืองแสง (สีสดกว่าแบบจำลองฟิสิกส์ และไม่ทำให้ bloom ฟุ้งทั้งภาพ)
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - (th.elev || 35)), THREE.MathUtils.degToRad(th.azim || 200));
    const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
      uniforms:{ top:{ value:new THREE.Color(th.sky[0]) }, mid:{ value:new THREE.Color(th.sky[1]) }, hor:{ value:new THREE.Color(th.sky[2]) }, sunD:{ value:sunDir.clone() }, sunOn:{ value:th.stars ? 0 : 1 } },
      vertexShader:"varying vec3 vp; void main(){ vp=(modelMatrix*vec4(position,1.)).xyz-cameraPosition; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }",
      fragmentShader:`uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunD; uniform float sunOn; varying vec3 vp;
        void main(){ vec3 d=normalize(vp); float h=d.y;
          vec3 c=mix(hor, mid, smoothstep(-.02,.22,h)); c=mix(c, top, smoothstep(.2,.85,h));
          float s=max(dot(d, normalize(sunD)),0.);
          c+=sunOn*(vec3(1.,.95,.8)*pow(s,900.)*2.2 + vec3(1.,.9,.7)*pow(s,10.)*.22);
          gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }` });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat); scene.add(sky);
    { const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat)); envScene.add(new THREE.HemisphereLight(th.sky[1], th.low, 1.2));
      scene.environment = pmrem.fromScene(envScene, .03).texture; }
    if (th.stars) { const n = 2500, p = new Float32Array(n * 3), cl = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(600); v.y = Math.abs(v.y) * .9 + 10; p.set([v.x, v.y, v.z], i * 3); const c = new THREE.Color().setHSL(.6 + Math.random() * .3, .6, .75 + Math.random() * .25); cl.set([c.r, c.g, c.b], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(p, 3)); sg.setAttribute("color", new THREE.BufferAttribute(cl, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size:2.2, vertexColors:true, fog:false, sizeAttenuation:false, transparent:true, depthWrite:false }))); }
    const hemi = new THREE.HemisphereLight(th.sky[1], th.low, .6); scene.add(hemi);
    const sun = new THREE.DirectionalLight(th.stars ? "#c4b5fd" : "#fff4e0", th.stars ? 1.6 : 2.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
    Object.assign(sun.shadow.camera, { left:-14, right:14, top:16, bottom:-12, near:1, far:80 }); scene.add(sun); scene.add(sun.target);

    // เมฆ
    const clouds = [];
    if (!th.stars) { const ct = cloudTexture(); for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:ct, transparent:true, depthWrite:false, fog:false, opacity:.85, color:th.sprinkles ? "#fff1f8" : "#ffffff" }));
      sp.scale.set(70 + Math.random() * 60, 28 + Math.random() * 20, 1); sp.position.set((Math.random() - .5) * 500, 45 + Math.random() * 40, -150 - Math.random() * 350); sp.userData.v = .5 + Math.random(); scene.add(sp); clouds.push(sp); } }

    // ── พื้นเนินเขา (3 แผ่นวนต่อกัน) ──
    const tgeo = new THREE.PlaneGeometry(260, L, 130, 60); tgeo.rotateX(-Math.PI / 2); tgeo.translate(0, 0, -L / 2);
    { const p = tgeo.attributes.position, col = []; const lo = new THREE.Color(th.low), hi = new THREE.Color(th.high);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const y = hgt(x, z); p.setY(i, y);
        const t = Math.min(1, Math.max(0, y / 4 + .35 + Math.sin(x * .9 + z * .7) * .08 + (Math.random() - .5) * .08)); const c = lo.clone().lerp(hi, t); col.push(c.r, c.g, c.b); }
      tgeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); tgeo.computeVertexNormals(); }
    const tmat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:th.snow ? .55 : .95, metalness:0 });
    const tiles = [-1, 0, 1].map(i => { const m = new THREE.Mesh(tgeo, tmat); m.receiveShadow = true; m.userData.i = i; scene.add(m); return m; });

    // ถนน
    const rt = roadTexture(th);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), new THREE.MeshStandardMaterial({ map:rt, roughness:th.sprinkles ? .5 : .85, metalness:0 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, .02, -180); road.receiveShadow = true; scene.add(road);
    // ── ของจริงจาก Poly Haven: ท้องฟ้า HDRI + พื้น/ถนน PBR (โหลดเสร็จแล้วสลับเข้าแทน) ──
    let roadScroll = dz => { rt.offset.y += dz / (400 / 6); };
    let env = null;
    setupEnvironment({ THREE, renderer, scene, theme:themeKey(catId), BASE }).then(e => {
      if (!alive) { e.dispose(); return; }
      env = e;
      const keepSky = !!th.stars;                 // อวกาศ: ใช้ท้องฟ้าดาวเดิม (HDRI กลางคืนออกน้ำตาล)
      if (!keepSky && e.hasSky) { scene.remove(sky); clouds.forEach(c => scene.remove(c)); clouds.length = 0; scene.fog.color.copy(e.fogColor); }
      if (keepSky) scene.background = null;
      sunDir.copy(e.sunDir); sun.color.copy(e.sunColor); sun.intensity = e.sunIntensity; hemi.intensity = e.hemiIntensity;
      if (grassMat) grassMat.uniforms.uSun.value.copy(e.sunDir);
      tiles.forEach(m => { m.material = e.groundMaterial; });
      road.material = e.roadMaterial; roadScroll = dz => e.roadScroll(dz);
      if (water) water.material.uniforms.sunDirection.value.copy(e.sunDir);
    }).catch(() => {});
    if (th.sidewalk) for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(2.2, .25, 400), new THREE.MeshStandardMaterial({ color:"#a8b0ba", roughness:.9 })); sw.position.set(s * 5.1, .12, -180); sw.receiveShadow = true; scene.add(sw); }

    // น้ำทะเล (ชายหาด)
    let water = null;
    if (th.water) { water = new Water(new THREE.PlaneGeometry(400, 600), { textureWidth:512, textureHeight:512, waterNormals:waterNormalTexture(), sunDirection:sunDir.clone(), sunColor:0xffffff, waterColor:0x0b84a8, distortionScale:2.4, fog:true });
      water.rotation.x = -Math.PI / 2; water.position.set(206, -.45, -200); scene.add(water); }

    // หญ้าไหวตามลม (instanced + shader)
    let grassMat = null;
    if (th.grass) {
      const N = 9000, blade = new THREE.PlaneGeometry(.09, .6, 1, 4); blade.translate(0, .3, 0);
      const ig = new THREE.InstancedBufferGeometry(); ig.index = blade.index; ig.setAttribute("position", blade.attributes.position); ig.setAttribute("uv", blade.attributes.uv);
      const off = new Float32Array(N * 3), sc = new Float32Array(N), rot = new Float32Array(N), tint = new Float32Array(N);
      for (let i = 0; i < N; i++) { const side = Math.random() < .5 ? -1 : 1; off.set([side * (4.3 + Math.pow(Math.random(), 1.6) * 22), 0, -Math.random() * L], i * 3); sc[i] = .6 + Math.random() * .9; rot[i] = Math.random() * Math.PI; tint[i] = Math.random(); }
      ig.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3)); ig.setAttribute("aSc", new THREE.InstancedBufferAttribute(sc, 1)); ig.setAttribute("aRot", new THREE.InstancedBufferAttribute(rot, 1)); ig.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 1));
      ig.instanceCount = N;
      grassMat = new THREE.ShaderMaterial({ side:THREE.DoubleSide, fog:true,
        uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime:{ value:0 }, uScroll:{ value:0 }, uBase:{ value:new THREE.Color(th.grass[0]) }, uTip:{ value:new THREE.Color(th.grass[1]) }, uSun:{ value:sunDir.clone() } }]),
        vertexShader:`${HEIGHT_GLSL(th)}
          attribute vec3 aOff; attribute float aSc; attribute float aRot; attribute float aTint; uniform float uTime; uniform float uScroll;
          varying float vH; varying float vT; varying vec3 vN;
          #include <fog_pars_vertex>
          void main(){
            vec3 p=position; p.y*=aSc; p.x*=1.0-uv.y*0.85;
            float c=cos(aRot), s=sin(aRot); p=vec3(p.x*c, p.y, p.x*s);
            float wz=mod(aOff.z+uScroll, ${L.toFixed(1)})-${(L - 12).toFixed(1)};
            float bend=sin(uTime*1.8+aOff.x*.25+wz*.18)*.18+sin(uTime*3.1+aOff.x)*.05;
            p.x+=bend*uv.y*uv.y; p.z+=bend*.5*uv.y*uv.y;
            vec3 w=vec3(aOff.x, hgt(aOff.x, wz-uScroll), wz)+p;
            vH=uv.y; vT=aTint; vN=normalize(vec3(bend, 1., .3));
            vec4 mvPosition=viewMatrix*vec4(w,1.);
            gl_Position=projectionMatrix*mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader:`uniform vec3 uBase; uniform vec3 uTip; uniform vec3 uSun; varying float vH; varying float vT; varying vec3 vN;
          #include <fog_pars_fragment>
          void main(){ vec3 c=mix(uBase*.55, uTip, vH); c*=0.85+vT*.3; float l=.65+.35*max(dot(vN,normalize(uSun)),0.); gl_FragColor=vec4(c*l,1.);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }` });
      const grass = new THREE.Mesh(ig, grassMat); grass.frustumCulled = false; scene.add(grass);
    }

    // ของประกอบฉาก
    const extra = { win:th.props.includes("building") ? windowTexture() : null, space:!!th.stars };
    const props = []; const SPAN = 132; let kit = null;
    const placeProp = (pr, i, side, kind) => { const x = side * (th.sidewalk ? 8 + Math.random() * 6 : 6.5 + Math.random() * 9);
      pr.position.set(x, 0, -i * 5.5); pr.rotation.y = pr.userData.faceRoad ? faceRoadRotation(x) : Math.random() * 6; pr.userData.x = x; scene.add(pr); props.push(pr); };
    // ของประกอบฉากจริง (Poly Haven) + ต้นไม้ใบจริง · ระหว่างโหลดยังไม่มีอะไรข้างทาง
    loadPropKit({ THREE, theme:themeKey(catId), BASE, renderer }).then(k => {
      if (!alive) { k.dispose(); return; } kit = k;
      for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; if (th.water && side > 0 && Math.random() < .7) continue;
        const useBuilding = th.sidewalk && Math.random() < .55;
        const kind = useBuilding ? "building" : k.kinds[Math.floor(Math.random() * k.kinds.length)];
        placeProp(useBuilding ? makeProp("building", Math.random(), extra) : k.spawn(kind, Math.random()), i, side, kind); }
    }).catch(() => { for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; const kind = th.props[Math.floor(Math.random() * th.props.length)]; placeProp(makeProp(kind, Math.random(), extra), i, side, kind); } });

    // หิมะตก
    let snow = null;
    if (th.snow) { const n = 1200, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) sp.set([(Math.random() - .5) * 40, Math.random() * 18, -Math.random() * 70 + 8], i * 3);
      const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(sp, 3)); snow = new THREE.Points(g2, new THREE.PointsMaterial({ color:"#ffffff", size:.14, transparent:true, opacity:.95, depthWrite:false, map:glowTexture() })); scene.add(snow); }

    // ── ผู้เล่น ──
    const primary = cssColor("--md-primary");
    const player = new THREE.Group(); scene.add(player);
    const car = th.car ? makeCar(primary) : null; if (car) player.add(car.g);
    const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(.8, 32), new THREE.MeshBasicMaterial({ color:"#000", transparent:true, opacity:.2, depthWrite:false }));
    shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = .04; player.add(shadowBlob);
    const rig = new THREE.Group(); player.add(rig); if (car) { rig.position.set(0, .55, .1); rig.scale.setScalar(.62); }
    const S = { lane:1, x:0, speed:10, scroll:0, score:0, correct:0, total:0, combo:0, basket:[], shake:0, flash:0, t:0, jump:0, jumpRate:2, over:false, started:false, paused:false, ending:false, endT:0, turn:0, elapsed:0, lastSec:-1, stumble:0, inv:0, cur:null };
    let C = null, mixer = null, actions = {}, cur = null, charToken = 0;
    const gltfCache = {};
    const playAct = (name, once) => { const a = actions[name]; if (!a) return;
      if (once) { const back = cur; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.fadeIn(.1).play(); back?.fadeOut(.1); cur = a;
        setTimeout(() => { if (back && !S.over && cur === a) { back.reset().fadeIn(.2).play(); a.fadeOut(.2); cur = back; } }, 750); return; }
      if (a === cur) return; a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(.25).play(); cur?.fadeOut(.25); cur = a; };
    const setChar = async id => {
      const def = CHARS.find(c => c.id === id) || CHARS[0]; const tok = ++charToken;
      while (rig.children.length) rig.remove(rig.children[0]);
      mixer = null; actions = {}; cur = null; C = null;
      if (def.proc) { C = makeProcChar(def.proc, primary); C.def = def; rig.add(C.g); return; }
      setHud(h => ({ ...h, loading:true }));
      try {
        const gltf = gltfCache[def.url] || (gltfCache[def.url] = await new GLTFLoader().loadAsync(BASE + def.url));
        if (tok !== charToken) return;
        const m = gltf.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        if (def.h) { m.scale.setScalar(1); m.position.set(0, 0, 0); m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); const hh = Math.max(.001, b.max.y - b.min.y);
          const k = def.h / hh; m.scale.setScalar(k); m.position.y = -b.min.y * k; }
        else m.scale.setScalar(def.scale);
        rig.add(m); mixer = new THREE.AnimationMixer(m);
        gltf.animations.forEach(a => { actions[a.name] = mixer.clipAction(a); });
        C = { g:m, def, gltf:true };
        playAct(S.started && !S.over ? def.run : def.idle);
      } catch (e) { if (tok === charToken) { C = makeProcChar("cat", primary); C.def = def; rig.add(C.g); } }
      setHud(h => ({ ...h, loading:false }));
    };

    // อนุภาค
    const glow = glowTexture();
    const PN = 700, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = Array.from({ length:PN }, () => new THREE.Vector3()), pLife = new Float32Array(PN);
    for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size:.45, map:glow, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false })); pts.frustumCulled = false; scene.add(pts); let pIdx = 0;
    const burst = (pos, colors, n = 90, power = 9, up = .9) => { for (let k = 0; k < n; k++) { const i = pIdx++ % PN; pPos.set([pos.x, pos.y, pos.z], i * 3); const c = new THREE.Color(colors[k % colors.length]); pCol.set([c.r, c.g, c.b], i * 3);
      pVel[i].set((Math.random() - .5) * power, Math.random() * power * up, (Math.random() - .5) * power); pLife[i] = .9 + Math.random() * .6; } };
    // เส้นความเร็ว
    const SL = 70, slPos = new Float32Array(SL * 6); const slg = new THREE.BufferGeometry(); slg.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
    const sline = new THREE.LineSegments(slg, new THREE.LineBasicMaterial({ color:"#ffffff", transparent:true, opacity:0, fog:false })); sline.frustumCulled = false; scene.add(sline);
    const slSeed = Array.from({ length:SL }, () => ({ x:(Math.random() - .5) * 16, y:Math.random() * 6 + .3, z:-Math.random() * 40 }));

    // ของสะสม = คำศัพท์ในหมวด (โมเดล 3D จริง / การ์ดรูปลอยได้) · สิ่งกีดขวาง = runner/obstacles.js
    const items = [];       // { obj, c, lane, air, word, update }
    const hazards = [];     // { obj, c, lane, tall, flat, hit, fly }
    const flyers = [];      // ของในตะกร้าที่หลุดกระเด็นตอนชน
    const gates = [];       // ประตูคำศัพท์ตามลำดับ (วางแผนล่วงหน้า · สร้าง 3D เมื่อเข้าระยะ)
    const plan = [];        // รายการที่รอเข้าระยะ { c, type, ... } (c = ตำแหน่งบนเส้นทาง · z ในโลก = S.scroll - c)
    const hz = createHazards({ THREE, BASE, theme:themeKey(catId), glow });
    hz.prepare().catch(() => {});
    const archGeo = new THREE.TorusGeometry(6.2, .12, 10, 64, Math.PI), archMat = new THREE.MeshStandardMaterial({ color:"#ffffff", emissive:"#f0abfc", emissiveIntensity:2.4 });

    // bloom
    let composer = null;
    try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), .5, .4, 1.0)); composer.addPass(new OutputPass()); } catch (e) { composer = null; }

    // ── สถานะเกม ──
    setChar(loadChar(charList.current));
    const pool = words.length >= 3 ? words : words.concat(words, words);
    const loader = new THREE.TextureLoader(); const texCache = new Map();
    const texFor = w => new Promise(res => {
      if (texCache.has(w.id)) return res(texCache.get(w.id));
      const url = ui.imageUrl(w); const fb = () => { const t = { tex:emojiTexture(w.emoji), aspect:4 / 3 }; texCache.set(w.id, t); res(t); };
      if (!url) return fb();
      loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const v = { tex:t, aspect:(t.image.width / t.image.height) || 4 / 3 }; texCache.set(w.id, v); res(v); }, undefined, fb);
    });
    const col = createCollectibles({ THREE, BASE, words:pool.filter((w, i, a) => a.findIndex(x => x.id === w.id) === i), texFor, glow });
    col.prepare().catch(() => {});
    const diff = () => Math.min(1, S.elapsed / LEN);                       // 0 → 1 ตลอดเวลาเล่น
    const baseSpeed = () => 10 + 8.5 * Math.pow(diff(), .85);              // เร็วขึ้นทีละนิด 10 → 18.5
    const proj = (pos) => { const v = pos.clone(); v.project(camera); return { x:(v.x + 1) / 2 * 100, y:(1 - v.y) / 2 * 100 }; };
    const pop = (pos, text, kind = "word") => {
      const id = Math.random().toString(36).slice(2); const p = proj(pos);
      setPops(q => [...q.slice(-4), { id, text, kind, x:Math.min(88, Math.max(12, p.x)), y:Math.min(80, Math.max(14, p.y)) }]);
      setTimeout(() => { if (alive) setPops(q => q.filter(r => r.id !== id)); }, 1100);
    };
    const syncHud = (extra = {}) => setHud(h => ({ ...h, score:S.score, correct:S.correct, total:S.total, combo:S.combo, basket:S.basket.slice(), ...extra }));
    let bannerT = 0;
    const banner = (text, ms = 2000) => { clearTimeout(bannerT); setHud(h => ({ ...h, banner:text })); if (ms) bannerT = setTimeout(() => { if (alive) setHud(h => ({ ...h, banner:null })); }, ms); };
    const used = new Set();
    const pickTarget = () => { const cand = pool.filter(w => !used.has(w.id)); if (!cand.length) used.clear(); const arr = cand.length ? cand : pool; const w = arr[Math.floor(Math.random() * arr.length)]; used.add(w.id); return w; };

    // ── วางแผนเส้นทาง: ช่วงละ 1 ประตู · สิ่งกีดขวางอยู่ระหว่างประตู (ไม่ทับประตู ไม่ปิดครบ 3 เลน) · ทุก 5 ประตูมีช่วงพักหายใจ ──
    let cursor = 0, segN = 0;
    const planSegment = pre => {
      const d = diff(); segN += 1;
      const first = segN === 1, breather = segN > 1 && (segN - 1) % 5 === 0;
      const len = first ? 72 : 92 - 26 * d + (breather ? 55 : 0);
      const start = cursor, gateC = cursor + len; cursor = gateC;
      const target = pre || pickTarget();
      const others = pool.filter(w => w.id !== target.id).sort(() => Math.random() - .5).slice(0, 2);
      const set = [target, ...others].sort(() => Math.random() - .5);
      const row = { c:gateC, target, set, texP:Promise.all(set.map(texFor)), g:null, cards:[], hit:false, active:false, breather, n:segN };
      gates.push(row); plan.push({ c:gateC, type:"gate", row });
      // สิ่งกีดขวาง
      const occ = [];
      const a = start + (first ? 30 : 15), b = gateC - 18;
      const want = breather ? 0 : first ? 1 : Math.round(1 + 2.6 * d + Math.random() * .9);
      const n = Math.max(0, Math.min(want, 1 + Math.floor((b - a) / 13)));
      for (let k = 0; k < n; k++) {
        const c = n === 1 ? a + Math.random() * (b - a) : a + (b - a) * k / (n - 1) + (Math.random() - .5) * 3;
        const two = !first && d > .4 && Math.random() < .2 + .4 * d;
        const lanes = [0, 1, 2].sort(() => Math.random() - .5).slice(0, two ? 2 : 1);      // ไม่ปิดครบ 3 เลนเด็ดขาด
        lanes.forEach(l => { const tall = !first && Math.random() < .28 + .2 * d; const kind = hz.pick(Math.random(), { tall }); occ.push({ c, lane:l, tall });
          plan.push({ c, type:"haz", lane:l, kind }); });
      }
      // ของสะสม (หลบเลนที่มีสิ่งกีดขวาง · บางชิ้นลอยเหนือของเตี้ยให้กระโดดเก็บ)
      const nItems = breather ? 9 : first ? 5 : 4;
      const words5 = col.pick(nItems + 2, target.id); let wi = 0;
      for (let k = 0; k < nItems; k++) {
        const c = start + 10 + (gateC - 22 - start) * (k + .5) / nItems;
        let lane = breather ? [1, 0, 1, 2, 1, 0, 1, 2, 1][k % 9] : Math.floor(Math.random() * 3);
        for (let tries = 0; tries < 3 && occ.some(o => o.lane === lane && Math.abs(o.c - c) < 5); tries++) lane = (lane + 1) % 3;
        if (occ.some(o => o.lane === lane && Math.abs(o.c - c) < 5)) continue;
        if (words5[wi]) plan.push({ c, type:"item", lane, w:words5[wi++] });
      }
      occ.filter(o => !o.tall && Math.random() < .45).forEach(o => { if (words5[wi]) plan.push({ c:o.c, type:"item", lane:o.lane, air:true, w:words5[wi++] }); });
    };
    const buildGate = async row => {
      const texs = await row.texP; if (S.over || !alive) return;
      const g = new THREE.Group(); g.position.z = S.scroll - row.c; scene.add(g);
      row.cards = row.set.map((w, i) => { const c = makeCard(texs[i].tex, texs[i].aspect); c.g.position.set(LANES[i], 3.6, 0); c.g.scale.setScalar(.001); g.add(c.g);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color:["#22d3ee","#f0abfc","#fde047"][i], transparent:true, opacity:.55, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); halo.scale.set(4, 5, 1); halo.position.z = -.2; c.g.add(halo);
        return { ...c, halo, w, lane:i }; });
      const arch = new THREE.Mesh(archGeo, archMat); arch.position.set(0, .1, -.5); g.add(arch);
      row.g = g;
    };
    const dropGroup = g => { scene.remove(g); g.traverse(o => { if (o.geometry && o.geometry !== archGeo) o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { if (x !== archMat) x.dispose(); }); }); };
    const spawnEntry = async e => {
      if (e.type === "gate") { buildGate(e.row); return; }
      if (e.type === "haz") { const h = hz.spawn(e.kind); Object.assign(h, { c:e.c, lane:e.lane, hit:false }); h.obj.position.set(LANES[e.lane], 0, S.scroll - e.c); scene.add(h.obj); hazards.push(h); return; }
      if (e.type === "item") { let it; try { it = await col.spawn(e.w); } catch { return; } if (!it || S.over || !alive) return;
        if (e.c - S.scroll < 8) return;   // โหลดช้าจนเลยมาแล้ว
        Object.assign(it, { c:e.c, lane:e.lane, air:!!e.air, ph:Math.random() * 6 }); it.obj.position.set(LANES[e.lane], e.air ? 2.4 : PICK_Y, S.scroll - e.c); scene.add(it.obj); items.push(it); }
    };
    const HORIZON = 108;
    const spawnDue = () => {
      while (cursor - S.scroll < HORIZON + 40) planSegment();
      for (let i = plan.length - 1; i >= 0; i--) { const e = plan[i]; if (e.c - S.scroll > (e.type === "gate" ? HORIZON : HORIZON - 8)) continue; plan.splice(i, 1); spawnEntry(e); }
    };
    // ประตูถัดไปกลายเป็นโจทย์ปัจจุบัน: แสดงคำ + พูดคำ + การ์ดรูปเด้งขึ้น
    const activate = (row, silent) => {
      row.active = true; S.cur = row;
      setHud(h => ({ ...h, target:row.target }));
      if (row.breather) banner("😊 พักหายใจ · เก็บของกัน!", 2400);
      if (!silent) setTimeout(() => { if (alive && !S.over && S.cur === row) ui.say(row.target); }, 650);
    };
    const finish = () => { if (S.over) return; S.over = true; S.paused = false; clearTimeout(bannerT);
      setHud(h => ({ ...h, on:false, paused:false }));
      if (C?.def?.idle) playAct(C.def.idle);
      track.finish(S.correct, S.total, { label:`ถูก ${S.correct}/${S.total} ประตู · 🧺 ${S.basket.length} ชิ้น · คะแนน ${S.score}` }); };
    const timeUp = () => { if (S.ending || S.over) return; S.ending = true; S.endT = S.t; sfx.win(); banner("⏰ หมดเวลา!", 0); setHud(h => ({ ...h, left:0 }));
      setTimeout(() => { if (alive) finish(); }, 2300); };
    const mult = () => S.combo >= 6 ? 3 : S.combo >= 3 ? 2 : 1;
    const stumble = (k = 1) => { S.stumble = Math.max(S.stumble, k); S.inv = 1.1; S.shake = 1; S.flash = 1; if (C?.def?.sad) playAct(C.def.sad, true); };
    const resolveRow = row => {
      row.hit = true; S.cur = null;
      if (!row.g) return;   // ยังโหลดรูปไม่เสร็จ (เกิดยากมาก) → ข้าม ไม่นับ
      S.total += 1;
      const card = row.cards.find(c => c.lane === S.lane);
      const ok = card && card.w.id === row.target.id;
      const wp = new THREE.Vector3(); (card ? card.g : row.g).getWorldPosition(wp);
      if (ok) { S.correct += 1; S.combo += 1; const m = mult(); const pts = PTS.gate * m; S.score += pts;
        S.jump = 1; S.jumpRate = 2; burst(wp, ["#fde047","#f472b6","#22d3ee","#a3e635","#ffffff"], 220, 13); burst(player.position.clone().setY(1), ["#fde047","#ffffff"], 60, 6, 1.4);
        card.g.userData.fly = 1; ui.correct(row.target); if (C?.def?.happy) playAct(C.def.happy, true);
        pop(wp, m > 1 ? `+${pts} 🔥x${m}` : `+${pts}`, "plus"); }
      else { S.combo = 0; S.score = Math.max(0, S.score + PTS.wrong); stumble(.6);
        if (card) { burst(wp, ["#ef4444","#fca5a5","#ffffff"], 90, 8); card.g.userData.fall = 1; } ui.wrong(row.target); pop(wp, `−${-PTS.wrong}`, "minus"); }
      row.cards.forEach(c => { if (c.w.id === row.target.id && c !== card) { c.frame.material.emissive.set("#22c55e"); c.frame.material.emissiveIntensity = 1.2; } });
      syncHud();
    };
    const hitHazard = h => {
      h.hit = true; stumble(1); sfx.bad();
      S.score = Math.max(0, S.score + PTS.hazard);
      const wp = h.obj.position.clone().setY(1.2);
      burst(wp, h.flat ? (h.kind === "mud" ? ["#78350f","#a16207"] : h.kind === "slime" ? ["#a3e635","#d9f99d"] : ["#7dd3fc","#e0f2fe"]) : ["#ef4444","#fca5a5","#ffffff"], 90, 8);
      if (!h.flat) h.fly = { vx:(h.obj.position.x >= S.x ? 1 : -1) * (2.5 + Math.random() * 2), vy:5.5, spin:(Math.random() - .5) * 10 };
      pop(wp, `💥 −${-PTS.hazard}`, "minus");
      const w = S.basket.pop();                                   // ของชิ้นล่าสุดในตะกร้ากระเด็นหลุด
      if (w) { col.spawn(w).then(it => { if (!it || !alive) return; it.obj.position.set(S.x, 1.5, .4); scene.add(it.obj);
        flyers.push({ it, life:1.3, v:new THREE.Vector3((Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 1.5), 7, 2.5) }); }).catch(() => {});
        setTimeout(() => { if (alive) pop(player.position.clone().setY(2.4), `🧺 −${w.word}`, "minus"); }, 180); }
      syncHud();
    };
    const move = d => { if (!S.started || S.over || S.paused) return; const n = Math.max(0, Math.min(2, S.lane + d)); if (n !== S.lane) { S.lane = n; sfx.tap(); } };
    const jump = () => { if (!S.started || S.over || S.paused || S.ending) return; if (S.jump > .2) return;
      S.jump = 1; S.jumpRate = 1.55; sfx.tap(); const j = C?.def?.happy; if (j && /jump/i.test(j)) playAct(j, true); };
    const setPaused = p => { if (!S.started || S.over || S.ending) return; S.paused = p; setHud(h => ({ ...h, paused:p })); };
    api.current = {
      start: () => { if (S.started) return; S.started = true; setHud(h => ({ ...h, on:true, started:true, left:LEN })); if (C?.def?.run) playAct(C.def.run);
        const t0 = pickTarget(); ui.say(t0); planSegment(t0); activate(gates[0], true); spawnDue(); },   // พูดคำแรกตรงใน onClick (iOS)
      left: () => move(-1), right: () => move(1), jump,
      lane: i => { if (!S.started || S.over || S.paused) return; if (i !== S.lane) { S.lane = i; sfx.tap(); } },
      pause: () => setPaused(true), resume: () => setPaused(false), end: () => { if (S.started && !S.over) finish(); },
      setChar: id => { saveChar(id); setChar(id); },
      peek: () => ({ S, items:items.length, hazards:hazards.length, gates:gates.length, models:col.modelCount, char:C?.def?.id }),   // ใช้ทดสอบ
    };
    try { if (typeof window !== "undefined" && window.__R3D_DEBUG) window.__R3D = { S, gates, hazards, items, plan, api:api.current }; } catch { /* ignore */ }
    let sx = null, sy = null; const dn = e => { sx = e.clientX; sy = e.clientY; };
    const up = e => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (dy < -28 && Math.abs(dy) > Math.abs(dx)) jump();
      else if (Math.abs(dx) > 24) move(dx > 0 ? 1 : -1);
      else { const r = renderer.domElement.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; if (fx < .36) move(-1); else if (fx > .64) move(1); else jump(); }
      sx = sy = null; };
    renderer.domElement.addEventListener("pointerdown", dn); renderer.domElement.addEventListener("pointerup", up);
    const key = e => { if (e.key === "ArrowLeft" || e.key === "a") move(-1); if (e.key === "ArrowRight" || e.key === "d") move(1);
      if (e.key === "ArrowUp" || e.key === " " || e.key === "w") { if (S.started && !S.over) e.preventDefault?.(); jump(); } };
    window.addEventListener("keydown", key);
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); composer?.setSize(W(), H()); }); ro.observe(el);

    // ── ลูปหลัก ──
    let raf = 0, last = performance.now();
    const tick = now => {
      if (!alive) return; raf = requestAnimationFrame(tick);
      const dt = Math.max(0, Math.min(MAX_DT, (now - last) / 1000)); last = now; S.t += dt;
      const active = S.started && !S.over;                 // อยู่ในเกม (รวมตอนพัก/ตอนหมดเวลา)
      const running = active && !S.paused;
      if (running && !S.ending) { S.elapsed += dt; const left = LEN - S.elapsed; const sec = Math.ceil(Math.max(0, left));
        if (sec !== S.lastSec) { S.lastSec = sec; setHud(h => ({ ...h, left })); }
        if (left <= 0) timeUp(); }
      if (running) { S.stumble = Math.max(0, S.stumble - dt * .9); S.inv = Math.max(0, S.inv - dt); }
      const endK = S.ending ? Math.max(0, 1 - (S.t - S.endT) / 1.3) : 1;
      S.speed = baseSpeed() * (1 - .62 * S.stumble) * endK;
      const v = running ? S.speed : 0; const dz = v * dt; S.scroll += dz;
      if (running && !S.ending) spawnDue();
      const sMod = S.scroll % L;
      tiles.forEach(m => { m.position.z = sMod - m.userData.i * L; });
      roadScroll(dz);
      if (grassMat) { grassMat.uniforms.uTime.value = S.t; grassMat.uniforms.uScroll.value = sMod; }
      if (water) water.material.uniforms.time.value += dt * .6;
      props.forEach(p => { p.position.z += dz; if (p.position.z > 14) p.position.z -= SPAN; p.position.y = th.hills ? hgt(p.userData.x, p.position.z - S.scroll) - .1 : 0; });
      clouds.forEach(o => { o.position.x += dt * o.userData.v; if (o.position.x > 260) o.position.x = -260; });

      // ผู้เล่น: ก่อนเริ่มหันหน้าหากล้อง · ระหว่างวิ่งหันหลังให้กล้อง
      S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 11);
      player.position.x = S.x; player.rotation.z = (S.x - LANES[S.lane]) * .18;
      const want = active ? Math.PI : Math.sin(S.t * .6) * .45;
      S.turn += (want - S.turn) * Math.min(1, dt * 4); rig.rotation.y = S.turn;
      if (!S.paused) S.jump = Math.max(0, S.jump - dt * (S.jumpRate || 2));
      const hop = S.jump > 0 ? Math.sin((1 - Math.min(1, S.jump)) * Math.PI) * 1.7 : 0;
      if (car) { car.g.position.y = hop + Math.sin(S.t * 30) * .015 * (running ? 1 : 0); car.wheels.forEach(w => { w.rotation.x -= dz * 3.2; }); rig.position.y = .55 + hop; }
      else rig.position.y = hop + (C?.def?.fly ? C.def.fly + Math.sin(S.t * 3) * .12 : 0);
      rig.rotation.x = -Math.sin(Math.min(1, S.stumble) * Math.PI) * .45;                       // สะดุดล้มไปข้างหน้า
      rig.visible = !(S.inv > 0 && S.inv < 1 && Math.floor(S.t * 14) % 2 === 0);                // กะพริบช่วงกันชนซ้ำ
      if (mixer) mixer.update(dt * (running ? (.9 + S.speed / 22) * (C?.def?.runRate || 1) : active ? 0 : 1));
      if (C?.proc) { const w = running ? 13 + S.speed * .3 : 2.5, a = running ? .9 : .08, ph = S.t * w;
        C.legs[0].rotation.x = Math.sin(ph) * a; C.legs[1].rotation.x = -Math.sin(ph) * a;
        C.arms[0].rotation.x = -Math.sin(ph) * a * .9; C.arms[1].rotation.x = Math.sin(ph) * a * .9;
        C.body.position.y = running ? Math.abs(Math.sin(ph)) * .14 : Math.sin(S.t * 2) * .03; C.body.rotation.x = running ? .12 : 0;
        C.head.rotation.z = Math.sin(ph * .5) * .06; C.head.rotation.x = running ? -.1 : Math.sin(S.t * 1.3) * .05; }
      shadowBlob.scale.setScalar(1 - hop * .25); shadowBlob.material.opacity = .22 - hop * .08;
      if (running && !car && Math.random() < .35) burst(new THREE.Vector3(S.x + (Math.random() - .5) * .4, .1, .3), th.snow ? ["#ffffff"] : th.sprinkles ? ["#fbcfe8","#ffffff"] : ["#d6c4a8","#bfae92"], 1, 1.2, .5);

      // ประตูคำศัพท์ (การ์ดรูปเด้งขึ้นเมื่อเป็นโจทย์ปัจจุบัน)
      for (let gi = gates.length - 1; gi >= 0; gi--) { const r = gates[gi];
        if (r.g) { r.g.position.z = S.scroll - r.c;
          { const k = Math.min(3, Math.max(1, -r.g.position.z / 15)); r.g.scale.setScalar(k); }   // ป้ายไกลขยายให้ดูใหญ่บนจอตั้งแต่แรก แล้วค่อยกลับขนาดจริงเมื่อใกล้
          r.cards.forEach((c, i) => { const ud = c.g.userData;
            if (!ud.fly && !ud.fall) { c.g.position.y = 3.6 + Math.sin(S.t * 2.6 + i) * .12; c.g.rotation.y = Math.sin(S.t * 1.7 + i) * .06;
              const s = c.g.scale.x + ((r.active || r.hit ? 1 : .001) - c.g.scale.x) * Math.min(1, dt * 7); c.g.scale.setScalar(s); }
            c.halo.material.opacity = .4 + Math.sin(S.t * 5 + i) * .15;
            if (ud.fly) { c.g.position.y += dt * 10; c.g.rotation.y += dt * 14; c.g.scale.multiplyScalar(1 - dt * 1.3); }
            if (ud.fall) { c.g.rotation.x -= dt * 5; c.g.position.y -= dt * 5; } }); }
        if (!r.hit && running && r.c - S.scroll < .6) resolveRow(r);
        if (r.hit && S.scroll - r.c > 14) { if (r.g) dropGroup(r.g); gates.splice(gi, 1); } }
      if (active && !S.ending) { const nx = gates.find(r => !r.hit); if (nx && !nx.active) activate(nx); }
      // สิ่งกีดขวาง: ของเตี้ยกระโดดข้ามได้ · ของสูงต้องเปลี่ยนเลน
      for (let i = hazards.length - 1; i >= 0; i--) { const h = hazards[i], o = h.obj;
        const pz = o.position.z; o.position.z = S.scroll - h.c; h.update(dt, S.t);
        if (h.fly) { h.fly.vy -= 16 * dt; o.position.x += h.fly.vx * dt; o.position.y = Math.max(-3, o.position.y + h.fly.vy * dt); o.rotation.z += h.fly.spin * dt; o.rotation.x += dt * 4; }
        if (!h.hit && !h.cleared && running && !S.ending && pz < .75 && o.position.z > -.75 && Math.abs(LANES[h.lane] - S.x) < 1.05) {
          if (!h.tall && hop > (h.flat ? .28 : .55)) { h.cleared = true; burst(o.position.clone().setY(1), ["#fde047","#ffffff"], 24, 4, 1.2); }
          else if (S.inv <= 0) hitHazard(h); }
        if (o.position.z > 10) { scene.remove(o); hz.release(h); hazards.splice(i, 1); } }
      // ของสะสม
      for (let i = items.length - 1; i >= 0; i--) { const it = items[i], o = it.obj; const pz = o.position.z; o.position.z = S.scroll - it.c;
        if (it.popT != null) { it.popT += dt; const k = it.popT / .28; o.scale.setScalar(1 + k * .9); o.position.y += dt * 3; if (k >= 1) { scene.remove(o); col.release(it); items.splice(i, 1); } continue; }
        it.update(dt, S.t); o.position.y = (it.air ? 2.4 : PICK_Y) + Math.sin(S.t * 3 + it.ph) * .12;
        if (running && pz < .9 && o.position.z > -.9 && Math.abs(o.position.x - S.x) < 1 && (it.air ? hop > .7 : hop < 1.2)) {
          it.popT = 0; burst(o.position, ["#fde047","#f472b6","#22d3ee","#ffffff"], 45, 6, 1.1); sfx.coin(); pop(o.position.clone().setY(o.position.y + .6), it.word.word);
          S.basket.push(it.word); S.score += PTS.item; syncHud(); }
        else if (o.position.z > 9) { scene.remove(o); col.release(it); items.splice(i, 1); } }
      // ของที่หลุดจากตะกร้า
      for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i], o = f.it.obj; f.life -= dt; f.v.y -= 14 * dt; o.position.addScaledVector(f.v, dt); o.rotation.z += dt * 6; f.it.update?.(dt, S.t);
        if (f.life < .35) o.scale.multiplyScalar(Math.max(0, 1 - dt * 5));
        if (f.life <= 0) { scene.remove(o); col.release(f.it); flyers.splice(i, 1); } }
      // อนุภาค
      for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; const q = pVel[i]; q.y -= 13 * dt; pPos[i * 3] += q.x * dt; pPos[i * 3 + 1] = Math.max(.05, pPos[i * 3 + 1] + q.y * dt); pPos[i * 3 + 2] += q.z * dt + dz; if (pLife[i] <= 0) pPos[i * 3 + 1] = -999; }
      pg.attributes.position.needsUpdate = true;
      const sp = Math.max(0, (v - 13) / 12); sline.material.opacity = sp * .45;
      slSeed.forEach((s, i) => { s.z += dz * 2.4; if (s.z > 7) s.z = -40; slPos.set([s.x, s.y, s.z, s.x, s.y, s.z - 1.2 - sp * 3.5], i * 6); }); slg.attributes.position.needsUpdate = true;
      if (snow) { const a = snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * 1.8; a[i] += Math.sin(S.t + i) * dt * .3; a[i + 2] += dz * .7; if (a[i + 1] < 0) a[i + 1] = 18; if (a[i + 2] > 9) a[i + 2] = -62; } snow.geometry.attributes.position.needsUpdate = true; }
      // กล้อง
      if (!S.paused) S.shake = Math.max(0, S.shake - dt * 2.5); const sh = S.paused ? 0 : S.shake * .4;
      const camZ = active ? 7.5 : 4.4, camY = active ? 4.3 : 2.1;
      camera.position.x += (S.x * .55 - camera.position.x) * Math.min(1, dt * 5) + (Math.random() - .5) * sh;
      camera.position.y += (camY + hop * .25 - camera.position.y) * Math.min(1, dt * 4) + (Math.random() - .5) * sh;
      camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 3);
      camera.fov = 60 + sp * 12; camera.updateProjectionMatrix();
      camera.lookAt(S.x * .7, active ? 1.7 : 1.45, active ? -12 : -2);
      sun.position.copy(sunDir).multiplyScalar(40).add(new THREE.Vector3(S.x, 0, -6)); sun.target.position.set(S.x, 0, -6);
      if (!S.paused) S.flash = Math.max(0, S.flash - dt * 2); (el.parentElement || el).style.setProperty("--flash", S.flash.toFixed(2));
      if (composer) composer.render(); else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; S.over = true; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("keydown", key); clearTimeout(bannerT);
      try { if (window.__R3D?.S === S) delete window.__R3D; } catch (_) { /* ignore */ }
      renderer.domElement.removeEventListener("pointerdown", dn); renderer.domElement.removeEventListener("pointerup", up);
      scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
      env?.dispose?.(); kit?.dispose?.(); col.dispose(); hz.dispose(); archGeo.dispose(); archMat.dispose(); pmrem.dispose(); composer?.dispose?.(); renderer.dispose(); renderer.domElement.remove(); };
  }, []); // eslint-disable-line

  const tk = ui.tokens;
  const btn = { minWidth:72, minHeight:64, borderRadius:32, border:"none", background:tk.card, color:tk.ink, fontSize:30, fontWeight:900, cursor:"pointer", boxShadow:tk.shadow, fontFamily:"inherit" };
  const meaningOf = c => (words.find(w => (w.word || "").toUpperCase() === c.word) || {}).meaning || c.name;
  const pickChar = c => { setCharId(c.id); api.current.setChar?.(c.id); if (c.word) ui.say({ word:c.word, meaning:meaningOf(c) }); else sfx.tap(); };
  const icon = w => { const u = ui.imageUrl(w); return u ? <img src={u} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:18, lineHeight:1 }}>{w.emoji || "⭐"}</span>; };
  const shadowTxt = "0 2px 6px rgba(0,0,0,.6)";
  const pill = { display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:999, background:"rgba(0,0,0,.42)", color:"#fff", fontWeight:900, textShadow:shadowTxt, whiteSpace:"nowrap" };
  const combo = hud.combo >= 6 ? 3 : hud.combo >= 3 ? 2 : 1;
  const lowTime = hud.left <= 30;
  const playing = hud.started;   // หลังกดเริ่ม (รวมหลังจบ จนกว่า App จะเปิดหน้าผล)
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:8 }}>
      <style>{`@keyframes r3dPop{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}15%{transform:translate(-50%,-60%) scale(1.15);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-260%) scale(1);opacity:0}}
        @keyframes r3dBump{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}
        @keyframes r3dBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        @keyframes r3dBanner{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}20%{transform:translate(-50%,-50%) scale(1.12);opacity:1}30%{transform:translate(-50%,-50%) scale(1)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
      {hud.target && hud.on && <Prompt w={hud.target} onClick={() => ui.say(hud.target)} />}
      <div style={{ position:"relative", height:playing ? "min(760px, max(60vh, calc(100dvh - 280px)))" : "min(66vh, 620px)", borderRadius:28, overflow:"hidden", background:"#000" }}>
        <div ref={host} data-runner3d style={{ position:"absolute", inset:0 }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 55%, rgba(0,0,0,.28))" }} />
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(circle, transparent 40%, rgba(239,68,68,.75))", opacity:"var(--flash, 0)" }} />
        {hud.on && <div data-r3d-hud style={{ position:"absolute", left:8, top:8, right:8, display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"start", gap:6, pointerEvents:"none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:4 }}>
            <span data-r3d-score style={{ ...pill, fontSize:20 }}>⭐ {hud.score}</span>
            <span style={{ ...pill, fontSize:13, padding:"2px 10px" }}>✅ {hud.correct}/{hud.total}{combo > 1 && <span key={hud.combo} style={{ marginLeft:4, animation:"r3dBump .35s ease-out" }}>🔥x{combo}</span>}</span>
          </div>
          <span data-r3d-timer aria-label="เวลาที่เหลือ" style={{ ...pill, fontSize:28, padding:"4px 16px", fontVariantNumeric:"tabular-nums", animation:lowTime && hud.left > 0 ? "r3dBeat 1s ease-in-out infinite" : "none",
            background:lowTime ? "rgba(185,28,28,.72)" : pill.background }}>⏱ {fmtTime(hud.left)}</span>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button data-r3d-pause aria-label="พัก / จบเกม" onClick={() => api.current.pause?.()} className="m3-press"
              style={{ pointerEvents:"auto", width:48, height:48, borderRadius:24, border:"2px solid rgba(255,255,255,.7)", background:"rgba(0,0,0,.42)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:0 }}>
              <span style={{ width:5, height:17, borderRadius:2, background:"#fff" }} /><span style={{ width:5, height:17, borderRadius:2, background:"#fff" }} /></button>
          </div>
        </div>}
        {pops.map(p => <div key={p.id} style={{ position:"absolute", left:`${p.x}%`, top:`${p.y}%`, pointerEvents:"none", animation:"r3dPop 1.05s ease-out forwards",
          padding:"4px 12px", borderRadius:999, background:p.kind === "plus" ? tk.primary : tk.card, color:p.kind === "plus" ? tk.onPrimary : tk.ink, fontWeight:900, fontSize:p.kind === "word" ? 20 : 24, letterSpacing:.5,
          boxShadow:"0 4px 14px rgba(0,0,0,.35)", whiteSpace:"nowrap", border:p.kind === "minus" ? "3px solid rgba(239,68,68,.9)" : "none" }}>{p.text}</div>)}
        {hud.banner && <div key={hud.banner} data-r3d-banner style={{ position:"absolute", left:"50%", top:"46%", pointerEvents:"none", animation:"r3dBanner .6s ease-out forwards", padding:"10px 22px", borderRadius:28,
          background:tk.card, color:tk.ink, boxShadow:"0 8px 28px rgba(0,0,0,.4)", fontWeight:900, fontSize:hud.banner.length > 14 ? 22 : 36, whiteSpace:"nowrap", textAlign:"center" }}>{hud.banner}</div>}
        {playing && <div key={hud.basket.length} style={{ position:"absolute", left:10, bottom:10, display:"flex", alignItems:"center", gap:4, padding:"4px 8px 4px 6px", borderRadius:999,
          background:"rgba(0,0,0,.38)", pointerEvents:"none", animation:hud.basket.length ? "r3dBump .35s ease-out" : "none" }}>
          <span style={{ fontSize:24, lineHeight:1 }}>🧺</span>
          <span style={{ fontWeight:900, fontSize:18, color:"#fff", textShadow:shadowTxt, minWidth:16 }}>{hud.basket.length}</span>
          {hud.basket.slice(-4).map((w, i) => <span key={i} style={{ width:28, height:28, borderRadius:14, overflow:"hidden", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff" }}>{icon(w)}</span>)}
        </div>}
        {hud.paused && <div data-r3d-paused style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.55)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:16 }}>
          <div style={{ fontWeight:900, fontSize:28, color:"#fff", textShadow:shadowTxt }}>พักก่อน</div>
          <div style={{ fontWeight:800, fontSize:15, color:"#fff", textShadow:shadowTxt }}>⏱ เหลือ {fmtTime(hud.left)} · ⭐ {hud.score}</div>
          <button onClick={() => api.current.resume?.()} className="m3-press" style={{ ...btn, minWidth:220, fontSize:22, background:tk.primary, color:tk.onPrimary }}>▶ เล่นต่อ</button>
          <button onClick={() => api.current.end?.()} className="m3-press" style={{ ...btn, minWidth:220, fontSize:20 }}>🏁 จบเกม</button>
        </div>}
        {!playing && <>
          <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", pointerEvents:"none", padding:"0 10px" }}>
            <div style={{ fontWeight:900, fontSize:26, color:"#fff", textShadow:"0 3px 12px rgba(0,0,0,.55)" }}>Word Runner 3D</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.7)" }}>{th.name} · ฟังคำ แล้ววิ่งชนรูปที่ถูก · ⏱ {Math.max(1, Math.round(LEN / 60))} นาที</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#fff", textShadow:"0 2px 6px rgba(0,0,0,.7)" }}>⬆ กระโดดข้ามของเตี้ย · ◀▶ หลบของสูง · 🧺 เก็บของ</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"30px 10px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, background:"linear-gradient(180deg, transparent, rgba(0,0,0,.55))" }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#fff" }}>เลือกตัวละคร (แตะเพื่อฟังชื่อ) {hud.loading && "· กำลังโหลด…"}</div>
            <div style={{ display:"flex", gap:5, flexWrap:"nowrap", overflowX:"auto", maxWidth:"100%", padding:"2px 4px", scrollbarWidth:"none" }}>
              {charList.current.map(c => <button key={c.id} onClick={() => pickChar(c)} className="m3-press" aria-label={c.word ? `${c.word} ${meaningOf(c)}` : c.name}
                style={{ flex:"none", width:68, minHeight:64, padding:"4px 2px", borderRadius:18, border:`3px solid ${charId === c.id ? tk.primary : "transparent"}`, background:charId === c.id ? tk.card : "rgba(255,255,255,.78)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, fontFamily:"inherit" }}>
                <span style={{ fontSize:24, lineHeight:1 }}>{c.emoji}</span>
                {c.word && <span style={{ fontSize:10.5, fontWeight:900, color:tk.ink, letterSpacing:.2, lineHeight:1.1 }}>{c.word}</span>}
                <span style={{ fontSize:10, fontWeight:700, color:tk.ink, opacity:c.word ? .75 : 1, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", maxWidth:64, textOverflow:"ellipsis" }}>{c.word ? meaningOf(c) : c.name}</span></button>)}
            </div>
            <button onClick={() => { ui.unlock?.(); api.current.start?.(); }} className="m3-press" style={{ ...btn, minWidth:200, fontSize:22, background:tk.primary, color:tk.onPrimary }}>▶ เริ่มวิ่ง!</button>
          </div>
        </>}
        {hud.msg && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900 }}>{hud.msg}</div>}
      </div>
      {playing && <div style={{ display:"grid", gridTemplateColumns:"1fr 1.3fr 1fr", gap:8 }}>
        <button aria-label="ซ้าย" onClick={() => api.current.left?.()} className="m3-press" style={btn}>◀</button>
        <button aria-label="กระโดด" data-r3d-jump onClick={() => api.current.jump?.()} className="m3-press" style={{ ...btn, background:tk.primary, color:tk.onPrimary, fontSize:22 }}>⬆ กระโดด</button>
        <button aria-label="ขวา" onClick={() => api.current.right?.()} className="m3-press" style={btn}>▶</button>
      </div>}
    </div>
  );
}
