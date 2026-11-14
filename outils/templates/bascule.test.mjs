// Tests des règles métier du pilotage de bascule (templates/bascule/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/bascule/', import.meta.url);
const ctx = { window: {}, TextEncoder };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.BSC;
const B = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const M = (dh) => R.versMin(dh);

// Bascule de nuit : 22:00 → fenêtre jusqu'à 04:00. A (30) → B (60) → C go (10) ; repli X (20) → Y (40).
function exemple(extra = {}) {
  const e = R.etatVide(B);
  const b = R.normaliserBascule({ id: 'b1', nom: 'Essai', debut: '2026-11-14T22:00', finFenetre: '2026-11-15T04:00', ...extra });
  e.bascules.push(b);
  const et = (id, ordre, x) => e.etapes.push(R.normaliserEtape({ id, basculeId: 'b1', ordre, ...x }));
  et('A', 10, { titre: 'Arrêt', phase: 'arret', duree: 30 });
  et('B', 20, { titre: 'Migration', phase: 'bascule', duree: 60 });
  et('C', 30, { titre: 'Go final', phase: 'controle', duree: 10, type: 'go', criteres: [{ texte: 'Recette', ok: true }, { texte: 'Volumes', ok: false }] });
  et('X', 40, { titre: 'Annonce', phase: 'repli', duree: 20 });
  et('Y', 50, { titre: 'Restauration', phase: 'repli', duree: 40 });
  return e;
}
const maj = (e, id, x) => { const i = e.etapes.findIndex((y) => y.id === id); e.etapes[i] = R.normaliserEtape({ ...e.etapes[i], ...x }); };

test('heures : aller-retour en minutes, passage de minuit, textes', () => {
  assert.ok(R.estDH('2026-11-14T22:05'));
  assert.ok(!R.estDH('2026-11-14T24:00'));
  assert.ok(!R.estDH('2026-02-30T10:00'));
  assert.equal(R.depuisMin(M('2026-11-14T23:50') + 20), '2026-11-15T00:10');
  assert.equal(R.heure(M('2026-12-31T23:59') + 2), '00:01');
  assert.equal(R.dureeTexte(45), '45 min');
  assert.equal(R.dureeTexte(65), '1 h 05');
  assert.equal(R.dureeTexte(120), '2 h');
  assert.equal(R.dureeTexte(-25), '−25 min');
  assert.equal(R.ecartTexte(0), 'à l\'heure');
  assert.equal(R.ecartTexte(25), '+25 min');
});

test('saisie : durées et heure rattachée au bon jour', () => {
  assert.equal(R.lireDuree('45'), 45);
  assert.equal(R.lireDuree('45 min'), 45);
  assert.equal(R.lireDuree('1h30'), 90);
  assert.equal(R.lireDuree('1:05'), 65);
  assert.equal(R.lireDuree('2 h'), 120);
  assert.equal(R.lireDuree('1h75'), null);
  assert.equal(R.lireDuree('abc'), null);
  assert.equal(R.lireDuree(''), null);
  // 01:10 saisi après 23:40 : le lendemain ; 23:30 saisi à 00:20 : la veille.
  assert.equal(R.heureVersDH('01:10', '2026-11-14T23:40'), '2026-11-15T01:10');
  assert.equal(R.heureVersDH('23:30', '2026-11-15T00:20'), '2026-11-14T23:30');
  assert.equal(R.heureVersDH('10:00', '2026-11-14T09:00'), '2026-11-14T10:00');
  assert.equal(R.heureVersDH('25:00', '2026-11-14T09:00'), null);
});

