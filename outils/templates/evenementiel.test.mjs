// Tests des règles métier du pilote événementiel (templates/evenementiel/regles.js et donnees.js).
// Aucune dépendance à la date du jour : « aujourd'hui » est fixé dans chaque test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/evenementiel/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.EVT;
const B = globalThis.window.BASE;
const AUJ = '2026-11-13';
let n = 0;
const uid = () => `id${++n}`;

test('base intégrée : 3 rétroplannings et conducteurs types, postes sans montant, phases connues', () => {
  for (const type of ['seminaire', 'salon', 'lancement']) {
    const r = B.retroplannings[type];
    assert.ok(r.length >= 20, type);
    for (const [titre, phase, avant] of r) {
      assert.ok(titre && B.phases.some((p) => p.id === phase), `${type} : ${titre}`);
      assert.ok(Number.isInteger(avant), titre);
    }
    assert.equal(new Set(r.map((x) => x[0])).size, r.length, `${type} : titres uniques`);
    for (const [h, d, titre] of B.conducteurs[type]) assert.ok(R.minutes(h) !== null && d > 0 && titre, titre);
    assert.ok(B.postesParType[type].every((i) => B.postes[i]), type);
  }
  assert.equal(B.retroplannings.seminaire.length, 24);
  assert.equal(B.retroplannings.salon.length, 26);
  assert.equal(B.retroplannings.lancement.length, 24);
  assert.equal(B.postes.length, 20);
  assert.ok(B.postes.every((p) => typeof p === 'string' && !/\d/.test(p)), 'aucun montant dans les postes');
  assert.equal(B.checklist.length, 20);
  assert.ok(B.rgpd.url.startsWith('https://www.cnil.fr/'));
  assert.ok(B.categories.every((c) => B.couleurs.some((x) => x.id === c.couleur)));
});

test('montants : lecture à la française, centimes, découpage acompte / solde', () => {
  assert.equal(R.lireMontant('1 250,50 €'), 125050);
  assert.equal(R.lireMontant('1250.5'), 125050);
  assert.equal(R.lireMontant('12'), 1200);
  assert.equal(R.lireMontant(''), 0);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.lireMontant('-5'), -500);
  assert.equal(R.champMontant(125050), '1250,5');
  assert.deepEqual(R.decouper(1000001, 30), [300000, 700001]);
  assert.deepEqual(R.decouper(10000, 50), [5000, 5000]);
  assert.equal(R.decouper(10000, 0), null);
  assert.equal(R.decouper(10000, 100), null);
});

test('rétroplanning : échéance relative, décalage de l\'événement, date fixe, statut, période', () => {
  const evt = { id: 'e', date: '2027-03-15' };
  const t = { avant: 45, faite: null };
  assert.equal(R.echeance(t, evt), '2027-01-29');
  assert.equal(R.echeance(t, { ...evt, date: '2027-03-22' }), '2027-02-05'); // l'événement décale la tâche
  assert.equal(R.echeance({ ...t, dateFixe: '2027-01-02' }, { ...evt, date: '2027-03-22' }), '2027-01-02');
  assert.equal(R.echeance({ avant: -7 }, evt), '2027-03-22');
  assert.deepEqual(R.statutTache(t, evt, '2027-02-01'), { statut: 'retard', retard: 3 });
  assert.deepEqual(R.statutTache(t, evt, '2027-01-29'), { statut: 'semaine', retard: 0 });
  assert.deepEqual(R.statutTache(t, evt, '2027-01-22'), { statut: 'semaine', retard: 0 });
  assert.deepEqual(R.statutTache(t, evt, '2027-01-21'), { statut: 'avenir', retard: 0 });
  assert.equal(R.statutTache({ ...t, faite: '2027-02-10' }, evt, '2027-03-01').statut, 'faite');
  const P = B.periodes;
  assert.equal(P[R.periode({ avant: 180 }, evt, P)].nom, '6 mois et plus avant');
  assert.equal(P[R.periode({ avant: 179 }, evt, P)].nom, '3 à 6 mois avant');
  assert.equal(P[R.periode({ avant: 30 }, evt, P)].nom, '1 à 3 mois avant');
  assert.equal(P[R.periode({ avant: 7 }, evt, P)].nom, 'Dernière semaine');
  assert.equal(P[R.periode({ avant: 0 }, evt, P)].nom, 'Jour J');
  assert.equal(P[R.periode({ avant: -3 }, evt, P)].nom, 'Après l\'événement');
  assert.equal(R.libelleRelatif(12), 'J-12');
  assert.equal(R.libelleRelatif(0), 'Jour J');
  assert.equal(R.libelleRelatif(-5), 'J+5');
});

