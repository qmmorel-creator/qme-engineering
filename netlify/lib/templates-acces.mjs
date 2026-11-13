// Codes d'accès aux templates QME et API de données, sans dépendance à Netlify :
// le stockage est injecté (Netlify Blobs en production, mémoire en local et en test).
//
// Un code a la forme PRODUIT-AAAA-AAAA-SSSS-SSSS :
//  - PRODUIT : préfixe du template (REV pour le planning de révision) ;
//  - AAAA-AAAA : 40 bits aléatoires (identifiant de l'acheteur) ;
//  - SSSS-SSSS : 40 bits de signature HMAC-SHA256 avec le secret TEMPLATES_SECRET.
// Aucun code n'est stocké : la signature suffit à le valider. Un code se révoque en
// listant son identifiant (les 8 caractères aléatoires) dans TEMPLATES_CODES_REVOQUES.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base 32 de Crockford
// Produits vendus : préfixe des codes, page de l'application, identifiant Gumroad (clés de licence).
export const PRODUITS = {
  REV: { nom: 'Planning de révision', url: '/templates/revision/', gumroad: 'zjO4cm1dUdBGh1IfYqmklw==' },
  CRA: { nom: 'Compte rendu et plan d\'actions', url: '/templates/compte-rendu/', gumroad: '29mMG1jJqiRppcqs_Mt09w==' },
  PRX: { nom: 'Coût de revient et prix par client', url: '/templates/cout-revient/', gumroad: '-T__Q8H0-88YesaxXTxU4w==' },
  TJM: { nom: 'Calculateur de TJM freelance', url: '/templates/tjm/', gumroad: 'M7_JNLoIwpFH6zWHHxhOUA==' },
  MCE: { nom: 'Livre recettes-dépenses micro-entreprise', url: '/templates/micro-entreprise/', gumroad: 'fb4T6HNJyejxH1Q-mL8x8g==' },
  BCM: { nom: 'Budget commun', url: '/templates/budget-commun/', gumroad: 'FK_HeZlqRLdZO8o7Y1Bccw==' },
  GNT: { nom: 'Planning Gantt rapide', url: '/templates/gantt/', gumroad: 'CJfr2K4d-pBBg-5mOHaYMA==' },
  TCH: { nom: 'Gestionnaire de tâches', url: '/templates/taches/', gumroad: 'fhPqrSBXayFL21IZWU6YIg==' },
  NTR: { nom: 'Nutrition et dépense énergétique', url: '/templates/nutrition/', gumroad: 'gPo_NgvoB4zjkqk2mFkXBQ==' },
  BDG: { nom: 'Budget du foyer', url: '/templates/budget/', gumroad: 'YvGeAPDZjuqr9yflNtLhhw==' },
  MRG: { nom: 'Organisateur de mariage', url: '/templates/mariage/' },
  VSA: { nom: 'Circuit de visa des documents', url: '/templates/visa/' },
  NCF: { nom: 'Registre des non-conformités', url: '/templates/non-conformites/' },
  CRM: { nom: 'CRM freelance', url: '/templates/crm/' },
  VHC: { nom: 'Gestion de flotte de véhicules', url: '/templates/flotte/' },
  PHR: { nom: 'Planner horaire', url: '/templates/planner/' },
  RSV: { nom: 'Levée de réserves', url: '/templates/reserves/' },
  PRS: { nom: 'Pipeline de prospection B2B', url: '/templates/prospection/' },
  DVS: { nom: 'Générateur de devis', url: '/templates/devis/' },
  TRS: { nom: 'Trésorerie prévisionnelle 12 mois', url: '/templates/tresorerie/' },
  PRC: { nom: 'Gestion de parc informatique', url: '/templates/parc-informatique/' },
  EVT: { nom: 'Pilote événementiel', url: '/templates/evenementiel/' },
  ASC: { nom: 'Inscriptions associatives', url: '/templates/inscriptions/' },
  AEC: { nom: 'Gestion d\'auto-école', url: '/templates/auto-ecole/' },
  TRV: { nom: 'Pilote de travaux maison', url: '/templates/travaux/' },
  SNT: { nom: 'Secret Santa', url: '/templates/secret-santa/' },
  HBT: { nom: 'Suivi d\'habitudes et routines', url: '/templates/habitudes/' },
  ENT: { nom: 'Entretien de la maison', url: '/templates/entretien/' },
  DTT: { nom: 'Remboursement de dettes', url: '/templates/dettes/' },
  ABN: { nom: 'Suivi des abonnements', url: '/templates/abonnements/' },
  MTR: { nom: 'MétréPro', url: '/templates/metre/' },
  WTT: { nom: 'WattBudget', url: '/templates/watt-budget/' },
  RCP: { nom: 'ContrôleRéception', url: '/templates/controle-reception/' },
  PNB: { nom: 'PlanB', url: '/templates/plan-b/' },
  MMF: { nom: 'MémoFamille', url: '/templates/memo-famille/' },
  FTB: { nom: 'FêteBudget', url: '/templates/fete-budget/' },
};
const GUMROAD_VERIFY = 'https://api.gumroad.com/v2/licenses/verify';
export const TAILLE_MAX = 900_000; // octets, marge sous la limite d'1 Mo d'une requête

