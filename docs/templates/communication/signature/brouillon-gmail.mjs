// Signature graphique pour un brouillon créé par l'outil Gmail (create_draft) de l'assistant.
// L'outil supprime toute image distante d'un htmlBody : les images de la signature partent donc en pièces jointes
// intégrées (inline), référencées par cid:att0 à cid:att5, dans l'ordre de IMAGES ci-dessous.
// Source unique : netlify/lib/signature.mjs (SIGNATURE_HTML), images : assets/signature/.
//
// Usage (depuis la racine du dépôt) :
//   node docs/templates/communication/signature/brouillon-gmail.mjs            → HTML de la signature (cid)
//   node docs/templates/communication/signature/brouillon-gmail.mjs --json     → { html, attachments } pour create_draft
// Si d'autres pièces jointes accompagnent le mail, les placer APRÈS ces six images (les cid restent att0 à att5).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGNATURE_HTML } from '../../../../netlify/lib/signature.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const IMAGES = ['qme-logo', 'filet', 'instagram', 'linkedin', 'tiktok', 'youtube'];

let html = SIGNATURE_HTML.replace(/\n/g, '');
IMAGES.forEach((nom, i) => {
  const avant = html;
  html = html.replace(`https://qm-engineering.fr/assets/signature/${nom}.png`, `cid:att${i}`);
  if (html === avant) throw new Error(`Image ${nom}.png absente de SIGNATURE_HTML : mettre à jour IMAGES`);
});
if (/https:\/\/qm-engineering\.fr\/assets\/signature\//.test(html)) throw new Error('Une image de la signature n\'est pas convertie en cid');

const attachments = IMAGES.map((nom) => {
  const chemin = resolve(RACINE, 'assets/signature', `${nom}.png`);
  const sha = createHash('sha256').update(readFileSync(chemin)).digest('hex');
  return { content: `sha256:${sha}:${chemin}`, filename: `${nom}.png`, mimeType: 'image/png', inline: true };
});

process.stdout.write(process.argv.includes('--json') ? JSON.stringify({ html, attachments }, null, 1) + '\n' : html + '\n');
