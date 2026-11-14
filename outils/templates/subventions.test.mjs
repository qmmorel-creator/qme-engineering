// Tests des règles métier du template Subventions (templates/subventions/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/subventions/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.SBV;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const AUJ = '2026-11-14';

// Petit état d'exemple : une commune (publique), une fondation (privée), un projet.
function etat(extra = {}) {
  const e = R.etatVide(B.reglages);
  e.financeurs = [
    R.normaliserFinanceur({ id: 'com', nom: 'Commune', type: 'commune' }, B.typesFinanceur),
    R.normaliserFinanceur({ id: 'fon', nom: 'Fondation', type: 'fondation' }, B.typesFinanceur),
    R.normaliserFinanceur({ id: 'reg', nom: 'Région', type: 'region' }, B.typesFinanceur),
  ];
  e.projets = [R.normaliserProjet({ id: 'p1', nom: 'Fête', annee: 2026, charges: [{ poste: 'Locations', montant: 6000 }, { poste: 'Communication', montant: 4000 }], ressources: [{ poste: 'Fonds propres', montant: 1000 }] }, AUJ)];
  Object.assign(e, extra);
  return e;
}
const D = (x) => R.normaliserDossier({ annee: 2026, ...x }, AUJ);

test('base : types de financeurs, pièces, sources datées, aucun calendrier de financeur', () => {
  const ids = B.typesFinanceur.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['commune', 'departement', 'region', 'etat', 'fondation', 'mecenat']) assert.ok(ids.includes(id), id);
  assert.ok(B.typesFinanceur.filter((t) => t.public).length >= 5);
  for (const t of B.typesFinanceur) assert.ok(B.couleurs[t.couleur], `couleur de ${t.id}`);
  const pieces = B.pieces.map((p) => p.id);
  assert.equal(new Set(pieces).size, pieces.length);
  for (const id of [...B.depart.public, ...B.depart.prive]) assert.ok(pieces.includes(id), `départ ${id}`);
  for (const s of B.sources) {
    assert.match(s.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
    assert.ok(R.estDate(s.consulte));
    assert.ok(s.verifiePar);
  }
  assert.equal(B.regles.convention.seuil, 23000);
  assert.equal(B.regles.compteRendu.mois, 6);
  assert.equal(B.regles.comptesAnnuels.seuil, 153000);
  // Aucune date de financeur ni appel à projets intégrés.
  assert.ok(!JSON.stringify(B).match(/20\d\d-\d\d-\d\d/g)?.some((d) => d !== B.sources[0].consulte && d !== B.version));
});

test('montants : lecture tolérante, euros, normalisation', () => {
  assert.equal(R.lireNombre('1 250,50'), 1250.5);
  assert.equal(R.lireNombre('12 000 €'), 12000);
  assert.ok(Number.isNaN(R.lireNombre('abc')));
  assert.equal(R.montantOuNull('-4'), null);
  assert.equal(R.euros(25000), '25\u00a0000\u00a0€');
  assert.equal(R.euros(12.5, { centimes: true }), '12,50\u00a0€');
  const d = D({ demande: '3 000', accorde: '', statut: 'nimporte', limiteDepot: '2026-02-30', pieces: [{ nom: 'X', statut: 'bizarre' }] });
  assert.equal(d.demande, 3000);
  assert.equal(d.accorde, null);
  assert.equal(d.statut, 'preparation');
  assert.equal(d.limiteDepot, null);
  assert.equal(d.pieces[0].statut, 'afaire');
});

test('normaliser : anciennes données, références orphelines retirées', () => {
  const e = R.normaliser({ financeurs: [{ id: 'a', nom: 'A', type: 'inconnu' }], dossiers: [{ id: 'd', financeur: 'zz', projet: 'pp' }], depenses: [{ projet: 'pp', dossier: 'd', montant: '10' }] }, AUJ, B);
  assert.equal(e.financeurs[0].type, 'autre');
  assert.equal(e.dossiers[0].financeur, null);
  assert.equal(e.dossiers[0].projet, null);
  assert.equal(e.depenses[0].projet, null);
  assert.equal(e.depenses[0].dossier, 'd');
  eq(e.reglages, { alerte: 21, relanceReponse: 30, debutExercice: 1, rappels: true });
  eq(R.normaliser(null, AUJ, B).dossiers, []);
});

