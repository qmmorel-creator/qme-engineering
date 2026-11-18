// Ajoute la musique QME à une vidéo existante sans réencoder l'image (Reel déjà rendu, rattrapage).
// Raccourci vers le moteur vidéo unique `docs/videos/rendu.mjs` (mêmes réglages pour toutes les vidéos QME : extrait à
// partir de 20,17 s, fondu d'entrée 0,15 s, de sortie 1,8 s, -14 LUFS, AAC 96 kb/s, 48 kHz stéréo).
// Décision de Quentin du 18/11/2026 : plus aucun Reel ni Short muet. `video.mjs` l'applique déjà d'office.
//
// Usage : node sonoriser.mjs <entrée.mp4> [sortie.mp4]   (sans sortie : le fichier d'entrée est remplacé)
import { fileURLToPath } from 'node:url';
import { ajouterMusique, MUSIQUE } from '../../../videos/rendu.mjs';

export { MUSIQUE };
export const sonoriser = (entree, sortie = entree) => ajouterMusique(entree, sortie);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree) { console.error('Usage : node sonoriser.mjs <entrée.mp4> [sortie.mp4]'); process.exit(1); }
  const { duree, taille } = sonoriser(entree, sortie || entree);
  console.log(`${sortie || entree} : musique ajoutée (${duree.toFixed(1)} s, ${(taille / 1e6).toFixed(2)} Mo)`);
}
