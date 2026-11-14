import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiter, genererCode, genererCodePack, verifierCodePack, verifierCode, codePackProduit, codePackDepuisLicence, PRODUITS, PACKS, SUR_MESURE } from '../../netlify/lib/templates-acces.mjs';
import { remise, prixPack } from '../../netlify/lib/packs.mjs';

const SECRET = 'x'.repeat(40);
const memoire = () => { const m = new Map(); return { get: async (c) => m.get(c) ?? null, set: async (c, v) => { m.set(c, v); } }; };
const connexion = (code, options = {}) => traiter(new Request('http://t/api/templates/connexion', {
  method: 'POST', body: JSON.stringify({ code }),
}), { secret: SECRET, stockage: memoire(), ...options });

test('remise progressive de 10 à 25 % et prix arrondi à l’euro inférieur', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(remise), [0, 0, 10, 15, 20, 25, 25]);
  assert.deepEqual(prixPack([1200, 2500, 2900, 2500, 1900, 2900]), { valeur: 13900, pct: 25, prix: 10400, economie: 3500 });
  assert.deepEqual(prixPack([1490, 1500, 1200]), { valeur: 4190, pct: 15, prix: 3500, economie: 690 });
  assert.deepEqual(prixPack([1900]), { valeur: 1900, pct: 0, prix: 1900, economie: 0 });
});

test('les packs sont cohérents : préfixes uniques, sans I L O U, slugs uniques', () => {
  const prefixes = [...Object.keys(PACKS), SUR_MESURE];
  for (const p of prefixes) {
    assert.match(p, /^[A-HJKMNP-TV-Z]{3}$/);
    assert.ok(!PRODUITS[p], `${p} est déjà un template`);
  }
  const slugs = Object.values(PACKS).map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const p of Object.values(PACKS)) assert.ok(p.produits.length >= 2, p.slug);
});

test('un code de pack est valide, falsifié il est refusé, révoqué aussi', () => {
  const code = genererCodePack(SECRET, 'PFG');
  assert.match(code, /^PFG-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const ok = verifierCodePack(SECRET, code.toLowerCase());
  assert.equal(ok.pack, 'PFG');
  assert.deepEqual(ok.produits, PACKS.PFG.produits.filter((p) => PRODUITS[p]));
  assert.equal(verifierCodePack(SECRET, code.slice(0, -1) + (code.at(-1) === 'A' ? 'B' : 'A')), null);
  assert.equal(verifierCodePack(SECRET, code, [code.slice(4, 13)]), null);
  assert.equal(verifierCodePack('y'.repeat(40), code), null);
  // Un code de pack n'ouvre pas directement un template, et inversement.
  assert.equal(verifierCode(SECRET, code), null);
  assert.equal(verifierCodePack(SECRET, genererCode(SECRET, 'REV')), null);
});

test('pack sur mesure : la composition est signée et ne peut pas être modifiée', () => {
  const code = genererCodePack(SECRET, SUR_MESURE, ['BDG', 'ABN', 'DTT']);
  assert.match(code, /^SMP-BDGABNDTT-/);
  assert.deepEqual(verifierCodePack(SECRET, code).produits, ['BDG', 'ABN', 'DTT']);
  assert.equal(verifierCodePack(SECRET, code.replace('BDGABNDTT', 'BDGABNGNT')), null);
  assert.throws(() => genererCodePack(SECRET, SUR_MESURE, ['BDG']));
  assert.throws(() => genererCodePack(SECRET, SUR_MESURE, ['BDG', 'ZZZ']));
});

test('connexion avec un code de pack : liste des templates, chacun avec un code valide et stable', async () => {
  const code = genererCodePack(SECRET, 'PAR');
  const r = await connexion(code);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.pack, 'PAR');
  assert.equal(j.slug, 'argent');
  assert.deepEqual(j.templates.map((t) => t.produit), PACKS.PAR.produits.filter((p) => PRODUITS[p]));
  for (const t of j.templates) {
    assert.deepEqual(verifierCode(SECRET, t.code)?.produit, t.produit);
    assert.equal(t.url, PRODUITS[t.produit].url);
    // Le template s'ouvre avec ce code, comme avec un code acheté seul.
    const rt = await connexion(t.code);
    assert.equal((await rt.json()).produit, t.produit);
  }
  const j2 = await (await connexion(code)).json();
  assert.deepEqual(j2.templates.map((t) => t.code), j.templates.map((t) => t.code));
  const v = verifierCodePack(SECRET, code);
  assert.equal(codePackProduit(SECRET, 'PAR', v.id, 'BDG'), j.templates.find((t) => t.produit === 'BDG').code);
});

test('licence Gumroad d’un pack : convertie en code de pack', async () => {
  const LICENCE = 'ABCDEF01-23456789-ABCDEF01-23456789';
  const sauve = PACKS.PFC.gumroad;
  PACKS.PFC.gumroad = 'pack-pfc';
  try {
    const verifierLicence = async (produit) => ({ ok: produit === 'pack-pfc', achat: { variants: '', sale_timestamp: '2026-11-20T10:00:00Z' } });
    const j = await (await connexion(LICENCE, { verifierLicence })).json();
    assert.equal(j.pack, 'PFC');
    assert.equal(j.code, LICENCE);
    assert.equal(j.option, false);
    assert.ok(j.templates.length >= 2);
  } finally {
    if (sauve === undefined) delete PACKS.PFC.gumroad; else PACKS.PFC.gumroad = sauve;
  }
});

