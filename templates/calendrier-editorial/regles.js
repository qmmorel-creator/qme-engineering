// Calendrier éditorial QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CED) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; jours : 0 = lundi … 6 = dimanche.
//
// Un contenu passe par quatre statuts : idee → brouillon → programme → publie.
// Programmé et publié ont toujours une date. Les statistiques d'un contenu publié sont saisies à la main.
// Régularité : une semaine (lundi → dimanche) est « tenue » quand le nombre de contenus publiés atteint
// l'objectif de la semaine ; une semaine marquée « pause » ne compte pas et ne casse pas la série.
(function (racine) {
  'use strict';

  const STATUTS = ['idee', 'brouillon', 'programme', 'publie'];
  const LIB_STATUT = { idee: 'Idée', brouillon: 'Brouillon', programme: 'Programmé', publie: 'Publié' };
  const STATS = ['vues', 'reactions', 'commentaires', 'partages', 'contacts'];
  const CRITERES = { contacts: 'Contacts générés', taux: 'Taux d\'interaction', interactions: 'Interactions', vues: 'Vues' };
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const jourIndex = (s) => (versDate(s).getDay() + 6) % 7;
  const lundiDe = (s) => ajout(s, -jourIndex(s));
  const premierDuMois = (s) => `${s.slice(0, 8)}01`;
  const moisSuivant = (s, k = 1) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m - 1 + k, 1)); };
  const joursDuMois = (s) => {
    const [a, m] = s.split('-').map(Number);
    const n = new Date(a, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${a}-${deux(m)}-${deux(i + 1)}`);
  };
  // Semaines (lundi → dimanche) qui couvrent le mois : tableau de 4 à 6 semaines de 7 dates.
  function grilleMois(s) {
    const jours = joursDuMois(s);
    const debut = lundiDe(jours[0]);
    const fin = jours[jours.length - 1];
    const semaines = [];
    for (let l = debut; l <= fin; l = ajout(l, 7)) semaines.push(Array.from({ length: 7 }, (_, k) => ajout(l, k)));
    return semaines;
  }

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Nombres ----------
  // « 1 250 », « 1250 », « 3 » → entier ≥ 0 ; vide → null ; illisible ou négatif → NaN.
  function lireEntier(saisie) {
    const s = String(saisie ?? '').replace(/[\s  .]/g, '');
    if (s === '') return null;
    if (!/^\d+$/.test(s)) return NaN;
    return Number(s);
  }
  const nombreTexte = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('fr-FR'));

  // ---------- Texte et compteur ----------
  const segmenteur = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
  // Caractères tels qu'on les voit (un émoji composé compte pour un). Les réseaux peuvent compter autrement.
  const longueur = (t) => (segmenteur ? [...segmenteur.segment(t)].length : Array.from(t).length);
  const CROCHETS = /\[[^\]\n]{1,120}\]/g;

  // Compte un texte : caractères, mots, lignes, hashtags, accroche (première ligne non vide) et repères.
  // limite : limite de caractères saisie pour le canal (null = aucune). accroche : longueur repère de l'accroche.
  function compter(texte, { limite = null, accroche = null } = {}) {
    const t = String(texte ?? '');
    const caracteres = longueur(t);
    const mots = t.trim() ? t.trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length : 0;
    const lignes = t ? t.split('\n').length : 0;
    const hashtags = (t.match(/(^|\s)#\p{L}[\p{L}\p{N}_]*/gu) || []).length;
    const premiere = t.split('\n').find((l) => l.trim()) || '';
    const acc = { texte: premiere.trim(), caracteres: longueur(premiere.trim()) };
    acc.depasse = accroche ? acc.caracteres > accroche : false;
    const aRemplacer = (t.match(CROCHETS) || []).length;
    const res = { caracteres, mots, lignes, hashtags, accroche: acc, aRemplacer, limite: limite || null, reste: null, depasse: false };
    if (limite) { res.reste = limite - caracteres; res.depasse = caracteres > limite; }
    return res;
  }

  // ---------- Contenus ----------
  function normaliserStats(s) {
    if (!s || typeof s !== 'object') return null;
    const r = {};
    let un = false;
    for (const k of STATS) {
      const v = s[k];
      if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0) { r[k] = null; continue; }
      r[k] = Math.round(Number(v)); un = true;
    }
    return un ? r : null;
  }

  function normaliserContenu(c, aujourdhui) {
    const statut = STATUTS.includes(c.statut) ? c.statut : 'idee';
    const res = {
      id: String(c.id || nouvelId()), titre: String(c.titre || 'Sans titre').slice(0, 140),
      pilier: String(c.pilier || ''), format: String(c.format || ''), canal: String(c.canal || ''),
      statut, date: DATE.test(c.date || '') ? c.date : null, heure: /^\d{2}:\d{2}$/.test(c.heure || '') ? c.heure : '',
      texte: String(c.texte || ''), notes: String(c.notes || ''), trame: c.trame ? String(c.trame) : '',
      stats: normaliserStats(c.stats), statsLe: DATE.test(c.statsLe || '') ? c.statsLe : null,
      recycleDe: c.recycleDe ? String(c.recycleDe) : null, creeLe: DATE.test(c.creeLe || '') ? c.creeLe : aujourdhui,
    };
    // Programmé ou publié sans date (ancienne version, import) : redevient brouillon.
    if ((statut === 'programme' || statut === 'publie') && !res.date) res.statut = res.texte ? 'brouillon' : 'idee';
    if (res.statut !== 'publie') { res.stats = null; res.statsLe = null; }
    return res;
  }

  // Erreur de saisie d'un contenu, ou null.
  function verifierContenu(c) {
    if (!String(c.titre || '').trim()) return 'Donne un sujet (titre interne) au contenu.';
    if (!STATUTS.includes(c.statut)) return 'Statut inconnu.';
    if ((c.statut === 'programme' || c.statut === 'publie') && !DATE.test(c.date || '')) return c.statut === 'programme' ? 'Choisis la date de publication prévue.' : 'Indique la date de publication.';
    return null;
  }

  // Passe un contenu au statut voulu. Publié : date du jour si aucune date ou une date future.
  // Renvoie une erreur (texte) ou null ; le contenu n'est modifié qu'en l'absence d'erreur.
  function changerStatut(c, statut, aujourdhui, date) {
    if (!STATUTS.includes(statut)) return 'Statut inconnu.';
    let d = date !== undefined ? date : c.date;
    if (statut === 'publie' && (!d || d > aujourdhui)) d = aujourdhui;
    if (statut === 'programme' && !d) return 'Choisis la date de publication prévue.';
    c.statut = statut;
    c.date = d || null;
    if (statut !== 'publie') { c.stats = null; c.statsLe = null; }
    return null;
  }

  // Statut suivant (bouton « Avancer ») : idée → brouillon → programmé → publié.
  const statutSuivant = (s) => STATUTS[Math.min(STATUTS.indexOf(s) + 1, STATUTS.length - 1)];

  const dates = (etat) => etat.contenus.filter((c) => c.date);
  const contenusEntre = (etat, de, a, statuts = ['programme', 'publie']) => etat.contenus.filter((c) => c.date && c.date >= de && c.date <= a && statuts.includes(c.statut));
  const contenusDuJour = (etat, d) => etat.contenus.filter((c) => c.date === d).sort((x, y) => (x.heure || '99').localeCompare(y.heure || '99'));

  // ---------- Régularité ----------
  const debutSuivi = (etat) => lundiDe(etat.reglages.depuis);
  const objectif = (etat) => Math.max(1, Math.min(14, Number(etat.reglages.objectifSemaine) || 1));

  function semaine(etat, lundi, aujourdhui) {
    const fin = ajout(lundi, 6);
    const publies = contenusEntre(etat, lundi, fin, ['publie']).length;
    const prevus = contenusEntre(etat, lundi, fin, ['programme', 'publie']).length;
    const obj = objectif(etat);
    return { lundi, publies, prevus, objectif: obj, tenue: publies >= obj, pause: etat.pauses.includes(lundi), enCours: lundi === lundiDe(aujourdhui), future: lundi > lundiDe(aujourdhui), avant: lundi < debutSuivi(etat) };
  }

  // Les n semaines qui finissent par celle d'aujourd'hui (plus `apres` semaines à venir).
  function regularite(etat, aujourdhui, n = 12, apres = 0) {
    const l = lundiDe(aujourdhui);
    return Array.from({ length: n + apres }, (_, i) => semaine(etat, ajout(l, 7 * (i - n + 1)), aujourdhui));
  }

  // Série en cours : semaines tenues consécutives jusqu'à celle d'aujourd'hui. La semaine en cours compte si
  // elle est déjà tenue, sinon elle ne casse rien (elle n'est pas finie). Une pause est sautée.
  function serie(etat, aujourdhui) {
    let n = 0;
    const debut = debutSuivi(etat);
    for (let l = lundiDe(aujourdhui); l >= debut; l = ajout(l, -7)) {
      const s = semaine(etat, l, aujourdhui);
      if (s.tenue) n++;
      else if (s.pause || s.enCours) continue;
      else break;
    }
    return n;
  }

  function meilleureSerie(etat, aujourdhui) {
    let n = 0, meilleure = 0;
    for (let l = debutSuivi(etat); l <= lundiDe(aujourdhui); l = ajout(l, 7)) {
      const s = semaine(etat, l, aujourdhui);
      if (s.tenue) { n++; meilleure = Math.max(meilleure, n); } else if (!s.pause && !s.enCours) n = 0;
    }
    return meilleure;
  }

  // Taux de semaines tenues parmi les n dernières semaines terminées (hors pauses et hors avant le début).
  function tauxSemaines(etat, aujourdhui, n = 12) {
    const sem = regularite(etat, aujourdhui, n + 1).filter((s) => !s.enCours && !s.pause && !s.avant);
    const tenues = sem.filter((s) => s.tenue).length;
    return { tenues, comptees: sem.length, taux: sem.length ? Math.round((tenues / sem.length) * 100) : null };
  }

  const basculerPause = (etat, lundi) => {
    etat.pauses = etat.pauses.includes(lundi) ? etat.pauses.filter((x) => x !== lundi) : [...etat.pauses, lundi].sort();
    return etat.pauses.includes(lundi);
  };

  // ---------- Piliers ----------
  // Répartition des contenus programmés ou publiés par pilier entre deux dates, face à la part visée.
  // Les parts visées sont ramenées à 100 % (seuls les piliers avec une part > 0 sont visés).
  function repartitionPiliers(etat, de, a) {
    const liste = contenusEntre(etat, de, a);
    const somme = etat.piliers.reduce((t, p) => t + (Number(p.part) > 0 ? Number(p.part) : 0), 0);
    const lignes = etat.piliers.map((p) => {
      const n = liste.filter((c) => c.pilier === p.id).length;
      const part = liste.length ? Math.round((n / liste.length) * 100) : 0;
      const cible = somme ? Math.round(((Number(p.part) > 0 ? Number(p.part) : 0) / somme) * 100) : 0;
      return { pilier: p.id, nom: p.nom, couleur: p.couleur, n, part, cible, ecart: part - cible };
    });
    const sans = liste.filter((c) => !etat.piliers.some((p) => p.id === c.pilier)).length;
    return { total: liste.length, sans, lignes };
  }

  // Pilier le plus en retard sur sa part visée (8 semaines passées et 2 à venir), ou null.
  function pilierAPrivilegier(etat, aujourdhui) {
    const r = repartitionPiliers(etat, ajout(lundiDe(aujourdhui), -49), ajout(lundiDe(aujourdhui), 13));
    const vises = r.lignes.filter((l) => l.cible > 0);
    if (!vises.length) return null;
    const pire = vises.reduce((m, l) => (l.ecart < m.ecart ? l : m));
    return pire.ecart <= -5 || r.total === 0 ? pire : null;
  }

  // ---------- Statistiques ----------
  function engagement(stats) {
    if (!stats) return { interactions: null, taux: null };
    const parts = ['reactions', 'commentaires', 'partages'].map((k) => stats[k]);
    const interactions = parts.some((v) => v !== null && v !== undefined) ? parts.reduce((t, v) => t + (v || 0), 0) : null;
    const taux = interactions !== null && stats.vues > 0 ? Math.round((interactions / stats.vues) * 1000) / 10 : null;
    return { interactions, taux };
  }

  const valeurCritere = (c, critere) => {
    const e = engagement(c.stats);
    if (critere === 'taux') return e.taux ?? -1;
    if (critere === 'interactions') return e.interactions ?? -1;
    return c.stats?.[critere] ?? -1;
  };

  // Contenus publiés avec statistiques, du meilleur au moins bon selon le critère (puis taux, puis vues).
  function classer(etat, critere = 'contacts', de = null, a = null) {
    return etat.contenus
      .filter((c) => c.statut === 'publie' && c.stats && (!de || c.date >= de) && (!a || c.date <= a))
      .sort((x, y) => valeurCritere(y, critere) - valeurCritere(x, critere) || valeurCritere(y, 'taux') - valeurCritere(x, 'taux') || valeurCritere(y, 'vues') - valeurCritere(x, 'vues'));
  }

  // Moyennes par pilier, format ou canal (contenus publiés avec statistiques).
  function moyennesPar(etat, cle, de = null, a = null) {
    const groupes = new Map();
    for (const c of classer(etat, 'vues', de, a)) {
      const g = groupes.get(c[cle]) || { id: c[cle], n: 0, vues: 0, nVues: 0, interactions: 0, contacts: 0, sommeTaux: 0, nTaux: 0 };
      const e = engagement(c.stats);
      g.n++;
      if (c.stats.vues !== null) { g.vues += c.stats.vues; g.nVues++; }
      if (e.interactions !== null) g.interactions += e.interactions;
      if (e.taux !== null) { g.sommeTaux += e.taux; g.nTaux++; }
      g.contacts += c.stats.contacts || 0;
      groupes.set(c[cle], g);
    }
    return [...groupes.values()].map((g) => ({ id: g.id, n: g.n, vuesMoy: g.nVues ? Math.round(g.vues / g.nVues) : null, tauxMoy: g.nTaux ? Math.round((g.sommeTaux / g.nTaux) * 10) / 10 : null, contacts: g.contacts })).sort((x, y) => y.contacts - x.contacts || (y.tauxMoy ?? -1) - (x.tauxMoy ?? -1));
  }

  // Totaux d'une période (contenus publiés).
  function totaux(etat, de, a) {
    const pub = contenusEntre(etat, de, a, ['publie']);
    const avec = pub.filter((c) => c.stats);
    const somme = (k) => avec.reduce((t, c) => t + (c.stats[k] || 0), 0);
    const vues = somme('vues');
    const interactions = avec.reduce((t, c) => t + (engagement(c.stats).interactions || 0), 0);
    return { publies: pub.length, avecStats: avec.length, vues, interactions, contacts: somme('contacts'), taux: vues ? Math.round((interactions / vues) * 1000) / 10 : null };
  }

  // ---------- Recyclage ----------
  // Contenus à recycler : publiés depuis au moins `delaiRecyclage` jours, dans le meilleur tiers selon le critère
  // choisi (au moins un), avec un résultat réel (critère > 0), et sans reprise récente (moins de `delai` jours).
  function aRecycler(etat, aujourdhui) {
    const delai = Number(etat.reglages.delaiRecyclage) || 90;
    const critere = etat.reglages.critere || 'contacts';
    const classes = classer(etat, critere);
    const tiers = Math.max(1, Math.ceil(classes.length / 3));
    const limite = ajout(aujourdhui, -delai);
    return classes.slice(0, tiers).filter((c) => {
      if (c.date > limite || valeurCritere(c, critere) <= 0) return false;
      return !etat.contenus.some((x) => x.recycleDe === c.id && (x.date || x.creeLe) > limite);
    });
  }

  // Crée la reprise d'un contenu (même pilier et canal, format suivant, texte repris en brouillon).
  function recycler(etat, c, aujourdhui, base) {
    const format = (base?.recyclage || {})[c.format] || c.format;
    const formatExiste = etat.formats.some((f) => f.id === format);
    const nouveau = normaliserContenu({
      titre: `Reprise · ${c.titre}`.slice(0, 140), pilier: c.pilier, canal: c.canal, format: formatExiste ? format : c.format,
      statut: c.texte ? 'brouillon' : 'idee', texte: c.texte, recycleDe: c.id,
      notes: `Reprise de « ${c.titre} », publié le ${c.date}. Nouvelle accroche, nouvelle forme, exemples à jour.`,
    }, aujourdhui);
    etat.contenus.push(nouveau);
    return nouveau;
  }

  // ---------- Planification ----------
  // Prochains jours préférés (à partir d'aujourd'hui) sans contenu programmé ou publié.
  function joursLibres(etat, aujourdhui, n = 3, horizon = 42) {
    const prefs = etat.reglages.jours.length ? etat.reglages.jours : [0, 1, 2, 3, 4];
    const res = [];
    for (let d = aujourdhui, k = 0; k < horizon && res.length < n; d = ajout(d, 1), k++) {
      if (!prefs.includes(jourIndex(d)) || etat.pauses.includes(lundiDe(d))) continue;
      if (!contenusEntre(etat, d, d).length) res.push(d);
    }
    return res;
  }

  // ---------- Alertes ----------
  function alertes(etat, aujourdhui) {
    const res = [];
    const limiteStats = ajout(aujourdhui, -(Number(etat.reglages.delaiStats) || 7));
    const canal = (id) => etat.canaux.find((x) => x.id === id);
    for (const c of etat.contenus) {
      if (c.statut === 'programme' && c.date < aujourdhui) res.push({ type: 'oubli', niveau: 'haut', id: c.id, date: c.date, texte: `« ${c.titre} » était prévu le ${c.date} : publié ? Marque-le, ou choisis une nouvelle date.` });
      if (c.statut === 'publie' && !c.stats && c.date <= limiteStats) res.push({ type: 'stats', niveau: 'moyen', id: c.id, date: c.date, texte: `Statistiques à saisir pour « ${c.titre} ».` });
      if (c.statut === 'programme' && c.date >= aujourdhui && ecart(aujourdhui, c.date) <= 2) {
        const k = compter(c.texte);
        if (!c.texte.trim()) res.push({ type: 'texte', niveau: 'haut', id: c.id, date: c.date, texte: `« ${c.titre} » part ${c.date === aujourdhui ? 'aujourd\'hui' : `le ${c.date}`} et n'a pas encore de texte.` });
        else if (k.aRemplacer) res.push({ type: 'texte', niveau: 'moyen', id: c.id, date: c.date, texte: `« ${c.titre} » contient encore ${k.aRemplacer} passage${k.aRemplacer > 1 ? 's' : ''} [entre crochets] à remplacer.` });
      }
      if ((c.statut === 'programme' || c.statut === 'brouillon') && canal(c.canal)?.limite) {
        const k = compter(c.texte, { limite: canal(c.canal).limite });
        if (k.depasse) res.push({ type: 'limite', niveau: 'moyen', id: c.id, date: c.date, texte: `« ${c.titre} » dépasse de ${-k.reste} caractères la limite saisie pour ${canal(c.canal).nom}.` });
      }
    }
    for (const s of regularite(etat, aujourdhui, 1, 1)) {
      if (s.pause || s.prevus >= s.objectif) continue;
      const manque = s.objectif - s.prevus;
      res.push({ type: 'trou', niveau: s.enCours ? 'haut' : 'moyen', lundi: s.lundi, texte: `${s.enCours ? 'Cette semaine' : 'La semaine prochaine'} : ${manque} contenu${manque > 1 ? 's' : ''} à programmer pour tenir ton objectif (${s.prevus} sur ${s.objectif}).` });
    }
    const ordre = { haut: 0, moyen: 1 };
    return res.sort((x, y) => ordre[x.niveau] - ordre[y.niveau] || String(x.date || x.lundi).localeCompare(String(y.date || y.lundi)));
  }

  // ---------- Banque de sujets ----------
  const sujetsPour = (base, metier) => base.idees.filter((x) => x.metier === 'tous' || x.metier === metier);

  // Ajoute des sujets de la banque comme idées (sujets déjà présents ignorés). Pilier absent → premier pilier.
  function ajouterSujets(etat, sujets, aujourdhui) {
    let n = 0;
    for (const s of sujets) {
      if (etat.contenus.some((c) => c.titre === s.sujet)) continue;
      const pilier = etat.piliers.some((p) => p.id === s.pilier) ? s.pilier : etat.piliers[0]?.id || '';
      const format = etat.formats.some((f) => f.id === s.format) ? s.format : etat.formats[0]?.id || '';
      etat.contenus.push(normaliserContenu({ titre: s.sujet, pilier, format, canal: etat.canaux[0]?.id || '', statut: 'idee', trame: s.trame }, aujourdhui));
      n++;
    }
    return n;
  }

  // ---------- État ----------
  function etatInitial(base, aujourdhui, { prenom = '', metier = '', objectifSemaine = 2, jours = [1, 3], piliers = null, canal = 'Réseau professionnel' } = {}) {
    const choisis = (piliers || base.piliers.filter((p) => p.part > 0).map((p) => p.id));
    return normaliserEtat({
      prenom, metier,
      reglages: { objectifSemaine, jours, depuis: aujourdhui },
      piliers: base.piliers.filter((p) => choisis.includes(p.id)).map((p) => ({ ...p })),
      formats: base.formats.map((f) => ({ ...f })),
      canaux: [{ id: nouvelId(), nom: canal, limite: null }],
      contenus: [], pauses: [],
    }, aujourdhui, base);
  }

  function normaliserEtat(d, aujourdhui, base) {
    const couleurs = base.couleurs.map((c) => c.id);
    const v = { version: 1, prenom: '', metier: '', reglages: { objectifSemaine: 2, jours: [1, 3], longueurAccroche: 150, delaiRecyclage: 90, delaiStats: 7, critere: 'contacts', depuis: aujourdhui }, piliers: [], formats: [], canaux: [], contenus: [], pauses: [] };
    if (!d || typeof d !== 'object') return v;
    const reglages = { ...v.reglages, ...(d.reglages || {}) };
    reglages.objectifSemaine = Math.max(1, Math.min(14, Math.round(Number(reglages.objectifSemaine)) || 2));
    reglages.jours = Array.isArray(reglages.jours) ? [...new Set(reglages.jours.map(Number).filter((j) => j >= 0 && j <= 6))].sort() : [1, 3];
    for (const [k, def, min, max] of [['longueurAccroche', 150, 20, 1000], ['delaiRecyclage', 90, 14, 730], ['delaiStats', 7, 1, 60]]) {
      const n = Math.round(Number(reglages[k]));
      reglages[k] = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    }
    if (!CRITERES[reglages.critere]) reglages.critere = 'contacts';
    if (!DATE.test(reglages.depuis || '')) reglages.depuis = aujourdhui;
    const piliers = (Array.isArray(d.piliers) ? d.piliers : []).filter((p) => p && p.id).map((p) => ({
      id: String(p.id), nom: String(p.nom || 'Pilier').slice(0, 40), couleur: couleurs.includes(p.couleur) ? p.couleur : couleurs[0],
      part: Math.max(0, Math.min(100, Math.round(Number(p.part)) || 0)), description: String(p.description || '').slice(0, 240),
    }));
    const formats = (Array.isArray(d.formats) ? d.formats : []).filter((f) => f && f.id).map((f) => ({ id: String(f.id), nom: String(f.nom || 'Format').slice(0, 40), minutes: Math.max(0, Math.min(600, Math.round(Number(f.minutes)) || 0)) }));
    const canaux = (Array.isArray(d.canaux) ? d.canaux : []).filter((c) => c && c.id).map((c) => {
      const l = Math.round(Number(c.limite));
      return { id: String(c.id), nom: String(c.nom || 'Canal').slice(0, 40), limite: Number.isFinite(l) && l > 0 ? l : null };
    });
    const contenus = (Array.isArray(d.contenus) ? d.contenus : []).filter((c) => c && typeof c === 'object').map((c) => normaliserContenu(c, aujourdhui));
    const pauses = (Array.isArray(d.pauses) ? d.pauses : []).filter((x) => DATE.test(x) && jourIndex(x) === 0);
    return { ...v, ...d, prenom: String(d.prenom || ''), metier: String(d.metier || ''), reglages, piliers, formats, canaux, contenus, pauses: [...new Set(pauses)].sort() };
  }

  // ---------- Export ----------
  const champCsv = (x) => { const s = String(x ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function versCsv(etat) {
    const nom = (liste, id) => liste.find((x) => x.id === id)?.nom || '';
    const lignes = [['date', 'heure', 'statut', 'sujet', 'pilier', 'format', 'canal', 'caracteres', 'vues', 'reactions', 'commentaires', 'partages', 'contacts', 'taux_interaction_pct', 'repris_de']];
    const tries = [...etat.contenus].sort((x, y) => String(x.date || '9999').localeCompare(String(y.date || '9999')));
    for (const c of tries) {
      const s = c.stats || {};
      const e = engagement(c.stats);
      lignes.push([c.date || '', c.heure, LIB_STATUT[c.statut], c.titre, nom(etat.piliers, c.pilier), nom(etat.formats, c.format), nom(etat.canaux, c.canal), longueur(c.texte), s.vues ?? '', s.reactions ?? '', s.commentaires ?? '', s.partages ?? '', s.contacts ?? '', e.taux === null ? '' : String(e.taux).replace('.', ','), c.recycleDe ? (etat.contenus.find((x) => x.id === c.recycleDe)?.titre || '') : '']);
    }
    return lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.CED = {
    STATUTS, LIB_STATUT, STATS, CRITERES,
    iso, versDate, ajout, ecart, jourIndex, lundiDe, premierDuMois, moisSuivant, joursDuMois, grilleMois, nouvelId,
    lireEntier, nombreTexte, longueur, compter,
    normaliserStats, normaliserContenu, verifierContenu, changerStatut, statutSuivant, dates, contenusEntre, contenusDuJour,
    objectif, semaine, regularite, serie, meilleureSerie, tauxSemaines, basculerPause,
    repartitionPiliers, pilierAPrivilegier,
    engagement, valeurCritere, classer, moyennesPar, totaux,
    aRecycler, recycler, joursLibres, alertes,
    sujetsPour, ajouterSujets, etatInitial, normaliserEtat, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
