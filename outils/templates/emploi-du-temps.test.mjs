// Tests des règles métier de l'emploi du temps d'établissement (templates/emploi-du-temps/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/emploi-du-temps/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.EDT;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Année 2026-2027, lundi → vendredi, 4 créneaux. Deux groupes, deux formateurs, deux salles, trois modules.
function exemple(extra = {}) {
  const e = R.normaliser({
    reglages: { debut: '2026-09-07', fin: '2027-07-02', jours: [1, 2, 3, 4, 5], alternance: true,
      creneaux: [{ id: 'c1', debut: '08:30', fin: '10:00' }, { id: 'c2', debut: '10:15', fin: '11:45' }, { id: 'c3', debut: '13:00', fin: '14:30' }, { id: 'c4', debut: '14:45', fin: '16:15' }] },
    groupes: [{ id: 'g1', nom: 'Compta 1', effectif: 18 }, { id: 'g2', nom: 'Web A', effectif: 12 }],
    formateurs: [{ id: 'f1', nom: 'Claire M.', quota: 6, indispos: ['3-c3'] }, { id: 'f2', nom: 'Hugo L.' }],
    salles: [{ id: 's1', nom: 'Salle 101', capacite: 24, equipements: ['Vidéoprojecteur'] }, { id: 's2', nom: 'Labo', capacite: 14, equipements: ['Postes informatiques'] }],
    modules: [
      { id: 'm1', nom: 'Comptabilité générale', groupe: 'g1', formateur: 'f1', volume: 3 },
      { id: 'm2', nom: 'Tableur', groupe: 'g1', formateur: 'f2', volume: 30, equipement: 'Postes informatiques' },
      { id: 'm3', nom: 'HTML', groupe: 'g2', formateur: 'f2', volume: 0 },
    ],
    fermetures: [{ id: 'x1', nom: 'Fin d\'année', debut: '2026-12-21', fin: '2027-01-01' }],
    ...extra,
  }, B);
  return e;
}
const seance = (id, date, debut, fin, module, formateur, salle, x = {}) => R.normaliserSeance({ id, date, debut, fin, module, formateur, salle, ...x });
const types = (c, id) => simple((c.parSeance.get(id) || []).map((x) => x.type).sort());

test('dates : lundi, semaine ISO, jour de la semaine, durées', () => {
  assert.equal(R.jourSem('2026-11-14'), 6);
  assert.equal(R.jourSem('2026-11-15'), 7);
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
  assert.equal(R.numeroSemaine('2026-11-09'), 46);
  assert.equal(R.numeroSemaine('2027-01-01'), 53); // 2026 a 53 semaines ISO
  assert.equal(R.numeroSemaine('2027-01-04'), 1);
  assert.equal(R.dureeTexte(90), '1 h 30');
  assert.equal(R.heuresTexte(90), '1,5 h');
  assert.ok(!R.estHeure('24:00'));
  assert.ok(!R.estDate('2027-02-29'));
});

test('jours fériés : Pâques et fêtes mobiles, Alsace-Moselle en option', () => {
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  const f = R.feries(2027);
  assert.equal(f.length, 11);
  assert.deepEqual(simple(f.find((x) => x.nom === 'Ascension')), { date: '2027-05-06', nom: 'Ascension' });
  assert.equal(R.nomFerie('2027-05-17'), 'Lundi de Pentecôte');
  assert.equal(R.nomFerie('2027-03-26'), '');
  assert.equal(R.nomFerie('2027-03-26', true), 'Vendredi saint');
  assert.equal(R.feries(2027, true).length, 13);
  assert.equal(R.feriesEntre('2026-09-07', '2027-07-02').length, 9); // 1er et 11 nov., Noël, 1er janv., lundi de Pâques, 1er et 8 mai, Ascension, Pentecôte
});

