// ตรวจ UI อัตโนมัติ: ต้องเปิด `npm run preview` ก่อน แล้ว `node scripts/check-ui.cjs`
// ถ่ายภาพมือถือ 375x812 + จอคอม · ตรวจปุ่มซ้อน/เล็กกว่า 44px · นับคำ · localStorage · ระบบรางวัล
const { chromium } = require('playwright');
const URL = 'http://localhost:4173/Smart-VocabPlay-/';
const OUT = require('path').join(__dirname, '..', 'docs', 'screenshots');
const START = 'text=แตะเพื่อเริ่มเลย';

async function audit(page, label) {
  return page.evaluate((label) => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll('button,input,select')].filter(vis);
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
    await p.click('text=มิว'); await p.waitForTimeout(200);
    await shot(p, `${name}-1-home`); await a('home');
    const counts = await p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText).filter(t => /\d+ คำ/.test(t)).map(t => +t.match(/(\d+) คำ/)[1]));
    res.push({ label: name + ' count', cats: counts.length, total: counts.reduce((x, c) => x + c, 0) });
    if (counts.length !== 14 || counts.reduce((x, c) => x + c, 0) !== 296) bad('count', counts);
    await p.click('text=Animals'); await p.waitForTimeout(200);
    await shot(p, `${name}-2-category`); await a('category');
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
    await p.waitForSelector('text=เล่นอีก', { timeout: 3000 }); await p.waitForTimeout(400);
    await shot(p, `${name}-4-result`); await a('result');
    await p.click('text=กลับ ›'); await p.waitForTimeout(200);
    const starsTxt = await p.innerText('text=/⭐ \\d+\\/\\d+/');
    res.push({ label: name + ' stars-after-quiz', starsTxt });
    await p.click('text=Spelling'); await p.waitForTimeout(200); await shot(p, `${name}-5-game-spell`); await a('spell');
    await p.click('button:has-text("‹")'); await p.click('text=Habitat Hunt'); await p.waitForTimeout(200); await shot(p, `${name}-6-game-habitat`); await a('habitat');
    await p.click('button:has-text("‹")'); await p.click('button:has-text("‹")');
    await p.click('text=สติกเกอร์'); await p.waitForTimeout(200); await shot(p, `${name}-7-stickers`); await a('stickers');
    await p.click('button:has-text("‹")');
    await p.click('text=จัดการ'); await p.waitForTimeout(200); await shot(p, `${name}-8-manage`); await a('manage');
    await p.click('text=+ เพิ่มคำ'); await p.waitForTimeout(100); await shot(p, `${name}-9-manage-add`); await a('manage-add');
    await p.click('text=ยกเลิก'); await p.click('button:has-text("‹")');
    await p.click('button:has-text("⚙️")'); await p.waitForTimeout(200); await shot(p, `${name}-10-settings`); await a('settings');
    await p.click('text=เสร็จสิ้น');
    // seeded: boss unlocked + review card
    await p.evaluate(() => {
      const k = 'smart-vocabplay:progress:v1'; const d = JSON.parse(localStorage.getItem(k));
      ['quiz', 'spell', 'memory', 'habitat'].forEach(g => d.stars['animals:' + g] = 2); d.mistakes = { 1: 2, 2: 1, 3: 1 };
      localStorage.setItem(k, JSON.stringify(d));
    });
    await p.reload(); await p.click(START); await p.waitForTimeout(300);
    await shot(p, `${name}-11-home-review`); await a('home-review');
    res.push({ label: name + ' review-card', ok: await p.isVisible('text=ทบทวนคำที่พลาด') });
    await p.click('text=Animals'); await p.waitForTimeout(200); await shot(p, `${name}-12-category-boss-open`); await a('category-boss-open');
    await p.click('text=ด่านบอส'); await p.waitForTimeout(300); await shot(p, `${name}-13-boss`); await a('boss');
    res.push({ label: name + ' boss-screen', ok: await p.isVisible('text=บอส Animals') });
    if (errs.length) bad(name + ' pageerror', errs);
    res.push({ label: name + ' errors', errs });
    await ctx.close();
  }
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
