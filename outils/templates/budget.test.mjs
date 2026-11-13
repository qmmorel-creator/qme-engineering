// Tests des règles métier du budget du foyer (templates/budget/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../templates/budget/regles.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const R = ctx.BDG;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Foyer de test : vérifié à la main.
function foyer() {
  return {
    debut: '2026-09',
    categories: [
      { id: 'logement', nom: 'Logement', groupe: 'besoins', enveloppe: 90000, sous: [] },
      { id: 'courses', nom: 'Courses', groupe: 'besoins', enveloppe: 50000, sous: [] },
      { id: 'vacances', nom: 'Vacances', groupe: 'envies', enveloppe: 10000, report: true, sous: [] },
      { id: 'sorties', nom: 'Sorties', groupe: 'envies', enveloppe: 15000, sous: [] },
      { id: 'epargne', nom: 'Épargne', groupe: 'epargne', enveloppe: 30000, sous: [] },
    ],
    sources: [{ id: 's1', nom: 'Salaire', prevu: 200000 }, { id: 's2', nom: 'Allocations', prevu: 10000 }],
    ajustements: { '2026-11': { courses: 55000 } },
    operations: [],
    fixes: [],
  };
}
const op = (date, montant, categorieId, type = 'depense', sourceId = null) => ({ id: `${date}-${montant}`, date, montant, categorieId, type, sourceId });

test('saisie des montants en centimes entiers', () => {
  assert.equal(R.versCentimes('12,50'), 1250);
  assert.equal(R.versCentimes('1 234,5 €'), 123450);
  assert.equal(R.versCentimes('0.05'), 5);
  assert.equal(R.versCentimes('7'), 700);
  assert.equal(R.versCentimes('+3'), 300);
  assert.equal(R.versCentimes('12,345'), null);
  assert.equal(R.versCentimes('-4'), null);
  assert.equal(R.versCentimes('abc'), null);
  assert.equal(R.versCentimes(''), null);
});

test('affichage à la française', () => {
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(5), '0,05 €');
  assert.equal(R.euros(-1000), '−10,00 €');
  assert.equal(R.euros(250, { signe: true }), '+2,50 €');
  assert.equal(R.eurosRonds(123456), '1 235 €');
  assert.equal(R.eurosRonds(-40), '0 €');
});

test('mois : ajout, longueur, écart', () => {
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ajoutMois('2026-03', -14), '2025-01');
  assert.equal(R.joursDansMois('2028-02'), 29);
  assert.equal(R.joursDansMois('2026-02'), 28);
  assert.equal(R.ecartMois('2025-11', '2026-02'), 3);
});

test('répartition au plus fort reste : somme exacte', () => {
  assert.deepEqual(simple(R.repartirPoids(100, [1, 1, 1])), [34, 33, 33]);
  assert.deepEqual(simple(R.repartirPoids(1000, [2, 1])), [667, 333]);
  assert.deepEqual(simple(R.repartirPoids(0, [5, 5])), [0, 0]);
  assert.deepEqual(simple(R.repartirPoids(50, [0, 0])), [0, 0]);
  const v = R.repartirPoids(123457, [200000, 10000, 3333]);
  assert.equal(v.reduce((s, x) => s + x, 0), 123457);
});

test('enveloppe du mois : ajustement puis montant par défaut', () => {
  const E = foyer();
  assert.equal(R.enveloppeDu(E, 'courses', '2026-11'), 55000);
  assert.equal(R.enveloppeDu(E, 'courses', '2026-10'), 50000);
  assert.equal(R.enveloppeDu(E, 'inconnue', '2026-10'), 0);
});

test('statut des enveloppes', () => {
  assert.equal(R.statutEnveloppe(10000, 5000), 'ok');
  assert.equal(R.statutEnveloppe(10000, 8999), 'ok');
  assert.equal(R.statutEnveloppe(10000, 9000), 'presque');
  assert.equal(R.statutEnveloppe(10000, 9999), 'presque');
  assert.equal(R.statutEnveloppe(10000, 10000), 'pile');
  assert.equal(R.statutEnveloppe(10000, 10001), 'depasse');
  assert.equal(R.statutEnveloppe(0, 500), 'hors');
  assert.equal(R.statutEnveloppe(0, 0), 'aucune');
  assert.equal(R.statutEnveloppe(-2000, 0), 'depasse');
});

