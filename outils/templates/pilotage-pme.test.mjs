// Tests des règles métier du Tableau de bord de pilotage PME (templates/pilotage-pme/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/pilotage-pme/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R0 = ctx.window.TDB;
// Les formats utilisent des espaces insécables : on les remplace par des espaces simples pour comparer.
const esp = (x) => (typeof x === 'string' ? x.replace(/[\u00A0\u202F]/g, ' ') : x);
const R = { ...R0, format: (...a) => esp(R0.format(...a)), formatEcart: (...a) => esp(R0.formatEcart(...a)), nombre: (...a) => esp(R0.nombre(...a)) };
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// État de test : indicateurs du profil choisi, saisies { 'AAAA-MM': { id: valeur } }.
function etat({ profil = 'services', ids = null, saisies = {}, objectifs = {}, debutMois = 1 } = {}) {
  const E = R.normaliser({ debutMois });
  for (const id of ids || BASE.profils.find((p) => p.id === profil).indicateurs) R.ajouterModele(E, BASE, id);
  E.saisies = saisies;
  E.objectifs = objectifs;
  return E;
}

test('base intégrée : six domaines, identifiants uniques, calculs qui pointent vers la base, sans boucle', () => {
  assert.deepEqual(simple(BASE.domaines.map((d) => d.id)), ['commercial', 'finances', 'tresorerie', 'rh', 'production', 'qualite']);
  const ids = BASE.indicateurs.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 40);
  for (const k of BASE.indicateurs) {
    assert.ok(BASE.domaines.some((d) => d.id === k.domaine), k.id);
    assert.ok(R.SENS[k.sens], k.id);
    assert.ok(R.CUMULS[k.cumul], k.id);
    assert.ok(BASE.unites.some(([u]) => u === k.unite), k.id);
    for (const c of ['definition', 'formule', 'lecture', 'source', 'conseil']) assert.ok(k[c] && k[c].length > 10, `${k.id}.${c}`);
    if (k.calcul) {
      assert.ok(ids.includes(k.calcul.a) && ids.includes(k.calcul.b), k.id);
      assert.ok(['ratio', 'difference'].includes(k.calcul.type));
    } else assert.notEqual(k.cumul, 'recalcul', k.id);
  }
  for (const d of BASE.domaines) assert.ok(BASE.indicateurs.filter((k) => k.domaine === d.id).length >= 5, d.id);
  for (const p of BASE.profils) for (const id of p.indicateurs) assert.ok(ids.includes(id), `${p.id} : ${id}`);
  // Aucun ratio de référence chiffré dans la base (pas de « en moyenne », « norme », « secteur »).
  assert.doesNotMatch(JSON.stringify(BASE.indicateurs), /en moyenne dans|norme du secteur|moyenne du secteur|ratio de référence/i);
});

test('mois et exercices', () => {
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ajoutMois('2026-03', -27), '2023-12');
  assert.equal(R.ecartMois('2025-11', '2026-02'), 3);
  assert.equal(R.exerciceDe('2026-05', 1), 2026);
  assert.equal(R.exerciceDe('2026-05', 7), 2025);
  assert.equal(R.exerciceDe('2026-07', 7), 2026);
  assert.deepEqual(simple(R.moisExercice(2026, 7).slice(0, 2)), ['2026-07', '2026-08']);
  assert.equal(R.moisExercice(2026, 7)[11], '2027-06');
  assert.equal(R.indexExercice('2027-02', 7), 7);
  assert.deepEqual(simple(R.derniersMois('2026-02', 3)), ['2025-12', '2026-01', '2026-02']);
  assert.equal(R.libMois('2026-08'), 'août 2026');
  assert.equal(R.libExercice(2026, 1), '2026');
  assert.equal(R.libExercice(2026, 7), 'juil. 2026 → juin 2027');
});