test('déroulé prévu : enchaînement par défaut, plan de repli à part', () => {
  const e = exemple();
  const s = R.synthese(e, e.bascules[0], M('2026-11-14T18:00'));
  assert.equal(s.statut, 'preparation');
  assert.equal(R.depuisMin(s.prevu.B.debut), '2026-11-14T22:30');
  assert.equal(R.depuisMin(s.prevuFin), '2026-11-14T23:40');
  assert.equal(s.retard, 0);
  assert.equal(s.dureeRepli, 60);
  // Limite de retour arrière = fin de fenêtre − durée du repli.
  assert.equal(R.depuisMin(s.limite), '2026-11-15T03:00');
  assert.equal(R.depuisMin(s.prevu.Y.fin), '2026-11-15T04:00');
  assert.equal(s.marge, M('2026-11-15T04:00') - M('2026-11-14T23:40'));
  // Limite fixée à la main : elle prime.
  const e2 = exemple({ limiteRetour: '2026-11-15T01:30' });
  assert.equal(R.depuisMin(R.synthese(e2, e2.bascules[0], M('2026-11-14T18:00')).limite), '2026-11-15T01:30');
});

test('dépendances : parallèle, « pas avant », boucle refusée', () => {
  const e = exemple();
  // C après A seulement : B et C se déroulent en parallèle.
  maj(e, 'C', { apres: ['A'] });
  let s = R.synthese(e, e.bascules[0], M('2026-11-14T18:00'));
  assert.equal(R.heure(s.prevu.C.debut), '22:30');
  assert.equal(R.heure(s.prevuFin), '23:30'); // fin de B
  // [] : démarre au début de la bascule ; pas avant : heure plancher.
  maj(e, 'B', { apres: [], pasAvant: '2026-11-14T22:15' });
  s = R.synthese(e, e.bascules[0], M('2026-11-14T18:00'));
  assert.equal(R.heure(s.prevu.B.debut), '22:15');
  // A après C alors que C est après A : boucle.
  assert.equal(R.creeCycle(e.etapes, 'A', ['C']), true);
  assert.equal(R.creeCycle(e.etapes, 'B', ['A']), false);
  // Une boucle déjà enregistrée ne bloque pas le calcul.
  maj(e, 'A', { apres: ['C'] });
  assert.doesNotThrow(() => R.synthese(e, e.bascules[0], M('2026-11-14T18:00')));
});

test('suppression d\'une étape : ses suivantes héritent de ses prédécesseurs', () => {
  const e = exemple();
  maj(e, 'C', { apres: ['B'] });
  const l = R.retirerEtape(e.etapes, 'B');
  assert.deepEqual(simple(l.find((x) => x.id === 'C').apres), ['A']);
  assert.equal(l.length, 4);
});

test('estimation en direct : le retard réel se reporte sur la suite', () => {
  const e = exemple();
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:05', finReel: '2026-11-14T22:50' }); // +20 min
  maj(e, 'B', { statut: 'en-cours', debutReel: '2026-11-14T22:50' });
  const now = M('2026-11-14T23:10');
  const s = R.synthese(e, e.bascules[0], now);
  assert.equal(s.statut, 'en-cours');
  assert.equal(R.heure(s.estime.B.fin), '23:50');
  assert.equal(R.heure(s.estimeFin), '00:00');
  assert.equal(s.retard, 20);
  assert.equal(s.retardEtape('A'), 20);
  assert.equal(s.prochaineDecision.id, 'C');
  assert.equal(s.avancement.faites, 1);
  assert.equal(s.avancement.total, 3);
  // B dépasse sa durée : la fin estimée suit l'heure actuelle.
  const tard = R.synthese(e, e.bascules[0], M('2026-11-15T00:20'));
  assert.equal(R.heure(tard.estime.B.fin), '00:20');
  assert.equal(R.heure(tard.estimeFin), '00:30');
  assert.ok(tard.alertes.some((a) => a.type === 'depassement' && a.etapeId === 'B'));
});

test('estimation : rien ne démarre avant maintenant, étape sautée sans durée', () => {
  const e = exemple();
  // 22:20 et rien n'a commencé : la bascule a 20 min de retard au départ.
  let s = R.synthese(e, e.bascules[0], M('2026-11-14T22:20'));
  assert.equal(s.statut, 'en-cours');
  assert.equal(s.retard, 20);
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-14T22:30' });
  maj(e, 'B', { statut: 'saute' });
  s = R.synthese(e, e.bascules[0], M('2026-11-14T22:30'));
  assert.equal(R.heure(s.estime.C.debut), '22:30');
  assert.equal(s.retard, -60);
});

