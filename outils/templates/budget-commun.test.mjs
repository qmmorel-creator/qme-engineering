// Tests des règles métier du budget commun (templates/budget-commun/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../templates/budget-commun/regles.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const R = ctx.BCM;
const somme = (o) => Object.values(o).reduce((s, c) => s + c, 0);
const simple = (o) => JSON.parse(JSON.stringify(o));

const A = { id: 'a', revenu: 260000 }, B = { id: 'b', revenu: 190000 }, C = { id: 'c', revenu: null };

test('saisie des montants en centimes entiers', () => {
  assert.equal(R.versCentimes('12,50'), 1250);
  assert.equal(R.versCentimes('1 234,5 €'), 123450);
  assert.equal(R.versCentimes('0.05'), 5);
  assert.equal(R.versCentimes('7'), 700);
  assert.equal(R.versCentimes('12,345'), null);
  assert.equal(R.versCentimes('abc'), null);
  assert.equal(R.versCentimes(''), null);
});

test('affichage à la française', () => {
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(5), '0,05 €');
  assert.equal(R.euros(-1000), '−10,00 €');
  assert.equal(R.euros(1000, { signe: true }), '+10,00 €');
});

test('répartition égale : la somme tombe juste au centime', () => {
  const r = R.repartir(1000, [A, B, C], 'egale');
  assert.deepEqual(simple(r.quotes), { a: 334, b: 333, c: 333 });
  for (const m of [1, 2, 99, 100001, 999999]) assert.equal(somme(R.repartir(m, [A, B, C], 'egale').quotes), m);
});

test('répartition au prorata des revenus', () => {
  const r = R.repartir(100000, [A, B], 'prorata');
  // 2 600 / 4 500 = 57,777… % → 577,78 € ; 422,22 €
  assert.deepEqual(simple(r.quotes), { a: 57778, b: 42222 });
  assert.equal(r.mode, 'prorata');
  for (let m = 1; m < 2000; m += 37) assert.equal(somme(R.repartir(m, [A, B], 'prorata').quotes), m);
});

test('prorata sans revenu : repli à parts égales signalé', () => {
  const r = R.repartir(1001, [A, C], 'prorata');
  assert.equal(r.mode, 'egale');
  assert.ok(r.note);
  assert.equal(somme(r.quotes), 1001);
});

test('répartition en parts, décimales admises', () => {
  const r = R.repartir(10000, [A, B, C], 'parts', { parts: { a: 2, b: 1, c: 1 } });
  assert.deepEqual(simple(r.quotes), { a: 5000, b: 2500, c: 2500 });
  const r2 = R.repartir(1000, [A, B], 'parts', { parts: { a: 1.5, b: 1 } });
  assert.deepEqual(simple(r2.quotes), { a: 600, b: 400 });
  const r3 = R.repartir(1000, [A, B, C], 'parts', { parts: { a: 1, b: 1, c: 1 } });
  assert.equal(somme(r3.quotes), 1000);
  assert.ok(R.repartir(1000, [A, B], 'parts', { parts: { a: 0, b: 0 } }).erreur);
});

test('répartition en montants personnalisés : refus si la somme ne tombe pas juste', () => {
  const ok = R.repartir(5000, [A, B], 'montants', { montants: { a: 3000, b: 2000 } });
  assert.deepEqual(simple(ok.quotes), { a: 3000, b: 2000 });
  const ko = R.repartir(5000, [A, B], 'montants', { montants: { a: 3000, b: 1000 } });
  assert.ok(ko.erreur);
  assert.equal(ko.ecart, 1000);
});

test('montant nul ou personne concernée : erreur', () => {
  assert.ok(R.repartir(0, [A], 'egale').erreur);
  assert.ok(R.repartir(100, [], 'egale').erreur);
  assert.ok(R.repartir(10.5, [A], 'egale').erreur);
});

test('soldes : payé − dû, virements compris, somme nulle', () => {
  const membres = [{ id: 'a' }, { id: 'b' }];
  const dep = [
    { id: 'd1', payeur: 'a', montant: 10000, quotes: { a: 5000, b: 5000 } },
    { id: 'd2', payeur: 'b', montant: 3000, quotes: { a: 1500, b: 1500 } },
  ];
  const s = R.soldes(membres, dep);
  assert.deepEqual(simple(s), { a: 3500, b: -3500 });
  const s2 = R.soldes(membres, dep, [{ de: 'b', a: 'a', montant: 3500 }]);
  assert.deepEqual(simple(s2), { a: 0, b: 0 });
});

