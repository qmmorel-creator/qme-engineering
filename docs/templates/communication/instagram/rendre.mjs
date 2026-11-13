// Rend chaque <section class="cadre"> d'un fichier HTML en PNG (taille réelle) dans le dossier png/.
// Usage : node docs/templates/communication/instagram/rendre.mjs [fichier.html]
// Sans argument : gabarits.html (fichiers ig-<id>.png). Sinon : <id>.png.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

// require : trouve aussi le Playwright installé globalement.
const { chromium } = createRequire(import.meta.url)('playwright');
const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, 'png');
mkdirSync(sortie, { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1 });
const fichier = process.argv[2] || 'gabarits.html';
const prefixe = fichier === 'gabarits.html' ? 'ig-' : '';
await page.goto(pathToFileURL(join(ici, fichier)).href);
await page.evaluate(() => document.fonts.ready);
const ids = await page.$$eval('section.cadre', (els) => els.map((e) => e.id));
for (const id of ids) {
  await page.locator('#' + id).screenshot({ path: join(sortie, `${prefixe}${id}.png`) });
  console.log(`${prefixe}${id}.png`);
}
await navigateur.close();
