// Tests des règles métier du plan d'entraînement course à pied (templates/course-a-pied/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/course-a-pied/', import.meta.url);
const ctx = { window: {}, structuredClone, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CRS;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const REF10 = { date: '2026-10-01', km: 10, temps: 50 * 60 };
const base = (extra = {}) => ({ distance: 'semi', dateCourse: '2027-02-21', debut: '2026-11-30', seancesSemaine: 4, jours: [1, 3, 5, 6], jourLongue: 6, ...extra });

test('base intégrée : plans de 8, 12 et 16 semaines, 5 séances par semaine, toutes définies', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(B.plans).map(([k, p]) => [k, p.length])), { '10k': 8, semi: 12, marathon: 16 });
  for (const [k, plan] of Object.entries(B.plans)) {
    assert.equal(plan.length, B.distances[k].semaines, k);
    assert.equal(plan.at(-1).phase, 'course', k);
    assert.equal(plan.at(-2).phase, 'affutage', k);
    plan.forEach((w, i) => {
      assert.equal(w.s.length, 5, `${k} semaine ${i + 1}`);
      assert.ok(B.phases[w.phase], w.phase);
      for (const c of w.s) assert.ok(B.seances[c], `${k} : séance ${c}`);
      if (i < plan.length - 1) {
        assert.equal(B.seances[w.s[1]].type, 'longue', `${k} semaine ${i + 1} : la 2e séance est la sortie longue`);
        // 1re séance : de qualité, sauf en début de foncier ou en semaine d'assimilation (footing et accélérations).
        assert.ok(B.types[B.seances[w.s[0]].type].qualite || ((w.phase === 'foncier' || w.allegee) && w.s[0].startsWith('fa')), `${k} semaine ${i + 1} : la 1re séance est une séance de qualité`);
        assert.ok(w.s.slice(0, 4).some((c) => B.types[B.seances[c].type].qualite), `${k} semaine ${i + 1} : une séance de qualité dès 4 séances`);
      }
    });
  }
  for (const [id, s] of Object.entries(B.seances)) {
    assert.ok(B.types[s.type], id);
    for (const b of s.blocs) if (!b.course) assert.ok(B.allures[b.a], `${id} : allure ${b.a}`);
  }
});

test('base intégrée : aucun nom de marque ni de plan commercial, sources citées', () => {
  const tout = JSON.stringify(B).toLowerCase();
  for (const interdit of ['vdot', 'daniels', 'garmin', 'strava', 'polar', 'suunto', 'nike', 'adidas', 'asics', 'hanson', 'pfitzinger', 'galloway', 'higdon', 'coros', 'runna']) {
    assert.ok(!tout.includes(interdit), interdit);
  }
  assert.ok(B.sources.some(([l, s]) => /riegel/i.test(l) && /American Scientist/.test(s) && /1981/.test(s) && /vérifiée le \d{2}\/\d{2}\/\d{4}/.test(s)));
});

test('durées : chronos et durées saisis en h:min:s, min:s, minutes ou « 1h45 »', () => {
  assert.equal(R.lireDuree('50:00'), 3000);
  assert.equal(R.lireDuree('1:52:30'), 6750);
  assert.equal(R.lireDuree('1h45'), 6300);
  assert.equal(R.lireDuree('1h45m30'), 6330);
  assert.equal(R.lireDuree('45'), 2700);
  assert.equal(R.lireDuree('3:61'), null);
  assert.equal(R.lireDuree('abc'), null);
  assert.equal(R.formatDuree(6750), '1:52:30');
  assert.equal(R.formatAllure(299.6), '5:00');
  assert.equal(R.formatMinutes(95), '1 h 35');
});

