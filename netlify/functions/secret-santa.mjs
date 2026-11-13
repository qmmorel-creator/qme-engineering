// API du Secret Santa (/api/secret-santa/*) : branchement du moteur sur Netlify Blobs et node:crypto.
// Logique dans templates/secret-santa/moteur.js (partagée avec la démo de l'application).
// Données hébergées dans l'Union européenne (Francfort, eu-central-1), comme les autres templates.
import { getStore } from '@netlify/blobs';
import { traiterSecretSanta } from '../../templates/secret-santa/moteur.js';
import { dependancesServeur } from '../lib/secret-santa.mjs';

export default async (requete) => {
  const store = getStore({ name: 'secret-santa', consistency: 'strong', region: 'eu-central-1' });
  const stockage = {
    get: (cle) => store.get(cle, { type: 'json' }),
    set: (cle, valeur) => store.setJSON(cle, valeur),
    supprimer: (cle) => store.delete(cle),
    lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
  };
  const secret = process.env.TEMPLATES_SECRET;
  if (!secret) return new Response(JSON.stringify({ erreur: 'Service non configuré' }), { status: 503, headers: { 'content-type': 'application/json' } });
  return traiterSecretSanta(requete, { stockage, ...dependancesServeur(secret, process.env.TEMPLATES_CODES_REVOQUES) });
};

export const config = { path: '/api/secret-santa/*', region: 'fra' };
