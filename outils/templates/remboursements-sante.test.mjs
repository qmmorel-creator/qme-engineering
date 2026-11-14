// Tests des règles métier des remboursements santé (templates/remboursements-sante/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/remboursements-sante/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RBS;
const BASE = ctx.window.BASE;
const TYPES = R.indexTypes(BASE);
const AUJ = '2026-11-14';
const REGLAGES = { delaiSS: 30, delaiMut: 30, delaiRelance: 15, nomMutuelle: '' };
const soin = (extra = {}) => R.normaliserSoin({ id: 's', membre: 'm1', type: 'generaliste', date: '2026-11-01', montant: 3000, ss: { mode: 'attendu', attendu: 1900 }, mut: { mode: 'attendu', attendu: 900 }, ...extra }, AUJ);

test('montants : lecture tolérante et affichage', () => {
  assert.equal(R.lireMontant('16,50'), 1650);
  assert.equal(R.lireMontant('16.5 €'), 1650);
  assert.equal(R.lireMontant(' 1 234,5 '), 123450);
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('-3'), null);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.euros(1650), '16,50 €');
  assert.equal(R.euros(120000), '1 200,00 €');
  assert.equal(R.euros(-100, { signe: true }), '−1,00 €');
  assert.equal(R.euros(100, { signe: true }), '+1,00 €');
  assert.equal(R.euros(null), '–');
  assert.equal(R.saisieMontant(905), '9,05');
});

