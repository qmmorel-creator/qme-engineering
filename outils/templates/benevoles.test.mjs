// Tests des règles métier de « Bénévoles et planning des créneaux » (templates/benevoles/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/benevoles/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.BNV;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const DEFAUTS = { reglages: BASE.reglages, couleurs: BASE.couleurs, message: BASE.message };
const J = '2026-06-13'; // samedi

// Petit événement : buvette et montage, trois bénévoles.
function etat() {
  const e = R.etatVide(DEFAUTS);
  e.association = 'Association Exemple';
  e.competences = [{ id: 'caisse', nom: 'Tenue de caisse' }, { id: 'brico', nom: 'Bricolage et montage' }];
  e.postes = [R.normaliserPoste({ id: 'buv', nom: 'Buvette' }), R.normaliserPoste({ id: 'cai', nom: 'Caisse', competence: 'caisse' }), R.normaliserPoste({ id: 'mon', nom: 'Montage', competence: 'brico', consigne: 'Gants fournis.' })];
  e.benevoles = [
    R.normaliserBenevole({ id: 'ana', prenom: 'Ana', nom: 'Exemple', competences: ['caisse'], preferes: ['cai'] }),
    R.normaliserBenevole({ id: 'bob', prenom: 'Bob', nom: 'Exemple', competences: ['brico'] }),
    R.normaliserBenevole({ id: 'cleo', prenom: 'Cléo', nom: 'Exemple', evites: ['buv'] }),
  ];
  e.evenements = [R.normaliserEvenement({ id: 'fete', nom: 'Fête de juin', lieu: 'Salle des fêtes', debut: J, fin: J, responsable: 'Dominique (06 00 00 00 00)' })];
  e.dispos = [
    R.normaliserDispo({ id: 'd1', benevole: 'ana', evenement: 'fete', statut: 'dispo' }),
    R.normaliserDispo({ id: 'd2', benevole: 'bob', evenement: 'fete', statut: 'partiel', plages: [{ date: J, debut: '08:00', fin: '13:00' }] }),
    R.normaliserDispo({ id: 'd3', benevole: 'cleo', evenement: 'fete', statut: 'absent' }),
  ];
  const c = (id, poste, debut, fin, besoin = 1, date = J) => R.normaliserCreneau({ id, evenement: 'fete', poste, date, debut, fin, besoin });
  e.creneaux = [c('m1', 'mon', '08:00', '10:00', 2), c('b1', 'buv', '10:00', '13:00', 2), c('b2', 'buv', '13:00', '16:00', 2), c('k1', 'cai', '10:00', '14:00'), c('nuit', 'buv', '22:00', '01:00')];
  return e;
}
const aff = (benevole, creneau, id = `${benevole}-${creneau}`) => R.normaliserAffectation({ id, benevole, creneau });

test('heures : durée, passage de minuit, chevauchement, texte', () => {
  assert.equal(R.duree({ date: J, debut: '10:00', fin: '13:00' }), 180);
  assert.equal(R.duree({ date: J, debut: '22:00', fin: '01:00' }), 180);
  assert.equal(R.duree({ date: J, debut: '23:30', fin: '02:30' }), 180);
  assert.ok(R.chevauche({ date: J, debut: '22:00', fin: '01:00' }, { date: '2026-06-14', debut: '00:30', fin: '02:00' }));
  assert.ok(!R.chevauche({ date: J, debut: '10:00', fin: '13:00' }, { date: J, debut: '13:00', fin: '16:00' }));
  assert.equal(R.heuresTexte(90), '1 h 30');
  assert.equal(R.heuresTexte(120), '2 h');
  assert.equal(R.heuresTexte(45), '45 min');
  assert.equal(R.dateTexte('2026-06-01'), 'lundi 1er juin');
  assert.equal(R.heureTexte('08:30'), '08 h 30');
  assert.equal(R.heureTexte('14:00'), '14 h');
});

test('disponibilité : disponible, partiel sur ses plages, indisponible, sans réponse', () => {
  const e = etat();
  const c = (id) => R.trouver(e, 'creneaux', id);
  assert.equal(R.dispoPour(e, 'ana', c('b2')), 'oui');
  assert.equal(R.dispoPour(e, 'bob', c('m1')), 'oui');
  assert.equal(R.dispoPour(e, 'bob', c('b1')), 'oui'); // 10 h – 13 h dans 8 h – 13 h
  assert.equal(R.dispoPour(e, 'bob', c('b2')), 'hors');
  assert.equal(R.dispoPour(e, 'cleo', c('b1')), 'non');
  e.dispos = e.dispos.filter((d) => d.benevole !== 'cleo');
  assert.equal(R.dispoPour(e, 'cleo', c('b1')), 'inconnu');
});

