// API des templates QME : vérification du code d'accès et sauvegarde des données de l'acheteur.
// Logique dans netlify/lib/templates-acces.mjs ; ici, seulement le branchement sur Netlify Blobs.
//
// Données hébergées dans l'Union européenne (Francfort, eu-central-1) depuis le 13/11/2026.
// Avant, le stockage était ouvert sans région, donc dans la région par défaut de Netlify (us-east-2,
// Ohio) : chaque enregistrement encore présent là-bas est recopié à Francfort à sa première lecture,
// puis effacé de l'ancien stockage (stockageMigrant). Retirer l'ancien stockage une fois vide.
import { getStore } from '@netlify/blobs';
import { traiter, revoquesDepuis, stockageMigrant } from '../lib/templates-acces.mjs';

const NOM = 'templates-donnees';

export default async (requete) => {
  const europe = getStore({ name: NOM, consistency: 'strong', region: 'eu-central-1' });
  const ancien = getStore({ name: NOM, consistency: 'strong' });
  return traiter(requete, {
    secret: process.env.TEMPLATES_SECRET,
    revoques: revoquesDepuis(process.env.TEMPLATES_CODES_REVOQUES),
    stockage: stockageMigrant(
      { get: (cle) => europe.get(cle, { type: 'json' }), set: (cle, valeur) => europe.setJSON(cle, valeur) },
      { get: (cle) => ancien.get(cle, { type: 'json' }), supprimer: (cle) => ancien.delete(cle) },
    ),
  });
};

// Fonction exécutée à Francfort (fra) : les données des templates ne transitent pas hors de l'UE.
export const config = { path: '/api/templates/*', region: 'fra' };
