// Tests des règles métier du tableau de bord annuel et roue de vie (templates/tableau-annuel/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/tableau-annuel/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RDV;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

// Aujourd'hui fictif : samedi 14 novembre 2026 (4e trimestre).
const AUJ = '2026-11-14';
const etat = (ids = ['sante', 'travail', 'argent', 'famille']) => { const e = R.normaliserEtat(null, AUJ, BASE); R.ajouterDomaines(e, ids, BASE); return e; };
const revue = (date, annee, trimestre, notes, type = 'trimestrielle') => ({ id: `r${date}`, date, annee, trimestre, type, notes, bilan: {}, priorites: [], avancement: {} });

test('base intégrée : domaines, questions, modèles, actions et couleurs', () => {
  assert.equal(BASE.domaines.length, 12);
  assert.equal(BASE.domaines.filter((d) => d.defaut).length, 8);
  assert.equal(BASE.couleurs.length, R.MAX_DOMAINES);
  for (const d of BASE.domaines) {
    assert.equal(d.questions.length, 3, d.id);
    assert.ok(BASE.objectifs[d.id]?.length >= 2, `objectifs modèles : ${d.id}`);
    assert.ok(BASE.actions[d.id]?.length >= 4, `actions types : ${d.id}`);
    for (const m of BASE.objectifs[d.id]) {
      assert.ok(m.resultats.length >= 1 && m.resultats.length <= 3, m.titre);
      for (const r of m.resultats) if (r.type === 'nombre') assert.notEqual(r.depart, r.cible, r.titre);
      assert.equal(R.verifierObjectif(m), null, m.titre);
    }
  }
  const ids = BASE.domaines.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BASE.bilan.trimestrielle.length, 5);
  assert.equal(BASE.bilan.annuelle.length, 3);
});

test('dates : trimestres, bornes, décalage et part de l\'année', () => {
  assert.equal(R.trimestreDe('2026-01-01'), 1);
  assert.equal(R.trimestreDe('2026-03-31'), 1);
  assert.equal(R.trimestreDe('2026-04-01'), 2);
  assert.equal(R.trimestreDe('2026-12-31'), 4);
  assert.equal(R.debutTrimestre(2026, 3), '2026-07-01');
  assert.equal(R.finTrimestre(2026, 1), '2026-03-31');
  assert.equal(R.finTrimestre(2026, 2), '2026-06-30');
  assert.equal(R.finTrimestre(2026, 4), '2026-12-31');
  assert.deepEqual(simple(R.trimestreSuivant(2026, 4)), { annee: 2027, trimestre: 1 });
  assert.deepEqual(simple(R.trimestreSuivant(2026, 1, -1)), { annee: 2025, trimestre: 4 });
  assert.deepEqual(simple(R.trimestreSuivant(2026, 2, -6)), { annee: 2024, trimestre: 4 });
  assert.equal(R.partAnnee(2026, '2026-01-01'), 0);
  assert.equal(R.partAnnee(2026, '2026-12-31'), 1);
  assert.equal(R.partAnnee(2026, '2025-06-01'), 0);
  assert.equal(R.partAnnee(2026, '2027-02-01'), 1);
  assert.ok(Math.abs(R.partAnnee(2026, '2026-07-02') - 0.5) < 0.01);
});

test('nombres : lecture tolérante, négatifs et milliers', () => {
  assert.equal(R.lireNombre('1,5'), 1.5);
  assert.equal(R.lireNombre('2 400'), 2400);
  assert.equal(R.lireNombre('-3'), -3);
  assert.equal(R.lireNombre('abc'), null);
  assert.equal(R.lireNombre(''), null);
});

