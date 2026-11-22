// Génère les pages des packs : /packs/ (liste), /packs/<slug>/ (une par pack), /packs/composer/ (pack sur
// mesure), /packs/espace/ (tableau de bord de l'acheteur d'un pack) et la section « Packs » de /templates/.
// Usage : node outils/packs/generer.mjs   (à relancer après toute modification d'un pack, d'un prix, ou
// quand un template passe en vente : le statut « Bientôt » d'un pack se recalcule à partir de PRODUITS).
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { PACKS, REMISES, prixPack, ACHAT_SUR_MESURE, OPTION, prixOption } from '../../netlify/lib/packs.mjs';
import { TEMPLATES, PREVUS, CIBLES, PAGES } from './donnees.mjs';
import { avecDonnees } from '../seo/donnees-structurees.mjs';
import { PRODUITS_ESSAI } from '../../netlify/lib/essais.mjs';
import { ESSAI } from '../../netlify/lib/templates-acces.mjs';
import { donneesEspace } from '../connexion/generer.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const V = '2026112201';
const GUMROAD = 'https://qmengineering.gumroad.com/l/';
// Vignettes des templates (480 × 300) : adresse versionnée lue sur les cartes du catalogue templates/index.html,
// écrite par outils/templates/vignettes.mjs (à lancer avant ce générateur après l'ajout d'un template).
let VIGNETTES = {};
const lireVignettes = (html) => Object.fromEntries([...html.matchAll(/data-slug="([^"]+)" data-vignette="([^"]+)"/g)].map((m) => [m[1], m[2]]));
const vignette = (slug) => (VIGNETTES[slug] ? `<img src="${VIGNETTES[slug]}" width="480" height="300" loading="lazy" alt="">` : '');

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';

// Statut d'un template : vente (fiche Gumroad publiée), bientot (prêt, démo ouverte), prevu (en développement).
export function statutTemplate(pre) {
  if (!PRODUITS[pre]) return 'prevu';
  return PRODUITS[pre].gumroad ? 'vente' : 'bientot';
}
export function infoTemplate(pre) {
  const t = TEMPLATES[pre], p = PRODUITS[pre];
  if (!t || !p) throw new Error(`Template ${pre} : fiche absente de outils/packs/donnees.mjs ou de PRODUITS`);
  return { pre, ...t, nom: p.nom, statut: statutTemplate(pre) };
}

export function calculerPack(code) {
  const pack = PACKS[code], page = PAGES[code];
  if (!page) throw new Error(`Pack ${code} : textes absents de outils/packs/donnees.mjs`);
  const templates = pack.produits.filter((p) => PRODUITS[p]).map(infoTemplate);
  // À venir : templates pas encore construits (PREVUS), ou déjà en ligne mais pas encore dans le pack (annoncés dans
  // `prevus` de la page, ex. un template « bientôt » destiné à un pack déjà vendu : ni le prix ni les accès ne changent).
  const prevus = [...(page.prevus || []), ...pack.produits.filter((p) => !PRODUITS[p])]
    .filter((p, i, t) => t.indexOf(p) === i && !(PRODUITS[p] && pack.produits.includes(p)))
    .map((p) => (PRODUITS[p] ? { ...infoTemplate(p), statut: 'prevu' } : { pre: p, ...PREVUS[p] }));
  // Moins de deux templates prêts : prix prévu, calculé sur le pack complet (templates prêts et à venir).
  const indicatif = templates.length < 2;
  const prix = prixPack([...templates, ...(indicatif ? prevus : [])].map((t) => t.prix));
  const enVente = Boolean(pack.gumroad && pack.permalien) && templates.every((t) => t.statut === 'vente');
  return { code, ...pack, ...page, templates, prevus, indicatif, nombre: indicatif ? templates.length + prevus.length : templates.length, ...prix, option: prixOption(prix.prix), enVente: enVente && !indicatif };
}

