// Tests des règles métier des Vérifications réglementaires (templates/verifications/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/verifications/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.VRF;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
let n = 0;
const id = () => `x${++n}`;
const etat = (equipements, verifications = [], observations = []) => R.normaliser({
  sites: [{ id: 's1', nom: 'Siège', type: 'travail' }, { id: 's2', nom: 'Atelier', type: 'travail' }],
  equipements, verifications, observations,
});
const eq = (extra = {}) => ({ id: 'e1', site: 's1', nom: 'TGBT', type: 'ELEC', ...extra });

test('base intégrée : chaque périodicité a une source datée, sinon elle est à saisir', () => {
  assert.match(BASE.source.url, /^https:\/\/www\.inrs\.fr\//);
  assert.match(BASE.source.consulte, /^\d{2}\/\d{2}\/\d{4}$/);
  const codes = BASE.types.map((t) => t.code);
  assert.equal(new Set(codes).size, codes.length, 'codes uniques');
  for (const t of BASE.types) {
    assert.ok(BASE.familles.includes(t.famille), `${t.code} : famille connue`);
    if (t.nature === 'saisie') { assert.ok(!t.mois && !t.jours, `${t.code} : pas de périodicité`); continue; }
    assert.ok(['reglementaire', 'referentiel'].includes(t.nature), t.code);
    assert.ok((t.mois > 0) !== (t.jours > 0), `${t.code} : une périodicité, en mois ou en jours`);
    assert.ok(Number.isInteger(t.page) && t.page > 0, `${t.code} : page de la brochure`);
    assert.ok(t.textes.length > 10 && t.resume.length > 20 && t.qui, `${t.code} : textes, résumé, intervenant`);
  }
  // Les référentiels (APSAD, normes) sont signalés comme tels, jamais présentés comme la loi.
  for (const t of BASE.types.filter((x) => x.nature === 'referentiel')) assert.match(t.textes, /pas un texte de loi/);
  assert.ok(codes.includes('AUTRE'));
  assert.equal(BASE.types.find((t) => t.code === 'ELEC').allegeeMois, 24);
});

test('dates : ajout de mois borné à la fin du mois, écarts, libellés de périodicité', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2024-02-29', 12), '2025-02-28');
  assert.equal(R.ajoutMois('2026-11-14', -12), '2025-11-14');
  assert.equal(R.ecart('2026-11-14', '2026-12-14'), 30);
  assert.equal(R.libellePeriode({ mois: 12 }), 'Tous les ans');
  assert.equal(R.libellePeriode({ mois: 60 }), 'Tous les 5 ans');
  assert.equal(R.libellePeriode({ mois: 6 }), 'Tous les 6 mois');
  assert.equal(R.libellePeriode({ jours: 42 }), 'Toutes les 6 semaines');
  assert.equal(R.libellePeriode(null), 'Périodicité à saisir');
});

test('échéance : dernière vérification + périodicité de la base, statut selon la fenêtre d’alerte', () => {
  const e = etat([eq({ derniereConnue: '2025-12-10' })]);
  const s = R.situation(e.equipements[0], e, AUJ);
  assert.equal(s.periode.origine, 'base');
  assert.equal(s.prochaine, '2026-12-10');
  assert.equal(s.statut, 'proche'); // 26 jours, fenêtre de 45
  e.equipements[0].derniereConnue = '2025-11-01';
  assert.equal(R.situation(e.equipements[0], e, AUJ).statut, 'retard');
  e.equipements[0].derniereConnue = '2026-06-01';
  assert.equal(R.situation(e.equipements[0], e, AUJ).statut, 'ok');
  e.equipements[0].derniereConnue = null;
  assert.equal(R.situation(e.equipements[0], e, AUJ).statut, 'inconnue');
  e.equipements[0].inactif = true;
  assert.equal(R.situation(e.equipements[0], e, AUJ).statut, 'inactif');
});

