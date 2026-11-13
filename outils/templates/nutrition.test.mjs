// Tests des règles métier du journal nutrition (templates/nutrition/regles.js) et de ses bases intégrées.
// Toutes les dates sont fixes : aucun test ne dépend du jour où il est lancé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const charger = (fichier) => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL(`../../templates/nutrition/${fichier}`, import.meta.url), 'utf8'), ctx);
  return ctx.window;
};
const R = charger('regles.js').NTR;
const B = charger('donnees.js').BASE;
const C = charger('aliments.js').CIQUAL;
const simple = (o) => JSON.parse(JSON.stringify(o));
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('Mifflin-St Jeor : homme et femme (calculs faits à la main)', () => {
  // 10 × 70 + 6,25 × 175 − 5 × 30 + 5 = 700 + 1093,75 − 150 + 5
  const h = R.metabolismeBase({ sexe: 'h', age: 30, taille: 175, poids: 70 });
  proche(h.kcal, 1648.75); assert.equal(h.methode, 'mifflin'); assert.equal(h.degrade, false);
  // 10 × 60 + 6,25 × 165 − 5 × 40 − 161 = 600 + 1031,25 − 200 − 161
  proche(R.metabolismeBase({ sexe: 'f', age: 40, taille: 165, poids: 60 }).kcal, 1270.25);
});

test('estimation dégradée sur le poids seul (15,1 × poids + 371), signalée', () => {
  const r = R.metabolismeBase({ poids: 70 });
  proche(r.kcal, 1428); assert.equal(r.methode, 'poids'); assert.equal(r.degrade, true);
  // Sexe « non précisé » : pas d'équation complète.
  assert.equal(R.metabolismeBase({ sexe: null, age: 30, taille: 175, poids: 70 }).methode, 'poids');
  assert.equal(R.metabolismeBase({ sexe: 'h', age: 30, taille: 175 }), null);
});

test('hors de la population de l\'étude (19 à 78 ans) : signalé', () => {
  assert.equal(R.metabolismeBase({ sexe: 'h', age: 80, taille: 175, poids: 70 }).horsPopulation, true);
  assert.equal(R.metabolismeBase({ sexe: 'h', age: 45, taille: 175, poids: 70 }).horsPopulation, false);
});

test('sport : (MET − 1) × poids × durée en heures', () => {
  proche(R.depenseSport(7.5, 70, 40), 6.5 * 70 * 40 / 60); // 303,33…
  assert.equal(R.depenseSport(1, 70, 60), 0);
  assert.equal(R.depenseSport(0.8, 70, 60), 0); // jamais négatif
  assert.equal(R.depenseSport(8, null, 60), 0);
});

test('dépense du jour : métabolisme × facteur + séances du jour', () => {
  const profil = { sexe: 'h', annee: 1990, taille: 180, activite: 'modere', objectif: 'maintien', ecart: 0 };
  const pesees = [{ j: '2026-05-01', kg: 82 }, { j: '2026-05-20', kg: 80 }, { j: '2026-06-10', kg: 79 }];
  const seances = [{ j: '2026-06-01', met: 9.3, min: 30 }, { j: '2026-05-31', met: 7, min: 60 }];
  const d = R.depenseJour({ profil, pesees, seances, jour: '2026-06-01', activites: B.activites });
  // Âge 36 ; poids du 20/05 = 80 kg ; 800 + 1125 − 180 + 5 = 1750 ; × 1,55 = 2712,5 ; séance 8,3 × 80 × 0,5 = 332
  proche(d.base, 1750); proche(d.facteur, 1.55); proche(d.repos, 2712.5); proche(d.sport, 332); proche(d.total, 3044.5);
  // Facteur personnalisé prioritaire ; dépense de repos saisie à la main prioritaire sur tout.
  proche(R.depenseJour({ profil: { ...profil, facteurPerso: 1.4 }, pesees, seances: [], jour: '2026-06-01', activites: B.activites }).repos, 2450);
  const m = R.depenseJour({ profil: { ...profil, depenseManuelle: 2300 }, pesees, seances, jour: '2026-06-01', activites: B.activites });
  assert.equal(m.methode, 'manuelle'); proche(m.total, 2632);
});

test('poids du jour : dernière pesée connue, sinon la première', () => {
  const p = [{ j: '2026-03-10', kg: 75 }, { j: '2026-03-01', kg: 76 }];
  assert.equal(R.poidsAu(p, '2026-03-05'), 76);
  assert.equal(R.poidsAu(p, '2026-03-10'), 75);
  assert.equal(R.poidsAu(p, '2026-02-01'), 76);
  assert.equal(R.poidsAu([], '2026-02-01'), null);
});

