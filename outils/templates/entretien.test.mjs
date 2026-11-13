// Tests des règles métier de l'entretien de la maison (templates/entretien/regles.js et donnees.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dossier = new URL('../../templates/entretien/', import.meta.url);
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('donnees.js', dossier), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('regles.js', dossier), 'utf8'), ctx);
const R = ctx.window.ENT;
const BASE = ctx.window.BASE;
const simple = (o) => JSON.parse(JSON.stringify(o));
let n = 0;
const nouvelId = () => `t${++n}`;
const AUJ = '2026-11-13';
const tache = (id, extra = {}) => ({ id, titre: id, frequence: 12, saison: [], depart: null, prevue: null, reporte: null, actif: true, ...extra });
const etat = (taches = [], historique = []) => ({ ...R.etatVide(), taches, historique });

test('base intégrée : environ 80 tâches, zones et règles cohérentes, aucune marque', () => {
  const taches = BASE.equipements.flatMap((e) => e.taches);
  assert.ok(taches.length >= 75, `${taches.length} tâches`);
  const zones = new Set(BASE.zones.map((z) => z.id));
  const ids = new Set();
  for (const e of BASE.equipements) {
    assert.ok(zones.has(e.zone), e.id);
    assert.ok(!ids.has(e.id), `doublon ${e.id}`); ids.add(e.id);
    for (const t of e.taches) {
      assert.ok(Number.isInteger(t.frequence) && t.frequence >= 1, t.titre);
      assert.ok(['locataire', 'proprietaire', 'selon'].includes(t.qui), t.titre);
      for (const m of t.saison) assert.ok(m >= 1 && m <= 12, t.titre);
      if (t.regle) assert.ok(BASE.regles[t.regle], `règle inconnue ${t.regle}`);
    }
  }
  for (const [id, r] of Object.entries(BASE.regles)) {
    assert.ok(r.source && r.texte && r.titre, id);
    if (!r.verifie) assert.match(r.source, /vérifier/i, `${id} doit dire « à vérifier »`);
  }
  assert.equal(BASE.regles.chaudiere.frequence, 12);
  assert.equal(BASE.regles.thermodynamique.frequence, 24);
  assert.ok(BASE.equipements.length >= 30);
});

test('dates : ajout de mois en fin de mois et à travers les années', () => {
  assert.equal(R.ajoutMois('2026-01-31', 1), '2026-02-28');
  assert.equal(R.ajoutMois('2028-01-31', 1), '2028-02-29');
  assert.equal(R.ajoutMois('2026-11-13', 2), '2027-01-13');
  assert.equal(R.ajoutMois('2026-03-15', -3), '2025-12-15');
  assert.equal(R.ajoutMois('2026-10-25', 12), '2027-10-25');
  assert.equal(R.finMois('2026-02-10'), '2026-02-28');
  assert.equal(R.debutMois('2026-11-13'), '2026-11-01');
  assert.ok(R.estDate('2026-02-28'));
  assert.ok(!R.estDate('2026-02-30'));
  assert.ok(!R.estDate('13/11/2026'));
});

