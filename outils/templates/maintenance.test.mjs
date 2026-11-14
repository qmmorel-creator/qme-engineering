// Tests des règles métier de Maintenance préventive (templates/maintenance/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/maintenance/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.GMA;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
let n = 0;
const id = () => `x${++n}`;

// Équipement avec compteur en heures, suivi depuis le 01/01/2026 à 1 000 h.
function etatTest({ unite = 'h', ops = [], releves = [], bons = [] } = {}) {
  const e = R.etatVide(B.reglages);
  e.equipements.push(R.normaliserEquipement({ id: 'eq', repere: 'CMP-01', nom: 'Compresseur', famille: 'compresseur', unite, compteurInitial: 1000, miseEnService: '2026-01-01' }));
  for (const o of ops) e.operations.push(R.normaliserOperation({ equipement: 'eq', depuis: '2026-01-01', depuisCompteur: 1000, ...o }));
  for (const r of releves) e.releves.push(R.normaliserReleve({ id: id(), equipement: 'eq', date: r[0], valeur: r[1] }));
  for (const b of bons) e.interventions.push(R.normaliserIntervention({ id: id(), equipement: 'eq', statut: 'fait', type: 'preventif', ...b }));
  return R.normaliser(simple(e), B.reglages);
}

test('base intégrée : familles, plans types et obligations sourcées cohérents', () => {
  assert.ok(B.familles.length >= 15);
  const codes = B.familles.flatMap((f) => f.plan.map((o) => o.code));
  assert.equal(new Set(codes).size, codes.length, 'codes d\'opération uniques');
  for (const f of B.familles) {
    for (const o of f.plan) {
      assert.ok(['entretien', 'controle', 'reglementaire'].includes(o.nature), o.code);
      assert.ok(o.p === null || R.periodeValide(o.p), o.code);
      assert.ok(o.points.length >= 1, o.code);
      if (o.c) assert.ok(f.compteur, `${o.code} : intervalle au compteur sur une famille sans compteur`);
      // Aucune périodicité réglementaire non sourcée : un réglementaire avec périodicité porte sa règle.
      if (o.nature === 'reglementaire' && o.p) assert.ok(B.regles[o.regle]?.source, `${o.code} : périodicité réglementaire sans source`);
      if (o.regle) assert.ok(B.regles[o.regle], o.code);
    }
  }
  assert.ok(R.estDate(B.verifieLe));
  for (const r of Object.values(B.regles)) assert.match(r.source, /Code de l'environnement/);
});

test('dates : périodes en jours, semaines, mois, ans ; fin de mois bornée ; libellés', () => {
  assert.equal(R.ajoutPeriode('2026-01-31', [1, 'm']), '2026-02-28');
  assert.equal(R.ajoutPeriode('2028-01-31', [1, 'm']), '2028-02-29');
  assert.equal(R.ajoutPeriode('2026-11-14', [2, 's']), '2026-11-28');
  assert.equal(R.ajoutPeriode('2026-11-14', [10, 'j']), '2026-11-24');
  assert.equal(R.ajoutPeriode('2024-02-29', [1, 'a']), '2025-02-28');
  assert.equal(R.libellePeriode([1, 's']), 'Toutes les semaines');
  assert.equal(R.libellePeriode([24, 'm']), 'Tous les 2 ans');
  assert.equal(R.libellePeriode([6, 'm']), 'Tous les 6 mois');
  assert.equal(R.libellePeriode(null), '');
});

test('saisie tolérante des montants et des nombres', () => {
  assert.equal(R.lireMontant('1 234,5 €'), 123450);
  assert.equal(R.lireMontant(''), null);
  assert.ok(Number.isNaN(R.lireMontant('-3')));
  assert.equal(R.lireNombre('12 450,5'), 12450.5);
  assert.ok(Number.isNaN(R.lireNombre('abc')));
  assert.equal(R.lireNombre('-2', { signe: true }), -2);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(-500, { centimes: false }), '−5 €');
});

test('compteur : valeur actuelle, rythme, relevés incohérents refusés', () => {
  const e = etatTest({ releves: [['2026-10-05', 1800], ['2026-11-02', 2000]] });
  const pts = R.pointsCompteur(e, e.equipements[0]);
  assert.equal(R.compteurActuel(pts, AUJ), 2000);
  assert.equal(R.compteurActuel(pts, '2026-10-10'), 1800);
  assert.ok(Math.abs(R.rythme(pts, AUJ) - 200 / 28) < 1e-9);
  assert.match(R.verifierReleve(pts, '2026-11-10', 1900), /Incohérent : 2 000/);
  assert.match(R.verifierReleve(pts, '2026-10-20', 2100), /seulement 2 000/);
  assert.equal(R.verifierReleve(pts, '2026-11-10', 2050), null);
  assert.equal(R.pointsCompteur(etatTest({ unite: '' }), etatTest({ unite: '' }).equipements[0]).length, 0);
});

