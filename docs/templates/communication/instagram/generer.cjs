// Génère les cartes des carrousels Instagram (1080 × 1350, charte Bauhaus « Pastel »).
// Usage, depuis la racine du dépôt : node docs/templates/communication/instagram/generer.cjs [IG-06 ...]
// Sortie : docs/templates/communication/instagram/IG-XX/IG-XX-1.jpg … -5.jpg
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '../../../..');
const ASSETS = 'file://' + path.join(RACINE, 'assets') + '/';
const posts = require('./posts.cjs');
const filtre = process.argv.slice(2);

const echap = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const texte = (s) => echap(s)
  .replace(/\[([^\]]+)\]/g, '<mark class="todo">À compléter · $1</mark>')
  .replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>')
  .replace(/\n/g, '<span class="saut"></span>');

const TEINTES = ['sable', 'ciel', 'rose', 'beurre'];

const CSS = `
@font-face{font-family:'Outfit';font-weight:400 800;src:url('${ASSETS}fonts/outfit-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212;}
@font-face{font-family:'Outfit';font-weight:400 800;src:url('${ASSETS}fonts/outfit-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+1E00-1EFF,U+20A0-20AB;}
:root{--papier:#FBF7F1;--surface:#FFFFFF;--encre:#24221F;--texte-2:#514C44;--discret:#6E685F;--trait:#E4DCCE;
--rouge:#B84A34;--jaune:#E8B93A;--bleu:#2E5A88;--rose:#F8DCD3;--beurre:#FBEBC2;--ciel:#D8E4F0;--sable:#F3EDE3;
--rose-texte:#8A3322;--beurre-texte:#6E5310;--ciel-texte:#22476E;}
.nobr{white-space:nowrap}.saut{display:block;height:28px}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:'Outfit',sans-serif;color:var(--encre);background:var(--papier);font-variant-numeric:tabular-nums}
.carte{position:relative;width:1080px;height:1350px;padding:72px;display:flex;flex-direction:column;overflow:hidden}
.carte.sable{background:var(--sable)}.carte.ciel{background:var(--ciel)}.carte.rose{background:var(--rose)}.carte.beurre{background:var(--beurre)}
.carte.bleu{background:var(--bleu);color:#fff}
.haut{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}
.pilule{display:inline-block;padding:14px 28px;border-radius:999px;font-weight:600;font-size:30px;background:var(--surface);border:1px solid var(--trait);color:var(--encre)}
.pilule.sur{background:var(--rose);border-color:transparent;color:var(--rose-texte)}
.num{font-size:28px;font-weight:600;color:var(--discret)}
.bleu .num{color:#fff;opacity:.85}
.bas{display:flex;justify-content:space-between;align-items:center;margin-top:auto;position:relative;z-index:2}
.marque{display:flex;align-items:center;gap:18px;font-size:28px;font-weight:600;color:var(--texte-2)}
.marque img{height:64px;padding:6px 8px;background:#fff;border-radius:14px;border:1px solid var(--trait)}
.bleu .marque{color:#fff}
.fictif{font-size:24px;color:var(--discret)}
h1{font-weight:800;letter-spacing:-.025em;line-height:1.05;font-size:100px;position:relative;z-index:2;max-width:760px}
h2{font-weight:700;letter-spacing:-.025em;line-height:1.15;font-size:62px;position:relative;z-index:2}
h2.court{font-size:54px}
.centre h2{max-width:840px}
.cta .centre h2{max-width:none}
h2.capt{font-size:50px;line-height:1.18}
.centre{flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px}
.glisser{font-size:32px;font-weight:600;color:var(--bleu);position:relative;z-index:2}
mark.todo{background:var(--beurre);color:var(--beurre-texte);border:3px dashed var(--jaune);border-radius:14px;padding:0 12px;font-size:.8em}
.visuel{flex:1;display:flex;align-items:center;justify-content:center;margin:40px 0 32px;min-height:0}
.visuel img{border-radius:22px;border:1px solid var(--trait);box-shadow:0 12px 32px rgba(36,34,31,.10);background:#fff;object-fit:contain}
.visuel img.portrait{max-height:100%;max-width:62%}
.visuel img.paysage{width:1000px;max-width:none;max-height:100%}
.forme{position:absolute;z-index:1}
.rond{border-radius:50%}
.quart{border-radius:0 0 0 100%}
.cta h2{font-size:72px}
.cta .ligne{font-size:40px;font-weight:600;line-height:1.3}
.cta .prix{display:inline-block;align-self:flex-start;padding:18px 34px;border-radius:999px;background:var(--beurre);color:var(--beurre-texte);font-weight:700;font-size:34px}
`;

