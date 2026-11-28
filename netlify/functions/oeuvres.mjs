// API de recherche d'œuvres du Suivi culturel (template PGS) : logique dans netlify/lib/oeuvres.mjs ; ici, seulement
// le branchement sur Netlify Blobs (cache partagé, Francfort). Sources sans clé (Open Library, Wikidata, iTunes) :
// aucune variable d'environnement propre à cette fonction.
import { getStore } from '@netlify/blobs';
import { traiterOeuvres } from '../lib/oeuvres.mjs';
import { revoquesDepuis } from '../lib/templates-acces.mjs';

export default async (requete) => {
  const store = getStore({ name: 'oeuvres-cache', consistency: 'strong', region: 'eu-central-1' });
  return traiterOeuvres(requete, {
    secret: process.env.TEMPLATES_SECRET,
    revoques: revoquesDepuis(process.env.TEMPLATES_CODES_REVOQUES),
    stockage: { get: (cle) => store.get(cle, { type: 'json' }), set: (cle, valeur) => store.setJSON(cle, valeur) },
  });
};

export const config = { path: '/api/oeuvres/*', region: 'fra' };
