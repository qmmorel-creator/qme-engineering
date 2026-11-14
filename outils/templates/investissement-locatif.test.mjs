// Tests des règles métier de « Rentabilité d'un investissement locatif » (templates/investissement-locatif/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/investissement-locatif/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RNT;
const BASE = ctx.window.BASE;
const aff = (s) => s.replace(/(\d) (?=\d)/g, '$1 ').replace(/ (€|%)/g, ' $1');

// Bien de référence, calculable à la main : 100 000 € comptant, 600 € de loyer, 1 mois de vacance.
const bien = (x = {}) => R.normaliserBien({
  nom: 'Test', location: 'nu', etat: 'ancien', prix: 10000000, notaireMode: 'saisi', notaireMontant: 800000,
  travaux: 1200000, lots: [{ libelle: 'Logement', loyer: 60000 }], vacance: 1, taxeFonciere: 90000, copro: 60000,
  pno: 15000, gestionPct: 0, entretien: 35000, financement: { mode: 'comptant' }, ...x,
}, 0, [], BASE.notaire);

test('saisie tolérante et affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.lireTaux('3,45 %'), 3.45);
  assert.equal(R.lireMois('1,5'), 1.5);
  assert.equal(R.lireMois('13'), null);
  assert.equal(R.lireEntier('25', 1, 35), 25);
  assert.equal(R.euros(123456), aff('1 234,56 €'));
  assert.equal(R.euros(-12000, { centimes: false, signe: true }), aff('− 120 €'));
  assert.equal(R.euros(12000, { centimes: false, signe: true }), aff('+ 120 €'));
  assert.equal(R.pct(5.678), aff('5,68 %'));
  assert.equal(R.duree(240), '20 ans');
});

test('coût total d\'acquisition : frais de notaire saisis ou estimés (hypothèse)', () => {
  const b = bien();
  const a = R.acquisition(b);
  assert.equal(a.notaire, 800000);
  assert.equal(a.total, 10000000 + 800000 + 1200000);
  const e = bien({ notaireMode: 'estime', notairePct: undefined });
  assert.equal(e.notairePct, BASE.notaire.ancien);
  assert.equal(R.fraisNotaire(e), 800000);
  const neuf = bien({ notaireMode: 'estime', etat: 'neuf', notairePct: undefined });
  assert.equal(R.fraisNotaire(neuf), 300000);
  const meuble = bien({ mobilier: 500000, fraisAgence: 400000, fraisBancaires: 100000, autresFrais: 50000 });
  assert.equal(R.acquisition(meuble).total, 12000000 + 500000 + 400000 + 100000 + 50000);
});

test('loyers : vacance en mois par an, colocation par chambre, saisonnier à la nuitée', () => {
  const r = R.revenus(bien());
  assert.equal(r.theorique, 720000);
  assert.equal(r.encaisse, 660000); // 11 mois
  assert.equal(r.vacance, 60000);
  assert.equal(R.revenus(bien({ vacance: 0.5 })).encaisse, 690000);
  const coloc = bien({ location: 'colocation', lots: [{ loyer: 45000 }, { loyer: 45000 }, { loyer: 50000 }], vacance: 0 });
  assert.equal(R.revenus(coloc).theorique, 140000 * 12);
  const sais = bien({ location: 'saisonnier', prixNuit: 8500, nuits: 150, vacance: 3 });
  assert.equal(R.revenus(sais).theorique, 1275000);
  assert.equal(R.revenus(sais).encaisse, 1275000); // la vacance ne s'applique pas : les nuits louées la comptent déjà
});

test('charges annuelles : gestion en % des loyers encaissés', () => {
  const c = R.charges(bien({ gestionPct: 7 }));
  assert.equal(c.gestion, Math.round(660000 * 0.07));
  assert.equal(c.total, 90000 + 60000 + 15000 + 35000 + c.gestion);
});

test('rendement brut, net de charges et cash-flow : cas calculé à la main (comptant)', () => {
  const x = R.analyser(bien());
  assert.ok(x.complet);
  // Brut : 7 200 / 100 000 = 7,2 %.
  assert.ok(Math.abs(x.rendementBrut - 7.2) < 1e-9);
  // Net : (6 600 − 2 000) / 120 000 = 3,8333 %.
  assert.equal(x.netAnnuel, 660000 - 200000);
  assert.ok(Math.abs(x.rendementNet - (4600 / 120000) * 100) < 1e-9);
  // Comptant : cash-flow = net, positif, aucun effort.
  assert.equal(x.cashflowAnnuel, 460000);
  assert.equal(x.cashflowMensuel, Math.round(460000 / 12));
  assert.equal(x.effortMensuel, 0);
  // Prix et loyer au m² à partir de la saisie seulement.
  assert.equal(R.analyser(bien({ surface: 40 })).prixM2, 250000);
  assert.equal(R.analyser(bien()).prixM2, null);
});

