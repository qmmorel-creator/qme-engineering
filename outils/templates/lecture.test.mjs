// Tests des règles métier du suivi de lecture (templates/lecture/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/lecture/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.PGS;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Trois livres : un papier en cours, un audio à lire, un lu sans sessions.
function exemple(extra = {}) {
  return R.normaliser({
    reglages: { genres: B.genres, objectifs: { 2026: { livres: 24, pages: 8000 } } },
    livres: [
      { id: 'a', titre: 'Le Phare des Brumes', auteur: 'Lise Arnaud', genre: 'Roman', format: 'papier', total: 300, statut: 'encours', debut: '2026-11-01', ajoute: '2026-10-20' },
      { id: 'b', titre: 'Voix du Nord', auteur: 'Paul Méry', genre: 'Essai', format: 'audio', total: 600, statut: 'alire', priorite: 1, ajoute: '2026-09-01' },
      { id: 'c', titre: 'Les Saisons', auteur: 'Lise Arnaud', genre: 'Roman', format: 'numerique', total: 200, statut: 'lu', debut: '2026-03-01', fin: '2026-03-10', note: 4 },
    ],
    sessions: [
      { id: 's1', livre: 'a', date: '2026-11-01', quantite: 40 },
      { id: 's2', livre: 'a', date: '2026-11-08', quantite: 30 },
      { id: 's3', livre: 'a', date: '2026-11-13', quantite: 35 },
      { id: 's4', livre: 'a', date: '2026-11-14', quantite: 35 },
    ],
    ...extra,
  }, B);
}

test('dates : jour de l\'année, années bissextiles, textes', () => {
  assert.equal(R.jourDeLAnnee('2026-01-01'), 1);
  assert.equal(R.jourDeLAnnee('2026-11-14'), 318);
  assert.equal(R.jourDeLAnnee('2028-12-31'), 366);
  assert.equal(R.joursAnnee(2026), 365);
  assert.equal(R.joursAnnee(2028), 366);
  assert.equal(R.joursAnnee(2100), 365);
  assert.equal(R.joursAnnee(2000), 366);
  assert.equal(R.dureeTexte(570), '9 h 30');
  assert.equal(R.dureeTexte(45), '45 min');
  assert.equal(R.quantiteTexte(1, 'pages'), '1 page');
  assert.equal(R.quantiteTexte(1234, 'pages'), '1 234 pages');
  assert.equal(R.nombreTexte(12.5, 1), '12,5');
  assert.equal(R.nombreTexte(-3), '−3');
});

test('base intégrée : genres, formats, statuts, couleurs', () => {
  assert.ok(B.genres.length >= 12);
  assert.equal(new Set(B.genres).size, B.genres.length);
  assert.deepEqual(simple(B.formats.map((f) => f.code)), ['papier', 'numerique', 'audio']);
  assert.equal(B.couleurs.length, 8);
  for (const f of B.formats) assert.equal(R.FORMATS[f.code].unite, f.unite);
  for (const s of B.statuts) assert.ok(R.STATUTS[s.code]);
});

test('normalisation tolérante : valeurs absurdes, sessions orphelines, champs vides omis', () => {
  const e = R.normaliser({
    reglages: { genres: ['Roman', ' Roman ', '', 'Essai'], objectifs: { 2026: { livres: -3, pages: 'x' }, abc: { livres: 5 } } },
    livres: [{ id: 'x', titre: '  ', format: 'vinyle', total: -10, statut: 'perdu', note: 9, priorite: 7, debut: '2026-05-10', fin: '2026-05-01', citations: [{ texte: '' }, { texte: 'Une phrase', page: '12' }] }],
    sessions: [{ livre: 'x', date: '2026-05-02', quantite: 10 }, { livre: 'inconnu', date: '2026-05-02', quantite: 10 }, { livre: 'x', date: '2026-02-30', quantite: 10 }, { livre: 'x', date: '2026-05-03', quantite: 0 }],
  }, B);
  assert.deepEqual(simple(e.reglages.genres), ['Roman', 'Essai']);
  assert.deepEqual(simple(e.reglages.objectifs), { 2026: { livres: 0, pages: 0 } });
  const l = e.livres[0];
  assert.equal(l.titre, 'Sans titre');
  assert.equal(l.format, 'papier');
  assert.equal(l.total, 0);
  assert.equal(l.statut, 'alire');
  assert.equal(l.note, 5);
  assert.equal(l.priorite, 3);
  assert.equal(l.fin, '2026-05-10');
  assert.equal(l.avis, undefined);
  assert.deepEqual(simple(l.citations.map((c) => [c.texte, c.page])), [['Une phrase', 12]]);
  assert.equal(e.sessions.length, 1);
  assert.deepEqual(simple(R.normaliser(null, B).livres), []);
  assert.equal(R.normaliser({}, B).reglages.genres.length, B.genres.length);
});

