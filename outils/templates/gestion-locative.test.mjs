// Tests des règles métier de la gestion locative (templates/gestion-locative/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/gestion-locative/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.GRT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const DEFAUTS = { reglages: BASE.reglages };

const bail = (extra = {}) => R.normaliserBail({ id: 'B1', bien: 'L1', locataires: 'Camille Exemple', type: 'vide', debut: '2025-03-15', loyer: 60000, charges: 5000, depot: 60000, jourEcheance: 1, revision: { clause: true, trimestre: 2 }, ...extra }, AUJ);
function etat(baux = [bail()], extra = {}) {
  const e = R.etatVide(DEFAUTS);
  e.biens = [R.normaliserBien({ id: 'L1', nom: 'T2 Centre', adresse: '1 rue Fictive, 00000 Exempleville', prixAchat: 12000000, fraisAchat: 900000, travaux: 600000 }), R.normaliserBien({ id: 'L2', nom: 'Studio' })];
  e.baux = baux;
  return Object.assign(e, extra);
}

test('base intégrée : aucun indice IRL, sources service-public datées, modèles sans pénalité de retard', () => {
  const src = readFileSync(new URL('donnees.js', dossier), 'utf8');
  assert.ok(!('irl' in BASE), 'aucune table IRL dans la base');
  assert.doesNotMatch(src, /\b1[34]\d,\d\d\b/, 'aucune valeur d\'indice codée en dur');
  assert.ok(BASE.sources.length >= 6 && BASE.sources.every(([, u]) => u.startsWith('https://')));
  assert.ok(BASE.sources.filter(([l]) => /vérifiée le \d\d\/\d\d\/\d{4}/.test(l)).length >= 6);
  for (const [, m] of Object.entries(BASE.modeles)) assert.doesNotMatch(m.texte, /pénalit|intérêts de retard|frais de retard/i);
  assert.equal(BASE.typesBail.vide.depotMax, 1);
  assert.equal(BASE.typesBail.meuble.depotMax, 2);
  assert.equal(BASE.typesBail.mobilite.depotMax, null);
  assert.ok(BASE.categories.length >= 12 && new Set(BASE.categories.map((c) => c.id)).size === BASE.categories.length);
});

test('dates : mois suivant, ajout de mois borné, trimestres', () => {
  assert.equal(R.moisSuivant('2026-12'), '2027-01');
  assert.equal(R.moisSuivant('2026-01', -1), '2025-12');
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutAns('2024-02-29', 1), '2025-02-28');
  assert.equal(R.finTrimestre('2026-T2'), '2026-06-30');
  assert.equal(R.finTrimestre('2026-T4'), '2026-12-31');
  assert.equal(R.trimestrePrecedentAnnee('2026-T3'), '2025-T3');
  assert.equal(R.joursCommuns('2026-01-10', '2026-03-01', '2026-02-01', '2026-02-28'), 28);
});

test('montants et indices : lecture tolérante', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('600 €'), 60000);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.lireIndice('145,17'), 145.17);
  assert.equal(R.lireIndice('145.2'), 145.2);
  assert.equal(R.lireIndice('12'), null);
  assert.equal(R.euros(60691), '606,91 €');
  assert.deepEqual(R.repartir(1000, [1, 1, 1]), [333, 334, 333]);
});

test('échéances : prorata du premier mois, loyer en vigueur à la date d\'échéance', () => {
  const b = bail();
  const e1 = R.echeance(b, '2025-03', { prorata: true });
  assert.equal(e1.date, '2025-03-15');
  assert.equal(e1.jours, 17);
  assert.equal(e1.loyer, Math.round((60000 * 17) / 31));
  assert.equal(R.echeance(b, '2025-03', { prorata: false }).loyer, 60000);
  assert.equal(R.echeance(b, '2025-02', {}), null);
  const e2 = R.echeance(b, '2025-04', {});
  assert.deepEqual([e2.date, e2.du, e2.prorata], ['2025-04-01', 65000, false]);
  assert.equal(R.echeances(b, '2025-12', {}).length, 10);
  // Fin de bail le 10 : dernier mois au prorata, plus rien ensuite.
  const f = bail({ fin: '2026-06-10' });
  assert.equal(R.echeance(f, '2026-06', {}).loyer, 20000);
  assert.equal(R.echeance(f, '2026-07', {}), null);
  // Jour d'échéance 31 en février : dernier jour du mois.
  assert.equal(R.dateEcheance(bail({ jourEcheance: 31 }), '2026-02'), '2026-02-28');
  // Changement de loyer daté : appliqué aux échéances à partir de cette date.
  const h = bail({ historique: [{ date: '2026-04-05', loyer: 61000, charges: 5000, motif: 'Révision' }] });
  assert.equal(R.echeance(h, '2026-04', {}).loyer, 60000, 'échéance du 1er avril avant le changement');
  assert.equal(R.echeance(h, '2026-05', {}).loyer, 61000);
});

