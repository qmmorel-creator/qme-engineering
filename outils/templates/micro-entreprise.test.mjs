// Tests des règles métier du livre recettes-dépenses micro-entreprise (templates/micro-entreprise/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../templates/micro-entreprise/donnees.js');
await import('../../templates/micro-entreprise/regles.js');
const B = globalThis.BASE;
const R = globalThis.MCE_REGLES;
const T = B.taux;

const recettes = [
  { id: 'a', date: '2026-01-15', client: 'Client A', nature: 'Vente de bols', categorie: 'vente', montant: 1000, mode: 'Carte bancaire', piece: 'F-001' },
  { id: 'b', date: '2026-02-03', client: 'Client B', nature: 'Atelier', categorie: 'bic', montant: 500, mode: 'Virement', piece: 'F-002' },
  { id: 'c', date: '2026-03-31', client: 'Client C', nature: 'Conseil', categorie: 'bnc', montant: 200, mode: 'Virement', piece: 'F-003' },
  { id: 'd', date: '2026-04-01', client: 'Client D', nature: 'Atelier', categorie: 'bic', montant: 300.5, mode: 'Chèque', piece: 'F-004' },
  { id: 'e', date: '2025-12-31', client: 'Client E', nature: 'Vente', categorie: 'vente', montant: 9999, mode: 'Espèces', piece: 'F-000' },
];

test('la base 2026 contient exactement les valeurs de la fiche, datées et sourcées', () => {
  assert.equal(B.millesime, 2026);
  assert.equal(B.consulteLe, '2026-11-12');
  assert.deepEqual(B.sources.map((s) => s.nom), ['urssaf.fr', 'autoentrepreneur.urssaf.fr', 'economie.gouv.fr']);
  assert.deepEqual(T.cotisations, { vente: 12.3, bic: 21.2, bnc: 25.6, cipav: 23.2 });
  assert.deepEqual(T.versementLiberatoire, { vente: 1, bic: 1.7, bnc: 2.2 });
  assert.deepEqual(T.formation, { commercant: 0.1, liberal: 0.2, artisan: 0.3 });
  assert.deepEqual(T.plafonds, { vente: 203100, services: 83600 });
  assert.deepEqual(T.tva, { vente: { base: 85000, majore: 93500 }, services: { base: 37500, majore: 41250 } });
});

test('totaux par mois et par trimestre, année filtrée', () => {
  const m = R.totauxParMois(recettes, 2026);
  assert.equal(m.length, 12);
  assert.deepEqual(m[0], { mois: 0, vente: 1000, bic: 0, bnc: 0, total: 1000 });
  assert.equal(m[2].bnc, 200);
  assert.equal(m[3].total, 300.5);
  assert.equal(m[11].total, 0); // la recette de 2025 n'est pas comptée
  const t = R.totauxParTrimestre(recettes, 2026);
  assert.deepEqual(t[0], { trimestre: 1, vente: 1000, bic: 500, bnc: 200, total: 1700 });
  assert.equal(t[1].total, 300.5);
  assert.equal(t[3].total, 0);
});

test('totaux par catégorie, triés du plus grand au plus petit', () => {
  const depenses = [
    { date: '2026-01-02', categorie: 'Logiciels et abonnements', montant: 12 },
    { date: '2026-02-02', categorie: 'Déplacements', montant: 80.1 },
    { date: '2026-03-02', categorie: 'Logiciels et abonnements', montant: 12 },
    { date: '2025-03-02', categorie: 'Déplacements', montant: 1000 },
  ];
  assert.deepEqual(R.totauxParCategorie(depenses, 2026), [{ categorie: 'Déplacements', total: 80.1 }, { categorie: 'Logiciels et abonnements', total: 24 }]);
  assert.deepEqual(R.totauxParCategorie(recettes, 2026).map((x) => x.categorie), ['vente', 'bic', 'bnc']);
  assert.equal(R.total(R.dansAnnee(recettes, 2026)), 2000.5);
});

test('périodes de déclaration mensuelles et trimestrielles', () => {
  const m = R.periodes(2024, 'mensuelle');
  assert.equal(m.length, 12);
  assert.deepEqual(m[1], { id: '2024-M02', libelle: 'Février 2024', debut: '2024-02-01', fin: '2024-02-29' });
  const t = R.periodes(2026, 'trimestrielle');
  assert.deepEqual(t.map((p) => [p.debut, p.fin]), [['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-06-30'], ['2026-07-01', '2026-09-30'], ['2026-10-01', '2026-12-31']]);
  assert.equal(t[0].libelle, '1er trimestre 2026');
});

test('cotisations estimées par catégorie, caisse BNC SSI ou Cipav', () => {
  const p = R.periodes(2026, 'trimestrielle')[0];
  const ssi = R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'commercant' }, T);
  assert.deepEqual(ssi.ca, { vente: 1000, bic: 500, bnc: 200, total: 1700 });
  assert.deepEqual(ssi.cotisations, { vente: 123, bic: 106, bnc: 51.2 });
  assert.equal(ssi.totalCotisations, 280.2);
  const cipav = R.estimerPeriode(recettes, p.debut, p.fin, { caisseBnc: 'cipav', statutFormation: 'liberal' }, T);
  assert.equal(cipav.cotisations.bnc, 46.4);
  assert.equal(R.tauxCotisation('bnc', '2026-01-01', { caisseBnc: 'cipav' }, T), 23.2);
});

test('formation professionnelle selon le statut', () => {
  const p = { debut: '2026-01-01', fin: '2026-03-31' };
  assert.equal(R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'commercant' }, T).formation, 1.7);
  assert.equal(R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'liberal' }, T).formation, 3.4);
  assert.equal(R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'artisan' }, T).formation, 5.1);
});