test('roue : note d\'un domaine, équilibre, écart et variations', () => {
  assert.equal(R.noteDomaine([6, 7, 8]), 7);
  assert.equal(R.noteDomaine([5, null, 6]), 5.5);
  assert.equal(R.noteDomaine([null, null, null]), null);
  assert.equal(R.noteDomaine([7, 7, 8]), 7.3);
  assert.equal(R.noteDomaine([11, -1, 4]), 4); // hors échelle ignoré
  const e = etat();
  const r1 = revue('2026-03-28', 2026, 1, { sante: [4, 4, 4], travail: [6, 6, 6], argent: [3, 3, 3], famille: [8, 8, 8] });
  const r2 = revue('2026-06-27', 2026, 2, { sante: [6, 6, 6], travail: [6, 6, 6], argent: [2, 2, 2], famille: [null, null, null] });
  assert.equal(R.equilibre(e, r1), 5.3);
  assert.equal(R.equilibre(e, r2), 4.7); // famille non notée : exclue
  assert.equal(R.ecartRoue(e, r1), 5);
  assert.deepEqual(simple(R.variations(e, r2, r1)), { sante: 2, travail: 0, argent: -1, famille: null });
  assert.equal(R.equilibre(e, null), null);
});

test('roue : domaines faibles (notes basses d\'abord, puis la plus forte baisse)', () => {
  const e = etat();
  const r1 = revue('2026-03-28', 2026, 1, { sante: [6, 6, 6], travail: [4, 4, 4], argent: [6, 6, 6], famille: [9, 9, 9] });
  const r2 = revue('2026-06-27', 2026, 2, { sante: [4, 4, 4], travail: [4, 4, 4], argent: [5, 5, 5], famille: [9, 9, 9] });
  assert.deepEqual(simple(R.domainesFaibles(e, r2, r1, 3)), ['sante', 'travail', 'argent']);
  assert.deepEqual(simple(R.domainesFaibles(e, r2, null, 1)), ['sante']);
});

test('domaines : ajout depuis la base, couleurs fixes, 8 au plus, réactivation', () => {
  const e = R.normaliserEtat(null, AUJ, BASE);
  const n = R.ajouterDomaines(e, BASE.domaines.map((d) => d.id), BASE);
  assert.equal(n, 8);
  assert.deepEqual(e.domaines.map((d) => d.couleur), BASE.couleurs.map((c) => c.id));
  assert.equal(R.couleurLibre(e, BASE), null);
  e.domaines[2].archive = true;
  assert.equal(R.couleurLibre(e, BASE), BASE.couleurs[2].id);
  assert.equal(R.ajouterDomaines(e, ['cadre'], BASE), 1);
  assert.equal(e.domaines.find((d) => d.id === 'cadre').couleur, BASE.couleurs[2].id);
  assert.equal(R.ajouterDomaines(e, ['argent'], BASE), 0); // roue pleine
  e.domaines.find((d) => d.id === 'cadre').archive = true;
  assert.equal(R.ajouterDomaines(e, ['argent'], BASE), 1); // réactivé, pas dupliqué
  assert.equal(e.domaines.filter((d) => d.id === 'argent').length, 1);
});

test('revues : point de départ dû sans revue, période et type', () => {
  const e = etat();
  const p = R.prochaineRevue(e, AUJ);
  assert.equal(p.premiere, true);
  assert.equal(p.due, true);
  assert.equal(R.typeRevue(e, R.periodeRevue(e, AUJ)), 'initiale');
  assert.deepEqual(simple(R.periodeRevue(e, AUJ)), { annee: 2026, trimestre: 4 });
});

