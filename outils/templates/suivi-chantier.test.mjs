// Tests des règles métier du Suivi de chantier par lot (templates/suivi-chantier/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/suivi-chantier/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.CHT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const esp = (s) => s.replace(/[\u00A0\u202F]/g, ' '); // espaces insécables de l'affichage
const AUJ = '2026-11-14';
const DEF = { reglages: BASE.reglages, pieces: BASE.pieces };

// Opération minimale : deux lots, réglages par défaut (retenue 5 %, paiement à 30 jours, alerte 7 jours).
function operation(extra = {}) {
  return R.normaliserOperation({
    id: 'op', nom: 'Résidence Exemple',
    lots: [
      { id: 'go', code: 'GO', nom: 'Gros œuvre', entreprise: 'Bâti Exemple', montant: 100000000, debut: '2026-03-01', fin: '2026-08-31', plafond: 5 },
      { id: 'ce', code: 'CE', nom: 'Couverture', entreprise: 'Toits Exemple', montant: 20000000, debut: '2026-07-01', fin: '2026-10-31' },
    ],
    pieces: [],
    ...extra,
  }, DEF);
}

test('base intégrée : lots, jalons, pièces, typologies et réglages cohérents', () => {
  const codes = BASE.lots.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(BASE.lots.length >= 15 && BASE.jalons.length >= 10 && BASE.pieces.length >= 8);
  assert.ok(BASE.jalons.every((j) => ['operation', 'lot'].includes(j.portee) && ['contractuel', 'interne'].includes(j.type)));
  assert.ok(BASE.typesNC.length >= 8 && BASE.categoriesRisques.length >= 8);
  assert.equal(BASE.echelle.probabilite.length, 4);
  assert.equal(BASE.echelle.impact.length, 4);
  assert.equal(BASE.reglages.rg, 5);
  assert.deepEqual(Object.keys(BASE.reglages.delaisNC), Object.keys(R.GRAVITES));
});

test('saisie tolérante des montants et du coefficient de révision, affichage', () => {
  assert.equal(R.lireMontant('1 234,56'), 123456);
  assert.equal(R.lireMontant('2500 €'), 250000);
  assert.equal(R.lireMontant('-2 500'), null);
  assert.equal(R.lireMontant('−2 500', { signe: true }), -250000);
  assert.equal(R.lireMontant('1,234'), null);
  assert.equal(R.lireCoefficient(''), 1);
  assert.equal(R.lireCoefficient('1,0234'), 1.0234);
  assert.equal(R.lireCoefficient('3'), null);
  assert.equal(esp(R.euros(123456)), '1 234,56 €');
  assert.equal(esp(R.euros(-500)), '−5,00 €');
  assert.equal(esp(R.euros(250000, { signe: true })), '+2 500,00 €');
  assert.equal(esp(R.euros(123456789, { centimes: false })), '1 234 568 €');
  assert.equal(R.saisieMontant(1250), '12,50');
});

test('marché actualisé : seuls les avenants signés comptent, les projets sont isolés', () => {
  const op = operation({ avenants: [
    { lot: 'go', numero: 1, objet: 'Fondations renforcées', montant: 3000000, delai: 10, statut: 'signe', date: '2026-04-10' },
    { lot: 'go', numero: 2, objet: 'Suppression d\'un local', montant: -500000, delai: 0, statut: 'signe', date: '2026-05-10' },
    { lot: 'go', numero: 3, objet: 'Réseau supplémentaire', montant: 1200000, delai: 5, statut: 'projet' },
    { lot: 'go', numero: 4, objet: 'Refusé', montant: 900000, delai: 20, statut: 'refuse' },
  ] });
  const m = R.marcheLot(op, 'go');
  assert.equal(m.initial, 100000000);
  assert.equal(m.avenantsSignes, 2500000);
  assert.equal(m.actualise, 102500000);
  assert.equal(m.avenantsProjet, 1200000);
  assert.equal(m.delaiAvenants, 10);
  assert.equal(m.nbRefuses, 1);
  assert.equal(m.ecartPct, 2.5);
  assert.equal(R.prochainAvenant(op, 'go'), 5);
  assert.equal(R.prochainAvenant(op, 'ce'), 1);
});

