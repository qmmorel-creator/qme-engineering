// Tests des règles métier de la levée de réserves (templates/reserves/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/reserves/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-12';

const res = (o = {}) => ({ id: 'x', operationId: 'op1', numero: 'R-001', lotId: 'l1', entrepriseId: 'e1', batiment: 'A', niveau: 'R+1', local: 'Logement A12',
  nature: 'Finition et aspect', description: 'Reprise d\'enduit', constat: '2026-10-01', echeance: '2026-10-31', statut: 'ouverte', leveeLe: null, controleLe: null, motifRefus: '', photo: '', historique: [], ...o });

test('base intégrée : 20 lots à codes uniques, 10 natures, délais de départ', () => {
  assert.equal(B.lots.length, 20);
  assert.equal(new Set(B.lots.map((l) => l.code)).size, 20);
  assert.equal(B.natures.length, 10);
  assert.equal(B.delaiDefaut, 30);
  assert.equal(B.alerteDefaut, 7);
  assert.match(B.legal.url, /^https:\/\/www\.legifrance\.gouv\.fr\//);
});

test('dates : ajout et écart, y compris passage d\'année et année bissextile', () => {
  assert.equal(R.ajout('2026-12-20', 30), '2027-01-19');
  assert.equal(R.ajout('2028-02-28', 1), '2028-02-29');
  assert.equal(R.ecart('2026-10-31', AUJ), 12);
  assert.equal(R.echeanceDefaut('2026-11-12', 30), '2026-12-12');
  assert.ok(R.estDate('2026-02-28'));
  assert.ok(!R.estDate('2026-02-30'));
  assert.ok(!R.estDate('12/11/2026'));
});

test('retard : seulement les réserves à la charge de l\'entreprise dont l\'échéance est passée', () => {
  assert.equal(R.enRetard(res(), AUJ), true);
  assert.equal(R.joursRetard(res(), AUJ), 12);
  assert.equal(R.enRetard(res({ echeance: AUJ }), AUJ), false); // échéance le jour même : pas encore en retard
  assert.equal(R.enRetard(res({ statut: 'refusee' }), AUJ), true);
  assert.equal(R.enRetard(res({ statut: 'levee', leveeLe: '2026-11-01' }), AUJ), false);
  assert.equal(R.enRetard(res({ statut: 'controlee' }), AUJ), false);
  assert.equal(R.enRetard(res({ echeance: null }), AUJ), false);
  assert.equal(R.etat(res(), AUJ), 'retard');
  assert.equal(R.etat(res({ echeance: '2026-12-01' }), AUJ), 'ouverte');
});

test('échéance proche : dans la fenêtre d\'alerte, bornes comprises', () => {
  assert.equal(R.proche(res({ echeance: AUJ }), AUJ, 7), true);
  assert.equal(R.proche(res({ echeance: '2026-11-19' }), AUJ, 7), true);
  assert.equal(R.proche(res({ echeance: '2026-11-20' }), AUJ, 7), false);
  assert.equal(R.proche(res({ echeance: '2026-11-11' }), AUJ, 7), false); // déjà en retard
});

test('cycle complet : ouverte → levée → refusée → levée → contrôlée, historique tracé', () => {
  const r0 = res();
  const r1 = R.transition(r0, 'levee', { date: '2026-11-02' });
  assert.equal(r0.statut, 'ouverte', 'la réserve d\'origine n\'est pas modifiée');
  assert.equal(r1.statut, 'levee');
  assert.equal(r1.leveeLe, '2026-11-02');
  assert.equal(R.attenteControle(r1, AUJ), 10);
  const r2 = R.transition(r1, 'refusee', { date: '2026-11-05', note: 'Teinte différente', delai: 15 });
  assert.equal(r2.statut, 'refusee');
  assert.equal(r2.echeance, '2026-11-20');
  assert.equal(r2.motifRefus, 'Teinte différente');
  assert.equal(r2.leveeLe, null);
  const r3 = R.transition(r2, 'levee', { date: '2026-11-09' });
  const r4 = R.transition(r3, 'controlee', { date: '2026-11-10' });
  assert.equal(r4.statut, 'controlee');
  assert.equal(r4.controleLe, '2026-11-10');
  assert.deepEqual(r4.historique.map((h) => h.statut), ['levee', 'refusee', 'levee', 'controlee']);
});

test('transitions interdites et contrôles de cohérence', () => {
  assert.throws(() => R.transition(res(), 'controlee', { date: AUJ }), /Passage impossible/);
  assert.throws(() => R.transition(res(), 'refusee', { date: AUJ, note: 'x' }), /Passage impossible/);
  assert.throws(() => R.transition(res({ statut: 'controlee' }), 'levee', { date: AUJ }), /Passage impossible/);
  assert.throws(() => R.transition(res(), 'levee', { date: '2026-09-30' }), /précéder le constat/);
  const levee = res({ statut: 'levee', leveeLe: '2026-11-05' });
  assert.throws(() => R.transition(levee, 'controlee', { date: '2026-11-04' }), /précéder la levée/);
  assert.throws(() => R.transition(levee, 'refusee', { date: AUJ, note: '  ' }), /motif/);
  assert.throws(() => R.transition(levee, 'refusee', { date: AUJ, note: 'x', echeance: '2026-11-01' }), /nouvelle échéance/);
  assert.throws(() => R.transition(res(), 'levee', { date: '2026-13-01' }), /Date invalide/);
  // Réouverture d'une réserve contrôlée, avec nouvelle échéance.
  const rouverte = R.transition(res({ statut: 'controlee', leveeLe: '2026-11-01', controleLe: '2026-11-03' }), 'ouverte', { date: AUJ, note: 'Fuite revenue', echeance: '2026-11-30' });
  assert.equal(rouverte.statut, 'ouverte');
  assert.equal(rouverte.echeance, '2026-11-30');
  assert.equal(rouverte.controleLe, null);
});

test('numérotation par opération, sans réutiliser les numéros supprimés', () => {
  const liste = [res({ numero: 'R-001' }), res({ numero: 'R-004' }), res({ numero: 'R-009', operationId: 'op2' })];
  assert.equal(R.prochainNumero(liste, 'op1'), 'R-005');
  assert.equal(R.prochainNumero(liste, 'op2'), 'R-010');
  assert.equal(R.prochainNumero(liste, 'op3'), 'R-001');
});

test('tri : retards (plus ancien d\'abord), à contrôler, proches, à lever, contrôlées', () => {
  const l = [
    res({ id: 'ctl', numero: 'R-001', statut: 'controlee', controleLe: '2026-11-01' }),
    res({ id: 'loin', numero: 'R-002', echeance: '2026-12-31' }),
    res({ id: 'proche', numero: 'R-003', echeance: '2026-11-15' }),
    res({ id: 'aCtl', numero: 'R-004', statut: 'levee', leveeLe: '2026-11-08' }),
    res({ id: 'retard2', numero: 'R-005', echeance: '2026-11-10' }),
    res({ id: 'retard1', numero: 'R-006', echeance: '2026-10-20', statut: 'refusee' }),
  ];
  assert.deepEqual(R.trier(l, AUJ, 7).map((r) => r.id), ['retard1', 'retard2', 'aCtl', 'proche', 'loin', 'ctl']);
});

test('filtres : opération, statut, recherche sans accents sur plusieurs mots', () => {
  const l = [
    res({ id: 'a', description: 'Carreau fêlé devant l\'évier', local: 'Cuisine A12' }),
    res({ id: 'b', statut: 'controlee', description: 'Porte rayée' }),
    res({ id: 'c', operationId: 'op2', echeance: '2026-12-31', description: 'Plinthe manquante' }),
  ];
  assert.deepEqual(R.filtrer(l, { operationId: 'op1' }, AUJ).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(R.filtrer(l, { statut: 'a-lever' }, AUJ).map((r) => r.id), ['a', 'c']);
  assert.deepEqual(R.filtrer(l, { statut: 'en-cours' }, AUJ).map((r) => r.id), ['a', 'c']);
  assert.deepEqual(R.filtrer(l, { statut: 'tous' }, AUJ).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(R.filtrer(l, { statut: 'retard' }, AUJ).map((r) => r.id), ['a']);
  assert.deepEqual(R.filtrer(l, { statut: 'controlee' }, AUJ).map((r) => r.id), ['b']);
  assert.deepEqual(R.filtrer(l, { texte: 'fele CUISINE' }, AUJ).map((r) => r.id), ['a']);
  assert.deepEqual(R.filtrer(l, { texte: 'plaquiste' }, AUJ, (r) => (r.id === 'c' ? 'Plâtrerie plaquiste' : '')).map((r) => r.id), ['c']);
});

test('indicateurs et regroupement par entreprise', () => {
  const l = [
    res({ entrepriseId: 'e1' }), // retard 12 j
    res({ entrepriseId: 'e1', statut: 'refusee', echeance: '2026-11-02' }), // retard 10 j
    res({ entrepriseId: 'e1', statut: 'levee', leveeLe: '2026-11-10' }),
    res({ entrepriseId: 'e2', statut: 'controlee', controleLe: '2026-11-01' }),
    res({ entrepriseId: 'e2', echeance: '2026-12-01' }),
  ];
  const i = R.indicateurs(l, AUJ);
  assert.deepEqual({ ...i }, { total: 5, ouvertes: 2, refusees: 1, aControler: 1, controlees: 1, retard: 2, restantes: 3, taux: 20, plusAncienRetard: 12 });
  const g = R.parCle(l, 'entrepriseId', AUJ);
  assert.deepEqual(g.map((x) => [x.cle, x.total, x.retard, x.taux]), [['e1', 3, 2, 0], ['e2', 2, 0, 50]]);
  assert.equal(R.indicateurs([], AUJ).taux, null);
});

test('CSV : BOM, point-virgule, guillemets, formules neutralisées, retard', () => {
  assert.equal(R.champCsv('=SOMME(A1)'), '\'=SOMME(A1)');
  assert.equal(R.champCsv('-3'), '\'-3');
  assert.equal(R.champCsv('a;b'), '"a;b"');
  assert.equal(R.champCsv('dit "non"'), '"dit ""non"""');
  const etat = {
    operations: [{ id: 'op1', nom: 'Résidence test' }],
    lots: [{ id: 'l1', code: 'PEI', nom: 'Peinture' }],
    entreprises: [{ id: 'e1', nom: 'Peintures fictives' }],
    reserves: [res({ description: 'Reprise; angle "nord"' }), res({ numero: 'R-002', statut: 'controlee', leveeLe: '2026-11-01', controleLe: '2026-11-03' })],
  };
  const texte = R.csv(etat, AUJ);
  assert.ok(texte.startsWith('﻿Opération;Numéro;'));
  const lignes = texte.trim().split('\r\n');
  assert.equal(lignes.length, 3);
  assert.equal(lignes[1], 'Résidence test;R-001;A;R+1;Logement A12;PEI Peinture;Peintures fictives;Finition et aspect;"Reprise; angle ""nord""";01/10/2026;31/10/2026;En retard;12;;;;');
  assert.ok(lignes[2].includes(';Contrôlée;;01/11/2026;03/11/2026;'));
});

test('taille : une réserve pèse moins de 1 Ko sérialisée', () => {
  const r = res({ description: 'Fissure de 30 cm sous l\'allège, mur nord, à reprendre et repeindre', historique: [{ date: AUJ, statut: 'levee', note: '' }] });
  assert.ok(R.taille(r) < 1000, `${R.taille(r)} octets`);
});
