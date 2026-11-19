// Essai gratuit des templates « vie personnelle » : codes datés, lecture seule, report à l'achat, e-mails, effacement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiter, genererCodeEssai, verifierCodeEssai, verifierCode, etatEssai, codeDepuisLicence, ESSAI, PACKS, PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { traiterEssai, tournerEssais, PRODUITS_ESSAI, contenuMail, produitEssai, lienStop } from '../../netlify/lib/essais.mjs';
import { TEMPLATES } from '../../outils/packs/donnees.mjs';

const SECRET = 'x'.repeat(40);
const JOUR = 86_400_000;
const T0 = Date.parse('2026-11-19T10:00:00+01:00');
const memoire = () => {
  const m = new Map();
  return {
    m, get: async (c) => structuredClone(m.get(c) ?? null), set: async (c, v) => { m.set(c, structuredClone(v)); },
    supprimer: async (c) => { m.delete(c); }, lister: async (p) => [...m.keys()].filter((c) => c.startsWith(p)),
  };
};
const monde = () => ({ stockage: memoire(), essais: memoire(), mails: [], horloge: { t: T0 } });
const envoyeur = (w) => async (m) => { w.mails.push(m); };
const api = (w, methode, chemin, { corps, code, licence } = {}) => traiter(new Request(`http://t/api/templates${chemin}`, {
  method: methode, headers: code ? { 'x-code': code } : {}, body: corps ? JSON.stringify(corps) : undefined,
}), { secret: SECRET, stockage: w.stockage, essais: w.essais, maintenant: () => w.horloge.t, verifierLicence: licence });
const creer = async (w, corps, ip = '1.2.3.4') => {
  const r = await traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ consentement: true, ...corps }) }),
    { secret: SECRET, essais: w.essais, envoyer: envoyeur(w), maintenant: () => w.horloge.t, ip });
  return { statut: r.status, corps: await r.json() };
};

test('templates ouverts à l\'essai : les 29 « vie personnelle » en vente, payants', () => {
  assert.equal(PRODUITS_ESSAI.length, 29);
  for (const p of PRODUITS_ESSAI) {
    assert.equal(TEMPLATES[p].pour, 'perso');
    assert.ok(PRODUITS[p].gumroad && TEMPLATES[p].prix > 0 && TEMPLATES[p].permalien, p);
  }
  assert.ok(!PRODUITS_ESSAI.includes('SNT'), 'Secret Santa est gratuit');
  assert.ok(!PRODUITS_ESSAI.includes('GNT'), 'Gantt est professionnel');
  assert.equal(produitEssai('budget'), 'BDG');
  assert.equal(produitEssai('bdg'), 'BDG');
  assert.equal(produitEssai('gantt'), null);
});

