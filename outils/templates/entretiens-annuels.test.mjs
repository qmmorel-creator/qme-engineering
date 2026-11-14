// Tests des règles métier des Entretiens annuels et professionnels (templates/entretiens-annuels/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/entretiens-annuels/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ENP;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';

function etat({ salaries = [], entretiens = [], objectifs = [], formations = [], ...reste } = {}) {
  return R.normaliser({ salaries, entretiens, objectifs, formations, ...reste }, AUJ);
}
const sal = (id, entree, extra = {}) => ({ id, prenom: id, entree, ...extra });
const ent = (salarie, type, date, statut = 'realise', extra = {}) => ({ id: `${salarie}-${type}-${date}`, salarie, type, date, statut, ...extra });
const ech = (E, sid, type) => R.echeancesSalarie(E.salaries.find((s) => s.id === sid), E, AUJ).find((e) => e.type === type);

test('base intégrée : identifiants de questions uniques, types, natures et absences cohérents avec les règles', () => {
  const ids = [...Object.values(BASE.trames).flat(), ...Object.values(BASE.complements)].flatMap((t) => t.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 55);
  assert.deepEqual(simple(BASE.types.map((t) => t.id)), simple(R.TYPES));
  assert.deepEqual(simple(BASE.natures.map((n) => n.id)), simple(R.NATURES));
  assert.deepEqual(simple(BASE.natures.filter((n) => n.nonObligatoire).map((n) => n.id)), simple(R.NON_OBLIGATOIRES));
  assert.deepEqual(simple(BASE.absences.map((a) => a.id)), simple(R.ABSENCES));
  assert.deepEqual(simple(BASE.statutsFormation.map((s) => s.id)), simple(R.STATUTS_FORMATION));
  assert.deepEqual(simple(BASE.statutsObjectif.map((s) => s.id)), simple(R.STATUTS_OBJECTIF));
  for (const m of BASE.motifs) for (const c of m.themes) assert.ok(BASE.complements[c], c);
  assert.deepEqual(simple(Object.keys(BASE.complements)), simple(R.COMPLEMENTS));
  // Repères datés et sourcés
  for (const r of Object.values(BASE.reperes)) { assert.ok(r.source.length > 20, r.titre); assert.match(r.source, /relev/); }
  assert.match(BASE.reperes.epp.source, /F32040/);
  assert.equal(BASE.defauts.eppMois, 48);
  assert.equal(BASE.defauts.bilanAns, 8);
  assert.equal(BASE.defauts.premierEppMois, 12);
});

test('dates : ajout de mois borné à la fin du mois, années', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-03-15', -12), '2025-03-15');
  assert.equal(R.ajoutAns('2024-02-29', 4), '2028-02-29');
  assert.equal(R.ajoutAns('2024-02-29', 1), '2025-02-28');
  assert.equal(R.libDate('2026-12-01'), '1er décembre 2026');
});

test('nom minimal et normalisation tolérante', () => {
  assert.equal(R.nomMinimal('camille durand'), 'Camille D.');
  assert.equal(R.nomMinimal('  jean-marc  de la tour '), 'Jean-Marc D.');
  const E = R.normaliser({ salaries: [{ id: 'a', prenom: 'léa martin', entree: 'n’importe', anneeNaissance: '1979', absences: [{ type: 'inconnu', retour: '2026-01-05' }, {}] }], entretiens: [{ salarie: 'a', type: 'xx' }, { salarie: 'fantome', type: 'epp' }], reglages: { eppMois: 500, annuelActif: false }, objectifs: [{ salarie: 'a', avancement: 140 }] }, AUJ);
  const s = E.salaries[0];
  assert.equal(s.prenom, 'Léa M.');
  assert.equal(s.entree, AUJ);
  assert.equal(s.anneeNaissance, 1979);
  assert.equal(s.absences.length, 1);
  assert.equal(s.absences[0].type, 'parental');
  assert.equal(E.entretiens.length, 1); // l'entretien d'un salarié inconnu est écarté
  assert.equal(E.entretiens[0].type, 'annuel');
  assert.equal(E.entretiens[0].motif, null);
  assert.equal(E.reglages.eppMois, 72);
  assert.equal(E.reglages.annuelActif, false);
  assert.equal(E.objectifs[0].avancement, 100);
  assert.deepEqual(simple(R.normaliser(null, AUJ).reglages), simple(R.DEFAUTS));
});

