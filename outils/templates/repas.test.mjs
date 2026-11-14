// Tests des règles métier des repas de la semaine et de la liste de courses (templates/repas/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/repas/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RPS;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const idDe = (nom) => B.recettes.find((r) => r.nom === nom).id;
const L = '2026-11-09'; // un lundi
const etat = (cases = {}, extra = {}) => {
  const e = R.etatVide(B);
  e.semaines[L] = { ...R.semaineVide(), cases, ...extra };
  return e;
};
const rec = (nom, personnes = 4) => ({ type: 'recette', recette: idDe(nom), personnes });
const ligne = (liste, nom) => liste.lignes.find((l) => l.cle === R.cleNom(nom));

test('Base : 100 recettes complètes, ingrédients connus, une seule dimension par ingrédient', () => {
  assert.equal(B.recettes.length, 100);
  assert.equal(new Set(B.recettes.map((r) => r.id)).size, 100);
  assert.equal(new Set(B.recettes.map((r) => R.cleNom(r.nom))).size, 100, 'noms uniques');
  const cats = new Set(B.categories.map(([k]) => k));
  const rayons = new Set(B.rayons.map(([k]) => k));
  const dims = new Map();
  for (const r of B.recettes) {
    assert.ok(cats.has(r.categorie), r.nom);
    assert.ok(r.personnes >= 1 && r.ingredients.length >= 2 && r.etapes.length >= 2, r.nom);
    assert.ok(r.saisons.length >= 1 && r.saisons.every((s) => 'peah'.includes(s)), r.nom);
    for (const i of r.ingredients) {
      assert.ok(B.ingredients[i.nom], `${r.nom} : ${i.nom} absent du dictionnaire`);
      assert.ok(rayons.has(B.ingredients[i.nom][0]), i.nom);
      assert.ok(R.UNITES[i.unite], `${r.nom} : unité ${i.unite}`);
      assert.ok(i.qte > 0, `${r.nom} : ${i.nom}`);
      const d = R.UNITES[i.unite][0];
      if (!dims.has(i.nom)) dims.set(i.nom, d);
      assert.equal(dims.get(i.nom), d, `${i.nom} : dimensions mélangées`);
    }
    for (const e of r.etiquettes) assert.ok(['batch', 'enfants', 'eco'].includes(e), `${r.nom} : étiquette ${e}`);
  }
  for (const p of B.placard) assert.ok(B.ingredients[p], `placard : ${p}`);
  for (const [, v] of Object.entries(B.ingredients)) for (const a of (v[1] || '').split(' ').filter(Boolean)) assert.ok(B.allergenes[a], a);
  // Aucun nom de marque ni prix dans la base.
  assert.ok(!/€|prix/i.test(JSON.stringify(B.recettes)));
});

test('Dates : lundi, saison, cases', () => {
  assert.equal(R.lundiDe('2026-11-14'), L);
  assert.equal(R.lundiDe('2026-11-09'), L);
  assert.equal(R.lundiDe('2026-11-15'), L);
  assert.equal(R.lundiDe('2027-01-01'), '2026-12-28');
  eq(['2026-01-15', '2026-03-01', '2026-05-31', '2026-06-01', '2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01'].map(R.saisonDe), ['h', 'p', 'p', 'e', 'e', 'a', 'a', 'h']);
  assert.equal(R.dateCase(L, '6-soir'), '2026-11-15');
  eq(['2-soir', '0-soir', '2-midi', '0-midi'].sort(R.ordreCase), ['0-midi', '0-soir', '2-midi', '2-soir']);
});

