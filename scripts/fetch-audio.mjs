// ดาวน์โหลดเสียงอ่านคำศัพท์โดยเจ้าของภาษา (Wikimedia Commons: En-us-<word>.ogg ฯลฯ) → แปลงเป็น mp3 เล็กๆ ใน public/audio/
// + เขียน src/audioManifest.json (คำ → ไฟล์) และ public/audio/credits.json (ที่มา/สัญญาอนุญาต)
// ใช้: node scripts/fetch-audio.mjs [--force]   · ต้องมี ffmpeg · รันใน GitHub Actions (.github/workflows/fetch-audio.yml)
import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio");
const MANIFEST = join(ROOT, "src", "audioManifest.json");
const CREDITS = join(OUT, "credits.json");
const UA = "SmartVocabPlay/2.8 (https://github.com/xarif09/Smart-VocabPlay-; kids vocabulary app)";
const FORCE = process.argv.includes("--force");

mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, "utf8")) : {};
// คำทั้งหมดจาก W("หมวด","คำ") ใน App.jsx (ไม่ซ้ำ ตัวพิมพ์เล็ก)
const app = readFileSync(join(ROOT, "src", "App.jsx"), "utf8");
const words = [...new Set([...app.matchAll(/W\("(\w+)","([^"]+)"/g)].map(m => m[2].toLowerCase()))];
console.log(`คำทั้งหมด ${words.length} คำ`);
const slug = w => w.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, type = "json") => {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: type === "json" ? "application/json" : "*/*" } });
  if (r.status === 429) { await sleep(3000); return get(url, type); }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return type === "json" ? r.json() : r.arrayBuffer();
};
const strip = html => (html || "").replace(/<[^>]+>/g, "").trim();
// ชื่อไฟล์ที่ลอง เรียงตามความนิยม: อเมริกัน → ไม่ระบุสำเนียง → อังกฤษ/ออสเตรเลีย (เว้นวรรคใน Commons ใช้ขีดล่าง)
//  Commons แยกตัวพิมพ์ใหญ่-เล็ก (ยกเว้นอักษรแรกของชื่อไฟล์) → ลองทั้งตัวเล็กและขึ้นต้นตัวใหญ่ (Monday, Thailand, Lego)
const cands = w => {
  const lower = w.replace(/ /g, "_");
  const cap = lower.replace(/(^|_)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const first = lower.charAt(0).toUpperCase() + lower.slice(1);
  const forms = [...new Set([lower, first, cap])];
  const out = [];
  for (const f of forms) out.push(`En-us-${f}.ogg`, `En-${f}.ogg`, `En-uk-${f}.ogg`, `En-au-${f}.ogg`);
  out.push(`En-us-${lower}.oga`, `En-ca-${lower}.ogg`);
  return out;
};

let ok = 0, skipped = 0, failed = [];
const todo = words.filter(w => FORCE || !(manifest[w] && existsSync(join(OUT, manifest[w]))));
skipped = words.length - todo.length;
// ถาม Commons ทีละ 3 คำ (≤ 50 ชื่อไฟล์ต่อคำขอ) ว่าไฟล์ไหนมีจริง + ขอ URL และเครดิต · ลองใหม่ 3 ครั้งถ้า API ล้ม
for (let i = 0; i < todo.length; i += 3) {
  const batch = todo.slice(i, i + 3);
  const titles = [...new Set(batch.flatMap(w => cands(w).map(f => "File:" + f)))].slice(0, 50);
  let pages = {}, okq = false;
  for (let attempt = 0; attempt < 3 && !okq; attempt++) {
    try {
      const q = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join("|"))}&prop=imageinfo&iiprop=url|extmetadata&format=json`);
      for (const p of Object.values(q?.query?.pages || {})) if (p.imageinfo?.[0]?.url) pages[p.title.replace(/^File:/, "").replace(/ /g, "_")] = p.imageinfo[0];
      okq = true;
    } catch (e) { await sleep(1500 * (attempt + 1)); if (attempt === 2) batch.forEach(w => failed.push(`${w}: ${e.message}`)); }
  }
  if (!okq) continue;
  const found = Object.fromEntries(Object.entries(pages).map(([k, v]) => [k.toLowerCase(), v]));
  for (const w of batch) {
    const hit = cands(w).map(f => [f, found[f.toLowerCase()]]).find(x => x[1]);
    if (!hit) { failed.push(`${w}: no audio on Commons`); process.stdout.write(`✗ ${w}\n`); continue; }
    const [fname, info] = hit;
    try {
      const buf = Buffer.from(await get(info.url, "bin"));
      const tmp = join(tmpdir(), `vp-${slug(w)}.${fname.split(".").pop()}`);
      writeFileSync(tmp, buf);
      const file = `${slug(w)}.mp3`;
      // แปลง: โมโน 22.05kHz 48kbps · ตัดความเงียบหัว-ท้าย · ปรับความดังให้ใกล้กัน
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp,
        "-af", "silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,apad=pad_dur=0.08,loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k", join(OUT, file)]);
      try { unlinkSync(tmp); } catch (_) {}
      manifest[w] = file;
      const m = info.extmetadata || {};
      credits[w] = { file, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fname)}`, artist: strip(m.Artist?.value), license: strip(m.LicenseShortName?.value) };
      ok++; process.stdout.write(`✓ ${w} ← ${fname}\n`);
    } catch (e) { failed.push(`${w}: ${e.message}`); process.stdout.write(`✗ ${w}: ${e.message}\n`); }
    await sleep(80);
  }
  await sleep(150);
}
// ลบไฟล์ของคำที่ไม่มีแล้ว
for (const w of Object.keys(manifest)) if (!words.includes(w)) { try { unlinkSync(join(OUT, manifest[w])); } catch (_) {} delete manifest[w]; delete credits[w]; }
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
writeFileSync(CREDITS, JSON.stringify(credits, null, 1));
console.log(`\nเสร็จ: โหลดใหม่ ${ok} · มีอยู่แล้ว ${skipped} · ไม่พบ/ล้มเหลว ${failed.length} · รวมมีเสียง ${Object.keys(manifest).length}/${words.length}`);
if (failed.length) console.log(failed.slice(0, 80).join("\n") + (failed.length > 80 ? `\n… อีก ${failed.length - 80}` : ""));
