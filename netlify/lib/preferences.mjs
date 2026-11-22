// Registre des préférences d'information des acheteurs et testeurs (demande de Quentin, 22/11/2026).
//
// Liste d'opposition : opposition/<empreinte de l'adresse> → { email, date, source }. Alimentée par le lien « Ne plus
// recevoir les informations » des annonces (/api/compte/stop) et par le lien de désinscription des e-mails d'essai
// (/api/essai/desinscription). Effet : fiche « nouveautés » (contact/…) effacée, compte marqué sansAnnonces, et plus
// aucune annonce (comptes.mjs exclut ces adresses). Un nouveau consentement explicite (case « nouveautés » cochée lors
// d'un nouvel essai) lève l'opposition. Conservation : 3 ans après la désinscription (purgerComptes), le temps
// nécessaire pour respecter le refus.
//
// Registre (administrateur : GET /api/compte/registre, page /admin/registre/) : une ligne par adresse connue
// (acheteur, testeur ou les deux), calculée à partir des comptes, des essais, des contacts « nouveautés », de la
// liste d'opposition et des annonces envoyées. Aucune donnée en plus : c'est une vue.
//
// Prospection (règle absolue, docs/templates/communication/REGLES-PROSPECTION.md) : tout e-mail de prospection porte
// le lien « Ne plus recevoir les informations » (/ne-plus-recevoir/?email=…, qui écrit ici) ; avant tout envoi,
// l'adresse est vérifiée (oppositionDe : adresse ou domaine). Domaines exclus : opposition-domaine/<domaine>.
import { cleEmail } from './templates-acces.mjs';

export const CONSERVATION_OPPOSITION_JOURS = 3 * 365;

// Refus d'information : enregistré, puis appliqué partout. Renvoie l'adresse concernée ('' si inconnue).
// email : adresse donnée par la personne (page /ne-plus-recevoir/, prospect inconnu des comptes et essais).
export async function enregistrerOpposition(store, h, { source, date, email: donnee = '' }) {
  const [contact, compte, deja] = await Promise.all([store.get(`contact/${h}`), store.get(`compte/${h}`), store.get(`opposition/${h}`)]);
  const email = contact?.email || compte?.email || deja?.email || String(donnee).trim().toLowerCase();
  await store.set(`opposition/${h}`, { email, date: deja?.date || date, source: deja?.source || source });
  if (contact) await store.supprimer(`contact/${h}`);
  if (compte && !compte.sansAnnonces) await store.set(`compte/${h}`, { ...compte, sansAnnonces: date });
  return email;
}

// Nouveau consentement explicite : l'opposition est levée, y compris la marque posée sur le compte.
export async function leverOpposition(store, h) {
  if (await store.get(`opposition/${h}`)) await store.supprimer(`opposition/${h}`);
  const compte = await store.get(`compte/${h}`);
  if (compte?.sansAnnonces) { const { sansAnnonces, ...reste } = compte; await store.set(`compte/${h}`, reste); } // eslint-disable-line no-unused-vars
}

// Domaine entier exclu (réponse hostile d'une organisation, liste docs/prospection/desinscrits.md).
export const nettoyerDomaine = (d) => { const x = String(d || '').trim().toLowerCase().replace(/^@/, ''); return /^[a-z0-9.-]+\.[a-z]{2,24}$/.test(x) ? x : ''; };
export async function enregistrerDomaine(store, domaine, { source, date }) {
  const d = nettoyerDomaine(domaine);
  if (!d) return '';
  if (!(await store.get(`opposition-domaine/${d}`))) await store.set(`opposition-domaine/${d}`, { domaine: d, date, source });
  return d;
}

// Opposition d'une adresse : par l'adresse elle-même, ou par son domaine. Renvoie null ou { par, date, source }.
export async function oppositionDe(store, secret, email) {
  const e = String(email || '').trim().toLowerCase();
  const o = await store.get(`opposition/${cleEmail(secret, e)}`);
  if (o) return { par: 'adresse', date: o.date, source: o.source };
  const d = await store.get(`opposition-domaine/${e.split('@')[1] || ''}`);
  return d ? { par: 'domaine', domaine: d.domaine, date: d.date, source: d.source } : null;
}
export async function domainesOpposes(store) {
  return new Set((await store.lister('opposition-domaine/')).map((k) => k.slice('opposition-domaine/'.length)));
}

