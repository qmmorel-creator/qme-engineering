// Plaquette A4 « Partenariat Réseaux Sociaux » (25/11/2026) : HTML autonome, PDF A4 et aperçu PNG.
// Usage : node docs/templates/communication/affiliation/plaquette/generer.mjs
// Charte : kit réseaux sociaux QME (papier, encre, rouge, jaune, bleu, Outfit) et mascotte Carreau.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { carreau, PALETTE as P } from '../../formats-test/mascotte/carreau.js';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '../../../../..');
const police = (f) => readFileSync(join(racine, 'assets/fonts', f)).toString('base64');
const symbole = readFileSync(join(racine, 'assets/qme-symbole.svg'), 'utf8');

const COMMISSION = 25; // % du montant de chaque vente, décision de Quentin du 25/11/2026
const exemplePrix = 20;
const gain = (exemplePrix * COMMISSION / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const png = (f) => `<img alt="" src="data:image/png;base64,${readFileSync(join(racine, 'assets/signature', f)).toString('base64')}">`;
const RESEAUX = [
  ['Instagram', 'https://www.instagram.com/qmengineering/', png('instagram.png')],
  ['TikTok', 'https://www.tiktok.com/@qme.qm.engineering', png('tiktok.png')],
  ['LinkedIn', 'https://www.linkedin.com/company/qme-qm-engineering/', png('linkedin.png')],
  ['YouTube', 'https://www.youtube.com/channel/UCZTdaekWbJG8_RekBbaecvA', png('youtube.png')],
  ['X', 'https://x.com/qmengineering', `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 L20 20 M20 4 L4 20" stroke="${P.encre}" stroke-width="2.6" stroke-linecap="square"/></svg>`],
];
const fleche = (c = P.encre) => `<svg class="fl" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12 H30" stroke="${c}" stroke-width="5"/><path d="M26 3 L38 12 L26 21 Z" fill="${c}"/></svg>`;

// Pictos Bauhaus des quatre étapes du flux
const picto = {
  lien: `<svg viewBox="0 0 60 60"><rect x="6" y="20" width="26" height="20" rx="10" fill="none" stroke="${P.encre}" stroke-width="6"/><rect x="28" y="20" width="26" height="20" rx="10" fill="none" stroke="${P.encre}" stroke-width="6"/></svg>`,
  audience: `<svg viewBox="0 0 60 60"><circle cx="18" cy="22" r="9" fill="${P.bleu}"/><circle cx="42" cy="22" r="9" fill="${P.rouge}"/><circle cx="30" cy="16" r="10" fill="${P.jaune}" stroke="${P.encre}" stroke-width="4"/><rect x="6" y="36" width="48" height="16" fill="${P.encre}"/></svg>`,
  panier: `<svg viewBox="0 0 60 60"><path d="M8 18 H52 L46 44 H14 Z" fill="${P.jaune}" stroke="${P.encre}" stroke-width="5"/><circle cx="20" cy="52" r="5" fill="${P.encre}"/><circle cx="42" cy="52" r="5" fill="${P.encre}"/></svg>`,
  piece: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="${P.jaune}" stroke="${P.encre}" stroke-width="5"/><text x="30" y="38" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="22" fill="${P.encre}">€</text></svg>`,
};

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>QME - Plaquette partenariat réseaux sociaux</title>
<style>
@font-face{font-family:'Outfit';font-weight:400 800;src:url(data:font/woff2;base64,${police('outfit-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212}
@font-face{font-family:'Outfit';font-weight:400 800;src:url(data:font/woff2;base64,${police('outfit-latin-ext.woff2')}) format('woff2');unicode-range:U+0100-02BA,U+1E00-1EFF}
@page{size:A4;margin:0}
:root{--encre:${P.encre};--papier:${P.papier};--rouge:${P.rouge};--jaune:${P.jaune};--bleu:${P.bleu};--blanc:#fff;--gris:#45413A;--clair:#FBFAF6}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--papier)}
body{font-family:Outfit,sans-serif;color:var(--encre);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;padding:7mm 11mm 6mm;display:flex;flex-direction:column;gap:2.3mm;overflow:hidden;position:relative}
.sourcil{font-size:9.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--bleu)}
h1{font-size:23pt;font-weight:800;line-height:1;letter-spacing:-.02em;margin:2mm 0 2.4mm}
h1 em{font-style:normal;background:var(--jaune);padding:0 .1em}
h2{font-size:13.5pt;font-weight:800;letter-spacing:-.01em;display:flex;align-items:center;gap:2.4mm;margin-bottom:1.8mm}
h2 .n{display:inline-grid;place-items:center;width:7mm;height:7mm;background:var(--encre);color:var(--papier);font-size:10pt}
p,li{font-size:9pt;line-height:1.32}
b{font-weight:700}
.carte{background:var(--blanc);border:2.2px solid var(--encre);box-shadow:2mm 2mm 0 var(--encre);padding:2.8mm 3.6mm}

/* En-tête */
.tete{display:grid;grid-template-columns:1fr 31mm;gap:4mm;align-items:center;border-bottom:3px solid var(--encre);padding-bottom:2.4mm}
.tete .chapo{font-size:10.2pt;line-height:1.35;max-width:150mm;color:var(--gris)}
.tete .logo{display:flex;align-items:center;gap:2mm;font-weight:800;font-size:10pt}
.tete .logo svg{width:7mm;height:7mm}
.tete .heros{position:relative}
.tete .heros svg{width:29mm;height:auto;display:block}

/* Bulle de Carreau */
.bulle{position:absolute;background:var(--blanc);border:2px solid var(--encre);padding:1.2mm 2.4mm;font-size:8.6pt;font-weight:700;white-space:nowrap}
.bulle::after{content:"";position:absolute;width:3mm;height:3mm;background:var(--blanc);border-right:2px solid var(--encre);border-bottom:2px solid var(--encre)}
.bulle.bas::after{bottom:-1.8mm;left:5mm;transform:rotate(45deg)}
.bulle.gauche::after{left:-1.8mm;top:2mm;transform:rotate(135deg)}

/* 1. D'où l'on part */
.depart{display:grid;grid-template-columns:1fr 58mm;gap:5mm;align-items:stretch}
.depart .txt p+p{margin-top:1.6mm}
.jauges{display:flex;flex-direction:column;gap:2.6mm;justify-content:center}
.jauge .l{display:flex;justify-content:space-between;font-size:8.8pt;font-weight:700;margin-bottom:.8mm}
.jauge .b{height:5mm;border:2px solid var(--encre);background:var(--clair);position:relative}
.jauge .b i{position:absolute;inset:0 auto 0 0;display:block}
.jauge.t i{width:96%;background:var(--jaune)}
.jauge.r i{width:92%;background:var(--bleu)}
.jauge .note{font-size:8pt;color:var(--gris);margin-top:.6mm}

/* 2. Le flux */
.flux .etape span{font-size:7.9pt}
.flux{display:grid;grid-template-columns:1fr 7mm 1fr 7mm 1fr 7mm 1.15fr;align-items:center}
.etape{background:var(--blanc);border:2.2px solid var(--encre);padding:2mm 2.2mm 2.2mm;text-align:center;height:100%;display:flex;flex-direction:column;align-items:center;gap:1.2mm}
.etape svg{width:9mm;height:9mm}
.etape b{font-size:9.6pt;line-height:1.15}
.etape span{font-size:8.2pt;line-height:1.25;color:var(--gris)}
.etape.fin .mini svg{width:12mm;height:auto;display:block;margin-top:-1mm}
.etape.fin{background:var(--jaune);box-shadow:2mm 2mm 0 var(--encre)}
.etape.fin span{color:var(--encre)}
.fl{width:7mm;height:5mm}
.trio{display:flex;gap:2.4mm;margin-top:2.6mm;align-items:center;flex-wrap:wrap}
.tag{border:2px solid var(--encre);padding:.8mm 2.6mm;font-weight:800;font-size:9.4pt;letter-spacing:.04em;text-transform:uppercase}
.tag:nth-child(1){background:var(--jaune)}.tag:nth-child(2){background:var(--bleu);color:var(--blanc)}.tag:nth-child(3){background:var(--rouge);color:var(--blanc)}
.calcul{margin-left:auto;font-size:9.2pt}
.calcul b{background:var(--encre);color:var(--papier);padding:.4mm 1.6mm}

/* 3. Intérêt partagé */
.partage{display:grid;grid-template-columns:1.3fr 32mm 1fr;gap:3mm;align-items:center}
.partage .carte h3{font-size:10.2pt;font-weight:800;margin-bottom:1.4mm}
.partage ul{list-style:none}
.partage li{padding-left:4.2mm;position:relative;margin-bottom:.5mm}
.partage li::before{content:"";position:absolute;left:0;top:1.6mm;width:2.2mm;height:2.2mm;background:var(--jaune);border:1.5px solid var(--encre)}
.partage .qme li::before{background:var(--bleu)}
.boucle{position:relative;text-align:center}
.boucle svg{width:32mm;height:auto;display:block}

/* 4. Bonus */
.bonus{background:var(--bleu);color:var(--blanc);border:2.2px solid var(--encre);box-shadow:2mm 2mm 0 var(--encre);display:grid;grid-template-columns:26mm 1fr 38mm;gap:4mm;align-items:center;padding:2.8mm 4.4mm;position:relative}
.bonus h2{color:var(--blanc);margin-bottom:1.4mm}
.bonus h2 .n{background:var(--jaune);color:var(--encre)}
.bonus p{color:#E8EDF4}
.bonus .valeur{background:var(--jaune);color:var(--encre);border:2.2px solid var(--encre);text-align:center;padding:2.4mm 2mm;transform:rotate(-3deg)}
.bonus .valeur small{display:block;font-size:7.8pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.bonus .valeur strong{display:block;font-size:19pt;font-weight:800;line-height:1.05}
.bonus .accroche{font-size:12pt;font-weight:800;color:var(--jaune);margin-bottom:.8mm}
.bonus .ex{display:flex;flex-wrap:wrap;gap:1.4mm;margin-top:2mm}
.bonus .ex span{border:1.5px solid var(--blanc);padding:.3mm 1.5mm;font-size:7.6pt}
.bonus .perso svg{width:26mm;height:auto;display:block}

/* 5. Démarrer */
.depart3{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.pas{display:flex;gap:2.4mm;align-items:flex-start}
.pas .num{flex:none;width:9mm;height:9mm;display:grid;place-items:center;font-weight:800;font-size:13pt;border:2.2px solid var(--encre)}
.pas:nth-child(1) .num{background:var(--jaune)}.pas:nth-child(2) .num{background:var(--rouge);color:var(--blanc)}.pas:nth-child(3) .num{background:var(--bleu);color:var(--blanc)}
.pas b{display:block;font-size:10pt}
.pas span{display:block;font-size:8.6pt;color:var(--gris);line-height:1.3;margin-top:.4mm}

.pied{margin-top:auto;border-top:3px solid var(--encre);padding-top:1.8mm;display:flex;flex-direction:column;gap:1.4mm;font-size:9pt}
.pied a{color:var(--encre);text-decoration:none}
.pied .liens{display:flex;gap:2mm;flex-wrap:wrap}
.pied .liens a{border:2px solid var(--encre);padding:.6mm 2.6mm;font-size:9pt;font-weight:600;background:var(--blanc)}
.pied .liens a:first-child{background:var(--jaune)}
.pied .haut,.pied .bas{display:flex;justify-content:space-between;align-items:center;gap:3mm}
.pied .reseaux{display:flex;gap:2.6mm}
.pied .reseaux a{display:block;width:6mm;height:6mm}
.pied .reseaux img,.pied .reseaux svg{width:6mm;height:6mm;display:block}
.pied .petit{font-size:7.2pt;color:var(--gris)}
</style></head>
<body><main class="page">

<header class="tete">
  <div>
    <div class="logo">${symbole.replace('<svg', '<svg aria-hidden="true"')}<span>QME · Quentin Morel Engineering</span></div>
    <p class="sourcil" style="margin-top:3mm">Partenariat réseaux sociaux</p>
    <h1>On grandit <em>ensemble</em>,<br>avec de l'audience et du savoir-faire.</h1>
    <p class="chapo">Des outils pratiques et faciles à prendre en main, pour le plus grand nombre. Vous les recommandez à votre communauté : chaque vente vous rapporte.</p>
  </div>
  <div class="heros">
    <div class="bulle bas" style="top:-5mm;left:-14mm">Je vous fais la visite !</div>
    ${carreau({ expression: 'fier', pose: 'montre', taille: 140 })}
  </div>
</header>

<section class="depart">
  <div class="txt">
    <h2><span class="n">1</span>D'où l'on part</h2>
    <p><b>QME est née il y a quelques mois</b> : un ingénieur, des outils en ligne prêts à l'emploi (budget, travaux, révisions, voyage, sport…), sur téléphone comme sur ordinateur, sans abonnement.</p>
    <p>Le but : <b>rendre ces outils accessibles au plus grand nombre.</b> Jeune activité, QME a investi ses revenus initiaux dans la structuration, les bases de données et autres outils nécessaires à son expansion technique. Alors on a imaginé un partenariat où <b>personne n'avance d'argent</b>.</p>
  </div>
  <div class="carte jauges">
    <div class="jauge t"><div class="l"><span>Savoir-faire et outils</span><span>plein</span></div><div class="b"><i></i></div></div>
    <div class="jauge r"><div class="l"><span>Temps pour nos partenaires</span><span>plein</span></div><div class="b"><i></i></div><p class="note">D'où l'idée : une commission à la vente, et du temps offert.</p></div>
  </div>
</section>

<section>
  <h2><span class="n">2</span>Comment ça marche</h2>
  <div class="flux">
    <div class="etape">${picto.lien}<b>Vous partagez votre lien</b><span>Post, story, bio, vidéo : quand vous voulez, comme vous voulez.</span></div>
    ${fleche()}
    <div class="etape">${picto.audience}<b>Votre audience essaie</b><span>Démo gratuite, sans inscription, en une minute.</span></div>
    ${fleche()}
    <div class="etape">${picto.panier}<b>Elle achète sur Gumroad</b><span>La plateforme de vente, paiement sécurisé.</span></div>
    ${fleche()}
    <div class="etape fin"><div class="mini">${carreau({ expression: 'fier', pose: 'montre', couleur: P.blanc, taille: 60 })}</div><b>${COMMISSION} % pour vous</b><span>du montant de chaque vente, reversé directement par Gumroad.</span></div>
  </div>
  <div class="trio"><span class="tag">Facile</span><span class="tag">Direct</span><span class="tag">Automatique</span>
    <p class="calcul">Exemple : une vente à ${exemplePrix} € = <b>${gain} € pour vous</b>, sans facture ni relance.</p></div>
</section>

<section>
  <h2><span class="n">3</span>Un intérêt partagé</h2>
  <div class="partage">
    <div class="carte"><h3>Pour vous</h3><ul>
      <li><b>Zéro euro à sortir</b> : votre visibilité est un investissement en nature.</li>
      <li>Une commission sur <b>chaque</b> vente par votre lien.</li>
      <li>Des templates pas chers ou des packs complets : <b>une variété</b> pour votre audience.</li>
      <li>Ni publication obligatoire, ni texte imposé.</li>
    </ul></div>
    <div class="boucle">
      <svg viewBox="0 0 200 150" aria-hidden="true">
        <path d="M100 8 A66 66 0 1 1 34 74" fill="none" stroke="${P.encre}" stroke-width="7"/>
        <path d="M20 70 L34 92 L48 70 Z" fill="${P.encre}"/>
        <circle cx="100" cy="74" r="44" fill="${P.jaune}" stroke="${P.encre}" stroke-width="6"/>
        <text x="100" y="70" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="13" fill="${P.encre}">+ de ventes</text>
        <text x="100" y="89" text-anchor="middle" font-family="Outfit" font-weight="600" font-size="12" fill="${P.encre}">ensemble</text>
        <rect x="150" y="4" width="20" height="20" fill="${P.rouge}" stroke="${P.encre}" stroke-width="4"/>
        <path d="M166 124 L178 142 L154 142 Z" fill="${P.bleu}"/>
      </svg>
    </div>
    <div class="carte qme"><h3>Pour QME</h3><ul>
      <li>Des outils qui trouvent leur public.</li>
      <li>Vos retours pour les améliorer.</li>
      <li>On tire dans le même sens : plus de ventes, plus de commissions.</li>
    </ul></div>
  </div>
</section>

<section class="bonus">
  <div class="perso">${carreau({ expression: 'soulage', pose: 'debout', couleur: P.jaune, taille: 110 })}</div>
  <div>
    <h2><span class="n">4</span>Bonus : un outil sur mesure offert</h2>
    <p class="accroche">Pour mes partenaires : du temps !</p><p>Un outil conçu <b>pour vous</b>, selon vos besoins de créateur ou de créatrice, développé gratuitement.</p>
    <div class="ex"><span>planning de tournages</span><span>suivi des partenariats</span><span>budget de projet</span></div>
  </div>
  <div class="valeur"><small>Valeur estimée</small><strong>2 500 €</strong><small>de développement</small></div>
</section>

<section>
  <h2><span class="n">5</span>Pour démarrer</h2>
  <div class="depart3">
    <div class="pas"><span class="num">1</span><div><b>Vous testez</b><span>Accès gratuit à l'outil, pour juger sur pièce.</span></div></div>
    <div class="pas"><span class="num">2</span><div><b>Vous recevez votre lien</b><span>Lien personnel Gumroad, commission de ${COMMISSION} % activée.</span></div></div>
    <div class="pas"><span class="num">3</span><div><b>On parle de votre outil</b><span>Un échange pour définir l'outil sur mesure qui vous servira.</span></div></div>
  </div>
</section>

<footer class="pied">
  <div class="haut">
    <nav class="liens">
      <a href="https://qm-engineering.fr/"><b>qm-engineering.fr</b></a>
      <a href="https://qm-engineering.fr/sur-mesure/">Le sur mesure</a>
      <a href="https://qm-engineering.fr/templates/">Les templates</a>
      <a href="https://qm-engineering.fr/packs/">Les packs</a>
    </nav>
    <div class="reseaux">${RESEAUX.map(([n, u, i]) => `<a href="${u}" title="${n}" aria-label="${n}">${i}</a>`).join('')}</div>
  </div>
  <div class="bas">
    <div><b>Quentin Morel</b> · <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a></div>
    <p class="petit">Commission calculée et versée par Gumroad. Montants donnés à titre d'exemple.</p>
  </div>
</footer>

</main></body></html>`;

writeFileSync(join(ici, 'partenariat-reseaux-sociaux.html'), html);

const { createRequire } = await import('node:module');
const { chromium } = createRequire(import.meta.url)('playwright');
const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.goto('file://' + join(ici, 'partenariat-reseaux-sociaux.html'));
await page.evaluate(() => document.fonts.ready);
const debord = await page.evaluate(() => { const m = document.querySelector('.page'); return m.scrollHeight - m.clientHeight; });
await page.pdf({ path: join(ici, 'QME - Plaquette partenariat réseaux sociaux.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: join(ici, 'apercu.png'), fullPage: false });
await nav.close();
console.log('débordement (px) :', debord);
