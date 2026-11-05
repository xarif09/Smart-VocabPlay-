// วัดขนาดรูปคำศัพท์จริงบนจอมือถือ ทุกหน้า/ทุกเกม → ฟ้องหน้าที่รูปหลักเล็ก (ต้องเปิด preview ก่อน)
// ใช้: node scripts/img-size-audit.cjs [width] [height]   (ค่าเริ่มต้น 390×844)
// เกณฑ์ (ข้อแบบ 4 รูป 4:3 นับเป็นตัวเลือก: กว้าง ≥26% และไม่แบนกว่า 0.6) (แข่ง 2 คน: ฝั่งละ 4 รูปตัวเลือก → แต่ละรูปกว้าง ≥26% สูง ≥13%): เกม/การ์ดแบบรูปเดียว → รูปหลักสูง ≥ 30% ของจอ · แบบหลายรูป (ตัวเลือก/ตาราง) → แต่ละรูปกว้าง ≥ 26% ของจอ
const { chromium } = require('playwright');
const URL = 'http://localhost:4173/Smart-VocabPlay-/';
const VW = +process.argv[2] || 390, VH = +process.argv[3] || 844;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: VW, height: VH } });
  await p.addInitScript(() => {
    try { localStorage.setItem('smart-vocabplay:onboarded', '1'); localStorage.setItem('smart-vocabplay:gate', '0'); } catch (e) {}
    HTMLMediaElement.prototype.play = function () { setTimeout(() => this.dispatchEvent(new Event('ended')), 50); return Promise.resolve(); };
    speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(), 50);
  });
  const rows = [];
  const measure = async (name, kind) => {
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight * 1.5; };
      const els = [...document.querySelectorAll('img[alt], svg[viewBox="0 0 160 110"], [data-emoji-box]')].filter(vis)
        .filter(e => !e.closest('nav') && !e.closest('[data-thumb]'));
      return els.map(e => { const q = e.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; });
    });
    const n = r.length; const maxH = Math.max(0, ...r.map(x => x[1])); const maxW = Math.max(0, ...r.map(x => x[0]));
    const minW = n ? Math.min(...r.map(x => x[0])) : 0; const minH = n ? Math.min(...r.map(x => x[1])) : 0;
    let ok = true, why = '';
    if (!n) { ok = false; why = 'ไม่พบรูป'; }
    else if (kind === 'single' && maxH < VH * 0.30 && !(n >= 3 && minW >= VW * 0.26 && minH >= minW * 0.6)) { ok = false; why = `รูปหลักสูง ${maxH}px < ${Math.round(VH * 0.30)}`; }
    else if (kind === 'half' && maxH < VH * 0.22 && !(n >= 6 && minW >= VW * 0.26 && minH >= VH * 0.13)) { ok = false; why = `รูปต่อฝั่งสูง ${maxH}px < ${Math.round(VH * 0.22)}`; }
    else if (kind === 'multi' && minW < VW * 0.26) { ok = false; why = `รูปตัวเลือกกว้าง ${minW}px < ${Math.round(VW * 0.26)}`; }
    rows.push({ name, kind, n, max: `${maxW}×${maxH}`, min: `${minW}×${minH}`, ok, why });
  };
  const home = async () => { await p.goto(URL); await p.click('text=แตะเพื่อเริ่มเลย'); await p.waitForTimeout(300); await p.click('text=มิว').catch(() => {}); await p.waitForTimeout(400); };
  const cat = async c => { await home(); await p.locator('button', { hasText: c }).first().click(); await p.waitForTimeout(300); };
  const game = async (c, g, kind, pre) => { try { await cat(c); await p.locator('button', { hasText: g }).first().click({ timeout: 4000 }); await p.waitForTimeout(400); if (pre) await pre(); await measure(`${c} · ${g}`, kind); } catch (e) { rows.push({ name: `${c} · ${g}`, kind, n: 0, max: '-', min: '-', ok: false, why: 'เปิดไม่ได้: ' + e.message.split('\n')[0].slice(0, 60) }); } };
  const startBtn = async () => { await p.click('text=▶ เริ่ม!').catch(() => {}); await p.waitForTimeout(1500); };
  const flip2 = async () => { const c = p.locator('div[style*="grid"] > button'); await c.nth(0).click().catch(() => {}); await p.waitForTimeout(900); };
  const listen = async () => { await p.locator('button:has-text("🔊")').nth(1).click({ force: true }).catch(() => {}); };
  try { await cat('Animals'); await p.click('text=เรียนคำศัพท์ก่อนเล่น'); await measure('การ์ดเรียน (หน้า)', 'single'); await p.click('text=แตะการ์ดเพื่อพลิกดูความหมาย').catch(() => {}); await measure('การ์ดเรียน (หลัง)', 'single'); } catch (e) {}
  await game('Animals', 'Quiz', 'multi');
  await game('Animals', 'Spelling', 'single');
  await game('Animals', 'Memory', 'multi', flip2);
  await game('Animals', 'Habitat Hunt', 'multi');
  await game('Animals', 'Listen', 'multi', listen);
  await game('Animals', 'Sentence', 'single');
  await game('Animals', 'Speak', 'single');
  await game('Animals', 'Whack-a-Mole', 'multi', startBtn);
  await game('Animals', 'Balloon Pop', 'multi', startBtn);
  await game('Animals', 'Word Ninja', 'multi', startBtn);
  await game('Animals', 'Bingo', 'multi', startBtn);
  await game('Fruits', 'Feed the Pet', 'multi');
  await game('Animals', 'Word Runner 3D', 'info');
  await game('Vehicles', 'Word Racer 3D', 'info');
  await game('Actions', 'Who Is Doing It?', 'info');   // ฉาก 3D (รูปเป็น texture บนป้าย ไม่ใช่ <img>)
  await game('Fruits', 'Speed', 'multi', startBtn);
  await game('Colors', 'Picture Match', 'multi');
  await game('Colors', 'Color Mix', 'single');
  await game('Body', 'Body Doctor', 'multi');
  await game('Weather', 'Dress Up', 'single');
  await game('Numbers', 'Count Quest', 'multi');
  const hub = async (tab, item, kind, after) => { const name = `${tab} · ${item}`; try { await home(); await p.click(`nav >> text=${tab}`); await p.waitForTimeout(300); await p.locator('button', { hasText: item }).first().click({ timeout: 4000 }); await p.waitForTimeout(400); if (after) await after(); await measure(name, kind); } catch (e) { rows.push({ name, kind, n: 0, max: '-', min: '-', ok: false, why: 'เปิดไม่ได้: ' + e.message.split('\n')[0].slice(0, 60) }); } };
  await hub('เรียน', 'บทสนทนา', 'multi');
  await hub('เรียน', 'บทสนทนา', 'single', async () => { await p.click('text=Hello!'); });
  await hub('เรียน', 'บทสนทนา', 'multi', async () => { await p.click('text=Hello!'); await p.click('text=เติมคำ').catch(() => {}); await p.waitForTimeout(300); });
  await hub('เรียน', 'นิทานภาพ', 'multi');
  await hub('เรียน', 'นิทานภาพ', 'single', async () => { await p.click('text=The Little Cat'); });
  await hub('เรียน', 'โฟนิกส์', 'multi');
  await hub('เรียน', 'โฟนิกส์', 'single', async () => { await p.click('text=เกมเสียงแรก'); await p.waitForTimeout(400); await listen(); });
  await hub('เรียน', 'ไวยากรณ์', 'multi', async () => { await p.click('text=a / an'); });
  for (const g of ['a / an', 'am / is / are', 'in / on / under']) for (let k = 0; k < 3; k++) await hub('เรียน', 'ไวยากรณ์', 'single', async () => { await p.click(`text=${g}`); await p.click('text=ฝึกทำ'); for (let j = 0; j < k; j++) { await p.locator('div[style*="display: grid"] > button').first().click().catch(() => {}); await p.waitForTimeout(1500); } });
  for (let k = 0; k < 6; k++) await hub('เล่น', 'สอบวัดระดับ', 'single', async () => { await p.click('text=เริ่มสอบ'); for (let j = 0; j < k; j++) { await p.locator('button:has-text("🔊")').nth(1).click({ force: true }).catch(() => {}); await p.waitForTimeout(150); await p.locator('div[style*="display: grid"] > button').first().click().catch(() => {}); await p.waitForTimeout(1400); } });
  await hub('เล่น', 'แข่ง 2 คน', 'half', async () => { await p.click('text=เริ่มแข่ง'); });
  await hub('ของฉัน', 'สมุดสติกเกอร์', 'info');
  await hub('ของฉัน', 'จัดการคำศัพท์', 'info');
  console.log(`\nขนาดรูปบนจอ ${VW}×${VH}`);
  for (const r of rows) console.log(`${r.ok ? '✅' : r.kind === 'info' ? 'ℹ️' : '❌'} ${r.name.padEnd(34)} ${String(r.n).padStart(2)} รูป · ใหญ่สุด ${r.max} · เล็กสุด ${r.min} ${r.why}`);
  const bad = rows.filter(r => !r.ok && r.kind !== 'info');
  console.log(bad.length ? `\n❌ รูปเล็ก/หาไม่เจอ ${bad.length} หน้า` : '\n✅ ทุกหน้ารูปใหญ่ตามเกณฑ์');
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
