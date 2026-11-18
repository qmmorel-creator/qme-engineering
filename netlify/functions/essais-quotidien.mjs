// Essai gratuit, chaque matin : rappels par e-mail (fin dans 3 jours, essai terminé, effacement dans 7 jours)
// et effacement des essais terminés depuis plus de 30 jours. Logique : tournerEssais (netlify/lib/essais.mjs).
import { getStore } from '@netlify/blobs';
import { tournerEssais } from '../lib/essais.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais, storeDonnees } from '../lib/essais-store.mjs';

export default async () => {
  const bilan = await tournerEssais({
    secret: process.env.TEMPLATES_SECRET,
    essais: storeEssais(getStore),
    stockage: storeDonnees(getStore),
    envoyer: envoyeurDepuisEnv(),
  });
  console.log('Essais gratuits :', JSON.stringify(bilan));
};

// 8:10 UTC (9:10 à Paris l'hiver, 10:10 l'été) : rappels reçus le matin, jamais la nuit.
export const config = { schedule: '10 8 * * *', region: 'fra' };