test('revues : prochaine revue ouverte 21 jours avant la fin du trimestre', () => {
  const e = etat();
  e.revues.push(revue('2026-10-05', 2026, 4, { sante: [5, 5, 5] }, 'initiale'));
  const p = R.prochaineRevue(e, AUJ);
  // Le point de départ couvre le 4e trimestre : la suivante est celle du 1er trimestre 2027.
  assert.equal(p.annee, 2027); assert.equal(p.trimestre, 1);
  assert.equal(p.date, '2027-03-31');
  assert.equal(p.ouverture, '2027-03-11');
  assert.equal(p.due, false);
  const e2 = etat();
  e2.revues.push(revue('2026-09-27', 2026, 3, { sante: [5, 5, 5] }));
  const q = R.prochaineRevue(e2, AUJ);
  assert.equal(q.trimestre, 4); assert.equal(q.annee, 2026);
  assert.equal(q.ouverture, '2026-12-11');
  assert.equal(q.due, false);
  assert.equal(R.prochaineRevue(e2, '2026-12-11').due, true);
  assert.equal(R.prochaineRevue(e2, '2026-12-10').due, false);
  assert.equal(R.typeRevue(e2, R.periodeRevue(e2, '2026-12-20')), 'annuelle');
});

test('revues : revue du trimestre écoulé oubliée, en retard', () => {
  const e = etat();
  e.revues.push(revue('2026-06-28', 2026, 2, { sante: [5, 5, 5] }));
  const p = R.prochaineRevue(e, AUJ);
  assert.equal(p.trimestre, 3);
  assert.equal(p.due, true);
  assert.equal(p.enRetard, R.ecart('2026-09-30', AUJ));
  assert.deepEqual(simple(R.periodeRevue(e, AUJ)), { annee: 2026, trimestre: 3 });
  assert.equal(R.typeRevue(e, R.periodeRevue(e, AUJ)), 'trimestrielle');
  // Suivi commencé après la fin du trimestre précédent : rien d'oublié.
  const e2 = etat();
  e2.revues.push(revue('2026-10-02', 2026, 4, { sante: [5, 5, 5] }, 'initiale'));
  assert.equal(R.prochaineRevue(e2, AUJ).enRetard, 0);
});

test('résultats clés : avancement dans les deux sens, plafonné, cases', () => {
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 0, cible: 12, actuel: 6 }), 0.5);
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 0, cible: 12, actuel: 20 }), 1);
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 0, cible: 12, actuel: -3 }), 0);
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 2400, cible: 2100, actuel: 2250 }), 0.5); // réduire à
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 2400, cible: 2100, actuel: 2500 }), 0);
  assert.equal(R.avancementResultat({ type: 'nombre', depart: 11, cible: 13, actuel: null }), 0);
  assert.equal(R.avancementResultat({ type: 'case', fait: true }), 1);
  assert.equal(R.avancementResultat({ type: 'case', fait: false }), 0);
  const o = { resultats: [{ type: 'nombre', depart: 0, cible: 10, actuel: 5 }, { type: 'case', fait: true }] };
  assert.equal(R.avancementObjectif(o), 0.75);
  assert.equal(R.avancementObjectif({ resultats: [] }), null);
});

test('objectifs : statut comparé à la part de l\'année écoulée', () => {
  const o = (actuel, annee = 2026) => ({ annee, resultats: [{ type: 'nombre', depart: 0, cible: 100, actuel }] });
  // 14 novembre : environ 87 % de l'année.
  assert.equal(R.statutObjectif(o(100), AUJ), 'atteint');
  assert.equal(R.statutObjectif(o(90), AUJ), 'bonnevoie');
  assert.equal(R.statutObjectif(o(80), AUJ), 'surveiller');
  assert.equal(R.statutObjectif(o(50), AUJ), 'retard');
  assert.equal(R.statutObjectif(o(50, 2025), AUJ), 'nonatteint');
  assert.equal(R.statutObjectif(o(5, 2027), AUJ), 'bonnevoie'); // année pas commencée
  assert.equal(R.statutObjectif({ annee: 2026, resultats: [] }, AUJ), 'apreciser');
});

