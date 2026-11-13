// Tests des règles métier du remboursement de dettes (templates/dettes/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/dettes/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.DTT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));

const d = (id, capital, taux, mensualite, extra = {}) => ({ id, nom: id, capital, taux, mensualite, ...extra });
// Trois dettes de référence (centimes).
const TROIS = () => [
  d('carte', 120000, 21, 6000),   // 1 200 € à 21 %, 60 €/mois
  d('auto', 600000, 5, 20000),    // 6 000 € à 5 %, 200 €/mois
  d('conso', 250000, 9, 10000),   // 2 500 € à 9 %, 100 €/mois
];

test('montants : saisie à la française, affichage', () => {
  assert.equal(R.versCentimes('1 234,56'), 123456);
  assert.equal(R.versCentimes('12.5'), 1250);
  assert.equal(R.versCentimes('12 €'), 1200);
  assert.equal(R.versCentimes('0,05'), 5);
  assert.equal(R.versCentimes('-3'), null);
  assert.equal(R.versCentimes('abc'), null);
  assert.equal(R.versCentimes('1,234'), null);
  assert.equal(R.euros(123456), '1\u202f234,56\u00a0€');
  assert.equal(R.euros(-500), '−5,00\u00a0€');
  assert.equal(R.eurosRonds(123456), '1\u202f235\u00a0€');
  assert.equal(R.versSaisie(123456), '1234,56');
});

test('taux : lecture tolérante, bornes', () => {
  assert.equal(R.lireTaux('21,5'), 21.5);
  assert.equal(R.lireTaux('21.5 %'), 21.5);
  assert.equal(R.lireTaux('0'), 0);
  assert.equal(R.lireTaux('3,125'), 3.125);
  assert.equal(R.lireTaux('101'), null);
  assert.equal(R.lireTaux('-2'), null);
  assert.equal(R.lireTaux(''), null);
  assert.equal(R.tauxTexte(21.5), '21,5 %');
});

test('mois : ajout, écart, durée en texte', () => {
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ecartMois('2026-11', '2028-02'), 15);
  assert.equal(R.moisDe(new Date(2026, 10, 13)), '2026-11');
  assert.equal(R.dureeTexte(37), '3 ans et 1 mois');
  assert.equal(R.dureeTexte(12), '1 an');
  assert.equal(R.dureeTexte(5), '5 mois');
  assert.ok(R.estMois('2026-12') && !R.estMois('2026-13'));
});

test('intérêts mensuels simples : capital × taux ÷ 12, arrondi au centime', () => {
  assert.equal(R.interetsMois(120000, 21), 2100); // 1 200 € × 21 % / 12 = 21 €
  assert.equal(R.interetsMois(100000, 0), 0);
  assert.equal(R.interetsMois(0, 20), 0);
  assert.equal(R.interetsMois(33333, 7), 194); // 194,4425 → 194
});

test('mensualité insuffisante pour couvrir les intérêts : détectée, avec le manque', () => {
  const ok = R.couvreInterets(d('a', 120000, 21, 6000));
  assert.equal(ok.ok, true);
  const ko = R.couvreInterets(d('b', 300000, 22, 5000)); // intérêts 55 € > 50 €
  assert.equal(ko.ok, false);
  assert.equal(ko.interet, 5500);
  assert.equal(ko.manque, 501);
  const egal = R.couvreInterets(d('c', 120000, 20, 2000)); // intérêts = mensualité : ne baisse jamais
  assert.equal(egal.ok, false);
  // Seule, une telle dette ne finit jamais : le plan le signale.
  const s = R.simuler([d('b', 300000, 22, 5000)], { budget: 5000, methode: 'boule', debut: '2026-11', max: 120 });
  assert.equal(s.nonTermine, true);
  assert.equal(s.fin, null);
  assert.ok(s.mois.at(-1).totalSolde > 300000);
});

