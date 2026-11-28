// Vérification du 28/11/2026 (signature fluide). Usage : node docs/templates/communication/signature/verifier-rendu.mjs <dossier> [suffixe]
// Rend un mail type du site et la signature du brouillon Gmail à 360 et 600 px, mesure le débordement.
import { createRequire } from 'node:module'; const { chromium } = createRequire(process.cwd() + '/x.js')('playwright');
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const R = process.cwd(), OUT = process.argv[2], TAG = process.argv[3] || 'apres';
const { contenuMail } = await import(`${R}/netlify/lib/essais.mjs`);
const reg = { produit: 'BDG', debut: '2026-11-28', fin: '2026-12-12', effacement: '2027-01-11', prenom: 'Camille', code: 'TEST', email: 'x@exemple.fr', id: 'id1' };
let site;
try { site = contenuMail('merci', reg, 'secret').html; } catch (e) { console.error('contenuMail', e.message); }
let brouillon = JSON.parse(execFileSync('node', ['docs/templates/communication/signature/brouillon-gmail.mjs', '--json'])).html;
// cid → fichiers locaux pour l'affichage
['qme-logo','filet','instagram','linkedin','tiktok','youtube'].forEach((n,i)=>{ brouillon = brouillon.replace(`cid:att${i}`, `file://${R}/assets/signature/${n}.png`); });
brouillon = `<div style="font-family:Arial;font-size:15px">Bonjour,<br><br>Corps du brouillon de test.<br><br>Bien à vous,</div><br>${brouillon}`;
const sitehtml = (site||'').replaceAll('https://qm-engineering.fr/assets/signature/', `file://${R}/assets/signature/`);
const page = (b) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:8px">${b}</body></html>`;
const b = await chromium.launch();
const sansMax = (h) => h.replace(/max-width:[^;"]+;?/g, '');
for (const [nom, html] of [['site', sitehtml], ['brouillon', brouillon], ['brouillon-sans-max-width', sansMax(brouillon)]]) {
  writeFileSync(`${OUT}/${nom}.html`, page(html));
  for (const w of [360, 600]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    await p.goto(`file://${OUT}/${nom}.html`);
    const m = await p.evaluate(() => {
      const d = document.documentElement;
      const imgs = [...document.images].map(i => ({ src: i.src.split('/').pop(), w: i.getBoundingClientRect().width, ok: i.complete && i.naturalWidth > 0 }));
      const liens = [...document.querySelectorAll('a')].map(a => { a.scrollIntoView({block:'center'}); const r = a.getClientRects()[0]; const e = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return a.contains(e) || e === a; }); window.scrollTo(0,0);
      return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, imgs: imgs.filter(i=>/filet|logo/.test(i.src)), imgsKo: imgs.filter(i=>!i.ok).length, liensOk: liens.filter(Boolean).length + '/' + liens.length };
    });
    await p.screenshot({ path: `${OUT}/${nom}-${w}-${TAG}.png`, fullPage: true });
    console.log(nom, w, JSON.stringify(m), m.scrollWidth <= m.clientWidth ? 'OK' : 'DÉBORDE');
    await p.close();
  }
}
await b.close();
