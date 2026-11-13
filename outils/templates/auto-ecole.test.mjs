// Tests des règles métier de la gestion d'auto-école (templates/auto-ecole/regles.js et donnees.js).
// Date de référence fixe : aucun test ne dépend de la date du jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/auto-ecole/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-12'; // jeudi

const reglages = (o = {}) => ({ ...B.reglagesDefaut, competences: [...B.competences], ...o });
const dispos = { 1: [[480, 720], [840, 1140]], 2: [[480, 720], [840, 1140]], 3: [[480, 720]], 4: [[480, 720], [840, 1140]], 5: [[480, 720], [840, 1140]], 6: [[480, 720]] };
const etatBase = (o = {}) => ({
  reglages: reglages(),
  eleves: [{ id: 'e1', nom: 'Inès B.', boite: 'manuelle', statut: 'actif', competences: {} }, { id: 'e2', nom: 'Tom R.', boite: 'auto', statut: 'actif', competences: {} }],
  moniteurs: [{ id: 'm1', nom: 'Karim', dispos, absences: [] }, { id: 'm2', nom: 'Sophie', dispos, absences: [{ id: 'a', debut: '2026-11-12', fin: '2026-11-13', motif: 'Formation' }] }],
  vehicules: [{ id: 'v1', nom: 'Citadine 1', boite: 'manuelle', dateEntree: '2025-11-13', kmEntree: 20000, coutMensuel: 365.25, entretienKm: 15000, entretienMois: 12 }],
  achats: [], paiements: [], lecons: [], releves: [], interventionsV: [],
  ...o,
});
const lecon = (o = {}) => ({ id: 'l', eleveId: 'e1', moniteurId: 'm1', vehiculeId: 'v1', date: AUJ, debut: '10:00', duree: 60, statut: 'prevue', ...o });

test('base intégrée : 10 compétences génériques, réglages de départ, contrôle technique sourcé', () => {
  assert.equal(B.competences.length, 10);
  assert.equal(new Set(B.competences).size, 10);
  assert.deepEqual(B.reglagesDefaut.joursOuverts, [1, 2, 3, 4, 5, 6]);
  assert.equal(B.reglagesDefaut.periodiciteCT, null, 'aucune périodicité imposée');
  assert.match(B.controleTechnique.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
  assert.equal(B.couleurs.length, 6);
});

test('dates : ajout de mois borné à la fin du mois, jour de semaine, lundi', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-11-12', -12), '2025-11-12');
  assert.equal(R.ajoutMois('2026-12-15', 2), '2027-02-15');
  assert.equal(R.jourSemaine(AUJ), 4);
  assert.equal(R.jourSemaine('2026-11-15'), 7);
  assert.equal(R.lundi(AUJ), '2026-11-09');
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
  assert.equal(R.ajout('2026-12-28', 7), '2027-01-04');
});

test('heures et plages : lecture, écriture, erreurs lisibles', () => {
  assert.equal(R.minutes('08:30'), 510);
  assert.equal(R.hhmm(1140), '19:00');
  assert.deepEqual(R.lirePlages('14:00-19:00, 08:00-12:00'), [[480, 720], [840, 1140]]);
  assert.deepEqual(R.lirePlages('8h00-12h00'), [[480, 720]]);
  assert.deepEqual(R.lirePlages(''), []);
  assert.equal(R.ecrirePlages([[480, 720], [840, 1140]]), '08:00-12:00, 14:00-19:00');
  assert.throws(() => R.lirePlages('12:00-08:00'), /finit avant/);
  assert.throws(() => R.lirePlages('08:00-12:00, 11:00-13:00'), /chevauchent/);
  assert.throws(() => R.lirePlages('matin'), /illisible/);
  assert.equal(R.dureePlages([[480, 720], [840, 1140]]), 540);
});

test('chevauchement : [début, fin[, bord à bord accepté, annulée ignorée', () => {
  const a = lecon({ id: 'a', debut: '10:00', duree: 60 });
  assert.equal(R.chevauchent(a, lecon({ id: 'b', debut: '11:00' })), false);
  assert.equal(R.chevauchent(a, lecon({ id: 'b', debut: '09:00' })), false);
  assert.equal(R.chevauchent(a, lecon({ id: 'b', debut: '10:30' })), true);
  assert.equal(R.chevauchent(a, lecon({ id: 'b', debut: '09:30', duree: 120 })), true);
  assert.equal(R.chevauchent(a, lecon({ id: 'b', date: '2026-11-13' })), false);
  assert.deepEqual(R.conflits(a, [lecon({ id: 'b', debut: '10:30', statut: 'annulee' })]), []);
  assert.deepEqual(R.conflits(lecon({ id: 'a', statut: 'annulee' }), [lecon({ id: 'b' })]), []);
});

