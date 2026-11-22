// Maintenance préventive QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.GMA) et par les tests Node (vm).
// Option « plusieurs sites » (fusion du Pilotage de parcs multi-sites, 22/11/2026) : sites, équipements rangés
// par site, visites, état des équipements (à l'arrêt, dégradé), disponibilité, alertes, bilan par site, carte
// schématique, import et export CSV, conversion d'une copie exportée de l'ancien outil.
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Montants en centimes HT. Compteurs en
// nombres (heures, cycles, km, unités). Moteur d'échéances commun avec la gestion de flotte (date,
// compteur, premier atteint) et l'entretien de la maison (ajout de mois borné à la fin du mois).
(function (racine) {
  'use strict';

  const STATUTS_BON = { planifie: 'Planifié', encours: 'En cours', fait: 'Fait', annule: 'Annulé' };
  const TYPES_BON = { preventif: 'Préventif', correctif: 'Correctif' };
  const ETATS = ['retard', 'bientot', 'bon', 'avenir', 'plustard', 'parametrer', 'suspendu'];
  const LIB_ETAT = { retard: 'En retard', bientot: 'Bientôt', bon: 'Bon ouvert', avenir: 'À venir', plustard: 'Plus tard', parametrer: 'À paramétrer', suspendu: 'Suspendue' };
  const HORIZON = 90; // jours : « à venir »
  const UNITES_P = { j: ['jour', 'jours'], s: ['semaine', 'semaines'], m: ['mois', 'mois'], a: ['an', 'ans'] };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois ; le 31 janvier + 1 mois donne le 28 (ou 29) février, jamais le 3 mars.
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12;
    return iso(new Date(an, mo, Math.min(j, new Date(an, mo + 1, 0).getDate())));
  }
  const periodeValide = (p) => Array.isArray(p) && p[0] > 0 && Number.isFinite(Number(p[0])) && UNITES_P[p[1]];
  function ajoutPeriode(s, p, fois = 1) {
    const n = Number(p[0]) * fois;
    if (p[1] === 'j') return ajout(s, n);
    if (p[1] === 's') return ajout(s, 7 * n);
    if (p[1] === 'm') return ajoutMois(s, n);
    return ajoutMois(s, 12 * n);
  }
  function libellePeriode(p) {
    if (!periodeValide(p)) return '';
    const [n, u] = p;
    if (n === 1) return { j: 'Tous les jours', s: 'Toutes les semaines', m: 'Tous les mois', a: 'Tous les ans' }[u];
    if (u === 'm' && n % 12 === 0) return `Tous les ${n / 12} ans`;
    return `${u === 's' ? 'Toutes' : 'Tous'} les ${n} ${UNITES_P[u][1]}`;
  }

  // ---------- Nombres et montants ----------
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function nombre(v, dec = 2) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '–';
    const r = Math.round(Number(v) * 10 ** dec) / 10 ** dec;
    const [e, f] = String(Math.abs(r)).split('.');
    return `${r < 0 ? '−' : ''}${milliers(e)}${f ? `,${f}` : ''}`;
  }
  function euros(c, { centimes = true } = {}) {
    if (c === null || c === undefined || !Number.isFinite(c)) return '–';
    const neg = c < 0, e = Math.abs(c) / 100;
    if (!centimes) return `${neg ? '−' : ''}${milliers(Math.round(e))} €`;
    const [ent, fr] = e.toFixed(2).split('.');
    return `${neg ? '−' : ''}${milliers(ent)},${fr} €`;
  }
  // « 1 234,56 € » → centimes ; vide → null ; illisible ou négatif → NaN.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(Number(s) * 100);
  }
  // Nombre positif décimal (compteur, durée, quantité) ; vide → null ; illisible → NaN.
  function lireNombre(saisie, { signe = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-');
    if (!s) return null;
    if (!(signe ? /^[-+]?\d+(\.\d{1,3})?$/ : /^\+?\d+(\.\d{1,3})?$/).test(s)) return NaN;
    return Math.round(Number(s) * 1000) / 1000;
  }
  const saisieMontant = (c) => (c === null || c === undefined || !Number.isFinite(c) ? '' : (c / 100).toFixed(2).replace('.', ','));
  const saisieNombre = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(v).replace('.', ','));
  const pct = (t) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${Math.round(t)} %`);
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let compteurId = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteurId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Compteurs ----------
  // Points connus (date, valeur) d'un équipement : mise en service, relevés, compteurs notés à la clôture.
  function pointsCompteur(etat, eq) {
    if (!eq.unite) return [];
    const p = [];
    if (estDate(eq.miseEnService) && Number.isFinite(eq.compteurInitial)) p.push({ date: eq.miseEnService, valeur: eq.compteurInitial, source: 'initial' });
    for (const r of etat.releves) if (r.equipement === eq.id) p.push({ date: r.date, valeur: r.valeur, source: 'releve', id: r.id });
    for (const i of etat.interventions) if (i.equipement === eq.id && i.statut === 'fait' && Number.isFinite(i.compteur) && estDate(i.dateRealisee)) p.push({ date: i.dateRealisee, valeur: i.compteur, source: 'bon', id: i.id });
    return p.filter((x) => estDate(x.date) && Number.isFinite(x.valeur)).sort((a, b) => a.date.localeCompare(b.date) || a.valeur - b.valeur);
  }
  const compteurActuel = (points, auj) => points.filter((p) => !auj || p.date <= auj).reduce((m, p) => Math.max(m, p.valeur), points.length ? 0 : null);
  const dernierReleve = (points) => points.reduce((m, p) => (!m || p.date > m ? p.date : m), null);
  // Rythme d'utilisation en unités par jour, sur la fenêtre, à défaut sur tout l'historique ; null si inconnu.
  function rythme(points, auj, fenetre = 90) {
    const dans = points.filter((p) => p.date <= auj);
    let l = dans.filter((p) => p.date >= ajout(auj, -fenetre));
    if (new Set(l.map((p) => p.date)).size < 2) l = dans;
    if (l.length < 2) return null;
    const a = l[0], b = l.reduce((m, p) => (p.date > m.date || (p.date === m.date && p.valeur > m.valeur) ? p : m), l[0]);
    const j = ecart(a.date, b.date);
    if (j < 1 || b.valeur < a.valeur) return null;
    return (b.valeur - a.valeur) / j;
  }
  // Un relevé doit rester cohérent avec les relevés antérieurs et postérieurs. Renvoie un message ou null.
  function verifierReleve(points, date, valeur, ignorerId = null) {
    if (!estDate(date)) return 'Date invalide.';
    if (!Number.isFinite(valeur) || valeur < 0) return 'Valeur du compteur invalide.';
    const autres = points.filter((p) => !ignorerId || p.id !== ignorerId);
    const avant = autres.filter((p) => p.date <= date && p.valeur > valeur).sort((a, b) => b.valeur - a.valeur)[0];
    if (avant) return `Incohérent : ${nombre(avant.valeur)} relevé le ${dateFr(avant.date)}${avant.date === date ? '' : ', avant cette date'}.`;
    const apres = autres.filter((p) => p.date > date && p.valeur < valeur).sort((a, b) => a.valeur - b.valeur)[0];
    if (apres) return `Incohérent : seulement ${nombre(apres.valeur)} relevé le ${dateFr(apres.date)}, après cette date.`;
    return null;
  }

  // ---------- Plans de maintenance ----------
  // Opérations proposées depuis le plan type d'une famille (copies modifiables).
  function planDepuisFamille(base, familleId, { equipement, depuis, depuisCompteur = null, codes = null, id = nouvelId } = {}) {
    const f = base.familles.find((x) => x.id === familleId);
    if (!f) return [];
    return f.plan.filter((o) => !codes || codes.includes(o.code)).map((o) => normaliserOperation({
      id: id(), equipement, code: o.code, nom: o.nom, nature: o.nature, p: o.p, c: f.compteur ? o.c : null, d: o.d, qui: o.qui,
      regle: o.regle || '', points: o.points, depuis, depuisCompteur, recalage: o.nature === 'reglementaire' ? 'fixe' : 'glissant',
    }));
  }

  const bonsDe = (etat, opId) => etat.interventions.filter((i) => i.operation === opId);
  function derniereRealisation(etat, opId) {
    return bonsDe(etat, opId).filter((i) => i.statut === 'fait' && estDate(i.dateRealisee))
      .sort((a, b) => b.dateRealisee.localeCompare(a.dateRealisee))[0] || null;
  }
  const bonOuvert = (etat, opId) => bonsDe(etat, opId).filter((i) => i.statut === 'planifie' || i.statut === 'encours')
    .sort((a, b) => (a.datePrevue || '').localeCompare(b.datePrevue || ''))[0] || null;

  // Échéance d'une opération. reglages : { alerteJours, alerteCompteurPct }.
  //  Référence : dernière réalisation ; sinon date et compteur de départ de l'opération.
  //  Alerte : réglages, bornée au quart de la période.
  //  Recalage « fixe » : la date suivante part de l'échéance visée par le bon (calendrier tenu),
  //  « glissant » : de la date de réalisation. Le compteur part toujours du compteur relevé à la clôture.
  function echeance(etat, op, auj, eq = etat.equipements.find((e) => e.id === op.equipement)) {
    const rg = etat.reglages;
    const pts = eq ? pointsCompteur(etat, eq) : [];
    const cpt = compteurActuel(pts, auj);
    const ry = eq && eq.unite ? rythme(pts, auj) : null;
    const der = derniereRealisation(etat, op.id);
    let refDate = op.depuis || eq?.miseEnService || null;
    let refCompteur = Number.isFinite(op.depuisCompteur) ? op.depuisCompteur : (Number.isFinite(eq?.compteurInitial) ? eq.compteurInitial : 0);
    if (der) {
      refDate = op.recalage === 'fixe' && estDate(der.echeanceDate) ? der.echeanceDate : der.dateRealisee;
      if (Number.isFinite(der.compteur)) refCompteur = der.compteur;
    }
    const avecDate = periodeValide(op.p) && estDate(refDate);
    const avecCompteur = !!(eq && eq.unite && op.c > 0);
    let echDate = avecDate ? ajoutPeriode(refDate, op.p) : null;
    // Calendrier fixe : après un long oubli, l'échéance reste la plus ancienne non faite (jamais sautée).
    const echCompteur = avecCompteur ? refCompteur + op.c : null;
    const reste = avecCompteur && cpt !== null ? echCompteur - cpt : null;
    const joursRestants = echDate ? ecart(auj, echDate) : null;
    const dateEstimee = reste === null ? null : reste <= 0 ? auj : ry > 0 ? ajout(auj, Math.ceil(reste / ry)) : null;
    const prevue = [echDate, dateEstimee].filter(Boolean).sort()[0] || null;
    const bon = bonOuvert(etat, op.id);
    // Alerte « bientôt » : le délai des réglages, sans dépasser le quart de la période (une opération
    // hebdomadaire n'est pas « bientôt » en permanence).
    const alerte = avecDate ? Math.min(rg.alerteJours, Math.ceil(ecart(refDate, echDate) / 4)) : rg.alerteJours;
    let e;
    if (!op.actif || !eq || eq.archive) e = 'suspendu';
    else if (!avecDate && !avecCompteur) e = 'parametrer';
    else if ((reste !== null && reste <= 0) || (joursRestants !== null && joursRestants < 0)) e = 'retard';
    else if ((joursRestants !== null && joursRestants <= alerte)
      || (reste !== null && reste <= op.c * rg.alerteCompteurPct / 100)
      || (dateEstimee && ecart(auj, dateEstimee) <= alerte)) e = 'bientot';
    else if (prevue && ecart(auj, prevue) <= HORIZON) e = 'avenir';
    else e = 'plustard';
    const urgence = e;
    if (bon && e !== 'suspendu') e = 'bon';
    const mode = avecDate && avecCompteur ? 'premier' : avecDate ? 'date' : avecCompteur ? 'compteur' : 'aucun';
    return { op, eq, derniere: der, refDate, refCompteur, echDate, echCompteur, compteur: cpt, reste, joursRestants, rythme: ry, dateEstimee, prevue, etat: e, urgence, bon, mode };
  }

  // Toutes les échéances, triées : état puis date prévue.
  function echeances(etat, auj) {
    const rang = Object.fromEntries(ETATS.map((s, i) => [s, i]));
    const urg = { retard: 0, bientot: 1 };
    return etat.operations.map((op) => echeance(etat, op, auj))
      .sort((a, b) => rang[a.etat] - rang[b.etat] || (urg[a.urgence] ?? 2) - (urg[b.urgence] ?? 2) || (a.prevue || '9999').localeCompare(b.prevue || '9999') || a.op.nom.localeCompare(b.op.nom));
  }
  function groupesEcheances(etat, auj) {
    const g = Object.fromEntries(ETATS.map((s) => [s, []]));
    for (const e of echeances(etat, auj)) g[e.etat].push(e);
    return g;
  }
  // Critère lisible : « 12 500 h ou 14/02/2027, le premier atteint ».
  function libelleEcheance(e, court = '') {
    const parts = [];
    if (e.echCompteur !== null) parts.push(`${nombre(e.echCompteur, 0)}${court ? ` ${court}` : ''}`);
    if (e.echDate) parts.push(dateFr(e.echDate));
    if (!parts.length) return 'Périodicité à saisir';
    return parts.length > 1 ? `${parts.join(' ou ')}, le premier atteint` : parts[0];
  }

  // ---------- Bons d'intervention ----------
  // Numéro suivant : PREFIXE-AAAA-NNNN, numérotation par année.
  function numeroBon(etat, date) {
    const an = (estDate(date) ? date : iso(new Date())).slice(0, 4);
    const prefixe = (etat.reglages.prefixeBon || 'BI').toUpperCase();
    const motif = new RegExp(`^${prefixe.replace(/[^A-Z0-9]/g, '')}-${an}-(\\d+)$`);
    const max = etat.interventions.reduce((m, i) => { const r = motif.exec(i.numero || ''); return r ? Math.max(m, Number(r[1])) : m; }, 0);
    return `${prefixe.replace(/[^A-Z0-9]/g, '')}-${an}-${String(max + 1).padStart(4, '0')}`;
  }
  // Bon préventif préparé depuis une échéance (consignes et pièces du plan reprises).
  function preparerBon(etat, op, auj, { id = nouvelId(), datePrevue = null } = {}) {
    const e = echeance(etat, op, auj);
    const prevue = datePrevue || (e.prevue && e.prevue > auj ? e.prevue : auj);
    return normaliserIntervention({
      id, numero: numeroBon(etat, prevue), equipement: op.equipement, operation: op.id, type: 'preventif', statut: 'planifie', titre: op.nom,
      datePrevue: prevue, echeanceDate: e.echDate, echeanceCompteur: e.echCompteur, intervenant: op.qui === 'prestataire' ? 'Prestataire' : '',
      duree: op.d ? Math.round(op.d / 60 * 100) / 100 : null,
      points: (op.points || []).map((t) => ({ texte: t, fait: false })),
      pieces: (op.pieces || []).map((x) => { const p = etat.pieces.find((y) => y.id === x.piece); return { piece: x.piece, quantite: x.quantite, prix: p ? p.prix : 0 }; }),
    });
  }
  // Coût d'un bon : main-d'œuvre (saisie, sinon durée × taux horaire) + sous-traitance + pièces.
  function coutBon(i, reglages) {
    const mo = Number.isFinite(i.mainOeuvre) ? i.mainOeuvre : Math.round((Number(i.duree) || 0) * (reglages.tauxHoraire || 0));
    const pieces = (i.pieces || []).reduce((s, x) => s + Math.round((Number(x.quantite) || 0) * (Number(x.prix) || 0)), 0);
    const st = Number(i.sousTraitance) || 0;
    return { mainOeuvre: mo, pieces, sousTraitance: st, total: mo + pieces + st };
  }
  // Clôture : renvoie une chaîne d'erreur ou null (le bon est modifié en place).
  function cloturer(etat, i, { dateRealisee, compteur = null, duree = null, auj }) {
    if (!estDate(dateRealisee)) return 'Indique la date de réalisation.';
    if (auj && dateRealisee > auj) return 'La date de réalisation ne peut pas être dans le futur.';
    const eq = etat.equipements.find((e) => e.id === i.equipement);
    if (compteur !== null && compteur !== undefined) {
      if (!Number.isFinite(compteur) || compteur < 0) return 'Compteur illisible.';
      const err = verifierReleve(pointsCompteur(etat, eq).filter((p) => p.id !== i.id), dateRealisee, compteur);
      if (err) return `Compteur ${err.charAt(0).toLowerCase()}${err.slice(1)}`;
    }
    if (duree !== null && (!Number.isFinite(duree) || duree < 0)) return 'Durée illisible.';
    i.statut = 'fait'; i.dateRealisee = dateRealisee; i.compteur = Number.isFinite(compteur) ? compteur : null;
    if (duree !== null) i.duree = duree;
    return null;
  }

  // ---------- Pièces ----------
  function stockPiece(etat, pieceId, auj = null) {
    let s = 0;
    for (const m of etat.mouvementsPieces) if (m.piece === pieceId && (!auj || m.date <= auj)) s += Number(m.quantite) || 0;
    for (const i of etat.interventions) {
      if (i.statut !== 'fait' || (auj && i.dateRealisee > auj)) continue;
      for (const x of i.pieces || []) if (x.piece === pieceId) s -= Number(x.quantite) || 0;
    }
    return Math.round(s * 1000) / 1000;
  }
  function situationPiece(etat, p, auj) {
    const stock = stockPiece(etat, p.id, auj);
    const statut = stock <= 0 ? 'rupture' : p.seuil > 0 && stock <= p.seuil ? 'seuil' : 'ok';
    const usages = new Set(etat.operations.filter((o) => (o.pieces || []).some((x) => x.piece === p.id)).map((o) => o.equipement));
    const conso = etat.interventions.filter((i) => i.statut === 'fait' && i.dateRealisee >= ajout(auj, -365) && i.dateRealisee <= auj)
      .reduce((s, i) => s + (i.pieces || []).filter((x) => x.piece === p.id).reduce((t, x) => t + (Number(x.quantite) || 0), 0), 0);
    return { piece: p, stock, statut, valeur: Math.max(0, stock) * (p.prix || 0), equipements: [...usages], conso12: conso };
  }

  // ---------- Coûts et indicateurs ----------
  function coutsEquipement(etat, eqId, debut, fin) {
    const r = { preventif: 0, correctif: 0, mainOeuvre: 0, pieces: 0, sousTraitance: 0, total: 0, heures: 0, arret: 0, pannes: 0, bons: 0 };
    for (const i of etat.interventions) {
      if (i.equipement !== eqId || i.statut !== 'fait' || !estDate(i.dateRealisee)) continue;
      if ((debut && i.dateRealisee < debut) || (fin && i.dateRealisee > fin)) continue;
      const c = coutBon(i, etat.reglages);
      r[i.type] += c.total; r.mainOeuvre += c.mainOeuvre; r.pieces += c.pieces; r.sousTraitance += c.sousTraitance; r.total += c.total;
      r.heures += Number(i.duree) || 0; r.bons++;
      if (i.type === 'correctif') { r.pannes++; r.arret += Number(i.arret) || 0; }
    }
    return r;
  }
  // Coûts des 12 derniers mois par équipement (les équipements sans coût sont gardés à 0), du plus cher au moins cher.
  function coutsParEquipement(etat, auj) {
    const debut = ajout(auj, -365);
    return etat.equipements.filter((e) => !e.archive).map((eq) => ({ eq, ...coutsEquipement(etat, eq.id, debut, auj) }))
      .sort((a, b) => b.total - a.total || a.eq.nom.localeCompare(b.eq.nom));
  }

  // Indicateurs du préventif sur la période [auj − jours, auj].
  //  Taux de réalisation = faits ÷ (faits + bons préventifs dus non faits + échéances dépassées sans bon).
  //  Ponctualité : part des faits réalisés au plus tard à l'échéance (ou la date prévue) + tolérance.
  function indicateurs(etat, auj, jours = etat.reglages.periodeIndicateurs) {
    const debut = ajout(auj, -jours);
    const tol = etat.reglages.toleranceJours;
    const prev = etat.interventions.filter((i) => i.type === 'preventif' && i.statut !== 'annule');
    const faits = prev.filter((i) => i.statut === 'fait' && i.dateRealisee >= debut && i.dateRealisee <= auj);
    const dusNonFaits = prev.filter((i) => i.statut !== 'fait' && estDate(i.datePrevue) && i.datePrevue >= debut && i.datePrevue < auj);
    const ech = echeances(etat, auj);
    const sansBon = ech.filter((e) => e.etat === 'retard');
    const limite = (i) => [i.echeanceDate, i.datePrevue].filter(estDate).sort().at(-1);
    const aLHeure = faits.filter((i) => { const l = limite(i); return !l || i.dateRealisee <= ajout(l, tol); });
    const retards = faits.map((i) => { const l = limite(i); return l ? Math.max(0, ecart(l, i.dateRealisee)) : 0; }).filter((x) => x > 0);
    const corr = etat.interventions.filter((i) => i.type === 'correctif' && i.statut === 'fait' && i.dateRealisee >= debut && i.dateRealisee <= auj);
    const base = faits.length + dusNonFaits.length + sansBon.length;
    let coutPrev = 0, coutCorr = 0;
    for (const i of [...faits, ...corr]) { const c = coutBon(i, etat.reglages).total; if (i.type === 'preventif') coutPrev += c; else coutCorr += c; }
    return {
      debut, jours, faits: faits.length, dusNonFaits: dusNonFaits.length, sansBon: sansBon.length,
      taux: base ? faits.length / base * 100 : null,
      ponctualite: faits.length ? aLHeure.length / faits.length * 100 : null,
      retardMoyen: retards.length ? retards.reduce((s, x) => s + x, 0) / retards.length : 0,
      pannes: corr.length, arret: corr.reduce((s, i) => s + (Number(i.arret) || 0), 0),
      partPreventif: coutPrev + coutCorr ? coutPrev / (coutPrev + coutCorr) * 100 : null, coutPrev, coutCorr,
      retards: ech.filter((e) => e.urgence === 'retard' && e.etat !== 'suspendu').length,
      bientot: ech.filter((e) => e.urgence === 'bientot' && e.etat !== 'suspendu').length,
    };
  }

  // ---------- Normalisation ----------
  const texte = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  function normaliserEquipement(e) {
    return {
      id: String(e.id || nouvelId()), repere: texte(e.repere, 30), nom: texte(e.nom, 100) || 'Équipement', famille: texte(e.famille, 40),
      emplacement: texte(e.emplacement, 60), criticite: ['A', 'B', 'C'].includes(e.criticite) ? e.criticite : 'B',
      unite: ['h', 'cycles', 'km', 'unites'].includes(e.unite) ? e.unite : '', compteurInitial: num(e.compteurInitial) ?? 0,
      miseEnService: estDate(e.miseEnService) ? e.miseEnService : null, fabricant: texte(e.fabricant, 80), modele: texte(e.modele, 80),
      numeroSerie: texte(e.numeroSerie, 60), note: texte(e.note, 500), archive: !!e.archive, site: texte(e.site, 40),
    };
  }
  function normaliserOperation(o) {
    const p = periodeValide(o.p) ? [Math.round(Number(o.p[0])), o.p[1]] : null;
    return {
      id: String(o.id || nouvelId()), equipement: String(o.equipement || ''), code: texte(o.code, 40), nom: texte(o.nom, 120) || 'Opération',
      nature: ['entretien', 'controle', 'reglementaire'].includes(o.nature) ? o.nature : 'entretien', p, c: num(o.c) > 0 ? num(o.c) : null,
      d: num(o.d) ?? 0, qui: o.qui === 'prestataire' ? 'prestataire' : 'interne', regle: texte(o.regle, 40), reference: texte(o.reference, 200),
      points: (Array.isArray(o.points) ? o.points : []).map((t) => texte(t, 160)).filter(Boolean).slice(0, 20),
      pieces: (Array.isArray(o.pieces) ? o.pieces : []).filter((x) => x && x.piece).map((x) => ({ piece: String(x.piece), quantite: num(x.quantite) ?? 1 })),
      depuis: estDate(o.depuis) ? o.depuis : null, depuisCompteur: num(o.depuisCompteur), recalage: o.recalage === 'fixe' ? 'fixe' : 'glissant', actif: o.actif !== false,
    };
  }
  function normaliserIntervention(i) {
    return {
      id: String(i.id || nouvelId()), numero: texte(i.numero, 30), equipement: String(i.equipement || ''), operation: i.operation ? String(i.operation) : null,
      type: i.type === 'correctif' ? 'correctif' : 'preventif', statut: STATUTS_BON[i.statut] ? i.statut : 'planifie', titre: texte(i.titre, 160),
      // Correctif : date de signalement de la panne (à défaut, la date prévue) ; équipement à l'arrêt tant qu'elle est ouverte.
      dateSignalee: i.type === 'correctif' ? (estDate(i.dateSignalee) ? i.dateSignalee : estDate(i.datePrevue) ? i.datePrevue : null) : null,
      arretEq: i.type === 'correctif' && !!i.arretEq,
      datePrevue: estDate(i.datePrevue) ? i.datePrevue : null, echeanceDate: estDate(i.echeanceDate) ? i.echeanceDate : null, echeanceCompteur: num(i.echeanceCompteur),
      dateRealisee: estDate(i.dateRealisee) ? i.dateRealisee : null, compteur: num(i.compteur), duree: num(i.duree), intervenant: texte(i.intervenant, 80),
      mainOeuvre: num(i.mainOeuvre), sousTraitance: num(i.sousTraitance) ?? 0, arret: num(i.arret) ?? 0, motif: texte(i.motif, 60),
      symptome: texte(i.symptome, 500), constat: texte(i.constat, 1000), reference: texte(i.reference, 120),
      points: (Array.isArray(i.points) ? i.points : []).map((x) => ({ texte: texte(x.texte, 160), fait: !!x.fait })).filter((x) => x.texte),
      pieces: (Array.isArray(i.pieces) ? i.pieces : []).filter((x) => x && x.piece).map((x) => ({ piece: String(x.piece), quantite: num(x.quantite) ?? 1, prix: num(x.prix) ?? 0 })),
    };
  }
  const normaliserPiece = (p) => ({ id: String(p.id || nouvelId()), ref: texte(p.ref, 30), nom: texte(p.nom, 100) || 'Pièce', unite: texte(p.unite, 20) || 'pièce', emplacement: texte(p.emplacement, 60), fournisseur: texte(p.fournisseur, 80), prix: num(p.prix) ?? 0, seuil: num(p.seuil) ?? 0, note: texte(p.note, 300) });
  const normaliserMouvement = (m) => ({ id: String(m.id || nouvelId()), piece: String(m.piece || ''), date: estDate(m.date) ? m.date : iso(new Date()), type: m.type === 'ajustement' ? 'ajustement' : 'reception', quantite: num(m.quantite) ?? 0, prix: num(m.prix), note: texte(m.note, 200) });
  const normaliserReleve = (r) => ({ id: String(r.id || nouvelId()), equipement: String(r.equipement || ''), date: estDate(r.date) ? r.date : iso(new Date()), valeur: num(r.valeur) ?? 0 });

  function etatVide(reglages) {
    return { version: 1, entreprise: '', familles: [], reglages: { arretJours: 7, visiteMois: 6, ...reglages }, equipements: [], operations: [], releves: [], interventions: [], pieces: [], mouvementsPieces: [],
      multiSites: false, sites: [], visites: [] };
  }
  function normaliser(d, reglages) {
    const e = etatVide(reglages);
    if (!d || typeof d !== 'object') return e;
    e.entreprise = texte(d.entreprise, 80);
    e.familles = Array.isArray(d.familles) ? d.familles.map(String) : [];
    const r = d.reglages || {};
    const borne = (v, min, max, def) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : def);
    e.reglages = {
      alerteJours: borne(r.alerteJours, 0, 365, reglages.alerteJours), alerteCompteurPct: borne(r.alerteCompteurPct, 0, 100, reglages.alerteCompteurPct),
      toleranceJours: borne(r.toleranceJours, 0, 90, reglages.toleranceJours), periodeIndicateurs: borne(r.periodeIndicateurs, 7, 730, reglages.periodeIndicateurs),
      tauxHoraire: borne(r.tauxHoraire, 0, 10000000, reglages.tauxHoraire), prefixeBon: texte(r.prefixeBon ?? reglages.prefixeBon, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BI',
      arretJours: borne(r.arretJours, 1, 365, reglages.arretJours ?? 7), visiteMois: borne(r.visiteMois, 1, 36, reglages.visiteMois ?? 6),
    };
    e.equipements = (d.equipements || []).map(normaliserEquipement);
    e.operations = (d.operations || []).map(normaliserOperation);
    e.releves = (d.releves || []).map(normaliserReleve);
    e.interventions = (d.interventions || []).map(normaliserIntervention);
    e.pieces = (d.pieces || []).map(normaliserPiece);
    e.mouvementsPieces = (d.mouvementsPieces || []).map(normaliserMouvement);
    // Plusieurs sites (absents des données d'avant la fusion : un seul site implicite, rien à convertir).
    e.multiSites = d.multiSites === true;
    e.sites = (Array.isArray(d.sites) ? d.sites : []).filter((x) => x && typeof x === 'object').map(normaliserSite);
    e.visites = (Array.isArray(d.visites) ? d.visites : []).filter((x) => x && typeof x === 'object').map(normaliserVisite);
    if (e.multiSites) rattacherSites(e);
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  // ---------- Plusieurs sites ----------
  const borneNb = (v, max) => { const n = num(v); return n !== null && Math.abs(n) <= max ? n : null; };
  function normaliserSite(x) {
    let lat = borneNb(x.lat, 90), lon = borneNb(x.lon, 180);
    if (lat === null || lon === null) { lat = null; lon = null; }
    return {
      id: String(x.id || nouvelId()), nom: texte(x.nom, 80) || 'Site', type: texte(x.type, 8) || 'AUT', adresse: texte(x.adresse, 140), ville: texte(x.ville, 60),
      region: texte(x.region, 60), responsable: texte(x.responsable, 60), lat, lon, notes: texte(x.notes, 500), inactif: !!x.inactif,
    };
  }
  const normaliserVisite = (v) => ({ id: String(v.id || nouvelId()), site: String(v.site || ''), date: estDate(v.date) ? v.date : iso(new Date()), intervenant: texte(v.intervenant, 80), note: texte(v.note, 300), cout: num(v.cout) ?? 0 });
  // Chaque équipement (et chaque visite) appartient à un site existant : le premier site, à défaut. Sans site, un
  // « Site principal » (ou le nom de l'atelier) est créé : les données d'un seul site passent ainsi sans perte.
  function rattacherSites(e, nom = '') {
    if (!e.sites.length) e.sites.push(normaliserSite({ id: `site-${nouvelId()}`, nom: texte(nom, 80) || e.entreprise || 'Site principal', type: 'AUT' }));
    const ids = new Set(e.sites.map((x) => x.id));
    for (const eq of e.equipements) if (!ids.has(eq.site)) eq.site = e.sites[0].id;
    for (const v of e.visites) if (!ids.has(v.site)) v.site = e.sites[0].id;
    return e;
  }
  // Passage à plusieurs sites (copie de l'état) : rien n'est perdu, tout part dans le premier site.
  function activerMultiSites(etat, nom = '') {
    const e = JSON.parse(JSON.stringify(etat));
    e.multiSites = true;
    e.sites = e.sites || []; e.visites = e.visites || [];
    return rattacherSites(e, nom);
  }
  const bonOuvertStatut = (i) => i.statut === 'planifie' || i.statut === 'encours';

  // État d'un équipement : réformé (archivé) ; à l'arrêt si une panne ouverte l'arrête ; dégradé si une panne
  // ouverte ne l'arrête pas ; sinon en service. depuis : date de signalement de la plus ancienne panne en cause.
  function etatEquipement(etat, eq) {
    if (eq.archive) return { code: 'reforme', depuis: null, bon: null };
    const ouverts = etat.interventions.filter((i) => i.equipement === eq.id && i.type === 'correctif' && bonOuvertStatut(i) && estDate(i.dateSignalee))
      .sort((a, b) => a.dateSignalee.localeCompare(b.dateSignalee));
    const arret = ouverts.find((i) => i.arretEq);
    if (arret) return { code: 'arret', depuis: arret.dateSignalee, bon: arret };
    if (ouverts.length) return { code: 'degrade', depuis: ouverts[0].dateSignalee, bon: ouverts[0] };
    return { code: 'service', depuis: null, bon: null };
  }
  // Heures d'arrêt d'un équipement sur ]debut, fin] : arrêt saisi à la clôture des pannes résolues dans la période,
  // plus les pannes encore ouvertes qui l'arrêtent (24 h par jour depuis le signalement, bornées à la période).
  function heuresArret(etat, eqId, debut, fin) {
    let h = 0;
    for (const i of etat.interventions) {
      if (i.equipement !== eqId || i.type !== 'correctif' || i.statut === 'annule') continue;
      if (i.statut === 'fait') { if (estDate(i.dateRealisee) && i.dateRealisee > debut && i.dateRealisee <= fin) h += Number(i.arret) || 0; }
      else if (i.arretEq && estDate(i.dateSignalee) && i.dateSignalee <= fin) h += Math.max(0, ecart(i.dateSignalee > debut ? i.dateSignalee : debut, fin)) * 24;
    }
    return h;
  }
  // Disponibilité (0 à 1) sur les `jours` derniers jours, à partir de la mise en service si elle est plus récente.
  function disponibilite(etat, eq, auj, jours) {
    if (eq.archive) return null;
    let debut = ajout(auj, -jours);
    if (estDate(eq.miseEnService) && eq.miseEnService > debut) debut = eq.miseEnService;
    const duree = ecart(debut, auj);
    if (duree <= 0) return null;
    return Math.max(0, 1 - heuresArret(etat, eq.id, debut, auj) / (duree * 24));
  }
  // Sous-ensemble de l'état limité à des sites (null : tout le parc).
  function sousEtat(etat, siteIds) {
    if (!siteIds) return etat;
    const s = new Set(siteIds);
    const eqs = etat.equipements.filter((e) => s.has(e.site));
    const ids = new Set(eqs.map((e) => e.id));
    return { ...etat, equipements: eqs, operations: etat.operations.filter((o) => ids.has(o.equipement)), releves: etat.releves.filter((r) => ids.has(r.equipement)),
      interventions: etat.interventions.filter((i) => ids.has(i.equipement)), visites: (etat.visites || []).filter((v) => s.has(v.site)) };
  }
  // Dernière visite d'un site : visite notée ou bon clôturé sur l'un de ses équipements.
  function derniereVisite(etat, siteId, auj) {
    const eqs = new Set(etat.equipements.filter((e) => e.site === siteId).map((e) => e.id));
    let d = null;
    for (const v of etat.visites || []) if (v.site === siteId && v.date <= auj && (!d || v.date > d)) d = v.date;
    for (const i of etat.interventions) if (eqs.has(i.equipement) && i.statut === 'fait' && estDate(i.dateRealisee) && i.dateRealisee <= auj && (!d || i.dateRealisee > d)) d = i.dateRealisee;
    return d;
  }
  // Bilan d'un site (ou du parc entier) : équipements, état, disponibilité, retards, pannes, délai de résolution
  // et indicateurs du préventif sur la période des indicateurs ; coûts sur les 12 derniers mois (bons et visites).
  function bilan(etat, auj, siteIds = null) {
    const x = sousEtat(etat, siteIds);
    const jours = etat.reglages.periodeIndicateurs;
    const debut = ajout(auj, -jours), debut12 = ajout(auj, -365);
    const ind = indicateurs(x, auj, jours);
    const actifs = x.equipements.filter((e) => !e.archive);
    const etats = actifs.map((e) => etatEquipement(x, e).code);
    const dispos = actifs.map((e) => disponibilite(x, e, auj, jours)).filter((v) => v !== null);
    const resolus = x.interventions.filter((i) => i.type === 'correctif' && i.statut === 'fait' && estDate(i.dateSignalee) && estDate(i.dateRealisee) && i.dateRealisee > debut && i.dateRealisee <= auj);
    const delais = resolus.map((i) => Math.max(0, ecart(i.dateSignalee, i.dateRealisee)));
    const parType = { preventif: 0, correctif: 0, visite: 0 };
    const parFamille = {};
    const fam = new Map(x.equipements.map((e) => [e.id, e.famille || '']));
    for (const i of x.interventions) {
      if (i.statut !== 'fait' || !estDate(i.dateRealisee) || i.dateRealisee <= debut12 || i.dateRealisee > auj) continue;
      const c = coutBon(i, etat.reglages).total;
      parType[i.type] += c;
      const f = fam.get(i.equipement) || '';
      parFamille[f] = (parFamille[f] || 0) + c;
    }
    for (const v of x.visites || []) if (v.date > debut12 && v.date <= auj) parType.visite += Number(v.cout) || 0;
    return {
      jours, equipements: actifs.length, archives: x.equipements.length - actifs.length,
      arret: etats.filter((c) => c === 'arret').length, degrade: etats.filter((c) => c === 'degrade').length,
      disponibilite: dispos.length ? dispos.reduce((s, v) => s + v, 0) / dispos.length : null,
      retards: ind.retards, bientot: ind.bientot, taux: ind.taux, ponctualite: ind.ponctualite, faits: ind.faits,
      correctifsOuverts: x.interventions.filter((i) => i.type === 'correctif' && bonOuvertStatut(i)).length,
      delaiMoyen: delais.length ? Math.round(delais.reduce((s, v) => s + v, 0) / delais.length * 10) / 10 : null, resolus: resolus.length,
      cout: parType.preventif + parType.correctif + parType.visite, parType, parFamille,
    };
  }
  // Alertes de pilotage : équipement à l'arrêt (en retard au bout de arretJours) ; avec plusieurs sites, site sans
  // visite depuis plus de visiteMois mois, ou jamais visité. Les échéances du préventif ont leur propre liste.
  function alertes(etat, auj) {
    const rg = etat.reglages, out = [];
    const sites = new Map((etat.sites || []).map((s) => [s.id, s]));
    for (const eq of etat.equipements) {
      if (eq.archive || (etat.multiSites && sites.get(eq.site)?.inactif)) continue;
      const st = etatEquipement(etat, eq);
      if (st.code !== 'arret') continue;
      const j = Math.max(0, ecart(st.depuis, auj));
      out.push(j >= rg.arretJours
        ? { type: 'arret', etat: 'retard', site: eq.site, equipement: eq.id, bon: st.bon.id, jours: j, date: st.depuis, titre: `À l'arrêt depuis ${j} jours`, detail: `Panne signalée le ${dateFr(st.depuis)}, alerte à ${rg.arretJours} jours` }
        : { type: 'arret', etat: 'proche', site: eq.site, equipement: eq.id, bon: st.bon.id, jours: j, date: st.depuis, titre: 'À l\'arrêt', detail: `Depuis le ${dateFr(st.depuis)} (alerte à ${rg.arretJours} jours)` });
    }
    if (etat.multiSites) {
      const limite = ajoutMois(auj, -rg.visiteMois);
      for (const s of etat.sites) {
        if (s.inactif) continue;
        const d = derniereVisite(etat, s.id, auj);
        if (!d) out.push({ type: 'visite', etat: 'proche', site: s.id, date: auj, titre: 'Aucune visite enregistrée', detail: 'Note une visite ou clôture un bon sur ce site pour le suivre' });
        else if (d < limite) out.push({ type: 'visite', etat: 'retard', site: s.id, date: ajoutMois(d, rg.visiteMois), derniere: d, titre: `Sans visite depuis plus de ${rg.visiteMois} mois`, detail: `Dernière visite le ${dateFr(d)}` });
      }
    }
    const rang = { retard: 0, proche: 1 };
    return out.sort((a, b) => rang[a.etat] - rang[b.etat] || (a.date || '').localeCompare(b.date || ''));
  }
  // État de chaque site : retard (échéance dépassée ou alerte en retard), proche (échéance bientôt ou autre alerte), ok.
  function etatsSites(etat, auj, ech = echeances(etat, auj), al = alertes(etat, auj)) {
    const r = Object.fromEntries((etat.sites || []).map((s) => [s.id, 'ok']));
    const monte = (id, v) => { if (r[id] === undefined) return; if (v === 'retard' || r[id] === 'ok') r[id] = v; };
    for (const x of ech) {
      if (x.etat === 'suspendu' || !x.eq) continue;
      if (x.urgence === 'retard') monte(x.eq.site, 'retard'); else if (x.urgence === 'bientot') monte(x.eq.site, 'proche');
    }
    for (const a of al) monte(a.site, a.etat);
    return r;
  }
  // Lignes de la liste des sites : { site, ind, etat, alertes }.
  function lignesSites(etat, auj) {
    const al = alertes(etat, auj), et = etatsSites(etat, auj, undefined, al);
    return (etat.sites || []).map((s) => ({ site: s, ind: bilan(etat, auj, [s.id]), etat: et[s.id], alertes: al.filter((a) => a.site === s.id) }));
  }
  // Filtre : { texte, region, type, etat (alerte, retard, ok) } ; tri : { cle, sens (1 ou -1) }.
  const platMots = (t) => plat(t).replace(/[^a-z0-9]+/g, ' ').trim();
  function filtrerSites(lignes, f = {}) {
    const q = platMots(f.texte);
    return lignes.filter(({ site, etat }) => (!f.region || platMots(site.region) === platMots(f.region))
      && (!f.type || site.type === f.type)
      && (!f.etat || (f.etat === 'alerte' ? etat !== 'ok' : etat === f.etat))
      && (!q || platMots([site.nom, site.ville, site.region, site.responsable, site.adresse].join(' ')).includes(q)));
  }
  function trierSites(lignes, tri = { cle: 'nom', sens: 1 }) {
    const rangEtat = { retard: 0, proche: 1, ok: 2 };
    const val = ({ site, ind, etat }) => ({ nom: platMots(site.nom), ville: platMots(site.ville), region: platMots(site.region), equipements: ind.equipements,
      disponibilite: ind.disponibilite ?? 2, retards: ind.retards, cout: ind.cout, delai: ind.delaiMoyen ?? Infinity, etat: rangEtat[etat] }[tri.cle]);
    return [...lignes].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : (x === y ? 0 : x - y);
      return c * (tri.sens || 1) || platMots(a.site.nom).localeCompare(platMots(b.site.nom));
    });
  }
  // Carte schématique (aucun fond de carte) : projection équirectangulaire corrigée de la latitude moyenne,
  // cadrée sur les points avec une marge ; null si aucun site n'a de coordonnées.
  const aCoordonnees = (x) => Number.isFinite(x.lat) && Number.isFinite(x.lon);
  function projeter(sites, largeur = 600, hauteur = 420, marge = 40) {
    const l = sites.filter(aCoordonnees);
    if (!l.length) return null;
    const k = Math.cos(l.reduce((s2, x) => s2 + x.lat, 0) / l.length * Math.PI / 180);
    const xs = l.map((x) => x.lon * k), ys = l.map((x) => x.lat);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const min = 0.5; // étendue minimale (un seul site, ou sites très proches) : environ 0,5 degré
    if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
    if (y1 - y0 < min) { const c = (y0 + y1) / 2; y0 = c - min / 2; y1 = c + min / 2; }
    const ech = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (y1 - y0));
    const dx = (largeur - (x1 - x0) * ech) / 2, dy = (hauteur - (y1 - y0) * ech) / 2;
    const r1 = (v) => Math.round(v * 10) / 10;
    return { largeur, hauteur, echelle: ech, bornes: { latMin: y0, latMax: y1, lonMin: x0 / k, lonMax: x1 / k },
      points: l.map((x) => ({ id: x.id, x: r1(dx + (x.lon * k - x0) * ech), y: r1(hauteur - dy - (x.lat - y0) * ech) })) };
  }
  // Sites sans coordonnées regroupés par région (ordre alphabétique, « Sans région » en dernier).
  function grilleRegions(sites) {
    const g = new Map();
    for (const x of sites) { const r = String(x.region || '').trim() || 'Sans région'; if (!g.has(r)) g.set(r, []); g.get(r).push(x); }
    return [...g.entries()].sort((a, b) => (a[0] === 'Sans région') - (b[0] === 'Sans région') || a[0].localeCompare(b[0], 'fr'))
      .map(([region, l]) => ({ region, sites: l.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) }));
  }
  // Suppression d'un site avec ses équipements (et leurs plans, relevés, bons) et ses visites.
  function supprimerSite(etat, id) {
    let e = etat;
    for (const eq of etat.equipements.filter((x) => x.site === id)) e = supprimerEquipement(e, eq.id);
    return { ...e, sites: e.sites.filter((x) => x.id !== id), visites: (e.visites || []).filter((v) => v.site !== id) };
  }

  // Suppression d'un équipement avec ses opérations, relevés et bons.
  function supprimerEquipement(etat, id) {
    const ops = new Set(etat.operations.filter((o) => o.equipement === id).map((o) => o.id));
    return { ...etat, equipements: etat.equipements.filter((e) => e.id !== id), operations: etat.operations.filter((o) => !ops.has(o.id)),
      releves: etat.releves.filter((r) => r.equipement !== id), interventions: etat.interventions.filter((i) => i.equipement !== id) };
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, formules neutralisées) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const eur = (c) => Math.round(c) / 100;
  // Avec plusieurs sites, chaque export commence par la colonne « Site ».
  const nomSite = (etat, id) => (etat.sites || []).find((x) => x.id === id)?.nom || '';
  const avecSite = (etat, entete, lignes) => (etat.multiSites ? [['Site', ...entete], ...lignes.map(([s, ...l]) => [s, ...l])] : [entete, ...lignes.map(([, ...l]) => l)]);
  function csvEcheancier(etat, auj) {
    const l = echeances(etat, auj).map((e) => [nomSite(etat, e.eq?.site), e.eq?.repere || '', e.eq?.nom || '', e.eq?.emplacement || '', e.op.nom, e.op.nature, libellePeriode(e.op.p), e.op.c ?? '', e.derniere ? dateFr(e.derniere.dateRealisee) : '',
      dateFr(e.echDate), e.echCompteur ?? '', e.compteur ?? '', dateFr(e.dateEstimee), LIB_ETAT[e.etat], e.bon ? e.bon.numero : '']);
    return versCsv(avecSite(etat, ['Repère', 'Équipement', 'Emplacement', 'Opération', 'Nature', 'Périodicité', 'Intervalle compteur', 'Dernière réalisation', 'Échéance date', 'Échéance compteur', 'Compteur actuel', 'Date estimée', 'État', 'Bon ouvert'], l));
  }
  function csvInterventions(etat) {
    const eqs = new Map(etat.equipements.map((e) => [e.id, e]));
    const l = [...etat.interventions].sort((a, b) => (a.dateRealisee || a.datePrevue || '').localeCompare(b.dateRealisee || b.datePrevue || '')).map((i) => {
      const c = coutBon(i, etat.reglages), eq = eqs.get(i.equipement);
      return [nomSite(etat, eq?.site), i.numero, TYPES_BON[i.type], STATUTS_BON[i.statut], eq?.repere || '', eq?.nom || '', i.titre, dateFr(i.dateSignalee), dateFr(i.datePrevue), dateFr(i.dateRealisee), i.compteur ?? '', i.duree ?? '', i.intervenant,
        eur(c.mainOeuvre), eur(c.pieces), eur(c.sousTraitance), eur(c.total), i.type === 'correctif' ? (i.arretEq ? 'oui' : 'non') : '', i.arret || '', i.constat || i.symptome];
    });
    // Visites de site (plusieurs sites) : une ligne chacune, coût en sous-traitance.
    if (etat.multiSites) for (const v of [...(etat.visites || [])].sort((a, b) => a.date.localeCompare(b.date))) l.push([nomSite(etat, v.site), '', 'Visite de site', 'Fait', '', '', v.note || 'Visite', '', '', dateFr(v.date), '', '', v.intervenant, 0, 0, eur(v.cout), eur(v.cout), '', '', '']);
    return versCsv(avecSite(etat, ['Numéro', 'Type', 'Statut', 'Repère', 'Équipement', 'Intitulé', 'Signalée le', 'Date prévue', 'Date réalisée', 'Compteur', 'Durée (h)', 'Intervenant', 'Main-d\'œuvre (€)', 'Pièces (€)', 'Sous-traitance (€)', 'Total (€)', 'À l\'arrêt', 'Arrêt (h)', 'Constat'], l));
  }
  function csvCouts(etat, auj) {
    const l = coutsParEquipement(etat, auj).map((x) => {
      const tout = coutsEquipement(etat, x.eq.id, null, auj);
      return [nomSite(etat, x.eq.site), x.eq.repere, x.eq.nom, x.eq.famille, x.eq.criticite, eur(x.preventif), eur(x.correctif), eur(x.total), x.pannes, x.arret, eur(tout.total)];
    });
    return versCsv(avecSite(etat, ['Repère', 'Équipement', 'Famille', 'Criticité', 'Préventif 12 mois (€)', 'Correctif 12 mois (€)', 'Total 12 mois (€)', 'Pannes 12 mois', 'Arrêt 12 mois (h)', 'Total depuis le début (€)'], l));
  }

  // ---------- Tableur : sites et équipements (export, modèles, import) ----------
  // Lecture d'un CSV : BOM retiré, séparateur « ; » (ou « , » / tabulation si l'en-tête l'indique), guillemets doublés,
  // retours à la ligne dans les champs, lignes vides ignorées, apostrophe de neutralisation retirée.
  function lireCsv(contenu) {
    const t = String(contenu || '').replace(/^\uFEFF/, '');
    const premiere = t.split(/\r?\n/)[0] || '';
    const compte = (c) => premiere.split(c).length - 1;
    const sep = compte(';') >= Math.max(compte(','), compte('\t')) ? ';' : compte('\t') > compte(',') ? '\t' : ',';
    const lignes = [];
    let ligne = [], champ = '', guil = false;
    for (let k = 0; k < t.length; k++) {
      const c = t[k];
      if (guil) { if (c === '"') { if (t[k + 1] === '"') { champ += '"'; k++; } else guil = false; } else champ += c; }
      else if (c === '"' && champ === '') guil = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[k + 1] === '\n') k++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes.filter((l) => l.some((x) => String(x).trim() !== '')).map((l) => l.map((x) => x.replace(/^'(?=[=+\-@])/, '')));
  }
  // Date de tableur : JJ/MM/AAAA, JJ-MM-AAAA ou AAAA-MM-JJ ; '' si vide ; undefined si illisible.
  function dateCsv(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) { const d = `${m[3]}-${deux(m[2])}-${deux(m[1])}`; return estDate(d) ? d : undefined; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { const d = `${m[1]}-${m[2]}-${m[3]}`; return estDate(d) ? d : undefined; }
    return undefined;
  }
  const COLONNES_SITES = ['Nom', 'Type', 'Adresse', 'Ville', 'Région', 'Responsable', 'Latitude', 'Longitude', 'Notes'];
  const COLONNES_EQUIPEMENTS = ['Site', 'Repère', 'Nom', 'Famille', 'Emplacement', 'Criticité', 'Fabricant', 'Modèle', 'N° de série', 'Mise en service', 'Périodicité préventive (mois)', 'Notes'];
  // Colonnes acceptées sous un autre nom (fichiers de l'ancien Pilotage de parcs multi-sites).
  const ALIAS = { 'Désignation': 'Nom', Marque: 'Fabricant', 'Catégorie': 'Famille' };
  function indexColonnes(entete, attendues) {
    const p = entete.map(platMots), idx = {};
    for (const c of attendues) { const k = p.indexOf(platMots(c)); if (k >= 0) idx[c] = k; }
    for (const [a, c] of Object.entries(ALIAS)) if (idx[c] === undefined && attendues.includes(c)) { const k = p.indexOf(platMots(a)); if (k >= 0) idx[c] = k; }
    return idx;
  }
  const csvModele = (quoi) => versCsv([quoi === 'sites' ? COLONNES_SITES : COLONNES_EQUIPEMENTS]);
  const codeType = (base, v) => { const p = platMots(v); if (!p) return 'AUT'; const x = base.typesSites.find((y) => platMots(y.nom) === p || platMots(y.code) === p || platMots(y.court) === p); return x ? x.code : null; };
  const libType = (base, c) => base.typesSites.find((x) => x.code === c)?.nom || c || '';
  // Famille : identifiant, nom, ou catégorie de l'ancien outil (code ou nom) ; '' si vide ; null si inconnue.
  function codeFamille(base, v) {
    const p = platMots(v);
    if (!p) return '';
    const f = base.familles.find((x) => platMots(x.id) === p || platMots(x.nom) === p);
    if (f) return f.id;
    const c = Object.entries(base.categoriesParcs || {}).find(([k, x]) => platMots(k) === p || platMots(x.nom) === p);
    return c ? c[1].famille : null;
  }
  const CRIT_PARCS = { haute: 'A', moyenne: 'B', basse: 'C' };
  function codeCriticite(base, v) {
    const p = platMots(v);
    if (!p) return 'B';
    const c = base.criticites.find((x) => platMots(x.code) === p || platMots(x.nom) === p);
    return c ? c.code : CRIT_PARCS[p] || null;
  }

  function csvSites(etat, base, auj) {
    const lignes = lignesSites(etat, auj).map(({ site: x, ind, etat: et }) => [x.nom, libType(base, x.type), x.adresse, x.ville, x.region, x.responsable, Number.isFinite(x.lat) ? x.lat : '', Number.isFinite(x.lon) ? x.lon : '', x.notes,
      ind.equipements, ind.disponibilite === null ? '' : Math.round(ind.disponibilite * 1000) / 10, ind.retards, ind.correctifsOuverts, ind.delaiMoyen ?? '', eur(ind.cout), dateFr(derniereVisite(etat, x.id, auj)), { retard: 'En retard', proche: 'À surveiller', ok: 'À jour' }[et]]);
    return versCsv([[...COLONNES_SITES, 'Équipements actifs', 'Disponibilité (%)', 'Échéances en retard', 'Pannes ouvertes', 'Délai moyen de résolution (jours)', 'Coût 12 mois (€)', 'Dernière visite', 'État'], ...lignes]);
  }
  function csvEquipements(etat, base, auj) {
    const ETAT_EQ = { service: 'En service', degrade: 'Dégradé', arret: 'À l\'arrêt', reforme: 'Réformé' };
    const ech = echeances(etat, auj);
    const lignes = etat.equipements.map((e) => {
      const proch = ech.filter((x) => x.op.equipement === e.id && x.prevue && x.etat !== 'suspendu').sort((a, b) => a.prevue.localeCompare(b.prevue))[0];
      const d = disponibilite(etat, e, auj, etat.reglages.periodeIndicateurs);
      const mois = etat.operations.filter((o) => o.equipement === e.id && o.actif && o.p && o.p[1] === 'm');
      return [nomSite(etat, e.site), e.repere, e.nom, base.familles.find((f) => f.id === e.famille)?.nom || '', e.emplacement, e.criticite, e.fabricant, e.modele, e.numeroSerie, dateFr(e.miseEnService),
        mois.length === 1 ? mois[0].p[0] : '', e.note, ETAT_EQ[etatEquipement(etat, e).code], proch ? `${proch.op.nom} · ${dateFr(proch.prevue)}` : '', d === null ? '' : Math.round(d * 1000) / 10];
    }).sort((a, b) => a[0].localeCompare(b[0], 'fr') || (a[1] || a[2]).localeCompare(b[1] || b[2], 'fr'));
    const t = [[...COLONNES_EQUIPEMENTS, 'État', 'Prochaine échéance', 'Disponibilité (%)'], ...lignes];
    return versCsv(etat.multiSites ? t : t.map((l) => l.slice(1)));
  }

  // Import des sites : le site de même nom (accents et casse ignorés) est mis à jour, sinon ajouté.
  // Renvoie { sites, ajouts, majs, erreurs } sans modifier l'état.
  function importerSites(etat, base, contenu, id = nouvelId) {
    const l = lireCsv(contenu);
    const vide = { sites: etat.sites, ajouts: 0, majs: 0 };
    if (!l.length) return { ...vide, erreurs: ['Fichier vide.'] };
    const idx = indexColonnes(l[0], COLONNES_SITES);
    if (idx.Nom === undefined) return { ...vide, erreurs: ['Colonne « Nom » introuvable : pars du modèle CSV des sites.'] };
    const sites = etat.sites.map((x) => ({ ...x }));
    const erreurs = [];
    let ajouts = 0, majs = 0;
    l.slice(1).forEach((r, k) => {
      const n = k + 2;
      const v = (c) => (idx[c] === undefined ? undefined : String(r[idx[c]] ?? '').trim());
      const nom = v('Nom');
      if (!nom) { erreurs.push(`Ligne ${n} : nom du site manquant.`); return; }
      const champs = {};
      for (const [c, cle] of [['Adresse', 'adresse'], ['Ville', 'ville'], ['Région', 'region'], ['Responsable', 'responsable'], ['Notes', 'notes']]) if (v(c) !== undefined) champs[cle] = v(c);
      if (v('Type') !== undefined) { const t = codeType(base, v('Type')); if (t === null) erreurs.push(`Ligne ${n} : type « ${v('Type')} » inconnu, « Autre » retenu.`); champs.type = t || 'AUT'; }
      if (v('Latitude') !== undefined || v('Longitude') !== undefined) {
        const lu = (s, max) => { const t = String(s ?? '').replace(',', '.').trim(); if (!t) return null; const x = Number(t); return Number.isFinite(x) && Math.abs(x) <= max ? x : undefined; };
        const la = lu(v('Latitude'), 90), lo = lu(v('Longitude'), 180);
        if (la === undefined || lo === undefined || (la === null) !== (lo === null)) erreurs.push(`Ligne ${n} : coordonnées ignorées (latitude et longitude décimales, les deux ou aucune).`);
        else { champs.lat = la; champs.lon = lo; }
      }
      const ex = sites.find((x) => platMots(x.nom) === platMots(nom));
      if (ex) { Object.assign(ex, normaliserSite({ ...ex, ...champs })); majs++; }
      else { sites.push(normaliserSite({ id: id(), nom, ...champs })); ajouts++; }
    });
    return { sites, ajouts, majs, erreurs };
  }

  // Import des équipements. Plusieurs sites : la colonne « Site » nomme un site existant. Même repère (ou, sans
  // repère, même nom) sur le même site : mise à jour ; sinon ajout, avec une opération « Préventif périodique »
  // si la périodicité en mois est donnée, à défaut le plan type de la famille (opérations à la date, sauf les
  // quotidiennes). Renvoie { equipements, operations (à ajouter), familles, ajouts, majs, erreurs }.
  function importerEquipements(etat, base, contenu, id = nouvelId, auj = iso(new Date())) {
    const l = lireCsv(contenu);
    const vide = { equipements: etat.equipements, operations: [], familles: etat.familles, ajouts: 0, majs: 0 };
    if (!l.length) return { ...vide, erreurs: ['Fichier vide.'] };
    const idx = indexColonnes(l[0], COLONNES_EQUIPEMENTS);
    if (idx.Nom === undefined || (etat.multiSites && idx.Site === undefined)) return { ...vide, erreurs: [etat.multiSites ? 'Colonnes « Site » et « Nom » introuvables : pars du modèle CSV des équipements.' : 'Colonne « Nom » introuvable : pars du modèle CSV des équipements.'] };
    const equipements = etat.equipements.map((e) => ({ ...e }));
    const operations = [], familles = [...etat.familles], erreurs = [];
    let ajouts = 0, majs = 0;
    l.slice(1).forEach((r, k) => {
      const n = k + 2;
      const v = (c) => (idx[c] === undefined ? undefined : String(r[idx[c]] ?? '').trim());
      let site = '';
      if (etat.multiSites) {
        const s = etat.sites.find((x) => platMots(x.nom) === platMots(v('Site')));
        if (!s) { erreurs.push(`Ligne ${n} : site « ${v('Site') || '(vide)'} » introuvable, importe d'abord les sites.`); return; }
        site = s.id;
      }
      const nom = v('Nom');
      if (!nom) { erreurs.push(`Ligne ${n} : nom de l'équipement manquant.`); return; }
      const champs = { nom };
      for (const [c, cle] of [['Repère', 'repere'], ['Emplacement', 'emplacement'], ['Fabricant', 'fabricant'], ['Modèle', 'modele'], ['N° de série', 'numeroSerie'], ['Notes', 'note']]) if (v(c) !== undefined) champs[cle] = v(c);
      if (v('Famille') !== undefined) { const f = codeFamille(base, v('Famille')); if (f === null) erreurs.push(`Ligne ${n} : famille « ${v('Famille')} » inconnue, aucune famille retenue.`); champs.famille = f || ''; }
      if (v('Criticité') !== undefined) { const c = codeCriticite(base, v('Criticité')); if (c === null) erreurs.push(`Ligne ${n} : criticité « ${v('Criticité')} » inconnue, « B » retenue.`); champs.criticite = c || 'B'; }
      if (v('Mise en service') !== undefined) { const d = dateCsv(v('Mise en service')); if (d === undefined) erreurs.push(`Ligne ${n} : date de mise en service illisible (JJ/MM/AAAA), ignorée.`); else champs.miseEnService = d || null; }
      let mois = null;
      if (v('Périodicité préventive (mois)') !== undefined && v('Périodicité préventive (mois)') !== '') {
        const m = Number(v('Périodicité préventive (mois)').replace(',', '.'));
        if (!Number.isInteger(m) || m < 0 || m > 120) erreurs.push(`Ligne ${n} : périodicité « ${v('Périodicité préventive (mois)')} » ignorée (nombre entier de mois, 0 à 120).`); else mois = m;
      }
      const meme = (e) => e.site === site && (champs.repere ? platMots(e.repere) === platMots(champs.repere) : !e.repere && platMots(e.nom) === platMots(nom));
      const ex = equipements.find(meme);
      if (ex) { Object.assign(ex, normaliserEquipement({ ...ex, ...champs })); majs++; return; }
      const eq = normaliserEquipement({ id: id(), site, unite: '', ...champs });
      equipements.push(eq);
      ajouts++;
      if (eq.famille && !familles.includes(eq.famille)) familles.push(eq.famille);
      const depuis = eq.miseEnService || auj;
      if (mois > 0) operations.push(normaliserOperation({ id: id(), equipement: eq.id, nom: 'Préventif périodique', nature: 'entretien', p: [mois, 'm'], d: 60, qui: 'prestataire', depuis }));
      else if (mois === null && eq.famille) {
        const f = base.familles.find((x) => x.id === eq.famille);
        operations.push(...planDepuisFamille(base, eq.famille, { equipement: eq.id, depuis, codes: f.plan.filter((o) => !(o.p && o.p[1] === 'j')).map((o) => o.code), id }).map((o) => ({ ...o, c: null })));
      }
    });
    return { equipements, operations, familles, ajouts, majs, erreurs };
  }

  // ---------- Copie exportée de l'ancien Pilotage de parcs multi-sites ----------
  // Reconnue à ses sites et à ses équipements sans plan (designation, siteId, periodiciteMois).
  const estCopieParcs = (d) => !!d && Array.isArray(d.sites) && Array.isArray(d.equipements) && !Array.isArray(d.operations) && d.equipements.every((x) => x && typeof x === 'object' && !('nom' in x));
  const centimes = (v) => { if (v === '' || v === null || v === undefined) return 0; const x = Number(String(v).replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? Math.round(x * 100) : 0; };
  // Conversion vers une maintenance à plusieurs sites : chaque site garde ses équipements ; la périodicité du
  // préventif devient une opération « Préventif périodique » ; préventifs, pannes et visites deviennent des bons
  // clôturés (ou ouverts pour une panne non résolue) et des visites, avec leur coût en sous-traitance HT.
  function depuisParcs(d, base) {
    const e = etatVide(base.reglages);
    e.multiSites = true;
    e.entreprise = texte(d.structure, 80);
    const rg = d.reglages || {};
    if (Number.isInteger(rg.arretJours) && rg.arretJours >= 1 && rg.arretJours <= 365) e.reglages.arretJours = rg.arretJours;
    if (Number.isInteger(rg.visiteMois) && rg.visiteMois >= 1 && rg.visiteMois <= 36) e.reglages.visiteMois = rg.visiteMois;
    e.sites = d.sites.filter((x) => x && typeof x === 'object').map(normaliserSite);
    const ops = new Map();
    for (const x of d.equipements.filter((y) => y && typeof y === 'object')) {
      const eq = normaliserEquipement({ id: x.id, site: x.siteId, nom: x.designation, famille: base.categoriesParcs?.[x.categorie]?.famille || '', criticite: CRIT_PARCS[x.criticite] || 'B',
        fabricant: x.marque, modele: x.modele, miseEnService: x.miseEnService, note: x.notes, archive: !!x.reforme, unite: '' });
      e.equipements.push(eq);
      if (eq.famille && !e.familles.includes(eq.famille)) e.familles.push(eq.famille);
      const m = Number(x.periodiciteMois) || 0;
      if (m > 0) {
        const op = normaliserOperation({ id: `op-${eq.id}`, equipement: eq.id, nom: 'Préventif périodique', nature: 'entretien', p: [Math.min(120, Math.round(m)), 'm'], d: 60, qui: 'prestataire', depuis: estDate(x.depuis) ? x.depuis : eq.miseEnService });
        e.operations.push(op); ops.set(eq.id, op.id);
      }
    }
    const eqs = new Map(e.equipements.map((x) => [x.id, x]));
    for (const i of (Array.isArray(d.interventions) ? d.interventions : []).filter((y) => y && typeof y === 'object')) {
      const commun = { id: i.id, intervenant: i.prestataire, mainOeuvre: 0, sousTraitance: centimes(i.cout) };
      if (i.type === 'visite' || !eqs.has(i.equipementId)) {
        if (estDate(i.date)) e.visites.push(normaliserVisite({ id: i.id, site: i.siteId, date: i.date, intervenant: i.prestataire, note: i.libelle, cout: centimes(i.cout) }));
      } else if (i.type === 'correctif') {
        if (!estDate(i.signale)) continue;
        const resolu = estDate(i.resolu) ? i.resolu : null;
        e.interventions.push(normaliserIntervention({ ...commun, equipement: i.equipementId, type: 'correctif', statut: resolu ? 'fait' : 'encours', titre: i.libelle || 'Panne', motif: 'Cause inconnue',
          dateSignalee: i.signale, datePrevue: i.signale, dateRealisee: resolu, arretEq: !!i.arret, arret: i.arret && resolu ? Math.max(0, ecart(i.signale, resolu)) * 24 : 0, symptome: i.libelle }));
      } else if (estDate(i.date)) {
        const ech = estDate(i.echeance) ? i.echeance : null;
        e.interventions.push(normaliserIntervention({ ...commun, equipement: i.equipementId, operation: ops.get(i.equipementId) || null, type: 'preventif', statut: 'fait', titre: i.libelle || 'Préventif périodique',
          datePrevue: ech || i.date, echeanceDate: ech, dateRealisee: i.date }));
      }
    }
    // Numéros de bons dans l'ordre des dates, année par année.
    for (const i of [...e.interventions].sort((a, b) => (a.dateRealisee || a.datePrevue || '').localeCompare(b.dateRealisee || b.datePrevue || ''))) i.numero = numeroBon(e, i.dateRealisee || i.datePrevue);
    return rattacherSites(e);
  }

  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  racine.GMA = {
    STATUTS_BON, TYPES_BON, ETATS, LIB_ETAT, UNITES_P, HORIZON,
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, ajoutPeriode, periodeValide, libellePeriode,
    nombre, euros, lireMontant, lireNombre, saisieMontant, saisieNombre, pct, plat, nouvelId,
    pointsCompteur, compteurActuel, dernierReleve, rythme, verifierReleve,
    planDepuisFamille, derniereRealisation, bonOuvert, echeance, echeances, groupesEcheances, libelleEcheance,
    numeroBon, preparerBon, coutBon, cloturer, stockPiece, situationPiece, coutsEquipement, coutsParEquipement, indicateurs,
    normaliserEquipement, normaliserOperation, normaliserIntervention, normaliserPiece, normaliserMouvement, normaliserReleve,
    etatVide, normaliser, supprimerEquipement, champCsv, csvEcheancier, csvInterventions, csvCouts, taille,
    normaliserSite, normaliserVisite, rattacherSites, activerMultiSites, etatEquipement, heuresArret, disponibilite, sousEtat, derniereVisite,
    bilan, alertes, etatsSites, lignesSites, filtrerSites, trierSites, aCoordonnees, projeter, grilleRegions, supprimerSite,
    lireCsv, dateCsv, csvModele, csvSites, csvEquipements, importerSites, importerEquipements, COLONNES_SITES, COLONNES_EQUIPEMENTS,
    estCopieParcs, depuisParcs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
