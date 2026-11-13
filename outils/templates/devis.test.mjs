// Tests des règles métier du générateur de devis (templates/devis/regles.js).
// Chaque résultat attendu a été calculé à la main (détail en commentaire).
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../templates/devis/donnees.js');
await import('../../templates/devis/regles.js');
const B = globalThis.BASE;
const R = globalThis.DVS_REGLES;

const ligne = (id, quantite, prixHT, tva = 2000, remise = 0) => ({ id, type: 'ligne', designation: `Ligne ${id}`, unite: 'u', quantite, prixHT, tva, remise });

test('base : taux de TVA datés, catalogues sans prix, sources officielles', () => {
  assert.equal(B.consulteLe, '2026-11-12');
  assert.deepEqual(B.tva.map((t) => t.taux), [2000, 1000, 550, 210, 0]);
  assert.equal(B.metiers.length, 12);
  for (const m of B.metiers) {
    assert.ok(m.lignes.length >= 8, m.id);
    for (const [designation, unite] of m.lignes) { assert.ok(designation); assert.ok(B.unites.includes(unite), `${m.id} : ${unite}`); }
  }
  for (const s of B.sources) assert.match(s.url, /^https:\/\/(www\.)?(entreprendre\.)?(service-public\.gouv\.fr|legifrance\.gouv\.fr|impots\.gouv\.fr|economie\.gouv\.fr)\//);
});

test('saisie : nombres français, arrondi de la saisie, valeurs invalides', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('12.345'), 1235); // 12,345 → 12,35 €
  assert.equal(R.lireMontant('-3,5'), -350);
  assert.equal(R.lireMontant('0,1'), 10);
  assert.equal(R.lireQuantite('2,5'), 2500);
  assert.equal(R.lireQuantite('0,125'), 125);
  assert.equal(R.lirePourcent('5,5 %'), 550);
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.lireMontant('1,2,3'), null);
});

test('affichage : euros, quantités et pourcentages à la française', () => {
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(5), '0,05 €');
  assert.equal(R.euros(-1999), '−19,99 €');
  assert.equal(R.quantite(2500), '2,5');
  assert.equal(R.quantite(3000), '3');
  assert.equal(R.pourcent(550), '5,5 %');
  assert.equal(R.pourcent(2000), '20 %');
  assert.equal(R.saisieMontant(123456), '1234,56');
});

test('arrondi : au centime le plus proche, demi éloigné de zéro', () => {
  assert.equal(R.arrondiDiv(15, 10), 2);
  assert.equal(R.arrondiDiv(14, 10), 1);
  assert.equal(R.arrondiDiv(-15, 10), -2);
  assert.equal(R.arrondiDiv(0, 10), 0);
});

test('ligne : quantité × prix unitaire, puis remise de ligne', () => {
  // 2,5 × 12,34 € = 30,85 € ; remise 10 % = 3,085 → 3,09 € ; net 27,76 €.
  assert.deepEqual(R.calculLigne(ligne('a', 2500, 1234, 2000, 1000)), { brut: 3085, remise: 309, net: 2776 });
  // 0,333 × 10,00 € = 3,33 €.
  assert.deepEqual(R.calculLigne(ligne('b', 333, 1000)), { brut: 333, remise: 0, net: 333 });
  // Remise bornée à 100 %.
  assert.equal(R.calculLigne(ligne('c', 1000, 500, 2000, 15000)).net, 0);
});