test('conflits : même moniteur, même véhicule ou même élève, motifs cumulés', () => {
  const a = lecon({ id: 'a' });
  const autres = [
    lecon({ id: 'b', eleveId: 'e2', moniteurId: 'm2', vehiculeId: 'v2' }), // aucun point commun
    lecon({ id: 'c', eleveId: 'e2', moniteurId: 'm1', vehiculeId: 'v2' }), // moniteur
    lecon({ id: 'd', eleveId: 'e2', moniteurId: 'm2', vehiculeId: 'v1', debut: '10:45', duree: 30 }), // véhicule
    lecon({ id: 'e', eleveId: 'e1', moniteurId: 'm2', vehiculeId: 'v2', debut: '09:30' }), // élève
    lecon({ id: 'a' }), // elle-même
  ];
  const c = R.conflits(a, autres);
  assert.deepEqual(c.map((x) => [x.lecon.id, x.motifs]), [['c', ['moniteur']], ['d', ['vehicule']], ['e', ['eleve']]]);
  assert.deepEqual(R.conflits(a, [lecon({ id: 'z' })])[0].motifs, ['moniteur', 'vehicule', 'eleve']);
});

test('disponibilités : plage du jour, absences incluses, ouverture', () => {
  const E = etatBase();
  const [m1, m2] = E.moniteurs;
  assert.equal(R.dansDispo(lecon({ debut: '11:00' }), m1), true); // 11:00-12:00 dans 08:00-12:00
  assert.equal(R.dansDispo(lecon({ debut: '11:30' }), m1), false); // déborde sur la pause
  assert.equal(R.dansDispo(lecon({ debut: '14:00' }), m1), true);
  assert.equal(R.dansDispo(lecon({ date: '2026-11-11', debut: '14:00' }), m1), false); // mercredi après-midi non dispo
  assert.equal(R.dansDispo(lecon({ date: '2026-11-15' }), m1), false); // dimanche
  assert.equal(R.dansDispo(lecon({}), m2), false); // absente le 12
  assert.equal(R.dansDispo(lecon({ date: '2026-11-13' }), m2), false); // fin d'absence incluse
  assert.equal(R.dansDispo(lecon({ date: '2026-11-14' }), m2), true);
  assert.equal(R.dansOuverture(lecon({ debut: '19:00' }), E.reglages), true);
  assert.equal(R.dansOuverture(lecon({ debut: '19:30' }), E.reglages), false);
  assert.equal(R.dansOuverture(lecon({ date: '2026-11-15' }), E.reglages), false);
});

test('vérification complète : champs, conflit nommé, forcer hors disponibilité mais jamais un conflit', () => {
  const noms = { eleve: (id) => ({ e1: 'Inès B.', e2: 'Tom R.' }[id]), moniteur: (id) => ({ m1: 'Karim', m2: 'Sophie' }[id]), vehicule: () => 'Citadine 1' };
  const E = etatBase({ lecons: [lecon({ id: 'x', eleveId: 'e2', debut: '10:30' })] });
  let v = R.verifierLecon(lecon({ id: 'n', duree: 10 }), E);
  assert.match(v.erreurs[0], /Durée/);
  v = R.verifierLecon(lecon({ id: 'n', eleveId: '' }), E);
  assert.match(v.erreurs[0], /élève/);
  v = R.verifierLecon(lecon({ id: 'n' }), E, true, noms);
  assert.equal(v.erreurs.length, 1);
  assert.match(v.erreurs[0], /Conflit \(moniteur Karim, véhicule Citadine 1\) avec la leçon de 10:30 à 11:30 : Tom R\. avec Karim/);
  v = R.verifierLecon(lecon({ id: 'n', debut: '08:00' }), E);
  assert.deepEqual(v.erreurs, []);
  v = R.verifierLecon(lecon({ id: 'n', debut: '12:00' }), E);
  assert.equal(v.horsDispo, true);
  assert.match(v.erreurs[0], /Hors des disponibilités/);
  assert.deepEqual(R.verifierLecon(lecon({ id: 'n', debut: '12:00' }), E, true).erreurs, []);
  v = R.verifierLecon(lecon({ id: 'n', moniteurId: 'm2', vehiculeId: 'v2' }), E);
  assert.match(v.erreurs[0], /absent/);
  v = R.verifierLecon(lecon({ id: 'n', date: '2026-11-15', debut: '08:00' }), E);
  assert.equal(v.horsOuverture, true);
});

