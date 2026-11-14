// Tests des règles métier de Notes et moyennes (templates/notes/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/notes/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.NTS;
const B = ctx.window.BASE;
const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// Un semestre sur 20 en crédits : UE1 (Maths 6 ECTS, Stats 4 ECTS), UE2 (Anglais 3 ECTS), plus une matière libre.
function semestre(regles = {}, notes = null) {
  return R.normaliser({
    annees: [{ id: 'a1', nom: 'L2' }],
    periodes: [{ id: 's1', annee: 'a1', nom: 'Semestre 3', systeme: 'sur20', poids: 'credits', mode: 'totale', seuil: 10, objectif: 12, ...regles }],
    ues: [{ id: 'u1', periode: 's1', nom: 'UE1 Fondamentaux' }, { id: 'u2', periode: 's1', nom: 'UE2 Langues' }],
    matieres: [
      { id: 'ma', periode: 's1', ue: 'u1', nom: 'Maths', coef: 1, credits: 6 },
      { id: 'st', periode: 's1', ue: 'u1', nom: 'Stats', coef: 1, credits: 4 },
      { id: 'an', periode: 's1', ue: 'u2', nom: 'Anglais', coef: 1, credits: 3 },
      { id: 'pp', periode: 's1', ue: '', nom: 'Projet perso', coef: 1, credits: 2 },
    ],
    notes: notes || [
      { id: 'n1', matiere: 'ma', date: '2026-10-01', valeur: 8, sur: 20, coef: 1 },
      { id: 'n2', matiere: 'ma', date: '2026-11-01', valeur: 7, sur: 10, coef: 2 }, // 14/20
      { id: 'n3', matiere: 'st', date: '2026-10-15', valeur: 9, sur: 20, coef: 1 },
      { id: 'n4', matiere: 'an', date: '2026-10-20', valeur: 15, sur: 20, coef: 1 },
      { id: 'n5', matiere: 'pp', date: '2026-11-05', valeur: 12, sur: 20, coef: 1 },
      { id: 'p1', matiere: 'st', date: '2026-12-15', sur: 20, coef: 2, prevue: true, type: 'partiel' },
    ],
  }, B);
}

test('base : systèmes, lettres, modèles et couleurs cohérents', () => {
  assert.deepEqual([...B.systemes.map((s) => s.code)], ['sur20', 'sur10', 'sur100', 'lettres']);
  for (const s of B.systemes) assert.ok(s.seuil < s.objectif && s.objectif <= s.max, s.code);
  assert.equal(B.couleurs.length, 8);
  assert.ok(B.modeles.every((m) => m.periodes.length && ['coef', 'credits'].includes(m.poids)));
  assert.ok(B.mentions.every((m, i) => i === 0 || m.seuil > B.mentions[i - 1].seuil));
});

test('lecture d\'une note : virgule, barème, pourcentage, lettres, erreurs', () => {
  const s20 = R.systeme(R.etatVide(B), { systeme: 'sur20' }, B);
  assert.deepEqual({ ...R.lireNote('14,5', s20) }, { valeur: 14.5, sur: 20 });
  assert.deepEqual({ ...R.lireNote('7/10', s20) }, { valeur: 7, sur: 10 });
  assert.deepEqual({ ...R.lireNote('85 %', s20) }, { valeur: 85, sur: 100 });
  assert.deepEqual({ ...R.lireNote('16', s20, 40) }, { valeur: 16, sur: 40 });
  assert.ok(R.lireNote('21', s20).erreur);
  assert.ok(R.lireNote('abc', s20).erreur);
  assert.ok(R.lireNote('', s20).vide);
  const e = R.etatVide(B);
  const sl = R.systeme(e, { systeme: 'lettres' }, B);
  assert.equal(sl.max, 4);
  assert.equal(R.lireNote('b', sl).lettre, 'B');
  assert.ok(R.lireNote('Z', sl).erreur);
  assert.equal(R.lettreDe(3.4, sl.lettres), 'B');
  assert.equal(R.lettreDe(0.2, sl.lettres), 'F');
});

test('moyenne d\'une matière : coefficients des notes, barèmes convertis, notes prévues et neutralisées ignorées', () => {
  const e = semestre();
  const ma = e.matieres.find((m) => m.id === 'ma');
  proche(R.moyenneMatiere(e, ma) * 20, (8 + 14 * 2) / 3); // 12
  const st = e.matieres.find((m) => m.id === 'st');
  proche(R.moyenneMatiere(e, st) * 20, 9); // le partiel prévu ne compte pas
  const e2 = R.normaliser({ ...e, notes: e.notes.concat([{ id: 'nx', matiere: 'st', date: '2026-10-16', valeur: 0, sur: 20, coef: 1, neutre: true }]) }, B);
  proche(R.moyenneMatiere(e2, st) * 20, 9);
  const vide = e.matieres.find((m) => m.id === 'an');
  assert.equal(R.moyenneMatiere(R.normaliser({ ...e, notes: [] }, B), vide), null);
});