test('pièces de départ selon le type de financeur', () => {
  const pub = R.piecesDepart(B, 'commune');
  const prive = R.piecesDepart(B, 'fondation');
  assert.ok(pub.some((p) => p.base === 'crf-precedent'));
  assert.ok(!prive.some((p) => p.base === 'crf-precedent'));
  assert.ok(prive.some((p) => p.base === 'contreparties'));
  assert.ok(pub.every((p) => p.statut === 'afaire'));
  const d = D({ pieces: [{ nom: 'a', statut: 'pret' }, { nom: 'b' }, { nom: 'c', statut: 'sansobjet' }, { nom: 'd', statut: 'joint' }] });
  eq(R.avancementPieces(d.pieces), { total: 3, pretes: 2 });
  assert.equal(R.piecesManquantes(d), 1);
});

test('versements, reste à percevoir et dossier clos', () => {
  const d = D({ statut: 'accorde', demande: 5000, accorde: 4000, versements: [{ montant: 2400, prevuLe: '2026-03-01', recuLe: '2026-03-04' }, { montant: 1600, prevuLe: '2026-11-01' }] });
  assert.equal(R.accordeDe(d), 4000);
  assert.equal(R.verse(d), 2400);
  assert.equal(R.resteAPercevoir(d), 1600);
  assert.equal(R.etatDossier(d), 'accorde');
  d.versements[1].recuLe = '2026-11-10';
  assert.equal(R.resteAPercevoir(d), 0);
  assert.equal(R.etatDossier(d), 'accorde', 'bilan encore à rendre');
  d.bilanRendu = '2026-11-12';
  assert.equal(R.etatDossier(d), 'clos');
  // Accord sans montant précisé : le montant demandé fait foi.
  assert.equal(R.accordeDe(D({ statut: 'accorde', demande: 900 })), 900);
  // Refus : rien à percevoir.
  assert.equal(R.resteAPercevoir(D({ statut: 'refuse', demande: 900 })), 0);
  // Fonctionnement sans bilan demandé : clos une fois tout versé.
  assert.equal(R.etatDossier(D({ statut: 'accorde', demande: 500, sansBilan: true, versements: [{ montant: 500, recuLe: '2026-02-01' }] })), 'clos');
});

test('date du bilan : saisie, sinon 6 mois après la fin de l\'exercice pour un financeur public', () => {
  const e = etat();
  eq(R.limiteBilan(e, B, D({ financeur: 'com', bilanLimite: '2027-03-31' })), { date: '2027-03-31', origine: 'saisie' });
  eq(R.limiteBilan(e, B, D({ financeur: 'com' })), { date: '2027-06-30', origine: 'regle' });
  // Exercice décalé (septembre à août) : exercice 2026 clos le 31/08/2027, bilan avant le 29/02/2028.
  e.reglages.debutExercice = 9;
  assert.equal(R.finExercice(2026, 9), '2027-08-31');
  assert.equal(R.limiteBilan(e, B, D({ financeur: 'com' })).date, '2028-02-29');
  e.reglages.debutExercice = 1;
  // Privé, fonctionnement, sans bilan ou rappels désactivés : pas de date calculée.
  assert.equal(R.limiteBilan(e, B, D({ financeur: 'fon' })).date, null);
  assert.equal(R.limiteBilan(e, B, D({ financeur: 'com', nature: 'fonctionnement' })).date, null);
  assert.equal(R.limiteBilan(e, B, D({ financeur: 'com', sansBilan: true, bilanLimite: '2027-01-01' })).date, null);
  e.reglages.rappels = false;
  assert.equal(R.limiteBilan(e, B, D({ financeur: 'com' })).date, null);
});

