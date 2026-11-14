// Suivi des congés et absences QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CNG) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Jours de congé en nombres décimaux
// (demi-journées), arrondis à 2 décimales pour l'affichage.
(function (racine) {
  'use strict';

  const STATUTS = ['demandee', 'validee', 'refusee', 'annulee'];
  const LIB_STATUT = { demandee: 'Demandée', validee: 'Validée', refusee: 'Refusée', annulee: 'Annulée' };
  // Statuts qui occupent le calendrier (une demande en attente compte déjà pour les chevauchements).
  const OCCUPE = ['demandee', 'validee'];
  const DECOMPTES = ['cp', 'rtt', 'aucun'];
  const ACQUIERT = ['oui', 'maladie', 'non'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate();
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const jourSemaine = (s) => versDate(s).getDay(); // 0 = dimanche … 6 = samedi
  const min = (a, b) => (a < b ? a : b);
  const max = (a, b) => (a > b ? a : b);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j, joursDansMois(an, mo)))}`;
  }
  const arrondi2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const nombre = (x) => { const v = arrondi2(x); return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '')).replace('.', ',').replace('-', '−'); };
  // « 2,5 », « 2.08 » → 2.5 ; null si vide ou illisible.
  function lireNombre(saisie, { negatif = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s ]/g, '').replace(',', '.').replace('−', '-');
    if (!s || !(negatif ? /^-?\d+(\.\d{0,4})?$/ : /^\d+(\.\d{0,4})?$/).test(s)) return null;
    return Number(s);
  }

  // ---------- Jours fériés (France) ----------
  // Dimanche de Pâques, calendrier grégorien (algorithme dit « de Meeus / Jones / Butcher »).
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  // Les 11 fêtes légales de l'article L3133-1 du Code du travail, plus les 2 jours propres à
  // l'Alsace-Moselle (Vendredi saint, 26 décembre), ajoutés seulement si demandés.
  const FERIES = [
    ['jan1', 'Jour de l\'an'], ['lundiPaques', 'Lundi de Pâques'], ['mai1', 'Fête du Travail'], ['mai8', 'Victoire 1945'],
    ['ascension', 'Ascension'], ['lundiPentecote', 'Lundi de Pentecôte'], ['juil14', 'Fête nationale'], ['aout15', 'Assomption'],
    ['nov1', 'Toussaint'], ['nov11', 'Armistice 1918'], ['dec25', 'Noël'], ['vendrediSaint', 'Vendredi saint (Alsace-Moselle)'], ['dec26', 'Saint-Étienne (Alsace-Moselle)'],
  ];
  const NOM_FERIE = Object.fromEntries(FERIES);
  function feries(annee) {
    const p = paques(annee);
    const fixe = (m, j) => `${annee}-${deux(m)}-${deux(j)}`;
    const dates = {
      jan1: fixe(1, 1), lundiPaques: ajout(p, 1), mai1: fixe(5, 1), mai8: fixe(5, 8), ascension: ajout(p, 39),
      lundiPentecote: ajout(p, 50), juil14: fixe(7, 14), aout15: fixe(8, 15), nov1: fixe(11, 1), nov11: fixe(11, 11),
      dec25: fixe(12, 25), vendrediSaint: ajout(p, -2), dec26: fixe(12, 26),
    };
    return FERIES.map(([id, nom]) => ({ id, nom, date: dates[id] })).sort((x, y) => x.date.localeCompare(y.date));
  }
  // Fériés chômés dans l'entreprise (identifiants cochés dans les réglages), indexés par date.
  const cacheFeries = new Map();
  function ferieChome(date, reg) {
    const an = Number(date.slice(0, 4));
    const cle = `${an}|${(reg.feriesChomes || []).join(',')}`;
    if (!cacheFeries.has(cle)) {
      if (cacheFeries.size > 200) cacheFeries.clear();
      const choisis = new Set(reg.feriesChomes || []);
      cacheFeries.set(cle, new Map(feries(an).filter((f) => choisis.has(f.id)).map((f) => [f.date, f])));
    }
    return cacheFeries.get(cle).get(date) || null;
  }
  // Jour ouvré : jour habituellement travaillé dans l'entreprise (réglage), hors férié chômé.
  const estOuvre = (date, reg) => (reg.joursTravailles || [1, 2, 3, 4, 5]).includes(jourSemaine(date)) && !ferieChome(date, reg);
  // Jour ouvrable : tous les jours sauf le dimanche et les fériés chômés.
  const estOuvrable = (date, reg) => jourSemaine(date) !== 0 && !ferieChome(date, reg);

  // ---------- Types d'absence ----------
  const typeDe = (types, id) => (types || []).find((t) => t.id === id) || null;
  const uniteDe = (type, reg) => (type?.decompte === 'rtt' ? 'ouvres' : reg.decompte);

  // ---------- Décompte d'une absence ----------
  // Fin « de décompte » : en jours ouvrables, un congé qui s'achève le dernier jour travaillé de la
  // semaine emporte les jours ouvrables non travaillés qui suivent (le samedi, pour une semaine du lundi
  // au vendredi) : une semaine de congé compte 6 jours ouvrables.
  function finDecompte(abs, reg, unite) {
    if (unite !== 'ouvrables' || abs.demiFin) return abs.fin;
    let f = abs.fin;
    if (!estOuvre(f, reg)) return f;
    for (let i = 0; i < 6; i++) {
      const s = ajout(f, 1);
      if (jourSemaine(s) === 0 || !estOuvrable(s, reg) || estOuvre(s, reg)) break;
      f = s;
    }
    return f;
  }
  // Jours décomptés d'une absence (congés payés ou RTT), éventuellement limités à [de, a].
  // Demi-journées : « demiDebut » = commence l'après-midi, « demiFin » = s'arrête à midi.
  function decompte(abs, types, reg, borne = {}) {
    const type = typeDe(types, abs.type);
    if (!type || type.decompte === 'aucun') return 0;
    const unite = uniteDe(type, reg);
    const compte = unite === 'ouvrables' ? (d) => estOuvrable(d, reg) : (d) => estOuvre(d, reg);
    const fin = finDecompte(abs, reg, unite);
    const de = max(abs.debut, borne.de || abs.debut), a = min(fin, borne.a || fin);
    if (de > a) return 0;
    let n = 0;
    for (let d = de; d <= a; d = ajout(d, 1)) if (compte(d)) n += 1;
    if (abs.debut === abs.fin && (abs.demiDebut || abs.demiFin)) return compte(abs.debut) && de <= abs.debut && abs.debut <= a ? 0.5 : 0;
    if (abs.demiDebut && de === abs.debut && compte(abs.debut)) n -= 0.5;
    if (abs.demiFin && a === abs.fin && compte(abs.fin)) n -= 0.5;
    return n;
  }

  // ---------- Période de référence ----------
  // moisDebut : 6 = du 1er juin au 31 mai (défaut, art. R3141-4), 1 = année civile.
  function periode(date, reg) {
    const m = reg.moisDebut || 6;
    const an = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7));
    const debut = `${mo >= m ? an : an - 1}-${deux(m)}-01`;
    return { debut, fin: ajout(ajoutMois(debut, 12), -1) };
  }
  const periodePrecedente = (p, reg) => periode(ajout(p.debut, -1), reg);
  const libellePeriode = (p) => (p.debut.slice(5) === '01-01' ? p.debut.slice(0, 4) : `${p.debut.slice(0, 4)}-${p.fin.slice(0, 4)}`);

  // ---------- Acquisition des congés payés ----------
  // Prorata des jours calendaires de chaque mois : un mois complet de travail effectif (ou de période
  // assimilée) donne reg.acquisition.mois jours ; un mois d'arrêt maladie non professionnel donne
  // reg.acquisition.maladieMois jours, dans la limite de reg.acquisition.maladiePlafond par période ; une
  // absence « non » (congé sans solde…) ne donne rien. Total plafonné à reg.acquisition.plafond.
  function categorieJour(date, absences, types) {
    for (const a of absences) {
      if (a.statut !== 'validee' || date < a.debut || date > a.fin) continue;
      const t = typeDe(types, a.type);
      if (t && t.acquiert !== 'oui') return t.acquiert;
    }
    return 'oui';
  }
  function acquisition(sal, absences, types, reg, p, jusqua) {
    const ac = reg.acquisition;
    const debut = max(max(p.debut, sal.entree || p.debut), reg.debutSuivi || p.debut);
    const fin = min(min(p.fin, jusqua), sal.sortie || p.fin);
    const res = { periode: p, debut, fin, mois: [], normal: 0, maladie: 0, acquis: 0, plafonne: false, maladiePlafonnee: false, complete: jusqua >= p.fin };
    if (debut > fin) return res;
    const siennes = absences.filter((a) => a.salarie === sal.id && a.statut === 'validee' && a.fin >= debut && a.debut <= fin);
    let mois = null;
    for (let d = debut; d <= fin; d = ajout(d, 1)) {
      const cle = d.slice(0, 7);
      if (!mois || mois.mois !== cle) { mois = { mois: cle, jours: joursDansMois(Number(cle.slice(0, 4)), Number(cle.slice(5, 7))), oui: 0, maladie: 0, non: 0 }; res.mois.push(mois); }
      mois[categorieJour(d, siennes, types)] += 1;
    }
    for (const m of res.mois) {
      m.normal = (m.oui / m.jours) * ac.mois;
      m.maladieBrut = (m.maladie / m.jours) * ac.maladieMois;
      res.normal += m.normal;
      res.maladie += m.maladieBrut;
    }
    if (res.maladie > ac.maladiePlafond) { res.maladie = ac.maladiePlafond; res.maladiePlafonnee = true; }
    let total = res.normal + res.maladie;
    if (total > ac.plafond) { total = ac.plafond; res.plafonne = true; }
    // Période terminée : arrondi au nombre entier immédiatement supérieur (art. L3141-7), si coché.
    res.acquis = res.complete && reg.arrondiSup ? Math.ceil(arrondi2(total)) : arrondi2(total);
    return res;
  }
  // Périodes de référence couvertes par le suivi, de la première (début du suivi ou entrée) à celle d'une date.
  function periodesJusqua(sal, reg, date) {
    const depart = max(reg.debutSuivi || date, sal.entree || reg.debutSuivi || date);
    const liste = [];
    let p = periode(min(depart, date), reg);
    const derniere = periode(date, reg);
    while (p.debut <= derniere.debut && liste.length < 60) { liste.push(p); p = periode(ajout(p.fin, 1), reg); }
    return liste;
  }

  // ---------- RTT ----------
  // reg.rttMode : « prorata » (acquis au fil des jours de l'année civile) ou « annuel » (le droit de
  // l'année, au prorata de la présence prévue, est crédité dès le 1er janvier ou dès l'entrée).
  function acquisRtt(sal, reg, jusqua) {
    const n = Number(sal.rttAnnuel) || 0;
    if (!n) return 0;
    const depart = max(reg.debutSuivi || sal.entree || jusqua, sal.entree || reg.debutSuivi || jusqua);
    const arret = sal.sortie ? min(sal.sortie, jusqua) : jusqua;
    let total = 0;
    for (let an = Number(depart.slice(0, 4)); an <= Number(jusqua.slice(0, 4)); an++) {
      const d1 = `${an}-01-01`, d2 = `${an}-12-31`, jours = ecart(d1, d2) + 1;
      const de = max(d1, depart);
      const a = reg.rttMode === 'annuel' ? min(d2, sal.sortie || d2) : min(d2, arret);
      if (de > a) continue;
      if (reg.rttMode === 'annuel' && `${an}-01-01` > jusqua) continue;
      total += n * (ecart(de, a) + 1) / jours;
    }
    return arrondi2(total);
  }

  // ---------- Soldes ----------
  function soldes(sal, etat, auj) {
    const reg = etat.reglages, types = etat.types;
    const siennes = etat.absences.filter((a) => a.salarie === sal.id);
    const cumul = (statuts, dec, borne) => arrondi2(siennes.filter((a) => statuts.includes(a.statut) && typeDe(types, a.type)?.decompte === dec).reduce((s, a) => s + decompte(a, types, reg, borne), 0));
    const ajust = (dec) => arrondi2((sal.ajustements || []).filter((x) => x.compteur === dec).reduce((s, x) => s + x.jours, 0));
    const veille = ajout(auj, -1);
    // Congés payés
    const periodes = periodesJusqua(sal, reg, auj);
    const acquisitions = periodes.map((p) => acquisition(sal, etat.absences, types, reg, p, auj));
    const enCours = acquisitions.at(-1) || acquisition(sal, etat.absences, types, reg, periode(auj, reg), auj);
    const anterieurs = arrondi2(acquisitions.slice(0, -1).reduce((s, x) => s + x.acquis, 0));
    const pCours = periode(auj, reg);
    const projection = acquisition(sal, etat.absences, types, reg, pCours, pCours.fin);
    const cp = {
      reliquat: Number(sal.reliquatCp) || 0, anterieurs, enCours: enCours.acquis, ajust: ajust('cp'),
      pris: cumul(['validee'], 'cp', { a: veille }), poses: cumul(['validee'], 'cp', { de: auj }), attente: cumul(['demandee'], 'cp'),
      projectionPeriode: projection.acquis, acquisitions, periode: pCours,
    };
    cp.solde = arrondi2(cp.reliquat + cp.anterieurs + cp.enCours + cp.ajust - cp.pris - cp.poses);
    cp.apresDemandes = arrondi2(cp.solde - cp.attente);
    // RTT
    const rtt = { reliquat: Number(sal.reliquatRtt) || 0, acquis: acquisRtt(sal, reg, auj), ajust: ajust('rtt'), pris: cumul(['validee'], 'rtt', { a: veille }), poses: cumul(['validee'], 'rtt', { de: auj }), attente: cumul(['demandee'], 'rtt') };
    rtt.solde = arrondi2(rtt.reliquat + rtt.acquis + rtt.ajust - rtt.pris - rtt.poses);
    rtt.apresDemandes = arrondi2(rtt.solde - rtt.attente);
    return { cp, rtt };
  }

  // ---------- Demandes et chevauchements ----------
  const actif = (sal, date) => (!sal.entree || sal.entree <= date) && (!sal.sortie || sal.sortie >= date);
  const couvre = (a, date) => a.debut <= date && date <= a.fin;
  const seChevauchent = (a, b) => a.debut <= b.fin && b.debut <= a.fin;
  // Absence du même salarié qui se superpose (hors refusées et annulées) : une saisie à refuser.
  const conflitPersonnel = (etat, abs) => etat.absences.find((x) => x.id !== abs.id && x.salarie === abs.salarie && OCCUPE.includes(x.statut) && seChevauchent(x, abs)) || null;
  // Absents (demandes en attente comprises) un jour donné, sur les jours ouvrés seulement.
  function absentsLe(etat, date, { equipe = null, sauf = null, statuts = OCCUPE } = {}) {
    if (!estOuvre(date, etat.reglages)) return [];
    return etat.absences.filter((a) => a.id !== sauf && statuts.includes(a.statut) && couvre(a, date) && (!equipe || etat.salaries.find((s) => s.id === a.salarie)?.equipe === equipe));
  }
  // Jours où une équipe dépasse son maximum d'absents simultanés, entre deux dates.
  function chevauchements(etat, de, a) {
    const res = [];
    for (const eq of etat.equipes) {
      if (!(eq.maxAbsents >= 0)) continue;
      for (let d = de; d <= a; d = ajout(d, 1)) {
        const abs = absentsLe(etat, d, { equipe: eq.id });
        const ids = [...new Set(abs.map((x) => x.salarie))];
        if (ids.length > eq.maxAbsents) res.push({ date: d, equipe: eq.id, salaries: ids, absences: abs.map((x) => x.id), max: eq.maxAbsents, enAttente: abs.some((x) => x.statut === 'demandee') });
      }
    }
    return res.sort((x, y) => x.date.localeCompare(y.date));
  }
  // Regroupe des jours d'alerte consécutifs (même équipe) en plages.
  function plagesAlerte(alertes, reg) {
    const res = [];
    for (const x of alertes) {
      const der = res.filter((r) => r.equipe === x.equipe).at(-1);
      const suite = der && (() => { let d = ajout(der.fin, 1); while (d < x.date && !estOuvre(d, reg)) d = ajout(d, 1); return d === x.date; })();
      if (suite) { der.fin = x.date; der.pic = Math.max(der.pic, x.salaries.length); der.salaries = [...new Set([...der.salaries, ...x.salaries])]; der.enAttente = der.enAttente || x.enAttente; der.jours += 1; }
      else res.push({ equipe: x.equipe, debut: x.date, fin: x.date, pic: x.salaries.length, max: x.max, salaries: [...x.salaries], enAttente: x.enAttente, jours: 1 });
    }
    return res.sort((p, q) => p.debut.localeCompare(q.debut));
  }
  // Chevauchements qu'une demande provoquerait (ou provoque) dans l'équipe du salarié.
  function alertesDemande(etat, abs) {
    const sal = etat.salaries.find((s) => s.id === abs.salarie);
    const eq = etat.equipes.find((e) => e.id === sal?.equipe);
    if (!eq || !(eq.maxAbsents >= 0)) return [];
    const res = [];
    for (let d = abs.debut; d <= abs.fin; d = ajout(d, 1)) {
      if (!estOuvre(d, etat.reglages)) continue;
      const autres = absentsLe(etat, d, { equipe: eq.id, sauf: abs.id }).filter((x) => x.salarie !== abs.salarie);
      const ids = [...new Set(autres.map((x) => x.salarie))];
      if (ids.length + 1 > eq.maxAbsents) res.push({ date: d, salaries: ids, total: ids.length + 1, max: eq.maxAbsents });
    }
    return res;
  }
  // Changement de statut : demandée → validée, refusée ou annulée ; validée → annulée ; refusée ou
  // annulée → demandée (remise en attente). Toute autre transition est refusée (null).
  const TRANSITIONS = { demandee: ['validee', 'refusee', 'annulee'], validee: ['annulee', 'demandee'], refusee: ['demandee'], annulee: ['demandee'] };
  function changerStatut(abs, statut, auj) {
    if (!(TRANSITIONS[abs.statut] || []).includes(statut)) return null;
    return { ...abs, statut, decideLe: statut === 'demandee' ? null : auj };
  }

  // ---------- Synthèse ----------
  function synthese(etat, auj, horizon = 60) {
    const fin = ajout(auj, horizon);
    const actifs = etat.salaries.filter((s) => actif(s, auj));
    const aujourdhui = etat.absences.filter((a) => a.statut === 'validee' && couvre(a, auj));
    const attente = etat.absences.filter((a) => a.statut === 'demandee').sort((x, y) => x.debut.localeCompare(y.debut));
    const aVenir = etat.absences.filter((a) => a.statut === 'validee' && a.debut > auj && a.debut <= fin).sort((x, y) => x.debut.localeCompare(y.debut));
    const alertes = chevauchements(etat, auj, fin);
    return { actifs, aujourdhui, attente, aVenir, alertes, plages: plagesAlerte(alertes, etat.reglages) };
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, mini, maxi, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const decimal = (v, mini, maxi, defaut) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(maxi, Math.max(mini, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);

  function normaliserType(x, i = 0, couleurs = []) {
    return {
      id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 40) || 'Absence',
      decompte: DECOMPTES.includes(x?.decompte) ? x.decompte : 'aucun',
      acquiert: ACQUIERT.includes(x?.acquiert) ? x.acquiert : 'oui',
      couleur: entier(x?.couleur, 0, couleurs.length ? couleurs.length - 1 : 6, i % 7),
      lettre: texte(x?.lettre, 2) || texte(x?.nom, 1).toUpperCase() || '?',
      demande: x?.demande !== false, sante: !!x?.sante,
    };
  }
  function normaliserSalarie(x) {
    return {
      id: texte(x?.id, 40) || nouvelId(), prenom: texte(x?.prenom, 40), nom: texte(x?.nom, 60), equipe: texte(x?.equipe, 40),
      entree: dateOuNull(x?.entree), sortie: dateOuNull(x?.sortie),
      rttAnnuel: decimal(x?.rttAnnuel, 0, 60, 0), reliquatCp: decimal(x?.reliquatCp, -60, 200, 0), reliquatRtt: decimal(x?.reliquatRtt, -60, 200, 0),
      ajustements: (Array.isArray(x?.ajustements) ? x.ajustements : []).map((a) => ({ id: texte(a?.id, 40) || nouvelId(), date: dateOuNull(a?.date) || '2026-01-01', compteur: a?.compteur === 'rtt' ? 'rtt' : 'cp', jours: decimal(a?.jours, -100, 100, 0), motif: texte(a?.motif, 120) })),
      efface: !!x?.efface,
    };
  }
  function normaliserAbsence(x) {
    const debut = dateOuNull(x?.debut) || dateOuNull(x?.fin) || '2026-01-01';
    let fin = dateOuNull(x?.fin) || debut;
    if (fin < debut) fin = debut;
    return {
      id: texte(x?.id, 40) || nouvelId(), salarie: texte(x?.salarie, 40), type: texte(x?.type, 40) || 'cp', debut, fin,
      demiDebut: !!x?.demiDebut, demiFin: !!x?.demiFin, statut: STATUTS.includes(x?.statut) ? x.statut : 'demandee',
      note: texte(x?.note, 160), demandeLe: dateOuNull(x?.demandeLe), decideLe: dateOuNull(x?.decideLe),
    };
  }
  function normaliserEquipe(x) { return { id: texte(x?.id, 40) || nouvelId(), nom: texte(x?.nom, 40) || 'Équipe', maxAbsents: entier(x?.maxAbsents, 0, 99, 1) }; }

  function normaliserReglages(r, dv) {
    r = r || {};
    const ac = r.acquisition || {};
    const jt = Array.isArray(r.joursTravailles) ? [...new Set(r.joursTravailles.map(Number).filter((n) => n >= 0 && n <= 6))].sort() : dv.joursTravailles;
    return {
      decompte: r.decompte === 'ouvres' ? 'ouvres' : r.decompte === 'ouvrables' ? 'ouvrables' : dv.decompte,
      moisDebut: [1, 4, 5, 6].includes(Number(r.moisDebut)) ? Number(r.moisDebut) : dv.moisDebut,
      debutSuivi: dateOuNull(r.debutSuivi) || dv.debutSuivi,
      joursTravailles: jt.length ? jt : dv.joursTravailles,
      acquisition: {
        mois: decimal(ac.mois, 0, 5, dv.acquisition.mois), plafond: decimal(ac.plafond, 0, 60, dv.acquisition.plafond),
        maladieMois: decimal(ac.maladieMois, 0, 5, dv.acquisition.maladieMois), maladiePlafond: decimal(ac.maladiePlafond, 0, 60, dv.acquisition.maladiePlafond),
      },
      arrondiSup: r.arrondiSup === undefined ? dv.arrondiSup : !!r.arrondiSup,
      feriesChomes: Array.isArray(r.feriesChomes) ? r.feriesChomes.filter((id) => NOM_FERIE[id]) : dv.feriesChomes,
      rttMode: r.rttMode === 'annuel' ? 'annuel' : 'prorata',
      verifieLe: dateOuNull(r.verifieLe) || dv.verifieLe,
    };
  }
  // « defauts » : { reglages, types, couleurs } tirés de la base intégrée (donnees.js).
  function etatVide(defauts = {}) {
    const dv = JSON.parse(JSON.stringify(defauts.reglages || {}));
    return {
      version: 1, entreprise: '',
      reglages: normaliserReglages(dv, { decompte: 'ouvrables', moisDebut: 6, debutSuivi: null, joursTravailles: [1, 2, 3, 4, 5], acquisition: { mois: 2.5, plafond: 30, maladieMois: 2, maladiePlafond: 24 }, arrondiSup: true, feriesChomes: FERIES.slice(0, 11).map((f) => f[0]), verifieLe: null, ...dv }),
      types: (defauts.types || []).map((t, i) => normaliserType(t, i, defauts.couleurs)),
      equipes: [], salaries: [], absences: [],
    };
  }
  function normaliser(d, defauts) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const types = Array.isArray(d.types) && d.types.length ? d.types.map((t, i) => normaliserType(t, i, defauts?.couleurs)) : v.types;
    return {
      ...v, ...d,
      entreprise: texte(d.entreprise, 80),
      reglages: normaliserReglages(d.reglages, v.reglages),
      types,
      equipes: (Array.isArray(d.equipes) ? d.equipes : []).map(normaliserEquipe),
      salaries: (Array.isArray(d.salaries) ? d.salaries : []).map(normaliserSalarie),
      absences: (Array.isArray(d.absences) ? d.absences : []).map(normaliserAbsence),
    };
  }

  // ---------- RGPD ----------
  // Effacement : prénom et nom remplacés, notes vidées ; les absences restent (dates et types, sans note)
  // pour garder des soldes et un calendrier justes. Suppression : salarié, absences et ajustements retirés.
  function effacerSalarie(etat, id, rang = 1) {
    const e = JSON.parse(JSON.stringify(etat));
    const s = e.salaries.find((x) => x.id === id);
    if (!s) return e;
    Object.assign(s, { prenom: 'Salarié', nom: `effacé ${rang}`, efface: true, ajustements: s.ajustements.map((a) => ({ ...a, motif: '' })) });
    e.absences.forEach((a) => { if (a.salarie === id) a.note = ''; });
    return e;
  }
  function supprimerSalarie(etat, id) {
    const e = JSON.parse(JSON.stringify(etat));
    e.salaries = e.salaries.filter((s) => s.id !== id);
    e.absences = e.absences.filter((a) => a.salarie !== id);
    return e;
  }
  // Données d'un salarié (droit d'accès) : sa fiche, ses absences et ses soldes à date.
  function donneesSalarie(etat, id, auj) {
    const s = etat.salaries.find((x) => x.id === id);
    if (!s) return null;
    const so = soldes(s, etat, auj);
    const eq = etat.equipes.find((x) => x.id === s.equipe);
    return {
      exporteLe: auj, salarie: { prenom: s.prenom, nom: s.nom, equipe: eq?.nom || '', entree: s.entree, sortie: s.sortie, rttAnnuel: s.rttAnnuel, ajustements: s.ajustements },
      absences: etat.absences.filter((a) => a.salarie === id).map((a) => ({ type: typeDe(etat.types, a.type)?.nom || a.type, debut: a.debut, fin: a.fin, demiDebut: a.demiDebut, demiFin: a.demiFin, statut: LIB_STATUT[a.statut], joursDecomptes: decompte(a, etat.types, etat.reglages), note: a.note })),
      soldes: { congesPayes: so.cp.solde, rtt: so.rtt.solde, unite: etat.reglages.decompte === 'ouvres' ? 'jours ouvrés' : 'jours ouvrables' },
    };
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (x) => String(arrondi2(x)).replace('.', ',');
  function versCsv(etat) {
    const tete = ['Prénom', 'Nom', 'Équipe', 'Type', 'Début', 'Fin', 'Demi-journée au début', 'Demi-journée à la fin', 'Jours décomptés', 'Statut', 'Demandée le', 'Décidée le', 'Note'];
    const lignes = [...etat.absences].sort((a, b) => a.debut.localeCompare(b.debut)).map((a) => {
      const s = etat.salaries.find((x) => x.id === a.salarie);
      const eq = etat.equipes.find((x) => x.id === s?.equipe);
      return [s?.prenom || '', s?.nom || '', eq?.nom || '', typeDe(etat.types, a.type)?.nom || a.type, a.debut, a.fin, a.demiDebut ? 'oui' : 'non', a.demiFin ? 'oui' : 'non', nombreCsv(decompte(a, etat.types, etat.reglages)), LIB_STATUT[a.statut], a.demandeLe || '', a.decideLe || '', a.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.CNG = {
    STATUTS, LIB_STATUT, OCCUPE, DECOMPTES, ACQUIERT, FERIES, NOM_FERIE, TRANSITIONS,
    iso, versDate, ajout, ecart, ajoutMois, joursDansMois, estDate, jourSemaine, arrondi2, nombre, lireNombre,
    paques, feries, ferieChome, estOuvre, estOuvrable,
    typeDe, uniteDe, finDecompte, decompte,
    periode, periodePrecedente, libellePeriode, acquisition, periodesJusqua, acquisRtt, soldes,
    actif, couvre, seChevauchent, conflitPersonnel, absentsLe, chevauchements, plagesAlerte, alertesDemande, changerStatut,
    synthese, nouvelId, normaliserType, normaliserSalarie, normaliserAbsence, normaliserEquipe, normaliserReglages, normaliser, etatVide,
    effacerSalarie, supprimerSalarie, donneesSalarie, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
