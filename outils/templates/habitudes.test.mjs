// Tests des règles métier du suivi d'habitudes (templates/habitudes/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/habitudes/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.HBT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Aujourd'hui fictif : vendredi 13 novembre 2026.
const AUJ = '2026-11-13';
const etat = () => ({
  themes: [
    { id: 'a', nom: 'A', couleur: 'bleu', mode: 'independant' },
    { id: 'lieu', nom: 'Lieu', couleur: 'ciel', mode: 'unique' },
  ],
  habitudes: [], journal: {},
});
const hab = (id, extra = {}) => R.normaliserHabitude({ id, theme: 'a', nom: id, type: 'case', jours: R.TOUS, depuis: '2026-11-01', ...extra }, AUJ);

test('dates : jour de la semaine, lundi, mois', () => {
  assert.equal(R.jourIndex('2026-11-13'), 4);
  assert.equal(R.lundiDe('2026-11-15'), '2026-11-09');
  assert.equal(R.ajout('2026-10-24', 7), '2026-10-31'); // changement d'heure
  assert.equal(R.joursDuMois('2026-02-10').length, 28);
  assert.equal(R.joursDuMois('2028-02-01').length, 29);
  assert.equal(R.premierDuMois('2026-11-13'), '2026-11-01');
  assert.equal(R.moisSuivant('2026-12-01'), '2027-01-01');
  assert.equal(R.moisSuivant('2026-01-01', -1), '2025-12-01');
});

test('nombres : lecture tolérante, refus des négatifs et du texte', () => {
  assert.equal(R.lireNombre('1,5'), 1.5);
  assert.equal(R.lireNombre(' 8 '), 8);
  assert.equal(R.lireNombre('0.25'), 0.25);
  assert.equal(R.lireNombre('-2'), null);
  assert.equal(R.lireNombre('deux'), null);
  assert.equal(R.lireNombre(''), null);
  assert.equal(R.nombreTexte(7.5), '7,5');
});

test('base intégrée : 50 habitudes, thèmes et routines cohérents, couleurs fixes', () => {
  assert.equal(BASE.habitudes.length, 50);
  assert.equal(new Set(BASE.habitudes.map((h) => h.id)).size, 50);
  const themes = new Set(BASE.themes.map((t) => t.id));
  for (const h of BASE.habitudes) {
    assert.ok(themes.has(h.theme), h.id);
    if (h.type === 'nombre') assert.ok(h.min !== null || h.max !== null, `${h.id} sans objectif`);
    if (h.source) assert.ok(BASE.sources[h.source], `${h.id} : source manquante`);
  }
  for (const r of BASE.routines) for (const id of r.habitudes) assert.ok(BASE.habitudes.some((h) => h.id === id), `${r.id} : ${id}`);
  assert.equal(new Set(BASE.themes.map((t) => t.couleur)).size, BASE.themes.length);
  assert.ok(BASE.themes.some((t) => t.mode === 'unique'));
  const eau = BASE.habitudes.find((h) => h.id === 'eau');
  assert.deepEqual([eau.unite, eau.min, eau.pas], ['verres', 8, 1]);
  const sommeil = BASE.habitudes.find((h) => h.id === 'sommeil-heures');
  assert.deepEqual([sommeil.min, sommeil.max, sommeil.pas], [7, 9, 0.5]);
});

test('objectif : textes et réussite d\'une habitude chiffrée (minimum, maximum, fourchette)', () => {
  const eau = hab('eau', { type: 'nombre', unite: 'verres', min: 8, pas: 1 });
  const cafe = hab('cafe', { type: 'nombre', unite: 'tasses', max: 3 });
  const sommeil = hab('s', { type: 'nombre', unite: 'h', min: 7, max: 9, pas: 0.5 });
  const alcool = hab('al', { type: 'nombre', unite: 'verres', max: 0 });
  assert.equal(R.objectifTexte(eau), 'au moins 8 verres');
  assert.equal(R.objectifTexte(cafe), 'au plus 3 tasses');
  assert.equal(R.objectifTexte(sommeil), '7 à 9 h');
  assert.equal(R.objectifTexte(alcool), 'aucun');
  assert.equal(R.reussiValeur(eau, 8), true);
  assert.equal(R.reussiValeur(eau, 7), false);
  assert.equal(R.reussiValeur(cafe, 0), true);
  assert.equal(R.reussiValeur(cafe, 4), false);
  assert.equal(R.reussiValeur(sommeil, 6.5), false);
  assert.equal(R.reussiValeur(sommeil, 9), true);
  assert.equal(R.reussiValeur(sommeil, 9.5), false);
  assert.equal(R.reussiValeur(eau, 'na'), false);
  assert.equal(R.reussiValeur(hab('c'), true), true);
});