test('convention attendue au-delà de 23 000 € accordés par un financeur public', () => {
  const e = etat();
  assert.equal(R.conventionAttendue(e, B, D({ financeur: 'reg', statut: 'accorde', demande: 30000, accorde: 25000 })), true);
  assert.equal(R.conventionAttendue(e, B, D({ financeur: 'reg', statut: 'accorde', accorde: 23000 })), false, 'seuil non dépassé');
  assert.equal(R.conventionAttendue(e, B, D({ financeur: 'reg', statut: 'accorde', accorde: 25000, convention: true })), false);
  assert.equal(R.conventionAttendue(e, B, D({ financeur: 'fon', statut: 'accorde', accorde: 50000 })), false, 'privé');
  assert.equal(R.conventionAttendue(e, B, D({ financeur: 'reg', statut: 'depose', demande: 50000 })), false, 'pas encore accordé');
});

test('échéances : dépôt, réponse à relancer, versement en retard, bilan, convention ; tri', () => {
  const e = etat();
  e.dossiers = [
    D({ id: 'a', financeur: 'fon', statut: 'preparation', limiteDepot: '2026-11-23', pieces: [{ nom: 'x' }, { nom: 'y', statut: 'pret' }] }),
    D({ id: 'b', financeur: 'com', statut: 'preparation', limiteDepot: '2027-02-01' }),
    D({ id: 'c', financeur: 'com', statut: 'depose', depot: '2026-09-01' }),
    D({ id: 'd', financeur: 'com', statut: 'depose', depot: '2026-11-01', reponseAttendue: '2026-12-20' }),
    D({ id: 'e', financeur: 'reg', statut: 'accorde', accorde: 25000, versements: [{ montant: 15000, prevuLe: '2026-05-01', recuLe: '2026-05-02' }, { montant: 10000, prevuLe: '2026-11-01' }] }),
    D({ id: 'f', financeur: 'com', annee: 2025, statut: 'accorde', accorde: 2000, versements: [{ montant: 2000, recuLe: '2025-04-01' }] }),
    D({ id: 'g', financeur: 'com', statut: 'refuse', limiteDepot: '2026-01-01' }),
  ];
  const ech = R.echeances(e, B, AUJ);
  const de = (id) => ech.filter((x) => x.dossier === id).map((x) => `${x.type}:${x.niveau}`);
  eq(de('a'), ['depot:proche']);
  assert.equal(ech.find((x) => x.dossier === 'a').manquantes, 1);
  eq(de('b'), ['depot:avenir']);
  eq(de('c'), ['reponse:retard'], 'relance à 30 jours du dépôt');
  assert.equal(ech.find((x) => x.dossier === 'c').estimee, true);
  eq(de('d'), ['reponse:avenir']);
  eq(de('e').sort(), ['bilan:avenir', 'convention:proche', 'versement:retard']);
  eq(de('f'), ['bilan:retard'], 'compte rendu 2025 attendu avant le 30/06/2026');
  eq(de('g'), []);
  // Tri : retards d'abord, puis par date.
  const rangs = ech.map((x) => x.niveau);
  eq(rangs, [...rangs].sort((x, y) => ['retard', 'proche', 'avenir'].indexOf(x) - ['retard', 'proche', 'avenir'].indexOf(y)));
  const retards = ech.filter((x) => x.niveau === 'retard').map((x) => x.date);
  eq(retards, [...retards].sort());
});