test('quotes manquantes ou fausses : recalculées depuis la règle', () => {
  const membres = [A, B];
  const d = { payeur: 'a', montant: 999, repartition: { mode: 'egale', participants: ['a', 'b'] }, quotes: { a: 1 } };
  assert.equal(somme(R.quotesDepense(d, membres)), 999);
});

test('équilibrage : nombre minimal de virements', () => {
  assert.deepEqual(simple(R.equilibrer({ a: 0, b: 0 })), []);
  assert.deepEqual(simple(R.equilibrer({ a: 3500, b: -3500 })), [{ de: 'b', a: 'a', montant: 3500 }]);
  // Deux paires indépendantes : 2 virements (un glouton naïf en ferait 3).
  const v = R.equilibrer({ a: 1000, b: 700, c: -700, d: -1000 });
  assert.equal(v.length, 2);
  assert.deepEqual(simple(v).sort((x, y) => x.montant - y.montant), [{ de: 'c', a: 'b', montant: 700 }, { de: 'd', a: 'a', montant: 1000 }]);
  // Cas où le glouton (plus gros avec plus gros) échoue : 6 soldes, optimum = 4 virements.
  const s = { a: 900, b: 600, c: 500, d: -1000, e: -500, f: -500 };
  const w = R.equilibrer(s);
  assert.equal(w.length, 4);
  const apres = { ...s };
  for (const x of w) { apres[x.de] += x.montant; apres[x.a] -= x.montant; assert.ok(x.montant > 0); }
  assert.ok(Object.values(apres).every((c) => c === 0));
});

test('équilibrage aléatoire : tout est soldé, jamais plus de n − 1 virements', () => {
  let graine = 7;
  const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  for (let k = 0; k < 300; k++) {
    const n = 2 + Math.floor(alea() * 5);
    const s = {};
    let total = 0;
    for (let i = 0; i < n - 1; i++) { const v = Math.round((alea() - 0.5) * 100000); s[`m${i}`] = v; total += v; }
    s[`m${n - 1}`] = -total;
    const w = R.equilibrer(s);
    const nonNuls = Object.values(s).filter((c) => c !== 0).length;
    assert.ok(w.length <= Math.max(0, nonNuls - 1));
    for (const x of w) { s[x.de] += x.montant; s[x.a] -= x.montant; }
    assert.ok(Object.values(s).every((c) => c === 0));
  }
});

test('mois : ajout, longueur', () => {
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.joursDansMois('2028-02'), 29);
  assert.equal(R.joursDansMois('2026-02'), 28);
});

test('dépenses récurrentes générées chaque mois, une seule fois, jamais après suppression', () => {
  const membres = [A, B];
  const rec = [{ id: 'loyer', libelle: 'Loyer', montant: 90000, payeur: 'a', categorie: 'logement', jour: 31, debut: '2026-09', repartition: { mode: 'prorata', participants: ['a', 'b'] } },
    { id: 'off', libelle: 'Arrêtée', montant: 100, payeur: 'a', debut: '2026-09', actif: false }];
  const n1 = R.genererRecurrentes(rec, [], {}, '2026-11', membres);
  assert.deepEqual(simple(n1.map((d) => d.date)), ['2026-09-30', '2026-10-31', '2026-11-30']);
  assert.ok(n1.every((d) => somme(d.quotes) === 90000));
  assert.equal(n1[0].quotes.a, 52000);
  // Déjà générées : rien de neuf ; supprimée : pas recréée.
  assert.equal(R.genererRecurrentes(rec, n1, {}, '2026-11', membres).length, 0);
  const restantes = n1.filter((d) => d.date !== '2026-10-31');
  assert.equal(R.genererRecurrentes(rec, restantes, { 'r-loyer-2026-10': '2026-11-01T00:00:00Z' }, '2026-11', membres).length, 0);
  // Limite au jour : le loyer du 30 novembre n'existe pas encore le 12.
  assert.equal(R.genererRecurrentes(rec, [], {}, '2026-11-12', membres).length, 2);
  assert.equal(R.genererRecurrentes(rec, [], {}, '2026-11-30', membres).length, 3);
  // Fin fixée : s'arrête.
  assert.equal(R.genererRecurrentes([{ ...rec[0], fin: '2026-10' }], [], {}, '2026-12', membres).length, 2);
});

