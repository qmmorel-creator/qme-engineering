// Compteur réseaux QME (/api/compteur) : mot de passe, lecture CSV, onglets en erreur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { traiterCompteur, lireCsv, motDePasseValide, adressePublication, ONGLETS } from '../../netlify/lib/compteur.mjs';

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