test('échéance à la date, au compteur, au premier atteint ; date estimée par le rythme', () => {
  const releves = [['2026-09-01', 1500], ['2026-11-01', 1800]]; // 300 h en 61 jours
  const e = etatTest({ releves, ops: [
    { id: 'date', nom: 'Contrôle', p: [12, 'm'] },
    { id: 'cpt', nom: 'Vidange', c: 1000 },
    { id: 'les2', nom: 'Filtre', p: [6, 'm'], c: 2000 },
    { id: 'rien', nom: 'Vérification', nature: 'reglementaire' },
  ] });
  const ech = (x) => R.echeance(e, e.operations.find((o) => o.id === x), AUJ);
  const d = ech('date');
  assert.equal(d.echDate, '2027-01-01'); assert.equal(d.mode, 'date'); assert.equal(d.etat, 'avenir');
  const c = ech('cpt');
  assert.equal(c.echCompteur, 2000); assert.equal(c.reste, 200); assert.equal(c.mode, 'compteur');
  assert.equal(c.dateEstimee, R.ajout(AUJ, Math.ceil(200 / (300 / 61))));
  assert.equal(c.etat, 'avenir');
  const l = ech('les2');
  assert.equal(l.echDate, '2026-07-01'); assert.equal(l.echCompteur, 3000); assert.equal(l.etat, 'retard'); assert.equal(l.mode, 'premier');
  assert.equal(l.prevue, '2026-07-01');
  assert.equal(R.libelleEcheance(l, 'h'), '3 000 h ou 01/07/2026, le premier atteint');
  assert.equal(ech('rien').etat, 'parametrer');
  assert.equal(R.libelleEcheance(ech('rien')), 'Périodicité à saisir');
});

test('états : retard au compteur, bientôt (jours, % de l\'intervalle, date estimée), suspendu', () => {
  const e = etatTest({ releves: [['2026-11-01', 1950]], ops: [
    { id: 'a', nom: 'A', c: 900 },                 // échéance 1 900 h : dépassée
    { id: 'b', nom: 'B', c: 1000 },                // reste 50 h ≤ 10 % de 1 000
    { id: 'c', nom: 'C', p: [1, 'a'], depuis: '2025-11-20' }, // dans 6 jours
    { id: 'd', nom: 'D', p: [1, 'a'], actif: false },
  ] });
  const st = (x) => R.echeance(e, e.operations.find((o) => o.id === x), AUJ).etat;
  assert.equal(st('a'), 'retard');
  assert.equal(st('b'), 'bientot');
  assert.equal(st('c'), 'bientot');
  assert.equal(st('d'), 'suspendu');
  // Opération hebdomadaire faite hier : pas « bientôt » en permanence (alerte bornée au quart de la période).
  e.operations.push(R.normaliserOperation({ id: 'h', equipement: 'eq', nom: 'H', p: [1, 's'], depuis: '2026-11-13' }));
  assert.equal(st('h'), 'avenir');
  e.operations.find((o) => o.id === 'h').depuis = '2026-11-08';
  assert.equal(st('h'), 'bientot');
  e.equipements[0].archive = true;
  assert.equal(st('c'), 'suspendu');
});

test('la réalisation recale l\'échéance : glissant depuis la réalisation, fixe depuis l\'échéance visée', () => {
  const bons = [{ operation: 'g', dateRealisee: '2026-03-20', echeanceDate: '2026-03-01', compteur: 1400 }, { operation: 'f', dateRealisee: '2026-03-20', echeanceDate: '2026-03-01' }];
  const e = etatTest({ bons, ops: [{ id: 'g', nom: 'G', p: [3, 'm'], c: 500 }, { id: 'f', nom: 'F', p: [3, 'm'], recalage: 'fixe' }] });
  const g = R.echeance(e, e.operations[0], AUJ);
  assert.equal(g.refDate, '2026-03-20'); assert.equal(g.echDate, '2026-06-20'); assert.equal(g.echCompteur, 1900);
  const f = R.echeance(e, e.operations[1], AUJ);
  assert.equal(f.echDate, '2026-06-01');
  assert.equal(R.derniereRealisation(e, 'g').dateRealisee, '2026-03-20');
});

