// Tests des règles métier du simulateur leasing ou achat (templates/leasing/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/leasing/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.VTR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
// L'affichage utilise des espaces insécables (milliers et avant l'unité).
const aff = (s) => s.replace(/(\d) (?=\d)/g, '$1\u00a0').replace(/ (€|km|%)/g, '\u00a0$1');

// Comparaison sans ajustement kilométrique de la valeur ni placement, pour des calculs vérifiables à la main.
const projet = (extra = {}, scenarios = []) => R.normaliserProjet({ nom: 'Citadine essence', prix: 2000000, duree: 36, kmAn: 12000, decote1: 20, decote2: 10, entretienAn: 60000, assuranceMois: 5000, placement: null, perteKm: 0, scenarios, ...extra });

test('saisie tolérante et affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('20000 €'), 2000000);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.lireMontant('1,234'), null);
  assert.equal(R.lirePrixKm('0,085'), 8.5);
  assert.equal(R.lirePrixKm('0.1 €/km'), 10);
  assert.equal(R.lireTaux('5,9 %'), 5.9);
  assert.equal(R.lireTaux('150'), null);
  assert.equal(R.lireEntier('15 000', 0, 200000), 15000);
  assert.equal(R.euros(123456), aff('1 234,56 €'));
  assert.equal(R.euros(123456, { centimes: false }), aff('1 235 €'));
  assert.equal(R.euros(-50000), aff('−500,00 €'));
  assert.equal(R.eurosKm(8.5), aff('0,085 €/km'));
  assert.equal(R.eurosKm(10), aff('0,10 €/km'));
  assert.equal(R.duree(48), '4 ans');
  assert.equal(R.duree(37), '3 ans et 1 mois');
  assert.equal(R.duree(9), '9 mois');
});

test('mensualité par la formule d\'annuité : cas connus', () => {
  // 20 000 € à 5 % sur 48 mois : 460,59 € par mois, 2 108,32 € d'intérêts (tableau d'amortissement classique).
  assert.equal(R.mensualite(2000000, 5, 48), 46059);
  assert.equal(R.coutInterets(2000000, 5, 48), 210832);
  // 10 000 € à 6 % sur 12 mois : 860,66 € par mois.
  assert.equal(R.mensualite(1000000, 6, 12), 86066);
  // Taux nul : capital / durée.
  assert.equal(R.mensualite(1000000, 0, 40), 25000);
  assert.equal(R.coutInterets(1000000, 0, 40), 0);
  assert.equal(R.mensualite(0, 5, 48), 0);
  // Capital restant dû : entier au départ, nul à la fin, environ la moitié du capital à mi-parcours (un peu plus).
  assert.equal(R.capitalRestant(2000000, 5, 48, 0), 2000000);
  assert.equal(R.capitalRestant(2000000, 5, 48, 48), 0);
  const mi = R.capitalRestant(2000000, 5, 48, 24);
  assert.ok(mi > 1000000 && mi < 1060000, String(mi));
  // Cohérence : capital + intérêts = somme des mensualités, à l'arrondi près.
  let c = 2000000, interets = 0;
  const r = 5 / 1200, m = (2000000 * r) / (1 - (1 + r) ** -48);
  for (let k = 0; k < 24; k++) { const i = c * r; interets += i; c -= m - i; }
  assert.ok(Math.abs(c - mi) <= 1);
});

test('valeur de revente estimée : décote paramétrable et ajustement kilométrique', () => {
  assert.equal(R.valeurEstimee(2000000, 0, 20, 10), 2000000);
  assert.equal(R.valeurEstimee(2000000, 6, 20, 10), 1800000); // moitié de la décote de première année
  assert.equal(R.valeurEstimee(2000000, 12, 20, 10), 1600000);
  assert.equal(R.valeurEstimee(2000000, 36, 20, 10), 1296000); // 20 000 × 0,8 × 0,9²
  // 5 c/km au-delà de 15 000 km/an : 20 000 km/an sur 36 mois = 15 000 km en trop = 750 €.
  assert.equal(R.valeurEstimee(2000000, 36, 20, 10, { kmAn: 20000, kmNormal: 15000, perteKm: 5 }), 1221000);
  // En deçà, la valeur remonte, sans dépasser le prix ; jamais négative.
  assert.equal(R.valeurEstimee(2000000, 36, 20, 10, { kmAn: 10000, kmNormal: 15000, perteKm: 5 }), 1371000);
  assert.equal(R.valeurEstimee(1000000, 12, 0, 0, { kmAn: 0, kmNormal: 15000, perteKm: 50 }), 1000000);
  assert.equal(R.valeurEstimee(1000000, 120, 50, 50, { kmAn: 60000, kmNormal: 15000, perteKm: 50 }), 0);
});

