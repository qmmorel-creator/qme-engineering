// Tests des règles métier du pipeline de prospection (templates/prospection/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/prospection/', import.meta.url);
globalThis.window = {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.PRS_REGLES;
const B = globalThis.window.BASE;
const { etapes, cadences, canaux } = B;

const nouveau = (o = {}) => ({ id: 'p1', prenom: 'Camille', nom: 'Durand', organisation: 'Atelier Exemple', fonction: 'Gérante',
  canal: 'email', etape: 'cible', etapeMax: 0, creeLe: '2026-11-02', cadence: { id: 'premier', debut: '2026-11-02', pas: 0, dernier: null },
  action: null, reporteAu: null, historique: [], ...o });

test('base intégrée : 7 étapes, 3 cadences, 15 à 20 scripts cohérents', () => {
  assert.equal(etapes.length, 7);
  assert.equal(cadences.length, 3);
  assert.ok(B.scripts.length >= 15 && B.scripts.length <= 20, `${B.scripts.length} scripts`);
  const ids = new Set(B.scripts.map((s) => s.id));
  assert.equal(ids.size, B.scripts.length, 'identifiants uniques');
  for (const c of cadences) for (const r of c.relances) {
    assert.ok(ids.has(r.script), `script ${r.script} de ${c.id}`);
    assert.ok(canaux.some((x) => x.id === r.canal), `canal ${r.canal}`);
  }
  for (const e of etapes) if (e.cadence && e.cadence !== 'garder') assert.ok(cadences.some((c) => c.id === e.cadence));
  // Toutes les variables des scripts sont connues ; aucun chiffre promis (pas de « % »).
  for (const s of B.scripts) {
    for (const [, v] of `${s.objet} ${s.texte}`.matchAll(/\{([^{}]+)\}/g)) assert.ok(B.variables.includes(v), `${s.id} : {${v}}`);
    assert.ok(!/%/.test(s.texte), `${s.id} sans pourcentage`);
    assert.ok(etapes.some((e) => e.id === s.etape), `${s.id} étape`);
  }
  assert.equal(B.rgpd.conservationMois, 36);
});

test('dates : jours, mois (fin de mois, bissextile), lundi', () => {
  assert.equal(R.plusJours('2026-10-30', 3), '2026-11-02');
  assert.equal(R.plusJours('2026-03-28', 2), '2026-03-30'); // changement d'heure sans effet
  assert.equal(R.plusMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.plusMois('2024-01-31', 1), '2024-02-29');
  assert.equal(R.plusMois('2023-11-12', 36), '2026-11-12');
  assert.equal(R.lundi('2026-11-12'), '2026-11-09'); // jeudi
  assert.equal(R.lundi('2026-11-15'), '2026-11-09'); // dimanche
  assert.equal(R.lundi('2026-11-09'), '2026-11-09');
});

test('cadence « Premier contact » : J0, +3, +4 depuis le message réel, puis terminée', () => {
  let p = nouveau();
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-02');
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-11-02', canal: 'email' });
  assert.equal(p.etape, 'contacte');
  assert.equal(p.etapeMax, 1);
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-05');
  assert.equal(R.relanceCourante(p, cadences).canal, 'reseau');
  // Envoyé avec un jour de retard : la relance suivante part de la date réelle.
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-11-06' });
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-10');
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-11-10' }); // → +7
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-17');
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-11-17' }); // → +14
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-12-01');
  assert.equal(R.cadenceTerminee(p, cadences, etapes), false);
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-12-01' });
  assert.equal(R.prochaineRelance(p, cadences, etapes), null);
  assert.equal(R.cadenceTerminee(p, cadences, etapes), true);
  assert.equal(p.historique.filter((h) => h.type === 'envoi').length, 5);
});

test('reporter : décale seulement vers plus tard, remis à zéro par un envoi', () => {
  const base = R.enregistrerEnvoi(nouveau(), cadences, etapes, { date: '2026-11-02' }); // prochaine 11-05
  assert.equal(R.prochaineRelance({ ...base, reporteAu: '2026-11-08' }, cadences, etapes), '2026-11-08');
  assert.equal(R.prochaineRelance({ ...base, reporteAu: '2026-11-03' }, cadences, etapes), '2026-11-05');
  const apres = R.enregistrerEnvoi({ ...base, reporteAu: '2026-11-08' }, cadences, etapes, { date: '2026-11-08' });
  assert.equal(apres.reporteAu, null);
  assert.equal(R.prochaineRelance(apres, cadences, etapes), '2026-11-12');
});

test('changement d\'étape : proposition démarre le suivi, rendez-vous date une action, gagné arrête', () => {
  let p = R.changerEtape(nouveau({ etape: 'rdv', etapeMax: 3, cadence: null, action: '2026-11-12' }), 'proposition', etapes, { date: '2026-11-12' });
  assert.deepEqual(p.cadence, { id: 'suivi', debut: '2026-11-12', pas: 0, dernier: null });
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-15');
  p = R.enregistrerEnvoi(p, cadences, etapes, { date: '2026-11-15' });
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-19');
  assert.equal(p.etapeMax, 4);

  const rdv = R.changerEtape(nouveau({ etape: 'echange', etapeMax: 2, cadence: null }), 'rdv', etapes, { date: '2026-11-12' });
  assert.equal(rdv.cadence, null);
  assert.equal(R.prochaineRelance(rdv, cadences, etapes), '2026-11-19');
  const rdv2 = R.changerEtape(nouveau({ etape: 'echange', etapeMax: 2, cadence: null }), 'rdv', etapes, { date: '2026-11-12', action: '2026-11-20' });
  assert.equal(R.prochaineRelance(rdv2, cadences, etapes), '2026-11-20');
  // En échange / rendez-vous sans cadence : un message envoyé redonne une action à +7 jours.
  assert.equal(R.enregistrerEnvoi(rdv2, cadences, etapes, { date: '2026-11-13' }).action, '2026-11-20');

  const g = R.changerEtape(p, 'gagne', etapes, { date: '2026-11-20' });
  assert.equal(g.etapeMax, 5);
  assert.equal(R.prochaineRelance(g, cadences, etapes), null);
  assert.equal(R.cadenceTerminee(g, cadences, etapes), false);
});

test('perdu garde l\'étape la plus avancée et le motif ; recontacter relance une cadence', () => {
  const perdu = R.changerEtape(nouveau({ etape: 'rdv', etapeMax: 3, cadence: null }), 'perdu', etapes, { date: '2026-11-12', motif: 'pas-moment' });
  assert.equal(perdu.etapeMax, 3);
  assert.equal(perdu.motif, 'pas-moment');
  assert.equal(R.prochaineRelance(perdu, cadences, etapes), null);
  const re = R.recontacter(perdu, etapes, 'douce', '2027-02-01');
  assert.equal(re.etape, 'contacte');
  assert.equal(re.motif, null);
  assert.equal(R.prochaineRelance(re, cadences, etapes), '2027-02-01');
  // Retour en arrière vers « Contacté » sans cadence : la cadence par défaut redémarre.
  const arriere = R.changerEtape(nouveau({ etape: 'echange', etapeMax: 2, cadence: null }), 'contacte', etapes, { date: '2026-11-12', cadenceDefaut: 'douce' });
  assert.equal(arriere.cadence.id, 'douce');
  assert.equal(arriere.etapeMax, 2);
});

test('réponse reçue : passe « En échange » avec une action à +2 jours', () => {
  const p0 = R.enregistrerEnvoi(nouveau(), cadences, etapes, { date: '2026-11-02' });
  const p = R.enregistrerReponse(p0, etapes, { date: '2026-11-04', canal: 'email' });
  assert.equal(p.etape, 'echange');
  assert.equal(p.etapeMax, 2);
  assert.equal(p.cadence, null);
  assert.equal(R.prochaineRelance(p, cadences, etapes), '2026-11-06');
  assert.equal(R.dateReference(p), '2026-11-04');
  // Déjà en rendez-vous : l'étape ne change pas, l'action est redatée.
  const r = R.enregistrerReponse(nouveau({ etape: 'rdv', etapeMax: 3, cadence: null, action: '2026-11-30' }), etapes, { date: '2026-11-12' });
  assert.equal(r.etape, 'rdv');
  assert.equal(r.action, '2026-11-14');
});

test('opposition : arrêt définitif, données réduites, doublon détecté sans accents ni casse', () => {
  const p = R.opposer(nouveau({ coordonnee: 'camille@example.com', notes: 'note', historique: [{ date: '2026-11-02', type: 'envoi' }] }), '2026-11-05');
  assert.equal(p.oppose, '2026-11-05');
  assert.equal(p.coordonnee, '');
  assert.equal(p.notes, '');
  assert.deepEqual(p.historique, []);
  assert.equal(R.prochaineRelance(p, cadences, etapes), null);
  assert.equal(R.changerEtape(p, 'echange', etapes, { date: '2026-11-06' }).etape, 'cible');
  assert.ok(R.doublonOppose([p], { prenom: 'CAMILLE', nom: 'durand', organisation: 'Atélier exemple' }));
  assert.equal(R.doublonOppose([p], { prenom: 'Camille', nom: 'Durand', organisation: 'Autre' }), null);
  assert.equal(R.doublonOppose([p], { prenom: '', nom: '', organisation: '' }), null);
});

test('scripts : variables remplies, variable vide visible entre crochets', () => {
  const v = { prenom: 'Camille', nom: 'Durand', organisation: 'Atelier Exemple', fonction: '', monPrenom: 'Alex', monActivite: 'j’aide les ateliers à planifier' };
  const r = R.remplirScript('Bonjour {prénom}, {Organisation} ; {fonction} ; {mon prénom} ; {inconnue}', v);
  assert.equal(r.texte, 'Bonjour Camille, Atelier Exemple ; [fonction] ; Alex ; {inconnue}');
  assert.deepEqual(r.manquantes, ['fonction']);
  const s = B.scripts.find((x) => x.id === 'premier-email');
  const plein = R.remplirScript(s.texte, { ...v, fonction: 'gérante' });
  assert.deepEqual(plein.manquantes, []);
  assert.ok(!/[{}]/.test(plein.texte));
});

test('à relancer : dues et en retard, triées, avec le retard en jours ; à venir sur 7 jours', () => {
  const a = R.enregistrerEnvoi(nouveau({ id: 'a' }), cadences, etapes, { date: '2026-11-02' }); // due 11-05
  const b = nouveau({ id: 'b', creeLe: '2026-11-12', cadence: { id: 'premier', debut: '2026-11-12', pas: 0, dernier: null } }); // due 11-12
  const c = nouveau({ id: 'c', cadence: null, etape: 'rdv', etapeMax: 3, action: '2026-11-15' });
  const d = nouveau({ id: 'd', etape: 'gagne', etapeMax: 5, cadence: null });
  const l = R.aRelancer([b, c, d, a], cadences, etapes, '2026-11-12');
  assert.deepEqual(l.map((x) => [x.p.id, x.retard]), [['a', 7], ['b', 0]]);
  assert.deepEqual(R.aVenir([a, b, c, d], cadences, etapes, '2026-11-12').map((x) => x.p.id), ['c']);
});

test('RGPD : à revoir 36 mois après la création ou le dernier message reçu', () => {
  const vieux = nouveau({ creeLe: '2023-11-12', etape: 'perdu' });
  assert.equal(R.aRevoirRgpd(vieux, '2026-11-12'), true);
  assert.equal(R.aRevoirRgpd({ ...vieux, creeLe: '2023-11-13' }, '2026-11-12'), false);
  assert.equal(R.aRevoirRgpd({ ...vieux, historique: [{ date: '2025-01-01', type: 'recu' }] }, '2026-11-12'), false);
  assert.equal(R.aRevoirRgpd({ ...vieux, historique: [{ date: '2025-01-01', type: 'envoi' }] }, '2026-11-12'), true);
  assert.equal(R.aRevoirRgpd({ ...vieux, etape: 'gagne' }, '2026-11-12'), false);
  assert.equal(R.aRevoirRgpd(vieux, '2026-11-12', 48), false);
});

test('entonnoir et taux par canal', () => {
  const P = [
    { canal: 'email', etapeMax: 0 }, { canal: 'email', etapeMax: 1 }, { canal: 'email', etapeMax: 1 }, { canal: 'email', etapeMax: 2 },
    { canal: 'reseau', etapeMax: 1 }, { canal: 'reseau', etapeMax: 3 }, { canal: 'reseau', etapeMax: 5 },
    { canal: 'telephone', etapeMax: 4, etape: 'perdu' },
  ];
  const f = R.entonnoir(P, etapes);
  assert.deepEqual(f.map((x) => x.atteint), [8, 7, 4, 3, 2, 1]);
  assert.equal(f[1].passage, 4 / 7);
  assert.equal(f[5].passage, null);
  assert.equal(f[5].depuisDebut, 1 / 8);
  const c = R.parCanal(P, etapes, canaux);
  assert.deepEqual(c.map((x) => x.id), ['email', 'reseau', 'telephone']);
  const email = c[0];
  assert.deepEqual([email.total, email.contactes, email.reponses, email.rdv, email.gagnes], [4, 3, 1, 0, 0]);
  assert.equal(email.tauxReponse, 1 / 3);
  assert.equal(c[1].tauxGain, 1 / 3);
  assert.equal(R.parCanal([{ canal: 'email', etapeMax: 0 }], etapes, canaux)[0].tauxReponse, null);
  assert.equal(R.dansPeriode([{ creeLe: '2026-10-01' }, { creeLe: '2026-11-01' }], '2026-10-15').length, 1);
});

test('activité par semaine (lundi au dimanche)', () => {
  const p = { historique: [
    { date: '2026-11-09', type: 'envoi' }, { date: '2026-11-12', type: 'envoi' }, { date: '2026-11-12', type: 'recu' },
    { date: '2026-11-08', type: 'envoi' }, { date: '2026-09-21', type: 'envoi' }, { date: '2026-09-20', type: 'envoi' },
    { date: '2026-11-10', type: 'etape' },
  ] };
  const a = R.activite([p], '2026-11-12', 8);
  assert.equal(a.length, 8);
  assert.equal(a[0].debut, '2026-09-21');
  assert.deepEqual([a[0].envois, a[6].envois, a[7].envois, a[7].reponses], [1, 1, 2, 1]);
  assert.equal(a.reduce((s, x) => s + x.envois, 0), 4);
});

test('saisie groupée « Prénom Nom ; Organisation ; Fonction »', () => {
  assert.deepEqual(R.lireLignes('Camille Durand ; Atelier Exemple ; Gérante\n\n ; Société Seule\nJean Paul Martin'), [
    { prenom: 'Camille', nom: 'Durand', organisation: 'Atelier Exemple', fonction: 'Gérante' },
    { prenom: '', nom: '', organisation: 'Société Seule', fonction: '' },
    { prenom: 'Jean', nom: 'Paul Martin', organisation: '', fonction: '' },
  ]);
});
