// Tests des règles métier du template Repas de la semaine (templates/repas/regles.js et donnees.js).
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
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m); // objets créés dans le contexte vm
const P = R.indexer(B.ingredients);
const RP = R.indexer(B.recettes);
const ORDRE = B.rayons.map((r) => r.id);

test('dates : lundi de la semaine, jours, saison du mois', () => {
  assert.equal(R.lundi('2026-11-14'), '2026-11-09'); // samedi
  assert.equal(R.lundi('2026-11-09'), '2026-11-09'); // lundi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche
  assert.equal(R.lundi('2027-01-01'), '2026-12-28'); // à cheval sur deux années
  eq(R.joursSemaine('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(R.indiceJour('2026-11-15'), 6);
  assert.equal(R.saisonDe('2026-11-14'), 'au');
  assert.equal(R.saisonDe('2027-01-10'), 'hi');
  assert.equal(R.saisonDe('2027-07-01'), 'et');
  assert.equal(R.saisonDe('2027-04-01'), 'pr');
});

test('unités : conversions dans la dimension, pièces ↔ grammes avec le poids moyen, sinon ligne séparée', () => {
  eq(R.versBase(1.5, 'kg', P.get('pomme-de-terre')), { dim: 'masse', qte: 1500 });
  eq(R.versBase(20, 'cl', P.get('lait')), { dim: 'volume', qte: 200 });
  eq(R.versBase(2, 'cas', P.get('huile-olive')), { dim: 'volume', qte: 30 });
  eq(R.versBase(3, null, P.get('oignon')), { dim: 'piece', qte: 3 });
  eq(R.versBase(300, 'g', P.get('oignon')), { dim: 'piece', qte: 3 }); // 100 g la pièce
  eq(R.versBase(2, 'pc', P.get('champignon')), { dim: 'piece', qte: 2 }); // pas de poids moyen : reste en pièces
  eq(R.versBase(200, 'g', P.get('creme-fraiche')), { dim: 'masse', qte: 200 }); // grammes de crème : pas de densité inventée
  eq(R.versBase(null, null, P.get('sel')), { dim: null, qte: null });
});

test('arrondis d\'achat et affichage des quantités', () => {
  assert.equal(R.arrondiAchat(2.1, 'piece'), 3);
  assert.equal(R.arrondiAchat(3, 'piece'), 3);
  assert.equal(R.arrondiAchat(0.25, 'piece'), 1);
  assert.equal(R.arrondiAchat(1234, 'masse'), 1250);
  assert.equal(R.arrondiAchat(333, 'masse'), 340);
  assert.equal(R.arrondiAchat(42, 'volume'), 45);
  assert.equal(R.formatQte(1250, 'masse'), '1,25 kg');
  assert.equal(R.formatQte(340, 'masse'), '340 g');
  assert.equal(R.formatQte(1500, 'volume'), '1,5 L');
  assert.equal(R.formatQte(250, 'volume'), '25 cl');
  assert.equal(R.formatQte(30, 'volume', P.get('huile-olive')), '2 c. à soupe');
  assert.equal(R.formatQte(5, 'volume', P.get('cumin')), '1 c. à café');
  assert.equal(R.formatQte(3, 'piece', P.get('ail')), '3 gousses');
  assert.equal(R.formatQte(1, 'piece', P.get('ail')), '1 gousse');
  assert.equal(R.formatQte(1.5, 'piece', P.get('oignon'), 'recette'), '1 ½');
  assert.equal(R.formatQte(0.5, 'piece', P.get('citron'), 'recette'), '½');
  eq(R.conditionnement(800, 'masse', P.get('tomates-concassees')), { n: 2, lib: 'boîte de 400 g', texte: '2 × boîte de 400 g' });
  eq(R.conditionnement(7, 'piece', P.get('oeuf')), { n: 2, lib: 'boîte de 6', texte: '2 × boîte de 6' });
  assert.equal(R.conditionnement(3, 'piece', P.get('oignon')), null);
});

test('quantités d\'une recette pour N personnes', () => {
  const curry = RP.get('curry-lentilles');
  const q6 = Object.fromEntries(R.quantitesPour(curry, 6, P).map((x) => [x.ing.id, x.texte]));
  assert.equal(q6['lentilles-corail'], '375 g');
  assert.equal(q6['lait-coco'], '60 cl');
  assert.equal(q6.oignon, '1 ½');
  assert.equal(q6.ail, '3 gousses');
  assert.equal(q6.sel, 'selon le goût');
  const q2 = Object.fromEntries(R.quantitesPour(curry, 2, P).map((x) => [x.ing.id, x.texte]));
  assert.equal(q2['lentilles-corail'], '125 g');
  assert.equal(q2.oignon, '½');
});

test('liste de courses : agrégation par ingrédient, unités cohérentes, ordre des rayons', () => {
  const lignes = [
    { ingredient: 'oignon', qte: 2, source: 'A' },
    { ingredient: 'oignon', qte: 150, unite: 'g', source: 'B' }, // 1,5 pièce
    { ingredient: 'lait', qte: 50, unite: 'cl', source: 'A' },
    { ingredient: 'lait', qte: 250, source: 'C' },
    { ingredient: 'champignon', qte: 250, source: 'A' },
    { ingredient: 'champignon', qte: 2, unite: 'pc', source: 'B' }, // pas de poids moyen : ligne à part
    { ingredient: 'sel', qte: null, source: 'A' },
    { ingredient: 'huile-olive', qte: 15, source: 'A' },
    { ingredient: 'huile-olive', qte: 1, unite: 'cas', source: 'B' },
  ];
  const l = R.listeCourses(lignes, P, { ordreRayons: ORDRE });
  const par = Object.fromEntries(l.map((a) => [a.cle, a]));
  assert.equal(par['oignon|piece'].qte, 4); // 3,5 arrondi à 4
  eq(par['oignon|piece'].sources, ['A', 'B']);
  assert.equal(par['lait|volume'].texte, '75 cl');
  assert.equal(par['champignon|masse'].qte, 250);
  assert.equal(par['champignon|piece'].qte, 2);
  assert.ok(par['sel|aucune'].sansQuantite);
  assert.equal(par['huile-olive|volume'].texte, '2 c. à soupe');
  assert.ok(par['huile-olive|volume'].placard);
  // Rayons dans l'ordre du magasin : fruits et légumes avant crèmerie avant épices.
  const rangs = l.map((a) => ORDRE.indexOf(a.rayon));
  eq(rangs, [...rangs].sort((x, y) => x - y));
  // Ordre personnalisé et rayon déplacé par l'utilisateur.
  const l2 = R.listeCourses(lignes, P, { ordreRayons: ['cr', ...ORDRE.filter((x) => x !== 'cr')], rayonsPerso: { champignon: 'sg' } });
  assert.equal(l2[0].rayon, 'cr');
  assert.equal(l2.find((a) => a.id === 'champignon').rayon, 'sg');
});

test('liste de courses : un ingrédient « selon le goût » disparaît s\'il a aussi une quantité', () => {
  const l = R.listeCourses([{ ingredient: 'sel', qte: null }, { ingredient: 'poivre', qte: null }, { ingredient: 'sel', qte: 5, unite: 'g' }], P, { ordreRayons: ORDRE });
  eq(l.map((a) => a.cle).sort(), ['poivre|aucune', 'sel|masse']);
});

test('moteur partageable : ingrédient inconnu du catalogue gardé dans « Autres »', () => {
  const l = R.listeCourses([{ ingredient: 'mystere', qte: 3, unite: 'pc' }], [], {});
  assert.equal(l[0].rayon, 'au');
  assert.equal(l[0].qte, 3);
});

test('repas planifiés → lignes de courses mises à l\'échelle, textes libres ignorés', () => {
  const repas = [
    { recette: 'carbonara', personnes: 2 },
    { recette: 'carbonara', personnes: 4 },
    { recette: null, texte: 'Restes', personnes: 4 },
    { recette: 'inconnue', personnes: 4 },
  ];
  const lignes = R.lignesDepuisRepas(repas, RP);
  const l = R.listeCourses(lignes, P, { ordreRayons: ORDRE });
  const par = Object.fromEntries(l.map((a) => [a.id, a]));
  assert.equal(par.spaghetti.qte, 600);
  assert.equal(par.oeuf.qte, 6);
  assert.equal(par.lardons.qte, 300);
  eq(par.spaghetti.achat.texte, '2 × paquet de 500 g');
});

test('avancement : seuls les articles à acheter comptent', () => {
  const articles = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }, { cle: 'd' }];
  eq(R.avancement(articles, { coches: ['a', 'b'], maison: ['d'] }), { total: 3, pris: 2, reste: 1, pct: 67, maison: 1 });
  eq(R.avancement([], {}), { total: 0, pris: 0, reste: 0, pct: 0, maison: 0 });
});

