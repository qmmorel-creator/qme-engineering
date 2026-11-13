// Règles métier du template « Compte rendu et plan d'actions » (templates/compte-rendu/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../templates/compte-rendu/regles.js', import.meta.url), 'utf8');
const fenetre = {};
vm.runInNewContext(source, { window: fenetre });
const R = fenetre.REGLES;
// Les objets créés dans le contexte vm n'ont pas les prototypes de ce contexte : comparaison par JSON.
const js = (x) => JSON.parse(JSON.stringify(x));
const base = {};
vm.runInNewContext(readFileSync(new URL('../../templates/compte-rendu/donnees.js', import.meta.url), 'utf8'), { window: base });
const B = base.BASE;

// Jeudi 12 novembre 2026.
const JEUDI = '2026-11-12';
const ech = (texte, auj = JEUDI) => R.lireEcheance(texte, auj)?.date ?? null;
let n = 0;
const uid = () => `id${++n}`;

test('saisie rapide : responsable, quoi, échéance', () => {
  assert.deepEqual(js(R.analyserAction('Marie : envoyer le devis avant vendredi', JEUDI)),
    { responsables: ['Marie'], quoi: 'Envoyer le devis', echeance: '2026-11-13', expression: 'avant vendredi' });
  const p = R.analyserAction('Paul et Léa : préparer la démo pour demain.', JEUDI);
  assert.deepEqual(js(p.responsables), ['Paul', 'Léa']);
  assert.equal(p.quoi, 'Préparer la démo');
  assert.equal(p.echeance, '2026-11-13');
  assert.deepEqual(js(R.analyserAction('Inès, Hugo : stand', JEUDI).responsables), ['Inès', 'Hugo']);
  assert.deepEqual(js(R.analyserAction('@Hugo relancer le plombier J+7', JEUDI)), { responsables: ['Hugo'], quoi: 'Relancer le plombier', echeance: '2026-11-19', expression: 'J+7' });
  assert.equal(R.analyserAction('moi : appeler le client', JEUDI).responsables[0], 'moi');
  assert.equal(R.analyserAction('Marie de la Tour : signer', JEUDI).responsables[0], 'Marie de la Tour');
});

test('saisie rapide : un « : » dans une phrase n\'invente pas de responsable', () => {
  const p = R.analyserAction('Relancer le fournisseur : urgent', JEUDI);
  assert.deepEqual(js(p.responsables), []);
  assert.equal(p.quoi, 'Relancer le fournisseur : urgent');
  // Nom en minuscules accepté s'il est dans le carnet.
  assert.deepEqual(js(R.analyserAction('marie : y', JEUDI, [{ id: 1, nom: 'Marie Lefèvre' }]).responsables), ['marie']);
  // Une heure n'est pas un responsable.
  assert.deepEqual(js(R.analyserAction('14:00 point fournisseur', JEUDI).responsables), []);
});

test('échéances relatives en français', () => {
  assert.equal(ech('aujourd\'hui'), JEUDI);
  assert.equal(ech('ce soir'), JEUDI);
  assert.equal(ech('demain'), '2026-11-13');
  assert.equal(ech('après-demain'), '2026-11-14');
  assert.equal(ech('apres demain'), '2026-11-14');
  assert.equal(ech('J+7'), '2026-11-19');
  assert.equal(ech('j + 30'), '2026-12-12');
  assert.equal(ech('dans 3 jours'), '2026-11-15');
  assert.equal(ech('dans deux semaines'), '2026-11-26');
  assert.equal(ech('dans 1 mois'), '2026-12-12');
  assert.equal(ech('dans 1 mois', '2026-01-31'), '2026-02-28');
});

test('jours de la semaine : prochaine occurrence, jamais aujourd\'hui sauf « ce »', () => {
  assert.equal(ech('vendredi'), '2026-11-13');
  assert.equal(ech('lundi'), '2026-11-16');
  assert.equal(ech('jeudi'), '2026-11-19');
  assert.equal(ech('ce jeudi'), JEUDI);
  assert.equal(ech('jeudi prochain'), '2026-11-19');
  assert.equal(ech('mardi matin'), '2026-11-17');
  assert.equal(ech('Lundi'), '2026-11-16');
});

