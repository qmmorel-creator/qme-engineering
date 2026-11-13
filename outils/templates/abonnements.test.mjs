// Tests des règles métier du suivi des abonnements (templates/abonnements/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/abonnements/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ABN;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const abo = (extra = {}) => R.normaliserAbonnement({ id: 'x', nom: 'Test', cat: 'video', montant: 1000, periodicite: 'mensuel', debut: '2026-01-15', ...extra }, AUJ);

test('montants : lecture tolérante et affichage', () => {
  assert.equal(R.lireMontant('12,99'), 1299);
  assert.equal(R.lireMontant('12.99 €'), 1299);
  assert.equal(R.lireMontant(' 1 234,5 '), 123450);
  assert.equal(R.lireMontant('9'), 900);
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('-3'), null);
  assert.equal(R.lireMontant('12,999'), null);
  assert.equal(R.lireMontant('abc'), null);
  assert.equal(R.euros(1299), '12,99 €');
  assert.equal(R.euros(120000), '1 200,00 €');
  assert.equal(R.euros(120049, { centimes: false }), '1 200 €');
  assert.equal(R.euros(-500), '−5,00 €');
  assert.equal(R.euros(null), '–');
  assert.equal(R.saisieMontant(1205), '12,05');
});

test('dates : ajout de mois avec jour d\'ancrage et fins de mois', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(R.ajoutMois('2026-01-31', 2, 31), '2026-03-31');
  assert.equal(R.ajoutMois('2028-01-31', 1, 31), '2028-02-29'); // année bissextile
  assert.equal(R.ajoutMois('2026-11-15', 2), '2027-01-15');
  assert.equal(R.ajoutMois('2026-03-15', -3), '2025-12-15');
  assert.equal(R.ajoutMoisCle('2026-12', 1), '2027-01');
  assert.equal(R.joursDansMois(2026, 2), 28);
  assert.ok(R.estDate('2026-02-28'));
  assert.ok(!R.estDate('2026-02-30'));
});

test('coûts : périodicités, part payée, équivalent mensuel', () => {
  assert.equal(R.coutAnnuel(abo()), 12000);
  assert.equal(R.coutMensuel(abo()), 1000);
  assert.equal(R.coutAnnuel(abo({ periodicite: 'hebdo', montant: 1500 })), 78000);
  assert.equal(R.coutMensuel(abo({ periodicite: 'hebdo', montant: 1500 })), 6500);
  assert.equal(R.coutAnnuel(abo({ periodicite: 'trimestriel', montant: 3000 })), 12000);
  assert.equal(R.coutMensuel(abo({ periodicite: 'annuel', montant: 9999 })), 833);
  // Partage à parts égales, ou part saisie (jamais plus que le montant).
  assert.equal(R.maPart(abo({ montant: 1799, parts: 4 })), 450);
  assert.equal(R.maPart(abo({ montant: 1799, parts: 4, maPart: 600 })), 600);
  assert.equal(R.maPart(abo({ montant: 1000, maPart: 5000 })), 1000);
  assert.ok(R.estPartage(abo({ parts: 2 })));
  assert.ok(!R.estPartage(abo()));
  // Prix à compléter : aucun coût.
  assert.equal(R.coutAnnuel(abo({ montant: null })), null);
});