test('situations : travaux du mois, révision, retenue de garantie, net et retard de paiement', () => {
  const op = operation({ situations: [
    { lot: 'go', numero: 2, mois: '2026-04', cumul: 30000000, k: 1.02, penalites: 100000, dateReception: '2026-05-05', statut: 'validee' },
    { lot: 'go', numero: 1, mois: '2026-03', cumul: 10000000, k: 1, dateReception: '2026-04-03', statut: 'payee', datePaiement: '2026-05-10' },
    { lot: 'go', numero: 3, mois: '2026-10', cumul: 28000000, k: 1, dateReception: '2026-11-05', statut: 'recue' },
  ] });
  const s = R.situationsLot(op, 'go', AUJ);
  assert.deepEqual(s.map((x) => x.situation.numero), [1, 2, 3]);
  // Situation 1 : 100 000 € de travaux, retenue 5 %, payée 7 jours après l'échéance (03/04 + 30 j = 03/05).
  assert.equal(s[0].travaux, 10000000);
  assert.equal(s[0].rg, 500000);
  assert.equal(s[0].net, 9500000);
  assert.equal(s[0].echeance, '2026-05-03');
  assert.equal(s[0].retardPaiement, 7);
  assert.equal(s[0].enRetard, false);
  // Situation 2 : 200 000 € de travaux, K = 1,02 → révision 4 000 € ; retenue sur 204 000 € ; pénalités 1 000 €.
  assert.equal(s[1].travaux, 20000000);
  assert.equal(s[1].revision, 400000);
  assert.equal(s[1].montant, 20400000);
  assert.equal(s[1].rg, 1020000);
  assert.equal(s[1].net, 20400000 - 1020000 - 100000);
  assert.ok(s[1].enRetard && s[1].retardPaiement === R.ecart('2026-06-04', AUJ));
  // Situation 3 : cumul en baisse (correction) → travaux négatifs ; reçue il y a 9 jours, pas encore due.
  assert.equal(s[2].travaux, -2000000);
  assert.equal(s[2].enRetard, false);
  assert.equal(R.prochaineSituation(op, 'go'), 4);
  assert.equal(R.cumulAuMois(op, 'go', '2026-05'), 30000000);
  assert.equal(R.cumulAuMois(op, 'go', '2026-02'), 0);
});

test('synthèse financière par lot et totaux, dépassement du marché actualisé', () => {
  const op = operation({
    avenants: [{ lot: 'ce', numero: 1, objet: 'Zinguerie', montant: 1000000, delai: 0, statut: 'signe' }],
    situations: [
      { lot: 'go', numero: 1, mois: '2026-03', cumul: 40000000, dateReception: '2026-04-03', statut: 'payee', datePaiement: '2026-04-20' },
      { lot: 'ce', numero: 1, mois: '2026-07', cumul: 22000000, dateReception: '2026-08-03', statut: 'validee' },
    ],
    sousTraitants: [
      { lot: 'go', entreprise: 'Ferraillage Exemple', montant: 8000000, dateDemande: '2026-03-10', statut: 'accepte' },
      { lot: 'go', entreprise: 'Refusé Exemple', montant: 5000000, dateDemande: '2026-03-10', statut: 'refuse' },
    ],
  });
  const f = R.syntheseFinanciere(op, AUJ);
  const go = f.lots[0], ce = f.lots[1];
  assert.equal(go.avancement, 40);
  assert.equal(go.resteAFacturer, 60000000);
  assert.equal(go.paye, 38000000);
  assert.equal(go.sousTraite, 8000000);
  assert.equal(go.partSousTraitee, 8);
  assert.equal(ce.actualise, 21000000);
  assert.equal(ce.depassement, 1000000);
  assert.equal(ce.aPayer, 22000000 - 1100000);
  assert.equal(f.total.actualise, 121000000);
  assert.equal(f.total.cumul, 62000000);
  assert.equal(f.total.rg, 2000000 + 1100000);
  assert.ok(R.alertes(op, AUJ).some((a) => a.niveau === 'rouge' && /au-delà du marché/.test(a.texte)));
});

