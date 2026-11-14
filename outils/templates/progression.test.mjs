// Tests des règles métier de la progression pédagogique (templates/progression/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/progression/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.PRG;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Année fictive : du 1er septembre 2026 au 30 juin 2027, vacances inventées, une classe.
const anneeTest = (fermetures = [{ id: 'v1', nom: 'Vacances 1', debut: '2026-10-17', fin: '2026-11-01' }, { id: 'v2', nom: 'Vacances 2', debut: '2026-12-19', fin: '2027-01-03' }]) =>
  R.normaliserAnnee({ id: 'a1', nom: '2026-2027', debut: '2026-09-01', fin: '2027-06-30', fermetures });
function etat(creneaux = [{ id: 'c1', jour: 1, duree: 1 }, { id: 'c2', jour: 4, duree: 2 }]) {
  const e = R.etatVide(B);
  e.annees.push(anneeTest()); e.anneeId = 'a1';
  e.progressions.push(R.normaliserProgression({ id: 'p1', anneeId: 'a1', nom: '4e B', creneaux }));
  return e;
}
const seq = (id, ordre, heures, x = {}) => R.normaliserSequence({ id, progressionId: 'p1', ordre, titre: `Séquence ${ordre}`, heures, ...x });
const seance = (id, date, statut = 'faite', x = {}) => R.normaliserSeance({ id, progressionId: 'p1', date, duree: 1, statut, ...x });

test('Pâques et jours fériés calculés (dont Ascension et Pentecôte)', () => {
  assert.equal(R.paques(2027), '2027-03-28');
  assert.equal(R.paques(2026), '2026-04-05');
  const f = Object.fromEntries(R.feries(2027).map((x) => [x.id, x.date]));
  assert.equal(f.lundiPaques, '2027-03-29');
  assert.equal(f.ascension, '2027-05-06');
  assert.equal(f.lundiPentecote, '2027-05-17');
  assert.equal(R.feries(2027).length, 11);
  assert.equal(R.feries(2027, true).length, 13);
});

test('année scolaire proposée : du 1er septembre au 30 juin, août compte pour la suivante', () => {
  assert.deepEqual(simple(R.anneeScolaire('2026-11-14')), { nom: '2026-2027', debut: '2026-09-01', fin: '2027-06-30' });
  assert.equal(R.anneeScolaire('2027-08-20').nom, '2027-2028');
});

test('contexte : fériés, vacances et jours sans cours ; fériés décochés ignorés', () => {
  const an = anneeTest([{ id: 'v1', nom: 'Vacances', debut: '2026-10-17', fin: '2026-11-01' }, { id: 'j1', nom: 'Journée banalisée', type: 'ferme', debut: '2026-11-24', fin: '2026-11-24' }]);
  const c = R.contexte(an, B.reglages);
  assert.equal(R.ferme(c, '2026-11-11').type, 'ferie');
  assert.equal(R.ferme(c, '2026-10-20').type, 'vacances');
  assert.equal(R.ferme(c, '2026-11-24').type, 'ferme');
  assert.equal(R.ferme(c, '2026-11-25'), null);
  const c2 = R.contexte(an, { ...B.reglages, feriesIgnores: ['nov11'] });
  assert.equal(R.ferme(c2, '2026-11-11'), null);
});

test('créneaux : jours de cours hors fermetures, dans les bornes de la classe', () => {
  const e = etat();
  const c = R.contexte(e.annees[0], e.reglages);
  const p = e.progressions[0];
  const sept = R.creneaux(p, c, '2026-09-01', '2026-09-30');
  // Septembre 2026 : 4 lundis (7, 14, 21, 28) et 4 jeudis (3, 10, 17, 24).
  assert.equal(sept.length, 8);
  assert.equal(R.somme(sept), 12);
  // Lundi 2 novembre 2026 : premier jour après les vacances ; mercredi 11 novembre férié (pas de cours ce jour-là de toute façon).
  const nov = R.creneaux(p, c, '2026-10-15', '2026-11-05').map((x) => x.date);
  assert.deepEqual(simple(nov), ['2026-10-15', '2026-11-02', '2026-11-05']);
  const p2 = { ...p, debut: '2026-09-15', fin: '2026-09-21' };
  assert.deepEqual(simple(R.creneaux(p2, c).map((x) => x.date)), ['2026-09-17', '2026-09-21']);
  assert.equal(R.heuresHebdo(p), 3);
});

