// Tests des règles métier de l'objectif d'épargne et du fonds d'urgence (templates/epargne/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/epargne/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.EPG;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

const obj = (extra = {}) => ({ id: 'o', type: 'voyage', nom: 'Voyage', cible: 300000, soldeInitial: 50000, versement: 25000, taux: 0, capitalisation: 'mensuelle', debut: '2026-01', dateCible: null, postes: [], urgence: null, ...extra });

test('montants et taux : saisie à la française', () => {
  assert.equal(R.versCentimes('1 234,56'), 123456);
  assert.equal(R.versCentimes('12 €'), 1200);
  assert.equal(R.versCentimes('-3'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.eurosRonds(-150), '−2 €');
  assert.equal(R.lireTaux('2,5 %'), 2.5);
  assert.equal(R.lireTaux(''), 0);
  assert.equal(R.lireTaux('45'), null);
  assert.equal(R.lireTaux('abc'), null);
  assert.equal(R.tauxTexte(3.25), '3,25 %');
});

test('mois : ajout, écart, durée en texte', () => {
  assert.equal(R.ajoutMois('2026-11', 3), '2027-02');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ecartMois('2026-11', '2028-01'), 14);
  assert.equal(R.dureeTexte(14), '1 an et 2 mois');
  assert.equal(R.dureeTexte(24), '2 ans');
  assert.ok(R.estDate('2026-02-28') && !R.estDate('2026-13-01'));
});

test('projection sans intérêts : date d\'atteinte et dernier versement ajusté', () => {
  // 500 € + 250 €/mois vers 3 000 € : 10 mois, le dernier n'est que de 250 €.
  const p = R.projeter({ solde: 50000, versement: 25000, debut: '2026-11', cible: 300000 });
  assert.equal(p.atteint, '2027-08');
  assert.equal(p.duree, 10);
  assert.equal(p.verseAuTerme, 250000);
  assert.equal(p.interetsAuTerme, 0);
  assert.equal(p.mois.at(-1).solde, 300000);
  // Cible non multiple : dernier versement réduit à ce qui manque.
  const q = R.projeter({ solde: 0, versement: 40000, debut: '2026-11', cible: 100000 });
  assert.deepEqual(simple(q.mois.map((m) => m.verse)), [40000, 40000, 20000]);
});

test('intérêts composés mensuels : solde × taux ÷ 12, composés', () => {
  // 10 000 € à 3 %, sans versement : 25 € le premier mois, puis 25,06 €…
  const p = R.projeter({ solde: 1000000, versement: 0, taux: 3, debut: '2026-01', horizon: 12, cible: 0 });
  assert.equal(p.mois[0].interets, 2500);
  assert.equal(p.mois[1].interets, 2506);
  const total = p.mois.reduce((s, m) => s + m.interets, 0);
  // Taux effectif annuel ≈ 3,04 % (composition mensuelle).
  assert.ok(total >= 30400 && total <= 30420, String(total));
});

test('capitalisation annuelle : intérêts crédités en décembre seulement', () => {
  const p = R.projeter({ solde: 1000000, versement: 0, taux: 3, capitalisation: 'annuelle', debut: '2026-01', horizon: 12, cible: 0 });
  assert.deepEqual(simple(p.mois.slice(0, 11).map((m) => m.interets)), Array(11).fill(0));
  assert.equal(p.mois[11].interets, 30000);
  assert.equal(p.mois[11].solde, 1030000);
  // Moins rémunérateur que la capitalisation mensuelle, à taux égal.
  const m = R.projeter({ solde: 1000000, versement: 0, taux: 3, debut: '2026-01', horizon: 12, cible: 0 });
  assert.ok(m.mois[11].solde > p.mois[11].solde);
});

test('projection : déjà atteint, jamais atteint, retraits et versements ponctuels', () => {
  const deja = R.projeter({ solde: 500000, versement: 10000, debut: '2026-11', cible: 400000 });
  assert.equal(deja.dejaAtteint, true);
  assert.equal(deja.atteint, '2026-10');
  const jamais = R.projeter({ solde: 0, versement: 0, debut: '2026-11', cible: 100000 });
  assert.equal(jamais.jamais, true);
  assert.equal(jamais.atteint, null);
  assert.ok(jamais.mois.length <= 2);
  // Prime de 1 000 € en février : 4 mois au lieu de 8.
  const prime = R.projeter({ solde: 0, versement: 25000, debut: '2026-11', cible: 200000, extras: [{ mois: '2027-02', montant: 100000 }] });
  assert.equal(prime.atteint, '2027-02');
  // Retrait prévu : jamais plus que le solde.
  const retrait = R.projeter({ solde: 10000, versement: 0, debut: '2026-11', cible: 0, horizon: 2, extras: [{ mois: '2026-11', montant: -50000 }] });
  assert.equal(retrait.mois[0].solde, 0);
});