test('Lecture d\'une ligne d\'ingrédient', () => {
  const l = (s) => simple(R.lireLigneIngredient(s));
  eq(l('400 g de spaghetti'), { nom: 'spaghetti', qte: 400, unite: 'g' });
  eq(l('2 gousses d\'ail'), { nom: 'ail', qte: 2, unite: 'gousse' });
  eq(l('1/2 botte persil'), { nom: 'persil', qte: 0.5, unite: 'botte' });
  eq(l('½ citron'), { nom: 'citron', qte: 0.5, unite: 'pièce' });
  eq(l('1,5 kg pommes de terre'), { nom: 'pommes de terre', qte: 1.5, unite: 'kg' });
  eq(l('3 œufs'), { nom: 'œufs', qte: 3, unite: 'pièce' });
  eq(l('2 cuillères à soupe d\'huile d\'olive'), { nom: 'huile d\'olive', qte: 2, unite: 'c. à s.' });
  eq(l('1 cc cumin'), { nom: 'cumin', qte: 1, unite: 'c. à c.' });
  eq(l('- 10 cl crème liquide'), { nom: 'crème liquide', qte: 10, unite: 'cl' });
  eq(l('sel'), { nom: 'sel', qte: null, unite: 'pièce' });
  eq(l('lardons'), { nom: 'lardons', qte: null, unite: 'pièce' }, 'le « l » de lardons n\'est pas une unité');
  eq(l('2 grosses tomates'), { nom: 'grosses tomates', qte: 2, unite: 'pièce' }, 'le « g » de grosses n\'est pas une unité');
  assert.equal(R.lireLigneIngredient('   '), null);
  assert.equal(R.lireLigneIngredient('400 g'), null);
  for (const s of ['400 g spaghetti', '2 gousse ail', '3 œufs', '1,5 c. à s. huile d\'olive', 'sel']) {
    const i = R.lireLigneIngredient(s);
    eq(simple(R.lireLigneIngredient(R.ecrireLigneIngredient(i))), simple(i), s);
  }
});

test('Unités : conversions, arrondis des courses et textes', () => {
  eq(simple(R.versBase(1.5, 'kg')), { dim: 'm', val: 1500 });
  eq(simple(R.versBase(25, 'cl')), { dim: 'v', val: 250 });
  eq(simple(R.versBase(2, 'c. à s.')), { dim: 'cuil', val: 6 });
  eq(simple(R.versBase(null, 'g')), { dim: 'sans', val: 0 });
  assert.equal(R.arrondiCourses('m', 262.5), 270);
  assert.equal(R.arrondiCourses('m', 33.3), 35);
  assert.equal(R.arrondiCourses('m', 1210), 1250);
  assert.equal(R.arrondiCourses('pièce', 1.2), 2, 'on n\'achète pas 1,2 oignon');
  assert.equal(R.arrondiCourses('pièce', 2), 2);
  assert.equal(R.arrondiCourses('cuil', 4), 4.5, '1,33 c. à s. → 1,5 c. à s.');
  assert.equal(R.texteQuantite('m', 1250), '1,25 kg');
  assert.equal(R.texteQuantite('m', 350), '350 g');
  assert.equal(R.texteQuantite('v', 1500), '1,5 l');
  assert.equal(R.texteQuantite('cuil', 6), '2 c. à s.');
  assert.equal(R.texteQuantite('cuil', 1), '1 c. à c.');
  assert.equal(R.texteQuantite('gousse', 3), '3 gousses');
  assert.equal(R.texteQuantite('gousse', 1), '1 gousse');
  assert.equal(R.texteQuantite('pièce', 3), '3');
  assert.equal(R.texteQuantites([{ dim: 'm', val: 200 }, { dim: 'pièce', val: 1.5 }]), '200 g + 2');
  assert.equal(R.texteQuantites([{ dim: 'm', val: 333.33 }], 'recette'), '335 g');
});

test('Infos d\'une recette : végétarien, poisson, rapide et allergènes déduits', () => {
  const inf = (nom) => R.infos(B.recettes.find((r) => r.nom === nom), B);
  assert.equal(inf('Ratatouille et riz').vegetarien, true);
  assert.equal(inf('Spaghetti à la bolognaise').vegetarien, false);
  assert.equal(inf('Tarte au thon et à la tomate').poisson, true);
  assert.equal(inf('Tarte au thon et à la tomate').vegetarien, false);
  assert.equal(inf('Pâtes au brocoli et à l\'ail').rapide, true);
  assert.equal(inf('Bœuf bourguignon').rapide, false);
  eq(inf('Quiche lorraine').allergenes, ['G', 'L', 'O']);
  assert.ok(inf('Moules marinières et frites').allergenes.includes('K'));
  // Une recette perso avec un ingrédient hors base n'est jamais déclarée végétarienne.
  const perso = R.normaliserRecette({ nom: 'Mystère', ingredients: [{ nom: 'tomate', qte: 2 }, { nom: 'ingrédient inconnu', qte: 100, unite: 'g' }] });
  assert.equal(R.infos(perso, B).vegetarien, false);
  assert.equal(R.infos(perso, B).inconnus, 1);
  // Les étiquettes déduites ne se doublent pas avec celles saisies.
  assert.equal(R.infos({ ...B.recettes[0], etiquettes: ['rapide', 'batch'], preparation: 5, cuisson: 5 }, B).etiquettes.filter((e) => e === 'rapide').length, 1);
});