test('couverture et trous de l\'événement', () => {
  const e = etat();
  e.affectations = [aff('bob', 'm1'), aff('ana', 'b1'), aff('ana', 'k1')];
  const v = R.couverture(e, R.trouver(e, 'creneaux', 'm1'));
  assert.equal(v.manque, 1);
  const b = R.bilanEvenement(e, 'fete');
  assert.equal(b.besoin, 8);
  assert.equal(b.pourvu, 3);
  assert.equal(b.trous.length, 4);
  assert.equal(b.benevoles, 2);
  assert.equal(b.minutes, 120 + 180 + 240);
});

test('conflits : double affectation, indisponible, hors plages, compétence', () => {
  const e = etat();
  e.affectations = [aff('ana', 'b1'), aff('ana', 'k1'), aff('cleo', 'b2'), aff('bob', 'b2'), aff('cleo', 'm1')];
  const l = R.conflits(e, 'fete');
  const types = (bid) => simple(l.filter((x) => x.benevole === bid).map((x) => x.type).sort());
  assert.deepEqual(types('ana'), ['double']);
  assert.deepEqual(types('bob'), ['indispo']);
  assert.deepEqual(types('cleo'), ['competence', 'indispo', 'indispo']);
  assert.equal(l[0].type, 'double'); // le plus grave en premier
  const m = R.creneauxEnConflit(l);
  assert.deepEqual(simple(m.get('b1|ana')), ['double']);
});

test('conflits : enchaînement sans pause, journée trop longue, maximum du bénévole', () => {
  const e = etat();
  e.creneaux.push(R.normaliserCreneau({ id: 'b3', evenement: 'fete', poste: 'buv', date: J, debut: '16:15', fin: '19:00', besoin: 1 }));
  e.affectations = [aff('ana', 'b1'), aff('ana', 'b2'), aff('ana', 'b3')];
  let l = R.conflitsBenevole(e, 'ana', 'fete');
  const repos = l.find((x) => x.type === 'repos');
  assert.ok(repos);
  assert.deepEqual(simple(repos.creneaux), ['b1', 'b2', 'b3']); // 15 min de pause < 30 min : un seul bloc de 9 h
  assert.equal(repos.minutes, 540);
  assert.ok(l.some((x) => x.type === 'jour' && x.minutes === 525));
  // Pause minimale de 10 min : les 15 min coupent la chaîne, seul le bloc de 6 h (b1 + b2) reste signalé.
  e.reglages.reposMin = 10;
  l = R.conflitsBenevole(e, 'ana', 'fete');
  assert.deepEqual(simple(l.find((x) => x.type === 'repos').creneaux), ['b1', 'b2']);
  e.reglages.reposMin = 30; e.reglages.maxContinu = 0; e.reglages.maxJour = 0;
  assert.equal(R.conflitsBenevole(e, 'ana', 'fete').length, 0);
  e.dispos[0].maxHeures = 6;
  assert.equal(R.conflitsBenevole(e, 'ana', 'fete')[0].type, 'max');
});

test('suggestions : bloquants, réserves, préférence puis équité de charge', () => {
  const e = etat();
  let l = R.candidats(e, 'k1');
  assert.equal(l[0].benevole, 'ana'); // préfère la caisse, a la compétence
  assert.ok(l[0].ok);
  const bob = l.find((x) => x.benevole === 'bob');
  assert.deepEqual(simple(bob.bloquant), ['pas sur ses plages']);
  assert.ok(l.find((x) => x.benevole === 'cleo').bloquant.includes('indisponible'));
  // Équité : Ana est déjà sur b1 ; pour m1 (montage), Bob a la compétence et 0 h.
  e.affectations = [aff('ana', 'b1')];
  l = R.candidats(e, 'm1');
  assert.equal(l[0].benevole, 'bob');
  assert.ok(l.find((x) => x.benevole === 'ana').reserves.includes('sans la compétence demandée'));
  // Déjà sur un créneau à la même heure : bloquant.
  assert.ok(R.candidats(e, 'k1').find((x) => x.benevole === 'ana').bloquant.includes('déjà sur un créneau à la même heure'));
  // Préfère éviter : réserve.
  e.dispos[2].statut = 'dispo';
  assert.ok(R.candidats(e, 'b2').find((x) => x.benevole === 'cleo').reserves.includes('préfère éviter ce poste'));
});

