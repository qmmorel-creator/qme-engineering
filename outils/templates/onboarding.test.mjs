// Tests des règles métier de l'onboarding et offboarding salarié (templates/onboarding/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/onboarding/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ARD;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13'; // un vendredi
const modeles = () => R.modelesDepuisBase(BASE.profils);
const personne = (extra = {}) => R.normaliserPersonne({ id: 'p', prenom: 'Camille Durand', sens: 'arrivee', date: '2026-11-20', ...extra }, AUJ);
const tache = (j, extra = {}) => ({ id: `t${j}`, titre: `Tâche ${j}`, resp: 'rh', j, statut: 'afaire', ...extra });

test('dates : ajout, écart, semaine du lundi au dimanche', () => {
  assert.equal(R.ajout('2026-11-13', -15), '2026-10-29');
  assert.equal(R.ajout('2026-12-31', 1), '2027-01-01');
  assert.equal(R.ecart('2026-11-13', '2027-02-11'), 90);
  assert.equal(R.lundi('2026-11-13'), '2026-11-09');
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche
  assert.deepEqual(simple(R.semaine('2026-11-13')), { de: '2026-11-09', a: '2026-11-15' });
  assert.ok(R.estDate('2028-02-29'));
  assert.ok(!R.estDate('2026-02-29'));
});

test('J relatif : affichage et saisie tolérante', () => {
  assert.equal(R.libJ(0), 'J');
  assert.equal(R.libJ(3), 'J+3');
  assert.equal(R.libJ(-15), 'J−15');
  assert.equal(R.lireJ('J-15'), -15);
  assert.equal(R.lireJ('j+3'), 3);
  assert.equal(R.lireJ(' -7 '), -7);
  assert.equal(R.lireJ('J'), 0);
  assert.equal(R.lireJ('J−30'), -30);
  assert.equal(R.lireJ('90'), 90);
  assert.equal(R.lireJ('demain'), null);
  assert.equal(R.lireJ(''), null);
});

test('données minimales : prénom et initiale du nom seulement', () => {
  assert.equal(R.nomMinimal('camille durand'), 'Camille D.');
  assert.equal(R.nomMinimal('  JEAN-MARC   de la Tour '), 'Jean-Marc D.');
  assert.equal(R.nomMinimal('Inès'), 'Inès');
  assert.equal(R.nomMinimal('Yanis B.'), 'Yanis B.');
  assert.equal(R.nomMinimal('Élodie Éluard'), 'Élodie É.');
  assert.equal(R.nomMinimal(''), '');
  // La normalisation ne garde jamais un nom complet.
  assert.equal(personne({ prenom: 'Sophie Dupont-Martin' }).prenom, 'Sophie D.');
});

test('échéances calculées depuis la date d\'arrivée ou du dernier jour', () => {
  const p = personne({ date: '2026-11-20' });
  assert.equal(R.echeance(p, { j: -15 }), '2026-11-05');
  assert.equal(R.echeance(p, { j: 0 }), '2026-11-20');
  assert.equal(R.echeance(p, { j: 90 }), '2027-02-18');
  const d = personne({ sens: 'depart', date: '2026-12-31' });
  assert.equal(R.echeance(d, { j: -30 }), '2026-12-01');
  assert.equal(R.echeance(d, { j: 30 }), '2027-01-30');
});

test('statuts : fait, sans objet, en retard, cette semaine, à venir', () => {
  const p = personne({ date: '2026-11-13' });
  assert.equal(R.statutTache(tache(-1), p, AUJ), 'retard');
  assert.equal(R.statutTache(tache(0), p, AUJ), 'semaine');
  assert.equal(R.statutTache(tache(2), p, AUJ), 'semaine'); // dimanche 15
  assert.equal(R.statutTache(tache(3), p, AUJ), 'avenir'); // lundi 16
  assert.equal(R.statutTache(tache(-5, { statut: 'fait' }), p, AUJ), 'fait');
  assert.equal(R.statutTache(tache(-5, { statut: 'so' }), p, AUJ), 'so');
});

test('progression : sans objet exclu du compte, compteurs de retard', () => {
  const p = personne({ date: '2026-11-13', taches: [tache(-10, { statut: 'fait' }), tache(-8, { statut: 'so' }), tache(-3), tache(1), tache(20)] });
  const pr = R.progression(p, AUJ);
  assert.equal(pr.total, 5);
  assert.equal(pr.fait, 1);
  assert.equal(pr.so, 1);
  assert.equal(pr.aFaire, 3);
  assert.equal(pr.retard, 1);
  assert.equal(pr.semaine, 1);
  assert.equal(pr.pct, 25); // 1 fait sur 4 applicables
  assert.equal(R.progression(personne({ taches: [tache(1, { statut: 'so' })] }), AUJ).pct, 100);
  assert.equal(R.progression(personne({ taches: [] }), AUJ).pct, 0);
});

