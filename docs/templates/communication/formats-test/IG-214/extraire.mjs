// IG-214 · F10 « Satisfaisant » : lit les deux états du planning dans la démo réelle du Planning Gantt
// (http://localhost:8888/templates/gantt/?demo, serveur : npm run dev:templates) avec le moteur de l'application
// (window.REGLES.ordonnancer) : état A tel quel, état B avec la première tâche décalée de 3 jours ouvrés.
// Écrit etats.js, lu par IG-214.html. Usage : node docs/templates/communication/formats-test/IG-214/extraire.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const ICI = dirname(fileURLToPath(import.meta.url));
const PLANNING = 'Lancement du site web';
const DECALAGE = 3; // jours ouvrés

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
await p.goto('http://localhost:8888/templates/gantt/?demo');
await p.waitForTimeout(2000);
const res = await p.evaluate(({ PLANNING, DECALAGE }) => {
  const R = window.REGLES; const E = JSON.parse(localStorage.getItem('qme-gnt-demo'));
  const pl = E.plannings.find((x) => x.nom === PLANNING);
  const cal = R.calendrier({ ouvres: pl.ouvres, alsace: pl.alsace });
  const liste = R.ordreAffichage(pl, E.taches);
  const etat = (taches) => {
    const o = R.ordonnancer(taches, cal, pl.debut);
    return { taches: taches.map((t) => { const r = o.taches.get(t.id); return { debut: r.debut, fin: r.fin, dur: r.dur, critique: r.critique }; }), fin: cal.date(o.fin - 1) };
  };
  const A = etat(liste);
  const premiere = liste[0];
  const nouveauDebut = cal.date(cal.idx(A.taches[0].debut) + DECALAGE);
  const listeB = liste.map((t) => (t.id === premiere.id ? { ...t, debut: nouveauDebut } : t));
  const B = etat(listeB);
  const num = new Map(liste.map((t, i) => [t.id, i]));
  return { planning: pl.nom, couleur: pl.couleur, decalage: DECALAGE, noms: liste.map((t) => t.nom), deps: liste.map((t) => t.deps.map((d) => num.get(d.id))), A, B };
}, { PLANNING, DECALAGE });
await b.close();
writeFileSync(join(ICI, 'etats.js'), '// Généré par extraire.mjs depuis la démo du Planning Gantt (données fictives). Ne pas modifier à la main.\nwindow.ETATS = ' + JSON.stringify(res, null, 1) + ';\n');
for (let i = 0; i < res.noms.length; i++) console.log(res.noms[i].padEnd(36), res.A.taches[i].debut, res.A.taches[i].fin, '→', res.B.taches[i].debut, res.B.taches[i].fin, res.B.taches[i].critique ? 'C' : '');
console.log('fin', res.A.fin, '→', res.B.fin);
