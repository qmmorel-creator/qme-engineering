// Moteur vidéo unique de QME : briques communes à TOUTES les vidéos (démos interactives `moteur.mjs`, Reels du soir et
// motion design `rendrePage`, Shorts). Décision de Quentin du 18/11/2026 : toute vidéo QME passe par ce moteur.
//
// Principe : capture image par image en TEMPS VIRTUEL, à 30 i/s exactement. Rien ne dépend de la vitesse de la
// machine : l'horloge de la page (Date, minuteurs, requestAnimationFrame) et les animations CSS avancent d'exactement
// 1/30 s entre deux captures. Encodage H.264 en deux passes, au débit calculé pour tenir sous la limite du connecteur
// Drive ; musique QME aux réglages communs.
//
// Usage en ligne de commande (page HTML animée, Reel du soir, motion design) :
//   node docs/videos/rendu.mjs <page.html> <durée en s> [couverture en ms] [--sortie <fichier.mp4>] [--muet]
// La page peut exposer window.placer(ms) (elle place elle-même chaque image) ; sinon ses animations CSS et JS
// sont simplement jouées sur l'horloge virtuelle.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync, renameSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
export const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const ICI = dirname(fileURLToPath(import.meta.url));
export const RACINE = resolve(ICI, '../..');
export const FPS = 30;
export const PAS = 1000 / FPS;
export const TAILLE_MAX_MO = 2.9; // limite d'envoi automatique vers Google Drive
export const AUDIO_KBPS = 96;
// « Corporate », litesaturation (licence Pixabay, usage commercial sans attribution), 110 BPM, premier temps 0,534 s.
export const MUSIQUE = { fichier: join(RACINE, 'docs/videos/musique/corporate-litesaturation.m4a'), bpm: 110, premierTemps: 0.534, debut: 20.17, volume: 0.6, longueur: 60 };

// Bibliothèque musicale QME (décision de Quentin du 18/11/2026 : aucune vidéo muette, musiques variées). Les quatre
// morceaux de 30 s ont été fournis par Quentin le 18/11/2026 ; tempo et premier temps mesurés (docs/videos/musique/README.md).
// `debut` est calé sur un temps : les temps tombent alors à k × (60 / bpm) depuis le début de la vidéo.
const M = (fichier, bpm, premierTemps, longueur) => ({ fichier: join(RACINE, 'docs/videos/musique', fichier), bpm, premierTemps, debut: premierTemps, volume: 0.6, longueur });
export const MUSIQUES = [
  MUSIQUE,
  M('product-launch.m4a', 120, 0.017, 30.04),
  M('productive-flow.m4a', 96, 0.308, 30.04),
  M('professional-momentum.m4a', 118, 0.505, 30.04),
  M('product-motion.m4a', 100, 0.592, 30.04),
];

// Choisit une musique pour une vidéo de `duree` secondes, de façon variée mais stable : même clé (nom de la vidéo),
// même musique. Seuls les morceaux assez longs depuis leur `debut` sont candidats ; à défaut, « Corporate » démarre
// sur un temps plus tôt pour couvrir toute la durée.
export function choisirMusique(cle, duree) {
  const marge = 0.3;
  const candidats = MUSIQUES.filter((m) => m.longueur - m.debut >= duree + marge);
  if (candidats.length) {
    let h = 0; for (const c of String(cle)) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return candidats[h % candidats.length];
  }
  const periode = 60 / MUSIQUE.bpm;
  const k = Math.max(0, Math.floor((MUSIQUE.longueur - duree - marge - MUSIQUE.premierTemps) / periode));
  return { ...MUSIQUE, debut: +(MUSIQUE.premierTemps + k * periode).toFixed(3) };
}

// Animations CSS (transitions, keyframes) d'un document : mises en pause à leur création puis avancées de `pas` ms à
// chaque image, sinon elles tourneraient en temps réel pendant que l'image se calcule. Évaluée dans la page.
export const PAS_ANIM = (pas) => {
  for (const a of document.getAnimations()) {
    if (!a.__qme) { a.__qme = true; a.pause(); a.currentTime = 0; continue; }
    a.currentTime = (a.currentTime || 0) + pas;
    const t = a.effect?.getComputedTiming?.();
    if (t && Number.isFinite(t.endTime) && a.currentTime >= t.endTime) a.finish();
  }
};

// Encode une suite d'images `<dossier>/%05d.<ext>` à 30 i/s, en deux passes, au débit qui tient sous la taille maximale
// (place gardée pour l'audio et le conteneur). `largeur` × `hauteur` : taille de sortie.
export function encoder({ dossier, ext = 'jpg', duree, sortie, largeur = 1080, hauteur = 1920, tailleMaxMo = TAILLE_MAX_MO, audio = true, rapide = false, tmp }) {
  // 97 % du budget : l’encodage en deux passes dépasse parfois légèrement le débit visé.
  const debit = Math.floor((tailleMaxMo * 1e6 * 8 * 0.97 / duree) / 1000 - (audio ? AUDIO_KBPS : 0) - 40);
  const args = ['-framerate', String(FPS), '-i', join(dossier, `%05d.${ext}`), '-vf', `scale=${largeur}:${hauteur}:flags=lanczos,format=yuv420p`, '-r', String(FPS),
    '-c:v', 'libx264', '-preset', rapide ? 'veryfast' : 'slow', '-b:v', `${debit}k`, '-passlogfile', join(tmp, 'passe'), '-t', duree.toFixed(3)];
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args, '-pass', '2', '-movflags', '+faststart', sortie]);
}