test('alertes : bloqué, incident, fenêtre dépassée, critères, limite de retour', () => {
  const e = exemple();
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-15T01:00' });
  maj(e, 'B', { statut: 'bloque', note: 'Erreur à l\'import' });
  e.incidents.push(R.normaliserIncident({ id: 'i1', basculeId: 'b1', heure: '2026-11-15T01:05', gravite: 'bloquant', titre: 'Import refusé', etapeId: 'B' }));
  e.incidents.push(R.normaliserIncident({ id: 'i2', basculeId: 'b1', heure: '2026-11-15T01:06', gravite: 'majeur', titre: 'Lenteurs', resolu: true }));
  const s = R.synthese(e, e.bascules[0], M('2026-11-15T02:40'));
  const types = s.alertes.map((a) => a.type);
  assert.ok(types.includes('bloque'));
  assert.ok(types.includes('incident'));
  assert.ok(!s.alertes.some((a) => a.texte.includes('Lenteurs'))); // incident résolu : pas d'alerte
  assert.ok(types.includes('limite')); // 20 min avant 03:00
  assert.equal(s.alertes[0].niveau, 'rouge');
  // Fenêtre : B (60) + C (10) à partir de 02:40 → 03:50, avant 04:00 ; à 03:00 → 04:10, après.
  const s2 = R.synthese(e, e.bascules[0], M('2026-11-15T03:00'));
  assert.ok(s2.alertes.some((a) => a.type === 'fenetre'));
  // Critères non cochés à l'approche du go/no-go.
  maj(e, 'B', { statut: 'fait', debutReel: '2026-11-15T01:00', finReel: '2026-11-15T02:00' });
  const s3 = R.synthese(e, e.bascules[0], M('2026-11-15T02:05'));
  assert.ok(s3.alertes.some((a) => a.type === 'criteres'));
  assert.deepEqual(simple(R.etatCriteres(e.etapes.find((x) => x.id === 'C'))), { ok: 1, total: 2, tous: false });
});

test('préparation : étapes sans responsable, go/no-go sans critère, sans repli', () => {
  const e = exemple();
  maj(e, 'C', { criteres: [] });
  e.etapes = e.etapes.filter((x) => x.phase !== 'repli');
  const s = R.synthese(e, e.bascules[0], M('2026-11-14T12:00'));
  const types = s.alertes.map((a) => a.type);
  assert.ok(types.includes('responsable'));
  assert.ok(types.includes('go-vide'));
  assert.ok(types.includes('sans-repli'));
  assert.equal(s.limite, null);
});

test('retour arrière lancé : le plan de repli devient le déroulé courant', () => {
  const e = exemple({ repliLance: '2026-11-15T01:00' });
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-14T22:30' });
  maj(e, 'C', { statut: 'fait', decision: 'nogo', finReel: '2026-11-15T00:55' });
  maj(e, 'X', { statut: 'fait', debutReel: '2026-11-15T01:00', finReel: '2026-11-15T01:15' });
  const s = R.synthese(e, e.bascules[0], M('2026-11-15T01:20'));
  assert.equal(s.statut, 'repli');
  assert.equal(s.retard, null);
  assert.equal(s.courant.length, 2);
  assert.equal(R.heure(s.estimeFin), '02:00');
  assert.equal(s.prochaineDecision, null);
  maj(e, 'Y', { statut: 'fait', debutReel: '2026-11-15T01:20', finReel: '2026-11-15T02:05' });
  assert.equal(R.synthese(e, e.bascules[0], M('2026-11-15T02:10')).statut, 'revenue');
});