test('financement : mensualité et assurance (formules de la capacité d\'emprunt), cash-flow et effort d\'épargne', () => {
  // 200 000 € à 3,5 % sur 25 ans : 1 001,25 € (même cas que templates/emprunt).
  assert.equal(R.mensualite(20000000, 3.5, 300), 100125);
  assert.equal(R.assuranceMois(20000000, 0.3, 100), 5000);
  const b = bien({ financement: { mode: 'credit', apport: 1000000, taux: 3.5, dureeMois: 240, tauxAssurance: 0.3, quotite: 100 } });
  const x = R.analyser(b);
  assert.equal(x.credit.montant, 12000000 - 1000000); // coût total − apport
  assert.equal(x.credit.mensualite, R.mensualite(11000000, 3.5, 240));
  assert.equal(x.credit.assurance, 2750);
  assert.equal(x.cashflowAnnuel, 460000 - (x.credit.mensualite + 2750) * 12);
  assert.ok(x.cashflowMensuel < 0);
  assert.equal(x.effortMensuel, -x.cashflowMensuel);
  assert.ok(x.credit.capitalAn1 > 0 && x.credit.interetsAn1 > 0);
  assert.ok(Math.abs(x.credit.capitalAn1 + x.credit.interetsAn1 - x.credit.mensualite * 12) <= 1);
  // Montant saisi : prioritaire.
  const m = R.analyser(bien({ financement: { mode: 'credit', montant: 5000000, taux: 3, dureeMois: 240, tauxAssurance: 0 } }));
  assert.equal(m.credit.montant, 5000000);
  assert.equal(m.credit.apport, 7000000);
  // Assurance sur capital restant dû : moyenne de la première année, plus faible.
  const crd = R.analyser(bien({ financement: { mode: 'credit', apport: 1000000, taux: 3.5, dureeMois: 240, tauxAssurance: 0.3, assuranceMode: 'crd' } }));
  assert.ok(crd.credit.assurance < 2750 && crd.credit.assurance > 2650);
});

test('bien incomplet : rien n\'est inventé, ce qui manque est listé', () => {
  const x = R.analyser(bien({ taxeFonciere: null, lots: [{ loyer: 0 }], financement: { mode: 'credit', dureeMois: 240 } }));
  assert.equal(x.complet, false);
  assert.deepEqual([...x.manque], ['le loyer', 'la taxe foncière (0 si aucune)', 'le taux du crédit', 'le taux d\'assurance (0 si aucune)']);
  assert.equal(x.rendementNet, undefined);
  assert.equal(R.prixMax(bien({ taxeFonciere: null }), 5), null);
  assert.equal(R.sensibilite(bien({ taxeFonciere: null })), null);
});

test('prix maximal pour un rendement visé : le rendement visé est atteint à ce prix', () => {
  const b = bien({ notaireMode: 'estime', notairePct: 8, fraisAgence: 0 });
  const p = R.prixMax(b, 4, 'net');
  assert.ok(p.prix > 0);
  const x = R.analyser({ ...b, prix: p.prix });
  assert.ok(x.rendementNet >= 4 - 1e-9 && x.rendementNet < 4.01, String(x.rendementNet));
  const brut = R.prixMax(b, 8, 'brut');
  assert.equal(brut.prix, 9000000); // 7 200 / 8 %
  assert.equal(brut.atteint, false);
  assert.equal(R.prixMax(b, 3, 'brut').atteint, true);
  // Cible inatteignable : travaux supérieurs à ce que les loyers permettent.
  assert.equal(R.prixMax(bien({ travaux: 50000000 }), 6, 'net').impossible, true);
  assert.equal(R.prixMax(b, null), null);
});

