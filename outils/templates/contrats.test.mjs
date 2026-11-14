// Tests des règles métier de Contrats fournisseurs et échéances (templates/contrats/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/contrats/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CTR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
let n = 0;
const id = () => `x${++n}`;
const etat = (contrats, extra = {}) => R.normaliser({ contrats, ...extra });
const ct = (extra = {}) => ({ id: 'c1', nom: 'Maintenance clim', fournisseur: 'Clim Exemple', categorie: 'maintenance', montant: 300, periodicite: 'trimestriel', fin: '2027-03-31', ...extra });
const sit = (e, i = 0, auj = AUJ) => R.situation(e.contrats[i], e, auj);

test('base intégrée : catégories complètes, préavis par défaut sans règle légale non sourcée', () => {
  const ids = BASE.categories.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  for (const id of ['assurances', 'maintenance', 'telecoms', 'leasing', 'logiciels', 'nettoyage', 'energie', 'autre']) assert.ok(ids.includes(id), id);
  assert.ok(BASE.couleurs.length >= BASE.categories.length, 'une couleur fixe par catégorie');
  for (const c of BASE.categories) {
    assert.ok(c.preavisMois === null || (Number.isInteger(c.preavisMois) && c.preavisMois >= 0), c.id);
    assert.ok(['tacite', 'aucune'].includes(c.reconduction), c.id);
  }
  // Seule source légale : les assurances, avec lien Légifrance, version et date de consultation.
  const sourcees = BASE.categories.filter((c) => c.source);
  assert.deepEqual(simple(sourcees.map((c) => c.id)), ['assurances']);
  const s = sourcees[0].source;
  assert.match(s.url, /^https:\/\/www\.legifrance\.gouv\.fr\//);
  assert.match(s.consulte, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(s.texte, /L113-12/);
  assert.match(s.texte, /déroger/);
  // Aucune mention de règles non sourcées dans la base (loi Chatel, résiliation infra-annuelle).
  const brut = readFileSync(new URL('donnees.js', dossier), 'utf8');
  assert.doesNotMatch(brut, /Chatel|Hamon|infra-annuelle/i);
  assert.equal(BASE.reglages.alerteLongue, 60);
  assert.equal(BASE.reglages.alerteCourte, 30);
});

test('moteur de dates commun : mois bornés à la fin du mois, en avant comme en arrière', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2027-05-31', -3), '2027-02-28');
  assert.equal(R.ajoutMois('2028-05-31', -3), '2028-02-29');
  assert.equal(R.ajoutMois('2026-12-31', -12), '2025-12-31');
  assert.equal(R.ecart('2026-11-14', '2026-12-14'), 30);
  assert.equal(R.libellePreavis({ mois: 3 }), '3 mois');
  assert.equal(R.libellePreavis({ jours: 15 }), '15 jours');
  assert.equal(R.libellePreavis({ jours: 0 }), 'Aucun préavis');
  assert.equal(R.libellePreavis(null), 'Préavis à saisir');
});

test('date limite : échéance − préavis de la catégorie, envoi conseillé avec la marge', () => {
  const e = etat([ct()]);
  const s = sit(e);
  assert.equal(s.preavis.origine, 'categorie');
  assert.equal(s.preavis.mois, 3);
  assert.equal(s.fin, '2027-03-31');
  assert.equal(s.limite, '2026-12-31');
  assert.equal(s.envoi, '2026-12-24'); // marge de 7 jours
  assert.equal(s.jours, 40);
  assert.equal(s.statut, 'j60');
  // Préavis du contrat prioritaire, en jours.
  const e2 = etat([ct({ preavis: { jours: 45 } })]);
  assert.equal(sit(e2).preavis.origine, 'contrat');
  assert.equal(sit(e2).limite, '2027-02-14');
  // Préavis nul : la date limite est l'échéance.
  const e3 = etat([ct({ preavis: { jours: 0 } })]);
  assert.equal(sit(e3).limite, '2027-03-31');
});

test('alertes : J-60, J-30, préavis dépassé, puis rien à faire', () => {
  const statut = (fin) => sit(etat([ct({ fin })])).statut;
  // envoi = fin − 3 mois − 7 j
  assert.equal(statut('2027-02-21'), 'j30'); // envoi 2026-11-14 : aujourd'hui
  assert.equal(statut('2027-03-21'), 'j30'); // envoi le 14/12 : dans 30 j
  assert.equal(statut('2027-03-22'), 'j60'); // dans 31 j
  assert.equal(statut('2027-04-20'), 'j60'); // envoi le 13/01 : dans 60 j
  assert.equal(statut('2027-04-21'), 'ok');
  assert.equal(statut('2027-02-20'), 'depassee');
  // Seuils réglables.
  const e = etat([ct({ fin: '2027-04-22' })], { reglages: { alerteLongue: 45, alerteCourte: 15, margeEnvoi: 0 } });
  assert.equal(sit(e).envoi, '2027-01-22'); // dans 69 j
  assert.equal(sit(e).statut, 'ok');
});

test('tacite reconduction : l’échéance passée avance d’une période, reconductions gardées', () => {
  const e = etat([ct({ fin: '2025-03-31', categorie: 'telecoms' })]);
  const s = sit(e);
  assert.equal(s.fin, '2027-03-31');
  assert.deepEqual(simple(s.reconductions), ['2025-03-31', '2026-03-31']);
  assert.equal(s.limite, '2027-02-28'); // préavis télécoms 1 mois, fin de mois bornée
  // Durée de reconduction propre au contrat.
  const e2 = etat([ct({ fin: '2024-06-30', dureeReconductionMois: 36 })]);
  assert.equal(sit(e2).fin, '2027-06-30');
  // L'échéance du jour même n'est pas encore passée.
  assert.equal(sit(etat([ct({ fin: AUJ })])).fin, AUJ);
  // Historique : reconductions déduites des dates.
  const h = R.historique(e, AUJ);
  assert.equal(h.filter((x) => x.type === 'reconduction').length, 2);
  assert.equal(h[0].date, '2026-03-31');
});

test('préavis dépassé : la prochaine vraie occasion est l’échéance suivante', () => {
  const s = sit(etat([ct({ fin: '2027-01-31' })]));
  assert.equal(s.statut, 'depassee');
  assert.equal(s.limite, '2026-10-31');
  assert.equal(s.suivante.fin, '2028-01-31');
  assert.equal(s.suivante.limite, '2027-10-31');
});

test('sans reconduction : alerte sur la fin du contrat, puis terminé', () => {
  const s = sit(etat([ct({ reconduction: 'aucune', fin: '2026-12-20' })]));
  assert.equal(s.statut, 'j60'); // fin dans 36 jours (la date d'envoi ne compte pas)
  assert.equal(sit(etat([ct({ reconduction: 'aucune', fin: '2026-12-01' })])).statut, 'j30');
  const fini = sit(etat([ct({ reconduction: 'aucune', fin: '2026-10-01' })]));
  assert.equal(fini.statut, 'termine');
  assert.equal(fini.actif, false);
  assert.deepEqual(simple(fini.reconductions), []);
});

test('à compléter : sans date de fin ; sans préavis, la clé est l’échéance', () => {
  assert.equal(sit(etat([ct({ fin: null })])).statut, 'inconnue');
  const s = sit(etat([ct({ categorie: 'autre', fin: '2027-06-30' })]));
  assert.equal(s.sansPreavis, true);
  assert.equal(s.limite, null);
  assert.equal(s.statut, 'ok');
  assert.equal(sit(etat([ct({ categorie: 'autre', fin: '2026-12-01' })])).statut, 'j30');
});

test('coût annuel par périodicité, par catégorie et par fournisseur', () => {
  assert.equal(R.coutAnnuel({ montant: 89.9, periodicite: 'mensuel' }), 1078.8);
  assert.equal(R.coutAnnuel({ montant: 300, periodicite: 'trimestriel' }), 1200);
  assert.equal(R.coutAnnuel({ montant: 500, periodicite: 'semestriel' }), 1000);
  assert.equal(R.coutAnnuel({ montant: 2400, periodicite: 'unique' }), 0);
  const e = etat([
    ct({ id: 'a', montant: 100, periodicite: 'mensuel' }),
    ct({ id: 'b', categorie: 'assurances', fournisseur: 'Assur Exemple', montant: 3000, periodicite: 'annuel' }),
    ct({ id: 'c', montant: 50, periodicite: 'trimestriel' }),
    ct({ id: 'd', montant: 999, periodicite: 'mensuel', reconduction: 'aucune', fin: '2026-01-01' }), // terminé : exclu
    ct({ id: 'u', categorie: 'securite', montant: 2400, periodicite: 'unique', reconduction: 'aucune', fin: '2027-01-01' }),
  ]);
  const pc = R.parCategorie(e, AUJ);
  assert.deepEqual(simple(pc.map((x) => [x.categorie.id, x.nb, x.cout])), [['assurances', 1, 3000], ['maintenance', 2, 1400], ['securite', 1, 0]]);
  const s = R.synthese(e, AUJ);
  assert.equal(s.coutAnnuel, 4400);
  assert.equal(s.uniques, 2400);
  assert.equal(s.nb, 4);
  const pf = R.parFournisseur(e, AUJ);
  assert.equal(pf[0].fournisseur, 'Assur Exemple');
  assert.equal(pf[1].cout, 1400);
});

test('décision : vaut pour l’échéance en cours, « Renouveler » éteint l’alerte, la reconduction la remet à zéro', () => {
  const e = etat([ct({ fin: '2027-03-01' })]);
  assert.equal(R.alertes(e, AUJ).length, 1);
  R.decider(e, 'c1', 'renouveler', AUJ, 'prix correct', id);
  assert.equal(sit(e).decision, 'renouveler');
  assert.equal(R.alertes(e, AUJ).length, 0);
  assert.match(e.historique.at(-1).texte, /Renouveler.*prix correct/);
  // Un an plus tard, après la reconduction, la décision ne vaut plus.
  assert.equal(R.situation(e.contrats[0], e, '2027-11-14').decision, 'a-decider');
  // Résilier garde l'alerte (il faut encore envoyer la lettre).
  R.decider(e, 'c1', 'resilier', AUJ, '', id);
  assert.equal(R.alertes(e, AUJ).length, 1);
  assert.equal(R.decider(e, 'c1', 'nimporte', AUJ), 'Choisis une décision.');
  assert.equal(R.decider(e, 'zz', 'resilier', AUJ), 'Ce contrat n\'existe plus.');
});

test('résiliation : dans les délais à l’échéance en cours, en retard à la suivante, puis terminé', () => {
  const e = etat([ct({ fin: '2027-03-31' }), ct({ id: 'c2', fin: '2027-01-31' })]);
  const r = R.resilier(e, 'c1', { envoyeeLe: '2026-11-10', mode: 'Lettre recommandée avec accusé de réception', reference: 'RAR 1' }, AUJ, id);
  assert.equal(r.effetLe, '2027-03-31');
  assert.equal(r.tardive, false);
  assert.equal(sit(e).statut, 'resilie');
  assert.equal(sit(e).actif, false);
  assert.equal(R.situation(e.contrats[0], e, '2027-04-01').statut, 'termine');
  // Envoi après la date limite (31/10) : fin à l'échéance suivante.
  const r2 = R.resilier(e, 'c2', { envoyeeLe: '2026-11-12' }, AUJ, id);
  assert.equal(r2.tardive, true);
  assert.equal(r2.effetLe, '2028-01-31');
  assert.match(e.historique.at(-1).texte, /échéance suivante/);
  // Économie comptée (coût annuel avant → 0).
  assert.equal(R.synthese(e, AUJ).economiesObtenues, 2400);
  // Contrôles de saisie.
  assert.equal(R.resilier(e, 'c1', { envoyeeLe: '2026-12-01' }, AUJ), 'La date d\'envoi ne peut pas être dans le futur.');
  assert.equal(R.resilier(e, 'c1', { envoyeeLe: '' }, AUJ), 'Indique la date d\'envoi.');
  assert.equal(R.resilier(e, 'c1', { envoyeeLe: '2026-11-10', effetLe: '2026-01-01' }, AUJ), 'La fin effective ne peut pas précéder l\'envoi.');
  // Annulation.
  R.annulerResiliation(e, 'c1', AUJ, id);
  assert.equal(sit(e).statut, 'j60');
  assert.equal(e.contrats[0].resiliation, null);
});

test('renégociation : nouveau montant, économie gardée, décision « Renouveler »', () => {
  const e = etat([ct({ fin: '2027-02-15', montant: 400, periodicite: 'trimestriel' })]);
  const r = R.renegocier(e, 'c1', { date: '2026-11-01', montant: '320,50', note: 'Visites groupées' }, AUJ, id);
  assert.equal(r.montant, 320.5);
  const h = e.historique.at(-1);
  assert.equal(h.type, 'renegociation');
  assert.equal(h.coutAvant, 1600);
  assert.equal(h.coutApres, 1282);
  assert.equal(R.synthese(e, AUJ).economiesObtenues, 318);
  assert.equal(sit(e).decision, 'renouveler');
  assert.equal(R.renegocier(e, 'c1', { date: '2026-11-01', montant: 'abc' }, AUJ), 'Indique le nouveau montant (par exemple 120 ou 120,50).');
  assert.equal(R.renegocier(e, 'c1', { date: '2026-12-01', montant: '1' }, AUJ), 'La date de l\'accord ne peut pas être dans le futur.');
  // Nouvelle période.
  R.renegocier(e, 'c1', { date: AUJ, montant: 300, fin: '2028-02-15' }, AUJ, id);
  assert.equal(sit(e).fin, '2028-02-15');
});

test('calendrier : dates d’envoi et échéances des 12 mois, reconductions répétées', () => {
  const e = etat([
    ct({ id: 'a', nom: 'Fibre', categorie: 'telecoms', fin: '2027-01-15', dureeReconductionMois: 6 }),
    ct({ id: 'b', nom: 'Énergie', reconduction: 'aucune', fin: '2027-05-31' }),
    ct({ id: 'c', nom: 'Sans date', fin: null }),
  ]);
  const c = R.calendrier(e, AUJ, 12);
  const toutes = c.mois.flatMap((m) => m.lignes.map((l) => [l.date, l.genre, l.situation.c.id]));
  assert.deepEqual(simple(toutes.filter((x) => x[2] === 'a')), [['2026-12-08', 'envoi', 'a'], ['2027-01-15', 'reconduction', 'a'], ['2027-06-08', 'envoi', 'a'], ['2027-07-15', 'reconduction', 'a']]);
  assert.deepEqual(simple(toutes.filter((x) => x[2] === 'b')), [['2027-05-31', 'fin', 'b']]);
  assert.equal(c.sansDate.length, 1);
  assert.equal(c.mois.length, 12);
  assert.equal(c.mois[0].mois, '2026-11');
});

test('lettre de résiliation : reprend structure, fournisseur, référence, échéance et préavis', () => {
  const e = etat([ct({ reference: 'CS-22', debut: '2024-04-01' })], { structure: 'Société Exemple', lettre: { ville: 'Ville-Exemple', signataire: 'Camille Exemple', fonction: 'Office manager' } });
  const l = R.lettre(e, e.contrats[0], AUJ);
  assert.match(l, /^Société Exemple/);
  assert.match(l, /Clim Exemple/);
  assert.match(l, /Ville-Exemple, le 14 novembre 2026/);
  assert.match(l, /contrat n° CS-22/);
  assert.match(l, /échéance du 31 mars 2027/);
  assert.match(l, /préavis de 3 mois/);
  assert.match(l, /Camille Exemple\nOffice manager$/);
  // Préavis dépassé : la lettre vise l'échéance suivante.
  const e2 = etat([ct({ fin: '2027-01-31' })]);
  assert.match(R.lettre(e2, e2.contrats[0], AUJ), /échéance du 31 janvier 2028/);
  // Champs manquants : repères à compléter.
  assert.match(R.lettre(e2, e2.contrats[0], AUJ), /\[Raison sociale\]/);
});

test('saisie : montants, préavis et liens', () => {
  assert.equal(R.lireMontant('1 250,40 €'), 1250.4);
  assert.equal(R.lireMontant(''), null);
  assert.ok(Number.isNaN(R.lireMontant('-3')));
  assert.deepEqual(simple(R.lirePreavis('3', 'mois')), { mois: 3 });
  assert.deepEqual(simple(R.lirePreavis('30', 'jours')), { jours: 30 });
  assert.deepEqual(simple(R.lirePreavis('0', 'mois')), { jours: 0 });
  assert.equal(R.lirePreavis('', 'mois'), null);
  assert.ok(Number.isNaN(R.lirePreavis('2,5', 'mois')));
  assert.ok(Number.isNaN(R.lirePreavis('40', 'mois')));
  assert.equal(R.lireLien('javascript:alert(1)'), null);
  assert.equal(R.lireLien('https://example.com/c.pdf'), 'https://example.com/c.pdf');
});

test('normalisation tolérante : catégories inconnues, valeurs illisibles, événements orphelins', () => {
  const e = R.normaliser({
    reglages: { alerteLongue: 90, alerteCourte: 200, margeEnvoi: -4, mention: 'TTC' },
    categories: [{ id: 'maintenance', nom: 'Maintenance', preavisMois: 2 }],
    contrats: [{ id: 'a', nom: '', categorie: 'inconnue', montant: 'x', periodicite: 'hebdo', fin: '2026-02-30', preavis: { mois: 2 } }],
    historique: [{ id: 'h1', contrat: 'a', date: '2026-01-01', type: 'decision', texte: 'ok' }, { id: 'h2', contrat: 'zz', date: '2026-01-01', type: 'note' }],
  });
  assert.equal(e.reglages.alerteLongue, 90);
  assert.equal(e.reglages.alerteCourte, 90);
  assert.equal(e.reglages.margeEnvoi, 7);
  assert.equal(e.reglages.mention, 'TTC');
  assert.ok(e.categories.some((c) => c.id === 'autre'), 'catégorie de repli ajoutée');
  const c = e.contrats[0];
  assert.equal(c.nom, 'Contrat');
  assert.equal(c.categorie, 'autre');
  assert.equal(c.montant, 0);
  assert.equal(c.periodicite, 'mensuel');
  assert.equal(c.fin, null);
  assert.deepEqual(simple(c.preavis), { mois: 2 });
  assert.equal(e.historique.length, 1);
  assert.equal(e.initialise, true);
  assert.equal(R.normaliser(null).contrats.length, 0);
  assert.equal(R.normaliser({}).initialise, false);
});

test('export CSV : point-virgule, BOM, formules neutralisées, dates limites', () => {
  const e = etat([ct({ nom: '=SOMME(A1)', note: 'a;b' })]);
  R.decider(e, 'c1', 'renegocier', AUJ, '', id);
  const t = R.versCsvContrats(e, AUJ);
  assert.ok(t.startsWith('﻿'));
  const l = t.slice(1).split('\r\n');
  assert.equal(l.length, 2);
  assert.match(l[0], /^Contrat;Fournisseur;Catégorie/);
  assert.match(l[1], /^'=SOMME\(A1\);/);
  assert.match(l[1], /;2026-12-31;2026-12-24;À anticiper;Renégocier;/);
  assert.match(l[1], /"a;b"$/);
  const h = R.versCsvHistorique(e, AUJ);
  assert.match(h, /Décision/);
});