test('progression, rythme sur 14 jours et date de fin estimée', () => {
  const e = exemple();
  const a = e.livres.find((l) => l.id === 'a');
  assert.deepEqual(simple(R.progression(e, a)), { fait: 140, total: 300, part: 140 / 300, reste: 160, unite: 'pages' });
  // Première session le 1er novembre : 14 jours écoulés au 14, 140 pages → 10 pages par jour.
  assert.equal(R.rythmeLivre(e, a, '2026-11-14'), 10);
  assert.deepEqual(simple(R.finEstimee(e, a, '2026-11-14')), { jours: 16, date: '2026-11-30', rythme: 10 });
  // Le 20 novembre, fenêtre du 7 au 20 : 100 pages / 14 jours.
  assert.equal(R.rythmeLivre(e, a, '2026-11-20'), 100 / 14);
  // Plus aucune lecture depuis 14 jours : pas de rythme, pas de date.
  assert.equal(R.rythmeLivre(e, a, '2026-12-10'), null);
  assert.equal(R.finEstimee(e, a, '2026-12-10'), null);
  // Livre commencé il y a 3 jours : divisé par 3, pas par 14.
  const e2 = R.normaliser({ livres: [{ id: 'z', total: 100, statut: 'encours' }], sessions: [{ livre: 'z', date: '2026-11-12', quantite: 30 }] }, B);
  assert.equal(R.rythmeLivre(e2, e2.livres[0], '2026-11-14'), 10);
  // Livre lu : complet, sans date estimée ; livre sans total : part nulle.
  const c = e.livres.find((l) => l.id === 'c');
  assert.equal(R.progression(e, c).part, 1);
  assert.equal(R.finEstimee(e, c, '2026-11-14'), null);
  assert.equal(R.progression(e2, { ...e2.livres[0], total: 0 }).part, null);
  assert.equal(R.quantiteDepuisPosition(e, a, 152), 12);
  assert.equal(R.quantiteDepuisPosition(e, a, 100), 0);
});

test('session : le statut suit (à lire → en cours, total atteint → lu)', () => {
  const e = exemple();
  const r1 = R.appliquerSession(e, { livre: 'b', date: '2026-11-14', quantite: 45 });
  const b = r1.etat.livres.find((l) => l.id === 'b');
  assert.equal(b.statut, 'encours');
  assert.equal(b.debut, '2026-11-14');
  assert.equal(r1.termine, false);
  assert.equal(e.livres.find((l) => l.id === 'b').statut, 'alire', 'état d\'origine intact');
  const r2 = R.appliquerSession(r1.etat, { livre: 'a', date: '2026-11-15', quantite: 200 });
  const a = r2.etat.livres.find((l) => l.id === 'a');
  assert.equal(r2.termine, true);
  assert.equal(a.statut, 'lu');
  assert.equal(a.fin, '2026-11-15');
  assert.equal(R.progression(r2.etat, a).fait, 300);
  // Session antérieure au début noté : le début recule.
  const r3 = R.appliquerSession(e, { livre: 'a', date: '2026-10-28', quantite: 5 });
  assert.equal(r3.etat.livres.find((l) => l.id === 'a').debut, '2026-10-28');
  // Reprise d'un livre abandonné.
  const e4 = R.changerStatut(e, 'a', 'abandonne', '2026-11-14');
  assert.equal(e4.livres.find((l) => l.id === 'a').fin, '2026-11-14');
  const r4 = R.appliquerSession(e4, { livre: 'a', date: '2026-11-20', quantite: 10 });
  assert.equal(r4.etat.livres.find((l) => l.id === 'a').statut, 'encours');
  assert.equal(r4.etat.livres.find((l) => l.id === 'a').fin, '');
  // Refus : livre inconnu ou quantité nulle.
  assert.equal(R.appliquerSession(e, { livre: 'nope', date: '2026-11-14', quantite: 5 }).refus, true);
  assert.equal(R.appliquerSession(e, { livre: 'a', date: '2026-11-14', quantite: 0 }).refus, true);
});

