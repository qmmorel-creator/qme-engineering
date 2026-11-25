// Écart entre ce qui est prêt à être vendu et ce qui existe sur Gumroad (référent Gumroad unique, décision de
// Quentin du 24/11/2026 : docs/templates/communication/gumroad-priorite.md § « Qui gère la file »).
//
// Usage : node outils/gumroad/ecart.mjs [produits-gumroad.json]
//   Sans argument : liste ce qui est prêt et n'a pas d'identifiant Gumroad dans le code (PRODUITS, PACKS).
//   Avec le fichier JSON des produits Gumroad (tableau { id, name, published } renvoyé par list_products) : sépare
//   ce qui a déjà un brouillon sur Gumroad (même nom) de ce qui reste à créer, et signale les brouillons publiés
//   sur Gumroad mais pas encore en vente sur le site.
//
// Prêt à vendre :
//   - template : déclaré dans PRODUITS (sans `vers`, donc pas fusionné dans un autre), prix > 0, page catalogue
//     présente, sans identifiant Gumroad, et pas bloqué par une décision de Quentin (BLOQUES) ;
//   - pack : non retiré, sans identifiant Gumroad, et dont tous les templates sont en vente.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { PACKS } from '../../netlify/lib/packs.mjs';
import { TEMPLATES } from '../packs/donnees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
// Templates bloqués par une décision de Quentin (docs/templates/QUESTIONS.md § Bloquant) : données de santé ou de
// mineurs. Retirer un préfixe d'ici quand Quentin a tranché.
export const BLOQUES = []; // 25/11/2026 : Quentin a décidé de vendre BBE, CSE et RBS (QUESTIONS.md § Bloquant).

const enVente = (p) => Boolean(PRODUITS[p]?.gumroad) && !PRODUITS[p]?.vers;

export function ecart() {
  const templates = Object.entries(PRODUITS)
    .filter(([p, d]) => !d.vers && !d.gumroad && TEMPLATES[p] && TEMPLATES[p].prix > 0)
    .filter(([p]) => existsSync(`${RACINE}catalogue/${TEMPLATES[p].slug}/index.html`))
    .map(([p, d]) => ({ type: 'template', code: p, nom: d.nom, slug: TEMPLATES[p].slug, prix: TEMPLATES[p].prix / 100, bloque: BLOQUES.includes(p) }));
  const packs = Object.entries(PACKS)
    .filter(([, k]) => !k.retire && !k.gumroad)
    .map(([c, k]) => ({ type: 'pack', code: c, nom: k.nom, slug: k.slug, manquants: k.produits.filter((p) => !enVente(p)) }));
  return {
    templates: templates.filter((t) => !t.bloque),
    bloques: templates.filter((t) => t.bloque),
    packs: packs.filter((k) => !k.manquants.length),
    packsIncomplets: packs.filter((k) => k.manquants.length),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const e = ecart();
  const norm = (s) => String(s).normalize('NFC').replace(/[’']/g, "'").trim().toLowerCase();
  let gumroad = null;
  if (process.argv[2]) {
    const brut = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    gumroad = new Map((Array.isArray(brut) ? brut : brut.products).map((p) => [norm(p.name), p]));
  }
  const ligne = (x) => {
    const g = gumroad?.get(norm(x.nom));
    const etat = !gumroad ? '' : !g ? ' → À CRÉER' : g.published ? ` → PUBLIÉ sur Gumroad (${g.id}), à passer en vente sur le site` : ` → brouillon existant (${g.id}), clé à activer`;
    return `  ${x.code} · ${x.nom}${x.prix ? ` · ${x.prix} €` : ''}${etat}`;
  };
  console.log(`Templates prêts sans fiche en vente (${e.templates.length}) :`);
  e.templates.forEach((t) => console.log(ligne(t)));
  console.log(`Packs complets sans fiche en vente (${e.packs.length}) :`);
  e.packs.forEach((k) => console.log(ligne(k)));
  console.log(`Bloqués par une décision de Quentin (${e.bloques.length}) : ${e.bloques.map((t) => t.code).join(', ') || '—'}`);
  console.log(`Packs incomplets (${e.packsIncomplets.length}) : ${e.packsIncomplets.map((k) => `${k.code} (manque ${k.manquants.join(', ')})`).join(' ; ') || '—'}`);
  if (gumroad) {
    const aCreer = [...e.templates, ...e.packs].filter((x) => !gumroad.get(norm(x.nom))).length;
    console.log(aCreer ? `\nÉcart : ${aCreer} fiche(s) à créer.` : '\nAucune fiche à créer : les deux listes concordent (hors brouillons en attente de clé).');
  }
}
