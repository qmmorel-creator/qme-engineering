// Tests de Gestion de compétition sportive : règles (templates/competition/regles.js et donnees.js) et API
// publique en lecture seule (templates/competition/moteur.js avec netlify/lib/competition.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { traiterCompetition, purgerExpires, nettoyerInstantane, dateExpiration, TAILLE_MAX } from '../../templates/competition/moteur.js';
import { dependancesCompetition } from '../../netlify/lib/competition.mjs';
import { genererCode, codeAdminProduit, PRODUITS } from '../../netlify/lib/templates-acces.mjs';

const dossier = new URL('../../templates/competition/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CMP;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Compétition de test : une catégorie, n inscrits, épreuves données.
function compet({ n = 4, epreuves = [], reglages = {} } = {}) {
  const participants = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nom: `Athlète ${String.fromCharCode(65 + i)} Exemple`, categorie: 'c1', dossard: i + 1 }));
  return R.normaliser({ categories: [{ id: 'c1', nom: 'Élite' }], participants, epreuves, reglages: { ...BASE.reglages, ...reglages } }, { reglages: BASE.reglages });
}
const noter = (e, ep, pid, s) => { e.scores[ep] ||= {}; e.scores[ep][pid] = R.normaliserScore(s); };
const rangs = (c) => Object.fromEntries(c.lignes.map((l) => [l.participant.id, l.rang]));

// ---------- Base ----------
test('base intégrée : formats, épreuves et types cohérents, aucun nom d\'épreuve de référence', () => {
  const ids = new Set(BASE.epreuves.map((e) => e.id));
  for (const f of BASE.formats) for (const id of f.epreuves) assert.ok(ids.has(id), `${f.id} : ${id}`);
  for (const e of BASE.epreuves) assert.ok(R.TYPES[e.type], e.id);
  assert.deepEqual(simple(BASE.types.map((t) => t.id)), Object.keys(R.TYPES));
  for (const t of BASE.types) assert.equal(t.sens, R.TYPES[t.id].sens);
  const texte = JSON.stringify(BASE.epreuves).toLowerCase();
  for (const interdit of ['fran', 'murph', 'grace', 'cindy', 'helen', 'karen', 'diane', 'isabel', 'crossfit', 'hyrox', 'open ']) {
    assert.ok(!new RegExp(`\\b${interdit.trim()}\\b`).test(texte), `nom protégé : ${interdit}`);
  }
  assert.ok(BASE.couleurs.length >= 8);
});

test('saisie des temps et des valeurs, affichage', () => {
  assert.equal(R.lireTemps('12:34'), 754);
  assert.equal(R.lireTemps('1:02:03'), 3723);
  assert.equal(R.lireTemps('12:34,5'), 754.5);
  assert.equal(R.lireTemps("8'05"), 485);
  assert.equal(R.lireTemps('45'), 45);
  assert.equal(R.lireTemps('12:75'), null);
  assert.equal(R.lireTemps('abc'), null);
  assert.equal(R.afficherTemps(754), '12:34');
  assert.equal(R.afficherTemps(754.5), '12:34,5');
  assert.equal(R.afficherTemps(3723), '1:02:03');
  assert.equal(R.lireValeur('102,5 kg'), 102.5);
  assert.equal(R.lireValeur('143', { entier: true }), 143);
  assert.equal(R.lireValeur('14,5', { entier: true }), null);
  assert.equal(R.lireValeur('-3'), null);
  assert.equal(R.nombre(1234.5), '1 234,5');
});

// ---------- Classement d'une épreuve ----------
test('épreuve au temps : finishers, puis temps limite aux répétitions, CAP+n, départage', () => {
  const e = compet({ n: 5, epreuves: [{ id: 'e1', nom: 'Chrono', type: 'temps', capMin: 10, repsTotal: 150, departage: true }] });
  noter(e, 'e1', 'p1', { statut: 'cap', valeur: 143 });
  noter(e, 'e1', 'p2', { statut: 'ok', valeur: 512 });
  noter(e, 'e1', 'p3', { statut: 'ok', valeur: 498, departage: 300 });
  noter(e, 'e1', 'p4', { statut: 'ok', valeur: 498, departage: 290 });
  noter(e, 'e1', 'p5', { statut: 'cap', valeur: 150 - 20 });
  const c = R.classementEpreuve(e, e.epreuves[0], 'c1');
  assert.deepEqual(rangs(c), { p4: 1, p3: 2, p2: 3, p1: 4, p5: 5 });
  assert.equal(c.lignes.find((l) => l.participant.id === 'p1').affichage, 'CAP+7');
  assert.equal(c.lignes.find((l) => l.participant.id === 'p4').affichage, '8:18 (dép. 4:50)');
});

