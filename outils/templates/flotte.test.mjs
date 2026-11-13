// Tests des règles métier de la gestion de flotte (templates/flotte/regles.js et donnees.js).
// Date de référence fixe : les résultats ne dépendent jamais du jour où les tests tournent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/flotte/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-13';
const RG = { alerteJours: 30, alerteKm: 1500, releveAncienJours: 30, ctPremierMois: 48, ctPeriodiqueMois: 24, ctPollutionMois: 12, designationJours: 45 };

const veh = (o = {}) => ({ id: 'v1', immat: 'FL-101-QA', libelle: 'Citadine', type: 'M1', energie: 'ES', miseEnCirculation: '2022-03-15', entree: '2025-01-10', kmEntree: 30000,
  detention: 'achat', prixAchat: 0, amortMois: 0, plan: [], actif: true, ...o });
const etat = (o = {}) => ({ reglages: RG, vehicules: [], releves: [], entretiens: [], controles: [], reservations: [], conducteurs: [], sinistres: [], amendes: [], depenses: [], ...o });

test('base intégrée : types, énergies exemptées, contrôle technique sourcé, plan indicatif', () => {
  assert.deepEqual(B.types.map((t) => t.code), ['M1', 'N1', 'AUTRE']);
  assert.deepEqual(B.energies.filter((e) => e.exempte).map((e) => e.code), ['EL', 'H2']);
  assert.equal(B.ct.premierMois, 48);
  assert.equal(B.ct.periodiqueMois, 24);
  assert.equal(B.ct.pollutionMois, 12);
  assert.ok(B.ct.sources.every((s) => s.url.startsWith('https://www.service-public.gouv.fr/') && s.verifie));
  assert.equal(B.designation.jours, 45);
  assert.match(B.designation.url, /^https:\/\/www\.legifrance\.gouv\.fr\//);
  assert.equal(new Set(B.entretiens.map((e) => e.code)).size, B.entretiens.length);
  assert.ok(B.entretiens.every((e) => e.km > 0 || e.mois > 0));
});

test('dates : ajout de mois borné à la fin du mois, mois pleins, lundi', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-11-13', 14), '2028-01-13');
  assert.equal(R.ajoutMois('2026-03-31', -1), '2026-02-28');
  assert.equal(R.moisPleins('2026-01-15', '2026-03-14'), 1);
  assert.equal(R.moisPleins('2026-01-15', '2026-03-15'), 2);
  assert.equal(R.moisPleins('2026-03-15', '2026-01-01'), 0);
  assert.equal(R.lundi('2026-11-13'), '2026-11-09'); // vendredi → lundi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
  assert.ok(R.estDateHeure('2026-11-13T08:30'));
  assert.ok(!R.estDateHeure('2026-11-13T24:00'));
  assert.equal(R.immat(' fl 101.qa '), 'FL-101-QA');
});

test('kilométrage : points cumulés, km actuel, rythme sur 365 jours', () => {
  const v = veh();
  const e = etat({ vehicules: [v],
    releves: [{ id: 'r1', vehiculeId: 'v1', date: '2026-01-13', km: 40000 }, { id: 'r2', vehiculeId: 'v1', date: '2026-11-09', km: 50000 }],
    entretiens: [{ id: 'e1', vehiculeId: 'v1', date: '2026-06-01', km: 45000, operations: [] }],
    reservations: [{ id: 'b1', vehiculeId: 'v1', debut: '2026-11-12T08:00', fin: '2026-11-12T18:00', kmRetour: 50300 }] });
  const pts = R.pointsKm(e, v);
  assert.equal(pts.length, 5);
  assert.equal(R.kmActuel(pts), 50300);
  assert.equal(R.dernierReleve(pts), '2026-11-12');
  // Fenêtre : du 13/11/2025 au 13/11/2026 → 13/01/2026 (40 000) au 12/11/2026 (50 300) : 10 300 km en 303 jours.
  assert.equal(R.ecart('2026-01-13', '2026-11-12'), 303);
  assert.ok(Math.abs(R.rythme(pts, AUJ) - 10300 / 303) < 1e-9);
  // Moins de deux dates dans la fenêtre : repli sur tout l'historique.
  const pts2 = [{ date: '2024-01-01', km: 0 }, { date: '2026-11-01', km: 10340 }];
  assert.ok(Math.abs(R.rythme(pts2, AUJ) - 10340 / R.ecart('2024-01-01', '2026-11-01')) < 1e-9);
  assert.equal(R.rythme([{ date: '2026-11-01', km: 1 }], AUJ), null);
});

