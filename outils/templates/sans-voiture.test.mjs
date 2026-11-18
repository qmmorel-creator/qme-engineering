// Tests des règles métier de « Vivre sans voiture » (templates/sans-voiture/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/sans-voiture/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.SVT;
const BASE = ctx.window.BASE;
const aff = (s) => s.replace(/(\d) (?=\d)/g, '$1 ').replace(/ (€|km|%)/g, ' $1');
const scen = (x = {}) => R.normaliserScenario(x, 0, [], BASE.defauts);
const commun = (x = {}) => ({ horizon: 5, temps: { minutes: 0, valeurHeure: 0, jours: 220 }, placement: 0, urgences: 0, ...x });

test('saisie tolérante et affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.lirePrixUnitaire('1,859'), 185.9);
  assert.equal(R.lirePrixUnitaire('0,12 €/km'), 12);
  assert.equal(R.lireTaux('30 %'), 30);
  assert.equal(R.lireDecimal('6,5'), 6.5);
  assert.equal(R.lireEntier('-30', -240, 240), -30);
  assert.equal(R.euros(123456), aff('1 235 €'));
  assert.equal(R.euros(-50000), aff('−500 €'));
  assert.equal(R.euros(50000, { signe: true }), '+\u00a0500\u00a0€');
  assert.equal(R.duree(0), 'tout de suite');
  assert.equal(R.duree(17), '1 an et 5 mois');
});

test('aucune donnée de marché ni nom propre dans la base', () => {
  const t = JSON.stringify(BASE).toLowerCase();
  for (const mot of ['sncf', 'ratp', 'uber', 'getaround', 'hertz', 'europcar', 'renault', 'peugeot', 'tesla', 'paris', 'lyon', 'marseille', 'citiz', 'blablacar']) assert.ok(!t.includes(mot), mot);
  assert.equal(BASE.urgences.length, 14);
  assert.equal(BASE.quotidien.length, 20);
});

// Voiture d'exemple achetée : 8 000 € de valeur, 12 %/an ; carburant 10 000 km × 6 L × 1,80 € / 100.
// 960 + 600 + 500 + 40 + 1 080 + 100 + 100 = 3 380 € par an.
test('coût annuel de la voiture : achetée, carburant au km ou en euros', () => {
  const s = scen();
  const c = R.coutVoiture(s.voiture);
  assert.equal(R.carburantAn(s.voiture), 108000);
  assert.equal(c.postes.find((p) => p[0] === 'perte')[2], 96000);
  assert.equal(c.total, 338000);
  const e = scen({ voiture: { carburantMode: 'euros', carburantAn: 100000 } });
  assert.equal(R.coutVoiture(e.voiture).total, 330000);
});

test('crédit : intérêts seulement, taux implicite des mensualités', () => {
  // 10 000 € à 5 % sur 48 mois : 230,29 € par mois (formule d'annuité).
  assert.equal(Math.round(R.mensualite(1000000, 5, 48)), 23029);
  assert.ok(Math.abs(R.tauxImplicite(1000000, 23029, 48) - 5) < 0.01);
  assert.equal(R.tauxImplicite(1000000, 20000, 48), null); // rembourse moins que le capital
  const i = R.interetsSur(1000000, 5, 48, 12);
  assert.ok(i > 42000 && i < 45000, String(i)); // ≈ 436 € la première année
  const s = scen({ voiture: { detention: 'credit', capitalRestant: 1000000, mensualite: 23029, moisRestants: 48 } });
  const c = R.coutVoiture(s.voiture);
  assert.ok(c.postes.some((p) => p[0] === 'interets' && p[2] > 42000));
  assert.ok(!c.postes.some((p) => p[0] === 'loyers'));
  assert.equal(Math.round(R.capitalApres(s.voiture, 48)), 0);
});

// Sans voiture, exemple : location 6 × 60 + 1 × 300 + 13 jours × 15 de franchise = 855 € ;
// carburant des locations 2 000 km × 0,12 = 240 € ; 4 taxis × 25 = 100 €. Total 1 195 €.
test('coût sans voiture, part employeur et dépenses déjà présentes', () => {
  const s = scen();
  const c = R.coutSansVoiture(s.remplacement);
  assert.equal(c.joursLoues, 13);
  assert.equal(c.postes.find((p) => p[0] === 'location')[2], 85500);
  assert.equal(c.total, 119500);
  const t = scen({ remplacement: { ...BASE.defauts.remplacement, transports: { abonnes: 2, prixAbonnement: 5000, partEmployeur: 50, deja: 20000 } } });
  // 2 × 50 € × 12 × 50 % = 600 €, moins 200 € déjà payés aujourd'hui.
  assert.equal(R.coutSansVoiture(t.remplacement).postes.find((p) => p[0] === 'transports')[2], 40000);
  const v = scen({ remplacement: { ...BASE.defauts.remplacement, velo: { achat: 200000, aides: 40000, dureeAns: 8, entretien: 10000, assurance: 5000 } } });
  assert.equal(R.coutSansVoiture(v.remplacement).postes.find((p) => p[0] === 'velo')[2], 35000); // 1 600/8 + 100 + 50
  assert.equal(R.coutSansVoiture(s.remplacement, { urgences: 5000 }).total, 124500);
});

