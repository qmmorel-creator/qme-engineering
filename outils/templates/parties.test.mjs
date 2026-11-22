// Pages /pro/ et /perso/ (outils/parties/generer.mjs) : à jour avec le catalogue et /packs/, filtre fixé, packs de la partie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pagePartie, PARTIES } from '../parties/generer.mjs';

const lire = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

test('pages /pro/ et /perso/ : régénérées depuis le catalogue et /packs/', () => {
  const catalogue = lire('templates/index.html'), packs = lire('packs/index.html');
  for (const pour of Object.keys(PARTIES)) {
    assert.equal(lire(`${pour}/index.html`), pagePartie(pour, catalogue, packs), `${pour} : relancer node outils/packs/generer.mjs`);
  }
});

test('pages /pro/ et /perso/ : filtre fixé, packs et thèmes de la seule partie, adresse canonique', () => {
  for (const pour of Object.keys(PARTIES)) {
    const s = lire(`${pour}/index.html`), autre = pour === 'pro' ? 'perso' : 'pro';
    assert.ok(s.includes(`data-pour-fixe="${pour}"`), pour);
    assert.ok(s.includes(`<link rel="canonical" href="https://qm-engineering.fr/${pour}/">`), pour);
    assert.ok(!s.includes('aria-label="Usage"'), `${pour} : sélecteur Tous / Pro / Perso retiré`);
    assert.ok(!new RegExp(`class="puce"[^>]*data-pour="${autre}"`).test(s), `${pour} : thèmes de l'autre partie retirés`);
    const cartes = [...s.matchAll(/<a class="pack-carte[^>]*data-pour="([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(cartes.length >= 3 && cartes.every((p) => p === pour), `${pour} : packs de la partie seulement`);
    assert.ok(s.includes(`<a href="/${pour}/" aria-current="page">`), `${pour} : menu`);
  }
});

test('template des deux parties (pour: \'pro perso\') : présent sur /pro/ et /perso/, thème et phrase de la partie', async () => {
  const { TEMPLATES, publics, phrasePour } = await import('../packs/donnees.mjs');
  const doubles = Object.values(TEMPLATES).filter((t) => publics(t).length > 1);
  assert.ok(doubles.some((t) => t.slug === 'candidatures'), 'Suivi de candidatures dans les deux parties');
  const catalogue = lire('templates/index.html');
  for (const t of doubles) {
    const carte = catalogue.match(new RegExp(`<li class="carte[^"]*" data-slug="${t.slug}"[^>]*>`))?.[0] || '';
    assert.match(carte, /data-pour="pro perso"/, `${t.slug} : data-pour`);
    const themes = carte.match(/data-theme="([a-z -]+)"/)[1].split(' ');
    for (const pour of ['pro', 'perso']) {
      const s = lire(`${pour}/index.html`);
      assert.ok(themes.some((id) => new RegExp(`class="puce"[^>]*data-pour="${pour}" data-theme="${id}"`).test(s)), `${t.slug} : un thème de la partie ${pour}`);
      assert.ok(s.includes(`<span class="phrase">${phrasePour(t, pour)}</span>`), `${t.slug} : phrase ${pour}`);
    }
  }
});