test('calendrier : jours fermés et alternance A/B qui saute les semaines fermées', () => {
  const e = exemple();
  assert.deepEqual(simple(R.fermeture(e, '2026-11-11')), { type: 'ferie', nom: 'Armistice 1918' });
  assert.deepEqual(simple(R.fermeture(e, '2026-12-23')), { type: 'fermeture', nom: 'Fin d\'année' });
  assert.equal(R.fermeture(e, '2026-11-14').type, 'jour');
  assert.equal(R.fermeture(e, '2026-11-12'), null);
  const sem = R.semainesAnnee(e);
  assert.equal(sem[0].lundi, '2026-09-07');
  assert.equal(sem[0].type, 'A');
  assert.equal(sem[1].type, 'B');
  const noel = sem.find((x) => x.lundi === '2026-12-21');
  const apres = sem.find((x) => x.lundi === '2027-01-04');
  const avant = sem.find((x) => x.lundi === '2026-12-14');
  assert.ok(noel.fermee && sem.find((x) => x.lundi === '2026-12-28').fermee);
  assert.equal(noel.type, '');
  assert.notEqual(apres.type, avant.type); // l'alternance reprend où elle s'était arrêtée
  assert.equal(R.typeSemaine(e, '2026-09-10'), 'A');
  e.reglages.alternance = false;
  assert.equal(R.typeSemaine(e, '2026-09-10'), '');
  assert.deepEqual(simple(R.anneeProposee('2026-11-14')), { debut: '2026-09-07', fin: '2027-07-03' });
  assert.deepEqual(simple(R.anneeProposee('2026-08-20')), { debut: '2026-09-07', fin: '2027-07-03' });
});

test('conflits : formateur, salle et groupe en double', () => {
  const e = exemple();
  e.seances.push(
    seance('a', '2026-11-12', '08:30', '10:00', 'm1', 'f1', 's1'),
    seance('b', '2026-11-12', '09:00', '10:30', 'm3', 'f1', 's1'), // même formateur, même salle
    seance('c', '2026-11-12', '09:30', '11:00', 'm2', 'f2', 's2'), // même groupe que a
    seance('d', '2026-11-12', '10:00', '11:00', 'm1', 'f1', 's1'), // commence quand a finit : pas avec a
  );
  const c = R.conflits(e);
  assert.ok(types(c, 'a').includes('formateur') && types(c, 'a').includes('salle') && types(c, 'a').includes('groupe'));
  assert.ok(!c.liste.some((x) => x.seances.includes('a') && x.seances.includes('d')));
  assert.ok(c.liste.some((x) => x.type === 'formateur' && x.seances.includes('b') && x.seances.includes('d')));
  assert.equal(c.liste.filter((x) => x.type === 'salle').length, 2); // a-b, b-d
  // Une séance annulée ne compte plus.
  e.seances.find((s) => s.id === 'b').annulee = true;
  const c2 = R.conflits(e);
  assert.ok(!c2.liste.some((x) => x.seances.includes('b')));
  assert.ok(!types(c2, 'a').includes('formateur'));
});

