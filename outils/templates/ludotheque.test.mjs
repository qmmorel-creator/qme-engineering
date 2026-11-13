// Tests du moteur de Ludothèque (templates/ludotheque/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/ludotheque/donnees.js', '../../templates/ludotheque/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.JDS;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const jeu = (id, extra = {}) => ({ id, nom: id, statut: 'possede', joueursMin: 2, joueursMax: 4, duree: 45, complexite: 2, age: 8, categories: [], mecaniques: [], ...extra });
const etat = (jeux, parties = []) => R.normaliser({ jeux, parties });

test('catalogue d\'exemple : fictif, complet, cohérent', () => {
  assert.ok(BASE.exemples.length >= 20);
  assert.equal(new Set(BASE.exemples.map((x) => x.nom)).size, BASE.exemples.length);
  for (const x of BASE.exemples) {
    assert.ok(x.min >= 1 && x.max >= x.min, x.nom);
    assert.ok(x.complexite >= 1 && x.complexite <= 5);
    for (const c of x.categories) assert.ok(BASE.categories.some((y) => y.id === c), `${x.nom} : ${c}`);
    for (const m of x.mecaniques) assert.ok(BASE.mecaniques.includes(m), `${x.nom} : ${m}`);
  }
  assert.match(BASE.avertissement, /inventés/);
});

test('statistiques d\'un jeu : nombre, dernière partie, 12 mois, durée moyenne', () => {
  const e = etat([jeu('a')], [
    { jeuId: 'a', date: '2026-11-01', duree: 40 }, { jeuId: 'a', date: '2026-06-01', duree: 50 }, { jeuId: 'a', date: '2025-01-10' },
  ]);
  const s = R.statsJeu(e.jeux[0], e.parties, AUJ);
  assert.deepEqual(simple(s), { nb: 3, derniere: '2026-11-01', joursDepuis: 12, douzeMois: 2, dureeMoyenne: 45 });
  assert.deepEqual(simple(R.statsJeu(jeu('z'), [], AUJ)), { nb: 0, derniere: null, joursDepuis: null, douzeMois: 0, dureeMoyenne: null });
});

test('jeux à ressortir : anciens et non joués depuis 12 mois', () => {
  const parties = [{ jeuId: 'b', date: '2025-06-01' }, { jeuId: 'c', date: '2026-10-01' }];
  const e = etat([jeu('a', { acquisLe: '2024-01-01' }), jeu('b'), jeu('c'), jeu('d', { acquisLe: '2026-10-01' }), jeu('e', { statut: 'decouvrir' })], parties);
  const r = e.jeux.filter((j) => R.aRessortir(j, e.parties, AUJ)).map((j) => j.id);
  assert.deepEqual(simple(r), ['a', 'b'], 'jamais joué (a), dernière partie > 12 mois (b) ; c récent, d acquis récemment, e non possédé');
});

test('statistiques de collection : taux d\'utilisation, top, mois, catégories', () => {
  const e = etat([jeu('a', { categories: ['strategie'], extensions: [{ nom: 'X' }, { nom: 'Y', possede: false }] }), jeu('b', { categories: ['ambiance'], pretA: 'Léa' }), jeu('c'), jeu('w', { statut: 'decouvrir' })], [
    { jeuId: 'a', date: '2026-11-10' }, { jeuId: 'a', date: '2026-10-05' }, { jeuId: 'b', date: '2026-09-01' }, { jeuId: 'a', date: '2025-01-01' },
  ]);
  const s = R.statistiques(e, AUJ);
  assert.equal(s.possedes, 3); assert.equal(s.decouvrir, 1); assert.equal(s.extensions, 1); assert.equal(s.pretes, 1);
  assert.equal(s.parties, 4); assert.equal(s.parties12, 3);
  assert.equal(s.tauxUtilisation, 67);
  assert.equal(s.top[0].jeu.id, 'a'); assert.equal(s.top[0].nb, 3);
  assert.deepEqual(simple(s.jamais.map((j) => j.id)), ['c']);
  assert.equal(s.mois.length, 12); assert.equal(s.mois.at(-1).mois, '2026-11'); assert.equal(s.mois.at(-1).nb, 1); assert.equal(s.mois[0].mois, '2025-12');
  assert.deepEqual(simple(s.parCategorie.map((x) => [x.id, x.jeux, x.parties])), [['strategie', 1, 3], ['ambiance', 1, 1]]);
  assert.equal(R.statistiques(etat([]), AUJ).tauxUtilisation, null);
});

