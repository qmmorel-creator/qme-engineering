// Tests des règles métier du calendrier du potager (templates/potager/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/potager/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.PTG;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14'; // samedi

function jardin(cultures = [], extra = {}) {
  const e = R.etatVide(B, [], 0);
  e.cultures = cultures.map((c, i) => R.normaliserCulture({ id: `c${i + 1}`, nom: `Culture ${i + 1}`, famille: 'solanacees', ...c }));
  e.parcelles = ['P1', 'P2'].map((nom, i) => R.normaliserParcelle({ id: `p${i + 1}`, nom }));
  return { ...e, ...extra, reglages: R.normaliserReglages(extra.reglages || {}) };
}

test('base : 60 légumes, familles connues, aucune période ni association', () => {
  assert.equal(B.legumes.length, 60);
  const codes = B.legumes.map(([c]) => c);
  assert.equal(new Set(codes).size, 60);
  const familles = new Set(B.familles.map((f) => f.code));
  for (const [code, nom, latin, famille] of B.legumes) {
    assert.ok(familles.has(famille), `${code} : famille ${famille}`);
    assert.ok(nom && latin, code);
    assert.match(latin, /^[A-Z][a-z]+ (× )?[a-z]+$/, `${code} : nom latin`);
  }
  // Chaque famille de la base sert au moins une fois.
  for (const f of familles) assert.ok(B.legumes.some((l) => l[3] === f), f);
  // Aucune donnée de culture fournie : pas de champ de période ni d'association dans la base.
  const texte = JSON.stringify(B);
  for (const interdit of ['fenetres', 'semisAbri"', 'amis', 'eloigner', 'periode']) assert.ok(!texte.includes(`"${interdit}`) || interdit === 'semisAbri"', interdit);
  assert.equal(B.legumes.every((l) => l.length === 4), true);
  assert.deepEqual(simple(B.operations.map((o) => o.code)), simple(R.OPS));
  assert.ok(B.couleurs.length >= 8);
});

test('quinzaines : bornes, libellés, passage d\'année', () => {
  assert.equal(R.debutQuinzaine(2026, 0), '2026-01-01');
  assert.equal(R.finQuinzaine(2026, 0), '2026-01-15');
  assert.equal(R.debutQuinzaine(2026, 3), '2026-02-16');
  assert.equal(R.finQuinzaine(2026, 3), '2026-02-28');
  assert.equal(R.finQuinzaine(2028, 3), '2028-02-29');
  assert.equal(R.finQuinzaine(2026, 23), '2026-12-31');
  assert.equal(R.quinzaineDe('2026-11-14'), 20);
  assert.equal(R.quinzaineDe('2026-11-16'), 21);
  assert.equal(R.nomQuinzaine(4), 'début mars');
  assert.equal(R.nomQuinzaine(7), 'fin avril');
  assert.equal(R.libelleQuinzaine(5), '16–fin mars');
  assert.equal(R.texteFenetre({ de: 4, a: 7 }), 'de début mars à fin avril');
  assert.equal(R.texteFenetre({ de: 4, a: 5 }), 'tout mars');
  assert.equal(R.texteFenetre({ de: 9, a: 9 }), 'fin mai');
  assert.equal(R.texteFenetre({ de: 20, a: 5 }), 'de début novembre à fin mars (l\'année suivante)');
  assert.equal(R.dureeFenetre({ de: 20, a: 5 }), 10);
  assert.equal(R.normaliserFenetre({ de: 24, a: 2 }), null);
  assert.equal(R.normaliserFenetre(null), null);
  assert.deepEqual(simple(R.normaliserFenetre({ de: '3', a: 6 })), { de: 3, a: 6 });
});

test('occurrences : dates réelles, décalage en semaines, passage d\'année', () => {
  assert.deepEqual(simple(R.occurrence({ de: 4, a: 7 }, 2026, 0)), { debut: '2026-03-01', fin: '2026-04-30', anneeDebut: 2026 });
  assert.deepEqual(simple(R.occurrence({ de: 4, a: 7 }, 2026, 2)), { debut: '2026-03-15', fin: '2026-05-14', anneeDebut: 2026 });
  assert.deepEqual(simple(R.occurrence({ de: 4, a: 7 }, 2026, -1)), { debut: '2026-02-22', fin: '2026-04-23', anneeDebut: 2026 });
  assert.deepEqual(simple(R.occurrence({ de: 20, a: 5 }, 2026, 0)), { debut: '2026-11-01', fin: '2027-03-31', anneeDebut: 2026 });
  // Fenêtre d'hiver : en février 2026, c'est l'occurrence commencée en novembre 2025.
  const o = R.occurrencesSur({ de: 20, a: 5 }, { debut: '2026-02-01', fin: '2026-02-07' });
  assert.equal(o.length, 1);
  assert.equal(o[0].anneeDebut, 2025);
  assert.equal(R.occurrencesSur({ de: 4, a: 7 }, { debut: '2026-06-01', fin: '2026-06-30' }).length, 0);
  assert.equal(R.occurrencesSur(null, { debut: '2026-06-01', fin: '2026-06-30' }).length, 0);
});

