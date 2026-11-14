// Tests des règles métier du template Charges et AG de copropriété (templates/copropriete/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/copropriete/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CPR;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const AUJ = '2026-11-14';

// Copropriété d'exemple : 455 tantièmes sur 10 000, exercice civil.
function copro(extra = {}) {
  return R.normaliserCopro({
    id: 'c1', nom: 'Résidence test', tantiemesTotal: 10000, debutExercice: 1,
    lots: [{ id: 'l1', nom: 'Appartement', tantiemes: 412, loue: true }, { id: 'l2', nom: 'Cave', tantiemes: 8 }, { id: 'l3', nom: 'Parking', tantiemes: 35 }],
    ...extra,
  }, B, AUJ);
}

test('base : postes uniques, sources datées de service-public.gouv.fr, aucune règle de majorité', () => {
  const ids = B.postes.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of B.postes) {
    assert.ok(p.nom && p.aide, p.id);
    if (p.propose !== null) assert.equal(p.cite, true, `${p.id} : proposition seulement pour une catégorie citée`);
  }
  for (const s of B.sources) {
    assert.match(s.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
    assert.ok(R.estDate(s.consulte));
    assert.ok(s.verifiePar);
  }
  for (const r of Object.values(B.regles)) assert.ok(B.sources.some((s) => s.id === r.source), r.source);
  assert.equal(B.regles.fondsTravaux.taux, 5);
  // Les majorités ne sont que des libellés : aucun seuil, aucun calcul.
  assert.ok(B.majorites.every((m) => typeof m === 'string'));
  assert.ok(!/\d+\s*%|moitié|tiers|voix/i.test(B.majorites.join(' ')));
  assert.equal(B.couleurs.length, 2);
});

test('montants et normalisation tolérante', () => {
  assert.equal(R.lireNombre('1 250,50 €'), 1250.5);
  assert.equal(R.euros(2580), '2 580 €');
  assert.equal(R.montantSigne('-12,5'), -12.5);
  assert.equal(R.pourcentOuNull('150'), 100);
  const c = R.normaliserCopro({ debutExercice: 99, lots: [{ tantiemes: 'x' }], appels: [{ echeance: '2026-02-30', provisions: '-3', fondsTravaux: '31,5' }],
    exercices: [{ annee: 2025, charges: [{ poste: 'inconnu', montant: 5 }, { poste: 'eau-froide', montant: '100' }, { poste: 'eau-froide', montant: 7 }] }, { annee: 2025, charges: [{ poste: 'chauffage', montant: 300 }] }],
    recup: { 'eau-froide': '80', inconnu: 50, chauffage: 'abc' } }, B, AUJ);
  assert.equal(c.debutExercice, 12);
  assert.equal(c.lots[0].tantiemes, 0);
  assert.equal(c.appels[0].echeance, AUJ);
  assert.equal(c.appels[0].provisions, 0);
  assert.equal(c.appels[0].fondsTravaux, 31.5);
  assert.equal(c.exercices.length, 1, 'un seul exercice par année');
  eq(c.exercices[0].charges, [{ poste: 'chauffage', montant: 300 }]);
  eq(c.recup, { 'eau-froide': 80 });
  const e = R.normaliser({ copros: [c], actif: 'absent', reglages: { alerte: 500 } }, AUJ, B);
  assert.equal(e.actif, c.id);
  assert.equal(e.reglages.alerte, 90);
  eq(R.normaliser(null, AUJ, B).copros, []);
});

test('normaliser : références orphelines (travaux, échéance, assemblée) retirées', () => {
  const c = R.normaliserCopro({
    assemblees: [{ id: 'ag', date: '2026-06-01', resolutions: [{ id: 'r1', titre: 'Ravalement' }] }],
    travaux: [{ id: 't1', nom: 'Ravalement', assemblee: 'ag', resolution: 'r9', echeancier: [{ id: 'e1', date: '2026-09-01', montant: 100 }] }, { id: 't2', assemblee: 'disparue' }],
    appels: [{ echeance: '2026-09-01', travaux: [{ travaux: 't1', echeance: 'e9', montant: 100 }, { travaux: 'tx', montant: 50 }] }],
  }, B, AUJ);
  assert.equal(c.travaux[0].resolution, null);
  assert.equal(c.travaux[1].assemblee, null);
  eq(c.appels[0].travaux, [{ travaux: 't1', echeance: null, montant: 100 }]);
});

test('tantièmes : part et quote-part estimée', () => {
  const c = copro();
  assert.equal(R.tantiemesLots(c), 455);
  assert.equal(R.part(c), 0.0455);
  assert.equal(R.quotePart(c, 180000), 8190);
  assert.equal(R.quotePart(copro({ tantiemesTotal: 0 }), 1000), null);
  assert.ok(R.aLoue(c));
});