test('Mise à l\'échelle selon les personnes', () => {
  const r = B.recettes.find((x) => x.nom === 'Spaghetti à la bolognaise'); // pour 4
  const e6 = R.echelle(r, 6);
  assert.equal(e6.find((i) => i.nom === 'spaghetti').qte, 600);
  assert.equal(e6.find((i) => i.nom === 'oignon').qte, 1.5);
  assert.equal(R.echelle(r, 1).find((i) => i.nom === 'bœuf haché').qte, 100);
});

test('Portions : les repas « restes » augmentent la recette d\'origine', () => {
  const s = { cases: { '0-soir': rec('Chili con carne', 4), '2-soir': { type: 'restes', source: '0-soir', personnes: 3 }, '3-midi': { type: 'restes', source: '0-soir', personnes: 1 }, '4-soir': { type: 'restes', source: '6-soir', personnes: 2 } } };
  eq(simple(R.portions(s)), { '0-soir': 8 });
});

test('Liste de courses : additions, conversions, rayons, restes et articles libres', () => {
  const e = etat({ '0-soir': rec('Spaghetti à la bolognaise'), '1-midi': { type: 'restes', source: '0-soir', personnes: 2 }, '2-soir': rec('Hachis parmentier', 4), '3-soir': { type: 'dehors', texte: 'Cantine' }, '4-soir': { type: 'note', texte: 'Pizza' } },
    { libres: [{ id: 'l1', nom: 'Liquide vaisselle', qte: 1, unite: 'pièce', rayon: 'mh' }, { id: 'l2', nom: 'Bœuf haché', qte: 0.2, unite: 'kg' }] });
  const liste = R.listeCourses(e, B, L);
  // Bolognaise pour 6 (4 + 2 de restes) : 600 g ; hachis pour 4 sur 6 : 400 g ; libre 200 g.
  eq(simple(ligne(liste, 'bœuf haché').quantites), [{ dim: 'm', val: 1200 }]);
  assert.equal(R.texteQuantites(ligne(liste, 'bœuf haché').reste), '1,2 kg');
  assert.equal(ligne(liste, 'Bœuf haché').rayon, 'bv');
  assert.equal(ligne(liste, 'liquide vaisselle').rayon, 'mh');
  assert.equal(ligne(liste, 'ail').quantites[0].val, 3); // 2 gousses × 6/4
  assert.equal(R.texteQuantites(ligne(liste, 'oignon').reste), '3'); // 1,5 + 1,33 → 3
  assert.equal(ligne(liste, 'spaghetti').sources.length, 1);
  assert.equal(ligne(liste, 'oignon').sources.length, 2);
  // Ordre des rayons : celui de la base, ou celui choisi.
  eq(liste.rayons.map((g) => g.id).slice(0, 2), ['fl', 'bv']);
  e.reglages.ordreRayons = ['mh', 'cr'];
  eq(R.listeCourses(e, B, L).rayons.map((g) => g.id).slice(0, 2), ['mh', 'cr']);
  // Semaine vide.
  assert.equal(R.listeCourses(R.etatVide(B), B, L).aAcheter.length, 0);
});