test('frise : cases allumées selon le jour médian, décalage compris', () => {
  const f = R.frise({ de: 4, a: 7 }, 2026, 0);
  assert.equal(f.length, 24);
  assert.deepEqual(simple(f.map((x, i) => (x ? i : -1)).filter((i) => i >= 0)), [4, 5, 6, 7]);
  // + 1 semaine : 8 mars → 1er mars + 7 = 8 mars encore dedans ; fin avril → 7 mai : 8 mai dehors.
  assert.deepEqual(simple(R.frise({ de: 4, a: 7 }, 2026, 1).map((x, i) => (x ? i : -1)).filter((i) => i >= 0)), [4, 5, 6, 7]);
  assert.deepEqual(simple(R.frise({ de: 4, a: 7 }, 2026, 2).map((x, i) => (x ? i : -1)).filter((i) => i >= 0)), [5, 6, 7, 8]);
  // Hiver : novembre → mars, cases de début et de fin d'année.
  assert.deepEqual(simple(R.frise({ de: 20, a: 3 }, 2026, 0).map((x, i) => (x ? i : -1)).filter((i) => i >= 0)), [0, 1, 2, 3, 20, 21, 22, 23]);
  assert.equal(R.frise(null, 2026).some(Boolean), false);
});

test('semaine et mois', () => {
  assert.deepEqual(simple(R.semaine(AUJ)), { debut: '2026-11-09', fin: '2026-11-15' });
  assert.deepEqual(simple(R.semaine('2026-11-16')), { debut: '2026-11-16', fin: '2026-11-22' });
  assert.deepEqual(simple(R.mois(AUJ)), { debut: '2026-11-01', fin: '2026-11-30' });
  assert.deepEqual(simple(R.mois('2026-12-10', 1)), { debut: '2027-01-01', fin: '2027-01-31' });
});

test('à faire : commence, en cours, finit, fait, récolte et décalage', () => {
  const e = jardin([
    { nom: 'Ail', famille: 'amaryllidacees', fenetres: { plantation: { de: 20, a: 21 } } }, // nov. : commence le 1er, en cours la semaine du 9
    { nom: 'Mâche', famille: 'caprifoliacees', fenetres: { semisPleine: { de: 16, a: 20 }, recolte: { de: 20, a: 5 } } }, // semis finit le 15/11
    { nom: 'Fève', famille: 'fabacees', fenetres: { semisPleine: { de: 21, a: 22 } } }, // commence le 16/11 : semaine suivante
  ], { journal: [R.normaliserEntree({ id: 'j1', date: '2026-11-10', type: 'plantation', culture: 'c1' })] });
  const s = R.aFaire(e, R.semaine(AUJ), AUJ);
  const de = (c, op) => s.find((x) => x.culture === c && x.op === op);
  assert.equal(de('c1', 'plantation').moment, 'encours');
  assert.equal(de('c1', 'plantation').fait.id, 'j1');
  assert.equal(de('c2', 'semisPleine').moment, 'finit');
  assert.equal(de('c2', 'semisPleine').fait, null);
  assert.equal(de('c2', 'semisPleine').joursRestants, 1);
  assert.equal(de('c2', 'recolte').moment, 'encours');
  assert.equal(de('c3', 'semisPleine'), undefined);
  // Les faits en dernier.
  assert.equal(s[s.length - 1].culture, 'c1');
  // Décalage + 1 semaine : la fève commence le 23/11, la mâche finit le 22/11.
  const e2 = { ...e, reglages: R.normaliserReglages({ decalage: 1 }) };
  const m = R.aFaire(e2, R.mois(AUJ), AUJ);
  assert.equal(m.find((x) => x.culture === 'c3').occurrence.debut, '2026-11-23');
  assert.equal(m.find((x) => x.culture === 'c3').moment, 'aVenir');
  const c = R.compteSemaine(e, AUJ);
  assert.deepEqual(simple(c), { semer: 1, planter: 0, recolter: 1, passees: 0, faits: 1, total: 3 });
});

