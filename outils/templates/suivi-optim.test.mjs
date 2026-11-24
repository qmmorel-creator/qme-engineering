// Suivi pour Nexora Optim › QME (24/11/2026) : remerciements d'achat, bilans de la tournée quotidienne et formulaires
// (idée, concours) exposés par GET /api/essai/essais au jeton de lecture ; formulaire de contact jamais repris.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enregistrerTournee, traiterEssai } from '../../netlify/lib/essais.mjs';
import { enregistrerFormulaire, ficheFormulaire } from '../../netlify/lib/formulaires.mjs';

const SECRET = 's'.repeat(40), JETON = 'L'.repeat(40);
const memoire = () => { const m = new Map(); return { m, get: async (k) => structuredClone(m.get(k) ?? null), set: async (k, v) => { m.set(k, structuredClone(v)); }, supprimer: async (k) => { m.delete(k); }, lister: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };
const lire = async (store) => (await traiterEssai(new Request('http://t/api/essai/essais', { headers: { 'x-lecture': JETON } }), { secret: SECRET, essais: store, lecture: JETON })).json();

test('formulaires : idée et concours gardés, contact ignoré, champs techniques retirés', async () => {
  assert.equal(ficheFormulaire({ form_name: 'contact', data: { message: 'x' } }), null);
  const f = ficheFormulaire({ form_name: 'idee', id: 'abc', created_at: '2026-11-24T10:00:00Z', data: { idee: 'Un planning de garde', ip: '1.2.3.4', user_agent: 'x', site_web: '', capture: { url: 'https://f/x.png' } } });
  assert.deepEqual(f, { cle: 'formulaire/2026-11-24-abc', fiche: { id: 'abc', formulaire: 'idee', date: '2026-11-24T10:00:00Z', champs: { idee: 'Un planning de garde', capture: 'https://f/x.png' } } });
  const store = memoire();
  assert.equal(await enregistrerFormulaire(store, { form_name: 'concours', id: 'c1', created_at: '2026-11-24T11:00:00Z', data: { prenom: 'A' } }, () => Date.parse('2026-11-24T12:00:00Z')), true);
  assert.equal(await enregistrerFormulaire(store, { form_name: 'contact', id: 'c2', data: {} }), false);
  assert.equal((await lire(store)).formulaires.length, 1);
});

test('tournées : bilan du jour gardé 90 jours, le plus récent en tête', async () => {
  const store = memoire();
  await store.set('tournee/2026-08-01', { jour: '2026-08-01' });
  await enregistrerTournee(store, '2026-11-23', { essais: { envoyes: { merci: 1 }, erreurs: 0 } });
  await enregistrerTournee(store, '2026-11-24', { essais: { envoyes: { rappel: 2 }, erreurs: 1 } });
  const t = (await lire(store)).tournees;
  assert.deepEqual(t.map((x) => x.jour), ['2026-11-24', '2026-11-23']);
  assert.equal(t[0].essais.erreurs, 1);
});

test('achats : produit, date, e-mail de remerciement, après essai ; jamais d\'adresse', async () => {
  const store = memoire();
  await store.set('achat/aaa', { produit: 'BDG', date: '2026-11-20T10:00:00Z', mail: 'achat-essai', essai: ['e1'] });
  await store.set('achat/bbb', { produit: 'BDG', date: '2026-11-22T10:00:00Z', mail: null, essai: [] });
  const a = (await lire(store)).achats;
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((x) => [x.date.slice(0, 10), x.mail, x.apresEssai]), [['2026-11-22', null, false], ['2026-11-20', 'achat-essai', true]]);
  assert.ok(!JSON.stringify(a).includes('@'));
});
