// Tests des règles métier des Propositions commerciales (templates/propositions/regles.js et donnees.js).
// Chaque résultat attendu a été calculé à la main (détail en commentaire).
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../templates/propositions/donnees.js');
await import('../../templates/propositions/regles.js');
const B = globalThis.BASE;
const R = globalThis.PCM_REGLES;

const opt = (id, prixHT, inclus = [], recommandee = false, nom = id) => ({ id, nom, prixHT, inclus, recommandee, delai: '' });
const prop = (x = {}) => ({
  id: 'p', numero: 'P-2026-001', date: '2026-11-01', validiteJours: 30, titre: 'Projet', trame: 'conseil',
  client: { organisation: 'Organisation Exemple', interlocuteur: 'Mme Exemple' }, contexte: '', objectifs: [], livrables: [],
  options: [opt('a', 100000), opt('b', 150000, [], true), opt('c', 220000)], etapes: [], blocs: [], conditions: '',
  statut: 'brouillon', envoyeeLe: null, decideeLe: null, relances: [], optionRetenue: null, motifRefus: '', ...x,
});

test('base : quatre trames complètes, sans prix, sans donnée datée ni règle légale', () => {
  assert.deepEqual(B.trames.map((t) => t.id), ['conseil', 'developpement', 'formation', 'travaux']);
  for (const t of B.trames) {
    assert.ok(t.contexte.length >= 3 && t.objectifs.length >= 3 && t.livrables.length >= 4 && t.etapes.length >= 3, t.id);
    assert.equal(t.options.length, 3, t.id);
    assert.equal(t.options.filter((o) => o.recommandee).length, 1, `${t.id} : une seule option recommandée`);
    for (const o of t.options) assert.equal(o.prixHT, undefined, `${t.id} : aucun prix intégré`);
    // Chaque option reprend le contenu de la précédente (bon ⊂ mieux ⊂ premium).
    for (let i = 1; i < 3; i++) for (const x of t.options[i - 1].inclus) assert.ok(t.options[i].inclus.includes(x), `${t.id} : ${x}`);
    for (const [, s] of t.etapes) assert.ok(Number.isInteger(s) && s >= 1);
  }
  const tout = JSON.stringify(B);
  assert.doesNotMatch(tout, /\b(19|20)\d\d\b/, 'aucune année dans la base');
  assert.doesNotMatch(tout, /article|L\d{3}-\d|code (du|de la|des) /i, 'aucune référence légale');
  assert.doesNotMatch(tout, /\d+ ?%[^,]* TVA|TVA[^.]*\d+ ?%/, 'aucun taux de TVA');
  assert.ok(B.blocsTypes.length >= 8);
  for (const b of B.blocsTypes) assert.ok(B.typesBlocs.some((t) => t.id === b.type), b.titre);
});

test('saisie et affichage des montants', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('4500'), 450000);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.eurosCourt(450000), '4 500 €');
  assert.equal(R.eurosCourt(450050), '4 500,50 €');
  assert.equal(R.lirePourcent('5,5'), 550);
  // TTC seulement à un taux saisi : 1 000 € HT à 20 % = 1 200 € ; sans taux, null.
  assert.equal(R.ttc(100000, 2000), 120000);
  assert.equal(R.ttc(33333, 550), 35166); // 333,33 × 5,5 % = 18,333 → 18,33 €
  assert.equal(R.ttc(100000, null), null);
});

test('numérotation annuelle : compteur jamais réutilisé, préfixe nettoyé', () => {
  const liste = [{ numero: 'P-2026-001' }, { numero: 'P-2026-004' }, { numero: 'P-2025-009' }];
  assert.deepEqual(R.prochainNumero(liste, 'p', 2026), { numero: 'P-2026-005', rang: 5 });
  assert.deepEqual(R.prochainNumero(liste, 'P', 2026, 7), { numero: 'P-2026-008', rang: 8 });
  assert.equal(R.prochainNumero([], 'pro-p!', 2027).numero, 'PROP-2027-001');
  assert.equal(R.nettoyerPrefixe(''), 'P');
});

