// Espace acheteurs /connexion/ : la liste des templates (générée) est à jour et complète.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { donneesEspace } from '../connexion/generer.mjs';

test('connexion : PRODUITS et THEMES générés à jour (node outils/connexion/generer.mjs)', async () => {
  const page = await readFile(new URL('../../connexion/index.html', import.meta.url), 'utf8');
  const bloc = page.match(/\/\* ESPACE-DEBUT \*\/\nconst PRODUITS=(.*);\nconst THEMES=(.*);\n\/\* ESPACE-FIN \*\//);
  assert.ok(bloc, 'bloc ESPACE présent');
  const { produits, themes } = await donneesEspace();
  assert.deepEqual(JSON.parse(bloc[1]), produits, 'relancer node outils/connexion/generer.mjs');
  assert.deepEqual(JSON.parse(bloc[2]), themes, 'relancer node outils/connexion/generer.mjs');
  assert.deepEqual(Object.keys(produits).sort(), Object.keys(PRODUITS).sort());
  for (const [k, p] of Object.entries(produits)) {
    assert.equal(p.cle, `qme-${k.toLowerCase()}-code`);
    assert.notEqual(p.theme, 'autres', `thème du catalogue pour ${k}`);
  }
});

test('espace pack : mêmes données générées que /connexion/ (node outils/packs/generer.mjs)', async () => {
  const page = await readFile(new URL('../../packs/espace/index.html', import.meta.url), 'utf8');
  const bloc = page.match(/\/\* ESPACE-DEBUT \*\/\nconst PRODUITS=(.*);\nconst THEMES=(.*);\n\/\* ESPACE-FIN \*\//);
  assert.ok(bloc, 'bloc ESPACE présent dans packs/espace/index.html');
  const { produits, themes } = await donneesEspace();
  assert.deepEqual(JSON.parse(bloc[1]), produits, 'relancer node outils/packs/generer.mjs');
  assert.deepEqual(JSON.parse(bloc[2]), themes, 'relancer node outils/packs/generer.mjs');
  assert.ok(page.includes('/assets/espace.js?v=') && page.includes('/assets/espace.css?v='), 'composant commun chargé');
});
