// Tests des outils purs communs à la gamme T69–T77 (templates/commun/outils.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../../templates/commun/outils.js', import.meta.url), 'utf8'), ctx);
const O = ctx.window.QME_OUTILS;

test('lireNombre : saisies françaises, unités en suffixe, refus des négatifs et du texte', () => {
  assert.equal(O.lireNombre('12,5'), 12.5);
  assert.equal(O.lireNombre('12.5'), 12.5);
  assert.equal(O.lireNombre(' 1 234,56 '), 1234.56);
  assert.equal(O.lireNombre('3 m²'), 3);
  assert.equal(O.lireNombre('0'), 0);
  assert.equal(O.lireNombre(',5'), 0.5);
  assert.equal(O.lireNombre(''), null);
  assert.equal(O.lireNombre('abc'), null);
  assert.equal(O.lireNombre('1,2,3'), null);
  assert.equal(O.lireNombre('-4'), null);
  assert.equal(O.lireNombre('-4', { negatif: true }), -4);
  assert.equal(O.lireNombre(Infinity), null);
  assert.equal(O.lireNombre(7), 7);
});

test('montants en centimes et affichage', () => {
  assert.equal(O.lireMontant('12,99'), 1299);
  assert.equal(O.lireMontant('12.99 €'), 1299);
  assert.equal(O.lireMontant('1 234,5'), 123450);
  assert.equal(O.lireMontant('12,999'), null);
  assert.equal(O.lireMontant('-3'), null);
  assert.equal(O.euros(123456), '1 234,56 €');
  assert.equal(O.euros(-500), '−5,00 €');
  assert.equal(O.euros(150049, { centimes: false }), '1 500 €');
  assert.equal(O.euros(null), '–');
  assert.equal(O.saisieMontant(1205), '12,05');
});

test('arrondi et format', () => {
  assert.equal(O.arrondi(0.1 + 0.2, 2), 0.3);
  assert.equal(O.arrondi(1.005, 2), 1.01);
  assert.equal(O.fmtNombre(1234.5), '1 234,5');
  assert.equal(O.fmtNombre(2, { dec: 2, fixe: true }), '2,00');
});

test('dates : validité, ajout de jours et de mois', () => {
  assert.ok(O.estDate('2028-02-29'));
  assert.ok(!O.estDate('2026-02-29'));
  assert.ok(!O.estDate('13/11/2026'));
  assert.equal(O.ajout('2026-12-31', 1), '2027-01-01');
  assert.equal(O.ecart('2026-11-13', '2026-12-25'), 42);
  assert.equal(O.ajoutMois('2026-01-31', 1), '2026-02-28');
});

test('normalisation : bornes et valeurs par défaut', () => {
  assert.equal(O.entier('12', 0, 20, 5), 12);
  assert.equal(O.entier('99', 0, 20, 5), 5);
  assert.equal(O.nombre('2,5', 0, 10, 1), 2.5);
  assert.equal(O.nombre('x', 0, 10, 1), 1);
  assert.equal(O.texte('  a\u0001b  ', 10), 'ab');
  assert.equal(O.texte('abcdef', 3), 'abc');
  assert.equal(O.choix('z', ['a', 'b'], 'a'), 'a');
  assert.equal(O.dateOuNull('2026-02-30'), null);
  assert.match(O.idValide('<script>'), /^[\w-]+$/);
  assert.equal(O.idValide('abc-1'), 'abc-1');
});

test('CSV : séparateur, guillemets, BOM et aller-retour', () => {
  const lignes = [['Nom', 'Valeur'], ['a;b', '1,5'], ['dit "oui"', 'ligne\nsuivante']];
  const csv = O.versCsv(lignes);
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(JSON.parse(JSON.stringify(O.lireCsv(csv))), lignes);
  assert.equal(O.nombreCsv(1.23456, 3), '1,235');
  assert.equal(O.centimesCsv(1299), '12,99');
});

test('taille d\'un état', () => {
  assert.equal(O.tailleJson({ a: 'é' }), 10);
  assert.ok(O.TAILLE_MAX < 900000);
});
