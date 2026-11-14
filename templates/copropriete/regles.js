// Charges et AG de copropriété QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CPR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ ». Montants en euros (nombres) : la quote-part du copropriétaire, saisie depuis les
// appels de fonds et les décomptes du syndic. Aucune règle de majorité : la majorité est saisie, le résultat aussi.
// Seuls calculs adossés à une règle : les 4 appels trimestriels (quart du budget, 1er jour du trimestre) et le
// rapport fonds de travaux / budget (5 %), repris de service-public.gouv.fr (BASE.regles, datés, désactivables).
(function (racine) {
  'use strict';

  const VOTES = ['pour', 'contre', 'abstention', 'absent'];
  const LIB_VOTE = { pour: 'Pour', contre: 'Contre', abstention: 'Abstention', absent: 'Pas de vote' };
  const RESULTATS = ['adoptee', 'rejetee', 'ajournee', 'retiree'];
  const LIB_RESULTAT = { adoptee: 'Adoptée', rejetee: 'Rejetée', ajournee: 'Ajournée', retiree: 'Retirée', attente: 'Résultat à noter', avenir: 'À voter' };
  const STATUTS_TRAVAUX = ['vote', 'encours', 'termine', 'abandonne'];
  const LIB_TRAVAUX = { vote: 'Voté, à lancer', encours: 'En cours', termine: 'Terminé', abandonne: 'Abandonné' };
  const MAX = { copros: 20, lots: 40, appels: 600, exercices: 40, assemblees: 120, resolutions: 80, travaux: 120, echeances: 24, documents: 1000, lignesAppel: 12 };

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

  // Exercice de la copropriété désigné par l'année où il commence ; debut = mois de début (1 à 12).
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
    return `${s.replace(/[\s ]/g, ' ')} €`;
  };
  const pct = (t, dec = 0) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${(dec ? Math.round(t * 10 ** dec) / 10 ** dec : Math.round(t)).toLocaleString('fr-FR')} %`);
  const lireNombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/[\s  €%]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const montantOuNull = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) || n < 0 ? null : arrondi(Math.min(n, 1e8)); };
  const montant = (v) => montantOuNull(v) ?? 0;
  // Montant signé (un décompte peut porter un avoir) : borné, arrondi au centime.
  const montantSigne = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) ? 0 : arrondi(Math.max(-1e8, Math.min(n, 1e8))); };
  const pourcentOuNull = (v) => { const n = lireNombre(v); return n === null || !Number.isFinite(n) ? null : Math.max(0, Math.min(100, Math.round(n * 10) / 10)); };

  // ---------- Normalisation (tolérante aux anciennes versions et aux saisies partielles) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dans = (v, liste, defaut) => (liste.includes(v) ? v : defaut);

  const DEFAUT_REGLAGES = { alerte: 15, alerteAG: 21, rappels: true };
  function reglagesDe(g = {}, d = DEFAUT_REGLAGES) {
    return {
      alerte: entier(g.alerte, 1, 90, d.alerte),
      alerteAG: entier(g.alerteAG, 3, 90, d.alerteAG),
      rappels: g.rappels === undefined ? d.rappels : g.rappels !== false,
    };
  }

  const normaliserLot = (x = {}) => ({
    id: texte(x.id || nouvelId(), 40), nom: texte(x.nom, 60).trim() || 'Lot', type: texte(x.type || 'logement', 20),
    numero: texte(x.numero, 20), tantiemes: entier(x.tantiemes, 0, 1e6, 0), loue: Boolean(x.loue),
  });
  const normaliserLigneTravaux = (x = {}) => ({ travaux: texte(x.travaux, 40), echeance: x.echeance ? texte(x.echeance, 40) : null, montant: montant(x.montant) });
  function normaliserAppel(x = {}, debut = 1, auj) {
    const echeance = dateOuNull(x.echeance) || auj || iso(new Date());
    return {
      id: texte(x.id || nouvelId(), 40),
      exercice: entier(x.exercice, 2000, 2100, exercice(echeance, debut)),
      libelle: texte(x.libelle, 80).trim(),
      echeance,
      provisions: montant(x.provisions),
      fondsTravaux: montant(x.fondsTravaux),
      travaux: (Array.isArray(x.travaux) ? x.travaux : []).slice(0, MAX.lignesAppel).map(normaliserLigneTravaux).filter((l) => l.travaux),
      autres: montant(x.autres),
      payeLe: dateOuNull(x.payeLe),
      note: texte(x.note, 300),
    };
  }
  function normaliserExercice(x = {}, base = null, auj) {
    const ids = base ? base.postes.map((p) => p.id) : null;
    const vus = new Set();
    const charges = (Array.isArray(x.charges) ? x.charges : []).map((l) => ({ poste: texte(l?.poste, 40), montant: montantSigne(l?.montant) }))
      .filter((l) => l.poste && (!ids || ids.includes(l.poste)) && !vus.has(l.poste) && vus.add(l.poste));
    return {
      id: texte(x.id || nouvelId(), 40),
      annee: entier(x.annee, 2000, 2100, Number((auj || iso(new Date())).slice(0, 4))),
      budget: montantOuNull(x.budget),
      charges,
      approuveLe: dateOuNull(x.approuveLe),
      regleLe: dateOuNull(x.regleLe),
      note: texte(x.note, 400),
    };
  }
  const normaliserResolution = (x = {}, i = 0) => ({
    id: texte(x.id || nouvelId(), 40), numero: texte(x.numero || String(i + 1), 8), titre: texte(x.titre, 200).trim() || 'Résolution',
    majorite: texte(x.majorite, 40), montant: montantOuNull(x.montant), vote: VOTES.includes(x.vote) ? x.vote : null,
    resultat: RESULTATS.includes(x.resultat) ? x.resultat : null, note: texte(x.note, 400),
  });
  function normaliserAssemblee(x = {}, auj) {
    return {
      id: texte(x.id || nouvelId(), 40),
      date: dateOuNull(x.date) || auj || iso(new Date()),
      type: dans(x.type, ['ordinaire', 'extraordinaire'], 'ordinaire'),
      lieu: texte(x.lieu, 120),
      convocationRecue: dateOuNull(x.convocationRecue),
      presence: dans(x.presence, ['present', 'represente', 'correspondance', 'distance', 'absent'], null),
      preparee: Boolean(x.preparee),
      pvRecu: dateOuNull(x.pvRecu),
      resolutions: (Array.isArray(x.resolutions) ? x.resolutions : []).slice(0, MAX.resolutions).map(normaliserResolution),
      note: texte(x.note, 600),
    };
  }
  const normaliserEcheance = (x = {}) => ({ id: texte(x.id || nouvelId(), 40), date: dateOuNull(x.date), montant: montant(x.montant) });
  function normaliserTravaux(x = {}) {
    return {
      id: texte(x.id || nouvelId(), 40),
      nom: texte(x.nom, 120).trim() || 'Travaux',
      assemblee: x.assemblee ? texte(x.assemblee, 40) : null,
      resolution: x.resolution ? texte(x.resolution, 40) : null,
      montantTotal: montantOuNull(x.montantTotal),
      quotePart: montant(x.quotePart),
      statut: dans(x.statut, STATUTS_TRAVAUX, 'vote'),
      echeancier: (Array.isArray(x.echeancier) ? x.echeancier : []).slice(0, MAX.echeances).map(normaliserEcheance),
      note: texte(x.note, 400),
    };
  }
  const normaliserDocument = (x = {}, auj) => ({
    id: texte(x.id || nouvelId(), 40), nom: texte(x.nom, 140).trim() || 'Document', type: texte(x.type, 80),
    date: dateOuNull(x.date), exercice: x.exercice ? entier(x.exercice, 2000, 2100, null) : null, rangement: texte(x.rangement, 140), note: texte(x.note, 300),
    ajouteLe: dateOuNull(x.ajouteLe) || auj || iso(new Date()),
  });
  function normaliserRecup(r = {}, base = null) {
    const out = {};
    for (const [k, v] of Object.entries(r && typeof r === 'object' ? r : {})) {
      if (base && !base.postes.some((p) => p.id === k)) continue;
      const n = pourcentOuNull(v);
      if (n !== null) out[texte(k, 40)] = n;
    }
    return out;
  }
  function normaliserCopro(x = {}, base = null, auj) {
    const debut = entier(x.debutExercice, 1, 12, 1);
    const c = {
      id: texte(x.id || nouvelId(), 40),
      nom: texte(x.nom, 100).trim() || 'Ma copropriété',
      syndic: texte(x.syndic, 100),
      debutExercice: debut,
      tantiemesTotal: entier(x.tantiemesTotal, 0, 1e7, 0),
      lots: (Array.isArray(x.lots) ? x.lots : []).slice(0, MAX.lots).map(normaliserLot),
      appels: (Array.isArray(x.appels) ? x.appels : []).slice(0, MAX.appels).map((a) => normaliserAppel(a, debut, auj)),
      exercices: [],
      recup: normaliserRecup(x.recup, base),
      assemblees: (Array.isArray(x.assemblees) ? x.assemblees : []).slice(0, MAX.assemblees).map((a) => normaliserAssemblee(a, auj)),
      travaux: (Array.isArray(x.travaux) ? x.travaux : []).slice(0, MAX.travaux).map(normaliserTravaux),
      documents: (Array.isArray(x.documents) ? x.documents : []).slice(0, MAX.documents).map((d) => normaliserDocument(d, auj)),
    };
    // Un seul exercice par année (le dernier saisi l'emporte).
    const parAnnee = new Map();
    for (const e of (Array.isArray(x.exercices) ? x.exercices : []).slice(0, MAX.exercices)) { const n = normaliserExercice(e, base, auj); parAnnee.set(n.annee, n); }
    c.exercices = [...parAnnee.values()].sort((a, b) => a.annee - b.annee);
    // Références orphelines : travaux, échéance ou assemblée supprimés.
    const travaux = new Map(c.travaux.map((t) => [t.id, t]));
    for (const a of c.appels) a.travaux = a.travaux.filter((l) => travaux.has(l.travaux)).map((l) => (l.echeance && !travaux.get(l.travaux).echeancier.some((e) => e.id === l.echeance) ? { ...l, echeance: null } : l));
    const ags = new Map(c.assemblees.map((a) => [a.id, a]));
    for (const t of c.travaux) {
      if (t.assemblee && !ags.has(t.assemblee)) { t.assemblee = null; t.resolution = null; }
      if (t.resolution && !ags.get(t.assemblee)?.resolutions.some((r) => r.id === t.resolution)) t.resolution = null;
    }
    return c;
  }

  const etatVide = (defauts = {}) => ({ version: 1, actif: null, reglages: reglagesDe(defauts), copros: [] });
  function normaliser(d, auj, base = null) {
    const e = etatVide(base?.reglages);
    if (!d || typeof d !== 'object') return e;
    e.reglages = reglagesDe(d.reglages || {}, base ? reglagesDe(base.reglages) : DEFAUT_REGLAGES);
    e.copros = (Array.isArray(d.copros) ? d.copros : []).slice(0, MAX.copros).map((c) => normaliserCopro(c, base, auj));
    e.actif = e.copros.some((c) => c.id === d.actif) ? d.actif : (e.copros[0]?.id ?? null);
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // ---------- Lots et tantièmes ----------
  const tantiemesLots = (c) => (c.lots || []).reduce((s, l) => s + (l.tantiemes || 0), 0);
  const part = (c) => (c.tantiemesTotal > 0 ? tantiemesLots(c) / c.tantiemesTotal : null);
  // Quote-part estimée d'un montant global selon les tantièmes généraux (aide : la clé réelle est celle du syndic).
  const quotePart = (c, total) => { const p = part(c); return p === null || !Number.isFinite(total) ? null : arrondi(total * p); };
  const aLoue = (c) => (c.lots || []).some((l) => l.loue);

  // ---------- Appels de fonds ----------
  const totalTravauxAppel = (a) => somme(a.travaux || [], (l) => l.montant);
  const totalAppel = (a) => arrondi(a.provisions + a.fondsTravaux + totalTravauxAppel(a) + a.autres);
  const niveau = (date, auj, alerte) => (date < auj ? 'retard' : ecart(auj, date) <= alerte ? 'proche' : 'avenir');
  const etatAppel = (a, auj, alerte) => (a.payeLe ? 'paye' : niveau(a.echeance, auj, alerte));
  const trierAppels = (l) => [...l].sort((a, b) => a.echeance.localeCompare(b.echeance) || a.libelle.localeCompare(b.libelle, 'fr'));

  // Les 4 appels d'un exercice : quart des montants annuels, au 1er jour de chaque trimestre de l'exercice
  // (service-public.gouv.fr, F20586). Arrondi au centime, l'écart d'arrondi va sur le dernier appel.
  function appelsTrimestriels(c, annee, { provisions = 0, fondsTravaux = 0 } = {}) {
    const p = montant(provisions), f = montant(fondsTravaux);
    const quart = (t) => Math.floor((t / 4) * 100) / 100;
    return [0, 1, 2, 3].map((i) => {
      const dernier = i === 3;
      return normaliserAppel({
        exercice: annee,
        libelle: `Appel du trimestre ${i + 1}`,
        echeance: ajoutMois(debutExercice(annee, c.debutExercice), i * 3),
        provisions: dernier ? arrondi(p - quart(p) * 3) : quart(p),
        fondsTravaux: dernier ? arrondi(f - quart(f) * 3) : quart(f),
      }, c.debutExercice);
    });
  }

  // ---------- Travaux votés ----------
  const lignesTravaux = (c, tid) => (c.appels || []).flatMap((a) => (a.travaux || []).filter((l) => l.travaux === tid).map((l) => ({ ...l, appel: a })));
  function suiviTravaux(c, t) {
    const lignes = lignesTravaux(c, t.id);
    const appele = somme(lignes, (l) => l.montant);
    const paye = somme(lignes.filter((l) => l.appel.payeLe), (l) => l.montant);
    const prevu = somme(t.echeancier, (e) => e.montant);
    const echeances = [...t.echeancier].sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))).map((e) => {
      const l = lignes.find((x) => x.echeance === e.id);
      return { ...e, appel: l ? l.appel.id : null, payeLe: l ? l.appel.payeLe : null };
    });
    return { appele, paye, prevu, reste: Math.max(0, arrondi(t.quotePart - appele)), sansEcheancier: Math.max(0, arrondi(t.quotePart - prevu)), echeances };
  }
  // Échéances de travaux pas encore rattachées à un appel, proposées à la saisie d'un appel (jusqu'à 45 jours après).
  function echeancesAAppeler(c, date, { sauf = null } = {}) {
    const out = [];
    for (const t of c.travaux || []) {
      if (t.statut === 'abandonne') continue;
      const prises = new Set(lignesTravaux(c, t.id).filter((l) => l.appel.id !== sauf).map((l) => l.echeance));
      for (const e of t.echeancier) if (!prises.has(e.id) && (!date || !e.date || e.date <= ajout(date, 45))) out.push({ travaux: t.id, nom: t.nom, echeance: e.id, date: e.date, montant: e.montant });
    }
    return out.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
  }

  // ---------- Exercices : régularisation, répartition, part récupérable ----------
  const exerciceDe = (c, annee) => (c.exercices || []).find((e) => e.annee === annee) || null;
  const chargesTotal = (e) => (e ? somme(e.charges, (l) => l.montant) : 0);
  const recupDe = (c, poste) => (c.recup && Number.isFinite(c.recup[poste]) ? c.recup[poste] : 0);
  function syntheseExercice(c, annee, auj) {
    const appels = (c.appels || []).filter((a) => a.exercice === annee);
    const e = exerciceDe(c, annee);
    const provisions = somme(appels, (a) => a.provisions);
    const charges = chargesTotal(e);
    const saisi = !!e && e.charges.length > 0;
    const recuperable = e ? somme(e.charges, (l) => l.montant * recupDe(c, l.poste) / 100) : 0;
    return {
      annee, nbAppels: appels.length,
      provisions, fondsTravaux: somme(appels, (a) => a.fondsTravaux), travaux: somme(appels, totalTravauxAppel), autres: somme(appels, (a) => a.autres),
      appele: somme(appels, totalAppel), paye: somme(appels.filter((a) => a.payeLe), totalAppel),
      resteAPayer: somme(appels.filter((a) => !a.payeLe), totalAppel),
      enRetard: auj ? appels.filter((a) => !a.payeLe && a.echeance < auj).length : 0,
      budget: e?.budget ?? null,
      chargesSaisies: saisi, charges,
      // Régularisation : charges réelles − provisions appelées. > 0 : complément à payer ; < 0 : trop-versé à recevoir.
      regularisation: saisi ? arrondi(charges - provisions) : null,
      approuveLe: e?.approuveLe ?? null, regleLe: e?.regleLe ?? null,
      recuperable: arrondi(recuperable), nonRecuperable: arrondi(charges - recuperable),
      // Rapport fonds de travaux / provisions du budget (sur la quote-part : indicatif).
      tauxFonds: provisions > 0 ? (somme(appels, (a) => a.fondsTravaux) / provisions) * 100 : null,
    };
  }
  function repartition(c, annee, base) {
    const e = exerciceDe(c, annee);
    if (!e) return [];
    const total = chargesTotal(e);
    const prec = exerciceDe(c, annee - 1);
    return e.charges.filter((l) => l.montant !== 0).map((l) => {
      const p = base.postes.find((x) => x.id === l.poste);
      const avant = prec ? prec.charges.find((x) => x.poste === l.poste)?.montant ?? null : null;
      return {
        poste: l.poste, nom: p ? p.nom : l.poste, montant: l.montant, part: total ? (l.montant / total) * 100 : null,
        recupPct: recupDe(c, l.poste), recuperable: arrondi(l.montant * recupDe(c, l.poste) / 100),
        avant, variation: avant ? ((l.montant - avant) / Math.abs(avant)) * 100 : null,
      };
    }).sort((a, b) => b.montant - a.montant || a.nom.localeCompare(b.nom, 'fr'));
  }
  // Évolution sur plusieurs exercices : charges réelles et provisions appelées, années saisies seulement.
  function evolution(c, auj) {
    const annees = [...new Set([...(c.exercices || []).filter((e) => e.charges.length).map((e) => e.annee), ...(c.appels || []).map((a) => a.exercice)])].sort((a, b) => a - b);
    return annees.map((annee, i) => {
      const s = syntheseExercice(c, annee, auj);
      return { annee, charges: s.chargesSaisies ? s.charges : null, provisions: s.nbAppels ? s.provisions : null, recuperable: s.chargesSaisies ? s.recuperable : null, regularisation: s.regularisation, rang: i };
    });
  }
  // Tableau poste × années (montants), pour la vue tableau du graphique d'évolution.
  function matricePostes(c, base) {
    const ex = (c.exercices || []).filter((e) => e.charges.length).sort((a, b) => a.annee - b.annee);
    const postes = base.postes.filter((p) => ex.some((e) => e.charges.some((l) => l.poste === p.id && l.montant !== 0)));
    return { annees: ex.map((e) => e.annee), lignes: postes.map((p) => ({ poste: p.id, nom: p.nom, valeurs: ex.map((e) => e.charges.find((l) => l.poste === p.id)?.montant ?? null) })), totaux: ex.map(chargesTotal) };
  }
  // Part récupérable proposée par l'aide : catégories citées par la fiche F947 (modifiable, jamais imposée).
  function recupPropose(base, actuel = {}) {
    const out = { ...actuel };
    for (const p of base.postes) if (p.propose !== null && p.propose !== undefined && out[p.id] === undefined) out[p.id] = p.propose;
    return out;
  }

  // ---------- Assemblées générales ----------
  const trierAssemblees = (l) => [...l].sort((a, b) => b.date.localeCompare(a.date));
  function etatResolution(ag, r, auj) {
    if (r.resultat) return r.resultat;
    return ag.date > auj ? 'avenir' : 'attente';
  }
  function etatAssemblee(ag, auj, alerteAG = 21) {
    if (ag.date > auj) return ecart(auj, ag.date) <= alerteAG && !ag.preparee ? 'apreparer' : ag.preparee ? 'preparee' : 'avenir';
    if (ag.date === auj) return 'aujourdhui';
    return ag.resolutions.some((r) => !r.resultat) ? 'resultats' : 'tenue';
  }
  const sansIntention = (ag) => ag.resolutions.filter((r) => !r.vote).length;
  const prochaineAssemblee = (c, auj) => [...(c.assemblees || [])].filter((a) => a.date >= auj).sort((a, b) => a.date.localeCompare(b.date))[0] || null;

  // ---------- Alertes ----------
  // Appels à payer (retard, proche), appel de travaux attendu, AG à préparer, résultats à noter, régularisation.
  function alertes(etat, base, auj) {
    const g = etat.reglages;
    const out = [];
    for (const c of etat.copros || []) {
      for (const a of c.appels) {
        if (a.payeLe) continue;
        const n = niveau(a.echeance, auj, g.alerte);
        out.push({ copro: c.id, type: 'appel', id: a.id, date: a.echeance, niveau: n, montant: totalAppel(a) });
      }
      for (const t of c.travaux) {
        if (t.statut === 'abandonne') continue;
        for (const e of suiviTravaux(c, t).echeances) {
          if (e.appel || !e.date || ecart(auj, e.date) > g.alerte) continue;
          out.push({ copro: c.id, type: 'travaux', id: t.id, echeance: e.id, date: e.date, niveau: 'proche', montant: e.montant });
        }
      }
      for (const ag of c.assemblees) {
        const s = etatAssemblee(ag, auj, g.alerteAG);
        if (s === 'apreparer') out.push({ copro: c.id, type: 'ag', id: ag.id, date: ag.date, niveau: 'proche', sansIntention: sansIntention(ag) });
        if (s === 'resultats' && ecart(ag.date, auj) <= 120) out.push({ copro: c.id, type: 'resultats', id: ag.id, date: ag.date, niveau: 'proche', nb: ag.resolutions.filter((r) => !r.resultat).length });
      }
      for (const e of c.exercices) {
        if (!e.approuveLe || e.regleLe || !e.charges.length) continue;
        const s = syntheseExercice(c, e.annee, auj);
        if (s.nbAppels && Math.abs(s.regularisation) >= 1) out.push({ copro: c.id, type: 'regularisation', id: e.id, annee: e.annee, date: e.approuveLe, niveau: 'proche', montant: s.regularisation });
      }
    }
    const rang = { retard: 0, proche: 1, avenir: 2 };
    return out.sort((a, b) => rang[a.niveau] - rang[b.niveau] || String(a.date || '9999').localeCompare(String(b.date || '9999')));
  }

  // ---------- Recherche ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function rechercherDocuments(docs, q) {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return docs;
    return docs.filter((d) => { const t = sansAccents([d.nom, d.type, d.rangement, d.note, d.exercice].join(' ')); return mots.every((m) => t.includes(m)); });
  }
  const anneesCopro = (c, auj) => [...new Set([exercice(auj, c.debutExercice), ...c.exercices.map((e) => e.annee), ...c.appels.map((a) => a.exercice)])].sort((a, b) => b - a);

  // ---------- Export CSV (séparateur « ; », virgule décimale, BOM pour les tableurs) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (n) => (n === null || n === undefined ? '' : String(arrondi(n)).replace('.', ','));
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsvAppels(c) {
    const nomT = (id) => c.travaux.find((t) => t.id === id)?.nom || '';
    return csv([['Exercice', 'Appel', 'Échéance', 'Provisions', 'Fonds de travaux', 'Travaux', 'Détail des travaux', 'Autres', 'Total', 'Payé le', 'Note'],
      ...trierAppels(c.appels).map((a) => [a.exercice, a.libelle, a.echeance, nombreCsv(a.provisions), nombreCsv(a.fondsTravaux), nombreCsv(totalTravauxAppel(a)), a.travaux.map((l) => `${nomT(l.travaux)} ${nombreCsv(l.montant)}`).join(' | '), nombreCsv(a.autres), nombreCsv(totalAppel(a)), a.payeLe || '', a.note])]);
  }
  function versCsvCharges(c, base) {
    const m = matricePostes(c, base);
    return csv([['Poste', 'Part récupérable (%)', ...m.annees.map(String)],
      ...m.lignes.map((l) => [l.nom, nombreCsv(recupDe(c, l.poste)), ...l.valeurs.map(nombreCsv)]),
      ['Total', '', ...m.totaux.map(nombreCsv)],
      ['Provisions appelées', '', ...m.annees.map((a) => nombreCsv(syntheseExercice(c, a).provisions))]]);
  }
  function versCsvResolutions(c) {
    return csv([['Date', 'Assemblée', 'N°', 'Résolution', 'Majorité (saisie)', 'Montant', 'Mon vote', 'Résultat'],
      ...trierAssemblees(c.assemblees).flatMap((ag) => ag.resolutions.map((r) => [ag.date, ag.type === 'extraordinaire' ? 'Extraordinaire' : 'Ordinaire', r.numero, r.titre, r.majorite, nombreCsv(r.montant), r.vote ? LIB_VOTE[r.vote] : '', r.resultat ? LIB_RESULTAT[r.resultat] : '']))]);
  }

  racine.CPR = {
    VOTES, LIB_VOTE, RESULTATS, LIB_RESULTAT, STATUTS_TRAVAUX, LIB_TRAVAUX, MAX,
    iso, versDate, ajout, ajoutMois, ecart, estDate, pluriel, exercice, debutExercice, finExercice, libelleExercice,
    arrondi, somme, euros, pct, lireNombre, montantOuNull, montantSigne, pourcentOuNull, nouvelId, sansAccents,
    reglagesDe, normaliserLot, normaliserAppel, normaliserExercice, normaliserResolution, normaliserAssemblee, normaliserEcheance,
    normaliserTravaux, normaliserDocument, normaliserCopro, etatVide, normaliser,
    tantiemesLots, part, quotePart, aLoue, totalTravauxAppel, totalAppel, niveau, etatAppel, trierAppels, appelsTrimestriels,
    suiviTravaux, echeancesAAppeler, exerciceDe, chargesTotal, recupDe, syntheseExercice, repartition, evolution, matricePostes, recupPropose,
    trierAssemblees, etatResolution, etatAssemblee, sansIntention, prochaineAssemblee, alertes, rechercherDocuments, anneesCopro,
    versCsvAppels, versCsvCharges, versCsvResolutions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