test('coût d\'opportunité et kilomètres dépassés', () => {
  assert.equal(R.coutOpportunite(1000000, 3, 12), 30000);
  assert.equal(R.coutOpportunite(1000000, 3, 24), 60900); // intérêts composés : 10 000 × (1,03² − 1)
  assert.equal(R.coutOpportunite(1000000, 0, 24), 0);
  assert.equal(R.kmDepasses(18000, 15000, 48), 12000);
  assert.equal(R.kmDepasses(12000, 15000, 48), 0);
  assert.equal(R.kmDepasses(18000, 0, 48), 0); // forfait non saisi : rien compté
});

test('comptant : coût total net, mensuel et au km', () => {
  const p = projet({}, [{ id: 'c', type: 'comptant', prix: 1900000, assuranceMois: 5000, fraisDossier: 20000 }]);
  const x = R.calculer(p, p.scenarios[0]);
  assert.ok(x.complet);
  assert.equal(x.depart, 1920000);
  assert.equal(x.assurances, 180000);
  assert.equal(x.entretiens, 180000);
  assert.equal(x.valeurFinale, 1296000); // sur le prix de la comparaison (20 000 €), pas le prix remisé
  assert.equal(x.decaissements, 1920000 + 180000 + 180000);
  assert.equal(x.net, 2280000 - 1296000);
  assert.equal(x.mensuel, Math.round(984000 / 36));
  assert.equal(Math.round(x.parKm * 10) / 10, Math.round((984000 / 36000) * 10) / 10);
  assert.equal(x.cumul.length, 37);
  assert.equal(x.cumul[0], 1920000);
  assert.equal(x.cumul[36], x.decaissements);
  // Avec un placement à 3 % : l'argent versé au départ aurait rapporté.
  const p2 = projet({ placement: 3 }, [{ id: 'c', type: 'comptant', prix: 1900000, assuranceMois: 5000, fraisDossier: 20000 }]);
  const y = R.calculer(p2, p2.scenarios[0]);
  assert.equal(y.opportunite, R.coutOpportunite(1920000, 3, 36));
  assert.equal(y.net, x.net + y.opportunite);
});

test('crédit : apport, mensualités, intérêts, capital restant dû quand le crédit dure plus longtemps', () => {
  const p = projet({}, [{ id: 'k', type: 'credit', apport: 400000, taux: 5, dureeCredit: 36, fraisDossier: 15000, assuranceMois: 5000 }]);
  const x = R.calculer(p, p.scenarios[0]);
  assert.equal(x.capital, 1600000);
  assert.equal(x.mensualite, R.mensualite(1600000, 5, 36));
  assert.equal(x.mensualite, 47953); // 16 000 € à 5 % sur 36 mois
  assert.equal(x.interets, 47953 * 36 - 1600000);
  assert.equal(x.paiements, 47953 * 36);
  assert.equal(x.restantDu, 0);
  assert.equal(x.net, 415000 + 47953 * 36 + 180000 + 180000 - 1296000);
  // Crédit sur 60 mois pour 36 mois de détention : le capital restant dû est remboursé à la revente.
  const p2 = projet({}, [{ id: 'k', type: 'credit', apport: 400000, taux: 5, dureeCredit: 60, assuranceMois: 5000 }]);
  const y = R.calculer(p2, p2.scenarios[0]);
  assert.equal(y.nbPaiements, 36);
  assert.equal(y.restantDu, R.capitalRestant(1600000, 5, 60, 36));
  assert.ok(y.restantDu > 0);
  assert.equal(y.decaissements, 400000 + y.mensualite * 36 + 180000 + 180000 + y.restantDu);
  assert.equal(y.cumul[36] - y.cumul[35], y.mensualite + 5000 + 5000 + y.restantDu);
  // Intérêts payés sur la période : mensualités + capital restant − capital emprunté.
  assert.equal(y.interetsPeriode, y.mensualite * 36 + y.restantDu - 1600000);
  assert.ok(R.alertes(p2, p2.scenarios[0]).some((a) => /capital restant/.test(a.texte)));
});