test('Fusion : noms sans accents ni casse, dimensions différentes côte à côte, cuillères converties', () => {
  const l = R.fusionner([
    { nom: 'Crème fraîche', qte: 200, unite: 'g', rayon: 'cr' }, { nom: 'creme fraiche', qte: 0.1, unite: 'kg' },
    { nom: 'Carotte', qte: 2, unite: 'pièce' }, { nom: 'carotte', qte: 300, unite: 'g' },
    { nom: 'Sucre', qte: 1, unite: 'c. à s.' }, { nom: 'sucre', qte: 2, unite: 'c. à c.' },
    { nom: 'Sel', qte: null, unite: 'pièce' }, { nom: '  ', qte: 1 },
  ]);
  assert.equal(l.length, 4);
  eq(simple(l.find((x) => x.cle === 'creme fraiche').quantites), [{ dim: 'm', val: 300 }]);
  assert.equal(l.find((x) => x.cle === 'creme fraiche').rayon, 'cr');
  assert.equal(R.texteQuantites(l.find((x) => x.cle === 'carotte').quantites), '300 g + 2');
  assert.equal(R.texteQuantites(l.find((x) => x.cle === 'sucre').quantites), '2 c. à s.'); // 5 c. à c. = 1,67 c. à s., arrondi à la demi-cuillère supérieure
  eq(simple(l.find((x) => x.cle === 'sel').quantites), [{ dim: 'sans', val: 0 }]);
});

test('Stock et placard : tout, une partie, placard, à racheter', () => {
  const e = etat({ '0-soir': rec('Hachis parmentier', 6) }, { stock: { [R.cleNom('pomme de terre')]: { dim: 'm', val: 500 }, [R.cleNom('lait')]: 'tout', [R.cleNom('beurre')]: { dim: 'm', val: 100 } } });
  e.placard = ['Muscade', 'oignon'];
  let liste = R.listeCourses(e, B, L);
  eq(simple(ligne(liste, 'pomme de terre').reste), [{ dim: 'm', val: 700 }]);
  assert.equal(ligne(liste, 'pomme de terre').raison, 'partiel');
  assert.equal(ligne(liste, 'lait').enStock, true);
  assert.equal(ligne(liste, 'beurre').enStock, true, '100 g en stock pour 50 g nécessaires');
  assert.equal(ligne(liste, 'muscade').raison, 'placard');
  assert.equal(ligne(liste, 'oignon').raison, 'placard');
  assert.ok(!liste.aAcheter.some((l) => l.cle === 'oignon'));
  // Article du placard marqué « à racheter » cette semaine.
  e.semaines[L].stock.oignon = 'manque';
  liste = R.listeCourses(e, B, L);
  assert.equal(ligne(liste, 'oignon').enStock, false);
  assert.equal(ligne(liste, 'oignon').aRacheter, true);
  // Le stock d'une autre dimension ne déduit rien.
  const [x] = R.appliquerStock(R.fusionner([{ nom: 'oignon', qte: 3, unite: 'pièce' }]), { oignon: { dim: 'm', val: 500 } });
  eq(simple(x.reste), [{ dim: 'pièce', val: 3 }]);
});

test('Articles cochés, habituels et texte à copier', () => {
  const e = etat({ '0-soir': rec('Pâtes à la carbonara') }, { coches: { lardons: true } });
  e.habituels = [{ id: 'h', nom: 'Café moulu', qte: 250, unite: 'g', rayon: 'ep' }];
  e.placard = [];
  const liste = R.listeCourses(e, B, L);
  assert.equal(liste.nbCoches, 1);
  assert.ok(liste.aAcheter.find((l) => l.cle === 'cafe moulu').sources[0].type === 'habituel');
  const t = R.texteListe(liste, { titre: 'Courses', sansCoches: true });
  assert.ok(t.startsWith('Courses\n'));
  assert.ok(t.includes('PÂTES, RIZ ET CÉRÉALES\n- Spaghetti : 400 g'));
  assert.ok(t.includes('- Café moulu : 250 g'));
  assert.ok(!t.includes('Lardons'), 'les articles cochés sont exclus');
  assert.ok(R.texteListe(liste).includes('Lardons'));
  const csv = R.versCsv(liste, B);
  assert.ok(csv.startsWith('﻿Rayon;Article;Quantité'));
  assert.ok(csv.includes('Crèmerie et œufs;Parmesan;60 g;;'));
});

