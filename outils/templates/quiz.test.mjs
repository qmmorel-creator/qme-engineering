// Tests des règles métier de la banque de questions et quiz (templates/quiz/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/quiz/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.QZZ;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

const qcm = (id, x = {}) => R.normaliserQuestion({ id, type: 'qcm', enonce: `Question ${id}`, choix: [{ texte: 'a', juste: true }, { texte: 'b' }, { texte: 'c' }, { texte: 'd' }], tags: ['t1'], ...x });
const vf = (id, vrai = true, x = {}) => R.normaliserQuestion({ id, type: 'vf', enonce: `Affirmation ${id}`, vrai, tags: ['t2'], ...x });
const courte = (id, acceptees, x = {}) => R.normaliserQuestion({ id, type: 'courte', enonce: `Réponse ${id}`, acceptees, tags: ['t2'], ...x });

function etat() {
  const e = R.etatVide(B);
  e.questions = [qcm('q1'), vf('q2', false), courte('q3', ['12,5', 'douze et demi']), qcm('q4', { choix: [{ texte: 'a', juste: true }, { texte: 'b', juste: true }, { texte: 'c' }], difficulte: 3, points: 2 })];
  e.quiz = [R.normaliserQuiz({ id: 'z1', titre: 'Quiz 1', items: R.items(e, ['q1', 'q2', 'q3', 'q4'], false) }, e.questions)];
  e.sessions = [R.normaliserSession({ id: 's1', quizId: 'z1', nom: 'Groupe A', date: '2026-10-01', mode: 'nominatif' })];
  return e;
}
const copie = (id, apprenant, reponses, x = {}) => R.normaliserCopie({ id, sessionId: 's1', apprenant, reponses, ...x });

test('réponses courtes comparées sans majuscules, accents, espaces ni ponctuation ; virgule décimale', () => {
  assert.equal(R.normaliserReponse(' Élève '), 'eleve');
  assert.equal(R.normaliserReponse('12,5'), R.normaliserReponse('12.5'));
  assert.equal(R.normaliserReponse("l'eau."), R.normaliserReponse('L eau'));
  assert.notEqual(R.normaliserReponse('125'), R.normaliserReponse('12,5'));
});

test('correction : QCM tout ou rien, vrai ou faux, réponse courte, blanc et non saisie', () => {
  const [q1, q2, q3, q4] = etat().questions;
  assert.equal(R.corriger(q1, [0]).etat, 'juste');
  assert.equal(R.corriger(q1, [1]).etat, 'faux');
  assert.equal(R.corriger(q1, [0, 1]).etat, 'faux');
  assert.equal(R.corriger(q4, [1, 0]).points, 2);
  assert.equal(R.corriger(q4, [0]).etat, 'faux', 'plusieurs bonnes réponses : toutes exigées');
  assert.equal(R.corriger(q2, false).etat, 'juste');
  assert.equal(R.corriger(q2, true).etat, 'faux');
  assert.equal(R.corriger(q3, '12.5').etat, 'juste');
  assert.equal(R.corriger(q3, 'Douze et demi').etat, 'juste');
  assert.equal(R.corriger(q3, 'environ 12').etat, 'a-verifier');
  assert.equal(R.corriger(q3, 'environ 12', true).etat, 'juste', 'correction manuelle');
  assert.equal(R.corriger(q3, '12.5', false).etat, 'faux', 'la correction manuelle prime');
  assert.equal(R.corriger(q1, null).etat, 'blanc');
  assert.equal(R.corriger(q1, []).etat, 'blanc');
  assert.equal(R.corriger(q1, undefined).etat, 'non-saisie');
});

test('score d\'une copie : points, pourcentage, note arrondie au demi-point, copie incomplète', () => {
  const e = etat();
  const c = copie('c1', 'Lina R.', { q1: [0], q2: false, q3: '12,5', q4: [0] });
  const s = R.scoreCopie(e, c, e.quiz[0]);
  assert.equal(s.total, 5);
  assert.equal(s.points, 3);
  assert.equal(s.note, 12);
  assert.equal(s.complete, true);
  const inc = R.scoreCopie(e, copie('c2', 'Malo D.', { q1: [0] }), e.quiz[0]);
  assert.equal(inc.nonSaisies, 3);
  assert.equal(inc.complete, false);
  e.reglages.bareme = 100;
  assert.equal(R.scoreCopie(e, c, e.quiz[0]).note, 60);
});

