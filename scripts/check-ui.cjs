// ตรวจ UI อัตโนมัติ: ต้องเปิด `npm run preview` ก่อน แล้ว `node scripts/check-ui.cjs`
// ถ่ายภาพมือถือ 375x812 + จอคอม · ตรวจปุ่มซ้อน/เล็กกว่า 44px · นับคำ · localStorage · ระบบรางวัล
const { chromium } = require('playwright');
const URL = 'http://localhost:4173/Smart-VocabPlay-/';
const OUT = require('path').join(__dirname, '..', 'docs', 'screenshots');
const START = 'text=แตะเพื่อเริ่มเลย';
// ด่านผู้ปกครอง (โจทย์คูณ) → อ่านโจทย์แล้วกดแป้นตัวเลข
const solveGate = async p => { if (!(await p.isVisible('text=ผู้ปกครองเท่านั้น'))) return; const t = await p.textContent('body'); const m = t.match(/(\d+)\s*×\s*(\d+)\s*=/); if (!m) return; for (const d of String(+m[1] * +m[2])) await p.click(`button[data-key="${d}"]`); await p.waitForTimeout(400); };
const skipOnboard = async p => { if (await p.isVisible('text=เริ่มใช้งาน')) { await p.click('button:has-text("ถัดไป")').catch(()=>{}); await p.click('button:has-text("ถัดไป")').catch(()=>{}); await p.click('button:has-text("เริ่มใช้งาน")'); await p.waitForTimeout(300); } else if (await p.isVisible('text=เรียนคำศัพท์ก่อน') && await p.isVisible('button:has-text("ข้าม")')) { await p.click('button:has-text("ข้าม")'); await p.waitForTimeout(300); } };

async function audit(page, label) {
  // รอให้แอนิเมชันเลื่อนเข้า (Reveal/stagger) จบก่อนวัด
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming?.().iterations !== Infinity).map(a => a.finished.catch(() => {})))).catch(() => {});
  return page.evaluate((label) => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    // เมื่อมี overlay เต็มจอ (ResultScreen/แผ่นตั้งค่า) วัดเฉพาะปุ่มใน overlay นั้น ไม่นับปุ่มที่ถูกบังอยู่ข้างใต้
    const overlay = [...document.querySelectorAll('div')].reverse().find(d => { const st = getComputedStyle(d); return st.position === 'fixed' && st.zIndex && +st.zIndex >= 200 && d.getBoundingClientRect().width >= innerWidth * 0.9 && d.getBoundingClientRect().height >= innerHeight * 0.9; });
    const root = overlay || document;
    const els = [...root.querySelectorAll('button,input,select')].filter(vis);
    const fixed = e => !!e.closest('[style*="position: fixed"]');
    const ov = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a) || fixed(a) !== fixed(b)) continue;
      const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
      const x = Math.min(r.right, s.right) - Math.max(r.left, s.left), y = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
      if (x > 1 && y > 1) ov.push((a.innerText || a.tagName).slice(0, 15) + ' × ' + (b.innerText || b.tagName).slice(0, 15));
    }
    const small = els.filter(e => e.tagName === 'BUTTON' && e.getBoundingClientRect().height < 44).map(e => (e.innerText || '?').trim().slice(0, 12) + ':' + Math.round(e.getBoundingClientRect().height));
    return { label, hScroll: document.documentElement.scrollWidth > window.innerWidth, overlaps: ov, smallBtns: [...new Set(small)].slice(0, 10) };
  }, label);
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });

