// Tests des règles métier de la conformité des sous-traitants (templates/sous-traitants/regles.js et donnees.js).
// Date de référence fixe : les résultats ne dépendent jamais du jour où les tests tournent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/sous-traitants/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-14';

// Opération fictive : titulaire T (gros œuvre), sous-traitant S1 (rang 1), sous-traitant S2 (rang 2 de S1).
function etat(o = {}) {
  const E = R.etatVide(B);
  E.operations = [{ id: 'op1', nom: 'Résidence A', maitreOuvrage: 'MO fictif', reference: '', ville: '', debut: '2026-01-05', fin: '2027-06-30', marchePublic: false, close: false, notes: '' }];
  E.entreprises = [
    { id: 'eT', nom: 'Titulaire fictif', siret: '', ville: '', etranger: false, employeur: true, contact: '', email: '', telephone: '', notes: '' },
    { id: 'eS1', nom: 'Sous-traitant un', siret: '', ville: '', etranger: false, employeur: true, contact: '', email: '', telephone: '', notes: '' },
    { id: 'eS2', nom: 'Sous-traitant deux', siret: '', ville: '', etranger: false, employeur: false, contact: '', email: '', telephone: '', notes: '' },
  ];
  E.intervenants = [
    { id: 'iT', operationId: 'op1', entrepriseId: 'eT', lot: '02 Gros œuvre', donneurId: '', objet: '', montantHT: 800000, debut: '2026-02-01', fin: '', decennale: true, acceptation: 'a-declarer', dateDemande: '', dateAcceptation: '', paiementAgree: false, paiementDirect: false, notes: '' },
    { id: 'iS1', operationId: 'op1', entrepriseId: 'eS1', lot: '02 Gros œuvre', donneurId: 'iT', objet: 'Ferraillage', montantHT: 60000, debut: '2026-03-01', fin: '', decennale: true, acceptation: 'accepte', dateDemande: '2026-02-10', dateAcceptation: '2026-02-20', paiementAgree: true, paiementDirect: false, notes: '' },
    { id: 'iS2', operationId: 'op1', entrepriseId: 'eS2', lot: '02 Gros œuvre', donneurId: 'iS1', objet: 'Pose', montantHT: 3000, debut: '2026-12-01', fin: '', decennale: false, acceptation: 'demande', dateDemande: '2026-11-01', dateAcceptation: '', paiementAgree: false, paiementDirect: false, notes: '' },
  ];
  const p = (id, ent, type, date, fin = '') => ({ id, entrepriseId: ent, type, date, fin, recueLe: date, verifiee: true, reference: '', notes: '' });
  E.pieces = [
    p('p1', 'eT', 'VIG', '2026-08-01'), p('p2', 'eT', 'KBS', '2026-08-01'), p('p3', 'eT', 'ETR', '2026-08-01'), p('p4', 'eT', 'DEC', '2026-01-01', '2026-12-31'),
    p('p5', 'eS1', 'VIG', '2026-05-20'), p('p6', 'eS1', 'KBS', '2026-06-10'), p('p7', 'eS1', 'DEC', '2026-01-01', '2026-12-31'),
  ];
  return Object.assign(E, o);
}

