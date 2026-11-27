// Version privée « Révisions QME X Laurine » (prive/revisions-laurine/, produit RVX) : accès par code comme le
// template de base, mais hors catalogue, hors espace /connexion/, hors sitemap, et règles pures (import CSV…).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { genererCode, verifierCode, traiter, cleDonnees, PRODUITS, PRODUITS_PRIVES } from '../../netlify/lib/templates-acces.mjs';

const RACINE = new URL('../../', import.meta.url);
const lire = (f) => readFileSync(new URL(f, RACINE), 'utf8');
const SECRET = 'secret-de-test-0123456789-0123456789-abcdef';
const bac = { window: {}, URL };
vm.runInNewContext(lire('prive/revisions-laurine/laurine-regles.js'), bac);
const R = bac.window.RVXR;
// Résultats repassés en JSON : les objets créés dans le bac à sable n'ont pas les prototypes de ce contexte.
const X = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, typeof v === 'function' ? (...a) => JSON.parse(JSON.stringify(v(...a))) : v]));

test('RVX : produit privé, absent de PRODUITS (catalogue, essais, espace acheteurs)', () => {
  assert.ok(PRODUITS_PRIVES.RVX);
  assert.equal(PRODUITS.RVX, undefined);
  assert.equal(PRODUITS_PRIVES.RVX.gumroad, undefined);
  assert.ok(!/RVX|revisions-laurine/.test(lire('connexion/index.html')));
  assert.ok(!/prive\//.test(lire('sitemap.xml')));
  assert.ok(!/revisions-laurine/.test(lire('templates/index.html')));
});

test('RVX : code généré, vérifié, connexion et données séparées de REV', async () => {
  const code = genererCode(SECRET, 'RVX');
  assert.match(code, /^RVX-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const a = verifierCode(SECRET, code);
  assert.equal(a.produit, 'RVX');
  assert.equal(verifierCode(SECRET, code.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
  const m = new Map();
  const stockage = { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); } };
  const r = await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code, produit: 'RVX' }) }), { secret: SECRET, stockage });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.produit, 'RVX');
  assert.equal(j.url, '/prive/revisions-laurine/');
  assert.ok(cleDonnees(SECRET, 'RVX', a.id).startsWith('RVX/'));
  const rev = genererCode(SECRET, 'REV');
  assert.equal(verifierCode(SECRET, rev).produit, 'REV');
});