function base32(octets) {
  let bits = 0, valeur = 0, sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o; bits += 8;
    while (bits >= 5) { sortie += ALPHABET[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

function signature(secret, produit, id) {
  return base32(createHmac('sha256', secret).update(`${produit}:${id}`).digest().subarray(0, 5));
}

// Code administrateur de Quentin (ADM-XXXX-XXXX-XXXX-XXXX), toujours le même pour un secret donné :
// lit le compteur d'intérêt (/admin/interets/) et ouvre tous les templates à titre personnel.
export function codeAdmin(secret) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court');
  const s = base32(createHmac('sha256', secret).update('admin:interets').digest().subarray(0, 10));
  return `ADM-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}
export function estCodeAdmin(secret, saisie) {
  if (!secret || secret.length < 32) return false;
  const n = normaliser(saisie), attendu = normaliser(codeAdmin(secret));
  return n.length === attendu.length && timingSafeEqual(Buffer.from(n), Buffer.from(attendu));
}
// Code interne personnel de l'administrateur pour un template : mêmes données sur tous ses appareils.
export function codeAdminProduit(secret, produit) {
  const id = base32(createHmac('sha256', secret).update(`admin-perso:${produit}`).digest().subarray(0, 5));
  return formater(produit, id, signature(secret, produit, id));
}

// Majuscules, sans séparateurs ; O→0, I et L→1 (saisie tolérante).
export function normaliser(saisie) {
  return String(saisie || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
}

const formater = (produit, id, sig) => `${produit}-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;

export function genererCode(secret, produit) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court (32 caractères minimum)');
  if (!PRODUITS[produit]) throw new Error(`Produit inconnu : ${produit}`);
  const id = base32(randomBytes(5));
  return formater(produit, id, signature(secret, produit, id));
}

// Clé de licence Gumroad : 4 blocs de 8 caractères hexadécimaux.
export function estLicence(saisie) {
  return /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/.test(String(saisie || '').trim().toUpperCase());
}

// Code interne déterministe associé à une clé Gumroad : mêmes données d'un appareil à l'autre.
export function codeDepuisLicence(secret, produit, licence) {
  const id = base32(createHmac('sha256', secret).update(`gumroad:${produit}:${licence.trim().toUpperCase()}`).digest().subarray(0, 5));
  return formater(produit, id, signature(secret, produit, id));
}

// Interroge Gumroad. Renvoie { ok } ou { ok: false, raison: 'inconnue' | 'rembourse' }.
export async function verifierLicenceGumroad(produitGumroad, licence, fetchImpl = fetch) {
  const r = await fetchImpl(GUMROAD_VERIFY, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ product_id: produitGumroad, license_key: licence.trim().toUpperCase(), increment_uses_count: 'false' }),
    signal: AbortSignal.timeout(8000),
  });
  const corps = await r.json().catch(() => ({}));
  if (r.status === 404 || corps.success === false) return { ok: false, raison: 'inconnue' };
  if (!r.ok || !corps.purchase) throw new Error(`Gumroad ${r.status}`);
  const a = corps.purchase;
  if (a.refunded || a.chargebacked || a.disputed) return { ok: false, raison: 'rembourse' };
  return { ok: true };
}

// Renvoie { produit, id } si le code est valide, sinon null.
export function verifierCode(secret, saisie, revoques = []) {
  if (!secret) return null;
  const n = normaliser(saisie);
  const produit = Object.keys(PRODUITS).find((p) => n.startsWith(normaliser(p)) && n.length === normaliser(p).length + 16);
  if (!produit) return null;
  const reste = n.slice(normaliser(produit).length);
  const id = reste.slice(0, 8), sig = reste.slice(8);
  const attendue = signature(secret, produit, id);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(attendue))) return null;
  if (revoques.map(normaliser).includes(id)) return null;
  return { produit, id };
}

