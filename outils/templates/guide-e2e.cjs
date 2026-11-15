// Vérifie le guide « Comment ça marche » d'un template (démo, ordinateur et téléphones).
// Usage : npm run dev:templates, puis node outils/templates/guide-e2e.cjs <slug> [dossier-captures]
// Contrôle : ouverture seule au premier lancement, pas au rechargement, bouton « ? » de l'en-tête,
// « Revoir le guide » des réglages, « Comme une application » après fermeture sur téléphone,
// aucune erreur JavaScript, aucune page plus large que l'écran. Captures dans le dossier indiqué.
const { chromium, devices } = require('playwright');
const slug = process.argv[2];
const dossier = process.argv[3] || '.';
if (!slug) { console.error('Usage : node outils/templates/guide-e2e.cjs <slug> [dossier]'); process.exit(2); }
const URL = `http://localhost:8888/templates/${slug}/`;
const erreurs = [];
const ok = (c, m) => { console.log(`${c ? 'OK   ' : 'ÉCHEC'} ${slug} : ${m}`); if (!c) process.exitCode = 1; };
const titre = (p) => p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? (d.querySelector('h2')?.textContent || '?').trim() : null; });
const GUIDE = 'Comment ça marche';

(async () => {
  const b = await chromium.launch();
  for (const [nom, opts] of [['ordi', { viewport: { width: 1280, height: 860 } }], ['iphone', devices['iPhone 13']], ['pixel', devices['Pixel 7']]]) {
    const c = await b.newContext(opts);
    const p = await c.newPage();
    p.on('pageerror', (e) => erreurs.push(`${nom} : ${e.message}`));
    // Démo ouverte par le bouton de l'écran de connexion (mémorisée, donc conservée au rechargement).
    await p.goto(URL);
    await p.locator('[data-action="demo"]:visible').first().click();
    await p.waitForTimeout(900);
    ok(await titre(p) === GUIDE, `${nom} : guide ouvert seul en démo`);
    const larg = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(larg <= (opts.viewport?.width || 1280), `${nom} : largeur ${larg} px`);
    await p.screenshot({ path: `${dossier}/${slug}-${nom}-guide.png` });
    await p.evaluate(() => { const d = document.querySelector('dialog[open]'); d?.scrollTo(0, 99999); d?.querySelector('.modale-corps')?.scrollTo(0, 99999); });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${dossier}/${slug}-${nom}-guide-bas.png` });
    await p.click('dialog[open] .modale-pied button.primaire, dialog[open] .modale-pied button >> nth=0');
    await p.waitForTimeout(1500);
    const apres = await titre(p);
    if (nom === 'ordi') ok(apres === null, `${nom} : rien ne s'ouvre après le guide (${apres})`);
    else {
      ok(apres === 'Comme une application', `${nom} : « Comme une application » après le guide (${apres})`);
      if (apres) await p.locator('dialog[open] .modale-pied button[value="jamais"]').click();
    }
    await p.reload();
    await p.waitForTimeout(1500);
    ok(await titre(p) !== GUIDE, `${nom} : pas de guide au rechargement`);
    if (await titre(p)) await p.keyboard.press('Escape');
    const aide = p.locator('[data-action="tutoriel"]:visible').first();
    ok(await aide.count() === 1, `${nom} : bouton « ? » visible`);
    if (await aide.count()) {
      await aide.click(); await p.waitForTimeout(250);
      ok(await titre(p) === GUIDE, `${nom} : « ? » rouvre le guide`);
      await p.keyboard.press('Escape');
    }
    await p.locator('[data-action="reglages"]:visible').first().click();
    await p.waitForTimeout(250);
    const revoir = p.locator('dialog[open] [data-action="tutoriel"]');
    ok(await revoir.count() === 1, `${nom} : « Revoir le guide » dans les réglages`);
    if (await revoir.count()) { await revoir.click(); await p.waitForTimeout(250); ok(await titre(p) === GUIDE, `${nom} : réglages rouvrent le guide`); }
    await c.close();
  }
  ok(erreurs.length === 0, `aucune erreur JavaScript ${erreurs.join(' | ')}`);
  await b.close();
})();
