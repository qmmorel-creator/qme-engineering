// Extraction des textes à traduire d'un template : premiers arguments littéraux de tr('…') et clés
// ajoutées à la main (pluriels, listes passées par variable). Utilisé par les tests de traduction.
import { readFileSync } from 'node:fs';

export function clesTraduction(fichier, supplementaires = []) {
  const src = readFileSync(fichier, 'utf8');
  const cles = new Set(supplementaires);
  for (const m of src.matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) cles.add(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  return [...cles];
}