test('saisie tolérante et formats', () => {
  assert.equal(R.lireNombre('1 234,5'), 1234.5);
  assert.equal(R.lireNombre('−12 000 €'), -12000);
  assert.equal(R.lireNombre('35 %'), 35);
  assert.equal(R.lireNombre(''), null);
  assert.equal(R.lireNombre('abc'), null);
  assert.equal(R.lireNombre('-3', { signe: false }), null);
  const eur = { unite: '€', decimales: 0 }, taux = { unite: '%', decimales: 1 };
  assert.equal(R.format(eur, 123456), '123 456 €');
  assert.equal(R.format(eur, 123456, { compact: true }), '123 k€');
  assert.equal(R.format(eur, 1234567, { compact: true }), '1,23 M€');
  assert.equal(R.format(eur, -4500), '−4 500 €');
  assert.equal(R.format(taux, 34.56), '34,6 %');
  assert.equal(R.format({ unite: 'note', decimales: 1 }, 8.25), '8,3 /10');
  assert.equal(R.format(eur, null), '–');
  assert.equal(R.formatEcart(taux, -2.5), '−2,5 pts');
  assert.equal(R.formatEcart(eur, 1500), '+1 500 €');
  assert.equal(R.saisie(-1234567.25), '-1 234 567,25');
  assert.equal(R.lireNombre(R.saisie(98765.4)), 98765.4);
  assert.equal(R.saisie(null), '');
});

test('valeurs calculées : différence, rapport, composante manquante, division par zéro', () => {
  const E = etat({ ids: [...BASE.profils[0].indicateurs, 'point-mort'], saisies: { '2026-03': { ca: 100000, achats: 40000, 'charges-fixes': 45000, creances: 90000, tresorerie: 135000 } } });
  assert.equal(R.valeur(E, 'marge-brute', '2026-03'), 60000);
  proche(R.valeur(E, 'taux-marge', '2026-03'), 60);
  assert.equal(R.valeur(E, 'resultat-gestion', '2026-03'), 15000);
  proche(R.valeur(E, 'point-mort', '2026-03'), 75000);
  proche(R.valeur(E, 'dso', '2026-03'), 27);
  assert.equal(R.valeur(E, 'taux-transformation', '2026-03'), null); // devis non saisis
  E.saisies['2026-03']['devis-emis'] = 0; E.saisies['2026-03']['devis-signes'] = 0;
  assert.equal(R.valeur(E, 'taux-transformation', '2026-03'), null);
  assert.equal(R.valeur(E, 'inconnu', '2026-03'), null);
});

test('boucle de calcul : aucune récursion infinie, détection à la création', () => {
  const E = R.normaliser({ indicateurs: [{ id: 'x', nom: 'X', calcul: { type: 'difference', a: 'y', b: 'z' } }, { id: 'y', nom: 'Y', calcul: { type: 'difference', a: 'x', b: 'z' } }, { id: 'z', nom: 'Z' }], saisies: { '2026-01': { z: 1 } } });
  assert.equal(R.valeur(E, 'x', '2026-01'), null);
  assert.equal(R.valeurPeriode(E, 'x', ['2026-01']), null);
  assert.equal(R.creeBoucle(E, 'z', { type: 'ratio', a: 'x', b: 'z' }), true);
  assert.equal(R.creeBoucle(E, 'nouveau', { type: 'ratio', a: 'z', b: 'z' }), false);
});

test('cumuls : somme, dernier, moyenne, recalcul sur les seuls mois complets', () => {
  const s = { '2026-01': { ca: 100, achats: 50, tresorerie: 10, satisfaction: 8 }, '2026-02': { ca: 300, achats: 90, tresorerie: 20, satisfaction: 9 }, '2026-03': { ca: 200, tresorerie: 5 } };
  const E = etat({ saisies: s });
  const l = ['2026-01', '2026-02', '2026-03'];
  assert.equal(R.valeurPeriode(E, 'ca', l), 600);
  assert.equal(R.valeurPeriode(E, 'tresorerie', l), 5);
  proche(R.valeurPeriode(E, 'satisfaction', l), 8.5);
  // Mars sans achats : la marge de mars est inconnue, le taux cumulé porte sur janvier et février seuls.
  assert.equal(R.valeurPeriode(E, 'marge-brute', l), 260);
  proche(R.valeurPeriode(E, 'taux-marge', l), (260 / 400) * 100);
  // Jamais la moyenne des taux (50 % et 70 % → 65 %, pas 60 %).
  assert.notEqual(Math.round(R.valeurPeriode(E, 'taux-marge', l)), 60);
  assert.equal(R.valeurPeriode(E, 'ca', ['2025-01']), null);
});

