// ตรวจเนื้อหา content.js: blank อยู่ในประโยค · pic key มีจริง · คำตอบอยู่ในตัวเลือก · คำใน PHONICS มีจริง
import { readFileSync } from "node:fs";
import { DIALOGUES, STORIES, GRAMMAR, PHONICS } from "../src/content.js";
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const keys = new Set([...app.matchAll(/W\("(\w+)","([^"]+)"/g)].map(m => `${m[1]}|${m[2]}`));
const bad = [];
DIALOGUES.forEach(d => { if (!keys.has(d.scene)) bad.push(`dialog ${d.id} scene ${d.scene}`); d.lines.forEach(l => { if (l.blank && !new RegExp(`\\b${l.blank}\\b`).test(l.en)) bad.push(`dialog ${d.id} blank "${l.blank}" not in "${l.en}"`); }); if (d.lines.filter(l => l.blank).length < 3) bad.push(`dialog ${d.id} <3 blanks`); });
STORIES.forEach(s => { s.pages.forEach((p, i) => { if (p.pic.includes("|") && !keys.has(p.pic)) bad.push(`story ${s.id} p${i+1} pic ${p.pic}`); }); s.quiz.forEach(q => { if (!q.options.includes(q.answer)) bad.push(`story ${s.id} quiz answer`); }); });
GRAMMAR.forEach(g => { g.rules.forEach(r => { if (!keys.has(r.pic)) bad.push(`grammar ${g.id} pic ${r.pic}`); }); g.practice.forEach(p => { if (!p.options.includes(p.answer) || !p.q.includes("___")) bad.push(`grammar ${g.id} q "${p.q}"`); }); });
PHONICS.forEach(p => p.words.forEach(k => { const parts = k.split("|"); if (parts.length === 2 && !keys.has(k)) bad.push(`phonics ${p.L} ${k}`); if (parts.length === 2 && !parts[1].startsWith(p.L)) bad.push(`phonics ${p.L} ${k} ไม่ได้ขึ้นต้นด้วย ${p.L}`); }));
console.log(`dialogues ${DIALOGUES.length} · stories ${STORIES.length} · grammar ${GRAMMAR.length} · phonics ${PHONICS.length}`);
if (bad.length) { console.log("❌\n" + bad.join("\n")); process.exit(1); } console.log("✅ content ok");
