// Tests des règles métier de l'Organisateur d'événement (templates/evenementiel/regles.js et donnees.js).
// Fusion F1 du 22/11/2026 : reprend l'utile des tests du pilote événementiel, de l'organisateur de mariage et du
// séminaire / offsite, plus la migration des données et la conversion des copies exportées.
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
const I = (id, o = {}) => ({ id: String(id), evtId: 'e1', prenom: '', nom: `N${id}`, groupe: '', reponse: 'oui', regime: '', allergie: false, allergieDetail: '', acces: false, accesDetail: '', hebergement: true, tableId: null, allerId: '', retourId: '', chambreId: '', ...o });

test('base intégrée : quatre types, modèles complets, phases connues, postes sans montant, démarches sourcées', () => {
  assert.deepEqual(B.types.map((t) => t.id), R.TYPES);
  for (const t of B.types) {
    assert.ok(t.mots.invite && t.mots.invites && t.mots.jourj && t.mots.groupe, t.id);
    assert.ok(B.couleurs.some((c) => c.id === t.couleur), t.id);
    assert.ok(B.groupes[t.id]?.length, `${t.id} : groupes proposés`);
  }
  assert.deepEqual(B.types.find((t) => t.id === 'seminaire').mots.invites, 'Participants');
  for (const [cle, r] of Object.entries(B.retroplannings)) {
    assert.ok(r.length >= 15, cle);
    for (const [titre, phase, avant] of r) {
      assert.ok(titre && B.phases.some((p) => p.id === phase), `${cle} : ${titre}`);
      assert.ok(Number.isInteger(avant), titre);
    }
    assert.equal(new Set(r.map((x) => x[0])).size, r.length, `${cle} : titres uniques`);
    assert.ok(B.postes[cle]?.length, `${cle} : postes`);
  }
  assert.equal(B.retroplannings.mariage.length, 40);
  for (const [cle, c] of Object.entries(B.conducteurs)) {
    for (const [jour, h, d, titre, type] of c) assert.ok(jour >= 1 && R.minutes(h) !== null && d > 0 && titre && B.sequences.some((s) => s.id === type), `${cle} : ${titre}`);
  }
  for (const evt of [{ type: 'mariage' }, { type: 'fete' }, { type: 'seminaire', nbJours: 2 }, { type: 'seminaire', nbJours: 1 }, ...['salon', 'soiree', 'gala', 'conference', 'autre'].map((format) => ({ type: 'entreprise', format }))]) {
    assert.ok(B.retroplannings[R.cleModele(evt)], JSON.stringify(evt));
    assert.ok(B.conducteurs[R.cleConducteur(evt)], JSON.stringify(evt));
  }
  assert.ok(Object.values(B.postes).flat().every((p) => typeof p === 'string' && !/\d/.test(p)), 'aucun montant dans les postes');
  assert.match(B.demarches.source, /service-public\.gouv\.fr/);
  assert.ok(B.retroplannings.mariage.filter(([, phase, , note]) => phase === 'demarches' && /mois|jours/.test(note || '')).every(([, , , note]) => /F930/.test(note)));
  assert.ok(B.rgpd.url.startsWith('https://www.cnil.fr/'));
  assert.ok(!B.regimes.some((r) => /\(/.test(r)), 'régimes en liste fermée, sans champ libre');
  assert.ok(B.sequences.some((s) => s.id === 'repas'), 'type repas pour la fiche traiteur');
});

test('fonctions par défaut selon le type, modèle et déroulé choisis', () => {
  assert.deepEqual(R.modulesParDefaut('mariage'), { tables: true, transports: false, hebergement: false, badges: false, enfants: true });
  assert.deepEqual(R.modulesParDefaut('fete'), { tables: true, transports: false, hebergement: false, badges: false, enfants: true });
  assert.deepEqual(R.modulesParDefaut('seminaire', '', 2), { tables: false, transports: true, hebergement: true, badges: true, enfants: false });
  assert.equal(R.modulesParDefaut('seminaire', '', 1).hebergement, false, 'une journée : pas de chambre');
  assert.deepEqual(R.modulesParDefaut('entreprise', 'salon'), { tables: false, transports: false, hebergement: false, badges: true, enfants: false });
  assert.equal(R.modulesParDefaut('entreprise', 'gala').tables, true, 'gala : plan de table');
  assert.equal(R.aModule({ modules: { tables: true } }, 'tables'), true);
  assert.equal(R.aModule({}, 'tables'), false);
  assert.equal(R.cleModele({ type: 'entreprise', format: 'gala' }), 'soiree');
  assert.equal(R.cleModele({ type: 'entreprise', format: 'autre' }), 'conference');
  assert.equal(R.cleConducteur({ type: 'seminaire', nbJours: 2 }), 'deuxjours');
  assert.equal(R.cleConducteur({ type: 'seminaire', nbJours: 1 }), 'journee');
});

test('montants : lecture à la française (y compris 1.250,50), centimes, découpage acompte / solde', () => {
  assert.equal(R.lireMontant('1 250,50 €'), 125050);
  assert.equal(R.lireMontant('1250.5'), 125050);
  assert.equal(R.lireMontant('1.250,50'), 125050);
  assert.equal(R.lireMontant('12'), 1200);
  assert.equal(R.lireMontant(''), 0);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.lireMontant('-5'), -500);
  assert.equal(R.champMontant(125050), '1250,5');
  assert.deepEqual(R.decouper(1000001, 30), [300000, 700001]);
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
  assert.deepEqual(R.statutTache(t, evt, '2027-01-22'), { statut: 'semaine', retard: 0 });
  assert.deepEqual(R.statutTache(t, evt, '2027-01-21'), { statut: 'avenir', retard: 0 });
  assert.equal(R.statutTache({ ...t, faite: '2027-02-10' }, evt, '2027-03-01').statut, 'faite');
  const P = B.periodes;
  assert.equal(P[R.periode({ avant: 360 }, evt, P)].nom, '9 mois et plus avant');
  assert.equal(P[R.periode({ avant: 180 }, evt, P)].nom, '6 à 9 mois avant');
  assert.equal(P[R.periode({ avant: 179 }, evt, P)].nom, '3 à 6 mois avant');
  assert.equal(P[R.periode({ avant: 30 }, evt, P)].nom, '1 à 3 mois avant');
  assert.equal(P[R.periode({ avant: 7 }, evt, P)].nom, 'Dernière semaine');
  assert.equal(P[R.periode({ avant: 0 }, evt, P)].nom, 'Jour J');
  assert.equal(P[R.periode({ avant: -3 }, evt, P)].nom, 'Après l\'événement');
  assert.equal(R.libelleRelatif(12), 'J-12');
  assert.equal(R.libelleRelatif(-5), 'J+5');
});

