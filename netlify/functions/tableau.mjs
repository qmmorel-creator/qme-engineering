// Tableau de bord administrateur centralisé (/admin/) : GET /api/tableau?jours=7|30|90 (code administrateur).
// Logique dans netlify/lib/tableau.mjs ; ici, le branchement sur Netlify Blobs et les variables d'environnement.
import { getStore } from '@netlify/blobs';
import { traiterTableau } from '../lib/tableau.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => {
  const interets = getStore({ name: 'templates-interets', consistency: 'strong', region: 'eu-central-1' });
  return traiterTableau(requete, {
    secret: process.env.TEMPLATES_SECRET,
    admin: process.env.INTERETS_ADMIN,
    store: storeEssais(getStore),
    interets: { lister: async (prefixe) => (await interets.list({ prefix: prefixe })).blobs.map((b) => b.key) },
    goatcounter: { token: process.env.GOATCOUNTER_TOKEN, site: process.env.GOATCOUNTER_SITE },
    sheetBase: process.env.COMPTEUR_SHEET_PUB,
    testeurs: process.env.ESSAI_TESTEURS || '',
  });
};

export const config = { path: '/api/tableau', region: 'fra' };
