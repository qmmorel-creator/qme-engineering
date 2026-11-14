// Tests des règles métier de la relance des impayés (templates/impayes/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/impayes/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.RCV;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const AUJ = '2026-11-13';
const DEFAUTS = { reglages: BASE.reglages, paliers: BASE.paliers };
const REG = R.etatVide(DEFAUTS).reglages;
const fac = (extra = {}) => R.normaliserFacture({ id: 'f', client: 'c', numero: 'F-1', emission: '2026-09-01', echeance: '2026-10-01', montant: 100000, ...extra }, AUJ);

test('montants et taux : lecture tolérante et affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('99.9 €'), 9990);
  assert.equal(R.lireMontant('-5'), null);
  assert.equal(R.lireMontant('12,345'), null);
  assert.equal(R.euros(123456), '1 234,56 €');
  assert.equal(R.euros(-500), '−5,00 €');
  assert.equal(R.lireTaux('12,40'), 12.4);
  assert.equal(R.lireTaux('2.75 %'), 2.75);
  assert.equal(R.lireTaux('150'), null);
  assert.equal(R.lireTaux(''), null);
  assert.equal(R.pct(12.4), '12,40 %');
});

test('restant dû et date du solde avec paiements partiels', () => {
  const f = fac({ paiements: [{ date: '2026-10-20', montant: 30000 }, { date: '2026-10-10', montant: 20000 }] });
  assert.equal(R.paye(f), 50000);
  assert.equal(R.paye(f, '2026-10-15'), 20000);
  assert.equal(R.restant(f, '2026-10-15'), 80000);
  assert.equal(R.restant(f), 50000);
  assert.equal(R.dateSolde(f), null);
  const g = fac({ paiements: [{ date: '2026-10-10', montant: 60000 }, { date: '2026-10-25', montant: 40000 }] });
  assert.equal(R.dateSolde(g), '2026-10-25');
  // Un trop-perçu ne rend jamais le restant négatif.
  assert.equal(R.restant(fac({ paiements: [{ date: '2026-10-01', montant: 150000 }] })), 0);
});

test('statut calculé : priorités et cas', () => {
  assert.equal(R.statut(fac({ echeance: '2026-11-20' }), AUJ), 'aEchoir');
  assert.equal(R.statut(fac({ echeance: AUJ }), AUJ), 'aEchoir'); // le jour de l'échéance, pas encore en retard
  assert.equal(R.statut(fac(), AUJ), 'echue');
  assert.equal(R.statut(fac({ relances: [{ date: '2026-10-05', palier: 'rappel' }] }), AUJ), 'enRelance');
  assert.equal(R.statut(fac({ litige: true, relances: [{ date: '2026-10-05', palier: 'rappel' }] }), AUJ), 'litige');
  assert.equal(R.statut(fac({ abandonnee: true, litige: true }), AUJ), 'abandonnee');
  assert.equal(R.statut(fac({ abandonnee: true, paiements: [{ date: '2026-10-02', montant: 100000 }] }), AUJ), 'payee');
  // Paiement daté dans le futur : pas encore payée.
  assert.equal(R.statut(fac({ paiements: [{ date: '2026-11-20', montant: 100000 }] }), AUJ), 'echue');
});

test('retard en jours : au jour pour une facture ouverte, au solde pour une facture payée', () => {
  assert.equal(R.retardJours(fac(), AUJ), 43);
  assert.equal(R.retardJours(fac({ echeance: '2026-12-01' }), AUJ), 0);
  assert.equal(R.retardJours(fac({ paiements: [{ date: '2026-10-11', montant: 100000 }] }), AUJ), 10);
  assert.equal(R.retardJours(fac({ paiements: [{ date: '2026-09-20', montant: 100000 }] }), AUJ), 0);
});

test('taux du jour : règle du semestre et marquage « à vérifier »', () => {
  const liste = REG.bce;
  assert.equal(R.tauxDuJour(liste, '2026-03-15').taux, 2.15);
  assert.equal(R.tauxDuJour(liste, '2026-07-01').taux, 2.4);
  assert.equal(R.tauxDuJour(liste, '2026-12-31').aVerifier, false);
  assert.equal(R.tauxDuJour(liste, '2027-01-01').aVerifier, true); // nouveau semestre non saisi
  assert.equal(R.tauxDuJour(liste, '2024-06-01').aVerifier, true); // avant la première entrée
  assert.equal(R.tauxDuJour([], AUJ).taux, null);
});