test('objectifs : score de l\'année, attendu, photo d\'avancement', () => {
  const e = etat();
  e.objectifs.push(
    { id: 'a', annee: 2026, domaine: 'sante', titre: 'A', resultats: [{ type: 'nombre', depart: 0, cible: 10, actuel: 10 }] },
    { id: 'b', annee: 2026, domaine: 'argent', titre: 'B', resultats: [{ type: 'case', fait: false }] },
    { id: 'c', annee: 2026, domaine: 'argent', titre: 'C', resultats: [] },
    { id: 'd', annee: 2025, domaine: 'argent', titre: 'D', resultats: [{ type: 'case', fait: true }] },
  );
  assert.equal(R.scoreAnnee(e, 2026), 50);
  assert.equal(R.scoreAnnee(e, 2024), null);
  assert.equal(R.scoreAttendu(2026, '2026-12-31'), 100);
  assert.deepEqual(simple(R.photoAvancement(e, 2026)), { a: 1, b: 0 });
});

test('objectifs : modèle copié, reprise des non atteints l\'année suivante', () => {
  const m = BASE.objectifs.argent[1]; // dépenser moins : 2 400 → 2 100 €
  const o = R.objectifDepuisModele(m, 'argent', 2026);
  assert.equal(o.titre, m.titre);
  assert.equal(o.resultats[0].actuel, 2400);
  assert.equal(R.avancementObjectif(o), 0);
  const e = etat();
  o.resultats[0].actuel = 2250; o.resultats[1].actuel = 3; // le second est atteint
  e.objectifs.push(o, { id: 'ok', annee: 2026, domaine: 'sante', titre: 'Atteint', resultats: [{ id: 'x', type: 'case', fait: true }] });
  assert.equal(R.reprendreObjectifs(e, 2026, 2027), 1);
  const copie = e.objectifs.find((x) => x.annee === 2027);
  assert.equal(copie.repris, o.id);
  assert.equal(copie.resultats.length, 1); // résultat clé atteint non repris
  assert.equal(copie.resultats[0].depart, 2250);
  assert.equal(copie.resultats[0].cible, 2100);
  assert.equal(R.reprendreObjectifs(e, 2026, 2027), 0); // jamais deux fois
});

test('objectifs : vérification de la saisie', () => {
  assert.match(R.verifierObjectif({ titre: '', resultats: [] }), /nom/);
  assert.match(R.verifierObjectif({ titre: 'X', resultats: [{ titre: '', type: 'case' }] }), /intitulé/);
  assert.match(R.verifierObjectif({ titre: 'X', resultats: [{ titre: 'Y', type: 'nombre', depart: NaN, cible: 3 }] }), /chiffrés/);
  assert.match(R.verifierObjectif({ titre: 'X', resultats: [{ titre: 'Y', type: 'nombre', depart: 3, cible: 3 }] }), /différente/);
  assert.equal(R.verifierObjectif({ titre: 'X', resultats: [{ titre: 'Y', type: 'nombre', depart: 0, cible: 3 }] }), null);
});

test('actions : avancement du trimestre, retards, report et cycle d\'état', () => {
  const e = etat();
  const a = (id, annee, trimestre, statut) => ({ id, annee, trimestre, domaine: 'sante', titre: id, statut, reports: 0 });
  e.actions.push(a('1', 2026, 4, 'fait'), a('2', 2026, 4, 'encours'), a('3', 2026, 4, 'abandon'), a('4', 2026, 3, 'afaire'), a('5', 2025, 4, 'fait'));
  assert.deepEqual(simple(R.avancementActions(e, 2026, 4)), { faites: 1, total: 2, taux: 50 });
  assert.deepEqual(simple(R.avancementActions(e, 2027, 1)), { faites: 0, total: 0, taux: null });
  assert.deepEqual(simple(R.actionsEnRetard(e, AUJ).map((x) => x.id)), ['4']);
  const x = e.actions.find((y) => y.id === '4');
  R.reporter(x);
  assert.deepEqual([x.annee, x.trimestre, x.reports], [2026, 4, 1]);
  const z = a('z', 2026, 4, 'fait');
  R.reporter(z);
  assert.deepEqual([z.annee, z.trimestre, z.statut], [2027, 1, 'afaire']);
  assert.equal(R.statutSuivant('afaire'), 'encours');
  assert.equal(R.statutSuivant('encours'), 'fait');
  assert.equal(R.statutSuivant('fait'), 'afaire');
  assert.equal(R.statutSuivant('abandon'), 'afaire');
});

