// Tests du proxy de recherche d'œuvres du Suivi culturel (netlify/lib/oeuvres.mjs) : sources simulées, aucun appel réel.
// Films et séries : Wikidata (SPARQL), depuis le 28/11/2026 (TMDB retiré : usage commercial interdit sans accord).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiterOeuvres, LIMITE_DEMO, scoreRecherche, requeteRepli, VERSION_CACHE, termeWikidata, requeteWikidata, WIKIDATA } from '../../netlify/lib/oeuvres.mjs';
import { genererCode } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'secret-de-test-oeuvres-0123456789abcdef';
const CODE = genererCode(SECRET, 'PGS');
const AUTRE = genererCode(SECRET, 'REV');
const UA = 'QME-SuiviCulturel/1.0 (https://qm-engineering.fr)';

function memoire() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null), set: async (k, v) => { m.set(k, structuredClone(v)); } };
}
// Réponse SPARQL au format de query.wikidata.org.
const sparqlRep = (lignes) => new Response(JSON.stringify({ results: { bindings: lignes.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { type: 'literal', value: String(v) }]))) } }), { status: 200 });
const ENTITE = 'http://www.wikidata.org/entity/';
// Wikidata simulé à partir de données réelles (relevées le 28/11/2026) : la recherche plein texte ne tolère pas les
// fautes ; le repli « intouch* » retrouve le film.
const FILMS = [
  { o: `${ENTITE}Q595`, titreFr: 'Intouchables', titreEn: 'The Intouchables', annee: 2011, createurs: 'Éric Toledano, Olivier Nakache', secondes: 6720 },
  { o: `${ENTITE}Q1114345`, titreFr: 'Les Intouchables', annee: 1969, createurs: 'Giuliano Montaldo', secondes: 5460 },
];
const SERIE = { o: `${ENTITE}Q19593743`, titreFr: 'Le Bureau des légendes', titreEn: 'The Bureau', annee: 2015, createurs: 'Éric Rochant', secondes: 3120, saisons: 5, episodes: 50 };
function sources({ saisons = [{ n: 1, episodes: 10 }, { n: 2, episodes: 10 }, { n: 3 }, { n: 4 }, { n: 5 }] } = {}) {
  const appels = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const requete = u.hostname === 'query.wikidata.org' ? new URLSearchParams(init.body).get('query') : '';
    appels.push({ url: u, init, requete });
    const rep = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (u.hostname === 'openlibrary.org') return rep({ docs: [{ key: '/works/OL1W', title: 'Les Misérables', author_name: ['Victor Hugo'], first_publish_year: 1862, number_of_pages_median: 1463 }, { key: 'javascript:x', title: 'Piège' }] });
    if (u.hostname === 'itunes.apple.com') return rep({ results: [{ collectionId: 42, collectionName: 'Les Petites Questions', artistName: 'Studio', releaseDate: '2023-04-01T00:00:00Z' }] });
    if (u.hostname === 'query.wikidata.org') {
      if (requete.includes('ps:P179 wd:Q19593743')) return sparqlRep(saisons);
      const terme = (requete.match(/mwapi:srsearch "([^"]*)"/) || [])[1] || '';
      if (requete.includes('wd:Q11424')) return sparqlRep(/^intouchables$|^intouch\*$/.test(terme) ? FILMS : []);
      if (requete.includes('wd:Q5398426')) return sparqlRep(/bureau/.test(terme) ? [SERIE] : []);
    }
    return new Response('{}', { status: 404 });
  };
  return { f, appels };
}
const req = (chemin, { code = CODE, methode = 'GET', corps, ip = '1.2.3.4' } = {}) => new Request(`https://qm-engineering.fr/api/oeuvres/${chemin}`, {
  method: methode, headers: { ...(code ? { 'x-code': code } : {}), 'x-nf-client-connection-ip': ip, 'content-type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined,
});
const appeler = async (r, opts) => { const x = await traiterOeuvres(r, { secret: SECRET, ...opts }); return { statut: x.status, corps: await x.json() }; };

test('sources : Open Library, Wikidata (CC0) et iTunes ; plus aucune trace de TMDB', async () => {
  const r = await appeler(req('sources'), { stockage: memoire() });
  assert.deepEqual(r.corps.sources.map((s) => [s.nom, s.licence]), [['Open Library', 'données ouvertes (Internet Archive)'], ['Wikidata', 'CC0'], ['Recherche iTunes (Apple)', 'noms et années seulement']]);
  assert.ok(!/tmdb/i.test(JSON.stringify(r.corps)));
});

test('livres : Open Library, fiche propre, cache de 7 jours insensible aux accents et à la casse', async () => {
  const st = memoire();
  const { f, appels } = sources();
  const r = await appeler(req('recherche?media=livre&q=Misérables'), { stockage: st, fetchImpl: f });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps.resultats, [{ media: 'livre', titre: 'Les Misérables', auteur: 'Victor Hugo', source: { s: 'ol', id: 'OL1W' }, annee: 1862, total: 1463 }], 'identifiant suspect écarté');
  assert.match(appels[0].init.headers['user-agent'], /QME/);
  await appeler(req('recherche?media=livre&q=MISERABLES'), { stockage: st, fetchImpl: f });
  assert.equal(appels.length, 1, 'deuxième recherche servie par le cache');
  const plusTard = Date.now() + 8 * 86400000;
  await appeler(req('recherche?media=livre&q=miserables'), { stockage: st, fetchImpl: f, maintenant: () => plusTard });
  assert.equal(appels.length, 2, 'cache expiré au-delà de 7 jours');
});