test('fait : lieu du semis, repiquage, culture et dates', () => {
  const e = jardin([{ fenetres: { semisAbri: { de: 20, a: 21 }, semisPleine: { de: 20, a: 21 }, plantation: { de: 20, a: 21 } } }]);
  const o = R.occurrence({ de: 20, a: 21 }, 2026);
  const avec = (x) => ({ ...e, journal: [R.normaliserEntree({ id: 'x', culture: 'c1', date: '2026-11-05', ...x })] });
  assert.ok(R.faitDans(avec({ type: 'semis', lieu: 'abri' }), 'c1', 'semisAbri', o));
  assert.equal(R.faitDans(avec({ type: 'semis', lieu: 'abri' }), 'c1', 'semisPleine', o), null);
  assert.ok(R.faitDans(avec({ type: 'semis' }), 'c1', 'semisPleine', o), 'lieu non précisé : vaut pour les deux');
  assert.ok(R.faitDans(avec({ type: 'repiquage' }), 'c1', 'plantation', o));
  assert.equal(R.faitDans(avec({ type: 'semis', date: '2026-10-31' }), 'c1', 'semisPleine', o), null);
  assert.equal(R.faitDans(avec({ type: 'semis', culture: 'autre' }), 'c1', 'semisPleine', o), null);
  assert.equal(R.faitDans(avec({ type: 'levee' }), 'c1', 'semisPleine', o), null);
});

test('fenêtres passées : 21 jours, sans entrée, jamais la récolte', () => {
  const e = jardin([
    { fenetres: { semisPleine: { de: 18, a: 19 }, recolte: { de: 18, a: 19 } } }, // finit le 31/10 : 14 jours
    { fenetres: { semisPleine: { de: 16, a: 17 } } }, // finit le 30/09 : trop ancien (45 jours)
    { fenetres: { plantation: { de: 18, a: 19 } } },
  ], { journal: [R.normaliserEntree({ id: 'j', date: '2026-10-20', type: 'plantation', culture: 'c3' })] });
  const p = R.passees(e, AUJ);
  assert.equal(p.length, 1);
  assert.equal(p[0].culture, 'c1');
  assert.equal(p[0].depuis, 14);
});

test('rotation : même famille au même endroit dans le délai réglé', () => {
  const e = jardin([
    { nom: 'Tomate', famille: 'solanacees' }, { nom: 'Pomme de terre', famille: 'solanacees' }, { nom: 'Carotte', famille: 'apiacees' },
  ]);
  e.placements = [
    R.normaliserPlacement({ id: 'a', parcelle: 'p1', culture: 'c2', annee: 2025 }),
    R.normaliserPlacement({ id: 'b', parcelle: 'p1', culture: 'c1', annee: 2026 }),
    R.normaliserPlacement({ id: 'c', parcelle: 'p2', culture: 'c1', annee: 2024 }),
    R.normaliserPlacement({ id: 'd', parcelle: 'p2', culture: 'c2', annee: 2026 }),
    R.normaliserPlacement({ id: 'f', parcelle: 'p1', culture: 'c3', annee: 2027 }),
  ];
  const b = R.alertesRotation(e, e.placements[1]);
  assert.equal(b.length, 1);
  assert.equal(b[0].annee, 2025);
  assert.equal(b[0].culture, 'c2');
  assert.equal(R.alertesRotation(e, e.placements[3]).length, 0, 'deux ans avant : hors délai d\'un an');
  const e3 = { ...e, reglages: R.normaliserReglages({ rotation: 3 }) };
  assert.equal(R.alertesRotation(e3, e3.placements[3]).length, 1);
  assert.equal(R.alertesRotation(e, e.placements[4]).length, 0);
  assert.equal(R.alertesAnnee(e, 2026).filter((a) => a.type === 'rotation').length, 1);
  assert.deepEqual(simple(R.historiqueParcelle(e, 'p1')), [{ annee: 2027, familles: ['apiacees'] }, { annee: 2026, familles: ['solanacees'] }, { annee: 2025, familles: ['solanacees'] }]);
  assert.deepEqual(simple(R.annees(e, AUJ)), [2027, 2026, 2025, 2024]);
});

