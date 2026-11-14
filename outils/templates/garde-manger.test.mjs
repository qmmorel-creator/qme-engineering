// Tests des règles métier du garde-manger (templates/garde-manger/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/garde-manger/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.GRD;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-14';

// Foyer type : réfrigérateur, congélateur, placard ; catégories de la base.
function etat(produits = [], extra = {}) {
  const e = R.etatVide(B, ['frigo', 'congel', 'placard']);
  e.produits = produits.map((p, i) => R.normaliserProduit({ id: `p${i + 1}`, lieu: 'frigo', categorie: 'laitier', quantite: 1, achat: '2026-11-10', ...p }));
  return { ...e, ...extra };
}
const prod = (e, i = 0) => e.produits[i];

test('base : lieux, catégories, couleurs et sources cohérents', () => {
  const codes = B.lieux.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const l of B.lieux) assert.ok(B.typesLieu[l.type], l.code);
  for (const c of B.categories) {
    assert.ok(['DLC', 'DDM', 'aucune'].includes(c.date), c.code);
    assert.ok(codes.includes(c.lieu), `${c.code} : lieu ${c.lieu}`);
    // Aucune durée chiffrée sans source.
    for (const k of ['sansDate', 'apresOuverture', 'congel']) if (c[k]) assert.ok(B.sources.some((s) => s.id === c.source), `${c.code}.${k} sans source`);
  }
  assert.ok(B.couleurs.length >= 8);
  for (const s of B.sources) {
    assert.ok(R.estDate(s.publiee) && R.estDate(s.consultee), s.id);
    assert.match(s.url, /^https:\/\/www\.anses\.fr\//);
  }
  assert.equal(B.dureeDecongele, 3);
  assert.ok(B.motifsJete.some(([k]) => k === 'perime'));
});

test('dates : ajout, écart, relatif, formats', () => {
  assert.equal(R.ajout('2026-11-14', 3), '2026-11-17');
  assert.equal(R.ajout('2026-12-30', 3), '2027-01-02');
  assert.equal(R.ecart('2026-11-14', '2026-11-10'), -4);
  assert.equal(R.relatif('2026-11-14', AUJ), 'aujourd\'hui');
  assert.equal(R.relatif('2026-11-15', AUJ), 'demain');
  assert.equal(R.relatif('2026-11-13', AUJ), 'hier');
  assert.equal(R.relatif('2026-11-19', AUJ), 'dans 5 jours');
  assert.equal(R.relatif('2026-11-11', AUJ), 'il y a 3 jours');
  assert.equal(R.dateCourte('2026-03-05'), '05/03/26');
  assert.equal(R.ajoutMois('2026-11-14', -10), '2026-01-01');
  assert.equal(R.estDate('2026-02-30'), false);
});

test('DLC : niveaux du dépassé au plus tard', () => {
  const cas = [['2026-11-13', 'perime'], ['2026-11-14', 'aujourdhui'], ['2026-11-15', 'trois'], ['2026-11-17', 'trois'], ['2026-11-18', 'semaine'], ['2026-11-21', 'semaine'], ['2026-11-22', 'ok']];
  for (const [date, attendu] of cas) {
    const e = etat([{ nom: 'Yaourts', typeDate: 'DLC', date }]);
    assert.equal(R.niveau(e, prod(e), AUJ, B), attendu, date);
  }
});

test('DDM dépassée : niveau « qualité », jamais « ne pas consommer »', () => {
  const e = etat([{ nom: 'Pâtes', typeDate: 'DDM', date: '2026-10-01', lieu: 'placard', categorie: 'feculents' }]);
  assert.equal(R.niveau(e, prod(e), AUJ, B), 'depasse');
  const m = R.messageAlerte(e, prod(e), AUJ, B);
  assert.match(m.texte, /DDM dépassée/);
  assert.doesNotMatch(m.texte, /ne pas consommer/);
  const d = etat([{ nom: 'Poulet', typeDate: 'DLC', date: '2026-11-12', categorie: 'viande' }]);
  assert.match(R.messageAlerte(d, prod(d), AUJ, B).texte, /DLC dépassée .* ne pas consommer/);
});