test('relevé kilométrique : refusé s\'il contredit un relevé antérieur ou postérieur', () => {
  const pts = [{ date: '2026-01-01', km: 40000 }, { date: '2026-06-01', km: 45000 }];
  assert.equal(R.verifierReleve(pts, '2026-11-13', 46000), null);
  assert.match(R.verifierReleve(pts, '2026-11-13', 44000), /45\s000 km relevés le 01\/06\/2026/);
  assert.match(R.verifierReleve(pts, '2026-03-01', 46000), /seulement 45\s000 km/);
  assert.equal(R.verifierReleve(pts, '2026-03-01', 42000), null);
  assert.equal(R.verifierReleve(pts, '2026-06-01', 45000), null); // même jour, même valeur
  assert.equal(R.verifierReleve(pts, '2026-06-01', 45200), null); // même jour, plus loin
  assert.match(R.verifierReleve(pts, '2026-06-01', 44000), /45\s000 km relevés le 01\/06\/2026\.$/); // même jour, en arrière
  assert.equal(R.verifierReleve(pts, '13/11/2026', 1), 'Date invalide.');
});

test('plan d\'entretien proposé selon l\'énergie', () => {
  const th = R.planDefaut(B, 'GO').map((o) => o.code);
  const el = R.planDefaut(B, 'EL').map((o) => o.code);
  assert.ok(th.includes('VID') && th.includes('DIS'));
  assert.ok(!el.includes('VID') && !el.includes('DIS') && el.includes('LDF') && el.includes('PNE'));
});

test('échéance d\'entretien : km ou mois, la première atteinte compte', () => {
  const v = veh({ entree: '2026-01-10', kmEntree: 30000 });
  const op = { id: 'VID', nom: 'Vidange', km: 20000, mois: 12 };
  const al = { jours: 30, km: 1500 };
  // Aucun entretien : référence = entrée (10/01/2026, 30 000 km) → 50 000 km ou 10/01/2027.
  let e = R.echeanceEntretien(op, v, [], 40000, AUJ, al, 30);
  assert.equal(e.echKm, 50000);
  assert.equal(e.echDate, '2027-01-10');
  assert.equal(e.kmRestant, 10000);
  assert.equal(e.dateKm, R.ajout(AUJ, 334)); // 10 000 / 30 = 333,3 → 334 jours
  assert.equal(e.prevue, '2027-01-10');
  assert.equal(e.etat, 'ok');
  // Km presque atteint : proche.
  assert.equal(R.echeanceEntretien(op, v, [], 48600, AUJ, al, 30).etat, 'proche');
  // Km atteint : retard même si la date est loin.
  assert.equal(R.echeanceEntretien(op, v, [], 50000, AUJ, al, 30).etat, 'retard');
  // Date passée : retard même avec peu de km.
  assert.equal(R.echeanceEntretien(op, v, [], 31000, '2027-01-11', al, 3).etat, 'retard');
  // Date dans la fenêtre de 30 jours : proche.
  assert.equal(R.echeanceEntretien(op, v, [], 31000, '2026-12-15', al, 3).etat, 'proche');
  // Un entretien qui contient l'opération devient la référence.
  const fait = [{ id: 'e1', vehiculeId: 'v1', date: '2026-10-01', km: 44000, operations: ['VID'] }, { id: 'e2', vehiculeId: 'v1', date: '2026-11-01', km: 45000, operations: ['PNE'] }];
  e = R.echeanceEntretien(op, v, fait, 45500, AUJ, al, 30);
  assert.equal(e.echKm, 64000);
  assert.equal(e.echDate, '2027-10-01');
  assert.equal(e.etat, 'ok');
  // Opération au temps seulement.
  e = R.echeanceEntretien({ id: 'LDF', nom: 'Liquide de frein', km: 0, mois: 24 }, v, [], 99999, AUJ, al, 30);
  assert.equal(e.echKm, null);
  assert.equal(e.echDate, '2028-01-10');
  assert.equal(e.etat, 'ok');
});

