// Tableau de bord de pilotage PME QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.TDB) et par les tests Node (vm).
// Mois « AAAA-MM » (comparables comme des chaînes). Valeurs : nombres (euros, heures, pourcentages…),
// null quand rien n'est saisi ou qu'un calcul est impossible. Un exercice dure 12 mois à partir du mois de
// début choisi ; il est désigné par l'année de son premier mois.
(function (racine) {
  'use strict';

  const SENS = { haut: 'Plus haut est mieux', bas: 'Plus bas est mieux', cible: 'Au plus près de la cible', neutre: 'Suivi sans jugement' };
  const CUMULS = { somme: 'Somme des mois', moyenne: 'Moyenne des mois', dernier: 'Dernier mois connu', recalcul: 'Recalculé sur les cumuls' };
  const REPARTITIONS = { egale: 'Égale sur 12 mois', saisonniere: 'Selon l\'année précédente', manuelle: 'Mois par mois' };
  const STATUTS = ['alerte', 'vigilance', 'atteint', 'neutre', 'vide'];
  const LIB_STATUT = { alerte: 'En alerte', vigilance: 'À surveiller', atteint: 'Atteint', neutre: 'Sans objectif', vide: 'Non saisi' };
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // ---------- Mois ----------
  const deux = (n) => String(n).padStart(2, '0');
  const cle = (a, m) => `${a}-${deux(m)}`;
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const partsMois = (c) => c.split('-').map(Number);
  function ajoutMois(c, n) {
    const [a, m] = partsMois(c);
    const t = a * 12 + (m - 1) + n;
    return cle(Math.floor(t / 12), (t % 12 + 12) % 12 + 1);
  }
  const ecartMois = (de, a) => { const [a1, m1] = partsMois(de), [a2, m2] = partsMois(a); return (a2 - a1) * 12 + (m2 - m1); };
  const moisDeDate = (d) => cle(d.getFullYear(), d.getMonth() + 1);
  const moisDeIso = (s) => s.slice(0, 7);
  const libMois = (c, { court = false, annee = true } = {}) => { const [a, m] = partsMois(c); const n = (court ? MOIS_COURTS : MOIS)[m - 1]; return annee ? `${n} ${a}` : n; };
  // Exercice (année de son premier mois) d'un mois donné, pour un début d'exercice au mois `debut` (1 à 12).
  const exerciceDe = (c, debut = 1) => { const [a, m] = partsMois(c); return m >= debut ? a : a - 1; };
  const moisExercice = (annee, debut = 1) => Array.from({ length: 12 }, (_, i) => ajoutMois(cle(annee, debut), i));
  const indexExercice = (c, debut = 1) => ecartMois(cle(exerciceDe(c, debut), debut), c);
  const libExercice = (annee, debut = 1) => (debut === 1 ? String(annee) : `${libMois(cle(annee, debut), { court: true })} → ${libMois(ajoutMois(cle(annee, debut), 11), { court: true })}`);
  // Les n mois qui finissent au mois c inclus, du plus ancien au plus récent.
  const derniersMois = (c, n) => Array.from({ length: n }, (_, i) => ajoutMois(c, i - n + 1));

  // ---------- Nombres ----------
  const fini = (v) => typeof v === 'number' && Number.isFinite(v);
  const arrondi = (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; };
  // « 1 234,5 », « −12 », « 12 % », « 3 500 € » → nombre ; null si vide ou illisible.
  function lireNombre(saisie, { signe = true } = {}) {
    const s = String(saisie ?? '').replace(/[\s  €%]/g, '').replace(/[−–]/g, '-').replace(',', '.');
    if (!s || !(signe ? /^[-+]?\d+(\.\d+)?$/ : /^\+?\d+(\.\d+)?$/).test(s)) return null;
    return Number(s);
  }
  // Espaces insécables : un nombre et son unité ne se coupent jamais en fin de ligne.
  const milliers = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  function nombre(v, d = 0) {
    if (!fini(v)) return '–';
    const n = arrondi(Math.abs(v), d);
    const [e, f] = n.toFixed(d).split('.');
    const neg = v < 0 && n !== 0;
    return `${neg ? '−' : ''}${milliers(e)}${f ? `,${f}` : ''}`;
  }
  const SUFFIXES = { '€': '\u00A0€', '%': '\u00A0%', nb: '', h: '\u00A0h', j: '\u00A0j', mois: '\u00A0mois', note: '\u00A0/10', ETP: '\u00A0ETP' };
  // Valeur formatée avec son unité. compact : 123 k€, 1,2 M€ (tuiles et axes).
  function format(k, v, { compact = false } = {}) {
    if (!fini(v)) return '–';
    if (k.unite === '€' && compact && Math.abs(v) >= 10000) {
      if (Math.abs(v) >= 1e6) return `${nombre(v / 1e6, Math.abs(v) >= 1e7 ? 1 : 2)}\u00A0M€`;
      return `${nombre(v / 1000, 0)}\u00A0k€`;
    }
    return `${nombre(v, k.decimales ?? 0)}${SUFFIXES[k.unite] ?? ` ${k.unite}`}`;
  }
  // Écart signé : en points pour un pourcentage.
  function formatEcart(k, v, { compact = false } = {}) {
    if (!fini(v)) return '–';
    const signe = v > 0 ? '+' : '';
    if (k.unite === '%') return `${signe}${nombre(v, k.decimales ?? 1)}\u00A0pt${Math.abs(v) >= 2 ? 's' : ''}`;
    return `${signe}${format(k, v, { compact })}`;
  }
  const pct = (v, d = 1) => (fini(v) ? `${v > 0 ? '+' : ''}${nombre(v, d)}\u00A0%` : '–');
  // Valeur à remettre dans un champ : chiffres complets, milliers séparés (relue par lireNombre).
  const saisie = (v) => { if (!fini(v)) return ''; const [e, f] = String(Math.abs(v)).split('.'); return `${v < 0 ? '-' : ''}${milliers(e).replace(/\u202F/g, ' ')}${f ? `,${f}` : ''}`; };

  // ---------- Indicateurs ----------
  const indicateur = (E, id) => E.indicateurs.find((k) => k.id === id);
  const estCalcule = (k) => !!(k && k.calcul);
  const estFlux = (k) => k.cumul === 'somme';
  const actifs = (E) => E.indicateurs.filter((k) => k.actif !== false);
  const saisis = (E) => actifs(E).filter((k) => !estCalcule(k));

  // Valeur d'un mois : saisie, ou calcul récursif (null si une composante manque, division par zéro, boucle).
  function valeur(E, id, mois, pile = []) {
    const k = indicateur(E, id);
    if (!k) return null;
    if (!k.calcul) { const v = E.saisies[mois]?.[id]; return fini(v) ? v : null; }
    if (pile.includes(id)) return null;
    const p = [...pile, id];
    const a = valeur(E, k.calcul.a, mois, p), b = valeur(E, k.calcul.b, mois, p);
    return combiner(k.calcul, a, b);
  }
  function combiner(c, a, b) {
    if (a === null || b === null) return null;
    if (c.type === 'difference') return a - b;
    if (c.type === 'ratio') return b === 0 ? null : (a / b) * (c.facteur ?? 1);
    return null;
  }

  // Valeur sur une période (liste de mois dans l'ordre), selon le mode de cumul de l'indicateur.
  // recalcul : le calcul est refait sur les cumuls des composantes, sur les seuls mois où l'indicateur a une
  // valeur (taux de marge cumulé = marge cumulée ÷ CA cumulé, jamais la moyenne des taux).
  function valeurPeriode(E, id, liste, pile = []) {
    const k = indicateur(E, id);
    if (!k || pile.includes(id)) return null;
    if (k.calcul && k.cumul === 'recalcul') {
      const valides = liste.filter((m) => valeur(E, id, m) !== null);
      if (!valides.length) return null;
      const p = [...pile, id];
      return combiner(k.calcul, valeurPeriode(E, k.calcul.a, valides, p), valeurPeriode(E, k.calcul.b, valides, p));
    }
    const vals = liste.map((m) => valeur(E, id, m)).filter((v) => v !== null);
    if (!vals.length) return null;
    if (k.cumul === 'moyenne') return vals.reduce((s, v) => s + v, 0) / vals.length;
    if (k.cumul === 'dernier') return vals[vals.length - 1];
    return vals.reduce((s, v) => s + v, 0);
  }

  // ---------- Objectifs ----------
  // Répartit un total sur 12 mois (poids facultatifs), au plus fort reste à la précision voulue, pour que
  // la somme des mois tombe exactement sur le total.
  function repartir(total, poids = null, decimales = 0) {
    if (!fini(total)) return Array(12).fill(null);
    const p = poids && poids.length === 12 && poids.every((x) => fini(x) && x >= 0) && poids.some((x) => x > 0) ? poids : Array(12).fill(1);
    const somme = p.reduce((s, x) => s + x, 0);
    const pas = 10 ** decimales;
    const unites = Math.round(Math.abs(total) * pas);
    const bruts = p.map((x) => (unites * x) / somme);
    const base = bruts.map(Math.floor);
    let reste = unites - base.reduce((s, x) => s + x, 0);
    const ordre = bruts.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of ordre) { if (reste <= 0) break; base[i] += 1; reste -= 1; }
    const signe = total < 0 ? -1 : 1;
    return base.map((u) => (signe * u) / pas + 0);
  }

  // Poids saisonniers : les valeurs de l'exercice précédent, si les 12 mois sont connus et positifs.
  function poidsSaisonniers(E, id, annee) {
    const vals = moisExercice(annee - 1, E.debutMois).map((m) => valeur(E, id, m));
    if (vals.some((v) => v === null || v < 0) || vals.reduce((s, v) => s + v, 0) <= 0) return null;
    return vals;
  }

  const objectifBrut = (E, id, annee) => E.objectifs[String(annee)]?.[id] || null;

  // Objectifs des 12 mois d'un exercice. Flux (somme) : objectif annuel réparti ; niveau : l'objectif annuel
  // est la cible de chaque mois. Manuelle : les 12 valeurs saisies.
  function objectifsMensuels(E, id, annee) {
    const k = indicateur(E, id);
    const o = objectifBrut(E, id, annee);
    if (!k || !o) return Array(12).fill(null);
    if (o.repartition === 'manuelle') return Array.from({ length: 12 }, (_, i) => (fini(o.mensuels?.[i]) ? o.mensuels[i] : null));
    if (!fini(o.annuel)) return Array(12).fill(null);
    if (!estFlux(k)) return Array(12).fill(o.annuel);
    const poids = o.repartition === 'saisonniere' ? poidsSaisonniers(E, id, annee) : null;
    return repartir(o.annuel, poids, k.decimales ?? 0);
  }
  // Total annuel (flux) ou cible moyenne (niveau) d'un exercice, après répartition.
  function objectifAnnuel(E, id, annee) {
    const k = indicateur(E, id);
    const v = objectifsMensuels(E, id, annee).filter(fini);
    if (!k || !v.length) return null;
    return estFlux(k) ? v.reduce((s, x) => s + x, 0) : v.reduce((s, x) => s + x, 0) / v.length;
  }
  const objectifMois = (E, id, mois) => objectifsMensuels(E, id, exerciceDe(mois, E.debutMois))[indexExercice(mois, E.debutMois)];

  // Objectif sur une période : somme (flux), objectif du dernier mois (niveau « dernier »), sinon moyenne.
  function objectifPeriode(E, id, liste) {
    const k = indicateur(E, id);
    if (!k) return null;
    const vals = liste.map((m) => objectifMois(E, id, m)).filter(fini);
    if (!vals.length) return null;
    if (estFlux(k)) return vals.reduce((s, v) => s + v, 0);
    if (k.cumul === 'dernier') return objectifMois(E, id, liste[liste.length - 1]) ?? vals[vals.length - 1];
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // ---------- Statuts, écarts, tendances ----------
  const ecart = (reel, obj) => (reel === null || obj === null || !fini(reel) || !fini(obj) ? null : { abs: reel - obj, pct: obj === 0 ? null : ((reel - obj) / Math.abs(obj)) * 100 });

  // Statut d'une valeur face à son objectif. seuils : applique le plancher et le plafond absolus.
  function statut(k, reel, obj, { seuils = true } = {}) {
    if (!fini(reel)) return 'vide';
    if (seuils && fini(k.plancher) && reel < k.plancher) return 'alerte';
    if (seuils && fini(k.plafond) && reel > k.plafond) return 'alerte';
    if (k.sens === 'neutre' || !fini(obj)) return 'neutre';
    const tol = ((fini(k.tolerance) ? k.tolerance : 10) / 100) * Math.abs(obj);
    if (k.sens === 'bas') return reel <= obj ? 'atteint' : reel <= obj + tol ? 'vigilance' : 'alerte';
    if (k.sens === 'cible') { const d = Math.abs(reel - obj); return d <= tol ? 'atteint' : d <= 2 * tol ? 'vigilance' : 'alerte'; }
    return reel >= obj ? 'atteint' : reel >= obj - tol ? 'vigilance' : 'alerte';
  }
  // Une variation est-elle favorable selon le sens de lecture ? null si sans objet.
  const favorable = (k, delta) => (!fini(delta) || delta === 0 || k.sens === 'neutre' || k.sens === 'cible' ? null : k.sens === 'bas' ? delta < 0 : delta > 0);

  // Tendance : moyenne des 3 derniers mois face aux 3 précédents (au moins 2 valeurs de chaque côté).
  // Stable sous 2 % de variation (ou 0,5 point pour un pourcentage).
  function tendance(E, id, mois) {
    const k = indicateur(E, id);
    const moy = (liste) => { const v = liste.map((m) => valeur(E, id, m)).filter((x) => x !== null); return v.length >= 2 ? v.reduce((s, x) => s + x, 0) / v.length : null; };
    const recent = moy(derniersMois(mois, 3)), avant = moy(derniersMois(ajoutMois(mois, -3), 3));
    if (!k || recent === null || avant === null) return null;
    const delta = recent - avant;
    const variation = avant === 0 ? null : (delta / Math.abs(avant)) * 100;
    const stable = k.unite === '%' ? Math.abs(delta) < 0.5 : variation === null ? delta === 0 : Math.abs(variation) < 2;
    return { recent, avant, delta, variation, direction: stable ? 'stable' : delta > 0 ? 'hausse' : 'baisse', favorable: stable ? null : favorable(k, delta) };
  }

  // Comparaison au même mois de l'année précédente.
  function variationAn(E, id, mois) {
    const v = valeur(E, id, mois), v1 = valeur(E, id, ajoutMois(mois, -12));
    if (v === null || v1 === null) return null;
    return { valeur: v1, delta: v - v1, pct: v1 === 0 ? null : ((v - v1) / Math.abs(v1)) * 100 };
  }

  // Cumul de l'exercice jusqu'au mois inclus. L'objectif cumulé ne porte que sur les mois saisis, pour
  // comparer ce qui est comparable ; les mois sans valeur sont comptés à part.
  function cumulExercice(E, id, mois) {
    const k = indicateur(E, id);
    const an = exerciceDe(mois, E.debutMois);
    const liste = moisExercice(an, E.debutMois).filter((m) => m <= mois);
    const avecValeur = liste.filter((m) => valeur(E, id, m) !== null);
    const reel = valeurPeriode(E, id, liste);
    const objectif = objectifPeriode(E, id, avecValeur.length ? avecValeur : liste);
    return { exercice: an, mois: liste, saisis: avecValeur.length, manquants: liste.length - avecValeur.length, reel, objectif, ecart: ecart(reel, objectif), statut: k ? statut(k, reel, objectif, { seuils: false }) : 'vide' };
  }

  // Projection de fin d'exercice (flux) : cumul réel ÷ part de l'objectif annuel déjà écoulée ; à défaut
  // d'objectif, rythme mensuel moyen × 12. null pour un indicateur de niveau.
  function projection(E, id, mois) {
    const k = indicateur(E, id);
    if (!k || !estFlux(k)) return null;
    const c = cumulExercice(E, id, mois);
    if (c.reel === null || !c.saisis) return null;
    const annuel = objectifAnnuel(E, id, c.exercice);
    const avecValeur = c.mois.filter((m) => valeur(E, id, m) !== null);
    const objEcoule = objectifPeriode(E, id, avecValeur);
    if (fini(annuel) && fini(objEcoule) && objEcoule > 0 && annuel > 0) {
      const v = (c.reel * annuel) / objEcoule;
      return { valeur: v, base: 'objectif', objectif: annuel, ecart: ecart(v, annuel) };
    }
    return { valeur: (c.reel / c.saisis) * 12, base: 'rythme', objectif: fini(annuel) ? annuel : null, ecart: fini(annuel) ? ecart((c.reel / c.saisis) * 12, annuel) : null };
  }

  // Série des n mois qui finissent au mois donné : réel, objectif, année précédente.
  const serie = (E, id, mois, n = 12) => derniersMois(mois, n).map((m) => ({ mois: m, reel: valeur(E, id, m), objectif: objectifMois(E, id, m), an1: valeur(E, id, ajoutMois(m, -12)) }));

  // Tout ce qu'il faut savoir d'un indicateur pour un mois.
  function fiche(E, id, mois) {
    const k = indicateur(E, id);
    if (!k) return null;
    const reel = valeur(E, id, mois), objectif = objectifMois(E, id, mois);
    return { k, mois, reel, objectif, ecart: ecart(reel, objectif), statut: statut(k, reel, objectif), cumul: cumulExercice(E, id, mois), tendance: tendance(E, id, mois), an: variationAn(E, id, mois), projection: projection(E, id, mois) };
  }

  // Synthèse d'un mois : une fiche par indicateur actif, comptes par statut, alertes et vigilances.
  function synthese(E, mois) {
    const lignes = actifs(E).map((k) => fiche(E, k.id, mois));
    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
    for (const l of lignes) parStatut[l.statut] += 1;
    return { mois, lignes, parStatut, alertes: lignes.filter((l) => l.statut === 'alerte'), vigilances: lignes.filter((l) => l.statut === 'vigilance'), completude: completude(E, mois) };
  }

  // Indicateurs à saisir du mois : remplis et manquants.
  function completude(E, mois) {
    const s = saisis(E);
    const remplis = s.filter((k) => fini(E.saisies[mois]?.[k.id]));
    return { total: s.length, remplis: remplis.length, manquants: s.filter((k) => !fini(E.saisies[mois]?.[k.id])).map((k) => k.id) };
  }

  // Mois proposé à l'ouverture : le plus récent mois saisi (jusqu'au mois courant), sinon le mois dernier.
  function moisParDefaut(E, courant) {
    const saisisMois = Object.keys(E.saisies).filter((m) => m <= courant && Object.values(E.saisies[m] || {}).some(fini)).sort();
    return saisisMois.length ? saisisMois[saisisMois.length - 1] : ajoutMois(courant, -1);
  }

  // ---------- Bibliothèque ----------
  const CHAMPS_MODELE = ['nom', 'domaine', 'unite', 'decimales', 'sens', 'cumul', 'tolerance', 'definition', 'formule', 'lecture', 'source', 'conseil'];
  function depuisModele(m) {
    const k = { id: m.id, modele: m.id };
    for (const c of CHAMPS_MODELE) k[c] = m[c];
    k.calcul = m.calcul ? { ...m.calcul } : null;
    return normaliserIndicateur(k);
  }
  // Composantes nécessaires (récursivement) d'un modèle de la bibliothèque, dans l'ordre d'ajout.
  function dependancesModele(base, id, vus = []) {
    const m = base.indicateurs.find((x) => x.id === id);
    if (!m || vus.includes(id)) return vus;
    if (m.calcul) { dependancesModele(base, m.calcul.a, vus); dependancesModele(base, m.calcul.b, vus); }
    if (!vus.includes(id)) vus.push(id);
    return vus;
  }
  // Ajoute un modèle et ses composantes manquantes ; réactive ceux qui étaient masqués. Renvoie les ajouts.
  function ajouterModele(E, base, id) {
    const ajoutes = [];
    for (const d of dependancesModele(base, id)) {
      const existant = indicateur(E, d);
      if (existant) { if (existant.actif === false) { existant.actif = true; ajoutes.push(d); } continue; }
      E.indicateurs.push(depuisModele(base.indicateurs.find((x) => x.id === d)));
      ajoutes.push(d);
    }
    return ajoutes;
  }
  const utilisePar = (E, id) => E.indicateurs.filter((k) => k.calcul && (k.calcul.a === id || k.calcul.b === id) && k.actif !== false);
  // Un calcul personnalisé ne doit pas se citer lui-même, directement ou non.
  function creeBoucle(E, id, calcul) {
    const voir = (x, pile) => {
      if (x === id) return true;
      if (pile.includes(x)) return false;
      const k = indicateur(E, x);
      return !!(k && k.calcul) && (voir(k.calcul.a, [...pile, x]) || voir(k.calcul.b, [...pile, x]));
    };
    return voir(calcul.a, []) || voir(calcul.b, []);
  }

  // ---------- Revue mensuelle ----------
  // Actions encore ouvertes créées avant le mois donné (reprises dans sa revue).
  function actionsReprises(E, mois) {
    const l = [];
    for (const [m, r] of Object.entries(E.revues)) if (m < mois) for (const a of r.actions || []) if (a.statut !== 'faite') l.push({ ...a, mois: m });
    return l.sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999') || a.mois.localeCompare(b.mois));
  }

  // ---------- État ----------
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const nombreOuNull = (v) => (fini(v) ? v : (typeof v === 'string' ? lireNombre(v) : null));
  function normaliserIndicateur(k) {
    const n = {
      id: texte(k.id, 60) || `perso-${nouvelId()}`,
      modele: k.modele ? texte(k.modele, 60) : null,
      nom: texte(k.nom, 80) || 'Indicateur',
      domaine: texte(k.domaine, 30) || 'commercial',
      unite: texte(k.unite, 10) || 'nb',
      decimales: Math.max(0, Math.min(3, Math.round(Number(k.decimales) || 0))),
      sens: SENS[k.sens] ? k.sens : 'haut',
      cumul: CUMULS[k.cumul] ? k.cumul : 'somme',
      tolerance: fini(Number(k.tolerance)) && Number(k.tolerance) >= 0 ? Math.min(100, Number(k.tolerance)) : 10,
      plancher: nombreOuNull(k.plancher),
      plafond: nombreOuNull(k.plafond),
      responsable: texte(k.responsable, 60),
      definition: texte(k.definition, 400), formule: texte(k.formule, 200), lecture: texte(k.lecture, 400),
      source: texte(k.source, 200), conseil: texte(k.conseil, 400),
      calcul: null,
      actif: k.actif !== false,
    };
    if (k.calcul && (k.calcul.type === 'ratio' || k.calcul.type === 'difference') && k.calcul.a && k.calcul.b) {
      n.calcul = { type: k.calcul.type, a: String(k.calcul.a), b: String(k.calcul.b) };
      if (k.calcul.type === 'ratio') n.calcul.facteur = fini(Number(k.calcul.facteur)) && Number(k.calcul.facteur) !== 0 ? Number(k.calcul.facteur) : 1;
    }
    if (!n.calcul && n.cumul === 'recalcul') n.cumul = 'somme';
    return n;
  }
  function normaliserObjectif(o) {
    if (!o || typeof o !== 'object') return null;
    const r = { annuel: nombreOuNull(o.annuel), repartition: REPARTITIONS[o.repartition] ? o.repartition : 'egale', mensuels: Array.from({ length: 12 }, (_, i) => nombreOuNull(o.mensuels?.[i])) };
    return r.annuel === null && r.mensuels.every((x) => x === null) ? null : r;
  }
  const etatVide = () => ({ version: 1, entreprise: '', debutMois: 1, profil: '', indicateurs: [], saisies: {}, objectifs: {}, revues: {} });
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.entreprise = texte(d.entreprise, 80);
    e.debutMois = Math.round(Number(d.debutMois)) >= 1 && Math.round(Number(d.debutMois)) <= 12 ? Math.round(Number(d.debutMois)) : 1;
    e.profil = texte(d.profil, 30);
    const vus = new Set();
    for (const k of Array.isArray(d.indicateurs) ? d.indicateurs : []) { const n = normaliserIndicateur(k); if (!vus.has(n.id)) { vus.add(n.id); e.indicateurs.push(n); } }
    for (const [m, v] of Object.entries(d.saisies || {})) {
      if (!estMois(m) || !v || typeof v !== 'object') continue;
      const l = {};
      for (const [id, x] of Object.entries(v)) if (fini(x)) l[id] = x;
      if (Object.keys(l).length) e.saisies[m] = l;
    }
    for (const [a, v] of Object.entries(d.objectifs || {})) {
      if (!/^\d{4}$/.test(a) || !v || typeof v !== 'object') continue;
      const l = {};
      for (const [id, o] of Object.entries(v)) { const n = normaliserObjectif(o); if (n) l[id] = n; }
      if (Object.keys(l).length) e.objectifs[a] = l;
    }
    for (const [m, r] of Object.entries(d.revues || {})) {
      if (!estMois(m) || !r || typeof r !== 'object') continue;
      e.revues[m] = {
        faits: texte(r.faits, 4000),
        actions: (Array.isArray(r.actions) ? r.actions : []).map((a) => ({ id: texte(a.id, 40) || nouvelId(), texte: texte(a.texte, 300), responsable: texte(a.responsable, 60), echeance: /^\d{4}-\d{2}-\d{2}$/.test(a.echeance || '') ? a.echeance : '', statut: a.statut === 'faite' ? 'faite' : 'ouverte', indicateur: a.indicateur ? texte(a.indicateur, 60) : '' })).filter((a) => a.texte),
      };
    }
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Exports CSV (point-virgule, BOM pour les tableurs) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nbCsv = (v, d = 2) => (fini(v) ? String(arrondi(v, d)).replace('.', ',') : '');
  function versCsvRevue(E, mois, domaines = []) {
    const nomDom = (id) => domaines.find((d) => d.id === id)?.nom || id;
    const tete = ['Domaine', 'Indicateur', 'Unité', 'Sens', 'Mois', 'Réel du mois', 'Objectif du mois', 'Écart', 'Écart (%)', 'Statut du mois', 'Cumul réel', 'Cumul objectif', 'Écart cumulé', 'Statut du cumul', 'Tendance 3 mois', 'Même mois an dernier', 'Projection fin d\'exercice'];
    const l = synthese(E, mois).lignes.map((f) => [nomDom(f.k.domaine), f.k.nom, f.k.unite, SENS[f.k.sens], mois, nbCsv(f.reel), nbCsv(f.objectif), nbCsv(f.ecart?.abs), nbCsv(f.ecart?.pct, 1), LIB_STATUT[f.statut], nbCsv(f.cumul.reel), nbCsv(f.cumul.objectif), nbCsv(f.cumul.ecart?.abs), LIB_STATUT[f.cumul.statut], f.tendance ? f.tendance.direction : '', nbCsv(f.an?.valeur), nbCsv(f.projection?.valeur, 0)]);
    return csv([tete, ...l]);
  }
  function versCsvSaisies(E) {
    const ks = actifs(E);
    const mois = Object.keys(E.saisies).sort();
    return csv([['Mois', ...ks.map((k) => `${k.nom} (${k.unite})`)], ...mois.map((m) => [m, ...ks.map((k) => nbCsv(valeur(E, k.id, m), 4))])]);
  }

  racine.TDB = {
    SENS, CUMULS, REPARTITIONS, STATUTS, LIB_STATUT, MOIS,
    cle, estMois, ajoutMois, ecartMois, moisDeDate, moisDeIso, libMois, exerciceDe, moisExercice, indexExercice, libExercice, derniersMois,
    fini, arrondi, lireNombre, nombre, format, formatEcart, pct, saisie,
    indicateur, estCalcule, estFlux, actifs, saisis, valeur, valeurPeriode,
    repartir, poidsSaisonniers, objectifBrut, objectifsMensuels, objectifAnnuel, objectifMois, objectifPeriode,
    ecart, statut, favorable, tendance, variationAn, cumulExercice, projection, serie, fiche, synthese, completude, moisParDefaut,
    depuisModele, dependancesModele, ajouterModele, utilisePar, creeBoucle, actionsReprises,
    nouvelId, normaliserIndicateur, normaliserObjectif, etatVide, normaliser, versCsvRevue, versCsvSaisies,
  };
})(typeof window !== 'undefined' ? window : globalThis);
