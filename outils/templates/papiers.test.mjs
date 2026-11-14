// Tests des règles métier du template Papiers du foyer (templates/papiers/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/papiers/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.DCS;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const AUJ = '2026-11-14';
const T = (id) => R.typeDe(BASE, id);
const doc = (type, extra = {}) => R.normaliserDoc({ type, ...extra }, BASE);
const typeDeDoc = (d) => (d.type ? T(d.type) : null);

test('base : catégories demandées, identifiants uniques, règles valides et source datée', () => {
  eq(BASE.categories.map((c) => c.id), ['identite', 'famille', 'logement', 'impots', 'banque', 'sante', 'travail', 'vehicule', 'assurances']);
  const ids = BASE.documents.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.ok(BASE.documents.length >= 60);
  for (const t of BASE.documents) {
    assert.ok(BASE.categories.some((c) => c.id === t.cat), `catégorie de ${t.id}`);
    const r = t.r;
    assert.ok(r === 'P' || r.valide || r.aucune || r.dec || r.a || r.m || r.j || r.fin, `règle de ${t.id}`);
    // Toute durée chiffrée vient de la fiche (texte source) ; les types hors fiche n'ont pas de durée calculée.
    if (t.hors) assert.ok(r.valide || r.aucune, `${t.id} hors fiche sans durée`);
    else assert.ok(t.src, `${t.id} sourcé`);
  }
  for (const id of BASE.depart) assert.ok(T(id), `départ ${id}`);
  assert.match(BASE.source.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
  assert.ok(R.estDate(BASE.source.consulte));
  assert.ok(BASE.source.verifiePar);
  for (const c of [...BASE.typesLieu.map((x) => x.nom), ...BASE.documents.map((x) => x.nom)]) assert.ok(!/@|\d{9,}/.test(c));
});

test('dates : ajout de mois borné à la fin du mois', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-02-29', 12), '2029-02-28');
  assert.equal(R.ajoutMois('2026-11-14', -3), '2026-08-14');
  assert.equal(R.ajoutMois('2026-11-14', 60), '2031-11-14');
  assert.ok(!R.estDate('2026-02-30'));
});

test('libellés des règles', () => {
  assert.equal(R.libelleRegle(T('livret')), 'Conservation permanente');
  assert.equal(R.libelleRegle(T('energie')), '5 ans');
  assert.equal(R.libelleRegle(T('cheque')), '1 an et 8 jours');
  assert.equal(R.libelleRegle(T('bail')), '3 ans après la fin de la location');
  assert.equal(R.libelleRegle(T('salaire')), 'Jusqu\'à la liquidation de ta retraite');
  assert.equal(R.libelleRegle(T('foncier')), 'Jusqu\'au 31 décembre de l\'année suivante');
  assert.equal(R.libelleRegle(T('ir')), 'Jusqu\'au 31 décembre de la 2e année suivante');
  assert.equal(R.libelleRegle(T('cni')), 'Tant qu\'il est valable');
  assert.equal(R.libelleRegle(null), 'Durée à choisir');
});

test('garder jusqu\'au : depuis la date du document, un événement, ou le 31 décembre', () => {
  eq(R.garderJusqua(doc('energie', { date: '2024-03-10' }), T('energie')), { mode: 'date', date: '2029-03-10' });
  eq(R.garderJusqua(doc('cheque', { date: '2026-01-05' }), T('cheque')), { mode: 'date', date: '2027-01-13' });
  eq(R.garderJusqua(doc('energie'), T('energie')), { mode: 'adater' });
  // Impôt sur le revenu : mis en recouvrement le 31/07/2024 → garder jusqu'au 31/12/2026.
  eq(R.garderJusqua(doc('ir', { date: '2024-07-31' }), T('ir')), { mode: 'date', date: '2026-12-31' });
  eq(R.garderJusqua(doc('foncier', { date: '2025-08-31' }), T('foncier')), { mode: 'date', date: '2026-12-31' });
  // Bail : tant que la location n'est pas finie, on garde ; ensuite fin + 3 ans.
  const g = R.garderJusqua(doc('bail'), T('bail'));
  assert.equal(g.mode, 'attente'); assert.equal(g.raison, 'fin'); assert.equal(g.evenement, 'la fin de la location');
  eq(R.garderJusqua(doc('bail', { fin: '2023-06-30' }), T('bail')), { mode: 'date', date: '2026-06-30' });
  eq(R.garderJusqua(doc('livretscol', { fin: '2025-07-04' }), T('livretscol')), { mode: 'date', date: '2025-07-04' });
  eq(R.garderJusqua(doc('livret'), T('livret')), { mode: 'toujours' });
  assert.equal(R.garderJusqua(doc('cni'), T('cni')).raison, 'valide');
  assert.equal(R.garderJusqua(doc('mutuelle'), T('mutuelle')).raison, 'choix');
});