test('contrôle technique : premier avant le 4e anniversaire, puis tous les 2 ans', () => {
  // Mise en circulation 15/03/2022, aucun contrôle : au plus tard le 14/03/2026.
  let ct = R.echeancesCT(veh(), [], RG, B);
  assert.deepEqual(ct.map((c) => [c.nature, c.echeance, !!c.premier]), [['periodique', '2026-03-14', true]]);
  assert.equal(R.etatDate('2026-03-14', AUJ, 30), 'retard');
  // Exemple de la fiche F2878 : contrôle le 01/10/2025 → valable jusqu'au 30/09/2027.
  ct = R.echeancesCT(veh(), [{ id: 'c1', vehiculeId: 'v1', date: '2025-10-01', nature: 'periodique', resultat: 'favorable' }], RG, B);
  assert.deepEqual(ct.map((c) => [c.nature, c.echeance]), [['periodique', '2027-09-30']]);
  // Dernier contrôle connu saisi sur le véhicule.
  ct = R.echeancesCT(veh({ ctDernier: '2025-12-01' }), [], RG, B);
  assert.equal(ct[0].echeance, '2027-11-30');
  // Contre-visite à faire avant une date saisie, puis levée par une contre-visite favorable.
  const cv = [{ id: 'c1', vehiculeId: 'v1', date: '2026-10-20', nature: 'periodique', resultat: 'contre-visite', limite: '2026-12-20' }];
  ct = R.echeancesCT(veh(), cv, RG, B);
  assert.deepEqual(ct.map((c) => [c.nature, c.echeance]), [['periodique', '2028-10-19'], ['contre-visite', '2026-12-20']]);
  ct = R.echeancesCT(veh(), [...cv, { id: 'c2', vehiculeId: 'v1', date: '2026-11-05', nature: 'contre-visite', resultat: 'favorable' }], RG, B);
  assert.deepEqual(ct.map((c) => c.nature), ['periodique']);
});

test('contrôle complémentaire pollution : camionnettes N1 non exemptées seulement', () => {
  const c = [{ id: 'c1', vehiculeId: 'v1', date: '2025-10-01', nature: 'periodique', resultat: 'favorable' }];
  // Exemple de la fiche F33353 : contrôle le 01/10/2025 → complémentaire au plus tard le 30/09/2026.
  let ct = R.echeancesCT(veh({ type: 'N1', energie: 'GO' }), c, RG, B);
  assert.deepEqual(ct.map((x) => [x.nature, x.echeance]), [['periodique', '2027-09-30'], ['pollution', '2026-09-30']]);
  // Fait : plus d'échéance pollution.
  ct = R.echeancesCT(veh({ type: 'N1', energie: 'GO' }), [...c, { id: 'c2', vehiculeId: 'v1', date: '2026-09-01', nature: 'pollution', resultat: 'favorable' }], RG, B);
  assert.deepEqual(ct.map((x) => x.nature), ['periodique']);
  // Électrique ou voiture particulière : pas de complémentaire.
  assert.deepEqual(R.echeancesCT(veh({ type: 'N1', energie: 'EL' }), c, RG, B).map((x) => x.nature), ['periodique']);
  assert.deepEqual(R.echeancesCT(veh({ type: 'M1', energie: 'GO' }), c, RG, B).map((x) => x.nature), ['periodique']);
  // Type « autre » : périodicité saisie sur le véhicule, sinon aucune échéance.
  assert.deepEqual(R.echeancesCT(veh({ type: 'AUTRE' }), c, RG, B), []);
  assert.equal(R.echeancesCT(veh({ type: 'AUTRE', ctMois: 12 }), c, RG, B)[0].echeance, '2026-09-30');
});

test('réservations : chevauchement refusé (véhicule ou conducteur), bords tolérés', () => {
  const liste = [{ id: 'a', vehiculeId: 'v1', conducteurId: 'k1', debut: '2026-11-16T08:00', fin: '2026-11-16T12:00' }];
  const noms = { vehicule: () => 'FL-101-QA', conducteur: () => 'Camille R.' };
  assert.equal(R.validerReservation(liste, { id: 'b', vehiculeId: 'v1', conducteurId: 'k2', debut: '2026-11-16T12:00', fin: '2026-11-16T18:00' }, noms), null);
  assert.equal(R.validerReservation(liste, { id: 'b', vehiculeId: 'v1', conducteurId: 'k2', debut: '2026-11-16T11:00', fin: '2026-11-16T14:00' }, noms),
    'Conflit refusé : FL-101-QA est déjà réservé du 16/11/2026 08:00 au 16/11/2026 12:00.');
  assert.match(R.validerReservation(liste, { id: 'b', vehiculeId: 'v2', conducteurId: 'k1', debut: '2026-11-16T07:00', fin: '2026-11-16T09:00' }, noms), /Camille R\. a déjà une réservation/);
  assert.equal(R.validerReservation(liste, { id: 'b', vehiculeId: 'v2', conducteurId: 'k2', debut: '2026-11-16T07:00', fin: '2026-11-16T09:00' }, noms), null);
  assert.equal(R.validerReservation(liste, { id: 'b', vehiculeId: 'v2', debut: '2026-11-16T09:00', fin: '2026-11-16T09:00' }, noms), 'La fin doit suivre le début.');
  // Modifier la réservation elle-même n'est pas un conflit ; une réservation annulée non plus.
  assert.equal(R.validerReservation(liste, { ...liste[0], fin: '2026-11-16T13:00' }, noms), null);
  assert.equal(R.validerReservation([{ ...liste[0], annulee: true }], { id: 'b', vehiculeId: 'v1', debut: '2026-11-16T09:00', fin: '2026-11-16T10:00' }, noms), null);
  // Planning et conducteur probable.
  const sur2j = [{ id: 'c', vehiculeId: 'v1', conducteurId: 'k1', debut: '2026-11-16T14:00', fin: '2026-11-17T10:00' }];
  assert.equal(R.reservationsDuJour(sur2j, '2026-11-17').length, 1);
  assert.equal(R.reservationsDuJour(sur2j, '2026-11-18').length, 0);
  assert.equal(R.conducteurA(sur2j, 'v1', '2026-11-17'), 'k1');
  assert.equal(R.conducteurA(sur2j, 'v1', '2026-11-18'), null);
});