test('compte à rebours et fin d\'un événement de plusieurs jours', () => {
  const evt = { date: '2026-11-20', nbJours: 3 };
  assert.equal(R.finEvenement(evt), '2026-11-22');
  assert.equal(R.compteRebours(evt, AUJ), 'J-7');
  assert.equal(R.compteRebours(evt, '2026-11-20'), 'Jour J');
  assert.equal(R.compteRebours(evt, '2026-11-21'), 'Jour 2');
  assert.equal(R.compteRebours(evt, '2026-11-22'), 'Jour 3');
  assert.equal(R.compteRebours(evt, '2026-11-23'), 'Terminé');
  assert.equal(R.evenementPasse(evt, '2026-11-22'), false);
  assert.equal(R.evenementPasse(evt, '2026-11-23'), true);
  assert.equal(R.finEvenement({ date: '2026-11-20' }), '2026-11-20');
});

test('modèle appliqué à un événement proche : garder, ramener à aujourd\'hui, ignorer ; pas de doublon', () => {
  const evt = { id: 'e1', date: '2026-12-13' }; // J-30
  const lignes = [['A', 'cadrage', 60], ['B', 'lieu', 30], ['C', 'jourj', 0]];
  const g = R.tachesDepuisModele(lignes, evt, AUJ, 'garder', [], uid);
  assert.equal(g.passees, 1);
  assert.equal(g.taches.length, 3);
  assert.equal(g.taches[0].dateFixe, null);
  assert.equal(R.statutTache(g.taches[0], evt, AUJ).retard, 30);
  const a = R.tachesDepuisModele(lignes, evt, AUJ, 'aujourdhui', [], uid);
  assert.equal(a.taches[0].dateFixe, AUJ);
  assert.equal(a.taches[1].dateFixe, null); // échéance = aujourd'hui, pas passée
  const i = R.tachesDepuisModele(lignes, evt, AUJ, 'ignorer', [], uid);
  assert.deepEqual(i.taches.map((t) => t.titre), ['B', 'C']);
  const d = R.tachesDepuisModele(lignes, evt, AUJ, 'garder', [{ evtId: 'e1', titre: 'b ' }, { evtId: 'autre', titre: 'C' }], uid);
  assert.deepEqual(d.taches.map((t) => t.titre), ['A', 'C']);
});

function etat() {
  return {
    evenements: [{ id: 'e1', nom: 'Séminaire', date: '2026-12-10', budgetCible: 2000000 }, { id: 'e2', nom: 'Salon', date: '2027-03-01' }],
    taches: [
      { id: 't1', evtId: 'e1', titre: 'Lieu', avant: 40, responsable: 'Inès', faite: null }, // 2026-10-31 : retard 13 j
      { id: 't2', evtId: 'e1', titre: 'Traiteur', avant: 25, responsable: 'Inès', faite: null }, // 2026-11-15 : semaine
      { id: 't3', evtId: 'e1', titre: 'Badges', avant: 4, responsable: '', faite: null },
      { id: 't4', evtId: 'e1', titre: 'Cadrage', avant: 60, responsable: 'Marc', faite: '2026-10-10' },
      { id: 't5', evtId: 'e2', titre: 'Stand', avant: 120, responsable: 'Marc', faite: null }, // 2026-11-01 : retard
    ],
    postes: [
      { id: 'p1', evtId: 'e1', nom: 'Lieu', prevu: 800000 },
      { id: 'p2', evtId: 'e1', nom: 'Restauration', prevu: 600000 },
      { id: 'p3', evtId: 'e1', nom: 'Imprévus', prevu: 0 },
    ],
    contrats: [
      { id: 'c1', evtId: 'e1', posteId: 'p1', montant: 900000, statut: 'signe', echeances: [
        { id: 'x1', montant: 270000, date: '2026-10-01', payeLe: '2026-10-02' },
        { id: 'x2', montant: 630000, date: '2026-12-20', payeLe: null }] },
      { id: 'c2', evtId: 'e1', posteId: 'p2', montant: 550000, statut: 'devis', echeances: [] }, // non signé : pas engagé
      { id: 'c3', evtId: 'e1', posteId: 'p2', montant: 300000, statut: 'annule', echeances: [{ id: 'x3', montant: 50000, date: '2026-09-01', payeLe: '2026-09-01' }] },
      { id: 'c4', evtId: 'e1', posteId: null, montant: 120000, statut: 'signe', echeances: [{ id: 'x4', montant: 120000, date: '2026-11-10', payeLe: null }] },
      { id: 'c5', evtId: 'e2', posteId: null, montant: 400000, statut: 'signe', echeances: [{ id: 'x5', montant: 100000, date: '2026-11-25', payeLe: null }] },
    ],
    invites: [],
  };
}

