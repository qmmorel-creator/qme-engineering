// Tests du proxy de recherche d'œuvres du Suivi culturel (netlify/lib/oeuvres.mjs) : sources simulées, aucun appel réel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiterOeuvres, LIMITE_DEMO, scoreRecherche, requeteRepli, VERSION_CACHE } from '../../netlify/lib/oeuvres.mjs';
import { genererCode } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'secret-de-test-oeuvres-0123456789abcdef';
const CODE = genererCode(SECRET, 'PGS');
const AUTRE = genererCode(SECRET, 'REV');
const JETON_TMDB = 'jeton-tmdb-tres-secret';

function memoire() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null), set: async (k, v) => { m.set(k, structuredClone(v)); } };
}
// Sources simulées : répond selon l'hôte et le chemin, garde la trace des appels.
function sources() {
  const appels = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    appels.push({ url: u, entetes: init.headers || {} });
    const rep = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (u.hostname === 'openlibrary.org') return rep({ docs: [{ key: '/works/OL1W', title: 'Les Misérables', author_name: ['Victor Hugo'], first_publish_year: 1862, number_of_pages_median: 1463 }, { key: 'javascript:x', title: 'Piège' }] });
    if (u.hostname === 'itunes.apple.com') return rep({ results: [{ collectionId: 42, collectionName: 'Les Petites Questions', artistName: 'Studio', releaseDate: '2023-04-01T00:00:00Z' }] });
    if (u.pathname === '/3/search/movie') return rep({ results: [{ id: 603, title: 'Le Grand Départ', release_date: '2024-05-02' }] });
    if (u.pathname === '/3/search/tv') return rep({ results: [{ id: 77, name: 'Les Phares', first_air_date: '2022-01-10' }] });
    if (u.pathname === '/3/movie/603') return rep({ id: 603, title: 'Le Grand Départ', release_date: '2024-05-02', runtime: 112, credits: { crew: [{ job: 'Director', name: 'Réa Lisatrice' }, { job: 'Writer', name: 'X' }] } });
    if (u.pathname === '/3/tv/77') return rep({ id: 77, name: 'Les Phares', first_air_date: '2022-01-10', created_by: [{ name: 'Clara M.' }], seasons: [{ season_number: 0, episode_count: 3 }, { season_number: 1, episode_count: 8 }, { season_number: 2, episode_count: 10 }] });
    return new Response('{}', { status: 404 });
  };
  return { f, appels };
}
const req = (chemin, { code = CODE, methode = 'GET', corps, ip = '1.2.3.4' } = {}) => new Request(`https://qm-engineering.fr/api/oeuvres/${chemin}`, {
  method: methode, headers: { ...(code ? { 'x-code': code } : {}), 'x-nf-client-connection-ip': ip, 'content-type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined,
});
const appeler = async (r, opts) => { const x = await traiterOeuvres(r, { secret: SECRET, ...opts }); return { statut: x.status, corps: await x.json() }; };

test('sources : films et séries signalés indisponibles sans clé TMDB', async () => {
  const st = memoire();
  assert.deepEqual((await appeler(req('sources'), { stockage: st })).corps, { tmdb: false });
  assert.deepEqual((await appeler(req('sources'), { stockage: st, tmdbJeton: JETON_TMDB })).corps, { tmdb: true });
  const { f, appels } = sources();
  const r = await appeler(req('recherche?media=film&q=depart'), { stockage: st, fetchImpl: f });
  assert.deepEqual(r.corps, { resultats: [], indisponible: true });
  assert.equal(appels.length, 0, 'aucun appel sans clé');
});

test('livres : Open Library, fiche propre, cache de 7 jours insensible aux accents et à la casse', async () => {
  const st = memoire();
  const { f, appels } = sources();
  const r = await appeler(req('recherche?media=livre&q=Misérables'), { stockage: st, fetchImpl: f });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps.resultats, [{ media: 'livre', titre: 'Les Misérables', auteur: 'Victor Hugo', source: { s: 'ol', id: 'OL1W' }, annee: 1862, total: 1463 }], 'identifiant suspect écarté');
  assert.match(appels[0].entetes['user-agent'], /QME/);
  await appeler(req('recherche?media=livre&q=MISERABLES'), { stockage: st, fetchImpl: f });
  assert.equal(appels.length, 1, 'deuxième recherche servie par le cache');
  const plusTard = Date.now() + 8 * 86400000;
  await appeler(req('recherche?media=livre&q=miserables'), { stockage: st, fetchImpl: f, maintenant: () => plusTard });
  assert.equal(appels.length, 2, 'cache expiré au-delà de 7 jours');
});