test('location longue durée : prorata, projection, dépassement et loyers échus', () => {
  // 36 mois du 01/01/2025 au 01/01/2028 (1095 jours), 60 000 km, 450 €/mois, 0,08 €/km supplémentaire.
  const lld = { debut: '2025-01-01', dureeMois: 36, kmContrat: 60000, kmDebut: 10, loyer: 450, prixKmSup: 0.08 };
  const s = R.suiviLLD(lld, 40010, 60, AUJ);
  assert.equal(s.fin, '2028-01-01');
  assert.equal(s.joursTotal, 1095);
  assert.equal(s.joursEcoules, 681);
  assert.equal(s.kmParcourus, 40000);
  assert.equal(s.kmAutorises, Math.round(60000 * 681 / 1095)); // 37 315
  assert.equal(s.ecartProrata, 40000 - 37315);
  assert.equal(s.kmProjete, 40000 + 60 * 414); // 64 840
  assert.equal(s.depassement, 4840);
  assert.equal(s.coutDepassement, 387.2);
  assert.equal(s.loyersEchus, 23); // 01/01/2025 … 01/11/2026
  assert.equal(s.loyers, 10350);
  assert.equal(s.termine, false);
  // Sans rythme connu : moyenne depuis le début du contrat.
  assert.equal(R.suiviLLD(lld, 40010, null, AUJ).kmProjete, Math.round(40000 + (40000 / 681) * 414));
  // Contrat terminé : loyers bornés à la durée.
  assert.equal(R.suiviLLD(lld, 60010, null, '2029-06-01').loyersEchus, 36);
  assert.equal(R.suiviLLD({ debut: '', dureeMois: 36 }, 0, null, AUJ), null);
});

test('coût total et coût au km par véhicule', () => {
  const v = veh({ entree: '2025-01-10', kmEntree: 30000, prixAchat: 24000, amortMois: 48 });
  const e = etat({ vehicules: [v],
    releves: [{ id: 'r', vehiculeId: 'v1', date: '2026-11-01', km: 50000 }],
    depenses: [{ id: 'd1', vehiculeId: 'v1', date: '2026-02-01', poste: 'ENE', montant: 1200 }, { id: 'd2', vehiculeId: 'v1', date: '2026-03-01', poste: 'ASS', montant: '800,50' },
      { id: 'd3', vehiculeId: 'v1', date: '2027-01-01', poste: 'ASS', montant: 900 }], // future : exclue
    entretiens: [{ id: 'e', vehiculeId: 'v1', date: '2026-05-01', km: 42000, cout: 350, operations: [] }],
    controles: [{ id: 'c', vehiculeId: 'v1', date: '2026-03-01', nature: 'periodique', resultat: 'favorable', cout: 80 }],
    sinistres: [{ id: 's', vehiculeId: 'v1', date: '2026-04-01', cout: 500, statut: 'clos' }],
    amendes: [{ id: 'a', vehiculeId: 'v1', dateInfraction: '2026-06-01', montant: 135, statut: 'payee' }] });
  const c = R.coutVehicule(e, v, AUJ);
  // 22 mois pleins du 10/01/2025 au 13/11/2026 → 24 000 × 22 / 48 = 11 000.
  assert.equal(R.moisPleins('2025-01-10', AUJ), 22);
  assert.equal(c.detention, 11000);
  assert.equal(c.depenses, 2000.5);
  assert.deepEqual(c.parPoste, { ENE: 1200, ASS: 800.5 });
  assert.equal(c.entretien, 430);
  assert.equal(c.sinistres, 500);
  assert.equal(c.total, 13930.5);
  assert.equal(c.km, 20000);
  assert.equal(c.coutKm, 0.697); // 13 930,5 / 20 000 = 0,6965 → 0,697
  assert.equal(c.amendes, 135); // pour mémoire, hors coût total
  // Location : loyers échus le 15/09 et le 15/10 (le 15/11 est à venir).
  const l = veh({ detention: 'lld', lld: { debut: '2026-09-15', dureeMois: 24, loyer: 400 } });
  assert.equal(R.coutVehicule(etat({ vehicules: [l] }), l, AUJ).detention, 800);
  // Aucun km parcouru : pas de coût au km.
  assert.equal(R.coutVehicule(etat({ vehicules: [l] }), l, AUJ).coutKm, null);
});

