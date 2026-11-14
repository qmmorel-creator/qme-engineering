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
const R = ctx.window.GST;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const DEFAUTS = { reglages: BASE.reglages };
// Un bien, un locataire, un bail nu de 600 € + 50 € de provisions au 1er du mois depuis le 01/01/2026.
const etat = (bail = {}, extra = {}) => {
  const e = R.normaliser({
    bailleur: { nom: 'Bailleur Exemple', adresse: '1 rue Imaginaire, 99000 Exempleville' },
    biens: [{ id: 'b1', nom: 'T2 Exemple', adresse: '12 rue Imaginaire, 99000 Exempleville', prixAchat: 15000000, fraisAchat: 1200000, travauxAchat: 300000, coproNonRecup: 40000, taxeFonciere: 90000, assurance: 15000 }],
    locataires: [{ id: 'l1', nom: 'Paul Exemple', contact: 'paul@exemple.invalid' }],
    baux: [{ id: 'x', bien: 'b1', locataires: ['l1'], type: 'nu', debut: '2026-01-01', loyerHC: 60000, charges: 5000, depot: 60000, jourEcheance: 1, trimestreIrl: '2025-T2', ...bail }],
    ...extra,
  }, AUJ, DEFAUTS);
  return e;
};
const paie = (date, montant, bail = 'x') => ({ id: `p${date}${montant}`, bail, date, montant });

test('dates, mois et montants', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2024-02-29', 12), '2025-02-28');
  assert.equal(R.moisSuivant('2026-12'), '2027-01');
  assert.equal(R.finMois('2028-02'), '2028-02-29');
  assert.deepEqual(simple(R.listeMois('2026-11', '2027-02')), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.equal(R.lireMontant('1 234,5 €'), 123450);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.lireMontant('-15', { negatif: true }), -1500);
  assert.equal(R.lireMontant('-15'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(-500), '−5,00 €');
  assert.equal(R.saisieMontant(-1505), '-15,05');
  assert.equal(R.lireIndice('146,68'), 146.68);
  assert.equal(R.lireIndice('5'), null);
  assert.equal(R.lireIndice('abc'), null);
  assert.equal(R.libelleTrimestre('2026-T1'), '1er trimestre 2026');
  assert.equal(R.libelleTrimestre('2026-T3'), '3e trimestre 2026');
  assert.equal(R.trimestreDecale('2025-T2', 1), '2026-T2');
});

test('formule de révision : exemple de service-public.gouv.fr (600 € → 606,91 €)', () => {
  assert.equal(R.loyerRevise(60000, 146.68, 148.37), 60691);
  assert.equal(R.loyerRevise(60000, 0, 148.37), null);
  assert.equal(R.loyerRevise(60000, null, 148.37), null);
  // Baisse de l'indice : le loyer baisse aussi.
  assert.equal(R.loyerRevise(50000, 140, 139), 49643);
});

test('échéances mensuelles, prorata d\'entrée et de sortie', () => {
  const e = etat({ debut: '2026-01-15' });
  const l = R.echeances(e.baux[0], '2026-03');
  assert.equal(l.length, 3);
  assert.equal(l[0].date, '2026-01-15'); // jamais avant l'entrée
  assert.equal(l[0].loyer, Math.round(60000 * 17 / 31));
  assert.equal(l[1].montant, 65000);
  assert.equal(l[1].date, '2026-02-01');
  const s = etat({ debut: '2026-01-01', sortie: '2026-03-10' });
  const l2 = R.echeances(s.baux[0], '2026-12');
  assert.equal(l2.length, 3);
  assert.equal(l2[2].loyer, Math.round(60000 * 10 / 31));
  // Jour d'échéance 31 borné à la fin du mois.
  const j = etat({ jourEcheance: 28 });
  assert.equal(R.echeance(j.baux[0], '2026-02'), '2026-02-28');
});