test('RVX : noindex (meta et en-tête), stockage local distinct, sans essai ni Gumroad', () => {
  const html = lire('prive/revisions-laurine/index.html');
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.ok(!html.includes('/assets/essai.js'));
  const toml = lire('netlify.toml');
  const bloc = toml.split(/^\[\[/m).find((b) => b.includes('for = "/prive/*"'));
  assert.ok(bloc && bloc.includes('X-Robots-Tag = "noindex, nofollow"'));
  assert.ok(toml.includes('for = "/prive/revisions-laurine/sw.js"'));
  const app = lire('prive/revisions-laurine/app.js');
  assert.match(app, /const PRODUIT = 'RVX'/);
  assert.ok(!/qme-rev-/.test(app));
  assert.ok(existsSync(new URL('templates/revision/app.js', RACINE)));
});

test('import CSV : en-tête, dates, énergie, liens https, erreurs par ligne', () => {
  const r = X.analyserCsv('﻿matiere;cours;examen;energie;vu_le;mots_cles;ressources\n'
    + 'Biochimie;Enzymologie;15/01/2027;forte;01/11/2026;"site actif; Km";https://drive.google.com/a\n'
    + 'Biochimie;Glycolyse;;;;;\n'
    + ';Sans matière;;;;;\n'
    + 'Anatomie;Fémur;31/02/2027;;;;\n'
    + 'Anatomie;Tibia;;énorme;;;\n'
    + 'Anatomie;Radius;;;;;http://non-securise.fr\n'
    + 'Anatomie;Ulna;;;01/12/2030;;\n', '2026-11-27');
  assert.equal(r.lignes.length, 2);
  assert.deepEqual(r.lignes[0], { n: 2, matiere: 'Biochimie', cours: 'Enzymologie', examen: '2027-01-15', energie: 'forte', vuLe: '2026-11-01', motsCles: 'site actif; Km', ressources: [{ titre: '', url: 'https://drive.google.com/a' }] });
  assert.equal(r.erreurs.length, 5);
  const g = X.grouperCsv(r.lignes);
  assert.equal(g.length, 1);
  assert.equal(g[0].examen, '2027-01-15');
  assert.equal(g[0].energie, 'forte');
  assert.equal(X.analyserCsv(X.MODELE_CSV, '2026-11-27').erreurs.length, 0);
  assert.equal(X.analyserCsv('Maths,Suites\nMaths,Limites', '2026-11-27').lignes.length, 2); // sans en-tête, virgules
  assert.match(X.PROMPT_PDF, /matiere;cours;examen;energie;vu_le;mots_cles;ressources/);
});

test('déplacer, regrouper, réordonner', () => {
  assert.deepEqual(X.joursDeplacement('2026-11-28', '2026-11-27', '2026-11-30').map((j) => j.date), ['2026-11-27', '2026-11-29']);
  assert.deepEqual(X.joursDeplacement('2026-11-20', '2026-11-27').map((j) => j.date), ['2026-11-28', '2026-11-29', '2026-11-30']);
  const ch = [{ id: 'a', matiereId: 'm', prochaine: '2026-11-28' }, { id: 'b', matiereId: 'm', prochaine: '2026-11-30' }, { id: 'c', matiereId: 'n', prochaine: '2026-11-28' }, { id: 'd', matiereId: 'm', prochaine: '2026-12-09' }];
  assert.deepEqual(X.aRegrouper(ch, 'm', '2026-11-28', '2026-11-27', 'a').map((c) => c.id), ['b']);
  assert.deepEqual(X.deplacerDans(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
  assert.deepEqual(X.deplacerDans(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(X.deplacerDans(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
  assert.deepEqual(X.deplacerDans(['a', 'b'], 'a', -1), ['a', 'b']);
});

// ---------- Accès par Gumroad (ping d'achat, licence, profil de démo rattaché à l'acheteur) ----------
import { configPrives } from '../../netlify/lib/templates-acces.mjs';
import { traiterAchat, produitVendu } from '../../netlify/lib/achats.mjs';

const ID_RVX = 'rvx-produit-gumroad-test';
const PRIVES = configPrives({ RVX_GUMROAD_ID: ID_RVX, RVX_ACCES_DEMO: 'laurine@exemple.fr:pass, Quentin@Exemple.fr:pcsi, x@y.fr:inconnu' });
const LICENCES = { 'AAAAAAAA-00000000-00000000-00000001': 'eleve@exemple.fr', 'AAAAAAAA-00000000-00000000-00000002': 'laurine@exemple.fr', 'AAAAAAAA-00000000-00000000-00000003': 'quentin@exemple.fr' };
const verifier = async (gumroad, licence) => (gumroad === ID_RVX && LICENCES[licence] ? { ok: true, achat: { email: LICENCES[licence], price: 0, currency: 'eur' } } : { ok: false, raison: 'inconnue' });
const memoire = () => { const m = new Map(); return { m, get: async (k) => structuredClone(m.get(k) ?? null), set: async (k, v) => { m.set(k, structuredClone(v)); }, supprimer: async (k) => { m.delete(k); }, lister: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) }; };

test('RVX Gumroad : configuration lue dans l\'environnement, rien sans identifiant', () => {
  assert.deepEqual(PRIVES.RVX.demos, { 'laurine@exemple.fr': 'pass', 'quentin@exemple.fr': 'pcsi' });
  assert.equal(configPrives({}).RVX.gumroad, null);
  assert.equal(produitVendu(ID_RVX, configPrives({})), null);
  assert.equal(produitVendu(ID_RVX, PRIVES).code, 'RVX');
  assert.equal(produitVendu(PRODUITS.REV.gumroad, PRIVES).code, 'REV');
});

test('RVX Gumroad : ping d\'achat → mail avec le lien privé, copie cachée par défaut, ni compte ni suivi', async () => {
  const essais = memoire(), mails = [];
  const ping = (licence) => new Request('http://t/api/achat', { method: 'POST', body: new URLSearchParams({ product_id: ID_RVX, license_key: licence, full_name: 'Camille Test' }) });
  const r = await traiterAchat(ping('AAAAAAAA-00000000-00000000-00000001'), { secret: SECRET, essais, envoyer: async (m) => { mails.push(m); }, notifier: 'q@local', verifierLicence: verifier, prives: PRIVES });
  assert.equal((await r.json()).mail, 'achat-prive');
  assert.equal(mails[0].a, 'eleve@exemple.fr');
  assert.match(mails[0].texte, /\/prive\/revisions-laurine\//);
  assert.ok(!mails[0].texte.includes('/connexion/'));
  assert.notEqual(mails[0].copieCachee, false); // copie cachée par défaut (mail.mjs)
  assert.ok(![...essais.m.keys()].some((k) => k.startsWith('suivi-') || k.startsWith('compte')));
  assert.equal(mails[1].a, 'q@local');
});

test('RVX Gumroad : connexion par licence → compte vide, démo PASS (Laurine), démo PCSI (Quentin)', async () => {
  const stockage = memoire();
  const connexion = async (code) => (await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code, produit: 'RVX' }) }), { secret: SECRET, stockage, verifierLicence: verifier, prives: PRIVES })).json();
  const a = await connexion('AAAAAAAA-00000000-00000000-00000001');
  assert.equal(a.produit, 'RVX'); assert.equal(a.donnees, null); assert.equal(a.demo, undefined);
  assert.equal((await connexion('AAAAAAAA-00000000-00000000-00000002')).demo, 'pass');
  assert.equal((await connexion('AAAAAAAA-00000000-00000000-00000003')).demo, 'pcsi');
  assert.equal((await connexion('AAAAAAAA-00000000-00000000-00000009')).erreur, 'Clé de licence inconnue.');
});

test('produits vendus inchangés : sans RVX_GUMROAD_ID, aucune vérification Gumroad de plus', async () => {
  const appels = [];
  const v = async (g) => { appels.push(g); return { ok: false, raison: 'inconnue' }; };
  await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code: 'BBBBBBBB-00000000-00000000-00000001' }) }), { secret: SECRET, stockage: memoire(), verifierLicence: v, prives: configPrives({}) });
  assert.ok(!appels.includes(null) && !appels.includes(ID_RVX));
  const n = appels.length; appels.length = 0;
  await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code: 'BBBBBBBB-00000000-00000000-00000001' }) }), { secret: SECRET, stockage: memoire(), verifierLicence: v, prives: PRIVES });
  assert.equal(appels.length, n + 1);
});
