// Tests des règles métier de l'organisateur de mariage (templates/mariage/regles.js).
// Dates de référence fixes : aucun test ne dépend de la date du jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../../templates/mariage/regles.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../../templates/mariage/donnees.js', import.meta.url), 'utf8').replace('window.BASE', 'globalThis.BASE'), ctx);
const R = ctx.MRG;
const B = ctx.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

const MARIAGE = '2027-06-12';
const REF = '2027-03-01'; // 103 jours avant (mars 2027 : 31 j, avril 30, mai 31 → 31+30+31+11)

test('montants en centimes entiers', () => {
  assert.equal(R.versCentimes('1 250'), 125000);
  assert.equal(R.versCentimes('1 250,50 €'), 125050);
  assert.equal(R.versCentimes('12.5'), 1250);
  assert.equal(R.versCentimes('1.250,5'), 125050);
  assert.equal(R.versCentimes('0,05'), 5);
  assert.equal(R.versCentimes('12,345'), null);
  assert.equal(R.versCentimes('-3'), null);
  assert.equal(R.versCentimes(''), null);
  assert.equal(R.euros(125050), '1 250,50 €');
  assert.equal(R.euros(300000), '3 000 €');
  assert.equal(R.eurosRonds(-149950), '−1 500 €');
});

test('dates : écarts et ajouts sans fuseau', () => {
  assert.equal(R.joursAvant(MARIAGE, REF), 103);
  assert.equal(R.ajoutJours('2027-03-01', -1), '2027-02-28');
  assert.equal(R.ajoutJours('2028-03-01', -1), '2028-02-29');
  assert.equal(R.ecartJours('2027-03-27', '2027-03-29'), 2); // changement d'heure ignoré
  assert.equal(R.joursAvant(MARIAGE, '2027-06-20'), -8);
});

test('échéance relative à la date du mariage, date fixe prioritaire', () => {
  assert.equal(R.echeance({ avant: 90 }, MARIAGE), '2027-03-14');
  assert.equal(R.echeance({ avant: 0 }, MARIAGE), MARIAGE);
  assert.equal(R.echeance({ avant: -3 }, MARIAGE), '2027-06-15');
  assert.equal(R.echeance({ avant: 90, date: '2027-01-10' }, MARIAGE), '2027-01-10');
  assert.equal(R.echeance({ avant: 90 }, ''), null);
  // Changer la date du mariage décale la tâche relative, pas la date fixe.
  assert.equal(R.echeance({ avant: 90 }, '2027-09-04'), '2027-06-06');
  assert.equal(R.echeance({ avant: 90, date: '2027-01-10' }, '2027-09-04'), '2027-01-10');
});

test('statut des tâches : fait, retard, semaine, à venir', () => {
  assert.equal(R.statutTache({ avant: 110 }, MARIAGE, REF), 'retard'); // 2027-02-22
  assert.equal(R.statutTache({ avant: 110, fait: '2027-02-20' }, MARIAGE, REF), 'fait');
  assert.equal(R.statutTache({ avant: 103 }, MARIAGE, REF), 'semaine'); // échéance aujourd'hui
  assert.equal(R.statutTache({ avant: 96 }, MARIAGE, REF), 'semaine'); // dans 7 jours
  assert.equal(R.statutTache({ avant: 95 }, MARIAGE, REF), 'avenir'); // dans 8 jours
  assert.equal(R.statutTache({ avant: 30 }, '', REF), 'avenir');
});

test('périodes du rétroplanning', () => {
  const P = B.periodes;
  assert.equal(P[R.indexPeriode(360, P)].nom, '12 à 9 mois avant');
  assert.equal(P[R.indexPeriode(270, P)].nom, '12 à 9 mois avant');
  assert.equal(P[R.indexPeriode(269, P)].nom, '9 à 6 mois avant');
  assert.equal(P[R.indexPeriode(90, P)].nom, '6 à 3 mois avant');
  assert.equal(P[R.indexPeriode(29, P)].nom, 'Le dernier mois');
  assert.equal(P[R.indexPeriode(8, P)].nom, 'Le dernier mois');
  assert.equal(P[R.indexPeriode(7, P)].nom, 'La dernière semaine');
  assert.equal(P[R.indexPeriode(0, P)].nom, 'Le jour J');
  assert.equal(P[R.indexPeriode(-20, P)].nom, 'Après le mariage');
});