test('premier EPP dans l\'année qui suit l\'embauche, puis tous les 48 mois ; l\'état des lieux compte comme EPP', () => {
  let E = etat({ salaries: [sal('a', '2026-03-02')] });
  let e = ech(E, 'a', 'epp');
  assert.equal(e.motif, 'premier');
  assert.equal(e.date, '2027-03-02');
  assert.equal(e.statut, 'ok');
  E = etat({ salaries: [sal('a', '2020-01-10')], entretiens: [ent('a', 'epp', '2021-01-05'), ent('a', 'epp', '2023-02-01')] });
  e = ech(E, 'a', 'epp');
  assert.equal(e.motif, 'periodique');
  assert.equal(e.date, '2027-02-01');
  E = etat({ salaries: [sal('a', '2014-01-10')], entretiens: [ent('a', 'epp', '2020-01-05'), ent('a', 'bilan', '2022-06-01')] });
  assert.equal(ech(E, 'a', 'epp').date, '2026-06-01');
  assert.equal(ech(E, 'a', 'epp').statut, 'retard');
  // Périodicité d'un accord collectif plus courte
  E = etat({ salaries: [sal('a', '2020-01-10')], entretiens: [ent('a', 'epp', '2025-02-01')], reglages: { eppMois: 24 } });
  assert.equal(ech(E, 'a', 'epp').date, '2027-02-01');
});

test('EPP au retour d\'absence : dû à la reprise sauf EPP dans les 12 mois précédents (ou depuis)', () => {
  const base = { salaries: [sal('a', '2018-01-10', { absences: [{ id: 'x', type: 'parental', debut: '2025-12-01', retour: '2026-12-01' }] })] };
  let E = etat({ ...base, entretiens: [ent('a', 'epp', '2025-06-01')] });
  let e = ech(E, 'a', 'epp');
  assert.equal(e.motif, 'retour');
  assert.equal(e.date, '2026-12-01');
  assert.equal(e.statut, 'bientot');
  assert.equal(e.autres[0].motif, 'periodique');
  // EPP le 2026-01-15 (moins de 12 mois avant la reprise) : pas d'EPP de retour
  E = etat({ ...base, entretiens: [ent('a', 'epp', '2026-01-15')] });
  assert.equal(ech(E, 'a', 'epp').motif, 'periodique');
  // EPP tenu après la reprise : le cas est éteint
  E = etat({ salaries: [sal('a', '2018-01-10', { absences: [{ type: 'maternite', retour: '2026-03-01' }] })], entretiens: [ent('a', 'epp', '2022-01-01'), ent('a', 'epp', '2026-03-20')] });
  assert.equal(ech(E, 'a', 'epp').motif, 'periodique');
  assert.equal(ech(E, 'a', 'epp').date, '2030-03-20');
});

test('mi-carrière (visite + 2 mois) et avant 60 ans (année des 59 ans, repère approché)', () => {
  let E = etat({ salaries: [sal('a', '2015-01-10', { visiteMiCarriere: '2026-10-01' })], entretiens: [ent('a', 'epp', '2024-01-01')] });
  let e = ech(E, 'a', 'epp');
  assert.equal(e.motif, 'mi-carriere');
  assert.equal(e.date, '2026-12-01');
  E = etat({ salaries: [sal('a', '2015-01-10', { visiteMiCarriere: '2026-10-01' })], entretiens: [ent('a', 'epp', '2026-10-20')] });
  assert.equal(ech(E, 'a', 'epp').motif, 'periodique');
  // Né en 1968 : année des 59 ans = 2027
  E = etat({ salaries: [sal('a', '2010-01-10', { anneeNaissance: 1968 })], entretiens: [ent('a', 'epp', '2025-01-01')] });
  e = ech(E, 'a', 'epp');
  assert.equal(e.motif, 'fin-carriere');
  assert.equal(e.date, '2027-12-31');
  assert.equal(e.approche, true);
  E = etat({ salaries: [sal('a', '2010-01-10', { anneeNaissance: 1968 })], entretiens: [ent('a', 'epp', '2027-03-01')] });
  assert.ok(!R.candidatsEpp(E.salaries[0], E.entretiens, E.reglages).some((c) => c.motif === 'fin-carriere'));
});

