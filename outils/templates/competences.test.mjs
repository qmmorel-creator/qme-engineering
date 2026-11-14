// Tests des règles métier de la matrice compétences et formations (templates/competences/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/competences/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.FRM;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';

// Petit état : deux postes, trois compétences dont une critique, trois personnes.
function etat() {
  const e = R.etatVide(BASE);
  e.domaines = [{ id: 'd', nom: 'Domaine' }];
  e.competences = [
    { id: 'a', domaineId: 'd', nom: 'Alpha', desc: '', critique: true },
    { id: 'b', domaineId: 'd', nom: 'Bêta', desc: '', critique: false },
    { id: 'c', domaineId: 'd', nom: 'Gamma', desc: '', critique: true },
  ];
  e.postes = [{ id: 'p1', nom: 'Poste 1', requis: { a: 3, b: 2 } }, { id: 'p2', nom: 'Poste 2', requis: { a: 2 } }];
  e.personnes = [
    { id: 'x', nom: 'Camille D.', posteId: 'p1', equipe: 'Atelier', entree: null, note: '' },
    { id: 'y', nom: 'Yanis B.', posteId: 'p2', equipe: 'Atelier', entree: null, note: '' },
    { id: 'z', nom: 'Inès M.', posteId: null, equipe: '', entree: null, note: '' },
  ];
  e.evaluations = [
    { id: 'e1', personneId: 'x', competenceId: 'a', niveau: 1, date: '2025-06-01', source: 'manager', note: '', ordre: 1 },
    { id: 'e2', personneId: 'x', competenceId: 'a', niveau: 3, date: '2026-10-01', source: 'manager', note: '', ordre: 2 },
    { id: 'e3', personneId: 'y', competenceId: 'a', niveau: 1, date: '2026-10-01', source: 'auto', note: '', ordre: 3 },
    { id: 'e4', personneId: 'z', competenceId: 'c', niveau: 4, date: '2025-01-10', source: 'manager', note: '', ordre: 4 },
  ];
  return e;
}

test('base intégrée : domaines, compétences et postes cohérents, aucune marque ni lien', () => {
  const ids = BASE.domaines.flatMap((d) => d.competences.map((c) => c.id));
  assert.equal(BASE.domaines.length, 8);
  assert.equal(ids.length, 44);
  assert.equal(new Set(ids).size, ids.length, 'identifiants de compétence uniques');
  assert.equal(BASE.domaines.flatMap((d) => d.competences).filter((c) => c.critique).length, 8);
  assert.equal(BASE.postes.length, 9);
  for (const p of BASE.postes) {
    for (const [k, n] of Object.entries(p.requis)) {
      assert.ok(ids.includes(k), `${p.id} : compétence ${k} inconnue`);
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 4, `${p.id} : niveau ${n}`);
    }
  }
  assert.equal(BASE.echelle.length, 5);
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8');
  assert.doesNotMatch(texte, /https?:\/\/|www\.|®|™/);
  for (const n of [3, 4, 5]) assert.equal(BASE.rampes[n].length, n);
});

test('dates : ajout de jours et de mois (fin de mois bornée)', () => {
  assert.equal(R.ajout('2026-12-31', 1), '2027-01-01');
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2025-11-14', 12), '2026-11-14');
  assert.equal(R.ecartJours('2026-11-14', '2026-11-20'), 6);
  assert.ok(!R.estDate('2026-02-30'));
});

test('nom minimal : prénom et initiale', () => {
  assert.equal(R.nomMinimal('camille durand'), 'Camille D.');
  assert.equal(R.nomMinimal('  jean-marc de la tour '), 'Jean-Marc D.');
  assert.equal(R.nomMinimal('Inès'), 'Inès');
  assert.equal(R.nomMinimal('Élise G.'), 'Élise G.');
  assert.equal(R.nomMinimal(''), '');
});

test('échelle : 3 à 5 niveaux, libellés repris, niveau borné', () => {
  const e = R.echelleDe(4, [], BASE.echelle);
  assert.deepEqual(simple(e.map((x) => x.n)), [0, 1, 2, 3, 4]);
  assert.equal(e[4].nom, 'Expert');
  assert.equal(R.echelleDe(5, [], BASE.echelle)[5].nom, 'Niveau 5');
  assert.equal(R.echelleDe(9).length, 5, 'valeur impossible : échelle 0 à 4');
  assert.equal(R.borner(7, 4), 4);
  assert.equal(R.borner(-2, 4), 0);
  assert.equal(R.borner('2', 4), 2);
});

