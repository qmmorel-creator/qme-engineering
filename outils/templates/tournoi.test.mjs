// Tests du moteur de TournoiFacile (templates/tournoi/regles.js).
// En plus des cas unitaires, chaque format est SIMULÉ jusqu'au bout pour 2 à 20 participants, avec des
// scores pseudo-aléatoires reproductibles, et des invariants sont vérifiés à chaque fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, TextEncoder, structuredClone };
vm.createContext(ctx);
for (const f of ['../../templates/commun/outils.js', '../../templates/tournoi/regles.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx);
const R = ctx.window.TRN;
const simple = (o) => JSON.parse(JSON.stringify(o));

function tournoi(n, format, options = {}) {
  const t = R.normaliserTournoi({ nom: 'Test', format, graine: 'graine', participants: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nom: `Équipe ${i + 1}` })), options: { ...R.optionsDefaut(), ...options } });
  const g = R.generer(t);
  t.matchs = g.matchs; t.poules = g.poules; t.genere = true;
  return t;
}
// Générateur pseudo-aléatoire reproductible.
function alea(graine) { let x = graine >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
// Joue toutes les rencontres jouables jusqu'à la fin. nuls : autoriser les nuls hors élimination.
function jouerTout(t, graine = 7, nuls = true) {
  const r = alea(graine);
  for (let garde = 0; garde < 5000; garde++) {
    const res = R.resoudre(t).parMatch;
    const m = t.matchs.find((x) => res[x.id].etat === 'jouable');
    if (!m) return res;
    let a = Math.floor(r() * 5), b = Math.floor(r() * 5);
    const elim = !['poule', 'championnat'].includes(m.phase);
    const res2 = { scoreA: a, scoreB: b, forfait: null, departage: null };
    if (a === b && (elim || !nuls)) res2.departage = r() < 0.5 ? 'a' : 'b';
    assert.equal(R.validerResultat(m, res2, t.options), null);
    t.resultats[m.id] = res2;
  }
  throw new Error('boucle');
}
function verifierPlanning(t) {
  const pl = R.planning(t);
  const r = R.resoudre(t).parMatch;
  const occupations = {};
  const parTerrain = {};
  for (const m of t.matchs) {
    const p = pl[m.id];
    if (['exempt', 'annulee'].includes(r[m.id].etat)) { assert.equal(p, undefined, `${m.id} ne doit pas être planifiée`); continue; }
    assert.ok(p, `${m.id} planifiée`);
    (parTerrain[p.terrain] ||= []).push(p);
    for (const s of [r[m.id].a, r[m.id].b]) if (s.id) (occupations[s.id] ||= []).push(p);
  }
  for (const l of Object.values(parTerrain)) { l.sort((x, y) => x.debut - y.debut); for (let i = 1; i < l.length; i++) assert.ok(l[i].debut >= l[i - 1].fin, 'terrain occupé deux fois'); }
  for (const l of Object.values(occupations)) { l.sort((x, y) => x.debut - y.debut); for (let i = 1; i < l.length; i++) assert.ok(l[i].debut >= l[i - 1].fin + t.options.repos, 'repos non respecté ou chevauchement'); }
}

test('outils : têtes de série, puissance de 2, cercle', () => {
  assert.deepEqual(simple(R.ordreTetes(8)), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(simple(R.ordreTetes(4)), [1, 4, 2, 3]);
  assert.equal(R.puissance2(5), 8); assert.equal(R.puissance2(8), 8); assert.equal(R.puissance2(1), 1);
  const tours = R.cercle(['a', 'b', 'c', 'd', 'e']);
  assert.equal(tours.length, 5);
  const paires = new Set();
  for (const t of tours) { const vus = new Set(); for (const [x, y] of t) { if (!x || !y) continue; assert.ok(!vus.has(x) && !vus.has(y), 'deux fois dans le même tour'); vus.add(x); vus.add(y); paires.add([x, y].sort().join()); } }
  assert.equal(paires.size, 10);
});

test('vérifications avant génération', () => {
  const t = (n, format, o = {}) => R.normaliserTournoi({ format, participants: Array.from({ length: n }, (_, i) => ({ nom: `E${i}` })), options: o });
  assert.match(R.verifier(t(1, 'elimination')), /au moins 2/);
  assert.equal(R.verifier(t(2, 'elimination')), null);
  assert.match(R.verifier(t(3, 'poules')), /au moins 4/);
  assert.match(R.verifier(t(6, 'poules', { nbPoules: 4 })), /3 au maximum/);
  assert.match(R.verifier(t(7, 'poules', { nbPoules: 2, qualifies: 4 })), /3 qualifiés au maximum/);
  const doublon = R.normaliserTournoi({ participants: [{ nom: 'A' }, { nom: 'a ' }] });
  assert.match(R.verifier(doublon), /même nom/);
  assert.match(R.verifier(R.normaliserTournoi({ participants: [{ nom: 'A' }, { nom: '' }] })), /nom/);
});

test('élimination directe : 2 à 20 participants, exempts, N − 1 rencontres, un seul vainqueur', () => {
  for (let n = 2; n <= 20; n++) {
    const t = tournoi(n, 'elimination', { troisieme: false });
    const res = jouerTout(t, n);
    const jouees = t.matchs.filter((m) => res[m.id].etat === 'jouee');
    assert.equal(jouees.length, n - 1, `${n} participants`);
    assert.equal(t.matchs.filter((m) => res[m.id].etat === 'exempt').length, R.puissance2(n) - n, `${n} : exempts`);
    for (const m of t.matchs) if (res[m.id].a.id) assert.notEqual(res[m.id].a.id, res[m.id].b.id);
    // Chaque perdant est éliminé : il ne rejoue plus après sa défaite.
    const elimines = new Set();
    for (const m of jouees.sort((x, y) => x.tour - y.tour)) {
      assert.ok(!elimines.has(res[m.id].a.id) && !elimines.has(res[m.id].b.id), 'un éliminé rejoue');
      const is = R.issue(m, t.resultats[m.id]);
      elimines.add(res[m.id][is === 'a' ? 'b' : 'a'].id);
    }
    const p = R.podium(t);
    assert.ok(p.premier && !elimines.has(p.premier), `${n} : vainqueur`);
    verifierPlanning(t);
  }
});

test('élimination directe : les deux premières têtes de série ne se croisent qu\'en finale, exempts aux meilleures', () => {
  const t = tournoi(6, 'elimination', { troisieme: false });
  const t1 = t.matchs.filter((m) => m.tour === 1);
  const exempts = t1.filter((m) => m.a.vide || m.b.vide).map((m) => (m.a.vide ? m.b.id : m.a.id));
  assert.deepEqual(simple(exempts.sort()), ['p1', 'p2']);
  const moitie = (id) => t1.findIndex((m) => m.a.id === id || m.b.id === id) < t1.length / 2;
  assert.notEqual(moitie('p1'), moitie('p2'));
});

test('match pour la 3e place', () => {
  const t = tournoi(8, 'elimination', { troisieme: true });
  const m3 = t.matchs.find((m) => m.phase === 'troisieme');
  assert.ok(m3);
  const res = jouerTout(t, 3);
  assert.equal(res[m3.id].etat, 'jouee');
  const p = R.podium(t);
  assert.ok(p.premier && p.second && p.troisieme);
  assert.equal(new Set([p.premier, p.second, p.troisieme]).size, 3);
  assert.equal(tournoi(3, 'elimination', { troisieme: true }).matchs.some((m) => m.phase === 'troisieme'), false, 'pas de 3e place à moins de 4');
});

test('double élimination : 2 à 20 participants, deux défaites pour sortir, revanche éventuelle', () => {
  for (let n = 2; n <= 20; n++) {
    for (const revanche of [true, false]) {
      const t = tournoi(n, 'double', { revanche });
      const res = jouerTout(t, n * 3 + (revanche ? 1 : 0));
      const jouees = t.matchs.filter((m) => res[m.id].etat === 'jouee');
      const defaites = {};
      for (const m of jouees) { const is = R.issue(m, t.resultats[m.id]); const p = res[m.id][is === 'a' ? 'b' : 'a'].id; defaites[p] = (defaites[p] || 0) + 1; }
      const p = R.podium(t);
      assert.ok(p && p.premier, `${n} : champion`);
      for (const x of t.participants) {
        if (x.id === p.premier) assert.ok((defaites[x.id] || 0) <= 1, `${n} : le champion a au plus une défaite`);
        else if (!revanche && x.id === p.second) assert.ok([1, 2].includes(defaites[x.id]), `${n} : finaliste sans revanche`);
        else assert.equal(defaites[x.id], 2, `${n} : ${x.id} sorti après deux défaites`);
      }
      assert.ok(jouees.length === 2 * n - 2 || jouees.length === 2 * n - 1 || (!revanche && jouees.length === 2 * n - 2), `${n} : ${jouees.length} rencontres`);
      for (const m of t.matchs) if (res[m.id].a.id) assert.notEqual(res[m.id].a.id, res[m.id].b.id);
      verifierPlanning(t);
    }
  }
});

test('double élimination : la revanche n\'a lieu que si le vainqueur des perdants gagne la finale', () => {
  const t = tournoi(4, 'double', { revanche: true });
  // On fait gagner systématiquement « a » sauf en grande finale.
  for (let i = 0; i < 20; i++) {
    const res = R.resoudre(t).parMatch;
    const m = t.matchs.find((x) => res[x.id].etat === 'jouable');
    if (!m || m.id === 'F2') break;
    t.resultats[m.id] = m.id === 'F1' ? { scoreA: 0, scoreB: 1 } : { scoreA: 1, scoreB: 0 };
  }
  const res = R.resoudre(t).parMatch;
  assert.equal(res.F2.etat, 'jouable', 'revanche à jouer');
  const sans = tournoi(4, 'double', { revanche: true });
  for (let i = 0; i < 20; i++) { const r = R.resoudre(sans).parMatch; const m = sans.matchs.find((x) => r[x.id].etat === 'jouable'); if (!m) break; sans.resultats[m.id] = { scoreA: 1, scoreB: 0 }; }
  assert.equal(R.resoudre(sans).parMatch.F2.etat, 'annulee', 'pas de revanche si le vainqueur des gagnants l\'emporte');
});

test('championnat : chaque paire une fois (deux en aller-retour), personne deux fois par tour', () => {
  for (let n = 2; n <= 16; n++) {
    for (const allerRetour of [false, true]) {
      const t = tournoi(n, 'championnat', { allerRetour });
      assert.equal(t.matchs.length, (n * (n - 1)) / 2 * (allerRetour ? 2 : 1));
      const paires = {};
      for (const m of t.matchs) { const k = [m.a.id, m.b.id].sort().join(); paires[k] = (paires[k] || 0) + 1; }
      assert.ok(Object.values(paires).every((v) => v === (allerRetour ? 2 : 1)));
      const parTour = {};
      for (const m of t.matchs) { const s = (parTour[m.tour] ||= new Set()); assert.ok(!s.has(m.a.id) && !s.has(m.b.id), `${n} : deux fois au tour ${m.tour}`); s.add(m.a.id); s.add(m.b.id); }
      jouerTout(t, n);
      const c = R.classer(t.participants.map((p) => p.id), t.matchs, t.resultats, t.options, t.graine);
      assert.equal(c.length, n);
      assert.ok(c.every((x) => x.j === (n - 1) * (allerRetour ? 2 : 1)));
      if (n <= 10) verifierPlanning(t);
    }
  }
});

test('poules : serpentin, tailles équilibrées, toutes les rencontres, phase finale sans rencontre de la même poule', () => {
  const p = simple(R.repartirPoules(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 3));
  assert.deepEqual(p, [['1', '6', '7'], ['2', '5', '8'], ['3', '4', '9', '10']]);
  for (const [n, nb, q] of [[4, 1, 2], [5, 2, 2], [7, 2, 2], [8, 2, 2], [9, 3, 2], [10, 3, 2], [12, 3, 2], [13, 4, 2], [16, 4, 2], [12, 4, 1], [18, 6, 2], [20, 5, 3]]) {
    const t = tournoi(n, 'poules', { nbPoules: nb, qualifies: q });
    assert.equal(R.verifier(t), null, `${n}/${nb}/${q}`);
    const tailles = t.poules.map((x) => x.ids.length);
    assert.ok(Math.max(...tailles) - Math.min(...tailles) <= 1, 'tailles équilibrées');
    for (const pl of t.poules) assert.equal(t.matchs.filter((m) => m.groupe === pl.lettre).length, (pl.ids.length * (pl.ids.length - 1)) / 2);
    const res = jouerTout(t, n + nb);
    const t1 = t.matchs.filter((m) => m.phase === 'tableau' && m.tour === 1);
    const pouleDe = (id) => t.poules.find((x) => x.ids.includes(id))?.lettre;
    if (nb > 1) for (const m of t1) if (res[m.id].a.id && res[m.id].b.id) assert.notEqual(pouleDe(res[m.id].a.id), pouleDe(res[m.id].b.id), `${n}/${nb}/${q} : même poule au premier tour`);
    const qualifies = new Set(t1.flatMap((m) => [res[m.id].a.id, res[m.id].b.id]).filter(Boolean));
    assert.equal(qualifies.size, nb * q, `${n}/${nb}/${q} : qualifiés`);
    if (nb * q >= 2) assert.ok(R.podium(t).premier);
    verifierPlanning(t);
  }
});

test('classement : points, différence, confrontation directe, tirage reproductible', () => {
  const t = tournoi(4, 'championnat');
  const set = (a, b, sa, sb) => { const m = t.matchs.find((x) => [x.a.id, x.b.id].sort().join() === [a, b].sort().join()); t.resultats[m.id] = m.a.id === a ? { scoreA: sa, scoreB: sb } : { scoreA: sb, scoreB: sa }; };
  // p1 et p2 : 6 points chacun, même différence (+2) ; p1 a battu p2 → p1 devant.
  // p3 et p4 : 3 points chacun ; p4 a battu p3 (confrontation) mais p3 a la meilleure différence (−1 contre −3).
  set('p1', 'p2', 1, 0); set('p1', 'p3', 0, 2); set('p1', 'p4', 3, 0);
  set('p2', 'p3', 2, 0); set('p2', 'p4', 1, 0);
  set('p3', 'p4', 0, 1);
  const c = R.classer(['p1', 'p2', 'p3', 'p4'], t.matchs, t.resultats, t.options, 'g');
  assert.deepEqual(simple(c.map((x) => x.id)), ['p1', 'p2', 'p4', 'p3'], 'confrontation directe avant la différence');
  assert.equal(c[0].points, 6); assert.equal(c[1].points, 6); assert.equal(c[0].diff, 2); assert.equal(c[1].diff, 2);
  assert.equal(c[0].critere, 'confrontation');
  const c2 = R.classer(['p1', 'p2', 'p3', 'p4'], t.matchs, t.resultats, { ...t.options, departage: ['points', 'diff', 'confrontation'] }, 'g');
  assert.deepEqual(simple(c2.map((x) => x.id)), ['p1', 'p2', 'p3', 'p4'], 'différence avant la confrontation');
  // Égalité parfaite : tirage reproductible, identique d'un appel à l'autre.
  const vide = tournoi(3, 'championnat');
  const a = R.classer(['p1', 'p2', 'p3'], vide.matchs, {}, vide.options, 'x').map((x) => x.id);
  const b = R.classer(['p1', 'p2', 'p3'], vide.matchs, {}, vide.options, 'x').map((x) => x.id);
  assert.deepEqual(simple(a), simple(b));
  assert.equal(R.classer(['p1', 'p2', 'p3'], vide.matchs, {}, vide.options, 'x')[0].critere, 'tirage');
});

test('résultats : validation, forfait, nul et départage', () => {
  const t = tournoi(4, 'elimination');
  const m = t.matchs[0];
  assert.match(R.validerResultat(m, { scoreA: 1, scoreB: 1 }, t.options), /départage/);
  assert.equal(R.validerResultat(m, { scoreA: 1, scoreB: 1, departage: 'b' }, t.options), null);
  assert.match(R.validerResultat(m, { scoreA: -1, scoreB: 1 }, t.options), /positif/);
  assert.match(R.validerResultat(m, { scoreA: 1.5, scoreB: 1 }, t.options), /entier/);
  assert.equal(R.validerResultat(m, { forfait: 'a', scoreA: null, scoreB: null }, t.options), null);
  assert.equal(R.issue(m, { forfait: 'a' }), 'b');
  const c = tournoi(4, 'championnat', { nulsAutorises: false });
  assert.match(R.validerResultat(c.matchs[0], { scoreA: 0, scoreB: 0 }, c.options), /nuls ne sont pas autorisés/);
  const ok = tournoi(4, 'championnat');
  assert.equal(R.validerResultat(ok.matchs[0], { scoreA: 0, scoreB: 0 }, ok.options), null);
  // Forfait : le perdant reçoit les points de forfait (−1 ici), aucun but compté.
  ok.options.points.forfait = -1;
  ok.resultats[ok.matchs[0].id] = { scoreA: null, scoreB: null, forfait: 'a' };
  const s = R.stats(ok.participants.map((p) => p.id), ok.matchs, ok.resultats, ok.options.points);
  const forfaitaire = ok.matchs[0].a.id;
  assert.equal(s[forfaitaire].points, -1); assert.equal(s[forfaitaire].forfaits, 1); assert.equal(s[forfaitaire].pour, 0);
});

test('correction d\'un résultat : rencontres suivantes devenues incohérentes signalées', () => {
  const t = tournoi(4, 'elimination', { troisieme: true });
  jouerTout(t, 11);
  const demi = t.matchs.find((m) => m.id === 'G1-1');
  const avant = t.resultats[demi.id];
  const inverse = { scoreA: avant.scoreB, scoreB: avant.scoreA, departage: avant.departage ? (avant.departage === 'a' ? 'b' : 'a') : null };
  const c = R.consequences(t, demi.id, inverse);
  assert.deepEqual(simple(c.sort()), ['G2-1', 'G3E']);
  assert.deepEqual(simple(R.consequences(t, demi.id, avant)), [], 'même résultat : rien à remettre à zéro');
  // Correction d'une rencontre de poule : le tableau final dépend du classement.
  const p = tournoi(8, 'poules', { nbPoules: 2, qualifies: 2 });
  jouerTout(p, 5);
  const mp = p.matchs.find((m) => m.phase === 'poule');
  const x = R.consequences(p, mp.id, { scoreA: 50, scoreB: 0 });
  assert.ok(Array.isArray(x));
});

test('planning : horaires réels, terrains, repos', () => {
  const t = tournoi(6, 'championnat', { terrains: [{ id: 'a', nom: 'A' }, { id: 'b', nom: 'B' }], debut: '2026-12-05T09:00', dureeMatch: 20, repos: 10 });
  const pl = R.planning(t);
  const premiers = Object.values(pl).filter((x) => x.debut === 0);
  assert.equal(premiers.length, 2, 'deux terrains utilisés dès le début');
  verifierPlanning(t);
  assert.deepEqual(simple(R.heureDe(t, 0)), { date: '2026-12-05', heure: '09:00' });
  assert.deepEqual(simple(R.heureDe(t, 15 * 60 + 5)), { date: '2026-12-06', heure: '00:05' });
  assert.equal(R.heureDe({ options: { debut: '' } }, 10), null);
  const e = tournoi(5, 'elimination', { terrains: [{ id: 'a', nom: 'A' }] });
  const pe = R.planning(e);
  const finale = e.matchs.find((m) => m.tour === 3 && m.phase === 'tableau');
  const demis = e.matchs.filter((m) => m.tour === 2);
  for (const d of demis) if (pe[d.id]) assert.ok(pe[finale.id].debut >= pe[d.id].fin + 10, 'la finale attend la fin des demi-finales');
});

test('normalisation : sauvegarde abîmée', () => {
  const e = R.normaliser({ tournois: [{ format: 'zzz', participants: [{ nom: 'A' }], options: { points: { victoire: 99 }, departage: ['points', 'bidon', 'points'], dureeMatch: 0, debut: 'hier' }, resultats: { inconnu: { scoreA: 1 } } }], actif: 'x' });
  const t = e.tournois[0];
  assert.equal(t.format, 'elimination');
  assert.equal(t.options.points.victoire, 3);
  assert.deepEqual(simple(t.options.departage), ['points']);
  assert.equal(t.options.dureeMatch, 20); assert.equal(t.options.debut, '');
  assert.deepEqual(simple(t.resultats), {});
  assert.equal(e.actif, t.id);
  assert.deepEqual(simple(R.normaliser(simple(e))), simple(e));
});

test('export CSV des rencontres', () => {
  const t = tournoi(3, 'elimination', { debut: '2026-12-05T14:00' });
  t.resultats['G1-2'] = { scoreA: 2, scoreB: 1 };
  const c = R.csvRencontres(t);
  assert.equal(c[0][0], 'Rencontre');
  const exempt = c.find((x) => x[10] === 'Exempt');
  assert.ok(exempt && exempt.includes('(exempt)'));
  const joue = c.find((x) => x[0] === 'G1-2');
  assert.equal(joue[10], 'Jouée'); assert.equal(joue[11], '2026-12-05'); assert.equal(joue[12], '14:00');
});
