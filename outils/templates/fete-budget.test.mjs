// Tests du moteur de FêteBudget (templates/fete-budget/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/fete-budget/donnees.js', '../../templates/fete-budget/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.FTB;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const inv = (n, type, statut = 'confirme') => Array.from({ length: n }, (_, i) => ({ id: `${type}${statut}${i}`, nom: `${type} ${i}`, type, statut }));
const fete = (extra = {}) => R.normaliser({
  evenement: { nom: 'Test', formule: 'barbecue', duree: 4, date: '2026-12-12', budgetMode: 'global', budgetGlobal: 50000, ...(extra.evenement || {}) },
  invites: [...inv(10, 'adulte'), ...inv(4, 'enfant'), ...inv(2, 'adulte', 'attente'), ...inv(3, 'adulte', 'decline')],
  ...extra, evenement: { nom: 'Test', formule: 'barbecue', duree: 4, date: '2026-12-12', budgetMode: 'global', budgetGlobal: 50000, ...(extra.evenement || {}) },
});

test('base : formules couvertes, aucun prix', () => {
  const formules = BASE.formules.map((f) => f.id);
  for (const b of BASE.besoins) for (const f of formules) assert.ok(typeof b.q[f] === 'number' && b.q[f] >= 0, `${b.id}/${f}`);
  for (const t of BASE.types) assert.ok(formules.includes(t.formule));
  assert.equal(JSON.stringify(BASE.besoins).match(/prix|€/gi), null);
  assert.match(BASE.sourceQuantites, /indicatives/);
});

test('invités : attendus (sans les déclinés) ou confirmés seulement', () => {
  const e = fete();
  assert.deepEqual(simple(R.compte(e.invites)), { adultes: 12, enfants: 4, total: 16, confirmes: 14, attente: 2, declines: 3 });
  assert.equal(R.compte(e.invites, 'confirmes').total, 14);
  assert.equal(R.compte([]).total, 0);
});

test('besoins : formule, coefficient enfant, durée, conditionnement', () => {
  const e = fete();
  const b = (id) => R.besoins(e).find((x) => x.besoin.id === id);
  // Grillades : 250 g × (12 + 4 × 0,5) = 3 500 g → 4 kg.
  assert.equal(b('grillades').quantite, 3500); assert.equal(b('grillades').nbCond, 4);
  // Eau : 0,3 L × 4 h × (12 + 4) = 19,2 L → 13 bouteilles de 1,5 L.
  assert.equal(b('eau').quantite, 19.2); assert.equal(b('eau').nbCond, 13);
  // Vin : adultes seulement, 0,25 L × 12 = 3 L → 4 bouteilles.
  assert.equal(b('vin').quantite, 3); assert.equal(b('vin').nbCond, 4);
  // Pièces : arrondi à l'unité supérieure. 4 × (12 + 4 × 0,5) = 56.
  assert.equal(b('aperitifs').quantite, 56);
  assert.equal(b('plat'), undefined, 'pas de plat principal au barbecue');
  const g = fete({ evenement: { formule: 'gouter', duree: 3 } });
  assert.equal(R.besoins(g).find((x) => x.besoin.id === 'bonbons').quantite, 320, 'friandises : enfants seulement (80 g × 4)');
  const vide = R.normaliser({ evenement: { formule: 'repas' } });
  assert.deepEqual(simple(R.besoins(vide)), [], 'sans invité : aucun besoin');
});

test('besoins : ajustement de quantité et prix, coût estimé', () => {
  const e = fete({ ajustements: { vin: { quantite: 1.5, prix: 650 }, eau: { prix: 45 }, bonbons: { quantite: 0 } } });
  const b = (id) => R.besoins(e).find((x) => x.besoin.id === id);
  assert.equal(b('vin').quantite, 1.5); assert.equal(b('vin').ajuste, true); assert.equal(b('vin').nbCond, 2); assert.equal(b('vin').cout, 1300);
  assert.equal(b('eau').cout, 13 * 45, 'prix par conditionnement');
  assert.equal(b('pain').cout, null);
  assert.ok(b('bonbons'), 'ligne ajustée à 0 conservée pour être visible');
});

test('budget global ou par personne, montant retenu, restant, dépassement', () => {
  const e = fete({ depenses: [
    { categorie: 'lieu', libelle: 'Location', prevu: 20000, reel: 18000 },
    { categorie: 'repas', libelle: 'Viande', prevu: 9000, reel: null },
    { categorie: 'boissons', libelle: 'Boissons', prevu: null, reel: 4500 },
  ] });
  const t = R.totaux(e);
  assert.equal(t.prevu, 29000); assert.equal(t.reel, 22500); assert.equal(t.retenu, 31500);
  assert.equal(t.budget, 50000); assert.equal(t.restant, 18500); assert.equal(t.depasse, false);
  assert.equal(t.parPersonne, Math.round(31500 / 16));
  assert.equal(t.ecart, 22500 - 20000, 'écart réel − prévu sur les dépenses payées');
  assert.equal(t.parCat.find((x) => x.categorie === 'repas').aPayer, 1);
  const pp = fete({ evenement: { budgetMode: 'parPersonne', budgetParPersonne: 1500 } });
  assert.equal(R.budget(pp), 24000);
  const dep = fete({ evenement: { budgetGlobal: 1000 }, depenses: [{ libelle: 'X', prevu: 2000 }] });
  assert.equal(R.totaux(dep).depasse, true); assert.equal(R.totaux(dep).restant, -1000);
  assert.equal(R.totaux(fete({ evenement: { budgetGlobal: null } })).restant, null);
});

