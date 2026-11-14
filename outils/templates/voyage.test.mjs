// Tests des règles métier du planificateur de voyage (templates/voyage/regles.js et donnees.js).
// Les dépenses partagées reposent sur le moteur du budget commun (templates/budget-commun/regles.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = new URL('../../templates/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('voyage/donnees.js', racine), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('budget-commun/regles.js', racine), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('voyage/regles.js', racine), 'utf8'), ctx);
const R = ctx.window.VYG;
const BCM = ctx.window.BCM;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const egal = (a, b, m) => assert.deepEqual(simple(a), simple(b), m);
const somme = (o) => Object.values(o).reduce((s, c) => s + c, 0);

function etat(extra = {}) {
  const e = R.etatVide();
  e.voyage = { nom: 'Test', destination: 'Nulle part', debut: '2026-06-10', fin: '2026-06-14', note: '', modifLe: '' };
  e.voyageurs = ['a', 'b', 'c'].map((id) => R.normaliserVoyageur({ id, nom: id.toUpperCase() }));
  return Object.assign(e, extra);
}

test('le moteur des dépenses partagées est celui du budget commun', () => {
  const src = readFileSync(new URL('voyage/regles.js', racine), 'utf8');
  assert.match(src, /racine\.BCM/);
  const html = readFileSync(new URL('voyage/index.html', racine), 'utf8');
  const i = html.indexOf('budget-commun/regles.js'), j = html.indexOf('src="regles.js');
  assert.ok(i > 0 && j > i, 'budget-commun/regles.js chargé avant regles.js');
  const sw = readFileSync(new URL('voyage/sw.js', racine), 'utf8');
  assert.match(sw, /budget-commun\/regles\.js/, 'moteur commun gardé hors ligne');
  // Sans le moteur, les règles refusent de se charger.
  const vide = { window: {} };
  vm.createContext(vide);
  assert.throws(() => vm.runInContext(readFileSync(new URL('voyage/regles.js', racine), 'utf8'), vide));
});

