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

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const V = '2026111404';
const GUMROAD = 'https://qmengineering.gumroad.com/l/';

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
  const prevus = [...(page.prevus || []), ...pack.produits.filter((p) => !PRODUITS[p])]
    .filter((p, i, t) => t.indexOf(p) === i && !PRODUITS[p]).map((p) => ({ pre: p, ...PREVUS[p] }));
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
<link rel="stylesheet" href="/assets/site.css?v=2026111501">
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
    <a href="/references/">Références</a>
    <a href="/methode/">Méthode</a>
    <a class="login" href="/connexion/">Connexion</a>
    <a class="cta" href="/contact/">Parler de votre projet</a>
  </nav>
  <button class="menu" type="button" aria-expanded="false" aria-label="Menu"><span></span><span></span></button>
</header>

<main>
`;
const pied = (scripts = '') => `</main>

<footer>
  <span>QME · Quentin Morel Engineering · © <span id="year"></span> · Mesure d'audience sans cookie (GoatCounter)</span>
  <span><a href="/">Accueil</a> · <a href="/sur-mesure/">Sur mesure</a> · <a href="/templates/">Templates</a> · <a href="/packs/">Packs</a> · <a href="/contact/">Contact</a> · <a href="/connexion/">Connexion</a> · <a href="/confidentialite/">Confidentialité</a></span>
</footer>

<script src="/assets/site.js?v=2026111308" defer></script>
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
  const note = p.enVente ? '' : `<p class="interet-note" data-interet-note="${module}" role="status" aria-live="polite">Un clic pour être compté parmi les personnes qui attendent ce pack. Rien d'autre n'est enregistré.</p>`;
  const cartes = p.templates.map((t) => `<li class="t-pack">
        <div class="t-tete"><b>${esc(t.nom)}</b>${etiquetteStatut(t.statut)}</div>
        <p>${esc(t.phrase)}</p>
        <div class="t-pied"><span>${euros(t.prix)} seul</span><a href="/catalogue/${t.slug}/">Détail</a><a href="/templates/${t.slug}/?demo">Démo</a></div>
      </li>`).join('\n      ');
  const prevus = p.prevus.length ? `
  <div class="prevus">
    <h3>${p.indicatif ? 'Les templates du pack, en préparation' : 'À venir dans ce pack'}</h3>
    <p>${p.indicatif ? 'Ces templates sont en cours de développement. Le pack sera mis en vente quand ils seront prêts ; cliquez sur « Je suis intéressé(e) » pour être prévenu.' : `Ces templates sont en préparation et rejoindront le pack à leur sortie. Avec l’option ${OPTION.nom} (+${euros(p.option)}), ils s’ouvriront avec votre clé, sans rien payer de plus.`}</p>
    <ul>${p.prevus.map((t) => `<li><b>${esc(t.nom)}</b><span>${esc(t.phrase)}</span>${p.indicatif ? `<em>${euros(t.prix)}</em>` : ''}</li>`).join('')}</ul>
  </div>` : '';
  const parcours = p.parcours.filter(([pre]) => PRODUITS[pre] || PREVUS[pre]).map(([pre, texte], i) => `<li><span class="n">${i + 1}</span><div><b>${esc(PRODUITS[pre]?.nom ?? PREVUS[pre].nom)}</b>${PRODUITS[pre] ? '' : ' <span class="etat prevu">À venir</span>'}<p>${esc(texte)}</p></div></li>`).join('\n      ');
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
  <div class="section-head"><h2>Le contenu du pack</h2><p>${p.indicatif ? `${p.nombre} templates prévus, ${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}.${p.templates.length ? ' La démo du template prêt s’ouvre sans inscription.' : ''}` : `${p.templates.length} templates, ${euros(p.valeur)} à l’achat séparé, ${euros(p.prix)} en pack${p.pct ? ` (−${p.pct} %)` : ''}. Chaque démo s’ouvre sans inscription.`}</p></div>
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

