// Tests des règles métier du Document unique d'évaluation des risques (templates/document-unique/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/document-unique/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.DRP;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
let n = 0;
const id = () => `x${++n}`;
const etat = (extra = {}) => R.normaliser({
  entreprise: { nom: 'Exemple', effectif: 14 },
  unites: [{ id: 'u1', nom: 'Atelier', type: 'lieu' }, { id: 'u2', nom: 'Bureau', type: 'lieu' }],
  risques: [
    { id: 'r1', unite: 'u1', famille: 'MACHINES', danger: 'Scie', g: 4, p: 3, gr: 4, pr: 2 },
    { id: 'r2', unite: 'u1', famille: 'BRUIT', danger: 'Bruit', g: 3, p: 3 },
    { id: 'r3', unite: 'u2', famille: 'PHYSIQUE', danger: 'Écran', g: 1, p: 3 },
    { id: 'r4', unite: 'u2', famille: 'PSYCHOSOCIAUX', danger: 'Charge' },
  ],
  actions: [],
  ...extra,
});

test('base intégrée : sources datées, obligations sourcées, familles reformulées', () => {
  for (const s of Object.values(BASE.sources)) {
    assert.match(s.url, /^https:\/\/(entreprendre\.service-public\.gouv\.fr|www\.inrs\.fr)\//);
    assert.match(s.consulte, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.ok(s.maj.length > 5 && s.titre.length > 10 && s.court);
  }
  for (const o of BASE.obligations) {
    assert.ok(o.sources.length && o.sources.every((x) => BASE.sources[x]), `${o.id} : source connue`);
    assert.ok(o.articles.startsWith('Code du travail'), `${o.id} : textes cités`);
  }
  const codes = BASE.familles.map((f) => f.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(codes.length, 21, '20 familles (ED 840) + Autre');
  for (const f of BASE.familles.filter((x) => x.code !== 'AUTRE')) assert.ok(f.situations.length >= 2 && f.mesures.length >= 2, f.code);
  for (const s of BASE.secteurs) for (const u of s.unites) for (const [f] of u.risques) assert.ok(codes.includes(f), `${s.id} / ${u.nom} : ${f}`);
  assert.deepEqual(simple(BASE.seuils), { annuel: 11, programme: 50 });
});

test('obligations selon l\'effectif : 11 et 50 salariés', () => {
  const ids = (e) => R.obligations(e).map((o) => o.id);
  assert.ok(!ids(5).includes('maj-annuelle'));
  assert.ok(ids(5).includes('liste-actions') && !ids(5).includes('programme'));
  assert.ok(ids(10).includes('maj-evenement'));
  assert.ok(ids(11).includes('maj-annuelle') && ids(11).includes('spst-cse'));
  assert.ok(ids(49).includes('liste-actions') && !ids(49).includes('programme'));
  assert.ok(ids(50).includes('programme') && !ids(50).includes('liste-actions'));
  assert.equal(R.obligations(null).length, BASE.obligations.length);
  assert.equal(R.annuelleObligatoire(10), false);
  assert.equal(R.annuelleObligatoire(11), true);
  assert.equal(R.programmeObligatoire(49), false);
  assert.equal(R.programmeObligatoire(50), true);
  assert.equal(R.tranche(0), 'moins11');
  assert.equal(R.tranche(11), '11a49');
  assert.equal(R.tranche(50), '50plus');
});

test('cotation : score, priorité selon les seuils, résiduel par défaut égal à l\'initial', () => {
  const g = R.normaliserGrille(BASE.grille);
  assert.deepEqual(simple(g.seuils), { p1: 9, p2: 4 });
  assert.equal(R.priorite(16, g), 1);
  assert.equal(R.priorite(9, g), 1);
  assert.equal(R.priorite(8, g), 2);
  assert.equal(R.priorite(4, g), 2);
  assert.equal(R.priorite(3, g), 3);
  assert.equal(R.priorite(null, g), null);
  const c = R.cotation({ g: 4, p: 3, gr: 4, pr: 1 }, g);
  assert.deepEqual(simple(c), { initial: 12, residuel: 4, resSaisi: true, priorite: 2, prioriteInitiale: 1, reduction: 8, aCoter: false });
  const sans = R.cotation({ g: 3, p: 3, gr: null, pr: null }, g);
  assert.equal(sans.residuel, 9);
  assert.equal(sans.priorite, 1);
  assert.equal(sans.resSaisi, false);
  assert.equal(R.cotation({ g: null, p: 2 }, g).aCoter, true);
});

test('grille paramétrable : 3 à 5 niveaux, seuils bornés, cotations ramenées au maximum', () => {
  const g = R.normaliserGrille({ gravite: ['a', 'b', 'c'], probabilite: ['a', 'b', 'c', 'd', 'e'], seuils: { p1: 10, p2: 5 } });
  assert.equal(g.gravite.length, 3);
  assert.equal(g.probabilite.length, 5);
  assert.deepEqual(simple(g.seuils), { p1: 10, p2: 5 });
  // Trop de niveaux ou seuils incohérents : retour à la grille proposée.
  assert.equal(R.normaliserGrille({ gravite: ['a', 'b', 'c', 'd', 'e', 'f'] }).gravite.length, 4);
  assert.equal(R.normaliserGrille({ seuils: { p1: 4, p2: 6 } }).seuils.p2 < R.normaliserGrille({ seuils: { p1: 4, p2: 6 } }).seuils.p1, true);
  assert.equal(R.normaliserGrille({ gravite: ['a', 'b', 'c'], probabilite: ['a', 'b', 'c'], seuils: { p1: 40 } }).seuils.p1, 9);
  const e = etat();
  const ajustes = R.changerGrille(e, { gravite: ['a', 'b', 'c'], probabilite: ['a', 'b', 'c'], seuils: { p1: 6, p2: 3 } });
  assert.equal(ajustes, 2); // r1 : g 4 → 3 et gr 4 → 3
  assert.equal(R.risque(e, 'r1').g, 3);
  assert.equal(R.risque(e, 'r1').gr, 3);
  assert.equal(R.cotation(R.risque(e, 'r1'), e.grille).priorite, 1);
});

test('normalisation tolérante : niveaux hors grille, résiduel incomplet, orphelins retirés', () => {
  const e = R.normaliser({
    unites: [{ id: 'u1', nom: 'A' }],
    risques: [{ id: 'r1', unite: 'u1', famille: 'INCONNUE', g: 9, p: 2, gr: 2 }, { id: 'r2', unite: 'absente', g: 1, p: 1 }],
    actions: [{ id: 'a1', risque: 'r1', intitule: 'X', statut: 'faite', echeance: '2026-01-02' }, { id: 'a2', risque: 'r2' }],
    versions: [{ id: 'v', numero: 2, date: 'mauvaise' }],
    reglages: { alerteJours: 3, revueMois: 6 },
  });
  assert.equal(e.risques.length, 1);
  assert.equal(e.risques[0].famille, 'AUTRE');
  assert.equal(e.risques[0].g, null);
  assert.equal(e.risques[0].gr, null, 'résiduel incomplet ignoré');
  assert.equal(e.actions.length, 1);
  assert.equal(e.actions[0].faiteLe, '2026-01-02');
  assert.equal(e.versions.length, 0);
  assert.equal(e.reglages.alerteJours, 30);
  assert.equal(e.reglages.revueMois, 6);
  assert.deepEqual(simple(R.normaliser(null).unites), []);
});

test('montants : saisie en euros, centimes', () => {
  assert.equal(R.lireMontant('1 200,50 €'), 120050);
  assert.equal(R.lireMontant('350'), 35000);
  assert.equal(R.lireMontant(''), null);
  assert.ok(Number.isNaN(R.lireMontant('12,345')));
  assert.ok(Number.isNaN(R.lireMontant('abc')));
});

test('actions : statut affiché, retard et échéance proche', () => {
  const a = (x) => R.normaliserAction({ risque: 'r1', intitule: 'A', ...x });
  assert.equal(R.statutAction(a({ echeance: '2026-11-13' }), AUJ), 'retard');
  assert.equal(R.statutAction(a({ echeance: '2026-11-30' }), AUJ, 30), 'proche');
  assert.equal(R.statutAction(a({ echeance: '2027-03-01', statut: 'en-cours' }), AUJ, 30), 'en-cours');
  assert.equal(R.statutAction(a({ echeance: '2026-01-01', statut: 'faite' }), AUJ), 'faite');
  assert.equal(R.statutAction(a({ statut: 'abandonnee', echeance: '2026-01-01' }), AUJ), 'abandonnee');
  assert.equal(R.statutAction(a({}), AUJ), 'a-faire');
  const e = etat({ actions: [{ id: 'a1', risque: 'r1', intitule: 'Protecteur', echeance: '2026-12-01' }] });
  assert.equal(typeof R.terminerAction(e, 'a1', '2026-12-01', AUJ), 'string', 'pas dans le futur');
  R.terminerAction(e, 'a1', '2026-11-10', AUJ);
  assert.equal(e.actions[0].statut, 'faite');
  assert.equal(e.actions[0].faiteLe, '2026-11-10');
});

test('prochaine mise à jour : un an dès 11 salariés, revue conseillée en dessous', () => {
  const e = etat();
  assert.equal(R.prochaineMaj(e, AUJ).aucune, true);
  R.archiver(e, { date: '2026-01-31' }, AUJ, id);
  let pm = R.prochaineMaj(e, AUJ);
  assert.equal(pm.date, '2027-01-31');
  assert.equal(pm.obligatoire, true);
  assert.equal(pm.jours, 78);
  e.entreprise.effectif = 6;
  e.reglages.revueMois = 18;
  pm = R.prochaineMaj(e, AUJ);
  assert.equal(pm.obligatoire, false);
  assert.equal(pm.date, '2027-07-31');
});

test('versions : instantané figé, numérotation, dates, résumé des modifications', () => {
  const e = etat();
  assert.equal(typeof R.archiver(e, { date: '2026-11-20' }, AUJ, id), 'string', 'pas dans le futur');
  assert.equal(typeof R.archiver(R.normaliser({}), { date: AUJ }, AUJ, id), 'string', 'au moins une unité');
  const v1 = R.archiver(e, { date: '2025-10-01' }, AUJ, id);
  assert.equal(v1.numero, 1);
  assert.equal(v1.motif, 'creation');
  assert.equal(v1.contenu.risques.length, 4);
  assert.match(v1.resume, /Unités de travail : 2 ajoutées ; Risques : 4 ajoutés/);
  assert.doesNotMatch(v1.resume, /grille|entreprise/, 'première version : pas de comparaison de la grille');
  assert.equal(typeof R.archiver(e, { date: '2025-09-01' }, AUJ, id), 'string', 'pas avant la précédente');
  // Modifier après archivage ne change pas l'instantané.
  R.risque(e, 'r2').gr = 2; R.risque(e, 'r2').pr = 2;
  e.actions.push(R.normaliserAction({ id: 'a1', risque: 'r2', intitule: 'Capotage', statut: 'faite', faiteLe: '2026-05-01' }));
  R.supprimerRisque(e, 'r4');
  assert.equal(v1.contenu.risques.find((r) => r.id === 'r2').gr, null);
  const d = R.modificationsNonArchivees(e);
  assert.deepEqual(simple(d.risques), { ajoutes: 0, supprimes: 1, modifies: 1, cle: 'risques' });
  assert.equal(d.actions.ajoutes, 1);
  assert.equal(d.terminees, 1);
  assert.equal(d.total, 3);
  const v2 = R.archiver(e, { date: '2026-10-01' }, AUJ, id);
  assert.equal(v2.numero, 2);
  assert.equal(v2.motif, 'annuelle');
  assert.match(v2.resume, /1 modifié, 1 supprimé/);
  assert.match(v2.resume, /1 action réalisée/);
  assert.equal(R.modificationsNonArchivees(e).total, 0);
  assert.match(R.resumeDifferences(R.modificationsNonArchivees(e)), /Aucune modification/);
  assert.equal(R.derniereVersion(e).id, v2.id);
  assert.equal(R.conservationJusquau('2026-10-01'), '2066-10-01');
  // Une version restaurée se normalise comme un état complet.
  const relu = R.normaliser(v1.contenu);
  assert.equal(relu.risques.length, 4);
});

test('événements : une mise à jour est due jusqu\'à la version suivante', () => {
  const e = etat();
  R.archiver(e, { date: '2026-03-01' }, AUJ, id);
  e.evenements.push(R.normaliserEvenement({ id: 'ev1', date: '2026-02-01', type: 'accident' }));
  e.evenements.push(R.normaliserEvenement({ id: 'ev2', date: '2026-09-15', type: 'amenagement', texte: 'Nouvelle machine' }));
  assert.deepEqual(simple(R.evenementsEnAttente(e).map((x) => x.id)), ['ev2']);
  const al = R.alertes(e, AUJ);
  assert.ok(al.some((a) => a.genre === 'evenement' && a.niveau === 'retard' && /Nouvelle machine/.test(a.detail)));
  R.archiver(e, { date: '2026-10-01', motif: 'amenagement' }, AUJ, id);
  assert.equal(R.evenementsEnAttente(e).length, 0);
});

test('alertes : mise à jour dépassée ou proche, P1 sans action, à coter, unité vide, programme', () => {
  const e = etat();
  let al = R.alertes(e, AUJ);
  assert.ok(al.some((a) => a.genre === 'version'));
  assert.ok(al.some((a) => a.genre === 'sans-action' && a.id === 'r2'), 'bruit 3 × 3 = 9 : priorité 1 sans action');
  assert.ok(al.some((a) => a.genre === 'coter'));
  R.archiver(e, { date: '2025-10-01' }, AUJ, id);
  al = R.alertes(e, AUJ);
  assert.equal(al[0].niveau, 'retard');
  assert.ok(al.some((a) => a.genre === 'maj' && a.niveau === 'retard'));
  e.versions[0].date = '2025-12-01';
  assert.ok(R.alertes(e, AUJ).some((a) => a.genre === 'maj' && a.niveau === 'proche'));
  e.entreprise.effectif = 8; // sous 11 : plus d'obligation annuelle
  assert.ok(!R.alertes(e, AUJ).some((a) => a.genre === 'maj'));
  e.unites.push(R.normaliserUnite({ id: 'u3', nom: 'Livraison' }));
  assert.ok(R.alertes(e, AUJ).some((a) => a.genre === 'unite' && a.id === 'u3'));
  e.entreprise.effectif = 60;
  e.actions.push(R.normaliserAction({ id: 'a1', risque: 'r2', intitule: 'Capotage', echeance: '2026-11-01' }));
  al = R.alertes(e, AUJ);
  assert.ok(al.some((a) => a.genre === 'programme'));
  assert.ok(al.some((a) => a.genre === 'action' && a.niveau === 'retard'));
  assert.ok(!al.some((a) => a.genre === 'sans-action' && a.id === 'r2'), 'l\'action ouverte couvre le risque');
  e.entreprise.effectif = null;
  assert.ok(R.alertes(e, AUJ).some((a) => a.genre === 'effectif'));
});

test('synthèse, matrice et répartition par unité', () => {
  const e = etat({ actions: [
    { id: 'a1', risque: 'r1', intitule: 'A', statut: 'faite', cout: 10000, faiteLe: '2026-01-01' },
    { id: 'a2', risque: 'r2', intitule: 'B', cout: 25000, echeance: '2026-10-01' },
    { id: 'a3', risque: 'r2', intitule: 'C', statut: 'abandonnee' },
  ] });
  const s = R.synthese(e, AUJ);
  assert.deepEqual(simple(s.parPrio), { 1: 1, 2: 1, 3: 1 });
  assert.equal(s.aCoter, 1);
  assert.equal(s.ouvertes, 1);
  assert.equal(s.faites, 1);
  assert.equal(s.tauxFaites, 50, 'abandonnées exclues');
  assert.equal(s.enRetard, 1);
  assert.equal(s.coutPrevu, 25000);
  assert.equal(s.coutRealise, 10000);
  assert.equal(s.sansAction, 0);
  assert.equal(s.reduits, 1);
  const m = R.matrice(e);
  assert.equal(m[3][1], 1, 'r1 compté sur sa cotation résiduelle (4, 2)');
  assert.equal(m[2][2], 1);
  assert.equal(m[0][2], 1);
  assert.equal(m.flat().reduce((a, b) => a + b, 0), 3);
  assert.equal(R.matrice(e, 'u2').flat().reduce((a, b) => a + b, 0), 1);
  const pu = R.parUnite(e, AUJ);
  assert.deepEqual(simple(pu[0].n), { 1: 1, 2: 1, 3: 0, coter: 0 });
  assert.equal(pu[0].retard, 1);
  assert.equal(pu[1].n.coter, 1);
});

test('plan d\'actions et programme annuel', () => {
  const e = etat({ actions: [
    { id: 'a1', risque: 'r1', intitule: 'Faite', statut: 'faite', faiteLe: '2026-02-01', echeance: '2026-02-01', cout: 1000 },
    { id: 'a2', risque: 'r2', intitule: 'Plus tard', echeance: '2027-03-01', cout: 5000, indicateur: 'OK' },
    { id: 'a3', risque: 'r2', intitule: 'En retard', echeance: '2026-10-01' },
    { id: 'a4', risque: 'r3', intitule: 'Sans date' },
    { id: 'a5', risque: 'r3', intitule: 'Abandonnée', statut: 'abandonnee', echeance: '2026-06-01', cout: 9999 },
  ] });
  assert.deepEqual(simple(R.planActions(e, AUJ).map((x) => x.a.id)), ['a3', 'a2', 'a4', 'a1', 'a5']);
  const p26 = R.programme(e, 2026);
  assert.deepEqual(simple(p26.actions.map((a) => a.id)), ['a1', 'a3']);
  assert.equal(p26.cout, 1000);
  assert.equal(p26.sansCout, 1);
  assert.equal(R.programme(e, 2027).sansIndicateur, 0);
});

test('démarrage depuis un secteur et suppressions en cascade', () => {
  const e = R.etatVide();
  const nb = R.creerDepuisSecteur(e, 'restauration', ['Cuisine', 'Plonge'], id);
  assert.equal(e.unites.length, 2);
  assert.equal(nb, 8);
  assert.ok(e.risques.every((r) => r.g === null && r.danger), 'risques à examiner, non cotés');
  assert.equal(R.creerDepuisSecteur(e, 'inconnu', null, id), 0);
  e.actions.push(R.normaliserAction({ id: 'a1', risque: e.risques[0].id, intitule: 'X' }));
  R.supprimerUnite(e, e.unites[0].id);
  assert.equal(e.unites.length, 1);
  assert.equal(e.risques.length, 3);
  assert.equal(e.actions.length, 0);
});

test('exports CSV : en-têtes, séparateur point-virgule, guillemets', () => {
  const e = etat({ actions: [{ id: 'a1', risque: 'r1', intitule: 'Poussoir; guide "parallèle"', cout: 85050, echeance: '2026-12-01' }] });
  const r = R.versCsvRisques(e);
  assert.ok(r.startsWith('﻿Unité de travail;Famille de risque;'));
  assert.match(r, /Atelier;Équipements de travail et machines;Scie;;;4;3;12;;4;2;8;Priorité 2;1;/);
  assert.match(r, /Bureau;Risques psychosociaux;Charge;;;;;;;;;;À coter;0;/);
  const a = R.versCsvActions(e, AUJ);
  assert.match(a, /"Poussoir; guide ""parallèle""";Organisation du travail;Scie;Atelier;Priorité 2;;2026-12-01;850,50;;Échéance proche;/);
});
