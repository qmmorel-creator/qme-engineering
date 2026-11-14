// Gestion de compétition sportive QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CMP) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ », heures « HH:MM ». Temps en secondes (dixièmes admis). Le classement n'est
// jamais saisi : il se calcule à partir des scores, selon les réglages de la compétition.
(function (racine) {
  'use strict';

  const TYPES = {
    temps: { nom: 'Pour le temps', sens: -1 },
    reps: { nom: 'Répétitions', sens: 1 },
    charge: { nom: 'Charge', sens: 1 },
    points: { nom: 'Points', sens: 1 },
  };
  const STATUTS_SCORE = { ok: 'Terminé', cap: 'Temps limite', dns: 'Absent', dq: 'Disqualifié' };
  const STATUTS = { inscrit: 'Inscrit', confirme: 'Confirmé', forfait: 'Forfait' };
  const METHODES = { rang: 'Somme des rangs (le total le plus bas gagne)', bareme: 'Barème de points (le total le plus haut gagne)' };
  const DEPARTAGES = { places: 'Le plus de meilleures places (1res, puis 2es…)', derniere: 'Le meilleur rang sur la dernière épreuve disputée', aucun: 'Aucun : ex aequo' };
  const ORDRES = { classement: 'Classement provisoire (les mieux classés en dernier)', dossard: 'Numéro de dossard', tirage: 'Tirage au sort' };

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const minutes = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const hhmm = (m) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${deux(Math.floor(v / 60))}:${deux(v % 60)}`; };
  // Instant comparable « AAAA-MM-JJTHH:MM » (minutes depuis l'époque locale) pour le programme.
  const instant = (date, min) => Math.round(versDate(date).getTime() / 60000) + min;

  // ---------- Saisie et affichage ----------
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function nombre(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '–';
    const r = Math.round(v * 100) / 100;
    const [ent, fr] = String(Math.abs(r)).split('.');
    return `${r < 0 ? '−' : ''}${milliers(ent)}${fr ? `,${fr}` : ''}`;
  }
  // « 12:34 », « 1:02:03 », « 12:34,5 », « 12'34 », « 45 » (secondes) → secondes ; null si illisible.
  function lireTemps(saisie) {
    const s = String(saisie ?? '').trim().replace(/\s/g, '').replace(/[’'′]/g, ':').replace(/[″"]/g, '').replace(',', '.');
    if (!s) return null;
    let m = s.match(/^(\d+):([0-5]?\d):([0-5]\d(?:\.\d)?)$/);
    if (m) return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 10) / 10;
    m = s.match(/^(\d+):([0-5]\d(?:\.\d)?)$/);
    if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 10) / 10;
    m = s.match(/^(\d+(?:\.\d)?)$/);
    if (m) return Number(m[1]);
    return null;
  }
  function afficherTemps(sec) {
    if (sec === null || sec === undefined || !Number.isFinite(sec)) return '–';
    const dixiemes = Math.round(sec * 10) % 10;
    const t = Math.floor(Math.round(sec * 10) / 10);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const base = h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`;
    return dixiemes ? `${base},${dixiemes}` : base;
  }
  // Nombre positif (virgule ou point, 2 décimales max) ; entier si demandé.
  function lireValeur(saisie, { entier = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.').replace(/(kg|reps?|pts?|cal|m)$/i, '');
    if (!s || !(entier ? /^\d+$/ : /^\d+(\.\d{1,2})?$/).test(s)) return null;
    return Number(s);
  }

  // ---------- Identifiants et normalisation ----------
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const texte = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const entier = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
  const nombreOuNul = (v, min = 0) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < min ? null : Number(v));

  function normaliserCategorie(c) {
    return { id: String(c.id || nouvelId()), nom: texte(c.nom, 60) || 'Catégorie', equipe: Boolean(c.equipe), taille: entier(c.taille, 2, 12, 2) };
  }
  function normaliserParticipant(p) {
    return {
      id: String(p.id || nouvelId()), nom: texte(p.nom, 80), categorie: String(p.categorie || ''), club: texte(p.club, 80),
      membres: (Array.isArray(p.membres) ? p.membres : String(p.membres || '').split('\n')).map((m) => texte(m, 60)).filter(Boolean).slice(0, 12),
      dossard: entier(p.dossard, 1, 99999, null), statut: STATUTS[p.statut] ? p.statut : 'inscrit',
      paye: Boolean(p.paye), pieces: Boolean(p.pieces), email: texte(p.email, 120), telephone: texte(p.telephone, 30),
      public: p.public !== false, note: texte(p.note, 300),
    };
  }
  function normaliserVague(v) {
    return { id: String(v.id || nouvelId()), categorie: String(v.categorie || ''), couloirs: (Array.isArray(v.couloirs) ? v.couloirs : []).map((x) => (x ? String(x) : null)).slice(0, 40) };
  }
  function normaliserEpreuve(e) {
    return {
      id: String(e.id || nouvelId()), nom: texte(e.nom, 80) || 'Épreuve', type: TYPES[e.type] ? e.type : 'temps',
      description: String(e.description ?? '').trim().slice(0, 600),
      capMin: nombreOuNul(e.capMin, 0.5), repsTotal: e.repsTotal ? entier(e.repsTotal, 1, 100000, null) : null,
      departage: Boolean(e.departage), coefficient: nombreOuNul(e.coefficient, 0.1) ?? 1,
      categories: Array.isArray(e.categories) ? e.categories.map(String) : [],
      date: estDate(e.date) ? e.date : null, heure: estHeure(e.heure) ? e.heure : null,
      couloirs: entier(e.couloirs, 1, 40, 8), battementMin: entier(e.battementMin, 0, 120, 4),
      ordre: ORDRES[e.ordre] ? e.ordre : 'classement',
      vagues: (Array.isArray(e.vagues) ? e.vagues : []).map(normaliserVague),
    };
  }
  function normaliserScore(s) {
    if (!s || typeof s !== 'object') return null;
    const statut = STATUTS_SCORE[s.statut] ? s.statut : 'ok';
    const valeur = nombreOuNul(s.valeur);
    if ((statut === 'ok' || statut === 'cap') && valeur === null) return null;
    return { statut, valeur: statut === 'dns' || statut === 'dq' ? null : valeur, departage: nombreOuNul(s.departage), valide: Boolean(s.valide) };
  }
  function etatVide(defauts = {}) {
    return {
      version: 1,
      competition: { nom: '', lieu: '', dateDebut: null, dateFin: null, organisation: '' },
      categories: [], participants: [], epreuves: [], scores: {},
      reglages: structuredCopie(defauts.reglages || {}),
      publication: { active: false, sel: null, id: null, publieLe: null },
    };
  }
  const structuredCopie = (o) => JSON.parse(JSON.stringify(o));
  function normaliser(d, defauts = {}) {
    const e = etatVide(defauts);
    if (!d || typeof d !== 'object') return e;
    const c = d.competition || {};
    e.competition = { nom: texte(c.nom, 100), lieu: texte(c.lieu, 100), organisation: texte(c.organisation, 100), dateDebut: estDate(c.dateDebut) ? c.dateDebut : null, dateFin: estDate(c.dateFin) ? c.dateFin : null };
    e.categories = (d.categories || []).map(normaliserCategorie);
    e.participants = (d.participants || []).map(normaliserParticipant);
    e.epreuves = (d.epreuves || []).map(normaliserEpreuve);
    const ids = new Set(e.participants.map((p) => p.id));
    for (const ep of e.epreuves) {
      const src = (d.scores || {})[ep.id] || {};
      const dest = {};
      for (const [pid, s] of Object.entries(src)) { const n = normaliserScore(s); if (n && ids.has(pid)) dest[pid] = n; }
      e.scores[ep.id] = dest;
    }
    const r = d.reglages || {};
    const def = defauts.reglages || {};
    e.reglages = {
      methode: METHODES[r.methode] ? r.methode : (def.methode || 'rang'),
      bareme: { premier: entier(r.bareme?.premier, 1, 10000, def.bareme?.premier ?? 100), pas: nombreOuNul(r.bareme?.pas) ?? (def.bareme?.pas ?? 4), plancher: nombreOuNul(r.bareme?.plancher) ?? (def.bareme?.plancher ?? 0) },
      departage: DEPARTAGES[r.departage] ? r.departage : (def.departage || 'places'),
      nomPublic: r.nomPublic === 'initiale' ? 'initiale' : (r.nomPublic === 'complet' ? 'complet' : (def.nomPublic || 'complet')),
      reposMin: entier(r.reposMin, 0, 600, def.reposMin ?? 20),
      ecranSecondes: entier(r.ecranSecondes, 5, 120, def.ecranSecondes ?? 15),
      ecranLignes: entier(r.ecranLignes, 4, 30, def.ecranLignes ?? 10),
    };
    const p = d.publication || {};
    e.publication = { active: Boolean(p.active), sel: typeof p.sel === 'string' && /^[0-9A-Z]{8,32}$/.test(p.sel) ? p.sel : null, id: typeof p.id === 'string' ? p.id.slice(0, 40) : null, publieLe: typeof p.publieLe === 'string' ? p.publieLe : null };
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Inscrits ----------
  const prochainDossard = (etat) => etat.participants.reduce((m, p) => Math.max(m, p.dossard || 0), 0) + 1;
  const engage = (p) => p.statut !== 'forfait';
  const categorieDe = (etat, id) => etat.categories.find((c) => c.id === id) || null;
  const concerne = (ep, p) => engage(p) && (!ep.categories.length || ep.categories.includes(p.categorie)) && Boolean(p.categorie);
  const epreuvesDe = (etat, catId) => etat.epreuves.filter((ep) => !ep.categories.length || ep.categories.includes(catId));
  // Nom affiché en public : complet, « Prénom N. », ou dossard si l'inscrit n'a pas donné son accord.
  function nomPublic(p, reglages, cat) {
    if (!p.public) return p.dossard ? `Dossard ${p.dossard}` : 'Participant';
    if (reglages.nomPublic !== 'initiale' || (cat && cat.equipe)) return p.nom;
    const mots = p.nom.split(' ').filter(Boolean);
    if (mots.length < 2) return p.nom;
    return `${mots[0]} ${mots.slice(1).map((m) => `${m[0].toUpperCase()}.`).join(' ')}`;
  }

  // ---------- Scores ----------
  const score = (etat, epId, pid) => etat.scores[epId]?.[pid] || null;
  // Comparaison de deux scores classés : négatif si a est meilleur.
  function comparer(ep, a, b) {
    if (ep.type === 'temps') {
      const fa = a.statut === 'ok', fb = b.statut === 'ok';
      if (fa !== fb) return fa ? -1 : 1;
      const d = fa ? a.valeur - b.valeur : b.valeur - a.valeur;
      if (d) return d;
    } else {
      const d = b.valeur - a.valeur;
      if (d) return d;
    }
    if (ep.departage && a.departage !== null && b.departage !== null) return a.departage - b.departage;
    if (ep.departage && (a.departage !== null) !== (b.departage !== null)) return a.departage !== null ? -1 : 1;
    return 0;
  }
  const classe = (s) => s && (s.statut === 'ok' || s.statut === 'cap');

  function afficherScore(ep, s) {
    if (!s) return '';
    if (s.statut === 'dns') return 'Absent';
    if (s.statut === 'dq') return 'Disqualifié';
    let t;
    if (ep.type === 'temps') {
      if (s.statut === 'ok') t = afficherTemps(s.valeur);
      else t = ep.repsTotal ? `CAP+${Math.max(0, ep.repsTotal - s.valeur)}` : `CAP · ${nombre(s.valeur)} reps`;
    } else if (ep.type === 'reps') t = `${nombre(s.valeur)} reps`;
    else if (ep.type === 'charge') t = `${nombre(s.valeur)} kg`;
    else t = `${nombre(s.valeur)} pts`;
    return ep.departage && s.departage !== null ? `${t} (dép. ${afficherTemps(s.departage)})` : t;
  }

  const pointsBareme = (rang, b) => Math.max(b.plancher || 0, b.premier - (rang - 1) * b.pas);

  // Classement d'une épreuve dans une catégorie. Rang de compétition (1, 2, 2, 4) ; sans score : nbClasses + 1.
  function classementEpreuve(etat, ep, catId) {
    const engages = etat.participants.filter((p) => p.categorie === catId && concerne(ep, p));
    const avec = engages.map((p) => ({ participant: p, score: score(etat, ep.id, p.id) }));
    const classes = avec.filter((x) => classe(x.score)).sort((x, y) => comparer(ep, x.score, y.score) || (x.participant.dossard || 0) - (y.participant.dossard || 0));
    classes.forEach((x, i) => { x.rang = i > 0 && comparer(ep, classes[i - 1].score, x.score) === 0 ? classes[i - 1].rang : i + 1; x.etat = 'classe'; });
    const rangSans = classes.length + 1;
    const autres = avec.filter((x) => !classe(x.score)).map((x) => ({ ...x, rang: null, etat: x.score ? 'sans' : 'attente' }));
    const lignes = [...classes, ...autres];
    for (const l of lignes) {
      l.rangCompte = l.rang ?? rangSans;
      l.points = l.rang ? pointsBareme(l.rang, etat.reglages.bareme) : 0;
      l.affichage = afficherScore(ep, l.score);
    }
    return { epreuve: ep, lignes, nbClasses: classes.length, nbAttente: autres.filter((x) => x.etat === 'attente').length, compte: avec.some((x) => x.score) };
  }

  // Classement général d'une catégorie. jusqua : index d'épreuve exclu (classement avant une épreuve).
  function classementGeneral(etat, catId, { jusqua = Infinity } = {}) {
    const r = etat.reglages;
    const bareme = r.methode === 'bareme';
    const eps = epreuvesDe(etat, catId).filter((ep) => etat.epreuves.indexOf(ep) < jusqua);
    const parEp = eps.map((ep) => classementEpreuve(etat, ep, catId)).filter((c) => c.compte);
    const engages = etat.participants.filter((p) => p.categorie === catId && engage(p));
    const lignes = engages.map((p) => {
      const resultats = {};
      let total = 0;
      const rangs = [];
      for (const c of parEp) {
        const l = c.lignes.find((x) => x.participant.id === p.id);
        if (!l) continue;
        const coef = c.epreuve.coefficient || 1;
        const contrib = bareme ? l.points * coef : l.rangCompte * coef;
        total += contrib;
        rangs.push(l.rangCompte);
        resultats[c.epreuve.id] = { rang: l.rang, rangCompte: l.rangCompte, points: Math.round(contrib * 100) / 100, affichage: l.affichage, etat: l.etat, valide: Boolean(l.score?.valide) };
      }
      return { participant: p, total: Math.round(total * 100) / 100, resultats, rangs };
    });
    const derniereIds = parEp.map((c) => c.epreuve.id).reverse();
    const departager = (a, b) => {
      if (r.departage === 'places') {
        const max = Math.max(1, ...a.rangs, ...b.rangs);
        for (let k = 1; k <= max; k++) {
          const d = b.rangs.filter((x) => x === k).length - a.rangs.filter((x) => x === k).length;
          if (d) return d;
        }
      } else if (r.departage === 'derniere') {
        for (const id of derniereIds) {
          const d = (a.resultats[id]?.rangCompte ?? 1e9) - (b.resultats[id]?.rangCompte ?? 1e9);
          if (d) return d;
        }
      }
      return 0;
    };
    const cmp = (a, b) => (bareme ? b.total - a.total : a.total - b.total) || departager(a, b);
    lignes.sort((a, b) => cmp(a, b) || (a.participant.dossard || 0) - (b.participant.dossard || 0) || a.participant.nom.localeCompare(b.participant.nom));
    lignes.forEach((l, i) => { l.rang = i > 0 && cmp(lignes[i - 1], l) === 0 ? lignes[i - 1].rang : i + 1; l.exaequo = false; });
    lignes.forEach((l, i) => { l.exaequo = lignes.some((x, j) => j !== i && x.rang === l.rang); });
    const manquants = parEp.reduce((s, c) => s + c.nbAttente, 0);
    const forfaits = etat.participants.filter((p) => p.categorie === catId && !engage(p));
    return { lignes, epreuves: parEp.map((c) => c.epreuve), toutes: eps, manquants, provisoire: manquants > 0 || parEp.length < eps.length, forfaits };
  }

  // ---------- Vagues et programme ----------
  const dureeVague = (ep) => (ep.capMin ?? 10) + ep.battementMin;
  // Tirage reproductible (graine tirée de l'identifiant de l'épreuve).
  function melanger(liste, graineTexte) {
    let g = [...String(graineTexte)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
    const alea = () => { g = (g + 0x6D2B79F5) | 0; let x = Math.imul(g ^ (g >>> 15), 1 | g); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const r = [...liste];
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  // Tailles équilibrées : n inscrits en vagues de c couloirs au plus (10 en 8 couloirs → 5 et 5).
  function tailles(n, c) {
    if (!n) return [];
    const k = Math.ceil(n / c);
    const base = Math.floor(n / k), reste = n % k;
    return Array.from({ length: k }, (_, i) => base + (i >= k - reste ? 1 : 0));
  }
  // Génère les vagues d'une épreuve, catégorie après catégorie (ordre des catégories de la compétition).
  function genererVagues(etat, epId, options = {}) {
    const ep = etat.epreuves.find((x) => x.id === epId);
    if (!ep) return [];
    const couloirs = options.couloirs ?? ep.couloirs;
    const ordre = options.ordre ?? ep.ordre;
    const idx = etat.epreuves.indexOf(ep);
    const vagues = [];
    for (const cat of etat.categories) {
      let liste = etat.participants.filter((p) => p.categorie === cat.id && concerne(ep, p));
      if (!liste.length) continue;
      const parDossard = (a, b) => (a.dossard || 0) - (b.dossard || 0) || a.nom.localeCompare(b.nom);
      if (ordre === 'tirage') liste = melanger(liste.sort(parDossard), `${ep.id}:${cat.id}`);
      else if (ordre === 'classement' && idx > 0) {
        const cg = classementGeneral(etat, cat.id, { jusqua: idx });
        if (cg.epreuves.length) {
          const rang = new Map(cg.lignes.map((l) => [l.participant.id, l.rang]));
          liste.sort((a, b) => (rang.get(b.id) ?? 1e9) - (rang.get(a.id) ?? 1e9) || parDossard(b, a));
        } else liste.sort(parDossard);
      } else liste.sort(parDossard);
      let i = 0;
      for (const t of tailles(liste.length, couloirs)) {
        vagues.push({ id: nouvelId(), categorie: cat.id, couloirs: liste.slice(i, i + t).map((p) => p.id) });
        i += t;
      }
    }
    return vagues;
  }
  // Horaire d'une vague : début de l'épreuve + rang de la vague × durée.
  function horaire(ep, index) {
    if (!ep.heure) return null;
    const debut = minutes(ep.heure) + index * dureeVague(ep);
    return { debut: hhmm(debut), fin: hhmm(debut + (ep.capMin ?? 10)), debutMin: debut, finMin: debut + (ep.capMin ?? 10) };
  }
  // Programme complet : toutes les vagues datées, dans l'ordre chronologique.
  function programme(etat) {
    const l = [];
    etat.epreuves.forEach((ep, ie) => {
      ep.vagues.forEach((v, i) => {
        const h = horaire(ep, i);
        const date = ep.date || etat.competition.dateDebut;
        l.push({ epreuve: ep, ie, vague: v, numero: i + 1, h, date, debut: h && date ? instant(date, h.debutMin) : null, fin: h && date ? instant(date, h.finMin) : null });
      });
    });
    return l.sort((a, b) => (a.debut ?? Infinity) - (b.debut ?? Infinity) || a.ie - b.ie || a.numero - b.numero);
  }
  // Vagues en cours et à venir à un instant donné (date « AAAA-MM-JJ » et minutes depuis minuit).
  function enPiste(etat, date, min) {
    const t = instant(date, min);
    const prog = programme(etat).filter((x) => x.debut !== null);
    return { enCours: prog.find((x) => x.debut <= t && t < x.fin + (x.epreuve.battementMin || 0)) || null, suivantes: prog.filter((x) => x.debut > t) };
  }
  // Repos insuffisant : deux vagues d'un même participant à moins de reposMin minutes (ou qui se chevauchent).
  function alertesRepos(etat) {
    const parP = new Map();
    for (const x of programme(etat)) {
      if (x.debut === null) continue;
      for (const pid of x.vague.couloirs) if (pid) { if (!parP.has(pid)) parP.set(pid, []); parP.get(pid).push(x); }
    }
    const out = [];
    for (const [pid, liste] of parP) {
      for (let i = 1; i < liste.length; i++) {
        const ecart = liste[i].debut - liste[i - 1].fin;
        if (ecart < etat.reglages.reposMin) {
          const p = etat.participants.find((y) => y.id === pid);
          if (p) out.push({ participant: p, avant: liste[i - 1], apres: liste[i], ecart });
        }
      }
    }
    return out.sort((a, b) => a.ecart - b.ecart);
  }
  // Inscrits engagés absents des vagues d'une épreuve qui en a (inscrits après la génération).
  function horsVagues(etat, ep) {
    if (!ep.vagues.length) return [];
    const dans = new Set(ep.vagues.flatMap((v) => v.couloirs).filter(Boolean));
    return etat.participants.filter((p) => concerne(ep, p) && !dans.has(p.id));
  }
  // Ordre de saisie : celui des vagues s'il y en a, puis le reste par dossard.
  function ordreSaisie(etat, ep, catId) {
    const liste = etat.participants.filter((p) => p.categorie === catId && concerne(ep, p));
    const pos = new Map();
    ep.vagues.forEach((v, i) => v.couloirs.forEach((pid, c) => { if (pid) pos.set(pid, { vague: i + 1, couloir: c + 1 }); }));
    return liste.map((p) => ({ participant: p, place: pos.get(p.id) || null }))
      .sort((a, b) => (a.place ? a.place.vague * 100 + a.place.couloir : 1e6 + (a.participant.dossard || 0)) - (b.place ? b.place.vague * 100 + b.place.couloir : 1e6 + (b.participant.dossard || 0)));
  }

  // ---------- Synthèse ----------
  function synthese(etat) {
    const engages = etat.participants.filter(engage);
    let attendus = 0, saisis = 0, valides = 0;
    for (const ep of etat.epreuves) for (const p of engages) if (concerne(ep, p)) {
      attendus++;
      const s = score(etat, ep.id, p.id);
      if (s) { saisis++; if (s.valide) valides++; }
    }
    return {
      inscrits: etat.participants.length, engages: engages.length,
      forfaits: etat.participants.length - engages.length,
      nonPayes: engages.filter((p) => !p.paye).length,
      sansCategorie: etat.participants.filter((p) => !categorieDe(etat, p.categorie)).length,
      parCategorie: etat.categories.map((c) => ({ categorie: c, nb: engages.filter((p) => p.categorie === c.id).length })),
      attendus, saisis, valides,
      sansVagues: etat.epreuves.filter((ep) => !ep.vagues.length && engages.some((p) => concerne(ep, p))),
      repos: alertesRepos(etat),
    };
  }

  // ---------- Instantané public (lien en lecture seule et mode écran) ----------
  // Aucune coordonnée, note, paiement ni membre d'équipe : seulement ce qui s'affiche au classement.
  function instantane(etat, publieLe) {
    const r = etat.reglages;
    const nomDe = new Map(etat.participants.map((p) => [p.id, p]));
    const nom = (p) => nomPublic(p, r, categorieDe(etat, p.categorie));
    const categories = etat.categories.map((c) => {
      const cg = classementGeneral(etat, c.id);
      return {
        id: c.id, nom: c.nom, provisoire: cg.provisoire,
        epreuves: cg.epreuves.map((ep) => ep.id),
        lignes: cg.lignes.map((l) => ({
          rang: l.rang, nom: nom(l.participant), club: l.participant.club, total: l.total,
          resultats: cg.epreuves.map((ep) => { const x = l.resultats[ep.id]; return x ? [x.rang, x.points, x.affichage] : [null, 0, '']; }),
        })),
      };
    }).filter((c) => c.lignes.length);
    const prog = programme(etat).map((x) => ({
      epreuve: x.epreuve.id, numero: x.numero, date: x.date, debut: x.h?.debut || null, fin: x.h?.fin || null,
      categorie: categorieDe(etat, x.vague.categorie)?.nom || '',
      couloirs: x.vague.couloirs.map((pid) => (pid && nomDe.get(pid) ? nom(nomDe.get(pid)) : null)),
    }));
    return {
      v: 1, nom: etat.competition.nom, lieu: etat.competition.lieu, dateDebut: etat.competition.dateDebut, dateFin: etat.competition.dateFin,
      methode: r.methode, publieLe: publieLe || null, ecran: { secondes: r.ecranSecondes, lignes: r.ecranLignes },
      epreuves: etat.epreuves.map((ep) => ({ id: ep.id, nom: ep.nom, type: ep.type, coefficient: ep.coefficient })),
      categories, programme: prog,
    };
  }

  // ---------- Import d'une liste collée ----------
  // Une ligne par inscrit : « Nom ; Catégorie ; Club ; E-mail ; Téléphone » (point-virgule, tabulation ou virgule).
  function lireListe(txt, etat) {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const cats = new Map(etat.categories.map((c) => [norm(c.nom), c.id]));
    const lignes = String(txt || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [], inconnues = new Set();
    let dossard = prochainDossard(etat);
    for (const l of lignes) {
      const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
      const [nomL, cat = '', club = '', email = '', tel = ''] = l.split(sep).map((x) => x.trim());
      if (!nomL || /^nom$/i.test(nomL)) continue;
      const catId = cat ? cats.get(norm(cat)) : '';
      if (cat && !catId) inconnues.add(cat);
      out.push(normaliserParticipant({ nom: nomL, categorie: catId || '', club, email: /@/.test(email) ? email : '', telephone: tel, dossard: dossard++ }));
    }
    return { participants: out, inconnues: [...inconnues] };
  }

  // ---------- Exports CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsvInscrits(etat, { contacts = false } = {}) {
    const tete = ['Dossard', 'Nom', 'Catégorie', 'Club', 'Membres', 'Statut', 'Payé', 'Pièces vérifiées', 'Affichage public', ...(contacts ? ['E-mail', 'Téléphone'] : []), 'Note'];
    const l = [...etat.participants].sort((a, b) => (a.dossard || 0) - (b.dossard || 0)).map((p) => [p.dossard || '', p.nom, categorieDe(etat, p.categorie)?.nom || '', p.club, p.membres.join(', '), STATUTS[p.statut], p.paye ? 'oui' : 'non', p.pieces ? 'oui' : 'non', p.public ? 'oui' : 'dossard seulement', ...(contacts ? [p.email, p.telephone] : []), p.note]);
    return csv([tete, ...l]);
  }
  function versCsvClassement(etat) {
    const lignes = [['Catégorie', 'Rang', 'Dossard', 'Nom', 'Club', 'Total', ...etat.epreuves.flatMap((ep) => [`${ep.nom} : rang`, `${ep.nom} : score`])]];
    for (const c of etat.categories) {
      const cg = classementGeneral(etat, c.id);
      for (const l of cg.lignes) lignes.push([c.nom, l.rang, l.participant.dossard || '', l.participant.nom, l.participant.club, String(l.total).replace('.', ','), ...etat.epreuves.flatMap((ep) => { const x = l.resultats[ep.id]; return x ? [x.rang ?? '', x.affichage] : ['', '']; })]);
    }
    return csv(lignes);
  }

  // ---------- Suppressions ----------
  function supprimerParticipant(etat, pid) {
    const e = structuredCopie(etat);
    e.participants = e.participants.filter((p) => p.id !== pid);
    for (const k of Object.keys(e.scores)) delete e.scores[k][pid];
    for (const ep of e.epreuves) for (const v of ep.vagues) v.couloirs = v.couloirs.map((x) => (x === pid ? null : x));
    return e;
  }
  function effacerCoordonnees(etat) {
    const e = structuredCopie(etat);
    let n = 0;
    for (const p of e.participants) { if (p.email || p.telephone) n++; p.email = ''; p.telephone = ''; }
    return { etat: e, n };
  }

  racine.CMP = {
    TYPES, STATUTS_SCORE, STATUTS, METHODES, DEPARTAGES, ORDRES,
    iso, versDate, ajout, estDate, estHeure, minutes, hhmm, instant,
    nombre, lireTemps, afficherTemps, lireValeur,
    nouvelId, normaliserCategorie, normaliserParticipant, normaliserEpreuve, normaliserScore, normaliser, etatVide,
    prochainDossard, engage, concerne, categorieDe, epreuvesDe, nomPublic,
    score, comparer, afficherScore, pointsBareme, classementEpreuve, classementGeneral,
    dureeVague, tailles, genererVagues, horaire, programme, enPiste, alertesRepos, horsVagues, ordreSaisie,
    synthese, instantane, lireListe, versCsvInscrits, versCsvClassement, supprimerParticipant, effacerCoordonnees,
  };
})(typeof window !== 'undefined' ? window : globalThis);