test('choix de l\'utilisateur : date choisie ou garder toujours, prioritaires sur la base', () => {
  eq(R.garderJusqua(doc('energie', { date: '2020-01-01', conservation: 'toujours' }), T('energie')), { mode: 'toujours', choisi: true });
  eq(R.garderJusqua(doc('ordonnance', { date: '2026-01-01', conservation: 'date', garder: '2030-01-01' }), T('ordonnance')), { mode: 'date', date: '2030-01-01', choisi: true });
  assert.equal(R.garderJusqua(doc(null, { titre: 'Facture du piano', conservation: 'date' }), null).raison, 'choix');
  // Document libre sans type : durée à choisir.
  assert.equal(R.statutConservation(doc(null, { titre: 'Carnet d\'entretien du vélo' }), null, AUJ), 'attente');
});

test('statut de conservation : peut être jeté, bientôt, à garder, jeté', () => {
  const s = (d) => R.statutConservation(d, typeDeDoc(d), AUJ);
  assert.equal(s(doc('energie', { date: '2021-11-13' })), 'jeter'); // gardé jusqu'au 13/11/2026
  assert.equal(s(doc('energie', { date: '2021-11-14' })), 'bientot'); // dernier jour aujourd'hui
  assert.equal(s(doc('energie', { date: '2022-02-12' })), 'bientot'); // 90 jours
  assert.equal(s(doc('energie', { date: '2022-02-13' })), 'garder');
  assert.equal(s(doc('energie', { date: '2020-01-01', jete: '2026-11-01' })), 'jete');
  assert.equal(s(doc('livret')), 'toujours');
  assert.equal(s(doc('energie')), 'adater');
  assert.equal(R.jetableLe(doc('energie', { date: '2021-11-13' }), T('energie')), '2026-11-14');
  assert.equal(R.jetableLe(doc('livret'), T('livret')), null);
});

test('renouvellement : expiré, à renouveler selon le rappel, à jour', () => {
  eq(R.renouvellement(doc('cni', { echeance: '2026-11-01' }), AUJ), { date: '2026-11-01', jours: -13, statut: 'expire', alerte: '2026-08-01' });
  assert.equal(R.renouvellement(doc('passeport', { echeance: '2027-02-14' }), AUJ).statut, 'arenouveler'); // rappel 3 mois
  assert.equal(R.renouvellement(doc('passeport', { echeance: '2027-02-15' }), AUJ).statut, 'ok');
  assert.equal(R.renouvellement(doc('passeport', { echeance: '2027-05-01', rappel: 6 }), AUJ).statut, 'arenouveler');
  assert.equal(R.renouvellement(doc('passeport', { echeance: '2026-11-20', rappel: 0 }), AUJ).statut, 'ok');
  assert.equal(R.renouvellement(doc('passeport'), AUJ), null);
  assert.equal(R.renouvellement(doc('passeport', { echeance: '2020-01-01', jete: '2026-01-01' }), AUJ), null);
  const liste = R.echeances([doc('cni', { titre: 'B', echeance: '2027-01-10' }), doc('cni', { titre: 'A', echeance: '2026-10-01' }), doc('cni', { titre: 'C', echeance: '2030-01-01' })], AUJ);
  eq(liste.map((x) => x.doc.titre), ['A', 'B']);
  assert.equal(R.echeances([doc('cni', { echeance: '2030-01-01' })], AUJ, { toutes: true }).length, 1);
});