test('solde d\'heures et solde financier d\'un élève, absence décomptée ou non', () => {
  const E = etatBase({
    achats: [{ id: 'a1', eleveId: 'e1', date: '2026-09-01', heures: 20, montant: 1000 }, { id: 'a2', eleveId: 'e1', date: '2026-11-01', heures: 5, montant: 260 }, { id: 'a3', eleveId: 'e2', date: '2026-11-01', heures: 10, montant: 500 }],
    paiements: [{ id: 'p1', eleveId: 'e1', date: '2026-09-01', montant: 600 }, { id: 'p2', eleveId: 'e1', date: '2026-10-01', montant: 400 }],
    lecons: [
      ...Array.from({ length: 18 }, (_, i) => lecon({ id: `f${i}`, date: R.ajout('2026-09-07', i * 3), statut: 'faite' })),
      lecon({ id: 'ab', date: '2026-11-05', statut: 'absent' }),
      lecon({ id: 'an', date: '2026-11-06', statut: 'annulee' }),
      lecon({ id: 'pp', date: '2026-11-10', statut: 'prevue' }), // passée, non pointée
      lecon({ id: 'p1', date: '2026-11-16', debut: '14:00', duree: 120, statut: 'prevue' }),
      lecon({ id: 'p0', date: '2026-11-14', debut: '09:00', duree: 90, statut: 'prevue' }),
    ],
  });
  let s = R.soldeEleve('e1', E, AUJ);
  assert.equal(s.achetees, 25);
  assert.equal(s.faites, 19); // 18 faites + 1 absence décomptée
  assert.equal(s.planifiees, 4.5); // 1 + 2 + 1,5
  assert.equal(s.restantes, 6);
  assert.equal(s.aPlanifier, 1.5);
  assert.equal(s.facture, 1260);
  assert.equal(s.paye, 1000);
  assert.equal(s.du, 260);
  assert.equal(s.aPointer, 1);
  assert.equal(s.prochaine, '2026-11-14 09:00');
  assert.equal(s.derniere, '2026-11-05');
  E.reglages.decompteAbsence = false;
  s = R.soldeEleve('e1', E, AUJ);
  assert.equal(s.faites, 18);
  assert.equal(s.restantes, 7);
  const vide = R.soldeEleve('e9', E, AUJ);
  assert.equal(vide.achetees, 0);
  assert.equal(vide.prochaine, null);
});

test('progression des compétences', () => {
  const comp = ['A', 'B', 'C', 'D'];
  assert.deepEqual(R.progression({ competences: { A: '2026-10-01', C: '2026-11-01', Z: '2026-01-01' } }, comp), { acquises: 2, total: 4, taux: 50 });
  assert.deepEqual(R.progression({}, []), { acquises: 0, total: 0, taux: 0 });
});

test('kilométrage et relevés : plus grand relevé, relevé incohérent refusé', () => {
  const E = etatBase({ releves: [{ vehiculeId: 'v1', date: '2026-06-01', km: 28000 }, { vehiculeId: 'v1', date: '2026-10-01', km: 34000 }], interventionsV: [{ vehiculeId: 'v1', type: 'entretien', date: '2026-08-01', km: 31000 }] });
  const v = E.vehicules[0];
  assert.equal(R.kmActuel(v, E), 34000);
  assert.equal(R.releveValide(v, E, '2026-11-01', 35000), null);
  assert.match(R.releveValide(v, E, '2026-11-01', 33000), /inférieur.*34000/);
  assert.match(R.releveValide(v, E, '2026-07-01', 32000), /supérieur.*31000/);
  assert.equal(R.releveValide(v, E, '2026-07-01', 30000), null);
});

test('entretien : la première échéance atteinte compte (km ou date), inconnu sans intervalle', () => {
  const E = etatBase({ interventionsV: [{ vehiculeId: 'v1', type: 'entretien', date: '2026-03-10', km: 26000 }], releves: [{ vehiculeId: 'v1', date: '2026-11-01', km: 40500 }] });
  const v = E.vehicules[0];
  let e = R.entretien(v, E, AUJ, E.reglages);
  assert.equal(e.echeanceKm, 41000);
  assert.equal(e.echeanceDate, '2027-03-10');
  assert.equal(e.etat, 'proche'); // 500 km restants ≤ 1000
  E.releves.push({ vehiculeId: 'v1', date: AUJ, km: 41000 });
  assert.equal(R.entretien(v, E, AUJ, E.reglages).etat, 'retard');
  // Sans entretien enregistré : référence = entrée du véhicule (2025-11-13 + 12 mois).
  const E2 = etatBase();
  e = R.entretien(E2.vehicules[0], E2, AUJ, E2.reglages);
  assert.equal(e.echeanceDate, '2026-11-13');
  assert.equal(e.echeanceKm, 35000);
  assert.equal(e.etat, 'proche');
  assert.equal(R.entretien(E2.vehicules[0], E2, '2026-11-13', E2.reglages).etat, 'retard');
  assert.equal(R.entretien({ id: 'v9' }, E2, AUJ, E2.reglages).etat, 'inconnu');
});

