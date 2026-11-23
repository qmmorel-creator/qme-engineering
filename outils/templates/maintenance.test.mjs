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

// ---------- Plusieurs sites (fusion du Pilotage de parcs multi-sites, 22/11/2026) ----------
const site = (o = {}) => R.normaliserSite({ id: 's1', nom: 'Résidence des Tilleuls', type: 'RES', ville: 'Ville A', region: 'Bretagne', responsable: 'Resp. A', ...o });
function etatSites({ sites = [site()], eqs = [{}], bons = [], visites = [], ops = [] } = {}) {
  const e = R.etatVide(B.reglages);
  e.multiSites = true;
  e.sites = sites;
  for (const x of eqs) e.equipements.push(R.normaliserEquipement({ id: 'e1', site: 's1', nom: 'Chaudière', famille: 'chaudiere', miseEnService: '2020-01-01', ...x }));
  for (const o of ops) e.operations.push(R.normaliserOperation({ equipement: 'e1', depuis: '2026-01-01', ...o }));
  for (const b of bons) e.interventions.push(R.normaliserIntervention({ id: id(), equipement: 'e1', ...b }));
  for (const v of visites) e.visites.push(R.normaliserVisite({ id: id(), site: 's1', ...v }));
  return R.normaliser(simple(e), B.reglages);
}

test('données d\'avant la fusion : un seul site implicite, aucune perte ; passage à plusieurs sites', () => {
  const avant = etatTest({ ops: [{ id: 'o', nom: 'Vidange', p: [6, 'm'] }], bons: [{ numero: 'BI-2026-0001', dateRealisee: '2026-03-01' }] });
  const e = R.normaliser(simple({ ...avant, sites: undefined, visites: undefined, multiSites: undefined }), B.reglages);
  assert.equal(e.multiSites, false); assert.deepEqual(simple(e.sites), []); assert.deepEqual(simple(e.visites), []);
  assert.equal(e.equipements[0].site, ''); assert.equal(e.reglages.arretJours, 7); assert.equal(e.reglages.visiteMois, 6);
  const m = R.activerMultiSites({ ...e, entreprise: 'Atelier A' });
  assert.equal(m.multiSites, true); assert.equal(m.sites.length, 1); assert.equal(m.sites[0].nom, 'Atelier A');
  assert.equal(m.equipements[0].site, m.sites[0].id);
  assert.equal(m.operations.length, 1); assert.equal(m.interventions.length, 1);
  assert.equal(e.multiSites, false, 'l\'état d\'origine n\'est pas modifié');
  // Un équipement sans site valide, en multi-sites, rejoint le premier site ; coordonnées incomplètes effacées.
  const n = R.normaliser({ multiSites: true, sites: [{ id: 'x', nom: 'X', lat: 45, lon: 'abc' }], equipements: [{ id: 'q', nom: 'Q', site: 'inconnu' }] }, B.reglages);
  assert.equal(n.equipements[0].site, 'x'); assert.equal(n.sites[0].lat, null); assert.equal(n.sites[0].lon, null);
});

test('état calculé : en service, dégradé, à l\'arrêt (plus ancienne panne qui arrête), réformé', () => {
  const e = etatSites({ bons: [{ id: 'c1', type: 'correctif', statut: 'encours', dateSignalee: '2026-11-10' }] });
  const eq = e.equipements[0];
  assert.equal(R.etatEquipement(e, eq).code, 'degrade');
  e.interventions.push(R.normaliserIntervention({ id: 'c2', equipement: 'e1', type: 'correctif', statut: 'planifie', dateSignalee: '2026-11-01', datePrevue: '2026-11-20', arretEq: true }));
  const st = R.etatEquipement(e, eq);
  assert.equal(st.code, 'arret'); assert.equal(st.depuis, '2026-11-01'); assert.equal(st.bon.id, 'c2');
  e.interventions[1].statut = 'fait';
  assert.equal(R.etatEquipement(e, eq).code, 'degrade');
  e.interventions[0].statut = 'annule';
  assert.equal(R.etatEquipement(e, eq).code, 'service');
  assert.equal(R.etatEquipement(e, { ...eq, archive: true }).code, 'reforme');
  // Un ancien bon correctif sans date de signalement prend sa date prévue.
  assert.equal(R.normaliserIntervention({ type: 'correctif', datePrevue: '2026-05-02' }).dateSignalee, '2026-05-02');
  assert.equal(R.normaliserIntervention({ type: 'preventif', datePrevue: '2026-05-02' }).dateSignalee, null);
});