test('liste « à lire » : tri par priorité et déplacements', () => {
  const e = R.normaliser({ livres: [
    { id: 'p1', titre: 'A', statut: 'alire', priorite: 1, ordre: 2 },
    { id: 'p2', titre: 'B', statut: 'alire', priorite: 1, ordre: 1 },
    { id: 'p3', titre: 'C', statut: 'alire', priorite: 2, ordre: 1 },
    { id: 'p4', titre: 'D', statut: 'alire', priorite: 3, ordre: 1 },
    { id: 'x', titre: 'E', statut: 'lu' },
  ] }, B);
  const ids = (s) => R.aLire(s).map((l) => `${l.id}:${l.priorite}`).join(' ');
  assert.equal(ids(e), 'p2:1 p1:1 p3:2 p4:3');
  assert.equal(ids(R.deplacer(e, 'p1', -1)), 'p1:1 p2:1 p3:2 p4:3');
  // Bord du groupe : change de priorité sans changer de place.
  assert.equal(ids(R.deplacer(e, 'p3', -1)), 'p2:1 p1:1 p3:1 p4:3');
  assert.equal(ids(R.deplacer(e, 'p3', 1)), 'p2:1 p1:1 p3:3 p4:3');
  assert.equal(ids(R.deplacer(e, 'p4', 1)), ids(e), 'déjà tout en bas');
  assert.equal(ids(R.deplacer(e, 'p2', -1)), ids(e), 'déjà tout en haut');
  assert.equal(R.deplacer(e, 'x', 1), e, 'livre hors liste');
});

test('lectures datées : sessions plus complément d\'un livre lu sans détail', () => {
  const e = exemple();
  const l = R.lectures(e);
  assert.equal(l.length, 5);
  assert.deepEqual(simple(l[0]), { date: '2026-03-10', livre: 'c', quantite: 200, unite: 'pages', media: 'livre', complement: true });
  // Livre lu avec une partie en sessions : seul le reste est ajouté à la date de fin.
  const e2 = R.normaliser({ livres: [{ id: 'k', total: 100, statut: 'lu', fin: '2026-04-02' }], sessions: [{ livre: 'k', date: '2026-04-01', quantite: 60 }] }, B);
  assert.deepEqual(simple(R.lectures(e2).map((x) => [x.date, x.quantite])), [['2026-04-01', 60], ['2026-04-02', 40]]);
});

test('séries de jours de lecture : actuelle (jusqu\'à hier) et record', () => {
  const ses = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-08', '2026-11-12', '2026-11-13', '2026-11-13'].map((date, i) => ({ id: `s${i}`, livre: 'a', date, quantite: 5 }));
  const e = exemple({ sessions: ses });
  assert.deepEqual(simple(R.series(e, '2026-11-13')), { actuelle: 2, record: 4, aujourdhui: true, jours: 7 });
  assert.equal(R.series(e, '2026-11-14').actuelle, 2, 'rien aujourd\'hui : la série court encore');
  assert.equal(R.series(e, '2026-11-15').actuelle, 0);
  assert.equal(R.series(exemple({ sessions: [] }), '2026-11-15').record, 0);
});

test('objectif annuel : avance ou retard au jour près, projection, rythme nécessaire', () => {
  // 24 livres, 20 lus au 14 novembre 2026 (jour 318 sur 365).
  const o = R.suiviObjectif(24, 20, 2026, '2026-11-14');
  assert.equal(o.ecoules, 318);
  assert.equal(o.restants, 47);
  assert.ok(Math.abs(o.attendu - 20.909) < 0.001);
  // 20 livres auraient dû être atteints le jour 304,2 : 14 jours de retard.
  assert.equal(o.joursAvance, -14);
  assert.ok(Math.abs(o.projection - 22.956) < 0.001);
  assert.equal(o.parJour, 4 / 47);
  assert.equal(o.atteint, false);
  // En avance.
  assert.equal(R.suiviObjectif(12, 11, 2026, '2026-11-14').joursAvance, 17);
  // Année passée : 365 jours écoulés, plus de rythme nécessaire ; année future : rien d'écoulé.
  const p = R.suiviObjectif(10, 12, 2025, '2026-11-14');
  assert.equal(p.ecoules, 365);
  assert.equal(p.parJour, null);
  assert.equal(p.atteint, true);
  const f = R.suiviObjectif(10, 0, 2027, '2026-11-14');
  assert.equal(f.ecoules, 0);
  assert.equal(f.joursAvance, null);
  assert.equal(f.projection, null);
  // Au 1er janvier, rien lu : un jour de retard (attendu 1/365 de la cible).
  assert.equal(R.suiviObjectif(24, 0, 2026, '2026-01-01').joursAvance, -1);
  // Depuis l'état : livres lus dans l'année, pages des sessions et compléments.
  const e = exemple();
  const oa = R.objectifAnnee(e, 2026, '2026-11-14');
  assert.equal(oa.livres.fait, 1);
  assert.equal(oa.pages.fait, 340);
  assert.equal(R.objectifAnnee(e, 2025, '2026-11-14').livres, null, 'pas d\'objectif fixé');
});

