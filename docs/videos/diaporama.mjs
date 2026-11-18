// Diaporama vertical d'un carrousel (décision de Quentin du 18/11/2026) : sur TikTok, chaque carrousel Instagram est
// publié en vidéo, car l'import photo par photo de TikTok Studio crée des doublons (relevé du 18/11/2026,
// docs/templates/communication/tiktok/README.md). Instinct n'importe ainsi qu'un seul fichier.
//
// Rendu par le moteur unique (rendu.mjs) : 1080 × 1920, 30 i/s en temps virtuel, musique QME, sous 2,9 Mo.
// Chaque image (4:5 en général) est centrée ; les bandes du haut et du bas prennent la couleur de son bord, de sorte
// que l'image paraît prolongée. Passage d'une image à l'autre par glissement horizontal, comme un carrousel.
//
// Usage :
//   node docs/videos/diaporama.mjs <image1.png> … <imageN.png> --sortie <fichier.mp4> [--par-image <s>] [--brouillon]
// Une image seule (format Instagram « Image ») donne une vidéo fixe de 5 s, en musique.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { rendrePage } from './rendu.mjs';

export const PAR_IMAGE = 4.2; // s par image (le temps de lire une diapositive dense)
export const GLISSEMENT = 0.45; // s de transition

export function pageDiaporama(images, parImage = PAR_IMAGE, glissement = GLISSEMENT) {
  const sources = images.map((f) => `data:image/${extname(f).slice(1).replace('jpg', 'jpeg')};base64,${readFileSync(f).toString('base64')}`);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#efece6}
#piste{position:absolute;inset:0;display:flex;will-change:transform}
.diapo{flex:0 0 1080px;height:1920px;display:flex;flex-direction:column}
.bande{flex:1}
.diapo img{display:block;width:1080px;height:auto}
</style></head><body><div id="piste">${sources.map((s) => `<div class="diapo"><div class="bande haut"></div><img src="${s}"><div class="bande bas"></div></div>`).join('')}</div>
<script>
const PAR = ${parImage * 1000}, GL = ${glissement * 1000}, N = ${sources.length};
// Couleur du bord : pixel du coin haut gauche pour la bande du haut, bas gauche pour celle du bas.
window.addEventListener('load', () => {
  for (const d of document.querySelectorAll('.diapo')) {
    const img = d.querySelector('img'); const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = (y) => { const p = x.getImageData(2, y, 1, 1).data; return 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')'; };
    d.querySelector('.haut').style.background = px(2); d.querySelector('.bas').style.background = px(c.height - 3);
  }
});
const adoucir = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
window.placer = (ms) => {
  const i = Math.min(N - 1, Math.floor(ms / PAR)); const dans = ms - i * PAR;
  let pos = i;
  if (i < N - 1 && dans > PAR - GL) pos = i + adoucir((dans - (PAR - GL)) / GL);
  document.getElementById('piste').style.transform = 'translateX(' + (-pos * 1080) + 'px)';
};
</script></body></html>`;
}

export async function rendreDiaporama({ images, sortie, parImage = PAR_IMAGE, rapide = false }) {
  const tmp = join(tmpdir(), `qme-diaporama-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const page = join(tmp, 'diaporama.html');
  writeFileSync(page, pageDiaporama(images, parImage));
  try {
    // Dernière image tenue un peu plus longtemps pour la fin de la musique ; couverture = première image.
    return await rendrePage({ page, duree: images.length * parImage + 0.8, couverture: 500, sortie, rapide });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const sortie = opt('--sortie'); const par = opt('--par-image'); const rapide = args.includes('--brouillon');
  const images = args.filter((a) => !a.startsWith('--'));
  if (!sortie || images.length < 1) { console.error('Usage : node docs/videos/diaporama.mjs <img1> … <imgN> --sortie f.mp4 [--par-image s] [--brouillon]'); process.exit(1); }
  mkdirSync(dirname(resolve(sortie)), { recursive: true });
  const r = await rendreDiaporama({ images, sortie: resolve(sortie), parImage: par ? Number(par) : PAR_IMAGE, rapide });
  console.log(`${r.sortie} : ${images.length} images, ${r.duree.toFixed(1)} s, ${(r.taille / 1e6).toFixed(2)} Mo, musique QME`);
}
