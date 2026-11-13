// Tests des règles métier des inscriptions associatives (templates/inscriptions/regles.js et donnees.js).
// Aucune dépendance à la date du jour : « aujourd'hui » est fixé dans chaque test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/inscriptions/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-13';

// État minimal : 2 tranches, 1 activité à 2 créneaux, 2 familles.
function etat() {
  return {
    association: { nom: 'Asso test', adhesion: { montant: 15, par: 'famille' }, conservation: 3 },
    saison: { nom: '2026-2027', debut: '2026-09-01', fin: '2027-06-30', fermetures: [] },
    tranches: [{ id: 'tA', nom: 'A', max: 700 }, { id: 'tB', nom: 'B', max: null }],
    activites: [{ id: 'a1', nom: 'Judo', tarifs: { tA: 90, tB: 150 }, creneaux: [{ id: 'c1', jour: 2, debut: '14:00', fin: '15:00', capacite: 2 }, { id: 'c2', jour: 5, debut: '10:00', fin: '11:00', capacite: 10 }] }],
    familles: [
      { id: 'f1', nom: 'Durand', qf: 650, nbEcheances: 3, depart: '2026-09-10', responsables: [{ nom: 'Mme Durand', tel: '0600000000' }], urgences: [{ nom: 'Voisine', tel: '0600000001' }], mentionsLe: '2026-09-10' },
      { id: 'f2', nom: 'Martin', qf: null, nbEcheances: 1, responsables: [], urgences: [], mentionsLe: null },
    ],
    membres: [
      { id: 'm1', familleId: 'f1', prenom: 'Léo', nom: 'Durand', naissance: '2016-11-14' },
      { id: 'm2', familleId: 'f1', prenom: 'Zoé', nom: 'Durand', naissance: '2014-03-02' },
      { id: 'm3', familleId: 'f2', prenom: 'Sam', nom: 'Martin', naissance: '2015-06-01' },
    ],
    inscriptions: [],
    paiements: [],
  };
}
const inscr = (o) => ({ id: o.id, membreId: o.m, activiteId: 'a1', creneauId: o.c || 'c1', date: o.date || '2026-09-05', statut: o.statut || 'inscrit', ordre: o.ordre || 0, tarif: o.tarif ?? null });

test('base intégrée : 18 activités types aux créneaux valides, modèles de tranches, sources CNIL', () => {
  assert.equal(B.activites.length, 18);
  assert.equal(new Set(B.activites.map((a) => a.nom)).size, 18);
  for (const a of B.activites) {
    assert.ok(B.categories.includes(a.categorie), a.nom);
    assert.ok(a.jour >= 0 && a.jour <= 6 && a.debut < a.fin && a.capacite > 0, a.nom);
  }
  assert.equal(R.validerTranches(B.modelesTranches.unique), null);
  assert.equal(R.validerTranches(B.modelesTranches.exemple), null);
  assert.equal(B.rgpd.conservationDefaut, 3);
  assert.ok(B.rgpd.sources.every((s) => s.url.startsWith('https://www.cnil.fr/')));
});

test('dates : mois ajoutés en fin de mois, jour de la semaine, âge révolu', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-11-15', 2), '2027-01-15');
  assert.equal(R.jourSemaine('2026-11-13'), 4); // vendredi
  assert.equal(R.jourSemaine('2026-11-16'), 0); // lundi
  assert.equal(R.age('2016-11-14', AUJ), 9); // anniversaire demain
  assert.equal(R.age('2016-11-13', AUJ), 10); // anniversaire aujourd'hui
  assert.equal(R.age('2008-02-29', '2026-02-28'), 17);
  assert.equal(R.estMineur('2008-11-13', AUJ), false); // 18 ans aujourd'hui
  assert.equal(R.estMineur('2008-11-14', AUJ), true);
  assert.equal(R.age('', AUJ), null);
});

