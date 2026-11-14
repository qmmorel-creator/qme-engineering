// Tests des règles métier du carnet de musculation et cross-training (templates/musculation/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/musculation/', import.meta.url);
const ctx = { window: {}, structuredClone };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.MSC;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const DEFAUTS = { reglages: BASE.reglages, groupes: BASE.groupes };
const REG = { formule: 'epley', repsMax: 10 };
const etat = (seances = [], extra = {}) => Object.assign(R.etatVide(DEFAUTS), { seances: seances.map(R.normaliserSeance) }, extra);
const idx = (e = etat()) => R.index(BASE, e);
const serie = (charge, reps, extra = {}) => ({ charge, reps, ...extra });
const seance = (id, date, blocs, extra = {}) => ({ id, date, type: 'series', titre: 'Séance', exercices: blocs.map(([ex, series]) => ({ ex, series })), ...extra });
const wod = (id, date, w, extra = {}) => ({ id, date, type: 'wod', titre: 'WOD', wod: w, ...extra });

test('base intégrée : 150 exercices, identifiants uniques, groupes et mesures valides', () => {
  assert.equal(BASE.exercices.length, 150);
  const ids = BASE.exercices.map((e) => e.id);
  assert.equal(new Set(ids).size, 150);
  const groupes = new Set(BASE.groupes.map((g) => g.id));
  for (const e of BASE.exercices) {
    assert.ok(groupes.has(e.groupe), e.id);
    assert.ok(R.MESURES.includes(e.mesure), e.id);
  }
  for (const g of BASE.groupes) assert.ok(BASE.exercices.some((e) => e.groupe === g.id), g.id);
  for (const m of R.MESURES) assert.ok(BASE.exercices.some((e) => e.mesure === m), m);
});

test('base intégrée : aucun nom de marque ni de WOD de référence', () => {
  const tout = JSON.stringify(BASE).toLowerCase();
  assert.ok(!/cross ?f[i]t/.test(tout), 'nom de marque de cross-training');
  for (const interdit of ['fran', 'murph', 'cindy', 'grace', 'helen', 'karen', 'diane', 'isabel', 'annie', 'hero', 'girls', 'tabata', 'concept2', 'concept 2', 'assault', 'skierg', 'rogue', 'echo bike', 'smith', 'arnold', 'superman', 'scott', 'pendlay', 'hyrox']) {
    assert.ok(!new RegExp(`\\b${interdit}\\b`).test(tout), interdit);
  }
});

test('base intégrée : modèles cohérents avec les exercices et les formats', () => {
  const ids = new Set(BASE.exercices.map((e) => e.id));
  assert.ok(BASE.modeles.length >= 10);
  for (const m of BASE.modeles) {
    const liste = m.type === 'wod' ? m.wod.mouvements : m.exercices;
    for (const [ex] of liste) assert.ok(ids.has(ex), `${m.id} : ${ex}`);
    if (m.type === 'wod') assert.ok(R.FORMATS.includes(m.wod.format));
    const c = R.modeleDeBase(m);
    assert.equal(c.id, m.id);
    assert.equal(c.type, m.type);
  }
  const m = R.modeleDeBase(BASE.modeles.find((x) => x.id === 'm-bas-force'));
  assert.equal(m.exercices[0].ex, 'squat');
  assert.equal(m.exercices[0].series.length, 5);
  assert.equal(m.exercices[0].series[0].reps, 5);
  assert.equal(m.exercices[0].series[0].charge, null);
  const w = R.modeleDeBase(BASE.modeles.find((x) => x.id === 'm-fortime-rameur'));
  assert.equal(w.wod.mouvements[0].distance, 500);
  assert.equal(w.wod.mouvements[0].reps, null);
  assert.equal(w.wod.cap, 15);
});

test('1RM estimé : Epley, Brzycki, bornes', () => {
  assert.equal(R.un1RM(100, 1), 100);
  assert.equal(R.arrondi2(R.un1RM(100, 5)), 116.67);
  assert.equal(R.un1RM(90, 10), 120);
  assert.equal(R.un1RM(100, 11), null); // au-delà de 10 répétitions
  assert.equal(R.arrondi2(R.un1RM(100, 12, 'epley', 12)), 140);
  assert.equal(R.arrondi2(R.un1RM(100, 5, 'brzycki')), 112.5);
  assert.equal(R.un1RM(100, 1, 'brzycki'), 100);
  assert.equal(R.un1RM(0, 5), null);
  assert.equal(R.un1RM(null, 5), null);
  assert.equal(R.un1RM(100, 0), null);
  assert.equal(R.un1RM(100, 2.5), null);
  assert.equal(R.un1RM(100, 37, 'brzycki', 40), null);
});

