// Tests des règles métier du planner horaire (templates/planner/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/planner/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.PHR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const COULEURS = BASE.couleurs.map((c) => c.id);

// Semaine de référence : lundi 9 novembre 2026 → dimanche 15 novembre 2026.
const LUNDI = '2026-11-09';
const etat = () => ({ categories: [{ id: 'a', nom: 'A', couleur: 'bleu' }, { id: 'b', nom: 'B', couleur: 'rouge' }], series: [], blocs: [], modeles: [] });
const bloc = (id, date, debut, duree, cat = 'a', statut = 'prevu', extra = {}) => ({ id, date, debut, duree, titre: id, cat, note: '', statut, ...extra });

test('dates : jour de la semaine, lundi, ajout à travers les mois et le changement d\'heure', () => {
  assert.equal(R.jourIndex('2026-11-09'), 0);
  assert.equal(R.jourIndex('2026-11-15'), 6);
  assert.equal(R.lundiDe('2026-11-15'), '2026-11-09');
  assert.equal(R.lundiDe('2026-11-09'), '2026-11-09');
  assert.equal(R.lundiDe('2026-03-01'), '2026-02-23');
  assert.equal(R.ajout('2026-10-24', 7), '2026-10-31'); // passage à l'heure d'hiver le 25/10/2026
  assert.equal(R.ajout('2026-12-28', 7), '2027-01-04');
  assert.deepEqual(simple(R.joursSemaine(LUNDI, 5)), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
});

test('heures : lecture, affichage, durées', () => {
  assert.equal(R.lireHeure('9'), 540);
  assert.equal(R.lireHeure('9h'), 540);
  assert.equal(R.lireHeure('9 h 30'), 570);
  assert.equal(R.lireHeure('09:30'), 570);
  assert.equal(R.lireHeure('24'), 1440);
  assert.equal(R.lireHeure('24h30'), null);
  assert.equal(R.lireHeure('9h75'), null);
  assert.equal(R.lireHeure('midi'), null);
  assert.equal(R.heure(570), '9 h 30');
  assert.equal(R.heure(540), '9 h');
  assert.equal(R.hhmm(570), '09:30');
  assert.equal(R.duree(30), '30 min');
  assert.equal(R.duree(90), '1 h 30');
  assert.equal(R.duree(120), '2 h');
  assert.equal(R.duree(-45), '45 min');
});

test('borner : pas de 30 min, jamais au-delà de minuit', () => {
  assert.deepEqual(simple(R.borner(545, 60)), { debut: 540, duree: 60 });
  assert.deepEqual(simple(R.borner(1400, 120)), { debut: 1320, duree: 120 });
  assert.deepEqual(simple(R.borner(-60, 10)), { debut: 0, duree: 30 });
  assert.deepEqual(simple(R.borner(600, 2000)), { debut: 0, duree: 1440 });
});

test('séries : occurrences dans la période, jours cochés, date de fin, exceptions', () => {
  const e = etat();
  e.series.push({ id: 's1', titre: 'Fond', cat: 'a', jours: [0, 2, 4], debut: 540, duree: 120, depuis: '2026-11-11', jusqua: null, exceptions: { '2026-11-13': true } });
  e.series.push({ id: 's2', titre: 'Fini', cat: 'b', jours: [0, 1, 2, 3, 4, 5, 6], debut: 480, duree: 30, depuis: '2026-11-01', jusqua: '2026-11-10', exceptions: {} });
  e.blocs.push(bloc('x', '2026-11-12', 600, 60));
  const occ = R.occurrences(e, LUNDI, '2026-11-15');
  assert.deepEqual(occ.map((o) => o.id), ['s:s2:2026-11-09', 's:s2:2026-11-10', 's:s1:2026-11-11', 'x']);
  assert.equal(occ[2].virtuel, true);
  assert.equal(occ[3].virtuel, false);
});

test('materialiser : l\'occurrence devient un bloc, la série garde une exception', () => {
  const e = etat();
  e.series.push({ id: 's1', titre: 'Fond', cat: 'a', jours: [0], debut: 540, duree: 120, depuis: LUNDI, jusqua: null, exceptions: {} });
  const b = R.materialiser(e, 's:s1:2026-11-09');
  assert.equal(b.serieId, 's1');
  assert.equal(b.date, LUNDI);
  assert.equal(e.series[0].exceptions[LUNDI], true);
  const occ = R.occurrences(e, LUNDI, '2026-11-15');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].id, b.id);
  assert.equal(R.materialiser(e, 's:s1:2026-11-10'), null); // mardi : pas d'occurrence
  assert.equal(R.materialiser(e, b.id), b);
});

