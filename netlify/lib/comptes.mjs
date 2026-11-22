// Comptes acheteurs QME (décision de Quentin, 22/11/2026) : connexion par lien envoyé par e-mail, sans mot de
// passe. Un compte n'est qu'un trousseau : il garde les clés (licences Gumroad, codes QME, codes de pack, codes
// d'essai) déjà utilisées par les applications, pour les redonner sur un autre appareil, et les préférences de
// l'espace (prénom, noms donnés aux applications, applications masquées et épinglées). Les applications
// continuent de vérifier leur clé à chaque ouverture (remboursement compris) : le compte ne donne aucun accès
// qu'une clé ne donne pas.
//
// Achats : le ping Gumroad (achats.mjs) range chaque vente vérifiée sous l'adresse de l'acheteur
// (ajouterAchat) ; en se connectant avec cette adresse, l'acheteur retrouve tout. Essais : lus dans l'index des
// essais par adresse (email/<empreinte>/<produit>).
//
// Stockage (store des essais, Francfort) : compte/<empreinte de l'adresse> ; lien/<nonce> (lien déjà utilisé) ;
// limite/<empreinte> (envois de liens). Jetons signés avec une clé dérivée de TEMPLATES_SECRET.
//
// Routes (préfixe /api/compte) :
//  POST   /lien      { email }              → 200 { ok } (toujours, même adresse inconnue) ; 429 si trop d'envois
//  POST   /session   { lien }               → { ok, jeton, compte } (lien à usage unique, 15 min)
//  GET    /          (Authorization: Bearer) → { compte }
//  POST   /cles      { cles: [{ p, code }] } → { compte } (applications de l'appareil ajoutées au compte)
//  PUT    /prefs     { prenom?, prefs }      → { compte }
//  POST   /deconnexion                       → { ok } (toutes les sessions de ce compte)
//  DELETE /          (Authorization: Bearer) → { ok } (compte supprimé ; les achats restent valables par leur clé)
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PRODUITS, PACKS, cleEmail, jourParis, estLicence, verifierCode, verifierCodeEssai, verifierCodePack, normaliser } from './templates-acces.mjs';
import { ficheEssai, corpsHtml, enveloppeHtml, SIGNATURE, SITE } from './essais.mjs';

export const DUREE_LIEN = 15 * 60_000;
export const DUREE_SESSION = 90 * 86_400_000;
const LIMITE = { parHeure: 5, intervalle: 30_000 };
const MAX_CLES = 300;

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const emailValide = (e) => e.length <= 254 && /^[^\s@"<>,;]{1,64}@[^\s@"<>,;]{1,190}\.[a-z]{2,24}$/i.test(e);
export const cleCompte = (secret, email) => `compte/${cleEmail(secret, normEmail(email))}`;
const cleSignature = (secret) => createHmac('sha256', secret).update('comptes:v1').digest();
const signer = (secret, type, charge) => createHmac('sha256', cleSignature(secret)).update(`${type}.${charge}`).digest('base64url').slice(0, 43);
const egal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function creerJeton(secret, type, contenu) {
  const charge = Buffer.from(JSON.stringify(contenu)).toString('base64url');
  return `${charge}.${signer(secret, type, charge)}`;
}
function lireJeton(secret, type, jeton, maintenant) {
  const [charge, sig, reste] = String(jeton || '').split('.');
  if (!charge || !sig || reste !== undefined || !egal(sig, signer(secret, type, charge))) return null;
  let c; try { c = JSON.parse(Buffer.from(charge, 'base64url').toString()); } catch { return null; }
  return c && typeof c.x === 'number' && c.x > maintenant ? c : null;
}
export const jetonLien = (secret, email, maintenant) => creerJeton(secret, 'lien', { e: normEmail(email), x: maintenant + DUREE_LIEN, n: randomBytes(9).toString('base64url') });
export const jetonSession = (secret, compte, maintenant) => creerJeton(secret, 'session', { h: cleEmail(secret, compte.email), v: compte.v || 1, x: maintenant + DUREE_SESSION });