test('situation d\'une échéance : payée, partielle, en retard avec palier, à venir', () => {
  const e = etat();
  const ech = R.echeance(e.baux[0], '2026-11', e.reglages);
  assert.equal(R.situation(ech, [], '2026-10-30', e.reglages).etat, 'aVenir');
  assert.equal(R.situation(ech, [], '2026-11-01', e.reglages).etat, 'aujourdhui');
  const r = R.situation(ech, [], AUJ, e.reglages);
  assert.deepEqual([r.etat, r.joursRetard, r.palier, r.reste], ['retard', 13, 1, 65000]);
  assert.equal(R.situation(ech, [], '2026-11-16', e.reglages).palier, 2);
  assert.equal(R.situation(ech, [], '2026-12-01', e.reglages).palier, 3);
  const p = [{ bail: 'B1', mois: '2026-11', date: '2026-11-02', montant: 30000 }];
  const s = R.situation(ech, p, AUJ, e.reglages);
  assert.deepEqual([s.etat, s.partiel, s.reste], ['retard', true, 35000]);
  p.push({ bail: 'B1', mois: '2026-11', date: '2026-11-10', montant: 35000 });
  assert.equal(R.situation(ech, p, AUJ, e.reglages).etat, 'payee');
  // Impayés : toutes les échéances échues non soldées.
  e.paiements = [];
  assert.equal(R.impayes(e, AUJ).length, R.echeances(e.baux[0], '2026-11', e.reglages).length);
});

test('quittance si payée en entier, reçu si partielle, rien si rien n\'est payé', () => {
  const e = etat();
  e.reglages.bailleurNom = 'Bailleur Exemple';
  assert.equal(R.documentPaiement(e, 'B1', '2026-10', AUJ), null);
  e.paiements = [{ id: 'p1', bail: 'B1', mois: '2026-10', date: '2026-10-03', montant: 40000 }];
  const r = R.documentPaiement(e, 'B1', '2026-10', AUJ);
  assert.deepEqual([r.type, r.paye, r.reste], ['recu', 40000, 25000]);
  e.paiements.push({ id: 'p2', bail: 'B1', mois: '2026-10', date: '2026-10-08', montant: 25000 });
  const q = R.documentPaiement(e, 'B1', '2026-10', AUJ);
  assert.deepEqual([q.type, q.loyer, q.charges, q.periodeDebut, q.periodeFin, q.dernierPaiement], ['quittance', 60000, 5000, '2026-10-01', '2026-10-31', '2026-10-08']);
  assert.equal(q.adresse, '1 rue Fictive, 00000 Exempleville');
});

test('révision : formule IRL arrondie au centime (exemple de service-public F1311)', () => {
  assert.equal(R.nouveauLoyer(60000, 148.37, 146.68), 60691);
});

test('révision : indices du trimestre de référence achevé avant la date, ancien = même trimestre N-1', () => {
  const b = bail();
  const irl = [{ trimestre: '2025-T2', valeur: 140, zone: 'metropole' }, { trimestre: '2026-T2', valeur: 142.8, zone: 'metropole' }, { trimestre: '2026-T1', valeur: 141, zone: 'metropole' }];
  const i = R.indicesRevision(b, '2026-03-15', irl, 'metropole');
  // Le T2 2026 n'est pas achevé au 15/03/2026 : on attend le T2 2025, et il manque le T2 2024.
  assert.equal(i.manque, '2024-T2');
  const j = R.indicesRevision(b, '2026-08-01', irl, 'metropole');
  assert.deepEqual([j.trimestreNouveau, j.irlNouveau, j.trimestreAncien, j.irlAncien], ['2026-T2', 142.8, '2025-T2', 140]);
  assert.equal(R.indicesRevision(b, '2026-08-01', irl, 'corse').manque, '2026-T2', 'zone distincte');
  assert.equal(R.indicesRevision(b, '2026-08-01', [], 'metropole').manque, '2026-T2');
});

