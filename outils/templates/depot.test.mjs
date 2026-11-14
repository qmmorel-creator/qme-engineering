import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('aucun marqueur de conflit git dans les fichiers suivis', () => {
  const racine = new URL('../../', import.meta.url);
  let sortie = '';
  try {
    sortie = execSync("git grep -n -E '^(<<<<<<< |>>>>>>> )' -- '*.html' '*.js' '*.mjs' '*.cjs' '*.css' '*.md' '*.json' '*.toml'", { cwd: racine, encoding: 'utf8' });
  } catch (e) { sortie = e.stdout || ''; }
  assert.equal(sortie.trim(), '', `marqueurs de conflit :\n${sortie}`);
});