test('base : familles, types uniques, aucun taux ni tarif intégré', () => {
  const ids = BASE.familles.flatMap((f) => f.types.map(([id]) => id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BASE.familles.length, 10);
  assert.equal(ids.length, 33);
  assert.equal(TYPES.kine.famille, 'auxiliaires');
  assert.equal(TYPES.lunettes.nomFamille, 'Optique');
  // Aucun pourcentage ni montant en euros dans la base (les taux sont saisis par l'utilisateur).
  const texte = readFileSync(new URL('donnees.js', dossier), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(texte, /\d\s*%|\d+[,.]\d{2}\s*€|\d+\s*€/);
  // Aucun champ de diagnostic, motif ou médicament dans les données d'un soin (minimisation).
  assert.deepEqual(Object.keys(soin()).sort(), ['date', 'id', 'membre', 'montant', 'mut', 'praticien', 'reference', 'ss', 'type']);
  assert.equal(BASE.couleurs.length, 8);
});

test('organisme : couvert, prévu, état et tiers payant', () => {
  const s = soin();
  assert.equal(R.couvert(s.ss), 0);
  assert.equal(R.couvertPrevu(s.ss), 1900);
  assert.equal(R.etatOrg(s, 'ss', AUJ, REGLAGES).etat, 'attente');
  const t = soin({ ss: { mode: 'tiers', attendu: 1210 }, mut: { mode: 'tiers', attendu: 630 }, montant: 1840 });
  assert.equal(R.couvert(t.ss), 1210);
  assert.equal(R.etatOrg(t, 'ss', AUJ, REGLAGES).etat, 'tiers');
  assert.equal(R.avance(t), 0);
  assert.equal(R.resteACharge(t), 0);
  assert.ok(R.solde(t));
  const a = soin({ ss: { mode: 'aucun', attendu: 1500 }, mut: { mode: 'aucun' }, montant: 6000 });
  assert.equal(a.ss.attendu, 0);
  assert.equal(R.etatOrg(a, 'ss', AUJ, REGLAGES).etat, 'aucun');
  assert.equal(R.resteACharge(a), 6000);
  assert.equal(R.etatSoin(a, AUJ, REGLAGES), 'solde');
});

test('reçu : montant, écart à l\'attendu, reste à charge', () => {
  const s = soin({ ss: { mode: 'attendu', attendu: 1900, recuLe: '2026-11-06', recu: 1900 }, mut: { mode: 'attendu', attendu: 900, recuLe: '2026-11-10', recu: 800 } });
  assert.equal(R.etatOrg(s, 'ss', AUJ, REGLAGES).etat, 'recu');
  assert.equal(R.etatOrg(s, 'mut', AUJ, REGLAGES).ecart, -100);
  assert.equal(R.rembourse(s), 2700);
  assert.equal(R.resteACharge(s), 300);
  assert.equal(R.resteAChargePrevu(s), 300);
  assert.ok(R.solde(s));
  // Reçu sans montant saisi : le montant attendu est retenu.
  const r = soin({ ss: { mode: 'attendu', attendu: 1900, recuLe: '2026-11-06' } });
  assert.equal(R.couvert(r.ss), 1900);
  // Reste à charge partiel tant que la mutuelle n'a pas payé.
  const p = soin({ ss: { mode: 'attendu', attendu: 1900, recuLe: '2026-11-06', recu: 1900 } });
  assert.equal(R.resteACharge(p), 1100);
  assert.equal(R.resteAChargePrevu(p), 200);
  assert.ok(!R.solde(p));
  // Remboursements supérieurs au montant payé : signalé.
  assert.ok(R.incoherent(soin({ montant: 2000 })));
  assert.ok(!R.incoherent(soin()));
});

test('retard : délai depuis la transmission, sinon le soin, puis après relance', () => {
  // Soin du 01/10 : 44 jours, délai 30 → retard.
  const s = soin({ date: '2026-10-01' });
  const e = R.etatOrg(s, 'ss', AUJ, REGLAGES);
  assert.equal(e.etat, 'retard');
  assert.equal(e.jours, 44);
  assert.equal(e.echeance, '2026-10-31');
  // Le dernier jour du délai n'est pas encore un retard.
  assert.equal(R.etatOrg(soin({ date: '2026-10-15' }), 'ss', AUJ, REGLAGES).etat, 'attente');
  assert.equal(R.etatOrg(soin({ date: '2026-10-14' }), 'ss', AUJ, REGLAGES).etat, 'retard');
  // Transmis plus tard : le délai part de la transmission.
  const t = soin({ date: '2026-10-01', mut: { mode: 'attendu', attendu: 900, transmisLe: '2026-11-01' } });
  assert.equal(R.etatOrg(t, 'mut', AUJ, REGLAGES).etat, 'attente');
  assert.equal(R.etatOrg(t, 'mut', AUJ, REGLAGES).depuis, '2026-11-01');
  // Délai propre à la mutuelle.
  assert.equal(R.etatOrg(soin({ date: '2026-11-01' }), 'mut', AUJ, { ...REGLAGES, delaiMut: 10 }).etat, 'retard');
  // Relancé le 05/11 : nouvelle alerte 15 jours après (20/11).
  const rl = soin({ date: '2026-09-01', ss: { mode: 'attendu', attendu: 1900, relances: ['2026-11-05', '2026-10-10'] } });
  const er = R.etatOrg(rl, 'ss', AUJ, REGLAGES);
  assert.equal(er.etat, 'attente');
  assert.equal(er.relance, '2026-11-05');
  assert.equal(er.nbRelances, 2);
  assert.equal(er.echeance, '2026-11-20');
  assert.equal(R.etatOrg(rl, 'ss', '2026-11-21', REGLAGES).etat, 'retard');
  // Soin daté dans le futur : jamais en retard, jours à 0.
  assert.equal(R.etatOrg(soin({ date: '2026-12-01' }), 'ss', AUJ, REGLAGES).jours, 0);
});

test('attentes : retards en tête, montants à préciser compris', () => {
  const soins = [
    soin({ id: 'a', date: '2026-11-10' }),
    soin({ id: 'b', date: '2026-09-01', ss: { mode: 'tiers', attendu: 1000 }, mut: { mode: 'attendu', attendu: null } }),
    soin({ id: 'c', date: '2026-01-01', ss: { mode: 'aucun' }, mut: { mode: 'attendu', attendu: 500, recuLe: '2026-02-01' } }),
  ];
  const l = R.attentes(soins, AUJ, REGLAGES);
  assert.deepEqual(simple(l.map((x) => [x.id, x.org, x.etat])), [['b', 'mut', 'retard'], ['a', 'ss', 'attente'], ['a', 'mut', 'attente']]);
  assert.equal(l[0].attendu, null);
  assert.equal(R.etatSoin(soins[1], AUJ, REGLAGES), 'retard');
  assert.equal(R.etatSoin(soins[2], AUJ, REGLAGES), 'solde');
});
const simple = (o) => JSON.parse(JSON.stringify(o));

test('totaux : année, par personne, par famille, part prise en charge', () => {
  const soins = [
    soin({ id: '1', membre: 'm1', type: 'generaliste', ss: { mode: 'attendu', attendu: 1900, recuLe: '2026-11-03', recu: 1900 } }),
    soin({ id: '2', membre: 'm2', type: 'lunettes', date: '2026-06-01', montant: 42000, ss: { mode: 'attendu', attendu: 900, recuLe: '2026-06-10', recu: 900 }, mut: { mode: 'attendu', attendu: 25000, recuLe: '2026-07-01', recu: 25000 } }),
    soin({ id: '3', membre: 'm2', type: 'pharmacie', date: '2026-03-01', montant: 1840, ss: { mode: 'tiers', attendu: 1210 }, mut: { mode: 'tiers', attendu: 630 } }),
    soin({ id: '4', membre: 'm1', type: 'generaliste', date: '2025-12-31' }),
  ];
  const t = R.totaux(soins, '2026', TYPES);
  assert.equal(t.nb, 3);
  assert.equal(t.paye, 3000 + 42000 + 1840);
  assert.equal(t.avance, 3000 + 42000);
  assert.equal(t.ss, 1900 + 900 + 1210);
  assert.equal(t.mut, 25000 + 630);
  assert.equal(t.rembourse, 1900 + 900 + 25000);
  assert.equal(t.attente, 900);
  assert.equal(t.rac, t.paye - t.ss - t.mut);
  assert.equal(t.racPrevu, t.rac - 900);
  assert.equal(R.partPriseEnCharge(t), Math.round(((t.ss + t.mut) / t.paye) * 100));
  assert.deepEqual(simple(t.parMembre.map((m) => m.membre)), ['m2', 'm1']);
  assert.deepEqual(simple(t.parFamille.map((f) => f.famille)), ['optique', 'consultations', 'pharmacie']);
  assert.equal(R.totaux(soins, null, TYPES).nb, 4);
  assert.equal(R.totaux([], '2026', TYPES).paye, 0);
  assert.equal(R.partPriseEnCharge(R.totaux([], '2026', TYPES)), 0);
  assert.deepEqual(simple(R.annees(soins, AUJ)), ['2026', '2025']);
  assert.deepEqual(simple(R.annees([], '2027-01-02')), ['2027']);
});

test('comparaison de la mutuelle aux cotisations saisies', () => {
  assert.equal(R.bilanMutuelle({ mut: 50000 }, null), null);
  assert.deepEqual(simple(R.bilanMutuelle({ mut: 51000 }, 102000)), { cotisation: 102000, rembourse: 51000, solde: -51000, ratio: 50 });
});

test('relance : modèle rempli sans ligne vide superflue', () => {
  const txt = R.remplir(BASE.relances.mut, { organisme: 'Ma mutuelle', soin: 'lunettes', date: '2 octobre 2026', personne: 'Julien', montant: '420,00 €', attendu: '250,00 €', transmis: '', reference: '', prenom: 'Camille' });
  assert.match(txt, /remboursement de Ma mutuelle pour le soin suivant/);
  assert.match(txt, /- lunettes du 2 octobre 2026 \(Julien\)/);
  assert.match(txt, /remboursement attendu : 250,00 €/);
  assert.doesNotMatch(txt, /\{|\}|\n{3,}/);
  assert.match(txt, /Ton numéro d'adhérent/);
  assert.match(R.remplir(BASE.relances.ss, { transmis: '- transmis le 3 octobre 2026\n' }), /transmis le 3 octobre/);
});

test('normalisation tolérante et membres disparus', () => {
  const v = R.normaliser(null, AUJ);
  assert.deepEqual(simple(v.reglages), { delaiSS: 30, delaiMut: 30, delaiRelance: 15, nomMutuelle: '' });
  assert.equal(v.consentement, null);
  const d = R.normaliser({
    consentement: { date: 'x', version: 'v' },
    membres: [{ id: 'm1', prenom: '  Camille ' }, { prenom: 'sans id' }],
    soins: [{ membre: 'inconnu', date: '2026-02-30', montant: -5, ss: { mode: 'bizarre', attendu: 'abc' }, mut: { mode: 'tiers', attendu: 500, recuLe: '2026-01-01', relances: ['2026-01-01'] }, diagnostic: 'à ne pas garder' }],
    reglages: { delaiSS: 999, delaiMut: 0, delaiRelance: 'x' },
    cotisations: { 2026: 102000, abc: 5, 2025: -1 },
  }, AUJ);
  assert.equal(d.membres.length, 1);
  assert.equal(d.membres[0].prenom, 'Camille');
  const s = d.soins[0];
  assert.equal(s.membre, 'm1');
  assert.equal(s.date, AUJ);
  assert.equal(s.montant, 0);
  assert.equal(s.ss.mode, 'attendu');
  assert.equal(s.ss.attendu, null);
  assert.equal(s.mut.recuLe, null);
  assert.deepEqual(simple(s.mut.relances), []);
  assert.equal(s.diagnostic, undefined);
  assert.deepEqual(simple(d.reglages), { delaiSS: 180, delaiMut: 1, delaiRelance: 15, nomMutuelle: '' });
  assert.deepEqual(simple(d.cotisations), { 2026: 102000 });
  assert.equal(d.consentement.version, 'v');
});

test('export CSV : en-têtes, séparateur, états', () => {
  const soins = [soin({ date: '2026-10-01', praticien: 'Cabinet; du centre' }), soin({ id: 't', ss: { mode: 'tiers', attendu: 1000 } })];
  const csv = R.versCsv(soins, () => 'Camille', TYPES, AUJ, REGLAGES);
  assert.ok(csv.startsWith('﻿Date;Personne;Type de soin'));
  const lignes = csv.split('\r\n');
  assert.equal(lignes.length, 3);
  assert.match(lignes[1], /^2026-10-01;Camille;Médecin généraliste;Consultations;"Cabinet; du centre";;30,00;30,00;Remboursement attendu;19,00;;;;En retard;/);
  assert.match(lignes[2], /Tiers payant;10,00;;;;Tiers payant;/);
});