test('planning complet du rétroplanning type et bilan', () => {
  const taches = B.taches.map((t, i) => ({ id: `t${i}`, ...t, fait: t.avant >= 300 ? '2026-08-01' : null }));
  const l = R.planning(taches, MARIAGE, REF, B.periodes);
  assert.equal(l.length, 40);
  // Triées par échéance.
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].echeance <= l[i].echeance);
  const b = R.bilanTaches(l);
  // Faites : avant ≥ 300 → 360, 355, 350, 335, 320, 310, 300 = 7.
  assert.equal(b.fait, 7);
  // En retard : échéance avant le 2027-03-01, soit avant > 103, non faites : 290, 270, 260, 240, 220, 200, 180, 170, 160, 150, 140, 130, 120, 110 = 14 tâches.
  assert.equal(b.retard, 14);
  // Cette semaine : 96 ≤ avant ≤ 103 → 100 (choix du menu).
  assert.equal(b.semaine, 1);
  assert.equal(b.avenir, 40 - 7 - 14 - 1);
  assert.equal(b.taux, 18);
  // Une tâche à date fixe garde sa date et prend la période correspondant à son écart.
  const fixe = R.planning([{ id: 'f', titre: 'Essai coiffure', avant: 140, date: '2027-06-05' }], MARIAGE, REF, B.periodes)[0];
  assert.equal(fixe.echeance, '2027-06-05');
  assert.equal(B.periodes[fixe.periode].nom, 'La dernière semaine');
  assert.equal(fixe.joursRestants, 96);
});

test('décalage saisi en mois et semaines, libellé', () => {
  assert.equal(R.enJours(3, 0), 90);
  assert.equal(R.enJours(0, 2), 14);
  assert.equal(R.enJours(1, 1), 37);
  assert.equal(R.libelleAvant(90), '3 mois avant');
  assert.equal(R.libelleAvant(21), '3 semaines avant');
  assert.equal(R.libelleAvant(10), '10 jours avant');
  assert.equal(R.libelleAvant(1), '1 jour avant');
  assert.equal(R.libelleAvant(0), 'le jour J');
  assert.equal(R.libelleAvant(-3), '3 jours après');
});

// Budget de test vérifié à la main.
const postes = [
  { id: 'lieu', nom: 'Lieu', prevu: 600000 },
  { id: 'traiteur', nom: 'Traiteur', prevu: 900000 },
  { id: 'photo', nom: 'Photo', prevu: 150000 },
  { id: 'fleurs', nom: 'Fleurs', prevu: 0 },
];
const prestataires = [
  { id: 'p1', nom: 'Domaine A', posteId: 'lieu', statut: 'reserve', devis: 550000, paiements: [
    { id: 'a1', libelle: 'Acompte', montant: 165000, echeance: '2026-10-01', paye: '2026-10-01' },
    { id: 'a2', libelle: 'Solde', montant: 385000, echeance: '2027-05-29', paye: null }] },
  { id: 'p2', nom: 'Traiteur B', posteId: 'traiteur', statut: 'reserve', devis: 980000, paiements: [
    { id: 'b1', libelle: 'Acompte', montant: 300000, echeance: '2027-02-15', paye: null }] },
  { id: 'p3', nom: 'Traiteur C', posteId: 'traiteur', statut: 'devis', devis: 870000, paiements: [] },
  { id: 'p4', nom: 'Photographe D', posteId: 'photo', statut: 'contacter', devis: 0, paiements: [] },
  { id: 'p5', nom: 'Fleuriste E', posteId: 'fleurs', statut: 'reserve', devis: 80000, paiements: [
    { id: 'e1', libelle: 'Acompte', montant: 20000, echeance: '', paye: '2027-01-05' },
    { id: 'e2', libelle: 'Solde', montant: 60000, echeance: '', paye: null }] },
];

