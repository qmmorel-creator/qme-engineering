// Vérifications réglementaires QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.VRF) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Moteur d'échéances commun aux templates
// d'échéances QME (entretien, visa) : dernière date + périodicité en mois (fin de mois bornée) ou en jours.
(function (racine) {
  'use strict';

  const B = racine.BASE || {};
  const STATUTS = ['retard', 'proche', 'inconnue', 'ok', 'inactif'];
  const LIB_STATUT = { retard: 'En retard', proche: 'À prévoir', inconnue: 'Date à renseigner', ok: 'À jour', inactif: 'Hors service' };
  const LIB_OBS = { retard: 'Levée en retard', proche: 'À lever bientôt', ouverte: 'À lever', levee: 'Levée' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const finMois = (s) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m, 0)); };
  // Ajoute n mois ; le 31 janvier + 1 mois donne le 28 (ou 29) février, jamais le 3 mars.
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12;
    const dernier = new Date(an, mo + 1, 0).getDate();
    return iso(new Date(an, mo, Math.min(j, dernier)));
  }
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Périodicités ----------
  const typeDe = (code) => (B.types || []).find((t) => t.code === code) || (B.types || []).find((t) => t.code === 'AUTRE') || { code: 'AUTRE', nom: 'Autre', nature: 'saisie' };
  // { mois } ou { jours } → texte.
  function libellePeriode(p) {
    if (!p) return 'Périodicité à saisir';
    if (p.jours) return p.jours % 7 === 0 ? `Toutes les ${p.jours / 7} semaines` : `Tous les ${p.jours} jours`;
    if (p.mois === 1) return 'Tous les mois';
    if (p.mois === 12) return 'Tous les ans';
    if (p.mois % 12 === 0) return `Tous les ${p.mois / 12} ans`;
    return `Tous les ${p.mois} mois`;
  }
  const dureeJours = (p) => (p ? (p.jours || Math.round(p.mois * 30.44)) : null);
  const avancer = (date, p) => (p.jours ? ajout(date, p.jours) : ajoutMois(date, p.mois));

  // Vérifications d'un équipement, de la plus récente à la plus ancienne.
  const verifsDe = (etat, eqId) => (etat.verifications || []).filter((v) => v.equipement === eqId && estDate(v.date)).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const obsDe = (etat, verifId) => (etat.observations || []).filter((o) => o.verification === verifId);

  // Délai de deux ans des installations électriques (arrêté du 26 décembre 2011, art. 3) : possible si le
  // dernier rapport ne présente aucune observation, ou si toutes ses observations ont été levées avant
  // l'échéance annuelle. Renvoie { ok, raison }.
  function allegementPossible(eq, etat) {
    const t = typeDe(eq.type);
    if (!t.allegeeMois) return { ok: false, raison: 'Ce type de contrôle n\'a pas de délai allongé.' };
    const v = verifsDe(etat, eq.id)[0];
    if (!v) return { ok: false, raison: 'Aucun rapport enregistré : le délai allongé suppose un rapport précédent.' };
    if (v.resultat === 'defavorable') return { ok: false, raison: 'Le dernier rapport est défavorable.' };
    const obs = obsDe(etat, v.id);
    if (!obs.length) return { ok: true, raison: 'Dernier rapport sans observation.' };
    const limite = ajoutMois(v.date, t.mois);
    const ouvertes = obs.filter((o) => o.statut !== 'levee');
    if (ouvertes.length) return { ok: false, raison: `${ouvertes.length} observation${ouvertes.length > 1 ? 's' : ''} du dernier rapport à lever.` };
    const tardives = obs.filter((o) => !estDate(o.leveeLe) || o.leveeLe > limite);
    if (tardives.length) return { ok: false, raison: 'Des observations ont été levées après l\'échéance annuelle.' };
    return { ok: true, raison: 'Toutes les observations du dernier rapport ont été levées avant l\'échéance.' };
  }

  // Périodicité appliquée : saisie par l'utilisateur (prioritaire), sinon celle de la base (allongée si
  // demandée et possible). origine : 'saisie' | 'base' | 'allegee' | null (inconnue).
  function periode(eq, etat) {
    const t = typeDe(eq.type);
    if (eq.periodeSaisie && (eq.periodeSaisie.mois > 0 || eq.periodeSaisie.jours > 0)) {
      const p = eq.periodeSaisie.jours > 0 ? { jours: eq.periodeSaisie.jours } : { mois: eq.periodeSaisie.mois };
      return { ...p, origine: 'saisie', type: t };
    }
    if (t.nature === 'saisie' || (!t.mois && !t.jours)) return null;
    if (eq.allegement && t.allegeeMois && allegementPossible(eq, etat).ok) return { mois: t.allegeeMois, origine: 'allegee', type: t };
    return { ...(t.jours ? { jours: t.jours } : { mois: t.mois }), origine: 'base', type: t };
  }

  // Date de référence : dernière vérification enregistrée, sinon la date du dernier rapport connu saisie
  // à la création de l'équipement.
  function derniere(eq, etat) {
    const v = verifsDe(etat, eq.id)[0];
    if (v && (!estDate(eq.derniereConnue) || v.date >= eq.derniereConnue)) return v.date;
    return estDate(eq.derniereConnue) ? eq.derniereConnue : null;
  }

  // Prochaine échéance : date fixée (rapport, mise en demeure) prioritaire, sinon dernière + périodicité.
  function prochaine(eq, etat) {
    if (estDate(eq.prochaineFixee)) return eq.prochaineFixee;
    const p = periode(eq, etat);
    const d = derniere(eq, etat);
    return p && d ? avancer(d, p) : null;
  }

  // Fenêtre d'alerte : celle des réglages, réduite au tiers de la périodicité pour les contrôles fréquents
  // (sinon un contrôle mensuel serait toujours « à prévoir »).
  function fenetre(p, alerteJours) {
    const d = dureeJours(p);
    return d ? Math.max(1, Math.min(alerteJours, Math.round(d / 3))) : alerteJours;
  }

  function statutEcheance(date, auj, jours) {
    if (!date) return 'inconnue';
    if (date < auj) return 'retard';
    if (ecart(auj, date) <= jours) return 'proche';
    return 'ok';
  }

  function statutObservation(o, auj, alerteJours = 15) {
    if (o.statut === 'levee') return 'levee';
    if (estDate(o.echeance) && o.echeance < auj) return 'retard';
    if (estDate(o.echeance) && ecart(auj, o.echeance) <= alerteJours) return 'proche';
    return 'ouverte';
  }

  function situation(eq, etat, auj) {
    const alerte = etat.reglages?.alerteJours ?? 45;
    const p = periode(eq, etat);
    const pro = prochaine(eq, etat);
    const obs = (etat.observations || []).filter((o) => o.equipement === eq.id);
    const ouvertes = obs.filter((o) => o.statut !== 'levee');
    const statut = eq.inactif ? 'inactif' : statutEcheance(pro, auj, fenetre(p, alerte));
    return {
      eq, type: typeDe(eq.type), periode: p, derniere: derniere(eq, etat), prochaine: pro, statut,
      jours: pro ? ecart(auj, pro) : null,
      sansPeriode: !p && !estDate(eq.prochaineFixee),
      verifications: verifsDe(etat, eq.id),
      obsOuvertes: ouvertes,
      obsRetard: ouvertes.filter((o) => statutObservation(o, auj) === 'retard'),
      allegement: typeDe(eq.type).allegeeMois ? allegementPossible(eq, etat) : null,
    };
  }

  const site = (etat, id) => (etat.sites || []).find((s) => s.id === id);
  const equipement = (etat, id) => (etat.equipements || []).find((e) => e.id === id);
  const ordreStatut = (s) => STATUTS.indexOf(s);
  const trierSituations = (liste) => liste.sort((a, b) => ordreStatut(a.statut) - ordreStatut(b.statut) || (a.prochaine || '9999').localeCompare(b.prochaine || '9999') || a.eq.nom.localeCompare(b.eq.nom));

  // Toutes les situations, filtrables par site.
  function situations(etat, auj, siteId = '') {
    return trierSituations((etat.equipements || []).filter((e) => !siteId || e.site === siteId).map((e) => situation(e, etat, auj)));
  }

  // Alertes : échéances dépassées, proches ou inconnues, puis observations en retard ou graves.
  function alertes(etat, auj) {
    const liste = [];
    for (const s of situations(etat, auj)) {
      if (s.statut === 'retard' || s.statut === 'proche' || s.statut === 'inconnue') liste.push({ genre: 'echeance', niveau: s.statut, date: s.prochaine, situation: s });
    }
    for (const o of etat.observations || []) {
      if (o.statut === 'levee') continue;
      const eq = equipement(etat, o.equipement);
      if (!eq || eq.inactif) continue;
      const st = statutObservation(o, auj);
      if (st === 'retard' || st === 'proche' || o.gravite === 'danger') liste.push({ genre: 'observation', niveau: st === 'retard' || o.gravite === 'danger' ? 'retard' : 'proche', date: o.echeance || null, observation: o, eq });
    }
    const poids = { retard: 0, proche: 1, inconnue: 2 };
    return liste.sort((a, b) => poids[a.niveau] - poids[b.niveau] || (a.date || '9999').localeCompare(b.date || '9999'));
  }

  // Indicateurs du tableau de bord (par site ou global).
  function synthese(etat, auj, siteId = '') {
    const sits = situations(etat, auj, siteId).filter((s) => s.statut !== 'inactif');
    const compte = (st) => sits.filter((s) => s.statut === st).length;
    const ids = new Set(sits.map((s) => s.eq.id));
    const obs = (etat.observations || []).filter((o) => ids.has(o.equipement));
    const ouvertes = obs.filter((o) => o.statut !== 'levee');
    // Délai moyen de levée sur 12 mois glissants (observations levées dans l'année).
    const depuis = ajoutMois(auj, -12);
    const levees = obs.filter((o) => o.statut === 'levee' && estDate(o.leveeLe) && o.leveeLe >= depuis && estDate(o.constateLe));
    const delai = levees.length ? Math.round(levees.reduce((t, o) => t + Math.max(0, ecart(o.constateLe, o.leveeLe)), 0) / levees.length) : null;
    const connus = sits.filter((s) => s.statut !== 'inconnue').length;
    return {
      nb: sits.length, retard: compte('retard'), proche: compte('proche'), inconnue: compte('inconnue'), ok: compte('ok'),
      tauxAJour: connus ? Math.round(((compte('ok') + compte('proche')) / connus) * 100) : null,
      obsOuvertes: ouvertes.length,
      obsRetard: ouvertes.filter((o) => statutObservation(o, auj) === 'retard').length,
      obsDanger: ouvertes.filter((o) => o.gravite === 'danger').length,
      delaiLevee: delai, nbLevees: levees.length,
    };
  }

  function parSite(etat, auj) {
    return (etat.sites || []).map((s) => ({ site: s, ...synthese(etat, auj, s.id) }));
  }

  // Échéances des mois à venir : les retards et dates inconnues à part, puis chaque mois (échéances
  // répétées pour les contrôles fréquents, à partir de la prochaine).
  function calendrier(etat, auj, nbMois = 12) {
    const debut = `${auj.slice(0, 7)}-01`;
    const fin = finMois(ajoutMois(debut, nbMois - 1));
    const mois = Array.from({ length: nbMois }, (_, i) => ({ mois: ajoutMois(debut, i).slice(0, 7), lignes: [] }));
    const retards = [], inconnues = [];
    for (const s of situations(etat, auj)) {
      if (s.statut === 'inactif') continue;
      if (!s.prochaine) { inconnues.push(s); continue; }
      let d = s.prochaine;
      if (d < auj) { retards.push(s); if (!s.periode) continue; d = avancer(auj, s.periode); }
      for (let i = 0; i < 400 && d <= fin; i++) {
        const m = mois.find((x) => x.mois === d.slice(0, 7));
        if (m && d >= debut) m.lignes.push({ date: d, situation: s, premiere: i === 0 && d === s.prochaine });
        if (!s.periode) break;
        d = avancer(d, s.periode);
      }
    }
    for (const m of mois) m.lignes.sort((a, b) => a.date.localeCompare(b.date) || a.situation.eq.nom.localeCompare(b.situation.eq.nom));
    return { retards, inconnues, mois };
  }

  // ---------- Saisie ----------
  // Lien de preuve : http(s) seulement (pas de javascript:, data:…), sinon vide. Renvoie null si illisible.
  function lireLien(saisie) {
    const s = String(saisie ?? '').trim();
    if (!s) return '';
    return /^https?:\/\/[^\s<>"'`]+$/i.test(s) && s.length <= 500 ? s : null;
  }
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);

  // Enregistre une vérification et ses observations. Renvoie la vérification, ou une chaîne d'erreur.
  function ajouterVerification(etat, donnees, auj, nouvel = nouvelId) {
    const eq = equipement(etat, donnees.equipement);
    if (!eq) return 'Cet équipement n\'existe plus.';
    if (!estDate(donnees.date)) return 'Indique la date de la vérification.';
    if (auj && donnees.date > auj) return 'La date ne peut pas être dans le futur.';
    const lien = lireLien(donnees.lien);
    if (lien === null) return 'Lien illisible : colle une adresse qui commence par https://';
    const resultat = (B.resultats || []).some((r) => r.id === donnees.resultat) ? donnees.resultat : 'conforme';
    const obs = (donnees.observations || []).map((o) => ({ ...o, texte: texte(o.texte, 400) })).filter((o) => o.texte);
    if (resultat === 'observations' && !obs.length) return 'Ajoute au moins une observation, ou choisis « Sans observation ».';
    const v = { id: nouvel(), equipement: eq.id, date: donnees.date, organisme: texte(donnees.organisme, 100), intervenant: texte(donnees.intervenant, 80), rapport: texte(donnees.rapport, 80), lien, resultat, note: texte(donnees.note, 400) };
    etat.verifications = [...(etat.verifications || []), v];
    const delais = etat.reglages?.levee || B.reglages?.levee || {};
    for (const o of obs) {
      const gravite = ['danger', 'majeure', 'mineure'].includes(o.gravite) ? o.gravite : 'majeure';
      etat.observations = [...(etat.observations || []), normaliserObservation({
        id: nouvel(), verification: v.id, equipement: eq.id, texte: o.texte, gravite, constateLe: v.date,
        echeance: estDate(o.echeance) ? o.echeance : ajout(v.date, delais[gravite] ?? 30), responsable: o.responsable, statut: 'ouverte',
      })];
    }
    if (eq.organisme === '' && v.organisme) eq.organisme = v.organisme;
    eq.prochaineFixee = estDate(donnees.prochaineFixee) ? donnees.prochaineFixee : null;
    return v;
  }

  // Lève une observation : date (pas dans le futur, pas avant le constat) et preuve (référence ou lien).
  function leverObservation(etat, id, { date, preuve = '', lien = '', note = '' } = {}, auj) {
    const o = (etat.observations || []).find((x) => x.id === id);
    if (!o) return 'Cette observation n\'existe plus.';
    if (!estDate(date)) return 'Indique la date de levée.';
    if (auj && date > auj) return 'La date de levée ne peut pas être dans le futur.';
    if (estDate(o.constateLe) && date < o.constateLe) return 'La levée ne peut pas précéder le constat.';
    const l = lireLien(lien);
    if (l === null) return 'Lien illisible : colle une adresse qui commence par https://';
    if (!texte(preuve, 120) && !l) return 'Note la preuve de la levée : référence de la facture, du bon d\'intervention ou un lien.';
    Object.assign(o, { statut: 'levee', leveeLe: date, preuve: texte(preuve, 120), lienPreuve: l, noteLevee: texte(note, 300) });
    return o;
  }

  function rouvrirObservation(etat, id) {
    const o = (etat.observations || []).find((x) => x.id === id);
    if (!o) return false;
    Object.assign(o, { statut: 'ouverte', leveeLe: null, preuve: '', lienPreuve: '', noteLevee: '' });
    return true;
  }

  function supprimerVerification(etat, id) {
    return { ...etat, verifications: (etat.verifications || []).filter((v) => v.id !== id), observations: (etat.observations || []).filter((o) => o.verification !== id) };
  }
  function supprimerEquipement(etat, id) {
    const verifs = new Set((etat.verifications || []).filter((v) => v.equipement === id).map((v) => v.id));
    return { ...etat, equipements: etat.equipements.filter((e) => e.id !== id), verifications: (etat.verifications || []).filter((v) => !verifs.has(v.id)), observations: (etat.observations || []).filter((o) => o.equipement !== id) };
  }
  function supprimerSite(etat, id) {
    let e = { ...etat, sites: etat.sites.filter((s) => s.id !== id) };
    for (const eq of etat.equipements.filter((x) => x.site === id)) e = supprimerEquipement(e, eq.id);
    return e;
  }

  // Lit une périodicité saisie : nombre + unité ('mois' | 'semaines' | 'jours'). null si vide, NaN si illisible.
  function lirePeriode(nombre, unite) {
    const s = String(nombre ?? '').trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    if (!Number.isInteger(n) || n < 1 || n > 240) return NaN;
    if (unite === 'jours') return n > 3650 ? NaN : { jours: n };
    if (unite === 'semaines') return { jours: n * 7 };
    return { mois: n };
  }

  // ---------- Normalisation ----------
  const normaliserSite = (s) => ({ id: String(s.id || nouvelId()), nom: texte(s.nom, 80) || 'Site', adresse: texte(s.adresse, 160), type: ['travail', 'erp', 'erp5', 'autre'].includes(s.type) ? s.type : 'travail', categorie: texte(s.categorie, 40), note: texte(s.note, 300) });
  function normaliserEquipement(e) {
    const p = e.periodeSaisie;
    const ps = p && (Number(p.mois) > 0 || Number(p.jours) > 0) ? (Number(p.jours) > 0 ? { jours: Math.round(Number(p.jours)) } : { mois: Math.round(Number(p.mois)) }) : null;
    return {
      id: String(e.id || nouvelId()), site: String(e.site || ''), nom: texte(e.nom, 100) || typeDe(e.type).nom, type: typeDe(e.type).code,
      localisation: texte(e.localisation, 100), reference: texte(e.reference, 60), organisme: texte(e.organisme, 100),
      derniereConnue: estDate(e.derniereConnue) ? e.derniereConnue : null, prochaineFixee: estDate(e.prochaineFixee) ? e.prochaineFixee : null,
      periodeSaisie: ps, allegement: !!e.allegement, inactif: !!e.inactif, note: texte(e.note, 400),
    };
  }
  const normaliserVerification = (v) => ({ id: String(v.id || nouvelId()), equipement: String(v.equipement || ''), date: estDate(v.date) ? v.date : null, organisme: texte(v.organisme, 100), intervenant: texte(v.intervenant, 80), rapport: texte(v.rapport, 80), lien: lireLien(v.lien) || '', resultat: ['conforme', 'observations', 'defavorable'].includes(v.resultat) ? v.resultat : 'conforme', note: texte(v.note, 400) });
  const normaliserObservation = (o) => ({
    id: String(o.id || nouvelId()), verification: String(o.verification || ''), equipement: String(o.equipement || ''), texte: texte(o.texte, 400) || 'Observation',
    gravite: ['danger', 'majeure', 'mineure'].includes(o.gravite) ? o.gravite : 'majeure', constateLe: estDate(o.constateLe) ? o.constateLe : null,
    echeance: estDate(o.echeance) ? o.echeance : null, responsable: texte(o.responsable, 80), statut: o.statut === 'levee' ? 'levee' : 'ouverte',
    leveeLe: o.statut === 'levee' && estDate(o.leveeLe) ? o.leveeLe : null, preuve: texte(o.preuve, 120), lienPreuve: lireLien(o.lienPreuve) || '', noteLevee: texte(o.noteLevee, 300),
  });

  function etatVide() {
    return { version: 1, structure: '', reglages: { alerteJours: B.reglages?.alerteJours ?? 45, levee: { ...(B.reglages?.levee || { danger: 7, majeure: 30, mineure: 90 }) } }, sites: [], equipements: [], verifications: [], observations: [] };
  }
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.structure = texte(d.structure, 80);
    const r = d.reglages || {};
    const a = Math.round(Number(r.alerteJours));
    if (a >= 7 && a <= 180) e.reglages.alerteJours = a;
    for (const g of ['danger', 'majeure', 'mineure']) { const n = Math.round(Number(r.levee?.[g])); if (n >= 0 && n <= 365) e.reglages.levee[g] = n; }
    e.sites = Array.isArray(d.sites) ? d.sites.map(normaliserSite) : [];
    const sites = new Set(e.sites.map((s) => s.id));
    e.equipements = Array.isArray(d.equipements) ? d.equipements.map(normaliserEquipement).filter((x) => sites.has(x.site)) : [];
    const eqs = new Set(e.equipements.map((x) => x.id));
    e.verifications = Array.isArray(d.verifications) ? d.verifications.map(normaliserVerification).filter((v) => v.date && eqs.has(v.equipement)) : [];
    const verifs = new Set(e.verifications.map((v) => v.id));
    e.observations = Array.isArray(d.observations) ? d.observations.map(normaliserObservation).filter((o) => eqs.has(o.equipement) && (!o.verification || verifs.has(o.verification))) : [];
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, formules neutralisées) ----------
  const champCsv = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const sourceCourte = (p) => (!p ? 'À saisir' : p.origine === 'saisie' ? 'Saisie par l\'utilisateur' : `INRS ED 828 p. ${p.type.page}${p.origine === 'allegee' ? ' (délai de 2 ans)' : ''}`);

  function versCsvRegistre(etat, auj, siteId = '') {
    const tete = ['Site', 'Équipement', 'Référence', 'Localisation', 'Type de contrôle', 'Périodicité', 'Source de la périodicité', 'Organisme', 'Dernière vérification', 'Rapport', 'Lien', 'Prochaine échéance', 'Statut', 'Observations à lever'];
    const l = situations(etat, auj, siteId).map((s) => {
      const v = s.verifications[0];
      return [site(etat, s.eq.site)?.nom || '', s.eq.nom, s.eq.reference, s.eq.localisation, s.type.nom, libellePeriode(s.periode), sourceCourte(s.periode), s.eq.organisme, s.derniere || '', v?.rapport || '', v?.lien || '', s.prochaine || '', LIB_STATUT[s.statut], s.obsOuvertes.length];
    });
    return csv([tete, ...l]);
  }
  function versCsvObservations(etat, auj) {
    const tete = ['Site', 'Équipement', 'Observation', 'Gravité', 'Constatée le', 'Rapport', 'À lever avant le', 'Responsable', 'Statut', 'Levée le', 'Preuve', 'Lien de la preuve'];
    const l = (etat.observations || []).map((o) => {
      const eq = equipement(etat, o.equipement) || {};
      const v = (etat.verifications || []).find((x) => x.id === o.verification) || {};
      return [site(etat, eq.site)?.nom || '', eq.nom || '', o.texte, o.gravite, o.constateLe || '', v.rapport || '', o.echeance || '', o.responsable, LIB_OBS[statutObservation(o, auj)], o.leveeLe || '', o.preuve, o.lienPreuve];
    });
    return csv([tete, ...l]);
  }

  racine.VRF = {
    STATUTS, LIB_STATUT, LIB_OBS,
    iso, versDate, estDate, ajout, ecart, finMois, ajoutMois, nouvelId,
    typeDe, libellePeriode, dureeJours, avancer, verifsDe, obsDe, allegementPossible, periode, derniere, prochaine, fenetre,
    statutEcheance, statutObservation, situation, situations, alertes, synthese, parSite, calendrier,
    lireLien, lirePeriode, ajouterVerification, leverObservation, rouvrirObservation, supprimerVerification, supprimerEquipement, supprimerSite,
    normaliserSite, normaliserEquipement, normaliserVerification, normaliserObservation, etatVide, normaliser,
    versCsvRegistre, versCsvObservations, sourceCourte,
  };
})(typeof window !== 'undefined' ? window : globalThis);
