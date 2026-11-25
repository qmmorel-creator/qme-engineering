// IG-218 · F4 « Le test en 1 minute » : captures réelles de /diagnostic/ en mode téléphone (390 px, dpr 3),
// réponses fictives saisies au clavier, résultat lu dans la page (et écrit dans captures/resultat.json).
// Usage : node docs/templates/communication/formats-test/IG-218/captures.mjs [url de base, défaut http://127.0.0.1:8897]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const ICI = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:8897';
const R = { petits: '25', abonnements: '15', revenu: '1800', minutes: '20', recherches: '8', minutesPapier: '15', habitude: 'sport', objectif: '3', reel: '1' };

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.route(/goatcounter|gc\.zgo\.at/, (r) => r.abort());
await page.goto(`${BASE}/diagnostic/`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.topbar{display:none!important} *{transition:none!important;animation:none!important}' });
await page.evaluate(() => document.fonts.ready);
const form = page.locator('[data-diag]');
const cap = async (nom, loc = form) => { await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); await loc.screenshot({ path: join(ICI, 'captures', nom) }); };

await page.locator('.diag-sourcil').first().scrollIntoViewIfNeeded();
await page.screenshot({ path: join(ICI, 'captures', '0-titre.png') });
const remplir = async (champs) => { for (const c of champs) { await page.fill(`[name="${c}"]`, ''); await page.type(`[name="${c}"]`, R[c], { delay: 20 }); } };
await remplir(['petits', 'abonnements', 'revenu']); await cap('1-budget.png'); await page.click('[data-suivant]');
await remplir(['minutes']); await cap('2-taches.png'); await page.click('[data-suivant]');
await remplir(['recherches', 'minutesPapier']); await cap('3-papiers.png'); await page.click('[data-suivant]');
await remplir(['habitude', 'objectif', 'reel']); await cap('4-habitudes.png'); await page.click('[data-suivant]');
await page.waitForSelector('[data-resultat]:not([hidden])');
await cap('5-resultat.png', page.locator('[data-resultat]'));
await cap('5-resultat-haut.png', page.locator('.diag-total'));
const lu = await page.evaluate(() => ({
  total: document.querySelector('[data-total]').textContent,
  sous: document.querySelector('[data-total-sous]').textContent,
  lignes: [...document.querySelectorAll('[data-lignes] li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
  calcul: (() => { const r = window.DIAG.calculer({ petits: '25', abonnements: '15', revenu: '1800', minutes: '20', recherches: '8', minutesPapier: '15', habitude: 'sport', objectif: '3', reel: '1' }); return { euros: r.euros, heures: r.heures, seances: r.seances, heuresTravail: r.heuresTravail, synthese: window.DIAG.synthese(r) }; })(),
}));
writeFileSync(join(ICI, 'captures', 'resultat.json'), JSON.stringify({ reponses: R, ...lu }, null, 2));
console.log(JSON.stringify(lu, null, 2));
await nav.close();