function formes(variante) {
  // Formes Bauhaus en teintes adoucies, placées en marge pour ne pas gêner la lecture.
  const v = [
    `<div class="forme rond" style="width:420px;height:420px;right:-200px;top:-170px;background:#E58C74;opacity:.9"></div>
     <div class="forme" style="width:180px;height:180px;right:250px;bottom:190px;background:#2E5A88"></div>
     <div class="forme quart" style="width:260px;height:260px;left:-1px;bottom:150px;background:#E8B93A;transform:rotate(90deg)"></div>`,
    `<div class="forme quart" style="width:360px;height:360px;right:0;top:0;background:#E8B93A"></div>
     <div class="forme rond" style="width:200px;height:200px;right:120px;bottom:200px;background:#2E5A88"></div>`,
    `<div class="forme" style="width:300px;height:300px;right:-80px;bottom:160px;background:#E58C74;transform:rotate(12deg)"></div>
     <div class="forme rond" style="width:140px;height:140px;right:320px;bottom:170px;background:#E8B93A"></div>`,
  ];
  return v[variante % v.length];
}

function carte(post, i) {
  const n = i + 1;
  const tag = `<span class="pilule${post.sur ? ' sur' : ''}">${echap(post.tag)}</span>`;
  const haut = `<div class="haut">${tag}<span class="num">${n}/5</span></div>`;
  const marque = `<div class="marque"><img src="${ASSETS}logo-qme.png" alt="">qm-engineering.fr</div>`;

  if (n === 5) {
    const titre = post.sur ? echap(post.cta || 'Un outil construit autour de votre façon de travailler.')
      : 'Essayez la démo, sans inscription.';
    const ligne = post.sur ? 'Parlons-en : lien en bio.' : `Lien en bio → Templates →<br>${echap(post.nom)}`;
    const prix = post.sur ? '<span class="prix">Sur mesure · on part de votre besoin</span>'
      : `<span class="prix">Achat unique, sans abonnement · ${post.prix}</span>`;
    return `<div class="carte bleu cta">${haut.replace('class="pilule', 'class="pilule" style="background:#fff;color:#24221F;border-color:#fff"').replace(' sur"', '"')}
      <div class="forme rond" style="width:520px;height:520px;right:-180px;bottom:-160px;background:#E8B93A;opacity:.9"></div>
      <div class="centre"><h2>${titre}</h2><div class="ligne">${ligne}</div>${prix}</div>
      <div class="bas">${marque}</div></div>`;
  }

  const v = post.vues[i];
  if (n === 1) {
    return `<div class="carte">${formes(post.id.charCodeAt(4))}${haut}
      <div class="centre"><h1>${texte(v.t)}</h1><div class="glisser">Glissez →</div></div>
      <div class="bas">${marque}</div></div>`;
  }

  const teinte = TEINTES[(i + post.id.charCodeAt(4)) % TEINTES.length];
  if (v.img) {
    const portrait = /-tel\.webp$/.test(v.img);
    return `<div class="carte ${teinte}">${haut}
      <h2 class="capt" style="margin-top:44px">${texte(v.t)}</h2>
      <div class="visuel"><img class="${portrait ? 'portrait' : 'paysage'}" src="${ASSETS}${v.img}" alt=""></div>
      <div class="bas">${marque}<span class="fictif">Données fictives</span></div></div>`;
  }
  const court = v.t.length > 90 ? ' court' : '';
  return `<div class="carte ${teinte}">${formes(i)}${haut}
    <div class="centre"><h2 class="${court.trim()}">${texte(v.t)}</h2></div>
    <div class="bas">${marque}</div></div>`;
}

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'));
  for (const post of posts) {
    if (filtre.length && !filtre.includes(post.id)) continue;
    const dossier = path.join(__dirname, post.id);
    fs.mkdirSync(dossier, { recursive: true });
    for (let i = 0; i < 5; i++) {
      const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><style>${CSS}</style><body>${carte(post, i)}</body></html>`;
      const f = path.join(tmp, 'carte.html');
      fs.writeFileSync(f, html);
      await page.goto('file://' + f);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(dossier, `${post.id}-${i + 1}.jpg`), type: 'jpeg', quality: 90 });
    }
    console.log(post.id, 'ok');
  }
  await navigateur.close();
})();
