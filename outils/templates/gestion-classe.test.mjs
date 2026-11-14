// Tests des règles métier de la gestion de classe (templates/gestion-classe/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/gestion-classe/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CSE;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const ev = (x) => R.normaliserEvaluation({ classeId: 'c1', titre: 'Contrôle', date: '2026-10-01', bareme: 20, coef: 1, ...x });

// Petite classe fictive : une année en trimestres, trois élèves.
function etat() {
  const e = R.etatVide(B);
  const an = R.normaliserAnnee({ id: 'a1', nom: '2026-2027', debut: '2026-09-01', periodes: [{ id: 'p1', nom: 'Trimestre 1', fin: '2026-11-30' }, { id: 'p2', nom: 'Trimestre 2', fin: '2027-03-15' }, { id: 'p3', nom: 'Trimestre 3', fin: '2027-06-30' }] });
  e.annees.push(an); e.anneeId = 'a1';
  e.classes.push(R.normaliserClasse({ id: 'c1', anneeId: 'a1', nom: '4e B', matiere: 'Mathématiques' }));
  for (const [id, nom] of [['e1', 'Léa M.'], ['e2', 'Hugo T.'], ['e3', 'Inès B.']]) e.eleves.push(R.normaliserEleve({ id, classeId: 'c1', nom }));
  return e;
}

test('année scolaire : commence le 1er septembre, août compte pour la suivante', () => {
  assert.deepEqual(simple(R.anneeScolaire('2026-11-14')), { nom: '2026-2027', debut: '2026-09-01' });
  assert.deepEqual(simple(R.anneeScolaire('2027-03-02')), { nom: '2026-2027', debut: '2026-09-01' });
  assert.equal(R.anneeScolaire('2027-08-20').nom, '2027-2028');
});

test('périodes proposées : trimestres et semestres, années de fin correctes', () => {
  const t = R.periodesParDefaut(B, 'trimestres', '2026-09-01').map((p) => p.fin);
  assert.deepEqual(simple(t), ['2026-11-30', '2027-03-15', '2027-06-30']);
  const s = R.periodesParDefaut(B, 'semestres', '2026-09-01').map((p) => p.fin);
  assert.deepEqual(simple(s), ['2027-01-31', '2027-06-30']);
});

test('période d\'une date : bornes incluses, avant et après l\'année ramenés aux extrémités', () => {
  const an = etat().annees[0];
  assert.equal(R.periodeDe(an, '2026-11-30').id, 'p1');
  assert.equal(R.periodeDe(an, '2026-12-01').id, 'p2');
  assert.equal(R.periodeDe(an, '2026-08-15').id, 'p1');
  assert.equal(R.periodeDe(an, '2027-07-10').id, 'p3');
  assert.equal(R.bornes(an)[1].debut, '2026-12-01');
  assert.equal(R.periodeDe(R.normaliserAnnee({ periodes: [] }), '2026-10-01'), null);
});

test('saisie rapide d\'une note : nombres à la française, codes spéciaux, barème', () => {
  assert.deepEqual(simple(R.lireNote('14,5', 20, B)), { valeur: 14.5 });
  assert.deepEqual(simple(R.lireNote(' 0 ', 20, B)), { valeur: 0 });
  assert.deepEqual(simple(R.lireNote('a', 20, B)), { valeur: 'ABS' });
  assert.deepEqual(simple(R.lireNote('ABS', 20, B)), { valeur: 'ABS' });
  assert.deepEqual(simple(R.lireNote('n', 20, B)), { valeur: 'NN' });
  assert.deepEqual(simple(R.lireNote('Disp', 20, B)), { valeur: 'DISP' });
  assert.deepEqual(simple(R.lireNote('', 20, B)), { vide: true });
  assert.ok(R.lireNote('21', 20, B).erreur);
  assert.ok(R.lireNote('-2', 20, B).erreur);
  assert.ok(R.lireNote('douze', 20, B).erreur);
  assert.deepEqual(simple(R.lireNote('35', 40, B)), { valeur: 35 });
});

test('notes ramenées sur 20 et moyenne pondérée par les coefficients', () => {
  assert.equal(R.sur20(7, 10), 14);
  assert.equal(R.sur20(30, 40), 15);
  assert.equal(R.sur20('ABS', 20), null);
  const evs = [ev({ id: 'v1', bareme: 10, coef: 1, notes: { e1: 5 } }), ev({ id: 'v2', bareme: 20, coef: 2, notes: { e1: 16 } })];
  // (10 × 1 + 16 × 2) / 3 = 14
  assert.equal(R.moyenneEleve(evs, 'e1').moyenne, 14);
  assert.equal(R.moyenneEleve(evs, 'e1').nb, 2);
});

