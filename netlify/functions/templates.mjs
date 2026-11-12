// API des templates QME : vérification du code d'accès et sauvegarde des données de l'acheteur.
// Logique dans netlify/lib/templates-acces.mjs ; ici, seulement le branchement sur Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { traiter, revoquesDepuis } from '../lib/templates-acces.mjs';

export default async (requete) => {
  const store = getStore({ name: 'templates-donnees', consistency: 'strong' });
  return traiter(requete, {
    secret: process.env.TEMPLATES_SECRET,
    revoques: revoquesDepuis(process.env.TEMPLATES_CODES_REVOQUES),
    stockage: {
      get: (cle) => store.get(cle, { type: 'json' }),
      set: (cle, valeur) => store.setJSON(cle, valeur),
    },
  });
};

export const config = { path: '/api/templates/*' };
