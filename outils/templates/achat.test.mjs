// E-mail de remerciement après un achat Gumroad (ping /api/achat) : achat direct ou après essai, template ou pack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traiter, verifierCodeEssai, PACKS, PRODUITS, cleEmail } from '../../netlify/lib/templates-acces.mjs';
import { traiterEssai, tournerEssais } from '../../netlify/lib/essais.mjs';
import { traiterAchat, contenuMailAchat, produitVendu, contenuMailSuivi, tournerSuivisAchat, SUIVI_ACHAT } from '../../netlify/lib/achats.mjs';
import { optionsEnvoi, COPIE_CACHEE } from '../../netlify/lib/mail.mjs';
import { codeAdmin } from '../../netlify/lib/interets.mjs';
import { PRISE_EN_MAIN } from '../../netlify/lib/essais-prise-en-main.mjs';

const SECRET = 'x'.repeat(40);
const JOUR = 86_400_000;
const T0 = Date.parse('2026-11-19T10:00:00+01:00');
const LICENCE = 'ABCDEF01-23456789-ABCDEF01-23456789';
const memoire = () => {
  const m = new Map();
  return {
    m, get: async (c) => structuredClone(m.get(c) ?? null), set: async (c, v) => { m.set(c, structuredClone(v)); },
    supprimer: async (c) => { m.delete(c); }, lister: async (p) => [...m.keys()].filter((c) => c.startsWith(p)),
  };
};
const monde = () => ({ stockage: memoire(), essais: memoire(), mails: [], horloge: { t: T0 } });
const envoyeur = (w) => async (m) => { w.mails.push(m); };
const licenceDe = (produit, email, extra = {}) => async (gumroad) => (gumroad === PRODUITS[produit]?.gumroad || gumroad === PACKS[produit]?.gumroad
  ? { ok: true, achat: { email, price: 1200, currency: 'eur', ...extra } } : { ok: false, raison: 'inconnue' });
const creer = (w, corps) => traiterEssai(new Request('http://t/api/essai', { method: 'POST', body: JSON.stringify({ consentement: true, ...corps }) }),
  { secret: SECRET, essais: w.essais, envoyer: envoyeur(w), maintenant: () => w.horloge.t, ip: '1.2.3.4' }).then((r) => r.json());
const ping = (w, produit, verifier, { envoyer = envoyeur(w), nom = '', licence = LICENCE } = {}) => traiterAchat(new Request('http://t/api/achat', {
  method: 'POST', body: new URLSearchParams({ product_id: PRODUITS[produit]?.gumroad || PACKS[produit]?.gumroad || 'inconnu', license_key: licence, email: 'ping@ignore.fr', full_name: nom }),
}), { secret: SECRET, essais: w.essais, envoyer, notifier: 'quentin@qme.fr', maintenant: () => w.horloge.t, verifierLicence: verifier });
const pourAcheteur = (w) => w.mails.filter((m) => m.a !== 'quentin@qme.fr');

test('achat direct d\'un template : remerciement, connexion, premier pas, une seule fois', async () => {
  const w = monde();
  const r = await (await ping(w, 'PGS', licenceDe('PGS', 'lea@b.fr'), { nom: 'léa Martin' })).json();
  assert.equal(r.mail, 'achat-direct');
  const [m] = pourAcheteur(w);
  assert.equal(m.a, 'lea@b.fr', 'adresse renvoyée par Gumroad, pas celle du ping');
  assert.equal(m.objet, 'Merci pour votre achat : Suivi de lecture');
  assert.ok(m.texte.startsWith('Bonjour Léa,'));
  assert.ok(m.texte.includes('https://qm-engineering.fr/connexion/') && m.texte.includes(PRISE_EN_MAIN.PGS.commencer));
  assert.ok(m.html.includes('assets/signature/qme-logo.png') && !m.html.includes('Ne plus recevoir de rappel'));
  for (const [, href] of m.html.matchAll(/href="([^"]+)"/g)) assert.ok(!/[.,;:!?)]$/.test(href), href);
  const notif = w.mails.find((x) => x.a === 'quentin@qme.fr');
  assert.equal(notif.objet, 'Nouvelle vente : Suivi de lecture · directe');
  w.mails.length = 0;
  assert.equal((await (await ping(w, 'PGS', licenceDe('PGS', 'lea@b.fr'))).json()).deja, true);
  assert.deepEqual(w.mails, [], 'ping renvoyé par Gumroad : rien de plus');
});

