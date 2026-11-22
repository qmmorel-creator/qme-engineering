// Tests des règles métier de « CRM et prospection » (templates/crm/regles.js), fusion du CRM freelance et du
// Pipeline de prospection B2B (22/11/2026). Cas vérifiés à la main.
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../templates/crm/donnees.js');
await import('../../templates/crm/regles.js');
const B = globalThis.BASE;
const R = globalThis.CRM_REGLES;
const AUJ = '2026-11-12';

const facture = (o) => ({ id: o.id || 'f', type: 'facture', numero: 'F-2026-001', contactId: 'c1', date: '2026-10-01', ht: 1000, tva: 20, statut: 'envoyee', paiements: [], ...o });

test('base intégrée : étapes, actions types et repères sourcés, sans taux de TVA', () => {
  assert.deepEqual(B.etapes.map((e) => e.id), ['cible', 'contacte', 'echange', 'rdv', 'proposition', 'negociation', 'gagne', 'perdu']);
  assert.equal(B.actions.length, 15);
  const ids = new Set(B.actions.map((a) => a.id));
  for (const a of B.actions) assert.ok(ids.has(a.suite), `suite inconnue pour ${a.id}`);
  for (const e of B.etapes) assert.ok(ids.has(e.action), `action inconnue pour l'étape ${e.id}`);
  assert.equal(B.reperes.delaiPaiement.defaut, 30);
  assert.equal(B.reperes.conservation.ans, 3);
  assert.equal(B.reperes.consulteLe, '2026-11-12');
  for (const k of ['delaiPaiement', 'facturationElectronique', 'conservation', 'prospection', 'opposition']) assert.match(B.reperes[k].url, /^https:\/\/www\.|^https:\/\/entreprendre\./);
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
  const projets = [{ contactId: 'd', etape: 'rdv' }, { contactId: 'f', etape: 'gagne', avancement: 'termine' }, { contactId: 'c', etape: 'gagne', avancement: 'en-cours' }];
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
  assert.equal(R.etapeSuivante(B.etapes, 'cible'), 'contacte');
  assert.equal(R.etapeSuivante(B.etapes, 'rdv'), 'proposition');
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
  assert.equal(R.aRevoirRGPD(p, { ...ctx, projets: [{ contactId: 'p', etape: 'cible' }] }, AUJ, 3), false);
  // Un message envoyé sans réponse ne prolonge pas la conservation (CNIL : dernier contact venant de la personne).
  const envois = [{ contactId: 'p', date: '2023-11-12' }, { contactId: 'p', date: '2026-01-05', sens: 'envoye' }];
  assert.equal(R.dateReference(p, envois, [], []), '2023-11-12');
  assert.equal(R.dateReference(p, [...envois, { contactId: 'p', date: '2026-02-01', sens: 'recu' }], [], []), '2026-02-01');
  // Une personne opposée n'est plus signalée : elle reste dans la liste d'opposition.
  assert.equal(R.aRevoirRGPD({ ...p, oppose: '2024-01-01' }, ctx, AUJ, 3), false);
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
  const projets = [{ etape: 'cible', montant: 1000 }, { etape: 'proposition', montant: 2500.5 }, { etape: 'proposition', montant: 500 }, { etape: 'gagne', montant: 4000 }];
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

// ---------- Prospection (reprise du Pipeline de prospection B2B) ----------
const { cadences } = B;
const prospect = (o = {}) => ({ id: 'p1', nom: 'Camille Durand', entreprise: 'Atelier Exemple', fonction: 'Gérante', canal: 'email', creeLe: '2026-11-02',
  prochaine: null, archive: false, oppose: null, cadence: { id: 'premier', debut: '2026-11-02', pas: 0, dernier: null, reporteAu: null }, ...o });

test('base : 3 cadences et 15 à 20 scripts cohérents, canaux reliés aux types d\'échange', () => {
  assert.equal(cadences.length, 3);
  assert.ok(B.scripts.length >= 15 && B.scripts.length <= 20, `${B.scripts.length} scripts`);
  const ids = new Set(B.scripts.map((s) => s.id));
  assert.equal(ids.size, B.scripts.length, 'identifiants uniques');
  for (const c of cadences) for (const r of c.relances) {
    assert.ok(ids.has(r.script), `script ${r.script} de ${c.id}`);
    assert.ok(B.canaux.some((x) => x.id === r.canal), `canal ${r.canal}`);
  }
  for (const e of B.etapes) if (e.cadence && e.cadence !== 'garder') assert.ok(cadences.some((c) => c.id === e.cadence), e.id);
  for (const x of B.canaux) assert.ok(B.typesEchange.some((t) => t.id === x.echange), x.id);
  for (const s of B.scripts) {
    for (const [, v] of `${s.objet} ${s.texte}`.matchAll(/\{([^{}]+)\}/g)) assert.ok(B.variables.includes(v), `${s.id} : {${v}}`);
    assert.ok(!/%/.test(s.texte), `${s.id} sans pourcentage`);
    assert.ok(B.etapes.some((e) => e.id === s.etape), `${s.id} étape`);
  }
  for (const c of B.couleurs) assert.match(c.hex, /^#[0-9A-F]{6}$/);
  for (const e of B.etapes) assert.ok(B.couleurs.some((c) => c.id === e.couleur), `couleur de ${e.id}`);
});

test('cadence « Premier contact » : J0, +3, +4 depuis le message réel, puis terminée', () => {
  let c = prospect();
  assert.deepEqual(R.frise(cadences[0]).map((x) => x.jour), [0, 3, 7, 14, 28]);
  assert.equal(R.dateRelance(c, cadences), '2026-11-02');
  assert.equal(R.prochaineDe(c, cadences).type, 'relance-cadence');
  assert.equal(R.prochaineDe(c, cadences).relance.index, 0);
  c = R.enregistrerEnvoi(c, cadences, '2026-11-02');
  assert.equal(R.dateRelance(c, cadences), '2026-11-05');
  assert.equal(R.relanceCourante(c, cadences).canal, 'reseau');
  // Envoyé avec un jour de retard : la relance suivante part de la date réelle.
  c = R.enregistrerEnvoi(c, cadences, '2026-11-06');
  assert.equal(R.dateRelance(c, cadences), '2026-11-10');
  for (const d of ['2026-11-10', '2026-11-17', '2026-12-01']) c = R.enregistrerEnvoi(c, cadences, d);
  assert.equal(R.relanceCourante(c, cadences), null);
  assert.equal(R.cadenceTerminee(c, cadences), true);
  assert.equal(R.prochaineDe(c, cadences), null);
  // Rien de plus après la dernière relance.
  assert.deepEqual(R.enregistrerEnvoi(c, cadences, '2026-12-02'), c);
});

test('report d\'une relance, arrêt de cadence, action datée à la main', () => {
  let c = R.reporter(prospect(), cadences, '2026-11-09');
  assert.equal(R.dateRelance(c, cadences), '2026-11-09');
  // Un report plus tôt que la date calculée n'avance pas la relance.
  c = R.reporter(R.enregistrerEnvoi(prospect(), cadences, '2026-11-02'), cadences, '2026-11-03');
  assert.equal(R.dateRelance(c, cadences), '2026-11-05');
  // L'envoi efface le report.
  assert.equal(R.enregistrerEnvoi(R.reporter(prospect(), cadences, '2026-11-09'), cadences, '2026-11-09').cadence.reporteAu, null);
  const m = R.arreterCadence({ ...prospect(), prochaine: { type: 'decouverte', date: '2026-11-15', note: '' } });
  assert.equal(R.prochaineDe(m, cadences).type, 'decouverte');
  assert.equal(R.reporter(m, cadences, '2026-11-16').prochaine.date, '2026-11-16');
  assert.equal(R.prochaineDe({ ...m, archive: true }, cadences), null);
  assert.equal(R.cadenceTerminee(m, cadences), false);
  // Cadence supprimée depuis : considérée comme terminée, rien n'est perdu.
  assert.equal(R.cadenceTerminee(prospect({ cadence: { id: 'disparue', debut: '2026-11-02', pas: 0 } }), cadences), true);
});

test('les relances de cadence alimentent Aujourd\'hui, avec les actions datées', () => {
  const contacts = [
    prospect({ id: 'a', nom: 'Alice' }), // relance due le 2/11
    prospect({ id: 'b', nom: 'Bruno', cadence: null, prochaine: { type: 'decouverte', date: AUJ } }),
    prospect({ id: 'c', nom: 'Chloé', cadence: { id: 'premier', debut: '2026-11-14', pas: 0, dernier: null } }), // à venir
    prospect({ id: 'd', nom: 'David', oppose: '2026-11-03' }),
    prospect({ id: 'e', nom: 'Émile', cadence: { id: 'premier', debut: '2026-10-01', pas: 5, dernier: '2026-10-29' } }), // terminée
  ];
  const dues = R.actionsDues(contacts, AUJ, cadences);
  assert.deepEqual(dues.map((x) => [x.contact.id, x.retard, x.action.type]), [['a', 10, 'relance-cadence'], ['b', 0, 'decouverte']]);
  assert.deepEqual(R.actionsAVenir(contacts, AUJ, 7, cadences).map((c) => c.id), ['c']);
  const projets = [{ contactId: 'e', etape: 'contacte' }, { contactId: 'a', etape: 'cible' }];
  // Cadence terminée : listée à part, pas dans « sans prochaine action ».
  assert.deepEqual(R.sansAction(contacts, projets, B.etapes, cadences).map((c) => c.id), []);
  assert.deepEqual(contacts.filter((c) => R.cadenceTerminee(c, cadences)).map((c) => c.id), ['e']);
});

test('étapes : étape la plus avancée gardée, effets sur la cadence, anciennes étapes du CRM', () => {
  let p = { id: 'x', contactId: 'a', etape: 'cible', etapeMax: 0 };
  p = R.changerEtape(p, 'rdv', B.etapes, AUJ);
  assert.equal(p.etapeMax, 3);
  p = R.changerEtape(p, 'perdu', B.etapes, AUJ, 'Prix');
  assert.deepEqual([p.etape, p.etapeMax, p.motif, p.avancement], ['perdu', 3, 'Prix', null]);
  p = R.changerEtape(p, 'gagne', B.etapes, AUJ);
  assert.deepEqual([p.etapeMax, p.avancement, p.motif], [6, 'a-venir', '']);
  assert.equal(R.effetCadence(B.etapes, 'contacte'), 'garder');
  assert.deepEqual(R.effetCadence(B.etapes, 'proposition'), { demarrer: 'suivi' });
  for (const e of ['echange', 'rdv', 'negociation', 'gagne', 'perdu']) assert.equal(R.effetCadence(B.etapes, e), 'arreter', e);
  assert.equal(R.etapeActuelle('piste'), 'cible');
  assert.equal(R.etapeActuelle('qualifie'), 'rdv');
  assert.equal(R.rang(B.etapes, 'perdu'), -1);
});

test('données du CRM freelance d\'avant la fusion : lues sans perte, nouveaux champs ajoutés', () => {
  const ancien = {
    version: 1, nom: 'Camille', tutorielVu: true, majLe: 'v7', champInconnu: 42,
    reglages: { delaiPaiement: 45, tva: 0, relanceDevis: 10, conservationAns: 5 },
    contacts: [{ id: 'c1', nom: 'Hélène', entreprise: 'Atelier', email: 'h@exemple.fr', tel: '', origine: 'Recommandation', notes: 'Note', creeLe: '2026-01-01', prochaine: { type: 'decouverte', date: AUJ, note: '' }, archive: false }],
    echanges: [{ id: 'e1', contactId: 'c1', date: '2026-02-01', type: 'appel', resume: 'Premier appel' }],
    projets: [{ id: 'p1', contactId: 'c1', titre: 'Site', etape: 'qualifie', montant: 1200 }, { id: 'p2', contactId: 'c1', titre: 'Logo', etape: 'piste' },
      { id: 'p3', contactId: 'c1', titre: 'Plaquette', etape: 'gagne', avancement: 'en-cours' }, { id: 'p4', contactId: 'c1', titre: 'Flyers', etape: 'perdu', motif: 'Prix' }],
    documents: [{ id: 'f1', type: 'facture', contactId: 'c1', projetId: 'p3', date: '2026-03-01', ht: 1000, tva: 20, statut: 'envoyee' }],
  };
  const E = R.normaliser(structuredClone(ancien), B);
  assert.equal(E.version, 2);
  assert.equal(E.tutorielVu, true);
  assert.equal(E.champInconnu, 42);
  assert.equal(E.majLe, 'v7');
  assert.deepEqual(E.reglages, { delaiPaiement: 45, tva: 0, relanceDevis: 10, conservationAns: 5, monActivite: '', cadenceDefaut: 'premier' });
  assert.deepEqual(E.contacts[0], { fonction: '', canal: '', cadence: null, oppose: null, ...ancien.contacts[0] });
  assert.deepEqual(E.echanges, ancien.echanges);
  assert.deepEqual(E.projets.map((p) => [p.id, p.etape, p.etapeMax, p.titre]), [['p1', 'rdv', 3, 'Site'], ['p2', 'cible', 0, 'Logo'], ['p3', 'gagne', 6, 'Plaquette'], ['p4', 'perdu', 1, 'Flyers']]);
  assert.equal(E.projets[0].montant, 1200);
  assert.deepEqual(E.documents[0], { ...ancien.documents[0], paiements: [] });
  assert.equal(E.scripts.length, B.scripts.length);
  assert.equal(E.cadences.length, 3);
  // La prochaine action d'avant la fusion reste la prochaine action.
  assert.equal(R.prochaineDe(E.contacts[0], E.cadences).type, 'decouverte');
  // Les scripts et cadences modifiés sont gardés ; une liste de cadences vide est complétée.
  const perso = R.normaliser({ scripts: [{ id: 's', titre: 'Mien' }], cadences: [] }, B);
  assert.deepEqual(perso.scripts, [{ id: 's', titre: 'Mien' }]);
  assert.equal(perso.cadences.length, 3);
  // Données vides ou invalides : état vide, guide non vu.
  assert.equal(R.normaliser(null, B).tutorielVu, false);
  assert.equal(R.normaliser('x', B).contacts.length, 0);
  // La base n'est jamais modifiée par l'état d'un utilisateur.
  const v = R.etatVide(B); v.scripts[0].titre = 'changé';
  assert.notEqual(B.scripts[0].titre, 'changé');
});

test('copie du Pipeline de prospection B2B : prospects repris en contacts, échanges et affaires', () => {
  let n = 0;
  const copie = {
    version: 1, tutorielVu: true, reglages: { monPrenom: 'Alex', monActivite: 'j\'aide les PME', cadenceDefaut: 'douce', conservationMois: 24, delaiAction: 7 },
    scripts: [{ id: 'perso', titre: 'Mon script', etape: 'cible', canal: 'email', objet: '', texte: 'Bonjour {prénom}' }], cadences: B.cadences,
    prospects: [
      { id: 'p1', prenom: 'Claire', nom: 'Fontaine', organisation: 'Fonderie', fonction: 'Responsable', canal: 'email', source: 'Annuaire', coordonnee: 'c@exemple.fr', notes: 'Rappeler',
        etape: 'contacte', etapeMax: 1, creeLe: '2026-11-01', cadence: { id: 'premier', debut: '2026-11-01', pas: 1, dernier: '2026-11-01' }, action: null, reporteAu: '2026-11-08',
        historique: [{ date: '2026-11-01', type: 'envoi', canal: 'email', texte: 'Premier contact' }, { date: '2026-11-02', type: 'note', canal: 'email', texte: 'Vu sur un salon' }] },
      { id: 'p2', prenom: '', nom: '', organisation: 'Ateliers Réunis', fonction: '', canal: 'telephone', source: 'Salon local', etape: 'perdu', etapeMax: 3, motif: 'budget', creeLe: '2026-10-01', cadence: null, action: null,
        historique: [{ date: '2026-10-02', type: 'recu', canal: 'telephone', texte: 'Réponse' }, { date: '2026-10-10', type: 'etape', etape: 'perdu' }] },
      { id: 'p3', prenom: 'Lucie', nom: 'Fabre', organisation: 'Fabre', etape: 'contacte', etapeMax: 1, creeLe: '2026-10-01', oppose: '2026-10-15', cadence: null, historique: [] },
    ],
  };
  const E = R.depuisPipeline(copie, B, { id: () => `id${n++}`, aujourdhui: AUJ });
  assert.equal(E.nom, 'Alex');
  assert.equal(E.tutorielVu, true);
  assert.deepEqual([E.reglages.monActivite, E.reglages.cadenceDefaut, E.reglages.conservationAns], ['j\'aide les PME', 'douce', 2]);
  assert.equal(E.scripts[0].id, 'perso');
  const [a, b, c] = E.contacts;
  assert.deepEqual([a.nom, a.entreprise, a.fonction, a.canal, a.origine], ['Claire Fontaine', 'Fonderie', 'Responsable', 'email', 'Annuaire']);
  assert.match(a.notes, /Rappeler\nCoordonnée : c@exemple\.fr/);
  assert.deepEqual(a.cadence, { id: 'premier', debut: '2026-11-01', pas: 1, dernier: '2026-11-01', reporteAu: '2026-11-08' });
  assert.equal(R.dateRelance(a, E.cadences), '2026-11-08');
  assert.deepEqual([b.nom, b.origine], ['Ateliers Réunis', '']);
  assert.match(b.notes, /Source : Salon local/);
  assert.deepEqual([c.oppose, c.archive], ['2026-10-15', true]);
  assert.deepEqual(E.echanges.map((e) => [e.contactId, e.type, e.sens]), [['p1', 'email', 'envoye'], ['p1', 'autre', undefined], ['p2', 'appel', 'recu']]);
  assert.deepEqual(E.projets.map((p) => [p.contactId, p.titre, p.etape, p.etapeMax, p.motif]), [['p1', 'Premier contrat', 'contacte', 1, ''], ['p2', 'Premier contrat', 'perdu', 3, 'Prix'], ['p3', 'Premier contrat', 'contacte', 1, '']]);
  assert.equal(E.projets[1].maj, '2026-10-10');
  // Relu par la normalisation sans changement.
  assert.deepEqual(R.normaliser(structuredClone(E), B).projets, E.projets);
});

test('opposition : arrêt définitif, minimum gardé, doublon refusé', () => {
  const o = R.opposer(prospect({ email: 'c@exemple.fr', tel: '06', notes: 'x', prochaine: { type: 'decouverte', date: AUJ } }), AUJ);
  assert.deepEqual([o.oppose, o.archive, o.email, o.tel, o.notes, o.fonction, o.cadence, o.prochaine], [AUJ, true, '', '', '', '', null, null]);
  assert.deepEqual([o.nom, o.entreprise, o.creeLe], ['Camille Durand', 'Atelier Exemple', '2026-11-02']);
  assert.equal(R.prochaineDe(o, cadences), null);
  assert.equal(R.doublonOppose([o], { nom: 'camille  DURAND', entreprise: 'Atelier exemple' })?.id, 'p1');
  assert.equal(R.doublonOppose([o], { nom: 'Camille Durand', entreprise: 'Autre' }), null);
  assert.equal(R.doublonOppose([{ ...o, oppose: null }], { nom: 'Camille Durand', entreprise: 'Atelier Exemple' }), null);
  assert.equal(R.doublonOppose([o], { nom: '', entreprise: '' }), null);
});

test('scripts : variables remplies depuis la fiche, variable vide visible entre crochets', () => {
  const v = R.valeursScript(prospect({ nom: 'Jean-Marc  de la Tour' }), { monPrenom: 'Alex', monActivite: '' });
  assert.deepEqual(v, { prenom: 'Jean-Marc', nom: 'de la Tour', organisation: 'Atelier Exemple', fonction: 'Gérante', monPrenom: 'Alex', monActivite: '' });
  const r = R.remplirScript('Bonjour {prénom}, {Mon Prénom} : {mon activité}. {inconnue}', v);
  assert.equal(r.texte, 'Bonjour Jean-Marc, Alex : [mon activité]. {inconnue}');
  assert.deepEqual(r.manquantes, ['mon activité']);
  assert.deepEqual(R.lireLignes('Camille Durand ; Atelier ; Gérante\n\n  ; Société seule\nSam\tSociété\tDirecteur'), [
    { nom: 'Camille Durand', entreprise: 'Atelier', fonction: 'Gérante' }, { nom: '', entreprise: 'Société seule', fonction: '' }, { nom: 'Sam', entreprise: 'Société', fonction: 'Directeur' }]);
});

test('conversion : entonnoir, par canal, activité hebdomadaire, motifs de perte', () => {
  const projets = [
    { contactId: 'a', etape: 'contacte', etapeMax: 1, creeLe: '2026-11-01' },
    { contactId: 'b', etape: 'perdu', etapeMax: 3, creeLe: '2026-10-01', motif: 'Prix' },
    { contactId: 'c', etape: 'gagne', etapeMax: 6, creeLe: '2026-09-01' },
    { contactId: 'd', etape: 'cible', etapeMax: 0, creeLe: '2025-01-01' },
    { contactId: 'e', etape: 'perdu', etapeMax: 1, creeLe: '2026-10-05', motif: '' },
  ];
  const f = R.entonnoir(projets, B.etapes);
  assert.deepEqual(f.map((x) => x.atteint), [5, 4, 2, 2, 1, 1, 1]);
  assert.equal(f[1].passage, 0.5);
  assert.equal(f.at(-1).passage, null);
  assert.equal(f[6].depuisDebut, 0.2);
  assert.equal(R.dansPeriode(projets, '2026-10-01').length, 3);
  const contacts = [{ id: 'a', canal: 'email' }, { id: 'b', canal: 'email' }, { id: 'c', canal: 'reseau' }, { id: 'd', canal: '' }, { id: 'e', canal: 'email' }];
  const can = R.parCanal(projets, contacts, B.etapes, B.canaux);
  assert.deepEqual(can.map((c) => [c.id, c.total, c.contactes, c.reponses, c.rdv, c.gagnes]), [['email', 3, 3, 1, 1, 0], ['reseau', 1, 1, 1, 1, 1]]);
  assert.equal(can[0].tauxReponse, 1 / 3);
  assert.deepEqual(R.motifsPerte(projets), [{ motif: 'Autre', n: 1 }, { motif: 'Prix', n: 1 }]);
  assert.equal(R.lundi('2026-11-12'), '2026-11-09');
  assert.equal(R.lundi('2026-11-15'), '2026-11-09');
  const act = R.activite([
    { date: '2026-11-09', sens: 'envoye' }, { date: '2026-11-12', sens: 'recu' }, { date: '2026-11-12', type: 'rdv' },
    { date: '2026-11-02', sens: 'envoye' }, { date: '2026-09-01', sens: 'envoye' }, { date: '2026-11-13', sens: 'envoye' },
  ], AUJ, 8);
  assert.equal(act.length, 8);
  assert.equal(act[0].debut, '2026-09-21');
  assert.deepEqual(act.slice(-2).map((s) => [s.debut, s.envois, s.reponses]), [['2026-11-02', 1, 0], ['2026-11-09', 1, 1]]);
});
