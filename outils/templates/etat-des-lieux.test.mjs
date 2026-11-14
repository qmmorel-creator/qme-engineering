// Tests des règles métier de l'État des lieux (templates/etat-des-lieux/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossierTpl = new URL('../../templates/etat-des-lieux/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossierTpl), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossierTpl), 'utf8'), ctx);
const R = ctx.window.ETD;
const B = ctx.window.BASE;
const plat = (x) => JSON.parse(JSON.stringify(x));

// Un T2 vide : sortie le 15/10/2026, grille « Peintures » (franchise 2 ans, 10 %/an, résiduel 20 %).
function dossierType(extra = {}) {
  return R.normaliserDossier({
    id: 'd1',
    logement: { adresse: '1 rue de l\'Exemple\n00000 Ville', type: 'nu' },
    bailleur: { nom: 'Bailleur Fictif', adresse: '2 rue Fictive' },
    locataires: 'Locataire Fictif',
    bail: { debut: '2022-09-01', depot: 800 },
    entree: { date: '2022-09-01' },
    sortie: { date: '2026-10-15', adresse: '3 rue Ailleurs' },
    grille: [{ id: 'gp', nom: 'Peintures', franchise: 2, abattement: 10, residuel: 20 }],
    pieces: [
      { id: 'p1', nom: 'Séjour', type: 'sejour', elements: [
        { id: 'x1', nom: 'Murs', cat: 'murs', grille: 'gp', pose: '2020', entree: { etat: 'neuf' }, sortie: { etat: 'degrade', cout: 500 } },
        { id: 'x2', nom: 'Sol', cat: 'sols', entree: { etat: 'bon' }, sortie: { etat: 'bon' } },
        { id: 'x3', nom: 'Fenêtres', cat: 'menuiseries', entree: { etat: 'usage' }, sortie: { etat: 'bon' } },
      ] },
      { id: 'p2', nom: 'Cuisine', type: 'cuisine', elements: [
        { id: 'x4', nom: 'Plaques', cat: 'equipements', entree: { etat: 'bon' }, sortie: { etat: 'hs', cout: 300, imputable: false } },
        { id: 'x5', nom: 'Évier', cat: 'plomberie', entree: { etat: 'bon' }, sortie: { etat: '' } },
        { id: 'x6', nom: 'Joints', cat: 'plomberie', entree: { etat: '' }, sortie: { etat: 'usage' } },
      ] },
    ],
    compteurs: [{ id: 'c1', type: 'eau-froide', nom: 'Eau froide', unite: 'm³', entree: 100.5, sortie: 180.25 }, { id: 'c2', type: 'gaz', nom: 'Gaz', unite: 'm³', entree: 50 }],
    cles: [{ id: 'k1', type: 'porte', nom: 'Porte', entree: 3, sortie: 2 }, { id: 'k2', type: 'boite', nom: 'Boîte', entree: 1, sortie: 1 }],
    ...extra,
  });
}