test('versement nécessaire : le plus petit, arrondi à l\'euro supérieur', () => {
  // 3 000 € à réunir en 10 mois depuis 500 € : 250 € par mois.
  assert.equal(R.versementPour({ solde: 50000, cible: 300000, debut: '2026-11' }, '2027-08'), 25000);
  // 9 mois : 2 500 / 9 = 277,78 → 278 €.
  assert.equal(R.versementPour({ solde: 50000, cible: 300000, debut: '2026-11' }, '2027-07'), 27800);
  // Avec intérêts, il faut moins.
  const avec = R.versementPour({ solde: 50000, cible: 1000000, debut: '2026-11', taux: 4 }, '2029-10');
  const sans = R.versementPour({ solde: 50000, cible: 1000000, debut: '2026-11', taux: 0 }, '2029-10');
  assert.ok(avec < sans);
  const p = R.projeter({ solde: 50000, cible: 1000000, debut: '2026-11', taux: 4, versement: avec });
  assert.ok(p.atteint <= '2029-10');
  const moins = R.projeter({ solde: 50000, cible: 1000000, debut: '2026-11', taux: 4, versement: avec - 100 });
  assert.ok(moins.atteint > '2029-10');
  assert.equal(R.versementPour({ solde: 400000, cible: 300000, debut: '2026-11' }, '2027-01'), 0);
  assert.equal(R.versementPour({ solde: 0, cible: 300000, debut: '2026-11' }, '2026-10'), null);
});

test('cible : postes du budget, fonds d\'urgence en mois de dépenses, montant saisi', () => {
  assert.equal(R.cibleObjectif(obj()), 300000);
  assert.equal(R.cibleObjectif(obj({ postes: [{ id: 'a', nom: 'Vol', montant: 90000 }, { id: 'b', nom: 'Hôtel', montant: 120000 }] })), 210000);
  const u = obj({ type: 'urgence', urgence: { mois: 6, depenses: [{ id: 'l', montant: 80000 }, { id: 'c', montant: 45000 }] } });
  assert.equal(R.depensesMensuelles(u), 125000);
  assert.equal(R.cibleObjectif(u), 750000);
  assert.equal(R.moisCouverts(310000, 125000), 2.4);
  assert.equal(R.moisCouverts(310000, 0), 0);
});

test('solde réel et historique : versements, retraits, intérêts notés', () => {
  const o = obj();
  const mv = [
    { id: '1', objectifId: 'o', date: '2026-02-03', montant: 25000, type: 'versement' },
    { id: '2', objectifId: 'o', date: '2026-03-03', montant: 25000, type: 'versement' },
    { id: '3', objectifId: 'o', date: '2026-03-20', montant: -40000, type: 'retrait' },
    { id: '4', objectifId: 'autre', date: '2026-03-21', montant: 99900, type: 'versement' },
  ];
  assert.equal(R.soldeReel(o, mv), 60000);
  assert.equal(R.soldeReel(o, mv, '2026-02-28'), 75000);
  const h = R.historiqueSolde(o, mv);
  assert.deepEqual(simple(h.map((x) => x.solde)), [50000, 75000, 100000, 60000]);
  assert.deepEqual(simple(R.soldesMensuels(o, mv, '2026-01', '2026-03')).map((x) => x.solde), [50000, 75000, 60000]);
});

test('suivi du mois : prévu, versé, reste ; rien après l\'atteinte', () => {
  const o = obj();
  const mv = [{ id: '1', objectifId: 'o', date: '2026-11-05', montant: 10000, type: 'versement' }];
  const prevus = [{ id: 'p', objectifId: 'o', mois: '2026-11', montant: 20000 }];
  const e = R.etatDuMois(o, mv, prevus, '2026-11');
  assert.deepEqual(simple(e), { prevu: 45000, verse: 10000, reste: 35000, statut: 'partiel' });
  assert.equal(R.etatDuMois(o, [], [], '2026-11').statut, 'afaire');
  const atteint = obj({ soldeInitial: 300000 });
  assert.equal(R.etatDuMois(atteint, [], [], '2026-11').statut, 'rien');
  // Le prévu ne dépasse pas ce qui manque.
  const presque = obj({ soldeInitial: 290000 });
  assert.equal(R.prevuDuMois(presque, [], [], '2026-11'), 10000);
});

