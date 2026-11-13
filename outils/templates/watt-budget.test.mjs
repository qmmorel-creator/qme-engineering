// Tests du moteur de WattBudget (templates/watt-budget/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/watt-budget/donnees.js', '../../templates/watt-budget/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.WTT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const proche = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const app = (extra) => R.normaliserAppareil({ id: 'a', nom: 'Test', cat: 'cuisine', mode: 'duree', quantite: 1, puissance: 1000, heures: 1, jours: 7, mois: 12, ...extra });
const tarif = (extra = {}) => R.normaliserReglages({ option: 'base', prix: 0.2, ...extra });

test('catalogue : cohérent, calculable, sans tarif', () => {
  const cats = new Set(BASE.categories.map((c) => c.id));
  assert.ok(BASE.appareils.length >= 40);
  const ids = new Set();
  for (const c of BASE.appareils) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    assert.ok(cats.has(c.cat), c.id);
    const a = R.depuisCatalogue(c.id);
    const r = R.consommation(a);
    assert.ok(r.ok, `${c.id} : ${r.erreur}`);
    assert.ok(r.total > 0 && r.total < 10000, `${c.id} : ${r.total} kWh/an`);
  }
  assert.equal(JSON.stringify(BASE.appareils).match(/€|prix|tarif/gi), null, 'aucun prix dans le catalogue');
  assert.ok(!('tarifs' in BASE) && !('prix' in BASE), 'aucun tarif par défaut');
  assert.equal(R.depuisCatalogue('inconnu'), null);
});

