// Tests des règles métier des notes de frais (templates/notes-de-frais/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/notes-de-frais/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.NDF;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const B25 = R.normaliserBareme(BASE.baremes[0], BASE.baremes[0]);
const voiture = (extra = {}) => R.normaliserVehicule({ id: 'v1', nom: 'Voiture', type: 'voiture', cv: 5, ...extra });
const etat = (extra = {}) => ({ ...R.etatVide(BASE), ...extra });
const frais = (extra = {}) => R.normaliserFrais({ id: 'f', date: '2026-10-05', cat: 'repas', montant: 1850, ...extra }, AUJ);
const trajet = (extra = {}) => R.normaliserTrajet({ id: 't', date: '2026-10-05', vehicule: 'v1', depart: 'A', arrivee: 'B', km: 100, ...extra }, AUJ);

test('montants : lecture tolérante, négatifs seulement sur demande, affichage', () => {
  assert.equal(R.lireMontant('18,50'), 1850);
  assert.equal(R.lireMontant('18.5 €'), 1850);
  assert.equal(R.lireMontant(' 1 234,56 '), 123456);
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.lireMontant('-12'), null);
  assert.equal(R.lireMontant('-12,40', { negatif: true }), -1240);
  assert.equal(R.lireMontant('−3', { negatif: true }), -300);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(-1240), '−12,40 €');
  assert.equal(R.euros(500, { signe: true }), '+5,00 €');
  assert.equal(R.saisieMontant(-1240), '-12,40');
});

test('kilomètres : lecture, aller-retour, affichage', () => {
  assert.equal(R.lireKm('42'), 42);
  assert.equal(R.lireKm('42,56'), 42.6);
  assert.equal(R.lireKm('1 250 km'), 1250);
  assert.equal(R.lireKm('0'), null);
  assert.equal(R.lireKm('abc'), null);
  assert.equal(R.lireKm('9000'), null);
  assert.equal(R.kmTrajet({ km: 37.5, allerRetour: true }), 75);
  assert.equal(R.kmTrajet({ km: 37.5, allerRetour: false }), 37.5);
  assert.equal(R.km(12345.5), '12 345,5 km');
});

test('base intégrée : catégories courantes, barème complet et daté avec sa source', () => {
  const ids = BASE.categories.map((c) => c.id);
  for (const id of ['repas', 'hebergement', 'train', 'peage', 'stationnement', 'carburant', 'fournitures', 'autres', 'regularisation']) assert.ok(ids.includes(id), id);
  assert.equal(BASE.couleurs.length, BASE.categories.length);
  const b = BASE.baremes[0];
  assert.equal(b.annee, 2025);
  assert.ok(R.estDate(b.publieLe) && R.estDate(b.releveLe));
  assert.match(b.source, /Service-public/);
  assert.equal(b.voiture.length, 5);
  assert.equal(b.moto.length, 3);
  assert.equal(b.cyclo.length, 1);
  assert.equal(BASE.lignesBareme.voiture.length, b.voiture.length);
  // Le barème est (quasi) continu aux seuils : pas de saut d'indemnité en changeant de tranche.
  for (const [type, lignes] of [['voiture', b.voiture], ['moto', b.moto], ['cyclo', b.cyclo]]) {
    for (const l of lignes) {
      b.seuils[type].forEach((s, k) => {
        const avant = s * l.tranches[k][0] + l.tranches[k][1];
        const apres = s * l.tranches[k + 1][0] + l.tranches[k + 1][1];
        assert.ok(Math.abs(avant - apres) / avant < 0.01, `${type} ${l.cv} CV seuil ${s}`);
      });
    }
  }
});

test('barème : ligne selon le type et la puissance fiscale', () => {
  assert.equal(R.ligneBareme(B25, { type: 'voiture', cv: 2 }).index, 0);
  assert.equal(R.ligneBareme(B25, { type: 'voiture', cv: 4 }).index, 1);
  assert.equal(R.ligneBareme(B25, { type: 'voiture', cv: 5 }).index, 2);
  assert.equal(R.ligneBareme(B25, { type: 'voiture', cv: 11 }).index, 4); // 7 CV et plus
  assert.equal(R.ligneBareme(B25, { type: 'moto', cv: 1 }).index, 0);
  assert.equal(R.ligneBareme(B25, { type: 'moto', cv: 4 }).index, 1);
  assert.equal(R.ligneBareme(B25, { type: 'moto', cv: 9 }).index, 2);
  assert.equal(R.ligneBareme(B25, { type: 'cyclo', cv: 1 }).index, 0);
});

