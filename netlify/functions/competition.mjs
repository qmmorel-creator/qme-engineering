// API publique de Gestion de compétition sportive (/api/competition/*) : branchement du moteur sur
// Netlify Blobs et node:crypto. Logique dans templates/competition/moteur.js (testée sans Netlify).
// Données hébergées dans l'Union européenne (Francfort, eu-central-1), comme les autres templates.
import { getStore } from '@netlify/blobs';
import { traiterCompetition } from '../../templates/competition/moteur.js';
import { dependancesCompetition } from '../lib/competition.mjs';

export default async (requete) => {
  const store = getStore({ name: 'competition-public', consistency: 'strong', region: 'eu-central-1' });
  const stockage = {
    get: (cle) => store.get(cle, { type: 'json' }),
    set: (cle, valeur) => store.setJSON(cle, valeur),
    supprimer: (cle) => store.delete(cle),
    lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
  };
  const secret = process.env.TEMPLATES_SECRET;
  if (!secret) return new Response(JSON.stringify({ erreur: 'Service non configuré' }), { status: 503, headers: { 'content-type': 'application/json' } });
  return traiterCompetition(requete, { stockage, ...dependancesCompetition(secret, process.env.TEMPLATES_CODES_REVOQUES) });
};

export const config = { path: '/api/competition/*', region: 'fra' };
