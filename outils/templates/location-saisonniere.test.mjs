// Tests des règles métier de la location saisonnière (templates/location-saisonniere/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/location-saisonniere/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.SJR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';
const DEFAUTS = { reglages: BASE.reglages, canaux: BASE.canaux };

const res = (extra = {}) => R.normaliserReservation({ id: 'r', logement: 'L1', arrivee: '2026-11-10', depart: '2026-11-13', adultes: 2, enfants: 1, canal: 'direct', hebergement: 30000, menage: 5000, ...extra }, AUJ);
function etat(reservations = [], extra = {}) {
  const e = R.etatVide(DEFAUTS);
  e.logements = [R.normaliserLogement({ id: 'L1', nom: 'Studio', capacite: 4, taxe: 100 }), R.normaliserLogement({ id: 'L2', nom: 'Gîte', capacite: 6 })];
  e.canaux.push(R.normaliserCanal({ id: 'A', nom: 'Plateforme A', commission: 15, collecteTaxe: true }));
  e.canaux.push(R.normaliserCanal({ id: 'B', nom: 'Plateforme B', commission: 3 }));
  e.reservations = reservations;
  return Object.assign(e, extra);
}

test('base intégrée : aucun barème de taxe codé en dur, un seul canal « Direct »', () => {
  assert.equal(BASE.reglages.taxeDefaut, null);
  assert.equal(BASE.canaux.length, 1);
  assert.equal(BASE.canaux[0].id, 'direct');
  assert.ok(BASE.sources.length >= 1 && BASE.sources.every(([, u]) => u.startsWith('https://')));
  // Aucune marque de plateforme dans la base ni dans les règles.
  const textes = readFileSync(new URL('donnees.js', dossier), 'utf8') + readFileSync(new URL('regles.js', dossier), 'utf8') + readFileSync(new URL('app.js', dossier), 'utf8');
  assert.doesNotMatch(textes, /airbnb|booking\.com|abritel|vrbo|expedia|gîtes de france|leboncoin/i);
});

test('montants et pourcentages : lecture tolérante, répartition sans perte', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('0,8 €'), 80);
  assert.equal(R.lireMontant('-3'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.lirePct('15,5'), 15.5);
  assert.equal(R.lirePct('3 %'), 3);
  assert.equal(R.lirePct('120'), null);
  assert.deepEqual(simple(R.repartir(1000, [1, 1, 1])), [333, 334, 333]);
  assert.equal(R.repartir(99999, [3, 7, 2]).reduce((s, x) => s + x, 0), 99999);
  assert.deepEqual(simple(R.repartir(500, [0, 0])), [0, 500]);
});

test('nuits et nuits dans une période', () => {
  const r = res({ arrivee: '2026-10-29', depart: '2026-11-03' });
  assert.equal(R.nuits(r), 5);
  assert.equal(R.nuitsDansPeriode(r, '2026-10-01', '2026-11-01'), 3);
  assert.equal(R.nuitsDansPeriode(r, '2026-11-01', '2026-12-01'), 2);
  assert.equal(R.nuitsDansPeriode(r, '2026-12-01', '2027-01-01'), 0);
  // Départ avant ou égal à l'arrivée : corrigé à une nuit.
  assert.equal(R.nuits(res({ arrivee: '2026-11-10', depart: '2026-11-10' })), 1);
});

test('chevauchements : départ et arrivée le même jour autorisés, confirmées interdites, options signalées', () => {
  const a = res({ id: 'a', arrivee: '2026-11-10', depart: '2026-11-13' });
  const b = res({ id: 'b', arrivee: '2026-11-13', depart: '2026-11-15' });
  assert.equal(R.chevauche(a, b), false);
  const c = res({ id: 'c', arrivee: '2026-11-12', depart: '2026-11-14' });
  assert.equal(R.chevauche(a, c), true);
  assert.equal(R.chevauche(a, res({ id: 'd', logement: 'L2', arrivee: '2026-11-12', depart: '2026-11-14' })), false);
  assert.equal(R.chevauche(a, res({ id: 'e', statut: 'annulee', arrivee: '2026-11-11', depart: '2026-11-12' })), false);
  // Une confirmée qui chevauche une confirmée est refusée.
  const ctl = R.controlerChevauchement(c, [a, b]);
  assert.equal(ctl.ok, false);
  assert.equal(ctl.bloquante.id, 'a');
  // Une option peut chevaucher : elle est signalée.
  const opt = res({ id: 'o', statut: 'option', arrivee: '2026-11-12', depart: '2026-11-14' });
  const ctl2 = R.controlerChevauchement(opt, [a, b]);
  assert.equal(ctl2.ok, true);
  assert.deepEqual(ctl2.signales.map((x) => x.id), ['a', 'b']);
  // Une confirmée qui chevauche une option est acceptée (l'option devient en conflit).
  assert.equal(R.controlerChevauchement(res({ id: 'n', arrivee: '2026-11-13', depart: '2026-11-14' }), [opt]).ok, true);
  // Détection dans les données : bloquant entre confirmées.
  const l = R.conflits([a, b, c, opt]);
  assert.equal(l.length, 5); // a-c, a-o, b-c, b-o, c-o
  assert.equal(l.filter((x) => x.bloquant).length, 2);
  assert.equal(R.enConflit(b, [a, b]), false);
});

