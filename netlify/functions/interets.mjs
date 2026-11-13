// Compteur « Je suis intéressé(e) » (templates en mise en vente prochaine). Logique dans
// netlify/lib/interets.mjs ; ici, seulement le branchement sur Netlify Blobs, à Francfort.
import { getStore } from '@netlify/blobs';
import { traiterInterets } from '../lib/interets.mjs';

export default async (requete) => {
  const store = getStore({ name: 'templates-interets', consistency: 'strong', region: 'eu-central-1' });
  return traiterInterets(requete, {
    secret: process.env.TEMPLATES_SECRET,
    admin: process.env.INTERETS_ADMIN,
    stockage: {
      ajouter: (cle) => store.set(cle, '1'),
      lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
    },
  });
};

export const config = { path: '/api/interets', region: 'fra' };
