// Tests des règles métier du suivi des congés et absences (templates/conges/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/conges/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CNG;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const DEFAUTS = { reglages: { ...BASE.reglages, debutSuivi: '2025-06-01' }, types: BASE.types, couleurs: BASE.couleurs };
const etat = (extra = {}) => {
  const e = R.etatVide(DEFAUTS);
  e.equipes = [{ id: 'atelier', nom: 'Atelier', maxAbsents: 1 }];
  e.salaries = [R.normaliserSalarie({ id: 's1', prenom: 'Ana', nom: 'Exemple', equipe: 'atelier', entree: '2020-01-06' })];
  return Object.assign(e, extra);
};
const abs = (x) => R.normaliserAbsence({ id: x.id || 'a', salarie: 's1', type: 'cp', statut: 'validee', ...x });

test('Pâques et jours fériés calculés', () => {
  assert.equal(R.paques(2024), '2024-03-31');
  assert.equal(R.paques(2025), '2025-04-20');
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  assert.equal(R.paques(2038), '2038-04-25');
  const f = Object.fromEntries(R.feries(2026).map((x) => [x.id, x.date]));
  assert.equal(f.lundiPaques, '2026-04-06');
  assert.equal(f.ascension, '2026-05-14');
  assert.equal(f.lundiPentecote, '2026-05-25');
  assert.equal(f.vendrediSaint, '2026-04-03');
  assert.equal(R.feries(2026).length, 13);
  const reg = R.etatVide(DEFAUTS).reglages;
  assert.equal(reg.feriesChomes.length, 11); // Alsace-Moselle non coché par défaut
  assert.equal(R.ferieChome('2026-12-25', reg)?.nom, 'Noël');
  assert.equal(R.ferieChome('2026-12-26', reg), null);
  assert.equal(R.ferieChome('2026-12-26', { ...reg, feriesChomes: [...reg.feriesChomes, 'dec26'] })?.id, 'dec26');
});

test('décompte : semaine de congé en jours ouvrables (6) et en jours ouvrés (5)', () => {
  const e = etat();
  const semaine = abs({ debut: '2026-03-02', fin: '2026-03-06' }); // lundi → vendredi
  assert.equal(R.decompte(semaine, e.types, e.reglages), 6); // le samedi est décompté
  assert.equal(R.decompte(semaine, e.types, { ...e.reglages, decompte: 'ouvres' }), 5);
  // Deux semaines : 12 ouvrables, 10 ouvrés.
  const deux = abs({ debut: '2026-03-02', fin: '2026-03-13' });
  assert.equal(R.decompte(deux, e.types, e.reglages), 12);
  assert.equal(R.decompte(deux, e.types, { ...e.reglages, decompte: 'ouvres' }), 10);
  // Un congé qui s'arrête un mercredi n'emporte pas le samedi.
  assert.equal(R.decompte(abs({ debut: '2026-03-02', fin: '2026-03-04' }), e.types, e.reglages), 3);
  // Férié chômé dans le congé : non décompté (lundi de Pâques 06/04/2026).
  assert.equal(R.decompte(abs({ debut: '2026-04-06', fin: '2026-04-10' }), e.types, e.reglages), 5);
  assert.equal(R.decompte(abs({ debut: '2026-04-06', fin: '2026-04-10' }), e.types, { ...e.reglages, decompte: 'ouvres' }), 4);
  // Les RTT se décomptent toujours en jours ouvrés.
  assert.equal(R.decompte(abs({ type: 'rtt', debut: '2026-03-02', fin: '2026-03-06' }), e.types, e.reglages), 5);
  // Une absence sans décompte (maladie) ne débite rien.
  assert.equal(R.decompte(abs({ type: 'maladie', debut: '2026-03-02', fin: '2026-03-06' }), e.types, e.reglages), 0);
});

test('décompte : demi-journées et bornes', () => {
  const e = etat();
  const reg = { ...e.reglages, decompte: 'ouvres' };
  assert.equal(R.decompte(abs({ debut: '2026-03-04', fin: '2026-03-04', demiFin: true }), e.types, reg), 0.5);
  assert.equal(R.decompte(abs({ debut: '2026-03-04', fin: '2026-03-06', demiDebut: true }), e.types, reg), 2.5);
  assert.equal(R.decompte(abs({ debut: '2026-03-04', fin: '2026-03-06', demiDebut: true, demiFin: true }), e.types, reg), 2);
  // Demi-journée le vendredi en ouvrables : pas de samedi emporté.
  assert.equal(R.decompte(abs({ debut: '2026-03-02', fin: '2026-03-06', demiFin: true }), e.types, e.reglages), 4.5);
  // Bornes : partie passée et partie à venir d'un congé en cours.
  const a = abs({ debut: '2026-03-02', fin: '2026-03-13' });
  assert.equal(R.decompte(a, e.types, reg, { a: '2026-03-06' }) + R.decompte(a, e.types, reg, { de: '2026-03-07' }), 10);
});

