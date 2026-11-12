// Tests des règles métier de la trésorerie prévisionnelle (templates/tresorerie/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../templates/tresorerie/regles.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const R = ctx.TRS;

// Plan de test : chaque solde ci-dessous est calculé à la main.
function plan() {
  return {
    debut: '2026-10', soldeDepart: 1000000, seuil: 1000000, ecarts: { prudent: -20, optimiste: 10 },
    lignes: [
      { id: 'a', type: 'enc', categorie: 'prestations', libelle: 'Clients', montant: 500000, recurrence: 'mensuel', mois: '2026-10', fin: null },
      { id: 'b', type: 'dec', categorie: 'loyer', libelle: 'Loyer', montant: 120000, recurrence: 'mensuel', mois: '2026-10', fin: '2027-03' },
      { id: 'c', type: 'dec', categorie: 'tva', libelle: 'TVA', montant: 300000, recurrence: 'trimestriel', mois: '2026-11', fin: null },
      { id: 'd', type: 'dec', categorie: 'materiel', libelle: 'Machine', montant: 1200000, recurrence: 'ponctuel', mois: '2027-01', fin: null },
      { id: 'e', type: 'enc', categorie: 'subventions', libelle: 'Aide', montant: 200000, recurrence: 'annuel', mois: '2026-12', fin: null },
    ],
    ajustements: { a: { '2026-12': 300000 } },
    realise: { a: { '2026-10': 450000 }, b: { '2026-10': 120000 } },
  };
}
const soldes = (c) => Object.fromEntries(c.mois.map((x) => [x.mois, x.solde]));

test('saisie des montants en centimes entiers', () => {
  assert.equal(R.versCentimes('12,50'), 1250);
  assert.equal(R.versCentimes('1 234,5 €'), 123450);
  assert.equal(R.versCentimes('1 234,56'), 123456);
  assert.equal(R.versCentimes('0.05'), 5);
  assert.equal(R.versCentimes('7'), 700);
  assert.equal(R.versCentimes('12,345'), null);
  assert.equal(R.versCentimes('-4'), null);
  assert.equal(R.versCentimes('-4', { negatif: true }), -400);
  assert.equal(R.versCentimes('−1 500', { negatif: true }), -150000);
  assert.equal(R.versCentimes('-0', { negatif: true }), 0);
  assert.equal(R.versCentimes('abc'), null);
  assert.equal(R.versCentimes(''), null);
});

test('affichage à la française et CSV', () => {
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(-1000), '−10,00 €');
  assert.equal(R.euros(250, { signe: true }), '+2,50 €');
  assert.equal(R.eurosRonds(123456), '1 235 €');
  assert.equal(R.eurosRonds(-40), '0 €');
  assert.equal(R.eurosRonds(-150000), '−1 500 €');
  assert.equal(R.eurosCsv(123456), '1234,56');
  assert.equal(R.eurosCsv(-1200), '-12,00');
  assert.equal(R.eurosCsv(5), '0,05');
});

test('mois : ajout, écart, libellé', () => {
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ecartMois('2025-11', '2026-02'), 3);
  assert.equal(R.libelleMois('2027-02'), 'février 2027');
  assert.equal(R.libelleMois('2027-02', { court: true }), 'févr. 27');
  assert.equal(R.moisValide('2026-13'), false);
  assert.equal(R.moisValide('2026-09'), true);
});

test('échéances selon la récurrence', () => {
  const [a, b, c, d, e] = plan().lignes;
  assert.equal(R.tombe(a, '2026-09'), false);
  assert.equal(R.tombe(a, '2030-05'), true);
  assert.equal(R.tombe(b, '2027-03'), true);
  assert.equal(R.tombe(b, '2027-04'), false); // après le dernier mois
  assert.equal(R.tombe(c, '2027-02'), true);
  assert.equal(R.tombe(c, '2027-01'), false);
  assert.equal(R.tombe(c, '2027-05'), true);
  assert.equal(R.tombe(d, '2027-01'), true);
  assert.equal(R.tombe(d, '2028-01'), false); // ponctuel : une seule fois
  assert.equal(R.tombe(e, '2027-12'), true);
  assert.equal(R.tombe(e, '2027-06'), false);
});

test('écart de scénario en centimes entiers', () => {
  assert.equal(R.appliquerEcart(500000, -20), 400000);
  assert.equal(R.appliquerEcart(333, 10), 366); // 366,3 arrondi
  assert.equal(R.appliquerEcart(1005, -50), 503); // 502,5 arrondi au supérieur
  assert.equal(R.appliquerEcart(1000, 0), 1000);
});

