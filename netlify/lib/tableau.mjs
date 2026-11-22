// Tableau de bord administrateur centralisé (/admin/, demande de Quentin du 22/11/2026) : audience du site
// (GoatCounter), réseaux (Sheet « Mesures réseaux QME »), essais gratuits, ventes Gumroad (Sheet), comptes,
// données saisies dans les applications (store templates-donnees),
// préférences d'information et intérêts, sur une période de 7, 30 ou 90 jours. Chaque source peut manquer ou
// échouer seule : sa section porte alors { configure: false } ou { erreur }, le reste s'affiche.
//
// Route : GET /api/tableau?jours=30 (en-tête X-Admin : code administrateur).
// Variables Netlify : GOATCOUNTER_TOKEN (jeton d'API GoatCounter « lecture des statistiques »), GOATCOUNTER_SITE
// (facultatif, https://qme-engineering.goatcounter.com par défaut), COMPTEUR_SHEET_PUB (déjà utilisée par le compteur).
import { estAdmin, synthese } from './interets.mjs';
import { PRODUITS, jourParis, estEssaiTest, cleDonnees, cleDonneesEssai, idAdminProduit } from './templates-acces.mjs';
import { ONGLETS, adressePublication, lireCsv } from './compteur.mjs';
import { lireRegistre } from './preferences.mjs';

const json = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const PERIODES = [7, 30, 90];
const MS_JOUR = 86_400_000;
export const decaler = (jour, n) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * MS_JOUR).toISOString().slice(0, 10);
export function joursDe(debut, fin) { const l = []; for (let j = debut; j <= fin; j = decaler(j, 1)) l.push(j); return l; }
const parJour = (jours, entrees) => { const m = Object.fromEntries(jours.map((j) => [j, 0])); for (const [j, n] of entrees) if (j in m) m[j] += n; return jours.map((j) => ({ jour: j, n: m[j] })); };
const somme = (l) => l.reduce((s, x) => s + x.n, 0);
// Tableau CSV (première ligne : en-têtes) → objets.
const objets = (t) => { const [e = [], ...l] = t || []; return l.filter((r) => r.some((c) => c !== '')).map((r) => Object.fromEntries(e.map((k, i) => [k, r[i] ?? '']))); };

// --- Audience : GoatCounter ------------------------------------------------------------------------
// Source de trafic lisible : vide = accès direct, google.* = Google, navigation interne exclue.
export function nomSource(nom, site = 'qm-engineering.fr') {
  const n = String(nom || '').trim();
  if (!n) return 'Accès direct';
  const h = n.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  if (h === site || h.endsWith(`.${site}`) || h.endsWith('.netlify.app')) return null;
  if (/^google(\.|$)/.test(h) || h === 'google') return 'Google';
  if (/(^|\.)bing\./.test(h) || h === 'bing') return 'Bing';
  if (/linkedin|lnkd\.in/.test(h)) return 'LinkedIn';
  if (/instagram/.test(h) || h === 'ig') return 'Instagram';
  if (/facebook|fb\.com|^m\.facebook/.test(h)) return 'Facebook';
  if (/(^|\.)(x|twitter)\.com$|^t\.co$/.test(h)) return 'X';
  if (/youtube|youtu\.be/.test(h)) return 'YouTube';
  if (/tiktok/.test(h)) return 'TikTok';
  if (/gumroad/.test(h)) return 'Gumroad';
  if (/chatgpt|openai|perplexity|claude\.ai/.test(h)) return 'Assistants IA';
  return h;
}

const regions = (() => { try { return new Intl.DisplayNames(['fr'], { type: 'region' }); } catch { return null; } })();
export const nomPays = (code, defaut) => { try { return (code && regions?.of(String(code).toUpperCase())) || defaut || code; } catch { return defaut || code; } };

