// Banque de questions et quiz QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.QZZ) et par les tests Node (outils/templates/quiz.test.mjs).
// Dates locales « AAAA-MM-JJ » ; les fonctions qui dépendent du jour reçoivent la date de référence `auj`.
//
// Réponses d'une copie (`copie.reponses[idQuestion]`) :
//   clé absente  → non saisie (copie incomplète, la question ne compte pas encore) ;
//   null         → blanc (rien répondu : faux, 0 point) ;
//   QCM          → tableau des indices des propositions cochées, dans l'ordre de la banque (pas l'ordre affiché) ;
//   vrai ou faux → true / false ;
//   réponse courte → texte ; `copie.corrections[idQuestion]` (true / false) tranche une réponse « à vérifier ».
(function (g) {
  'use strict';

  // ---------- Dates, nombres, textes ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ajoutMois = (s, n) => { const d = versDate(s); const j = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(j, fin)); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Number(s);
  }

  // Comparaison des réponses courtes : sans majuscules, accents, espaces ni ponctuation ; virgule = point décimal.
  function normaliserReponse(t) {
    return plat(t).replace(/(\d),(\d)/g, '$1.$2').replace(/[^a-z0-9.]/g, '').replace(/\.+$/, '').replace(/^\.+/, '');
  }
  // Clé d'un apprenant (même personne d'une session à l'autre) : nom sans majuscules, accents ni espaces doublés.
  const cleApprenant = (nom) => plat(nom).replace(/\s+/g, ' ').trim();
  // Étiquettes : minuscules, espaces simples, sans doublon.
  function lireTags(v) {
    const l = (Array.isArray(v) ? v : String(v ?? '').split(/[,;]/)).map((t) => String(t).trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, 30)).filter(Boolean);
    return [...new Set(l)].slice(0, 12);
  }

  // ---------- Hasard reproductible ----------
  // Générateur pseudo-aléatoire à graine (mulberry32) : un même quiz se retire à l'identique.
  function alea(graine) {
    let a = (Number(graine) >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function melanger(liste, rnd) {
    const l = [...liste];
    for (let i = l.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  }
  const identite = (n) => Array.from({ length: n }, (_, i) => i);
  const estPermutation = (o, n) => Array.isArray(o) && o.length === n && identite(n).every((i) => o.includes(i));

  // ---------- Correction ----------
  const bonnes = (q) => q.choix.map((c, i) => (c.juste ? i : -1)).filter((i) => i >= 0);
  // État d'une réponse : juste, faux, blanc, a-verifier (réponse courte non reconnue), non-saisie.
  function corriger(q, val, correction) {
    const pts = q.points;
    if (val === undefined) return { etat: 'non-saisie', juste: false, points: 0, max: pts };
    if (val === null || (Array.isArray(val) && !val.length) || (typeof val === 'string' && !val.trim())) return { etat: 'blanc', juste: false, points: 0, max: pts };
    let juste;
    if (q.type === 'qcm') {
      const b = bonnes(q);
      const v = [...new Set((Array.isArray(val) ? val : [val]).map(Number))];
      juste = v.length === b.length && b.every((i) => v.includes(i));
    } else if (q.type === 'vf') {
      juste = val === q.vrai;
    } else {
      if (typeof correction === 'boolean') juste = correction;
      else if (q.acceptees.some((a) => normaliserReponse(a) && normaliserReponse(a) === normaliserReponse(val))) juste = true;
      else return { etat: 'a-verifier', juste: false, points: 0, max: pts };
    }
    return { etat: juste ? 'juste' : 'faux', juste, points: juste ? pts : 0, max: pts };
  }

  // Questions d'un quiz encore présentes dans la banque (une question supprimée sort du quiz).
  const itemsDe = (E, quiz) => (quiz?.items || []).map((it) => ({ ...it, q: E.questions.find((q) => q.id === it.qid) })).filter((it) => it.q);
  const arrondiNote = (n, bareme) => (bareme >= 100 ? Math.round(n) : Math.round(n * 2) / 2);

  function scoreCopie(E, copie, quiz) {
    const items = itemsDe(E, quiz);
    let points = 0, total = 0, nonSaisies = 0, aVerifier = 0, justes = 0;
    const detail = items.map((it) => {
      const c = corriger(it.q, copie.reponses[it.qid], copie.corrections?.[it.qid]);
      total += c.max; points += c.points;
      if (c.etat === 'non-saisie') nonSaisies += 1;
      if (c.etat === 'a-verifier') aVerifier += 1;
      if (c.juste) justes += 1;
      return { qid: it.qid, ...c };
    });
    const pct = total ? points / total : 0;
    const bareme = E.reglages.bareme;
    return { points: arrondi(points), total: arrondi(total), justes, n: items.length, nonSaisies, aVerifier, pct, note: arrondiNote(pct * bareme, bareme), bareme, complete: !nonSaisies, detail };
  }

  // ---------- Statistiques ----------
  const mediane = (l) => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quizDe = (E, s) => E.quiz.find((x) => x.id === s?.quizId);

  // Taux de réussite par question, sur les copies des sessions retenues (toutes par défaut).
  // Les réponses non saisies et « à vérifier » ne comptent pas ; les blancs comptent comme faux.
  function statsQuestions(E, sessionIds = null) {
    const r = E.reglages;
    const parQ = new Map();
    const garde = sessionIds ? new Set(sessionIds) : null;
    for (const copie of E.copies) {
      if (garde && !garde.has(copie.sessionId)) continue;
      const quiz = quizDe(E, E.sessions.find((s) => s.id === copie.sessionId));
      for (const it of itemsDe(E, quiz)) {
        const c = corriger(it.q, copie.reponses[it.qid], copie.corrections?.[it.qid]);
        if (c.etat === 'non-saisie' || c.etat === 'a-verifier') continue;
        const st = parQ.get(it.qid) || { qid: it.qid, n: 0, justes: 0, blancs: 0, choix: {} };
        st.n += 1;
        if (c.juste) st.justes += 1;
        if (c.etat === 'blanc') st.blancs += 1;
        if (it.q.type === 'qcm' && !c.juste && Array.isArray(copie.reponses[it.qid])) {
          for (const i of copie.reponses[it.qid]) if (!it.q.choix[i]?.juste) st.choix[i] = (st.choix[i] || 0) + 1;
        }
        parQ.set(it.qid, st);
      }
    }
    return E.questions.map((q) => {
      const st = parQ.get(q.id) || { qid: q.id, n: 0, justes: 0, blancs: 0, choix: {} };
      const taux = st.n ? st.justes / st.n : null;
      let classe = 'peu';
      if (st.n >= r.minReponses) classe = taux * 100 >= r.seuilFacile ? 'facile' : taux * 100 <= r.seuilDifficile ? 'difficile' : 'ok';
      const [dIdx, dNb] = Object.entries(st.choix).sort((a, b) => b[1] - a[1])[0] || [];
      return { ...st, taux, classe, distracteur: dIdx === undefined ? null : { indice: Number(dIdx), nombre: dNb, part: dNb / st.n } };
    });
  }

  function statsTags(E, sessionIds = null) {
    const sq = statsQuestions(E, sessionIds);
    const parT = new Map();
    for (const st of sq) {
      const q = E.questions.find((x) => x.id === st.qid);
      for (const t of q.tags.length ? q.tags : ['(sans étiquette)']) {
        const a = parT.get(t) || { tag: t, n: 0, justes: 0, questions: 0 };
        a.n += st.n; a.justes += st.justes; a.questions += 1;
        parT.set(t, a);
      }
    }
    return [...parT.values()].map((a) => ({ ...a, taux: a.n ? a.justes / a.n : null })).sort((a, b) => a.tag.localeCompare(b.tag, 'fr'));
  }

  function statsSession(E, sid) {
    const s = E.sessions.find((x) => x.id === sid);
    const quiz = quizDe(E, s);
    const copies = E.copies.filter((c) => c.sessionId === sid);
    const scores = copies.map((c) => ({ copie: c, ...scoreCopie(E, c, quiz) }));
    const completes = scores.filter((x) => x.complete);
    const pcts = completes.map((x) => x.pct);
    const tranches = [0, 0, 0, 0, 0];
    for (const p of pcts) tranches[Math.min(4, Math.floor(p * 5))] += 1;
    return {
      session: s, quiz, scores, copies: copies.length, completes: completes.length,
      incompletes: scores.filter((x) => !x.complete).length, aVerifier: scores.reduce((t, x) => t + x.aVerifier, 0),
      moyenne: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null, mediane: mediane(pcts),
      min: pcts.length ? Math.min(...pcts) : null, max: pcts.length ? Math.max(...pcts) : null, tranches,
    };
  }

  // Sessions dans l'ordre des dates, avec leur moyenne (copies complètes seulement).
  const sessionsChrono = (E) => [...E.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom)).map((s) => statsSession(E, s.id));

  // Apprenants nommés (sessions nominatives) : une entrée par clé, avec le nombre de copies.
  function apprenants(E) {
    const m = new Map();
    for (const c of E.copies) {
      const s = E.sessions.find((x) => x.id === c.sessionId);
      if (!s || s.mode !== 'nominatif' || !c.apprenant) continue;
      const k = cleApprenant(c.apprenant);
      const a = m.get(k) || { cle: k, nom: c.apprenant, copies: 0 };
      a.copies += 1;
      m.set(k, a);
    }
    return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  function parcoursApprenant(E, cle) {
    return E.copies.filter((c) => c.apprenant && cleApprenant(c.apprenant) === cle).map((c) => {
      const s = E.sessions.find((x) => x.id === c.sessionId);
      if (!s || s.mode !== 'nominatif') return null;
      return { session: s, quiz: quizDe(E, s), ...scoreCopie(E, c, quizDe(E, s)) };
    }).filter(Boolean).sort((a, b) => a.session.date.localeCompare(b.session.date));
  }

  // Nombre de quiz qui contiennent chaque question.
  function usages(E) {
    const u = {};
    for (const z of E.quiz) for (const it of z.items) u[it.qid] = (u[it.qid] || 0) + 1;
    return u;
  }

  // ---------- Génération de quiz ----------
  // Critères : tags (au moins une, ou toutes si tousLesTags), difficultés, types, nombre, priorité aux moins posées,
  // ordre final (hasard ou difficulté croissante). Les questions archivées ne sont jamais tirées.
  function eligibles(E, c = {}) {
    const tags = lireTags(c.tags || []);
    const dif = c.difficultes?.length ? c.difficultes.map(Number) : [1, 2, 3];
    const types = c.types?.length ? c.types : ['qcm', 'vf', 'courte'];
    const exclure = new Set(c.exclure || []);
    return E.questions.filter((q) => !q.archivee && !exclure.has(q.id) && dif.includes(q.difficulte) && types.includes(q.type)
      && (!tags.length || (c.tousLesTags ? tags.every((t) => q.tags.includes(t)) : tags.some((t) => q.tags.includes(t)))));
  }
  function tirer(E, c = {}, graine = 1) {
    const rnd = alea(graine);
    const el = eligibles(E, c);
    let l = melanger(el, rnd);
    if (c.moinsPosees) { const u = usages(E); l = l.map((q, i) => [q, i]).sort((a, b) => (u[a[0].id] || 0) - (u[b[0].id] || 0) || a[1] - b[1]).map(([q]) => q); }
    const n = Math.max(1, Math.min(Number(c.nombre) || 10, 100));
    l = l.slice(0, n);
    if (c.ordre === 'difficulte') l = l.map((q, i) => [q, i]).sort((a, b) => a[0].difficulte - b[0].difficulte || a[1] - b[1]).map(([q]) => q);
    return { ids: l.map((q) => q.id), disponibles: el.length };
  }
  // Items d'un quiz : ordre des propositions mélangé (QCM) si demandé, reproductible par la graine.
  function items(E, ids, melangerChoix, graine = 1) {
    const rnd = alea(graine * 7919 + 13);
    return ids.map((qid) => {
      const q = E.questions.find((x) => x.id === qid);
      const n = q?.type === 'qcm' ? q.choix.length : 0;
      return { qid, ordre: melangerChoix && n ? melanger(identite(n), rnd) : identite(n) };
    });
  }
  // Réponse lisible, dans l'ordre affiché sur le sujet (lettres).
  function reponseLisible(q, item, val) {
    if (val === undefined) return '';
    if (val === null) return '(blanc)';
    if (q.type === 'qcm') {
      const ordre = estPermutation(item?.ordre, q.choix.length) ? item.ordre : identite(q.choix.length);
      return (Array.isArray(val) ? val : [val]).map((i) => ordre.indexOf(Number(i))).filter((p) => p >= 0).sort((a, b) => a - b).map((p) => 'ABCDEF'[p]).join(', ') || '(blanc)';
    }
    if (q.type === 'vf') return val ? 'Vrai' : 'Faux';
    return String(val);
  }
  const bonneReponseLisible = (q, item) => (q.type === 'qcm' ? reponseLisible(q, item, bonnes(q)) : q.type === 'vf' ? (q.vrai ? 'Vrai' : 'Faux') : q.acceptees.join(' / '));

  // ---------- Collage d'une liste de questions ----------
  function analyserTexte(t) {
    const questions = [], erreurs = [];
    let cur = null;
    const fermer = () => {
      if (!cur) return;
      const { ligne } = cur;
      const q = { type: 'qcm', enonce: cur.enonce, choix: cur.choix, tags: cur.tags, difficulte: cur.difficulte, explication: cur.explication.join(' '), acceptees: [], vrai: true };
      const egal = cur.egal.map((x) => x.trim()).filter(Boolean);
      if (!q.enonce) erreurs.push({ ligne, message: 'Énoncé vide.' });
      else if (cur.choix.length && egal.length) erreurs.push({ ligne, message: 'Une question ne peut pas avoir à la fois des propositions (+ / -) et des réponses (=).' });
      else if (cur.choix.length) {
        if (cur.choix.length < 2 || cur.choix.length > 6) erreurs.push({ ligne, message: 'Un QCM a de 2 à 6 propositions.' });
        else if (!cur.choix.some((c) => c.juste)) erreurs.push({ ligne, message: 'Aucune proposition juste (+).' });
        else questions.push(normaliserQuestion(q));
      } else if (egal.length === 1 && ['vrai', 'faux'].includes(plat(egal[0]))) {
        questions.push(normaliserQuestion({ ...q, type: 'vf', choix: [], vrai: plat(egal[0]) === 'vrai' }));
      } else if (egal.length) {
        questions.push(normaliserQuestion({ ...q, type: 'courte', choix: [], acceptees: egal }));
      } else erreurs.push({ ligne, message: 'Ni propositions (+ / -) ni réponse (=).' });
      cur = null;
    };
    String(t ?? '').split(/\r?\n/).forEach((brut, i) => {
      const l = brut.trim();
      if (!l) return;
      const m = l[0], reste = l.slice(1).trim();
      if (m === '?') { fermer(); cur = { ligne: i + 1, enonce: reste, choix: [], egal: [], tags: [], difficulte: 2, explication: [] }; return; }
      if (!cur) { erreurs.push({ ligne: i + 1, message: 'Ligne hors d\'une question (une question commence par « ? »).' }); return; }
      if (m === '+' || m === '-') cur.choix.push({ texte: reste, juste: m === '+' });
      else if (m === '=') cur.egal.push(reste);
      else if (m === '#') cur.tags = lireTags([...cur.tags, ...lireTags(reste)]);
      else if (m === '~') { const d = Number(reste); if ([1, 2, 3].includes(d)) cur.difficulte = d; else erreurs.push({ ligne: i + 1, message: 'Difficulté : 1, 2 ou 3.' }); }
      else if (m === '!') cur.explication.push(reste);
      else cur.enonce = `${cur.enonce} ${l}`.trim(); // suite de l'énoncé sur plusieurs lignes
    });
    fermer();
    return { questions, erreurs };
  }

  // ---------- Exports ----------
  const cellule = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (n) => String(arrondi(n, 2)).replace('.', ',');
  const csv = (lignes) => `﻿${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`;
  const NOMS_TYPES = { qcm: 'QCM', vf: 'Vrai ou faux', courte: 'Réponse courte' };

  function csvBanque(E) {
    const sq = Object.fromEntries(statsQuestions(E).map((s) => [s.qid, s]));
    return csv([['Type', 'Énoncé', 'Propositions', 'Bonne réponse', 'Étiquettes', 'Difficulté', 'Points', 'Explication', 'Réponses', 'Réussite (%)', 'Archivée'],
      ...E.questions.map((q) => [NOMS_TYPES[q.type], q.enonce, q.choix.map((c, i) => `${'ABCDEF'[i]}. ${c.texte}`).join(' | '), bonneReponseLisible(q, null), q.tags.join(', '), q.difficulte, nombreCsv(q.points), q.explication, sq[q.id].n, sq[q.id].taux === null ? '' : nombreCsv(sq[q.id].taux * 100), q.archivee ? 'oui' : ''])]);
  }
  // Une ligne par copie (notes) ; filtre facultatif par session ou par apprenant.
  function lignesCopies(E, f = {}) {
    return E.copies.filter((c) => (!f.sessionId || c.sessionId === f.sessionId) && (!f.cle || (c.apprenant && cleApprenant(c.apprenant) === f.cle)))
      .map((c) => { const s = E.sessions.find((x) => x.id === c.sessionId); return { c, s, quiz: quizDe(E, s) }; })
      .filter((x) => x.s).sort((a, b) => a.s.date.localeCompare(b.s.date) || a.c.apprenant.localeCompare(b.c.apprenant, 'fr', { numeric: true }));
  }
  function csvNotes(E, f = {}) {
    return csv([['Date', 'Session', 'Quiz', 'Apprenant', 'Points', 'Sur', 'Réussite (%)', `Note /${E.reglages.bareme}`, 'Questions non saisies', 'À vérifier'],
      ...lignesCopies(E, f).map(({ c, s, quiz }) => { const sc = scoreCopie(E, c, quiz); return [s.date, s.nom, quiz?.titre || '', c.apprenant, nombreCsv(sc.points), nombreCsv(sc.total), nombreCsv(sc.pct * 100), nombreCsv(sc.note), sc.nonSaisies, sc.aVerifier]; })]);
  }
  function csvReponses(E, f = {}) {
    const l = [['Date', 'Session', 'Quiz', 'Apprenant', 'N°', 'Question', 'Réponse donnée', 'Bonne réponse', 'Résultat', 'Points']];
    const ETATS = { juste: 'juste', faux: 'faux', blanc: 'blanc', 'a-verifier': 'à vérifier', 'non-saisie': 'non saisie' };
    for (const { c, s, quiz } of lignesCopies(E, f)) {
      itemsDe(E, quiz).forEach((it, i) => {
        const r = corriger(it.q, c.reponses[it.qid], c.corrections?.[it.qid]);
        l.push([s.date, s.nom, quiz?.titre || '', c.apprenant, i + 1, it.q.enonce, reponseLisible(it.q, it, c.reponses[it.qid]), bonneReponseLisible(it.q, it), ETATS[r.etat], nombreCsv(r.points)]);
      });
    }
    return csv(l);
  }
  // Export JSON des résultats (portabilité) : tous, ou ceux d'un apprenant.
  function exportResultats(E, f = {}, auj = iso(new Date())) {
    return {
      exporteLe: auj, apprenant: f.cle ? (apprenants(E).find((a) => a.cle === f.cle)?.nom || f.cle) : null,
      copies: lignesCopies(E, f).map(({ c, s, quiz }) => {
        const sc = scoreCopie(E, c, quiz);
        return { date: s.date, session: s.nom, quiz: quiz?.titre || '', apprenant: c.apprenant, points: sc.points, sur: sc.total, note: sc.note, bareme: sc.bareme,
          reponses: itemsDe(E, quiz).map((it, i) => ({ numero: i + 1, question: it.q.enonce, reponse: reponseLisible(it.q, it, c.reponses[it.qid]), resultat: corriger(it.q, c.reponses[it.qid], c.corrections?.[it.qid]).etat })) };
      }),
    };
  }

  // ---------- Effacements (RGPD) ----------
  const effacerApprenant = (E, cle) => ({ ...E, copies: E.copies.filter((c) => !(c.apprenant && cleApprenant(c.apprenant) === cle && E.sessions.find((s) => s.id === c.sessionId)?.mode === 'nominatif')) });
  const effacerSession = (E, sid) => ({ ...E, sessions: E.sessions.filter((s) => s.id !== sid), copies: E.copies.filter((c) => c.sessionId !== sid) });
  const effacerResultats = (E) => ({ ...E, sessions: [], copies: [] });
  // Anonymise une session nominative : noms remplacés par « Copie n », résultats gardés pour les statistiques.
  function anonymiserSession(E, sid) {
    let n = 0;
    return { ...E, sessions: E.sessions.map((s) => (s.id === sid ? { ...s, mode: 'anonyme' } : s)), copies: E.copies.map((c) => (c.sessionId === sid ? { ...c, apprenant: `Copie ${(n += 1)}` } : c)) };
  }
  // Sessions nominatives plus anciennes que la durée de conservation (en mois).
  const sessionsAnciennes = (E, auj, mois) => E.sessions.filter((s) => s.mode === 'nominatif' && s.date < ajoutMois(auj, -mois) && E.copies.some((c) => c.sessionId === s.id));
  // Supprimer une question : archivée si un quiz l'utilise (statistiques gardées), supprimée sinon.
  function supprimerQuestion(E, qid) {
    if (E.quiz.some((z) => z.items.some((it) => it.qid === qid))) return { ...E, questions: E.questions.map((q) => (q.id === qid ? { ...q, archivee: true } : q)) };
    return { ...E, questions: E.questions.filter((q) => q.id !== qid) };
  }
  // Supprimer un quiz : ses sessions et leurs copies partent avec lui.
  function supprimerQuiz(E, zid) {
    const sids = new Set(E.sessions.filter((s) => s.quizId === zid).map((s) => s.id));
    return { ...E, quiz: E.quiz.filter((z) => z.id !== zid), sessions: E.sessions.filter((s) => !sids.has(s.id)), copies: E.copies.filter((c) => !sids.has(c.sessionId)) };
  }
  const prochainNumeroCopie = (E, sid) => 1 + E.copies.filter((c) => c.sessionId === sid).reduce((m, c) => Math.max(m, Number(/^Copie (\d+)$/.exec(c.apprenant)?.[1] || 0)), 0);

  // ---------- État et normalisation ----------
  function etatVide(base) {
    return { version: 1, reglages: { ...base.reglages }, questions: [], quiz: [], sessions: [], copies: [] };
  }
  function normaliserReglages(r, defaut) {
    const x = { ...defaut, ...(r && typeof r === 'object' ? r : {}) };
    const borne = (v, a, b, d) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Math.round(Number(v)))) : d);
    return {
      bareme: [10, 20, 100].includes(Number(x.bareme)) ? Number(x.bareme) : 20,
      seuilFacile: borne(x.seuilFacile, 50, 100, defaut.seuilFacile),
      seuilDifficile: borne(x.seuilDifficile, 0, 50, defaut.seuilDifficile),
      minReponses: borne(x.minReponses, 1, 100, defaut.minReponses),
      conservation: borne(x.conservation, 1, 60, defaut.conservation),
      saisieDefaut: x.saisieDefaut === 'nominatif' ? 'nominatif' : 'anonyme',
      rgpdLu: !!x.rgpdLu,
    };
  }
  function normaliserQuestion(x = {}) {
    const type = ['qcm', 'vf', 'courte'].includes(x.type) ? x.type : 'qcm';
    const choix = type === 'qcm' ? (Array.isArray(x.choix) ? x.choix : []).slice(0, 6).map((c) => ({ texte: texte(c?.texte ?? c, 300), juste: !!c?.juste })) : [];
    const pts = Number(x.points);
    return {
      id: texte(x.id, 40) || nouvelId(), type, enonce: texte(x.enonce, 1000), choix,
      vrai: type === 'vf' ? x.vrai !== false : true,
      acceptees: type === 'courte' ? (Array.isArray(x.acceptees) ? x.acceptees : []).map((a) => texte(a, 120)).filter(Boolean).slice(0, 10) : [],
      tags: lireTags(x.tags), difficulte: [1, 2, 3].includes(Number(x.difficulte)) ? Number(x.difficulte) : 2,
      explication: texte(x.explication, 1000), points: Number.isFinite(pts) && pts > 0 ? Math.min(20, Math.round(pts * 2) / 2) : 1,
      creeLe: estDate(x.creeLe) ? x.creeLe : null, archivee: !!x.archivee,
    };
  }
  function normaliserQuiz(x = {}, questions = []) {
    const ids = new Set();
    const lesItems = (Array.isArray(x.items) ? x.items : []).map((it) => {
      const q = questions.find((y) => y.id === it?.qid);
      if (!q || ids.has(q.id)) return null;
      ids.add(q.id);
      const n = q.type === 'qcm' ? q.choix.length : 0;
      return { qid: q.id, ordre: estPermutation(it.ordre, n) ? it.ordre.map(Number) : identite(n) };
    }).filter(Boolean);
    return { id: texte(x.id, 40) || nouvelId(), titre: texte(x.titre, 80) || 'Quiz sans titre', consignes: texte(x.consignes, 500), items: lesItems, creeLe: estDate(x.creeLe) ? x.creeLe : null };
  }
  function normaliserSession(x = {}) {
    return { id: texte(x.id, 40) || nouvelId(), quizId: texte(x.quizId, 40), nom: texte(x.nom, 60) || 'Session', date: estDate(x.date) ? x.date : iso(new Date()), mode: x.mode === 'nominatif' ? 'nominatif' : 'anonyme' };
  }
  function normaliserCopie(x = {}) {
    const rep = {}, cor = {};
    for (const [k, v] of Object.entries(x.reponses && typeof x.reponses === 'object' ? x.reponses : {})) {
      if (v === null || typeof v === 'boolean') rep[k] = v;
      else if (Array.isArray(v)) rep[k] = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 6))];
      else if (typeof v === 'string') rep[k] = v.slice(0, 200);
    }
    for (const [k, v] of Object.entries(x.corrections && typeof x.corrections === 'object' ? x.corrections : {})) if (typeof v === 'boolean') cor[k] = v;
    return { id: texte(x.id, 40) || nouvelId(), sessionId: texte(x.sessionId, 40), apprenant: texte(x.apprenant, 40) || 'Copie', reponses: rep, corrections: cor };
  }
  // Tolérant aux anciennes versions et aux fichiers importés ; éléments orphelins retirés.
  function normaliser(d, base) {
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.reglages = normaliserReglages(d.reglages, base.reglages);
    e.questions = (Array.isArray(d.questions) ? d.questions : []).map(normaliserQuestion);
    e.quiz = (Array.isArray(d.quiz) ? d.quiz : []).map((z) => normaliserQuiz(z, e.questions));
    const zids = new Set(e.quiz.map((z) => z.id));
    e.sessions = (Array.isArray(d.sessions) ? d.sessions : []).map(normaliserSession).filter((s) => zids.has(s.quizId));
    const sids = new Set(e.sessions.map((s) => s.id));
    e.copies = (Array.isArray(d.copies) ? d.copies : []).map(normaliserCopie).filter((c) => sids.has(c.sessionId));
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.QZZ = {
    iso, versDate, ajout, ajoutMois, ecart, estDate, arrondi, plat, texte, nouvelId, lireNombre, normaliserReponse, cleApprenant, lireTags,
    alea, melanger, identite, bonnes, corriger, itemsDe, scoreCopie, statsQuestions, statsTags, statsSession, sessionsChrono, apprenants,
    parcoursApprenant, usages, eligibles, tirer, items, reponseLisible, bonneReponseLisible, analyserTexte, csvBanque, csvNotes, csvReponses,
    exportResultats, effacerApprenant, effacerSession, effacerResultats, anonymiserSession, sessionsAnciennes, supprimerQuestion, supprimerQuiz,
    prochainNumeroCopie, etatVide, normaliser, normaliserReglages, normaliserQuestion, normaliserQuiz, normaliserSession, normaliserCopie, taille, mediane,
  };
})(typeof window !== 'undefined' ? window : globalThis);
