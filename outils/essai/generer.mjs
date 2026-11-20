// Essai gratuit (décision de Quentin, 18/11/2026) : génère la page /essai/ et ajoute l'essai aux pages
// catalogue des templates ouverts à l'essai (PRODUITS_ESSAI : « vie personnelle », en vente, payants).
// Idempotent : une page déjà traitée n'est pas modifiée deux fois.
// Après : node outils/seo/donnees-structurees.mjs (FAQ des pages catalogue) puis node outils/sitemap/generer.mjs.
// Usage : node outils/essai/generer.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PRODUITS_ESSAI, ficheEssai } from '../../netlify/lib/essais.mjs';
import { ESSAI } from '../../netlify/lib/templates-acces.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const V_CSS = '2026112002';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0 })} €`;

export const FAQ_ESSAI = [
  ['Faut-il une carte bancaire ?', `Non. L'essai ne demande que votre adresse e-mail : aucune carte, aucun prélèvement, ni pendant ni après les ${ESSAI.jours} jours.`],
  ['Que se passe-t-il à la fin des 14 jours ?', `Rien n'est facturé. Vos données restent consultables (sans modification) pendant ${ESSAI.conservation} jours, puis elles sont effacées. Vous pouvez en télécharger une copie depuis les réglages du template.`],
  ['Si j\'achète, est-ce que je garde mes données ?', 'Oui. Après l\'achat sur Gumroad, saisissez la clé reçue par e-mail dans le template (bouton « J\'ai acheté ») : tout ce que vous avez saisi pendant l\'essai est repris, rien à refaire. Si vous achetez avec la même adresse e-mail que celle de l\'essai, la reprise se fait aussi sur un autre appareil.'],
  ['L\'essai est-il complet ?', 'Oui : toutes les fonctions, vos données enregistrées en ligne et synchronisées sur vos appareils (ordinateur, téléphone), comme après l\'achat.'],
  ['Quels e-mails vais-je recevoir ?', 'Quatre au plus, écrits par Quentin : votre code au démarrage, un rappel 3 jours avant la fin, un message à la fin de l\'essai et un dernier avant l\'effacement des données. Un lien en bas de chaque e-mail les arrête, et aucun n\'est envoyé après un achat. Les nouveautés QME (nouveaux templates, offres) ne vous sont envoyées que si vous cochez la case facultative prévue pour cela.'],
  ['Puis-je essayer plusieurs templates ?', 'Oui, un essai par template et par adresse e-mail. Pour plusieurs templates d\'un coup, regardez aussi les packs.'],
];

const tete = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Essai gratuit 14 jours des templates · QME</title>
<meta name="description" content="Essayez gratuitement un template QME pendant 14 jours, sans carte bancaire. Si vous achetez, vos données sont reprises ; sinon, rien n'est prélevé.">
<meta name="theme-color" content="#FBF7F1">
<link rel="canonical" href="https://qm-engineering.fr/essai/">
<link rel="stylesheet" href="/assets/fonts/outfit.css?v=20261113">
<link rel="icon" type="image/svg+xml" href="/assets/qme-symbole.svg?v=20261026">
<link rel="stylesheet" href="/assets/site.css?v=${V_CSS}">
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
    <a href="/templates/" aria-current="page">Templates</a>
    <a href="/packs/">Packs</a>
    <a class="login" href="/connexion/">Connexion</a>
    <a class="cta" href="/contact/">Parler de votre projet</a>
  </nav>
  <button class="menu" type="button" aria-expanded="false" aria-label="Menu"><span></span><span></span></button>
</header>

<main>
`;

const pied = `</main>

<nav class="reseaux" aria-label="QME sur les réseaux">
  <a href="https://www.linkedin.com/company/qme-qm-engineering/" target="_blank" rel="noopener" aria-label="QME sur LinkedIn (nouvel onglet)" title="LinkedIn"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><rect x="3.5" y="9" width="3.6" height="11.5"/><circle cx="5.3" cy="5.2" r="2.1"/><path d="M10 9h3.4v1.6c.6-1 1.9-1.9 3.7-1.9 3.1 0 4.3 2 4.3 5.2v6.6h-3.6v-5.8c0-1.6-.4-2.7-1.9-2.7s-2.3 1.1-2.3 2.7v5.8H10z"/></svg></a>
  <a href="https://www.instagram.com/qmengineering/" target="_blank" rel="noopener" aria-label="QME sur Instagram (nouvel onglet)" title="Instagram"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg></a>
