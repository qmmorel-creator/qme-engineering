// ContrôleRéception · règles métier pures (aucun accès au DOM ni au stockage). window.RCP, testé par
// outils/templates/controle-reception.test.mjs.
// Statut calculé (dans cet ordre) :
//  1. « en attente » : pas de ligne, quantité reçue non comptée, ou point de contrôle applicable sans réponse ;
//  2. « non conforme » : point de contrôle critique non conforme, ou constat critique non levé ;
//  3. « conforme avec réserves » : écart de quantité hors tolérance, quantité refusée, point non critique
//     non conforme, ou constat (mineur, majeur, ou marqué en réserve) non levé ;
//  4. « conforme » sinon.
// La décision finale peut différer du statut calculé, avec un motif obligatoire.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const STATUTS = ['attente', 'conforme', 'reserves', 'nonconforme'];
  const LIB_STATUT = { attente: 'En attente', conforme: 'Conforme', reserves: 'Conforme avec réserves', nonconforme: 'Non conforme' };
  const RESULTATS = ['ok', 'nok', 'na'];

  // Liste complète des points d'une famille : points communs puis points propres.
  const pointsFamille = (famille) => [...B().communs.map((c) => ({ ...c, commun: true })), ...(famille?.controles || [])];

  // ---------- Quantités ----------
  // { etat: 'a-compter' | 'conforme' | 'tolere' | 'manquant' | 'excedent', ecart, pct, accepte, horsTolerance }
  function ecartLigne(l, tolerance) {
    if (l.qteRecue === null || l.qteRecue === undefined) return { etat: 'a-compter', ecart: null, pct: null, accepte: null, horsTolerance: false };
    const ecart = O.arrondi(l.qteRecue - l.qteCommandee, 4);
    const pct = l.qteCommandee > 0 ? O.arrondi((ecart / l.qteCommandee) * 100, 2) : (l.qteRecue > 0 ? null : 0);
    const refusee = Math.min(l.qteRefusee || 0, l.qteRecue);
    const accepte = O.arrondi(l.qteRecue - refusee, 4);
    const horsTolerance = ecart !== 0 && (pct === null || Math.abs(pct) > tolerance + 1e-9);
    const etat = ecart === 0 ? 'conforme' : !horsTolerance ? 'tolere' : ecart < 0 ? 'manquant' : 'excedent';
    return { etat, ecart, pct, accepte, refusee, horsTolerance };
  }
  const toleranceDe = (rec, famille) => rec.tolerance ?? famille?.tolerance ?? 0;

  // ---------- Contrôles ----------
  // Résultat effectif d'un point : une mesure saisie hors plage donne « non conforme » d'office.
  function resultatPoint(point, saisie) {
    const s = saisie || {};
    if (s.resultat === 'na') return 'na';
    if (point.type === 'mesure' && typeof s.valeur === 'number' && Number.isFinite(s.valeur)) {
      const basOk = point.min === null || point.min === undefined || s.valeur >= point.min;
      const hautOk = point.max === null || point.max === undefined || s.valeur <= point.max;
      return basOk && hautOk ? 'ok' : 'nok';
    }
    return RESULTATS.includes(s.resultat) ? s.resultat : null;
  }

  // ---------- Statut ----------
  function analyser(rec, famille) {
    const tol = toleranceDe(rec, famille);
    const lignes = rec.lignes.map((l) => ({ l, e: ecartLigne(l, tol) }));
    const points = pointsFamille(famille).map((p) => ({ p, r: resultatPoint(p, rec.controles[p.id]), saisie: rec.controles[p.id] || {} }));
    const actifs = rec.constats.filter((c) => !c.levee);
    const manque = [];
    if (!rec.lignes.length) manque.push('Aucune ligne de marchandise');
    const aCompter = lignes.filter((x) => x.e.etat === 'a-compter').length;
    if (aCompter) manque.push(`${aCompter} ligne${aCompter > 1 ? 's' : ''} à compter`);
    const sansReponse = points.filter((x) => x.r === null).length;
    if (sansReponse) manque.push(`${sansReponse} point${sansReponse > 1 ? 's' : ''} de contrôle sans réponse`);
    const anomalies = [];
    for (const { l, e } of lignes) {
      if (e.horsTolerance) anomalies.push({ niveau: 'reserves', type: 'quantitatif', texte: `${l.designation || l.ref || 'Ligne'} : ${e.ecart < 0 ? 'manquant' : 'excédent'} de ${O.fmtNombre(Math.abs(e.ecart), { dec: 3 })} ${l.unite}${e.pct !== null ? ` (${e.ecart > 0 ? '+' : ''}${O.fmtNombre(e.pct)} %, tolérance ${O.fmtNombre(tol)} %)` : ' (non commandé)'}` });
      if (e.refusee > 0) anomalies.push({ niveau: 'reserves', type: 'qualitatif', texte: `${l.designation || l.ref || 'Ligne'} : ${O.fmtNombre(e.refusee, { dec: 3 })} ${l.unite} refusé${e.refusee > 1 ? 's' : ''}` });
    }
    for (const { p, r, saisie } of points) {
      if (r !== 'nok') continue;
      const mesure = p.type === 'mesure' && typeof saisie.valeur === 'number' ? ` : ${O.fmtNombre(saisie.valeur)} ${p.unite || ''} (plage ${p.min ?? '…'} à ${p.max ?? '…'})` : '';
      anomalies.push({ niveau: p.critique ? 'nonconforme' : 'reserves', type: p.type === 'documentaire' ? 'documentaire' : 'qualitatif', texte: `${p.libelle}${mesure}${saisie.commentaire ? ` · ${saisie.commentaire}` : ''}`, critique: !!p.critique });
    }
    for (const c of actifs) anomalies.push({ niveau: c.gravite === 'critique' ? 'nonconforme' : 'reserves', type: c.type, texte: c.description, constat: c.id, gravite: c.gravite });
    let calcule;
    if (manque.length) calcule = 'attente';
    else if (anomalies.some((a) => a.niveau === 'nonconforme')) calcule = 'nonconforme';
    else if (anomalies.length) calcule = 'reserves';
    else calcule = 'conforme';
    const decision = rec.decision?.statut && rec.decision.statut !== 'attente' ? rec.decision.statut : null;
    return {
      tolerance: tol, lignes, points, manque, anomalies, calcule,
      statut: decision || calcule, decisionDiffere: !!decision && decision !== calcule,
      reservesActives: rec.constats.filter((c) => c.reserve && !c.levee).length,
      repondus: points.filter((x) => x.r !== null).length, nbPoints: points.length,
    };
  }

  // ---------- Décision ----------
  // Une décision différente du statut calculé exige un motif ; « en attente » ne se décide pas.
  function validerDecision(statutDecide, calcule, motif) {
    if (!STATUTS.includes(statutDecide) || statutDecide === 'attente') return 'Choisis conforme, conforme avec réserves ou non conforme.';
    if (calcule === 'attente') return 'Termine d\'abord le comptage et les contrôles (statut en attente).';
    if (statutDecide !== calcule && !O.texte(motif)) return `Le statut calculé est « ${LIB_STATUT[calcule].toLowerCase()} » : explique pourquoi tu décides autrement.`;
    return null;
  }

  // ---------- Numérotation ----------
  function prochainNumero(receptions, annee) {
    const max = receptions.reduce((m, r) => { const x = /^REC-(\d{4})-(\d{4,})$/.exec(r.numero); return x && Number(x[1]) === annee ? Math.max(m, Number(x[2])) : m; }, 0);
    return `REC-${annee}-${String(max + 1).padStart(4, '0')}`;
  }

  // ---------- Historique et fournisseurs ----------
  function statistiques(e) {
    const familleDe = (id) => e.familles.find((f) => f.id === id);
    const res = e.receptions.map((r) => ({ r, a: analyser(r, familleDe(r.familleId)) }));
    const parFournisseur = e.fournisseurs.map((f) => {
      const ls = res.filter((x) => x.r.fournisseurId === f.id && x.a.statut !== 'attente');
      const n = (s) => ls.filter((x) => x.a.statut === s).length;
      return { id: f.id, nom: f.nom, total: ls.length, conforme: n('conforme'), reserves: n('reserves'), nonconforme: n('nonconforme'),
        taux: ls.length ? O.arrondi((n('conforme') / ls.length) * 100, 1) : null, constats: ls.reduce((s, x) => s + x.r.constats.length, 0) };
    }).filter((x) => x.total || res.some((y) => y.r.fournisseurId === x.id)).sort((a, b) => (a.taux ?? 101) - (b.taux ?? 101) || b.total - a.total);
    const compte = (s) => res.filter((x) => x.a.statut === s).length;
    return {
      total: res.length, attente: compte('attente'), conforme: compte('conforme'), reserves: compte('reserves'), nonconforme: compte('nonconforme'),
      reservesNonLevees: res.flatMap((x) => x.r.constats.filter((c) => !c.levee && (c.reserve || c.gravite !== 'mineure')).map((c) => ({ reception: x.r, constat: c }))),
      parFournisseur, analyses: res,
    };
  }

  // ---------- Normalisation ----------
  const num = (v, min, max) => { const n = typeof v === 'number' ? v : O.lireNombre(v, { negatif: min < 0 }); return n !== null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
  function normaliserPoint(p) {
    p = p && typeof p === 'object' ? p : {};
    const type = O.choix(p.type, ['visuel', 'documentaire', 'mesure'], 'visuel');
    const min = type === 'mesure' ? num(p.min, -1e6, 1e6) : null;
    let max = type === 'mesure' ? num(p.max, -1e6, 1e6) : null;
    if (min !== null && max !== null && max < min) max = null;
    return { id: O.idValide(p.id), libelle: O.texte(p.libelle, 160) || 'Point de contrôle', type, critique: !!p.critique, unite: type === 'mesure' ? O.texte(p.unite, 12) : '', min, max, aide: O.texte(p.aide, 200) };
  }
  function normaliserFamille(f) {
    f = f && typeof f === 'object' ? f : {};
    return { id: O.idValide(f.id), nom: O.texte(f.nom, 80) || 'Famille', tolerance: num(f.tolerance, 0, 100) ?? 0, controles: O.tableau(f.controles).slice(0, 40).map(normaliserPoint), perso: !!f.perso };
  }
  const famillesInitiales = () => B().familles.map((f) => normaliserFamille(structuredClone(f)));
  function normaliserPhoto(ph) {
    return ph && typeof ph.data === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ph.data) ? { id: O.idValide(ph.id), data: ph.data, legende: O.texte(ph.legende, 120) } : null;
  }
  function normaliserReception(r, familles) {
    r = r && typeof r === 'object' ? r : {};
    const lignes = O.tableau(r.lignes).slice(0, 500).map((l) => {
      l = l && typeof l === 'object' ? l : {};
      const recue = num(l.qteRecue, 0, 1e9);
      return { id: O.idValide(l.id), ref: O.texte(l.ref, 60), designation: O.texte(l.designation, 160), unite: O.texte(l.unite, 20) || 'u', qteCommandee: num(l.qteCommandee, 0, 1e9) ?? 0, qteRecue: recue, qteRefusee: recue === null ? 0 : Math.min(recue, num(l.qteRefusee, 0, 1e9) ?? 0), lot: O.texte(l.lot, 60) };
    });
    const ids = new Set(lignes.map((l) => l.id));
    const controles = {};
    for (const [k, v] of Object.entries(r.controles && typeof r.controles === 'object' ? r.controles : {})) {
      if (!/^[\w-]{1,40}$/.test(k) || !v || typeof v !== 'object') continue;
      controles[k] = { resultat: RESULTATS.includes(v.resultat) ? v.resultat : null, valeur: num(v.valeur, -1e6, 1e6), commentaire: O.texte(v.commentaire, 300) };
    }
    const decisionStatut = O.choix(r.decision?.statut, STATUTS, null);
    return {
      id: O.idValide(r.id), numero: O.texte(r.numero, 30) || 'REC', date: O.dateOuNull(r.date) || O.iso(new Date()), heure: /^\d{2}:\d{2}$/.test(r.heure || '') ? r.heure : '',
      fournisseurId: O.texte(r.fournisseurId, 40) || null, commande: O.texte(r.commande, 60), bl: O.texte(r.bl, 60), transporteur: O.texte(r.transporteur, 80), receptionnaire: O.texte(r.receptionnaire, 80),
      familleId: familles.some((f) => f.id === r.familleId) ? r.familleId : (familles.find((f) => f.id === 'generique')?.id || familles[0]?.id || null),
      tolerance: num(r.tolerance, 0, 100), lignes, controles,
      constats: O.tableau(r.constats).slice(0, 200).map((c) => ({
        id: O.idValide(c?.id), type: O.choix(c?.type, B().typesConstat.map((x) => x.id), 'qualitatif'), gravite: O.choix(c?.gravite, B().gravites.map((x) => x.id), 'mineure'),
        description: O.texte(c?.description, 600) || 'Constat sans description', ligneId: ids.has(c?.ligneId) ? c.ligneId : null, reserve: !!c?.reserve,
        photos: O.tableau(c?.photos).slice(0, 6).map(normaliserPhoto).filter(Boolean),
        levee: c?.levee && O.dateOuNull(c.levee.date) ? { date: c.levee.date, commentaire: O.texte(c.levee.commentaire, 300) } : null,
      })),
      decision: decisionStatut && decisionStatut !== 'attente' ? { statut: decisionStatut, motif: O.texte(r.decision.motif, 400), par: O.texte(r.decision.par, 80), le: O.dateOuNull(r.decision.le) } : null,
      cloturee: !!r.cloturee, observations: O.texte(r.observations, 1500),
    };
  }
  const etatVide = () => ({ version: 1, reglages: { societe: '', receptionnaire: '' }, fournisseurs: [], familles: famillesInitiales(), receptions: [], receptionActive: null });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const familles = Array.isArray(d.familles) && d.familles.length ? d.familles.slice(0, 60).map(normaliserFamille) : v.familles;
    const fournisseurs = O.tableau(d.fournisseurs).slice(0, 500).map((f) => ({ id: O.idValide(f?.id), nom: O.texte(f?.nom, 100) || 'Fournisseur', contact: O.texte(f?.contact, 160), note: O.texte(f?.note, 300) }));
    const receptions = O.tableau(d.receptions).slice(0, 2000).map((r) => normaliserReception(r, familles));
    receptions.forEach((r) => { if (r.fournisseurId && !fournisseurs.some((f) => f.id === r.fournisseurId)) r.fournisseurId = null; });
    return {
      ...d, version: 1, reglages: { societe: O.texte(d.reglages?.societe, 120), receptionnaire: O.texte(d.reglages?.receptionnaire, 80) },
      familles, fournisseurs, receptions, receptionActive: receptions.some((r) => r.id === d.receptionActive) ? d.receptionActive : (receptions[0]?.id ?? null),
    };
  }

  // ---------- Exports CSV ----------
  function csvReceptions(e) {
    const nomF = (id) => e.fournisseurs.find((f) => f.id === id)?.nom || '';
    const fam = (id) => e.familles.find((f) => f.id === id);
    const rows = [['N°', 'Date', 'Heure', 'Fournisseur', 'Commande', 'Bon de livraison', 'Transporteur', 'Réceptionnaire', 'Famille', 'Statut calculé', 'Décision', 'Motif de la décision', 'Lignes', 'Anomalies', 'Constats', 'Réserves non levées', 'Clôturée', 'Observations']];
    for (const r of e.receptions) {
      const a = analyser(r, fam(r.familleId));
      rows.push([r.numero, r.date, r.heure, nomF(r.fournisseurId), r.commande, r.bl, r.transporteur, r.receptionnaire, fam(r.familleId)?.nom || '', LIB_STATUT[a.calcule], r.decision ? LIB_STATUT[r.decision.statut] : '', r.decision?.motif || '', r.lignes.length, a.anomalies.length, r.constats.length, a.reservesActives, r.cloturee ? 'oui' : 'non', r.observations]);
    }
    return rows;
  }
  function csvLignes(e) {
    const fam = (id) => e.familles.find((f) => f.id === id);
    const rows = [['N° réception', 'Date', 'Référence', 'Désignation', 'Lot', 'Unité', 'Commandé', 'Reçu', 'Refusé', 'Accepté', 'Écart', 'Écart (%)', 'Tolérance (%)', 'État']];
    const LIB = { 'a-compter': 'À compter', conforme: 'Conforme', tolere: 'Dans la tolérance', manquant: 'Manquant', excedent: 'Excédent' };
    for (const r of e.receptions) {
      const tol = toleranceDe(r, fam(r.familleId));
      for (const l of r.lignes) {
        const x = ecartLigne(l, tol);
        rows.push([r.numero, r.date, l.ref, l.designation, l.lot, l.unite, O.nombreCsv(l.qteCommandee, 3), O.nombreCsv(l.qteRecue, 3), O.nombreCsv(l.qteRefusee, 3), O.nombreCsv(x.accepte, 3), O.nombreCsv(x.ecart, 3), O.nombreCsv(x.pct, 2), O.nombreCsv(tol, 2), LIB[x.etat]]);
      }
    }
    return rows;
  }
  function csvConstats(e) {
    const rows = [['N° réception', 'Date', 'Type', 'Gravité', 'Description', 'Ligne', 'Réserve', 'Photos', 'Levée le', 'Commentaire de levée']];
    for (const r of e.receptions) for (const c of r.constats) {
      const l = r.lignes.find((x) => x.id === c.ligneId);
      rows.push([r.numero, r.date, B().typesConstat.find((t) => t.id === c.type)?.nom, B().gravites.find((g) => g.id === c.gravite)?.nom, c.description, l ? (l.designation || l.ref) : '', c.reserve ? 'oui' : 'non', c.photos.length, c.levee?.date || '', c.levee?.commentaire || '']);
    }
    return rows;
  }

  racine.RCP = {
    STATUTS, LIB_STATUT, RESULTATS, pointsFamille, ecartLigne, toleranceDe, resultatPoint, analyser, validerDecision, prochainNumero, statistiques,
    normaliserPoint, normaliserFamille, famillesInitiales, normaliserReception, etatVide, normaliser, csvReceptions, csvLignes, csvConstats,
  };
})(typeof window !== 'undefined' ? window : globalThis);
