// netlify.toml doit rester un TOML valide : une erreur de syntaxe bloque tout déploiement Netlify
// (incident du 14/11/2026 : deux lignes « for = » dans un même bloc après une fusion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const texte = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');

test('netlify.toml : chaque bloc [[headers]] ou [[redirects]] a une seule clé de chaque nom', () => {
  const blocs = texte.split(/^\[\[/m).slice(1);
  for (const bloc of blocs) {
    // clés du niveau du bloc et de chaque sous-table, séparément
    for (const partie of bloc.split(/^\s*\[(?!\[)/m)) {
      const cles = [...partie.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1]);
      const doublons = cles.filter((c, i) => cles.indexOf(c) !== i);
      assert.deepEqual(doublons, [], `clé en double dans le bloc : [[${bloc.split('\n').slice(0, 2).join(' ').trim()}`);
    }
  }
});

test('netlify.toml : pas de marqueur de conflit ni de chemin en double', () => {
  assert.ok(!/^(<{7}|={7}|>{7})/m.test(texte));
  const chemins = [...texte.matchAll(/^\s*for = "([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(chemins.filter((c, i) => chemins.indexOf(c) !== i), []);
});

test('netlify.toml : chaque application de templates/ est en noindex et son sw.js en no-cache', async () => {
  const { readdirSync } = await import('node:fs');
  const racine = new URL('../../templates/', import.meta.url);
  const slugs = readdirSync(racine, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const manquants = slugs.filter((s) => {
    const bloc = texte.split(/^\[\[/m).find((b) => b.includes(`for = "/templates/${s}/*"`));
    return !bloc || !bloc.includes('X-Robots-Tag = "noindex, nofollow"') || !texte.includes(`for = "/templates/${s}/sw.js"`);
  });
  assert.deepEqual(manquants, []);
});
