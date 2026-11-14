// Tests des règles métier du Suivi du temps et rentabilité par mission (templates/suivi-temps/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/suivi-temps/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.TMP;
const BASE = ctx.window.BASE;
const esp = (x) => String(x).replace(/[  ]/g, ' ');
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// État de test : TJM 560 € / 7 h (80 €/h), coût de revient 50 €/h.
function etat({ missions = [], entrees = [], ...reglages } = {}) {
  return R.normaliser({ tjm: 560, heuresJour: 7, coutHeure: 50, missions, entrees, ...reglages });
}
let n = 0;
const ent = (mission, date, minutes, facturable = true, extra = {}) => ({ id: `e${++n}`, mission, date, minutes, facturable, categorie: 'realisation', ...extra });
// Plusieurs journées consécutives pour un total donné (une entrée ne dépasse jamais 24 h).
const jours = (mission, debut, minutes, facturable = true, extra = {}) => {
  const l = [];
  for (let i = 0, reste = minutes; reste > 0; i++, reste -= 420) l.push(ent(mission, R.ajoutJours(debut, i), Math.min(420, reste), facturable, extra));
  return l;
};
const simple = (o) => JSON.parse(JSON.stringify(o));
const egal = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);

test('base intégrée : catégories uniques, modèles qui citent des catégories connues, semaines de 7 jours', () => {
  const ids = BASE.categories.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BASE.categories.length, 17);
  assert.equal(BASE.categories.filter((c) => c.facturable).length, 7);
  for (const m of BASE.modeles) {
    assert.ok(['forfait', 'regie'].includes(m.mode), m.id);
    assert.ok(m.taches.length >= 2, m.id);
    for (const [nom, cat] of m.taches) assert.ok(ids.includes(cat), `${m.id} : ${nom}`);
  }
  for (const s of BASE.semaines) assert.equal(s.heures.length, 7);
  assert.ok(BASE.couleurs.length >= 6);
});

test('lecture des durées : formats courants, refus des valeurs absurdes', () => {
  const cas = { '1h30': 90, '1 h 30': 90, '1:30': 90, '1,5': 90, '1.5h': 90, '90 min': 90, '45m': 45, '2': 120, '0h45': 45, '7 heures': 420, '10min': 10 };
  for (const [s, v] of Object.entries(cas)) assert.equal(R.lireDuree(s), v, s);
  for (const s of ['', 'abc', '0', '1h75', '25h', '-1', '1h30h']) assert.equal(R.lireDuree(s), null, s);
});

test('affichage des durées et montants', () => {
  assert.equal(esp(R.duree(90)), '1 h 30');
  assert.equal(esp(R.duree(45)), '45 min');
  assert.equal(esp(R.duree(120)), '2 h');
  assert.equal(esp(R.duree(0)), '0 h');
  assert.equal(esp(R.duree(65)), '1 h 05');
  assert.equal(esp(R.duree(-30)), '− 30 min');
  assert.equal(esp(R.euros(1234.5)), '1 235 €');
  assert.equal(R.lireNombre('1 200,50 €'), 1200.5);
  assert.equal(R.lireNombre('1.200'), 1200);
  assert.equal(R.lireNombre(''), null);
});

test('chronomètre : minutes écoulées et arrondi au pas le plus proche, au moins un pas', () => {
  assert.equal(R.minutesChrono({ debut: 0 }, 47 * 60000 + 59000), 47);
  assert.equal(R.minutesChrono(null, 1e9), 0);
  assert.equal(R.arrondirDuree(47, 0), 47);
  assert.equal(R.arrondirDuree(0, 0), 1);
  assert.equal(R.arrondirDuree(47, 15), 45);
  assert.equal(R.arrondirDuree(53, 15), 60);
  assert.equal(R.arrondirDuree(3, 15), 15);
  assert.equal(R.arrondirDuree(22, 5), 20);
  const E = etat({ arrondi: 15 });
  E.chrono = { debut: 0, mission: null, tache: null, categorie: 'admin', facturable: false, note: 'Classement' };
  const e = R.entreeDepuisChrono(E, 52 * 60000, '2026-11-14');
  egal([e.minutes, e.categorie, e.facturable, e.note, e.date], [45, 'admin', false, 'Classement', '2026-11-14']);
  E.arrondi = 0;
  assert.equal(R.entreeDepuisChrono(E, 30000, '2026-11-14'), null);
});