test('versement libératoire seulement si l\'option est choisie', () => {
  const p = { debut: '2026-01-01', fin: '2026-03-31' };
  const sans = R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'artisan' }, T);
  assert.equal(sans.totalVL, 0);
  const avec = R.estimerPeriode(recettes, p.debut, p.fin, { statutFormation: 'artisan', versementLiberatoire: true }, T);
  assert.deepEqual(avec.versementLiberatoire, { vente: 10, bic: 8.5, bnc: 4.4 });
  assert.equal(avec.totalVL, 22.9);
  assert.equal(avec.totalAPayer, 280.2 + 5.1 + 22.9);
});

test('ACRE : taux saisis appliqués jusqu\'à la date de fin incluse', () => {
  const profil = { acre: { fin: '2026-02-03', taux: { vente: 6.2, bic: 10.6, bnc: null } } };
  assert.equal(R.tauxCotisation('bic', '2026-02-03', profil, T), 10.6);
  assert.equal(R.tauxCotisation('bic', '2026-02-04', profil, T), 21.2);
  assert.equal(R.tauxCotisation('bnc', '2026-01-01', profil, T), 25.6); // pas de taux saisi : taux normal
  const e = R.estimerPeriode(recettes, '2026-01-01', '2026-03-31', profil, T);
  assert.deepEqual(e.cotisations, { vente: 62, bic: 53, bnc: 51.2 });
});

test('plafond proratisé au nombre de jours la première année', () => {
  assert.equal(R.joursActivite('2026-07-01', 2026), 184);
  assert.equal(R.joursActivite('2024-03-01', 2024), 306); // année bissextile
  assert.equal(R.joursActivite('2025-07-01', 2026), 365);
  assert.equal(R.joursActivite('2027-01-01', 2026), 0);
  const p = R.plafondsAnnee({ debut: '2026-07-01' }, 2026, T);
  assert.equal(p.premiere, true);
  assert.equal(p.vente, Math.round(203100 * 184 / 365));
  assert.equal(p.services, Math.round(83600 * 184 / 365));
  const plein = R.plafondsAnnee({ debut: '2025-07-01' }, 2026, T);
  assert.deepEqual([plein.vente, plein.services, plein.ratio], [203100, 83600, 1]);
});

test('seuils de franchise de TVA : base et majoré, activité mixte', () => {
  assert.equal(R.etatSeuil(1000, 37500, 41250), 'ok');
  assert.equal(R.etatSeuil(30000, 37500, 41250), 'proche');
  assert.equal(R.etatSeuil(37500, 37500, 41250), 'proche');
  assert.equal(R.etatSeuil(37501, 37500, 41250), 'base');
  assert.equal(R.etatSeuil(41251, 37500, 41250), 'majore');
  const liste = [
    { date: '2026-02-01', categorie: 'vente', montant: 50000 },
    { date: '2026-03-01', categorie: 'bic', montant: 39000 },
  ];
  const s = R.seuils(liste, 2026, { activites: ['vente', 'bic'], debut: '2020-01-01' }, T);
  assert.deepEqual(s.tva.map((l) => [l.id, l.valeur, l.base, l.majore, l.etat]), [['total', 89000, 85000, 93500, 'base'], ['services', 39000, 37500, 41250, 'base']]);
  assert.deepEqual(s.plafonds.map((l) => [l.id, l.base, l.etat]), [['total', 203100, 'ok'], ['services', 83600, 'ok']]);
  const seul = R.seuils([{ date: '2026-01-01', categorie: 'bnc', montant: 90000 }], 2026, { activites: ['bnc'] }, T);
  assert.deepEqual(seul.tva.map((l) => [l.id, l.etat]), [['services', 'majore']]);
  assert.deepEqual(seul.plafonds.map((l) => [l.id, l.etat]), [['services', 'depasse']]);
});

test('export CSV : point-virgule, BOM UTF-8, décimales à virgule, champs protégés', () => {
  const texte = R.csvRecettes([...recettes, { id: 'f', date: '2026-05-02', client: 'Dupont; fils', nature: 'Dit "bon"', categorie: 'bic', montant: 12.3, mode: 'Autre', piece: '=1+1' }], 2026);
  assert.ok(texte.startsWith('﻿'));
  const lignes = texte.slice(1).trimEnd().split('\r\n');
  assert.equal(lignes.length, 6); // en-tête + 5 recettes de 2026
  assert.equal(lignes[0], 'Date d\'encaissement;Client;Nature de la prestation ou de la vente;Catégorie;Mode de règlement;Pièce justificative;Montant encaissé (€)');
  assert.equal(lignes[1], '15/01/2026;Client A;Vente de bols;Vente de marchandises (BIC);Carte bancaire;F-001;1000,00');
  assert.equal(lignes[4], '01/04/2026;Client D;Atelier;Prestations de services (BIC);Chèque;F-004;300,50');
  assert.equal(lignes[5], '02/05/2026;"Dupont; fils";"Dit ""bon""";Prestations de services (BIC);Autre;\'=1+1;12,30');
  const annuel = R.csvAnnuel({ recettes, achats: [{ id: 'x', date: '2026-01-01', fournisseur: 'Grossiste', nature: 'Argile', montant: 40, mode: 'Virement', piece: 'A-1' }], depenses: [] }, 2026);
  assert.equal(annuel.slice(1).trimEnd().split('\r\n')[1], '01/01/2026;Achat;Grossiste;Argile;Achat de marchandises;Virement;A-1;40,00');
  assert.equal(R.montantCsv(1234.5), '1234,50');
});