test('montant d’une proposition : option retenue, sinon recommandée, sinon la moins chère chiffrée', () => {
  assert.equal(R.montantProposition(prop()), 150000);
  assert.equal(R.montantProposition(prop({ optionRetenue: 'c' })), 220000);
  assert.equal(R.montantProposition(prop({ options: [opt('a', 0), opt('b', 0, [], true), opt('c', 90000), opt('d', 80000)] })), 80000);
  assert.equal(R.montantProposition(prop({ options: [] })), 0);
});

test('comparaison des options : éléments communs d’abord, écarts avec la première', () => {
  const c = R.comparerOptions([
    opt('a', 100000, ['Cadrage', 'Rapport']),
    opt('b', 150000, ['Cadrage', 'rapport ', 'Plan d’actions'], true),
    opt('c', 220000, ['Cadrage', 'Rapport', 'Plan d’actions', 'Suivi']),
  ], 2000);
  assert.deepEqual(c.colonnes.map((x) => [x.prixHT, x.ecart, x.ttc, x.recommandee]), [[100000, 0, 120000, false], [150000, 50000, 180000, true], [220000, 120000, 264000, false]]);
  // « Rapport » et « rapport » sont le même élément (casse et espaces ignorés).
  assert.deepEqual(c.lignes.map((l) => [l.libelle, l.presences.map(Number).join(''), l.commun]), [
    ['Cadrage', '111', true], ['Rapport', '111', true], ['Plan d’actions', '011', false], ['Suivi', '001', false],
  ]);
  assert.equal(R.comparerOptions([opt('a', 1000)]).colonnes[0].ttc, null);
  assert.deepEqual(R.comparerOptions([{ id: 'v', nom: '', inclus: [], prixHT: 0 }]).colonnes, [], 'option vide ignorée');
});

test('planning : étapes en semaines, à la suite ou en parallèle', () => {
  const p = R.calculerPlanning('2026-11-16', [
    { id: 1, titre: 'Cadrage', semaines: 1 },
    { id: 2, titre: 'Développement', semaines: 4 },
    { id: 3, titre: 'Documentation', semaines: 2, parallele: true },
    { id: 4, titre: 'Recette', semaines: 1 },
  ]);
  // Cadrage S1 (16 → 22/11), Développement S2-S5 (23/11 → 20/12), Documentation en parallèle S2-S3,
  // Recette après la plus longue des deux : S6 (21 → 27/12). Total 6 semaines.
  assert.deepEqual(p.etapes.map((e) => [e.depart, e.arrivee, e.debut, e.fin]), [
    [0, 1, '2026-11-16', '2026-11-22'], [1, 5, '2026-11-23', '2026-12-20'], [1, 3, '2026-11-23', '2026-12-06'], [5, 6, '2026-12-21', '2026-12-27'],
  ]);
  assert.equal(p.semaines, 6);
  assert.equal(p.fin, '2026-12-27');
  const sansDate = R.calculerPlanning('', [{ id: 1, titre: 'A', semaines: 0, parallele: true }]);
  assert.deepEqual([sansDate.etapes[0].semaines, sansDate.etapes[0].parallele, sansDate.etapes[0].debut, sansDate.fin], [1, false, null, null]);
});

test('statuts affichés : envoyée, à relancer, validité dépassée', () => {
  const p = prop({ statut: 'envoyee', date: '2026-11-01', envoyeeLe: '2026-11-02' });
  assert.equal(R.finValidite(p), '2026-12-01');
  assert.equal(R.prochaineRelance(p, 7), '2026-11-09');
  assert.equal(R.statutAffiche(p, '2026-11-08', 7), 'envoyee');
  assert.equal(R.statutAffiche(p, '2026-11-09', 7), 'a-relancer');
  const relancee = R.enregistrerRelance(p, '2026-11-09');
  assert.deepEqual(relancee.relances, ['2026-11-09']);
  assert.deepEqual(R.enregistrerRelance(relancee, '2026-11-09').relances, ['2026-11-09'], 'une relance par jour');
  assert.equal(R.prochaineRelance(relancee, 7), '2026-11-16');
  assert.equal(R.statutAffiche(relancee, '2026-11-10', 7), 'envoyee');
  assert.equal(R.statutAffiche(p, '2026-12-01', 7), 'a-relancer', 'dernier jour de validité');
  assert.equal(R.statutAffiche(p, '2026-12-02', 7), 'expiree');
  assert.equal(R.prochaineRelance(prop(), 7), null, 'pas de relance pour un brouillon');
  assert.equal(R.statutAffiche(prop({ statut: 'inconnu' }), '2026-11-02'), 'brouillon');
});

