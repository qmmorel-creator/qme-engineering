// Voix des vidéos « écran » (ecran.mjs) : texte minuté pour ElevenLabs, puis calage de la voix reçue sur les actions,
// traitement façon micro de téléphone, ambiance (ville, bureau ou fichier) et niveau final.
//
//   node docs/videos/voix.mjs texte <scenario.mjs>
//       → tableau minuté + texte à coller dans ElevenLabs (balises <break>), écrit dans sortie/<nom>-voix.md
//   node docs/videos/voix.mjs mixer <scenario.mjs> <voix.mp3> [--ambiance ville|bureau|aucune|<fichier>]
//                                   [--micro telephone|propre] [--ecart 6] [--debut-ambiance 0]
//       → sortie/<nom>-voix.mp4 (vidéo + voix calée + ambiance, -14 LUFS)
//
// Le scénario exporte `voix = [{ a: '<repère>', decalage: 0.1, texte: '…' }, …]` (une ligne par phrase, dans l'ordre) ;
// les repères viennent de sortie/<nom>.json (v.repere pendant le tournage).
// Calage : la voix est découpée à ses silences, regroupés en autant de morceaux que de lignes (coupures aux plus longs
// silences), et chaque morceau démarre sur son repère. ElevenLabs ne respecte pas toujours les pauses : c'est prévu.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AUDIO_KBPS } from './rendu.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, 'sortie');
const [commande, cheminScenario, ...reste] = process.argv.slice(2);
const opt = (nom, def) => { const i = reste.indexOf(`--${nom}`); return i >= 0 ? reste[i + 1] : def; };
if (!['texte', 'mixer'].includes(commande) || !cheminScenario) {
  console.error('Usage : node docs/videos/voix.mjs texte <scenario.mjs>\n        node docs/videos/voix.mjs mixer <scenario.mjs> <voix.mp3> [--ambiance ville|bureau|aucune|<fichier>] [--micro telephone|propre] [--ecart 6] [--debut-ambiance 0]');
  process.exit(1);
}
const scenario = await import(pathToFileURL(resolve(cheminScenario)));
const cfg = scenario.config;
const nom = cfg.nom || basename(cheminScenario, '.mjs');
const infos = JSON.parse(readFileSync(join(SORTIE, `${nom}.json`), 'utf8'));
const D = infos.duree;
const lignes = (scenario.voix || []).map((l) => {
  if (!(l.a in infos.reperes)) throw new Error(`Repère inconnu « ${l.a} » (repères : ${Object.keys(infos.reperes).join(', ')})`);
  return { ...l, debut: Number((infos.reperes[l.a] + (l.decalage || 0)).toFixed(2)) };
});
if (!lignes.length) throw new Error('Le scénario n\'exporte pas de `voix`.');
const s2 = (x) => x.toFixed(2).replace('.', ',');

// ---------- Texte minuté ----------
// Débit de narration française : ~14 caractères parlés par seconde (mesuré sur les voix ElevenLabs du 20/11/2026).
const estimer = (t) => t.replace(/[^\p{L}\p{N}]/gu, '').length / 14 + (t.match(/[,;:…]/g) || []).length * 0.15;
if (commande === 'texte') {
  let md = `# Voix · ${nom}\n\nVidéo de ${s2(D)} s. Chaque phrase démarre sur son repère ; « fenêtre » = temps disponible avant la suivante.\n\n`;
  md += '| Début | Repère | Phrase | Durée estimée | Fenêtre |\n|---|---|---|---|---|\n';
  let el = '';
  lignes.forEach((l, i) => {
    const fin = i + 1 < lignes.length ? lignes[i + 1].debut : D - 0.3;
    const est = estimer(l.texte), fenetre = fin - l.debut;
    md += `| ${s2(l.debut)} s | ${l.a} | ${l.texte} | ${s2(est)} s | ${s2(fenetre)} s${est > fenetre ? ' ⚠ trop long' : ''} |\n`;
    const avant = i === 0 ? l.debut : l.debut - (lignes[i - 1].debut + estimer(lignes[i - 1].texte));
    // Toujours une pause entre deux phrases (0,3 s au moins) : le calage découpe la voix à ses silences.
    el += `${i === 0 && avant < 0.1 ? '' : `<break time="${Math.min(3, Math.max(0.3, avant)).toFixed(1)}s" />`}${l.texte} `;
  });
  md += `\n## Texte à coller dans ElevenLabs\n\n\`\`\`\n${el.trim()}\n\`\`\`\n\nNombres en lettres. Stabilité 30 à 40 %. Une voix générée trop courte n'est pas un problème : \`voix.mjs mixer\` recale chaque phrase sur son repère.\n`;
  const f = join(SORTIE, `${nom}-voix.md`);
  writeFileSync(f, md);
  console.log(md); console.log(`Écrit : ${f}`);
  const trop = lignes.filter((l, i) => estimer(l.texte) > (i + 1 < lignes.length ? lignes[i + 1].debut : D - 0.3) - l.debut);
  if (trop.length) console.error(`Attention : ${trop.length} phrase(s) plus longue(s) que leur fenêtre : raccourcir le texte ou allonger les pauses du scénario.`);
  process.exit(0);
}

