// Dépendances serveur du moteur public de Gestion de compétition sportive : HMAC et vérification de
// l'organisateur. Séparé de la fonction Netlify pour être réutilisé par le serveur local et les tests.
import { createHmac } from 'node:crypto';
import { verifierCode, revoquesDepuis } from './templates-acces.mjs';

export const PRODUIT_COMPETITION = 'CMP';

export function dependancesCompetition(secret, revoques = '') {
  const liste = revoquesDepuis(revoques);
  return {
    hmac: (texte) => createHmac('sha256', secret).update(texte).digest('base64url'),
    // L'organisateur est identifié par son jeton de template (code interne CMP-…, renvoyé par
    // /api/templates/connexion après vérification de la licence Gumroad, d'un code de pack ou du code ADM).
    verifierOrganisateur: (jeton) => {
      const acces = verifierCode(secret, jeton, liste);
      if (!acces || acces.produit !== PRODUIT_COMPETITION) return null;
      return createHmac('sha256', secret).update(`competition-organisateur:${acces.id}`).digest('hex').slice(0, 24).toUpperCase();
    },
  };
}