test('texte partagé : rayons, articles restants seulement', () => {
  const groupes = R.parRayon([{ cle: 'x', nom: 'Oignon', texte: '3', rayon: 'fl' }, { cle: 'y', nom: 'Lait', texte: '1 L', rayon: 'cr' }, { cle: 'z', nom: 'Beurre', texte: '', rayon: 'cr' }], ORDRE);
  const t = R.texteListe(groupes, { fl: 'Fruits et légumes', cr: 'Crèmerie' }, { coches: ['y'], maison: [] }, 'Courses');
  assert.equal(t, 'Courses\n\nFruits et légumes\n- Oignon : 3\n\nCrèmerie\n- Beurre');
});

test('lecture d\'une ligne saisie : quantité, unité, contenant, nom', () => {
  eq(R.lireLigne('200 g de farine'), { qte: 200, unite: 'g', contenant: null, nom: 'farine' });
  eq(R.lireLigne('200g de crème fraîche'), { qte: 200, unite: 'g', contenant: null, nom: 'crème fraîche' });
  eq(R.lireLigne('2 oignons'), { qte: 2, unite: 'pc', contenant: null, nom: 'oignons' });
  eq(R.lireLigne('1/2 citron'), { qte: 0.5, unite: 'pc', contenant: null, nom: 'citron' });
  eq(R.lireLigne('1 1/2 litre de lait'), { qte: 1.5, unite: 'l', contenant: null, nom: 'lait' });
  eq(R.lireLigne('1,5 kg de pommes de terre'), { qte: 1.5, unite: 'kg', contenant: null, nom: 'pommes de terre' });
  eq(R.lireLigne('3 c. à soupe d’huile d’olive'), { qte: 3, unite: 'cas', contenant: null, nom: 'huile d’olive' });
  eq(R.lireLigne('2 gousses d\'ail'), { qte: 2, unite: 'pc', contenant: null, nom: 'ail' });
  eq(R.lireLigne('1 boîte de tomates concassées'), { qte: 1, unite: 'pc', contenant: 'boite', nom: 'tomates concassées' });
  eq(R.lireLigne('- sel'), { qte: null, unite: null, contenant: null, nom: 'sel' });
  assert.equal(R.lireLigne('   '), null);
});

