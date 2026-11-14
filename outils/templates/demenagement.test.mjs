// Tests des règles métier du template Déménagement (templates/demenagement/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/demenagement/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.DMN;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m); // objets créés dans le contexte vm
const AUJ = '2026-11-14';
const SIT = { depart: 'locataire', arrivee: 'locataire', mode: 'pro', enfants: false, animaux: false, vehicule: false };
const tache = (j, extra = {}) => ({ id: `t${j}`, titre: `Tâche ${j}`, cat: 'logement', j, statut: 'afaire', ...extra });
const carton = (num, extra = {}) => R.normaliserCarton({ id: `c${num}`, num, piece: 'cuisine', contenu: '', statut: 'ferme', ...extra });

test('dates et J relatif : ajout, écart, affichage, saisie tolérante', () => {
  assert.equal(R.ajout('2026-11-14', -56), '2026-09-19');
  assert.equal(R.ajout('2026-12-31', 1), '2027-01-01');
  assert.equal(R.ecart('2026-11-14', '2027-01-09'), 56);
  assert.ok(R.estDate('2028-02-29'));
  assert.ok(!R.estDate('2026-02-29'));
  assert.equal(R.libJ(0), 'J');
  assert.equal(R.libJ(-56), 'J−56');
  assert.equal(R.libJ(7), 'J+7');
  assert.equal(R.lireJ('J-56'), -56);
  assert.equal(R.lireJ('j+3'), 3);
  assert.equal(R.lireJ(' -7 '), -7);
  assert.equal(R.lireJ('J−30'), -30);
  assert.equal(R.lireJ('J'), 0);
  assert.equal(R.lireJ('demain'), null);
  assert.equal(R.compteRebours('2026-11-26', AUJ), 'dans 12 jours');
  assert.equal(R.compteRebours('2026-11-15', AUJ), 'demain');
  assert.equal(R.compteRebours(AUJ, AUJ), 'aujourd\'hui');
  assert.equal(R.compteRebours('2026-11-11', AUJ), 'il y a 3 jours');
});

test('conditions : situation de départ, d\'arrivée, mode et options', () => {
  const s = R.normaliserSituation({ depart: 'proprietaire', mode: 'soi', enfants: 1 });
  eq(simple(s), { depart: 'proprietaire', arrivee: 'locataire', mode: 'soi', enfants: true, animaux: false, vehicule: false });
  assert.ok(R.applicable('', s));
  assert.ok(R.applicable('depart:proprietaire', s));
  assert.ok(!R.applicable('depart:locataire', s));
  assert.ok(R.applicable('mode:soi', s));
  assert.ok(R.applicable('enfants', s));
  assert.ok(!R.applicable('vehicule', s));
  eq(simple(R.normaliserSituation({ depart: 'n\'importe', mode: 'x' })), simple(R.normaliserSituation({})));
});

test('génération du rétroplanning selon la situation, triée par échéance', () => {
  const loc = R.genererTaches(BASE.taches, SIT);
  const refs = new Set(loc.map((t) => t.ref));
  assert.ok(refs.has('l02') && refs.has('o02') && !refs.has('o04') && !refs.has('l14') && !refs.has('f01') && !refs.has('a10'));
  for (let i = 1; i < loc.length; i++) assert.ok(loc[i - 1].j <= loc[i].j, 'tri par J');
  assert.ok(loc.every((t) => t.statut === 'afaire' && t.faitLe === null));
  const soi = R.genererTaches(BASE.taches, { depart: 'proprietaire', arrivee: 'proprietaire', mode: 'soi', enfants: true, animaux: true, vehicule: true });
  const r2 = new Set(soi.map((t) => t.ref));
  assert.ok(r2.has('o04') && r2.has('l14') && r2.has('l05') && r2.has('f01') && r2.has('f04') && r2.has('a10') && !r2.has('l02') && !r2.has('o02') && !r2.has('l16'));
  // Toutes les tâches sans condition sont dans les deux.
  for (const t of BASE.taches.filter((x) => !x.si)) { assert.ok(refs.has(t.id) && r2.has(t.id), t.id); }
});

