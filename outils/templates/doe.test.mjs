// Tests des règles métier du registre du DOE (templates/doe/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/doe/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-14';
const OPS = { op1: { id: 'op1', nom: 'Résidence (exemple)', dateLimite: '2026-11-01' }, op2: { id: 'op2', nom: 'Atelier (exemple)', dateLimite: '' } };
const ctx = { auj: AUJ, ops: OPS, alerte: 7 };

const piece = (o = {}) => ({ id: 'x', operationId: 'op1', lotId: 'l1', numero: 'P-001', famille: 'plan', intitule: 'Plans de récolement', statut: 'attendue',
  echeance: '', recueLe: null, valideeLe: null, reference: '', format: '', motif: '', historique: [], ...o });

test('base intégrée : 20 lots à codes uniques, chacun avec des pièces de familles connues', () => {
  assert.equal(B.lots.length, 20);
  assert.equal(new Set(B.lots.map((l) => l.code)).size, 20);
  const familles = new Set(B.familles.map((f) => f.code));
  for (const l of B.lots) {
    assert.ok(l.pieces.length >= 1, l.code);
    for (const [f, t] of l.pieces) { assert.ok(familles.has(f), `${l.code} : ${f}`); assert.ok(t.length > 5); }
    assert.equal(new Set(l.pieces.map(([, t]) => R.plat(t))).size, l.pieces.length, `doublon dans ${l.code}`);
  }
  assert.ok(familles.has('diuo'));
  assert.equal(B.pieceDiuo.famille, 'diuo');
  assert.match(B.legal.url, /^https:\/\/www\.legifrance\.gouv\.fr\//);
  assert.match(B.legal.consulte, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('dates : ajout, écart, validité, format français', () => {
  assert.equal(R.ajout('2026-12-20', 30), '2027-01-19');
  assert.equal(R.ajout('2028-02-28', 1), '2028-02-29');
  assert.equal(R.ecart('2026-11-01', AUJ), 13);
  assert.ok(R.estDate('2026-02-28'));
  assert.ok(!R.estDate('2026-02-30'));
  assert.equal(R.dateFr('2026-11-04'), '04/11/2026');
  assert.equal(R.plat('  Élément   DIUO '), 'element diuo');
});

test('date limite : celle de la pièce, sinon celle de l\'opération', () => {
  assert.equal(R.echeance(piece(), ctx), '2026-11-01');
  assert.equal(R.echeance(piece({ echeance: '2026-12-01' }), ctx), '2026-12-01');
  assert.equal(R.echeance(piece({ operationId: 'op2' }), ctx), '');
});

test('retard : pièce attendue ou à reprendre dont la date limite est passée', () => {
  assert.equal(R.enRetard(piece(), ctx), true);
  assert.equal(R.joursRetard(piece(), ctx), 13);
  assert.equal(R.etat(piece(), ctx), 'retard');
  assert.equal(R.enRetard(piece({ statut: 'a-reprendre', echeance: '2026-11-10' }), ctx), true);
  assert.equal(R.enRetard(piece({ statut: 'recue' }), ctx), false);
  assert.equal(R.enRetard(piece({ statut: 'validee' }), ctx), false);
  assert.equal(R.enRetard(piece({ echeance: AUJ }), ctx), false); // le jour même : pas encore
  assert.equal(R.enRetard(piece({ operationId: 'op2' }), ctx), false); // sans date limite
  assert.equal(R.proche(piece({ echeance: '2026-11-20' }), ctx), true);
  assert.equal(R.proche(piece({ echeance: '2026-11-30' }), ctx), false);
});

test('transitions : réception, validation, reprise avec motif, réouverture', () => {
  const recue = R.transition(piece(), 'recue', { date: '2026-11-05', reference: 'PLB-REC-B' , format: 'Numérique' });
  assert.equal(recue.statut, 'recue');
  assert.equal(recue.recueLe, '2026-11-05');
  assert.equal(recue.reference, 'PLB-REC-B');
  assert.equal(recue.historique.length, 1);
  assert.throws(() => R.transition(recue, 'a-reprendre', { date: '2026-11-06' }), /motif/);
  const rep = R.transition(recue, 'a-reprendre', { date: '2026-11-06', note: 'Plans non mis à jour', delai: 10 });
  assert.equal(rep.echeance, '2026-11-16');
  assert.equal(rep.motif, 'Plans non mis à jour');
  const rerecue = R.transition(rep, 'recue', { date: '2026-11-12' });
  const val = R.transition(rerecue, 'validee', { date: AUJ });
  assert.equal(val.valideeLe, AUJ);
  assert.equal(val.historique.length, 4);
  assert.throws(() => R.transition(piece(), 'validee', { date: AUJ }), /impossible/);
  assert.throws(() => R.transition(recue, 'validee', { date: '2026-11-01' }), /précéder/);
  assert.throws(() => R.transition(piece(), 'recue', { date: '14/11/2026' }), /Date invalide/);
  const rouverte = R.transition(val, 'attendue', { date: AUJ, note: 'Erreur de saisie' });
  assert.equal(rouverte.recueLe, null);
  assert.equal(rouverte.valideeLe, null);
  assert.equal(piece().historique.length, 0); // l'original n'est pas modifié
});

test('numérotation par opération, sans réutiliser un trou', () => {
  const l = [piece({ numero: 'P-001' }), piece({ numero: 'P-004' }), piece({ operationId: 'op2', numero: 'P-009' })];
  assert.equal(R.prochainNumero(l, 'op1'), 'P-005');
  assert.equal(R.prochainNumero(l, 'op2'), 'P-010');
  assert.equal(R.prochainNumero([], 'op1'), 'P-001');
});

test('pièces types : base, modèle modifié, DIUO, sans doublon', () => {
  const lot = { id: 'l1', operationId: 'op1', code: 'PLB' };
  const base = R.aCreer(lot, { base: B });
  assert.equal(base.length, B.lots.find((l) => l.code === 'PLB').pieces.length);
  assert.ok(base.every((p) => p.statut === 'attendue' && p.lotId === 'l1' && p.operationId === 'op1'));
  const avecDiuo = R.aCreer(lot, { base: B, diuo: true });
  assert.equal(avecDiuo.length, base.length + 1);
  assert.equal(avecDiuo.at(-1).famille, 'diuo');
  const modeles = { PLB: [['plan', 'Plan A'], ['notice', 'Notice B']] };
  assert.deepEqual(R.aCreer(lot, { base: B, modeles }).map((p) => p.intitule), ['Plan A', 'Notice B']);
  const existantes = [piece({ lotId: 'l1', intitule: 'plan a' })];
  assert.deepEqual(R.aCreer(lot, { base: B, modeles, existantes }).map((p) => p.intitule), ['Notice B']);
  assert.deepEqual(R.piecesTypes('XYZ', null, B), []);
  assert.deepEqual(R.piecesTypes('PLB', { PLB: [] }, B), []); // modèle vidé volontairement
});

test('indicateurs : complétude (validées) et remises (reçues + validées), arrondis vers le bas', () => {
  const l = [piece(), piece({ statut: 'recue' }), piece({ statut: 'a-reprendre', echeance: '2026-12-01' }), piece({ statut: 'validee' }), piece({ statut: 'validee' }), piece({ operationId: 'op2' })];
  const i = R.indicateurs(l, ctx);
  assert.equal(i.total, 6);
  assert.equal(i.attendues, 2);
  assert.equal(i.recues, 1);
  assert.equal(i.aReprendre, 1);
  assert.equal(i.validees, 2);
  assert.equal(i.retard, 1);
  assert.equal(i.plusAncienRetard, 13);
  assert.equal(i.completude, 33);
  assert.equal(i.remises, 50);
  assert.equal(R.indicateurs([], ctx).completude, null);
  assert.equal(R.indicateurs([piece({ statut: 'validee' })], ctx).completude, 100);
});

test('regroupement : les entreprises en retard puis les moins complètes d\'abord', () => {
  const l = [piece({ lotId: 'a', statut: 'validee' }), piece({ lotId: 'b' }), piece({ lotId: 'c', operationId: 'op2' }), piece({ lotId: 'c', operationId: 'op2', statut: 'validee' })];
  const g = R.parCle(l, (p) => p.lotId, ctx);
  assert.deepEqual(g.map((x) => x.cle), ['b', 'c', 'a']);
  assert.equal(g[1].completude, 50);
});

test('relances : dues sans relance ou après l\'intervalle, triées par urgence', () => {
  const ent = (p) => ({ l1: 'e1', l2: 'e2', l3: 'e3' })[p.lotId];
  const pieces = [piece({ id: 'a', lotId: 'l1' }), piece({ id: 'b', lotId: 'l1', echeance: '2026-11-10' }), piece({ id: 'c', lotId: 'l2' }), piece({ id: 'd', lotId: 'l3', statut: 'validee' })];
  const relances = [{ operationId: 'op1', entrepriseId: 'e2', date: '2026-11-12' }, { operationId: 'op1', entrepriseId: 'e2', date: '2026-11-03' }];
  const d = R.relancesDues(pieces, relances, ent, ctx, 7);
  assert.equal(d.length, 2); // e3 n'a rien en retard
  assert.equal(d[0].entrepriseId, 'e1');
  assert.equal(d[0].due, true);
  assert.equal(d[0].pieces.length, 2);
  assert.equal(d[0].nb, 0);
  assert.equal(d[1].entrepriseId, 'e2');
  assert.equal(d[1].nb, 2);
  assert.equal(d[1].derniere, '2026-11-12');
  assert.equal(d[1].depuis, 2);
  assert.equal(d[1].due, false);
  assert.equal(R.relancesDues(pieces, relances, ent, ctx, 2).find((x) => x.entrepriseId === 'e2').due, true);
  // Une relance datée dans le futur ne compte pas encore.
  assert.equal(R.relancesDues(pieces, [{ operationId: 'op1', entrepriseId: 'e1', date: '2026-12-01' }], ent, ctx).find((x) => x.entrepriseId === 'e1').nb, 0);
});

test('courrier de relance : destinataire, rang, pièces et date demandée', () => {
  const t = R.texteRelance({ structure: 'Atelier (exemple)', operation: { nom: 'Résidence (exemple)', moa: 'SCI (fictive)' }, entreprise: { nom: 'Fluides (fictive)', contact: 'Conducteur de travaux' },
    pieces: [{ numero: 'P-004', lot: 'PLB · Plomberie', intitule: 'PV de désinfection', statut: 'attendue', echeance: '2026-11-01' }, { numero: 'P-005', lot: 'PLB · Plomberie', intitule: 'Plans', statut: 'a-reprendre', motif: 'non à jour' }],
    date: AUJ, rang: 2, nouvelleDate: '2026-11-28' });
  assert.match(t, /À l'attention de : Fluides \(fictive\), Conducteur de travaux/);
  assert.match(t, /Objet : 2e relance/);
  assert.match(t, /- P-004 · PLB · Plomberie · PV de désinfection, attendue le 01\/11\/2026/);
  assert.match(t, /à reprendre : non à jour/);
  assert.match(t, /au plus tard le 28\/11\/2026/);
  assert.match(t, /\(2 pièces\)/);
  assert.match(R.texteRelance({ operation: { nom: 'X' }, entreprise: { nom: 'Y' }, pieces: [], date: AUJ, rang: 1 }), /Objet : Relance ·/);
});

test('tri : retards d\'abord, puis reçues à vérifier, à reprendre, proches, attendues, validées', () => {
  const l = [piece({ numero: 'P-006', statut: 'validee' }), piece({ numero: 'P-005', operationId: 'op2' }), piece({ numero: 'P-004', echeance: '2026-11-18' }),
    piece({ numero: 'P-003', statut: 'a-reprendre', echeance: '2026-12-30' }), piece({ numero: 'P-002', statut: 'recue' }), piece({ numero: 'P-001' })];
  assert.deepEqual(R.trier(l, ctx).map((p) => p.numero), ['P-001', 'P-002', 'P-003', 'P-004', 'P-005', 'P-006']);
});

test('filtres : opération, lots, entreprise, famille, statut, recherche sans accents', () => {
  const ent = (p) => (p.lotId === 'l1' ? 'e1' : 'e2');
  const l = [piece({ id: 'a' }), piece({ id: 'b', lotId: 'l2', famille: 'notice', intitule: 'Notice d\'entretien', statut: 'validee' }), piece({ id: 'c', operationId: 'op2', statut: 'recue', reference: 'IND-B' })];
  const ids = (f) => R.filtrer(l, f, ctx, () => '', ent).map((p) => p.id);
  assert.deepEqual(ids({ operationId: 'op1' }), ['a', 'b']);
  assert.deepEqual(ids({ lotIds: new Set(['l2']) }), ['b']);
  assert.deepEqual(ids({ entrepriseId: 'e1' }), ['a', 'c']);
  assert.deepEqual(ids({ famille: 'notice' }), ['b']);
  assert.deepEqual(ids({ statut: 'a-traiter' }), ['a', 'c']);
  assert.deepEqual(ids({ statut: 'manquantes' }), ['a']);
  assert.deepEqual(ids({ statut: 'retard' }), ['a']);
  assert.deepEqual(ids({ statut: 'recue' }), ['c']);
  assert.deepEqual(ids({ texte: 'NOTICE entretien' }), ['b']);
  assert.deepEqual(ids({ texte: 'ind-b' }), ['c']);
  assert.deepEqual(R.filtrer(l, { texte: 'plomberie' }, ctx, (p) => (p.id === 'a' ? 'PLB Plomberie' : '')).map((p) => p.id), ['a']);
});

test('bordereau : pièces validées (et reçues sur demande), dans l\'ordre des lots', () => {
  const ordre = (p) => ({ l1: 2, l2: 1 })[p.lotId];
  const l = [piece({ numero: 'P-001', statut: 'validee' }), piece({ numero: 'P-002', lotId: 'l2', statut: 'validee' }), piece({ numero: 'P-003', statut: 'recue' }), piece({ numero: 'P-004' })];
  assert.deepEqual(R.bordereau(l, { ordreLot: ordre }).map((p) => p.numero), ['P-002', 'P-001']);
  assert.deepEqual(R.bordereau(l, { ordreLot: ordre, avecRecues: true }).map((p) => p.numero), ['P-002', 'P-001', 'P-003']);
});

test('CSV : en-têtes, point-virgule, BOM, retard, relances et formules neutralisées', () => {
  const etat = {
    operations: [OPS.op1], lots: [{ id: 'l1', operationId: 'op1', code: 'PLB', nom: 'Plomberie', entrepriseId: 'e1' }], entreprises: [{ id: 'e1', nom: 'Fluides; Fictifs' }],
    pieces: [piece({ id: 'a', intitule: '=SOMME(A1)' }), piece({ id: 'b', numero: 'P-002', statut: 'a-reprendre', motif: 'Indice "B" attendu', echeance: '2026-12-01' })],
    relances: [{ operationId: 'op1', entrepriseId: 'e1', date: '2026-11-08', pieces: ['a'] }, { operationId: 'op1', entrepriseId: 'e1', date: '2026-11-12', pieces: ['a', 'b'] }],
  };
  const c = R.csv(etat, AUJ, etat.pieces, B.familles);
  assert.ok(c.startsWith('﻿Opération;Numéro;Lot;Entreprise;Famille;Pièce;Statut'));
  const lignes = c.trim().split('\r\n');
  assert.equal(lignes.length, 3);
  assert.match(lignes[1], /^Résidence \(exemple\);P-001;PLB Plomberie;"Fluides; Fictifs";Plans d'exécution et de récolement;'=SOMME\(A1\);En retard;01\/11\/2026;13;/);
  assert.match(lignes[1], /;2;12\/11\/2026$/);
  assert.match(lignes[2], /À reprendre;01\/12\/2026;;;;;;"Indice ""B"" attendu";1;12\/11\/2026$/);
});

test('taille : l\'état sérialisé est mesuré en octets UTF-8', () => {
  assert.equal(R.taille({ a: 'é' }), 10);
});
