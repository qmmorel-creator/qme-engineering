// API de recherche d'œuvres du Suivi culturel (template PGS) : logique dans netlify/lib/oeuvres.mjs ; ici, seulement
// le branchement sur Netlify Blobs (cache partagé, Francfort) et les variables d'environnement.
// TMDB_JETON (jeton d'accès en lecture v4) ou TMDB_API_KEY (clé v3) : sans eux, films et séries restent en saisie
// manuelle. Les clés ne quittent jamais le serveur.
import { getStore } from '@netlify/blobs';
import { traiterOeuvres } from '../lib/oeuvres.mjs';
import { revoquesDepuis } from '../lib/templates-acces.mjs';

export default async (requete) => {
  const store = getStore({ name: 'oeuvres-cache', consistency: 'strong', region: 'eu-central-1' });
  return traiterOeuvres(requete, {
    secret: process.env.TEMPLATES_SECRET,
    revoques: revoquesDepuis(process.env.TEMPLATES_CODES_REVOQUES),
    stockage: { get: (cle) => store.get(cle, { type: 'json' }), set: (cle, valeur) => store.setJSON(cle, valeur) },
    tmdbJeton: process.env.TMDB_JETON || '',
    tmdbCle: process.env.TMDB_API_KEY || '',
  });
};

export const config = { path: '/api/oeuvres/*', region: 'fra' };