test('code d\'essai : date inscrite dans le code, signature distincte des codes achetés', () => {
  const code = genererCodeEssai(SECRET, 'BDG', new Date(T0));
  assert.match(code, /^BDG-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const e = verifierCodeEssai(SECRET, code.toLowerCase().replace(/-/g, ' '));
  assert.deepEqual([e.debut, e.fin, e.effacement], ['2026-11-19', '2026-12-03', '2027-01-02']);
  assert.equal(verifierCode(SECRET, code), null, 'un code d\'essai n\'est pas un code acheté');
  // Changer la date (premiers caractères) invalide la signature : la durée ne se prolonge pas.
  const triche = code.slice(0, 4) + (code[4] === '0' ? '1' : '0') + code.slice(5);
  assert.equal(verifierCodeEssai(SECRET, triche), null);
  assert.equal(verifierCodeEssai('y'.repeat(40), code), null);
  assert.equal(verifierCodeEssai(SECRET, code, [e.id]), null, 'révocable comme les autres codes');
});

test('début à 23 h 30 heure de Paris : le jour de Paris compte', () => {
  const e = verifierCodeEssai(SECRET, genererCodeEssai(SECRET, 'BDG', new Date('2026-11-19T22:30:00Z')));
  assert.equal(e.debut, '2026-11-19');
});

test('états : actif 14 jours, lecture seule 30 jours, puis effacé', () => {
  const e = verifierCodeEssai(SECRET, genererCodeEssai(SECRET, 'BDG', new Date(T0)));
  assert.deepEqual([etatEssai(e, '2026-11-19').joursRestants, etatEssai(e, '2026-11-19').termine], [ESSAI.jours, false]);
  assert.equal(etatEssai(e, '2026-12-03').termine, false);
  assert.equal(etatEssai(e, '2026-12-04').termine, true);
  assert.equal(etatEssai(e, '2027-01-02').efface, false);
  assert.equal(etatEssai(e, '2027-01-03').efface, true);
});

test('création : code, e-mail de remerciement, un essai par adresse et par template', async () => {
  const w = monde();
  const r = await creer(w, { produit: 'budget', email: ' Marie@Exemple.fr ', prenom: 'Marie' });
  assert.equal(r.statut, 200);
  assert.equal(r.corps.produit, 'BDG');
  assert.equal(r.corps.mail, true);
  assert.equal(w.mails.length, 1);
  assert.equal(w.mails[0].a, 'marie@exemple.fr');
  assert.match(w.mails[0].objet, /Merci d'essayer « Budget du foyer »/);
  assert.ok(w.mails[0].texte.includes(r.corps.code));
  assert.ok(w.mails[0].texte.includes('Bonjour Marie,'));
  assert.ok(w.mails[0].texte.includes('jeudi 3 décembre'));
  assert.ok(w.mails[0].html.includes('Ne plus recevoir de rappel'));

  // Même adresse, même template : pas de nouveau code dans la réponse, renvoi par e-mail.
  const bis = await creer(w, { produit: 'BDG', email: 'marie@exemple.fr' });
  assert.equal(bis.statut, 409);
  assert.equal(bis.corps.code, undefined);
  assert.equal(w.mails.length, 2);
  assert.ok(w.mails[1].texte.includes(r.corps.code));
  // Autre template : nouvel essai.
  assert.equal((await creer(w, { produit: 'habitudes', email: 'marie@exemple.fr' })).statut, 200);
});

test('création refusée : template non ouvert, e-mail invalide, sans accord, robot, trop d\'essais par IP', async () => {
  const w = monde();
  assert.equal((await creer(w, { produit: 'gantt', email: 'a@b.fr' })).statut, 400);
  assert.equal((await creer(w, { produit: 'budget', email: 'pas-une-adresse' })).statut, 400);
  assert.equal((await creer(w, { produit: 'budget', email: 'a@b.fr', consentement: false })).statut, 400);
  assert.equal((await creer(w, { produit: 'budget', email: 'a@b.fr', site_web: 'http://spam' })).statut, 400);
  for (let i = 0; i < 5; i++) assert.equal((await creer(w, { produit: 'budget', email: `p${i}@b.fr` }, '9.9.9.9')).statut, 200);
  assert.equal((await creer(w, { produit: 'budget', email: 'p6@b.fr' }, '9.9.9.9')).statut, 429);
  assert.equal((await creer(w, { produit: 'budget', email: 'p6@b.fr' }, '8.8.8.8')).statut, 200);
});

test('sans boîte d\'envoi configurée, l\'essai fonctionne quand même', async () => {
  const w = monde();
  const r = await traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ produit: 'budget', email: 'a@b.fr', consentement: true }) }),
    { secret: SECRET, essais: w.essais, envoyer: null, maintenant: () => w.horloge.t });
  const corps = await r.json();
  assert.equal(r.status, 200);
  assert.equal(corps.mail, false);
});

test('pendant l\'essai : connexion, enregistrement, infos d\'essai ; après : lecture seule ; puis effacé', async () => {
  const w = monde();
  const { corps: { code } } = await creer(w, { produit: 'budget', email: 'a@b.fr' });
  const c = await (await api(w, 'POST', '/connexion', { corps: { code, produit: 'BDG' } })).json();
  assert.deepEqual([c.ok, c.produit, c.jeton, c.donnees], [true, 'BDG', code, null]);
  assert.equal(c.essai.joursRestants, 14);
  assert.equal(c.essai.termine, false);
  assert.equal(c.essai.prix, 1500);
  assert.equal(c.essai.achat, 'https://qmengineering.gumroad.com/l/budget-foyer');

  const p = await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 3 }, base: null } });
  assert.equal(p.status, 200);
  const { majLe } = await p.json();

  w.horloge.t = T0 + 15 * JOUR; // 4 décembre : essai terminé
  const g = await (await api(w, 'GET', '/donnees', { code })).json();
  assert.equal(g.donnees.mois, 3, 'les données restent lisibles');
  assert.equal(g.essai.termine, true);
  const refus = await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 4 }, base: majLe } });
  assert.equal(refus.status, 403);
  assert.equal((await refus.json()).essaiTermine, true);
  assert.equal((await (await api(w, 'POST', '/connexion', { corps: { code } })).json()).donnees.mois, 3);

  w.horloge.t = T0 + 45 * JOUR; // 3 janvier : effacé
  const fin = await api(w, 'POST', '/connexion', { corps: { code } });
  assert.equal(fin.status, 401);
  assert.match((await fin.json()).erreur, /effacées/);
});