test('vérification et normalisation d\'une habitude', () => {
  assert.match(R.verifierHabitude({ nom: '', jours: [0], type: 'case' }), /nom/);
  assert.match(R.verifierHabitude({ nom: 'x', jours: [], type: 'case' }), /jour/);
  assert.match(R.verifierHabitude({ nom: 'x', jours: [0], type: 'nombre', min: null, max: null, pas: 1 }), /minimum/);
  assert.match(R.verifierHabitude({ nom: 'x', jours: [0], type: 'nombre', min: 5, max: 2, pas: 1 }), /dépasse/);
  assert.equal(R.verifierHabitude({ nom: 'x', jours: [0], type: 'nombre', min: 1, max: null, pas: 1 }), null);
  const h = R.normaliserHabitude({ nom: 'x', type: 'nombre', min: 5, max: 2, pas: 0, jours: [9, 2, 2, 0] }, AUJ);
  assert.equal(h.max, 5);
  assert.equal(h.pas, 1);
  assert.deepEqual(simple(h.jours), [0, 2]);
  assert.equal(h.depuis, AUJ);
  const c = R.normaliserHabitude({ nom: 'y', type: 'bizarre', min: 3 }, AUJ);
  assert.equal(c.type, 'case');
  assert.equal(c.min, null);
  assert.deepEqual(simple(c.jours), [0, 1, 2, 3, 4, 5, 6]);
});

test('statuts : réussi, partiel, manqué, en attente, non applicable, pas prévu, futur', () => {
  const e = etat();
  const c = hab('c', { jours: [0, 1, 2, 3, 4] });
  const n = hab('n', { type: 'nombre', unite: 'verres', min: 8 });
  e.habitudes.push(c, n);
  R.regler(e, '2026-11-12', c, true);
  R.regler(e, '2026-11-11', c, false);
  R.regler(e, '2026-11-09', c, R.NA);
  R.regler(e, '2026-11-12', n, 5);
  assert.equal(R.statut(e, c, '2026-11-12', AUJ), 'reussi');
  assert.equal(R.statut(e, c, '2026-11-11', AUJ), 'manque');
  assert.equal(R.statut(e, c, '2026-11-10', AUJ), 'manque'); // rien saisi un jour passé
  assert.equal(R.statut(e, c, '2026-11-09', AUJ), 'na');
  assert.equal(R.statut(e, c, AUJ, AUJ), 'attente');
  assert.equal(R.statut(e, c, '2026-11-08', AUJ), 'libre'); // dimanche non prévu
  assert.equal(R.statut(e, c, '2026-11-14', AUJ), 'futur');
  assert.equal(R.statut(e, c, '2026-10-30', AUJ), 'libre'); // avant sa création
  assert.equal(R.statut(e, n, '2026-11-12', AUJ), 'partiel');
  R.regler(e, '2026-11-08', c, true);
  assert.equal(R.statut(e, c, '2026-11-08', AUJ), 'bonus');
});

test('séries : non applicable et jours non prévus ne cassent pas la série, aujourd\'hui vide non plus', () => {
  const e = etat();
  const c = hab('c', { jours: [0, 1, 2, 3, 4] }); // lundi → vendredi
  e.habitudes.push(c);
  for (const d of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) R.regler(e, d, c, true);
  R.regler(e, '2026-11-09', c, R.NA); // lundi malade
  for (const d of ['2026-11-10', '2026-11-11', '2026-11-12']) R.regler(e, d, c, true);
  // Week-end du 7-8 non prévu, lundi non applicable : la série continue (8 jours réussis), aujourd'hui pas encore saisi.
  assert.equal(R.serie(e, c, AUJ), 8);
  R.regler(e, AUJ, c, true);
  assert.equal(R.serie(e, c, AUJ), 9);
  R.regler(e, '2026-11-04', c, false);
  assert.equal(R.serie(e, c, AUJ), 6);
  assert.equal(R.meilleureSerie(e, c, AUJ), 6);
  // Un jour passé sans saisie casse la série.
  R.regler(e, '2026-11-11', c, undefined);
  assert.equal(R.serie(e, c, AUJ), 2);
  // Aujourd'hui « pas fait » casse la série tout de suite.
  R.regler(e, AUJ, c, false);
  assert.equal(R.serie(e, c, AUJ), 0);
});

