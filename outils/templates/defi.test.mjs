// Défi à envoyer à un pote (assets/defi.js) et données du quiz (assets/quiz-qme.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ URLSearchParams });
for (const f of ['assets/quiz-qme.js', 'assets/defi.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const { questions, nettoyerPrenom, lireDefi, lienDefi, verdict, comparer } = ctx.DEFI;
const Q = questions(ctx.QUIZ_QME);

test('quiz : 8 questions jouables, 4 choix chacune, bonne réponse valide, sondage exclu', () => {
  assert.equal(Q.length, 8);
  for (const q of Q) {
    assert.equal(q.choix.length, 4, q.slug);
    assert.ok(q.bonne >= 0 && q.bonne < 4, q.slug);
    assert.ok(q.produit && q.slugProduit, q.slug);
  }
  assert.ok(ctx.QUIZ_QME.some((q) => q.bonne === null), 'le sondage reste dans le quiz (stories)');
});

test('quiz : chiffres de calcul cohérents avec leurs réponses', () => {
  const par = Object.fromEntries(ctx.QUIZ_QME.map((q) => [q.slug, q]));
  assert.equal(5 * 5 * 52, 1300);
  assert.match(par['budget-snack'].choix[par['budget-snack'].bonne], /1\s300/);
  assert.equal(1200 * 0.3, 360);
  assert.match(par['budget-50-30-20'].choix[par['budget-50-30-20'].bonne], /360/);
  assert.equal(40 * 5, 200);
  assert.equal(par['revision-200'].choix[par['revision-200'].bonne], '200');
});

test('lien : prénom nettoyé et score, lu à l\'identique ; adresse invalide ignorée', () => {
  const url = new URL(lienDefi('Léa <b>', 6));
  assert.equal(url.origin + url.pathname, 'https://qm-engineering.fr/defi/');
  const d = lireDefi(url.search, 8);
  assert.equal(d.prenom, 'Léa b');
  assert.equal(d.score, 6);
  assert.equal(lireDefi('', 8), null);
  assert.equal(lireDefi('?s=9', 8), null);
  assert.equal(lireDefi('?s=-1', 8), null);
  assert.equal(lireDefi('?s=abc', 8), null);
  assert.equal(lireDefi('?s=0', 8).score, 0);
  assert.equal(nettoyerPrenom('  Jean-Éric  O\'Neil 123 '), 'Jean-Éric O\'Neil');
  assert.equal(nettoyerPrenom('x'.repeat(40)).length, 20);
  assert.ok(!new URL(lienDefi('', 3)).searchParams.has('de'));
});

test('verdict et duel', () => {
  assert.match(verdict(8, 8), /Sans faute/);
  assert.match(verdict(6, 8), /Très bien/);
  assert.match(verdict(4, 8), /Pas mal/);
  assert.match(verdict(1, 8), /Aïe/);
  assert.equal(comparer(7, { prenom: 'Léa', score: 6 }).issue, 'gagne');
  assert.equal(comparer(5, { prenom: '', score: 6 }).texte, 'Ton pote gagne : 6 contre 5. Revanche ?');
  assert.equal(comparer(6, { prenom: 'Léa', score: 6 }).issue, 'egalite');
});