test('budget par poste : engagé = signés, payé compte un acompte d\'un contrat annulé, non affecté', () => {
  const b = R.budget(etat(), 'e1');
  const [lieu, resto, imprevus] = b.lignes;
  assert.deepEqual([lieu.prevu, lieu.engage, lieu.paye, lieu.reste, lieu.ecart, lieu.depassement], [800000, 900000, 270000, 630000, 100000, true]);
  assert.deepEqual([resto.engage, resto.paye, resto.reste, resto.ecart, resto.depassement], [0, 50000, 0, -600000, false]);
  assert.equal(imprevus.depassement, false);
  assert.deepEqual([b.nonAffecte.engage, b.nonAffecte.paye, b.nonAffecte.reste], [120000, 0, 120000]);
  assert.deepEqual(b.total, { prevu: 1400000, engage: 1020000, paye: 320000, reste: 750000, ecart: -380000 });
  assert.equal(R.infoContrat(etat().contrats[0]).aPlanifier, 0);
  assert.equal(R.infoContrat({ statut: 'signe', montant: 1000, echeances: [{ montant: 300 }] }).aPlanifier, 700);
  assert.equal(R.infoContrat({ statut: 'devis', montant: 1000, echeances: [] }).aPlanifier, 0);
});

test('échéancier : non payées, hors contrats annulés, retard et proche (14 jours)', () => {
  const E = etat();
  const tout = R.echeancier(E, AUJ);
  assert.deepEqual(tout.map((e) => [e.echeance.id, e.etat, e.jours]), [['x4', 'retard', -3], ['x5', 'proche', 12], ['x2', 'avenir', 37]]);
  assert.deepEqual(R.echeancier(E, AUJ, 'e2').map((e) => e.echeance.id), ['x5']);
});

test('tableau de bord : résumé, alertes triées, charge par responsable', () => {
  const E = etat();
  const r = R.resumeEvenement(E, E.evenements[0], AUJ);
  assert.deepEqual([r.jours, r.rebours, r.taches, r.faites, r.retard, r.semaine, r.avancement], [27, 'J-27', 4, 1, 1, 1, 25]);
  assert.equal(r.depassements, 1);
  assert.equal(r.echeancesRetard, 1);
  const a = R.alertes(E, AUJ);
  assert.deepEqual(a.map((x) => [x.gravite, x.type, x.evt.id]), [
    [0, 'taches', 'e1'], [0, 'taches', 'e2'], [0, 'paiement', 'e1'],
    [1, 'paiement', 'e2'], [1, 'budget', 'e1'], [1, 'planifier', 'e2'],
  ]);
  const c = R.chargeResponsables(E, AUJ);
  assert.deepEqual(c.map((x) => [x.nom, x.ouvertes, x.retard, x.semaine]), [['Inès', 2, 1, 1], ['Marc', 1, 1, 0], ['Sans responsable', 1, 0, 0]]);
  assert.deepEqual(R.chargeResponsables(E, AUJ, 'e2').map((x) => x.nom), ['Marc']);
});

test('invités : réponses, catégories, régimes sur les couverts, accessibilité, présence', () => {
  const L = [
    { reponse: 'oui', categorie: 'client', regime: 'Végétarien', present: true },
    { reponse: 'oui', categorie: 'client', regime: '', accessibilite: 'Fauteuil roulant', present: false },
    { reponse: 'attente', categorie: 'presse', regime: 'Végétarien' },
    { reponse: 'non', categorie: 'presse', regime: 'Sans porc', accessibilite: 'x' },
  ];
  const s = R.statsInvites(L, B.regimes);
  assert.deepEqual([s.total, s.oui, s.attente, s.non, s.couverts, s.presents, s.tauxPresence], [4, 2, 1, 1, 3, 1, 50]);
  assert.deepEqual(s.regimes, { 'Végétarien': 2, 'Sans restriction': 1 });
  assert.equal(s.accessibilite.length, 1);
  assert.deepEqual(s.parCategorie.presse, { oui: 0, non: 1, attente: 1, total: 2 });
  assert.equal(R.statsInvites([], B.regimes).tauxPresence, null);
  const inv = [{ evtId: 'a', regime: 'Végétarien', accessibilite: '' }, { evtId: 'a', regime: '', accessibilite: '' }, { evtId: 'b', regime: 'Végétalien' }];
  assert.equal(R.effacerSensibles(inv, 'a'), 1);
  assert.equal(inv[0].regime, '');
  assert.equal(inv[2].regime, 'Végétalien');
});

