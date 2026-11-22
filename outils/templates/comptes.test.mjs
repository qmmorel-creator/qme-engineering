// Comptes acheteurs (connexion par lien e-mail) : lien, session, achats rangés, essais, clés de l'appareil,
// préférences, déconnexion partout, suppression.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, genererCodeEssai, genererCodePack, PRODUITS, PACKS, codeAdmin } from '../../netlify/lib/templates-acces.mjs';
import { traiterCompte, ajouterAchat, cleCompte, cleValide, nettoyerPrefs, jetonLien, purgerComptes, DUREE_LIEN, DUREE_SESSION } from '../../netlify/lib/comptes.mjs';
import { traiterAchat } from '../../netlify/lib/achats.mjs';
import { traiterEssai } from '../../netlify/lib/essais.mjs';

const SECRET = 'y'.repeat(40);
const T0 = Date.parse('2026-11-22T10:00:00+01:00');
const LICENCE = 'ABCDEF01-23456789-ABCDEF01-23456789';
const memoire = () => {
  const m = new Map();
  return { m, get: async (c) => structuredClone(m.get(c) ?? null), set: async (c, v) => { m.set(c, structuredClone(v)); },
    supprimer: async (c) => { m.delete(c); }, lister: async (p) => [...m.keys()].filter((c) => c.startsWith(p)) };
};
const monde = () => ({ store: memoire(), mails: [], t: T0 });
const appel = (w, chemin, { methode = 'GET', corps, jeton } = {}) => traiterCompte(new Request(`http://t/api/compte${chemin}`, {
  method: methode, headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: corps === undefined ? undefined : JSON.stringify(corps),
}), { secret: SECRET, store: w.store, envoyer: async (m) => { w.mails.push(m); }, maintenant: () => w.t });
const lienDe = (mail) => mail.texte.match(/\/connexion\/\?lien=([^\s]+)/)[1];
async function connecter(w, email) {
  assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email } })).status, 200);
  const r = await appel(w, '/session', { methode: 'POST', corps: { lien: lienDe(w.mails.at(-1)) } });
  assert.equal(r.status, 200);
  return r.json();
}

test('lien de connexion : e-mail envoyé, usage unique, 15 minutes, compte créé au premier passage', async () => {
  const w = monde();
  assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email: 'pas-une-adresse' } })).status, 400);
  const r = await appel(w, '/lien', { methode: 'POST', corps: { email: ' Lea@Exemple.FR ' } });
  assert.deepEqual(await r.json(), { ok: true });
  const [m] = w.mails;
  assert.equal(m.a, 'lea@exemple.fr');
  assert.equal(m.objet, 'Votre lien de connexion QME');
  assert.ok(m.texte.includes('https://qm-engineering.fr/connexion/?lien=') && m.texte.includes('15 minutes'));
  const lien = lienDe(m);
  assert.equal(await w.store.get(cleCompte(SECRET, 'lea@exemple.fr')), null, 'aucun compte avant le clic');
  const s = await (await appel(w, '/session', { methode: 'POST', corps: { lien } })).json();
  assert.ok(s.jeton);
  assert.equal(s.compte.email, 'lea@exemple.fr');
  assert.deepEqual(s.compte.cles, []);
  assert.equal((await appel(w, '/session', { methode: 'POST', corps: { lien } })).status, 401, 'lien à usage unique');
  // Lien expiré, lien falsifié
  const vieux = jetonLien(SECRET, 'lea@exemple.fr', T0 - DUREE_LIEN - 1);
  assert.equal((await appel(w, '/session', { methode: 'POST', corps: { lien: vieux } })).status, 401);
  assert.equal((await appel(w, '/session', { methode: 'POST', corps: { lien: lien.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) } })).status, 401);
  assert.equal((await appel(w, '/session', { methode: 'POST', corps: { lien: jetonLien('z'.repeat(40), 'lea@exemple.fr', T0) } })).status, 401, 'autre secret');
});

