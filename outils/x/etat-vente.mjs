// État de vente d'un template pour les pages anglaises (/en/templates/ et /en/english-version/).
// Source unique : en vente si PRODUITS (netlify/lib/templates-acces.mjs) lui donne un identifiant Gumroad.
// Prix et permalien : outils/packs/donnees.mjs (TEMPLATES), sinon la page catalogue/<slug>/ (cas de Secret Santa).
// Une fiche Gumroad anglaise dédiée prendrait le pas si elle existait (champ `gumroadEn` de PRODUITS, permalien).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { TEMPLATES } from '../packs/donnees.mjs';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const GUMROAD = 'https://qmengineering.gumroad.com/l/';

const parSlug = {};
for (const [code, p] of Object.entries(PRODUITS)) {
  const slug = /^\/templates\/([a-z0-9-]+)\/$/.exec(p.url || '')?.[1];
  if (slug) parSlug[slug] = { code, ...p };
}
const tplParSlug = Object.fromEntries(Object.values(TEMPLATES).map((t) => [t.slug, t]));

// 1490 → « €14.90 », 2500 → « €25 », 0 → « Free ».
export const prixEn = (centimes) => (centimes === 0 ? 'Free'
  : `€${centimes % 100 ? (centimes / 100).toFixed(2) : centimes / 100}`);

// { vente, code, prix (centimes), lien } ; vente: false si le produit n'a pas d'identifiant Gumroad.
export function etatVente(slug) {
  const p = parSlug[slug];
  if (!p?.gumroad) return { vente: false, code: p?.code || null, prix: null, lien: null };
  if (p.gumroadEn) return { vente: true, code: p.code, prix: tplParSlug[slug]?.prix ?? null, lien: GUMROAD + p.gumroadEn, anglais: true };
  const t = tplParSlug[slug];
  let prix = t?.prix ?? null;
  let permalien = t?.permalien || null;
  if (prix == null || !permalien) {
    const cat = fs.readFileSync(path.join(racine, 'catalogue', slug, 'index.html'), 'utf8');
    permalien ||= /qmengineering\.gumroad\.com\/l\/([a-z0-9-]+)/.exec(cat)?.[1] || null;
    if (prix == null && /<div class="prix"><b>Gratuit<\/b>/.test(cat)) prix = 0;
  }
  if (prix == null || !permalien) throw new Error(`Prix ou permalien introuvable pour ${slug} (${p.code}), alors qu'il est en vente`);
  return { vente: true, code: p.code, prix, lien: GUMROAD + permalien };
}

// Réécrit les cartes de /en/templates/ (page écrite à la main) selon l'état de vente : prix et bouton d'achat
// pour un produit en vente, « Coming soon » et démo seule sinon. Les cartes déjà justes ne bougent pas.
export function cartesEnTemplates(html) {
  const morceaux = html.split(/(?=<article )/);
  return morceaux.map((a) => {
    if (!a.startsWith('<article ')) return a;
    const fin = a.indexOf('</article>');
    const carte = a.slice(0, fin);
    const slug = /href="\/templates\/([a-z0-9-]+)\/\?demo(?:=[a-z0-9-]+)?"/.exec(carte)?.[1];
    if (!slug) return a;
    const e = etatVente(slug);
    const nom = /<h3>([^<]+)<\/h3>/.exec(carte)?.[1] || slug;
    let c = carte;
    const achat = /<a class="btn primary" href="https:\/\/qmengineering\.gumroad\.com\/l\/[^"]+"[^>]*>[^<]*<\/a>\n\s*/;
    if (e.vente) {
      if (/<div class="prix prochaine">/.test(c)) {
        const sous = e.prix === 0 ? 'Pay what you want, lifetime access' : 'One-time purchase';
        c = c.replace(/<div class="prix prochaine">.*?<\/div>/, `<div class="prix"><b>${prixEn(e.prix)}</b><span>${sous}</span></div>`);
      }
      if (!achat.test(c)) {
        const gratuit = e.prix === 0;
        const bouton = `<a class="btn primary" href="${e.lien}" data-goatcounter-click="${gratuit ? 'obtenir' : 'achat'}-${slug}-accueil-en" data-goatcounter-title="${gratuit ? 'Get it free' : 'Buy'} : ${nom} (accueil-en)">${gratuit ? 'Get it free' : 'Buy'}</a>`;
        c = c.replace(/(\s*)<a class="btn primary" (href="\/templates\/[a-z0-9-]+\/\?demo(?:=[a-z0-9-]+)?")/, `$1${bouton}$1<a class="btn" $2`);
      }
    } else {
      c = c.replace(achat, '').replace(/<div class="prix">.*?<\/div>/, '<div class="prix prochaine"><b>Coming soon</b><span>Demo open now, no sign-up</span></div>')
        .replace(/<a class="btn" (href="\/templates\/[a-z0-9-]+\/\?demo(?:=[a-z0-9-]+)?")/, '<a class="btn primary" $1');
    }
    return c + a.slice(fin);
  }).join('');
}
