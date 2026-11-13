// TournoiFacile · moteur de tournoi pur (aucun accès au DOM ni au stockage). window.TRN, testé par
// outils/templates/tournoi.test.mjs.
// Principe : generer() crée la structure des rencontres ; seules les rencontres du premier tour (ou des
// poules / du championnat) ont des participants fixes, les autres ont des SOURCES (vainqueur ou perdant
// d'une rencontre, rang dans une poule). resoudre() déduit les participants à partir des résultats saisis :
// rien n'est recopié, donc corriger un résultat ne laisse jamais de rencontre incohérente.
// Exempt : un côté « vide » (nombre de participants non puissance de 2) ; le présent passe sans jouer.
// Classement : V/N/D, points configurables, départage dans l'ordre choisi (points, différence, marqués,
// confrontation directe, victoires, tirage au sort reproductible à partir de la graine du tournoi).
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const FORMATS = ['elimination', 'double', 'poules', 'championnat'];
  const CRITERES = ['points', 'diff', 'pour', 'confrontation', 'victoires', 'tirage'];
  const LETTRES = 'ABCDEFGHIJKLMNOP';

  // ---------- Outils ----------
  // Ordre des têtes de série dans un tableau de taille P (puissance de 2) : 1, P, P/2+1… (1 et 2 ne se
  // rencontrent qu'en finale). ordreTetes(8) = [1, 8, 4, 5, 2, 7, 3, 6].
  function ordreTetes(P) {
    let o = [1];
    while (o.length < P) { const n = o.length * 2; o = o.flatMap((s) => [s, n + 1 - s]); }
    return o;
  }
  const puissance2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };
  // Hachage déterministe (tirage au sort reproductible).
  function hache(texte) { let h = 2166136261; for (const c of String(texte)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Rotation de la méthode du cercle : liste de tours, chaque tour = paires [i, j] (null = exempt).
  function cercle(ids) {
    const l = [...ids];
    if (l.length % 2) l.push(null);
    const n = l.length, tours = [];
    for (let r = 0; r < n - 1; r++) {
      const paires = [];
      for (let i = 0; i < n / 2; i++) {
        const a = l[i], b = l[n - 1 - i];
        // Alternance domicile / extérieur pour le premier de la liste (équilibre des « réceptions »).
        paires.push(i === 0 && r % 2 ? [b, a] : [a, b]);
      }
      tours.push(paires);
      l.splice(1, 0, l.pop());
    }
    return tours;
  }

  // ---------- Génération ----------
  const match = (id, phase, tour, ordre, a, b, extra = {}) => ({ id, phase, tour, ordre, a, b, groupe: null, ...extra });
  const fixe = (id) => (id ? { id } : { vide: true });

  // Tableau à élimination sur des « slots » (participant fixe, source ou vide), têtes de série respectées.
  function tableauElimination(slots, prefixe, phase, troisieme) {
    const P = puissance2(slots.length);
    const ordre = ordreTetes(P);
    const seeds = ordre.map((s) => slots[s - 1] ?? { vide: true });
    const ms = [];
    let precedents = [];
    for (let i = 0; i < P / 2; i++) { const m = match(`${prefixe}1-${i + 1}`, phase, 1, i + 1, seeds[2 * i], seeds[2 * i + 1]); ms.push(m); precedents.push(m); }
    let tour = 1;
    while (precedents.length > 1) {
      tour++;
      const suivants = [];
      for (let i = 0; i < precedents.length / 2; i++) {
        const m = match(`${prefixe}${tour}-${i + 1}`, phase, tour, i + 1, { v: precedents[2 * i].id }, { v: precedents[2 * i + 1].id });
        ms.push(m); suivants.push(m);
      }
      if (troisieme && suivants.length === 1 && precedents.length === 2) ms.push(match(`${prefixe}3E`, 'troisieme', tour, 2, { p: precedents[0].id }, { p: precedents[1].id }));
      precedents = suivants;
    }
    return { matchs: ms, finale: precedents[0], tours: tour };
  }

  function genererElimination(t) {
    const slots = t.participants.map((p) => fixe(p.id));
    return tableauElimination(slots, 'G', 'tableau', t.options.troisieme && t.participants.length >= 4).matchs;
  }

  // Double élimination : tableau des gagnants (G), des perdants (P), grande finale (F1) et revanche (F2)
  // si le vainqueur du tableau des perdants gagne la première finale.
  function genererDouble(t) {
    const g = tableauElimination(t.participants.map((p) => fixe(p.id)), 'G', 'tableau', false);
    const k = g.tours;
    const parTour = (r) => g.matchs.filter((m) => m.tour === r && m.phase === 'tableau');
    const ms = [...g.matchs];
    let courant = [];
    let tourP = 0;
    if (k >= 2) {
      // Tour 1 des perdants : perdants du tour 1 des gagnants, deux par deux.
      tourP = 1;
      const t1 = parTour(1);
      for (let i = 0; i < t1.length / 2; i++) { const m = match(`P1-${i + 1}`, 'perdants', 1, i + 1, { p: t1[2 * i].id }, { p: t1[2 * i + 1].id }); ms.push(m); courant.push(m); }
      for (let r = 2; r <= k; r++) {
        // Tour « de descente » : vainqueurs des perdants contre perdants du tour r des gagnants
        // (ordre inversé un tour sur deux pour éviter de rejouer trop tôt les mêmes rencontres).
        tourP++;
        let descente = parTour(r);
        if (r % 2 === 0) descente = [...descente].reverse();
        const nouv = [];
        for (let i = 0; i < courant.length; i++) { const m = match(`P${tourP}-${i + 1}`, 'perdants', tourP, i + 1, { v: courant[i].id }, { p: descente[i].id }); ms.push(m); nouv.push(m); }
        courant = nouv;
        if (courant.length > 1) {
          tourP++;
          const nouv2 = [];
          for (let i = 0; i < courant.length / 2; i++) { const m = match(`P${tourP}-${i + 1}`, 'perdants', tourP, i + 1, { v: courant[2 * i].id }, { v: courant[2 * i + 1].id }); ms.push(m); nouv2.push(m); }
          courant = nouv2;
        }
      }
    }
    const championPerdants = courant.length ? { v: courant[0].id } : { p: g.finale.id };
    const f1 = match('F1', 'finale', 1, 1, { v: g.finale.id }, championPerdants);
    ms.push(f1);
    if (t.options.revanche) ms.push(match('F2', 'revanche', 2, 1, { v: g.finale.id, finale: true }, { lb: true }));
    return ms;
  }

  // Répartition en serpentin : têtes 1..g dans A..g, puis g+1..2g en sens inverse, etc.
  function repartirPoules(ids, nb) {
    const poules = Array.from({ length: nb }, () => []);
    ids.forEach((id, i) => { const ligne = Math.floor(i / nb), pos = i % nb; poules[ligne % 2 ? nb - 1 - pos : pos].push(id); });
    return poules;
  }
  const nbPoulesConseille = (n) => Math.max(1, Math.round(n / 4));

  function genererPoules(t) {
    const nb = Math.min(t.options.nbPoules || nbPoulesConseille(t.participants.length), Math.floor(t.participants.length / 2)) || 1;
    const poules = repartirPoules(t.participants.map((p) => p.id), nb);
    const ms = [];
    poules.forEach((ids, gi) => {
      const lettre = LETTRES[gi];
      cercle(ids).forEach((paires, r) => {
        let o = 0;
        for (const [a, b] of paires) if (a && b) ms.push(match(`${lettre}${r + 1}-${++o}`, 'poule', r + 1, o, { id: a }, { id: b }, { groupe: lettre }));
      });
    });
    const q = Math.min(t.options.qualifies || 2, Math.min(...poules.map((p) => p.length)));
    if (q >= 1 && nb * q >= 2) {
      // Qualifiés : tous les 1ers (A, B, C…), puis tous les 2es, etc. ; puis on évite qu'un premier tour
      // oppose deux équipes d'une même poule (échanges entre rencontres du premier tour).
      const slots = [];
      for (let rang = 1; rang <= q; rang++) for (let gi = 0; gi < nb; gi++) slots.push({ poule: LETTRES[gi], rang });
      const tab = tableauElimination(slots, 'G', 'tableau', t.options.troisieme && nb * q >= 4);
      eviterMemePoule(tab.matchs.filter((m) => m.tour === 1 && m.phase === 'tableau'));
      ms.push(...tab.matchs);
    }
    return { matchs: ms, poules: poules.map((ids, gi) => ({ lettre: LETTRES[gi], ids })) };
  }
  function eviterMemePoule(premiers) {
    const conflit = (m) => m.a.poule && m.b.poule && m.a.poule === m.b.poule;
    for (const m of premiers) {
      if (!conflit(m)) continue;
      for (const n of premiers) {
        if (n === m || n.b.vide || m.b.vide) continue;
        const essaiM = { a: m.a, b: n.b }, essaiN = { a: n.a, b: m.b };
        if (!conflit(essaiM) && !conflit(essaiN) && m.b.rang === n.b.rang) { const x = m.b; m.b = n.b; n.b = x; break; }
      }
    }
  }

  function genererChampionnat(t) {
    const ms = [];
    const tours = cercle(t.participants.map((p) => p.id));
    tours.forEach((paires, r) => { let o = 0; for (const [a, b] of paires) if (a && b) ms.push(match(`C${r + 1}-${++o}`, 'championnat', r + 1, o, { id: a }, { id: b })); });
    if (t.options.allerRetour) {
      const n = tours.length;
      tours.forEach((paires, r) => { let o = 0; for (const [a, b] of paires) if (a && b) ms.push(match(`C${n + r + 1}-${++o}`, 'championnat', n + r + 1, o, { id: b }, { id: a }, { retour: true })); });
    }
    return ms;
  }

  // Vérifie qu'un tournoi peut être généré ; renvoie un message ou null.
  function verifier(t) {
    const n = t.participants.length;
    if (n < 2) return 'Il faut au moins 2 participants.';
    if (n > 128) return '128 participants au maximum.';
    const noms = t.participants.map((p) => p.nom.trim().toLowerCase());
    if (noms.some((x) => !x)) return 'Chaque participant doit avoir un nom.';
    if (new Set(noms).size !== n) return 'Deux participants portent le même nom : distingue-les.';
    if (t.format === 'poules') {
      if (n < 4) return 'Les poules demandent au moins 4 participants.';
      const nb = t.options.nbPoules || nbPoulesConseille(n);
      if (nb > Math.floor(n / 2)) return `Trop de poules pour ${n} participants : ${Math.floor(n / 2)} au maximum (2 participants par poule).`;
      const mini = Math.floor(n / nb);
      if ((t.options.qualifies || 2) > mini) return `La plus petite poule compte ${mini} participants : ${mini} qualifiés au maximum par poule.`;
    }
    if (t.format === 'championnat' && n > 40) return 'Championnat : 40 participants au maximum (sinon trop de rencontres).';
    return null;
  }
  function generer(t) {
    if (t.format === 'elimination') return { matchs: genererElimination(t), poules: [] };
    if (t.format === 'double') return { matchs: genererDouble(t), poules: [] };
    if (t.format === 'poules') return genererPoules(t);
    return { matchs: genererChampionnat(t), poules: [] };
  }

  // ---------- Résultats ----------
  // Vainqueur d'une rencontre jouée : 'a', 'b', 'nul' ou null (pas encore de résultat valide).
  function issue(m, r) {
    if (!r) return null;
    if (r.forfait === 'a') return 'b';
    if (r.forfait === 'b') return 'a';
    if (r.scoreA === null || r.scoreB === null) return null;
    if (r.scoreA > r.scoreB) return 'a';
    if (r.scoreB > r.scoreA) return 'b';
    return r.departage === 'a' || r.departage === 'b' ? r.departage : 'nul';
  }
  const phasesSansNul = ['tableau', 'perdants', 'finale', 'revanche', 'troisieme'];
  function validerResultat(m, r, options) {
    if (r.forfait) return null;
    for (const s of [r.scoreA, r.scoreB]) if (!(Number.isInteger(s) && s >= 0 && s <= 9999)) return 'Score : nombre entier positif ou nul (9 999 au plus).';
    if (r.scoreA === r.scoreB && !(r.departage === 'a' || r.departage === 'b')) {
      if (phasesSansNul.includes(m.phase)) return 'Égalité : indique le vainqueur du départage (prolongation, tirs au but, jeu décisif…).';
      if (!options.nulsAutorises) return 'Les matchs nuls ne sont pas autorisés dans ce tournoi : indique le vainqueur du départage.';
    }
    return null;
  }

  // ---------- Classements ----------
  function stats(ids, matchs, resultats, points) {
    const s = Object.fromEntries(ids.map((id) => [id, { id, j: 0, v: 0, n: 0, d: 0, pour: 0, contre: 0, diff: 0, points: 0, forfaits: 0 }]));
    for (const m of matchs) {
      const r = resultats[m.id];
      const a = m.a.id, b = m.b.id;
      if (!s[a] || !s[b]) continue;
      const is = issue(m, r);
      if (!is) continue;
      s[a].j++; s[b].j++;
      if (!r.forfait) { s[a].pour += r.scoreA; s[a].contre += r.scoreB; s[b].pour += r.scoreB; s[b].contre += r.scoreA; }
      if (is === 'nul') { s[a].n++; s[b].n++; s[a].points += points.nul; s[b].points += points.nul; }
      else {
        const g = is === 'a' ? s[a] : s[b], p = is === 'a' ? s[b] : s[a];
        g.v++; p.d++; g.points += points.victoire;
        p.points += r.forfait ? points.forfait : points.defaite;
        if (r.forfait) p.forfaits++;
      }
    }
    for (const x of Object.values(s)) x.diff = x.pour - x.contre;
    return s;
  }
  // Classe une liste d'identifiants selon les critères, dans l'ordre. Renvoie [{ id, rang, ex aequo, critere }].
  function classer(ids, matchs, resultats, options, graine) {
    const st = stats(ids, matchs, resultats, options.points);
    const criteres = options.departage.length ? options.departage : ['points', 'diff', 'pour', 'tirage'];
    const decide = {};
    function trier(groupe, crit) {
      if (groupe.length < 2) return groupe;
      if (!crit.length) return [...groupe].sort((x, y) => hache(`${graine}:${x}`) - hache(`${graine}:${y}`) || x.localeCompare(y)).map((id) => { decide[id] = 'tirage'; return id; });
      const [c, ...reste] = crit;
      let val;
      if (c === 'tirage') return trier(groupe, []);
      if (c === 'confrontation') {
        // Mini-championnat entre les seuls ex aequo.
        const sub = stats(groupe, matchs.filter((m) => groupe.includes(m.a.id) && groupe.includes(m.b.id)), resultats, options.points);
        val = (id) => sub[id].points * 1e6 + sub[id].diff * 1e3 + sub[id].pour;
      } else val = (id) => st[id][{ points: 'points', diff: 'diff', pour: 'pour', victoires: 'v' }[c]];
      const valeurs = [...new Set(groupe.map(val))].sort((a, b) => b - a);
      // Critère qui a séparé ce participant de ses ex aequo (le plus profond l'emporte).
      if (valeurs.length > 1) groupe.forEach((id) => { decide[id] = c; });
      return valeurs.flatMap((v) => trier(groupe.filter((id) => val(id) === v), reste));
    }
    const ordre = trier([...ids].sort((a, b) => st[b].points - st[a].points), criteres);
    return ordre.map((id, i) => ({ ...st[id], rang: i + 1, critere: decide[id] || null }));
  }

  // ---------- Résolution des participants ----------
  // Renvoie pour chaque rencontre { a, b } avec { id } (connu), { attente: true } ou { vide: true }, et
  // son état : 'jouable', 'jouee', 'exempt' (un seul participant), 'annulee' (aucun), 'attente'.
  function resoudre(t) {
    const parId = Object.fromEntries(t.matchs.map((m) => [m.id, m]));
    const res = {};
    const poulesFinies = {};
    const classements = {};
    for (const p of t.poules) {
      const ms = t.matchs.filter((m) => m.groupe === p.lettre);
      poulesFinies[p.lettre] = ms.every((m) => issue(m, t.resultats[m.id]));
      classements[p.lettre] = classer(p.ids, ms, t.resultats, t.options, `${t.graine}:${p.lettre}`);
    }
    const vainqueurF1 = () => { const m = parId.F1; const r = m && etat(m); return r && r.etat === 'jouee' ? (issue(m, t.resultats.F1) === 'a' ? 'G' : 'P') : null; };
    function slot(s) {
      if (!s || s.vide) return { vide: true };
      if (s.id) return { id: s.id };
      if (s.poule) {
        if (!poulesFinies[s.poule]) return { attente: true, poule: s.poule, rang: s.rang };
        const c = classements[s.poule][s.rang - 1];
        return c ? { id: c.id } : { vide: true };
      }
      if (s.lb) {
        // Revanche : n'a lieu que si le vainqueur du tableau des perdants gagne la première finale.
        const f = vainqueurF1();
        if (f === null) return { attente: true };
        if (f === 'G') return { vide: true };
        return participant(parId.F1, 'b');
      }
      const src = parId[s.v || s.p];
      if (s.finale) { const f = vainqueurF1(); if (f === 'G') return { vide: true }; if (f === null) return { attente: true }; }
      const e = etat(src);
      if (e.etat === 'annulee') return { vide: true };
      if (e.etat === 'exempt') return s.v ? e.seul : { vide: true };
      if (e.etat !== 'jouee') return { attente: true, source: src.id, type: s.v ? 'v' : 'p' };
      const is = issue(src, t.resultats[src.id]);
      if (is === 'nul') return { attente: true };
      const cote = s.v ? is : (is === 'a' ? 'b' : 'a');
      return participant(src, cote);
    }
    function participant(m, cote) { const e = etat(m); return e[cote]; }
    function etat(m) {
      if (res[m.id]) return res[m.id];
      res[m.id] = { etat: 'attente', a: { attente: true }, b: { attente: true } }; // garde-fou contre les cycles
      const a = slot(m.a), b = slot(m.b);
      let e;
      if (a.vide && b.vide) e = 'annulee';
      else if (a.vide || b.vide) e = a.attente || b.attente ? 'attente' : 'exempt';
      else if (a.attente || b.attente) e = 'attente';
      else {
        const is = issue(m, t.resultats[m.id]);
        // Un nul sans départage ne termine pas une rencontre à élimination.
        e = is === null || (is === 'nul' && phasesSansNul.includes(m.phase)) ? 'jouable' : 'jouee';
      }
      res[m.id] = { etat: e, a, b, seul: e === 'exempt' ? (a.vide ? b : a) : null };
      return res[m.id];
    }
    for (const m of t.matchs) etat(m);
    return { parMatch: res, classements, poulesFinies };
  }

  // Rencontres dont le résultat deviendrait incohérent si l'on change le résultat de « id » :
  // celles, déjà jouées, dont un participant change.
  function consequences(t, id, nouveau) {
    const avant = resoudre(t).parMatch;
    const apres = resoudre({ ...t, resultats: { ...t.resultats, [id]: nouveau } }).parMatch;
    return t.matchs.filter((m) => m.id !== id && t.resultats[m.id] && (avant[m.id].a.id !== apres[m.id].a.id || avant[m.id].b.id !== apres[m.id].b.id)).map((m) => m.id);
  }

  // Classement final (formats à élimination) : 1er, 2e, 3e… d'après les rencontres jouées.
  function podium(t) {
    const r = resoudre(t).parMatch;
    const gagnant = (id) => { const m = t.matchs.find((x) => x.id === id); const e = r[id]; if (!m || !e) return null; if (e.etat === 'exempt') return { premier: e.seul.id }; if (e.etat !== 'jouee') return null; const is = issue(m, t.resultats[id]); return { premier: e[is].id, second: e[is === 'a' ? 'b' : 'a'].id }; };
    if (t.format === 'championnat') return null;
    let finale;
    if (t.format === 'double') {
      const f2 = r.F2;
      finale = f2 && f2.etat !== 'annulee' && t.options.revanche ? (f2.etat === 'jouee' ? gagnant('F2') : null) : gagnant('F1');
    } else {
      const derniers = t.matchs.filter((m) => m.phase === 'tableau');
      if (!derniers.length) return null;
      const maxT = Math.max(...derniers.map((m) => m.tour));
      finale = gagnant(derniers.find((m) => m.tour === maxT).id);
    }
    if (!finale) return null;
    const troisieme = t.matchs.find((m) => m.phase === 'troisieme') ? gagnant(`G3E`) : null;
    return { premier: finale.premier, second: finale.second || null, troisieme: troisieme?.premier || null };
  }

  // ---------- Planning ----------
  // Créneaux et terrains : chaque rencontre commence au plus tôt quand un terrain est libre, que ses deux
  // participants (ou ses rencontres sources) ont fini et que le repos minimal est écoulé.
  // Les rencontres sans match (exempts, annulées) ne sont pas placées.
  function planning(t) {
    const nbT = Math.max(1, t.options.terrains.length);
    const duree = t.options.dureeMatch, repos = t.options.repos;
    const libreT = Array(nbT).fill(0);
    const finMatch = {}, dispo = {};
    const r = resoudre(t).parMatch;
    const ordrePhase = { poule: 0, championnat: 0, tableau: 1, perdants: 1, troisieme: 2, finale: 3, revanche: 4 };
    const liste = [...t.matchs].sort((x, y) => (ordrePhase[x.phase] - ordrePhase[y.phase]) || x.tour - y.tour || (x.phase === 'perdants') - (y.phase === 'perdants') || (x.groupe || '').localeCompare(y.groupe || '') || x.ordre - y.ordre);
    const sources = (s) => (s && (s.v || s.p) ? [s.v || s.p] : []);
    const res = {};
    for (const m of liste) {
      const e = r[m.id];
      if (e.etat === 'annulee' || e.etat === 'exempt') { finMatch[m.id] = Math.max(0, ...sources(m.a).concat(sources(m.b)).map((x) => finMatch[x] ?? 0)); continue; }
      const ids = [e.a.id, e.b.id].filter(Boolean);
      let auPlusTot = Math.max(0, ...ids.map((id) => (dispo[id] ?? -repos) + repos));
      for (const sid of [...sources(m.a), ...sources(m.b)]) auPlusTot = Math.max(auPlusTot, (finMatch[sid] ?? 0) + repos);
      if (m.phase === 'tableau' && t.format === 'poules') auPlusTot = Math.max(auPlusTot, Math.max(0, ...t.matchs.filter((x) => x.phase === 'poule').map((x) => finMatch[x.id] ?? 0)) + repos);
      if (m.b?.lb || m.a?.finale) auPlusTot = Math.max(auPlusTot, (finMatch.F1 ?? 0) + repos);
      let ti = 0;
      for (let i = 1; i < nbT; i++) if (Math.max(libreT[i], auPlusTot) < Math.max(libreT[ti], auPlusTot)) ti = i;
      const debut = Math.max(libreT[ti], auPlusTot);
      libreT[ti] = debut + duree;
      finMatch[m.id] = debut + duree;
      for (const id of ids) dispo[id] = debut + duree;
      res[m.id] = { debut, fin: debut + duree, terrain: ti };
    }
    return res;
  }
  const heureDe = (t, minutes) => {
    const [d, h] = (t.options.debut || '').split('T');
    if (!O.estDate(d) || !/^\d{2}:\d{2}$/.test(h || '')) return null;
    const total = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + minutes;
    return { date: O.ajout(d, Math.floor(total / 1440)), heure: `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` };
  };

  // ---------- Normalisation ----------
  const optionsDefaut = () => ({ points: { victoire: 3, nul: 1, defaite: 0, forfait: 0 }, nulsAutorises: true, departage: ['points', 'confrontation', 'diff', 'pour', 'tirage'], troisieme: true, revanche: true, allerRetour: false, nbPoules: 0, qualifies: 2, terrains: [{ id: 't1', nom: 'Terrain 1' }], debut: '', dureeMatch: 20, repos: 10 });
  function normaliserTournoi(d) {
    d = d && typeof d === 'object' ? d : {};
    const o = d.options || {};
    const v = optionsDefaut();
    const participants = O.tableau(d.participants).slice(0, 128).map((p) => ({ id: O.idValide(p?.id), nom: O.texte(p?.nom, 60), membres: O.texte(p?.membres, 200) }));
    const matchs = O.tableau(d.matchs).slice(0, 2000).filter((m) => m && typeof m.id === 'string');
    const ids = new Set(matchs.map((m) => m.id));
    const resultats = {};
    for (const [k, r] of Object.entries(d.resultats && typeof d.resultats === 'object' ? d.resultats : {})) {
      if (!ids.has(k) || !r) continue;
      const s = (x) => (x === null || x === undefined || x === '' ? null : O.entier(x, 0, 9999, null));
      resultats[k] = { scoreA: s(r.scoreA), scoreB: s(r.scoreB), forfait: O.choix(r.forfait, ['a', 'b'], null), departage: O.choix(r.departage, ['a', 'b'], null) };
    }
    const crit = [...new Set(O.tableau(o.departage).filter((c) => CRITERES.includes(c)))];
    return {
      id: O.idValide(d.id), nom: O.texte(d.nom, 80) || 'Tournoi', discipline: O.texte(d.discipline, 60), format: O.choix(d.format, FORMATS, 'elimination'),
      graine: O.texte(d.graine, 20) || O.nouvelId().slice(0, 8), participants, matchs, poules: O.tableau(d.poules).map((p) => ({ lettre: O.texte(p?.lettre, 2), ids: O.tableau(p?.ids).filter((x) => participants.some((y) => y.id === x)) })).filter((p) => p.lettre),
      genere: !!d.genere && matchs.length > 0, resultats,
      options: {
        points: { victoire: O.entier(o.points?.victoire, 0, 10, 3), nul: O.entier(o.points?.nul, 0, 10, 1), defaite: O.entier(o.points?.defaite, 0, 10, 0), forfait: O.entier(o.points?.forfait, -5, 10, 0) },
        nulsAutorises: o.nulsAutorises !== false, departage: crit.length ? crit : v.departage, troisieme: o.troisieme !== false, revanche: o.revanche !== false, allerRetour: !!o.allerRetour,
        nbPoules: O.entier(o.nbPoules, 0, 16, 0), qualifies: O.entier(o.qualifies, 1, 8, 2),
        terrains: O.tableau(o.terrains).length ? O.tableau(o.terrains).slice(0, 30).map((x) => ({ id: O.idValide(x?.id), nom: O.texte(x?.nom, 40) || 'Terrain' })) : v.terrains,
        debut: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.debut || '') ? o.debut : '', dureeMatch: O.entier(o.dureeMatch, 1, 600, 20), repos: O.entier(o.repos, 0, 600, 10),
      },
    };
  }
  const etatVide = () => ({ version: 1, tournois: [], actif: null });
  function normaliser(d) {
    if (!d || typeof d !== 'object') return etatVide();
    const tournois = O.tableau(d.tournois).slice(0, 50).map(normaliserTournoi);
    return { ...d, version: 1, tournois, actif: tournois.some((x) => x.id === d.actif) ? d.actif : (tournois[0]?.id ?? null) };
  }

  // ---------- Export CSV ----------
  function csvRencontres(t) {
    const r = resoudre(t).parMatch;
    const pl = planning(t);
    const nom = (s) => (s.id ? t.participants.find((p) => p.id === s.id)?.nom : s.vide ? '(exempt)' : 'à déterminer');
    const LIB = { jouable: 'À jouer', jouee: 'Jouée', exempt: 'Exempt', annulee: 'Sans objet', attente: 'En attente' };
    return [['Rencontre', 'Phase', 'Poule', 'Tour', 'Participant A', 'Participant B', 'Score A', 'Score B', 'Forfait', 'Départage', 'État', 'Date', 'Heure', 'Terrain'],
      ...t.matchs.map((m) => { const e = r[m.id]; const x = t.resultats[m.id]; const p = pl[m.id]; const h = p ? heureDe(t, p.debut) : null;
        return [m.id, m.phase, m.groupe || '', m.tour, nom(e.a), nom(e.b), x?.scoreA ?? '', x?.scoreB ?? '', x?.forfait ? nom(e[x.forfait]) : '', x?.departage ? nom(e[x.departage]) : '', LIB[e.etat], h?.date || '', h?.heure || '', p ? t.options.terrains[p.terrain]?.nom || '' : '']; })];
  }

  racine.TRN = {
    FORMATS, CRITERES, LETTRES, ordreTetes, puissance2, hache, cercle, repartirPoules, nbPoulesConseille, verifier, generer,
    issue, validerResultat, stats, classer, resoudre, consequences, podium, planning, heureDe, optionsDefaut, normaliserTournoi, etatVide, normaliser, csvRencontres,
  };
})(typeof window !== 'undefined' ? window : globalThis);