test('répartition de l\'objectif : somme exacte, saisonnalité, négatif', () => {
  const r = R.repartir(100000);
  assert.equal(r.reduce((a, b) => a + b, 0), 100000);
  assert.ok(r.every((x) => x === 8333 || x === 8334));
  const p = R.repartir(1000, [1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1]);
  assert.equal(p[6], 0);
  assert.equal(p.reduce((a, b) => a + b, 0), 1000);
  const d = R.repartir(10, null, 1);
  proche(d.reduce((a, b) => a + b, 0), 10);
  const n = R.repartir(-1200);
  assert.ok(n.every((x) => x === -100));
  assert.deepEqual(simple(R.repartir(null)), Array(12).fill(null));
});

test('objectifs mensuels : égale, saisonnière d\'après l\'an dernier, manuelle, niveau, exercice décalé', () => {
  const saisies = {};
  R.moisExercice(2025, 1).forEach((m, i) => { saisies[m] = { ca: i === 7 ? 50 : 100 }; }); // août creux
  const E = etat({ saisies, objectifs: { 2026: { ca: { annuel: 1150, repartition: 'saisonniere' }, tresorerie: { annuel: 80000, repartition: 'egale' }, 'charges-fixes': { repartition: 'manuelle', mensuels: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20] } } } });
  const ca = R.objectifsMensuels(E, 'ca', 2026);
  assert.equal(ca[7], 50);
  assert.equal(ca[0], 100);
  assert.equal(R.objectifAnnuel(E, 'ca', 2026), 1150);
  assert.equal(R.objectifMois(E, 'tresorerie', '2026-05'), 80000); // niveau : la cible de chaque mois
  assert.equal(R.objectifAnnuel(E, 'tresorerie', 2026), 80000);
  assert.equal(R.objectifMois(E, 'charges-fixes', '2026-12'), 20);
  assert.equal(R.objectifAnnuel(E, 'charges-fixes', 2026), 130);
  // Saisonnière sans année précédente complète → égale.
  E.objectifs['2027'] = { ca: { annuel: 1200, repartition: 'saisonniere' } };
  assert.ok(R.objectifsMensuels(E, 'ca', 2027).every((x) => x === 100));
  // Exercice de juillet à juin : juillet 2026 est le premier mois de l'exercice 2026.
  const F = etat({ debutMois: 7, objectifs: { 2026: { ca: { repartition: 'manuelle', mensuels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } } } });
  assert.equal(R.objectifMois(F, 'ca', '2026-07'), 1);
  assert.equal(R.objectifMois(F, 'ca', '2027-06'), 12);
  assert.equal(R.objectifMois(F, 'ca', '2026-06'), null);
});

