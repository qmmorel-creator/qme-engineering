// Tests des règles métier de « Capacité d'emprunt et comparateur de prêts » (templates/emprunt/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/emprunt/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CPT;
const BASE = ctx.window.BASE;
const aff = (s) => s.replace(/(\d) (?=\d)/g, '$1 ').replace(/ (€|%)/g, ' $1');
const offre = (x = {}) => R.normaliserOffre({ montant: 20000000, taux: 3.5, dureeMois: 300, tauxAssurance: 0.3, assuranceMode: 'initial', quotite: 100, ...x });

test('saisie tolérante et affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('220000 €'), 22000000);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.lireTaux('3,45 %'), 3.45);
  assert.equal(R.lireTaux('0,125'), 0.125);
  assert.equal(R.lireTaux('101'), null);
  assert.equal(R.lireEntier('25', 1, 35), 25);
  assert.equal(R.lireEntier('40', 1, 35), null);
  assert.equal(R.euros(123456), aff('1 234,56 €'));
  assert.equal(R.euros(123456, { centimes: false }), aff('1 235 €'));
  assert.equal(R.pct(3.45), aff('3,45 %'));
  assert.equal(R.duree(300), '25 ans');
  assert.equal(R.duree(266), '22 ans et 2 mois');
});

test('mensualité, capital restant dû et capital empruntable : cas connus', () => {
  // 200 000 € à 3,5 % sur 25 ans : 1 001,25 € par mois (formule d'annuité).
  assert.equal(R.mensualite(20000000, 3.5, 300), 100125);
  // Même formule que le simulateur leasing : 20 000 € à 5 % sur 48 mois = 460,59 €.
  assert.equal(R.mensualite(2000000, 5, 48), 46059);
  assert.equal(R.mensualite(1200000, 0, 120), 10000);
  assert.equal(R.capitalRestant(20000000, 3.5, 300, 0), 20000000);
  assert.equal(R.capitalRestant(20000000, 3.5, 300, 300), 0);
  // Capital pour une mensualité : réciproque de la mensualité (à l'euro près, arrondi inférieur).
  const c = R.capitalPour(100125, 3.5, 300);
  assert.ok(c <= 20000000 && c > 19999000, String(c));
  // Avec assurance sur capital initial : mensualité + assurance tiennent dans le budget.
  const c2 = R.capitalPour(150000, 3.4, 300, 0.3, 100);
  assert.ok(R.mensualite(c2, 3.4, 300) + R.assuranceMois(c2, 0.3, 100) <= 150000);
  assert.ok(R.mensualite(c2 + 10000, 3.4, 300) + R.assuranceMois(c2 + 10000, 0.3, 100) > 150000 - 100);
  // Assurance : 0,30 % de 200 000 € par an = 50 € par mois ; quotité 200 % = 100 €.
  assert.equal(R.assuranceMois(20000000, 0.3, 100), 5000);
  assert.equal(R.assuranceMois(20000000, 0.3, 200), 10000);
  assert.equal(R.assuranceMois(20000000, 0, 100), 0);
});

test('échéancier : capital soldé, intérêts cohérents, assurance initiale ou sur capital restant dû', () => {
  const o = offre();
  const e = R.echeancier(o);
  assert.equal(e.lignes.length, 300);
  assert.equal(e.lignes.at(-1).crd, 0);
  assert.equal(e.lignes.reduce((s, l) => s + l.capital, 0), 20000000);
  // Intérêts totaux ≈ mensualités − capital (écart d'arrondi faible).
  assert.ok(Math.abs(e.totaux.interets - (100125 * 300 - 20000000)) < 300, String(e.totaux.interets));
  // Premier mois : 200 000 € × 3,5 % / 12 = 583,33 € d'intérêts.
  assert.equal(e.lignes[0].interets, 58333);
  assert.equal(e.totaux.assurance, 5000 * 300);
  const crd = R.echeancier(offre({ assuranceMode: 'crd' }));
  assert.equal(crd.lignes[0].assurance, 5000);
  assert.ok(crd.lignes[200].assurance < 5000);
  assert.ok(crd.totaux.assurance < e.totaux.assurance);
  const an = R.parAnnee(e.lignes);
  assert.equal(an.length, 25);
  assert.equal(an[24].crd, 0);
  assert.ok(an[0].interets > an[24].interets);
});

