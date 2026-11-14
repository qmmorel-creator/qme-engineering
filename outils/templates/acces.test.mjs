import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, verifierCode, traiter, estLicence, codeDepuisLicence, verifierLicenceGumroad, PRODUITS, stockageMigrant, codeAdmin, codeAdminProduit, estCodeAdmin } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'x'.repeat(40);
const memoire = () => { const m = new Map(); return { get: async (c) => m.get(c) ?? null, set: async (c, v) => { m.set(c, v); } }; };
const appel = (stockage, methode, chemin, { corps, code } = {}) => traiter(new Request(`http://t/api/templates${chemin}`, {
  method: methode, headers: code ? { 'x-code': code } : {}, body: corps ? JSON.stringify(corps) : undefined,
}), { secret: SECRET, stockage });

test('un code généré est valide, tolérant à la saisie', () => {
  const code = genererCode(SECRET, 'REV');
  assert.match(code, /^REV-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.ok(verifierCode(SECRET, code));
  assert.ok(verifierCode(SECRET, ` ${code.toLowerCase().replace(/-/g, ' ')} `));
});

test('code falsifié, autre secret, révoqué ou vide : refusé', () => {
  const code = genererCode(SECRET, 'REV');
  const dernier = code.at(-1) === 'A' ? 'B' : 'A';
  assert.equal(verifierCode(SECRET, code.slice(0, -1) + dernier), null);
  assert.equal(verifierCode('y'.repeat(40), code), null);
  assert.equal(verifierCode(SECRET, code, [code.slice(4, 13)]), null);
  assert.equal(verifierCode(SECRET, ''), null);
  assert.equal(verifierCode(SECRET, 'REV-1234'), null);
});

test('secret trop court refusé à la génération', () => {
  assert.throws(() => genererCode('court', 'REV'));
});

test('connexion, enregistrement, relecture et conflit entre appareils', async () => {
  const s = memoire(), code = genererCode(SECRET, 'REV');
  assert.equal((await appel(s, 'POST', '/connexion', { corps: { code: 'REV-0000-0000-0000-0000' } })).status, 401);
  const c = await (await appel(s, 'POST', '/connexion', { corps: { code } })).json();
  assert.deepEqual([c.ok, c.donnees], [true, null]);

  const r1 = await appel(s, 'PUT', '/donnees', { code, corps: { donnees: { a: 1 }, base: null } });
  const { majLe } = await r1.json();
  assert.equal(r1.status, 200);
  assert.equal((await (await appel(s, 'GET', '/donnees', { code })).json()).donnees.a, 1);

  // Un second appareil écrit avec une base périmée : 409 et version du serveur renvoyée.
  const r2 = await appel(s, 'PUT', '/donnees', { code, corps: { donnees: { a: 2 }, base: '2020-01-01T00:00:00.000Z' } });
  assert.equal(r2.status, 409);
  assert.equal((await r2.json()).donnees.a, 1);
  assert.equal((await appel(s, 'PUT', '/donnees', { code, corps: { donnees: { a: 3 }, base: majLe } })).status, 200);
});

test('deux codes ne partagent pas leurs données', async () => {
  const s = memoire(), a = genererCode(SECRET, 'REV'), b = genererCode(SECRET, 'REV');
  await appel(s, 'PUT', '/donnees', { code: a, corps: { donnees: { qui: 'a' } } });
  assert.equal((await (await appel(s, 'GET', '/donnees', { code: b })).json()).donnees, null);
});

test('sans secret configuré : 503', async () => {
  const r = await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: '{}' }), { secret: '', stockage: memoire() });
  assert.equal(r.status, 503);
});

const LICENCE = 'A1B2C3D4-E5F60718-293A4B5C-6D7E8F90';
const appelLicence = (stockage, verifierLicence, code = LICENCE) => traiter(new Request('http://t/api/templates/connexion', {
  method: 'POST', body: JSON.stringify({ code }),
}), { secret: SECRET, stockage, verifierLicence });

test('format des clés Gumroad', () => {
  assert.ok(estLicence(LICENCE));
  assert.ok(estLicence(` ${LICENCE.toLowerCase()} `));
  assert.ok(!estLicence('REV-0000-0000-0000-0000'));
  assert.ok(!estLicence('A1B2C3D4-E5F6'));
});

test('licence valide : jeton stable, mêmes données sur un autre appareil', async () => {
  const s = memoire();
  const r1 = await (await appelLicence(s, async () => ({ ok: true }))).json();
  assert.equal(r1.produit, 'REV');
  assert.equal(r1.url, '/templates/revision/');
  assert.equal(r1.jeton, codeDepuisLicence(SECRET, 'REV', LICENCE));
  assert.ok(verifierCode(SECRET, r1.jeton));
  await appel(s, 'PUT', '/donnees', { code: r1.jeton, corps: { donnees: { a: 1 } } });
  const r2 = await (await appelLicence(s, async () => ({ ok: true }), LICENCE.toLowerCase())).json();
  assert.equal(r2.jeton, r1.jeton);
  assert.equal(r2.donnees.a, 1);
});

test('licence inconnue 401, remboursée 403, Gumroad indisponible 502', async () => {
  const s = memoire();
  assert.equal((await appelLicence(s, async () => ({ ok: false, raison: 'inconnue' }))).status, 401);
  assert.equal((await appelLicence(s, async () => ({ ok: false, raison: 'rembourse' }))).status, 403);
  assert.equal((await appelLicence(s, async () => { throw new Error('réseau'); })).status, 502);
});

