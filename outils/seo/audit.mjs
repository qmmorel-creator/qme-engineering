// Audit SEO statique des pages publiques (celles du sitemap) : title, description, canonical, hreflang,
// titres, images sans alt, liens internes cassés, JSON-LD. Usage : node outils/seo/audit.mjs [--json]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pagesPubliques, RACINE } from '../sitemap/generer.mjs';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const texte = (s) => decode(s.replace(/<[^>]+>/g, ' '));

function cible(href) {
  const chemin = href.split('#')[0].split('?')[0];
  if (!chemin.startsWith('/') || chemin.startsWith('//') || chemin.startsWith('/api/')) return null;
  let f = join(RACINE, decodeURIComponent(chemin));
  if (chemin.endsWith('/')) f = join(f, 'index.html');
  return f;
}

export function auditer() {
  return pagesPubliques().map(({ fichier, loc }) => {
    const html = readFileSync(join(RACINE, fichier), 'utf8');
    const head = html.split('</head>')[0];
    const title = decode((head.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
    const desc = decode((head.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]);
    const lang = (html.match(/<html lang="([^"]+)"/) || [, ''])[1];
    const hreflang = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] }));
    const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => texte(m[1]));
    const niveaux = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
    const sauts = niveaux.filter((n, i) => i && n > niveaux[i - 1] + 1).length;
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const sansAlt = imgs.filter((t) => !/\balt="/.test(t)).length;
    const liens = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const casses = [...new Set(liens.filter((h) => { const f = cible(h); return f && !existsSync(f); }))];
    const jsonld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
      try { const d = JSON.parse(m[1]); return [].concat(d['@graph'] || d).map((x) => x['@type']).join('+'); } catch { return 'JSON invalide'; }
    });
    const faqVisible = /<div class="faq"|<details/.test(html);
    const lienSortant = liens.some((h) => /gumroad\.com/.test(h));
    return { fichier, loc, lang, title, tl: title.length, desc, dl: desc.length, hreflang, h1, sauts, imgs: imgs.length, sansAlt, liensInternes: liens.filter((h) => h.startsWith('/')).length, casses, jsonld, faqVisible, lienSortant, canonical: /rel="canonical"/.test(head) };
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const r = auditer();
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(r, null, 1) + '\n'); } else {
  const dup = (k) => { const m = new Map(); r.forEach((p) => m.set(p[k], [...(m.get(p[k]) || []), p.loc])); return [...m].filter(([v, l]) => v && l.length > 1); };
  console.log('pages', r.length);
  console.log('sans canonical', r.filter((p) => !p.canonical).map((p) => p.loc));
  console.log('title > 60', r.filter((p) => p.tl > 60).length, '| title < 30', r.filter((p) => p.tl < 30).length);
  console.log('desc > 160', r.filter((p) => p.dl > 160).length, '| desc < 70', r.filter((p) => p.dl < 70).length, '| sans desc', r.filter((p) => !p.dl).length);
  console.log('titles dupliqués', dup('title'));
  console.log('desc dupliquées', dup('desc'));
  console.log('h1 != 1', r.filter((p) => p.h1.length !== 1).map((p) => `${p.loc} (${p.h1.length})`));
  console.log('sauts de niveau', r.filter((p) => p.sauts).map((p) => `${p.loc} (${p.sauts})`));
  console.log('img sans alt', r.filter((p) => p.sansAlt).map((p) => `${p.loc} (${p.sansAlt})`));
  console.log('liens cassés', r.filter((p) => p.casses.length).map((p) => `${p.loc} -> ${p.casses.join(', ')}`));
  console.log('hreflang', r.filter((p) => p.hreflang.length).length, 'pages en ont');
  console.log('json-ld', r.filter((p) => p.jsonld.length).map((p) => `${p.loc}: ${p.jsonld}`));
}
}
