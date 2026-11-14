// Tests des règles métier du pilotage de parcs multi-sites (templates/parcs-multi-sites/regles.js et donnees.js).
// Date de référence fixe : les résultats ne dépendent jamais du jour où les tests tournent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/parcs-multi-sites/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-14';
const RG = { alerteJours: 30, arretJours: 7, visiteMois: 6, periodeJours: 365 };

const site = (o = {}) => ({ id: 's1', nom: 'Résidence des Tilleuls', type: 'RES', adresse: '', ville: 'Ville A', region: 'Bretagne', responsable: 'Resp. A', lat: null, lon: null, notes: '', ...o });
const equip = (o = {}) => ({ id: 'e1', siteId: 's1', designation: 'Chaudière', categorie: 'CHA', marque: '', modele: '', miseEnService: '2020-01-01', criticite: 'haute', periodiciteMois: 12, reforme: false, notes: '', ...o });
const etat = (o = {}) => ({ reglages: RG, sites: [site()], equipements: [equip()], interventions: [], ...o });
let n = 0;
const id = () => `n${++n}`;

test('base intégrée : codes uniques, aucune marque ni périodicité réglementaire', () => {
  for (const l of [B.typesSites, B.categories, B.criticites, B.typesInterventions]) assert.equal(new Set(l.map((x) => x.code)).size, l.length);
  assert.ok(B.categories.some((c) => c.code === 'AUT') && B.typesSites.some((t) => t.code === 'AUT'));
  assert.ok(B.categories.every((c) => !('mois' in c)), 'aucune périodicité en base');
  assert.equal(B.regions.length, 18);
  assert.deepEqual([B.alerteJours, B.arretJours, B.visiteMois, B.periodeJours], [30, 7, 6, 365]);
});

test('dates : ajout de mois borné, lecture des dates de tableur', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2026-11-14', -6), '2026-05-14');
  assert.equal(R.dateCsv('05/03/2024'), '2024-03-05');
  assert.equal(R.dateCsv('5-3-2024'), '2024-03-05');
  assert.equal(R.dateCsv('2024-03-05'), '2024-03-05');
  assert.equal(R.dateCsv(''), '');
  assert.equal(R.dateCsv('31/02/2024'), undefined);
  assert.equal(R.dateCsv('mars 2024'), undefined);
  assert.equal(R.coord('48,85', 90), 48.85);
  assert.equal(R.coord('', 90), null);
  assert.equal(R.coord('95', 90), undefined);
});