test('invités : saisie rapide, badges par pages de 8 triés, CSV échappé avec BOM', () => {
  assert.deepEqual(R.lireInvitesRapides('Anne-Lise de Vries ; Société A ; DG\nBRUN\n\n  Paul Martin\tB'), [
    { prenom: 'Anne-Lise de', nom: 'Vries', societe: 'Société A', fonction: 'DG' },
    { prenom: '', nom: 'BRUN', societe: '', fonction: '' },
    { prenom: 'Paul', nom: 'Martin', societe: 'B', fonction: '' },
  ]);
  const L = Array.from({ length: 19 }, (_, i) => ({ nom: `N${String(i).padStart(2, '0')}`, prenom: 'x', reponse: i === 3 ? 'non' : 'oui' }));
  const p = R.pagesBadges(L);
  assert.deepEqual(p.map((x) => x.length), [8, 8, 2]);
  assert.equal(p[0][3].nom, 'N04');
  const csv = R.csvInvites([{ nom: 'Durand', prenom: 'Léa', societe: 'A; B', fonction: 'Dir "com"', categorie: 'client', reponse: 'oui', present: true, regime: 'Végétarien' }], () => 'Client', false);
  assert.ok(csv.startsWith('﻿Nom;Prénom;'));
  assert.ok(csv.includes('Durand;Léa;"A; B";"Dir ""com""";;Client;Oui;Oui\r\n'));
  assert.ok(!csv.includes('Végétarien'));
  assert.ok(R.csvInvites([{ nom: 'X', regime: 'Végétarien' }], () => '', true).includes('Végétarien'));
});

test('conducteur : fin, tri, chevauchement par lieu, décalage en cascade, séquence en cours', () => {
  const items = [
    { id: 'a', heure: '18:30', duree: 45, lieu: 'Hall' },
    { id: 'b', heure: '19:00', duree: 20, lieu: 'Scène' },
    { id: 'c', heure: '19:10', duree: 10, lieu: 'Scène' }, // chevauche b
    { id: 'd', heure: '19:15', duree: 30, lieu: 'hall ' }, // ne chevauche pas a (fin 19:15)
    { id: 'e', heure: '09:00', duree: 30, jour: 2 },
  ];
  const c = R.conducteur(items);
  assert.deepEqual(c.map((x) => x.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(R.hm(c[0].fin), '19:15');
  assert.deepEqual(c.map((x) => x.chevauche), [null, null, 'b', null, null]);
  assert.equal(R.conducteur([{ id: 'x', heure: '10:00', duree: 60 }, { id: 'y', heure: '10:30', duree: 5, lieu: 'Salle' }])[1].chevauche, 'x'); // sans lieu = partout
  assert.deepEqual(R.decaler(items, 'b', 15), { b: '19:15', c: '19:25', d: '19:30' });
  assert.deepEqual(R.decaler(items, 'b', -30), { b: '18:30', c: '18:40', d: '18:45' });
  assert.equal(typeof R.decaler([{ id: 'z', heure: '23:30', duree: 20 }], 'z', 15), 'string');
  assert.equal(typeof R.decaler(items, 'b', 0), 'string');
  assert.equal(R.minutes('24:00'), null);
  assert.equal(R.minutes('7:05'), 425);
  const ec = R.enCours(items, 1, R.minutes('19:12'));
  assert.equal(ec.courante.id, 'c');
  assert.equal(ec.suivante.id, 'd');
  assert.equal(R.enCours(items, 1, R.minutes('23:00')).suivante, null);
});

test('dates : fin de mois, années bissextiles, format français', () => {
  assert.equal(R.ajout('2028-02-28', 1), '2028-02-29');
  assert.equal(R.ajout('2027-02-28', 1), '2027-03-01');
  assert.equal(R.ecart('2026-12-31', '2027-01-01'), 1);
  assert.equal(R.ajout('2026-10-25', 1), '2026-10-26'); // changement d'heure
  assert.equal(R.dateFr('2026-11-13'), '13/11/2026');
  assert.equal(R.estDate('2026-02-30'), false);
});
