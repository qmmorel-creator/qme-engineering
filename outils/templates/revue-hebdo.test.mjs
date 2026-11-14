// Tests des règles métier de la revue hebdomadaire et journal de bord (templates/revue-hebdo/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/revue-hebdo/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RVH;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Aujourd'hui fictif : samedi 14 novembre 2026, semaine ISO 46 (du lundi 9 au dimanche 15).
const AUJ = '2026-11-14';
const etat = (creeLe = '2026-09-01') => R.normaliserEtat({ creeLe }, AUJ);
const revue = (semaine, extra = {}) => R.normaliserRevue({ id: `r${semaine}`, semaine, date: R.ajout(R.lundiDeCle(semaine), 4), ...extra });

test('base intégrée : 7 étapes, des questions pour chacune, sans doublon, échelles complètes', () => {
  assert.deepEqual(simple(B.etapes.map((x) => x.id)), ['tete', 'semaine', 'bilan', 'apprentissages', 'priorites', 'agenda', 'energie']);
  let total = 0;
  for (const x of B.etapes) {
    const l = B.questions[x.id];
    assert.ok(l.length >= 7, x.id);
    assert.equal(new Set(l).size, l.length, `doublon : ${x.id}`);
    for (const q of l) assert.match(q, /\?$/, q);
    total += l.length;
  }
  assert.ok(total >= 50, `${total} questions`);
  assert.equal(B.humeurs.length, 6);
  assert.equal(B.energies.length, 6);
  assert.equal(B.jours[5], 'vendredi');
  assert.match(B.methode.humeur, /pas une mesure de santé/);
});