test('sensibilité : loyer − 10 %, vacance + 1 mois, taux + 1 point, cumul', () => {
  const b = bien({ financement: { mode: 'credit', apport: 1000000, taux: 3.5, dureeMois: 240, tauxAssurance: 0.3 } });
  const s = R.sensibilite(b);
  assert.deepEqual([...s.map((x) => x.id)], ['base', 'loyer', 'vacance', 'taux', 'cumul']);
  assert.equal(s[0].ecartCashflow, 0);
  for (const x of s.slice(1)) assert.ok(x.cashflowMensuel < s[0].cashflowMensuel, x.id);
  // Vacance + 1 mois : un mois de loyer en moins sur l'année (gestion à 0 %).
  assert.equal(s[2].ecartCashflow, Math.round((R.analyser(b).cashflowAnnuel - 60000) / 12) - s[0].cashflowMensuel);
  // Le taux ne change pas le rendement net (hors crédit), seulement le cash-flow.
  assert.ok(Math.abs(s[3].ecartRendement) < 1e-9);
  assert.ok(s[4].cashflowMensuel < Math.min(s[1].cashflowMensuel, s[2].cashflowMensuel, s[3].cashflowMensuel));
  // Comptant : pas de scénario de taux.
  assert.deepEqual([...R.sensibilite(bien()).map((x) => x.id)], ['base', 'loyer', 'vacance', 'cumul']);
  // Saisonnier : 30 nuits de moins.
  const sais = bien({ location: 'saisonnier', prixNuit: 8000, nuits: 150 });
  assert.equal(R.varier(sais, { vacance: 1 }).nuits, 120);
  // Le bien d'origine n'est pas modifié.
  assert.equal(b.lots[0].loyer, 60000);
});

test('comparaison de plusieurs biens, normalisation tolérante, couleurs fixes, CSV', () => {
  const a = bien({ id: 'a' });
  const b2 = bien({ id: 'b', lots: [{ loyer: 80000 }] });
  const c = bien({ id: 'c', taxeFonciere: null });
  const cmp = R.comparer([a, b2, c]);
  assert.equal(cmp.complets.length, 2);
  assert.equal(cmp.incomplets.length, 1);
  assert.equal(cmp.meilleurNet.id, 'b');
  assert.equal(cmp.meilleurCash.id, 'b');
  const e = R.normaliser({ biens: Array.from({ length: 8 }, () => ({ prix: 'x', location: 'chateau', vacance: 40 })), cible: { taux: 'abc', type: 'zz' } }, BASE);
  assert.equal(e.biens.length, R.MAX_BIENS);
  assert.deepEqual([...e.biens.map((x) => x.couleur)], [0, 1, 2, 3, 4]);
  assert.equal(e.biens[0].location, 'nu');
  assert.equal(e.biens[0].vacance, 12);
  assert.equal(e.biens[0].prix, 0);
  assert.equal(e.biens[0].taxeFonciere, null);
  assert.equal(e.actif, e.biens[0].id);
  assert.equal(e.cible.taux, null);
  assert.equal(e.cible.type, 'net');
  assert.deepEqual(JSON.parse(JSON.stringify(R.normaliser(null))), JSON.parse(JSON.stringify(R.etatVide())));
  const csv = R.csvComparaison([bien({ nom: 'Studio ; test' }), c], BASE);
  assert.ok(csv.startsWith('﻿Avant impôt'));
  assert.match(csv, /"Studio ; test"/);
  assert.match(csv, /Rendement net de charges \(%\);3,83;à compléter/);
});

test('base intégrée : aucun taux de marché, prix au m², loyer de référence ni taux d\'impôt ; hypothèse de notaire datée', () => {
  const s = JSON.stringify(BASE);
  assert.equal(s.match(/prixM2|loyerReference|tauxMarche|tauxCredit|tauxImpot/), null);
  assert.match(BASE.notaire.texte, /Hypothèse/);
  assert.match(BASE.notaire.verifie, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(BASE.fiscalite, /ne sont pas calculés/);
  // Aucun montant proposé dans les postes types (libellé et aide seulement).
  for (const p of [...BASE.postesAcquisition, ...BASE.postesCharges]) assert.equal(p.length, 3);
  assert.equal(Object.keys(BASE.locations).join(','), R.LOCATIONS.join(','));
  // L'interface affiche l'avertissement et signale la fiscalité hors calcul.
  const app = readFileSync(new URL('app.js', dossier), 'utf8');
  assert.match(app, /ne remplace pas un conseil en investissement ni un conseil fiscal/);
  assert.match(app, /avant impôt/);
  assert.match(app, /qme-rnt-ecran-accueil/);
});