test('lien : réponse identique pour une adresse inconnue, envois limités', async () => {
  const w = monde();
  assert.deepEqual(await (await appel(w, '/lien', { methode: 'POST', corps: { email: 'inconnu@exemple.fr' } })).json(), { ok: true });
  assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email: 'inconnu@exemple.fr' } })).status, 429, 'deux envois à moins de 30 s');
  for (let i = 0; i < 4; i++) { w.t += 60_000; assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email: 'inconnu@exemple.fr' } })).status, 200); }
  w.t += 60_000;
  assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email: 'inconnu@exemple.fr' } })).status, 429, '5 envois par heure au plus');
  w.t += 3_600_000;
  assert.equal((await appel(w, '/lien', { methode: 'POST', corps: { email: 'inconnu@exemple.fr' } })).status, 200);
});

test('session : requise, expire, révoquée par « déconnexion partout » et par suppression', async () => {
  const w = monde();
  const { jeton } = await connecter(w, 'paul@exemple.fr');
  assert.equal((await appel(w, '/')).status, 401);
  assert.equal((await appel(w, '/', { jeton: 'abc.def' })).status, 401);
  assert.equal((await appel(w, '/', { jeton })).status, 200);
  w.t += DUREE_SESSION + 1;
  assert.equal((await appel(w, '/', { jeton })).status, 401, 'session de 90 jours');
  w.t = T0 + 120_000;
  const { jeton: j2 } = await connecter(w, 'paul@exemple.fr');
  assert.equal((await appel(w, '/deconnexion', { methode: 'POST', jeton: j2 })).status, 200);
  assert.equal((await appel(w, '/', { jeton: j2 })).status, 401, 'toutes les sessions fermées');
  w.t += 60_000;
  const { jeton: j3 } = await connecter(w, 'paul@exemple.fr');
  assert.equal((await appel(w, '/', { methode: 'DELETE', jeton: j3 })).status, 200);
  assert.equal(await w.store.get(cleCompte(SECRET, 'paul@exemple.fr')), null);
  assert.equal((await appel(w, '/', { jeton: j3 })).status, 401);
});

test('achat Gumroad : rangé dans le compte de l\'adresse, retrouvé à la connexion, prénom repris', async () => {
  const w = monde();
  const verifier = async (gumroad) => (gumroad === PRODUITS.BDG.gumroad ? { ok: true, achat: { email: 'Camille@Exemple.fr' } } : { ok: false, raison: 'inconnue' });
  const r = await traiterAchat(new Request('http://t/api/achat', { method: 'POST', body: new URLSearchParams({ product_id: PRODUITS.BDG.gumroad, license_key: LICENCE.toLowerCase(), full_name: 'camille Durand' }) }),
    { secret: SECRET, essais: w.store, envoyer: async (m) => { w.mails.push(m); }, maintenant: () => w.t, verifierLicence: verifier });
  assert.equal(r.status, 200);
  assert.ok(w.mails[0].texte.includes('connectez-vous avec cette adresse e-mail'), 'e-mail de remerciement : connexion par adresse');
  const s = await connecter(w, 'camille@exemple.fr');
  assert.equal(s.compte.prenom, 'Camille');
  assert.deepEqual(s.compte.cles, [{ type: 'template', p: 'BDG', code: LICENCE, source: 'achat' }]);
  // Pack : rangé comme pack ; même vente deux fois : un seul exemplaire
  const pack = Object.keys(PACKS).find((k) => PACKS[k].gumroad) || Object.keys(PACKS)[0];
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'camille@exemple.fr', vente: { type: 'pack', code: pack }, licence: LICENCE.replace('A', 'B'), maintenant: () => w.t });
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'camille@exemple.fr', vente: { type: 'pack', code: pack }, licence: LICENCE.replace('A', 'B'), maintenant: () => w.t });
  const c = (await (await appel(w, '/', { jeton: s.jeton })).json()).compte;
  assert.equal(c.cles.filter((k) => k.type === 'pack').length, 1);
});

