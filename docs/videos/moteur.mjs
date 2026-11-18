// Moteur des vidéos de démonstration QME (Reels / Shorts 1080 × 1920, ~30 s).
// Usage : node docs/videos/moteur.mjs docs/videos/scenarios/<scenario>.mjs [--brouillon]
//
// Principe : l'application RÉELLE du template tourne dans le studio (docs/videos/studio/), servie par le serveur
// local des templates. Playwright y déplace la vraie souris, clique et tape au clavier ; l'application calcule
// elle-même. Le studio ajoute par-dessus la mise en scène (caméra, curseur, repères, tampons, légendes).
// Capture image par image en TEMPS VIRTUEL : l'horloge de la page (Date, minuteurs, requestAnimationFrame, celle de
// l'application comprise) et les animations CSS avancent d'exactement 1/30 s entre deux captures. Chaque image tombe
// donc pile sur sa date : mouvement régulier, sans image perdue ni rééchantillonnage, quelle que soit la charge de la
// machine. ffmpeg assemble ensuite la vidéo à 30 i/s et mixe les bruitages (synthétisés) et, en option, la musique.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Briques communes à toutes les vidéos QME (navigateur, temps virtuel des animations CSS, encodage) : rendu.mjs.
import { chromium, PAS_ANIM, encoder, FPS, AUDIO_KBPS, choisirMusique } from './rendu.mjs';
const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
const PORT = Number(process.env.PORT_VIDEO || 8897);

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

