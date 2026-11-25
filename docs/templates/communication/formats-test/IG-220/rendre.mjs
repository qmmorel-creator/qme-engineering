// Rendu des Reels du concours avec une musique imposée (moteur unique docs/videos/rendu.mjs, rien d'autre).
// Usage, depuis la racine du dépôt :
//   node docs/templates/communication/formats-test/IG-220/rendre.mjs <IG-nn> <durée s> <ms couverture> <slug> [fichier musique]
// La page est docs/templates/communication/formats-test/<IG-nn>/<IG-nn>.html, la sortie docs/videos/sortie/<IG-nn>-<slug>.mp4.
// Musique par défaut : product-launch.m4a (120 BPM, la plus rapide et la plus forte de la bibliothèque).
import { rendrePage, MUSIQUES, RACINE } from '../../../../videos/rendu.mjs';
import { join } from 'node:path';
const [id, duree, couv, slug, fichier = 'product-launch.m4a'] = process.argv.slice(2);
const musique = MUSIQUES.find((m) => m.fichier.endsWith(fichier));
if (!musique) throw new Error('Musique inconnue : ' + fichier);
const r = await rendrePage({ page: join(RACINE, 'docs/templates/communication/formats-test', id, id + '.html'), duree: +duree, couverture: +couv,
  sortie: join(RACINE, 'docs/videos/sortie', `${id}-${slug}.mp4`), musique });
console.log(r.sortie, r.images, 'images', (r.taille / 1e6).toFixed(2), 'Mo', fichier);
