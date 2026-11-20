// API de l'essai gratuit des templates : création (POST /api/essai), arrêt des rappels (GET /api/essai/stop),
// désinscription des nouveautés (GET /api/essai/desinscription) et contacts pour l'administrateur (/api/essai/contacts).
// Logique dans netlify/lib/essais.mjs ; ici, seulement le branchement sur Netlify Blobs et l'envoi d'e-mails.
import { getStore } from '@netlify/blobs';
import { traiterEssai } from '../lib/essais.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete, contexte) => traiterEssai(requete, {
  secret: process.env.TEMPLATES_SECRET,
  essais: storeEssais(getStore),
  envoyer: envoyeurDepuisEnv(),
  // Notification de chaque essai lancé : ESSAI_NOTIFICATION, sinon l'adresse d'expédition (boîte de Quentin).
  notifier: process.env.ESSAI_NOTIFICATION || process.env.ESSAI_EXPEDITEUR || '',
  admin: process.env.INTERETS_ADMIN, // code administrateur facultatif, comme /api/interets (sinon le code ADM-… dérivé du secret)
  testeurs: process.env.ESSAI_TESTEURS || '', // adresses de test, exclues du compteur
  ip: contexte?.ip || requete.headers.get('x-nf-client-connection-ip') || '',
});

// Exécutée à Francfort : adresses e-mail et données d'essai restent dans l'UE.
export const config = { path: ['/api/essai', '/api/essai/*'], region: 'fra' };