test('ouverture : le délai de l\'emballage l\'emporte s\'il est plus proche', () => {
  const e = etat([{ nom: 'Lait', typeDate: 'DDM', date: '2027-01-10', ouvertLe: '2026-11-12', joursOuverture: 3 }]);
  const ech = R.echeance(e, prod(e), B);
  assert.deepEqual(simple(ech), { source: '', date: '2026-11-15', nature: 'ouverture', indicative: false });
  assert.equal(R.niveau(e, prod(e), AUJ, B), 'trois');
  // Délai dépassé : sécurité.
  const p = etat([{ nom: 'Pesto', typeDate: 'DDM', date: '2027-02-01', ouvertLe: '2026-11-01', joursOuverture: 7 }]);
  assert.equal(R.niveau(p, prod(p), AUJ, B), 'perime');
  assert.match(R.messageAlerte(p, prod(p), AUJ, B).texte, /Délai après ouverture dépassé/);
  // DLC plus proche que le délai d'ouverture : la DLC reste.
  const d = etat([{ nom: 'Crème', typeDate: 'DLC', date: '2026-11-15', ouvertLe: '2026-11-14', joursOuverture: 5 }]);
  assert.equal(R.echeance(d, prod(d), B).nature, 'DLC');
  // Ouvert sans délai saisi ni durée de catégorie : la date de l'emballage seule.
  const s = etat([{ nom: 'Crème', typeDate: 'DLC', date: '2026-11-25', ouvertLe: '2026-11-13' }]);
  assert.equal(R.echeance(s, prod(s), B).nature, 'DLC');
  // Durée de la catégorie (valeur de l'utilisateur) : indicative.
  s.categories.find((c) => c.id === 'laitier').apresOuverture = 4;
  const ech2 = R.echeance(s, prod(s), B);
  assert.equal(ech2.date, '2026-11-17');
  assert.equal(ech2.indicative, true);
});

test('à égalité de date, l\'échéance de sécurité est retenue', () => {
  const e = etat([{ nom: 'Sauce', typeDate: 'DDM', date: '2026-11-16', ouvertLe: '2026-11-13', joursOuverture: 3 }]);
  assert.equal(R.echeance(e, prod(e), B).nature, 'ouverture');
});

test('sans date : durée sourcée du traiteur (Anses, 3 jours) depuis l\'achat, rien pour les autres', () => {
  const e = etat([
    { nom: 'Taboulé', typeDate: 'aucune', categorie: 'traiteur', achat: '2026-11-12' },
    { nom: 'Bananes', typeDate: 'aucune', categorie: 'fruits', achat: '2026-11-12' },
  ]);
  const t = R.echeance(e, prod(e, 0), B);
  assert.equal(t.date, '2026-11-15');
  assert.equal(t.nature, 'sansDate');
  assert.equal(t.source, 'anses-dlc');
  assert.equal(R.echeance(e, prod(e, 1), B), null);
  assert.equal(R.niveau(e, prod(e, 1), AUJ, B), 'sans');
  // La date de l'emballage est ignorée quand le type est « aucune ».
  const x = etat([{ nom: 'X', typeDate: 'aucune', date: '2026-11-01', categorie: 'fruits' }]);
  assert.equal(R.echeance(x, prod(x), B), null);
});

test('congélateur : DLC ignorée, DDM du surgelé et date fixée retenues', () => {
  const e = etat([
    { nom: 'Steaks', typeDate: 'DLC', date: '2026-10-01', lieu: 'congel', categorie: 'viande', congeleLe: '2026-09-30' },
    { nom: 'Steaks', typeDate: 'DLC', date: '2026-10-01', lieu: 'congel', categorie: 'viande', congeleLe: '2026-09-30', limiteCongel: '2026-11-20' },
    { nom: 'Petits pois', typeDate: 'DDM', date: '2026-11-10', lieu: 'congel', categorie: 'surgeles' },
  ]);
  assert.equal(R.echeance(e, prod(e, 0), B), null);
  assert.equal(R.niveau(e, prod(e, 0), AUJ, B), 'sans');
  assert.deepEqual(simple(R.echeance(e, prod(e, 1), B)), { source: '', date: '2026-11-20', nature: 'congel', indicative: false });
  assert.equal(R.niveau(e, prod(e, 1), AUJ, B), 'semaine');
  // Date de qualité : dépassée → « depasse », pas « perime ».
  assert.equal(R.niveau(e, prod(e, 2), AUJ, B), 'depasse');
  // Durée par catégorie saisie par l'utilisateur : depuis la date de congélation.
  e.categories.find((c) => c.id === 'viande').congel = 60;
  assert.equal(R.echeance(e, prod(e, 0), B).date, '2026-11-29');
  assert.equal(R.echeance(e, prod(e, 0), B).indicative, true);
});

