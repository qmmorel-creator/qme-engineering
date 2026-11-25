// node outils/concepts/registre-nexora.mjs [slug…] → éléments à passer à mutate_qme (MCP Nexora) :
//   { entity: "concept", action: "upsert_many", items: [...], idempotencyKey: "concepts-<date>-<slugs>" }
// Registre des concepts dans Nexora Optim › QME › Concepts (règle de CLAUDE.md, décision du 24/11/2026) : tout agent
// qui crée ou modifie une page concepts/<slug>/ l'enregistre (ou la met à jour) le jour même. Identifiant stable
// cpt-<slug> : rejouer ne crée pas de doublon. Le statut (envoyé, en discussion…) et le prospect lié se
// complètent ensuite dans Nexora ; ce script ne renseigne que ce que le dépôt sait (nom, titre, sujet, dates).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dossier = path.join(racine, 'concepts');
const registres = JSON.parse(fs.readFileSync(path.join(racine, 'outils/concepts/registres.json'), 'utf8'));
const demandes = process.argv.slice(2);
const slugs = fs.readdirSync(dossier).filter((s) => fs.existsSync(path.join(dossier, s, 'index.html')) && (!demandes.length || demandes.includes(s))).sort();
const dateGit = (f, premier) => {
  try {
    const l = execFileSync('git', ['log', '--follow', '--format=%as', '--', f], { cwd: racine, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return (premier ? l.at(-1) : l[0]) || '';
  } catch { return ''; }
};
const items = slugs.map((slug) => {
  const html = fs.readFileSync(path.join(dossier, slug, 'index.html'), 'utf8');
  const ent = (t) => t.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const titre = ent(/<title>([^<]*)<\/title>/.exec(html)?.[1] || '');
  const brut = titre.replace(/^(Concept (pour|for)|Devis)\s+/i, '').replace(/\s*[·|–-]\s*QME.*$/, '').replace(/^(l'|les |la |le )/i, '').trim();
  const deSlug = slug.split('-').map((m, i) => (i ? m : m[0].toUpperCase() + m.slice(1))).join(' ');
  const nom = registres[slug]?.nom || (brut && !brut.includes(' · ') ? brut[0].toUpperCase() + brut.slice(1) : deSlug);
  const pdfs = fs.readdirSync(path.join(dossier, slug)).filter((f) => f.endsWith('.pdf'));
  const pdf = pdfs.find((f) => /concept/i.test(f)) || pdfs.find((f) => !/devis|proposition/i.test(f));
  const r = registres[slug];
  return {
    id: `cpt-${slug}`, slug, nom,
    ...(r ? { titre: r.titre, sujet: r.sujet, source: 'outils/concepts/registres.mjs' } : { source: 'concepts/' + slug }),
    ...(pdf ? { pdf: `https://qm-engineering.fr/concepts/${slug}/${pdf}` } : {}),
    ...(fs.existsSync(path.join(dossier, slug, 'demo')) ? { demoUrl: `https://qm-engineering.fr/concepts/${slug}/demo/` } : {}),
    dateCreation: dateGit(`concepts/${slug}/index.html`, true),
  };
});
process.stdout.write(JSON.stringify(items, null, 2) + '\n');