test('achat après essai : remerciement dédié, séquence d\'essai arrêtée, données toujours reprises à la saisie de la clé', async () => {
  const w = monde();
  const { code } = await creer(w, { produit: 'lecture', email: 'Flow@b.fr', prenom: 'Flow' });
  await traiter(new Request('http://t/api/templates/donnees', { method: 'PUT', headers: { 'x-code': code }, body: JSON.stringify({ donnees: { livres: 4 } }) }),
    { secret: SECRET, stockage: w.stockage, essais: w.essais, maintenant: () => w.horloge.t });
  w.mails.length = 0;
  w.horloge.t = T0 + 5 * JOUR;
  const r = await (await ping(w, 'PGS', licenceDe('PGS', 'flow@b.fr'))).json();
  assert.equal(r.mail, 'achat-essai');
  const [m] = pourAcheteur(w);
  assert.equal(m.objet, 'Merci : « Suivi de lecture » est à vous');
  assert.ok(m.texte.startsWith('Bonjour Flow,') && m.texte.includes('J\'ai acheté') && m.texte.includes(`?essai=${code}`));
  assert.ok(!m.texte.includes('gardées jusqu'), 'essai encore en cours : pas de date limite');
  assert.equal(w.mails.find((x) => x.a === 'quentin@qme.fr').objet, 'Nouvelle vente : Suivi de lecture · après essai');
  // Séquence d'essai arrêtée : plus de rappel J-3 ni de fin.
  for (const j of [11, 15, 37]) {
    w.mails.length = 0; w.horloge.t = T0 + j * JOUR;
    await tournerEssais({ secret: SECRET, essais: w.essais, stockage: w.stockage, envoyer: envoyeur(w), maintenant: () => w.horloge.t });
    assert.deepEqual(w.mails, [], `jour ${j}`);
  }
  // La clé saisie plus tard reprend toujours les données de l'essai.
  w.horloge.t = T0 + 6 * JOUR;
  const c = await (await traiter(new Request('http://t/api/templates/connexion', { method: 'POST', body: JSON.stringify({ code: LICENCE, produit: 'PGS', essai: code }) }),
    { secret: SECRET, stockage: w.stockage, essais: w.essais, maintenant: () => w.horloge.t, verifierLicence: licenceDe('PGS', 'flow@b.fr') })).json();
  assert.equal(c.donnees.livres, 4);
});