test('prélèvements : prochain, liste entre deux dates, fins de mois', () => {
  const a = abo({ debut: '2026-01-31' });
  assert.equal(R.prochainPrelevement(a, '2026-02-01'), '2026-02-28');
  assert.equal(R.prochainPrelevement(a, '2026-03-01'), '2026-03-31');
  assert.equal(R.prochainPrelevement(a, '2026-03-31'), '2026-03-31');
  assert.deepEqual(simple(R.echeancesEntre(a, '2026-01-01', '2026-04-30')), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  // Premier prélèvement dans le futur : rien avant.
  const futur = abo({ debut: '2026-12-05' });
  assert.equal(R.prochainPrelevement(futur, AUJ), '2026-12-05');
  assert.deepEqual(simple(R.echeancesEntre(futur, '2026-11-01', '2026-11-30')), []);
  // Hebdomadaire.
  const h = abo({ periodicite: 'hebdo', debut: '2026-11-02' });
  assert.deepEqual(simple(R.echeancesEntre(h, '2026-11-01', '2026-11-30')), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(R.prochainPrelevement(h, AUJ), '2026-11-16');
  // Annuel.
  const an = abo({ periodicite: 'annuel', debut: '2024-02-29' });
  assert.equal(R.prochainPrelevement(an, AUJ), '2027-02-28');
  assert.equal(R.prochainPrelevement(an, '2027-03-01'), '2028-02-29');
});

test('résiliation : plus de prélèvement à partir de la date d\'effet', () => {
  const a = abo({ statut: 'resilie', resilieLe: '2026-12-01', debut: '2026-01-10' });
  assert.equal(R.prochainPrelevement(a, AUJ), null);
  assert.equal(R.prochainPrelevement(a, '2026-11-01'), '2026-11-10');
  assert.deepEqual(simple(R.echeancesEntre(a, '2026-10-01', '2027-01-31')), ['2026-10-10', '2026-11-10']);
  const sansDate = abo({ statut: 'resilie' });
  assert.equal(R.prochainPrelevement(sansDate, '2020-01-01'), null);
  // « À résilier » : on paie encore.
  assert.equal(R.prochainPrelevement(abo({ statut: 'aResilier' }), AUJ), '2026-11-15');
});

test('décisions : essai, engagement avec préavis, renouvellement annuel', () => {
  const essai = abo({ essaiFin: '2026-11-17', debut: '2026-11-17' });
  assert.deepEqual(simple(R.decisions(essai, AUJ)).map((d) => [d.type, d.limite, d.niveau]), [['essai', '2026-11-17', 'proche']]);
  const engage = abo({ engagementFin: '2026-12-20', preavisJours: 30 });
  const d = R.decisions(engage, AUJ)[0];
  assert.equal(d.type, 'engagement');
  assert.equal(d.limite, '2026-11-20');
  assert.equal(d.joursRestants, 7);
  // Préavis déjà dépassé : la fin d'engagement est à venir mais il est trop tard.
  assert.equal(R.decisions(abo({ engagementFin: '2026-11-25', preavisJours: 30 }), AUJ)[0].niveau, 'depasse');
  // Loin : plus tard.
  assert.equal(R.decisions(abo({ engagementFin: '2027-06-30' }), AUJ)[0].niveau, 'plus-tard');
  // Annuel sans engagement : renouvellement au prochain prélèvement moins le préavis.
  const an = abo({ periodicite: 'annuel', debut: '2025-12-28', preavisJours: 30 });
  const r = R.decisions(an, AUJ);
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'renouvellement');
  assert.equal(r[0].date, '2026-12-28');
  assert.equal(r[0].limite, '2026-11-28');
  assert.equal(r[0].niveau, 'proche');
  // Mensuel sans dates : rien à décider ; résilié : rien non plus ; seuil d'alerte réglable.
  assert.equal(R.decisions(abo(), AUJ).length, 0);
  assert.equal(R.decisions(abo({ statut: 'resilie', engagementFin: '2026-12-01' }), AUJ).length, 0);
  assert.equal(R.decisions(engage, AUJ, 5)[0].niveau, 'plus-tard');
  // Engagement passé : ignoré.
  assert.equal(R.decisions(abo({ engagementFin: '2026-01-01' }), AUJ).length, 0);
});

test('à décider : toutes les décisions triées par date limite', () => {
  const abos = [abo({ id: 'a', nom: 'B', engagementFin: '2026-12-20', preavisJours: 30 }), abo({ id: 'b', nom: 'A', essaiFin: '2026-11-17', debut: '2026-11-17' })];
  assert.deepEqual(simple(R.aDecider(abos, AUJ)).map((d) => d.id), ['b', 'a']);
});

test('totaux : par catégorie, résiliés exclus, prix à compléter comptés à part', () => {
  const abos = [
    abo({ id: '1', cat: 'video', montant: 1000 }),
    abo({ id: '2', cat: 'video', montant: 600, parts: 2 }),
    abo({ id: '3', cat: 'audio', montant: 12000, periodicite: 'annuel', statut: 'aResilier' }),
    abo({ id: '4', cat: 'audio', montant: 999, statut: 'resilie', resilieLe: '2026-10-01' }),
    abo({ id: '5', cat: 'jeux', montant: null }),
  ];
  const t = R.totaux(abos);
  assert.equal(t.annuel, 12000 + 3600 + 12000);
  assert.equal(t.mensuel, 2300);
  assert.equal(t.nb, 4);
  assert.equal(t.aCompleter, 1);
  assert.deepEqual(simple(t.parCat).map((c) => [c.cat, c.annuel, c.nb]), [['video', 15600, 2], ['audio', 12000, 1]]);
  const e = R.economies(abos);
  assert.equal(e.potentielle, 12000);
  assert.equal(e.obtenue, 999 * 12);
  assert.equal(e.total, 12000 + 11988);
});

test('calendrier du mois et projection sur 12 mois', () => {
  const abos = [
    abo({ id: '1', nom: 'Vidéo', montant: 1000, debut: '2026-01-15' }),
    abo({ id: '2', nom: 'Panier', montant: 2000, periodicite: 'hebdo', debut: '2026-11-02' }),
    abo({ id: '3', nom: 'Assurance', montant: 24000, periodicite: 'annuel', debut: '2025-12-28' }),
    abo({ id: '4', nom: 'Sans prix', montant: null, debut: '2026-11-15' }),
  ];
  const m = R.prelevementsMois(abos, '2026-11');
  assert.equal(m.fin, '2026-11-30');
  assert.equal(m.total, 1000 + 5 * 2000);
  assert.equal(m.nb, 7);
  assert.equal(m.aCompleter, 1);
  assert.deepEqual(simple(m.jours.find((j) => j.date === '2026-11-15').items).map((i) => i.nom), ['Sans prix', 'Vidéo']);
  const p = R.projection(abos, AUJ, 12);
  assert.equal(p.length, 12);
  assert.equal(p[0].mois, '2026-11');
  assert.equal(p[1].mois, '2026-12');
  assert.equal(p[1].total, 1000 + 4 * 2000 + 24000); // pic de l'annuel en décembre
  assert.equal(p[11].mois, '2027-10');
  const proch = R.prochains(abos, AUJ, R.ajout(AUJ, 7));
  assert.deepEqual(simple(proch).map((x) => x.date), ['2026-11-15', '2026-11-15', '2026-11-16']);
});

test('normaliser : tolérant aux données anciennes ou invalides', () => {
  const e = R.normaliser({ abonnements: [{ nom: 'X', montant: -5, periodicite: 'bizarre', debut: '2026-02-30', parts: 0, statut: 'zzz', preavisJours: 9999 }], reglages: { alerteJours: 'a' } }, AUJ);
  const a = e.abonnements[0];
  assert.equal(a.montant, null);
  assert.equal(a.periodicite, 'mensuel');
  assert.equal(a.debut, AUJ);
  assert.equal(a.parts, 1);
  assert.equal(a.statut, 'actif');
  assert.equal(a.preavisJours, 365);
  assert.equal(e.reglages.alerteJours, 30);
  assert.deepEqual(simple(R.normaliser(null, AUJ)), simple(R.etatVide()));
  assert.equal(R.normaliserAbonnement({ montant: 1000, maPart: 2000 }, AUJ).maPart, 1000);
});

test('export CSV : séparateur point-virgule, guillemets, BOM', () => {
  const csv = R.versCsv([abo({ nom: 'Box "fibre"; maison', note: 'ligne' })], () => 'Vidéo et TV', () => 'Chaque mois', AUJ);
  assert.ok(csv.startsWith('﻿Abonnement;Catégorie'));
  assert.ok(csv.includes('"Box ""fibre""; maison";Vidéo et TV;Actif;10,00;Chaque mois;1;10,00;10,00;120,00;2026-11-15'));
});

test('base intégrée : riche, sans marque ni prix, périodicités valides', () => {
  assert.ok(BASE.categories.length >= 15);
  const types = BASE.categories.flatMap((c) => c.types);
  assert.ok(types.length >= 80, `${types.length} abonnements types`);
  const ids = new Set(BASE.categories.map((c) => c.id));
  assert.equal(ids.size, BASE.categories.length);
  for (const ty of types) {
    assert.ok(R.PERIODES[ty.periodicite], ty.nom);
    assert.ok(!/\d+[,.]?\d*\s*€/.test(ty.nom), `prix figé : ${ty.nom}`);
    assert.ok(ty.engagementMois >= 0 && ty.preavisJours >= 0);
  }
  for (const p of BASE.periodicites) assert.equal(p.parAn, R.PERIODES[p.id].parAn);
  const texte = JSON.stringify(BASE).toLowerCase();
  for (const marque of ['netflix', 'spotify', 'deezer', 'disney', 'amazon', 'prime', 'canal', 'orange', 'sfr', 'bouygues', 'free ', 'apple', 'google', 'microsoft', 'adobe', 'youtube', 'xbox', 'playstation', 'icloud', 'dropbox', 'basic-fit', 'uber', 'deliveroo']) {
    assert.ok(!texte.includes(marque), `marque : ${marque}`);
  }
  assert.ok(BASE.sourceReperes.includes('à vérifier'));
});
