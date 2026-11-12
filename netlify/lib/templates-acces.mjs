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
//  POST /connexion   { code }            → { ok, produit, donnees }
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
    let rembourse = false;
    try {
      for (const [produit, p] of Object.entries(PRODUITS)) {
        if (!p.gumroad) continue;
        const v = await verifierLicence(p.gumroad, code);
        if (v.ok) { code = codeDepuisLicence(secret, produit, code); break; }
        if (v.raison === 'rembourse') rembourse = true;
      }
    } catch {
      return json(502, { erreur: 'Vérification de la licence impossible pour le moment. Réessaie dans un instant.' });
    }
    if (estLicence(code)) {
      return json(rembourse ? 403 : 401, { erreur: rembourse ? 'Cet achat a été remboursé : la licence n\'est plus active.' : 'Clé de licence inconnue.' });
    }
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

export function revoquesDepuis(variable) {
  return String(variable || '').split(/[\s,;]+/).filter(Boolean);
}