test('base intégrée : types de pièces uniques, sources datées, portées connues', () => {
  const codes = B.typesPieces.map((t) => t.code);
  assert.equal(new Set(codes).size, codes.length);
  const portees = B.portees.map((p) => p.code);
  for (const t of B.typesPieces) {
    assert.ok(portees.includes(t.portee), t.code);
    assert.ok(['emission', 'fin'].includes(t.depart), t.code);
    if (t.source) assert.ok(B.sources.some((s) => s.code === t.source), `source de ${t.code}`);
  }
  for (const s of B.sources) assert.match(s.url, /^https:\/\/(entreprendre\.service-public\.gouv\.fr|www\.urssaf\.fr|www\.legifrance\.gouv\.fr|code\.travail\.gouv\.fr)\//);
  assert.ok(R.estDate(B.verifieLe));
  assert.equal(B.seuilVigilance, 5000);
  assert.deepEqual([B.alerteJ30, B.alerteJ15], [30, 15]);
  assert.equal(B.typesPieces.find((t) => t.code === 'VIG').validiteMois, 6);
});

test('dates : ajout de mois borné à la fin du mois', () => {
  assert.equal(R.ajoutMois('2026-08-31', 6), '2027-02-28');
  assert.equal(R.ajoutMois('2026-05-20', 6), '2026-11-20');
  assert.equal(R.ecart('2026-11-14', '2026-11-20'), 6);
});

test('échéance d\'une pièce : date de fin saisie prioritaire, sinon délivrance + validité', () => {
  const vig = B.typesPieces.find((t) => t.code === 'VIG');
  assert.equal(R.echeancePiece({ date: '2026-05-20', fin: '' }, vig), '2026-11-20');
  assert.equal(R.echeancePiece({ date: '2026-05-20', fin: '2026-10-01' }, vig), '2026-10-01');
  assert.equal(R.echeancePiece({ date: '', fin: '' }, vig), '');
});

test('état d\'une échéance : expirée, J-15, J-30, valide, manquante', () => {
  const rg = { j30: 30, j15: 15 };
  assert.equal(R.etatEcheance('2026-11-13', AUJ, rg), 'expiree');
  assert.equal(R.etatEcheance('2026-11-14', AUJ, rg), 'j15');
  assert.equal(R.etatEcheance('2026-11-29', AUJ, rg), 'j15');
  assert.equal(R.etatEcheance('2026-11-30', AUJ, rg), 'j30');
  assert.equal(R.etatEcheance('2026-12-14', AUJ, rg), 'j30');
  assert.equal(R.etatEcheance('2026-12-15', AUJ, rg), 'valide');
  assert.equal(R.etatEcheance('', AUJ, rg), 'manquante');
});

test('pièce courante : la plus tardive des pièces d\'un même type', () => {
  const E = etat();
  E.pieces.push({ id: 'p9', entrepriseId: 'eS1', type: 'VIG', date: '2026-11-10', fin: '', recueLe: '', verifiee: false, reference: '', notes: '' });
  assert.equal(R.pieceCourante(E, 'eS1', 'VIG').p.id, 'p9');
  assert.equal(R.pieceCourante(E, 'eS2', 'VIG'), null);
});

test('rang dans la chaîne de sous-traitance, cycle sans boucle infinie', () => {
  const E = etat();
  assert.deepEqual(E.intervenants.map((i) => R.rang(E, i)), [0, 1, 2]);
  E.intervenants[0].donneurId = 'iS2';
  assert.ok(R.rang(E, E.intervenants[0]) <= 3);
});

test('pièces exigées : seuil de vigilance, employeur, décennale, facultatif', () => {
  const E = etat();
  const codes = (id) => R.piecesExigees(E, E.intervenants.find((i) => i.id === id)).map((t) => t.code);
  assert.deepEqual(codes('iT'), ['VIG', 'KBS', 'ETR', 'DEC']);
  assert.deepEqual(codes('iS2'), [], 'sous le seuil, sans décennale');
  E.intervenants[2].montantHT = 5000;
  assert.deepEqual(codes('iS2'), ['VIG', 'KBS'], 'au seuil ; pas de salariés : pas de liste');
  E.intervenants[2].montantHT = '';
  assert.deepEqual(codes('iS2'), ['VIG', 'KBS'], 'montant inconnu : exigé par prudence');
  E.reglages.seuil = 10000; E.intervenants[2].montantHT = 6000;
  assert.deepEqual(codes('iS2'), [], 'seuil paramétrable');
  E.reglages.types.find((t) => t.code === 'RCP').portee = 'toujours';
  assert.deepEqual(codes('iS2'), ['RCP']);
});

test('acceptation : titulaire sans objet, accepté, paiement à agréer, attente, manquante, refus', () => {
  const E = etat();
  const [iT, iS1, iS2] = E.intervenants;
  assert.equal(R.etatAcceptation(E, iT, AUJ), 'sans-objet');
  assert.equal(R.etatAcceptation(E, iS1, AUJ), 'ok');
  assert.equal(R.etatAcceptation(E, iS2, AUJ), 'attente', 'début dans le futur');
  assert.equal(R.etatAcceptation(E, iS2, '2026-12-01'), 'manquante', 'a commencé sans acceptation');
  iS1.paiementAgree = false;
  assert.equal(R.etatAcceptation(E, iS1, AUJ), 'partielle');
  iS1.acceptation = 'refuse';
  assert.equal(R.etatAcceptation(E, iS1, AUJ), 'refuse');
});

test('conformité : pièces et acceptation combinées, intervention terminée hors suivi', () => {
  const E = etat();
  const c = (id, auj = AUJ) => R.conformite(E, E.intervenants.find((i) => i.id === id), auj);
  // Titulaire : vigilance du 01/08 → 01/02/2027 (valide), décennale au 31/12 (J-47) : conforme.
  assert.equal(c('iT').niveau, 'conforme');
  // S1 : vigilance du 20/05 → 20/11 (J-6), pas de liste salariés étrangers : non conforme.
  const s1 = c('iS1');
  assert.equal(s1.niveau, 'non-conforme');
  assert.deepEqual(s1.pieces.map((p) => [p.type.code, p.etat]), [['VIG', 'j15'], ['KBS', 'j30'], ['ETR', 'manquante'], ['DEC', 'valide']]);
  assert.equal(s1.manques, 1);
  assert.equal(s1.prochaine, '2026-11-20');
  // S2 : rien d'exigé, acceptation en attente : à surveiller.
  assert.equal(c('iS2').niveau, 'a-surveiller');
  E.intervenants[1].fin = '2026-10-31';
  assert.equal(c('iS1').niveau, 'terminee');
  E.operations[0].close = true;
  assert.equal(c('iT').niveau, 'terminee');
});

test('tableau d\'opération : ordre par chaîne, comptes et taux', () => {
  const E = etat();
  const t = R.tableauOperation(E, 'op1', AUJ);
  assert.deepEqual(t.lignes.map((l) => l.intervenant.id), ['iT', 'iS1', 'iS2']);
  assert.deepEqual([t.total, t.conformes, t.surveiller, t.nonConformes], [3, 1, 1, 1]);
  assert.equal(Math.round(t.taux * 100), 33);
});

test('alertes : une par pièce et par entreprise, plus grave d\'abord, acceptation en attente', () => {
  const E = etat();
  // Deuxième opération pour S1 : l'alerte de pièce n'est pas dupliquée.
  E.operations.push({ ...E.operations[0], id: 'op2', nom: 'Bureaux B' });
  E.intervenants.push({ ...E.intervenants[1], id: 'iS1b', operationId: 'op2', donneurId: '' });
  const a = R.alertes(E, AUJ);
  assert.deepEqual(a.map((x) => `${x.genre}:${x.entrepriseId}:${x.code || x.etat}`), ['piece:eS1:ETR', 'piece:eS1:VIG', 'piece:eS1:KBS', 'acceptation:eS2:attente']);
  assert.deepEqual(a[0].operationIds, ['op1', 'op2']);
  assert.equal(a[0].gravite, 'rouge');
  assert.equal(a[1].jours, 6);
});

test('relances : entreprises à relancer, délai entre deux relances, texte du modèle', () => {
  const E = etat({ structure: 'Entreprise générale fictive' });
  assert.deepEqual(R.aRelancer(E, AUJ).map((x) => [x.entrepriseId, x.codes, x.pire]), [['eS1', ['ETR', 'VIG', 'KBS'], 'rouge']]);
  E.relances.push({ id: 'r1', entrepriseId: 'eS1', date: '2026-11-10', types: ['VIG'], canal: 'E-mail', notes: '' });
  assert.equal(R.aRelancer(E, AUJ).length, 0, 'relancée il y a 4 jours');
  assert.equal(R.aRelancer(E, '2026-11-17').length, 1, '7 jours après');
  assert.equal(R.derniereRelance(E, 'eS1'), '2026-11-10');
  const t = R.texteRelance(E, 'eS1', ['ETR', 'VIG'], ['op1'], AUJ);
  assert.equal(t.objet, 'Pièces administratives à transmettre : Sous-traitant un');
  assert.match(t.corps, /- Liste nominative des salariés étrangers soumis à autorisation de travail \(à transmettre\)/);
  assert.match(t.corps, /- Attestation de vigilance Urssaf \(expire le 20\/11\/2026\)/);
  assert.match(t.corps, /Opérations concernées : Résidence A\./);
  assert.match(t.corps, /Entreprise générale fictive$/);
});

test('CSV : registre et pièces au format tableur, formules neutralisées', () => {
  const E = etat();
  E.entreprises[1].nom = '=Sous-traitant';
  const csv = R.csvRegistre(E, AUJ, 'op1');
  assert.ok(csv.startsWith('﻿Opération;Lot;Entreprise'));
  const l = csv.trim().split('\r\n');
  assert.equal(l.length, 4);
  assert.match(l[1], /^Résidence A;02 Gros œuvre;Titulaire fictif;;Titulaire;Maître d'ouvrage;;800000;01\/02\/2026;;Titulaire;/);
  assert.match(l[2], /;'=Sous-traitant;;Rang 1;Titulaire fictif;Ferraillage;60000;.*Accepté, paiement agréé;.*;oui;non;Salariés étrangers \(manquante\);20\/11\/2026;Non conforme$/);
  const p = R.csvPieces(E, AUJ).trim().split('\r\n');
  assert.equal(p.length, 1 + E.pieces.length);
  assert.ok(p.some((x) => x.includes("'=Sous-traitant;Attestation de vigilance Urssaf;20/05/2026;20/11/2026;Expire très bientôt;20/05/2026;oui")));
});

test('normaliser : état vide, anciennes données, réglages bornés, types conservés', () => {
  const v = R.normaliser(null, B);
  assert.equal(v.reglages.types.length, B.typesPieces.length);
  assert.deepEqual([v.operations, v.entreprises, v.intervenants, v.pieces, v.relances].map((x) => x.length), [0, 0, 0, 0, 0]);
  const n = R.normaliser({ reglages: { j30: 10, j15: 20, seuil: 'x', types: [{ code: 'X1', nom: 'Pièce libre', portee: 'bizarre', depart: 'zz', validiteMois: 0 }] },
    intervenants: [{ id: 'a', entrepriseId: 'e' }, { pasDId: true }], relances: [{ id: 'r', types: 'VIG' }] }, B);
  assert.equal(n.reglages.j15, 10, 'J-15 jamais au-delà de J-30');
  assert.equal(n.reglages.seuil, 5000);
  assert.deepEqual(n.reglages.types.map((t) => [t.code, t.portee, t.depart, t.validiteMois]), [['X1', 'facultatif', 'emission', 6]]);
  assert.equal(n.intervenants.length, 1);
  assert.equal(n.intervenants[0].acceptation, 'a-declarer');
  assert.equal(n.intervenants[0].decennale, true);
  assert.deepEqual(n.relances[0].types, []);
  assert.ok(R.taille(n) > 100);
});