test('films : « Intouchables » trouvé sur Wikidata (titre français, année, réalisation, durée en minutes)', async () => {
  const { f, appels } = sources();
  const r = await appeler(req('recherche?media=film&q=intouchables'), { stockage: memoire(), fetchImpl: f });
  assert.deepEqual(r.corps.resultats[0], { media: 'film', titre: 'Intouchables', auteur: 'Éric Toledano, Olivier Nakache', source: { s: 'wd', id: 'Q595' }, annee: 2011, total: 112 });
  // Une seule requête, POST sur le point SPARQL, User-Agent identifiable conforme à la politique Wikimedia.
  assert.equal(appels.length, 1);
  assert.equal(String(appels[0].url), WIKIDATA);
  assert.equal(appels[0].init.method, 'POST');
  assert.equal(appels[0].init.headers['user-agent'], UA);
  assert.match(appels[0].requete, /wdt:P31\/wdt:P279\* wd:Q11424/, 'sous-classes de film comprises');
  assert.match(appels[0].requete, /hint:optimizer "None"/, 'recherche avant filtre (sinon plus de 10 s)');
});

test('séries : « Le Bureau des légendes » trouvé (création, année, 5 saisons, 50 épisodes) ; saisons détaillées si complètes', async () => {
  const st = memoire();
  const { f } = sources();
  const r = await appeler(req('recherche?media=serie&q=bureau des legendes'), { stockage: st, fetchImpl: f });
  assert.deepEqual(r.corps.resultats[0], { media: 'serie', titre: 'Le Bureau des légendes', auteur: 'Éric Rochant', source: { s: 'wd', id: 'Q19593743' }, annee: 2015, total: 50, nbSaisons: 5 });
  // Détail : Wikidata ne donne les épisodes que des saisons 1 et 2 → pas de découpage inventé, le total suffit.
  const d = await appeler(req('detail?media=serie&s=wd&id=Q19593743'), { stockage: st, fetchImpl: f });
  assert.deepEqual(d.corps.fiche, { media: 'serie', titre: 'Le Bureau des légendes', auteur: 'Éric Rochant', source: { s: 'wd', id: 'Q19593743' }, annee: 2015, total: 50 });
  // Saisons toutes renseignées : découpage repris, total recalculé.
  const st2 = memoire();
  const complet = sources({ saisons: [{ n: 2, episodes: 10 }, { n: 1, episodes: 10 }, { n: 3, episodes: 10 }, { n: 4, episodes: 10 }, { n: 5, episodes: 10 }] });
  await appeler(req('recherche?media=serie&q=bureau'), { stockage: st2, fetchImpl: complet.f });
  const d2 = await appeler(req('detail?media=serie&s=wd&id=Q19593743'), { stockage: st2, fetchImpl: complet.f });
  assert.deepEqual(d2.corps.fiche.saisons.map((x) => x.n), [1, 2, 3, 4, 5]);
  assert.equal(d2.corps.fiche.total, 50);
  // Le détail est gardé en cache : pas de deuxième requête des saisons.
  const n = complet.appels.length;
  await appeler(req('detail?media=serie&s=wd&id=Q19593743'), { stockage: st2, fetchImpl: complet.f });
  assert.equal(complet.appels.length, n);
});