test('appels trimestriels : quart du budget au 1er jour de chaque trimestre, centimes exacts', () => {
  const c = copro();
  const l = R.appelsTrimestriels(c, 2026, { provisions: 2580, fondsTravaux: 130 });
  eq(l.map((a) => a.echeance), ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);
  eq(l.map((a) => a.provisions), [645, 645, 645, 645]);
  eq(l.map((a) => a.fondsTravaux), [32.5, 32.5, 32.5, 32.5]);
  const imp = R.appelsTrimestriels(c, 2026, { provisions: 1000.01, fondsTravaux: 0 });
  assert.equal(R.somme(imp, (a) => a.provisions), 1000.01);
  // Exercice décalé (juillet) : trimestres de juillet à avril, exercice 2026.
  const d = copro({ debutExercice: 7 });
  const x = R.appelsTrimestriels(d, 2026, { provisions: 400 });
  eq(x.map((a) => a.echeance), ['2026-07-01', '2026-10-01', '2027-01-01', '2027-04-01']);
  assert.ok(x.every((a) => a.exercice === 2026));
  assert.equal(R.libelleExercice(2026, 7), '2026-2027');
  assert.equal(R.exercice('2027-03-15', 7), 2026);
});

test('état d\'un appel : payé, en retard, proche, à venir ; total avec travaux', () => {
  const a = R.normaliserAppel({ echeance: '2026-11-20', provisions: 645, fondsTravaux: 32.5, travaux: [{ travaux: 't', montant: 2457 }], autres: 10 }, 1, AUJ);
  assert.equal(R.totalAppel(a), 3144.5);
  assert.equal(R.etatAppel(a, AUJ, 15), 'proche');
  assert.equal(R.etatAppel(a, AUJ, 3), 'avenir');
  assert.equal(R.etatAppel({ ...a, echeance: '2026-11-13' }, AUJ, 15), 'retard');
  assert.equal(R.etatAppel({ ...a, payeLe: '2026-11-01' }, AUJ, 15), 'paye');
  assert.equal(a.exercice, 2026);
});

test('travaux : appelé, payé, reste, échéances à appeler', () => {
  const c = copro({
    travaux: [{ id: 't1', nom: 'Ravalement', quotePart: 8190, echeancier: [{ id: 'e1', date: '2026-08-01', montant: 3276 }, { id: 'e2', date: '2026-11-24', montant: 2457 }, { id: 'e3', date: '2027-02-22', montant: 2457 }] }],
    appels: [{ id: 'a1', echeance: '2026-08-01', travaux: [{ travaux: 't1', echeance: 'e1', montant: 3276 }], payeLe: '2026-08-03' }, { id: 'a2', echeance: '2026-11-24', travaux: [{ travaux: 't1', echeance: 'e2', montant: 2457 }] }],
  });
  const s = R.suiviTravaux(c, c.travaux[0]);
  assert.equal(s.appele, 5733);
  assert.equal(s.paye, 3276);
  assert.equal(s.reste, 2457);
  assert.equal(s.sansEcheancier, 0);
  eq(s.echeances.map((e) => [e.id, e.appel, e.payeLe]), [['e1', 'a1', '2026-08-03'], ['e2', 'a2', null], ['e3', null, null]]);
  eq(R.echeancesAAppeler(c, '2027-01-15').map((x) => x.echeance), ['e3'], 'jusqu\'à 45 jours après la date');
  eq(R.echeancesAAppeler(c, '2026-12-01'), []);
  eq(R.echeancesAAppeler(c, null, { sauf: 'a2' }).map((x) => x.echeance), ['e2', 'e3'], 'l\'appel modifié libère ses échéances');
});

test('exercice : provisions, charges réelles, régularisation, récupérable, rapport du fonds de travaux', () => {
  const c = copro({
    appels: R.appelsTrimestriels(copro(), 2025, { provisions: 2400, fondsTravaux: 100 }).map((a, i) => ({ ...a, payeLe: i < 3 ? a.echeance : null })),
    exercices: [{ annee: 2025, approuveLe: '2026-06-10', charges: [{ poste: 'chauffage', montant: 1200 }, { poste: 'honoraires', montant: 300 }, { poste: 'eau-froide', montant: 1040 }] }],
    recup: { chauffage: 100, 'eau-froide': 50 },
  });
  const s = R.syntheseExercice(c, 2025, AUJ);
  assert.equal(s.provisions, 2400);
  assert.equal(s.fondsTravaux, 100);
  assert.equal(s.appele, 2500);
  assert.equal(s.paye, 1875);
  assert.equal(s.resteAPayer, 625);
  assert.equal(s.enRetard, 1);
  assert.equal(s.charges, 2540);
  assert.equal(s.regularisation, 140, 'charges − provisions : complément à payer');
  assert.equal(s.recuperable, 1720);
  assert.equal(s.nonRecuperable, 820);
  assert.ok(Math.abs(s.tauxFonds - 4.1667) < 0.001);
  // Sans décompte saisi : pas de régularisation.
  assert.equal(R.syntheseExercice(c, 2026, AUJ).regularisation, null);
  // Trop-versé.
  c.exercices[0].charges = [{ poste: 'chauffage', montant: 2300 }];
  assert.equal(R.syntheseExercice(c, 2025, AUJ).regularisation, -100);
});

