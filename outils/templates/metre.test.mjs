// Tests du moteur de MétréPro (templates/metre/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.structuredClone = structuredClone;
ctx.TextEncoder = TextEncoder;
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/metre/donnees.js', '../../templates/metre/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.MTR;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const biblio = R.bibliothequeInitiale();
const ouv = (id) => biblio.find((o) => o.id === id);
const ligne = (extra) => R.normaliserLigne({ id: 'l1', zoneId: 'z1', ouvrageId: 'carrelage-sol', forme: 'rect', dims: { L: 4, l: 3 }, nombre: 1, ...extra }, [{ id: 'z1', nom: 'Séjour' }], [{ id: 'base', nom: 'Base' }]);
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('base : formes, familles et ouvrages cohérents', () => {
  const formes = new Set(BASE.formes.map((f) => f.id));
  const familles = new Set(BASE.familles.map((f) => f.id));
  const ids = new Set();
  assert.ok(BASE.ouvrages.length >= 40, `${BASE.ouvrages.length} ouvrages`);
  for (const o of BASE.ouvrages) {
    assert.ok(!ids.has(o.id), `identifiant en double ${o.id}`); ids.add(o.id);
    assert.ok(formes.has(o.forme), `${o.id} : forme`);
    assert.ok(familles.has(o.famille), `${o.id} : famille`);
    assert.ok(R.UNITES.includes(o.unite), `${o.id} : unité`);
    const fo = R.forme(o.forme);
    assert.ok(!fo.unite || fo.unite === o.unite, `${o.id} : forme ${o.forme} incompatible avec ${o.unite}`);
    assert.ok(o.perte >= 0 && o.perte <= 30, `${o.id} : perte`);
    for (const c of o.composants) { assert.ok(c.ratio > 0, `${o.id} / ${c.nom} : ratio`); assert.ok(R.UNITES.includes(c.unite)); assert.ok(c.cond === null || c.cond > 0); }
  }
  assert.ok(Object.keys(R.FORMULES).every((k) => formes.has(k)) && formes.size === Object.keys(R.FORMULES).length);
});

test('formes : chaque calcul et sa formule développée', () => {
  const cas = [
    ['rect', { L: 4.2, l: 3.1 }, 13.02, '4,2 × 3,1 = 13,02 m²', 'carrelage-sol'],
    ['mur', { L: 10, H: 2.5 }, 25, '10 × 2,5 = 25 m²', 'peinture-murs'],
    ['triangle', { b: 6, h: 2 }, 6, '6 × 2 ÷ 2 = 6 m²', 'libre-m2'],
    ['disque', { d: 2 }, Math.round(Math.PI * 1000) / 1000, 'π × 2² ÷ 4 = 3,142 m²', 'libre-m2'],
    ['volume', { L: 5, l: 4, e: 12 }, 2.4, '5 × 4 × 0,12 = 2,4 m³', 'dalle'],
    ['cylindre', { d: 0.3, H: 2 }, 0.141, 'π × 0,3² ÷ 4 × 2 = 0,141 m³', 'dalle'],
    ['lineaire', { L: 12.5 }, 12.5, '12,5 = 12,5 m', 'gouttiere'],
    ['perimetre', { L: 4, l: 3 }, 14, '2 × (4 + 3) = 14 m', 'plinthes'],
    ['unite', {}, 1, '1 = 1 u', 'prise'],
    ['direct', { q: 7.5 }, 7.5, '7,5 = 7,5 m²', 'libre-m2'],
  ];
  for (const [forme, dims, attendu, formule, o] of cas) {
    const c = R.calculerLigne(ligne({ forme, dims, ouvrageId: o, perte: 0 }), ouv(o));
    assert.ok(c.ok, `${forme} : ${c.erreur}`);
    proche(c.theorique, attendu, 1e-3);
    assert.equal(c.formule, formule, forme);
  }
});

