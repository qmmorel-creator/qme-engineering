// Tests des règles métier du gestionnaire de tâches (templates/taches/regles.js).
// Dates de référence vérifiées à la main sur un calendrier ; fêtes légales 2026 comparées à
// service-public.gouv.fr (fiche F2405, vérifiée le 1er janvier 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../templates/taches/regles.js', import.meta.url), 'utf8');
const ctx = { structuredClone };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const R = ctx.TCH;
const simple = (o) => JSON.parse(JSON.stringify(o));
const T = '2026-11-12'; // jeudi
const FR = { feries: true }, SANS = { feries: false }, ALS = { feries: true, alsace: true };

test('dates de base', () => {
  assert.equal(R.jourSem(T), 4);
  assert.equal(R.lundiDe(T), '2026-11-09');
  assert.equal(R.ajout('2026-02-28', 1), '2026-03-01');
  assert.equal(R.ajout('2028-02-28', 1), '2028-02-29');
  assert.equal(R.ecart('2026-03-28', '2026-03-30'), 2); // passage à l'heure d'été
  assert.equal(R.finDeMois('2026-02-10'), '2026-02-28');
  assert.equal(R.finDeMois('2028-02-10'), '2028-02-29');
});

test('Pâques et fêtes légales', () => {
  assert.equal(R.paques(2024), '2024-03-31');
  assert.equal(R.paques(2025), '2025-04-20');
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  const f = [...R.feries(2026).keys()];
  assert.deepEqual(f, ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25',
    '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']);
  const a = [...R.feries(2026, true).keys()];
  assert.equal(a.length, 13);
  assert.ok(a.includes('2026-04-03') && a.includes('2026-12-26'));
  assert.equal(R.nomFerie('2026-05-14', FR), 'Ascension');
  assert.equal(R.nomFerie('2026-05-14', SANS), null);
});

test('jours ouvrés', () => {
  assert.equal(R.estOuvre('2026-11-11', FR), false); // mercredi férié
  assert.equal(R.estOuvre('2026-11-11', SANS), true);
  assert.equal(R.estOuvre('2026-11-14', FR), false); // samedi
  assert.equal(R.ouvreSuivant('2026-11-10', FR), '2026-11-12'); // saute le 11 novembre
  assert.equal(R.ouvreSuivant('2026-11-13', FR), '2026-11-16'); // vendredi → lundi
  assert.equal(R.ouvrePrecedent('2026-05-26', FR), '2026-05-22'); // saute le lundi de Pentecôte
  assert.equal(R.nemeOuvre(2026, 1, 1, FR), '2026-01-02'); // 1er janvier férié
  assert.equal(R.nemeOuvre(2026, 5, 3, FR), '2026-05-06'); // 1er et 8 mai fériés : 4, 5, 6
  assert.equal(R.nemeOuvre(2026, 5, -1, FR), '2026-05-29');
  assert.equal(R.nemeOuvre(2026, 2, 25, FR), null);
  assert.equal(R.nemeOuvre(2026, 12, -1, ALS), '2026-12-31');
  assert.equal(R.nemeJourSemaine(2026, 11, 1, 1), '2026-11-02');
  assert.equal(R.nemeJourSemaine(2026, 11, -1, 5), '2026-11-27');
  assert.equal(R.nemeJourSemaine(2026, 2, 5, 1), null);
});

