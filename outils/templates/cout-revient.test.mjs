// Tests des règles métier du template « Coût de revient et prix par client » (templates/cout-revient/calculs.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../templates/cout-revient/calculs.js', import.meta.url), 'utf8');
const contexte = {};
vm.runInNewContext(source, contexte);
const C = contexte.CALCULS;
// Les tableaux viennent d'un autre contexte vm : on les recopie avant deepEqual.
const ici = (v) => JSON.parse(JSON.stringify(v));
const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('dimanche de Pâques : dates connues, extrêmes compris', () => {
  const connues = { 1818: '1818-03-22', 1943: '1943-04-25', 2000: '2000-04-23', 2019: '2019-04-21', 2024: '2024-03-31',
    2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2038: '2038-04-25', 2285: '2285-03-22' };
  for (const [a, d] of Object.entries(connues)) assert.equal(C.paques(Number(a)), d, `Pâques ${a}`);
});

test('jours fériés 2026 : les 11 jours, fêtes mobiles calculées', () => {
  const f = C.joursFeries(2026);
  assert.equal(f.length, 11);
  assert.deepEqual(ici(f.map((x) => x.date)), ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25',
    '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']);
  assert.equal(f.find((x) => x.nom === 'Ascension').date, '2026-05-14');
});

test('jours fériés Alsace-Moselle : vendredi saint et 26 décembre en plus', () => {
  const f = C.joursFeries(2027, { alsaceMoselle: true });
  assert.equal(f.length, 13);
  assert.ok(f.some((x) => x.date === '2027-03-26' && x.nom === 'Vendredi saint'));
  assert.ok(f.some((x) => x.date === '2027-12-26'));
});

test('jours ouvrés : du lundi au vendredi hors fériés, contrôlés par un décompte indépendant', () => {
  for (const annee of [2024, 2025, 2026, 2027, 2028]) {
    const feries = new Set(C.joursFeries(annee).map((f) => f.date));
    let attendu = 0;
    for (let d = new Date(annee, 0, 1); d.getFullYear() === annee; d.setDate(d.getDate() + 1)) {
      if (d.getDay() >= 1 && d.getDay() <= 5 && !feries.has(C.iso(d))) attendu++;
    }
    const o = C.joursOuvres(annee);
    assert.equal(o.ouvres, attendu, `année ${annee}`);
    assert.equal(o.ouvres + o.nonTravailles + o.feriesChomes, o.calendaires);
  }
  assert.equal(C.joursOuvres(2025).ouvres, 251);
  assert.equal(C.joursOuvres(2026).ouvres, 252);
  assert.equal(C.joursOuvres(2026).feriesChomes, 9); // 15 août un samedi, 1er novembre un dimanche
  assert.equal(C.joursOuvres(2024).calendaires, 366);
});

test('jours ouvrés : semaine de 4 jours, Pentecôte travaillée', () => {
  const quatre = C.joursOuvres(2026, { joursSemaine: [1, 2, 3, 4] });
  const cinq = C.joursOuvres(2026);
  assert.ok(quatre.ouvres < cinq.ouvres);
  assert.equal(C.joursOuvres(2026, { pentecoteTravaillee: true }).ouvres, cinq.ouvres + 1);
  const pentecote = C.joursOuvres(2026, { pentecoteTravaillee: true }).feries.find((f) => f.nom === 'Lundi de Pentecôte');
  assert.equal(pentecote.chome, false);
  assert.equal(pentecote.travaille, true);
  const ferieVendredi = cinq.feries.filter((f) => C.versDate(f.date).getDay() === 5 && f.chome).length; // 1er et 8 mai, Noël
  assert.equal(ferieVendredi, 3);
  assert.equal(quatre.feriesChomes, cinq.feriesChomes - ferieVendredi);
});

test('capacité : congés, absences et part non facturable', () => {
  const c = C.capacite({ annee: 2026, conges: 25, absences: 5, partNonFacturable: 30, heuresJour: 7, personnes: 1 });
  assert.equal(c.travailles, 222);
  proche(c.joursFacturables, 155.4);
  proche(c.heuresFacturables, 1087.8);
  const agence = C.capacite({ annee: 2026, conges: 25, absences: 5, partNonFacturable: 30, heuresJour: 7, personnes: 3 });
  proche(agence.heuresFacturables, 1087.8 * 3);
  const trop = C.capacite({ annee: 2026, conges: 400, absences: 0, partNonFacturable: 150, heuresJour: 7, personnes: 1 });
  assert.equal(trop.travailles, 0);
  assert.equal(trop.heuresFacturables, 0);
});

test('charges fixes : mensuelles × 12 et annuelles', () => {
  assert.equal(C.chargesFixes([{ montant: 100, periode: 'mois' }, { montant: 600, periode: 'an' }, { montant: '', periode: 'mois' }]), 1800);
  assert.equal(C.chargesFixes([]), 0);
});

test('cotisations saisies : pourcentage de la rémunération ou montant', () => {
  assert.equal(C.cotisations(40000, { mode: 'pourcentage', valeur: 25 }), 10000);
  assert.equal(C.cotisations(40000, { mode: 'montant', valeur: 800, periode: 'mois' }), 9600);
  assert.equal(C.cotisations(40000, { mode: 'montant', valeur: 9000, periode: 'an' }), 9000);
  assert.equal(C.cotisations(40000, {}), 0);
});

