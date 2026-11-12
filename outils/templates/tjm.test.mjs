// Tests des règles métier du calculateur de TJM (templates/tjm/calculs.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/tjm/', import.meta.url);
// Scripts de navigateur exécutés dans ce contexte (même realm : comparaisons profondes possibles).
globalThis.window = {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('calculs.js', dossier), 'utf8'));
const C = globalThis.window.TJM_CALCUL;
const TAUX = globalThis.window.BASE.taux;
const proche = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('taux 2026 de la fiche, ni plus ni moins', () => {
  assert.deepEqual({ ...TAUX.cotisations }, { bic: 21.2, bnc: 25.6, cipav: 23.2 });
  assert.deepEqual({ ...TAUX.vl }, { bic: 1.7, bnc: 2.2 });
  assert.deepEqual({ ...TAUX.cfp }, { commercant: 0.1, liberal: 0.2, artisan: 0.3 });
  assert.equal(TAUX.plafondServices, 83600);
  assert.equal(TAUX.tvaBase, 37500);
  assert.equal(TAUX.tvaMajore, 41250);
  assert.equal(TAUX.consulteLe, '12/11/2026');
});

test('Pâques : dates connues', () => {
  assert.equal(C.paques(2024), '2024-03-31');
  assert.equal(C.paques(2025), '2025-04-20');
  assert.equal(C.paques(2026), '2026-04-05');
  assert.equal(C.paques(2027), '2027-03-28');
  assert.equal(C.paques(2038), '2038-04-25');
  assert.equal(C.paques(2285), '2285-03-22');
});

test('fériés 2026 : 11 jours, dates mobiles calculées', () => {
  const f = C.feries(2026);
  assert.equal(f.length, 11);
  const dates = f.map((x) => x.date);
  assert.ok(dates.includes('2026-04-06')); // lundi de Pâques
  assert.ok(dates.includes('2026-05-14')); // Ascension = Pâques + 39
  assert.ok(dates.includes('2026-05-25')); // lundi de Pentecôte = Pâques + 50
  // 15 août 2026 tombe un samedi, 1er novembre un dimanche.
  assert.equal(f.find((x) => x.date === '2026-08-15').ouvre, false);
  assert.equal(f.find((x) => x.date === '2026-11-01').ouvre, false);
});

test('jours ouvrés 2026 et 2027 (vérifiés à la main)', () => {
  // 2026 commence un jeudi, 365 jours : 52 semaines + 1 jeudi = 261 jours de semaine.
  // Fériés en semaine : 1/1, 6/4, 1/5, 8/5, 14/5, 25/5, 14/7, 11/11, 25/12 = 9.  261 − 9 = 252.
  assert.deepEqual({ ...C.joursOuvres(2026) }, { semaine: 261, feriesOuvres: 9, ouvres: 252 });
  // 2027 commence un vendredi : 261 jours de semaine. Fériés en semaine : 1/1, 29/3, 6/5, 17/5, 14/7, 1/11, 11/11 = 7.
  assert.deepEqual({ ...C.joursOuvres(2027) }, { semaine: 261, feriesOuvres: 7, ouvres: 254 });
  // Année bissextile 2028 (commence un samedi) : 366 jours, 260 jours de semaine.
  assert.equal(C.joursOuvres(2028).semaine, 260);
});

test('jours facturables : soustraction, jamais négatif', () => {
  assert.equal(C.joursFacturables(2026, 25, 30), 197);
  assert.equal(C.joursFacturables(2026, 0, 0), 252);
  assert.equal(C.joursFacturables(2026, 200, 100), 0);
  assert.equal(C.joursFacturables(2026, -5, 'x'), 252);
});

test('taux micro selon le statut, la CFP et le versement libératoire', () => {
  assert.equal(C.tauxMicro('bic', TAUX, { activite: 'commercant' }).total, 21.3);
  assert.equal(C.tauxMicro('bic', TAUX, { activite: 'artisan', vl: true }).total, 23.2);
  assert.equal(C.tauxMicro('bnc', TAUX).total, 25.8);
  assert.equal(C.tauxMicro('bnc', TAUX, { vl: true }).total, 28);
  assert.equal(C.tauxMicro('cipav', TAUX, { vl: true }).total, 25.6);
  assert.equal(C.tauxMicro('societe', TAUX), null);
});