test('dates : semaine du lundi au dimanche, mois, périodes nommées', () => {
  assert.equal(R.lundi('2026-11-14'), '2026-11-09');   // samedi → lundi
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');   // dimanche
  assert.equal(R.rangJour('2026-11-15'), 6);
  assert.equal(R.finMois('2028-02-10'), '2028-02-29');
  egal(simple(R.periode('mois', '2026-11-14')), { du: '2026-11-01', au: '2026-11-30' });
  egal(simple(R.periode('mois-precedent', '2026-01-14')), { du: '2025-12-01', au: '2025-12-31' });
  egal(simple(R.periode('trimestre', '2026-11-14')), { du: '2026-09-01', au: '2026-11-30' });
  egal(simple(R.periode('semaine', '2026-11-14')), { du: '2026-11-09', au: '2026-11-15' });
  assert.equal(R.ajoutJours('2026-03-28', 2), '2026-03-30');   // passage à l'heure d'été
});

test('références : taux cible = TJM ÷ heures par jour, plancher, taux de régie et budget', () => {
  const E = etat();
  assert.equal(R.tauxCible(E), 80);
  assert.equal(R.plancher(E), 50);
  assert.equal(R.tauxCible(etat({ tjm: null })), null);
  assert.equal(R.tauxMission({ taux: 630, uniteTaux: 'jour' }, 7), 90);
  assert.equal(R.tauxMission({ taux: 75, uniteTaux: 'heure' }, 7), 75);
  assert.equal(R.budgetMinutes({ budget: 8, uniteBudget: 'jour' }, 7), 8 * 7 * 60);
  assert.equal(R.budgetMinutes({ budget: 12.5, uniteBudget: 'heure' }, 7), 750);
  assert.equal(R.budgetMinutes({ budget: null }, 7), null);
  assert.equal(R.tauxDevis({ mode: 'forfait', montant: 4480, budget: 8, uniteBudget: 'jour' }, 7), 80);
});

test('forfait : taux effectif = montant ÷ temps réel, reprise non facturable comprise, budget dépassé', () => {
  const m = { id: 'site', nom: 'Site', client: 'Client A', mode: 'forfait', montant: 4480, budget: 8, uniteBudget: 'jour', avancement: 90 };
  const E = etat({ missions: [m], entrees: [...jours('site', '2026-10-01', 50 * 60), ent('site', '2026-11-03', 6 * 60, false, { categorie: 'reprise' }), ent('site', '2026-11-04', 4 * 60)] });
  const b = R.bilanMission(E, R.mission(E, 'site'));
  assert.equal(b.minutes, 60 * 60);
  assert.equal(b.nonFacturable, 6 * 60);
  assert.equal(b.budget, 56 * 60);
  assert.equal(b.consomme, 60 * 60);                // forfait : tout le temps compte
  proche(b.conso, 60 / 56);
  assert.equal(b.statutBudget, 'depasse');
  assert.equal(b.alertes[0].code, 'depasse');
  proche(b.taux, 4480 / 60);                         // 74,67 €/h
  proche(b.tjmEquivalent, 4480 / 60 * 7);
  assert.equal(b.devis, 80);
  assert.equal(b.estimation, Math.round(3600 / 0.9));
  proche(b.tauxFin, 4480 / (Math.round(3600 / 0.9) / 60));
  assert.equal(b.statutTaux, 'sous-cible');          // entre le plancher (50) et la cible (80)
  proche(b.ecartCible, 4480 / 60 - 80);
});