test('statistiques par question et par étiquette : taux, classes, distracteur, réponses à vérifier exclues', () => {
  const e = etat();
  e.reglages.minReponses = 3;
  e.copies = [
    copie('c1', 'A', { q1: [0], q2: false, q3: '12,5', q4: [2] }),
    copie('c2', 'B', { q1: [0], q2: true, q3: 'je ne sais pas', q4: [2] }),
    copie('c3', 'C', { q1: [0], q2: false, q3: null, q4: [0, 2] }),
    copie('c4', 'D', { q1: [0], q2: false }),
  ];
  const st = Object.fromEntries(R.statsQuestions(e).map((s) => [s.qid, s]));
  assert.equal(st.q1.n, 4); assert.equal(st.q1.taux, 1); assert.equal(st.q1.classe, 'facile');
  assert.equal(st.q2.taux, 0.75); assert.equal(st.q2.classe, 'ok');
  assert.equal(st.q3.n, 2, 'à vérifier et non saisie exclues'); assert.equal(st.q3.blancs, 1); assert.equal(st.q3.classe, 'peu');
  assert.equal(st.q4.taux, 0); assert.equal(st.q4.classe, 'difficile');
  assert.deepEqual(simple(st.q4.distracteur), { indice: 2, nombre: 3, part: 1 });
  const tags = Object.fromEntries(R.statsTags(e).map((t) => [t.tag, t]));
  assert.equal(tags.t1.n, 7); assert.equal(tags.t1.justes, 4);
  assert.equal(tags.t2.n, 6); assert.equal(tags.t2.justes, 4);
});

test('statistiques de session : moyenne et médiane sur les copies complètes', () => {
  const e = etat();
  e.copies = [copie('c1', 'A', { q1: [0], q2: false, q3: '12,5', q4: [0, 1] }), copie('c2', 'B', { q1: [1], q2: true, q3: null, q4: [0] }), copie('c3', 'C', { q1: [0] })];
  const s = R.statsSession(e, 's1');
  assert.equal(s.copies, 3); assert.equal(s.completes, 2); assert.equal(s.incompletes, 1);
  assert.equal(s.moyenne, 0.5); assert.equal(s.mediane, 0.5); assert.equal(s.max, 1); assert.equal(s.min, 0);
  assert.deepEqual(simple(s.tranches), [1, 0, 0, 0, 1]);
});

test('tirage : filtres, nombre, reproductible, priorité aux moins posées, ordre de difficulté', () => {
  const e = R.etatVide(B);
  for (let i = 0; i < 20; i += 1) e.questions.push(qcm(`q${i}`, { tags: [i % 2 ? 'impair' : 'pair', 'tout'], difficulte: (i % 3) + 1 }));
  e.questions.push(qcm('arch', { tags: ['pair'], archivee: true }));
  const a = R.tirer(e, { tags: ['pair'], nombre: 5 }, 42);
  assert.equal(a.disponibles, 10);
  assert.equal(a.ids.length, 5);
  assert.ok(!a.ids.includes('arch'));
  assert.deepEqual(simple(R.tirer(e, { tags: ['pair'], nombre: 5 }, 42).ids), simple(a.ids));
  assert.equal(R.tirer(e, { tags: ['pair', 'impair'], tousLesTags: true }, 1).disponibles, 0);
  assert.equal(R.tirer(e, { difficultes: [3] }, 1).disponibles, 6);
  e.quiz.push(R.normaliserQuiz({ id: 'z', items: R.items(e, ['q0', 'q2', 'q4', 'q6', 'q8'], false) }, e.questions));
  const b = R.tirer(e, { tags: ['pair'], nombre: 5, moinsPosees: true }, 7);
  assert.deepEqual(simple(b.ids).sort(), ['q10', 'q12', 'q14', 'q16', 'q18']);
  const c = R.tirer(e, { nombre: 20, ordre: 'difficulte' }, 3).ids.map((id) => e.questions.find((q) => q.id === id).difficulte);
  assert.deepEqual(simple(c), simple([...c].sort()));
});