test('égalité parfaite : même rang (1, 2, 2, 4) ; absent et disqualifié après les classés', () => {
  const e = compet({ n: 6, epreuves: [{ id: 'e1', nom: 'AMRAP', type: 'reps' }] });
  noter(e, 'e1', 'p1', { valeur: 200 });
  noter(e, 'e1', 'p2', { valeur: 180 });
  noter(e, 'e1', 'p3', { valeur: 180 });
  noter(e, 'e1', 'p4', { valeur: 150 });
  noter(e, 'e1', 'p5', { statut: 'dns' });
  const c = R.classementEpreuve(e, e.epreuves[0], 'c1');
  assert.deepEqual(rangs(c), { p1: 1, p2: 2, p3: 2, p4: 4, p5: null, p6: null });
  assert.equal(c.lignes.find((l) => l.participant.id === 'p5').rangCompte, 5);
  assert.equal(c.lignes.find((l) => l.participant.id === 'p5').etat, 'sans');
  assert.equal(c.lignes.find((l) => l.participant.id === 'p6').etat, 'attente');
  assert.equal(c.nbAttente, 1);
  assert.equal(R.afficherScore(e.epreuves[0], e.scores.e1.p5), 'Absent');
});

test('forfait : hors classement et hors vagues', () => {
  const e = compet({ n: 3, epreuves: [{ id: 'e1', nom: 'Charge', type: 'charge' }] });
  e.participants[2].statut = 'forfait';
  noter(e, 'e1', 'p1', { valeur: 80 });
  const cg = R.classementGeneral(e, 'c1');
  assert.equal(cg.lignes.length, 2);
  assert.equal(cg.forfaits.length, 1);
  assert.ok(!R.genererVagues(e, 'e1').flatMap((v) => v.couloirs).includes('p3'));
});

// ---------- Classement général ----------
function deuxEpreuves(reglages) {
  const e = compet({ n: 3, reglages, epreuves: [{ id: 'e1', nom: 'A', type: 'reps' }, { id: 'e2', nom: 'B', type: 'charge', coefficient: 1 }] });
  noter(e, 'e1', 'p1', { valeur: 100 }); noter(e, 'e1', 'p2', { valeur: 90 }); noter(e, 'e1', 'p3', { valeur: 80 });
  noter(e, 'e2', 'p1', { valeur: 60 }); noter(e, 'e2', 'p2', { valeur: 80 }); noter(e, 'e2', 'p3', { valeur: 70 });
  return e;
}

test('somme des rangs : le plus bas gagne ; départage par meilleures places ou dernière épreuve', () => {
  // p1 : 1 + 3 = 4 ; p2 : 2 + 1 = 3 ; p3 : 3 + 2 = 5
  let cg = R.classementGeneral(deuxEpreuves({ methode: 'rang' }), 'c1');
  assert.deepEqual(simple(cg.lignes.map((l) => [l.participant.id, l.total, l.rang])), [['p2', 3, 1], ['p1', 4, 2], ['p3', 5, 3]]);
  assert.equal(cg.provisoire, false);
  // Égalité de total : p1 (1, 3) et p2 (3, 1) avec un 3e départagé.
  const e = compet({ n: 3, epreuves: [{ id: 'e1', nom: 'A', type: 'reps' }, { id: 'e2', nom: 'B', type: 'reps' }] });
  noter(e, 'e1', 'p1', { valeur: 30 }); noter(e, 'e1', 'p2', { valeur: 10 }); noter(e, 'e1', 'p3', { valeur: 20 });
  noter(e, 'e2', 'p1', { valeur: 10 }); noter(e, 'e2', 'p2', { valeur: 30 }); noter(e, 'e2', 'p3', { valeur: 20 });
  e.reglages.departage = 'derniere';
  cg = R.classementGeneral(e, 'c1');
  // Totaux égaux (4) : la dernière épreuve classe p2, p3, p1.
  assert.deepEqual(simple(cg.lignes.map((l) => [l.participant.id, l.rang])), [['p2', 1], ['p3', 2], ['p1', 3]]);
  e.reglages.departage = 'places';
  cg = R.classementGeneral(e, 'c1');
  assert.equal(cg.lignes[2].participant.id, 'p3', 'p3 (2, 2) après p1 et p2 qui ont chacun une victoire');
  assert.deepEqual(simple(cg.lignes.map((l) => l.rang)), [1, 1, 3]);
  e.reglages.departage = 'aucun';
  cg = R.classementGeneral(e, 'c1');
  assert.deepEqual(simple(cg.lignes.map((l) => l.rang)), [1, 1, 1]);
  assert.ok(cg.lignes.every((l) => l.exaequo));
});