test('notes spéciales ABS, NN, dispensé : jamais comptées', () => {
  const evs = [ev({ id: 'v1', notes: { e1: 12, e2: 'ABS' } }), ev({ id: 'v2', notes: { e1: 'DISP', e2: 'NN' } }), ev({ id: 'v3', notes: { e1: 8 } })];
  assert.equal(R.moyenneEleve(evs, 'e1').moyenne, 10);
  assert.equal(R.moyenneEleve(evs, 'e2').moyenne, null);
  // Coefficient nul : l'évaluation ne pèse rien.
  assert.equal(R.moyenneEleve([ev({ coef: 0, notes: { e1: 2 } }), ev({ notes: { e1: 18 } })], 'e1').moyenne, 18);
});

test('évaluation bonus : comptée seulement si elle fait monter la moyenne', () => {
  const base = [ev({ id: 'v1', date: '2026-10-01', notes: { e1: 10, e2: 16 } })];
  const bonus = ev({ id: 'b1', date: '2026-10-05', bonus: true, notes: { e1: 14, e2: 12 } });
  const m1 = R.moyenneEleve([...base, bonus], 'e1');
  assert.equal(m1.moyenne, 12);
  assert.deepEqual(simple(m1.bonusRetenus), ['b1']);
  const m2 = R.moyenneEleve([...base, bonus], 'e2');
  assert.equal(m2.moyenne, 16);
  assert.deepEqual(simple(m2.bonusRetenus), []);
  // Sans note ordinaire, un bonus seul ne fait pas de moyenne.
  assert.equal(R.moyenneEleve([bonus], 'e1').moyenne, null);
});

test('statistiques : moyenne, min, max, médiane (paire et impaire), répartition', () => {
  const s = R.stats([12, 8, null, 15, 9]);
  assert.equal(s.n, 4);
  assert.equal(s.min, 8);
  assert.equal(s.max, 15);
  assert.equal(s.mediane, 10.5);
  assert.equal(s.moyenne, 11);
  assert.equal(R.stats([3, 1, 2]).mediane, 2);
  assert.equal(R.stats([]).moyenne, null);
  const r = R.repartition([7.99, 8, 10, 12, 15.5, 16, 20]).map((t) => t.n);
  assert.deepEqual(simple(r), [1, 1, 1, 1, 1, 2]);
});

test('moyennes d\'une période et moyenne annuelle (chaque période pèse autant)', () => {
  const e = etat();
  e.evaluations.push(ev({ id: 'v1', date: '2026-10-01', notes: { e1: 10, e2: 14, e3: 'ABS' } }));
  e.evaluations.push(ev({ id: 'v2', date: '2026-11-20', coef: 3, notes: { e1: 14, e2: 10 } }));
  e.evaluations.push(ev({ id: 'v3', date: '2027-01-10', notes: { e1: 18 } }));
  const an = e.annees[0];
  const mp = R.moyennesPeriode(e, 'c1', an, 'p1');
  assert.equal(mp.evals.length, 2);
  assert.equal(mp.par.e1, 13);
  assert.equal(mp.par.e2, 11);
  assert.equal(mp.par.e3, null);
  assert.equal(mp.stats.moyenne, 12);
  assert.equal(mp.stats.n, 2);
  assert.equal(R.moyenneAnnuelle(e, 'c1', an, 'e1'), 15.5); // (13 + 18) / 2
  const se = R.statsEvaluation(e.evaluations[2], R.elevesDe(e, 'c1'));
  assert.equal(se.manquantes, 2);
});

test('compétences : bilan = moyenne des niveaux arrondie, ,5 vers le haut', () => {
  assert.equal(R.niveauBilan([2, 3]), 3);
  assert.equal(R.niveauBilan([1, 2, 2]), 2);
  assert.equal(R.niveauBilan([4, 4, 3]), 4);
  assert.equal(R.niveauBilan([]), null);
  const evs = [ev({ date: '2026-10-01', competences: ['k1'], niveaux: { e1: { k1: 1 } } }), ev({ date: '2026-10-08', competences: ['k1'], niveaux: { e1: { k1: 4 } } })];
  const b = R.bilanCompetence(evs, 'e1', 'k1');
  assert.equal(b.niveau, 3);
  assert.equal(b.nb, 2);
  assert.equal(b.dernier, 4);
  // Niveau hors échelle rejeté à la normalisation.
  assert.deepEqual(simple(ev({ niveaux: { e1: { k1: 7, k2: 2 } } }).niveaux), { e1: { k2: 2 } });
});

