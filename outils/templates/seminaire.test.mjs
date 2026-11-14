// Tests des règles métier du template séminaire / offsite (templates/seminaire/regles.js et donnees.js).
// Aucune dépendance à la date du jour : « aujourd'hui » est fixé dans chaque test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/seminaire/', import.meta.url);
globalThis.window = globalThis.window || {};
const avant = globalThis.window.BASE;
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.SMN;
const B = globalThis.window.BASE;
if (avant) globalThis.window.BASE = avant;
const AUJ = '2026-11-14';
const SEM = { id: 's1', nom: 'Offsite', date: '2027-03-10', nbJours: 2, lieu: 'Domaine', limite: '2027-02-20', budgetCible: 0 };
const P = (id, o = {}) => ({ id: String(id), semId: 's1', prenom: `P${id}`, nom: `N${id}`, service: '', email: '', role: 'participant', reponse: 'oui', hebergement: true, allerId: '', retourId: '', chambreId: '', regime: '', allergie: false, accessibilite: false, note: '', ...o });

test('base intégrée : listes fermées, programmes valides, postes sans montant, types connus', () => {
  assert.deepEqual(B.regimes, ['Sans restriction', 'Végétarien', 'Végétalien', 'Sans porc', 'Sans alcool']);
  assert.ok(!B.regimes.some((r) => /gluten|allerg|autre/i.test(r)), 'aucune donnée de santé ni champ « autre »');
  for (const [k, prog] of Object.entries(B.programmes)) {
    for (const [jour, h, d, titre, type] of prog.sessions) {
      assert.ok(Number.isInteger(jour) && jour >= 1, `${k} : ${titre}`);
      assert.ok(R.minutes(h) !== null && d > 0 && titre, `${k} : ${titre}`);
      assert.ok(B.sessions.some((s) => s.id === type), `${k} : type ${type}`);
    }
  }
  const p2 = R.programme(B.programmes.deuxjours.sessions.map(([jour, heure, duree, titre, type, salle], i) => ({ id: `x${i}`, jour, heure, duree, titre, type, salle })));
  assert.equal(p2.filter((x) => x.chevauche).length, 0, 'le programme type n\'a aucun chevauchement de salle');
  assert.equal(B.postes.length, 12);
  assert.ok(B.postes.every((p) => !/\d/.test(p)), 'aucun montant dans les postes');
  assert.ok(B.sessions.every((s) => B.couleurs.some((c) => c.id === s.couleur)));
  assert.ok(B.chambres.every((c) => c.capacite >= 1));
  assert.ok(B.rgpd.url.startsWith('https://www.cnil.fr/'));
});

test('dates, montants, séminaire : fin, nuits, compte à rebours', () => {
  assert.equal(R.finSeminaire(SEM), '2027-03-11');
  assert.equal(R.nuits(SEM), 1);
  assert.equal(R.nuits({ date: '2027-03-10', nbJours: 1 }), 0);
  assert.equal(R.compteRebours(SEM, '2027-03-08'), 'J-2');
  assert.equal(R.compteRebours(SEM, '2027-03-10'), 'Jour 1');
  assert.equal(R.compteRebours(SEM, '2027-03-11'), 'Jour 2');
  assert.equal(R.compteRebours(SEM, '2027-03-12'), 'Terminé');
  assert.ok(R.seminairePasse(SEM, '2027-03-12') && !R.seminairePasse(SEM, '2027-03-11'));
  assert.equal(R.lireMontant('1 250,50 €'), 125050);
  assert.equal(R.lireMontant('12.5'), 1250);
  assert.equal(R.lireMontant(''), 0);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.champMontant(125050), '1250,5');
  assert.ok(!R.estDate('2027-02-30') && R.estDate('2027-02-28'));
});

