// Matrice compétences et formations QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.FRM) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Niveaux : entiers de 0 à max (échelle).
(function (racine) {
  'use strict';

  const SOURCES = ['manager', 'auto', 'entretien', 'formation', 'observation'];
  const STATUTS_FORMATION = ['envisagee', 'validee', 'realisee', 'annulee'];
  const MODALITES = ['interne', 'externe', 'distance', 'tutorat'];
  const MAX_POSSIBLES = [3, 4, 5];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecartJours = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Ajoute n mois (fin de mois bornée : 31 janvier + 1 mois → 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const cible = new Date(a, m - 1 + n, 1);
    const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
    cible.setDate(Math.min(j, dernier));
    return iso(cible);
  }

  // ---------- Données minimales ----------
  // « camille durand » → « Camille D. » ; « Inès » → « Inès » ; des initiales « C. D. » restent « C. D. ».
  function nomMinimal(saisie) {
    const mots = String(saisie ?? '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    if (!mots.length) return '';
    const cap = (m) => m.split('-').map((x) => x.charAt(0).toLocaleUpperCase('fr') + x.slice(1).toLocaleLowerCase('fr')).join('-');
    const prenom = cap(mots[0]).slice(0, 30);
    if (mots.length === 1) return prenom;
    const lettre = mots.slice(1).join('').replace(/[^\p{L}]/gu, '').charAt(0).toLocaleUpperCase('fr');
    return lettre ? `${prenom} ${lettre}.` : prenom;
  }

  // ---------- Échelle ----------
  const borner = (n, max) => Math.min(max, Math.max(0, Math.round(Number(n) || 0)));
  // Échelle de max + 1 niveaux ; libellés repris de « base » quand ils existent.
  function echelleDe(max, libelles = [], base = []) {
    const m = MAX_POSSIBLES.includes(Number(max)) ? Number(max) : 4;
    return Array.from({ length: m + 1 }, (_, n) => {
      const l = libelles[n] || base[n] || {};
      return { n, nom: String(l.nom || `Niveau ${n}`).trim().slice(0, 30), desc: String(l.desc || '').trim().slice(0, 120) };
    });
  }

  // ---------- Niveaux, exigences, écarts ----------
  // Évaluations les plus récentes d'abord (date, puis ordre de saisie).
  const triEval = (a, b) => b.date.localeCompare(a.date) || (b.ordre || 0) - (a.ordre || 0);
  function historique(evaluations, pid, cid = null) {
    return evaluations.filter((e) => e.personneId === pid && (cid === null || e.competenceId === cid)).sort(triEval);
  }
  // Niveau actuel = dernière évaluation (null si jamais évaluée).
  function derniere(evaluations, pid, cid) {
    let m = null;
    for (const e of evaluations) if (e.personneId === pid && e.competenceId === cid && (!m || triEval(e, m) < 0)) m = e;
    return m;
  }
  // Index { pid: { cid: évaluation } } pour la matrice (un seul parcours des évaluations).
  function indexDernieres(evaluations) {
    const idx = {};
    for (const e of evaluations) {
      const p = (idx[e.personneId] ||= {});
      if (!p[e.competenceId] || triEval(e, p[e.competenceId]) < 0) p[e.competenceId] = e;
    }
    return idx;
  }
  const requis = (etat, p, cid) => {
    const poste = etat.postes.find((x) => x.id === p.posteId);
    return poste ? (poste.requis[cid] || 0) : 0;
  };

  // Cellule de la matrice : ok (niveau requis atteint), ecart, nonEvalue (requis mais jamais évalué),
  // libre (non requis par le poste : niveau éventuel affiché sans écart).
  function cellule(etat, p, cid, auj, idx = null) {
    const ev = idx ? idx[p.id]?.[cid] || null : derniere(etat.evaluations, p.id, cid);
    const r = requis(etat, p, cid);
    const actuel = ev ? ev.niveau : null;
    const ecart = r ? Math.max(0, r - (actuel ?? 0)) : 0;
    let statut = 'libre';
    if (r) statut = actuel === null ? 'nonEvalue' : ecart ? 'ecart' : 'ok';
    const ancienne = Boolean(ev && auj && ajoutMois(ev.date, etat.reglages.reevaluationMois) <= auj);
    return { actuel, date: ev ? ev.date : null, requis: r, ecart, statut, ancienne, surplus: r && actuel !== null ? Math.max(0, actuel - r) : 0 };
  }

  // Exigences d'une personne (compétences requises par son poste), les plus gros écarts d'abord.
  function exigences(etat, p, auj, idx = null) {
    const poste = etat.postes.find((x) => x.id === p.posteId);
    if (!poste) return [];
    const comp = new Map(etat.competences.map((c) => [c.id, c]));
    return Object.keys(poste.requis).filter((cid) => comp.has(cid) && poste.requis[cid] > 0)
      .map((cid) => ({ competence: comp.get(cid), ...cellule(etat, p, cid, auj, idx) }))
      .sort((a, b) => b.ecart - a.ecart || Number(b.competence.critique) - Number(a.competence.critique) || a.competence.nom.localeCompare(b.competence.nom, 'fr'));
  }

  // Taux de couverture des exigences : satisfaites ÷ requises (non évaluée = non satisfaite).
  function conformite(etat, personnes, auj, idx = indexDernieres(etat.evaluations)) {
    let total = 0, ok = 0, ecarts = 0, points = 0, nonEvalues = 0;
    for (const p of personnes) {
      for (const x of exigences(etat, p, auj, idx)) {
        total++;
        if (x.statut === 'ok') ok++;
        else { ecarts++; points += x.ecart; if (x.statut === 'nonEvalue') nonEvalues++; }
      }
    }
    return { total, ok, ecarts, points, nonEvalues, pct: total ? Math.round((ok / total) * 100) : null };
  }

  // Niveau de référence d'une compétence : le plus haut niveau requis par un poste, sinon le réglage.
  function niveauReference(etat, cid) {
    const n = Math.max(0, ...etat.postes.map((p) => p.requis[cid] || 0));
    return n || etat.reglages.niveauReference;
  }
  // Couverture (« bus factor ») : personnes au niveau de référence ou au-dessus.
  function couverture(etat, cid, idx = indexDernieres(etat.evaluations)) {
    const ref = niveauReference(etat, cid);
    const titulaires = etat.personnes.filter((p) => (idx[p.id]?.[cid]?.niveau ?? -1) >= ref);
    const concernees = etat.personnes.filter((p) => requis(etat, p, cid) > 0);
    return { reference: ref, nb: titulaires.length, titulaires, concernees: concernees.length };
  }
  // Compétences fragiles : marquées critiques (ou requises par au moins un poste occupé, si « toutes » est demandé)
  // dont moins de « seuilCouverture » personnes ont le niveau de référence. Les moins couvertes d'abord.
  function fragiles(etat, { inclureRequises = false } = {}, idx = indexDernieres(etat.evaluations)) {
    const occupees = new Set(etat.personnes.map((p) => p.posteId));
    const requisesOccupees = new Set(etat.postes.filter((p) => occupees.has(p.id)).flatMap((p) => Object.keys(p.requis).filter((k) => p.requis[k] > 0)));
    return etat.competences.filter((c) => c.critique || (inclureRequises && requisesOccupees.has(c.id)))
      .map((c) => ({ competence: c, ...couverture(etat, c.id, idx) }))
      .filter((x) => x.nb < etat.reglages.seuilCouverture)
      .sort((a, b) => a.nb - b.nb || b.concernees - a.concernees || a.competence.nom.localeCompare(b.competence.nom, 'fr'));
  }

  // ---------- Plan de formation ----------
  // realisee, annulee, aDater (pas de date), aConfirmer (date passée, ni réalisée ni annulée), aVenir.
  function statutFormation(f, auj) {
    if (f.statut === 'realisee' || f.statut === 'annulee') return f.statut;
    if (!f.date) return 'aDater';
    return f.date < auj ? 'aConfirmer' : 'aVenir';
  }
  const anneeDe = (f) => (f.date ? Number(f.date.slice(0, 4)) : null);
  // Budget d'une année : prévu (tout sauf annulé), engagé (validé + réalisé), réalisé, restant = budget − engagé.
  function budget(etat, annee) {
    const r = { annee, budget: Number(etat.reglages.budgets[String(annee)]) || 0, prevu: 0, engage: 0, realise: 0, heures: 0, nb: 0, sansCout: 0 };
    for (const f of etat.formations) {
      if (anneeDe(f) !== annee || f.statut === 'annulee') continue;
      r.nb++;
      r.prevu += f.cout;
      if (!f.cout) r.sansCout++;
      if (f.statut === 'validee' || f.statut === 'realisee') r.engage += f.cout;
      if (f.statut === 'realisee') { r.realise += f.cout; r.heures += f.duree; }
    }
    r.restant = r.budget - r.engage;
    r.depasse = r.budget > 0 && r.prevu > r.budget;
    return r;
  }
  // Écarts sans action : exigence non atteinte sans formation en cours (envisagée ou validée) pour la même compétence.
  function ecartsSansAction(etat, auj, idx = indexDernieres(etat.evaluations)) {
    const prevues = new Set(etat.formations.filter((f) => f.statut === 'envisagee' || f.statut === 'validee').map((f) => `${f.personneId}|${f.competenceId}`));
    const l = [];
    for (const p of etat.personnes) {
      for (const x of exigences(etat, p, auj, idx)) {
        if (x.statut === 'ok' || prevues.has(`${p.id}|${x.competence.id}`)) continue;
        l.push({ personne: p, ...x });
      }
    }
    return l.sort((a, b) => Number(b.competence.critique) - Number(a.competence.critique) || b.ecart - a.ecart || a.personne.nom.localeCompare(b.personne.nom, 'fr'));
  }
  // Formation réalisée : l'évaluation « après formation » à ajouter (null si aucun niveau après n'est donné).
  function evaluationApres(f, date, ordre) {
    if (f.niveauApres === null || f.niveauApres === undefined || !f.competenceId) return null;
    return { id: nouvelId(), personneId: f.personneId, competenceId: f.competenceId, niveau: f.niveauApres, date, source: 'formation', note: f.intitule.slice(0, 120), formationId: f.id, ordre };
  }

  // Réévaluations dues : exigences évaluées dont la dernière évaluation date de plus de « reevaluationMois » mois.
  function aReevaluer(etat, auj, idx = indexDernieres(etat.evaluations)) {
    const l = [];
    for (const p of etat.personnes) {
      for (const x of exigences(etat, p, auj, idx)) if (x.ancienne) l.push({ personne: p, ...x });
    }
    return l.sort((a, b) => a.date.localeCompare(b.date) || a.personne.nom.localeCompare(b.personne.nom, 'fr'));
  }

  function indicateurs(etat, auj) {
    const idx = indexDernieres(etat.evaluations);
    const c = conformite(etat, etat.personnes, auj, idx);
    const annee = Number(auj.slice(0, 4));
    const f = etat.formations.map((x) => statutFormation(x, auj));
    return {
      personnes: etat.personnes.length,
      equipes: new Set(etat.personnes.map((p) => p.equipe).filter(Boolean)).size,
      conformite: c,
      fragiles: fragiles(etat, {}, idx).length,
      aVenir: f.filter((s) => s === 'aVenir').length,
      aConfirmer: f.filter((s) => s === 'aConfirmer').length,
      sansAction: ecartsSansAction(etat, auj, idx).length,
      aReevaluer: aReevaluer(etat, auj, idx).length,
      budget: budget(etat, annee),
    };
  }

  // Taux et écarts d'une personne.
  function bilanPersonne(etat, p, auj, idx = null) {
    const ex = exigences(etat, p, auj, idx);
    const ok = ex.filter((x) => x.statut === 'ok').length;
    return { total: ex.length, ok, ecarts: ex.length - ok, nonEvalues: ex.filter((x) => x.statut === 'nonEvalue').length, pct: ex.length ? Math.round((ok / ex.length) * 100) : null, points: ex.reduce((s, x) => s + x.ecart, 0) };
  }

  // Changement d'échelle : niveaux évalués, requis et visés ramenés dans [0, max].
  function appliquerEchelle(etat, max, libelles, base) {
    etat.reglages.echelle = echelleDe(max, libelles, base);
    const m = etat.reglages.echelle.length - 1;
    for (const e of etat.evaluations) e.niveau = borner(e.niveau, m);
    for (const p of etat.postes) for (const k of Object.keys(p.requis)) p.requis[k] = borner(p.requis[k], m);
    for (const f of etat.formations) {
      if (f.niveauVise !== null) f.niveauVise = borner(f.niveauVise, m);
      if (f.niveauApres !== null) f.niveauApres = borner(f.niveauApres, m);
    }
    etat.reglages.niveauReference = Math.min(m, etat.reglages.niveauReference);
    return etat;
  }

  // Suppression d'une compétence : retirée des postes, ses évaluations et le lien des formations effacés.
  function retirerCompetence(etat, cid) {
    etat.competences = etat.competences.filter((c) => c.id !== cid);
    for (const p of etat.postes) delete p.requis[cid];
    etat.evaluations = etat.evaluations.filter((e) => e.competenceId !== cid);
    for (const f of etat.formations) if (f.competenceId === cid) { f.competenceId = null; f.niveauVise = null; f.niveauApres = null; }
    return etat;
  }
  // Effacement d'une personne (départ) : sa fiche, ses évaluations et ses formations.
  function retirerPersonne(etat, pid) {
    etat.personnes = etat.personnes.filter((p) => p.id !== pid);
    etat.evaluations = etat.evaluations.filter((e) => e.personneId !== pid);
    etat.formations = etat.formations.filter((f) => f.personneId !== pid);
    return etat;
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const montant = (v) => { const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, n);
  const niveauOuNull = (v, max) => (v === null || v === undefined || v === '' ? null : borner(v, max));

  const normaliserDomaine = (x) => ({ id: String(x?.id || nouvelId()), nom: texte(x?.nom, 60) || 'Domaine' });
  function normaliserCompetence(x, domaines) {
    const c = x && typeof x === 'object' ? x : {};
    const dom = domaines.some((d) => d.id === c.domaineId) ? c.domaineId : domaines[0]?.id || null;
    return { id: String(c.id || nouvelId()), domaineId: dom, nom: texte(c.nom, 90) || 'Compétence', desc: texte(c.desc, 200), critique: Boolean(c.critique) };
  }
  function normaliserPoste(x, competences, max) {
    const p = x && typeof x === 'object' ? x : {};
    const ids = new Set(competences.map((c) => c.id));
    const requis = {};
    for (const [k, v] of Object.entries(p.requis && typeof p.requis === 'object' ? p.requis : {})) {
      const n = borner(v, max);
      if (ids.has(k) && n > 0) requis[k] = n;
    }
    return { id: String(p.id || nouvelId()), nom: texte(p.nom, 70) || 'Poste', requis };
  }
  function normaliserPersonne(x, postes) {
    const p = x && typeof x === 'object' ? x : {};
    return {
      id: String(p.id || nouvelId()),
      nom: nomMinimal(p.nom) || 'Sans nom',
      posteId: postes.some((q) => q.id === p.posteId) ? p.posteId : null,
      equipe: texte(p.equipe, 50),
      entree: dateOuNull(p.entree),
      note: texte(p.note, 200),
    };
  }
  function normaliserEvaluation(x, max) {
    const e = x && typeof x === 'object' ? x : {};
    return { id: String(e.id || nouvelId()), personneId: String(e.personneId || ''), competenceId: String(e.competenceId || ''), niveau: borner(e.niveau, max), date: dateOuNull(e.date) || '2000-01-01', source: SOURCES.includes(e.source) ? e.source : 'manager', note: texte(e.note, 160), formationId: e.formationId ? String(e.formationId) : null, ordre: entier(e.ordre, 0, 1e12, 0) };
  }
  function normaliserFormation(x, max) {
    const f = x && typeof x === 'object' ? x : {};
    const statut = STATUTS_FORMATION.includes(f.statut) ? f.statut : 'envisagee';
    return {
      id: String(f.id || nouvelId()),
      intitule: texte(f.intitule, 120) || 'Formation',
      personneId: String(f.personneId || ''),
      competenceId: f.competenceId ? String(f.competenceId) : null,
      modalite: MODALITES.includes(f.modalite) ? f.modalite : 'externe',
      organisme: texte(f.organisme, 80),
      date: dateOuNull(f.date),
      duree: Math.min(2000, montant(f.duree)),
      cout: Math.min(1e7, montant(f.cout)),
      statut,
      niveauVise: niveauOuNull(f.niveauVise, max),
      niveauApres: statut === 'realisee' ? niveauOuNull(f.niveauApres, max) : null,
      note: texte(f.note, 200),
    };
  }

  const reglagesVides = (base) => ({ echelle: echelleDe(4, [], base.echelle || []), seuilCouverture: 2, niveauReference: 3, reevaluationMois: 12, budgets: {} });
  // État de départ : référentiel de la base (domaines choisis), postes choisis, aucune personne.
  function etatVide(base, { domaines = null, postes = null } = {}) {
    const doms = base.domaines.filter((d) => !domaines || domaines.includes(d.id)).map((d) => ({ id: d.id, nom: d.nom }));
    const ids = new Set(doms.map((d) => d.id));
    const comps = base.domaines.filter((d) => ids.has(d.id)).flatMap((d) => d.competences.map((c) => ({ id: c.id, domaineId: d.id, nom: c.nom, desc: c.desc || '', critique: Boolean(c.critique) })));
    const cids = new Set(comps.map((c) => c.id));
    const pts = base.postes.filter((p) => !postes || postes.includes(p.id)).map((p) => ({ id: p.id, nom: p.nom, requis: Object.fromEntries(Object.entries(p.requis).filter(([k]) => cids.has(k))) }));
    return { version: 1, entreprise: '', reglages: reglagesVides(base), domaines: doms, competences: comps, postes: pts, personnes: [], evaluations: [], formations: [] };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const r = d.reglages && typeof d.reglages === 'object' ? d.reglages : {};
    const echelle = Array.isArray(r.echelle) && r.echelle.length ? echelleDe(r.echelle.length - 1, r.echelle, base.echelle) : v.reglages.echelle;
    const max = echelle.length - 1;
    const budgets = {};
    for (const [a, m] of Object.entries(r.budgets && typeof r.budgets === 'object' ? r.budgets : {})) if (/^\d{4}$/.test(a) && montant(m)) budgets[a] = montant(m);
    const domaines = Array.isArray(d.domaines) ? d.domaines.map(normaliserDomaine) : v.domaines;
    const competences = (Array.isArray(d.competences) ? d.competences : v.competences).map((c) => normaliserCompetence(c, domaines));
    const postes = (Array.isArray(d.postes) ? d.postes : v.postes).map((p) => normaliserPoste(p, competences, max));
    const personnes = (Array.isArray(d.personnes) ? d.personnes : []).map((p) => normaliserPersonne(p, postes));
    const pids = new Set(personnes.map((p) => p.id));
    const cids = new Set(competences.map((c) => c.id));
    return {
      ...v, ...d,
      entreprise: texte(d.entreprise, 60),
      reglages: {
        echelle,
        seuilCouverture: entier(r.seuilCouverture, 1, 20, 2),
        niveauReference: entier(r.niveauReference, 1, max, Math.min(3, max)),
        reevaluationMois: entier(r.reevaluationMois, 1, 60, 12),
        budgets,
      },
      domaines, competences, postes, personnes,
      evaluations: (Array.isArray(d.evaluations) ? d.evaluations : []).map((e) => normaliserEvaluation(e, max)).filter((e) => pids.has(e.personneId) && cids.has(e.competenceId)),
      formations: (Array.isArray(d.formations) ? d.formations : []).map((f) => normaliserFormation(f, max)).filter((f) => pids.has(f.personneId)).map((f) => (f.competenceId && !cids.has(f.competenceId) ? { ...f, competenceId: null } : f)),
    };
  }

  // ---------- Exports ----------
  const LIB_STATUT = { envisagee: 'Envisagée', validee: 'Validée', realisee: 'Réalisée', annulee: 'Annulée', aConfirmer: 'À confirmer', aVenir: 'À venir', aDater: 'À dater' };
  const LIB_SOURCE = { manager: 'Évaluation du manager', auto: 'Auto-évaluation', entretien: 'Entretien professionnel', formation: 'Après formation', observation: 'Observation en situation' };
  const LIB_MODALITE = { interne: 'Formation interne', externe: 'Organisme externe', distance: 'À distance', tutorat: 'Tutorat, compagnonnage' };
  const LIB_CELLULE = { ok: 'Atteint', ecart: 'Écart', nonEvalue: 'Non évalué', libre: 'Non requis' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  const nombreFr = (n) => String(n).replace('.', ',');
  const nomPoste = (etat, id) => etat.postes.find((p) => p.id === id)?.nom || '';
  const nomComp = (etat, id) => etat.competences.find((c) => c.id === id)?.nom || '';
  const nomDomaine = (etat, id) => etat.domaines.find((d) => d.id === id)?.nom || '';
  // Une ligne par personne et par compétence requise ou évaluée.
  function versCsvMatrice(etat, auj) {
    const idx = indexDernieres(etat.evaluations);
    const tete = ['Personne', 'Poste', 'Équipe', 'Domaine', 'Compétence', 'Critique', 'Niveau requis', 'Niveau actuel', 'Écart', 'Situation', 'Évalué le'];
    const lignes = [];
    for (const p of etat.personnes) {
      for (const c of etat.competences) {
        const x = cellule(etat, p, c.id, auj, idx);
        if (!x.requis && x.actuel === null) continue;
        lignes.push([p.nom, nomPoste(etat, p.posteId), p.equipe, nomDomaine(etat, c.domaineId), c.nom, c.critique ? 'Oui' : '', x.requis || '', x.actuel ?? '', x.ecart || '', LIB_CELLULE[x.statut], x.date || '']);
      }
    }
    return csv([tete, ...lignes]);
  }
  function versCsvPlan(etat, auj) {
    const echelle = etat.reglages.echelle;
    const nomNiv = (n) => (n === null ? '' : `${n} · ${echelle[n]?.nom || ''}`);
    const tete = ['Date', 'Intitulé', 'Personne', 'Équipe', 'Compétence visée', 'Modalité', 'Organisme ou formateur', 'Durée (h)', 'Coût (€)', 'Statut', 'Niveau visé', 'Niveau après', 'Note'];
    const pers = new Map(etat.personnes.map((p) => [p.id, p]));
    const lignes = [...etat.formations].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).map((f) => [f.date || '', f.intitule, pers.get(f.personneId)?.nom || '', pers.get(f.personneId)?.equipe || '', nomComp(etat, f.competenceId), LIB_MODALITE[f.modalite], f.organisme, f.duree ? nombreFr(f.duree) : '', f.cout ? nombreFr(f.cout) : '', LIB_STATUT[statutFormation(f, auj)], nomNiv(f.niveauVise), nomNiv(f.niveauApres), f.note]);
    return csv([tete, ...lignes]);
  }
  function versCsvHistorique(etat) {
    const pers = new Map(etat.personnes.map((p) => [p.id, p]));
    const tete = ['Date', 'Personne', 'Compétence', 'Niveau', 'Libellé', 'Source', 'Note'];
    const lignes = [...etat.evaluations].sort((a, b) => a.date.localeCompare(b.date) || (a.ordre || 0) - (b.ordre || 0)).map((e) => [e.date, pers.get(e.personneId)?.nom || '', nomComp(etat, e.competenceId), e.niveau, etat.reglages.echelle[e.niveau]?.nom || '', LIB_SOURCE[e.source], e.note]);
    return csv([tete, ...lignes]);
  }

  racine.FRM = {
    SOURCES, STATUTS_FORMATION, MODALITES, MAX_POSSIBLES, LIB_STATUT, LIB_SOURCE, LIB_MODALITE, LIB_CELLULE,
    iso, versDate, ajout, ajoutMois, ecartJours, estDate, nomMinimal, borner, echelleDe,
    historique, derniere, indexDernieres, requis, cellule, exigences, conformite, niveauReference, couverture, fragiles,
    statutFormation, anneeDe, budget, ecartsSansAction, evaluationApres, aReevaluer, indicateurs, bilanPersonne,
    appliquerEchelle, retirerCompetence, retirerPersonne,
    nouvelId, montant, normaliserDomaine, normaliserCompetence, normaliserPoste, normaliserPersonne, normaliserEvaluation, normaliserFormation,
    etatVide, normaliser, versCsvMatrice, versCsvPlan, versCsvHistorique,
  };
})(typeof window !== 'undefined' ? window : globalThis);
