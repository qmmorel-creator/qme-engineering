import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, verifierCode, traiter } from '../../netlify/lib/templates-acces.mjs';

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