test('phases d\'arrivée et de départ', () => {
  assert.equal(R.phase(-15, 'arrivee').id, 'avant');
  assert.equal(R.phase(0, 'arrivee').id, 'jour');
  assert.equal(R.phase(7, 'arrivee').id, 'semaine1');
  assert.equal(R.phase(8, 'arrivee').id, 'mois1');
  assert.equal(R.phase(90, 'arrivee').id, 'suite');
  assert.equal(R.phase(-30, 'depart').id, 'preparer');
  assert.equal(R.phase(-7, 'depart').id, 'derniere');
  assert.equal(R.phase(0, 'depart').id, 'jour');
  assert.equal(R.phase(30, 'depart').id, 'apres');
});

test('génération des tâches : commun toujours inclus, profils ajoutés, tri par échéance', () => {
  const m = modeles();
  const seul = R.genererTaches(m, [], 'arrivee');
  assert.equal(seul.length, BASE.profils.find((p) => p.id === 'commun').arrivee.length);
  const bureau = R.genererTaches(m, ['bureau'], 'arrivee');
  assert.equal(bureau.length, seul.length + BASE.profils.find((p) => p.id === 'bureau').arrivee.length);
  assert.ok(bureau.every((t, i) => i === 0 || bureau[i - 1].j <= t.j));
  assert.ok(bureau.every((t) => t.statut === 'afaire' && t.faitLe === null));
  assert.equal(new Set(bureau.map((t) => t.id)).size, bureau.length);
  // Doublon de titre entre deux profils : une seule tâche.
  const m2 = [...m, R.normaliserModele({ id: 'x', nom: 'X', arrivee: [{ titre: bureau[0].titre, resp: 'rh', j: 3 }] })];
  assert.equal(R.genererTaches(m2, ['bureau', 'x'], 'arrivee').length, bureau.length);
  // Les modèles modifiés ensuite ne changent pas un parcours déjà créé.
  m.find((x) => x.id === 'commun').arrivee[0].titre = 'Modifié';
  assert.ok(!bureau.some((t) => t.titre === 'Modifié'));
});

test('matériel : remis, à restituer, non rendu après le dernier jour', () => {
  const arr = personne({ date: '2026-11-10', materiel: [{ id: 'a', nom: 'Ordinateur', remisLe: '2026-11-10' }, { id: 'b', nom: 'Badge' }] });
  assert.equal(R.etatMateriel(arr.materiel[0], arr, AUJ), 'remis');
  assert.equal(R.etatMateriel(arr.materiel[1], arr, AUJ), 'a-remettre-retard');
  const dep = personne({ sens: 'depart', date: '2026-11-10', materiel: [{ id: 'c', nom: 'Téléphone', remisLe: '2025-01-06' }, { id: 'd', nom: 'Clés', restitueLe: '2026-11-10' }] });
  assert.equal(R.etatMateriel(dep.materiel[0], dep, AUJ), 'non-rendu');
  assert.equal(R.etatMateriel(dep.materiel[1], dep, AUJ), 'restitue');
  const futur = personne({ sens: 'depart', date: '2026-11-18', materiel: [{ id: 'e', nom: 'Ordinateur' }] });
  assert.equal(R.etatMateriel(futur.materiel[0], futur, AUJ), 'a-restituer');
  assert.equal(R.etatMateriel(futur.materiel[0], futur, '2026-11-18'), 'a-restituer'); // le jour même
});

test('alertes matériel : non rendu d\'abord, restitution proche, rien de lointain', () => {
  const ps = [
    personne({ id: '1', sens: 'depart', date: '2026-11-18', materiel: [{ id: 'e', nom: 'Ordinateur' }] }),
    personne({ id: '2', sens: 'depart', date: '2026-11-03', materiel: [{ id: 'f', nom: 'Badge' }, { id: 'g', nom: 'Clés', restitueLe: '2026-11-03' }] }),
    personne({ id: '3', sens: 'depart', date: '2026-12-30', materiel: [{ id: 'h', nom: 'Écran' }] }),
  ];
  const a = R.alertesMateriel(ps, AUJ);
  assert.deepEqual(simple(a.map((x) => [x.nom, x.etat])), [['Badge', 'non-rendu'], ['Ordinateur', 'a-restituer']]);
  assert.equal(a[0].jours, 10);
});

