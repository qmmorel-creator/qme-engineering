// Tests des règles métier de Stocks et inventaire (templates/stocks/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/stocks/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.STK;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
let n = 0;
const art = (extra = {}) => R.normaliserArticle({ id: 'a', ref: 'POT-200', nom: 'Pot 200 ml', unite: 'pièce', prixAchat: 100, prixVente: 300, seuil: 10, reappro: 24, ...extra });
const mv = (type, date, quantite, extra = {}) => R.normaliserMouvement({ id: `m${++n}`, article: 'a', type, date, quantite, ...extra });
const etat = (articles, mouvements, inventaires = [], reglages = {}) => R.normaliser({ articles, mouvements, inventaires, reglages: { ...BASE.reglages, ...reglages } }, { reglages: BASE.reglages });

test('base intégrée : types de mouvements cohérents avec les règles', () => {
  assert.deepEqual(simple(BASE.mouvements.map((m) => m.id)), Object.keys(R.TYPES));
  for (const m of BASE.mouvements) assert.equal(m.sens, R.TYPES[m.id].sens);
  assert.ok(BASE.activites.every((a) => a.categories.length >= 3));
  assert.equal(BASE.reglages.methode, 'cmup');
});

test('saisie tolérante des montants et des quantités, affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('0,035 €'), 3.5);
  assert.equal(R.lireMontant('-2'), null);
  assert.equal(R.lireMontant('1,23456'), null);
  assert.equal(R.lireQuantite('1,5'), 1.5);
  assert.equal(R.lireQuantite('-3'), null);
  assert.equal(R.lireQuantite('-3', { signe: true }), -3);
  assert.equal(R.lireQuantite('−2,25', { signe: true }), -2.25);
  assert.equal(R.lireQuantite('abc'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(3.5, { unitaire: true }), '0,035 €');
  assert.equal(R.euros(3.5), '0,04 €');
  assert.equal(R.euros(-500), '−5,00 €');
  assert.equal(R.euros(917.53, { unitaire: true }), '9,18 €');
  assert.equal(R.saisieMontant(1250), '12,50');
  assert.equal(R.saisieMontant(3.5), '0,035');
  assert.equal(R.nombre(1234.5), '1 234,5');
  assert.equal(R.pct(33.333), '33,3 %');
});

test('stock calculé par les mouvements, dans l\'ordre des dates', () => {
  const a = art();
  const m = [
    mv('sortie', '2026-10-05', 4),
    mv('entree', '2026-10-01', 20, { prix: 100 }),
    mv('perte', '2026-10-06', 1, { note: 'Casse' }),
    mv('retourClient', '2026-10-07', 1),
    mv('retourFournisseur', '2026-10-08', 2),
    mv('ajustement', '2026-10-09', -3),
    mv('ajustement', '2026-10-10', 1.5),
  ];
  assert.equal(R.stockA(a, m, '2026-10-04'), 20);
  assert.equal(R.stockA(a, m, AUJ), 12.5);
  // Une quantité saisie négative pour une sortie reste une sortie.
  assert.equal(R.delta(R.normaliserMouvement({ type: 'sortie', quantite: -2 })), -2);
  const h = R.historique(a, m, AUJ);
  assert.deepEqual(simple(h.lignes.map((l) => l.stock)), [20, 16, 15, 16, 14, 11, 12.5]);
  assert.equal(h.derniereSortie, '2026-10-05');
  assert.equal(h.premier, '2026-10-01');
});

test('CMUP : moyenne pondérée à chaque entrée, inchangé par les sorties', () => {
  const a = art({ prixAchat: 100 });
  const m = [
    mv('entree', '2026-09-01', 10, { prix: 100 }),
    mv('sortie', '2026-09-05', 4),
    mv('entree', '2026-09-10', 6, { prix: 160 }),
  ];
  const h = R.historique(a, m, AUJ);
  // (6 × 1,00 + 6 × 1,60) ÷ 12 = 1,30 €
  proche(h.cmup, 130);
  assert.equal(h.dernierPrix, 160);
  assert.equal(h.stock, 12);
  // Une sortie suivante se fait au coût moyen sans le modifier.
  const h2 = R.historique(a, [...m, mv('sortie', '2026-09-12', 5)], AUJ);
  proche(h2.cmup, 130);
  assert.equal(h2.lignes.at(-1).cout, 130);
  // Valorisation selon la méthode affichée.
  assert.equal(R.valeur(12, R.coutUnitaire(h, 'cmup')), 1560);
  assert.equal(R.valeur(12, R.coutUnitaire(h, 'dernier')), 1920);
});

