// Règles métier du template « Planning Gantt rapide » (templates/gantt/regles.js et donnees.js).
// Les cas de chemin critique sont calculés à la main (commentaires) avant d'être vérifiés ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/gantt/', import.meta.url);
const fenetre = {};
vm.runInNewContext(readFileSync(new URL('regles.js', dossier), 'utf8'), { window: fenetre });
vm.runInNewContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), { window: fenetre });
const R = fenetre.REGLES;
const B = fenetre.BASE;
const js = (x) => JSON.parse(JSON.stringify(x));

// Calendrier en jours calendaires : index = jours depuis l'origine ; on travaille en relatif au lundi 4 janvier 2027.
const CAL = R.calendrier({ ouvres: false });
const D0 = '2027-01-04';
const I0 = CAL.idx(D0);
const t = (id, duree, deps = [], debut = null) => ({ id, duree, debut, deps: deps.map(([p, type = 'FD', decalage = 0]) => ({ id: p, type, decalage })) });
const rel = (o) => {
  const r = {};
  for (const [id, x] of o.taches) r[id] = { es: x.es - I0, ef: x.ef - I0, ls: x.ls - I0, lf: x.lf - I0, mt: x.margeTotale, ml: x.margeLibre, c: x.critique };
  return r;
};

test('Pâques : dates connues', () => {
  assert.equal(R.paques(2024), '2024-03-31');
  assert.equal(R.paques(2025), '2025-04-20');
  assert.equal(R.paques(2026), '2026-04-05');
  assert.equal(R.paques(2027), '2027-03-28');
  assert.equal(R.paques(2038), '2038-04-25');
  assert.equal(R.paques(2285), '2285-03-22');
});