test('parcours terminé et suggestion d\'effacement (RGPD)', () => {
  const fini = personne({ id: 'f', sens: 'depart', date: '2026-09-01', taches: [tache(-5, { statut: 'fait' }), tache(10, { statut: 'so' })], materiel: [{ nom: 'Badge', restitueLe: '2026-09-01' }] });
  assert.ok(R.termine(fini, AUJ));
  assert.equal(R.finParcours(fini), '2026-09-11');
  assert.deepEqual(simple(R.aEffacer([fini], AUJ, 30).map((p) => p.id)), ['f']);
  assert.equal(R.aEffacer([fini], AUJ, 90).length, 0); // 63 jours seulement
  // Matériel pas rendu : le départ n'est pas terminé.
  const nonRendu = personne({ sens: 'depart', date: '2026-09-01', taches: [tache(0, { statut: 'fait' })], materiel: [{ nom: 'Badge' }] });
  assert.ok(!R.termine(nonRendu, AUJ));
  assert.ok(!R.termine(personne({ taches: [] }), AUJ));
  assert.ok(!R.termine(personne({ taches: [tache(1)] }), AUJ));
});

test('cette semaine par responsable : retards et semaine, ordre des fonctions', () => {
  const ps = [
    personne({ id: 'a', prenom: 'Zoé', date: '2026-11-13', taches: [tache(-2, { resp: 'manager', id: 'a1' }), tache(1, { resp: 'rh', id: 'a2' }), tache(10, { resp: 'rh', id: 'a3' }), tache(-4, { resp: 'info', statut: 'fait', id: 'a4' })] }),
    personne({ id: 'b', prenom: 'Alex', sens: 'depart', date: '2026-11-14', taches: [tache(0, { resp: 'rh', id: 'b1' }), tache(-3, { resp: 'sg', id: 'b2' })] }),
  ];
  const g = R.parResponsable(ps, AUJ);
  assert.deepEqual(simple(g.map((x) => x.resp)), ['rh', 'manager', 'sg']);
  assert.deepEqual(simple(g[0].items.map((i) => i.tacheId)), ['b1', 'a2']); // 14 puis 14 : Alex avant Zoé
  assert.equal(g[1].items[0].statut, 'retard');
  assert.equal(R.parResponsable(ps, AUJ, { avecAvenir: true })[0].items.length, 3);
});

test('indicateurs du tableau de bord', () => {
  const ps = [
    personne({ id: 'a', date: '2026-11-13', taches: [tache(-2), tache(1)] }),
    personne({ id: 'b', sens: 'depart', date: '2026-11-03', taches: [tache(0, { statut: 'fait' })], materiel: [{ nom: 'Badge' }] }),
    personne({ id: 'c', sens: 'depart', date: '2026-08-01', taches: [tache(0, { statut: 'fait' })] }),
  ];
  const i = R.indicateurs(ps, AUJ);
  assert.equal(i.enCours, 2);
  assert.equal(i.arrivees, 1);
  assert.equal(i.departs, 1);
  assert.equal(i.retard, 1);
  assert.equal(i.semaine, 1);
  assert.equal(i.nonRendu, 1);
  assert.deepEqual(simple(R.trierPersonnes(ps, AUJ).map((p) => p.id)), ['a', 'b', 'c']);
});

test('départ préparé depuis une arrivée : matériel remis à restituer', () => {
  const arr = personne({ profils: ['bureau'], poste: 'Comptable', materiel: [{ id: 'm1', nom: 'Ordinateur', remisLe: '2026-01-05' }, { id: 'm2', nom: 'Écran' }, { id: 'm3', nom: 'Clé USB', remisLe: '2026-01-05', etat: 'perdu' }] });
  const d = R.departDepuis(arr, '2026-12-31', modeles());
  assert.equal(d.sens, 'depart');
  assert.equal(d.lieeA, arr.id);
  assert.equal(d.poste, 'Comptable');
  assert.deepEqual(simple(d.materiel.map((m) => m.nom)), ['Ordinateur']);
  assert.equal(d.materiel[0].restitueLe, null);
  assert.notEqual(d.materiel[0].id, 'm1');
  assert.ok(d.taches.some((t) => t.titre.includes('ordinateur')));
  assert.ok(d.taches.every((t) => t.j >= -30 && t.j <= 30));
});

