// Tests des règles métier du carnet de voiture (templates/voiture/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/voiture/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CAR;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const voiture = (x = {}) => R.normaliserVehicule({ id: 'v1', nom: 'Citadine essence', immat: 'aa 123 aa', energie: 'ES', miseEnCirculation: '2020-03-10', achat: '2024-01-15', kmAchat: 40000, ...x }, B);
const etat = (extra = {}) => Object.assign(R.etatVide(B), { vehicules: [voiture()] }, extra);
const plein = (x) => R.normaliserDepense({ vehiculeId: 'v1', categorie: 'CAR', plein: true, ...x }, B);

test('dates : ajout de mois borné à la fin du mois', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-11-14', -12), '2025-11-14');
  assert.equal(R.ajoutMois('2026-12-15', 2), '2027-02-15');
  assert.equal(R.ecart('2026-11-14', '2026-12-14'), 30);
  assert.ok(R.estDate('2024-02-29'));
  assert.ok(!R.estDate('2026-02-29'));
});

test('saisie : nombres à la française, immatriculation normalisée', () => {
  assert.equal(R.lireNombre('1 234,5'), 1234.5);
  assert.equal(R.lireNombre('42.10'), 42.1);
  assert.equal(R.lireNombre(''), null);
  assert.equal(R.lireNombre('-3'), null);
  assert.equal(R.lireNombre('abc'), null);
  assert.equal(R.immat(' aa 123.aa '), 'AA-123-AA');
  assert.equal(R.immat('bb_456__bb'), 'BB-456-BB');
});

test('contrôle technique M1 : premier contrôle avant le 4e anniversaire (F2878)', () => {
  const rg = R.etatVide(B).reglages;
  const v = voiture({ miseEnCirculation: '2022-05-14' });
  const ct = R.echeanceCT(v, [], rg);
  assert.equal(ct.nature, 'periodique');
  assert.equal(ct.premier, true);
  assert.equal(ct.echeance, '2026-05-13');
  assert.equal(ct.des, '2025-11-14'); // fenêtre des 6 mois avant
  // Sans mise en circulation ni contrôle connu : aucune échéance calculée.
  assert.equal(R.echeanceCT(voiture({ miseEnCirculation: null }), [], rg).nature, 'aucune');
});

test('contrôle technique : favorable valable 2 ans (exemple de la fiche : 14/05/2025 → 13/05/2027)', () => {
  const rg = R.etatVide(B).reglages;
  const v = voiture();
  const c = [R.normaliserControle({ id: 'c1', vehiculeId: 'v1', date: '2025-05-14', nature: 'periodique', resultat: 'favorable' })];
  const ct = R.echeanceCT(v, c, rg);
  assert.equal(ct.echeance, '2027-05-13');
  assert.equal(ct.premier, false);
  // Contrôle connu avant le carnet : sert de référence.
  assert.equal(R.echeanceCT(voiture({ ctDernier: '2025-05-14' }), [], rg).echeance, '2027-05-13');
  // Un contrôle saisi plus récent l'emporte sur le contrôle connu.
  assert.equal(R.echeanceCT(voiture({ ctDernier: '2023-01-01' }), c, rg).echeance, '2027-05-13');
  // Périodicité modifiable dans les réglages.
  assert.equal(R.echeanceCT(v, c, { ...rg, ctPeriodiqueMois: 12 }).echeance, '2026-05-13');
});

