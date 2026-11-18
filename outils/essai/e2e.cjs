// Essai gratuit, parcours complet dans un navigateur, pour un ou tous les templates ouverts à l'essai.
// Prérequis : serveur local lancé avec les clés de test :
//   QME_LICENCES_TEST=1 PORT=8899 node outils/templates/serveur-local.mjs
// Usage : node outils/essai/e2e.cjs [slug|tous] [dossier-captures]
// Étapes : /essai/ → code → application (bandeau) → données chargées → 15 jours plus tard : lecture seule
// (onglets permis, modifications bloquées, aucun enregistrement envoyé) → « J'ai acheté » (clé de test) →
// données reprises dans l'espace acheté, plus de bandeau.
const { chromium, devices } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const BASE = process.env.QME_BASE || 'http://localhost:8899';
const cible = process.argv[2] || 'tous';
const captures = process.argv[3] || null;
if (captures) fs.mkdirSync(captures, { recursive: true });

async function decaler(jours) { await fetch(`${BASE}/__dev/decalage?jours=${jours}`); }

async function parcours(navigateur, { slug, produit, rang }) {
  const erreurs = [];
  const notes = [];
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept()); // confirm() éventuels des applications
  const cap = async (nom) => { if (captures) await page.screenshot({ path: path.join(captures, `${slug}-${nom}.png`) }); };
  await decaler(0);

  // Données d'exemple de la démo, pour remplir l'essai comme un vrai utilisateur.
  const demo = await contexte.newPage();
  await demo.goto(`${BASE}/templates/${slug}/?demo`);
  await demo.waitForTimeout(700);
  const donneesDemo = await demo.evaluate((pre) => JSON.parse(localStorage.getItem(`qme-${pre}-demo`) || 'null'), produit.toLowerCase());
  await demo.evaluate(() => localStorage.clear());
  await demo.close();
  if (!donneesDemo) erreurs.push('démo : aucune donnée d\'exemple trouvée');

  // 1. Page /essai/
  await page.goto(`${BASE}/essai/?t=${slug}`);
  if (await page.locator('select[name=produit]').inputValue() !== slug) erreurs.push('/essai/ : template non présélectionné');
  await page.fill('input[name=prenom]', 'Camille');
  await page.fill('input[name=email]', `essai-${slug}-${Date.now()}@exemple.fr`);
  await page.check('input[name=consentement]');
  await cap('1-formulaire');
  await page.click('#essai-form button[type=submit]');
  await page.waitForSelector('#essai-pret:not([hidden])', { timeout: 5000 });
  const code = (await page.textContent('#essai-code')).trim();
  if (!code.startsWith(produit)) erreurs.push(`code inattendu ${code}`);
  await cap('2-pret');

  // 2. Application avec le code d'essai
  await page.click('#essai-ouvrir');
  await page.waitForSelector('.qme-essai[data-etat="actif"]', { timeout: 6000 }).catch(() => erreurs.push('bandeau « essai actif » absent'));
  const stocke = await page.evaluate((pre) => JSON.parse(localStorage.getItem(`qme-${pre}-code`) || 'null'), produit.toLowerCase());
  if (stocke !== code) erreurs.push(`code non enregistré dans l'application (${stocke})`);
  if (page.url().includes('essai=')) erreurs.push('le code reste dans l\'adresse');
  await cap('3-app-vide');

  // 3. Données (celles de la démo) enregistrées avec le code d'essai, puis rechargement
  const put = await page.evaluate(async ({ code, donnees }) => {
    const r = await fetch('/api/templates/donnees', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-code': code }, body: JSON.stringify({ donnees: { ...donnees, tutorielVu: true }, base: null }) });
    return { statut: r.status, corps: await r.json() };
  }, { code, donnees: donneesDemo || {} });
  if (put.statut !== 200) erreurs.push(`enregistrement pendant l'essai : ${put.statut}`);
  const majLe = put.corps.majLe;
  await page.reload();
  await page.waitForSelector('#vue, main', { timeout: 6000 }).catch(() => erreurs.push('application non démarrée avec les données'));
  await page.waitForTimeout(400);
  const texteBandeau = await page.textContent('.qme-essai').catch(() => '');
  if (!/encore 14 jours/.test(texteBandeau || '')) erreurs.push(`bandeau : « ${texteBandeau} »`);
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await cap('4-app-essai');

  // 4. Quinze jours plus tard : lecture seule
  await decaler(15);
  const puts = [];
  page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/api/templates/donnees')) puts.push(r.url()); });
  await page.reload();
  await page.waitForSelector('.qme-essai[data-etat="termine"]', { timeout: 6000 }).catch(() => erreurs.push('bandeau « essai terminé » absent'));
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await cap('5-lecture-seule');

  // Onglets : permis.
  const onglets = await page.locator('[data-action="vue"]:visible').all();
  for (const o of onglets) {
    await o.click().catch(() => {});
    await page.waitForTimeout(120);
    if (await page.locator('.qme-essai-dlg[open]').count()) { erreurs.push(`onglet bloqué : ${await o.getAttribute('data-vue')}`); await page.keyboard.press('Escape'); }
  }
  // Autres actions : une modification doit ouvrir « Lecture seule » ; jamais d'enregistrement envoyé.
  if (onglets.length) await onglets[0].click().catch(() => {});
  let bloquees = 0, essais = 0;
  const actions = await page.locator('#vue [data-action]:visible, main [data-action]:visible').all();
  for (const a of actions.slice(0, 14)) {
    const nom = await a.getAttribute('data-action').catch(() => null);
    if (!nom || /^(vue|deconnexion|demo.*|installer|imprimer.*|lancer-impression|exporter.*|csv.*|copier.*|partager|ics|agenda)$/.test(nom)) continue;
    essais++;
    await a.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(150);
    if (await page.locator('.qme-essai-dlg[open]').count()) {
      bloquees++;
      await page.locator('.qme-essai-dlg [data-qme="fermer"]').click().catch(() => {});
      await page.waitForLoadState('load');
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => document.querySelectorAll('dialog[open]:not(.qme-essai-dlg)').forEach((d) => d.close()));
  }
  notes.push(`lecture seule : ${bloquees}/${essais} actions bloquées, ${onglets.length} onglets libres`);
  // Formulaire d'une modale de l'application : soumission arrêtée.
  const g = await page.evaluate(async (code) => (await (await fetch('/api/templates/donnees', { headers: { 'x-code': code } })).json()).donnees?.majLe, code);
  if (g !== majLe) erreurs.push('les données du serveur ont changé pendant la lecture seule');
  if (puts.length) erreurs.push(`${puts.length} enregistrement(s) envoyé(s) en lecture seule`);
  const refus = await page.evaluate(async (code) => (await fetch('/api/templates/donnees', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-code': code }, body: '{"donnees":{"x":1}}' })).status, code);
  if (refus !== 403 && refus !== 200) erreurs.push(`PUT direct : ${refus}`);
  const refusServeur = (await (await fetch(`${BASE}/api/templates/donnees`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-code': code }, body: '{"donnees":{"x":1}}' })).status);
  if (refusServeur !== 403) erreurs.push(`le serveur accepte une écriture après l'essai (${refusServeur})`);

  // 5. « J'ai acheté » avec une clé de test : données reprises
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await page.click('.qme-essai [data-qme="achete"]');
  const cle = `0E55A1${rang.toString(16).toUpperCase().padStart(2, '0')}-00000000-00000000-00000000`;
  await page.fill('.qme-essai-dlg input[name=cle]', cle);
  await cap('6-j-ai-achete');
  await page.click('.qme-essai-dlg button[type=submit]');
  await page.waitForTimeout(1600);
  await page.waitForLoadState('load');
  await page.waitForTimeout(700);
  if (await page.locator('.qme-essai').count()) erreurs.push('bandeau encore affiché après l\'achat');
  const apres = await page.evaluate(async ({ pre, cle }) => {
    const r = await fetch('/api/templates/connexion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: cle, produit: pre.toUpperCase() }) });
    const c = await r.json();
    return { statut: r.status, code: JSON.parse(localStorage.getItem(`qme-${pre}-code`) || 'null'), majLe: c.donnees?.majLe || null, essai: c.essai || null };
  }, { pre: produit.toLowerCase(), cle });
  if (apres.statut !== 200 || apres.code !== cle) erreurs.push(`après achat : ${JSON.stringify(apres)}`);
  if (!apres.majLe) erreurs.push('données d\'essai non reprises dans l\'espace acheté');
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await cap('7-achete');
  // Le code d'essai ne s'ouvre plus.
  const vieux = await page.evaluate(async (code) => (await fetch('/api/templates/connexion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).status, code);
  if (vieux !== 401) erreurs.push(`code d'essai encore accepté après achat (${vieux})`);

  await contexte.close();
  await decaler(0);
  return { slug, erreurs, notes };
}

// Téléphone : bandeau et fenêtres lisibles à 390 px, rien qui déborde.
async function telephone(navigateur, { slug }) {
  const erreurs = [];
  const contexte = await navigateur.newContext({ ...devices['iPhone 13'] });
  const page = await contexte.newPage();
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/essai/?t=${slug}`);
  if (captures) await page.screenshot({ path: path.join(captures, `${slug}-tel-1-essai.png`), fullPage: true });
  await page.fill('input[name=email]', `tel-${slug}-${Date.now()}@exemple.fr`);
  await page.check('input[name=consentement]');
  await page.click('#essai-form button[type=submit]');
  await page.waitForSelector('#essai-pret:not([hidden])');
  if (captures) await page.screenshot({ path: path.join(captures, `${slug}-tel-2-pret.png`) });
  await page.click('#essai-ouvrir');
  await page.waitForSelector('.qme-essai');
  await page.waitForTimeout(500);
  const large = await page.evaluate(() => document.documentElement.scrollWidth);
  if (large > 392) erreurs.push(`page plus large que l'écran (${large} px)`);
  if (captures) await page.screenshot({ path: path.join(captures, `${slug}-tel-3-app.png`) });
  await decaler(15);
  await page.reload();
  await page.waitForSelector('.qme-essai[data-etat="termine"]');
  await page.click('.qme-essai [data-qme="achete"]');
  if (captures) await page.screenshot({ path: path.join(captures, `${slug}-tel-4-achat.png`) });
  await decaler(0);
  await contexte.close();
  return erreurs;
}

(async () => {
  const { PRODUITS_ESSAI } = await import('../../netlify/lib/essais.mjs');
  const { TEMPLATES } = await import('../packs/donnees.mjs');
  const { PRODUITS } = await import('../../netlify/lib/templates-acces.mjs');
  const rangs = Object.keys(PRODUITS);
  const liste = PRODUITS_ESSAI.map((p) => ({ produit: p, slug: TEMPLATES[p].slug, rang: rangs.indexOf(p) }))
    .filter((t) => cible === 'tous' || t.slug === cible);
  if (!liste.length) throw new Error(`Template inconnu ou non ouvert à l'essai : ${cible}`);
  const navigateur = await chromium.launch();
  let echecs = 0;
  for (const t of liste) {
    const r = await parcours(navigateur, t);
    if (cible !== 'tous') r.erreurs.push(...(await telephone(navigateur, t)));
    echecs += r.erreurs.length ? 1 : 0;
    console.log(`${r.erreurs.length ? 'ÉCHEC' : 'ok   '} ${t.slug.padEnd(24)} ${r.notes.join(' ; ')}${r.erreurs.length ? `\n      - ${r.erreurs.join('\n      - ')}` : ''}`);
  }
  await navigateur.close();
  console.log(`${liste.length - echecs}/${liste.length} templates sans erreur.`);
  process.exit(echecs ? 1 : 0);
})();
