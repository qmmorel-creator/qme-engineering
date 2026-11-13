// Tests des règles métier de l'inventaire valorisé (templates/patrimoine/calculs.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/patrimoine/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('calculs.js', dossier), 'utf8'), ctx);
const B = ctx.window.BASE;
const C = ctx.window.PTM_CALCUL;
const coefs = () => JSON.parse(JSON.stringify({ familles: B.familles, etats: B.etats, tranchesPrix: B.tranchesPrix, reventeFacile: B.reventeFacile }));
const proche = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const REF = '2026-11-13';
const objet = (extra = {}) => ({ id: 'o1', nom: 'Ordinateur', categorie: 'informatique', sousCategorie: 'portables', prixAchat: 500, dateAchat: '2026-11', etat: 'neuf', usage: 'quotidien', quantite: 1, ...extra });

test('base intégrée : 15 catégories du cahier des charges, sous-catégories, exemples, aucune base vide', () => {
  assert.equal(B.categories.length, 15);
  const noms = B.categories.map((c) => c.nom);
  for (const n of ['Informatique et électronique', 'Téléphonie et objets connectés', 'Électroménager', 'Mobilier', 'Décoration', 'Vêtements et chaussures', 'Bijoux et accessoires',
    'Sports et loisirs', 'Instruments de musique', 'Outillage et bricolage', 'Livres et collections', 'Jeux et divertissement', 'Équipements automobiles et mobilité', 'Équipements de jardin', 'Autres biens']) assert.ok(noms.includes(n), n);
  const familles = new Set(B.familles.map((f) => f.id));
  for (const c of B.categories) {
    assert.ok(c.sous.length >= 3, c.id);
    for (const s of c.sous) { assert.ok(familles.has(s.famille), `${c.id}/${s.id}`); assert.ok(s.exemples.length >= 2, `${c.id}/${s.id}`); }
  }
  assert.equal(B.etats.length, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(B.etats.map((e) => e.nom))), ['Neuf', 'Comme neuf', 'Très bon état', 'Bon état', 'État correct', 'Mauvais état', 'Hors service']);
  for (const id of ['electronique', 'informatique', 'electromenager', 'mobilier', 'vetements', 'outillage', 'loisirs', 'collections']) assert.ok(familles.has(id), id);
});

test('aucun prix de marché intégré : les exemples sont des noms seuls', () => {
  for (const c of B.categories) for (const s of c.sous) for (const x of s.exemples) assert.equal(typeof x, 'string');
  assert.ok(!/\d+\s*€/.test(JSON.stringify(B.categories)));
});

test('durée de possession : mois, année seule, date future', () => {
  proche(C.anneesPossession('2024-11', REF), 2 + 12 / 31 / 12, 0.01);
  proche(C.anneesPossession('2026-11', REF), 12 / 31 / 12, 0.01);
  proche(C.anneesPossession('2020', '2026-07-01'), 6, 0.001);
  assert.equal(C.anneesPossession('2030-01', REF), 0);
  assert.equal(C.anneesPossession('', REF), 0);
});

test('rétention : linéaire la première année, géométrique ensuite, plancher respecté', () => {
  const f = { an1: 30, annuel: 10, plancher: 20 };
  assert.equal(C.retention(0, f), 1);
  proche(C.retention(0.5, f), 0.85);
  proche(C.retention(1, f), 0.7);
  proche(C.retention(3, f), 0.7 * 0.81);
  assert.equal(C.retention(50, f), 0.2);
  proche(C.retention(1, f, 2), 0.4); // décote doublée
});

test('valorisation : prix × rétention × état, revente = actuelle × (1 − écart)', () => {
  const c = coefs();
  const v = C.valoriser(objet({ dateAchat: '2025-11', etat: 'bon', prixAchat: 500 }), c, B, '2026-11-01');
  // informatique : an1 35 %, prix 300–1000 → multiplicateur 1, un an juste → 0,65 ; état bon 0,72.
  proche(v.actuelle, 500 * 0.65 * 0.72, 0.5);
  proche(v.revente, v.actuelle * 0.8, 0.01);
  proche(v.perte, 500 - v.actuelle, 0.01);
  assert.equal(v.source, 'estimee');
});

test('les coefficients modifiés par l\'utilisateur changent l\'estimation', () => {
  const c = coefs();
  const avant = C.valoriser(objet({ dateAchat: '2024-11' }), c, B, REF).actuelle;
  c.familles.find((f) => f.id === 'informatique').annuel = 40;
  const apres = C.valoriser(objet({ dateAchat: '2024-11' }), c, B, REF).actuelle;
  assert.ok(apres < avant);
  c.etats.find((e) => e.id === 'neuf').coef = 0.5;
  proche(C.valoriser(objet({ dateAchat: '2024-11' }), c, B, REF).actuelle, apres * 0.5, 0.01);
});