// ---------- Mixage ----------
const fichierVoix = resolve(reste[0] || '');
if (!existsSync(fichierVoix)) throw new Error(`Voix introuvable : ${reste[0]}`);
const ambiance = opt('ambiance', cfg.ambiance || 'aucune');
const micro = opt('micro', cfg.micro || 'telephone');
const ecart = Number(opt('ecart', cfg.ecartAmbiance ?? 6)); // 6 LU : ambiance 10 à 14 dB sous la voix dans les blancs (mesuré le 20/11/2026) ; baisser pour la rendre plus présente
const TMP = join(SORTIE, `.voix-${nom}`); rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', '-nostdin', ...args]);
const stderr = (args) => spawnSync('ffmpeg', ['-v', 'info', '-nostdin', ...args, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64e6 }).stderr || '';
const lufs = (f) => Number([...stderr(['-i', f, '-af', 'ebur128']).matchAll(/I:\s+(-?[0-9.]+) LUFS/g)].pop()?.[1] ?? -70);
const dureeFichier = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// 1. Morceaux parlés de la voix (silences de plus de 0,2 s sous -35 dB), regroupés en autant de morceaux que de lignes.
const dv = dureeFichier(fichierVoix);
const sil = [...stderr(['-i', fichierVoix, '-af', 'silencedetect=n=-35dB:d=0.2']).matchAll(/silence_(start|end): ([0-9.]+)/g)].map((m) => [m[1], Number(m[2])]);
let morceaux = [], t0 = 0;
for (const [k, t] of sil) { if (k === 'start') { if (t - t0 > 0.05) morceaux.push([t0, t]); } else t0 = t; }
if ((!sil.length || sil.at(-1)[0] === 'end') && dv - t0 > 0.05) morceaux.push([t0, dv]); // voix qui finit sans silence
if (morceaux.length < lignes.length) throw new Error(`La voix a ${morceaux.length} morceau(x) séparés par un silence, pour ${lignes.length} phrases : la régénérer avec des pauses (<break>) entre les phrases.`);
// Regroupement : découpage dont les durées collent le mieux aux durées estimées des phrases (écart relatif au carré),
// un silence long à la coupure étant favorisé. Une pause interne (« euros. Ah oui… ») peut être plus longue qu'une pause
// entre deux phrases : la seule longueur des silences ne suffit pas (cas du 20/11/2026).
{
  const m = morceaux.length, N = lignes.length, est = lignes.map((l) => estimer(l.texte));
  const cout = Array.from({ length: N + 1 }, () => Array(m + 1).fill(Infinity)), prec = Array.from({ length: N + 1 }, () => Array(m + 1).fill(-1));
  cout[0][0] = 0;
  for (let i = 1; i <= N; i++) for (let j = i; j <= m - (N - i); j++) for (let k = i - 1; k < j; k++) {
    if (cout[i - 1][k] === Infinity) continue;
    const duree = morceaux[j - 1][1] - morceaux[k][0], ecartRel = (duree - est[i - 1]) / est[i - 1];
    const silence = j < m ? morceaux[j][0] - morceaux[j - 1][1] : 0.5;
    const c = cout[i - 1][k] + ecartRel * ecartRel - 0.6 * Math.min(silence, 0.8);
    if (c < cout[i][j]) { cout[i][j] = c; prec[i][j] = k; }
  }
  const groupes = []; for (let i = N, j = m; i > 0; j = prec[i][j], i--) groupes.unshift([morceaux[prec[i][j]][0], morceaux[j - 1][1]]);
  morceaux = groupes;
}
// 2. Placement : chaque morceau sur son repère, jamais avant la fin du précédent.
let fin = 0;
const places = morceaux.map(([a, b], i) => { const d = Math.max(lignes[i].debut, fin + 0.08); fin = d + (b - a); return { a, b, d, f: fin, texte: lignes[i].texte, retard: d - lignes[i].debut }; });
console.log('Calage de la voix (vérifier à l\'écoute que chaque morceau correspond à sa phrase) :');
for (const p of places) console.log(`  ${s2(p.d)} → ${s2(p.f)} s  [voix ${s2(p.a)}–${s2(p.b)}]  ${p.texte}${p.retard > 0.4 ? `  (décalé de ${s2(p.retard)} s : phrase précédente trop longue)` : ''}`);
if (fin > D) console.error(`Attention : la voix finit à ${s2(fin)} s, après la fin de la vidéo (${s2(D)} s).`);