test('cas 1 vérifié à la main : micro BNC, 2 500 €/mois, 2 400 € de frais, 2026', () => {
  // Taux : 25,6 % + 0,2 % (CFP libéraux) = 25,8 %. CA = (30 000 + 2 400) / 0,742 = 43 665,77 €.
  // Jours : 252 − 25 − 30 = 197. TJM = 43 665,77 / 197 = 221,65 → 222 €. Marge 10 % : 243,82 → 244 €.
  const sc = { annee: 2026, conges: 25, nonFacturables: 30, objectif: { montant: 2500, periode: 'mois' },
    frais: [{ montant: 200, periode: 'mois' }], marge: 10, statut: 'bnc', vl: false };
  const r = C.calculer(sc, TAUX);
  assert.equal(r.jours, 197);
  proche(r.besoin.ca, 43665.77);
  proche(r.besoin.cotisations, 43665.77 * 0.256);
  assert.equal(r.tjm.minimum, 222);
  assert.equal(r.tjm.conseille, 244);
  assert.equal(r.tjm.caConseille, 244 * 197);
  // Net retrouvé : CA × (1 − 25,8 %) − frais = 30 000 €.
  proche(r.besoin.ca * (1 - 0.258) - 2400, 30000);
  // 43 665 € > 41 250 € : seuil majoré de TVA dépassé ; sous le plafond de 83 600 €.
  assert.deepEqual(r.alertesMinimum.map((a) => a.code), ['tva-majore']);
});

test('cas 2 vérifié à la main : micro BIC artisan avec versement libératoire, 2027', () => {
  // Taux : 21,2 % + 0,3 % + 1,7 % = 23,2 %. CA = (24 000 + 1 200) / 0,768 = 32 812,50 €.
  // Jours : 254 − 25 − 24 = 205. TJM = 160,06 → 161 €. 32 812 € < 33 750 € (90 % de 37 500 €) : aucune alerte.
  const sc = { annee: 2027, conges: 25, nonFacturables: 24, objectif: { montant: 24000, periode: 'an' },
    frais: [{ montant: 1200, periode: 'an' }], marge: 0, statut: 'bic', activite: 'artisan', vl: true };
  const r = C.calculer(sc, TAUX);
  assert.equal(r.jours, 205);
  proche(r.besoin.ca, 32812.5);
  proche(r.besoin.vl, 32812.5 * 0.017);
  assert.equal(r.tjm.minimum, 161);
  assert.equal(r.tjm.conseille, 161);
  assert.deepEqual(r.alertesMinimum, []);
});

test('société : taux saisi obligatoire, frais déduits avant charges', () => {
  const base = { netAnnuel: 42000, fraisAnnuels: 4000, statut: 'societe', taux: TAUX };
  assert.equal(C.caNecessaire({ ...base, tauxSociete: null }), null);
  assert.equal(C.caNecessaire({ ...base, tauxSociete: '' }), null);
  assert.equal(C.caNecessaire({ ...base, tauxSociete: 100 }), null);
  // 42 000 / 0,55 + 4 000 = 80 363,64 €.
  const r = C.caNecessaire({ ...base, tauxSociete: 45 });
  proche(r.ca, 80363.64);
  proche(r.charges, 34363.64);
  // Pas d'alerte de plafond micro pour une société, mais la TVA reste signalée.
  assert.deepEqual(C.alertes(r.ca, 'societe', TAUX).map((a) => a.code), ['tva-majore']);
});

test('alertes de plafond micro et de franchise de TVA', () => {
  assert.deepEqual(C.alertes(30000, 'bnc', TAUX), []);
  assert.deepEqual(C.alertes(36000, 'bnc', TAUX).map((a) => [a.code, a.niveau]), [['tva-base', 'proche']]);
  assert.deepEqual(C.alertes(39000, 'bnc', TAUX).map((a) => [a.code, a.niveau]), [['tva-base', 'depasse']]);
  assert.deepEqual(C.alertes(80000, 'bic', TAUX).map((a) => [a.code, a.niveau]), [['plafond', 'proche'], ['tva-majore', 'depasse']]);
  assert.deepEqual(C.alertes(90000, 'cipav', TAUX).map((a) => [a.code, a.niveau]), [['plafond', 'depasse'], ['tva-majore', 'depasse']]);
});

test('TJM : aucun jour facturable → pas de résultat ; courbe décroissante', () => {
  assert.equal(C.tjm(50000, 0, 10), null);
  const sc = { annee: 2026, conges: 25, nonFacturables: 30, objectif: { montant: 30000, periode: 'an' }, frais: [], marge: 0, statut: 'bnc' };
  const pts = C.courbe(sc, TAUX, 100, 200, 50);
  assert.deepEqual(pts.map((p) => p.jours), [100, 150, 200]);
  assert.ok(pts[0].tjm > pts[1].tjm && pts[1].tjm > pts[2].tjm);
  assert.deepEqual(C.courbe({ ...sc, statut: 'societe', tauxSociete: null }, TAUX), []);
});
