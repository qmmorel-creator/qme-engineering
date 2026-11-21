// node outils/templates/vignettes.mjs → assets/vignettes/<slug>.webp + attribut data-vignette des cartes de templates/index.html
// Vignettes du catalogue (20/11/2026) : une petite capture par template, affichée sur chaque outil quand on ouvre un
// thème de /templates/ (assets/site.js). Source : la capture déjà choisie pour chaque template dans
// outils/x/templates-en.json (_captures), la même que la page /en/english-version/. Recadrage 16:10 depuis le haut à
// gauche (là où sont le titre et les chiffres), 480 × 300 px, WebP. Rendu par le Chromium de Playwright (canvas),
// sans autre dépendance. À relancer après l'ajout d'un template ou le changement de sa capture choisie.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LARG = 480, HAUT = 300, QUALITE = 0.8;
const captures = JSON.parse(fs.readFileSync(path.join(racine, 'outils/x/templates-en.json'), 'utf8'))._captures;
const fichierCatalogue = path.join(racine, 'templates/index.html');
let catalogue = fs.readFileSync(fichierCatalogue, 'utf8');

// Chaque carte du catalogue doit avoir sa capture choisie, et inversement.
const slugs = [...catalogue.matchAll(/<li class="carte[^"]*" data-slug="([^"]+)"/g)].map((m) => m[1]);
const sansCapture = slugs.filter((s) => !captures[s]);
if (sansCapture.length) throw new Error(`Capture à choisir dans outils/x/templates-en.json (_captures) pour : ${sansCapture.join(', ')}`);

// Playwright est installé globalement dans les sessions (moteur vidéo) : résolu depuis le module global si besoin.
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.NODE_PATH || '/usr/lib/node_modules', 'playwright')); }

const dossier = path.join(racine, 'assets/vignettes');
fs.mkdirSync(dossier, { recursive: true });
const navigateur = await playwright.chromium.launch();
const page = await navigateur.newPage();
let ecrites = 0;
for (const slug of slugs) {
  const source = path.join(racine, 'assets', captures[slug]);
  if (!fs.existsSync(source)) throw new Error(`Capture absente : assets/${captures[slug]}`);
  const donnees = 'data:image/webp;base64,' + fs.readFileSync(source).toString('base64');
  const base64 = await page.evaluate(async ({ donnees, LARG, HAUT, QUALITE }) => {
    const img = new Image(); img.src = donnees; await img.decode();
    const echelle = Math.max(LARG / img.naturalWidth, HAUT / img.naturalHeight);
    const c = document.createElement('canvas'); c.width = LARG; c.height = HAUT;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, LARG / echelle, HAUT / echelle, 0, 0, LARG, HAUT);
    return c.toDataURL('image/webp', QUALITE).split(',')[1];
  }, { donnees, LARG, HAUT, QUALITE });
  const octets = Buffer.from(base64, 'base64');
  const cible = path.join(dossier, `${slug}.webp`);
  if (!fs.existsSync(cible) || !octets.equals(fs.readFileSync(cible))) { fs.writeFileSync(cible, octets); ecrites++; }
  // Adresse versionnée par le contenu : le cache du navigateur suit tout changement de capture.
  const adresse = `/assets/vignettes/${slug}.webp?v=${crypto.createHash('sha1').update(octets).digest('hex').slice(0, 8)}`;
  catalogue = catalogue.replace(new RegExp(`(<li class="carte[^"]*" data-slug="${slug}")( data-vignette="[^"]*")?`), `$1 data-vignette="${adresse}"`);
}
await navigateur.close();

// Vignettes orphelines (template retiré du catalogue) : supprimées.
for (const f of fs.readdirSync(dossier)) if (f.endsWith('.webp') && !slugs.includes(f.slice(0, -5))) fs.rmSync(path.join(dossier, f));
fs.writeFileSync(fichierCatalogue, catalogue);
const total = fs.readdirSync(dossier).reduce((t, f) => t + fs.statSync(path.join(dossier, f)).size, 0);
console.log(`${slugs.length} vignettes (${ecrites} écrite(s)), ${Math.round(total / 1024)} Ko au total, moyenne ${Math.round(total / slugs.length / 1024)} Ko`);
