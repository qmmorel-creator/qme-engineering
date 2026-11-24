// Vérifie le calcul affiché dans IG-217 : node docs/templates/communication/formats-test/IG-217/verifier.mjs
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
runInThisContext(readFileSync(new URL('./calcul.js', import.meta.url), 'utf8'));
const r = globalThis.calculFleuriste(globalThis.FLEURISTE);
console.log(JSON.stringify(globalThis.FLEURISTE), '\n', r);
const attendu = { prevision: 200, besoin: 236, utilisable: 61, aCouvrir: 175, aCommander: 191, bottes: 8, tiges: 200 };
for (const [k, v] of Object.entries(attendu)) if (r[k] !== v) { console.error('ÉCART', k, r[k], v); process.exit(1); }
console.log('OK : chiffres de la vidéo conformes au calcul');
