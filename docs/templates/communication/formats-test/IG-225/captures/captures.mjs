// IG-225 · Carreau, épisode 2 : captures réelles de la démo Suivi des congés et absences (templates/conges, ?demo&reinit).
// Démo du 24/11/2026 (« Menuiserie Exemple », 8 salariés). Aucun geste ne modifie les données : on lit le tableau de
// bord, la demande d'Inès Petit (chevauchement) et le calendrier de décembre de l'équipe Atelier.
// Tous les chiffres repris par la page animée sont LUS ici et écrits dans chiffres.json (contrôlés : échec sinon).
// Usage, serveur des templates lancé (npm run dev:templates) :
//   node docs/templates/communication/formats-test/IG-225/captures/captures.mjs docs/templates/communication/formats-test/IG-225/captures
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const [, , dossier] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:8888/templates/conges/?demo&reinit');
await p.waitForTimeout(3000);
const fermer = async () => { for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close()); };
await fermer();
await p.addStyleTag({ content: '.bandeau-demo,.qme-bandeau,nav.onglets{display:none!important}' });
const vue = async (v) => { await fermer(); await p.$eval(`.onglet[data-vue="${v}"]`, (e) => e.click()); await p.waitForTimeout(700); await p.evaluate(() => window.scrollTo(0, 0)); };
const C = {};

// 1. Tableau de bord : les quatre chiffres du haut, puis la carte de la demande d'Inès Petit.
await vue('tableau');
const tuiles = await p.$$eval('main *', (els) => {
  const t = els.find((e) => /CHEVAUCHE/i.test(e.textContent) && e.children.length === 0);
  let x = t; while (x && x.parentElement && !/DEMANDES À TRAITER/i.test(x.parentElement.innerText)) x = x.parentElement;
  const zone = x.parentElement; const r = zone.getBoundingClientRect();
  return { y: r.top + scrollY, h: r.height, texte: zone.innerText.replace(/\s+/g, ' ') };
});
C.tuiles = tuiles.texte;
await p.screenshot({ path: `${dossier}/cng-tableau.png`, clip: { x: 0, y: tuiles.y - 8, width: 430, height: tuiles.h + 16 }, fullPage: true });
const carte = await p.evaluateHandle(() => [...document.querySelectorAll('main article.carte-demande')].find((e) => /Inès Petit/.test(e.innerText)));
await fermer();
C.ines = await carte.evaluate((e) => e.innerText.replace(/\s+/g, ' '));
await carte.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
await fermer();
const rc = await carte.boundingBox();
await p.screenshot({ path: `${dossier}/cng-ines.png`, clip: { x: 0, y: rc.y - 10, width: 430, height: rc.height + 20 } });

// 2. Équipe Atelier : taille et seuil.
await vue('equipe');
C.atelier = (await p.innerText('main')).match(/Atelier\s*\n?\s*(\d+) salariés · (\d+) absent au plus/).slice(1, 3).map(Number);

// 3. Calendrier de décembre, équipe Atelier, défilé jusqu'au 21.
await vue('calendrier');
await p.click('text=›');
await p.waitForTimeout(500);
await p.selectOption('main select', { label: 'Atelier' }).catch((e) => console.log('filtre', e.message));
await p.waitForTimeout(600);
C.calendrier = (await p.innerText('main')).replace(/\s+/g, ' ');
const tab = await p.evaluateHandle(() => [...document.querySelectorAll('main *')].find((e) => e.scrollWidth > e.clientWidth + 20 && e.querySelector('table')));
await tab.evaluate((e) => {
  const th = [...e.querySelectorAll('th, td')].find((c) => /^\s*L\s*21\s*$/.test(c.innerText));
  e.scrollLeft = th ? th.offsetLeft - e.querySelector('th, td').offsetWidth - 4 : e.scrollWidth;
});
await p.waitForTimeout(300);
// Absents par jour (ligne « Absents » de l'Atelier), lus dans le tableau.
C.absents = await tab.evaluate((e) => {
  const lignes = [...e.querySelectorAll('tr')];
  const tete = lignes.find((l) => /21/.test(l.innerText) && l.querySelectorAll('th,td').length > 25);
  const jours = [...tete.querySelectorAll('th,td')].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
  const abs = lignes.find((l) => /^Absents/.test(l.innerText.trim()));
  const cel = [...abs.querySelectorAll('th,td')];
  return jours.map((j, i) => [j, cel[i]?.innerText.trim(), cel[i]?.className]).filter((x) => /2[0-6]$/.test(x[0]));
});
await tab.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
await fermer();
const rt = await tab.boundingBox();
await p.screenshot({ path: `${dossier}/cng-calendrier.png`, clip: { x: 0, y: rt.y - 6, width: 430, height: rt.height + 12 } });
writeFileSync(`${dossier}/chiffres.json`, JSON.stringify(C, null, 2));
console.log(JSON.stringify(C, null, 2).slice(0, 3000));
// Contrôles : l'histoire racontée par la vidéo doit être celle de la démo.
if (!/4 jours au-delà du seuil/.test(C.ines) || !/Camille Martin du 21 déc\. au 24 déc\./.test(C.ines)) throw new Error('Carte Inès inattendue');
if (C.atelier[0] !== 3 || C.atelier[1] !== 1) throw new Error('Atelier inattendu');
await b.close();