test('conflits : capacité, équipement, indisponibilité, absence, jour fermé, incomplet', () => {
  const e = exemple();
  e.formateurs[1] = R.normaliserFormateur({ ...e.formateurs[1], absences: [{ debut: '2026-11-16', fin: '2026-11-17' }] });
  e.seances.push(
    seance('cap', '2026-11-12', '08:30', '10:00', 'm2', 'f2', 's2', {}), // 18 personnes, 14 places
    seance('eq', '2026-11-13', '08:30', '10:00', 'm2', 'f2', 's1'), // tableur sans postes
    seance('ind', '2026-11-18', '13:30', '14:00', 'm1', 'f1', 's1'), // mercredi c3
    seance('abs', '2026-11-17', '08:30', '10:00', 'm3', 'f2', 's2'),
    seance('fer', '2026-11-11', '08:30', '10:00', 'm3', 'f2', 's2'),
    seance('inc', '2026-11-19', '08:30', '10:00', 'm3', '', ''),
  );
  const c = R.conflits(e);
  assert.deepEqual(types(c, 'cap'), ['capacite']);
  assert.match(c.parSeance.get('cap')[0].texte, /14 places pour 18/);
  assert.deepEqual(types(c, 'eq'), ['equipement']);
  assert.deepEqual(types(c, 'ind'), ['indispo']);
  assert.match(c.parSeance.get('ind')[0].texte, /mercredi 13:00-14:30/);
  assert.deepEqual(types(c, 'abs'), ['indispo']);
  assert.deepEqual(types(c, 'fer'), ['ferme']);
  assert.deepEqual(types(c, 'inc'), ['incomplet']);
  assert.equal(R.graviteMax(c.parSeance.get('fer')), 'rouge');
  assert.equal(R.graviteMax(c.parSeance.get('inc')), 'info');
  assert.equal(R.graviteMax([]), '');
});

test('volume prévu et quota : seules les séances au-delà sont signalées', () => {
  const e = exemple();
  // m1 : 3 h prévues ; f1 : quota 6 h.
  for (let i = 0; i < 5; i++) e.seances.push(seance(`v${i}`, R.ajout('2026-11-23', i), '08:30', '10:00', 'm1', 'f1', 's1'));
  const c = R.conflits(e);
  assert.deepEqual(['v0', 'v1'].map((id) => types(c, id).includes('volume')), [false, false]);
  assert.deepEqual(['v2', 'v3', 'v4'].map((id) => types(c, id).includes('volume')), [true, true, true]);
  assert.deepEqual(['v3', 'v4'].map((id) => types(c, id).includes('quota')), [false, true]);
  assert.match(c.parSeance.get('v4').find((x) => x.type === 'quota').texte, /7,5 h placées pour un quota de 6 h/);
  // Volume 0 : pas de contrôle.
  e.seances.push(seance('h', '2026-11-30', '08:30', '16:00', 'm3', 'f2', 's2'));
  assert.ok(!types(R.conflits(e), 'h').includes('volume'));
});

test('heures : prévu, placé, réalisé, reste, par module, formateur et groupe', () => {
  const e = exemple();
  e.seances.push(
    seance('p1', '2026-11-12', '08:30', '10:00', 'm2', 'f2', 's2'),
    seance('p2', '2026-11-13', '13:00', '14:30', 'm2', 'f2', 's2'),
    seance('p3', '2026-11-20', '08:30', '10:00', 'm2', 'f2', 's2'),
    seance('x', '2026-11-12', '10:15', '11:45', 'm2', 'f2', 's2', { annulee: true }),
  );
  const h = R.heures(e, { date: '2026-11-13', heure: '14:00' });
  const m2 = h.parModule.find((m) => m.id === 'm2');
  assert.deepEqual({ prevu: m2.prevu, place: m2.place, realise: m2.realise, reste: m2.reste, seances: m2.seances }, { prevu: 1800, place: 270, realise: 90, reste: 1530, seances: 3 });
  const h2 = R.heures(e, { date: '2026-11-13', heure: '14:30' });
  assert.equal(h2.parModule.find((m) => m.id === 'm2').realise, 180);
  assert.equal(h2.parFormateur.find((f) => f.id === 'f2').place, 270);
  assert.deepEqual(simple(h2.parGroupe.find((g) => g.id === 'g1')), { id: 'g1', prevu: 1980, place: 270, realise: 180 });
  assert.equal(R.totalMinutes(e.seances), 270);
});

