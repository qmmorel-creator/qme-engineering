// Contrôles transversaux de l'audit des templates étudiants (22/11/2026, avant le partenariat Odélia) :
// lien court /odelia, démos sans « Bientôt en vente » pour les templates en vente, cibles tactiles de 44 px,
// liens réseaux qui ne flottent plus sur le contenu au téléphone. Rapport : docs/templates/audit-etudiants-2026-11-22.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUITS_ESSAI } from '../../netlify/lib/essais.mjs';
import { TEMPLATES } from '../packs/donnees.mjs';

const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const SLUGS = ['revision', 'notes', 'planner', 'habitudes', 'lecture', 'candidatures', 'memoire', 'budget', 'abonnements', 'budget-commun', 'epargne', 'repas'];

test('/odelia : 302 vers le Pack Étudiant avec les paramètres de campagne, aucune règle antérieure ne l’intercepte', () => {
  const blocs = lire('netlify.toml').split('[[redirects]]').slice(1);
  const i = blocs.findIndex((b) => /from = "\/odelia"/.test(b));
  assert.ok(i >= 0, 'redirection /odelia absente');
  const b = blocs[i];
  assert.match(b, /to = "\/packs\/etudiant\/\?utm_source=instagram&utm_medium=influence&utm_campaign=odelia"/);
  assert.match(b, /status = 302/);
  for (const avant of blocs.slice(0, i)) {
    const from = avant.match(/from = "([^"]+)"/)?.[1] || '';
    assert.ok(!/^\/(\*|:[a-z]+)/.test(from) && from !== '/odelia', `règle antérieure ${from}`);
  }
  assert.ok(lire('packs/etudiant/index.html').length > 1000);
  // Variante avec majuscule (les chemins Netlify sont sensibles à la casse).
  const maj = blocs.find((x) => /from = "\/Odelia"/.test(x));
  assert.ok(maj && /to = "\/packs\/etudiant\/\?utm_source=instagram&utm_medium=influence&utm_campaign=odelia"/.test(maj), '/Odelia');
});

test('les 12 templates étudiants sont ouverts à l’essai, et leur démo ne dit pas « Bientôt en vente »', () => {
  const vente = PRODUITS_ESSAI.map((p) => TEMPLATES[p].slug);
  for (const s of SLUGS) {
    assert.ok(vente.includes(s), `${s} n'est pas ouvert à l'essai`);
    assert.doesNotMatch(lire(`templates/${s}/app.js`), /Bientôt en vente/, s);
  }
});

test('cibles tactiles : petits boutons, liens-boutons, fermeture des fenêtres et bandeau démo à 44 px au moins', () => {
  for (const s of SLUGS) {
    const css = lire(`templates/${s}/app.css`);
    const bloc = css.slice(css.indexOf('Cibles tactiles d\'au moins 44 px'));
    assert.ok(css.includes('Cibles tactiles d\'au moins 44 px'), `${s} : bloc absent`);
    assert.match(bloc, /\.btn\.petit,\.btn\.lien\{min-height:44px\}/, s);
    assert.match(bloc, /\.modale-tete button\{width:44px;height:44px\}/, s);
    assert.match(bloc, /\.bandeau-demo button\{min-height:44px/, s);
  }
  assert.match(lire('templates/epargne/app.css'), /\.carte-mois \.btn\.petit\{min-height:44px\}/);
});

test('téléphone : les liens réseaux passent dans le flux au lieu de couvrir le texte', () => {
  assert.match(lire('assets/site.css'), /@media \(max-width:600px\)\{\.reseaux\{position:static;/);
});

test('téléphone : sur les pages catalogue, prix et boutons (essai, achat, démo) passent avant la liste des fonctions', () => {
  assert.match(lire('assets/site.css'), /@media \(max-width:640px\)\{\.produit-texte>\.prix\{order:-2;[^}]*\}\.produit-texte>\.actions\{order:-1;/);
  for (const s of SLUGS) {
    const h = lire(`catalogue/${s}/index.html`);
    const texte = h.slice(h.indexOf('<div class="produit-texte"'));
    assert.ok(texte.indexOf('<div class="prix"') > 0 && texte.indexOf('<div class="actions"') > texte.indexOf('<div class="prix"'), s);
    assert.match(texte, new RegExp(`<a class="btn primary" href="/essai/\\?t=${s}"`), `${s} : l'essai reste le premier bouton`);
  }
});

test('démo Odélia : liens « Repartir des données de départ » à 44 px, styles des packs à jour', () => {
  assert.match(lire('assets/packs.css'), /\.parcours p a:not\(\.btn\)\{display:inline-flex;align-items:center;min-height:44px/);
  const h = lire('demo/odelia/index.html');
  const v = lire('outils/packs/generer.mjs').match(/const V = '(\d+)'/)[1];
  assert.ok(h.includes(`/assets/packs.css?v=${v}`), 'version de packs.css');
  assert.equal((h.match(/&amp;reinit">Repartir des données de départ<\/a>/g) || []).length, 4);
});

test('hors ligne : chaque fichier chargé par index.html est dans la coquille du service worker, à la même version', () => {
  for (const s of SLUGS) {
    const ix = lire(`templates/${s}/index.html`), sw = lire(`templates/${s}/sw.js`);
    const coquille = sw.match(/const COQUILLE = \[(.*)\];/)[1];
    const charges = [...ix.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)].map((m) => m[1].replace(/^\/templates\/[^/]+\/(?=[^/]+$)/, ''));
    assert.ok(charges.length >= 5, s);
    for (const f of charges) assert.ok(coquille.includes(`'${f}'`), `${s} : ${f} absent de la coquille`);
    const v = sw.match(/VERSION = '([a-z-]+)-([0-9a-z]+)'/);
    assert.equal(v[1], s);
    assert.ok(coquille.includes(`app.js?v=${v[2]}`), `${s} : VERSION et app.js désaccordés`);
  }
});
