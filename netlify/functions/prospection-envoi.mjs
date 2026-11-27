// Envoi des campagnes ciblées de prospection : un mail au plus par passage, toutes les 2 minutes (25/11/2026 : plus de
// plafond global de 50 par jour). La fenêtre (lundi–samedi, 8 h–18 h heure de Paris) et l'éventuel plafond d'une
// campagne sont vérifiés dans netlify/lib/prospection.mjs, ce qui couvre l'heure d'hiver comme l'heure d'été :
// 300 passages utiles par jour, de 8:00 à 17:58 (30 par heure, sous le quota horaire de la boîte OVH).
import { getStore } from '@netlify/blobs';
import { envoyerSuivant } from '../lib/prospection.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async () => {
  const r = await envoyerSuivant({ secret: process.env.TEMPLATES_SECRET, store: storeEssais(getStore), envoyer: envoyeurDepuisEnv() });
  if (r.statut !== 'hors-fenetre') console.log('Prospection :', JSON.stringify(r));
};

// UTC : de 6:00 à 17:58, du lundi au samedi (8:00–18:00 à Paris en été comme en hiver après filtrage).
export const config = { schedule: '*/2 6-17 * * 1-6', region: 'fra' };