</nav>

<footer>
  <span>QME · Quentin Morel Engineering · © <span id="year"></span> · Mesure d'audience sans cookie (GoatCounter)</span>
  <span><a href="/">Accueil</a> · <a href="/sur-mesure/">Sur mesure</a> · <a href="/templates/">Templates</a> · <a href="/packs/">Packs</a> · <a href="/guides/">Guides</a> · <a href="/contact/">Contact</a> · <a href="/connexion/">Connexion</a> · <a href="/confidentialite/">Confidentialité</a></span>
</footer>

<script src="/assets/site.js?v=2026112002" defer></script>
<script src="/assets/essai-page.js?v=${V_CSS}" defer></script>
<script data-goatcounter="https://qme-engineering.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body>
</html>
`;

export function pageEssai() {
  const fiches = PRODUITS_ESSAI.map(ficheEssai).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const options = fiches.map((f) => `        <option value="${f.slug}" data-prix="${f.prix}">${esc(f.nom)} · ${euros(f.prix)}</option>`).join('\n');
  const faq = FAQ_ESSAI.map(([q, r]) => `    <details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('\n');
  return `${tete}<nav class="fil" aria-label="Fil d'Ariane"><a href="/templates/">Templates</a><span>›</span><b>Essai gratuit</b></nav>
<section class="contact essai" id="essai">
  <div class="contact-copy">
    <p class="essai-surtitre">Templates vie personnelle</p>
    <h1 class="h-section">Essayez gratuitement pendant ${ESSAI.jours}&nbsp;jours.</h1>
    <p>Sans carte bancaire. Toutes les fonctions, vos données synchronisées sur vos appareils. Si le template vous rend service, vous l'achetez et <b>vous gardez tout ce que vous avez saisi</b>. Sinon, vous n'avez rien à faire.</p>
    <ol class="essai-etapes">
      <li><b>Lancez l'essai</b><span>Votre e-mail suffit : le template s'ouvre tout de suite.</span></li>
      <li><b>Utilisez-le ${ESSAI.jours} jours</b><span>Comme après l'achat, sur ordinateur et téléphone.</span></li>
      <li><b>Achetez ou arrêtez</b><span>Achat unique, données reprises. Ou rien du tout : aucun prélèvement.</span></li>
    </ol>
  </div>
  <form id="essai-form" novalidate>
    <label class="full">Template à essayer
      <select name="produit" required>
${options}
      </select>
    </label>
    <label>Prénom <small>(facultatif)</small><input name="prenom" autocomplete="given-name" maxlength="40" placeholder="Votre prénom"></label>
    <label>E-mail<input required type="email" name="email" autocomplete="email" inputmode="email" placeholder="vous@exemple.fr"></label>
    <label class="full essai-accord"><input type="checkbox" name="consentement" required> <span>J'accepte de recevoir les e-mails liés à mon essai (mon code, un rappel avant la fin, la fin de l'essai, l'effacement des données) : quatre au plus, arrêtables à tout moment.</span></label>
    <label class="full essai-accord"><input type="checkbox" name="nouveautes"> <span><b>Facultatif</b> : recevoir aussi les nouveautés QME (nouveaux templates, offres). Désinscription en un clic dans chaque e-mail.</span></label>
    <label class="hp-field" aria-hidden="true">Votre site web<input type="text" name="site_web" tabindex="-1" autocomplete="off"></label>
    <div class="form-end full">
      <button class="btn primary" type="submit" data-goatcounter-click="essai-lancer">Lancer mon essai gratuit</button>
    </div>
    <p id="essai-note" class="full" role="status" aria-live="polite">Sans la seconde case, votre adresse sert uniquement aux e-mails de l'essai et elle est effacée avec ses données. <a href="/confidentialite/#essai">Confidentialité</a></p>
  </form>
  <div id="essai-pret" class="essai-pret" hidden tabindex="-1">
    <h2>Votre essai est prêt.</h2>
    <p>Votre code d'essai (aussi envoyé par e-mail) :</p>
    <p class="essai-code" id="essai-code"></p>
    <p>Notez-le : il ouvre le template sur vos autres appareils. Fin de l'essai le <b id="essai-fin"></b>.</p>
    <div class="form-end"><a class="btn primary" id="essai-ouvrir" href="/templates/">Ouvrir mon template</a></div>
  </div>
</section>
<section class="section" id="questions">
  <div class="section-head">
    <h2>Questions sur l'essai</h2>
    <p>Une autre question : <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a>.</p>
  </div>
  <div class="faq">
${faq}
  </div>
</section>
<nav class="pager" aria-label="Pages"><a class="prec" href="/templates/"><span>Page précédente</span><b>Tous les templates</b></a><span></span></nav>
${pied}`;
}

