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
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
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
// Musique : { fichier, bpm, premierTemps (s), debut (s, calé sur un temps) }. Les temps tombent alors à k × période depuis 0.
const musiqueCfg = cfg.musique || null;
const PERIODE = musiqueCfg ? 60 / musiqueCfg.bpm : 0.5;
let t0 = null;
const maintenant = () => (t0 == null ? 0 : Date.now() / 1000 - t0);
const v = {
  page, appli, pause: (ms) => page.waitForTimeout(ms),
  S: (nomFn, ...args) => page.evaluate(([n, a]) => S[n](...a), [nomFn, args]),
  son: (type, volume = 1) => { if (t0 != null) sons.push({ t: maintenant(), type, volume }); },
  // Le curseur va sur l'élément (la caméra le suit), puis la vraie souris clique au point exact une fois la caméra posée.
  async viser(sel, { ms = 700, fx = 0.5, fy = 0.5, glisse = true } = {}) {
    const p = await v.S('pointeur', sel, fx, fy);
    if (glisse) v.son('glisse', 0.35);
    await v.S('curseurVers', p.x, p.y, ms);
    await v.S('attendreCamera', 1800);
    return p;
  },
  async cliquer(sel, options = {}) {
    const p = await v.viser(sel, options);
    const t = await v.S('versToile', p.x, p.y);
    await page.mouse.move(t.x, t.y, { steps: 3 });
    await page.waitForTimeout(80);
    v.son(options.son || 'clic'); await v.S('appui');
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
    await page.waitForTimeout(160);
  },
  async saisir(sel, texte, { touches = true, ms } = {}) {
    await v.cliquer(sel, ms ? { ms } : {});
    await page.keyboard.press('Control+A'); await page.waitForTimeout(120);
    for (const c of texte) {
      if (touches) await v.S('touche', c);
      v.son('touche'); await page.keyboard.type(c); await page.waitForTimeout(150);
    }
  },
  async valider() { await v.S('touche', 'Entrée ⏎'); v.son('touche'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); },
  // Attend le prochain temps de la musique (sub = 2 : demi-temps). Les actions tombent ainsi sur le rythme.
  async temps(sub = 1) {
    const p = PERIODE / sub, t = maintenant();
    const suivant = Math.ceil((t + 0.02) / p) * p;
    await page.waitForTimeout(Math.max(0, (suivant - t) * 1000));
  },
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
await v.S('rythme', PERIODE * 1000, (maintenant() * 1000) % (PERIODE * 1000));
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
// Diffusion Reels Instagram / LinkedIn : 720 × 1280, encodage en deux passes avec un débit calculé pour tenir
// sous TAILLE_MAX (limite d'envoi automatique vers Google Drive). Capture faite en 1080 × 1920 puis réduite.
const TAILLE_MAX = (cfg.tailleMaxMo ?? 2.9) * 1e6, AUDIO_KBPS = 96;
const debitVideo = Math.floor((TAILLE_MAX * 8 / duree) / 1000 - AUDIO_KBPS - 40); // 40 kbit/s de marge (conteneur)
const video = join(TMP, 'video.mp4');
const encodage = ['-f', 'concat', '-safe', '0', '-i', join(TMP, 'images.txt'), '-vf', `fps=${FPS},scale=720:1280:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', brouillon ? 'veryfast' : 'slow', '-b:v', `${debitVideo}k`, '-passlogfile', join(TMP, 'passe'), '-t', duree.toFixed(3)];
execFileSync('ffmpeg', ['-y', '-v', 'error', ...encodage, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
execFileSync('ffmpeg', ['-y', '-v', 'error', ...encodage, '-pass', '2', video]);
if (duree > (cfg.dureeMax ?? 40)) console.error(`Attention : ${duree.toFixed(1)} s, au-delà de la durée maximale (${cfg.dureeMax ?? 40} s).`);

// 6. Bruitages synthétisés (ffmpeg), placés aux instants réels des actions.
const SONS = {
  // Clic de souris : appui puis relâchement 75 ms plus tard ; transitoire bref, résonance du plastique (1,8 et 4 kHz) et petit corps grave.
  clic: "aevalsrc='(0.55*(random(0)*2-1)*exp(-t*2600)+0.7*sin(2*PI*4000*t)*exp(-t*1400)+0.45*sin(2*PI*1800*t)*exp(-t*800)+0.3*sin(2*PI*260*t)*exp(-t*300))*lt(t,0.07)+0.6*(0.5*(random(0)*2-1)*exp(-(t-0.075)*3000)+0.6*sin(2*PI*4600*t)*exp(-(t-0.075)*1600)+0.35*sin(2*PI*2100*t)*exp(-(t-0.075)*900))*gte(t,0.075)':d=0.16,highpass=f=120",
  touche: "aevalsrc='0.5*(random(0)*2-1)*exp(-t*1800)+0.45*sin(2*PI*2300*t)*exp(-t*700)+0.35*sin(2*PI*190*t)*exp(-t*220)':d=0.09,highpass=f=150",
  pop: "aevalsrc='0.6*sin(2*PI*(380+2600*t)*t)*exp(-28*t)':d=0.16",
  whoosh: 'anoisesrc=d=0.5:c=pink:a=0.5,bandpass=f=900:w=1400,afade=t=in:d=0.22,afade=t=out:st=0.22:d=0.28',
  ding: "aevalsrc='0.35*(sin(2*PI*1318*t)+0.6*sin(2*PI*1975*t))*exp(-5*t)':d=0.9",
  alerte: "aevalsrc='0.4*sin(2*PI*196*t)*(1+0.5*sin(2*PI*392*t))*exp(-3*t)*lt(t,0.18)+0.4*sin(2*PI*165*t)*(1+0.5*sin(2*PI*330*t))*exp(-3*(t-0.2))*gt(t,0.2)':d=0.7",
  tampon: "aevalsrc='0.9*sin(2*PI*(70+90*exp(-25*t))*t)*exp(-9*t)':d=0.4",
  zoom: "aevalsrc='0.22*sin(2*PI*(180+520*t*t)*t)*sin(PI*t/0.5)+0.18*(random(0)*2-1)*sin(PI*t/0.5)':d=0.5,lowpass=f=3200",
  dezoom: "aevalsrc='0.22*sin(2*PI*(520-300*t)*t)*sin(PI*t/0.45)+0.18*(random(0)*2-1)*sin(PI*t/0.45)':d=0.45,lowpass=f=2400",
  glisse: 'anoisesrc=d=0.3:c=pink:a=0.4,bandpass=f=2400:w=1800,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.18',
  eclat: "aevalsrc='0.28*(sin(2*PI*1568*t)*lt(t,0.09)+sin(2*PI*2093*t)*gt(t,0.07)*lt(t,0.17)+sin(2*PI*2637*t)*gt(t,0.15))*exp(-5*t)':d=0.7",
  trait: 'anoisesrc=d=0.4:c=brown:a=0.6,highpass=f=900,bandpass=f=2600:w=2000,afade=t=in:d=0.05,afade=t=out:st=0.15:d=0.25',
};
const types = [...new Set(sons.map((s) => s.type))];
for (const t of types) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', SONS[t], '-ar', '48000', '-ac', '1', join(TMP, `son-${t}.wav`)]);
const entrees = [], filtres = [];
sons.forEach((s, i) => {
  entrees.push('-i', join(TMP, `son-${s.type}.wav`));
  filtres.push(`[${i}]adelay=${Math.round(s.t * 1000)}:all=1,volume=${s.volume}[s${i}]`);
});
const musique = musiqueCfg && existsSync(resolve(RACINE, musiqueCfg.fichier)) ? resolve(RACINE, musiqueCfg.fichier) : null;
if (musiqueCfg && !musique) console.error(`Musique introuvable : ${musiqueCfg.fichier}`);
if (musique) { entrees.push('-ss', String(musiqueCfg.debut || 0), '-i', musique); filtres.push(`[${sons.length}]atrim=0:${duree},asetpts=PTS-STARTPTS,volume=${musiqueCfg.volume ?? 0.55},afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, duree - 1.8)}:d=1.8[m]`); }
const n = sons.length + (musique ? 1 : 0);
const audio = join(TMP, 'audio.wav');
if (n) {
  filtres.push(`${sons.map((_, i) => `[s${i}]`).join('')}${musique ? '[m]' : ''}amix=inputs=${n}:normalize=0:duration=longest,apad,atrim=0:${duree},loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...entrees, '-filter_complex', filtres.join(';'), '-map', '[a]', '-ar', '48000', '-ac', '2', audio]);
}
const final = join(SORTIE, `${nom}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, ...(n ? ['-i', audio, '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-shortest'] : []), '-c:v', 'copy', '-movflags', '+faststart', final]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(cfg.affiche ?? 1.5), '-i', final, '-frames:v', '1', '-q:v', '3', join(SORTIE, `${nom}-affiche.jpg`)]);
if (!options.includes('--garder')) rmSync(TMP, { recursive: true, force: true });
console.log(`Vidéo : ${final} (${duree.toFixed(1)} s, ${(statSync(final).size / 1e6).toFixed(2)} Mo)`);