test('contrôle technique : contre-visite dans les 2 mois, puis validité depuis le contrôle défavorable', () => {
  const rg = R.etatVide(B).reglages;
  const v = voiture();
  const p = R.normaliserControle({ id: 'c1', vehiculeId: 'v1', date: '2026-10-20', nature: 'periodique', resultat: 'majeure' });
  const cv = R.echeanceCT(v, [p], rg);
  assert.equal(cv.nature, 'contre-visite');
  assert.equal(cv.echeance, '2026-12-19');
  assert.equal(cv.critique, false);
  assert.equal(R.etatDate(cv.echeance, AUJ, 30), 'ok');
  assert.equal(R.etatDate(cv.echeance, '2026-11-25', 30), 'proche');
  assert.equal(R.etatDate(cv.echeance, '2026-12-20', 30), 'retard');
  // Contre-visite favorable : prochain contrôle 2 ans après le contrôle défavorable.
  const ok = R.normaliserControle({ id: 'c2', vehiculeId: 'v1', date: '2026-11-05', nature: 'contre-visite', resultat: 'favorable' });
  const ensuite = R.echeanceCT(v, [p, ok], rg);
  assert.equal(ensuite.nature, 'periodique');
  assert.equal(ensuite.echeance, '2028-10-19');
  // Défaillance critique : signalée.
  const crit = R.normaliserControle({ id: 'c3', vehiculeId: 'v1', date: '2026-11-10', nature: 'periodique', resultat: 'critique' });
  const c = R.echeanceCT(v, [crit], rg);
  assert.equal(c.critique, true);
  assert.equal(c.echeance, '2027-01-09');
});

test('contrôle technique : autre véhicule, périodicité saisie, sinon aucune règle', () => {
  const rg = R.etatVide(B).reglages;
  assert.equal(R.echeanceCT(voiture({ type: 'AUTRE' }), [], rg).nature, 'aucune');
  const v = voiture({ type: 'AUTRE', ctPremierMois: 60, ctMois: 36, miseEnCirculation: '2022-04-01' });
  assert.equal(R.echeanceCT(v, [], rg).echeance, '2027-03-31');
  const c = [R.normaliserControle({ vehiculeId: 'v1', date: '2027-03-01', resultat: 'favorable' })];
  assert.equal(R.echeanceCT(v, c, rg).echeance, '2030-02-28');
});

test('kilométrage : points, actuel, rythme et interpolation', () => {
  const e = etat({
    releves: [R.normaliserReleve({ vehiculeId: 'v1', date: '2025-11-14', km: 50000 }), R.normaliserReleve({ vehiculeId: 'v1', date: '2026-11-14', km: 62000 })],
    depenses: [plein({ date: '2026-05-15', km: 56000, quantite: 40, montant: 70 })],
  });
  const pts = R.pointsKm(e, e.vehicules[0]);
  assert.equal(pts.length, 4); // entrée + 2 relevés + 1 plein
  assert.equal(R.kmActuel(pts), 62000);
  assert.equal(Math.round(R.rythme(pts, AUJ) * 365), 12000);
  assert.equal(R.kmA(pts, '2026-11-14'), 62000);
  assert.equal(R.kmA(pts, '2026-08-14'), 58984); // 56 000 + 6 000 × 91 / 183 jours
  assert.equal(R.kmA(pts, '2020-01-01'), 40000); // borné au premier point
  assert.equal(R.kmA([], AUJ), null);
});

test('kilométrage : un relevé incohérent est refusé', () => {
  const e = etat({ releves: [R.normaliserReleve({ id: 'r1', vehiculeId: 'v1', date: '2026-06-01', km: 50000 })] });
  const pts = R.pointsKm(e, e.vehicules[0]);
  assert.match(R.verifierReleve(pts, '2026-07-01', 49000), /Incohérent/);
  assert.match(R.verifierReleve(pts, '2026-05-01', 51000), /après cette date/);
  assert.equal(R.verifierReleve(pts, '2026-07-01', 51000), null);
  assert.equal(R.verifierReleve(pts, '2026-07-01', 49000, 'r1'), null); // en modifiant le relevé lui-même
  assert.equal(R.verifierReleve(pts, 'hier', 51000), 'Date invalide.');
});

test('plan d\'entretien : proposé selon l\'énergie', () => {
  const ess = R.planDefaut(B, 'ES').map((o) => o.id);
  const el = R.planDefaut(B, 'EL').map((o) => o.id);
  assert.ok(ess.includes('VID') && ess.includes('DIS'));
  assert.ok(!el.includes('VID') && !el.includes('DIS'));
  assert.ok(el.includes('LDF') && el.includes('PNE'));
  assert.ok(R.planDefaut(B, 'HR').map((o) => o.id).includes('VID'));
});