// --- Pages catalogue -------------------------------------------------------------------------------
export function ajouterAuCatalogue(html, f) {
  if (html.includes(`/essai/?t=${f.slug}"`)) return html;
  const lien = `<a class="btn primary" href="/essai/?t=${f.slug}" data-goatcounter-click="essai-${f.slug}" data-goatcounter-title="Essai gratuit : ${esc(f.nom.toLowerCase())}">Essai gratuit 14 jours</a>`;
  // Boutons : l'essai passe en premier (bouton principal), « Acheter » devient secondaire.
  html = html.replace(/(<div class="actions">\s*)<a class="btn primary" (href="https:\/\/qmengineering\.gumroad\.com)/, `$1${lien}\n        <a class="btn" $2`);
  // Ligne de prix.
  html = html.replace(/(<div class="prix"><b>[^<]*<\/b><span>Achat unique[^<]*)<\/span>/, `$1 · <a href="/essai/?t=${f.slug}">essai gratuit de 14 jours, sans carte</a></span>`);
  // Question fréquente (en tête de la FAQ).
  const q = `<details><summary>Y a-t-il un essai gratuit ?</summary><p>Oui : 14 jours d'essai gratuit, sans carte bancaire, avec toutes les fonctions. Si vous achetez ensuite, tout ce que vous avez saisi est repris ; sinon, rien n'est prélevé et vos données sont effacées 30 jours après l'essai.</p></details>`;
  if (/<div class="faq"[^>]*>/.test(html)) html = html.replace(/(<div class="faq"[^>]*>)(\s*)/, `$1$2${q}$2`);
  else html = html.replace(/\n<\/section>\n<section class="rappel-templates">/, `\n  <div class="faq">\n    ${q}\n  </div>\n</section>\n<section class="rappel-templates">`);
  // Rappel « Comment ça marche ».
  html = html.replace('<p><b>Comment ça marche :</b> achat unique sur Gumroad,', `<p><b>Comment ça marche :</b> <a href="/essai/?t=${f.slug}">essai gratuit de 14 jours</a> sans carte bancaire, puis achat unique sur Gumroad (vos données d'essai sont reprises),`);
  for (const attendu of [lien, `/essai/?t=${f.slug}">essai gratuit de 14 jours, sans carte`, 'Y a-t-il un essai gratuit ?', 'essai gratuit de 14 jours</a> sans carte bancaire']) {
    if (!html.includes(attendu)) throw new Error(`catalogue/${f.slug} : structure inattendue (${attendu.slice(0, 50)}…)`);
  }
  return html;
}

export async function generer() {
  await mkdir(`${RACINE}essai`, { recursive: true });
  await writeFile(`${RACINE}essai/index.html`, pageEssai());
  let n = 0;
  for (const p of PRODUITS_ESSAI) {
    const f = ficheEssai(p);
    const chemin = `${RACINE}catalogue/${f.slug}/index.html`;
    const html = await readFile(chemin, 'utf8');
    const neuf = ajouterAuCatalogue(html, f);
    if (neuf !== html) { await writeFile(chemin, neuf); n++; }
  }
  console.log(`/essai/ générée ; ${n} page(s) catalogue mise(s) à jour sur ${PRODUITS_ESSAI.length}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await generer();