test('fréquences et saisons : libellés', () => {
  assert.equal(R.libelleFrequence(1), 'Tous les mois');
  assert.equal(R.libelleFrequence(3), 'Tous les 3 mois');
  assert.equal(R.libelleFrequence(12), 'Tous les ans');
  assert.equal(R.libelleFrequence(24), 'Tous les 2 ans');
  assert.equal(R.libelleFrequence(18), 'Tous les 18 mois');
  assert.equal(R.libelleSaison([3, 4, 5]), 'mars à mai');
  assert.equal(R.libelleSaison([10, 11, 12, 1, 2, 3, 4]), 'octobre à avril');
  assert.equal(R.libelleSaison([11, 12]), 'novembre, décembre');
  assert.equal(R.libelleSaison([3, 9]), 'mars, septembre');
  assert.equal(R.libelleSaison([]), '');
  assert.equal(R.libelleSaison([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), '');
});

test('saison : une échéance hors saison va au plus proche, fin de la saison passée ou début de la suivante', () => {
  assert.equal(R.ajusterSaison('2026-06-14', []), '2026-06-14');
  assert.equal(R.ajusterSaison('2026-09-20', [8, 9, 10]), '2026-09-20');
  assert.equal(R.ajusterSaison('2026-06-14', [8, 9, 10]), '2026-08-01');
  assert.equal(R.ajusterSaison('2026-12-05', [3, 4]), '2027-03-01');
  assert.equal(R.ajusterSaison('2026-05-02', [10, 11, 12, 1, 2, 3, 4]), '2026-04-30');
  assert.equal(R.ajusterSaison('2026-05-02', [10, 11, 12, 1, 2, 3, 4], '2026-04-30'), '2026-10-01'); // pas avant la dernière fois
  assert.equal(R.ajusterSaison('2027-11-13', [8, 9, 10]), '2027-10-31');
});

test('prochaine échéance : dernière fois + fréquence, historique, report, date prévue', () => {
  const t = tache('chaud', { depart: '2025-10-02', frequence: 12, saison: [8, 9, 10] });
  const e = etat([t]);
  assert.equal(R.derniere(e, t), '2025-10-02');
  assert.equal(R.prochaine(e, t), '2026-10-02');
  // Une réalisation plus récente que la date de départ la remplace.
  e.historique.push({ id: 'h1', tache: 'chaud', date: '2026-07-10', cout: 120 });
  assert.equal(R.derniere(e, t), '2026-07-10');
  assert.equal(R.prochaine(e, t), '2027-08-01'); // juillet 2027 hors saison → août
  // Un report l'emporte.
  t.reporte = '2026-12-01';
  assert.equal(R.prochaine(e, t), '2026-12-01');
  // Sans date connue : la date prévue, sinon rien.
  const u = tache('u', { prevue: '2027-01-05' });
  assert.equal(R.prochaine(e, u), '2027-01-05');
  assert.equal(R.prochaine(e, tache('v')), null);
});

test('statuts : retard, ce mois-ci, à venir (90 jours), plus tard, inconnue', () => {
  assert.equal(R.statut('2026-11-12', AUJ), 'retard');
  assert.equal(R.statut('2026-11-13', AUJ), 'mois');
  assert.equal(R.statut('2026-11-30', AUJ), 'mois');
  assert.equal(R.statut('2026-12-01', AUJ), 'avenir');
  assert.equal(R.statut('2027-02-11', AUJ), 'avenir');
  assert.equal(R.statut('2027-02-12', AUJ), 'plustard');
  assert.equal(R.statut(null, AUJ), 'inconnue');
});

test('échéances : regroupées, triées, tâches désactivées ignorées', () => {
  const e = etat([
    tache('a', { depart: '2025-09-01' }), // retard (2026-09-01)
    tache('b', { depart: '2025-10-01' }), // retard (2026-10-01), après a
    tache('c', { depart: '2025-11-20' }), // ce mois
    tache('d', { depart: '2026-01-05' }), // à venir
    tache('e', { depart: '2026-10-01' }), // plus tard
    tache('f'),                           // inconnue
    tache('g', { depart: '2020-01-01', actif: false }),
  ]);
  const g = R.echeances(e, AUJ);
  assert.deepEqual(simple(g.retard.map((x) => x.tache.id)), ['a', 'b']);
  assert.deepEqual(simple(g.mois.map((x) => x.tache.id)), ['c']);
  assert.deepEqual(simple(g.avenir.map((x) => x.tache.id)), ['d']);
  assert.deepEqual(simple(g.plustard.map((x) => x.tache.id)), ['e']);
  assert.deepEqual(simple(g.inconnue.map((x) => x.tache.id)), ['f']);
  assert.equal(g.retard[0].jours, R.ecart(AUJ, '2026-09-01'));
});

test('marquer fait : historique, coût, erreurs, report effacé', () => {
  const t = tache('a', { depart: '2025-09-01', reporte: '2026-12-01', prevue: '2026-12-01' });
  const e = etat([t]);
  assert.match(R.marquerFait(e, 'zz', { date: AUJ }, AUJ), /n'existe plus/);
  assert.match(R.marquerFait(e, 'a', { date: '' }, AUJ), /date/);
  assert.match(R.marquerFait(e, 'a', { date: '2026-11-14' }, AUJ), /futur/);
  assert.match(R.marquerFait(e, 'a', { date: AUJ, cout: 'douze' }, AUJ), /Coût/);
  assert.match(R.marquerFait(e, 'a', { date: AUJ, cout: -5 }, AUJ), /Coût/);
  const h = R.marquerFait(e, 'a', { date: AUJ, cout: '1 234,50 €', intervenant: '  Chauffagiste  ', note: 'RAS' }, AUJ, () => 'h1');
  assert.equal(h.cout, 1234.5);
  assert.equal(h.intervenant, 'Chauffagiste');
  assert.equal(t.reporte, null);
  assert.equal(R.prochaine(e, t), '2027-11-13');
  assert.equal(R.supprimerEntree(e, 'h1'), true);
  assert.equal(R.prochaine(e, t), '2026-09-01');
  assert.equal(R.supprimerEntree(e, 'h1'), false);
});

test('montants : lecture tolérante', () => {
  assert.equal(R.lireMontant(''), null);
  assert.equal(R.lireMontant('85'), 85);
  assert.equal(R.lireMontant('85,5'), 85.5);
  assert.equal(R.lireMontant('1 200 €'), 1200);
  assert.ok(Number.isNaN(R.lireMontant('85,555')));
  assert.ok(Number.isNaN(R.lireMontant('-3')));
});

test('reporter : date, effacement, erreurs', () => {
  const t = tache('a', { depart: '2025-01-01' });
  const e = etat([t]);
  assert.equal(R.reporter(e, 'a', '2026-12-20'), null);
  assert.equal(R.prochaine(e, t), '2026-12-20');
  assert.equal(R.reporter(e, 'a', ''), null);
  assert.equal(R.prochaine(e, t), '2026-01-01');
  assert.match(R.reporter(e, 'a', '2026-13-01'), /illisible/);
  assert.match(R.reporter(e, 'x', '2026-12-01'), /n'existe plus/);
});

test('occurrences : répétition avec saison', () => {
  const t = tache('a', { depart: '2026-03-10', frequence: 6, saison: [3, 9] });
  const e = etat([t]);
  assert.deepEqual(simple(R.occurrences(e, t, '2026-01-01', '2027-12-31')), ['2026-09-10', '2027-03-10', '2027-09-10']);
  assert.deepEqual(simple(R.occurrences(e, tache('b'), '2026-01-01', '2026-12-31')), []);
});

test('liste de l\'année : réalisations, échéances, retards ramenés au mois courant, tâches mensuelles à part', () => {
  const e = etat([
    tache('ramonage', { depart: '2025-09-15', saison: [8, 9, 10] }),     // en retard depuis le 15/09/2026
    tache('filtre', { frequence: 1, depart: '2026-11-01' }),             // mensuelle
    tache('pac', { frequence: 24, depart: '2025-06-01' }),               // juin 2027
    tache('vmc', { frequence: 3, depart: '2026-10-20' }),                // janvier, avril… 2027
    tache('inconnue'),
  ], [{ id: 'h1', tache: 'vmc', date: '2026-04-02', cout: null }]);
  const a = R.annee(e, 2026, AUJ);
  assert.deepEqual(simple(a.mensuelles.map((t) => t.id)), ['filtre']);
  assert.deepEqual(simple(a.inconnues.map((t) => t.id)), ['inconnue']);
  assert.equal(a.mois[3].faits.length, 1);
  const nov = a.mois[10].prevus;
  assert.equal(nov[0].tache.id, 'ramonage');
  assert.equal(nov[0].retard, true);
  // Après le retard, la tâche repart d'aujourd'hui : rien d'autre en 2026.
  assert.equal(a.mois.flatMap((m) => m.prevus).filter((p) => p.tache.id === 'ramonage').length, 1);
  const b = R.annee(e, 2027, AUJ);
  assert.equal(b.mois[9].prevus.find((p) => p.tache.id === 'ramonage')?.date, '2027-10-31'); // repart d'aujourd'hui : 13/11/2027 ramené à la fin de la saison
  assert.equal(b.mois[5].prevus.find((p) => p.tache.id === 'pac')?.date, '2027-06-01');
  assert.deepEqual(simple(b.mois.flatMap((m) => m.prevus).filter((p) => p.tache.id === 'vmc').map((p) => p.date)), ['2027-01-20', '2027-04-20', '2027-07-20', '2027-10-20']);
});

test('étaler : obligations d\'abord, dates dans la saison et jamais dans le passé', () => {
  const e = etat([
    tache('jardin', { frequence: 12, saison: [3, 4] }),
    tache('chaudiere', { frequence: 12, regle: 'chaudiere', saison: [8, 9, 10] }),
    tache('mensuelle', { frequence: 1 }),
    tache('connue', { depart: '2026-05-01' }),
  ]);
  assert.equal(R.etaler(e, AUJ), 3);
  const p = (id) => e.taches.find((t) => t.id === id).prevue;
  assert.equal(p('chaudiere'), '2027-08-01'); // première, hors saison en novembre → août
  assert.equal(p('mensuelle'), AUJ);
  assert.equal(p('jardin'), '2027-03-01');
  assert.equal(p('connue'), null);
  for (const t of e.taches) if (t.prevue) assert.ok(t.prevue >= AUJ);
  assert.equal(R.etaler(e, AUJ), 0);
});

test('coûts : 12 derniers mois et total sur une période', () => {
  const e = etat([tache('a')], [
    { id: '1', tache: 'a', date: '2026-11-02', cout: 90 },
    { id: '2', tache: 'a', date: '2026-11-10', cout: 10.25 },
    { id: '3', tache: 'a', date: '2026-01-15', cout: null },
    { id: '4', tache: 'a', date: '2025-11-30', cout: 500 },
  ]);
  const m = R.coutsMensuels(e, AUJ);
  assert.equal(m.length, 12);
  assert.equal(m[0].mois, '2025-12');
  assert.equal(m[11].mois, '2026-11');
  assert.equal(m[11].total, 100.25);
  assert.equal(m[11].nb, 2);
  assert.equal(m[1].nb, 1);
  assert.deepEqual(simple(R.totalCouts(e, '2026-01-01', '2026-12-31')), { total: 100.25, nb: 3, sansCout: 1 });
});

test('équipements : ajout, désactivation sans effacement, réactivation', () => {
  const e = etat();
  const ids = R.equipementsParDefaut(BASE, 'appartement');
  assert.ok(ids.includes('detecteur'));
  assert.ok(!ids.includes('toiture'));
  const r1 = R.appliquerEquipements(e, ['chaudiere-gaz', 'detecteur', 'inexistant'], BASE, nouvelId);
  assert.equal(r1.ajoutees, 4);
  assert.deepEqual(simple(e.equipements), ['chaudiere-gaz', 'detecteur']);
  const chaud = e.taches.find((t) => t.base === 'chaudiere-gaz:0');
  assert.equal(chaud.regle, 'chaudiere');
  assert.equal(R.frequenceProposee(chaud, BASE), 12);
  chaud.frequence = 18;
  const r2 = R.appliquerEquipements(e, ['detecteur'], BASE, nouvelId);
  assert.equal(r2.desactivees, 2);
  assert.equal(chaud.actif, false);
  R.appliquerEquipements(e, ['detecteur', 'chaudiere-gaz'], BASE, nouvelId);
  assert.equal(chaud.actif, true);
  assert.equal(chaud.frequence, 18, 'la fréquence choisie est conservée');
  assert.equal(e.taches.length, 4);
});

test('export CSV : séparateur point-virgule, guillemets, virgule décimale', () => {
  const e = etat([{ ...tache('a'), titre: 'Ramonage', zone: 'chauffage', equip: 'cheminee' }], [
    { id: '1', tache: 'a', date: '2026-10-02', cout: 75.5, intervenant: 'Ramoneur; secteur nord', note: 'dit "RAS"' },
    { id: '2', tache: 'x', date: '2026-01-02', cout: null, intervenant: '', note: '' },
  ]);
  const lignes = R.csvHistorique(e, BASE).split('\r\n');
  assert.equal(lignes[0], 'Date;Tâche;Zone;Équipement;Coût (€);Intervenant;Note');
  assert.equal(lignes[1], '2026-01-02;Tâche supprimée;;;;;');
  assert.equal(lignes[2], '2026-10-02;Ramonage;Chauffage et climatisation;Cheminée ou insert;75,50;"Ramoneur; secteur nord";"dit ""RAS"""');
});

test('normaliser : tolère les données absentes ou abîmées', () => {
  assert.deepEqual(simple(R.normaliser(null)), simple(R.etatVide()));
  const d = R.normaliser({
    logement: 'chateau', statut: 'locataire',
    taches: [{ id: 'a', titre: 'A', frequence: '0', saison: [0, 3, 3, 13], depart: '2026-02-30', actif: undefined }, { titre: 'sans id' }, null],
    historique: [{ id: 'h', tache: 'a', date: '2026-01-01', cout: -2 }, { id: 'k', tache: 'a', date: 'hier' }],
  });
  assert.equal(d.logement, 'maison');
  assert.equal(d.statut, 'locataire');
  assert.equal(d.taches.length, 1);
  assert.equal(d.taches[0].frequence, 12); // fréquence nulle ou illisible : un an par défaut
  assert.deepEqual(simple(d.taches[0].saison), [3]);
  assert.equal(d.taches[0].depart, null);
  assert.equal(d.taches[0].actif, true);
  assert.equal(d.historique.length, 1);
  assert.equal(d.historique[0].cout, null);
});