test('ordre de priorité : boule de neige, avalanche, personnalisé', () => {
  const t = TROIS();
  assert.deepEqual(simple(R.ordrePriorite(t, 'boule')), ['carte', 'conso', 'auto']);
  assert.deepEqual(simple(R.ordrePriorite(t, 'avalanche')), ['carte', 'conso', 'auto']);
  const t2 = [d('petit', 50000, 3, 5000), d('cher', 400000, 19, 10000), d('moyen', 150000, 8, 5000)];
  assert.deepEqual(simple(R.ordrePriorite(t2, 'boule')), ['petit', 'moyen', 'cher']);
  assert.deepEqual(simple(R.ordrePriorite(t2, 'avalanche')), ['cher', 'moyen', 'petit']);
  assert.deepEqual(simple(R.ordrePriorite(t2, 'perso', ['moyen'])), ['moyen', 'petit', 'cher']);
  // Égalité de solde : le taux le plus élevé passe d'abord.
  assert.deepEqual(simple(R.ordrePriorite([d('x', 1000, 2, 10), d('y', 1000, 9, 10)], 'boule')), ['y', 'x']);
});

test('simulation : une dette seule, échéancier exact et fin du plan', () => {
  const s = R.simuler([d('a', 100000, 12, 50000)], { budget: 60000, debut: '2026-11' });
  assert.equal(s.ok, true);
  // Mois 1 : intérêts 10 €, paiement 600 € (minimum 500 € + surplus 100 €), solde 410 €.
  // Mois 2 : intérêts 4,10 €, paiement du reste 414,10 €.
  assert.equal(s.mois[0].lignes.a.interet, 1000);
  assert.equal(s.mois[0].lignes.a.paye, 60000);
  assert.equal(s.mois[0].lignes.a.solde, 41000);
  assert.equal(s.mois[0].lignes.a.capital, 59000);
  assert.equal(s.mois[1].lignes.a.interet, 410);
  assert.equal(s.mois[1].lignes.a.paye, 41410);
  assert.equal(s.mois[1].lignes.a.solde, 0);
  assert.equal(s.fin, '2026-12');
  assert.equal(s.duree, 2);
  assert.equal(s.totalInterets, 1410);
  assert.equal(s.totalPaye, 101410);
  assert.equal(s.soldees.a, '2026-12');
  assert.equal(s.inutilise, 60000 - 41410); // reste du budget du dernier mois
});

test('simulation : conservation, capital + intérêts = total payé', () => {
  for (const m of ['boule', 'avalanche', 'perso', 'minimums']) {
    const s = R.simuler(TROIS(), { budget: 50000, methode: m, ordre: ['auto'], debut: '2026-11' });
    const capital = TROIS().reduce((a, x) => a + x.capital, 0);
    assert.equal(s.totalPaye, capital + s.totalInterets, m);
    assert.equal(s.mois.at(-1).totalSolde, 0, m);
    // Chaque mois : budget respecté.
    if (m !== 'minimums') for (const x of s.mois) assert.ok(x.paye <= 50000, `${m} ${x.mois}`);
  }
});

test('report de la mensualité libérée : le budget reste entièrement utilisé', () => {
  const s = R.simuler(TROIS(), { budget: 45000, methode: 'boule', debut: '2026-11' });
  const carte = s.soldees.carte;
  assert.ok(carte);
  // Après la carte, tout le budget continue d'être payé chaque mois (sauf le tout dernier mois).
  for (const x of s.mois.slice(0, -1)) assert.equal(x.paye, 45000, x.mois);
  // Le repère « minimums seuls » ne reporte pas : la fin arrive plus tard et coûte plus.
  const min = R.simuler(TROIS(), { budget: 45000, methode: 'minimums', debut: '2026-11' });
  assert.ok(min.duree > s.duree);
  assert.ok(min.totalInterets > s.totalInterets);
});

test('avalanche : jamais plus d\'intérêts que la boule de neige sur un cas classique', () => {
  const dettes = [d('petit', 80000, 4, 4000), d('cher', 500000, 19.9, 15000), d('moyen', 200000, 8, 8000)];
  const c = R.comparer(dettes, { budget: 40000, debut: '2026-11' });
  assert.ok(c.avalanche.totalInterets < c.boule.totalInterets);
  assert.ok(c.boule.soldees.petit <= c.avalanche.soldees.petit); // boule : première victoire plus tôt
  assert.equal(c.perso.ok, true);
  assert.ok(c.minimums.totalInterets > c.avalanche.totalInterets);
});

test('budget inférieur aux minimums : refusé avec le manque', () => {
  const s = R.simuler(TROIS(), { budget: 30000, debut: '2026-11' });
  assert.equal(s.ok, false);
  assert.equal(s.erreur, 'budget');
  assert.equal(s.manque, 6000);
  assert.equal(R.totalMinimums(TROIS()), 36000);
  // Une mensualité plus grande que le reste dû ne compte que pour ce reste.
  assert.equal(R.totalMinimums([d('a', 1000, 0, 5000)]), 1000);
});