test('statuts : sens haut, bas, cible, neutre, tolérance, plancher et plafond', () => {
  const k = (extra) => R.normaliserIndicateur({ id: 't', sens: 'haut', tolerance: 10, ...extra });
  assert.equal(R.statut(k(), 100, 100), 'atteint');
  assert.equal(R.statut(k(), 95, 100), 'vigilance');
  assert.equal(R.statut(k(), 89, 100), 'alerte');
  assert.equal(R.statut(k({ sens: 'bas' }), 105, 100), 'vigilance');
  assert.equal(R.statut(k({ sens: 'bas' }), 99, 100), 'atteint');
  assert.equal(R.statut(k({ sens: 'bas' }), 111, 100), 'alerte');
  assert.equal(R.statut(k({ sens: 'cible' }), 108, 100), 'atteint');
  assert.equal(R.statut(k({ sens: 'cible' }), 85, 100), 'vigilance');
  assert.equal(R.statut(k({ sens: 'cible' }), 70, 100), 'alerte');
  assert.equal(R.statut(k({ sens: 'neutre' }), 70, 100), 'neutre');
  assert.equal(R.statut(k(), 70, null), 'neutre');
  assert.equal(R.statut(k(), null, 100), 'vide');
  assert.equal(R.statut(k({ plancher: 50000 }), 40000, null), 'alerte');
  assert.equal(R.statut(k({ plancher: 50000 }), 40000, null, { seuils: false }), 'neutre');
  assert.equal(R.statut(k({ sens: 'bas', plafond: 20 }), 25, 30), 'alerte');
  assert.equal(R.statut(k({ tolerance: 0 }), 99, 100), 'alerte');
  // Objectif négatif (résultat attendu en perte) : la tolérance porte sur la valeur absolue.
  assert.equal(R.statut(k(), -105, -100), 'vigilance');
  const e = R.ecart(90, 120);
  assert.equal(e.abs, -30);
  proche(e.pct, -25);
  assert.equal(R.ecart(5, 0).pct, null);
});

test('tendance sur 3 mois et comparaison à l\'an dernier', () => {
  const s = { '2026-01': { ca: 100, achats: 10 }, '2026-02': { ca: 100, achats: 10 }, '2026-03': { ca: 100, achats: 10 }, '2026-04': { ca: 130, achats: 10 }, '2026-05': { ca: 120, achats: 10 }, '2026-06': { ca: 125, achats: 10 }, '2025-06': { ca: 100 } };
  const E = etat({ saisies: s });
  const t = R.tendance(E, 'ca', '2026-06');
  assert.equal(t.direction, 'hausse');
  assert.equal(t.favorable, true);
  proche(t.variation, 25);
  const a = R.tendance(E, 'achats', '2026-06');
  assert.equal(a.direction, 'stable');
  assert.equal(a.favorable, null);
  E.saisies['2026-06'].achats = 30; E.saisies['2026-05'].achats = 30;
  assert.equal(R.tendance(E, 'achats', '2026-06').favorable, false); // achats en hausse : défavorable
  assert.equal(R.tendance(E, 'ca', '2026-02'), null); // pas assez d'historique
  const v = R.variationAn(E, 'ca', '2026-06');
  assert.equal(v.delta, 25);
  proche(v.pct, 25);
  assert.equal(R.variationAn(E, 'ca', '2026-05'), null);
});

test('cumul de l\'exercice, mois manquants et projection de fin d\'exercice', () => {
  const s = { '2026-01': { ca: 90 }, '2026-02': { ca: 110 }, '2026-04': { ca: 120 } };
  const E = etat({ saisies: s, objectifs: { 2026: { ca: { annuel: 1200, repartition: 'egale' } } } });
  const c = R.cumulExercice(E, 'ca', '2026-04');
  assert.equal(c.reel, 320);
  assert.equal(c.objectif, 300); // mars non saisi : non compté dans l'objectif cumulé
  assert.equal(c.manquants, 1);
  assert.equal(c.statut, 'atteint');
  const p = R.projection(E, 'ca', '2026-04');
  assert.equal(p.base, 'objectif');
  proche(p.valeur, 1280);
  // Sans objectif : rythme moyen × 12.
  const F = etat({ saisies: s });
  const q = R.projection(F, 'ca', '2026-04');
  assert.equal(q.base, 'rythme');
  proche(q.valeur, (320 / 3) * 12);
  assert.equal(R.projection(E, 'tresorerie', '2026-04'), null); // niveau : pas de projection
});