export async function lireRegistre({ secret, store }) {
  const lignes = new Map();
  const ligne = (email) => {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    const h = cleEmail(secret, e);
    if (!lignes.has(h)) lignes.set(h, { h, email: e, prenom: '', achats: [], essais: [], nouveautes: null, opposition: null, annonces: [], compte: false });
    return lignes.get(h);
  };
  const lire = async (prefixe) => Promise.all((await store.lister(prefixe)).map(async (k) => [k, await store.get(k)]));
  for (const [, c] of await lire('compte/')) {
    const l = ligne(c?.email); if (!l) continue;
    l.prenom ||= c.prenom || '';
    l.compte = true;
    l.achats.push(...(c.cles || []).filter((k) => k.source === 'achat').map((k) => k.p));
    if (c.sansAnnonces && !l.opposition) l.opposition = { date: c.sansAnnonces, source: 'compte' };
  }
  for (const [, r] of await lire('essai/')) {
    const l = ligne(r?.email); if (!l) continue;
    l.prenom ||= r.prenom || '';
    if (!l.essais.includes(r.produit)) l.essais.push(r.produit);
  }
  for (const [, c] of await lire('contact/')) {
    const l = ligne(c?.email); if (!l) continue;
    l.prenom ||= c.prenom || '';
    l.nouveautes = c.consenti || c.maj || true;
  }
  for (const [k, o] of await lire('opposition/')) {
    const l = o?.email ? ligne(o.email) : lignes.get(k.slice('opposition/'.length));
    if (l) l.opposition = { date: o.date, source: o.source };
  }
  for (const [k, a] of await lire('annonce/')) {
    const [, campagne, h] = k.split('/');
    const l = lignes.get(h);
    if (l) l.annonces.push({ campagne, date: a?.date || null, type: a?.type || '' });
  }
  const domaines = await domainesOpposes(store);
  return [...lignes.values()].map((l) => {
    const acheteur = l.achats.length > 0, testeur = l.essais.length > 0 || Boolean(l.nouveautes);
    const parDomaine = !l.opposition && domaines.has(l.email.split('@')[1]);
    if (parDomaine) l.opposition = { date: null, source: `domaine ${l.email.split('@')[1]} exclu` };
    // Information : « abonné » si une annonce peut lui être envoyée (acheteur, ou testeur inscrit aux nouveautés).
    const informations = l.opposition ? 'désinscrit' : (acheteur || l.nouveautes) ? 'abonné' : 'non inscrit';
    const derniere = l.annonces.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
    return {
      email: l.email, prenom: l.prenom,
      profil: acheteur && testeur ? 'acheteur et testeur' : acheteur ? 'acheteur' : testeur ? 'testeur' : l.compte ? 'compte sans achat' : 'prospect',
      achats: [...new Set(l.achats)], essais: l.essais,
      nouveautes: l.nouveautes && !l.opposition ? (typeof l.nouveautes === 'string' ? l.nouveautes : 'oui') : null,
      informations, desinscritLe: l.opposition?.date || null, sourceDesinscription: l.opposition?.source || null,
      derniereAnnonce: derniere,
    };
  }).concat(await Promise.all([...domaines].map(async (d) => {
    const o = await store.get(`opposition-domaine/${d}`);
    return { email: `*@${d}`, prenom: '', profil: 'domaine', achats: [], essais: [], nouveautes: null, informations: 'désinscrit',
      desinscritLe: o?.date || null, sourceDesinscription: o?.source || null, derniereAnnonce: null };
  }))).sort((a, b) => a.email.localeCompare(b.email));
}

const cellule = (v) => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvRegistre(lignes) {
  const t = [['email', 'prenom', 'profil', 'applications_achetees', 'essais', 'nouveautes_depuis', 'informations', 'desinscrit_le', 'source_desinscription', 'derniere_annonce', 'derniere_annonce_le']];
  for (const l of lignes) t.push([l.email, l.prenom, l.profil, l.achats.join(' '), l.essais.join(' '), l.nouveautes?.slice?.(0, 10) || '', l.informations,
    l.desinscritLe?.slice(0, 10) || '', l.sourceDesinscription || '', l.derniereAnnonce?.campagne || '', l.derniereAnnonce?.date?.slice(0, 10) || '']);
  return '﻿' + t.map((r) => r.map(cellule).join(';')).join('\r\n') + '\r\n';
}