test('nombres et durées en français', () => {
  assert.equal(R.nombre(1234.5), '1 234,5');
  assert.equal(R.nombre(12), '12');
  assert.equal(R.nombre(12.04, 1), '12');
  assert.equal(R.nombre(-3.25, 2), '−3,25');
  assert.equal(R.nombre(null), '–');
  assert.equal(R.lireNombre('62,5'), 62.5);
  assert.equal(R.lireNombre(' 100 '), 100);
  assert.equal(R.lireNombre('abc'), null);
  assert.equal(R.lireNombre('-5'), null);
  assert.equal(R.lireNombre(''), null);
  assert.equal(R.lireDuree('12:30'), 750);
  assert.equal(R.lireDuree('1:02:03'), 3723);
  assert.equal(R.lireDuree('45'), 45);
  assert.equal(R.lireDuree('12min'), 720);
  assert.equal(R.lireDuree('7.05'), 425);
  assert.equal(R.lireDuree('3:75'), null);
  assert.equal(R.lireDuree('x'), null);
  assert.equal(R.lireDuree(''), null);
  assert.equal(R.formatDuree(750), '12:30');
  assert.equal(R.formatDuree(3723), '1:02:03');
  assert.equal(R.formatDuree(5), '0:05');
  assert.equal(R.formatDuree(null), '–');
});

test('dates : lundi de la semaine', () => {
  assert.equal(R.lundi('2026-11-14'), '2026-11-09'); // samedi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche
  assert.equal(R.lundi('2026-11-16'), '2026-11-16'); // lundi
  assert.equal(R.lundi('2027-01-01'), '2026-12-28');
});

test('séries remplies et valeurs de record selon la mesure', () => {
  const i = idx();
  assert.ok(R.serieRemplie({ charge: null, reps: 5 }, 'charge'));
  assert.ok(!R.serieRemplie({ charge: 100, reps: null }, 'charge'));
  assert.ok(R.serieRemplie({ temps: 60 }, 'temps'));
  assert.ok(!R.serieRemplie({ reps: 10 }, 'temps'));
  assert.deepEqual(simple(R.valeursSerie({ charge: 100, reps: 3 }, i.get('squat'), REG)), { charge: 100, rm: 110 });
  assert.deepEqual(simple(R.valeursSerie({ charge: 60, reps: 15 }, i.get('squat'), REG)), { charge: 60 }); // pas de 1RM au-delà de 10
  assert.deepEqual(simple(R.valeursSerie({ charge: null, reps: 8 }, i.get('squat'), REG)), {});
  assert.deepEqual(simple(R.valeursSerie({ reps: 12 }, i.get('tractions'), REG)), { reps: 12 });
  assert.deepEqual(simple(R.valeursSerie({ temps: 90 }, i.get('gainage'), REG)), { temps: 90 });
  assert.deepEqual(simple(R.valeursSerie({ distance: 2000, temps: 480 }, i.get('rameur'), REG)), { distance: 2000, allure: 120 });
  assert.deepEqual(simple(R.valeursSerie({ distance: 5000, temps: 1500 }, i.get('course'), REG)), { distance: 5000, allure: 300 });
  assert.deepEqual(simple(R.valeursSerie({ distance: 1000 }, i.get('course'), REG)), { distance: 1000 });
  assert.deepEqual(simple(R.valeursSerie({ calories: 20 }, i.get('velo-air'), REG)), { calories: 20 });
});

test('volume d\'une séance : tonnage, séries et groupes', () => {
  const s = R.normaliserSeance(seance('s', '2026-11-10', [
    ['squat', [serie(100, 5), serie(100, 5), serie(null, 5), serie(100, null)]],
    ['tractions', [serie(null, 8), serie(null, 6)]],
    ['gainage', [{ temps: 60 }]],
  ]));
  const v = R.volumeSeance(s, idx());
  assert.equal(v.tonnage, 1000);
  assert.equal(v.series, 6); // la série sans répétitions ne compte pas
  assert.equal(v.reps, 29);
  assert.deepEqual(simple(v.groupes.quadri), { series: 3, tonnage: 1000 });
  assert.deepEqual(simple(v.groupes.dos), { series: 2, tonnage: 0 });
  assert.deepEqual(simple(v.groupes.abdos), { series: 1, tonnage: 0 });
});