// --- Gabarit commun ------------------------------------------------------------------------------
const tete = ({ titre, description, canonical, noindex }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#FBF7F1">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="https://qm-engineering.fr${canonical}">`}
<link rel="stylesheet" href="/assets/fonts/outfit.css?v=20261113">
<link rel="icon" type="image/svg+xml" href="/assets/qme-symbole.svg?v=20261026">
<link rel="stylesheet" href="/assets/site.css?v=2026112201">
<link rel="stylesheet" href="/assets/packs.css?v=${V}">
</head>
<body>

<header class="topbar">
  <a class="brand" href="/" aria-label="QME, accueil">
    <svg viewBox="0 0 80 80" width="34" height="34" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="#141414"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#FBF7F1"/></svg>
    <span class="wordmark"><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>
    <span class="tagline">Quentin Morel<br>Engineering</span>
  </a>
  <nav aria-label="Navigation principale">
    <a href="/sur-mesure/">Sur mesure</a>
    <a href="/templates/">Templates</a>
    <a href="/packs/" aria-current="page">Packs</a>
    <a class="login" href="/connexion/">Connexion</a>
    <a class="cta" href="/contact/">Parler de votre projet</a>
  </nav>
  <button class="menu" type="button" aria-expanded="false" aria-label="Menu"><span></span><span></span></button>
</header>

<main>
`;
const pied = (scripts = '') => `</main>

<nav class="reseaux" aria-label="QME sur les réseaux">
  <a href="https://www.linkedin.com/company/qme-qm-engineering/" target="_blank" rel="noopener" aria-label="QME sur LinkedIn (nouvel onglet)" title="LinkedIn"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><rect x="3.5" y="9" width="3.6" height="11.5"/><circle cx="5.3" cy="5.2" r="2.1"/><path d="M10 9h3.4v1.6c.6-1 1.9-1.9 3.7-1.9 3.1 0 4.3 2 4.3 5.2v6.6h-3.6v-5.8c0-1.6-.4-2.7-1.9-2.7s-2.3 1.1-2.3 2.7v5.8H10z"/></svg></a>
  <a href="https://www.instagram.com/qmengineering/" target="_blank" rel="noopener" aria-label="QME sur Instagram (nouvel onglet)" title="Instagram"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg></a>
</nav>

<footer>
  <span>QME · Quentin Morel Engineering · © <span id="year"></span> · Mesure d'audience sans cookie (GoatCounter)</span>
  <span><a href="/">Accueil</a> · <a href="/sur-mesure/">Sur mesure</a> · <a href="/templates/">Templates</a> · <a href="/packs/">Packs</a> · <a href="/guides/">Guides</a> · <a href="/contact/">Contact</a> · <a href="/connexion/">Connexion</a> · <a href="/confidentialite/">Confidentialité</a></span>
</footer>

<script src="/assets/site.js?v=2026112201" defer></script>
${scripts}<script data-goatcounter="https://qme-engineering.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body>
</html>
`;

export const pastille = (id) => {
  const c = CIBLES[id];
  if (!c) throw new Error(`Cible inconnue : ${id}`);
  return `<li class="cible c-${c.couleur} f-${c.forme}">${esc(c.nom)}</li>`;
};
const pastilles = (ids) => `<ul class="cibles" aria-label="Pour qui">${ids.map(pastille).join('')}</ul>`;
const etiquetteStatut = (s) => s === 'vente' ? '<span class="etat vente">Disponible</span>' : s === 'bientot' ? '<span class="etat bientot">Bientôt</span>' : '<span class="etat prevu">En préparation</span>';

function blocPrix(p, { court = false } = {}) {
  const barre = p.pct ? `<s>${euros(p.valeur)}</s> <span class="remise">−${p.pct} %</span>` : '';
  if (court) return `<span class="prix-pack"><b>${euros(p.prix)}</b>${barre}</span>`;
  return `<div class="prix-pack-bloc${p.enVente ? '' : ' prochaine'}">
        <p class="prix-pack"><b>${euros(p.prix)}</b>${barre}</p>
        <p class="detail">${p.indicatif ? `Prix prévu pour les ${p.nombre} templates, calculé avec le même barème · ` : `${p.templates.length} templates · `}${p.pct ? `${p.indicatif ? 'économie prévue' : 'vous économisez'} ${euros(p.economie)} sur l’achat séparé` : 'achat unique'}</p>
        <div class="option-pack"><b>Option ${OPTION.nom} : +${euros(p.option)}</b><span>Les templates ajoutés au pack après votre achat s’ouvrent avec la même clé${p.prevus.length && !p.indicatif ? `, à commencer par ${p.prevus.length === 1 ? 'le template annoncé' : `les ${p.prevus.length} templates annoncés`}` : ''}.</span></div>
        ${p.enVente ? '' : p.indicatif ? '<p class="prochaine-note"><b>Pack en préparation.</b> Il sera mis en vente quand ses templates seront prêts.</p>' : '<p class="prochaine-note"><b>Mise en vente prochaine.</b> Les démos sont libres dès maintenant.</p>'}
      </div>`;
}

// --- Page d'un pack -------------------------------------------------------------------------------
function pagePack(p) {
  const module = `pack-${p.slug}`;
  const actions = p.enVente
    ? `<a class="btn primary" href="${GUMROAD}${p.permalien}?wanted=true&amp;variant=Pack" data-goatcounter-click="achat-${module}">Acheter le pack</a><a class="btn" href="${GUMROAD}${p.permalien}?wanted=true&amp;variant=${encodeURIComponent(OPTION.nom)}" data-goatcounter-click="achat-${module}-evolutif">Avec l’option (+${euros(p.option)})</a>`
    : `<button class="btn interet" type="button" data-interet="${module}">Je suis intéressé(e)</button><a class="btn" href="#contenu">Voir le contenu</a>`;
  // Essai gratuit des templates du pack (audit étudiants du 22/11/2026) : annoncé sous les boutons d'achat.
  const nbEssai = p.templates.filter((t) => PRODUITS_ESSAI.includes(t.pre)).length;
  const essai = p.enVente && nbEssai ? `<p class="essai-pack">Pas encore sûr(e) ? ${nbEssai === p.templates.length ? 'Chaque outil du pack' : 'Les outils marqués « Essai gratuit »'} s’essaie ${ESSAI.jours} jours gratuitement, sans carte bancaire. Si vous prenez ensuite le pack, vos données d’essai sont reprises. <a href="#contenu">Choisir un outil à essayer</a></p>` : '';
  const note = p.enVente ? essai : `<p class="interet-note" data-interet-note="${module}" role="status" aria-live="polite">Un clic pour être compté parmi les personnes qui attendent ce pack. Rien d'autre n'est enregistré.</p>`;
  const cartes = p.templates.map((t) => `<li class="t-pack">
        ${vignette(t.slug)}<div class="t-tete"><b>${esc(t.nom)}</b>${etiquetteStatut(t.statut)}</div>
        <p>${esc(t.phrase)}</p>
        <div class="t-pied"><span>${euros(t.prix)} seul</span><a href="/catalogue/${t.slug}/">Détail</a><a href="/templates/${t.slug}/?demo">Démo</a>${PRODUITS_ESSAI.includes(t.pre) ? `<a href="/essai/?t=${t.slug}" data-goatcounter-click="essai-${module}-${t.slug}">Essai gratuit</a>` : ''}</div>
      </li>`).join('\n      ');
  const prevus = p.prevus.length ? `
  <div class="prevus">
    <h3>${p.indicatif ? 'Les templates du pack, en préparation' : 'À venir dans ce pack'}</h3>
    <p>${p.indicatif ? 'Ces templates sont en cours de développement. Le pack sera mis en vente quand ils seront prêts ; cliquez sur « Je suis intéressé(e) » pour être prévenu.' : `Ces templates sont en préparation et rejoindront le pack à leur sortie. Avec l’option ${OPTION.nom} (+${euros(p.option)}), ils s’ouvriront avec votre clé, sans rien payer de plus.`}</p>
    <ul>${p.prevus.map((t) => `<li><b>${esc(t.nom)}</b><span>${esc(t.phrase)}</span>${p.indicatif ? `<em>${euros(t.prix)}</em>` : ''}</li>`).join('')}</ul>
  </div>` : '';
  const dansPack = (pre) => p.templates.some((t) => t.pre === pre);
  const parcours = p.parcours.filter(([pre]) => PRODUITS[pre] || PREVUS[pre]).map(([pre, texte], i) => `<li><span class="n">${i + 1}</span><div><b>${esc(PRODUITS[pre]?.nom ?? PREVUS[pre].nom)}</b>${dansPack(pre) ? '' : ' <span class="etat prevu">À venir</span>'}<p>${esc(texte)}</p></div></li>`).join('\n      ');
  return tete({
    titre: `${p.nom} · QME`,
    description: `${p.accroche} ${p.resume} ${p.nombre} templates pour ${euros(p.prix)} au lieu de ${euros(p.valeur)}.`,
    canonical: `/packs/${p.slug}/`,
  }) + `<nav class="fil" aria-label="Fil d'Ariane"><a href="/templates/">Templates</a><span>›</span><a href="/packs/">Packs</a><span>›</span><b>${esc(p.nom.replace(/^Pack /, ''))}</b></nav>
<section class="pack-hero c-${p.couleur}">
  <div class="pack-hero-texte">
    <p class="eyebrow">${esc(p.nom)}</p>
    <h1>${esc(p.accroche)}</h1>
    <p class="lead">${esc(p.resume)}</p>
    ${pastilles(p.cibles)}
  </div>
  <div class="pack-hero-achat">
    ${blocPrix(p)}
    <div class="actions">${actions}</div>
    ${note}
  </div>
</section>

<section class="section pack-section">
  <div class="section-head"><h2>Pour qui ?</h2><p>${esc(p.pourQui)}</p></div>
  <ul class="arguments">${p.arguments.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
</section>

<section class="section pack-section">
  <div class="section-head"><h2>Pourquoi tout avoir</h2><p>Chaque outil règle une étape ; ensemble, ils couvrent le parcours en entier.</p></div>
  <ol class="parcours">
      ${parcours}
  </ol>
</section>

<section class="section pack-section" id="contenu">
  <div class="section-head"><h2>Le contenu du pack</h2><p>${p.indicatif ? `${p.nombre} templates prévus, ${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}.${p.templates.length ? ' La démo du template prêt s’ouvre sans inscription.' : ''}` : `${p.templates.length} templates, ${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}. Chaque démo s’ouvre sans inscription${nbEssai ? `, et ${nbEssai === p.templates.length ? 'chaque outil' : 'les outils marqués « Essai gratuit »'} s’essaie ${ESSAI.jours} jours, sans carte bancaire` : ''}.`}</p></div>
  ${cartes ? `<ul class="templates-pack">\n      ${cartes}\n  </ul>` : ''}${prevus}
</section>

<section class="section pack-section" id="questions">
  <div class="section-head"><h2>Questions fréquentes</h2></div>
  <div class="faq">
    <details><summary>Comment j’accède aux templates du pack ?</summary><p>Vous recevez une seule clé par e-mail après l’achat. Collez-la sur <a href="/connexion/">qm-engineering.fr/connexion</a> : votre tableau de bord du pack s’ouvre, avec un bouton par template. La même clé fonctionne sur tous vos appareils.</p></details>
    <details><summary>Les templates partagent-ils leurs données ?</summary><p>Non : chaque template garde ses propres données, synchronisées sur vos appareils. Le pack réunit les outils et l’accès, pas une base commune.</p></details>
    <details><summary>Et les templates ajoutés plus tard ?</summary><p>Le pack ouvre les templates qu’il contient le jour de votre achat. Avec l’option ${OPTION.nom} (+${euros(p.option)}), chaque template ajouté au pack ensuite s’ouvre aussi avec votre clé, sans rien payer de plus. Le prix du pack peut augmenter pour les nouveaux acheteurs ; le vôtre est réglé une fois pour toutes.</p></details>
    <details><summary>J’ai déjà acheté un des templates du pack.</summary><p>Écrivez à <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a> avant d’acheter le pack : nous trouverons une solution pour ne pas vous le faire payer deux fois.</p></details>
    <details><summary>Est-ce un abonnement ?</summary><p>Non : un achat unique, paiement sécurisé par Gumroad, sans renouvellement.</p></details>
  </div>
</section>

<section class="rappel-templates"><p><b>Il vous faut une autre combinaison ?</b> Composez votre pack sur mesure : cochez les templates qui vous servent, la remise monte avec leur nombre, jusqu’à −25 %.</p><a class="btn" href="/packs/composer/">Composer mon pack</a></section>
<nav class="pager" aria-label="Pages"><a class="prec" href="/packs/"><span>Page précédente</span><b>Tous les packs</b></a><a class="suiv" href="/packs/composer/"><span>Page suivante</span><b>Pack sur mesure</b></a></nav>
` + pied();
}

const bareme = () => `<ul class="bareme" aria-label="Remise selon le nombre de templates">${[...REMISES].reverse().map(([n, pct]) => `<li><b>−${pct} %</b><span>${n === 5 ? '5 templates et plus' : `${n} templates`}</span></li>`).join('')}</ul>`;

// Packs professionnels (le reste est rangé en « Vie personnelle »).
const PACKS_PRO = new Set(['PFG', 'PFC', 'PBT', 'PPE', 'PMG', 'PAS', 'PXP', 'PCA', 'PNS']);
const pourPack = (p) => (PACKS_PRO.has(p.code) ? 'pro' : 'perso');
const nbVente = (p) => p.templates.filter((t) => t.statut === 'vente').length;
// Pack pas encore achetable : une phrase unique tant qu'aucun pack n'est en vente, sinon un badge par pack.
let aucunEnVente = true;
const badgeBientot = (p) => (!p.enVente && !aucunEnVente ? ' <em class="bientot-pack">Bientôt</em>' : '');
const noteBientot = () => (aucunEnVente ? '<p class="note-packs">Les packs seront mis en vente prochainement. Les templates déjà disponibles s’achètent dès maintenant à l’unité.</p>' : '');

// Carte d'un pack pour la page /packs/ (simplifiée le 20/11/2026, comme le catalogue des templates) : mosaïque des
// vignettes de ses templates, nom, taille, remise et prix ; un clic ouvre la page du pack (contenu détaillé, achat ou
// « Je suis intéressé(e) »). Mosaïque de 4 vignettes, ou 2, ou 1 selon le nombre de templates qui en ont une.
function cartePack(p) {
  const imgs = [...p.templates, ...p.prevus].map((t) => t.slug).filter((slug) => slug && VIGNETTES[slug]);
  const k = imgs.length >= 4 ? 4 : imgs.length >= 2 ? 2 : imgs.length;
  return `<a class="pack-carte c-${p.couleur}" id="${p.slug}" href="/packs/${p.slug}/" data-cibles="${p.cibles.join(' ')}" data-pour="${pourPack(p)}">
    <span class="mosaique m${k}" aria-hidden="true">${imgs.slice(0, k).map(vignette).join('')}</span>
    <span class="pc-corps">
      <b>${esc(p.nom.replace(/^Pack /, ''))}${badgeBientot(p)}</b>
      <small>${p.nombre} templates${p.indicatif ? ' prévus' : ''}${p.pct ? ` · −${p.pct} %` : ''}</small>
      <span class="pc-prix"><b>${euros(p.prix)}</b>${p.pct ? `<s>${euros(p.valeur)}</s>` : ''}</span>
    </span>
  </a>`;
}

function pageListe(packs) {
  // Filtre « Je suis… » réduit aux publics principaux : ceux qui concernent au moins deux packs.
  const occurrences = {};
  for (const p of packs) for (const id of p.cibles) occurrences[id] = (occurrences[id] || 0) + 1;
  const ids = Object.keys(occurrences).filter((id) => occurrences[id] >= 2).sort((a, b) => occurrences[b] - occurrences[a]);
  const groupe = (pour) => packs.filter((p) => pourPack(p) === pour);
  return tete({
    titre: 'Packs de templates · QME',
    description: 'Les packs de templates QME, par métier et par situation : contenu détaillé, prix, remise jusqu’à 25 % et option Pack évolutif. Ou composez votre pack sur mesure.',
    canonical: '/packs/',
  }) + `<nav class="fil" aria-label="Fil d'Ariane"><a href="/templates/">Templates</a><span>›</span><b>Packs</b></nav>
<section class="hero packs-hero">
  <div class="hero-copy">
    <p class="eyebrow">Packs de templates · une seule clé</p>
    <h1>Les outils qui vont ensemble, <mark>au prix d’un pack.</mark></h1>
    <p class="lead">Chaque pack réunit les templates d’un même métier ou d’une même situation. <strong>Plus il y a de templates, plus la remise monte</strong>, jusqu’à −25 %, et tout s’ouvre avec une seule clé, sur tous vos appareils.</p>
    <div class="actions"><a class="btn primary" href="#tous-les-packs">Voir les ${packs.length} packs</a><a class="btn" href="/packs/composer/">Composer mon pack</a></div>
  </div>
  <div class="bareme-bloc">
    <p class="label">La remise suit le nombre de templates</p>
    ${bareme()}
    <p class="detail">Même barème pour les packs prêts à l’emploi et pour le pack sur mesure. Option ${OPTION.nom} : les futurs templates du pack inclus, pour ${OPTION.pct} % du prix du pack (${euros(OPTION.minimum)} minimum).</p>
  </div>
</section>

<section class="section" id="tous-les-packs">
  <div class="section-head"><h2>Tous les packs</h2><p>Ouvrez un pack pour voir son contenu, l’état de chaque template et l’acheter.</p></div>
  <div class="filtre-packs" role="group" aria-label="Je suis…" data-filtre-packs>
    <span class="label-filtre">Je suis…</span>
    <button type="button" class="cible-filtre" aria-pressed="true" data-cible="">Tous les publics</button>
    ${ids.map((id) => `<button type="button" class="cible cible-filtre c-${CIBLES[id].couleur} f-${CIBLES[id].forme}" aria-pressed="false" data-cible="${id}">${esc(CIBLES[id].nom)}</button>`).join('\n    ')}
  </div>
  ${noteBientot()}
  <p class="compte-packs" data-compte-packs aria-live="polite"></p>
  <div class="groupe-packs" data-groupe="pro">
  <h3 class="titre-groupe">Professionnel</h3>
  <div class="grille-packs">
  ${groupe('pro').map(cartePack).join('\n  ')}
  </div>
  </div>
  <div class="groupe-packs" data-groupe="perso">
  <h3 class="titre-groupe">Vie personnelle</h3>
  <div class="grille-packs">
  ${groupe('perso').map(cartePack).join('\n  ')}
  </div>
  </div>
</section>

<section class="rappel-templates"><p><b>Aucun pack ne vous ressemble ?</b> Cochez les templates dont vous avez besoin : le prix se calcule aussitôt, remise comprise.</p><a class="btn primary" href="/packs/composer/">Composer mon pack sur mesure</a></section>

<section class="section comment-packs">
  <div class="section-head"><h2>Comment fonctionne un pack</h2><p>Un achat, une clé, tous les outils du pack.</p></div>
  <ol class="steps">
    <li class="s1"><b>Vous achetez le pack</b><span>Paiement unique et sécurisé par Gumroad, sans abonnement.</span></li>
    <li class="s2"><b>Vous recevez une clé</b><span>Une seule clé, quel que soit le nombre de templates.</span></li>
    <li class="s3"><b>Votre tableau de bord s’ouvre</b><span>Sur <a href="/connexion/">la page Connexion</a>, la clé ouvre l’espace du pack : un bouton par template.</span></li>
    <li><b>Le pack peut grandir</b><span>Avec l’option ${OPTION.nom}, les templates ajoutés plus tard s’ouvrent avec la même clé.</span></li>
  </ol>
</section>
` + pied(`<script src="/assets/packs.js?v=${V}" defer></script>\n`);
}

// --- Pack sur mesure ------------------------------------------------------------------------------
function pageComposer(packs) {
  const liste = Object.keys(TEMPLATES).filter((p) => PRODUITS[p]).map(infoTemplate)
    .sort((a, b) => a.pour.localeCompare(b.pour) || a.nom.localeCompare(b.nom, 'fr'));
  const donnees = {
    remises: REMISES,
    achat: ACHAT_SUR_MESURE.permalien ? { url: GUMROAD + ACHAT_SUR_MESURE.permalien, champ: ACHAT_SUR_MESURE.champ } : null,
    templates: liste.map(({ pre, nom, prix, statut, pour, slug }) => ({ pre, nom, prix, statut, pour, slug })),
    packs: packs.map((p) => ({ slug: p.slug, nom: p.nom, produits: p.templates.map((t) => t.pre), prix: p.prix })),
  };
  const groupe = (pour, titre) => `<fieldset class="groupe-compo">
      <legend>${titre}</legend>
      <ul>${liste.filter((t) => t.pour === pour).map((t) => `<li><label><input type="checkbox" value="${t.pre}" data-prix="${t.prix}"><span class="nom">${esc(t.nom)}</span><span class="phrase">${esc(t.phrase)}</span><span class="droite">${etiquetteStatut(t.statut)}<b>${euros(t.prix)}</b></span></label></li>`).join('')}</ul>
    </fieldset>`;
  return tete({
    titre: 'Composer votre pack sur mesure · QME',
    description: 'Cochez les templates QME dont vous avez besoin : la remise monte avec leur nombre, de 10 % à 25 %. Une seule clé pour tout ouvrir.',
    canonical: '/packs/composer/',
  }) + `<nav class="fil" aria-label="Fil d'Ariane"><a href="/templates/">Templates</a><span>›</span><a href="/packs/">Packs</a><span>›</span><b>Pack sur mesure</b></nav>
<section class="section composer" data-composer>
  <div class="composer-tete">
    <p class="eyebrow">Pack sur mesure</p>
    <h1>Composez votre pack.</h1>
    <p class="lead">Cochez les templates qui vous servent. Dès deux templates, la remise s’applique et monte avec leur nombre : −10 % pour 2, −15 % pour 3, −20 % pour 4, −25 % à partir de 5.</p>
  </div>
  <div class="composer-grille">
    <form class="composer-choix" id="composer" aria-label="Templates du pack">
      ${groupe('pro', 'Professionnel')}
      ${groupe('perso', 'Vie personnelle')}
    </form>
    <a class="composer-barre" href="#resume-titre" data-barre aria-live="polite"><span data-barre-texte>Aucun template choisi</span><b>Voir mon pack</b></a>
    <aside class="composer-resume" aria-labelledby="resume-titre">
      <h2 id="resume-titre">Votre pack</h2>
      <p class="vide" data-vide>Aucun template choisi pour l’instant.</p>
      <ul class="choisis" data-choisis></ul>
      <dl class="totaux">
        <div><dt>Achat séparé</dt><dd data-valeur>0 €</dd></div>
        <div><dt>Remise</dt><dd data-remise>—</dd></div>
        <div class="total"><dt>Prix du pack</dt><dd data-total>0 €</dd></div>
      </dl>
      <p class="conseil" data-conseil aria-live="polite"></p>
      <div class="actions">
        <a class="btn primary" data-commander href="mailto:quentin.morel@qm-engineering.fr" aria-disabled="true">${ACHAT_SUR_MESURE.permalien ? 'Acheter ce pack' : 'Demander ce pack'}</a>
        <button class="btn interet" type="button" data-interet="pack-sur-mesure">Je suis intéressé(e)</button>
      </div>
      <p class="interet-note" data-interet-note="pack-sur-mesure" role="status" aria-live="polite">${ACHAT_SUR_MESURE.permalien ? 'Paiement sécurisé par Gumroad. Vous recevez une clé unique : collée sur la page Connexion, elle ouvre tous les templates choisis.' : 'Le paiement en ligne du pack sur mesure arrive bientôt. En attendant, « Demander ce pack » prépare un e-mail avec votre sélection : vous recevez un lien de paiement, puis une clé unique qui ouvre tous vos templates.'}</p>
    </aside>
  </div>
</section>
<script type="application/json" id="donnees-composer">${JSON.stringify(donnees).replace(/</g, '\\u003c')}</script>
<nav class="pager" aria-label="Pages"><a class="prec" href="/packs/"><span>Page précédente</span><b>Tous les packs</b></a><a class="suiv" href="/templates/"><span>Page suivante</span><b>Tous les templates</b></a></nav>
` + pied(`<script src="/assets/packs.js?v=${V}" defer></script>\n`);
}

// --- Espace de l'acheteur d'un pack ---------------------------------------------------------------
// Même composant que /connexion/ (assets/espace.js, espace.css) : recherche, épinglés, récents, thèmes.
// Données de thèmes : outils/connexion/generer.mjs (donneesEspace), écrites ici entre les marqueurs ESPACE.
const VE = '2026112204'; // version de assets/espace.js et espace.css
async function pageEspace() {
  const { produits, themes } = await donneesEspace();
  return tete({ titre: 'Mon pack · QME', description: 'Tableau de bord des applications de votre pack QME.', noindex: true })
      .replace('</head>', `<link rel="stylesheet" href="/assets/espace.css?v=${VE}">\n</head>`)
    + `<section class="espace espace-pack" data-espace>
  <div class="espace-tete">
    <div>
      <p class="eyebrow">Espace acheteurs · packs</p>
      <h1>Mes packs</h1>
      <p class="espace-nb" data-nb></p>
    </div>
    <a class="btn ajouter" href="#ajout-pack" data-ajouter hidden>+ Ajouter<span class="pc">&nbsp;un pack</span></a>
  </div>
  <p class="lead pack-intro" data-intro>Collez la clé de licence de votre pack : chacune de ses applications s’ouvre ensuite d’un clic. Vos données restent celles de votre clé, sur tous vos appareils.</p>
  <p class="erreur pack-alerte" data-alerte role="alert"></p>
  <div data-espace-corps hidden></div>
  <p class="vh" role="status" data-copie></p>
  <section class="gerer-packs" data-gerer hidden aria-labelledby="h-gerer">
    <h2 id="h-gerer">Gérer mes packs</h2>
    <div data-mes-packs></div>
    <p class="pack-espace-note">Pour partager une seule application (un budget commun, par exemple), envoyez son code de partage : bouton <span aria-hidden="true">⧉</span> à côté de l’étoile. Il n’ouvre que cette application. La clé du pack ouvre toutes vos applications : gardez-la pour vous.</p>
  </section>
  <div class="ajout-pack" id="ajout-pack">
    <h2 data-titre-ajout hidden>Ajouter un pack</h2>
    <form class="acces espace-form" id="espace-form" novalidate>
      <label>Clé de licence du pack ou code de pack
        <input type="text" id="espace-cle" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" required>
      </label>
      <p class="erreur" id="espace-erreur" role="alert"></p>
      <button class="btn primary" type="submit">Ouvrir mon pack</button>
    </form>
  </div>
</section>
` + pied(`<script>
/* ESPACE-DEBUT */
const PRODUITS=${JSON.stringify(produits)};
const THEMES=${JSON.stringify(themes)};
/* ESPACE-FIN */
</script>
<script src="/assets/espace.js?v=${VE}" defer></script>
<script src="/assets/packs.js?v=${V}" defer></script>\n`);
}

// --- Section « Packs » du catalogue /templates/ -----------------------------------------------------
// Depuis la réorganisation du 20/11/2026, un bandeau compact : la carte des prix complète vit sur /packs/ seulement.
function sectionCatalogue(packs) {
  const enVente = packs.filter((p) => p.enVente).length;
  const remiseMax = Math.max(...packs.map((p) => p.pct || 0));
  return `<!-- packs:debut (généré par outils/packs/generer.mjs, ne pas modifier à la main) -->
<section class="section packs-bandeau" id="packs" aria-labelledby="packs-titre">
  <div>
    <h2 id="packs-titre">Les packs : jusqu’à −${remiseMax} %</h2>
    <p>Les templates qui vont ensemble, réunis par métier ou par situation, ouverts avec une seule clé. ${enVente} pack${enVente > 1 ? 's' : ''} en vente, ou le vôtre à composer.</p>
  </div>
  <div class="actions">
    <a class="btn primary" href="/packs/">Voir les packs</a>
    <a class="btn" href="/packs/composer/">Composer mon pack</a>
  </div>
</section>
<!-- packs:fin -->`;
}

async function ecrire(chemin, contenu) {
  const complet = RACINE + chemin;
  await mkdir(complet.replace(/\/[^/]+$/, ''), { recursive: true });
  // Données structurées (fil d'Ariane, FAQ visibles) des pages publiques ; l'espace acheteurs est en noindex.
  const canonique = contenu.match(/rel="canonical" href="([^"]+)"/);
  if (canonique && !chemin.startsWith('packs/espace/')) contenu = avecDonnees(contenu, canonique[1]);
  await writeFile(complet, contenu);
}

export async function generer() {
  VIGNETTES = lireVignettes(await readFile(RACINE + 'templates/index.html', 'utf8'));
  const packs = Object.keys(PACKS).map(calculerPack);
  aucunEnVente = !packs.some((p) => p.enVente);
  for (const p of packs) await ecrire(`packs/${p.slug}/index.html`, pagePack(p));
  await ecrire('packs/index.html', pageListe(packs));
  await ecrire('packs/composer/index.html', pageComposer(packs));
  await ecrire('packs/espace/index.html', await pageEspace());
  const cat = await readFile(RACINE + 'templates/index.html', 'utf8');
  const section = sectionCatalogue(packs);
  const re = /<!-- packs:debut[\s\S]*?<!-- packs:fin -->/;
  const nouveau = re.test(cat) ? cat.replace(re, section)
    : cat.replace('<section class="section" id="fonctionnement"', `${section}\n\n<section class="section" id="fonctionnement"`);
  if (!nouveau.includes('packs:debut')) throw new Error('Section packs : point d’insertion introuvable dans templates/index.html');
  // La section des packs a besoin de sa feuille de style sur le catalogue.
  const avecStyle = nouveau.includes('/assets/packs.css') ? nouveau.replace(/\/assets\/packs\.css\?v=[0-9]+/, `/assets/packs.css?v=${V}`)
    : nouveau.replace(/(<link rel="stylesheet" href="\/assets\/site\.css[^>]*>)/, `$1\n<link rel="stylesheet" href="/assets/packs.css?v=${V}">`);
  if (!avecStyle.includes('/assets/packs.css')) throw new Error('packs.css : insertion impossible dans templates/index.html');
  await writeFile(RACINE + 'templates/index.html', avecStyle);
  return packs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packs = await generer();
  for (const p of packs) console.log(`${p.enVente ? 'en vente' : 'bientôt '} ${p.slug.padEnd(22)} ${String(p.templates.length).padStart(2)} templates  ${euros(p.valeur).padStart(9)} → ${euros(p.prix).padStart(8)} (−${p.pct} %)${p.prevus.length ? `  + ${p.prevus.length} à venir` : ''}`);
}