test('formule de Riegel : temps prédits, réciproque et exposant réglable', () => {
  // 10 km en 50:00 → semi ≈ 1:50:19, marathon ≈ 3:50:00 environ.
  const semi = R.riegel(3000, 10, 21.0975);
  assert.ok(Math.abs(semi - 6619) < 3, String(semi));
  assert.ok(Math.abs(R.riegel(3000, 10, 42.195) - 3000 * 4.2195 ** 1.06) < 1e-6);
  assert.ok(R.riegel(3000, 10, 42.195, 1.1) > R.riegel(3000, 10, 42.195, 1.06));
  assert.ok(Math.abs(R.riegel(3000, 10, 10) - 3000) < 1e-9);
  // Distance couverte en une heure, réciproque de la formule.
  const d = R.distancePourTemps(3000, 10, 3600);
  assert.ok(Math.abs(R.riegel(3000, 10, d) - 3600) < 1e-6);
  const p = R.predictions(REF10, B.predictions);
  assert.equal(p.length, 5);
  assert.ok(p.find((x) => x.km === 10).reference);
  assert.ok(p.every((x, i) => i === 0 || x.allure > p[i - 1].allure), 'allure plus lente sur plus long');
});

test('allures d\'entraînement : ordre cohérent des fourchettes', () => {
  const A = R.calculerAllures(REF10, { km: 21.0975, temps: 6600 }, B);
  const f = A.fourchettes;
  for (const c of Object.keys(f)) assert.ok(f[c].lent >= f[c].rapide, c);
  // Du plus lent au plus rapide : récupération, footing, sortie longue, seuil, allure 5 km.
  assert.ok(f.recup.milieu > f.footing.milieu && f.footing.milieu > f.longue.milieu && f.longue.milieu > f.seuil.milieu && f.seuil.milieu > f.frac.milieu);
  // Allure 5 km plus rapide que l'allure 10 km de la référence ; seuil (course d'une heure) un peu plus lent.
  assert.ok(A.bases.c5 < 300 && A.bases.h > 300);
  assert.equal(Math.round(A.bases.objectif * 21.0975), 6600);
  // Sans temps visé : l'allure spécifique est l'allure prédite.
  const B2 = R.calculerAllures(REF10, { km: 21.0975, temps: null }, B);
  assert.ok(Math.abs(B2.tempsObjectif - B2.tempsPredit) < 1e-9);
  // La référence la plus récente l'emporte.
  assert.equal(R.referenceCourante([REF10, { date: '2026-11-01', km: 5, temps: 1400 }, { date: '2026-09-01', km: 21.0975, temps: 7000 }]).km, 5);
  assert.equal(R.referenceCourante([]), null);
});

test('avis sur l\'objectif et avertissements sur la référence', () => {
  assert.equal(R.avisObjectif(6000, 6600).niveau, 'tres-ambitieux');
  assert.equal(R.avisObjectif(6450, 6600).niveau, 'ambitieux');
  assert.equal(R.avisObjectif(6650, 6600).niveau, 'realiste');
  assert.equal(R.avisObjectif(7200, 6600).niveau, 'prudent');
  assert.equal(R.avisObjectif(null, 6600), null);
  assert.deepEqual(simple(R.avertissementsReference({ date: '2026-01-01', km: 5, temps: 1500 }, 42.195, '2026-11-14')), ['ancien', 'extrapolation']);
  assert.deepEqual(simple(R.avertissementsReference(REF10, 21.0975, '2026-11-14')), []);
});

test('placement d\'une semaine : sortie longue sur son jour, qualité loin d\'elle et jamais deux jours de suite si possible', () => {
  const w = B.plans.semi[5].s; // i6x1000, l80, f45, s2x15, f45
  const p4 = simple(R.placerSemaine(w.slice(0, 4), [1, 3, 5, 6], 6, B));
  assert.deepEqual(p4.map((x) => [x.jour, B.seances[x.code].type]), [[1, 'seuil'], [3, 'frac'], [5, 'footing'], [6, 'longue']]);
  const p3 = simple(R.placerSemaine(w.slice(0, 3), [1, 3, 6], 6, B));
  assert.deepEqual(p3.map((x) => x.jour), [1, 3, 6]);
  assert.equal(B.seances[p3.find((x) => x.jour === 3).code].type, 'frac', 'qualité le plus loin de la sortie longue');
  assert.equal(B.seances[p3.find((x) => x.jour === 1).code].type, 'footing');
  const p5 = simple(R.placerSemaine(w, [0, 1, 2, 4, 6], 6, B));
  const q = p5.filter((x) => B.types[B.seances[x.code].type].qualite).map((x) => x.jour);
  assert.equal(q.length, 2);
  assert.ok(Math.abs(q[0] - q[1]) > 1, `qualité ${q}`);
  assert.equal(p5.find((x) => x.jour === 6).code, 'l80');
});