test('contrôle technique : date limite saisie, dernier contrôle prioritaire, proposition selon la périodicité réglée', () => {
  const E = etatBase();
  const v = { ...E.vehicules[0], ctProchain: '2026-12-01' };
  let c = R.controle(v, E, AUJ, E.reglages);
  assert.deepEqual([c.etat, c.date, c.jours], ['proche', '2026-12-01', 19]);
  assert.equal(R.controle({ ...v, ctProchain: AUJ }, E, AUJ, E.reglages).etat, 'proche'); // dernier jour valable
  assert.equal(R.controle({ ...v, ctProchain: '2026-11-11' }, E, AUJ, E.reglages).etat, 'retard');
  assert.equal(R.controle({ ...v, ctProchain: '2027-06-01' }, E, AUJ, E.reglages).etat, 'ok');
  assert.equal(R.controle({ ...v, ctProchain: '' }, E, AUJ, E.reglages).etat, 'inconnu');
  E.interventionsV.push({ vehiculeId: 'v1', type: 'ct', date: '2026-11-02', prochainCT: '2027-11-01' });
  c = R.controle(v, E, AUJ, E.reglages);
  assert.equal(c.date, '2027-11-01');
  assert.equal(c.etat, 'ok');
  assert.equal(R.proposerCT('2026-11-02', 12), '2027-11-01');
  assert.equal(R.proposerCT('2026-11-02', 24), '2028-11-01');
  assert.equal(R.proposerCT('2026-11-02', null), null);
});

test('coût par heure de conduite : interventions + coût fixe au prorata des jours, ÷ heures décomptées', () => {
  const E = etatBase({
    interventionsV: [{ vehiculeId: 'v1', type: 'entretien', date: '2026-03-10', cout: 300 }, { vehiculeId: 'v1', type: 'carburant', date: '2026-11-01', cout: 100 }, { vehiculeId: 'v1', type: 'autre', date: '2025-01-01', cout: 999 }],
    lecons: [lecon({ id: 'a', date: '2026-11-02', statut: 'faite', duree: 120 }), lecon({ id: 'b', date: '2026-11-03', statut: 'absent' }), lecon({ id: 'c', date: '2026-11-04', statut: 'annulee' }), lecon({ id: 'd', date: '2026-11-20', statut: 'prevue' })],
  });
  // Période de 365 jours ; coutMensuel 365,25 € → 12 € par jour.
  const k = R.coutVehicule(E.vehicules[0], E, '2025-11-13', AUJ);
  assert.equal(k.couts, 400);
  assert.equal(k.fixe, 4380);
  assert.equal(k.heures, 3);
  assert.equal(k.total, 4780);
  assert.equal(k.parHeure, 1593.33);
  // Entrée en cours de période : prorata depuis l'entrée (2025-11-13 → 2025-11-22 = 10 jours).
  const k2 = R.coutVehicule(E.vehicules[0], E, '2025-11-01', '2025-11-22');
  assert.equal(k2.fixe, 120);
  assert.equal(k2.parHeure, null);
});

test('occupation de la semaine : véhicules sur les heures ouvertes, moniteurs sur leurs disponibilités hors absences', () => {
  const E = etatBase({ lecons: [lecon({ id: 'a', date: '2026-11-09', duree: 120 }), lecon({ id: 'b', date: '2026-11-10' }), lecon({ id: 'c', date: '2026-11-11', statut: 'annulee' }), lecon({ id: 'd', date: '2026-11-16' }), lecon({ id: 'e', moniteurId: 'm2', date: '2026-11-14', vehiculeId: 'v2' })] });
  const o = R.occupation('2026-11-09', E);
  assert.deepEqual(o.vehicules, [{ id: 'v1', heures: 3, dispo: 72, taux: 4 }]); // 6 jours × 12 h
  assert.deepEqual(o.moniteurs[0], { id: 'm1', heures: 3, dispo: 44, taux: 7 }); // 9+9+4+9+9+4 h
  assert.deepEqual(o.moniteurs[1], { id: 'm2', heures: 1, dispo: 26, taux: 4 }); // absente jeudi et vendredi
});

