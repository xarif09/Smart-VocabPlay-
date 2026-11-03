// รายงานความครบของเนื้อหา (ต้องเปิด preview ก่อน): รูป/ภาพออกแบบ/อีโมจิ · เสียงคนจริง · คำอ่าน/ประโยค · จำนวนบทสนทนา/นิทาน
// ใช้: node scripts/audit.cjs [--json]   · อ่านจากหน้า ?audit=1 ของแอป (ใช้ข้อมูลชุดเดียวกับที่แอปใช้จริง)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:4173/Smart-VocabPlay-/?audit=1'); await p.waitForSelector('#audit');
  const r = JSON.parse(await p.textContent('#audit')); await b.close();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return; }
  const pct = (a, b) => `${a}/${b} (${Math.round(a / b * 100)}%)`;
  console.log(`Smart VocabPlay v${r.version} · คำ ${r.words}`);
  console.log(`ภาพ: รูปถ่าย ${r.photo} · ภาพออกแบบ ${r.concept} · อีโมจิเปล่า ${r.emoji}  → มีภาพ ${pct(r.photo + r.concept, r.words)}`);
  console.log(`เสียงคนจริง: ${pct(r.audio, r.words)} (รวมคำประสมต่อเสียง)`);
  console.log(`คำอ่านไทย: ขาด ${r.noRead.length} · ประโยคตัวอย่าง: ขาด ${r.noSentence.length}`);
  console.log(`บทสนทนา ${r.dialogues} · นิทาน ${r.stories} · ไวยากรณ์ ${r.grammar} · โฟนิกส์ ${r.phonics} · เกม ${r.games}`);
  const cats = Object.entries(r.byCat).filter(([, v]) => v.emoji.length).map(([k, v]) => `${k} ${v.emoji.length}: ${v.emoji.join(' ')}`);
  if (cats.length) console.log(`อีโมจิเปล่าแยกหมวด:\n  ` + cats.join('\n  '));
  if (r.noRead.length) console.log('ไม่มีคำอ่าน: ' + r.noRead.join(' '));
  if (r.noSentence.length) console.log('ไม่มีประโยค: ' + r.noSentence.join(' '));
  const bad = r.emoji > 60 || r.noRead.length || r.noSentence.length;
  console.log(bad ? '⚠️ ยังมีช่องโหว่' : '✅ เนื้อหาครบตามเกณฑ์');
})();