test('participants : réponses, couverts, régimes et données sensibles comptés sans nom', () => {
  const l = [P(1, { regime: 'Végétarien' }), P(2, { reponse: 'attente', allergie: true }), P(3, { reponse: 'non', regime: 'Végétalien', allergie: true }), P(4, { regime: 'Inconnu', accessibilite: true }), P(5, { service: 'Ventes' })];
  const s = R.statsParticipants(l, B.regimes);
  assert.equal(s.total, 5);
  assert.equal(s.oui, 3); assert.equal(s.attente, 1); assert.equal(s.non, 1);
  assert.equal(s.couverts, 4, 'oui + en attente');
  assert.equal(s.tauxReponse, 80);
  assert.equal(s.regimes['Sans restriction'], 3, 'non renseigné et valeur hors liste comptés sans restriction');
  assert.equal(s.regimes['Végétarien'], 1);
  assert.equal(s.regimes['Végétalien'], 0, 'un « non » n\'est pas compté');
  assert.equal(s.allergies, 1);
  assert.equal(s.accessibilite, 1);
  assert.equal(s.parService.Ventes.oui, 1);
  assert.equal(s.parService['Sans service'].total, 4);
});

test('fiche traiteur : nombres seulement, repas du programme, CSV sans aucun nom', () => {
  const l = [P(1, { prenom: 'Aline', nom: 'Zorro', regime: 'Végétarien' }), P(2, { prenom: 'Bruno', nom: 'Yole', allergie: true, reponse: 'attente' }), P(3, { reponse: 'non' })];
  const sessions = [{ id: 'a', jour: 1, heure: '12:30', duree: 60, titre: 'Déjeuner', type: 'repas', salle: 'Restaurant' }, { id: 'b', jour: 2, heure: '08:00', duree: 60, titre: 'Petit déjeuner', type: 'repas', salle: '' }, { id: 'c', jour: 1, heure: '09:00', duree: 60, titre: 'Plénière', type: 'pleniere' }];
  const t = R.traiteur(SEM, l, sessions, B.regimes);
  assert.equal(t.couverts, 2);
  assert.equal(t.attente, 1);
  assert.deepEqual(t.regimes, [['Sans restriction', 1], ['Végétarien', 1]]);
  assert.equal(t.allergies, 1);
  assert.deepEqual(t.repas.map((r) => [r.titre, r.date, r.heure, r.couverts]), [['Déjeuner', '2027-03-10', '12:30', 2], ['Petit déjeuner', '2027-03-11', '08:00', 2]]);
  const c = R.csvTraiteur(SEM, t);
  assert.ok(c.startsWith('﻿'));
  for (const nom of ['Aline', 'Zorro', 'Bruno', 'Yole']) assert.ok(!c.includes(nom), `aucun nom (${nom})`);
  assert.ok(c.includes('Allergies ou intolérances à signaler;1'));
  assert.ok(c.includes('Petit déjeuner;11/03/2027;08:00;;2'));
});

test('CSV des participants : sensibles exclus par défaut, inclus sur demande, échappement', () => {
  const l = [P(1, { nom: 'Martin', prenom: 'Léa', service: 'R&D; labo', regime: 'Végétarien', allergie: true, allerId: 't1' }), P(2, { nom: 'Abel', prenom: 'Jo', reponse: 'attente' })];
  const o = { role: () => 'Participant', trajet: (id) => (id === 't1' ? 'Train 08:12' : id === 'perso' ? 'Propres moyens' : ''), chambre: () => '' };
  const sans = R.csvParticipants(l, { ...o, avecSensibles: false });
  assert.ok(!sans.includes('Végétarien') && !sans.includes('Allergie'), 'aucune donnée sensible par défaut');
  const lignes = sans.slice(1).trim().split('\r\n');
  assert.equal(lignes[1].split(';')[0], 'Abel', 'tri par nom');
  assert.ok(sans.includes('"R&D; labo"'));
  assert.ok(sans.includes('Train 08:12'));
  const avec = R.csvParticipants(l, { ...o, avecSensibles: true });
  assert.ok(avec.includes('Régime;Allergie à signaler;Accessibilité'));
  assert.ok(avec.includes('Végétarien;Oui;'));
  assert.ok(avec.includes('Non renseigné;;'));
});

