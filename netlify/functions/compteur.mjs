// Compteur réseaux QME : logique dans netlify/lib/compteur.mjs.
import { traiterCompteur } from '../lib/compteur.mjs';

export default async (requete) => traiterCompteur(requete, {
  motDePasse: process.env.COMPTEUR_MOT_DE_PASSE,
  base: process.env.COMPTEUR_SHEET_PUB,
});

export const config = { path: '/api/compteur', region: 'fra' };
