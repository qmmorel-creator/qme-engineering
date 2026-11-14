// Prépare les fiches Gumroad des packs (docs/templates/communication/packs/) depuis les mêmes données que le site.
// Usage : node outils/packs/fiches-gumroad.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PACKS, OPTION } from '../../netlify/lib/packs.mjs';
import { calculerPack } from './generer.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const fiches = Object.keys(PACKS).map(calculerPack).map((p) => {
  const enVente = p.templates.filter((t) => t.statut === 'vente').length;
  const description = [
    `<p><strong>${esc(p.accroche)}</strong></p>`,
    `<p>${esc(p.resume)}</p>`,
    `<p><strong>Pour qui ?</strong> ${esc(p.pourQui)}</p>`,
    `<p><strong>Le contenu du pack (${p.templates.length} templates) :</strong></p>`,
    `<ul>${p.templates.map((t) => `<li><strong>${esc(t.nom)}</strong> : ${esc(t.phrase)} (${euros(t.prix)} seul)</li>`).join('')}</ul>`,
    p.prevus.length ? `<p><strong>À venir dans ce pack :</strong> ${p.prevus.map((t) => esc(t.nom)).join(', ')}.</p>` : '',
    `<p>${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}.</p>`,
    `<p><strong>Deux versions :</strong> « Pack » (${euros(p.prix)}) ouvre les templates présents le jour de l’achat ; « ${OPTION.nom} » (${euros(p.prix + p.option)}) ouvre aussi chaque template ajouté au pack ensuite, avec la même clé.</p>`,
    `<p><strong>Après l’achat :</strong> collez la clé reçue sur qm-engineering.fr/connexion : le tableau de bord du pack s’ouvre, avec un bouton par template, sur tous vos appareils. Achat unique, pas d’abonnement. Templates en français.</p>`,
    `<p>Outils d’aide à l’organisation : ils ne remplacent pas un avis professionnel (juridique, financier, médical).</p>`,
  ].filter(Boolean).join('\n');
  return {
    code: p.code, slug: p.slug, nom: p.nom, permalien: `pack-${p.slug}`,
    prix_cents: p.prix, versions: [{ nom: 'Pack', prix_cents: p.prix }, { nom: OPTION.nom, prix_cents: p.prix + p.option }],
    resume: p.accroche, description_html: description,
    lien_contenu: 'https://qm-engineering.fr/connexion/', texte_bouton: 'Ouvrir mon pack',
    texte_recu: 'Merci ! Collez la clé de licence ci-dessous sur qm-engineering.fr/connexion : le tableau de bord de votre pack s’ouvre, avec un bouton par template.',
    templates_en_vente: `${enVente}/${p.templates.length}`, templates_a_mettre_en_vente: p.templates.filter((t) => t.statut !== 'vente').map((t) => t.nom),
  };
}).sort((a, b) => a.templates_a_mettre_en_vente.length - b.templates_a_mettre_en_vente.length || a.nom.localeCompare(b.nom, 'fr'));

await writeFile(RACINE + 'docs/templates/communication/packs/gumroad-packs.json', JSON.stringify(fiches, null, 2) + '\n');
const md = ['# Fiches Gumroad des packs', '', 'Généré par `node outils/packs/fiches-gumroad.mjs` (même source que le site). Ordre : les packs dont il manque le moins de templates en vente d’abord.', '',
  'Réglages à faire à la main dans l’éditeur Gumroad, pour chaque pack : deux versions (« Pack » et « Pack évolutif », prix ci-dessous), bloc **License key** dans le contenu (le serveur lit la version achetée et la date d’achat), puis identifiant du produit reporté dans `PACKS` (`gumroad`, `permalien`) de `netlify/lib/packs.mjs` et `node outils/packs/generer.mjs`. Un pack n’est publié que lorsque tous ses templates sont en vente.', '',
  '| Pack | Permalien | Pack | Pack évolutif | Templates en vente | Manquent |', '|---|---|---|---|---|---|',
  ...fiches.map((f) => `| ${f.nom} | ${f.permalien} | ${euros(f.versions[0].prix_cents)} | ${euros(f.versions[1].prix_cents)} | ${f.templates_en_vente} | ${f.templates_a_mettre_en_vente.join(', ') || '—'} |`), ''];
await writeFile(RACINE + 'docs/templates/communication/packs/gumroad-packs.md', md.join('\n'));
console.log(fiches.map((f) => `${f.code} ${f.templates_en_vente}`).join(' · '));
