// Recherche d'œuvres du Suivi culturel (template PGS) : proxy vers Open Library (livres), TMDB (films, séries) et
// l'API de recherche iTunes (livres audio, podcasts), avec un cache partagé qui grandit avec l'usage.
// Sans dépendance à Netlify : stockage et fetch injectés (Netlify Blobs en production, mémoire en test).
//
// Routes (GET sauf mention) :
//   /api/oeuvres/sources                      → { tmdb } : films et séries disponibles (clé présente) ou non
//   /api/oeuvres/recherche?q=…&media=…        → { resultats: [fiche], indisponible? }
//   /api/oeuvres/detail?media=…&s=…&id=…      → { fiche } (durée d'un film, saisons d'une série)
//   POST /api/oeuvres/ajout { media, s, id }  → { ok } : l'œuvre ajoutée par un utilisateur entre dans l'index
// Accès : jeton du template (en-tête X-Code, code PGS ou code d'essai PGS) ; sans jeton (démo), 60 appels par jour
// et par adresse IP.
// Confidentialité : seuls les mots cherchés partent vers les sources ; la bibliothèque des utilisateurs n'est jamais
// envoyée ni stockée ici. Le cache ne contient que des fiches lues par le serveur lui-même chez la source (une fiche
// envoyée par un navigateur n'y entre jamais).
// Variables Netlify : TMDB_JETON (jeton d'accès en lecture v4, recommandé) ou TMDB_API_KEY (clé v3). Sans l'une ni
// l'autre, la recherche de films et de séries répond { indisponible: true } ; tout le reste fonctionne.
import { createHash } from 'node:crypto';
import { verifierCode, verifierCodeEssai } from './templates-acces.mjs';

export const MEDIAS = ['livre', 'livreaudio', 'film', 'serie', 'podcast'];
export const DUREE_CACHE = 7 * 86400000; // réponses d'une recherche : 7 jours
export const MAX_INDEX = 5000; // fiches gardées par média dans l'index partagé
export const LIMITE_DEMO = 60; // appels par jour et par IP sans jeton
const UA = 'QME-SuiviCulturel/1.0 (+https://qm-engineering.fr)';
const DELAI = 5000;

const json = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hache = (t) => createHash('sha256').update(t).digest('hex').slice(0, 32);
const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const entier = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const annee = (d) => { const a = Number(String(d ?? '').slice(0, 4)); return a >= 1000 && a <= 2999 ? a : 0; };
const idOk = (v) => /^[\w/.-]{1,60}$/.test(String(v ?? ''));

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
const cleVu = (media, s, id) => `vu/${media}/${s}/${hache(String(id))}`;

// ---------- Sources ----------
async function lireJson(fetchImpl, url, entetes = {}) {
  const r = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json', ...entetes }, signal: AbortSignal.timeout(DELAI) });
  if (!r.ok) throw new Error(`source ${r.status}`);
  return r.json();
}
function tmdb(fetchImpl, { jeton, cle }, chemin, params = {}) {
  const u = new URL(`https://api.themoviedb.org/3${chemin}`);
  for (const [k, v] of Object.entries({ language: 'fr-FR', ...params })) u.searchParams.set(k, v);
  if (!jeton) u.searchParams.set('api_key', cle);
  return lireJson(fetchImpl, u, jeton ? { authorization: `Bearer ${jeton}` } : {});
}
function itunes(fetchImpl, q, media) {
  const u = new URL('https://itunes.apple.com/search');
  for (const [k, v] of Object.entries({ term: q, media, entity: media, country: 'FR', lang: 'fr_fr', limit: '10' })) u.searchParams.set(k, v);
  return lireJson(fetchImpl, u);
}

export async function chercherSource(media, q, { fetchImpl, tmdbAcces }) {
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
  if (media === 'film') {
    const d = await tmdb(fetchImpl, tmdbAcces, '/search/movie', { query: q, include_adult: 'false' });
    return (d.results || []).slice(0, 10).map((x) => fiche(media, 'tmdb', x.id, { titre: x.title, annee: annee(x.release_date) })).filter(Boolean);
  }
  if (media === 'serie') {
    const d = await tmdb(fetchImpl, tmdbAcces, '/search/tv', { query: q, include_adult: 'false' });
    return (d.results || []).slice(0, 10).map((x) => fiche(media, 'tmdb', x.id, { titre: x.name, annee: annee(x.first_air_date) })).filter(Boolean);
  }
  return [];
}
// Détail : durée et réalisation d'un film, saisons et création d'une série. Les autres médias n'en ont pas besoin.
export async function detailSource(media, s, id, { fetchImpl, tmdbAcces }) {
  if (s !== 'tmdb' || !/^\d{1,10}$/.test(id)) return null;
  if (media === 'film') {
    const d = await tmdb(fetchImpl, tmdbAcces, `/movie/${id}`, { append_to_response: 'credits' });
    const rea = (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name).slice(0, 2).join(', ');
    return fiche(media, 'tmdb', d.id, { titre: d.title, auteur: rea, annee: annee(d.release_date), total: entier(d.runtime, 100000) });
  }
  if (media === 'serie') {
    const d = await tmdb(fetchImpl, tmdbAcces, `/tv/${id}`);
    const saisons = (d.seasons || []).filter((x) => x.season_number > 0 && x.episode_count > 0).map((x) => ({ n: x.season_number, episodes: Math.min(5000, x.episode_count) })).slice(0, 200);
    return fiche(media, 'tmdb', d.id, { titre: d.name, auteur: (d.created_by || []).map((c) => c.name).slice(0, 2).join(', '), annee: annee(d.first_air_date), saisons });
  }
  return null;
}