test('répartition par poste, évolution et tableau poste × années', () => {
  const c = copro({
    appels: [...R.appelsTrimestriels(copro(), 2024, { provisions: 2000 }), ...R.appelsTrimestriels(copro(), 2025, { provisions: 2400 })],
    exercices: [
      { annee: 2024, charges: [{ poste: 'chauffage', montant: 1000 }, { poste: 'ascenseur', montant: 200 }] },
      { annee: 2025, charges: [{ poste: 'chauffage', montant: 1250 }, { poste: 'ascenseur', montant: 200 }, { poste: 'assurance', montant: 50 }, { poste: 'autres', montant: 0 }] },
    ],
    recup: { ascenseur: 100 },
  });
  const rep = R.repartition(c, 2025, B);
  eq(rep.map((x) => x.poste), ['chauffage', 'ascenseur', 'assurance'], 'trié, postes à zéro retirés');
  assert.equal(rep[0].variation, 25);
  assert.ok(Math.abs(rep[0].part - 83.333) < 0.01);
  assert.equal(rep[1].recuperable, 200);
  assert.equal(rep[2].avant, null);
  const evo = R.evolution(c, AUJ);
  eq(evo.map((x) => [x.annee, x.provisions, x.charges, x.regularisation]), [[2024, 2000, 1200, -800], [2025, 2400, 1500, -900]]);
  const m = R.matricePostes(c, B);
  eq(m.annees, [2024, 2025]);
  eq(m.lignes.map((l) => [l.poste, l.valeurs]), [['chauffage', [1000, 1250]], ['ascenseur', [200, 200]], ['assurance', [null, 50]]]);
  eq(m.totaux, [1200, 1500]);
});

test('aide part récupérable : seulement les catégories citées, sans écraser la saisie', () => {
  const p = R.recupPropose(B, { chauffage: 40 });
  assert.equal(p.chauffage, 40);
  assert.equal(p['eau-froide'], 100);
  assert.equal(p.honoraires, undefined);
  assert.equal(p.assurance, undefined);
  assert.equal(p.gardien, undefined, 'gardien : sous conditions, pas de proposition');
});

test('assemblées : état, résolutions, intentions de vote, prochaine AG', () => {
  const ag = R.normaliserAssemblee({ date: '2026-11-30', resolutions: [{ titre: 'Budget', vote: 'pour' }, { titre: 'Travaux', vote: 'nimporte', resultat: 'adoptee' }] }, AUJ);
  assert.equal(ag.resolutions[1].vote, null);
  assert.equal(ag.resolutions[0].numero, '1');
  assert.equal(R.sansIntention(ag), 1);
  assert.equal(R.etatAssemblee(ag, AUJ, 21), 'apreparer');
  assert.equal(R.etatAssemblee(ag, AUJ, 10), 'avenir');
  assert.equal(R.etatAssemblee({ ...ag, preparee: true }, AUJ, 21), 'preparee');
  assert.equal(R.etatAssemblee({ ...ag, date: AUJ }, AUJ), 'aujourdhui');
  assert.equal(R.etatAssemblee({ ...ag, date: '2026-10-01' }, AUJ), 'resultats');
  assert.equal(R.etatAssemblee({ ...ag, date: '2026-10-01', resolutions: [ag.resolutions[1]] }, AUJ), 'tenue');
  assert.equal(R.etatResolution(ag, ag.resolutions[0], AUJ), 'avenir');
  assert.equal(R.etatResolution({ date: '2026-10-01' }, ag.resolutions[0], AUJ), 'attente');
  const c = copro({ assemblees: [{ id: 'a', date: '2026-06-01' }, { id: 'b', date: '2027-03-01' }, { id: 'c', date: '2026-12-01' }] });
  assert.equal(R.prochaineAssemblee(c, AUJ).id, 'c');
  // La majorité saisie est conservée telle quelle, jamais interprétée.
  assert.equal(R.normaliserResolution({ majorite: 'Article 25' }).majorite, 'Article 25');
});

