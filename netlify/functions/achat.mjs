// Ping de vente Gumroad (POST /api/achat) : e-mail de remerciement à l'acheteur, arrêt de la séquence d'essai,
// notification à Quentin. Logique dans netlify/lib/achats.mjs. À déclarer une fois dans Gumroad :
// Settings → Advanced → Ping endpoint = https://qm-engineering.fr/api/achat
import { getStore } from '@netlify/blobs';
import { traiterAchat } from '../lib/achats.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => traiterAchat(requete, {
  secret: process.env.TEMPLATES_SECRET,
  essais: storeEssais(getStore),
  envoyer: envoyeurDepuisEnv(),
  notifier: process.env.ESSAI_NOTIFICATION || process.env.ESSAI_EXPEDITEUR || '',
});

// Francfort, comme l'essai : adresses e-mail et registre restent dans l'UE.
export const config = { path: '/api/achat', region: 'fra' };