test('disponibilité : heures d\'arrêt des pannes résolues et des pannes ouvertes, bornées à la période', () => {
  const e = etatSites({ bons: [
    { type: 'correctif', statut: 'fait', dateSignalee: '2026-10-01', dateRealisee: '2026-10-11', arret: 240, arretEq: true },
    { type: 'correctif', statut: 'encours', dateSignalee: '2026-11-04', arretEq: true },
    { type: 'correctif', statut: 'encours', dateSignalee: '2026-11-01', arretEq: false },
    { type: 'correctif', statut: 'fait', dateSignalee: '2026-01-01', dateRealisee: '2026-01-05', arret: 96, arretEq: true },
  ] });
  // 240 h (résolue dans la période) + 10 jours ouverts × 24 h ; la panne de janvier est hors période.
  assert.equal(R.heuresArret(e, 'e1', '2026-08-16', AUJ), 480);
  assert.equal(Math.round(R.disponibilite(e, e.equipements[0], AUJ, 90) * 1000), Math.round((1 - 480 / (90 * 24)) * 1000));
  const e2 = { ...e, equipements: [{ ...e.equipements[0], miseEnService: '2026-10-25' }] };
  assert.equal(Math.round(R.disponibilite(e2, e2.equipements[0], AUJ, 90) * 100), 50); // 240 h sur 20 jours
  assert.equal(R.disponibilite(e, { ...e.equipements[0], archive: true }, AUJ, 90), null);
});

test('bilan d\'un site : délai de résolution, pannes ouvertes, coûts par type et par famille (visites comprises)', () => {
  const e = etatSites({
    sites: [site(), site({ id: 's2', nom: 'Entrepôt Nord' })],
    eqs: [{}, { id: 'e2', famille: 'ascenseur', nom: 'Ascenseur' }, { id: 'e3', site: 's2', famille: 'porte', nom: 'Portail' }],
    bons: [
      { type: 'correctif', statut: 'fait', dateSignalee: '2026-10-01', dateRealisee: '2026-10-05', sousTraitance: 40000, mainOeuvre: 0 },
      { equipement: 'e2', type: 'correctif', statut: 'fait', dateSignalee: '2026-11-01', dateRealisee: '2026-11-03', sousTraitance: 10000, mainOeuvre: 0 },
      { equipement: 'e2', type: 'preventif', statut: 'fait', dateRealisee: '2026-09-01', sousTraitance: 20000, mainOeuvre: 0 },
      { equipement: 'e3', type: 'correctif', statut: 'encours', dateSignalee: '2026-11-10', arretEq: true },
    ],
    visites: [{ date: '2026-08-01', cout: 5000 }, { site: 's2', date: '2026-08-01', cout: 999 }],
  });
  const b = R.bilan(e, AUJ, ['s1']);
  assert.equal(b.equipements, 2); assert.equal(b.delaiMoyen, 3); assert.equal(b.resolus, 2); assert.equal(b.correctifsOuverts, 0);
  assert.deepEqual(simple(b.parType), { preventif: 20000, correctif: 50000, visite: 5000 });
  assert.equal(b.cout, 75000);
  assert.deepEqual(simple(b.parFamille), { chaudiere: 40000, ascenseur: 30000 });
  const t = R.bilan(e, AUJ);
  assert.equal(t.equipements, 3); assert.equal(t.arret, 1); assert.equal(t.correctifsOuverts, 1); assert.equal(t.cout, 75999);
});