test('objectif, cible et facteur calorique', () => {
  proche(R.facteurVise('perte', 10), 0.9);
  proche(R.facteurVise('prise', 5), 1.05);
  assert.equal(R.facteurVise('maintien', 20), 1);
  proche(R.cibleKcal(2000, 'perte', 15), 1700);
  assert.equal(R.cibleKcal(null, 'perte', 15), null);
  proche(R.facteurCalorique(1800, 2000), 0.9);
  assert.equal(R.facteurCalorique(1800, 0), null);
  assert.equal(R.respecte(0.88, 'perte', 10), true);
  assert.equal(R.respecte(0.95, 'perte', 10), false);
  assert.equal(R.respecte(1.1, 'prise', 5), true);
  assert.equal(R.respecte(1, 'maintien', 0), null);
});

test('alerte cible très basse : sous 1 000 kcal (HAS 2011)', () => {
  assert.equal(B.seuilTresBasCalories, 1000);
  assert.equal(R.cibleTresBasse(999, 1000), true);
  assert.equal(R.cibleTresBasse(1000, 1000), false);
  assert.equal(R.cibleTresBasse(null, 1000), false);
});

test('adultes uniquement : âge depuis l\'année de naissance', () => {
  assert.equal(R.ageEn(1990, '2026-11-13'), 36);
  assert.equal(R.estMineur(2009, '2026-01-01'), true);
  assert.equal(R.estMineur(2008, '2026-01-01'), false);
  assert.equal(R.estMineur(null, '2026-01-01'), false);
});

test('valeurs et totaux : proportionnels aux grammes, valeur absente signalée', () => {
  const aliments = { a: { n: 'A', v: [200, 10, 20, 5, 2, 8, 0.5] }, b: { n: 'B', v: [100, null, 10, 1, 0, 3, 0.1] } };
  const v = R.valeurs(aliments.a, 150);
  proche(v.kcal, 300); proche(v.prot, 15); proche(v.sel, 0.75); assert.equal(v.incomplet, false);
  const t = R.totaux([{ c: 'a', q: 50 }, { c: 'b', q: 200 }], aliments);
  proche(t.kcal, 300); proche(t.prot, 5); proche(t.gluc, 30); assert.equal(t.incomplet, true); assert.equal(t.n, 2);
});

test('recherche insensible aux accents et aux ligatures, nom qui commence par le mot en tête', () => {
  const liste = [{ nom: 'Pâté de campagne' }, { nom: 'Pomme, chair et peau, crue' }, { nom: 'Compote de pomme' }, { nom: 'Œuf dur' }, { nom: 'Pomme de terre vapeur' }];
  assert.deepEqual(simple(R.rechercher(liste, 'oeuf').map((x) => x.nom)), ['Œuf dur']);
  assert.deepEqual(simple(R.rechercher(liste, 'PATE').map((x) => x.nom)), ['Pâté de campagne']);
  assert.deepEqual(simple(R.rechercher(liste, 'pomme crue').map((x) => x.nom)), ['Pomme, chair et peau, crue']);
  assert.equal(R.rechercher(liste, 'pomme')[0].nom.startsWith('Pomme'), true);
  assert.equal(R.rechercher(liste, 'pomme').at(-1).nom, 'Compote de pomme');
  assert.deepEqual(simple(R.rechercher(liste, '   ')), []);
});

test('copie de la veille : mêmes aliments, nouveaux identifiants, nouveau jour', () => {
  let n = 0;
  const journal = [{ id: 'x', j: '2026-04-01', r: 'pdj', c: 'a', q: 40 }, { id: 'y', j: '2026-04-02', r: 'dej', c: 'b', q: 100 }];
  const copies = R.copierJour(journal, '2026-04-01', '2026-04-02', () => `n${++n}`);
  assert.deepEqual(simple(copies), [{ id: 'n1', j: '2026-04-02', r: 'pdj', c: 'a', q: 40 }]);
});

