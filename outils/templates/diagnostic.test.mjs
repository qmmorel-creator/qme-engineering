// Calcul du test « Combien vous coûte votre désorganisation ? » (assets/diagnostic.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
for (const f of ['templates/tjm/calculs.js', 'assets/diagnostic.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
const { calculer, joursFacturables } = ctx.DIAG;
const toutSauf = (cle) => new Set(['abonnements', 'tjm', 'retards', 'couple'].filter((c) => c !== cle));

test('2027 : 254 jours ouvrés, 183 facturables avec 25 jours de congés et 1 jour non facturable par semaine (Reel IG-46)', () => {
  assert.equal(ctx.TJM_CALCUL.joursOuvres(2027).ouvres, 254);
  assert.equal(joursFacturables(254, 25, 1), 183);
});

test('abonnements : montant mensuel × 12', () => {
  const r = calculer({ abonnements: '88,34' }, toutSauf('abonnements'));
  assert.equal(Math.round(r.total * 100), 106008);
});

test('TJM divisé par les jours ouvrés : manque à gagner = CA × (1 − facturables / ouvrés)', () => {
  const r = calculer({ methode: 'ouvres', ca: '60 000', conges: '25', nonfact: '1' }, toutSauf('tjm'));
  assert.ok(Math.abs(r.total - 60000 * (1 - 183 / 254)) < 1e-6);
  const bon = calculer({ methode: 'facturables', ca: '60000', conges: '25', nonfact: '1' }, toutSauf('tjm'));
  assert.equal(bon.total, 0);
});

test('retards : 40 € par facture si l\'indemnité n\'est pas réclamée, rien sinon', () => {
  assert.equal(calculer({ retards: '8', indemnite: 'inconnue' }, toutSauf('retards')).total, 320);
  assert.equal(calculer({ retards: '8', indemnite: 'oui' }, toutSauf('retards')).total, 0);
  assert.ok(calculer({ retards: '8' }, toutSauf('retards')).erreur);
  assert.ok(calculer({ retards: '2,5', indemnite: 'non' }, toutSauf('retards')).erreur);
});

test('couple : écart 50/50 contre prorata (exemple du guide : 750 € contre 600 €), hors total', () => {
  const r = calculer({ regle: 'egale', revenu1: '2 400', revenu2: '1 600', depenses: '1 500' }, toutSauf('couple'));
  assert.equal(r.total, 0);
  assert.equal(r.couple.egale, 750);
  assert.equal(r.couple.prorata1, 900);
  assert.equal(r.couple.prorata2, 600);
  assert.equal(r.couple.ecartAn, 1800);
});

test('saisies invalides ou manquantes : message d\'erreur, jamais de NaN', () => {
  assert.ok(calculer({ abonnements: 'abc' }, toutSauf('abonnements')).erreur);
  assert.ok(calculer({ abonnements: '-5' }, toutSauf('abonnements')).erreur);
  assert.ok(calculer({ methode: 'ouvres', ca: '', conges: '25', nonfact: '1' }, toutSauf('tjm')).erreur);
  const vide = calculer({}, toutSauf('aucune'));
  assert.equal(vide.total, 0);
});
