// Règles métier du template « Registre des non-conformités » (templates/non-conformites/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../templates/non-conformites/regles.js', import.meta.url), 'utf8');
const fenetre = {};
vm.runInNewContext(source, { window: fenetre });
const R = fenetre.REGLES;
const js = (x) => JSON.parse(JSON.stringify(x));
const base = {};
vm.runInNewContext(readFileSync(new URL('../../templates/non-conformites/donnees.js', import.meta.url), 'utf8'), { window: base });
const B = base.BASE;

const AUJ = '2026-11-12';
const REG = { delais: { 1: 30, 2: 15, 3: 7, 4: 2 }, delaiVerif: 30, libelleZone: 'Lot' };
const nc = (o = {}) => ({ id: 'x', numero: 'NC-2026-001', date: '2026-11-01', titre: 'Écart', gravite: 2, type: 'dimension', zone: 'Gros œuvre', actions: [], verifications: [], cloture: null, ...o });
const action = (o = {}) => ({ id: 'a', nature: 'corrective', quoi: 'Reprendre', responsable: 'Chef de chantier', echeance: '2026-11-20', faite: null, ...o });

test('numérotation par année du constat', () => {
  assert.equal(R.numeroSuivant([], '2026-03-04'), 'NC-2026-001');
  const ncs = [{ numero: 'NC-2026-007' }, { numero: 'NC-2026-012' }, { numero: 'NC-2025-044' }, { numero: 'libre' }];
  assert.equal(R.numeroSuivant(ncs, '2026-11-12'), 'NC-2026-013');
  assert.equal(R.numeroSuivant(ncs, '2025-12-30'), 'NC-2025-045');
  assert.equal(R.numeroSuivant(ncs, '2027-01-02'), 'NC-2027-001');
});

test('étape calculée : analyse, actions, vérification, clôturée', () => {
  assert.equal(R.etape(nc()), 'analyse');
  assert.equal(R.etape(nc({ actions: [action(), action({ faite: '2026-11-05' })] })), 'actions');
  assert.equal(R.etape(nc({ actions: [action({ faite: '2026-11-05' })] })), 'verification');
  assert.equal(R.etape(nc({ cloture: { date: '2026-11-10' } })), 'cloturee');
});

test('vérification inefficace : retour à l\'analyse jusqu\'à une nouvelle action', () => {
  const n = nc({ actions: [action({ faite: '2026-11-03' })] });
  R.verifier(n, { date: '2026-11-08', efficace: false, commentaire: 'Écart revu' });
  assert.equal(n.cloture, null);
  assert.equal(R.etape(n), 'analyse');
  n.actions.push(action({ id: 'b', echeance: '2026-11-25' }));
  assert.equal(R.etape(n), 'actions');
  n.actions[1].faite = '2026-11-10';
  assert.equal(R.etape(n), 'verification');
  R.verifier(n, { date: '2026-11-12', efficace: true, par: 'Responsable qualité' });
  assert.deepEqual(js(n.cloture), { date: '2026-11-12', par: 'Responsable qualité' });
  assert.equal(R.etape(n), 'cloturee');
  assert.equal(n.verifications.length, 2);
  assert.equal(n.verifications[0].nbActions, 1);
});

test('échéance de traitement selon la gravité, ou choisie', () => {
  assert.equal(R.echeance(nc({ gravite: 1 }), REG), '2026-12-01');
  assert.equal(R.echeance(nc({ gravite: 3 }), REG), '2026-11-08');
  assert.equal(R.echeance(nc({ gravite: 4 }), REG), '2026-11-03');
  assert.equal(R.echeance(nc({ gravite: 4, echeance: '2026-11-30' }), REG), '2026-11-30');
  assert.equal(R.echeance(nc({ gravite: 2 }), { delais: { 2: 0 } }), '2026-11-01');
  // Réglages absents : délais par défaut.
  assert.equal(R.echeance(nc({ gravite: 2 }), {}), '2026-11-16');
});

test('retard : échéance de la NC ou d\'une action dépassée, jamais une fois clôturée', () => {
  assert.equal(R.enRetard(nc({ gravite: 2 }), AUJ, REG), false); // échéance 16/11
  assert.equal(R.enRetard(nc({ gravite: 3 }), AUJ, REG), true); // échéance 08/11
  assert.equal(R.enRetard(nc({ gravite: 1, actions: [action({ echeance: '2026-11-11' })] }), AUJ, REG), true);
  assert.equal(R.enRetard(nc({ gravite: 1, actions: [action({ echeance: '2026-11-12' })] }), AUJ, REG), false); // le jour même
  assert.equal(R.enRetard(nc({ gravite: 1, actions: [action({ echeance: '2026-11-11', faite: '2026-11-11' })] }), AUJ, REG), false);
  assert.equal(R.enRetard(nc({ gravite: 4, cloture: { date: '2026-11-20' } }), AUJ, REG), false);
  // Actions faites : seul compte le retard de vérification (prévue 30 j après la dernière action).
  assert.equal(R.enRetard(nc({ gravite: 3, actions: [action({ faite: '2026-11-05' })] }), AUJ, REG), false);
  assert.equal(R.enRetard(nc({ gravite: 3, actions: [action({ faite: '2026-10-05' })] }), AUJ, REG), true); // due le 04/11
  assert.equal(R.enRetard(nc({ gravite: 3, verifPrevue: '2026-11-12', actions: [action({ faite: '2026-10-05' })] }), AUJ, REG), false);
});

