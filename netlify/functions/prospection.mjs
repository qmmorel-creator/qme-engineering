// Campagnes ciblées de prospection : file d'envoi et suivi (en-tête X-Prospection-Token ou X-Admin). Logique : netlify/lib/prospection.mjs.
import { getStore } from '@netlify/blobs';
import { traiterProspection } from '../lib/prospection.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => traiterProspection(requete, {
  secret: process.env.TEMPLATES_SECRET,
  store: storeEssais(getStore),
  admin: process.env.INTERETS_ADMIN,
  jeton: process.env.PROSPECTION_TOKEN || '', // jeton des sessions de prospection (en-tête X-Prospection-Token)
});

// Francfort : adresses e-mail des prospects gardées dans l'UE.
export const config = { path: ['/api/prospection', '/api/prospection/*'], region: 'fra' };