test('budget qui ne couvre pas les intérêts : plan sans fin, signalé', () => {
  const s = R.simuler([d('a', 1000000, 24, 15000)], { budget: 20000, debut: '2026-11', max: 240 });
  assert.equal(s.nonTermine, true); // intérêts 200 € = budget
});

test('versements exceptionnels : fléché ou non, effet mesuré', () => {
  const opts = { budget: 50000, methode: 'avalanche', debut: '2026-11' };
  const fleche = R.simuler(TROIS(), { ...opts, versements: [{ id: 'v', mois: '2027-01', montant: 100000, detteId: 'auto' }] });
  const jan = fleche.mois.find((x) => x.mois === '2027-01');
  assert.equal(jan.extra, 100000);
  assert.equal(jan.lignes.auto.extra, 100000);
  assert.equal(jan.paye, 150000);
  const libre = R.simuler(TROIS(), { ...opts, versements: [{ id: 'v', mois: '2027-01', montant: 100000, detteId: null }] });
  assert.ok(libre.mois.find((x) => x.mois === '2027-01').lignes.carte.paye > 6000 || libre.soldees.carte <= '2027-01');
  const e = R.effetVersements(TROIS(), { ...opts, versements: [{ id: 'v', mois: '2027-01', montant: 100000, detteId: null }] });
  assert.equal(e.total, 100000);
  assert.ok(e.interetsEconomises > 0);
  assert.ok(e.moisGagnes >= 1);
  // Un versement antérieur au début du plan est ignoré.
  const avant = R.effetVersements(TROIS(), { ...opts, versements: [{ id: 'v', mois: '2026-01', montant: 100000 }] });
  assert.equal(avant.total, 0);
  assert.equal(avant.interetsEconomises, 0);
  // Un versement plus gros que tout le reste dû solde le plan sans payer au-delà.
  const enorme = R.simuler(TROIS(), { ...opts, versements: [{ id: 'v', mois: '2026-11', montant: 5000000 }] });
  assert.equal(enorme.duree, 1);
  assert.equal(enorme.totalPaye, TROIS().reduce((a, x) => a + x.capital, 0) + enorme.totalInterets);
});

test('dette déjà soldée et dette à taux zéro', () => {
  const s = R.simuler([d('zero', 60000, 0, 10000), d('fini', 0, 10, 5000)], { budget: 10000, debut: '2026-11' });
  assert.equal(s.soldees.fini, null);
  assert.equal(s.totalInterets, 0);
  assert.equal(s.duree, 6);
  const vide = R.simuler([], { budget: 1000, debut: '2026-11' });
  assert.equal(vide.ok, true);
  assert.equal(vide.mois.length, 0);
});

test('pointage : suivi réel, écart au plan, mois à pointer, recalage', () => {
  const dettes = TROIS();
  const sim = R.simuler(dettes, { budget: 50000, methode: 'boule', debut: '2026-08' });
  const prevu = (m) => R.prevuDuMois(sim, m);
  const p = [];
  let k = 0;
  // Août et septembre payés comme prévu ; octobre : 40 € de moins sur la carte, auto non pointée.
  for (const m of ['2026-08', '2026-09']) for (const [id, v] of Object.entries(prevu(m))) p.push({ id: `p${k++}`, mois: m, detteId: id, montant: v });
  const oct = prevu('2026-10');
  p.push({ id: 'x1', mois: '2026-10', detteId: 'carte', montant: oct.carte - 4000 });
  p.push({ id: 'x2', mois: '2026-10', detteId: 'conso', montant: oct.conso });
  assert.equal(R.dernierMoisPointe(sim, p), '2026-09');
  const a = R.moisAPointer(sim, p, '2026-11');
  assert.deepEqual(simple(a), [{ mois: '2026-10', dettes: ['auto'] }]);
  const ec = R.ecartPlan(dettes, sim, p, '2026-09');
  assert.equal(ec.length, 2);
  assert.equal(ec[1].ecart, 0);
  assert.equal(ec[1].soldeReel, ec[1].soldePrevu);
  p.push({ id: 'x3', mois: '2026-10', detteId: 'auto', montant: oct.auto });
  const ec2 = R.ecartPlan(dettes, sim, p, '2026-10');
  assert.equal(ec2[2].ecart, -4000);
  assert.equal(ec2[2].cumulEcart, -4000);
  assert.ok(ec2[2].soldeReel > ec2[2].soldePrevu); // en retard sur le plan
  assert.equal(ec2[2].avance, ec2[2].soldePrevu - ec2[2].soldeReel);
  // Recalage : nouveau départ en novembre sur les soldes réels.
  const etat = { debut: '2026-08', dettes, paiements: p, versements: [], budget: 50000 };
  const r = R.recaler(etat, '2026-10');
  assert.equal(r.debut, '2026-11');
  assert.equal(r.dettes.reduce((s, x) => s + x.capital, 0), ec2[2].soldeReel);
  assert.equal(r.recalages.length, 1);
  assert.equal(etat.debut, '2026-08'); // l'état d'origine n'est pas modifié
  // Paiement réel plus grand que le reste dû : le solde ne devient pas négatif.
  const sr = R.suiviReel([d('a', 1000, 0, 500)], [{ id: 'z', mois: '2026-11', detteId: 'a', montant: 5000 }], '2026-11', '2026-11');
  assert.equal(sr[0].soldes.a, 0);
});

