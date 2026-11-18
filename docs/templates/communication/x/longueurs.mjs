// node docs/templates/communication/x/longueurs.mjs : longueur X des posts du README (blocs ``` sous « ### X-nn »,
// textes de vidéo « Texte : `…` ») et de la bio. Une URL compte 23 caractères ; limite 280 (bio : 160).
import fs from 'node:fs';
const md = fs.readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const longueur = (t) => [...t.replace(/\b[a-z0-9-]+\.(?:fr|com)(?:\/[^\s]*)?/gi, 'x'.repeat(23))].length;
let ko = 0;
const verifier = (id, t, max = 280) => { const n = longueur(t.trim()); if (n > max) ko++; console.log(`${n > max ? 'TROP LONG' : 'ok'}  ${id} : ${n}/${max}`); };
for (const m of md.matchAll(/### (X-L?\d+)[^\n]*\n+```\n([\s\S]*?)```/g)) verifier(m[1], m[2]);
for (const m of md.matchAll(/\*\*(X-\d+)\*\*[^`]*?Texte : `([^`]+)`/g)) verifier(m[1] + ' (vidéo)', m[2]);
const bio = /\*\*Bio\*\*[^\n]*\n\s*`([^`]+)`/.exec(md); if (bio) verifier('bio', bio[1], 160);
process.exit(ko ? 1 : 0);