test('remplissage automatique : pourvoit sans conflit, le plus contraint d\'abord, ne modifie pas l\'état', () => {
  const e = etat();
  e.dispos[2].statut = 'dispo'; // Cléo vient
  e.benevoles[2].competences = ['caisse'];
  const avant = simple(e);
  const { ajouts, reste } = R.remplir(e, 'fete', { ids: (() => { let n = 0; return () => `x${n++}`; })() });
  assert.deepEqual(simple(e), avant);
  e.affectations.push(...ajouts);
  assert.equal(R.conflits(e, 'fete').length, 0);
  assert.deepEqual(simple(ajouts.map((a) => `${a.benevole}>${a.creneau}`)), ['bob>m1', 'ana>b1', 'cleo>k1', 'ana>nuit']);
  assert.equal(reste, R.bilanEvenement(e, 'fete').manque);
  // Le montage (compétence brico) revient à Bob, le seul qui l'a.
  assert.ok(ajouts.some((a) => a.creneau === 'm1' && a.benevole === 'bob'));
  // Sans réponse : exclu par défaut, retenu si le réglage l'autorise.
  const e2 = etat();
  e2.dispos = [];
  assert.equal(R.remplir(e2, 'fete').ajouts.length, 0);
  e2.reglages.sansReponse = true;
  assert.ok(R.remplir(e2, 'fete').ajouts.length > 0);
});

test('message à copier : créneaux, consignes du poste, total, contact', () => {
  const e = etat();
  e.evenements[0].consignes = 'Rendez-vous au local 15 minutes avant.';
  e.affectations = [aff('bob', 'm1'), aff('bob', 'b1')];
  const m = R.message(e, 'bob', 'fete', BASE.message);
  assert.match(m, /^Bonjour Bob,/);
  assert.match(m, /samedi 13 juin, 08 h à 10 h : Montage \(Gants fournis\.\)/);
  assert.match(m, /Soit 5 h au total\./);
  assert.match(m, /Rendez-vous au local/);
  assert.match(m, /préviens Dominique/);
  assert.match(m, /Association Exemple$/);
  assert.ok(!/\{\w+\}/.test(m));
});

test('statistiques : heures par bénévole et par poste, part du quart le plus investi', () => {
  const e = etat();
  e.affectations = [aff('ana', 'b1'), aff('ana', 'b2'), aff('bob', 'm1')];
  const s = R.statistiques(e, { annee: 2026 });
  assert.equal(s.total, 480);
  assert.equal(s.benevoles[0].benevole, 'ana');
  assert.equal(s.benevoles[0].minutes, 360);
  assert.equal(s.postes[0].poste, 'buv');
  assert.equal(s.actifs, 2);
  assert.equal(s.partQuart, 0.75);
  assert.equal(R.statistiques(e, { annee: 2025 }).total, 0);
});

test('modèles de la base : postes connus, créneaux valides, duplication d\'un événement', () => {
  const noms = new Set(BASE.postes.map((p) => p[0]));
  for (const m of BASE.modeles) for (const [nom, j, debut, fin, besoin] of m.creneaux) {
    assert.ok(noms.has(nom), `${m.id} : poste inconnu ${nom}`);
    assert.ok(R.estHeure(debut) && R.estHeure(fin) && besoin > 0 && j >= -1 && j < m.jours, `${m.id} : ${nom}`);
  }
  assert.ok(BASE.postes.every((p) => !p[2] || BASE.competences.includes(p[2])));
  let n = 0;
  const ids = () => `n${n++}`;
  const ev = R.normaliserEvenement({ id: 'e', nom: 'Festival', debut: '2026-07-04', fin: '2026-07-05' });
  const fest = BASE.modeles.find((m) => m.id === 'festival');
  const posteIds = Object.fromEntries(BASE.postes.map((p, i) => [p[0], `p${i}`]));
  const cr = R.creneauxDepuisModele(fest, ev, posteIds, ids);
  assert.equal(cr.length, fest.creneaux.length);
  assert.equal(cr[0].date, '2026-07-03'); // montage la veille
  const e = etat();
  const d = R.dupliquerEvenement(e, 'fete', '2027-06-12', ids);
  assert.equal(d.evenement.fin, '2027-06-12');
  assert.equal(d.creneaux.length, 5);
  assert.equal(d.creneaux.find((c) => c.debut === '22:00').date, '2027-06-12');
});

test('fusion : deux responsables, affectations réunies, conflit visible, doublon retiré', () => {
  const base = etat();
  const ici = simple(base); ici.affectations.push(aff('ana', 'b1', 'x1'));
  const autre = simple(base); autre.affectations.push(aff('ana', 'k1', 'y1'), aff('ana', 'b1', 'y2')); autre.benevoles[1].telephone = '06 00 00 00 01';
  const f = R.normaliser(R.fusionner(base, ici, autre), DEFAUTS);
  assert.equal(f.affectations.length, 2); // x1 et y2 sont la même affectation : gardée une fois
  assert.equal(f.benevoles[1].telephone, '06 00 00 00 01');
  assert.ok(R.conflits(f, 'fete').some((x) => x.type === 'double'));
  // Suppression ici d'un créneau : ses affectations disparaissent à la normalisation.
  const ici2 = simple(base); ici2.creneaux = ici2.creneaux.filter((c) => c.id !== 'k1');
  const f2 = R.normaliser(R.fusionner(base, ici2, autre), DEFAUTS);
  assert.ok(!f2.affectations.some((a) => a.creneau === 'k1'));
});