test('semaines A et B : alternance qui saute les vacances (réglage) ou suit le calendrier', () => {
  const an = anneeTest();
  const c = R.contexte(an, B.reglages);
  assert.equal(R.semaineAB(c, '2026-09-01', '2026-09-03'), 'A');
  assert.equal(R.semaineAB(c, '2026-09-01', '2026-09-10'), 'B');
  assert.equal(R.semaineAB(c, '2026-09-01', '2026-10-12'), 'A');
  // Une seule semaine de vacances (19 au 25/10) : le 02/11 est A si l'on saute les vacances, B sinon.
  const an1 = anneeTest([{ id: 'v1', nom: 'Vacances courtes', debut: '2026-10-17', fin: '2026-10-25' }]);
  assert.equal(R.semaineAB(R.contexte(an1, B.reglages), '2026-09-01', '2026-11-02'), 'A');
  assert.equal(R.semaineAB(R.contexte(an1, { ...B.reglages, sauteVacances: false }), '2026-09-01', '2026-11-02'), 'B');
  const e = etat([{ id: 'c1', jour: 5, duree: 1, semaine: 'A' }]);
  const l = R.creneaux(e.progressions[0], R.contexte(e.annees[0], e.reglages), '2026-09-01', '2026-09-30').map((x) => x.date);
  assert.deepEqual(simple(l), ['2026-09-04', '2026-09-18']);
  assert.equal(R.heuresHebdo(e.progressions[0]), 0.5);
});

test('périodes entre deux vacances', () => {
  const p = R.periodes(R.contexte(anneeTest(), B.reglages));
  assert.deepEqual(simple(p.map((x) => [x.debut, x.fin])), [['2026-09-01', '2026-10-16'], ['2026-11-02', '2026-12-18'], ['2027-01-04', '2027-06-30']]);
});

test('répartition des durées sur des créneaux (créneau partagé entre deux séquences, manque)', () => {
  const cr = [{ date: 'J1', duree: 2 }, { date: 'J2', duree: 2 }, { date: 'J3', duree: 2 }];
  const r = R.repartir([3, 2, 4], cr);
  assert.deepEqual(simple(r), [{ debut: 'J1', fin: 'J2', manque: 0 }, { debut: 'J2', fin: 'J3', manque: 0 }, { debut: 'J3', fin: null, manque: 3 }]);
  assert.deepEqual(simple(R.repartir([0, 1], cr)), [{ debut: 'J1', fin: 'J1', manque: 0 }, { debut: 'J1', fin: 'J1', manque: 0 }]);
});

test('bilan : avancement réel, attendu, retard, projection, marge et alerte « ne tient pas »', () => {
  const e = etat([{ id: 'c1', jour: 1, duree: 1 }]); // un cours d'une heure le lundi
  e.sequences.push(seq('s1', 1, 3), seq('s2', 2, 4));
  // Lundis de septembre : 7, 14, 21, 28. Deux faits sur s1, un annulé, le 28 non renseigné.
  e.seances.push(seance('x1', '2026-09-07', 'faite', { sequenceId: 's1' }), seance('x2', '2026-09-14', 'faite', { sequenceId: 's1' }), seance('x3', '2026-09-21', 'annulee'));
  const c = R.contexte(e.annees[0], e.reglages);
  const b = R.bilan(e, e.progressions[0], c, '2026-09-30');
  assert.equal(b.attendu, 4);
  assert.equal(b.reel, 2);
  assert.equal(b.retard, 2);
  assert.equal(b.retardSeances, 2);
  assert.equal(b.nonRenseignes.length, 1);
  assert.equal(b.nonRenseignes[0].date, '2026-09-28');
  assert.equal(b.courante.sequence.id, 's1');
  assert.equal(b.sequences[0].reste, 1);
  // Reste 1 h de s1 (lundi 5/10) puis 4 h de s2 : 12/10, puis 2, 9 et 16/11 (vacances du 17/10 au 01/11).
  assert.equal(b.sequences[0].fin, '2026-10-05');
  assert.equal(b.sequences[1].fin, '2026-11-16');
  assert.equal(b.finProjetee, '2026-11-16');
  assert.ok(b.tient);
  assert.equal(b.marge, R.arrondi(b.dispoRestant - 5, 2));
  // Programme trop long : alerte.
  e.sequences.push(seq('s3', 3, 200));
  const b2 = R.bilan(e, e.progressions[0], c, '2026-09-30');
  assert.equal(b2.tient, false);
  assert.ok(b2.marge < 0);
  assert.equal(b2.sequences[2].fin, null);
  assert.ok(b2.sequences[2].manque > 0);
  assert.equal(b2.finProjetee, null);
});