test('alertes : arrêt depuis N jours, site sans visite depuis N mois ou jamais visité ; état des sites', () => {
  const e = etatSites({
    sites: [site(), site({ id: 's2', nom: 'Entrepôt Nord' }), site({ id: 's3', nom: 'Bureaux', inactif: true }), site({ id: 's4', nom: 'Dépôt' })],
    eqs: [{}, { id: 'e2', site: 's2', nom: 'Porte' }],
    bons: [{ type: 'correctif', statut: 'encours', dateSignalee: '2026-11-01', arretEq: true }, { equipement: 'e2', type: 'correctif', statut: 'encours', dateSignalee: '2026-11-12', arretEq: true }],
    visites: [{ date: '2026-10-01' }, { site: 's2', date: '2026-03-01' }],
    ops: [{ id: 'op', nom: 'Contrôle', p: [1, 'm'], depuis: '2026-10-20' }],
  });
  const al = R.alertes(e, AUJ);
  const de = (t, s) => al.find((a) => a.type === t && a.site === s);
  assert.equal(de('arret', 's1').etat, 'retard'); assert.equal(de('arret', 's1').jours, 13);
  assert.equal(de('arret', 's2').etat, 'proche');
  assert.equal(de('visite', 's2').etat, 'retard'); assert.equal(de('visite', 's4').etat, 'proche');
  assert.ok(!de('visite', 's1') && !al.some((a) => a.site === 's3'), 'visité récemment ; inactif');
  assert.equal(al[0].etat, 'retard');
  const et = R.etatsSites(e, AUJ);
  assert.deepEqual(simple(et), { s1: 'retard', s2: 'retard', s3: 'ok', s4: 'proche' });
  // Un seul site : pas d'alerte de visite.
  assert.ok(!R.alertes({ ...e, multiSites: false }, AUJ).some((a) => a.type === 'visite'));
  // Un bon clôturé compte comme une visite du site.
  e.interventions.push(R.normaliserIntervention({ id: 'z', equipement: 'e2', type: 'preventif', statut: 'fait', dateRealisee: '2026-11-02' }));
  assert.equal(R.derniereVisite(e, 's2', AUJ), '2026-11-02');
});

test('liste des sites : filtres (texte, région, type, état) et tri', () => {
  const l = [
    { site: site({ id: 'a', nom: 'Résidence Élan', region: 'Bretagne', type: 'RES', ville: 'Rennes' }), ind: { equipements: 4, disponibilite: 0.99, retards: 0, cout: 100, delaiMoyen: 2 }, etat: 'ok' },
    { site: site({ id: 'b', nom: 'Entrepôt Nord', region: 'Hauts-de-France', type: 'ENT', ville: 'Lille' }), ind: { equipements: 9, disponibilite: 0.9, retards: 2, cout: 900, delaiMoyen: null }, etat: 'retard' },
    { site: site({ id: 'c', nom: 'Bureaux', region: 'Bretagne', type: 'BUR', ville: 'Brest' }), ind: { equipements: 1, disponibilite: null, retards: 0, cout: 0, delaiMoyen: 5 }, etat: 'proche' },
  ];
  assert.deepEqual(simple(R.filtrerSites(l, { texte: 'elan' }).map((x) => x.site.id)), ['a']);
  assert.deepEqual(simple(R.filtrerSites(l, { region: 'bretagne' }).map((x) => x.site.id)), ['a', 'c']);
  assert.deepEqual(simple(R.filtrerSites(l, { etat: 'alerte' }).map((x) => x.site.id)), ['b', 'c']);
  assert.deepEqual(simple(R.filtrerSites(l, { type: 'ENT' }).map((x) => x.site.id)), ['b']);
  assert.deepEqual(simple(R.trierSites(l, { cle: 'etat', sens: 1 }).map((x) => x.site.id)), ['b', 'c', 'a']);
  assert.deepEqual(simple(R.trierSites(l, { cle: 'cout', sens: -1 }).map((x) => x.site.id)), ['b', 'a', 'c']);
  assert.deepEqual(simple(R.trierSites(l, { cle: 'disponibilite', sens: 1 }).map((x) => x.site.id)), ['b', 'a', 'c']);
  assert.deepEqual(simple(R.trierSites(l, { cle: 'delai', sens: 1 }).map((x) => x.site.id)), ['a', 'c', 'b']);
});

test('carte schématique : projection cadrée, nord en haut ; grille par région pour les autres', () => {
  const s = [site({ id: 'n', lat: 50.6, lon: 3.06 }), site({ id: 's', lat: 43.3, lon: 5.37 }), site({ id: 'x', region: '' })];
  const p = R.projeter(s, 600, 400, 40);
  assert.equal(p.points.length, 2);
  const n = p.points.find((q) => q.id === 'n'), su = p.points.find((q) => q.id === 's');
  assert.ok(n.y < su.y, 'le nord est en haut'); assert.ok(n.x < su.x);
  for (const q of p.points) assert.ok(q.x >= 40 && q.x <= 560 && q.y >= 40 && q.y <= 360);
  assert.equal(R.projeter([site()], 600, 400), null);
  const un = R.projeter([site({ lat: 45, lon: 4 })], 600, 400, 40);
  assert.deepEqual([un.points[0].x, un.points[0].y], [300, 200]);
  assert.deepEqual(simple(R.grilleRegions([site({ id: 'a', nom: 'B', region: '' }), site({ id: 'b', nom: 'A', region: 'Corse' })]).map((g) => g.region)), ['Corse', 'Sans région']);
});