test('LOA : option levée ou non, kilomètres supplémentaires seulement à la restitution', () => {
  const base = { type: 'loa', premierLoyer: 300000, loyer: 25000, optionAchat: 1100000, kmForfait: 10000, prixKmSup: 8, assuranceMois: 5000, fraisRestitution: 30000 };
  const p = projet({}, [{ id: 'leve', ...base, leverOption: true }, { id: 'rend', ...base, leverOption: false }]);
  const [leve, rend] = p.scenarios.map((s) => R.calculer(p, s));
  // Premier loyer au départ puis 35 loyers sur 36 mois.
  assert.equal(leve.nbPaiements, 35);
  assert.equal(leve.paiements, 35 * 25000);
  // Option levée : on paie l'option, on garde la voiture (valeur estimée déduite), pas de pénalité km.
  assert.equal(leve.option, 1100000);
  assert.equal(leve.kmSup, 0);
  assert.equal(leve.valeurFinale, 1296000);
  assert.equal(leve.net, 300000 + 35 * 25000 + 180000 + 180000 + 1100000 - 1296000);
  // Option non levée : on rend la voiture, dépassement (12 000 − 10 000) × 3 ans = 6 000 km à 0,08 €.
  assert.equal(rend.option, 0);
  assert.equal(rend.valeurFinale, 0);
  assert.equal(rend.kmSup, 6000);
  assert.equal(rend.coutKmSup, 48000);
  assert.equal(rend.restitution, 30000);
  assert.equal(rend.net, 300000 + 35 * 25000 + 180000 + 180000 + 48000 + 30000);
  // Lever l'option vaut le coup ici : l'option (11 000 €) est sous la valeur estimée (12 960 €).
  assert.ok(leve.net < rend.net);
  // Option levée sans montant : scénario incomplet.
  const p2 = projet({}, [{ id: 'x', ...base, optionAchat: 0, leverOption: true }]);
  assert.deepEqual(simple(R.manques(p2, p2.scenarios[0])), ['le montant de l\'option d\'achat']);
});

test('LLD : forfait, dépassement, entretien inclus, frais de restitution', () => {
  const s = { id: 'l', type: 'lld', premierLoyer: 200000, loyer: 30000, kmForfait: 10000, prixKmSup: 10, entretienInclus: true, assuranceMois: 5000, fraisRestitution: 40000 };
  const p = projet({ kmAn: 15000 }, [s]);
  const x = R.calculer(p, p.scenarios[0]);
  assert.equal(x.entretiens, 0);
  assert.equal(x.kmSup, 15000); // 5 000 km/an × 3 ans
  assert.equal(x.coutKmSup, 150000);
  assert.equal(x.net, 200000 + 35 * 30000 + 180000 + 150000 + 40000);
  assert.equal(x.parKm, x.net / 45000);
  // Entretien non inclus : il s'ajoute.
  const p2 = projet({ kmAn: 15000 }, [{ ...s, entretienInclus: false }]);
  assert.equal(R.calculer(p2, p2.scenarios[0]).net, x.net + 180000);
  // Sous le forfait : pas de dépassement, alerte « forfait surdimensionné ».
  const p3 = projet({ kmAn: 6000 }, [s]);
  assert.equal(R.calculer(p3, p3.scenarios[0]).kmSup, 0);
  assert.ok(R.alertes(p3, p3.scenarios[0]).some((a) => /forfait plus bas/.test(a.texte)));
  assert.ok(R.alertes(p, p.scenarios[0]).some((a) => a.niveau === 'alerte' && /Dépassement/.test(a.texte)));
});

test('scénarios incomplets et classement', () => {
  const p = projet({}, [
    { id: 'c', type: 'comptant', assuranceMois: 5000 },
    { id: 'k', type: 'credit', apport: 0, dureeCredit: 36 }, // taux manquant
    { id: 'l', type: 'lld', loyer: 0 },
  ]);
  const c = R.comparer(p);
  assert.equal(c.complets.length, 1);
  assert.deepEqual(simple(c.incomplets.map((x) => x.id)), ['k', 'l']);
  assert.deepEqual(simple(R.manques(p, p.scenarios[1])), ['le taux']);
  assert.deepEqual(simple(R.manques(p, p.scenarios[2])), ['le loyer mensuel']);
  assert.equal(c.moinsCher.id, 'c');
  assert.equal(c.moinsCher.rang, 1);
  assert.equal(c.moinsCher.ecart, 0);
  const sans = projet({ prix: null }, [{ id: 'c', type: 'comptant' }]);
  assert.deepEqual(simple(R.manques(sans, sans.scenarios[0])), ['le prix']);
});