test('révision : occurrences, limite d\'un an, perdue, bloquée', () => {
  const irl = [{ trimestre: '2025-T2', valeur: 140, zone: 'metropole' }, { trimestre: '2026-T2', valeur: 142.8, zone: 'metropole' }, { trimestre: '2024-T2', valeur: 138, zone: 'metropole' }];
  const b = bail({ debut: '2024-09-01' });
  const l = R.revisions(b, AUJ, irl, 'metropole');
  assert.deepEqual(simple(l.map((r) => [r.date, r.etat])), [['2025-09-01', 'perdue'], ['2026-09-01', 'aDemander'], ['2027-09-01', 'aVenir']]);
  const c = R.revisionCourante(b, AUJ, irl, 'metropole');
  assert.deepEqual([c.date, c.limite, c.nouveau], ['2026-09-01', '2027-08-31', Math.round(60000 * 142.8 / 140)]);
  assert.equal(R.revisionCourante(bail({ type: 'mobilite' }), AUJ, irl, 'metropole').etat, 'bloquee');
  assert.match(R.blocageRevision(bail({ revision: { clause: true, trimestre: 2, dpeFG: true } })), /DPE/);
  assert.match(R.blocageRevision(bail({ revision: { clause: false } })), /ne prévoit pas/);
  // Date de révision convenue dans le bail.
  assert.equal(R.dateRevision(bail({ revision: { clause: true, trimestre: 2, date: '01-01' } }), 2027), '2027-01-01');
});

test('révision appliquée : effet à la date de la demande, non rétroactive, refusée après un an', () => {
  const irl = [{ trimestre: '2025-T2', valeur: 140, zone: 'metropole' }, { trimestre: '2026-T2', valeur: 142.8, zone: 'metropole' }];
  const b = bail({ debut: '2024-09-01' });
  assert.equal(R.appliquerRevision(b, '2026-09-01', '2027-09-02', irl, 'metropole').ok, false);
  const r = R.appliquerRevision(b, '2026-09-01', '2026-11-14', irl, 'metropole');
  assert.ok(r.ok);
  assert.equal(r.revision.dateEffet, '2026-11-14');
  assert.equal(r.revision.nouveauLoyer, 61200);
  assert.equal(R.echeance(r.bail, '2026-11', {}).loyer, 60000, 'novembre échu le 01/11 : ancien loyer');
  assert.equal(R.echeance(r.bail, '2026-12', {}).loyer, 61200);
  assert.equal(R.revisionCourante(r.bail, AUJ, irl, 'metropole').date, '2027-09-01');
  assert.equal(R.appliquerRevision(r.bail, '2026-09-01', '2026-11-14', irl, 'metropole').ok, false, 'pas deux fois');
  // Demande faite avant la date de révision : effet à la date de révision.
  const avant = R.appliquerRevision(b, '2026-09-01', '2026-08-20', irl, 'metropole');
  assert.equal(avant.revision.dateEffet, '2026-09-01');
  // Indice manquant : message clair.
  const m = R.appliquerRevision(b, '2026-09-01', '2026-11-14', [], 'metropole');
  assert.equal(m.manque, '2026-T2');
  // Annulation : historique et enregistrement retirés.
  const a = R.annulerRevision(r.bail, '2026-09-01');
  assert.equal(R.echeance(a, '2026-12', {}).loyer, 60000);
  assert.equal(R.revisions(R.ignorerRevision(b, '2026-09-01'), AUJ, irl, 'metropole').find((x) => x.date === '2026-09-01').etat, 'ignoree');
});