test('moyenne de période pondérée par les crédits, UE pondérées par la somme des crédits de leurs matières', () => {
  const e = semestre();
  const p = e.periodes[0];
  // UE1 = (12×6 + 9×4)/10 = 10,8 (10 crédits) ; UE2 = 15 (3) ; projet = 12 (2) → (108 + 45 + 24)/15 = 11,8
  proche(R.moyenneUe(e, e.ues[0]) * 20, 10.8);
  proche(R.moyennePeriode(e, p) * 20, 11.8);
  assert.equal(R.creditsPeriode(e, p), 15);
  // En coefficients (tous à 1) : UE1 = 10,5 (poids 2), UE2 = 15 (1), projet 12 (1) → (21 + 15 + 12)/4 = 12
  const c = R.normaliser({ ...e, periodes: [{ ...p, poids: 'coef' }] }, B);
  proche(R.moyennePeriode(c, c.periodes[0]) * 20, 12);
  // Un coefficient d'UE saisi remplace la somme de ses matières.
  const u = R.normaliser({ ...c, ues: [{ ...c.ues[0], coef: 3 }, c.ues[1]] }, B);
  proche(R.moyennePeriode(u, u.periodes[0]) * 20, (10.5 * 3 + 15 + 12) / 5);
});

test('poids nuls : moyenne simple ; coefficient 0 sur une note : elle ne compte pas', () => {
  assert.equal(R.moyennePonderee([]), null);
  proche(R.moyennePonderee([[0.5, 0], [1, 0]]), 0.75);
  proche(R.moyennePonderee([[0.5, 1], [1, 0]]), 0.5);
});

test('rattrapage : remplace la moyenne, ou seulement si meilleure', () => {
  const notes = [
    { id: 'a', matiere: 'ma', date: '2026-10-01', valeur: 6, sur: 20, coef: 1 },
    { id: 'r', matiere: 'ma', date: '2027-01-20', valeur: 5, sur: 20, coef: 1, type: 'rattrapage' },
  ];
  const e = semestre({}, notes);
  const ma = e.matieres[0];
  proche(R.moyenneMatiere(e, ma) * 20, 5);
  const m = semestre({ rattrapage: 'meilleure' }, notes);
  proche(R.moyenneMatiere(m, m.matieres[0]) * 20, 6);
});

test('validation avec compensation totale : moyenne au seuil, crédits tous acquis, matières compensées', () => {
  const e = semestre();
  const b = R.bilanPeriode(e, e.periodes[0], B);
  assert.equal(b.statut, 'validee');
  assert.equal(b.creditsAcquis, 15);
  assert.equal(b.provisoire, true); // un partiel prévu
  const st = b.ues[0].matieres.find((x) => x.m.id === 'st');
  assert.equal(st.statut, 'compensee');
  assert.equal(b.ues[0].statut, 'acquise');
  assert.equal(b.mention, null); // 11,8 < 12
});

test('note éliminatoire : empêche la compensation', () => {
  const e = semestre({ eliminatoire: 9.5 });
  const b = R.bilanPeriode(e, e.periodes[0], B);
  assert.equal(b.statut, 'non');
  // UE1 a une matière éliminatoire : non acquise ; ses matières au seuil restent capitalisées (Maths 6), UE2 et projet acquis.
  assert.equal(b.ues[0].statut, 'non');
  assert.equal(b.creditsAcquis, 6 + 3 + 2);
});

test('compensation par UE et sans compensation', () => {
  const ue = semestre({ mode: 'ue' });
  const b = R.bilanPeriode(ue, ue.periodes[0], B);
  assert.equal(b.statut, 'validee'); // UE1 10,8, UE2 15, projet 12
  const notes = semestre().notes.map((n) => (n.id === 'n4' ? { ...n, valeur: 8 } : n));
  const ue2 = semestre({ mode: 'ue' }, notes);
  const b2 = R.bilanPeriode(ue2, ue2.periodes[0], B);
  assert.equal(b2.statut, 'non');
  assert.equal(b2.ues[1].statut, 'non');
  assert.equal(b2.creditsAcquis, 10 + 2);
  const sans = semestre({ mode: 'aucune' });
  const b3 = R.bilanPeriode(sans, sans.periodes[0], B);
  assert.equal(b3.statut, 'non'); // Stats 9
  assert.equal(b3.creditsAcquis, 6 + 3 + 2);
  assert.equal(b3.ues[0].matieres.find((x) => x.m.id === 'st').statut, 'non');
});