test('récurrence : fin de mois sans dérive', () => {
  const r = { type: 'mois', n: 1, mode: 'date', jour: 31 };
  const suite = [];
  let d = R.premiereOccurrence(r, '2026-01-15', FR);
  for (let i = 0; i < 5; i++) { suite.push(d); d = R.occurrenceSuivante(r, d, FR); }
  assert.deepEqual(suite, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  const fin = { type: 'mois', n: 1, mode: 'fin' };
  assert.equal(R.occurrenceSuivante(fin, '2028-01-31', FR), '2028-02-29');
  assert.equal(R.occurrenceSuivante(fin, '2028-02-29', FR), '2028-03-31');
  // Tous les 3 mois le 30 : novembre → février (28) → mai (30)
  const tri = { type: 'mois', n: 3, mode: 'date', jour: 30 };
  assert.equal(R.occurrenceSuivante(tri, '2026-11-30', FR), '2027-02-28');
  assert.equal(R.occurrenceSuivante(tri, '2027-02-28', FR), '2027-05-30');
});

test('récurrence : ajustement au jour ouvré', () => {
  // Le 31 au jour ouvré précédent : 31 janvier 2026 samedi → 30 ; février → 27 (28 samedi)
  const prec = { type: 'mois', n: 1, mode: 'date', jour: 31, ajuster: 'precedent' };
  assert.equal(R.premiereOccurrence(prec, '2026-01-01', FR), '2026-01-30');
  assert.equal(R.occurrenceSuivante(prec, '2026-01-30', FR), '2026-02-27');
  assert.equal(R.occurrenceSuivante(prec, '2026-02-27', FR), '2026-03-31');
  // Le 31 au jour ouvré suivant : janvier → lundi 2 février, qui ne doit pas faire sauter février
  const suiv = { type: 'mois', n: 1, mode: 'date', jour: 31, ajuster: 'suivant' };
  assert.equal(R.premiereOccurrence(suiv, '2026-01-01', FR), '2026-02-02');
  assert.equal(R.occurrenceSuivante(suiv, '2026-02-02', FR), '2026-03-02'); // 28 février samedi → 2 mars
  assert.equal(R.occurrenceSuivante(suiv, '2026-03-02', FR), '2026-03-31');
  // Dernier jour ouvré du mois
  const dern = { type: 'mois', n: 1, mode: 'ouvre', rang: -1 };
  assert.equal(R.occurrenceSuivante(dern, '2026-04-30', FR), '2026-05-29');
  assert.equal(R.occurrenceSuivante(dern, '2026-10-30', FR), '2026-11-30');
  // 1er jour ouvré : 1er mai 2026 férié (vendredi) → lundi 4
  const prem = { type: 'mois', n: 1, mode: 'ouvre', rang: 1 };
  assert.equal(R.occurrenceSuivante(prem, '2026-04-01', FR), '2026-05-04');
  assert.equal(R.occurrenceSuivante(prem, '2026-04-01', SANS), '2026-05-01');
});

test('récurrence : jours ouvrés, semaines, jours, années', () => {
  const ouv = { type: 'ouvre', n: 1 };
  assert.equal(R.occurrenceSuivante(ouv, '2026-11-10', FR), '2026-11-12');
  assert.equal(R.occurrenceSuivante(ouv, '2026-11-13', FR), '2026-11-16');
  assert.equal(R.premiereOccurrence(ouv, '2026-11-14', FR), '2026-11-16');
  const sem = { type: 'semaine', n: 1, jours: [1, 4] };
  assert.equal(R.occurrenceSuivante(sem, '2026-11-09', FR), '2026-11-12');
  assert.equal(R.occurrenceSuivante(sem, '2026-11-12', FR), '2026-11-16');
  const deuxSem = { type: 'semaine', n: 2, jours: [5] };
  assert.equal(R.occurrenceSuivante(deuxSem, '2026-11-13', FR), '2026-11-27');
  assert.equal(R.premiereOccurrence({ type: 'semaine', n: 1, jours: [1] }, T, FR), '2026-11-16');
  assert.equal(R.occurrenceSuivante({ type: 'jour', n: 3 }, '2026-12-30', FR), '2027-01-02');
  const an = { type: 'annee', n: 1, jour: 29, mois: 2 };
  assert.equal(R.occurrenceSuivante(an, '2028-02-29', FR), '2029-02-28');
  assert.equal(R.premiereOccurrence(an, T, FR), '2027-02-28');
  assert.equal(R.occurrenceSuivante({ type: 'mois', n: 1, mode: 'jourSem', rang: 1, jourSem: 1 }, '2026-11-02', FR), '2026-12-07');
  assert.equal(R.occurrenceSuivante({ type: 'jour', n: 1, fin: '2026-11-12' }, '2026-11-12', FR), null);
});

test('instance suivante d\'une tâche récurrente', () => {
  const t = { id: 'a', titre: 'Facturer', echeance: '2026-10-30', recurrence: { type: 'mois', n: 1, mode: 'ouvre', rang: -1 },
    sousTaches: [{ id: 's', titre: 'Relevé', fait: true }], faitLe: '2026-10-30', focus: '2026-10-30' };
  const n = R.prochaineInstance(t, '2026-10-30', FR, 'b');
  assert.equal(n.id, 'b');
  assert.equal(n.echeance, '2026-11-30');
  assert.equal(n.faitLe, null);
  assert.equal(n.focus, null);
  assert.equal(n.sousTaches[0].fait, false);
  assert.equal(n.serie, 'a');
  // En retard de plusieurs occurrences : on saute au futur, sans recréer les occurrences manquées
  const q = { id: 'q', titre: 'Arroser', echeance: '2026-11-05', recurrence: { type: 'jour', n: 1 } };
  assert.equal(R.prochaineInstance(q, T, FR, 'r').echeance, '2026-11-13');
  // Depuis la date de fin
  const f = { id: 'f', titre: 'Changer le filtre', echeance: '2026-11-01', recurrence: { type: 'jour', n: 10, depuis: 'fait' } };
  assert.equal(R.prochaineInstance(f, T, FR, 'g').echeance, '2026-11-22');
  assert.equal(R.prochaineInstance({ id: 'z', titre: 'x', echeance: T }, T, FR, 'y'), null);
});

test('saisie rapide : exemple de la fiche', () => {
  const r = simple(R.analyserSaisie('Appeler la banque demain 14h !haute #Perso 30min', T));
  assert.equal(r.titre, 'Appeler la banque');
  assert.equal(r.echeance, '2026-11-13');
  assert.equal(r.heure, '14:00');
  assert.equal(r.criticite, 'haute');
  assert.equal(r.projet, 'Perso');
  assert.equal(r.duree, 30);
});

test('saisie rapide : dates en français', () => {
  const d = (s) => R.analyserSaisie(s, T).echeance;
  assert.equal(d('Payer le loyer aujourd\'hui'), T);
  assert.equal(d('Rendre le livre après-demain'), '2026-11-14');
  assert.equal(d('Réunion lundi'), '2026-11-16');
  assert.equal(d('Point jeudi'), '2026-11-19'); // jeudi aujourd'hui → jeudi suivant
  assert.equal(d('Point jeudi en huit'), '2026-11-26');
  assert.equal(d('Envoyer le devis dans 3 jours'), '2026-11-15');
  assert.equal(d('Bilan dans 2 semaines'), '2026-11-26');
  assert.equal(d('Renouveler dans 1 mois'), '2026-12-12');
  assert.equal(d('Clôturer fin du mois'), '2026-11-30');
  assert.equal(d('Rapport fin de semaine'), '2026-11-13');
  assert.equal(d('Dossier le 15'), '2026-11-15');
  assert.equal(d('Dossier le 5'), '2026-12-05');
  assert.equal(d('Cadeau 24/12'), '2026-12-24');
  assert.equal(d('Vœux 2/1'), '2027-01-02');
  assert.equal(d('Inscription le 3 mars'), '2027-03-03');
  assert.equal(d('Atelier 1er décembre'), '2026-12-01');
  assert.equal(d('Visite 30 février'), null);
  assert.equal(R.analyserSaisie('Dossier le 15', T).titre, 'Dossier');
  assert.equal(R.analyserSaisie('Préparer la semaine prochaine', T).echeance, '2026-11-16');
});

test('saisie rapide : heures, durées, criticité, projets', () => {
  const a = R.analyserSaisie('Course à pied 1h30 #Sport_et_santé', T);
  assert.equal(a.duree, 90); assert.equal(a.heure, null); assert.equal(a.projet, 'Sport et santé'); assert.equal(a.titre, 'Course à pied');
  const b = R.analyserSaisie('Dentiste mardi à 9h30 !!!', T);
  assert.equal(b.heure, '09:30'); assert.equal(b.echeance, '2026-11-17'); assert.equal(b.criticite, 'critique'); assert.equal(b.titre, 'Dentiste');
  const c = R.analyserSaisie('Rédiger le mémoire ~3h demain 8h', T);
  assert.equal(c.duree, 180); assert.equal(c.heure, '08:00');
  const e = R.analyserSaisie('Appel client à 3h', T);
  assert.equal(e.heure, '03:00'); assert.equal(e.duree, null); assert.equal(e.echeance, T);
  assert.equal(R.analyserSaisie('Lire 45 min', T).duree, 45);
  assert.equal(R.analyserSaisie('Lire 1,5h', T).duree, 90);
  assert.equal(R.analyserSaisie('Rappel 16:45', T).heure, '16:45');
  assert.equal(R.analyserSaisie('Ranger #"Maison et jardin" !basse', T).projet, 'Maison et jardin');
  assert.equal(R.analyserSaisie('Ranger !basse', T).criticite, 'basse');
  assert.equal(R.analyserSaisie('Ranger !!', T).criticite, 'haute');
  assert.equal(R.analyserSaisie('Acheter 3 pommes', T).titre, 'Acheter 3 pommes');
  assert.equal(R.analyserSaisie('Acheter 3 pommes', T).duree, null);
  assert.equal(R.analyserSaisie('', T).titre, '');
});

test('saisie rapide : récurrences', () => {
  const r1 = R.analyserSaisie('Relancer les impayés chaque vendredi', T);
  assert.deepEqual(simple(r1.recurrence), { type: 'semaine', n: 1, jours: [5] });
  assert.equal(r1.echeance, '2026-11-13'); assert.equal(r1.titre, 'Relancer les impayés');
  const r2 = R.analyserSaisie('Facturer chaque fin de mois', T);
  assert.equal(r2.recurrence.mode, 'fin'); assert.equal(r2.echeance, '2026-11-30');
  const r3 = R.analyserSaisie('Lire les e-mails tous les jours ouvrés 9h', T);
  assert.equal(r3.recurrence.type, 'ouvre'); assert.equal(r3.echeance, T); assert.equal(r3.heure, '09:00');
  const r4 = R.analyserSaisie('Payer le loyer tous les mois le 5', T);
  assert.equal(r4.recurrence.jour, 5); assert.equal(r4.echeance, '2026-12-05');
  const r5 = R.analyserSaisie('Arroser tous les 3 jours', T);
  assert.equal(r5.recurrence.n, 3); assert.equal(r5.echeance, T);
});

test('triage Eisenhower et dépendances', () => {
  assert.equal(R.quadrant({ urgent: true, important: true }), 'faire');
  assert.equal(R.quadrant({ urgent: false, important: true }), 'planifier');
  assert.equal(R.quadrant({ urgent: true, important: false }), 'expedier');
  assert.equal(R.quadrant({ urgent: false, important: false }), 'abandonner');
  assert.equal(R.quadrant({}), null);
  assert.equal(R.urgenceSuggeree({ echeance: '2026-11-14' }, T), true);
  assert.equal(R.urgenceSuggeree({ echeance: '2026-11-15' }, T), false);
  const ts = [{ id: 'a', apres: [] }, { id: 'b', apres: ['a'] }, { id: 'c', apres: ['b'] }];
  assert.equal(R.estBloquee(ts[1], ts), true);
  assert.equal(R.creeBoucle('a', 'c', ts), true);
  assert.equal(R.creeBoucle('c', 'a', ts), false);
  ts[0].faitLe = T;
  assert.equal(R.estBloquee(ts[1], ts), false);
});

test('tranches, tri, focus, bilan', () => {
  assert.equal(R.tranche({ echeance: '2026-11-10' }, T), 'retard');
  assert.equal(R.tranche({ echeance: T }, T), 'aujourdhui');
  assert.equal(R.tranche({ echeance: '2026-11-15' }, T), 'semaine');
  assert.equal(R.tranche({ echeance: '2026-11-22' }, T), 'semaineProchaine');
  assert.equal(R.tranche({ echeance: '2026-11-23' }, T), 'plustard');
  assert.equal(R.tranche({}, T), 'sansdate');
  const ts = [
    { id: '1', titre: 'Basse', criticite: 'basse' },
    { id: '2', titre: 'Retard', criticite: 'normale', echeance: '2026-11-10' },
    { id: '3', titre: 'Critique', criticite: 'critique' },
    { id: '4', titre: 'Boîte', criticite: 'critique', inbox: true },
    { id: '5', titre: 'Bloquée', criticite: 'haute', apres: ['2'] },
    { id: '6', titre: 'Faite', criticite: 'critique', faitLe: T, focus: T, duree: 30 },
    { id: '7', titre: 'Focus restante', criticite: 'normale', focus: T, duree: 45 },
  ];
  assert.deepEqual(R.suggestionsFocus(ts, T).map((x) => x.id), ['2', '3', '7']);
  const b = R.bilanJour(ts, T);
  assert.equal(b.faites, 1); assert.equal(b.minutes, 30); assert.equal(b.focusFaits, 1); assert.equal(b.focusTotal, 2);
  assert.equal(R.dureeTexte(90), '1 h 30'); assert.equal(R.dureeTexte(45), '45 min');
  assert.equal(R.serieClotures({ '2026-11-11': { soir: true }, '2026-11-10': { soir: true }, '2026-11-08': { soir: true } }, T), 2);
});

test('jeux de statuts et recherche', () => {
  const st = [{ id: 'a', nom: 'À faire' }, { id: 'f', nom: 'Fait', fini: true }];
  const ts = R.appliquerStatuts([{ statut: 'encours' }, { statut: 'x', faitLe: T }, { statut: 'f' }], st);
  assert.deepEqual(ts.map((x) => x.statut), ['a', 'f', 'a']);
  assert.equal(R.correspond({ titre: 'Déclarer les revenus' }, 'declarer rev'), true);
  assert.equal(R.correspond({ titre: 'Déclarer' }, 'banque'), false);
  assert.match(R.decrireRecurrence({ type: 'mois', n: 1, mode: 'date', jour: 31, ajuster: 'precedent' }), /dernier jour.*précédent/);
});