test('bilan : séquence terminée plus tôt (avance) et séquence qui dépasse sa durée', () => {
  const e = etat([{ id: 'c1', jour: 1, duree: 1 }]);
  e.sequences.push(seq('s1', 1, 4, { terminee: '2026-09-14' }), seq('s2', 2, 1));
  e.seances.push(seance('x1', '2026-09-07', 'faite', { sequenceId: 's1' }), seance('x2', '2026-09-14', 'faite', { sequenceId: 's1' }), seance('x3', '2026-09-21', 'faite', { sequenceId: 's2' }), seance('x4', '2026-09-28', 'faite', { sequenceId: 's2' }));
  const b = R.bilan(e, e.progressions[0], R.contexte(e.annees[0], e.reglages), '2026-09-30');
  assert.equal(b.reel, 5); // 4 (terminée) + 1 (plafonnée à sa durée)
  assert.equal(b.attendu, 4);
  assert.equal(b.retard, -1);
  assert.equal(b.sequences[1].depasse, true);
  assert.equal(b.sequences[0].etat, 'terminee');
  assert.equal(b.sequences[1].etat, 'en-cours');
});

test('séances du jour et séances prévues : créneaux à venir et non renseignés', () => {
  const e = etat([{ id: 'c1', jour: 1, duree: 1 }]);
  e.sequences.push(seq('s1', 1, 10));
  e.seances.push(seance('x1', '2026-09-07', 'prevue', { sequenceId: 's1' }), seance('x2', '2026-09-14', 'faite', { sequenceId: 's1' }));
  const c = R.contexte(e.annees[0], e.reglages);
  const b = R.bilan(e, e.progressions[0], c, '2026-09-14');
  assert.deepEqual(simple(b.nonRenseignes.map((x) => x.date)), ['2026-09-07']); // une séance « prévue » ne renseigne pas
  assert.equal(b.avenir[0].date, '2026-09-21'); // le créneau du jour est consigné
});

test('jalon à plage : avant, dans, dépassé', () => {
  const f = { debut: '2027-01-10', fin: '2027-01-20' };
  assert.deepEqual(simple(R.etatPlage('2027-01-05', f)), { code: 'avance', jours: 5 });
  assert.deepEqual(simple(R.etatPlage('2027-01-15', f)), { code: 'dans', jours: 5 });
  assert.deepEqual(simple(R.etatPlage('2027-01-25', f)), { code: 'depasse', jours: 5 });
  assert.equal(R.etatPlage(null, f).code, 'depasse');
  assert.equal(R.etatPlage('2027-01-01', null), null);
});

test('reporter : séance reportée, contenu replacé au prochain créneau libre', () => {
  const e = etat([{ id: 'c1', jour: 1, duree: 1 }]);
  e.seances.push(seance('x1', '2026-09-07', 'faite', { contenu: 'Découverte' }), seance('x2', '2026-09-14', 'prevue'));
  const r = R.reporter(e, 'x1', R.contexte(e.annees[0], e.reglages), '2026-09-07');
  assert.equal(r.E.seances.find((s) => s.id === 'x1').statut, 'reportee');
  assert.equal(r.nouvelle.date, '2026-09-21'); // le 14 est déjà occupé par une séance prévue
  assert.equal(r.nouvelle.statut, 'prevue');
  assert.equal(r.nouvelle.contenu, 'Découverte');
});

