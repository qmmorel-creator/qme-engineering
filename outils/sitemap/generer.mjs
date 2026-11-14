// Génère sitemap.xml : toutes les pages publiques (index.html hors applications, administration,
// connexion, espace client, concepts et docs), à leur URL canonique, avec la date du dernier commit.
// Usage : node outils/sitemap/generer.mjs  (à relancer à chaque nouvelle page, par exemple un nouveau template)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const IGNORES = new Set(['node_modules', 'docs', '.claude', '.git', 'netlify', 'outils', 'assets']);
const EXCLUS = [/^admin\//, /^concepts\//, /^packs\/espace\//, /^connexion\//, /^templates\/[^/]+\//];

export function pagesPubliques() {
  const pages = [];
  (function parcourir(dossier) {
    for (const nom of readdirSync(dossier)) {
      if (IGNORES.has(nom)) continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (nom === 'index.html') {
        const rel = relative(RACINE, dossier).split('\\').join('/');
        const url = rel ? rel + '/' : '';
        if (EXCLUS.some((r) => r.test(url))) continue;
        const html = readFileSync(chemin, 'utf8');
        if (/name="robots"[^>]*noindex/.test(html)) continue;
        const canon = html.match(/rel="canonical" href="([^"]+)"/);
        pages.push({ fichier: relative(RACINE, chemin), loc: canon ? canon[1] : `https://qm-engineering.fr/${url}` });
      }
    }
  })(RACINE);
  return pages.sort((a, b) => a.loc.localeCompare(b.loc));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lignes = pagesPubliques().map(({ fichier, loc }) => {
    let date = '';
    try { date = execFileSync('git', ['log', '-1', '--format=%cs', '--', fichier], { cwd: RACINE, encoding: 'utf8' }).trim(); } catch {}
    return `  <url><loc>${loc}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  });
  writeFileSync(join(RACINE, 'sitemap.xml'),
    ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...lignes, '</urlset>', ''].join('\n'));
  console.log(`sitemap.xml : ${lignes.length} pages`);
}