test('une vérification enregistrée remplace la date connue, la plus récente compte', () => {
  const e = etat([eq({ derniereConnue: '2025-01-15' })], [
    { id: 'v1', equipement: 'e1', date: '2025-10-02', resultat: 'conforme' },
    { id: 'v2', equipement: 'e1', date: '2026-03-20', resultat: 'conforme' },
  ]);
  assert.equal(R.derniere(e.equipements[0], e), '2026-03-20');
  assert.equal(R.prochaine(e.equipements[0], e), '2027-03-20');
});

test('périodicité saisie par l’utilisateur prioritaire ; type « Autre » sans saisie : échéance inconnue', () => {
  const e = etat([eq({ type: 'AUTRE', derniereConnue: '2026-01-10' })]);
  let s = R.situation(e.equipements[0], e, AUJ);
  assert.equal(s.periode, null);
  assert.equal(s.statut, 'inconnue');
  assert.equal(s.sansPeriode, true);
  e.equipements[0].periodeSaisie = { mois: 12 };
  s = R.situation(e.equipements[0], e, AUJ);
  assert.equal(s.periode.origine, 'saisie');
  assert.equal(s.prochaine, '2027-01-10');
  // Une saisie sur un type de la base l'emporte aussi (choix plus strict de l'entreprise).
  const e2 = etat([eq({ derniereConnue: '2026-01-10', periodeSaisie: { mois: 6 } })]);
  assert.equal(R.prochaine(e2.equipements[0], e2), '2026-07-10');
});

test('périodicités en jours (ascenseur : 6 semaines) et fenêtre réduite pour les contrôles fréquents', () => {
  const e = etat([eq({ type: 'ASC_ENT', derniereConnue: '2026-10-20' })]);
  const s = R.situation(e.equipements[0], e, AUJ);
  assert.equal(s.prochaine, '2026-12-01');
  assert.equal(R.fenetre(s.periode, 45), 14);
  assert.equal(s.statut, 'ok'); // 17 jours > 14
  assert.equal(R.fenetre({ mois: 1 }, 45), 10);
  assert.equal(R.fenetre({ mois: 12 }, 45), 45);
});

test('date fixée (rapport, mise en demeure) prioritaire, effacée à la vérification suivante', () => {
  const e = etat([eq({ derniereConnue: '2026-06-01', prochaineFixee: '2026-11-30' })]);
  assert.equal(R.prochaine(e.equipements[0], e), '2026-11-30');
  const v = R.ajouterVerification(e, { equipement: 'e1', date: '2026-11-10', resultat: 'conforme' }, AUJ, id);
  assert.equal(typeof v, 'object');
  assert.equal(e.equipements[0].prochaineFixee, null);
  assert.equal(R.prochaine(e.equipements[0], e), '2027-11-10');
});

