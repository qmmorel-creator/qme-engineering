// node outils/templates/vignettes.mjs → assets/vignettes/<slug>.webp + attribut data-vignette des cartes de templates/index.html
// Vignettes du catalogue (20/11/2026) : une petite capture par template, affichée sur chaque outil quand on ouvre un
// thème de /templates/ (assets/site.js). Source : la capture déjà choisie pour chaque template dans
// outils/x/templates-en.json (_captures), la même que la page /en/english-version/. Recadrage 16:10 depuis le haut à
// gauche (là où sont le titre et les chiffres), 480 × 300 px, WebP. Rendu : outils/lib/vignette.mjs (Chromium de
// Playwright, canvas). À relancer après l'ajout d'un template ou le changement de sa capture choisie.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirRendu, empreinte } from '../lib/vignette.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LARG = 480, HAUT = 300, QUALITE = 0.8;
const captures = JSON.parse(fs.readFileSync(path.join(racine, 'outils/x/templates-en.json'), 'utf8'))._captures;
const fichierCatalogue = path.join(racine, 'templates/index.html');
let catalogue = fs.readFileSync(fichierCatalogue, 'utf8');

// Chaque carte du catalogue doit avoir sa capture choisie, et inversement.
const slugs = [...catalogue.matchAll(/<li class="carte[^"]*" data-slug="([^"]+)"/g)].map((m) => m[1]);
const sansCapture = slugs.filter((s) => !captures[s]);
if (sansCapture.length) throw new Error(`Capture à choisir dans outils/x/templates-en.json (_captures) pour : ${sansCapture.join(', ')}`);

const dossier = path.join(racine, 'assets/vignettes');
fs.mkdirSync(dossier, { recursive: true });
const rendu = await ouvrirRendu();
let ecrites = 0;
for (const slug of slugs) {
  const source = path.join(racine, 'assets', captures[slug]);
  if (!fs.existsSync(source)) throw new Error(`Capture absente : assets/${captures[slug]}`);
  const octets = await rendu.rendre(fs.readFileSync(source), { largeur: LARG, hauteur: HAUT, qualite: QUALITE });
  const cible = path.join(dossier, `${slug}.webp`);
  if (!fs.existsSync(cible) || !octets.equals(fs.readFileSync(cible))) { fs.writeFileSync(cible, octets); ecrites++; }
  // Adresse versionnée par le contenu : le cache du navigateur suit tout changement de capture.
  const adresse = `/assets/vignettes/${slug}.webp?v=${empreinte(octets)}`;
  catalogue = catalogue.replace(new RegExp(`(<li class="carte[^"]*" data-slug="${slug}")( data-vignette="[^"]*")?`), `$1 data-vignette="${adresse}"`);
}
await rendu.fermer();

// Vignettes orphelines (template retiré du catalogue) : supprimées. Les vignettes de références (ref-*) sont gérées
// par outils/references/vignettes.mjs.
for (const f of fs.readdirSync(dossier)) if (f.endsWith('.webp') && !f.startsWith('ref-') && !slugs.includes(f.slice(0, -5))) fs.rmSync(path.join(dossier, f));
fs.writeFileSync(fichierCatalogue, catalogue);
const total = slugs.reduce((t, slug) => t + fs.statSync(path.join(dossier, `${slug}.webp`)).size, 0);
console.log(`${slugs.length} vignettes (${ecrites} écrite(s)), ${Math.round(total / 1024)} Ko au total, moyenne ${Math.round(total / slugs.length / 1024)} Ko`);