test('projection d\'un objectif : le versement déjà fait ce mois-ci est déduit', () => {
  const o = obj({ soldeInitial: 0, cible: 100000 });
  const mv = [{ id: '1', objectifId: 'o', date: '2026-11-02', montant: 25000, type: 'versement' }];
  const p = R.projectionObjectif(o, mv, [], '2026-11');
  assert.equal(p.mois[0].verse, 0);
  assert.equal(p.atteint, '2027-02');
  const sans = R.projectionObjectif(o, [], [], '2026-11');
  assert.equal(sans.atteint, '2027-02');
});

test('statut : atteint, dans les temps, en retard, sans date, en pause', () => {
  const c = '2026-11';
  assert.equal(R.statutObjectif(obj({ soldeInitial: 300000 }), [], [], c).statut, 'atteint');
  assert.equal(R.statutObjectif(obj(), [], [], c).statut, 'sans-date');
  // 2 500 € manquants à 250 €/mois : atteint en août 2027.
  const ok = R.statutObjectif(obj({ dateCible: '2027-10' }), [], [], c);
  assert.equal(ok.statut, 'dans-les-temps');
  assert.equal(ok.avance, 2);
  const ko = R.statutObjectif(obj({ dateCible: '2027-05' }), [], [], c);
  assert.equal(ko.statut, 'en-retard');
  assert.equal(ko.retard, 3);
  assert.equal(ko.necessaire, 35800); // 2 500 € en 7 mois → 357,14 → 358 €
  const pause = R.statutObjectif(obj({ versement: 0, dateCible: '2027-05' }), [], [], c);
  assert.equal(pause.statut, 'pause');
  assert.equal(pause.necessaire, 35800);
  assert.equal(R.statutObjectif(obj({ cible: 0 }), [], [], c).statut, 'sans-cible');
});

test('jalons : paliers, mois couverts du fonds d\'urgence, réel puis prévu', () => {
  const o = obj({ soldeInitial: 0, cible: 100000, debut: '2026-01' });
  assert.deepEqual(simple(R.jalons(o).map((j) => j.montant)), [10000, 25000, 50000, 75000, 100000]);
  const u = obj({ urgence: { mois: 6, depenses: [{ id: 'd', montant: 100000 }] } });
  const ju = R.jalons(u);
  assert.ok(ju.some((j) => j.id === 'm1' && j.montant === 100000));
  assert.ok(ju.some((j) => j.id === 'm3' && j.montant === 300000));
  assert.ok(!ju.some((j) => j.id === 'm6'), 'le jalon 6 mois se confond avec l\'objectif');
  assert.ok(ju.some((j) => j.id === 'p50' && j.montant === 300000) === false, 'doublon 50 % / 3 mois retiré');
  const mv = [{ id: '1', objectifId: 'o', date: '2026-03-10', montant: 30000, type: 'versement' }];
  const proj = R.projectionObjectif(o, mv, [], '2026-11');
  const e = R.etatJalons(o, mv, proj);
  assert.equal(e.find((j) => j.id === 'p25').atteintLe, '2026-03-10');
  assert.equal(e.find((j) => j.id === 'p50').atteintLe, null);
  assert.equal(e.find((j) => j.id === 'p50').prevuLe, '2026-11');
});

test('repère de taille du fonds d\'urgence : situation + facteurs, borné de 3 à 12', () => {
  const Q = BASE.questions;
  assert.equal(R.moisConseilles({ situation: 'stable', facteurs: [] }, Q), 3);
  assert.equal(R.moisConseilles({ situation: 'stable', facteurs: ['seul', 'charge'] }, Q), 5);
  assert.equal(R.moisConseilles({ situation: 'independant', facteurs: Q.facteurs.map((f) => f.id) }, Q), 11);
  assert.equal(R.moisConseilles({}, Q), 3);
});