test('forfait : vigilance au seuil, dérive de l\'avancement, dépassement prévu, rentable', () => {
  const m = { id: 'a', mode: 'forfait', montant: 2000, budget: 20, uniteBudget: 'heure', avancement: 60 };
  // 16 h sur 20 h (80 %) : vigilance ; avancement 60 % → dérive (80 − 60 > 15) ; estimation 26 h 40 > 20 h.
  let E = etat({ missions: [m], entrees: [ent('a', '2026-11-02', 16 * 60)] });
  let b = R.bilanMission(E, E.missions[0]);
  assert.equal(b.statutBudget, 'vigilance');
  egal(simple(b.alertes.map((a) => a.code)), ['vigilance', 'derive', 'prevu']);
  assert.equal(b.depassementPrevu, Math.round(960 / 0.6) - 1200);
  // 10 h sur 20 h, avancement 55 % : rien à signaler, 200 €/h au-dessus de la cible.
  E = etat({ missions: [{ ...m, avancement: 55 }], entrees: [ent('a', '2026-11-02', 10 * 60)] });
  b = R.bilanMission(E, E.missions[0]);
  assert.equal(b.statutBudget, 'ok');
  egal(simple(b.alertes), []);
  assert.equal(b.taux, 200);
  assert.equal(b.statutTaux, 'au-dessus');
  // Seuil de vigilance réglé à 90 % : 16 h sur 20 h n'est plus « à surveiller » par le seuil, mais la dérive reste.
  E = etat({ seuilVigilance: 90, missions: [m], entrees: [ent('a', '2026-11-02', 16 * 60)] });
  egal(simple(R.bilanMission(E, E.missions[0]).alertes.map((a) => a.code)), ['derive', 'prevu']);
  // Mission terminée : ni dérive ni prévision ; estimation = temps passé.
  E = etat({ missions: [{ ...m, statut: 'terminee', avancement: 100 }], entrees: [ent('a', '2026-11-02', 16 * 60)] });
  b = R.bilanMission(E, E.missions[0]);
  egal(simple(b.alertes.map((a) => a.code)), ['vigilance']);
  assert.equal(b.estimation, 960);
});

test('régie : valeur = heures facturables × taux, consommation sur le facturable, taux dilué par le non facturable', () => {
  const m = { id: 'r', mode: 'regie', taux: 630, uniteTaux: 'jour', budget: 10, uniteBudget: 'jour' };
  const E = etat({ missions: [m], entrees: [...jours('r', '2026-10-01', 42 * 60), ent('r', '2026-11-03', 3 * 60, false, { categorie: 'reunion' })] });
  const b = R.bilanMission(E, E.missions[0]);
  assert.equal(b.valeur, 42 * 90);
  assert.equal(b.consomme, 42 * 60);
  proche(b.conso, 42 / 70);
  assert.equal(b.statutBudget, 'ok');
  proche(b.taux, 42 * 90 / 45);                     // 84 €/h
  assert.equal(b.statutTaux, 'au-dessus');
  assert.equal(b.devis, null);
});

test('statuts de taux : sous le coût de revient, sans cible, sans temps', () => {
  const m = { id: 'f', mode: 'forfait', montant: 400 };
  let E = etat({ missions: [m], entrees: [ent('f', '2026-11-02', 10 * 60)] });
  assert.equal(R.bilanMission(E, E.missions[0]).statutTaux, 'sous-plancher');   // 40 €/h < 50 €/h
  assert.equal(R.bilanMission(E, E.missions[0]).statutBudget, 'sans-budget');
  E = etat({ tjm: null, coutHeure: null, missions: [m], entrees: [ent('f', '2026-11-02', 2 * 60)] });
  assert.equal(R.bilanMission(E, E.missions[0]).statutTaux, 'sans-cible');
  E = etat({ missions: [m] });
  const b = R.bilanMission(E, E.missions[0]);
  assert.equal(b.statutTaux, 'sans-temps');
  assert.equal(b.taux, null);
});

test('temps par tâche et alertes des missions en cours, dépassements d\'abord', () => {
  const m1 = { id: 'm1', mode: 'forfait', montant: 1000, budget: 10, uniteBudget: 'heure', taches: [{ id: 't1', nom: 'Maquettes', categorie: 'analyse', budgetH: 4 }, { id: 't2', nom: 'Développement', categorie: 'realisation' }] };
  const m2 = { id: 'm2', mode: 'forfait', montant: 1000, budget: 10, uniteBudget: 'heure' };
  const m3 = { id: 'm3', mode: 'forfait', montant: 1000, budget: 10, uniteBudget: 'heure', statut: 'terminee' };
  const E = etat({ missions: [m1, m2, m3], entrees: [ent('m1', '2026-11-02', 300, true, { tache: 't1' }), ent('m1', '2026-11-02', 60, true, { tache: 't2' }), ent('m1', '2026-11-03', 60), ent('m2', '2026-11-02', 700), ent('m3', '2026-11-02', 900)] });
  const t = R.tempsParTache(E, E.missions[0]);
  egal(t.map((x) => [x.t.nom, x.minutes]), [['Maquettes', 300], ['Développement', 60], ['Sans tâche', 60]]);
  proche(t[0].conso, 300 / 240);
  const a = R.alertesMissions(E);
  egal(a.map((b) => b.m.id), ['m2']);          // m1 à 70 % (sans alerte), m3 terminée exclue
  E.entrees.push(ent('m1', '2026-11-04', 500));            // m1 dépasse (920 min sur 600)
  egal(R.alertesMissions(E).map((b) => b.m.id), ['m1', 'm2']);
});