test('indemnité annuelle : formule de la tranche appliquée à toute la distance (exemples officiels)', () => {
  // Exemple de Service-public : 4 000 km avec 5 CV = 4 000 × 0,636 = 2 544 €.
  assert.equal(R.indemnite(B25, voiture(), 4000).montant, 254400);
  // 8 000 km à 5 CV : 8 000 × 0,357 + 1 395 = 4 251 €.
  const t2 = R.indemnite(B25, voiture(), 8000);
  assert.equal(t2.montant, 425100);
  assert.equal(t2.tranche, 1);
  // Seuil inclus dans la première tranche ; au-delà de 20 000 km, d × 0,427.
  assert.equal(R.indemnite(B25, voiture(), 5000).tranche, 0);
  assert.equal(R.indemnite(B25, voiture(), 25000).montant, 1067500);
  assert.equal(R.indemnite(B25, voiture({ cv: 3 }), 1000).montant, 52900);
  // Moto 3 à 5 CV, 4 000 km : 4 000 × 0,082 + 1 158 = 1 486 €. Cyclomoteur 2 000 km : 630 €.
  assert.equal(R.indemnite(B25, { type: 'moto', cv: 4 }, 4000).montant, 148600);
  assert.equal(R.indemnite(B25, { type: 'cyclo', cv: 1 }, 2000).montant, 63000);
  assert.equal(R.indemnite(B25, voiture(), 0).montant, 0);
});

test('véhicule électrique : majoration du barème (20 %), modifiable', () => {
  const e = R.indemnite(B25, voiture({ electrique: true }), 4000);
  assert.equal(e.majoration, 20);
  assert.equal(e.montant, Math.round(254400 * 1.2));
  const sans = { ...B25, majorationElectrique: 0 };
  assert.equal(R.indemnite(sans, voiture({ electrique: true }), 4000).montant, 254400);
});

test('barème de l\'année, sinon le plus récent avant (provisoire), sinon le plus ancien', () => {
  const b24 = { ...B25, id: 'b24', annee: 2024 };
  const b26 = { ...B25, id: 'b26', annee: 2026 };
  assert.equal(R.baremePour([B25, b24], 2025).bareme.annee, 2025);
  assert.equal(R.baremePour([B25, b24], 2025).exact, true);
  const p = R.baremePour([B25, b24], 2026);
  assert.equal(p.bareme.annee, 2025);
  assert.equal(p.exact, false);
  assert.equal(R.baremePour([B25, b26], 2026).exact, true);
  assert.equal(R.baremePour([B25], 2023).bareme.annee, 2025);
  assert.equal(R.baremePour([], 2026).bareme, null);
});

test('taux provisoire : taux moyen à la distance estimée, sinon première tranche', () => {
  assert.equal(R.tauxProvisoire(B25, voiture()), 63.6);
  // 8 000 km estimés : 4 251 € / 8 000 km = 53,1375 centimes par km.
  assert.ok(Math.abs(R.tauxProvisoire(B25, voiture({ kmEstimes: 8000 })) - 53.1375) < 1e-9);
  assert.ok(Math.abs(R.tauxProvisoire(B25, voiture({ electrique: true })) - 76.32) < 1e-9);
});

test('bilan annuel : cumul par véhicule, exact, au fil de l\'eau et régularisation', () => {
  const v = voiture();
  const trajets = [];
  // 80 trajets de 100 km en 2025 : 8 000 km.
  for (let i = 0; i < 80; i++) trajets.push(trajet({ id: `t${i}`, date: R.ajout('2025-01-02', i * 4), km: 100 }));
  trajets.push(trajet({ id: 'autre', vehicule: 'v2', date: '2025-03-01', km: 500 }));
  trajets.push(trajet({ id: 'an-suivant', date: '2026-01-05', km: 500 }));
  const E = etat({ vehicules: [v, voiture({ id: 'v2' })], trajets });
  const b = R.bilanVehicule(E, v, 2025, AUJ);
  assert.equal(b.distance, 8000);
  assert.equal(b.trajets, 80);
  assert.equal(b.exacte, 425100);
  assert.equal(b.tranche, 1);
  assert.equal(b.provisoire, 80 * 6360); // valorisé à 0,636 €/km
  assert.equal(b.regularisation, 425100 - 508800); // trop versé : régularisation négative
  assert.equal(b.baremeExact, true);
  assert.equal(b.projection, null); // année terminée
  // Avec la bonne estimation de distance, la régularisation est (presque) nulle.
  const bien = R.bilanVehicule(E, { ...v, kmEstimes: 8000 }, 2025, AUJ);
  assert.ok(Math.abs(bien.regularisation) <= 80);
  // Une régularisation déjà saisie en frais est déduite.
  const E2 = { ...E, frais: [R.normaliserFrais({ id: 'r', cat: 'regularisation', montant: -83700, vehicule: 'v1', annee: 2025, date: '2025-12-31' }, AUJ)] };
  assert.equal(R.bilanVehicule(E2, v, 2025, AUJ).regularisation, 0);
});

