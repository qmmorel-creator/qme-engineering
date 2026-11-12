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
export const PRODUITS = { REV: 'Planning de révision' };
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

export function genererCode(secret, produit) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court (32 caractères minimum)');
  if (!PRODUITS[produit]) throw new Error(`Produit inconnu : ${produit}`);
  const id = base32(randomBytes(5));
  const sig = signature(secret, produit, id);
  return `${produit}-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;
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
export async function traiter(requete, { secret, revoques = [], stockage }) {
  if (!secret) return json(503, { erreur: 'Service non configuré' });
  const chemin = new URL(requete.url).pathname.replace(/^\/api\/templates/, '').replace(/\/$/, '');

  let corps = null;
  if (requete.method === 'POST' || requete.method === 'PUT') {
    const texte = await requete.text();
    if (texte.length > TAILLE_MAX) return json(413, { erreur: 'Données trop volumineuses' });
    try { corps = JSON.parse(texte || '{}'); } catch { return json(400, { erreur: 'JSON invalide' }); }
  }

  const code = requete.method === 'POST' ? corps?.code : requete.headers.get('x-code');
  const acces = verifierCode(secret, code, revoques);
  if (!acces) return json(401, { erreur: 'Code d\'accès invalide' });
  const cle = cleDonnees(secret, acces.produit, acces.id);

  if (chemin === '/connexion' && requete.method === 'POST') {
    return json(200, { ok: true, produit: acces.produit, donnees: (await stockage.get(cle)) ?? null });
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