test('suggestions : filtres stricts', () => {
  const e = etat([
    jeu('ok'), jeu('trop-long', { duree: 120 }), jeu('limite', { duree: 51 }), jeu('solo', { joueursMin: 1, joueursMax: 1 }),
    jeu('expert', { complexite: 5 }), jeu('ados', { age: 14 }), jeu('prete', { pretA: 'Léa' }), jeu('souhait', { statut: 'decouvrir' }),
  ]);
  const ids = (c) => simple(R.suggestions(e, c, AUJ).map((x) => x.jeu.id)).sort();
  assert.deepEqual(ids({ joueurs: 3, temps: 45 }), ['ados', 'expert', 'limite', 'ok'], 'tolérance de 15 % sur la durée (51 ≤ 51,75)');
  assert.deepEqual(ids({ joueurs: 3, temps: 45, complexiteMax: 3, age: 10 }), ['limite', 'ok']);
  assert.deepEqual(ids({ joueurs: 1 }), ['solo']);
  assert.deepEqual(ids({ joueurs: 12 }), []);
  assert.deepEqual(ids({}), ['ados', 'expert', 'limite', 'ok', 'solo', 'trop-long']);
});

test('suggestions : score et raisons', () => {
  const e = etat([
    jeu('aime', { note: 5, categories: ['cooperatif'], mecaniques: ['Coopération'] }),
    jeu('recent', { note: 5, categories: ['cooperatif'] }),
    jeu('neutre'),
  ], [{ jeuId: 'recent', date: '2026-11-10' }, { jeuId: 'aime', date: '2026-03-01' }, { jeuId: 'neutre', date: '2026-10-20' }]);
  const r = R.suggestions(e, { joueurs: 3, temps: 60, categories: ['cooperatif'], mecaniques: ['Coopération'] }, AUJ);
  // recent : 50 + 15 + 20 − 20 + 10 = 75 ; neutre : 50 + 10 = 60.
  assert.deepEqual(simple(r.map((x) => x.jeu.id)), ['aime', 'recent', 'neutre']);
  assert.deepEqual(simple(r.map((x) => x.score)), [125, 75, 60]);
  // aime : 50 + 15 + 10 + 20 (note) + 20 (pas joué depuis 257 j) + 10 (45 ≥ 30) = 125
  assert.equal(r[0].score, 125);
  assert.ok(r[0].raisons.includes('ta note : 5/5'));
  assert.ok(r[0].raisons.some((x) => /pas joué depuis 257 jours/.test(x)));
  assert.ok(r[1].raisons.includes('joué cette semaine'));
  const long = R.suggestions(etat([jeu('x', { duree: 66 })]), { temps: 60 }, AUJ)[0];
  assert.ok(long.raisons.some((x) => /plus long que prévu/.test(x)));
});

test('validation d\'une fiche de jeu', () => {
  const v = (x) => R.validerJeu({ ...R.normaliserJeu(jeu('a')), ...x });
  assert.equal(v({}), null);
  assert.match(v({ nom: '' }), /nom/);
  assert.match(v({ joueursMin: 0 }), /minimum/);
  assert.match(v({ joueursMin: 4, joueursMax: 2 }), /maximum/);
  assert.match(v({ duree: 0 }), /Durée/);
  assert.match(v({ complexite: 6 }), /Complexité/);
  assert.match(v({ age: -1 }), /Âge/);
  assert.match(v({ joueursMin: 2.5 }), /minimum/);
});

test('normalisation : sauvegarde abîmée, parties orphelines', () => {
  const e = R.normaliser({ jeux: [{ id: 'a', nom: '', statut: 'zz', joueursMin: 5, joueursMax: 2, duree: -3, complexite: 9, categories: ['strategie', 'inconnue', 'strategie'], note: 8, pretLe: '2026-01-01' }], parties: [{ jeuId: 'a', date: '2026-02-30' }, { jeuId: 'fantome', date: '2026-01-01' }, { jeuId: 'a', date: '2026-01-02', joueurs: 0 }] });
  const j = e.jeux[0];
  assert.equal(j.nom, 'Jeu sans nom'); assert.equal(j.statut, 'possede');
  assert.equal(j.joueursMin, 5); assert.equal(j.joueursMax, 5);
  assert.equal(j.duree, 30); assert.equal(j.complexite, 2); assert.equal(j.note, 0);
  assert.deepEqual(simple(j.categories), ['strategie']);
  assert.equal(j.pretLe, null, 'date de prêt sans emprunteur effacée');
  assert.equal(e.parties.length, 1); assert.equal(e.parties[0].joueurs, null);
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('exports CSV', () => {
  const e = etat([jeu('a', { nom: 'Jeu; test', categories: ['strategie'], mecaniques: ['Draft'], extensions: [{ nom: 'Ext 1' }] })], [{ jeuId: 'a', date: '2026-11-01', joueurs: 3, gagnant: 'Léa' }]);
  const j = R.csvJeux(e, AUJ);
  assert.deepEqual(simple(j[1].slice(0, 10)), ['Jeu; test', 'Possédé', 2, 4, 45, 2, 8, 'Stratégie', 'Draft', 'Ext 1']);
  assert.equal(j[1][15], 1); assert.equal(j[1][16], '2026-11-01');
  assert.deepEqual(simple(R.csvParties(e)[1]), ['2026-11-01', 'Jeu; test', 3, '', 'Léa', '', '']);
});
