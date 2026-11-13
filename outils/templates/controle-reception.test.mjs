// Tests du moteur de ContrôleRéception (templates/controle-reception/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/controle-reception/donnees.js', '../../templates/controle-reception/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.RCP;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
const familles = R.famillesInitiales();
const fam = (id) => familles.find((f) => f.id === id);
// Réception « fraîche » complète et conforme : tous les points répondus OK, quantités exactes.
function recOk(extra = {}) {
  const f = fam('frais');
  const controles = {};
  for (const p of R.pointsFamille(f)) controles[p.id] = p.type === 'mesure' ? { valeur: 3 } : { resultat: 'ok' };
  return R.normaliserReception({ id: 'r1', numero: 'REC-2026-0001', date: '2026-11-13', familleId: 'frais', lignes: [{ id: 'l1', designation: 'Yaourts', unite: 'carton', qteCommandee: 50, qteRecue: 50 }], controles, ...extra }, familles);
}

test('base : familles, points et plages cohérents', () => {
  assert.ok(BASE.familles.length >= 10);
  const ids = new Set();
  for (const f of BASE.familles) {
    assert.ok(!ids.has(f.id)); ids.add(f.id);
    assert.ok(f.tolerance >= 0 && f.tolerance <= 10);
    const pts = R.pointsFamille(f);
    assert.equal(new Set(pts.map((p) => p.id)).size, pts.length, `${f.id} : identifiants de points en double`);
    for (const p of pts) if (p.type === 'mesure' && p.min !== null && p.max !== null) assert.ok(p.min < p.max, `${f.id}/${p.id}`);
  }
  assert.match(BASE.avertissement, /ni une exigence réglementaire ni une certification/);
});

test('écarts de quantité et tolérance', () => {
  const l = (cmd, rec, ref = 0) => ({ qteCommandee: cmd, qteRecue: rec, qteRefusee: ref });
  assert.equal(R.ecartLigne(l(50, null), 2).etat, 'a-compter');
  assert.equal(R.ecartLigne(l(50, 50), 2).etat, 'conforme');
  const t = R.ecartLigne(l(50, 49), 2);
  assert.equal(t.etat, 'tolere'); assert.equal(t.pct, -2); assert.equal(t.horsTolerance, false);
  const m = R.ecartLigne(l(50, 48), 2);
  assert.equal(m.etat, 'manquant'); assert.equal(m.ecart, -2); assert.equal(m.pct, -4);
  assert.equal(R.ecartLigne(l(50, 60), 2).etat, 'excedent');
  assert.equal(R.ecartLigne(l(50, 49), 0).etat, 'manquant', 'tolérance nulle : tout écart compte');
  const nc = R.ecartLigne(l(0, 5), 50);
  assert.equal(nc.etat, 'excedent'); assert.equal(nc.pct, null); assert.equal(nc.horsTolerance, true);
  assert.equal(R.ecartLigne(l(0, 0), 0).etat, 'conforme');
  const r = R.ecartLigne(l(10, 10, 3), 0);
  assert.equal(r.accepte, 7); assert.equal(r.refusee, 3);
  assert.equal(R.ecartLigne(l(10, 2, 5), 0).refusee, 2, 'refus plafonné à la quantité reçue');
  assert.equal(R.ecartLigne(l(2.5, 2.45, 0), 2).etat, 'tolere', 'décimales (2 %)');
});

test('points de contrôle : mesures hors plage, non applicable', () => {
  const p = { type: 'mesure', min: 0, max: 4 };
  assert.equal(R.resultatPoint(p, { valeur: 3.9 }), 'ok');
  assert.equal(R.resultatPoint(p, { valeur: 4 }), 'ok');
  assert.equal(R.resultatPoint(p, { valeur: 6.5, resultat: 'ok' }), 'nok', 'la mesure prime sur un « ok » saisi');
  assert.equal(R.resultatPoint(p, { valeur: -1 }), 'nok');
  assert.equal(R.resultatPoint(p, { resultat: 'na', valeur: 9 }), 'na');
  assert.equal(R.resultatPoint(p, {}), null);
  assert.equal(R.resultatPoint({ type: 'mesure', min: null, max: -18 }, { valeur: -20 }), 'ok');
  assert.equal(R.resultatPoint({ type: 'mesure', min: null, max: null }, { valeur: 12 }), 'ok', 'plage non définie : mesure seulement relevée');
  assert.equal(R.resultatPoint({ type: 'visuel' }, { resultat: 'nok' }), 'nok');
  assert.equal(R.resultatPoint({ type: 'visuel' }, { resultat: 'bidon' }), null);
});

test('statut calculé : conforme, en attente', () => {
  const a = R.analyser(recOk(), fam('frais'));
  assert.equal(a.calcule, 'conforme');
  assert.equal(a.statut, 'conforme');
  assert.equal(a.repondus, a.nbPoints);
  assert.equal(R.analyser(recOk({ lignes: [] }), fam('frais')).calcule, 'attente');
  const nonCompte = R.analyser(recOk({ lignes: [{ qteCommandee: 5, qteRecue: null }] }), fam('frais'));
  assert.equal(nonCompte.calcule, 'attente');
  assert.match(nonCompte.manque[0], /1 ligne à compter/);
  const r = recOk(); delete r.controles.dlc;
  const sans = R.analyser(r, fam('frais'));
  assert.equal(sans.calcule, 'attente');
  assert.match(sans.manque.join(), /1 point de contrôle sans réponse/);
});