test('report des restes : cumul positif et dépassement retiré', () => {
  const E = foyer();
  // Vacances (100 €/mois, report) : sept. 0 dépensé, oct. 50 €, nov. 260 €.
  // Disponible nov. = 100 + (100 − 0) + (100 − 50) = 250 → dépassé de 10 €.
  E.operations.push(op('2026-10-12', 5000, 'vacances'), op('2026-11-03', 26000, 'vacances'));
  // Sorties (150 €/mois, sans report) : oct. 300 € → aucun effet en novembre.
  E.operations.push(op('2026-10-20', 30000, 'sorties'));
  const nov = Object.fromEntries(R.etatEnveloppes(E, '2026-11').map((x) => [x.id, x]));
  assert.equal(nov.vacances.report, 15000);
  assert.equal(nov.vacances.disponible, 25000);
  assert.equal(nov.vacances.reste, -1000);
  assert.equal(nov.vacances.statut, 'depasse');
  assert.equal(nov.sorties.report, 0);
  assert.equal(nov.sorties.disponible, 15000);
  assert.equal(nov.courses.enveloppe, 55000);
  // Décembre : report = 250 − 260 = −10 € ; disponible = 100 − 10 = 90 €.
  const dec = R.etatEnveloppes(E, '2026-12').find((x) => x.id === 'vacances');
  assert.equal(dec.report, -1000);
  assert.equal(dec.disponible, 9000);
  // Avant le mois de départ : aucun report.
  const aout = R.etatEnveloppes(E, '2026-08').find((x) => x.id === 'vacances');
  assert.equal(aout.report, 0);
});

test('repère 50/30/20', () => {
  const r = simple(R.repere503020({ besoins: 120000, envies: 50000, epargne: 30000 }, 200000));
  assert.deepEqual(r.map((x) => x.part), [60, 25, 15]);
  assert.deepEqual(r.map((x) => x.cible), [100000, 60000, 40000]);
  assert.deepEqual(r.map((x) => x.ecart), [20000, -10000, -10000]);
  assert.equal(R.repere503020({}, 0)[0].part, null);
});

test('Sankey : flux équilibrés, non dépensé, sommes exactes', () => {
  const E = foyer();
  E.operations.push(
    op('2026-11-01', 200000, null, 'revenu', 's1'), op('2026-11-05', 10000, null, 'revenu', 's2'),
    op('2026-11-02', 90000, 'logement'), op('2026-11-08', 41234, 'courses'), op('2026-11-09', 12345, 'sorties'), op('2026-11-10', 30000, 'epargne'),
  );
  const f = R.fluxSankey(E, '2026-11');
  assert.equal(f.revenus, 210000);
  assert.equal(f.sorties, 173579);
  assert.deepEqual(simple(f.groupes.map((g) => [g.id, g.valeur])), [['besoins', 131234], ['envies', 12345], ['epargne', 30000], ['reste', 36421]]);
  // Chaque source envoie exactement sa valeur, chaque groupe reçoit exactement la sienne.
  for (const s of f.sources) assert.equal(f.liensSG.filter((l) => l.de === s.id).reduce((t, l) => t + l.valeur, 0), s.valeur);
  for (const g of f.groupes) assert.equal(f.liensSG.filter((l) => l.vers === g.id).reduce((t, l) => t + l.valeur, 0), g.valeur);
  assert.ok(f.liensSG.every((l) => l.valeur > 0));
  assert.equal(f.liensGC.reduce((t, l) => t + l.valeur, 0), f.sorties);
});

test('Sankey : déficit couvert par une source « manque »', () => {
  const E = foyer();
  E.operations.push(op('2026-11-01', 100000, null, 'revenu', 's1'), op('2026-11-02', 90000, 'logement'), op('2026-11-03', 25000, 'vacances'));
  const f = R.fluxSankey(E, '2026-11');
  assert.deepEqual(simple(f.sources.map((s) => [s.id, s.valeur])), [['s1', 100000], ['manque', 15000]]);
  assert.ok(!f.groupes.some((g) => g.id === 'reste'));
  for (const g of f.groupes) assert.equal(f.liensSG.filter((l) => l.vers === g.id).reduce((t, l) => t + l.valeur, 0), g.valeur);
});