test('compte à rebours, fin et nuits d\'un événement de plusieurs jours', () => {
  const evt = { date: '2026-11-20', nbJours: 3 };
  assert.equal(R.finEvenement(evt), '2026-11-22');
  assert.equal(R.nuits(evt), 2);
  assert.equal(R.nuits({ date: '2026-11-20' }), 0);
  assert.equal(R.compteRebours(evt, AUJ), 'J-7');
  assert.equal(R.compteRebours(evt, '2026-11-20'), 'Jour J');
  assert.equal(R.compteRebours(evt, '2026-11-21'), 'Jour 2');
  assert.equal(R.compteRebours(evt, '2026-11-23'), 'Terminé');
  assert.equal(R.evenementPasse(evt, '2026-11-22'), false);
  assert.equal(R.evenementPasse(evt, '2026-11-23'), true);
});

test('modèle appliqué à un événement proche : garder, ramener à aujourd\'hui, ignorer ; pas de doublon ; note reprise', () => {
  const evt = { id: 'e1', date: '2026-12-13' }; // J-30
  const lignes = [['A', 'cadrage', 60, 'Note A'], ['B', 'lieu', 30], ['C', 'jourj', 0]];
  const g = R.tachesDepuisModele(lignes, evt, AUJ, 'garder', [], uid);
  assert.equal(g.passees, 1);
  assert.equal(g.taches.length, 3);
  assert.equal(g.taches[0].note, 'Note A');
  assert.equal(R.statutTache(g.taches[0], evt, AUJ).retard, 30);
  assert.equal(R.tachesDepuisModele(lignes, evt, AUJ, 'aujourdhui', [], uid).taches[0].dateFixe, AUJ);
  assert.deepEqual(R.tachesDepuisModele(lignes, evt, AUJ, 'ignorer', [], uid).taches.map((t) => t.titre), ['B', 'C']);
  const d = R.tachesDepuisModele(lignes, evt, AUJ, 'garder', [{ evtId: 'e1', titre: 'b ' }, { evtId: 'autre', titre: 'C' }], uid);
  assert.deepEqual(d.taches.map((t) => t.titre), ['A', 'C']);
  // Le rétroplanning du mariage tient sur 12 mois : rien n'est passé pour un mariage dans un an.
  assert.equal(R.tachesDepuisModele(B.retroplannings.mariage, { id: 'm', date: '2027-11-20' }, AUJ, 'garder', [], uid).passees, 0);
});

function etat() {
  return R.normaliser({
    evenements: [{ id: 'e1', nom: 'Séminaire', type: 'seminaire', date: '2026-12-10', budgetCible: 2000000, modules: R.modulesParDefaut('seminaire', '', 1) }, { id: 'e2', nom: 'Salon', type: 'entreprise', format: 'salon', date: '2027-03-01', modules: R.modulesParDefaut('entreprise', 'salon') }],
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
  });
}

test('budget par poste : engagé = signés, payé compte un acompte d\'un contrat annulé, non affecté, coût par invité', () => {
  const b = R.budget(etat(), 'e1');
  const [lieu, resto, imprevus] = b.lignes;
  assert.deepEqual([lieu.prevu, lieu.engage, lieu.paye, lieu.reste, lieu.ecart, lieu.depassement], [800000, 900000, 270000, 630000, 100000, true]);
  assert.deepEqual([resto.engage, resto.paye, resto.reste, resto.ecart, resto.depassement], [0, 50000, 0, -600000, false]);
  assert.equal(imprevus.depassement, false);
  assert.deepEqual([b.nonAffecte.engage, b.nonAffecte.paye, b.nonAffecte.reste], [120000, 0, 120000]);
  assert.deepEqual(b.total, { prevu: 1400000, engage: 1020000, paye: 320000, reste: 750000, ecart: -380000 });
  assert.deepEqual(R.coutParInvite(b.total, 3), { prevu: 466667, engage: 340000 });
  assert.equal(R.coutParInvite(b.total, 0), null);
  assert.equal(R.infoContrat({ statut: 'signe', montant: 1000, echeances: [{ montant: 300 }] }).aPlanifier, 700);
  assert.equal(R.infoContrat({ statut: 'devis', montant: 1000, echeances: [] }).aPlanifier, 0);
});