// ---------- Index partagé (la base grandit avec l'usage) ----------
async function indexer(stockage, f) {
  if (!f) return;
  const cle = `index/${f.media}`;
  const liste = (await stockage.get(cle)) || [];
  const k = cleFiche(f);
  const reste = liste.filter((x) => cleFiche(x) !== k);
  await stockage.set(cle, [f, ...reste].slice(0, MAX_INDEX));
}
async function chercherIndex(stockage, media, q) {
  const liste = (await stockage.get(`index/${media}`)) || [];
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

export async function traiterOeuvres(requete, { secret, revoques = [], stockage, fetchImpl = fetch, tmdbJeton = '', tmdbCle = '', maintenant = Date.now }) {
  const url = new URL(requete.url);
  const route = url.pathname.replace(/^\/api\/oeuvres\/?/, '').replace(/\/$/, '');
  const tmdbAcces = { jeton: tmdbJeton, cle: tmdbCle };
  const tmdbOk = !!(tmdbJeton || tmdbCle);
  if (route === 'sources' && requete.method === 'GET') return json(200, { tmdb: tmdbOk });

  const acces = autoriser(requete, secret, revoques);
  if (acces === false) return json(401, { erreur: 'Code d\'accès non valide pour ce template.' });
  if (acces === null && !(await quotaDemo(requete, stockage, maintenant))) return json(429, { erreur: 'Limite de recherches de la démo atteinte pour aujourd\'hui : saisis la fiche à la main.' });

  const media = url.searchParams.get('media') || '';
  const dep = { fetchImpl, tmdbAcces };
  try {
    if (route === 'recherche' && requete.method === 'GET') {
      if (!MEDIAS.includes(media)) return json(400, { erreur: 'Média inconnu.' });
      const q = txt(url.searchParams.get('q'), 80);
      if (q.length < 2) return json(400, { erreur: 'Tape au moins 2 caractères.' });
      const locaux = await chercherIndex(stockage, media, q);
      if ((media === 'film' || media === 'serie') && !tmdbOk) return json(200, { resultats: locaux, indisponible: true });
      const cleQ = `q/${media}/${hache(mots(q).join(' '))}`;
      const c = await stockage.get(cleQ);
      let distants;
      if (c && maintenant() - c.t < DUREE_CACHE) distants = c.r;
      else {
        try {
          distants = await chercherSource(media, q, dep);
          await stockage.set(cleQ, { t: maintenant(), r: distants });
          // Chaque fiche lue chez la source est mémorisée : c'est elle (jamais une fiche envoyée par un navigateur)
          // qui entrera dans l'index si un utilisateur ajoute l'œuvre.
          await Promise.all(distants.map((f) => stockage.set(cleVu(f.media, f.source.s, f.source.id), f)));
        } catch {
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
      if (!MEDIAS.includes(m) || !['ol', 'tmdb', 'itunes'].includes(src) || !idOk(id)) return json(400, { erreur: 'Œuvre inconnue.' });
      // Fiche lue par le serveur : détail TMDB (durée, saisons), sinon la fiche vue lors d'une recherche.
      let f = await stockage.get(cleVu(m, src, id));
      if (src === 'tmdb' && !f?.detail) {
        if (!tmdbOk) return json(200, { fiche: null, indisponible: true });
        const d = await detailSource(m, src, id, dep);
        if (d) { f = { ...d, detail: true }; await stockage.set(cleVu(m, src, id), f); }
      }
      const propre = f ? (({ detail, ...x }) => x)(f) : null;
      if (route === 'ajout') { if (propre) await indexer(stockage, propre); return json(200, { ok: !!propre }); }
      return json(200, { fiche: propre });
    }
  } catch {
    return json(502, { erreur: 'Source indisponible : saisis la fiche à la main.' });
  }
  return json(404, { erreur: 'Route inconnue.' });
}