test('dépôt de garantie : maximum selon le type, délai de restitution 1 ou 2 mois', () => {
  assert.equal(R.controleDepot(bail()), null);
  assert.match(R.controleDepot(bail({ depot: 70000 })), /1 mois/);
  assert.equal(R.controleDepot(bail({ type: 'meuble', depot: 120000 })), null);
  assert.equal(R.normaliserBail({ type: 'mobilite', depot: 50000 }).depot, 0);
  assert.equal(R.etatDepot(bail(), AUJ).etat, 'conserve');
  const s = bail({ fin: '2026-10-31', sortie: { remiseCles: '2026-10-31', conforme: true, retenues: [{ libelle: 'Ménage', montant: 8000 }] } });
  const d = R.etatDepot(s, AUJ);
  assert.deepEqual([d.etat, d.limite, d.aRendre], ['aRestituer', '2026-11-30', 52000]);
  const nc = R.etatDepot(bail({ sortie: { remiseCles: '2026-08-31', conforme: false } }), AUJ);
  assert.deepEqual([nc.etat, nc.limite, nc.moisRetard, nc.majorationIndicative], ['enRetard', '2026-10-31', 1, 6000]);
  assert.equal(R.etatDepot(bail({ sortie: { remiseCles: '2026-08-31', restitueLe: '2026-09-15', restitue: 60000 } }), AUJ).etat, 'restitue');
});

test('régularisation des charges : provisions appelées contre charges récupérables au prorata', () => {
  const e = etat([bail({ debut: '2025-07-01', charges: 5000 })]);
  e.depenses = [
    { id: 'd1', bien: 'L1', date: '2025-05-10', categorie: 'eau', montant: 36500, recuperable: true },
    { id: 'd2', bien: 'L1', date: '2025-10-01', categorie: 'teom', montant: 18250, recuperable: true },
    { id: 'd3', bien: 'L1', date: '2025-10-15', categorie: 'taxe-fonciere', montant: 90000, recuperable: false },
    { id: 'd4', bien: 'L2', date: '2025-10-15', categorie: 'eau', montant: 99999, recuperable: true },
  ];
  const r = R.regularisation(e, 'B1', 2025);
  assert.equal(r.jours, 184);
  assert.equal(r.totalBien, 54750);
  assert.equal(r.reel, Math.round((54750 * 184) / 365));
  assert.equal(r.provisions, 6 * 5000);
  assert.equal(r.solde, r.reel - 30000);
  assert.equal(r.detail.reduce((s, x) => s + x.part, 0), r.reel);
  assert.equal(R.regularisation(etat([bail({ type: 'meuble', modeCharges: 'forfait' })]), 'B1', 2025).forfait, true);
  assert.equal(R.regularisation(e, 'B1', 2024), null);
});

test('bilan : rendement brut et net, vacance, impayés', () => {
  const e = etat([bail({ debut: '2026-01-01', loyer: 60000, charges: 5000 })]);
  e.depenses = [{ id: 'd', bien: 'L1', date: '2026-10-15', categorie: 'taxe-fonciere', montant: 90000, recuperable: false }];
  e.paiements = R.moisAnnee(2026).slice(0, 10).map((m, i) => ({ id: `p${i}`, bail: 'B1', mois: m, date: `${m}-02`, montant: 65000 }));
  const b = R.bilanBien(e, 'L1', 2026, AUJ);
  assert.equal(b.cout, 13500000);
  assert.equal(b.loyers, 12 * 60000);
  assert.equal(b.brut.toFixed(2), (720000 / 13500000 * 100).toFixed(2));
  assert.equal(b.net.toFixed(2), ((720000 - 90000) / 13500000 * 100).toFixed(2));
  assert.equal(b.impaye, 65000, 'novembre en retard, décembre à venir');
  assert.equal(b.joursVacants, 0);
  const vide = R.bilanBien(e, 'L2', 2026, AUJ);
  assert.equal(vide.joursVacants, 365);
  assert.equal(vide.brut, null);
  assert.equal(R.bilan(e, 2026, AUJ).loyers, 720000);
});

test('alertes : impayés, révision à demander et indice manquant, dépôt, régularisation, fin de bail', () => {
  const e = etat([
    bail({ id: 'B1', debut: '2024-09-01' }),
    bail({ id: 'B2', bien: 'L2', debut: '2025-01-01', fin: '2026-10-31', sortie: { remiseCles: '2026-10-31' } }),
  ]);
  e.baux[0].finPrevue = '2027-01-15';
  e.depenses = [{ id: 'd', bien: 'L1', date: '2025-06-01', categorie: 'eau', montant: 20000, recuperable: true }];
  const a = R.alertes(e, AUJ);
  assert.ok(a.impayes.length > 10);
  assert.deepEqual(simple(a.revisions.map((r) => r.bail)), ['B1'], 'bail terminé : plus de révision proposée');
  assert.deepEqual(simple(a.irlManquants), ['2026-T2']);
  assert.equal(a.depots.length, 1);
  assert.equal(a.regularisations.length, 2);
  assert.equal(a.finsBail.length, 1);
  e.baux[0].regularisations = { 2025: { date: '2026-02-01', solde: 0 } };
  assert.equal(R.alertes(e, AUJ).regularisations.length, 1);
});