test('taux applicable : BCE + 10 points, contrat, intérêt légal, plancher', () => {
  assert.equal(R.tauxApplicable(REG, 'pro', '2026-03-01').taux, 12.15);
  assert.equal(R.tauxApplicable(REG, 'pro', AUJ).taux, 12.4);
  assert.equal(R.tauxApplicable({ ...REG, tauxContractuelPro: 9 }, 'pro', AUJ).taux, 9);
  assert.equal(R.tauxApplicable(REG, 'particulier', AUJ).taux, 2.75);
  assert.equal(R.tauxApplicable(REG, 'particulier', '2026-02-01').taux, 2.62);
  assert.equal(R.plancherPro(REG, AUJ), 8.25);
});

test('pénalités entre professionnels : intérêts simples au prorata des jours', () => {
  // 1 000 € échus le 01/10/2026, au 13/11/2026 : 43 jours à 12,40 %.
  const p = R.penalites(fac(), 'pro', REG, AUJ);
  assert.equal(p.segments.length, 1);
  assert.equal(p.segments[0].jours, 43);
  assert.equal(p.montant, Math.round(100000 * 0.124 * 43 / 365));
  assert.equal(p.montant, 1461);
  assert.equal(p.aVerifier, false);
  // Pas de retard : rien.
  assert.equal(R.penalites(fac({ echeance: '2026-12-01' }), 'pro', REG, AUJ).montant, 0);
});

test('pénalités : paiements partiels et changement de semestre', () => {
  // Échéance 01/06/2026, 1 000 €, 400 € payés le 15/06, solde le 31/07.
  const f = fac({ emission: '2026-05-01', echeance: '2026-06-01', paiements: [{ date: '2026-06-15', montant: 40000 }, { date: '2026-07-31', montant: 60000 }] });
  const p = R.penalites(f, 'pro', REG, AUJ);
  assert.deepEqual(simple(p.segments.map((s) => [s.de, s.a, s.base, s.taux])), [
    ['2026-06-01', '2026-06-15', 100000, 12.15],
    ['2026-06-15', '2026-07-01', 60000, 12.15],
    ['2026-07-01', '2026-07-31', 60000, 12.4],
  ]);
  const attendu = 100000 * 0.1215 * 14 / 365 + 60000 * 0.1215 * 16 / 365 + 60000 * 0.124 * 30 / 365;
  assert.equal(p.montant, Math.round(attendu));
  assert.equal(p.fin, '2026-07-31'); // arrêt au solde
});

test('pénalités : particulier à partir de la mise en demeure seulement', () => {
  const sans = R.penalites(fac({ relances: [{ date: '2026-10-05', palier: 'rappel' }] }), 'particulier', REG, AUJ);
  assert.equal(sans.montant, 0);
  assert.equal(sans.raison, 'sans-mise-en-demeure');
  const f = fac({ relances: [{ date: '2026-10-05', palier: 'rappel' }, { date: '2026-11-03', palier: 'demeure', md: true }] });
  const p = R.penalites(f, 'particulier', REG, AUJ);
  assert.equal(p.debut, '2026-11-03');
  assert.equal(p.montant, Math.round(100000 * 0.0275 * 10 / 365));
  // Taux contractuel prévu dès l'échéance.
  const c = R.penalites(fac(), 'particulier', { ...REG, tauxContractuelPart: 5, depuisEcheancePart: true }, AUJ);
  assert.equal(c.montant, Math.round(100000 * 0.05 * 43 / 365));
  // Abandonnée : rien.
  assert.equal(R.penalites(fac({ abandonnee: true }), 'pro', REG, AUJ).montant, 0);
});

test('indemnité forfaitaire : 40 € par facture, entre professionnels seulement', () => {
  assert.equal(R.indemnite(fac(), 'pro', REG, AUJ), 4000);
  assert.equal(R.indemnite(fac(), 'particulier', REG, AUJ), 0);
  assert.equal(R.indemnite(fac({ echeance: '2026-12-01' }), 'pro', REG, AUJ), 0);
  // Payée en retard : l'indemnité reste due.
  assert.equal(R.indemnite(fac({ paiements: [{ date: '2026-10-03', montant: 100000 }] }), 'pro', REG, AUJ), 4000);
  assert.equal(R.indemnite(fac({ paiements: [{ date: '2026-09-30', montant: 100000 }] }), 'pro', REG, AUJ), 0);
});

