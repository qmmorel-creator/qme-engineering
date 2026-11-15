// Catalogue des produits EN VENTE à l'instant présent (source : le code, pas la documentation).
// Template en vente : identifiant Gumroad dans PRODUITS. Pack en vente : fiche Gumroad (gumroad + permalien)
// et tous ses templates en vente. Croise avec docs/videos/journal.md pour proposer le produit le moins montré.
// Usage : node docs/videos/catalogue.mjs [--json]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { PACKS } from '../../netlify/lib/packs.mjs';
import { TEMPLATES } from '../../outils/packs/donnees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const enVente = (pre) => Boolean(PRODUITS[pre]?.gumroad);
const templates = Object.entries(PRODUITS).filter(([pre]) => enVente(pre)).map(([pre, p]) => ({
  type: 'template', code: pre, nom: p.nom, demo: `${p.url}?demo`, slug: p.url.split('/').filter(Boolean).pop(),
  prix: TEMPLATES[pre]?.prix ? TEMPLATES[pre].prix / 100 : null,
}));
const packs = Object.entries(PACKS).filter(([, p]) => p.gumroad && p.permalien && p.produits.length && p.produits.every(enVente)).map(([code, p]) => ({
  type: 'pack', code, nom: p.nom, slug: p.slug, page: `/packs/${p.slug}/`, templates: p.produits.map((x) => ({ code: x, nom: PRODUITS[x].nom, demo: `${PRODUITS[x].url}?demo` })),
}));

// Journal : lignes « | n° | date | code | type | ... »
const journal = existsSync(RACINE + 'docs/videos/journal.md') ? readFileSync(RACINE + 'docs/videos/journal.md', 'utf8') : '';
const faites = journal.split('\n').filter((l) => /^\|\s*\d{3}\s*\|/.test(l)).map((l) => { const c = l.split('|').map((x) => x.trim()); return { n: c[1], date: c[2], code: c[3], type: c[4] }; });
const derniere = (code) => faites.filter((f) => f.code === code).map((f) => f.date).sort().at(-1) || null;
const produits = [...templates, ...packs].map((p) => ({ ...p, videos: faites.filter((f) => f.code === p.code).length, derniereVideo: derniere(p.code) }))
  .sort((a, b) => a.videos - b.videos || String(a.derniereVideo).localeCompare(String(b.derniereVideo)));
const types = faites.map((f) => f.type);

if (process.argv.includes('--json')) console.log(JSON.stringify({ produits, derniersTypes: types.slice(-6) }, null, 2));
else {
  console.log(`${templates.length} templates et ${packs.length} pack(s) en vente. Derniers types de vidéo : ${types.slice(-6).join(', ') || 'aucun'}\n`);
  for (const p of produits) console.log(`${p.type === 'pack' ? 'PACK ' : ''}${p.code}\t${p.videos} vidéo(s)\t${p.derniereVideo || '—'}\t${p.nom}\t${p.demo || p.page}`);
}
