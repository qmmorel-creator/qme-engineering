// Tableau de bord administrateur centralisé (/admin/) : GET /api/tableau?jours=7|30|90 (code administrateur).
// Logique dans netlify/lib/tableau.mjs ; ici, le branchement sur Netlify Blobs et les variables d'environnement.
import { getStore } from '@netlify/blobs';
import { traiterTableau } from '../lib/tableau.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => {
  const interets = getStore({ name: 'templates-interets', consistency: 'strong', region: 'eu-central-1' });
  // Données des applications : Francfort, plus l'ancienne région par défaut (enregistrements pas encore migrés).
  const donnees = [getStore({ name: 'templates-donnees', consistency: 'strong', region: 'eu-central-1' }), getStore({ name: 'templates-donnees', consistency: 'strong' })];
  return traiterTableau(requete, {
    secret: process.env.TEMPLATES_SECRET,
    admin: process.env.INTERETS_ADMIN,
    lecture: process.env.QME_LECTURE_TOKEN, // jeton de lecture seule (Nexora Optim › QME)
    store: storeEssais(getStore),
    donnees: {
      lister: async () => {
        const cles = [];
        for (const s of donnees) for await (const page of s.list({ paginate: true })) cles.push(...page.blobs.map((b) => b.key));
        return cles;
      },
      get: async (cle) => (await donnees[0].get(cle, { type: 'json' })) ?? donnees[1].get(cle, { type: 'json' }),
    },
    interets: { lister: async (prefixe) => (await interets.list({ prefix: prefixe })).blobs.map((b) => b.key) },
    goatcounter: { token: process.env.GOATCOUNTER_TOKEN, site: process.env.GOATCOUNTER_SITE },
    sheetBase: process.env.COMPTEUR_SHEET_PUB,
    testeurs: process.env.ESSAI_TESTEURS || '',
  });
};

export const config = { path: '/api/tableau', region: 'fra' };