test('rythme : versé contre prévu sur les derniers mois complets', () => {
  const o = obj({ debut: '2026-06' });
  const mv = ['2026-08-02', '2026-09-02', '2026-10-15'].map((d, i) => ({ id: String(i), objectifId: 'o', date: d, montant: i === 2 ? 10000 : 25000, type: 'versement' }));
  const r = R.rythme(o, mv, '2026-11', 3);
  assert.deepEqual(simple(r), { mois: 3, prevu: 75000, verse: 60000, ecart: -15000 });
  assert.equal(R.rythme(obj({ debut: '2026-11' }), mv, '2026-11'), null);
});

test('scénarios : plus de versement ou un taux, plus tôt ; même départ', () => {
  const s = R.comparerScenarios({ solde: 100000, cible: 1000000, debut: '2026-11', capitalisation: 'mensuelle', dateCible: '2029-12' }, [
    { nom: 'A', versement: 20000, taux: 0, apport: 0 },
    { nom: 'B', versement: 30000, taux: 0, apport: 0 },
    { nom: 'C', versement: 20000, taux: 4, apport: 0 },
  ]);
  assert.equal(s[0].duree, 45);
  assert.ok(s[1].duree < s[0].duree);
  assert.ok(s[2].duree < s[0].duree && s[2].interets > 0);
  assert.equal(s[0].totalVerse + 100000 + s[0].interets, 1000000);
  assert.ok(s.every((x) => x.longue.mois.length === s[0].horizon));
  assert.ok(s[0].aDate > 0);
});

test('plan d\'ensemble : total des versements, plan des prochains mois', () => {
  const a = obj({ id: 'a', soldeInitial: 0, cible: 50000, versement: 20000 });
  const b = obj({ id: 'b', soldeInitial: 0, cible: 0, versement: 10000 });
  const c = obj({ id: 'c', soldeInitial: 90000, cible: 50000, versement: 5000 });
  assert.equal(R.totalVersements([a, b, c], []), 30000);
  const plan = R.planVersements([a, b, c], [], [], '2026-11', 4);
  assert.deepEqual(simple(plan.map((m) => m.total)), [30000, 30000, 20000, 10000]);
  assert.ok(plan[2].lignes.find((l) => l.id === 'a').atteint);
});

test('export CSV des mouvements', () => {
  const csv = R.csvMouvements([obj()], [{ id: '1', objectifId: 'o', date: '2026-03-01', montant: -1250, type: 'retrait', note: 'Garage; pneus' }]);
  assert.equal(csv.split('\r\n')[1], '2026-03-01;Voyage;Retrait;-12,50;"Garage; pneus"');
});

test('normaliser : tolère les données incomplètes ou anciennes', () => {
  const n = R.normaliser({ objectifs: [{ id: 'x', taux: '2,5', capitalisation: 'bizarre', urgence: { mois: 40 } }, { nom: 'sans id' }], prevus: [{ id: 'p', objectifId: 'inconnu', mois: '2026-11', montant: 1 }], mouvements: [{ id: 'm', objectifId: 'x', date: 'hier', montant: 1 }] });
  assert.equal(n.objectifs.length, 1);
  assert.equal(n.objectifs[0].taux, 2.5);
  assert.equal(n.objectifs[0].capitalisation, 'mensuelle');
  assert.equal(n.objectifs[0].urgence.mois, 24);
  assert.deepEqual(simple(n.objectifs[0].postes), []);
  assert.equal(n.prevus.length, 0);
  assert.equal(n.mouvements.length, 0);
  assert.deepEqual(simple(R.normaliser(null)), simple(R.etatVide()));
});

test('base intégrée : types complets, aucun taux ni montant figé', () => {
  assert.ok(BASE.types.length >= 12);
  assert.equal(BASE.types.filter((t) => t.urgence).length, 1);
  for (const t of BASE.types) {
    assert.ok(t.id && t.nom && t.support && t.attention && t.horizon > 0, t.id);
    assert.ok(t.urgence || Array.isArray(t.postes), t.id);
  }
  assert.ok(BASE.depensesEssentielles.length >= 10);
  assert.equal(new Set(BASE.couleurs).size, BASE.couleurs.length);
  // Aucun pourcentage chiffré dans la base (pas de taux de livret).
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/\d+(?:[,.]\d+)?\s?%/.test(texte), 'aucun taux en pourcentage dans la base');
  assert.ok(/conseil financier/.test(BASE.avertissement));
});
