// Données structurées JSON-LD des pages publiques, tirées du contenu VISIBLE de chaque page :
// - accueil : Organization + WebSite ;
// - toute page avec un fil d'Ariane visible (nav.fil) : BreadcrumbList ;
// - toute page avec une FAQ visible (div.faq > details) : FAQPage (questions et réponses telles qu'affichées) ;
// - page catalogue en vente (prix affiché + bouton Acheter Gumroad) : Product + Offer en EUR.
//   Les pages « Mise en vente prochaine » n'ont pas de Product : sans offre, Google le signale en erreur ;
// - guide (/guides/<slug>/) : Article (titre H1, meta description, date de la mention visible « à jour au
//   JJ/MM/AAAA »).
// Aucune note ni aucun avis (pas d'aggregateRating sans avis réels).
// Usage : node outils/seo/donnees-structurees.mjs   (à relancer après toute modification de prix, de FAQ,
// de titre ou de fil d'Ariane ; outils/templates/seo.test.mjs échoue sinon)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesPubliques, RACINE } from '../sitemap/generer.mjs';

export const SITE = 'https://qm-engineering.fr';
const ORG = `${SITE}/#organisation`;
const DEBUT = '<script type="application/ld+json" id="donnees-structurees">';
const BLOC = /\n?<script type="application\/ld\+json" id="donnees-structurees">[\s\S]*?<\/script>/;

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à' };
export const texte = (html) => html
  .replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITES[n] ?? m)
  .replace(/\s+/g, ' ').trim();

const absolue = (href) => (href.startsWith('http') ? href : SITE + href);

function filAriane(html, canonique) {
  const nav = html.match(/<nav class="fil"[^>]*>([\s\S]*?)<\/nav>/);
  if (!nav) return null;
  const items = [...nav[1].matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>|<b>([\s\S]*?)<\/b>/g)].map((m) =>
    m[1] ? { nom: texte(m[2]), url: absolue(m[1]).split('#')[0] } : { nom: texte(m[3]), url: canonique });
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonique}#fil`,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nom, item: it.url })),
  };
}

function faq(html, canonique) {
  const blocs = [...html.matchAll(/<div class="faq"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1]).join('');
  const q = [...blocs.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!q.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': `${canonique}#faq`,
    mainEntity: q.map((m) => ({ '@type': 'Question', name: texte(m[1]), acceptedAnswer: { '@type': 'Answer', text: texte(m[2]) } })),
  };
}

// Prix affiché (« 29 € », « 14,90 € ») et lien Acheter Gumroad du bloc produit.
export function offreVisible(html) {
  const prix = html.match(/<div class="prix"><b>([\d\s]+(?:,\d{2})?)\s*€<\/b>/);
  const achat = html.match(/<a class="btn primary" href="(https:\/\/qmengineering\.gumroad\.com\/l\/[^"]+)"/);
  if (!prix || !achat) return null;
  return { prix: Number(prix[1].replace(/\s/g, '').replace(',', '.')).toFixed(2), url: achat[1] };
}

function produit(html, canonique) {
  const offre = offreVisible(html);
  if (!offre) return null;
  const nom = texte(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
  const desc = texte(html.match(/<meta name="description" content="([^"]*)"/)[1]);
  const images = [...html.matchAll(/<img class="(?:ecran|tel)" src="([^"]+)"/g)].map((m) => absolue(m[1]));
  return {
    '@type': 'Product',
    '@id': `${canonique}#produit`,
    name: nom,
    description: desc,
    url: canonique,
    image: images,
    category: 'Application web (template)',
    brand: { '@id': ORG },
    offers: {
      '@type': 'Offer',
      price: offre.prix,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: offre.url,
      seller: { '@id': ORG },
    },
  };
}

// Guide : Article tiré du H1, de la meta description et de la date de la mention visible
// (« Guide d'information générale, à jour au JJ/MM/AAAA »).
export const estGuide = (canonique) => /^https:\/\/qm-engineering\.fr\/guides\/[^/]+\/$/.test(canonique);
function article(html, canonique) {
  if (!estGuide(canonique)) return null;
  const date = html.match(/<p class="guide-mention">[^<]*à jour au (\d{2})\/(\d{2})\/(\d{4})/);
  if (!date) throw new Error(`${canonique} : mention « à jour au JJ/MM/AAAA » introuvable`);
  const iso = `${date[3]}-${date[2]}-${date[1]}`;
  return {
    '@type': 'Article',
    '@id': `${canonique}#article`,
    headline: texte(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]),
    description: texte(html.match(/<meta name="description" content="([^"]*)"/)[1]),
    url: canonique,
    mainEntityOfPage: canonique,
    inLanguage: 'fr-FR',
    datePublished: iso,
    dateModified: iso,
    author: { '@type': 'Organization', '@id': ORG, name: 'Quentin Morel Engineering', url: `${SITE}/` },
    publisher: { '@type': 'Organization', '@id': ORG, name: 'Quentin Morel Engineering', logo: { '@type': 'ImageObject', url: `${SITE}/assets/logo-qme.png` } },
  };
}

function accueil() {
  return [
    {
      '@type': 'Organization',
      '@id': ORG,
      name: 'Quentin Morel Engineering',
      alternateName: 'QME',
      url: `${SITE}/`,
      logo: { '@type': 'ImageObject', url: `${SITE}/assets/logo-qme.png`, width: 281, height: 245 },
      email: 'quentin.morel@qm-engineering.fr',
      founder: { '@type': 'Person', name: 'Quentin Morel' },
      areaServed: { '@type': 'Country', name: 'France' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#site`,
      name: 'QME · Quentin Morel Engineering',
      url: `${SITE}/`,
      inLanguage: 'fr-FR',
      publisher: { '@id': ORG },
    },
  ];
}

export function donnees(html, canonique) {
  const graphe = [];
  if (canonique === `${SITE}/`) graphe.push(...accueil());
  for (const bloc of [produit(html, canonique), article(html, canonique), filAriane(html, canonique), faq(html, canonique)]) if (bloc) graphe.push(bloc);
  return graphe.length ? { '@context': 'https://schema.org', '@graph': graphe } : null;
}

// Renvoie le HTML avec son bloc JSON-LD à jour (inséré juste avant </head>, ou retiré s'il n'a plus lieu d'être).
export function avecDonnees(html, canonique) {
  const sans = html.replace(BLOC, '');
  const d = donnees(sans, canonique);
  if (!d) return sans;
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  return sans.replace('</head>', `${DEBUT}\n${json}\n</script>\n</head>`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const { fichier, loc } of pagesPubliques()) {
    const chemin = join(RACINE, fichier);
    const avant = readFileSync(chemin, 'utf8');
    const apres = avecDonnees(avant, loc);
    if (apres !== avant) { writeFileSync(chemin, apres); n++; }
  }
  console.log(`données structurées : ${n} page(s) mise(s) à jour`);
}
