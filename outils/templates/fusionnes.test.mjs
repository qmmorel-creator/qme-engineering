// Templates fusionnés : une licence Gumroad de l'ancien produit ouvre le template qui l'a absorbé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiter, FUSIONNES, PRODUITS } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'x'.repeat(40);
const memoire = () => { const m = new Map(); return { get: async (c) => m.get(c) ?? null, set: async (c, v) => { m.set(c, v); } }; };

test('chaque template fusionné pointe vers un template existant, et n’est plus vendu sur le site', () => {
  for (const [k, f] of Object.entries(FUSIONNES)) {
    assert.ok(PRODUITS[f.vers], `${k} → ${f.vers}`);
    assert.ok(!PRODUITS[k], `${k} ne doit plus être dans PRODUITS`);
    assert.match(f.gumroad, /==$/);
  }
});

test('licence du Pipeline de prospection : ouvre CRM et prospection, avec un code stable', async () => {
  const LICENCE = 'ABCDEF01-23456789-ABCDEF01-2345678A';
  const verifierLicence = async (gumroad) => (gumroad === FUSIONNES.PRS.gumroad ? { ok: true, achat: { email: '' } } : { ok: false, raison: 'inconnue' });
  const stockage = memoire();
  const connexion = async () => (await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code: LICENCE }) }), { secret: SECRET, stockage, verifierLicence })).json();
  const a = await connexion(), b = await connexion();
  assert.equal(a.produit, 'CRM');
  assert.equal(a.url, PRODUITS.CRM.url);
  assert.equal(a.jeton, b.jeton);
});