test('bascule terminée, chronologie et bilan', () => {
  const e = exemple();
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-14T22:40' });
  maj(e, 'B', { statut: 'fait', debutReel: '2026-11-14T22:40', finReel: '2026-11-14T23:30' });
  maj(e, 'C', { statut: 'fait', decision: 'go', debutReel: '2026-11-14T23:30', finReel: '2026-11-14T23:38', commentaire: 'unanime' });
  e.incidents.push(R.normaliserIncident({ id: 'i1', basculeId: 'b1', heure: '2026-11-14T22:20', gravite: 'mineur', titre: 'Badge refusé', resolu: true, heureResolution: '2026-11-14T22:25' }));
  const s = R.synthese(e, e.bascules[0], M('2026-11-15T09:00'));
  assert.equal(s.statut, 'terminee');
  assert.equal(R.heure(s.estimeFin), '23:38');
  assert.equal(s.retard, -2);
  assert.equal(s.alertes.length, 0);
  const ch = R.chronologie(e, 'b1');
  assert.equal(ch[0].texte, 'Début : Arrêt');
  assert.ok(ch.some((x) => x.type === 'decision' && x.texte.includes('GO (unanime)')));
  assert.ok(ch.some((x) => x.type === 'resolution'));
  const bl = R.bilan(e, s);
  assert.equal(bl.ecarts[0].etape.id, 'A'); // 40 min au lieu de 30
  assert.equal(bl.ecarts[0].ecart, 10);
  assert.equal(bl.depassees.length, 1);
  assert.equal(bl.incidents.total, 1);
});

test('point de situation : texte à copier', () => {
  const e = exemple();
  e.membres.push(R.normaliserMembre({ id: 'm1', basculeId: 'b1', nom: 'Camille', role: 'Responsable technique' }));
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-14T22:45', responsable: 'm1' });
  maj(e, 'B', { statut: 'en-cours', debutReel: '2026-11-14T22:45', responsable: 'm1' });
  e.incidents.push(R.normaliserIncident({ basculeId: 'b1', heure: '2026-11-14T22:30', gravite: 'majeur', titre: 'Sauvegarde lente', action: 'Compression désactivée' }));
  const t = R.pointSituation(e, R.synthese(e, e.bascules[0], M('2026-11-14T23:00')));
  assert.match(t, /^POINT DE SITUATION · Essai/);
  assert.match(t, /Avancement : 1\/3 étapes \(33 %\)/);
  assert.match(t, /Retard cumulé : \+15 min · fin estimée 23:55/);
  assert.match(t, /- Migration \(Camille\), depuis 22:45/);
  assert.match(t, /Prochaine décision : Go final vers 23:45 · critères 1\/2/);
  assert.match(t, /\[majeur\] Sauvegarde lente · action : Compression désactivée/);
});

test('modèles : intègres, instanciables, dans leur fenêtre', () => {
  const codes = new Set();
  for (const m of B.modeles) {
    assert.ok(!codes.has(m.code)); codes.add(m.code);
    for (const [i, x] of m.etapes.entries()) {
      assert.ok(B.phases.some((p) => p.code === x.p), `${m.code} ${i} phase`);
      assert.ok(!x.r || B.roles.some((r) => r.code === x.r), `${m.code} ${i} rôle`);
      for (const k of x.apres || []) assert.ok(k < i && (m.etapes[k].p === 'repli') === (x.p === 'repli'), `${m.code} ${i} dépendance`);
      if (x.type === 'go') assert.ok(x.c.length >= 3, `${m.code} ${i} critères`);
    }
    const debut = `2026-11-20T${m.debut}`;
    const fin = R.depuisMin(M(debut) + m.fenetreHeures * 60);
    const { bascule, etapes, membres } = R.depuisModele(B, m.code, { nom: m.court, debut, finFenetre: fin });
    const e = R.etatVide(B);
    e.bascules.push(bascule); e.etapes.push(...etapes); e.membres.push(...membres);
    const s = R.synthese(e, bascule, M('2026-11-19T12:00'));
    if (m.code !== 'VIDE') {
      assert.ok(s.prevuFin <= s.fenetre, `${m.code} tient dans sa fenêtre`);
      assert.ok(s.repli.length >= 3 && s.limite > s.debut, `${m.code} plan de repli`);
      assert.ok(etapes.every((x) => x.responsable), `${m.code} responsables`);
      assert.ok(s.principal.some((x) => x.type === 'go'));
    }
  }
  assert.ok(B.modeles.length >= 5);
  // Le texte des modèles ne cite aucune marque : contrôle grossier sur quelques mots.
  assert.ok(!/®|™/.test(JSON.stringify(B)));
});

