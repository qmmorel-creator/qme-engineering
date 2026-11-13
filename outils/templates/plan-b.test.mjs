// Tests du moteur de PlanB (templates/plan-b/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/plan-b/donnees.js', '../../templates/plan-b/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.PNB;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const foyer = (extra = {}) => R.normaliser({
  reglages: { jours: 3 },
  membres: [{ id: 'm1', prenom: 'A', profil: 'adulte', besoins: ['traitement'] }, { id: 'm2', prenom: 'B', profil: 'adulte' }, { id: 'm3', prenom: 'C', profil: 'enfant' }, { id: 'm4', prenom: 'D', profil: 'bebe' }],
  animaux: [{ espece: 'chat', nombre: 2 }],
  ...extra,
});

test('référentiel : cohérent, daté, prudent', () => {
  assert.equal(BASE.dateReference, '2026-11-13');
  assert.match(BASE.avertissement, /ne remplace pas les consignes des autorités/);
  assert.match(BASE.avertissement, /112/);
  const cats = new Set(BASE.categories.map((c) => c.id));
  for (const a of BASE.articles) { assert.ok(cats.has(a.categorie), a.id); assert.ok(R.REGLES.includes(a.regle), a.id); assert.ok(a.q >= 0); }
  assert.equal(BASE.articles.filter((a) => a.autonomie === 'eau').length, 1);
  assert.equal(BASE.articles.filter((a) => a.autonomie === 'nourriture').length, 1);
  assert.equal(BASE.situations.length, 6);
  const ids = BASE.situations.flatMap((s) => [...s.avant, ...s.pendant, ...s.apres].map(([id]) => id));
  assert.equal(new Set(ids).size, ids.length, 'identifiants d\'actions uniques');
  assert.deepEqual(simple(BASE.urgences.map((u) => u[0])), ['112', '15', '17', '18', '114']);
});

test('composition et besoins selon la règle de chaque article', () => {
  const e = foyer();
  const c = R.composition(e);
  assert.equal(c.personnes, 4); assert.equal(c.bebes, 1); assert.equal(c.animaux, 2); assert.equal(c.parBesoin.traitement, 1);
  const art = (id) => e.articles.find((a) => a.id === id);
  assert.equal(R.besoin(art('eau'), c, 3), 36); // 3 L × 4 personnes × 3 jours
  assert.equal(R.besoin(art('repas'), c, 3), 36);
  assert.equal(R.besoin(art('lampe'), c, 3), 4);
  assert.equal(R.besoin(art('radio'), c, 3), 1);
  assert.equal(R.besoin(art('couches'), c, 3), 18);
  assert.equal(R.besoin(art('eau-animal'), c, 3), 6);
  assert.equal(R.besoin(art('traitement'), c, 7), 7);
  assert.equal(R.besoin(art('papier'), c, 3), 6);
  const vide = R.composition(R.normaliser({}));
  assert.equal(R.besoin(art('radio'), vide, 3), 0, 'foyer vide : aucun besoin');
  assert.equal(R.besoin(art('couches'), R.composition(foyer({ membres: [{ profil: 'adulte' }] })), 3), 0, 'pas de bébé : pas de couches');
});

test('stock utile : lots périmés exclus, plusieurs lots additionnés', () => {
  const e = foyer({ stock: [{ articleId: 'eau', quantite: 12, peremption: '2027-05-01' }, { articleId: 'eau', quantite: 6, peremption: '2026-11-01' }, { articleId: 'eau', quantite: 6, peremption: AUJ }, { articleId: 'inconnu', quantite: 5 }] });
  assert.equal(e.stock.length, 3, 'lot d\'un article inconnu écarté');
  const s = R.stockArticle(e, 'eau', AUJ);
  assert.equal(s.utile, 18); // le lot qui périme aujourd'hui compte encore
  assert.equal(s.perime, 6);
  const b = R.bilanArticles(e, AUJ).find((x) => x.article.id === 'eau');
  assert.equal(b.besoin, 36); assert.equal(b.manquant, 18); assert.equal(b.couverture, 0.5);
});

test('autonomie théorique : eau, nourriture, la plus faible limite', () => {
  const e = foyer({ stock: [{ articleId: 'eau', quantite: 30 }, { articleId: 'repas', quantite: 48 }] });
  const a = R.autonomie(e, AUJ);
  assert.equal(a.eau, 2.5); // 30 L ÷ (3 L × 4)
  assert.equal(a.nourriture, 4); // 48 repas ÷ (3 × 4)
  assert.equal(a.global, 2.5);
  assert.equal(a.limitant, 'eau');
  assert.deepEqual(simple(R.autonomie(R.normaliser({}), AUJ)), { eau: null, nourriture: null, global: null, limitant: null });
  assert.equal(R.autonomie(foyer(), AUJ).global, 0);
  // Changement du référentiel : 2 L par personne et par jour.
  e.articles.find((x) => x.id === 'eau').q = 2;
  assert.equal(R.autonomie(e, AUJ).eau, 3.8);
  e.articles.find((x) => x.id === 'eau').actif = false;
  assert.equal(R.autonomie(e, AUJ).eau, null, 'article désactivé : hors calcul');
});

test('péremptions : périmés et proches selon l\'alerte', () => {
  const e = foyer({ stock: [{ articleId: 'repas', quantite: 4, peremption: '2026-11-10' }, { articleId: 'eau', quantite: 6, peremption: '2026-12-20' }, { articleId: 'piles', quantite: 2, peremption: '2028-01-01' }, { articleId: 'lampe', quantite: 2 }] });
  const p = R.peremptions(e, AUJ, 60);
  assert.equal(p.perimes.length, 1); assert.equal(p.perimes[0].jours, -3);
  assert.equal(p.proches.length, 1); assert.equal(p.proches[0].jours, 37);
  assert.equal(R.peremptions(e, AUJ, 30).proches.length, 0);
});

