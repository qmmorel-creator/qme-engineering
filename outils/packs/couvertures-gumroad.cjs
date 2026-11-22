// Couvertures Gumroad des packs (1280 × 720), même charte Pastel que outils/templates/couvertures-gumroad.cjs :
// texte à gauche (nom, nombre d'outils, accroche, prix), mosaïque des vignettes des templates à droite.
// Prérequis : serveur local sur le port 8899 (npm run dev:templates avec PORT=8899) et vignettes à jour
// (node outils/templates/vignettes.mjs). Usage : node outils/packs/couvertures-gumroad.cjs etudiant argent-du-quotidien
// Sortie : assets/packs-<slug>-couverture.png (publiée par Netlify, puis ajoutée sur Gumroad par son adresse).
const { chromium } = require('playwright');
const fs = require('fs');
const R = process.cwd();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
// Nom court pour la légende d'une vignette : coupé au premier « et », « ou » ou à la première virgule s'il est long.
const court = (nom) => (nom.length > 22 ? nom.split(/ et | ou |, /)[0] : nom);
const AMB = { bleu: ['#D8E4F0', '#F8DCD3', '#E8B93A', '#22476E'], jaune: ['#FBEBC2', '#D8E4F0', '#E58C74', '#6E5310'], rouge: ['#F8DCD3', '#FBEBC2', '#2E5A88', '#8A3322'] };

function page(p) {
  const [bloc, forme1, forme2, pastilleTexte] = AMB[p.couleur] || AMB.bleu;
  const n = p.templates.length, cols = n <= 4 ? 2 : 3, rangs = Math.ceil(n / cols);
  const tuiles = p.templates.map((t) => `<figure><img src="/assets/vignettes/${t.slug}.webp"><figcaption>${esc(court(t.nom))}</figcaption></figure>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/fonts/outfit.css">
<style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#FBF7F1;font-family:Outfit,sans-serif;color:#24221F}
.f{position:absolute}
.bloc{left:600px;top:56px;width:640px;height:608px;background:${bloc};border-radius:36px;overflow:hidden}
.forme1{right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;background:${forme1}}
.forme2{left:-40px;bottom:-40px;width:170px;height:170px;border-radius:0 170px 0 0;background:${forme2};opacity:.9}
.grille{left:632px;top:88px;width:576px;height:544px;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rangs},1fr);gap:14px;align-content:center}
figure{margin:0;background:#FBF7F1;border-radius:14px;overflow:hidden;box-shadow:0 10px 24px rgba(36,34,31,.14);display:flex;flex-direction:column}
figure img{width:100%;flex:1;min-height:0;object-fit:cover;object-position:top left;display:block}
figcaption{font-size:${cols === 2 ? 17 : 13}px;font-weight:700;padding:7px 10px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.texte{left:64px;top:0;width:500px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.pastille{align-self:flex-start;font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:8px 16px;border-radius:999px;background:${bloc};color:${pastilleTexte}}
h1{margin:0;font-size:66px;font-weight:700;letter-spacing:-.03em;line-height:1.02}
.sous{margin:0;font-size:24px;font-weight:500;color:#514C44;line-height:1.35}
.prix{margin:0;font-size:30px;font-weight:800}.prix s{font-size:22px;font-weight:600;color:#6E685F;margin-left:10px}
.marque{left:64px;top:628px;display:flex;align-items:center;gap:12px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.point{left:64px;top:64px;display:flex;gap:10px}
.point i{display:block;width:18px;height:18px;border-radius:50%}
</style></head><body>
<div class="f bloc"><div class="f forme1"></div><div class="f forme2"></div></div>
<div class="f grille">${tuiles}</div>
<div class="f point"><i style="background:#E58C74"></i><i style="background:#E8B93A;border-radius:4px"></i><i style="background:#2E5A88;border-radius:18px 0 0 0"></i></div>
<div class="f texte"><span class="pastille">Pack · ${n} outils</span><h1>${esc(p.nom)}</h1><p class="sous">${esc(p.accroche)}</p><p class="prix">${euros(p.prix)}<s>${euros(p.valeur)}</s></p></div>
<div class="f marque"><svg viewBox="0 0 80 80" width="36" height="36"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="#24221F"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#FBF7F1"/></svg><span>Q<span style="color:#2E5A88">M</span><span style="color:#E8B93A">E</span></span></div>
</body></html>`;
}

(async () => {
  const { PACKS } = await import('../../netlify/lib/packs.mjs');
  const { calculerPack } = await import('./generer.mjs');
  const slugs = process.argv.slice(2);
  if (!slugs.length) throw new Error('Indiquer au moins un pack (slug), par exemple : etudiant');
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  fs.mkdirSync(`${R}/.couv-tmp`, { recursive: true }); // dossier temporaire, retiré à la fin
  for (const slug of slugs) {
    const code = Object.keys(PACKS).find((k) => PACKS[k].slug === slug);
    if (!code) throw new Error(`Pack inconnu : ${slug}`);
    const p = calculerPack(code);
    const f = `${R}/.couv-tmp/pack-${slug}.html`;
    fs.writeFileSync(f, page(p));
    await pg.goto(`http://localhost:8899/.couv-tmp/pack-${slug}.html`, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    const pb = await pg.evaluate(() => ({
      police: [...document.fonts].some((x) => x.family.replace(/"/g, '') === 'Outfit' && x.status === 'loaded'),
      images: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
      deborde: [...document.querySelector('.texte').children].some((e) => e.getBoundingClientRect().right > 580),
    }));
    if (!pb.police || pb.images.length || pb.deborde) throw new Error(`${slug} : ${JSON.stringify(pb)}`);
    await pg.screenshot({ path: `${R}/assets/packs-${slug}-couverture.png` });
    fs.unlinkSync(f);
    console.log(`assets/packs-${slug}-couverture.png`);
  }
  fs.rmdirSync(`${R}/.couv-tmp`);
  await b.close();
})();
