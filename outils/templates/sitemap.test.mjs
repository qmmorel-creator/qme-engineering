// sitemap.xml doit lister exactement les pages publiques : relancer node outils/sitemap/generer.mjs sinon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE, pagesPubliques } from '../sitemap/generer.mjs';

const sitemap = readFileSync(join(RACINE, 'sitemap.xml'), 'utf8');
const dansSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();

test('sitemap.xml : à jour avec les pages publiques (node outils/sitemap/generer.mjs)', () => {
  assert.deepEqual(dansSitemap, pagesPubliques().map((p) => p.loc));
});

test('robots.txt : déclare le sitemap et ne bloque pas les pages publiques', () => {
  const robots = readFileSync(join(RACINE, 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/qm-engineering\.fr\/sitemap\.xml$/m);
  for (const r of [/^Disallow: \/$/m, /^Disallow: \/catalogue/m, /^Disallow: \/templates\/$/m, /^Disallow: \/packs\/$/m]) assert.doesNotMatch(robots, r);
});
