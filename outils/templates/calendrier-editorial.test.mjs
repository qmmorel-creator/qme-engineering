// Tests des règles métier du calendrier éditorial (templates/calendrier-editorial/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/calendrier-editorial/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CED;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Aujourd'hui fictif : samedi 14 novembre 2026 (semaine du lundi 9).
const AUJ = '2026-11-14';
const etat = (extra = {}) => R.normaliserEtat({
  reglages: { objectifSemaine: 2, jours: [1, 3], depuis: '2026-09-07', ...(extra.reglages || {}) },
  piliers: [{ id: 'a', nom: 'A', couleur: 'bleu', part: 50 }, { id: 'b', nom: 'B', couleur: 'vert', part: 30 }, { id: 'c', nom: 'C', couleur: 'jaune', part: 20 }],
  formats: BASE.formats, canaux: [{ id: 'r', nom: 'Réseau', limite: 3000 }],
  contenus: extra.contenus || [], pauses: extra.pauses || [],
}, AUJ, BASE);
const pub = (date, extra = {}) => ({ id: `p${date}${extra.id || ''}`, titre: `Publié ${date}`, pilier: 'a', format: 'texte', canal: 'r', statut: 'publie', date, ...extra });

test('base intégrée : piliers, formats, trames, métiers et banque de sujets cohérents', () => {
  const piliers = new Set(BASE.piliers.map((p) => p.id));
  const formats = new Set(BASE.formats.map((f) => f.id));
  const trames = new Set(BASE.trames.map((t) => t.id));
  const metiers = new Set(BASE.metiers.map((m) => m.id));
  assert.equal(BASE.metiers.length, 8);
  assert.ok(BASE.idees.length >= 90);
  for (const i of BASE.idees) {
    assert.ok(i.metier === 'tous' || metiers.has(i.metier), i.sujet);
    assert.ok(piliers.has(i.pilier), i.sujet);
    assert.ok(formats.has(i.format), i.sujet);
    assert.ok(trames.has(i.trame), i.sujet);
  }
  assert.equal(new Set(BASE.idees.map((i) => i.sujet)).size, BASE.idees.length, 'sujets en double');
  for (const m of metiers) assert.ok(BASE.idees.filter((i) => i.metier === m).length >= 10, m);
  for (const t of BASE.trames) { assert.ok(piliers.has(t.pilier)); assert.ok(formats.has(t.format)); assert.ok(/\[/.test(t.texte)); }
  for (const [de, vers] of Object.entries(BASE.recyclage)) { assert.ok(formats.has(de)); assert.ok(formats.has(vers)); }
  assert.equal(BASE.piliers.filter((p) => p.part > 0).reduce((s, p) => s + p.part, 0), 100);
  // Couleurs fixes, une par pilier, dans la palette.
  const couleurs = BASE.couleurs.map((c) => c.id);
  assert.equal(new Set(BASE.piliers.map((p) => p.couleur)).size, BASE.piliers.length);
  for (const p of BASE.piliers) assert.ok(couleurs.includes(p.couleur));
  // Aucune marque de réseau social dans la base.
  const tout = JSON.stringify(BASE).toLowerCase();
  for (const marque of ['linkedin', 'instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'threads', 'bluesky', 'pinterest', 'malt']) assert.ok(!tout.includes(marque), marque);
});

test('dates : semaines, grille du mois', () => {
  assert.equal(R.jourIndex(AUJ), 5);
  assert.equal(R.lundiDe(AUJ), '2026-11-09');
  assert.equal(R.ajout('2026-10-24', 7), '2026-10-31');
  const g = R.grilleMois('2026-11-01');
  assert.equal(g[0][0], '2026-10-26');
  assert.equal(g[g.length - 1][6], '2026-12-06');
  assert.equal(g.length, 6);
  assert.equal(R.grilleMois('2027-02-01').length, 4);
});

test('compteur : caractères visibles, mots, hashtags, accroche, limite, crochets', () => {
  const k = R.compter('Bonjour 👋🏽 le réseau\n\nDeux mots #organisation #PME', { limite: 40, accroche: 10 });
  assert.equal(k.caracteres, 49);
  assert.equal(k.mots, 7);
  assert.equal(k.hashtags, 2);
  assert.equal(k.lignes, 3);
  assert.equal(k.accroche.texte, 'Bonjour 👋🏽 le réseau');
  assert.equal(k.accroche.caracteres, 19);
  assert.equal(k.accroche.depasse, true);
  assert.equal(k.depasse, true);
  assert.equal(k.reste, -9);
  const vide = R.compter('');
  assert.deepEqual([vide.caracteres, vide.mots, vide.lignes, vide.hashtags, vide.reste], [0, 0, 0, 0, null]);
  assert.equal(R.compter('[Accroche]\n[Contexte] texte').aRemplacer, 2);
  assert.equal(R.compter('Le prix #1 ? Non : C#').hashtags, 0);
});

test('contenus : normalisation, vérification, statuts', () => {
  const c = R.normaliserContenu({ titre: 'X', statut: 'programme', texte: 'abc' }, AUJ);
  assert.equal(c.statut, 'brouillon', 'programmé sans date → brouillon');
  assert.equal(R.normaliserContenu({ titre: 'X', statut: 'inconnu' }, AUJ).statut, 'idee');
  assert.equal(R.normaliserContenu({ titre: 'X', statut: 'brouillon', stats: { vues: 3 } }, AUJ).stats, null);
  assert.deepEqual(simple(R.normaliserStats({ vues: '120', reactions: -2, commentaires: '', contacts: 1.6 })), { vues: 120, reactions: null, commentaires: null, partages: null, contacts: 2 });
  assert.equal(R.normaliserStats({ vues: '' }), null);
  assert.match(R.verifierContenu({ titre: ' ', statut: 'idee' }), /sujet/);
  assert.match(R.verifierContenu({ titre: 'X', statut: 'programme' }), /date/);
  assert.equal(R.verifierContenu({ titre: 'X', statut: 'programme', date: '2026-11-17' }), null);

  const x = R.normaliserContenu({ titre: 'X', statut: 'idee' }, AUJ);
  assert.match(R.changerStatut(x, 'programme', AUJ), /date/);
  assert.equal(x.statut, 'idee');
  assert.equal(R.changerStatut(x, 'programme', AUJ, '2026-11-17'), null);
  assert.equal(x.date, '2026-11-17');
  R.changerStatut(x, 'publie', AUJ);
  assert.equal(x.date, AUJ, 'publié avec une date future → aujourd\'hui');
  x.stats = { vues: 1 };
  R.changerStatut(x, 'brouillon', AUJ);
  assert.equal(x.stats, null);
  assert.equal(R.statutSuivant('idee'), 'brouillon');
  assert.equal(R.statutSuivant('publie'), 'publie');
});

test('régularité : semaines tenues, semaine en cours, pause, série et record', () => {
  // Objectif 2. Semaines du 05/10 au 09/11.
  const contenus = [
    pub('2026-10-06'), pub('2026-10-08'), // 05/10 tenue
    pub('2026-10-13'), // 12/10 manquée
    pub('2026-10-20'), pub('2026-10-22'), // 19/10 tenue
    // 26/10 : pause
    pub('2026-11-03'), pub('2026-11-05'), pub('2026-11-06'), // 02/11 tenue (3)
    pub('2026-11-10'), // 09/11 en cours : 1 sur 2
    { id: 'q', titre: 'Prévu', statut: 'programme', date: '2026-11-15' },
  ];
  const e = etat({ contenus, pauses: ['2026-10-26'] });
  const s = R.semaine(e, '2026-11-09', AUJ);
  assert.deepEqual([s.publies, s.prevus, s.tenue, s.enCours], [1, 2, false, true]);
  assert.equal(R.serie(e, AUJ), 2, 'en cours non tenue ne casse pas, pause sautée');
  // Semaine en cours tenue : elle compte.
  e.contenus.push(R.normaliserContenu(pub('2026-11-12'), AUJ));
  assert.equal(R.serie(e, AUJ), 3);
  assert.equal(R.meilleureSerie(e, AUJ), 3);
  // Sans la pause : la semaine du 26/10 (vide) casse la série.
  R.basculerPause(e, '2026-10-26');
  assert.deepEqual(simple(e.pauses), []);
  assert.equal(R.serie(e, AUJ), 2);
  const tx = R.tauxSemaines(e, AUJ, 12);
  // Semaines terminées depuis le 07/09 : 07/09 → 02/11 = 9 ; tenues : 05/10, 19/10, 02/11.
  assert.deepEqual([tx.tenues, tx.comptees, tx.taux], [3, 9, 33]);
  // Avant le début du suivi : rien ne compte.
  const r = R.regularite(e, AUJ, 12);
  assert.equal(r.length, 12);
  assert.ok(r[0].avant);
  assert.equal(r[11].lundi, '2026-11-09');
});

test('piliers : répartition face aux parts visées, pilier à privilégier', () => {
  const e = etat({ contenus: [pub('2026-11-03'), pub('2026-11-05'), pub('2026-11-10'), pub('2026-11-12', { pilier: 'b' }), { id: 'z', titre: 'Idée', statut: 'idee', pilier: 'c' }] });
  const r = R.repartitionPiliers(e, '2026-11-01', '2026-11-30');
  assert.equal(r.total, 4, 'les idées sans date ne comptent pas');
  const a = r.lignes.find((l) => l.pilier === 'a');
  assert.deepEqual([a.n, a.part, a.cible, a.ecart], [3, 75, 50, 25]);
  const p = R.pilierAPrivilegier(e, AUJ);
  assert.equal(p.pilier, 'c');
  // Parts visées ramenées à 100 %.
  e.piliers.forEach((x) => { x.part = 10; });
  assert.equal(R.repartitionPiliers(e, '2026-11-01', '2026-11-30').lignes[0].cible, 33);
  // Rien de publié : le premier pilier visé le plus en retard est proposé.
  assert.ok(R.pilierAPrivilegier(etat(), AUJ));
});

test('statistiques : interactions, taux, classement, moyennes, totaux', () => {
  assert.deepEqual(simple(R.engagement({ vues: 2000, reactions: 40, commentaires: 8, partages: 2, contacts: 1 })), { interactions: 50, taux: 2.5 });
  assert.deepEqual(simple(R.engagement({ vues: 0, reactions: 3, commentaires: null, partages: null })), { interactions: 3, taux: null });
  assert.deepEqual(simple(R.engagement({ vues: 500, reactions: null, commentaires: null, partages: null, contacts: 2 })), { interactions: null, taux: null });
  assert.deepEqual(simple(R.engagement(null)), { interactions: null, taux: null });
  const e = etat({ contenus: [
    pub('2026-10-06', { stats: { vues: 1000, reactions: 10, contacts: 0 } }),
    pub('2026-10-08', { pilier: 'b', format: 'carrousel', stats: { vues: 3000, reactions: 90, commentaires: 30, contacts: 3 } }),
    pub('2026-10-13', { stats: { vues: 500, reactions: 40, contacts: 1 } }),
    pub('2026-10-15'),
  ] });
  assert.deepEqual(R.classer(e, 'contacts').map((c) => c.date), ['2026-10-08', '2026-10-13', '2026-10-06']);
  assert.deepEqual(R.classer(e, 'taux').map((c) => c.date), ['2026-10-13', '2026-10-08', '2026-10-06']);
  assert.deepEqual(R.classer(e, 'vues', '2026-10-07').map((c) => c.date), ['2026-10-08', '2026-10-13']);
  const m = R.moyennesPar(e, 'pilier');
  assert.deepEqual(simple(m.map((g) => [g.id, g.n, g.vuesMoy, g.tauxMoy, g.contacts])), [['b', 1, 3000, 4, 3], ['a', 2, 750, 4.5, 1]]);
  const t = R.totaux(e, '2026-10-01', '2026-10-31');
  assert.deepEqual(simple(t), { publies: 4, avecStats: 3, vues: 4500, interactions: 170, contacts: 4, taux: 3.8 });
});

test('recyclage : meilleurs contenus anciens, sans reprise récente, reprise créée', () => {
  const e = etat({ contenus: [
    pub('2026-06-02', { id: 'top', stats: { vues: 5000, reactions: 100, contacts: 5 }, texte: 'Texte d\'origine' }),
    pub('2026-06-04', { id: 'moyen', stats: { vues: 2000, reactions: 20, contacts: 1 } }),
    pub('2026-06-09', { id: 'faible', stats: { vues: 800, reactions: 5, contacts: 0 } }),
    pub('2026-11-03', { id: 'recent', stats: { vues: 9000, reactions: 300, contacts: 9 } }),
  ] });
  // 4 contenus avec stats : meilleur tiers = 2 (récent + top). Le récent a moins de 90 jours.
  assert.deepEqual(R.aRecycler(e, AUJ).map((c) => c.titre), ['Publié 2026-06-02']);
  const top = e.contenus.find((c) => c.titre === 'Publié 2026-06-02');
  const n = R.recycler(e, top, AUJ, BASE);
  assert.deepEqual([n.statut, n.format, n.pilier, n.recycleDe, n.texte], ['brouillon', 'carrousel', 'a', top.id, 'Texte d\'origine']);
  assert.match(n.titre, /^Reprise · /);
  assert.equal(R.aRecycler(e, AUJ).length, 0, 'reprise récente : plus proposé');
  // Critère sans résultat réel (0 contact) : jamais proposé.
  const e2 = etat({ contenus: [pub('2026-05-05', { stats: { vues: 100, contacts: 0 } })] });
  assert.equal(R.aRecycler(e2, AUJ).length, 0);
  e2.reglages.critere = 'vues';
  assert.equal(R.aRecycler(e2, AUJ).length, 1);
});

test('planification : jours préférés libres, pauses', () => {
  const e = etat({ contenus: [{ id: 'x', titre: 'X', statut: 'programme', date: '2026-11-17' }, { id: 'i', titre: 'Idée datée', statut: 'brouillon', date: '2026-11-19' }] });
  assert.deepEqual(simple(R.joursLibres(e, AUJ, 3)), ['2026-11-19', '2026-11-24', '2026-11-26']);
  R.basculerPause(e, '2026-11-23');
  assert.deepEqual(simple(R.joursLibres(e, AUJ, 2)), ['2026-11-19', '2026-12-01']);
  e.reglages.jours = [];
  assert.equal(R.joursLibres(e, AUJ, 1)[0], '2026-11-16', 'sans jour préféré : jours ouvrés');
});

test('alertes : oubli, statistiques, texte manquant, crochets, limite, trous', () => {
  const long = 'x'.repeat(3100);
  const e = etat({ contenus: [
    { id: 'oubli', titre: 'Oublié', statut: 'programme', date: '2026-11-12', texte: 'ok' },
    pub('2026-11-03', { id: 'sans' }),
    pub('2026-11-10', { id: 'frais' }),
    { id: 'vide', titre: 'Vide', statut: 'programme', date: '2026-11-16', texte: '' },
    { id: 'trame', titre: 'Trame', statut: 'programme', date: '2026-11-15', texte: '[Accroche]' },
    { id: 'long', titre: 'Long', statut: 'brouillon', canal: 'r', texte: long },
  ] });
  const a = R.alertes(e, AUJ);
  const types = (t) => simple(a.filter((x) => x.type === t).map((x) => x.id || x.lundi));
  assert.deepEqual(types('oubli'), ['oubli']);
  assert.deepEqual(types('stats'), ['sans'], 'publié il y a 4 jours (frais) : pas encore');
  assert.deepEqual(types('texte').sort(), ['trame', 'vide']);
  assert.deepEqual(types('limite'), ['long']);
  // Semaine en cours : 1 publié + 1 programmé passé + 1 programmé (dimanche) = 3 prévus ≥ 2 → pas de trou.
  // Semaine prochaine : 1 prévu → trou de 1.
  assert.deepEqual(types('trou'), ['2026-11-16']);
  assert.equal(a[0].niveau, 'haut');
  // Semaine prochaine en pause : plus de trou.
  R.basculerPause(e, '2026-11-16');
  assert.equal(R.alertes(e, AUJ).filter((x) => x.type === 'trou').length, 0);
});

test('banque de sujets : par métier, ajout sans doublon, pilier absent remplacé', () => {
  const s = R.sujetsPour(BASE, 'designer');
  assert.ok(s.every((x) => x.metier === 'tous' || x.metier === 'designer'));
  assert.equal(R.sujetsPour(BASE, '').length, BASE.idees.filter((x) => x.metier === 'tous').length);
  const e = etat();
  const n = R.ajouterSujets(e, s, AUJ);
  assert.equal(n, s.length);
  assert.equal(R.ajouterSujets(e, s, AUJ), 0);
  const opinion = e.contenus.find((c) => s.find((x) => x.sujet === c.titre).pilier === 'opinion');
  assert.equal(opinion.pilier, 'a', 'pilier absent de l\'état → premier pilier');
  assert.ok(e.contenus.every((c) => c.statut === 'idee' && c.trame && c.canal === 'r'));
});

test('état : initial, normalisation tolérante, CSV', () => {
  const e = R.etatInitial(BASE, AUJ, { prenom: 'Zoé', metier: 'coach', objectifSemaine: 3, jours: [0, 2], piliers: ['expertise', 'parcours'] });
  assert.deepEqual(simple(e.piliers.map((p) => p.id)), ['expertise', 'parcours']);
  assert.equal(e.canaux.length, 1);
  assert.equal(e.reglages.depuis, AUJ);
  const n = R.normaliserEtat({ reglages: { objectifSemaine: 99, jours: [9, 2, 2], critere: 'x', delaiRecyclage: 3 }, piliers: [{ id: 'p', couleur: 'fuchsia', part: 300 }], canaux: [{ id: 'c', limite: -4 }], contenus: [null, { titre: 'ok' }], pauses: ['2026-11-10', '2026-11-09', 'x'] }, AUJ, BASE);
  assert.deepEqual([n.reglages.objectifSemaine, simple(n.reglages.jours), n.reglages.critere, n.reglages.delaiRecyclage], [14, [2], 'contacts', 14]);
  assert.deepEqual([n.piliers[0].couleur, n.piliers[0].part, n.canaux[0].limite], ['bleu', 100, null]);
  assert.equal(n.contenus.length, 1);
  assert.deepEqual(simple(n.pauses), ['2026-11-09']);
  assert.equal(R.normaliserEtat(null, AUJ, BASE).contenus.length, 0);
  const csv = R.versCsv(etat({ contenus: [pub('2026-11-03', { titre: 'Un « point » ; virgule', stats: { vues: 1000, reactions: 25, contacts: 1 } })] })).split('\r\n');
  assert.equal(csv.length, 2);
  assert.match(csv[1], /^2026-11-03;;Publié;"Un « point » ; virgule";A;Texte seul;Réseau;0;1000;25;;;1;2,5;$/);
});