test('tranches : validation et tranche d\'un quotient (bornes incluses, sans quotient = dernière)', () => {
  const tr = B.modelesTranches.exemple.map((t, i) => ({ ...t, id: `t${i}` }));
  assert.equal(R.trancheDe(0, tr).nom, 'A');
  assert.equal(R.trancheDe(600, tr).nom, 'A');
  assert.equal(R.trancheDe(601, tr).nom, 'B');
  assert.equal(R.trancheDe(1200, tr).nom, 'C');
  assert.equal(R.trancheDe(5000, tr).nom, 'D');
  assert.equal(R.trancheDe(null, tr).nom, 'D');
  assert.equal(R.trancheDe('', tr).nom, 'D');
  assert.equal(R.trancheDe(800, [tr[3], tr[1], tr[0], tr[2]]).nom, 'B'); // ordre de saisie indifférent
  assert.match(R.validerTranches([]), /au moins une/);
  assert.match(R.validerTranches([{ nom: 'A', max: 500 }, { nom: 'B', max: 500 }, { nom: 'C', max: null }]), /même plafond/);
  assert.match(R.validerTranches([{ nom: 'A', max: 500 }, { nom: 'B', max: 900 }]), /sans plafond/);
  assert.match(R.validerTranches([{ nom: 'A', max: null }, { nom: 'B', max: null }]), /sans plafond/);
  assert.match(R.validerTranches([{ nom: '', max: null }]), /nom/);
  assert.match(R.validerTranches([{ nom: 'A', max: 12.5 }, { nom: 'B', max: null }]), /entiers/);
});

test('tarif d\'une inscription : tranche de la famille, ou tarif ajusté', () => {
  const E = etat();
  assert.equal(R.tarifInscription(E, inscr({ id: 'i1', m: 'm1' })), 90); // QF 650 → A
  assert.equal(R.tarifInscription(E, inscr({ id: 'i2', m: 'm3' })), 150); // sans QF → B
  assert.equal(R.tarifInscription(E, inscr({ id: 'i3', m: 'm3', tarif: 40 })), 40);
  assert.equal(R.tarifInscription(E, inscr({ id: 'i4', m: 'm3', tarif: 0 })), 0); // gratuité volontaire
});

test('places et liste d\'attente : file par date puis ordre, rang, promotion après annulation', () => {
  const E = etat();
  assert.equal(R.statutNouvelle(E, 'c1'), 'inscrit');
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1', date: '2026-09-02' }), inscr({ id: 'i2', m: 'm2', date: '2026-09-02', ordre: 1 }));
  assert.equal(R.statutNouvelle(E, 'c1'), 'attente');
  E.inscriptions.push(inscr({ id: 'i4', m: 'm3', date: '2026-09-04', statut: 'attente', ordre: 5 }));
  E.membres.push({ id: 'm4', familleId: 'f2', prenom: 'Lou', nom: 'Martin', naissance: '2017-01-01' });
  E.inscriptions.push(inscr({ id: 'i3', m: 'm4', date: '2026-09-03', statut: 'attente', ordre: 9 }));
  assert.deepEqual(R.fileAttente(E, 'c1').map((i) => i.id), ['i3', 'i4']);
  assert.equal(R.rangAttente(E, E.inscriptions.find((i) => i.id === 'i4')), 2);
  assert.deepEqual(R.occupation(E, 'c1'), { capacite: 2, inscrits: 2, attente: 2, libres: 0, taux: 1 });
  assert.deepEqual(R.aPromouvoir(E, 'c1'), []);
  E.inscriptions.find((i) => i.id === 'i1').statut = 'annule';
  assert.deepEqual(R.aPromouvoir(E, 'c1').map((i) => i.id), ['i3']);
  E.activites[0].creneaux[0].capacite = 5; // hausse de capacité : toute la file passe
  assert.deepEqual(R.aPromouvoir(E, 'c1').map((i) => i.id), ['i3', 'i4']);
  assert.equal(R.dejaInscrit(E, 'm1', 'c1'), false); // annulée
  assert.equal(R.dejaInscrit(E, 'm2', 'c1'), true);
  assert.equal(R.dejaInscrit(E, 'm2', 'c2'), false);
});

test('dû d\'une famille : adhésion par famille ou par personne, attente et annulation non dues', () => {
  const E = etat();
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }), inscr({ id: 'i2', m: 'm2', c: 'c2' }), inscr({ id: 'i3', m: 'm2', statut: 'attente' }), inscr({ id: 'i4', m: 'm1', c: 'c2', statut: 'annule' }));
  assert.deepEqual(R.duFamille(E, 'f1').total, 15 + 90 + 90);
  E.association.adhesion.par = 'personne';
  assert.equal(R.duFamille(E, 'f1').adhesion, 30);
  assert.equal(R.duFamille(E, 'f2').total, 0); // aucune inscription : pas d'adhésion due
});