test('loyer en vigueur selon les modifications datées', () => {
  const e = etat({ modifs: [{ date: '2026-06-01', loyerHC: 61000, motif: 'revision' }, { date: '2026-09-01', charges: 7000, motif: 'regularisation' }] });
  const b = e.baux[0];
  assert.deepEqual(simple(R.loyerA(b, '2026-05-31')), { loyerHC: 60000, charges: 5000 });
  assert.deepEqual(simple(R.loyerA(b, '2026-06-01')), { loyerHC: 61000, charges: 5000 });
  assert.deepEqual(simple(R.loyerA(b, '2026-10-01')), { loyerHC: 61000, charges: 7000 });
  const l = R.echeances(b, '2026-10');
  assert.equal(l.find((d) => d.mois === '2026-06').montant, 66000);
  assert.equal(l.find((d) => d.mois === '2026-10').montant, 68000);
});

test('affectation FIFO, statuts, retard et palier', () => {
  const pay = ['2026-01-03', '2026-02-02', '2026-03-20', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d) => paie(d, 65000));
  const e = etat({}, { paiements: [...pay, paie('2026-10-08', 30000)] });
  const c = R.compte(e, 'x', AUJ);
  const st = Object.fromEntries(c.lignes.map((d) => [d.mois, d.statut]));
  assert.equal(st['2026-01'], 'paye');
  assert.equal(st['2026-03'], 'payeRetard'); // payé 19 jours après l'échéance, tolérance 5
  assert.equal(st['2026-10'], 'partiel');
  assert.equal(st['2026-11'], 'impaye');
  assert.equal(st['2026-12'], 'avenir');
  assert.equal(c.impaye, 35000 + 65000);
  assert.equal(c.plusAncienne.mois, '2026-10');
  assert.equal(c.retard, 44);
  assert.equal(c.palier, 2);
  assert.equal(c.avance, 0);
  // Dans le délai de tolérance : ni retard ni palier.
  const t = R.compte(etat({}, { paiements: pay.concat([paie('2026-10-01', 65000)]) }), 'x', '2026-11-04');
  assert.equal(t.lignes.find((d) => d.mois === '2026-11').statut, 'attente');
  assert.equal(t.impaye, 0);
  assert.equal(t.palier, null);
  // Paiement trop élevé : l'excédent part sur l'échéance suivante, puis en avance.
  const a = R.compte(etat({ debut: '2026-11-01' }, { paiements: [paie('2026-11-01', 80000)] }), 'x', AUJ);
  assert.equal(a.lignes[1].paye, 15000);
  assert.equal(a.lignes[1].statut, 'partiel');
  assert.equal(a.avance, 0);
  assert.equal(R.compte(etat({ debut: '2026-11-01' }, { paiements: [paie('2026-11-01', 140000)] }), 'x', AUJ).avance, 10000);
  assert.equal(R.palier(4, [5, 15, 30]), null);
  assert.equal(R.palier(5, [5, 15, 30]), 0);
  assert.equal(R.palier(29, [5, 15, 30]), 1);
  assert.equal(R.palier(0, [5, 15, 30]), null);
});

test('paiement futur ignoré à la date du jour', () => {
  const e = etat({ debut: '2026-11-01' }, { paiements: [paie('2026-11-20', 65000)] });
  const c = R.compte(e, 'x', AUJ);
  assert.equal(c.paye, 0);
  assert.equal(c.impaye, 65000);
});

test('quittance si payé, reçu si partiel, rien si impayé', () => {
  const e = etat({ debut: '2026-10-01' }, { paiements: [paie('2026-10-02', 65000), paie('2026-11-05', 20000)] });
  const q = R.quittance(e, 'x', '2026-10', AUJ);
  assert.equal(q.type, 'quittance');
  assert.equal(q.loyer, 60000);
  assert.equal(q.charges, 5000);
  assert.equal(q.debut, '2026-10-01');
  assert.equal(q.fin, '2026-10-31');
  const t = R.texteQuittance(q);
  assert.match(t, /QUITTANCE DE LOYER · OCTOBRE 2026/);
  assert.match(t, /Loyer hors charges : 600,00 €/);
  assert.match(t, /Provision sur charges : 50,00 €/);
  assert.match(t, /gratuitement/);
  const r = R.quittance(e, 'x', '2026-11', AUJ);
  assert.equal(r.type, 'recu');
  assert.equal(r.paye, 20000);
  assert.equal(r.reste, 45000);
  assert.match(R.texteQuittance(r), /ne vaut pas quittance/);
  assert.equal(r.payeLoyer + r.payeCharges, 20000);
  assert.equal(R.quittance(e, 'x', '2026-12', AUJ), null);
  assert.equal(R.quittance(e, 'x', '2025-12', AUJ), null);
  // Forfait de charges en meublé.
  const f = etat({ debut: '2026-10-01', type: 'meuble', modeCharges: 'forfait' }, { paiements: [paie('2026-10-02', 65000)] });
  assert.match(R.texteQuittance(R.quittance(f, 'x', '2026-10', AUJ)), /Forfait de charges : 50,00 €/);
});