test('répartition au prorata : la somme est exacte (plus forts restes)', () => {
  assert.deepEqual(R.repartir(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(R.repartir(1000, [10000, 5000]), [667, 333]);
  assert.deepEqual(R.repartir(7, [0, 0]), [0, 0]);
});

test('totaux : deux taux de TVA, remise globale en euros, acompte de 30 %', () => {
  // A : 100,00 € à 20 % ; B : 50,00 € à 10 %. Remise globale 10,00 € répartie 6,67 / 3,33.
  // Bases 93,33 € et 46,67 € ; TVA 18,666 → 18,67 € et 4,667 → 4,67 €.
  // HT 140,00 € ; TVA 23,34 € ; TTC 163,34 € ; acompte 30 % = 49,002 → 49,00 € ; reste 114,34 €.
  const d = { lignes: [ligne('a', 1000, 10000, 2000), ligne('b', 2000, 2500, 1000)], remise: { mode: 'montant', valeur: 1000 }, acompte: { mode: 'pourcent', valeur: 3000 } };
  const t = R.calculerTotaux(d);
  assert.equal(t.sousTotal, 15000);
  assert.equal(t.remiseGlobale, 1000);
  assert.deepEqual(t.tva, [{ taux: 2000, base: 9333, montant: 1867 }, { taux: 1000, base: 4667, montant: 467 }]);
  assert.equal(t.totalHT, 14000);
  assert.equal(t.totalTVA, 2334);
  assert.equal(t.totalTTC, 16334);
  assert.equal(t.acompte, 4900);
  assert.equal(t.reste, 11434);
  assert.equal(t.tva.reduce((s, x) => s + x.base, 0), t.totalHT);
});

test('totaux : remise globale en pourcent par taux, TVA à 5,5 %', () => {
  // 33,33 € à 5,5 % ; remise 5 % = 1,6665 → 1,67 € ; base 31,66 € ; TVA 1,7413 → 1,74 €.
  const t = R.calculerTotaux({ lignes: [ligne('a', 1000, 3333, 550)], remise: { mode: 'pourcent', valeur: 500 } });
  assert.equal(t.remiseGlobale, 167);
  assert.deepEqual(t.tva, [{ taux: 550, base: 3166, montant: 174 }]);
  assert.equal(t.totalTTC, 3340);
});

test('TVA calculée par taux et non par ligne', () => {
  // 3 lignes de 1,03 € à 5,5 % : par ligne 0,05665 → 0,06 × 3 = 0,18 € ; par taux 3,09 × 5,5 % = 0,16995 → 0,17 €.
  const t = R.calculerTotaux({ lignes: [ligne('a', 1000, 103, 550), ligne('b', 1000, 103, 550), ligne('c', 1000, 103, 550)] });
  assert.equal(t.totalTVA, 17);
  assert.equal(t.totalTTC, 326);
});

test('titres de section : sous-totaux, textes ignorés', () => {
  const d = { lignes: [{ id: 's1', type: 'titre', designation: 'Salle de bains' }, ligne('a', 2000, 1500), { id: 'x', type: 'texte', designation: 'Note' }, { id: 's2', type: 'titre', designation: 'Cuisine' }, ligne('b', 1000, 700)] };
  const t = R.calculerTotaux(d);
  assert.deepEqual(t.sections, { s1: 3000, s2: 700 });
  assert.equal(t.totalHT, 3700);
});

test('franchise en base : aucune TVA, TTC = HT ; acompte en euros borné au TTC', () => {
  const t = R.calculerTotaux({ lignes: [ligne('a', 1000, 50000, 2000), ligne('b', 1000, 12000, 1000)], acompte: { mode: 'montant', valeur: 99999999 } }, { franchise: true });
  assert.equal(t.totalTVA, 0);
  assert.equal(t.totalTTC, 62000);
  assert.deepEqual(t.tva, [{ taux: 0, base: 62000, montant: 0 }]);
  assert.equal(t.acompte, 62000);
  assert.equal(t.reste, 0);
});

test('devis vide : tout à zéro', () => {
  const t = R.calculerTotaux({});
  assert.equal(t.totalTTC, 0);
  assert.deepEqual(t.tva, []);
});

test('numérotation : préfixe, année, compteur jamais réutilisé', () => {
  const liste = [{ numero: 'D-2026-007' }, { numero: 'D-2025-040' }, { numero: 'libre' }];
  assert.deepEqual(R.prochainNumero(liste, 'd', 2026), { numero: 'D-2026-008', rang: 8 });
  assert.deepEqual(R.prochainNumero(liste, 'D', 2026, 9), { numero: 'D-2026-010', rang: 10 });
  assert.equal(R.prochainNumero([], 'DEV 2', 2027).numero, 'DEV2-2027-001');
  assert.equal(R.prochainNumero([{ numero: 'D-2026-1203' }], 'D', 2026).numero, 'D-2026-1204');
});

test('statuts : validité dépassée, dates d\'envoi et de décision', () => {
  const d = { statut: 'envoye', date: '2026-10-01', validiteJours: 30 };
  assert.equal(R.finValidite(d), '2026-10-31');
  assert.equal(R.statutAffiche(d, '2026-10-31'), 'envoye');
  assert.equal(R.statutAffiche(d, '2026-11-01'), 'expire');
  assert.equal(R.statutAffiche({ statut: 'accepte', date: '2020-01-01' }, '2026-11-12'), 'accepte');
  assert.equal(R.statutAffiche({ statut: 'inconnu', date: '2026-11-12' }, '2026-11-12'), 'brouillon');
  const envoye = R.changerStatut({ statut: 'brouillon', date: '2026-11-01' }, 'envoye', '2026-11-03');
  assert.equal(envoye.envoyeLe, '2026-11-03');
  const accepte = R.changerStatut(envoye, 'accepte', '2026-11-10');
  assert.equal(accepte.envoyeLe, '2026-11-03');
  assert.equal(accepte.decideLe, '2026-11-10');
  assert.equal(R.changerStatut(accepte, 'brouillon', '2026-11-11').decideLe, null);
});

test('duplication : nouveau numéro, brouillon, lignes copiées avec de nouveaux identifiants', () => {
  let n = 0;
  const source = { id: 'x', numero: 'D-2026-001', date: '2026-01-05', statut: 'accepte', decideLe: '2026-01-10', objet: 'Peinture', lignes: [ligne('a', 1000, 100)] };
  const c = R.dupliquer(source, { id: 'y', numero: 'D-2026-002', date: '2026-11-12', nouvelId: () => `n${++n}` });
  assert.equal(c.statut, 'brouillon');
  assert.equal(c.decideLe, null);
  assert.equal(c.objet, 'Peinture');
  assert.equal(c.lignes[0].id, 'n1');
  assert.equal(source.lignes[0].id, 'a'); // l'original n'est pas modifié
});

test('mentions manquantes', () => {
  const complet = { nom: 'Atelier', adresse: '1 rue', siren: '000 000 000', forme: 'ei' };
  const devis = { client: { nom: 'Client' }, objet: 'Travaux', lignes: [ligne('a', 1000, 100)] };
  assert.deepEqual(R.mentionsManquantes(complet, devis), []);
  const m = R.mentionsManquantes({ forme: 'societe', siren: '123', assuranceObligatoire: true }, { lignes: [{ ...ligne('a', 1000, 0) }], payant: true });
  assert.ok(m.includes('SIREN : 9 chiffres attendus'));
  assert.ok(m.includes('Forme juridique de la société'));
  assert.ok(m.includes('Assurance professionnelle : assureur et couverture géographique'));
  assert.ok(m.includes('Des lignes sans prix unitaire'));
  assert.ok(m.includes('Coût du devis (il est indiqué payant)'));
  assert.ok(m.includes('Nom du client'));
});

test('tableau de bord : en attente, expirés, acceptés sur 12 mois, taux d\'acceptation', () => {
  const l = [ligne('a', 1000, 10000)];
  const liste = [
    { statut: 'envoye', date: '2026-11-01', validiteJours: 30, lignes: l },
    { statut: 'envoye', date: '2026-08-01', validiteJours: 30, lignes: l },
    { statut: 'accepte', date: '2026-09-01', decideLe: '2026-09-10', lignes: l },
    { statut: 'accepte', date: '2025-01-01', decideLe: '2025-01-10', lignes: l }, // plus de 12 mois
    { statut: 'refuse', date: '2026-10-01', decideLe: '2026-10-05', lignes: l },
    { statut: 'brouillon', date: '2026-11-12', lignes: l },
  ];
  const s = R.statistiques(liste, '2026-11-12');
  assert.equal(s.attente, 1);
  assert.equal(s.attenteHT, 10000);
  assert.equal(s.expires, 1);
  assert.equal(s.acceptes12, 1);
  assert.equal(s.accepteHT12, 10000);
  assert.equal(s.refuses12, 1);
  assert.equal(s.taux, 50);
  assert.equal(s.brouillons, 1);
});