async function audience({ goatcounter, recuperer, debut, fin, jours }) {
  if (!goatcounter?.token) return { configure: false };
  const base = `${String(goatcounter.site || 'https://qme-engineering.goatcounter.com').replace(/\/$/, '')}/api/v0`;
  const lire = async (chemin) => {
    const r = await recuperer(`${base}${chemin}${chemin.includes('?') ? '&' : '?'}start=${debut}&end=${fin}`, { headers: { authorization: `Bearer ${goatcounter.token}`, 'content-type': 'application/json' } });
    if (!r.ok) throw new Error(`GoatCounter ${r.status}`);
    return r.json();
  };
  const [total, pages, sources, pays] = await Promise.all([lire('/stats/total'), lire('/stats/hits?limit=12'), lire('/stats/toprefs?limit=30'), lire('/stats/locations?limit=8')]);
  const sourcesFusion = new Map();
  for (const s of sources.stats || []) { const n = nomSource(s.name); if (n) sourcesFusion.set(n, (sourcesFusion.get(n) || 0) + (s.count || 0)); }
  return {
    configure: true,
    vues: total.total ?? 0, evenements: total.total_events ?? 0,
    parJour: parJour(jours, (total.stats || []).map((s) => [s.day, s.daily || 0])),
    pages: (pages.hits || []).filter((h) => !h.event).slice(0, 10).map((h) => ({ chemin: h.path, titre: h.title || '', n: h.count || 0 })),
    sources: [...sourcesFusion].map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n).slice(0, 8),
    pays: (pays.stats || []).map((p) => ({ nom: nomPays(p.id, p.name), n: p.count || 0 })),
  };
}

// --- Sheet « Mesures réseaux QME » : réseaux et Gumroad ---------------------------------------------
async function sheet({ base, recuperer }) {
  if (!base) return { configure: false };
  const a = adressePublication(base);
  if (!a.ok) return { configure: false, erreur: a.erreur };
  const onglets = {};
  await Promise.all(['abonnes', 'historique', 'gumroad_ventes', 'gumroad_produits', 'gumroad_sources'].map(async (nom) => {
    try {
      const r = await recuperer(`${a.base}?gid=${ONGLETS[nom]}&single=true&output=csv`);
      const t = await r.text();
      if (!r.ok || /^\s*</.test(t)) throw new Error('onglet non publié');
      onglets[nom] = objets(lireCsv(t));
    } catch { onglets[nom] = null; }
  }));
  return { configure: true, onglets };
}

function reseaux(onglets, debut) {
  if (!onglets?.abonnes) return { configure: Boolean(onglets), abonnes: [] };
  // Abonnés : dernier relevé par réseau, et relevé le plus proche du début de période pour l'évolution.
  const par = {};
  for (const l of onglets.abonnes) {
    const r = l['Réseau'], n = Number(String(l['Abonnés']).replace(/\s/g, '')), d = String(l['Relevé le']).slice(0, 10);
    if (!r || !Number.isFinite(n)) continue;
    (par[r] ||= []).push({ d, n });
  }
  const abonnes = Object.entries(par).map(([reseau, l]) => {
    l.sort((x, y) => x.d.localeCompare(y.d));
    const dernier = l.at(-1), avant = [...l].reverse().find((x) => x.d <= debut) || l[0];
    return { reseau, n: dernier.n, releve: dernier.d, evolution: dernier.n - avant.n, depuis: avant.d };
  }).sort((a, b) => b.n - a.n);
  // Vues des publications relevées sur la période (somme des derniers relevés par publication).
  const vues = {};
  for (const l of onglets.historique || []) {
    const d = String(l['Relevé le']).slice(0, 10), v = Number(l['Vues']);
    if (d < debut || !Number.isFinite(v)) continue;
    const k = `${l['Réseau']}|${l['ID']}`;
    if (!vues[k] || vues[k].d <= d) vues[k] = { d, v, reseau: l['Réseau'] };
  }
  const vuesParReseau = {};
  for (const x of Object.values(vues)) vuesParReseau[x.reseau] = (vuesParReseau[x.reseau] || 0) + x.v;
  return { configure: true, abonnes, total: abonnes.reduce((s, a) => s + a.n, 0), vuesPublications: Object.entries(vuesParReseau).map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n) };
}

