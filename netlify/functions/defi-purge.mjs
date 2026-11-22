// Effacement automatique des défis 7 jours, chaque jour : tout défi terminé depuis plus de 30 jours est supprimé
// avec ses participants, même si personne ne l'ouvre plus. Logique : purgerDefis (netlify/lib/defi.mjs).
import { purgerDefis } from '../lib/defi.mjs';
import { stockageDefi } from '../lib/defi-store.mjs';

export default async () => {
  const n = await purgerDefis({ stockage: stockageDefi() });
  console.log(`Défi 7 jours : ${n} défi(s) effacé(s)`);
};

// Exécutée à Francfort, comme les autres fonctions : aucune donnée des défis ne transite hors de l'UE.
export const config = { schedule: '@daily', region: 'fra' };