test('coût total, TAEG approché et comparaison', () => {
  const a = offre({ id: 'a', fraisDossier: 100000, garantie: 250000 });
  const x = R.calculerOffre(a);
  assert.ok(x.complet);
  assert.equal(x.mensualiteHors, 100125);
  assert.equal(x.mensualiteTotale, 105125);
  assert.equal(x.coutTotal, x.interets + x.assurance + 350000);
  // TAEG > taux nominal (assurance et frais), mais proche.
  assert.ok(x.taeg > 3.5 && x.taeg < 4.5, String(x.taeg));
  // Sans frais ni assurance, TAEG = taux actuariel du nominal : (1 + 3,5 %/12)^12 − 1 ≈ 3,557 %.
  const nu = R.calculerOffre(offre({ tauxAssurance: 0 }));
  assert.ok(Math.abs(nu.taeg - 3.557) < 0.01, String(nu.taeg));
  // Offre incomplète : listée avec ce qui manque.
  const inc = R.calculerOffre(offre({ taux: null }));
  assert.equal(inc.complet, false);
  assert.deepEqual([...inc.manque], ['le taux']);
  const b = offre({ id: 'b', taux: 3.2 });
  const c = offre({ id: 'c', dureeMois: 240 });
  const cmp = R.comparer([a, b, c, offre({ id: 'd', tauxAssurance: null })]);
  assert.equal(cmp.complets.length, 3);
  assert.equal(cmp.incomplets.length, 1);
  assert.equal(cmp.moinsCher.id, 'c'); // plus courte : moins d'intérêts
  assert.equal(cmp.memesConditions, false);
  assert.equal(cmp.complets[0].ecart, 0);
});

test('capacité d\'emprunt : taux d\'effort saisi, crédits en cours, loyers pondérés', () => {
  const p = R.normaliserProfil({ emprunteurs: [{ revenus: 260000 }, { revenus: 210000 }], credits: [{ mensualite: 18000 }], tauxSimulation: 3.5, dureeSimulation: 300, assuranceSimulation: 0.3, tauxEffortMax: 35 }, BASE.hcsf);
  const c = R.capacite(p);
  assert.equal(c.revenus, 470000);
  assert.equal(c.mensualiteMax, 164500 - 18000);
  assert.ok(c.complet);
  assert.ok(c.mensualiteTotale <= c.mensualiteMax);
  assert.ok(Math.abs(c.effortActuel - (18000 / 470000) * 100) < 1e-9);
  // Loyers retenus à 70 %.
  const l = R.normaliserProfil({ emprunteurs: [{ revenus: 200000 }], loyers: 100000, ponderationLoyers: 70 }, BASE.hcsf);
  assert.equal(R.revenus(l), 270000);
  // Seuil modifiable : 33 % au lieu de 35 %.
  const p2 = R.normaliserProfil({ ...p, tauxEffortMax: 33 }, BASE.hcsf);
  assert.ok(R.capacite(p2).mensualiteMax < c.mensualiteMax);
  // Sans taux saisi : pas de montant inventé.
  const p3 = R.normaliserProfil({ emprunteurs: [{ revenus: 300000 }] }, BASE.hcsf);
  assert.equal(R.capacite(p3).complet, false);
  assert.equal(R.capacite(p3).capital, null);
  // Charges déjà au-delà du seuil.
  const p4 = R.normaliserProfil({ emprunteurs: [{ revenus: 200000 }], credits: [{ mensualite: 80000 }], tauxSimulation: 3 }, BASE.hcsf);
  assert.equal(R.capacite(p4).mensualiteMax, 0);
  assert.ok(R.capacite(p4).depasseDejaMax);
  // Par durée : plus long = plus empruntable au même taux.
  const d = R.capaciteParDuree(p, [15, 20, 25]);
  assert.ok(d[0].capital < d[1].capital && d[1].capital < d[2].capital);
  // Taux d'effort d'une offre et alertes de seuil.
  const o = offre({ montant: 30000000 });
  const x = R.calculerOffre(o, p);
  assert.ok(x.effort > 35);
  assert.ok(R.alertes(o, x, p).some((a) => a.niveau === 'alerte'));
  const longue = offre({ dureeMois: 360 });
  assert.ok(R.alertes(longue, R.calculerOffre(longue, p), p).some((a) => /seuil de 25 ans/.test(a.texte)));
});

test('budget du projet : frais de notaire estimés (hypothèse) ou saisis, besoin de financement', () => {
  const pr = R.normaliserProjet({ type: 'ancien', prix: 20000000, travaux: 1000000, autresFrais: 200000, apport: 2500000 }, BASE.notaire);
  assert.equal(pr.notairePct, BASE.notaire.ancien);
  const b = R.budget(pr);
  assert.equal(b.notaire, 1600000);
  assert.equal(b.total, 20000000 + 1600000 + 1000000 + 200000);
  assert.equal(b.besoin, b.total - 2500000);
  assert.equal(b.apportCouvreFrais, true);
  const neuf = R.normaliserProjet({ type: 'neuf', prix: 20000000 }, BASE.notaire);
  assert.equal(R.fraisNotaire(neuf), 600000);
  const saisi = R.normaliserProjet({ type: 'ancien', prix: 20000000, notaireMode: 'saisi', notaireMontant: 1512300 }, BASE.notaire);
  assert.equal(R.budget(saisi).notaire, 1512300);
  const riche = R.budget(R.normaliserProjet({ prix: 10000000, apport: 20000000 }, BASE.notaire));
  assert.equal(riche.besoin, 0);
  assert.ok(riche.excedentApport > 0);
});