test('alertes : entretien, contrôle technique, amende, sinistre, location, relevé ancien, triées', () => {
  const v1 = veh({ entree: '2026-01-10', plan: [{ id: 'VID', nom: 'Vidange', km: 20000, mois: 12 }] }); // pas de CT : premier contrôle dépassé
  const v2 = veh({ id: 'v2', immat: 'FL-202-QB', miseEnCirculation: '2025-01-01', entree: '2025-01-01', kmEntree: 0, detention: 'lld',
    lld: { debut: '2025-01-01', dureeMois: 36, kmContrat: 30000, kmDebut: 0, loyer: 400, prixKmSup: 0.1 } });
  const e = etat({ vehicules: [v1, v2, veh({ id: 'v3', actif: false })],
    releves: [{ id: 'r1', vehiculeId: 'v1', date: '2026-11-10', km: 49000 }, { id: 'r2', vehiculeId: 'v2', date: '2026-09-01', km: 40000 }],
    amendes: [{ id: 'a1', vehiculeId: 'v1', dateAvis: '2026-10-20', statut: 'a-designer' }, { id: 'a2', vehiculeId: 'v1', dateAvis: '2026-09-01', statut: 'designee' }],
    sinistres: [{ id: 's1', vehiculeId: 'v2', date: '2026-11-02', description: 'Rétroviseur', statut: 'ouvert' }] });
  const a = R.alertes(e, B, AUJ);
  const types = a.map((x) => `${x.type}:${x.etat}:${x.vehiculeId}`);
  assert.ok(types.includes('entretien:proche:v1')); // 49 000 / 50 000 km
  assert.ok(types.includes('ct:retard:v1'));
  assert.ok(types.includes('amende:proche:v1')); // désignation avant le 04/12/2026
  assert.equal(a.find((x) => x.type === 'amende').detail, 'Avant le 04/12/2026 (avis du 20/10/2026)');
  assert.ok(types.includes('sinistre:proche:v2'));
  assert.ok(types.includes('lld:retard:v2'));
  assert.ok(types.includes('releve:proche:v2'));
  assert.ok(!types.some((t) => t.endsWith(':v3')), 'véhicule inactif ignoré');
  assert.equal(a.filter((x) => x.type === 'amende').length, 1);
  // Retards d'abord.
  const premierProche = a.findIndex((x) => x.etat === 'proche');
  assert.ok(a.slice(premierProche).every((x) => x.etat === 'proche'));
});

test('export CSV : point-virgule, BOM, décimales à la virgule, formules neutralisées', () => {
  assert.equal(R.champCsv('=SOMME(A1)'), '\'=SOMME(A1)');
  assert.equal(R.champCsv('a;b'), '"a;b"');
  assert.equal(R.champCsv('dit "ok"'), '"dit ""ok"""');
  assert.equal(R.champCsv(0.697), '0,697');
  assert.equal(R.champCsv(-12), '-12');
  const v = veh({ libelle: '+Citadine', prixAchat: 24000, amortMois: 48 });
  const e = etat({ vehicules: [v], depenses: [{ id: 'd', vehiculeId: 'v1', date: '2026-02-01', poste: 'ENE', montant: 60.5, libelle: 'Plein' }] });
  const t = R.csvVehicules(e, B, AUJ);
  assert.ok(t.startsWith('﻿Immatriculation;Libellé;'));
  assert.ok(t.includes('FL-101-QA;\'+Citadine;Voiture;Essence;15/03/2022;Achat;30000;0;'));
  const c = R.csvCouts(e, B, AUJ).split('\r\n');
  assert.equal(c[0], '﻿Date;Immatriculation;Poste;Libellé;Montant');
  assert.equal(c[1], '01/02/2026;FL-101-QA;Énergie (carburant, recharge);Plein;60,5');
});
