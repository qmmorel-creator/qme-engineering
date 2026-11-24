// Prépare les fiches Gumroad des packs (docs/templates/communication/packs/) depuis les mêmes données que le site.
// Usage : node outils/packs/fiches-gumroad.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PACKS } from '../../netlify/lib/packs.mjs';
import { calculerPack } from './generer.mjs';
import { PRODUITS_ESSAI } from '../../netlify/lib/essais.mjs';
import { ESSAI } from '../../netlify/lib/templates-acces.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const fiches = Object.keys(PACKS).filter((k) => !PACKS[k].retire).map(calculerPack).map((p) => {
  const enVente = p.templates.filter((t) => t.statut === 'vente').length;
  const description = [
    `<p><strong>${esc(p.accroche)}</strong></p>`,
    `<p>${esc(p.resume)}</p>`,
    `<p><strong>Pour qui ?</strong> ${esc(p.pourQui)}</p>`,
    `<p><strong>Le contenu du pack (${p.templates.length} templates) :</strong></p>`,
    `<ul>${p.templates.map((t) => `<li><strong>${esc(t.nom)}</strong> : ${esc(t.phrase)} (${euros(t.prix)} seul)</li>`).join('')}</ul>`,
    p.prevus.length ? `<p><strong>À venir dans ce pack :</strong> ${p.prevus.map((t) => esc(t.nom)).join(', ')}.</p>` : '',
    `<p>${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}.</p>`,
    `<p><strong>Templates ajoutés plus tard :</strong> inclus. Chaque template ajouté au pack après votre achat s’ouvre aussi avec votre clé, sans supplément.</p>`,
    // Essai gratuit des outils du pack, annoncé comme sur la page du pack (audit du 22/11/2026).
    p.templates.length && p.templates.every((t) => PRODUITS_ESSAI.includes(t.pre)) ? `<p><strong>Essai gratuit :</strong> chaque outil du pack s’essaie ${ESSAI.jours} jours gratuitement, sans carte bancaire, sur qm-engineering.fr/essai. Si vous prenez ensuite le pack, vos données d’essai sont reprises.</p>` : '',
    `<p><strong>Après l’achat :</strong> collez la clé reçue sur qm-engineering.fr/connexion : le tableau de bord du pack s’ouvre, avec un bouton par template, sur tous vos appareils. Achat unique, pas d’abonnement. Templates en français.</p>`,
    p.avertissement ? `<p>${esc(p.avertissement)}</p>` : '',
    `<p>Outils d’aide à l’organisation : ils ne remplacent pas un avis professionnel (juridique, financier, médical).</p>`,
  ].filter(Boolean).join('\n');
  return {
    code: p.code, slug: p.slug, nom: p.nom, permalien: `pack-${p.slug}`,
    prix_cents: p.prix,
    resume: p.accroche, description_html: description,
    lien_contenu: 'https://qm-engineering.fr/connexion/', texte_bouton: 'Ouvrir mon pack',
    texte_recu: 'Merci ! Collez la clé de licence ci-dessous sur qm-engineering.fr/connexion : le tableau de bord de votre pack s’ouvre, avec un bouton par template.',
    templates_en_vente: `${enVente}/${p.templates.length}`, templates_a_mettre_en_vente: p.templates.filter((t) => t.statut !== 'vente').map((t) => t.nom),
  };
}).sort((a, b) => a.templates_a_mettre_en_vente.length - b.templates_a_mettre_en_vente.length || a.nom.localeCompare(b.nom, 'fr'));

await writeFile(RACINE + 'docs/templates/communication/packs/gumroad-packs.json', JSON.stringify(fiches, null, 2) + '\n');
const md = ['# Fiches Gumroad des packs', '', 'Généré par `node outils/packs/fiches-gumroad.mjs` (même source que le site). Ordre : les packs dont il manque le moins de templates en vente d’abord.', '',
  'Réglages à faire à la main dans l’éditeur Gumroad, pour chaque pack : bloc **License key** dans le contenu (une seule version, au prix ci-dessous ; tous les templates du pack, y compris ceux ajoutés plus tard, s’ouvrent avec la clé), puis identifiant du produit reporté dans `PACKS` (`gumroad`, `permalien`) de `netlify/lib/packs.mjs` et `node outils/packs/generer.mjs`. Un pack n’est publié que lorsque tous ses templates sont en vente.', '',
  '| Pack | Permalien | Prix | Templates en vente | Manquent |', '|---|---|---|---|---|',
  ...fiches.map((f) => `| ${f.nom} | ${f.permalien} | ${euros(f.prix_cents)} | ${f.templates_en_vente} | ${f.templates_a_mettre_en_vente.join(', ') || '—'} |`), ''];
await writeFile(RACINE + 'docs/templates/communication/packs/gumroad-packs.md', md.join('\n'));
console.log(fiches.map((f) => `${f.code} ${f.templates_en_vente}`).join(' · '));
