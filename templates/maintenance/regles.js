// Maintenance préventive QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.GMA) et par les tests Node (vm).
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
      numeroSerie: texte(e.numeroSerie, 60), note: texte(e.note, 500), archive: !!e.archive,
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
    return { version: 1, entreprise: '', familles: [], reglages: { ...reglages }, equipements: [], operations: [], releves: [], interventions: [], pieces: [], mouvementsPieces: [] };
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
    };
    e.equipements = (d.equipements || []).map(normaliserEquipement);
    e.operations = (d.operations || []).map(normaliserOperation);
    e.releves = (d.releves || []).map(normaliserReleve);
    e.interventions = (d.interventions || []).map(normaliserIntervention);
    e.pieces = (d.pieces || []).map(normaliserPiece);
    e.mouvementsPieces = (d.mouvementsPieces || []).map(normaliserMouvement);
    if (d.majLe) e.majLe = d.majLe;
    return e;
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
  function csvEcheancier(etat, auj) {
    const t = [['Repère', 'Équipement', 'Emplacement', 'Opération', 'Nature', 'Périodicité', 'Intervalle compteur', 'Dernière réalisation', 'Échéance date', 'Échéance compteur', 'Compteur actuel', 'Date estimée', 'État', 'Bon ouvert']];
    for (const e of echeances(etat, auj)) {
      t.push([e.eq?.repere || '', e.eq?.nom || '', e.eq?.emplacement || '', e.op.nom, e.op.nature, libellePeriode(e.op.p), e.op.c ?? '', e.derniere ? dateFr(e.derniere.dateRealisee) : '',
        dateFr(e.echDate), e.echCompteur ?? '', e.compteur ?? '', dateFr(e.dateEstimee), LIB_ETAT[e.etat], e.bon ? e.bon.numero : '']);
    }
    return versCsv(t);
  }
  function csvInterventions(etat) {
    const t = [['Numéro', 'Type', 'Statut', 'Repère', 'Équipement', 'Intitulé', 'Date prévue', 'Date réalisée', 'Compteur', 'Durée (h)', 'Intervenant', 'Main-d\'œuvre (€)', 'Pièces (€)', 'Sous-traitance (€)', 'Total (€)', 'Arrêt (h)', 'Constat']];
    const eqs = new Map(etat.equipements.map((e) => [e.id, e]));
    for (const i of [...etat.interventions].sort((a, b) => (a.dateRealisee || a.datePrevue || '').localeCompare(b.dateRealisee || b.datePrevue || ''))) {
      const c = coutBon(i, etat.reglages), eq = eqs.get(i.equipement);
      t.push([i.numero, TYPES_BON[i.type], STATUTS_BON[i.statut], eq?.repere || '', eq?.nom || '', i.titre, dateFr(i.datePrevue), dateFr(i.dateRealisee), i.compteur ?? '', i.duree ?? '', i.intervenant,
        eur(c.mainOeuvre), eur(c.pieces), eur(c.sousTraitance), eur(c.total), i.arret || '', i.constat || i.symptome]);
    }
    return versCsv(t);
  }
  function csvCouts(etat, auj) {
    const t = [['Repère', 'Équipement', 'Famille', 'Criticité', 'Préventif 12 mois (€)', 'Correctif 12 mois (€)', 'Total 12 mois (€)', 'Pannes 12 mois', 'Arrêt 12 mois (h)', 'Total depuis le début (€)']];
    for (const x of coutsParEquipement(etat, auj)) {
      const tout = coutsEquipement(etat, x.eq.id, null, auj);
      t.push([x.eq.repere, x.eq.nom, x.eq.famille, x.eq.criticite, eur(x.preventif), eur(x.correctif), eur(x.total), x.pannes, x.arret, eur(tout.total)]);
    }
    return versCsv(t);
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
