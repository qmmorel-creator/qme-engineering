// Tests des règles métier du CRM freelance (templates/crm/regles.js). Cas vérifiés à la main.
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../templates/crm/donnees.js');
await import('../../templates/crm/regles.js');
const B = globalThis.BASE;
const R = globalThis.CRM_REGLES;
const AUJ = '2026-11-12';

const facture = (o) => ({ id: o.id || 'f', type: 'facture', numero: 'F-2026-001', contactId: 'c1', date: '2026-10-01', ht: 1000, tva: 20, statut: 'envoyee', paiements: [], ...o });

test('base intégrée : étapes, actions types et repères sourcés, sans taux de TVA', () => {
  assert.deepEqual(B.etapes.map((e) => e.id), ['piste', 'qualifie', 'proposition', 'negociation', 'gagne', 'perdu']);
  assert.equal(B.actions.length, 14);
  const ids = new Set(B.actions.map((a) => a.id));
  for (const a of B.actions) assert.ok(ids.has(a.suite), `suite inconnue pour ${a.id}`);
  for (const e of B.etapes) assert.ok(ids.has(e.action), `action inconnue pour l'étape ${e.id}`);
  assert.equal(B.reperes.delaiPaiement.defaut, 30);
  assert.equal(B.reperes.conservation.ans, 3);
  assert.equal(B.reperes.consulteLe, '2026-11-12');
  for (const k of ['delaiPaiement', 'facturationElectronique', 'conservation']) assert.match(B.reperes[k].url, /^https:\/\/www\.|^https:\/\/entreprendre\./);
  assert.ok(!JSON.stringify(B).match(/"tva"|taux de tva par défaut/i));
});

test('dates : ajout, écart, mois, années (29 février)', () => {
  assert.equal(R.ajout('2026-12-28', 7), '2027-01-04');
  assert.equal(R.ecart('2026-11-01', AUJ), 11);
  assert.equal(R.ajoutMois('2026-01', -1), '2025-12');
  assert.equal(R.ajoutMois('2026-11', 2), '2027-01');
  assert.equal(R.ajoutAns('2024-02-29', 3), '2027-02-28');
  assert.equal(R.ajoutAns('2023-11-12', 3), '2026-11-12');
});

test('montants : TTC, encaissé, solde, part HT', () => {
  const f = facture({ ht: 1234.56, tva: 20, paiements: [{ date: '2026-10-20', montant: 500 }] });
  assert.equal(R.ttc(f), 1481.47); // 1234,56 × 1,2 = 1481,472
  assert.equal(R.encaisse(f), 500);
  assert.equal(R.solde(f), 981.47);
  assert.equal(R.partHT(facture({ ht: 1000, tva: 20 }), 600), 500);
  assert.equal(R.ttc(facture({ ht: 800, tva: 0 })), 800); // franchise en base : TVA saisie à 0
});

test('statut des factures : échéance par défaut, retard, partielle, payée, annulée, brouillon', () => {
  assert.equal(R.echeance(facture({ date: '2026-10-01' }), 30), '2026-10-31');
  assert.equal(R.echeance(facture({ date: '2026-10-01', delai: 45 })), '2026-11-15');
  assert.equal(R.statutFacture(facture({ date: '2026-10-01' }), AUJ, 30), 'retard');
  assert.equal(R.joursRetard(facture({ date: '2026-10-01' }), AUJ, 30), 12);
  assert.equal(R.statutFacture(facture({ date: '2026-11-01' }), AUJ, 30), 'a-encaisser');
  assert.equal(R.statutFacture(facture({ date: '2026-11-01', paiements: [{ date: AUJ, montant: 200 }] }), AUJ, 30), 'partielle');
  assert.equal(R.statutFacture(facture({ date: '2026-09-01', paiements: [{ date: '2026-09-20', montant: 1200 }] }), AUJ, 30), 'payee');
  assert.equal(R.statutFacture(facture({ statut: 'annulee' }), AUJ), 'annulee');
  assert.equal(R.statutFacture(facture({ statut: 'brouillon', date: '2026-01-01' }), AUJ), 'brouillon');
  // L'échéance du jour même n'est pas encore en retard.
  assert.equal(R.statutFacture(facture({ date: '2026-10-13' }), AUJ, 30), 'a-encaisser');
});

