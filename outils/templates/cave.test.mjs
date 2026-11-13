// Tests du moteur de CaveManager (templates/cave/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/cave/donnees.js', '../../templates/cave/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.CVM;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const vin = (id, extra = {}) => ({ id, nom: id, categorie: 'rouge', millesime: 2020, ...extra });
const mvt = (vinId, date, type, quantite, extra = {}) => ({ id: `${vinId}-${date}-${type}-${quantite}`, vinId, date, type, quantite, motif: type === 'entree' ? 'achat' : 'consommee', ...extra });
const cave = (vins, mouvements = []) => R.normaliser({ vins, mouvements }, AUJ);

test('base : catégories et règles de garde cohérentes', () => {
  for (const c of BASE.categories) { const g = BASE.garde[c.id]; assert.ok(g, c.id); assert.ok(g.debut <= g.apogee && g.apogee <= g.fin, c.id); }
  assert.match(BASE.avertissement, /modération/);
  assert.match(BASE.avertissement, /indicatifs/);
});

test('stock : somme des mouvements, à une date donnée', () => {
  const e = cave([vin('a')], [mvt('a', '2025-01-10', 'entree', 6), mvt('a', '2025-06-01', 'sortie', 2), mvt('a', '2026-03-01', 'entree', 3), mvt('a', '2026-10-01', 'sortie', 1)]);
  assert.equal(R.stock(e, 'a'), 6);
  assert.equal(R.stock(e, 'a', '2025-12-31'), 4);
  assert.equal(R.stock(e, 'inconnu'), 0);
});