test('WOD : tours effectifs et volume par format', () => {
  const i = idx();
  const amrap = R.normaliserSeance(wod('a', '2026-11-10', { format: 'amrap', duree: 12, mouvements: [{ ex: 'thruster', reps: 10, charge: 40 }, { ex: 'burpees', reps: 10 }], score: { tours: 5, reps: 7 } }));
  assert.equal(R.toursEffectifs(amrap.wod, 0), 5);
  const v = R.volumeSeance(amrap, i);
  assert.equal(v.tonnage, 2000);
  assert.equal(v.reps, 100);
  assert.equal(v.series, 2);
  const ft = R.normaliserWod({ format: 'fortime', tours: 3, mouvements: [{ ex: 'thruster', reps: 12 }], score: { termine: true, temps: 500 } });
  assert.equal(R.toursEffectifs(ft, 0), 3);
  const ftCap = R.normaliserWod({ format: 'fortime', tours: 3, cap: 10, mouvements: [{ ex: 'thruster', reps: 12 }], score: { termine: false, tours: 2, reps: 5 } });
  assert.equal(R.toursEffectifs(ftCap, 0), 2);
  const emom = R.normaliserWod({ format: 'emom', duree: 10, mouvements: [{ ex: 'kb-swing', reps: 15 }, { ex: 'box-jump', reps: 10 }, { ex: 'burpees', reps: 8 }], score: { reussies: 10 } });
  assert.equal(R.minutesEmom(emom), 10);
  assert.deepEqual([0, 1, 2].map((k) => R.toursEffectifs(emom, k)), [4, 3, 3]);
  emom.score.reussies = 40; // borné au nombre de minutes
  assert.equal(R.toursEffectifs(emom, 0), 4);
  const emom90 = R.normaliserWod({ format: 'emom', duree: 12, intervalle: 90, mouvements: [{ ex: 'burpees', reps: 8 }], score: { reussies: 8 } });
  assert.equal(R.minutesEmom(emom90), 8);
  const inter = R.normaliserWod({ format: 'intervalles', travail: 20, repos: 10, tours: 8, mouvements: [{ ex: 'squat-air' }, { ex: 'pompes' }], score: { reps: 101 } });
  assert.equal(R.repsEffectuees(inter, 0), 51);
  assert.equal(R.repsEffectuees(inter, 1), 51);
  assert.equal(R.toursEffectifs(inter, 1), 4);
  const sansScore = R.normaliserWod({ format: 'amrap', duree: 10, mouvements: [{ ex: 'burpees', reps: 10 }] });
  assert.equal(R.repsEffectuees(sansScore, 0), 0);
  assert.equal(R.repsEffectuees(sansScore, 5), 0);
});