test('décongelé : 3 jours (Anses), quel que soit l\'emballage', () => {
  const e = etat([{ nom: 'Cabillaud', typeDate: 'DLC', date: '2027-03-01', categorie: 'poisson', decongeleLe: '2026-11-13' }]);
  const ech = R.echeance(e, prod(e), B);
  assert.equal(ech.date, '2026-11-16');
  assert.equal(ech.nature, 'decongele');
  const v = etat([{ nom: 'Cabillaud', typeDate: 'aucune', categorie: 'poisson', decongeleLe: '2026-11-10' }]);
  assert.equal(R.niveau(v, prod(v), AUJ, B), 'perime');
  assert.match(R.messageAlerte(v, prod(v), AUJ, B).texte, /ne pas recongeler/);
});

test('priorités : groupes triés par date, plus tard et sans échéance exclus', () => {
  const e = etat([
    { nom: 'B', typeDate: 'DLC', date: '2026-11-16' },
    { nom: 'A', typeDate: 'DLC', date: '2026-11-15' },
    { nom: 'Périmé', typeDate: 'DLC', date: '2026-11-10' },
    { nom: 'Loin', typeDate: 'DLC', date: '2026-12-30' },
    { nom: 'Fruits', typeDate: 'aucune', categorie: 'fruits' },
    { nom: 'Farine', typeDate: 'DDM', date: '2026-10-01', lieu: 'placard' },
  ]);
  const g = R.priorites(e, AUJ, B);
  assert.deepEqual(simple(Object.fromEntries(Object.entries(g).map(([k, l]) => [k, l.map((p) => p.nom)]))), { perime: ['Périmé'], depasse: ['Farine'], aujourdhui: [], trois: ['A', 'B'], semaine: [] });
  const c = R.compteNiveaux(e, AUJ, B);
  assert.equal(c.ok, 1); assert.equal(c.sans, 1); assert.equal(c.trois, 2);
  assert.equal(R.compteNiveaux(e, AUJ, B, (p) => p.lieu === 'placard').depasse, 1);
  // Tri du stock : échéance d'abord, sans échéance à la fin.
  assert.deepEqual(simple(R.trierStock(e, e.produits, B).map((p) => p.nom)), ['Farine', 'Périmé', 'A', 'B', 'Loin', 'Fruits']);
});

test('recherche sans accents ni casse, dans le nom, la catégorie et la note', () => {
  const e = etat([{ nom: 'Crème fraîche' }, { nom: 'Pâtes', categorie: 'feculents' }, { nom: 'Jambon', note: 'pour les crêpes' }]);
  assert.deepEqual(simple(R.rechercher(e, e.produits, 'creme').map((p) => p.nom)), ['Crème fraîche']);
  assert.deepEqual(simple(R.rechercher(e, e.produits, 'RIZ').map((p) => p.nom)), ['Pâtes']);
  assert.deepEqual(simple(R.rechercher(e, e.produits, 'crepes').map((p) => p.nom)), ['Jambon']);
  assert.equal(R.rechercher(e, e.produits, '  ').length, 3);
});

test('sortie partielle : quantité et valeur réparties au prorata, état d\'origine intact', () => {
  const e = etat([{ nom: 'Yaourts', quantite: 4, unite: 'pot', valeur: 2, typeDate: 'DLC', date: '2026-11-20' }]);
  const r = R.sortir(e, 'p1', { type: 'jete', quantite: 1, motif: 'perime', date: AUJ });
  assert.equal(r.epuise, false);
  assert.equal(r.etat.produits[0].quantite, 3);
  assert.equal(r.etat.produits[0].valeur, 1.5);
  assert.equal(r.sortie.valeur, 0.5);
  assert.equal(r.sortie.motif, 'perime');
  assert.equal(r.etat.sorties.length, 1);
  assert.equal(e.produits[0].quantite, 4);
  assert.equal(e.sorties.length, 0);
});