test('films et séries : jeton TMDB côté serveur seulement, détail (durée, réalisation, saisons)', async () => {
  const st = memoire();
  const { f, appels } = sources();
  const opts = { stockage: st, fetchImpl: f, tmdbJeton: JETON_TMDB };
  const r = await appeler(req('recherche?media=film&q=grand depart'), opts);
  assert.equal(r.corps.resultats[0].titre, 'Le Grand Départ');
  assert.equal(appels[0].entetes.authorization, `Bearer ${JETON_TMDB}`);
  assert.ok(!String(appels[0].url).includes(JETON_TMDB), 'jeton absent de l\'URL');
  assert.equal(appels[0].url.searchParams.get('language'), 'fr-FR');
  const d = await appeler(req('detail?media=film&s=tmdb&id=603'), opts);
  assert.deepEqual(d.corps.fiche, { media: 'film', titre: 'Le Grand Départ', auteur: 'Réa Lisatrice', source: { s: 'tmdb', id: '603' }, annee: 2024, total: 112 });
  const s = await appeler(req('detail?media=serie&s=tmdb&id=77'), opts);
  assert.deepEqual(s.corps.fiche.saisons, [{ n: 1, episodes: 8 }, { n: 2, episodes: 10 }], 'saison 0 (bonus) écartée');
  assert.equal(s.corps.fiche.total, 18);
  // Aucune réponse ne contient le jeton.
  for (const x of [r, d, s]) assert.ok(!JSON.stringify(x.corps).includes(JETON_TMDB));
  // Clé v3 : passée en paramètre côté serveur, faute de jeton v4.
  const v3 = sources();
  await appeler(req('recherche?media=serie&q=phares'), { stockage: memoire(), fetchImpl: v3.f, tmdbCle: 'cle-v3' });
  assert.equal(v3.appels[0].url.searchParams.get('api_key'), 'cle-v3');
});

test('index partagé : une œuvre ajoutée revient en tête, même avec des fautes ; pas d\'empoisonnement', async () => {
  const st = memoire();
  const { f } = sources();
  const opts = { stockage: st, fetchImpl: f };
  await appeler(req('recherche?media=podcast&q=petites questions'), opts);
  // Ajout d'une fiche vue chez la source : indexée.
  assert.deepEqual((await appeler(req('ajout', { methode: 'POST', corps: { media: 'podcast', s: 'itunes', id: 42 } }), opts)).corps, { ok: true });
  // Fiche jamais lue par le serveur : refusée (un navigateur ne peut pas écrire dans le cache partagé).
  assert.deepEqual((await appeler(req('ajout', { methode: 'POST', corps: { media: 'podcast', s: 'itunes', id: 999, titre: 'Pub' } }), opts)).corps, { ok: false });
  assert.equal((await st.get(`index${VERSION_CACHE}/podcast`)).length, 1);
  assert.equal((await st.get(`index${VERSION_CACHE}/podcast`))[0].annee, undefined, 'pas d\'année pour un podcast (date du dernier épisode chez iTunes)');
  // Source en panne : l'index répond seul, avec la fiche tolérante aux fautes.
  const panne = async () => { throw new Error('hors ligne'); };
  const r = await appeler(req('recherche?media=podcast&q=petittes questons'), { stockage: st, fetchImpl: panne });
  assert.equal(r.corps.indisponible, true);
  assert.equal(r.corps.resultats[0].titre, 'Les Petites Questions');
});

test('accès : code PGS ou démo limitée ; code d\'un autre template refusé ; paramètres contrôlés', async () => {
  const st = memoire();
  const { f } = sources();
  const opts = { stockage: st, fetchImpl: f };
  assert.equal((await appeler(req('recherche?media=livre&q=hugo', { code: AUTRE }), opts)).statut, 401);
  assert.equal((await appeler(req('recherche?media=livre&q=hugo', { code: 'PGS-0000-0000-0000-0000' }), opts)).statut, 401);
  assert.equal((await appeler(req('recherche?media=vinyle&q=hugo'), opts)).statut, 400);
  assert.equal((await appeler(req('recherche?media=livre&q=h'), opts)).statut, 400);
  for (let i = 0; i < LIMITE_DEMO; i++) assert.equal((await appeler(req('recherche?media=livre&q=hugo', { code: '' }), opts)).statut, 200);
  assert.equal((await appeler(req('recherche?media=livre&q=hugo', { code: '' }), opts)).statut, 429);
  assert.equal((await appeler(req('recherche?media=livre&q=hugo', { code: '', ip: '5.6.7.8' }), opts)).statut, 200, 'autre adresse');
  assert.equal((await appeler(req('recherche?media=livre&q=hugo'), opts)).statut, 200, 'acheteur jamais limité');
  // Aucune adresse IP stockée en clair.
  assert.ok(![...st.m.keys()].some((k) => k.includes('1.2.3.4')));
});