test('une licence ne sert jamais directement d\'en-tête de données', async () => {
  const r = await appel(memoire(), 'GET', '/donnees', { code: LICENCE });
  assert.equal(r.status, 401);
});

test('réponses Gumroad interprétées', async () => {
  const faux = (statut, corps) => async () => new Response(JSON.stringify(corps), { status: statut });
  assert.deepEqual(await verifierLicenceGumroad('p', LICENCE, faux(404, { success: false })), { ok: false, raison: 'inconnue' });
  assert.deepEqual(await verifierLicenceGumroad('p', LICENCE, faux(200, { success: true, purchase: { refunded: false, price: 1200, currency: 'eur', custom_fields: [] } })), { ok: true, achat: { price: 1200, currency: 'eur', custom_fields: [] } });
  assert.deepEqual(await verifierLicenceGumroad('p', LICENCE, faux(200, { success: true, purchase: { refunded: true } })), { ok: false, raison: 'rembourse' });
  await assert.rejects(verifierLicenceGumroad('p', LICENCE, faux(500, {})));
});

test('appel réel à Gumroad avec une clé inventée : refusée', { skip: !process.env.TEST_GUMROAD }, async () => {
  assert.deepEqual(await verifierLicenceGumroad('zjO4cm1dUdBGh1IfYqmklw==', LICENCE), { ok: false, raison: 'inconnue' });
});

test('licence d\'un autre produit : routée vers ce produit, même si Gumroad échoue pour un autre', async () => {
  const s = memoire();
  const pour = (cible, panne) => async (idGumroad) => {
    if (idGumroad === panne) throw new Error('réseau');
    return idGumroad === cible ? { ok: true } : { ok: false, raison: 'inconnue' };
  };
  const r = await (await appelLicence(s, pour(PRODUITS.BCM.gumroad, PRODUITS.REV.gumroad))).json();
  assert.equal(r.produit, 'BCM');
  assert.equal(r.url, '/templates/budget-commun/');
  assert.equal(r.jeton, codeDepuisLicence(SECRET, 'BCM', LICENCE));
});

test('migration du stockage : reprise depuis l\'ancien, copie dans le nouveau, effacement de l\'ancien', async () => {
  const ancienne = new Map([['REV/abc', { a: 1 }]]), nouvelle = new Map();
  const ancien = { get: async (c) => ancienne.get(c) ?? null, supprimer: async (c) => { ancienne.delete(c); } };
  const nouveau = { get: async (c) => nouvelle.get(c) ?? null, set: async (c, v) => { nouvelle.set(c, v); } };
  const s = stockageMigrant(nouveau, ancien);
  assert.deepEqual(await s.get('REV/abc'), { a: 1 });
  assert.deepEqual(nouvelle.get('REV/abc'), { a: 1 });
  assert.equal(ancienne.has('REV/abc'), false);
  assert.equal(await s.get('REV/inconnue'), null);
  // Écriture : toujours dans le nouveau stockage.
  await s.set('REV/x', { b: 2 });
  assert.deepEqual(nouvelle.get('REV/x'), { b: 2 });
  // Copie en échec : l'ancien n'est pas effacé.
  const ancienne2 = new Map([['k', { c: 3 }]]);
  const s2 = stockageMigrant({ get: async () => null, set: async () => { throw new Error('réseau'); } },
    { get: async (c) => ancienne2.get(c) ?? null, supprimer: async (c) => { ancienne2.delete(c); } });
  await assert.rejects(s2.get('k'));
  assert.equal(ancienne2.has('k'), true);
});

test('code administrateur : ouvre chaque template avec un espace personnel stable', async () => {
  const st = memoire();
  const adm = codeAdmin(SECRET);
  assert.ok(estCodeAdmin(SECRET, adm.toLowerCase()));
  assert.ok(!estCodeAdmin(SECRET, genererCode(SECRET, 'REV')));
  // Sans template précisé : refusé.
  assert.equal((await appel(st, 'POST', '/connexion', { corps: { code: adm } })).status, 400);
  // Template inconnu : refusé.
  assert.equal((await appel(st, 'POST', '/connexion', { corps: { code: adm, produit: 'XYZ' } })).status, 400);
  const r1 = await (await appel(st, 'POST', '/connexion', { corps: { code: adm, produit: 'GNT' } })).json();
  assert.equal(r1.produit, 'GNT');
  assert.equal(r1.jeton, codeAdminProduit(SECRET, 'GNT'));
  assert.ok(verifierCode(SECRET, r1.jeton), 'le jeton est un code interne valide');
  // Données enregistrées puis relues depuis un autre appareil avec le même code administrateur.
  assert.equal((await appel(st, 'PUT', '/donnees', { code: r1.jeton, corps: { donnees: { a: 1 } } })).status, 200);
  const r2 = await (await appel(st, 'POST', '/connexion', { corps: { code: adm, produit: 'GNT' } })).json();
  assert.equal(r2.donnees.a, 1);
  // Un autre template a son propre espace.
  const r3 = await (await appel(st, 'POST', '/connexion', { corps: { code: adm, produit: 'REV' } })).json();
  assert.equal(r3.produit, 'REV'); assert.equal(r3.donnees, null); assert.notEqual(r3.jeton, r1.jeton);
  // Un faux code administrateur n'ouvre rien.
  assert.equal((await appel(st, 'POST', '/connexion', { corps: { code: 'ADM-0000-0000-0000-0000', produit: 'GNT' } })).status, 401);
});
