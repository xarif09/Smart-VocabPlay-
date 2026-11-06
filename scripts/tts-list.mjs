// รวบรวมข้อความทั้งหมดที่ต้องการเสียงอ่านจริง (neural TTS) → scripts/tts-list.json
//  ประโยคตัวอย่าง EN/TH ทุกคำ · คำแปลไทยทุกคำ · คำที่ไม่มีไฟล์จาก Commons · บทสนทนาทุกบรรทัด EN/TH · นิทานทุกหน้า EN/TH
//  key = fnv1a(text) (ฟังก์ชันเดียวกับใน App.jsx) → ไฟล์ public/tts/<key>.mp3
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { LEXICON } = await import("../src/lexicon.js");
const { DIALOGUES, STORIES } = await import("../src/content.js");

export const fnv1a = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const norm = s => (s || "").replace(/\s+/g, " ").trim();

// เสียง (Microsoft Edge neural · ฟรี): ผู้บรรยาย EN หญิง · เด็กหญิง (Mina) · ชาย (Tom/คุณครู/พ่อค้า) · ไทย หญิง
const V = { en: "en-US-JennyNeural", enKid: "en-US-AnaNeural", enMan: "en-US-GuyNeural", th: "th-TH-PremwadeeNeural" };
const items = new Map();   // key → { text, voice, lang }
const add = (text, voice, lang) => { const t = norm(text); if (!t) return; const k = fnv1a(t); if (!items.has(k)) items.set(k, { key: k, text: t, voice, lang }); };

// 1) คำศัพท์: ประโยค EN/TH + คำแปลไทย · คำที่ไม่มีเสียงจาก Commons
const app = readFileSync(join(ROOT, "src/App.jsx"), "utf8");
const audioMan = existsSync(join(ROOT, "src/audioManifest.json")) ? JSON.parse(readFileSync(join(ROOT, "src/audioManifest.json"), "utf8")) : {};
const words = [...app.matchAll(/W\("(\w+)","([^"]+)","([^"]*)"/g)].map(m => ({ cat: m[1], word: m[2], meaning: m[3] }));
const { EXTRA_WORDS } = await import("../src/vocabExtra.js");
for (const r of EXTRA_WORDS) words.push({ cat: r[0], word: r[1], meaning: r[2] });   // v3.20 คำเพิ่ม
for (const w of words) {
  const lx = LEXICON[`${w.cat}|${w.word}`];
  if (lx?.sen) add(lx.sen, V.en, "en");
  if (lx?.senTh) add(lx.senTh, V.th, "th");
  if (w.meaning) add(w.meaning, V.th, "th");
  const lw = w.word.toLowerCase(); const parts = lw.split(/[\s-]+/);
  const hasCommons = audioMan[lw] || (parts.length > 1 && parts.every(p => audioMan[p]));
  if (!hasCommons) add(w.word.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), V.en, "en");   // "Police Car" อ่านเป็นคำ
}
// 2) บทสนทนา: A/B ใช้เสียงต่างกัน (เด็กหญิง vs ผู้ชาย) ตามชื่อตัวละคร
const kidNames = /mina|emma|girl|student|child/i;
for (const d of DIALOGUES) for (const l of d.lines) {
  const who = l.who === "A" ? d.a : d.b;
  add(l.en, kidNames.test(who || "") ? V.enKid : (/tom|boy/i.test(who || "") ? V.enKid : V.enMan), "en");
  add(l.th, V.th, "th");
}
// 2b) ผู้ช่วยเสียงไทยในเกม (GUIDE) + แนะนำครั้งแรก + ประโยคนำทางที่เป็น literal
const guide = app.match(/const GUIDE = \{([\s\S]*?)\};/); if (guide) for (const m of guide[1].matchAll(/:"([^"]+)"/g)) add(m[1], V.th, "th");
const onb = app.match(/const ONBOARD_STEPS = \[([\s\S]*?)\];/); if (onb) for (const m of onb[1].matchAll(/th:"([^"]+)"/g)) add(m[1], V.th, "th");
for (const m of app.matchAll(/speakTh\("([^"]+)"\)/g)) add(m[1], V.th, "th");
// 3) นิทาน
for (const s of STORIES) for (const p of s.pages) { add(p.en, V.en, "en"); add(p.th, V.th, "th"); }

const list = [...items.values()];
writeFileSync(join(ROOT, "scripts/tts-list.json"), JSON.stringify(list));
const by = {}; list.forEach(i => { by[i.voice] = (by[i.voice] || 0) + 1; });
console.log(`ข้อความทั้งหมด ${list.length} รายการ`, by);