test('recherche tolérante côté serveur identique à celle de l\'application', () => {
  assert.ok(scoreRecherche('misreables', 'Les Misérables') > 0);
  assert.equal(scoreRecherche('balzac', 'Les Misérables'), 0);
});

test('panne d\'une source : message générique sans le jeton, les autres sources répondent', async () => {
  const st = memoire();
  const { f } = sources();
  // TMDB en panne avec un message d'erreur qui contiendrait le jeton : rien ne fuit dans la réponse.
  const panneTmdb = async (url, init) => { if (String(url).includes('themoviedb')) throw new Error(`échec ${JETON_TMDB}`); return f(url, init); };
  const opts = { stockage: st, fetchImpl: panneTmdb, tmdbJeton: JETON_TMDB };
  const r = await appeler(req('recherche?media=film&q=grand depart'), opts);
  assert.equal(r.statut, 200);
  assert.equal(r.corps.indisponible, true);
  assert.ok(!JSON.stringify(r.corps).includes(JETON_TMDB));
  const d = await appeler(req('detail?media=film&s=tmdb&id=603'), opts);
  assert.equal(d.statut, 502);
  assert.ok(!JSON.stringify(d.corps).includes(JETON_TMDB));
  // Open Library et iTunes répondent normalement pendant la panne de TMDB.
  assert.equal((await appeler(req('recherche?media=livre&q=miserables'), opts)).corps.resultats.length, 1);
  assert.equal((await appeler(req('recherche?media=podcast&q=questions'), opts)).corps.resultats.length, 1);
});

test('faute de frappe : repli par début de mot quand la source ne trouve rien, résultats filtrés par ressemblance', async () => {
  assert.equal(requeteRepli('les miserabls', true), 'les misera*');
  assert.equal(requeteRepli('harry poter', false), 'harr pote');
  assert.equal(requeteRepli('le roi', true), '', 'rien à tronquer');
  const appels = [];
  // Source qui ne tolère pas les fautes : « miserabls » ne donne rien, « misera* » donne trois titres.
  const f = async (url) => {
    const u = new URL(url); const q = u.searchParams.get('q');
    appels.push(q);
    const docs = q === 'les misera*' ? [{ key: '/works/OL2W', title: 'Misery', author_name: ['S. King'] }, { key: '/works/OL1W', title: 'Les Misérables', author_name: ['Victor Hugo'] }, { key: '/works/OL3W', title: 'Les Miserables abrégé', author_name: [] }] : [];
    return new Response(JSON.stringify({ docs }), { status: 200 });
  };
  const r = await appeler(req('recherche?media=livre&q=les%20miserabls'), { stockage: memoire(), fetchImpl: f });
  assert.deepEqual(appels, ['les miserabls', 'les misera*']);
  assert.deepEqual(r.corps.resultats.map((x) => x.titre), ['Les Misérables', 'Les Miserables abrégé'], '« Misery » écarté : trop éloigné de la saisie');
});

test('cache : une réponse vide n\'est pas gardée, les clés portent la version du format', async () => {
  const st = memoire();
  let n = 0;
  const vide = async () => { n++; return new Response(JSON.stringify({ docs: [] }), { status: 200 }); };
  await appeler(req('recherche?media=livre&q=introuvable'), { stockage: st, fetchImpl: vide });
  await appeler(req('recherche?media=livre&q=introuvable'), { stockage: st, fetchImpl: vide });
  assert.equal(n, 4, 'deux recherches, chacune avec son repli : rien servi depuis le cache');
  const { f } = sources();
  await appeler(req('recherche?media=livre&q=miserables'), { stockage: st, fetchImpl: f });
  assert.ok([...st.m.keys()].some((k) => k.startsWith(`q${VERSION_CACHE}/livre/`)));
});