test('installations électriques : délai de 2 ans seulement si demandé et sans observation restante', () => {
  const e = etat([eq({ allegement: true })]);
  assert.equal(R.allegementPossible(e.equipements[0], e).ok, false); // aucun rapport
  R.ajouterVerification(e, { equipement: 'e1', date: '2026-02-01', resultat: 'conforme' }, AUJ, id);
  assert.equal(R.periode(e.equipements[0], e).origine, 'allegee');
  assert.equal(R.prochaine(e.equipements[0], e), '2028-02-01');
  // Rapport suivant avec observation : retour à 12 mois tant qu'elle n'est pas levée.
  const v = R.ajouterVerification(e, { equipement: 'e1', date: '2026-10-01', resultat: 'observations', observations: [{ texte: 'Absence de repérage du départ 4', gravite: 'mineure' }] }, AUJ, id);
  assert.equal(R.prochaine(e.equipements[0], e), '2027-10-01');
  const o = e.observations.find((x) => x.verification === v.id);
  assert.equal(o.echeance, '2026-12-30'); // 90 jours pour une mineure
  assert.equal(typeof R.leverObservation(e, o.id, { date: '2026-11-05', preuve: 'BI-0412' }, AUJ), 'object');
  assert.equal(R.allegementPossible(e.equipements[0], e).ok, true);
  assert.equal(R.prochaine(e.equipements[0], e), '2028-10-01');
  // Sans la demande explicite : 12 mois.
  e.equipements[0].allegement = false;
  assert.equal(R.prochaine(e.equipements[0], e), '2027-10-01');
  // Levée après l'échéance annuelle : pas de délai allongé.
  const e2 = etat([eq({ allegement: true })]);
  const v2 = R.ajouterVerification(e2, { equipement: 'e1', date: '2025-06-01', resultat: 'observations', observations: [{ texte: 'Prise abîmée' }] }, AUJ, id);
  R.leverObservation(e2, e2.observations[0].id, { date: '2026-07-01', preuve: 'Facture 88' }, AUJ);
  assert.equal(v2.resultat, 'observations');
  assert.equal(R.allegementPossible(e2.equipements[0], e2).ok, false);
  // Un rapport défavorable ferme le délai allongé ; un autre type n'en a pas.
  const e3 = etat([eq({ allegement: true }), { id: 'e2', site: 's1', nom: 'Porte', type: 'PORTES', allegement: true }], [{ id: 'v9', equipement: 'e1', date: '2026-01-01', resultat: 'defavorable' }]);
  assert.equal(R.allegementPossible(e3.equipements[0], e3).ok, false);
  assert.equal(R.periode(e3.equipements[1], e3).mois, 6);
});