test('changer de situation : tâches ajoutées, tâches à faire retirées, cochées et masquées gardées', () => {
  const avant = R.genererTaches(BASE.taches, SIT);
  avant.find((t) => t.ref === 'o02').statut = 'fait'; // devis demandés : gardé même en passant à « soi »
  const r = R.appliquerSituation(avant, BASE.taches, { ...SIT, mode: 'soi', enfants: true }, ['f06']);
  const refs = r.taches.map((t) => t.ref);
  assert.ok(refs.includes('o02'), 'tâche cochée gardée');
  assert.ok(!refs.includes('o03') && !refs.includes('o12'), 'tâches « pro » à faire retirées');
  assert.ok(refs.includes('o04') && refs.includes('f01'), 'tâches ajoutées');
  assert.ok(!refs.includes('f06'), 'tâche masquée jamais remise');
  assert.equal(new Set(refs).size, refs.length, 'aucun doublon');
  assert.ok(r.ajoutees.some((t) => t.ref === 'o04'));
  assert.ok(r.retirees.some((t) => t.ref === 'o03'));
  // Une tâche ajoutée à la main (sans ref) ne bouge jamais.
  const main = [...avant, R.normaliserTache({ titre: 'Réserver la salle', j: -3 })];
  assert.ok(R.appliquerSituation(main, BASE.taches, { ...SIT, mode: 'soi' }).taches.some((t) => t.titre === 'Réserver la salle'));
});

test('échéances relatives : la date du déménagement déplace tout le rétroplanning', () => {
  const t = tache(-14);
  assert.equal(R.echeance('2026-12-12', t), '2026-11-28');
  assert.equal(R.echeance('2026-12-19', t), '2026-12-05');
  eq(simple(R.decalage('2026-12-12', '2026-12-19', [t, tache(-3, { statut: 'fait' })])), { jours: 7, taches: 1 });
  eq(simple(R.decalage('2026-12-12', '2026-12-12', [t])), { jours: 0, taches: 0 });
});

test('statuts : fait, sans objet, en retard, sous 7 jours, à venir', () => {
  const date = '2026-11-26'; // J−12
  assert.equal(R.statutTache(tache(-14), date, AUJ), 'retard');
  assert.equal(R.statutTache(tache(-12), date, AUJ), 'bientot'); // aujourd'hui
  assert.equal(R.statutTache(tache(-5), date, AUJ), 'bientot'); // dans 7 jours
  assert.equal(R.statutTache(tache(-4), date, AUJ), 'avenir');
  assert.equal(R.statutTache(tache(-30, { statut: 'fait' }), date, AUJ), 'fait');
  assert.equal(R.statutTache(tache(-30, { statut: 'so' }), date, AUJ), 'so');
});

test('progression : sans objet exclu du compte, compteurs de retard et de la semaine', () => {
  const date = '2026-11-26';
  const l = [tache(-30, { statut: 'fait' }), tache(-20, { id: 'b', statut: 'so' }), tache(-14, { id: 'c' }), tache(-10, { id: 'd' }), tache(0, { id: 'e' })];
  const p = R.progression(l, date, AUJ);
  eq(simple(p), { total: 5, fait: 1, so: 1, aFaire: 3, retard: 1, bientot: 1, pct: 25 });
  assert.equal(R.progression([], date, AUJ).pct, 0);
  assert.equal(R.progression([tache(1, { statut: 'so' })], date, AUJ).pct, 100);
  const b = R.aFaireBientot(l, date, AUJ);
  eq(b.map((x) => [x.id, x.etat, x.echeance]), [['c', 'retard', '2026-11-12'], ['d', 'bientot', '2026-11-16']]);
});

test('phases : de « plus de deux mois avant » au premier mois', () => {
  assert.equal(R.phase(-90).id, 'avant');
  assert.equal(R.phase(-56).id, 's8');
  assert.equal(R.phase(-43).id, 's8');
  assert.equal(R.phase(-42).id, 's6');
  assert.equal(R.phase(-15).id, 's4');
  assert.equal(R.phase(-8).id, 's2');
  assert.equal(R.phase(-1).id, 's1');
  assert.equal(R.phase(0).id, 'j');
  assert.equal(R.phase(7).id, 'apres1');
  assert.equal(R.phase(30).id, 'apres');
  assert.equal(R.phaseDuJour('2026-11-26', AUJ).id, 's2');
  // Chaque J de −365 à +365 a une phase.
  for (let j = -365; j <= 365; j++) assert.ok(R.phase(j), `J ${j}`);
});