test('saisie rapide et effacement des données sensibles d\'un seul séminaire', () => {
  assert.deepEqual(R.lireParticipantsRapides('Léa Martin ; Ventes ; lea@exemple.fr\nJean Pierre Durand\n\nSolo\t Achats'), [
    { prenom: 'Léa', nom: 'Martin', service: 'Ventes', email: 'lea@exemple.fr' },
    { prenom: 'Jean Pierre', nom: 'Durand', service: '', email: '' },
    { prenom: '', nom: 'Solo', service: 'Achats', email: '' },
  ]);
  const l = [P(1, { regime: 'Végétarien' }), P(2, { allergie: true }), P(3), P(4, { semId: 's2', accessibilite: true })];
  assert.equal(R.aSensibles(l, 's1'), 2);
  assert.equal(R.effacerSensibles(l, 's1'), 2);
  assert.deepEqual([l[0].regime, l[1].allergie], ['', false]);
  assert.equal(l[3].accessibilite, true, 'autre séminaire intact');
  assert.equal(R.aSensibles(l, 's1'), 0);
});

test('transports : occupation, surcharge, sans aller ou retour, propres moyens, « non » exclus', () => {
  const T = [{ id: 't1', sens: 'aller', places: 2 }, { id: 't2', sens: 'retour', places: 0 }];
  const l = [P(1, { allerId: 't1', retourId: 't2' }), P(2, { allerId: 't1', retourId: 'perso' }), P(3, { allerId: 't1', reponse: 'attente' }), P(4, { allerId: 't1', reponse: 'non' }), P(5, { allerId: 'perso', retourId: 'tX' })];
  const o = R.occupationTrajets(T, l);
  assert.equal(o[0].n, 3, 'le « non » ne compte pas');
  assert.equal(o[0].surcharge, true);
  assert.equal(o[0].libres, -1);
  assert.equal(o[1].n, 1);
  assert.equal(o[1].surcharge, false, 'places non précisées : pas de surcharge');
  assert.equal(o[1].libres, null);
  const s = R.sansTransport(l, T);
  assert.deepEqual(s.aller.map((p) => p.id), []);
  assert.deepEqual(s.retour.map((p) => p.id), ['3', '5'], 'trajet supprimé = sans retour ; propres moyens = réglé');
});

test('horaires : arrivée après le début du programme, départ avant la fin, pauses et transferts ignorés', () => {
  const S = [
    { id: 'a', jour: 1, heure: '09:30', duree: 30, titre: 'Accueil café', type: 'pause' },
    { id: 'b', jour: 1, heure: '10:00', duree: 60, titre: 'Ouverture', type: 'pleniere' },
    { id: 'c', jour: 2, heure: '12:00', duree: 75, titre: 'Déjeuner', type: 'repas' },
    { id: 'd', jour: 2, heure: '13:45', duree: 30, titre: 'Navettes', type: 'transfert' },
  ];
  const T = [
    { id: 't1', sens: 'aller', date: '2027-03-10', heureArrivee: '09:50' },
    { id: 't2', sens: 'aller', date: '2027-03-10', heureArrivee: '10:20' },
    { id: 't3', sens: 'aller', date: '2027-03-09', heureArrivee: '22:00' },
    { id: 't4', sens: 'retour', date: '2027-03-11', heureDepart: '13:00' },
    { id: 't5', sens: 'retour', date: '2027-03-11', heureDepart: '13:30' },
    { id: 't6', sens: 'aller', date: '2027-03-10', heureArrivee: '' },
  ];
  const h = R.horairesTrajets(SEM, T, S);
  assert.deepEqual(h.map((x) => [x.trajet.id, x.type, x.heure, x.minutes]), [['t2', 'arrivee', '10:00', 20], ['t4', 'depart', '13:15', 15]]);
});

test('hébergement : à loger, sans nuit, occupation, surcharge, places', () => {
  const C = [{ id: 'c1', capacite: 1 }, { id: 'c2', capacite: 2 }];
  const l = [P(1, { chambreId: 'c1' }), P(2, { chambreId: 'c1' }), P(3, { chambreId: 'c2', reponse: 'non' }), P(4), P(5, { hebergement: false }), P(6, { reponse: 'attente' }), P(7, { chambreId: 'cX' })];
  const o = R.occupationChambres(C, l);
  assert.equal(o[0].surcharge, true);
  assert.equal(o[0].libres, -1);
  assert.equal(o[1].occupants.length, 0, 'le « non » libère sa place');
  assert.deepEqual(R.aLoger(SEM, l, C).map((p) => p.id), ['4', '6', '7']);
  assert.deepEqual(R.aLoger({ ...SEM, nbJours: 1 }, l, C), [], 'pas de nuit, personne à loger');
});