test('état calculé : en service, dégradé, à l\'arrêt (plus ancien arrêt ouvert), réformé', () => {
  const e = etat();
  assert.equal(R.etatEquipement(e, e.equipements[0]).code, 'service');
  e.interventions.push({ id: 'c1', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-11-10', resolu: '', arret: false });
  assert.equal(R.etatEquipement(e, e.equipements[0]).code, 'degrade');
  e.interventions.push({ id: 'c2', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-11-01', resolu: '', arret: true });
  assert.deepEqual(R.etatEquipement(e, e.equipements[0]), { code: 'arret', depuis: '2026-11-01', interventionId: 'c2' });
  e.interventions[1].resolu = '2026-11-12';
  assert.equal(R.etatEquipement(e, e.equipements[0]).code, 'degrade');
  assert.equal(R.etatEquipement(e, { ...e.equipements[0], reforme: true }).code, 'reforme');
});

test('échéance du préventif : depuis la mise en service, puis depuis le dernier préventif réalisé', () => {
  const e = etat({ equipements: [equip({ miseEnService: '2025-11-30', periodiciteMois: 12 })] });
  let p = R.echeancePreventif(e, e.equipements[0], AUJ, 30);
  assert.equal(p.echeance, '2026-11-30');
  assert.equal(p.etat, 'proche');
  assert.equal(p.jours, 16);
  e.interventions.push({ id: 'p1', type: 'preventif', siteId: 's1', equipementId: 'e1', date: '2026-05-10', echeance: '2026-11-30' });
  p = R.echeancePreventif(e, e.equipements[0], AUJ, 30);
  assert.equal(p.echeance, '2027-05-10');
  assert.equal(p.etat, 'ok');
  e.equipements[0].periodiciteMois = 3;
  p = R.echeancePreventif(e, e.equipements[0], AUJ, 30);
  assert.equal(p.echeance, '2026-08-10');
  assert.equal(p.etat, 'retard');
  assert.equal(R.echeancePreventif(e, { ...e.equipements[0], periodiciteMois: 0 }, AUJ, 30).etat, 'sans');
  assert.equal(R.echeancePreventif(e, { ...e.equipements[0], reforme: true }, AUJ, 30).etat, 'sans');
  // Date de départ saisie quand l'équipement est repris en cours de vie.
  const e2 = etat({ equipements: [equip({ miseEnService: '', depuis: '2026-10-01', periodiciteMois: 6 })] });
  assert.equal(R.echeancePreventif(e2, e2.equipements[0], AUJ, 30).echeance, '2027-04-01');
});

test('disponibilité : arrêts superposés comptés une fois, bornés à la période et à la mise en service', () => {
  const e = etat({ interventions: [
    { id: 'a', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-10-01', resolu: '2026-10-11', arret: true },
    { id: 'b', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-10-05', resolu: '2026-10-15', arret: true },
    { id: 'c', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-11-04', resolu: '', arret: true },
    { id: 'd', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-09-01', resolu: '2026-09-30', arret: false },
  ] });
  // 01/10 → 15/10 = 14 jours, 04/11 → 14/11 = 10 jours.
  assert.equal(R.joursArret(e, 'e1', '2026-08-16', AUJ), 24);
  assert.equal(R.joursArret(e, 'e1', '2026-10-10', AUJ), 15); // 10/10 → 15/10 + 10 jours
  const d = R.disponibilite(e, e.equipements[0], AUJ, 90);
  assert.equal(Math.round(d * 1000), Math.round((1 - 24 / 90) * 1000));
  // Mis en service il y a 20 jours : la période commence à la mise en service.
  const e2 = { ...e, equipements: [equip({ miseEnService: '2026-10-25' })] };
  assert.equal(Math.round(R.disponibilite(e2, e2.equipements[0], AUJ, 90) * 100), 50);
  assert.equal(R.disponibilite(e, { ...e.equipements[0], reforme: true }, AUJ, 90), null);
});

test('indicateurs d\'un site : délai moyen, taux de préventif à temps, coûts par catégorie et par type', () => {
  const e = etat({
    sites: [site(), site({ id: 's2', nom: 'Entrepôt Nord' })],
    equipements: [equip(), equip({ id: 'e2', categorie: 'ASC', designation: 'Ascenseur' }), equip({ id: 'e3', siteId: 's2', categorie: 'POR', designation: 'Portail' }), equip({ id: 'e4', reforme: true })],
    interventions: [
      { id: 'i1', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-06-01', resolu: '2026-06-05', arret: true, cout: '300' },
      { id: 'i2', type: 'correctif', siteId: 's1', equipementId: 'e2', signale: '2026-07-01', resolu: '2026-07-03', arret: false, cout: 150.5 },
      { id: 'i3', type: 'correctif', siteId: 's1', equipementId: 'e2', signale: '2026-11-10', resolu: '', arret: true, cout: '' },
      { id: 'i4', type: 'preventif', siteId: 's1', equipementId: 'e1', date: '2026-03-01', echeance: '2026-03-15', cout: 200 },
      { id: 'i5', type: 'preventif', siteId: 's1', equipementId: 'e2', date: '2026-04-20', echeance: '2026-04-01', cout: 100 },
      { id: 'i6', type: 'visite', siteId: 's1', date: '2026-09-01', cout: 50 },
      { id: 'i7', type: 'preventif', siteId: 's1', equipementId: 'e1', date: '2025-01-01', echeance: '2025-01-01', cout: 999 }, // hors période
      { id: 'i8', type: 'correctif', siteId: 's2', equipementId: 'e3', signale: '2026-08-01', resolu: '2026-08-11', arret: true, cout: 400 },
    ] });
  const i = R.indicateurs(e, B, { auj: AUJ, periodeJours: 365, alerteJours: 30, siteIds: ['s1'] });
  assert.equal(i.equipements, 2);
  assert.equal(i.reformes, 1);
  assert.equal(i.arret, 1);
  assert.equal(i.correctifsOuverts, 1);
  assert.equal(i.resolus, 2);
  assert.equal(i.delaiMoyen, 3);
  assert.equal(i.preventifsRealises, 2);
  assert.equal(i.tauxATemps, 0.5);
  assert.equal(i.cout, 800.5);
  assert.deepEqual(i.parCategorie, { CHA: 500, ASC: 250.5, SITE: 50 });
  assert.deepEqual(i.parType, { preventif: 300, correctif: 450.5, visite: 50 });
  const tous = R.indicateurs(e, B, { auj: AUJ, periodeJours: 365, alerteJours: 30, siteIds: null });
  assert.equal(tous.equipements, 3);
  assert.equal(tous.cout, 1200.5);
  assert.equal(tous.delaiMoyen, 5.3); // (4 + 2 + 10) / 3
  assert.ok(tous.disponibilite > 0.9 && tous.disponibilite < 1);
  const vide = R.indicateurs({ ...e, interventions: [] }, B, { auj: AUJ, periodeJours: 365, alerteJours: 30, siteIds: ['s2'] });
  assert.equal(vide.delaiMoyen, null);
  assert.equal(vide.tauxATemps, null);
  assert.equal(vide.disponibilite, 1);
});

test('alertes : préventif dépassé ou proche, arrêt depuis N jours, site sans visite depuis N mois', () => {
  const e = etat({
    sites: [site(), site({ id: 's2', nom: 'Entrepôt Nord' }), site({ id: 's3', nom: 'Centre commercial du Parc' })],
    equipements: [equip({ miseEnService: '2025-10-01' }), equip({ id: 'e2', siteId: 's2', miseEnService: '2025-12-01' }), equip({ id: 'e3', siteId: 's3', periodiciteMois: 0 })],
    interventions: [
      { id: 'c1', type: 'correctif', siteId: 's2', equipementId: 'e2', signale: '2026-11-01', resolu: '', arret: true },
      { id: 'v1', type: 'visite', siteId: 's2', date: '2026-10-01' },
      { id: 'v2', type: 'visite', siteId: 's1', date: '2026-03-01' },
    ] });
  const al = R.alertes(e, B, AUJ);
  const types = al.map((a) => `${a.type}:${a.etat}:${a.siteId}`);
  assert.deepEqual(types, ['visite:retard:s1', 'preventif:retard:s1', 'arret:retard:s2', 'visite:proche:s3', 'preventif:proche:s2']);
  assert.match(al.find((a) => a.type === 'arret').titre, /13 jours/);
  assert.equal(R.etatSite(al, 's1'), 'retard');
  assert.equal(R.etatSite(al, 's3'), 'proche');
  // Arrêt récent : signalé sans dépasser le seuil.
  e.interventions[0].signale = '2026-11-12';
  assert.equal(R.alertes(e, B, AUJ).find((a) => a.type === 'arret').etat, 'proche');
  // Site inactif : pas d'alerte de visite.
  e.sites[2].inactif = true;
  assert.ok(!R.alertes(e, B, AUJ).some((a) => a.siteId === 's3'));
});

test('liste des sites : filtres (texte, région, type, état) et tri', () => {
  const l = [
    { site: site({ id: 'a', nom: 'Entrepôt Nord', region: 'Hauts-de-France', type: 'ENT', ville: 'Ville N' }), ind: { equipements: 4, disponibilite: 0.95, enRetard: 2, cout: 900, delaiMoyen: 3 }, etat: 'retard' },
    { site: site({ id: 'b', nom: 'Résidence des Tilleuls', region: 'Bretagne', type: 'RES' }), ind: { equipements: 6, disponibilite: 0.99, enRetard: 0, cout: 1200, delaiMoyen: null }, etat: 'ok' },
    { site: site({ id: 'c', nom: 'Écoles du Centre', region: 'bretagne', type: 'ERP' }), ind: { equipements: 2, disponibilite: null, enRetard: 0, cout: 0, delaiMoyen: 8 }, etat: 'proche' },
  ];
  assert.deepEqual(R.filtrerSites(l, { region: 'Bretagne' }).map((x) => x.site.id), ['b', 'c']);
  assert.deepEqual(R.filtrerSites(l, { texte: 'ecole' }).map((x) => x.site.id), ['c']);
  assert.deepEqual(R.filtrerSites(l, { etat: 'alerte' }).map((x) => x.site.id), ['a', 'c']);
  assert.deepEqual(R.filtrerSites(l, { type: 'RES' }).map((x) => x.site.id), ['b']);
  assert.deepEqual(R.trierSites(l, { cle: 'nom', sens: 1 }).map((x) => x.site.id), ['c', 'a', 'b']);
  assert.deepEqual(R.trierSites(l, { cle: 'cout', sens: -1 }).map((x) => x.site.id), ['b', 'a', 'c']);
  assert.deepEqual(R.trierSites(l, { cle: 'etat', sens: 1 }).map((x) => x.site.id), ['a', 'c', 'b']);
  assert.deepEqual(R.trierSites(l, { cle: 'disponibilite', sens: 1 }).map((x) => x.site.id), ['a', 'b', 'c']); // sans valeur en dernier
});

test('carte schématique : projection cadrée, nord en haut, grille par région pour les autres', () => {
  const s = [site({ id: 'n', lat: 50.6, lon: 3.1 }), site({ id: 's', lat: 43.3, lon: 5.4 }), site({ id: 'o', lat: 47.2, lon: -1.6 }), site({ id: 'x', region: '' })];
  const p = R.projeter(s, 600, 420, 40);
  assert.equal(p.points.length, 3);
  const pt = Object.fromEntries(p.points.map((q) => [q.id, q]));
  assert.ok(pt.n.y < pt.s.y, 'le nord est en haut');
  assert.ok(pt.o.x < pt.n.x, 'l\'ouest est à gauche');
  for (const q of p.points) assert.ok(q.x >= 40 - 0.1 && q.x <= 560.1 && q.y >= 40 - 0.1 && q.y <= 380.1);
  assert.equal(R.projeter([site()]), null);
  const un = R.projeter([site({ lat: 45, lon: 4 })], 600, 420, 40);
  assert.deepEqual([un.points[0].x, un.points[0].y], [300, 210]);
  const g = R.grilleRegions([site({ id: 'a', nom: 'B', region: 'Occitanie' }), site({ id: 'b', nom: 'A', region: '' }), site({ id: 'c', nom: 'A', region: 'Bretagne' }), site({ id: 'd', nom: 'C', region: 'Occitanie' })]);
  assert.deepEqual(g.map((x) => x.region), ['Bretagne', 'Occitanie', 'Sans région']);
  assert.deepEqual(g[1].sites.map((x) => x.nom), ['B', 'C']);
});

test('CSV : point-virgule, BOM, guillemets, formules neutralisées, décimales à virgule', () => {
  assert.equal(R.champCsv('a;b'), '"a;b"');
  assert.equal(R.champCsv('dit "oui"'), '"dit ""oui"""');
  assert.equal(R.champCsv('=SOMME(A1)'), '\'=SOMME(A1)');
  assert.equal(R.champCsv(12.5), '12,5');
  assert.equal(R.champCsv(-3), '-3');
  const m = R.csvModele('sites');
  assert.ok(m.startsWith('﻿Nom;Type;Adresse;Ville;Région;Responsable;Latitude;Longitude;Notes\r\n'));
  assert.ok(R.csvModele('equipements').startsWith('﻿Site;Désignation;Catégorie;Marque;Modèle;Mise en service;Criticité;Périodicité préventive (mois);Notes'));
  const e = etat({ sites: [site({ lat: 48.11, lon: -1.68, notes: 'Accès; code "B12"' })],
    interventions: [{ id: 'i1', type: 'correctif', siteId: 's1', equipementId: 'e1', signale: '2026-11-01', resolu: '2026-11-04', arret: true, cout: '120,50', libelle: '=danger', prestataire: 'Prestataire A' }] });
  const cs = R.csvSites(e, B, AUJ);
  const l = R.lireCsv(cs);
  assert.equal(l[0][0], 'Nom');
  assert.equal(l[1][0], 'Résidence des Tilleuls');
  assert.equal(l[1][6], '48,11');
  assert.equal(l[1][8], 'Accès; code "B12"');
  const ci = R.lireCsv(R.csvInterventions(e, B));
  assert.deepEqual(ci[1].slice(0, 4), ['04/11/2026', 'Correctif', 'Résidence des Tilleuls', 'Chaudière']);
  assert.equal(ci[1][5], '=danger'); // apostrophe de neutralisation retirée à la relecture
  assert.equal(ci[1][10], 'oui');
  assert.equal(ci[1][11], '3');
  assert.equal(ci[1][12], '120,5');
  const ce = R.lireCsv(R.csvEquipements(e, B, AUJ));
  assert.equal(ce[0].length, 13);
  assert.equal(ce[1][9], 'En service');
});

test('lecture CSV : virgule ou tabulation détectées, retours à la ligne dans les champs, lignes vides', () => {
  assert.deepEqual(R.lireCsv('a,b\r\n1,"x, y"\n\n'), [['a', 'b'], ['1', 'x, y']]);
  assert.deepEqual(R.lireCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(R.lireCsv('﻿a;b\n"ligne 1\nligne 2";z'), [['a', 'b'], ['ligne 1\nligne 2', 'z']]);
});

test('import des sites : ajout, mise à jour par nom, type et coordonnées contrôlés', () => {
  const e = etat();
  const csv = '﻿nom;TYPE;Ville;Région;Latitude;Longitude\r\nrésidence des tilleuls;Résidence;Ville B;Bretagne;48,1;-1,7\r\nEntrepôt Nord;Entrepôt;Ville N;Hauts-de-France;;\r\nSite X;Château;;;91;2\r\n;Bureaux;;;;\r\n';
  const r = R.importerSites(e, B, csv, id);
  assert.equal(r.majs, 1);
  assert.equal(r.ajouts, 2);
  assert.equal(r.sites.length, 3);
  assert.equal(r.sites[0].ville, 'Ville B');
  assert.equal(r.sites[0].lat, 48.1);
  assert.equal(r.sites[0].nom, 'Résidence des Tilleuls'); // le nom existant est conservé
  assert.equal(r.sites[1].type, 'ENT');
  assert.equal(r.sites[1].lat, null);
  assert.equal(r.sites[2].type, 'AUT');
  assert.equal(r.erreurs.length, 3); // type inconnu, latitude hors bornes, nom manquant
  assert.equal(e.sites[0].ville, 'Ville A', 'l\'état d\'origine n\'est pas modifié');
  assert.match(R.importerSites(e, B, 'Ville;Région\nA;B', id).erreurs[0], /Nom/);
});

test('import des équipements : site par nom, catégorie, criticité, date et périodicité', () => {
  const e = etat({ sites: [site(), site({ id: 's2', nom: 'Entrepôt Nord' })] });
  const csv = R.csvModele('equipements') + [
    'Résidence des Tilleuls;chaudière;Chauffage, eau chaude;;;01/02/2019;haute;6;',
    'Entrepôt Nord;Porte sectionnelle quai 1;Portes et portails automatiques;Marque libre;M1;2021-05-10;Moyenne;12;Quai est',
    'Entrepôt Nord;Pont roulant;Levage;;;10/13/2020;extrême;douze;',
    'Site inconnu;Pompe;Plomberie, pompes;;;;;;',
  ].join('\r\n');
  const r = R.importerEquipements(e, B, csv, id);
  assert.equal(r.majs, 1);
  assert.equal(r.ajouts, 2);
  const ch = r.equipements.find((x) => x.id === 'e1');
  assert.equal(ch.periodiciteMois, 6);
  assert.equal(ch.miseEnService, '2019-02-01');
  const po = r.equipements.find((x) => x.designation === 'Porte sectionnelle quai 1');
  assert.deepEqual([po.siteId, po.categorie, po.criticite, po.miseEnService, po.notes], ['s2', 'POR', 'moyenne', '2021-05-10', 'Quai est']);
  const pr = r.equipements.find((x) => x.designation === 'Pont roulant');
  assert.deepEqual([pr.categorie, pr.criticite, pr.periodiciteMois, pr.miseEnService], ['AUT', 'moyenne', 12, '']);
  assert.equal(r.erreurs.length, 5); // catégorie, criticité, date, périodicité, site inconnu
  assert.ok(r.erreurs.some((x) => /Site inconnu/.test(x)));
});

test('aller-retour : un export des sites et des équipements se réimporte sans doublon', () => {
  const e = etat({ sites: [site({ lat: 45.76, lon: 4.84 }), site({ id: 's2', nom: 'Entrepôt Nord', type: 'ENT' })], equipements: [equip(), equip({ id: 'e2', siteId: 's2', designation: 'Quai', categorie: 'MAN', criticite: 'basse', periodiciteMois: 6 })] });
  const rs = R.importerSites(e, B, R.csvSites(e, B, AUJ), id);
  assert.deepEqual([rs.ajouts, rs.majs, rs.erreurs.length], [0, 2, 0]);
  assert.deepEqual(rs.sites, e.sites);
  const re = R.importerEquipements(e, B, R.csvEquipements(e, B, AUJ), id);
  assert.deepEqual([re.ajouts, re.majs, re.erreurs.length], [0, 2, 0]);
  assert.deepEqual(re.equipements, e.equipements);
});
