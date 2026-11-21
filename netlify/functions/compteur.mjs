// Compteur réseaux QME : logique dans netlify/lib/compteur.mjs.
import { getStore } from '@netlify/blobs';
import { traiterCompteur } from '../lib/compteur.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => traiterCompteur(requete, {
  motDePasse: process.env.COMPTEUR_MOT_DE_PASSE,
  base: process.env.COMPTEUR_SHEET_PUB,
  essais: storeEssais(getStore), // essais gratuits : statistiques anonymes uniquement
});

export const config = { path: '/api/compteur', region: 'fra' };
