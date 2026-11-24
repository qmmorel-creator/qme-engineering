import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const [, , dossier] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:8888/templates/planning-equipe/?demo&reinit');
await p.waitForTimeout(3000);
for (const d of await p.$$('dialog[open]')) await d.evaluate((x) => x.close());
// Bandeau démo, navigation du site et barre d'onglets du bas masqués (comme les Reels du soir).
await p.addStyleTag({ content: '.bandeau-demo,.qme-bandeau,nav.onglets,dialog{display:none!important}' });
await p.waitForTimeout(300);
for (const vue of ['tableau', 'planning', 'dispos']) {
  for (const d of await p.$$('dialog[open]')) { console.log('MODALE', (await d.innerText()).slice(0, 300)); await d.evaluate((x) => x.close()); }
  await p.$eval(`.onglet[data-vue="${vue}"]`, (e) => e.click()).catch((e) => console.log('clic', vue, e.message));
  await p.waitForTimeout(700);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${dossier}/eqp-${vue}.png`, fullPage: true });
  console.log('=====', vue, '\n', (await p.innerText('main').catch(() => p.innerText('body'))).slice(0, 1800));
}
await b.close();