test('échéancier : répartition au centime, reste sur la première, une échéance par mois', () => {
  assert.deepEqual(R.echeancier(100, 3, '2026-09-30'), [
    { date: '2026-09-30', montant: 33.34 }, { date: '2026-10-30', montant: 33.33 }, { date: '2026-11-30', montant: 33.33 }]);
  assert.deepEqual(R.echeancier(195, 1, '2026-09-10'), [{ date: '2026-09-10', montant: 195 }]);
  assert.deepEqual(R.echeancier(0, 3, '2026-09-10'), []);
  assert.equal(R.echeancier(10, 99, '2026-09-10').length, 10); // plafonné à 10
  const total = R.echeancier(250.01, 7, '2026-09-01').reduce((s, e) => s + R.cts(e.montant), 0);
  assert.equal(total, 25001);
});

test('situation : retard = échu non payé, échéance du jour pas en retard, trop-perçu', () => {
  const E = etat();
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }), inscr({ id: 'i2', m: 'm2', c: 'c2' })); // 15 + 90 + 90 = 195 en 3 fois dès le 10/09
  let s = R.situation(E, 'f1', AUJ); // échéances 10/09, 10/10, 10/11 : toutes passées
  assert.deepEqual(s.echeances.map((e) => e.montant), [65, 65, 65]);
  assert.equal(s.retard, 195);
  assert.equal(s.depuis, '2026-09-10');
  E.paiements.push({ id: 'p1', familleId: 'f1', date: '2026-09-10', montant: 65 }, { id: 'p2', familleId: 'f1', date: '2026-10-12', montant: 70 });
  s = R.situation(E, 'f1', AUJ);
  assert.equal(s.paye, 135);
  assert.equal(s.retard, 60);
  assert.equal(s.depuis, '2026-11-10');
  assert.equal(s.reste, 60);
  s = R.situation(E, 'f1', '2026-11-10'); // échéance le jour même : pas encore en retard
  assert.equal(s.retard, 0);
  assert.equal(s.prochaine.date, '2026-11-10');
  E.paiements.push({ id: 'p3', familleId: 'f1', date: '2026-11-11', montant: 70 });
  s = R.situation(E, 'f1', AUJ);
  assert.equal(s.reste, -10); // trop-perçu
  assert.equal(s.retard, 0);
  assert.equal(R.impayes(E, AUJ).length, 0);
});

test('départ des échéances : date de la famille, sinon première inscription, sinon début de saison', () => {
  const E = etat();
  assert.equal(R.departEcheances(E, 'f1'), '2026-09-10');
  E.inscriptions.push(inscr({ id: 'i1', m: 'm3', date: '2026-10-02' }), inscr({ id: 'i0', m: 'm3', c: 'c2', date: '2026-09-20', statut: 'attente' }));
  assert.equal(R.departEcheances(E, 'f2'), '2026-10-02');
  E.inscriptions = [];
  assert.equal(R.departEcheances(E, 'f2'), '2026-09-01');
});

test('impayés triés par ancienneté et indicateurs du tableau de bord', () => {
  const E = etat();
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }), inscr({ id: 'i2', m: 'm3', date: '2026-10-01' }), inscr({ id: 'i3', m: 'm2', statut: 'attente' }));
  const imp = R.impayes(E, AUJ);
  assert.deepEqual(imp.map((x) => x.famille.id), ['f1', 'f2']);
  const k = R.indicateurs(E, AUJ);
  assert.equal(k.inscriptions, 2);
  assert.equal(k.attente, 1);
  assert.equal(k.adherents, 2);
  assert.equal(k.capacite, 12);
  assert.equal(k.complets, 1);
  assert.equal(k.du, 15 + 90 + 15 + 150);
  assert.equal(k.retard, 105 + 165); // f1 : 3 échéances de 35 (10/09, 10/10, 10/11) passées ; f2 : 1 échéance de 165 le 01/10
  assert.equal(k.reste, 270);
  assert.equal(k.famillesRetard, 2);
});