test('mode durée : puissance × heures × jours × semaines × saison', () => {
  const r = R.consommation(app());
  proche(r.total, 365); // 1 kW × 1 h × 365 j
  assert.equal(r.fiabilite, 'estimee');
  assert.equal(r.formule, '1 000 W × 1 h × 7 j/sem × 52,14 sem = 365 kWh/an');
  proche(R.consommation(app({ jours: 5 })).total, (1 * 5 * 365) / 7);
  proche(R.consommation(app({ mois: 6 })).total, 182.5);
  proche(R.consommation(app({ quantite: 3 })).total, 1095);
  assert.match(R.consommation(app({ quantite: 3 })).formule, /^3 × \(/);
});

test('veille ajoutée toute l\'année et bornée à 24 h par jour', () => {
  const r = R.consommation(app({ heures: 4, veille: 2, veilleH: 20 }));
  proche(r.veille, (2 * 20 * 365) / 1000);
  proche(r.total, 4 * 365 + 14.6);
  assert.match(r.formule, /veille 2 W × 20 h × 365 j/);
  assert.match(R.consommation(app({ heures: 6, veille: 2, veilleH: 20 })).erreur, /24 h/);
  assert.ok(R.consommation(app({ heures: 6, veille: 0, veilleH: 20 })).ok, 'heures de veille ignorées si la veille est nulle');
});

test('modes cycles, étiquette et mesure', () => {
  const c = R.consommation(app({ mode: 'cycles', kwhCycle: 1, cycles: 7 }));
  proche(c.total, 365);
  const e = R.consommation(app({ mode: 'annuel', kwhAn: 230, veille: 5, veilleH: 24, mois: 3 }));
  assert.equal(e.total, 230); // étiquette : veille et saison déjà comprises
  assert.equal(e.fiabilite, 'etiquette');
  const m = R.consommation(app({ mode: 'mesure', mesureKwh: 4.2, mesureJours: 7 }));
  proche(m.total, 219);
  assert.equal(m.fiabilite, 'mesuree');
  assert.equal(m.formule, '4,2 kWh ÷ 7 j × 365 j = 219 kWh/an');
});

test('erreurs de saisie : manquant, nul, négatif, extrême', () => {
  const err = (x) => R.consommation(app(x)).erreur;
  assert.match(err({ puissance: null }), /Puissance.*manquante/);
  assert.match(err({ puissance: 0 }), /supérieure à 0/);
  assert.match(R.consommation({ ...app(), puissance: -5 }).erreur, /négative/);
  assert.match(err({ puissance: 90000 }), /50 000 au maximum/);
  assert.match(err({ heures: 25 }), /24 au maximum/);
  assert.match(err({ jours: 8 }), /7 au maximum/);
  assert.match(err({ mois: 0 }), /au moins 1/);
  assert.match(R.consommation({ ...app(), nom: '' }).erreur, /nom/);
  assert.match(R.consommation({ ...app(), quantite: 0 }).erreur, /Quantité/);
  assert.match(R.consommation({ ...app(), quantite: 1.5 }).erreur, /Quantité/);
  assert.match(err({ mode: 'mesure', mesureKwh: 3, mesureJours: 0 }), /Durée de la mesure/);
  assert.match(err({ mode: 'cycles', kwhCycle: null, cycles: 3 }), /cycle/);
  assert.equal(R.consommation(app({ puissance: null })).total, 0);
});

test('prix : base, heures pleines / heures creuses, tarif absent', () => {
  assert.equal(R.cout(365, 0.2), 7300);
  assert.equal(R.cout(365, null), null);
  const hc = tarif({ option: 'hphc', prixHP: 0.25, prixHC: 0.18 });
  assert.equal(R.prixKwh(app({ horaire: 'hc' }), hc), 0.18);
  assert.equal(R.prixKwh(app(), hc), 0.25);
  assert.equal(R.tarifComplet(R.normaliserReglages({})), false);
  assert.equal(R.tarifComplet(tarif({ option: 'hphc', prixHP: 0.25 })), false);
  const t = R.totaux([app()], R.normaliserReglages({}));
  proche(t.kwh, 365);
  assert.equal(t.cout, null);
  assert.equal(t.parMois, null);
});

test('totaux : coûts jour, mois, an, abonnement, catégories, Pareto, fiabilité, facture', () => {
  const appareils = [
    app({ id: 'a1', nom: 'Radiateur', cat: 'chauffage', puissance: 1500, heures: 6, mois: 5 }),
    app({ id: 'a2', nom: 'Frigo', cat: 'electromenager', mode: 'annuel', kwhAn: 200 }),
    app({ id: 'a3', nom: 'Box', cat: 'informatique', puissance: 12, heures: 24 }),
    app({ id: 'a4', nom: 'Congélateur mesuré', cat: 'electromenager', mode: 'mesure', mesureKwh: 3.5, mesureJours: 7 }),
    app({ id: 'a5', nom: 'Erreur', puissance: null }),
  ];
  const t = R.totaux(appareils, tarif({ abonnement: 15000, factureKwh: 4000 }));
  const rad = 1.5 * 6 * 365 * (5 / 12);
  const kwh = rad + 200 + (12 * 24 * 365) / 1000 + 182.5;
  proche(t.kwh, kwh);
  assert.equal(t.erreurs, 1);
  assert.equal(t.cout, Math.round(rad * 20) + 4000 + Math.round(105.12 * 20) + 3650);
  assert.equal(t.parMois, Math.round(t.cout / 12));
  assert.equal(t.parJour, Math.round(t.cout / 365));
  assert.equal(t.facture, t.cout + 15000);
  assert.equal(t.postes[0].nom, 'Radiateur');
  assert.equal(t.postes.at(-1).cumul, 100);
  assert.deepEqual(simple(t.parCat.map((c) => c.cat)), ['chauffage', 'electromenager', 'informatique']);
  assert.deepEqual(simple(t.fiabilite), { mesuree: 1, etiquette: 1, estimee: 2 });
  proche(t.couverture, Math.round((kwh / 4000) * 1000) / 10, 0.11);
  assert.equal(R.totaux([], tarif()).kwh, 0);
  assert.deepEqual(simple(R.totaux([], tarif()).postes), []);
});

test('remplacement : économie, temps de retour, cas sans économie', () => {
  const r = R.remplacement({ kwhAvant: 400, kwhApres: 150, prix: 0.2, prixAchat: 50000, dureeVie: 12 });
  assert.equal(r.economieKwh, 250);
  assert.equal(r.economieAn, 5000);
  assert.equal(r.retourAns, 10);
  assert.equal(r.retourMois, 120);
  assert.equal(r.rentableSurVie, true);
  assert.equal(r.bilanVie, 10000);
  const pire = R.remplacement({ kwhAvant: 150, kwhApres: 200, prix: 0.2, prixAchat: 30000, dureeVie: 10 });
  assert.equal(pire.retourAns, null);
  assert.equal(pire.economieAn, -1000);
  assert.equal(R.remplacement({ kwhAvant: 100, kwhApres: 50, prix: 0.2, prixAchat: 0 }).retourAns, 0);
  assert.equal(R.remplacement({ kwhAvant: 100, kwhApres: 50, prix: null, prixAchat: 100 }).ok, false);
  assert.equal(R.remplacement({ kwhAvant: 100, kwhApres: 50, prix: 0.2, prixAchat: null }).ok, false);
  assert.equal(R.remplacement({ kwhAvant: null, kwhApres: 50, prix: 0.2, prixAchat: 10 }).ok, false);
});

test('scénarios : chaque action, original intact, cumul', () => {
  const appareils = [app({ id: 'tv', heures: 4, veille: 2, veilleH: 20 }), app({ id: 'ce', puissance: 2000, heures: 3 }), app({ id: 'x', puissance: 100 })];
  const r = tarif({ option: 'hphc', prixHP: 0.25, prixHC: 0.2 });
  const sc = R.normaliserScenario({ nom: 'Test', actions: [
    { appareilId: 'tv', type: 'veille' }, { appareilId: 'tv', type: 'duree', valeur: 25 },
    { appareilId: 'ce', type: 'hc' }, { appareilId: 'x', type: 'retirer' }, { appareilId: 'inconnu', type: 'veille' }, { appareilId: 'x', type: 'bidon' },
  ] }, ['tv', 'ce', 'x']);
  assert.equal(sc.actions.length, 4);
  const res = R.resultatScenario(appareils, sc, r);
  proche(res.apres.kwh, 4 * 365 * 0.75 + 6 * 365);
  proche(res.economieKwh, 365 + 14.6 + 0.1 * 365);
  assert.ok(res.economie > 0);
  assert.equal(appareils[0].veille, 2, 'original non modifié');
  const ap = R.appliquer(appareils, [{ appareilId: 'ce', type: 'remplacer', valeur: 500 }]);
  assert.equal(ap[1].mode, 'annuel');
  assert.equal(R.consommation(ap[1]).total, 500);
  assert.equal(R.appliquer(appareils, [{ appareilId: 'tv', type: 'duree', valeur: 150 }])[0].facteur, 0);
});

test('normalisation : sauvegarde abîmée', () => {
  const e = R.normaliser({ reglages: { option: 'zzz', prix: '0,2016', prixHC: -1, abonnement: 'x' }, appareils: [{ nom: '', mode: 'bidon', quantite: 0, puissance: 'abc' }], scenarios: [{ actions: [{ appareilId: 'nope', type: 'veille' }] }] });
  assert.equal(e.reglages.option, 'base');
  assert.equal(e.reglages.prix, 0.2016);
  assert.equal(e.reglages.prixHC, null);
  assert.equal(e.reglages.abonnement, null);
  const a = e.appareils[0];
  assert.equal(a.nom, 'Appareil');
  assert.equal(a.mode, 'duree');
  assert.equal(a.quantite, 1);
  assert.equal(a.puissance, null);
  assert.equal(R.consommation(a).ok, false);
  assert.equal(e.scenarios[0].actions.length, 0);
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
  assert.equal(R.normaliser(null).appareils.length, 0);
});

test('export CSV', () => {
  const e = R.normaliser({ reglages: { prix: 0.2 }, appareils: [app({ nom: 'Bouilloire; 1,7 L' }), app({ nom: 'Cassé', puissance: null })] });
  const c = R.csvAppareils(e);
  assert.equal(c.length, 3);
  assert.equal(c[1][0], 'Bouilloire; 1,7 L');
  assert.equal(c[1][17], '365');
  assert.equal(c[1][20], '73,00');
  assert.equal(c[1][21], '6,08');
  assert.match(c[2].at(-1), /Puissance/);
  const O = ctx.window.QME_OUTILS;
  assert.deepEqual(simple(O.lireCsv(O.versCsv(c)))[1][0], 'Bouilloire; 1,7 L');
});
