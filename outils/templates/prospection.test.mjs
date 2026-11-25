// Campagnes ciblées de prospection (netlify/lib/prospection.mjs) : fenêtre, quota, opposition, fil de relance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composer, dansFenetre, horlogeParis, envoyerSuivant, mettreEnFile, traiterProspection } from '../../netlify/lib/prospection.mjs';
import { cleEmail } from '../../netlify/lib/templates-acces.mjs';

const SECRET = 'x'.repeat(40);
const ADMIN = 'code-admin-de-test-0123456789';
const memoire = () => {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null), set: async (k, v) => { m.set(k, structuredClone(v)); },
    supprimer: async (k) => { m.delete(k); }, lister: async (p) => [...m.keys()].filter((k) => k.startsWith(p)) };
};
const TEXTE = 'Bonjour,\n\nJe suis Quentin Morel. Voici un outil prêt à l\'emploi pour les auto-écoles : https://qm-engineering.fr/concepts/auto-ecole/ et je peux l\'adapter sur mesure.';
// Mardi 1er décembre 2026, 10:00 à Paris (9:00 UTC).
const MARDI_10H = Date.parse('2026-12-01T09:00:00Z');
const appel = (store, chemin, corps, maintenant = () => MARDI_10H) => traiterProspection(new Request(`https://qm-engineering.fr/api/prospection${chemin}`, {
  method: corps ? 'POST' : 'GET', headers: { 'x-admin': ADMIN, 'content-type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined,
}), { secret: SECRET, store, admin: ADMIN, maintenant }).then((r) => r.json());

test('fenêtre : lundi–samedi, 8 h–18 h à Paris, été comme hiver', () => {
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-01T06:59:00Z'))), false); // 7:59 hiver
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-01T07:00:00Z'))), true); // 8:00 hiver
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-01T16:48:00Z'))), true); // 17:48
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-01T17:00:00Z'))), false); // 18:00
  assert.equal(dansFenetre(horlogeParis(new Date('2027-06-01T06:00:00Z'))), true); // 8:00 été
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-05T09:00:00Z'))), true); // samedi
  assert.equal(dansFenetre(horlogeParis(new Date('2026-12-06T09:00:00Z'))), false); // dimanche
});

test('composer : signature graphique et mention d\'opposition encodée', () => {
  const m = composer({ email: 'Contact+ae@Exemple.fr', objet: 'Objet', texte: TEXTE });
  assert.match(m.texte, /Quentin Morel\nQM Engineering/);
  assert.match(m.texte, /ne-plus-recevoir\/\?email=contact%2Bae%40exemple\.fr/);
  assert.match(m.html, /assets\/signature\/qme-logo\.png/);
  assert.match(m.html, /Ne plus recevoir les informations/);
});

test('file : refuse doublons, opposition, mention manuelle ; envoie un mail par passage, en copie cachée', async () => {
  const store = memoire();
  await store.set(`opposition/${cleEmail(SECRET, 'stop@ecole.fr')}`, { date: '2026-11-01', source: 'test' });
  await appel(store, '/campagne', { id: 'auto-ecole', nom: 'Auto-écoles', pause: false });
  const r = await appel(store, '/file', { campagne: 'auto-ecole', messages: [
    { id: 'a1', email: 'contact@a.fr', objet: 'Objet A', texte: TEXTE },
    { id: 'a2', email: 'CONTACT@a.fr', objet: 'Objet A bis', texte: TEXTE },
    { id: 'a3', email: 'stop@ecole.fr', objet: 'Objet', texte: TEXTE },
    { id: 'a4', email: 'b@b.fr', objet: 'Objet', texte: `${TEXTE} https://qm-engineering.fr/ne-plus-recevoir/` },
  ] });
  assert.deepEqual(r.ajoutes, ['a1']);
  assert.deepEqual(r.refuses.map((x) => x.id), ['a2', 'a3', 'a4']);
  const envois = [];
  const envoyer = async (m) => { envois.push(m); };
  const r1 = await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => MARDI_10H });
  assert.equal(r1.statut, 'envoye');
  assert.equal(envois[0].copieCachee, true);
  assert.match(envois[0].messageId, /@qm-engineering\.fr>$/);
  assert.equal((await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => MARDI_10H })).statut, 'rien-a-envoyer');
  assert.equal((await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => Date.parse('2026-12-06T09:00:00Z') })).statut, 'hors-fenetre');
});

test('opposition inscrite après la mise en file : écarté, jamais envoyé', async () => {
  const store = memoire();
  await appel(store, '/campagne', { id: 'c', pause: false });
  await appel(store, '/file', { campagne: 'c', messages: [{ id: 'x1', email: 'contact@x.fr', objet: 'O', texte: TEXTE }] });
  await store.set('opposition-domaine/x.fr', { domaine: 'x.fr', date: '2026-11-30' });
  const envois = [];
  const r = await envoyerSuivant({ store, secret: SECRET, envoyer: async (m) => envois.push(m), maintenant: () => MARDI_10H });
  assert.equal(r.statut, 'rien-a-envoyer');
  assert.equal(envois.length, 0);
  assert.equal((await store.get('prospection/fait/c/x1')).statut, 'ecarte');
});