test('annuel : dernier réalisé + périodicité, désactivable ; planifié couvre l\'échéance', () => {
  let E = etat({ salaries: [sal('a', '2022-05-01')], entretiens: [ent('a', 'annuel', '2025-11-20')] });
  let e = ech(E, 'a', 'annuel');
  assert.equal(e.date, '2026-11-20');
  assert.equal(e.statut, 'bientot');
  E = etat({ salaries: [sal('a', '2022-05-01')], entretiens: [ent('a', 'annuel', '2025-01-20'), ent('a', 'annuel', '2026-12-03', 'prevu')] });
  e = ech(E, 'a', 'annuel');
  assert.equal(e.statut, 'planifie');
  assert.equal(e.datePrevue, '2026-12-03');
  E = etat({ salaries: [sal('a', '2022-05-01')], reglages: { annuelActif: false } });
  assert.equal(ech(E, 'a', 'annuel'), undefined);
  // Un état des lieux prévu couvre l'échéance EPP
  E = etat({ salaries: [sal('a', '2018-01-10')], entretiens: [ent('a', 'epp', '2019-01-01'), ent('a', 'bilan', '2026-12-10', 'prevu')] });
  assert.equal(ech(E, 'a', 'epp').statut, 'planifie');
  assert.equal(ech(E, 'a', 'bilan').statut, 'planifie');
});

test('état des lieux : 8 ans après l\'entrée ou le dernier état des lieux ; salarié sorti sans échéance', () => {
  let E = etat({ salaries: [sal('a', '2019-02-01')], entretiens: [ent('a', 'epp', '2019-12-01')] });
  let e = ech(E, 'a', 'bilan');
  assert.equal(e.date, '2027-02-01');
  assert.equal(e.possibleDes, '2026-12-01');
  E = etat({ salaries: [sal('a', '2010-02-01')], entretiens: [ent('a', 'bilan', '2020-05-01')] });
  assert.equal(ech(E, 'a', 'bilan').date, '2028-05-01');
  E = etat({ salaries: [sal('a', '2010-02-01', { sortie: '2026-06-30' })] });
  assert.equal(R.echeancesSalarie(E.salaries[0], E, AUJ).length, 0);
  assert.equal(R.indicateurs(E, AUJ).presents, 0);
});

test('tri des échéances : retards d\'abord, puis à venir, planifiés, à jour', () => {
  const E = etat({ salaries: [sal('a', '2026-10-01'), sal('b', '2015-01-01'), sal('c', '2025-12-10')], entretiens: [ent('b', 'epp', '2020-01-01'), ent('b', 'annuel', '2026-01-10')] });
  const l = R.echeances(E, AUJ);
  const statuts = l.map((e) => e.statut);
  assert.deepEqual(statuts, [...statuts].sort((x, y) => ({ retard: 0, bientot: 1, planifie: 2, ok: 3 }[x] - { retard: 0, bientot: 1, planifie: 2, ok: 3 }[y])));
  assert.equal(l[0].statut, 'retard');
  assert.ok(l.some((e) => e.salarie === 'c' && e.type === 'epp' && e.statut === 'bientot'));
});

test('contrôle de l\'état des lieux : écarts entre EPP, formation non obligatoire, risque d\'abondement (50 salariés et plus)', () => {
  const salaries = [sal('a', '2018-03-01')];
  const formations = [
    { salarie: 'a', intitule: 'Habilitation électrique', nature: 'obligatoire', statut: 'realisee', dateRealisee: '2021-05-01' },
    { salarie: 'a', intitule: 'Tableur avancé', nature: 'developpement', statut: 'realisee', dateRealisee: '2022-05-01' },
    { salarie: 'a', intitule: 'Titre pro', nature: 'certifiante', statut: 'demandee' },
  ];
  // EPP 2019-02 (premier, à moins de 12 mois + tolérance), 2023-01, état des lieux 2026-03-01
  let E = etat({ salaries, formations, effectif50: true, entretiens: [ent('a', 'epp', '2019-02-15'), ent('a', 'epp', '2023-01-10')] });
  let c = R.controleBilan(E.salaries[0], E, '2026-03-01');
  assert.equal(c.debut, '2018-03-01');
  assert.equal(c.entretiensOk, true);
  assert.equal(c.nonObligatoires.length, 1);
  assert.equal(c.certifications.length, 0);
  assert.equal(c.risqueAbondement, false);
  // Sans le deuxième EPP : écart de 2019 à 2026, risque
  E = etat({ salaries, formations, effectif50: true, entretiens: [ent('a', 'epp', '2019-02-15')] });
  c = R.controleBilan(E.salaries[0], E, '2026-03-01');
  assert.equal(c.entretiensOk, false);
  assert.equal(c.manques.length, 1);
  assert.equal(c.manques[0].attendu, '2023-02-15');
  assert.equal(c.risqueAbondement, true);
  // Moins de 50 salariés : constat sans risque d'abondement
  E = etat({ salaries, formations, effectif50: false, entretiens: [ent('a', 'epp', '2019-02-15')] });
  assert.equal(R.controleBilan(E.salaries[0], E, '2026-03-01').risqueAbondement, false);
  // Seule une formation obligatoire : formation non ok
  E = etat({ salaries, formations: formations.slice(0, 1), effectif50: true, entretiens: [ent('a', 'epp', '2019-02-15'), ent('a', 'epp', '2023-01-10')] });
  c = R.controleBilan(E.salaries[0], E, '2026-03-01');
  assert.equal(c.formationOk, false);
  assert.equal(c.risqueAbondement, true);
  // Premier EPP tardif après l'embauche
  E = etat({ salaries, effectif50: true, entretiens: [ent('a', 'epp', '2019-09-01'), ent('a', 'epp', '2023-01-10')] });
  assert.equal(R.controleBilan(E.salaries[0], E, '2026-03-01').manques[0].attendu, '2019-03-01');
});