test('taux de réussite : seuls réussi, partiel et manqué comptent', () => {
  const e = etat();
  const n = hab('n', { type: 'nombre', unite: 'verres', min: 8, depuis: '2026-11-09' });
  e.habitudes.push(n);
  R.regler(e, '2026-11-09', n, 8);
  R.regler(e, '2026-11-10', n, 9);
  R.regler(e, '2026-11-11', n, 4);
  R.regler(e, '2026-11-12', n, R.NA);
  const t = R.taux(e, n, '2026-11-01', '2026-11-30', AUJ); // aujourd'hui en attente : pas compté
  assert.deepEqual([t.reussis, t.partiels, t.manques, t.na, t.comptes, t.taux], [2, 1, 0, 1, 3, 67]);
  const vide = R.taux(e, hab('z', { depuis: AUJ }), AUJ, AUJ, AUJ);
  assert.equal(vide.taux, null);
  const g = R.tauxGlobal(e, '2026-11-01', AUJ, AUJ);
  assert.equal(g.taux, 67);
});

test('thème « une seule par jour » : un choix remplace l\'autre, répartition, pas de série', () => {
  const e = etat();
  const bureau = hab('bureau', { theme: 'lieu', jours: [0, 1, 2, 3, 4] });
  const tele = hab('tele', { theme: 'lieu', jours: [0, 1, 2, 3, 4] });
  e.habitudes.push(bureau, tele);
  R.regler(e, '2026-11-09', bureau, true);
  R.regler(e, '2026-11-09', tele, true);
  assert.equal(R.valeur(e, '2026-11-09', bureau), false);
  assert.equal(R.valeur(e, '2026-11-09', tele), true);
  assert.equal(e.journal['2026-11-09']['@lieu'], 'tele');
  assert.equal(R.statut(e, tele, '2026-11-09', AUJ), 'choisi');
  assert.equal(R.statut(e, bureau, '2026-11-09', AUJ), 'autre');
  R.regler(e, '2026-11-10', bureau, true);
  R.regler(e, '2026-11-11', bureau, true);
  R.regler(e, '2026-11-12', tele, R.NA);
  assert.equal(R.statut(e, bureau, '2026-11-12', AUJ), 'na');
  const r = R.repartition(e, 'lieu', '2026-11-09', '2026-11-15', AUJ);
  assert.deepEqual(simple(r.options.map((o) => o.jours)), [2, 1]);
  assert.equal(r.na, 1);
  assert.equal(r.vides, 0); // aujourd'hui pas encore renseigné : pas compté
  assert.equal(R.serie(e, bureau, AUJ), null);
  // Cochage rapide : choisir, puis non applicable, puis effacer.
  assert.equal(R.basculer(e, AUJ, tele), true);
  assert.equal(R.basculer(e, AUJ, tele), R.NA);
  assert.equal(R.basculer(e, AUJ, tele), undefined);
  assert.equal(e.journal[AUJ], undefined);
});

test('cochage rapide et boutons + / − d\'une habitude chiffrée', () => {
  const e = etat();
  const c = hab('c');
  e.habitudes.push(c);
  assert.equal(R.basculer(e, AUJ, c), true);
  assert.equal(R.basculer(e, AUJ, c), false);
  assert.equal(R.basculer(e, AUJ, c), R.NA);
  assert.equal(R.basculer(e, AUJ, c), undefined);
  const s = hab('s', { type: 'nombre', unite: 'h', min: 7, max: 9, pas: 0.5 });
  assert.equal(R.ajuster(s, undefined, 1), 0.5);
  assert.equal(R.ajuster(s, 7, 1), 7.5);
  assert.equal(R.ajuster(s, 0.5, -1), 0);
  assert.equal(R.ajuster(s, 0, -1), 0);
  assert.equal(R.ajuster(hab('p', { type: 'nombre', min: 1, pas: 0.1 }), 0.2, 1), 0.3);
  R.regler(e, AUJ, s, -3);
  assert.equal(R.valeur(e, AUJ, s), 0);
});

test('jours parfaits et avancement du jour (non applicable exclu)', () => {
  const e = etat();
  const a = hab('a'), b = hab('b');
  e.habitudes.push(a, b);
  R.regler(e, '2026-11-12', a, true); R.regler(e, '2026-11-12', b, R.NA);
  R.regler(e, '2026-11-11', a, true);
  assert.deepEqual(simple(R.avancementJour(e, '2026-11-12', AUJ)), { prevues: 1, faites: 1, parfait: true });
  assert.equal(R.avancementJour(e, '2026-11-11', AUJ).parfait, false);
  assert.equal(R.joursParfaits(e, '2026-11-01', AUJ, AUJ), 1);
  const sem = R.tendance(e, '2026-11-09', 2, AUJ);
  assert.equal(sem.length, 2);
  assert.equal(sem[1].lundi, '2026-11-09');
});