test('échéancier : non payées, hors contrats annulés, retard et proche (14 jours)', () => {
  const E = etat();
  assert.deepEqual(R.echeancier(E, AUJ).map((e) => [e.echeance.id, e.etat, e.jours]), [['x4', 'retard', -3], ['x5', 'proche', 12], ['x2', 'avenir', 37]]);
  assert.deepEqual(R.echeancier(E, AUJ, 'e2').map((e) => e.echeance.id), ['x5']);
});

test('tableau de bord : résumé, alertes triées, charge par responsable', () => {
  const E = etat();
  const r = R.resumeEvenement(E, E.evenements[0], AUJ, B.regimes);
  assert.deepEqual([r.jours, r.rebours, r.taches, r.faites, r.retard, r.semaine, r.avancement], [27, 'J-27', 4, 1, 1, 1, 25]);
  assert.equal(r.depassements, 1);
  assert.equal(r.echeancesRetard, 1);
  const a = R.alertes(E, AUJ, B.regimes);
  assert.ok(a.every((x, i) => !i || a[i - 1].gravite <= x.gravite), 'triées par gravité');
  assert.deepEqual(a.filter((x) => x.gravite === 0).map((x) => x.type).sort(), ['paiement', 'taches', 'taches']);
  assert.deepEqual(a.filter((x) => x.gravite === 1).map((x) => x.type).sort(), ['budget', 'paiement', 'planifier']);
  assert.equal(a.find((x) => x.type === 'taches').vue, 'retro');
  const c = R.chargeResponsables(E, AUJ);
  assert.deepEqual(c.map((x) => [x.nom, x.ouvertes, x.retard, x.semaine]), [['Inès', 2, 1, 1], ['Marc', 1, 1, 0], ['Sans responsable', 1, 0, 0]]);
  assert.deepEqual(R.chargeResponsables(E, AUJ, ['e2']).map((x) => x.nom), ['Marc']);
});

test('invités : réponses, adultes et enfants, groupes, régimes sur les couverts, sensibles comptés sans nom, présence', () => {
  const L = [
    I(1, { groupe: 'Famille', regime: 'Végétarien', present: true }),
    I(2, { groupe: 'Famille', enfant: true, regime: 'Menu enfant', acces: true, accesDetail: 'Fauteuil' }),
    I(3, { groupe: 'Amis', reponse: 'attente', regime: 'Végétarien', allergie: true }),
    I(4, { groupe: 'Amis', reponse: 'non', regime: 'Sans porc', allergie: true }),
    I(5, { reponse: 'peut-être' }),
  ];
  const s = R.statsInvites(L, B.regimes);
  assert.deepEqual([s.total, s.oui, s.attente, s.non, s.couverts, s.couvertsEnfants, s.presents, s.tauxPresence], [5, 2, 2, 1, 4, 1, 1, 50]);
  assert.deepEqual([s.adultes, s.enfants, s.rep.oui.enfants], [4, 1, 1]);
  assert.deepEqual(Object.entries(s.regimes).filter(([, x]) => x), [['Sans restriction', 1], ['Végétarien', 2], ['Menu enfant', 1]]);
  assert.deepEqual([s.allergies, s.acces], [1, 1], 'le « non » ne compte pas');
  assert.deepEqual(s.parGroupe.Amis, { oui: 0, non: 1, attente: 1, total: 2 });
  assert.equal(s.parGroupe['Sans groupe'].total, 1);
  assert.equal(s.tauxReponse, 60);
  assert.equal(R.statsInvites([], B.regimes).tauxPresence, null);
  assert.deepEqual(R.groupesDe(L), ['Amis', 'Famille']);
});

test('fiche traiteur : nombres seulement, repas du déroulé, CSV sans aucun nom', () => {
  const evt = { nom: 'Séminaire', lieu: 'Domaine', date: '2027-03-10' };
  const L = [I(1, { nom: 'Durand', regime: 'Végétarien', allergie: true, allergieDetail: 'Arachide' }), I(2, { nom: 'Petit', reponse: 'attente', enfant: true }), I(3, { nom: 'Roux', reponse: 'non', regime: 'Sans porc' })];
  const C = [{ id: 'a', jour: 2, heure: '12:00', duree: 60, titre: 'Déjeuner', type: 'repas', lieu: 'Restaurant' }, { id: 'b', jour: 1, heure: '20:00', duree: 90, titre: 'Dîner', type: 'repas' }, { id: 'c', jour: 1, heure: '09:00', duree: 60, titre: 'Ouverture', type: 'pleniere' }];
  const t = R.traiteur(evt, L, C, B.regimes);
  assert.deepEqual([t.couverts, t.enfants, t.attente, t.allergies], [2, 1, 1, 1]);
  assert.deepEqual(t.repas.map((r) => [r.titre, r.date, r.heure, r.couverts]), [['Dîner', '2027-03-10', '20:00', 2], ['Déjeuner', '2027-03-11', '12:00', 2]]);
  const csv = R.csvTraiteur(evt, t);
  assert.ok(csv.startsWith('﻿'));
  for (const nom of ['Durand', 'Petit', 'Roux', 'Arachide']) assert.ok(!csv.includes(nom), `${nom} absent de la fiche traiteur`);
});