test('Sankey : regroupement en « Autres » au-delà du maximum par groupe', () => {
  const E = foyer();
  E.operations.push(op('2026-11-02', 900, 'logement'), op('2026-11-03', 500, 'courses'));
  const f = R.fluxSankey(E, '2026-11', { maxParGroupe: 1 });
  const b = f.categories.filter((c) => c.groupe === 'besoins');
  assert.equal(b.length, 1);
  assert.equal(b[0].id, 'autres-besoins');
  assert.equal(b[0].valeur, 1400);
});

test('disposition du Sankey : pas de chevauchement, hauteur minimale par nœud', () => {
  const E = foyer();
  E.operations.push(op('2026-11-01', 200000, null, 'revenu', 's1'), op('2026-11-05', 1000, null, 'revenu', 's2'),
    op('2026-11-02', 90000, 'logement'), op('2026-11-08', 100, 'courses'), op('2026-11-09', 50, 'sorties'));
  const d = R.dispositionSankey(R.fluxSankey(E, '2026-11'), { largeur: 358 });
  assert.equal(d.L, 358);
  assert.ok(d.compact);
  for (const col of [0, 1, 2]) {
    const n = d.noeuds.filter((x) => x.col === col).sort((a, b) => a.haut - b.haut);
    n.forEach((x, i) => { assert.ok(x.slot >= 34); if (i) assert.ok(x.haut >= n[i - 1].haut + n[i - 1].slot); });
  }
  assert.ok(d.noeuds.every((n) => n.x + n.w <= d.L));
  assert.equal(d.liens.length, R.fluxSankey(E, '2026-11').liensSG.length + 3);
});

test('opérations fixes : une par mois, jour ramené à la fin du mois', () => {
  const E = foyer();
  E.fixes = [
    { id: 'loyer', libelle: 'Loyer', montant: 90000, type: 'depense', categorieId: 'logement', jour: 5 },
    { id: 'paie', libelle: 'Salaire', montant: 200000, type: 'revenu', sourceId: 's1', jour: 31 },
    { id: 'zero', libelle: 'Vide', montant: 0, type: 'depense', categorieId: 'courses', jour: 1 },
  ];
  const a = R.genererFixes(E, '2027-02');
  assert.deepEqual(simple(a.map((o) => [o.fixeId, o.date])), [['loyer', '2027-02-05'], ['paie', '2027-02-28']]);
  assert.equal(a[1].categorieId, null);
  E.operations.push(...a);
  assert.equal(R.genererFixes(E, '2027-02').length, 0);
  assert.equal(R.genererFixes(E, '2027-03').length, 2);
});

test('bilan : série de 12 mois et écarts par catégorie', () => {
  const E = foyer();
  E.operations.push(op('2026-10-02', 90000, 'logement'), op('2026-11-02', 92000, 'logement'), op('2026-11-03', 3000, 'sorties'),
    op('2026-11-01', 210000, null, 'revenu', 's1'), op('2026-11-04', 500, 'supprimee'));
  const s = R.serieMois(E, '2026-11', 12);
  assert.equal(s.length, 12);
  assert.equal(s[0].mois, '2025-12');
  assert.equal(s[11].revenus, 210000);
  assert.deepEqual(simple(s[11].depenses), { besoins: 92500, envies: 3000, epargne: 0 });
  assert.equal(s[11].enveloppes, 90000 + 55000 + 10000 + 15000 + 30000);
  const e = Object.fromEntries(R.ecartsCategories(E, ['2026-10', '2026-11']).map((x) => [x.id, x]));
  assert.equal(e.logement.ecart, 182000 - 180000);
  assert.equal(e.courses.budget, 105000);
  assert.equal(e.courses.ecart, -105000);
  assert.equal(e.logement.moyenne, 91000);
});