test('CMUP : repart du prix d\'entrée quand le stock était nul ou négatif ; prix de fiche par défaut', () => {
  const a = art({ prixAchat: 200 });
  const m = [
    mv('entree', '2026-09-01', 5, { prix: 100 }),
    mv('sortie', '2026-09-02', 7), // stock −2 (anomalie)
    mv('entree', '2026-09-03', 10, { prix: 150 }),
  ];
  const h = R.historique(a, m, AUJ);
  assert.equal(h.cmup, 150);
  assert.equal(h.stock, 8);
  // Entrée sans prix : prix d'achat de la fiche.
  const h2 = R.historique(a, [mv('entree', '2026-09-01', 4)], AUJ);
  assert.equal(h2.cmup, 200);
  // Aucun mouvement : coût = prix de la fiche, stock 0, valeur 0.
  const h3 = R.historique(a, [], AUJ);
  assert.equal(h3.cmup, 200);
  assert.equal(R.valeur(-3, 200), 0);
  // Un retour client ou un ajustement positif ne change pas le coût moyen.
  const h4 = R.historique(a, [mv('entree', '2026-09-01', 4, { prix: 120 }), mv('retourClient', '2026-09-02', 1), mv('ajustement', '2026-09-03', 2)], AUJ);
  assert.equal(h4.cmup, 120);
  assert.equal(h4.stock, 7);
});

test('marge théorique : marge unitaire, taux de marque, coefficient', () => {
  const x = R.marge(300, 130);
  assert.equal(x.unitaire, 170);
  proche(x.tauxMarque, 56.6666667, 1e-5);
  assert.equal(x.coefficient, 2.31);
  assert.equal(R.marge(null, 130).unitaire, null);
  assert.equal(R.marge(300, null).tauxMarque, null);
  assert.ok(R.marge(100, 150).unitaire < 0);
});

test('quantité à commander : multiple de la quantité de réapprovisionnement, ou double du seuil', () => {
  assert.equal(R.quantiteACommander(11, 10, 24), 0);
  assert.equal(R.quantiteACommander(10, 10, 5), 5);   // au seuil : on commande
  assert.equal(R.quantiteACommander(3, 10, 12), 12);
  assert.equal(R.quantiteACommander(4, 10, 6), 12);   // 4 + 6 = 10 ne dépasse pas le seuil
  assert.equal(R.quantiteACommander(-5, 10, 6), 18);
  assert.equal(R.quantiteACommander(3, 10, 0), 17);   // sans réappro : retour à 2 × seuil
  assert.equal(R.quantiteACommander(0, 0, 10), 0);    // sans seuil : pas d'alerte
  assert.equal(R.quantiteACommander(0.5, 2, 1.5), 3);
});

test('statuts : rupture, sous le seuil, dormant, en stock, jamais en stock, archivé', () => {
  const ent = (q, d = '2026-05-01') => mv('entree', d, q, { prix: 100 });
  const s = (a, m) => R.situation(a, etat([a], m), AUJ);
  assert.equal(s(art(), [ent(5), mv('sortie', '2026-11-01', 5)]).statut, 'rupture');
  assert.equal(s(art(), [ent(15), mv('sortie', '2026-11-01', 6)]).statut, 'sousSeuil');
  assert.equal(s(art(), [ent(30), mv('sortie', '2026-11-01', 6)]).statut, 'ok');
  // Dernière vente il y a plus de 90 jours.
  const d = s(art(), [ent(30), mv('sortie', '2026-07-01', 2)]);
  assert.equal(d.statut, 'dormant');
  assert.equal(d.dormant, true);
  // Jamais vendu, premier mouvement ancien : dormant ; récent : pas encore.
  assert.equal(s(art(), [ent(30)]).dormant, true);
  assert.equal(s(art(), [ent(30, '2026-11-01')]).dormant, false);
  assert.equal(s(art(), []).statut, 'nouveau');
  assert.equal(s(art({ inactif: true }), [ent(5)]).statut, 'inactif');
  assert.equal(s(art({ inactif: true }), [ent(5)]).aCommander, 0);
  // Rupture prioritaire sur l'alerte ; stock négatif signalé.
  const neg = s(art(), [ent(2), mv('sortie', '2026-11-01', 3)]);
  assert.equal(neg.statut, 'rupture');
  assert.equal(neg.negatif, true);
  assert.equal(neg.valeur, 0);
  assert.equal(neg.aCommander, 24);
  assert.equal(neg.coutCommande, 2400);
});