test('disposer : couloirs des blocs qui se chevauchent', () => {
  const p = R.disposer([bloc('a', LUNDI, 540, 180), bloc('b', LUNDI, 600, 60), bloc('c', LUNDI, 660, 60), bloc('d', LUNDI, 720, 60), bloc('e', LUNDI, 900, 30)]);
  // a 9 h–12 h ; b 10 h–11 h et c 11 h–12 h partagent le 2e couloir ; d commence à 12 h : nouveau groupe.
  assert.deepEqual(simple(p.a), { couloir: 0, couloirs: 2 });
  assert.deepEqual(simple(p.b), { couloir: 1, couloirs: 2 });
  assert.deepEqual(simple(p.c), { couloir: 1, couloirs: 2 });
  assert.deepEqual(simple(p.d), { couloir: 0, couloirs: 1 });
  assert.deepEqual(simple(p.e), { couloir: 0, couloirs: 1 });
  const q = R.disposer([bloc('a', LUNDI, 540, 120), bloc('b', LUNDI, 540, 60), bloc('c', LUNDI, 570, 60)]);
  assert.deepEqual([q.a.couloir, q.b.couloir, q.c.couloir], [0, 1, 2]);
  assert.equal(q.c.couloirs, 3);
  assert.equal(R.chevauche(bloc('a', LUNDI, 540, 60), bloc('b', LUNDI, 600, 30)), false);
  assert.equal(R.chevauche(bloc('a', LUNDI, 540, 61), bloc('b', LUNDI, 600, 30)), true);
});

test('marquer : fait, raccourci (multiple de 15, inférieur à la durée), pas fait', () => {
  const b = bloc('a', LUNDI, 540, 120);
  assert.equal(R.marquer(b, 'raccourci', 120), 'Durée réelle : un multiple de 15 min, inférieur à 2 h.');
  assert.match(R.marquer(b, 'raccourci', 50), /multiple de 15/);
  assert.equal(R.marquer(b, 'raccourci', 75), null);
  assert.equal(R.realise(b), 75);
  assert.equal(R.marquer(b, 'fait'), null);
  assert.equal(b.dureeReelle, undefined);
  assert.equal(R.realise(b), 120);
  R.marquer(b, 'pasfait');
  assert.equal(R.realise(b), 0);
  assert.equal(R.marquer(b, 'nimporte'), 'Marque inconnue.');
});

test('déplacé : l\'original reste en fantôme, une copie prévue est posée ailleurs', () => {
  const e = etat();
  e.series.push({ id: 's1', titre: 'Sport', cat: 'b', jours: [1], debut: 1080, duree: 60, depuis: LUNDI, jusqua: null, exceptions: {} });
  const copie = R.deplacerVers(e, 's:s1:2026-11-10', '2026-11-11', 1110);
  const orig = e.blocs.find((b) => b.id === copie.deId);
  assert.equal(orig.statut, 'deplace');
  assert.equal(orig.versId, copie.id);
  assert.equal(copie.date, '2026-11-11');
  assert.equal(copie.debut, 1110);
  assert.equal(copie.statut, 'prevu');
  // Supprimer la copie rend l'original « pas fait ».
  R.supprimer(e, copie.id);
  assert.equal(orig.statut, 'pasfait');
});

test('bilan d\'une semaine : prévu, prévu à ce jour, réalisé, taux, à marquer, déplacés', () => {
  const e = etat();
  e.blocs.push(
    bloc('f', '2026-11-09', 540, 120, 'a', 'fait'),                          // 2 h faites
    bloc('r', '2026-11-10', 540, 120, 'a', 'raccourci', { dureeReelle: 90 }), // 1 h 30 sur 2 h
    bloc('p', '2026-11-10', 840, 60, 'b', 'pasfait'),                        // 1 h non faite
    bloc('d', '2026-11-11', 600, 60, 'b', 'deplace', { versId: 'c' }),       // ne compte pas
    bloc('c', '2026-11-13', 600, 60, 'b', 'prevu', { deId: 'd' }),           // vendredi, à venir
    bloc('m', '2026-11-12', 480, 60, 'a'),                                   // jeudi 8 h, non marqué
    bloc('n', '2026-11-12', 900, 60, 'a'),                                   // jeudi 15 h, à venir
    bloc('hors', '2026-11-16', 540, 60, 'a', 'fait'),                        // semaine suivante
  );
  const maintenant = { date: '2026-11-12', min: 600 }; // jeudi 10 h
  const r = R.bilan(e, LUNDI, maintenant);
  const a = r.categories.find((c) => c.id === 'a');
  const b = r.categories.find((c) => c.id === 'b');
  assert.deepEqual([a.prevu, a.prevuAJour, a.realise, a.aMarquer, a.taux], [360, 300, 210, 1, 70]);
  assert.deepEqual([b.prevu, b.prevuAJour, b.realise, b.pasFaits, b.deplaces, b.taux], [120, 60, 0, 1, 1, 0]);
  assert.deepEqual([r.total.prevu, r.total.prevuAJour, r.total.realise, r.total.taux, r.total.aMarquer], [480, 360, 210, 58, 1]);
  // Semaine passée entière : tout est commencé.
  const fin = R.bilan(e, LUNDI, { date: '2026-11-20', min: 0 });
  assert.equal(fin.total.prevuAJour, 480);
  assert.equal(fin.total.aMarquer, 3);
  // Semaine vide : taux non défini.
  assert.equal(R.bilan(etat(), LUNDI, maintenant).total.taux, null);
});

