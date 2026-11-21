// Rend les stories quiz (question et réponse) et l'image d'aperçu du lien /jeu.
// Usage, depuis la racine du dépôt : node docs/templates/communication/jeux/rendre.mjs [--videos]
// Sorties : docs/templates/communication/jeux/png/quiz-<n>-<question|reponse>.png ; assets/diagnostic-partage.png ;
// avec --videos : png/quiz-<n>-<slug>.mp4 (13 s, musique QME, moteur unique docs/videos/rendu.mjs) pour TikTok et Reels.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '../../../..');
const page0 = pathToFileURL(join(ici, 'stories.html')).href;
mkdirSync(join(ici, 'png'), { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(page0);
const nb = await page.evaluate(() => window.QUIZ.length);
for (let n = 1; n <= nb; n += 1) {
  for (const v of ['question', 'reponse']) {
    await page.goto(`${page0}?q=${n}&v=${v}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(ici, 'png', `quiz-${n}-${v}.png`) });
  }
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(`${page0}?partage`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(racine, 'assets/diagnostic-partage.png') });
const quiz = await page.evaluate(() => window.QUIZ.map((q) => ({ slug: q.slug, bonne: q.bonne })));
await navigateur.close();
console.log(`${nb * 2} stories et l'aperçu du lien rendus.`);

if (process.argv.includes('--videos')) {
  const { rendrePage } = await import('../../../videos/rendu.mjs');
  for (const [k, q] of quiz.entries()) {
    if (q.bonne === null) continue; // le sondage n'a pas de vidéo
    const sortie = join(ici, 'png', `quiz-${k + 1}-${q.slug}.mp4`);
    const r = await rendrePage({ page: `${page0}?q=${k + 1}&v=video`, duree: 13, couverture: 1500, sortie });
    console.log(`${r.sortie} : ${(r.taille / 1e6).toFixed(2)} Mo`);
  }
}