test('entretien : la première atteinte (date ou kilométrage) compte', () => {
  const v = voiture();
  const op = { id: 'VID', nom: 'Vidange', km: 15000, mois: 12 };
  const al = { jours: 30, km: 1000 };
  const ents = [R.normaliserEntretien({ vehiculeId: 'v1', date: '2026-03-01', km: 50000, operations: ['VID'] })];
  // Km atteint avant la date : en retard.
  let e = R.echeanceEntretien(op, v, ents, 65200, AUJ, al, 50);
  assert.equal(e.echKm, 65000);
  assert.equal(e.echDate, '2027-03-01');
  assert.equal(e.etat, 'retard');
  // Date passée, km loin : en retard aussi.
  e = R.echeanceEntretien(op, v, ents, 52000, '2027-03-05', al, 5);
  assert.equal(e.etat, 'retard');
  // Km proche (dans la fenêtre de 1 000 km).
  e = R.echeanceEntretien(op, v, ents, 64300, AUJ, al, null);
  assert.equal(e.etat, 'proche');
  // Loin des deux : à jour, et la date estimée du km d'après le rythme.
  e = R.echeanceEntretien(op, v, ents, 55000, AUJ, al, 20);
  assert.equal(e.etat, 'ok');
  assert.equal(e.dateKm, R.ajout(AUJ, 500));
  assert.equal(e.premier, 'date'); // 01/03/2027 avant la date estimée du km
  // Critère au km seul atteint par le rythme dans la fenêtre de jours : proche.
  e = R.echeanceEntretien(op, v, ents, 63000, AUJ, al, 200);
  assert.equal(e.etat, 'proche');
});

test('entretien : référence sans historique (dernière fois connue, sinon entrée dans le carnet)', () => {
  const v = voiture();
  const al = { jours: 30, km: 1000 };
  const op = { id: 'LDF', nom: 'Liquide de frein', km: 0, mois: 24, depuis: null, depuisKm: '' };
  let e = R.echeanceEntretien(op, v, [], 45000, AUJ, al);
  assert.equal(e.refDate, '2024-01-15');
  assert.equal(e.echDate, '2026-01-15');
  assert.equal(e.echKm, null);
  assert.equal(e.etat, 'retard');
  e = R.echeanceEntretien({ ...op, depuis: '2025-09-01' }, v, [], 45000, AUJ, al);
  assert.equal(e.echDate, '2027-09-01');
  assert.equal(e.etat, 'ok');
  const sans = R.echeanceEntretien({ id: 'X', nom: 'X', km: 0, mois: 0 }, v, [], 45000, AUJ, al);
  assert.equal(sans.etat, 'sans');
  // Dernier km connu saisi dans le plan.
  const dis = R.echeanceEntretien({ id: 'DIS', nom: 'Distribution', km: 120000, mois: 0, depuisKm: 10000 }, v, [], 129500, AUJ, al);
  assert.equal(dis.echKm, 130000);
  assert.equal(dis.etat, 'proche');
});

test('consommation plein à plein (litres pour 100 km)', () => {
  const d = [
    plein({ date: '2026-09-01', km: 10000, quantite: 30, montant: 54 }),
    plein({ date: '2026-09-10', km: 10300, quantite: 10, montant: 18, plein: false }), // appoint
    plein({ date: '2026-09-20', km: 10800, quantite: 32, montant: 57.6 }),
    plein({ date: '2026-10-05', km: 11400, quantite: 36, montant: 64.8 }),
  ];
  const c = R.consommation(d, 'v1', 'CAR');
  assert.equal(c.intervalles.length, 2);
  assert.equal(c.intervalles[0].km, 800);
  assert.equal(c.intervalles[0].quantite, 42); // appoint + plein suivant
  assert.equal(c.intervalles[0].pour100, 5.25);
  assert.equal(c.intervalles[1].pour100, 6);
  assert.equal(c.moyenne, 5.57); // 78 L / 1 400 km
  assert.equal(c.unite, 'L');
  assert.equal(c.prixMoyen, 1.8);
  assert.equal(c.derniere.au, '2026-10-05');
});