test('mélange des propositions : permutation reproductible, réponse lue dans l\'ordre affiché', () => {
  const e = etat();
  const it = R.items(e, ['q1', 'q4', 'q2'], true, 5);
  assert.equal(it[0].ordre.length, 4);
  assert.deepEqual(simple(it[0].ordre).sort(), [0, 1, 2, 3]);
  assert.deepEqual(simple(it[2].ordre), []);
  assert.deepEqual(simple(R.items(e, ['q1', 'q4', 'q2'], true, 5)), simple(it));
  const item = { qid: 'q1', ordre: [2, 0, 3, 1] };
  assert.equal(R.reponseLisible(e.questions[0], item, [0]), 'B', 'la bonne réponse (indice 0) est affichée en B');
  assert.equal(R.bonneReponseLisible(e.questions[0], item), 'B');
  assert.equal(R.reponseLisible(e.questions[1], null, true), 'Vrai');
  assert.equal(R.reponseLisible(e.questions[0], item, null), '(blanc)');
});

test('collage d\'une liste de questions : QCM, vrai ou faux, réponse courte, étiquettes, erreurs', () => {
  const { questions, erreurs } = R.analyserTexte(`? Combien font 2 + 2 ?
+ 4
- 5
# calcul, Mental
~ 1
! Deux plus deux.

? La Terre tourne autour du Soleil.
= vrai

? Capitale fictive du pays X ?
= Alpha
= alfa

? Sans réponse
- a
- b
hors question ?`);
  assert.equal(questions.length, 3);
  assert.equal(questions[0].type, 'qcm');
  assert.deepEqual(simple(questions[0].tags), ['calcul', 'mental']);
  assert.equal(questions[0].difficulte, 1);
  assert.equal(questions[0].explication, 'Deux plus deux.');
  assert.equal(questions[1].type, 'vf'); assert.equal(questions[1].vrai, true);
  assert.equal(questions[2].type, 'courte'); assert.deepEqual(simple(questions[2].acceptees), ['Alpha', 'alfa']);
  assert.equal(erreurs.length, 1);
  assert.match(erreurs[0].message, /Aucune proposition juste/);
});

test('RGPD : effacement d\'un apprenant, d\'une session, de tous les résultats ; anonymisation ; export', () => {
  let e = etat();
  e.sessions.push(R.normaliserSession({ id: 's2', quizId: 'z1', nom: 'Groupe B', date: '2026-11-01', mode: 'nominatif' }));
  e.copies = [copie('c1', 'Lina R.', { q1: [0] }), copie('c2', 'Malo D.', { q1: [1] }), R.normaliserCopie({ id: 'c3', sessionId: 's2', apprenant: 'lina  r.', reponses: { q1: [0] } })];
  assert.deepEqual(simple(R.apprenants(e).map((a) => [a.cle, a.copies])), [['lina r.', 2], ['malo d.', 1]]);
  assert.equal(R.parcoursApprenant(e, 'lina r.').length, 2);
  const ex = R.exportResultats(e, { cle: 'lina r.' }, '2026-11-14');
  assert.equal(ex.copies.length, 2); assert.equal(ex.copies[0].reponses[0].reponse, 'A');
  assert.ok(R.csvNotes(e, { cle: 'lina r.' }).startsWith('﻿Date;Session'));
  assert.equal(R.csvNotes(e, { cle: 'lina r.' }).trim().split('\r\n').length, 3);
  const sans = R.effacerApprenant(e, 'lina r.');
  assert.deepEqual(simple(sans.copies.map((c) => c.id)), ['c2']);
  assert.equal(R.effacerSession(e, 's1').copies.length, 1);
  assert.equal(R.effacerSession(e, 's1').sessions.length, 1);
  const vide = R.effacerResultats(e);
  assert.equal(vide.copies.length + vide.sessions.length, 0);
  assert.equal(vide.questions.length, 4, 'la banque reste');
  const an = R.anonymiserSession(e, 's1');
  assert.deepEqual(simple(an.copies.filter((c) => c.sessionId === 's1').map((c) => c.apprenant)), ['Copie 1', 'Copie 2']);
  assert.equal(R.apprenants(an).length, 1);
  assert.equal(R.prochainNumeroCopie(an, 's1'), 3);
});