// 3. Voix calée, avec le traitement du micro. Téléphone : bande 200 Hz – 7 kHz, creux de bas-médium, présence,
// compression type contrôle de gain automatique, légère saturation, réflexions courtes.
const MICROS = {
  telephone: 'highpass=f=200:p=2,lowpass=f=7000:p=2,equalizer=f=450:t=q:w=1.2:g=-3,equalizer=f=1200:t=q:w=1:g=3,equalizer=f=2600:t=q:w=1.4:g=4,'
    + 'acompressor=threshold=0.08:ratio=6:attack=5:release=120:makeup=2.5,asoftclip=type=tanh:param=1.6,aecho=0.85:0.25:38|71:0.18|0.10',
  propre: 'highpass=f=90',
};
if (!MICROS[micro]) throw new Error(`Micro inconnu : ${micro} (telephone | propre)`);
const fv = places.map((p, i) => `[0]atrim=${p.a}:${p.b},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${Math.max(0, p.b - p.a - 0.03).toFixed(3)}:d=0.03,adelay=${Math.round(p.d * 1000)}:all=1[s${i}]`);
const voixCalee = join(TMP, 'voix.wav');
ff(['-i', fichierVoix, '-filter_complex', `${fv.join(';')};${places.map((_, i) => `[s${i}]`).join('')}amix=inputs=${places.length}:normalize=0,apad,atrim=0:${D},aresample=48000,${MICROS[micro]}`, '-ac', '1', voixCalee]);

// 4. Ambiance (stéréo, durée de la vidéo).
const ambWav = join(TMP, 'ambiance.wav');
const blancs = places.map((p, i) => [p.f, i + 1 < places.length ? places[i + 1].d : D]).filter(([a, b]) => b - a > 0.8);
if (ambiance === 'ville') villeSynthetique(ambWav, D, blancs);
else if (ambiance !== 'aucune') {
  const f = ambiance === 'bureau' ? join(ICI, 'ambiances/bureau.mp3') : resolve(ambiance);
  if (!existsSync(f)) throw new Error(`Ambiance introuvable : ${f}`);
  // `--debut-ambiance` (s) : point de départ dans le fichier (choisir un passage régulier, sans coup de tonnerre sous la voix).
  ff(['-stream_loop', '-1', '-ss', String(opt('debut-ambiance', cfg.debutAmbiance ?? 0)), '-i', f, '-af', `atrim=0:${D},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, D - 1)}:d=1`, '-ac', '2', '-t', String(D), ambWav]);
}