test('bilan de l\'année : par mois, genre, auteur, format ; pages par jour ; note moyenne', () => {
  const e = R.normaliser({
    livres: [
      { id: 'a', titre: 'Un', auteur: 'Lise Arnaud', genre: 'Roman', format: 'papier', total: 300, statut: 'lu', debut: '2026-01-05', fin: '2026-01-20', note: 4 },
      { id: 'b', titre: 'Deux', auteur: 'Lise Arnaud', genre: 'Roman', format: 'numerique', total: 100, statut: 'lu', debut: '2026-02-01', fin: '2026-02-10', note: 5 },
      { id: 'c', titre: 'Trois', auteur: 'Paul Méry', genre: 'Essai', format: 'audio', total: 480, statut: 'lu', debut: '2026-02-03', fin: '2026-02-12' },
      { id: 'd', titre: 'Quatre', auteur: 'Paul Méry', genre: 'Essai', format: 'papier', total: 250, statut: 'abandonne', debut: '2026-03-01', fin: '2026-03-04' },
      { id: 'e', titre: 'Cinq', auteur: 'Ana Roy', genre: 'Poésie', format: 'papier', total: 90, statut: 'lu', debut: '2025-12-20', fin: '2025-12-28' },
    ],
    sessions: [{ livre: 'd', date: '2026-03-02', quantite: 50 }, { livre: 'a', date: '2026-01-06', quantite: 100 }, { livre: 'c', date: '2026-02-05', quantite: 120 }],
  }, B);
  const b = R.bilanAnnee(e, 2026, '2026-03-31');
  assert.equal(b.nbLivres, 3);
  assert.equal(b.abandons, 1);
  assert.equal(b.pages, 450); // 300 + 100 (livres lus) + 50 (abandonné)
  assert.equal(b.minutes, 480);
  assert.deepEqual(simple(b.parMois.slice(0, 3).map((m) => [m.livres, m.pages, m.minutes])), [[1, 300, 0], [2, 100, 480], [0, 50, 0]]);
  assert.deepEqual(simple(b.parGenre.map((x) => [x.nom, x.livres, x.pages, x.minutes])), [['Roman', 2, 400, 0], ['Essai', 1, 0, 480]]);
  assert.deepEqual(simple(b.parAuteur.map((x) => [x.nom, x.livres, x.note])), [['Lise Arnaud', 2, 4.5], ['Paul Méry', 1, null]]);
  assert.deepEqual(simple(b.parFormat.map((x) => x.livres)), [1, 1, 1]);
  assert.equal(b.ecoules, 90);
  assert.equal(b.pagesParJour, 5);
  assert.equal(b.noteMoyenne, 4.5);
  assert.equal(b.joursLus, 3);
  assert.equal(b.plusLong.id, 'a');
  assert.equal(b.dureeMoyenne, (16 + 10 + 10) / 3);
  // Les lectures postérieures à « aujourd'hui » ne comptent pas.
  assert.equal(R.bilanAnnee(e, 2026, '2026-01-31').pages, 300);
  assert.deepEqual(simple(R.annees(e, '2026-03-31')), [2026, 2025]);
  const j = R.derniersJours(e, '2026-03-02', 3);
  assert.deepEqual(simple(j.map((x) => [x.date, x.pages])), [['2026-02-28', 0], ['2026-03-01', 0], ['2026-03-02', 50]]);
});