test('génération : plan complet jusqu\'à la course, semaine de course sans séance après le jour J', () => {
  const g = R.genererPlan(base({ debut: '2026-11-30' }), B);
  assert.equal(g.semaines.length, 12);
  assert.equal(g.raccourci, 0);
  assert.equal(g.seances.length, 11 * 4 + 4); // 3 séances avant la course + la course
  const c = g.seances.filter((s) => s.code === 'course');
  assert.equal(c.length, 1);
  assert.equal(c[0].date, '2027-02-21');
  assert.ok(g.seances.every((s) => s.date <= '2027-02-21' && s.date >= '2026-11-30'));
  assert.equal(new Set(g.seances.map((s) => s.date)).size, g.seances.length, 'une séance par jour au plus');
  assert.ok(g.seances.every((s) => [1, 3, 5, 6].includes(R.jourSemaine(s.date))));
  // Semaine de la course : l'activation est la séance la plus proche avant la course.
  const avant = g.seances.filter((s) => s.date >= '2027-02-15' && s.code !== 'course');
  assert.equal(avant.at(-1).code, 'act');
  // Marathon à 3 séances et 10 km à 5 séances.
  assert.equal(R.genererPlan(base({ distance: 'marathon', dateCourse: '2027-03-21', debut: '2026-11-30', seancesSemaine: 3, jours: [1, 3, 6] }), B).semaines.length, 16);
  assert.equal(R.genererPlan(base({ distance: '10k', dateCourse: '2027-01-24', debut: '2026-11-30', seancesSemaine: 5, jours: [0, 1, 3, 5, 6] }), B).seances.length, 7 * 5 + 5);
});

test('génération : course proche (plan raccourci), trop proche ou lointaine, saisies invalides', () => {
  const g = R.genererPlan(base({ debut: '2026-12-28' }), B); // 8 semaines avant la course
  assert.equal(g.semaines.length, 8);
  assert.equal(g.raccourci, 4);
  assert.equal(g.semaines[0].numero, 5);
  assert.throws(() => R.genererPlan(base({ debut: '2027-02-10' }), B), /trop proche/);
  assert.throws(() => R.genererPlan(base({ debut: '2027-03-01' }), B), /après le début/);
  assert.throws(() => R.genererPlan(base({ jours: [1, 3, 5] }), B), /4 jours/);
  assert.throws(() => R.genererPlan(base({ seancesSemaine: 6, jours: [0, 1, 2, 3, 4, 5] }), B), /3 à 5/);
  const loin = R.genererPlan(base({ debut: '2026-09-01' }), B);
  assert.ok(loin.attente > 60);
  assert.equal(loin.seances[0].date >= '2026-11-30', true);
  // Début en milieu de semaine : rien avant le début.
  const milieu = R.genererPlan(base({ debut: '2026-12-03' }), B);
  assert.ok(milieu.seances.every((s) => s.date >= '2026-12-03'));
});