test('sortie totale : produit retiré, motif vide pour un produit consommé, quantité bornée', () => {
  const e = etat([{ nom: 'Lait', quantite: 1, valeur: 1.15 }]);
  const r = R.sortir(e, 'p1', { type: 'consomme', quantite: 5, motif: 'abime', date: AUJ });
  assert.equal(r.epuise, true);
  assert.equal(r.etat.produits.length, 0);
  assert.equal(r.sortie.quantite, 1);
  assert.equal(r.sortie.motif, '');
  assert.equal(r.sortie.valeur, 1.15);
  // Quantité vide : tout sort. Type inconnu : refusé. Produit inconnu : rien.
  assert.equal(R.sortir(etat([{ nom: 'X', quantite: 2 }]), 'p1', { type: 'jete', date: AUJ }).sortie.quantite, 2);
  assert.throws(() => R.sortir(e, 'p1', { type: 'donne', date: AUJ }));
  assert.equal(R.sortir(e, 'zz', { type: 'jete', date: AUJ }).sortie, null);
  // Jeté sans motif : « autre ».
  assert.equal(R.sortir(etat([{ nom: 'X' }]), 'p1', { type: 'jete', date: AUJ }).sortie.motif, 'autre');
});

test('courses : ajout sans doublon, texte groupé, suggestions des produits épuisés', () => {
  let e = etat([{ nom: 'Œufs', categorie: 'oeufs' }]);
  let r = R.ajouterCourse(e, 'Pain', { categorie: 'epicerie', date: AUJ });
  assert.equal(r.ajoute, true); e = r.etat;
  assert.equal(R.ajouterCourse(e, ' pain ', {}).ajoute, false);
  assert.equal(R.ajouterCourse(e, '', {}).ajoute, false);
  e = R.ajouterCourse(e, 'Tomates', { categorie: 'fruits' }).etat;
  e = R.ajouterCourse(e, 'Sel', {}).etat;
  e.courses[0].fait = true;
  // Un article coché peut être réajouté.
  assert.equal(R.ajouterCourse(e, 'Pain', {}).ajoute, true);
  assert.equal(R.texteCourses(e), 'Fruits et légumes\n- Tomates\n\nDivers\n- Sel');
  assert.equal(R.texteCourses(etat()), '');
  e.sorties = [
    { id: 's1', date: '2026-11-12', type: 'consomme', produit: 'Beurre', categorie: 'laitier' },
    { id: 's2', date: '2026-11-13', type: 'consomme', produit: 'beurre', categorie: 'laitier' },
    { id: 's3', date: '2026-11-13', type: 'jete', produit: 'Fraises', categorie: 'fruits' },
    { id: 's4', date: '2026-09-01', type: 'consomme', produit: 'Café', categorie: 'epicerie' },
    { id: 's5', date: '2026-11-13', type: 'consomme', produit: 'Œufs', categorie: 'oeufs' },
    { id: 's6', date: '2026-11-13', type: 'consomme', produit: 'Tomates', categorie: 'fruits' },
  ];
  assert.deepEqual(simple(R.suggestionsCourses(e, AUJ)), [{ nom: 'beurre', categorie: 'laitier', date: '2026-11-13' }]);
});

