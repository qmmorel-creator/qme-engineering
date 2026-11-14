// Effacement automatique des classements publics de Gestion de compétition sportive, chaque jour : toute
// publication arrivée à sa date d'effacement (30 jours après la compétition, 90 jours après publication sans
// date) est supprimée, même si personne ne la lit plus. Logique : purgerExpires (templates/competition/moteur.js).
import { getStore } from '@netlify/blobs';
import { purgerExpires } from '../../templates/competition/moteur.js';

export default async () => {
  const store = getStore({ name: 'competition-public', consistency: 'strong', region: 'eu-central-1' });
  const n = await purgerExpires({
    stockage: {
      get: (cle) => store.get(cle, { type: 'json' }),
      supprimer: (cle) => store.delete(cle),
      lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
    },
  });
  console.log(`Compétition : ${n} classement(s) public(s) effacé(s)`);
};

// Exécutée à Francfort, comme les autres fonctions : aucune donnée ne transite hors de l'UE.
export const config = { schedule: '@daily', region: 'fra' };