test('duplication : statuts remis à zéro, horaires décalés, durées réelles reprises', () => {
  const e = exemple({ limiteRetour: '2026-11-15T02:00' });
  e.membres.push(R.normaliserMembre({ id: 'm1', basculeId: 'b1', nom: 'Camille', role: 'Technique' }));
  maj(e, 'A', { statut: 'fait', debutReel: '2026-11-14T22:00', finReel: '2026-11-14T22:50', responsable: 'm1' });
  maj(e, 'C', { apres: ['A'], decision: 'go', statut: 'fait', criteres: [{ texte: 'Recette', ok: true }], pasAvant: '2026-11-14T23:00' });
  const d = R.dupliquer(e, 'b1', { nom: 'Répétition 2', debut: '2026-11-21T22:00', dureesReelles: true });
  assert.equal(d.bascule.finFenetre, '2026-11-22T04:00');
  assert.equal(d.bascule.limiteRetour, '2026-11-22T02:00');
  assert.equal(d.etapes.length, 5);
  const a = d.etapes.find((x) => x.titre === 'Arrêt');
  const c = d.etapes.find((x) => x.titre === 'Go final');
  assert.equal(a.duree, 50);
  assert.equal(a.statut, 'a-faire');
  assert.equal(a.debutReel, '');
  assert.equal(a.responsable, d.membres[0].id);
  assert.deepEqual(simple(c.apres), [a.id]);
  assert.equal(c.decision, '');
  assert.equal(c.criteres[0].ok, false);
  assert.equal(c.pasAvant, '2026-11-21T23:00');
});

test('normalisation tolérante, suppressions, CSV', () => {
  const v = R.normaliser({ bascules: [{ nom: 'X', debut: 'n\'importe quoi' }], etapes: [{ statut: 'inconnu', duree: -5, type: 'bizarre' }], reglages: { alerteMinutes: 'abc' } }, B);
  assert.equal(v.bascules[0].debut, '2026-01-01T20:00');
  assert.equal(v.etapes[0].statut, 'a-faire');
  assert.equal(v.etapes[0].duree, 0);
  assert.equal(v.etapes[0].type, 'action');
  assert.equal(v.reglages.alerteMinutes, 15);
  assert.equal(R.normaliser(null, B).bascules.length, 0);
  const e = exemple();
  e.membres.push(R.normaliserMembre({ id: 'm1', basculeId: 'b1', nom: 'Camille' }));
  maj(e, 'A', { responsable: 'm1' });
  e.incidents.push(R.normaliserIncident({ basculeId: 'b1', heure: '2026-11-14T22:30', titre: 'x', responsable: 'm1' }));
  const sm = R.supprimerMembre(e, 'm1');
  assert.equal(sm.etapes.find((x) => x.id === 'A').responsable, '');
  assert.equal(sm.incidents[0].responsable, '');
  const sb = R.supprimerBascule(e, 'b1');
  assert.equal(sb.etapes.length + sb.incidents.length + sb.membres.length + sb.bascules.length, 0);
  maj(e, 'A', { titre: '=SOMME(1;2)', note: 'avec ; point-virgule' });
  const csv = R.csvDeroule(e, B, R.synthese(e, e.bascules[0], M('2026-11-14T18:00')));
  assert.ok(csv.startsWith('﻿Phase;Étape'));
  assert.ok(csv.includes('\'=SOMME(1;2)') || csv.includes('"\'=SOMME(1;2)"'));
  assert.ok(csv.includes('"avec ; point-virgule"'));
  assert.ok(csv.includes('Retour arrière (plan de repli);Annonce'));
  assert.ok(R.taille(e) > 100);
});
