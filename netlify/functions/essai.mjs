// API de l'essai gratuit des templates : création (POST /api/essai) et arrêt des rappels (GET /api/essai/stop).
// Logique dans netlify/lib/essais.mjs ; ici, seulement le branchement sur Netlify Blobs et l'envoi d'e-mails.
import { getStore } from '@netlify/blobs';
import { traiterEssai } from '../lib/essais.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete, contexte) => traiterEssai(requete, {
  secret: process.env.TEMPLATES_SECRET,
  essais: storeEssais(getStore),
  envoyer: envoyeurDepuisEnv(),
  ip: contexte?.ip || requete.headers.get('x-nf-client-connection-ip') || '',
});

// Exécutée à Francfort : adresses e-mail et données d'essai restent dans l'UE.
export const config = { path: ['/api/essai', '/api/essai/*'], region: 'fra' };