test('barème de points et coefficient : le plus haut gagne', () => {
  const e = deuxEpreuves({ methode: 'bareme', bareme: { premier: 100, pas: 5, plancher: 0 } });
  e.epreuves[1].coefficient = 2;
  // e1 : p1 100, p2 95, p3 90 ; e2 ×2 : p2 200, p3 190, p1 180
  const cg = R.classementGeneral(e, 'c1');
  assert.deepEqual(simple(cg.lignes.map((l) => [l.participant.id, l.total])), [['p2', 295], ['p1', 280], ['p3', 280]]);
  assert.equal(cg.lignes[1].rang, 2, 'départage par places : p1 a une victoire, p3 aucune');
  assert.equal(cg.lignes[2].rang, 3);
  assert.equal(R.pointsBareme(40, { premier: 100, pas: 4, plancher: 10 }), 10);
});

test('classement provisoire : épreuve en cours de saisie, scores manquants comptés', () => {
  const e = deuxEpreuves({ methode: 'rang' });
  delete e.scores.e2.p3;
  const cg = R.classementGeneral(e, 'c1');
  assert.equal(cg.provisoire, true);
  assert.equal(cg.manquants, 1);
  assert.equal(cg.lignes.find((l) => l.participant.id === 'p3').resultats.e2.rangCompte, 3);
  // Épreuve sans aucun score : ignorée.
  e.scores.e2 = {};
  assert.deepEqual(R.classementGeneral(e, 'c1').epreuves.map((x) => x.id), ['e1']);
});

// ---------- Vagues et programme ----------
test('vagues équilibrées, les mieux classés en dernier, horaires calculés', () => {
  assert.deepEqual(simple(R.tailles(10, 8)), [5, 5]);
  assert.deepEqual(simple(R.tailles(17, 8)), [5, 6, 6]);
  assert.deepEqual(simple(R.tailles(8, 8)), [8]);
  const e = compet({ n: 10, epreuves: [{ id: 'e1', nom: 'A', type: 'reps', capMin: 10, battementMin: 5, heure: '09:00' }, { id: 'e2', nom: 'B', type: 'temps', capMin: 8, battementMin: 4, heure: '11:00', couloirs: 4 }] });
  for (let i = 1; i <= 10; i++) noter(e, 'e1', `p${i}`, { valeur: 100 + i }); // p10 premier
  const v = R.genererVagues(e, 'e2');
  assert.deepEqual(simple(v.map((x) => x.couloirs.length)), [3, 3, 4]);
  assert.equal(v[2].couloirs.at(-1), 'p10', 'le premier passe dans la dernière vague');
  assert.equal(v[0].couloirs[0], 'p1');
  const v1 = R.genererVagues(e, 'e1', { couloirs: 8 });
  assert.deepEqual(simple(v1[0].couloirs), ['p1', 'p2', 'p3', 'p4', 'p5'], 'première épreuve : ordre des dossards');
  const t = R.genererVagues(e, 'e1', { ordre: 'tirage' });
  assert.deepEqual(simple(t.map((x) => x.couloirs)), simple(R.genererVagues(e, 'e1', { ordre: 'tirage' }).map((x) => x.couloirs)), 'tirage reproductible');
  e.epreuves[1].vagues = v;
  assert.equal(R.horaire(e.epreuves[1], 2).debut, '11:24');
  assert.equal(R.horaire(e.epreuves[1], 2).fin, '11:32');
});