test('budget par poste : prévu, engagé, payé, reste, dépassement', () => {
  const { lignes, total } = simple(R.budgetParPoste(postes, prestataires));
  const l = Object.fromEntries(lignes.map((x) => [x.id, x]));
  assert.deepEqual([l.lieu.engage, l.lieu.paye, l.lieu.reste, l.lieu.ecart, l.lieu.depasse], [550000, 165000, 385000, -50000, false]);
  // Le devis non réservé (C) ne compte pas dans l'engagé.
  assert.deepEqual([l.traiteur.engage, l.traiteur.paye, l.traiteur.reste, l.traiteur.ecart, l.traiteur.depasse], [980000, 0, 980000, 80000, true]);
  assert.deepEqual([l.photo.engage, l.photo.reste, l.photo.nbPrestataires], [0, 0, 1]);
  // Poste sans prévu : pas de « dépassement » affiché.
  assert.deepEqual([l.fleurs.engage, l.fleurs.paye, l.fleurs.reste, l.fleurs.depasse], [80000, 20000, 60000, false]);
  assert.deepEqual(total, { prevu: 1650000, engage: 1610000, paye: 185000, reste: 1425000 });
});

test('budget : payé au-delà de l\'engagé et prestataire sans poste', () => {
  const ps = [{ id: 'x', nom: 'Robe', posteId: 'tenues', statut: 'devis', devis: 0, paiements: [{ id: 'y', montant: 40000, paye: '2027-01-01' }] }];
  const { lignes, total } = simple(R.budgetParPoste([{ id: 'tenues', nom: 'Tenues', prevu: 100000 }], ps));
  assert.deepEqual([lignes[0].engage, lignes[0].paye, lignes[0].reste], [0, 40000, 0]);
  const b = simple(R.budgetParPoste([], [{ id: 'z', nom: 'DJ', posteId: 'disparu', statut: 'reserve', devis: 120000, paiements: [] }]));
  assert.equal(b.lignes[0].nom, 'Sans poste');
  assert.equal(b.total.engage, 120000);
  assert.equal(total.reste, 0);
});

test('échéances de paiement à venir et en retard', () => {
  const e = simple(R.echeancesAVenir(prestataires, REF));
  assert.deepEqual(e.map((x) => x.id), ['b1', 'a2', 'e2']);
  assert.equal(e[0].retard, true);
  assert.equal(e[0].jours, -14);
  assert.equal(e[1].retard, false);
  assert.equal(e[1].jours, 89);
  assert.equal(e[2].jours, null);
  assert.equal(e[0].prestataire, 'Traiteur B');
});

const invites = [
  { id: 'i1', nom: 'Adèle', reponse: 'oui', enfant: false, regime: 'Végétarien', allergies: '', tableId: 't1' },
  { id: 'i2', nom: 'Bruno', reponse: 'oui', enfant: false, regime: 'Sans restriction', allergies: 'Arachide', tableId: 't1' },
  { id: 'i3', nom: 'Chloé', reponse: 'oui', enfant: true, regime: 'Menu enfant', allergies: '', tableId: 't1' },
  { id: 'i4', nom: 'Damien', reponse: 'attente', enfant: false, regime: 'Végétarien', allergies: '', tableId: null },
  { id: 'i5', nom: 'Élise', reponse: 'non', enfant: false, regime: 'Végétalien', allergies: 'Lait', tableId: 't2' },
  { id: 'i6', nom: 'Farid', reponse: 'oui', enfant: false, regime: '', allergies: ' ', tableId: null },
  { id: 'i7', nom: 'Gaël', reponse: 'oui', enfant: false, regime: 'Sans restriction', allergies: '', tableId: 'disparue' },
];