test('bilan de l\'année en cours : barème provisoire, distance avant le seuil et projection', () => {
  const v = voiture();
  const E = etat({ vehicules: [v], trajets: [trajet({ id: 'a', date: '2026-01-10', km: 1000, allerRetour: true }), trajet({ id: 'b', date: '2026-06-10', km: 500 })] });
  const b = R.bilanVehicule(E, v, 2026, '2026-07-01');
  assert.equal(b.distance, 2500);
  assert.equal(b.baremeExact, false);
  assert.equal(b.bareme.annee, 2025);
  assert.equal(b.avantSeuil, 2500);
  // 182 jours écoulés au 1er juillet 2026 : 2 500 × 365 / 182.
  assert.equal(b.projection.distance, R.arrondiKm((2500 * 365) / 182));
  assert.equal(b.projection.tranche, 1); // au rythme actuel, l'année passe en deuxième tranche
});

test('note mensuelle : totaux TTC, TVA saisie, indemnités, statut et justificatifs', () => {
  const v = voiture();
  const E = etat({
    vehicules: [v],
    frais: [
      frais({ id: 'f1', montant: 1850, tva: 168, justificatif: 'oui' }),
      frais({ id: 'f2', cat: 'peage', montant: 1240, date: '2026-10-07' }),
      frais({ id: 'f3', montant: 999, date: '2026-09-30' }),
    ],
    trajets: [trajet({ id: 't1', km: 50, allerRetour: true })],
  });
  const n = R.noteMois(E, '2026-10');
  assert.equal(n.frais.length, 2);
  assert.equal(n.ttc, 3090);
  assert.equal(n.tva, 168);
  assert.equal(n.ik, 6360);
  assert.equal(n.total, 9450);
  assert.equal(n.distance, 100);
  assert.equal(n.sansTva, 1);
  assert.equal(n.justificatifsManquants, 1);
  assert.equal(n.statut, 'brouillon');
  assert.equal(R.horsTaxe(n.frais[0]), 1682);
  assert.equal(R.horsTaxe(n.frais[1]), null); // TVA non saisie : jamais calculée
  assert.equal(R.noteMois(E, '2026-08').statut, 'vide');
});

test('statuts : soumission et remboursement d\'un mois, avec leurs dates', () => {
  const E = etat({ vehicules: [voiture()], frais: [frais({ id: 'f1' }), frais({ id: 'f2', date: '2026-11-02' })], trajets: [trajet({ id: 't1' })] });
  assert.equal(R.changerStatutMois(E, '2026-10', 'brouillon', 'soumis', '2026-11-01'), 2);
  const n = R.noteMois(E, '2026-10');
  assert.equal(n.statut, 'soumis');
  assert.equal(n.soumisLe, '2026-11-01');
  assert.equal(E.frais.find((f) => f.id === 'f2').statut, 'brouillon'); // autre mois inchangé
  R.appliquerStatut(E.frais[0], 'rembourse', '2026-11-10');
  assert.equal(R.noteMois(E, '2026-10').statut, 'soumis');
  assert.equal(R.changerStatutMois(E, '2026-10', 'soumis', 'rembourse', '2026-11-12'), 1);
  const r = R.noteMois(E, '2026-10');
  assert.equal(r.statut, 'rembourse');
  assert.equal(E.frais[0].soumisLe, '2026-11-01');
  assert.equal(E.frais[0].rembourseLe, '2026-11-10');
  assert.equal(R.statutEnsemble([{ statut: 'brouillon' }, { statut: 'soumis' }]), 'partiel');
  R.appliquerStatut(E.frais[0], 'brouillon', AUJ);
  assert.equal(E.frais[0].soumisLe, null);
});

test('alertes : mois à soumettre, justificatifs manquants, retard de remboursement, barème provisoire', () => {
  const E = etat({
    vehicules: [voiture()],
    frais: [
      frais({ id: 'a', date: '2026-09-10', statut: 'soumis', soumisLe: '2026-10-01', justificatif: 'oui' }),
      frais({ id: 'b', date: '2026-10-10', justificatif: 'non' }),
      frais({ id: 'c', date: '2026-11-03', justificatif: 'oui' }),
      frais({ id: 'd', date: '2026-08-03', statut: 'rembourse', soumisLe: '2026-09-01', rembourseLe: '2026-09-20', justificatif: 'non' }),
    ],
    trajets: [trajet({ id: 't', date: '2026-11-02' })],
  });
  const l = simple(R.alertes(E, AUJ, 30));
  const types = l.map((x) => x.type);
  assert.deepEqual(types, ['a-soumettre', 'justificatif', 'retard', 'bareme']);
  assert.equal(l[0].mois, '2026-10'); // le mois en cours n'est pas encore à soumettre
  assert.equal(l[1].nb, 1); // le remboursé n'est plus signalé
  assert.equal(l[2].jours, 43);
  assert.equal(l[3].utilise, 2025);
  assert.ok(!R.alertes(E, AUJ, 60).some((x) => x.type === 'retard'));
});