function ventes(onglets, jours, debut, fin) {
  if (!onglets?.gumroad_ventes) return { configure: Boolean(onglets) };
  const toutes = onglets.gumroad_ventes.map((v) => ({ jour: String(v.created_at).slice(0, 10), produit: v.product_name, prix: Number(v.price_cents) || 0, net: Number(v.net_cents) || 0,
    rembourse: /true/i.test(v.refunded) || /true/i.test(v.chargedback), source: nomSource(v.referrer === 'direct' ? '' : v.referrer) || 'Site QME' }));
  const periode = toutes.filter((v) => v.jour >= debut && v.jour <= fin && !v.rembourse);
  const payees = periode.filter((v) => v.prix > 0);
  const parProduit = {};
  for (const v of payees) { const p = (parProduit[v.produit] ||= { nom: v.produit, n: 0, revenu: 0 }); p.n++; p.revenu += v.prix; }
  return {
    configure: true,
    nombre: payees.length, gratuites: periode.length - payees.length, remboursees: toutes.filter((v) => v.rembourse && v.jour >= debut).length,
    revenu: payees.reduce((s, v) => s + v.prix, 0), net: payees.reduce((s, v) => s + v.net, 0), devise: 'USD',
    parJour: parJour(jours, payees.map((v) => [v.jour, 1])),
    revenuParJour: parJour(jours, payees.map((v) => [v.jour, v.prix])),
    parProduit: Object.values(parProduit).sort((a, b) => b.revenu - a.revenu),
    totalDepuisDebut: { nombre: toutes.filter((v) => v.prix > 0 && !v.rembourse).length, revenu: toutes.filter((v) => !v.rembourse).reduce((s, v) => s + v.prix, 0) },
    // Gumroad : vues des pages produits (cumul depuis l'ouverture, pas de découpage par jour dans le Sheet).
    vuesGumroad: (onglets.gumroad_produits || []).reduce((s, p) => s + (Number(p.views) || 0), 0),
    sourcesGumroad: Object.values((onglets.gumroad_sources || []).reduce((acc, s) => {
      const r = String(s.referrer || '').trim(), nom = /^direct$/i.test(r) || !r ? 'Accès direct' : /gumroad/i.test(r) ? 'Gumroad' : (nomSource(r) || 'Site QME');
      const x = (acc[nom] ||= { nom, vues: 0, ventes: 0 }); x.vues += Number(s.views) || 0; x.ventes += Number(s.sales) || 0; return acc;
    }, {})).sort((a, b) => b.vues - a.vues).slice(0, 8),
  };
}

// --- Taux de change USD → EUR (BCE, via Frankfurter, sans clé) : Gumroad facture en dollars -------------------
export const TAUX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR';
async function tauxUsdEur(recuperer) {
  const r = await recuperer(TAUX_URL);
  if (!r.ok) throw new Error(`taux ${r.status}`);
  const j = await r.json(), taux = Number(j?.rates?.EUR);
  if (!(taux > 0.2 && taux < 5)) throw new Error('taux invalide');
  return { taux, date: j.date || null, source: 'BCE (Frankfurter)' };
}
// Montants en euros (centimes arrondis) ajoutés à côté des montants en dollars.
export function enEuros(v, t) {
  if (!v?.configure || !t?.taux) return v;
  const e = (c) => Math.round((c || 0) * t.taux);
  return { ...v, eur: { taux: t.taux, date: t.date, source: t.source, revenu: e(v.revenu), net: e(v.net), totalDepuisDebut: e(v.totalDepuisDebut?.revenu),
    parProduit: Object.fromEntries((v.parProduit || []).map((p) => [p.nom, e(p.revenu)])) } };
}