test('période de référence : 1er juin – 31 mai, ou année civile', () => {
  const reg = R.etatVide(DEFAUTS).reglages;
  assert.deepEqual(simple(R.periode('2026-11-14', reg)), { debut: '2026-06-01', fin: '2027-05-31' });
  assert.deepEqual(simple(R.periode('2026-05-31', reg)), { debut: '2025-06-01', fin: '2026-05-31' });
  assert.deepEqual(simple(R.periode('2026-11-14', { ...reg, moisDebut: 1 })), { debut: '2026-01-01', fin: '2026-12-31' });
  assert.equal(R.libellePeriode(R.periode('2026-11-14', reg)), '2026-2027');
  assert.equal(R.libellePeriode(R.periode('2026-11-14', { ...reg, moisDebut: 1 })), '2026');
});

test('acquisition : 30 jours ouvrables sur une période complète, arrondi supérieur à la clôture', () => {
  const e = etat();
  const p = { debut: '2025-06-01', fin: '2026-05-31' };
  const s = e.salaries[0];
  assert.equal(R.acquisition(s, [], e.types, e.reglages, p, '2026-11-14').acquis, 30);
  // En jours ouvrés : 25 (12 × 2,0833 = 24,9996, arrondi à 25).
  const ouvres = { ...e.reglages, decompte: 'ouvres', acquisition: BASE.acquisitions.ouvres };
  assert.equal(R.acquisition(s, [], e.types, ouvres, p, '2026-11-14').acquis, 25);
  // Entrée le 16/09/2025 : 15/30 × 2,5 + 8 mois × 2,5 = 21,25 → 22 à la clôture.
  const nouveau = { ...s, entree: '2025-09-16' };
  assert.equal(R.acquisition(nouveau, [], e.types, e.reglages, p, '2026-11-14').acquis, 22);
  assert.equal(R.acquisition(nouveau, [], e.types, { ...e.reglages, arrondiSup: false }, p, '2026-11-14').acquis, 21.25);
  // Période en cours : prorata au jour, sans arrondi.
  const enCours = R.acquisition(s, [], e.types, e.reglages, { debut: '2026-06-01', fin: '2027-05-31' }, '2026-07-31');
  assert.equal(enCours.acquis, 5);
  assert.equal(enCours.complete, false);
});

test('acquisition pendant un arrêt maladie, un accident du travail et un congé sans solde', () => {
  const e = etat();
  const p = { debut: '2025-06-01', fin: '2026-05-31' };
  const s = e.salaries[0];
  // 4 mois d'arrêt maladie non professionnel : 4 × 2 + 8 × 2,5 = 28.
  const maladie = [abs({ type: 'maladie', debut: '2025-10-01', fin: '2026-01-31' })];
  const r = R.acquisition(s, maladie, e.types, e.reglages, p, '2026-11-14');
  assert.equal(r.acquis, 28);
  assert.equal(R.arrondi2(r.maladie), 8);
  // Plafond « maladie » de la période (paramètre) : 3 j/mois sur 12 mois → 24 au plus.
  const toute = [abs({ type: 'maladie', debut: '2025-06-01', fin: '2026-05-31' })];
  const plafonne = R.acquisition(s, toute, e.types, { ...e.reglages, acquisition: { ...e.reglages.acquisition, maladieMois: 3 } }, p, '2026-11-14');
  assert.equal(plafonne.acquis, 24);
  assert.equal(plafonne.maladiePlafonnee, true);
  // Accident du travail : assimilé à du travail effectif.
  assert.equal(R.acquisition(s, [abs({ type: 'atmp', debut: '2025-10-01', fin: '2026-01-31' })], e.types, e.reglages, p, '2026-11-14').acquis, 30);
  // Congé sans solde d'un mois : 11 × 2,5 = 27,5 → 28.
  assert.equal(R.acquisition(s, [abs({ type: 'sansSolde', debut: '2025-06-01', fin: '2025-06-30' })], e.types, e.reglages, p, '2026-11-14').acquis, 28);
  // Une demande non validée ne change rien.
  assert.equal(R.acquisition(s, [abs({ type: 'sansSolde', statut: 'demandee', debut: '2025-06-01', fin: '2025-06-30' })], e.types, e.reglages, p, '2026-11-14').acquis, 30);
  // Plafond général : taux conventionnel de 3 jours par mois → 30 au plus.
  assert.equal(R.acquisition(s, [], e.types, { ...e.reglages, acquisition: { ...e.reglages.acquisition, mois: 3 } }, p, '2026-11-14').acquis, 30);
});