test('rotation et couverture sur la période', () => {
  const a = art();
  const m = [
    mv('entree', '2026-08-01', 40, { prix: 100 }),
    mv('sortie', '2026-09-01', 10),
    mv('sortie', '2026-10-01', 10),
    mv('sortie', '2026-11-01', 10),
    mv('perte', '2026-11-02', 2), // une perte n'est pas une vente
  ];
  const r = R.rotation(a, m, AUJ, 90);
  // Début de période (16/08) : 40 ; fin : 8 ; stock moyen 24 ; 30 vendus dans la période (la perte ne compte pas).
  assert.equal(r.sorties, 30);
  assert.equal(r.stockMoyen, 24);
  assert.equal(r.rotation, 1.25);
  assert.equal(r.couverture, 24); // 8 ÷ (30 ÷ 90)
  const vide = R.rotation(a, [], AUJ, 90);
  assert.equal(vide.rotation, null);
  assert.equal(vide.couverture, null);
});

test('synthèse : valeur selon la méthode, à commander par fournisseur, dormants, catégories, ventes', () => {
  const a1 = art({ id: 'a1', categorie: 'Emballages', fournisseur: 'Verrerie Exemple' });
  const a2 = art({ id: 'a2', nom: 'Cire', categorie: 'Matières', unite: 'kg', fournisseur: 'Verrerie Exemple', seuil: 5, reappro: 10, prixVente: null });
  const a3 = art({ id: 'a3', nom: 'Mug', categorie: 'Revente', fournisseur: '', seuil: 0 });
  const a4 = art({ id: 'a4', nom: 'Ancien', inactif: true });
  const m = [
    R.normaliserMouvement({ id: 'x1', article: 'a1', type: 'entree', date: '2026-10-01', quantite: 10, prix: 100 }),
    R.normaliserMouvement({ id: 'x2', article: 'a1', type: 'entree', date: '2026-10-02', quantite: 10, prix: 200 }),
    R.normaliserMouvement({ id: 'x3', article: 'a1', type: 'sortie', date: '2026-11-10', quantite: 12 }),
    R.normaliserMouvement({ id: 'x4', article: 'a2', type: 'entree', date: '2026-10-01', quantite: 4, prix: 900 }),
    R.normaliserMouvement({ id: 'x5', article: 'a3', type: 'entree', date: '2026-05-01', quantite: 6, prix: 250 }),
    R.normaliserMouvement({ id: 'x6', article: 'a4', type: 'entree', date: '2026-05-01', quantite: 6, prix: 250 }),
  ];
  const e = etat([a1, a2, a3, a4], m);
  e.categories = ['Matières', 'Emballages', 'Revente'];
  const s = R.synthese(e, AUJ);
  assert.equal(s.nbActifs, 3);
  // a1 : 8 × 1,50 = 12 € ; a2 : 4 × 9 = 36 € ; a3 : 6 × 2,50 = 15 €. a4 archivé : exclu.
  assert.equal(s.valeur, 6300);
  assert.equal(s.valeurDernier, 8 * 200 + 3600 + 1500);
  assert.deepEqual(simple(s.parCategorie.map((c) => [c.nom, c.valeur])), [['Matières', 3600], ['Revente', 1500], ['Emballages', 1200]]);
  assert.deepEqual(simple(s.aCommander.map((x) => [x.article.id, x.aCommander])), [['a1', 24], ['a2', 10]]);
  assert.equal(s.coutCommande, 24 * 200 + 10 * 900);
  assert.deepEqual(simple(s.dormants.map((x) => x.article.id)), ['a3']);
  assert.equal(s.valeurDormante, 1500);
  // Valeur de vente et marge du stock : articles avec un prix de vente seulement (a1, a3).
  assert.equal(s.valeurVente, 8 * 300 + 6 * 300);
  assert.equal(s.margeStock, 8 * 300 + 6 * 300 - 1200 - 1500);
  // Ventes des 30 derniers jours : 12 × 3,00 € ; coût au CMUP du moment (1,50 €).
  assert.equal(s.ventes.ca, 3600);
  assert.equal(s.ventes.marge, 3600 - 1800);
  const g = R.commandesParFournisseur(s.aCommander);
  assert.equal(g.length, 1);
  assert.equal(g[0].fournisseur, 'Verrerie Exemple');
  assert.equal(g[0].total, 13800);
  const t = R.texteCommande(g[0], 'Atelier Exemple');
  assert.match(t, /POT-200 · Pot 200 ml : 24 pièce/);
  assert.match(t, /Cire : 10 kg/);
  assert.match(t, /Atelier Exemple$/);
});