test('jalons : prolongation par avenants et intempéries retenues, états et pénalités plafonnées', () => {
  const op = operation({
    avenants: [{ lot: 'go', numero: 1, objet: 'Délai', montant: 0, delai: 10, statut: 'signe' }],
    journal: [
      { date: '2026-04-02', meteo: 'Gel', intemperie: { jours: 1, retenue: true, lot: 'go', nature: 'Gel' } },
      { date: '2026-04-03', meteo: 'Gel', intemperie: { jours: 0.5, retenue: true, lot: '', nature: 'Gel' } },
      { date: '2026-04-04', meteo: 'Pluie', intemperie: { jours: 1, retenue: false, lot: '', nature: 'Pluie' } },
    ],
    jalons: [
      { id: 'j1', lot: 'go', nom: 'Fin du gros œuvre', type: 'contractuel', date: '2026-10-01', penaliteJour: 100000 },
      { id: 'j2', lot: 'go', nom: 'Démarrage', type: 'contractuel', date: '2026-03-01', dateReelle: '2026-03-05' },
      { id: 'j3', lot: 'ce', nom: 'Hors d\'eau', type: 'interne', date: '2026-11-19' },
      { id: 'j4', lot: '', nom: 'Réception', type: 'contractuel', date: '2027-01-15' },
    ],
  });
  const p = R.prolongationLot(op, 'go');
  assert.equal(p.avenants, 10);
  assert.equal(p.intemperies, 1.5);
  assert.equal(p.total, 12);
  // Seuls les événements datés jusqu'au jalon comptent (avenant sans date : toujours).
  assert.equal(R.prolongationLot(op, 'go', '2026-04-02').total, 11);
  assert.equal(R.etatJalon(op.jalons[1], op, AUJ).prolongation, 10);
  // L'intempérie générale du 03/04 tombe avant le début du lot CE (01/07) : elle ne le prolonge pas.
  assert.equal(R.prolongationLot(op, 'ce').total, 0);
  assert.equal(R.prolongationOperation(op).total, 12);
  const b = R.bilanIntemperies(op);
  assert.equal(b.constates, 2.5);
  assert.equal(b.retenus, 1.5);
  const j1 = R.etatJalon(op.jalons[0], op, AUJ);
  assert.equal(j1.dateRecalee, '2026-10-13');
  assert.equal(j1.etat, 'retard');
  assert.equal(j1.retard, 32);
  assert.equal(j1.penalites, 3200000);
  // Plafond 5 % du marché actualisé du lot GO (1 000 000 €) = 50 000 € : non atteint ici.
  const pen = R.penalitesLot(op, 'go', AUJ);
  assert.equal(pen.retenu, 3200000);
  assert.equal(pen.plafonne, false);
  assert.equal(R.penalitesLot(op, 'go', '2028-01-01').retenu, 5000000);
  assert.equal(R.etatJalon(op.jalons[1], op, AUJ).etat, 'atteint'); // 05/03 avant la date recalée du 13/03
  const j3 = R.etatJalon(op.jalons[2], op, AUJ);
  assert.equal(j3.dateRecalee, '2026-11-19');
  assert.equal(j3.etat, 'proche');
  assert.equal(R.etatJalon(op.jalons[3], op, AUJ).dateRecalee, '2027-01-27');
  assert.equal(R.jalonsTries(op, AUJ)[0].jalon.id, 'j2');
});

test('échéancier linéaire au prorata des jours, somme exacte, et courbe prévu / réalisé', () => {
  const e = R.echeancierLineaire(100000, '2026-01-16', '2026-03-31');
  assert.deepEqual(simple(e.map((x) => x.mois)), ['2026-01', '2026-02', '2026-03']);
  assert.equal(e.reduce((s, x) => s + x.montant, 0), 100000);
  assert.equal(e[0].montant, Math.round(100000 * 16 / 75));
  assert.deepEqual(simple(R.echeancierLineaire(100, '2026-02-01', '2026-01-01')), []);
  const op = operation({
    echeancier: [
      { lot: 'go', mois: '2026-03', montant: 20000000 }, { lot: 'go', mois: '2026-04', montant: 30000000 },
      { lot: 'ce', mois: '2026-04', montant: 5000000 },
    ],
    situations: [
      { lot: 'go', numero: 1, mois: '2026-03', cumul: 15000000, dateReception: '2026-04-02' },
      { lot: 'go', numero: 2, mois: '2026-04', cumul: 40000000, dateReception: '2026-05-02' },
    ],
  });
  const c = R.courbe(op, AUJ);
  assert.equal(c.mois[0], '2026-03');
  assert.equal(c.mois[c.mois.length - 1], '2026-10');
  assert.equal(c.prevu[1], 55000000);
  assert.equal(c.reel[0], 15000000);
  assert.equal(c.reel[1], 40000000);
  assert.equal(c.reel[2], null);
  const ep = R.ecartPrevisionnel(op, AUJ);
  assert.equal(ep.mois, '2026-04');
  assert.equal(ep.ecart, -15000000);
});