test('bilan du gaspillage : nombres, part, valeur, motifs, catégories', () => {
  const e = etat([], {
    sorties: [
      { date: '2026-11-01', type: 'jete', produit: 'Salade', categorie: 'fruits', valeur: 1.5, motif: 'perime' },
      { date: '2026-11-02', type: 'jete', produit: 'Restes', categorie: 'restes', valeur: 0, motif: 'oublie' },
      { date: '2026-11-03', type: 'jete', produit: 'Fraises', categorie: 'fruits', valeur: 3.5, motif: 'abime' },
      { date: '2026-11-03', type: 'consomme', produit: 'Lait', categorie: 'laitier', valeur: 1 },
      { date: '2026-11-04', type: 'consomme', produit: 'Pain', categorie: 'epicerie' },
      { date: '2026-10-01', type: 'jete', produit: 'Vieux', categorie: 'fruits', valeur: 9, motif: 'perime' },
    ].map(R.normaliserSortie),
  });
  const b = R.bilan(e, '2026-11-01', AUJ);
  assert.equal(b.jetes, 3);
  assert.equal(b.consommes, 2);
  assert.equal(b.part, 0.6);
  assert.equal(b.valeurJetee, 5);
  assert.equal(b.jetesSansValeur, 1);
  assert.deepEqual(simple(b.parMotif), { perime: 1, oublie: 1, abime: 1 });
  assert.deepEqual(simple(b.parCategorie.fruits), { nombre: 2, valeur: 5 });
  const vide = R.bilan(e, '2027-01-01', '2027-01-31');
  assert.equal(vide.part, 0);
  // Série mensuelle : 6 mois, mois en cours compris.
  const s = R.serieMensuelle(e, AUJ, 6);
  assert.deepEqual(simple(s.map((m) => m.mois)), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(simple(s[5]), { mois: '2026-11', jetes: 3, consommes: 2, valeur: 5 });
  assert.deepEqual(simple(s[4]), { mois: '2026-10', jetes: 1, consommes: 0, valeur: 9 });
  assert.equal(R.debutPeriode('30', AUJ), '2026-10-16');
  assert.equal(R.debutPeriode('tout', AUJ), '0000-01-01');
});

test('normalisation : tolère les saisies incomplètes et les anciennes versions', () => {
  const e = R.normaliser({ produits: [{ nom: '  Lait  ', quantite: '1,5', typeDate: 'X', date: '2026-02-30', joursOuverture: '-2', valeur: 'abc' }], sorties: [{ produit: 'Sans date' }], lieux: [], categories: [] }, B);
  const p = e.produits[0];
  assert.equal(p.nom, 'Lait');
  assert.equal(p.quantite, 1.5);
  assert.equal(p.typeDate, 'DLC');
  assert.equal(p.date, '');
  assert.equal(p.joursOuverture, null);
  assert.equal(p.valeur, 0);
  assert.equal(e.sorties.length, 0);
  assert.equal(e.lieux.length, 3); // lieux par défaut
  assert.equal(e.categories.length, B.categories.length);
  assert.deepEqual(simple(R.normaliser(null, B).produits), []);
  const l = R.normaliserLieu({ nom: 'Cave', type: 'inconnu' });
  assert.equal(l.type, 'autre');
  // Lieux choisis au premier lancement.
  assert.deepEqual(simple(R.etatVide(B, ['frigo', 'cave']).lieux.map((x) => x.id)), ['frigo', 'cave']);
  // Catégorie du traiteur : durée sourcée conservée.
  const t = R.categoriesDepart(B).find((c) => c.id === 'traiteur');
  assert.equal(t.sansDate, 3); assert.equal(t.source, 'anses-dlc'); assert.equal(t.apresOuverture, null);
  assert.ok(R.taille(e) > 100);
});

test('validation d\'une saisie de produit', () => {
  const e = etat();
  const p = (x) => R.normaliserProduit({ nom: 'Lait', lieu: 'frigo', typeDate: 'DLC', date: '2026-11-20', ...x });
  assert.equal(R.validerProduit(e, { ...p(), nomSaisi: '  ' }), 'Donne un nom au produit.');
  assert.match(R.validerProduit(e, p({ lieu: 'zz' })), /lieu/);
  assert.match(R.validerProduit(e, p({ date: '' })), /date imprimée/);
  assert.equal(R.validerProduit(e, p({ typeDate: 'aucune', date: '' })), '');
  assert.match(R.validerProduit(e, p({ achat: '2026-11-10', ouvertLe: '2026-11-01' })), /ouverture/);
  assert.equal(R.validerProduit(e, p()), '');
});

test('CSV : stock et historique, séparateur point-virgule, BOM, guillemets', () => {
  const e = etat([{ nom: 'Pâtes; complètes', typeDate: 'DDM', date: '2027-01-01', lieu: 'placard', categorie: 'feculents', quantite: 2, unite: 'paquet', valeur: 2.4 }]);
  const c = R.csvStock(e, AUJ, B);
  assert.ok(c.startsWith('﻿Produit;Lieu;'));
  assert.match(c, /"Pâtes; complètes";Placard;Pâtes, riz, céréales;2;paquet;DDM;2027-01-01;;2027-01-01;DDM;Plus tard;2,4;/);
  const s = R.sortir(e, 'p1', { type: 'jete', quantite: 1, motif: 'trop', date: AUJ }).etat;
  assert.match(R.csvSorties(s, B.motifsJete), /2026-11-14;Jeté;"Pâtes; complètes";Pâtes, riz, céréales;Placard;1;paquet;Trop acheté, trop cuisiné;1,2/);
  assert.equal(R.purgerAvant(s, '2026-11-15').retirees, 1);
});