test('répartition automatique : même service d\'abord, puis chambres vides, en attente non placés, restants', () => {
  const C = [{ id: 'c1', capacite: 2 }, { id: 'c2', capacite: 2 }, { id: 'c3', capacite: 1 }];
  const l = [
    P('a', { nom: 'Bert', service: 'Ventes', chambreId: 'c2' }),
    P('b', { nom: 'Zola', service: 'Ventes' }),
    P('c', { nom: 'Abel', service: 'Achats' }),
    P('d', { nom: 'Cyr', service: 'Achats' }),
    P('e', { nom: 'Dupont', service: 'Achats' }),
    P('f', { nom: 'Ezra', service: 'Achats', reponse: 'attente' }),
    P('g', { nom: 'Fort', service: 'RH' }),
  ];
  const r = R.repartir(SEM, l, C);
  assert.equal(r.affectations.b, 'c2', 'rejoint le collègue du même service');
  assert.equal(r.affectations.c, 'c1');
  assert.equal(r.affectations.d, 'c1');
  assert.equal(r.affectations.e, 'c3');
  assert.equal(r.affectations.f, undefined, 'en attente : pas placé');
  assert.deepEqual(r.restants.map((p) => p.id), ['g']);
  assert.deepEqual(R.repartir({ ...SEM, nbJours: 1 }, l, C).affectations, {});
});

test('programme : fin, chevauchement par salle, salles parallèles, décalage en cascade et refus après minuit', () => {
  const S = [
    { id: '1', jour: 1, heure: '14:15', duree: 90, titre: 'Atelier A', salle: 'Salle 1' },
    { id: '2', jour: 1, heure: '14:15', duree: 90, titre: 'Atelier B', salle: 'Salle 2' },
    { id: '3', jour: 1, heure: '15:30', duree: 30, titre: 'Pause', salle: 'salle 1 ' },
    { id: '4', jour: 1, heure: '09:00', duree: 60, titre: 'Ouverture', salle: '' },
    { id: '5', jour: 1, heure: '09:30', duree: 30, titre: 'Sans salle', salle: '' },
    { id: '6', jour: 2, heure: '14:30', duree: 30, titre: 'Jour 2', salle: 'Salle 1' },
    { id: '7', jour: 1, heure: '23:00', duree: 30, titre: 'Soirée', salle: 'Bar' },
  ];
  const p = R.programme(S);
  assert.deepEqual(p.map((x) => x.id), ['4', '5', '1', '2', '3', '7', '6']);
  assert.equal(p.find((x) => x.id === '1').fin, 15 * 60 + 45);
  assert.equal(p.find((x) => x.id === '2').chevauche, null, 'salles différentes en parallèle');
  assert.equal(p.find((x) => x.id === '3').chevauche, '1', 'même salle (casse et espaces ignorés)');
  assert.equal(p.find((x) => x.id === '5').chevauche, '4', 'sans salle entre elles');
  assert.equal(p.find((x) => x.id === '6').chevauche, null, 'autre jour');
  assert.deepEqual(R.decaler(S, '3', 15), { 3: '15:45', 7: '23:15' });
  assert.equal(typeof R.decaler(S, '3', 31), 'string', 'refus de dépasser minuit');
  assert.equal(R.decaler(S, '3', 0), 'Décalage invalide.');
  const ec = R.enCours(S, 1, 14 * 60 + 30);
  assert.deepEqual(ec.courantes.map((x) => x.id), ['1', '2']);
  assert.equal(ec.suivante.id, '3');
});

