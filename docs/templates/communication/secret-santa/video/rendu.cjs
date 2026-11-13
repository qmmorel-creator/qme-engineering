const { chromium } = require('playwright');
const [dir, w, h, fps, duree] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const err = []; p.on('pageerror', (e) => err.push(e.message));
  await p.goto('file://' + dir + '/scene.html'); await p.evaluate(() => document.fonts.ready);
  const n = Math.round(+fps * +duree);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => rendre(t), i / +fps);
    await p.screenshot({ path: `${dir}/images/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log('images', n, 'erreurs', err.length);
  await b.close();
})();