test('fériés 2026 et 2027 conformes à service-public.gouv.fr', () => {
  assert.deepEqual(js(R.feries(2026).map((f) => f.date)), ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']);
  assert.deepEqual(js(R.feries(2027).map((f) => f.date)), ['2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-08', '2027-05-17', '2027-07-14', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25']);
  const alsace = R.feries(2026, true).map((f) => f.date);
  assert.equal(alsace.length, 13);
  assert.ok(alsace.includes('2026-04-03')); // Vendredi saint
  assert.ok(alsace.includes('2026-12-26'));
  assert.ok(alsace.includes('2027-03-26') === false);
  assert.ok(R.feries(2027, true).some((f) => f.date === '2027-03-26'));
});

test('jours ouvrés : week-ends et fériés sautés', () => {
  const c = R.calendrier({ ouvres: true });
  // Vendredi 6/11/2026 + 3 jours ouvrés : ven 6, lun 9, mar 10.
  assert.equal(R.finTache('2026-11-06', 3, c), '2026-11-10');
  // 4 jours : le mercredi 11/11 est férié → jeudi 12.
  assert.equal(R.finTache('2026-11-06', 4, c), '2026-11-12');
  // Un début un samedi part le lundi.
  assert.equal(c.date(c.idx('2026-11-07')), '2026-11-09');
  // Semaine de l'Ascension 2026 (jeudi 14/05) : lun 11 → 5 jours ouvrés finissent le lundi 18.
  assert.equal(R.finTache('2026-05-11', 5, c), '2026-05-18');
  // Fin d'année : 24/12/2026 (jeudi) + 3 j → 24, 28, 29 (25 férié, 26-27 week-end).
  assert.equal(R.finTache('2026-12-24', 3, c), '2026-12-29');
  // Alsace-Moselle : le 26/12/2025 (vendredi) est férié.
  const ca = R.calendrier({ ouvres: true, alsace: true });
  assert.equal(R.finTache('2025-12-24', 2, ca), '2025-12-29');
  assert.equal(R.finTache('2025-12-24', 2, c), '2025-12-26');
  // Aller-retour index ↔ date sur 12 ans.
  for (let i = c.idx('2020-01-01'); i < c.idx('2032-01-01'); i++) assert.equal(c.idx(c.date(i)), i);
  // En jours calendaires, rien n'est sauté.
  assert.equal(R.finTache('2026-11-06', 4, CAL), '2026-11-09');
});

test('semaine ISO', () => {
  assert.equal(R.semaineIso('2026-11-12'), 46);
  assert.equal(R.semaineIso('2027-01-01'), 53);
  assert.equal(R.semaineIso('2027-01-04'), 1);
  assert.equal(R.semaineIso('2026-01-01'), 1);
});

test('CPM cas 1 (fin → début) : A3, B2 et C4 après A, D2 après B et C', () => {
  // À la main : A [0,3[ ; B [3,5[ ; C [3,7[ ; D [7,9[ ; fin du projet 9.
  // Retour : D LF 9 LS 7 ; B LF 7 LS 5 (marge totale 2, libre 7-5 = 2) ; C LF 7 LS 3 (0) ; A LF min(5,3) = 3 (0).
  const o = R.ordonnancer([t('A', 3), t('B', 2, [['A']]), t('C', 4, [['A']]), t('D', 2, [['B'], ['C']])], CAL, D0);
  const r = rel(o);
  assert.deepEqual(r.A, { es: 0, ef: 3, ls: 0, lf: 3, mt: 0, ml: 0, c: true });
  assert.deepEqual(r.B, { es: 3, ef: 5, ls: 5, lf: 7, mt: 2, ml: 2, c: false });
  assert.deepEqual(r.C, { es: 3, ef: 7, ls: 3, lf: 7, mt: 0, ml: 0, c: true });
  assert.deepEqual(r.D, { es: 7, ef: 9, ls: 7, lf: 9, mt: 0, ml: 0, c: true });
  assert.equal(o.fin - I0, 9);
  assert.equal(o.taches.get('D').fin, '2027-01-12'); // 4 + 9 - 1
});

test('CPM cas 2 : les quatre types de liens avec décalage', () => {
  // A5 ; B3 DD+2 de A → es 2, ef 5 ; C4 FF+1 de A → ef ≥ 6 → es 2 ; D2 FD de B et C → es 6, ef 8 ;
  // E1 DF+3 de A → ef ≥ 0+3 → es 2, ef 3. Fin du projet 8.
  // Retour : D LF 8 LS 6. B : LF ≤ 6 → LS 3, marge totale 1, libre 6-5 = 1. C : LF 6 LS 2 → 0.
  // E : sans successeur, LF 8, LS 7, marge totale 5, libre 8-3 = 5.
  // A : via B (DD+2) LF ≤ 3-2+5 = 6 ; via C (FF+1) LF ≤ 6-1 = 5 ; via E (DF+3) LF ≤ 8-3+5 = 10 → LF 5, LS 0, marge 0.
  // Marge libre de A : B 2-(0+2) = 0 ; C 6-(5+1) = 0 ; E 3-(0+3) = 0 → 0.
  const o = R.ordonnancer([
    t('A', 5), t('B', 3, [['A', 'DD', 2]]), t('C', 4, [['A', 'FF', 1]]), t('D', 2, [['B'], ['C']]), t('E', 1, [['A', 'DF', 3]]),
  ], CAL, D0);
  const r = rel(o);
  assert.deepEqual(r.A, { es: 0, ef: 5, ls: 0, lf: 5, mt: 0, ml: 0, c: true });
  assert.deepEqual(r.B, { es: 2, ef: 5, ls: 3, lf: 6, mt: 1, ml: 1, c: false });
  assert.deepEqual(r.C, { es: 2, ef: 6, ls: 2, lf: 6, mt: 0, ml: 0, c: true });
  assert.deepEqual(r.D, { es: 6, ef: 8, ls: 6, lf: 8, mt: 0, ml: 0, c: true });
  assert.deepEqual(r.E, { es: 2, ef: 3, ls: 7, lf: 8, mt: 5, ml: 5, c: false });
});

test('CPM cas 3 : chevauchement (FD-2), jalon et contrainte « pas avant le »', () => {
  // A4 ; B3 FD-2 de A → es 2, ef 5 ; J jalon après B → es = ef = 5 ;
  // C2 sans lien mais « pas avant » J+6 → es 6, ef 8. Fin 8.
  // Retour : C LF 8 LS 6 (0, critique : sa contrainte fixe la fin) ; J LF 8 LS 8 marge 3 ; B LF 8 LS 5 marge 3, libre 5-5 = 0 ;
  // A : via B FD-2 → LF ≤ 5+2 = 7, LS 3, marge 3 ; libre 2-(4-2) = 0.
  const o = R.ordonnancer([t('A', 4), t('B', 3, [['A', 'FD', -2]]), t('J', 0, [['B']]), t('C', 2, [], R.ajout(D0, 6))], CAL, D0);
  const r = rel(o);
  assert.deepEqual(r.A, { es: 0, ef: 4, ls: 3, lf: 7, mt: 3, ml: 0, c: false });
  assert.deepEqual(r.B, { es: 2, ef: 5, ls: 5, lf: 8, mt: 3, ml: 0, c: false });
  assert.deepEqual(r.J, { es: 5, ef: 5, ls: 8, lf: 8, mt: 3, ml: 3, c: false });
  assert.deepEqual(r.C, { es: 6, ef: 8, ls: 6, lf: 8, mt: 0, ml: 0, c: true });
  assert.equal(o.taches.get('J').debut, o.taches.get('J').fin);
});

test('CPM cas 4 : réseau de 7 tâches (exemple de cours), dates en jours ouvrés', () => {
  // A2 ; B4 après A ; C3 après A ; D5 après B ; E2 après B et C ; F3 après E ; G1 après D et F.
  // Aller : A 0-2 ; B 2-6 ; C 2-5 ; D 6-11 ; E 6-8 ; F 8-11 ; G 11-12.
  // Retour : G 11-12 ; F LF 11 LS 8 ; D LF 11 LS 6 ; E LF 8 LS 6 ; C LF 6 LS 3 (marge 1, libre 6-5 = 1) ;
  // B LF min(6, 6) = 6 LS 2 ; A LF min(2, 3) = 2 LS 0. Critiques : A, B, D, E, F, G (deux chemins critiques).
  const c = R.calendrier({ ouvres: true });
  const lundi = '2026-11-09';
  const o = R.ordonnancer([
    t('A', 2), t('B', 4, [['A']]), t('C', 3, [['A']]), t('D', 5, [['B']]), t('E', 2, [['B'], ['C']]), t('F', 3, [['E']]), t('G', 1, [['D'], ['F']]),
  ], c, lundi);
  const i0 = c.idx(lundi);
  const m = (id) => { const x = o.taches.get(id); return [x.es - i0, x.ef - i0, x.margeTotale, x.margeLibre]; };
  assert.deepEqual(js(m('A')), [0, 2, 0, 0]);
  assert.deepEqual(js(m('B')), [2, 6, 0, 0]);
  assert.deepEqual(js(m('C')), [2, 5, 1, 1]);
  assert.deepEqual(js(m('D')), [6, 11, 0, 0]);
  assert.deepEqual(js(m('E')), [6, 8, 0, 0]);
  assert.deepEqual(js(m('F')), [8, 11, 0, 0]);
  assert.deepEqual(js(m('G')), [11, 12, 0, 0]);
  // Dates : lun 9/11 ; le mer 11/11 est férié. A = 9-10 ; B = 12, 13, 16, 17 ; G = 12e jour ouvré = mar 24/11.
  assert.equal(o.taches.get('A').fin, '2026-11-10');
  assert.equal(o.taches.get('B').debut, '2026-11-12');
  assert.equal(o.taches.get('B').fin, '2026-11-17');
  assert.equal(o.taches.get('G').debut, '2026-11-25');
  assert.equal(o.taches.get('C').debutTard, '2026-11-13');
});

test('boucles : refusées à la saisie, ignorées au calcul', () => {
  const taches = [t('A', 2), t('B', 2, [['A']]), t('C', 2, [['B']])];
  assert.equal(R.creeBoucle(taches, 'C', 'A'), true); // A après C alors que C dépend de A
  assert.equal(R.creeBoucle(taches, 'A', 'A'), true);
  assert.equal(R.creeBoucle(taches, 'A', 'C'), false);
  const o = R.ordonnancer([t('A', 2, [['B']]), t('B', 2, [['A']]), t('C', 1)], CAL, D0);
  assert.equal(o.boucles.length, 2);
  assert.ok([...o.taches.values()].every((x) => Number.isFinite(x.es) && Number.isFinite(x.margeTotale)));
});

test('avancement attendu, statut et retard', () => {
  const r = { es: 100, ef: 110, dur: 10 };
  assert.equal(R.statut(r, 0, 99).code, 'avenir');
  assert.equal(R.statut(r, 0, 100).code, 'encours'); // matin du premier jour : 0 % attendu
  assert.equal(R.statut(r, 30, 104).code, 'retard'); // 40 % attendus
  assert.equal(R.statut(r, 30, 104).retard, 1);
  assert.equal(R.statut(r, 40, 104).code, 'encours');
  assert.equal(R.statut(r, 50, 120).retard, 5);
  assert.equal(R.statut(r, 100, 120).code, 'termine');
  const j = { es: 100, ef: 100, dur: 0 };
  assert.equal(R.statut(j, 0, 100).code, 'avenir');
  assert.deepEqual(js(R.statut(j, 0, 103)), { code: 'retard', attendu: 1, retard: 3 });
  assert.equal(R.avancementGlobal([{ dur: 10, avancement: 100 }, { dur: 30, avancement: 0 }, { dur: 0, avancement: 100 }]), 27); // (1000+100)/41
});

test('référence et jalons à plage', () => {
  const c = R.calendrier({ ouvres: true });
  assert.equal(R.ecartReference({ fin: '2026-11-13' }, { fin: '2026-11-10' }, c), 2); // 11/11 férié
  assert.equal(R.ecartReference({ fin: '2026-11-09' }, { fin: '2026-11-10' }, c), -1);
  assert.equal(R.ecartReference({ fin: '2026-11-09' }, null, c), null);
  const p = { debut: '2026-12-10', fin: '2026-12-18' };
  assert.deepEqual(js(R.etatPlage('2026-12-08', p)), { code: 'avance', jours: 2 });
  assert.deepEqual(js(R.etatPlage('2026-12-15', p)), { code: 'dans', jours: 3 });
  assert.deepEqual(js(R.etatPlage('2026-12-21', p)), { code: 'depasse', jours: 3 });
});

test('liens : lecture et écriture', () => {
  assert.deepEqual(js(R.lireDeps('3, 5DD+2, 7ff-1, 2SS, 4FS+1j')), {
    deps: [{ num: 3, type: 'FD', decalage: 0 }, { num: 5, type: 'DD', decalage: 2 }, { num: 7, type: 'FF', decalage: -1 }, { num: 2, type: 'DD', decalage: 0 }, { num: 4, type: 'FD', decalage: 1 }],
    erreurs: [],
  });
  assert.deepEqual(js(R.lireDeps('3, x, 5XY')).erreurs, ['x', '5XY']);
  assert.equal(R.ecrireDep(3, 'FD', 0), '3');
  assert.equal(R.ecrireDep(3, 'FD', 2), '3FD+2');
  assert.equal(R.ecrireDep(5, 'DD', -1), '5DD-1');
  assert.equal(R.ecrireDep(6, 'DF', 0), '6DF');
});

test('saisie rapide en une ligne', () => {
  const o = { aujourdhui: '2026-11-12' };
  assert.deepEqual(js(R.lireSaisie('Maquette accueil 12/11 5j 40% après 2', o)), {
    nom: 'Maquette accueil', debut: '2026-11-12', duree: 5, avancement: 40, deps: [{ num: 2, type: 'FD', decalage: 0 }], jalon: false, plage: null, erreurs: [],
  });
  const j = R.lireSaisie('Réception jalon plage 10/12-18/12 après 3, 5DD+2', o);
  assert.equal(j.nom, 'Réception');
  assert.equal(j.duree, 0);
  assert.deepEqual(js(j.plage), { debut: '2026-12-10', fin: '2026-12-18' });
  assert.equal(j.deps.length, 2);
  assert.equal(R.lireSaisie('Pose 2 sem après 4FF-1', { ...o, ouvres: true }).duree, 10);
  assert.equal(R.lireSaisie('Pose 2 sem', o).duree, 14);
  assert.equal(R.lireSaisie('Peinture 3 j', o).duree, 3);
  assert.equal(R.lireSaisie('Livraison 0j', o).jalon, true);
  // Sans année : la date la plus proche d'aujourd'hui (janvier → année suivante).
  assert.equal(R.lireSaisie('Bilan 05/01', o).debut, '2027-01-05');
  assert.equal(R.lireSaisie('Bilan le 05/01/2028', o).debut, '2028-01-05');
  assert.equal(R.lireSaisie('Bilan le 05/01/2028', o).nom, 'Bilan');
  assert.deepEqual(js(R.lireSaisie('_Lot_1', o)), { section: 'Lot 1' });
  assert.equal(R.lireSaisie('Lot 31/02', o).erreurs.length, 1);
  assert.equal(R.lireSaisie('Version 2 après relecture', o).nom, 'Version 2 après relecture');
  assert.equal(R.lireSaisie('   ', o).vide, true);
});

test('échelle et zoom', () => {
  assert.equal(R.niveauEchelle(30), 'jour');
  assert.equal(R.niveauEchelle(8), 'semaine');
  assert.equal(R.niveauEchelle(2), 'mois');
  assert.equal(R.niveauEchelle(0.5), 'trimestre');
  assert.equal(R.niveauEchelle(0.15), 'annee');
  assert.equal(R.zoomPourAjuster('2026-11-01', '2026-11-30', 600), 20);
  assert.equal(R.zoomPourAjuster('2026-11-01', '2026-11-01', 6000), R.ZOOM_MAX);
  assert.equal(R.zoomPourAjuster('2000-01-01', '2040-01-01', 300), R.ZOOM_MIN);
});

test('modèles : 10 à 15, liens valides, sans boucle, jalons à plage atteints', () => {
  assert.ok(B.modeles.length >= 10 && B.modeles.length <= 15);
  let n = 0;
  const uid = () => `x${n++}`;
  for (const m of B.modeles) {
    for (const [s, , d, deps] of m.taches) {
      assert.ok(m.sections[s], `${m.id} : section ${s}`);
      assert.ok(Number.isInteger(d) && d >= 0);
      assert.deepEqual(js(R.lireDeps(deps).erreurs), [], `${m.id} : ${deps}`);
    }
    const debut = '2027-01-04';
    const { taches, sections } = R.instancierModele(m, debut, uid);
    assert.equal(sections.length, m.sections.length);
    assert.equal(taches.reduce((k, x) => k + x.deps.length, 0), m.taches.reduce((k, x) => k + R.lireDeps(x[3]).deps.length, 0), m.id);
    const cal = R.calendrier({ ouvres: m.ouvres });
    const o = R.ordonnancer(taches, cal, debut);
    assert.equal(o.boucles.length, 0, m.id);
    assert.ok([...o.taches.values()].some((x) => x.critique), m.id);
    for (const x of taches.filter((y) => y.plage)) assert.equal(R.etatPlage(o.taches.get(x.id).debut, x.plage).code, 'dans', `${m.id} : ${x.nom}`);
  }
});

test('ordre d\'affichage : hors section puis sections dans l\'ordre', () => {
  const p = { id: 'p', sections: [{ id: 's2' }, { id: 's1' }] };
  const l = [{ id: 'a', planningId: 'p', sectionId: 's1' }, { id: 'b', planningId: 'p', sectionId: null }, { id: 'c', planningId: 'p', sectionId: 's2' }, { id: 'd', planningId: 'q', sectionId: null }];
  assert.deepEqual(R.ordreAffichage(p, l).map((x) => x.id), ['b', 'c', 'a']);
});

test('source des fériés affichée et datée', () => {
  assert.match(B.sources.feries.lien, /^https:\/\/www\.service-public\.gouv\.fr\//);
  assert.equal(B.sources.feries.consulteLe, '12/11/2026');
  assert.ok(!B.couleurs.some((c) => c.id === 'rouge'), 'le rouge est réservé au chemin critique');
});

// ---------- Version anglaise : calendriers, saisie et liens ----------
test('fériés Angleterre et pays de Galles, jours de remplacement', () => {
  const d = (an) => js(R.feries(an, 'uk').map((f) => f.date));
  // 2026 : Noël un vendredi, lendemain de Noël un samedi → lundi 28.
  assert.deepEqual(d(2026), ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28']);
  // 2027 : Noël un samedi et lendemain un dimanche → lundi 27 et mardi 28.
  assert.ok(d(2027).includes('2027-12-27') && d(2027).includes('2027-12-28') && !d(2027).includes('2027-12-25'));
  // 2022 : 1er janvier un samedi → lundi 3 ; Noël un dimanche → mardi 27, lendemain de Noël lundi 26.
  assert.ok(d(2022).includes('2022-01-03'));
  const noel2022 = R.feries(2022, 'uk').filter((f) => f.date >= '2022-12-01');
  assert.deepEqual(js(noel2022.map((f) => [f.date, f.en])), [['2022-12-26', 'Boxing Day'], ['2022-12-27', 'Christmas Day (substitute day)']]);
});

test('fériés fédéraux des États-Unis, jours observés', () => {
  const d = (an) => js(R.feries(an, 'us').map((f) => f.date));
  assert.deepEqual(d(2026), ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']);
  // Juneteenth seulement depuis 2021.
  assert.equal(R.feries(2020, 'us').some((f) => f.en.startsWith('Juneteenth')), false);
  // 1er janvier 2022 un samedi : observé le vendredi 31 décembre 2021.
  assert.ok(R.feriesEntre('2021-12-01', '2021-12-31', 'us').some((f) => f.date === '2021-12-31'));
  const c = R.calendrier({ ouvres: true, zone: 'us' });
  assert.equal(c.estOuvre('2026-07-03'), false);
  assert.equal(c.estOuvre('2026-07-06'), true);
});

test('zones : aucune, compatibilité alsace, noms anglais', () => {
  assert.equal(R.feries(2026, 'aucun').length, 0);
  assert.equal(R.calendrier({ ouvres: true, zone: 'aucun' }).estOuvre('2026-12-25'), true);
  assert.equal(R.calendrier({ ouvres: true, alsace: true }).zone, 'fr-alsace');
  assert.equal(R.feries(2026, true).length, 13);
  assert.equal(R.feries(2026).find((f) => f.date === '2026-07-14').en, 'Bastille Day');
  assert.equal(R.zoneDe('inconnue'), 'fr');
});

test('deux fériés le même jour ne retirent qu\'un jour ouvré (Ascension le 1er mai 2008)', () => {
  assert.equal(R.feries(2008).filter((f) => f.date === '2008-05-01').length, 2);
  const c = R.calendrier({ ouvres: true });
  // Du mercredi 30 avril au vendredi 2 mai 2008 : 2 jours ouvrés (le jeudi 1er mai est férié une seule fois).
  assert.equal(c.idx('2008-05-02') - c.idx('2008-04-30'), 1);
  assert.equal(c.date(c.idx('2008-04-30') + 1), '2008-05-02');
  assert.equal(c.date(c.idx('2008-04-30') + 2), '2008-05-05');
});

test('saisie rapide en anglais et dates mois/jour', () => {
  const o = { aujourdhui: '2026-11-13', ouvres: false };
  const t = R.lireSaisie('Homepage mockup 11/20 5d 40% after 2', { ...o, ordreDate: 'mj' });
  assert.deepEqual(js({ nom: t.nom, debut: t.debut, duree: t.duree, av: t.avancement, deps: t.deps }), { nom: 'Homepage mockup', debut: '2026-11-20', duree: 5, av: 40, deps: [{ num: 2, type: 'FD', decalage: 0 }] });
  const j = R.lireSaisie('Delivery milestone window 12/10-12/18 after 3, 5SS+2', { ...o, ordreDate: 'mj' });
  assert.deepEqual(js({ jalon: j.jalon, plage: j.plage, deps: j.deps.map((x) => x.type) }), { jalon: true, plage: { debut: '2026-12-10', fin: '2026-12-18' }, deps: ['FD', 'DD'] });
  assert.equal(R.lireSaisie('Install 2 wk after 4FF-1', { ...o, ouvres: true }).duree, 10);
  assert.equal(R.lireSaisie('Paint 3 days', o).duree, 3);
  assert.equal(R.lireSaisie('Review on 2027-01-05', o).debut, '2027-01-05');
  assert.equal(R.lireSaisie('Review 05/01', o).debut, '2027-01-05');
  assert.equal(R.lireSaisie('Review 05/01', { ...o, ordreDate: 'mj' }).debut, '2027-05-01');
  assert.equal(R.lireSaisie('Version 2 after review', o).nom, 'Version 2 after review');
  assert.deepEqual(js(R.lireDeps('3, 5SS+2d, 7SF').deps.map((d) => [d.type, d.decalage])), [['FD', 0], ['DD', 2], ['DF', 0]]);
});

test('liens écrits avec les codes anglais', () => {
  assert.equal(R.ecrireDep(3, 'FD', 0, true), '3');
  assert.equal(R.ecrireDep(3, 'FD', 2, true), '3FS+2');
  assert.equal(R.ecrireDep(5, 'DD', -1, true), '5SS-1');
  assert.equal(R.ecrireDep(6, 'DF', 0, true), '6SF');
});

test('traduction anglaise complète : textes du code et modèles', async () => {
  const { clesTraduction } = await import('./textes.mjs');
  const g = { window: {} };
  new Function('window', readFileSync(new URL('../../templates/gantt/en.js', import.meta.url), 'utf8'))(g.window);
  const EN = g.window.TEXTES_EN;
  const cles = clesTraduction(new URL('../../templates/gantt/app.js', import.meta.url),
    ['tâche', 'tâches', 'section', 'sections', 'planning', 'plannings', 'masqué', 'masqués',
      'France', 'France (Alsace-Moselle)', 'Angleterre et pays de Galles', 'États-Unis (fériés fédéraux)', 'Aucun jour férié']);
  const manquantes = cles.filter((k) => typeof EN[k] !== 'string');
  assert.deepEqual(manquantes, []);
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of cles) assert.equal(vars(EN[k]), vars(k), k);
  for (const m of B.modeles) {
    assert.ok(m.en, m.id);
    assert.equal(m.en.taches.length, m.taches.length, m.id);
    assert.equal(m.en.sections.length, m.sections.length, m.id);
  }
});
