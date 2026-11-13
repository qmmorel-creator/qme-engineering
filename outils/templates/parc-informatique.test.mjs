// Tests des règles métier de la gestion de parc informatique (templates/parc-informatique/regles.js et donnees.js).
// Date de référence fixe : les tests ne dépendent jamais de la date du jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/parc-informatique/', import.meta.url);
const ctxVm = { window: {}, TextEncoder };
vm.createContext(ctxVm);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctxVm);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctxVm);
const R = ctxVm.window.REGLES;
const B = ctxVm.window.BASE;
const AUJ = '2026-11-12';

const mat = (o = {}) => ({ id: 'm1', inventaire: 'INV-001', categorie: 'portable', designation: 'Portable 14 pouces', serie: 'SN-A1', fournisseur: 'Revendeur', achat: '2025-01-15', prix: 900, garantie: 24, statut: 'actif', etat: 'bon', localisation: '', note: '', ...o });
const per = (o = {}) => ({ id: 'p1', nom: 'Camille R.', service: 'Compta', arrivee: '2024-01-01', depart: null, ...o });
const lic = (o = {}) => ({ id: 'l1', nom: 'Suite bureautique', categorie: 'Suite bureautique', type: 'abo-an-util', postes: 2, echeance: '2027-03-01', cout: 300, attributions: [], ...o });
const reglages = { alertes: { ...B.alertes }, categories: Object.fromEntries(B.categories.map((c) => [c.id, { garantie: c.garantie, renouvellement: c.renouvellement }])) };
const json = (x) => JSON.parse(JSON.stringify(x)); // objets créés dans un autre contexte vm