test('fins de semaine et de mois', () => {
  assert.equal(ech('fin de semaine'), '2026-11-13');
  assert.equal(ech('fin de semaine', '2026-11-14'), '2026-11-20'); // samedi : vendredi suivant
  assert.equal(ech('semaine prochaine'), '2026-11-20');
  assert.equal(ech('d\'ici la fin de la semaine prochaine'), '2026-11-20');
  assert.equal(ech('début de semaine prochaine'), '2026-11-16');
  assert.equal(ech('fin du mois'), '2026-11-30');
  assert.equal(ech('fin de mois', '2026-02-10'), '2026-02-28');
  assert.equal(ech('fin du mois', '2028-02-03'), '2028-02-29');
  assert.equal(ech('fin du mois prochain'), '2026-12-31');
  assert.equal(ech('début du mois prochain', '2026-12-15'), '2027-01-01');
  assert.equal(ech('fin d\'année'), '2026-12-31');
});

test('dates écrites : 20/11, 20 novembre, année suivante si déjà passée', () => {
  assert.equal(ech('le 20/11'), '2026-11-20');
  assert.equal(ech('05/01'), '2027-01-05');
  assert.equal(ech('20/11/2027'), '2027-11-20');
  assert.equal(ech('3.12.26'), '2026-12-03');
  assert.equal(ech('le 3 décembre'), '2026-12-03');
  assert.equal(ech('1er mars'), '2027-03-01');
  assert.equal(ech('2026-12-24'), '2026-12-24');
  assert.equal(ech('31/02'), null);
  assert.equal(ech('29/02', '2027-03-10'), '2028-02-29');
  assert.equal(ech('rien de daté'), null);
  assert.equal(ech('version 2.0'), null);
});

test('l\'échéance est retirée du texte, la dernière date l\'emporte', () => {
  const p = R.analyserAction('Marie : bilan avant vendredi 20/11', JEUDI);
  assert.equal(p.quoi, 'Bilan');
  assert.equal(p.echeance, '2026-11-20');
  assert.equal(R.analyserAction('Préparer le support du comité de lundi', JEUDI).quoi, 'Préparer le support du comité');
  assert.equal(R.analyserAction('Marie : envoyer le devis, vendredi', JEUDI).quoi, 'Envoyer le devis');
  assert.equal(R.analyserAction('Marie : réunion 14:00 lundi', JEUDI).quoi, 'Réunion 14:00');
  // « demandeur » ou « vendredis » ne sont pas des dates.
  assert.equal(R.analyserAction('Noter le demandeur', JEUDI).echeance, null);
});

test('trouver une personne : nom complet, prénom ou nom unique, sans accents ni casse', () => {
  const P = [{ id: 'a', nom: 'Marie Lefèvre' }, { id: 'b', nom: 'Marie Durand' }, { id: 'c', nom: 'Thomas Girard' }, { id: 'd', nom: 'Inès Moreau' }];
  assert.equal(R.trouverPersonne('marie lefevre', P).id, 'a');
  assert.equal(R.trouverPersonne('Thomas', P).id, 'c');
  assert.equal(R.trouverPersonne('ines', P).id, 'd');
  assert.equal(R.trouverPersonne('Girard', P).id, 'c');
  assert.equal(R.trouverPersonne('Marie', P), null); // ambigu
  assert.equal(R.trouverPersonne('Paul', P), null);
});