// --- Essais gratuits (store des essais) -------------------------------------------------------------
async function essais({ store, jours, debut, fin, aujourdhui, testeurs }) {
  // Traces anonymes permanentes (stat/…) + essais encore présents sans trace ; tests exclus.
  const traces = new Map();
  for (const k of await store.lister('stat/')) { const s = await store.get(k); if (s?.id) traces.set(s.id, s); }
  const enCours = [];
  for (const k of await store.lister('essai/')) {
    const r = await store.get(k);
    if (!r?.id) continue;
    if (!traces.has(r.id)) traces.set(r.id, { id: r.id, produit: r.produit, cree: r.cree, achete: r.achete || null, test: estEssaiTest(r.email, testeurs) });
    if (!estEssaiTest(r.email, testeurs) && !r.achete && aujourdhui <= r.fin) enCours.push(r);
  }
  const reels = [...traces.values()].filter((t) => !t.test);
  const jourDe = (iso) => (iso ? jourParis(new Date(iso)) : '');
  const periode = reels.filter((t) => jourDe(t.cree) >= debut && jourDe(t.cree) <= fin);
  const parTemplate = {};
  for (const t of periode) { const p = (parTemplate[t.produit] ||= { produit: t.produit, nom: PRODUITS[t.produit]?.nom || t.produit, essais: 0, achetes: 0 }); p.essais++; if (t.achete) p.achetes++; }
  return {
    lances: periode.length, achetes: periode.filter((t) => t.achete).length, enCours: enCours.length,
    finissentSous3Jours: enCours.filter((r) => decaler(aujourdhui, 3) >= r.fin).length,
    tests: [...traces.values()].filter((t) => t.test && jourDe(t.cree) >= debut).length,
    parJour: parJour(jours, periode.map((t) => [jourDe(t.cree), 1])),
    parTemplate: Object.values(parTemplate).sort((a, b) => b.essais - a.essais || a.nom.localeCompare(b.nom, 'fr')),
    totalDepuisDebut: reels.length,
  };
}

// --- Données saisies dans les applications (store templates-donnees) ----------------------------------
// Demande de Quentin du 22/11/2026 : savoir si acheteurs et testeurs ont réellement saisi des données. Chaque
// enregistrement est lu côté serveur, mais seuls sont renvoyés son type, son template, sa date de modification
// (majLe), sa taille et le nombre d'éléments de ses listes de premier niveau : jamais son contenu.
// Les clés sont des empreintes (HMAC) du code d'accès : on ne sait pas à qui appartient un espace d'achat. On exclut
// les espaces personnels de l'administrateur (clé recalculée par template) et les essais de test (index des essais).
export const elementsSaisis = (d) => (d && typeof d === 'object' ? Object.values(d).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0) : 0);

async function donneesSaisies({ secret, donnees, store, debut, fin, testeurs }) {
  if (!donnees) return { configure: false };
  // Clés de données des essais connus → essai de test ou non (registres en cours et traces anonymes).
  const essaisConnus = new Map();
  for (const prefixe of ['essai/', 'stat/']) {
    for (const k of await store.lister(prefixe)) {
      const r = await store.get(k);
      if (!r?.id || !r.produit) continue;
      const c = cleDonneesEssai(secret, r.produit, r.id);
      if (!essaisConnus.has(c) || prefixe === 'essai/') essaisConnus.set(c, prefixe === 'essai/' ? estEssaiTest(r.email, testeurs) : Boolean(r.test));
    }
  }
  const admin = new Set(Object.keys(PRODUITS).map((p) => cleDonnees(secret, p, idAdminProduit(secret, p))));
  const cles = [...new Set(await donnees.lister())];
  const lus = [];
  for (let i = 0; i < cles.length; i += 10) {
    lus.push(...await Promise.all(cles.slice(i, i + 10).map(async (cle) => ({ cle, d: await donnees.get(cle).catch(() => null) }))));
  }
  const exclus = { admin: 0, tests: 0 }, espaces = [];
  for (const { cle, d } of lus) {
    if (!d) continue;
    const morceaux = cle.split('/'), essai = morceaux[0] === 'essai', produit = essai ? morceaux[1] : morceaux[0];
    if (!essai && admin.has(cle)) { exclus.admin++; continue; }
    if (essai && essaisConnus.get(cle) === true) { exclus.tests++; continue; }
    const majLe = typeof d.majLe === 'string' ? d.majLe : null;
    espaces.push({ type: essai ? 'essai' : 'achat', produit, nom: PRODUITS[produit]?.nom || produit, majLe,
      jour: majLe ? jourParis(new Date(majLe)) : '', taille: JSON.stringify(d).length, elements: elementsSaisis(d), connu: !essai || essaisConnus.has(cle) });
  }
  espaces.sort((a, b) => String(b.majLe).localeCompare(String(a.majLe)));
  const actif = (e) => e.jour >= debut && e.jour <= fin;
  const parTemplate = {};
  for (const e of espaces) {
    const t = (parTemplate[e.produit] ||= { produit: e.produit, nom: e.nom, achats: 0, essais: 0, actifs: 0, elements: 0, derniere: null });
    t[e.type === 'essai' ? 'essais' : 'achats']++; if (actif(e)) t.actifs++; t.elements += e.elements;
    if (e.majLe && (!t.derniere || e.majLe > t.derniere)) t.derniere = e.majLe;
  }
  const achats = espaces.filter((e) => e.type === 'achat'), essais = espaces.filter((e) => e.type === 'essai');
  return {
    configure: true,
    achats: achats.length, achatsActifs: achats.filter(actif).length,
    essais: essais.length, essaisActifs: essais.filter(actif).length,
    exclus,
    parTemplate: Object.values(parTemplate).sort((a, b) => String(b.derniere).localeCompare(String(a.derniere))),
    recents: espaces.slice(0, 30).map(({ type, produit, nom, majLe, taille, elements, connu }) => ({ type, produit, nom, majLe, taille, elements, connu })),
  };
}

