// Défi 7 jours entre potes (netlify/lib/defi.mjs) : cycle complet, règles, sécurité, purge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { traiterDefi, purgerDefis, jourParis, ajouterJours, serieEnCours, texte, MAX_JOUEURS } from '../../netlify/lib/defi.mjs';
import { ALPHABET } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'secret-de-test-0123456789-0123456789-abcdef';
const crypto = {
  hmac: (t) => createHmac('sha256', SECRET).update(t).digest('base64url'),
  aleatoire: (n) => [...randomBytes(n)].map((o) => ALPHABET[o & 31]).join(''),
  egal: (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); },
};
const memoire = () => { const s = new Map(); return { get: async (c) => (s.has(c) ? structuredClone(s.get(c)) : null), set: async (c, v) => { s.set(c, structuredClone(v)); }, supprimer: async (c) => { s.delete(c); }, lister: async (p) => [...s.keys()].filter((c) => c.startsWith(p)), s }; };

// Horloge réglable : midi à Paris (11:00 UTC en hiver) du jour voulu.
function monde() {
  const stockage = memoire();
  let jour = '2026-11-23';
  const env = { stockage, crypto, maintenant: () => new Date(`${jour}T11:00:00Z`) };
  const appel = async (corps, methode = 'POST', q = '') => {
    const r = await traiterDefi(new Request(`https://x.test/api/defi${q}`, { method: methode, body: methode === 'POST' ? JSON.stringify(corps) : undefined }), env);
    return { statut: r.status, ...(await r.json()) };
  };
  return { stockage, appel, env, aller: (j) => { jour = j; } };
}

test('jour de Paris et dates : minuit à Paris, pas en UTC', () => {
  assert.equal(jourParis(new Date('2026-11-23T23:30:00Z')), '2026-11-24'); // 00:30 à Paris
  assert.equal(jourParis(new Date('2026-07-01T21:59:00Z')), '2026-07-01'); // 23:59 à Paris (heure d'été)
  assert.equal(ajouterJours('2026-12-30', 3), '2027-01-02');
  assert.equal(serieEnCours(['2026-11-24', '2026-11-25', '2026-11-26'], '2026-11-27'), 3, 'la journée en cours n\'interrompt pas la série');
  assert.equal(serieEnCours(['2026-11-24', '2026-11-26'], '2026-11-26'), 1);
  assert.equal(texte('  <b>Léa</b>\n ', 20), 'bLéa/b');
});

test('cycle complet : création, invitation, cases cochées, classement et perdant qui paie', async () => {
  const w = monde();
  const c = await w.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport 20 min', pari: 'le café' });
  assert.equal(c.statut, 200);
  assert.equal(c.defi.debut, '2026-11-24', 'le défi commence le lendemain');
  assert.equal(c.defi.etat, 'a-venir');
  assert.equal(c.defi.pari, 'le café');
  const id = c.defi.id;
  const r = await w.appel({ action: 'rejoindre', id, pseudo: 'Hugo', habitude: 'Lire 10 pages' });
  assert.equal(r.statut, 200);
  assert.equal(r.defi.joueurs.length, 2);
  assert.ok(!JSON.stringify(r.defi).includes(c.jeton.split('.')[2]), 'aucun jeton dans la vue publique');

  // Léa coche 6 jours sur 7, Hugo 4.
  for (let i = 0; i < 7; i++) {
    const jour = ajouterJours('2026-11-24', i);
    w.aller(jour);
    if (i !== 3) assert.equal((await w.appel({ action: 'cocher', jeton: c.jeton, jour })).statut, 200);
    if (i < 4) await w.appel({ action: 'cocher', jeton: r.jeton, jour });
  }
  let v = (await w.appel(null, 'GET', `?id=${id}`)).defi;
  assert.equal(v.etat, 'en-cours');
  assert.deepEqual(v.gagnants, [], 'pas de gagnant avant la fin');
  w.aller('2026-12-01');
  v = (await w.appel(null, 'GET', `?id=${id}`)).defi;
  assert.equal(v.etat, 'termine');
  assert.deepEqual(v.joueurs.map((j) => [j.pseudo, j.total]), [['Léa', 6], ['Hugo', 4]]);
  assert.equal(v.gagnants.length, 1);
  assert.equal(v.joueurs.find((j) => j.pid === v.gagnants[0]).pseudo, 'Léa');
  assert.equal(v.joueurs.find((j) => j.pid === v.perdants[0]).pseudo, 'Hugo');
});

