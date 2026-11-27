// IG-224 · Carreau, épisode 1 : captures réelles de la démo Mon Budget (templates/budget, ?demo&reinit).
// L'horloge du navigateur est fixée au 14/12/2026 (date de publication) : la démo, datée « d'aujourd'hui », montre
// alors décembre 2026. Geste réel : saisie de trois dépenses « Fêtes de fin d'année » par la modale « Dépense ».
// Tous les chiffres repris par la page animée sont LUS ici dans l'application et écrits dans chiffres.json.
// Usage, serveur des templates lancé (npm run dev:templates) :
//   node docs/templates/communication/formats-test/IG-224/captures/captures.mjs docs/templates/communication/formats-test/IG-224/captures
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const [, , dossier] = process.argv;
export const DEPENSES = [
  ['160', 'Cadeaux des enfants'],
  ['135', 'Cadeaux de la famille'],
  ['39', 'Sapin et décoration'],
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-12-14T10:00:00'));
await p.goto('http://localhost:8888/templates/budget/?demo&reinit');
await p.waitForTimeout(2500);
for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close());
const masque = await p.addStyleTag({ content: '.bandeau-demo,.qme-bandeau,nav.onglets{display:none!important}' });
await p.waitForTimeout(800);
for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close());
const lireEnv = () => p.$eval('li.env:has(button.env-tete[data-id="cadeaux"])', (e) => e.innerText.replace(/\s+/g, ' ').trim());
await p.$eval('.onglet[data-vue="enveloppes"]', (e) => e.click());
await p.waitForTimeout(600);
const avant = await lireEnv();
console.log('AVANT', avant);
// Saisie réelle des trois dépenses.
for (const [montant, libelle] of DEPENSES) {
  await p.$eval('.onglet[data-vue="mois"]', (e) => e.click());
  await p.waitForTimeout(400);
  for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close());
  await p.click('.vue-tete [data-action="operation"][data-type="depense"]');
  await p.waitForSelector('#modale input[name="montant"]');
  await p.fill('#modale input[name="montant"]', montant);
  await p.selectOption('#modale select[name="categorie"]', 'cadeaux');
  await p.waitForTimeout(150);
  await p.selectOption('#modale select[name="sous"]', { label: "Fêtes de fin d'année" });
  await p.fill('#modale input[name="libelle"]', libelle);
  await p.click('#modale button[value="ok"]');
  await p.waitForTimeout(500);
}
for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close());
// Lecture des chiffres après saisie, dans l'état calculé par l'application.
const etat = await p.evaluate(() => window.__budget.etat());
const env = await p.$eval('li.env:has(button.env-tete[data-id="cadeaux"])', (e) => e.innerText).catch(() => null);
await p.$eval('.onglet[data-vue="mois"]', (e) => e.click());
await p.waitForTimeout(600);
await p.evaluate(() => window.scrollTo(0, 0));
const entete = await p.$eval('.entete-mois', (e) => e.innerText.replace(/\s+/g, ' ').trim());
console.log('ENTETE', entete);
await p.waitForTimeout(6000); // le message « Dépense ajoutée » s'efface
await p.screenshot({ path: `${dossier}/bdg-mois.png`, clip: { x: 0, y: 84, width: 430, height: 530 } });
// Enveloppe « Cadeaux et fêtes » ouverte, centrée.
await p.$eval('.onglet[data-vue="enveloppes"]', (e) => e.click());
await p.waitForTimeout(600);
const apres = await lireEnv();
console.log('APRES', apres);
const li = await p.$('li.env:has(button.env-tete[data-id="cadeaux"])');
await li.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
const r = await li.boundingBox();
await p.screenshot({ path: `${dossier}/bdg-cadeaux.png`, clip: { x: 0, y: Math.max(0, r.y - 8), width: 430, height: r.height - 40 } });
const decembre = etat.operations.filter((o) => o.date.startsWith('2026-12') && o.categorieId === 'cadeaux');
writeFileSync(`${dossier}/chiffres.json`, JSON.stringify({ date: '2026-12-14', avant, apres, entete, decembre: decembre.map((o) => [o.date, o.libelle, o.montant / 100]) }, null, 2));
await masque.evaluate((x) => x.remove());
await b.close();
