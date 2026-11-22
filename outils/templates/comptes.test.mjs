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
  assert.deepEqual(await purgerComptes({ store: w.store, maintenant: () => w.t + 60_000 }), { limites: 0, liens: 0, oppositions: 0 }, 'encore utiles');
  assert.deepEqual(await purgerComptes({ store: w.store, maintenant: () => w.t + 3_600_001 }), { limites: 1, liens: 1, oppositions: 0 });
  assert.deepEqual([...w.store.m.keys()].filter((k) => !k.startsWith('compte/')), []);
  assert.ok(await w.store.get(cleCompte(SECRET, 'eva@exemple.fr')));
});

// --- Administration : import des ventes passées et annonce des nouveautés ---------------------------------
const ADMIN = codeAdmin(SECRET);
const admin = (w, chemin, corps, { code = ADMIN, verifierLicence } = {}) => traiterCompte(new Request(`http://t/api/compte${chemin}`, {
  method: 'POST', headers: { 'x-admin': code }, body: JSON.stringify(corps),
}), { secret: SECRET, store: w.store, envoyer: async (m) => { w.mails.push(m); }, maintenant: () => w.t, testeurs: 'moi@qme.fr', verifierLicence });

test('import des ventes passées : code admin, simulation, clé vérifiée, adresse de la vente exigée', async () => {
  const w = monde();
  const verifier = async (gumroad, licence) => (gumroad === PRODUITS.TCH.gumroad && licence === LICENCE ? { ok: true, achat: { email: 'Floriane@Exemple.fr' } } : { ok: false, raison: 'inconnue' });
  const ventes = [{ email: 'floriane@exemple.fr', licence: LICENCE.toLowerCase() }, { email: 'autre@exemple.fr', licence: LICENCE }, { email: 'x@exemple.fr', licence: 'ABCDEF01-00000000-ABCDEF01-00000000' }, { email: 'pas-une-adresse', licence: LICENCE }];
  assert.equal((await admin(w, '/import', { ventes }, { code: 'ADM-FAUX', verifierLicence: verifier })).status, 401);
  const sim = await (await admin(w, '/import', { ventes }, { verifierLicence: verifier })).json();
  assert.equal(sim.simulation, true);
  assert.deepEqual(sim.rapport.map((r) => r.resultat), ['à importer', 'adresse différente de celle de la vente', 'clé inconnue', 'format invalide']);
  assert.equal(sim.rapport[0].produit, 'TCH');
  assert.ok(!sim.rapport.some((r) => r.licence.length > 9), 'clé tronquée dans le rapport');
  assert.equal(await w.store.get(cleCompte(SECRET, 'floriane@exemple.fr')), null, 'simulation : rien d\'écrit');
  const reel = await (await admin(w, '/import', { ventes: ventes.slice(0, 1), simulation: false }, { verifierLicence: verifier })).json();
  assert.equal(reel.rapport[0].resultat, 'importée');
  const s = await connecter(w, 'floriane@exemple.fr');
  assert.deepEqual(s.compte.cles, [{ type: 'template', p: 'TCH', code: LICENCE, source: 'achat' }]);
});

test('annonce : testeurs inscrits et acheteurs, une fois par adresse, par lots ; désinscription signée', async () => {
  const w = monde();
  // Testeuse inscrite aux nouveautés, testeur non inscrit, acheteuse, adresse de test exclue
  await w.store.set('contact/aaa', { email: 'lea@exemple.fr', prenom: 'Léa' });
  await traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ consentement: true, email: 'sansnouveautes@exemple.fr', produit: 'BDG' }) }),
    { secret: SECRET, essais: w.store, envoyer: null, maintenant: () => w.t, ip: '1.2.3.4' });
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'camille@exemple.fr', vente: { type: 'template', code: 'BDG' }, licence: LICENCE, nomComplet: 'Camille D', maintenant: () => w.t });
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'moi@qme.fr', vente: { type: 'template', code: 'BDG' }, licence: LICENCE, maintenant: () => w.t });
  const sim = await (await admin(w, '/annonce', {})).json();
  assert.deepEqual({ total: sim.total, acheteurs: sim.acheteurs, testeurs: sim.testeurs, aEnvoyer: sim.aEnvoyer }, { total: 2, acheteurs: 1, testeurs: 1, aEnvoyer: 2 });
  assert.equal(w.mails.length, 0, 'simulation : aucun envoi');
  // Test : les deux versions à une seule adresse
  assert.equal((await (await admin(w, '/annonce', { test: 'quentin@qme.fr', prenom: 'Quentin' })).json()).envoyes, 2);
  assert.deepEqual(w.mails.map((m) => m.a), ['quentin@qme.fr', 'quentin@qme.fr']);
  assert.ok(w.mails[0].objet.startsWith('[Test acheteur]') && w.mails[0].html.includes('/assets/mail/nouveautes-2026-11/espace.jpg') && w.mails[0].texte.startsWith('Bonjour Quentin,'));
  w.mails.length = 0;
  // Envoi par lots de 1, puis plus rien
  const l1 = await (await admin(w, '/annonce', { simulation: false, limite: 1 })).json();
  assert.equal(l1.envoyes, 1); assert.equal(l1.restants, 1);
  const l2 = await (await admin(w, '/annonce', { simulation: false })).json();
  assert.equal(l2.envoyes, 1); assert.equal(l2.restants, 0);
  assert.equal((await (await admin(w, '/annonce', { simulation: false })).json()).envoyes, 0, 'une seule fois par adresse');
  const acheteuse = w.mails.find((m) => m.a === 'camille@exemple.fr'), testeuse = w.mails.find((m) => m.a === 'lea@exemple.fr');
  assert.ok(acheteuse.texte.startsWith('Bonjour Camille,') && acheteuse.texte.includes('Ne plus recevoir les informations : https://qm-engineering.fr/api/compte/stop?e='));
  assert.ok(testeuse.texte.startsWith('Bonjour Léa,') && testeuse.texte.includes('Ne plus recevoir les informations : https://qm-engineering.fr/api/compte/stop?e='));
  assert.ok(acheteuse.html.includes('utm_campaign=nouveautes-2026-11'));
  // Désinscription de l'acheteuse : lien signé, puis plus d'annonce
  const stop = acheteuse.texte.match(/(https:\/\/qm-engineering\.fr\/api\/compte\/stop\?\S+)/)[1].replace('https://qm-engineering.fr', 'http://t');
  const faux = stop.replace(/s=.{4}/, 's=0000');
  assert.ok((await (await traiterCompte(new Request(faux), { secret: SECRET, store: w.store })).text()).includes('Lien invalide'));
  assert.ok((await (await traiterCompte(new Request(stop), { secret: SECRET, store: w.store })).text()).includes('C’est noté'));
  assert.ok((await w.store.get(cleCompte(SECRET, 'camille@exemple.fr'))).sansAnnonces);
  assert.equal((await (await admin(w, '/annonce', {})).json()).acheteurs, 0);
});

