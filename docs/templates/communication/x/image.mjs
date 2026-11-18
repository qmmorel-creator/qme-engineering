// node docs/templates/communication/x/image.mjs production/X-nn.html → production/X-nn.png (1600 × 900, format paysage
// du fil X). Page statique (pas d'animation) : polices et images chargées avant la capture.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(ici, process.argv[2] || 'production/gabarit-image.html');
const sortie = source.replace(/\.html$/, '.png');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await p.goto('file://' + source);
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
await p.screenshot({ path: sortie, type: 'png' });
await b.close();
console.log(path.relative(process.cwd(), sortie));