// 5. Mixage : ambiance `ecart` LU sous la voix, baissée sous la voix (compression par la voix), gain fixe vers -14 LUFS
// (pas de loudnorm dynamique : il remonterait l'ambiance dans les blancs), limiteur.
const melange = join(TMP, 'melange.wav');
if (ambiance === 'aucune') ff(['-i', voixCalee, '-af', 'pan=stereo|c0=c0|c1=c0', melange]);
else {
  const gain = (lufs(voixCalee) - ecart) - lufs(ambWav);
  ff(['-i', voixCalee, '-i', ambWav, '-filter_complex',
    `[0]pan=stereo|c0=c0|c1=c0,asplit[v][vc];[1]volume=${gain.toFixed(2)}dB[a];[a][vc]sidechaincompress=threshold=0.03:ratio=2.5:attack=50:release=450[ad];[v][ad]amix=inputs=2:normalize=0`, melange]);
}
const final = join(TMP, 'final.wav');
ff(['-i', melange, '-af', `volume=${(-14 - lufs(melange)).toFixed(2)}dB,alimiter=limit=0.84:level=false`, '-ar', '48000', final]);
const sortie = join(SORTIE, `${nom}-voix.mp4`);
ff(['-i', infos.video, '-i', final, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-shortest', '-movflags', '+faststart', sortie]);
const pistes = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', sortie]).toString();
if (!pistes.includes('audio')) throw new Error('Aucune piste audio dans la sortie.');
const taille = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=size', '-of', 'csv=p=0', sortie]).toString());
console.log(`Vidéo : ${sortie} (${s2(D)} s, ${(taille / 1e6).toFixed(2)} Mo, ${lufs(sortie).toFixed(1)} LUFS, ambiance ${ambiance}, micro ${micro})`);
if (taille > 2.9e6) console.error('Attention : plus de 2,9 Mo, trop lourd pour le connecteur Google Drive (réencoder avec config.tailleMaxMo plus bas).');
rmSync(TMP, { recursive: true, force: true });

// Ville synthétisée (aucun fichier extérieur) : circulation, rumeur, passants, voitures, scooter, sirène lointaine,
// bus, et des klaxons placés dans les blancs de la voix.
function villeSynthetique(sortieWav, D, blancs) {
  const dir = join(TMP, 'ville'); mkdirSync(dir);
  const SR = 48000, f = (n) => join(dir, `${n}.wav`), pistes = [];
  const lav = (n, src, af) => { ff(['-f', 'lavfi', '-i', src, ...(af ? ['-af', af] : []), '-ar', String(SR), '-ac', '1', f(n)]); pistes.push(f(n)); };
  lav('trafic', `anoisesrc=d=${D}:c=brown:a=0.9:r=${SR}`, "lowpass=f=380,highpass=f=35,volume='0.55+0.25*sin(2*PI*0.11*t)+0.1*sin(2*PI*0.37*t)':eval=frame,volume=0.9");
  lav('rumeur', `anoisesrc=d=${D}:c=pink:a=0.25:r=${SR}:seed=3`, "bandpass=f=1400:w=2200,volume='0.3+0.12*sin(2*PI*0.23*t)':eval=frame");
  [51, 52, 53, 54].forEach((s) => lav(`passants${s}`, `anoisesrc=d=${D}:c=pink:a=0.6:r=${SR}:seed=${s}`, `bandpass=f=${400 + s * 12}:w=500,volume='0.18*(0.5+0.5*sin(2*PI*(3.1+0.${s})*t+${s}))*(0.6+0.4*sin(2*PI*0.2*t+${s}))':eval=frame`));
  const voitures = [[0.06, 3.2, 1800], [0.24, 2.8, 2000], [0.36, 3.0, 1700], [0.44, 2.6, 2400], [0.58, 2.4, 2600], [0.77, 3.6, 1500], [0.89, 3.0, 1900]];
  voitures.forEach(([p, d, lp], i) => lav(`voiture${i}`, `anoisesrc=d=${d}:c=pink:a=0.9:r=${SR}:seed=${11 + i * 6}`, `lowpass=f=${lp},highpass=f=60,volume='exp(-pow((t-${d / 2})/(${d / 5}),2))':eval=frame,adelay=${Math.round(p * D * 1000)}:all=1,volume=0.9`));
  lav('scooter', `aevalsrc='0.5*(2*mod((88-30*t/2.4)*t,1)-1)*(1+0.3*sin(2*PI*31*t))*exp(-pow((t-1.1)/0.55,2))':d=2.4:s=${SR}`, `lowpass=f=1600,highpass=f=70,adelay=${Math.round(0.19 * D * 1000)}:all=1,volume=0.55`);
  lav('sirene', `aevalsrc='0.3*sin(2*PI*(if(lt(mod(t,1.0),0.5),435,488))*t)':d=${D}:s=${SR}`, `lowpass=f=1500,aecho=0.8:0.5:240:0.35,volume='0.22*exp(-pow((t-${(D * 0.58).toFixed(2)})/4.5,2))':eval=frame`);
  lav('bus', `anoisesrc=d=1.6:c=white:a=0.5:r=${SR}:seed=5`, `highpass=f=2500,lowpass=f=9000,volume='min(1,t*6)*exp(-1.6*t)':eval=frame,adelay=${Math.round(0.6 * D * 1000)}:all=1,volume=0.5`);
  // Klaxons : un par blanc de la voix (au plus six), hauteurs et distances variées ; un lointain au début.
  const types = [[440, 0.22, 2, 0.55, 1800], [392, 0.14, 3, 0.6, 2200], [466, 0.7, 1, 0.7, 2600], [349, 0.18, 2, 0.3, 1000], [330, 0.55, 1, 0.35, 1100], [415, 0.25, 2, 0.45, 1600]];
  const klaxons = [[Math.min(2, D * 0.1), [370, 0.3, 1, 0.18, 900]], ...blancs.slice(0, 6).map(([a], i) => [a + 0.2, types[i]])];
  klaxons.forEach(([t, [hz, coup, nb, vol, lp]], i) => {
    const long = nb * (coup + 0.09);
    lav(`klaxon${i}`, `aevalsrc='0.4*(sgn(sin(2*PI*${hz}*t))+0.6*sgn(sin(2*PI*${hz * 0.84}*t)))*lt(mod(t,${coup + 0.09}),${coup})*lt(t,${long})':d=${long + 0.3}:s=${SR}`,
      `lowpass=f=${lp},highpass=f=150,aecho=0.7:0.35:90|170:0.3|0.15,afade=t=out:st=${long}:d=0.2,adelay=${Math.round(t * 1000)}:all=1,volume=${vol}`);
  });
  ff([...pistes.flatMap((p) => ['-i', p]), '-filter_complex', `${pistes.map((_, i) => `[${i}]`).join('')}amix=inputs=${pistes.length}:normalize=0:duration=longest,atrim=0:${D},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, D - 1)}:d=1,alimiter=limit=0.9,pan=stereo|c0=c0|c1=c0`, '-ar', String(SR), sortieWav]);
}