test('modèles : variables remplacées, variable manquante visible', () => {
  assert.equal(R.remplir('Bonjour {locataire}, {reste}.', { locataire: 'Camille', reste: '10,00 €' }), 'Bonjour Camille, 10,00 €.');
  assert.equal(R.remplir('{bailleur}', {}), '[bailleur]');
});

test('normalisation : tolérante, références orphelines retirées, aucun dépôt en bail mobilité', () => {
  const e = R.normaliser({ biens: [{ id: 'L1', nom: 'A' }], baux: [{ id: 'B1', bien: 'L1', debut: '2026-01-01', loyer: 50000, type: 'inconnu' }, { id: 'B2', bien: 'X' }], paiements: [{ bail: 'B1', mois: '2026-01', date: '2026-01-02', montant: 100 }, { bail: 'B2', mois: '2026-01', date: '2026-01-02', montant: 100 }], irl: [{ trimestre: '2026-T5', valeur: 1 }, { trimestre: '2026-T1', valeur: 145.123 }] }, AUJ, DEFAUTS);
  assert.equal(e.baux.length, 1);
  assert.equal(e.baux[0].type, 'vide');
  assert.equal(e.paiements.length, 1);
  assert.deepEqual(simple(e.irl), [{ trimestre: '2026-T1', valeur: 145.12, zone: 'metropole' }]);
  assert.deepEqual(simple(R.normaliser(null, AUJ, DEFAUTS).reglages.relances), [5, 15, 30]);
  assert.equal(R.normaliserBail({ type: 'mobilite' }).modeCharges, 'forfait');
  assert.equal(R.normaliserBail({ type: 'mobilite' }).revision.clause, false);
  const irl = R.majIrl([{ trimestre: '2026-T1', valeur: 1, zone: 'metropole' }], '2026-T1', 145, 'metropole');
  assert.deepEqual(simple(irl), [{ trimestre: '2026-T1', valeur: 145, zone: 'metropole' }]);
});

test('locataires : effacement, chevauchement de baux, suppression d\'un bien', () => {
  const e = etat([bail({ fin: '2025-12-31' }), bail({ id: 'B2', debut: '2026-02-01' })]);
  const x = R.effacerAnciens(e, '2026-06-01');
  assert.equal(x.n, 1);
  assert.equal(x.etat.baux[0].locataires, 'Locataire effacé');
  assert.equal(x.etat.baux[1].locataires, 'Camille Exemple');
  assert.equal(R.chevauchementBail(e, R.normaliserBail({ id: 'N', bien: 'L1', debut: '2025-06-01' })).id, 'B1');
  assert.equal(R.chevauchementBail(e, R.normaliserBail({ id: 'N', bien: 'L1', debut: '2026-01-01', fin: '2026-01-31' })), null);
  assert.equal(R.peutSupprimerBien(e, 'L1'), false);
  assert.equal(R.peutSupprimerBien(e, 'L2'), true);
});

test('CSV : séparateur point-virgule, montants en euros, BOM', () => {
  const e = etat();
  e.paiements = [{ id: 'p', bail: 'B1', mois: '2025-04', date: '2025-04-01', montant: 65000 }];
  const c = R.csvEcheances(e, AUJ);
  assert.ok(c.startsWith('﻿Bien;Locataire;Mois'));
  assert.match(c, /T2 Centre;Camille Exemple;2025-04;2025-04-01;600,00;50,00;650,00;650,00;0,00;Payé/);
  e.depenses = [{ id: 'd', bien: 'L1', date: '2026-01-02', categorie: 'eau', montant: 1234, recuperable: true, note: 'a;b' }];
  assert.match(R.csvDepenses(e, BASE.categories), /2026-01-02;T2 Centre;Eau;12,34;oui;"a;b"/);
});

test('aucune marque ni plateforme tierce dans le template', () => {
  const textes = ['donnees.js', 'regles.js', 'app.js'].map((f) => readFileSync(new URL(f, dossier), 'utf8')).join('\n');
  assert.doesNotMatch(textes, /airbnb|seloger|leboncoin|pap\.fr|bailfacile|rentila|google|whatsapp/i);
});