test('CSV des invités : colonnes selon les fonctions, sensibles exclus par défaut, échappement', () => {
  const L = [I(1, { nom: 'Durand', prenom: 'Léa', groupe: 'Client', societe: 'A; B', fonction: 'Dir "com"', regime: 'Végétarien', tableId: 't1', allergie: true, allergieDetail: 'Arachide' })];
  const sans = R.csvInvites(L, { groupe: 'Catégorie', modules: { badges: true, tables: true }, table: () => 'Table 1' });
  assert.ok(sans.startsWith('﻿Nom;Prénom;Catégorie;Société;Fonction;E-mail;Réponse;Présent;Table\r\n'));
  assert.ok(sans.includes('Durand;Léa;Client;"A; B";"Dir ""com""";;Oui;;Table 1\r\n'));
  assert.ok(!sans.includes('Végétarien') && !sans.includes('Arachide'));
  const avec = R.csvInvites(L, { modules: {}, avecSensibles: true });
  assert.ok(avec.includes('Végétarien;Oui;Arachide;;'));
});

test('saisie rapide : prénom et nom, colonne e-mail reconnue, un seul mot, doublons ignorés', () => {
  assert.deepEqual(R.lireInvitesRapides('Anne-Lise de Vries ; Société A ; DG\nBRUN\n\n  Paul Martin\tVentes\tpaul@exemple.fr\nanne-lise de vries'), [
    { prenom: 'Anne-Lise de', nom: 'Vries', champ2: 'Société A', champ3: 'DG', email: '' },
    { prenom: '', nom: 'BRUN', champ2: '', champ3: '', email: '' },
    { prenom: 'Paul', nom: 'Martin', champ2: 'Ventes', champ3: '', email: 'paul@exemple.fr' },
  ]);
  assert.deepEqual(R.lireInvitesRapides(''), []);
  const p = R.pagesBadges(Array.from({ length: 19 }, (_, i) => ({ nom: `N${String(i).padStart(2, '0')}`, prenom: 'x', reponse: i === 3 ? 'non' : 'oui' })));
  assert.deepEqual(p.map((x) => x.length), [8, 8, 2]);
  assert.equal(p[0][3].nom, 'N04');
});

test('effacement des données sensibles d\'un seul événement (cases et précisions)', () => {
  const inv = [I(1, { regime: 'Végétarien' }), I(2, { allergieDetail: 'Arachide', allergie: true }), I(3), I(4, { evtId: 'e2', acces: true })];
  assert.equal(R.aSensibles(inv, 'e1'), 2);
  assert.equal(R.effacerSensibles(inv, 'e1'), 2);
  assert.deepEqual([inv[0].regime, inv[1].allergie, inv[1].allergieDetail], ['', false, '']);
  assert.equal(inv[3].acces, true, 'autre événement intact');
  assert.equal(R.aSensibles(inv, 'e1'), 0);
});

test('plan de table : occupation, surcapacité, non placés, déclinés placés, placement', () => {
  const tables = [{ id: 't1', nom: 'Table 1', places: 2 }, { id: 't2', nom: 'Table 2', places: 8 }];
  const L = [I(1, { tableId: 't1' }), I(2, { tableId: 't1' }), I(3, { tableId: 't1', reponse: 'attente' }), I(4, { reponse: 'attente' }), I(5, { reponse: 'non', tableId: 't2' }), I(6), I(7, { tableId: 'supprimee' })];
  const p = R.planDeTable(tables, L);
  assert.deepEqual(p.tables.map((t) => [t.occupees, t.libres, t.surcapacite]), [[3, -1, true], [0, 8, false]]);
  assert.deepEqual(p.aPlacer.map((i) => i.id), ['4', '6', '7']);
  assert.deepEqual(p.nonPlaces.map((i) => i.id), ['6', '7']);
  assert.deepEqual(p.declinesPlaces.map((i) => i.id), ['5']);
  assert.deepEqual(p.alertes.map((a) => a.texte), ['Table 1 : 3 invités pour 2 places', '2 invités confirmés sans table', '1 invité ayant décliné encore placé']);
  assert.deepEqual([p.places, p.occupees], [10, 3]);
  const apres = R.placer(L, '1', 't2');
  assert.equal(apres.find((i) => i.id === '1').tableId, 't2');
  assert.equal(L[0].tableId, 't1', 'liste d\'origine inchangée');
  assert.equal(R.placer(L, '2', '').find((i) => i.id === '2').tableId, null);
});

const SEM = { id: 'e1', date: '2027-03-10', nbJours: 2, limite: '2027-02-20', modules: R.modulesParDefaut('seminaire', '', 2) };

