// node docs/templates/communication/youtube/rendre.mjs → png/banniere-youtube.png (2048 × 1152) et un aperçu avec la zone sûre
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// require : trouve aussi le Playwright installé globalement.
const { chromium } = createRequire(import.meta.url)('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2048, height: 1152 }, deviceScaleFactor: 1 });
await p.goto('file://' + path.join(ici, 'banniere.html'));
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: path.join(ici, 'png/banniere-youtube.png'), type: 'png' });
await p.evaluate(() => document.body.classList.add('guide'));
await p.screenshot({ path: path.join(ici, 'png/banniere-youtube-zone-sure.png'), type: 'png' });
await b.close();