test('nombre, déductions d\'ouvertures et de longueur', () => {
  const c = R.calculerLigne(ligne({ ouvrageId: 'peinture-murs', forme: 'mur', dims: { L: 17.4, H: 2.5 }, deductions: [{ libelle: 'Fenêtre', nombre: 2, a: 1.2, b: 1.35 }, { libelle: 'Porte', nombre: 1, a: 0.83, b: 2.04 }] }), ouv('peinture-murs'));
  assert.ok(c.ok);
  proche(c.brut, 43.5);
  proche(c.deduction, 2 * 1.2 * 1.35 + 0.83 * 2.04, 1e-3);
  proche(c.theorique, 43.5 - 3.24 - 1.6932, 1e-3);
  assert.equal(c.formule, '17,4 × 2,5 − 2 × (1,2 × 1,35) − (0,83 × 2,04) = 38,567 m²');
  const p = R.calculerLigne(ligne({ ouvrageId: 'plinthes', forme: 'perimetre', dims: { L: 4, l: 3 }, deductions: [{ libelle: 'Porte', nombre: 1, a: 0.83 }] }), ouv('plinthes'));
  assert.equal(p.formule, '2 × (4 + 3) − 0,83 = 13,17 m');
  const n = R.calculerLigne(ligne({ nombre: 3, perte: 0 }), ouv('carrelage-sol'));
  assert.equal(n.theorique, 36);
  assert.equal(n.formule, '3 × (4 × 3) = 36 m²');
  // Déduction ignorée pour une forme qui ne l'accepte pas (volume).
  const v = R.calculerLigne(ligne({ ouvrageId: 'dalle', forme: 'volume', dims: { L: 2, l: 2, e: 10 }, deductions: [{ a: 1, b: 1 }] }), ouv('dalle'));
  assert.equal(v.theorique, 0.4);
});

test('pertes, quantité retenue et écart', () => {
  const c = R.calculerLigne(ligne({}), ouv('carrelage-sol'));
  assert.equal(c.theorique, 12);
  assert.equal(c.perte, 10);
  assert.equal(c.avecPertes, 13.2);
  assert.equal(c.retenue, 13.2);
  assert.equal(c.ecart, 1.2);
  assert.equal(c.ecartPct, 10);
  const p = R.calculerLigne(ligne({ perte: 15 }), ouv('carrelage-sol'));
  assert.equal(p.avecPertes, 13.8);
  const r = R.calculerLigne(ligne({ retenue: 14.4 }), ouv('carrelage-sol'));
  assert.equal(r.retenue, 14.4);
  assert.equal(r.ecart, 2.4);
  assert.equal(r.ecartPct, 20);
  const z = R.calculerLigne(ligne({ perte: 0 }), ouv('carrelage-sol'));
  assert.equal(z.avecPertes, 12);
});

test('erreurs de saisie : manquant, nul, négatif, extrême, incohérence d\'unité, déductions excessives', () => {
  const err = (extra, o = 'carrelage-sol') => R.calculerLigne(ligne(extra), ouv(o));
  assert.match(err({ dims: { L: 4 } }).erreur, /manquante : largeur/);
  assert.match(err({ dims: { L: 4, l: 0 } }).erreur, /nulle/);
  assert.match(R.calculerLigne({ ...ligne({}), dims: { L: -4, l: 3 } }, ouv('carrelage-sol')).erreur, /négative/);
  assert.match(err({ dims: { L: 40000, l: 3 } }).erreur, /trop grande/);
  assert.match(R.calculerLigne({ ...ligne({}), nombre: 0 }, ouv('carrelage-sol')).erreur, /strictement positif/);
  assert.match(err({ forme: 'volume', dims: { L: 1, l: 1, e: 10 } }).erreur, /m³.*m²/);
  assert.match(err({ forme: 'mur', dims: { L: 2, H: 2 }, deductions: [{ a: 3, b: 2 }] }).erreur, /dépassent/);
  assert.match(err({ deductions: [{ libelle: 'Trou', a: 0, b: 1 }] }).erreur, /Trou.*incomplète/);
  assert.equal(err({ forme: 'zzz' }).ok, false);
  const e = err({ dims: { L: 4 } });
  assert.equal(e.theorique, 0);
  // Ouvrage supprimé de la bibliothèque : calcul possible avec l'unité de la forme, sans composants.
  const s = R.calculerLigne(ligne({ ouvrageId: 'disparu' }), null);
  assert.ok(s.ok);
  assert.equal(s.unite, 'm2');
  // Quantité directe nulle admise (poste à zéro dans une variante).
  assert.ok(R.calculerLigne(ligne({ forme: 'direct', dims: { q: 0 }, ouvrageId: 'libre-m2' }), ouv('libre-m2')).ok);
});

