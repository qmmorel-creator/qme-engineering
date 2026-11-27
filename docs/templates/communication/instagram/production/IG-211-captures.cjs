// Captures réelles du Reel du soir IG-211 (Capacité d'emprunt et comparateur de prêts, démo ?demo).
// Lancer depuis production/captures avec `npm run dev:templates` actif : node ../IG-211-captures.cjs
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:430,height:932},deviceScaleFactor:2});
await p.goto('http://localhost:8888/templates/emprunt/?demo');await p.waitForTimeout(4000);
await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await p.waitForTimeout(300);
await p.addStyleTag({content:'.bandeau-demo,nav.onglets,dialog.modale,dialog::backdrop{display:none!important}'});
await p.setViewportSize({width:430,height:1600});
await p.evaluate(()=>document.querySelector('nav.onglets [data-vue="offres"]').click()); await p.waitForTimeout(800);
const clip=async(fn)=>{let r=await p.evaluate(fn);await p.evaluate(y=>window.scrollTo(0,y-140),r[0]);await p.waitForTimeout(300);r=await p.evaluate(fn);const sy=await p.evaluate(()=>scrollY);return {x:0,y:r[0]-sy,width:430,height:r[1]-r[0]};};
const parTexte=(sel,re)=>`[...document.querySelectorAll('${sel}')].find(e=>${re}.test(e.textContent)&&e.getBoundingClientRect().height>0)`;
// 1. Verdict + tuiles des offres
await p.screenshot({path:'emprunt-offres.png',clip:await clip(new Function(`const v=${parTexte('*','/^LA MOINS CHÈRE EN COÛT TOTAL/i')}||${parTexte('p,div,h2,h3,span','/moins chère en coût total/i')};let z=v;while(z&&z.getBoundingClientRect().width<380)z=z.parentElement;const a=z.getBoundingClientRect();const t=${parTexte('*','/^Manque le taux$/')};let y=t;while(y&&y.getBoundingClientRect().width<150)y=y.parentElement;return [a.top+scrollY-12,y.getBoundingClientRect().bottom+scrollY+12];`))});
// 2. Graphique du coût : du titre « Ce que coûte chaque offre » au lien « Voir les données du graphique »
await p.screenshot({path:'emprunt-graphique.png',clip:await clip(new Function(`const h=[...document.querySelectorAll('h2,h3')].find(e=>/^Ce que coûte chaque offre/.test(e.textContent.trim()));const v=[...document.querySelectorAll('summary,button,a,span,p')].find(e=>/^Voir les données du graphique/.test(e.textContent.trim())&&e.getBoundingClientRect().height>0);return [h.getBoundingClientRect().top+scrollY-12,v.getBoundingClientRect().top+scrollY-8];`))});
await b.close();})();