test('programme, vague en piste et alertes de repos', () => {
  const e = compet({ n: 2, epreuves: [{ id: 'e1', nom: 'A', type: 'reps', capMin: 10, battementMin: 5, heure: '09:00' }, { id: 'e2', nom: 'B', type: 'reps', capMin: 10, battementMin: 5, heure: '09:20' }] });
  e.competition.dateDebut = '2026-12-05';
  e.epreuves[0].vagues = [R.normaliserEpreuve({ vagues: [{ categorie: 'c1', couloirs: ['p1'] }, { categorie: 'c1', couloirs: ['p2'] }] }).vagues[0], R.normaliserEpreuve({ vagues: [{ categorie: 'c1', couloirs: ['p2'] }] }).vagues[0]];
  e.epreuves[1].vagues = R.normaliserEpreuve({ vagues: [{ categorie: 'c1', couloirs: ['p1', 'p2'] }] }).vagues;
  const prog = R.programme(e);
  assert.deepEqual(simple(prog.map((x) => [x.epreuve.id, x.h.debut])), [['e1', '09:00'], ['e1', '09:15'], ['e2', '09:20']]);
  const rep = R.alertesRepos(e);
  // p2 : fin 09:25, puis 09:20 → chevauchement ; p1 : fin 09:10, puis 09:20 → 10 min < 20
  assert.deepEqual(simple(rep.map((x) => [x.participant.id, x.ecart])), [['p2', -5], ['p1', 10]]);
  const ep = R.enPiste(e, '2026-12-05', R.minutes('09:16'));
  assert.equal(ep.enCours.numero, 2);
  assert.equal(ep.suivantes[0].epreuve.id, 'e2');
  e.participants.push(R.normaliserParticipant({ id: 'p9', nom: 'Retardataire', categorie: 'c1' }));
  assert.deepEqual(simple(R.horsVagues(e, e.epreuves[1]).map((p) => p.id)), ['p9']);
  assert.deepEqual(simple(R.ordreSaisie(e, e.epreuves[0], 'c1').map((x) => x.participant.id)), ['p1', 'p2', 'p9']);
});

// ---------- RGPD : instantané public ----------
test('instantané public : ni coordonnées, ni notes, ni membres ; nom selon accord et réglage', () => {
  const e = deuxEpreuves({ methode: 'rang', nomPublic: 'initiale' });
  Object.assign(e.participants[0], { email: 'a@exemple.fr', telephone: '0600000000', note: 'Blessure au genou', membres: ['X'], paye: false });
  e.participants[1].public = false;
  const i = R.instantane(e, '2026-11-14T10:00:00Z');
  const brut = JSON.stringify(i);
  for (const secret of ['a@exemple.fr', '0600000000', 'Blessure', 'paye']) assert.ok(!brut.includes(secret), secret);
  const noms = i.categories[0].lignes.map((l) => l.nom);
  assert.ok(noms.includes('Dossard 2'));
  assert.ok(noms.includes('Athlète A. E.'));
  const { publieLe, ...sansDate } = simple(i);
  assert.equal(publieLe, '2026-11-14T10:00:00Z');
  assert.deepEqual(simple(nettoyerInstantane(simple(i))), sansDate, 'le serveur accepte l\'instantané tel quel');
  // Nom d'équipe jamais abrégé.
  e.categories[0].equipe = true;
  assert.ok(R.instantane(e).categories[0].lignes.some((l) => l.nom === 'Athlète A Exemple'));
});