test('consommation : un plein oublié ou sans compteur coupe la chaîne', () => {
  const base = [plein({ date: '2026-09-01', km: 10000, quantite: 30 }), plein({ date: '2026-09-20', km: 10600, quantite: 36, oubli: true }), plein({ date: '2026-10-05', km: 11200, quantite: 36 })];
  const c = R.consommation(base, 'v1', 'CAR');
  assert.equal(c.intervalles.length, 1);
  assert.equal(c.intervalles[0].du, '2026-09-20');
  const sansKm = [plein({ date: '2026-09-01', km: 10000, quantite: 30 }), plein({ date: '2026-09-20', km: '', quantite: 36 }), plein({ date: '2026-10-05', km: 11200, quantite: 36 }), plein({ date: '2026-10-20', km: 11800, quantite: 30 })];
  const c2 = R.consommation(sansKm, 'v1', 'CAR');
  assert.equal(c2.intervalles.length, 1);
  assert.equal(c2.intervalles[0].pour100, 5);
  // Un seul plein, ou aucun : pas de moyenne.
  assert.equal(R.consommation([plein({ date: '2026-09-01', km: 10000, quantite: 30 })], 'v1', 'CAR').moyenne, null);
  assert.equal(R.consommation([], 'v1', 'CAR').moyenne, null);
});

test('consommation électrique en kWh pour 100 km, séparée du carburant', () => {
  const rec = (x) => R.normaliserDepense({ vehiculeId: 'v1', categorie: 'REC', plein: true, ...x }, B);
  const d = [rec({ date: '2026-10-01', km: 20000, quantite: 30 }), rec({ date: '2026-10-08', km: 20250, quantite: 40 }), plein({ date: '2026-10-09', km: 20260, quantite: 20 })];
  const c = R.consommation(d, 'v1', 'REC');
  assert.equal(c.unite, 'kWh');
  assert.equal(c.moyenne, 16);
  assert.deepEqual(simple(R.categoriesEnergie(B, 'HR')), ['CAR', 'REC']);
  assert.deepEqual(simple(R.categoriesEnergie(B, 'EL')), ['REC']);
  assert.deepEqual(simple(R.categoriesEnergie(B, 'GO')), ['CAR']);
});

test('coûts : total, par catégorie, coût au km et coût mensuel', () => {
  const e = etat({
    releves: [R.normaliserReleve({ vehiculeId: 'v1', date: '2025-11-15', km: 50000 }), R.normaliserReleve({ vehiculeId: 'v1', date: '2026-11-14', km: 60000 })],
    depenses: [
      plein({ date: '2026-02-01', km: '', quantite: 40, montant: 600 }),
      R.normaliserDepense({ vehiculeId: 'v1', date: '2026-01-10', categorie: 'ASS', montant: 480 }, B),
      R.normaliserDepense({ vehiculeId: 'v1', date: '2026-04-10', categorie: 'PEA', montant: 20 }, B),
      R.normaliserDepense({ vehiculeId: 'v1', date: '2024-04-10', categorie: 'REP', montant: 999 }, B), // hors période
    ],
    entretiens: [R.normaliserEntretien({ vehiculeId: 'v1', date: '2026-06-01', km: 55000, operations: ['VID'], cout: 200 })],
    controles: [R.normaliserControle({ vehiculeId: 'v1', date: '2026-03-01', cout: 80 })],
  });
  const c = R.couts(e, B, null, '2025-11-15', AUJ);
  assert.equal(c.total, 1380);
  assert.equal(c.parCategorie.ENT, 200);
  assert.equal(c.parCategorie.CT, 80);
  assert.equal(c.parGroupe.entretien, 280);
  assert.equal(c.parGroupe.energie, 600);
  assert.equal(c.km, 10000);
  assert.equal(c.coutKm, 0.138);
  assert.equal(c.coutMensuel, 115.08); // 1 380 € sur 365 jours (11,99 mois)
  // Saisie de dépense : entretien et contrôle ne se saisissent pas comme dépense (pas de double compte).
  assert.equal(R.normaliserDepense({ categorie: 'ENT', montant: 10 }, B).categorie, 'AUT');
});

