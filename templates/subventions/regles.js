// Subventions QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.SBV) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ ». Montants en euros (nombres), tous saisis par l'utilisateur.
// Aucun calendrier de financeur : les dates limites viennent de l'utilisateur. Seuls rappels calculés : ceux de
// BASE.regles (service-public.gouv.fr, datés), appliqués aux financeurs publics et désactivables.
(function (racine) {
  'use strict';

  const STATUTS = ['preparation', 'depose', 'accorde', 'refuse', 'abandonne'];
  const LIB_STATUT = { preparation: 'En préparation', depose: 'Déposé, en attente', accorde: 'Accordé', refuse: 'Refusé', abandonne: 'Abandonné', clos: 'Clos' };
  const STATUTS_PIECE = ['afaire', 'pret', 'joint', 'sansobjet'];
  const LIB_PIECE = { afaire: 'À préparer', pret: 'Prête', joint: 'Envoyée', sansobjet: 'Sans objet' };
  const MAX = { financeurs: 200, projets: 120, dossiers: 600, depenses: 4000, pieces: 40, versements: 24, lignes: 40 };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ajoutMois = (s, n) => { const d = versDate(s); const j = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(j, fin)); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateOuNull = (s) => (estDate(s) ? s : null);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || `${s}s`) : s}`;

  // Exercice comptable désigné par l'année où il commence ; debut = mois de début (1 à 12).
  const exercice = (date, debut = 1) => { const a = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)); return m >= debut ? a : a - 1; };
  const debutExercice = (annee, debut = 1) => `${annee}-${deux(debut)}-01`;
  const finExercice = (annee, debut = 1) => ajout(ajoutMois(debutExercice(annee, debut), 12), -1);
  const libelleExercice = (annee, debut = 1) => (debut === 1 ? String(annee) : `${annee}-${annee + 1}`);

  // ---------- Montants ----------
  const arrondi = (n) => Math.round(n * 100) / 100;
  const somme = (l, f = (x) => x) => arrondi(l.reduce((s, x) => s + (Number(f(x)) || 0), 0));
  const euros = (n, { centimes = false } = {}) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return '–';
    const avec = centimes && Math.round(n * 100) % 100 !== 0;
    const s = (avec ? arrondi(n) : Math.round(n)).toLocaleString('fr-FR', { minimumFractionDigits: avec ? 2 : 0, maximumFractionDigits: avec ? 2 : 0 });
    return `${s.replace(/[\s\u202f]/g, '\u00a0')}\u00a0€`;
  };
  const pct = (t) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${Math.round(t)} %`);
  const lireNombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const montantOuNull = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) || n < 0 ? null : arrondi(Math.min(n, 1e8)); };
  const montant = (v) => montantOuNull(v) ?? 0;

  // ---------- Normalisation (tolérante aux anciennes versions et aux saisies partielles) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const anneeDe = (v, auj) => entier(v, 2000, 2100, Number((auj || iso(new Date())).slice(0, 4)));

  const DEFAUT_REGLAGES = { alerte: 21, relanceReponse: 30, debutExercice: 1, rappels: true };
  function reglagesDe(g = {}, d = DEFAUT_REGLAGES) {
    return {
      alerte: entier(g.alerte, 1, 120, d.alerte),
      relanceReponse: entier(g.relanceReponse, 7, 365, d.relanceReponse),
      debutExercice: entier(g.debutExercice, 1, 12, d.debutExercice),
      rappels: g.rappels === undefined ? d.rappels : g.rappels !== false,
    };
  }

  function normaliserFinanceur(x = {}, types = null) {
    const ids = types ? types.map((t) => t.id) : null;
    return {
      id: texte(x.id || nouvelId(), 40),
      nom: texte(x.nom, 80).trim() || 'Financeur',
      type: !ids || ids.includes(x.type) ? texte(x.type || 'autre', 20) : 'autre',
      contact: texte(x.contact, 120),
      note: texte(x.note, 400),
    };
  }
  const ligneBudget = (x = {}) => ({ id: texte(x.id || nouvelId(), 40), poste: texte(x.poste, 80), libelle: texte(x.libelle, 120), montant: montant(x.montant) });
  function normaliserProjet(x = {}, auj) {
    return {
      id: texte(x.id || nouvelId(), 40),
      nom: texte(x.nom, 100).trim() || 'Projet',
      annee: anneeDe(x.annee, auj),
      description: texte(x.description, 600),
      charges: (Array.isArray(x.charges) ? x.charges : []).slice(0, MAX.lignes).map(ligneBudget),
      ressources: (Array.isArray(x.ressources) ? x.ressources : []).slice(0, MAX.lignes).map(ligneBudget),
      archive: Boolean(x.archive),
    };
  }
  const normaliserPiece = (x = {}) => ({ id: texte(x.id || nouvelId(), 40), nom: texte(x.nom, 140).trim() || 'Pièce', base: x.base ? texte(x.base, 30) : null, statut: STATUTS_PIECE.includes(x.statut) ? x.statut : 'afaire' });
  const normaliserVersement = (x = {}) => ({ id: texte(x.id || nouvelId(), 40), montant: montant(x.montant), prevuLe: dateOuNull(x.prevuLe), recuLe: dateOuNull(x.recuLe) });
  function normaliserDossier(x = {}, auj) {
    const t = auj || iso(new Date());
    const bilan = {};
    for (const k of ['realise', 'public', 'resultats', 'ecarts', 'suites']) bilan[k] = texte(x.bilan?.[k], 2000);
    return {
      id: texte(x.id || nouvelId(), 40),
      projet: x.projet ? texte(x.projet, 40) : null,
      financeur: x.financeur ? texte(x.financeur, 40) : null,
      annee: anneeDe(x.annee, t),
      intitule: texte(x.intitule, 120).trim(),
      dispositif: texte(x.dispositif, 120),
      nature: ['projet', 'fonctionnement', 'investissement'].includes(x.nature) ? x.nature : 'projet',
      demande: montant(x.demande),
      accorde: montantOuNull(x.accorde),
      statut: STATUTS.includes(x.statut) ? x.statut : 'preparation',
      limiteDepot: dateOuNull(x.limiteDepot),
      depot: dateOuNull(x.depot),
      reponseAttendue: dateOuNull(x.reponseAttendue),
      reponse: dateOuNull(x.reponse),
      bilanLimite: dateOuNull(x.bilanLimite),
      bilanRendu: dateOuNull(x.bilanRendu),
      convention: Boolean(x.convention),
      sansBilan: Boolean(x.sansBilan),
      versements: (Array.isArray(x.versements) ? x.versements : []).slice(0, MAX.versements).map(normaliserVersement),
      pieces: (Array.isArray(x.pieces) ? x.pieces : []).slice(0, MAX.pieces).map(normaliserPiece),
      piecesBilan: (Array.isArray(x.piecesBilan) ? x.piecesBilan : []).slice(0, MAX.pieces).map(normaliserPiece),
      bilan,
      note: texte(x.note, 600),
      creeLe: dateOuNull(x.creeLe) || t,
    };
  }
  function normaliserDepense(x = {}, auj) {
    return {
      id: texte(x.id || nouvelId(), 40),
      projet: x.projet ? texte(x.projet, 40) : null,
      dossier: x.dossier ? texte(x.dossier, 40) : null,
      date: dateOuNull(x.date) || auj || iso(new Date()),
      libelle: texte(x.libelle, 140).trim() || 'Dépense',
      poste: texte(x.poste, 80),
      montant: montant(x.montant),
      fournisseur: texte(x.fournisseur, 80),
      piece: texte(x.piece, 60),
      justificatif: Boolean(x.justificatif),
    };
  }

  const etatVide = (defauts = {}) => ({ version: 1, structure: '', reglages: reglagesDe(defauts), financeurs: [], projets: [], dossiers: [], depenses: [] });
  function normaliser(d, auj, base = null) {
    const e = etatVide(base?.reglages);
    if (!d || typeof d !== 'object') return e;
    e.structure = texte(d.structure, 100);
    e.reglages = reglagesDe(d.reglages || {}, base ? reglagesDe(base.reglages) : DEFAUT_REGLAGES);
    e.financeurs = (Array.isArray(d.financeurs) ? d.financeurs : []).slice(0, MAX.financeurs).map((f) => normaliserFinanceur(f, base?.typesFinanceur));
    e.projets = (Array.isArray(d.projets) ? d.projets : []).slice(0, MAX.projets).map((p) => normaliserProjet(p, auj));
    e.dossiers = (Array.isArray(d.dossiers) ? d.dossiers : []).slice(0, MAX.dossiers).map((x) => normaliserDossier(x, auj));
    e.depenses = (Array.isArray(d.depenses) ? d.depenses : []).slice(0, MAX.depenses).map((x) => normaliserDepense(x, auj));
    // Références orphelines : le projet ou le financeur a été supprimé.
    const projets = new Set(e.projets.map((p) => p.id)), financeurs = new Set(e.financeurs.map((f) => f.id)), dossiers = new Set(e.dossiers.map((x) => x.id));
    for (const x of e.dossiers) { if (x.projet && !projets.has(x.projet)) x.projet = null; if (x.financeur && !financeurs.has(x.financeur)) x.financeur = null; }
    for (const x of e.depenses) { if (x.projet && !projets.has(x.projet)) x.projet = null; if (x.dossier && !dossiers.has(x.dossier)) x.dossier = null; }
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // Pièces proposées à la création d'un dossier, selon que le financeur est public ou privé.
  function piecesDepart(base, typeFinanceur) {
    const t = base.typesFinanceur.find((x) => x.id === typeFinanceur);
    const ids = base.depart[t && t.public ? 'public' : 'prive'];
    return ids.map((id) => base.pieces.find((p) => p.id === id)).filter(Boolean).map((p) => normaliserPiece({ nom: p.nom, base: p.id }));
  }
  const piecesBilanDepart = (base) => base.piecesBilan.map((nom) => normaliserPiece({ nom }));

  // ---------- Un dossier ----------
  const financeurDe = (etat, d) => (etat.financeurs || []).find((f) => f.id === d.financeur) || null;
  const projetDe = (etat, d) => (etat.projets || []).find((p) => p.id === d.projet) || null;
  const estPublic = (base, f) => !!f && !!base.typesFinanceur.find((t) => t.id === f.type)?.public;
  const accordeDe = (d) => (d.statut === 'accorde' ? (d.accorde ?? d.demande) : 0);
  const verse = (d) => somme((d.versements || []).filter((v) => v.recuLe), (v) => v.montant);
  const resteAPercevoir = (d) => (d.statut === 'accorde' ? Math.max(0, arrondi(accordeDe(d) - verse(d))) : 0);
  const versementsPrevus = (d) => somme(d.versements || [], (v) => v.montant);
  function etatDossier(d) {
    if (d.statut === 'accorde' && (d.bilanRendu || d.sansBilan) && resteAPercevoir(d) === 0) return 'clos';
    return d.statut;
  }
  const piecesManquantes = (d) => (d.pieces || []).filter((p) => p.statut === 'afaire').length;
  const piecesUtiles = (l) => (l || []).filter((p) => p.statut !== 'sansobjet');
  const avancementPieces = (l) => { const u = piecesUtiles(l); return { total: u.length, pretes: u.filter((p) => p.statut !== 'afaire').length }; };

  // Date limite du bilan : saisie, sinon (rappels actifs, financeur public, aide affectée à une action)
  // fin de l'exercice de l'année du dossier + 6 mois (service-public.gouv.fr, fiche R46623).
  function limiteBilan(etat, base, d) {
    if (d.sansBilan) return { date: null, origine: null };
    if (d.bilanLimite) return { date: d.bilanLimite, origine: 'saisie' };
    if (!etat.reglages.rappels || d.nature === 'fonctionnement' || !estPublic(base, financeurDe(etat, d))) return { date: null, origine: null };
    return { date: ajout(ajoutMois(ajout(finExercice(d.annee, etat.reglages.debutExercice), 1), base.regles.compteRendu.mois), -1), origine: 'regle' };
  }
  const conventionAttendue = (etat, base, d) => etat.reglages.rappels && d.statut === 'accorde' && !d.convention
    && accordeDe(d) > base.regles.convention.seuil && estPublic(base, financeurDe(etat, d));

  const niveau = (date, auj, alerte) => (date < auj ? 'retard' : ecart(auj, date) <= alerte ? 'proche' : 'avenir');

  // Toutes les échéances ouvertes : dépôt, réponse, versements, bilan, convention. Triées : retards, puis par date.
  function echeances(etat, base, auj) {
    const al = etat.reglages.alerte;
    const out = [];
    for (const d of etat.dossiers || []) {
      if (d.statut === 'preparation' && d.limiteDepot) {
        out.push({ dossier: d.id, type: 'depot', date: d.limiteDepot, niveau: niveau(d.limiteDepot, auj, al), manquantes: piecesManquantes(d) });
      }
      if (d.statut === 'depose') {
        const date = d.reponseAttendue || (d.depot ? ajout(d.depot, etat.reglages.relanceReponse) : null);
        if (date) out.push({ dossier: d.id, type: 'reponse', date, niveau: date < auj ? 'retard' : niveau(date, auj, al), estimee: !d.reponseAttendue });
      }
      if (d.statut === 'accorde') {
        for (const v of d.versements || []) if (!v.recuLe && v.prevuLe) out.push({ dossier: d.id, type: 'versement', versement: v.id, date: v.prevuLe, niveau: niveau(v.prevuLe, auj, al), montant: v.montant });
        if (!d.bilanRendu) {
          const b = limiteBilan(etat, base, d);
          if (b.date) out.push({ dossier: d.id, type: 'bilan', date: b.date, niveau: niveau(b.date, auj, Math.max(al, 45)), origine: b.origine });
        }
        if (conventionAttendue(etat, base, d)) out.push({ dossier: d.id, type: 'convention', date: d.reponse || null, niveau: 'proche' });
      }
    }
    const rang = { retard: 0, proche: 1, avenir: 2 };
    return out.sort((a, b) => rang[a.niveau] - rang[b.niveau] || String(a.date || '9999').localeCompare(String(b.date || '9999')));
  }

  // ---------- Tableau de bord annuel ----------
  // Année d'un dossier = année du projet ou de l'action (saisie). Versé = versements reçus, quelle que soit leur date.
  function syntheseAnnee(etat, base, annee) {
    const liste = (etat.dossiers || []).filter((d) => d.annee === annee);
    const actifs = liste.filter((d) => d.statut !== 'abandonne');
    const repondus = liste.filter((d) => d.statut === 'accorde' || d.statut === 'refuse');
    const accordes = liste.filter((d) => d.statut === 'accorde');
    const parType = base.typesFinanceur.map((t) => {
      const ds = actifs.filter((d) => (financeurDe(etat, d)?.type || 'autre') === t.id);
      return { type: t.id, nom: t.nom, nb: ds.length, demande: somme(ds, (d) => d.demande), accorde: somme(ds, accordeDe), verse: somme(ds, verse) };
    }).filter((x) => x.nb);
    return {
      annee, nb: liste.length,
      parStatut: Object.fromEntries(['preparation', 'depose', 'accorde', 'refuse', 'abandonne', 'clos'].map((s) => [s, liste.filter((d) => etatDossier(d) === s).length])),
      demande: somme(actifs, (d) => d.demande),
      enAttente: somme(liste.filter((d) => d.statut === 'depose'), (d) => d.demande),
      enPreparation: somme(liste.filter((d) => d.statut === 'preparation'), (d) => d.demande),
      accorde: somme(accordes, accordeDe),
      demandeAccordes: somme(accordes, (d) => d.demande),
      verse: somme(accordes, verse),
      reste: somme(accordes, resteAPercevoir),
      tauxAcceptation: repondus.length ? (accordes.length / repondus.length) * 100 : null,
      tauxObtention: somme(accordes, (d) => d.demande) ? (somme(accordes, accordeDe) / somme(accordes, (d) => d.demande)) * 100 : null,
      parType,
    };
  }

  // Subventions publiques en numéraire reçues pendant l'exercice (versements datés), face au seuil des comptes annuels.
  function seuilComptesAnnuels(etat, base, annee) {
    const deb = etat.reglages.debutExercice;
    let total = 0;
    for (const d of etat.dossiers || []) {
      if (!estPublic(base, financeurDe(etat, d))) continue;
      for (const v of d.versements || []) if (v.recuLe && exercice(v.recuLe, deb) === annee) total += v.montant;
    }
    total = arrondi(total);
    const seuil = base.regles.comptesAnnuels.seuil;
    return { total, seuil, depasse: total > seuil, proche: total > seuil * 0.8 && total <= seuil };
  }

  // ---------- Budget d'un projet ----------
  // Subventions : montant accordé si la réponse est positive, sinon demandé (attendu) tant que le dossier est ouvert.
  function budgetProjet(etat, projetId) {
    const p = (etat.projets || []).find((x) => x.id === projetId);
    if (!p) return null;
    const charges = somme(p.charges, (l) => l.montant);
    const dossiers = (etat.dossiers || []).filter((d) => d.projet === p.id && !['refuse', 'abandonne'].includes(d.statut));
    const subventions = dossiers.map((d) => {
      const acquis = d.statut === 'accorde';
      const m = acquis ? accordeDe(d) : d.demande;
      return { dossier: d.id, financeur: d.financeur, montant: m, acquis, statut: d.statut, part: charges ? (m / charges) * 100 : null };
    });
    const autres = somme(p.ressources, (l) => l.montant);
    const totalSub = somme(subventions, (s) => s.montant);
    const acquises = somme(subventions.filter((s) => s.acquis), (s) => s.montant);
    const depenses = (etat.depenses || []).filter((x) => x.projet === p.id);
    const realise = somme(depenses, (x) => x.montant);
    const postes = [...new Set([...p.charges.map((l) => l.poste), ...depenses.map((x) => x.poste)])].map((poste) => {
      const prevu = somme(p.charges.filter((l) => l.poste === poste), (l) => l.montant);
      const reel = somme(depenses.filter((x) => x.poste === poste), (x) => x.montant);
      return { poste, prevu, reel, ecart: arrondi(reel - prevu), ecartPct: prevu ? ((reel - prevu) / prevu) * 100 : null };
    });
    return {
      projet: p.id, charges, autres, subventions, totalSub, acquises,
      ressources: arrondi(totalSub + autres), equilibre: arrondi(totalSub + autres - charges),
      partSubventions: charges ? (totalSub / charges) * 100 : null,
      realise, tauxRealisation: charges ? (realise / charges) * 100 : null,
      sansJustificatif: depenses.filter((x) => !x.justificatif).length, nbDepenses: depenses.length, postes,
    };
  }

  // ---------- Bilan d'un dossier ----------
  // Montant justifié : dépenses imputées à ce dossier avec justificatif. Sans imputation, estimation : dépenses du
  // projet × part du financeur dans le budget prévu (affichée comme estimation).
  function bilanDossier(etat, d) {
    const b = d.projet ? budgetProjet(etat, d.projet) : null;
    const imputees = (etat.depenses || []).filter((x) => x.dossier === d.id);
    const aJustifier = d.statut === 'accorde' ? accordeDe(d) : d.demande;
    const part = b && b.charges ? aJustifier / b.charges : null;
    const justifie = somme(imputees.filter((x) => x.justificatif), (x) => x.montant);
    const imputeTotal = somme(imputees, (x) => x.montant);
    const estimation = !imputees.length && b && part !== null ? arrondi(b.realise * part) : null;
    return {
      aJustifier, part: part === null ? null : part * 100, imputees: imputees.length, impute: imputeTotal, justifie,
      sansJustificatif: imputees.filter((x) => !x.justificatif).length,
      estimation, couverture: aJustifier ? ((imputees.length ? justifie : (estimation ?? 0)) / aJustifier) * 100 : null,
      budget: b,
    };
  }

  // ---------- Recherche et tri ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function rechercher(etat, dossiers, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return dossiers;
    return dossiers.filter((d) => {
      const f = financeurDe(etat, d), p = projetDe(etat, d);
      const tout = sansAccents([d.intitule, d.dispositif, d.note, f?.nom, p?.nom, d.annee].join(' '));
      return mots.every((m) => tout.includes(m));
    });
  }
  const ORDRE = { preparation: 0, depose: 1, accorde: 2, clos: 3, refuse: 4, abandonne: 5 };
  const trierDossiers = (l) => [...l].sort((a, b) => ORDRE[etatDossier(a)] - ORDRE[etatDossier(b)] || b.annee - a.annee || String(a.limiteDepot || a.depot || '9').localeCompare(String(b.limiteDepot || b.depot || '9')) || a.intitule.localeCompare(b.intitule, 'fr'));
  const annees = (etat, auj) => [...new Set([Number(auj.slice(0, 4)), ...(etat.dossiers || []).map((d) => d.annee), ...(etat.projets || []).map((p) => p.annee)])].sort((a, b) => b - a);

  // ---------- Export CSV (séparateur « ; », virgule décimale, BOM pour les tableurs) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (n) => (n === null || n === undefined ? '' : String(arrondi(n)).replace('.', ','));
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsv(etat, base, auj) {
    const tete = ['Année', 'Dossier', 'Financeur', 'Type de financeur', 'Projet', 'Dispositif', 'Nature', 'Statut', 'Demandé', 'Accordé', 'Versé', 'Reste à percevoir', 'Date limite de dépôt', 'Déposé le', 'Réponse le', 'Bilan à rendre le', 'Bilan rendu le', 'Pièces prêtes', 'Note'];
    return csv([tete, ...trierDossiers(etat.dossiers).map((d) => {
      const f = financeurDe(etat, d), p = projetDe(etat, d), a = avancementPieces(d.pieces);
      return [d.annee, d.intitule, f?.nom || '', base.typesFinanceur.find((t) => t.id === f?.type)?.nom || '', p?.nom || '', d.dispositif,
        base.natures.find((n) => n.id === d.nature)?.nom || '', LIB_STATUT[etatDossier(d)], nombreCsv(d.demande), d.statut === 'accorde' ? nombreCsv(accordeDe(d)) : '',
        nombreCsv(verse(d)), d.statut === 'accorde' ? nombreCsv(resteAPercevoir(d)) : '', d.limiteDepot || '', d.depot || '', d.reponse || '',
        limiteBilan(etat, base, d).date || '', d.bilanRendu || '', `${a.pretes}/${a.total}`, d.note];
    })]);
  }
  function versCsvDepenses(etat) {
    const tete = ['Date', 'Projet', 'Poste', 'Libellé', 'Fournisseur', 'Montant', 'Référence du justificatif', 'Justificatif rangé', 'Imputée au dossier'];
    return csv([tete, ...[...etat.depenses].sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, (etat.projets.find((p) => p.id === x.projet) || {}).nom || '', x.poste, x.libelle, x.fournisseur, nombreCsv(x.montant), x.piece, x.justificatif ? 'Oui' : 'Non', (etat.dossiers.find((d) => d.id === x.dossier) || {}).intitule || ''])]);
  }

  racine.SBV = {
    STATUTS, LIB_STATUT, STATUTS_PIECE, LIB_PIECE, MAX,
    iso, versDate, ajout, ajoutMois, ecart, estDate, pluriel, exercice, debutExercice, finExercice, libelleExercice,
    arrondi, somme, euros, pct, lireNombre, montantOuNull, nouvelId, sansAccents,
    reglagesDe, normaliserFinanceur, normaliserProjet, normaliserPiece, normaliserVersement, normaliserDossier, normaliserDepense, etatVide, normaliser,
    piecesDepart, piecesBilanDepart, financeurDe, projetDe, estPublic, accordeDe, verse, resteAPercevoir, versementsPrevus, etatDossier,
    piecesManquantes, avancementPieces, limiteBilan, conventionAttendue, echeances, syntheseAnnee, seuilComptesAnnuels,
    budgetProjet, bilanDossier, rechercher, trierDossiers, annees, versCsv, versCsvDepenses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