test('semaines ISO : clé, lundi, passage d\'année, semaine 53', () => {
  assert.equal(R.cleSemaine(AUJ), '2026-W46');
  assert.equal(R.lundiDeCle('2026-W46'), '2026-11-09');
  assert.equal(R.dimancheDeCle('2026-W46'), '2026-11-15');
  assert.equal(R.jourSemaine('2026-11-09'), 1);
  assert.equal(R.jourSemaine('2026-11-15'), 7);
  // Le 1er janvier 2027 (vendredi) appartient à la semaine 53 de 2026.
  assert.equal(R.cleSemaine('2027-01-01'), '2026-W53');
  assert.equal(R.cleSemaine('2027-01-04'), '2027-W01');
  assert.equal(R.cleSemaine('2025-12-29'), '2026-W01');
  assert.equal(R.semaineSuivante('2026-W53'), '2027-W01');
  assert.equal(R.semaineSuivante('2027-W01', -1), '2026-W53');
  assert.equal(R.ecartSemaines('2026-W46', '2027-W02'), 9);
  assert.ok(R.cleValide('2026-W53'));
  assert.ok(!R.cleValide('2027-W53'));
  assert.deepEqual(simple(R.joursDe('2026-W46')), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
});

test('rappel du jour choisi : jour même, après, avant (rattrapage), à jour', () => {
  const e = etat();
  // Vendredi 13 novembre, jour de revue : la semaine 46 est à faire.
  assert.deepEqual(simple(R.rappel(e, '2026-11-13')), { type: 'jour', semaine: '2026-W46', date: '2026-11-13' });
  // Samedi : toujours à faire (« due »).
  assert.equal(R.rappel(e, AUJ).type, 'due');
  // Mardi 17 sans revue de la semaine 46 : rattrapage possible jusqu'au jeudi 19.
  const r = R.rappel(e, '2026-11-17');
  assert.equal(r.type, 'retard');
  assert.equal(r.semaine, '2026-W46');
  assert.equal(r.avant, '2026-11-19');
  // Revue faite : rien à faire, prochaine le vendredi suivant.
  e.revues.push(revue('2026-W46'));
  assert.deepEqual(simple(R.rappel(e, AUJ)), { type: 'ok', semaine: '2026-W47', date: '2026-11-20' });
  assert.deepEqual(simple(R.rappel(e, '2026-11-17')), { type: 'ok', semaine: '2026-W47', date: '2026-11-20' });
  // Jour de revue réglé au dimanche.
  e.jourRevue = 7;
  assert.equal(R.rappel(e, '2026-11-21').type, 'ok');
  assert.equal(R.rappel(e, '2026-11-22').type, 'jour');
});

test('rappel : pas de rattrapage pour une semaine antérieure à la création de l\'outil', () => {
  const e = etat('2026-11-16'); // créé le lundi 16
  assert.equal(R.rappel(e, '2026-11-17').type, 'ok');
  assert.equal(R.semaineACommencer(e, '2026-11-17'), '2026-W47'); // revue en avance de la semaine en cours
  const f = etat('2026-11-12');
  assert.equal(R.rappel(f, '2026-11-17').type, 'retard');
  assert.equal(R.semaineACommencer(f, '2026-11-17'), '2026-W46');
  f.revues.push(revue('2026-W46'), revue('2026-W47'));
  assert.equal(R.semaineACommencer(f, '2026-11-17'), null);
});

test('priorités : celles de la semaine viennent de la revue précédente, cycle et taux', () => {
  const e = etat();
  e.revues.push(revue('2026-W45', { priorites: [{ texte: 'A', etat: 'faite' }, { texte: 'B', etat: 'partielle' }, { texte: 'C', etat: 'non' }, { texte: 'D' }] }));
  const p = R.prioritesDe(e, '2026-W46');
  assert.equal(p.length, 3, '3 priorités au plus');
  assert.equal(R.tauxPriorites(p), 50);
  assert.equal(R.tauxPriorites([{ etat: null }]), null);
  assert.equal(R.tauxPriorites([{ etat: 'faite' }, { etat: null }]), 100, 'les priorités sans état ne comptent pas');
  assert.deepEqual(simple(R.prioritesDe(e, '2026-W45')), []);
  assert.equal(R.etatPrioSuivant(null), 'faite');
  assert.equal(R.etatPrioSuivant('faite'), 'partielle');
  assert.equal(R.etatPrioSuivant('partielle'), 'non');
  assert.equal(R.etatPrioSuivant('non'), null);
});

test('journal : une ligne par jour, humeur facultative, effacement, limite de longueur', () => {
  const e = etat();
  assert.ok(R.ecrireJournal(e, '2026-11-10', { texte: '  Atelier   client  ', humeur: 4 }));
  assert.deepEqual(simple(e.journal['2026-11-10']), { texte: 'Atelier client', humeur: 4 });
  R.ecrireJournal(e, '2026-11-11', { texte: '', humeur: 2 });
  assert.equal(e.journal['2026-11-11'].humeur, 2);
  R.ecrireJournal(e, '2026-11-11', { texte: '', humeur: null });
  assert.equal(e.journal['2026-11-11'], undefined, 'ligne vide sans humeur : effacée');
  R.ecrireJournal(e, '2026-11-12', { texte: 'x'.repeat(400), humeur: 9 });
  assert.equal(e.journal['2026-11-12'].texte.length, R.MAX_LIGNE);
  assert.equal(e.journal['2026-11-12'].humeur, null, 'humeur hors de 1 à 5 ignorée');
  assert.ok(!R.ecrireJournal(e, '2026-02-30', { texte: 'non' }));
  const j = R.journalDe(e, '2026-W46');
  assert.equal(j.length, 7);
  assert.equal(j[1].texte, 'Atelier client');
  assert.equal(j[0].texte, '');
});

test('humeur de la semaine : moyenne du journal, sinon celle de la revue', () => {
  const e = etat();
  R.ecrireJournal(e, '2026-11-09', { texte: 'a', humeur: 4 });
  R.ecrireJournal(e, '2026-11-10', { texte: 'b', humeur: 3 });
  R.ecrireJournal(e, '2026-11-11', { texte: 'c' });
  assert.equal(R.humeurSemaine(e, '2026-W46'), 3.5);
  e.revues.push(revue('2026-W45', { humeur: 2 }));
  assert.equal(R.humeurSemaine(e, '2026-W45'), 2);
  assert.equal(R.humeurSemaine(e, '2026-W44'), null);
});

test('série, meilleure série et semaines tenues', () => {
  const e = etat('2026-09-14'); // semaine 38
  for (const s of ['2026-W40', '2026-W41', '2026-W43', '2026-W44', '2026-W45']) e.revues.push(revue(s));
  // Samedi de la semaine 46 sans revue : la semaine en cours ne casse pas la série.
  assert.equal(R.serie(e, AUJ), 3);
  e.revues.push(revue('2026-W46'));
  assert.equal(R.serie(e, AUJ), 4);
  assert.equal(R.meilleureSerie(e), 4);
  // Lundi suivant sans revue de la semaine 47 : série toujours de 4.
  assert.equal(R.serie(e, '2026-11-16'), 4);
  // Semaine 47 passée sans revue : série cassée.
  assert.equal(R.serie(e, '2026-11-23'), 0);
  // Tenue : 6 revues sur les 9 semaines depuis la création (38 à 46).
  assert.deepEqual(simple(R.tenue(e, AUJ)), { tenues: 6, total: 9, taux: 67 });
  assert.deepEqual(simple(R.tenue(e, AUJ, 4)), { tenues: 4, total: 4, taux: 100 });
  // Outil créé cette semaine, rien de fait : aucune semaine écoulée.
  assert.deepEqual(simple(R.tenue(etat('2026-11-12'), AUJ)), { tenues: 0, total: 0, taux: null });
});

test('historique des semaines pour la tendance', () => {
  const e = etat('2026-10-20');
  e.revues.push(revue('2026-W44', { energie: 4, humeur: 3, priorites: [{ texte: 'A', etat: 'faite' }, { texte: 'B', etat: 'non' }] }));
  R.ecrireJournal(e, '2026-11-02', { texte: 'x', humeur: 5 });
  const h = R.historiqueSemaines(e, AUJ, 6);
  assert.equal(h.length, 6);
  assert.equal(h.at(-1).semaine, '2026-W46');
  assert.ok(h.at(-1).enCours);
  const s44 = h.find((x) => x.semaine === '2026-W44');
  assert.deepEqual([s44.tenue, s44.energie, s44.humeur], [true, 4, 3]);
  const s45 = h.find((x) => x.semaine === '2026-W45');
  assert.deepEqual([s45.tenue, s45.humeur, s45.priorites, s45.joursJournal], [false, 5, 50, 1]);
  assert.ok(h.find((x) => x.semaine === '2026-W42').avantOutil);
  assert.ok(!h.find((x) => x.semaine === '2026-W43').avantOutil);
});

test('repère « semaines difficiles » : seulement 3 semaines notées d\'affilée à 2 ou moins', () => {
  const e = etat();
  for (const [d, h] of [['2026-10-27', 2], ['2026-11-03', 1], ['2026-11-10', 2]]) R.ecrireJournal(e, d, { texte: 'x', humeur: h });
  assert.ok(R.semainesDifficiles(e, AUJ));
  R.ecrireJournal(e, '2026-11-11', { texte: 'y', humeur: 5 });
  assert.ok(!R.semainesDifficiles(e, AUJ));
  assert.ok(!R.semainesDifficiles(etat(), AUJ));
});

test('échéances à venir et passées non cochées', () => {
  const e = etat();
  e.echeances = [
    { id: 'a', date: '2026-11-20', texte: 'Comité', fait: false },
    { id: 'b', date: '2026-11-15', texte: 'Rendu', fait: false },
    { id: 'c', date: '2026-11-16', texte: 'Fait', fait: true },
    { id: 'd', date: '2027-01-30', texte: 'Loin', fait: false },
    { id: 'e', date: '2026-11-10', texte: 'Passé', fait: false },
    { id: 'f', date: '2026-10-01', texte: 'Très ancien', fait: false },
  ];
  assert.deepEqual(simple(R.echeancesAVenir(e, AUJ).map((x) => x.id)), ['b', 'a']);
  assert.deepEqual(simple(R.echeancesAVenir(e, AUJ, 90).map((x) => x.id)), ['b', 'a', 'd']);
  assert.deepEqual(simple(R.echeancesPassees(e, AUJ).map((x) => x.id)), ['e']);
});

test('questions : rotation par semaine, décalage, masquées et personnelles', () => {
  const e = etat();
  const q1 = R.questionDe(e, B, 'bilan', '2026-W46');
  const q2 = R.questionDe(e, B, 'bilan', '2026-W47');
  assert.ok(B.questions.bilan.includes(q1));
  assert.notEqual(q1, q2, 'une autre question la semaine suivante');
  assert.equal(R.questionDe(e, B, 'bilan', '2026-W46', 1), q2, '« Autre question » = la suivante');
  assert.notEqual(R.questionDe(e, B, 'tete', '2026-W46'), undefined);
  e.questionsMasquees = [q1];
  assert.notEqual(R.questionDe(e, B, 'bilan', '2026-W46'), q1);
  e.questionsMasquees = [...B.questions.energie];
  assert.equal(R.questionDe(e, B, 'energie', '2026-W46'), null);
  e.questionsPerso = { energie: ['Ma question ?'] };
  assert.equal(R.questionDe(e, B, 'energie', '2026-W46'), 'Ma question ?');
});

test('recherche : revues et journal, sans accents ni casse, du plus récent au plus ancien', () => {
  const e = etat();
  e.revues.push(revue('2026-W44', { reussites: ['Budget validé au comité'], apprentissages: 'Préparer la veille.' }));
  e.revues.push(revue('2026-W45', { priorites: [{ texte: 'Relancer le budget' }] }));
  R.ecrireJournal(e, '2026-11-12', { texte: 'Point budget avec la comptabilité' });
  R.ecrireJournal(e, '2026-11-13', { texte: 'Sport le midi' });
  const res = R.rechercher(e, 'BUDGÉT');
  assert.deepEqual(simple(res.map((x) => x.type === 'revue' ? x.semaine : x.date)), ['2026-11-12', '2026-W45', '2026-W44']);
  assert.match(res[0].extrait, /budget/);
  assert.deepEqual(simple(R.rechercher(e, 'b')), [], 'deux caractères au moins');
  assert.equal(R.rechercher(e, 'introuvable').length, 0);
  assert.match(R.extrait('a'.repeat(200) + ' cible ' + 'b'.repeat(200), 'cible'), /^….*cible.*…$/);
});

test('export texte : revue et historique complets', () => {
  const e = etat();
  e.prenom = 'Alex';
  e.revues.push(revue('2026-W45', { priorites: [{ texte: 'Finir le rapport', etat: 'faite' }] }));
  const r = revue('2026-W46', {
    tete: ['Rappeler le garage'], reussites: ['Rapport livré'], difficultes: ['Trop de réunions'], apprentissages: 'Protéger les matinées.',
    priorites: [{ texte: 'Préparer le comité' }], energie: 4, humeur: 3, mot: 'Dense', questions: { bilan: { question: 'De quoi es-tu fier ?', reponse: 'Du rapport.' } },
  });
  e.revues.push(r);
  e.echeances.push({ id: 'x', date: '2026-11-20', texte: 'Comité', fait: false, revue: r.id });
  R.ecrireJournal(e, '2026-11-10', { texte: 'Atelier', humeur: 4 });
  R.ecrireJournal(e, '2026-09-01', { texte: 'Ancien jour' });
  const t = R.texteRevue(e, B, r);
  for (const morceau of ['SEMAINE 46', 'Rappeler le garage', 'Finir le rapport (faite)', 'mardi : Atelier [Bien]', 'Rapport livré', 'Protéger les matinées.', 'Préparer le comité', '20 novembre : Comité', 'énergie 4/5 (Bonne)', 'mot de la semaine : Dense', 'Du rapport.']) assert.ok(t.includes(morceau), morceau);
  const h = R.texteHistorique(e, B, AUJ);
  assert.ok(h.startsWith('REVUE HEBDOMADAIRE ET JOURNAL DE BORD · Alex'));
  assert.ok(h.indexOf('SEMAINE 46') < h.indexOf('SEMAINE 45'), 'revues de la plus récente à la plus ancienne');
  assert.ok(h.includes('JOURNAL (semaines sans revue)') && h.includes('Ancien jour'));
});

test('normalisation : état vide, anciennes données et valeurs invalides', () => {
  const v = R.normaliserEtat(null, AUJ);
  assert.equal(v.jourRevue, 5);
  assert.equal(v.creeLe, AUJ);
  assert.deepEqual(simple([v.revues, v.journal, v.echeances, v.brouillon]), [[], {}, [], null]);
  const n = R.normaliserEtat({
    jourRevue: 9, revues: [{ semaine: '2026-W45', tete: 'a\n- b\n\n', priorites: [{ texte: ' x ', etat: 'bizarre' }], humeur: 7 }, { semaine: '2026-W45' }, { semaine: 'nimporte' }],
    journal: { '2026-11-10': { texte: 'ok', humeur: 3 }, mauvais: { texte: 'x' }, '2026-11-11': { texte: '', humeur: null } },
    echeances: [{ date: '2026-11-20', texte: 'Comité' }, { date: 'x', texte: 'y' }], questionsPerso: { bilan: [' Q ? ', ''] },
    brouillon: { semaine: 'faux' },
  }, AUJ);
  assert.equal(n.jourRevue, 5);
  assert.equal(n.revues.length, 1, 'une revue par semaine, clé valide');
  assert.deepEqual(simple(n.revues[0].tete), ['a', 'b']);
  assert.deepEqual(simple(n.revues[0].priorites.map((p) => [p.texte, p.etat])), [['x', null]]);
  assert.equal(n.revues[0].humeur, null);
  assert.deepEqual(Object.keys(n.journal), ['2026-11-10']);
  assert.equal(n.echeances.length, 1);
  assert.equal(n.echeances[0].fait, false);
  assert.deepEqual(simple(n.questionsPerso), { bilan: ['Q ?'] });
  assert.equal(n.brouillon, null);
  assert.deepEqual(simple(R.lignes('• un\n* deux\n  \n- trois')), ['un', 'deux', 'trois']);
});