test('vérification d\'efficacité prévue après la dernière action', () => {
  const n = nc({ actions: [action({ faite: '2026-10-01' }), action({ faite: '2026-10-10' })] });
  assert.equal(R.verifPrevue(n, REG), '2026-11-09');
  assert.equal(R.verifDue(n, AUJ, REG), true);
  assert.equal(R.verifPrevue(n, { delaiVerif: 45 }), '2026-11-24');
  assert.equal(R.verifPrevue({ ...n, verifPrevue: '2026-12-01' }, REG), '2026-12-01');
  assert.equal(R.verifDue({ ...n, verifPrevue: '2026-12-01' }, AUJ, REG), false);
  assert.equal(R.verifPrevue(nc({ actions: [action()] }), REG), null); // pas encore à vérifier
});

test('délai de clôture en jours', () => {
  assert.equal(R.delaiCloture(nc({ date: '2026-10-30', cloture: { date: '2026-11-12' } })), 13);
  assert.equal(R.delaiCloture(nc()), null);
  // Passage à l'heure d'hiver (25/10/2026) sans décalage.
  assert.equal(R.delaiCloture(nc({ date: '2026-10-20', cloture: { date: '2026-10-30' } })), 10);
});

test('5 pourquoi : chaque question reprend la réponse précédente', () => {
  const rep = ['La réservation n\'était pas en place.', '', ''];
  assert.equal(R.questionPourquoi('Voile coulé sans réservation', rep, 0), 'Pourquoi « voile coulé sans réservation » ?');
  assert.equal(R.questionPourquoi('Voile', rep, 1), 'Pourquoi « la réservation n\'était pas en place » ?');
  assert.equal(R.questionPourquoi('Voile', rep, 2), 'Pourquoi ? (réponds d\'abord au pourquoi n° 2)');
  assert.equal(R.questionPourquoi('', [], 0), 'Pourquoi cet écart s\'est-il produit ?');
  assert.equal(R.racineProposee(['a', 'b ', '', '  ']), 'b');
  assert.equal(R.racineProposee([]), '');
});

test('tri du registre : retards, puis à vérifier, puis en cours par échéance, puis clôturées récentes', () => {
  const ncs = [
    nc({ id: 'close-ancienne', gravite: 1, cloture: { date: '2026-09-01' } }),
    nc({ id: 'en-cours', gravite: 1 }), // échéance 01/12
    nc({ id: 'retard', gravite: 3 }),
    nc({ id: 'a-verifier', gravite: 1, verifPrevue: '2026-11-12', actions: [action({ faite: '2026-10-01' })] }),
    nc({ id: 'close-recente', gravite: 1, cloture: { date: '2026-11-10' } }),
    nc({ id: 'en-cours-tot', gravite: 2 }), // échéance 16/11
  ];
  assert.deepEqual(js(R.trier(ncs, AUJ, REG).map((n) => n.id)), ['retard', 'a-verifier', 'en-cours-tot', 'en-cours', 'close-recente', 'close-ancienne']);
});

test('filtres : étape, retard, gravité, recherche sans accents', () => {
  const ncs = [
    nc({ id: '1', titre: 'Réservation oubliée', gravite: 3 }),
    nc({ id: '2', titre: 'Joint irrégulier', gravite: 1, cloture: { date: '2026-11-02' } }),
    nc({ id: '3', titre: 'Cote hors tolérance', gravite: 2, actions: [action({ quoi: 'Trier le lot', responsable: 'Régleur' })] }),
  ];
  const ids = (f) => js(R.filtrer(ncs, f, AUJ, REG).map((n) => n.id));
  assert.deepEqual(ids({ etape: 'ouvertes' }), ['1', '3']);
  assert.deepEqual(ids({ etape: 'retard' }), ['1']);
  assert.deepEqual(ids({ etape: 'actions' }), ['3']);
  assert.deepEqual(ids({ etape: 'cloturee' }), ['2']);
  assert.deepEqual(ids({ gravite: '1' }), ['2']);
  assert.deepEqual(ids({ texte: 'reservation' }), ['1']);
  assert.deepEqual(ids({ texte: 'regleur lot' }), ['3']);
  assert.deepEqual(ids({ etape: 'tout' }), ['1', '2', '3']);
});