// --- Carte des prix (section « Packs » du catalogue /templates/) ------------------------------------
// Deux colonnes, Professionnel et Vie personnelle : nom, points de conduite, prix ; en dessous le nombre de
// templates, la remise et le nombre déjà disponibles. Chaque ligne ouvre le pack sur la page /packs/.
function cartePrix(packs) {
  const ligne = (p) => `<li><a href="/packs/#${p.slug}"><span class="nm">${esc(p.nom.replace(/^Pack /, ''))}${badgeBientot(p)}</span><span class="pts" aria-hidden="true"></span><b>${euros(p.prix)}</b><small>${p.nombre} templates${p.indicatif ? ' prévus' : ''}${p.pct ? ` · −${p.pct} %` : ''} · ${disponibles(p)}</small></a></li>`;
  const colonne = (pour, titre) => `<div><h3>${titre}</h3><ul>${packs.filter((p) => pourPack(p) === pour).map(ligne).join('')}</ul></div>`;
  return `${noteBientot()}<div class="carte-prix">
    ${colonne('pro', 'Professionnel')}
    ${colonne('perso', 'Vie personnelle')}
  </div>`;
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
const disponibles = (p) => { const n = nbVente(p); return n ? `${n} disponible${n > 1 ? 's' : ''}` : 'aucun encore disponible'; };

// Ligne dépliable d'un pack pour la page /packs/ (décision de Quentin, 14/11/2026) : fermée, nom, taille,
// prix et remise ; ouverte, accroche, jauge de disponibilité, contenu, publics, prix détaillé et actions.
function jauge(p) {
  const nb = (s) => p.templates.filter((t) => t.statut === s).length;
  const segs = [...p.templates.map((t) => t.statut), ...p.prevus.map(() => 'prevu')].map((s) => `<i class="${s}"></i>`).join('');
  const leg = [[nb('vente'), 'disponible', 'disponibles'], [nb('bientot'), 'bientôt', 'bientôt'], [p.prevus.length, 'en préparation', 'en préparation']]
    .filter(([n]) => n).map(([n, un, plus]) => `${n} ${n > 1 ? plus : un}`).join(' · ');
  return `<div class="jauge-pack"><span class="segments" aria-hidden="true">${segs}</span><span class="legende">${leg}</span></div>`;
}
function lignePack(p) {
  const module = `pack-${p.slug}`;
  const lignes = p.templates.map((t) => `<li><b>${esc(t.nom)}</b>${etiquetteStatut(t.statut)}<span class="meta">${euros(t.prix)} seul · <a href="/catalogue/${t.slug}/">détail</a> · <a href="/templates/${t.slug}/?demo">démo</a></span></li>`).join('');
  const prevus = p.prevus.map((t) => `<li class="prevu"><b>${esc(t.nom)}</b>${etiquetteStatut('prevu')}</li>`).join('');
  const actions = p.enVente
    ? `<a class="btn primary" href="${GUMROAD}${p.permalien}?wanted=true&amp;variant=Pack">Acheter le pack</a><a class="btn" href="/packs/${p.slug}/">Voir le pack</a>`
    : `<a class="btn primary" href="/packs/${p.slug}/">Voir le pack</a><button class="btn interet" type="button" data-interet="${module}">Je suis intéressé(e)</button>`;
  return `<details class="pack-ligne c-${p.couleur}" id="${p.slug}" data-cibles="${p.cibles.join(' ')}" data-pour="${pourPack(p)}">
    <summary>
      <span class="carre" aria-hidden="true"></span>
      <span class="nm"><b>${esc(p.nom.replace(/^Pack /, ''))}${badgeBientot(p)}</b><small>${p.nombre} templates${p.indicatif ? ' prévus' : ''} · ${disponibles(p)}</small></span>
      <span class="px"><b>${euros(p.prix)}</b>${p.pct ? `<small>−${p.pct} %</small>` : ''}</span>
      <span class="chevron" aria-hidden="true"></span>
    </summary>
    <div class="pl-corps">
      <div class="pl-contenu">
        <p class="accroche">${esc(p.accroche)}</p>
        <p class="resume">${esc(p.resume)}</p>
        ${jauge(p)}
        <ul class="contenu-ligne">${lignes}${prevus}</ul>
        ${pastilles(p.cibles)}
      </div>
      <div class="pl-achat">
        <p class="prix-pack"><b>${euros(p.prix)}</b>${p.pct ? `<s>${euros(p.valeur)}</s> <span class="remise">−${p.pct} %</span>` : ''}</p>
        <p class="detail">${p.indicatif ? 'Prix prévu, calculé avec le barème' : (p.pct ? `${euros(p.economie)} économisés sur l’achat séparé` : 'Achat unique')}</p>
        <p class="option-ligne"><b>Option ${OPTION.nom} : +${euros(p.option)}</b><span>les templates ajoutés plus tard, avec la même clé</span></p>
        <div class="actions">${actions}</div>
        ${p.enVente ? '' : `<p class="interet-note" data-interet-note="${module}" role="status" aria-live="polite">${p.indicatif ? 'Pack en préparation : un clic pour être prévenu de sa sortie.' : 'Mise en vente prochaine : un clic pour être compté parmi les intéressés.'}</p>`}
      </div>
    </div>
  </details>`;
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

<section class="section comment-packs">
  <div class="section-head"><h2>Comment fonctionne un pack</h2><p>Un achat, une clé, tous les outils du pack.</p></div>
  <ol class="steps">
    <li class="s1"><b>Vous achetez le pack</b><span>Paiement unique et sécurisé par Gumroad, sans abonnement.</span></li>
    <li class="s2"><b>Vous recevez une clé</b><span>Une seule clé, quel que soit le nombre de templates.</span></li>
    <li class="s3"><b>Votre tableau de bord s’ouvre</b><span>Sur <a href="/connexion/">la page Connexion</a>, la clé ouvre l’espace du pack : un bouton par template.</span></li>
    <li><b>Le pack peut grandir</b><span>Avec l’option ${OPTION.nom}, les templates ajoutés plus tard s’ouvrent avec la même clé.</span></li>
  </ol>
</section>

<section class="section" id="tous-les-packs">
  <div class="section-head"><h2>Tous les packs</h2><p>Ouvrez un pack pour voir sur place son contenu, l’état de chaque template et son prix.</p></div>
  <div class="filtre-packs" role="group" aria-label="Je suis…" data-filtre-packs>
    <span class="label-filtre">Je suis…</span>
    <button type="button" class="cible-filtre" aria-pressed="true" data-cible="">Tous les publics</button>
    ${ids.map((id) => `<button type="button" class="cible cible-filtre c-${CIBLES[id].couleur} f-${CIBLES[id].forme}" aria-pressed="false" data-cible="${id}">${esc(CIBLES[id].nom)}</button>`).join('\n    ')}
  </div>
  ${noteBientot()}
  <p class="compte-packs" data-compte-packs aria-live="polite"></p>
  <div class="groupe-packs" data-groupe="pro">
  <h3 class="titre-groupe">Professionnel</h3>
  ${groupe('pro').map(lignePack).join('\n  ')}
  </div>
  <div class="groupe-packs" data-groupe="perso">
  <h3 class="titre-groupe">Vie personnelle</h3>
  ${groupe('perso').map(lignePack).join('\n  ')}
  </div>
</section>

<section class="rappel-templates"><p><b>Aucun pack ne vous ressemble ?</b> Cochez les templates dont vous avez besoin : le prix se calcule aussitôt, remise comprise.</p><a class="btn primary" href="/packs/composer/">Composer mon pack sur mesure</a></section>
<nav class="pager" aria-label="Pages"><a class="prec" href="/templates/"><span>Page précédente</span><b>Tous les templates</b></a><a class="suiv" href="/packs/composer/"><span>Page suivante</span><b>Pack sur mesure</b></a></nav>
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
function pageEspace() {
  return tete({ titre: 'Mon pack · QME', description: 'Tableau de bord des templates de votre pack QME.', noindex: true })
    + `<section class="section espace-pack" data-espace>
  <div class="composer-tete">
    <p class="eyebrow">Espace acheteurs · packs</p>
    <h1>Mes packs</h1>
    <p class="lead">Chaque template de votre pack s’ouvre d’un clic. Vos données restent celles de votre clé, sur tous vos appareils.</p>
  </div>
  <div data-mes-packs></div>
  <form class="acces espace-form" id="espace-form" novalidate>
    <label>Clé de licence du pack ou code de pack
      <input type="text" id="espace-cle" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" required>
    </label>
    <p class="erreur" id="espace-erreur" role="alert"></p>
    <button class="btn primary" type="submit">Ouvrir mon pack</button>
  </form>
</section>
` + pied(`<script src="/assets/packs.js?v=${V}" defer></script>\n`);
}

// --- Section « Packs » du catalogue /templates/ -----------------------------------------------------
function sectionCatalogue(packs) {
  return `<!-- packs:debut (généré par outils/packs/generer.mjs, ne pas modifier à la main) -->
<section class="section packs-catalogue" id="packs" aria-labelledby="packs-titre">
  <div class="section-head">
    <h2 id="packs-titre">Les packs : jusqu’à −25 %</h2>
    <p>Les templates qui vont ensemble, réunis par métier ou par situation, ouverts avec une seule clé. <a href="/packs/">Tous les packs</a> · <a href="/packs/composer/">composer le vôtre</a>.</p>
  </div>
  ${cartePrix(packs)}
  <p class="carte-prix-pied"><a href="/packs/composer/">Pack sur mesure</a> : cochez vos templates, −10 % dès deux, jusqu’à −25 % à partir de cinq.</p>
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
  const packs = Object.keys(PACKS).map(calculerPack);
  aucunEnVente = !packs.some((p) => p.enVente);
  for (const p of packs) await ecrire(`packs/${p.slug}/index.html`, pagePack(p));
  await ecrire('packs/index.html', pageListe(packs));
  await ecrire('packs/composer/index.html', pageComposer(packs));
  await ecrire('packs/espace/index.html', pageEspace());
  const cat = await readFile(RACINE + 'templates/index.html', 'utf8');
  const section = sectionCatalogue(packs);
  const re = /<!-- packs:debut[\s\S]*?<!-- packs:fin -->/;
  const nouveau = re.test(cat) ? cat.replace(re, section)
    : cat.replace('<section class="idee-bandeau"', `${section}\n\n<section class="idee-bandeau"`);
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
