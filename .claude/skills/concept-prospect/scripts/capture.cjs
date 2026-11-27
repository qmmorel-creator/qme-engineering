// Captures des vues d'une maquette.
// Usage : node capture.cjs <demo.html> <shots.json> <dossier_sortie>
// shots.json : [{ "id": "planning", "view": "planning", "device": "desktop"|"mobile",
//                 "actions": ["js évalué dans la page avant la capture"], "fullPage": false }]
// Sortie : s-<id>.jpg (desktop 1440x900) ou m-<id>.jpg (mobile 390x844), échelle 2.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [demo, shotsFile, outDir] = process.argv.slice(2);
if (!demo || !shotsFile || !outDir) {
  console.error('Usage : node capture.cjs <demo.html> <shots.json> <dossier_sortie>');
  process.exit(1);
}
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const url = 'file://' + path.resolve(demo);
const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

(async () => {
  const browser = await chromium.launch();
  const pages = {};
  for (const shot of shots) {
    const dev = shot.device === 'mobile' ? 'mobile' : 'desktop';
    if (!pages[dev]) {
      const ctx = await browser.newContext(devices[dev]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error(`[${dev}] erreur JS :`, e.message));
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      pages[dev] = page;
    }
    const page = pages[dev];
    await page.evaluate((v) => { location.hash = v; }, shot.view);
    await page.waitForTimeout(250);
    for (const js of shot.actions || []) {
      await page.evaluate(js);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => {
      document.querySelectorAll('[data-hide-in-shot]').forEach((el) => { el.hidden = true; });
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(150);
    const file = path.join(outDir, `${dev === 'mobile' ? 'm' : 's'}-${shot.id}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 84, fullPage: !!shot.fullPage });
    console.log('capture', file);
  }
  await browser.close();
})();