test('à trier : jetables triés par date, bientôt en option', () => {
  const docs = [doc('energie', { titre: 'b', date: '2021-05-01' }), doc('releve', { titre: 'a', date: '2020-01-31' }), doc('energie', { titre: 'c', date: '2021-12-01' }), doc('livret')];
  eq(R.aTrier(docs, typeDeDoc, AUJ).map((x) => x.doc.titre), ['a', 'b']);
  eq(R.aTrier(docs, typeDeDoc, AUJ, { bientot: true }).map((x) => x.doc.titre), ['a', 'b', 'c']);
});

test('recherche « où est… » : sans accents, pluriel, emplacement et personne', () => {
  const lieux = [{ id: 'l1', nom: 'Classeur bleu' }, { id: 'l2', nom: 'Dossier numérique Impôts' }];
  const personnes = [{ id: 'p1', nom: 'Léa' }];
  const docs = [
    doc('passeport', { titre: 'Passeport', personne: 'p1', lieu: 'l1', precision: 'Onglet Identité' }),
    doc('ir', { titre: 'Avis d\'impôt 2025', lieu: 'l2' }),
    doc('energie', { titre: 'Factures d\'électricité', lieu: 'l1', precision: 'Onglet Énergie' }),
    doc('energie', { titre: 'Vieille facture', lieu: 'l1', jete: '2026-01-01' }),
  ];
  const c = { nomType: (id) => T(id)?.nom, nomCat: (id) => BASE.categories.find((x) => x.id === id)?.nom, nomPersonne: (id) => personnes.find((p) => p.id === id)?.nom, nomLieu: (id) => lieux.find((l) => l.id === id)?.nom };
  eq(R.rechercher(docs, 'passeports lea', c).map((d) => d.titre), ['Passeport']);
  eq(R.rechercher(docs, 'IMPOTS', c).map((d) => d.titre), ['Avis d\'impôt 2025']);
  eq(R.rechercher(docs, 'facture', c).map((d) => d.titre), ['Factures d\'électricité']); // le document jeté n'apparaît pas
  eq(R.rechercher(docs, 'classeur bleu', c).map((d) => d.titre), ['Factures d\'électricité', 'Passeport']);
  eq(R.rechercher(docs, 'energie', c).map((d) => d.titre), ['Factures d\'électricité']);
  assert.equal(R.rechercher(docs, '', c).length, 3);
  assert.equal(R.rechercher(docs, 'piano', c).length, 0);
});

test('regroupements : par emplacement (sans emplacement en dernier), par catégorie, urgence', () => {
  const lieux = [{ id: 'l1', nom: 'Classeur' }, { id: 'l2', nom: 'Boîte' }];
  const docs = [doc('cni', { lieu: 'l1', essentiel: true, personne: 'p1' }), doc('livret', { lieu: 'l1', essentiel: true }), doc('energie', { lieu: null }), doc('energie', { lieu: 'l2', jete: '2026-01-01' })];
  const g = R.parLieu(docs, lieux);
  eq(g.map((x) => [x.lieu?.id ?? null, x.docs.length]), [['l1', 2], ['l2', 0], [null, 1]]);
  eq(R.parCategorie(docs, BASE.categories).map((x) => x.cat.id), ['identite', 'famille', 'logement']);
  const u = R.urgence(docs, [{ id: 'p1', nom: 'Léa' }], BASE.categories);
  eq(u.map((x) => [x.personne?.nom ?? 'foyer', x.docs.map((d) => d.type)]), [['foyer', ['livret']], ['Léa', ['cni']]]);
});

