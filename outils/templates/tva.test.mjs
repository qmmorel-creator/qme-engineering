// Tests des règles métier du suivi de TVA (templates/tva/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/tva/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.TVA;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

const op = (date, type, ht, taux = 20, x = {}) => ({ id: `${date}-${type}-${ht}`, date, type, libelle: `${type} ${ht}`, ...R.calculer('ht', ht, taux), taux, creeLe: date, ...x });
function etat(reglages = {}, operations = [], suivi = {}) {
  return R.normaliser({ reglages: { debut: '2026-01-01', regime: 'mensuel', ...reglages }, operations, suivi }, B);
}
const types = (l) => simple(l.map((c) => c.type).sort());

test('base : taux par défaut, sources datées, régimes et types', () => {
  assert.deepEqual(simple(B.reglages.taux.map((t) => t.taux)), [20, 10, 5.5, 2.1, 0]);
  assert.equal(B.verifieLe, '2026-11-17');
  assert.ok(B.sources.length >= 5 && B.sources.every((s) => s.sujet && s.texte && s.statut));
  assert.ok(B.sources.some((s) => s.statut === 'à vérifier'));
  assert.deepEqual(simple(B.regimes.map((r) => r.id)), ['mensuel', 'trimestriel', 'simplifie']);
  assert.deepEqual(simple(B.types.map((t) => t.id)), simple(R.TYPES));
  // Aucune marque ni lien vers un espace professionnel dans la base.
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8');
  assert.doesNotMatch(texte, /https?:\/\//);
});

test('calcul HT → TTC et TTC → HT au centime', () => {
  assert.deepEqual(simple(R.calculer('ht', 100, 20)), { ht: 100, tva: 20, ttc: 120 });
  assert.deepEqual(simple(R.calculer('ttc', 120, 20)), { ht: 100, tva: 20, ttc: 120 });
  assert.deepEqual(simple(R.calculer('ttc', 10, 5.5)), { ht: 9.48, tva: 0.52, ttc: 10 });
  assert.deepEqual(simple(R.calculer('ht', 12.345, 5.5)), { ht: 12.35, tva: 0.68, ttc: 13.03 });
  assert.deepEqual(simple(R.calculer('ht', 0.1, 20)), { ht: 0.1, tva: 0.02, ttc: 0.12 });
  assert.deepEqual(simple(R.calculer('ht', 1000, 2.1)), { ht: 1000, tva: 21, ttc: 1021 });
  assert.deepEqual(simple(R.calculer('ht', 33.33, 10)), { ht: 33.33, tva: 3.33, ttc: 36.66 });
  // Demi-centime arrondi vers l'extérieur, aussi pour les avoirs (montants négatifs).
  assert.equal(R.calculer('ht', 0.25, 10).tva, 0.03);
  assert.equal(R.calculer('ht', -0.25, 10).tva, -0.03);
  // Exonéré : pas de TVA.
  assert.deepEqual(simple(R.calculer('ttc', 310, 0)), { ht: 310, tva: 0, ttc: 310 });
  // Aucune erreur flottante sur des sommes de centimes.
  assert.equal(R.arrondi(0.1 + 0.2), 0.3);
});

test('écarts de saisie : TVA ≠ HT × taux et HT + TVA ≠ TTC', () => {
  const ok = R.ecartsOperation({ ht: 2062.5, taux: 20, tva: 412.5, ttc: 2475 }, 0.01);
  assert.equal(ok.tvaKo, false); assert.equal(ok.ttcKo, false);
  const tva = R.ecartsOperation({ ht: 2062.5, taux: 20, tva: 415, ttc: 2477.5 }, 0.01);
  assert.equal(tva.tvaKo, true); assert.equal(tva.ecartTva, 2.5); assert.equal(tva.ttcKo, false);
  const ttc = R.ecartsOperation({ ht: 100, taux: 20, tva: 20, ttc: 121 }, 0.01);
  assert.equal(ttc.ttcKo, true); assert.equal(ttc.ecartTtc, -1);
  // Tolérance d'un centime (facture arrondie ligne à ligne).
  assert.equal(R.ecartsOperation({ ht: 100, taux: 20, tva: 20.01, ttc: 120.01 }, 0.01).tvaKo, false);
  assert.equal(R.ecartsOperation({ ht: 100, taux: 20, tva: 20.02, ttc: 120.02 }, 0.01).tvaKo, true);
});

test('périodes : mois, trimestres, exercices (clôture en décembre ou décalée)', () => {
  const m = R.periodeDe({ regime: 'mensuel' }, '2026-02-17');
  assert.deepEqual(simple({ cle: m.cle, debut: m.debut, fin: m.fin, libelle: m.libelle }), { cle: 'M-2026-02', debut: '2026-02-01', fin: '2026-02-28', libelle: 'février 2026' });
  const t = R.periodeDe({ regime: 'trimestriel' }, '2026-08-03');
  assert.deepEqual(simple([t.cle, t.debut, t.fin, t.libelle]), ['T-2026-3', '2026-07-01', '2026-09-30', '3e trimestre 2026']);
  assert.equal(R.periodeDe({ regime: 'trimestriel' }, '2026-01-01').libelle, '1er trimestre 2026');
  const e = R.periodeDe({ regime: 'simplifie', clotureMois: 12 }, '2026-05-02');
  assert.deepEqual(simple([e.cle, e.debut, e.fin, e.libelle]), ['E-2026-01', '2026-01-01', '2026-12-31', 'Exercice 2026']);
  const d = R.periodeDe({ regime: 'simplifie', clotureMois: 3 }, '2026-02-10');
  assert.deepEqual(simple([d.debut, d.fin]), ['2025-04-01', '2026-03-31']);
  // Liste continue du début du suivi jusqu'à aujourd'hui (ou la dernière opération).
  const l = R.periodes(etat({}, [op('2026-05-10', 'vente', 10)]), '2026-03-15');
  assert.deepEqual(simple(l.map((p) => p.cle)), ['M-2026-01', 'M-2026-02', 'M-2026-03', 'M-2026-04', 'M-2026-05']);
});

test('échéances : jour paramétrable, report au jour ouvrable, acomptes et CA12', () => {
  const r = R.normaliserReglages({ regime: 'mensuel', jourEcheance: 15 }, B);
  // Février 2026 → 15 mars 2026 (dimanche) → lundi 16 mars.
  assert.equal(R.echeancesPeriode(r, R.periodeDe(r, '2026-02-10')).declaration, '2026-03-16');
  // Avril 2026 → 15 mai (vendredi).
  assert.equal(R.echeancesPeriode(r, R.periodeDe(r, '2026-04-10')).declaration, '2026-05-15');
  // Jour 31 ramené au dernier jour du mois (février), puis reporté : 28/02/2027 est un dimanche.
  const r31 = R.normaliserReglages({ regime: 'mensuel', jourEcheance: 31 }, B);
  assert.equal(R.echeancesPeriode(r31, R.periodeDe(r31, '2027-01-10')).declaration, '2027-03-01');
  // Jour férié : 11 novembre 2026 (mercredi) → 12 novembre.
  assert.equal(R.reporter('2026-11-11'), '2026-11-12');
  assert.equal(R.reporter('2026-12-25'), '2026-12-28');
  // Réel simplifié, exercice civil : acomptes en juillet et décembre, CA12 au 2e jour ouvré après le 1er mai.
  const s = R.normaliserReglages({ regime: 'simplifie' }, B);
  const e = R.echeancesPeriode(s, R.periodeDe(s, '2026-03-01'));
  assert.deepEqual(simple(e), { acompte1: '2026-07-15', acompte2: '2026-12-15', declaration: '2027-05-04' });
  assert.equal(R.deuxiemeJourOuvreMai(2026), '2026-05-05');
  assert.equal(R.deuxiemeJourOuvreMai(2027), '2027-05-04');
  // Jour fixe saisi à la place du calcul.
  const sf = R.normaliserReglages({ regime: 'simplifie', ca12Jour: 5, ca12Mois: 5 }, B);
  assert.equal(R.echeancesPeriode(sf, R.periodeDe(sf, '2026-03-01')).declaration, '2027-05-05');
  // Exercice clos le 31 mars : acomptes en juillet et en décembre de l'exercice (impots.gouv.fr, page « TVA »),
  // pas au 7e et au 12e mois ; CA12 dans les 3 mois de la clôture.
  const sm = R.normaliserReglages({ regime: 'simplifie', clotureMois: 3 }, B);
  const em = R.echeancesPeriode(sm, R.periodeDe(sm, '2026-02-01'));
  assert.deepEqual(simple(em), { acompte1: '2025-07-15', acompte2: '2025-12-15', declaration: '2026-06-30' });
  // Exercice clos le 30 septembre 2027 (décalé, compris dans la réforme) : seul le juillet 2027 tombe dans l'exercice
  // après le 31/12/2026, aucun décembre 2027.
  const ss = R.normaliserReglages({ regime: 'simplifie', clotureMois: 9 }, B);
  const es = R.echeancesPeriode(ss, R.periodeDe(ss, '2027-03-01'));
  assert.deepEqual(simple(es), { acompte1: '2027-07-15', acompte2: '2026-12-15', declaration: '2027-12-31' });
});

test('bilans : collectée, déductible (biens et services, immobilisations), crédit reporté et remboursement', () => {
  const e = etat({ creditInitial: 50 }, [
    op('2026-01-10', 'vente', 1000), op('2026-01-12', 'achat', 200), op('2026-01-20', 'frais', 100, 0),
    op('2026-02-05', 'immo', 5000), op('2026-02-06', 'vente', 1000, 10),
    op('2026-03-10', 'vente', 10000), op('2026-03-11', 'frais', 50, 5.5),
  ]);
  const b = R.bilans(e, '2026-03-31');
  assert.deepEqual(simple(b.map((x) => [x.collectee, x.deductibleBS, x.deductibleImmo, x.creditAnterieur, x.aPayer, x.creditReporte])), [
    [200, 40, 0, 50, 110, 0],
    [100, 0, 1000, 0, 0, 900],
    [2000, 2.75, 0, 900, 1097.25, 0],
  ]);
  assert.deepEqual(simple(b[0].parTaux.map((x) => [x.sens, x.taux, x.ht, x.tva, x.nombre])), [['collectee', 20, 1000, 200, 1], ['deductible', 20, 200, 40, 1], ['deductible', 0, 100, 0, 1]]);
  // Remboursement demandé sur le crédit de février : moins de crédit reporté en mars.
  const e2 = etat({ creditInitial: 50 }, e.operations, { 'M-2026-02': { remboursement: 600 } });
  const b2 = R.bilans(e2, '2026-03-31');
  assert.equal(b2[1].rembourse, 600); assert.equal(b2[1].creditReporte, 300); assert.equal(b2[2].aPayer, 1697.25);
  // Remboursement plafonné au crédit.
  const e3 = etat({}, e.operations, { 'M-2026-02': { remboursement: 99999 } });
  assert.equal(R.bilans(e3, '2026-03-31')[1].rembourse, 900);
});

test('réel simplifié : acomptes calculés sur l\'exercice précédent, dispense, solde de la CA12', () => {
  const ops = [op('2025-03-01', 'vente', 50000), op('2025-04-01', 'achat', 10000), op('2025-06-01', 'immo', 20000), op('2026-05-01', 'vente', 30000), op('2026-06-01', 'achat', 5000)];
  const e = etat({ regime: 'simplifie', debut: '2025-01-01' }, ops);
  const [b25, b26] = R.bilans(e, '2026-11-14');
  // 2025 : pas de référence → pas d'acompte ; collectée 10 000, déductible 2 000 + 4 000 → solde 4 000.
  assert.equal(b25.baseAcomptes, null);
  assert.equal(b25.aPayer, 4000);
  // 2026 : référence = 10 000 − 2 000 (avant TVA sur immobilisations) = 8 000 → 4 400 et 3 200.
  assert.equal(b26.baseAcomptes, 8000);
  assert.deepEqual(simple(b26.acomptes.map((a) => [a.numero, a.calcule, a.date])), [[1, 4400, '2026-07-15'], [2, 3200, '2026-12-15']]);
  // Collectée 6 000 − déductible 1 000 − acomptes 7 600 → crédit de 2 600.
  assert.equal(b26.totalAcomptes, 7600); assert.equal(b26.creditFin, 2600); assert.equal(b26.aPayer, 0);
  // Acompte réellement versé différent (saisi) et TVA de référence saisie à la main.
  const e2 = etat({ regime: 'simplifie', debut: '2025-01-01' }, ops, { 'E-2026-01-A1': { montant: 4000 }, 'E-2025-01': { base: 2000 } });
  const [c25, c26] = R.bilans(e2, '2026-11-14');
  assert.deepEqual(simple(c25.acomptes.map((a) => a.calcule)), [1100, 800]);
  assert.equal(c26.acomptes[0].verse, 4000); assert.equal(c26.totalAcomptes, 7200);
  // Dispense sous 1 000 € de TVA de référence.
  const e3 = etat({ regime: 'simplifie', debut: '2025-01-01' }, [op('2025-03-01', 'vente', 4000), op('2026-03-01', 'vente', 100)]);
  const d26 = R.bilans(e3, '2026-11-14')[1];
  assert.equal(d26.baseAcomptes, 800); assert.equal(d26.dispense, true); assert.equal(d26.totalAcomptes, 0);
});

test('échéancier : statuts fait, en cours, en retard, bientôt, à venir', () => {
  const ops = [op('2026-01-10', 'vente', 1000), op('2026-02-10', 'vente', 1000), op('2026-03-10', 'immo', 5000), op('2026-04-10', 'vente', 500)];
  const e = etat({}, ops, { 'M-2026-01': { declare: '2026-02-10', paye: '2026-02-10' }, 'M-2026-02': { declare: '2026-03-10' } });
  const l = R.echeancier(e, '2026-05-08');
  assert.deepEqual(simple(l.map((x) => [x.cle, x.statut])), [['M-2026-01', 'fait'], ['M-2026-02', 'retard'], ['M-2026-03', 'retard'], ['M-2026-04', 'proche'], ['M-2026-05', 'encours']]);
  // Une période en crédit est faite dès qu'elle est déclarée.
  const e2 = etat({}, ops, { 'M-2026-03': { declare: '2026-04-10' } });
  assert.equal(R.echeancier(e2, '2026-05-08').find((x) => x.cle === 'M-2026-03').statut, 'fait');
  // Montant déclaré à 0 : rien à payer.
  const e3 = etat({}, ops, { 'M-2026-02': { declare: '2026-03-10', montant: 0 } });
  assert.equal(R.echeancier(e3, '2026-05-08').find((x) => x.cle === 'M-2026-02').statut, 'fait');
  assert.equal(R.echeancier(etat({}, ops), '2026-04-01').find((x) => x.cle === 'M-2026-03').statut, 'avenir');
});

test('contrôles : calcul, total, taux inhabituel, hors suivi, futur, saisie tardive', () => {
  const e = etat({}, [
    op('2026-01-10', 'vente', 1000),
    { ...op('2026-01-11', 'achat', 2062.5), tva: 415, ttc: 2477.5, id: 'a1' },
    { ...op('2026-01-12', 'achat', 100), ttc: 121, id: 'a2' },
    { ...op('2026-01-13', 'vente', 180, 8), id: 'v8' },
    { ...op('2025-12-20', 'achat', 100), id: 'avant' },
    { ...op('2026-04-20', 'achat', 100), id: 'futur' },
    { ...op('2026-01-25', 'achat', 386), id: 'tard', creeLe: '2026-02-20' },
  ], { 'M-2026-01': { declare: '2026-02-12', paye: '2026-02-12' } });
  const c = R.controles(e, '2026-03-20');
  const de = (id) => types(c.filter((x) => x.op === id));
  assert.deepEqual(de('a1'), ['calcul']);
  assert.deepEqual(de('a2'), ['total']);
  assert.deepEqual(de('v8'), ['taux']);
  assert.deepEqual(de('futur'), ['future']);
  assert.deepEqual(de('tard'), ['tardive']);
  // Le suivi commence au 1er janvier : l'opération de décembre 2025 n'est dans aucune période.
  assert.deepEqual(de('avant'), ['horsSuivi']);
  // Février non déclaré, échéance passée.
  assert.ok(c.some((x) => x.type === 'nonDeclaree' && x.periode === 'M-2026-02'));
  // Tri : rouges d'abord.
  assert.equal(c[0].gravite, 'rouge');
});

test('contrôles : non payée, crédit oublié, écart déclaré, crédit durable, déductible supérieure', () => {
  const ops = [
    op('2026-01-10', 'immo', 10000), op('2026-02-10', 'immo', 8000), op('2026-03-10', 'immo', 6000),
    op('2026-04-10', 'vente', 20000), op('2026-05-10', 'vente', 10000),
  ];
  const e = etat({}, ops, {
    'M-2026-01': { declare: '2026-02-13' }, 'M-2026-02': { declare: '2026-03-13' }, 'M-2026-03': { declare: '2026-04-13' },
    // Avril : 4 000 collectés − 4 800 de crédit → rien à payer ; déclaré 4 000 → crédit oublié.
    'M-2026-04': { declare: '2026-05-13', montant: 4000, paye: '2026-05-13' },
    // Mai : 2 000 − 800 de crédit = 1 200 à payer ; déclarée 1 150, non payée.
    'M-2026-05': { declare: '2026-06-12', montant: 1150 },
  });
  const c = R.controles(e, '2026-07-01');
  const t = types(c);
  assert.ok(t.includes('creditOublie'));
  assert.ok(t.includes('nonPayee'));
  assert.ok(t.includes('ecartDeclare'));
  assert.equal(c.filter((x) => x.type === 'deductible').length, 1);
  assert.equal(c.filter((x) => x.type === 'creditDurable').length, 1);
  // Seuils paramétrables : déductible sur 3 périodes (seuil 4), crédit sur 4 périodes (seuil 5) → plus d'alerte.
  const e2 = etat({ periodesDeductible: 4, periodesCredit: 5 }, ops, e.suivi);
  assert.ok(!types(R.controles(e2, '2026-07-01')).includes('deductible'));
  assert.ok(!types(R.controles(e2, '2026-07-01')).includes('creditDurable'));
});

test('contrôles : seuil du trimestriel, fin annoncée du simplifié, acompte non versé, référence manquante', () => {
  const tri = etat({ regime: 'trimestriel' }, [op('2026-01-10', 'vente', 10000), op('2026-04-10', 'vente', 10000)]);
  assert.ok(types(R.controles(tri, '2026-08-01')).includes('seuil'));
  assert.ok(!types(R.controles(etat({ regime: 'trimestriel', seuilTrimestriel: 10000 }, tri.operations), '2026-08-01')).includes('seuil'));
  const s = etat({ regime: 'simplifie', debut: '2026-01-01' }, [op('2026-03-01', 'vente', 1000)], { 'E-2026-01': { base: 5000 } });
  const c = R.controles(s, '2027-02-01');
  assert.ok(types(c).includes('reforme'));
  assert.equal(c.filter((x) => x.type === 'acompte').length, 2);
  assert.ok(types(R.controles(etat({ regime: 'simplifie' }, [op('2026-03-01', 'vente', 1000)]), '2026-06-01')).includes('acompteBase'));
  // Date de fin modifiable.
  assert.ok(!types(R.controles(etat({ regime: 'simplifie', finSimplifie: '2028-01-01' }, s.operations, s.suivi), '2027-02-01')).includes('reforme'));
});

test('CSV : export (formules neutralisées, virgule décimale) et import tolérant', () => {
  const e = etat({}, [op('2026-01-10', 'vente', 1234.5, 20, { libelle: '=SOMME(A1)', piece: 'F-1' }), op('2026-01-12', 'immo', 100, 5.5)]);
  const csv = R.csvOperations(e, '2026-02-01');
  assert.ok(csv.startsWith('﻿Date;Type;Libellé'));
  assert.match(csv, /2026-01-10;Vente;'=SOMME\(A1\);F-1;1234,5;20;246,9;1481,4;janvier 2026;/);
  assert.match(R.csvPeriodes(e, '2026-02-01'), /janvier 2026;2026-01-01;2026-01-31;2026-02-16;246,9;0;5,5/);
  assert.match(R.csvEcheancier(e, '2026-02-01'), /2026-02-16;CA3 · janvier 2026;241,4;/);
  // Réimport de l'export : mêmes opérations.
  const r = R.importerCsv(csv, '2026-02-01');
  assert.equal(r.erreurs.length, 0);
  assert.deepEqual(simple(r.operations.map((o) => [o.date, o.type, o.ht, o.taux, o.tva, o.ttc])), [['2026-01-10', 'vente', 1234.5, 20, 246.9, 1481.4], ['2026-01-12', 'immo', 100, 5.5, 5.5, 105.5]]);
  // Fichier d'un tableur : virgule comme séparateur, dates françaises, TTC seul, montants avec espaces et €.
  const r2 = R.importerCsv('date,type,designation,ttc,taux\n03/11/2026,Achat,"Papier, encre","1 200,00 €",20\n04/11/2026,Inconnu,x,10,20\n31/02/2026,Vente,y,10,20\n', '2026-11-14');
  assert.equal(r2.operations.length, 1);
  assert.deepEqual(simple([r2.operations[0].date, r2.operations[0].libelle, r2.operations[0].ht, r2.operations[0].tva]), ['2026-11-03', 'Papier, encre', 1000, 200]);
  assert.deepEqual(simple(r2.erreurs.map((x) => x.ligne)), [3, 4]);
  // Colonnes manquantes.
  assert.equal(R.importerCsv('libelle;montant\nx;1\n', '2026-11-14').operations.length, 0);
  assert.equal(R.lireNombre('1.234,56'), 1234.56);
  assert.equal(R.lireNombre('1,234.56'), 1234.56);
  assert.equal(R.lireNombre(''), null);
});

test('normalisation : valeurs absurdes, anciennes données, suivi filtré', () => {
  const e = R.normaliser({ reglages: { regime: 'inconnu', jourEcheance: 99, taux: [{ taux: '5,5' }, { taux: 5.5 }, { taux: -3 }], tolerance: 'x' }, operations: [{ date: 'hier' }, { date: '2026-01-01', type: 'cadeau', ht: '12,345', taux: 300 }], suivi: { 'M-2026-01': { declare: '2026-02-01', montant: 'x' }, autre: {}, 'M-2026-02': { remboursement: -5 } } }, B);
  assert.equal(e.reglages.regime, 'mensuel');
  assert.equal(e.reglages.jourEcheance, 31);
  assert.deepEqual(simple(e.reglages.taux.map((t) => t.taux)), [5.5]);
  assert.equal(e.reglages.tolerance, 0.01);
  assert.equal(e.operations.length, 1);
  assert.deepEqual(simple([e.operations[0].type, e.operations[0].ht, e.operations[0].taux]), ['vente', 12.35, 100]);
  assert.deepEqual(simple(e.suivi), { 'M-2026-01': { declare: '2026-02-01' } });
  assert.deepEqual(simple(R.normaliser(null, B)), simple(R.etatVide(B)));
  assert.equal(R.validerOperation(R.normaliserOperation({ date: '2026-01-01', libelle: '', ht: 10 })), 'Indique un libellé (client, fournisseur ou nature).');
  assert.equal(R.validerOperation(R.normaliserOperation({ date: '2026-01-01', libelle: 'x', ht: 10 })), '');
});

test('périodicité 2027 : critère du chiffre d\'affaires (CGI art. 287), plus de seuil de 4 000 € de TVA', () => {
  const types = (l) => l.map((x) => x.type);
  // TVA nette élevée mais chiffre d'affaires modeste : plus d'alerte en 2027.
  const tri = etat({ regime: 'trimestriel' }, [op('2026-01-10', 'vente', 10000), op('2027-02-10', 'vente', 10000)]);
  assert.ok(!types(R.controles(tri, '2027-05-01')).includes('seuil'));
  // Ventes 2026 au-delà de 1 000 000 € HT : alerte en 2027.
  const gros = etat({ regime: 'trimestriel' }, [op('2026-06-10', 'vente', 1000001)]);
  assert.ok(types(R.controles(gros, '2027-02-01')).includes('seuil'));
  // Année en cours au-delà de 1 100 000 € : alerte.
  const cours = etat({ regime: 'trimestriel' }, [op('2026-06-10', 'vente', 500000), op('2027-03-10', 'vente', 1100001)]);
  assert.ok(types(R.controles(cours, '2027-04-01')).includes('seuil'));
  // Au réel mensuel avec un chiffre d'affaires 2026 sous le seuil : information, pas d'alerte.
  const men = etat({ regime: 'mensuel' }, [op('2026-06-10', 'vente', 50000)]);
  const c = R.controles(men, '2027-02-01');
  assert.ok(types(c).includes('trimestrielPossible'));
  assert.equal(c.find((x) => x.type === 'trimestrielPossible').gravite, 'info');
  // En 2026, la règle des 4 000 € s'applique encore, et la date du critère est réglable.
  assert.ok(!types(R.controles(men, '2026-12-01')).includes('trimestrielPossible'));
  assert.ok(!types(R.controles(etat({ regime: 'mensuel', dateSeuilCa: '2028-01-01' }, men.operations), '2027-02-01')).includes('trimestrielPossible'));
});
