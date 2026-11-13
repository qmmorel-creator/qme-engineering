// Tests des règles métier du calculateur de temps de vie (templates/temps-de-vie/calculs.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/temps-de-vie/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('calculs.js', dossier), 'utf8'), ctx);
const B = ctx.window.BASE;
const C = ctx.window.TDV_CALCUL;
const D = B.defauts;
const P = B.periodicites;
const proche = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const REF = '2026-11-13';
// Profil fictif : 2 600 € net par mois, 35 h sur 5 jours, 25 jours de congés, 8 jours non travaillés.
const profil = (extra = {}) => ({ revenuMensuel: 2600, heuresSemaine: 35, joursSemaine: 5, moisTravailles: 12, conges: 25, nonTravailles: 8, trajetMinutes: 60, fraisPro: 50, inclureTransport: true, ...extra });

test('base : bibliothèque du cahier des charges, aucun montant ni barème', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(B.categories.map((c) => c.nom))), ['Logement', 'Mobilité', 'Alimentation', 'Équipement', 'Loisirs', 'Services et dépenses récurrentes', 'Famille']);
  const sous = (id) => JSON.parse(JSON.stringify(B.categories.find((c) => c.id === id).sous.map((s) => s.nom)));
  assert.deepEqual(sous('logement'), ['Loyer', 'Crédit immobilier', 'Charges', 'Électricité', 'Gaz', 'Eau', 'Internet', 'Assurance habitation', 'Travaux et entretien']);
  assert.equal(sous('mobilite').length, 8); assert.equal(sous('alimentation').length, 5); assert.equal(sous('equipement').length, 7);
  assert.equal(sous('loisirs').length, 6); assert.equal(sous('services').length, 5); assert.equal(sous('famille').length, 5);
  assert.equal(B.profils.length, 5);
  assert.equal(B.conventions.length, 3);
  assert.ok(!/taux|impot|prélèvement|cotisation/i.test(Object.keys(B).join(',')));
  for (const c of B.categories) for (const s of c.sous) assert.ok(!('montant' in s));
});

test('convention 1 · contractuel : revenu annuel / (heures × 52)', () => {
  const t = C.taux(profil(), 'contrat', D);
  proche(t.horaire, 2600 * 12 / (35 * 52));
  proche(t.heuresAn, 1820); proche(t.joursAn, 260);
  proche(t.journalier, 31200 / 260);
  proche(t.mensuel, 2600);
  proche(t.hebdomadaire, t.horaire * 35);
  assert.equal(t.heuresTransport, 0);
});

test('convention 3 · annuel effectif : jours travaillés, congés et jours non travaillés retirés', () => {
  const t = C.taux(profil(), 'effectif', D);
  proche(t.joursAn, 260 - 25 - 8); // 227 jours
  proche(t.heuresAn, 227 * 7);
  proche(t.horaire, 31200 / (227 * 7));
  const saison = C.taux(profil({ moisTravailles: 6, conges: 0, nonTravailles: 0 }), 'effectif', D);
  proche(saison.joursAn, 130);
});

test('convention 2 · réel : transport compté à part, dépenses professionnelles retirées', () => {
  const t = C.taux(profil(), 'reel', D);
  proche(t.heuresTravail, 227 * 7);
  proche(t.heuresTransport, 227); // 60 min par jour travaillé
  proche(t.heuresAn, 227 * 8);
  proche(t.revenuAnnuel, 31200 - 600);
  proche(t.horaire, 30600 / (227 * 8));
  const sansTrajet = C.taux(profil({ inclureTransport: false }), 'reel', D);
  assert.equal(sansTrajet.heuresTransport, 0);
  assert.ok(sansTrajet.horaire > t.horaire);
  const impossible = C.taux(profil({ fraisPro: 3000 }), 'reel', D);
  assert.equal(impossible.horaire, null); assert.ok(impossible.negatif);
});

test('profil partiel : revenu seul, hypothèses listées ; revenu annuel prioritaire', () => {
  const t = C.taux({ revenuMensuel: 2000 }, 'contrat', D);
  proche(t.horaire, 24000 / 1820);
  assert.deepEqual(JSON.parse(JSON.stringify([...t.profil.hypotheses].sort())), ['conges', 'fraisPro', 'heuresSemaine', 'joursSemaine', 'moisTravailles', 'nonTravailles', 'trajetMinutes']);
  const a = C.taux({ revenuMensuel: 2000, revenuAnnuel: 30000 }, 'contrat', D);
  proche(a.revenuAnnuel, 30000); assert.equal(a.sourceRevenu, 'annuel');
  assert.equal(C.taux({}, 'contrat', D).horaire, null);
  const partiel = C.taux({ revenuMensuel: 1500, heuresSemaine: 24, joursSemaine: 3 }, 'effectif', D);
  proche(partiel.heuresParJour, 8);
});

test('conversion d\'une dépense : heures, jours, semaines, mois', () => {
  const t = C.taux(profil(), 'contrat', D);
  const c = C.convertir(900, t);
  proche(c.heures, 900 / t.horaire);
  proche(c.jours, c.heures / 7);
  proche(c.semaines, c.heures / 35);
  proche(c.mois, c.heures / (1820 / 12));
  assert.equal(C.convertir(100, { horaire: null }), null);
});