test('statut calculé : réserves et non-conformité, priorités', () => {
  const manque = R.analyser(recOk({ lignes: [{ designation: 'Yaourts', unite: 'carton', qteCommandee: 50, qteRecue: 45 }] }), fam('frais'));
  assert.equal(manque.calcule, 'reserves');
  assert.match(manque.anomalies[0].texte, /manquant de 5 carton \(-10 %, tolérance 2 %\)/);
  const tolere = R.analyser(recOk({ lignes: [{ designation: 'Yaourts', unite: 'carton', qteCommandee: 50, qteRecue: 49 }] }), fam('frais'));
  assert.equal(tolere.calcule, 'conforme', 'écart dans la tolérance');
  const toleranceSpecifique = R.analyser(recOk({ tolerance: 0, lignes: [{ designation: 'Yaourts', unite: 'carton', qteCommandee: 50, qteRecue: 49 }] }), fam('frais'));
  assert.equal(toleranceSpecifique.calcule, 'reserves', 'tolérance propre à la réception');
  const refus = R.analyser(recOk({ lignes: [{ designation: 'Yaourts', unite: 'carton', qteCommandee: 50, qteRecue: 50, qteRefusee: 2 }] }), fam('frais'));
  assert.equal(refus.calcule, 'reserves');
  const r = recOk(); r.controles.vehicule = { resultat: 'nok' };
  assert.equal(R.analyser(r, fam('frais')).calcule, 'reserves', 'point non critique');
  const chaud = recOk(); chaud.controles.temp = { valeur: 7.2 };
  const a = R.analyser(chaud, fam('frais'));
  assert.equal(a.calcule, 'nonconforme', 'température hors plage sur point critique');
  assert.match(a.anomalies[0].texte, /7,2 °C \(plage 0 à 4\)/);
  const crit = recOk({ constats: [{ id: 'c1', type: 'qualitatif', gravite: 'critique', description: 'Produits moisis' }] });
  assert.equal(R.analyser(crit, fam('frais')).calcule, 'nonconforme');
  // L'attente prime : une non-conformité ne se décide pas tant que la réception n'est pas complète.
  const incomplet = recOk({ lignes: [{ qteCommandee: 1, qteRecue: null }] }); incomplet.controles.temp = { valeur: 9 };
  assert.equal(R.analyser(incomplet, fam('frais')).calcule, 'attente');
});

test('constats : réserve levée, gravité', () => {
  const r = recOk({ constats: [{ id: 'c1', type: 'qualitatif', gravite: 'mineure', description: '1 carton taché', reserve: true }] });
  const a = R.analyser(r, fam('frais'));
  assert.equal(a.calcule, 'reserves');
  assert.equal(a.reservesActives, 1);
  r.constats[0].levee = { date: '2026-11-14', commentaire: 'Avoir reçu' };
  const b = R.analyser(r, fam('frais'));
  assert.equal(b.calcule, 'conforme');
  assert.equal(b.reservesActives, 0);
  const levCrit = recOk({ constats: [{ id: 'c2', gravite: 'critique', description: 'X', levee: { date: '2026-11-14' } }] });
  assert.equal(R.analyser(levCrit, fam('frais')).calcule, 'conforme', 'un constat critique levé ne compte plus');
});

test('décision finale : motif obligatoire si elle diffère', () => {
  assert.equal(R.validerDecision('conforme', 'conforme', ''), null);
  assert.match(R.validerDecision('reserves', 'nonconforme', ''), /explique/);
  assert.equal(R.validerDecision('reserves', 'nonconforme', 'Accord du fournisseur : remplacement sous 48 h'), null);
  assert.match(R.validerDecision('conforme', 'attente', 'x'), /Termine/);
  assert.match(R.validerDecision('attente', 'conforme', 'x'), /Choisis/);
  const r = recOk(); r.controles.temp = { valeur: 8 };
  r.decision = { statut: 'reserves', motif: 'Produits déclassés en transformation' };
  const a = R.analyser(r, fam('frais'));
  assert.equal(a.calcule, 'nonconforme');
  assert.equal(a.statut, 'reserves');
  assert.equal(a.decisionDiffere, true);
});

test('numérotation par année', () => {
  assert.equal(R.prochainNumero([], 2026), 'REC-2026-0001');
  assert.equal(R.prochainNumero([{ numero: 'REC-2026-0007' }, { numero: 'REC-2025-0099' }, { numero: 'autre' }], 2026), 'REC-2026-0008');
  assert.equal(R.prochainNumero([{ numero: 'REC-2025-0099' }], 2026), 'REC-2026-0001');
  assert.equal(R.prochainNumero([{ numero: 'REC-2026-9999' }], 2026), 'REC-2026-10000');
});