test('normaliser : tolérant aux données anciennes ou invalides', () => {
  const v = R.normaliser(null, AUJ, BASE.profils);
  assert.equal(v.personnes.length, 0);
  assert.equal(v.modeles.length, BASE.profils.length);
  const n = R.normaliser({ reglages: { effacementJours: 'abc' }, modeles: [], personnes: [{ sens: 'bizarre', prenom: '', date: '2026-02-31', taches: [{ statut: 'oui', resp: 'pdg', j: 999, titre: '' }], materiel: [{ etat: 'cassé' }] }] }, AUJ, BASE.profils);
  assert.equal(n.reglages.effacementJours, 30);
  assert.equal(n.modeles.length, BASE.profils.length);
  const p = n.personnes[0];
  assert.equal(p.sens, 'arrivee');
  assert.equal(p.prenom, 'Sans nom');
  assert.equal(p.date, AUJ);
  assert.deepEqual(simple(p.taches[0]), { id: p.taches[0].id, titre: 'Tâche', resp: 'rh', j: 365, r: '', statut: 'afaire', faitLe: null, note: '' });
  assert.equal(p.materiel[0].etat, 'bon');
  assert.equal(p.materiel[0].nom, 'Matériel');
});

test('exports CSV : point-virgule, guillemets, BOM, statuts calculés', () => {
  const p = personne({ prenom: 'Léa M.', poste: 'Assistante; accueil', date: '2026-11-13', taches: [tache(-2, { titre: 'Dire "bonjour"' }), tache(1, { statut: 'fait', faitLe: '2026-11-12' })], materiel: [{ nom: 'Badge', remisLe: '2026-11-13', etat: 'neuf' }] });
  const c = R.versCsv([p], (r) => r.toUpperCase(), AUJ);
  assert.ok(c.startsWith('﻿Personne;Parcours;'));
  const lignes = c.slice(1).split('\r\n');
  assert.equal(lignes.length, 3);
  assert.ok(lignes[1].includes('"Assistante; accueil"'));
  assert.ok(lignes[1].includes('"Dire ""bonjour"""'));
  assert.ok(lignes[1].includes(';J-2;2026-11-11;En retard;'));
  assert.ok(lignes[2].endsWith(';Fait;2026-11-12'));
  const m = R.versCsvMateriel([p], (e) => e, AUJ);
  assert.ok(m.slice(1).split('\r\n')[1].startsWith('Léa M.;Arrivée;2026-11-13;Badge;Remis;2026-11-13;neuf'));
});

test('base intégrée : profils complets, responsables et échéances dans les bornes', () => {
  const resp = new Set(BASE.responsables.map((r) => r.id));
  assert.deepEqual([...resp], simple(R.RESPONSABLES));
  assert.ok(BASE.profils.length >= 5);
  assert.equal(BASE.profils[0].id, 'commun');
  let n = 0;
  for (const p of BASE.profils) {
    assert.ok(p.arrivee.length >= 4 && p.depart.length >= 4, p.id);
    for (const t of p.arrivee) { n++; assert.ok(resp.has(t.resp), t.titre); assert.ok(t.j >= BASE.bornes.arrivee[0] && t.j <= BASE.bornes.arrivee[1], t.titre); }
    for (const t of p.depart) { n++; assert.ok(resp.has(t.resp), t.titre); assert.ok(t.j >= BASE.bornes.depart[0] && t.j <= BASE.bornes.depart[1], t.titre); }
    for (const t of [...p.arrivee, ...p.depart]) if (t.r) assert.ok(BASE.reperes[t.r], `repère ${t.r}`);
  }
  assert.ok(n >= 80, `${n} tâches`);
  // Les bornes de la mission : de J-15 à J+90 à l'arrivée, de J-30 à J+30 au départ, toutes deux atteintes.
  const tout = (s) => BASE.profils.flatMap((p) => p[s].map((t) => t.j));
  assert.equal(Math.min(...tout('arrivee')), -15);
  assert.equal(Math.max(...tout('arrivee')), 90);
  assert.equal(Math.min(...tout('depart')), -30);
  assert.equal(Math.max(...tout('depart')), 30);
  // Chaque repère réglementaire est sourcé et daté.
  for (const r of Object.values(BASE.reperes)) assert.match(r.source, /\d{2}\/\d{2}\/\d{4}/);
  // La DPAE tombe dans les 8 jours qui précèdent l'arrivée.
  const dpae = BASE.profils[0].arrivee.find((t) => t.r === 'dpae');
  assert.ok(dpae.j < 0 && dpae.j >= -8);
  // Aucune personne nommée ni lien externe dans la base.
  assert.ok(!/https?:|www\.|@/.test(JSON.stringify(BASE.profils)));
});
