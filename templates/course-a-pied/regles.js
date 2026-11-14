// Plan d'entraînement course à pied QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CRS) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; jours de la semaine 0 = lundi … 6 = dimanche.
// Temps en secondes, allures en secondes par kilomètre, distances en kilomètres (mètres dans les blocs de séance).
// Aucune donnée de santé : chronos, distances, durées et ressenti de l'effort seulement.
(function (racine) {
  'use strict';

  const STATUTS = ['prevue', 'faite', 'manquee'];
  const VERSION = 1;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const jourSemaine = (s) => (versDate(s).getDay() + 6) % 7;
  const lundi = (s) => ajout(s, -jourSemaine(s));

  // ---------- Nombres, durées, allures ----------
  function nombre(x, decimales = 1) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '–';
    const p = 10 ** decimales;
    const v = Math.round((x + Number.EPSILON) * p) / p;
    const [ent, dec] = Math.abs(v).toFixed(decimales).split('.');
    const milliers = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const d = dec && /[1-9]/.test(dec) ? ',' + dec.replace(/0+$/, '') : '';
    return (v < 0 ? '−' : '') + milliers + d;
  }
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    return Number(s);
  }
  // « 45:30 » → 2730 ; « 1:45:00 », « 1h45 », « 1h45m30 » → secondes ; « 50 » → 50 minutes (un chrono s'écrit en minutes).
  function lireDuree(saisie) {
    let s = String(saisie ?? '').trim().toLowerCase().replace(/\s/g, '').replace(/[.,]/g, ':');
    if (!s) return null;
    const h = s.match(/^(\d+)h(?:(\d{1,2})(?:m(?:in)?|:)?(?:(\d{1,2})s?)?)?$/);
    if (h) {
      const [, hh, mm = '0', ss = '0'] = h;
      if (Number(mm) > 59 || Number(ss) > 59) return null;
      return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
    }
    s = s.replace(/min$/, '').replace(/'/g, ':').replace(/"$/, '');
    if (/^\d+$/.test(s)) return Number(s) * 60;
    const m = s.match(/^(?:(\d+):)?(\d{1,3}):(\d{1,2})$/);
    if (!m) return null;
    const [, hh, mi, se] = m;
    if (Number(se) > 59 || (hh !== undefined && Number(mi) > 59)) return null;
    return Number(hh || 0) * 3600 + Number(mi) * 60 + Number(se);
  }
  function formatDuree(sec) {
    if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
    const t = Math.max(0, Math.round(sec));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`;
  }
  // Durée d'une séance en minutes, lisible : « 45 min », « 1 h 30 ».
  function formatMinutes(min) {
    if (!Number.isFinite(min)) return '–';
    const t = Math.round(min);
    if (t < 60) return `${t} min`;
    return `${Math.floor(t / 60)} h ${deux(t % 60)}`;
  }
  // Allure en secondes par km → « 5:20 ».
  const formatAllure = (s) => formatDuree(Math.round(s));
  const vitesse = (allure) => 3600 / allure; // km/h

  // ---------- Prédiction (formule de Riegel) ----------
  // T2 = T1 × (D2 ÷ D1)^k, k = 1,06 par défaut (Riegel, American Scientist, 1981).
  const riegel = (t1, d1, d2, k = 1.06) => t1 * (d2 / d1) ** k;
  // Distance que l'on couvrirait en un temps donné, d'après la même formule.
  const distancePourTemps = (t1, d1, t, k = 1.06) => d1 * (t / t1) ** (1 / k);

  // Référence la plus récente (la dernière saisie l'emporte à date égale).
  function referenceCourante(refs) {
    const l = (refs || []).filter((r) => r && r.km > 0 && r.temps > 0);
    if (!l.length) return null;
    return l.reduce((m, r) => (r.date >= m.date ? r : m));
  }

  // Allures de base et fourchettes d'entraînement (secondes par km) depuis la référence.
  // objectif : { km, temps } (temps visé facultatif : sinon le temps prédit pour la distance).
  function calculerAllures(ref, objectif, base, k = 1.06) {
    if (!ref) return null;
    const m = riegel(ref.temps, ref.km, 42.195, k) / 42.195;
    const c5 = riegel(ref.temps, ref.km, 5, k) / 5;
    const h = 3600 / distancePourTemps(ref.temps, ref.km, 3600, k);
    const kmObj = objectif?.km || ref.km;
    const tempsPredit = riegel(ref.temps, ref.km, kmObj, k);
    const tempsObjectif = objectif?.temps > 0 ? objectif.temps : tempsPredit;
    const bases = { m, c5, h, objectif: tempsObjectif / kmObj };
    const fourchettes = {};
    for (const [code, a] of Object.entries(base.allures)) {
      const b = bases[a.base];
      const lent = b * a.f[0], rapide = b * a.f[1];
      fourchettes[code] = { lent, rapide, milieu: (lent + rapide) / 2 };
    }
    return { bases, fourchettes, tempsPredit, tempsObjectif, kmObj };
  }

  function predictions(ref, liste, k = 1.06) {
    if (!ref) return [];
    return liste.map(([nom, km]) => ({ nom, km, temps: riegel(ref.temps, ref.km, km, k), allure: riegel(ref.temps, ref.km, km, k) / km, reference: Math.abs(km - ref.km) < 1e-6 }));
  }

  // Temps visé comparé au temps prédit : écart en % (négatif = plus rapide que la prédiction).
  function avisObjectif(tempsVise, tempsPredit) {
    if (!(tempsVise > 0) || !(tempsPredit > 0)) return null;
    const e = (tempsVise - tempsPredit) / tempsPredit;
    const niveau = e < -0.05 ? 'tres-ambitieux' : e < -0.01 ? 'ambitieux' : e <= 0.03 ? 'realiste' : 'prudent';
    return { ecart: e, niveau };
  }

  // Avertissements sur la référence : chrono ancien, extrapolation lointaine.
  function avertissementsReference(ref, kmObjectif, aujourdhui) {
    const l = [];
    if (!ref) return l;
    if (estDate(ref.date) && ecart(ref.date, aujourdhui) > 180) l.push('ancien');
    if (kmObjectif && (kmObjectif / ref.km > 4.5 || ref.km / kmObjectif > 4.5)) l.push('extrapolation');
    return l;
  }

  // ---------- Séances ----------
  const arrondi5 = (x) => Math.round(x / 5) * 5;
  const FACILES = ['footing', 'longue', 'recup'];

  // Blocs réellement prévus : volume choisi (footings, sorties longues, récupérations) et allègement éventuel.
  function blocsEffectifs(def, { volume = 1, allegee = false, allegement = 0.7 } = {}) {
    const facile = FACILES.includes(def.type);
    return def.blocs.map((b) => {
      const x = { ...b };
      if (x.course) return x;
      if (def.type === 'activation') return x;
      if (x.n === undefined && x.m !== undefined) {
        if (facile && FACILES.includes(x.a)) {
          if (volume !== 1) x.m = Math.max(15, arrondi5(x.m * volume));
          if (allegee) x.m = Math.max(15, arrondi5(x.m * allegement));
        } else if (allegee && (x.a === 'seuil' || x.a === 'specifique')) x.m = Math.max(5, arrondi5(x.m * 0.6));
        return x;
      }
      if (allegee && x.n !== undefined) {
        if (x.n > 1) x.n = Math.max(1, Math.round(x.n * 0.6));
        else if (x.d) x.d = Math.max(1000, Math.round(x.d * 0.6 / 500) * 500);
        else if (x.m) x.m = Math.max(5, arrondi5(x.m * 0.6));
      }
      return x;
    });
  }

  // Durée (minutes) et distance (km) estimées d'une liste de blocs, d'après les allures du coureur.
  function dureeKm(blocs, allures) {
    let min = 0, km = 0;
    const p = (a) => allures?.fourchettes?.[a]?.milieu || 360;
    const recup = () => p('recup');
    for (const b of blocs) {
      if (b.course) {
        const kmC = allures?.kmObj || 0;
        min += (allures?.tempsObjectif || 0) / 60; km += kmC;
        continue;
      }
      const n = b.n || 1;
      const r = n > 1 ? (n - 1) * (b.r || 0) : 0;
      let t; // secondes d'effort
      if (b.d) { km += n * b.d / 1000; t = n * b.d / 1000 * p(b.a); }
      else if (b.s) { t = n * b.s; km += t / p(b.a); }
      else { t = n * b.m * 60; km += t / p(b.a); }
      min += t / 60 + r;
      km += r * 60 / recup();
    }
    return { min, km };
  }

  // Description d'un bloc, lisible, avec la fourchette d'allure.
  function texteBloc(b, allures, base) {
    if (b.course) return 'La course';
    const a = base.allures[b.a];
    const f = allures?.fourchettes?.[b.a];
    const al = a.sansAllure || !f ? '' : ` (${formatAllure(f.rapide)}–${formatAllure(f.lent)} /km)`;
    const nomA = a.nom.toLowerCase().replace(/ \(.*\)$/, '');
    const r = b.n > 1 && b.r ? `, récupération ${b.r === 1.5 ? '1 min 30' : `${nombre(b.r)} min`} en trottinant` : '';
    if (b.s) return `${b.n} accélérations de ${b.s} s${r}`;
    if (b.d) return b.n > 1 ? `${b.n} × ${b.d >= 1000 ? `${nombre(b.d / 1000)} km` : `${b.d} m`} ${nomA}${al}${r}` : `${nombre(b.d / 1000)} km ${nomA}${al}`;
    if (b.n > 1) return `${b.n} × ${b.m} min ${nomA}${al}${r}`;
    return `${b.m} min ${nomA}${al}`;
  }

  // Titre d'une séance après allègement (les chiffres du titre suivent les blocs).
  function titreSeance(def, blocs) {
    if (def.type === 'course' || def.type === 'activation') return def.titre;
    const pr = blocs.find((b) => b.n !== undefined) || blocs[0];
    switch (def.type) {
      case 'footing': return blocs.length > 1 ? `Footing ${blocs[0].m + 5} min et accélérations` : `Footing ${blocs[0].m} min`;
      case 'recup': return `Récupération ${blocs[0].m} min`;
      case 'longue': return blocs.length > 1 ? `Sortie longue ${blocs[0].m + blocs[1].m} min dont ${blocs[1].m} min à l'allure spécifique` : `Sortie longue ${blocs[0].m} min`;
      case 'seuil': return pr.n !== undefined && pr.n > 1 ? `Seuil ${pr.n} × ${pr.m} min` : `Seuil ${blocs.find((b) => b.a === 'seuil').m} min continu`;
      case 'frac': return `Fractionné ${pr.n} × ${pr.d >= 1000 ? `${pr.d / 1000} km` : `${pr.d} m`}`;
      case 'specifique': return pr.n > 1 ? `Allure spécifique ${pr.n} × ${nombre(pr.d / 1000)} km` : `Allure spécifique ${nombre(pr.d / 1000)} km continu`;
      default: return def.titre;
    }
  }

  // ---------- Génération du plan ----------
  // Place les séances d'une semaine ordinaire sur les jours choisis : la sortie longue sur son jour, les séances
  // de qualité sur les jours les plus éloignés de la sortie longue (et pas deux jours de suite si possible),
  // les footings sur les jours restants.
  const distCyclique = (a, b) => { const d = Math.abs(a - b) % 7; return Math.min(d, 7 - d); };
  function placerSemaine(codes, jours, jourLongue, base) {
    const res = [];
    const restants = [...jours].filter((j) => j !== jourLongue).sort((a, b) => a - b);
    const iLongue = codes.findIndex((c) => base.seances[c]?.type === 'longue');
    if (iLongue >= 0 && jours.includes(jourLongue)) res.push({ code: codes[iLongue], jour: jourLongue });
    else if (iLongue >= 0) restants.push(jourLongue);
    const autres = codes.filter((_, i) => i !== iLongue);
    const qualite = autres.filter((c) => base.types[base.seances[c].type].qualite);
    const faciles = autres.filter((c) => !base.types[base.seances[c].type].qualite);
    const score = (j) => (jours.includes(jourLongue) ? distCyclique(j, jourLongue) : 3);
    const parScore = () => [...restants].sort((a, b) => score(b) - score(a) || a - b);
    const pris = [];
    for (const c of qualite) {
      const cand = parScore().filter((j) => !pris.includes(j));
      if (!cand.length) break;
      const j = cand.find((x) => pris.every((p) => distCyclique(p, x) > 1)) ?? cand[0];
      pris.push(j); res.push({ code: c, jour: j });
    }
    const libres = restants.filter((j) => !pris.includes(j));
    faciles.forEach((c, i) => { if (libres[i] !== undefined) res.push({ code: c, jour: libres[i] }); });
    return res.sort((a, b) => a.jour - b.jour);
  }

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // Calendrier des séances jusqu'à la course.
  // p : { distance, dateCourse, debut, seancesSemaine, jours (0 = lundi), jourLongue }
  function genererPlan(p, base) {
    const modele = base.plans[p.distance];
    if (!modele) throw new Error('Distance inconnue.');
    if (!estDate(p.dateCourse) || !estDate(p.debut)) throw new Error('Date illisible.');
    if (p.dateCourse <= p.debut) throw new Error('La date de la course doit être après le début du plan.');
    const n = p.seancesSemaine;
    if (!(n >= 3 && n <= 5)) throw new Error('De 3 à 5 séances par semaine.');
    const jours = [...new Set(p.jours)].filter((j) => j >= 0 && j <= 6);
    if (jours.length !== n) throw new Error(`Choisis ${n} jours de course dans la semaine.`);
    const jourLongue = jours.includes(p.jourLongue) ? p.jourLongue : Math.max(...jours);
    const N = modele.length;
    const lundiCourse = lundi(p.dateCourse);
    const premier = ajout(lundiCourse, -7 * (N - 1));
    const semaines = [];
    const seances = [];
    for (let k = 0; k < N; k++) {
      const l = ajout(premier, 7 * k);
      if (ajout(l, 6) < p.debut) continue;
      const w = modele[k];
      semaines.push({ lundi: l, numero: k + 1, phase: w.phase, allegeePlan: !!w.allegee });
      const ajouter = (code, date) => { if (date >= p.debut && date <= p.dateCourse) seances.push({ id: nouvelId(), date, code, statut: 'prevue', kmReel: null, dureeReel: null, ressenti: null, note: '' }); };
      if (k < N - 1) {
        for (const { code, jour } of placerSemaine(w.s.slice(0, n), jours, jourLongue, base)) ajouter(code, ajout(l, jour));
      } else {
        // Semaine de la course : séances sur les jours choisis avant la course, la plus proche de la course d'abord.
        const avant = jours.map((j) => ajout(l, j)).filter((d) => d < p.dateCourse && d >= p.debut).sort().reverse();
        w.s.slice(0, Math.min(n - 1, avant.length)).forEach((code, i) => ajouter(code, avant[i]));
        ajouter('course', p.dateCourse);
      }
    }
    if (semaines.length < 3) throw new Error('Course trop proche pour suivre un plan : il faut au moins trois semaines (celle de la course comprise).');
    seances.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { seances, semaines, raccourci: N - semaines.length, debutPlan: semaines[0].lundi, attente: premier > p.debut ? ecart(p.debut, premier) : 0 };
  }

  // Structure des semaines d'un plan (recalculée depuis sa date de course).
  function semainesDuPlan(plan, base) {
    const modele = base.plans[plan.distance] || [];
    const N = modele.length;
    const premier = ajout(lundi(plan.dateCourse), -7 * (N - 1));
    return modele.map((w, k) => ({ lundi: ajout(premier, 7 * k), numero: k + 1, phase: w.phase, allegeePlan: !!w.allegee }));
  }

  // Recalcule les séances à venir (jours, volume, date de course) en gardant le passé et ce qui est coché.
  function regenerer(plan, base, aujourdhui) {
    const garder = plan.seances.filter((s) => s.date < aujourdhui || s.statut !== 'prevue');
    const g = genererPlan({ ...plan, debut: aujourdhui }, base);
    const pris = new Set(garder.filter((s) => s.date >= aujourdhui).map((s) => s.date));
    const nouvelles = g.seances.filter((s) => !pris.has(s.date));
    return { ...plan, seances: [...garder, ...nouvelles].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
  }

  // ---------- Lecture du plan ----------
  const defSeance = (s, base) => base.seances[s.code] || null;
  const estAllegee = (plan, date) => (plan.semainesAllegees || []).includes(lundi(date));

  // Séance « résolue » : définition, blocs effectifs, titre, durée et distance estimées.
  function resoudre(s, plan, base, allures, reglages = {}) {
    const def = defSeance(s, base);
    if (!def) return null;
    const allegee = estAllegee(plan, s.date) && def.type !== 'course';
    const volume = base.volumes[plan.volume]?.f ?? 1;
    const blocs = blocsEffectifs(def, { volume, allegee, allegement: reglages.allegement ?? 0.7 });
    const { min, km } = dureeKm(blocs, allures);
    return { ...s, type: def.type, def, blocs, titre: titreSeance(def, blocs), min, km, allegee };
  }

  // Situation d'une séance par rapport à aujourd'hui.
  function situation(s, aujourdhui) {
    if (s.statut === 'faite') return 'faite';
    if (s.statut === 'manquee') return 'manquee';
    if (s.date === aujourdhui) return 'aujourdhui';
    return s.date < aujourdhui ? 'a-cocher' : 'a-venir';
  }

  // Bilan par semaine : prévu (avec allègement) et réalisé.
  function bilanSemaines(plan, base, allures, reglages = {}) {
    return semainesDuPlan(plan, base).map((w) => {
      const fin = ajout(w.lundi, 6);
      const ss = plan.seances.filter((s) => s.date >= w.lundi && s.date <= fin).map((s) => resoudre(s, plan, base, allures, reglages)).filter(Boolean);
      const faites = ss.filter((s) => s.statut === 'faite');
      const notes = faites.filter((s) => s.ressenti);
      return {
        ...w,
        allegee: (plan.semainesAllegees || []).includes(w.lundi),
        seances: ss,
        kmPrevu: ss.reduce((t, s) => t + s.km, 0),
        minPrevu: ss.reduce((t, s) => t + s.min, 0),
        kmFait: faites.reduce((t, s) => t + (s.kmReel ?? s.km), 0),
        faites: faites.length,
        manquees: ss.filter((s) => s.statut === 'manquee').length,
        ressentiMoyen: notes.length ? notes.reduce((t, s) => t + s.ressenti, 0) / notes.length : null,
      };
    }).filter((w) => w.seances.length || !estDate(plan.debut) || ajout(w.lundi, 6) >= plan.debut);
  }

  // Suggestions d'adaptation (jamais appliquées seules).
  function suggestions(plan, base, aujourdhui) {
    const l = [];
    const sem = lundi(aujourdhui);
    const dejaAllegee = (d) => (plan.semainesAllegees || []).includes(d);
    const restePrevue = plan.seances.some((s) => s.statut === 'prevue' && s.date >= aujourdhui && lundi(s.date) === sem && s.code !== 'course');
    const cible = restePrevue ? sem : ajout(sem, 7);
    const course = plan.seances.find((s) => s.code === 'course');
    const cibleValide = !course || cible < lundi(course.date);
    const faites = plan.seances.filter((s) => s.statut === 'faite' && s.date <= aujourdhui && ecart(s.date, aujourdhui) <= 14).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-4);
    const durs = faites.filter((s) => s.ressenti >= 4).length;
    if (faites.length >= 3 && durs >= 3 && !dejaAllegee(cible) && cibleValide) l.push({ type: 'fatigue', lundi: cible, durs });
    const manquees = plan.seances.filter((s) => s.statut === 'manquee' && s.date <= aujourdhui && ecart(s.date, aujourdhui) < 7).length;
    if (manquees >= 2) l.push({ type: 'manquees', lundi: cible, nombre: manquees, proposer: !dejaAllegee(cible) && cibleValide });
    return l;
  }

  // Jours libres pour déplacer une séance : dans sa semaine, à partir d'aujourd'hui, avant la course.
  function joursLibres(plan, s, aujourdhui) {
    const l = lundi(s.date);
    const course = plan.seances.find((x) => x.code === 'course')?.date || plan.dateCourse;
    const res = [];
    for (let i = 0; i < 7; i++) {
      const d = ajout(l, i);
      if (d < aujourdhui || d === s.date || d >= course) continue;
      if (plan.seances.some((x) => x.id !== s.id && x.date === d)) continue;
      res.push(d);
    }
    return res;
  }

  // Contrôle d'un déplacement : erreur bloquante ou avertissements.
  function verifierDeplacement(plan, s, date, base) {
    const def = defSeance(s, base);
    if (!estDate(date)) return { erreur: 'Date illisible.', avertissements: [] };
    if (def?.type === 'course') return { erreur: 'La course se déplace en changeant sa date dans l\'objectif.', avertissements: [] };
    const course = plan.seances.find((x) => x.code === 'course')?.date || plan.dateCourse;
    if (date >= course) return { erreur: 'Une séance ne peut pas être placée le jour de la course ou après.', avertissements: [] };
    const av = [];
    const autres = plan.seances.filter((x) => x.id !== s.id && x.statut !== 'manquee');
    const typeDe = (x) => base.seances[x.code]?.type;
    if (autres.some((x) => x.date === date)) av.push('meme-jour');
    if (def && base.types[def.type].qualite) {
      if (autres.some((x) => base.types[typeDe(x)]?.qualite && Math.abs(ecart(x.date, date)) === 1)) av.push('qualite-voisine');
      if (autres.some((x) => typeDe(x) === 'longue' && ecart(date, x.date) === 1)) av.push('veille-longue');
    }
    if (lundi(date) !== lundi(s.date)) av.push('autre-semaine');
    return { erreur: null, avertissements: av };
  }

  // ---------- Normalisation ----------
  const texte = (v, max = 500) => String(v ?? '').slice(0, max);
  const nombreOuNull = (v, min = 0, max = Infinity) => (Number.isFinite(v) && v >= min && v <= max ? v : null);

  function normaliserReference(r) {
    const x = r || {};
    return { id: typeof x.id === 'string' && x.id ? x.id : nouvelId(), date: estDate(x.date) ? x.date : iso(new Date()), km: nombreOuNull(Number(x.km), 1, 100) ?? 10, temps: nombreOuNull(Number(x.temps), 60, 86400) ?? 3600, libelle: texte(x.libelle, 80) };
  }
  function normaliserSeance(s) {
    const x = s || {};
    return {
      id: typeof x.id === 'string' && x.id ? x.id : nouvelId(),
      date: estDate(x.date) ? x.date : iso(new Date()),
      code: String(x.code || 'f30'),
      statut: STATUTS.includes(x.statut) ? x.statut : 'prevue',
      kmReel: nombreOuNull(x.kmReel, 0, 300),
      dureeReel: nombreOuNull(x.dureeReel, 0, 86400 * 2),
      ressenti: [1, 2, 3, 4, 5].includes(x.ressenti) ? x.ressenti : null,
      note: texte(x.note),
    };
  }
  function normaliserPlan(p, base) {
    if (!p || typeof p !== 'object') return null;
    const distance = base.plans[p.distance] ? p.distance : 'semi';
    const n = [3, 4, 5].includes(p.seancesSemaine) ? p.seancesSemaine : 4;
    const jours = Array.isArray(p.jours) ? [...new Set(p.jours.filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))].sort() : [1, 3, 5, 6];
    return {
      id: typeof p.id === 'string' && p.id ? p.id : nouvelId(),
      distance,
      dateCourse: estDate(p.dateCourse) ? p.dateCourse : ajout(iso(new Date()), 7 * base.plans[distance].length),
      nomCourse: texte(p.nomCourse, 80),
      tempsVise: nombreOuNull(p.tempsVise, 60, 86400),
      debut: estDate(p.debut) ? p.debut : iso(new Date()),
      seancesSemaine: n,
      jours,
      jourLongue: jours.includes(p.jourLongue) ? p.jourLongue : (jours.length ? Math.max(...jours) : 6),
      volume: base.volumes[p.volume] ? p.volume : 'normal',
      seances: (Array.isArray(p.seances) ? p.seances : []).map(normaliserSeance).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      semainesAllegees: Array.isArray(p.semainesAllegees) ? [...new Set(p.semainesAllegees.filter(estDate))] : [],
      cree: estDate(p.cree) ? p.cree : iso(new Date()),
    };
  }
  function normaliserReglages(r, defauts) {
    const x = { ...defauts, ...(r || {}) };
    return { exposant: nombreOuNull(Number(x.exposant), 1, 1.2) ?? defauts.exposant, allegement: nombreOuNull(Number(x.allegement), 0.4, 0.95) ?? defauts.allegement };
  }
  const etatVide = (base) => ({ version: VERSION, reglages: normaliserReglages({}, base.reglages), references: [], plan: null, archives: [] });
  function normaliser(d, base) {
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.reglages = normaliserReglages(d.reglages, base.reglages);
    e.references = (Array.isArray(d.references) ? d.references : []).map(normaliserReference);
    e.plan = normaliserPlan(d.plan, base);
    e.archives = (Array.isArray(d.archives) ? d.archives : []).map((p) => normaliserPlan(p, base)).filter(Boolean).slice(-20);
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Exports ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nCsv = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? '' : String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ','));
  function versCsv(plan, base, allures, reglages) {
    const tete = ['Date', 'Semaine', 'Phase', 'Séance', 'Type', 'Durée prévue (min)', 'Distance prévue (km)', 'Statut', 'Distance réelle (km)', 'Durée réelle', 'Allure réelle (/km)', 'Ressenti', 'Note'];
    const sem = semainesDuPlan(plan, base);
    const lib = { prevue: 'Prévue', faite: 'Faite', manquee: 'Manquée' };
    const lignes = plan.seances.map((s) => {
      const r = resoudre(s, plan, base, allures, reglages);
      const w = sem.find((x) => x.lundi === lundi(s.date));
      const allure = s.kmReel && s.dureeReel ? formatAllure(s.dureeReel / s.kmReel) : '';
      return [s.date, w ? w.numero : '', w ? base.phases[w.phase].nom : '', r?.titre || s.code, r ? base.types[r.type].nom : '', nCsv(r?.min, 0), nCsv(r?.km, 1), lib[s.statut], nCsv(s.kmReel), s.dureeReel ? formatDuree(s.dureeReel) : '', allure, s.ressenti ? base.ressentis[s.ressenti - 1][1] : '', s.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  // iCalendar (RFC 5545) : un événement « journée » par séance à venir ou passée, avec le détail des blocs.
  const echapIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function plier(ligne) {
    // Lignes de 75 octets au plus, suite précédée d'une espace.
    const enc = new TextEncoder();
    const morceaux = [];
    let cour = '';
    for (const c of ligne) {
      const lim = morceaux.length ? 74 : 75;
      if (enc.encode(cour + c).length > lim) { morceaux.push(cour); cour = c; } else cour += c;
    }
    morceaux.push(cour);
    return morceaux.join('\r\n ');
  }
  function versIcs(plan, base, allures, reglages, horodatage) {
    const stamp = horodatage.replace(/[-:]/g, '').replace(/\.\d+/, '');
    const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QME//Plan course a pied//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const s of plan.seances) {
      const r = resoudre(s, plan, base, allures, reglages);
      if (!r) continue;
      const desc = [...r.blocs.map((b) => texteBloc(b, allures, base)), r.def.consigne, `Environ ${formatMinutes(r.min)} · ${nombre(r.km)} km`].join('\n');
      l.push('BEGIN:VEVENT', `UID:${s.id}@course-a-pied.qm-engineering.fr`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${s.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${ajout(s.date, 1).replace(/-/g, '')}`,
        plier(`SUMMARY:${echapIcs(`Course à pied · ${r.titre}`)}`), plier(`DESCRIPTION:${echapIcs(desc)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    l.push('END:VCALENDAR');
    return l.join('\r\n') + '\r\n';
  }

  racine.CRS = {
    STATUTS, VERSION,
    iso, versDate, ajout, ecart, estDate, jourSemaine, lundi,
    nombre, lireNombre, lireDuree, formatDuree, formatMinutes, formatAllure, vitesse,
    riegel, distancePourTemps, referenceCourante, calculerAllures, predictions, avisObjectif, avertissementsReference,
    blocsEffectifs, dureeKm, texteBloc, titreSeance,
    placerSemaine, genererPlan, semainesDuPlan, regenerer,
    defSeance, estAllegee, resoudre, situation, bilanSemaines, suggestions, joursLibres, verifierDeplacement,
    nouvelId, normaliserReference, normaliserSeance, normaliserPlan, normaliserReglages, etatVide, normaliser,
    versCsv, versIcs, plier,
  };
})(typeof window !== 'undefined' ? window : globalThis);