test('habitudes de santé : repérées par la base ou par leur nom', () => {
  assert.equal(R.estSante({ nom: 'Traitement du matin pris', sante: true }), true);
  assert.equal(R.estSante({ nom: 'Prendre mon médicament' }), true);
  assert.equal(R.estSante({ nom: 'Comprimé de fer' }), true);
  assert.equal(R.estSante({ nom: 'Boire de l\'eau' }), false);
  assert.ok(BASE.habitudes.filter((h) => h.sante).length >= 2);
});

test('archivage : l\'habitude n\'est plus attendue, son historique reste', () => {
  const e = etat();
  const c = hab('c', { archive: '2026-11-10' });
  e.habitudes.push(c);
  R.regler(e, '2026-11-09', c, true);
  assert.equal(R.prevue(c, '2026-11-09'), true);
  assert.equal(R.prevue(c, '2026-11-10'), false);
  assert.equal(R.habitudesDuJour(e, AUJ).length, 0);
  assert.equal(R.meilleureSerie(e, c, AUJ), 1);
  assert.equal(R.taux(e, c, '2026-11-01', AUJ, AUJ).taux, 11); // 1 réussi sur 9 jours prévus
});

test('ajout depuis la base : thèmes créés une fois, couleurs libres, doublons ignorés', () => {
  const e = { themes: [], habitudes: [], journal: {} };
  const n = R.ajouterDepuisBase(e, ['eau', 'cafe', 'bureau', 'teletravail', 'sommeil-heures'], BASE, AUJ);
  assert.equal(n, 5);
  assert.deepEqual(simple(e.themes.map((t) => t.id).sort()), ['alimentation', 'lieu', 'sommeil']);
  assert.equal(e.themes.find((t) => t.id === 'lieu').mode, 'unique');
  assert.equal(R.ajouterDepuisBase(e, ['eau'], BASE, AUJ), 0);
  const eau = e.habitudes.find((h) => h.modele === 'eau');
  assert.equal(eau.depuis, AUJ);
  assert.notEqual(eau.id, 'eau');
  // Couleur déjà prise : le thème suivant prend la première couleur libre.
  const f = { themes: [{ id: 'x', nom: 'X', couleur: 'bleu', mode: 'independant' }], habitudes: [], journal: {} };
  R.ajouterDepuisBase(f, ['sommeil-heures'], BASE, AUJ);
  assert.equal(f.themes[1].couleur, 'rouge');
});

test('normalisation : tolère les anciennes versions et écarte les valeurs invalides', () => {
  const COUL = BASE.couleurs.map((c) => c.id);
  const v = R.normaliserEtat(null, AUJ, COUL);
  assert.deepEqual(simple(v.habitudes), []);
  const d = R.normaliserEtat({
    prenom: 'Léa', themes: [{ id: 't', nom: 'T', couleur: 'violet-inconnu', mode: 'bizarre' }],
    habitudes: [{ id: 'h', theme: 't', nom: 'H', type: 'case' }, null],
    journal: { '2026-11-12': { h: true, x: -3, y: 'texte', '@t': 'h', z: 'na' }, 'pas-une-date': { h: true }, '2026-11-11': { x: {} } },
    majLe: 'abc',
  }, AUJ, COUL);
  assert.equal(d.themes[0].couleur, 'bleu');
  assert.equal(d.themes[0].mode, 'independant');
  assert.equal(d.habitudes.length, 1);
  assert.deepEqual(simple(d.journal), { '2026-11-12': { h: true, '@t': 'h', z: 'na' } });
  assert.equal(d.majLe, 'abc');
});

test('export CSV : une ligne par habitude et par jour, séparateur point-virgule', () => {
  const e = etat();
  const n = hab('Eau; filtrée', { type: 'nombre', unite: 'verres', min: 8, depuis: '2026-11-12' });
  const bureau = hab('Bureau', { theme: 'lieu', depuis: '2026-11-12' });
  e.habitudes.push(n, bureau);
  R.regler(e, '2026-11-12', n, 7.5);
  R.regler(e, '2026-11-12', bureau, true);
  const csv = R.versCsv(e, '2026-11-12', '2026-11-12', AUJ).split('\r\n');
  assert.equal(csv[0], 'date;theme;habitude;valeur;unite;statut');
  assert.ok(csv.includes('2026-11-12;A;"Eau; filtrée";7,5;verres;partiel'));
  assert.ok(csv.includes('2026-11-12;Lieu;Bureau;oui;;choisi'));
});