test('transports : occupation, surcharge, sans aller ou retour, propres moyens, « non » exclus', () => {
  const T = [{ id: 't1', sens: 'aller', places: 2 }, { id: 't2', sens: 'retour', places: 0 }];
  const l = [I(1, { allerId: 't1', retourId: 't2' }), I(2, { allerId: 't1', retourId: 'perso' }), I(3, { allerId: 't1', reponse: 'attente' }), I(4, { allerId: 't1', reponse: 'non' }), I(5, { allerId: 'perso', retourId: 'tX' })];
  const o = R.occupationTrajets(T, l);
  assert.deepEqual([o[0].n, o[0].surcharge, o[0].libres], [3, true, -1]);
  assert.deepEqual([o[1].n, o[1].surcharge, o[1].libres], [1, false, null]);
  const s = R.sansTransport(l, T);
  assert.deepEqual(s.aller.map((p) => p.id), []);
  assert.deepEqual(s.retour.map((p) => p.id), ['3', '5']);
});

test('horaires : arrivée après le début du déroulé, départ avant la fin, pauses et transferts ignorés', () => {
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
  ];
  assert.deepEqual(R.horairesTrajets(SEM, T, S).map((x) => [x.trajet.id, x.type, x.heure, x.minutes]), [['t2', 'arrivee', '10:00', 20], ['t4', 'depart', '13:15', 15]]);
});

test('hébergement : à loger seulement si la fonction est active, occupation, surcharge ; répartition par groupe', () => {
  const C = [{ id: 'c1', capacite: 1 }, { id: 'c2', capacite: 2 }];
  const l = [I(1, { chambreId: 'c1' }), I(2, { chambreId: 'c1' }), I(3, { chambreId: 'c2', reponse: 'non' }), I(4), I(5, { hebergement: false }), I(6, { reponse: 'attente' }), I(7, { chambreId: 'cX' })];
  const o = R.occupationChambres(C, l);
  assert.deepEqual([o[0].surcharge, o[0].libres, o[1].occupants.length], [true, -1, 0]);
  assert.deepEqual(R.aLoger(SEM, l, C).map((p) => p.id), ['4', '6', '7']);
  assert.deepEqual(R.aLoger({ ...SEM, modules: { hebergement: false } }, l, C), [], 'fonction désactivée : personne à loger');
  const C2 = [{ id: 'c1', capacite: 2 }, { id: 'c2', capacite: 2 }, { id: 'c3', capacite: 1 }];
  const l2 = [I('a', { nom: 'Bert', groupe: 'Ventes', chambreId: 'c2' }), I('b', { nom: 'Zola', groupe: 'Ventes' }), I('c', { nom: 'Abel', groupe: 'Achats' }), I('d', { nom: 'Cyr', groupe: 'Achats' }), I('e', { nom: 'Dupont', groupe: 'Achats' }), I('f', { nom: 'Ezra', groupe: 'Achats', reponse: 'attente' }), I('g', { nom: 'Fort', groupe: 'RH' })];
  const r = R.repartir(SEM, l2, C2);
  assert.equal(r.affectations.b, 'c2', 'rejoint quelqu\'un du même groupe');
  assert.deepEqual([r.affectations.c, r.affectations.d, r.affectations.e, r.affectations.f], ['c1', 'c1', 'c3', undefined]);
  assert.deepEqual(r.restants.map((p) => p.id), ['g']);
});

test('déroulé : fin, chevauchement au même lieu, lieux en parallèle, décalage en cascade, séquences en cours', () => {
  const S = [
    { id: '1', jour: 1, heure: '14:15', duree: 90, titre: 'Atelier A', lieu: 'Salle 1' },
    { id: '2', jour: 1, heure: '14:15', duree: 90, titre: 'Atelier B', lieu: 'Salle 2' },
    { id: '3', jour: 1, heure: '15:30', duree: 30, titre: 'Pause', lieu: 'salle 1 ' },
    { id: '4', jour: 1, heure: '09:00', duree: 60, titre: 'Ouverture', lieu: '' },
    { id: '5', jour: 1, heure: '09:30', duree: 30, titre: 'Sans lieu', lieu: '' },
    { id: '6', jour: 2, heure: '14:30', duree: 30, titre: 'Jour 2', lieu: 'Salle 1' },
    { id: '7', jour: 1, heure: '23:00', duree: 30, titre: 'Soirée', lieu: 'Bar' },
  ];
  const p = R.programme(S);
  assert.deepEqual(p.map((x) => x.id), ['4', '5', '1', '2', '3', '7', '6']);
  assert.equal(p.find((x) => x.id === '1').fin, 15 * 60 + 45);
  assert.equal(p.find((x) => x.id === '2').chevauche, null, 'lieux différents en parallèle');
  assert.equal(p.find((x) => x.id === '3').chevauche, '1', 'même lieu (casse et espaces ignorés)');
  assert.equal(p.find((x) => x.id === '5').chevauche, '4', 'sans lieu entre elles');
  assert.equal(p.find((x) => x.id === '6').chevauche, null, 'autre jour');
  assert.deepEqual(R.decaler(S, '3', 15), { 3: '15:45', 7: '23:15' });
  assert.equal(typeof R.decaler(S, '3', 31), 'string', 'refus de dépasser minuit');
  assert.equal(R.decaler(S, '3', 0), 'Décalage invalide.');
  const ec = R.enCours(S, 1, 14 * 60 + 30);
  assert.deepEqual(ec.courantes.map((x) => x.id), ['1', '2']);
  assert.equal(ec.suivante.id, '3');
  assert.equal(R.minutes('24:00'), null);
  assert.equal(R.minutes('7:05'), 425);
});