test('seuil comparé à la moyenne arrondie au centième', () => {
  const notes = [{ id: 'x', matiere: 'pp', date: '2026-10-01', valeur: 9.996, sur: 20, coef: 1 }];
  const e = semestre({}, notes);
  e.matieres = e.matieres.filter((m) => m.id === 'pp');
  const b = R.bilanPeriode(e, e.periodes[0], B);
  assert.equal(b.statut, 'validee');
});

test('mentions : seuils sur 20 convertis, seulement si validé', () => {
  const e = semestre();
  assert.equal(R.mention(e, 12 / 20), 'Assez bien');
  assert.equal(R.mention(e, 15.99 / 20), 'Bien');
  assert.equal(R.mention(e, 16 / 20), 'Très bien');
  assert.equal(R.mention(e, 11.99 / 20), null);
});

test('année : moyenne des périodes par crédits, compensation entre semestres', () => {
  const e = R.normaliser({
    annees: [{ id: 'a', nom: 'L1', compensation: 'periodes' }],
    periodes: [{ id: 'p1', annee: 'a', nom: 'S1', ordre: 0, poids: 'credits' }, { id: 'p2', annee: 'a', nom: 'S2', ordre: 1, poids: 'credits' }],
    matieres: [{ id: 'm1', periode: 'p1', nom: 'A', credits: 30 }, { id: 'm2', periode: 'p2', nom: 'B', credits: 30 }],
    notes: [{ id: 'n1', matiere: 'm1', date: '2026-01-10', valeur: 9, coef: 1 }, { id: 'n2', matiere: 'm2', date: '2026-06-10', valeur: 12, coef: 1 }],
  }, B);
  const a = e.annees[0];
  proche(R.moyenneAnnee(e, a) * 20, 10.5);
  const b = R.bilanAnnee(e, a, B);
  assert.equal(b.compensee, true);
  assert.equal(b.periodes[0].statut, 'compensee');
  assert.equal(b.creditsAcquis, 60);
  assert.equal(b.ok, true);
  const sans = R.normaliser({ ...e, annees: [{ ...a, compensation: 'aucune' }] }, B);
  const b2 = R.bilanAnnee(sans, sans.annees[0], B);
  assert.equal(b2.ok, false);
  assert.equal(b2.creditsAcquis, 30);
});

test('simulateur : note nécessaire au prochain partiel pour 12 de moyenne', () => {
  const e = semestre();
  const p = e.periodes[0];
  const sys = R.systeme(e, p, B);
  const r = R.noteNecessaire(e, { type: 'periode', id: 's1' }, ['p1'], 12, sys);
  assert.equal(r.statut, 'possible');
  // Stats = (9 + 2x)/3 ; UE1 = (12×6 + Stats×4)/10 ; période = (UE1×10 + 45 + 24)/15 = 12 → UE1 = 11,1 → Stats = 9,75 → x = 10,125
  proche(r.frac * 20, 10.125, 1e-6);
  assert.equal(R.noteAViser(r.frac, 20), 10.13);
  proche(R.simuler(e, { type: 'periode', id: 's1' }, ['p1'], r.frac) * 20, 12, 1e-6);
  // Objectif déjà acquis, ou hors de portée.
  assert.equal(R.noteNecessaire(e, { type: 'periode', id: 's1' }, ['p1'], 10, sys).statut, 'acquis');
  const imp = R.noteNecessaire(e, { type: 'periode', id: 's1' }, ['p1'], 16, sys);
  assert.equal(imp.statut, 'impossible');
  proche(imp.max * 20, (((12 * 6 + ((9 + 40) / 3) * 4) / 10) * 10 + 45 + 24) / 15);
  assert.equal(R.noteNecessaire(e, { type: 'periode', id: 's1' }, [], 12, sys).statut, 'aucune');
});

test('simulateur : matière sans note et rattrapage « meilleure »', () => {
  const e = semestre({}, [{ id: 'p', matiere: 'an', sur: 20, coef: 1, prevue: true }]);
  const sys = R.systeme(e, e.periodes[0], B);
  const r = R.noteNecessaire(e, { type: 'matiere', id: 'an' }, ['p'], 12, sys);
  proche(r.frac * 20, 12, 1e-6);
  const m = semestre({ rattrapage: 'meilleure' }, [
    { id: 'a', matiere: 'ma', date: '2026-10-01', valeur: 8, sur: 20, coef: 1 },
    { id: 'r', matiere: 'ma', sur: 20, coef: 1, prevue: true, type: 'rattrapage' },
  ]);
  const r2 = R.noteNecessaire(m, { type: 'matiere', id: 'ma' }, ['r'], 10, sys);
  proche(r2.frac * 20, 10, 1e-6);
  assert.equal(R.noteNecessaire(m, { type: 'matiere', id: 'ma' }, ['r'], 7, sys).statut, 'acquis');
});