test('relance : texte rempli par palier, rien sans retard', () => {
  const e = etat({ debut: '2026-09-01' }, { paiements: [paie('2026-09-01', 65000)] });
  const r = R.texteRelance(e, 'x', 1, BASE.relances, AUJ);
  assert.equal(r.titre, 'Relance');
  assert.match(r.texte, /Paul Exemple/);
  assert.match(r.texte, /1 300,00 €/);
  assert.match(r.texte, /octobre 2026/);
  assert.match(r.texte, /12 rue Imaginaire/);
  assert.doesNotMatch(r.texte, /\{\w+\}/);
  const m = R.texteRelance(e, 'x', 2, BASE.relances, AUJ);
  assert.match(m.texte, /mets en demeure/);
  assert.ok(m.note.length > 0);
  assert.equal(R.texteRelance(etat({ debut: '2026-11-01' }, { paiements: [paie('2026-11-01', 65000)] }), 'x', 0, BASE.relances, AUJ), null);
  // Tous les modèles : aucune variable inconnue.
  for (const mo of BASE.relances) for (const v of (mo.texte + mo.objet).match(/\{(\w+)\}/g) || []) assert.ok(['{locataire}', '{adresse}', '{montant}', '{mois}', '{depuis}', '{bailleur}', '{date}', '{detail}'].includes(v), v);
});

test('révisions : échéancier, indice manquant, à faire, appliquée, perdue', () => {
  const irl = [{ trimestre: '2024-T2', valeur: 140 }, { trimestre: '2025-T2', valeur: 142.1 }, { trimestre: '2026-T2', valeur: 143.5 }];
  // Bail du 01/12/2024 : révisions le 01/12/2025 (perdue au 14/11/2026 ? non : limite 30/11/2026) et 01/12/2026.
  const e = etat({ debut: '2024-12-01', trimestreIrl: '2024-T2' }, { irl });
  const r = R.revisions(e, 'x', AUJ);
  assert.equal(r.length, 2);
  assert.equal(r[0].date, '2025-12-01');
  assert.equal(r[0].limite, '2026-11-30');
  assert.equal(r[0].trimestre, '2025-T2');
  assert.equal(r[0].statut, 'aFaire');
  assert.equal(r[0].loyer, R.loyerRevise(60000, 140, 142.1));
  assert.equal(r[1].date, '2026-12-01');
  assert.equal(r[1].statut, 'aFaire'); // dans moins de 45 jours, indices saisis
  assert.equal(r[1].trimestreAncien, '2025-T2');
  // Après la limite : perdue.
  assert.equal(R.revisions(e, 'x', '2026-12-01')[0].statut, 'perdue');
  // Indice manquant.
  const m = etat({ debut: '2024-12-01', trimestreIrl: '2024-T2' }, { irl: irl.slice(0, 2) });
  assert.equal(R.revisions(m, 'x', AUJ)[1].statut, 'irlManquant');
  // Appliquée : la suivante part du loyer révisé.
  const rev = R.revisions(e, 'x', AUJ)[0];
  const modif = R.appliquerRevision(e.baux[0], rev, '2026-01-10');
  assert.equal(modif.date, '2026-01-10'); // date de la demande, sans rétroactivité
  assert.equal(modif.revisionDe, '2025-12-01');
  e.baux[0].modifs.push({ id: 'm1', ...modif });
  const r2 = R.revisions(e, 'x', AUJ);
  assert.equal(r2[0].statut, 'appliquee');
  assert.equal(r2[1].base, rev.loyer);
  assert.equal(r2[1].loyer, R.loyerRevise(rev.loyer, 142.1, 143.5));
  // Demande avant la date : prend effet à la date de révision ; après la limite : refusée.
  assert.equal(R.appliquerRevision(e.baux[0], rev, '2025-11-01').date, '2025-12-01');
  assert.equal(R.appliquerRevision(e.baux[0], rev, '2026-12-01'), null);
  // Sans clause, révision à venir.
  assert.equal(R.revisions(etat({ debut: '2024-12-01', clauseRevision: false }, { irl }), 'x', AUJ)[0].statut, 'sansClause');
  assert.equal(R.revisions(etat({ debut: '2026-06-01' }, { irl }), 'x', AUJ)[0].statut, 'avenir');
});