test('non-conformités simplifiées : retard, gravité, échéance proposée', () => {
  const op = operation({ nc: [
    { lot: 'go', date: '2026-10-01', titre: 'Planéité dalle R+1', gravite: 'majeure', statut: 'ouverte', echeance: '2026-10-16' },
    { lot: 'ce', date: '2026-11-01', titre: 'Solin manquant', gravite: 'critique', statut: 'traitement', echeance: '2026-11-20' },
    { lot: 'go', date: '2026-09-01', titre: 'Fiche technique', gravite: 'mineure', statut: 'levee', echeance: '2026-09-20' },
    { lot: 'go', date: '2026-08-01', titre: 'Close', gravite: 'mineure', statut: 'close', dateCloture: '2026-08-15' },
  ] });
  const b = R.bilanNC(op, AUJ);
  assert.equal(b.total, 4);
  assert.equal(b.ouvertes, 2);
  assert.equal(b.enRetard, 1);
  assert.equal(b.aVerifier, 1);
  assert.equal(b.parGravite.critique, 1);
  assert.equal(b.parLot[0].ouvertes, 1);
  assert.equal(R.etatNC(op.nc[0], AUJ).retard, 29);
  assert.equal(R.etatNC(op.nc[3], AUJ).age, 14);
  assert.equal(R.echeanceNC('2026-11-14', 'critique', BASE.reglages.delaisNC), '2026-11-21');
  const a = R.alertes(op, AUJ);
  assert.ok(a.some((x) => /Planéité/.test(x.texte) && x.niveau === 'rouge'));
  assert.ok(a.some((x) => /Critique ouverte : Solin/.test(x.texte)));
});

test('risques : criticité, niveaux, matrice 4 × 4 et exposition', () => {
  assert.equal(R.niveau(16), 'critique');
  assert.equal(R.niveau(12), 'critique');
  assert.equal(R.niveau(9), 'eleve');
  assert.equal(R.niveau(6), 'modere');
  assert.equal(R.niveau(3), 'faible');
  const op = operation({ risques: [
    { titre: 'Sol', probabilite: 3, impact: 4, montant: 4000000 },
    { titre: 'Approvisionnement', probabilite: 2, impact: 2, montant: 0 },
    { titre: 'Clos', probabilite: 4, impact: 4, statut: 'clos' },
  ] });
  const b = R.bilanRisques(op, AUJ);
  assert.equal(b.ouverts.length, 2);
  assert.equal(b.ouverts[0].risque.titre, 'Sol');
  assert.equal(b.parNiveau.critique, 1);
  assert.equal(b.clos, 1);
  assert.equal(b.matrice.length, 16);
  assert.equal(b.matrice.find((c) => c.p === 3 && c.i === 4).n, 1);
  assert.equal(b.exposition, 3000000);
});

test('courriers et OS : numérotation, réponse attendue en retard ou proche', () => {
  const op = operation({ courriers: [
    { type: 'os', numero: 1, date: '2026-03-01', objet: 'Démarrage des travaux', sens: 'emis' },
    { type: 'os', numero: 2, date: '2026-05-01', objet: 'Travaux modificatifs', sens: 'emis', reponseAttendue: '2026-11-01' },
    { type: 'courrier', numero: 0, date: '2026-11-10', objet: 'Demande de prix', sens: 'emis', reponseAttendue: '2026-11-18' },
    { type: 'courrier', date: '2026-10-01', objet: 'Répondu', sens: 'recu', reponseAttendue: '2026-10-10', dateReponse: '2026-10-08' },
  ] });
  assert.equal(R.prochainNumero(op, 'os'), 3);
  assert.equal(R.prochainNumero(op, 'miseEnDemeure'), 1);
  const t = R.courriersTries(op, AUJ);
  assert.equal(t[0].courrier.objet, 'Demande de prix');
  assert.equal(R.etatCourrier(op.courriers[1], op, AUJ).retard, 13);
  assert.equal(R.etatCourrier(op.courriers[2], op, AUJ).proche, true);
  assert.equal(R.etatCourrier(op.courriers[3], op, AUJ).attente, false);
  assert.equal(R.libCourrier(op.courriers[1]), 'OS n° 2');
});

