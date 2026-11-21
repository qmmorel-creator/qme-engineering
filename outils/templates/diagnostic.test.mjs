// Calcul du test « Combien te coûte ta désorganisation ? » (assets/diagnostic.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync('assets/diagnostic.js', 'utf8'), ctx);
const { calculer, synthese } = ctx.DIAG;
const ETAPES = ['revisions', 'budget', 'taches', 'habitudes'];
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
  const r = calculer({ petits: '5', minutes: '0', objectif: '3', reel: '1' }, new Set(['revisions']));
  assert.deepEqual([...synthese(r)], ['260 €', '104 séances ratées']);
  const vide = calculer({}, new Set(ETAPES));
  assert.deepEqual([...synthese(vide)], []);
});

test('révisions : passages avant l\'examen selon la logique du Planning de révision (écarts 1, 3, 7, 14, 30 jours)', () => {
  const { passagesAvantExamen, INTERVALLES } = ctx.DIAG;
  const donnees = readFileSync('templates/revision/donnees.js', 'utf8');
  assert.match(donnees, new RegExp(`intervalles: \\[${[...INTERVALLES].join(', ')}\\]`), 'intervalles alignés sur le template');
  assert.equal(passagesAvantExamen(2), 1); // J+1, puis plus rien avant l'examen
  assert.equal(passagesAvantExamen(10), 3); // J+1, J+4, puis ramené à la veille (J+9)
  assert.equal(passagesAvantExamen(30), 5); // J+1, J+4, J+11, J+25, puis la veille (J+29)
  assert.equal(passagesAvantExamen(90), 6); // J+1, J+4, J+11, J+25, J+55, finale à J+88
  const r = calculer({ chapitres: '40', jours: '30' }, seul('revisions'));
  assert.equal(r.revisions.total, 200);
  assert.equal(r.euros + r.heures + r.seances, 0, 'hors total');
  assert.ok(calculer({ chapitres: '0', jours: '30' }, seul('revisions')).erreur);
  assert.ok(calculer({ chapitres: '40', jours: '1' }, seul('revisions')).erreur);
});