test('révision interdite pour un logement classé F ou G (bail depuis le 24/08/2022)', () => {
  const irl = [{ trimestre: '2025-T2', valeur: 142.1 }, { trimestre: '2026-T2', valeur: 143.5 }];
  const e = etat({ debut: '2025-12-01' }, { irl });
  e.biens[0].dpe = 'G';
  assert.equal(R.revisions(e, 'x', AUJ)[0].statut, 'dpe');
  const ancien = etat({ debut: '2025-12-01', signeLe: '2021-05-01' }, { irl });
  ancien.biens[0].dpe = 'F';
  assert.equal(R.revisions(ancien, 'x', AUJ)[0].statut, 'aFaire');
  e.biens[0].dpe = 'E';
  assert.equal(R.revisions(e, 'x', AUJ)[0].statut, 'aFaire');
});

test('régularisation des charges : provisions contre réel récupérable, au prorata', () => {
  const deps = [
    { id: 'd1', bien: 'b1', date: '2025-06-01', categorie: 'copro', montant: 200000, recuperable: 80000 },
    { id: 'd2', bien: 'b1', date: '2025-10-15', categorie: 'teom', montant: 18000, recuperable: 18000 },
    { id: 'd3', bien: 'b1', date: '2025-10-15', categorie: 'taxeFonciere', montant: 90000, recuperable: 0 },
    { id: 'd4', bien: 'b1', date: '2026-02-01', categorie: 'copro', montant: 50000, recuperable: 20000 },
  ];
  const e = etat({ debut: '2025-01-01' }, { depenses: deps });
  const rg = R.regularisation(e, 'x', 2025);
  assert.equal(rg.provisions, 60000);
  assert.equal(rg.reelBien, 98000);
  assert.equal(rg.reel, 98000);
  assert.equal(rg.solde, 38000);
  assert.equal(rg.depenses.length, 2);
  assert.equal(R.provisionProposee(rg), 8200);
  // Entrée au 1er juillet : moitié de l'année environ.
  const p = R.regularisation(etat({ debut: '2025-07-01' }, { depenses: deps }), 'x', 2025);
  assert.equal(p.jours, 184);
  assert.equal(p.reel, Math.round(98000 * 184 / 365));
  assert.equal(p.provisions, 30000);
  // Appliquée : la régularisation devient une échéance (ou un crédit si négative).
  e.baux[0].reguls = [{ id: 'g1', annee: 2025, date: '2026-03-01', montant: 38000 }];
  assert.ok(R.regularisation(e, 'x', 2025).appliquee);
  const l = R.echeances(e.baux[0], '2026-03');
  assert.ok(l.some((d) => d.type === 'regul' && d.montant === 38000));
  const neg = etat({ debut: '2026-01-01', reguls: [{ id: 'g2', annee: 2025, date: '2026-02-01', montant: -10000 }] });
  const c = R.compte(neg, 'x', '2026-02-10');
  assert.equal(c.paye, 10000); // crédit affecté à la première échéance
  // Forfait : signalé.
  assert.equal(R.regularisation(etat({ modeCharges: 'forfait' }), 'x', 2026).forfait, true);
});

