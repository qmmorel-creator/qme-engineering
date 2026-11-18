// Stores Netlify Blobs de l'essai gratuit (Francfort, comme les données des templates).
export function storeEssais(getStore) {
  const s = getStore({ name: 'templates-essais', consistency: 'strong', region: 'eu-central-1' });
  return {
    get: (cle) => s.get(cle, { type: 'json' }),
    set: (cle, valeur) => s.setJSON(cle, valeur),
    supprimer: (cle) => s.delete(cle),
    lister: async (prefixe) => {
      const cles = [];
      for await (const page of s.list({ prefix: prefixe, paginate: true })) cles.push(...page.blobs.map((b) => b.key));
      return cles;
    },
  };
}

export function storeDonnees(getStore) {
  const s = getStore({ name: 'templates-donnees', consistency: 'strong', region: 'eu-central-1' });
  return { get: (cle) => s.get(cle, { type: 'json' }), set: (cle, valeur) => s.setJSON(cle, valeur), supprimer: (cle) => s.delete(cle) };
}
