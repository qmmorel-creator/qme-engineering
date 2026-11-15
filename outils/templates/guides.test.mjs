// Rubrique /guides/ : calculateur du guide « budget à deux » (moteur de Budget commun), conventions des pages
// (mention datée, Article JSON-LD, lien vers le catalogue suivi par GoatCounter) et maillage (pied de page,
// liens « Lire le guide » des pages catalogue).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { pagesPubliques, RACINE } from '../sitemap/generer.mjs';

const lire = (f) => readFileSync(join(RACINE, f), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(lire('templates/budget-commun/regles.js'), ctx);
vm.runInContext(lire('assets/guides.js'), ctx);
const calculer = (...saisies) => JSON.parse(JSON.stringify(ctx.QMEGuides.calculer(ctx.BCM, ...saisies)));

test('calculateur : 2 400 / 1 600 / 1 500 → 750 / 750 à 50/50, 900 / 600 au prorata', () => {
  const r = calculer('2 400', '1 600', '1 500');
  assert.deepEqual(r.egale, [75000, 75000]);
  assert.deepEqual(r.prorata, [90000, 60000]);
  assert.deepEqual(r.resteProrata, [150000, 100000]);
});

test('calculateur : les centimes tombent juste (2 345,67 / 1 234,56 / 999,99)', () => {
  const r = calculer('2 345,67', '1 234,56', '999,99');
  assert.deepEqual(r.egale, [50000, 49999]);
  assert.deepEqual(r.prorata, [65517, 34482]);
  for (const mode of ['egale', 'prorata']) assert.equal(r[mode][0] + r[mode][1], 99999);
});

test('calculateur : somme exacte sur des saisies variées, erreurs lisibles', () => {
  for (const [a, b, d] of [['1 999,99', '2 000,01', '0,03'], ['3 100', '1 450,50', '1 234,57'], ['1', '2', '10']]) {
    const r = calculer(a, b, d);
    const total = ctx.BCM.versCentimes(d);
    assert.equal(r.egale[0] + r.egale[1], total);
    assert.equal(r.prorata[0] + r.prorata[1], total);
  }
  assert.ok(calculer('abc', '1 600', '1 500').erreur);
  assert.ok(calculer('0', '1 600', '1 500').erreur);
  assert.ok(calculer('2 400', '1 600', '0').erreur);
});

const guides = readdirSync(join(RACINE, 'guides'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const graphe = (html) => JSON.parse(html.match(/<script type="application\/ld\+json" id="donnees-structurees">([\s\S]*?)<\/script>/)[1])['@graph'];

test('chaque guide : mention datée, un H1, Article + BreadcrumbList, lien catalogue suivi, listé dans /guides/', () => {
  assert.ok(guides.length >= 3);
  const index = lire('guides/index.html');
  for (const slug of guides) {
    const html = lire(`guides/${slug}/index.html`);
    assert.match(html, /<p class="guide-mention">Guide d'information générale, à jour au \d{2}\/\d{2}\/\d{4}\. /, slug);
    assert.equal(html.match(/<h1[\s>]/g).length, 1, slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://qm-engineering\\.fr/guides/${slug}/">`));
    const types = graphe(html).map((x) => x['@type']);
    assert.ok(types.includes('Article') && types.includes('BreadcrumbList'), slug);
    assert.match(html, new RegExp(`href="/catalogue/[^"]+/" data-goatcounter-click="guide-${slug}-catalogue"`), slug);
    assert.ok(index.includes(`href="/guides/${slug}/"`), `${slug} absent de /guides/`);
    assert.doesNotMatch(html, /<link rel="alternate" hreflang=/, `${slug} : pas de version anglaise, donc pas de hreflang`);
  }
});

test('pied de page : lien vers /guides/ sur toutes les pages publiques françaises', () => {
  const sans = pagesPubliques().filter((p) => !p.fichier.startsWith('en')).filter((p) => !lire(p.fichier).includes('<a href="/guides/">Guides</a>')).map((p) => p.fichier);
  assert.deepEqual(sans, []);
});

test('pages catalogue concernées : lien « Lire le guide »', () => {
  for (const [slug, guide] of [['impayes', 'facture-impayee'], ['reserves', 'levee-des-reserves'], ['travaux', 'levee-des-reserves'], ['budget-commun', 'budget-couple-50-50-ou-prorata']]) {
    assert.match(lire(`catalogue/${slug}/index.html`), new RegExp(`<a href="/guides/${guide}/"[^>]*>Lire le guide : `), slug);
  }
});