test('export CSV de l\'échéancier : séparateur point-virgule, virgule décimale, échappement', () => {
  const s = R.simuler([d('a', 100000, 12, 50000, { nom: 'Prêt "perso"; Léa' })], { budget: 60000, debut: '2026-11' });
  const csv = R.csvEcheancier(s, [{ id: 'a', nom: 'Prêt "perso"; Léa' }]);
  const lignes = csv.split('\r\n');
  assert.equal(lignes.length, 3);
  assert.match(lignes[0], /^Mois;Dette;Solde de début;Intérêts;Paiement/);
  assert.equal(lignes[1], '2026-11;"Prêt ""perso""; Léa";1000,00;10,00;600,00;0,00;590,00;410,00');
});

test('normaliser : tolérant aux données anciennes ou abîmées', () => {
  const v = R.normaliser(null);
  assert.equal(v.methode, 'boule');
  assert.deepEqual(simple(v.dettes), []);
  const n = R.normaliser({ debut: '2026-13', budget: -5, methode: 'inconnue', dettes: [{ id: 'a', capital: 1000, taux: '5,5', mensualite: 'x' }, { nom: 'sans id' }], versements: [{ id: 'v', mois: 'mauvais' }], paiements: [{ id: 'p', mois: '2026-11', detteId: 'a', montant: 500 }] });
  assert.equal(n.debut, null);
  assert.equal(n.budget, 0);
  assert.equal(n.methode, 'boule');
  assert.equal(n.dettes.length, 1);
  assert.equal(n.dettes[0].taux, 5.5);
  assert.equal(n.dettes[0].mensualite, 0);
  assert.equal(n.dettes[0].type, 'autre');
  assert.equal(n.versements.length, 0);
  assert.equal(n.paiements.length, 1);
});

test('base intégrée : types complets, méthodes aux couleurs fixes, avertissement et dispositifs d\'aide', () => {
  assert.ok(BASE.types.length >= 10);
  const ids = new Set();
  for (const t of BASE.types) {
    assert.ok(t.id && t.nom && t.ou && t.attention, t.id);
    assert.ok(!ids.has(t.id)); ids.add(t.id);
  }
  for (const id of ['conso', 'renouvelable', 'auto', 'familial', 'decouvert']) assert.ok(ids.has(id), id);
  assert.deepEqual(simple(BASE.methodes.map((m) => m.id)), simple(R.METHODES));
  for (const m of [...BASE.methodes, BASE.minimums]) assert.match(m.couleur, /^#[0-9A-F]{6}$/i);
  assert.match(BASE.avertissement, /ne remplace pas un conseil professionnel/);
  assert.match(BASE.avertissement, /point conseil budget/);
  assert.match(BASE.avertissement, /commission de surendettement/);
  assert.match(BASE.avertissement, /Banque de France/);
  // Aucun taux chiffré figé dans la base (l'utilisateur saisit ses propres contrats).
  assert.doesNotMatch(JSON.stringify(BASE.types), /\d+(,\d+)? ?%/);
  assert.doesNotMatch(JSON.stringify(BASE), /https?:\/\//);
});