test('le site connaît tous les packs : connexion, pages générées, textes', async () => {
  const { readFile } = await import('node:fs/promises');
  const racine = new URL('../../', import.meta.url);
  const connexion = await readFile(new URL('connexion/index.html', racine), 'utf8');
  const liste = JSON.parse(connexion.match(/const PACKS=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(liste.sort(), Object.keys(PACKS).sort());
  const { PAGES, TEMPLATES } = await import('../packs/donnees.mjs');
  const { calculerPack } = await import('../packs/generer.mjs');
  for (const [code, pack] of Object.entries(PACKS)) {
    assert.ok(PAGES[code], `textes du pack ${code}`);
    const p = calculerPack(code);
    // Le prix publié est celui du barème ; la page générée l'affiche.
    const page = await readFile(new URL(`packs/${pack.slug}/index.html`, racine), 'utf8');
    assert.ok(page.includes(`data-interet="pack-${pack.slug}"`) || p.enVente, `bouton d'intérêt ${pack.slug}`);
    assert.ok(page.includes(`>${(p.prix / 100)} €<`), `prix affiché ${pack.slug}`);
  }
  for (const pre of Object.keys(PRODUITS)) if (pre !== 'SNT') assert.ok(TEMPLATES[pre], `fiche courte du template ${pre} dans outils/packs/donnees.mjs`);
});

test('achat Gumroad du pack sur mesure : composition lue dans l’achat, montant contrôlé', async () => {
  const { ACHAT_SUR_MESURE } = await import('../../netlify/lib/templates-acces.mjs');
  const { compositionDepuisAchat } = await import('../../netlify/lib/packs.mjs');
  assert.deepEqual(compositionDepuisAchat({ custom_fields: ['Templates: bdg, ABN,DTT, ZZZ, BDG'] }, PRODUITS), ['BDG', 'ABN', 'DTT']);
  assert.deepEqual(compositionDepuisAchat({ custom_fields: { Templates: 'TJM PRX' } }, PRODUITS), ['TJM', 'PRX']);
  const LICENCE = '0A1B2C3D-4E5F6071-8293A4B5-C6D7E8F9';
  ACHAT_SUR_MESURE.gumroad = 'pack-smp';
  try {
    const achat = (price, custom_fields = ['Templates: BDG,ABN,DTT']) => async (produit) => produit === 'pack-smp' ? { ok: true, achat: { price, currency: 'eur', custom_fields } } : { ok: false, raison: 'inconnue' };
    // BDG 15 + ABN 12 + DTT 12 = 39 € ; −15 % → 33,15 → 33 €.
    const ok = await connexion(LICENCE, { verifierLicence: achat(3300) });
    assert.equal(ok.status, 200);
    const j = await ok.json();
    assert.equal(j.pack, SUR_MESURE);
    assert.deepEqual(j.templates.map((t) => t.produit), ['BDG', 'ABN', 'DTT']);
    const j2 = await (await connexion(LICENCE, { verifierLicence: achat(3300) })).json();
    assert.equal(j2.code, j.code);
    assert.equal((await connexion(LICENCE, { verifierLicence: achat(3200) })).status, 403);
    assert.equal((await connexion(LICENCE, { verifierLicence: achat(3300, ['Templates: BDG']) })).status, 422);
  } finally { delete ACHAT_SUR_MESURE.gumroad; }
});

test('option « Pack évolutif » : templates ajoutés après l’achat ouverts seulement avec l’option', async () => {
  const { prixOption, produitsAccessibles } = await import('../../netlify/lib/packs.mjs');
  assert.equal(prixOption(10400), 2600);
  assert.equal(prixOption(5000), 1300);
  assert.equal(prixOption(2700), 900);
  const sauve = PACKS.PAR.ajouts;
  PACKS.PAR.ajouts = { ABN: '2026-12-01' }; // template entré dans le pack après son lancement (simulation)
  try {
    assert.ok(!produitsAccessibles('PAR', { date: '2026-11-20' }, PRODUITS).includes('ABN'));
    assert.ok(produitsAccessibles('PAR', { date: '2026-12-02' }, PRODUITS).includes('ABN'));
    assert.ok(produitsAccessibles('PAR', { option: true, date: '2026-11-20' }, PRODUITS).includes('ABN'));
    // Codes générés à la main : sans option, templates d'origine ; avec option, tout le pack.
    const sans = verifierCodePack(SECRET, genererCodePack(SECRET, 'PAR'));
    const avec = verifierCodePack(SECRET, genererCodePack(SECRET, 'PAR', [], { option: true }));
    assert.deepEqual([sans.option, avec.option], [false, true]);
    assert.ok(!sans.produits.includes('ABN'));
    assert.ok(avec.produits.includes('ABN'));
    // Licence Gumroad : la version « Pack évolutif » donne l'option, la date d'achat fait le reste.
    const LICENCE = '11111111-22222222-33333333-44444444';
    PACKS.PAR.gumroad = 'pack-par';
    const achat = (variants, date) => async (p) => p === 'pack-par' ? { ok: true, achat: { variants, sale_timestamp: date } } : { ok: false, raison: 'inconnue' };
    const base = await (await connexion(LICENCE, { verifierLicence: achat('(Pack)', '2026-11-20T09:00:00Z') })).json();
    const evo = await (await connexion(LICENCE, { verifierLicence: achat('(Pack évolutif)', '2026-11-20T09:00:00Z') })).json();
    assert.ok(!base.templates.some((t) => t.produit === 'ABN'));
    assert.ok(evo.templates.some((t) => t.produit === 'ABN'));
    assert.equal(evo.option, true);
    // Même clé, mêmes codes de template : les données ne changent pas si l'option est ajoutée.
    assert.equal(base.templates[0].code, evo.templates[0].code);
  } finally { PACKS.PAR.ajouts = sauve; delete PACKS.PAR.gumroad; }
});
