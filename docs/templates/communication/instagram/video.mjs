// Rend une page HTML animée (animations CSS en pause, fonction window.placer(ms)) en MP4 1080 × 1920.
// Usage : node docs/templates/communication/instagram/video.mjs reel-lancement.html 15 [couverture_ms]
// Sortie : png/<nom>.mp4 et png/<nom>-couverture.png (image à couverture_ms, 14 500 ms par défaut).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const { chromium } = createRequire(import.meta.url)('playwright');
const ici = dirname(fileURLToPath(import.meta.url));
const fichier = process.argv[2] || 'reel-lancement.html';
const duree = Number(process.argv[3] || 15);
const couv = Number(process.argv[4] || 14500);
const nom = basename(fichier, '.html');
const ips = 30;
const images = join(tmpdir(), `qme-${nom}-images`);
rmSync(images, { recursive: true, force: true });
mkdirSync(images, { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(ici, fichier)).href);
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
const total = Math.round(duree * ips);
for (let n = 0; n < total; n++) {
  await page.evaluate((ms) => window.placer(ms), (n * 1000) / ips);
  await page.screenshot({ path: join(images, `${String(n).padStart(4, '0')}.png`) });
}
await page.evaluate((ms) => window.placer(ms), couv);
await page.screenshot({ path: join(ici, 'png', `${nom}-couverture.png`) });
await navigateur.close();

execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(ips), '-i', join(images, '%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', join(ici, 'png', `${nom}.mp4`)]);
rmSync(images, { recursive: true, force: true });
console.log(`png/${nom}.mp4 (${total} images) et png/${nom}-couverture.png`);