test('bilan : une catégorie disparue apparaît « Sans catégorie »', () => {
  const e = etat();
  e.blocs.push(bloc('z', LUNDI, 540, 60, 'supprimee', 'fait'));
  const r = R.bilan(e, LUNDI, { date: '2026-11-20', min: 0 });
  assert.equal(r.categories.at(-1).nom, 'Sans catégorie');
  assert.equal(r.categories.at(-1).realise, 60);
});

test('tendance : n semaines dans l\'ordre, la dernière est celle demandée', () => {
  const e = etat();
  e.series.push({ id: 's', titre: 'X', cat: 'a', jours: [0], debut: 540, duree: 60, depuis: '2026-10-26', jusqua: null, exceptions: {} });
  const t = R.tendance(e, LUNDI, 3, { date: '2026-11-12', min: 0 });
  assert.deepEqual(simple(t.map((x) => x.lundi)), ['2026-10-26', '2026-11-02', '2026-11-09']);
  assert.deepEqual(simple(t.map((x) => x.prevu)), [60, 60, 60]);
  assert.deepEqual(simple(t.map((x) => x.taux)), [0, 0, 0]);
});

test('séries : arrêter et modifier à partir d\'une date', () => {
  const e = etat();
  e.series.push({ id: 's', titre: 'Fond', cat: 'a', jours: [0, 2], debut: 540, duree: 120, depuis: '2026-11-02', jusqua: null, exceptions: { '2026-11-04': true, '2026-11-16': true } });
  e.blocs.push(bloc('m1', '2026-11-04', 600, 120, 'a', 'fait', { serieId: 's' }), bloc('m2', '2026-11-18', 600, 120, 'a', 'prevu', { serieId: 's' }));
  const n = R.modifierSerieDepuis(e, 's', '2026-11-11', { debut: 480, jours: [2] });
  assert.equal(e.series.length, 2);
  assert.equal(e.series[0].jusqua, '2026-11-10');
  assert.deepEqual(simple(e.series[0].exceptions), { '2026-11-04': true });
  assert.deepEqual(simple(n.exceptions), { '2026-11-16': true });
  assert.equal(n.depuis, '2026-11-11');
  assert.equal(e.blocs.find((b) => b.id === 'm2').serieId, n.id);
  assert.equal(e.blocs.find((b) => b.id === 'm1').serieId, 's');
  const sem = R.occurrences(e, LUNDI, '2026-11-15').map((o) => `${o.date} ${o.debut}`);
  assert.deepEqual(simple(sem), ['2026-11-09 540', '2026-11-11 480']); // lundi 9 : ancienne série (jusqu'au 10) ; mercredi 11 : nouvelle
  // Arrêt le 18 : l'occurrence détachée encore prévue disparaît, l'historique reste.
  R.arreterSerie(e, n.id, '2026-11-18');
  assert.equal(e.series.find((s) => s.id === n.id).jusqua, '2026-11-17');
  assert.equal(e.blocs.some((b) => b.id === 'm2'), false);
  assert.equal(e.blocs.some((b) => b.id === 'm1'), true);
  // Arrêt avant le départ : la série disparaît.
  R.arreterSerie(e, 's', '2026-11-01');
  assert.equal(e.series.some((s) => s.id === 's'), false);
});