test('Budget : seulement avec les prix saisis, conversion d\'unités', () => {
  const lignes = R.appliquerStock(R.fusionner([{ nom: 'Bœuf haché', qte: 600, unite: 'g' }, { nom: 'Œufs', qte: 3, unite: 'pièce' }, { nom: 'Lait', qte: 50, unite: 'cl' }, { nom: 'Sel', qte: null }]));
  eq(simple(R.budget(lignes, {})), { total: 0, avecPrix: 0, sansPrix: 4 });
  const prix = { 'boeuf hache': { prix: 12, qte: 1, unite: 'kg' }, oeufs: { prix: 3, qte: 12, unite: 'pièce' }, lait: { prix: 1, qte: 1, unite: 'kg' } };
  const b = R.budget(lignes, prix);
  assert.equal(b.total, 7.95); // 7,20 + 0,75 ; le lait (prix au kg, besoin en ml) n'est pas compté
  assert.equal(b.avecPrix, 2);
  assert.equal(b.sansPrix, 2);
  assert.equal(R.coutLigne([{ dim: 'm', val: 333 }], { prix: 2, qte: 1, unite: 'kg' }), 0.68); // 340 g achetés
  assert.equal(R.coutLigne([], { prix: 2, qte: 1, unite: 'kg' }), null);
  assert.equal(R.coutLigne([{ dim: 'm', val: 100 }], { prix: 2, qte: 0, unite: 'kg' }), null);
});

test('Recettes : base masquée, modifiée, recettes perso', () => {
  const e = R.etatVide(B);
  const b1 = B.recettes[0];
  e.masquees = [B.recettes[1].id];
  e.recettes = [R.normaliserRecette({ ...b1, nom: 'Bolognaise maison' }), R.normaliserRecette({ id: 'r1', nom: 'Ma soupe', ingredients: [{ nom: 'potiron', qte: 1, unite: 'kg' }] })];
  const l = R.recettesDe(e, B);
  assert.equal(l.length, 100);
  assert.equal(l[0].nom, 'Bolognaise maison');
  assert.equal(l[0].modifiee, true);
  assert.ok(!l.some((r) => r.id === B.recettes[1].id));
  assert.equal(l.at(-1).base, false);
  // Normalisation tolérante.
  const n = R.normaliserRecette({ nom: '', personnes: 'x', saisons: ['z'], etiquettes: ['rapide', 'batch'], ingredients: [{ nom: '' }, { nom: 'riz', qte: -1, unite: 'boisseau' }], etapes: 'a\n\nb' });
  assert.equal(n.nom, 'Recette sans nom');
  assert.equal(n.personnes, 4);
  eq(simple(n.saisons), ['p', 'e', 'a', 'h']);
  eq(simple(n.etiquettes), ['batch']);
  eq(simple(n.ingredients), [{ nom: 'riz', qte: null, unite: 'pièce' }]);
  eq(simple(n.etapes), ['a', 'b']);
  // Rayon : choix de l'utilisateur prioritaire.
  e.rayonsPerso = { potiron: 'su' };
  assert.equal(R.rayonDe('Potiron', B, e), 'su');
  assert.equal(R.rayonDe('pois cassés', B, {}), 'au');
});

test('Historique, dernière fois et fréquences', () => {
  const e = R.etatVide(B);
  const id = idDe('Tartiflette');
  e.semaines['2026-10-26'] = { ...R.semaineVide(), cases: { '0-soir': { type: 'recette', recette: id, personnes: 4 }, '1-soir': { type: 'restes', source: '0-soir', personnes: 4 } } };
  e.semaines[L] = { ...R.semaineVide(), cases: { '3-soir': { type: 'recette', recette: id, personnes: 4 } } };
  const h = R.historique(e);
  eq(h.get(id), ['2026-10-26', '2026-11-12']);
  assert.equal(R.derniereFois(h, id, '2026-11-12'), '2026-10-26');
  assert.equal(R.derniereFois(h, id, '2026-10-26'), null);
  eq(simple(R.frequences(e, '2026-10-01', '2026-11-30')), [{ id, n: 2, derniere: '2026-11-12' }]);
});