test('coûts : période effective à partir de l\'entrée dans le carnet, coût au km absent sans km', () => {
  const e = etat({ vehicules: [voiture({ achat: '2026-09-15', kmAchat: 1000 })], depenses: [R.normaliserDepense({ vehiculeId: 'v1', date: '2026-10-01', categorie: 'ASS', montant: 120 }, B)] });
  const c = R.couts(e, B, 'v1', '2025-11-15', AUJ);
  assert.equal(c.debut, '2026-09-15');
  assert.equal(c.coutKm, null);
  assert.ok(c.coutMensuel > 55 && c.coutMensuel < 65); // ≈ 2 mois
  const mois = R.coutsParMois(e, null, AUJ, 12);
  assert.equal(mois.length, 12);
  assert.equal(mois[11].mois, '2026-11');
  assert.equal(mois[0].mois, '2025-12');
  assert.equal(mois.find((m) => m.mois === '2026-10').total, 120);
});

test('alertes : entretien, contrôle technique, contre-visite critique et relevé ancien, retards d\'abord', () => {
  const v = voiture({ miseEnCirculation: '2022-12-01', plan: [{ id: 'VID', nom: 'Vidange', km: 15000, mois: 12 }] });
  const e = etat({
    vehicules: [v, voiture({ id: 'v2', nom: 'Break diesel', energie: 'GO', plan: [] })],
    releves: [R.normaliserReleve({ vehiculeId: 'v1', date: '2026-11-01', km: 56000 }), R.normaliserReleve({ vehiculeId: 'v2', date: '2026-05-01', km: 41000 })],
    controles: [R.normaliserControle({ vehiculeId: 'v2', date: '2026-11-10', resultat: 'critique' })],
  });
  const a = R.alertes(e, B, AUJ);
  const types = a.map((x) => `${x.vehiculeId}:${x.type}:${x.etat}`);
  assert.ok(types.includes('v1:entretien:retard')); // 56 000 ≥ 40 000 + 15 000
  assert.ok(types.includes('v1:ct:proche')); // premier CT au plus tard le 30/11/2026
  assert.ok(types.includes('v2:ct:retard')); // défaillance critique
  assert.ok(types.includes('v2:releve:proche'));
  assert.equal(a[0].etat, 'retard');
  assert.ok(a.findIndex((x) => x.etat === 'proche') > a.findLastIndex((x) => x.etat === 'retard'));
  // Une voiture vendue (inactive) ne génère plus d'alerte.
  e.vehicules[1].actif = false;
  assert.ok(!R.alertes(e, B, AUJ).some((x) => x.vehiculeId === 'v2'));
});

