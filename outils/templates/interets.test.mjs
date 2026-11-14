import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiterInterets, codeAdmin, estAdmin, synthese, csv, cleClic, lireCle, MODULES } from '../../netlify/lib/interets.mjs';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'secret-de-test-0123456789-0123456789-abcdef';
const memoire = () => { const s = new Map(); return { ajouter: async (c, v) => { s.set(c, v); }, lire: async (c) => s.get(c) ?? null, supprimer: async (c) => { s.delete(c); }, lister: async (p) => [...s.keys()].filter((c) => c.startsWith(p)), s }; };
const req = (methode, corps, entetes = {}, q = '') => new Request(`https://x.test/api/interets${q}`, { method: methode, headers: entetes, body: corps === undefined ? undefined : JSON.stringify(corps) });

test('modules : un par template, slug → nom', () => {
  assert.equal(MODULES.flotte, 'Gestion de flotte de véhicules');
  assert.equal(MODULES.revision, 'Planning de révision');
  assert.equal(MODULES['secret-santa'], 'Secret Santa');
  // Un module par produit de PRODUITS (le nombre suit l'ajout des templates, sans valeur figée).
  assert.equal(Object.keys(MODULES).length, Object.keys(PRODUITS).length);
  assert.equal(MODULES['suivi-chantier'], 'Suivi de chantier par lot');
  assert.equal(MODULES.patrimoine, 'Inventaire valorisé');
  assert.equal(MODULES['temps-de-vie'], 'Temps de vie');
});

test('code administrateur : stable, au bon format, reconnu sans tenir compte des tirets ni de la casse', () => {
  const c = codeAdmin(SECRET);
  assert.match(c, /^ADM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(codeAdmin(SECRET), c);
  assert.ok(estAdmin(c.toLowerCase().replace(/-/g, ' '), { secret: SECRET }));
  assert.ok(!estAdmin('ADM-0000-0000-0000-0000', { secret: SECRET }));
  assert.ok(!estAdmin('', { secret: SECRET }));
  assert.ok(estAdmin('mot-de-passe-admin-long', { secret: SECRET, admin: 'mot-de-passe-admin-long' }));
  assert.ok(!estAdmin('court', { secret: '', admin: 'court' }), 'un mot de passe de moins de 16 caractères est refusé');
});

test('clé de clic : module et heure relus', () => {
  const d = new Date('2026-11-13T21:05:00Z');
  const k = lireCle(cleClic('crm', d, 'ABCDEFGH'));
  assert.equal(k.module, 'crm'); assert.equal(k.date.toISOString(), d.toISOString());
  assert.equal(lireCle('clic/inconnu/2026-11-13T21:05:00.000Z~X'), null);
});

test('POST : compte un clic par appel, refuse un module inconnu ou une requête trop longue', async () => {
  const st = memoire();
  const opt = { secret: SECRET, stockage: st };
  assert.equal((await traiterInterets(req('POST', { module: 'flotte' }), opt)).status, 200);
  assert.equal((await traiterInterets(req('POST', { module: 'flotte' }), opt)).status, 200);
  assert.equal((await traiterInterets(req('POST', { module: 'pirate' }), opt)).status, 400);
  assert.equal((await traiterInterets(req('POST', { module: 'x'.repeat(500) }), opt)).status, 413);
  assert.equal(st.s.size, 2);
});

test('GET : réservé à l’administrateur ; synthèse et CSV', async () => {
  const st = memoire();
  const maintenant = () => new Date('2026-11-20T12:00:00Z');
  await st.ajouter(cleClic('flotte', new Date('2026-11-01T08:00:00Z')));
  await st.ajouter(cleClic('flotte', new Date('2026-11-19T08:00:00Z')));
  await st.ajouter(cleClic('crm', new Date('2026-11-18T08:00:00Z')));
  const opt = { secret: SECRET, stockage: st, maintenant };
  assert.equal((await traiterInterets(req('GET'), opt)).status, 401);
  const r = await traiterInterets(req('GET', undefined, { 'x-admin': codeAdmin(SECRET) }), opt);
  const s = await r.json();
  assert.equal(s.total, 3);
  assert.deepEqual(s.modules.map((m) => [m.module, m.total, m.septJours]), [['flotte', 2, 1], ['crm', 1, 1]]);
  assert.equal(s.modules[0].dernier, '2026-11-19T08:00:00.000Z');
  const octets = new Uint8Array(await (await traiterInterets(req('GET', undefined, { 'x-admin': codeAdmin(SECRET) }, '?format=csv'), opt)).arrayBuffer());
  assert.deepEqual([...octets.slice(0, 3)], [0xEF, 0xBB, 0xBF], 'BOM UTF-8 pour Excel');
  const c = new TextDecoder().decode(octets);
  const lignes = c.trim().split('\r\n');
  assert.equal(lignes[0], 'date;heure;module;template');
  assert.equal(lignes.length, 4);
  assert.equal(lignes[1], '01/11/2026;09:00:00;flotte;"Gestion de flotte de véhicules"', 'heure de Paris (UTC+1 en novembre)');
});

test('synthèse vide', () => { assert.deepEqual(synthese([], new Date('2026-11-20T00:00:00Z')).modules, []); assert.equal(csv([]), '﻿date;heure;module;template\r\n'); });

test('e-mail facultatif : validé, stocké en minuscules, compté, exporté et effaçable', async () => {
  const st = memoire();
  const opt = { secret: SECRET, stockage: st, maintenant: () => new Date('2026-11-20T12:00:00Z') };
  const adm = { 'x-admin': codeAdmin(SECRET) };
  await traiterInterets(req('POST', { module: 'flotte' }), opt);
  assert.equal((await traiterInterets(req('POST', { module: 'flotte', email: ' Marie@Exemple.fr ' }), opt)).status, 200);
  assert.equal((await traiterInterets(req('POST', { module: 'flotte', email: 'pas-une-adresse' }), opt)).status, 400);
  assert.equal((await traiterInterets(req('POST', { module: 'flotte', email: 'a;b@c.fr' }), opt)).status, 400, 'point-virgule refusé (CSV)');
  assert.equal((await traiterInterets(req('POST', { module: 'inconnu', email: 'a@b.fr' }), opt)).status, 400);
  const s = await (await traiterInterets(req('GET', undefined, adm), opt)).json();
  assert.equal(s.emails, 1); assert.equal(s.modules[0].emails, 1); assert.equal(s.total, 1, 'l’e-mail ne compte pas comme un clic de plus');
  assert.equal((await traiterInterets(req('GET', undefined, {}, '?format=emails'), opt)).status, 401);
  const c = new TextDecoder().decode(await (await traiterInterets(req('GET', undefined, adm, '?format=emails'), opt)).arrayBuffer());
  assert.equal(c.trim().split('\r\n')[1], '20/11/2026;13:00:00;flotte;"Gestion de flotte de véhicules";marie@exemple.fr');
  assert.equal((await traiterInterets(req('DELETE', undefined, {}, '?email=marie@exemple.fr'), opt)).status, 401);
  const d = await (await traiterInterets(req('DELETE', undefined, adm, '?email=MARIE@exemple.fr'), opt)).json();
  assert.equal(d.effaces, 1);
  assert.equal((await (await traiterInterets(req('GET', undefined, adm), opt)).json()).emails, 0);
});
