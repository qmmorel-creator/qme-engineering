// Suivi du temps passé et rentabilité par mission QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.TMP) et par les tests Node (vm).
// Dates « AAAA-MM-JJ » (comparables comme des chaînes), durées en minutes entières, montants en euros hors
// taxes. null quand une valeur manque ou qu'un calcul est impossible.
// Notions communes avec le Calculateur de TJM et le Coût de revient QME : TJM cible hors taxes, heures par
// jour, coût de revient horaire (prix plancher), taux horaire réel = montant facturé ÷ heures réellement passées.
(function (racine) {
  'use strict';

  const MODES = { forfait: 'Forfait', regie: 'Régie' };
  const UNITES = { jour: 'jours', heure: 'heures' };
  const STATUTS_MISSION = { 'en-cours': 'En cours', terminee: 'Terminée', archivee: 'Archivée' };
  const LIB_BUDGET = { 'sans-budget': 'Sans budget', ok: 'Dans le budget', vigilance: 'À surveiller', depasse: 'Budget dépassé' };
  const LIB_TAUX = { 'sans-temps': 'Pas encore de temps', 'sans-cible': 'Sans TJM cible', 'au-dessus': 'Cible atteinte', 'sous-cible': 'Sous la cible', 'sous-plancher': 'Sous le coût de revient' };
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const estDate = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j, 12); };
  const ajoutJours = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecartJours = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  // Rang du jour dans la semaine : 0 = lundi … 6 = dimanche.
  const rangJour = (s) => (versDate(s).getDay() + 6) % 7;
  const lundi = (s) => ajoutJours(s, -rangJour(s));
  const joursSemaine = (l) => Array.from({ length: 7 }, (_, i) => ajoutJours(l, i));
  const debutMois = (s) => `${s.slice(0, 7)}-01`;
  const finMois = (s) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m, 0, 12)); };
  const ajoutMois = (s, n) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m - 1 + n, 1, 12)); };
  const libDate = (s, { annee = true, jour = false } = {}) => {
    const d = versDate(s);
    return `${jour ? JOURS[rangJour(s)] + ' ' : ''}${d.getDate()} ${MOIS[d.getMonth()]}${annee ? ' ' + d.getFullYear() : ''}`;
  };
  const libMois = (s) => { const [a, m] = s.split('-').map(Number); return `${MOIS[m - 1]} ${a}`; };

  // ---------- Nombres et durées ----------
  const fini = (v) => typeof v === 'number' && Number.isFinite(v);
  const arrondi = (v, d = 2) => (fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
  const borne = (v, min, max) => Math.min(max, Math.max(min, v));
  // « 1 200,50 », « 1200.5 », « 1 200 € » → 1200.5 ; null si vide ou illisible.
  function lireNombre(texte) {
    if (fini(texte)) return texte;
    let s = String(texte ?? '').replace(/[\s  €%]/g, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  // Durée saisie → minutes entières. « 1h30 », « 1 h 30 », « 1:30 », « 1,5 », « 1.5h », « 90 min », « 45m »,
  // « 2 » (heures). null si vide, illisible, nulle ou au-delà de 24 h.
  function lireDuree(texte) {
    const s = String(texte ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/heures?$/, 'h');
    if (!s) return null;
    let min = null, m;
    if ((m = s.match(/^(\d{1,2})(?:h|:)(\d{1,2})(?:min|mn|m)?$/))) { if (Number(m[2]) < 60) min = Number(m[1]) * 60 + Number(m[2]); }
    else if ((m = s.match(/^(\d{1,4})(?:min|mn|m)$/))) min = Number(m[1]);
    else if ((m = s.match(/^(\d{1,2}(?:[.,]\d+)?)h?$/))) min = Math.round(Number(m[1].replace(',', '.')) * 60);
    return min !== null && min > 0 && min <= 24 * 60 ? min : null;
  }
  // 90 → « 1 h 30 », 45 → « 45 min », 120 → « 2 h », 0 → « 0 h ».
  function duree(min) {
    if (!fini(min)) return '–';
    const n = Math.round(Math.abs(min)), signe = min < 0 ? '− ' : '';
    const h = Math.floor(n / 60), r = n % 60;
    if (!h) return `${signe}${r ? `${r} min` : '0 h'}`;
    return `${signe}${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  const heures = (min) => (fini(min) ? min / 60 : null);
  const nombre = (v, d = 0) => (fini(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const euros = (v, d = 0) => (fini(v) ? `${nombre(v, d)} €` : '–');
  const pct = (v, d = 0) => (fini(v) ? `${nombre(v * 100, d)} %` : '–');
  // Arrondi d'une durée de chronomètre au pas le plus proche (au moins un pas). pas = 0 : à la minute.
  function arrondirDuree(min, pas = 0) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    if (!pas) return Math.max(1, m);
    return Math.max(pas, Math.round(m / pas) * pas);
  }
  // Minutes écoulées depuis le début du chronomètre (horodatage en millisecondes).
  const minutesChrono = (chrono, maintenant) => (chrono && fini(chrono.debut) ? Math.max(0, Math.floor((maintenant - chrono.debut) / 60000)) : 0);

  // ---------- Accès ----------
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const mission = (E, id) => E.missions.find((m) => m.id === id) || null;
  const tache = (m, id) => (m ? m.taches.find((t) => t.id === id) || null : null);
  const heuresJour = (E) => (fini(E.heuresJour) && E.heuresJour > 0 ? E.heuresJour : 7);
  const dansPeriode = (date, p = {}) => (!p.du || date >= p.du) && (!p.au || date <= p.au);
  const entreesDe = (E, p = {}, filtre = () => true) => E.entrees.filter((e) => dansPeriode(e.date, p) && filtre(e));
  const somme = (liste, f = (e) => e.minutes) => liste.reduce((t, e) => t + (f(e) || 0), 0);

  // ---------- Références de taux ----------
  // Taux horaire cible = TJM cible ÷ heures par jour.
  const tauxCible = (E) => (fini(E.tjm) && E.tjm > 0 ? E.tjm / heuresJour(E) : null);
  const plancher = (E) => (fini(E.coutHeure) && E.coutHeure > 0 ? E.coutHeure : null);
  // Taux horaire d'une mission en régie (taux saisi par jour ou par heure).
  const tauxMission = (m, hj) => (fini(m.taux) && m.taux > 0 ? (m.uniteTaux === 'heure' ? m.taux : m.taux / hj) : null);
  // Budget en minutes (jours × heures par jour, ou heures).
  const budgetMinutes = (m, hj) => (fini(m.budget) && m.budget > 0 ? Math.round(m.budget * (m.uniteBudget === 'heure' ? 1 : hj) * 60) : null);
  // Taux horaire prévu au devis (forfait) : montant ÷ budget en heures.
  const tauxDevis = (m, hj) => { const b = budgetMinutes(m, hj); return m.mode === 'forfait' && fini(m.montant) && m.montant > 0 && b ? m.montant / (b / 60) : null; };

  function statutTaux(taux, E, minutes) {
    if (!minutes) return 'sans-temps';
    const c = tauxCible(E), p = plancher(E);
    if (p !== null && fini(taux) && taux < p) return 'sous-plancher';
    if (c === null) return 'sans-cible';
    return fini(taux) && taux >= c - 1e-9 ? 'au-dessus' : 'sous-cible';
  }

  // ---------- Bilan d'une mission ----------
  // Forfait : valeur = montant ; consommation = tout le temps passé ÷ budget.
  // Régie : valeur = heures facturables × taux ; consommation = temps facturable ÷ budget (bon de commande).
  // Taux effectif = valeur ÷ temps total passé (facturable ou non). TJM équivalent = taux × heures par jour.
  // Estimation à terminaison = temps consommé ÷ avancement (si avancement saisi entre 1 et 100 %).
  function bilanMission(E, m, p = {}) {
    const hj = heuresJour(E);
    const liste = entreesDe(E, p, (e) => e.mission === m.id);
    const total = somme(liste);
    const fact = somme(liste.filter((e) => e.facturable));
    const nonFact = total - fact;
    const th = tauxMission(m, hj);
    const valeur = m.mode === 'regie' ? (th === null ? null : (fact / 60) * th) : (fini(m.montant) && m.montant > 0 ? m.montant : null);
    const taux = valeur !== null && total > 0 ? valeur / (total / 60) : null;
    const budget = budgetMinutes(m, hj);
    const consomme = m.mode === 'regie' ? fact : total;
    const conso = budget ? consomme / budget : null;
    const av = fini(m.avancement) ? borne(m.avancement, 0, 100) / 100 : null;
    const estimation = av && av > 0 ? Math.round(consomme / av) : (m.statut === 'terminee' ? consomme : null);
    const depassementPrevu = estimation !== null && budget ? estimation - budget : null;
    // Taux effectif projeté en fin de mission (forfait : montant ÷ max(estimation, temps passé)).
    const tauxFin = m.mode === 'forfait' && valeur !== null && estimation ? valeur / (Math.max(estimation, total) / 60) : taux;
    const devis = tauxDevis(m, hj);
    const restant = budget ? budget - consomme : null;
    const alertes = [];
    let statutBudget = 'sans-budget';
    if (budget) {
      const seuil = (fini(E.seuilVigilance) ? E.seuilVigilance : 80) / 100;
      const derive = (fini(E.derive) ? E.derive : 15) / 100;
      statutBudget = conso > 1 + 1e-9 ? 'depasse' : conso >= seuil - 1e-9 ? 'vigilance' : 'ok';
      if (statutBudget === 'depasse') alertes.push({ code: 'depasse', niveau: 'depasse' });
      else if (statutBudget === 'vigilance') alertes.push({ code: 'vigilance', niveau: 'vigilance' });
      if (m.statut !== 'terminee' && av !== null && conso - av > derive + 1e-9 && statutBudget !== 'depasse') {
        alertes.push({ code: 'derive', niveau: 'vigilance' });
        if (statutBudget === 'ok') statutBudget = 'vigilance';
      }
      if (m.statut !== 'terminee' && depassementPrevu !== null && depassementPrevu > 0 && statutBudget !== 'depasse') {
        alertes.push({ code: 'prevu', niveau: 'vigilance' });
        if (statutBudget === 'ok') statutBudget = 'vigilance';
      }
    }
    const st = statutTaux(m.mode === 'forfait' ? tauxFin : taux, E, total);
    return {
      m, minutes: total, facturable: fact, nonFacturable: nonFact, consomme, budget, conso, restant, avancement: av,
      estimation, depassementPrevu, valeur, taux, tjmEquivalent: taux === null ? null : taux * hj, tauxFin, devis,
      ecartCible: taux !== null && tauxCible(E) !== null ? taux - tauxCible(E) : null,
      statutBudget, statutTaux: st, alertes, nbEntrees: liste.length,
      derniere: liste.reduce((d, e) => (e.date > d ? e.date : d), ''),
    };
  }

  // Temps par tâche d'une mission (tâches de la mission, puis « Sans tâche »), avec budget de tâche éventuel.
  function tempsParTache(E, m, p = {}) {
    const liste = entreesDe(E, p, (e) => e.mission === m.id);
    const lignes = m.taches.map((t) => {
      const l = liste.filter((e) => e.tache === t.id);
      const budget = fini(t.budgetH) && t.budgetH > 0 ? Math.round(t.budgetH * 60) : null;
      return { t, minutes: somme(l), facturable: somme(l.filter((e) => e.facturable)), budget, conso: budget ? somme(l) / budget : null };
    });
    const sans = liste.filter((e) => !tache(m, e.tache));
    if (sans.length) lignes.push({ t: { id: '', nom: 'Sans tâche' }, minutes: somme(sans), facturable: somme(sans.filter((e) => e.facturable)), budget: null, conso: null });
    return lignes;
  }

  // Missions à signaler : alerte de budget, en commençant par les dépassements.
  function alertesMissions(E) {
    const ordre = { depasse: 0, vigilance: 1 };
    return E.missions.filter((m) => m.statut === 'en-cours')
      .map((m) => bilanMission(E, m))
      .filter((b) => b.alertes.length)
      .sort((a, b) => ordre[a.alertes[0].niveau] - ordre[b.alertes[0].niveau] || (b.conso || 0) - (a.conso || 0));
  }

  // ---------- Périodes ----------
  // Heures prévues par la semaine type entre deux dates incluses.
  function prevuPeriode(E, du, au) {
    let t = 0;
    for (let d = du; d <= au; d = ajoutJours(d, 1)) t += (E.semaineType[rangJour(d)] || 0) * 60;
    return Math.round(t);
  }

  // Valeur produite d'une entrée : régie, temps facturable × taux ; forfait, part du montant au prorata du
  // temps, rapportée au plus grand du budget et du temps total passé sur la mission (jamais plus que le montant).
  function valeurEntrees(E, liste) {
    const hj = heuresJour(E);
    const totaux = new Map();
    let v = 0;
    for (const e of liste) {
      const m = mission(E, e.mission);
      if (!m) continue;
      if (m.mode === 'regie') { const th = tauxMission(m, hj); if (th !== null && e.facturable) v += (e.minutes / 60) * th; continue; }
      if (!fini(m.montant) || m.montant <= 0) continue;
      if (!totaux.has(m.id)) totaux.set(m.id, Math.max(budgetMinutes(m, hj) || 0, somme(E.entrees.filter((x) => x.mission === m.id))));
      const base = totaux.get(m.id);
      if (base > 0) v += m.montant * (e.minutes / base);
    }
    return v;
  }

  // Synthèse d'une période { du, au } : temps, facturable, valeur, taux réel, catégories, missions, prévu.
  function synthesePeriode(E, p) {
    const liste = entreesDe(E, p);
    const total = somme(liste);
    const fact = somme(liste.filter((e) => e.facturable));
    const valeur = valeurEntrees(E, liste);
    const taux = total > 0 ? valeur / (total / 60) : null;
    const parCat = new Map();
    for (const e of liste.filter((x) => !x.facturable)) parCat.set(e.categorie || 'autre', (parCat.get(e.categorie || 'autre') || 0) + e.minutes);
    const parMission = new Map();
    for (const e of liste) parMission.set(e.mission || '', (parMission.get(e.mission || '') || 0) + e.minutes);
    const prevu = p.du && p.au ? prevuPeriode(E, p.du, p.au) : null;
    const objectif = (fini(E.objectifFacturable) ? E.objectifFacturable : 70) / 100;
    return {
      minutes: total, facturable: fact, nonFacturable: total - fact, partFacturable: total > 0 ? fact / total : null, objectif,
      valeur, taux, tjmEquivalent: taux === null ? null : taux * heuresJour(E), statutTaux: statutTaux(taux, E, total),
      nonFactParCategorie: [...parCat].map(([categorie, minutes]) => ({ categorie, minutes })).sort((a, b) => b.minutes - a.minutes),
      parMission: [...parMission].map(([id, minutes]) => ({ mission: id, minutes })).sort((a, b) => b.minutes - a.minutes),
      prevu, ecartPrevu: prevu === null ? null : total - prevu, nbEntrees: liste.length,
    };
  }

  // Bornes d'une période nommée, relative à une date de référence (aujourd'hui).
  function periode(nom, ref) {
    switch (nom) {
      case 'semaine': return { du: lundi(ref), au: ajoutJours(lundi(ref), 6) };
      case 'mois-precedent': { const d = ajoutMois(ref, -1); return { du: debutMois(d), au: finMois(d) }; }
      case 'trimestre': return { du: debutMois(ajoutMois(ref, -2)), au: finMois(ref) };
      case 'annee': return { du: `${ref.slice(0, 4)}-01-01`, au: `${ref.slice(0, 4)}-12-31` };
      case 'tout': return {};
      default: return { du: debutMois(ref), au: finMois(ref) };
    }
  }

  // Feuille de temps d'une semaine : une ligne par mission (ou catégorie hors mission), 7 colonnes.
  function feuilleSemaine(E, l) {
    const jours = joursSemaine(l);
    const liste = entreesDe(E, { du: jours[0], au: jours[6] });
    const lignes = new Map();
    for (const e of liste) {
      const cle = e.mission ? `m:${e.mission}` : `c:${e.categorie}`;
      if (!lignes.has(cle)) lignes.set(cle, { cle, mission: e.mission || null, categorie: e.mission ? null : e.categorie, jours: Array(7).fill(0), facturable: 0, total: 0 });
      const ligne = lignes.get(cle);
      ligne.jours[rangJour(e.date)] += e.minutes;
      ligne.total += e.minutes;
      if (e.facturable) ligne.facturable += e.minutes;
    }
    const totaux = Array(7).fill(0), facturables = Array(7).fill(0);
    for (const e of liste) { totaux[rangJour(e.date)] += e.minutes; if (e.facturable) facturables[rangJour(e.date)] += e.minutes; }
    const prevus = E.semaineType.map((h) => Math.round((h || 0) * 60));
    const total = totaux.reduce((a, b) => a + b, 0);
    const fact = facturables.reduce((a, b) => a + b, 0);
    return {
      jours, lignes: [...lignes.values()].sort((a, b) => (a.mission ? 0 : 1) - (b.mission ? 0 : 1) || b.total - a.total),
      totaux, facturables, prevus, total, facturable: fact, prevu: prevus.reduce((a, b) => a + b, 0), partFacturable: total ? fact / total : null,
    };
  }

  // Les n dernières semaines (de la plus ancienne à la plus récente) : temps, facturable, prévu.
  function dernieresSemaines(E, ref, n = 8) {
    const l0 = lundi(ref);
    return Array.from({ length: n }, (_, i) => {
      const l = ajoutJours(l0, (i - n + 1) * 7);
      const liste = entreesDe(E, { du: l, au: ajoutJours(l, 6) });
      return { lundi: l, minutes: somme(liste), facturable: somme(liste.filter((e) => e.facturable)), prevu: prevuPeriode(E, l, ajoutJours(l, 6)) };
    });
  }

  // ---------- Rapport client ----------
  // cible : { client } (toutes ses missions) ou { mission } ; options : facturableSeul.
  function rapport(E, { client = '', mission: idMission = '', du = '', au = '', facturableSeul = true } = {}) {
    const missions = E.missions.filter((m) => (idMission ? m.id === idMission : client ? m.client === client : false));
    const ids = new Set(missions.map((m) => m.id));
    const p = { du: du || null, au: au || null };
    const liste = entreesDe(E, p, (e) => ids.has(e.mission) && (!facturableSeul || e.facturable)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const hj = heuresJour(E);
    const blocs = missions.map((m) => {
      const l = liste.filter((e) => e.mission === m.id);
      const parTache = new Map();
      for (const e of l) { const nom = tache(m, e.tache)?.nom || 'Sans tâche'; parTache.set(nom, (parTache.get(nom) || 0) + e.minutes); }
      const b = bilanMission(E, m);
      return { m, entrees: l, minutes: somme(l), parTache: [...parTache].map(([nom, minutes]) => ({ nom, minutes })), budget: b.budget, consomme: b.consomme, conso: b.conso, valeur: m.mode === 'regie' ? (tauxMission(m, hj) === null ? null : somme(l.filter((e) => e.facturable)) / 60 * tauxMission(m, hj)) : null };
    }).filter((b) => b.entrees.length || idMission);
    const total = somme(liste);
    return { blocs, minutes: total, jours: total / 60 / hj, du: p.du, au: p.au };
  }

  // ---------- Exports CSV (point-virgule, BOM pour les tableurs) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nbCsv = (v, d = 2) => (fini(v) ? String(arrondi(v, d)).replace('.', ',') : '');
  function versCsvEntrees(E, p = {}, categories = []) {
    const nomCat = (id) => categories.find((c) => c.id === id)?.nom || id || '';
    const l = entreesDe(E, p).sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
      const m = mission(E, e.mission);
      return [e.date, m?.client || '', m?.nom || '(hors mission)', tache(m, e.tache)?.nom || '', nomCat(e.categorie), e.facturable ? 'oui' : 'non', nbCsv(e.minutes / 60, 2), e.minutes, e.note || ''];
    });
    return csv([['Date', 'Client', 'Mission', 'Tâche', 'Catégorie', 'Facturable', 'Durée (h)', 'Durée (min)', 'Note'], ...l]);
  }
  function versCsvRapport(E, r) {
    const l = [];
    for (const b of r.blocs) for (const e of b.entrees) l.push([e.date, b.m.client, b.m.nom, tache(b.m, e.tache)?.nom || '', nbCsv(e.minutes / 60, 2), e.facturable ? 'oui' : 'non', e.note || '']);
    return csv([['Date', 'Client', 'Mission', 'Tâche', 'Durée (h)', 'Facturable', 'Détail'], ...l, ['Total', '', '', '', nbCsv(r.minutes / 60, 2), '', '']]);
  }

  // ---------- État ----------
  function etatVide() {
    return { version: 1, activite: '', tjm: null, heuresJour: 7, coutHeure: null, seuilVigilance: 80, derive: 15, objectifFacturable: 70, arrondi: 0, semaineType: [7, 7, 7, 7, 7, 0, 0], missions: [], entrees: [], chrono: null };
  }
  const nombreOu = (v, defaut, min = -Infinity, max = Infinity) => { const n = lireNombre(v); return n === null ? defaut : borne(n, min, max); };
  const positifOuNull = (v) => { const n = lireNombre(v); return n !== null && n > 0 ? n : null; };
  function normaliserMission(m, i = 0) {
    const x = m && typeof m === 'object' ? m : {};
    return {
      id: String(x.id || nouvelId()), nom: String(x.nom || 'Mission').slice(0, 120), client: String(x.client || '').slice(0, 80),
      mode: x.mode === 'regie' ? 'regie' : 'forfait', montant: positifOuNull(x.montant), taux: positifOuNull(x.taux), uniteTaux: x.uniteTaux === 'heure' ? 'heure' : 'jour',
      budget: positifOuNull(x.budget), uniteBudget: x.uniteBudget === 'heure' ? 'heure' : 'jour',
      avancement: lireNombre(x.avancement) === null ? null : borne(lireNombre(x.avancement), 0, 100),
      statut: STATUTS_MISSION[x.statut] ? x.statut : 'en-cours', couleur: Number.isInteger(x.couleur) ? x.couleur : i,
      debut: estDate(x.debut) ? x.debut : '', fin: estDate(x.fin) ? x.fin : '', note: String(x.note || '').slice(0, 1000),
      taches: (Array.isArray(x.taches) ? x.taches : []).filter((t) => t && t.nom).map((t) => ({ id: String(t.id || nouvelId()), nom: String(t.nom).slice(0, 80), categorie: String(t.categorie || 'realisation'), budgetH: positifOuNull(t.budgetH) })),
    };
  }
  function normaliserEntree(e) {
    if (!e || !estDate(e.date)) return null;
    const minutes = Math.round(Number(e.minutes));
    if (!(minutes > 0)) return null;
    return { id: String(e.id || nouvelId()), date: e.date, mission: e.mission ? String(e.mission) : null, tache: e.tache ? String(e.tache) : null, categorie: String(e.categorie || 'realisation'), minutes: Math.min(minutes, 24 * 60), facturable: e.facturable !== false, note: String(e.note || '').slice(0, 300) };
  }
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.activite = String(d.activite || '').slice(0, 80);
    e.tjm = positifOuNull(d.tjm);
    e.heuresJour = nombreOu(d.heuresJour, 7, 1, 24);
    e.coutHeure = positifOuNull(d.coutHeure);
    e.seuilVigilance = nombreOu(d.seuilVigilance, 80, 10, 100);
    e.derive = nombreOu(d.derive, 15, 0, 100);
    e.objectifFacturable = nombreOu(d.objectifFacturable, 70, 0, 100);
    e.arrondi = [0, 5, 10, 15, 30].includes(Number(d.arrondi)) ? Number(d.arrondi) : 0;
    if (Array.isArray(d.semaineType) && d.semaineType.length === 7) e.semaineType = d.semaineType.map((h) => nombreOu(h, 0, 0, 24));
    e.missions = (Array.isArray(d.missions) ? d.missions : []).map(normaliserMission);
    const ids = new Set(e.missions.map((m) => m.id));
    e.entrees = (Array.isArray(d.entrees) ? d.entrees : []).map(normaliserEntree).filter(Boolean).map((x) => (x.mission && !ids.has(x.mission) ? { ...x, mission: null, tache: null } : x));
    e.chrono = d.chrono && fini(Number(d.chrono.debut)) ? { debut: Number(d.chrono.debut), mission: d.chrono.mission && ids.has(d.chrono.mission) ? d.chrono.mission : null, tache: d.chrono.tache || null, categorie: String(d.chrono.categorie || 'realisation'), facturable: d.chrono.facturable !== false, note: String(d.chrono.note || '').slice(0, 300) } : null;
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // Entrée créée à l'arrêt du chronomètre (null si moins d'une minute et sans arrondi).
  function entreeDepuisChrono(E, maintenant, date) {
    const c = E.chrono;
    if (!c) return null;
    const brut = minutesChrono(c, maintenant);
    if (brut < 1 && !E.arrondi) return null;
    return normaliserEntree({ id: nouvelId(), date, mission: c.mission, tache: c.tache, categorie: c.categorie, minutes: arrondirDuree(brut, E.arrondi), facturable: c.facturable, note: c.note });
  }

  racine.TMP = {
    MODES, UNITES, STATUTS_MISSION, LIB_BUDGET, LIB_TAUX, JOURS, JOURS_COURTS, MOIS,
    iso, estDate, versDate, ajoutJours, ecartJours, rangJour, lundi, joursSemaine, debutMois, finMois, ajoutMois, libDate, libMois,
    fini, arrondi, lireNombre, lireDuree, duree, heures, nombre, euros, pct, arrondirDuree, minutesChrono,
    nouvelId, mission, tache, heuresJour, entreesDe, somme,
    tauxCible, plancher, tauxMission, budgetMinutes, tauxDevis, statutTaux,
    bilanMission, tempsParTache, alertesMissions, prevuPeriode, valeurEntrees, synthesePeriode, periode, feuilleSemaine, dernieresSemaines,
    rapport, versCsvEntrees, versCsvRapport, etatVide, normaliser, normaliserMission, normaliserEntree, entreeDepuisChrono,
  };
})(typeof window !== 'undefined' ? window : globalThis);