test('suppression d\'un livre, renommage d\'un genre, changement de statut', () => {
  const e = exemple();
  const s = R.supprimerLivre(e, 'a');
  assert.equal(s.livres.length, 2);
  assert.equal(s.sessions.length, 0);
  const r = R.renommerGenre(e, 'Roman', 'Romans');
  assert.ok(r.reglages.genres.includes('Romans') && !r.reglages.genres.includes('Roman'));
  assert.equal(r.livres.filter((l) => l.genre === 'Romans').length, 2);
  assert.equal(R.renommerGenre(e, 'Roman', '  '), e);
  const c = R.changerStatut(e, 'b', 'lu', '2026-11-14');
  const b = c.livres.find((l) => l.id === 'b');
  assert.deepEqual([b.statut, b.debut, b.fin], ['lu', '2026-11-14', '2026-11-14']);
  const d = R.changerStatut(c, 'b', 'alire', '2026-11-15');
  assert.equal(d.livres.find((l) => l.id === 'b').fin, '');
});

test('CSV : séparateur point-virgule, BOM, formules neutralisées', () => {
  const e = exemple();
  e.livres[0].avis = '=SOMME(A1); "top"';
  const csv = R.csvLivres(e);
  assert.ok(csv.startsWith('﻿Titre;Auteur;'));
  assert.ok(csv.includes('"\'=SOMME(A1); ""top"""'));
  assert.ok(csv.includes('Le Phare des Brumes;Lise Arnaud;Roman;Papier;300;pages;En cours;'));
  const cs = R.csvSessions(e);
  assert.equal(cs.trim().split('\r\n').length, 5);
  assert.equal(R.champCsv('-3'), '\'-3');
});

test('taille : une année de lecture tient largement dans la limite', () => {
  const livres = Array.from({ length: 300 }, (_, i) => ({ id: `l${i}`, titre: `Titre de livre numéro ${i}`, auteur: 'Auteur Prénom Nom', genre: 'Roman', total: 350, statut: 'lu', debut: '2026-01-01', fin: '2026-02-01', note: 4 }));
  const sessions = Array.from({ length: 3000 }, (_, i) => ({ id: `s${i}`, livre: `l${i % 300}`, date: '2026-01-15', quantite: 25 }));
  const t = R.taille(R.normaliser({ livres, sessions }, B));
  assert.ok(t < 600000, `taille ${t}`);
});

// ---------- Version 2 : films, séries, podcasts, livres audio (27/11/2026) ----------

// Données réelles au format v1 (avant l'extension aux médias), telles qu'enregistrées par l'application du 22/11/2026.
const V1 = {
  version: 1,
  tutorielVu: true,
  majLe: '2026-11-20T08:00:00.000Z',
  reglages: { genres: ['Roman', 'Essai', 'Mon genre à moi'], objectifs: { 2025: { livres: 20, pages: 0 }, 2026: { livres: 24, pages: 8000 } } },
  livres: [
    { id: 'a1', titre: 'Le Phare des Brumes', auteur: 'Lise Arnaud', genre: 'Roman', format: 'papier', total: 300, statut: 'encours', priorite: 2, ordre: 0, ajoute: '2026-10-20', debut: '2026-11-01', fin: '', note: 0, citations: [{ id: 'c1', texte: 'Une phrase.', page: 12 }] },
    { id: 'a2', titre: 'Voix du Nord', auteur: 'Paul Méry', genre: 'Essai', format: 'audio', total: 600, statut: 'lu', priorite: 2, ordre: 0, ajoute: '2026-09-01', debut: '2026-09-02', fin: '2026-09-20', note: 5, avis: 'Très bien lu.' },
    { id: 'a3', titre: 'Les Saisons', auteur: '', genre: 'Mon genre à moi', format: 'numerique', total: 0, statut: 'alire', priorite: 1, ordre: 3, ajoute: '2026-08-01', debut: '', fin: '', note: 0 },
  ],
  sessions: [{ id: 's1', livre: 'a1', date: '2026-11-01', quantite: 40 }, { id: 's2', livre: 'a2', date: '2026-09-10', quantite: 300 }],
};