test('import d\'une liste collée et effacement des coordonnées', () => {
  const e = compet({ n: 2 });
  const r = R.lireListe('Nom;Catégorie;Club\nZoé Exemple;élite;Club Exemple;zoe@exemple.fr\nYann Exemple;Inconnue\n\nXavier Exemple', e);
  assert.equal(r.participants.length, 3);
  assert.equal(r.participants[0].categorie, 'c1');
  assert.equal(r.participants[0].dossard, 3);
  assert.equal(r.participants[0].email, 'zoe@exemple.fr');
  assert.deepEqual(simple(r.inconnues), ['Inconnue']);
  e.participants.push(...r.participants);
  const { etat, n } = R.effacerCoordonnees(e);
  assert.equal(n, 1);
  assert.ok(etat.participants.every((p) => !p.email && !p.telephone));
  const csv = R.versCsvInscrits(e);
  assert.ok(!csv.includes('zoe@exemple.fr'));
  assert.ok(R.versCsvInscrits(e, { contacts: true }).includes('zoe@exemple.fr'));
});

test('normalisation tolérante et suppression d\'un inscrit', () => {
  const e = R.normaliser({ participants: [{ id: 'a', nom: '  Léa   Exemple ', statut: 'bizarre' }], epreuves: [{ id: 'e', type: 'inconnu', vagues: [{ couloirs: ['a', null] }] }], scores: { e: { a: { valeur: 12 }, z: { valeur: 3 }, b: { statut: 'ok' } } } }, { reglages: BASE.reglages });
  assert.equal(e.participants[0].nom, 'Léa Exemple');
  assert.equal(e.participants[0].statut, 'inscrit');
  assert.equal(e.participants[0].public, true);
  assert.equal(e.epreuves[0].type, 'temps');
  assert.deepEqual(simple(Object.keys(e.scores.e)), ['a']);
  assert.equal(e.reglages.methode, 'rang');
  const s = R.supprimerParticipant(e, 'a');
  assert.equal(s.participants.length, 0);
  assert.deepEqual(simple(s.epreuves[0].vagues[0].couloirs), [null, null]);
  assert.deepEqual(simple(Object.keys(s.scores.e)), []);
});

// ---------- API publique ----------
const SECRET = 'secret-de-test-competition-0123456789abcdef';
function banc(depart = '2026-11-20T10:00:00Z') {
  const m = new Map();
  const horloge = { t: new Date(depart) };
  const stockage = { get: async (c) => m.get(c) ?? null, set: async (c, v) => { m.set(c, structuredClone(v)); }, supprimer: async (c) => { m.delete(c); }, lister: async (p) => [...m.keys()].filter((c) => c.startsWith(p)) };
  const deps = { stockage, ...dependancesCompetition(SECRET), maintenant: () => horloge.t };
  const appel = async (methode, chemin, { corps, code } = {}) => {
    const r = await traiterCompetition(new Request(`https://x.test/api/competition${chemin}`, { method: methode, headers: code ? { 'x-code': code } : {}, body: corps === undefined ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps)) }), deps);
    return { statut: r.status, corps: await r.json(), entetes: r.headers };
  };
  return { m, horloge, appel, deps };
}
const instantaneTest = () => simple(R.instantane(deuxEpreuves({ methode: 'rang' }), null));

test('API : publication réservée au code CMP, lecture publique, identifiant stable et non devinable', async () => {
  assert.ok(PRODUITS.CMP);
  const { appel } = banc();
  const code = genererCode(SECRET, 'CMP');
  const i = { ...instantaneTest(), dateFin: '2026-12-05' };
  assert.equal((await appel('PUT', '/public', { corps: { sel: 'ABCDEFGH12', instantane: i } })).statut, 401);
  assert.equal((await appel('PUT', '/public', { code: genererCode(SECRET, 'REV'), corps: { sel: 'ABCDEFGH12', instantane: i } })).statut, 401);
  assert.equal((await appel('PUT', '/public', { code, corps: { sel: 'court', instantane: i } })).statut, 400);
  assert.equal((await appel('PUT', '/public', { code, corps: { sel: 'ABCDEFGH12', instantane: { v: 2 } } })).statut, 400);
  const p = await appel('PUT', '/public', { code, corps: { sel: 'ABCDEFGH12', instantane: i } });
  assert.equal(p.statut, 200);
  assert.match(p.corps.id, /^[0-9a-zA-Z]{20}$/);
  assert.equal(p.corps.expire, '2027-01-04');
  const p2 = await appel('PUT', '/public', { code, corps: { sel: 'ABCDEFGH12', instantane: i } });
  assert.equal(p2.corps.id, p.corps.id, 'même lien à chaque mise à jour');
  const autre = await appel('PUT', '/public', { code: genererCode(SECRET, 'CMP'), corps: { sel: 'ABCDEFGH12', instantane: i } });
  assert.notEqual(autre.corps.id, p.corps.id, 'un autre acheteur, un autre lien');
  const g = await appel('GET', `/public/${p.corps.id}`);
  assert.equal(g.statut, 200);
  assert.equal(g.corps.categories[0].lignes.length, 3);
  assert.match(g.entetes.get('netlify-cdn-cache-control'), /max-age=15/);
  assert.equal((await appel('GET', '/public/inexistant00000')).statut, 404);
  assert.equal((await appel('POST', `/public/${p.corps.id}`)).statut, 405);
  // Code administrateur personnel : accepté (c'est un code CMP).
  assert.equal((await appel('PUT', '/public', { code: codeAdminProduit(SECRET, 'CMP'), corps: { sel: 'ABCDEFGH12', instantane: i } })).statut, 200);
});