test('Suggestions : saison, répétitions, contraintes, hasard reproductible', () => {
  const tous = R.recettesDe(R.etatVide(B), B);
  const alea = R.aleatoire(1);
  const ete = R.proposer(tous, B, { date: '2026-07-15' }, alea, 200);
  assert.ok(ete.length > 20 && ete.every((x) => x.recette.saisons.includes('e')));
  assert.ok(!ete.some((x) => x.recette.nom === 'Tartiflette'));
  const vege = R.proposer(tous, B, { date: '2026-07-15', vegetarien: true }, alea, 200);
  assert.ok(vege.length && vege.every((x) => R.infos(x.recette, B).vegetarien));
  const rapides = R.proposer(tous, B, { date: '2026-07-15', tempsMax: 30 }, alea, 200);
  assert.ok(rapides.every((x) => R.tempsTotal(x.recette) <= 30));
  const sansGluten = R.proposer(tous, B, { date: '2026-07-15', sansAllergenes: ['G'] }, alea, 200);
  assert.ok(sansGluten.every((x) => !R.infos(x.recette, B).allergenes.includes('G')));
  // Une recette servie il y a 10 jours n'est pas proposée si l'on évite 21 jours.
  const id = idDe('Ratatouille et riz');
  const hist = new Map([[id, ['2026-07-05']]]);
  assert.ok(!R.proposer(tous, B, { date: '2026-07-15', hist, eviterJours: 21 }, alea, 200).some((x) => x.recette.id === id));
  assert.ok(R.proposer(tous, B, { date: '2026-07-15', hist, eviterJours: 7 }, alea, 200).some((x) => x.recette.id === id));
  // Même graine, même tirage.
  const a = R.proposer(tous, B, { date: '2026-07-15' }, R.aleatoire(42), 5).map((x) => x.recette.id);
  const b = R.proposer(tous, B, { date: '2026-07-15' }, R.aleatoire(42), 5).map((x) => x.recette.id);
  eq(a, b);
  // Exclusions et recette sans ingrédient.
  assert.ok(!R.proposer(tous, B, { date: '2026-07-15', exclure: new Set(a) }, alea, 200).some((x) => a.includes(x.recette.id)));
  assert.equal(R.proposer([{ ...tous[0], ingredients: [] }], B, { date: '2026-07-15', saison: false }, alea).length, 0);
});

test('Remplir la semaine : cases vides seulement, contraintes, aucune recette en double', () => {
  const tous = R.recettesDe(R.etatVide(B), B);
  const base = { cases: { '0-midi': { type: 'dehors', texte: 'Cantine' }, '6-soir': rec('Soupe de légumes') }, stock: {}, coches: {}, libres: [] };
  const toutes = R.JOURS.flatMap((_, j) => ['midi', 'soir'].map((k) => R.cleCase(j, k)));
  const { semaine, ajoutees } = R.remplirSemaine(base, L, tous, B, { cases: toutes, nbVegetariens: 4, nbPoisson: 2, soirsRapides: true, personnes: 3, eviterJours: 21 }, R.aleatoire(7));
  assert.equal(ajoutees.length, 12);
  assert.equal(semaine.cases['0-midi'].type, 'dehors');
  assert.equal(semaine.cases['6-soir'].recette, idDe('Soupe de légumes'));
  const ids = Object.values(semaine.cases).filter((c) => c.type === 'recette').map((c) => c.recette);
  assert.equal(new Set(ids).size, ids.length, 'pas de doublon');
  const inf = ajoutees.map((k) => R.infos(tous.find((r) => r.id === semaine.cases[k].recette), B));
  assert.ok(inf.filter((x) => x.vegetarien).length >= 4);
  assert.ok(inf.filter((x) => x.poisson).length >= 2);
  for (const k of ajoutees.filter((x) => R.jourCase(x) < 5 && R.repasCase(x) === 'soir')) assert.ok(R.tempsTotal(tous.find((r) => r.id === semaine.cases[k].recette)) <= 30, k);
  assert.ok(ajoutees.every((k) => semaine.cases[k].personnes === 3));
  assert.equal(Object.keys(base.cases).length, 2, 'la semaine d\'origine n\'est pas modifiée');
  // Contrainte impossible : relâchée plutôt que de laisser vide.
  const deux = R.remplirSemaine(R.semaineVide(), L, tous.slice(0, 3), B, { cases: ['0-soir', '1-soir'], nbVegetariens: 2 }, R.aleatoire(3));
  assert.equal(deux.ajoutees.length, 2);
  // Plus de cases que de recettes : on s'arrête sans doublon.
  const peu = R.remplirSemaine(R.semaineVide(), L, tous.slice(0, 2), B, { cases: toutes }, R.aleatoire(3));
  assert.equal(peu.ajoutees.length, 2);
});