test('associations saisies par l\'utilisateur : à éloigner et bons voisins, dans les deux sens', () => {
  const e = jardin([{ nom: 'A', eloigner: ['c2'] }, { nom: 'B' }, { nom: 'C', amis: ['c1'] }]);
  e.placements = ['c1', 'c2', 'c3'].map((c, i) => R.normaliserPlacement({ id: `x${i}`, parcelle: 'p1', culture: c, annee: 2026 }));
  assert.deepEqual(simple(R.voisinage(e, e.placements[1])), { eloigner: ['c1'], amis: [] });
  assert.deepEqual(simple(R.voisinage(e, e.placements[0])), { eloigner: ['c2'], amis: ['c3'] });
  const al = R.alertesAnnee(e, 2026).filter((a) => a.type === 'eloigner');
  assert.equal(al.length, 1, 'une seule alerte par paire');
  // Autre parcelle : pas d'alerte.
  e.placements[1].parcelle = 'p2';
  assert.equal(R.alertesAnnee(e, 2026).length, 0);
});

test('placer : pas de doublon, parcelle et culture connues', () => {
  const e = jardin([{ nom: 'A' }]);
  const r = R.placer(e, { parcelle: 'p1', culture: 'c1', annee: 2026 });
  assert.equal(r.ajoute, true);
  assert.equal(R.placer(r.etat, { parcelle: 'p1', culture: 'c1', annee: 2026 }).doublon, true);
  assert.equal(R.placer(r.etat, { parcelle: 'p1', culture: 'c1', annee: 2027 }).ajoute, true);
  assert.equal(R.placer(e, { parcelle: 'zz', culture: 'c1', annee: 2026 }).ajoute, false);
});

test('bilan des récoltes : kg, g convertis, autres unités, par mois et culture', () => {
  const e = jardin([{ nom: 'Tomate' }, { nom: 'Radis' }]);
  const J = (date, culture, quantite, unite) => R.normaliserEntree({ date, type: 'recolte', culture, quantite, unite });
  e.journal = [J('2026-07-10', 'c1', 2.5, 'kg'), J('2026-08-02', 'c1', 800, 'g'), J('2026-05-01', 'c2', 3, 'botte'), J('2025-08-01', 'c1', 1.2, 'kg'), R.normaliserEntree({ date: '2026-05-01', type: 'semis', culture: 'c1' })];
  const b = R.bilan(e, 2026);
  assert.equal(b.nb, 3);
  assert.equal(b.kg, 3.3);
  assert.equal(b.kgAvant, 1.2);
  assert.equal(b.autres.botte, 3);
  assert.equal(b.parMois[6], 2.5);
  assert.equal(b.parMois[7], 0.8);
  assert.equal(b.parCulture[0].culture, 'c1');
  assert.equal(b.parCulture[0].kg, 3.3);
  assert.equal(b.parCulture[1].botte, 3);
  assert.equal(R.bilan(e, 2030).nb, 0);
});

test('suppression d\'une culture : placements et voisinages retirés, journal gardé avec le nom', () => {
  const e = jardin([{ nom: 'Tomate' }, { nom: 'Basilic', amis: ['c1'] }]);
  e.placements = [R.normaliserPlacement({ id: 'a', parcelle: 'p1', culture: 'c1', annee: 2026 })];
  e.journal = [R.normaliserEntree({ id: 'j', date: '2026-07-01', type: 'recolte', culture: 'c1', quantite: 1 })];
  assert.deepEqual(simple(R.impactCulture(e, 'c1')), { journal: 1, placements: 1 });
  const n = R.supprimerCulture(e, 'c1');
  assert.equal(n.cultures.length, 1);
  assert.deepEqual(simple(n.cultures[0].amis), []);
  assert.equal(n.placements.length, 0);
  assert.equal(n.journal[0].nomCulture, 'Tomate');
  assert.equal(n.journal[0].culture, '');
  const p = R.supprimerParcelle({ ...e, journal: [R.normaliserEntree({ date: '2026-07-01', type: 'note', parcelle: 'p1' })] }, 'p1');
  assert.equal(p.parcelles.length, 1);
  assert.equal(p.placements.length, 0);
  assert.equal(p.journal[0].parcelle, '');
});