test('bilan du mois par catégorie et par personne', () => {
  const membres = [{ id: 'a' }, { id: 'b' }];
  const dep = [
    { id: '1', date: '2026-11-02', payeur: 'a', montant: 6000, categorie: 'courses', quotes: { a: 3000, b: 3000 } },
    { id: '2', date: '2026-11-20', payeur: 'b', montant: 2000, categorie: 'sorties', quotes: { a: 1000, b: 1000 } },
    { id: '3', date: '2026-10-30', payeur: 'b', montant: 9999, categorie: 'courses', quotes: { a: 5000, b: 4999 } },
  ];
  const b = R.bilanMois(dep, '2026-11', membres);
  assert.equal(b.total, 8000);
  assert.equal(b.nb, 2);
  assert.deepEqual(simple(b.parCategorie), { courses: 6000, sorties: 2000 });
  assert.deepEqual(simple(b.parMembre), { a: { paye: 6000, part: 4000 }, b: { paye: 2000, part: 4000 } });
  assert.equal(R.bilanMois(dep, '2026-08', membres).total, 0);
});

test('fusion : les dépenses ajoutées des deux côtés sont toutes gardées', () => {
  const commun = { id: 'c', montant: 100, modifLe: '2026-11-01T10:00:00Z' };
  const local = { depenses: [commun, { id: 'l', montant: 200, modifLe: '2026-11-02T10:00:00Z' }], membres: [], supprimes: {} };
  const serveur = { depenses: [commun, { id: 's', montant: 300, modifLe: '2026-11-02T11:00:00Z' }], membres: [], supprimes: {}, majLe: 'x' };
  const { etat, ajouts } = R.fusionner(local, serveur);
  assert.deepEqual(simple(etat.depenses.map((d) => d.id).sort()), ['c', 'l', 's']);
  assert.equal(ajouts, 1);
  assert.equal(etat.majLe, undefined);
});

test('fusion : la modification la plus récente l\'emporte, conflit compté', () => {
  const local = { depenses: [{ id: 'd', montant: 100, modifLe: '2026-11-02T10:00:00Z' }] };
  const serveur = { depenses: [{ id: 'd', montant: 150, modifLe: '2026-11-02T12:00:00Z' }] };
  const r = R.fusionner(local, serveur);
  assert.equal(r.etat.depenses[0].montant, 150);
  assert.equal(r.conflits, 1);
  const r2 = R.fusionner({ depenses: [{ id: 'd', montant: 120, modifLe: '2026-11-03T00:00:00Z' }] }, serveur);
  assert.equal(r2.etat.depenses[0].montant, 120);
});

test('fusion : une suppression gagne sur une version plus ancienne, pas sur une plus récente', () => {
  const vieux = { id: 'd', montant: 100, modifLe: '2026-11-01T00:00:00Z' };
  const local = { depenses: [], supprimes: { d: '2026-11-02T00:00:00Z' } };
  assert.equal(R.fusionner(local, { depenses: [vieux] }).etat.depenses.length, 0);
  const recent = { ...vieux, montant: 180, modifLe: '2026-11-03T00:00:00Z' };
  assert.equal(R.fusionner(local, { depenses: [recent] }).etat.depenses.length, 1);
});

test('fusion : objets simples (foyer, réglages) selon la date de modification', () => {
  const r = R.fusionner({ foyer: { nom: 'A', modifLe: '2' } }, { foyer: { nom: 'B', modifLe: '1' } });
  assert.equal(r.etat.foyer.nom, 'A');
  assert.equal(R.fusionner(null, { x: 1 }).etat.x, 1);
});

// ---------- Mode « compte commun » ----------
const M2 = [{ id: 'a', revenu: 260000 }, { id: 'b', revenu: 190000 }];
const rec = (id, montant, pour, extra = {}) => ({ id, libelle: id, montant, payeur: 'compte', pour, jour: 5, debut: '2026-09', fin: null, actif: true, ...extra });

