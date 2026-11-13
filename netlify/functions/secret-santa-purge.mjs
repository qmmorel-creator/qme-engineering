// Effacement automatique des échanges Secret Santa, chaque jour : tout échange arrivé à sa date
// d'effacement (60 jours après sa date, 180 jours après sa création sans date) est supprimé avec
// ses participants, même si personne ne l'ouvre plus. Logique : purgerExpires (templates/secret-santa/moteur.js).
import { getStore } from '@netlify/blobs';
import { purgerExpires } from '../../templates/secret-santa/moteur.js';

export default async () => {
  const store = getStore({ name: 'secret-santa', consistency: 'strong', region: 'eu-central-1' });
  const n = await purgerExpires({
    stockage: {
      get: (cle) => store.get(cle, { type: 'json' }),
      set: (cle, valeur) => store.setJSON(cle, valeur),
      supprimer: (cle) => store.delete(cle),
      lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
    },
  });
  console.log(`Secret Santa : ${n} échange(s) effacé(s)`);
};

export const config = { schedule: '@daily' };
