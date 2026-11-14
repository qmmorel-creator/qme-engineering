// Tests des règles métier des demandes d'achat et fournitures (templates/achats/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/achats/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ACH;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-16';

const demande = (extra = {}) => R.normaliserDemande({ id: 'd1', numero: 'DA-2026-001', creeLe: '2026-11-02', par: 'Alex', service: 'S1', libelle: 'Ramette de papier A4 80 g', categorie: 'papier', unite: 'ramette', quantite: 10, prix: 5, fournisseur: 'F1', ...extra }, AUJ);
function etat(demandes = [], extra = {}) {
  const e = R.etatVide({ reglages: BASE.reglages });
  e.services = [R.normaliserService({ id: 'S1', nom: 'Administration', budgets: { 2026: 1000 } }), R.normaliserService({ id: 'S2', nom: 'Atelier' }, 1)];
  e.fournisseurs = [R.normaliserFournisseur({ id: 'F1', nom: 'Papeterie Exemple', delai: 5, minimum: 80 }), R.normaliserFournisseur({ id: 'F2', nom: 'Hygiène Exemple' }, 1)];
  e.articles = [R.normaliserArticle({ id: 'A1', nom: 'Ramette de papier A4 80 g', categorie: 'papier', unite: 'ramette', fournisseur: 'F1', reference: 'R-80', prix: 5 })];
  e.demandes = demandes;
  return Object.assign(e, extra);
}
const ok = (r) => { assert.equal(r.erreur, null); assert.equal(r.ok, true); return r.etat; };

