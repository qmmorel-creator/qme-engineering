const { chromium } = require('playwright');
(async () => {
  const [page, out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + page); await p.evaluate(() => document.fonts.ready);
  for (const t of ts) { await p.evaluate(ms => window.placer(ms), Number(t) * 1000); await p.waitForTimeout(80); await p.screenshot({ path: `${out}/t${t}.png` }); }
  await b.close();
})();
