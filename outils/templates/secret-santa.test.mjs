// Tests du Secret Santa : règles du tirage (templates/secret-santa/regles.js) et API complète
// (templates/secret-santa/moteur.js avec les dépendances serveur de netlify/lib/secret-santa.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tirer, tirageValide, nettoyerExclusions, dateEffacement, emailValide } from '../../templates/secret-santa/regles.js';
import { traiterSecretSanta } from '../../templates/secret-santa/moteur.js';
import { dependancesServeur } from '../../netlify/lib/secret-santa.mjs';
import { genererCode } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'secret-de-test-secret-santa-0123456789abcdef';
const graine = (n) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };

// ---------- Règles ----------
test('tirage : personne ne se tire soi-même, chacun reçoit une fois', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  for (let s = 1; s < 300; s++) {
    const r = tirer(ids, [], graine(s));
    assert.ok(r.ok);
    assert.ok(tirageValide(ids, [], r.attributions));
  }
});

test('tirage : les exclusions sont respectées dans les deux sens', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const excl = [['A', 'B'], ['C', 'D'], ['E', 'F']];
  for (let s = 1; s < 300; s++) {
    const r = tirer(ids, excl, graine(s));
    assert.ok(r.ok);
    for (const [a, b] of excl) { assert.notEqual(r.attributions[a], b); assert.notEqual(r.attributions[b], a); }
    assert.ok(tirageValide(ids, excl, r.attributions));
  }
});

test('tirage : toutes les attributions possibles finissent par sortir (pas de biais bloquant)', () => {
  const ids = ['A', 'B', 'C', 'D'];
  const vus = new Set();
  for (let s = 1; s < 2000; s++) vus.add(JSON.stringify(tirer(ids, [], graine(s)).attributions, Object.keys({ A: 1, B: 1, C: 1, D: 1 })));
  assert.equal(vus.size, 9); // nombre de dérangements de 4 éléments
});

test('tirage : impossible ou trop peu de participants', () => {
  assert.equal(tirer(['A', 'B'], []).raison, 'trop-peu');
  assert.equal(tirer(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]).raison, 'impossible');
  // 3 personnes dont un couple : A et B ne peuvent offrir qu'à C, impossible.
  assert.equal(tirer(['A', 'B', 'C'], [['A', 'B']]).ok, false);
});

test('exclusions : nettoyage (doublons, inconnus, soi-même)', () => {
  assert.deepEqual(nettoyerExclusions([['B', 'A'], ['A', 'B'], ['A', 'A'], ['A', 'Z']], ['A', 'B', 'C']), [['A', 'B']]);
});

test('effacement : 60 jours après la date, 180 jours après la création sans date', () => {
  assert.equal(dateEffacement({ date: '2026-12-24', creeLe: '2026-11-13T10:00:00Z' }), '2027-02-22');
  assert.equal(dateEffacement({ date: null, creeLe: '2026-11-13T10:00:00Z' }), '2027-05-12');
  assert.ok(emailValide(' Lea@Exemple.fr '));
  assert.ok(!emailValide('lea@exemple'));
});

// ---------- API ----------
function banc(depart = '2026-11-20T10:00:00Z') {
  const memoire = new Map();
  let instant = new Date(depart);
  const stockage = {
    get: async (c) => (memoire.has(c) ? structuredClone(memoire.get(c)) : null),
    set: async (c, v) => { memoire.set(c, structuredClone(v)); },
    supprimer: async (c) => { memoire.delete(c); },
    lister: async (p) => [...memoire.keys()].filter((c) => c.startsWith(p)),
  };
  const deps = { stockage, ...dependancesServeur(SECRET), maintenant: () => instant };
  const appel = async (methode, chemin, corps, entetes = {}) => {
    const r = await traiterSecretSanta(new Request(`https://qm-engineering.fr/api/secret-santa${chemin}`, {
      method: methode, headers: { 'content-type': 'application/json', ...entetes }, body: corps ? JSON.stringify(corps) : undefined,
    }), deps);
    return { statut: r.status, corps: await r.json() };
  };
  return { appel, memoire, avancer: (jours) => { instant = new Date(instant.getTime() + jours * 86400000); } };
}

