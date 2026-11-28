const { chromium } = require('playwright');
const fs = require('fs');
const S = process.argv[2];
const CLE = { verifications: 'qme-vrf-demo', maintenance: 'qme-gma-demo', stocks: 'qme-stk-demo', 'non-conformites': 'qme-ncf-demo' };
const VUES = JSON.parse(process.argv[3]);
(async () => {
  const b = await chromium.launch();
  for (const [t, onglet, nomFichier, defil] of VUES) {
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [CLE[t], fs.readFileSync(`${S}/h-${t}.json`, 'utf8')]);
    await p.goto(`https://qm-engineering.fr/templates/${t}/?demo`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    if (onglet) { const n = await p.locator(`nav >> text="${onglet}"`).first(); if (await n.count()) await n.click(); else await p.getByText(onglet, { exact: true }).first().click(); await p.waitForTimeout(800); }
    await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    // Bande « Mode démo » et barre du site retirées de la capture
    const haut = await p.evaluate(() => { const e = document.querySelector('.bandeau-demo'); if (!e) return 0; const r = e.getBoundingClientRect(); return Math.round(r.bottom + window.scrollY); });
    if (defil) await p.evaluate((y) => window.scrollTo(0, y), defil);
    await p.waitForTimeout(300);
    const y0 = defil ? 0 : haut;
    await p.screenshot({ path: `${S}/cap/${nomFichier}.png`, clip: { x: 0, y: y0, width: 1600, height: 813 } });
    console.log(nomFichier, 'haut bandeau', haut, (await p.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\s+/g, ' '));
    await p.close();
  }
  await b.close();
})();
