// ดาวน์โหลดรูปหลักของบทความ Wikipedia ตาม src/images.js มาเก็บใน public/img/ (480px)
// + เขียน src/imgManifest.json (title → ไฟล์) และ public/img/credits.json (ผู้สร้าง/สัญญาอนุญาต)
// ใช้: node scripts/fetch-images.mjs [--force]   · รันใน GitHub Actions (.github/workflows/fetch-images.yml) หรือเครื่องที่ต่อเน็ตได้
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "img");
const MANIFEST = join(ROOT, "src", "imgManifest.json");
const CREDITS = join(OUT, "credits.json");
const UA = "SmartVocabPlay/1.5 (https://github.com/xarif09/Smart-VocabPlay-; kids vocabulary app)";
const FORCE = process.argv.includes("--force");
const WIDTH = 480;

mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, "utf8")) : {};
// อ่านชื่อบทความจาก src/images.js ด้วย regex (ไฟล์นั้น import JSON แบบ Vite ซึ่ง Node ตรงๆ ไม่รองรับ)
const srcText = readFileSync(join(ROOT, "src", "images.js"), "utf8");
const titles = [...new Set([...srcText.matchAll(/\["[^"\]]+","([^"]+)"\]/g)].map(m => m[1]))];
console.log(`บทความทั้งหมด ${titles.length} เรื่อง`);
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = (url, type = "json") => fetch(url, { headers: { "User-Agent": UA, Accept: type === "json" ? "application/json" : "*/*" } })
  .then(async r => {
    if (r.status === 429) { await sleep(3000); return get(url, type); }   // โดนจำกัดอัตรา → รอแล้วลองใหม่
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return type === "json" ? r.json() : r.arrayBuffer();
  });
const strip = html => (html || "").replace(/<[^>]+>/g, "").trim();

let ok = 0, skipped = 0, failed = [];
for (const title of titles) {
  if (!FORCE && manifest[title] && existsSync(join(OUT, manifest[title]))) { skipped++; continue; }
  try {
    const j = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    const src = j?.thumbnail?.source;
    if (!src) throw new Error("no lead image");
    // ตัด query (?utm_...) ออก · ลองขอ 480px ก่อน ถ้าเซิร์ฟเวอร์ไม่ให้ (400) ใช้ขนาดที่ API ให้มา (320px)
    const clean = src.split("?")[0];
    const candidates = [clean.replace(/\/(\d+)px-/, `/${WIDTH}px-`), clean].filter((u, i, a) => a.indexOf(u) === i);
    let buf = null, url = clean;
    for (const u of candidates) {
      try { buf = Buffer.from(await get(u, "bin")); url = u; break; } catch (e) { await sleep(300); }
    }
    if (!buf) throw new Error("download failed: " + candidates[0]);
    const ext = /\.png$/i.test(url) ? "png" : /\.gif$/i.test(url) ? "gif" : "jpg";
    const file = `${slug(title)}.${ext}`;
    if (buf.length < 500) throw new Error("tiny file");
    writeFileSync(join(OUT, file), buf);
    manifest[title] = file;
    // เครดิต: ชื่อไฟล์ใน Commons = ส่วนท้าย URL หลัง "px-"
    try {
      const fname = decodeURIComponent(url.split("/").pop().replace(/^\d+px-/, ""));
      const q = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent("File:" + fname)}&prop=imageinfo&iiprop=extmetadata&format=json`);
      const page = Object.values(q?.query?.pages || {})[0];
      const m = page?.imageinfo?.[0]?.extmetadata || {};
      credits[title] = { file, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fname)}`, artist: strip(m.Artist?.value), license: strip(m.LicenseShortName?.value), page: j.content_urls?.desktop?.page };
    } catch (e) { credits[title] = { file, page: j.content_urls?.desktop?.page }; }
    ok++; process.stdout.write(`✓ ${title} → ${file} (${Math.round(buf.length / 1024)}KB)\n`);
  } catch (e) {
    failed.push(`${title}: ${e.message}`); process.stdout.write(`✗ ${title}: ${e.message}\n`);
  }
  await sleep(120);
}
// ลบรูป/รายการของบทความที่ไม่ถูกใช้แล้ว (เปลี่ยนชื่อบทความใน images.js)
const { unlinkSync } = await import("node:fs");
for (const t of Object.keys(manifest)) if (!titles.includes(t)) { try { unlinkSync(join(OUT, manifest[t])); } catch (e) {} delete manifest[t]; delete credits[t]; }
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
writeFileSync(CREDITS, JSON.stringify(credits, null, 1));
console.log(`\nเสร็จ: โหลดใหม่ ${ok} · มีอยู่แล้ว ${skipped} · ล้มเหลว ${failed.length}`);
if (failed.length) console.log(failed.join("\n"));
