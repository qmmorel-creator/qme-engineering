// Pages /pro/ et /perso/ (décision de Quentin du 22/11/2026, docs/templates/RATIONALISATION.md § 3) : le catalogue
// /templates/ filtré sur une partie, avec son accroche et ses packs. Construites depuis templates/index.html et
// packs/index.html (déjà générés) : à relancer après eux. outils/packs/generer.mjs l'appelle à la fin.
// Usage : node outils/parties/generer.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { avecDonnees } from '../seo/donnees-structurees.mjs';
import { TEMPLATES, phrasePour } from '../packs/donnees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

export const PARTIES = {
  pro: {
    titre: 'Templates pour les pros · QME',
    description: 'Outils prêts à l’emploi pour indépendants, TPE, PME, chantiers, associations et écoles : devis, CRM, planning, maintenance, RH. Achat unique, essai 14 jours.',
    sourcil: 'Pour votre activité',
    h1: 'Les outils de votre activité, <mark>prêts en une minute.</mark>',
    lead: '<strong>Devis, clients, chantiers, équipe, maintenance, trésorerie :</strong> des applications en ligne prêtes à l’emploi pour les indépendants, les TPE et PME, les chantiers, les associations et les écoles. Une clé, tous vos appareils, achat unique. Besoin d’un outil fait pour votre métier ? <a href="/sur-mesure/">Le sur mesure</a>.',
    catalogue: 'Les outils pour les pros',
    packs: 'Les packs pour les pros',
    autre: ['/perso/', 'Voir les outils pour la vie perso'],
  },
  perso: {
    titre: 'Templates pour la vie perso · QME',
    description: 'Outils prêts à l’emploi pour la vie perso : budget, dépenses à deux, études, maison, voiture, santé et forme. Achat unique, dès 9 €, essai 14 jours.',
    sourcil: 'Pour la vie perso',
    h1: 'Les outils de la vie perso, <mark>ouverts en une minute.</mark>',
    lead: '<strong>Budget, dépenses à deux, révisions, maison, voiture, santé :</strong> des applications en ligne prêtes à l’emploi, sur l’ordinateur et le téléphone, avec une seule clé. Achat unique, dès 9 €, sans abonnement.',
    catalogue: 'Les outils pour la vie perso',
    packs: 'Les packs pour la vie perso',
    autre: ['/pro/', 'Voir les outils pour les pros'],
  },
};

const unique = (s, a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`Parties : « ${a.slice(0, 60)} » trouvé ${n} fois`);
  return s.replace(a, b);
};

export function pagePartie(pour, catalogue, packs) {
  const P = PARTIES[pour];
  let s = catalogue;
  s = s.replace(/<title>[^<]*<\/title>/, `<title>${P.titre}</title>`);
  s = s.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${P.description}">`);
  s = s.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="https://qm-engineering.fr/${pour}/">`);
  // Menu : la partie courante.
  s = s.replace(`<a href="/${pour}/">`, `<a href="/${pour}/" aria-current="page">`);
  s = s.replace('<a href="/templates/" aria-current="page">', '<a href="/templates/">');
  // En-tête de la page.
  s = unique(s, '<p class="eyebrow">Templates QME · prêts à l\'emploi</p>', `<p class="eyebrow">Templates QME · ${P.sourcil}</p>`);
  s = s.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${P.h1}</h1>`);
  s = s.replace(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${P.lead}</p>`);
  s = unique(s, '<a class="btn primary" href="#tous">Voir les templates</a>', `<a class="btn primary" href="#tous">Voir les outils</a>\n      <a class="btn" href="${P.autre[0]}">${P.autre[1]}</a>`);
  // Catalogue : filtre fixé sur la partie, sans le sélecteur Tous / Professionnel / Vie personnelle.
  s = unique(s, '<section class="catalogue" id="tous" aria-labelledby="catalogue-titre" data-catalogue>', `<section class="catalogue" id="tous" aria-labelledby="catalogue-titre" data-catalogue data-pour-fixe="${pour}">`);
  s = unique(s, '<h2 id="catalogue-titre">Tous les templates</h2>', `<h2 id="catalogue-titre">${P.catalogue}</h2>`);
  s = s.replace(/\s*<div class="segment" role="group" aria-label="Usage">[\s\S]*?<\/div>/, '');
  // Templates présents dans les deux parties (data-pour="pro perso") : thème et phrase propres à la partie.
  const nomsThemes = Object.fromEntries([...s.matchAll(/<button class="puce" type="button" data-pour="(pro|perso)" data-theme="([a-z-]+)"[^>]*>([^<]+?)\s*<small>/g)].map((m) => [m[2], { pour: m[1], nom: m[3].trim() }]));
  const parSlug = Object.fromEntries(Object.values(TEMPLATES).map((t) => [t.slug, t]));
  s = s.replace(/<li class="carte([^"]*)" data-slug="([a-z0-9-]+)"([^>]*) data-pour="([a-z ]+ [a-z ]+)" data-theme="([a-z -]+)"([^>]*)>(<a [^>]*>)<span class="theme">[^<]*<\/span>(<b>[^<]*<\/b>)<span class="phrase">[^<]*<\/span>/g, (m, cl, slug, a1, pours, themes, a2, lien, nom) => {
    const theme = themes.split(' ').find((id) => nomsThemes[id]?.pour === pour) || themes.split(' ')[0];
    return `<li class="carte${cl}" data-slug="${slug}"${a1} data-pour="${pours}" data-theme="${themes}"${a2}>${lien}<span class="theme">${nomsThemes[theme]?.nom || ''}</span>${nom}<span class="phrase">${phrasePour(parSlug[slug], pour)}</span>`;
  });
  s = s.replace(/\s*<button class="puce" type="button" data-pour="(pro|perso)"[^>]*>[\s\S]*?<\/button>/g, (m, p) => (p === pour ? m : ''));
  // Packs de la partie, repris de /packs/.
  const cartes = [...packs.matchAll(/<a class="pack-carte[^>]*data-pour="([a-z]+)">[\s\S]*?<\/a>/g)].filter((m) => m[1] === pour).map((m) => m[0]);
  s = s.replace(/<section class="section packs-bandeau" id="packs"[\s\S]*?<\/section>/, `<section class="section packs-bandeau" id="packs" aria-labelledby="packs-titre">
  <div>
    <h2 id="packs-titre">${P.packs}</h2>
    <p>Les outils qui vont ensemble, réunis par situation et ouverts avec une seule clé, jusqu’à −25 %.</p>
  </div>
  <div class="grille-packs">
  ${cartes.join('\n  ')}
  </div>
  <div class="actions">
    <a class="btn primary" href="/packs/">Tous les packs</a>
    <a class="btn" href="/packs/composer/">Composer mon pack</a>
  </div>
</section>`);
  // Données structurées (fil d'Ariane, FAQ) recalculées pour l'adresse de la partie, comme les autres pages générées.
  return avecDonnees(s, `https://qm-engineering.fr/${pour}/`);
}

export async function genererParties() {
  const catalogue = await readFile(RACINE + 'templates/index.html', 'utf8');
  const packs = await readFile(RACINE + 'packs/index.html', 'utf8');
  for (const pour of Object.keys(PARTIES)) {
    await mkdir(RACINE + pour, { recursive: true });
    await writeFile(RACINE + `${pour}/index.html`, pagePartie(pour, catalogue, packs));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await genererParties();
  console.log('pages /pro/ et /perso/ générées');
}
