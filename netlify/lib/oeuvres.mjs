// Recherche d'œuvres du Suivi culturel (template PGS) : proxy vers Open Library (livres), Wikidata (films, séries ;
// CC0, usage commercial permis, sans clé) et l'API de recherche iTunes (livres audio, podcasts ; noms et années
// seulement), avec un cache partagé qui grandit avec l'usage. Films et séries par Wikidata depuis le 28/11/2026
// (décision de Quentin : source libre, utilisable dans un produit vendu).
// Sans dépendance à Netlify : stockage et fetch injectés (Netlify Blobs en production, mémoire en test).
//
// Routes (GET sauf mention) :
//   /api/oeuvres/sources                      → { sources } : bases interrogées et licences
//   /api/oeuvres/recherche?q=…&media=…        → { resultats: [fiche], indisponible? }
//   /api/oeuvres/detail?media=…&s=…&id=…      → { fiche } (épisodes par saison d'une série Wikidata)
//   POST /api/oeuvres/ajout { media, s, id }  → { ok } : l'œuvre ajoutée par un utilisateur entre dans l'index
// Accès : jeton du template (en-tête X-Code, code PGS ou code d'essai PGS) ; sans jeton (démo), 60 appels par jour
// et par adresse IP.
// Confidentialité : seuls les mots cherchés partent vers les sources ; la bibliothèque des utilisateurs n'est jamais
// envoyée ni stockée ici. Le cache ne contient que des fiches lues par le serveur lui-même chez la source (une fiche
// envoyée par un navigateur n'y entre jamais).
// Aucune clé, aucune variable Netlify. Wikidata : User-Agent identifiable (politique Wikimedia : nom, version, page de
// contact, « bot »), requête SPARQL unique par recherche, délai court, réponses gardées 30 jours ; un refus (429)
// répond { indisponible: true } et suspend les appels à Wikidata pendant la durée indiquée par Retry-After.
import { createHash } from 'node:crypto';
import { verifierCode, verifierCodeEssai } from './templates-acces.mjs';

export const MEDIAS = ['livre', 'livreaudio', 'film', 'serie', 'podcast'];
export const DUREE_CACHE = 7 * 86400000; // réponses d'une recherche : 7 jours (Open Library, iTunes)
export const DUREE_CACHE_WIKIDATA = 30 * 86400000; // Wikidata : 30 jours (ménager la limite de débit)
const dureeCache = (media) => (media === 'film' || media === 'serie' ? DUREE_CACHE_WIKIDATA : DUREE_CACHE);
// Pause après un 429 de Wikidata : Retry-After en secondes (60 s si absent, 1 h au plus), commune à toutes les instances.
export const CLE_PAUSE = 'pause/wikidata';
export const pauseRetry = (valeur) => { const n = Number(valeur); return Math.min(3600, Math.max(5, Number.isFinite(n) && n > 0 ? n : 60)) * 1000; };
// Version du format du cache (recherches, fiches vues, index) : à incrémenter quand la lecture des sources change ;
// les anciennes entrées sont alors ignorées. Le store est commun aux aperçus et à la production.
export const VERSION_CACHE = 3; // 3 : films et séries par Wikidata (28/11/2026)
export const MAX_INDEX = 5000; // fiches gardées par média dans l'index partagé
export const LIMITE_DEMO = 60; // appels par jour et par IP sans jeton
// User-Agent de toutes les sources, conforme à la politique User-Agent de Wikimedia (nom/version, contact, « bot ») :
// contact choisi par Quentin le 28/11/2026 (site et adresse professionnelle).
export const UA = 'QME-SuiviCulturel/1.0 (https://qm-engineering.fr; quentin.morel@qm-engineering.fr)';
const DELAI = 5000;

const json = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hache = (t) => createHash('sha256').update(t).digest('hex').slice(0, 32);
const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const entier = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const annee = (d) => { const a = Number(String(d ?? '').slice(0, 4)); return a >= 1000 && a <= 2999 ? a : 0; };
const idOk = (v) => /^[\w/.-]{1,60}$/.test(String(v ?? ''));
export const SOURCES = ['ol', 'wd', 'itunes'];

