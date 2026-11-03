const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'public', 'icons');
const html = (size, pad) => `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#F43F5E,#F97316);border-radius:${pad?0:size*0.22}px"><span style="font-size:${size*(pad?0.42:0.56)}px;line-height:1;font-family:'Noto Color Emoji','Apple Color Emoji',sans-serif">📚</span></div></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true]]) {
    await p.setViewportSize({ width: size, height: size }); await p.setContent(html(size, pad));
    await p.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
  }
  await b.close(); console.log('icons ok');
})();