test('base intégrée : catalogue sans prix ni marque, catégories, urgences, réglages, couleurs fixes', () => {
  assert.ok(BASE.articles.length >= 90, `${BASE.articles.length} articles`);
  const cats = new Set(BASE.categories.map((c) => c.id));
  for (const [c, nom, unite] of BASE.articles) {
    assert.ok(cats.has(c), `catégorie inconnue : ${c}`);
    assert.ok(nom.length > 3 && BASE.unites.includes(unite), `${nom} (${unite})`);
    assert.doesNotMatch(nom, /\d+[,.]?\d*\s?€/);
  }
  assert.equal(new Set(BASE.articles.map(([, n]) => n)).size, BASE.articles.length, 'articles en double');
  assert.deepEqual(simple(BASE.urgences.map((u) => u.id)), ['normale', 'urgente', 'bloquante']);
  assert.equal(BASE.couleurs.length, 8);
  assert.ok(BASE.couleurs.every((c) => /^#[0-9A-F]{6}$/i.test(c)));
  // Aucune marque de fournisseur, de matériel ou de logiciel d'achat dans la base et l'application.
  const textes = ['donnees.js', 'regles.js', 'app.js'].map((f) => readFileSync(new URL(f, dossier), 'utf8')).join('\n');
  assert.doesNotMatch(textes, /amazon|bureau vallee|lyreco|manutan|staples|office depot|nespresso|senseo|hp |canon|epson|brother|logitech|sap ariba|coupa/i);
});

test('exercice budgétaire : année civile ou décalée', () => {
  assert.equal(R.exercice('2026-11-16', 1), 2026);
  assert.equal(R.exercice('2026-08-31', 9), 2025);
  assert.equal(R.exercice('2026-09-01', 9), 2026);
  assert.deepEqual(simple(R.bornesExercice(2026, 9)), ['2026-09-01', '2027-09-01']);
  assert.equal(R.libelleExercice(2026, 1), '2026');
  assert.equal(R.libelleExercice(2026, 9), '2026-2027');
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
});

test('montants : euros, nombres saisis à la française', () => {
  assert.equal(R.euros(1234.5), '1 234,50 €');
  assert.equal(R.euros(12), '12 €');
  assert.equal(R.euros(null), '–');
  assert.equal(R.lireNombre('12,5'), 12.5);
  assert.equal(R.lireNombre(''), null);
  assert.ok(Number.isNaN(R.lireNombre('douze')));
});

test('état affiché d\'une demande : statut précisé par les réceptions', () => {
  assert.equal(R.etatDemande(demande()), 'demandee');
  const c = demande({ statut: 'commandee', commande: 'C1' });
  assert.equal(R.etatDemande(c), 'commandee');
  assert.equal(R.etatDemande({ ...c, receptions: [{ id: 'r', date: AUJ, qte: 4 }] }), 'partielle');
  assert.equal(R.etatDemande({ ...c, receptions: [{ id: 'r', date: AUJ, qte: 10 }] }), 'recue');
  assert.equal(R.etatDemande({ ...c, receptions: [{ id: 'r', date: AUJ, qte: 4 }], solde: true }), 'recue');
  assert.equal(R.etatDemande({ ...c, solde: true }), 'annulee');
  assert.equal(R.recu({ ...c, receptions: [{ qte: 7 }, { qte: 8 }] }), 10, 'plafonné à la quantité');
});

test('montants d\'une demande : consommé au prix réel, engagé sur le reste, en attente', () => {
  assert.deepEqual(simple(R.montants(demande())), { etat: 'demandee', consomme: 0, engage: 0, attente: 50, sansPrix: false });
  assert.equal(R.montants(demande({ statut: 'validee' })).engage, 50);
  const p = demande({ statut: 'commandee', commande: 'C1', receptions: [{ id: 'r', date: AUJ, qte: 4 }], prixReel: 6 });
  assert.deepEqual(simple(R.montants(p)), { etat: 'partielle', consomme: 24, engage: 36, attente: 0, sansPrix: false });
  assert.equal(R.montants({ ...p, solde: true }).engage, 0, 'reliquat abandonné : plus engagé');
  assert.equal(R.montants(demande({ prix: null })).sansPrix, true);
  assert.equal(R.montants(demande({ prix: null, statut: 'refusee' })).sansPrix, false);
  assert.equal(R.montantEstime(demande({ quantite: 3, prix: 2.35 })), 7.05);
});

test('budget par service : consommé, engagé, en attente, disponible, niveau', () => {
  const e = etat([
    demande({ id: 'a', statut: 'commandee', commande: 'C1', receptions: [{ id: 'r', date: AUJ, qte: 10 }], prix: 30 }), // 300 consommé
    demande({ id: 'b', statut: 'validee', prix: 50 }), // 500 engagé
    demande({ id: 'c', prix: 10 }), // 100 en attente
    demande({ id: 'd', statut: 'refusee', prix: 99 }),
    demande({ id: 'e', creeLe: '2025-12-20', statut: 'validee' }), // autre exercice
    demande({ id: 'f', service: 'S2', statut: 'validee' }),
  ]);
  const b = R.budgetService(e, 'S1', 2026);
  assert.equal(b.consomme, 300); assert.equal(b.engage, 500); assert.equal(b.attente, 100);
  assert.equal(b.disponible, 200); assert.equal(Math.round(b.taux), 80); assert.equal(b.niveau, 'ok'); assert.equal(b.nb, 3);
  const sans = R.budgetService(e, 'S2', 2026);
  assert.equal(sans.budget, null); assert.equal(sans.disponible, null); assert.equal(sans.niveau, 'sans'); assert.equal(sans.engage, 50);
  e.services[0].budgets['2026'] = 750;
  assert.equal(R.budgetService(e, 'S1', 2026).niveau, 'depasse');
  e.reglages.debutExercice = 9; // exercice 2026-2027 : à partir du 1er septembre 2026
  assert.equal(R.budgetService(e, 'S1', 2025).engage, 50, 'la demande de décembre 2025 tombe sur l\'exercice 2025-2026');
});

test('validation automatique : seuil, prix estimé, budget suffisant', () => {
  const e = etat();
  assert.equal(R.validationAuto(e, demande({ quantite: 2 })).auto, true); // 10 €
  assert.equal(R.validationAuto(e, demande({ quantite: 30 })).auto, false); // 150 € > 100 €
  assert.match(R.validationAuto(e, demande({ prix: null })).raison, /Prix non estimé/);
  e.reglages.seuil = null;
  assert.equal(R.validationAuto(e, demande({ quantite: 1 })).auto, false);
  e.reglages.seuil = 100;
  e.demandes = [demande({ id: 'x', statut: 'validee', quantite: 1, prix: 995 })]; // disponible 5 €
  const v = R.validationAuto(e, demande({ id: 'y', quantite: 2 }));
  assert.equal(v.auto, false); assert.match(v.raison, /budget du service serait dépassé/);
  const eff = R.effetBudget(e, demande({ id: 'y', quantite: 2 }));
  assert.equal(eff.disponibleApres, -5); assert.equal(eff.depasse, true);
});

test('numéros : suivant de l\'année, sans réutiliser un trou', () => {
  const l = [{ numero: 'DA-2026-001' }, { numero: 'DA-2026-007' }, { numero: 'DA-2025-040' }, { numero: 'BC-2026-099' }];
  assert.equal(R.numeroSuivant(l, 'DA', 2026), 'DA-2026-008');
  assert.equal(R.numeroSuivant(l, 'DA', 2027), 'DA-2027-001');
  assert.equal(R.numeroSuivant(l, 'BC', 2026), 'BC-2026-100');
});

test('circuit : demandée → validée ou refusée → commandée → reçue, partielle possible', () => {
  let e = etat();
  e = ok(R.appliquer(e, { type: 'creer', demandes: [demande({ numero: '' }), demande({ id: 'd2', numero: '', quantite: 3 })] }));
  assert.deepEqual(simple(e.demandes.map((d) => d.numero)), ['DA-2026-001', 'DA-2026-002']);
  const refus = R.appliquer(e, { type: 'refuser', id: 'd2', par: 'Camille', le: AUJ, motif: '' });
  assert.equal(refus.ok, false); assert.match(refus.erreur, /motif/);
  e = ok(R.appliquer(e, { type: 'refuser', id: 'd2', par: 'Camille', le: AUJ, motif: 'Doublon' }));
  e = ok(R.appliquer(e, { type: 'valider', id: 'd1', par: 'Camille', le: AUJ }));
  assert.equal(R.appliquer(e, { type: 'valider', id: 'd1', par: 'Sam', le: AUJ }).ok, false, 'pas deux validations');
  // Modification : le fond est figé une fois validée ; prix et fournisseur restent modifiables.
  assert.equal(R.appliquer(e, { type: 'modifier', id: 'd1', champs: { quantite: 50 } }).ok, false);
  e = ok(R.appliquer(e, { type: 'modifier', id: 'd1', champs: { prix: 4.5, quantite: 10 } }));
  // Commande
  const cmd = { id: 'C1', numero: '', fournisseur: 'F1', date: AUJ, par: 'Camille', demandes: ['d1', 'd2'] };
  const rc = R.appliquer(e, { type: 'commander', commande: cmd });
  e = ok(rc);
  assert.equal(rc.info.numero, 'BC-2026-001');
  assert.equal(rc.info.ecartees.length, 1, 'la demande refusée est écartée du bon');
  assert.deepEqual(simple(e.commandes[0].demandes), ['d1']);
  assert.equal(R.etatDemande(e.demandes[0]), 'commandee');
  assert.equal(R.appliquer(e, { type: 'annuler', id: 'd1', le: AUJ }).ok, false, 'commandée : on solde, on n\'annule plus');
  assert.equal(R.appliquer(e, { type: 'supprimer', id: 'd1' }).ok, false);
  // Réceptions
  e = ok(R.appliquer(e, { type: 'recevoir', id: 'd1', reception: { id: 'r1', date: AUJ, qte: 4, par: 'Nour' }, prixReel: 4.8 }));
  assert.equal(R.etatDemande(e.demandes[0]), 'partielle');
  const deux = R.appliquer(e, { type: 'recevoir', id: 'd1', reception: { id: 'r1', date: AUJ, qte: 4, par: 'Nour' } });
  assert.equal(deux.info.deja, true, 'réception rejouée deux fois : comptée une fois');
  const r2 = R.appliquer(e, { type: 'recevoir', id: 'd1', reception: { id: 'r2', date: AUJ, qte: 99, par: 'Nour' } });
  e = ok(r2);
  assert.equal(r2.info.qte, 6, 'plafonnée au reste'); assert.equal(r2.info.complete, true);
  assert.equal(R.etatDemande(e.demandes[0]), 'recue');
  assert.equal(R.montants(e.demandes[0]).consomme, 48);
  assert.equal(R.etatCommande(e, e.commandes[0], AUJ).statut, 'recue');
});

test('solder un reliquat, annuler, rouvrir, supprimer', () => {
  let e = etat([demande({ statut: 'commandee', commande: 'C1', receptions: [{ id: 'r', date: AUJ, qte: 3 }] }), demande({ id: 'd2', numero: 'DA-2026-002', statut: 'refusee', motifRefus: 'Doublon' }), demande({ id: 'd3', numero: 'DA-2026-003' })]);
  e.commandes = [R.normaliserCommande({ id: 'C1', numero: 'BC-2026-001', fournisseur: 'F1', date: '2026-11-05', demandes: ['d1'] }, AUJ)];
  e = ok(R.appliquer(e, { type: 'solder', id: 'd1', le: AUJ }));
  assert.equal(R.etatDemande(e.demandes[0]), 'recue');
  e = ok(R.appliquer(e, { type: 'reouvrir', id: 'd2' }));
  assert.equal(e.demandes[1].statut, 'demandee'); assert.equal(e.demandes[1].motifRefus, '');
  e = ok(R.appliquer(e, { type: 'annuler', id: 'd3', le: AUJ }));
  assert.equal(e.demandes[2].statut, 'annulee');
  e = ok(R.appliquer(e, { type: 'supprimer', id: 'd3' }));
  assert.equal(e.demandes.length, 2);
  assert.equal(R.appliquer(e, { type: 'supprimer', id: 'd3' }).ok, true, 'déjà supprimée : sans effet');
});

test('catalogue, fournisseurs, services : ajout, retrait refusé si des demandes y sont rattachées', () => {
  let e = etat([demande()]);
  e = ok(R.appliquer(e, { type: 'maj', coll: 'fournisseurs', obj: R.normaliserFournisseur({ id: 'F3', nom: 'Info Exemple' }) }));
  assert.equal(e.fournisseurs.length, 3);
  e = ok(R.appliquer(e, { type: 'maj', coll: 'fournisseurs', obj: { ...e.fournisseurs[2], nom: 'Info Express Exemple' } }));
  assert.equal(e.fournisseurs[2].nom, 'Info Express Exemple');
  assert.equal(R.appliquer(e, { type: 'retirer', coll: 'fournisseurs', id: 'F1' }).ok, false);
  assert.equal(R.appliquer(e, { type: 'retirer', coll: 'services', id: 'S1' }).ok, false);
  e = ok(R.appliquer(e, { type: 'retirer', coll: 'fournisseurs', id: 'F2' }));
  assert.equal(e.fournisseurs.length, 2);
  e = ok(R.appliquer(e, { type: 'reglages', valeur: { organisation: 'Atelier Exemple', reglages: { seuil: null } } }));
  assert.equal(e.reglages.seuil, null); assert.equal(e.reglages.debutExercice, 1);
  const cat = R.catalogueDeBase(BASE, ['cuisine']);
  assert.ok(cat.length >= 10 && cat.every((a) => a.categorie === 'cuisine' && a.prix === null));
});

test('à commander : regroupement par fournisseur, lignes fusionnées, minimum de commande', () => {
  const e = etat([
    demande({ id: 'a', statut: 'validee', article: 'A1', fournisseur: null, quantite: 4, service: 'S1' }),
    demande({ id: 'b', statut: 'validee', article: 'A1', fournisseur: null, quantite: 6, service: 'S2', urgence: 'urgente' }),
    demande({ id: 'c', statut: 'validee', libelle: 'Savon pour les mains (recharge)', unite: 'flacon', fournisseur: 'F2', prix: null, quantite: 2 }),
    demande({ id: 'd', statut: 'validee', libelle: 'Câble HDMI', unite: 'pièce', fournisseur: null, prix: 8, quantite: 1 }),
    demande({ id: 'e', statut: 'demandee' }),
  ]);
  const g = R.aCommander(e);
  assert.deepEqual(simple(g.map((x) => x.fournisseur)), ['F1', 'F2', null]);
  const f1 = g[0];
  assert.equal(f1.lignes.length, 1);
  assert.equal(f1.lignes[0].quantite, 10); assert.equal(f1.lignes[0].reference, 'R-80');
  assert.deepEqual(simple(f1.lignes[0].services), ['S1', 'S2']);
  assert.equal(f1.lignes[0].urgence, 'urgente');
  assert.equal(f1.total, 50); assert.equal(f1.sousMinimum, 30, 'minimum de 80 € chez ce fournisseur');
  assert.equal(g[1].sansPrix, 1);
  assert.equal(g[2].fournisseur, null, 'fournisseur à choisir en dernier');
});

test('bon de commande : retard de livraison selon le délai du fournisseur', () => {
  const e = etat([demande({ statut: 'commandee', commande: 'C1' })]);
  e.commandes = [R.normaliserCommande({ id: 'C1', numero: 'BC-2026-001', fournisseur: 'F1', date: '2026-11-05', demandes: ['d1'] }, AUJ)];
  const c = R.etatCommande(e, e.commandes[0], AUJ);
  assert.equal(c.statut, 'commandee'); assert.equal(c.attendue, '2026-11-10'); assert.equal(c.retard, 6); assert.equal(c.total, 50);
});

test('synchronisation : actions locales rejouées sur la version du serveur (conflit 409)', () => {
  // Le serveur a reçu entre-temps : d1 validée par Camille, une nouvelle demande DA-2026-002 d'un autre appareil.
  const base = etat([demande(), demande({ id: 'd3', numero: 'DA-2026-002' })]);
  const serveur = ok(R.appliquer(base, { type: 'valider', id: 'd1', par: 'Camille', le: AUJ }));
  serveur.demandes.push(demande({ id: 'dX', numero: 'DA-2026-003' }));
  // Cet appareil, hors ligne : refuse d1 (déjà validée ailleurs), crée une demande numérotée DA-2026-003,
  // valide d3, ajoute un fournisseur.
  const ops = [
    { type: 'refuser', id: 'd1', par: 'Sam', le: AUJ, motif: 'Doublon' },
    { type: 'creer', demandes: [demande({ id: 'dL', numero: 'DA-2026-003', quantite: 1 })] },
    { type: 'valider', id: 'd3', par: 'Sam', le: AUJ },
    { type: 'maj', coll: 'fournisseurs', obj: R.normaliserFournisseur({ id: 'F9', nom: 'Café Exemple' }) },
  ];
  const r = R.rejouer(serveur, ops);
  assert.equal(r.refusees.length, 1);
  assert.match(r.refusees[0].erreur, /déjà à commander \(Camille\)/);
  assert.equal(r.etat.demandes.find((d) => d.id === 'd1').statut, 'validee', 'la validation du serveur est gardée');
  assert.equal(r.etat.demandes.find((d) => d.id === 'dL').numero, 'DA-2026-004', 'renumérotée');
  assert.equal(r.etat.demandes.find((d) => d.id === 'd3').statut, 'validee');
  assert.ok(r.etat.fournisseurs.some((f) => f.id === 'F9'));
  assert.equal(serveur.demandes.length, 3, 'l\'entrée n\'est pas modifiée');
  // Deux appareils commandent la même demande : le second bon est refusé.
  const s2 = ok(R.appliquer(etat([demande({ statut: 'validee' })]), { type: 'commander', commande: { id: 'C1', fournisseur: 'F1', date: AUJ, demandes: ['d1'] } }));
  const r2 = R.rejouer(s2, [{ type: 'commander', commande: { id: 'C2', fournisseur: 'F1', date: AUJ, demandes: ['d1'] } }]);
  assert.equal(r2.refusees.length, 1); assert.equal(r2.etat.commandes.length, 1);
  // Réception saisie hors ligne alors qu'un autre appareil a soldé la demande : refusée.
  const s3 = ok(R.appliquer(s2, { type: 'solder', id: 'd1', le: AUJ }));
  assert.equal(R.rejouer(s3, [{ type: 'recevoir', id: 'd1', reception: { id: 'rr', date: AUJ, qte: 2 } }]).refusees.length, 1);
});

test('statistiques : états, délais moyens, taux de refus, consommé par mois, articles les plus demandés', () => {
  const e = etat([
    demande({ id: 'a', creeLe: '2026-10-01', statut: 'commandee', commande: 'C1', valideLe: '2026-10-03', validePar: 'C', receptions: [{ id: 'r', date: '2026-10-10', qte: 10 }] }),
    demande({ id: 'b', creeLe: '2026-10-05', statut: 'refusee', valideLe: '2026-10-06', validePar: 'C', motifRefus: 'Doublon' }),
    demande({ id: 'c', creeLe: '2026-11-02', statut: 'validee', valideLe: '2026-11-02', auto: true }),
    demande({ id: 'd', creeLe: '2026-11-03', urgence: 'urgente' }),
  ]);
  e.commandes = [R.normaliserCommande({ id: 'C1', fournisseur: 'F1', date: '2026-10-04', demandes: ['a'] }, AUJ)];
  const s = R.statistiques(e, '2026-10-01', '2026-12-01');
  assert.equal(s.nb, 4);
  assert.equal(s.parEtat.recue, 1); assert.equal(s.parEtat.refusee, 1); assert.equal(s.parEtat.validee, 1); assert.equal(s.parEtat.demandee, 1);
  assert.equal(s.delaiValidation, 1.5); assert.equal(s.delaiCommande, 1); assert.equal(s.delaiReception, 6);
  assert.equal(Math.round(s.tauxRefus), 33); assert.equal(s.auto, 1); assert.equal(s.urgentes, 1);
  assert.deepEqual(simple(s.mois), [{ mois: '2026-10', consomme: 50 }, { mois: '2026-11', consomme: 0 }]);
  assert.equal(s.topArticles[0].nb, 3);
});

test('à valider : urgentes d\'abord, relance après le délai réglé', () => {
  const e = etat([demande({ id: 'a', creeLe: '2026-11-10' }), demande({ id: 'b', creeLe: '2026-11-15', urgence: 'bloquante' }), demande({ id: 'c', statut: 'validee' })]);
  const l = R.aValider(e, AUJ);
  assert.deepEqual(simple(l.map((x) => x.d.id)), ['b', 'a']);
  assert.equal(l[1].attente, 6); assert.equal(l[1].relance, true); assert.equal(l[0].relance, false);
});

test('normalisation tolérante, RGPD, export CSV', () => {
  const n = R.normaliser({ demandes: [{ quantite: '2,5', prix: 'abc', urgence: 'xx', statut: '??' }], services: [{ budgets: { 2026: '1500', toto: 3 } }], reglages: { seuil: '', debutExercice: 13 } }, AUJ);
  assert.equal(n.demandes[0].quantite, 2.5); assert.equal(n.demandes[0].prix, null);
  assert.equal(n.demandes[0].urgence, 'normale'); assert.equal(n.demandes[0].statut, 'demandee');
  assert.deepEqual(simple(n.services[0].budgets), { 2026: 1500 });
  assert.equal(n.reglages.seuil, null); assert.equal(n.reglages.debutExercice, 12);
  assert.equal(R.normaliser(null, AUJ).demandes.length, 0);
  const e = etat([demande({ id: 'a', creeLe: '2026-01-10', statut: 'refusee', validePar: 'Camille' }), demande({ id: 'b', creeLe: '2026-01-10' }), demande({ id: 'c', creeLe: '2026-10-10', statut: 'refusee' })]);
  const { etat: an, n: nb } = R.anonymiser(e, '2026-06-01');
  assert.equal(nb, 1, 'seules les demandes terminées et anciennes');
  assert.equal(an.demandes[0].par, ''); assert.equal(an.demandes[0].validePar, ''); assert.equal(an.demandes[1].par, 'Alex');
  const csv = R.versCsv(etat([demande({ motif: 'Réunion; client' })]));
  assert.ok(csv.startsWith('﻿'));
  const lignes = csv.slice(1).split('\r\n');
  assert.equal(lignes.length, 2);
  assert.match(lignes[1], /^DA-2026-001;2026-11-02;Alex;Administration;Ramette de papier A4 80 g;papier;10;ramette;5;50;normale;"Réunion; client";À valider;/);
});
