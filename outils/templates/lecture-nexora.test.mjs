// Jeton de lecture seule pour Nexora Optim › QME (X-Lecture, QME_LECTURE_TOKEN) : lectures GET seulement,
// jamais une écriture, un effacement ni l'accès administrateur aux templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estLecteur, peutLireAdmin, traiterInterets } from '../../netlify/lib/interets.mjs';
import { traiterTableau } from '../../netlify/lib/tableau.mjs';
import { traiterEssai } from '../../netlify/lib/essais.mjs';
import { traiterCompte } from '../../netlify/lib/comptes.mjs';
import { codeAdmin } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 's'.repeat(40), JETON = 'L'.repeat(40);
const memoire = () => { const m = new Map(); return { m, get: async (k) => structuredClone(m.get(k) ?? null), set: async (k, v) => { m.set(k, structuredClone(v)); }, supprimer: async (k) => { m.delete(k); }, lister: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };
const req = (url, h = {}, method = 'GET') => new Request(`http://t${url}`, { method, headers: h });

test('jeton de lecture : 32 caractères au moins, comparaison exacte', () => {
  assert.equal(estLecteur(req('/', { 'x-lecture': JETON }), JETON), true);
  assert.equal(estLecteur(req('/', { 'x-lecture': JETON + 'x' }), JETON), false);
  assert.equal(estLecteur(req('/', { 'x-lecture': 'court' }), 'court'), false);
  assert.equal(estLecteur(req('/', {}), JETON), false);
  assert.equal(estLecteur(req('/', { 'x-lecture': '' }), ''), false);
});

test('lecture administrateur : jeton en GET seulement, code ADM pour tout', () => {
  assert.equal(peutLireAdmin(req('/', { 'x-lecture': JETON }), { secret: SECRET, lecture: JETON }), true);
  assert.equal(peutLireAdmin(req('/', { 'x-lecture': JETON }, 'DELETE'), { secret: SECRET, lecture: JETON }), false);
  assert.equal(peutLireAdmin(req('/', { 'x-admin': codeAdmin(SECRET) }, 'DELETE'), { secret: SECRET, lecture: JETON }), true);
});

test('tableau, registre et essais lisibles avec le jeton ; sans lui, refus', async () => {
  const store = memoire();
  const t = await traiterTableau(req('/api/tableau?jours=7', { 'x-lecture': JETON }), { secret: SECRET, lecture: JETON, store, recuperer: async () => { throw new Error('hors ligne'); }, maintenant: () => Date.parse('2026-11-24T12:00:00Z') });
  assert.equal(t.status, 200);
  assert.equal((await traiterTableau(req('/api/tableau', { 'x-lecture': 'x'.repeat(40) }), { secret: SECRET, lecture: JETON, store })).status, 401);
  const r = await traiterCompte(req('/api/compte/registre', { 'x-lecture': JETON }), { secret: SECRET, store, lecture: JETON });
  assert.equal(r.status, 200);
  const e = await traiterEssai(req('/api/essai/essais', { 'x-lecture': JETON }), { secret: SECRET, essais: store, lecture: JETON });
  assert.equal(e.status, 200);
  assert.equal((await traiterEssai(req('/api/essai/essais'), { secret: SECRET, essais: store, lecture: JETON })).status, 401);
});

test('le jeton ne permet ni effacement ni écriture administrateur', async () => {
  const stockage = { ajouter: async () => {}, lire: async () => null, supprimer: async () => { throw new Error('effacement interdit'); }, lister: async () => [] };
  assert.equal((await traiterInterets(req('/api/interets', { 'x-lecture': JETON }), { secret: SECRET, lecture: JETON, stockage })).status, 200);
  assert.equal((await traiterInterets(req('/api/interets?email=a@b.fr', { 'x-lecture': JETON }, 'DELETE'), { secret: SECRET, lecture: JETON, stockage })).status, 401);
  const store = memoire();
  const imp = await traiterCompte(new Request('http://t/api/compte/import', { method: 'POST', headers: { 'x-lecture': JETON, 'content-type': 'application/json' }, body: '{}' }), { secret: SECRET, store, lecture: JETON });
  assert.equal(imp.status, 401);
});
