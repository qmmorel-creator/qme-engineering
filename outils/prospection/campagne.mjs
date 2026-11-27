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
//   node outils/prospection/campagne.mjs doublons <prospects.json> [sortie.json]
//        → écarte les adresses et domaines déjà vus dans toute campagne de la file ou dans le dépôt, et les doublons du lot
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

// Domaine d'entreprise d'une adresse ; null pour une messagerie grand public (comparée alors à l'adresse entière).
const WEBMAILS = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|orange|wanadoo|free|sfr|neuf|laposte|bbox|aol|icloud|me|gmx|numericable|club-internet|proton|protonmail)\.[a-z.]+$/;
export const domaineDe = (email) => { const d = String(email || '').split('@')[1]?.toLowerCase(); return d && !WEBMAILS.test(d) ? d : null; };

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
  for (let i = 0; i < liste.length; i += 25) console.log(JSON.stringify(await appeler("/prospection/file", { campagne: c, messages: liste.slice(i, i + 25) })));
} else if (commande === 'doublons') {
  // Aucun doublon entre campagnes (décision de Quentin du 27/11/2026) : la file du site ne bloque une adresse que dans
  // sa propre campagne. Ce contrôle écarte toute adresse, et tout domaine d'entreprise, déjà vu dans une campagne de la
  // file (en attente ou traité) ou cité dans le dépôt (anciennes vagues, archives, journaux, concepts), et les
  // doublons internes au lot. Restent à faire par la session : Nexora (list_qme query = nom) et Gmail (in:anywhere <domaine>).
  const [f, sortie] = args;
  const lot = await lireJson(f);
  const vus = { email: new Map(), domaine: new Map() };
  const noter = (email, origine) => {
    const e = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return;
    if (!vus.email.has(e)) vus.email.set(e, origine);
    const d = domaineDe(e);
    if (d && !vus.domaine.has(d)) vus.domaine.set(d, origine);
  };
  const etat = await appeler('/prospection');
  for (const c of etat.campagnes || []) {
    const d = await appeler(`/prospection/campagne?c=${encodeURIComponent(c.id)}&details=1`);
    for (const m of [...(d.file || []), ...(d.faits || [])]) noter(m.email, `campagne ${c.id} (${m.statut || 'en file'})`);
  }
  const { execFileSync } = await import('node:child_process');
  const racine = new URL('../../', import.meta.url).pathname;
  const sortieGrep = execFileSync('git', ['-C', racine, 'grep', '-hoIE', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '--', 'docs', 'outils', 'concepts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const e of sortieGrep.split('\n')) if (!/qm-engineering\.fr$/i.test(e)) noter(e, 'dépôt (docs, outils, concepts)');
  const sites = execFileSync('git', ['-C', racine, 'grep', '-hoIE', 'https?://(www\\.)?[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '--', 'docs/prospection', 'outils/prospection', 'concepts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const u of sites.split('\n')) { const d = u.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase(); if (d && !/qm-engineering\.fr$/.test(d) && !vus.domaine.has(d)) vus.domaine.set(d, 'dépôt (site cité)'); }
  const retenus = [], ecartes = [], dansLot = new Map();
  for (const p of lot) {
    const e = String(p.email || '').trim().toLowerCase();
    const d = domaineDe(e);
    const ds = String(p.site || '').replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase();
    const raison = vus.email.get(e) ? `adresse déjà vue : ${vus.email.get(e)}`
      : d && vus.domaine.get(d) ? `domaine ${d} déjà vu : ${vus.domaine.get(d)}`
        : ds && vus.domaine.get(ds) ? `site ${ds} déjà vu : ${vus.domaine.get(ds)}`
          : dansLot.get(e) || (d && dansLot.get(d)) || (ds && dansLot.get(ds)) ? `doublon dans le lot (${dansLot.get(e) || dansLot.get(d) || dansLot.get(ds)})` : null;
    if (raison) { ecartes.push({ id: p.id, nom: p.nom, email: e, raison }); continue; }
    dansLot.set(e, p.id); if (d) dansLot.set(d, p.id); if (ds) dansLot.set(ds, p.id);
    retenus.push({ ...p, aVerifier: { nexora: `list_qme domain=prospects query="${p.nom}"`, gmail: `in:anywhere ${d || ds || e}` } });
  }
  if (sortie) await writeFile(sortie, JSON.stringify(retenus, null, 2));
  console.log(JSON.stringify({ retenus: retenus.length, ecartes }, null, 2));
  console.error(`${retenus.length} retenus, ${ecartes.length} écartés (référence : ${vus.email.size} adresses, ${vus.domaine.size} domaines). Reste à vérifier pour chaque retenu : Nexora (nom) et Gmail (domaine).`);
} else if (commande === 'etat') {
  const [c, details] = args;
  console.log(JSON.stringify(await appeler(c ? `/prospection/campagne?c=${c}${details ? '&details=1' : ''}` : '/prospection'), null, 2));
} else {
  console.error('Commandes : messages, apercu, opposition, relances, file, etat (voir l\'en-tête du fichier).');
  process.exit(1);
}
