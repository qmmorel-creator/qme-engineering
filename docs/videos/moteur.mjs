// Moteur des vidéos de démonstration QME (Reels / Shorts 1080 × 1920, ~30 s).
// Usage : node docs/videos/moteur.mjs docs/videos/scenarios/<scenario>.mjs [--brouillon]
//
// Principe : l'application RÉELLE du template tourne dans le studio (docs/videos/studio/), servie par le serveur
// local des templates. Playwright y déplace la vraie souris, clique et tape au clavier ; l'application calcule
// elle-même. Le studio ajoute par-dessus la mise en scène (caméra, curseur, repères, tampons, légendes).
// La capture se fait image par image (screencast Chromium horodaté), puis ffmpeg assemble la vidéo à 30 i/s
// et mixe les bruitages (synthétisés, aucune ressource externe) et, en option, une musique fournie.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
const PORT = Number(process.env.PORT_VIDEO || 8897);
const FPS = 30;

const [cheminScenario, ...options] = process.argv.slice(2);
if (!cheminScenario) { console.error('Usage : node docs/videos/moteur.mjs <scenario.mjs> [--brouillon]'); process.exit(1); }
const brouillon = options.includes('--brouillon');
const scenario = await import(pathToFileURL(resolve(cheminScenario)));
const cfg = scenario.config;
const nom = cfg.nom || basename(cheminScenario, '.mjs');
const SORTIE = join(ICI, 'sortie');
const TMP = join(SORTIE, `.tmp-${nom}`);
rmSync(TMP, { recursive: true, force: true }); mkdirSync(join(TMP, 'images'), { recursive: true });