test('statuts, retards et tri', () => {
  const a = (statut, echeance) => ({ statut, echeance });
  assert.equal(R.etatAction(a('afaire', '2026-11-10'), JEUDI), 'retard');
  assert.equal(R.etatAction(a('encours', '2026-11-10'), JEUDI), 'retard');
  assert.equal(R.etatAction(a('fait', '2026-11-10'), JEUDI), 'fait');
  assert.equal(R.etatAction(a('abandonnee', '2026-11-10'), JEUDI), 'abandonnee');
  assert.equal(R.etatAction(a('afaire', JEUDI), JEUDI), 'aujourdhui');
  assert.equal(R.etatAction(a('afaire', '2026-11-19'), JEUDI), 'semaine');
  assert.equal(R.etatAction(a('afaire', '2026-11-20'), JEUDI), 'avenir');
  assert.equal(R.etatAction(a('afaire', null), JEUDI), 'sansdate');
  assert.equal(R.enRetard(a('afaire', '2026-11-11'), JEUDI), true);
  assert.equal(R.enRetard(a('fait', '2026-11-11'), JEUDI), false);
  assert.equal(R.enRetard(a('afaire', null), JEUDI), false);
  const tri = R.trierActions([
    { id: 'f', statut: 'fait', echeance: '2026-11-01', faitLe: '2026-11-02' },
    { id: 's', statut: 'afaire', echeance: null },
    { id: 'v', statut: 'afaire', echeance: '2026-12-01' },
    { id: 'r', statut: 'encours', echeance: '2026-11-01' },
    { id: 'j', statut: 'afaire', echeance: JEUDI },
  ], JEUDI).map((x) => x.id);
  assert.deepEqual(js(tri), ['r', 'j', 'v', 's', 'f']);
  const x = { statut: 'afaire', faitLe: null };
  R.changerStatut(x, 'fait', JEUDI);
  assert.equal(x.faitLe, JEUDI);
  R.changerStatut(x, R.STATUT_SUIVANT.fait, '2026-11-13');
  assert.equal(x.statut, 'afaire');
  assert.equal(x.faitLe, null);
});

// Série de trois réunions : les actions ouvertes repartent à chaque réunion jusqu'à leur clôture.
function serieDeTest() {
  const E = { personnes: [{ id: 'p1', nom: 'Marie' }, { id: 'p2', nom: 'Thomas' }], series: [{ id: 's1', nom: 'Point d\'équipe', modeleId: 'equipe', participants: ['p1'] }], reunions: [], actions: [] };
  const m = B.modeles.find((x) => x.id === 'equipe');
  const r1 = R.preparerReunion(E, { serieId: 's1', date: '2026-11-02', modele: m, lieu: 'Salle A' }, uid);
  E.reunions.push(r1);
  r1.participants.push('p2');
  const act = (r, id, statut, echeance = null) => { const a = { id, reunionId: r.id, responsableId: 'p1', texte: id, echeance, statut, creeLe: r.date, faitLe: null }; E.actions.push(a); return a; };
  return { E, m, r1, act };
}

test('nouvelle réunion d\'une série : actions ouvertes reprises en suivi', () => {
  const { E, m, r1, act } = serieDeTest();
  assert.deepEqual(js(r1.suivi), []);
  assert.equal(r1.points.length, m.points.length);
  assert.equal(r1.points[0].titre, m.points[0].titre);
  act(r1, 'ouverte', 'afaire', '2026-11-06');
  act(r1, 'encours', 'encours');
  act(r1, 'faite', 'fait');
  act(r1, 'abandon', 'abandonnee');
  const r2 = R.preparerReunion(E, { serieId: 's1', date: '2026-11-09', modele: m }, uid);
  assert.deepEqual(js(r2.suivi), ['ouverte', 'encours']); // échéance datée d'abord
  assert.deepEqual(js(r2.participants), ['p1', 'p2']); // participants de la précédente
  assert.equal(r2.lieu, 'Salle A');
  assert.equal(r2.titre, 'Point d\'équipe');
  E.reunions.push(r2);
  // L'action toujours ouverte repart encore à la réunion d'après ; celle qui a été faite, non.
  E.actions.find((a) => a.id === 'encours').statut = 'fait';
  act(r2, 'nouvelle', 'afaire');
  const r3 = R.preparerReunion(E, { serieId: 's1', date: '2026-11-16', modele: m }, uid);
  assert.deepEqual(js(r3.suivi).sort(), ['nouvelle', 'ouverte']);
});