test('cartons : numéro suivant et recherche « dans quel carton est… »', () => {
  const pieces = { cuisine: 'Cuisine', salon: 'Salon', cave: 'Cave ou garage' };
  const nom = (id) => pieces[id] || '';
  const l = [
    carton(3, { contenu: 'Perceuse, tournevis, niveau à bulle', piece: 'cave' }),
    carton(12, { contenu: 'Vaisselle : assiettes plates et creuses', piece: 'cuisine', fragile: true }),
    carton(1, { contenu: 'Livres de poche, bandes dessinées', piece: 'salon' }),
    carton(21, { contenu: 'Câbles HDMI et chargeurs', piece: 'salon', note: 'Télécommande de la télé' }),
  ];
  assert.equal(R.numeroSuivant(l), 22);
  assert.equal(R.numeroSuivant([]), 1);
  eq(R.rechercherCartons(l, 'perceuse', nom).map((c) => c.num), [3]);
  eq(R.rechercherCartons(l, 'PERCEUSE', nom).map((c) => c.num), [3]);
  eq(R.rechercherCartons(l, 'cables', nom).map((c) => c.num), [21], 'sans accents');
  eq(R.rechercherCartons(l, 'telecommande', nom).map((c) => c.num), [21], 'note comprise');
  eq(R.rechercherCartons(l, 'salon', nom).map((c) => c.num), [1, 21], 'nom de la pièce');
  eq(R.rechercherCartons(l, 'assiettes creuses', nom).map((c) => c.num), [12], 'tous les mots');
  eq(R.rechercherCartons(l, 'assiettes verres', nom).map((c) => c.num), []);
  eq(R.rechercherCartons(l, '12', nom).map((c) => c.num), [12]);
  eq(R.rechercherCartons(l, 'n°3', nom).map((c) => c.num), [3]);
  eq(R.rechercherCartons(l, '#21', nom).map((c) => c.num), [21]);
  eq(R.rechercherCartons(l, '', nom).map((c) => c.num), [1, 3, 12, 21]);
});

test('cartons : avancement, regroupement par pièce, manquants après le jour J', () => {
  const pieces = [{ id: 'salon' }, { id: 'cuisine' }];
  const l = [carton(1, { piece: 'salon', statut: 'remplir' }), carton(2, { piece: 'cuisine', statut: 'arrive', fragile: true }), carton(3, { piece: 'cuisine', statut: 'deballe', prioritaire: true }), carton(4, { piece: 'disparue' })];
  const a = R.avancementCartons(l);
  eq([a.total, a.remplir, a.ferme, a.arrive, a.deballe, a.fragiles, a.prioritaires, a.pctPrets, a.pctDeballes], [4, 1, 1, 1, 1, 1, 1, 75, 25]);
  const g = R.parPiece(l, pieces);
  eq(g.map((x) => [x.piece, x.cartons.map((c) => c.num)]), [['salon', [1]], ['cuisine', [2, 3]], [null, [4]]]);
  assert.equal(g[1].deballe, 1);
  eq(R.cartonsManquants(l, '2026-11-20', AUJ), [], 'avant J : rien de manquant');
  eq(R.cartonsManquants(l, AUJ, AUJ).map((c) => c.num), [1, 4]);
});

test('volume estimé : meubles, objets ajoutés, cartons et marge', () => {
  const v = R.normaliserVolume({ items: { canape3: 1, chaise: 4, inconnu: 3 }, extras: [{ nom: 'Aquarium', vol: 0.4, qte: 1 }], marge: 10 });
  const r = R.volumeEstime(v, BASE.meubles, 20, { volumeCarton: 0.06 });
  // 2,5 + 4 × 0,3 + 0,4 = 4,1 ; 20 cartons × 0,06 = 1,2 ; brut 5,3 ; +10 % = 5,83 → 5,8
  eq(simple(r), { mobilier: 4.1, nbCartons: 20, cartons: 1.2, brut: 5.3, marge: 10, total: 5.8 });
  // Nombre de cartons saisi : prime sur l'inventaire.
  assert.equal(R.volumeEstime({ ...v, cartons: 50 }, BASE.meubles, 20).nbCartons, 50);
  assert.equal(R.volumeEstime(R.normaliserVolume({}), BASE.meubles, 0).total, 0);
});

