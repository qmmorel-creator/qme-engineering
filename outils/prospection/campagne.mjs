// Outil des campagnes ciblées de prospection (skill .claude/skills/campagne-ciblee-pack/).
//
//   node outils/prospection/campagne.mjs messages <campagne> <prospects.json> [sortie.json]
//        → mails personnalisés (id, email, objet, texte) à partir du modèle outils/prospection/campagnes/<campagne>.mjs
//   node outils/prospection/campagne.mjs apercu <campagne> <prospects.json> [n] [sortie.html]
//        → le n-ième mail tel qu'il partira (signature et mention d'opposition comprises), en HTML local
//   node outils/prospection/campagne.mjs opposition <prospects.json>
//        → vérification par l'API du site (jeton X-Opposition-Token injecté par le proxy) ; code 1 si elle ne répond pas
//   node outils/prospection/campagne.mjs relances <campagne> <prospects.json> <AAAA-MM-JJ> [sortie.json]
//        → relances J+7 (type relance, relanceDe = id du premier mail, pasAvant = date)
//   node outils/prospection/campagne.mjs file <campagne> <messages.json>
//        → mise en file sur le site (jeton X-Prospection-Token injecté par le proxy)
//   node outils/prospection/campagne.mjs etat <campagne> [details]
//
// prospects.json : [{ id, nom, ville, email, fait, ... }] ; id = slug stable (minuscules, chiffres, tirets).
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Le fetch de Node ignore HTTPS_PROXY : sans le proxy, les jetons qu'il injecte (X-Opposition-Token,
// X-Prospection-Token) manquent et l'API répond 401. On relance donc le script avec NODE_USE_ENV_PROXY=1.
if (process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1') {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
}
import { composer } from '../../netlify/lib/prospection.mjs';

const API = 'https://qm-engineering.fr/api';
const [commande, ...args] = process.argv.slice(2);
const lireJson = async (f) => JSON.parse(await readFile(f, 'utf8'));
const modele = (c) => import(new URL(`./campagnes/${c}.mjs`, import.meta.url));

export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function appeler(chemin, corps, entetes = {}) {
  const r = await fetch(`${API}${chemin}`, { method: corps ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...entetes }, body: corps ? JSON.stringify(corps) : undefined });
  const texte = await r.text();
  if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status} ${texte.slice(0, 200)}`);
  return JSON.parse(texte);
}

async function messages(c, fichier) {
  const m = await modele(c);
  return (await lireJson(fichier)).map((p) => ({ id: p.id || slug(`${p.nom}-${p.ville}`), email: p.email.trim().toLowerCase(), objet: m.objet(p), texte: m.texte({ ...p, id: p.id || slug(`${p.nom}-${p.ville}`) }) }));
}

if (commande === 'messages') {
  const [c, f, sortie] = args;
  const liste = await messages(c, f);
  if (sortie) await writeFile(sortie, JSON.stringify(liste, null, 2)); else console.log(JSON.stringify(liste, null, 2));
  console.error(`${liste.length} mails préparés.`);
} else if (commande === 'apercu') {
  const [c, f, n = '0', sortie] = args;
  const m = (await messages(c, f))[Number(n)];
  const final = composer(m);
  if (sortie) await writeFile(sortie, `<!doctype html><meta charset="utf-8"><title>${final.objet}</title><p style="font:13px Arial;color:#555">À : ${m.email}<br>Objet : <b>${final.objet}</b></p><hr>${final.html}`);
  console.log(`À : ${m.email}\nObjet : ${final.objet}\n\n${final.texte}`);
} else if (commande === 'opposition') {
  const emails = (await lireJson(args[0])).map((p) => p.email.trim().toLowerCase());
  let opposes = 0;
  for (let i = 0; i < emails.length; i += 200) {
    const r = await appeler('/compte/opposition/verifier', { emails: emails.slice(i, i + 200) });
    for (const x of r.resultats) if (x.opposition) { opposes++; console.log(`OPPOSÉ ${x.email} (${x.opposition.par})`); }
  }
  console.log(`${emails.length} adresses vérifiées, ${opposes} opposée(s).`);
} else if (commande === 'relances') {
  const [c, f, jour, sortie] = args;
  const m = await modele(c);
  const liste = (await lireJson(f)).map((p) => ({ id: `${p.id}-r`, type: 'relance', relanceDe: p.id, pasAvant: jour, email: p.email.trim().toLowerCase(), objet: m.objet(p), texte: m.relance(p) }));
  if (sortie) await writeFile(sortie, JSON.stringify(liste, null, 2)); else console.log(JSON.stringify(liste, null, 2));
} else if (commande === 'file') {
  const [c, f] = args;
  const liste = await lireJson(f);
  for (let i = 0; i < liste.length; i += 200) console.log(JSON.stringify(await appeler('/prospection/file', { campagne: c, messages: liste.slice(i, i + 200) })));
} else if (commande === 'etat') {
  const [c, details] = args;
  console.log(JSON.stringify(await appeler(c ? `/prospection/campagne?c=${c}${details ? '&details=1' : ''}` : '/prospection'), null, 2));
} else {
  console.error('Commandes : messages, apercu, opposition, relances, file, etat (voir l\'en-tête du fichier).');
  process.exit(1);
}