test('niveau actuel : dernière évaluation par date puis par ordre de saisie', () => {
  const e = etat();
  assert.equal(R.derniere(e.evaluations, 'x', 'a').niveau, 3);
  e.evaluations.push({ id: 'e5', personneId: 'x', competenceId: 'a', niveau: 2, date: '2026-10-01', source: 'manager', note: '', ordre: 9 });
  assert.equal(R.derniere(e.evaluations, 'x', 'a').niveau, 2, 'même jour : la plus récente saisie gagne');
  assert.equal(R.indexDernieres(e.evaluations).x.a.niveau, 2);
  assert.deepEqual(R.historique(e.evaluations, 'x', 'a').map((v) => v.id), ['e5', 'e2', 'e1']);
  assert.equal(R.derniere(e.evaluations, 'x', 'b'), null);
});

test('cellule : atteint, écart, non évalué, non requis, ancienneté', () => {
  const e = etat();
  const [x, y, z] = e.personnes;
  assert.deepEqual(simple(R.cellule(e, x, 'a', AUJ)), { actuel: 3, date: '2026-10-01', requis: 3, ecart: 0, statut: 'ok', ancienne: false, surplus: 0 });
  assert.equal(R.cellule(e, y, 'a', AUJ).statut, 'ecart');
  assert.equal(R.cellule(e, y, 'a', AUJ).ecart, 1);
  const b = R.cellule(e, x, 'b', AUJ);
  assert.equal(b.statut, 'nonEvalue');
  assert.equal(b.ecart, 2, 'non évalué : écart compté depuis 0');
  const c = R.cellule(e, z, 'c', AUJ);
  assert.equal(c.statut, 'libre');
  assert.equal(c.ecart, 0);
  assert.equal(c.ancienne, true, 'évaluée il y a plus de 12 mois');
  e.reglages.reevaluationMois = 24;
  assert.equal(R.cellule(e, z, 'c', AUJ).ancienne, false);
});

test('exigences et conformité : non évaluée comptée comme non atteinte', () => {
  const e = etat();
  const ex = R.exigences(e, e.personnes[0], AUJ);
  assert.deepEqual(simple(ex.map((v) => [v.competence.id, v.statut])), [['b', 'nonEvalue'], ['a', 'ok']]);
  assert.equal(R.exigences(e, e.personnes[2], AUJ).length, 0, 'sans poste : aucune exigence');
  const c = R.conformite(e, e.personnes, AUJ);
  assert.deepEqual(simple(c), { total: 3, ok: 1, ecarts: 2, points: 3, nonEvalues: 1, pct: 33 });
  assert.equal(R.conformite(e, [e.personnes[2]], AUJ).pct, null);
  assert.deepEqual(simple(R.bilanPersonne(e, e.personnes[1], AUJ)), { total: 1, ok: 0, ecarts: 1, nonEvalues: 0, pct: 0, points: 1 });
});

test('couverture : niveau de référence = plus haut niveau requis, sinon le réglage', () => {
  const e = etat();
  assert.equal(R.niveauReference(e, 'a'), 3);
  assert.equal(R.niveauReference(e, 'c'), 3, 'non requise : réglage par défaut');
  const a = R.couverture(e, 'a');
  assert.equal(a.nb, 1);
  assert.equal(a.titulaires[0].id, 'x');
  assert.equal(a.concernees, 2);
  assert.equal(R.couverture(e, 'c').nb, 1, 'niveau 4 ≥ 3');
});

test('compétences fragiles : critiques sous le seuil, les moins couvertes d\'abord', () => {
  const e = etat();
  assert.deepEqual(R.fragiles(e).map((f) => [f.competence.id, f.nb]), [['a', 1], ['c', 1]]);
  e.reglages.seuilCouverture = 1;
  assert.equal(R.fragiles(e).length, 0);
  e.reglages.seuilCouverture = 2;
  e.evaluations.push({ id: 'e9', personneId: 'y', competenceId: 'a', niveau: 3, date: '2026-11-01', source: 'manager', note: '', ordre: 10 });
  assert.deepEqual(R.fragiles(e).map((f) => f.competence.id), ['c']);
  // « inclureRequises » ajoute les compétences requises par un poste occupé.
  assert.deepEqual(R.fragiles(e, { inclureRequises: true }).map((f) => f.competence.id), ['b', 'c']);
});

test('statut des formations : réalisée, annulée, à dater, à confirmer, à venir', () => {
  assert.equal(R.statutFormation({ statut: 'realisee', date: '2026-01-01' }, AUJ), 'realisee');
  assert.equal(R.statutFormation({ statut: 'annulee', date: '2026-12-01' }, AUJ), 'annulee');
  assert.equal(R.statutFormation({ statut: 'envisagee', date: null }, AUJ), 'aDater');
  assert.equal(R.statutFormation({ statut: 'validee', date: '2026-11-13' }, AUJ), 'aConfirmer');
  assert.equal(R.statutFormation({ statut: 'validee', date: AUJ }, AUJ), 'aVenir');
});