test('alertes : relance, transports, hébergement et plan de table selon les fonctions ; terminé : données sensibles', () => {
  const E = R.normaliser({
    evenements: [{ ...SEM, nom: 'Séminaire', type: 'seminaire', modules: { ...SEM.modules, tables: true } }],
    invites: [I(1, { reponse: 'attente' }), I(2, { allerId: 't1', retourId: 'perso', chambreId: 'c1', tableId: 'x1' }), I(3, { allerId: 't1', retourId: 'perso', chambreId: 'c1', regime: 'Végétarien', tableId: 'x1' })],
    trajets: [{ id: 't1', evtId: 'e1', sens: 'aller', places: 1, date: '2027-03-10', heureArrivee: '11:00' }],
    chambres: [{ id: 'c1', evtId: 'e1', capacite: 1 }],
    tables: [{ id: 'x1', evtId: 'e1', nom: 'Table 1', places: 1 }],
    conducteur: [{ id: 'x', evtId: 'e1', jour: 1, heure: '10:00', duree: 60, titre: 'Ouverture', type: 'pleniere', lieu: 'A' }, { id: 'y', evtId: 'e1', jour: 1, heure: '10:30', duree: 30, titre: 'Visio', lieu: 'a' }],
  });
  const a = R.alertes(E, '2027-02-25', B.regimes);
  const types = a.map((x) => x.type);
  for (const t of ['relance', 'sans-aller', 'sans-retour', 'a-loger', 'chambre', 'trajet', 'horaire', 'table', 'chevauchement']) assert.ok(types.includes(t), t);
  assert.equal(a.find((x) => x.type === 'sans-aller').gravite, 1, 'seul un « en attente » sans aller : jaune');
  assert.equal(a.find((x) => x.type === 'a-loger').volet, 'chambres');
  assert.ok(a.every((x, i) => !i || a[i - 1].gravite <= x.gravite), 'triées par gravité');
  assert.ok(R.alertes(E, '2027-02-15', B.regimes).some((x) => x.type === 'relance-proche'));
  // Fonctions désactivées : plus d'alerte de transports, de chambres ni de tables.
  E.evenements[0].modules = { tables: false, transports: false, hebergement: false, badges: false, enfants: false };
  assert.deepEqual(R.alertes(E, '2027-02-25', B.regimes).map((x) => x.type).sort(), ['chevauchement', 'relance']);
  const apres = R.alertes(E, '2027-03-20', B.regimes);
  assert.deepEqual(apres.map((x) => [x.type, x.n, x.jours]), [['sensibles', 1, 9]]);
  R.effacerSensibles(E.invites, 'e1');
  assert.deepEqual(R.alertes(E, '2027-03-20', B.regimes), []);
});

test('normaliser : données du pilote événementiel d\'avant la fusion lues sans perte', () => {
  const v1 = {
    version: 1, structure: 'Agence', tutorielVu: true, reglages: { convention: 'HT' },
    evenements: [{ id: 'a', nom: 'Salon', type: 'salon', date: '2027-01-10' }, { id: 'b', nom: 'Soirée', type: 'lancement', date: '2027-02-10' }, { id: 'c', nom: 'Séminaire', type: 'seminaire', date: '2027-03-10', nbJours: 2 }, { id: 'd', nom: 'X', type: 'autre', date: '2027-04-10' }],
    taches: [{ id: 't', evtId: 'a', titre: 'Stand', avant: 30 }],
    invites: [{ id: 'i', evtId: 'b', prenom: 'Léa', nom: 'Martin', categorie: 'presse', accessibilite: 'Fauteuil roulant', regime: 'Autre (voir note)' }, { id: 'j', evtId: 'b', nom: 'Petit', categorie: 'client', accessibilite: '' }],
    conducteur: [{ id: 's', evtId: 'b', heure: '19:00', duree: 10, titre: 'Mot', lieu: 'Scène' }],
    contrats: [{ id: 'k', evtId: 'a', montant: 100, statut: 'signe' }],
  };
  const E = R.normaliser(v1);
  assert.equal(E.version, 2);
  assert.deepEqual(E.evenements.map((e) => [e.type, e.format]), [['entreprise', 'salon'], ['entreprise', 'soiree'], ['seminaire', ''], ['entreprise', 'autre']]);
  assert.ok(E.evenements.every((e) => e.modules.badges && !e.modules.tables && !e.modules.transports), 'anciens événements : badges, aucune fonction nouvelle imposée');
  assert.deepEqual([E.structure, E.tutorielVu, E.reglages.convention], ['Agence', true, 'HT']);
  const [i, j] = E.invites;
  assert.deepEqual([i.groupe, i.acces, i.accesDetail, i.regime, 'categorie' in i, 'accessibilite' in i], ['Presse', true, 'Fauteuil roulant', 'Autre', false, false]);
  assert.deepEqual([j.groupe, j.acces], ['Client', false]);
  assert.equal(E.conducteur[0].type, '');
  assert.deepEqual(E.contrats[0].echeances, []);
  for (const k of ['tables', 'trajets', 'chambres']) assert.deepEqual(E[k], []);
  assert.deepEqual(R.normaliser(E), E, 'normaliser deux fois ne change rien');
  assert.deepEqual(R.normaliser(null), R.etatVide());
  assert.equal(R.normaliser({ evenements: [{ id: 'z', nom: 'Sans date' }] }).evenements.length, 0, 'événement sans date ignoré');
});

