// Document unique d'évaluation des risques QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.DRP) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; montants en centimes.
(function (racine) {
  'use strict';

  const B = racine.BASE || {};
  const SEUILS = B.seuils || { annuel: 11, programme: 50 };
  const LIB_ACTION = { 'a-faire': 'À faire', 'en-cours': 'En cours', faite: 'Faite', abandonnee: 'Abandonnée', retard: 'En retard', proche: 'Échéance proche' };

  // ---------- Dates et nombres ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12;
    const dernier = new Date(an, mo + 1, 0).getDate();
    return iso(new Date(an, mo, Math.min(j, dernier)));
  }
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max = 400) => String(v ?? '').trim().slice(0, max);
  const dateOu = (v) => (estDate(v) ? v : null);
  // « 1 200,50 € » → 120050 ; vide → null ; illisible → NaN.
  function lireMontant(v) {
    const s = String(v ?? '').replace(/[\s €]/g, '').replace(',', '.');
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(Number(s) * 100);
  }
  const euros = (c) => (c === null || c === undefined ? '–' : `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`);

  // ---------- Grille de cotation ----------
  // Grille : { gravite: [libellés], probabilite: [libellés], seuils: { p1, p2 } } ; 3 à 5 niveaux par axe.
  function normaliserGrille(g) {
    const d = B.grille || { gravite: ['1', '2', '3', '4'], probabilite: ['1', '2', '3', '4'], seuils: { p1: 9, p2: 4 } };
    const axe = (l, def) => {
      const x = Array.isArray(l) ? l.map((v) => texte(v, 120)).filter(Boolean) : def.slice();
      return x.length >= 3 && x.length <= 5 ? x : def.slice();
    };
    const gravite = axe(g?.gravite, d.gravite);
    const probabilite = axe(g?.probabilite, d.probabilite);
    const max = gravite.length * probabilite.length;
    let p1 = Number(g?.seuils?.p1), p2 = Number(g?.seuils?.p2);
    if (!Number.isInteger(p1) || p1 < 2 || p1 > max) p1 = Math.min(d.seuils.p1, max);
    if (!Number.isInteger(p2) || p2 < 2 || p2 >= p1) p2 = Math.min(d.seuils.p2, p1 - 1);
    return { gravite, probabilite, seuils: { p1, p2 } };
  }
  const niveau = (n, max) => (Number.isInteger(n) && n >= 1 && n <= max ? n : null);
  const score = (g, p) => (g && p ? g * p : null);
  // Priorité 1 (élevé), 2 (moyen), 3 (faible) selon les seuils ; null si non coté.
  function priorite(s, grille) {
    if (!s) return null;
    if (s >= grille.seuils.p1) return 1;
    if (s >= grille.seuils.p2) return 2;
    return 3;
  }
  // Cotation d'un risque : initiale (sans mesures) et résiduelle (avec les mesures en place, par défaut
  // égale à l'initiale). La priorité se calcule sur la résiduelle.
  function cotation(r, grille) {
    const initial = score(r.g, r.p);
    const resSaisi = !!(r.gr && r.pr);
    const residuel = resSaisi ? score(r.gr, r.pr) : initial;
    return { initial, residuel, resSaisi, priorite: priorite(residuel, grille), prioriteInitiale: priorite(initial, grille), reduction: initial && residuel ? initial - residuel : 0, aCoter: !initial };
  }

  // ---------- Normalisation ----------
  function normaliserUnite(u) {
    return { id: String(u?.id || nouvelId()), nom: texte(u?.nom, 100) || 'Unité de travail', type: ['poste', 'lieu', 'activite'].includes(u?.type) ? u.type : 'poste', description: texte(u?.description, 400), effectif: Number.isInteger(Number(u?.effectif)) && Number(u.effectif) >= 0 && u?.effectif !== '' && u?.effectif !== null ? Number(u.effectif) : null };
  }
  function normaliserRisque(r, grille) {
    const G = grille.gravite.length, P = grille.probabilite.length;
    const famille = (B.familles || []).some((f) => f.code === r?.famille) ? r.famille : 'AUTRE';
    const x = {
      id: String(r?.id || nouvelId()), unite: String(r?.unite || ''), famille,
      danger: texte(r?.danger, 300), consequences: texte(r?.consequences, 300), mesures: texte(r?.mesures, 600),
      g: niveau(Number(r?.g), G), p: niveau(Number(r?.p), P), gr: niveau(Number(r?.gr), G), pr: niveau(Number(r?.pr), P),
      exposes: Number.isInteger(Number(r?.exposes)) && Number(r.exposes) > 0 ? Number(r.exposes) : null,
      evalueLe: dateOu(r?.evalueLe), note: texte(r?.note, 400),
    };
    if (!x.gr || !x.pr) { x.gr = null; x.pr = null; }
    return x;
  }
  function normaliserAction(a) {
    const statut = ['a-faire', 'en-cours', 'faite', 'abandonnee'].includes(a?.statut) ? a.statut : 'a-faire';
    const cout = Number.isInteger(a?.cout) && a.cout >= 0 ? a.cout : null;
    return {
      id: String(a?.id || nouvelId()), risque: String(a?.risque || ''), intitule: texte(a?.intitule, 300) || 'Action',
      type: (B.typesMesure || []).some((t) => t.id === a?.type) ? a.type : 'organisation',
      responsable: texte(a?.responsable, 80), echeance: dateOu(a?.echeance), cout, statut,
      faiteLe: statut === 'faite' ? (dateOu(a?.faiteLe) || dateOu(a?.echeance)) : null,
      indicateur: texte(a?.indicateur, 200), note: texte(a?.note, 400), creeLe: dateOu(a?.creeLe),
    };
  }
  function normaliserEvenement(e) {
    return { id: String(e?.id || nouvelId()), date: dateOu(e?.date), type: (B.evenements || []).some((x) => x.id === e?.type) ? e.type : 'autre', texte: texte(e?.texte, 300) };
  }
  function normaliserEntreprise(e) {
    const eff = Number(e?.effectif);
    return {
      nom: texte(e?.nom, 100), activite: texte(e?.activite, 160), secteur: (B.secteurs || []).some((s) => s.id === e?.secteur) ? e.secteur : 'autre',
      effectif: Number.isInteger(eff) && eff >= 0 ? eff : null, adresse: texte(e?.adresse, 200), responsable: texte(e?.responsable, 100),
      participants: texte(e?.participants, 400), acces: texte(e?.acces, 600), annexe: texte(e?.annexe, 1500),
    };
  }
  // Instantané figé d'une version : tout ce qu'il faut pour réimprimer le document tel qu'il était.
  const instantane = (etat) => JSON.parse(JSON.stringify({ entreprise: etat.entreprise, grille: etat.grille, unites: etat.unites, risques: etat.risques, actions: etat.actions }));
  function normaliserVersion(v) {
    return {
      id: String(v?.id || nouvelId()), numero: Number.isInteger(v?.numero) && v.numero > 0 ? v.numero : 1, date: dateOu(v?.date),
      motif: (B.motifs || []).some((m) => m.id === v?.motif) ? v.motif : 'autre', resume: texte(v?.resume, 800), participants: texte(v?.participants, 400),
      contenu: v?.contenu && typeof v.contenu === 'object' ? v.contenu : null,
    };
  }

  function etatVide() {
    return {
      v: 1, entreprise: normaliserEntreprise({}), grille: normaliserGrille(B.grille),
      reglages: { ...(B.reglages || { alerteJours: 30, revueMois: 12 }) },
      unites: [], risques: [], actions: [], evenements: [], versions: [],
    };
  }
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.entreprise = normaliserEntreprise(d.entreprise);
    e.grille = normaliserGrille(d.grille);
    const r = d.reglages || {};
    const ent = (v, min, max, def) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max && v !== '' && v !== null ? Number(v) : def);
    e.reglages = { alerteJours: ent(r.alerteJours, 7, 120, e.reglages.alerteJours), revueMois: ent(r.revueMois, 3, 36, e.reglages.revueMois) };
    e.unites = (Array.isArray(d.unites) ? d.unites : []).map(normaliserUnite);
    const ids = new Set(e.unites.map((u) => u.id));
    e.risques = (Array.isArray(d.risques) ? d.risques : []).map((x) => normaliserRisque(x, e.grille)).filter((x) => ids.has(x.unite));
    const rids = new Set(e.risques.map((x) => x.id));
    e.actions = (Array.isArray(d.actions) ? d.actions : []).map(normaliserAction).filter((a) => rids.has(a.risque));
    e.evenements = (Array.isArray(d.evenements) ? d.evenements : []).map(normaliserEvenement).filter((x) => x.date);
    e.versions = (Array.isArray(d.versions) ? d.versions : []).map(normaliserVersion).filter((v) => v.date).sort((a, b) => a.numero - b.numero);
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // Change le nombre de niveaux de la grille : les cotations au-delà du nouveau maximum sont ramenées au maximum.
  function changerGrille(etat, grille) {
    const g = normaliserGrille(grille);
    etat.grille = g;
    const G = g.gravite.length, P = g.probabilite.length;
    let ajustes = 0;
    for (const r of etat.risques) {
      for (const [k, m] of [['g', G], ['p', P], ['gr', G], ['pr', P]]) if (r[k] && r[k] > m) { r[k] = m; ajustes++; }
    }
    return ajustes;
  }

  // ---------- Accès ----------
  const unite = (etat, id) => etat.unites.find((u) => u.id === id);
  const risque = (etat, id) => etat.risques.find((r) => r.id === id);
  const famille = (code) => (B.familles || []).find((f) => f.code === code) || { code: 'AUTRE', nom: 'Autre risque', situations: [], mesures: [] };
  const actionsDe = (etat, risqueId) => etat.actions.filter((a) => a.risque === risqueId);
  const nomRisque = (r) => r.danger || famille(r.famille).nom;

  // ---------- Actions ----------
  function statutAction(a, auj, alerteJours = 30) {
    if (a.statut === 'faite' || a.statut === 'abandonnee') return a.statut;
    if (a.echeance && a.echeance < auj) return 'retard';
    if (a.echeance && ecart(auj, a.echeance) <= alerteJours) return 'proche';
    return a.statut;
  }
  const ouverte = (a) => a.statut === 'a-faire' || a.statut === 'en-cours';

  // ---------- Effectif et obligations ----------
  const tranche = (eff) => (eff === null || eff === undefined ? null : eff < SEUILS.annuel ? 'moins11' : eff < SEUILS.programme ? '11a49' : '50plus');
  function obligations(eff) {
    return (B.obligations || []).filter((o) => (eff === null || eff === undefined) ? true : (o.min === undefined || eff >= o.min) && (o.max === undefined || eff <= o.max));
  }
  const annuelleObligatoire = (eff) => Number.isInteger(eff) && eff >= SEUILS.annuel;
  const programmeObligatoire = (eff) => Number.isInteger(eff) && eff >= SEUILS.programme;

  // ---------- Versions ----------
  const derniereVersion = (etat) => etat.versions.reduce((m, v) => (!m || v.numero > m.numero ? v : m), null);
  // Prochaine mise à jour : obligatoire (≥ 11 salariés : un an après la dernière version), sinon revue
  // conseillée selon le réglage (choix de l'entreprise, pas une obligation).
  function prochaineMaj(etat, auj) {
    const v = derniereVersion(etat);
    const eff = etat.entreprise.effectif;
    const obligatoire = annuelleObligatoire(eff);
    if (!v) return { date: null, obligatoire, aucune: true, jours: null };
    const date = obligatoire ? ajoutMois(v.date, 12) : ajoutMois(v.date, etat.reglages.revueMois);
    return { date, obligatoire, aucune: false, jours: ecart(auj, date) };
  }
  // Modifications depuis un instantané : unités, risques et actions ajoutés, supprimés ou modifiés.
  function differences(avant, apres) {
    const cmp = (a, b, cle) => {
      const ia = new Map((a || []).map((x) => [x.id, JSON.stringify(x)]));
      const ib = new Map((b || []).map((x) => [x.id, JSON.stringify(x)]));
      let ajoutes = 0, supprimes = 0, modifies = 0;
      for (const [id, s] of ib) { if (!ia.has(id)) ajoutes++; else if (ia.get(id) !== s) modifies++; }
      for (const id of ia.keys()) if (!ib.has(id)) supprimes++;
      return { ajoutes, supprimes, modifies, cle };
    };
    const av = avant || {};
    const faitesAvant = new Set((av.actions || []).filter((a) => a.statut === 'faite').map((a) => a.id));
    const terminees = (apres.actions || []).filter((a) => a.statut === 'faite' && !faitesAvant.has(a.id)).length;
    const d = {
      unites: cmp(av.unites, apres.unites, 'unites'), risques: cmp(av.risques, apres.risques, 'risques'), actions: cmp(av.actions, apres.actions, 'actions'),
      terminees,
      entreprise: !!avant && JSON.stringify(av.entreprise || null) !== JSON.stringify(apres.entreprise || null),
      grille: !!avant && JSON.stringify(av.grille || null) !== JSON.stringify(apres.grille || null),
    };
    d.total = ['unites', 'risques', 'actions'].reduce((s, k) => s + d[k].ajoutes + d[k].supprimes + d[k].modifies, 0) + (d.entreprise ? 1 : 0) + (d.grille ? 1 : 0);
    return d;
  }
  function resumeDifferences(d) {
    if (!d.total) return 'Aucune modification depuis la version précédente : document relu et confirmé.';
    const p = (n, s, pl) => `${n} ${n > 1 ? (pl || `${s}s`) : s}`;
    const morceaux = [];
    const lib = { unites: ['unité de travail', 'unités de travail'], risques: ['risque', 'risques'], actions: ['action', 'actions'] };
    for (const k of ['unites', 'risques', 'actions']) {
      const x = d[k];
      const l = [];
      if (x.ajoutes) l.push(`${p(x.ajoutes, k !== 'risques' ? 'ajoutée' : 'ajouté', k !== 'risques' ? 'ajoutées' : 'ajoutés')}`);
      if (x.modifies) l.push(`${p(x.modifies, k !== 'risques' ? 'modifiée' : 'modifié', k !== 'risques' ? 'modifiées' : 'modifiés')}`);
      if (x.supprimes) l.push(`${p(x.supprimes, k !== 'risques' ? 'supprimée' : 'supprimé', k !== 'risques' ? 'supprimées' : 'supprimés')}`);
      if (l.length) morceaux.push(`${lib[k][1][0].toUpperCase()}${lib[k][1].slice(1)} : ${l.join(', ')}`);
    }
    if (d.terminees) morceaux.push(`${p(d.terminees, 'action réalisée', 'actions réalisées')}`);
    if (d.grille) morceaux.push('grille de cotation modifiée');
    if (d.entreprise) morceaux.push('informations de l\'entreprise mises à jour');
    return `${morceaux.join(' ; ')}.`;
  }
  const modificationsNonArchivees = (etat) => differences(derniereVersion(etat)?.contenu || null, instantane(etat));
  // Archive une nouvelle version (instantané figé) ; renvoie la version ou un message d'erreur.
  function archiver(etat, { date, motif, resume, participants } = {}, auj, fabriqueId = nouvelId) {
    if (!estDate(date)) return 'Date de la mise à jour illisible.';
    if (date > auj) return 'La mise à jour ne peut pas être datée dans le futur.';
    const der = derniereVersion(etat);
    if (der && date < der.date) return `La version précédente est datée du ${der.date.split('-').reverse().join('/')} : choisis une date égale ou postérieure.`;
    if (!etat.unites.length) return 'Ajoute au moins une unité de travail avant d\'archiver.';
    const d = modificationsNonArchivees(etat);
    const v = normaliserVersion({ id: fabriqueId(), numero: (der?.numero || 0) + 1, date, motif: motif || (der ? 'annuelle' : 'creation'), resume: texte(resume, 800) || resumeDifferences(d), participants: participants ?? etat.entreprise.participants, contenu: instantane(etat) });
    etat.versions.push(v);
    return v;
  }
  const conservationJusquau = (date) => ajoutMois(date, 480); // 40 ans
  // Événements survenus après la dernière version : ils appellent une mise à jour.
  function evenementsEnAttente(etat) {
    const v = derniereVersion(etat);
    return etat.evenements.filter((e) => !v || e.date > v.date).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- Synthèses ----------
  function risquesCotes(etat) {
    return etat.risques.map((r) => ({ r, c: cotation(r, etat.grille), u: unite(etat, r.unite) }));
  }
  const ordreRisques = (a, b) => (a.c.aCoter - b.c.aCoter) || ((a.c.priorite || 9) - (b.c.priorite || 9)) || ((b.c.residuel || 0) - (a.c.residuel || 0)) || nomRisque(a.r).localeCompare(nomRisque(b.r), 'fr');

  function synthese(etat, auj) {
    const rc = risquesCotes(etat);
    const parPrio = { 1: 0, 2: 0, 3: 0 };
    let aCoter = 0;
    for (const x of rc) { if (x.c.aCoter) aCoter++; else parPrio[x.c.priorite]++; }
    const actives = etat.actions.filter((a) => a.statut !== 'abandonnee');
    const faites = actives.filter((a) => a.statut === 'faite');
    const enRetard = etat.actions.filter((a) => statutAction(a, auj, etat.reglages.alerteJours) === 'retard');
    const sansAction = rc.filter((x) => x.c.priorite === 1 && !actionsDe(etat, x.r.id).some(ouverte));
    const coutPrevu = etat.actions.filter(ouverte).reduce((s, a) => s + (a.cout || 0), 0);
    const coutRealise = faites.reduce((s, a) => s + (a.cout || 0), 0);
    const reduits = rc.filter((x) => x.c.resSaisi && x.c.reduction > 0).length;
    return {
      unites: etat.unites.length, risques: rc.length, parPrio, aCoter, actions: etat.actions.length, ouvertes: etat.actions.filter(ouverte).length,
      faites: faites.length, tauxFaites: actives.length ? Math.round((faites.length / actives.length) * 100) : null,
      enRetard: enRetard.length, sansAction: sansAction.length, coutPrevu, coutRealise, reduits,
      unitesSansRisque: etat.unites.filter((u) => !etat.risques.some((r) => r.unite === u.id)).length,
    };
  }
  // Matrice gravité × probabilité (résiduelle) : nombre de risques par case.
  function matrice(etat, uniteId = '') {
    const G = etat.grille.gravite.length, P = etat.grille.probabilite.length;
    const m = Array.from({ length: G }, () => Array(P).fill(0));
    for (const r of etat.risques) {
      if (uniteId && r.unite !== uniteId) continue;
      const g = r.gr || r.g, p = r.pr || r.p;
      if (g && p) m[g - 1][p - 1]++;
    }
    return m;
  }
  function parUnite(etat, auj) {
    return etat.unites.map((u) => {
      const rc = risquesCotes(etat).filter((x) => x.r.unite === u.id);
      const n = { 1: 0, 2: 0, 3: 0, coter: 0 };
      for (const x of rc) { if (x.c.aCoter) n.coter++; else n[x.c.priorite]++; }
      const ids = new Set(rc.map((x) => x.r.id));
      const acts = etat.actions.filter((a) => ids.has(a.risque));
      return { unite: u, nb: rc.length, n, ouvertes: acts.filter(ouverte).length, retard: acts.filter((a) => statutAction(a, auj, etat.reglages.alerteJours) === 'retard').length };
    });
  }

  // Alertes de mise à jour et de suivi, de la plus urgente à la moins urgente.
  // niveau : 'retard' (rouge), 'proche' (jaune), 'info' (ciel).
  function alertes(etat, auj) {
    const l = [];
    const eff = etat.entreprise.effectif;
    const pm = prochaineMaj(etat, auj);
    if (pm.aucune) l.push({ genre: 'version', niveau: etat.unites.length ? 'proche' : 'info', titre: 'Aucune version archivée', detail: 'Archive la première version datée du document unique quand l\'évaluation est faite.' });
    else if (pm.obligatoire && pm.jours < 0) l.push({ genre: 'maj', niveau: 'retard', titre: 'Mise à jour annuelle dépassée', detail: `Due depuis le ${pm.date.split('-').reverse().join('/')} (au moins une fois par an dès 11 salariés).`, date: pm.date });
    else if (pm.obligatoire && pm.jours <= etat.reglages.alerteJours) l.push({ genre: 'maj', niveau: 'proche', titre: 'Mise à jour annuelle à prévoir', detail: `Avant le ${pm.date.split('-').reverse().join('/')} (au moins une fois par an dès 11 salariés).`, date: pm.date });
    else if (!pm.obligatoire && pm.jours <= 0) l.push({ genre: 'maj', niveau: 'info', titre: 'Revue conseillée', detail: `Dernière version de plus de ${etat.reglages.revueMois} mois : relis le document (revue choisie par l'entreprise, pas une obligation annuelle sous 11 salariés).`, date: pm.date });
    if (eff === null) l.push({ genre: 'effectif', niveau: 'info', titre: 'Effectif à renseigner', detail: 'Il détermine la mise à jour annuelle (dès 11 salariés) et le programme annuel de prévention (dès 50).' });
    for (const e of evenementsEnAttente(etat)) l.push({ genre: 'evenement', niveau: 'retard', titre: 'Mise à jour à faire après un événement', detail: `${(B.evenements || []).find((x) => x.id === e.type)?.nom || 'Événement'} le ${e.date.split('-').reverse().join('/')}${e.texte ? ` : ${e.texte}` : ''}`, date: e.date, id: e.id });
    for (const a of etat.actions) {
      const st = statutAction(a, auj, etat.reglages.alerteJours);
      if (st === 'retard') l.push({ genre: 'action', niveau: 'retard', titre: a.intitule, detail: `Action en retard depuis le ${a.echeance.split('-').reverse().join('/')}${a.responsable ? ` · ${a.responsable}` : ''}`, date: a.echeance, id: a.id });
      else if (st === 'proche') l.push({ genre: 'action', niveau: 'proche', titre: a.intitule, detail: `Échéance le ${a.echeance.split('-').reverse().join('/')}${a.responsable ? ` · ${a.responsable}` : ''}`, date: a.echeance, id: a.id });
    }
    for (const x of risquesCotes(etat)) {
      if (x.c.priorite === 1 && !actionsDe(etat, x.r.id).some(ouverte)) l.push({ genre: 'sans-action', niveau: 'retard', titre: nomRisque(x.r), detail: `Priorité 1 sans action en cours · ${x.u?.nom || ''}`, id: x.r.id });
    }
    const aCoter = etat.risques.filter((r) => !r.g || !r.p).length;
    if (aCoter) l.push({ genre: 'coter', niveau: 'info', titre: `${aCoter} risque${aCoter > 1 ? 's' : ''} à coter`, detail: 'Gravité et probabilité à renseigner pour obtenir la priorité.' });
    for (const u of etat.unites) if (!etat.risques.some((r) => r.unite === u.id)) l.push({ genre: 'unite', niveau: 'info', titre: u.nom, detail: 'Unité de travail sans risque évalué.', id: u.id });
    if (programmeObligatoire(eff)) {
      const inc = etat.actions.filter((a) => ouverte(a) && (!a.echeance || a.cout === null || !a.indicateur)).length;
      if (inc) l.push({ genre: 'programme', niveau: 'info', titre: 'Programme annuel incomplet', detail: `${inc} action${inc > 1 ? 's' : ''} sans échéance, coût ou indicateur de résultat (attendus dès 50 salariés).` });
    }
    const nv = derniereVersion(etat) ? modificationsNonArchivees(etat) : null;
    if (nv && nv.total) l.push({ genre: 'non-archive', niveau: 'info', titre: 'Modifications non archivées', detail: `${nv.total} modification${nv.total > 1 ? 's' : ''} depuis la version ${derniereVersion(etat).numero} : archive une nouvelle version pour les dater.` });
    const ordre = { retard: 0, proche: 1, info: 2 };
    return l.sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || (a.date || '9999').localeCompare(b.date || '9999'));
  }

  // Plan d'actions trié : ouvertes par échéance (sans date à la fin), puis faites, puis abandonnées.
  function planActions(etat, auj) {
    const rang = { retard: 0, proche: 1, 'en-cours': 2, 'a-faire': 2, faite: 3, abandonnee: 4 };
    return etat.actions.map((a) => ({ a, st: statutAction(a, auj, etat.reglages.alerteJours), r: risque(etat, a.risque) }))
      .map((x) => ({ ...x, u: x.r ? unite(etat, x.r.unite) : null, c: x.r ? cotation(x.r, etat.grille) : null }))
      .sort((x, y) => rang[x.st] - rang[y.st] || (x.st === 'faite' ? (y.a.faiteLe || '').localeCompare(x.a.faiteLe || '') : (x.a.echeance || '9999').localeCompare(y.a.echeance || '9999')) || ((x.c?.priorite || 9) - (y.c?.priorite || 9)));
  }
  // Programme d'une année : actions dont l'échéance tombe dans l'année, coûts prévus.
  function programme(etat, annee) {
    const l = etat.actions.filter((a) => a.statut !== 'abandonnee' && a.echeance && a.echeance.startsWith(String(annee)));
    return { actions: l, cout: l.reduce((s, a) => s + (a.cout || 0), 0), sansCout: l.filter((a) => a.cout === null).length, sansIndicateur: l.filter((a) => !a.indicateur).length };
  }

  // Marque une action faite ; renvoie l'action ou un message.
  function terminerAction(etat, id, date, auj) {
    const a = etat.actions.find((x) => x.id === id);
    if (!a) return 'Action introuvable.';
    if (!estDate(date)) return 'Date illisible.';
    if (date > auj) return 'La date de réalisation ne peut pas être dans le futur.';
    a.statut = 'faite'; a.faiteLe = date;
    return a;
  }

  // Suppressions en cascade.
  function supprimerUnite(etat, id) {
    const rids = new Set(etat.risques.filter((r) => r.unite === id).map((r) => r.id));
    etat.unites = etat.unites.filter((u) => u.id !== id);
    etat.risques = etat.risques.filter((r) => !rids.has(r.id));
    etat.actions = etat.actions.filter((a) => !rids.has(a.risque));
    return etat;
  }
  function supprimerRisque(etat, id) {
    etat.risques = etat.risques.filter((r) => r.id !== id);
    etat.actions = etat.actions.filter((a) => a.risque !== id);
    return etat;
  }
  // Démarrage : crée les unités choisies d'un secteur avec leurs risques à examiner (non cotés).
  function creerDepuisSecteur(etat, secteurId, nomsUnites, fabriqueId = nouvelId) {
    const s = (B.secteurs || []).find((x) => x.id === secteurId);
    if (!s) return 0;
    let n = 0;
    for (const u of s.unites.filter((x) => !nomsUnites || nomsUnites.includes(x.nom))) {
      const nu = normaliserUnite({ id: fabriqueId(), nom: u.nom, type: u.type });
      etat.unites.push(nu);
      for (const [fam, danger] of u.risques) { etat.risques.push(normaliserRisque({ id: fabriqueId(), unite: nu.id, famille: fam, danger }, etat.grille)); n++; }
    }
    return n;
  }

  // ---------- Exports CSV ----------
  const cel = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => `﻿${lignes.map((l) => l.map(cel).join(';')).join('\r\n')}`;
  function versCsvRisques(etat) {
    const tete = ['Unité de travail', 'Famille de risque', 'Situation dangereuse', 'Conséquences possibles', 'Personnes exposées', 'Gravité initiale', 'Probabilité initiale', 'Score initial', 'Mesures en place', 'Gravité résiduelle', 'Probabilité résiduelle', 'Score résiduel', 'Priorité', 'Actions ouvertes', 'Évalué le'];
    const l = risquesCotes(etat).sort((a, b) => etat.unites.indexOf(a.u) - etat.unites.indexOf(b.u) || ordreRisques(a, b)).map(({ r, c, u }) => [u?.nom || '', famille(r.famille).nom, r.danger, r.consequences, r.exposes ?? '', r.g ?? '', r.p ?? '', c.initial ?? '', r.mesures, r.gr ?? r.g ?? '', r.pr ?? r.p ?? '', c.residuel ?? '', c.priorite ? `Priorité ${c.priorite}` : 'À coter', actionsDe(etat, r.id).filter(ouverte).length, r.evalueLe || '']);
    return csv([tete, ...l]);
  }
  function versCsvActions(etat, auj) {
    const tete = ['Action', 'Type de mesure', 'Risque', 'Unité de travail', 'Priorité du risque', 'Responsable', 'Échéance', 'Coût estimé (€)', 'Indicateur de résultat', 'Statut', 'Réalisée le'];
    const l = planActions(etat, auj).map(({ a, st, r, u, c }) => [a.intitule, (B.typesMesure || []).find((t) => t.id === a.type)?.nom || '', r ? nomRisque(r) : '', u?.nom || '', c?.priorite ? `Priorité ${c.priorite}` : '', a.responsable, a.echeance || '', a.cout === null ? '' : (a.cout / 100).toFixed(2).replace('.', ','), a.indicateur, LIB_ACTION[st], a.faiteLe || '']);
    return csv([tete, ...l]);
  }

  racine.DRP = {
    SEUILS, LIB_ACTION,
    iso, versDate, estDate, ajout, ecart, ajoutMois, nouvelId, lireMontant, euros,
    normaliserGrille, score, priorite, cotation, changerGrille,
    normaliserUnite, normaliserRisque, normaliserAction, normaliserEvenement, normaliserEntreprise, normaliserVersion, etatVide, normaliser, instantane,
    unite, risque, famille, actionsDe, nomRisque, statutAction, ouverte,
    tranche, obligations, annuelleObligatoire, programmeObligatoire,
    derniereVersion, prochaineMaj, differences, resumeDifferences, modificationsNonArchivees, archiver, conservationJusquau, evenementsEnAttente,
    risquesCotes, ordreRisques, synthese, matrice, parUnite, alertes, planActions, programme, terminerAction,
    supprimerUnite, supprimerRisque, creerDepuisSecteur, versCsvRisques, versCsvActions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
