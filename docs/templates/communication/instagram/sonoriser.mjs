// Ajoute la musique QME à une vidéo (Reel du soir, motion design) sans réencoder l'image.
// Décision de Quentin du 18/11/2026 : plus aucun Reel ni Short muet.
// Mêmes réglages que le moteur des démos (docs/videos/moteur.mjs) : extrait de la piste à partir de 20,17 s,
// fondu d'entrée 0,15 s, fondu de sortie 1,8 s, normalisation -14 LUFS, AAC 96 kb/s, 48 kHz stéréo.
//
// Usage : node sonoriser.mjs <entrée.mp4> [sortie.mp4]   (sans sortie : le fichier d'entrée est remplacé)
import { execFileSync } from 'node:child_process';
import { renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const MUSIQUE = { fichier: join(RACINE, 'docs/videos/musique/corporate-litesaturation.m4a'), debut: 20.17, volume: 0.6 };
const AUDIO_KBPS = 96, TAILLE_MAX = 2.9e6;

export function sonoriser(entree, sortie = entree) {
  const duree = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', entree]).toString());
  const tmp = `${sortie}.tmp.mp4`;
  const filtre = `[1:a]atrim=0:${duree},asetpts=PTS-STARTPTS,volume=${MUSIQUE.volume},afade=t=in:d=0.15,`
    + `afade=t=out:st=${Math.max(0, duree - 1.8)}:d=1.8,apad,atrim=0:${duree},loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', '-i', entree, '-ss', String(MUSIQUE.debut), '-i', MUSIQUE.fichier,
    '-filter_complex', filtre, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`,
    '-ar', '48000', '-ac', '2', '-t', String(duree), '-movflags', '+faststart', tmp]);
  renameSync(tmp, sortie);
  const taille = statSync(sortie).size;
  if (taille > TAILLE_MAX) console.error(`Attention : ${sortie} fait ${(taille / 1e6).toFixed(2)} Mo (> 2,9 Mo, limite du connecteur Drive)`);
  return { duree, taille };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree) { console.error('Usage : node sonoriser.mjs <entrée.mp4> [sortie.mp4]'); process.exit(1); }
  const { duree, taille } = sonoriser(entree, sortie || entree);
  console.log(`${sortie || entree} : musique ajoutée (${duree.toFixed(1)} s, ${(taille / 1e6).toFixed(2)} Mo)`);
}