test('commission, brut, net : pourcentage du canal ou montant saisi', () => {
  const e = etat();
  const A = e.canaux.find((c) => c.id === 'A');
  const r = res({ canal: 'A' });
  assert.equal(R.brut(r), 35000);
  assert.equal(R.commission(r, A), 5250);
  assert.equal(R.net(r, A), 29750);
  assert.equal(R.commission(res({ canal: 'A', commission: 4000 }), A), 4000);
  assert.equal(R.commission(res({ canal: 'A', commission: 0 }), A), 0);
  assert.equal(R.commission(r, null), 0);
});

test('taxe de séjour : tarif saisi, mineurs exonérés, tarif non renseigné', () => {
  const e = etat();
  const [L1, L2] = e.logements;
  // 2 adultes × 3 nuits × 1,00 € ; l'enfant est exonéré.
  assert.equal(R.taxeSejour(res(), L1, e.reglages).montant, 600);
  // Sans exonération des mineurs : 3 personnes.
  assert.equal(R.taxeSejour(res(), L1, { ...e.reglages, exonererMineurs: false }).montant, 900);
  // Logement sans tarif, réglage sans tarif : non renseigné, rien de calculé.
  const t = R.taxeSejour(res({ logement: 'L2' }), L2, e.reglages);
  assert.equal(t.nonRenseigne, true);
  assert.equal(t.montant, 0);
  // Tarif par défaut des Réglages repris par le logement sans tarif.
  assert.equal(R.taxeSejour(res({ logement: 'L2' }), L2, { ...e.reglages, taxeDefaut: 88 }).montant, 2 * 3 * 88);
  // Réservation annulée : aucune taxe.
  assert.equal(R.taxeSejour(res({ statut: 'annulee' }), L1, e.reglages).montant, 0);
});

test('à recevoir, acompte et état des paiements', () => {
  const e = etat();
  // Direct : brut + taxe collectée par le propriétaire.
  const d = res({ arrivee: '2026-11-20', depart: '2026-11-23' });
  assert.equal(R.aRecevoir(d, e), 35000 + 600);
  assert.equal(R.acompteAttendu(d, e), Math.round(35600 * 0.3));
  assert.equal(R.etatPaiement(d, e, AUJ), 'acompteAttendu');
  d.paiements.push({ id: 'p', date: '2026-11-01', montant: 10680 });
  assert.equal(R.etatPaiement(d, e, AUJ), 'acompteRecu');
  // Le jour de l'arrivée, le solde est dû.
  assert.equal(R.etatPaiement(d, e, '2026-11-20'), 'soldeDu');
  // Solde demandé 7 jours avant l'arrivée.
  assert.equal(R.etatPaiement(d, { ...e, reglages: { ...e.reglages, soldeJours: 7 } }, '2026-11-13'), 'soldeDu');
  d.paiements.push({ id: 'q', date: '2026-11-14', montant: 24920 });
  assert.equal(R.etatPaiement(d, e, AUJ), 'solde');
  // Plateforme qui collecte la taxe : net seulement.
  const a = res({ canal: 'A', taxeParCanal: true });
  assert.equal(R.aRecevoir(a, e), 29750);
  assert.equal(R.etatPaiement(res({ statut: 'annulee' }), e, AUJ), 'annulee');
});

test('état du séjour au jour J et occupation de la nuit', () => {
  const r = res({ arrivee: '2026-11-14', depart: '2026-11-16' });
  assert.equal(R.etatSejour(r, '2026-11-13'), 'aVenir');
  assert.equal(R.etatSejour(r, '2026-11-14'), 'arrivee');
  assert.equal(R.etatSejour(r, '2026-11-15'), 'enCours');
  assert.equal(R.etatSejour(r, '2026-11-16'), 'depart');
  assert.equal(R.etatSejour(r, '2026-11-17'), 'termine');
  assert.equal(R.occupeLaNuit(r, '2026-11-16'), false);
  assert.equal(R.occupeLaNuit(r, '2026-11-15'), true);
  assert.equal(R.occupeLaNuit(res({ statut: 'option', arrivee: '2026-11-14', depart: '2026-11-16' }), '2026-11-15'), false);
});