// ---------- Recherche tolérante (même règle que templates/lecture/regles.js) ----------
export function distance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let avant = null, prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (avant && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cour[j] = Math.min(cour[j], avant[j - 2] + 1);
      min = Math.min(min, cour[j]);
    }
    if (min > max) return max + 1;
    avant = prec; prec = cour;
  }
  return prec[b.length];
}
const mots = (t) => plat(t).split(/[^a-z0-9]+/).filter(Boolean);
export function scoreRecherche(q, texte) {
  const cherches = mots(q);
  if (!cherches.length) return 1;
  const t = plat(texte), tm = mots(texte);
  let score = 0;
  for (const m of cherches) {
    if (tm.some((w) => w.startsWith(m))) { score += 3; continue; }
    if (t.includes(m)) { score += 2; continue; }
    const tol = m.length >= 8 ? 2 : m.length >= 4 ? 1 : 0;
    if (tol && tm.some((w) => distance(m, w, tol) <= tol || (w.length > m.length && distance(m, w.slice(0, m.length), tol) <= tol))) score += 1;
    else return 0;
  }
  return score;
}

// Fiche renvoyée à l'application : champs d'une œuvre du template, rien d'autre.
function fiche(media, s, id, { titre, auteur, annee: a, total, saisons }) {
  const f = { media, titre: txt(titre, 140), auteur: txt(auteur, 100), source: { s, id: String(id) } };
  if (a) f.annee = a;
  if (total) f.total = total;
  if (saisons?.length) { f.saisons = saisons; f.total = saisons.reduce((x, y) => x + y.episodes, 0); }
  return f.titre && idOk(id) ? f : null;
}
const cleFiche = (f) => `${f.media}:${f.source.s}:${f.source.id}`;
const cleVu = (media, s, id) => `vu${VERSION_CACHE}/${media}/${s}/${hache(String(id))}`;