function cleDonnees(secret, produit, id) {
  return `${produit}/${createHmac('sha256', secret).update(`donnees:${produit}:${id}`).digest('hex').slice(0, 32)}`;
}

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Routes (préfixe /api/templates) :
//  POST /connexion   { code, produit? }  → { ok, produit, donnees } (produit requis pour le code administrateur)
//  GET  /donnees     (en-tête X-Code)    → { donnees }
//  PUT  /donnees     { donnees, base }   → { ok, majLe } ou 409 { donnees } si une version plus récente existe
// Le stockage expose get(cle) → objet|null et set(cle, objet).
export async function traiter(requete, { secret, revoques = [], stockage, verifierLicence = verifierLicenceGumroad }) {
  if (!secret) return json(503, { erreur: 'Service non configuré' });
  const chemin = new URL(requete.url).pathname.replace(/^\/api\/templates/, '').replace(/\/$/, '');

  let corps = null;
  if (requete.method === 'POST' || requete.method === 'PUT') {
    const texte = await requete.text();
    if (texte.length > TAILLE_MAX) return json(413, { erreur: 'Données trop volumineuses' });
    try { corps = JSON.parse(texte || '{}'); } catch { return json(400, { erreur: 'JSON invalide' }); }
  }

  let code = requete.method === 'POST' ? corps?.code : requete.headers.get('x-code');

  // Connexion par clé de licence Gumroad : vérifiée auprès de Gumroad, puis convertie en code interne.
  if (chemin === '/connexion' && requete.method === 'POST' && estLicence(code)) {
    // Tous les produits sont interrogés en parallèle : le temps de réponse ne dépend pas du nombre de produits.
    const candidats = Object.entries(PRODUITS).filter(([, p]) => p.gumroad);
    const reponses = await Promise.allSettled(candidats.map(([, p]) => verifierLicence(p.gumroad, code)));
    const trouve = reponses.findIndex((r) => r.status === 'fulfilled' && r.value.ok);
    const rembourse = reponses.some((r) => r.status === 'fulfilled' && r.value.raison === 'rembourse');
    if (trouve >= 0) code = codeDepuisLicence(secret, candidats[trouve][0], code);
    else if (!rembourse && reponses.some((r) => r.status === 'rejected')) {
      return json(502, { erreur: 'Vérification de la licence impossible pour le moment. Réessaie dans un instant.' });
    }
    if (estLicence(code)) {
      return json(rembourse ? 403 : 401, { erreur: rembourse ? 'Cet achat a été remboursé : la licence n\'est plus active.' : 'Clé de licence inconnue.' });
    }
  }

  // Code administrateur : ouvre le template qui le demande (champ produit), avec l'espace personnel de Quentin.
  if (chemin === '/connexion' && requete.method === 'POST' && estCodeAdmin(secret, code)) {
    if (!PRODUITS[corps?.produit]) return json(400, { erreur: 'Code administrateur : précise le template à ouvrir.' });
    code = codeAdminProduit(secret, corps.produit);
  }

  const acces = verifierCode(secret, code, revoques);
  if (!acces) return json(401, { erreur: 'Code d\'accès invalide' });
  const cle = cleDonnees(secret, acces.produit, acces.id);

  if (chemin === '/connexion' && requete.method === 'POST') {
    const jeton = formater(acces.produit, acces.id, signature(secret, acces.produit, acces.id));
    return json(200, { ok: true, produit: acces.produit, url: PRODUITS[acces.produit].url, jeton, donnees: (await stockage.get(cle)) ?? null });
  }
  if (chemin === '/donnees' && requete.method === 'GET') {
    return json(200, { donnees: (await stockage.get(cle)) ?? null });
  }
  if (chemin === '/donnees' && requete.method === 'PUT') {
    const donnees = corps?.donnees;
    if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return json(400, { erreur: 'Données manquantes' });
    const actuelles = await stockage.get(cle);
    // Un autre appareil a enregistré depuis la dernière lecture : on renvoie sa version.
    if (actuelles?.majLe && corps.base !== undefined && corps.base !== actuelles.majLe) {
      return json(409, { erreur: 'Version plus récente sur un autre appareil', donnees: actuelles });
    }
    const majLe = new Date().toISOString();
    await stockage.set(cle, { ...donnees, majLe });
    return json(200, { ok: true, majLe });
  }
  return json(404, { erreur: 'Route inconnue' });
}

// Stockage qui migre à la volée : lit d'abord le nouveau stockage ; si la clé n'y est pas, la reprend
// dans l'ancien, la recopie dans le nouveau, puis l'efface de l'ancien (seulement après une copie réussie).
// Chaque stockage expose get(cle), set(cle, valeur) et, pour l'ancien, supprimer(cle).
export function stockageMigrant(nouveau, ancien) {
  return {
    async get(cle) {
      const v = await nouveau.get(cle);
      if (v != null || !ancien) return v;
      const anciennes = await ancien.get(cle);
      if (anciennes == null) return null;
      await nouveau.set(cle, anciennes);
      await ancien.supprimer(cle);
      return anciennes;
    },
    set: (cle, valeur) => nouveau.set(cle, valeur),
  };
}

export function revoquesDepuis(variable) {
  return String(variable || '').split(/[\s,;]+/).filter(Boolean);
}
