// node outils/x/generer.mjs → en/english-version/index.html
// Page d'atterrissage de la campagne X (en anglais, volet sur mesure) : tous les templates en vente, une capture
// chacun, interface en français signalée, bouton « I'd like it in English » branché sur /api/interets
// (modules en-<slug>, voir netlify/lib/interets.mjs). Données : outils/x/templates-en.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const donnees = JSON.parse(fs.readFileSync(path.join(racine, 'outils/x/templates-en.json'), 'utf8'));
const THEMES = donnees._themes;
const COULEUR = { freelance: 'red', business: 'blue', build: 'yellow', orgs: 'red', money: 'blue', life: 'yellow' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cartes = [];
for (const slug of Object.keys(donnees).filter((k) => !k.startsWith('_'))) {
  const [theme, nom, accroche, reglesFr] = donnees[slug];
  if (!THEMES[theme]) throw new Error(`Thème inconnu pour ${slug} : ${theme}`);
  const html = fs.readFileSync(path.join(racine, 'catalogue', slug, 'index.html'), 'utf8');
  // Capture choisie dans _captures, telle que la page catalogue l'affiche (même version ?v=, mêmes dimensions).
  const choisie = donnees._captures[slug];
  if (!choisie) throw new Error(`Pas de capture choisie pour ${slug} dans _captures`);
  const img = [...html.matchAll(/<img[^>]*src="(\/assets\/templates-[^"]+\.webp[^"]*)"[^>]*>/g)]
    .find((m) => m[1].split('?')[0] === `/assets/${choisie}`);
  if (!img) throw new Error(`La capture ${choisie} n'est pas sur catalogue/${slug}/`);
  const larg = /width="(\d+)"/.exec(img[0])?.[1] || '1600';
  const haut = /height="(\d+)"/.exec(img[0])?.[1] || '1000';
  const fichier = path.join(racine, img[1].split('?')[0]);
  if (!fs.existsSync(fichier)) throw new Error(`Capture absente : ${img[1]}`);
  const demo = html.includes(`/templates/${slug}/?demo`);
  cartes.push({ slug, theme, nom, accroche, reglesFr, src: img[1], larg, haut, demo });
}
cartes.sort((a, b) => Object.keys(THEMES).indexOf(a.theme) - Object.keys(THEMES).indexOf(b.theme) || a.nom.localeCompare(b.nom, 'en'));

const carte = (c) => `    <article class="mini-produit" data-theme="${c.theme}" id="t-${c.slug}">
      <img src="${esc(c.src)}" width="${c.larg}" height="${c.haut}" loading="lazy" alt="${esc(c.nom)}: screenshot of the app (French interface, sample data)">
      <div class="corps">
        <span class="pill ${COULEUR[c.theme]}">${esc(THEMES[c.theme])} · French interface</span>
        <h3>${esc(c.nom)}</h3>
        <p>${esc(c.accroche)}</p>${c.reglesFr ? '\n        <p class="regles-fr">Built on French rules: an English version would be adapted to your country.</p>' : ''}
        <div class="actions">
          <button class="btn interet" type="button" data-en="${c.slug}" data-nom="${esc(c.nom)}">I'd like it in English</button>${c.demo ? `
          <a class="btn" href="/templates/${c.slug}/?demo" data-goatcounter-click="x-demo-${c.slug}" data-goatcounter-title="X campaign: demo ${esc(c.nom)}">Demo (in French)</a>` : ''}
        </div>
        <p class="interet-note" data-en-note="${c.slug}" hidden></p>
      </div>
    </article>`;

const filtres = Object.entries(THEMES).map(([id, nom]) => `<button type="button" data-filtre="${id}" aria-pressed="false">${esc(nom)}</button>`).join('');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${cartes.length} tools, built in French · QME</title>
<meta name="description" content="${cartes.length} web apps built by an engineer in France, all with a French interface. Tell me which one you want in English, or get a tool built for your business.">
<meta name="theme-color" content="#FBF7F1">
<link rel="canonical" href="https://qm-engineering.fr/en/english-version/">
<meta property="og:type" content="website">
<meta property="og:title" content="${cartes.length} tools I built in French. Want one in English?">
<meta property="og:description" content="Real web apps for freelancers, small businesses and everyday life. Vote for an English version, or get one built for you.">
<meta property="og:url" content="https://qm-engineering.fr/en/english-version/">
<meta property="og:image" content="https://qm-engineering.fr/assets/x-english-version.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/fonts/outfit.css?v=20261113">
<link rel="icon" type="image/svg+xml" href="/assets/qme-symbole.svg?v=20261026">
<link rel="stylesheet" href="/assets/site.css?v=2026112003">
<style>
.x-hero{display:grid;gap:18px;max-width:860px}
.x-hero .lead{font-size:clamp(18px,2.2vw,21px)}
.x-encart{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;padding:18px 20px;border:3px solid var(--encre);border-radius:18px;background:var(--surface,#fff)}
.x-encart p{flex:1 1 320px;margin:0}
.x-filtres{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0 8px}
.x-filtres button{font:inherit;font-size:15px;font-weight:600;padding:8px 14px;border-radius:999px;border:2px solid var(--encre);background:transparent;color:var(--encre);cursor:pointer}
.x-filtres button[aria-pressed="true"]{background:var(--encre);color:var(--papier)}
.x-compte{font-size:15px;color:var(--discret);margin:0 0 18px}
.regles-fr{font-size:14px;color:var(--discret);margin:0}
.x-fin{margin-top:48px}
</style>
</head>
<body>

<header class="topbar">
  <a class="brand" href="/en/" aria-label="QME, home">
    <svg viewBox="0 0 80 80" width="34" height="34" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="#141414"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#FBF7F1"/></svg>
    <span class="wordmark"><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>
    <span class="tagline">Quentin Morel<br>Engineering</span>
  </a>
  <nav aria-label="Main navigation">
    <a href="/en/custom/">Custom tools</a>
    <a href="/en/templates/">Templates</a>
    <a class="cta" href="/en/contact/" data-goatcounter-click="x-contact-entete" data-goatcounter-title="X campaign: contact (header)">Discuss your project</a>
  </nav>
  <button class="menu" type="button" aria-expanded="false" aria-label="Menu"><span></span><span></span></button>
</header>

<main>
<section class="section" id="english-version">
  <div class="x-hero">
    <h1 class="h-section">${cartes.length} tools I built. All in French. Want one in English?</h1>
    <p class="lead">I'm Quentin, an engineer in France. I build custom web apps for freelancers, small businesses and associations. These ${cartes.length} ready-made tools are the proof: each one is a real, working app that opens in the browser, syncs across devices and installs on your phone.</p>
    <p>For now, <strong>every interface is in French</strong>. Click <strong>“I'd like it in English”</strong> on the ones you would use: the most requested get an English version first. No account, no tracking cookie.</p>
    <div class="x-encart">
      <p><strong>Need something made for your business?</strong> That is my day job: one tool, designed around the way you work, in English.</p>
      <a class="btn primary" href="/en/contact/" data-goatcounter-click="x-contact-haut" data-goatcounter-title="X campaign: contact (top)">Discuss a custom tool</a>
    </div>
  </div>

  <div class="x-filtres" role="group" aria-label="Filter by theme"><button type="button" data-filtre="" aria-pressed="true">All</button>${filtres}</div>
  <p class="x-compte" aria-live="polite"><span id="x-nb">${cartes.length}</span> tools · screenshots show the French interface with sample data</p>

  <h2 class="sr-only">The ${cartes.length} tools</h2>
  <div class="mini-produits">
${cartes.map(carte).join('\n')}
  </div>

  <div class="x-encart x-fin">
    <p><strong>None of these fits?</strong> Tell me what you track today in spreadsheets, emails or sticky notes. I'll tell you honestly whether a custom tool is worth it.</p>
    <button class="btn interet" type="button" data-en="sur-mesure" data-nom="a custom tool">I want a custom tool in English</button>
    <a class="btn primary" href="/en/contact/" data-goatcounter-click="x-contact-bas" data-goatcounter-title="X campaign: contact (bottom)">Discuss a custom tool</a>
    <p class="interet-note" data-en-note="sur-mesure" hidden></p>
  </div>
</section>
</main>

<footer>
  <span>QME · Quentin Morel Engineering · © <span id="year"></span> · Cookie-free analytics (GoatCounter)</span>
  <span><a href="/en/">Home</a> · <a href="/en/custom/">Custom tools</a> · <a href="/en/templates/">Templates</a> · <a href="/en/contact/">Contact</a> · <a href="/confidentialite/">Privacy (in French)</a></span>
</footer>

<script>
(()=>{
 // Filtre par thème
 const boutons=[...document.querySelectorAll('[data-filtre]')],cartes=[...document.querySelectorAll('.mini-produit[data-theme]')],nb=document.getElementById('x-nb');
 const filtrer=t=>{boutons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filtre===t)));let n=0;cartes.forEach(c=>{const v=!t||c.dataset.theme===t;c.hidden=!v;if(v)n++;});nb.textContent=n;};
 boutons.forEach(b=>b.addEventListener('click',()=>{filtrer(b.dataset.filtre);if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'x-filtre-'+(b.dataset.filtre||'tous'),title:'X campaign: filter '+b.textContent,event:true});}));
 // « I'd like it in English » → /api/interets, module en-<slug> ; e-mail facultatif ensuite.
 const lire=k=>{try{return localStorage.getItem(k)}catch{return null}},ecrire=k=>{try{localStorage.setItem(k,'1')}catch{}};
 const envoyer=corps=>fetch('/api/interets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(corps)}).then(r=>{if(!r.ok)throw new Error(r.status);});
 const formulaire=(m,nom,note)=>{
  if(lire('qme-en-email-'+m)||document.getElementById('en-email-'+m))return;
  const f=document.createElement('form');f.className='interet-email';f.id='en-email-'+m;f.noValidate=true;
  f.innerHTML='<label for="en-champ-'+m+'">Get an email when it is ready <small>(optional)</small></label><div class="interet-ligne"><input id="en-champ-'+m+'" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="you@example.com" required><button class="btn" type="submit">Notify me</button></div><p class="interet-mention">Used only to tell you when '+nom.replace(/[<>&"]/g,'')+' is available in English, then deleted (12 months at most). See the <a href="/confidentialite/">privacy policy</a> (in French).</p>';
  note.after(f);
  f.addEventListener('submit',async e=>{e.preventDefault();const champ=f.querySelector('input'),email=champ.value.trim();
   if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)){champ.setCustomValidity('Please enter a valid email address.');champ.reportValidity();champ.setCustomValidity('');return;}
   try{await envoyer({module:'en-'+m,email});ecrire('qme-en-email-'+m);f.innerHTML='<p class="interet-merci">Noted: you will get one email when it is ready.</p>';}
   catch{f.querySelector('.interet-mention').textContent='Sending failed. Please try again in a moment.';}});
 };
 document.querySelectorAll('[data-en]').forEach(b=>{
  const m=b.dataset.en,note=document.querySelector('[data-en-note="'+m+'"]'),texte=b.textContent;
  const fait=()=>{b.disabled=true;b.classList.add('fait');b.textContent='Request noted ✓';note.hidden=false;note.textContent='Thanks! The most requested tools get an English version first.';};
  if(lire('qme-en-'+m)){fait();return;}
  b.addEventListener('click',async()=>{b.disabled=true;b.textContent='Sending…';
   try{await envoyer({module:'en-'+m});ecrire('qme-en-'+m);fait();formulaire(m,b.dataset.nom,note);}
   catch{b.disabled=false;b.textContent=texte;note.hidden=false;note.textContent='Sending failed. Please try again in a moment.';}});
 });
})();
</script>
<script src="/assets/site.js?v=2026112003" defer></script>
<script data-goatcounter="https://qme-engineering.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body>
</html>
`;

const sortie = path.join(racine, 'en/english-version/index.html');
fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, page);
console.log(`${path.relative(racine, sortie)} : ${cartes.length} templates, ${cartes.filter((c) => c.reglesFr).length} marqués « French rules », ${cartes.filter((c) => !c.demo).length} sans démo.`);