test('dépôt de garantie : plafond, délai de restitution, pénalité', () => {
  const e = etat({ depot: 70000 });
  assert.equal(R.depot(e, e.baux[0]).depasse, true);
  assert.equal(R.depot(e, e.baux[0]).plafond, 60000);
  const m = etat({ type: 'meuble', depot: 120000 });
  assert.equal(R.depot(m, m.baux[0]).depasse, false);
  const s = etat({ debut: '2025-01-01', sortie: '2026-08-10', edlConforme: true });
  assert.equal(R.depot(s, s.baux[0]).limite, '2026-09-10');
  const r = R.retardRestitution(s, s.baux[0], AUJ);
  assert.equal(r.retardMois, 3); // 10/09 → 14/11 : 3 mois commencés
  assert.equal(r.penalite, 3 * 6000);
  const nc = etat({ debut: '2025-01-01', sortie: '2026-08-10', edlConforme: false });
  assert.equal(R.depot(nc, nc.baux[0]).limite, '2026-10-10');
  const rendu = etat({ debut: '2025-01-01', sortie: '2026-08-10', edlConforme: true, restitution: { date: '2026-09-01', montant: 60000 } });
  assert.equal(R.retardRestitution(rendu, rendu.baux[0], AUJ).penalite, 0);
});

test('rendement brut, net et mensuel avec crédit', () => {
  const e = etat({ debut: '2025-01-01' });
  const r = R.rendement(e, 'b1', AUJ);
  assert.equal(r.prix, 16500000);
  assert.equal(r.loyers, 720000);
  assert.equal(r.charges, 145000);
  assert.ok(Math.abs(r.brut - 720000 / 16500000 * 100) < 1e-9);
  assert.ok(Math.abs(r.net - 575000 / 16500000 * 100) < 1e-9);
  assert.equal(r.mensuel, Math.round(575000 / 12));
  e.biens[0].credit = { mensualite: 70000, fin: '2040-01-01' };
  assert.equal(R.rendement(e, 'b1', AUJ).mensuel, Math.round((575000 - 840000) / 12));
  // Vacant : pas de rendement.
  const v = etat({ debut: '2025-01-01', sortie: '2026-06-30' });
  assert.equal(R.rendement(v, 'b1', AUJ).vacant, true);
  assert.equal(R.rendement(v, 'b1', AUJ).brut, null);
});

test('récapitulatif annuel : loyers et charges encaissés, dépenses par catégorie', () => {
  const e = etat({ debut: '2025-12-01' }, {
    paiements: [paie('2025-12-01', 65000), paie('2026-01-02', 65000), paie('2026-02-01', 32500)],
    depenses: [{ id: 'd', bien: 'b1', date: '2026-10-01', categorie: 'taxeFonciere', montant: 90000, recuperable: 0 }, { id: 'e', bien: 'b1', date: '2026-10-01', categorie: 'teom', montant: 15000, recuperable: 15000 }],
  });
  const r = R.recapAnnuel(e, 2026, AUJ);
  assert.equal(r.loyers, 60000 + 30000);
  assert.equal(r.charges, 5000 + 2500);
  assert.equal(r.encaisse, 97500);
  assert.equal(r.parBien[0].cats.taxeFonciere.total, 90000);
  assert.equal(r.recuperable, 15000);
  assert.equal(R.recapAnnuel(e, 2025, AUJ).loyers, 60000);
});

test('RGPD : effacer, supprimer, exporter un locataire', () => {
  const e = etat({ note: 'Garant : un parent' }, { paiements: [{ ...paie('2026-01-01', 65000), note: 'Virement de M. Exemple' }] });
  const ef = R.effacerLocataire(e, 'l1', 2);
  assert.equal(ef.locataires[0].nom, 'Locataire effacé 2');
  assert.equal(ef.locataires[0].contact, '');
  assert.equal(ef.baux[0].note, '');
  assert.equal(ef.paiements[0].note, '');
  assert.equal(ef.paiements[0].montant, 65000);
  assert.equal(e.locataires[0].nom, 'Paul Exemple'); // état d'origine intact
  const su = R.supprimerLocataire(e, 'l1');
  assert.equal(su.locataires.length, 0);
  assert.deepEqual(simple(su.baux[0].locataires), []);
  assert.equal(su.baux.length, 1);
  const d = R.donneesLocataire(e, 'l1', AUJ);
  assert.equal(d.locataire.nom, 'Paul Exemple');
  assert.equal(d.baux[0].paiements.length, 1);
  assert.equal(d.baux[0].loyerHC, 600);
  assert.equal(R.donneesLocataire(e, 'inconnu', AUJ), null);
});