test('objectifs SMART, échus, report d\'une année sur l\'autre, bilan par année', () => {
  const o = R.normaliserObjectif({ id: 'o1', salarie: 'a', intitule: 'Réduire le délai de réponse aux devis', indicateur: 'Délai moyen', cible: '48 h', moyens: 'Modèles de devis', lien: 'Satisfaction client', echeance: '2026-06-30', creeLe: '2025-11-20' }, AUJ);
  assert.equal(R.controleSmart(o).ok, true);
  const flou = R.normaliserObjectif({ intitule: 'Être meilleur', creeLe: '2025-11-20', echeance: '2028-01-01' }, AUJ);
  assert.deepEqual(simple(R.controleSmart(flou).manque), ['S', 'M', 'A', 'R', 'T']);
  assert.equal(R.objectifEchu(o, AUJ), true);
  const n = R.reporter({ ...o, avancement: 60 }, { auj: AUJ, echeance: '2027-06-30', entretien: 'e2' });
  assert.equal(n.reportDe, 'o1');
  assert.equal(n.statut, 'en-cours');
  assert.equal(n.avancement, 60);
  assert.notEqual(n.id, 'o1');
  const ferme = { ...o, statut: 'partiel', bilanLe: AUJ };
  assert.deepEqual(simple(R.chaineObjectif([ferme, n], n.id).map((x) => x.id)), ['o1', n.id]);
  const b = R.bilanObjectifs([ferme, n, { ...o, id: 'o3', statut: 'atteint' }]);
  assert.equal(b[0].annee, '2026');
  assert.equal(b[1].annee, '2025');
  assert.equal(b[1].tauxAtteinte, 75);
  // À revoir dans l'entretien suivant : en cours, créé avant ; ou bilan fait le jour de l'entretien
  const entretien = { id: 'e2', date: AUJ };
  assert.equal(R.objectifsARevoir([o], 'a', entretien).length, 1);
  assert.equal(R.objectifsARevoir([ferme], 'a', entretien).length, 1);
  assert.equal(R.objectifsARevoir([{ ...ferme, bilanLe: '2026-01-01' }], 'a', entretien).length, 0);
  assert.equal(R.objectifsARevoir([n], 'a', entretien).length, 0); // fixé dans cet entretien
});

test('formations : en attente, sans réponse, indicateurs', () => {
  const l = [
    { statut: 'demandee', demandeLe: '2026-08-01' },
    { statut: 'demandee', demandeLe: '2026-11-01' },
    { statut: 'acceptee', demandeLe: '2026-01-01' },
    { statut: 'planifiee', demandeLe: '2026-01-01' },
    { statut: 'realisee', demandeLe: '2025-01-01' },
    { statut: 'refusee', demandeLe: '2025-01-01' },
  ].map((f) => R.normaliserFormation({ salarie: 'a', ...f }, AUJ));
  assert.deepEqual(simple(R.indicateursFormations(l, AUJ)), { total: 6, attente: 3, planifiee: 1, realisee: 1, refusee: 1, sansReponse: 1 });
});