test('scénarios : dépenses communes et propres, comparaison', () => {
  const e = fete({ scenarios: [{ id: 'traiteur', nom: 'Traiteur' }, { id: 'maison', nom: 'Fait maison' }], depenses: [
    { libelle: 'Salle', categorie: 'lieu', prevu: 20000 },
    { libelle: 'Traiteur', categorie: 'repas', prevu: 40000, scenarios: ['traiteur'] },
    { libelle: 'Courses', categorie: 'repas', prevu: 15000, scenarios: ['maison'] },
    { libelle: 'Inconnu', categorie: 'repas', prevu: 1, scenarios: ['nimporte'] },
  ] });
  assert.equal(e.depenses[3].scenarios.length, 0, 'scénario inconnu retiré : dépense commune');
  const c = R.comparaison(e);
  assert.deepEqual(simple(c.map((x) => x.retenu)), [60001, 35001]);
  assert.equal(c[1].parCat.repas, 15001);
  assert.equal(R.totaux(e, 'maison').restant, 50000 - 35001);
});

test('répartition : quotes-parts au centime, parts inégales, minimum de virements', () => {
  const e = R.normaliser({
    participants: [{ id: 'a', nom: 'Alex', parts: 1 }, { id: 'b', nom: 'Bao', parts: 1 }, { id: 'c', nom: 'Cyd', parts: 1 }],
    depenses: [{ libelle: 'Courses', reel: 10000, payePar: 'a' }, { libelle: 'Boissons', reel: 0, payePar: 'b' }, { libelle: 'Non payé', prevu: 5000, payePar: 'c' }],
  });
  const r = R.repartition(e);
  assert.equal(r.total, 10000);
  assert.deepEqual(simple(r.soldes.map((s) => s.doit)), [3334, 3333, 3333], 'somme exacte : le centime restant va au premier');
  assert.equal(r.soldes.reduce((s, x) => s + x.solde, 0), 0);
  assert.equal(r.virements.length, 2);
  assert.ok(r.virements.every((v) => v.a === 'a'));
  assert.equal(r.virements.reduce((s, v) => s + v.montant, 0), 6666);
  const p = R.normaliser({ participants: [{ id: 'a', nom: 'Couple', parts: 2 }, { id: 'b', nom: 'Seul', parts: 1 }], depenses: [{ libelle: 'X', reel: 9000, payePar: 'b' }] });
  const rp = R.repartition(p);
  assert.deepEqual(simple(rp.virements), [{ de: 'a', deNom: 'Couple', a: 'b', aNom: 'Seul', montant: 6000 }]);
  assert.deepEqual(simple(R.repartition(R.normaliser({})).virements), []);
  const equilibre = R.normaliser({ participants: [{ id: 'a', nom: 'A' }, { id: 'b', nom: 'B' }], depenses: [{ reel: 500, payePar: 'a' }, { reel: 500, payePar: 'b' }] });
  assert.deepEqual(simple(R.repartition(equilibre).virements), []);
});

test('préparation : dates depuis le jour J, tâches personnelles, sans date', () => {
  const e = fete({ tachesPerso: [{ id: 't1', j: -3, texte: 'Acheter les bougies' }], faites: { p0: true } });
  const t = R.taches(e);
  assert.equal(t[0].date, '2026-10-28');
  assert.equal(t[0].faite, true);
  const perso = t.find((x) => x.id === 't1');
  assert.equal(perso.date, '2026-12-09'); assert.equal(perso.perso, true);
  assert.ok(t.findIndex((x) => x.id === 't1') > t.findIndex((x) => x.j === -5), 'triées par échéance');
  assert.equal(R.taches(R.normaliser({})).every((x) => x.date === null), true);
});

test('normalisation : sauvegarde abîmée', () => {
  const e = R.normaliser({ evenement: { formule: 'zzz', duree: 99, budgetGlobal: -5, budgetMode: 'x', date: '2026-02-30' }, invites: [{ type: 'chat', statut: 'oui' }], participants: [{ parts: 0 }], depenses: [{ prevu: 'abc', reel: 1.5, payePar: 'inconnu', categorie: 'zz' }], ajustements: { inconnu: { quantite: 3 }, vin: { quantite: -1, prix: 'x' }, eau: { quantite: '2,5' } }, scenarioActif: 'nope' });
  assert.equal(e.evenement.formule, 'buffet'); assert.equal(e.evenement.duree, 4); assert.equal(e.evenement.budgetGlobal, null); assert.equal(e.evenement.budgetMode, 'global'); assert.equal(e.evenement.date, null);
  assert.equal(e.invites[0].type, 'adulte'); assert.equal(e.invites[0].statut, 'attente');
  assert.equal(e.participants[0].parts, 1);
  assert.equal(e.depenses[0].prevu, null); assert.equal(e.depenses[0].reel, 2); assert.equal(e.depenses[0].payePar, null); assert.equal(e.depenses[0].categorie, 'divers');
  assert.deepEqual(simple(e.ajustements), { eau: { quantite: 2.5, prix: null } });
  assert.equal(e.scenarioActif, 'base');
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('exports CSV', () => {
  const e = fete({ participants: [{ id: 'a', nom: 'Alex' }], depenses: [{ categorie: 'lieu', libelle: 'Salle; jardin', prevu: 12050, reel: 11000, payePar: 'a' }], ajustements: { vin: { prix: 650 } } });
  const d = R.csvDepenses(e);
  assert.deepEqual(simple(d[1]), ['Lieu', 'Salle; jardin', '120,50', '110,00', '110,00', 'Alex', 'Tous', '']);
  assert.equal(R.csvInvites(e).length, 20);
  const c = R.csvCourses(e);
  const vin = c.find((x) => x[1].startsWith('Vin'));
  assert.deepEqual(simple(vin.slice(2)), ['3', 'L', '4 × bouteille de 75 cl', '6,50', '26,00']);
});