test('coût de revient horaire et journalier', () => {
  const r = C.coutRevient({ chargesFixes: 10000, remuneration: 40000, cotisations: 10000, heuresFacturables: 1200, joursFacturables: 150 });
  assert.equal(r.total, 60000);
  assert.equal(r.parHeure, 50);
  assert.equal(r.parJour, 400);
  const vide = C.coutRevient({ chargesFixes: 1000, heuresFacturables: 0, joursFacturables: 0 });
  assert.equal(vide.parHeure, null);
  assert.equal(vide.parJour, null);
});

test('prix plancher et conseillé : la marge est une part du prix', () => {
  const p = C.prix(50, 20);
  assert.equal(p.plancher, 50);
  proche(p.conseille, 62.5);
  assert.equal(C.prix(50, 0).conseille, 50);
  proche(C.prix(50, 99).conseille, 500); // marge plafonnée à 90 %
  assert.equal(C.prix(null, 20).plancher, null);
  const m = C.prixMission(10, 400, 20);
  assert.equal(m.plancher, 4000);
  proche(m.conseille, 5000);
});

test('lecture des durées et des montants saisis', () => {
  assert.equal(C.lireDuree('1h30'), 1.5);
  assert.equal(C.lireDuree('1 h 30'), 1.5);
  assert.equal(C.lireDuree('2:15'), 2.25);
  assert.equal(C.lireDuree('1,5'), 1.5);
  assert.equal(C.lireDuree('90 min'), 1.5);
  assert.equal(C.lireDuree('3'), 3);
  assert.equal(C.lireDuree('7h'), 7);
  assert.equal(C.lireDuree('1h75'), null);
  assert.equal(C.lireDuree('abc'), null);
  assert.equal(C.lireDuree(''), null);
  assert.equal(C.lireMontant('1 200,50'), 1200.5);
  assert.equal(C.lireMontant('1 200 €'), 1200);
  assert.equal(C.lireMontant('1.200,50'), 1200.5);
  assert.equal(C.lireMontant('1200.5'), 1200.5);
  assert.equal(C.lireMontant('douze'), null);
});

test('rentabilité par client : marge, taux horaire réel, écart au plancher, statuts', () => {
  const s = (type, valeur, date = '2026-10-01') => ({ type, valeur, date });
  const opts = { coutHeure: 50, conseilleHeure: 62.5 };
  const rentable = C.bilanClient([s('temps', 10), s('frais', 100), s('facture', 900)], opts);
  assert.equal(rentable.heures, 10);
  assert.equal(rentable.coutTotal, 600);
  assert.equal(rentable.marge, 300);
  proche(rentable.tauxMarge, 1 / 3);
  assert.equal(rentable.tauxHoraireReel, 80);
  assert.equal(rentable.ecartPlancher, 30);
  assert.equal(rentable.statut, 'rentable');

  const sous = C.bilanClient([s('temps', 20), s('facture', 800)], opts);
  assert.equal(sous.tauxHoraireReel, 40);
  assert.equal(sous.ecartPlancher, -10);
  assert.equal(sous.marge, -200);
  assert.equal(sous.statut, 'sous-plancher');

  assert.equal(C.bilanClient([s('temps', 10), s('facture', 550)], opts).statut, 'sous-conseille');
  assert.equal(C.bilanClient([s('facture', 500)], opts).statut, 'sans-temps');
  assert.equal(C.bilanClient([s('facture', 500)], opts).tauxHoraireReel, null);
  assert.equal(C.bilanClient([s('temps', 4)], opts).statut, 'non-facture');
  assert.equal(C.bilanClient([s('temps', 4), s('facture', 400)], { coutHeure: null }).statut, 'sans-cout');
});

test('rentabilité : filtre de période, classement et répartition du temps', () => {
  const saisies = [{ type: 'temps', valeur: 5, date: '2026-01-10' }, { type: 'temps', valeur: 3, date: '2026-06-10' }, { type: 'facture', valeur: 400, date: '2026-06-30' }];
  const b = C.bilanClient(saisies, { coutHeure: 40, periode: { du: '2026-06-01', au: '2026-06-30' } });
  assert.equal(b.heures, 3);
  assert.equal(b.facture, 400);
  const liste = [
    { nom: 'B', statut: 'sans-temps', tauxHoraireReel: null, heures: 0 },
    { nom: 'A', statut: 'sous-plancher', tauxHoraireReel: 30, heures: 30 },
    { nom: 'C', statut: 'rentable', tauxHoraireReel: 90, heures: 10 },
    { nom: 'D', statut: 'non-facture', tauxHoraireReel: null, heures: 0 },
  ];
  assert.deepEqual(ici(C.classer(liste).map((x) => x.nom)), ['C', 'A', 'D', 'B']);
  const r = C.repartitionTemps(liste);
  proche(r.find((x) => x.nom === 'A').part, 0.75);
  assert.equal(C.repartitionTemps([{ heures: 0 }])[0].part, 0);
});