test('normalisation tolérante et réglages bornés', () => {
  const v = R.normaliser(null, AUJ, DEFAUTS);
  assert.deepEqual(simple(v.baux), []);
  assert.equal(v.reglages.tolerance, 5);
  const n = R.normaliser({
    irl: [{ trimestre: '2026-T2', valeur: 143.5 }, { trimestre: '2026-T2', valeur: 1 }, { trimestre: 'xx', valeur: 3 }, { trimestre: '2025-T2', valeur: 142 }],
    baux: [{ debut: 'mauvais', loyerHC: -5, type: 'bizarre', jourEcheance: 40, fin: '2000-01-01' }],
    paiements: [{ bail: 'a', montant: 0 }, { bail: 'a', montant: 100 }],
    depenses: [{ montant: 1000, recuperable: 5000 }],
    reglages: { paliers: [30, 15, 5], tolerance: 999 },
  }, AUJ, DEFAUTS);
  assert.deepEqual(simple(n.irl.map((x) => x.trimestre)), ['2025-T2', '2026-T2']);
  assert.equal(n.irl[1].valeur, 143.5);
  assert.equal(n.baux[0].debut, AUJ);
  assert.equal(n.baux[0].loyerHC, 0);
  assert.equal(n.baux[0].type, 'nu');
  assert.equal(n.baux[0].jourEcheance, 28);
  assert.equal(n.baux[0].fin, null);
  assert.equal(n.baux[0].clauseRevision, true);
  assert.equal(n.paiements.length, 1);
  assert.equal(n.depenses[0].recuperable, 1000);
  assert.deepEqual(simple(n.reglages.paliers), [5, 15, 30]);
  assert.equal(n.reglages.tolerance, 60);
});

test('synthèse : encaissé du mois, retards, révisions, dépôt à rendre', () => {
  const irl = [{ trimestre: '2025-T2', valeur: 142.1 }, { trimestre: '2026-T2', valeur: 143.5 }];
  const e = etat({ debut: '2025-12-01' }, { irl, paiements: [paie('2026-11-02', 65000)] });
  e.baux.push(R.normaliserBail({ id: 'y', bien: 'b1', locataires: [], debut: '2024-01-01', sortie: '2025-11-20', loyerHC: 50000, depot: 50000, edlConforme: true }, AUJ));
  const s = R.synthese(e, AUJ);
  assert.equal(s.encaisseMois, 65000);
  assert.equal(s.attenduMois, 65000);
  assert.ok(s.retards.length >= 1); // le bail y (ancien) n'a aucun paiement
  assert.equal(s.revs.length, 1);
  assert.equal(s.depots.length, 1);
  assert.ok(s.depots[0].penalite > 0);
  assert.equal(s.biensVacants.length, 0);
});

test('export CSV : en-tête, séparateur point-virgule, BOM', () => {
  const e = etat({ debut: '2026-10-01' }, { paiements: [paie('2026-10-01', 65000)] });
  const csv = R.versCsv(e, AUJ);
  assert.ok(csv.startsWith('﻿Bien;Locataire'));
  assert.match(csv, /T2 Exemple;Paul Exemple;Location nue;2026-10-01;2026-10;Loyer;600,00;50,00;650,00;650,00;0,00;Payé;2026-10-01/);
  const dc = R.depensesCsv(etat({}, { depenses: [{ bien: 'b1', date: '2026-01-01', categorie: 'teom', libelle: 'Avis; 2026', montant: 1500, recuperable: 1500 }] }), BASE.categories);
  assert.match(dc, /"Avis; 2026"/);
  assert.match(dc, /Taxe d'ordures ménagères/);
});

test('base intégrée : aucun indice IRL, règles et sources datées', () => {
  assert.equal(BASE.irl, undefined);
  assert.ok(!/\b1[34]\d,\d\d\b/.test(readFileSync(new URL('donnees.js', dossier), 'utf8').replace(/F1311[^']*'/g, '')));
  assert.equal(BASE.relances.length, 3);
  assert.equal(BASE.reglages.paliers.length, 3);
  assert.ok(BASE.sources.length >= 4);
  assert.ok(BASE.categories.every((c) => c.id && c.nom));
  assert.match(BASE.fiscal, /pas un calcul d'impôt/);
});