test('calculateur instantané : dépense récurrente sur 1, 5 et 10 ans', () => {
  const t = C.taux(profil(), 'contrat', D);
  const r = C.instantane(15, 'mois', t, P);
  assert.ok(r.recurrent);
  proche(r.annuel.montant, 180); proche(r.cinqAns.montant, 900); proche(r.dixAns.montant, 1800);
  proche(r.dixAns.heures, 1800 / t.horaire);
  const u = C.instantane(2500, 'unique', t, P);
  assert.equal(u.recurrent, false); assert.equal(u.annuel, undefined);
  proche(C.annuel(12, 'semaine', P), 624); proche(C.annuel(3, 'jour', P), 1095); proche(C.annuel(240, 'trimestre', P), 960);
});

test('mode de vie : récurrentes actives et achats des 12 derniers mois seulement', () => {
  const t = C.taux(profil(), 'contrat', D);
  const dep = [
    { id: 'a', libelle: 'Loyer', categorie: 'logement', montant: 800, periode: 'mois', date: '2025-01-01' },
    { id: 'b', libelle: 'Abonnement', categorie: 'services', montant: 10, periode: 'mois', date: '2025-01-01', actif: false },
    { id: 'c', libelle: 'Téléphone', categorie: 'equipement', montant: 900, periode: 'unique', date: '2026-06-01' },
    { id: 'd', libelle: 'Vieux canapé', categorie: 'equipement', montant: 1000, periode: 'unique', date: '2025-06-01' },
    { id: 'e', libelle: 'Courses', categorie: 'alimentation', montant: 400, periode: 'mois', date: '2025-01-01' },
  ];
  const m = C.modeDeVie(dep, t, P, REF);
  proche(m.total, 9600 + 900 + 4800);
  assert.equal(m.lignes.length, 3);
  assert.equal(m.premiere.id, 'logement');
  proche(m.categories.reduce((s, c) => s + c.part, 0), 1);
  proche(m.heuresSemaine, m.total / t.horaire / 52);
  proche(m.partDuTravail, m.total / t.horaire / 1820);
  proche(m.categories[0].heuresMois, 800 / t.horaire);
  assert.equal(m.top10[0].depense.id, 'a');
});

test('scénarios : économie mensuelle, annuelle, heures, jours et cumuls', () => {
  const t = C.taux(profil(), 'contrat', D);
  const sc = { lignes: [{ avant: 180, apres: 90, periode: 'mois' }, { avant: 30000, apres: 15000, periode: 'unique', duree: 10 }] };
  const r = C.scenario(sc, t, P);
  proche(r.annuelle, 1080 + 1500);
  proche(r.mensuelle, 2580 / 12);
  proche(r.heuresAn, 2580 / t.horaire);
  proche(r.joursAn, r.heuresAn / 7);
  proche(r.cumuls.find((c) => c.annees === 5).montant, 2580 * 5);
  proche(r.cumuls.find((c) => c.annees === 10).montant, 25800);
  const hausse = C.scenario({ lignes: [{ avant: 850, apres: 980, periode: 'mois' }] }, t, P);
  proche(hausse.annuelle, -1560);
});

test('coût total de possession : total, net après revente, par mois, par jour, en heures', () => {
  const t = C.taux(profil(), 'contrat', D);
  const r = C.possession({ prix: 15000, frais: 600, dureeMois: 72, entretienAn: 900, utilisationMois: 150, revente: 5000 }, t);
  proche(r.total, 15000 + 600 + 5400 + 10800);
  proche(r.net, r.total - 5000);
  proche(r.mensuel, r.net / 72);
  proche(r.journalier, r.net / (72 * 365.25 / 12));
  proche(r.heures, r.net / t.horaire);
  // Deux achats de prix et de durées différents : le moins cher n'est pas forcément le moins coûteux par mois.
  const a = C.possession({ prix: 1200, dureeMois: 60, revente: 200 }, t), b = C.possession({ prix: 500, dureeMois: 18 }, t);
  assert.ok(a.prix > b.prix && a.mensuel < b.mensuel);
});

test('export CSV des dépenses', () => {
  const t = C.taux(profil(), 'contrat', D);
  const s = C.csv([{ libelle: 'Loyer; T2', categorie: 'logement', sousCategorie: 'loyer', montant: 800, periode: 'mois', date: '2025-01-01', horaireAuMoment: 17.14 }], t, B, REF);
  assert.ok(s.startsWith('﻿Libellé;'));
  assert.ok(s.includes('"Loyer; T2";Logement;Loyer;800;Par mois;2025-01-01;oui;9600'));
  assert.ok(s.includes('17,14'));
});

test('champs vides (null, chaîne vide) : valeur par défaut signalée, jamais lus comme zéro', () => {
  const t = C.taux({ revenuMensuel: 2600, conges: null, nonTravailles: '', heuresSemaine: null }, 'effectif', D);
  proche(t.joursAn, 260 - 25 - 8);
  for (const h of ['conges', 'nonTravailles', 'heuresSemaine']) assert.ok(t.profil.hypotheses.includes(h), h);
  const zero = C.taux({ revenuMensuel: 2600, conges: 0, nonTravailles: 0 }, 'effectif', D);
  proche(zero.joursAn, 260); assert.ok(!zero.profil.hypotheses.includes('conges'));
});