test('prochaine relance : paliers dans l\'ordre, écart minimal, fin de parcours', () => {
  const P = REG && R.etatVide(DEFAUTS).paliers;
  const a = R.prochaineRelance(fac(), P, AUJ, 7);
  assert.equal(a.palier.id, 'rappel');
  assert.equal(a.date, '2026-10-04');
  assert.ok(a.due);
  // Rappel envoyé le 10/11 : la relance ferme (J+15 = 16/10) attend 7 jours après.
  const b = R.prochaineRelance(fac({ relances: [{ date: '2026-11-10', palier: 'rappel' }] }), P, AUJ, 7);
  assert.equal(b.palier.id, 'ferme');
  assert.equal(b.date, '2026-11-17');
  assert.equal(b.due, false);
  // Palier sauté : on reprend après le plus avancé.
  const c = R.prochaineRelance(fac({ relances: [{ date: '2026-10-01', palier: 'demeure', md: true }] }), P, AUJ, 7);
  assert.equal(c.palier.id, 'dernier');
  assert.equal(R.prochaineRelance(fac({ relances: [{ date: '2026-11-01', palier: 'dernier' }] }), P, AUJ, 7), null);
  assert.equal(R.prochaineRelance(fac({ litige: true }), P, AUJ, 7), null);
  assert.equal(R.prochaineRelance(fac({ paiements: [{ date: '2026-10-02', montant: 100000 }] }), P, AUJ, 7), null);
  const d = R.prochaineRelance(fac({ echeance: '2026-11-20' }), P, AUJ, 7);
  assert.equal(d.date, '2026-11-23');
  assert.equal(d.due, false);
});

test('synthèse : encours, tranches d\'ancienneté, pénalités et relances dues', () => {
  const clients = [{ id: 'p', type: 'pro' }, { id: 'q', type: 'particulier' }];
  const P = R.etatVide(DEFAUTS).paliers;
  const factures = [
    fac({ id: '1', client: 'p', echeance: '2026-12-01', montant: 50000 }),            // à échoir
    fac({ id: '2', client: 'p', echeance: '2026-10-20', montant: 20000 }),            // 24 j
    fac({ id: '3', client: 'p', echeance: '2026-09-10', montant: 30000, paiements: [{ date: '2026-10-01', montant: 10000 }] }), // 64 j, 200 €
    fac({ id: '4', client: 'q', emission: '2026-06-01', echeance: '2026-07-01', montant: 40000 }),            // 135 j
    fac({ id: '5', client: 'p', echeance: '2026-09-01', montant: 99000, paiements: [{ date: '2026-09-05', montant: 99000 }] }), // payée
    fac({ id: '6', client: 'p', emission: '2026-07-01', echeance: '2026-08-01', montant: 70000, abandonnee: true }),
    fac({ id: '7', client: 'p', echeance: '2026-09-28', montant: 10000 }),            // 46 j
  ];
  const s = R.synthese(factures, clients, REG, P, AUJ);
  assert.equal(s.encours, 50000 + 20000 + 20000 + 40000 + 10000);
  assert.equal(s.aEchoir, 50000);
  assert.equal(s.echu, 90000);
  assert.deepEqual(simple(s.tranches.map((t) => t.montant)), [20000, 10000, 20000, 40000]);
  assert.equal(s.abandonne, 70000);
  assert.equal(s.indemnites, 3 * 4000); // factures ouvertes 2, 3 et 7 (pro, en retard) ; la payée et l'abandonnée ne comptent pas
  assert.equal(s.relancesDues.length, 4);
  assert.equal(s.parClient[0].client, 'p'); // 500 € échus contre 400 €
});