test('synthèse annuelle : demandé, accordé, versé, reste, taux et types de financeurs', () => {
  const e = etat();
  e.dossiers = [
    D({ financeur: 'com', statut: 'accorde', demande: 5000, accorde: 4000, versements: [{ montant: 2400, recuLe: '2026-03-01' }] }),
    D({ financeur: 'reg', statut: 'refuse', demande: 3000 }),
    D({ financeur: 'fon', statut: 'depose', demande: 1500 }),
    D({ financeur: 'fon', statut: 'abandonne', demande: 9999 }),
    D({ financeur: 'com', annee: 2025, statut: 'accorde', demande: 100 }),
  ];
  const s = R.syntheseAnnee(e, B, 2026);
  assert.equal(s.nb, 4);
  assert.equal(s.demande, 9500, 'abandons exclus');
  assert.equal(s.accorde, 4000);
  assert.equal(s.verse, 2400);
  assert.equal(s.reste, 1600);
  assert.equal(s.enAttente, 1500);
  assert.equal(s.tauxAcceptation, 50);
  assert.equal(s.tauxObtention, 80);
  eq(s.parType.map((x) => [x.type, x.demande, x.accorde]), [['commune', 5000, 4000], ['region', 3000, 0], ['fondation', 1500, 0]]);
  assert.equal(R.syntheseAnnee(e, B, 2024).tauxAcceptation, null);
});

test('seuil des comptes annuels : versements publics reçus sur l\'exercice', () => {
  const e = etat();
  e.dossiers = [
    D({ financeur: 'reg', statut: 'accorde', accorde: 200000, versements: [{ montant: 100000, recuLe: '2026-02-01' }, { montant: 60000, recuLe: '2026-12-01' }, { montant: 40000, recuLe: '2027-01-15' }] }),
    D({ financeur: 'fon', statut: 'accorde', accorde: 90000, versements: [{ montant: 90000, recuLe: '2026-02-01' }] }),
  ];
  eq(R.seuilComptesAnnuels(e, B, 2026), { total: 160000, seuil: 153000, depasse: true, proche: false });
  eq(R.seuilComptesAnnuels(e, B, 2027), { total: 40000, seuil: 153000, depasse: false, proche: false });
  e.reglages.debutExercice = 9; // exercice 2026 = sept. 2026 à août 2027
  assert.equal(R.seuilComptesAnnuels(e, B, 2026).total, 100000);
  assert.equal(R.seuilComptesAnnuels(e, B, 2026).proche, false);
  assert.equal(R.seuilComptesAnnuels(e, B, 2025).total, 100000);
});

test('budget du projet : part de chaque financeur, équilibre, prévu et réalisé', () => {
  const e = etat();
  e.dossiers = [
    D({ id: 'x', projet: 'p1', financeur: 'com', statut: 'accorde', demande: 5000, accorde: 4000 }),
    D({ id: 'y', projet: 'p1', financeur: 'fon', statut: 'depose', demande: 2000 }),
    D({ id: 'z', projet: 'p1', financeur: 'reg', statut: 'refuse', demande: 3000 }),
  ];
  e.depenses = [
    R.normaliserDepense({ projet: 'p1', poste: 'Locations', montant: 7500, justificatif: true, dossier: 'x' }, AUJ),
    R.normaliserDepense({ projet: 'p1', poste: 'Divers', montant: 100 }, AUJ),
  ];
  const b = R.budgetProjet(e, 'p1');
  assert.equal(b.charges, 10000);
  assert.equal(b.totalSub, 6000);
  assert.equal(b.acquises, 4000);
  eq(b.subventions.map((s) => [s.dossier, s.montant, s.acquis, s.part]), [['x', 4000, true, 40], ['y', 2000, false, 20]]);
  assert.equal(b.ressources, 7000);
  assert.equal(b.equilibre, -3000);
  assert.equal(b.realise, 7600);
  assert.equal(b.tauxRealisation, 76);
  assert.equal(b.sansJustificatif, 1);
  eq(b.postes.map((p) => [p.poste, p.prevu, p.reel, p.ecart]), [['Locations', 6000, 7500, 1500], ['Communication', 4000, 0, -4000], ['Divers', 0, 100, 100]]);
  assert.equal(b.postes[0].ecartPct, 25);
  assert.equal(b.postes[2].ecartPct, null);
  assert.equal(R.budgetProjet(e, 'inconnu'), null);
});