test('conservation : sessions nominatives plus anciennes que la durée choisie', () => {
  const e = etat();
  e.sessions.push(R.normaliserSession({ id: 's0', quizId: 'z1', nom: 'Ancien', date: '2025-09-10', mode: 'nominatif' }));
  e.sessions.push(R.normaliserSession({ id: 'sa', quizId: 'z1', nom: 'Anonyme', date: '2025-09-10', mode: 'anonyme' }));
  e.copies = [R.normaliserCopie({ sessionId: 's0', apprenant: 'X', reponses: {} }), R.normaliserCopie({ sessionId: 'sa', apprenant: 'Copie 1', reponses: {} }), copie('c', 'Y', {})];
  assert.deepEqual(simple(R.sessionsAnciennes(e, '2026-11-14', 12).map((s) => s.id)), ['s0']);
  assert.equal(R.ajoutMois('2026-03-31', -1), '2026-02-28');
});

test('suppressions : question archivée si un quiz l\'utilise ; quiz supprimé avec ses sessions', () => {
  let e = etat();
  e.questions.push(vf('libre'));
  e = R.supprimerQuestion(e, 'q1');
  assert.equal(e.questions.find((q) => q.id === 'q1').archivee, true);
  e = R.supprimerQuestion(e, 'libre');
  assert.ok(!e.questions.some((q) => q.id === 'libre'));
  e.copies = [copie('c1', 'A', {})];
  e = R.supprimerQuiz(e, 'z1');
  assert.equal(e.sessions.length + e.copies.length + e.quiz.length, 0);
});

test('normalisation tolérante : orphelins retirés, ordres invalides réparés, réglages bornés', () => {
  const e = R.normaliser({
    reglages: { bareme: 17, seuilFacile: 120, conservation: 'x' },
    questions: [{ id: 'a', type: 'qcm', enonce: 'x', choix: [{ texte: '1', juste: true }, { texte: '2' }] }, { id: 'b', type: 'bizarre', enonce: 'y' }],
    quiz: [{ id: 'z', items: [{ qid: 'a', ordre: [0, 0] }, { qid: 'absente' }, { qid: 'a' }] }],
    sessions: [{ id: 's', quizId: 'z', nom: 'S', date: '2026-01-01' }, { id: 'orph', quizId: 'nope' }],
    copies: [{ id: 'c', sessionId: 's', apprenant: 'A', reponses: { a: [0, 9, 'x'], b: true, c: { o: 1 } }, corrections: { a: 'oui' } }, { sessionId: 'orph' }],
  }, B);
  assert.equal(e.reglages.bareme, 20); assert.equal(e.reglages.seuilFacile, 100); assert.equal(e.reglages.conservation, 12);
  assert.equal(e.questions[1].type, 'qcm');
  assert.deepEqual(simple(e.quiz[0].items), [{ qid: 'a', ordre: [0, 1] }]);
  assert.equal(e.sessions.length, 1); assert.equal(e.sessions[0].mode, 'anonyme');
  assert.equal(e.copies.length, 1);
  assert.deepEqual(simple(e.copies[0].reponses), { a: [0], b: true });
  assert.deepEqual(simple(e.copies[0].corrections), {});
  assert.deepEqual(simple(R.normaliser(null, B)), simple(R.etatVide(B)));
});

test('exports CSV : séparateur point-virgule, BOM, guillemets et virgule décimale', () => {
  const e = etat();
  e.questions[0].enonce = 'Texte ; avec "guillemets"';
  e.copies = [copie('c1', 'A', { q1: [0], q2: false, q3: '12,5', q4: [0] })];
  const b = R.csvBanque(e);
  assert.ok(b.startsWith('﻿Type;Énoncé'));
  assert.ok(b.includes('"Texte ; avec ""guillemets"""'));
  const r = R.csvReponses(e, { sessionId: 's1' });
  assert.equal(r.trim().split('\r\n').length, 5);
  assert.ok(r.includes('12,5;12,5 / douze et demi;juste;1'));
});

test('base intégrée : types, difficultés, couleurs et réglages cohérents', () => {
  assert.deepEqual(simple(B.types.map((t) => t.code)), ['qcm', 'vf', 'courte']);
  assert.equal(B.difficultes.length, 3);
  assert.equal(B.lettres.length, B.maxChoix);
  assert.ok(B.couleurs.length >= 6);
  assert.deepEqual(simple(R.normaliserReglages(B.reglages, B.reglages)), simple(B.reglages));
});