test('heures vendues et faites par mois, 6 mois glissants', () => {
  const E = etatBase({
    achats: [{ eleveId: 'e1', date: '2026-06-15', heures: 20, montant: 1000 }, { eleveId: 'e2', date: '2026-11-02', heures: 5, montant: 250 }, { eleveId: 'e2', date: '2026-05-31', heures: 9, montant: 1 }],
    paiements: [{ eleveId: 'e1', date: '2026-11-03', montant: 200 }],
    lecons: [lecon({ id: 'a', date: '2026-11-02', statut: 'faite', duree: 90 }), lecon({ id: 'b', date: '2026-07-01', statut: 'absent' }), lecon({ id: 'c', date: '2026-11-20' })],
  });
  const m = R.parMois(E, AUJ);
  assert.deepEqual(m.map((x) => x.mois), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(m[0], { mois: '2026-06', vendues: 20, faites: 0, encaisse: 0 });
  assert.equal(m[1].faites, 1);
  assert.deepEqual(m[5], { mois: '2026-11', vendues: 5, faites: 1.5, encaisse: 200 });
  assert.equal(R.parMois(E, '2027-01-05', 3)[0].mois, '2026-11');
});

test('alertes : triées par gravité, élève terminé ignoré', () => {
  const E = etatBase({
    vehicules: [{ id: 'v1', nom: 'Citadine 1', ctProchain: '2026-11-01', kmEntree: 0 }, { id: 'v2', nom: 'Citadine 2', ctProchain: '2026-12-01' }, { id: 'v3', nom: 'Auto 3' }, { id: 'v4', nom: 'Vendue', actif: false }],
    eleves: [{ id: 'e1', nom: 'Inès B.', statut: 'actif' }, { id: 'e2', nom: 'Tom R.', statut: 'actif' }, { id: 'e3', nom: 'Lou P.', statut: 'termine' }],
    achats: [{ eleveId: 'e1', date: '2026-10-01', heures: 1, montant: 50 }, { eleveId: 'e3', date: '2026-10-01', heures: 1, montant: 50 }],
    lecons: [lecon({ id: 'a', date: '2026-10-05', statut: 'faite', duree: 120 }), lecon({ id: 'b', eleveId: 'e2', date: '2026-11-10' })],
  });
  const a = R.alertes(E, AUJ);
  assert.deepEqual(a.map((x) => [x.niveau, x.type, x.id]), [
    ['retard', 'ct', 'v1'], ['retard', 'heures', 'e1'], ['retard', 'paiement', 'e1'],
    ['proche', 'heures', 'e2'], ['proche', 'pointage', 'e2'], ['proche', 'ct', 'v2'], ['info', 'ct', 'v3'],
  ]);
  assert.match(a[1].texte, /1 h faites au-delà/);
});

test('CSV : BOM, point-virgule, décimales à la virgule, formules neutralisées', () => {
  assert.equal(R.champCsv('=SOMME(A1)'), "'=SOMME(A1)");
  assert.equal(R.champCsv('-5'), "'-5");
  assert.equal(R.champCsv(-5.5), '-5,5');
  assert.equal(R.champCsv('a;b'), '"a;b"');
  assert.equal(R.champCsv('dit "oui"'), '"dit ""oui"""');
  const E = etatBase({ achats: [{ eleveId: 'e1', date: '2026-10-01', heures: 2.5, montant: 125 }], lecons: [lecon({ id: 'a', date: '2026-10-05', statut: 'faite', duree: 90, note: '=1+1' })] });
  const el = R.csvEleves(E, AUJ);
  assert.ok(el.startsWith('﻿Élève;Statut'));
  assert.match(el, /Inès B\.;Actif;Manuelle;;2,5;1,5;0;1;125;0;125;0\/10;05\/10\/2026;/);
  const le = R.csvLecons(E, '2026-10-01', '2026-10-31');
  assert.match(le, /05\/10\/2026;10:00;11:30;90;Inès B\.;Karim;Citadine 1;Faite;'=1\+1/);
  assert.equal(R.csvLecons(E, '2026-11-01', '2026-11-30').trim().split('\r\n').length, 1);
  const ve = R.csvVehicules(E, AUJ);
  assert.match(ve, /Citadine 1;;Manuelle;20000;;35000;13\/11\/2026;/);
});