test('ingrédient reconnu : pluriel, accents, alias, inclusion mot à mot, jamais « bœuf » pour « œuf »', () => {
  const t = (n) => R.trouverIngredient(n, B.ingredients)?.id ?? null;
  assert.equal(t('tomates'), 'tomate');
  assert.equal(t('Œufs'), 'oeuf');
  assert.equal(t('pommes de terre'), 'pomme-de-terre');
  assert.equal(t('pâtes'), 'pates');
  assert.equal(t('emmental'), 'gruyere');
  assert.equal(t('poulet'), 'filet-poulet');
  assert.equal(t('bœuf'), 'boeuf-hache');
  assert.notEqual(t('bœuf'), 'oeuf');
  assert.equal(t('tomates concassées bio'), 'tomates-concassees');
  assert.equal(t('fruit du dragon'), null);
});

test('ligne de recette : contenant converti, ingrédient perso créé, aller-retour texte ↔ ligne', () => {
  eq(R.ligneRecette(R.lireLigne('1 boîte de tomates concassées'), B.ingredients).ligne, ['tomates-concassees', 400]);
  eq(R.ligneRecette(R.lireLigne('2 c. à soupe d\'huile d\'olive'), B.ingredients).ligne, ['huile-olive', 2, 'cas']);
  const n = R.ligneRecette(R.lireLigne('300 g de fruit du dragon'), B.ingredients, 'au');
  assert.equal(n.nouveau.id, 'perso-fruit-du-dragon');
  assert.equal(n.nouveau.unite, 'g');
  assert.equal(n.nouveau.rayon, 'au');
  eq(n.ligne, ['perso-fruit-du-dragon', 300]);
  // Toutes les lignes de la base se relisent à l'identique (quantité dans l'unité de base).
  for (const r of B.recettes) for (const l of r.ingredients) {
    const texte = R.ligneEnTexte(l, P);
    const relu = R.ligneRecette(R.lireLigne(texte), B.ingredients);
    assert.equal(relu.ligne[0], l[0], `${r.id} : ${texte}`);
    if (l[1] !== undefined) {
      const ing = P.get(l[0]);
      const avant = R.versBase(l[1], l[2], ing); const apres = R.versBase(relu.ligne[1], relu.ligne[2], ing);
      assert.equal(apres.dim, avant.dim, texte);
      assert.ok(Math.abs(apres.qte - avant.qte) < 0.01, `${texte} : ${apres.qte} ≠ ${avant.qte}`);
    }
  }
});

