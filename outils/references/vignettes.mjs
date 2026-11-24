// node outils/references/vignettes.mjs → assets/vignettes/ref-<nom>.webp + src des images de références
// Page Sur mesure (FR /sur-mesure/, EN /en/custom/), simplifiée le 22/11/2026 : les références sont des cartes compactes.
// Chaque <img data-source="/assets/<capture>.webp?v=…"> y affiche une vignette tirée de sa capture d'origine :
// 480 × 300 recadrée depuis le haut à gauche, ou la taille de data-taille="LxH" recadrée au centre (carte de tête).
// Le script réécrit src, width et height (adresse versionnée par le contenu). À relancer après le changement d'une
// capture de référence ou l'ajout d'une référence (copier une carte et changer data-source).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirRendu, empreinte, majReprises } from '../lib/vignette.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = ['sur-mesure/index.html', 'en/custom/index.html'];
const dossier = path.join(racine, 'assets/vignettes');
fs.mkdirSync(dossier, { recursive: true });

const rendu = await ouvrirRendu();
const faites = new Map();
let ecrites = 0;
for (const page of PAGES) {
  const fichier = path.join(racine, page);
  let html = fs.readFileSync(fichier, 'utf8');
  const balises = [...html.matchAll(/<img [^>]*data-source="([^"]+)"[^>]*>/g)];
  if (!balises.length) throw new Error(`${page} : aucune image data-source`);
  for (const [balise, sourceUrl] of balises) {
    const taille = /data-taille="(\d+)x(\d+)"/.exec(balise);
    const [largeur, hauteur] = taille ? [Number(taille[1]), Number(taille[2])] : [480, 300];
    const source = path.join(racine, sourceUrl.split('?')[0]);
    if (!fs.existsSync(source)) throw new Error(`${page} : capture absente ${sourceUrl}`);
    const nom = `ref-${path.basename(source, path.extname(source))}${taille ? `-${largeur}` : ''}.webp`;
    if (!faites.has(nom)) {
      const octets = await rendu.rendre(fs.readFileSync(source), { largeur, hauteur, centre: Boolean(taille), type: source.endsWith('.png') ? 'image/png' : 'image/webp' });
      const cible = path.join(dossier, nom);
      if (!fs.existsSync(cible) || !octets.equals(fs.readFileSync(cible))) { fs.writeFileSync(cible, octets); ecrites++; }
      faites.set(nom, `/assets/vignettes/${nom}?v=${empreinte(octets)}`);
    }
    const nouvelle = balise.replace(/ src="[^"]*"/, ` src="${faites.get(nom)}"`).replace(/ width="\d+"/, ` width="${largeur}"`).replace(/ height="\d+"/, ` height="${hauteur}"`);
    html = html.replace(balise, nouvelle);
  }
  fs.writeFileSync(fichier, html);
}
await rendu.fermer();
majReprises(racine, faites);

// Vignettes de références orphelines (référence retirée) : supprimées.
for (const f of fs.readdirSync(dossier)) if (f.startsWith('ref-') && !faites.has(f)) fs.rmSync(path.join(dossier, f));
const total = [...faites.keys()].reduce((t, f) => t + fs.statSync(path.join(dossier, f)).size, 0);
console.log(`${faites.size} vignettes de références (${ecrites} écrite(s)), ${Math.round(total / 1024)} Ko au total`);