test('modèles : catégories ajoutées sans doublon de couleur, blocs ponctuels ou récurrents', () => {
  const type = BASE.semainesTypes.find((t) => t.id === 'freelance');
  const e = { categories: [{ id: 'perso2', nom: 'Perso', couleur: 'bleu' }], series: [], blocs: [], modeles: [] };
  const n = R.appliquerModele(e, type, LUNDI, { recurrent: false, presets: BASE.categories, couleurs: COULEURS });
  assert.equal(n, type.blocs.reduce((s, b) => s + b.jours.length, 0));
  const couleurs = e.categories.map((c) => c.couleur);
  assert.equal(new Set(couleurs).size, couleurs.length);
  assert.equal(e.categories.find((c) => c.id === 'production').couleur, 'rouge'); // bleu déjà pris : rouge, première libre
  assert.ok(e.blocs.every((b) => b.date >= LUNDI && b.date <= '2026-11-15'));
  const e2 = { categories: [], series: [], blocs: [], modeles: [] };
  R.appliquerModele(e2, type, LUNDI, { recurrent: true, presets: BASE.categories, couleurs: COULEURS });
  assert.equal(e2.series.length, type.blocs.length);
  assert.equal(R.occurrences(e2, '2026-11-16', '2026-11-22').length, n);
});

test('modèles : au-delà de 8 catégories, le bloc rejoint la première', () => {
  const e = { categories: COULEURS.map((c, i) => ({ id: `c${i}`, nom: `C${i}`, couleur: c })), series: [], blocs: [], modeles: [] };
  const table = R.assurerCategories(e, ['fond'], BASE.categories, COULEURS);
  assert.equal(table.fond, 'c0');
  assert.equal(e.categories.length, 8);
});

test('copier la semaine précédente : blocs ponctuels seulement, marques remises à zéro', () => {
  const e = etat();
  e.blocs.push(bloc('a', '2026-11-03', 540, 60, 'a', 'fait'), bloc('d', '2026-11-04', 540, 60, 'a', 'deplace'), bloc('s', '2026-11-05', 540, 60, 'a', 'fait', { serieId: 'x' }), bloc('hors', '2026-11-10', 540, 60));
  assert.equal(R.copierSemaine(e, '2026-11-02', LUNDI), 1);
  const copie = e.blocs.at(-1);
  assert.equal(copie.date, '2026-11-10');
  assert.equal(copie.statut, 'prevu');
});

test('semaine vers modèle : blocs identiques regroupés sur leurs jours', () => {
  const e = etat();
  e.series.push({ id: 's', titre: 'Fond', cat: 'a', jours: [0, 1], debut: 540, duree: 120, depuis: LUNDI, jusqua: null, exceptions: {} });
  e.blocs.push(bloc('x', '2026-11-12', 540, 120, 'a', 'prevu', { titre: 'Fond' }), bloc('y', '2026-11-12', 840, 60, 'b', 'deplace'));
  e.blocs[0].titre = 'Fond';
  const m = R.semaineVersModele(e, LUNDI, 'Ma semaine');
  assert.equal(m.blocs.length, 1);
  assert.deepEqual(simple(m.blocs[0].jours), [0, 1, 3]);
  assert.equal(R.totalModele(m), 360);
});

test('base : semaines types cohérentes (catégories connues, couleurs distinctes, aucun chevauchement)', () => {
  for (const t of BASE.semainesTypes) {
    const cats = t.categories.map((id) => BASE.categories.find((c) => c.id === id));
    assert.ok(cats.every(Boolean), t.id);
    assert.equal(new Set(cats.map((c) => c.couleur)).size, cats.length, t.id);
    assert.ok(cats.length <= BASE.couleurs.length);
    for (const b of t.blocs) {
      assert.ok(t.categories.includes(b.cat), `${t.id} ${b.titre}`);
      assert.equal(b.debut % 30, 0);
      assert.ok(b.duree > 0 && b.duree % 30 === 0, `${t.id} ${b.titre}`);
      assert.ok(b.debut >= t.heures[0] && b.debut + b.duree <= t.heures[1], `${t.id} ${b.titre} dans la grille`);
    }
    for (let j = 0; j < 7; j++) {
      const jour = t.blocs.filter((b) => b.jours.includes(j)).map((b, i) => ({ id: String(i), date: 'x', debut: b.debut, duree: b.duree }));
      for (let i = 0; i < jour.length; i++) for (let k = i + 1; k < jour.length; k++) assert.equal(R.chevauche(jour[i], jour[k]), false, `${t.id} jour ${j}`);
    }
  }
  assert.equal(BASE.couleurs.length, 8);
});