test('préparation : pondération documentée et niveaux', () => {
  assert.equal(R.POIDS.reserves + R.POIDS.plan + R.POIDS.contacts, 1);
  const e = foyer();
  assert.equal(R.preparation(e, AUJ).score, 0);
  assert.equal(R.preparation(e, AUJ).niveau, 'À démarrer');
  // Tout acheté, toutes les actions « avant » faites, un contact : 100.
  const bilan = R.bilanArticles(e, AUJ);
  e.stock = bilan.filter((x) => x.besoin > 0).map((x) => ({ id: x.article.id, articleId: x.article.id, quantite: x.besoin * 2, peremption: null, emplacement: '' }));
  for (const s of BASE.situations) for (const [id] of s.avant) e.faits[id] = AUJ;
  e.faits['besoin-traitement'] = AUJ;
  e.contacts = [{ id: 'c', nom: 'Voisin' }];
  const p = R.preparation(e, AUJ);
  assert.equal(p.reserves, 100, 'couverture plafonnée à 100 % par article');
  assert.equal(p.plan, 100);
  assert.equal(p.score, 100);
  assert.equal(p.niveau, 'Très bien préparé');
  e.contacts = [];
  assert.equal(R.preparation(e, AUJ).score, 90);
});

test('manques : achats, remplacements, actions liées aux besoins, contacts', () => {
  const e = foyer({ stock: [{ articleId: 'eau', quantite: 36 }, { articleId: 'repas', quantite: 10, peremption: '2026-01-01' }] });
  const m = R.manques(e, AUJ);
  assert.ok(!m.some((x) => x.articleId === 'eau' && x.type === 'achat'), 'eau couverte');
  const repas = m.find((x) => x.articleId === 'repas' && x.type === 'achat');
  assert.equal(repas.quantite, 36, 'lot périmé non compté');
  assert.ok(m.some((x) => x.type === 'remplacer' && x.articleId === 'repas'));
  assert.ok(m.some((x) => x.type === 'action' && x.id === 'besoin-traitement'));
  assert.ok(m.some((x) => x.type === 'contact'));
  assert.equal(m[0].type, 'remplacer', 'les périmés à remplacer viennent en premier');
  assert.equal(R.manques(R.normaliser({}), AUJ)[0].type, 'foyer');
});

test('actions de situation : référentiel et actions personnelles', () => {
  const e = foyer({ persos: [{ situationId: 'evacuation', moment: 'avant', texte: 'Clé du voisin dans le sac' }, { situationId: 'inconnue', moment: 'avant', texte: 'x' }] });
  assert.equal(e.persos.length, 1);
  const a = R.actions(e, 'evacuation');
  assert.equal(a.avant.at(-1).texte, 'Clé du voisin dans le sac');
  assert.equal(a.avant.at(-1).perso, true);
  assert.ok(a.pendant.length >= 3 && a.apres.length >= 1);
  assert.equal(R.actionsBesoins(e)[0].membres[0], 'A');
});

test('normalisation : sauvegarde abîmée', () => {
  const e = R.normaliser({ reglages: { jours: 500, alerteJours: 'x' }, membres: [{ profil: 'zzz', besoins: ['traitement', 'inventé'] }], animaux: [{ nombre: -2 }], stock: [{ articleId: 'eau', quantite: 'abc', peremption: '2026-13-01' }], faits: { e1: '2026-11-01', 'mauvais id!': '2026-11-01', e2: 'pas une date' }, articles: [{ id: 'eau', autonomie: 'eau', regle: 'personneJour', q: 3 }, { id: 'eau2', autonomie: 'eau', regle: 'personneJour', q: 2 }], plans: { evacuation: { rassemblement: 'Parc' }, inconnue: { rassemblement: 'x' } } });
  assert.equal(e.reglages.jours, 3);
  assert.equal(e.reglages.alerteJours, 60);
  assert.equal(e.membres[0].profil, 'adulte');
  assert.deepEqual(simple(e.membres[0].besoins), ['traitement']);
  assert.equal(e.animaux[0].nombre, 1);
  assert.equal(e.stock[0].quantite, 0);
  assert.equal(e.stock[0].peremption, null);
  assert.deepEqual(simple(e.faits), { e1: '2026-11-01' });
  assert.equal(e.articles[1].autonomie, null, 'un seul article d\'autonomie eau');
  assert.deepEqual(simple(Object.keys(e.plans)), ['evacuation']);
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('exports CSV : réserves et liste de courses', () => {
  const e = foyer({ stock: [{ articleId: 'eau', quantite: 12, peremption: '2027-01-01', emplacement: 'Cellier' }, { articleId: 'eau', quantite: 6, peremption: '2026-01-01' }] });
  const r = R.csvReserves(e, AUJ);
  const eau = r.filter((x) => x[1] === 'Eau potable en bouteilles');
  assert.equal(eau.length, 2);
  assert.deepEqual(simple(eau[0].slice(3, 11)), ['36', '12', '24', 33, '12', '2027-01-01', 'Cellier', 'non']);
  assert.equal(eau[1][10], 'oui');
  const c = R.csvCourses(e, AUJ);
  assert.equal(c[0][2], 'Quantité à acheter');
  assert.ok(c.some((x) => x[1] === 'Couches' && x[2] === '18'));
});
