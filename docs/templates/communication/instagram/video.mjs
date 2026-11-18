// Rend une page HTML animée (Reel du soir, motion design) en MP4 1080 × 1920 avec la musique QME.
// Raccourci vers le moteur vidéo unique `docs/videos/rendu.mjs` (décision de Quentin du 18/11/2026 : toute vidéo
// QME passe par ce moteur) : capture image par image en temps virtuel à 30 i/s, encodage en deux passes sous 2,9 Mo,
// musique QME ajoutée APRÈS l'encodage (plus aucun Reel muet).
// Usage : node docs/templates/communication/instagram/video.mjs production/IG-nn.html 25 [couverture_ms]
// Sortie : png/<nom>.mp4 et png/<nom>-couverture.png (image à couverture_ms, 14 500 ms par défaut).
// La page peut exposer window.placer(ms) ; sinon ses animations CSS et JS sont jouées sur l'horloge virtuelle.
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { rendrePage } from '../../../videos/rendu.mjs';

const ici = dirname(fileURLToPath(import.meta.url));
const fichier = process.argv[2] || 'reel-lancement.html';
const duree = Number(process.argv[3] || 15);
const couv = Number(process.argv[4] || 14500);
const nom = basename(fichier, '.html');
mkdirSync(join(ici, 'png'), { recursive: true });
const r = await rendrePage({ page: resolve(ici, fichier), duree, couverture: couv, sortie: join(ici, 'png', `${nom}.mp4`) });
console.log(`png/${nom}.mp4 (${r.images} images, ${(r.taille / 1e6).toFixed(2)} Mo, musique QME) et png/${nom}-couverture.png`);