test('séances : durée et distance estimées, volume et allègement', () => {
  const A = R.calculerAllures(REF10, { km: 21.0975, temps: 6600 }, B);
  const f40 = R.blocsEffectifs(B.seances.f40, {});
  const d = R.dureeKm(f40, A);
  assert.equal(d.min, 40);
  assert.ok(Math.abs(d.km - 40 * 60 / A.fourchettes.footing.milieu) < 1e-9);
  // Fractionné : 15 min + 6 × 800 m + 5 récupérations de 2 min + 10 min.
  const i = R.dureeKm(R.blocsEffectifs(B.seances.i6x800, {}), A);
  assert.ok(Math.abs(i.min - (25 + 10 + 4.8 * A.fourchettes.frac.milieu / 60)) < 1e-9);
  // Volume soutenu : footings et sorties longues allongés, séances de qualité inchangées.
  assert.equal(R.blocsEffectifs(B.seances.l90, { volume: 1.15 })[0].m, 105);
  assert.deepEqual(simple(R.blocsEffectifs(B.seances.s3x10, { volume: 1.15 })), simple(B.seances.s3x10.blocs));
  // Allègement : footings × 0,7, fractions × 0,6, échauffement gardé.
  assert.equal(R.blocsEffectifs(B.seances.l90, { allegee: true })[0].m, 65);
  const s = R.blocsEffectifs(B.seances.s3x10, { allegee: true });
  assert.equal(s[1].n, 2);
  assert.equal(s[0].m, 15);
  assert.equal(R.blocsEffectifs(B.seances.p12k, { allegee: true })[1].d, 7000);
  assert.equal(R.blocsEffectifs(B.seances['ls110-30'], { allegee: true })[1].m, 20);
  assert.equal(R.titreSeance(B.seances.i8x400, R.blocsEffectifs(B.seances.i8x400, { allegee: true })), 'Fractionné 5 × 400 m');
  assert.equal(R.titreSeance(B.seances.fa40, R.blocsEffectifs(B.seances.fa40, {})), 'Footing 40 min et accélérations');
  // La course : distance de l'objectif au temps visé.
  const c = R.dureeKm(B.seances.course.blocs, A);
  assert.equal(Math.round(c.min), 110);
  assert.equal(c.km, 21.0975);
  assert.match(R.texteBloc(B.seances.s3x10.blocs[1], A, B), /^3 × 10 min seuil \(\d:\d\d–\d:\d\d \/km\), récupération 2 min en trottinant$/);
});

test('bilan par semaine, situation des séances et suggestions d\'allègement', () => {
  const g = R.genererPlan(base(), B);
  const plan = R.normaliserPlan({ ...base(), seances: g.seances }, B);
  const A = R.calculerAllures(REF10, { km: 21.0975, temps: 6600 }, B);
  const premieres = plan.seances.slice(0, 4);
  premieres.forEach((s, i) => { s.statut = 'faite'; s.kmReel = 8; s.ressenti = i === 0 ? 2 : 4; });
  const bilan = R.bilanSemaines(plan, B, A, {});
  assert.equal(bilan.length, 12);
  assert.equal(bilan[0].faites, 4);
  assert.equal(bilan[0].kmFait, 32);
  assert.equal(bilan[0].ressentiMoyen, 3.5);
  assert.ok(bilan[3].allegeePlan);
  const aujourdhui = R.ajout(premieres[3].date, 1);
  assert.equal(R.situation(plan.seances[0], aujourdhui), 'faite');
  assert.equal(R.situation(plan.seances[4], plan.seances[4].date), 'aujourdhui');
  // Trois séances dures sur les quatre dernières : alléger.
  const sg = R.suggestions(plan, B, aujourdhui);
  assert.equal(sg[0].type, 'fatigue');
  // Une fois la semaine allégée, plus de suggestion ; la semaine allégée compte moins de kilomètres.
  const avant = bilan.find((w) => w.lundi === sg[0].lundi).kmPrevu;
  plan.semainesAllegees.push(sg[0].lundi);
  assert.equal(R.suggestions(plan, B, aujourdhui).filter((x) => x.type === 'fatigue').length, 0);
  assert.ok(R.bilanSemaines(plan, B, A, {}).find((w) => w.lundi === sg[0].lundi).kmPrevu < avant * 0.8);
  // Deux séances manquées en une semaine : conseil de ne pas rattraper.
  plan.seances[4].statut = 'manquee'; plan.seances[5].statut = 'manquee';
  assert.ok(R.suggestions(plan, B, plan.seances[5].date).some((x) => x.type === 'manquees' && x.nombre === 2));
});

