// PDF de captures à la charte QME (A4 paysage) + aperçus PNG de chaque page.
// Usage : node build_pdf.cjs <pages.json> <dossier_captures> <dossier_sortie>
// pages.json : { "lang": "fr"|"en", "prospect": "Entreprise", "slug": "entreprise",
//   "pages": [ { "title": "...", "caption": "...", "shots": ["s-planning.jpg", "m-terrain.jpg"] } ] }
// Sortie : QME-concept-<Slug>.pdf, page-1.png … page-N.png, pdf.html
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [pagesFile, shotsDir, outDir] = process.argv.slice(2);
if (!pagesFile || !shotsDir || !outDir) {
  console.error('Usage : node build_pdf.cjs <pages.json> <dossier_captures> <dossier_sortie>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const L = spec.lang === 'en'
  ? { concept: 'Concept for', foot: 'Concept with example data · tailored to your needs', site: 'QME · Quentin Morel Engineering · qm-engineering.fr' }
  : { concept: 'Concept pour', foot: 'Concept · données fictives · adaptable à vos besoins', site: 'QME · Quentin Morel Engineering · qm-engineering.fr' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = spec.pages.length;

const sections = spec.pages.map((p, i) => {
  const shots = p.shots.map((s) => {
    const mobile = path.basename(s).startsWith('m-');
    const src = 'file://' + path.resolve(shotsDir, s);
    return `<div class="shot ${mobile ? 'phone' : 'wide'}"><img src="${src}"></div>`;
  }).join('');
  return `<section class="p">
  <div class="stripe"></div>
  <div class="top"><span><b>QME</b> · ${L.concept} ${esc(spec.prospect)}</span><span>${i + 1} / ${n}</span></div>
  <div><h1>${esc(p.title)}</h1><p class="cap">${esc(p.caption)}</p></div>
  <div class="shots">${shots}</div>
  <div class="foot"><span>${L.site}</span><span>${L.foot}</span></div>
</section>`;
}).join('\n');

const tpl = fs.readFileSync(path.join(__dirname, '..', 'assets', 'pdf-template.html'), 'utf8');
const html = tpl.replace('<!--LANG-->', spec.lang === 'en' ? 'en' : 'fr')
  .replace('<!--TITLE-->', `QME · ${L.concept} ${esc(spec.prospect)}`)
  .replace('<!--PAGES-->', sections);
const htmlFile = path.join(outDir, 'pdf.html');
fs.writeFileSync(htmlFile, html);

const slugTitle = spec.slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
const pdfFile = path.join(outDir, `QME-concept-${slugTitle}.pdf`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(htmlFile));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: pdfFile, landscape: true, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const prev = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 1.4585 });
  await prev.goto('file://' + path.resolve(htmlFile));
  await prev.waitForLoadState('networkidle');
  await prev.evaluate(() => document.fonts.ready);
  const els = await prev.$$('section.p');
  for (let i = 0; i < els.length; i++) {
    await els[i].screenshot({ path: path.join(outDir, `page-${i + 1}.png`) });
  }
  await browser.close();
  console.log('PDF', pdfFile, '·', els.length, 'pages');
})();