test('inventaire : création complète ou tournante, articles les moins récemment comptés', () => {
  const a1 = art({ id: 'a1', categorie: 'Emballages', emplacement: 'Réserve' });
  const a2 = art({ id: 'a2', nom: 'B', categorie: 'Matières', emplacement: 'Atelier' });
  const a3 = art({ id: 'a3', nom: 'C', categorie: 'Emballages', emplacement: 'Atelier' });
  const a4 = art({ id: 'a4', nom: 'D', inactif: true, categorie: 'Emballages' });
  const e = etat([a1, a2, a3, a4], [], [
    { id: 'i0', nom: 'Ancien', date: '2026-06-01', type: 'tournant', statut: 'valide', lignes: [{ article: 'a1', compte: 3 }, { article: 'a2', compte: null }] },
    { id: 'i1', nom: 'Récent', date: '2026-09-01', type: 'tournant', statut: 'valide', lignes: [{ article: 'a3', compte: 1 }] },
  ]);
  assert.deepEqual(simple(R.articlesInventaire(e, 'complet')), ['a1', 'a2', 'a3']);
  assert.deepEqual(simple(R.articlesInventaire(e, 'tournant', { categorie: 'Emballages' })), ['a1', 'a3']);
  assert.deepEqual(simple(R.articlesInventaire(e, 'tournant', { emplacement: 'Atelier' })), ['a2', 'a3']);
  assert.equal(R.dernierComptage('a1', e.inventaires), '2026-06-01');
  assert.equal(R.dernierComptage('a2', e.inventaires), null); // ligne non comptée
  // Jamais compté d'abord, puis le plus ancien.
  assert.deepEqual(simple(R.articlesInventaire(e, 'tournant', { anciens: 2 })), ['a2', 'a1']);
  const inv = R.creerInventaire(e, { id: 'i2', date: AUJ, type: 'tournant', critere: { categorie: 'Emballages' } });
  assert.equal(inv.nom, 'Inventaire tournant');
  assert.equal(inv.statut, 'enCours');
  assert.deepEqual(simple(inv.lignes), [{ article: 'a1', compte: null }, { article: 'a3', compte: null }]);
});