test('indicateurs sur une période', () => {
  const ncs = [
    nc({ date: '2026-10-01', gravite: 3, cloture: { date: '2026-10-11' }, analyse: { cause: 'methode' }, cout: 1200 }), // 10 j
    nc({ date: '2026-10-05', gravite: 2, cloture: { date: '2026-10-25' }, analyse: { cause: 'methode' }, verifications: [{ efficace: false }, { efficace: true }] }), // 20 j
    nc({ date: '2026-11-01', gravite: 3, analyse: { cause: 'matiere' }, cout: 300.5 }), // ouverte, en retard
    nc({ date: '2026-11-10', gravite: 1, type: 'aspect' }), // ouverte
    nc({ date: '2025-06-01', gravite: 4, cloture: { date: '2025-06-03' } }), // hors période
  ];
  const k = R.indicateurs(ncs, AUJ, REG, '2026-08-13');
  assert.equal(k.ouvertes, 2);
  assert.equal(k.retard, 1);
  assert.equal(k.constatees, 4);
  assert.equal(k.cloturees, 2);
  assert.equal(k.delaiMoyen, 15);
  assert.equal(k.efficacite, 50);
  assert.deepEqual(js(k.parGravite), { 1: 1, 2: 1, 3: 2 });
  assert.deepEqual(js(k.parCause), { methode: 2, matiere: 1 });
  assert.equal(k.sansCause, 1);
  assert.deepEqual(js(k.parType), { dimension: 3, aspect: 1 });
  assert.equal(k.cout, 1500.5);
  const tout = R.indicateurs(ncs, AUJ, REG, null);
  assert.equal(tout.cloturees, 3);
  assert.equal(tout.delaiMoyen, 10.7); // (10 + 20 + 2) / 3
  assert.equal(R.indicateurs([], AUJ, REG).delaiMoyen, null);
});

test('constatées et clôturées par mois', () => {
  const m = R.parMois([nc({ date: '2026-11-01' }), nc({ date: '2026-10-03', cloture: { date: '2026-11-02' } }), nc({ date: '2025-11-30' })], AUJ, 12);
  assert.equal(m.length, 12);
  assert.equal(m[0].cle, '2025-12');
  assert.equal(m[11].cle, '2026-11');
  assert.deepEqual([m[11].constatees, m[11].cloturees, m[10].constatees], [1, 1, 1]);
  assert.equal(m.reduce((s, x) => s + x.constatees, 0), 2); // 30/11/2025 hors fenêtre
  assert.equal(m[1].libelle, 'janv. 26');
});

test('CSV : séparateur point-virgule, guillemets, formules neutralisées, BOM', () => {
  assert.equal(R.champCsv('simple'), 'simple');
  assert.equal(R.champCsv('a;b'), '"a;b"');
  assert.equal(R.champCsv('dit "non"'), '"dit ""non"""');
  assert.equal(R.champCsv('ligne\nsuite'), '"ligne\nsuite"');
  assert.equal(R.champCsv('=SOMME(A1)'), '\'=SOMME(A1)');
  assert.equal(R.champCsv('-5'), '\'-5');
  assert.equal(R.champCsv(null), '');
  const etat = { reglages: REG, ncs: [nc({ titre: 'Voile; niveau 1', cout: 1250.5, analyse: { racine: 'Plans', cause: 'methode' }, actions: [action({ faite: '2026-11-05' }), action({ nature: 'preventive', quoi: 'Afficher la liste des plans' })] })] };
  const csv = R.csvRegistre(etat, B, AUJ);
  assert.ok(csv.startsWith('﻿Numéro;Date du constat;Titre'));
  const lignes = csv.trim().split('\r\n');
  assert.equal(lignes.length, 2);
  assert.ok(lignes[0].includes(';Lot;'));
  assert.ok(lignes[1].startsWith('NC-2026-001;01/11/2026;"Voile; niveau 1";'));
  assert.ok(lignes[1].includes(';Dimensionnel et géométrie;Significative;'));
  assert.ok(lignes[1].includes(';Plans;Méthode;2;1;16/11/2026;non;Actions en cours;'));
  assert.ok(lignes[1].endsWith(';1250,5'));
  const ca = R.csvActions(etat, AUJ).trim().split('\r\n');
  assert.equal(ca.length, 3);
  assert.equal(ca[2], 'NC-2026-001;"Voile; niveau 1";Préventive;Afficher la liste des plans;Chef de chantier;20/11/2026;;non');
});

test('base intégrée cohérente', () => {
  assert.deepEqual(js(B.gravites.map((g) => g.id)), [1, 2, 3, 4]);
  assert.equal(B.types.length, 10);
  assert.equal(B.causes.length, 6);
  assert.equal(new Set(B.types.map((t) => t.id)).size, B.types.length);
  B.cinqPourquoi.exemples.forEach((e) => {
    assert.equal(e.pourquoi.length, 5);
    assert.ok(B.causes.some((c) => c.id === e.cause));
  });
  B.profils.forEach((p) => assert.ok(p.zones.length >= 10));
  assert.ok(!/énergie|nucl|éolien|photovolta/i.test(JSON.stringify(B)));
});