test('le report ne mélange pas les séries et ignore les réunions postérieures', () => {
  const { E, m, r1, act } = serieDeTest();
  act(r1, 'a1', 'afaire');
  E.series.push({ id: 's2', nom: 'Copil', modeleId: 'copil', participants: [] });
  const autre = R.preparerReunion(E, { serieId: 's2', date: '2026-11-03' }, uid);
  E.reunions.push(autre);
  act(autre, 'a2', 'afaire');
  assert.deepEqual(js(R.actionsAReprendre(E, 's1', '2026-11-09').map((a) => a.id)), ['a1']);
  assert.deepEqual(js(R.actionsAReprendre(E, 's2', '2026-11-09').map((a) => a.id)), ['a2']);
  assert.deepEqual(js(R.actionsAReprendre(E, 's1', '2026-11-01')), []); // avant la première réunion
  assert.deepEqual(js(R.actionsAReprendre(E, null, '2026-11-09')), []); // réunion ponctuelle : pas de report
  assert.equal(R.reunionPrecedente(E, 's1', '2026-11-09').id, r1.id);
  assert.equal(R.reunionPrecedente(E, 's1', '2026-11-01'), null);
  // Sans modèle : ordre du jour de la réunion précédente, notes vides.
  r1.points[0].notes = 'notes';
  const r2 = R.preparerReunion(E, { serieId: 's1', date: '2026-11-09' }, uid);
  assert.equal(r2.points[0].titre, r1.points[0].titre);
  assert.equal(r2.points[0].notes, '');
  assert.notEqual(r2.points[0].id, r1.points[0].id);
  // Ponctuelle sans modèle : un point « Points divers ».
  const p = R.preparerReunion(E, { date: '2026-11-09', titre: 'Atelier' }, uid);
  assert.equal(p.serieId, null);
  assert.equal(p.titre, 'Atelier');
  assert.deepEqual(js(p.points.map((x) => x.titre)), ['Points divers']);
});

test('compte rendu en texte pour un e-mail', () => {
  const { E, m, r1, act } = serieDeTest();
  E.personnes[0].role = 'Achats';
  r1.points[0].notes = 'Marie : salon confirmé.\nThomas : export à corriger.';
  r1.decisions.push({ id: 'd', texte: 'Budget validé.' });
  act(r1, 'Envoyer le devis', 'afaire', '2026-11-04');
  const texte = R.texteCompteRendu(E, r1, '2026-11-05');
  assert.match(texte, /^Compte rendu · Point d'équipe\nlundi 2 novembre 2026 · Salle A/);
  assert.match(texte, /Participants : Marie \(Achats\), Thomas/);
  assert.match(texte, /ORDRE DU JOUR\n1\. Tour de table\n {3}Marie : salon confirmé\.\n {3}Thomas : export à corriger\./);
  assert.match(texte, /DÉCISIONS\n- Budget validé\./);
  assert.match(texte, /ACTIONS\n- Marie : Envoyer le devis · échéance mer\. 04\/11 \(en retard\)/);
  assert.doesNotMatch(texte, /SUIVI DES ACTIONS/);
  const r2 = R.preparerReunion(E, { serieId: 's1', date: '2026-11-09', modele: m }, uid);
  E.reunions.push(r2);
  assert.match(R.texteCompteRendu(E, r2, '2026-11-09'), /SUIVI DES ACTIONS\n- \[À faire\] Marie : Envoyer le devis/);
});

test('base intégrée : 8 modèles complets, couleurs connues', () => {
  assert.equal(B.modeles.length, 8);
  const couleurs = new Set(B.couleurs.map((c) => c.id));
  for (const m of B.modeles) {
    assert.ok(m.id && m.nom && m.description && m.frequence && m.duree, m.id);
    assert.ok(couleurs.has(m.couleur), m.id);
    assert.ok(m.points.length >= 3, m.id);
    for (const p of m.points) assert.ok(p.titre, m.id);
  }
  assert.equal(new Set(B.modeles.map((m) => m.id)).size, 8);
});

test('dates lisibles en français', () => {
  assert.equal(R.dateLongue('2026-11-01'), 'dimanche 1er novembre 2026');
  assert.equal(R.dateCourte('2026-11-13'), 'ven. 13/11');
});