(async () => {
  const b = await chromium.launch(); const res = []; let fail = 0;
  const bad = (l, v) => { fail++; res.push({ FAIL: l, v }); };
  for (const [name, vp] of [['mobile', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    const a = async (l) => { const r = await audit(p, name + ' ' + l); res.push(r); if (r.hScroll || r.overlaps.length || r.smallBtns.length) bad(name + ' ' + l, r); };
    await p.goto(URL); await shot(p, `${name}-0-start`); await a('start');
    await p.click(START); await p.waitForTimeout(300);
    await shot(p, `${name}-1-home-pick-pet`); await a('home-pick-pet');
    await p.click('text=มิว'); await p.waitForTimeout(400);
    await shot(p, `${name}-1-onboarding`); await a('onboarding'); await skipOnboard(p);
    await shot(p, `${name}-1-home`); await a('home');
    const counts = await p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText).filter(t => /\d+ คำ/.test(t)).map(t => +t.match(/(\d+) คำ/)[1]));
    res.push({ label: name + ' count', cats: counts.length, total: counts.reduce((x, c) => x + c, 0) });
    if (counts.length !== 26 || counts.reduce((x, c) => x + c, 0) !== 1165) bad('count', counts);
    await p.click('text=เรียน'); await p.waitForTimeout(300); await shot(p, `${name}-1b-learnhub`); await a('learnhub');
    await p.click('text=เล่น'); await p.waitForTimeout(300); await shot(p, `${name}-1c-playhub`); await a('playhub');
    await p.click('text=หน้าแรก'); await p.waitForTimeout(300);
    await p.click('text=Animals'); await p.waitForTimeout(300);
    await shot(p, `${name}-2-category`); await a('category');
    // learn mode (flash cards)
    await p.click('text=เรียนคำศัพท์ก่อนเล่น'); await p.waitForTimeout(200);
    await shot(p, `${name}-2a-learn-front`); await a('learn-front');
    res.push({ label: name + ' learn-has-read', ok: await p.locator('span', { hasText: /^[ก-๙]+(-[ก-๙]+)*$/ }).first().isVisible() });
    await p.click('text=แตะการ์ดเพื่อพลิกดูความหมาย'); await p.waitForTimeout(800);
    await shot(p, `${name}-2b-learn-back`); await a('learn-back');
    res.push({ label: name + ' learn-sentence', ok: await p.isVisible('text=/[A-Z][a-z].*\\./') });
    await p.click('button:has-text("รู้แล้ว")'); await p.click('button:has-text("ยังไม่แม่น")'); await p.waitForTimeout(100);
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.waitForTimeout(200);
    // new games
    await p.click('text=Listen'); await p.waitForTimeout(200); await shot(p, `${name}-2c-listen`); await a('listen');
    await p.click('button:has-text("🔊") >> nth=1', { force: true }).catch(()=>{}); await p.waitForTimeout(100);
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('text=Sentence'); await p.waitForTimeout(200); await shot(p, `${name}-2d-sentence`); await a('sentence');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('text=Speak'); await p.waitForTimeout(200); await shot(p, `${name}-2e-speak`); await a('speak');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // boss locked → toast
    await p.click('text=ด่านบอส'); await p.waitForTimeout(150);
    res.push({ label: name + ' boss-locked-toast', ok: await p.isVisible('text=เก็บดาวให้ได้ทุกเกม') });
    // play quiz through 10 questions
    await p.click('text=Quiz'); await p.waitForTimeout(200);
    await shot(p, `${name}-3-game-quiz`); await a('quiz');
    for (let i = 0; i < 10; i++) {
      const btns = p.locator('div[style*="grid-template-columns: 1fr 1fr"] > button');
      await btns.nth(i % 4).click(); await p.waitForTimeout(1100);
    }
    await p.waitForSelector('text=เล่นอีก', { timeout: 20000 }); await p.waitForTimeout(400);
    await shot(p, `${name}-4-result`); await a('result');
    await p.click('text=กลับ ›'); await p.waitForTimeout(200);
    const starsTxt = await p.innerText('text=/⭐ \\d+\\/\\d+/');
    res.push({ label: name + ' stars-after-quiz', starsTxt });
    await p.click('text=Spelling'); await p.waitForTimeout(200); await shot(p, `${name}-5-game-spell`); await a('spell');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=Habitat Hunt'); await p.waitForTimeout(200); await shot(p, `${name}-6-game-habitat`); await a('habitat');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('button:has-text("📒")'); await p.waitForTimeout(200); await shot(p, `${name}-7-stickers`); await a('stickers');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('text=ของฉัน'); await p.waitForTimeout(200); await shot(p, `${name}-7b-me`); await a('me'); await p.click('text=จัดการคำศัพท์'); await p.waitForTimeout(200); await solveGate(p); await p.waitForTimeout(200); await shot(p, `${name}-8-manage`); await a('manage');
    await p.click('text=+ เพิ่มคำ'); await p.waitForTimeout(100); await shot(p, `${name}-9-manage-add`); await a('manage-add');
    await p.click('text=ยกเลิก'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=หน้าแรก');
    await p.click('button[aria-label="ตั้งค่า"]'); await p.waitForTimeout(200); await solveGate(p); await shot(p, `${name}-10-settings`); await a('settings');
    await p.click('text=รายงานผู้ปกครอง'); await p.waitForTimeout(200); await shot(p, `${name}-10a-report`); await a('report');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('text=ร้านค้า'); await p.waitForTimeout(200); await shot(p, `${name}-10b-shop`); await a('shop');
    await p.click('text=พื้นหลัง'); await p.waitForTimeout(100); await a('shop-bg');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    res.push({ label: name + ' missions-card', ok: await p.isVisible('text=ภารกิจวันนี้') });
    // บทสนทนา: ฟัง → เล่นบทบาท (ไม่มีไมค์ → ปุ่มแตะ) → เติมคำ
    await p.click('button:has-text("บทสนทนา")'); await p.waitForTimeout(200); await shot(p, `${name}-13a-talk`); await a('talk');
    await p.click('text=Hello!'); await p.waitForTimeout(300); await shot(p, `${name}-13b-dialog`); await a('dialog-listen');
    await p.click('text=🎭 เล่นบทบาท'); await p.click('button:has-text("Mina")'); await p.waitForTimeout(300); await shot(p, `${name}-13c-roleplay`); await a('roleplay');
    for (let k = 0; k < 8; k++) { if (await p.isVisible('button:has-text("🎤")')) { await p.click('button:has-text("🎤")'); await p.waitForTimeout(150); } await p.locator('button:has-text("ถัดไป ›"), button:has-text("ข้าม ›")').first().click(); await p.waitForTimeout(150); }
    await p.waitForSelector('text=เล่นอีก', { timeout: 20000 }); res.push({ label: name + ' roleplay-finished', ok: true }); await p.click('text=กลับ ›'); await p.waitForTimeout(200);
    await p.click('text=🧩 เติมคำ'); await p.waitForTimeout(300); await shot(p, `${name}-13d-fill`); await a('fill');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // นิทาน: อ่าน → แตะคำ → ถึงหน้าสุดท้าย → ตอบคำถาม
    await p.click('text=นิทานภาพ'); await p.waitForTimeout(300); await shot(p, `${name}-14a-stories`); await a('stories');
    await p.click('text=The Little Cat'); await p.waitForTimeout(400); await shot(p, `${name}-14b-reader`); await a('reader');
    await p.click('button:has-text("cat")').catch(()=>{}); await p.waitForTimeout(200); res.push({ label: name + ' reader-word-popup', ok: await p.isVisible('text=แมว') });
    for (let k = 0; k < 7; k++) await p.click('text=หน้าถัดไป');
    await p.click('text=ตอบคำถามท้ายเรื่อง'); await p.waitForTimeout(300); await shot(p, `${name}-14c-storyquiz`); await a('storyquiz');
    for (let k = 0; k < 3; k++) { await p.locator('div[style*="display: grid"] > button').first().click(); await p.waitForTimeout(1300); }
    await p.waitForSelector('text=เล่นอีก', { timeout: 20000 }); await p.click('text=กลับ ›'); await p.waitForTimeout(200);
    res.push({ label: name + ' story-done-badge', ok: await p.isVisible('text=อ่านแล้ว') });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // โฟนิกส์
    await p.click('text=โฟนิกส์'); await p.waitForTimeout(300); await p.click('button:text-is("B")'); await p.waitForTimeout(200); await shot(p, `${name}-15a-phonics`); await a('phonics');
    await p.click('text=เกมเสียงแรก'); await p.waitForTimeout(300); await p.click('text=ฟัง EN+TH'); await p.waitForTimeout(200); await shot(p, `${name}-15b-phonics-game`); await a('phonics-game');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // learning path: open unit 1 → learn step → flash cards → back marks step
    await p.click('text=เส้นทางบทเรียน'); await p.waitForTimeout(300); await shot(p, `${name}-12a-path`); await a('path');
    await p.click('text=1. เรียนการ์ด'); await p.waitForTimeout(200);
    res.push({ label: name + ' unit-learn-opened', ok: await p.isVisible('text=การ์ดที่ 1/') });
    for (let i = 0; i < 8; i++) { await p.click('button:has-text("รู้แล้ว")'); await p.waitForTimeout(60); }
    await p.waitForTimeout(300);
    res.push({ label: name + ' unit-learn-marked', ok: await p.isVisible('text=✅'), backOnPath: await p.isVisible('text=2. ทำแบบทดสอบ') });
    await p.click('text=2. ทำแบบทดสอบ'); await p.waitForTimeout(200);
    res.push({ label: name + ' unit-quiz', ok: await p.isVisible('text=เลือกคำที่ตรงกับรูป'), title: await p.innerText('text=/บทที่ 1/') });
    await shot(p, `${name}-12b-path-unit`); await a('path-unit');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // ไวยากรณ์: เปิดบท → ฝึก → ตอบ 8 ข้อ
    await p.click('text=ไวยากรณ์'); await p.waitForTimeout(200); await shot(p, `${name}-16a-grammar`); await a('grammar');
    await p.click('text=a / an'); await p.waitForTimeout(200); await shot(p, `${name}-16b-grammar-lesson`); await a('grammar-lesson');
    await p.click('text=ฝึกทำ'); await p.waitForTimeout(300); await shot(p, `${name}-16c-grammar-game`); await a('grammar-game');
    for (let k = 0; k < 8; k++) { await p.locator('div[style*="display: grid"] > button').first().click(); await p.waitForTimeout(1400); }
    await p.waitForSelector('text=เล่นอีก', { timeout: 20000 }); res.push({ label: name + ' grammar-finished', ok: true }); await p.click('text=กลับ ›'); await p.waitForTimeout(200);
    res.push({ label: name + ' grammar-back-to-list', ok: await p.isVisible('text=ไวยากรณ์เด็ก') });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // ชีวิตประจำวัน: 4 แท็บ + เกมเวลา
    await p.click('text=ชีวิตประจำวัน'); await p.waitForTimeout(200); await shot(p, `${name}-17a-daily-time`); await a('daily-time');
    await p.click('text=💰 เงินบาท'); await p.waitForTimeout(150); await a('daily-money');
    await p.click('text=📅 วัน-เดือน'); await p.waitForTimeout(150); await shot(p, `${name}-17b-daily-calendar`); await a('daily-calendar');
    await p.click('text=🔢 ตัวเลข'); await p.waitForTimeout(150); const r = await audit(p, name + ' daily-numbers'); res.push({ ...r, smallBtns: [], note: 'ตาราง 1–100 ตั้งใจให้ปุ่มเล็ก มีปุ่มเลื่อนทีละ 1 แทน' }); if (r.overlaps.length || r.hScroll) bad('daily-numbers', r);
    await p.click('text=🕐 เวลา'); await p.click('button:has-text("เล่นเกม")'); await p.waitForTimeout(300); await shot(p, `${name}-17c-daily-game`); await a('daily-game');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); res.push({ label: name + ' daily-back', ok: await p.isVisible('text=ภาษาอังกฤษในชีวิตประจำวัน') });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // สอบวัดระดับ 20 ข้อ → ใบประกาศ
    await p.click('text=สอบวัดระดับ'); await p.waitForTimeout(200); await shot(p, `${name}-18a-test-intro`); await a('test-intro');
    await p.click('text=เริ่มสอบ'); await p.waitForTimeout(300); await shot(p, `${name}-18b-test`); await a('test');
    for (let k = 0; k < 20; k++) { if (await p.isVisible('text=ฟัง EN+TH')) await p.click('text=ฟัง EN+TH'); await p.waitForTimeout(100); await p.locator('div[style*="display: grid"] > button').first().click(); await p.waitForTimeout(1100); }
    await p.waitForSelector('text=เล่นอีก', { timeout: 20000 }); await p.click('text=กลับ ›'); await p.waitForTimeout(300);
    await shot(p, `${name}-18c-certificate`); await a('certificate'); res.push({ label: name + ' certificate', ok: await p.isVisible('text=ใบประกาศนียบัตร') });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    // แข่ง 2 คน
    await p.click('text=แข่ง 2 คน จอเดียว'); await p.waitForTimeout(200); await a('versus-setup');
    await p.click('text=เริ่มแข่ง'); await p.waitForTimeout(400); await shot(p, `${name}-19-versus`); const rv = await audit(p, name + ' versus'); res.push(rv); if (rv.hScroll) bad('versus', rv);
    await p.click('text=ออก'); await p.waitForTimeout(300);
    // profiles: add second profile → fresh progress → switch back keeps coins
    const coinsBefore = (await p.locator('text=/🪙 \\d+/').first().innerText()).match(/🪙 \d+/)[0];
    await p.click('button:has-text("▾")'); await p.waitForTimeout(200); await shot(p, `${name}-12c-profiles`); await a('profiles');
    await p.click('text=เพิ่มคนใหม่'); await p.fill('input[placeholder^="ชื่อ"]', 'มีนา'); await p.click('text=สร้าง ✓'); await p.waitForTimeout(300);
    res.push({ label: name + ' profile-new', pickerShown: await p.isVisible('text=เลือกเพื่อนคู่หูของมีนา') });
    await p.click('button:has-text("▾")'); await p.click('text=หนู'); await p.waitForTimeout(300);
    res.push({ label: name + ' profile-switch-back', coinsBefore, coinsAfter: (await p.locator('text=/🪙 \\d+/').first().innerText()).match(/🪙 \d+/)[0] });
    // seeded: boss unlocked + review card
    await p.evaluate(() => {
      const k = 'smart-vocabplay:progress:v1'; const d = JSON.parse(localStorage.getItem(k));
      ['quiz', 'spell', 'memory', 'habitat', 'listen', 'sentence'].forEach(g => d.stars['animals:' + g] = 2); d.mistakes = { 1: 2, 2: 1, 3: 1 }; d.coins = 500;
      localStorage.setItem(k, JSON.stringify(d));
    });
    await p.reload(); await p.click(START); await p.waitForTimeout(300);
    await shot(p, `${name}-11-home-review`); await a('home-review');
    res.push({ label: name + ' review-card', ok: await p.isVisible('text=ทบทวนวันนี้') });
    // shop: buy a hat with seeded coins
    await p.click('text=ร้านค้า'); await p.click('text=ซื้อ 🪙 80'); await p.waitForTimeout(200);
    res.push({ label: name + ' shop-buy', wearing: await p.isVisible('text=ใส่อยู่'), coinsLeft: await p.innerText('text=/🪙 \\d+$/') });
    await shot(p, `${name}-11a-shop-bought`); await a('shop-bought');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")');
    await p.click('text=Animals'); await p.waitForTimeout(200); await shot(p, `${name}-12-category-boss-open`); await a('category-boss-open');
    await p.click('text=ด่านบอส'); await p.waitForTimeout(300); await shot(p, `${name}-13-boss`); await a('boss');
    res.push({ label: name + ' boss-screen', ok: await p.isVisible('text=บอส Animals') });
    if (errs.length) bad(name + ' pageerror', errs);
    res.push({ label: name + ' errors', errs });
    await ctx.close();
  }
  // รูปจริง: จำลอง Wikipedia API + รูป (เครื่องทดสอบต่อเน็ตไม่ได้) ดู layout ของรูปในเกม/การ์ด · ปิด SW ไม่งั้น route จำลองไม่โดน
  {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, serviceWorkers: 'block' }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    // สร้างรูป JPEG จำลองคนละสีต่อคำ ด้วย canvas ในหน้าว่าง
    const mk = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 480; c.height = 360; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 480, 360); gr.addColorStop(0, '#60a5fa'); gr.addColorStop(1, '#f472b6'); g.fillStyle = gr; g.fillRect(0, 0, 480, 360); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText('PHOTO', 160, 190); return c.toDataURL('image/jpeg', 0.8); });
    const jpg = Buffer.from(mk.split(',')[1], 'base64');
    await p.route('https://en.wikipedia.org/api/rest_v1/page/summary/**', r => { const t = decodeURIComponent(r.request().url().split('/summary/')[1]); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: t, thumbnail: { source: `https://upload.wikimedia.org/wikipedia/commons/thumb/x/${encodeURIComponent(t)}.jpg/320px-${encodeURIComponent(t)}.jpg` } }) }); });
    await p.route('https://upload.wikimedia.org/**', r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: jpg }));
    await p.goto(URL); await p.click(START); await p.click('text=มิว');
    await p.click('text=Animals'); await p.click('text=Quiz'); await p.waitForTimeout(600);
    await shot(p, 'mobile-pics-1-quiz'); const r1 = await audit(p, 'pics quiz'); res.push(r1); if (r1.overlaps.length || r1.hScroll) bad('pics quiz', r1);
    res.push({ label: 'pics quiz-has-img', ok: (await p.locator('img[alt]').count()) >= 1 });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=เรียนคำศัพท์ก่อนเล่น'); await p.waitForTimeout(600);
    await shot(p, 'mobile-pics-2-card'); const r2 = await audit(p, 'pics card'); res.push(r2); if (r2.overlaps.length || r2.hScroll) bad('pics card', r2);
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=Listen'); await p.waitForTimeout(300); await p.click('button:has-text("🔊") >> nth=1', { force: true }); await p.waitForTimeout(600);
    await shot(p, 'mobile-pics-3-listen'); const r3 = await audit(p, 'pics listen'); res.push(r3); if (r3.overlaps.length || r3.hScroll) bad('pics listen', r3);
    res.push({ label: 'pics listen-imgs', n: await p.locator('img[alt]').count() });
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=Colors'); await p.click('text=Picture Match'); await p.waitForTimeout(400);
    await shot(p, 'mobile-pics-4-match'); const r4 = await audit(p, 'pics match'); res.push(r4); if (r4.overlaps.length || r4.hScroll) bad('pics match', r4);
    // ปิดรูปจริงในตั้งค่า → กลับเป็นอีโมจิ (ออกจากโหมดเกมก่อน เพราะในเกมไม่มีปุ่มตั้งค่า)
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.waitForTimeout(200);
    await p.click('button[aria-label="ตั้งค่า"]'); await p.waitForTimeout(200); await solveGate(p); await shot(p, 'mobile-pics-5-settings-voice');
    await p.locator('text=รูปภาพจริง').locator('xpath=../..').locator('button').click(); await p.click('text=เสร็จสิ้น');
    await p.click('button[aria-label="ย้อนกลับ"], button:has-text("‹")'); await p.click('text=Animals'); await p.click('text=Quiz'); await p.waitForTimeout(300);
    res.push({ label: 'pics toggle-off-no-img', imgs: await p.locator('img[alt]').count(), errs });
    if (errs.length) bad('pics errors', errs);
    await ctx.close();
  }
  // PWA: manifest + sw served, SW registers, offline reload still renders
  const pw = await b.newContext({ viewport: { width: 375, height: 812 } }); const pp = await pw.newPage();
  const man = await pp.request.get(URL + 'manifest.webmanifest'); const swr = await pp.request.get(URL + 'sw.js'); const ico = await pp.request.get(URL + 'icons/icon-192.png');
  await pp.goto(URL); await pp.click(START); await pp.waitForTimeout(500);
  const swReady = await pp.evaluate(async () => { try { const r = await navigator.serviceWorker.ready; return !!r.active; } catch (e) { return 'ERR ' + e.message; } });
  await pp.waitForTimeout(800);
  await pw.setOffline(true);
  let offlineOk = false; try { await pp.reload(); await pp.click(START, { timeout: 5000 }); offlineOk = await pp.isVisible('text=หมวดคำศัพท์'); } catch (e) { offlineOk = 'ERR ' + e.message.slice(0, 60); }
  await pw.setOffline(false);
  res.push({ label: 'pwa', manifest: man.status(), sw: swr.status(), icon: ico.status(), swReady, offlineOk });
  if (man.status() !== 200 || swr.status() !== 200 || swReady !== true || offlineOk !== true) bad('pwa', { man: man.status(), sw: swr.status(), swReady, offlineOk });
  await pw.close();
  // localStorage blocked → still works
  const c4 = await b.newContext(); await c4.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const q = await c4.newPage(); const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(URL); await q.click(START); await q.click('text=มิว'); await q.click('text=Fruits'); await q.click('text=Quiz'); await q.waitForTimeout(300);
  res.push({ label: 'ls-blocked', quizVisible: await q.isVisible('text=เลือกคำที่ตรงกับรูป'), errors: e2 });
  if (e2.length) bad('ls-blocked', e2);
  await b.close();
  console.log(JSON.stringify(res, null, 1));
  console.log(fail ? `\n❌ FAIL ${fail}` : '\n✅ ALL PASS');
  process.exit(fail ? 1 : 0);
})();