test('régimes calculés depuis les ingrédients', () => {
  eq(R.regimes(RP.get('carbonara'), P), { vegetarien: false, sansPorc: false, poisson: false, viande: true });
  eq(R.regimes(RP.get('chili-con-carne'), P), { vegetarien: false, sansPorc: true, poisson: false, viande: true });
  eq(R.regimes(RP.get('saumon-haricots'), P), { vegetarien: false, sansPorc: true, poisson: true, viande: false });
  eq(R.regimes(RP.get('ratatouille'), P), { vegetarien: true, sansPorc: true, poisson: false, viande: false });
  assert.ok(R.respecte(RP.get('ratatouille'), P, ['vegetarien', 'sans-porc']));
  assert.ok(!R.respecte(RP.get('quiche-lorraine'), P, ['sans-porc']));
});

test('filtres de la bibliothèque : recherche par ingrédient, catégorie, régimes, rapide, saison, favoris', () => {
  const f = (x, c = {}) => R.filtrerRecettes(B.recettes, x, P, c).map((r) => r.id);
  assert.ok(f({ q: 'poireaux' }).includes('quiche-poireaux'));
  assert.ok(f({ q: 'POIREAU' }).includes('soupe-poireaux'));
  assert.ok(f({ q: 'lentilles' }).includes('saucisses-lentilles'));
  assert.ok(f({ cat: 'soupe' }).every((id) => RP.get(id).cat === 'soupe'));
  assert.ok(f({ vegetarien: true }).every((id) => R.regimes(RP.get(id), P).vegetarien));
  assert.ok(f({ sansPorc: true }).every((id) => R.regimes(RP.get(id), P).sansPorc));
  assert.ok(f({ rapide: true }).every((id) => R.tempsTotal(RP.get(id)) <= 30));
  assert.ok(!f({ saison: 'et' }).includes('tartiflette'));
  assert.ok(f({ saison: 'hi' }).includes('tartiflette'));
  eq(f({ favoris: true }, { favoris: ['crepes', 'taboule'] }), ['crepes', 'taboule']);
});

test('avec ce qu\'il me reste : placard ignoré, le moins de manquants d\'abord, plats avant desserts', () => {
  const res = R.avecCeQuiReste(B.recettes, ['oeuf', 'pomme-de-terre', 'oignon', 'salade'], P, { maxManque: 2 });
  assert.equal(res[0].recette.id, 'tortilla-pdt'); // œufs, pommes de terre, oignon, salade : rien ne manque (huile et sel au placard)
  eq(res[0].manque, []);
  for (let k = 1; k < res.length; k++) assert.ok(res[k].manque.length >= res[k - 1].manque.length);
  assert.ok(res.every((x) => x.manque.length <= 2 && x.ont.length >= 1));
  const zero = R.avecCeQuiReste(B.recettes, ['oeuf', 'pomme-de-terre', 'oignon', 'salade'], P, { maxManque: 0 });
  assert.ok(zero.every((x) => !x.manque.length));
  eq(R.avecCeQuiReste(B.recettes, [], P), []);
});