test('CSV des sites et des équipements : export, lecture tolérante, import et aller-retour sans doublon', () => {
  const e = etatSites({ sites: [site({ lat: 48.1, lon: -1.68 })], eqs: [{ repere: 'CHD-01', criticite: 'A' }], ops: [{ id: 'o', nom: 'Préventif périodique', p: [12, 'm'] }] });
  const cs = R.csvSites(e, B, AUJ);
  assert.ok(cs.startsWith('﻿Nom;Type;Adresse;'));
  assert.ok(cs.includes('Résidence des Tilleuls;Résidence, logements;;Ville A;Bretagne;Resp. A;48,1;-1,68;'));
  const ce = R.csvEquipements(e, B, AUJ);
  assert.ok(ce.includes('Résidence des Tilleuls;CHD-01;Chaudière;Chaudière et production de chaleur;;A;'));
  assert.ok(!R.csvEquipements({ ...e, multiSites: false }, B, AUJ).includes('Site;'));
  assert.deepEqual(simple(R.lireCsv('a,b\n"x\ny",2\n\n')), [['a', 'b'], ['x\ny', '2']]);
  assert.deepEqual(simple(R.lireCsv('a\tb\n1\t2')), [['a', 'b'], ['1', '2']]);
  assert.equal(R.dateCsv('05/03/2026'), '2026-03-05'); assert.equal(R.dateCsv('31/02/2026'), undefined); assert.equal(R.dateCsv(''), '');
  // Aller-retour : rien d'ajouté, tout mis à jour.
  const rs = R.importerSites(e, B, cs, id);
  assert.deepEqual([rs.ajouts, rs.majs, rs.erreurs.length], [0, 1, 0]);
  const re = R.importerEquipements(e, B, ce, id, AUJ);
  assert.deepEqual([re.ajouts, re.majs, re.erreurs.length, re.operations.length], [0, 1, 0, 0]);
  // Import : site inconnu, type, criticité et famille de l'ancien outil, périodicité, plan type.
  const r = R.importerSites(e, B, 'Nom;Type;Latitude;Longitude\nEntrepôt Nord;Entrepôt;50,6;3,06\nX;Inconnu;91;3\n;BUR;;', id);
  assert.deepEqual([r.ajouts, r.majs, r.erreurs.length], [2, 0, 3]);
  assert.equal(r.sites.find((x) => x.nom === 'Entrepôt Nord').type, 'ENT');
  assert.equal(r.sites.find((x) => x.nom === 'X').lat, null);
  const e2 = { ...e, sites: r.sites };
  const ri = R.importerEquipements(e2, B, 'Site;Désignation;Catégorie;Criticité;Mise en service;Périodicité préventive (mois)\nEntrepôt Nord;Portail;POR;haute;01/02/2025;6\nEntrepôt Nord;Chaudière;Chauffage, eau chaude;;;\nAilleurs;Z;;;;\nEntrepôt Nord;Truc;Bizarre;Z;32/01/2025;x', id, AUJ);
  assert.deepEqual([ri.ajouts, ri.majs], [3, 0]);
  assert.equal(ri.erreurs.length, 5);
  const portail = ri.equipements.find((x) => x.nom === 'Portail');
  assert.deepEqual([portail.famille, portail.criticite, portail.miseEnService, portail.unite], ['porte', 'A', '2025-02-01', '']);
  assert.deepEqual(simple(ri.operations.find((o) => o.equipement === portail.id).p), [6, 'm']);
  const chd = ri.equipements.find((x) => x.nom === 'Chaudière' && x.site !== 's1');
  assert.ok(ri.operations.filter((o) => o.equipement === chd.id).length >= 2, 'plan type de la famille');
  assert.ok(ri.operations.every((o) => o.c === null));
  // Un seul site : la colonne Site n'est pas exigée.
  assert.equal(R.importerEquipements({ ...R.etatVide(B.reglages) }, B, 'Nom\nPompe', id, AUJ).ajouts, 1);
});