test('ménage entre deux séjours : date, prochaine arrivée, retard, rotation serrée', () => {
  const a = res({ id: 'a', arrivee: '2026-11-08', depart: '2026-11-12' });
  const b = res({ id: 'b', arrivee: '2026-11-14', depart: '2026-11-16' });
  const c = res({ id: 'c', arrivee: '2026-11-16', depart: '2026-11-18' });
  const d = res({ id: 'd', logement: 'L2', arrivee: '2026-11-10', depart: '2026-11-14', menageFait: '2026-11-14' });
  const o = res({ id: 'o', statut: 'option', arrivee: '2026-11-20', depart: '2026-11-22' });
  const m = R.menages([a, b, c, d, o], AUJ);
  const de = (id) => m.find((x) => x.reservation.id === id);
  assert.equal(m.length, 4); // l'option ne crée pas de ménage
  assert.equal(de('a').etat, 'enRetard');
  assert.equal(de('a').avant, '2026-11-14');
  assert.equal(de('b').etat, 'aVenir');
  assert.equal(de('b').serre, true);
  assert.equal(de('c').avant, null);
  assert.equal(de('d').etat, 'fait');
  assert.equal(R.menages([res({ id: 'x', arrivee: '2026-11-12', depart: '2026-11-14' })], AUJ)[0].etat, 'aujourdhui');
});

test('ventilation par mois au prorata des nuits, au centime', () => {
  const e = etat();
  const r = res({ arrivee: '2026-10-30', depart: '2026-11-02', canal: 'A', hebergement: 30001, menage: 5000 });
  const v = R.ventiler(r, e);
  assert.deepEqual(simple(v.map((x) => [x.mois, x.nuits])), [['2026-10', 2], ['2026-11', 1]]);
  assert.equal(v.reduce((s, x) => s + x.hebergement, 0), 30001);
  assert.equal(v.reduce((s, x) => s + x.commission, 0), R.commission(r, e.canaux.find((c) => c.id === 'A')));
  assert.equal(v.reduce((s, x) => s + x.taxe, 0), 600);
  assert.deepEqual(simple(R.ventiler(res({ statut: 'annulee' }), e)), []);
});

test('statistiques : occupation, prix moyen, revenus par canal et par logement', () => {
  const e = etat([
    res({ id: '1', logement: 'L1', arrivee: '2026-11-01', depart: '2026-11-06', canal: 'A', hebergement: 50000, menage: 4000 }),
    res({ id: '2', logement: 'L2', arrivee: '2026-11-10', depart: '2026-11-20', canal: 'direct', hebergement: 90000, menage: 6000 }),
    res({ id: '3', logement: 'L1', arrivee: '2026-11-25', depart: '2026-12-02', canal: 'B', hebergement: 70000, menage: 0 }),
    res({ id: '4', logement: 'L1', arrivee: '2026-11-07', depart: '2026-11-09', statut: 'option', hebergement: 99999 }),
    res({ id: '5', logement: 'L2', arrivee: '2026-11-02', depart: '2026-11-04', statut: 'annulee', hebergement: 99999 }),
  ]);
  const s = R.stats(e, '2026-11-01', '2026-12-01');
  assert.equal(s.dispo, 60);
  assert.equal(s.nuits, 5 + 10 + 6); // le séjour 3 a 6 nuits en novembre, 1 en décembre
  assert.equal(s.occupation, 35);
  assert.equal(s.hebergement, 50000 + 90000 + 60000);
  assert.equal(s.prixMoyen, Math.round(200000 / 21));
  assert.equal(s.sejours, 3);
  const A = s.parCanal.find((c) => c.canal === 'A');
  assert.equal(A.commission, 8100);
  assert.equal(A.net, 54000 - 8100);
  assert.equal(s.parCanal.find((c) => c.canal === 'direct').commission, 0);
  assert.equal(s.parLogement.find((l) => l.logement === 'L2').occupation.toFixed(1), '33.3');
  // Mois de décembre : 1 nuit, 0 séjour arrivé.
  const dec = R.stats(e, '2026-12-01', '2027-01-01');
  assert.equal(dec.nuits, 1);
  assert.equal(dec.sejours, 0);
  // Année : la somme des mois égale l'année.
  const mois = R.parMois(e, 2026);
  const an = R.stats(e, '2026-01-01', '2027-01-01');
  assert.equal(mois.reduce((x, m) => x + m.net, 0), an.net);
  assert.equal(mois.length, 12);
  assert.ok(R.moisVides(e, 2026).includes('2026-01'));
  assert.ok(!R.moisVides(e, 2026).includes('2026-11'));
});