test('duplication : semaines cibles (A/B, fermetures) et recopie qui saute les jours fermés', () => {
  const e = exemple();
  // Semaine du 9 novembre (le 11 est férié) : une séance lundi, une mercredi (fériée, donc non recopiée si
  // la cible est fériée), une du groupe g2.
  e.seances.push(
    seance('l', '2026-11-16', '08:30', '10:00', 'm2', 'f2', 's2'),
    seance('m', '2026-11-18', '10:15', '11:45', 'm1', 'f1', 's1'),
    seance('w', '2026-11-16', '13:00', '14:30', 'm3', 'f2', 's2'),
  );
  const toutes = R.ciblesDuplication(e, '2026-11-16', { jusqua: '2027-01-10' });
  assert.deepEqual(simple(toutes), ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2027-01-04']); // Noël sauté
  const memes = R.ciblesDuplication(e, '2026-11-16', { jusqua: '2027-01-10', memeType: true });
  assert.ok(memes.every((l) => R.typeSemaine(e, l) === R.typeSemaine(e, '2026-11-16')));
  assert.equal(memes.length, 2);
  // Seulement le groupe g1, vers deux semaines dont une où le mercredi est férié… (11/11 est passé :
  // on prend la semaine du 9 comme cible en recopiant à rebours).
  const r = R.dupliquerSemaine(e, '2026-11-16', ['2026-11-09', '2026-11-23'], { portee: { type: 'groupe', id: 'g1' } });
  assert.equal(r.modele, 2);
  assert.equal(r.ajoutees, 3);
  assert.equal(r.sautees, 1); // mercredi 11 novembre
  assert.equal(r.etat.seances.length, 6);
  assert.ok(r.etat.seances.some((s) => s.date === '2026-11-25' && s.module === 'm1'));
  assert.ok(!r.etat.seances.some((s) => s.date === '2026-11-30'));
  assert.equal(e.seances.length, 3); // état d'origine intact
  // Remplacer : les séances de la portée dans la cible sont retirées avant la copie.
  const r2 = R.dupliquerSemaine(r.etat, '2026-11-16', ['2026-11-23'], { portee: { type: 'groupe', id: 'g1' }, remplacer: true });
  assert.equal(r2.retirees, 2);
  assert.equal(r2.etat.seances.filter((s) => s.date >= '2026-11-23' && s.date <= '2026-11-29').length, 2);
  // Les séances annulées ne sont pas recopiées.
  e.seances[0].annulee = true;
  assert.equal(R.dupliquerSemaine(e, '2026-11-16', ['2026-11-23']).ajoutees, 2);
});

test('ressources : impact et suppression (groupe, module, formateur, salle)', () => {
  const e = exemple();
  e.seances.push(seance('a', '2026-11-12', '08:30', '10:00', 'm1', 'f1', 's1'), seance('b', '2026-11-13', '08:30', '10:00', 'm3', 'f2', 's2'));
  assert.deepEqual(simple(R.impactSuppression(e, 'groupe', 'g1')), { modules: 2, seances: 1 });
  assert.deepEqual(simple(R.impactSuppression(e, 'salle', 's2')), { modules: 0, seances: 1 });
  const sg = R.supprimerRessource(e, 'groupe', 'g1');
  assert.deepEqual([sg.groupes.length, sg.modules.length, sg.seances.length], [1, 1, 1]);
  const sf = R.supprimerRessource(e, 'formateur', 'f1');
  assert.equal(sf.seances.find((s) => s.id === 'a').formateur, '');
  assert.equal(sf.modules.find((m) => m.id === 'm1').formateur, '');
  assert.ok(types(R.conflits(sf), 'a').includes('incomplet'));
  const ss = R.supprimerRessource(e, 'salle', 's1');
  assert.equal(ss.seances.find((s) => s.id === 'a').salle, '');
  const p = R.purgerAvant(e, '2026-11-13');
  assert.equal(p.retirees, 1);
  assert.equal(p.etat.seances[0].id, 'b');
});

test('validation des séances et créneaux couverts', () => {
  const e = exemple();
  assert.equal(R.validerSeance(e, { date: '2026-11-12', debut: '10:00', fin: '09:00', module: 'm1' }), 'L\'heure de fin doit être après l\'heure de début.');
  assert.match(R.validerSeance(e, { date: '2026-11-12', debut: '08:00', fin: '09:00', module: 'zz' }), /module/);
  assert.equal(R.validerSeance(e, { date: '2026-11-12', debut: '08:00', fin: '09:00', module: 'm1' }), '');
  assert.deepEqual(simple(R.creneauxCouverts({ debut: '08:30', fin: '11:45' }, e.reglages.creneaux)), [0, 1]);
  assert.deepEqual(simple(R.creneauxCouverts({ debut: '12:00', fin: '12:45' }, e.reglages.creneaux)), []);
});

test('export CSV : séparateur point-virgule, BOM, formules neutralisées, conflits et type de semaine', () => {
  const e = exemple();
  e.modules[0].nom = '=SOMME(A1)';
  e.seances.push(seance('a', '2026-11-12', '08:30', '10:00', 'm1', 'f1', 's1', { note: 'Salle; à confirmer' }), seance('b', '2026-11-12', '08:30', '10:00', 'm3', 'f1', 's2'));
  const csv = R.csvSeances(e, { debut: '2026-11-09', fin: '2026-11-15' });
  assert.ok(csv.startsWith('﻿Date;Jour;Semaine'));
  const lignes = csv.trim().split('\r\n');
  assert.equal(lignes.length, 3);
  assert.ok(lignes[1].includes("'=SOMME(A1)"));
  assert.ok(lignes[1].includes('"Salle; à confirmer"'));
  assert.ok(lignes[1].includes('Formateur en double'));
  assert.ok(lignes[1].includes(';1,5;'));
  assert.match(lignes[1], /;46;[AB];/);
  const csvG = R.csvSeances(e, { debut: '2026-11-09', fin: '2026-11-15', type: 'groupe', id: 'g2' });
  assert.equal(csvG.trim().split('\r\n').length, 2);
  const h = R.csvHeures(e, { date: '2026-11-20', heure: '12:00' });
  assert.ok(h.includes('Module;'));
  assert.ok(h.split('\r\n')[1].includes(';3;1,5;1,5;1,5;1'));
});

test('normalisation tolérante : valeurs absurdes, anciens états, champs vides omis', () => {
  const e = R.normaliser({ reglages: { jours: [0, 1, 8, '2', 2], creneaux: [{ debut: '14:00', fin: '13:00' }, { debut: '08:00', fin: '09:00' }] }, groupes: [{ effectif: -5 }], seances: [{ date: 'hier' }, { date: '2026-11-12', debut: '10:00', fin: '09:00', module: 'm' }] }, B);
  assert.deepEqual(simple(e.reglages.jours), [1, 2]);
  assert.equal(e.reglages.creneaux[0].debut, '08:00');
  assert.equal(e.reglages.creneaux[1].fin, '15:00');
  assert.equal(e.groupes[0].effectif, 0);
  assert.equal(e.seances.length, 1);
  assert.equal(e.seances[0].fin, '11:00');
  assert.ok(!('note' in e.seances[0]) && !('annulee' in e.seances[0]));
  assert.deepEqual(simple(R.normaliser(null, B).seances), []);
  assert.ok(e.reglages.equipements.includes('Vidéoprojecteur'));
  assert.equal(R.normaliserModule({ volume: '12,5' }).volume, 12.5);
});

test('taille : une année chargée tient sous la limite du serveur', () => {
  // 8 groupes × 20 séances par semaine × 36 semaines, identifiants longs.
  const e = exemple();
  for (let i = 0; i < 8 * 20 * 36; i++) e.seances.push(seance(R.nouvelId(), R.ajout('2026-09-07', i % 250), '08:30', '10:00', 'm2', 'f2', 's2'));
  assert.ok(R.taille(e) < 900000, `taille ${R.taille(e)}`);
});