test('sous-traitance et pièces : relance après le délai réglé, pièces manquantes', () => {
  const op = operation({
    sousTraitants: [
      { lot: 'go', entreprise: 'Étanchéité Exemple', montant: 100, dateDemande: '2026-10-20', statut: 'demande' },
      { lot: 'go', entreprise: 'Récent Exemple', montant: 100, dateDemande: '2026-11-10', statut: 'demande' },
    ],
    pieces: [{ nom: 'CCAP', present: true }, { nom: 'PGC', present: false }],
  });
  assert.equal(R.etatSousTraitant(op.sousTraitants[0], op, AUJ).attente, 25);
  assert.equal(R.etatSousTraitant(op.sousTraitants[0], op, AUJ).aRelancer, true);
  assert.equal(R.etatSousTraitant(op.sousTraitants[1], op, AUJ).aRelancer, false);
  assert.equal(R.piecesManquantes(op).length, 1);
  const a = R.alertes(op, AUJ);
  assert.ok(a.some((x) => x.domaine === 'Sous-traitance'));
  assert.ok(a.some((x) => x.domaine === 'Pièces' && /PGC/.test(x.texte)));
  // Les alertes rouges passent avant les jaunes.
  const op2 = operation({ jalons: [{ nom: 'Réception', date: '2026-10-01' }], pieces: [{ nom: 'PGC' }] });
  assert.deepEqual(simple(R.alertes(op2, AUJ).map((x) => x.niveau)), ['rouge', 'jaune']);
});

test('revue de projet et exports CSV', () => {
  const op = operation({
    situations: [{ lot: 'go', numero: 1, mois: '2026-03', cumul: 10000000, dateReception: '2026-04-03', statut: 'payee', datePaiement: '2026-04-10' }],
    jalons: [{ lot: '', nom: 'Réception', date: '2027-01-15' }],
    risques: [{ titre: 'Sol; argileux', probabilite: 4, impact: 4 }],
  });
  const t = R.texteRevue(op, AUJ);
  assert.match(t, /^REVUE DE PROJET · Résidence Exemple/);
  for (const s of ['1. DÉLAIS', '2. FINANCES', '3. QUALITÉ', '4. RISQUES', '5. COURRIERS', '6. POINTS À ARBITRER']) assert.ok(t.includes(s), s);
  assert.match(t, /Risque critique : Sol; argileux/);
  const c = R.versCsvSynthese(op, AUJ);
  assert.equal(c.charCodeAt(0), 0xFEFF);
  const lignes = c.slice(1).split('\r\n');
  assert.equal(lignes.length, 4);
  assert.match(lignes[1], /^GO;Gros œuvre;Bâti Exemple;1000000,00;0,00;1000000,00;/);
  assert.match(lignes[3], /^Total;/);
  const s = R.versCsvSituations(op, AUJ).slice(1).split('\r\n');
  assert.equal(s.length, 2);
  assert.match(s[1], /^GO;1;2026-03;100000,00;100000,00;1;0,00;5000,00;0,00;95000,00;2026-04-03;Payée;2026-05-03;2026-04-10;$/);
});

test('normalisation tolérante, suppression d\'un lot et données de démonstration', () => {
  const e = R.normaliser({ operations: [{ nom: '', lots: [{ id: 'x', code: 'GO', montant: '1000' }], avenants: [{ lot: 'inconnu', montant: 5 }], situations: [{ lot: 'x', mois: '2026-13', cumul: 1 }], jalons: [{ nom: 'Sans date' }], risques: [{ probabilite: 9, impact: 0 }] }], actif: 'absent' }, DEF);
  const op = e.operations[0];
  assert.equal(op.nom, 'Opération sans nom');
  assert.equal(op.lots[0].montant, 1000);
  assert.equal(op.avenants.length, 0);
  assert.equal(op.situations.length, 0);
  assert.equal(op.jalons.length, 0);
  assert.equal(op.risques[0].probabilite, 2);
  assert.equal(op.reglages.rg, 5);
  assert.equal(op.pieces.length, BASE.pieces.length);
  assert.equal(e.actif, op.id);
  assert.deepEqual(simple(R.normaliser(null)), { version: 1, operations: [], actif: '' });
  const op2 = operation({
    avenants: [{ lot: 'go', montant: 1, statut: 'signe' }],
    situations: [{ lot: 'go', mois: '2026-03', cumul: 1 }],
    nc: [{ lot: 'go', date: '2026-03-01', titre: 'NC' }],
    journal: [{ date: '2026-03-02', intemperie: { jours: 1, retenue: true, lot: 'go' } }],
  });
  const sans = R.supprimerLot(op2, 'go');
  assert.equal(sans.lots.length, 1);
  assert.equal(sans.avenants.length, 0);
  assert.equal(sans.situations.length, 0);
  assert.equal(sans.nc[0].lot, '');
  assert.equal(sans.journal[0].intemperie.lot, '');
  assert.equal(op2.lots.length, 2); // l'original n'est pas modifié
});