test('WOD : score rempli, comparaison et texte', () => {
  const w = (format, score, extra = {}) => R.normaliserWod({ format, mouvements: [], score, ...extra });
  assert.ok(!R.scoreRempli(w('amrap', {})));
  assert.ok(R.scoreRempli(w('amrap', { tours: 0 })));
  assert.ok(!R.scoreRempli(w('fortime', { termine: true })));
  assert.ok(R.scoreRempli(w('fortime', { termine: false, tours: 2 })));
  assert.ok(R.comparerScores('amrap', { tours: 6, reps: 0 }, { tours: 5, reps: 20 }) > 0);
  assert.ok(R.comparerScores('amrap', { tours: 5, reps: 3 }, { tours: 5, reps: 7 }) < 0);
  assert.equal(R.comparerScores('amrap', { tours: 5, reps: 3 }, { tours: 5, reps: 3 }), 0);
  assert.ok(R.comparerScores('fortime', { termine: true, temps: 400 }, { termine: true, temps: 450 }) > 0);
  assert.ok(R.comparerScores('fortime', { termine: true, temps: 900 }, { termine: false, tours: 9 }) > 0);
  assert.ok(R.comparerScores('fortime', { termine: false, tours: 2, reps: 10 }, { termine: false, tours: 2, reps: 4 }) > 0);
  assert.ok(R.comparerScores('emom', { reussies: 10 }, { reussies: 9 }) > 0);
  assert.ok(R.comparerScores('intervalles', { reps: 90 }, { reps: 101 }) < 0);
  assert.equal(R.scoreTexte(w('amrap', { tours: 5, reps: 7 })), '5 tours + 7 reps');
  assert.equal(R.scoreTexte(w('amrap', { tours: 1, reps: 0 })), '1 tour');
  assert.equal(R.scoreTexte(w('fortime', { termine: true, temps: 512 })), '8:32');
  assert.equal(R.scoreTexte(w('fortime', { termine: false, tours: 2, reps: 4 })), 'Temps limite : 2 tours + 4 reps');
  assert.equal(R.scoreTexte(w('emom', { reussies: 9 }, { duree: 10 })), '9 / 10 min réussies');
  assert.equal(R.scoreTexte(w('intervalles', { reps: 101 })), '101 reps au total');
  assert.equal(R.scoreTexte(w('amrap', {})), 'Score à saisir');
  assert.equal(R.descriptionWod(w('fortime', {}, { tours: 3, cap: 15 })), 'For Time · 3 tours · limite 15 min');
  assert.equal(R.descriptionWod(w('intervalles', {}, { travail: 20, repos: 10, tours: 8 })), 'Intervalles 20 s / 10 s × 8');
  assert.equal(R.descriptionWod(w('emom', {}, { duree: 12, intervalle: 90 })), 'EMOM 12 min (toutes les 1:30)');
});

test('records : détection chronologique, premières performances, égalité non comptée', () => {
  const e = etat([
    seance('s3', '2026-11-12', [['squat', [serie(105, 3)]], ['tractions', [serie(null, 10)]]]),
    seance('s1', '2026-11-01', [['squat', [serie(100, 5), serie(95, 8)]], ['tractions', [serie(null, 8)]]]),
    seance('s2', '2026-11-05', [['squat', [serie(100, 5)]], ['tractions', [serie(null, 9)]]]),
    seance('s4', '2026-11-13', [['squat', [serie(120, 1)]]]),
  ]);
  const evts = R.chronologieRecords(e, idx(e), REG);
  const de = (id) => simple(R.recordsSeance(evts, id)).map((x) => [x.ex, x.type, R.arrondi2(x.valeur)]);
  assert.deepEqual(de('s1'), []); // premières performances seulement
  assert.ok(evts.filter((x) => x.seance === 's1').every((x) => x.premier));
  // s1 : 1RM = max(116,67 ; 120,33) = 120,33 ; s2 : 116,67 → aucun record de 1RM ; reps 9 > 8.
  assert.deepEqual(de('s2'), [['tractions', 'reps', 9]]);
  // s3 : 105 × 3 = 115,5 (pas de record de 1RM) ; charge 105 > 100 ; reps 10.
  assert.deepEqual(de('s3'), [['squat', 'charge', 105], ['tractions', 'reps', 10]]);
  // s4 : 120 × 1 = 120 < 120,33 : record de charge seulement.
  assert.deepEqual(de('s4'), [['squat', 'charge', 120]]);
  const r = R.recordsExercice(e, idx(e), REG, 'squat');
  assert.equal(R.arrondi2(r.types.rm.valeur), 120.33);
  assert.equal(r.types.rm.date, '2026-11-01');
  assert.equal(r.types.charge.valeur, 120);
  assert.equal(r.parReps[1].charge, 120);
  assert.equal(r.parReps[3].charge, 105);
  assert.equal(r.parReps[5].charge, 100);
  assert.equal(r.parReps[8].charge, 95);
  assert.equal(r.parReps[10], undefined);
  assert.equal(r.seances, 4);
  assert.equal(r.derniere, '2026-11-13');
});