test('soldes : reliquat, acquis, pris, posés, demandes en attente, ajustements', () => {
  const e = etat();
  e.salaries[0].reliquatCp = 4;
  e.salaries[0].ajustements = [{ id: 'j', date: '2026-01-10', compteur: 'cp', jours: -1, motif: 'Correction' }];
  e.absences = [
    abs({ id: 'a1', debut: '2026-03-02', fin: '2026-03-06' }), // 6 pris
    abs({ id: 'a2', debut: '2026-12-21', fin: '2026-12-24' }), // 4 posés (lun → jeu)
    abs({ id: 'a3', statut: 'demandee', debut: '2027-02-01', fin: '2027-02-05' }), // 6 en attente
    abs({ id: 'a4', statut: 'refusee', debut: '2027-03-01', fin: '2027-03-05' }),
  ];
  const s = R.soldes(e.salaries[0], e, '2026-11-14');
  assert.equal(s.cp.anterieurs, 30); // période 2025-2026 close
  // Période en cours (01/06 → 14/11/2026) : 5 mois × 2,5 + 14/30 × 2,5.
  assert.equal(s.cp.enCours, R.arrondi2(12.5 + (14 / 30) * 2.5));
  assert.equal(s.cp.pris, 6);
  assert.equal(s.cp.poses, 4);
  assert.equal(s.cp.attente, 6);
  assert.equal(s.cp.solde, R.arrondi2(4 + 30 + s.cp.enCours - 1 - 6 - 4));
  assert.equal(s.cp.apresDemandes, R.arrondi2(s.cp.solde - 6));
  assert.equal(s.cp.projectionPeriode, 30);
});

test('RTT : prorata de l\'année civile ou crédit annuel', () => {
  const e = etat();
  const s = { ...e.salaries[0], rttAnnuel: 10 };
  const reg = { ...e.reglages, debutSuivi: '2026-01-01' };
  assert.equal(R.acquisRtt(s, reg, '2026-12-31'), 10);
  assert.equal(R.acquisRtt(s, reg, '2026-07-02'), R.arrondi2(10 * 183 / 365));
  assert.equal(R.acquisRtt(s, { ...reg, rttMode: 'annuel' }, '2026-03-01'), 10);
  // Entrée en cours d'année, crédit annuel : au prorata de la présence prévue.
  assert.equal(R.acquisRtt({ ...s, entree: '2026-07-01' }, { ...reg, rttMode: 'annuel' }, '2026-07-01'), R.arrondi2(10 * 184 / 365));
  assert.equal(R.acquisRtt({ ...s, rttAnnuel: 0 }, reg, '2026-12-31'), 0);
});