test('API : champs inconnus retirés, textes tronqués, taille limitée', async () => {
  const { appel } = banc();
  const code = genererCode(SECRET, 'CMP');
  const i = instantaneTest();
  i.categories[0].lignes[0].email = 'fuite@exemple.fr';
  i.categories[0].lignes[0].nom = 'x'.repeat(500);
  i.secret = 'oui';
  const p = await appel('PUT', '/public', { code, corps: { sel: 'SEL0000001', instantane: i } });
  const g = await appel('GET', `/public/${p.corps.id}`);
  const brut = JSON.stringify(g.corps);
  assert.ok(!brut.includes('fuite@exemple.fr'));
  assert.ok(!('secret' in g.corps));
  assert.equal(g.corps.categories[0].lignes[0].nom.length, 80);
  const gros = { sel: 'SEL0000001', instantane: { ...i, nom: 'y'.repeat(TAILLE_MAX) } };
  assert.equal((await appel('PUT', '/public', { code, corps: gros })).statut, 413);
  assert.equal((await appel('PUT', '/public', { code, corps: '{pas du json' })).statut, 400);
});

test('API : retrait, changement de lien, expiration à la lecture et purge quotidienne', async () => {
  const { appel, horloge, m, deps } = banc();
  const code = genererCode(SECRET, 'CMP');
  const i = { ...instantaneTest(), dateDebut: '2026-11-21', dateFin: null };
  const a = await appel('PUT', '/public', { code, corps: { sel: 'LIENA00001', instantane: i } });
  const b = await appel('PUT', '/public', { code, corps: { sel: 'LIENB00001', instantane: { ...i, dateDebut: null } } });
  assert.notEqual(a.corps.id, b.corps.id);
  assert.equal(b.corps.expire, '2027-02-18', '90 jours sans date');
  assert.equal((await appel('DELETE', '/public?sel=LIENB00001', { code: genererCode(SECRET, 'CMP') })).statut, 200);
  assert.equal((await appel('GET', `/public/${b.corps.id}`)).statut, 200, 'un autre acheteur ne retire rien');
  assert.equal((await appel('DELETE', '/public?sel=LIENB00001', { code })).statut, 200);
  assert.equal((await appel('GET', `/public/${b.corps.id}`)).statut, 404);
  horloge.t = new Date('2026-12-22T10:00:00Z');
  assert.equal((await appel('GET', `/public/${a.corps.id}`)).statut, 404, 'effacé 30 jours après la compétition');
  assert.equal(m.size, 0);
  await appel('PUT', '/public', { code, corps: { sel: 'LIENC00001', instantane: { ...i, dateDebut: '2026-12-01' } } });
  horloge.t = new Date('2027-01-05T10:00:00Z');
  assert.equal(await purgerExpires({ stockage: deps.stockage, maintenant: () => horloge.t }), 1);
  assert.equal(m.size, 0);
  assert.equal(dateExpiration({ dateFin: '2020-01-01' }, '2026-11-20'), '2026-11-21', 'date passée : effacement le lendemain');
});