test('commande au conditionnement supérieur', () => {
  assert.deepEqual(simple(R.commande({ besoin: 13.2, cond: 1.44 })), { besoin: 13.2, cond: 1.44, sources: [], nbCond: 10, commande: 14.4, surplus: 1.2 });
  assert.equal(R.commande({ besoin: 14.4, cond: 1.44 }).nbCond, 10); // exactement 10 boîtes, pas 11
  assert.equal(R.commande({ besoin: 0.001, cond: 35 }).nbCond, 1);
  assert.equal(R.commande({ besoin: 0, cond: 35 }).nbCond, 0);
  assert.equal(R.commande({ besoin: 7.456, cond: null }).commande, 7.46);
});

function projetTest() {
  return R.normaliserProjet({
    id: 'p1', nom: 'Test', variantes: [{ id: 'a', nom: 'Carrelage' }, { id: 'b', nom: 'Parquet' }], varianteActive: 'a',
    zones: [{ id: 'z1', nom: 'Séjour' }, { id: 'z2', nom: 'Chambre' }],
    lignes: [
      { id: 'l1', zoneId: 'z1', ouvrageId: 'carrelage-sol', forme: 'rect', dims: { L: 4, l: 3 }, variantes: ['a'] },
      { id: 'l2', zoneId: 'z1', ouvrageId: 'parquet', forme: 'rect', dims: { L: 4, l: 3 }, variantes: ['b'] },
      { id: 'l3', zoneId: 'z2', ouvrageId: 'carrelage-sol', forme: 'rect', dims: { L: 3, l: 3 }, variantes: ['a'] },
      { id: 'l4', zoneId: 'z1', ouvrageId: 'peinture-murs', forme: 'mur', dims: { L: 14, H: 2.5 } },
      { id: 'l5', zoneId: 'z2', ouvrageId: 'peinture-murs', forme: 'mur', dims: { L: 12, H: 2.5 } },
      { id: 'l6', zoneId: 'z2', ouvrageId: 'carrelage-sol', forme: 'rect', dims: { L: 3 } },
    ],
  });
}

test('synthèse : regroupement par ouvrage et famille, composants additionnés puis arrondis', () => {
  const s = R.synthese(projetTest(), biblio, 'a');
  assert.equal(s.lignes.length, 5); // l2 (variante b) exclue
  assert.equal(s.erreurs.length, 1); // l6 incomplète, signalée et exclue des totaux
  const carrelage = s.ouvrages.find((o) => o.ouvrageId === 'carrelage-sol');
  assert.equal(carrelage.theorique, 21);
  assert.equal(carrelage.retenue, 23.1);
  assert.equal(carrelage.nbLignes, 2);
  assert.deepEqual(simple(carrelage.zones), [{ zone: 'Séjour', q: 13.2 }, { zone: 'Chambre', q: 9.9 }]);
  assert.deepEqual(simple(s.familles.map((g) => g.famille)), ['sols', 'murs']);
  const boites = s.composants.find((k) => k.nom.startsWith('Carreaux'));
  assert.equal(boites.besoin, 23.1);
  assert.equal(boites.nbCond, 17); // 23,1 / 1,44 = 16,04 → 17 boîtes
  assert.equal(boites.commande, 24.48);
  const peinture = s.composants.find((k) => k.nom.startsWith('Peinture de finition'));
  assert.equal(peinture.besoin, 13); // (35 + 30) m² × 0,2 L/m²
  assert.equal(peinture.nbCond, 2);
  // L'arrondi se fait sur le total, pas ligne par ligne.
  const colle = s.composants.find((k) => k.nom.startsWith('Mortier-colle'));
  assert.equal(colle.besoin, 115.5);
  assert.equal(colle.nbCond, 5);
});

test('variantes : comparaison et lignes communes', () => {
  const p = projetTest();
  const sb = R.synthese(p, biblio, 'b');
  assert.ok(!sb.ouvrages.some((o) => o.ouvrageId === 'carrelage-sol'));
  assert.equal(sb.ouvrages.find((o) => o.ouvrageId === 'parquet').retenue, 12.84);
  const c = R.comparaison(p, biblio);
  const peinture = c.ouvrages.find((o) => o.nom.startsWith('Peinture de murs'));
  assert.deepEqual(simple(peinture.q), [65, 65]);
  assert.equal(peinture.differe, false);
  const carrelage = c.ouvrages.find((o) => o.nom.startsWith('Carrelage'));
  assert.deepEqual(simple(carrelage.q), [23.1, 0]);
  assert.ok(carrelage.differe);
  assert.deepEqual(simple(c.erreurs), [1, 1]); // l6 est commune aux deux variantes
});