test('chevauchements : seuil d\'absents simultanés par équipe, jours ouvrés seulement', () => {
  const e = etat();
  e.salaries.push(R.normaliserSalarie({ id: 's2', prenom: 'Bo', nom: 'Exemple', equipe: 'atelier', entree: '2020-01-06' }));
  e.absences = [
    abs({ id: 'a1', salarie: 's1', debut: '2026-08-03', fin: '2026-08-14' }),
    abs({ id: 'a2', salarie: 's2', statut: 'demandee', debut: '2026-08-10', fin: '2026-08-21' }),
  ];
  const alertes = R.chevauchements(e, '2026-08-01', '2026-08-31');
  assert.deepEqual(simple(alertes.map((x) => x.date)), ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']);
  assert.equal(alertes[0].enAttente, true);
  const plages = R.plagesAlerte(alertes, e.reglages);
  assert.equal(plages.length, 1);
  assert.equal(plages[0].debut, '2026-08-10');
  assert.equal(plages[0].fin, '2026-08-14');
  assert.equal(plages[0].pic, 2);
  // Ce que la demande provoque, vu depuis elle.
  assert.equal(R.alertesDemande(e, e.absences[1]).length, 5);
  // Seuil relevé à 2 : plus d'alerte. Demande refusée : plus d'alerte non plus.
  assert.equal(R.chevauchements({ ...e, equipes: [{ id: 'atelier', nom: 'Atelier', maxAbsents: 2 }] }, '2026-08-01', '2026-08-31').length, 0);
  assert.equal(R.chevauchements({ ...e, absences: [e.absences[0], { ...e.absences[1], statut: 'refusee' }] }, '2026-08-01', '2026-08-31').length, 0);
  // Le 15 août (férié) et les week-ends ne comptent pas.
  assert.equal(R.absentsLe(e, '2026-08-15').length, 0);
});

test('conflit personnel et transitions de statut', () => {
  const e = etat();
  e.absences = [abs({ id: 'a1', debut: '2026-08-03', fin: '2026-08-14' }), abs({ id: 'a2', statut: 'annulee', debut: '2026-09-01', fin: '2026-09-04' })];
  assert.equal(R.conflitPersonnel(e, abs({ id: 'n', debut: '2026-08-14', fin: '2026-08-20' }))?.id, 'a1');
  assert.equal(R.conflitPersonnel(e, abs({ id: 'n', debut: '2026-09-01', fin: '2026-09-02' })), null); // l'annulée ne bloque pas
  assert.equal(R.conflitPersonnel(e, abs({ id: 'n', salarie: 's9', debut: '2026-08-04', fin: '2026-08-05' })), null);
  const d = abs({ statut: 'demandee', debut: '2026-09-01', fin: '2026-09-02' });
  assert.equal(R.changerStatut(d, 'validee', '2026-11-14').decideLe, '2026-11-14');
  assert.equal(R.changerStatut(d, 'refusee', '2026-11-14').statut, 'refusee');
  assert.equal(R.changerStatut({ ...d, statut: 'refusee' }, 'validee', '2026-11-14'), null);
  assert.equal(R.changerStatut({ ...d, statut: 'validee' }, 'annulee', '2026-11-14').statut, 'annulee');
  assert.equal(R.changerStatut({ ...d, statut: 'annulee' }, 'demandee', '2026-11-14').decideLe, null);
});

test('RGPD : effacement, suppression et export des données d\'un salarié', () => {
  const e = etat();
  e.absences = [abs({ id: 'a1', debut: '2026-03-02', fin: '2026-03-06', note: 'Vacances en famille' })];
  const ef = R.effacerSalarie(e, 's1', 3);
  assert.equal(ef.salaries[0].nom, 'effacé 3');
  assert.equal(ef.salaries[0].efface, true);
  assert.equal(ef.absences[0].note, '');
  assert.equal(ef.absences.length, 1);
  assert.equal(e.salaries[0].nom, 'Exemple'); // l'état d'origine n'est pas modifié
  const su = R.supprimerSalarie(e, 's1');
  assert.equal(su.salaries.length, 0);
  assert.equal(su.absences.length, 0);
  const d = R.donneesSalarie(e, 's1', '2026-11-14');
  assert.equal(d.salarie.equipe, 'Atelier');
  assert.equal(d.absences[0].joursDecomptes, 6);
  assert.equal(d.soldes.unite, 'jours ouvrables');
});

test('export CSV et normalisation tolérante', () => {
  const e = etat();
  e.absences = [abs({ id: 'a1', debut: '2026-03-02', fin: '2026-03-06', note: 'Pont; et "guillemets"' })];
  const csv = R.versCsv(e);
  assert.ok(csv.startsWith('﻿Prénom;Nom;Équipe'));
  assert.ok(csv.includes('Ana;Exemple;Atelier;Congés payés;2026-03-02;2026-03-06;non;non;6;Validée'));
  assert.ok(csv.includes('"Pont; et ""guillemets"""'));
  const n = R.normaliser({ reglages: { decompte: 'n-importe', moisDebut: 13, acquisition: { mois: 'abc' } }, absences: [{ debut: '2026-03-06', fin: '2026-03-02', statut: 'bizarre' }], salaries: [{ prenom: 'X', reliquatCp: '3.5' }] }, DEFAUTS);
  assert.equal(n.reglages.decompte, 'ouvrables');
  assert.equal(n.reglages.moisDebut, 6);
  assert.equal(n.reglages.acquisition.mois, 2.5);
  assert.equal(n.absences[0].fin, '2026-03-06'); // fin avant le début : ramenée au début
  assert.equal(n.absences[0].statut, 'demandee');
  assert.equal(n.salaries[0].reliquatCp, 3.5);
  assert.equal(n.types.length, 7);
  assert.equal(R.normaliser(null, DEFAUTS).salaries.length, 0);
  assert.equal(R.lireNombre('2,08'), 2.08);
  assert.equal(R.lireNombre('-1', { negatif: true }), -1);
  assert.equal(R.lireNombre('-1'), null);
  assert.equal(R.nombre(2.5), '2,5');
  assert.equal(R.nombre(-1.25), '−1,25');
});

test('base intégrée : types cohérents et sources présentes', () => {
  const ids = BASE.types.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(BASE.types.every((t) => ['cp', 'rtt', 'aucun'].includes(t.decompte) && ['oui', 'maladie', 'non'].includes(t.acquiert)));
  assert.ok(BASE.types.every((t) => t.couleur < BASE.couleurs.length));
  assert.equal(BASE.types.find((t) => t.id === 'maladie').sante, true);
  assert.equal(BASE.acquisitions.ouvrables.mois, 2.5);
  assert.ok(BASE.sources.every(([, u]) => u.startsWith('https://')));
});