test('base intégrée : catégories uniques, types de licence cohérents, aucune marque', () => {
  assert.equal(B.categories.length, 14);
  assert.equal(new Set(B.categories.map((c) => c.id)).size, 14);
  assert.ok(B.categories.every((c) => c.garantie > 0 && c.renouvellement > 0));
  assert.equal(B.typesLicence.length, 8);
  assert.ok(B.typesLicence.every((t) => ['personne', 'materiel'].includes(t.mode) && [0, 1, 12].includes(t.periode)));
  assert.equal(B.categoriesLogiciel.length, 11);
  assert.match(B.rgpd.url, /^https:\/\/www\.cnil\.fr\//);
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8').toLowerCase();
  for (const marque of ['microsoft', 'office 365', 'windows', 'apple', 'macbook', 'iphone', 'dell', 'lenovo', 'adobe', 'google', 'samsung', 'cisco', 'kaspersky']) assert.ok(!texte.includes(marque), marque);
});

test('dates : ajout de mois borné à la fin du mois, mois révolus', () => {
  assert.equal(R.ajoutMois('2024-01-31', 1), '2024-02-29');
  assert.equal(R.ajoutMois('2025-01-31', 1), '2025-02-28');
  assert.equal(R.ajoutMois('2026-11-15', 2), '2027-01-15');
  assert.equal(R.ajoutMois('2026-03-31', -1), '2026-02-28');
  assert.equal(R.moisEntre('2025-01-15', '2026-11-12'), 21);
  assert.equal(R.moisEntre('2025-01-15', '2026-11-15'), 22);
  assert.equal(R.moisEntre('2024-01-31', '2024-02-29'), 1);
  assert.equal(R.moisEntre('2024-01-31', '2024-02-28'), 0);
  assert.ok(R.estDate('2028-02-29'));
  assert.ok(!R.estDate('2026-02-29'));
});

test('garantie : dernier jour couvert, expirée, proche, sans date', () => {
  assert.equal(R.finGarantie(mat()), '2027-01-14');
  assert.equal(R.finGarantie(mat({ achat: '2024-01-31', garantie: 1 })), '2024-02-28');
  assert.deepEqual(json(R.garantie(mat(), AUJ, 60)), { etat: 'ok', fin: '2027-01-14', jours: 63 });
  assert.equal(R.garantie(mat(), AUJ, 63).etat, 'proche'); // le 63e jour est inclus dans la fenêtre
  assert.equal(R.garantie(mat({ achat: '2024-11-12' }), AUJ).etat, 'expiree'); // fin le 11/11/2026
  assert.equal(R.garantie(mat({ achat: '2024-11-12' }), AUJ).jours, -1);
  assert.equal(R.garantie(mat({ achat: '2024-11-13' }), AUJ).jours, 0); // dernier jour couvert : aujourd'hui
  assert.equal(R.garantie(mat({ achat: '2024-11-13' }), AUJ).etat, 'proche');
  assert.equal(R.garantie(mat({ achat: '' }), AUJ).etat, 'aucune');
  assert.equal(R.garantie(mat({ garantie: 0 }), AUJ).etat, 'aucune');
});

test('âge et matériel ancien selon la durée de renouvellement', () => {
  assert.equal(R.ageMois(mat({ achat: '2022-11-12' }), AUJ), 48);
  assert.equal(R.ageMois(mat({ achat: '2022-11-13' }), AUJ), 47);
  assert.equal(R.ageTexte(48), '4 ans');
  assert.equal(R.ageTexte(14), '1 an 2 mois');
  assert.equal(R.ageTexte(5), '5 mois');
  assert.equal(R.ancien(mat({ achat: '2022-11-12' }), AUJ, 4), true);
  assert.equal(R.ancien(mat({ achat: '2022-11-13' }), AUJ, 4), false);
  assert.equal(R.ancien(mat({ achat: '2010-01-01', statut: 'sorti' }), AUJ, 4), false); // hors parc : jamais signalé
  assert.equal(R.ageMois(mat({ achat: '2027-01-01' }), AUJ), null);
});

test('affectations : statut, une seule ouverte, chevauchements, restitution', () => {
  const m = mat();
  let affs = R.affecter([], m, { id: 'a1', personneId: 'p1', date: '2025-02-01', etat: 'neuf' });
  assert.equal(R.statut(m, affs), 'affecte');
  assert.equal(R.affectationOuverte(affs, 'm1').personneId, 'p1');
  assert.throws(() => R.affecter(affs, m, { id: 'a2', personneId: 'p2', date: '2026-01-01' }), /déjà affecté/);
  affs = R.restituer(affs, 'a1', { date: '2026-03-10', etat: 'use', note: 'clavier usé' });
  assert.equal(R.statut(m, affs), 'stock');
  assert.equal(affs[0].fin, '2026-03-10');
  assert.equal(affs[0].etatRetour, 'use');
  assert.throws(() => R.restituer(affs, 'a1', { date: '2026-03-11' }), /déjà restitué/);
  // Remis le jour même de la restitution : autorisé ([debut, fin[).
  affs = R.affecter(affs, m, { id: 'a2', personneId: 'p2', date: '2026-03-10' });
  assert.equal(affs.length, 2);
  assert.deepEqual(json(R.historiqueMateriel(affs, 'm1').map((a) => a.id)), ['a2', 'a1']);
  // Saisie d'une ancienne période qui chevauche.
  assert.throws(() => R.verifierAffectation(affs, { id: 'x', materielId: 'm1', personneId: 'p3', debut: '2025-06-01', fin: '2025-07-01' }, m), /conflit/);
  assert.ok(R.verifierAffectation(affs, { id: 'x', materielId: 'm1', personneId: 'p3', debut: '2025-01-20', fin: '2025-02-01' }, m));
  assert.throws(() => R.verifierAffectation([], { id: 'x', materielId: 'm1', personneId: 'p3', debut: '2025-03-01', fin: '2025-02-01' }, m), /précéder/);
  assert.throws(() => R.verifierAffectation([], { id: 'x', materielId: 'm1', personneId: 'p3', debut: '2024-12-01' }, m), /achat/);
  assert.throws(() => R.affecter([], mat({ statut: 'sorti' }), { id: 'x', personneId: 'p1', date: '2026-01-01' }), /sorti du parc/);
  assert.throws(() => R.affecter([], m, { id: 'x', personneId: 'p1', date: '2026-01-01', personne: per({ depart: '2025-12-31' }) }), /quitté/);
  assert.throws(() => R.restituer(R.affecter([], m, { id: 'z', personneId: 'p1', date: '2026-01-01' }), 'z', { date: '2025-12-31' }), /précéder/);
});

test('statut affiché : réparation, perdu, sorti priment sur l\'affectation', () => {
  const affs = [{ id: 'a', materielId: 'm1', personneId: 'p1', debut: '2025-02-01', fin: null }];
  assert.equal(R.statut(mat({ statut: 'reparation' }), affs), 'reparation');
  assert.equal(R.statut(mat({ statut: 'perdu' }), affs), 'perdu');
  assert.equal(R.statut(mat({ statut: 'sorti' }), []), 'sorti');
});

test('licences : attribuées, disponibles, dépassement, échéance, renouvellement', () => {
  let l = lic();
  l = R.attribuer(l, 'personne', 'p1', AUJ, 'x1');
  l = R.attribuer(l, 'personne', 'p2', AUJ, 'x2');
  assert.equal(R.attribuees(l), 2);
  assert.equal(R.disponibles(l), 0);
  assert.equal(R.surAttribuee(l), false);
  assert.throws(() => R.attribuer(l, 'personne', 'p1', AUJ, 'x3'), /Déjà/);
  l = R.attribuer(l, 'personne', 'p3', AUJ, 'x3');
  assert.equal(R.surAttribuee(l), true);
  assert.equal(R.disponibles(l), -1);
  l = R.liberer(l, 'x3');
  assert.equal(R.attribuees(l), 2);
  assert.equal(R.echeance(lic({ echeance: '2026-12-01' }), AUJ, 60).etat, 'proche');
  assert.equal(R.echeance(lic({ echeance: '2026-12-01' }), AUJ, 60).jours, 19);
  assert.equal(R.echeance(lic({ echeance: '2026-11-11' }), AUJ).etat, 'expiree');
  assert.equal(R.echeance(lic({ echeance: AUJ }), AUJ).etat, 'proche');
  assert.equal(R.echeance(lic({ echeance: '2027-06-01' }), AUJ).etat, 'ok');
  assert.equal(R.echeance(lic({ echeance: '' }), AUJ).etat, 'sans');
  assert.equal(R.renouveler(lic({ echeance: '2026-12-01' }), B.typesLicence).echeance, '2027-12-01');
  assert.equal(R.renouveler(lic({ type: 'abo-mois-util', echeance: '2027-01-31' }), B.typesLicence).echeance, '2027-02-28');
  assert.throws(() => R.renouveler(lic({ type: 'perp-poste' }), B.typesLicence), /pas d'échéance/);
});

// État complet pour la restitution et les alertes.
function etatTest() {
  return {
    personnes: [per(), per({ id: 'p2', nom: 'Hugo M.', depart: '2026-11-05' }), per({ id: 'p3', nom: 'Inès T.', depart: '2026-11-20' }), per({ id: 'p4', nom: 'Jules B.', depart: '2026-10-01' })],
    materiels: [
      mat(), // garantie le 14/01/2027 : hors fenêtre de 60 j
      mat({ id: 'm2', inventaire: 'INV-002', serie: 'SN-B2', achat: '2024-12-20' }), // garantie jusqu'au 19/12/2026 : proche (37 j)
      mat({ id: 'm3', inventaire: 'INV-003', serie: 'SN-C3', categorie: 'smartphone', achat: '2023-06-01' }), // 41 mois, renouvellement 3 ans : ancien
      mat({ id: 'm4', inventaire: 'INV-004', serie: 'SN-D4', statut: 'reparation', statutDepuis: '2026-09-01' }), // réparation longue
      mat({ id: 'm5', inventaire: 'INV-005', serie: '', statut: 'sorti', achat: '2015-01-01' }),
    ],
    affectations: [
      { id: 'a1', materielId: 'm1', personneId: 'p2', debut: '2025-02-01', fin: null },
      { id: 'a2', materielId: 'm3', personneId: 'p3', debut: '2023-06-02', fin: null },
      { id: 'a3', materielId: 'm2', personneId: 'p4', debut: '2025-01-05', fin: '2026-09-30' },
    ],
    licences: [
      lic({ attributions: [{ id: 'x1', cible: 'personne', cibleId: 'p1' }, { id: 'x2', cible: 'personne', cibleId: 'p2' }, { id: 'x3', cible: 'personne', cibleId: 'p4' }] }), // 3 pour 2, dont 2 parties
      lic({ id: 'l2', nom: 'Sécurité des postes', type: 'abo-an-poste', postes: 5, echeance: '2026-11-30', attributions: [{ id: 'y1', cible: 'materiel', cibleId: 'm1' }, { id: 'y2', cible: 'materiel', cibleId: 'm5' }] }),
      lic({ id: 'l3', nom: 'Sauvegarde', type: 'abo-an-util', postes: 1, echeance: '2026-10-31', attributions: [] }),
      lic({ id: 'l4', nom: 'CAO', type: 'perp-poste', postes: 1, echeance: '', attributions: [] }),
    ],
  };
}

test('restitution au départ : matériel détenu, licences de la personne et de ses matériels', () => {
  const e = etatTest();
  const r = R.restitution(e, 'p2');
  assert.deepEqual(json(r.materiels.map((a) => a.materielId)), ['m1']);
  assert.deepEqual(json(r.licences.map((x) => x.attribution.id)), ['x2', 'y1']);
  const r4 = R.restitution(e, 'p4'); // matériel déjà rendu, licence encore attribuée
  assert.equal(r4.materiels.length, 0);
  assert.equal(r4.licences.length, 1);
  assert.equal(R.partie(e.personnes[1], AUJ), true);
  assert.equal(R.partie(per({ depart: AUJ }), AUJ), false); // présente le jour de son départ
});

test('alertes : toutes les règles, triées par gravité puis date', () => {
  const e = etatTest();
  const a = R.alertes(e, AUJ, reglages);
  const types = json(a.map((x) => `${x.gravite}:${x.type}`));
  assert.deepEqual(types, [
    '0:depart', // Jules B., parti le 01/10 avec une licence
    '0:licence-expiree', // Sauvegarde, 31/10
    '0:depart', // Hugo M., parti le 05/11 avec INV-001
    '0:licence-depassement', // Suite bureautique, 3 pour 2
    '1:reparation', // depuis le 01/09
    '1:licence-liberer', // Sécurité des postes : INV-005 sorti (même date : ordre alphabétique)
    '1:licence-liberer', // Suite bureautique : Hugo M. et Jules B.
    '1:depart', // Inès T., le 20/11
    '1:licence-echeance', // Sécurité des postes, 30/11
    '1:garantie', // INV-002, 19/12
    '2:ancien', // INV-003
  ]);
  const lib = a.find((x) => x.type === 'licence-liberer' && x.ref.licence === 'l1');
  assert.match(lib.detail, /Hugo M\..*Jules B\./);
  assert.match(a.find((x) => x.type === 'depart' && x.gravite === 1).titre, /dans 8 jours/);
  // Aucune alerte sur un parc vide.
  assert.equal(R.alertes({ personnes: [], materiels: [], affectations: [], licences: [] }, AUJ, reglages).length, 0);
});

test('indicateurs et répartition par catégorie (hors matériel sorti ou perdu)', () => {
  const e = etatTest();
  const i = R.indicateurs(e, AUJ);
  assert.equal(i.total, 4);
  assert.equal(i.affecte, 2);
  assert.equal(i.stock, 1);
  assert.equal(i.reparation, 1);
  assert.equal(i.sorti, 1);
  assert.equal(i.valeur, 3600);
  assert.equal(i.postes, 9);
  assert.equal(i.attribuees, 5);
  assert.equal(i.sousGarantie, 3); // m1, m2, m4 ; m3 (smartphone 2023) est hors garantie
  const p = json(R.parCategorie(e));
  assert.deepEqual(p, [{ categorie: 'portable', affecte: 1, stock: 1, reparation: 1, total: 3 }, { categorie: 'smartphone', affecte: 1, stock: 0, reparation: 0, total: 1 }]);
});

test('numéros d\'inventaire, doublons et filtres', () => {
  const e = etatTest();
  assert.equal(R.prochainInventaire(e.materiels), 'INV-006');
  assert.equal(R.prochainInventaire([]), 'INV-001');
  assert.equal(R.prochainInventaire([mat({ inventaire: 'PC-COMPTA' }), mat({ inventaire: 'inv-041' })]), 'INV-042');
  assert.equal(R.doublon(e.materiels, 'serie', 'sn-b2 ', 'm1').id, 'm2');
  assert.equal(R.doublon(e.materiels, 'serie', 'SN-B2', 'm2'), null);
  assert.equal(R.doublon(e.materiels, 'serie', '', 'm1'), null);
  const f = (o) => R.filtrer(e.materiels, e.affectations, o, AUJ, 60, (m) => (m.id === 'm1' ? 'Hugo M.' : '')).map((m) => m.id);
  assert.deepEqual(json(f({})), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(json(f({ statut: 'tous' })), ['m1', 'm2', 'm3', 'm4', 'm5']);
  assert.deepEqual(json(f({ statut: 'stock' })), ['m2']);
  assert.deepEqual(json(f({ statut: 'sorti' })), ['m5']);
  assert.deepEqual(json(f({ garantie: 'proche' })), ['m2']);
  assert.deepEqual(json(f({ categorie: 'smartphone' })), ['m3']);
  assert.deepEqual(json(f({ texte: 'hugo' })), ['m1']);
  assert.deepEqual(json(f({ texte: 'sn-c3' })), ['m3']);
});

test('exports CSV : point-virgule, BOM, formules neutralisées, détenteur et fin de garantie', () => {
  const e = etatTest();
  e.materiels[0].note = '=SOMME(A1)';
  const ctx = { categories: B.categories, etats: B.etats, types: B.typesLicence, fenetre: 60 };
  const inv = R.csvInventaire(e, AUJ, ctx);
  assert.ok(inv.startsWith('﻿N° inventaire;Catégorie;'));
  const l1 = inv.split('\r\n')[1].split(';');
  assert.equal(l1[0], 'INV-001');
  assert.equal(l1[8], '14/01/2027');
  assert.equal(l1[11], 'Affecté');
  assert.equal(l1[13], 'Hugo M.');
  assert.equal(l1[18], '\'=SOMME(A1)');
  const aff = R.csvAffectations(e, ctx).split('\r\n');
  assert.equal(aff.length, 5); // en-tête, 3 lignes, fin
  assert.match(aff[1], /^Inès T\./);
  assert.match(aff[3], /En cours/);
  const li = R.csvLicences(e, AUJ, ctx).split('\r\n');
  assert.match(li.find((x) => x.startsWith('Sauvegarde')), /;Expirée;/);
  assert.match(li.find((x) => x.startsWith('Suite')), /;2;3;-1;/);
  assert.equal(R.champCsv('a;b'), '"a;b"');
});

test('anonymisation RGPD : seulement une personne partie qui a tout rendu', () => {
  const e = etatTest();
  assert.throws(() => R.anonymiser(e, 'p2', AUJ), /restent/);
  assert.throws(() => R.anonymiser(e, 'p1', AUJ), /partie/);
  e.licences[0].attributions = e.licences[0].attributions.filter((a) => a.cibleId !== 'p4');
  const p = R.anonymiser(e, 'p4', AUJ);
  assert.equal(p.nom, 'Ancien collaborateur 1');
  assert.equal(p.anonyme, true);
  assert.equal(p.id, 'p4');
});