test('saisie d’une vérification : contrôles et observations', () => {
  const e = etat([eq()]);
  assert.match(R.ajouterVerification(e, { equipement: 'zz', date: '2026-01-01' }, AUJ), /n'existe plus/);
  assert.match(R.ajouterVerification(e, { equipement: 'e1', date: '' }, AUJ), /date/);
  assert.match(R.ajouterVerification(e, { equipement: 'e1', date: '2026-12-01' }, AUJ), /futur/);
  assert.match(R.ajouterVerification(e, { equipement: 'e1', date: '2026-01-01', lien: 'javascript:alert(1)' }, AUJ), /Lien/);
  assert.match(R.ajouterVerification(e, { equipement: 'e1', date: '2026-01-01', resultat: 'observations', observations: [{ texte: '  ' }] }, AUJ), /au moins une observation/);
  const v = R.ajouterVerification(e, { equipement: 'e1', date: '2026-01-01', organisme: 'Bureau Exemple', rapport: 'RAP-26-001', lien: 'https://exemple.fr/r.pdf', resultat: 'defavorable', observations: [{ texte: 'Danger', gravite: 'danger' }, { texte: 'Écart', gravite: 'inconnue', echeance: '2026-03-01' }] }, AUJ, id);
  assert.equal(v.lien, 'https://exemple.fr/r.pdf');
  assert.equal(e.equipements[0].organisme, 'Bureau Exemple');
  assert.deepEqual(simple(e.observations.map((o) => [o.gravite, o.echeance, o.constateLe])), [['danger', '2026-01-08', '2026-01-01'], ['majeure', '2026-03-01', '2026-01-01']]);
});

test('levée d’une observation : date valide et preuve obligatoire, réouverture possible', () => {
  const e = etat([eq()]);
  R.ajouterVerification(e, { equipement: 'e1', date: '2026-09-01', resultat: 'observations', observations: [{ texte: 'Bloc de secours HS', gravite: 'majeure' }] }, AUJ, id);
  const o = e.observations[0];
  assert.equal(R.statutObservation(o, AUJ), 'retard'); // échéance 2026-10-01
  assert.match(R.leverObservation(e, o.id, { date: '2026-11-20', preuve: 'x' }, AUJ), /futur/);
  assert.match(R.leverObservation(e, o.id, { date: '2026-08-01', preuve: 'x' }, AUJ), /précéder/);
  assert.match(R.leverObservation(e, o.id, { date: '2026-11-01' }, AUJ), /preuve/);
  assert.match(R.leverObservation(e, o.id, { date: '2026-11-01', lien: 'ftp://a' }, AUJ), /Lien/);
  R.leverObservation(e, o.id, { date: '2026-11-01', lien: 'https://exemple.fr/bi.pdf' }, AUJ);
  assert.equal(R.statutObservation(o, AUJ), 'levee');
  assert.equal(o.lienPreuve, 'https://exemple.fr/bi.pdf');
  assert.equal(R.rouvrirObservation(e, o.id), true);
  assert.equal(o.statut, 'ouverte');
  assert.equal(o.leveeLe, null);
});

test('alertes, synthèse et taux à jour', () => {
  const e = etat([
    eq({ id: 'a', derniereConnue: '2025-10-01' }), // retard
    eq({ id: 'b', type: 'EXT', derniereConnue: '2025-12-01' }), // proche
    eq({ id: 'c', type: 'PORTES', derniereConnue: '2026-10-01' }), // ok
    eq({ id: 'd', type: 'LEV_MOB', site: 's2' }), // inconnue
    eq({ id: 'f', type: 'EXT', derniereConnue: '2020-01-01', inactif: true }),
  ]);
  R.ajouterVerification(e, { equipement: 'c', date: '2026-10-01', resultat: 'observations', observations: [{ texte: 'Cellule à remplacer', gravite: 'danger' }] }, AUJ, id);
  const s = R.synthese(e, AUJ);
  assert.deepEqual([s.nb, s.retard, s.proche, s.inconnue, s.ok], [4, 1, 1, 1, 1]);
  assert.equal(s.tauxAJour, 67);
  assert.equal(s.obsOuvertes, 1);
  assert.equal(s.obsDanger, 1);
  const a = R.alertes(e, AUJ);
  assert.deepEqual(simple(a.map((x) => x.genre === 'echeance' ? x.situation.eq.id : 'obs')), ['a', 'obs', 'b', 'd']);
  assert.equal(R.synthese(e, AUJ, 's2').nb, 1);
  assert.equal(R.parSite(e, AUJ).length, 2);
});

test('délai moyen de levée sur 12 mois', () => {
  const e = etat([eq()], [{ id: 'v1', equipement: 'e1', date: '2026-01-10', resultat: 'observations' }], [
    { id: 'o1', verification: 'v1', equipement: 'e1', texte: 'A', constateLe: '2026-01-10', statut: 'levee', leveeLe: '2026-01-20', preuve: 'x' },
    { id: 'o2', verification: 'v1', equipement: 'e1', texte: 'B', constateLe: '2026-01-10', statut: 'levee', leveeLe: '2026-02-09', preuve: 'y' },
    { id: 'o3', verification: 'v1', equipement: 'e1', texte: 'C', constateLe: '2024-01-10', statut: 'levee', leveeLe: '2024-06-01', preuve: 'z' },
  ]);
  const s = R.synthese(e, AUJ);
  assert.equal(s.delaiLevee, 20);
  assert.equal(s.nbLevees, 2);
});

test('calendrier : retards à part, contrôles fréquents répétés, inconnues listées', () => {
  const e = etat([
    eq({ id: 'a', derniereConnue: '2025-10-01' }),
    eq({ id: 'b', type: 'ECL_SECU', derniereConnue: '2026-11-01' }),
    eq({ id: 'c', type: 'AUTRE' }),
  ]);
  const c = R.calendrier(e, AUJ, 12);
  assert.equal(c.mois.length, 12);
  assert.equal(c.mois[0].mois, '2026-11');
  assert.deepEqual(simple(c.retards.map((s) => s.eq.id)), ['a']);
  assert.deepEqual(simple(c.inconnues.map((s) => s.eq.id)), ['c']);
  const mensuel = c.mois.flatMap((m) => m.lignes).filter((l) => l.situation.eq.id === 'b');
  assert.equal(mensuel.length, 11); // 1er décembre 2026 → 1er octobre 2027 (novembre 2026 à octobre 2027)
  assert.equal(mensuel[0].date, '2026-12-01');
  const retard = c.mois.flatMap((m) => m.lignes).filter((l) => l.situation.eq.id === 'a');
  assert.equal(retard.length, 0); // replanifié à un an d'aujourd'hui, hors fenêtre : listé dans les retards
});

test('saisie d’une périodicité', () => {
  assert.deepEqual(simple(R.lirePeriode('12', 'mois')), { mois: 12 });
  assert.deepEqual(simple(R.lirePeriode('6', 'semaines')), { jours: 42 });
  assert.deepEqual(simple(R.lirePeriode('15', 'jours')), { jours: 15 });
  assert.equal(R.lirePeriode('', 'mois'), null);
  assert.ok(Number.isNaN(R.lirePeriode('0', 'mois')));
  assert.ok(Number.isNaN(R.lirePeriode('1,5', 'mois')));
});

test('normalisation tolérante et suppressions en cascade', () => {
  const e = R.normaliser({
    structure: 'Exemple', reglages: { alerteJours: 3, levee: { danger: 2 } },
    sites: [{ id: 's1', nom: 'Siège', type: 'bizarre' }],
    equipements: [{ id: 'e1', site: 's1', type: 'INCONNU' }, { id: 'e2', site: 'absent', type: 'ELEC' }],
    verifications: [{ id: 'v1', equipement: 'e1', date: '2026-01-01', lien: 'javascript:x' }, { id: 'v2', equipement: 'e1', date: 'n/a' }],
    observations: [{ id: 'o1', verification: 'v1', equipement: 'e1', texte: 'A', statut: 'levee' }, { id: 'o2', verification: 'v2', equipement: 'e1' }],
  });
  assert.equal(e.reglages.alerteJours, 45);
  assert.equal(e.reglages.levee.danger, 2);
  assert.equal(e.sites[0].type, 'travail');
  assert.deepEqual(simple(e.equipements.map((x) => [x.id, x.type])), [['e1', 'AUTRE']]);
  assert.equal(e.verifications.length, 1);
  assert.equal(e.verifications[0].lien, '');
  assert.equal(e.observations.length, 1);
  assert.equal(R.normaliser(null).sites.length, 0);
  const e2 = R.supprimerSite(e, 's1');
  assert.deepEqual([e2.sites.length, e2.equipements.length, e2.verifications.length, e2.observations.length], [0, 0, 0, 0]);
  const e3 = R.supprimerVerification(e, 'v1');
  assert.deepEqual([e3.verifications.length, e3.observations.length], [0, 0]);
});

test('export CSV : point-virgule, BOM, formules neutralisées, source de la périodicité', () => {
  const e = etat([eq({ nom: '=SOMME(A1)', derniereConnue: '2026-02-01' }), eq({ id: 'e2', type: 'AUTRE', nom: 'Rayonnages', periodeSaisie: { mois: 12 }, derniereConnue: '2026-03-01' })]);
  R.ajouterVerification(e, { equipement: 'e1', date: '2026-02-01', rapport: 'RAP;1', resultat: 'observations', observations: [{ texte: 'Écart "câble"' }] }, AUJ, id);
  const c = R.versCsvRegistre(e, AUJ);
  assert.ok(c.startsWith('﻿Site;Équipement'));
  assert.ok(c.includes("'=SOMME(A1)"));
  assert.ok(c.includes('"RAP;1"'));
  assert.ok(c.includes('INRS ED 828 p. 56'));
  assert.ok(c.includes('Saisie par l\'utilisateur'));
  const o = R.versCsvObservations(e, AUJ);
  assert.ok(o.includes('"Écart ""câble"""'));
});