test('migration v1 → v2 sans perte : livres, sessions, citations, avis, objectifs, champs inconnus', () => {
  const e = R.normaliser(structuredClone(V1), B);
  assert.equal(e.version, 2);
  assert.deepEqual(simple(e.livres.map((l) => [l.id, l.media, l.format])), [['a1', 'livre', 'papier'], ['a2', 'livreaudio', 'audio'], ['a3', 'livre', 'numerique']]);
  // Chaque champ v1 est conservé à l'identique ; seul `media` s'ajoute.
  for (const ancien of V1.livres) {
    const nouveau = simple(e.livres.find((l) => l.id === ancien.id));
    delete nouveau.media;
    assert.deepEqual(nouveau, ancien);
  }
  assert.deepEqual(simple(e.sessions), V1.sessions);
  assert.deepEqual(simple(e.reglages), V1.reglages);
  assert.equal(e.tutorielVu, true);
  assert.equal(e.majLe, V1.majLe);
  // Unités et statistiques inchangées pour un lecteur v1.
  assert.equal(R.unite(e.livres[1]), 'minutes');
  const o = R.objectifAnnee(e, 2026, '2026-11-20');
  assert.equal(o.livres.fait, 1);
  assert.equal(o.pages.fait, 40);
  assert.equal(o.films, null);
  // Rejouer la normalisation ne change plus rien (idempotence).
  assert.deepEqual(simple(R.normaliser(simple(e), B)), simple(e));
  assert.ok(R.csvLivres(e).includes('Voix du Nord;Paul Méry;Essai;Audio;600;minutes;Écouté;'));
});

test('médias : unités, libellés de statut accordés, champs propres à chaque média', () => {
  const e = R.normaliser({ livres: [
    { id: 'f', media: 'film', titre: 'Le Grand Départ', auteur: 'Réa Lisatrice', total: 112, annee: 2024, source: { s: 'tmdb', id: '603' }, format: 'papier' },
    { id: 's', media: 'serie', titre: 'Les Phares', saisons: [{ n: 1, episodes: 8 }, { n: 2, episodes: 10 }, { n: 3, episodes: 0 }], total: 3 },
    { id: 'p', media: 'podcast', titre: 'Midi Science', source: { s: 'itunes', id: 'javascript:alert(1)' } },
    { id: 'x', media: 'vinyle', titre: 'Inconnu', format: 'audio' },
  ] }, B);
  const [f, s, p, x] = e.livres;
  assert.deepEqual([f.media, f.format, R.unite(f), f.annee, f.source.s], ['film', '', 'minutes', 2024, 'tmdb']);
  assert.deepEqual([s.media, R.unite(s), s.total, s.saisons.length], ['serie', 'episodes', 18, 2], 'total = somme des saisons');
  assert.equal(p.source, undefined, 'identifiant de source suspect écarté');
  assert.equal(x.media, 'livreaudio', 'média inconnu : déduit du format');
  assert.equal(R.statutTexte('alire', 'film'), 'À voir');
  assert.equal(R.statutTexte('lu', 'serie'), 'Vue');
  assert.equal(R.statutTexte('abandonne', 'serie'), 'Abandonnée');
  assert.equal(R.statutTexte('alire', 'podcast'), 'À écouter');
  assert.equal(R.statutTexte('lu', 'livre'), 'Lu');
  assert.equal(R.statutTexte('lu', ''), 'Terminé');
  assert.equal(R.quantiteTexte(1, 'episodes'), '1 épisode');
  assert.equal(R.quantiteTexte(12, 'episodes'), '12 épisodes');
});

test('série : position saison · épisode, rang, fin automatique au dernier épisode', () => {
  const sa = [{ n: 1, episodes: 8 }, { n: 2, episodes: 10 }];
  assert.deepEqual(simple(R.positionEpisode(sa, 1)), { saison: 1, episode: 1 });
  assert.deepEqual(simple(R.positionEpisode(sa, 8)), { saison: 1, episode: 8 });
  assert.deepEqual(simple(R.positionEpisode(sa, 9)), { saison: 2, episode: 1 });
  assert.equal(R.positionEpisode(sa, 0), null);
  assert.equal(R.positionEpisode(sa, 30).fini, true);
  assert.equal(R.rangEpisode(sa, 2, 3), 11);
  assert.equal(R.rangEpisode(sa, 2, 11), null);
  assert.equal(R.rangEpisode(sa, 4, 1), null);
  assert.equal(R.episodeTexte(R.positionEpisode(sa, 11)), 'S2 · É3');
  let e = R.normaliser({ livres: [{ id: 's', media: 'serie', titre: 'Les Phares', saisons: sa, statut: 'alire' }] }, B);
  e = R.appliquerSession(e, { livre: 's', date: '2026-11-01', quantite: 8 }).etat;
  assert.equal(e.livres[0].statut, 'encours');
  const r = R.appliquerSession(e, { livre: 's', date: '2026-11-05', quantite: 10 });
  assert.equal(r.termine, true);
  assert.equal(r.etat.livres[0].statut, 'lu');
});