test('le prix d\'achat module la décote (tranches)', () => {
  assert.equal(C.multiplicateurPrix(20, B.tranchesPrix), 1.25);
  assert.equal(C.multiplicateurPrix(50, B.tranchesPrix), 1.1);
  assert.equal(C.multiplicateurPrix(999, B.tranchesPrix), 1);
  assert.equal(C.multiplicateurPrix(1000, B.tranchesPrix), 0.85);
  const c = coefs();
  const cher = C.valoriser(objet({ prixAchat: 2000, dateAchat: '2023-11' }), c, B, REF);
  const moyen = C.valoriser(objet({ prixAchat: 500, dateAchat: '2023-11' }), c, B, REF);
  assert.ok(cher.partConservee > moyen.partConservee);
});

test('ancienneté distincte de la possession : occasion sans double décote', () => {
  const c = coefs();
  const neuf = C.valoriser(objet({ prixAchat: 600, dateAchat: '2025-11', etat: 'neuf' }), c, B, '2026-11-01');
  const occasion = C.valoriser(objet({ prixAchat: 600, dateAchat: '2025-11', etat: 'neuf', ageAchat: 2 }), c, B, '2026-11-01');
  // Un objet déjà âgé de 2 ans perd moins pendant l'année suivante que pendant sa première année.
  assert.ok(occasion.actuelle > neuf.actuelle);
  proche(occasion.age, 3, 0.01);
  proche(occasion.actuelle, 600 * 0.8, 0.5); // perte annuelle informatique 20 %
});

test('valeur manuelle prioritaire, revente déduite ou saisie', () => {
  const c = coefs();
  const v = C.valoriser(objet({ valeurManuelle: 300 }), c, B, REF);
  assert.equal(v.actuelle, 300); assert.equal(v.source, 'manuelle'); proche(v.revente, 240);
  const w = C.valoriser(objet({ valeurManuelle: 300, reventeManuelle: 280 }), c, B, REF);
  assert.equal(w.revente, 280); assert.equal(w.sourceRevente, 'manuelle');
  const z = C.valoriser(objet({ prixAchat: null, valeurManuelle: '' }), c, B, REF);
  assert.equal(z.actuelle, 0); assert.ok(z.aCompleter);
});

test('quantité, hors service, collections sans décote', () => {
  const c = coefs();
  const lot = C.valoriser(objet({ quantite: 3, prixAchat: 100 }), c, B, REF);
  const un = C.valoriser(objet({ quantite: 1, prixAchat: 100 }), c, B, REF);
  proche(lot.actuelle, un.actuelle * 3); assert.equal(lot.achat, 300);
  const hs = C.valoriser(objet({ etat: 'hs', dateAchat: '2020-01' }), c, B, REF);
  assert.ok(hs.actuelle <= 500 * 0.05); // hors service : au plus 5 % du prix
  const art = C.valoriser({ id: 'a', nom: 'Tableau', categorie: 'livres', sousCategorie: 'art', prixAchat: 800, dateAchat: '2010-01', etat: 'neuf' }, c, B, REF);
  assert.equal(art.actuelle, 800);
});

test('bilan : totaux, catégories triées, top 10, peu utilisés, part facile', () => {
  const c = coefs();
  const objets = [
    objet({ id: 'a', prixAchat: 1200, usage: 'quotidien' }),
    objet({ id: 'b', categorie: 'mobilier', sousCategorie: 'salon', prixAchat: 900, dateAchat: '2022-01', usage: 'jamais', etat: 'bon' }),
    objet({ id: 'c', categorie: 'sports', sousCategorie: 'velos', prixAchat: 700, dateAchat: '2023-05', usage: 'rare', etat: 'tres-bon' }),
    objet({ id: 'd', categorie: 'vetements', sousCategorie: 'hauts', prixAchat: 30, quantite: 4, usage: 'hebdo' }),
  ];
  const b = C.bilan(objets, c, B, REF, 100);
  assert.equal(b.nbObjets, 7); assert.equal(b.nbLignes, 4);
  proche(b.total.achat, 1200 + 900 + 700 + 120);
  proche(b.total.actuelle, b.lignes.reduce((s, l) => s + l.v.actuelle, 0));
  proche(b.categories.reduce((s, x) => s + x.part, 0), 1);
  for (let i = 1; i < b.categories.length; i += 1) assert.ok(b.categories[i - 1].actuelle >= b.categories[i].actuelle);
  assert.equal(b.top10[0].objet.id, 'a');
  assert.deepEqual(b.peuUtilisesDeValeur.map((l) => l.objet.id).sort(), ['b', 'c'].filter((id) => b.lignes.find((l) => l.objet.id === id).v.actuelle >= 100).sort());
  assert.equal(b.nbJamais, 1);
  assert.ok(b.partFacile > 0 && b.partFacile <= 1);
  proche(b.moyenne, b.total.actuelle / 7);
});