test('restaurer une copie de l\'organisateur de mariage : un événement de type mariage, rien de perdu', () => {
  const mrg = {
    version: 1, tutorielVu: true, noms: ['Léa', 'Malik'], date: '2027-06-12', lieu: 'Domaine', budgetGlobal: 3500000,
    taches: [{ id: 'm1', titre: 'Réserver le lieu', categorie: 'lieu', avant: 320, date: null, fait: '2026-08-01', note: '' }, { id: 'm2', titre: 'Dégustation', categorie: 'reception', avant: 0, date: '2027-01-15', fait: null, note: 'Régimes' }],
    postes: [{ id: 'p1', nom: 'Traiteur et boissons', prevu: 900000 }],
    prestataires: [{ id: 'f1', nom: 'Traiteur n° 1', posteId: 'p1', statut: 'reserve', devis: 980000, contact: 'Chef', note: '100 couverts', paiements: [{ id: 'y1', libelle: 'Acompte', montant: 294000, echeance: '2026-09-01', paye: '2026-09-01' }, { id: 'y2', libelle: 'Solde', montant: 686000, echeance: '2027-06-01', paye: null }] },
      { id: 'f2', nom: 'DJ', posteId: 'pX', statut: 'ecarte', devis: 0, paiements: [] }],
    groupes: [{ id: 'g1', nom: 'Famille de Léa' }],
    invites: [{ id: 'i1', nom: 'Hélène B.', groupeId: 'g1', enfant: false, reponse: 'oui', regime: 'Sans restriction', allergies: 'Fruits à coque', tableId: 'x1' }, { id: 'i2', nom: 'Rose', groupeId: 'gX', enfant: true, reponse: 'attente', regime: 'Menu enfant', allergies: '', tableId: null }],
    tables: [{ id: 'x1', nom: 'Table d\'honneur', places: 8 }],
    jourJ: [{ id: 'j1', titre: 'Alliances confiées à un témoin', heure: '', qui: 'Nadia', fait: true }],
  };
  assert.equal(R.natureCopie(mrg), 'mariage');
  const carnet = [{ id: 'deja', nom: 'DJ', metier: 'Musique' }];
  const r = R.depuisMariage(mrg, uid, AUJ, carnet);
  const [e] = r.evenements;
  assert.deepEqual([e.nom, e.type, e.date, e.lieu, e.budgetCible, e.noms], ['Mariage de Léa et Malik', 'mariage', '2027-06-12', 'Domaine', 3500000, ['Léa', 'Malik']]);
  assert.deepEqual(e.modules, R.modulesParDefaut('mariage'));
  assert.deepEqual(r.taches.map((t) => [t.titre, t.phase, t.avant, t.dateFixe, t.faite, t.evtId]), [['Réserver le lieu', 'lieu', 320, null, '2026-08-01', e.id], ['Dégustation', 'reception', 0, '2027-01-15', null, e.id]]);
  assert.equal(r.postes[0].prevu, 900000);
  assert.equal(r.prestataires.length, 2, 'DJ réutilisé dans le carnet');
  const [c1, c2] = r.contrats;
  assert.deepEqual([c1.statut, c1.montant, c1.posteId, c1.objet, c1.echeances.map((x) => [x.montant, x.date, x.payeLe])], ['signe', 980000, r.postes[0].id, '100 couverts', [[294000, '2026-09-01', '2026-09-01'], [686000, '2027-06-01', null]]]);
  assert.deepEqual([c2.statut, c2.prestaId, c2.posteId], ['annule', 'deja', null]);
  const [h, rose] = r.invites;
  assert.deepEqual([h.nom, h.groupe, h.regime, h.allergie, h.allergieDetail, h.tableId], ['Hélène B.', 'Famille de Léa', '', true, 'Fruits à coque', r.tables[0].id]);
  assert.deepEqual([rose.enfant, rose.reponse, rose.regime, rose.groupe, rose.tableId], [true, 'attente', 'Menu enfant', '', null]);
  assert.deepEqual(r.checklist.map((x) => [x.libelle, x.responsable, x.fait]), [['Alliances confiées à un témoin', 'Nadia', true]]);
  // Budget identique à celui de l'ancien template : engagé = devis réservé, payé = acompte.
  const E = R.etatVide();
  assert.equal(R.ajouterImport(E, r), 1);
  assert.deepEqual(R.budget(E, e.id).total, { prevu: 900000, engage: 980000, paye: 294000, reste: 686000, ecart: 80000 });
  assert.equal(R.planDeTable(E.tables, E.invites).occupees, 1);
  // Copie sans date : date provisoire dans un an, signalée en note.
  const sansDate = R.depuisMariage({ ...mrg, date: '', noms: ['', ''] }, uid, AUJ, []);
  assert.deepEqual([sansDate.evenements[0].nom, sansDate.evenements[0].date], ['Notre mariage', '2027-11-13']);
  assert.match(sansDate.evenements[0].notes, /Date du mariage à fixer/);
});