test('objectifs et bilan par média : films, séries, podcasts, épisodes, minutes de film', () => {
  const e = R.normaliser({
    reglages: { objectifs: { 2026: { livres: 10, pages: 0, films: 50, series: 4, episodes: 200, podcasts: 0, inconnu: 3 } } },
    livres: [
      { id: 'l', titre: 'Un livre', total: 200, statut: 'lu', debut: '2026-02-01', fin: '2026-02-10', genre: 'Drame' },
      { id: 'f1', media: 'film', titre: 'Film A', total: 120, statut: 'lu', fin: '2026-02-11', genre: 'Drame', note: 4 },
      { id: 'f2', media: 'film', titre: 'Film B', total: 90, statut: 'lu', fin: '2026-03-02', genre: 'Comédie' },
      { id: 's', media: 'serie', titre: 'Série', saisons: [{ n: 1, episodes: 6 }], statut: 'encours' },
      { id: 'p', media: 'podcast', titre: 'Podcast', statut: 'encours' },
    ],
    sessions: [{ livre: 's', date: '2026-03-01', quantite: 4 }, { livre: 'p', date: '2026-03-03', quantite: 7 }],
  }, B);
  assert.deepEqual(simple(e.reglages.objectifs[2026]), { livres: 10, pages: 0, films: 50, series: 4, episodes: 200 });
  const b = R.bilanAnnee(e, 2026, '2026-03-31');
  assert.equal(b.nbLivres, 1);
  assert.equal(b.nbOeuvres, 3);
  assert.equal(b.nbFilms, 2);
  assert.equal(b.minutesFilms, 210);
  assert.equal(b.minutes, 0, 'les films ne comptent pas comme écoute');
  assert.equal(b.episodes, 11);
  assert.equal(b.pages, 200);
  assert.deepEqual(simple(b.parMedia.map((m) => [m.media, m.termines, m.quantite])), [['livre', 1, 200], ['livreaudio', 0, 0], ['film', 2, 210], ['serie', 0, 4], ['podcast', 0, 7]]);
  assert.deepEqual(simple(b.parGenre.map((g) => [g.nom, g.oeuvres, g.livres])), [['Drame', 2, 1], ['Comédie', 1, 0]]);
  assert.deepEqual(simple(b.parMois.slice(1, 3).map((m) => [m.livres, m.oeuvres, m.minutesFilms, m.episodes])), [[1, 2, 120, 0], [0, 1, 90, 11]]);
  const o = R.objectifAnnee(e, 2026, '2026-03-31');
  assert.equal(o.films.fait, 2);
  assert.equal(o.episodes.fait, 11);
  assert.equal(o.series.fait, 0);
  assert.equal(o.pages, null);
  assert.equal(o.podcasts, null);
  const j = R.derniersJours(e, '2026-03-03', 3);
  // Seules les sessions comptent jour par jour (un film noté vu sans session n'y figure pas).
  assert.deepEqual(simple(j.map((x) => [x.minutesFilms, x.episodes])), [[0, 4], [0, 0], [0, 7]]);
});

test('recherche tolérante : accents, casse, fautes de frappe, saisie partielle', () => {
  const t = 'Les Misérables · Victor Hugo';
  assert.ok(R.scoreRecherche('miserables', t) > 0);
  assert.ok(R.scoreRecherche('MISÉR', t) > 0);
  assert.ok(R.scoreRecherche('misreables hugo', t) > 0, 'inversion de lettres');
  assert.ok(R.scoreRecherche('victr', t) > 0, 'lettre oubliée');
  assert.ok(R.scoreRecherche('hugo vic', t) > 0, 'ordre libre');
  assert.equal(R.scoreRecherche('balzac', t), 0);
  assert.equal(R.scoreRecherche('lez', t), 0, 'pas de faute tolérée sous 4 lettres');
  assert.ok(R.scoreRecherche('les mis', t) > R.scoreRecherche('les msi', t), 'le mot exact passe devant');
  assert.equal(R.scoreRecherche('', t), 1);
  assert.equal(R.distance('chat', 'chta'), 1);
  assert.equal(R.distance('abc', 'abcdefgh', 2), 3);
});