test('synthèse du mois, complétude et mois par défaut', () => {
  const E = etat({ ids: ['ca', 'tresorerie'], saisies: { '2026-09': { ca: 80, tresorerie: 5 }, '2026-10': { ca: 120 } }, objectifs: { 2026: { ca: { annuel: 1200 }, tresorerie: { annuel: 10 } } } });
  const s = R.synthese(E, '2026-10');
  assert.equal(s.parStatut.atteint, 1);
  assert.equal(s.parStatut.vide, 1);
  assert.deepEqual(simple(s.completude.manquants), ['tresorerie']);
  const s9 = R.synthese(E, '2026-09');
  assert.equal(s9.alertes.length, 2);
  assert.equal(R.moisParDefaut(E, '2026-11'), '2026-10');
  assert.equal(R.moisParDefaut(E, '2026-09'), '2026-09');
  assert.equal(R.moisParDefaut(etat({ ids: ['ca'] }), '2026-11'), '2026-10');
});

test('bibliothèque : ajout avec composantes, réactivation, dépendances', () => {
  const E = R.normaliser({});
  const ajoutes = R.ajouterModele(E, BASE, 'point-mort');
  assert.deepEqual(simple(ajoutes), ['charges-fixes', 'ca', 'achats', 'marge-brute', 'taux-marge', 'point-mort']);
  assert.deepEqual(simple(R.ajouterModele(E, BASE, 'taux-marge')), []);
  R.indicateur(E, 'ca').actif = false;
  assert.deepEqual(simple(R.ajouterModele(E, BASE, 'ca')), ['ca']);
  assert.deepEqual(simple(R.utilisePar(E, 'ca').map((k) => k.id)), ['marge-brute', 'taux-marge']);
  const k = R.indicateur(E, 'taux-marge');
  assert.equal(k.modele, 'taux-marge');
  assert.equal(k.cumul, 'recalcul');
  assert.equal(k.calcul.facteur, 100);
});

test('revue : actions ouvertes des mois précédents reprises', () => {
  const E = R.normaliser({ revues: { '2026-08': { actions: [{ texte: 'Relancer', statut: 'ouverte', echeance: '2026-10-15' }, { texte: 'Fait', statut: 'faite' }] }, '2026-09': { actions: [{ texte: 'Recruter', echeance: '2026-09-30' }] }, '2026-10': { actions: [{ texte: 'Ce mois' }] } } });
  const r = R.actionsReprises(E, '2026-10');
  assert.deepEqual(simple(r.map((a) => a.texte)), ['Recruter', 'Relancer']);
  assert.equal(r[0].mois, '2026-09');
});

test('normalisation tolérante et exports CSV', () => {
  const E = R.normaliser({ debutMois: 15, indicateurs: [{ id: 'a', nom: 'A', cumul: 'recalcul' }, { id: 'a', nom: 'doublon' }, { nom: '', sens: 'nimporte' }], saisies: { '2026-13': { a: 1 }, '2026-02': { a: 'x', b: 3 } }, objectifs: { 2026: { a: { annuel: '1 200' }, b: {} }, xx: {} }, revues: { '2026-02': { actions: [{ texte: '' }, { texte: 'Ok', echeance: 'demain' }] } } });
  assert.equal(E.debutMois, 1);
  assert.equal(E.indicateurs.length, 2);
  assert.equal(E.indicateurs[0].cumul, 'somme');
  assert.equal(E.indicateurs[1].sens, 'haut');
  assert.deepEqual(simple(E.saisies), { '2026-02': { b: 3 } });
  assert.equal(E.objectifs['2026'].a.annuel, 1200);
  assert.equal(E.objectifs['2026'].b, undefined);
  assert.equal(E.revues['2026-02'].actions.length, 1);
  assert.equal(E.revues['2026-02'].actions[0].echeance, '');
  const F = etat({ ids: ['ca', 'achats', 'taux-marge'], saisies: { '2026-01': { ca: 1000.5, achats: 400 } } });
  const c = R.versCsvRevue(F, '2026-01', BASE.domaines);
  assert.ok(c.startsWith('﻿Domaine;Indicateur'));
  assert.match(c, /Finances;Taux de marge brute;%/);
  const d = R.versCsvSaisies(F);
  assert.match(d, /2026-01;1000,5;400;600,5;60,0/);
});