test('compte : charges prévues du mois, communes et personnelles, selon les dates', () => {
  const r = [
    rec('loyer', 98000, 'foyer'), rec('tel', 1599, 'b'), rec('vieux', 5000, 'foyer', { fin: '2026-10' }),
    rec('futur', 7000, 'foyer', { debut: '2026-12' }), rec('pause', 3000, 'foyer', { actif: false }),
    { ...rec('perso', 4000, 'foyer'), payeur: 'a' }, rec('orphelin', 1000, 'zzz'),
  ];
  const c = R.chargesPrevues(r, '2026-11', M2);
  assert.equal(c.communes, 98000 + 1000, 'récurrente d\'une personne retirée : comptée pour le foyer');
  assert.deepEqual(simple(c.perso), { a: 0, b: 1599 });
  assert.equal(c.lignes.length, 3);
  assert.equal(R.chargesPrevues(r, '2026-10', M2).communes, 98000 + 5000 + 1000);
});

test('compte : versement de chacun au prorata, charges personnelles ajoutées, au centime', () => {
  const a = R.alimentation({ membres: M2, cle: { mode: 'prorata' }, communes: 98000, perso: { b: 1599 }, courantes: 70000, autres: 2000, solde: 20000 });
  assert.equal(a.charges, 170000);
  assert.equal(a.aCouvrir, 150000);
  assert.equal(somme(a.parts), 150000);
  assert.equal(a.parts.a, Math.round(150000 * 26 / 45));
  assert.equal(a.versements.b, a.parts.b + 1599);
  assert.equal(a.total, 150000 + 1599);
});

test('compte : excédent sur le compte, seules les charges personnelles restent à verser', () => {
  const a = R.alimentation({ membres: M2, cle: { mode: 'egale' }, communes: 50000, perso: { a: 1000 }, solde: 80000 });
  assert.equal(a.aCouvrir, -30000);
  assert.equal(a.base, 0);
  assert.deepEqual(simple(a.versements), { a: 1000, b: 0 });
});

test('compte : clé en parts (pourcentages), revenu manquant ramené à parts égales', () => {
  const p = R.alimentation({ membres: M2, cle: { mode: 'parts', parts: { a: 60, b: 40 } }, communes: 100001 });
  assert.deepEqual(simple(p.parts), { a: 60001, b: 40000 });
  const r = R.alimentation({ membres: [{ id: 'a', revenu: 200000 }, { id: 'b', revenu: null }], cle: { mode: 'prorata' }, communes: 1001 });
  assert.equal(r.mode, 'egale');
  assert.match(r.note, /parts égales/);
  assert.equal(somme(r.parts), 1001);
  const z = R.alimentation({ membres: M2, cle: { mode: 'parts', parts: { a: 0, b: 0 } }, communes: 1000 });
  assert.equal(z.mode, 'egale');
  assert.equal(somme(z.parts), 1000);
});

test('compte : solde estimé et déjà versé, par mois alimenté', () => {
  const vs = [
    { de: 'a', montant: 80000, date: '2026-10-30', mois: '2026-11' },
    { de: 'b', montant: 60000, date: '2026-11-02', mois: '2026-11' },
    { de: 'a', montant: 1000, date: '2026-10-05', mois: '2026-10' },
  ];
  const ds = [
    { payeur: 'compte', montant: 98000, date: '2026-11-05' }, { payeur: 'compte', montant: 5000, date: '2026-11-20' },
    { payeur: 'a', montant: 7000, date: '2026-11-06' },
  ];
  assert.deepEqual(simple(R.verses(vs, '2026-11', M2)), { a: 80000, b: 60000 });
  assert.equal(R.soldeEstime(10000, vs, ds, '2026-11', '2026-11-10'), 10000 + 80000 + 60000 - 98000);
  assert.equal(R.soldeEstime(10000, vs, ds, '2026-11'), 10000 + 140000 - 103000);
});

test('compte : une récurrente propre à une personne garde son destinataire', () => {
  const g = R.genererRecurrentes([rec('tel', 1599, 'b', { repartition: { mode: 'egale', participants: ['b'] } })], [], {}, '2026-10-31', M2);
  assert.equal(g.length, 2);
  assert.equal(g[0].pour, 'b');
  assert.equal(g[0].payeur, 'compte');
  assert.deepEqual(simple(g[0].quotes), { b: 1599 });
});

