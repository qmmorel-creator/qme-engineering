// Stockage Netlify Blobs du défi 7 jours (Francfort, eu-central-1), partagé par /api/defi et la purge quotidienne.
import { getStore } from '@netlify/blobs';

export function stockageDefi() {
  const store = getStore({ name: 'defi-7-jours', consistency: 'strong', region: 'eu-central-1' });
  return {
    get: (cle) => store.get(cle, { type: 'json' }),
    set: (cle, valeur) => store.setJSON(cle, valeur),
    supprimer: (cle) => store.delete(cle),
    lister: async (prefixe) => (await store.list({ prefix: prefixe })).blobs.map((b) => b.key),
  };
}