test('scénario central : soldes de fin de mois, réalisé, ajustement', () => {
  const c = R.calculer(plan(), { scenario: 'central', moisCourant: '2026-11' });
  const s = soldes(c);
  assert.equal(s['2026-10'], 1330000); // 10 000 + 4 500 (réalisé) − 1 200
  assert.equal(s['2026-11'], 1410000); // + 5 000 − 1 200 − 3 000
  assert.equal(s['2026-12'], 1790000); // + 3 000 (ajusté) + 2 000 − 1 200
  assert.equal(s['2027-01'], 970000); // + 5 000 − 1 200 − 12 000
  assert.equal(s['2027-02'], 1050000);
  assert.equal(s['2027-03'], 1430000);
  assert.equal(s['2027-04'], 1930000); // loyer terminé
  assert.equal(s['2027-05'], 2130000);
  assert.equal(c.fenetre, '2026-11');
  assert.equal(c.fin, '2027-10');
  assert.equal(c.vus.length, 12);
  assert.equal(c.mois[0].passe, true);
  assert.equal(c.mois[0].pointees, 2);
  assert.equal(c.mois[0].ecartRealise, -50000);
  assert.equal(c.mois[1].soldeDebut, 1330000);
  assert.deepEqual({ ...c.pointBas }, { mois: '2027-01', solde: 970000 });
  assert.equal(c.premierSousSeuil, '2027-01');
  assert.equal(c.moisSousSeuil, 1);
  assert.equal(c.premierDecouvert, null);
  assert.equal(c.mois.find((x) => x.mois === '2027-01').parCategorie.materiel, 1200000);
});

test('scénarios prudent et optimiste : seuls les encaissements non réalisés varient', () => {
  const p = soldes(R.calculer(plan(), { scenario: 'prudent', moisCourant: '2026-11' }));
  assert.equal(p['2026-10'], 1330000); // réalisé : inchangé
  assert.equal(p['2026-11'], 1310000); // + 4 000 − 4 200
  assert.equal(p['2026-12'], 1590000); // + 2 400 + 1 600 − 1 200
  assert.equal(p['2027-01'], 670000);
  const o = soldes(R.calculer(plan(), { scenario: 'optimiste', moisCourant: '2026-11' }));
  assert.equal(o['2026-11'], 1460000); // + 5 500 − 4 200
  const tous = R.calculerTous(plan(), { moisCourant: '2026-11' });
  assert.deepEqual([...Object.keys(tous)], ['prudent', 'central', 'optimiste']);
});

test('découvert, échéances à pointer et fenêtre glissante', () => {
  const e = plan();
  e.soldeDepart = 0; e.seuil = 0;
  const c = R.calculer(e, { scenario: 'prudent', moisCourant: '2026-12' });
  assert.equal(c.mois.find((x) => x.mois === '2026-11').aPointer, 3);
  assert.equal(c.aPointer, 3);
  assert.equal(c.fenetre, '2026-12');
  assert.equal(c.vus[0].mois, '2026-12');
  assert.equal(c.premierDecouvert, '2027-01'); 
  // Calcul détaillé : oct. +3 300, nov. −200, déc. +2 800, janv. −9 200 → −3 300 €.
  assert.equal(soldes(c)['2027-01'], -330000);
  // Départ dans le futur : la fenêtre commence au départ.
  const f = R.calculer({ ...plan(), debut: '2027-03' }, { moisCourant: '2026-11' });
  assert.equal(f.fenetre, '2027-03');
  assert.equal(f.mois.length, 12);
});

test('échéances du mois pour le pointage', () => {
  const l = R.echeancesDuMois(plan(), '2026-12', 'prudent');
  assert.deepEqual(l.map((x) => x.ligne.id), ['a', 'b', 'e']);
  const a = l.find((x) => x.ligne.id === 'a');
  assert.equal(a.prevu, 300000);
  assert.equal(a.ajuste, true);
  assert.equal(a.retenu, 240000);
  assert.equal(a.realise, null);
  const o = R.echeancesDuMois(plan(), '2026-10');
  assert.equal(o.find((x) => x.ligne.id === 'a').retenu, 450000);
});

test('export CSV : en-têtes, catégories utilisées, virgule décimale', () => {
  const e = plan();
  const c = R.calculer(e, { moisCourant: '2026-11' });
  const cats = [{ id: 'prestations', nom: 'Prestations de services' }, { id: 'subventions', nom: 'Subventions; aides' }, { id: 'loyer', nom: 'Loyer' }, { id: 'tva', nom: 'TVA à reverser' }, { id: 'materiel', nom: 'Matériel' }, { id: 'ventes', nom: 'Ventes' }];
  const t = R.csv(e, c, cats);
  assert.ok(t.startsWith('﻿Poste;2026-11;2026-12;'));
  const lignes = t.trim().split('\r\n');
  assert.equal(lignes.length, 1 + 1 + 2 + 1 + 3 + 1 + 1 + 1 + 1);
  assert.ok(lignes.some((x) => x.startsWith('"Encaissement · Subventions; aides";0,00;2000,00;')));
  assert.ok(!t.includes('Ventes'));
  assert.ok(lignes.find((x) => x.startsWith('Solde de fin')).startsWith('Solde de fin;14100,00;17900,00;9700,00'));
  assert.ok(lignes.at(-1).startsWith('Sous le seuil;non;non;oui'));
});