test('historique de revente : trié, montants masqués par défaut, texte à copier', () => {
  const e = etat({
    entretiens: [R.normaliserEntretien({ vehiculeId: 'v1', date: '2025-03-01', km: 45000, operations: ['VID', 'FHA'], garage: 'Garage du quartier', cout: 180 }), R.normaliserEntretien({ vehiculeId: 'v1', date: '2026-03-01', km: 52000, operations: ['REV'], cout: 250 })],
    controles: [R.normaliserControle({ vehiculeId: 'v1', date: '2026-03-10', km: 52200, resultat: 'favorable', cout: 80 })],
    depenses: [R.normaliserDepense({ vehiculeId: 'v1', date: '2026-05-01', categorie: 'PNE', libelle: '4 pneus', montant: 400 }, B), R.normaliserDepense({ vehiculeId: 'v1', date: '2026-05-02', categorie: 'PEA', montant: 12 }, B)],
  });
  const h = R.historique(e, B, e.vehicules[0], AUJ);
  assert.equal(h.lignes.length, 4); // le péage n'y figure pas
  assert.equal(h.lignes[0].type, 'Pneus');
  assert.equal(h.lignes.at(-1).date, '2025-03-01');
  assert.equal(h.lignes[0].montant, undefined);
  assert.match(h.lignes.at(-1).detail, /Vidange et filtre à huile, Filtre d'habitacle/);
  const avec = R.historique(e, B, e.vehicules[0], AUJ, { montants: true });
  assert.equal(avec.lignes.at(-1).montant, 180);
  const t = R.texteHistorique(h, AUJ);
  assert.match(t, /AA-123-AA/);
  assert.match(t, /Garage du quartier/);
  assert.doesNotMatch(t, /€/);
  assert.match(R.texteHistorique(avec, AUJ), /180,00 €/);
});

test('CSV : point-virgule, BOM, formules neutralisées, entretiens et contrôles inclus', () => {
  const e = etat({
    depenses: [R.normaliserDepense({ vehiculeId: 'v1', date: '2026-10-01', categorie: 'AUT', libelle: '=SOMME(A1)', montant: 12.5 }, B), plein({ date: '2026-10-02', km: 1000, quantite: 30.5, montant: 55 })],
    entretiens: [R.normaliserEntretien({ vehiculeId: 'v1', date: '2026-09-01', cout: 100, garage: 'Garage; test' })],
  });
  const csv = R.csvJournal(e, B);
  assert.ok(csv.startsWith('﻿Date;Voiture'));
  assert.match(csv, /'=SOMME\(A1\)/);
  assert.match(csv, /"Garage; test"/);
  assert.match(csv, /30,5;L;55/);
  const lignes = csv.trim().split('\r\n');
  assert.equal(lignes.length, 4);
  assert.match(lignes[1], /^01\/09\/2026/); // ordre chronologique
});

test('normalisation tolérante et suppression d\'une voiture avec ses données', () => {
  const n = R.normaliser({ vehicules: [{ id: 'x', energie: 'inconnue', plan: [{ nom: 'Test', km: '-5', mois: 'abc' }] }], depenses: [{ vehiculeId: 'x', categorie: 'CAR', quantite: '-2', montant: '-3', plein: true }], reglages: { alerteJours: 9999 } }, B);
  assert.equal(n.vehicules[0].energie, 'ES');
  assert.equal(n.vehicules[0].nom, 'Ma voiture');
  assert.equal(n.vehicules[0].plan[0].km, 0);
  assert.equal(n.vehicules[0].plan[0].mois, 0);
  assert.equal(n.depenses[0].quantite, '');
  assert.equal(n.depenses[0].montant, 0);
  assert.equal(n.reglages.alerteJours, 365);
  assert.equal(n.reglages.ctPeriodiqueMois, 24);
  assert.equal(R.normaliser(null, B).vehicules.length, 0);
  // Plan absent : proposé depuis la base selon l'énergie.
  assert.ok(R.normaliserVehicule({ energie: 'EL' }, B).plan.every((o) => o.id !== 'VID'));
  const e = etat({ releves: [R.normaliserReleve({ vehiculeId: 'v1', date: AUJ, km: 1 })], depenses: [plein({ date: AUJ, quantite: 1 })] });
  const s = R.supprimerVehicule(e, 'v1');
  assert.equal(s.vehicules.length + s.releves.length + s.depenses.length, 0);
  assert.ok(R.taille(e) > 100);
});

test('base intégrée : source du contrôle technique datée, aucune marque, aucun prix', () => {
  assert.match(B.ct.source.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
  assert.equal(B.ct.source.verifie, '1er janvier 2026');
  assert.equal(B.reglages.ctPremierMois, 48);
  assert.equal(B.reglages.ctPeriodiqueMois, 24);
  assert.equal(B.reglages.ctContreVisiteMois, 2);
  const tout = JSON.stringify(B);
  assert.doesNotMatch(tout, /€\s*\/\s*L|prixLitre|prix du litre/i);
  assert.ok(B.categories.every((c) => B.groupes.some((gr) => gr.code === c.groupe)));
  assert.equal(new Set(B.entretiens.map((o) => o.code)).size, B.entretiens.length);
});