// 2. Navigateur et studio. L'horloge simulée de Playwright est installée avant le chargement : elle s'écoule
// normalement pendant la préparation, puis elle est figée et avancée image par image pendant l'enregistrement.
// Chromium en français : sans LANG, certains champs natifs (mois, date) s'affichent en anglais.
const navigateur = await chromium.launch({ args: ['--lang=fr-FR'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr' } });
const contexte = await navigateur.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await contexte.clock.install();
const pageBrute = await contexte.newPage();
pageBrute.on('pageerror', (e) => console.error('Erreur page :', e.message));
const q = new URLSearchParams({ app: cfg.app, w: cfg.largeur || 1280, h: cfg.hauteur || 1600, marque: cfg.marque || 'QME', url: cfg.url || 'qm-engineering.fr' });
await pageBrute.goto(`http://localhost:${PORT}/docs/videos/studio/?${q}`);
await pageBrute.evaluate(() => S.pret());
await pageBrute.waitForTimeout(800);
const cadreApp = () => pageBrute.frames().find((f) => f !== pageBrute.mainFrame());

// 3. Horloge du tournage. Avant l'enregistrement : temps réel. Pendant : temps virtuel, une image tous les PAS ms.
const PAS = 1000 / FPS;
const cdp = await contexte.newCDPSession(pageBrute);
let fige = false, nImages = 0;
const IMAGES = join(TMP, 'images');
async function image() {
  await contexte.clock.runFor(PAS);
  await Promise.all(pageBrute.frames().map((f) => f.evaluate(PAS_ANIM, PAS).catch(() => {})));
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: brouillon ? 70 : 92, captureBeyondViewport: false });
  writeFileSync(join(IMAGES, `${String(nImages).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
  nImages++;
}
// Attente : réelle avant l'enregistrement ; pendant, autant d'images que de pas (le temps passe dans la vidéo).
async function attendre(ms) {
  if (!fige) return pageBrute.waitForTimeout(ms);
  for (let i = 0, n = Math.max(1, Math.round(ms / PAS)); i < n; i++) await image();
}
// Une promesse de la page (caméra qui se pose, curseur qui arrive) ne se résout que si l'horloge avance : on filme
// image par image jusqu'à sa résolution.
async function filmerJusqua(promesse) {
  if (!fige) return promesse;
  let fini = false, res, err;
  promesse.then((r) => { fini = true; res = r; }, (e) => { fini = true; err = e; });
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; !fini && i < FPS * 30; i++) await image();
  if (!fini) throw new Error('Promesse de la page non résolue après 30 s de vidéo');
  if (err) throw err;
  return res;
}
// Les scénarios reçoivent une page dont waitForTimeout suit l'horloge du tournage.
const page = new Proxy(pageBrute, { get: (t, k) => (k === 'waitForTimeout' ? attendre : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });

// 4. Outils du scénario.
const sons = [];
// Musique : { fichier, bpm, premierTemps (s), debut (s, calé sur un temps) }. Les temps tombent alors à k × période depuis 0.
// `musique: 'auto'` (recommandé, décision du 18/11/2026) : morceau choisi dans la bibliothèque QME selon le nom du
// scénario, parmi ceux qui couvrent la durée maximale (`dureeMax`, 40 s par défaut ; 29 s ou moins ouvre les 5 morceaux).
const musiqueCfg = cfg.musique === 'auto' ? choisirMusique(nom, cfg.dureeMax ?? 40) : (cfg.musique || null);
const PERIODE = musiqueCfg ? 60 / musiqueCfg.bpm : 0.5;
const maintenant = () => nImages / FPS;
const v = {
  page, appli: cadreApp(), pause: (ms) => attendre(ms),
  S: (nom, ...args) => filmerJusqua(pageBrute.evaluate(([n, a]) => S[n](...a), [nom, args])),
  son: (type, volume = 1) => { if (fige) sons.push({ t: maintenant(), type, volume }); },
  // Le curseur va sur l'élément (la caméra l'accompagne), puis la vraie souris clique au point exact une fois la caméra posée.
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
    await pageBrute.mouse.move(t.x, t.y, { steps: 3 });
    await attendre(66);
    v.son(options.son || 'clic'); await v.S('appui');
    await pageBrute.mouse.down(); await attendre(66); await pageBrute.mouse.up();
    await attendre(166);
  },
  // `rapide` : texte tapé d'un coup (une image), un seul son ; sinon frappe caractère par caractère, touches affichées.
  async saisir(sel, texte, { touches = true, ms, rapide = false } = {}) {
    await v.cliquer(sel, ms ? { ms } : {});
    await pageBrute.keyboard.press('Control+A'); await attendre(100);
    if (rapide) { v.son('touche'); await pageBrute.keyboard.type(texte); await attendre(200); return; }
    for (const c of texte) {
      if (touches) await v.S('touche', c);
      v.son('touche'); await pageBrute.keyboard.type(c); await attendre(150);
    }
  },
  // Ouvre un autre template dans la fenêtre (vidéo d'un pack) ; à faire derrière S('volet') et S('fenetre', false).
  async ouvrir(url, barre) {
    await v.S('changerApp', url, { url: barre }); v.appli = cadreApp();
    // Le guide du premier lancement s'ouvre ~300 ms après le chargement (minuteur de l'application) : on laisse
    // passer jusqu'à 1,5 s de temps, image par image, puis on le ferme.
    for (let i = 0; i < FPS * 1.5; i++) {
      if (await v.appli.$('dialog[open]').catch(() => null)) break;
      if (fige) await image(); else await pageBrute.waitForTimeout(PAS);
    }
    await v.fermerDialogues();
  },
  // Ferme les fenêtres ouvertes au premier lancement (guide « Comment ça marche », etc.), hors caméra.
  async fermerDialogues() {
    for (let i = 0; i < 3; i++) {
      const reste = await v.appli.evaluate(() => {
        const d = document.querySelector('dialog[open]'); if (!d) return false;
        const b = d.querySelector('button[aria-label="Fermer"], button.fermer, [data-action="fermer"]');
        if (b) b.click(); else d.close();
        return true;
      });
      if (!reste) return;
      await attendre(250);
    }
  },
  async valider() { await v.S('touche', 'Entrée ⏎'); v.son('touche'); await pageBrute.keyboard.press('Enter'); await attendre(200); },
  // Attend le prochain temps de la musique (sub = 2 : demi-temps). Les actions tombent ainsi sur le rythme.
  async temps(sub = 1) {
    const p = PERIODE / sub, t = maintenant();
    const suivant = Math.ceil((t + 0.02) / p) * p;
    await attendre(Math.max(0, (suivant - t) * 1000));
  },
  lire: (sel) => v.appli.$eval(sel, (e) => (e.value ?? e.textContent).trim()),
};

// 5. Préparation hors caméra (temps réel), puis horloge figée et enregistrement image par image.
if (scenario.preparer) await scenario.preparer(v);
const tPage = await pageBrute.evaluate(() => Date.now());
await contexte.clock.pauseAt(tPage + 250); // marge : le temps réel continue de s’écouler jusqu’à cet appel
fige = true;
await v.S('rythme', PERIODE * 1000, 0);
try { await scenario.jouer(v); } catch (e) {
  await pageBrute.screenshot({ path: join(SORTIE, `${nom}-erreur.png`) });
  console.error(`Échec du scénario (capture : ${join(SORTIE, `${nom}-erreur.png`)})`); await navigateur.close(); fin(); throw e;
}
await attendre(400);
const duree = nImages / FPS;
await navigateur.close(); fin();
console.log(`Capture : ${nImages} images (${duree.toFixed(1)} s de vidéo à ${FPS} i/s, temps virtuel)`);

// 6. Vidéo : une image tous les 1/30 s, dans l'ordre.
// Diffusion Reels Instagram / LinkedIn : 720 × 1280, encodage en deux passes avec un débit calculé pour tenir
// sous TAILLE_MAX (limite d'envoi automatique vers Google Drive). Capture faite en 1080 × 1920 puis réduite.
const video = join(TMP, 'video.mp4');
encoder({ dossier: IMAGES, duree, sortie: video, largeur: 720, hauteur: 1280, tailleMaxMo: cfg.tailleMaxMo ?? 2.9, audio: !cfg.muet, rapide: brouillon, tmp: TMP });
if (duree > (cfg.dureeMax ?? 40)) console.error(`Attention : ${duree.toFixed(1)} s, au-delà de la durée maximale (${cfg.dureeMax ?? 40} s).`);

// 7. Bruitages synthétisés (ffmpeg), placés aux instants des actions dans la vidéo.
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
// `muet: true` (clip à intégrer au montage d'un tiers) : aucune piste audio, ni bruitage ni musique.
if (cfg.muet) sons.length = 0;
const types = [...new Set(sons.map((s) => s.type))];
for (const t of types) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', SONS[t], '-ar', '48000', '-ac', '1', join(TMP, `son-${t}.wav`)]);
const entrees = [], filtres = [];
sons.forEach((s, i) => {
  entrees.push('-i', join(TMP, `son-${s.type}.wav`));
  filtres.push(`[${i}]adelay=${Math.round(s.t * 1000)}:all=1,volume=${s.volume}[s${i}]`);
});
const musique = !cfg.muet && musiqueCfg && existsSync(resolve(RACINE, musiqueCfg.fichier)) ? resolve(RACINE, musiqueCfg.fichier) : null;
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
// Couverture du reel : image capturée en 1080 × 1920 la plus proche de cfg.affiche (s).
const tAffiche = cfg.affiche ?? 1.5;
const imgAffiche = join(IMAGES, `${String(Math.min(nImages - 1, Math.round(tAffiche * FPS))).padStart(5, '0')}.jpg`);
const couverture = join(SORTIE, `${nom}-couverture.png`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', imgAffiche, couverture]);
writeFileSync(join(SORTIE, `${nom}.json`), JSON.stringify({ nom, video: final, couverture, duree: Number(duree.toFixed(1)),
  taille: statSync(final).size, produit: cfg.produit || null, type: cfg.type || null, titre: cfg.titre || null }, null, 2));
if (!options.includes('--garder')) rmSync(TMP, { recursive: true, force: true });
console.log(`Vidéo : ${final} (${duree.toFixed(1)} s, ${(statSync(final).size / 1e6).toFixed(2)} Mo)`);