test('à finaliser, copie à remettre, indicateurs du tableau de bord', () => {
  const E = etat({ salaries: [sal('a', '2020-01-01'), sal('b', '2024-01-01')], entretiens: [
    ent('a', 'annuel', '2026-11-10', 'prevu'),
    ent('a', 'epp', '2026-11-30', 'prevu'),
    ent('b', 'epp', '2026-10-01', 'realise'),
    ent('b', 'epp', '2022-10-01', 'realise', { historique: true }),
    ent('b', 'annuel', '2026-10-01', 'realise'),
  ], formations: [{ salarie: 'a', statut: 'demandee' }], objectifs: [{ salarie: 'b', echeance: '2026-09-30', creeLe: '2025-10-01' }] });
  assert.deepEqual(R.aFinaliser(E, AUJ).map((e) => e.date), ['2026-11-10']);
  assert.equal(R.copieARemettre(E).length, 1);
  const i = R.indicateurs(E, AUJ);
  assert.equal(i.aFinaliser, 1);
  assert.equal(i.planifie, 1);
  assert.equal(i.formationsAttente, 1);
  assert.equal(i.objectifsEchus, 1);
});

test('trame : compléments du motif, forfait jours pour l\'annuel, questions masquées et personnalisées ; questionnaire', () => {
  const E = etat({ salaries: [sal('a', '2020-01-01', { forfaitJours: true })], questionsMasquees: ['an4'], questionsPerso: { annuel: [{ id: 'p1', texte: 'Que penses-tu du nouveau logiciel ?' }] } });
  const s = E.salaries[0];
  const t = R.themesEntretien(R.normaliserEntretien({ salarie: 'a', type: 'annuel', date: '2026-12-01' }), s, E, BASE);
  const ids = t.map((x) => x.id);
  assert.ok(ids.includes('forfait-jours'));
  assert.ok(ids.includes('perso'));
  assert.equal(ids[ids.length - 1], 'an-commentaires');
  assert.ok(!t.flatMap((x) => x.questions).some((q) => q.id === 'an4'));
  const r = R.themesEntretien(R.normaliserEntretien({ salarie: 'a', type: 'epp', motif: 'retour', date: '2026-12-01' }), s, E, BASE);
  assert.ok(r.some((x) => x.id === 'retour'));
  assert.ok(!r.some((x) => x.id === 'forfait-jours'));
  const txt = R.questionnaire(R.normaliserEntretien({ salarie: 'a', type: 'annuel', date: '2026-12-01', heure: '09:30' }), s, t, { entreprise: 'Atelier', nomType: 'Entretien annuel' });
  assert.match(txt, /^Préparation de ton entretien annuel · A/);
  assert.match(txt, /1er décembre 2026 à 09 h 30/);
  assert.match(txt, /1\. Quelles sont les trois réalisations/);
  assert.doesNotMatch(txt, /Commentaire du manager/);
  assert.match(txt, /nouveau logiciel/);
});

test('RGPD : effacement proposé après le délai, export et effacement complets d\'un salarié', () => {
  const E = etat({ salaries: [sal('a', '2015-01-01', { sortie: '2025-10-31' }), sal('b', '2015-01-01', { sortie: '2026-09-30' }), sal('c', '2020-01-01')], entretiens: [ent('a', 'epp', '2024-01-01'), ent('c', 'epp', '2024-01-01')], objectifs: [{ salarie: 'a' }], formations: [{ salarie: 'a' }, { salarie: 'c' }] });
  assert.deepEqual(R.aEffacer(E, AUJ).map((s) => s.id), ['a']);
  const d = R.donneesSalarie(E, 'a');
  assert.equal(d.salarie.id, 'a');
  assert.equal(d.entretiens.length + d.objectifs.length + d.formations.length, 3);
  const F = R.sansSalarie(E, 'a');
  assert.deepEqual(F.salaries.map((s) => s.id), ['b', 'c']);
  assert.ok(![...F.entretiens, ...F.objectifs, ...F.formations].some((x) => x.salarie === 'a'));
  assert.equal(E.salaries.length, 3); // fonction pure
});

test('CSV : BOM, point-virgule, guillemets', () => {
  const c = R.versCsv(['a', 'b'], [['x;y', 'dit "oui"'], [1, null]]);
  assert.ok(c.startsWith('﻿a;b\r\n'));
  assert.match(c, /"x;y";"dit ""oui"""/);
  assert.match(c, /1;\r\n$/);
});