test('faute de frappe : « intouchabls » retrouve « Intouchables » par le repli « intouch* »', async () => {
  const { f, appels } = sources();
  const r = await appeler(req('recherche?media=film&q=intouchabls'), { stockage: memoire(), fetchImpl: f });
  assert.deepEqual(appels.map((a) => (a.requete.match(/mwapi:srsearch "([^"]*)"/) || [])[1]), ['intouchabls', 'intouch*']);
  assert.equal(r.corps.resultats[0].titre, 'Intouchables');
  assert.equal(requeteRepli('les miserabls', true), 'les misera*');
  assert.equal(requeteRepli('harry poter', false), 'harr pote');
  assert.equal(requeteRepli('le roi', true), '', 'rien à tronquer');
});

test('Wikidata : la saisie ne peut pas modifier la requête (guillemets, syntaxe de recherche)', () => {
  assert.equal(termeWikidata('le "bureau" } haswbstatement:P31=Q5 légendes*'), 'le bureau haswbstatement P31 Q5 légendes*');
  const q = requeteWikidata('serie', 'x" } . ?o ?p ?v . { "');
  assert.equal((q.match(/"/g) || []).length % 2, 0);
  assert.ok(!q.includes('?o ?p ?v'));
});

test('index partagé : une œuvre ajoutée revient en tête, même avec des fautes ; pas d\'empoisonnement', async () => {
  const st = memoire();
  const { f } = sources();
  const opts = { stockage: st, fetchImpl: f };
  await appeler(req('recherche?media=podcast&q=petites questions'), opts);
  assert.deepEqual((await appeler(req('ajout', { methode: 'POST', corps: { media: 'podcast', s: 'itunes', id: 42 } }), opts)).corps, { ok: true });
  // Fiche jamais lue par le serveur : refusée (un navigateur ne peut pas écrire dans le cache partagé).
  assert.deepEqual((await appeler(req('ajout', { methode: 'POST', corps: { media: 'podcast', s: 'itunes', id: 999, titre: 'Pub' } }), opts)).corps, { ok: false });
  assert.deepEqual((await appeler(req('ajout', { methode: 'POST', corps: { media: 'film', s: 'tmdb', id: 603 } }), opts)).statut, 400, 'source TMDB refusée');
  assert.equal((await st.get(`index${VERSION_CACHE}/podcast`)).length, 1);
  assert.equal((await st.get(`index${VERSION_CACHE}/podcast`))[0].annee, undefined, 'pas d\'année pour un podcast (date du dernier épisode chez iTunes)');
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
  assert.ok(![...st.m.keys()].some((k) => k.includes('1.2.3.4')));
});

test('Wikidata saturé (429) : message « indisponible », les autres sources répondent', async () => {
  const st = memoire();
  const { f } = sources();
  const sature = async (url, init) => (String(url).startsWith(WIKIDATA) ? new Response('Too many requests', { status: 429 }) : f(url, init));
  const opts = { stockage: st, fetchImpl: sature };
  const r = await appeler(req('recherche?media=film&q=intouchables'), opts);
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps, { resultats: [], indisponible: true });
  assert.equal((await appeler(req('recherche?media=livre&q=miserables'), opts)).corps.resultats.length, 1);
  assert.equal((await appeler(req('recherche?media=podcast&q=questions'), opts)).corps.resultats.length, 1);
  // Rien de vide ni d'erroné n'est gardé en cache : la recherche refonctionne dès que Wikidata répond.
  assert.equal((await appeler(req('recherche?media=film&q=intouchables'), { stockage: st, fetchImpl: f })).corps.resultats[0].titre, 'Intouchables');
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

test('recherche tolérante côté serveur identique à celle de l\'application', () => {
  assert.ok(scoreRecherche('misreables', 'Les Misérables') > 0);
  assert.equal(scoreRecherche('balzac', 'Les Misérables'), 0);
});