test('budget de l\'année : prévu, engagé, réalisé, restant, dépassement', () => {
  const e = etat();
  e.reglages.budgets = { 2026: 2000 };
  const f = (statut, date, cout, duree = 7) => R.normaliserFormation({ personneId: 'x', statut, date, cout, duree, intitule: 'F' }, 4);
  e.formations = [f('realisee', '2026-03-01', 500), f('validee', '2026-12-01', 900), f('envisagee', '2026-12-10', 1000), f('annulee', '2026-05-01', 800), f('realisee', '2025-03-01', 300), f('envisagee', null, 100), f('validee', '2026-06-01', 0)];
  const b = R.budget(e, 2026);
  assert.deepEqual([b.budget, b.prevu, b.engage, b.realise, b.restant, b.heures, b.nb, b.sansCout, b.depasse], [2000, 2400, 1400, 500, 600, 7, 4, 1, true]);
  assert.equal(R.budget(e, 2025).realise, 300);
  assert.equal(R.budget(e, 2027).budget, 0);
});

test('écarts sans action : une formation envisagée ou validée couvre l\'écart, pas une annulée', () => {
  const e = etat();
  assert.deepEqual(simple(R.ecartsSansAction(e, AUJ).map((v) => `${v.personne.id}:${v.competence.id}`)), ['y:a', 'x:b']);
  e.formations.push(R.normaliserFormation({ personneId: 'y', competenceId: 'a', statut: 'annulee', intitule: 'F' }, 4));
  assert.equal(R.ecartsSansAction(e, AUJ).length, 2);
  e.formations.push(R.normaliserFormation({ personneId: 'y', competenceId: 'a', statut: 'envisagee', intitule: 'F' }, 4));
  assert.deepEqual(simple(R.ecartsSansAction(e, AUJ).map((v) => v.competence.id)), ['b']);
});

test('formation réalisée : évaluation « après formation » qui met la matrice à jour', () => {
  const e = etat();
  const f = R.normaliserFormation({ id: 'f1', personneId: 'y', competenceId: 'a', statut: 'realisee', date: '2026-11-10', niveauApres: 2, intitule: 'Alpha avancé' }, 4);
  const ev = R.evaluationApres(f, f.date, 20);
  assert.equal(ev.source, 'formation');
  assert.equal(ev.formationId, 'f1');
  e.evaluations.push(R.normaliserEvaluation(ev, 4));
  assert.equal(R.cellule(e, e.personnes[1], 'a', AUJ).actuel, 2);
  assert.equal(R.cellule(e, e.personnes[1], 'a', AUJ).statut, 'ok');
  assert.equal(R.evaluationApres({ ...f, niveauApres: null }, f.date, 21), null);
  assert.equal(R.normaliserFormation({ statut: 'validee', niveauApres: 3 }, 4).niveauApres, null, 'niveau après seulement si réalisée');
});

test('réévaluations dues : exigences dont la dernière évaluation est trop ancienne', () => {
  const e = etat();
  e.evaluations[1].date = '2025-10-01';
  assert.deepEqual(simple(R.aReevaluer(e, AUJ).map((v) => `${v.personne.id}:${v.competence.id}`)), ['x:a']);
  assert.equal(R.indicateurs(e, AUJ).aReevaluer, 1);
});

test('changement d\'échelle : niveaux ramenés dans la nouvelle borne', () => {
  const e = etat();
  e.postes[0].requis.a = 4;
  e.formations.push(R.normaliserFormation({ personneId: 'x', statut: 'realisee', niveauVise: 4, niveauApres: 4, intitule: 'F', date: '2026-01-01' }, 4));
  R.appliquerEchelle(e, 3, [], BASE.echelle);
  assert.equal(e.reglages.echelle.length, 4);
  assert.equal(e.postes[0].requis.a, 3);
  assert.equal(e.evaluations.find((v) => v.id === 'e4').niveau, 3);
  assert.equal(e.formations[0].niveauApres, 3);
  assert.equal(e.reglages.niveauReference, 3);
});