test('fusion : versements et mois du compte réunis sans perte', () => {
  const l = { versements: [{ id: 'v1', montant: 1, modifLe: '1' }], alimentations: [{ id: 'a-2026-11', solde: 5, modifLe: '2' }] };
  const s = { versements: [{ id: 'v2', montant: 2, modifLe: '1' }], alimentations: [{ id: 'a-2026-11', solde: 9, modifLe: '1' }] };
  const r = R.fusionner(l, s);
  assert.equal(r.etat.versements.length, 2);
  assert.equal(r.etat.alimentations[0].solde, 5);
});

// ---------- Liaison avec Mon Budget (T99) ----------
const foyerAvances = () => ({
  membres: [A, B],
  reglages: { fonctionnement: 'avances' },
  depenses: [
    // Courses payées par a, partagées à parts égales : 50 € chacun.
    { id: 'd1', date: '2026-11-03', montant: 10000, payeur: 'a', repartition: { mode: 'egale' } },
    // Loyer payé par b, au prorata des revenus (2 600 / 1 900).
    { id: 'd2', date: '2026-11-05', montant: 90000, payeur: 'b', repartition: { mode: 'prorata' } },
    // Dépense de b seul (participants : b) : rien pour a.
    { id: 'd3', date: '2026-11-08', montant: 3000, payeur: 'b', repartition: { mode: 'egale', participants: ['b'] } },
    // Autre mois : ignorée.
    { id: 'd4', date: '2026-10-28', montant: 5000, payeur: 'a', repartition: { mode: 'egale' } },
  ],
});

test('liaison, mode avances : la part du mois est la somme des quotes-parts, quel que soit le payeur', () => {
  const E = foyerAvances();
  const pa = R.partDuMois(E, 'a', '2026-11'), pb = R.partDuMois(E, 'b', '2026-11');
  const loyer = R.quotesDepense(E.depenses[1], E.membres);
  assert.deepEqual(simple(pa), { mode: 'avances', montant: 5000 + loyer.a, nb: 2 });
  assert.equal(pb.montant, 5000 + loyer.b + 3000);
  // Les parts des deux personnes font exactement le total du mois, au centime.
  assert.equal(pa.montant + pb.montant, 10000 + 90000 + 3000);
  assert.equal(R.partDuMois(E, 'a', '2026-10').montant, 2500);
  assert.deepEqual(simple(R.partDuMois(E, 'a', '2026-12')), { mode: 'avances', montant: 0, nb: 0 });
});

test('liaison : une personne qui n\'est plus membre du foyer n\'a pas de part (null)', () => {
  assert.equal(R.partDuMois(foyerAvances(), 'x', '2026-11'), null);
  assert.equal(R.partDuMois({}, 'a', '2026-11'), null);
});

test('liaison, mode compte commun : la part est le versement du mois, calculé comme dans l\'application', () => {
  const E = {
    membres: [A, B],
    reglages: { fonctionnement: 'compte', cle: { mode: 'prorata' } },
    recurrentes: [
      { id: 'r1', libelle: 'Loyer', montant: 98000, payeur: R.COMPTE, pour: 'foyer', debut: '2026-01', jour: 5 },
      { id: 'r2', libelle: 'Forfait de b', montant: 1599, payeur: R.COMPTE, pour: 'b', debut: '2026-01', jour: 10 },
    ],
    alimentations: [{ id: 'a-2026-11', mois: '2026-11', courantes: 70000, autres: 2000, solde: 20000 }],
    depenses: [{ id: 'd1', date: '2026-11-03', montant: 10000, payeur: 'a', repartition: { mode: 'egale' } }],
  };
  const attendu = R.alimentation({ membres: [A, B], cle: { mode: 'prorata' }, communes: 98000, perso: { b: 1599 }, courantes: 70000, autres: 2000, solde: 20000 });
  assert.deepEqual(simple(R.partDuMois(E, 'a', '2026-11')), { mode: 'compte', montant: attendu.versements.a });
  assert.equal(R.partDuMois(E, 'b', '2026-11').montant, attendu.versements.b);
  // Mois sans alimentation saisie : les dépenses courantes du dernier mois renseigné, solde 0.
  const dec = R.besoinCompte(E, '2026-12');
  assert.equal(dec.courantes, 70000);
  assert.equal(dec.solde, null);
  assert.equal(R.partDuMois(E, 'a', '2026-12').montant, R.alimentation({ membres: [A, B], cle: { mode: 'prorata' }, communes: 98000, perso: { b: 1599 }, courantes: 70000 }).versements.a);
});