test('copie de l\'ancien Pilotage de parcs multi-sites : convertie en plusieurs sites, sans perte', () => {
  const prk = {
    version: 1, structure: 'Service patrimoine', tutorielVu: true, reglages: { alerteJours: 30, arretJours: 10, visiteMois: 4, periodeJours: 365 },
    sites: [{ id: 's1', nom: 'Résidence', type: 'RES', adresse: '', ville: 'Rennes', region: 'Bretagne', responsable: 'R', lat: 48.1, lon: -1.68, notes: '' }, { id: 's2', nom: 'Entrepôt', type: 'ENT', lat: null, lon: null }],
    equipements: [
      { id: 'e1', siteId: 's1', designation: 'Chaudière collective', categorie: 'CHA', marque: 'M', modele: 'X', miseEnService: '2020-01-01', criticite: 'haute', periodiciteMois: 12, reforme: false, notes: 'n' },
      { id: 'e2', siteId: 's2', designation: 'Porte de quai', categorie: 'POR', miseEnService: '', criticite: 'basse', periodiciteMois: 0, reforme: true, notes: '' },
    ],
    interventions: [
      { id: 'i1', type: 'preventif', siteId: 's1', equipementId: 'e1', date: '2026-05-10', echeance: '2026-05-01', prestataire: 'Chauffagiste', cout: 380, libelle: 'Visite préventive' },
      { id: 'i2', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-09-01', resolu: '2026-09-04', arret: true, prestataire: 'Chauffagiste', cout: '420,5', libelle: 'Brûleur en sécurité' },
      { id: 'i3', type: 'correctif', siteId: 's2', equipementId: 'e2', signale: '2026-11-10', resolu: '', arret: false, cout: '' },
      { id: 'i4', type: 'visite', siteId: 's2', equipementId: '', date: '2026-10-01', prestataire: 'Équipe interne', cout: '', libelle: 'Tournée' },
    ],
  };
  assert.ok(R.estCopieParcs(prk));
  assert.ok(!R.estCopieParcs(etatSites()));
  const e = R.normaliser(R.depuisParcs(simple(prk), B), B.reglages);
  assert.equal(e.multiSites, true); assert.equal(e.entreprise, 'Service patrimoine');
  assert.deepEqual([e.reglages.arretJours, e.reglages.visiteMois], [10, 4]);
  assert.equal(e.sites.length, 2); assert.equal(e.sites[0].lat, 48.1);
  const [c, p] = e.equipements;
  assert.deepEqual([c.nom, c.site, c.famille, c.criticite, c.fabricant, c.modele, c.note], ['Chaudière collective', 's1', 'chaudiere', 'A', 'M', 'X', 'n']);
  assert.deepEqual([p.famille, p.criticite, p.archive], ['porte', 'C', true]);
  assert.equal(e.operations.length, 1);
  assert.deepEqual(simple(e.operations[0].p), [12, 'm']);
  const prev = e.interventions.find((i) => i.id === 'i1');
  assert.deepEqual([prev.type, prev.statut, prev.operation, prev.dateRealisee, prev.echeanceDate, prev.sousTraitance, prev.intervenant], ['preventif', 'fait', e.operations[0].id, '2026-05-10', '2026-05-01', 38000, 'Chauffagiste']);
  assert.equal(R.coutBon(prev, e.reglages).total, 38000);
  const panne = e.interventions.find((i) => i.id === 'i2');
  assert.deepEqual([panne.type, panne.statut, panne.dateSignalee, panne.dateRealisee, panne.arretEq, panne.arret, panne.sousTraitance], ['correctif', 'fait', '2026-09-01', '2026-09-04', true, 72, 42050]);
  assert.equal(e.interventions.find((i) => i.id === 'i3').statut, 'encours');
  assert.equal(R.etatEquipement(e, p).code, 'reforme');
  assert.equal(e.visites.length, 1); assert.equal(e.visites[0].site, 's2');
  assert.ok(e.interventions.every((i) => /^BI-2026-\d{4}$/.test(i.numero)));
  // L'échéance suivante part du dernier préventif réalisé (glissant), comme dans l'ancien outil.
  assert.equal(R.echeance(e, e.operations[0], AUJ).echDate, '2027-05-10');
});