async function echangeAvec(b, noms, admin) {
  const { corps } = await b.appel('POST', '/echanges', { nom: 'Noël en famille', date: '2026-12-24', budget: '25 €', message: 'Rendez-vous chez Mamie.' }, { 'x-code': admin });
  const e = corps.echange;
  const jetons = {};
  for (const n of noms) {
    const r = await b.appel('POST', '/inscription', { e: e.id, k: e.invitation, nom: n, email: `${n.toLowerCase()}@exemple.fr`, code: `code-${n}`, souhaits: `Idées de ${n}` });
    assert.equal(r.statut, 201, JSON.stringify(r.corps));
    jetons[n] = r.corps.jeton;
  }
  return { e, jetons };
}

test('API : seul un code SNT ouvre l\'espace organisateur', async () => {
  const b = banc();
  assert.equal((await b.appel('GET', '/echanges', null, { 'x-code': genererCode(SECRET, 'REV') })).statut, 401);
  assert.equal((await b.appel('GET', '/echanges', null, { 'x-code': 'SNT-AAAA-AAAA-AAAA-AAAA' })).statut, 401);
  assert.equal((await b.appel('GET', '/echanges', null, { 'x-code': genererCode(SECRET, 'SNT') })).statut, 200);
});

test('API : parcours complet, l\'organisateur ne voit jamais le tirage', async () => {
  const b = banc();
  const admin = genererCode(SECRET, 'SNT');
  const { e, jetons } = await echangeAvec(b, ['Lea', 'Hugo', 'Ines', 'Malo'], admin);

  // Invitation publique : pas de liste d'inscrits.
  const inv = await b.appel('GET', `/invitation?e=${e.id}&k=${e.invitation}`);
  assert.equal(inv.corps.invitation.nbInscrits, 4);
  assert.equal(JSON.stringify(inv.corps).includes('Hugo'), false);
  assert.equal((await b.appel('GET', `/invitation?e=${e.id}&k=FAUX`)).statut, 404);

  // Doublons refusés.
  assert.equal((await b.appel('POST', '/inscription', { e: e.id, k: e.invitation, nom: 'Léa bis', email: 'LEA@exemple.fr', code: 'abcdef' })).statut, 409);

  // Exclusion Léa ↔ Hugo, puis tirage.
  const ids = Object.fromEntries((await b.appel('GET', `/echanges/${e.id}`, null, { 'x-code': admin })).corps.echange.participants.map((p) => [p.nom, p.id]));
  assert.equal((await b.appel('PUT', `/echanges/${e.id}`, { exclusions: [[ids.Lea, ids.Hugo]] }, { 'x-code': admin })).statut, 200);
  const t = await b.appel('POST', `/echanges/${e.id}/tirage`, {}, { 'x-code': admin });
  assert.equal(t.statut, 200);
  const brut = JSON.stringify(t.corps) + JSON.stringify((await b.appel('GET', `/echanges/${e.id}`, null, { 'x-code': admin })).corps)
    + JSON.stringify((await b.appel('GET', '/echanges', null, { 'x-code': admin })).corps);
  assert.equal(brut.includes('attributions'), false);
  assert.equal(brut.includes('Idées de'), false);
  assert.equal(t.corps.echange.ouvert, false);

  // Chaque participant voit son destinataire et ses souhaits ; le tout forme un tirage valide.
  const attrib = {};
  for (const [n, j] of Object.entries(jetons)) {
    const r = await b.appel('GET', '/participant', null, { 'x-participant': j });
    assert.equal(r.statut, 200);
    assert.match(r.corps.destinataire.souhaits, /^Idées de /);
    attrib[ids[n]] = ids[r.corps.destinataire.nom];
  }
  assert.ok(tirageValide(Object.values(ids), [[ids.Lea, ids.Hugo]], attrib));
  const vue = (await b.appel('GET', `/echanges/${e.id}`, null, { 'x-code': admin })).corps.echange;
  assert.equal(vue.participants.filter((p) => p.aVu).length, 4);

  // Inscriptions closes, exclusions figées après le tirage.
  assert.equal((await b.appel('POST', '/inscription', { e: e.id, k: e.invitation, nom: 'Zoe', email: 'zoe@exemple.fr', code: 'abcdef' })).statut, 409);
  assert.equal((await b.appel('PUT', `/echanges/${e.id}`, { exclusions: [] }, { 'x-code': admin })).statut, 409);
  assert.equal((await b.appel('POST', `/echanges/${e.id}/tirage`, {}, { 'x-code': admin })).statut, 409);
  assert.equal((await b.appel('POST', `/echanges/${e.id}/tirage`, { refaire: true }, { 'x-code': admin })).statut, 200);
});