test('base : états, pièces, modèles, compteurs, clés et sources cohérents', () => {
  assert.deepEqual(plat(B.etats.map((e) => e.code)), ['neuf', 'bon', 'usage', 'degrade', 'hs']);
  assert.deepEqual(plat(R.ETATS), plat(B.etats.map((e) => e.code)));
  const cats = new Set(B.categories.map((c) => c.code));
  for (const p of B.pieces) {
    assert.ok(p.elements.length >= 3, p.code);
    for (const [nom, cat] of p.elements.concat(p.meuble)) { assert.ok(nom, p.code); assert.ok(cats.has(cat), `${p.code} ${nom} ${cat}`); }
    for (const [, cat] of p.meuble) assert.equal(cat, 'mobilier');
  }
  const types = new Set(B.pieces.map((p) => p.code));
  for (const m of B.modeles) for (const [t] of m.pieces) assert.ok(types.has(t), `${m.code} ${t}`);
  assert.ok(B.compteurs.length >= 6 && B.cles.length >= 5);
  assert.equal(B.reglages.verifieLe, '2026-11-14');
  for (const [nom, url] of B.sources) {
    assert.match(url, /^https:\/\/www\.(service-public\.gouv\.fr|legifrance\.gouv\.fr)\//);
    assert.ok(/consultée le 14\/11\/2026|Légifrance/.test(nom), nom);
  }
  // Aucune grille de vétusté intégrée.
  assert.equal(B.grille, undefined);
});

test('normalisation : valeurs absurdes bornées, état et photo invalides retirés', () => {
  const e = R.normaliser({ dossiers: [{ logement: { type: 'chateau', surface: -4 }, conformite: 'peut-etre', bail: { depot: 'abc', debut: '2026-02-30' },
    pieces: [{ elements: [{ nom: '  Porte  ', entree: { etat: 'parfait', photo: 'javascript:alert(1)' }, sortie: { etat: 'bon', cout: -10, photo: 'data:image/jpeg;base64,AAAA' } }] }] }],
  reglages: { photosMax: 500, restitutionConforme: 'x' } }, B);
  const d = e.dossiers[0];
  assert.equal(d.logement.type, 'nu');
  assert.equal(d.logement.surface, 0);
  assert.equal(d.conformite, 'auto');
  assert.equal(d.bail.depot, null);
  assert.equal(d.bail.debut, '');
  const x = d.pieces[0].elements[0];
  assert.equal(x.nom, 'Porte');
  assert.equal(x.entree.etat, '');
  assert.equal(x.entree.photo, '');
  assert.equal(x.sortie.photo, 'data:image/jpeg;base64,AAAA');
  assert.equal(x.sortie.cout, 0);
  assert.equal(x.sortie.imputable, true);
  assert.equal(e.reglages.photosMax, 60);
  assert.equal(e.reglages.restitutionConforme, 1);
  assert.equal(e.reglages.restitutionNonConforme, 2);
  assert.equal(e.reglages.rectificationJours, 10);
  // Photo trop lourde refusée.
  assert.equal(R.photoOk(`data:image/jpeg;base64,${'A'.repeat(R.PHOTO_MAX_CAR)}`), '');
  // Données vides ou absentes.
  assert.deepEqual(plat(R.normaliser(null, B).dossiers), []);
});

test('création : pièces types, mobilier en meublé, modèles, compteurs et clés par défaut', () => {
  const nu = R.nouvellePiece('chambre', 'Chambre 2', false, B);
  const meuble = R.nouvellePiece('chambre', '', true, B);
  assert.equal(nu.nom, 'Chambre 2');
  assert.equal(meuble.nom, 'Chambre');
  assert.ok(!nu.elements.some((x) => x.cat === 'mobilier'));
  assert.ok(meuble.elements.some((x) => x.nom === 'Lit' && x.cat === 'mobilier'));
  assert.ok(meuble.elements.length > nu.elements.length);
  assert.ok(nu.elements.every((x) => x.entree.etat === '' && x.sortie.etat === ''));
  const t3 = R.piecesModele('t3', false, B);
  assert.deepEqual(plat(t3.map((p) => p.nom)), ['Entrée', 'Séjour', 'Cuisine', 'Couloir', 'Chambre 1', 'Chambre 2', 'Salle de bains', 'WC']);
  assert.equal(R.piecesModele('vide', false, B).length, 0);
  assert.equal(R.nouvellePiece('inconnu', 'Grenier', false, B).elements.length, B.pieces.find((p) => p.code === 'autre').elements.length);
  assert.deepEqual(plat(R.compteursDefaut(B).map((c) => c.type)), ['eau-froide', 'elec-base']);
  assert.deepEqual(plat(R.clesDefaut(B).map((c) => c.entree)), [2, 2]);
});

test('date de pose : année, mois, date complète, erreurs ; âge en années pleines', () => {
  assert.equal(R.lirePose('2019'), '2019');
  assert.equal(R.lirePose('3/2019'), '2019-03');
  assert.equal(R.lirePose('2019-11'), '2019-11');
  assert.equal(R.lirePose('15/06/2018'), '2018-06-15');
  assert.equal(R.lirePose(''), '');
  assert.equal(R.lirePose('13/2019'), null);
  assert.equal(R.lirePose('hier'), null);
  assert.equal(R.poseTexte('2019-03'), '03/2019');
  // Année seule : 1er juillet.
  assert.equal(R.ageAnnees('2020', '2026-06-30'), 5);
  assert.equal(R.ageAnnees('2020', '2026-07-01'), 6);
  assert.equal(R.ageAnnees('2020-03', '2026-02-28'), 5);
  assert.equal(R.ageAnnees('', '2026-07-01'), null);
  assert.equal(R.ageAnnees('2027', '2026-07-01'), null);
  assert.equal(R.ageAnnees('2020', ''), null);
});

test('vétusté : franchise, abattement annuel, plafond de la part résiduelle', () => {
  const l = { franchise: 2, abattement: 10, residuel: 20 };
  assert.equal(R.tauxVetuste(l, 1), 0);
  assert.equal(R.tauxVetuste(l, 2), 0);
  assert.equal(R.tauxVetuste(l, 5), 30);
  assert.equal(R.tauxVetuste(l, 20), 80); // plafonné à 100 − 20
  assert.equal(R.tauxVetuste(l, null), null);
  assert.equal(R.tauxVetuste(null, 5), null);
  assert.equal(R.tauxVetuste({ franchise: 0, abattement: 12.5, residuel: 0 }, 3), 37.5);
});

test('comparaison : dégradé, amélioré, identique, à constater, sans entrée', () => {
  const d = dossierType();
  const x = (id) => R.tousElements(d).find((e) => e.x.id === id).x;
  assert.equal(R.difference(x('x1')), 'degrade');
  assert.equal(R.ecartRang(x('x1')), 3);
  assert.equal(R.difference(x('x2')), 'identique');
  assert.equal(R.difference(x('x3')), 'ameliore');
  assert.equal(R.ecartRang(x('x3')), -1);
  assert.equal(R.difference(x('x4')), 'degrade');
  assert.equal(R.difference(x('x5')), 'entree');
  assert.equal(R.difference(x('x6')), 'sansEntree');
  assert.equal(R.difference(R.normaliserElement({})), 'vide');
  // Moins bon mais encore neuf, bon ou usage normal : usure, pas dégradation (aucune retenue, sortie conforme).
  const usure = R.normaliserElement({ entree: { etat: 'neuf' }, sortie: { etat: 'usage', cout: 200 } });
  assert.equal(R.difference(usure), 'usure');
  assert.equal(R.difference(R.normaliserElement({ entree: { etat: 'bon' }, sortie: { etat: 'degrade' } })), 'degrade');
  assert.equal(R.difference(R.normaliserElement({ entree: { etat: 'degrade' }, sortie: { etat: 'hs' } })), 'degrade');
  const d2 = R.normaliserDossier({ sortie: { date: '2026-10-01' }, pieces: [{ elements: [usure] }] });
  assert.equal(R.bilanRetenues(d2).total, 0);
  assert.equal(R.conforme(d2), true);
  const diffs = R.differences(d);
  assert.deepEqual(plat(diffs.filter((y) => y.piece.id === 'p1').map((y) => y.x.id)), ['x1', 'x3', 'x2']);
  assert.deepEqual(plat(R.avancement(d, 'entree')), { faits: 5, total: 6, pct: 83 });
  assert.deepEqual(plat(R.avancement(d, 'sortie')), { faits: 5, total: 6, pct: 83 });
});

test('statut du dossier selon l\'avancement', () => {
  const vide = R.normaliserDossier({ pieces: [{ elements: [{ nom: 'Sol' }, { nom: 'Murs' }] }] });
  assert.equal(R.statut(vide), 'preparer');
  vide.pieces[0].elements[0].entree.etat = 'bon';
  assert.equal(R.statut(vide), 'entree');
  vide.pieces[0].elements[1].entree.etat = 'bon';
  assert.equal(R.statut(vide), 'entree'); // date d'entrée manquante
  vide.entree.date = '2026-01-10';
  assert.equal(R.statut(vide), 'occupe');
  vide.pieces[0].elements[0].sortie.etat = 'bon';
  assert.equal(R.statut(vide), 'sortie');
  vide.pieces[0].elements[1].sortie.etat = 'usage';
  vide.sortie.date = '2026-11-01';
  assert.equal(R.statut(vide), 'sortie-faite');
  for (const s of ['preparer', 'entree', 'occupe', 'sortie', 'sortie-faite']) assert.ok(R.STATUTS[s]);
});

test('retenues : coût moins la vétusté, non imputable ignoré, dépôt et reste à rendre', () => {
  const d = dossierType();
  const murs = R.retenueElement(d, d.pieces[0].elements[0]);
  // Pose 2020 (1er juillet) → sortie 15/10/2026 : 6 ans ; (6 − 2) × 10 = 40 % ; 500 × 0,6 = 300.
  assert.equal(murs.age, 6);
  assert.equal(murs.taux, 40);
  assert.equal(murs.retenue, 300);
  const plaques = R.retenueElement(d, d.pieces[1].elements[0]);
  assert.equal(plaques.retenue, 0);
  assert.equal(plaques.imputable, false);
  // Élément non dégradé : jamais de retenue, même avec un coût saisi.
  d.pieces[0].elements[1].sortie.cout = 999;
  assert.equal(R.retenueElement(d, d.pieces[0].elements[1]).retenue, 0);
  const b = R.bilanRetenues(d);
  assert.equal(b.lignes.length, 2);
  assert.equal(b.total, 300);
  assert.equal(b.aRendre, 500);
  assert.equal(b.depassement, 0);
  assert.equal(b.sansCout, 0);
  // Sans grille : coût entier ; sans coût : compté comme manquant.
  const sansGrille = dossierType({ grille: [] });
  assert.equal(R.bilanRetenues(sansGrille).total, 500);
  sansGrille.pieces[0].elements[0].sortie.cout = null;
  assert.equal(R.bilanRetenues(sansGrille).sansCout, 1);
  assert.equal(R.bilanRetenues(sansGrille).total, 0);
  // Ligne de grille sans date de pose : vétusté incomplète, coût entier proposé.
  const sansPose = dossierType();
  sansPose.pieces[0].elements[0].pose = '';
  const r = R.retenueElement(sansPose, sansPose.pieces[0].elements[0]);
  assert.equal(r.incomplet, true);
  assert.equal(r.retenue, 500);
  // Retenues au-delà du dépôt.
  const gros = dossierType({ bail: { depot: 100 } });
  assert.equal(R.bilanRetenues(gros).aRendre, 0);
  assert.equal(R.bilanRetenues(gros).depassement, 200);
  // Dépôt inconnu.
  assert.equal(R.bilanRetenues(dossierType({ bail: {} })).aRendre, null);
  // Centimes : 333,33 × (1 − 0,4) = 200,00 (arrondi au centime).
  const c = dossierType();
  c.pieces[0].elements[0].sortie.cout = 333.33;
  assert.equal(R.bilanRetenues(c).total, 200);
});

test('compteurs et clés : consommation, relevé incohérent, clés manquantes', () => {
  const d = dossierType();
  assert.equal(R.consommation(d.compteurs[0]), 79.75);
  assert.equal(R.consommation(d.compteurs[1]), null);
  assert.equal(R.consommation(R.normaliserCompteur({ entree: 50, sortie: 40 })), -10);
  assert.equal(R.clesManquantes(d.cles[0]), 1);
  assert.equal(R.clesManquantes(d.cles[1]), 0);
  assert.equal(R.clesManquantes(R.normaliserCle({ entree: 2 })), null);
  assert.equal(R.clesManquantes(R.normaliserCle({ entree: 1, sortie: 3 })), 0);
});

test('délais : restitution du dépôt (1 ou 2 mois, fin de mois) et rectification de l\'entrée', () => {
  const reg = R.normaliserReglages({}, B);
  const d = dossierType();
  // Dégradation et clé manquante : non conforme, 2 mois.
  assert.equal(R.conforme(d), false);
  let r = R.restitution(d, reg, '2026-11-14');
  assert.equal(r.mois, 2);
  assert.equal(r.limite, '2026-12-15');
  assert.equal(r.joursRestants, 31);
  // Choix des parties : conforme → 1 mois.
  d.conformite = 'conforme';
  r = R.restitution(d, reg, '2026-11-20');
  assert.equal(r.limite, '2026-11-15');
  assert.equal(r.joursRestants, -5);
  // Automatique conforme quand rien n'est dégradé et toutes les clés sont rendues.
  const ok = R.normaliserDossier({ sortie: { date: '2027-01-31' }, pieces: [{ elements: [{ entree: { etat: 'bon' }, sortie: { etat: 'bon' } }] }], cles: [{ entree: 2, sortie: 2 }] });
  assert.equal(R.conforme(ok), true);
  assert.equal(R.restitution(ok, reg).limite, '2027-02-28');
  assert.equal(R.restitution(R.normaliserDossier({}), reg), null);
  // Réglages modifiés.
  assert.equal(R.restitution(ok, R.normaliserReglages({ restitutionConforme: 3 }, B)).limite, '2027-04-30');
  // Rectification : entrée + 10 jours.
  const rect = R.rectification(dossierType({ entree: { date: '2026-11-08' } }), reg, '2026-11-14');
  assert.equal(rect.limite, '2026-11-18');
  assert.equal(rect.ouvert, true);
  assert.equal(R.rectification(dossierType({ entree: { date: '2026-11-08' } }), reg, '2026-11-19').ouvert, false);
  assert.equal(R.ajoutMois('2024-01-31', 1), '2024-02-29');
  assert.equal(R.ajoutMois('2026-12-15', 2), '2027-02-15');
});

test('points à compléter avant impression (entrée et sortie)', () => {
  const d = dossierType();
  const e = R.manques(d, 'entree');
  assert.deepEqual(plat(e), ['1 élément sans état']);
  const s = R.manques(d, 'sortie');
  assert.ok(s.includes('1 élément sans état'));
  assert.ok(s.includes('1 relevé de compteur'));
  const vide = R.normaliserDossier({});
  const m = R.manques(vide, 'sortie');
  for (const attendu of ['Date de l\'état des lieux de la sortie', 'Adresse du logement', 'Nom du ou des locataires', 'Nom du bailleur', 'Au moins une pièce', 'Clés et moyens d\'accès', 'Nouvelle adresse du locataire', 'Date de l\'état des lieux d\'entrée']) assert.ok(m.includes(attendu), attendu);
  // Le domicile du mandataire suffit.
  const mand = dossierType({ bailleur: { nom: 'X' }, mandataire: { nom: 'Agence', adresse: '1 rue' } });
  assert.ok(!R.manques(mand, 'entree').some((x) => x.startsWith('Domicile')));
});

test('nouveau locataire : logement et éléments repris, entrée = sortie précédente, rien d\'autre', () => {
  const d = dossierType();
  d.pieces[0].elements[0].sortie.photo = 'data:image/jpeg;base64,QUJD';
  const n = R.reprendreDossier(d, '2026-11-14');
  assert.notEqual(n.id, d.id);
  assert.equal(n.logement.adresse, d.logement.adresse);
  assert.equal(n.bailleur.nom, 'Bailleur Fictif');
  assert.equal(n.locataires, '');
  assert.equal(n.entree.date, '');
  assert.equal(n.sortie.date, '');
  assert.equal(n.bail.depot, 800);
  assert.deepEqual(plat(n.grille), []);
  const x = n.pieces[0].elements[0];
  assert.equal(x.entree.etat, 'degrade');
  assert.equal(x.entree.photo, 'data:image/jpeg;base64,QUJD');
  assert.equal(x.sortie.etat, '');
  assert.equal(x.pose, '2020');
  // Sortie non constatée : on reprend l'entrée précédente.
  assert.equal(n.pieces[1].elements[1].entree.etat, 'bon');
  assert.notEqual(n.pieces[0].id, d.pieces[0].id);
  assert.equal(n.compteurs[0].entree, 180.25);
  assert.equal(n.compteurs[1].entree, null);
  assert.equal(n.cles[0].entree, 2);
  assert.equal(n.cles[0].sortie, null);
});

test('photos et taille, titre, CSV', () => {
  const d = dossierType();
  d.pieces[0].elements[0].entree.photo = 'data:image/jpeg;base64,QUJD';
  d.pieces[0].elements[0].sortie.photo = 'data:image/jpeg;base64,REVG';
  const e = R.normaliser({ dossiers: [d] }, B);
  assert.equal(R.nbPhotos(e), 2);
  assert.ok(R.taille(e) > 1000);
  assert.equal(R.titreDossier(d), '1 rue de l\'Exemple');
  assert.equal(R.titreDossier(R.normaliserDossier({ logement: { complement: '2e étage' } })), 'Logement sans adresse, 2e étage');
  const csv = R.csvDossier(d, B);
  assert.ok(csv.startsWith('﻿Pièce;Élément;'));
  assert.ok(csv.includes('Séjour;Murs;Murs;Neuf;;Dégradé;;dégradé;40;500,00;300,00'));
  assert.ok(csv.includes('Cuisine;Joints;Plomberie;;;Usage normal;;sans état d\'entrée;;;'));
  assert.ok(csv.includes('Eau froide;;m³;100,5;180,25;79,75'));
  assert.ok(csv.includes('Porte;3;2;1'));
  // Point-virgule dans un commentaire : cellule entre guillemets.
  d.pieces[0].elements[1].entree.com = 'Rayure ; légère';
  assert.ok(R.csvDossier(d, B).includes('"Rayure ; légère"'));
});
