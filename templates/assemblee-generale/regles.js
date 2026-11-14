// Assemblée générale et vie statutaire QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.AGS) et par les tests Node (vm, sans structuredClone).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Aucune règle légale intégrée : délais de
// convocation, quorums, pouvoirs, majorités et durées de mandat sont ceux des statuts, saisis par l'utilisateur.
// Calculs en entiers (fractions num/den), jamais en virgule flottante.
(function (racine) {
  'use strict';

  const INSTANCES = ['ago', 'age', 'ca', 'bureau'];
  const PRESENCES = ['present', 'represente', 'excuse', 'absent'];
  const TYPES_QUORUM = ['aucun', 'fraction', 'nombre'];
  const TYPES_QUORUM2 = ['identique', 'aucun', 'fraction', 'nombre'];
  const COMPARAISONS = ['atteint', 'plus'];
  const BASES = ['exprimes', 'exprimes-abst', 'presents', 'inscrits'];
  const INSTANCES_MANDAT = ['ca', 'bureau'];
  const DEFAUTS = { alerteMandatJours: 90, alerteEtapesJours: 7 };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j, 12); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  // Ajout d'années : un 29 février tombe au 28 février d'une année non bissextile.
  const ajoutAnnees = (s, n) => { const [a, m, j] = s.split('-').map(Number); const d = new Date(a + n, m - 1, j, 12); if (d.getMonth() !== m - 1) d.setDate(0); return iso(d); };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const estHeure = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

  // ---------- Textes, identifiants ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const texteLong = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const entierOuNull = (v, max = 100000) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.min(max, Math.max(0, Math.round(Number(v)))));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const dans = (liste, v, defaut) => (liste.includes(v) ? v : defaut);
  // Clé de rapprochement d'un nom : sans accents, sans casse, espaces réduits.
  const cle = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);

  // ---------- Règles (statuts) ----------
  // Valeurs de départ : un exemple à remplacer par les statuts (verifiee = false tant que l'utilisateur ne les a
  // pas confirmées). Ce ne sont pas des règles légales : ces points relèvent des statuts de chaque association.
  const REGLES_DEPART = {
    ago: { nom: 'Assemblée générale ordinaire', court: 'AG ordinaire', delai: 15, quorum: { type: 'fraction', num: 1, den: 4, nombre: 0, comparaison: 'atteint' }, pouvoirsQuorum: true, quorum2: { type: 'aucun', num: 1, den: 4, nombre: 0, comparaison: 'atteint' }, pouvoirs: { autorises: true, plafond: 2 }, majorite: 'simple', duree: 0 },
    age: { nom: 'Assemblée générale extraordinaire', court: 'AG extraordinaire', delai: 15, quorum: { type: 'fraction', num: 1, den: 2, nombre: 0, comparaison: 'atteint' }, pouvoirsQuorum: true, quorum2: { type: 'aucun', num: 1, den: 4, nombre: 0, comparaison: 'atteint' }, pouvoirs: { autorises: true, plafond: 2 }, majorite: 'deux-tiers', duree: 0 },
    ca: { nom: 'Conseil d\'administration', court: 'Conseil', delai: 8, quorum: { type: 'fraction', num: 1, den: 2, nombre: 0, comparaison: 'atteint' }, pouvoirsQuorum: false, quorum2: { type: 'identique', num: 1, den: 2, nombre: 0, comparaison: 'atteint' }, pouvoirs: { autorises: true, plafond: 1 }, majorite: 'simple', duree: 3 },
    bureau: { nom: 'Bureau', court: 'Bureau', delai: 7, quorum: { type: 'aucun', num: 1, den: 2, nombre: 0, comparaison: 'atteint' }, pouvoirsQuorum: false, quorum2: { type: 'identique', num: 1, den: 2, nombre: 0, comparaison: 'atteint' }, pouvoirs: { autorises: false, plafond: 0 }, majorite: 'simple', duree: 3 },
  };
  const MAJORITES_DEPART = [
    { id: 'simple', nom: 'Majorité simple', base: 'exprimes', num: 1, den: 2, comparaison: 'plus' },
    { id: 'absolue', nom: 'Majorité absolue des présents et représentés', base: 'presents', num: 1, den: 2, comparaison: 'plus' },
    { id: 'deux-tiers', nom: 'Deux tiers des suffrages exprimés', base: 'exprimes', num: 2, den: 3, comparaison: 'atteint' },
    { id: 'unanimite', nom: 'Unanimité des présents et représentés', base: 'presents', num: 1, den: 1, comparaison: 'atteint' },
  ];

  function normaliserFraction(f, defaut) {
    const d = defaut || { num: 1, den: 2 };
    let num = entier(f?.num, 1, 1000, d.num), den = entier(f?.den, 1, 1000, d.den);
    if (num > den) num = den;
    const g = pgcd(num, den) || 1;
    return { num: num / g, den: den / g };
  }
  function normaliserQuorum(q, defaut, types = TYPES_QUORUM) {
    const d = defaut || REGLES_DEPART.ago.quorum;
    const type = dans(types, q?.type, d.type);
    return { type, ...normaliserFraction(q, d), nombre: entier(q?.nombre, 0, 100000, d.nombre || 0), comparaison: dans(COMPARAISONS, q?.comparaison, d.comparaison) };
  }
  function normaliserInstance(x, id) {
    const d = REGLES_DEPART[id];
    const p = x?.pouvoirs || {};
    return {
      nom: texte(x?.nom, 60) || d.nom,
      court: texte(x?.court, 30) || d.court,
      delai: entier(x?.delai, 0, 365, d.delai),
      quorum: normaliserQuorum(x?.quorum, d.quorum),
      pouvoirsQuorum: x?.pouvoirsQuorum === undefined ? d.pouvoirsQuorum : Boolean(x.pouvoirsQuorum),
      quorum2: normaliserQuorum(x?.quorum2, d.quorum2, TYPES_QUORUM2),
      pouvoirs: { autorises: p.autorises === undefined ? d.pouvoirs.autorises : Boolean(p.autorises), plafond: entier(p.plafond, 0, 100, d.pouvoirs.plafond) },
      majorite: texte(x?.majorite, 40) || d.majorite,
      duree: entier(x?.duree, 0, 20, d.duree),
      reference: texte(x?.reference, 120),
      verifiee: Boolean(x?.verifiee),
    };
  }
  function normaliserMajorite(m) {
    const f = normaliserFraction(m, { num: 1, den: 2 });
    return { id: texte(m?.id, 40) || nouvelId(), nom: texte(m?.nom, 80) || 'Majorité', base: dans(BASES, m?.base, 'exprimes'), ...f, comparaison: dans(COMPARAISONS, m?.comparaison, 'plus'), reference: texte(m?.reference, 120) };
  }
  function normaliserRegles(r) {
    const instances = {};
    for (const id of INSTANCES) instances[id] = normaliserInstance(r?.instances?.[id], id);
    const vues = new Set();
    let majorites = (Array.isArray(r?.majorites) ? r.majorites : clone(MAJORITES_DEPART)).map(normaliserMajorite).filter((m) => !vues.has(m.id) && vues.add(m.id));
    if (!majorites.length) majorites = clone(MAJORITES_DEPART).map(normaliserMajorite);
    for (const id of INSTANCES) if (!majorites.some((m) => m.id === instances[id].majorite)) instances[id].majorite = majorites[0].id;
    return { instances, majorites };
  }

  // ---------- État ----------
  function etatVide() {
    return { version: 1, association: normaliserAssociation({}), regles: normaliserRegles({}), membres: [], reunions: [], mandats: [], reglages: { ...DEFAUTS } };
  }
  function normaliserAssociation(a) {
    return { nom: texte(a?.nom, 100), ville: texte(a?.ville, 60), siege: texte(a?.siege, 140), signataire: texte(a?.signataire, 80), qualite: texte(a?.qualite, 60) || 'Président·e' };
  }
  function normaliserReglages(r) {
    return { alerteMandatJours: entier(r?.alerteMandatJours, 0, 365, DEFAUTS.alerteMandatJours), alerteEtapesJours: entier(r?.alerteEtapesJours, 0, 60, DEFAUTS.alerteEtapesJours) };
  }
  function normaliserMembre(m) {
    return {
      id: texte(m?.id, 40) || nouvelId(),
      nom: texte(m?.nom, 80) || 'Membre',
      categorie: texte(m?.categorie, 40) || 'Membre actif',
      votant: m?.votant === undefined ? true : Boolean(m.votant),
      cotisation: Boolean(m?.cotisation),
      email: texte(m?.email, 120).toLowerCase(),
      entree: dateOuNull(m?.entree),
      note: texte(m?.note, 200),
    };
  }
  function normaliserMandat(m) {
    return {
      id: texte(m?.id, 40) || nouvelId(),
      membre: texte(m?.membre, 40),
      fonction: texte(m?.fonction, 60) || 'Administrateur·rice',
      instance: dans(INSTANCES_MANDAT, m?.instance, 'ca'),
      debut: dateOuNull(m?.debut),
      duree: entier(m?.duree, 0, 20, 3),
      fin: dateOuNull(m?.fin),
      closLe: dateOuNull(m?.closLe),
      note: texte(m?.note, 200),
    };
  }
  function normaliserPoint(p) {
    const vote = Boolean(p?.vote);
    return {
      id: texte(p?.id, 40) || nouvelId(),
      titre: texte(p?.titre, 140) || 'Point',
      detail: texteLong(p?.detail, 1000),
      vote,
      resolution: texteLong(p?.resolution, 1500),
      majorite: texte(p?.majorite, 40),
      pour: vote ? entierOuNull(p?.pour) : null,
      contre: vote ? entierOuNull(p?.contre) : null,
      abstention: vote ? entierOuNull(p?.abstention) : null,
      notes: texteLong(p?.notes, 3000),
    };
  }
  function normaliserLigne(l) {
    return { membre: texte(l?.membre, 40), nom: texte(l?.nom, 80) || 'Membre', qualite: texte(l?.qualite, 60), statut: dans(PRESENCES, l?.statut, 'absent'), mandataire: texte(l?.mandataire, 40) };
  }
  function normaliserEtape(e) {
    return { id: texte(e?.id, 40) || nouvelId(), cle: texte(e?.cle, 30), titre: texte(e?.titre, 140) || 'Étape', ancre: dans(['limite', 'reunion'], e?.ancre, 'reunion'), decalage: entier(e?.decalage, -400, 400, 0), fait: Boolean(e?.fait) };
  }
  function normaliserReunion(r) {
    const instance = dans(INSTANCES, r?.instance, 'ago');
    const vues = new Set();
    const em = (Array.isArray(r?.emargement) ? r.emargement : []).map(normaliserLigne).filter((l) => l.membre && !vues.has(l.membre) && vues.add(l.membre));
    return {
      id: texte(r?.id, 40) || nouvelId(),
      instance,
      titre: texte(r?.titre, 120),
      date: dateOuNull(r?.date),
      heure: estHeure(r?.heure) ? r.heure : '',
      heureFin: estHeure(r?.heureFin) ? r.heureFin : '',
      lieu: texte(r?.lieu, 160),
      convocationNo: r?.convocationNo === 2 || r?.convocationNo === '2' ? 2 : 1,
      convoqueLe: dateOuNull(r?.convoqueLe),
      etapes: (Array.isArray(r?.etapes) ? r.etapes : []).map(normaliserEtape),
      points: (Array.isArray(r?.points) ? r.points : []).map(normaliserPoint),
      emargement: em,
      president: texte(r?.president, 80),
      secretaire: texte(r?.secretaire, 80),
      convocation: texteLong(r?.convocation, 8000),
      trame: texte(r?.trame, 40),
      pvSigneLe: dateOuNull(r?.pvSigneLe),
      notes: texteLong(r?.notes, 3000),
    };
  }
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.association = normaliserAssociation(d.association);
    e.regles = normaliserRegles(d.regles);
    e.reglages = normaliserReglages(d.reglages);
    const ids = new Set();
    e.membres = (Array.isArray(d.membres) ? d.membres : []).map(normaliserMembre).filter((m) => !ids.has(m.id) && ids.add(m.id));
    e.mandats = (Array.isArray(d.mandats) ? d.mandats : []).map(normaliserMandat).filter((m) => ids.has(m.membre));
    e.reunions = (Array.isArray(d.reunions) ? d.reunions : []).map(normaliserReunion);
    for (const r of e.reunions) for (const p of r.points) if (p.majorite && !e.regles.majorites.some((m) => m.id === p.majorite)) p.majorite = '';
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Accès ----------
  const regle = (E, instance) => E.regles.instances[instance] || E.regles.instances.ago;
  const majorite = (E, id) => E.regles.majorites.find((m) => m.id === id) || null;
  const membre = (E, id) => E.membres.find((m) => m.id === id) || null;
  const reunion = (E, id) => E.reunions.find((r) => r.id === id) || null;
  const estAG = (instance) => instance === 'ago' || instance === 'age';
  const majoritePoint = (E, r, p) => majorite(E, p.majorite) || majorite(E, regle(E, r.instance).majorite) || E.regles.majorites[0];

  // ---------- Mandats ----------
  // Fin prévue : date saisie, sinon début + durée (années) ; durée 0 et pas de fin : sans échéance.
  const finMandat = (m) => m.fin || (m.debut && m.duree ? ajoutAnnees(m.debut, m.duree) : null);
  const mandatActif = (m, d) => (!m.debut || m.debut <= d) && (!m.closLe || d < m.closLe) && (!finMandat(m) || d <= finMandat(m));
  // en-cours, a-renouveler (échéance dans la fenêtre d'alerte), echu (échéance passée, mandat non clos), clos.
  function etatMandat(m, t, alerte = DEFAUTS.alerteMandatJours) {
    if (m.closLe && m.closLe <= t) return 'clos';
    if (m.debut && m.debut > t) return 'a-venir';
    const f = finMandat(m);
    if (!f) return 'en-cours';
    if (f < t) return 'echu';
    return ecart(t, f) <= alerte ? 'a-renouveler' : 'en-cours';
  }
  const mandatsDe = (E, membreId) => E.mandats.filter((m) => m.membre === membreId);
  // Mandats dont l'échéance tombe avant la réunion (ou dans le mois qui suit) : à renouveler à cette AG.
  function mandatsARenouveler(E, r) {
    if (!r.date) return [];
    const limite = ajout(r.date, 31);
    return E.mandats.filter((m) => !m.closLe && finMandat(m) && finMandat(m) <= limite && (!m.debut || m.debut < r.date)).sort((a, b) => finMandat(a).localeCompare(finMandat(b)));
  }
  // Renouvellement : le mandat est clos à sa fin (ou à la date donnée) et un nouveau commence ce jour-là.
  function renouveler(E, mandatId, date, duree) {
    const E2 = clone(E);
    const m = E2.mandats.find((x) => x.id === mandatId);
    if (!m) return { E: E2, nouveau: null };
    const debut = dateOuNull(date) || finMandat(m) || null;
    if (!debut) return { E: E2, nouveau: null };
    m.closLe = debut;
    const n = normaliserMandat({ membre: m.membre, fonction: m.fonction, instance: m.instance, debut, duree: duree ?? m.duree });
    E2.mandats.push(n);
    return { E: E2, nouveau: n };
  }

  // ---------- Électeurs et émargement ----------
  // AG : membres votants à jour de cotisation. Conseil : mandats en cours au conseil ou au bureau. Bureau : mandats
  // en cours au bureau. Date : celle de la réunion (aujourd'hui si elle n'est pas fixée).
  function electeurs(E, instance, date) {
    if (estAG(instance)) return E.membres.filter((m) => m.votant && m.cotisation);
    const d = date;
    const ok = (m) => (instance === 'bureau' ? m.instance === 'bureau' : true) && mandatActif(m, d);
    const ids = new Set(E.mandats.filter(ok).map((m) => m.membre));
    return E.membres.filter((m) => ids.has(m.id));
  }
  const qualiteDe = (E, m, instance, date) => {
    if (estAG(instance)) return m.categorie;
    const l = E.mandats.filter((x) => x.membre === m.id && mandatActif(x, date) && (instance === 'ca' || x.instance === 'bureau'));
    return l.map((x) => x.fonction).join(', ');
  };
  // Liste construite depuis les membres éligibles (statuts déjà saisis conservés, lignes figées gardées pour une
  // réunion passée). Ordre alphabétique.
  function construireEmargement(E, r, t) {
    const d = r.date || t;
    const anciens = new Map(r.emargement.map((l) => [l.membre, l]));
    const liste = electeurs(E, r.instance, d).map((m) => {
      const a = anciens.get(m.id);
      return normaliserLigne({ membre: m.id, nom: m.nom, qualite: qualiteDe(E, m, r.instance, d), statut: a ? a.statut : 'absent', mandataire: a ? a.mandataire : '' });
    });
    // Une ligne saisie (présent, représenté, excusé) dont le membre n'est plus éligible est gardée.
    for (const l of r.emargement) if (!liste.some((x) => x.membre === l.membre) && l.statut !== 'absent') liste.push(clone(l));
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  const emargementDe = (E, r, t) => (r.emargement.length ? r.emargement : construireEmargement(E, r, t));

  // Pouvoirs : un pouvoir vaut s'il est admis, confié à un membre présent (autre que soi), dans la limite du
  // plafond par mandataire (0 = sans plafond), dans l'ordre de la liste. Les autres sont refusés, avec la raison.
  function pouvoirs(E, r, liste) {
    const rg = regle(E, r.instance);
    const parId = new Map(liste.map((l) => [l.membre, l]));
    const compte = new Map();
    const valides = [], refuses = [];
    for (const l of liste.filter((x) => x.statut === 'represente')) {
      const m = parId.get(l.mandataire);
      let raison = '';
      if (!rg.pouvoirs.autorises) raison = 'non-admis';
      else if (!l.mandataire || !m) raison = 'sans-mandataire';
      else if (l.mandataire === l.membre) raison = 'soi-meme';
      else if (m.statut !== 'present') raison = 'mandataire-absent';
      else if (rg.pouvoirs.plafond && (compte.get(l.mandataire) || 0) >= rg.pouvoirs.plafond) raison = 'plafond';
      if (raison) refuses.push({ membre: l.membre, nom: l.nom, mandataire: l.mandataire, raison });
      else { compte.set(l.mandataire, (compte.get(l.mandataire) || 0) + 1); valides.push({ membre: l.membre, nom: l.nom, mandataire: l.mandataire }); }
    }
    return { valides, refuses, parMandataire: compte };
  }

  // Nombre requis pour une règle de quorum, sur une base d'inscrits. null : pas de quorum.
  function requis(q, inscrits) {
    if (!q || q.type === 'aucun') return null;
    if (q.type === 'nombre') return q.nombre;
    return q.comparaison === 'plus' ? Math.floor((inscrits * q.num) / q.den) + 1 : Math.floor((inscrits * q.num + q.den - 1) / q.den);
  }
  const quorumApplicable = (rg, convocationNo) => (convocationNo === 2 ? (rg.quorum2.type === 'identique' ? rg.quorum : rg.quorum2) : rg.quorum);

  function presence(E, r, t) {
    const liste = emargementDe(E, r, t);
    const n = (s) => liste.filter((l) => l.statut === s).length;
    const pv = pouvoirs(E, r, liste);
    const presents = n('present');
    return { liste, inscrits: liste.length, presents, representes: pv.valides.length, refuses: pv.refuses, pouvoirs: pv, excuses: n('excuse'), absents: n('absent'), voix: presents + pv.valides.length };
  }

  function quorum(E, r, t, pr = presence(E, r, t)) {
    const rg = regle(E, r.instance);
    const q = quorumApplicable(rg, r.convocationNo);
    const req = requis(q, pr.inscrits);
    const compte = pr.presents + (rg.pouvoirsQuorum ? pr.representes : 0);
    if (req === null) return { regle: q, requis: null, compte, atteint: true, sansQuorum: true, pouvoirsComptes: rg.pouvoirsQuorum };
    return { regle: q, requis: req, compte, atteint: compte >= req && pr.inscrits > 0, sansQuorum: false, manque: Math.max(0, req - compte), pouvoirsComptes: rg.pouvoirsQuorum };
  }

  // ---------- Votes ----------
  const baseVote = (m, p, pr) => ({ exprimes: p.pour + p.contre, 'exprimes-abst': p.pour + p.contre + p.abstention, presents: pr.voix, inscrits: pr.inscrits }[m.base]);
  const pourRequis = (m, base) => (m.comparaison === 'plus' ? Math.floor((base * m.num) / m.den) + 1 : Math.floor((base * m.num + m.den - 1) / m.den));
  // Résultat d'un point soumis au vote. statut : 'non-vote' (décompte absent), 'invalide' (plus de voix que de
  // votants), 'sans-quorum' (délibération impossible), 'adoptee', 'rejetee'.
  function resultat(E, r, p, pr, qu) {
    const m = majoritePoint(E, r, p);
    if (!p.vote) return { statut: 'sans-vote', majorite: m };
    if (p.pour === null && p.contre === null && p.abstention === null) return { statut: 'non-vote', majorite: m };
    const v = { pour: p.pour || 0, contre: p.contre || 0, abstention: p.abstention || 0 };
    const total = v.pour + v.contre + v.abstention;
    if (total > pr.voix) return { statut: 'invalide', majorite: m, ...v, total, voix: pr.voix };
    if (!qu.atteint) return { statut: 'sans-quorum', majorite: m, ...v, total };
    const base = baseVote(m, v, pr);
    const req = pourRequis(m, base);
    const adoptee = base > 0 && (m.comparaison === 'plus' ? v.pour * m.den > m.num * base : v.pour * m.den >= m.num * base);
    return { statut: adoptee ? 'adoptee' : 'rejetee', majorite: m, ...v, total, base, requis: req, nonVotants: pr.voix - total };
  }

  // ---------- Textes des règles ----------
  const fraction = (f) => (f.num === f.den ? 'la totalité' : f.num === 1 && f.den === 2 ? 'la moitié' : f.num === 1 && f.den === 3 ? 'le tiers' : f.num === 2 && f.den === 3 ? 'les deux tiers' : f.num === 1 && f.den === 4 ? 'le quart' : f.num === 3 && f.den === 4 ? 'les trois quarts' : `${f.num}/${f.den}`);
  function texteQuorum(E, instance, q, { pouvoirs: avecPouvoirs = null } = {}) {
    const rg = regle(E, instance);
    if (q.type === 'aucun') return 'aucun quorum';
    const qui = estAG(instance) ? 'des membres votants' : 'des membres';
    const pres = (avecPouvoirs ?? rg.pouvoirsQuorum) ? 'présents ou représentés' : 'présents';
    if (q.type === 'nombre') return `au moins ${q.nombre} membre${q.nombre > 1 ? 's' : ''} ${pres}`;
    return `${q.comparaison === 'plus' ? 'plus de' : 'au moins'} ${fraction(q)} ${qui} ${pres}`;
  }
  const BASES_TEXTE = { exprimes: 'des suffrages exprimés (pour et contre)', 'exprimes-abst': 'des votes (abstentions comprises)', presents: 'des présents et représentés', inscrits: 'de tous les membres votants' };
  function texteMajorite(m) {
    if (m.num === m.den) return `la totalité ${BASES_TEXTE[m.base]}`;
    return `${m.comparaison === 'plus' ? 'plus de' : 'au moins'} ${fraction(m)} ${BASES_TEXTE[m.base]}`;
  }

  // ---------- Rétroplanning ----------
  const dateLimiteConvocation = (E, r) => (r.date ? ajout(r.date, -regle(E, r.instance).delai) : null);
  function etapesBase(B, instance) { return clone(B.etapes[estAG(instance) ? 'ag' : 'conseil']).map(normaliserEtape); }
  function etapesDatees(E, r, t) {
    const lim = dateLimiteConvocation(E, r);
    return r.etapes.map((e) => {
      const date = r.date ? ajout(e.ancre === 'limite' ? lim : r.date, e.decalage) : null;
      const etat = e.fait ? 'fait' : !date ? 'sans-date' : date < t ? 'retard' : ecart(t, date) <= (E.reglages?.alerteEtapesJours ?? 7) ? 'bientot' : 'a-venir';
      return { ...e, date, etat };
    }).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }
  // État de la convocation : à envoyer (avant la limite), en retard (limite passée), envoyée à temps ou trop tard.
  function etatConvocation(E, r, t) {
    const lim = dateLimiteConvocation(E, r);
    if (!lim) return { etat: 'sans-date', limite: null };
    if (r.convoqueLe) return { etat: r.convoqueLe <= lim ? 'envoyee' : 'tardive', limite: lim, le: r.convoqueLe };
    if (r.date < t) return { etat: 'passee', limite: lim };
    return { etat: t > lim ? 'retard' : 'a-envoyer', limite: lim, jours: ecart(t, lim) };
  }

  // ---------- Réunions ----------
  const etatReunion = (r, t) => (!r.date ? 'sans-date' : r.date > t ? 'a-venir' : r.date === t ? 'aujourdhui' : r.pvSigneLe ? 'archivee' : 'pv-a-faire');
  const triReunions = (l) => l.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const aVenir = (E, t) => triReunions(E.reunions.filter((r) => !r.date || r.date >= t));
  const prochaine = (E, t, filtre = () => true) => aVenir(E, t).filter((r) => r.date && filtre(r))[0] || null;
  function parAnnee(E) {
    const g = new Map();
    for (const r of E.reunions) { const a = r.date ? r.date.slice(0, 4) : 'Sans date'; if (!g.has(a)) g.set(a, []); g.get(a).push(r); }
    for (const l of g.values()) triReunions(l);
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }
  function nouvelleReunion(B, E, { instance = 'ago', date = null, heure = '', lieu = '', titre = '', convocationNo = 1 } = {}) {
    const points = estAG(instance) ? clone(B.ordresDuJour[instance] || []) : clone(B.ordresDuJour.conseil);
    return normaliserReunion({ instance, date, heure, lieu, titre, convocationNo, etapes: etapesBase(B, instance), points: points.map((p) => ({ ...p, id: nouvelId() })), trame: (B.trames.convocation.find((x) => x.instances.includes(instance)) || {}).id });
  }
  const titreReunion = (E, r) => r.titre || `${regle(E, r.instance).nom}${r.convocationNo === 2 ? ' (seconde convocation)' : ''}`;

  // ---------- Membres ----------
  function cotisationsAZero(E) {
    const E2 = clone(E);
    let n = 0;
    for (const m of E2.membres) if (m.cotisation) { m.cotisation = false; n++; }
    return { E: E2, n };
  }
  // Suppression d'un membre (RGPD) : fiche, mandats et lignes d'émargement à venir. Les procès-verbaux passés
  // gardent le nom tel qu'il a été consigné (archives de l'association).
  function supprimerMembre(E, id, t) {
    const E2 = clone(E);
    E2.membres = E2.membres.filter((m) => m.id !== id);
    E2.mandats = E2.mandats.filter((m) => m.membre !== id);
    for (const r of E2.reunions) {
      if (r.date && r.date < t) continue;
      r.emargement = r.emargement.filter((l) => l.membre !== id);
      for (const l of r.emargement) if (l.mandataire === id) l.mandataire = '';
    }
    return E2;
  }

  // ---------- Import d'une liste collée ----------
  // Une ligne par membre : nom ; catégorie ; e-mail ; cotisation (oui/non). Tabulation ou point-virgule.
  const OUI = /^(oui|o|x|1|vrai|true|ok|a jour|à jour|payee|payée|paye|payé)$/i;
  function analyserListe(brut) {
    const lignes = String(brut ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    const membres = [], erreurs = [];
    lignes.forEach((l, i) => {
      const c = (l.includes('\t') ? l.split('\t') : l.split(';')).map((x) => x.trim());
      if (i === 0 && /^(nom|membre|adh[eé]rent)/i.test(c[0])) return;
      const nom = texte(c[0], 80);
      if (!nom) { erreurs.push(`Ligne ${i + 1} : nom manquant.`); return; }
      let email = '', categorie = '', cotisation = false;
      for (const x of c.slice(1)) {
        if (!x) continue;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) email = x.toLowerCase();
        else if (OUI.test(cle(x)) || OUI.test(x)) cotisation = true;
        else if (/^(non|n|0|faux|false)$/i.test(x)) cotisation = false;
        else if (!categorie) categorie = texte(x, 40);
      }
      membres.push({ nom, email, categorie, cotisation });
    });
    return { membres, erreurs };
  }
  function importer(E, liste) {
    const E2 = clone(E);
    let crees = 0, completes = 0;
    for (const x of liste) {
      const ex = E2.membres.find((m) => cle(m.nom) === cle(x.nom));
      if (ex) { if (x.email && !ex.email) ex.email = x.email; if (x.cotisation) ex.cotisation = true; if (x.categorie && ex.categorie === 'Membre actif') ex.categorie = x.categorie; completes++; }
      else { E2.membres.push(normaliserMembre({ nom: x.nom, email: x.email, categorie: x.categorie, cotisation: x.cotisation })); crees++; }
    }
    return { E: E2, crees, completes };
  }

  // ---------- Textes : convocation, pouvoir, procès-verbal ----------
  // {cle} remplacé ; {?cle}…{/cle} gardé si la valeur est renseignée ; {!cle}…{/cle} gardé si elle est vide.
  function remplir(modele, ctx) {
    let s = String(modele ?? '');
    for (let i = 0; i < 3; i++) {
      s = s.replace(/\{\?([a-z_]+)\}([\s\S]*?)\{\/\1\}/g, (_, k, v) => (ctx[k] ? v : ''));
      s = s.replace(/\{!([a-z_]+)\}([\s\S]*?)\{\/\1\}/g, (_, k, v) => (ctx[k] ? '' : v));
    }
    s = s.replace(/\{([a-z_]+)\}/g, (t, k) => (k in ctx ? String(ctx[k] ?? '') : t));
    return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dateTexte = (s, jour = false) => { if (!s) return '[date à fixer]'; const d = versDate(s); return `${jour ? `${JOURS[d.getDay()]} ` : ''}${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const heureTexte = (h) => (h ? h.replace(':', ' h ').replace(/ h 00$/, ' h') : '');
  const article = (nom) => (/^[aeiouyéèêàâîôûh]/i.test(nom) ? `l'${nom.charAt(0).toLowerCase()}${nom.slice(1)}` : `le ${nom.charAt(0).toLowerCase()}${nom.slice(1)}`).replace(/^le bureau/, 'le bureau');
  const deLa = (nom) => { const a = article(nom); return a.startsWith('le ') ? `du ${a.slice(3)}` : `de ${a}`; };

  function contexteReunion(E, r, t) {
    const rg = regle(E, r.instance);
    const a = E.association;
    const q = quorumApplicable(rg, r.convocationNo);
    const odj = r.points.map((p, i) => `${i + 1}. ${p.titre}${p.vote ? ' (vote)' : ''}`).join('\n');
    const pouvoirsTxt = rg.pouvoirs.autorises
      ? `Si vous ne pouvez pas être présent·e, vous pouvez vous faire représenter par un autre membre en lui remettant le pouvoir joint${rg.pouvoirs.plafond ? ` ; chaque membre peut détenir au plus ${rg.pouvoirs.plafond} pouvoir${rg.pouvoirs.plafond > 1 ? 's' : ''}` : ''}.`
      : '';
    const qui = q.type === 'nombre' ? `au moins ${q.nombre} membre${q.nombre > 1 ? 's' : ''}` : `${q.comparaison === 'plus' ? 'plus de' : 'au moins'} ${fraction(q)} ${estAG(r.instance) ? 'des membres votants' : 'des membres'}`;
    const quorumTxt = q.type === 'aucun' ? '' : `${article(rg.nom).replace(/^./, (c) => c.toUpperCase())} ne pourra délibérer valablement que si ${qui} ${q.type === 'nombre' && q.nombre < 2 ? 'est' : 'sont'} ${rg.pouvoirsQuorum ? 'présents ou représentés' : 'présents'}.`;
    return {
      association: a.nom || '[nom de l\'association]',
      siege: a.siege,
      ville: a.ville,
      instance: rg.nom.charAt(0).toLowerCase() + rg.nom.slice(1),
      instance_article: article(rg.nom),
      instance_de: deLa(rg.nom),
      date: dateTexte(r.date, true),
      heure: heureTexte(r.heure),
      lieu: r.lieu || '[lieu à préciser]',
      ordre_du_jour: odj || '1. [point à ajouter]',
      pouvoirs: pouvoirsTxt,
      quorum: quorumTxt,
      seconde: r.convocationNo === 2 ? 'oui' : '',
      cotisation: estAG(r.instance) ? 'oui' : '',
      signataire: a.signataire || '[signataire]',
      qualite: a.qualite,
      date_envoi: dateTexte(r.convoqueLe || t),
    };
  }
  function texteConvocation(B, E, r, t, trameId) {
    const tr = B.trames.convocation.find((x) => x.id === (trameId || r.trame)) || B.trames.convocation.find((x) => x.instances.includes(r.instance)) || B.trames.convocation[0];
    return remplir(tr.texte, contexteReunion(E, r, t));
  }
  const textePouvoir = (B, E, r, t) => remplir(B.trames.pouvoir, contexteReunion(E, r, t));

  const PHRASE_RESULTAT = { adoptee: 'La résolution est adoptée.', rejetee: 'La résolution est rejetée.', 'sans-quorum': 'Le quorum n\'étant pas atteint, ce point n\'a pas pu être soumis à une délibération valable.', 'non-vote': 'Vote non consigné.', invalide: 'Décompte à vérifier : plus de voix que de votants.' };
  function textePV(B, E, r, t) {
    const rg = regle(E, r.instance);
    const pr = presence(E, r, t);
    const qu = quorum(E, r, t, pr);
    const ctx = contexteReunion(E, r, t);
    const president = r.president || '[président·e de séance]';
    const secretaire = r.secretaire || '[secrétaire de séance]';
    const quorumTxt = qu.sansQuorum
      ? `Aucun quorum n'est requis${r.convocationNo === 2 ? ' en seconde convocation' : ''} : ${article(rg.nom)} peut valablement délibérer.`
      : `Le quorum (${texteQuorum(E, r.instance, qu.regle)}, soit ${qu.requis} sur ${pr.inscrits}) ${qu.atteint ? 'est atteint' : `n'est pas atteint (${qu.compte} sur ${qu.requis} requis)`} : ${article(rg.nom)} ${qu.atteint ? 'peut valablement délibérer' : 'ne peut pas valablement délibérer'}.`;
    const corps = r.points.map((p, i) => {
      const lignes = [`${i + 1}. ${p.titre}`];
      if (p.notes) lignes.push(p.notes);
      if (p.vote) {
        const res = resultat(E, r, p, pr, qu);
        if (p.resolution) lignes.push(`Résolution : ${p.resolution}`);
        if (res.statut === 'non-vote') lignes.push('Vote : [décompte à reporter].');
        else lignes.push(`Vote (${res.majorite.nom.charAt(0).toLowerCase()}${res.majorite.nom.slice(1)}) : pour ${res.pour}, contre ${res.contre}, abstentions ${res.abstention}. ${PHRASE_RESULTAT[res.statut]}`);
      }
      return lignes.join('\n');
    }).join('\n\n');
    const tr = (B.trames.pv.find((x) => x.instances.includes(r.instance)) || B.trames.pv[0]).texte;
    return remplir(tr, {
      ...ctx,
      president, secretaire,
      convoque_le: r.convoqueLe ? dateTexte(r.convoqueLe) : '',
      inscrits: String(pr.inscrits),
      presents: String(pr.presents),
      representes: String(pr.representes),
      excuses: pr.liste.filter((l) => l.statut === 'excuse').map((l) => l.nom).join(', '),
      quorum_phrase: quorumTxt,
      deroulement: corps || '[points de l\'ordre du jour]',
      heure_fin: heureTexte(r.heureFin),
    });
  }

  // ---------- Indicateurs ----------
  function indicateurs(E, t) {
    const al = E.reglages.alerteMandatJours;
    const votants = E.membres.filter((m) => m.votant);
    const aJour = votants.filter((m) => m.cotisation);
    const etats = E.mandats.map((m) => etatMandat(m, t, al));
    const futures = aVenir(E, t).filter((r) => r.date);
    let etapesRetard = 0, etapesBientot = 0;
    for (const r of futures) for (const e of etapesDatees(E, r, t)) { if (e.etat === 'retard') etapesRetard++; if (e.etat === 'bientot') etapesBientot++; }
    return {
      membres: E.membres.length,
      votants: votants.length,
      aJour: aJour.length,
      enRetardCotisation: votants.length - aJour.length,
      mandatsEnCours: etats.filter((x) => x === 'en-cours' || x === 'a-renouveler').length,
      aRenouveler: etats.filter((x) => x === 'a-renouveler').length,
      echus: etats.filter((x) => x === 'echu').length,
      prochaine: futures[0] || null,
      etapesRetard, etapesBientot,
      pvAFaire: E.reunions.filter((r) => etatReunion(r, t) === 'pv-a-faire').length,
      reglesAVerifier: INSTANCES.filter((i) => !E.regles.instances[i].verifiee),
    };
  }

  // ---------- CSV ----------
  // Point-virgule, BOM UTF-8 (ouverture directe dans Excel), guillemets doublés.
  function versCsv(entetes, lignes) {
    const cel = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [entetes, ...lignes].map((l) => l.map(cel).join(';')).join('\r\n') + '\r\n';
  }
  function csvMembres(E, t) {
    const lignes = [...E.membres].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((m) => [
      m.nom, m.categorie, m.votant ? 'oui' : 'non', m.cotisation ? 'oui' : 'non', m.email, m.entree || '',
      E.mandats.filter((x) => x.membre === m.id && mandatActif(x, t)).map((x) => `${x.fonction} (${x.instance === 'bureau' ? 'bureau' : 'conseil'})`).join(', '),
    ]);
    return versCsv(['Nom', 'Catégorie', 'Votant', 'Cotisation à jour', 'E-mail', 'Entrée', 'Mandats en cours'], lignes);
  }
  function csvMandats(E, t) {
    const nom = (id) => (membre(E, id) || { nom: '' }).nom;
    const lignes = [...E.mandats].sort((a, b) => (finMandat(a) || '9999').localeCompare(finMandat(b) || '9999')).map((m) => [nom(m.membre), m.fonction, m.instance === 'bureau' ? 'Bureau' : 'Conseil', m.debut || '', m.duree || '', finMandat(m) || '', m.closLe || '', etatMandat(m, t, E.reglages.alerteMandatJours)]);
    return versCsv(['Membre', 'Fonction', 'Instance', 'Début', 'Durée (ans)', 'Échéance', 'Clos le', 'État'], lignes);
  }
  function csvArchive(E, t) {
    const lignes = [];
    for (const r of triReunions([...E.reunions])) {
      const pr = presence(E, r, t), qu = quorum(E, r, t, pr);
      const base = [r.date || '', regle(E, r.instance).nom, r.convocationNo, pr.inscrits, pr.presents, pr.representes, qu.sansQuorum ? 'sans quorum' : qu.atteint ? 'atteint' : 'non atteint', r.pvSigneLe || ''];
      const votes = r.points.filter((p) => p.vote);
      if (!votes.length) lignes.push([...base, '', '', '', '', '', '']);
      for (const p of votes) { const x = resultat(E, r, p, pr, qu); lignes.push([...base, p.titre, x.majorite.nom, x.pour ?? '', x.contre ?? '', x.abstention ?? '', x.statut]); }
    }
    return versCsv(['Date', 'Instance', 'Convocation', 'Inscrits', 'Présents', 'Représentés', 'Quorum', 'PV signé le', 'Point', 'Majorité', 'Pour', 'Contre', 'Abstentions', 'Résultat'], lignes);
  }

  racine.AGS = {
    INSTANCES, PRESENCES, TYPES_QUORUM, TYPES_QUORUM2, COMPARAISONS, BASES, INSTANCES_MANDAT, DEFAUTS, REGLES_DEPART, MAJORITES_DEPART,
    iso, versDate, estDate, estHeure, ajout, ecart, ajoutAnnees, nouvelId, cle, clone,
    etatVide, normaliser, normaliserRegles, normaliserInstance, normaliserMajorite, normaliserFraction, normaliserQuorum, normaliserAssociation, normaliserReglages,
    normaliserMembre, normaliserMandat, normaliserReunion, normaliserPoint, normaliserLigne, normaliserEtape,
    regle, majorite, membre, reunion, estAG, majoritePoint,
    finMandat, mandatActif, etatMandat, mandatsDe, mandatsARenouveler, renouveler,
    electeurs, construireEmargement, emargementDe, pouvoirs, requis, quorumApplicable, presence, quorum, resultat, pourRequis,
    fraction, texteQuorum, texteMajorite,
    dateLimiteConvocation, etapesBase, etapesDatees, etatConvocation,
    etatReunion, aVenir, prochaine, parAnnee, nouvelleReunion, titreReunion,
    cotisationsAZero, supprimerMembre, analyserListe, importer,
    remplir, dateTexte, heureTexte, article, contexteReunion, texteConvocation, textePouvoir, textePV,
    indicateurs, versCsv, csvMembres, csvMandats, csvArchive,
  };
})(typeof window !== 'undefined' ? window : globalThis);