test('API : un autre organisateur ne voit pas l\'échange', async () => {
  const b = banc();
  const { e } = await echangeAvec(b, ['Lea', 'Hugo', 'Ines'], genererCode(SECRET, 'SNT'));
  const autre = genererCode(SECRET, 'SNT');
  assert.equal((await b.appel('GET', `/echanges/${e.id}`, null, { 'x-code': autre })).statut, 404);
  assert.deepEqual((await b.appel('GET', '/echanges', null, { 'x-code': autre })).corps.echanges, []);
});

test('API : reconnexion par e-mail et code, blocage après 5 erreurs', async () => {
  const b = banc();
  const { e, jetons } = await echangeAvec(b, ['Lea', 'Hugo', 'Ines'], genererCode(SECRET, 'SNT'));
  const ok = await b.appel('POST', '/participant/connexion', { e: e.id, email: ' LEA@exemple.fr', code: 'code-Lea' });
  assert.equal(ok.corps.jeton, jetons.Lea);
  for (let i = 0; i < 5; i++) assert.equal((await b.appel('POST', '/participant/connexion', { e: e.id, email: 'hugo@exemple.fr', code: 'mauvais' })).statut, 401);
  assert.equal((await b.appel('POST', '/participant/connexion', { e: e.id, email: 'hugo@exemple.fr', code: 'code-Hugo' })).statut, 429);
  b.avancer(1 / 48); // 30 minutes
  assert.equal((await b.appel('POST', '/participant/connexion', { e: e.id, email: 'hugo@exemple.fr', code: 'code-Hugo' })).statut, 200);
  // Le code personnel n'est jamais stocké en clair.
  assert.equal([...b.memoire.values()].some((v) => JSON.stringify(v).includes('code-Lea')), false);
  // Jeton falsifié refusé.
  assert.equal((await b.appel('GET', '/participant', null, { 'x-participant': `${jetons.Lea.slice(0, -2)}XX` })).statut, 401);
});

test('API : retirer un participant après le tirage l\'annule', async () => {
  const b = banc();
  const admin = genererCode(SECRET, 'SNT');
  const { e, jetons } = await echangeAvec(b, ['Lea', 'Hugo', 'Ines', 'Malo'], admin);
  await b.appel('POST', `/echanges/${e.id}/tirage`, {}, { 'x-code': admin });
  const malo = (await b.appel('GET', `/echanges/${e.id}`, null, { 'x-code': admin })).corps.echange.participants.find((p) => p.nom === 'Malo');
  const r = await b.appel('DELETE', `/echanges/${e.id}/participants/${malo.id}`, null, { 'x-code': admin });
  assert.equal(r.corps.tirageAnnule, true);
  assert.equal(r.corps.echange.tirage, null);
  assert.equal((await b.appel('GET', '/participant', null, { 'x-participant': jetons.Malo })).statut, 401);
  assert.equal((await b.appel('GET', '/participant', null, { 'x-participant': jetons.Lea })).corps.destinataire, null);
});

test('API : effacement automatique 60 jours après la date', async () => {
  const b = banc();
  const admin = genererCode(SECRET, 'SNT');
  const { e, jetons } = await echangeAvec(b, ['Lea', 'Hugo', 'Ines'], admin);
  b.avancer(34 + 60 + 1); // du 20/11 au-delà du 22/02
  assert.equal((await b.appel('GET', '/participant', null, { 'x-participant': jetons.Lea })).statut, 401);
  assert.deepEqual((await b.appel('GET', '/echanges', null, { 'x-code': admin })).corps.echanges, []);
  assert.equal([...b.memoire.keys()].some((c) => c.includes(e.id)), false);
});