test('essais de l\'adresse : listés avec jours restants, absents une fois achetés', async () => {
  const w = monde();
  const e = await (await traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ consentement: true, email: 'zoe@exemple.fr', prenom: 'Zoé', produit: 'BDG' }) }),
    { secret: SECRET, essais: w.store, envoyer: null, maintenant: () => w.t, ip: '1.2.3.4' })).json();
  assert.ok(e.ok, JSON.stringify(e));
  w.t += 4 * 86_400_000;
  const s = await connecter(w, 'zoe@exemple.fr');
  assert.equal(s.compte.prenom, 'Zoé', 'prénom de l\'essai');
  assert.equal(s.compte.essais.length, 1);
  const [x] = s.compte.essais;
  assert.equal(x.p, 'BDG'); assert.equal(x.code, e.code); assert.equal(x.termine, false); assert.equal(x.joursRestants, 10);
  assert.ok(x.achat.startsWith('https://qmengineering.gumroad.com/l/'));
});

test('clés de l\'appareil : vérifiées, sans doublon, code administrateur refusé', async () => {
  const w = monde();
  const { jeton } = await connecter(w, 'max@exemple.fr');
  const code = genererCode(SECRET, 'TCH'), essai = genererCodeEssai(SECRET, 'BDG', new Date(T0)), pack = genererCodePack(SECRET, Object.keys(PACKS)[0]);
  const r = await (await appel(w, '/cles', { methode: 'POST', jeton, corps: { cles: [
    { p: 'TCH', code }, { p: 'TCH', code: code.toLowerCase() }, { p: 'GNT', code: LICENCE }, { p: 'BDG', code: essai },
    { p: 'PACK', code: pack }, { p: 'RPS', code: codeAdmin(SECRET) }, { p: 'RPS', code }, { p: 'ZZZ', code: LICENCE }, { p: 'RPS', code: 'n importe quoi' },
  ] } })).json();
  assert.equal(r.ajoutees, 4);
  assert.deepEqual(r.compte.cles.map((c) => `${c.type}:${c.p}`), ['template:TCH', 'template:GNT', 'essai:BDG', `pack:${Object.keys(PACKS)[0]}`]);
  assert.equal(cleValide(SECRET, { p: 'TCH', code: genererCode('z'.repeat(40), 'TCH') }), null, 'code signé par un autre secret');
});

test('préférences : prénom et prefs nettoyés, enregistrés et renvoyés', async () => {
  const w = monde();
  const { jeton } = await connecter(w, 'ines@exemple.fr');
  const r = await (await appel(w, '/prefs', { methode: 'PUT', jeton, corps: { prenom: '  Inès  ', prefs: {
    noms: { BDG: '  Budget   maison ', TCH: '<script>', ZZZ: 'x', RPS: '' }, masques: ['GNT', 'GNT', 'ZZZ'], epingles: ['BDG', 7],
  } } })).json();
  assert.equal(r.compte.prenom, 'Inès');
  assert.deepEqual(r.compte.prefs, { noms: { BDG: 'Budget maison' }, masques: ['GNT'], epingles: ['BDG'] });
  assert.ok(r.compte.prefsMaj);
  assert.equal((await (await appel(w, '/prefs', { methode: 'PUT', jeton, corps: { prenom: '1234<>' } })).json()).compte.prenom, '');
  assert.deepEqual(nettoyerPrefs({}), { noms: {}, masques: [], epingles: [] });
});

test('purge quotidienne : traces de demandes et liens expirés effacés, compte gardé', async () => {
  const w = monde();
  await connecter(w, 'eva@exemple.fr');
  const avant = [...w.store.m.keys()];
  assert.ok(avant.some((k) => k.startsWith('limite/')) && avant.some((k) => k.startsWith('lien/')));
  assert.deepEqual(await purgerComptes({ store: w.store, maintenant: () => w.t + 60_000 }), { limites: 0, liens: 0 }, 'encore utiles');
  assert.deepEqual(await purgerComptes({ store: w.store, maintenant: () => w.t + 3_600_001 }), { limites: 1, liens: 1 });
  assert.deepEqual([...w.store.m.keys()].filter((k) => !k.startsWith('compte/')), []);
  assert.ok(await w.store.get(cleCompte(SECRET, 'eva@exemple.fr')));
});