test('bilan d\'un dossier : justifié par les dépenses imputées, sinon estimation', () => {
  const e = etat();
  const x = D({ id: 'x', projet: 'p1', financeur: 'com', statut: 'accorde', accorde: 4000 });
  const y = D({ id: 'y', projet: 'p1', financeur: 'fon', statut: 'accorde', accorde: 2000 });
  e.dossiers = [x, y];
  e.depenses = [
    R.normaliserDepense({ projet: 'p1', poste: 'Locations', montant: 3000, justificatif: true, dossier: 'x' }, AUJ),
    R.normaliserDepense({ projet: 'p1', poste: 'Locations', montant: 500, justificatif: false, dossier: 'x' }, AUJ),
    R.normaliserDepense({ projet: 'p1', poste: 'Communication', montant: 1500, justificatif: true }, AUJ),
  ];
  const bx = R.bilanDossier(e, x);
  assert.equal(bx.aJustifier, 4000);
  assert.equal(bx.part, 40);
  assert.equal(bx.imputees, 2);
  assert.equal(bx.justifie, 3000);
  assert.equal(bx.sansJustificatif, 1);
  assert.equal(bx.estimation, null);
  assert.equal(bx.couverture, 75);
  const by = R.bilanDossier(e, y);
  assert.equal(by.imputees, 0);
  assert.equal(by.estimation, 1000, '5 000 € réalisés × 20 %');
  assert.equal(by.couverture, 50);
  const sansProjet = R.bilanDossier(e, D({ statut: 'accorde', accorde: 800 }));
  assert.equal(sansProjet.part, null);
  assert.equal(sansProjet.budget, null);
});

test('recherche sans accents, tri et années', () => {
  const e = etat();
  e.dossiers = [
    D({ id: 'a', financeur: 'reg', intitule: 'Atelier vélo', statut: 'accorde', annee: 2026 }),
    D({ id: 'b', financeur: 'com', intitule: 'Fête', statut: 'preparation', limiteDepot: '2026-12-01', annee: 2027 }),
    D({ id: 'c', financeur: 'fon', intitule: 'Ancien', statut: 'refuse', annee: 2024 }),
  ];
  eq(R.rechercher(e, e.dossiers, 'velo').map((d) => d.id), ['a']);
  eq(R.rechercher(e, e.dossiers, 'région').map((d) => d.id), ['a']);
  eq(R.rechercher(e, e.dossiers, '').map((d) => d.id), ['a', 'b', 'c']);
  eq(R.trierDossiers(e.dossiers).map((d) => d.id), ['b', 'a', 'c']);
  eq(R.annees(e, AUJ), [2027, 2026, 2024]);
});

test('export CSV : en-têtes, séparateur, virgule décimale, échappement', () => {
  const e = etat();
  e.dossiers = [D({ financeur: 'com', projet: 'p1', intitule: 'Fête; "édition"', statut: 'accorde', demande: 1000.5, accorde: 900, versements: [{ montant: 450, recuLe: '2026-03-01' }] })];
  e.depenses = [R.normaliserDepense({ projet: 'p1', date: '2026-04-01', libelle: 'Son', montant: 12.3, justificatif: true }, AUJ)];
  const c = R.versCsv(e, B, AUJ);
  assert.ok(c.startsWith('﻿Année;Dossier;Financeur'));
  const ligne = c.split('\r\n')[1].split(';');
  assert.ok(c.includes('"Fête; ""édition"""'));
  assert.ok(c.includes(';1000,5;900;450;450;'));
  assert.ok(ligne.includes('Commune'));
  assert.ok(c.includes('2027-06-30'), 'date du bilan calculée');
  const cd = R.versCsvDepenses(e);
  assert.ok(cd.split('\r\n')[1].startsWith('2026-04-01;Fête;;Son;;12,3;;Oui;'));
});