test('modèles : champs remplis, champ inconnu conservé, phrase adaptée au type', () => {
  assert.equal(R.remplir('Facture {numero} : {restant} {inconnu}', { numero: 'F-9', restant: '10,00 €' }), 'Facture F-9 : 10,00 € {inconnu}');
  const etat = R.normaliser({ entreprise: 'Atelier fictif', signature: 'Alex, Atelier fictif', factures: [], clients: [] }, AUJ, DEFAUTS);
  const v = R.valeursMessage(fac(), { nom: 'Client test', type: 'pro' }, etat, AUJ);
  assert.equal(v.retard, '43 jours');
  assert.equal(v.restant, '1 000,00 €');
  assert.equal(v.indemnite, '40,00 €');
  assert.equal(v.penalites, '14,61 €');
  assert.equal(v.total_du, '1 054,61 €');
  assert.match(v.ligne_penalites, /L441-10/);
  const w = R.valeursMessage(fac(), { nom: 'Mme Test', type: 'particulier' }, etat, AUJ);
  assert.equal(w.indemnite, '0,00 €');
  assert.match(w.ligne_penalites, /1231-6/);
  // Tous les champs utilisés par les modèles intégrés existent.
  for (const p of BASE.paliers) for (const m of `${p.objet} ${p.corps}`.matchAll(/\{([a-z_]+)\}/g)) assert.ok(R.CHAMPS.includes(m[1]), m[1]);
  assert.deepEqual(simple(BASE.champs.map(([c]) => c)), simple(R.CHAMPS));
});

test('RGPD : effacement des données personnelles et suppression du client', () => {
  const etat = R.normaliser({
    clients: [{ id: 'a', nom: 'Mme Exemple', type: 'particulier', contact: 'exemple@exemple.test', note: 'Voisine' }, { id: 'b', nom: 'Autre' }],
    factures: [{ id: '1', client: 'a', numero: 'F-1', montant: 1000, note: 'Note perso', relances: [{ date: '2026-10-01', palier: 'rappel', note: 'Appel' }] }, { id: '2', client: 'b', numero: 'F-2', montant: 500 }],
  }, AUJ, DEFAUTS);
  const e = R.effacerClient(etat, 'a', 3);
  const c = e.clients.find((x) => x.id === 'a');
  assert.equal(c.nom, 'Client effacé 3');
  assert.equal(c.contact, '');
  assert.ok(c.efface);
  assert.equal(e.factures[0].note, '');
  assert.equal(e.factures[0].relances[0].note, '');
  assert.equal(e.factures[0].montant, 1000); // pièce comptable conservée
  assert.equal(etat.clients[0].nom, 'Mme Exemple'); // l'état d'origine n'est pas modifié
  const s = R.supprimerClient(etat, 'a');
  assert.equal(s.clients.length, 1);
  assert.deepEqual(simple(s.factures.map((f) => f.id)), ['2']);
});

test('normalisation tolérante et export CSV', () => {
  const v = R.normaliser(null, AUJ, DEFAUTS);
  assert.equal(v.paliers.length, 4);
  assert.equal(v.reglages.indemnite, 4000);
  const n = R.normaliser({ reglages: { ecartMin: 'x', majoration: 8, tauxContractuelPro: '' }, factures: [{ montant: -3, echeance: '2026-02-30', paiements: [{ montant: 0 }] }] }, AUJ, DEFAUTS);
  assert.equal(n.reglages.ecartMin, 7);
  assert.equal(n.reglages.majoration, 8);
  assert.equal(n.reglages.tauxContractuelPro, null);
  assert.equal(n.factures[0].montant, 0);
  assert.equal(n.factures[0].paiements.length, 0);
  assert.equal(n.factures[0].echeance, R.ajout(AUJ, 30));
  const e = R.normaliser({ clients: [{ id: 'c', nom: 'Client; "spécial"', type: 'pro' }], factures: [{ id: 'f', client: 'c', numero: 'F-1', emission: '2026-09-01', echeance: '2026-10-01', montant: 100000 }] }, AUJ, DEFAUTS);
  const csv = R.versCsv(e, AUJ);
  assert.ok(csv.startsWith('﻿Client;Type;Numéro'));
  assert.ok(csv.includes('"Client; ""spécial"""'));
  assert.ok(csv.includes('1000,00;0,00;1000,00;Échue;43;14,61;40,00'));
});

test('base intégrée : paliers croissants, taux datés plausibles', () => {
  const jours = BASE.paliers.map((p) => p.jours);
  assert.deepEqual(simple(jours), simple([...jours].sort((a, b) => a - b)));
  assert.equal(BASE.paliers.filter((p) => p.md).length, 1);
  for (const l of [BASE.reglages.bce, BASE.reglages.tauxLegal]) for (const x of l) { assert.ok(R.estDate(x.debut)); assert.ok(/-(01|07)-01$/.test(x.debut)); assert.ok(x.taux > 0 && x.taux < 10); }
  assert.equal(BASE.reglages.indemnite, 4000);
  assert.equal(BASE.reglages.majoration, 10);
});