test('cocher : le jour même ou la veille seulement, pendant les 7 jours ; décocher possible', async () => {
  const w = monde();
  const c = await w.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport' });
  assert.equal((await w.appel({ action: 'cocher', jeton: c.jeton, jour: '2026-11-23' })).statut, 400, 'avant le début');
  w.aller('2026-11-26');
  assert.equal((await w.appel({ action: 'cocher', jeton: c.jeton, jour: '2026-11-25' })).statut, 200, 'rattrapage de la veille');
  assert.equal((await w.appel({ action: 'cocher', jeton: c.jeton, jour: '2026-11-24' })).statut, 400, 'avant-veille refusée');
  assert.equal((await w.appel({ action: 'cocher', jeton: c.jeton, jour: '2026-11-27' })).statut, 400, 'demain refusé');
  const d = await w.appel({ action: 'cocher', jeton: c.jeton, jour: '2026-11-25', fait: false });
  assert.equal(d.defi.joueurs[0].total, 0);
});

test('rejoindre : jusqu\'au premier jour inclus, 6 participants au plus', async () => {
  const w = monde();
  const c = await w.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport' });
  for (let i = 1; i < MAX_JOUEURS; i++) assert.equal((await w.appel({ action: 'rejoindre', id: c.defi.id, pseudo: `P${i}`, habitude: 'Lire' })).statut, 200);
  assert.equal((await w.appel({ action: 'rejoindre', id: c.defi.id, pseudo: 'Trop', habitude: 'Lire' })).statut, 409);
  const w2 = monde();
  const c2 = await w2.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport' });
  w2.aller('2026-11-24');
  assert.equal((await w2.appel({ action: 'rejoindre', id: c2.defi.id, pseudo: 'Hugo', habitude: 'Lire' })).statut, 200, 'le jour 1 : encore possible');
  w2.aller('2026-11-25');
  assert.equal((await w2.appel({ action: 'rejoindre', id: c2.defi.id, pseudo: 'Zoé', habitude: 'Lire' })).statut, 409, 'trop tard');
});

test('sécurité : saisies validées, jeton falsifié refusé, défi inconnu', async () => {
  const w = monde();
  assert.equal((await w.appel({ action: 'creer', pseudo: '', habitude: 'Sport' })).statut, 400);
  assert.equal((await w.appel({ action: 'creer', pseudo: 'Léa', habitude: ' ' })).statut, 400);
  const c = await w.appel({ action: 'creer', pseudo: '<script>x</script>', habitude: 'Sport' });
  assert.equal(c.defi.joueurs[0].pseudo, 'scriptx/script');
  const [id, pid] = c.jeton.split('.');
  w.aller('2026-11-24');
  assert.equal((await w.appel({ action: 'cocher', jeton: `${id}.${pid}.${'A'.repeat(24)}`, jour: '2026-11-24' })).statut, 403);
  assert.equal((await w.appel(null, 'GET', '?id=AAAAAAAAAA')).statut, 404);
  assert.equal((await w.appel(null, 'GET', '?id=../../x')).statut, 400);
  const long = await traiterDefi(new Request('https://x.test/api/defi', { method: 'POST', body: 'x'.repeat(700) }), w.env);
  assert.equal(long.status, 413);
});

test('quitter efface ses données ; purge 30 jours après la fin', async () => {
  const w = monde();
  const c = await w.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport' });
  const r = await w.appel({ action: 'rejoindre', id: c.defi.id, pseudo: 'Hugo', habitude: 'Lire' });
  assert.equal((await w.appel({ action: 'quitter', jeton: r.jeton })).statut, 200);
  assert.equal((await w.appel(null, 'GET', `?id=${c.defi.id}`)).defi.joueurs.length, 1);
  // Fin le 30/11 : conservé jusqu'au 30/12, effacé ensuite.
  assert.equal(await purgerDefis({ stockage: w.stockage, maintenant: () => new Date('2026-12-30T11:00:00Z') }), 0);
  assert.equal(await purgerDefis({ stockage: w.stockage, maintenant: () => new Date('2026-12-31T11:00:00Z') }), 1);
  assert.equal(w.stockage.s.size, 0);
  // Le dernier qui quitte efface aussi le défi.
  const w2 = monde();
  const c2 = await w2.appel({ action: 'creer', pseudo: 'Léa', habitude: 'Sport' });
  await w2.appel({ action: 'quitter', jeton: c2.jeton });
  assert.equal(w2.stockage.s.size, 0);
});