test('évolution, libellés, CSV et texte du bilan', () => {
  const e = etat(['sante', 'argent']);
  e.revues.push(
    { ...revue('2026-06-27', 2026, 2, { sante: [6, 6, 6], argent: [4, 4, 4] }), avancement: { a: 0.5 } },
    revue('2026-01-04', 2026, 1, { sante: [4, 4, 4], argent: [3, 3, 3] }, 'initiale'),
    { ...revue('2026-12-20', 2026, 4, { sante: [7, 8, 7], argent: [5, 5, 5] }, 'annuelle'), bilan: { fierte: 'La régularité', mot: 'Cap' } },
  );
  const ev = R.evolution(e);
  assert.deepEqual(simple(ev.map((l) => l.libelle)), ['Point de départ', 'T2 2026', 'Bilan 2026']);
  assert.deepEqual(simple(ev.map((l) => l.equilibre)), [3.5, 5, 6.2]);
  assert.equal(ev[1].score, 50);
  assert.equal(ev[0].score, null);
  assert.equal(R.derniereRevue(e).type, 'annuelle');
  assert.equal(R.revuePrecedente(e, R.derniereRevue(e)).trimestre, 2);
  const csv = R.versCsv(e).split('\r\n');
  assert.equal(csv[0], 'Date;Revue;Santé et forme;Argent;Moyenne;Objectifs (%)');
  assert.equal(csv[3], '2026-12-20;Bilan 2026;7,3;5;6,2;');
  const texte = R.texteBilan(e, BASE, 2026, '2026-12-20');
  assert.match(texte, /Mon année 2026/);
  assert.match(texte, /Santé et forme : 7,3\/10/);
  assert.match(texte, /plus grande fierté/);
  assert.match(texte, /La régularité/);
});

test('normalisation : état vide, versions anciennes et saisies partielles', () => {
  const v = R.normaliserEtat(null, AUJ, BASE);
  assert.deepEqual(simple(v), { version: 1, prenom: '', domaines: [], revues: [], objectifs: [], actions: [], brouillon: null });
  const n = R.normaliserEtat({
    prenom: 'Alex',
    domaines: [{ id: 'x', nom: 'Perso', couleur: 'inconnue' }, { nom: 'sans id' }],
    revues: [{ date: '2026-02-01', notes: { x: [3, 'a', 12] } }, { date: 'pas une date' }],
    objectifs: [{ titre: 'O', resultats: [{ titre: 'R', type: 'nombre', depart: '2', cible: '5' }, { titre: 'C', type: 'case', fait: 1 }] }, { resultats: [] }],
    actions: [{ titre: 'A', statut: 'bizarre', trimestre: 9 }, {}],
  }, AUJ, BASE);
  assert.equal(n.prenom, 'Alex');
  assert.equal(n.domaines.length, 1);
  assert.equal(n.domaines[0].couleur, BASE.couleurs[0].id);
  assert.equal(n.domaines[0].questions.length, 1);
  assert.equal(n.revues.length, 1);
  assert.deepEqual(simple(n.revues[0].notes.x), [3, null, null]);
  assert.equal(n.revues[0].trimestre, 1);
  assert.equal(n.revues[0].type, 'trimestrielle');
  assert.equal(n.objectifs.length, 1);
  assert.equal(n.objectifs[0].annee, 2026);
  assert.deepEqual(simple(n.objectifs[0].resultats.map((r) => [r.type, r.depart ?? r.fait, r.actuel])), [['nombre', 2, 2], ['case', true, null]]);
  assert.equal(n.actions.length, 1);
  assert.equal(n.actions[0].statut, 'afaire');
  assert.equal(n.actions[0].trimestre, 4);
});
