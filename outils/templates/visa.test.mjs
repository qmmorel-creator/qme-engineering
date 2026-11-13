// Règles métier du template « Circuit de visa des documents » (templates/visa/regles.js).
// Cas calculés à la main (calendrier 2026 : Pâques le 5 avril, 11 novembre un mercredi).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fenetre = {};
vm.runInNewContext(readFileSync(new URL('../../templates/visa/regles.js', import.meta.url), 'utf8'), { window: fenetre });
const R = fenetre.REGLES;
const base = {};
vm.runInNewContext(readFileSync(new URL('../../templates/visa/donnees.js', import.meta.url), 'utf8'), { window: base });
const B = base.BASE;
const js = (x) => JSON.parse(JSON.stringify(x));

const AUJ = '2026-11-12'; // jeudi
const r = { delaiVisa: 15, delaiResoumission: 15, ouvres: false, frequenceRelance: 7, alerte: 3, vaoNouvelIndice: true };
const doc = (indices = [], extra = {}) => ({ id: 'd', numero: 'GO-PEX-001', titre: 'Plans de coffrage', type: 'PEX', lotId: 'l1', viseurIds: [], indices, relances: [], ...extra });
const avis = (viseurId, code, date) => ({ viseurId, code, date, observations: '' });

test('Pâques et jours fériés (Code du travail, L3133-1)', () => {
  assert.equal(R.paques(2024), '2024-03-31');
  assert.equal(R.paques(2025), '2025-04-20');
  assert.equal(R.paques(2026), '2026-04-05');
  const f = R.joursFeries(2026);
  assert.equal(f.size, 11);
  for (const j of ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']) assert.ok(f.has(j), j);
  assert.equal(R.estOuvre('2026-11-11'), false);
  assert.equal(R.estOuvre('2026-11-14'), false); // samedi
  assert.equal(R.estOuvre('2026-11-12'), true);
});

test('délais en jours calendaires et ouvrés', () => {
  assert.equal(R.ajouterJours('2026-11-06', 5), '2026-11-11');
  // Vendredi 6/11 + 5 jours ouvrés : 9, 10, (11 férié), 12, 13, 16.
  assert.equal(R.ajouterJours('2026-11-06', 5, true), '2026-11-16');
  assert.equal(R.joursEntre('2026-11-06', '2026-11-16', true), 5);
  assert.equal(R.joursEntre('2026-11-16', '2026-11-06', true), -5);
  assert.equal(R.joursEntre('2026-10-20', '2026-11-12'), 23);
  // Fin d'année : 24/12 (jeudi) + 3 ouvrés = 28, 29, 30 (le 25 est férié).
  assert.equal(R.ajouterJours('2026-12-24', 3, true), '2026-12-30');
});

test('indice suivant et numéro suivant', () => {
  assert.equal(R.indiceSuivant(''), 'A');
  assert.equal(R.indiceSuivant('a'), 'B');
  assert.equal(R.indiceSuivant('Z'), 'AA');
  assert.equal(R.indiceSuivant('AZ'), 'BA');
  assert.equal(R.indiceSuivant('0'), '1');
  assert.equal(R.indiceSuivant('09'), '10');
  assert.equal(R.indiceSuivant('B2'), 'B3');
  assert.equal(R.numeroSuivant(['GO-PEX-001', 'GO-PEX-007', 'GO-NDC-002', 'gx'], 'GO-PEX'), 'GO-PEX-008');
  assert.equal(R.numeroSuivant([], 'CVC-SCH'), 'CVC-SCH-001');
});

test('synthèse des avis : le plus sévère, complet quand tous les viseurs ont répondu', () => {
  const ind = { indice: 'A', recuLe: '2026-10-01', avis: [avis('v1', 'VSO', '2026-10-05')] };
  assert.deepEqual(js(R.synthese(ind, ['v1', 'v2'])), { complet: false, code: 'VSO', date: '2026-10-05', manquants: ['v2'], nbAvis: 1 });
  ind.avis.push(avis('v2', 'VAO', '2026-10-09'));
  assert.deepEqual(js(R.synthese(ind, ['v1', 'v2'])), { complet: true, code: 'VAO', date: '2026-10-09', manquants: [], nbAvis: 2 });
  ind.avis.push(avis('v3', 'REF', '2026-10-10')); // hors circuit : ignoré
  assert.equal(R.synthese(ind, ['v1', 'v2']).code, 'VAO');
  assert.equal(R.synthese(ind, []).code, 'REF'); // sans circuit défini : tous les avis comptent
  assert.equal(R.synthese({ avis: [] }, []).complet, false);
});

test('état d\'un document : attendu, en visa, retard, alerte, resoumission, clos', () => {
  let e = R.etatDocument(doc([], { prevuLe: '2026-11-02' }), r, AUJ);
  assert.equal(e.statut, 'attendu'); assert.equal(e.retard, 10); assert.equal(e.cible, 'emetteur');
  e = R.etatDocument(doc(), r, AUJ);
  assert.equal(e.statut, 'attendu'); assert.equal(e.retard, 0); assert.equal(e.echeance, null);

  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-10-20', avis: [] }]), r, AUJ);
  assert.equal(e.statut, 'visa'); assert.equal(e.echeance, '2026-11-04'); assert.equal(e.retard, 8); assert.equal(e.cible, 'viseurs');

  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-10-30', avis: [] }]), r, AUJ);
  assert.equal(e.echeance, '2026-11-14'); assert.equal(e.restants, 2); assert.equal(e.alerte, true);
  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-11-01', avis: [] }]), r, AUJ);
  assert.equal(e.restants, 4); assert.equal(e.alerte, false);
  // En jours ouvrés : 30/10 + 15 ouvrés (2, 3, 4, 5, 6, 9, 10, 12, 13, 16, 17, 18, 19, 20, 23) = 23/11.
  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-10-30', avis: [] }]), { ...r, ouvres: true }, AUJ);
  assert.equal(e.echeance, '2026-11-23'); assert.equal(e.restants, 7);

  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-10-01', avis: [avis('v', 'REF', '2026-10-20')] }]), r, AUJ);
  assert.equal(e.statut, 'resoumettre'); assert.equal(e.code, 'REF'); assert.equal(e.echeance, '2026-11-04'); assert.equal(e.retard, 8);

  const vao = doc([{ indice: 'B', recuLe: '2026-11-01', avis: [avis('v', 'VAO', '2026-11-05')] }]);
  assert.equal(R.etatDocument(vao, r, AUJ).statut, 'resoumettre');
  assert.equal(R.etatDocument(vao, { ...r, vaoNouvelIndice: false }, AUJ).statut, 'vao');
  assert.equal(R.etatDocument(vao, { ...r, vaoNouvelIndice: false }, AUJ).clos, true);

  e = R.etatDocument(doc([{ indice: 'A', recuLe: '2026-10-01', avis: [avis('v', 'REF', '2026-10-10')] }, { indice: 'B', recuLe: '2026-10-25', avis: [avis('v', 'VSO', '2026-11-03')] }]), r, AUJ);
  assert.equal(e.statut, 'vso'); assert.equal(e.clos, true); assert.equal(e.retard, 0); assert.equal(e.indice, 'B');
});

test('délais propres à une opération', () => {
  assert.equal(R.reglagesOperation(r, { delaiVisa: 10 }).delaiVisa, 10);
  assert.equal(R.reglagesOperation(r, { delaiVisa: null }).delaiVisa, 15);
  assert.equal(R.reglagesOperation(r, { delaiResoumission: 0 }).delaiResoumission, 15);
});

test('relances : dues tous les N jours tant que le retard dure', () => {
  const enRetard = doc([{ indice: 'A', recuLe: '2026-10-20', avis: [] }], { id: 'a' });
  const nouveau = doc([{ indice: 'A', recuLe: '2026-11-10', avis: [] }], { id: 'b', numero: 'GO-PEX-002' });
  let l = R.relancesAFaire([enRetard, nouveau], r, AUJ);
  assert.equal(l.length, 1); assert.equal(l[0].due, true); assert.equal(l[0].cible, 'viseurs');
  enRetard.relances.push({ date: '2026-11-08', cible: 'viseurs', indice: 'A' });
  l = R.relancesAFaire([enRetard], r, AUJ);
  assert.equal(l[0].due, false); assert.equal(l[0].prochaine, '2026-11-15');
  enRetard.relances[0].date = '2026-11-05';
  assert.equal(R.relancesAFaire([enRetard], r, AUJ)[0].due, true);
  // Une relance sur l'indice A ne vaut pas pour le nouvel indice attendu après A.
  const refuse = doc([{ indice: 'A', recuLe: '2026-10-01', avis: [avis('v', 'REF', '2026-10-20')] }], { relances: [{ date: '2026-11-10', cible: 'viseurs', indice: 'A' }] });
  const x = R.relancesAFaire([refuse], r, AUJ)[0];
  assert.equal(x.cible, 'emetteur'); assert.equal(x.due, true);
  assert.equal(R.indiceRelance(x.etat), '>A');
});

test('texte de relance', () => {
  const d = doc([{ indice: 'A', recuLe: '2026-10-20', avis: [] }], { viseurIds: ['v1', 'v2'] });
  const e = R.etatDocument(d, r, AUJ);
  const t = R.texteRelance({ operation: { nom: 'Bureaux Les Tilleuls' }, lot: { numero: '03', nom: 'Gros œuvre' }, doc: d, etat: e, viseurs: [{ id: 'v1', nom: 'Atelier fictif' }, { id: 'v2', nom: 'BET fictif' }], auj: AUJ });
  assert.equal(t.objet, 'Relance – Bureaux Les Tilleuls – Lot 03 Gros œuvre – GO-PEX-001 indice A');
  assert.match(t.corps, /reçu le 20\/10\/2026/);
  assert.match(t.corps, /depuis le 04\/11\/2026 \(8 j de retard\)/);
  assert.match(t.corps, /Avis en attente : Atelier fictif, BET fictif\./);
});

test('statistiques : taux de VSO au premier indice, délai moyen, avis par semaine', () => {
  const docs = [
    doc([{ indice: 'A', recuLe: '2026-10-01', avis: [avis('v', 'VSO', '2026-10-11')] }]),
    doc([{ indice: 'A', recuLe: '2026-10-01', avis: [avis('v', 'REF', '2026-10-21')] }, { indice: 'B', recuLe: '2026-11-02', avis: [avis('v', 'VSO', '2026-11-06')] }]),
    doc([{ indice: 'A', recuLe: '2026-11-05', avis: [] }]),
    doc([], { prevuLe: '2026-11-01' }),
  ];
  const s = R.statistiques(docs, r, AUJ);
  assert.equal(s.total, 4); assert.equal(s.clos, 2); assert.equal(s.enVisa, 1); assert.equal(s.attendus, 1); assert.equal(s.retards, 1);
  assert.equal(s.tauxVSO1, 50);
  assert.equal(s.delaiMoyen, 11.3); // (10 + 20 + 4) / 3
  assert.equal(s.horsDelai, 1);
  assert.equal(s.parSemaine.length, 12);
  assert.equal(s.parSemaine.at(-1).debut, '2026-11-09');
  assert.deepEqual(js(s.parSemaine.at(-2)), { debut: '2026-11-02', VSO: 1, VAO: 0, REF: 0 });
  assert.equal(s.parSemaine.reduce((n, w) => n + w.VSO + w.VAO + w.REF, 0), 3);
});

test('export CSV du registre', () => {
  const d = doc([{ indice: 'A', recuLe: '2026-10-20', avis: [] }], { titre: 'Plans "R+1"; coupes', viseurIds: ['v1'] });
  const csv = R.registreCSV({ docs: [d], lots: [{ id: 'l1', numero: '03', nom: 'Gros œuvre', entreprise: 'Entreprise A' }], viseurs: [{ id: 'v1', nom: 'BET fictif' }], r, auj: AUJ });
  assert.ok(csv.startsWith('﻿Lot;Intitulé du lot;Entreprise;Numéro;Titre'));
  const ligne = csv.split('\r\n')[1];
  assert.equal(ligne, '03;Gros œuvre;Entreprise A;GO-PEX-001;"Plans ""R+1""; coupes";PEX;A;20/10/2026;04/11/2026;;En cours de visa;8;BET fictif;1;');
});

test('base intégrée cohérente', () => {
  assert.deepEqual(js(B.avis.map((a) => a.code)), ['VSO', 'VAO', 'REF']);
  assert.equal(B.lots.length, 18);
  const codes = new Set(B.types.map((t) => t.code));
  for (const l of B.lots) for (const [, t] of l.docs) assert.ok(codes.has(t), `${l.code} : type ${t}`);
  assert.equal(new Set(B.lots.map((l) => l.code)).size, B.lots.length);
});