// ---------- Sources ----------
async function lireJson(fetchImpl, url, entetes = {}) {
  const r = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json', ...entetes }, signal: AbortSignal.timeout(DELAI) });
  if (!r.ok) throw new Error(`source ${r.status}`);
  return r.json();
}
// ---------- Wikidata (films, séries) ----------
// Une seule requête SPARQL par recherche : recherche plein texte de Wikidata (service « Search », par mots, accents
// ignorés, l'article initial n'est pas requis), filtre par classe (sous-classes comprises), puis titre français (anglais
// à défaut), année la plus ancienne (sortie P577 ou début P580), réalisation P57 (film) ou création P170 (série), durée
// P2047 normalisée en secondes (film), nombre de saisons P2437 et d'épisodes P1113 (série).
export const WIKIDATA = 'https://query.wikidata.org/sparql';
export const CLASSES = { film: 'Q11424', serie: 'Q5398426' };
const SAISON = 'Q3464665'; // saison de série télévisée
// Mots cherchés, sans guillemets ni syntaxe de recherche (« haswbstatement: », etc.) : lettres, chiffres, apostrophes,
// tirets, espaces et joker final « * » seulement.
export const termeWikidata = (q) => String(q).replace(/[^\p{L}\p{N}'’* -]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
export function requeteWikidata(media, q) {
  const classe = CLASSES[media];
  const createur = media === 'film' ? 'wdt:P57' : 'wdt:P170';
  // hint:optimizer "None" : la recherche (20 items au plus) passe avant le filtre de classe ; sans lui, la requête
  // prenait plus de 10 s.
  return `SELECT ?o (SAMPLE(?tf) AS ?titreFr) (SAMPLE(?te) AS ?titreEn) (MIN(?a) AS ?annee) (GROUP_CONCAT(DISTINCT ?nc; separator=", ") AS ?createurs) (MAX(?sec) AS ?secondes) (MAX(?s) AS ?saisons) (MAX(?e) AS ?episodes) (MIN(?rang) AS ?ordre) WHERE {
  hint:Query hint:optimizer "None" .
  SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "Search"; wikibase:endpoint "www.wikidata.org"; mwapi:srsearch "${termeWikidata(q)}"; mwapi:srlimit "20". ?titre wikibase:apiOutput mwapi:title. ?rang wikibase:apiOrdinal true. }
  BIND(IRI(CONCAT(STR(wd:), ?titre)) AS ?o)
  ?o wdt:P31/wdt:P279* wd:${classe} .
  OPTIONAL { ?o rdfs:label ?tf FILTER(LANG(?tf) = "fr") }
  OPTIONAL { ?o rdfs:label ?te FILTER(LANG(?te) = "en") }
  OPTIONAL { ?o wdt:P577|wdt:P580 ?d BIND(YEAR(?d) AS ?a) }
  OPTIONAL { ?o ${createur} ?c . ?c rdfs:label ?nc FILTER(LANG(?nc) = "fr") }
  OPTIONAL { ?o p:P2047/psn:P2047/wikibase:quantityAmount ?sec }
  OPTIONAL { ?o wdt:P2437 ?s }
  OPTIONAL { ?o wdt:P1113 ?e }
} GROUP BY ?o ORDER BY ?ordre LIMIT 10`;
}
// Saisons d'une série : épisodes de chaque saison (items « saison » rattachés par P179, rang P1545).
export function requeteSaisons(id) {
  return `SELECT ?n (MAX(?e) AS ?episodes) WHERE {
  hint:Query hint:optimizer "None" .
  ?st ps:P179 wd:${id} . ?saison p:P179 ?st . OPTIONAL { ?st pq:P1545 ?n }
  ?saison wdt:P31/wdt:P279* wd:${SAISON} .
  OPTIONAL { ?saison wdt:P1113 ?e }
} GROUP BY ?n`;
}
async function sparql(fetchImpl, requete) {
  const r = await fetchImpl(WIKIDATA, {
    method: 'POST',
    headers: { 'user-agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: requete }).toString(),
    signal: AbortSignal.timeout(DELAI),
  });
  if (r.status === 429) { const e = new Error('source 429'); e.pause = pauseRetry(r.headers.get('retry-after')); throw e; }
  if (!r.ok) throw new Error(`source ${r.status}`);
  return ((await r.json()).results?.bindings || []).map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
const qid = (uri) => (String(uri).match(/(Q\d{1,12})$/) || [])[1] || '';
function ficheWikidata(media, x) {
  const id = qid(x.o);
  const titre = x.titreFr || x.titreEn;
  if (!id || !titre) return null;
  const f = fiche(media, 'wd', id, { titre, auteur: x.createurs, annee: annee(x.annee) });
  if (!f) return null;
  if (media === 'film') { const min = Math.round(Number(x.secondes) / 60); if (min > 0 && min < 2000) f.total = min; }
  else { const e = entier(x.episodes, 100000); if (e) f.total = e; const n = entier(x.saisons, 500); if (n) f.nbSaisons = n; }
  return f;
}

function itunes(fetchImpl, q, media) {
  const u = new URL('https://itunes.apple.com/search');
  for (const [k, v] of Object.entries({ term: q, media, entity: media, country: 'FR', lang: 'fr_fr', limit: '10' })) u.searchParams.set(k, v);
  return lireJson(fetchImpl, u);
}

// Requête de repli quand la source ne trouve rien (faute de frappe : les sources ne tolèrent pas les fautes). Chaque mot
// de 5 lettres ou plus est tronqué aux 60 % de sa longueur (4 lettres au moins), suivi d'un joker pour Open Library
// (Solr) et Wikidata (CirrusSearch) ; iTunes, sans joker, cherche déjà par début de mot. Ex. : « les miserabls » →
// « les misera* ».
export function requeteRepli(q, joker) {
  const m = mots(q);
  const r = m.map((w) => (w.length >= 5 ? `${w.slice(0, Math.max(4, Math.ceil(w.length * 0.6)))}${joker ? '*' : ''}` : w)).join(' ');
  return r !== m.join(' ') ? r : '';
}
// Recherche chez la source ; sans résultat, repli tolérant aux fautes, puis tri par ressemblance avec la saisie d'origine.
export async function chercherTolerant(media, q, dep) {
  const directs = await chercherSource(media, q, dep);
  if (directs.length) return directs;
  const repli = requeteRepli(q, media === 'livre' || media === 'film' || media === 'serie');
  if (!repli) return [];
  const larges = await chercherSource(media, repli, dep);
  return larges.map((f) => ({ f, sc: scoreRecherche(q, `${f.titre} ${f.auteur}`) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).map((x) => x.f);
}
export async function chercherSource(media, q, { fetchImpl }) {
  if (media === 'livre') {
    const u = new URL('https://openlibrary.org/search.json');
    for (const [k, v] of Object.entries({ q, fields: 'key,title,author_name,first_publish_year,number_of_pages_median', limit: '10' })) u.searchParams.set(k, v);
    const d = await lireJson(fetchImpl, u);
    return (d.docs || []).map((x) => fiche(media, 'ol', String(x.key || '').replace('/works/', ''), { titre: x.title, auteur: (x.author_name || []).slice(0, 2).join(', '), annee: annee(x.first_publish_year), total: entier(x.number_of_pages_median, 100000) })).filter(Boolean);
  }
  if (media === 'livreaudio' || media === 'podcast') {
    const d = await itunes(fetchImpl, q, media === 'podcast' ? 'podcast' : 'audiobook');
    // Podcast : releaseDate est la date du dernier épisode, pas l'année de création ; elle n'est donc pas reprise.
    return (d.results || []).map((x) => fiche(media, 'itunes', x.collectionId, { titre: x.collectionName, auteur: x.artistName, annee: media === 'podcast' ? 0 : annee(x.releaseDate) })).filter(Boolean);
  }
  if (media === 'film' || media === 'serie') {
    return (await sparql(fetchImpl, requeteWikidata(media, q))).map((x) => ficheWikidata(media, x)).filter(Boolean);
  }
  return [];
}
// Détail d'une série Wikidata : épisodes par saison, seulement si chaque saison est numérotée et a son nombre
// d'épisodes (et, si Wikidata donne le nombre de saisons, s'il y en a autant) ; sinon null, et le total suffit.
export async function saisonsWikidata(id, nbSaisons, { fetchImpl }) {
  if (!/^Q\d{1,12}$/.test(id)) return null;
  const lignes = await sparql(fetchImpl, requeteSaisons(id));
  const saisons = lignes.map((x) => ({ n: entier(x.n, 999), episodes: entier(x.episodes, 5000) }));
  if (!saisons.length || saisons.some((x) => !x.n || !x.episodes)) return null;
  if (nbSaisons && saisons.length !== nbSaisons) return null;
  if (new Set(saisons.map((x) => x.n)).size !== saisons.length) return null;
  return saisons.sort((a, b) => a.n - b.n).slice(0, 200);
}

// ---------- Index partagé (la base grandit avec l'usage) ----------
async function indexer(stockage, f) {
  if (!f) return;
  const cle = `index${VERSION_CACHE}/${f.media}`;
  const liste = (await stockage.get(cle)) || [];
  const k = cleFiche(f);
  const reste = liste.filter((x) => cleFiche(x) !== k);
  await stockage.set(cle, [f, ...reste].slice(0, MAX_INDEX));
}
async function chercherIndex(stockage, media, q) {
  const liste = (await stockage.get(`index${VERSION_CACHE}/${media}`)) || [];
  return liste.map((f) => ({ f, sc: scoreRecherche(q, `${f.titre} ${f.auteur} ${f.annee || ''}`) })).filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc).slice(0, 5).map((x) => x.f);
}

// ---------- Accès ----------
function autoriser(requete, secret, revoques) {
  const code = requete.headers.get('x-code') || '';
  if (!code) return null;
  const v = verifierCode(secret, code, revoques) || verifierCodeEssai(secret, code, revoques);
  return v && v.produit === 'PGS' ? v : false;
}
async function quotaDemo(requete, stockage, maintenant) {
  const ip = (requete.headers.get('x-nf-client-connection-ip') || requete.headers.get('x-forwarded-for') || 'inconnue').split(',')[0].trim();
  const cle = `limite/${new Date(maintenant()).toISOString().slice(0, 10)}/${hache(`oeuvres:${ip}`)}`;
  const n = ((await stockage.get(cle)) || 0) + 1;
  if (n > LIMITE_DEMO) return false;
  await stockage.set(cle, n);
  return true;
}

export const SOURCES_INFO = [
  { media: ['livre'], nom: 'Open Library', licence: 'données ouvertes (Internet Archive)' },
  { media: ['film', 'serie'], nom: 'Wikidata', licence: 'CC0' },
  { media: ['livreaudio', 'podcast'], nom: 'Recherche iTunes (Apple)', licence: 'noms et années seulement' },
];
export async function traiterOeuvres(requete, { secret, revoques = [], stockage, fetchImpl = fetch, maintenant = Date.now }) {
  const url = new URL(requete.url);
  const route = url.pathname.replace(/^\/api\/oeuvres\/?/, '').replace(/\/$/, '');
  if (route === 'sources' && requete.method === 'GET') return json(200, { sources: SOURCES_INFO });

  const acces = autoriser(requete, secret, revoques);
  if (acces === false) return json(401, { erreur: 'Code d\'accès non valide pour ce template.' });
  if (acces === null && !(await quotaDemo(requete, stockage, maintenant))) return json(429, { erreur: 'Limite de recherches de la démo atteinte pour aujourd\'hui : saisis la fiche à la main.' });

  const media = url.searchParams.get('media') || '';
  const dep = { fetchImpl };
  try {
    if (route === 'recherche' && requete.method === 'GET') {
      if (!MEDIAS.includes(media)) return json(400, { erreur: 'Média inconnu.' });
      const q = txt(url.searchParams.get('q'), 80);
      if (q.length < 2) return json(400, { erreur: 'Tape au moins 2 caractères.' });
      const locaux = await chercherIndex(stockage, media, q);
      const wikidata = media === 'film' || media === 'serie';
      const cleQ = `q${VERSION_CACHE}/${media}/${hache(mots(q).join(' '))}`;
      const c = await stockage.get(cleQ);
      let distants;
      if (c && maintenant() - c.t < dureeCache(media)) distants = c.r;
      else if (wikidata && ((await stockage.get(CLE_PAUSE)) || 0) > maintenant()) return json(200, { resultats: locaux, indisponible: true });
      else {
        try {
          distants = await chercherTolerant(media, q, dep);
          // Une réponse vide n'est pas gardée : elle bloquerait 7 jours une œuvre que la source ajouterait entre-temps.
          if (distants.length) await stockage.set(cleQ, { t: maintenant(), r: distants });
          // Chaque fiche lue chez la source est mémorisée : c'est elle (jamais une fiche envoyée par un navigateur)
          // qui entrera dans l'index si un utilisateur ajoute l'œuvre.
          await Promise.all(distants.map((f) => stockage.set(cleVu(f.media, f.source.s, f.source.id), f)));
        } catch (x) {
          if (x?.pause) await stockage.set(CLE_PAUSE, maintenant() + x.pause);
          return json(200, { resultats: locaux, indisponible: true });
        }
      }
      const vus = new Set();
      const resultats = [...locaux, ...distants].filter((f) => { const k = cleFiche(f); if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 10);
      return json(200, { resultats });
    }
    if ((route === 'detail' && requete.method === 'GET') || (route === 'ajout' && requete.method === 'POST')) {
      let m = media, src = url.searchParams.get('s') || '', id = url.searchParams.get('id') || '';
      if (route === 'ajout') { const b = await requete.json().catch(() => ({})); m = b?.media; src = b?.s; id = String(b?.id ?? ''); }
      if (!MEDIAS.includes(m) || !SOURCES.includes(src) || !idOk(id)) return json(400, { erreur: 'Œuvre inconnue.' });
      // Fiche lue par le serveur lors d'une recherche ; pour une série Wikidata, complétée des épisodes par saison.
      let f = await stockage.get(cleVu(m, src, id));
      if (f && src === 'wd' && m === 'serie' && !f.detail && ((await stockage.get(CLE_PAUSE)) || 0) <= maintenant()) {
        // Échec (429, délai) : la fiche de recherche est rendue telle quelle et le détail sera retenté plus tard.
        let echec = false;
        const saisons = await saisonsWikidata(id, f.nbSaisons, dep).catch(async (x) => { echec = true; if (x?.pause) await stockage.set(CLE_PAUSE, maintenant() + x.pause); return null; });
        if (!echec) {
          f = { ...f, detail: true };
          if (saisons) { f.saisons = saisons; f.total = saisons.reduce((x, y) => x + y.episodes, 0); }
          await stockage.set(cleVu(m, src, id), f);
        }
      }
      const propre = f ? (({ detail, nbSaisons, ...x }) => x)(f) : null;
      if (route === 'ajout') { if (propre) await indexer(stockage, propre); return json(200, { ok: !!propre }); }
      return json(200, { fiche: propre });
    }
  } catch {
    return json(502, { erreur: 'Source indisponible : saisis la fiche à la main.' });
  }
  return json(404, { erreur: 'Route inconnue.' });
}