test('records : allure (plus petit vaut mieux), même jour dans l\'ordre de saisie', () => {
  const e = etat([
    seance('a', '2026-11-01', [['rameur', [{ distance: 2000, temps: 480 }]]]),
    seance('b', '2026-11-01', [['rameur', [{ distance: 2000, temps: 470 }]]]),
    seance('c', '2026-11-03', [['rameur', [{ distance: 1000, temps: 240 }]]]),
  ]);
  const evts = R.chronologieRecords(e, idx(e), REG);
  assert.deepEqual(simple(R.recordsSeance(evts, 'b')).map((x) => [x.type, x.valeur]), [['allure', 117.5]]);
  assert.deepEqual(simple(R.recordsSeance(evts, 'c')), []); // allure 120 et distance 1000 : rien de battu
});

test('records : les mouvements de WOD ne comptent pas pour les exercices, les scores de WOD oui', () => {
  const e = etat([
    seance('s', '2026-11-01', [['thruster', [serie(40, 5)]]]),
    wod('w1', '2026-11-02', { format: 'amrap', duree: 12, mouvements: [{ ex: 'thruster', reps: 10, charge: 60 }], score: { tours: 5, reps: 3 } }, { titre: 'Mon AMRAP' }),
    wod('w2', '2026-11-09', { format: 'amrap', duree: 12, mouvements: [{ ex: 'thruster', reps: 10, charge: 60 }], score: { tours: 6 } }, { titre: '  mon amrap ' }),
    wod('w3', '2026-11-10', { format: 'amrap', duree: 12, mouvements: [], score: { tours: 5 } }, { titre: 'Mon AMRAP' }),
    wod('w4', '2026-11-11', { format: 'amrap', duree: 12, mouvements: [] }, { titre: 'Mon AMRAP' }),
    wod('w5', '2026-11-12', { format: 'fortime', mouvements: [], score: { termine: true, temps: 400 } }, { titre: 'Mon AMRAP' }),
  ]);
  const evts = R.chronologieRecords(e, idx(e), REG);
  assert.ok(!evts.some((x) => x.ex === 'thruster' && x.seance !== 's'));
  assert.deepEqual(simple(R.recordsSeance(evts, 'w2')).map((x) => [x.type, x.valeur, x.ancien]), [['wod', '6 tours', '5 tours + 3 reps']]);
  assert.deepEqual(simple(R.recordsSeance(evts, 'w3')), []);
  assert.deepEqual(simple(R.recordsSeance(evts, 'w5')), []); // autre format : autre WOD, première fois
  assert.equal(R.cleWod(e.seances[1]), R.cleWod(e.seances[2]));
  assert.equal(R.historiqueWod(e, R.cleWod(e.seances[1])).length, 4); // la séance sans score compte dans l'historique
  assert.equal(R.cleWod({ modele: 'm-x', titre: 'peu importe' }), 'm:m-x');
});

test('progression : meilleure valeur par séance, séances sans valeur ignorées', () => {
  const e = etat([
    seance('s2', '2026-11-05', [['squat', [serie(100, 5), serie(110, 2)]]]),
    seance('s1', '2026-11-01', [['squat', [serie(90, 5)]]]),
    seance('s3', '2026-11-08', [['squat', [serie(60, 20)]]]),
    seance('s4', '2026-11-09', [['dev-couche', [serie(80, 5)]]]),
  ]);
  const p = simple(R.progression(e, idx(e), REG, 'squat'));
  assert.deepEqual(p.map((x) => [x.date, x.valeur]), [['2026-11-01', 105], ['2026-11-05', 117.33]]);
  assert.deepEqual(simple(R.progression(e, idx(e), REG, 'inconnu')), []);
  assert.deepEqual(simple(R.exercicesPratiques(e)), [{ ex: 'squat', seances: 3 }, { ex: 'dev-couche', seances: 1 }]);
});