test('devis : prix au m³, moins cher, écart, validité dépassée, reste à payer', () => {
  const devis = [
    R.normaliserDevis({ id: 'a', entreprise: 'Déménageur A', montant: 1450, volume: 29, acompte: 400, inclus: ['fragile', 'demontage', 'assurance'], validite: '2026-12-01' }),
    R.normaliserDevis({ id: 'b', entreprise: 'Déménageur B', montant: 980, inclus: ['assurance'], validite: '2026-11-10' }),
    R.normaliserDevis({ id: 'c', entreprise: 'Déménageur C', montant: null }),
  ];
  const c = R.comparerDevis(devis, 28, AUJ);
  const [a, b, x] = c.lignes;
  assert.equal(c.min, 980);
  assert.equal(c.max, 1450);
  eq([a.prixM3, a.volumeEstime, a.moinsCher, a.ecart, a.expire, a.inclus, a.resteAPayer], [50, false, false, 470, false, 3, 1050]);
  eq([b.prixM3, b.volumeRetenu, b.volumeEstime, b.moinsCher, b.ecart, b.expire], [35, 28, true, true, 0, true]);
  eq([x.prixM3, x.moinsCher, x.ecart, x.resteAPayer], [null, false, null, null]);
  eq(simple(c.ordre), ['b', 'a', 'c']);
});

test('retenir un devis : un seul retenu, ligne de budget liée créée puis mise à jour, déliée au retrait', () => {
  const devis = [R.normaliserDevis({ id: 'a', entreprise: 'Déménageur A', montant: 1450 }), R.normaliserDevis({ id: 'b', entreprise: 'Déménageur B', montant: 980 })];
  let r = R.retenirDevis(devis, [R.normaliserLigne({ id: 'x', poste: 'cartons', libelle: 'Cartons', prevu: 80 })], 'a');
  eq(r.devis.map((d) => d.retenu), [true, false]);
  assert.equal(r.budget.length, 2);
  eq([r.budget[0].poste, r.budget[0].prevu, r.budget[0].devis, r.budget[0].libelle], ['demenageur', 1450, 'a', 'Déménageur · Déménageur A']);
  r = R.retenirDevis(r.devis, r.budget, 'b');
  eq(r.devis.map((d) => d.retenu), [false, true]);
  assert.equal(r.budget.length, 2, 'même ligne réutilisée');
  eq([r.budget[0].prevu, r.budget[0].devis], [980, 'b']);
  r = R.retenirDevis(r.devis, r.budget, 'b');
  eq(r.devis.map((d) => d.retenu), [false, false]);
  assert.equal(r.budget[0].devis, null);
  assert.equal(r.budget[0].prevu, 980, 'montant gardé');
  // Une ligne « Déménageur » vide existante est reprise plutôt que doublée.
  const r2 = R.retenirDevis(devis, [R.normaliserLigne({ id: 'd', poste: 'demenageur', libelle: 'Déménageur' })], 'a');
  assert.equal(r2.budget.length, 1);
  assert.equal(r2.budget[0].prevu, 1450);
});

test('budget : prévu, réel, écart sur les lignes réalisées, payé et reste à payer', () => {
  const l = [
    R.normaliserLigne({ libelle: 'Déménageur', prevu: 1450, reel: null, paye: false }),
    R.normaliserLigne({ libelle: 'Cartons', prevu: 120, reel: '96,50', paye: true }),
    R.normaliserLigne({ libelle: 'Ménage', prevu: 180, reel: 210, paye: false }),
    R.normaliserLigne({ libelle: 'Divers' }),
  ];
  const t = R.totauxBudget(l);
  eq([t.prevu, t.reel, t.ecart, t.paye, t.resteAPayer, t.estime, t.sansMontant], [1750, 306.5, 6.5, 96.5, 1660, 1756.5, 1]);
  assert.equal(R.montant('1 234,5'), 1234.5);
  assert.equal(R.montant('-3'), null);
  assert.equal(R.montant(''), null);
});