test('bon ouvert : état « bon », l\'urgence reste connue ; préparation reprend points et pièces', () => {
  const e = etatTest({ ops: [{ id: 'o', nom: 'Vidange', p: [6, 'm'], points: ['Vidanger', 'Filtre'], pieces: [{ piece: 'p1', quantite: 2 }] }] });
  e.pieces.push(R.normaliserPiece({ id: 'p1', nom: 'Huile', prix: 1250 }));
  const b = R.preparerBon(e, e.operations[0], AUJ, { id: 'b1' });
  assert.equal(b.numero, 'BI-2026-0001');
  assert.equal(b.datePrevue, AUJ); // échéance passée : prévu aujourd'hui
  assert.equal(b.echeanceDate, '2026-07-01');
  assert.deepEqual(simple(b.points), [{ texte: 'Vidanger', fait: false }, { texte: 'Filtre', fait: false }]);
  assert.deepEqual(simple(b.pieces), [{ piece: 'p1', quantite: 2, prix: 1250 }]);
  e.interventions.push(b);
  const x = R.echeance(e, e.operations[0], AUJ);
  assert.equal(x.etat, 'bon'); assert.equal(x.urgence, 'retard'); assert.equal(x.bon.id, 'b1');
  assert.equal(R.numeroBon(e, '2026-12-01'), 'BI-2026-0002');
  assert.equal(R.numeroBon(e, '2027-01-02'), 'BI-2027-0001');
});

test('clôture : contrôles, compteur cohérent, puis stock de pièces et coût', () => {
  const e = etatTest({ releves: [['2026-11-01', 2000]], ops: [{ id: 'o', nom: 'Vidange', c: 500, pieces: [{ piece: 'p1', quantite: 2 }] }] });
  e.pieces.push(R.normaliserPiece({ id: 'p1', nom: 'Huile', prix: 1250, seuil: 2 }));
  e.mouvementsPieces.push(R.normaliserMouvement({ id: 'm1', piece: 'p1', date: '2026-01-10', quantite: 5 }));
  e.reglages.tauxHoraire = 4000;
  const b = R.preparerBon(e, e.operations[0], AUJ, { id: 'b1' });
  assert.match(R.cloturer(e, b, { dateRealisee: '2026-12-01', auj: AUJ }), /futur/);
  assert.match(R.cloturer(e, b, { dateRealisee: AUJ, compteur: 1900, auj: AUJ }), /^Compteur incohérent/);
  assert.equal(R.cloturer(e, b, { dateRealisee: AUJ, compteur: 2010, duree: 1.5, auj: AUJ }), null);
  b.sousTraitance = 3000;
  e.interventions.push(b);
  assert.deepEqual(simple(R.coutBon(b, e.reglages)), { mainOeuvre: 6000, pieces: 2500, sousTraitance: 3000, total: 11500 });
  b.mainOeuvre = 0;
  assert.equal(R.coutBon(b, e.reglages).total, 5500);
  assert.equal(R.stockPiece(e, 'p1'), 3);
  assert.equal(R.situationPiece(e, e.pieces[0], AUJ).statut, 'ok');
  e.mouvementsPieces.push(R.normaliserMouvement({ id: 'm2', piece: 'p1', date: AUJ, type: 'ajustement', quantite: -1 }));
  assert.equal(R.situationPiece(e, e.pieces[0], AUJ).statut, 'seuil');
  assert.deepEqual(simple(R.situationPiece(e, e.pieces[0], AUJ).equipements), ['eq']);
  // L'échéance repart du compteur de clôture.
  assert.equal(R.echeance(e, e.operations[0], AUJ).echCompteur, 2510);
  assert.equal(R.compteurActuel(R.pointsCompteur(e, e.equipements[0]), AUJ), 2010);
});

test('coûts par équipement sur 12 mois : préventif, correctif, pannes et arrêt', () => {
  const e = etatTest({ bons: [
    { operation: null, type: 'preventif', dateRealisee: '2026-05-01', sousTraitance: 10000 },
    { type: 'correctif', dateRealisee: '2026-06-01', mainOeuvre: 5000, arret: 4 },
    { type: 'correctif', dateRealisee: '2025-06-01', mainOeuvre: 7000, arret: 2 },
    { type: 'correctif', statut: 'encours', datePrevue: '2026-11-10', mainOeuvre: 9999 },
  ] });
  const c = R.coutsEquipement(e, 'eq', R.ajout(AUJ, -365), AUJ);
  assert.equal(c.preventif, 10000); assert.equal(c.correctif, 5000); assert.equal(c.total, 15000);
  assert.equal(c.pannes, 1); assert.equal(c.arret, 4);
  assert.equal(R.coutsEquipement(e, 'eq', null, AUJ).total, 22000);
  assert.equal(R.coutsParEquipement(e, AUJ)[0].total, 15000);
});