test('bilan : jours non notés exclus des moyennes, facteur = total mangé ÷ total dépensé', () => {
  const etat = {
    profil: { depenseManuelle: 2000 },
    pesees: [{ j: '2026-02-01', kg: 70 }],
    seances: [{ j: '2026-02-02', met: 7, min: 60 }], // 6 × 70 × 1 = 420 kcal
    aliments: { a: { n: 'A', v: [100, 5, 10, 2, 1, 3, 0.2] } },
    journal: [{ j: '2026-02-01', c: 'a', q: 1800 }, { j: '2026-02-02', c: 'a', q: 2420 }],
  };
  const b = R.bilan({ etat, jours: R.joursJusqua('2026-02-03', 3), activites: B.activites });
  assert.deepEqual(simple(b.lignes.map((l) => l.j)), ['2026-02-01', '2026-02-02', '2026-02-03']);
  assert.equal(b.lignes[2].vide, true); assert.equal(b.lignes[2].facteur, null);
  proche(b.lignes[0].facteur, 0.9); proche(b.lignes[1].facteur, 1);
  assert.equal(b.joursNotes, 2);
  proche(b.moyenneMange, 2110); proche(b.moyenneDepense, 2210);
  proche(b.facteur, 4220 / 4420);
  proche(b.macros.prot, 105.5);
});

test('variation de poids sur une période', () => {
  const p = [{ j: '2026-01-01', kg: 80 }, { j: '2026-01-10', kg: 79.2 }, { j: '2026-01-20', kg: 78.6 }];
  proche(R.variationPoids(p, '2026-01-05', '2026-01-31').kg, -0.6);
  assert.equal(R.variationPoids(p, '2026-01-15', '2026-01-31'), null);
});

test('liste de courses : quantités additionnées sur la semaine, triées par rayon', () => {
  const aliments = { a: { n: 'Riz', g: 'produits céréaliers' }, b: { n: 'Pomme', g: 'fruits' }, p: { n: 'Barre maison', g: '', perso: true } };
  const menus = [{ id: 'm1', items: [{ r: 'dej', c: 'a', q: 180 }, { r: 'col', c: 'b', q: 150 }] }, { id: 'm2', items: [{ r: 'dej', c: 'a', q: 120 }, { r: 'col', c: 'p', q: 35 }] }];
  const l = R.listeCourses(menus, ['m1', 'm2', 'm1', null, 'inconnu', null, null], aliments);
  assert.deepEqual(simple(l.map((x) => [x.nom, x.q, x.fois])), [['Pomme', 300, 2], ['Barre maison', 35, 1], ['Riz', 480, 3]]);
  assert.equal(R.quantiteCourses(480), '480 g');
  assert.equal(R.quantiteCourses(1250), '1,3 kg');
});

test('dates : jours consécutifs et lundi de la semaine', () => {
  assert.deepEqual(simple(R.joursJusqua('2026-03-01', 3)), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche → lundi précédent
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
});

test('base Ciqual intégrée : source, licence, structure et valeurs contrôlées', () => {
  assert.match(C.licence, /Licence Ouverte/);
  assert.match(C.source, /Anses/);
  assert.match(C.version, /Ciqual 2025/);
  assert.ok(C.aliments.length > 3000);
  for (const l of C.aliments) {
    assert.equal(l.length, 10);
    assert.equal(typeof l[1], 'string');
    assert.ok(typeof l[3] === 'number' && l[3] >= 0, `énergie manquante : ${l[1]}`);
    assert.ok(l.slice(4).every((v) => v === null || (typeof v === 'number' && v >= 0)));
    assert.ok(C.groupes[l[2]] !== undefined);
  }
  // Valeurs relevées dans le fichier Ciqual 2025 (pomme, chair et peau, crue ; œuf dur).
  const pomme = C.aliments.find((l) => l[0] === 13039);
  assert.deepEqual(simple(pomme.slice(1, 7)), ['Pomme, chair et peau, crue', C.groupes.indexOf('fruits, légumes, légumineuses et oléagineux'), 54, 0.25, 11.6, 0.25]);
  const oeuf = C.aliments.find((l) => l[0] === 22010);
  assert.equal(oeuf[3], 134); assert.equal(oeuf[4], 13.5);
  assert.equal(new Set(C.aliments.map((l) => l[0])).size, C.aliments.length);
  const a = R.depuisCiqual(pomme, C.groupes);
  assert.equal(a.n, 'Pomme, chair et peau, crue'); assert.equal(a.v.length, 7);
});

test('base MET : codes uniques du Compendium, valeurs positives, catégories connues', () => {
  const codes = B.sports.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const s of B.sports) {
    assert.match(s.code, /^\d{5}$/);
    assert.ok(s.met > 1 && s.met < 25);
    assert.ok(B.categoriesSport.some((c) => c.id === s.cat));
  }
  // Valeurs relevées sur pacompendium.com (2024 Adult Compendium).
  assert.equal(B.sports.find((s) => s.code === '12020').met, 7.5);
  assert.equal(B.sports.find((s) => s.code === '18240').met, 5.8);
  assert.deepEqual(simple(B.activites.map((a) => a.facteur)), [1.2, 1.375, 1.55, 1.725, 1.9]);
});