test('objectifs : niveau de Bloom d\'après le verbe, verbes vagues, amorces ignorées', () => {
  assert.deepEqual(simple(R.analyserObjectif('Calculer une fraction', B)), { niveau: 3, verbe: 'calculer' });
  assert.equal(R.analyserObjectif('L\'élève sera capable de comparer deux textes', B).niveau, 4);
  assert.equal(R.analyserObjectif('Être capable de concevoir un protocole', B).niveau, 6);
  assert.equal(R.analyserObjectif('Mettre en œuvre une démarche', B).niveau, 3);
  assert.equal(R.analyserObjectif('Connaître les règles', B).vague, true);
  assert.equal(R.analyserObjectif('Savoir citer les dates', B).niveau, 1);
  assert.equal(R.analyserObjectif('Bricoler', B).inconnu, true);
  const cv = R.couvertureBloom(['Citer', 'Expliquer x', 'Calculer y', 'Maîtriser z'], B);
  assert.deepEqual(simple(cv), { parNiveau: [1, 1, 1, 0, 0, 0], vagues: 1 });
  // Banque : six niveaux, verbes uniques.
  const tous = B.bloom.flatMap((n) => n.verbes);
  assert.equal(B.bloom.length, 6);
  assert.equal(new Set(tous).size, tous.length);
});

test('modèles : parts des heures disponibles avec réserve, une séquence par période', () => {
  const e = etat();
  const c = R.contexte(e.annees[0], e.reglages);
  const p = e.progressions[0];
  const dispo = R.somme(R.creneaux(p, c));
  for (const m of B.modeles.filter((x) => !x.periodes)) {
    assert.equal(m.sequences.reduce((s, [, x]) => s + x, 0), 100, m.code);
    const l = R.sequencesModele(m, p, c, 10);
    const tot = R.somme(l, (q) => q.heures);
    assert.ok(Math.abs(tot - dispo * 0.9) <= l.length * 0.25 + 0.01, `${m.code} ${tot} ${dispo}`);
    assert.ok(l.every((q) => q.heures * 2 === Math.round(q.heures * 2)));
  }
  const parPeriode = R.sequencesModele(B.modeles.find((x) => x.periodes), p, c, 0);
  assert.equal(parPeriode.length, 3);
  assert.equal(R.somme(parPeriode, (q) => q.heures), dispo);
});

test('duplication vers une autre année : structure copiée, fenêtres décalées, aucune séance', () => {
  const e = etat();
  e.sequences.push(seq('s1', 1, 6, { objectifs: ['Citer'], fenetre: { debut: '2026-10-01', fin: '2026-10-10' }, terminee: '2026-10-05' }));
  e.seances.push(seance('x1', '2026-09-07', 'faite', { sequenceId: 's1' }));
  const a2 = R.normaliserAnnee({ id: 'a2', nom: '2027-2028', debut: '2027-09-01', fin: '2028-06-30' });
  e.annees.push(a2);
  const e2 = R.reprendreAnnee(e, 'a1', a2);
  const p2 = e2.progressions.find((p) => p.anneeId === 'a2');
  assert.ok(p2 && p2.id !== 'p1');
  assert.equal(p2.creneaux.length, 2);
  const s2 = e2.sequences.find((s) => s.progressionId === p2.id);
  assert.deepEqual(simple(s2.objectifs), ['Citer']);
  assert.equal(s2.terminee, null);
  assert.deepEqual(simple(s2.fenetre), { debut: '2027-10-01', fin: '2027-10-10' });
  assert.equal(e2.seances.filter((s) => s.progressionId === p2.id).length, 0);
  assert.equal(e2.seances.length, 1);
});

test('déplacer une séquence, supprimer une classe ou une année', () => {
  const e = etat();
  e.sequences.push(seq('s1', 1, 2), seq('s2', 2, 2), seq('s3', 3, 2));
  const e2 = R.deplacerSequence(e, 's3', -1);
  assert.deepEqual(simple(R.sequencesDe(e2, 'p1').map((s) => s.id)), ['s1', 's3', 's2']);
  assert.equal(R.deplacerSequence(e, 's1', -1), e);
  e.seances.push(seance('x1', '2026-09-07'));
  const e3 = R.supprimerProgression(e, 'p1');
  assert.equal(e3.sequences.length + e3.seances.length + e3.progressions.length, 0);
  const e4 = R.supprimerAnnee(e, 'a1');
  assert.equal(e4.annees.length, 0);
  assert.equal(e4.anneeId, null);
  assert.equal(e4.progressions.length, 0);
});