test('remboursement anticipé : durée raccourcie ou mensualité baissée, indemnités plafonnées', () => {
  const o = offre({ id: 'a' });
  const d = R.remboursementAnticipe(o, { mois: 60, montant: 2000000, mode: 'duree', ira: { mode: 'plafond', moisInterets: 6, pctCrd: 3 } });
  assert.ok(d.valide);
  assert.ok(d.moisGagnes > 0);
  assert.equal(d.apres.lignes.at(-1).crd, 0);
  assert.equal(d.apres.lignes[59].anticipe, 2000000);
  // Plafond : min(6 mois d'intérêts sur 20 000 € à 3,5 % = 350 €, 3 % du capital restant dû) = 350 €.
  assert.equal(d.ira, 35000);
  assert.ok(d.ecoInterets > 0);
  assert.equal(d.gainNet, d.ecoInterets + d.ecoAssurance - d.ira);
  // Mensualité baissée, même durée.
  const m = R.remboursementAnticipe(o, { mois: 60, montant: 2000000, mode: 'mensualite', ira: { mode: 'aucune' } });
  assert.equal(m.apres.dureeMois, 300);
  assert.ok(m.nouvelleMensualite < 100125);
  assert.equal(m.ira, 0);
  assert.ok(d.ecoInterets > m.ecoInterets); // raccourcir la durée économise plus d'intérêts
  // 3 % du capital restant dû quand il est plus faible.
  assert.equal(R.indemnites(offre({ taux: 10 }), 10000000, 10000000, { mode: 'plafond', moisInterets: 6, pctCrd: 3 }), 300000);
  assert.equal(R.indemnites(o, 1000000, 5000000, { mode: 'saisi', montant: 12345 }), 12345);
  // Montant supérieur au capital restant dû : prêt soldé.
  const s = R.remboursementAnticipe(o, { mois: 280, montant: 99999999, mode: 'duree', ira: { mode: 'aucune' } });
  assert.ok(s.solde);
  assert.equal(s.apres.dureeMois, 280);
  // Mois hors bornes : non valide.
  assert.equal(R.remboursementAnticipe(o, { mois: 300, montant: 1000, mode: 'duree' }).valide, false);
});

test('normalisation tolérante, couleurs fixes, export CSV', () => {
  const e = R.normaliser({ profil: { emprunteurs: [{ revenus: 'x' }, {}, {}] }, projet: { type: 'chateau', prix: -3 }, offres: Array.from({ length: 8 }, () => ({ taux: 'abc' })), anticipe: { mois: 9999 } }, BASE);
  assert.equal(e.profil.emprunteurs.length, R.MAX_EMPRUNTEURS);
  assert.equal(e.profil.tauxEffortMax, BASE.hcsf.tauxEffort);
  assert.equal(e.profil.dureeMaxAns, BASE.hcsf.dureeAns);
  assert.equal(e.projet.type, 'ancien');
  assert.equal(e.projet.prix, 0);
  assert.equal(e.offres.length, R.MAX_OFFRES);
  assert.deepEqual([...e.offres.map((o) => o.couleur)], [0, 1, 2, 3, 4]);
  assert.equal(e.offres[0].taux, null);
  assert.equal(e.anticipe.offreId, e.offres[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(R.normaliser(null))), JSON.parse(JSON.stringify(R.etatVide())));
  const o = offre({ id: 'a', nom: 'Banque ; test' });
  const csv = R.csvEcheancier(o, R.echeancier(o));
  assert.ok(csv.startsWith('﻿Mois;'));
  assert.equal(csv.split('\r\n').length, 1 + 300 + 3);
  assert.match(csv, /"Banque ; test/);
  const cc = R.csvComparaison([o, offre({ id: 'b', taux: null })], null);
  assert.match(cc, /Coût total du crédit;[\d,]+;à compléter/);
});

test('base intégrée : aucun taux de marché, seuils sourcés et datés', () => {
  assert.equal(BASE.defauts.tauxAssurance, null);
  assert.equal(BASE.hcsf.tauxEffort, 35);
  assert.equal(BASE.hcsf.dureeAns, 25);
  assert.match(BASE.hcsf.verifie, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(BASE.hcsf.url, /^https:\/\/www\.economie\.gouv\.fr\//);
  assert.match(BASE.ira.texte, /R313-25/);
  assert.match(BASE.ira.verifie, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(BASE.notaire.texte, /Hypothèse/);
  // Aucune clé de taux de crédit dans la base.
  assert.equal(JSON.stringify(BASE).match(/tauxCredit|tauxMarche/), null);
  assert.equal(R.COULEURS.length, R.MAX_OFFRES);
});