test('mouvements : jamais de stock négatif, à aucune date', () => {
  const e = cave([vin('a')], [mvt('a', '2025-01-10', 'entree', 2), mvt('a', '2026-01-10', 'entree', 4)]);
  assert.equal(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2025-06-01', type: 'sortie', quantite: 2 }), null);
  assert.match(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2025-06-01', type: 'sortie', quantite: 3 }), /Stock insuffisant/, 'avant le second achat, seulement 2 bouteilles');
  assert.equal(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2026-02-01', type: 'sortie', quantite: 6 }), null);
  assert.match(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2026-02-01', type: 'sortie', quantite: 7 }), /Stock insuffisant/);
  assert.match(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2026-02-01', type: 'sortie', quantite: 0 }), /au moins 1/);
  assert.match(R.validerMouvement(e, { id: 'n', vinId: 'a', date: '2026-02-30', type: 'sortie', quantite: 1 }), /Date/);
  // Modifier une entrée passée : la réduire peut casser une sortie postérieure.
  const e2 = cave([vin('a')], [mvt('a', '2025-01-10', 'entree', 6), mvt('a', '2025-06-01', 'sortie', 5)]);
  const entree = e2.mouvements.find((m) => m.type === 'entree');
  assert.match(R.validerMouvement(e2, { ...entree, quantite: 3 }, entree.id), /Stock insuffisant/);
  // Même jour : l'entrée compte avant la sortie.
  assert.equal(R.premierNegatif([mvt('a', '2026-01-01', 'sortie', 1), mvt('a', '2026-01-01', 'entree', 1)]), null);
});

test('fenêtre : saisie, règle indicative, sans millésime', () => {
  const g = R.normaliserGarde({});
  assert.deepEqual(simple(R.fenetre(vin('a'), g)), { debut: 2023, apogee: 2026, fin: 2030, source: 'regle' });
  assert.deepEqual(simple(R.fenetre(vin('b', { fenetre: { debut: 2024, fin: 2040 } }), g)), { debut: 2024, fin: 2040, apogee: 2032, source: 'saisie' });
  assert.equal(R.fenetre(vin('c', { millesime: null }), g).source, 'inconnue');
  const g2 = R.normaliserGarde({ rouge: { debut: 5, apogee: 10, fin: 20 } });
  assert.equal(R.fenetre(vin('a'), g2).fin, 2040, 'règle modifiée dans les réglages');
});

test('état de garde selon l\'année', () => {
  const g = R.normaliserGarde({});
  const v = vin('a', { fenetre: { debut: 2024, apogee: 2026, fin: 2028 } });
  assert.equal(R.etatGarde(v, g, 2023), 'trop-jeune');
  assert.equal(R.etatGarde(v, g, 2025), 'a-boire');
  assert.equal(R.etatGarde(v, g, 2026), 'apogee');
  assert.equal(R.etatGarde(v, g, 2028), 'fin-proche');
  assert.equal(R.etatGarde(v, g, 2029), 'passee');
  assert.equal(R.etatGarde(vin('x', { millesime: null }), g, 2026), 'inconnu');
});

test('valeur : déclarée, sinon prix moyen pondéré, sinon prix de la fiche', () => {
  const e = cave([vin('a', { prixAchat: 1000 }), vin('b', { valeur: 5000, prixAchat: 2000 }), vin('c')], [
    mvt('a', '2025-01-01', 'entree', 2, { prixUnitaire: 1200 }), mvt('a', '2025-06-01', 'entree', 4, { prixUnitaire: 1500 }), mvt('a', '2025-07-01', 'entree', 1, { motif: 'cadeau' }),
    mvt('b', '2025-01-01', 'entree', 3), mvt('c', '2025-01-01', 'entree', 2),
  ]);
  assert.equal(R.prixMoyen(e, 'a'), 1400); // (2 × 12 + 4 × 15) / 6, le cadeau sans prix exclu
  assert.equal(R.valeurUnitaire(e, e.vins[0]), 1400);
  assert.equal(R.valeurUnitaire(e, e.vins[1]), 5000);
  assert.equal(R.valeurUnitaire(e, e.vins[2]), null);
  const s = R.statistiques(e, AUJ);
  assert.equal(s.bouteilles, 12);
  assert.equal(s.valeur, 7 * 1400 + 3 * 5000);
  assert.equal(s.sansValeur, 2);
});

test('statistiques : répartitions, sorties sur 12 mois, états', () => {
  const e = cave([
    vin('a', { region: 'Région A', millesime: 2019 }), vin('b', { categorie: 'blanc', region: 'Région B', millesime: 2024 }),
    vin('c', { categorie: 'rose', millesime: 2018, emplacement: 'Casier 1' }), vin('d', { millesime: null, categorie: 'effervescent' }), vin('vide'),
  ], [mvt('a', '2025-01-01', 'entree', 6), mvt('a', '2026-05-10', 'sortie', 2), mvt('b', '2025-01-01', 'entree', 3), mvt('c', '2020-01-01', 'entree', 1), mvt('d', '2026-01-01', 'entree', 2), mvt('vide', '2025-01-01', 'entree', 1), mvt('vide', '2025-02-01', 'sortie', 1, { motif: 'offerte' })]);
  const s = R.statistiques(e, AUJ);
  assert.equal(s.references, 4); assert.equal(s.bouteilles, 10);
  assert.deepEqual(simple(s.parCategorie.map((x) => [x.nom, x.nb])), [['Rouge', 4], ['Blanc', 3], ['Effervescent', 2], ['Rosé', 1]]);
  assert.equal(s.parCategorie[0].part, 40);
  assert.equal(s.parRegion.find((x) => x.nom === 'Non renseigné').nb, 3);
  assert.equal(s.parMillesime.find((x) => x.nom === 'Sans millésime').nb, 2);
  assert.equal(s.consommees12, 2);
  assert.equal(s.mois.at(-1).mois, '2026-11'); assert.equal(s.mois.find((m) => m.mois === '2026-05').sorties, 2);
  assert.equal(s.parEtat.passee, 1); // rosé 2018 : fenêtre 2018–2020
  assert.equal(s.parEtat.inconnu, 2);
});

test('alertes et suggestions : urgence, apogée, filtres, raisons', () => {
  const e = cave([
    vin('passe', { categorie: 'rose', millesime: 2022 }), // fenêtre 2022–2024 : passée
    vin('fin', { fenetre: { debut: 2020, fin: 2026 } }), // dernière année
    vin('apogee', { millesime: 2020, note: 5 }), // rouge 2020 : apogée 2026, fin 2030
    vin('jeune', { millesime: 2025 }), // trop jeune
    vin('cher', { fenetre: { debut: 2024, apogee: 2025, fin: 2027 }, valeur: 9000 }),
    vin('sansstock', { categorie: 'rose', millesime: 2022 }),
  ], ['passe', 'fin', 'apogee', 'jeune', 'cher'].map((id) => mvt(id, '2025-01-01', 'entree', id === 'apogee' ? 6 : 1)));
  const a = R.alertes(e, AUJ);
  assert.deepEqual(simple(a.passes.map((x) => x.vin.id)), ['passe']);
  assert.deepEqual(simple(a.finProche.map((x) => x.vin.id)), ['fin']);
  assert.deepEqual(simple(a.apogee.map((x) => x.vin.id)), ['apogee']);
  const s = R.suggestions(e, {}, AUJ);
  // passe : 100 + 25 = 125 ; fin : 100 ; apogee : 100 − 60 + 20 + 20 (6 bouteilles) + 20 (note) = 100 ; cher : 85.
  // À égalité, ordre alphabétique (« apogee » avant « fin »).
  assert.deepEqual(simple(s.map((x) => x.vin.id)), ['passe', 'apogee', 'fin', 'cher'], 'trop jeune et sans stock exclus');
  assert.deepEqual(simple(s.map((x) => x.score)), [125, 100, 100, 85]);
  assert.ok(s[0].raisons[0].includes('à ouvrir vite'));
  assert.ok(s.find((x) => x.vin.id === 'apogee').raisons.includes('à son apogée cette année'));
  assert.deepEqual(simple(R.suggestions(e, { valeurMax: 5000 }, AUJ).map((x) => x.vin.id)), ['passe', 'apogee', 'fin'], 'valeur maximale');
  assert.deepEqual(simple(R.suggestions(e, { categorie: 'rose' }, AUJ).map((x) => x.vin.id)), ['passe']);
});

test('validation d\'une fiche de vin', () => {
  const v = (x) => R.validerVin({ ...R.normaliserVin(vin('a'), 2027), ...x }, 2026);
  assert.equal(v({}), null);
  assert.match(v({ nom: '' }), /nom/);
  assert.match(v({ millesime: 1700 }), /Millésime/);
  assert.match(v({ millesime: 2030 }), /Millésime/);
  assert.equal(v({ millesime: null }), null, 'vin sans millésime');
  assert.match(v({ fenetre: { debut: 2030, fin: 2025 } }), /suivre/);
  assert.match(v({ fenetre: { debut: 2019, fin: 2025 } }), /avant le millésime/);
  assert.match(v({ fenetre: { debut: 2021, apogee: 2030, fin: 2025 } }), /Apogée/);
  assert.match(v({ fenetre: { debut: 2021, fin: null } }), /toutes deux/);
  assert.match(v({ prixAchat: -5 }), /positif/);
});

test('normalisation : sauvegarde abîmée, historique impossible corrigé', () => {
  const e = R.normaliser({ vins: [{ id: 'a', nom: '', categorie: 'zz', millesime: 3000, format: 'x', fenetre: { debut: 2030, fin: 2020 }, note: 9 }], mouvements: [
    { vinId: 'a', date: '2025-01-01', type: 'sortie', quantite: 2 }, { vinId: 'a', date: '2025-02-01', type: 'entree', quantite: 3, prixUnitaire: -4, motif: 'vol' },
    { vinId: 'fantome', date: '2025-01-01', type: 'entree', quantite: 1 }, { vinId: 'a', date: '2025-03-01', type: 'sortie', quantite: 1, noteDegustation: 4 },
  ], reglages: { garde: { rouge: { debut: 10, fin: 2, apogee: 50 } } } }, AUJ);
  const v = e.vins[0];
  assert.equal(v.nom, 'Vin sans nom'); assert.equal(v.categorie, 'rouge'); assert.equal(v.millesime, null); assert.equal(v.format, '75'); assert.equal(v.fenetre, null); assert.equal(v.note, 0);
  assert.equal(e.mouvements.length, 2, 'sortie avant toute entrée écartée, mouvement orphelin écarté');
  assert.equal(e.mouvements[0].motif, 'achat'); assert.equal(e.mouvements[0].prixUnitaire, null);
  assert.equal(R.stock(e, 'a'), 2);
  assert.deepEqual(simple(e.reglages.garde.rouge), { debut: 10, apogee: 10, fin: 10 });
  assert.deepEqual(simple(R.normaliser(simple(e), AUJ)), simple(e));
});

test('exports CSV', () => {
  const e = cave([vin('a', { nom: 'Cuvée; test', region: 'Région', valeur: 2500 })], [mvt('a', '2025-01-01', 'entree', 3, { prixUnitaire: 2000 }), mvt('a', '2026-01-01', 'sortie', 1, { noteDegustation: 4, commentaire: 'Très bon' })]);
  const c = R.csvCave(e, AUJ);
  assert.deepEqual(simple(c[1].slice(0, 3)), ['Cuvée; test', '', 'Rouge']);
  assert.deepEqual(simple(c[1].slice(9, 18)), [2, '20,00', '25,00', '50,00', 2023, 2026, 2030, 'Règle indicative', 'Apogée']);
  const m = R.csvMouvements(e);
  assert.deepEqual(simple(m[1]), ['2026-01-01', 'Cuvée; test', 2020, 'Sortie', 'Consommée', 1, '', 4, 'Très bon']);
});