test('référentiel du socle commun : 5 domaines, 4 composantes du domaine 1, échelle à 4 échelons sourcée', () => {
  const s = R.referentiel(B, 'socle');
  assert.equal(s.length, 8);
  assert.equal(s.filter((c) => c.code.startsWith('D1')).length, 4);
  assert.deepEqual(simple(B.niveaux.map((n) => n.nom)), ['Maîtrise insuffisante', 'Maîtrise fragile', 'Maîtrise satisfaisante', 'Très bonne maîtrise']);
  assert.match(B.source.url, /^https:\/\/www\.legifrance\.gouv\.fr\//);
  assert.equal(B.source.consulte, '14/11/2026');
  assert.ok(R.referentiel(B, 'generique').length >= 4);
});

test('appréciations : prénom, composition, suggestion de niveau, écriture et effacement', () => {
  assert.equal(R.prenom('Léa M.'), 'Léa');
  assert.equal(R.composer('{prenom} s\'investit.', { nom: 'Hugo T.' }), 'Hugo s\'investit.');
  assert.equal(R.ajouterPhrase('Bon trimestre', 'Continue.'), 'Bon trimestre. Continue.');
  assert.equal(R.ajouterPhrase('', 'Continue.'), 'Continue.');
  assert.equal(R.niveauSuggere(7.5), 1);
  assert.equal(R.niveauSuggere(12), 3);
  assert.equal(R.niveauSuggere(null), null);
  let e = etat();
  e = R.ecrireAppreciation(e, 'e1', 'p1', 'Bon travail.');
  e = R.ecrireAppreciation(e, 'e1', 'p1', 'Très bon travail.');
  assert.equal(e.appreciations.length, 1);
  assert.equal(R.appreciationDe(e, 'e1', 'p1'), 'Très bon travail.');
  e = R.ecrireAppreciation(e, 'e1', 'p1', '  ');
  assert.equal(e.appreciations.length, 0);
  assert.ok(B.banque.every(([axe, n]) => B.axes.some((a) => a.code === axe) && n >= 1 && n <= 4));
});

test('à faire : notes à saisir, évaluations à venir, appréciations avant la fin de période', () => {
  const e = etat();
  e.evaluations.push(ev({ id: 'v1', date: '2026-10-01', notes: { e1: 10, e2: 12 } })); // e3 manquant, plus de 14 jours
  e.evaluations.push(ev({ id: 'v2', date: '2026-11-10', notes: { e1: 10, e2: 12, e3: 'ABS' } })); // complet
  e.evaluations.push(ev({ id: 'v3', date: '2026-11-20', notes: {} })); // à venir
  e.evaluations.push(ev({ id: 'v4', date: '2026-11-12', bareme: 0, notes: {} })); // non notée : rien à saisir
  const l = R.aFaire(e, e.annees[0], '2026-11-14', 21);
  assert.deepEqual(simple(l.map((x) => [x.type, x.etat, x.nb])), [['notes', 'retard', 1], ['appreciations', 'proche', 3], ['avenir', 'avenir', 0]]);
  // Hors de la fenêtre de fin de période : pas d'appréciations à rédiger.
  assert.ok(!R.aFaire(e, e.annees[0], '2026-10-02', 21).some((x) => x.type === 'appreciations'));
});

test('bulletin : moyenne, classe, évaluations, compétences et texte à copier', () => {
  let e = etat();
  e.competences = [R.normaliserCompetence({ id: 'k1', code: 'D2', nom: 'Les méthodes et outils pour apprendre' })];
  e.evaluations.push(ev({ id: 'v1', titre: 'Fractions', date: '2026-10-01', notes: { e1: 15, e2: 9 }, competences: ['k1'], niveaux: { e1: { k1: 3 } } }));
  e.evaluations.push(ev({ id: 'v2', titre: 'Bonus', date: '2026-10-10', bonus: true, notes: { e1: 19 } }));
  e = R.ecrireAppreciation(e, 'e1', 'p1', 'Très bon trimestre.');
  const b = R.bulletin(e, B, 'e1', 'p1');
  assert.equal(b.moyenne, 17);
  assert.equal(b.classeStats.n, 2);
  assert.equal(b.evals[1].bonusRetenu, true);
  assert.equal(b.competences[0].niveau, 3);
  const t = R.texteBulletin(b, 2);
  assert.match(t, /Léa M\. · 4e B · Mathématiques/);
  assert.match(t, /Moyenne : 17,00 \/ 20/);
  assert.match(t, /Maîtrise satisfaisante/);
  assert.match(t, /bonus retenu/);
  assert.match(t, /Très bon trimestre\./);
  assert.equal(R.bulletin(e, B, 'inconnu', 'p1'), null);
});

test('export CSV : point-virgule, BOM, décimales à la virgule, formules neutralisées', () => {
  const e = etat();
  e.eleves[0].nom = '=Léa';
  e.evaluations.push(ev({ id: 'v1', titre: 'Contrôle ; 1', notes: { e1: 12.5, e2: 'ABS' } }));
  const c = R.csvClasse(e, 'c1', e.annees[0], 'p1');
  assert.ok(c.startsWith('﻿Élève;'));
  assert.match(c, /"Contrôle ; 1/);
  assert.match(c, /'=Léa;12,5;12,5/);
  assert.match(c, /ABS/);
  const t = R.csvTout(e);
  assert.match(t, /2026-2027;4e B;Mathématiques;Trimestre 1;'=Léa;"Contrôle ; 1";01\/10\/2026;20;1;12,5;12,5/);
});

test('fin d\'année : élèves, notes et appréciations effacés, structure gardée', () => {
  let e = etat();
  e.evaluations.push(ev({ id: 'v1', notes: { e1: 12 }, niveaux: { e1: { k: 2 } } }));
  e = R.ecrireAppreciation(e, 'e1', 'p1', 'Bien.');
  const n = R.effacerAnnee(e, 'a1');
  assert.equal(n.eleves.length, 0);
  assert.equal(n.appreciations.length, 0);
  assert.equal(n.classes.length, 1);
  assert.equal(n.evaluations.length, 1);
  assert.deepEqual(simple(n.evaluations[0].notes), {});
  assert.equal(n.annees.length, 1);
  assert.equal(n.competences.length, e.competences.length);
  // L'état d'origine n'est pas modifié (annulation possible).
  assert.equal(e.eleves.length, 3);
});

test('suppressions et reprise des classes d\'une année sur l\'autre', () => {
  let e = etat();
  e.evaluations.push(ev({ id: 'v1', notes: { e1: 12, e2: 8 } }));
  const s = R.supprimerEleve(e, 'e1');
  assert.equal(s.eleves.length, 2);
  assert.deepEqual(simple(s.evaluations[0].notes), { e2: 8 });
  e.annees.push(R.normaliserAnnee({ id: 'a2', nom: '2027-2028', debut: '2027-09-01' }));
  e = R.reprendreClasses(e, 'a1', 'a2');
  assert.equal(e.classes.filter((c) => c.anneeId === 'a2').length, 1);
  assert.equal(R.reprendreClasses(e, 'a1', 'a2').classes.length, 2); // pas de doublon
  const sa = R.supprimerAnnee(e, 'a1');
  assert.equal(sa.annees.length, 1);
  assert.equal(sa.eleves.length, 0);
  assert.equal(sa.evaluations.length, 0);
});

test('liste d\'élèves collée : une par ligne, sans doublon ni ligne vide', () => {
  assert.deepEqual(simple(R.lireListe('Léa M.\n\n  Hugo   T. \nléa m.;Inès B.')), ['Léa M.', 'Hugo T.', 'Inès B.']);
});

test('normalisation tolérante : état vide, valeurs aberrantes, année courante retrouvée', () => {
  const v = R.normaliser(null, B);
  assert.equal(v.competences.length, 8);
  assert.ok(v.banque.length >= 24);
  assert.equal(v.reglages.decimales, 2);
  const n = R.normaliser({ annees: [{ id: 'x', nom: '2025-2026', debut: '2025-09-01' }, { id: 'y', nom: '2026-2027', debut: '2026-09-01' }], anneeId: 'zz', evaluations: [{ bareme: -3, coef: 'abc', notes: { a: 'XX', b: 12, c: 'NN' } }], reglages: { decimales: 1, alerteJours: 999 } }, B);
  assert.equal(n.anneeId, 'y');
  assert.equal(n.evaluations[0].bareme, 20);
  assert.equal(n.evaluations[0].coef, 1);
  assert.deepEqual(simple(n.evaluations[0].notes), { b: 12, c: 'NN' });
  assert.equal(n.reglages.decimales, 1);
  assert.equal(n.reglages.alerteJours, 120);
  assert.ok(R.taille(n) > 100);
});