test('achat après la fin de l\'essai : date limite de reprise rappelée ; après effacement : achat direct', async () => {
  const w = monde();
  await creer(w, { produit: 'budget', email: 'a@b.fr' });
  w.horloge.t = T0 + 20 * JOUR; w.mails.length = 0;
  await ping(w, 'BDG', licenceDe('BDG', 'a@b.fr'));
  assert.match(pourAcheteur(w)[0].texte, /gardées jusqu'au samedi 2 janvier/);
  const w2 = monde();
  await creer(w2, { produit: 'budget', email: 'a@b.fr' });
  w2.horloge.t = T0 + 50 * JOUR; // essai effacé par la tâche quotidienne, ou au-delà de sa date
  w2.mails.length = 0;
  assert.equal((await (await ping(w2, 'BDG', licenceDe('BDG', 'a@b.fr'))).json()).mail, 'achat-direct');
});

test('pack : liste de ses templates en achat direct ; après l\'essai d\'un de ses templates, e-mail d\'essai', async () => {
  const w = monde();
  await ping(w, 'PET', licenceDe('PET', 'e@b.fr'));
  const [m] = pourAcheteur(w);
  assert.equal(m.objet, `Merci pour votre achat : ${PACKS.PET.nom}`);
  for (const p of produitVendu(PACKS.PET.gumroad).produits) assert.ok(m.texte.includes(`– ${PRODUITS[p].nom}`), p);
  const w2 = monde();
  await creer(w2, { produit: 'lecture', email: 'e@b.fr' });
  w2.mails.length = 0;
  await ping(w2, 'PET', licenceDe('PET', 'e@b.fr'));
  const [m2] = pourAcheteur(w2);
  assert.equal(m2.objet, `Merci : ${PACKS.PET.nom} est à vous`);
  assert.ok(m2.texte.includes('votre essai de « Suivi de lecture »'));
});

test('rien pour une licence inconnue, remboursée ou un produit étranger ; échec d\'envoi : 500 et vente non marquée', async () => {
  const w = monde();
  await ping(w, 'PGS', async () => ({ ok: false, raison: 'rembourse' }));
  await ping(w, 'PGS', async () => ({ ok: false, raison: 'inconnue' }));
  await ping(w, 'ZZZ', licenceDe('PGS', 'a@b.fr'));
  assert.deepEqual(w.mails, []);
  assert.deepEqual(await w.essais.lister('achat/'), []);
  const panne = async () => { throw new Error('SMTP'); };
  assert.equal((await ping(w, 'PGS', licenceDe('PGS', 'a@b.fr'), { envoyer: panne })).status, 500);
  assert.deepEqual(await w.essais.lister('achat/'), [], 'Gumroad renverra le ping');
  assert.equal((await ping(w, 'PGS', licenceDe('PGS', 'a@b.fr'))).status, 200);
});

test('e-mails d\'achat : construits pour chaque template et pack en vente, sans texte vide', () => {
  const aujourdhui = '2026-11-25';
  const ventes = [...Object.keys(PRODUITS).filter((p) => PRODUITS[p].gumroad).map((p) => produitVendu(PRODUITS[p].gumroad)),
    ...Object.keys(PACKS).filter((k) => PACKS[k].gumroad).map((k) => produitVendu(PACKS[k].gumroad))];
  assert.ok(ventes.length > 40);
  for (const vente of ventes) {
    const m = contenuMailAchat({ vente, aujourdhui });
    assert.ok(m.objet && m.texte.length > 300 && !/undefined|NaN|null/.test(m.texte + m.objet), vente.code);
  }
});

test('e-mail d\'achat direct : « Pour les ouvrir » (pack) et « Pour l\'ouvrir » (template), espaces justes', () => {
  const pack = contenuMailAchat({ vente: produitVendu(PACKS.PET.gumroad), aujourdhui: '2026-12-28' });
  assert.match(pack.texte, /Pour les ouvrir : /);
  assert.doesNotMatch(pack.texte, /lesouvrir/);
  const seul = contenuMailAchat({ vente: produitVendu(PRODUITS.NTS.gumroad), aujourdhui: '2026-12-28' });
  assert.match(seul.texte, /Pour l'ouvrir : /);
  // Aucun mot collé à un autre par une interpolation, pour tous les produits en vente.
  for (const vente of [...Object.keys(PRODUITS).filter((p) => PRODUITS[p].gumroad).map((p) => produitVendu(PRODUITS[p].gumroad)),
    ...Object.keys(PACKS).filter((k) => PACKS[k].gumroad).map((k) => produitVendu(PACKS[k].gumroad))]) {
    assert.doesNotMatch(contenuMailAchat({ vente, aujourdhui: '2026-12-28' }).texte, /\b(les|des|ses)(ouvrir|templates?)\b/, vente.code);
  }
});

// Accompagnement après achat (24/11/2026) : un e-mail J+3, template ou pack, puis plus rien.
const tournee = (w, j) => { w.horloge.t = T0 + j * JOUR; return tournerSuivisAchat({ secret: SECRET, essais: w.essais, envoyer: envoyeur(w), maintenant: () => w.horloge.t }); };

test('accompagnement d\'un template : J+3, une seule fois, file effacée ; notification avec la date prévue', async () => {
  const w = monde();
  await ping(w, 'BDG', licenceDe('BDG', 'flo@b.fr'), { nom: 'Floriane J' });
  assert.ok(w.mails.find((x) => x.a === 'quentin@qme.fr').texte.includes('Accompagnement prévu le dimanche 22 novembre'));
  assert.equal((await w.essais.lister('suivi-achat/')).length, 1);
  w.mails.length = 0;
  assert.equal((await tournee(w, 2)).envoyes, 0);
  assert.deepEqual(w.mails, [], 'pas avant J+3');
  assert.equal((await tournee(w, SUIVI_ACHAT.jours)).envoyes, 1);
  const [m] = w.mails;
  assert.equal(m.a, 'flo@b.fr');
  assert.equal(m.objet, 'Mon Budget : tout se passe bien ?');
  assert.ok(m.texte.startsWith('Bonjour Floriane,') && m.texte.includes('le jeudi 19 novembre'));
  assert.ok(m.texte.includes(PRISE_EN_MAIN.BDG.astuces[0]) && m.texte.includes('https://qm-engineering.fr/connexion/'));
  assert.ok(m.html.includes('assets/signature/qme-logo.png') && m.copieCachee !== false, 'signature graphique, copie cachée gardée');
  const [cle] = await w.essais.lister('suivi-achat/');
  assert.ok((await w.essais.get(cle)).envoye, 'gardé pour /admin/suivi/ avec sa date d\'envoi');
  w.mails.length = 0;
  await tournee(w, 4);
  assert.deepEqual(w.mails, [], 'une seule fois');
  // Vu dans l'API du suivi, puis effacé 30 jours après l'envoi.
  const api = await (await traiterEssai(new Request('http://t/api/essai/essais', { headers: { 'x-admin': codeAdmin(SECRET) } }),
    { secret: SECRET, essais: w.essais, maintenant: () => w.horloge.t })).json();
  assert.equal(api.accompagnements.length, 1);
  assert.equal(api.accompagnements[0].produit, 'Mon Budget');
  assert.equal(api.accompagnements[0].objet, 'Mon Budget : tout se passe bien ?');
  assert.equal((await tournee(w, 3 + SUIVI_ACHAT.conservation)).purges, 0);
  assert.equal((await tournee(w, 4 + SUIVI_ACHAT.conservation)).purges, 1);
  assert.deepEqual(await w.essais.lister('suivi-achat/'), []);
});

test('accompagnement d\'un pack : ses templates, par lequel commencer ; aussi après un essai', async () => {
  const w = monde();
  await creer(w, { produit: 'lecture', email: 'e@b.fr', prenom: 'Eva' });
  await ping(w, 'PET', licenceDe('PET', 'e@b.fr'));
  w.mails.length = 0;
  await tournee(w, 3);
  const [m] = w.mails;
  assert.equal(m.objet, `Par où continuer avec le ${PACKS.PET.nom}`);
  assert.ok(m.texte.startsWith('Bonjour Eva,'));
  for (const p of produitVendu(PACKS.PET.gumroad).produits) assert.ok(m.texte.includes(`– ${PRODUITS[p].nom}`), p);
  assert.match(m.texte, /prenez « [^»]+ »\. Pour démarrer/);
  assert.ok(m.texte.includes('acheté un pack QME') && m.html.includes('acheté un pack QME'));
  // Nom puis description séparés par un point : ni majuscule après « : » ni deux « : » sur une ligne.
  for (const l of m.texte.split('\n').filter((x) => x.startsWith('– '))) {
    assert.doesNotMatch(l, /: \p{Lu}/u, l);
    assert.ok((l.match(/ : /g) || []).length <= 1, l);
  }
});

test('accompagnement : rien pour une adresse sur la liste d\'opposition ; file périmée effacée sans envoi ; panne retentée', async () => {
  const w = monde();
  await ping(w, 'PGS', licenceDe('PGS', 'non@b.fr'));
  await w.essais.set(`opposition/${cleEmail(SECRET, 'non@b.fr')}`, { date: '2026-11-20', source: 'test' });
  w.mails.length = 0;
  assert.equal((await tournee(w, 3)).opposition, 1);
  assert.deepEqual(w.mails, []);
  assert.deepEqual(await w.essais.lister('suivi-achat/'), []);

  const w2 = monde();
  await ping(w2, 'PGS', licenceDe('PGS', 'tard@b.fr'));
  w2.mails.length = 0;
  assert.equal((await tournee(w2, SUIVI_ACHAT.jours + SUIVI_ACHAT.rattrapage + 1)).expires, 1);
  assert.deepEqual(w2.mails, [], 'trop tard : rien');

  const w3 = monde();
  await ping(w3, 'PGS', licenceDe('PGS', 'a@b.fr'));
  w3.horloge.t = T0 + 3 * JOUR;
  const r = await tournerSuivisAchat({ secret: SECRET, essais: w3.essais, envoyer: async () => { throw new Error('SMTP'); }, maintenant: () => w3.horloge.t });
  assert.equal(r.erreurs, 1);
  assert.ok(!(await w3.essais.get((await w3.essais.lister('suivi-achat/'))[0])).envoye);
  w3.mails.length = 0;
  assert.equal((await tournee(w3, 4)).envoyes, 1, 'renvoyé le lendemain');
});

test('e-mails d\'accompagnement : construits pour chaque template et pack en vente, sans texte vide', () => {
  const codes = [...Object.keys(PRODUITS).filter((p) => PRODUITS[p].gumroad).map((code) => ({ type: 'template', code })),
    ...Object.keys(PACKS).filter((k) => PACKS[k].gumroad).map((code) => ({ type: 'pack', code }))];
  assert.ok(codes.length > 40);
  for (const c of codes) {
    const m = contenuMailSuivi({ ...c, achat: '2026-11-24' });
    assert.ok(m.objet && m.texte.length > 300 && !/undefined|NaN|null|: :|\.\./.test(m.texte + m.objet), c.code);
  }
});

test('copie cachée : Quentin (adresse pro) sur les séquences, jamais sur un code de connexion ni en double', () => {
  const de = 'QME <quentin.morel@qm-engineering.fr>';
  const msg = { a: 'client@b.fr', objet: 'o', texte: 't', html: 'h' };
  assert.equal(COPIE_CACHEE, 'quentin.morel@qm-engineering.fr');
  assert.equal(optionsEnvoi(msg, { de, env: {} }).bcc, COPIE_CACHEE);
  assert.equal(optionsEnvoi({ ...msg, copieCachee: false }, { de, env: {} }).bcc, undefined);
  assert.equal(optionsEnvoi({ ...msg, a: 'Quentin.Morel@qm-engineering.fr' }, { de, env: {} }).bcc, undefined);
  assert.equal(optionsEnvoi(msg, { de, env: { ESSAI_COPIE_CACHEE: 'non' } }).bcc, undefined);
  assert.equal(optionsEnvoi(msg, { de, env: { ESSAI_COPIE_CACHEE: 'autre@qme.fr' } }).bcc, 'autre@qme.fr');
  const o = optionsEnvoi(msg, { de, env: {} });
  assert.deepEqual([o.from, o.replyTo, o.to, o.subject, o.text, o.html], [de, de, 'client@b.fr', 'o', 't', 'h']);
});
