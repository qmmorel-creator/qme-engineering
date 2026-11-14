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