test('statistiques par fournisseur', () => {
  const e = R.normaliser({
    fournisseurs: [{ id: 'f1', nom: 'Laiterie' }, { id: 'f2', nom: 'Grossiste' }, { id: 'f3', nom: 'Jamais livré' }],
    receptions: [
      { ...simple(recOk()), id: 'a', fournisseurId: 'f1' },
      { ...simple(recOk({ lignes: [{ qteCommandee: 10, qteRecue: 5, unite: 'u' }] })), id: 'b', fournisseurId: 'f1' },
      { ...simple(recOk({ lignes: [] })), id: 'c', fournisseurId: 'f2' },
      { ...simple(recOk({ constats: [{ gravite: 'majeure', description: 'Palette cassée' }] })), id: 'd', fournisseurId: 'f2' },
    ],
  });
  const s = R.statistiques(e);
  assert.equal(s.total, 4);
  assert.deepEqual([s.attente, s.conforme, s.reserves, s.nonconforme], [1, 1, 2, 0]);
  const f1 = s.parFournisseur.find((x) => x.id === 'f1');
  assert.equal(f1.total, 2); assert.equal(f1.taux, 50);
  const f2 = s.parFournisseur.find((x) => x.id === 'f2');
  assert.equal(f2.total, 1, 'réception en attente exclue du taux'); assert.equal(f2.taux, 0);
  assert.ok(!s.parFournisseur.some((x) => x.id === 'f3'));
  assert.equal(s.reservesNonLevees.length, 1);
});

test('normalisation : sauvegarde abîmée, photos invalides, références orphelines', () => {
  const e = R.normaliser({
    fournisseurs: [{ id: 'f1', nom: '' }],
    familles: [{ nom: 'Perso', tolerance: 500, controles: [{ type: 'mesure', min: 5, max: 1 }, { type: 'zzz' }] }],
    receptions: [{ familleId: 'inconnue', fournisseurId: 'fantome', date: '2026-02-30', heure: '25h', lignes: [{ qteCommandee: -3, qteRecue: 'abc', qteRefusee: 4 }, { qteCommandee: 5, qteRecue: 3, qteRefusee: 9 }],
      controles: { 'bad key!': { resultat: 'ok' }, temp: { resultat: 'zz', valeur: '-2,5' } },
      constats: [{ gravite: 'xxx', type: 'yyy', ligneId: 'nope', photos: [{ data: 'javascript:alert(1)' }, { data: 'data:image/jpeg;base64,AAAA' }] }],
      decision: { statut: 'attente' } }],
    receptionActive: 'n',
  });
  assert.equal(e.fournisseurs[0].nom, 'Fournisseur');
  const f = e.familles[0];
  assert.equal(f.tolerance, 0);
  assert.equal(f.controles[0].max, null, 'plage inversée corrigée');
  assert.equal(f.controles[1].type, 'visuel');
  const r = e.receptions[0];
  assert.equal(r.familleId, f.id);
  assert.equal(r.fournisseurId, null);
  assert.ok(ctx.window.QME_OUTILS.estDate(r.date));
  assert.equal(r.heure, '');
  assert.equal(r.lignes[0].qteCommandee, 0);
  assert.equal(r.lignes[0].qteRecue, null);
  assert.equal(r.lignes[0].qteRefusee, 0);
  assert.equal(r.lignes[1].qteRefusee, 3);
  assert.equal(r.controles['bad key!'], undefined);
  assert.equal(r.controles.temp.resultat, null);
  assert.equal(r.controles.temp.valeur, -2.5);
  assert.equal(r.constats[0].gravite, 'mineure');
  assert.equal(r.constats[0].ligneId, null);
  assert.equal(r.constats[0].photos.length, 1, 'seule l\'image en data:image est gardée');
  assert.equal(r.decision, null);
  assert.equal(e.receptionActive, r.id);
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('exports CSV', () => {
  const r = recOk({ fournisseurId: 'f1', lignes: [{ id: 'l1', ref: 'Y-01', designation: 'Yaourts; nature', unite: 'carton', qteCommandee: 50, qteRecue: 45, qteRefusee: 1 }], constats: [{ id: 'c1', type: 'quantitatif', gravite: 'majeure', description: '5 cartons manquants', ligneId: 'l1', reserve: true }] });
  const e = R.normaliser({ fournisseurs: [{ id: 'f1', nom: 'Laiterie' }], receptions: [simple(r)] });
  const a = R.csvReceptions(e);
  assert.equal(a[1][3], 'Laiterie');
  assert.equal(a[1][9], 'Conforme avec réserves');
  assert.equal(a[1][15], 1);
  const l = R.csvLignes(e);
  assert.deepEqual(simple(l[1].slice(2, 14)), ['Y-01', 'Yaourts; nature', '', 'carton', '50', '45', '1', '44', '-5', '-10', '2', 'Manquant']);
  const c = R.csvConstats(e);
  assert.equal(c[1][5], 'Yaourts; nature');
  assert.equal(c[1][6], 'oui');
  const O = ctx.window.QME_OUTILS;
  assert.equal(simple(O.lireCsv(O.versCsv(l)))[1][3], 'Yaourts; nature');
});