test('volume par semaine et semaines d\'affilée', () => {
  const e = etat([
    seance('a', '2026-11-02', [['squat', [serie(100, 5)]]]),
    seance('b', '2026-11-04', [['dev-couche', [serie(80, 5), serie(80, 5)]]]),
    seance('c', '2026-11-10', [['squat', [serie(100, 5)]]]),
    seance('d', '2026-10-20', [['squat', [serie(100, 5)]]]),
    seance('futur', '2026-11-20', [['squat', [serie(100, 5)]]]),
  ]);
  const sem = R.volumeSemaines(e, idx(e), '2026-11-14', 4);
  assert.deepEqual(simple(sem.map((s) => s.lundi)), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
  assert.deepEqual(simple(sem.map((s) => s.tonnage)), [500, 0, 1300, 500]);
  assert.deepEqual(simple(sem.map((s) => s.seances)), [1, 0, 2, 1]);
  assert.equal(sem[2].groupes.pecs.series, 2);
  assert.equal(R.semainesAffilee(e, '2026-11-14'), 2);
  assert.equal(R.semainesAffilee(e, '2026-11-16'), 2); // semaine en cours vide : on part de la précédente
  assert.equal(R.semainesAffilee(e, '2026-11-25'), 3); // la séance du 20 compte une fois passée
  assert.equal(R.semainesAffilee(e, '2026-12-10'), 0);
  assert.equal(R.semainesAffilee(etat(), '2026-11-14'), 0);
});

test('minuteur AMRAP et For Time : préparation, compte, fin', () => {
  const p = R.planMinuteur({ format: 'amrap', duree: 600, prepa: 10 });
  assert.equal(p.total, 610000);
  assert.equal(p.tours, 1);
  assert.equal(R.etatMinuteur(p, 5000).phase, 'prepa');
  assert.equal(R.etatMinuteur(p, 5000).restant, 5000);
  const t = R.etatMinuteur(p, 70000);
  assert.equal(t.phase, 'travail');
  assert.equal(t.restant, 540000);
  assert.equal(t.ecoule, 60000);
  assert.ok(R.etatMinuteur(p, 610000).fini);
  const f = R.planMinuteur({ format: 'fortime', cap: 900, prepa: 0 });
  assert.ok(f.croissant);
  assert.equal(R.etatMinuteur(f, 120000).ecoule, 120000);
  assert.ok(R.etatMinuteur(f, 900000).fini);
  const sansLimite = R.planMinuteur({ format: 'fortime', prepa: 0 });
  assert.equal(sansLimite.total, Infinity);
  assert.ok(!R.etatMinuteur(sansLimite, 1e9).fini);
  const chrono = R.planMinuteur({ format: 'chrono', prepa: 3 });
  assert.equal(R.etatMinuteur(chrono, 13000).ecoule, 10000);
  assert.equal(R.bips(chrono, 20000, 21000), null);
});

test('minuteur EMOM et intervalles : tours, repos, bips', () => {
  const e = R.planMinuteur({ format: 'emom', duree: 600, prepa: 10 });
  assert.equal(e.tours, 10);
  assert.equal(R.etatMinuteur(e, 10000).tour, 1);
  assert.equal(R.etatMinuteur(e, 70000).tour, 2);
  assert.equal(R.etatMinuteur(e, 609999).tour, 10);
  const e90 = R.planMinuteur({ format: 'emom', duree: 600, intervalle: 90, prepa: 0 });
  assert.equal(e90.tours, 7); // 6 × 1 min 30 + une dernière de 1 min
  assert.equal(e90.segments.at(-1).fin - e90.segments.at(-1).debut, 60000);
  const i = R.planMinuteur({ format: 'intervalles', travail: 20, repos: 10, tours: 8, prepa: 10 });
  assert.equal(i.tours, 8);
  assert.equal(i.total, 10000 + 8 * 20000 + 7 * 10000); // pas de repos après le dernier tour
  assert.equal(R.etatMinuteur(i, 31000).phase, 'repos');
  assert.equal(R.etatMinuteur(i, 31000).tour, 1);
  assert.equal(R.etatMinuteur(i, 41000).phase, 'travail');
  assert.equal(R.etatMinuteur(i, 41000).tour, 2);
  assert.equal(R.bips(i, 9900, 10100), 'fin');
  assert.equal(R.bips(i, 26900, 27100), 'compte');
  assert.equal(R.bips(i, 20000, 20500), null);
  assert.equal(R.bips(i, 239000, 241000), 'fin');
  const sansRepos = R.planMinuteur({ format: 'intervalles', travail: 30, repos: 0, tours: 3, prepa: 0 });
  assert.equal(sansRepos.segments.length, 3);
});

test('normalisation tolérante, modèles et séances', () => {
  const n = R.normaliser({ reglages: { unite: 'oz', formule: 'magique', repsMax: 99 }, seances: [{ date: 'hier', type: 'bizarre', exercices: [{ ex: 'squat', series: [{ charge: '62,5', reps: '5', rpe: '8,3' }, { charge: -3, reps: 'x', rpe: 0 }] }] }, { type: 'wod', wod: { format: 'inconnu', mouvements: [{ ex: 'burpees', reps: '10' }], score: { tours: '4' } } }], exercicesPerso: [{ nom: '', groupe: 'nulle-part', mesure: 'poids' }], modeles: null }, DEFAUTS);
  assert.deepEqual(simple(n.reglages), { unite: 'kg', formule: 'epley', repsMax: 10 });
  const s = n.seances[0];
  assert.equal(s.type, 'series');
  assert.ok(R.estDate(s.date));
  assert.deepEqual(simple(s.exercices[0].series[0]), { charge: 62.5, reps: 5, temps: null, distance: null, calories: null, rpe: 8.5 });
  assert.deepEqual(simple(s.exercices[0].series[1]), { charge: null, reps: null, temps: null, distance: null, calories: null, rpe: null });
  assert.equal(n.seances[1].wod.format, 'amrap');
  assert.equal(n.seances[1].wod.mouvements[0].reps, 10);
  assert.equal(n.seances[1].wod.score.tours, 4);
  assert.equal(n.seances[1].exercices.length, 0);
  assert.deepEqual(simple(n.exercicesPerso[0]).nom, 'Exercice');
  assert.equal(n.exercicesPerso[0].groupe, 'pecs');
  assert.equal(n.exercicesPerso[0].mesure, 'charge');
  assert.deepEqual(simple(n.modeles), []);
  assert.deepEqual(simple(R.normaliser(null, DEFAUTS).seances), []);
  const m = R.modeleDeBase(BASE.modeles.find((x) => x.id === 'm-amrap-12'));
  const sd = R.seanceDepuisModele(m, '2026-11-14');
  assert.equal(sd.date, '2026-11-14');
  assert.equal(sd.modele, 'm-amrap-12');
  assert.equal(sd.titre, m.nom);
  assert.notEqual(sd.id, m.id);
  assert.notEqual(sd.wod.mouvements[0].id, m.wod.mouvements[0].id);
  sd.wod.score.tours = 7;
  const md = R.modeleDepuisSeance(sd, 'Copie');
  assert.equal(md.nom, 'Copie');
  assert.equal(md.wod.score.tours, null); // le score n'est pas gardé dans un modèle
  assert.equal(m.wod.score.tours, null); // le modèle d'origine n'a pas été modifié
});

test('exercices personnels : index, utilisations', () => {
  const e = etat([seance('s', '2026-11-01', [['p-presse-maison', [serie(50, 10)]]])], { exercicesPerso: [{ id: 'p-presse-maison', nom: 'Presse maison', groupe: 'quadri', mesure: 'charge' }] });
  const i = idx(e);
  assert.equal(i.get('p-presse-maison').perso, true);
  assert.equal(i.size, 151);
  assert.equal(R.volumeSeance(e.seances[0], i).groupes.quadri.tonnage, 500);
  assert.equal(R.utilisations(e, 'p-presse-maison'), 1);
  assert.equal(R.utilisations(e, 'squat'), 0);
  const ex = R.normaliserExercice({ nom: 'Course en côte', groupe: 'cardio', mesure: 'distance', allure: 777 }, BASE.groupes.map((g) => g.id));
  assert.equal(ex.allure, 1000);
  assert.ok(ex.id.startsWith('p-'));
});

test('export CSV : BOM, séparateur, 1RM et score de WOD', () => {
  const e = etat([
    seance('s', '2026-11-01', [['squat', [serie(100, 5, { rpe: 8 })]]], { titre: 'Jambes; lourd' }),
    wod('w', '2026-11-02', { format: 'amrap', duree: 12, mouvements: [{ ex: 'burpees', reps: 10 }, { ex: 'thruster', reps: 5, charge: 40 }], score: { tours: 5 } }, { titre: 'AMRAP' }),
  ]);
  const csv = R.versCsv(e, BASE);
  assert.ok(csv.startsWith('﻿Date;Séance;'));
  const lignes = csv.slice(1).split('\r\n');
  assert.equal(lignes.length, 4);
  assert.equal(lignes[1], '2026-11-01;"Jambes; lourd";Séries;Squat arrière;Quadriceps;1;100;5;;;;8;116,67;');
  assert.ok(lignes[2].endsWith(';5 tours'));
  assert.ok(lignes[3].endsWith(';'));
});
