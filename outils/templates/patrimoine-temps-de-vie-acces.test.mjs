// Accès aux deux templates « Inventaire valorisé » (PTM) et « Temps de vie » (TDV) : licence Gumroad, code interne,
// code administrateur et cloisonnement des données. La logique est commune ; ce test vérifie le branchement des deux produits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, traiter, PRODUITS, codeAdmin } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'z'.repeat(40);
const memoire = () => { const m = new Map(); return { get: async (c) => m.get(c) ?? null, set: async (c, v) => { m.set(c, v); } }; };
const LICENCE = 'ABCDEF01-23456789-ABCDEF01-23456789';
const connexion = (stockage, code, options = {}) => traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code, ...options.corps }) }),
  { secret: SECRET, stockage, verifierLicence: options.verifier || (async () => ({ ok: false, raison: 'inconnue' })) });

for (const [pre, nom, url] of [['PTM', 'Inventaire valorisé', '/templates/patrimoine/'], ['TDV', 'Temps de vie', '/templates/temps-de-vie/']]) {
  test(`${pre} : produit déclaré, code interne accepté, données cloisonnées`, async () => {
    assert.equal(PRODUITS[pre].nom, nom); assert.equal(PRODUITS[pre].url, url);
    const s = memoire();
    const r = await (await connexion(s, genererCode(SECRET, pre))).json();
    assert.equal(r.produit, pre); assert.equal(r.url, url); assert.equal(r.donnees, null);
    assert.equal((await connexion(s, `${pre}-0000-0000-0000-0000`)).status, 401);
  });

  test(`${pre} : clé de licence Gumroad valide, remboursée, et code administrateur`, async () => {
    const avant = PRODUITS[pre].gumroad;
    PRODUITS[pre].gumroad = `id-test-${pre}`;
    try {
      const s = memoire();
      const valide = async (produit) => ({ ok: produit === `id-test-${pre}`, raison: 'inconnue' });
      const r = await (await connexion(s, LICENCE, { verifier: valide })).json();
      assert.equal(r.produit, pre);
      const r2 = await (await connexion(s, LICENCE.toLowerCase(), { verifier: valide })).json();
      assert.equal(r2.jeton, r.jeton, 'même jeton sur un autre appareil');
      const rembourse = await connexion(s, LICENCE, { verifier: async (produit) => (produit === `id-test-${pre}` ? { ok: false, raison: 'rembourse' } : { ok: false, raison: 'inconnue' }) });
      assert.equal(rembourse.status, 403);
      const adm = await (await connexion(s, codeAdmin(SECRET), { corps: { produit: pre } })).json();
      assert.equal(adm.produit, pre);
    } finally {
      if (avant === undefined) delete PRODUITS[pre].gumroad; else PRODUITS[pre].gumroad = avant;
    }
  });
}