export async function tableau({ secret, store, donnees = null, interets = null, goatcounter = {}, sheetBase = '', recuperer = fetch, jours: nbJours = 30, maintenant = Date.now, testeurs = '' }) {
  const aujourdhui = jourParis(new Date(maintenant()));
  const n = PERIODES.includes(nbJours) ? nbJours : 30;
  const debut = decaler(aujourdhui, -(n - 1)), fin = aujourdhui, jours = joursDe(debut, fin);
  const garder = (p) => p.catch((e) => ({ erreur: String(e?.message || e) }));
  const [aud, sh, ess, reg, int, taux, don] = await Promise.all([
    garder(audience({ goatcounter, recuperer, debut, fin, jours })),
    garder(sheet({ base: sheetBase, recuperer })),
    garder(essais({ store, jours, debut, fin, aujourdhui, testeurs })),
    garder(lireRegistre({ secret, store })),
    interets ? garder((async () => synthese(await interets.lister('clic/'), new Date(maintenant()), await interets.lister('email/')))()) : Promise.resolve(null),
    garder(tauxUsdEur(recuperer)),
    garder(donneesSaisies({ secret, donnees, store, debut, fin, testeurs })),
  ]);
  const onglets = sh?.onglets || null;
  const ven = sh?.erreur ? { erreur: sh.erreur } : enEuros(ventes(onglets, jours, debut, fin), taux?.erreur ? null : taux);
  const res = sh?.erreur ? { erreur: sh.erreur } : reseaux(onglets, debut);
  const lignes = Array.isArray(reg) ? reg : [];
  const comptes = reg?.erreur ? { erreur: reg.erreur } : {
    personnes: lignes.filter((l) => l.profil !== 'domaine').length,
    acheteurs: lignes.filter((l) => l.profil.includes('acheteur')).length,
    testeurs: lignes.filter((l) => l.profil.includes('testeur')).length,
    comptesSansAchat: lignes.filter((l) => l.profil === 'compte sans achat').length,
    abonnes: lignes.filter((l) => l.informations === 'abonné').length,
    desinscrits: lignes.filter((l) => l.informations === 'désinscrit').length,
    annoncesEnvoyees: lignes.filter((l) => l.derniereAnnonce).length,
  };
  return {
    lu: new Date(maintenant()).toISOString(),
    periode: { debut, fin, jours: n },
    audience: aud, reseaux: res, essais: ess, ventes: ven, comptes, donnees: don,
    interets: int && !int.erreur ? { total: int.total, emails: int.emails, top: (int.modules || []).slice(0, 6).map((m) => ({ nom: m.nom, n: m.total, emails: m.emails })) } : int,
    // Entonnoir de la période : visites du site → essais lancés → ventes payées (vues Gumroad : cumul, à part).
    entonnoir: { visites: aud?.vues ?? null, essais: ess?.lances ?? null, ventes: ven?.nombre ?? null },
  };
}

export async function traiterTableau(requete, { secret, admin = '', ...reste }) {
  if (requete.method !== 'GET') return json(405, { erreur: 'Méthode non permise.' });
  if (!secret || secret.length < 32 || !reste.store) return json(503, { erreur: 'Service non configuré' });
  if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
  const jours = Number(new URL(requete.url).searchParams.get('jours')) || 30;
  return json(200, await tableau({ secret, jours, ...reste }));
}