test('devis : expiré si envoyé et validité dépassée ; à relancer après N jours', () => {
  const d = (o) => ({ type: 'devis', contactId: 'c1', ht: 100, tva: 20, statut: 'envoye', date: '2026-11-01', ...o });
  assert.equal(R.statutDevis(d({ validite: '2026-11-11' }), AUJ), 'expire');
  assert.equal(R.statutDevis(d({ validite: AUJ }), AUJ), 'envoye');
  assert.equal(R.statutDevis(d({ statut: 'accepte', validite: '2026-01-01' }), AUJ), 'accepte');
  const docs = [d({ id: 'a', date: '2026-11-05' }), d({ id: 'b', date: '2026-11-06' }), d({ id: 'c', date: '2026-10-01', validite: '2026-10-31' }), d({ id: 'e', statut: 'refuse', date: '2026-10-01' })];
  assert.deepEqual(R.devisARelancer(docs, AUJ, 7).map((x) => x.id), ['a']);
});

test('taux de transformation : acceptés / (acceptés + refusés)', () => {
  const docs = [
    { type: 'devis', statut: 'accepte', date: '2026-02-01' }, { type: 'devis', statut: 'accepte', date: '2026-03-01' },
    { type: 'devis', statut: 'refuse', date: '2026-04-01' }, { type: 'devis', statut: 'envoye', date: '2026-05-01' },
    { type: 'devis', statut: 'refuse', date: '2025-05-01' },
  ];
  assert.equal(R.tauxTransformation(docs, 2026), 67);
  assert.equal(R.tauxTransformation(docs), 50);
  assert.equal(R.tauxTransformation([], 2026), null);
});

test('statut de contact, actions dues et à venir, contacts actifs sans action', () => {
  const contacts = [
    { id: 'a', nom: 'Bernard', prochaine: { type: 'relance-devis', date: '2026-11-09' } },
    { id: 'b', nom: 'Alice', prochaine: { type: 'decouverte', date: AUJ } },
    { id: 'c', nom: 'Chloé', prochaine: { type: 'nouvelles', date: '2026-11-15' } },
    { id: 'd', nom: 'David', prochaine: null },
    { id: 'e', nom: 'Émile', prochaine: { date: '2026-11-01' }, archive: true },
    { id: 'f', nom: 'Fanny', prochaine: null },
  ];
  const projets = [{ contactId: 'd', etape: 'qualifie' }, { contactId: 'f', etape: 'gagne', avancement: 'termine' }, { contactId: 'c', etape: 'gagne', avancement: 'en-cours' }];
  const dues = R.actionsDues(contacts, AUJ);
  assert.deepEqual(dues.map((x) => [x.contact.id, x.retard]), [['a', 3], ['b', 0]]);
  assert.deepEqual(R.actionsAVenir(contacts, AUJ, 7).map((c) => c.id), ['c']);
  assert.deepEqual(R.sansAction(contacts, projets, B.etapes).map((c) => c.id), ['d']);
  assert.equal(R.statutContact(contacts[5], projets, []), 'client');
  assert.equal(R.statutContact(contacts[3], projets, []), 'prospect');
  assert.equal(R.statutContact(contacts[3], [], [facture({ contactId: 'd' })]), 'client');
  assert.equal(R.statutContact(contacts[3], [], [facture({ contactId: 'd', statut: 'annulee' })]), 'prospect');
  assert.equal(R.statutContact(contacts[4], [], []), 'archive');
});

test('prochaine action proposée depuis la base, étape suivante', () => {
  assert.deepEqual(R.proposerAction(B.actions, 'relance-devis', AUJ), { type: 'relance-devis', date: '2026-11-19', note: '' });
  assert.equal(R.suiteDe(B.actions, 'proposition'), 'relance-devis');
  assert.equal(R.proposerAction(B.actions, 'inconnue', AUJ), null);
  assert.equal(R.etapeSuivante(B.etapes, 'piste'), 'qualifie');
  assert.equal(R.etapeSuivante(B.etapes, 'negociation'), 'gagne');
  assert.equal(R.etapeSuivante(B.etapes, 'gagne'), null);
});