test('propositions : régimes, saison, pas de doublon, soupe le soir, soirs de semaine rapides, déterministes', () => {
  const l = '2026-11-16';
  const creneaux = R.creneauxVides([], l);
  assert.equal(creneaux.length, 14);
  const opts = { saison: 'au', regimes: ['vegetarien'], graine: 'essai' };
  const props = R.proposer(B.recettes, creneaux, P, opts);
  assert.equal(props.length, 14);
  const ids = props.map((p) => p.recette);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of props) {
    const r = RP.get(p.recette);
    assert.notEqual(r.cat, 'dessert');
    assert.ok(R.regimes(r, P).vegetarien, p.recette);
    if (r.cat === 'soupe') assert.equal(p.moment, 'soir');
    if (p.moment === 'soir' && R.indiceJour(p.date) < 5) assert.ok(R.tempsTotal(r) <= 40, p.recette);
  }
  eq(R.proposer(B.recettes, creneaux, P, opts), props);
  // De saison d'abord : en été, aucune tartiflette.
  assert.ok(!R.proposer(B.recettes, creneaux, P, { saison: 'et', graine: 1 }).some((p) => p.recette === 'tartiflette'));
  // Récentes évitées tant que c'est possible.
  const recentes = props.map((p) => p.recette);
  const autres = R.proposer(B.recettes, creneaux.slice(0, 4), P, { ...opts, recentes });
  assert.ok(autres.every((p) => !recentes.includes(p.recette)));
});

test('créneaux vides et copie de la semaine précédente', () => {
  const repas = [
    { id: 'a', date: '2026-11-09', moment: 'soir', recette: 'crepes', personnes: 4 },
    { id: 'b', date: '2026-11-10', moment: 'midi', recette: null, texte: 'Restes', personnes: 4 },
    { id: 'c', date: '2026-11-17', moment: 'midi', recette: 'taboule', personnes: 2 },
  ];
  eq(R.creneauxVides(repas, '2026-11-09', ['soir'], [0, 1]), [{ date: '2026-11-10', moment: 'soir' }]);
  const copie = R.copierSemaine(repas, '2026-11-09', '2026-11-16');
  eq(copie.map((x) => [x.date, x.moment, x.recette, x.texte]), [['2026-11-16', 'soir', 'crepes', undefined]]); // mardi midi déjà pris
  assert.notEqual(copie[0].id, 'a');
  copie.length = 0;
  eq(R.copierSemaine(repas, '2026-11-09', '2026-11-23').map((x) => x.date), ['2026-11-23', '2026-11-24']);
});

test('normaliser : tolérant aux données anciennes ou invalides', () => {
  const e = R.normaliser({
    personnes: '0', regimes: ['vegetarien', 'inconnu'],
    repas: [{ date: '2026-11-10', moment: 'nuit', recette: 'crepes', personnes: 99 }, { date: 'hier', recette: 'crepes' }, { date: '2026-11-10', moment: 'midi' }],
    recettes: [{ nom: '', cat: 'gouter', ingredients: [['farine', '200'], ['sel'], ['oeuf', 'x'], 'invalide'], etapes: ['  Mélange.  ', ''] }],
    courses: { '2026-11-09': { coches: ['a', 'a'], extras: [{ nom: 'Pain' }, {}] }, 'pas-une-date': {} },
    ordreRayons: ['cr', 'cr', 'inconnu'], rayonsPerso: { farine: 'cr', sucre: 'nulle-part' }, frigo: ['oeuf', 'oeuf'],
  }, B);
  assert.equal(e.personnes, 1);
  eq(e.regimes, ['vegetarien']);
  assert.equal(e.repas.length, 1);
  assert.equal(e.repas[0].moment, 'soir');
  assert.equal(e.repas[0].personnes, 30);
  assert.equal(e.recettes[0].nom, 'Ma recette');
  assert.equal(e.recettes[0].cat, 'plat');
  eq(e.recettes[0].ingredients, [['farine', 200], ['sel'], ['oeuf']]);
  eq(e.recettes[0].etapes, ['Mélange.']);
  eq(Object.keys(e.courses), ['2026-11-09']);
  eq(e.courses['2026-11-09'].coches, ['a']);
  assert.equal(e.courses['2026-11-09'].extras.length, 1);
  eq(e.courses['2026-11-09'].placard, []);
  assert.equal(e.ordreRayons[0], 'cr');
  assert.equal(e.ordreRayons.length, B.rayons.length);
  eq(e.rayonsPerso, { farine: 'cr' });
  eq(e.frigo, ['oeuf']);
  eq(R.normaliser(null, B), R.etatVide(B));
});

