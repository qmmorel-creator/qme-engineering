// Chaque matin : rappels de l'essai gratuit par e-mail (fin dans 3 jours, essai terminé, effacement dans 7 jours),
// accompagnement des acheteurs 3 jours après l'achat (tournerSuivisAchat, achats.mjs)
// et effacement des essais terminés depuis plus de 30 jours ; purge des traces anti-abus des comptes (comptes.mjs). Logique : tournerEssais (netlify/lib/essais.mjs).
import { getStore } from '@netlify/blobs';
import { tournerEssais } from '../lib/essais.mjs';
import { tournerSuivisAchat } from '../lib/achats.mjs';
import { purgerComptes } from '../lib/comptes.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais, storeDonnees } from '../lib/essais-store.mjs';

export default async () => {
  const envoyer = envoyeurDepuisEnv();
  const bilan = await tournerEssais({
    secret: process.env.TEMPLATES_SECRET,
    essais: storeEssais(getStore),
    stockage: storeDonnees(getStore),
    envoyer,
    testeurs: process.env.ESSAI_TESTEURS || '',
  });
  console.log('Essais gratuits :', JSON.stringify(bilan));
  console.log('Accompagnements d\'achat :', JSON.stringify(await tournerSuivisAchat({ secret: process.env.TEMPLATES_SECRET, essais: storeEssais(getStore), envoyer })));
  // Comptes acheteurs : traces anti-abus (demandes de lien, liens utilisés) devenues inutiles.
  console.log('Comptes :', JSON.stringify(await purgerComptes({ store: storeEssais(getStore) })));
};

// 8:10 UTC (9:10 à Paris l'hiver, 10:10 l'été) : rappels reçus le matin, jamais la nuit.
export const config = { schedule: '10 8 * * *', region: 'fra' };