test('indicateurs : taux de réalisation, ponctualité, retards sans bon', () => {
  const e = etatTest({
    ops: [{ id: 'retard', nom: 'Oubliée', p: [1, 'm'], depuis: '2026-08-01' }],
    bons: [
      { type: 'preventif', dateRealisee: '2026-10-01', datePrevue: '2026-10-01', echeanceDate: '2026-10-01' },
      { type: 'preventif', dateRealisee: '2026-10-25', datePrevue: '2026-10-05', echeanceDate: '2026-10-05' }, // 20 jours de retard
      { type: 'preventif', statut: 'planifie', datePrevue: '2026-11-01' }, // dû, non fait
      { type: 'preventif', statut: 'annule', datePrevue: '2026-11-02' },
      { type: 'correctif', dateRealisee: '2026-11-03', arret: 2.5, mainOeuvre: 1000 },
    ],
  });
  const i = R.indicateurs(e, AUJ, 90);
  assert.equal(i.faits, 2); assert.equal(i.dusNonFaits, 1); assert.equal(i.sansBon, 1);
  assert.equal(i.taux, 50);
  assert.equal(i.ponctualite, 50);
  assert.equal(i.retardMoyen, 20);
  assert.equal(i.pannes, 1); assert.equal(i.arret, 2.5);
  assert.equal(i.partPreventif, 0);
  assert.equal(i.retards, 1);
});

test('plan type depuis une famille : copie modifiable, compteur ignoré sans unité, réglementaire fixe', () => {
  let k = 0;
  const ops = R.planDepuisFamille(B, 'compresseur', { equipement: 'eq', depuis: '2026-01-01', depuisCompteur: 100, id: () => `o${++k}` });
  assert.equal(ops.length, B.familles.find((f) => f.id === 'compresseur').plan.length);
  const vid = ops.find((o) => o.code === 'cmp-vidange');
  assert.deepEqual(simple(vid.p), [12, 'm']); assert.equal(vid.c, 4000); assert.equal(vid.depuisCompteur, 100);
  const reg = ops.find((o) => o.code === 'cmp-reservoir');
  assert.equal(reg.p, null); assert.equal(reg.recalage, 'fixe');
  const choisies = R.planDepuisFamille(B, 'chaudiere', { equipement: 'eq', depuis: '2026-01-01', codes: ['chd-annuel'] });
  assert.equal(choisies.length, 1); assert.equal(choisies[0].regle, 'chaudiere');
  assert.equal(R.planDepuisFamille(B, 'inconnue', {}).length, 0);
});

test('normalisation tolérante et suppression d\'un équipement avec ses données', () => {
  const e = R.normaliser({ equipements: [{ id: 'a', nom: '', criticite: 'Z', unite: 'litres' }], operations: [{ id: 'o', equipement: 'a', p: [0, 'm'], c: -5 }], interventions: [{ id: 'i', equipement: 'a', statut: 'bizarre' }], reglages: { alerteJours: 9999, prefixeBon: 'b-i' } }, B.reglages);
  assert.equal(e.equipements[0].nom, 'Équipement'); assert.equal(e.equipements[0].criticite, 'B'); assert.equal(e.equipements[0].unite, '');
  assert.equal(e.operations[0].p, null); assert.equal(e.operations[0].c, null);
  assert.equal(e.interventions[0].statut, 'planifie');
  assert.equal(e.reglages.alerteJours, B.reglages.alerteJours); assert.equal(e.reglages.prefixeBon, 'BI');
  const s = R.supprimerEquipement(e, 'a');
  assert.equal(s.operations.length + s.interventions.length + s.equipements.length, 0);
  assert.deepEqual(simple(R.normaliser(null, B.reglages).equipements), []);
});

test('exports CSV : point-virgule, BOM, formules neutralisées', () => {
  const e = etatTest({ ops: [{ id: 'o', nom: '=SOMME(A1)', p: [1, 'a'] }], bons: [{ numero: 'BI-2026-0001', titre: 'Vidange; huile', dateRealisee: '2026-02-01', sousTraitance: 12345 }] });
  const a = R.csvEcheancier(e, AUJ);
  assert.ok(a.startsWith('﻿Repère;'));
  assert.ok(a.includes(";'=SOMME(A1);"));
  const b = R.csvInterventions(e);
  assert.ok(b.includes('"Vidange; huile"'));
  assert.ok(b.includes(';123,45;'));
  assert.ok(R.csvCouts(e, AUJ).includes('CMP-01;Compresseur;compresseur;B;'));
});