test('code d\'essai authentique mais absent du registre : refusé', async () => {
  const w = monde();
  const code = genererCodeEssai(SECRET, 'BDG', new Date(T0));
  assert.equal((await api(w, 'POST', '/connexion', { corps: { code } })).status, 401);
});

const licenceDe = (produit, email) => async (gumroad) => (gumroad === PRODUITS[produit]?.gumroad || gumroad === PACKS[produit]?.gumroad
  ? { ok: true, achat: { email, price: 1500, currency: 'eur', variants: '', sale_timestamp: '2026-11-25T10:00:00Z' } }
  : { ok: false, raison: 'inconnue' });
const LICENCE = 'ABCDEF01-23456789-ABCDEF01-23456789';

test('achat avec la clé saisie dans l\'application : données d\'essai reprises, essai clos', async () => {
  const w = monde();
  const { corps: { code } } = await creer(w, { produit: 'budget', email: 'essai@b.fr' });
  await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 3 } } });
  w.horloge.t = T0 + 20 * JOUR; // achat pendant la lecture seule, avec une autre adresse que celle de l'essai
  const r = await (await api(w, 'POST', '/connexion', { corps: { code: LICENCE, produit: 'BDG', essai: code }, licence: licenceDe('BDG', 'autre@b.fr') })).json();
  assert.equal(r.produit, 'BDG');
  assert.equal(r.donnees.mois, 3);
  assert.equal(r.essai, undefined, 'espace acheté : plus d\'essai');
  // Même espace qu'à toute connexion future avec la clé.
  assert.equal(r.jeton, codeDepuisLicence(SECRET, 'BDG', LICENCE));
  const reg = (await w.essais.get(`essai/${verifierCodeEssai(SECRET, code).id}`));
  assert.ok(reg.achete && reg.reporte);
  // Le code d'essai renvoie maintenant vers la clé.
  const vieux = await api(w, 'POST', '/connexion', { corps: { code } });
  assert.equal(vieux.status, 401);
  assert.match((await vieux.json()).erreur, /clé de licence/);
});

test('achat sur un autre appareil : reprise par l\'e-mail de l\'achat Gumroad', async () => {
  const w = monde();
  const { corps: { code } } = await creer(w, { produit: 'budget', email: 'Essai@b.fr' });
  await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 7 } } });
  const r = await (await api(w, 'POST', '/connexion', { corps: { code: LICENCE, produit: 'BDG' }, licence: licenceDe('BDG', 'essai@B.fr') })).json();
  assert.equal(r.donnees.mois, 7);
});

test('achat : rien n\'est écrasé si l\'espace acheté contient déjà des données', async () => {
  const w = monde();
  const { corps: { code } } = await creer(w, { produit: 'budget', email: 'essai@b.fr' });
  await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 3 } } });
  const jeton = codeDepuisLicence(SECRET, 'BDG', LICENCE);
  await api(w, 'PUT', '/donnees', { code: jeton, corps: { donnees: { mois: 99 } } });
  const r = await (await api(w, 'POST', '/connexion', { corps: { code: LICENCE, produit: 'BDG', essai: code }, licence: licenceDe('BDG', 'x@b.fr') })).json();
  assert.equal(r.donnees.mois, 99);
});

test('achat d\'un pack : le template du pack reprend l\'essai', async () => {
  const w = monde();
  const pack = Object.keys(PACKS).find((p) => PACKS[p].gumroad && PACKS[p].produits.includes('HBT'));
  const { corps: { code } } = await creer(w, { produit: 'habitudes', email: 'pack@b.fr' });
  await api(w, 'PUT', '/donnees', { code, corps: { donnees: { routines: 2 } } });
  const r = await (await api(w, 'POST', '/connexion', { corps: { code: LICENCE }, licence: licenceDe(pack, 'pack@b.fr') })).json();
  const hbt = r.templates.find((t) => t.produit === 'HBT');
  assert.ok(hbt, `pack ${pack} : HBT ouvert`);
  const d = await (await api(w, 'GET', '/donnees', { code: hbt.code })).json();
  assert.equal(d.donnees.routines, 2);
});

