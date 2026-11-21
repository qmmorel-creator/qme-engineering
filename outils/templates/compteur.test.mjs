// Compteur réseaux QME (/api/compteur) : mot de passe, lecture CSV, onglets en erreur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { traiterCompteur, lireCsv, motDePasseValide, adressePublication, lireEssaisAnonymes, ONGLETS } from '../../netlify/lib/compteur.mjs';

const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-essai_123456789012345/pub';
const req = (mdp) => new Request('https://qm-engineering.fr/api/compteur', { headers: mdp ? { 'x-mot-de-passe': mdp } : {} });
const sansAttente = { attendre: async () => {} };

test('lireCsv : guillemets, virgules, retours à la ligne, lignes vides', () => {
  const l = lireCsv('a,b,c\r\n"x, y","il dit ""oui""","deux\nlignes"\n,,\n');
  assert.deepEqual(l, [['a', 'b', 'c'], ['x, y', 'il dit "oui"', 'deux\nlignes']]);
});

test('motDePasseValide : exact, espaces ignorés, trop court refusé', () => {
  assert.equal(motDePasseValide(' soleil42 ', 'soleil42'), true);
  assert.equal(motDePasseValide('soleil4', 'soleil42'), false);
  assert.equal(motDePasseValide('abc', 'abc'), false);
  assert.equal(motDePasseValide('', 'soleil42'), false);
});

test('mauvais mot de passe : 401 sans lire le Sheet', async () => {
  let lu = false;
  const r = await traiterCompteur(req('faux'), { motDePasse: 'soleil42', base: BASE, recuperer: async () => { lu = true; }, ...sansAttente });
  assert.equal(r.status, 401);
  assert.equal(lu, false);
});

test('non configuré : 503', async () => {
  const r = await traiterCompteur(req('soleil42'), { motDePasse: '', base: BASE, ...sansAttente });
  assert.equal(r.status, 503);
  const r2 = await traiterCompteur(req('soleil42'), { motDePasse: 'soleil42', base: 'https://exemple.fr/pub', ...sansAttente });
  assert.equal(r2.status, 503);
});

test('bon mot de passe : chaque onglet lu par son gid ; onglet non publié signalé', async () => {
  const appels = [];
  const recuperer = async (url) => {
    appels.push(url);
    if (url.includes(`gid=${ONGLETS.gumroad_ventes}`)) return new Response('<html>connexion</html>');
    return new Response('Réseau,ID\nLinkedIn,LI-01\n');
  };
  const r = await traiterCompteur(req('soleil42'), { motDePasse: 'soleil42', base: BASE, recuperer, ...sansAttente });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const corps = await r.json();
  assert.equal(appels.length, Object.keys(ONGLETS).length);
  assert.ok(appels.every((u) => u.startsWith(BASE + '?gid=') && u.endsWith('&single=true&output=csv')));
  assert.deepEqual(corps.onglets.publications, [['Réseau', 'ID'], ['LinkedIn', 'LI-01']]);
  assert.equal(corps.erreurs.gumroad_ventes, 'onglet non publié');
});

test('adressePublication : toutes les formes données par Google', () => {
  const id = '2PACX-1vT_abcDEF0123456789-xyz';
  const attendu = `https://docs.google.com/spreadsheets/d/e/${id}/pub`;
  for (const forme of [
    `https://docs.google.com/spreadsheets/d/e/${id}/pub`,
    `https://docs.google.com/spreadsheets/d/e/${id}/pubhtml`,
    `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`,
    `  https://docs.google.com/spreadsheets/d/e/${id}/pubhtml?gid=0&single=true  `,
    `https://docs.google.com/spreadsheets/d/e/${id}/pub?gid=1450548824&single=true&output=csv`,
  ]) assert.deepEqual(adressePublication(forme), { ok: true, base: attendu }, forme);
  const edition = adressePublication('https://docs.google.com/spreadsheets/d/1578z4XTYuN-_85VdCrjJYLX9hEDlRpnmZZP5gTfNMik/edit');
  assert.equal(edition.ok, false);
  assert.match(edition.erreur, /adresse d'édition/);
  assert.equal(adressePublication('https://exemple.fr').ok, false);
});

test('adresse en pubhtml : les onglets sont lus à partir de /pub', async () => {
  const appels = [];
  const r = await traiterCompteur(req('soleil42'), { motDePasse: 'soleil42', base: BASE.replace('/pub', '/pubhtml') + '?gid=0&single=true', recuperer: async (u) => { appels.push(u); return new Response('a,b\n1,2\n'); }, ...sansAttente });
  assert.equal(r.status, 200);
  assert.ok(appels.every((u) => u.startsWith(BASE + '?gid=')));
});

const magasin = (donnees) => ({
  get: async (cle) => donnees[cle] ?? null,
  lister: async (prefixe) => Object.keys(donnees).filter((k) => k.startsWith(prefixe)),
});

test('essais anonymes : traces gardées, essais sans trace ajoutés, ni e-mail ni prénom', async () => {
  const lignes = await lireEssaisAnonymes(magasin({
    'stat/A': { id: 'A', produit: 'REV', cree: '2026-11-19T10:00:00Z', achete: '2026-11-25T09:00:00Z', test: false },
    'stat/B': { id: 'B', produit: 'CRA', cree: '2026-11-18T09:00:00Z', achete: null, test: true },
    'essai/A': { id: 'A', produit: 'REV', email: 'client@exemple.fr', prenom: 'Léa', cree: '2026-11-19T10:00:00Z' },
    'essai/C': { id: 'C', produit: 'PRX', email: 'autre@exemple.fr', prenom: 'Max', cree: '2026-11-20T08:00:00Z', achete: null },
    'essai/D': { id: 'D', produit: 'REV', email: 'test@example.com', cree: '2026-11-21T08:00:00Z' },
  }));
  assert.deepEqual(lignes[0], ['Template', 'Produit', 'Créé le', 'Acheté le', 'Test']);
  assert.equal(lignes.length, 5);
  assert.deepEqual(lignes.slice(1).map((l) => [l[1], l[3] !== '', l[4]]), [['CRA', false, 'TRUE'], ['REV', true, 'FALSE'], ['PRX', false, 'FALSE'], ['REV', false, 'TRUE']]);
  assert.equal(lignes[2][0], 'Planning de révision');
  const texte = JSON.stringify(lignes);
  assert.ok(!texte.includes('@') && !texte.includes('Léa') && !texte.includes('Max'));
});

test('compteur : onglet essais ajouté quand le stockage est fourni', async () => {
  const r = await traiterCompteur(req('soleil42'), { motDePasse: 'soleil42', base: BASE, essais: magasin({ 'stat/A': { id: 'A', produit: 'REV', cree: '2026-11-19T10:00:00Z', test: false } }), recuperer: async () => new Response('a\n1\n'), ...sansAttente });
  const corps = await r.json();
  assert.equal(corps.onglets.essais.length, 2);
});