test('liste d\'opposition et registre : désinscription (annonce ou essai), nouveau consentement, export', async () => {
  const w = monde();
  const essai = (email, produit, nouveautes) => traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ consentement: true, email, prenom: 'Léa', produit, nouveautes }) }),
    { secret: SECRET, essais: w.store, envoyer: null, maintenant: () => w.t, ip: '1.2.3.4' });
  await essai('lea@exemple.fr', 'BDG', true);
  await essai('max@exemple.fr', 'TCH', false);
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'lea@exemple.fr', vente: { type: 'template', code: 'TCH' }, licence: LICENCE, maintenant: () => w.t });
  await ajouterAchat({ secret: SECRET, store: w.store, email: 'nina@exemple.fr', vente: { type: 'template', code: 'GNT' }, licence: LICENCE, nomComplet: 'Nina R', maintenant: () => w.t });
  const reg = async () => (await (await traiterCompte(new Request('http://t/api/compte/registre', { headers: { 'x-admin': ADMIN } }), { secret: SECRET, store: w.store })).json());
  assert.equal((await traiterCompte(new Request('http://t/api/compte/registre'), { secret: SECRET, store: w.store })).status, 401);
  let r = await reg();
  assert.deepEqual(r.lignes.map((l) => [l.email, l.profil, l.informations, l.achats.join(), l.essais.join()]), [
    ['lea@exemple.fr', 'acheteur et testeur', 'abonné', 'TCH', 'BDG'],
    ['max@exemple.fr', 'testeur', 'non inscrit', '', 'TCH'],
    ['nina@exemple.fr', 'acheteur', 'abonné', 'GNT', ''],
  ]);
  assert.ok(r.lignes[0].nouveautes);
  // Nina se désinscrit depuis une annonce ; Léa depuis un e-mail d'essai
  const { lienStopAnnonces } = await import('../../netlify/lib/comptes.mjs');
  const { lienDesinscription } = await import('../../netlify/lib/essais.mjs');
  await traiterCompte(new Request(lienStopAnnonces(SECRET, 'nina@exemple.fr').replace('https://qm-engineering.fr', 'http://t')), { secret: SECRET, store: w.store, maintenant: () => w.t });
  await traiterEssai(new Request(lienDesinscription(SECRET, 'lea@exemple.fr').replace('https://qm-engineering.fr', 'http://t')), { secret: SECRET, essais: w.store, maintenant: () => w.t });
  r = await reg();
  assert.deepEqual(r.lignes.map((l) => [l.email, l.informations, l.sourceDesinscription]), [
    ['lea@exemple.fr', 'désinscrit', 'lien des e-mails d\'essai'],
    ['max@exemple.fr', 'non inscrit', null],
    ['nina@exemple.fr', 'désinscrit', 'lien « Ne plus recevoir les informations »'],
  ]);
  assert.equal(r.desinscrits, 2);
  assert.equal(await w.store.get('contact/' + (await import('../../netlify/lib/templates-acces.mjs')).cleEmail(SECRET, 'lea@exemple.fr')), null, 'fiche nouveautés effacée');
  assert.equal((await (await admin(w, '/annonce', {})).json()).total, 0, 'aucune annonce aux opposants');
  // Nouveau consentement explicite : l'opposition de Léa est levée
  w.t += 86_400_000;
  await essai('lea@exemple.fr', 'RPS', true);
  r = await reg();
  assert.equal(r.lignes[0].informations, 'abonné');
  assert.equal((await (await admin(w, '/annonce', {})).json()).total, 1);
  // Export CSV
  const brut = new Uint8Array(await (await traiterCompte(new Request('http://t/api/compte/registre?format=csv', { headers: { 'x-admin': ADMIN } }), { secret: SECRET, store: w.store })).arrayBuffer());
  assert.deepEqual([...brut.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 (accents lisibles dans Excel)');
  const csv = new TextDecoder().decode(brut);
  assert.ok(csv.startsWith('email;prenom;profil;applications_achetees;essais;nouveautes_depuis;informations;desinscrit_le'));
  assert.ok(csv.includes('nina@exemple.fr;Nina;acheteur;GNT;;;désinscrit;'));
  // Purge : opposition gardée 3 ans
  const { purgerComptes: purge } = await import('../../netlify/lib/comptes.mjs');
  assert.equal((await purge({ store: w.store, maintenant: () => w.t + 365 * 86_400_000 })).oppositions, 0);
  assert.equal((await purge({ store: w.store, maintenant: () => w.t + 3 * 366 * 86_400_000 })).oppositions, 1);
});