test('synthèse d\'une période : facturabilité, valeur produite au prorata, taux réel de l\'activité, prévu', () => {
  const forfait = { id: 'f', mode: 'forfait', montant: 3000, budget: 30, uniteBudget: 'heure' };
  const regie = { id: 'r', mode: 'regie', taux: 80, uniteTaux: 'heure' };
  const E = etat({
    missions: [forfait, regie],
    entrees: [
      ent('f', '2026-11-02', 600), ent('f', '2026-10-20', 600),            // 10 h en novembre, 10 h en octobre
      ent('r', '2026-11-03', 300), ent('r', '2026-11-03', 60, false),      // 5 h facturables + 1 h offerte
      ent(null, '2026-11-04', 120, false, { categorie: 'prospection' }), ent(null, '2026-11-05', 60, false, { categorie: 'compta' }),
      ent(null, '2026-11-06', 60, false, { categorie: 'prospection' }),
    ],
  });
  const s = R.synthesePeriode(E, { du: '2026-11-01', au: '2026-11-30' });
  assert.equal(s.minutes, 600 + 360 + 240);
  assert.equal(s.facturable, 900);
  proche(s.partFacturable, 900 / 1200);
  proche(s.valeur, 3000 * (600 / 1800) + 5 * 80);    // 1 000 € (10 h sur 30 h de budget) + 400 €
  proche(s.taux, 1400 / 20);                          // 70 €/h sur 20 h
  assert.equal(s.statutTaux, 'sous-cible');
  egal(s.nonFactParCategorie.map((x) => [x.categorie, x.minutes]), [['prospection', 180], ['realisation', 60], ['compta', 60]]);
  assert.equal(s.prevu, 21 * 7 * 60);                 // 21 jours ouvrés lun-ven en novembre 2026 × 7 h
  assert.equal(s.ecartPrevu, 1200 - 21 * 420);
  // Forfait dépassé : la base est le temps total, le montant n'est jamais compté plus d'une fois.
  const E2 = etat({ missions: [{ ...forfait, budget: 5 }], entrees: [ent('f', '2026-11-02', 600), ent('f', '2026-11-03', 600)] });
  proche(R.valeurEntrees(E2, E2.entrees), 3000);
  proche(R.synthesePeriode(E2, { du: '2026-11-02', au: '2026-11-02' }).valeur, 1500);
});

test('feuille de la semaine et dernières semaines face à la semaine type', () => {
  const E = etat({ missions: [{ id: 'm', mode: 'regie', taux: 70, uniteTaux: 'heure' }], semaineType: [8, 8, 8, 8, 0, 0, 0],
    entrees: [ent('m', '2026-11-09', 420), ent('m', '2026-11-10', 240), ent(null, '2026-11-10', 60, false, { categorie: 'admin' }), ent('m', '2026-11-14', 60), ent('m', '2026-11-02', 300)] });
  const f = R.feuilleSemaine(E, '2026-11-09');
  assert.equal(f.jours[6], '2026-11-15');
  egal(f.totaux, [420, 300, 0, 0, 0, 60, 0]);
  assert.equal(f.total, 780);
  assert.equal(f.facturable, 720);
  assert.equal(f.prevu, 32 * 60);
  egal(f.lignes.map((l) => l.cle), ['m:m', 'c:admin']);
  egal(f.lignes[0].jours, [420, 240, 0, 0, 0, 60, 0]);
  const s = R.dernieresSemaines(E, '2026-11-14', 2);
  egal(s.map((x) => [x.lundi, x.minutes, x.facturable, x.prevu]), [['2026-11-02', 300, 300, 1920], ['2026-11-09', 780, 720, 1920]]);
});