test('budget : engagé, payé, reste, écart, non affecté, coût par participant, paiements', () => {
  const E = {
    postes: [{ id: 'p1', semId: 's1', nom: 'Hébergement', prevu: 1000000 }, { id: 'p2', semId: 's1', nom: 'Transports', prevu: 0 }],
    depenses: [
      { id: 'd1', semId: 's1', posteId: 'p1', montant: 1200000, statut: 'engage', paye: 300000, echeance: '2026-11-10' },
      { id: 'd2', semId: 's1', posteId: 'p1', montant: 50000, statut: 'devis', paye: 0, echeance: '' },
      { id: 'd3', semId: 's1', posteId: 'p2', montant: 80000, statut: 'annule', paye: 20000, echeance: '' },
      { id: 'd4', semId: 's1', posteId: null, montant: 30000, statut: 'engage', paye: 0, echeance: '2026-11-25' },
      { id: 'd5', semId: 's1', posteId: 'p2', montant: 10000, statut: 'engage', paye: 10000, echeance: '2026-11-20' },
      { id: 'd6', semId: 's2', posteId: null, montant: 999, statut: 'engage', paye: 0, echeance: '2026-11-15' },
    ],
  };
  const b = R.budget(E, 's1');
  const [h, t] = b.lignes;
  assert.deepEqual([h.prevu, h.engage, h.paye, h.reste, h.ecart, h.depassement], [1000000, 1200000, 300000, 900000, 200000, true]);
  assert.deepEqual([t.engage, t.paye, t.reste, t.depassement], [10000, 30000, 0, false], 'acompte d\'une dépense annulée compté ; prévu nul : pas de dépassement');
  assert.equal(b.nonAffecte.engage, 30000);
  assert.deepEqual(b.total, { prevu: 1000000, engage: 1240000, paye: 330000, reste: 930000, ecart: 240000 });
  assert.deepEqual(R.coutParticipant(b.total, 3), { prevu: 333333, engage: 413333 });
  assert.equal(R.coutParticipant(b.total, 0), null);
  const pa = R.paiements(E, AUJ, 's1');
  assert.deepEqual(pa.map((x) => [x.depense.id, x.etat, x.reste]), [['d1', 'retard', 900000], ['d4', 'proche', 30000]]);
});

test('alertes : relance après la date limite, logistique, budget ; séminaire terminé : données sensibles', () => {
  const E = {
    participants: [P(1, { reponse: 'attente' }), P(2, { allerId: 't1', retourId: 'perso', chambreId: 'c1' }), P(3, { allerId: 't1', retourId: 'perso', chambreId: 'c1', regime: 'Végétarien' })],
    trajets: [{ id: 't1', semId: 's1', sens: 'aller', places: 1, date: '2027-03-10', heureArrivee: '11:00' }],
    chambres: [{ id: 'c1', semId: 's1', capacite: 1 }],
    sessions: [{ id: 'x', semId: 's1', jour: 1, heure: '10:00', duree: 60, titre: 'Ouverture', type: 'pleniere', salle: 'A' }],
    postes: [], depenses: [],
  };
  const a = R.alertes(E, { ...SEM, budgetCible: 0 }, '2027-02-25', B.regimes);
  const types = a.map((x) => x.type);
  for (const t of ['relance', 'sans-aller', 'sans-retour', 'a-loger', 'chambre', 'trajet', 'horaire']) assert.ok(types.includes(t), t);
  assert.equal(a.find((x) => x.type === 'sans-aller').gravite, 1, 'seul un « en attente » sans aller : jaune');
  assert.ok(a.findIndex((x) => x.gravite === 1) > a.findLastIndex((x) => x.gravite === 0), 'triées par gravité');
  const avantLimite = R.alertes(E, SEM, '2027-02-15', B.regimes).map((x) => x.type);
  assert.ok(avantLimite.includes('relance-proche') && !avantLimite.includes('relance'));
  const apres = R.alertes(E, SEM, '2027-03-20', B.regimes);
  assert.deepEqual(apres.map((x) => [x.type, x.n, x.jours]), [['sensibles', 1, 9]]);
  R.effacerSensibles(E.participants, 's1');
  assert.deepEqual(R.alertes(E, SEM, '2027-03-20', B.regimes), []);
});