test('totaux annuels : par mois, par catégorie et par statut', () => {
  const E = etat({ vehicules: [voiture()], frais: [frais({ id: 'a' }), frais({ id: 'b', cat: 'hebergement', montant: 9500, date: '2026-03-02', statut: 'rembourse', soumisLe: '2026-04-01', rembourseLe: '2026-04-15' })], trajets: [trajet({ id: 't' })] });
  const t = R.totauxAnnee(E, 2026);
  assert.equal(t.mois.length, 12);
  assert.equal(t.ttc, 11350);
  assert.equal(t.ik, 6360);
  assert.equal(t.mois[9].total, 1850 + 6360);
  assert.deepEqual(simple(t.parCat.map((c) => c.cat)), ['hebergement', 'repas']);
  assert.equal(t.parStatut.rembourse, 9500);
  assert.equal(t.parStatut.brouillon, 1850 + 6360);
});

test('normalisation : tolérante, TVA plafonnée, statut cohérent, barème complété', () => {
  const E = R.normaliser({
    prenom: 'X'.repeat(60), profil: 'autre', reglages: { delaiRemboursement: 999 },
    frais: [{ montant: -50, tva: 99999, statut: 'inconnu', soumisLe: '2026-01-01' }, { cat: 'regularisation', montant: -500, annee: 2025 }, { montant: 1000, tva: 99999 }],
    trajets: [{ km: 'abc', allerRetour: 1 }], vehicules: [{ type: 'cyclo', cv: 9 }, { type: 'avion' }],
    baremes: [{ annee: 2026, majorationElectrique: 20, voiture: [{ tranches: [[0.6, 0]] }] }],
  }, AUJ, BASE);
  assert.equal(E.prenom.length, 40);
  assert.equal(E.profil, 'salarie');
  assert.equal(E.reglages.delaiRemboursement, 180);
  assert.equal(E.frais[0].montant, 0);
  assert.equal(E.frais[0].statut, 'brouillon');
  assert.equal(E.frais[0].soumisLe, null);
  assert.equal(E.frais[1].montant, -500);
  assert.equal(E.frais[2].tva, 1000);
  assert.equal(E.trajets[0].km, 1);
  assert.equal(E.trajets[0].allerRetour, true);
  assert.equal(E.vehicules[0].cv, 1);
  assert.equal(E.vehicules[1].type, 'voiture');
  assert.equal(E.baremes[0].voiture.length, 5);
  assert.equal(E.baremes[0].voiture[0].tranches[0][0], 0.6);
  assert.equal(E.baremes[0].voiture[0].tranches[1][1], 1065); // complété depuis le modèle
  assert.equal(R.normaliser(null, AUJ, BASE).baremes.length, 1);
  assert.equal(R.normaliser({ baremes: [] }, AUJ, BASE).baremes[0].annee, 2025);
});

test('export CSV : frais et trajets, séparateur point-virgule, échappement, BOM', () => {
  const E = etat({ vehicules: [voiture()], frais: [frais({ id: 'a', description: 'Déjeuner; client "X"', tva: 168, justificatif: 'oui', reference: 'Enveloppe octobre' })], trajets: [trajet({ id: 't', km: 12.5, allerRetour: true, date: '2026-10-01' })] });
  const csv = R.versCsv(E, (id) => BASE.categories.find((c) => c.id === id).nom);
  assert.ok(csv.startsWith('﻿Type;Date;'));
  const lignes = csv.slice(1).split('\r\n');
  assert.equal(lignes.length, 3);
  assert.ok(lignes[1].startsWith('Indemnité kilométrique;2026-10-01;Trajet;A → B (aller-retour)'));
  assert.ok(lignes[1].includes(';15,90;'));
  assert.ok(lignes[1].includes(';25;'));
  assert.ok(lignes[2].includes('"Déjeuner; client ""X"""'));
  assert.ok(lignes[2].includes(';18,50;1,68;16,82;'));
  assert.equal(R.versCsv(E, () => '', (x) => x.date >= '2026-10-05').slice(1).split('\r\n').length, 2);
});