test('normalisation : réglages bornés, références inconnues retirées, entrées valides', () => {
  assert.deepEqual(simple(R.normaliserReglages({ decalage: 12, rotation: 0, jardin: '  Mon jardin ' })), { jardin: 'Mon jardin', decalage: 8, rotation: 1 });
  assert.deepEqual(simple(R.normaliserReglages({ decalage: '-3' })), { jardin: '', decalage: -3, rotation: 1 });
  const n = R.normaliser({ cultures: [{ id: 'a', nom: 'A', amis: ['b', 'zz', 'a'] }, { id: 'b', nom: 'B' }], placements: [{ parcelle: '', culture: 'a' }], journal: [{ date: 'hier' }, { date: '2026-01-01', type: 'recolte', quantite: '1,5', unite: 'g' }] }, B);
  assert.deepEqual(simple(n.cultures[0].amis), ['b']);
  assert.equal(n.placements.length, 0);
  assert.equal(n.journal.length, 1);
  assert.equal(n.journal[0].quantite, 1.5);
  assert.equal(n.journal[0].unite, 'g');
  assert.equal(R.normaliserEntree({ type: 'semis', lieu: 'abri', quantite: 3 }).quantite, 0);
  assert.equal(R.normaliserEntree({ type: 'levee', lieu: 'abri' }).lieu, '');
  const v = R.normaliser(null, B);
  assert.deepEqual(simple(v.cultures), []);
  const d = R.etatVide(B, ['tomate', 'carotte', 'inconnu'], 3);
  assert.equal(d.cultures.length, 2);
  assert.equal(d.cultures[0].famille, 'solanacees');
  assert.equal(d.cultures[0].fenetres.semisAbri, null);
  assert.deepEqual(simple(d.parcelles.map((p) => p.nom)), ['Planche 1', 'Planche 2', 'Planche 3']);
});

test('validation des saisies', () => {
  const e = jardin([{ nom: 'Tomate', variete: 'Cerise' }]);
  assert.match(R.validerCulture(e, { id: 'x', nom: '' }, ''), /nom/);
  assert.match(R.validerCulture(e, { id: 'x', nom: 'tomate', variete: 'cerise' }, 'tomate'), /existe déjà/);
  assert.equal(R.validerCulture(e, { id: 'x', nom: 'Tomate', variete: 'Cœur de bœuf' }, 'Tomate'), '');
  assert.equal(R.validerCulture(e, { id: 'c1', nom: 'Tomate', variete: 'Cerise' }, 'Tomate'), '');
  assert.match(R.validerEntree(e, { date: '', type: 'semis' }), /date/);
  assert.match(R.validerEntree(e, { date: AUJ, type: 'semis', culture: '' }), /culture/);
  assert.equal(R.validerEntree(e, { date: AUJ, type: 'note', culture: '' }), '');
});

test('CSV : en-têtes, fenêtres en clair, protection des formules', () => {
  const e = jardin([{ nom: '=Tomate', variete: 'a;b', fenetres: { semisAbri: { de: 4, a: 5 } }, amis: ['c2'] }, { nom: 'Basilic', famille: 'lamiacees' }]);
  e.placements = [R.normaliserPlacement({ parcelle: 'p1', culture: 'c1', annee: 2026 })];
  e.journal = [R.normaliserEntree({ date: '2026-07-01', type: 'recolte', culture: 'c1', parcelle: 'p1', quantite: 1.25, unite: 'kg' })];
  const c = R.csvCultures(e, B);
  assert.ok(c.startsWith('﻿Culture;Variété;Famille;Semis sous abri'));
  assert.ok(c.includes("'=Tomate;\"a;b\";Solanacées;tout mars"));
  assert.ok(c.includes(';Basilic;'));
  const j = R.csvJournal(e, B);
  assert.ok(j.includes('2026-07-01;Récolte;\'=Tomate;P1;;1,25;kg;'));
  assert.ok(R.csvParcelles(e, B).includes('2026;P1;Planche;\'=Tomate;Solanacées;'));
});

test('purge, recherche dans la base, taille', () => {
  const e = jardin([], { journal: [R.normaliserEntree({ date: '2025-01-01', type: 'note' }), R.normaliserEntree({ date: '2026-01-01', type: 'note' })] });
  const p = R.purgerAvant(e, '2025-06-01');
  assert.equal(p.retires, 1);
  assert.equal(p.etat.journal.length, 1);
  assert.deepEqual(simple(R.rechercherLegume(B, 'chou').map((l) => l[0])).slice(0, 2), ['chou-pomme', 'chou-fleur']);
  assert.ok(R.rechercherLegume(B, 'epin').some((l) => l[0] === 'epinard'));
  assert.ok(R.rechercherLegume(B, 'rave').some((l) => l[0] === 'celeri-rave'));
  assert.deepEqual(simple(R.rechercherLegume(B, '')), []);
  assert.ok(R.taille(e) > 50);
});