// Ajoute la musique QME à une vidéo sans réencoder l'image (fondu d'entrée 0,15 s, de sortie 1,8 s, -14 LUFS, AAC).
export function ajouterMusique(entree, sortie = entree, musique = null) {
  const duree = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', entree]).toString());
  musique = musique || choisirMusique(basename(sortie, '.mp4'), duree);
  const tmp = `${sortie}.tmp.mp4`;
  const filtre = `[1:a]atrim=0:${duree},asetpts=PTS-STARTPTS,volume=${musique.volume},afade=t=in:d=0.15,`
    + `afade=t=out:st=${Math.max(0, duree - 1.8)}:d=1.8,apad,atrim=0:${duree},loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', '-i', entree, '-ss', String(musique.debut), '-i', musique.fichier,
    '-filter_complex', filtre, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`,
    '-ar', '48000', '-ac', '2', '-t', String(duree), '-movflags', '+faststart', tmp]);
  renameSync(tmp, sortie);
  const taille = statSync(sortie).size;
  if (taille > TAILLE_MAX_MO * 1e6) console.error(`Attention : ${sortie} fait ${(taille / 1e6).toFixed(2)} Mo (> ${TAILLE_MAX_MO} Mo, limite du connecteur Drive)`);
  return { duree, taille };
}

// Rend une page HTML animée en MP4 1080 × 1920 (Reel, Short, motion design), image par image en temps virtuel.
export async function rendrePage({ page: chemin, duree, couverture = null, sortie, muet = false, musique = null, rapide = false }) {
  const nom = basename(sortie, '.mp4');
  const tmp = join(tmpdir(), `qme-rendu-${nom}-${process.pid}`);
  const images = join(tmp, 'images');
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(images, { recursive: true });
  const navigateur = await chromium.launch({ args: ['--lang=fr-FR'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr' } });
  try {
    const contexte = await navigateur.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    await contexte.clock.install();
    const page = await contexte.newPage();
    page.on('pageerror', (e) => console.error('Erreur page :', e.message));
    await page.goto(/^https?:/.test(chemin) ? chemin : pathToFileURL(resolve(chemin)).href);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
    const placer = await page.evaluate(() => typeof window.placer === 'function');
    // Horloge figée : seule la boucle ci-dessous fait avancer le temps de la page.
    await contexte.clock.pauseAt((await page.evaluate(() => Date.now())) + 250);
    const cdp = await contexte.newCDPSession(page);
    const capturer = async (f) => { const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: rapide ? 75 : 92 }); writeFileSync(f, Buffer.from(data, 'base64')); };
    const total = Math.round(duree * FPS);
    for (let n = 0; n < total; n++) {
      if (placer) await page.evaluate((ms) => window.placer(ms), n * PAS);
      else { await contexte.clock.runFor(PAS); await Promise.all(page.frames().map((f) => f.evaluate(PAS_ANIM, PAS).catch(() => {}))); }
      await capturer(join(images, `${String(n).padStart(5, '0')}.jpg`));
    }
    if (couverture != null) {
      const png = sortie.replace(/\.mp4$/, '-couverture.png');
      if (placer) { await page.evaluate((ms) => window.placer(ms), couverture); await page.screenshot({ path: png }); }
      else execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(images, `${String(Math.min(total - 1, Math.round(couverture / PAS))).padStart(5, '0')}.jpg`), png]);
    }
    await navigateur.close();
    // Si l'encodage dépasse la limite Drive (le débit visé est parfois dépassé de quelques %), on réencode au
    // prorata du dépassement, deux fois au plus.
    for (let essai = 0, max = TAILLE_MAX_MO; essai < 3; essai++) {
      encoder({ dossier: images, duree, sortie, audio: !muet, rapide, tmp, tailleMaxMo: max });
      if (!muet) ajouterMusique(sortie, sortie, musique); // après l'encodage : jamais de Reel muet par erreur
      const mo = statSync(sortie).size / 1e6;
      if (mo <= TAILLE_MAX_MO) break;
      max *= (TAILLE_MAX_MO / mo) * 0.97;
    }
    return { sortie, images: total, duree, taille: statSync(sortie).size, placer };
  } finally {
    await navigateur.close().catch(() => {});
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Ligne de commande.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const sortie = opt('--sortie');
  const muet = args.includes('--muet'); const rapide = args.includes('--brouillon');
  const [page, duree, couverture] = args.filter((a) => !a.startsWith('--'));
  if (!page || !duree) { console.error('Usage : node docs/videos/rendu.mjs <page.html> <durée s> [couverture ms] [--sortie f.mp4] [--muet] [--brouillon]'); process.exit(1); }
  const cible = sortie || join(ICI, 'sortie', `${basename(page, '.html')}.mp4`);
  mkdirSync(dirname(cible), { recursive: true });
  const r = await rendrePage({ page, duree: Number(duree), couverture: couverture != null ? Number(couverture) : null, sortie: cible, muet, rapide });
  console.log(`${r.sortie} : ${r.images} images (${r.duree} s, ${r.placer ? 'window.placer' : 'horloge virtuelle'}), ${(r.taille / 1e6).toFixed(2)} Mo${muet ? ', muet' : ', musique QME'}`);
}