test('tableau du jour : occupés, arrivées, départs, ménages, soldes dus, conflits', () => {
  const e = etat([
    res({ id: 'enc', logement: 'L1', arrivee: '2026-11-12', depart: '2026-11-17' }),
    res({ id: 'arr', logement: 'L2', arrivee: AUJ, depart: '2026-11-16', paiements: [{ date: '2026-10-01', montant: 1000 }] }),
    res({ id: 'dep', logement: 'L2', arrivee: '2026-11-11', depart: AUJ }),
    res({ id: 'opt', logement: 'L1', statut: 'option', arrivee: '2026-11-15', depart: '2026-11-18' }),
  ]);
  const j = R.jour(e, AUJ);
  assert.deepEqual(j.occupes.map((r) => r.id).sort(), ['arr', 'enc']);
  assert.deepEqual(j.arrivees.map((r) => r.id), ['arr']);
  assert.deepEqual(j.departs.map((r) => r.id), ['dep']);
  assert.ok(j.menagesAFaire.some((m) => m.reservation.id === 'dep'));
  assert.ok(j.soldesDus.some((p) => p.r.id === 'arr'));
  assert.equal(j.conflits.length, 1);
  assert.equal(j.conflits[0].bloquant, false);
  assert.equal(j.options.length, 1);
});

test('normalisation tolérante et canal Direct toujours présent', () => {
  const n = R.normaliser({ logements: [{ nom: '' }, null], canaux: [{ id: 'x', nom: 'Plateforme A', commission: '200' }], reservations: [{ arrivee: 'n\'importe', adultes: -4, statut: 'bizarre', paiements: [{ montant: -1 }, { montant: 500 }] }] }, AUJ, DEFAUTS);
  assert.equal(n.logements[0].nom, 'Logement 1');
  assert.equal(n.canaux[0].id, 'direct');
  assert.equal(n.canaux[1].commission, 0);
  const r = n.reservations[0];
  assert.equal(r.arrivee, AUJ);
  assert.equal(r.depart, '2026-11-15');
  assert.equal(r.adultes, 0);
  assert.equal(r.statut, 'confirmee');
  assert.equal(r.paiements.length, 1);
  assert.equal(n.reglages.exonererMineurs, true);
  assert.equal(n.reglages.acomptePct, 30);
  assert.equal(R.normaliser(null, AUJ, DEFAUTS).reservations.length, 0);
  // Limite de logements.
  assert.equal(R.normaliser({ logements: Array.from({ length: 14 }, (_, i) => ({ nom: `L${i}` })) }, AUJ, DEFAUTS).logements.length, R.MAX_LOGEMENTS);
});

test('RGPD : effacement d\'un voyageur et des séjours anciens, montants gardés', () => {
  const e = etat([
    res({ id: 'a', voyageur: 'Famille Exemple', note: 'arrive tard', depart: '2025-08-01', arrivee: '2025-07-25', paiements: [{ date: '2025-07-01', montant: 5000, note: 'virement M. Exemple' }] }),
    res({ id: 'b', voyageur: 'Autre Exemple', arrivee: '2026-11-20', depart: '2026-11-22' }),
  ]);
  const x = R.effacerVoyageur(e, 'a');
  const a = x.reservations.find((r) => r.id === 'a');
  assert.equal(a.voyageur, 'Voyageur effacé');
  assert.equal(a.note, '');
  assert.equal(a.paiements[0].note, '');
  assert.equal(a.paiements[0].montant, 5000);
  assert.equal(a.efface, true);
  assert.equal(e.reservations[0].voyageur, 'Famille Exemple'); // l'état d'origine n'est pas modifié
  const { etat: y, n } = R.effacerAnciens(e, '2026-01-01');
  assert.equal(n, 1);
  assert.equal(y.reservations.find((r) => r.id === 'b').voyageur, 'Autre Exemple');
  assert.equal(R.peutSupprimerLogement(e, 'L1'), false);
  assert.equal(R.peutSupprimerLogement(e, 'L2'), true);
});

test('export CSV : BOM, point-virgule, guillemets, montants', () => {
  const e = etat([res({ voyageur: 'Durand; "les amis"', canal: 'A', taxeParCanal: true })]);
  const csv = R.versCsv(e, AUJ);
  assert.ok(csv.startsWith('﻿Logement;Voyageur;Arrivée'));
  const ligne = csv.split('\r\n')[1];
  assert.match(ligne, /"Durand; ""les amis"""/);
  assert.match(ligne, /;350,00;52,50;297,50;6,00;Plateforme A;297,50;/);
});