test('fermetures : lecture des périodes, séances hors fermetures, mois de la saison', () => {
  const { fermetures, erreurs } = R.lireFermetures('19/12/2026 - 03/01/2027 Vacances de fin d\'année\n11/11/2026 Férié\nn\'importe quoi\n05/01/2027 - 01/01/2027');
  assert.deepEqual(erreurs, [3, 4]);
  assert.deepEqual(fermetures, [{ debut: '2026-11-11', fin: '2026-11-11', nom: 'Férié' }, { debut: '2026-12-19', fin: '2027-01-03', nom: 'Vacances de fin d\'année' }]);
  assert.equal(R.ecrireFermetures(fermetures), '11/11/2026 Férié\n19/12/2026 - 03/01/2027 Vacances de fin d\'année');
  const saison = { debut: '2026-11-01', fin: '2027-01-15', fermetures };
  const mercredis = R.seances(2, saison);
  assert.deepEqual(mercredis, ['2026-11-04', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16', '2027-01-06', '2027-01-13']);
  assert.deepEqual(R.moisSaison({ debut: '2026-09-01', fin: '2027-06-30' }).length, 10);
  assert.deepEqual(R.moisSaison(saison), ['2026-11', '2026-12', '2027-01']);
});

test('fiches à compléter : mineur sans responsable ni urgence, quotient, mentions, naissance', () => {
  const E = etat();
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }), inscr({ id: 'i2', m: 'm3' }));
  const motifs = R.aCompleter(E, AUJ).map((x) => `${x.famille.id} ${x.motif}`);
  assert.deepEqual(motifs, ['f2 Mineur sans responsable légal', 'f2 Mineur sans contact d\'urgence', 'f2 Quotient familial non renseigné (tarif de la dernière tranche)', 'f2 Mentions d\'information non remises']);
  E.tranches = [{ id: 'u', nom: 'Tarif unique', max: null }];
  assert.equal(R.aCompleter(E, AUJ).filter((x) => /Quotient/.test(x.motif)).length, 0);
});

test('nouvelle saison et durée de conservation', () => {
  const E = etat();
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }));
  E.paiements.push({ id: 'p1', familleId: 'f1', date: '2026-09-10', montant: 50 });
  const N = R.nouvelleSaison(E, { nom: '2027-2028', debut: '2027-09-01', fin: '2028-06-30' });
  assert.equal(N.inscriptions.length, 0);
  assert.equal(N.paiements.length, 0);
  assert.equal(N.familles.find((f) => f.id === 'f1').derniereFin, '2027-06-30');
  assert.equal(N.familles.find((f) => f.id === 'f1').depart, null);
  assert.equal(N.familles.find((f) => f.id === 'f2').derniereFin, null);
  assert.equal(E.inscriptions.length, 1); // l'original n'est pas modifié
  assert.deepEqual(R.aPurger(N, '2030-06-30', 3).map((f) => f.id), []);
  assert.deepEqual(R.aPurger(N, '2030-07-01', 3).map((f) => f.id), ['f1']);
  assert.deepEqual(R.aPurger(N, '2030-07-01', 5).map((f) => f.id), []);
  assert.deepEqual(R.aPurger(E, '2040-01-01', 3).map((f) => f.id), []); // inscription en cours : jamais
  assert.deepEqual(R.saisonProposee('2026-11-13'), { nom: '2026-2027', debut: '2026-09-01', fin: '2027-06-30' });
  assert.deepEqual(R.saisonProposee('2027-03-01').nom, '2026-2027');
  assert.deepEqual(R.saisonProposee('2027-08-02').nom, '2027-2028');
});

test('export CSV : BOM, point-virgule, formules neutralisées, statuts et rangs', () => {
  const E = etat();
  E.familles[0].nom = '=Durand; "fils"';
  E.inscriptions.push(inscr({ id: 'i1', m: 'm1' }), inscr({ id: 'i2', m: 'm2' }), inscr({ id: 'i3', m: 'm3', statut: 'attente', date: '2026-09-06' }));
  const csv = R.csvInscriptions(E, AUJ);
  assert.ok(csv.startsWith('﻿Famille;Prénom;Nom;Naissance;Âge;Mineur;'));
  const lignes = csv.trim().split('\r\n');
  assert.equal(lignes.length, 4);
  assert.ok(lignes.some((l) => l.startsWith('"\'=Durand; ""fils"""') && l.includes(';Léo;Durand;14/11/2016;9;Oui;Judo;') && l.endsWith(';Inscrit;;05/09/2026;A;90,00')));
  assert.ok(lignes.some((l) => l.includes(';Liste d\'attente;1;06/09/2026;B;')));
  const soldes = R.csvSoldes(E, AUJ).trim().split('\r\n');
  assert.equal(soldes.length, 3);
  assert.ok(soldes.some((l) => l.startsWith('Martin;;B;0,00;0,00;0,00;0,00;0,00;0,00;')));
  assert.equal(R.champCsv('-3'), '\'-3');
  assert.equal(R.champCsv('a\nb'), '"a\nb"');
});