test('prévues d\'une cible, épreuves à venir et période du moment', () => {
  const e = semestre();
  assert.deepEqual(R.prevuesCible(e, { type: 'periode', id: 's1' }).map((n) => n.id), ['p1']);
  assert.deepEqual(R.prevuesCible(e, { type: 'ue', id: 'u2' }).map((n) => n.id), []);
  assert.deepEqual(R.aVenir(e, '2026-11-14').map((n) => n.id), ['p1']);
  assert.equal(R.aVenir(e, '2026-12-16').length, 0);
  assert.equal(R.periodeCourante(e, '2026-11-14'), 's1');
});

test('évolution : moyenne de la période après chaque date de note', () => {
  const e = semestre();
  const ev = R.evolution(e, { type: 'periode', id: 's1' });
  assert.deepEqual([...ev.map((x) => x.date)], ['2026-10-01', '2026-10-15', '2026-10-20', '2026-11-01', '2026-11-05']);
  proche(ev[0].moy * 20, 8);
  proche(ev.at(-1).moy * 20, 11.8);
});

test('normalisation : orphelins retirés, note sans valeur devenue prévue, UE d\'une autre période détachée', () => {
  const e = R.normaliser({
    annees: [{ id: 'a', nom: 'X' }],
    periodes: [{ id: 'p', annee: 'a' }, { id: 'q', annee: 'a' }, { id: 'z', annee: 'inconnue' }],
    ues: [{ id: 'u', periode: 'q' }],
    matieres: [{ id: 'm', periode: 'p', ue: 'u' }, { id: 'o', periode: 'z' }],
    notes: [{ id: 'n', matiere: 'm', valeur: '' }, { id: 'k', matiere: 'o', valeur: 3 }, { id: 'v', matiere: 'm', valeur: 25, sur: 20 }],
  }, B);
  assert.equal(e.periodes.length, 2);
  assert.equal(e.matieres.length, 1);
  assert.equal(e.matieres[0].ue, '');
  assert.equal(e.notes.find((n) => n.id === 'n').prevue, true);
  assert.equal(e.notes.find((n) => n.id === 'v').valeur, 20);
  assert.equal(e.notes.length, 2);
  assert.equal(R.normaliser(null, B).notes.length, 0);
});

test('structure : copie d\'une période sans les notes, suppressions en cascade', () => {
  let e = semestre();
  e = { ...e, periodes: e.periodes.concat([R.normaliserPeriode({ id: 's2', annee: 'a1', nom: 'S4' }, B)]) };
  e = R.copierStructure(e, 's1', 's2');
  assert.equal(R.uesDe(e, 's2').length, 2);
  assert.equal(R.matieresDe(e, 's2').length, 4);
  assert.ok(R.matieresDe(e, 's2').filter((m) => m.ue).every((m) => R.uesDe(e, 's2').some((u) => u.id === m.ue)));
  const sansUe = R.supprimerUe(e, 'u1');
  assert.equal(sansUe.matieres.filter((m) => m.periode === 's1' && !m.ue).length, 3);
  const sansP = R.supprimerPeriode(e, 's1');
  assert.equal(sansP.notes.length, 0);
  assert.equal(R.supprimerAnnee(e, 'a1').matieres.length, 0);
});

test('affichage : nombres et notes à la française', () => {
  assert.equal(R.nombreTexte(1234.5, 1), '1 234,5');
  assert.equal(R.nombreTexte(12, 2, true), '12,00');
  const e = R.etatVide(B);
  assert.equal(R.noteTexte(0.59, R.systeme(e, { systeme: 'sur20' }, B)), '11,80');
  assert.equal(R.noteTexte(0.8, R.systeme(e, { systeme: 'lettres' }, B)), '3,20 (B)');
  assert.equal(R.noteTexte(null, R.systeme(e, { systeme: 'sur20' }, B)), '–');
});

test('export CSV : notes et relevé, point-virgule, BOM, formules neutralisées', () => {
  const e = semestre();
  const csv = R.csvNotes(e, B, { controle: 'Contrôle' });
  assert.ok(csv.startsWith('﻿Année;Période;UE;Matière'));
  assert.ok(csv.includes('L2;Semestre 3;UE1 Fondamentaux;Maths;2026-11-01;;Contrôle;7;10;2;14;'));
  assert.ok(csv.includes('prévue'));
  const rel = R.csvReleve(e, B);
  assert.ok(rel.includes('(moyenne de la période);;15;11,8;Validée;15'));
  assert.equal(R.champCsv('=1+1'), "'=1+1");
});