test('suppressions : compétence (postes, évaluations, formations) et personne', () => {
  const e = etat();
  e.formations.push(R.normaliserFormation({ personneId: 'x', competenceId: 'a', statut: 'envisagee', intitule: 'F', niveauVise: 3 }, 4));
  R.retirerCompetence(e, 'a');
  assert.equal(e.postes[0].requis.a, undefined);
  assert.equal(e.evaluations.some((v) => v.competenceId === 'a'), false);
  assert.equal(e.formations[0].competenceId, null);
  R.retirerPersonne(e, 'x');
  assert.equal(e.personnes.length, 2);
  assert.equal(e.formations.length, 0);
  assert.equal(e.evaluations.some((v) => v.personneId === 'x'), false);
});

test('état vide : référentiel filtré par domaines et postes choisis', () => {
  const v = R.etatVide(BASE);
  assert.equal(v.competences.length, 44);
  assert.equal(v.postes.length, 9);
  const f = R.etatVide(BASE, { domaines: ['bureautique', 'relation'], postes: ['assistant'] });
  assert.equal(f.domaines.length, 2);
  assert.equal(f.competences.length, 12);
  assert.equal(f.postes.length, 1);
  assert.ok(Object.keys(f.postes[0].requis).every((k) => f.competences.some((c) => c.id === k)), 'exigences hors domaines retirées');
});

test('normaliser : tolère les anciennes données et retire les références cassées', () => {
  assert.equal(R.normaliser(null, BASE).competences.length, 44);
  const n = R.normaliser({
    entreprise: '  PME  ', reglages: { seuilCouverture: 'x', reevaluationMois: 400, budgets: { 2026: '8 000', abc: 3 }, echelle: [{ nom: 'Zéro' }, { nom: 'Un' }, { nom: 'Deux' }, { nom: 'Trois' }] },
    domaines: [{ id: 'd', nom: 'D' }], competences: [{ id: 'a', domaineId: 'inconnu', nom: 'A' }],
    postes: [{ id: 'p', nom: 'P', requis: { a: 9, fantome: 2 } }],
    personnes: [{ id: 'x', nom: 'jeanne martin', posteId: 'perdu' }],
    evaluations: [{ personneId: 'x', competenceId: 'a', niveau: 8, date: '2026-01-01' }, { personneId: 'fantome', competenceId: 'a', niveau: 1 }],
    formations: [{ personneId: 'x', competenceId: 'disparue', cout: '1 200,50', statut: 'bizarre' }, { personneId: 'fantome' }],
  }, BASE);
  assert.equal(n.entreprise, 'PME');
  assert.equal(n.reglages.seuilCouverture, 2);
  assert.equal(n.reglages.reevaluationMois, 60);
  assert.deepEqual(simple(n.reglages.budgets), { 2026: 8000 });
  assert.equal(n.reglages.echelle.length, 4);
  assert.equal(n.competences[0].domaineId, 'd');
  assert.deepEqual(simple(n.postes[0].requis), { a: 3 });
  assert.equal(n.personnes[0].nom, 'Jeanne M.');
  assert.equal(n.personnes[0].posteId, null);
  assert.equal(n.evaluations.length, 1);
  assert.equal(n.evaluations[0].niveau, 3);
  assert.equal(n.formations.length, 1);
  assert.equal(n.formations[0].competenceId, null);
  assert.equal(n.formations[0].cout, 1200.5);
  assert.equal(n.formations[0].statut, 'envisagee');
});

test('exports CSV : séparateur point-virgule, BOM, guillemets', () => {
  const e = etat();
  e.personnes[0].equipe = 'Atelier; nord';
  const m = R.versCsvMatrice(e, AUJ);
  assert.ok(m.startsWith('﻿Personne;Poste;Équipe'));
  assert.match(m, /Camille D\.;Poste 1;"Atelier; nord";Domaine;Alpha;Oui;3;3;;Atteint;2026-10-01/);
  assert.match(m, /Camille D\.;Poste 1;"Atelier; nord";Domaine;Bêta;;2;;2;Non évalué;/);
  assert.match(m, /Inès M\.;;;Domaine;Gamma;Oui;;4;;Non requis;2025-01-10/);
  e.formations.push(R.normaliserFormation({ personneId: 'x', competenceId: 'a', statut: 'realisee', date: '2026-02-01', cout: 89.5, duree: 3.5, niveauApres: 3, intitule: 'Alpha' }, 4));
  const p = R.versCsvPlan(e, AUJ);
  assert.match(p, /2026-02-01;Alpha;Camille D\.;"Atelier; nord";Alpha;Organisme externe;;3,5;89,5;Réalisée;;3 · Maîtrise;/);
  const h = R.versCsvHistorique(e);
  assert.equal(h.split('\r\n').length, 5);
  assert.match(h, /2025-01-10;Inès M\.;Gamma;4;Expert;Évaluation du manager;/);
});