// Prénom : lettres, espace, apostrophe ou tiret, 30 caractères au plus ; sinon vide.
export const nettoyerPrenom = (p) => { const s = String(p || '').trim().replace(/\s+/g, ' ').slice(0, 30); return /^[\p{L}][\p{L}' -]*$/u.test(s) ? s : ''; };
const prenomDeNom = (nom) => { const m = String(nom || '').trim().split(/\s+/)[0] || ''; return /^[\p{L}][\p{L}'-]{1,29}$/u.test(m) ? m.charAt(0).toUpperCase() + m.slice(1) : ''; };

function nouveauCompte(email, date) {
  return { email: normEmail(email), cree: date, prenom: '', cles: [], prefs: { noms: {}, masques: [], epingles: [] }, prefsMaj: null, v: 1 };
}

// Clé ajoutée au compte, sans doublon (même produit ou pack et même code normalisé).
function ajouterCle(compte, cle) {
  const n = normaliser(cle.code);
  if (compte.cles.some((c) => c.p === cle.p && c.type === cle.type && normaliser(c.code) === n)) return false;
  if (compte.cles.length >= MAX_CLES) return false;
  compte.cles.push(cle);
  return true;
}

// Ping d'achat vérifié (achats.mjs) : la licence rejoint le compte de l'adresse Gumroad, créé au besoin.
export async function ajouterAchat({ secret, store, email, vente, licence, nomComplet = '', maintenant = Date.now }) {
  if (!secret || !store || !email || !vente || !licence) return null;
  const date = new Date(maintenant()).toISOString();
  const cle = cleCompte(secret, email);
  const compte = (await store.get(cle)) || nouveauCompte(email, date);
  if (!compte.prenom) compte.prenom = prenomDeNom(nomComplet);
  ajouterCle(compte, { type: vente.type === 'pack' ? 'pack' : 'template', p: vente.code, code: String(licence).trim().toUpperCase(), source: 'achat', ajoute: date });
  await store.set(cle, compte);
  return compte;
}

// Clé envoyée par l'appareil : format contrôlé ; codes QME, de pack et d'essai vérifiés par leur signature.
// Une licence Gumroad est gardée telle quelle (l'application la vérifie auprès de Gumroad à l'ouverture).
export function cleValide(secret, { p, code }, revoques = []) {
  const brut = String(code || '').trim().toUpperCase();
  if (!brut || brut.length > 80 || normaliser(brut).startsWith('ADM')) return null;
  if (PACKS[p] || p === 'SMP' || p === 'PACK') { // PACK : pack connu par sa seule clé (appareil)
    if (estLicence(brut)) return { type: 'pack', p, code: brut };
    const a = verifierCodePack(secret, brut, revoques);
    return a ? { type: 'pack', p: a.pack, code: brut } : null;
  }
  if (!PRODUITS[p]) return null;
  if (estLicence(brut)) return { type: 'template', p, code: brut };
  const a = verifierCode(secret, brut, revoques);
  if (a) return a.produit === p ? { type: 'template', p, code: brut } : null;
  const e = verifierCodeEssai(secret, brut, revoques);
  return e && e.produit === p ? { type: 'essai', p, code: brut } : null;
}

const listeProduits = (l) => [...new Set((Array.isArray(l) ? l : []).filter((k) => typeof k === 'string' && PRODUITS[k]))].slice(0, 200);
export function nettoyerPrefs(prefs = {}) {
  const noms = {};
  for (const [k, v] of Object.entries(prefs.noms || {})) {
    const s = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (PRODUITS[k] && s && !/[<>]/.test(s)) noms[k] = s;
  }
  return { noms, masques: listeProduits(prefs.masques), epingles: listeProduits(prefs.epingles) };
}

// Essais liés à l'adresse (index des essais), encore conservés et pas achetés.
async function essaisDe(secret, store, email, aujourdhui) {
  const h = cleEmail(secret, email);
  const refs = await Promise.all(Object.keys(PRODUITS).map(async (p) => [p, await store.get(`email/${h}/${p}`).catch(() => null)]));
  const regs = await Promise.all(refs.filter(([, r]) => r?.id).map(([, r]) => store.get(`essai/${r.id}`).catch(() => null)));
  return regs.filter((r) => r && !r.achete && !r.paye && aujourdhui <= r.effacement).map((r) => {
    let f = {}; try { f = ficheEssai(r.produit); } catch { /* produit sans fiche d'essai */ }
    const jours = Math.max(0, Math.round((Date.parse(`${r.fin}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000));
    return { p: r.produit, code: r.code, debut: r.debut, fin: r.fin, effacement: r.effacement, termine: aujourdhui > r.fin, joursRestants: jours, prix: f.prix ?? null, achat: f.achat ?? null };
  });
}

async function vue(secret, store, compte, aujourdhui) {
  return {
    email: compte.email, prenom: compte.prenom || '', cree: compte.cree,
    cles: compte.cles.map(({ type, p, code, source }) => ({ type, p, code, source })),
    essais: await essaisDe(secret, store, compte.email, aujourdhui),
    prefs: compte.prefs, prefsMaj: compte.prefsMaj,
  };
}

export function contenuMailLien({ lien, prenom = '' }) {
  const texte = `${prenom ? `Bonjour ${prenom},` : 'Bonjour,'}

Voici votre lien pour ouvrir votre espace QME et retrouver toutes vos applications, sur cet appareil comme sur les autres :

${lien}

Il est valable 15 minutes et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail : personne ne peut se connecter sans ce lien.

${SIGNATURE}`;
  return {
    objet: 'Votre lien de connexion QME',
    texte: `${texte}\n\n—\nVous recevez cet e-mail parce que quelqu'un a demandé à se connecter à l'espace QME avec cette adresse.`,
    html: enveloppeHtml(`${corpsHtml(texte)}<p style="margin:24px 0 0;font-size:12px;color:#6b6660">Vous recevez cet e-mail parce que quelqu'un a demandé à se connecter à l'espace QME avec cette adresse.</p>`),
  };
}

export async function traiterCompte(requete, { secret, store, envoyer = null, revoques = [], maintenant = Date.now }) {
  if (!secret || secret.length < 32 || !store) return json(503, { erreur: 'Service non configuré' });
  const chemin = new URL(requete.url).pathname.replace(/^\/api\/compte/, '').replace(/\/$/, '') || '/';
  const methode = requete.method;
  let corps = {};
  if (methode === 'POST' || methode === 'PUT') {
    const t = await requete.text();
    if (t.length > 100_000) return json(413, { erreur: 'Requête trop volumineuse' });
    try { corps = JSON.parse(t || '{}') || {}; } catch { return json(400, { erreur: 'JSON invalide' }); }
  }
  const t = maintenant(), date = new Date(t).toISOString(), aujourdhui = jourParis(new Date(t));

  // Demande d'un lien de connexion.
  if (chemin === '/lien' && methode === 'POST') {
    const email = normEmail(corps.email);
    if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
    const cleLimite = `limite/${cleEmail(secret, email)}`;
    const envois = ((await store.get(cleLimite))?.t || []).filter((x) => t - x < 3_600_000);
    if (envois.length >= LIMITE.parHeure || (envois.length && t - Math.max(...envois) < LIMITE.intervalle)) {
      return json(429, { erreur: 'Un lien vient déjà de partir vers cette adresse. Regardez vos e-mails (et les indésirables), ou réessayez dans quelques minutes.' });
    }
    if (!envoyer) return json(503, { erreur: 'Envoi d\'e-mails non configuré.' });
    const compte = await store.get(cleCompte(secret, email));
    const lien = `${SITE}/connexion/?lien=${jetonLien(secret, email, t)}`;
    const m = contenuMailLien({ lien, prenom: compte?.prenom });
    try { await envoyer({ a: email, objet: m.objet, texte: m.texte, html: m.html }); } catch (x) {
      console.error('E-mail de connexion impossible', x);
      return json(502, { erreur: 'L\'e-mail n\'a pas pu partir. Réessayez dans un instant.' });
    }
    await store.set(cleLimite, { t: [...envois, t] });
    return json(200, { ok: true });
  }

  // Lien cliqué : session ouverte, compte créé au premier passage.
  if (chemin === '/session' && methode === 'POST') {
    const l = lireJeton(secret, 'lien', corps.lien, t);
    if (!l?.e || !l.n) return json(401, { erreur: 'Ce lien n\'est plus valable (15 minutes, une seule fois). Demandez-en un nouveau.' });
    if (await store.get(`lien/${l.n}`)) return json(401, { erreur: 'Ce lien a déjà servi. Demandez-en un nouveau.' });
    await store.set(`lien/${l.n}`, { x: l.x });
    const cle = cleCompte(secret, l.e);
    let compte = await store.get(cle);
    if (!compte) { compte = nouveauCompte(l.e, date); await store.set(cle, compte); }
    if (!compte.prenom) {
      // Prénom donné à un essai de la même adresse, s'il y en a un.
      const h = cleEmail(secret, l.e);
      for (const p of Object.keys(PRODUITS)) {
        const ref = await store.get(`email/${h}/${p}`).catch(() => null);
        const reg = ref?.id ? await store.get(`essai/${ref.id}`).catch(() => null) : null;
        if (reg?.prenom) { compte.prenom = nettoyerPrenom(reg.prenom); await store.set(cle, compte); break; }
      }
    }
    return json(200, { ok: true, jeton: jetonSession(secret, compte, t), compte: await vue(secret, store, compte, aujourdhui) });
  }

  // Toutes les autres routes : session valide.
  const s = lireJeton(secret, 'session', (requete.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), t);
  if (!s?.h) return json(401, { erreur: 'Session expirée : reconnectez-vous avec votre e-mail.' });
  const cle = `compte/${s.h}`;
  const compte = await store.get(cle);
  if (!compte || (compte.v || 1) !== s.v) return json(401, { erreur: 'Session expirée : reconnectez-vous avec votre e-mail.' });

  if (chemin === '/' && methode === 'GET') return json(200, { compte: await vue(secret, store, compte, aujourdhui) });

  if (chemin === '/cles' && methode === 'POST') {
    const liste = Array.isArray(corps.cles) ? corps.cles.slice(0, MAX_CLES) : [];
    let ajoutees = 0;
    for (const c of liste) {
      const v = cleValide(secret, c || {}, revoques);
      if (v && ajouterCle(compte, { ...v, source: 'appareil', ajoute: date })) ajoutees++;
    }
    if (ajoutees) await store.set(cle, compte);
    return json(200, { ajoutees, compte: await vue(secret, store, compte, aujourdhui) });
  }

  if (chemin === '/prefs' && methode === 'PUT') {
    if (corps.prenom !== undefined) compte.prenom = nettoyerPrenom(corps.prenom);
    if (corps.prefs) { compte.prefs = nettoyerPrefs(corps.prefs); compte.prefsMaj = date; }
    await store.set(cle, compte);
    return json(200, { compte: await vue(secret, store, compte, aujourdhui) });
  }

  if (chemin === '/deconnexion' && methode === 'POST') {
    compte.v = (compte.v || 1) + 1;
    await store.set(cle, compte);
    return json(200, { ok: true });
  }

  if (chemin === '/' && methode === 'DELETE') {
    await store.supprimer(cle);
    return json(200, { ok: true });
  }

  return json(404, { erreur: 'Route inconnue' });
}

// Purge quotidienne (netlify/functions/essais-quotidien.mjs) : traces de demandes de lien de plus d'une heure,
// liens expirés (devenus inutilisables de toute façon).
export async function purgerComptes({ store, maintenant = Date.now }) {
  const t = maintenant(), bilan = { limites: 0, liens: 0 };
  for (const cle of await store.lister('limite/')) {
    const l = await store.get(cle);
    if (!l?.t?.some((x) => t - x < 3_600_000)) { await store.supprimer(cle); bilan.limites++; }
  }
  for (const cle of await store.lister('lien/')) {
    const l = await store.get(cle);
    if (!l || l.x <= t) { await store.supprimer(cle); bilan.liens++; }
  }
  return bilan;
}
