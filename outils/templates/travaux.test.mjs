// Tests des règles métier du pilote de travaux maison (templates/travaux/regles.js et donnees.js).
// Date de référence fixe : aucun test ne dépend du jour où il est lancé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/travaux/', import.meta.url);
globalThis.window = globalThis.window || {};
vm.runInThisContext(readFileSync(new URL('donnees.js', dossier), 'utf8'));
vm.runInThisContext(readFileSync(new URL('regles.js', dossier), 'utf8'));
const R = globalThis.window.REGLES;
const B = globalThis.window.BASE;
const AUJ = '2026-11-12';
const TAUX = B.tva.taux;

const etat = (o = {}) => ({ reglages: { imprevus: 10 }, postes: [], devis: [], paiements: [], imprevus: [], interventions: [], reserves: [], ...o });

test('base intégrée : types de postes uniques, modèles cohérents, sources officielles datées', () => {
  const codes = B.postes.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(B.postes.length, 18);
  for (const p of B.postes) { assert.ok(p.rang >= 1 && p.rang <= 10); assert.ok(p.verifier.length >= 3); }
  assert.deepEqual(B.modeles.map((m) => m.id), ['cuisine', 'sdb', 'appartement']);
  for (const m of B.modeles) for (const e of m.etapes) {
    assert.ok(codes.includes(e.code), `${m.id} : ${e.code}`);
    assert.ok(e.piece === null || (e.piece >= 0 && e.piece < m.pieces.length));
    assert.ok(Number.isInteger(e.duree) && e.duree >= 1);
  }
  assert.deepEqual(TAUX, [5.5, 10, 20]);
  assert.match(B.tva.url, /^https:\/\/entreprendre\.service-public\.gouv\.fr\//);
  assert.match(B.garanties.url, /^https:\/\/www\.service-public\.gouv\.fr\//);
  for (const a of B.aides) assert.match(a.url, /^https:\/\/([a-z-]+\.)*(service-public\.(gouv\.)?fr|france-renov\.gouv\.fr)\//);
  // Aucun montant d'aide dans la base.
  assert.doesNotMatch(JSON.stringify(B.aides), /€|\d+ ?%/);
});

test('dates : ajout, écart, validité, un an après (29 février)', () => {
  assert.equal(R.ajout('2026-12-30', 3), '2027-01-02');
  assert.equal(R.ecart('2026-11-01', AUJ), 11);
  assert.ok(R.estDate('2028-02-29'));
  assert.ok(!R.estDate('2026-02-29'));
  assert.equal(R.unAnApres('2026-11-12'), '2027-11-12');
  assert.equal(R.unAnApres('2028-02-29'), '2029-02-28');
  assert.equal(R.dateFr('2026-03-05'), '05/03/2026');
});

test('montants : saisie à la française, refus des valeurs invalides', () => {
  assert.equal(R.montant('1 234,5'), 1234.5);
  assert.equal(R.montant('1 200 €'), 1200);
  assert.equal(R.montant(99.999), 100);
  assert.equal(R.montant('abc'), null);
  assert.equal(R.montant('-5'), null);
  assert.equal(R.montant(''), null);
  assert.equal(R.somme([{ m: 0.1 }, { m: 0.2 }], (x) => x.m), 0.3);
});

test('TVA implicite : 10 %, 5,5 %, 20 %, taux mixte signalé', () => {
  assert.equal(R.tauxImplicite(1000, 1100), 10);
  assert.equal(R.tauxImplicite(2000, 2110), 5.5);
  assert.equal(R.tauxImplicite(850, 1020), 20);
  assert.equal(R.tauxImplicite(1000, 1150), 15); // devis à plusieurs taux
  assert.equal(R.tauxImplicite(0, 100), null);
  assert.ok(R.tauxConnu(10, TAUX));
  assert.ok(R.tauxConnu(5.5, TAUX));
  assert.ok(!R.tauxConnu(15, TAUX));
  assert.ok(!R.tauxConnu(null, TAUX));
  // Arrondi : 1234,56 HT → 1358,02 TTC (10 %) reste reconnu.
  assert.ok(R.tauxConnu(R.tauxImplicite(1234.56, 1358.02), TAUX));
});

test('comparateur : tri, moins cher, écarts, alertes', () => {
  const c = R.comparer([
    { id: 'a', ht: 4000, ttc: 4400, assurance: true, inclus: 'Dépose, pose' },
    { id: 'b', ht: 3500, ttc: 3850, assurance: false, inclus: 'Pose' },
    { id: 'c', ht: 4200, ttc: 4830, assurance: null, inclus: '' },
  ], TAUX);
  assert.deepEqual(c.map((d) => d.id), ['b', 'a', 'c']);
  assert.equal(c[0].moinsCher, true);
  assert.equal(c[1].moinsCher, false);
  assert.equal(c[1].ecart, 550);
  assert.equal(c[1].ecartPct, 14.3);
  assert.deepEqual(c[0].alertes, ['assurance']);
  assert.deepEqual(c[1].alertes, []);
  assert.deepEqual(c[2].alertes, ['assurance-inconnue', 'tva', 'inclus']); // 15 % : taux mixte ou à vérifier
  // Un seul devis : pas de « moins cher ».
  assert.equal(R.comparer([{ id: 'x', ht: 100, ttc: 110, assurance: true, inclus: 'x' }], TAUX)[0].moinsCher, false);
  // TTC inférieur au HT : incohérent.
  assert.ok(R.comparer([{ id: 'y', ht: 200, ttc: 100, assurance: true, inclus: 'x' }], TAUX)[0].alertes.includes('montants'));
});

test('budget d\'un poste : engagé = devis retenu + imprévus, reste à payer', () => {
  const E = etat({
    postes: [{ id: 'p1', budget: 5000, retenuId: 'd2' }, { id: 'p2', budget: 1200, retenuId: null }],
    devis: [{ id: 'd1', posteId: 'p1', ttc: 4800 }, { id: 'd2', posteId: 'p1', ttc: 5280 }],
    imprevus: [{ id: 'i1', posteId: 'p1', montant: 350 }, { id: 'i2', posteId: null, montant: 200 }],
    paiements: [{ id: 'q1', posteId: 'p1', montant: 1584 }, { id: 'q2', posteId: 'p1', montant: 1000 }],
  });
  const b = R.budgetPoste(E.postes[0], E);
  assert.deepEqual([b.prevu, b.devis, b.imprevus, b.engage, b.paye, b.reste, b.ecart], [5000, 5280, 350, 5630, 2584, 3046, 630]);
  const b2 = R.budgetPoste(E.postes[1], E);
  assert.deepEqual([b2.engage, b2.paye, b2.retenu], [0, 0, false]);
});

test('budget global : provision pour imprévus, consommation, dépassement d\'enveloppe', () => {
  const E = etat({
    reglages: { imprevus: 10 },
    postes: [{ id: 'p1', budget: 5000, retenuId: 'd1' }, { id: 'p2', budget: 3000, retenuId: 'd2' }],
    devis: [{ id: 'd1', ttc: 5200 }, { id: 'd2', ttc: 2900 }],
    imprevus: [{ id: 'i1', posteId: 'p1', montant: 300 }, { id: 'i2', posteId: null, montant: 100 }],
    paiements: [{ id: 'q1', posteId: 'p1', montant: 2000 }, { id: 'q2', posteId: null, montant: 50 }],
  });
  const g = R.budgetGlobal(E);
  assert.equal(g.prevu, 8000);
  assert.equal(g.provision, 800);
  assert.equal(g.enveloppe, 8800);
  assert.equal(g.imprevusReels, 400);
  assert.equal(g.consommation, 50);
  assert.equal(g.engage, 8500); // 5200 + 300 + 2900 + 100
  assert.equal(g.paye, 2050);
  assert.equal(g.reste, 6450);
  assert.equal(g.depasse, false);
  assert.equal(g.ecartRetenus, 400); // (5200 + 300 − 5000) + (2900 − 3000)
  E.imprevus.push({ id: 'i3', posteId: 'p2', montant: 400 });
  assert.equal(R.budgetGlobal(E).depasse, true); // 8900 > 8800
  assert.equal(R.budgetGlobal(etat()).consommation, null);
  assert.equal(R.budgetGlobal(etat({ postes: [{ id: 'p', budget: 100, retenuId: null }] })).aChiffrer, 1);
});

test('planning : état d\'une intervention à la date de référence', () => {
  assert.equal(R.etatIntervention({ debut: '2026-11-01', fin: '2026-11-11' }, AUJ), 'terminee');
  assert.equal(R.etatIntervention({ debut: '2026-11-10', fin: AUJ }, AUJ), 'en-cours');
  assert.equal(R.etatIntervention({ debut: AUJ, fin: '2026-11-20' }, AUJ), 'en-cours');
  assert.equal(R.etatIntervention({ debut: '2026-11-13', fin: '2026-11-20' }, AUJ), 'a-venir');
});

test('planning : chevauchements typés (même pièce, même artisan, parallèle)', () => {
  const piece = { i1: 'cuisine', i2: 'cuisine', i3: 'sdb', i4: null, i5: 'sdb' };
  const l = [
    { id: 'i1', artisanId: 'plombier', debut: '2026-11-02', fin: '2026-11-04' },
    { id: 'i2', artisanId: 'electricien', debut: '2026-11-04', fin: '2026-11-06' },
    { id: 'i3', artisanId: 'plombier', debut: '2026-11-03', fin: '2026-11-03' },
    { id: 'i4', artisanId: 'peintre', debut: '2026-11-20', fin: '2026-11-22' },
    { id: 'i5', artisanId: 'carreleur', debut: '2026-11-05', fin: '2026-11-06' },
  ];
  const c = R.chevauchements(l, (i) => piece[i.id]);
  const cle = (x) => [x.a, x.b].sort().join('-');
  const parCle = Object.fromEntries(c.map((x) => [cle(x), x]));
  assert.equal(c.length, 3);
  assert.equal(parCle['i1-i2'].type, 'meme-piece');
  assert.equal(parCle['i1-i2'].jours, 1);
  assert.equal(parCle['i1-i3'].type, 'meme-artisan');
  assert.equal(parCle['i2-i5'].type, 'parallele');
  assert.equal(parCle['i2-i5'].jours, 2);
  // « Tout le logement » touche toutes les pièces.
  const t = R.chevauchements([l[3], { id: 'i6', artisanId: 'x', debut: '2026-11-22', fin: '2026-11-23' }], (i) => (i.id === 'i4' ? null : 'sdb'));
  assert.equal(t[0].type, 'meme-piece');
  // Même rang (plomberie et électricité dans tout le logement) : en parallèle, sans alerte de pièce.
  const pe = [{ id: 'p', artisanId: 'x', debut: '2026-11-02', fin: '2026-11-06' }, { id: 'e', artisanId: 'y', debut: '2026-11-03', fin: '2026-11-04' }];
  assert.equal(R.chevauchements(pe, () => null, () => 4)[0].type, 'parallele');
  assert.equal(R.chevauchements(pe, () => null)[0].type, 'meme-piece');
  assert.equal(R.chevauchements([pe[0], { ...pe[1], artisanId: 'x' }], () => null, () => 4)[0].type, 'meme-artisan');
  // Bout à bout : pas de chevauchement.
  assert.equal(R.chevauchements([{ id: 'a', debut: '2026-11-01', fin: '2026-11-02' }, { id: 'b', debut: '2026-11-03', fin: '2026-11-04' }], () => 'p').length, 0);
});

test('planning : ordre inhabituel (peinture avant plâtrerie dans la même pièce)', () => {
  const rang = { pla: 5, pei: 8, plb: 4 };
  const piece = { pla: 'sejour', pei: 'sejour', plb: 'sdb' };
  const l = [
    { id: 'pla', debut: '2026-11-10', fin: '2026-11-12' },
    { id: 'pei', debut: '2026-11-08', fin: '2026-11-09' },
    { id: 'plb', debut: '2026-11-15', fin: '2026-11-16' },
  ];
  const o = R.ordreInhabituel(l, (i) => rang[i.id], (i) => piece[i.id]);
  assert.deepEqual(o, [{ avant: 'pla', apres: 'pei' }]); // plomberie dans une autre pièce : pas d'alerte
  // Même rang (plomberie et électricité) : jamais d'alerte.
  assert.equal(R.ordreInhabituel([{ id: 'a', debut: '2026-11-02' }, { id: 'b', debut: '2026-11-01' }], () => 4, () => null).length, 0);
});

test('planning : bornes de la frise (au moins 7 jours)', () => {
  assert.equal(R.bornes([]), null);
  assert.deepEqual(R.bornes([{ debut: '2026-11-03', fin: '2026-11-04' }]), { debut: '2026-11-03', fin: '2026-11-09', jours: 7 });
  assert.deepEqual(R.bornes([{ debut: '2026-11-03', fin: '2026-11-20' }, { debut: '2026-11-01', fin: '2026-11-05' }]), { debut: '2026-11-01', fin: '2026-11-20', jours: 20 });
});

test('modèle de planning : enchaînement et étapes en parallèle', () => {
  let n = 0;
  const uid = () => `id${++n}`;
  const m = B.modeles.find((x) => x.id === 'cuisine');
  const r = R.appliquerModele(m, '2026-11-16', B, uid);
  assert.equal(r.pieces.length, 1);
  assert.equal(r.postes.length, m.etapes.length);
  const [dem, plb, ele, iso] = r.interventions;
  assert.deepEqual([dem.debut, dem.fin], ['2026-11-16', '2026-11-17']);
  assert.deepEqual([plb.debut, plb.fin], ['2026-11-18', '2026-11-19']);
  assert.deepEqual([ele.debut, ele.fin], ['2026-11-18', '2026-11-19']); // avec la plomberie
  assert.equal(iso.debut, '2026-11-20');
  assert.ok(r.interventions.every((i) => i.provisoire && i.artisanId === null));
  assert.equal(r.postes[0].nom, 'Dépose et démolition');
  // Le modèle respecte l'ordre habituel : aucune alerte d'ordre.
  const rang = (i) => B.postes.find((p) => p.code === r.postes.find((x) => x.id === i.posteId).code).rang;
  const piece = (i) => r.postes.find((x) => x.id === i.posteId).pieceId;
  for (const mod of B.modeles) {
    const x = R.appliquerModele(mod, '2026-11-16', B, uid);
    const rg = (i) => B.postes.find((p) => p.code === x.postes.find((q) => q.id === i.posteId).code).rang;
    const pc = (i) => x.postes.find((q) => q.id === i.posteId).pieceId;
    assert.equal(R.ordreInhabituel(x.interventions, rg, pc).length, 0, mod.id);
  }
  assert.equal(R.ordreInhabituel(r.interventions, rang, piece).length, 0);
});

test('réserves : compteurs et garantie de parfait achèvement', () => {
  assert.deepEqual(R.compteReserves([{ statut: 'ouverte' }, { statut: 'levee' }, { statut: 'ouverte' }]), { total: 3, ouvertes: 2, levees: 1 });
  assert.deepEqual(R.garantie('2026-11-02', AUJ), { fin: '2027-11-02', restants: 355, active: true });
  assert.equal(R.garantie('2025-11-01', AUJ).active, false);
  assert.equal(R.garantie(null, AUJ), null);
});