test('normaliser : tolérant aux données anciennes ou invalides', () => {
  const e = R.normaliser({ date: 'pas une date', taches: [{ titre: '', j: 900, statut: 'bizarre' }], cartons: [{ num: -4, statut: 'x' }], devis: [{}], budget: [{ prevu: 'abc' }], pieces: [], volume: { items: { canape3: 200, chaise: 0 }, marge: 99 } }, AUJ, BASE);
  assert.equal(e.date, R.ajout(AUJ, 56));
  eq([e.taches[0].titre, e.taches[0].j, e.taches[0].statut], ['Tâche', 365, 'afaire']);
  eq([e.cartons[0].num, e.cartons[0].statut], [1, 'remplir']);
  assert.equal(e.devis[0].entreprise, 'Déménageur');
  assert.equal(e.budget[0].prevu, null);
  assert.equal(e.pieces.length, BASE.pieces.length, 'pièces de la base si vides');
  eq(simple(e.volume.items), { canape3: 99 });
  assert.equal(e.volume.marge, 50);
  eq(simple(e.situation), simple(R.normaliserSituation({})));
  const vide = R.normaliser(null, AUJ, BASE);
  eq([vide.taches.length, vide.cartons.length, vide.devis.length], [0, 0, 0]);
  assert.ok(vide.pieces.every((p, i) => p.couleur === BASE.couleurs[i]));
});

test('exports CSV : point-virgule, guillemets, BOM, statuts calculés', () => {
  const nomPiece = (id) => ({ cuisine: 'Cuisine' }[id] || '');
  const c = R.versCsvCartons([carton(2, { contenu: 'Verres; "à pied"', fragile: true }), carton(1, { contenu: 'Casseroles' })], nomPiece);
  assert.ok(c.startsWith('﻿Numéro;Pièce;Contenu'));
  const lignes = c.slice(1).split('\r\n');
  assert.equal(lignes[1], '1;Cuisine;Casseroles;;;;Fermé;');
  assert.equal(lignes[2], '2;Cuisine;"Verres; ""à pied""";Oui;;;Fermé;');
  const t = R.versCsvTaches([tache(-14), tache(-3, { statut: 'fait', faitLe: '2026-11-13' })], '2026-11-26', () => 'Logement', AUJ);
  assert.equal(t.slice(1).split('\r\n')[1], 'Tâche -14;Logement;J-14;2026-11-12;En retard;;');
  assert.equal(R.versCsvBudget([R.normaliserLigne({ libelle: 'Cartons', prevu: 96.5, paye: true })]).slice(1).split('\r\n')[1], 'Cartons;96,5;;Oui');
});

test('base intégrée : catégories, conditions et identifiants cohérents, aucune démarche datée', () => {
  const cats = new Set(BASE.categories.map((c) => c.id));
  const ids = new Set();
  const conditions = new Set(['', 'depart:locataire', 'depart:proprietaire', 'arrivee:locataire', 'arrivee:proprietaire', 'mode:pro', 'mode:soi', 'enfants', 'animaux', 'vehicule']);
  for (const t of BASE.taches) {
    assert.ok(cats.has(t.cat), `catégorie ${t.id}`);
    assert.ok(!ids.has(t.id), `doublon ${t.id}`); ids.add(t.id);
    assert.ok(conditions.has(t.si), `condition ${t.id}`);
    assert.ok(Number.isInteger(t.j) && t.j >= -90 && t.j <= 30, `J ${t.id}`);
    // Aucun délai chiffré ni date dans les démarches : « 1 mois », « 10 jours », « 2026 »…
    const txt = `${t.titre} ${t.aide}`;
    assert.ok(!/\b\d+\s*(jours?|mois|semaines?|ans?)\b/i.test(txt), `délai chiffré dans ${t.id} : ${txt}`);
    assert.ok(!/\b20\d\d\b/.test(txt), `année dans ${t.id}`);
  }
  assert.ok(BASE.taches.length >= 70, `${BASE.taches.length} tâches`);
  for (const c of cats) assert.ok(BASE.taches.some((t) => t.cat === c), `catégorie vide ${c}`);
  const m = new Set();
  for (const x of BASE.meubles) { assert.ok(x.v > 0 && x.v < 5, x.id); assert.ok(!m.has(x.id)); m.add(x.id); }
  assert.ok(BASE.pieces.length <= BASE.couleurs.length);
  assert.ok(BASE.couleurs.every((c) => /^#[0-9A-F]{6}$/i.test(c)));
});