test('simulateur : frais, négociation, expédition et objets non rentables', () => {
  const c = coefs();
  const b = C.bilan([objet({ id: 'a', valeurManuelle: 500, reventeManuelle: 400 }), objet({ id: 'b', valeurManuelle: 10, reventeManuelle: 8, usage: 'jamais' })], c, B, REF);
  const r = C.simuler(b.lignes, { perimetre: 'tous', decote: 10, negociation: 10, commission: 5, fraisFixes: 2, expedition: 10, partExpediee: 50 }, B);
  // 400 × 0,9 × 0,9 = 324 ; commission 16,2 ; frais fixes 2 ; expédition 5 → net 300,8.
  proche(r.net, 300.8); assert.equal(r.nbVendus, 1); assert.equal(r.nbNonRentables, 1);
  proche(r.reventeBrute, 400); proche(r.decote, 40); proche(r.negociation, 36); proche(r.commission, 16.2); proche(r.expedition, 5);
});

test('simulateur : périmètres catégorie, inutilisés, seuil, nombre', () => {
  const c = coefs();
  const objets = [objet({ id: 'a', reventeManuelle: 600, valeurManuelle: 700 }), objet({ id: 'b', categorie: 'mobilier', sousCategorie: 'salon', reventeManuelle: 200, valeurManuelle: 250, usage: 'rare' }),
    objet({ id: 'c', categorie: 'mobilier', sousCategorie: 'salon', reventeManuelle: 50, valeurManuelle: 60, usage: 'jamais' })];
  const l = C.bilan(objets, c, B, REF).lignes;
  const ids = (sim) => C.selectionner(l, sim, B).map((x) => x.objet.id).sort().join();
  assert.equal(ids({ perimetre: 'categorie', cible: 'mobilier' }), 'b,c');
  assert.equal(ids({ perimetre: 'inutilises' }), 'b,c');
  assert.equal(ids({ perimetre: 'jamais' }), 'c');
  assert.equal(ids({ perimetre: 'seuil', cible: 200 }), 'a,b');
  assert.equal(ids({ perimetre: 'nombre', cible: 1 }), 'a');
  assert.equal(ids({ perimetre: 'tous' }), 'a,b,c');
  const sans = C.simuler(l, { perimetre: 'tous', decote: 0, negociation: 0, commission: 0, fraisFixes: 0, expedition: 0, partExpediee: 0 }, B);
  proche(sans.net, 850);
});

test('historique : photographie, une par mois, comparaison entre deux dates', () => {
  const c = coefs();
  const objets = [objet({ id: 'a', dateAchat: '2024-01', prixAchat: 800 })];
  const h1 = C.instantane(C.bilan(objets, c, B, '2025-11-13'), '2025-11-13', 'h1');
  const h2 = C.instantane(C.bilan([...objets, objet({ id: 'b', categorie: 'mobilier', sousCategorie: 'salon', prixAchat: 400, dateAchat: '2026-10' })], c, B, REF), REF, 'h2');
  assert.ok(C.instantaneDu([h2], REF)); assert.ok(!C.instantaneDu([h1], REF));
  const cmp = C.comparer(h1, h2);
  assert.equal(cmp.nb.ecart, 1);
  proche(cmp.achat.ecart, 400);
  assert.ok(cmp.categories.some((x) => x.id === 'mobilier' && x.actuelle.avant === 0));
  assert.ok(h2.parCategorie.informatique.actuelle < h1.parCategorie.informatique.actuelle);
});

test('projection : valeur décroissante année après année', () => {
  const p = C.projection([objet({ dateAchat: '2025-01', prixAchat: 1000 })], coefs(), B, REF, 5);
  assert.equal(p.length, 6);
  for (let i = 1; i < p.length; i += 1) assert.ok(p[i].actuelle <= p[i - 1].actuelle);
});

test('export CSV : en-têtes, point-virgule, guillemets, BOM', () => {
  const c = coefs();
  const b = C.bilan([objet({ nom: 'Canapé "cuir"; 3 places', valeurManuelle: 250.5 })], c, B, REF);
  const s = C.csv(b, B, c);
  assert.ok(s.startsWith('﻿Nom;Catégorie;'));
  assert.ok(s.includes('"Canapé ""cuir""; 3 places"'));
  assert.ok(s.includes('250,5;saisie'));
  assert.equal(s.trim().split('\r\n').length, 2);
});