test('statistiques des invités : réponses, couverts, régimes, allergies', () => {
  const s = simple(R.statsInvites(invites));
  assert.equal(s.total, 7);
  assert.deepEqual([s.adultes, s.enfants], [6, 1]);
  assert.deepEqual(s.oui, { adultes: 4, enfants: 1 });
  assert.deepEqual(s.attente, { adultes: 1, enfants: 0 });
  assert.deepEqual(s.non, { adultes: 1, enfants: 0 });
  assert.equal(s.couverts, 6);
  assert.equal(s.confirmes, 5);
  // Les régimes de ceux qui ont décliné ne comptent pas.
  assert.deepEqual(s.regimes, { 'Végétarien': 2, 'Menu enfant': 1 });
  assert.deepEqual(s.allergies.map((a) => a.nom), ['Bruno']);
});

test('saisie rapide de noms', () => {
  assert.deepEqual(simple(R.nomsDepuisTexte('  Adèle  Martin \n\nBruno\nadèle martin\r\nChloé')), ['Adèle Martin', 'Bruno', 'Chloé']);
  assert.deepEqual(simple(R.nomsDepuisTexte('')), []);
});

test('plan de table : occupation, surcapacité, non placés, déclinés placés', () => {
  const tables = [{ id: 't1', nom: 'Table 1', places: 2 }, { id: 't2', nom: 'Table 2', places: 8 }];
  const p = simple(R.planDeTable(tables, invites));
  assert.deepEqual(p.tables.map((t) => [t.occupees, t.libres, t.surcapacite]), [[3, -1, true], [0, 8, false]]);
  // À placer : oui ou en attente sans table valide (i4, i6, i7) ; non placés confirmés : i6, i7.
  assert.deepEqual(p.aPlacer.map((i) => i.id), ['i4', 'i6', 'i7']);
  assert.deepEqual(p.nonPlaces.map((i) => i.id), ['i6', 'i7']);
  assert.deepEqual(p.declinesPlaces.map((i) => i.id), ['i5']);
  assert.deepEqual(p.alertes.map((a) => a.type), ['surcapacite', 'nonPlaces', 'declines']);
  assert.equal(p.alertes[0].texte, 'Table 1 : 3 invités pour 2 places');
  assert.equal(p.alertes[1].texte, '2 invités confirmés sans table');
  assert.equal(p.alertes[2].texte, '1 invité ayant décliné encore placé');
  assert.deepEqual([p.places, p.occupees], [10, 3]);
  const apres = R.placer(invites, 'i1', 't2');
  assert.equal(apres.find((i) => i.id === 'i1').tableId, 't2');
  assert.equal(invites.find((i) => i.id === 'i1').tableId, 't1'); // liste d'origine inchangée
  assert.equal(R.placer(invites, 'i2', '').find((i) => i.id === 'i2').tableId, null);
});

test('effacement des données de santé', () => {
  const e = simple(R.effacerSante(invites));
  assert.ok(e.every((i) => i.regime === 'Sans restriction' && i.allergies === ''));
  assert.equal(e[0].nom, 'Adèle');
});

test('base intégrée : 40 tâches, 16 postes sans montant, démarches sourcées', () => {
  assert.equal(B.taches.length, 40);
  assert.equal(B.postes.length, 16);
  assert.ok(B.postes.every((p) => typeof p === 'string' && !/\d/.test(p)));
  assert.ok(B.taches.every((t) => B.categories.some((c) => c.id === t.categorie)));
  assert.equal(B.jourJ.length, 18);
  assert.match(B.sourceDemarches.source, /service-public\.gouv\.fr/);
  // Aucune tâche de démarche n'impose un délai sans renvoyer à la source.
  assert.ok(B.taches.filter((t) => t.categorie === 'demarches' && /mois|jours/.test(t.note || '')).every((t) => /F930/.test(t.note)));
});
