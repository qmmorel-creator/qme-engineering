// Dépendances serveur du moteur Secret Santa : chiffrement node:crypto et vérification de l'organisateur.
// Séparé de la fonction Netlify pour être réutilisé par le serveur local et les tests.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { verifierCode, revoquesDepuis, ALPHABET } from './templates-acces.mjs';

const scryptAsync = promisify(scrypt);
export const PRODUIT_SANTA = 'SNT';

export function dependancesServeur(secret, revoques = '') {
  const liste = revoquesDepuis(revoques);
  return {
    crypto: {
      hmac: (texte) => createHmac('sha256', secret).update(texte).digest('base64url'),
      aleatoire: (n) => [...randomBytes(n)].map((o) => ALPHABET[o & 31]).join(''),
      hacher: async (code, sel) => (await scryptAsync(String(code), `${sel}:${secret}`, 32)).toString('hex'),
      egal: (a, b) => {
        const x = Buffer.from(String(a)), y = Buffer.from(String(b));
        return x.length === y.length && timingSafeEqual(x, y);
      },
    },
    // L'organisateur est identifié par son jeton de template (code interne SNT-…, renvoyé par
    // /api/templates/connexion après vérification de la licence Gumroad ou du code administrateur).
    verifierAdmin: (jeton) => {
      const acces = verifierCode(secret, jeton, liste);
      if (!acces || acces.produit !== PRODUIT_SANTA) return null;
      return createHmac('sha256', secret).update(`santa-admin:${acces.id}`).digest('hex').slice(0, 24).toUpperCase();
    },
  };
}