test('gain annuel, coût de sortie, cumul et temps', () => {
  const s = scen();
  const x = R.calculer(s, commun());
  assert.equal(x.gainAn, 218500);
  assert.equal(x.sortie.cout, 40000); // remise de 5 % sur 8 000 €
  assert.equal(x.cumul[0], -40000);
  assert.equal(x.cumul[12], 178500);
  assert.equal(x.cumulFin, -40000 + 218500 * 5);
  assert.equal(x.amorti, 3); // 400 € / (2 185 / 12) = 2,2 → 3 mois
  // 20 minutes de plus par jour ouvré à 10 € l'heure sur 220 jours : 733,33 €.
  const t = R.calculer(s, commun({ temps: { minutes: 20, valeurHeure: 1000, jours: 220 } }));
  assert.equal(t.temps, 73333);
  assert.equal(t.gainAn, 218500 - 73333);
  // Placement à 3 % de la vente nette (8 000 − 400) : 228 € par an.
  assert.equal(R.calculer(s, commun({ placement: 3 })).placement, 22800);
});

test('gain négatif : garder la voiture coûte moins cher', () => {
  const s = scen({ remplacement: { ...BASE.defauts.remplacement, joursLocation: 60, semainesLocation: 4 } });
  const x = R.calculer(s, commun());
  assert.ok(x.gainAn < 0);
  assert.equal(x.amorti, null);
  assert.ok(x.cumulFin < x.cumul[0]);
});

test('sortie différée : gain nul avant la sortie (LLD jusqu\'à la fin du contrat)', () => {
  const s = scen({ voiture: { detention: 'lld', loyer: 40000, lld: { duree: 36, loyersPayes: 12 } }, sortie: { mode: 'fin-contrat', remiseEnEtat: 30000 } });
  const x = R.calculer(s, commun());
  assert.equal(x.sortie.mois, 24);
  assert.ok(x.cumul.slice(0, 24).every((v) => v === 0));
  assert.equal(x.cumul[24], -30000);
  // Restitution anticipée maintenant : 50 % des 24 loyers restants = 4 800 €.
  const a = scen({ voiture: { detention: 'lld', loyer: 40000, lld: { duree: 36, loyersPayes: 12 } }, sortie: { mode: 'restitution-anticipee', indemniteMode: 'pct', indemnitePct: 50, delai: 0 } });
  assert.equal(R.sortie(a.voiture, a.sortie).cout, 480000);
});

test('LOA : rachat au barème, revente et taux implicite', () => {
  const loa = { duree: 48, loyersPayes: 7, premierRachat: 12, unite: 'montant', bareme: [{ loyer: 12, valeur: 1500000 }, { loyer: 24, valeur: 1200000 }, { loyer: 36, valeur: 900000 }] };
  assert.equal(R.rachatAuBareme(loa, 12), 1500000);
  assert.equal(R.rachatAuBareme(loa, 18), 1350000); // interpolation linéaire
  assert.equal(R.rachatAuBareme(loa, 40), 900000);
  assert.equal(R.rachatAuBareme({ unite: 'pct', prixVehicule: 2000000, bareme: [{ loyer: 12, valeur: 75 }] }, 12), 1500000);
  const s = scen({ voiture: { detention: 'loa', valeur: 1600000, depreciation: 15, loyer: 30000, loa }, sortie: { mode: 'rachat-revente', loyerSortie: 10, canal: 'professionnel', ecartPro: 10 } });
  const so = R.sortie(s.voiture, s.sortie);
  // Pas de rachat avant le loyer 12 : sortie dans 5 mois.
  assert.equal(so.mois, 5);
  const valeur = Math.round(1600000 * 0.85 ** (5 / 12));
  const vente = Math.round(valeur * 0.9);
  assert.equal(so.cout, 1500000 - vente);
  const x = R.calculer(s, commun());
  assert.ok(x.cumul.slice(0, 5).every((v) => v === 0));
  // Prix 20 000 €, option 8 000 € après 47 loyers : loyers d'un prêt à 4 % avec ce solde final.
  const r = 4 / 1200, n = 47;
  const loyer = Math.round(((2000000 - 800000 / (1 + r) ** n) * r) / (1 - (1 + r) ** -n));
  const am = R.amortissementLoa({ prixVehicule: 2000000, premierLoyer: 0, loyer, duree: 48, option: 800000 });
  assert.ok(Math.abs(am.taux - 4) < 0.02, String(am.taux));
  assert.equal(am.lignes.length, 47);
  assert.ok(Math.abs(am.lignes[46].reste - 800000) < 50);
  const best = R.meilleureSortie(s, commun());
  assert.ok(best.meilleure && best.essais.length > 3);
  assert.ok(best.essais.every((e, i, t) => i === 0 || t[i - 1].cumulFin >= e.cumulFin));
});