test('déplacer une séance : jours libres de la semaine, avertissements, jamais après la course', () => {
  const plan = R.normaliserPlan({ ...base(), seances: R.genererPlan(base(), B).seances }, B);
  const q = plan.seances.find((s) => s.date >= '2026-12-07' && B.types[B.seances[s.code].type].qualite);
  const libres = R.joursLibres(plan, q, '2026-11-30');
  assert.ok(libres.length >= 2);
  assert.ok(libres.every((d) => R.lundi(d) === R.lundi(q.date) && !plan.seances.some((x) => x.date === d)));
  const autreQ = plan.seances.find((s) => s !== q && R.lundi(s.date) === R.lundi(q.date) && B.types[B.seances[s.code].type].qualite);
  const v = R.verifierDeplacement(plan, q, R.ajout(autreQ.date, -1), B);
  assert.equal(v.erreur, null);
  assert.ok(v.avertissements.includes('qualite-voisine'));
  const longue = plan.seances.find((s) => R.lundi(s.date) === R.lundi(q.date) && B.seances[s.code].type === 'longue');
  assert.ok(R.verifierDeplacement(plan, q, R.ajout(longue.date, -1), B).avertissements.includes('veille-longue'));
  assert.ok(R.verifierDeplacement(plan, q, R.ajout(q.date, 7), B).avertissements.includes('autre-semaine'));
  assert.match(R.verifierDeplacement(plan, q, '2027-02-21', B).erreur, /jour de la course/);
  assert.match(R.verifierDeplacement(plan, plan.seances.at(-1), '2027-02-20', B).erreur, /course se déplace/);
});

test('recalcul : séances à venir régénérées, séances cochées et passées gardées', () => {
  const plan = R.normaliserPlan({ ...base(), seances: R.genererPlan(base(), B).seances }, B);
  plan.seances.slice(0, 6).forEach((s) => { s.statut = 'faite'; s.kmReel = 7; });
  const aujourdhui = R.ajout(plan.seances[5].date, 1);
  const n = R.regenerer({ ...plan, seancesSemaine: 3, jours: [2, 4, 6] }, B, aujourdhui);
  assert.equal(n.seances.filter((s) => s.statut === 'faite').length, 6);
  assert.ok(n.seances.filter((s) => s.date >= aujourdhui).every((s) => [2, 4, 6].includes(R.jourSemaine(s.date))));
  assert.equal(n.seances.filter((s) => s.code === 'course').length, 1);
  // Nouvelle date de course : la course suit.
  const m = R.regenerer({ ...plan, dateCourse: '2027-02-28' }, B, aujourdhui);
  assert.equal(m.seances.find((s) => s.code === 'course').date, '2027-02-28');
});

test('normalisation tolérante et exports CSV et iCalendar', () => {
  const e = R.normaliser({ references: [{ km: 10, temps: 3000, date: '2026-10-01' }, null], plan: { distance: 'xx', jours: [1, 1, 9, 3], seances: [{ statut: 'bizarre', ressenti: 7 }] }, reglages: { exposant: 3 } }, B);
  assert.equal(e.references.length, 2);
  assert.equal(e.plan.distance, 'semi');
  assert.deepEqual(simple(e.plan.jours), [1, 3]);
  assert.equal(e.plan.seances[0].statut, 'prevue');
  assert.equal(e.plan.seances[0].ressenti, null);
  assert.equal(e.reglages.exposant, 1.06);
  assert.equal(R.normaliser(null, B).plan, null);
  const plan = R.normaliserPlan({ ...base(), seances: R.genererPlan(base(), B).seances }, B);
  plan.seances[0].statut = 'faite'; plan.seances[0].kmReel = 9.5; plan.seances[0].dureeReel = 2850; plan.seances[0].ressenti = 3; plan.seances[0].note = 'Vent; pluie';
  const A = R.calculerAllures(REF10, { km: 21.0975, temps: null }, B);
  const csv = R.versCsv(plan, B, A, {});
  const lignes = csv.replace('﻿', '').split('\r\n');
  assert.equal(lignes.length, plan.seances.length + 1);
  assert.match(lignes[1], /;Faite;9,5;47:30;5:00;Correct;"Vent; pluie"$/);
  const ics = R.versIcs(plan, B, A, {}, '2026-11-14T10:00:00.000Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, plan.seances.length);
  assert.ok(ics.includes('DTSTAMP:20261114T100000Z'));
  assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'lignes pliées à 75 octets');
  assert.ok(/SUMMARY:Course à pied · /.test(ics));
  assert.equal(R.plier('x'.repeat(80)), 'x'.repeat(75) + '\r\n ' + 'x'.repeat(5));
});