test('prolonger la validité à partir d’aujourd’hui, jamais en la raccourcissant', () => {
  const p = prop({ statut: 'envoyee', envoyeeLe: '2026-11-02' });
  const q = R.prolonger(p, 30, '2026-12-10');
  assert.equal(R.finValidite(q), '2027-01-09');
  assert.equal(q.validiteJours, 69);
  assert.equal(R.prolonger(p, 5, '2026-11-03'), p);
});

test('changements de statut : dates, option retenue, motif', () => {
  const p = prop();
  const e = R.changerStatut(p, 'envoyee', '2026-11-03');
  assert.equal(e.envoyeeLe, '2026-11-03');
  const a = R.changerStatut(e, 'acceptee', '2026-11-20');
  assert.deepEqual([a.decideeLe, a.optionRetenue, a.motifRefus], ['2026-11-20', 'b', '']);
  const a2 = R.changerStatut(e, 'acceptee', '2026-11-20', { optionId: 'c', le: '2026-11-18' });
  assert.deepEqual([a2.decideeLe, a2.optionRetenue], ['2026-11-18', 'c']);
  const r = R.changerStatut(a2, 'refusee', '2026-11-21', { motif: 'Prix' });
  assert.deepEqual([r.optionRetenue, r.motifRefus, r.envoyeeLe], [null, 'Prix', '2026-11-03']);
  const direct = R.changerStatut(p, 'sans-suite', '2026-12-15');
  assert.equal(direct.envoyeeLe, '2026-11-01', 'sans date d’envoi : la date de la proposition');
  const retour = R.changerStatut(r, 'brouillon', '2026-11-22');
  assert.deepEqual([retour.envoyeeLe, retour.decideeLe, retour.relances, retour.motifRefus], [null, null, [], '']);
  assert.equal(R.changerStatut(p, 'n-importe', '2026-11-22'), p);
});

test('complétude : dix points', () => {
  const vide = R.completude(prop({ client: {}, titre: '', options: [] }));
  assert.equal(vide.faits, 0);
  assert.equal(vide.total, 10);
  const pleine = R.completude(prop({
    contexte: 'Un contexte de plus de vingt caractères.', objectifs: ['Objectif'], livrables: [{ id: 1, titre: 'Rapport' }],
    etapes: [{ id: 1, titre: 'Cadrage', semaines: 1 }], debut: '2026-12-01', conditions: 'Acompte à la commande.',
  }));
  assert.deepEqual([pleine.pct, pleine.manque], [100, []]);
  const partielle = R.completude(prop({ options: [opt('a', 100000), opt('b', 0)] }));
  assert.ok(partielle.manque.includes('Toutes les options chiffrées'));
  assert.ok(!partielle.manque.includes('Au moins une option chiffrée'));
});

test('duplication : brouillon, nouveaux identifiants, suivi remis à zéro, source intacte', () => {
  let n = 0;
  const source = prop({ statut: 'acceptee', envoyeeLe: '2026-11-02', decideeLe: '2026-11-10', relances: ['2026-11-09'], optionRetenue: 'b',
    livrables: [{ id: 'l1', titre: 'Rapport' }], etapes: [{ id: 'e1', titre: 'Cadrage', semaines: 1 }], blocs: [{ id: 'b1', titre: 'Méthode', texte: '…' }] });
  const c = R.dupliquer(source, { id: 'q', numero: 'P-2026-002', date: '2026-11-14', nouvelId: () => `n${++n}` });
  assert.deepEqual([c.id, c.numero, c.date, c.statut, c.envoyeeLe, c.decideeLe, c.optionRetenue, c.relances], ['q', 'P-2026-002', '2026-11-14', 'brouillon', null, null, null, []]);
  assert.deepEqual([c.livrables[0].id, c.options.map((o) => o.id), c.etapes[0].id, c.blocs[0].id], ['n1', ['n2', 'n3', 'n4'], 'n5', 'n6']);
  assert.equal(c.options[1].recommandee, true);
  c.livrables[0].titre = 'Modifié';
  assert.equal(source.livrables[0].titre, 'Rapport');
  assert.equal(source.statut, 'acceptee');
});

