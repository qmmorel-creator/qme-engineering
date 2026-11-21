// Compteur réseaux QME (/admin/compteur/) : renvoie les onglets du Sheet « Mesures réseaux QME », lus par sa
// publication web en CSV, à qui donne le mot de passe. Sans dépendance à Netlify : la lecture HTTP est injectée.
//
// Variables Netlify :
// - COMPTEUR_MOT_DE_PASSE : mot de passe simple partagé (6 caractères au moins), saisi sur la page.
// - COMPTEUR_SHEET_PUB : adresse de publication web du Sheet, de la forme
//   https://docs.google.com/spreadsheets/d/e/2PACX-…/pub (Fichier > Partager > Publier sur le Web).
import { timingSafeEqual, createHash } from 'node:crypto';
import { PRODUITS, statEssai } from './templates-acces.mjs';

// Onglets du Sheet 1578z4XTYuN-_85VdCrjJYLX9hEDlRpnmZZP5gTfNMik (identifiants « gid »).
export const ONGLETS = {
  publications: 1450548824,
  historique: 783077974,
  abonnes: 540567426,
  gumroad_produits: 1412341743,
  gumroad_sources: 375719535,
  gumroad_jours: 1531113938,
  gumroad_ventes: 1203235184,
};

// Comparaison à temps constant, quelle que soit la longueur saisie.
const empreinte = (t) => createHash('sha256').update(String(t)).digest();
export function motDePasseValide(saisie, attendu) {
  if (!attendu || String(attendu).length < 6 || !saisie) return false;
  return timingSafeEqual(empreinte(String(saisie).trim()), empreinte(String(attendu).trim()));
}

// CSV (RFC 4180) → tableau de lignes, chaque ligne un tableau de cellules texte.
export function lireCsv(texte) {
  const lignes = [];
  let ligne = [], cellule = '', guillemets = false;
  const t = String(texte).replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"') { if (t[i + 1] === '"') { cellule += '"'; i++; } else guillemets = false; }
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === ',') { ligne.push(cellule); cellule = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = '';
    } else cellule += c;
  }
  if (cellule !== '' || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  // Lignes entièrement vides (fin du tableau) retirées.
  return lignes.filter((l) => l.some((x) => x !== ''));
}

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});

// Adresse de publication web, sous l'une des formes données par Google (…/pub, …/pubhtml, …/pub?output=csv,
// …/pubhtml?gid=…&single=true, avec ou sans espaces) → https://docs.google.com/spreadsheets/d/e/<id>/pub.
export function adressePublication(texte) {
  const t = String(texte || '').trim();
  const m = /docs\.google\.com\/spreadsheets\/d\/e\/([A-Za-z0-9_-]{20,})/.exec(t);
  if (m) return { ok: true, base: `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub` };
  if (/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+/.test(t)) {
    return { ok: false, erreur: "COMPTEUR_SHEET_PUB contient l'adresse d'édition du Sheet. Publie-le (Fichier > Partager > Publier sur le Web) et colle l'adresse donnée par Google, qui contient « /d/e/ »." };
  }
  return { ok: false, erreur: "COMPTEUR_SHEET_PUB n'est pas une adresse de publication Google Sheets (elle doit contenir « docs.google.com/spreadsheets/d/e/ »)." };
}

// Essais gratuits, anonymes : traces stat/<id> (permanentes) et essais en cours sans trace. Tableau façon CSV,
// sans e-mail ni prénom : Template, Code produit, Créé le, Acheté le, Test.
export async function lireEssaisAnonymes(essais) {
  const traces = [];
  const vus = new Set();
  for (const cle of await essais.lister('stat/')) { const s = await essais.get(cle); if (s?.id) { traces.push(s); vus.add(s.id); } }
  for (const cle of await essais.lister('essai/')) { const r = await essais.get(cle); if (r?.id && !vus.has(r.id)) traces.push(statEssai(r)); }
  traces.sort((a, b) => String(a.cree).localeCompare(String(b.cree)));
  return [['Template', 'Produit', 'Créé le', 'Acheté le', 'Test'],
    ...traces.map((t) => [PRODUITS[t.produit]?.nom || String(t.produit || ''), String(t.produit || ''), String(t.cree || ''), t.achete ? String(t.achete) : '', t.test ? 'TRUE' : 'FALSE'])];
}

export async function traiterCompteur(requete, { motDePasse, base, essais = null, recuperer = fetch, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), maintenant = () => new Date() }) {
  if (requete.method !== 'GET') return json(405, { erreur: 'Méthode non permise.' });
  if (!motDePasse || String(motDePasse).length < 6 || !base) return json(503, { erreur: 'Compteur non configuré sur Netlify (mot de passe ou adresse du Sheet).' });
  if (!motDePasseValide(requete.headers.get('x-mot-de-passe'), motDePasse)) {
    await attendre(700); // freine les essais en série
    return json(401, { erreur: 'Mot de passe incorrect.' });
  }
  const adresse = adressePublication(base);
  if (!adresse.ok) return json(503, { erreur: adresse.erreur });
  base = adresse.base;
  const onglets = {}, erreurs = {};
  await Promise.all(Object.entries(ONGLETS).map(async ([nom, gid]) => {
    try {
      const r = await recuperer(`${base}?gid=${gid}&single=true&output=csv`, { redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const texte = await r.text();
      if (/^\s*</.test(texte)) throw new Error('onglet non publié');
      onglets[nom] = lireCsv(texte);
    } catch (e) {
      erreurs[nom] = String(e.message || e);
    }
  }));
  if (essais) {
    try { onglets.essais = await lireEssaisAnonymes(essais); }
    catch (e) { erreurs.essais = String(e.message || e); }
  }
  return json(200, { lu: maintenant().toISOString(), onglets, erreurs });
}