test('rapport client : missions du client, période, facturable seul ou non, totaux par tâche', () => {
  const m1 = { id: 'm1', nom: 'Audit', client: 'Client A', mode: 'forfait', montant: 1500, budget: 3, uniteBudget: 'jour', taches: [{ id: 't', nom: 'Analyse', categorie: 'analyse' }] };
  const m2 = { id: 'm2', nom: 'Suivi', client: 'Client A', mode: 'regie', taux: 600, uniteTaux: 'jour' };
  const m3 = { id: 'm3', nom: 'Autre', client: 'Client B', mode: 'forfait', montant: 900 };
  const E = etat({ missions: [m1, m2, m3], entrees: [ent('m1', '2026-11-03', 240, true, { tache: 't', note: 'Entretiens' }), ent('m1', '2026-11-02', 120, true, { tache: 't' }), ent('m1', '2026-11-04', 60, false), ent('m2', '2026-11-05', 420), ent('m3', '2026-11-05', 300), ent('m2', '2026-10-05', 420)] });
  const r = R.rapport(E, { client: 'Client A', du: '2026-11-01', au: '2026-11-30' });
  egal(r.blocs.map((b) => b.m.id), ['m1', 'm2']);
  assert.equal(r.minutes, 360 + 420);
  proche(r.jours, 780 / 60 / 7);
  egal(r.blocs[0].entrees.map((e) => e.date), ['2026-11-02', '2026-11-03']);   // trié, non facturable exclu
  egal(r.blocs[0].parTache.map((x) => [x.nom, x.minutes]), [['Analyse', 360]]);
  assert.equal(r.blocs[1].valeur, 600);
  const tout = R.rapport(E, { mission: 'm1', facturableSeul: false });
  assert.equal(tout.minutes, 420);
  const c = R.versCsvRapport(E, r);
  assert.ok(c.startsWith('﻿Date;Client;Mission;Tâche;Durée (h);Facturable;Détail'));
  assert.ok(c.includes('2026-11-03;Client A;Audit;Analyse;4;oui;Entretiens'));
  assert.ok(c.endsWith('Total;;;;13;;'));
});

test('export CSV des saisies : colonnes, hors mission, échappement', () => {
  const E = etat({ missions: [{ id: 'm', nom: 'Site ; refonte', client: 'Client "A"', mode: 'forfait', montant: 1000 }], entrees: [ent('m', '2026-11-02', 90, true, { note: 'Ligne 1' }), ent(null, '2026-11-01', 30, false, { categorie: 'veille' })] });
  const c = R.versCsvEntrees(E, {}, BASE.categories).split('\r\n');
  assert.equal(c[0], '﻿Date;Client;Mission;Tâche;Catégorie;Facturable;Durée (h);Durée (min);Note');
  assert.equal(c[1], '2026-11-01;;(hors mission);;Veille;non;0,5;30;');
  assert.equal(c[2], '2026-11-02;"Client ""A""";"Site ; refonte";;Réalisation;oui;1,5;90;Ligne 1');
});

test('normalisation : tolère les anciennes données et les valeurs invalides', () => {
  const E = R.normaliser({
    tjm: '560', heuresJour: 0, seuilVigilance: 300, arrondi: 7, semaineType: [7, 7],
    missions: [{ id: 'm', nom: 'X', mode: 'autre', montant: '-5', avancement: 140, taches: [{ nom: 'T' }, null] }],
    entrees: [{ date: '2026-11-02', minutes: 30, mission: 'inconnue' }, { date: 'hier', minutes: 30 }, { date: '2026-11-02', minutes: 0 }, { date: '2026-11-03', minutes: 2000, mission: 'm' }],
    chrono: { debut: 1000, mission: 'inconnue', categorie: 'admin', facturable: false },
  });
  assert.equal(E.tjm, 560);
  assert.equal(E.heuresJour, 1);
  assert.equal(E.seuilVigilance, 100);
  assert.equal(E.arrondi, 0);
  egal([...E.semaineType], [7, 7, 7, 7, 7, 0, 0]);
  assert.equal(E.missions[0].mode, 'forfait');
  assert.equal(E.missions[0].montant, null);
  assert.equal(E.missions[0].avancement, 100);
  assert.equal(E.missions[0].taches.length, 1);
  assert.equal(E.entrees.length, 2);
  assert.equal(E.entrees[0].mission, null);
  assert.equal(E.entrees[1].minutes, 1440);
  assert.equal(E.chrono.mission, null);
  assert.equal(E.chrono.facturable, false);
  egal(JSON.parse(JSON.stringify(R.normaliser(null))), JSON.parse(JSON.stringify(R.etatVide())));
});