test('bilan du tableau de bord', () => {
  const docs = [doc('cni', { echeance: '2026-12-01', essentiel: true, lieu: 'l1' }), doc('passeport', { echeance: '2026-01-01' }), doc('energie', { date: '2020-01-01', lieu: 'l1' }), doc('livret', { lieu: 'l1' }), doc('energie', { jete: '2026-01-01' })];
  const b = R.bilan(docs, typeDeDoc, AUJ);
  assert.equal(b.total, 4); assert.equal(b.jetes, 1); assert.equal(b.essentiels, 1); assert.equal(b.sansLieu, 1);
  assert.equal(b.jeter, 1); assert.equal(b.toujours, 1); assert.equal(b.expire, 1); assert.equal(b.arenouveler, 1); assert.equal(b.aEcheance, 2);
});

test('données sensibles refusées dans les champs libres', () => {
  assert.equal(R.contientNumeroSensible('Onglet Banque, pochette verte'), '');
  assert.equal(R.contientNumeroSensible('Rangé le 14/11/2026'), '');
  assert.equal(R.contientNumeroSensible('N° 1 85 07 75 123 456 78'), 'numero');
  assert.equal(R.contientNumeroSensible('FR76 3000 1007 9412 3456 7890 185'), 'numero');
  assert.equal(R.contientNumeroSensible('iban FR76 ABCD EFGH IJKL'), 'iban');
  assert.equal(R.contientNumeroSensible('Mot de passe : soleil'), 'secret');
  assert.equal(R.contientNumeroSensible('Passeport 22AB12345'), 'numero');
  assert.equal(R.contientNumeroSensible('Classeur 2, onglet 3'), '');
  for (const k of ['numero', 'iban', 'secret']) assert.ok(R.MESSAGES_SENSIBLES[k]);
});

test('normalisation tolérante et inventaire de départ', () => {
  const v = R.normaliser(null, BASE);
  eq(v.documents, []);
  const n = R.normaliser({ documents: [{ type: 'inconnu', cat: 'nimporte', titre: '', conservation: 'x', rappel: 99, date: '2026-02-30' }], lieux: [{ nom: '' }], personnes: [{}], urgence: 'x' }, BASE);
  const d = n.documents[0];
  assert.equal(d.type, null); assert.equal(d.cat, 'identite'); assert.equal(d.titre, 'Document'); assert.equal(d.conservation, 'base'); assert.equal(d.rappel, 12); assert.equal(d.date, null);
  assert.equal(n.lieux[0].nom, 'Emplacement'); assert.match(n.lieux[0].couleur, /^#/);
  eq(n.urgence, { message: '', contact: '' });
  const garde = R.normaliserDoc({ type: 'energie', conservation: 'date', garder: '2030-01-01' }, BASE);
  assert.equal(garde.cat, 'logement'); assert.equal(garde.titre, T('energie').nom); assert.equal(garde.garder, '2030-01-01');
  assert.equal(R.normaliserDoc({ type: 'energie', garder: '2030-01-01' }, BASE).garder, null);
  const depart = R.documentsDepart(BASE, ['cni', 'livret', 'inconnu'], { lieu: 'l1', personnes: [{ id: 'p1' }, { id: 'p2' }] });
  eq(depart.map((x) => [x.type, x.personne, x.lieu, x.essentiel]), [['cni', 'p1', 'l1', true], ['cni', 'p2', 'l1', true], ['livret', null, 'l1', true]]);
});

test('export CSV : en-tête, séparateur et statut', () => {
  const docs = [doc('energie', { titre: 'Facture; EDF', date: '2020-01-01', lieu: 'l1' })];
  const c = R.versCsv(docs, { type: typeDeDoc, nomCat: () => 'Logement', nomPersonne: () => 'Foyer', nomLieu: () => 'Classeur' }, AUJ);
  assert.ok(c.startsWith('﻿Document;Catégorie'));
  assert.match(c, /"Facture; EDF";Logement;Foyer;Classeur;;2020-01-01;2025-01-01;Peut être jeté/);
});
