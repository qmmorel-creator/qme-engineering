// Tests des règles métier de la réservation de salles et bureaux (templates/salles/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/salles/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.SDR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-16'; // lundi
const DEFAUTS = { reglages: BASE.reglages };

const resa = (extra = {}) => R.normaliserReservation({ id: 'r1', ressource: 'S1', date: AUJ, debut: '09:00', fin: '10:00', par: 'Alex', personnes: 4, ...extra }, AUJ);
function etat(reservations = [], reglages = {}) {
  const e = R.etatVide(DEFAUTS);
  Object.assign(e.reglages, reglages);
  e.ressources = [
    R.normaliserRessource({ id: 'S1', nom: 'Salle Horizon', type: 'salle', capacite: 8 }),
    R.normaliserRessource({ id: 'B1', nom: 'Bureau 1', type: 'bureau' }, 1),
    R.normaliserRessource({ id: 'X1', nom: 'Ancienne salle', type: 'salle', archive: true }, 2),
  ];
  e.reservations = reservations;
  return e;
}

test('base intégrée : types, équipements, couleurs fixes, source datée des jours fériés', () => {
  assert.deepEqual(simple(BASE.types.map((t) => t.id)), ['salle', 'bureau', 'equipement']);
  assert.ok(BASE.equipements.length >= 8);
  assert.equal(BASE.couleurs.length, 8);
  assert.ok(BASE.couleurs.every((c) => /^#[0-9A-F]{6}$/i.test(c)));
  assert.match(BASE.sourceFeries, /L3133-1/);
  assert.match(BASE.sourceFeries, /14\/11\/2026/);
  assert.ok(BASE.sources.length >= 1 && BASE.sources.every(([, u]) => u.startsWith('https://')));
  // Aucun véhicule (template de flotte à part), aucune marque d'agenda ou de logiciel tiers.
  const textes = ['donnees.js', 'regles.js', 'app.js'].map((f) => readFileSync(new URL(f, dossier), 'utf8')).join('\n');
  assert.doesNotMatch(textes, /outlook|google agenda|google calendar|teams|zoom|slack/i);
});

test('heures et durées', () => {
  assert.equal(R.minutes('09:30'), 570);
  assert.equal(R.heure(570), '09:30');
  assert.equal(R.texteDuree(90), '1 h 30');
  assert.equal(R.texteDuree(45), '45 min');
  assert.equal(R.texteDuree(120), '2 h');
  assert.equal(R.estHeure('24:00'), false);
  assert.equal(R.lundi('2026-11-19'), '2026-11-16');
  assert.equal(R.lundi('2026-11-22'), '2026-11-16');
});

test('jours fériés : Pâques calculé, fêtes mobiles, Alsace-Moselle en option', () => {
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  assert.equal(R.paques(2024), '2024-03-31');
  const f26 = R.feries(2026);
  assert.equal(Object.keys(f26).length, 11);
  assert.equal(f26['2026-05-14'], 'Ascension'); // service-public : 14 mai 2026
  assert.equal(f26['2026-05-25'], 'Lundi de Pentecôte'); // 25 mai 2026
  assert.equal(f26['2026-04-06'], 'Lundi de Pâques');
  const f27 = R.feries(2027);
  assert.equal(f27['2027-05-06'], 'Ascension'); // 6 mai 2027
  assert.equal(f27['2027-05-17'], 'Lundi de Pentecôte'); // 17 mai 2027
  const am = R.feries(2026, { alsaceMoselle: true });
  assert.equal(Object.keys(am).length, 13);
  assert.equal(am['2026-04-03'], 'Vendredi saint');
  assert.equal(am['2026-12-26'], 'Saint-Étienne');
  const g = R.reglagesDe({}, BASE.reglages);
  assert.equal(R.jourOuvert('2026-11-11', g).raison, 'ferie');
  assert.equal(R.jourOuvert('2026-11-14', g).raison, 'jour'); // samedi
  assert.equal(R.jourOuvert('2026-11-11', { ...g, feries: false }).ouvert, true);
  assert.equal(R.prochainJourOuvert('2026-11-14', g), '2026-11-16');
});

test('chevauchement : même ressource, même jour, créneaux qui se recouvrent ; bout à bout autorisé', () => {
  const a = resa();
  assert.equal(R.chevauche(a, resa({ id: 'r2', debut: '09:30', fin: '11:00' })), true);
  assert.equal(R.chevauche(a, resa({ id: 'r2', debut: '10:00', fin: '11:00' })), false);
  assert.equal(R.chevauche(a, resa({ id: 'r2', debut: '08:00', fin: '09:00' })), false);
  assert.equal(R.chevauche(a, resa({ id: 'r2', debut: '08:00', fin: '12:00' })), true);
  assert.equal(R.chevauche(a, resa({ id: 'r2', ressource: 'B1' })), false);
  assert.equal(R.chevauche(a, resa({ id: 'r2', date: '2026-11-17' })), false);
  assert.equal(R.chevauche(a, a), false);
  const c = R.conflits([a, resa({ id: 'r2', debut: '09:30', fin: '10:30' }), resa({ id: 'r3', debut: '10:00', fin: '11:00' })]);
  assert.deepEqual(simple(c.map((x) => [x.a.id, x.b.id])), [['r1', 'r2'], ['r2', 'r3']]);
});

test('validation : conflit refusé, horaires, pas, fermé, capacité, archive, délais', () => {
  const e = etat([resa()]);
  const v = (x, o) => R.valider(resa({ id: 'n', ...x }), e, { auj: AUJ, ...o });
  assert.equal(v({ debut: '10:00', fin: '11:00' }).ok, true);
  const c = v({ debut: '09:30', fin: '10:30' });
  assert.equal(c.ok, false);
  assert.match(c.erreur, /déjà réservée de 09:00 à 10:00 par Alex/);
  assert.equal(c.conflits.length, 1);
  assert.match(v({ debut: '07:00', fin: '08:30' }).erreur, /de 08:00 à 19:00/);
  assert.match(v({ debut: '10:15', fin: '11:00' }).erreur, /par 30 minutes/);
  assert.match(R.valider({ ...resa(), id: 'n', debut: '09:00', fin: '08:00' }, e).erreur, /après le début/);
  assert.match(v({ date: '2026-11-14' }).erreur, /fermé le samedi/);
  assert.match(v({ date: '2026-11-11' }).erreur, /férié \(Armistice 1918\)/);
  assert.match(v({ personnes: 9, debut: '11:00', fin: '12:00' }).erreur, /8 personnes au plus/);
  assert.equal(v({ ressource: 'B1', personnes: 3 }).ok, true, 'capacité contrôlée pour les salles seulement');
  assert.match(v({ ressource: 'X1' }).erreur, /archivée/);
  assert.match(v({ date: R.ajout(AUJ, 120), debut: '11:00', fin: '12:00' }).erreur, /90 jours à l'avance/);
  assert.equal(v({ date: R.ajout(AUJ, 120), debut: '11:00', fin: '12:00' }, { nouvelle: false }).ok, true);
  e.reglages.dureeMax = 120;
  assert.match(v({ debut: '10:00', fin: '13:00' }).erreur, /2 h au plus/);
  // Une réservation ne se bloque pas elle-même lorsqu'on la modifie.
  assert.equal(R.valider(resa({ fin: '10:30' }), e, { auj: AUJ }).ok, true);
});

test('série chaque semaine : dates, conflits refusés et listés, 52 au plus', () => {
  assert.deepEqual(simple(R.datesHebdo('2026-11-16', '2026-12-07')), ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
  assert.equal(R.datesHebdo('2026-01-05', '2028-01-01').length, 52);
  const e = etat([resa({ id: 'x', date: '2026-11-30', debut: '09:30', fin: '10:30' })]);
  const p = R.planSerie(resa({ id: 'S', serie: 'S' }), '2026-12-28', e, { auj: AUJ, nouvelle: false });
  assert.deepEqual(simple(p.retenues.map((r) => r.date)), ['2026-11-16', '2026-11-23', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
  assert.deepEqual(simple(p.refusees.map((r) => r.date)), ['2026-11-30']);
  assert.match(p.refusees[0].erreur, /déjà réservée/);
  assert.ok(p.retenues.every((r) => r.serie === 'S'));
  assert.equal(new Set(p.retenues.map((r) => r.id)).size, 6);
  // Série du mercredi : le 11 novembre (férié) est refusé.
  const m = R.planSerie(resa({ id: 'M', date: '2026-11-04' }), '2026-11-18', etat(), { auj: '2026-11-01' });
  assert.deepEqual(simple(m.refusees.map((r) => r.date)), ['2026-11-11']);
  assert.match(m.refusees[0].erreur, /férié \(Armistice 1918\)/);
});

test('libre maintenant : libre jusqu\'à, occupée jusqu\'à (créneaux enchaînés), fermée', () => {
  const e = etat([resa(), resa({ id: 'r2', debut: '10:00', fin: '11:00' }), resa({ id: 'r3', debut: '14:00', fin: '15:00' })]);
  const at = (h, d = AUJ, id = 'S1') => simple(R.etatRessource(id, e, d, R.minutes(h)));
  assert.equal(at('08:30').statut, 'libre');
  assert.equal(at('08:30').jusqua, '09:00');
  const o = at('09:15');
  assert.equal(o.statut, 'occupee');
  assert.equal(o.resa.id, 'r1');
  assert.equal(o.libreA, '11:00');
  assert.equal(o.prochaine.id, 'r3');
  assert.equal(at('12:00').jusqua, '14:00');
  assert.equal(at('16:00').jusqua, '19:00');
  assert.equal(at('16:00', AUJ, 'B1').prochaine, null);
  assert.equal(at('07:00').statut, 'fermee');
  assert.equal(at('07:00').ouvreA, '08:00');
  assert.equal(at('19:00').raison, 'apres');
  assert.equal(at('10:00', '2026-11-15').raison, 'jour');
});

test('réservation rapide et « libérer maintenant »', () => {
  const e = etat([resa({ debut: '11:00', fin: '12:00' })]);
  assert.deepEqual(simple(R.creneauMaintenant('S1', e, AUJ, R.minutes('09:40'), 60)), { debut: '09:30', fin: '10:30' });
  assert.deepEqual(simple(R.creneauMaintenant('S1', e, AUJ, R.minutes('10:20'), 60)), { debut: '10:00', fin: '11:00' });
  assert.deepEqual(simple(R.creneauMaintenant('S1', e, AUJ, R.minutes('10:40'), 60)), { debut: '10:30', fin: '11:00' });
  assert.equal(R.creneauMaintenant('S1', e, AUJ, R.minutes('11:10'), 60), null);
  // Juste après une réservation qui finit à 12:00, le créneau ne recommence pas avant 12:00.
  const e2 = etat([resa({ debut: '11:00', fin: '12:00' })]);
  assert.deepEqual(simple(R.creneauMaintenant('S1', e2, AUJ, R.minutes('12:05'), 30)), { debut: '12:00', fin: '12:30' });
  assert.deepEqual(simple(R.creneauMaintenant('S1', e, AUJ, R.minutes('18:50'), 60)), { debut: '18:30', fin: '19:00' });
  assert.equal(R.creneauMaintenant('S1', e, AUJ, R.minutes('19:10'), 60), null);
  const r = resa({ debut: '09:00', fin: '12:00' });
  assert.equal(R.finLiberee(r, R.minutes('10:10'), 30), '10:30');
  assert.equal(R.finLiberee(r, R.minutes('10:00'), 30), '10:30');
  assert.equal(R.finLiberee(r, R.minutes('11:50'), 30), '12:00');
  assert.equal(R.finLiberee(r, R.minutes('08:00'), 30), null);
});

test('occupation : minutes réservées sur minutes d\'ouverture, jours fermés et fériés exclus', () => {
  // Semaine du 9 au 15/11/2026 : mercredi 11 férié → 4 jours ouverts de 11 h.
  const e = etat([
    resa({ date: '2026-11-09', debut: '08:00', fin: '19:00' }),
    resa({ id: 'r2', date: '2026-11-10', debut: '09:00', fin: '10:30' }),
    resa({ id: 'r3', date: '2026-11-11', debut: '09:00', fin: '10:30' }), // férié : ignorée
    resa({ id: 'r4', ressource: 'B1', date: '2026-11-12', debut: '14:00', fin: '15:00' }),
  ]);
  const o = R.occupation(e, '2026-11-09', '2026-11-16');
  assert.equal(o.joursOuverts, 4);
  const s1 = o.parRessource.find((x) => x.ressource === 'S1');
  assert.equal(s1.ouvert, 4 * 660);
  assert.equal(s1.reserve, 660 + 90);
  assert.equal(s1.nb, 2);
  assert.equal(Math.round(s1.taux * 10) / 10, Math.round(((750 / 2640) * 100) * 10) / 10);
  assert.equal(o.parRessource.length, 2, 'ressources archivées exclues');
  assert.equal(o.reserve, 750 + 60);
  assert.equal(o.parJour[1].reserve, 660); // lundi
  assert.equal(o.parJour[3].ouvert, 0); // mercredi férié
  assert.equal(o.heures[0], 8);
  assert.equal(o.carte[2][1].reserve, 60); // mardi, 9 h–10 h
  assert.equal(o.carte[2][2].reserve, 30);
});

test('synchronisation : les actions locales rejouées sur la version du serveur, conflits refusés', () => {
  const serveur = etat([resa({ id: 'a', debut: '09:00', fin: '10:00', par: 'Sam' })]);
  const ops = [
    { type: 'ajout', resa: resa({ id: 'n1', debut: '09:30', fin: '10:30', par: 'Alex' }) }, // prise entre-temps
    { type: 'ajout', resa: resa({ id: 'n2', debut: '11:00', fin: '12:00' }) },
    { type: 'modif', resa: resa({ id: 'disparue', debut: '15:00', fin: '16:00' }) },
    { type: 'suppr', id: 'a' },
    { type: 'ajout', resa: resa({ id: 'n3', debut: '09:00', fin: '09:30' }) }, // libre une fois « a » supprimée
  ];
  const { etat: e, refusees } = R.rejouer(serveur, ops);
  assert.deepEqual(simple(e.reservations.map((r) => r.id)).sort(), ['n2', 'n3']);
  assert.deepEqual(simple(refusees.map((r) => [r.resa.id, r.raison])), [['n1', 'conflit'], ['disparue', 'supprimee']]);
  assert.equal(refusees[0].avec.par, 'Sam');
  assert.equal(serveur.reservations.length, 1, 'entrée non modifiée');
});

test('normalisation tolérante et réglages bornés', () => {
  const n = R.normaliser({ organisation: 'X'.repeat(200), reglages: { ouverture: '20:00', fermeture: '07:00', jours: [9, 1, 1, 3], pas: 20, dureeMax: '', avanceMax: 5000 }, ressources: [{ nom: 'A', type: 'vehicule' }, null], reservations: [{ ressource: 'A', debut: '10:00', fin: '09:00' }] }, AUJ, DEFAUTS);
  assert.equal(n.organisation.length, 80);
  assert.equal(n.reglages.ouverture, '20:00');
  assert.equal(n.reglages.fermeture, '23:30');
  assert.deepEqual(simple(n.reglages.jours), [1, 3]);
  assert.equal(n.reglages.pas, 30);
  assert.equal(n.reglages.dureeMax, null);
  assert.equal(n.reglages.avanceMax, 730);
  assert.equal(n.ressources[0].type, 'salle');
  assert.equal(n.ressources[1].nom, 'Ressource 2');
  assert.equal(n.reservations[0].date, AUJ);
  assert.equal(n.reservations[0].fin, '10:30');
  assert.deepEqual(simple(R.normaliser(null, AUJ, DEFAUTS).reglages), simple(R.reglagesDe({}, BASE.reglages)));
});

test('listes, effacement des noms, export CSV', () => {
  const l = [resa({ id: 'p', date: '2026-11-13' }), resa({ id: 'c', debut: '09:00', fin: '10:00' }), resa({ id: 'f', date: '2026-11-17', serie: 'S' }), resa({ id: 'g', date: '2026-11-24', serie: 'S' })];
  assert.deepEqual(simple(R.aVenir(l, AUJ, R.minutes('09:30')).map((r) => r.id)), ['c', 'f', 'g']);
  assert.deepEqual(simple(R.aVenir(l, AUJ, R.minutes('10:00')).map((r) => r.id)), ['f', 'g']);
  assert.deepEqual(simple(R.occurrencesSuivantes(l, l[2]).map((r) => r.id)), ['f', 'g']);
  assert.equal(R.memeNom(' alex', 'Alex '), true);
  assert.equal(R.memeNom('', ''), false);
  const e = etat(l.map((r) => ({ ...r, objet: 'Point', note: 'n' })));
  const { etat: a, n } = R.anonymiser(e, AUJ);
  assert.equal(n, 1);
  assert.equal(a.reservations.find((r) => r.id === 'p').par, '');
  assert.equal(a.reservations.find((r) => r.id === 'c').par, 'Alex');
  assert.equal(e.reservations[0].par, 'Alex', 'entrée non modifiée');
  const csv = R.versCsv(etat([resa({ objet: 'Réunion; budget' })]));
  assert.ok(csv.startsWith('﻿Date;Jour;Début'));
  assert.match(csv, /2026-11-16;lundi;09:00;10:00;60;Salle Horizon;Salle;"Réunion; budget";Alex;4;;/);
});