test('alertes : appel en retard et proche, échéance de travaux sans appel, AG à préparer, résultats, régularisation', () => {
  const c = copro({
    appels: [
      { id: 'retard', echeance: '2026-10-01', provisions: 645 },
      { id: 'proche', echeance: '2026-11-24', provisions: 10 },
      { id: 'loin', echeance: '2027-01-01', provisions: 645 },
      { id: 'paye', echeance: '2026-07-01', provisions: 645, payeLe: '2026-07-02' },
      ...R.appelsTrimestriels(copro(), 2025, { provisions: 2400 }).map((a) => ({ ...a, payeLe: a.echeance })),
    ],
    travaux: [{ id: 't', nom: 'Toiture', echeancier: [{ id: 'e', date: '2026-11-20', montant: 500 }, { id: 'f', date: '2027-06-01', montant: 500 }] }],
    assemblees: [{ id: 'ag1', date: '2026-11-30', resolutions: [{ titre: 'X' }] }, { id: 'ag2', date: '2026-09-15', resolutions: [{ titre: 'Y' }] }],
    exercices: [{ id: 'ex25', annee: 2025, approuveLe: '2026-06-10', charges: [{ poste: 'chauffage', montant: 2540 }] }],
  });
  const etat = R.normaliser({ copros: [c] }, AUJ, B);
  const a = R.alertes(etat, B, AUJ);
  // Tri : retards d'abord, puis par date ; « à venir » en dernier.
  eq(a.map((x) => [x.type, x.id, x.niveau]), [
    ['appel', 'retard', 'retard'],
    ['regularisation', 'ex25', 'proche'],
    ['resultats', 'ag2', 'proche'],
    ['travaux', 't', 'proche'],
    ['appel', 'proche', 'proche'],
    ['ag', 'ag1', 'proche'],
    ['appel', 'loin', 'avenir'],
  ]);
  assert.ok(a.some((x) => x.type === 'travaux' && x.echeance === 'e'));
  assert.ok(!a.some((x) => x.echeance === 'f'));
  assert.ok(a.some((x) => x.type === 'regularisation' && x.montant === 140));
  assert.ok(a.some((x) => x.type === 'ag' && x.sansIntention === 1));
  assert.ok(!a.some((x) => x.id === 'paye'));
  assert.equal(a[a.length - 1].niveau, 'avenir');
  // Régularisation réglée : plus d'alerte.
  etat.copros[0].exercices[0].regleLe = '2026-07-01';
  assert.ok(!R.alertes(etat, B, AUJ).some((x) => x.type === 'regularisation'));
});

test('documents : recherche sans accents', () => {
  const docs = [R.normaliserDocument({ nom: 'Procès-verbal AG 2026', type: 'Procès-verbal d\'assemblée générale', rangement: 'Classeur bleu' }, AUJ), R.normaliserDocument({ nom: 'Décompte 2025', rangement: 'Dossier numérique' }, AUJ)];
  eq(R.rechercherDocuments(docs, 'proces classeur').map((d) => d.nom), ['Procès-verbal AG 2026']);
  eq(R.rechercherDocuments(docs, 'DECOMPTE').map((d) => d.nom), ['Décompte 2025']);
  assert.equal(R.rechercherDocuments(docs, '').length, 2);
});

test('export CSV : appels, charges par poste, résolutions', () => {
  const c = copro({
    travaux: [{ id: 't1', nom: 'Ravalement; façades' }],
    appels: [{ libelle: 'Appel T1', echeance: '2026-01-01', provisions: 645, fondsTravaux: 32.5, travaux: [{ travaux: 't1', montant: 100 }], payeLe: '2026-01-04' }],
    exercices: [{ annee: 2026, charges: [{ poste: 'chauffage', montant: 712.4 }] }],
    recup: { chauffage: 100 },
    assemblees: [{ date: '2026-06-01', resolutions: [{ numero: '3', titre: 'Budget "N+1"', majorite: 'Article 24', montant: 62000, vote: 'pour', resultat: 'adoptee' }] }],
  });
  const a = R.versCsvAppels(c);
  assert.ok(a.startsWith('﻿Exercice;Appel;Échéance'));
  assert.ok(a.includes('2026;Appel T1;2026-01-01;645;32,5;100;"Ravalement; façades 100";0;777,5;2026-01-04;'));
  const ch = R.versCsvCharges(c, B);
  assert.ok(ch.includes('Chauffage collectif;100;712,4'));
  assert.ok(ch.includes('Provisions appelées;;645'));
  const r = R.versCsvResolutions(c);
  assert.ok(r.includes('2026-06-01;Ordinaire;3;"Budget ""N+1""";Article 24;62000;Pour;Adoptée'));
});