test('Semaines types et vidage d\'une case', () => {
  const s = { ...R.semaineVide(), cases: { '0-soir': rec('Chili con carne'), '2-soir': { type: 'restes', source: '0-soir', personnes: 4 }, '1-midi': { type: 'dehors', texte: 'Cantine' } }, stock: { riz: 'tout' } };
  const type = R.semaineTypeDepuis(s);
  eq(Object.keys(type).sort(), ['0-soir', '1-midi', '2-soir']);
  const cible = { ...R.semaineVide(), cases: { '0-soir': rec('Taboulé') } };
  const sans = R.appliquerType(cible, type, false);
  assert.equal(sans.cases['0-soir'].recette, idDe('Taboulé'), 'repas existant gardé');
  assert.equal(sans.cases['2-soir'].type, 'restes', 'la source reste une recette');
  const avec = R.appliquerType(cible, type, true);
  assert.equal(avec.cases['0-soir'].recette, idDe('Chili con carne'));
  // Restes dont la source n'est pas une recette : deviennent une note.
  const orph = R.appliquerType(R.semaineVide(), { '3-soir': { type: 'restes', source: '1-soir', personnes: 2 } });
  eq(simple(orph.cases['3-soir']), { type: 'note', texte: 'Restes' });
  const v = R.viderCase(s, '0-soir');
  assert.equal(v.cases['0-soir'], undefined);
  assert.equal(v.cases['2-soir'].type, 'note');
  assert.equal(s.cases['0-soir'].type, 'recette', 'pas de modification en place');
});

test('Normalisation tolérante de l\'état', () => {
  eq(simple(R.normaliser(null, B)), simple(R.etatVide(B)));
  const e = R.normaliser({
    foyer: 'Maison', reglages: { personnes: 99, repas: ['soir', 'gouter'], eviterJours: -3 },
    semaines: { '2026-11-10': { cases: {} }, [L]: { cases: { '0-soir': { type: 'recette', recette: 'b001', personnes: 0 }, '9-soir': { type: 'note' }, '1-midi': { type: 'inconnu' }, '2-soir': { type: 'recette' } }, stock: { a: 'tout', b: { dim: 'm', val: -1 }, c: 'x' }, coches: { a: true, b: 'oui' }, libres: [{ nom: 'Pain', qte: 1 }, { nom: '' }] } },
    prix: { 'Bœuf haché': { prix: 12, qte: 1, unite: 'kg' }, x: { prix: 'a', qte: 1 } },
    rayonsPerso: { 'Pois cassés': 'fe', y: 'zz' }, placard: ['Sel', 'sel', ' ', 'Poivre'], semainesTypes: [{ nom: '', cases: { '0-soir': { type: 'dehors' } } }],
  }, B);
  assert.equal(e.reglages.personnes, 20);
  eq(simple(e.reglages.repas), ['soir']);
  assert.equal(e.reglages.eviterJours, 0);
  eq(Object.keys(e.semaines), [L], 'un mardi n\'identifie pas une semaine');
  eq(simple(e.semaines[L].cases), { '0-soir': { type: 'recette', recette: 'b001', personnes: 1 } });
  eq(simple(e.semaines[L].stock), { a: 'tout' });
  eq(simple(e.semaines[L].coches), { a: true });
  assert.equal(e.semaines[L].libres.length, 1);
  eq(simple(e.prix), { 'boeuf hache': { prix: 12, qte: 1, unite: 'kg' } });
  eq(simple(e.rayonsPerso), { 'pois casses': 'fe' });
  eq(simple(e.placard), ['sel', 'Poivre']);
  assert.equal(e.semainesTypes[0].nom, 'Semaine type');
  // Au plus 60 semaines gardées (les plus récentes).
  const semaines = {};
  for (let i = 0; i < 70; i++) semaines[R.ajout(L, -7 * i)] = { cases: {} };
  const n = R.normaliser({ semaines }, B);
  assert.equal(Object.keys(n.semaines).length, 60);
  assert.ok(n.semaines[L]);
  // Aller-retour JSON stable.
  eq(simple(R.normaliser(simple(e), B)), simple(e));
});