test('tâche quotidienne : rappel J-3, fin, avant effacement, effacement ; rien après achat ou arrêt', async () => {
  const w = monde();
  const tourner = () => tournerEssais({ secret: SECRET, essais: w.essais, stockage: w.stockage, envoyer: envoyeur(w), maintenant: () => w.horloge.t });
  const { corps: { code } } = await creer(w, { produit: 'budget', email: 'a@b.fr' });
  const { corps: { code: code2 } } = await creer(w, { produit: 'habitudes', email: 'stop@b.fr' });
  await api(w, 'PUT', '/donnees', { code, corps: { donnees: { mois: 1 } } });
  const id2 = verifierCodeEssai(SECRET, code2).id;
  // Arrêt des rappels par le lien signé (le lien d'un autre essai ne marche pas).
  const stop = new URL(lienStop(SECRET, id2));
  assert.equal((await traiterEssai(new Request(`http://t${stop.pathname}${stop.search.replace(/s=[0-9a-f]+/, 's=' + '0'.repeat(24))}`), { secret: SECRET, essais: w.essais })).status, 400);
  assert.equal((await traiterEssai(new Request(`http://t${stop.pathname}${stop.search}`), { secret: SECRET, essais: w.essais })).status, 200);
  w.mails.length = 0;

  const types = async (jours) => { w.horloge.t = T0 + jours * JOUR; w.mails.length = 0; await tourner(); return w.mails.map((m) => m.objet); };
  assert.deepEqual(await types(1), []);
  assert.deepEqual(await types(11), ['Plus que 3 jours d\'essai : Budget du foyer']);
  assert.deepEqual(await types(12), [], 'pas deux fois');
  assert.deepEqual(await types(15), ['Votre essai gratuit est terminé : Budget du foyer']);
  assert.deepEqual(await types(37), ['Vos données d\'essai seront effacées le 2 janvier']);
  assert.deepEqual(await types(44), []);
  assert.ok(w.stockage.m.size === 1);
  const bilan = (w.horloge.t = T0 + 45 * JOUR, await tourner());
  assert.equal(bilan.effaces, 2);
  assert.equal(w.stockage.m.size, 0, 'données d\'essai effacées');
  assert.deepEqual(await w.essais.lister('essai/'), []);
  assert.deepEqual(await w.essais.lister('email/'), []);
  // Une fois effacé, la même adresse peut relancer un essai.
  assert.equal((await creer(w, { produit: 'budget', email: 'a@b.fr' })).statut, 200);
});

test('tâche quotidienne : rattrapage d\'une journée manquée, un seul e-mail par jour', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'a@b.fr' });
  w.mails.length = 0;
  w.horloge.t = T0 + 16 * JOUR; // rappel J-3 jamais parti (tâche en panne) puis fin d'essai
  await tournerEssais({ secret: SECRET, essais: w.essais, stockage: w.stockage, envoyer: envoyeur(w), maintenant: () => w.horloge.t });
  assert.deepEqual(w.mails.map((m) => m.objet), ['Votre essai gratuit est terminé : Budget du foyer']);
});

test('e-mails : chaque type se construit pour chaque template, sans texte vide', () => {
  for (const produit of PRODUITS_ESSAI) {
    const reg = { id: 'ABC', produit, code: `${produit}-AAAA-AAAA-AAAA-AAAA`, prenom: '', debut: '2026-11-19', fin: '2026-12-03', effacement: '2027-01-02' };
    for (const type of ['merci', 'renvoi', 'rappel', 'fin', 'effacement']) {
      const m = contenuMail(type, reg, SECRET);
      assert.ok(m.objet && m.texte.length > 200 && !/undefined|NaN|null/.test(m.texte + m.objet), `${produit} ${type}`);
      assert.ok(m.texte.includes('https://qmengineering.gumroad.com/l/'), `${produit} ${type} : lien d'achat`);
    }
  }
});

// ---------- Base de contacts « Nouveautés QME » (case facultative, 19/11/2026) ----------
import { lienDesinscription } from '../../netlify/lib/essais.mjs';
import { codeAdmin } from '../../netlify/lib/interets.mjs';