test('exports CSV : point-virgule, BOM, guillemets, nombres à la française', () => {
  const e = etat();
  e.sequences.push(seq('s1', 1, 1.5, { titre: 'Fractions ; calcul' }));
  e.seances.push(seance('x1', '2026-09-07', 'faite', { sequenceId: 's1', contenu: 'Ligne "un"\nligne deux', duree: 1.5 }));
  const csv = R.csvSeances(e, 'a1');
  assert.ok(csv.startsWith('﻿Date;Classe ou groupe'));
  assert.ok(csv.includes('07/09/2026;4e B;;"Fractions ; calcul";1,5;Faite;;"Ligne ""un""\nligne deux";'));
  const b = R.bilan(e, e.progressions[0], R.contexte(e.annees[0], e.reglages), '2026-09-08');
  const cs = R.csvSequences(e, b);
  assert.ok(cs.split('\r\n')[1].startsWith('1;"Fractions ; calcul";;;1,5;1,5;En cours;'));
});

test('cahier de textes : séances consignées entre deux dates, prévues exclues', () => {
  const e = etat();
  e.seances.push(seance('x1', '2026-09-07'), seance('x2', '2026-09-10', 'annulee'), seance('x3', '2026-09-14', 'prevue'), seance('x4', '2026-10-01'));
  assert.deepEqual(simple(R.cahier(e, 'p1', '2026-09-01', '2026-09-30').map((s) => s.id)), ['x1', 'x2']);
});

test('normalisation tolérante : orphelins retirés, valeurs bornées, réglages par défaut', () => {
  const n = R.normaliser({
    annees: [{ id: 'a1', debut: '2026-09-01', fin: 'n\'importe quoi', fermetures: [{ debut: 'x' }, { nom: 'V', debut: '2026-10-20' }] }],
    anneeId: 'zz',
    progressions: [{ id: 'p1', anneeId: 'a1', creneaux: [{ jour: 9, duree: 0.7, semaine: 'C' }] }, { id: 'p2', anneeId: 'inconnue' }],
    sequences: [{ id: 's1', progressionId: 'p1', heures: -3, objectifs: 'Citer\n\nNommer', fenetre: { debut: '2026-12-01', fin: '2026-11-01' } }, { id: 's2', progressionId: 'p2' }],
    seances: [{ id: 'x1', progressionId: 'p1', sequenceId: 's2', statut: 'bizarre', duree: 99 }],
    reglages: { reserve: 90, feriesIgnores: ['nov11', 'inventé'] },
  }, B);
  assert.equal(n.anneeId, 'a1');
  assert.equal(n.annees[0].fin, '2027-06-30');
  assert.equal(n.annees[0].fermetures.length, 1);
  assert.equal(n.annees[0].fermetures[0].fin, '2026-10-20');
  assert.equal(n.progressions.length, 1);
  assert.deepEqual(simple(n.progressions[0].creneaux.map((c) => [c.jour, c.duree, c.semaine])), [[1, 0.5, 'toutes']]);
  assert.equal(n.sequences.length, 1);
  assert.equal(n.sequences[0].heures, 6);
  assert.deepEqual(simple(n.sequences[0].objectifs), ['Citer', 'Nommer']);
  assert.equal(n.sequences[0].fenetre, null);
  assert.equal(n.seances[0].sequenceId, null);
  assert.equal(n.seances[0].statut, 'faite');
  assert.equal(n.seances[0].duree, 1);
  assert.equal(n.reglages.reserve, 50);
  assert.deepEqual(simple(n.reglages.feriesIgnores), ['nov11']);
  assert.deepEqual(simple(R.normaliser(null, B)), simple(R.etatVide(B)));
});

test('heures affichées', () => {
  assert.equal(R.heures(3.5), '3 h 30');
  assert.equal(R.heures(12), '12 h');
  assert.equal(R.heures(-1.5), '−1 h 30');
});