test('base intégrée : postes, listes de bagages, documents et sources officielles', () => {
  assert.equal(new Set(BASE.postes.map((p) => p.id)).size, BASE.postes.length);
  egal(BASE.postes.filter((p) => p.auto).map((p) => p.auto).sort(), ['activites', 'nuits', 'transports']);
  assert.ok(BASE.postes.some((p) => p.id === 'divers'));
  assert.ok(BASE.bagages.find((l) => l.id === 'essentiels').items.length >= 10);
  assert.ok(BASE.bagages.length >= 8);
  assert.ok(BASE.documents.length >= 8);
  assert.ok(BASE.sources.length >= 3 && BASE.sources.every(([, u]) => /^https:\/\/www\.(diplomatie|service-public)\.(gouv\.)?fr\//.test(u)));
  assert.equal(BASE.sourcesVerifieesLe, '2026-11-14');
  // Aucune règle de formalité datée ou chiffrée, aucune plateforme ni marque.
  const textes = readFileSync(new URL('voyage/donnees.js', racine), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(textes, /\b\d+\s*(jours?|mois|ans)\b/i);
  const tout = textes + readFileSync(new URL('voyage/app.js', racine), 'utf8');
  assert.doesNotMatch(tout, /airbnb|booking\.com|expedia|tripadvisor|ryanair|easyjet|air france|sncf|blablacar|tricount|splitwise|abritel|hostelworld|getyourguide/i);
});

test('dates : jours et nuits du voyage, phase avant / pendant / après', () => {
  const v = { debut: '2026-06-10', fin: '2026-06-14' };
  assert.equal(R.nbJours(v), 5);
  assert.equal(R.nbNuits(v), 4);
  egal(simple(R.phase(v, '2026-06-01')), { etat: 'avant', joursAvant: 9 });
  egal(simple(R.phase(v, '2026-06-10')), { etat: 'pendant', jour: 1, total: 5 });
  egal(simple(R.phase(v, '2026-06-14')), { etat: 'pendant', jour: 5, total: 5 });
  egal(simple(R.phase(v, '2026-06-20')), { etat: 'apres', joursApres: 6 });
  assert.equal(R.phase({ debut: '', fin: '' }, '2026-06-01').etat, 'sansDates');
  // Passage à l'heure d'été : pas de jour perdu.
  assert.equal(R.ecart('2026-03-28', '2026-03-30'), 2);
  assert.equal(R.dates('2026-03-28', '2026-03-30').length, 3);
});

test('normalisation : dates inversées, montants, statuts et horaires invalides', () => {
  const h = R.normaliserNuit({ nom: 'X', arrivee: '2026-06-12', depart: '2026-06-10', montant: 30000, acompte: 50000, statut: 'n importe' });
  assert.equal(h.arrivee, '2026-06-10');
  assert.equal(h.depart, '2026-06-12');
  assert.equal(h.acompte, 30000, 'acompte plafonné au montant');
  assert.equal(h.statut, 'aReserver');
  assert.equal(R.normaliserNuit({ arrivee: '2026-06-12' }).depart, '2026-06-13', 'au moins une nuit');
  const t = R.normaliserTransport({ heure: '25:00', prix: -5, statut: 'reserve' });
  assert.equal(t.heure, '');
  assert.equal(t.prix, 0);
  assert.equal(R.normaliserActivite({}).statut, 'libre');
  const n = R.normaliser({ voyage: { debut: '2026-06-14', fin: '2026-06-10' }, depenses: [{ montant: 0 }], budget: { prevus: { repas: 10000, inconnu: 5 } } }, BASE.postes);
  assert.equal(n.voyage.debut, '2026-06-10');
  assert.equal(n.depenses.length, 0);
  egal(simple(n.budget.prevus), { repas: 10000 });
  egal(simple(R.normaliser(null)), simple(R.etatVide()));
});

test('montants : saisie tolérante, vide = 0, illisible ou négatif refusé', () => {
  assert.equal(R.lireMontant('1 234,56 €'), 123456);
  assert.equal(R.lireMontant(''), 0);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.saisieMontant(4550), '45,50');
  assert.equal(R.saisieMontant(0), '');
});

test('couverture des nuits : sans toit, à réserver, réservé, double', () => {
  const e = etat({
    nuits: [
      R.normaliserNuit({ id: 'h1', nom: 'A', arrivee: '2026-06-10', depart: '2026-06-12', statut: 'reserve' }),
      R.normaliserNuit({ id: 'h2', nom: 'B', arrivee: '2026-06-12', depart: '2026-06-13', statut: 'aReserver' }),
      R.normaliserNuit({ id: 'h3', nom: 'C', arrivee: '2026-06-12', depart: '2026-06-13', statut: 'reserve' }),
    ],
  });
  const c = R.couverture(e);
  egal(c.map((x) => x.statut), ['reserve', 'reserve', 'double', 'sans']);
  const r = R.resumeNuits(e);
  egal([r.total, r.reserve, r.aReserver, r.sans, r.double], [4, 2, 0, 1, 1]);
  // La nuit du dernier jour n'existe pas : on rentre.
  assert.ok(!c.some((x) => x.date === '2026-06-14'));
  e.nuits.push(R.normaliserNuit({ id: 'h4', nom: 'D', arrivee: '2026-06-14', depart: '2026-06-15' }));
  egal(R.horsVoyage(e).map((h) => h.id), ['h4']);
});

test('reste à payer : réservé, montant moins acompte, rien une fois soldé', () => {
  assert.equal(R.resteAPayer(R.normaliserNuit({ statut: 'reserve', montant: 30000, acompte: 9000 })), 21000);
  assert.equal(R.resteAPayer(R.normaliserNuit({ statut: 'reserve', montant: 30000, acompte: 9000, solde: true })), 0);
  assert.equal(R.resteAPayer(R.normaliserNuit({ statut: 'aReserver', montant: 30000 })), 0);
  const e = etat({ nuits: [R.normaliserNuit({ id: 'x', nom: 'X', arrivee: '2026-06-11', depart: '2026-06-12', statut: 'reserve', montant: 5000 })] });
  egal(simple(R.aPayer(e)), [{ id: 'x', nom: 'X', date: '2026-06-11', reste: 5000 }]);
});

test('étapes : lieu de chaque nuit, étapes du jour de transition, chevauchements', () => {
  const e = etat({
    etapes: [
      R.normaliserEtape({ id: 'e2', lieu: 'Deux', arrivee: '2026-06-12', depart: '2026-06-14' }),
      R.normaliserEtape({ id: 'e1', lieu: 'Un', arrivee: '2026-06-10', depart: '2026-06-12' }),
    ],
  });
  assert.equal(R.etapeDeLaNuit(e, '2026-06-11').id, 'e1');
  assert.equal(R.etapeDeLaNuit(e, '2026-06-12').id, 'e2');
  egal(R.etapesDuJour(e, '2026-06-12').map((x) => x.id), ['e1', 'e2']);
  egal(R.etapesChevauchantes(e), []);
  e.etapes.push(R.normaliserEtape({ id: 'e3', lieu: 'Trois', arrivee: '2026-06-11', depart: '2026-06-13' }));
  assert.equal(R.etapesChevauchantes(e).length, 2);
});

test('programme jour par jour : transports et activités triés par heure, sans heure en dernier', () => {
  const e = etat({
    transports: [R.normaliserTransport({ id: 't1', date: '2026-06-12', heure: '14:30', mode: 'train', de: 'Un', vers: 'Deux' })],
    activites: [
      R.normaliserActivite({ id: 'a1', date: '2026-06-12', titre: 'Sans heure' }),
      R.normaliserActivite({ id: 'a2', date: '2026-06-12', heure: '09:00', titre: 'Matin' }),
      R.normaliserActivite({ id: 'a3', date: '2026-06-20', titre: 'Hors voyage' }),
      R.normaliserActivite({ id: 'a4', titre: 'Sans date' }),
    ],
  });
  const p = R.programme(e);
  assert.equal(p.length, 5);
  assert.equal(p[2].numero, 3);
  egal(p[2].activites.map((a) => a.id), ['a2', 'a1']);
  egal(p[2].transports.map((t) => t.id), ['t1']);
  assert.ok(p[4].nuit.dernier);
  egal(R.horsProgramme(e).activites.map((a) => a.id), ['a3', 'a4']);
});

test('itinéraire : étapes et transports dans l\'ordre, texte à copier sans lien', () => {
  const e = etat({
    etapes: [R.normaliserEtape({ lieu: 'Turin', arrivee: '2026-06-10', depart: '2026-06-12' }), R.normaliserEtape({ lieu: 'Côme', arrivee: '2026-06-12', depart: '2026-06-14' })],
    transports: [
      R.normaliserTransport({ date: '2026-06-10', heure: '07:10', mode: 'train', de: 'Lyon', vers: 'Turin', statut: 'reserve' }),
      R.normaliserTransport({ date: '2026-06-12', mode: 'voiture', de: 'Turin', vers: 'Côme' }),
    ],
    nuits: [R.normaliserNuit({ nom: 'Chambre A', arrivee: '2026-06-10', depart: '2026-06-12', statut: 'reserve' })],
  });
  assert.equal(R.cheminTexte(e, BASE.modes), 'Lyon → (Train) → Turin · 2 nuits → (Voiture) → Côme · 2 nuits');
  const it = R.itineraire(e, BASE.modes);
  egal(it.map((x) => x.type), ['transport', 'etape', 'transport', 'etape']);
  assert.equal(it[1].hebergements.length, 1);
  const txt = R.itineraireTexte(e, BASE.modes);
  assert.match(txt, /Jour 1 · 2026-06-10 · Turin/);
  assert.match(txt, /07:10 Train Lyon → Turin · Réservé/);
  assert.match(txt, /Nuit : Chambre A \(réservé\)/);
  assert.match(txt, /Nuit : hébergement à trouver/);
  assert.doesNotMatch(txt, /https?:/);
});

test('à réserver : tout ce qui manque, trié par date, urgent à 14 jours', () => {
  const e = etat({
    nuits: [R.normaliserNuit({ id: 'h', nom: 'H', arrivee: '2026-06-12', statut: 'aReserver', montant: 100 })],
    transports: [R.normaliserTransport({ id: 't', date: '2026-06-10', de: 'A', vers: 'B', statut: 'aReserver' }), R.normaliserTransport({ id: 't2', date: '2026-06-10', statut: 'reserve' })],
    activites: [R.normaliserActivite({ id: 'a', titre: 'Musée', statut: 'aReserver' }), R.normaliserActivite({ id: 'l', titre: 'Balade' })],
  });
  const l = R.aReserver(e, '2026-05-29');
  egal(l.map((x) => x.id), ['t', 'h', 'a']);
  egal(l.map((x) => x.urgent), [true, true, false]);
  egal(R.aReserver(e, '2026-05-27').map((x) => x.urgent), [true, false, false]);
  assert.equal(l[0].joursAvant, 12);
});

test('budget : prévu = plan + saisi, réel = dépenses, engagé, par personne', () => {
  const e = etat({
    nuits: [R.normaliserNuit({ arrivee: '2026-06-10', depart: '2026-06-12', montant: 30000, statut: 'reserve' })],
    transports: [R.normaliserTransport({ prix: 12000, statut: 'reserve' }), R.normaliserTransport({ prix: 3000 })],
    activites: [R.normaliserActivite({ prix: 4500, statut: 'aReserver' })],
    budget: { prevus: { repas: 20000, transport: 1000 }, modifLe: '' },
  });
  e.depenses = [
    R.normaliserDepense({ montant: 30000, poste: 'hebergement', payeur: 'a' }, e.voyageurs, BASE.postes),
    R.normaliserDepense({ montant: 25000, poste: 'repas', payeur: 'b' }, e.voyageurs, BASE.postes),
    R.normaliserDepense({ montant: 1200, poste: 'achats', payeur: 'c' }, e.voyageurs, BASE.postes),
  ];
  const b = R.budget(e, BASE.postes);
  const l = (id) => b.lignes.find((x) => x.id === id);
  assert.equal(l('transport').prevu, 16000);
  assert.equal(l('hebergement').prevu, 30000);
  assert.equal(l('activites').prevu, 4500);
  assert.equal(l('repas').prevu, 20000);
  assert.ok(l('repas').depasse);
  assert.ok(l('achats').sansPrevu);
  assert.equal(b.prevu, 70500);
  assert.equal(b.reel, 56200);
  assert.equal(b.engage, 42000);
  assert.equal(b.parPersonnePrevu, 23500);
  assert.equal(b.parPersonneReel, 18733);
});

test('dépenses partagées : répartition au centime, soldes nuls, remboursements minimaux', () => {
  const e = etat();
  const dep = (montant, payeur, repartition) => R.normaliserDepense({ montant, payeur, poste: 'repas', repartition }, e.voyageurs, BASE.postes);
  e.depenses = [
    dep(10000, 'a'),
    dep(4500, 'b', { mode: 'parts', participants: ['a', 'b', 'c'], parts: { a: 2, b: 1, c: 0 } }),
    dep(1000, 'c', { mode: 'montants', participants: ['b', 'c'], montants: { b: 400, c: 600 } }),
    dep(1001, 'a', { mode: 'egale', participants: ['b', 'c'] }),
  ];
  for (const d of e.depenses) assert.equal(somme(d.quotes), d.montant);
  const s = R.soldes(e);
  assert.equal(somme(s), 0);
  // Même résultat que le budget commun lui-même.
  egal(simple(s), simple(BCM.soldes(e.voyageurs.map((v) => ({ id: v.id, revenu: null })), e.depenses, [])));
  const v = R.quiDoitQuoi(e);
  assert.ok(v.length <= 2);
  const apres = { ...s };
  for (const x of v) { apres[x.de] += x.montant; apres[x.a] -= x.montant; }
  assert.ok(Object.values(apres).every((x) => x === 0));
  // Un remboursement enregistré solde la dette.
  e.virements = v.map((x) => R.normaliserVirement({ ...x, date: '2026-06-15' }));
  egal(R.quiDoitQuoi(e), []);
  const pv = R.parVoyageur(e);
  assert.equal(pv.find((x) => x.id === 'a').paye, 11001);
  assert.equal(pv.reduce((s2, x) => s2 + x.part, 0), 16501);
  assert.ok(R.voyageurUtilise(e, 'a'));
});

test('mode prorata (budget commun) ramené à parts égales : aucun revenu dans un voyage', () => {
  const e = etat();
  const d = R.normaliserDepense({ montant: 900, payeur: 'a', repartition: { mode: 'prorata' } }, e.voyageurs, BASE.postes);
  assert.equal(d.repartition.mode, 'egale');
  egal(simple(d.quotes), { a: 300, b: 300, c: 300 });
});

test('dépense créée depuis le plan, liée à son élément', () => {
  const e = etat();
  const h = R.normaliserNuit({ id: 'h', nom: 'Gîte', arrivee: '2026-06-10', depart: '2026-06-12', montant: 24000 });
  const d = R.normaliserDepense(R.depenseDepuis('nuit', h, 'b', e.voyageurs), e.voyageurs, BASE.postes);
  assert.equal(d.poste, 'hebergement');
  assert.equal(d.lien, 'h');
  egal(simple(d.quotes), { a: 8000, b: 8000, c: 8000 });
  e.depenses.push(d);
  assert.equal(R.depenseLiee(e, 'h').id, d.id);
  const t = R.depenseDepuis('transport', R.normaliserTransport({ de: 'A', vers: 'B', prix: 500 }), 'a', e.voyageurs);
  assert.equal(t.poste, 'transport');
  assert.equal(t.libelle, 'A → B');
});

test('bagages : listes ajoutées sans doublon, progression ; documents de la base', () => {
  const b = R.genererBagages(BASE.bagages, [], ['essentiels', 'plage']);
  assert.ok(b.length > 15);
  const encore = R.genererBagages(BASE.bagages, b, ['essentiels', 'plage', 'ville']);
  assert.equal(encore.length, BASE.bagages.find((l) => l.id === 'ville').items.length);
  const dbl = R.genererBagages([{ id: 'x', items: ['Crème solaire'] }], b, ['x']);
  assert.equal(dbl.length, 0, 'même texte, déjà présent');
  b[0].fait = true; b[1].fait = true;
  egal(simple(R.progression(b.slice(0, 4))), { fait: 2, total: 4, pct: 50 });
  assert.equal(R.progression([]).pct, 0);
  assert.equal(R.genererDocuments(BASE.documents).length, BASE.documents.length);
});

test('archivage : résumé gardé, voyageurs et listes repris décochés', () => {
  const e = etat({ bagages: [R.normaliserCase({ texte: 'Tente', fait: true })] });
  e.depenses = [R.normaliserDepense({ montant: 5000, payeur: 'a', poste: 'repas' }, e.voyageurs, BASE.postes)];
  const n = R.archiver(e, BASE.postes, '2026-07-01T10:00:00Z');
  assert.equal(n.archives.length, 1);
  assert.equal(n.archives[0].reel, 5000);
  assert.equal(n.voyageurs.length, 3);
  assert.equal(n.depenses.length, 0);
  assert.equal(n.bagages[0].fait, false);
  assert.equal(n.voyage.debut, '');
});

test('fusion entre deux appareils : rien de perdu, le plus récent l\'emporte', () => {
  const base = etat();
  const a = simple(base), b = simple(base);
  a.activites = [{ id: 'x', titre: 'Musée', modifLe: '2026-06-01T10:00:00Z' }];
  b.activites = [{ id: 'y', titre: 'Plage', modifLe: '2026-06-01T09:00:00Z' }];
  a.voyage.nom = 'Ancien'; a.voyage.modifLe = '2026-06-01T08:00:00Z';
  b.voyage.nom = 'Nouveau'; b.voyage.modifLe = '2026-06-01T09:00:00Z';
  const r = R.fusionner(a, b);
  egal(r.etat.activites.map((x) => x.id).sort(), ['x', 'y']);
  assert.equal(r.etat.voyage.nom, 'Nouveau');
  // Suppression postérieure à la dernière modification : retirée.
  a.supprimes = { y: '2026-06-01T11:00:00Z' };
  egal(R.fusionner(a, b).etat.activites.map((x) => x.id), ['x']);
});

test('CSV des dépenses : parts par voyageur, séparateur point-virgule, BOM', () => {
  const e = etat();
  e.depenses = [R.normaliserDepense({ date: '2026-06-11', libelle: 'Dîner; "terrasse"', montant: 6000, payeur: 'a', poste: 'repas' }, e.voyageurs, BASE.postes)];
  const csv = R.versCsv(e, BASE.postes);
  assert.ok(csv.startsWith('﻿'));
  const [tete, ligne] = csv.slice(1).split('\r\n');
  assert.equal(tete, 'Date;Libellé;Poste;Montant;Payé par;Part A;Part B;Part C;Note');
  assert.equal(ligne, '2026-06-11;"Dîner; ""terrasse""";Repas et restaurants;60,00;A;20,00;20,00;20,00;');
});
