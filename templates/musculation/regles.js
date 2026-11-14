// Carnet de musculation et cross-training QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.MSC) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Durées en secondes, charges dans l'unité
// choisie (kg ou lb, sans conversion), distances en mètres. Aucune donnée de santé n'est manipulée.
(function (racine) {
  'use strict';

  const TYPES = ['series', 'wod'];
  const FORMATS = ['amrap', 'emom', 'fortime', 'intervalles'];
  const MESURES = ['charge', 'reps', 'temps', 'distance', 'calories'];
  const CHAMPS = ['charge', 'reps', 'temps', 'distance', 'calories'];
  // Métrique principale d'un exercice (records, courbe de progression) selon sa mesure.
  const PRINCIPALE = { charge: 'rm', reps: 'reps', temps: 'temps', distance: 'distance', calories: 'calories' };
  // Types de records suivis par mesure ; « allure » est la seule où plus petit vaut mieux.
  const TYPES_RECORD = { charge: ['rm', 'charge'], reps: ['reps'], temps: ['temps'], distance: ['distance', 'allure'], calories: ['calories'] };
  const MOINS_EST_MIEUX = new Set(['allure']);
  const LIB_RECORD = { rm: '1RM estimé', charge: 'Charge max', reps: 'Répétitions', temps: 'Temps tenu', distance: 'Distance', allure: 'Allure', calories: 'Calories', wod: 'Score' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Lundi de la semaine d'une date (semaine du lundi au dimanche).
  const lundi = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));

  // ---------- Nombres et durées ----------
  const arrondi = (x, pas = 0.01) => Math.round((x + Number.EPSILON) / pas) * pas;
  const arrondi2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  // 1234.5 → « 1 234,5 » (espace fine insécable pour les milliers).
  function nombre(x, decimales = 1) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    const p = 10 ** decimales;
    const v = Math.round((x + Number.EPSILON) * p) / p;
    const [ent, dec] = Math.abs(v).toFixed(decimales).split('.');
    const milliers = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const d = dec && /[1-9]/.test(dec) ? ',' + dec.replace(/0+$/, '') : '';
    return (v < 0 ? '−' : '') + milliers + d;
  }
  // « 62,5 », « 62.5 » → 62.5 ; null si vide ou illisible.
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Number(s);
  }
  // « 12:30 » → 750 ; « 1:02:03 » → 3723 ; « 45 » → 45 (secondes) ; null si illisible.
  function lireDuree(saisie) {
    const s = String(saisie ?? '').trim().replace(/\s/g, '').replace(/[.,]/g, ':').replace(/min$/, ':00').replace(/s$/, '');
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s);
    const m = s.match(/^(?:(\d+):)?(\d{1,3}):(\d{1,2})$/);
    if (!m) return null;
    const [, h, mi, se] = m;
    if (Number(se) > 59 || (h !== undefined && Number(mi) > 59)) return null;
    return Number(h || 0) * 3600 + Number(mi) * 60 + Number(se);
  }
  function formatDuree(sec) {
    if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
    const t = Math.max(0, Math.round(sec));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`;
  }

  // ---------- Exercices ----------
  function index(base, etat) {
    const m = new Map();
    for (const e of base.exercices) m.set(e.id, e);
    for (const e of etat?.exercicesPerso || []) m.set(e.id, { ...e, perso: true });
    return m;
  }
  const mesureDe = (idx, exId) => idx.get(exId)?.mesure || 'charge';

  // ---------- Séries ----------
  // Une série compte si la mesure de l'exercice est renseignée (la charge peut manquer : 0 = barre à vide
  // non saisie, aucun 1RM ni tonnage alors).
  function serieRemplie(s, mesure) {
    if (!s) return false;
    if (mesure === 'charge') return s.reps > 0;
    return s[mesure] > 0;
  }
  // Maximum estimé sur une répétition. Estimation par formule nommée, jamais une mesure :
  // null au-delà de repsMax répétitions (formules peu fiables), 1 répétition = la charge elle-même.
  function un1RM(charge, reps, formule = 'epley', repsMax = 10) {
    if (!(charge > 0) || !(reps >= 1) || !Number.isInteger(reps) || reps > repsMax) return null;
    if (reps === 1) return charge;
    if (formule === 'brzycki') return reps >= 37 ? null : charge * 36 / (37 - reps);
    return charge * (1 + reps / 30);
  }
  const tonnageSerie = (s) => (s && s.charge > 0 && s.reps > 0 ? s.charge * s.reps : 0);
  // Valeurs de record d'une série, selon la mesure de l'exercice.
  function valeursSerie(s, ex, reglages) {
    const mesure = ex?.mesure || 'charge';
    const v = {};
    if (!serieRemplie(s, mesure)) return v;
    if (mesure === 'charge') {
      if (s.charge > 0) v.charge = s.charge;
      const rm = un1RM(s.charge, s.reps, reglages?.formule, reglages?.repsMax ?? 10);
      if (rm !== null) v.rm = arrondi2(rm);
    } else if (mesure === 'distance') {
      v.distance = s.distance;
      if (s.temps > 0) v.allure = arrondi2(s.temps / s.distance * (ex.allure || 1000));
    } else v[mesure] = s[mesure];
    return v;
  }
  const meilleur = (type, a, b) => (b === undefined || b === null ? true : MOINS_EST_MIEUX.has(type) ? a < b : a > b);

  // ---------- WOD ----------
  // Tours effectivement faits par le mouvement i (tours complets seulement ; les répétitions d'un tour
  // incomplet d'AMRAP ne sont pas réparties). EMOM et intervalles : mouvements faits à tour de rôle.
  function toursEffectifs(wod, i) {
    const sc = wod.score || {};
    const n = Math.max(1, wod.mouvements.length);
    const rotation = (total) => Math.floor(total / n) + (i < total % n ? 1 : 0);
    switch (wod.format) {
      case 'amrap': return sc.tours || 0;
      case 'fortime': return sc.termine ? (wod.tours || 1) : (sc.tours || 0);
      case 'emom': return rotation(Math.min(sc.reussies ?? 0, minutesEmom(wod)));
      case 'intervalles': return rotation(wod.tours || 0);
      default: return 0;
    }
  }
  const minutesEmom = (wod) => Math.max(0, Math.floor((wod.duree || 0) * 60 / (wod.intervalle || 60)));
  function repsEffectuees(wod, i) {
    const m = wod.mouvements[i];
    if (!m) return 0;
    if (wod.format === 'intervalles' && !(m.reps > 0)) return Math.round((wod.score?.reps || 0) / Math.max(1, wod.mouvements.length));
    return m.reps > 0 ? m.reps * toursEffectifs(wod, i) : 0;
  }
  function scoreRempli(wod) {
    const sc = wod?.score || {};
    switch (wod?.format) {
      case 'amrap': return sc.tours !== null && sc.tours !== undefined;
      case 'fortime': return sc.termine ? sc.temps > 0 : sc.tours !== null && sc.tours !== undefined;
      case 'emom': return sc.reussies !== null && sc.reussies !== undefined;
      case 'intervalles': return sc.reps !== null && sc.reps !== undefined;
      default: return false;
    }
  }
  // > 0 si le score a est meilleur que b (même format), 0 si égal.
  function comparerScores(format, a, b) {
    const x = a || {}, y = b || {};
    switch (format) {
      case 'amrap': return ((x.tours || 0) - (y.tours || 0)) || ((x.reps || 0) - (y.reps || 0));
      case 'fortime':
        if (!!x.termine !== !!y.termine) return x.termine ? 1 : -1;
        if (x.termine) return (y.temps || Infinity) - (x.temps || Infinity) || 0;
        return ((x.tours || 0) - (y.tours || 0)) || ((x.reps || 0) - (y.reps || 0));
      case 'emom': return (x.reussies || 0) - (y.reussies || 0);
      case 'intervalles': return (x.reps || 0) - (y.reps || 0);
      default: return 0;
    }
  }
  function scoreTexte(wod) {
    if (!scoreRempli(wod)) return 'Score à saisir';
    const sc = wod.score;
    const pl = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;
    switch (wod.format) {
      case 'amrap': return `${pl(sc.tours, 'tour')}${sc.reps ? ` + ${sc.reps} reps` : ''}`;
      case 'fortime': return sc.termine ? formatDuree(sc.temps) : `Temps limite : ${pl(sc.tours, 'tour')}${sc.reps ? ` + ${sc.reps} reps` : ''}`;
      case 'emom': return `${sc.reussies} / ${minutesEmom(wod)} min réussies`;
      case 'intervalles': return `${sc.reps} reps au total`;
      default: return '';
    }
  }
  function descriptionWod(wod) {
    switch (wod.format) {
      case 'amrap': return `AMRAP ${wod.duree || 0} min`;
      case 'emom': return `EMOM ${wod.duree || 0} min${wod.intervalle && wod.intervalle !== 60 ? ` (toutes les ${formatDuree(wod.intervalle)})` : ''}`;
      case 'fortime': return `For Time${wod.tours > 1 ? ` · ${wod.tours} tours` : ''}${wod.cap ? ` · limite ${wod.cap} min` : ''}`;
      case 'intervalles': return `Intervalles ${wod.travail || 0} s / ${wod.repos || 0} s × ${wod.tours || 0}`;
      default: return '';
    }
  }
  const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Un même WOD se reconnaît par son modèle, ou à défaut par son titre et son format.
  const cleWod = (s) => (s.modele ? `m:${s.modele}` : `t:${sansAccents(s.titre)}|${s.wod?.format}`);

  // ---------- Volume ----------
  function volumeSeance(s, idx) {
    const v = { tonnage: 0, series: 0, reps: 0, groupes: {} };
    const ajouter = (exId, series, tonnage, reps) => {
      const g = idx.get(exId)?.groupe || 'autre';
      const x = v.groupes[g] || (v.groupes[g] = { series: 0, tonnage: 0 });
      x.series += series; x.tonnage += tonnage; v.series += series; v.tonnage += tonnage; v.reps += reps;
    };
    if (s.type === 'wod' && s.wod) {
      s.wod.mouvements.forEach((m, i) => {
        if (!m.ex) return;
        const mesure = mesureDe(idx, m.ex);
        const reps = mesure === 'charge' || mesure === 'reps' ? repsEffectuees(s.wod, i) : 0;
        ajouter(m.ex, 1, mesure === 'charge' && m.charge > 0 ? m.charge * reps : 0, reps);
      });
    } else {
      for (const b of s.exercices || []) {
        const mesure = mesureDe(idx, b.ex);
        const faites = b.series.filter((x) => serieRemplie(x, mesure));
        if (!faites.length) continue;
        ajouter(b.ex, faites.length, mesure === 'charge' ? faites.reduce((n, x) => n + tonnageSerie(x), 0) : 0, mesure === 'charge' || mesure === 'reps' ? faites.reduce((n, x) => n + (x.reps || 0), 0) : 0);
      }
    }
    v.tonnage = arrondi2(v.tonnage);
    return v;
  }
  function volumePeriode(etat, idx, du, au) {
    const total = { tonnage: 0, series: 0, reps: 0, seances: 0, groupes: {} };
    for (const s of etat.seances) {
      if (s.date < du || s.date > au) continue;
      const v = volumeSeance(s, idx);
      total.seances++; total.tonnage += v.tonnage; total.series += v.series; total.reps += v.reps;
      for (const [g, x] of Object.entries(v.groupes)) {
        const t = total.groupes[g] || (total.groupes[g] = { series: 0, tonnage: 0 });
        t.series += x.series; t.tonnage += x.tonnage;
      }
    }
    total.tonnage = arrondi2(total.tonnage);
    return total;
  }
  // n dernières semaines (du lundi au dimanche), de la plus ancienne à la semaine en cours.
  function volumeSemaines(etat, idx, auj, n = 12) {
    const l = lundi(auj);
    return Array.from({ length: n }, (_, k) => {
      const debut = ajout(l, -7 * (n - 1 - k));
      return { lundi: debut, ...volumePeriode(etat, idx, debut, ajout(debut, 6)) };
    });
  }
  // Semaines d'affilée avec au moins une séance, jusqu'à la semaine en cours (ou la précédente si la
  // semaine en cours n'a pas encore de séance).
  function semainesAffilee(etat, auj) {
    const semaines = new Set(etat.seances.filter((s) => s.date <= auj).map((s) => lundi(s.date)));
    let l = lundi(auj);
    if (!semaines.has(l)) l = ajout(l, -7);
    let n = 0;
    while (semaines.has(l)) { n++; l = ajout(l, -7); }
    return n;
  }

  // ---------- Records ----------
  // Séances dans l'ordre chronologique (même jour : ordre de saisie).
  const chronologiques = (etat) => etat.seances.map((s, i) => [s, i]).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(([s]) => s);

  // Tous les records dans l'ordre où ils sont tombés. Seules les séances « séries » comptent pour les
  // exercices (un mouvement de WOD se fait sous fatigue) ; les WOD ont leur propre record de score.
  // premier = première performance enregistrée (référence, pas un record battu).
  function chronologieRecords(etat, idx, reglages) {
    const meilleurs = new Map();
    const evts = [];
    for (const s of chronologiques(etat)) {
      if (s.type === 'wod') {
        if (!s.wod || !scoreRempli(s.wod)) continue;
        const cle = cleWod(s);
        const avant = meilleurs.get(cle);
        if (!avant || comparerScores(s.wod.format, s.wod.score, avant.score) > 0) {
          evts.push({ date: s.date, seance: s.id, cle, type: 'wod', format: s.wod.format, valeur: scoreTexte(s.wod), ancien: avant ? avant.texte : null, premier: !avant });
          meilleurs.set(cle, { score: s.wod.score, texte: scoreTexte(s.wod) });
        }
        continue;
      }
      for (const b of s.exercices || []) {
        const ex = idx.get(b.ex);
        if (!ex) continue;
        const dansSeance = {};
        for (const x of b.series) {
          const v = valeursSerie(x, ex, reglages);
          for (const [t, val] of Object.entries(v)) if (meilleur(t, val, dansSeance[t])) dansSeance[t] = val;
        }
        for (const t of TYPES_RECORD[ex.mesure] || []) {
          if (dansSeance[t] === undefined) continue;
          const cle = `${b.ex}|${t}`;
          const avant = meilleurs.get(cle);
          if (avant === undefined || meilleur(t, dansSeance[t], avant)) {
            evts.push({ date: s.date, seance: s.id, ex: b.ex, type: t, valeur: dansSeance[t], ancien: avant ?? null, premier: avant === undefined });
            meilleurs.set(cle, dansSeance[t]);
          }
        }
      }
    }
    return evts;
  }
  // Records battus pendant une séance (hors premières performances).
  const recordsSeance = (evts, id) => evts.filter((e) => e.seance === id && !e.premier);
  // Records actuels d'un exercice : meilleure valeur de chaque type, et meilleure charge soulevée au moins
  // n fois pour chaque n de repsRecords.
  function recordsExercice(etat, idx, reglages, exId, repsRecords = [1, 3, 5, 8, 10]) {
    const ex = idx.get(exId);
    const r = { types: {}, parReps: {}, seances: 0, derniere: null };
    if (!ex) return r;
    for (const s of chronologiques(etat)) {
      if (s.type === 'wod') continue;
      let vu = false;
      for (const b of s.exercices || []) {
        if (b.ex !== exId) continue;
        for (const x of b.series) {
          if (!serieRemplie(x, ex.mesure)) continue;
          vu = true;
          for (const [t, val] of Object.entries(valeursSerie(x, ex, reglages))) {
            if (!r.types[t] || meilleur(t, val, r.types[t].valeur)) r.types[t] = { valeur: val, date: s.date, seance: s.id, serie: x };
          }
          if (ex.mesure === 'charge' && x.charge > 0) {
            for (const n of repsRecords) if (x.reps >= n && (!r.parReps[n] || x.charge > r.parReps[n].charge)) r.parReps[n] = { charge: x.charge, reps: x.reps, date: s.date };
          }
        }
      }
      if (vu) { r.seances++; r.derniere = s.date; }
    }
    return r;
  }
  // Courbe de progression : meilleure valeur de la métrique principale à chaque séance.
  function progression(etat, idx, reglages, exId) {
    const ex = idx.get(exId);
    if (!ex) return [];
    const t = PRINCIPALE[ex.mesure];
    const points = [];
    for (const s of chronologiques(etat)) {
      if (s.type === 'wod') continue;
      let best;
      for (const b of s.exercices || []) {
        if (b.ex !== exId) continue;
        for (const x of b.series) { const v = valeursSerie(x, ex, reglages)[t]; if (v !== undefined && meilleur(t, v, best)) best = v; }
      }
      if (best !== undefined) points.push({ date: s.date, valeur: arrondi2(best), seance: s.id });
    }
    return points;
  }
  // Séances d'un même WOD, de la plus ancienne à la plus récente.
  const historiqueWod = (etat, cle) => chronologiques(etat).filter((s) => s.type === 'wod' && cleWod(s) === cle);
  // Exercices travaillés (séances « séries »), du plus fréquent au moins fréquent.
  function exercicesPratiques(etat) {
    const n = new Map();
    for (const s of etat.seances) if (s.type !== 'wod') for (const b of s.exercices || []) if (b.series.length) n.set(b.ex, (n.get(b.ex) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([ex, k]) => ({ ex, seances: k }));
  }

  // ---------- Minuteur ----------
  // Plan d'un minuteur : segments [début, fin[ en millisecondes depuis le lancement, avec une préparation.
  // format : amrap (compte à rebours), emom (une minute par tour), fortime (compte croissant, limite
  // facultative), intervalles (travail puis repos), chrono (compte croissant sans fin).
  function planMinuteur(c) {
    const prepa = Math.max(0, c.prepa ?? 10) * 1000;
    const segs = [];
    const ajouterSeg = (phase, duree, tour) => { const debut = segs.length ? segs.at(-1).fin : 0; segs.push({ phase, debut, fin: debut + duree, tour }); };
    if (prepa) ajouterSeg('prepa', prepa, 0);
    let croissant = false;
    switch (c.format) {
      case 'amrap': ajouterSeg('travail', Math.max(1, c.duree || 0) * 1000, 1); break;
      case 'emom': {
        const pas = Math.max(5, c.intervalle || 60) * 1000;
        const total = Math.max(1, c.duree || 0) * 1000;
        const n = Math.ceil(total / pas);
        for (let i = 0; i < n; i++) ajouterSeg('travail', Math.min(pas, total - i * pas), i + 1);
        break;
      }
      case 'intervalles': {
        const n = Math.max(1, c.tours || 1);
        for (let i = 0; i < n; i++) {
          ajouterSeg('travail', Math.max(1, c.travail || 0) * 1000, i + 1);
          if (i < n - 1 && c.repos > 0) ajouterSeg('repos', c.repos * 1000, i + 1);
        }
        break;
      }
      case 'fortime': croissant = true; ajouterSeg('travail', c.cap > 0 ? c.cap * 1000 : Infinity, 1); break;
      default: croissant = true; ajouterSeg('travail', Infinity, 1);
    }
    return { format: c.format, segments: segs, total: segs.at(-1).fin, prepa, croissant, tours: segs.filter((s) => s.phase === 'travail').length };
  }
  function etatMinuteur(plan, ms) {
    const t = Math.max(0, ms);
    const ecoule = Math.max(0, t - plan.prepa);
    if (t >= plan.total) {
      const dernier = plan.segments.at(-1);
      return { phase: 'fini', fini: true, tour: dernier.tour, tours: plan.tours, restant: 0, ecoule: plan.total - plan.prepa, indice: plan.segments.length };
    }
    const indice = plan.segments.findIndex((s) => t >= s.debut && t < s.fin);
    const seg = plan.segments[indice];
    return { phase: seg.phase, fini: false, tour: seg.tour, tours: plan.tours, restant: seg.fin - t, ecoule, indice };
  }
  // Bips entre deux instants : « fin » au changement de segment, « compte » sur les 3 dernières secondes
  // d'un segment fini (pas pour un compte croissant sans fin).
  function bips(plan, avant, apres) {
    const a = etatMinuteur(plan, avant), b = etatMinuteur(plan, apres);
    if (b.indice !== a.indice) return 'fin';
    if (b.fini || !Number.isFinite(b.restant)) return null;
    const sa = Math.ceil(a.restant / 1000), sb = Math.ceil(b.restant / 1000);
    return sb !== sa && sb <= 3 && sb >= 1 ? 'compte' : null;
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const num = (x, maxi = 1e6) => { const n = typeof x === 'string' ? lireNombre(x) : x; return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= maxi ? n : null; };
  const entier = (x, maxi = 1e6) => { const n = num(x, maxi); return n === null ? null : Math.round(n); };
  const texte = (x, n = 200) => String(x ?? '').slice(0, n);
  function normaliserSerie(s = {}) {
    const rpe = num(s.rpe, 10);
    return { charge: num(s.charge, 2000), reps: entier(s.reps, 10000), temps: entier(s.temps, 86400), distance: num(s.distance, 1e6), calories: entier(s.calories, 1e5), rpe: rpe !== null && rpe >= 1 ? Math.round(rpe * 2) / 2 : null };
  }
  const normaliserMouvement = (m = {}) => ({ id: m.id || nouvelId(), ex: texte(m.ex, 60), reps: entier(m.reps, 10000), charge: num(m.charge, 2000), distance: num(m.distance, 1e6), calories: entier(m.calories, 1e5), temps: entier(m.temps, 86400) });
  function normaliserWod(w = {}) {
    const sc = w.score || {};
    return {
      format: FORMATS.includes(w.format) ? w.format : 'amrap',
      duree: entier(w.duree, 600), cap: entier(w.cap, 600), tours: entier(w.tours, 1000), travail: entier(w.travail, 3600), repos: entier(w.repos, 3600), intervalle: entier(w.intervalle, 3600) || 60,
      mouvements: (Array.isArray(w.mouvements) ? w.mouvements : []).map(normaliserMouvement),
      score: { tours: entier(sc.tours, 10000), reps: entier(sc.reps, 100000), temps: entier(sc.temps, 86400), termine: !!sc.termine, reussies: entier(sc.reussies, 10000) },
    };
  }
  const normaliserBloc = (b = {}) => ({ id: b.id || nouvelId(), ex: texte(b.ex, 60), series: (Array.isArray(b.series) ? b.series : []).map(normaliserSerie) });
  function normaliserSeance(s = {}) {
    const type = TYPES.includes(s.type) ? s.type : 'series';
    return {
      id: s.id || nouvelId(), date: estDate(s.date) ? s.date : iso(new Date()), titre: texte(s.titre, 80), type, modele: s.modele ? texte(s.modele, 60) : null,
      note: texte(s.note, 500), duree: entier(s.duree, 1440),
      exercices: type === 'series' ? (Array.isArray(s.exercices) ? s.exercices : []).map(normaliserBloc) : [],
      wod: type === 'wod' ? normaliserWod(s.wod) : null,
    };
  }
  function normaliserModele(m = {}) {
    const s = normaliserSeance({ ...m, date: '2000-01-01' });
    if (s.wod) s.wod.score = normaliserWod({}).score;
    return { id: m.id || nouvelId(), nom: texte(m.nom || m.titre || 'Modèle', 80), type: s.type, exercices: s.exercices, wod: s.wod };
  }
  // Modèle de la base (forme compacte) → modèle de l'état.
  function modeleDeBase(m) {
    if (m.type === 'wod') {
      return normaliserModele({ id: m.id, nom: m.nom, type: 'wod', wod: { ...m.wod, mouvements: m.wod.mouvements.map(([ex, reps, distance]) => ({ ex, reps: reps || null, distance: distance || null })) } });
    }
    return normaliserModele({ id: m.id, nom: m.nom, type: 'series', exercices: m.exercices.map(([ex, n, reps, distance]) => ({ ex, series: Array.from({ length: n }, () => ({ reps: reps || null, temps: null, distance: distance || null })) })) });
  }
  // Nouvelle séance depuis un modèle : mêmes exercices et séries prévues, charges reprises du modèle.
  function seanceDepuisModele(m, date) {
    const s = normaliserSeance({ ...structuredClone(m), id: nouvelId(), date, titre: m.nom, modele: m.id });
    s.exercices.forEach((b) => { b.id = nouvelId(); });
    if (s.wod) s.wod.mouvements.forEach((x) => { x.id = nouvelId(); });
    return s;
  }
  // Modèle depuis une séance : exercices, séries et charges gardés, score et note retirés.
  function modeleDepuisSeance(s, nom) {
    return normaliserModele({ id: nouvelId(), nom: nom || s.titre || 'Modèle', type: s.type, exercices: structuredClone(s.exercices), wod: s.wod ? structuredClone(s.wod) : null });
  }
  function normaliserExercice(e = {}, groupes = []) {
    return { id: e.id || `p-${nouvelId()}`, nom: texte(e.nom, 80).trim() || 'Exercice', groupe: groupes.includes(e.groupe) ? e.groupe : (groupes[0] || 'autre'), mesure: MESURES.includes(e.mesure) ? e.mesure : 'charge', ...(e.mesure === 'distance' ? { allure: [100, 500, 1000].includes(e.allure) ? e.allure : 1000 } : {}) };
  }
  function normaliserReglages(r = {}, defauts = {}) {
    return {
      unite: ['kg', 'lb'].includes(r.unite) ? r.unite : (defauts.unite || 'kg'),
      formule: ['epley', 'brzycki'].includes(r.formule) ? r.formule : (defauts.formule || 'epley'),
      repsMax: Math.min(15, Math.max(1, entier(r.repsMax, 15) ?? defauts.repsMax ?? 10)),
    };
  }
  const etatVide = (defauts = {}) => ({ version: 1, reglages: normaliserReglages({}, defauts.reglages || {}), exercicesPerso: [], seances: [], modeles: [] });
  function normaliser(d, defauts = {}) {
    const e = etatVide(defauts);
    if (!d || typeof d !== 'object') return e;
    e.reglages = normaliserReglages(d.reglages || {}, defauts.reglages || {});
    const groupes = (defauts.groupes || []).map((g) => g.id);
    e.exercicesPerso = (Array.isArray(d.exercicesPerso) ? d.exercicesPerso : []).map((x) => normaliserExercice(x, groupes));
    e.seances = (Array.isArray(d.seances) ? d.seances : []).map(normaliserSeance);
    e.modeles = (Array.isArray(d.modeles) ? d.modeles : []).map(normaliserModele);
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  // Retire un exercice personnel ; refusé s'il est encore utilisé.
  function utilisations(etat, exId) {
    let n = 0;
    for (const s of [...etat.seances, ...etat.modeles]) {
      for (const b of s.exercices || []) if (b.ex === exId) n++;
      for (const m of s.wod?.mouvements || []) if (m.ex === exId) n++;
    }
    return n;
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nCsv = (x) => (x === null || x === undefined ? '' : String(arrondi2(x)).replace('.', ','));
  function versCsv(etat, base) {
    const idx = index(base, etat);
    const nomEx = (id) => idx.get(id)?.nom || id;
    const nomGr = (id) => base.groupes.find((g) => g.id === idx.get(id)?.groupe)?.nom || '';
    const tete = ['Date', 'Séance', 'Format', 'Exercice', 'Groupe', 'Série', 'Charge', 'Répétitions', 'Temps (s)', 'Distance (m)', 'Calories', 'RPE', '1RM estimé', 'Score WOD'];
    const lignes = [];
    for (const s of chronologiques(etat)) {
      if (s.type === 'wod') {
        s.wod.mouvements.forEach((m, i) => lignes.push([s.date, s.titre, descriptionWod(s.wod), nomEx(m.ex), nomGr(m.ex), '', nCsv(m.charge), nCsv(m.reps), nCsv(m.temps), nCsv(m.distance), nCsv(m.calories), '', '', i === 0 ? scoreTexte(s.wod) : '']));
      } else {
        for (const b of s.exercices) b.series.forEach((x, i) => lignes.push([s.date, s.titre, 'Séries', nomEx(b.ex), nomGr(b.ex), i + 1, nCsv(x.charge), nCsv(x.reps), nCsv(x.temps), nCsv(x.distance), nCsv(x.calories), nCsv(x.rpe), mesureDe(idx, b.ex) === 'charge' ? nCsv(un1RM(x.charge, x.reps, etat.reglages.formule, etat.reglages.repsMax)) : '', '']));
      }
    }
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.MSC = {
    TYPES, FORMATS, MESURES, CHAMPS, PRINCIPALE, TYPES_RECORD, LIB_RECORD,
    iso, versDate, ajout, ecart, estDate, lundi, arrondi, arrondi2, nombre, lireNombre, lireDuree, formatDuree,
    index, mesureDe, serieRemplie, un1RM, tonnageSerie, valeursSerie,
    toursEffectifs, minutesEmom, repsEffectuees, scoreRempli, comparerScores, scoreTexte, descriptionWod, sansAccents, cleWod,
    volumeSeance, volumePeriode, volumeSemaines, semainesAffilee,
    chronologiques, chronologieRecords, recordsSeance, recordsExercice, progression, historiqueWod, exercicesPratiques,
    planMinuteur, etatMinuteur, bips,
    nouvelId, normaliserSerie, normaliserMouvement, normaliserWod, normaliserBloc, normaliserSeance, normaliserModele, modeleDeBase,
    seanceDepuisModele, modeleDepuisSeance, normaliserExercice, normaliserReglages, etatVide, normaliser, utilisations, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