test('inventaire : écarts au stock théorique du jour du comptage, validation en ajustements', () => {
  const a1 = art({ id: 'a1' });
  const a2 = art({ id: 'a2', nom: 'B', prixAchat: 50 });
  const a3 = art({ id: 'a3', nom: 'C' });
  const m = [
    R.normaliserMouvement({ id: 'x1', article: 'a1', type: 'entree', date: '2026-11-01', quantite: 20, prix: 100 }),
    R.normaliserMouvement({ id: 'x2', article: 'a2', type: 'entree', date: '2026-11-01', quantite: 10, prix: 50 }),
    R.normaliserMouvement({ id: 'x3', article: 'a3', type: 'entree', date: '2026-11-01', quantite: 5, prix: 100 }),
    // Vente après le jour du comptage : n'entre pas dans le théorique.
    R.normaliserMouvement({ id: 'x4', article: 'a1', type: 'sortie', date: '2026-11-13', quantite: 4 }),
  ];
  const e = etat([a1, a2, a3], m, [{ id: 'inv', nom: 'Comptage réserve', date: '2026-11-12', type: 'complet', statut: 'enCours', lignes: [{ article: 'a1', compte: 18 }, { article: 'a2', compte: 10 }, { article: 'a3', compte: null }] }]);
  const r = R.ecartsInventaire(e.inventaires[0], e);
  assert.deepEqual(simple(r.lignes.map((l) => [l.theorique, l.compte, l.ecart, l.valeurEcart])), [[20, 18, -2, -200], [10, 10, 0, 0], [5, null, null, 0]]);
  assert.equal(r.comptees, 2);
  assert.equal(r.restantes, 1);
  assert.equal(r.avecEcart, 1);
  assert.equal(r.exactitude, 50);
  assert.equal(r.valeurMoins, -200);
  assert.equal(r.valeurNette, -200);
  let k = 0;
  const v = R.validerInventaire(e, 'inv', AUJ, () => `aj${++k}`);
  assert.equal(e.inventaires[0].statut, 'enCours'); // état d'origine intact
  const inv = v.inventaires[0];
  assert.equal(inv.statut, 'valide');
  assert.equal(inv.valideLe, AUJ);
  const aj = v.mouvements.filter((x) => x.type === 'ajustement');
  assert.equal(aj.length, 1); // seul l'écart non nul ; la ligne non comptée est ignorée
  assert.deepEqual(simple([aj[0].article, aj[0].date, aj[0].quantite, aj[0].inventaire]), ['a1', '2026-11-12', -2, 'inv']);
  assert.match(aj[0].note, /compté 18, attendu 20/);
  // Stock corrigé : 20 − 2 (ajustement) − 4 (vente du 13) = 14.
  assert.equal(R.stockA(a1, v.mouvements, AUJ), 14);
  // Après validation, les écarts restent figés (l'ajustement ne les annule pas).
  const apres = R.ecartsInventaire(inv, v);
  assert.equal(apres.lignes[0].theorique, 20);
  assert.equal(apres.lignes[0].ecart, -2);
  // Valider deux fois ne double pas les ajustements.
  const v2 = R.validerInventaire(v, 'inv', AUJ);
  assert.equal(v2.mouvements.filter((x) => x.type === 'ajustement').length, 1);
});

test('normalisation tolérante, suppression d\'un article et export CSV', () => {
  const e = R.normaliser({ reglages: { methode: 'dernier', joursDormant: 'x' }, articles: [{ id: 'a', nom: '', prixAchat: '120', seuil: -3 }], mouvements: [{ article: 'a', type: 'inconnu', date: 'hier', quantite: -2 }, { article: 'fantome', type: 'entree', date: AUJ, quantite: 1 }], inventaires: [{ lignes: [{ article: 'a', compte: '' }] }] }, { reglages: BASE.reglages });
  assert.equal(e.reglages.methode, 'dernier');
  assert.equal(e.reglages.joursDormant, 90);
  assert.equal(e.articles[0].nom, 'Article sans nom');
  assert.equal(e.articles[0].prixAchat, 120);
  assert.equal(e.articles[0].seuil, 0);
  assert.equal(e.articles[0].unite, 'pièce');
  assert.equal(e.mouvements.length, 1); // mouvement d'un article inconnu retiré
  assert.equal(e.mouvements[0].type, 'sortie');
  assert.equal(e.mouvements[0].quantite, 2);
  assert.equal(e.inventaires[0].lignes[0].compte, null);
  assert.equal(R.normaliser(null).articles.length, 0);
  const s = R.supprimerArticle(e, 'a');
  assert.equal(s.articles.length + s.mouvements.length + s.inventaires[0].lignes.length, 0);
  // CSV
  const a = art({ nom: 'Pot; "200"', prixAchat: 3.5 });
  const f = etat([a], [mv('entree', '2026-11-01', 10, { prix: 3.5 }), mv('sortie', '2026-11-02', 2)]);
  const c = R.versCsvArticles(f, AUJ);
  assert.ok(c.startsWith('﻿Référence;Article;'));
  assert.match(c, /"Pot; ""200"""/);
  assert.match(c, /;8;10;24;24;0,035;0,035;0,035;0,28;0,28;3,00;98,8;Sous le seuil;non;2026-11-02/);
  const cm = R.versCsvMouvements(f);
  assert.match(cm, /2026-11-02;POT-200;.*;Sortie;-2;pièce;;/);
  assert.equal(cm.split('\r\n').length, 3);
});