test('bordereau numéroté par famille', () => {
  const b = R.bordereau(projetTest(), biblio, 'a');
  assert.deepEqual(simple(b.map((g) => g.numero)), ['1', '2']);
  assert.equal(b[0].postes[0].numero, '1.1');
  assert.equal(b[1].postes[0].designation, 'Peinture de murs (impression + 2 couches)');
  assert.equal(b[1].postes[0].quantite, 65);
});

test('changement de bibliothèque : perte et conditionnement modifiés recalculent le projet', () => {
  const b2 = simple(biblio);
  const o = b2.find((x) => x.id === 'carrelage-sol');
  o.perte = 5;
  o.composants[0].cond = 2;
  const s = R.synthese(projetTest(), b2, 'a');
  assert.equal(s.ouvrages.find((x) => x.ouvrageId === 'carrelage-sol').retenue, 22.05);
  assert.equal(s.composants.find((k) => k.nom.startsWith('Carreaux')).nbCond, 12);
  assert.equal(R.usages({ projets: [projetTest()] }, 'carrelage-sol'), 3);
});

test('normalisation : sauvegarde abîmée ou incomplète', () => {
  assert.equal(R.normaliser(null).projets.length, 0);
  assert.ok(R.normaliser({}).bibliotheque.length >= 40);
  const e = R.normaliser({ projets: [{ nom: '', variantes: [], zones: [{ id: 'z' }], lignes: [{ zoneId: 'inconnue', forme: 'bidon', dims: { L: 'abc', l: '2,5' }, nombre: -1, perte: 300, variantes: ['inexistante'] }] }], projetActif: 'nimporte', bibliotheque: [{ unite: 'parsec', forme: 'volume', perte: -2, composants: [{ ratio: 'x', cond: 0 }] }] });
  const p = e.projets[0];
  assert.equal(p.nom, 'Projet sans nom');
  assert.equal(p.variantes.length, 1);
  assert.equal(p.projetActif, undefined);
  assert.equal(e.projetActif, p.id);
  const l = p.lignes[0];
  assert.equal(l.zoneId, 'z');
  assert.equal(l.forme, 'direct');
  assert.equal(l.dims.L, undefined);
  assert.equal(l.dims.l, 2.5);
  assert.equal(l.nombre, 1);
  assert.equal(l.perte, null);
  assert.deepEqual(simple(l.variantes), []);
  const o = e.bibliotheque[0];
  assert.equal(o.unite, 'u');
  assert.equal(o.forme, 'unite');
  assert.equal(o.perte, 0);
  assert.equal(o.composants[0].ratio, 0);
  assert.equal(o.composants[0].cond, null);
  // Idempotence : normaliser deux fois ne change rien.
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('exports CSV : métré détaillé, commande, bordereau', () => {
  const p = projetTest();
  const m = R.csvMetre(p, biblio);
  assert.equal(m.length, 7);
  assert.equal(m[0].length, m[1].length);
  const l1 = m[1];
  assert.equal(l1[1], 'Séjour');
  assert.equal(l1[17], '4 × 3 = 12 m²');
  assert.equal(l1[19], '12');
  assert.equal(l1[21], '13,2');
  assert.equal(m[6].at(-1).startsWith('Dimension manquante'), true);
  const ctxO = ctx.window.QME_OUTILS;
  const relu = ctxO.lireCsv(ctxO.versCsv(m));
  assert.deepEqual(simple(relu), simple(m).map((r) => r.map(String)));
  const c = R.csvCommande(p, biblio, 'a');
  assert.equal(c[0][6], 'Quantité à commander');
  assert.ok(c.some((r) => r[1].startsWith('Carreaux') && r[5] === 17));
  const b = R.csvBordereau(p, biblio, 'a');
  assert.equal(b[1][1], 'REVÊTEMENTS DE SOLS');
  assert.equal(b[2][0], '1.1');
});
