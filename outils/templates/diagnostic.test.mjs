// Calcul du test « Combien vous coûte votre désorganisation ? » (assets/diagnostic.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync('assets/diagnostic.js', 'utf8'), ctx);
const { calculer, synthese } = ctx.DIAG;
const ETAPES = ['budget', 'taches', 'habitudes'];
const seul = (cle) => new Set(ETAPES.filter((c) => c !== cle));

test('budget : petits achats × 52 + abonnements non utilisés × 12', () => {
  assert.equal(calculer({ petits: '20', abonnements: '10' }, seul('budget')).euros, 20 * 52 + 10 * 12);
  assert.equal(calculer({ petits: '25' }, seul('budget')).euros, 1300);
  assert.equal(calculer({ abonnements: '88,34' }, seul('budget')).euros, 88.34 * 12);
  assert.ok(calculer({}, seul('budget')).erreur);
  assert.ok(calculer({ petits: '-3' }, seul('budget')).erreur);
});

test('tâches : minutes par jour × 365 / 60', () => {
  assert.equal(calculer({ minutes: '15' }, seul('taches')).heures, (15 * 365) / 60);
  assert.equal(calculer({ minutes: '0' }, seul('taches')).heures, 0);
  assert.ok(calculer({ minutes: '' }, seul('taches')).erreur);
  assert.ok(calculer({ minutes: 'abc' }, seul('taches')).erreur);
});

test('habitudes : (objectif − réel) × 52, jamais négatif', () => {
  const r = calculer({ habitude: 'sport', objectif: '3', reel: '2' }, seul('habitudes'));
  assert.equal(r.seances, 52);
  assert.equal(r.habitude, 'sport');
  assert.equal(calculer({ objectif: '3', reel: '5' }, seul('habitudes')).seances, 0);
  assert.ok(calculer({ objectif: '0', reel: '0' }, seul('habitudes')).erreur);
  assert.ok(calculer({ objectif: '9', reel: '1' }, seul('habitudes')).erreur);
});

test('synthèse : seuls les montants non nuls, dans l\'ordre euros, heures, séances', () => {
  const r = calculer({ petits: '5', minutes: '0', objectif: '3', reel: '1' });
  assert.deepEqual([...synthese(r)], ['260 €', '104 séances ratées']);
  const vide = calculer({}, new Set(ETAPES));
  assert.deepEqual([...synthese(vide)], []);
});