test('restaurer une copie du template séminaire : un événement par séminaire, logistique et budget repris', () => {
  const smn = {
    version: 1, structure: 'Maison', seminaires: [{ id: 's1', nom: 'Annuel', date: '2027-03-10', nbJours: 2, lieu: 'Domaine', depart: 'Paris', limite: '2027-02-20', budgetCible: 4200000 }, { id: 's2', nom: 'Intégration', date: '2027-04-10', nbJours: 1 }],
    participants: [
      { id: 'p1', semId: 's1', prenom: 'Léa', nom: 'Martin', service: 'Ventes', role: 'intervenant', reponse: 'oui', hebergement: true, allerId: 't1', retourId: 'perso', chambreId: 'c1', regime: 'Végétarien', allergie: true, accessibilite: true },
      { id: 'p2', semId: 's2', prenom: 'Hugo', nom: 'Petit', service: '', role: 'participant', reponse: 'attente', hebergement: false, allerId: '', retourId: '', chambreId: '' },
    ],
    trajets: [{ id: 't1', semId: 's1', sens: 'aller', mode: 'train', date: '2027-03-10', heureArrivee: '09:05', places: 20 }],
    chambres: [{ id: 'c1', semId: 's1', nom: 'Chambre 101', type: 'twin', capacite: 2 }],
    sessions: [{ id: 'x1', semId: 's1', jour: 1, heure: '12:00', duree: 60, titre: 'Déjeuner', type: 'repas', salle: 'Restaurant', animateur: '' }],
    postes: [{ id: 'q1', semId: 's1', nom: 'Hébergement', prevu: 760000 }],
    depenses: [
      { id: 'd1', semId: 's1', posteId: 'q1', fournisseur: 'Domaine', objet: '22 chambres', montant: 726000, statut: 'engage', paye: 217800, echeance: '2027-02-28' },
      { id: 'd2', semId: 's1', posteId: null, fournisseur: 'Autocariste', objet: 'Car', montant: 148000, statut: 'devis', paye: 0, echeance: '' },
      { id: 'd3', semId: 's1', posteId: 'q1', fournisseur: 'Domaine', objet: 'Boissons', montant: 160000, statut: 'annule', paye: 30000, echeance: '' },
    ],
  };
  assert.equal(R.natureCopie(smn), 'seminaire');
  const r = R.depuisSeminaire(smn, uid, AUJ, []);
  assert.deepEqual(r.evenements.map((e) => [e.nom, e.type, e.nbJours, e.modules.transports, e.modules.hebergement]), [['Annuel', 'seminaire', 2, true, true], ['Intégration', 'seminaire', 1, true, false]]);
  const [annuel] = r.evenements;
  assert.deepEqual([annuel.depart, annuel.limite, annuel.budgetCible], ['Paris', '2027-02-20', 4200000]);
  const [lea, hugo] = r.invites;
  assert.deepEqual([lea.evtId, lea.groupe, lea.fonction, lea.allerId, lea.retourId, lea.chambreId, lea.acces, lea.allergie], [annuel.id, 'Ventes', 'Intervenant', r.trajets[0].id, 'perso', r.chambres[0].id, true, true]);
  assert.equal(hugo.evtId, r.evenements[1].id);
  assert.deepEqual([r.conducteur[0].lieu, r.conducteur[0].type, r.conducteur[0].evtId], ['Restaurant', 'repas', annuel.id]);
  assert.ok(!('semId' in r.trajets[0]) && r.trajets[0].evtId === annuel.id);
  assert.equal(r.prestataires.length, 2, 'Domaine une seule fois dans le carnet');
  const E = R.etatVide();
  R.ajouterImport(E, r);
  // Engagé, payé (y compris l'acompte d'une dépense annulée) et reste identiques à l'ancien calcul.
  const b = R.budget(E, annuel.id);
  assert.deepEqual([b.total.engage, b.total.paye, b.total.reste], [726000, 247800, 478200]);
  assert.deepEqual(R.echeancier(E, AUJ, annuel.id).map((x) => [x.echeance.montant, x.echeance.date]), [[508200, '2027-02-28']]);
  assert.equal(R.traiteur(annuel, R.trierInvites(E.invites.filter((i) => i.evtId === annuel.id)), E.conducteur, B.regimes).repas.length, 1);
  assert.equal(R.natureCopie({ evenements: [] }), 'evenement');
  assert.equal(R.natureCopie({ foo: 1 }), null);
});

test('dates : fin de mois, années bissextiles, format français', () => {
  assert.equal(R.ajout('2028-02-28', 1), '2028-02-29');
  assert.equal(R.ajout('2027-02-28', 1), '2027-03-01');
  assert.equal(R.ecart('2026-12-31', '2027-01-01'), 1);
  assert.equal(R.ajout('2026-10-25', 1), '2026-10-26'); // changement d'heure
  assert.equal(R.dateFr('2026-11-13'), '13/11/2026');
  assert.equal(R.estDate('2026-02-30'), false);
});