test('seuils kilométriques : là où la LLD cesse d\'être la moins chère', () => {
  const p = projet({}, [
    { id: 'c', type: 'comptant', assuranceMois: 5000 },
    { id: 'l', type: 'lld', premierLoyer: 0, loyer: 27000, kmForfait: 10000, prixKmSup: 10, entretienInclus: true, assuranceMois: 5000 },
  ]);
  // Comptant : 20 000 + 1 800 + 1 800 − 12 960 = 10 640 €, quel que soit le kilométrage (pas d'ajustement).
  // LLD : 35 × 270 + 1 800 = 11 250 € jusqu'à 10 000 km/an : plus chère dès le départ.
  assert.equal(R.calculer(p, p.scenarios[0]).net, 1064000);
  assert.equal(R.calculer(p, p.scenarios[1], { kmAn: 8000 }).net, 1125000);
  assert.deepEqual(simple(R.seuilsKm(p, 'c', 'l')), []);
  // Loyer de 240 € : LLD à 10 200 € sous le forfait, puis + 0,30 € par km/an au-delà (0,10 € × 3 ans).
  // Égalité : 10 200 + 0,3 × (k − 10 000) = 10 640 → k ≈ 11 467 km/an.
  p.scenarios[1].loyer = 24000;
  const s = R.seuilsKm(p, 'c', 'l');
  assert.equal(s.length, 1);
  assert.ok(Math.abs(s[0].km - 11467) <= 1, String(s[0].km));
  assert.equal(s[0].avant, 'l');
  assert.equal(s[0].apres, 'c');
  const plages = simple(R.plagesKm(p));
  assert.equal(plages.length, 2);
  assert.equal(plages[0].id, 'l');
  assert.equal(plages[0].de, 0);
  assert.equal(plages[1].id, 'c');
  assert.equal(plages[1].de, plages[0].a + 1);
  assert.equal(plages[1].de, s[0].km);
  // Au kilométrage actuel (12 000 km/an), le comptant est le moins cher ; la LLD le devient en dessous.
  const sm = simple(R.seuilsDuMoinsCher(p));
  assert.equal(sm.length, 1);
  assert.equal(sm[0].id, 'l');
  assert.equal(sm[0].sens, 'au-dessous');
});

test('normalisation tolérante, couleurs stables et scénario par défaut', () => {
  const v = R.normaliser(null);
  assert.deepEqual(simple(v), { version: 1, projets: [], actif: null });
  const d = R.normaliser({ projets: [{ nom: '', duree: 500, kmAn: -3, decote1: 'x', scenarios: [{ type: 'inconnu' }, { type: 'lld', couleur: 0, entretienInclus: 1 }, { type: 'comptant', entretienInclus: true }] }], actif: 'absent' }, BASE.defauts);
  const p = d.projets[0];
  assert.equal(p.nom, 'Ma voiture');
  assert.equal(p.duree, R.DUREE_MAX);
  assert.equal(p.kmAn, 0);
  assert.equal(p.decote1, BASE.defauts.decote1);
  assert.equal(d.actif, p.id);
  assert.equal(p.scenarios[0].type, 'comptant');
  assert.equal(p.scenarios[1].entretienInclus, true);
  assert.equal(p.scenarios[2].entretienInclus, false); // sans objet pour un achat
  // Couleurs : chaque scénario garde la sienne, sans doublon.
  const coul = p.scenarios.map((s) => s.couleur);
  assert.equal(new Set(coul).size, coul.length);
  const pp = projet({ kmAn: 13000 });
  const lld = R.scenarioDefaut(pp, 'lld', []);
  assert.equal(lld.kmForfait, 15000);
  assert.equal(lld.entretienInclus, true);
  assert.equal(R.scenarioDefaut(pp, 'credit', []).taux, null);
  assert.equal(R.scenarioDefaut(pp, 'loa', []).leverOption, true);
  assert.equal(R.normaliserScenario({ type: 'lld', leverOption: true }).leverOption, false);
  // Pas plus de 6 scénarios (une couleur chacun).
  const trop = R.normaliserProjet({ scenarios: Array.from({ length: 9 }, () => ({ type: 'comptant' })) });
  assert.equal(trop.scenarios.length, R.MAX_SCENARIOS);
});

test('export CSV : postes côte à côte', () => {
  const p = projet({}, [{ id: 'c', type: 'comptant', nom: 'Comptant', assuranceMois: 5000 }, { id: 'l', type: 'lld', nom: 'LLD', loyer: 0 }]);
  const csv = R.versCsv(p);
  assert.ok(csv.startsWith('﻿Poste;Comptant;LLD'));
  assert.ok(csv.includes('Coût total net;10640,00;à compléter'));
});

test('base intégrée : questions et types complets', () => {
  for (const t of [...R.TYPES.filter((x) => x !== 'comptant'), 'commun']) assert.ok(BASE.questions[t].length >= 4, t);
  const ids = Object.values(BASE.questions).flat().map((q) => q[0]);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of R.TYPES) assert.ok(BASE.types[t].nom);
  // Aucune marque ni donnée de marché : la base ne contient que des hypothèses modifiables.
  assert.equal(BASE.defauts.placement, null);
});
