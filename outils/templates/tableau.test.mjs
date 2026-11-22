// Tableau de bord administrateur (/api/tableau) : sources réunies, sections indépendantes, accès administrateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tableau, traiterTableau, nomSource, nomPays, joursDe, decaler } from '../../netlify/lib/tableau.mjs';
import { codeAdmin } from '../../netlify/lib/templates-acces.mjs';
import { ajouterAchat } from '../../netlify/lib/comptes.mjs';

const SECRET = 't'.repeat(40);
const T0 = Date.parse('2026-11-22T12:00:00+01:00');
const memoire = () => { const m = new Map(); return { m, get: async (k) => structuredClone(m.get(k) ?? null), set: async (k, v) => { m.set(k, structuredClone(v)); }, supprimer: async (k) => { m.delete(k); }, lister: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };
const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-' + 'a'.repeat(30) + '/pub';
const CSV = {
  540567426: 'Relevé le,Réseau,Abonnés,Source,Remarque\n2026-10-01 08:00,Instagram,40,,\n2026-11-22 08:00,Instagram,53,,\n2026-11-22 08:00,LinkedIn,65,,\n',
  783077974: "Relevé le,Réseau,ID,Vues\n2026-11-20 08:00,LinkedIn,LI-01,50\n2026-11-21 08:00,LinkedIn,LI-01,80\n2026-11-21 08:00,Instagram,IG-01,30\n",
  1203235184: 'id,created_at,product_name,price_cents,net_cents,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,discount_code,refunded,chargedback\n'
    + 'a,2026-11-20T11:13:19Z,Gestionnaire de tâches,2082,1733,https://qm-engineering.fr/,,,,,,,FALSE,FALSE\n'
    + 'b,2026-11-18T20:52:25Z,Compte rendu,0,0,direct,,,,,,QME-TEST,FALSE,FALSE\n'
    + 'c,2026-11-19T10:00:00Z,Mon Budget,1500,1200,https://www.google.com/,,,,,,,TRUE,FALSE\n'
    + 'd,2026-08-01T10:00:00Z,Mon Budget,1500,1200,direct,,,,,,,FALSE,FALSE\n',
  1412341743: 'product_name,views,sales,revenue_cents\nSecret Santa,22,0,0\nGestionnaire de tâches,12,1,2082\n',
  375719535: 'referrer,views,sales,revenue_cents\ndirect,247,1,0\nGoogle,5,0,0\n',
};
const GC = {
  '/stats/total': { total: 120, total_events: 10, stats: [{ day: '2026-11-21', daily: 70 }, { day: '2026-11-22', daily: 50 }, { day: '2026-01-01', daily: 999 }] },
  '/stats/hits': { hits: [{ path: '/', title: 'Accueil', count: 80 }, { path: 'clic-essai', event: true, count: 9 }, { path: '/templates', title: 'Templates', count: 30 }] },
  '/stats/toprefs': { stats: [{ name: '', count: 60 }, { name: 'https://www.google.com', count: 20 }, { name: 'Google', count: 5 }, { name: 'qm-engineering.fr/templates', count: 40 }, { name: 'ig', count: 3 }] },
  '/stats/locations': { stats: [{ id: 'FR', name: 'France', count: 100 }, { id: 'US', name: 'United States', count: 20 }] },
};
function recuperer(appels = []) {
  return async (url, options = {}) => {
    appels.push({ url, auth: options.headers?.authorization });
    const u = new URL(url);
    if (u.hostname === 'api.frankfurter.dev') return { ok: true, status: 200, json: async () => ({ base: 'USD', date: '2026-11-20', rates: { EUR: 0.91 } }) };
    if (u.hostname === 'docs.google.com') { const t = CSV[u.searchParams.get('gid')]; return { ok: Boolean(t), status: t ? 200 : 404, text: async () => t || '<html>' }; }
    const cle = u.pathname.replace('/api/v0', '');
    return { ok: true, status: 200, json: async () => GC[cle] };
  };
}

test('outils : périodes, sources de trafic, pays', () => {
  assert.equal(joursDe('2026-11-20', '2026-11-22').length, 3);
  assert.equal(decaler('2026-11-01', -1), '2026-10-31');
  assert.equal(nomSource(''), 'Accès direct');
  assert.equal(nomSource('https://www.google.fr/search'), 'Google');
  assert.equal(nomSource('qm-engineering.fr/templates'), null, 'navigation interne exclue');
  assert.equal(nomSource('ig'), 'Instagram');
  assert.equal(nomSource('https://lnkd.in/x'), 'LinkedIn');
  assert.equal(nomPays('US', 'United States'), 'États-Unis');
});

test('tableau : audience, réseaux, ventes, essais, comptes et entonnoir sur 30 jours', async () => {
  const store = memoire(), appels = [];
  // Essais : un réel (acheté), un réel en cours, un test (exclu)
  await store.set('stat/e1', { id: 'e1', produit: 'BDG', cree: '2026-11-20T09:00:00Z', achete: '2026-11-21T09:00:00Z', test: false });
  await store.set('essai/e2', { id: 'e2', produit: 'TCH', email: 'lea@exemple.fr', cree: '2026-11-21T09:00:00Z', debut: '2026-11-21', fin: '2026-12-05' });
  await store.set('essai/e3', { id: 'e3', produit: 'TCH', email: 'quentin@qm-engineering.fr', cree: '2026-11-21T09:00:00Z', debut: '2026-11-21', fin: '2026-12-05' });
  await ajouterAchat({ secret: SECRET, store, email: 'camille@exemple.fr', vente: { type: 'template', code: 'BDG' }, licence: 'ABCDEF01-23456789-ABCDEF01-23456789', maintenant: () => T0 });
  const interets = { lister: async (p) => (p === 'clic/' ? ['clic/repas/2026-11-20T10:00:00.000Z~AAAAAAAA'] : []) };
  const t = await tableau({ secret: SECRET, store, interets, goatcounter: { token: 'jeton' }, sheetBase: SHEET, recuperer: recuperer(appels), jours: 30, maintenant: () => T0 });
  assert.deepEqual(t.periode, { debut: '2026-10-24', fin: '2026-11-22', jours: 30 });
  assert.ok(appels.filter((a) => a.url.includes('goatcounter')).every((a) => a.auth === 'Bearer jeton' && a.url.includes('start=2026-10-24&end=2026-11-22')));
  // Audience
  assert.equal(t.audience.vues, 120);
  assert.equal(t.audience.parJour.length, 30);
  assert.deepEqual(t.audience.parJour.slice(-2).map((j) => j.n), [70, 50], 'jours hors période ignorés');
  assert.deepEqual(t.audience.pages.map((p) => p.chemin), ['/', '/templates'], 'événements exclus');
  assert.deepEqual(t.audience.sources, [{ nom: 'Accès direct', n: 60 }, { nom: 'Google', n: 25 }, { nom: 'Instagram', n: 3 }]);
  assert.equal(t.audience.pays[0].nom, 'France');
  // Réseaux
  assert.deepEqual(t.reseaux.abonnes.map((a) => [a.reseau, a.n, a.evolution]), [['LinkedIn', 65, 0], ['Instagram', 53, 13]]);
  assert.equal(t.reseaux.total, 118);
  assert.deepEqual(t.reseaux.vuesPublications, [{ nom: 'LinkedIn', n: 80 }, { nom: 'Instagram', n: 30 }], 'dernier relevé par publication');
  // Ventes : payées seulement, remboursée et hors période exclues
  assert.equal(t.ventes.nombre, 1); assert.equal(t.ventes.gratuites, 1); assert.equal(t.ventes.remboursees, 1);
  assert.equal(t.ventes.revenu, 2082); assert.equal(t.ventes.vuesGumroad, 34);
  assert.deepEqual(t.ventes.totalDepuisDebut, { nombre: 2, revenu: 3582 });
  // Conversion en euros (taux BCE)
  assert.deepEqual({ taux: t.ventes.eur.taux, date: t.ventes.eur.date, revenu: t.ventes.eur.revenu, net: t.ventes.eur.net, total: t.ventes.eur.totalDepuisDebut },
    { taux: 0.91, date: '2026-11-20', revenu: 1895, net: 1577, total: 3260 });
  // Essais : tests exclus
  assert.equal(t.essais.lances, 2); assert.equal(t.essais.achetes, 1); assert.equal(t.essais.enCours, 1); assert.equal(t.essais.tests, 1);
  assert.deepEqual(t.essais.parTemplate.map((p) => [p.produit, p.essais, p.achetes]), [['TCH', 1, 0], ['BDG', 1, 1]]);
  // Comptes, intérêts, entonnoir
  assert.equal(t.comptes.acheteurs, 1);
  assert.equal(t.interets.total, 1);
  assert.deepEqual(t.entonnoir, { visites: 120, essais: 2, ventes: 1 });
});

test('tableau : sources absentes ou en panne sans bloquer le reste ; accès administrateur', async () => {
  const store = memoire();
  const t = await tableau({ secret: SECRET, store, recuperer: async () => { throw new Error('réseau'); }, jours: 7, maintenant: () => T0 });
  assert.equal(t.audience.configure, false);
  assert.equal(t.ventes.configure, false);
  assert.equal(t.essais.lances, 0);
  assert.equal(t.periode.jours, 7);
  const panne = await tableau({ secret: SECRET, store, goatcounter: { token: 'x' }, sheetBase: SHEET, recuperer: async () => { throw new Error('réseau'); }, jours: 90, maintenant: () => T0 });
  assert.equal(panne.audience.erreur, 'réseau');
  assert.equal(panne.ventes.configure, true, 'Sheet configuré mais onglets illisibles');
  assert.equal(panne.periode.jours, 90);
  assert.equal(panne.ventes.eur, undefined, 'taux indisponible : dollars seulement');
  const req = (code) => traiterTableau(new Request('http://t/api/tableau?jours=7', { headers: code ? { 'x-admin': code } : {} }), { secret: SECRET, store, recuperer: async () => { throw new Error('x'); }, maintenant: () => T0 });
  assert.equal((await req()).status, 401);
  assert.equal((await req('ADM-FAUX')).status, 401);
  assert.equal((await req(codeAdmin(SECRET))).status, 200);
});