test('sans plafond global ; plafond facultatif par campagne, effaçable ; pause', async () => {
  const store = memoire();
  await appel(store, '/campagne', { id: 'q', pause: false });
  const messages = Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, email: `contact@e${i}.fr`, objet: 'O', texte: TEXTE }));
  assert.equal((await appel(store, '/file', { campagne: 'q', messages })).ajoutes.length, 80);
  const passer = async (k, depart) => { let n = 0; for (let i = 0; i < k; i++) if ((await envoyerSuivant({ store, secret: SECRET, envoyer: async () => {}, maintenant: () => depart + i * 1000 })).statut === 'envoye') n++; return n; };
  assert.equal(await passer(60, MARDI_10H), 60, 'plus de plafond de 50 par jour');
  assert.equal((await appel(store, '/campagne', { id: 'q', parJour: 62 })).parJour, 62);
  assert.equal(await passer(5, MARDI_10H + 100_000), 2, 'plafond de la campagne respecté');
  assert.equal('parJour' in (await appel(store, '/campagne', { id: 'q', parJour: 0 })), false);
  assert.equal(await passer(5, MARDI_10H + 200_000), 5, 'plafond retiré');
  await appel(store, '/campagne', { id: 'q', pause: true });
  assert.equal((await envoyerSuivant({ store, secret: SECRET, envoyer: async () => {}, maintenant: () => MARDI_10H + 86_400_000 })).statut, 'rien-a-envoyer');
});

test('relance : seulement après un premier mail envoyé, dans le même fil, à partir de sa date', async () => {
  const store = memoire();
  await appel(store, '/campagne', { id: 'r', pause: false });
  await appel(store, '/file', { campagne: 'r', messages: [{ id: 'p1', email: 'contact@p.fr', objet: 'Votre planning', texte: TEXTE }] });
  const refus = await appel(store, '/file', { campagne: 'r', messages: [{ id: 'p1-r', type: 'relance', relanceDe: 'p1', email: 'contact@p.fr', objet: 'Votre planning', texte: TEXTE, pasAvant: '2026-12-08' }] });
  assert.equal(refus.refuses[0].raison, 'premier mail non envoyé à cette adresse');
  const envois = [];
  const envoyer = async (m) => { envois.push(m); };
  await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => MARDI_10H });
  const ok = await appel(store, '/file', { campagne: 'r', messages: [{ id: 'p1-r', type: 'relance', relanceDe: 'p1', email: 'contact@p.fr', objet: 'Votre planning', texte: TEXTE, pasAvant: '2026-12-08' }] });
  assert.deepEqual(ok.ajoutes, ['p1-r']);
  assert.equal((await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => MARDI_10H + 3_600_000 })).statut, 'rien-a-envoyer');
  assert.equal((await envoyerSuivant({ store, secret: SECRET, envoyer, maintenant: () => Date.parse('2026-12-08T09:00:00Z') })).statut, 'envoye');
  assert.equal(envois[1].objet, 'Re: Votre planning');
  assert.equal(envois[1].inReplyTo, envois[0].messageId);
});

test('routes : code administrateur exigé, retrait de la file', async () => {
  const store = memoire();
  const r = await traiterProspection(new Request('https://qm-engineering.fr/api/prospection'), { secret: SECRET, store, admin: ADMIN });
  assert.equal(r.status, 401);
  const jeton = 'j'.repeat(40);
  const avecJeton = await traiterProspection(new Request('https://qm-engineering.fr/api/prospection', { headers: { 'x-prospection-token': jeton } }), { secret: SECRET, store, admin: ADMIN, jeton });
  assert.equal(avecJeton.status, 200);
  const jetonFaux = await traiterProspection(new Request('https://qm-engineering.fr/api/prospection', { headers: { 'x-prospection-token': 'k'.repeat(40) } }), { secret: SECRET, store, admin: ADMIN, jeton });
  assert.equal(jetonFaux.status, 401);
  await appel(store, '/campagne', { id: 'z', pause: false });
  await mettreEnFile({ store, secret: SECRET, campagne: 'z', messages: [{ id: 'z1', email: 'contact@z.fr', objet: 'O', texte: TEXTE }] });
  assert.deepEqual((await appel(store, '/retirer', { campagne: 'z', ids: ['z1'], raison: 'réponse reçue' })).retires, ['z1']);
  assert.equal((await appel(store, '/campagne?c=z')).enFile, 0);
});
