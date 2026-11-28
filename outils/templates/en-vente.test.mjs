// Pages anglaises : l'état de chaque carte suit la vente réelle (PRODUITS). Un produit en vente n'affiche jamais
// « Coming soon » et porte son lien d'achat ; un produit pas encore en vente garde « Coming soon » sans lien d'achat.
// Corriger : node outils/x/en-templates.mjs (en/templates/) et node outils/x/generer.mjs (en/english-version/).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cartesEnTemplates, etatVente, prixEn, racine } from '../x/etat-vente.mjs';

const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const cartes = (html) => html.split(/(?=<article )/).filter((a) => a.startsWith('<article ')).map((a) => a.slice(0, a.indexOf('</article>')));
const slugDe = (c) => /href="\/templates\/([a-z0-9-]+)\/\?demo(?:=[a-z0-9-]+)?"/.exec(c)?.[1];
const liensAchat = (c) => [...c.matchAll(/href="(https:\/\/qmengineering\.gumroad\.com\/l\/[^"]+)"/g)].map((m) => m[1]);

function verifier(page) {
  const html = lire(page);
  const liste = cartes(html);
  assert.ok(liste.length > 0, `${page} : aucune carte`);
  for (const c of liste) {
    const slug = slugDe(c);
    assert.ok(slug, `${page} : carte sans lien de démo /templates/<slug>/?demo`);
    const e = etatVente(slug);
    if (e.vente) {
      assert.ok(!/Coming soon/i.test(c), `${page} : ${slug} est en vente mais affiche « Coming soon »`);
      assert.deepEqual(liensAchat(c), [e.lien], `${page} : ${slug} doit avoir un seul lien d'achat, ${e.lien}`);
    } else {
      assert.ok(/Coming soon/.test(c), `${page} : ${slug} n'est pas en vente et doit afficher « Coming soon »`);
      assert.deepEqual(liensAchat(c), [], `${page} : ${slug} n'est pas en vente mais a un lien d'achat`);
    }
  }
  return liste;
}

test('prixEn : centimes en prix anglais', () => {
  assert.equal(prixEn(1490), '€14.90');
  assert.equal(prixEn(2500), '€25');
  assert.equal(prixEn(900), '€9');
  assert.equal(prixEn(0), 'Free');
});

test('en/templates : chaque carte suit la vente et la page est à jour', () => {
  const liste = verifier('en/templates/index.html');
  for (const c of liste) {
    const e = etatVente(slugDe(c));
    if (e.vente && e.prix != null) assert.match(c, new RegExp(`<div class="prix"><b>${prixEn(e.prix).replace('.', '\\.')}</b>`), `prix de ${slugDe(c)}`);
  }
  const html = lire('en/templates/index.html');
  assert.equal(cartesEnTemplates(html), html, 'en/templates/index.html pas à jour : lancer node outils/x/en-templates.mjs');
});

test('en/templates : le bandeau sous les cartes ne renvoie qu\'à des produits en vente, pages existantes', () => {
  const bandeau = /<div class="a-venir">(.*?)<\/div>/.exec(lire('en/templates/index.html'))?.[1] || '';
  assert.ok(!/Coming/i.test(bandeau), 'le bandeau annonce encore des produits « à venir »');
  for (const [, slug] of bandeau.matchAll(/href="\/catalogue\/([a-z0-9-]+)\/"/g)) {
    assert.ok(etatVente(slug).vente, `${slug} cité dans le bandeau n'est pas en vente`);
    assert.ok(fs.existsSync(path.join(racine, 'catalogue', slug, 'index.html')), `catalogue/${slug}/ absent`);
  }
});

test('en/english-version : chaque carte suit la vente', () => {
  const liste = verifier('en/english-version/index.html');
  const json = JSON.parse(lire('outils/x/templates-en.json'));
  assert.equal(liste.length, Object.keys(json).filter((k) => !k.startsWith('_')).length, 'nombre de cartes ≠ templates-en.json : lancer node outils/x/generer.mjs');
});
