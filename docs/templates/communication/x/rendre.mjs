// node docs/templates/communication/x/rendre.mjs
// → png/banniere-x.png (1500 × 500, à importer sur X), png/banniere-x-zone-sure.png (contrôle, ne pas importer)
// → assets/x-english-version.png (1200 × 630, image de partage de /en/english-version/)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const rendre = async (source, largeur, hauteur, sortie, guide) => {
  const p = await b.newPage({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(ici, source));
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
  await p.screenshot({ path: sortie, type: 'png' });
  if (guide) { await p.evaluate(() => document.body.classList.add('guide')); await p.screenshot({ path: guide, type: 'png' }); }
  await p.close();
};
await rendre('banniere.html', 1500, 500, path.join(ici, 'png/banniere-x.png'), path.join(ici, 'png/banniere-x-zone-sure.png'));
await rendre('partage.html', 1200, 630, path.join(ici, '../../../../assets/x-english-version.png'));
await b.close();
