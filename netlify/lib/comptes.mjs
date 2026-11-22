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
// Administration (en-tête X-Admin : code administrateur) :
//  POST   /import    { ventes: [{ email, licence }], simulation = true } → rapport ; ventes passées rangées dans les
//                    comptes après vérification de chaque clé auprès de Gumroad (adresse de la vente exigée)
//  POST   /annonce   { simulation = true, test?, prenom?, limite = 8 } → annonce nouveautes.mjs aux testeurs inscrits
//                    et aux acheteurs, une fois par adresse ; test : les deux versions à cette seule adresse
// Public :
//  GET    /registre  (?format=csv)            → registre des préférences d'information (preferences.mjs)
//  GET    /opposition?email=                   → { opposition: null | { par, date, source } } (adresse ou domaine)
//  POST   /opposition/verifier { emails }      → [{ email, opposition }] (avant tout envoi de prospection)
//  POST   /opposition { emails?, domaines?, source? } → ajout groupé (réponses « stop », liste docs/prospection/)
// Public :
//  POST   /opposition { email }               → page /ne-plus-recevoir/ (lien de tout e-mail de prospection)
//  GET    /stop?e=&s=                          → « Ne plus recevoir les informations » (lien signé du pied de l'annonce,
//                                                 acheteurs et testeurs) : liste d'opposition (preferences.mjs)
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PRODUITS, PACKS, cleEmail, jourParis, estLicence, verifierCode, verifierCodeEssai, verifierCodePack, normaliser, verifierLicenceGumroad } from './templates-acces.mjs';
import { estAdmin } from './interets.mjs';
import { contenuAnnonce, CAMPAGNE } from './nouveautes.mjs';
import { enregistrerOpposition, leverOpposition, enregistrerDomaine, oppositionDe, domainesOpposes, lireRegistre, csvRegistre, CONSERVATION_OPPOSITION_JOURS } from './preferences.mjs';
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
  // Informations QME : reçues sauf refus (compte marqué, liste d'opposition par adresse ou par domaine).
  const opposition = compte.sansAnnonces ? true : Boolean(await oppositionDe(store, secret, compte.email));
  return {
    email: compte.email, prenom: compte.prenom || '', cree: compte.cree, informations: !opposition,
    cles: compte.cles.map(({ type, p, code, source, ajoute }) => ({ type, p, code, source, ajoute: ajoute || null })),
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

const signerStop = (secret, h) => signer(secret, 'stop', h).slice(0, 24);
export const lienStopAnnonces = (secret, email) => { const h = cleEmail(secret, normEmail(email)); return `${SITE}/api/compte/stop?e=${h}&s=${signerStop(secret, h)}`; };
const page = (titre, texte) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titre}</title></head><body style="font:17px/1.55 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;color:#141414;background:#FBF7F1"><h1 style="font-size:26px">${titre}</h1><p>${texte}</p><p><a href="${SITE}/connexion/" style="color:#1D4E89;font-weight:700">Mon espace QME</a></p></body></html>`,
  { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

// Ventes passées → comptes. Chaque clé est vérifiée auprès de Gumroad (tous les produits interrogés) ; l'adresse
// donnée doit être celle de la vente. Simulation par défaut : rien n'est écrit.
async function importer({ secret, store, ventes, simulation, verifierLicence, maintenant }) {
  const candidats = [...Object.entries(PRODUITS).map(([k, p]) => ['template', k, p.gumroad]), ...Object.entries(PACKS).map(([k, p]) => ['pack', k, p.gumroad])].filter(([, , g]) => g);
  const rapport = [];
  for (const v of (Array.isArray(ventes) ? ventes : []).slice(0, 200)) {
    const email = normEmail(v?.email), licence = String(v?.licence || '').trim().toUpperCase();
    const ligne = { email, licence: licence.slice(0, 8) + '…' };
    if (!emailValide(email) || !estLicence(licence)) { rapport.push({ ...ligne, resultat: 'format invalide' }); continue; }
    const rep = await Promise.allSettled(candidats.map(([, , g]) => verifierLicence(g, licence)));
    const i = rep.findIndex((r) => r.status === 'fulfilled' && r.value.ok);
    if (i < 0) { rapport.push({ ...ligne, resultat: rep.some((r) => r.status === 'fulfilled' && r.value.raison === 'rembourse') ? 'remboursée' : rep.some((r) => r.status === 'rejected') ? 'Gumroad injoignable' : 'clé inconnue' }); continue; }
    const achat = rep[i].value.achat || {}, [type, code] = candidats[i];
    if (achat.email && normEmail(achat.email) !== email) { rapport.push({ ...ligne, resultat: 'adresse différente de celle de la vente' }); continue; }
    if (!simulation) await ajouterAchat({ secret, store, email, vente: { type, code }, licence, maintenant });
    rapport.push({ ...ligne, produit: code, type, resultat: simulation ? 'à importer' : 'importée' });
  }
  return rapport;
}

// Destinataires de l'annonce : testeurs inscrits aux nouveautés (contact/…) et acheteurs (compte avec un achat,
// sans « ne plus recevoir »). Une adresse à la fois ; un acheteur reçoit la version acheteur.
async function destinataires({ secret, store, exclure = [] }) {
  const parEmail = new Map();
  for (const cle of await store.lister('contact/')) {
    const c = await store.get(cle);
    if (c?.email) parEmail.set(normEmail(c.email), { email: normEmail(c.email), prenom: c.prenom || '', type: 'testeur', stop: lienStopAnnonces(secret, c.email) });
  }
  for (const cle of await store.lister('compte/')) {
    const c = await store.get(cle);
    if (!c?.email || c.sansAnnonces || !c.cles?.some((k) => k.source === 'achat')) continue;
    parEmail.set(c.email, { email: c.email, prenom: c.prenom || parEmail.get(c.email)?.prenom || '', type: 'acheteur', stop: lienStopAnnonces(secret, c.email) });
  }
  // Liste d'opposition : jamais d'annonce.
  const opposes = new Set((await store.lister('opposition/')).map((k) => k.slice('opposition/'.length)));
  const domaines = await domainesOpposes(store);
  const ex = exclure.map(normEmail);
  return [...parEmail.values()].filter((d) => !ex.includes(d.email) && !opposes.has(cleEmail(secret, d.email)) && !domaines.has(d.email.split('@')[1]));
}

export async function traiterCompte(requete, { secret, store, envoyer = null, revoques = [], maintenant = Date.now, admin = '', testeurs = '', verifierLicence = verifierLicenceGumroad }) {
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

  // Désinscription des annonces (acheteurs).
  if (chemin === '/stop' && methode === 'GET') {
    const u = new URL(requete.url), h = u.searchParams.get('e') || '', sig = u.searchParams.get('s') || '';
    if (!/^[0-9a-f]{8,64}$/.test(h) || !egal(sig.padEnd(24).slice(0, 24), signerStop(secret, h))) return page('Lien invalide', 'Ce lien de désinscription est incomplet. Répondez à l’e-mail reçu : je vous retire à la main.');
    await enregistrerOpposition(store, h, { source: 'lien « Ne plus recevoir les informations »', date });
    return page('C’est noté', 'Vous ne recevrez plus d’informations de QME (nouveautés, annonces). Vos applications, vos essais et votre compte restent inchangés.');
  }

  // Administration : import des ventes passées, annonce des nouveautés.
  // Opposition : page publique /ne-plus-recevoir/ (une adresse), ou administrateur (ajout groupé, vérification).
  if (chemin === '/opposition' || chemin === '/opposition/verifier') {
    const estAdm = estAdmin(requete.headers.get('x-admin') || '', { secret, admin });
    if (chemin === '/opposition' && methode === 'GET') {
      if (!estAdm) return json(401, { erreur: 'Code administrateur requis.' });
      const email = normEmail(new URL(requete.url).searchParams.get('email'));
      if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
      return json(200, { email, opposition: await oppositionDe(store, secret, email) });
    }
    if (chemin === '/opposition/verifier' && methode === 'POST') {
      if (!estAdm) return json(401, { erreur: 'Code administrateur requis.' });
      const emails = (Array.isArray(corps.emails) ? corps.emails : []).slice(0, 500).map(normEmail).filter(emailValide);
      return json(200, { resultats: await Promise.all(emails.map(async (email) => ({ email, opposition: await oppositionDe(store, secret, email) }))) });
    }
    if (chemin === '/opposition' && methode === 'POST') {
      if (estAdm && (corps.emails || corps.domaines)) {
        const source = String(corps.source || 'ajout administrateur').slice(0, 120);
        const emails = (Array.isArray(corps.emails) ? corps.emails : []).slice(0, 500).map(normEmail).filter(emailValide);
        for (const email of emails) await enregistrerOpposition(store, cleEmail(secret, email), { source, date, email });
        const domaines = [];
        for (const d of (Array.isArray(corps.domaines) ? corps.domaines : []).slice(0, 200)) { const x = await enregistrerDomaine(store, d, { source, date }); if (x) domaines.push(x); }
        return json(200, { ok: true, emails: emails.length, domaines });
      }
      const email = normEmail(corps.email);
      if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
      await enregistrerOpposition(store, cleEmail(secret, email), { source: 'page « Ne plus recevoir les informations »', date, email });
      return json(200, { ok: true });
    }
    return json(405, { erreur: 'Méthode non permise' });
  }

  // Registre des préférences d'information (administrateur).
  if (chemin === '/registre' && methode === 'GET') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    const lignes = await lireRegistre({ secret, store });
    if (new URL(requete.url).searchParams.get('format') === 'csv') {
      return new Response(csvRegistre(lignes), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="registre-preferences-qme-${date.slice(0, 10)}.csv"` } });
    }
    const n = (f) => lignes.filter(f).length;
    return json(200, { total: lignes.length, acheteurs: n((l) => l.profil.includes('acheteur')), testeurs: n((l) => l.profil.includes('testeur')),
      abonnes: n((l) => l.informations === 'abonné'), desinscrits: n((l) => l.informations === 'désinscrit'), lignes });
  }

  if ((chemin === '/import' || chemin === '/annonce') && methode === 'POST') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    const simulation = corps.simulation !== false;
    if (chemin === '/import') return json(200, { simulation, rapport: await importer({ secret, store, ventes: corps.ventes, simulation, verifierLicence, maintenant }) });
    if (corps.test) {
      const email = normEmail(corps.test);
      if (!emailValide(email)) return json(400, { erreur: 'Adresse de test invalide.' });
      if (!envoyer) return json(503, { erreur: 'Envoi d\'e-mails non configuré.' });
      for (const type of ['acheteur', 'testeur']) {
        const m = contenuAnnonce({ type, prenom: nettoyerPrenom(corps.prenom), stop: lienStopAnnonces(secret, email) });
        await envoyer({ a: email, objet: `[Test ${type}] ${m.objet}`, texte: m.texte, html: m.html });
      }
      return json(200, { ok: true, test: email, envoyes: 2 });
    }
    const liste = await destinataires({ secret, store, exclure: String(testeurs).split(/[\s,;]+/).filter(Boolean) });
    const restants = [];
    for (const d of liste) if (!(await store.get(`annonce/${CAMPAGNE}/${cleEmail(secret, d.email)}`))) restants.push(d);
    const resume = { campagne: CAMPAGNE, total: liste.length, acheteurs: liste.filter((d) => d.type === 'acheteur').length, testeurs: liste.filter((d) => d.type === 'testeur').length, dejaEnvoyes: liste.length - restants.length };
    if (simulation) return json(200, { simulation, ...resume, aEnvoyer: restants.length });
    if (!envoyer) return json(503, { erreur: 'Envoi d\'e-mails non configuré.' });
    // Par lots (temps limite d'une fonction) : relancer jusqu'à restants = 0.
    const lot = restants.slice(0, Math.min(Math.max(Number(corps.limite) || 8, 1), 20));
    let envoyes = 0; const erreurs = [];
    for (const d of lot) {
      const m = contenuAnnonce(d);
      try { await envoyer({ a: d.email, objet: m.objet, texte: m.texte, html: m.html }); await store.set(`annonce/${CAMPAGNE}/${cleEmail(secret, d.email)}`, { date, type: d.type }); envoyes++; }
      catch (x) { console.error('Annonce impossible', x); erreurs.push(d.type); }
    }
    return json(200, { simulation, ...resume, envoyes, erreurs: erreurs.length, restants: restants.length - envoyes });
  }

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
    // Interrupteur « Recevoir les informations QME » de l'espace personnel : liste d'opposition (preferences.mjs).
    if (corps.informations === false) await enregistrerOpposition(store, s.h, { source: 'espace personnel', date, email: compte.email });
    if (corps.informations === true) await leverOpposition(store, s.h);
    if (typeof corps.informations === 'boolean') {
      const frais = (await store.get(cle)) || compte;
      for (const k of Object.keys(compte)) if (!(k in frais)) delete compte[k];
      Object.assign(compte, frais);
    }
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
  // Liste d'opposition : gardée 3 ans après la désinscription.
  bilan.oppositions = 0;
  const limite = new Date(t - CONSERVATION_OPPOSITION_JOURS * 86_400_000).toISOString();
  for (const cle of await store.lister('opposition/')) {
    const o = await store.get(cle);
    if (!o || String(o.date) < limite) { await store.supprimer(cle); bilan.oppositions++; }
  }
  return bilan;
}