test('RGPD : prospect sans contact depuis 3 ans à revoir, client avec solde dû non', () => {
  const p = { id: 'p', creeLe: '2022-05-01' };
  const ctx = { echanges: [{ contactId: 'p', date: '2023-11-12' }], documents: [], projets: [], etapes: B.etapes };
  assert.equal(R.dateReference(p, ctx.echanges, [], []), '2023-11-12');
  assert.equal(R.aRevoirRGPD(p, ctx, AUJ, 3), true); // 12/11/2023 + 3 ans = aujourd'hui
  assert.equal(R.aRevoirRGPD(p, ctx, '2026-11-11', 3), false);
  assert.equal(R.aRevoirRGPD(p, ctx, AUJ, 5), false);
  // Client : la dernière facture compte, et un solde dû bloque le signalement.
  const c = { id: 'c', creeLe: '2020-01-01' };
  const f = facture({ contactId: 'c', date: '2023-01-10', paiements: [{ date: '2023-02-01', montant: 1200 }] });
  assert.equal(R.aRevoirRGPD(c, { echanges: [], documents: [f], projets: [], etapes: B.etapes }, AUJ, 3), true);
  assert.equal(R.aRevoirRGPD(c, { echanges: [], documents: [{ ...f, paiements: [] }], projets: [], etapes: B.etapes }, AUJ, 3), false);
  // Affaire ouverte : jamais à revoir.
  assert.equal(R.aRevoirRGPD(p, { ...ctx, projets: [{ contactId: 'p', etape: 'piste' }] }, AUJ, 3), false);
});

test('chiffre d\'affaires par mois (12 mois glissants) et par client', () => {
  const docs = [
    facture({ id: '1', contactId: 'a', date: '2026-10-05', ht: 1000, tva: 20, paiements: [{ date: '2026-11-02', montant: 1200 }] }),
    facture({ id: '2', contactId: 'b', date: '2026-11-03', ht: 500, tva: 0, paiements: [{ date: '2026-11-04', montant: 200 }] }),
    facture({ id: '3', contactId: 'a', date: '2025-11-30', ht: 300, tva: 20, paiements: [{ date: '2025-12-15', montant: 360 }] }),
    facture({ id: '4', contactId: 'a', date: '2026-11-01', ht: 999, statut: 'annulee' }),
    { id: '5', type: 'devis', contactId: 'a', date: '2026-11-01', ht: 5000, tva: 20, statut: 'accepte' },
  ];
  const m = R.caParMois(docs, '2026-11', 12);
  assert.equal(m.length, 12);
  assert.equal(m[0].mois, '2025-12');
  assert.deepEqual(m[0], { mois: '2025-12', facture: 0, encaisse: 300 }); // la facture de novembre 2025 est hors fenêtre, son encaissement non
  assert.deepEqual(m[10], { mois: '2026-10', facture: 1000, encaisse: 0 });
  assert.deepEqual(m[11], { mois: '2026-11', facture: 500, encaisse: 1200 }); // 1000 HT + 200 HT encaissés
  const c = R.caParClient(docs, [{ id: 'a', nom: 'Atelier' }, { id: 'b', nom: 'Bureau' }], 2026);
  assert.deepEqual(c.map((l) => [l.nom, l.facture, l.encaisse, l.reste, l.part]), [['Atelier', 1000, 1000, 0, 66.7], ['Bureau', 500, 200, 300, 33.3]]);
  const s = R.synthese(docs, AUJ, 30);
  assert.deepEqual(s, { encaisseMois: 1200, reste: 300, retard: 0, nbRetard: 0, nbAEncaisser: 1 });
});

test('pipeline par étape, montant ouvert', () => {
  const projets = [{ etape: 'piste', montant: 1000 }, { etape: 'proposition', montant: 2500.5 }, { etape: 'proposition', montant: 500 }, { etape: 'gagne', montant: 4000 }];
  const p = R.pipeline(projets, B.etapes);
  assert.deepEqual(p.find((x) => x.etape === 'proposition'), { etape: 'proposition', nombre: 2, montant: 3000.5 });
  assert.equal(R.montantOuvert(projets, B.etapes), 4000.5);
});

test('numéro suivant et facture depuis un devis', () => {
  const docs = [{ type: 'facture', numero: 'F-2026-009' }, { type: 'facture', numero: 'F-2025-031' }, { type: 'devis', numero: 'D-2026-002' }, { type: 'facture', numero: 'libre' }];
  assert.equal(R.numeroSuivant(docs, 'facture', 2026), 'F-2026-010');
  assert.equal(R.numeroSuivant(docs, 'devis', 2026), 'D-2026-003');
  assert.equal(R.numeroSuivant(docs, 'devis', 2027), 'D-2027-001');
  const f = R.factureDepuisDevis({ id: 'd1', contactId: 'c', projetId: 'p', objet: 'Site', ht: 2000, tva: 20 }, { id: 'f1', numero: 'F-2026-010', date: AUJ, delai: 30 });
  assert.deepEqual(f, { id: 'f1', type: 'facture', numero: 'F-2026-010', contactId: 'c', projetId: 'p', devisId: 'd1', date: AUJ, objet: 'Site', ht: 2000, tva: 20, delai: 30, statut: 'envoyee', paiements: [] });
});