test('listes de plus de 8 semaines purgées', () => {
  const c = { '2026-09-07': {}, '2026-09-14': {}, '2026-11-09': {} };
  eq(Object.keys(R.purgerCourses(c, '2026-11-14')), ['2026-09-14', '2026-11-09']);
});

test('base intégrée : riche, cohérente, sans prix ni marque ni donnée datée', () => {
  assert.ok(B.recettes.length >= 60 && B.recettes.length <= 100, `${B.recettes.length} recettes`);
  const ids = new Set(B.ingredients.map((i) => i.id));
  assert.equal(ids.size, B.ingredients.length, 'identifiants d\'ingrédients uniques');
  assert.equal(new Set(B.recettes.map((r) => r.id)).size, B.recettes.length, 'identifiants de recettes uniques');
  const rayons = new Set(B.rayons.map((r) => r.id));
  const cats = new Set(B.categories.map((c) => c.id));
  for (const i of B.ingredients) {
    assert.ok(rayons.has(i.rayon), i.id);
    assert.ok([null, 'g', 'ml', 'pc'].includes(i.unite), i.id);
    if (i.achat) assert.ok(i.achat.par > 0 && i.achat.lib, i.id);
  }
  for (const r of B.recettes) {
    assert.ok(cats.has(r.cat), r.id);
    assert.equal(r.portions, 4, r.id);
    assert.ok(r.etapes.length >= 2, `${r.id} : étapes`);
    assert.ok(r.ingredients.length >= 2, `${r.id} : ingrédients`);
    assert.ok(r.prep >= 0 && r.cuisson >= 0 && R.tempsTotal(r) > 0, r.id);
    for (const s of String(r.saisons).split(' ').filter(Boolean)) assert.ok(['pr', 'et', 'au', 'hi'].includes(s), r.id);
    for (const [id, q] of r.ingredients) {
      assert.ok(ids.has(id), `${r.id} : ingrédient ${id}`);
      if (q !== undefined) assert.ok(q > 0, `${r.id} : ${id}`);
      else assert.ok(P.get(id).placard || !P.get(id).unite, `${r.id} : ${id} sans quantité`);
    }
  }
  // Variété : des recettes végétariennes et sans porc dans chaque catégorie salée, de chaque saison.
  for (const c of ['plat', 'soupe', 'salade', 'tarte']) assert.ok(B.recettes.some((r) => r.cat === c && R.regimes(r, P).vegetarien), c);
  assert.ok(B.recettes.filter((r) => R.regimes(r, P).vegetarien).length >= 30);
  for (const s of ['pr', 'et', 'au', 'hi']) assert.ok(B.recettes.filter((r) => R.deSaison(r, s) && r.cat !== 'dessert').length >= 25, s);
  // Aucun prix, aucune année, aucune marque connue dans la base.
  const texte = JSON.stringify(B);
  const prose = JSON.stringify([B.recettes.map((r) => [r.nom, r.etapes]), B.ingredients.map((i) => [i.nom, i.achat?.lib]), B.conseils, B.avertissement, B.regimes]);
  assert.ok(!/€|\beuros?\b/i.test(texte), 'aucun prix');
  assert.ok(!/\b(19|20)\d\d\b/.test(prose), 'aucune année');
  assert.ok(!/nutella|kiri|herta|panzani|barilla|knorr|maggi|lustucru|danone|président|carrefour|leclerc|auchan|lidl|intermarch/i.test(texte), 'aucune marque');
});