test('sensibilité : location + 30 % et jours de location en plus', () => {
  const s = scen();
  const z = R.sensibilite(s, commun());
  assert.equal(z.gainAn, 218500);
  // Location (hors carburant) 855 € × 1,3 = 1 111,50 € : gain 2 185 − 256,50 = 1 928,50 €.
  assert.equal(z.gainAnPlus30, 218500 - 25650);
  // Coût d'un jour : 60 + 15 + 240/13 = 93,46 € → 2 185 / 93,46 = 23 jours.
  assert.equal(z.joursEnPlus, 23);
});

test('score de faisabilité et verdict bloquant', () => {
  const Q = BASE.faisabilite;
  const f = R.faisabilite(Q, { travail: 'oui', arret: 'non', accord: 'oui' }, { enfants: [], velo: 'aucun' });
  assert.equal(f.score, Math.round((25 / 35) * 100));
  assert.equal(f.verdict, 'favorable');
  const b = R.faisabilite(Q, { travail: 'non', arret: 'oui' }, { enfants: [], velo: 'aucun' });
  assert.equal(b.verdict, 'bloquant');
  // Avec un enfant, l'école devient une question bloquante ; sans réponse, elle est « à régler ».
  const e = R.faisabilite(Q, { travail: 'oui' }, { enfants: [4], velo: 'aucun' });
  assert.ok(e.aRegler.some((q) => q.id === 'ecole'));
  assert.equal(R.faisabilite(Q, {}, {}).verdict, 'inconnu');
});

test('urgences ouvertes : applicables, non couvertes, les plus graves d\'abord', () => {
  const sansEnfant = R.urgencesOuvertes(BASE.urgences, {}, { enfants: [], velo: 'aucun', contrat: false });
  assert.ok(!sansEnfant.some((u) => u.id === 'malade'));
  assert.equal(sansEnfant[0].gravite, 'bloquant');
  const avec = R.urgencesOuvertes(BASE.urgences, { nuit: { statut: 'couvert' } }, { enfants: [4], velo: 'electrique', contrat: true });
  assert.ok(!avec.some((u) => u.id === 'nuit'));
  assert.equal(avec.slice(0, 2).map((u) => u.id).join(','), 'malade,contrat');
  assert.equal(R.coutUrgences({ nuit: { cout: 5000 }, malade: { cout: 2000 }, x: null }), 7000);
});

test('phase de test : dépenses ramenées à l\'année', () => {
  const b = R.bilanTest({ debut: '2026-01-01', duree: 2, journal: [{ montant: 10000 }, { montant: 5000 }] }, 100000, new Date('2026-01-30T12:00:00'));
  assert.equal(b.jours, 30);
  assert.equal(b.parAn, Math.round((15000 / 30) * 365));
  assert.equal(b.termine, false);
  assert.equal(R.bilanTest({ debut: '' }, 0), null);
});

test('normalisation d\'un état ancien ou incomplet', () => {
  const e = R.normaliser({ tutorielVu: true, scenarios: [{ voiture: { detention: 'inconnu', valeur: -5 } }, {}], reponses: { travail: 'peut-être', ecole: 'oui' }, horizon: 99, urgences: { nuit: { statut: 'x', cout: '12' } } }, BASE.defauts);
  assert.equal(e.tutorielVu, true);
  assert.equal(e.scenarios.length, 2);
  assert.equal(e.scenarios[0].voiture.detention, 'achat');
  assert.equal(e.scenarios[0].voiture.valeur, 800000); // valeur illisible → exemple
  assert.notEqual(e.scenarios[0].couleur, e.scenarios[1].couleur);
  assert.equal(JSON.stringify(e.reponses), '{"ecole":"oui"}');
  assert.equal(e.horizon, 15);
  assert.equal(e.urgences.nuit.statut, 'a-prevoir');
  assert.equal(e.urgences.nuit.cout, 12);
  assert.equal(e.actif, e.scenarios[0].id);
  assert.equal(R.normaliser(null).scenarios.length, 0);
  // Sortie incompatible avec le mode de détention : ramenée au premier mode possible.
  assert.equal(R.normaliserScenario({ voiture: { detention: 'lld' }, sortie: { mode: 'vente' } }).sortie.mode, 'restitution-anticipee');
});

test('export CSV', () => {
  const E = R.normaliser({ scenarios: [{ nom: 'Vendre maintenant' }] }, BASE.defauts);
  const csv = R.versCsv(E);
  assert.ok(csv.startsWith('﻿Scénario;Vendre maintenant'));
  assert.ok(csv.includes('Gain annuel (€);2185,00'));
});
