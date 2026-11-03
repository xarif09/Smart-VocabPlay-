// สร้างแผ่นรวมรูปทุกคำ (public/img) เป็น PNG ไว้ตรวจด้วยตาว่ารูปตรงคำไหม → docs/images-sheet-*.png
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imgManifest.json'), 'utf8'));
const src = fs.readFileSync(path.join(ROOT, 'src/images.js'), 'utf8');
const pairs = [...src.matchAll(/add\("(\w+)", \[([\s\S]*?)\]\);/g)].flatMap(m => [...m[2].matchAll(/\["([^"]+)","([^"]+)"\]/g)].map(x => ({ cat: m[1], word: x[1], title: x[2] })));
const PER = 48;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 100 } });
  for (let i = 0; i < pairs.length; i += PER) {
    const chunk = pairs.slice(i, i + PER);
    const cells = chunk.map(w => { const f = manifest[w.title]; const img = f ? `<img src="file://${path.join(ROOT, 'public/img', f)}">` : `<div class="miss">ไม่มีรูป</div>`; return `<div class="c">${img}<b>${w.word}</b><span>${w.cat} · ${w.title}</span></div>`; }).join('');
    await p.setContent(`<style>body{margin:0;font-family:sans-serif;background:#fff}.g{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:8px}.c{text-align:center;font-size:11px}.c img,.miss{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#eee;display:block}.miss{display:flex;align-items:center;justify-content:center;color:#c00}.c b{display:block;font-size:12px;margin-top:2px}.c span{color:#666;font-size:9px}</style><div class="g">${cells}</div>`);
    await p.setViewportSize({ width: 1200, height: Math.ceil(chunk.length / 8) * 160 + 20 });
    await p.screenshot({ path: path.join(ROOT, 'docs', `images-sheet-${String(i / PER + 1).padStart(2, '0')}.png`), fullPage: true });
  }
  await b.close(); console.log('sheets', Math.ceil(pairs.length / PER), 'pairs', pairs.length, 'with image', pairs.filter(w => manifest[w.title]).length);
})();