test('statistiques : taux de transformation en nombre et en valeur, délais, choix, motifs, mois', () => {
  const t = '2026-11-14';
  const liste = [
    prop({ id: 1, trame: 'conseil', statut: 'acceptee', envoyeeLe: '2026-10-01', decideeLe: '2026-10-11', optionRetenue: 'b' }), // 1 500 €, 10 j, 2e option
    prop({ id: 2, trame: 'conseil', statut: 'acceptee', envoyeeLe: '2026-09-01', decideeLe: '2026-09-21', optionRetenue: 'c' }), // 2 200 €, 20 j, 3e option
    prop({ id: 3, trame: 'formation', statut: 'refusee', envoyeeLe: '2026-08-01', decideeLe: '2026-08-31', motifRefus: 'Prix' }), // 1 500 €, 30 j
    prop({ id: 4, trame: 'formation', statut: 'sans-suite', envoyeeLe: '2026-06-01', decideeLe: '2026-07-15' }), // 1 500 €, pas de délai
    prop({ id: 5, statut: 'acceptee', envoyeeLe: '2025-01-01', decideeLe: '2025-01-10', optionRetenue: 'a' }), // hors 12 mois
    prop({ id: 6, statut: 'envoyee', date: '2026-11-10', envoyeeLe: '2026-11-10' }), // en attente
    prop({ id: 7, statut: 'envoyee', date: '2026-11-01', envoyeeLe: '2026-11-01' }), // à relancer
    prop({ id: 8, statut: 'envoyee', date: '2026-09-01', envoyeeLe: '2026-09-01' }), // validité dépassée
    prop({ id: 9 }), // brouillon
  ];
  const s = R.statistiques(liste, t, 7);
  assert.deepEqual([s.acceptees, s.refusees, s.sansSuite, s.brouillons], [2, 1, 1, 1]);
  assert.equal(s.taux, 50); // 2 sur 4
  assert.equal(s.montantAccepte, 370000);
  assert.equal(s.montantDecide, 670000);
  assert.equal(s.tauxValeur, 55); // 3 700 / 6 700 = 55,2 %
  assert.equal(s.delaiMoyen, 20); // (10 + 20 + 30) / 3
  assert.equal(s.panierMoyen, 185000);
  assert.deepEqual(s.choix, [0, 1, 1, 0]);
  assert.deepEqual(s.motifs, { Prix: 1, 'Pas de réponse': 1 });
  assert.deepEqual([s.enAttente, s.aRelancer, s.expirees, s.montantAttente], [2, 1, 1, 300000]);
  assert.deepEqual(s.parTrame.conseil, { decidees: 2, acceptees: 2, montant: 370000, taux: 100 });
  assert.deepEqual(s.parTrame.formation, { decidees: 2, acceptees: 0, montant: 0, taux: 0 });
  assert.equal(s.parMois.length, 12);
  assert.equal(s.parMois[0].mois, '2025-12');
  assert.equal(s.parMois[11].mois, '2026-11');
  assert.deepEqual(s.parMois[11], { mois: '2026-11', envoyees: 2, acceptees: 0 });
  assert.deepEqual(s.parMois[9], { mois: '2026-09', envoyees: 2, acceptees: 1 });
  const vide = R.statistiques([], t);
  assert.deepEqual([vide.taux, vide.tauxValeur, vide.delaiMoyen, vide.panierMoyen], [null, null, null, null]);
});

test('message de relance : interlocuteur, numéro, validité au second rang, signature', () => {
  const p = prop({ statut: 'envoyee', envoyeeLe: '2026-11-02' });
  const m1 = R.messageRelance(p, { signature: 'Camille Exemple' }, 1);
  assert.match(m1, /^Bonjour Mme Exemple,/);
  assert.match(m1, /« Projet » \(P-2026-001\), envoyée le 2026-11-02/);
  assert.match(m1, /Camille Exemple$/);
  const m2 = R.messageRelance(p, {}, 2, (d) => `le ${d}`);
  assert.match(m2, /valable jusqu'au le 2026-12-01/);
  assert.match(R.messageRelance(prop({ client: {} }), {}, 1), /^Bonjour,/);
});
