// Données structurées JSON-LD et balises de référencement des pages publiques.
// En cas d'échec « bloc JSON-LD à jour » : node outils/seo/donnees-structurees.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pagesPubliques, RACINE } from '../sitemap/generer.mjs';
import { avecDonnees, offreVisible, SITE } from '../seo/donnees-structurees.mjs';

const pages = pagesPubliques().map((p) => ({ ...p, html: readFileSync(join(RACINE, p.fichier), 'utf8') }));
const graphe = (html) => {
  const m = html.match(/<script type="application\/ld\+json" id="donnees-structurees">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1])['@graph'] : [];
};
const types = (html) => graphe(html).map((x) => x['@type']);

test('chaque page publique a son bloc JSON-LD à jour (généré depuis le contenu visible)', () => {
  const perimees = pages.filter((p) => avecDonnees(p.html, p.loc) !== p.html).map((p) => p.fichier);
  assert.deepEqual(perimees, [], 'relancer node outils/seo/donnees-structurees.mjs');
});

test('accueil : Organization et WebSite', () => {
  const accueil = pages.find((p) => p.loc === `${SITE}/`);
  assert.ok(types(accueil.html).includes('Organization'));
  assert.ok(types(accueil.html).includes('WebSite'));
});

test('Product seulement sur les pages catalogue en vente, avec le prix et le lien Gumroad affichés', () => {
  for (const p of pages) {
    const produit = graphe(p.html).find((x) => x['@type'] === 'Product');
    const offre = offreVisible(p.html);
    if (!p.loc.includes('/catalogue/')) { assert.equal(produit, undefined, p.fichier); continue; }
    if (!offre) { assert.equal(produit, undefined, `${p.fichier} : pas de Product sans offre`); continue; }
    assert.equal(produit.offers.price, offre.prix, p.fichier);
    assert.equal(produit.offers.priceCurrency, 'EUR');
    assert.equal(produit.offers.url, offre.url);
    assert.ok(!('aggregateRating' in produit) && !('review' in produit), 'aucune note sans avis réels');
  }
  assert.ok(pages.filter((p) => types(p.html).includes('Product')).length >= 28);
});

test('FAQPage seulement là où une FAQ est visible, avec les mêmes questions', () => {
  for (const p of pages) {
    const faq = graphe(p.html).find((x) => x['@type'] === 'FAQPage');
    const visibles = (p.html.match(/<div class="faq"[\s\S]*?<\/div>/g) || []).join('').match(/<summary>/g)?.length || 0;
    assert.equal(faq ? faq.mainEntity.length : 0, visibles, p.fichier);
  }
});

test('title et meta description présents, uniques ; description ≤ 160 caractères sur les pages en vente', () => {
  const vus = new Map();
  for (const p of pages) {
    const title = p.html.match(/<title>([^<]+)<\/title>/)?.[1];
    const desc = p.html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title && desc, p.fichier);
    assert.ok(!vus.has(title), `title en double : ${p.fichier} et ${vus.get(title)}`);
    vus.set(title, p.fichier);
    if (offreVisible(p.html)) {
      const longueur = desc.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').length;
      assert.ok(longueur <= 160, `${p.fichier} : description de ${longueur} caractères`);
    }
  }
});