const adminApi = (w, methode, chemin, code = codeAdmin(SECRET)) => traiterEssai(new Request(`http://t/api/essai${chemin}`, {
  method: methode, headers: code ? { 'x-admin': code } : {},
}), { secret: SECRET, essais: w.essais, maintenant: () => w.horloge.t });

test('nouveautés : case non cochée, aucun contact ; cochée, contact enregistré une seule fois', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'sans@b.fr' });
  await creer(w, { produit: 'budget', email: 'faux@b.fr', nouveautes: 'oui' }); // seule la valeur true compte
  assert.deepEqual(await w.essais.lister('contact/'), []);
  await creer(w, { produit: 'budget', email: 'Avec@B.fr', prenom: 'Lou', nouveautes: true });
  await creer(w, { produit: 'habitudes', email: 'avec@b.fr', nouveautes: true });
  const cles = await w.essais.lister('contact/');
  assert.equal(cles.length, 1);
  const c = await w.essais.get(cles[0]);
  assert.deepEqual([c.email, c.prenom, c.templates], ['avec@b.fr', 'Lou', ['budget', 'habitudes']]);
  assert.match(c.texte, /nouveautés QME/);
});

test('nouveautés : export réservé à l\'administrateur, CSV avec lien de désinscription, effacement', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'a@b.fr', prenom: 'Ana; Lou', nouveautes: true });
  assert.equal((await adminApi(w, 'GET', '/contacts', null)).status, 401);
  assert.equal((await adminApi(w, 'GET', '/contacts', 'ADM-FAUX-FAUX-FAUX-FAUX')).status, 401);
  const j = await (await adminApi(w, 'GET', '/contacts')).json();
  assert.deepEqual([j.total, j.trenteJours, j.contacts[0].email], [1, 1, 'a@b.fr']);
  const octets = new Uint8Array(await (await adminApi(w, 'GET', '/contacts?format=csv')).arrayBuffer());
  assert.deepEqual([...octets.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 : accents lus correctement par Excel');
  const csv = new TextDecoder().decode(octets);
  assert.ok(csv.startsWith('email;prenom;templates_essayes;consentement_le;dernier_echange;lien_desinscription'));
  assert.ok(csv.includes(';"Ana; Lou";'), 'cellule contenant un point-virgule mise entre guillemets');
  assert.ok(csv.includes(lienDesinscription(SECRET, 'a@b.fr')));
  const eff = await (await adminApi(w, 'DELETE', '/contacts?email=A@b.fr')).json();
  assert.equal(eff.effaces, 1);
  assert.deepEqual(await w.essais.lister('contact/'), []);
});

test('nouveautés : désinscription en un clic par lien signé', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'a@b.fr', nouveautes: true });
  const lien = new URL(lienDesinscription(SECRET, 'a@b.fr'));
  const faux = await traiterEssai(new Request(`http://t${lien.pathname}${lien.search.replace(/s=[0-9a-f]+/, 's=' + '0'.repeat(24))}`), { secret: SECRET, essais: w.essais });
  assert.equal(faux.status, 400);
  assert.equal((await w.essais.lister('contact/')).length, 1);
  const ok = await traiterEssai(new Request(`http://t${lien.pathname}${lien.search}`), { secret: SECRET, essais: w.essais });
  assert.equal(ok.status, 200);
  assert.deepEqual(await w.essais.lister('contact/'), []);
});

test('nouveautés : lien de désinscription dans les e-mails d\'essai des seuls inscrits', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'oui@b.fr', nouveautes: true });
  await creer(w, { produit: 'budget', email: 'non@b.fr' });
  const [oui, non] = w.mails;
  assert.ok(oui.texte.includes(lienDesinscription(SECRET, 'oui@b.fr')) && oui.html.includes('se désinscrire'));
  assert.ok(!non.texte.includes('/api/essai/desinscription') && !non.html.includes('se désinscrire'));
});

test('nouveautés : contact effacé 3 ans après le dernier échange', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'a@b.fr', nouveautes: true });
  const tourner = () => tournerEssais({ secret: SECRET, essais: w.essais, stockage: w.stockage, envoyer: envoyeur(w), maintenant: () => w.horloge.t });
  w.horloge.t = T0 + 364 * 3 * JOUR;
  await tourner();
  assert.equal((await w.essais.lister('contact/')).length, 1);
  w.horloge.t = T0 + (365 * 3 + 1) * JOUR;
  const bilan = await tourner();
  assert.equal(bilan.contactsEffaces, 1);
  assert.deepEqual(await w.essais.lister('contact/'), []);
});