test('RGPD : export, effacement (heures gardées), suppression, inactifs', () => {
  const e = etat();
  e.benevoles[0].telephone = '06 00 00 00 02';
  e.benevoles[0].ajouteLe = '2023-01-10';
  e.affectations = [aff('ana', 'b1'), aff('bob', 'm1')];
  const d = R.donneesBenevole(e, 'ana', '2026-11-14');
  assert.equal(d.benevole.telephone, '06 00 00 00 02');
  assert.deepEqual(simple(d.benevole.competences), ['Tenue de caisse']);
  assert.equal(d.creneaux[0].poste, 'Buvette');
  const ef = R.effacerBenevole(e, 'ana', 1);
  const a = ef.benevoles[0];
  assert.equal(a.prenom, 'Bénévole');
  assert.equal(a.telephone, '');
  assert.ok(a.efface);
  assert.equal(R.heuresBenevole(ef, 'ana'), 180);
  assert.ok(!ef.dispos.some((x) => x.benevole === 'ana'));
  const sp = R.supprimerBenevole(e, 'ana');
  assert.equal(sp.benevoles.length, 2);
  assert.ok(!sp.affectations.some((x) => x.benevole === 'ana'));
  // Inactifs depuis 24 mois au 14/11/2028 : Ana (dernier créneau en juin 2026) l'est, Cléo sans date d'ajout aussi.
  const ina = R.inactifs(e, '2028-11-14', 24).map((b) => b.id);
  assert.deepEqual(simple(ina), ['ana', 'bob', 'cleo']);
  assert.deepEqual(simple(R.inactifs(e, '2027-11-14', 24).map((b) => b.id)), ['cleo']);
});

test('CSV : planning avec places à pourvoir, heures, annuaire', () => {
  const e = etat();
  e.benevoles[0].nom = 'Exemple; "dit Ana"';
  e.affectations = [aff('ana', 'b1')];
  const p = R.planningCsv(e, 'fete');
  assert.ok(p.startsWith('﻿Date;Début;Fin;Poste;Besoin;Prénom;Nom;Téléphone'));
  assert.match(p, /2026-06-13;10:00;13:00;Buvette;2;Ana;"Exemple; ""dit Ana""";/);
  assert.match(p, /2026-06-13;10:00;13:00;Buvette;2;À pourvoir;;/);
  assert.match(R.heuresCsv(e, { annee: 2026 }), /Ana;.*;1;1;3/);
  assert.equal(R.annuaireCsv(e).split('\r\n').length, 4);
});

test('normalisation : valeurs illisibles, doublons de réponses, anciennes versions', () => {
  const v = R.normaliser({ benevoles: [{ prenom: '  Zoé  ' }], creneaux: [{ debut: '25:00', besoin: -3 }], dispos: [{ benevole: 'a', evenement: 'e' }, { benevole: 'a', evenement: 'e', statut: 'absent' }], reglages: { reposMin: 'x', maxJour: 30 } }, DEFAUTS);
  assert.equal(v.benevoles[0].prenom, 'Zoé');
  assert.equal(v.creneaux[0].debut, '09:00');
  assert.equal(v.creneaux[0].besoin, 0);
  assert.equal(v.dispos.length, 1);
  assert.equal(v.reglages.reposMin, 30);
  assert.equal(v.reglages.maxJour, 24);
  assert.equal(v.message, BASE.message);
  assert.deepEqual(simple(R.normaliser(null, DEFAUTS).benevoles), []);
});

test('plannings imprimables : par jour et par poste, par personne', () => {
  const e = etat();
  e.affectations = [aff('ana', 'b1'), aff('bob', 'm1'), aff('ana', 'k1')];
  const p = R.parPoste(e, 'fete');
  assert.equal(p.length, 1);
  assert.equal(p[0].date, J);
  assert.deepEqual(simple(p[0].postes.map((x) => x.poste)), ['buv', 'cai', 'mon']);
  const m1 = p[0].postes.find((x) => x.poste === 'mon').creneaux[0];
  assert.equal(m1.creneau.id, 'm1'); // le créneau lui-même, pas son identifiant
  assert.equal(m1.manque, 1);
  const q = R.parPersonne(e, 'fete');
  assert.deepEqual(simple(q.map((x) => [x.benevole, x.minutes])), [['ana', 420], ['bob', 120]]);
});