// 1. Serveur local des templates (stockage en mémoire, aucune donnée réelle).
const serveur = spawn('node', [join(RACINE, 'outils/templates/serveur-local.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const fin = () => { try { serveur.kill(); } catch {} };
process.on('exit', fin);
for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }

// 2. Navigateur et studio.
const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await contexte.newPage();
page.on('pageerror', (e) => console.error('Erreur page :', e.message));
const q = new URLSearchParams({ app: cfg.app, w: cfg.largeur || 1280, h: cfg.hauteur || 1600, marque: cfg.marque || 'QME', url: cfg.url || 'qm-engineering.fr' });
await page.goto(`http://localhost:${PORT}/docs/videos/studio/?${q}`);
await page.evaluate(() => S.pret());
await page.waitForTimeout(800);
const appli = page.frames().find((f) => f !== page.mainFrame());

// 3. Outils du scénario.
const sons = [];
let t0 = null;
const maintenant = () => (t0 == null ? 0 : Date.now() / 1000 - t0);
const v = {
  page, appli, pause: (ms) => page.waitForTimeout(ms),
  S: (nomFn, ...args) => page.evaluate(([n, a]) => S[n](...a), [nomFn, args]),
  son: (type, volume = 1) => { if (t0 != null) sons.push({ t: maintenant(), type, volume }); },
  async cliquer(sel, { ms = 650, decalage = [0.5, 0.5], son = 'clic' } = {}) {
    const r = await v.S('ancre', sel);
    const x = r.x + r.w * decalage[0], y = r.y + r.h * decalage[1];
    await Promise.all([v.S('curseurVers', x, y, ms), page.mouse.move(x, y, { steps: Math.max(2, Math.round(ms / 40)) })]);
    await page.waitForTimeout(90);
    v.son(son); await v.S('appui', x, y);
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(160);
  },
  async saisir(sel, texte, { touches = true } = {}) {
    await v.cliquer(sel);
    await page.keyboard.press('Control+A'); await page.waitForTimeout(120);
    for (const c of texte) {
      if (touches) await v.S('touche', c);
      v.son('touche'); await page.keyboard.type(c); await page.waitForTimeout(230);
    }
  },
  async valider() { await v.S('touche', 'Entrée ⏎'); v.son('touche'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); },
  lire: (sel) => appli.$eval(sel, (e) => (e.value ?? e.textContent).trim()),
};

// 4. Préparation hors caméra (fermer le guide d'accueil, etc.), puis enregistrement.
if (scenario.preparer) await scenario.preparer(v);
const cdp = await contexte.newCDPSession(page);
const images = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const ts = metadata.timestamp;
  if (t0 == null) t0 = ts;
  const f = join(TMP, 'images', `${String(images.length).padStart(5, '0')}.jpg`);
  writeFileSync(f, Buffer.from(data, 'base64'));
  images.push({ f, t: ts - t0 });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: brouillon ? 70 : 93, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
while (t0 == null) await page.waitForTimeout(20);
const debut = Date.now();
try { await scenario.jouer(v); } catch (e) {
  await page.screenshot({ path: join(SORTIE, `${nom}-erreur.png`) });
  console.error(`Échec du scénario (capture : ${join(SORTIE, `${nom}-erreur.png`)})`); await navigateur.close(); fin(); throw e;
}
await page.waitForTimeout(400);
await cdp.send('Page.stopScreencast');
const duree = (Date.now() - debut) / 1000;
await navigateur.close(); fin();
console.log(`Capture : ${images.length} images en ${duree.toFixed(1)} s (${(images.length / duree).toFixed(1)} i/s moyennes)`);

// 5. Vidéo : chaque image dure jusqu'à la suivante (rythme réel), rééchantillonnée à 30 i/s.
const liste = images.map((im, i) => `file '${im.f}'\nduration ${((images[i + 1]?.t ?? duree) - im.t).toFixed(4)}`).join('\n') + `\nfile '${images.at(-1).f}'\n`;
writeFileSync(join(TMP, 'images.txt'), liste);
const video = join(TMP, 'video.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(TMP, 'images.txt'), '-vf', `fps=${FPS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', brouillon ? 'veryfast' : 'slow', '-crf', brouillon ? '26' : '18', '-t', duree.toFixed(3), video]);

// 6. Bruitages synthétisés (ffmpeg), placés aux instants réels des actions.
const SONS = {
  clic: 'anoisesrc=d=0.05:c=pink:a=0.9,highpass=f=1500,afade=t=out:st=0:d=0.05',
  touche: 'anoisesrc=d=0.035:c=white:a=0.5,bandpass=f=3500:w=2000,afade=t=out:st=0:d=0.035',
  pop: "aevalsrc='0.6*sin(2*PI*(380+2600*t)*t)*exp(-28*t)':d=0.16",
  whoosh: 'anoisesrc=d=0.5:c=pink:a=0.5,bandpass=f=900:w=1400,afade=t=in:d=0.22,afade=t=out:st=0.22:d=0.28',
  ding: "aevalsrc='0.35*(sin(2*PI*1318*t)+0.6*sin(2*PI*1975*t))*exp(-5*t)':d=0.9",
  alerte: "aevalsrc='0.4*sin(2*PI*196*t)*(1+0.5*sin(2*PI*392*t))*exp(-3*t)*lt(t,0.18)+0.4*sin(2*PI*165*t)*(1+0.5*sin(2*PI*330*t))*exp(-3*(t-0.2))*gt(t,0.2)':d=0.7",
  tampon: "aevalsrc='0.9*sin(2*PI*(70+90*exp(-25*t))*t)*exp(-9*t)':d=0.4",
};
const types = [...new Set(sons.map((s) => s.type))];
for (const t of types) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', SONS[t], '-ar', '48000', '-ac', '1', join(TMP, `son-${t}.wav`)]);
const entrees = [], filtres = [];
sons.forEach((s, i) => {
  entrees.push('-i', join(TMP, `son-${s.type}.wav`));
  filtres.push(`[${i}]adelay=${Math.round(s.t * 1000)}:all=1,volume=${s.volume}[s${i}]`);
});
let musique = cfg.musique && existsSync(resolve(RACINE, cfg.musique)) ? resolve(RACINE, cfg.musique) : null;
if (musique) { entrees.push('-stream_loop', '-1', '-i', musique); filtres.push(`[${sons.length}]atrim=0:${duree},volume=0.22,afade=t=out:st=${duree - 2.5}:d=2.5[m]`); }
const n = sons.length + (musique ? 1 : 0);
const audio = join(TMP, 'audio.wav');
if (n) {
  filtres.push(`${sons.map((_, i) => `[s${i}]`).join('')}${musique ? '[m]' : ''}amix=inputs=${n}:normalize=0:duration=longest,apad,atrim=0:${duree},loudnorm=I=-16:TP=-1.5:LRA=11[a]`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...entrees, '-filter_complex', filtres.join(';'), '-map', '[a]', '-ar', '48000', '-ac', '2', audio]);
}
const final = join(SORTIE, `${nom}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...(n ? ['-i', audio, '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []), '-c:v', 'copy', '-movflags', '+faststart', final]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(cfg.affiche ?? 1.5), '-i', final, '-frames:v', '1', '-q:v', '3', join(SORTIE, `${nom}-affiche.jpg`)]);
if (!options.includes('--garder')) rmSync(TMP, { recursive: true, force: true });
console.log(`Vidéo : ${final} (${duree.toFixed(1)} s)`);
