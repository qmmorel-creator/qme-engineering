// Contrats fournisseurs et échéances QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CTR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Moteur d'échéances commun aux templates
// d'échéances QME (vérifications, entretien, visa) : date + durée en mois (fin de mois bornée) ou en jours.
(function (racine) {
  'use strict';

  const B = racine.BASE || {};
  const STATUTS = ['depassee', 'j30', 'j60', 'inconnue', 'ok', 'resilie', 'termine'];
  const LIB_STATUT = { depassee: 'Préavis dépassé', j30: 'À traiter', j60: 'À anticiper', inconnue: 'À compléter', ok: 'Rien à faire', resilie: 'Résiliation envoyée', termine: 'Terminé' };
  const LIB_EVT = { creation: 'Contrat ajouté', decision: 'Décision', renegociation: 'Renégociation', resiliation: 'Résiliation envoyée', annulation: 'Résiliation annulée', reconduction: 'Reconduction tacite', note: 'Note' };

  // ---------- Dates (moteur commun) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const finMois = (s) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m, 0)); };
  // Ajoute n mois (n négatif possible) ; le 31 janvier + 1 mois donne le 28 (ou 29) février.
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12;
    const dernier = new Date(an, mo + 1, 0).getDate();
    return iso(new Date(an, mo, Math.min(j, dernier)));
  }
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const arrondi = (n) => Math.round(n * 100) / 100;

  // ---------- Catégories et périodicités ----------
  const periodicite = (id) => (B.periodicites || []).find((p) => p.id === id) || (B.periodicites || [])[0] || { id: 'mensuel', nom: 'Par mois', court: '/ mois', parAn: 12 };
  function categorie(etat, id) {
    const cats = etat.categories || [];
    return cats.find((c) => c.id === id) || cats.find((c) => c.id === 'autre') || { id: 'autre', nom: 'Autre', preavisMois: null, reconduction: 'tacite', dureeMois: 12, couleur: 0 };
  }
  const sourceCategorie = (id) => (B.categories || []).find((c) => c.id === id)?.source || null;

  // Libellé d'un préavis { mois } ou { jours }.
  function libellePreavis(p) {
    if (!p) return 'Préavis à saisir';
    if (!p.mois) return p.jours ? `${p.jours} jour${p.jours > 1 ? 's' : ''}` : 'Aucun préavis';
    return `${p.mois} mois`;
  }
  // Préavis appliqué : celui du contrat (prioritaire), sinon celui de la catégorie. origine : 'contrat' | 'categorie'.
  function preavis(c, etat) {
    if (c.preavis && (c.preavis.mois > 0 || c.preavis.jours > 0)) return { ...(c.preavis.jours > 0 ? { jours: c.preavis.jours } : { mois: c.preavis.mois }), origine: 'contrat' };
    if (c.preavis && c.preavis.jours === 0) return { jours: 0, origine: 'contrat' };
    const cat = categorie(etat, c.categorie);
    if (Number.isInteger(cat.preavisMois) && cat.preavisMois >= 0) return { mois: cat.preavisMois, origine: 'categorie' };
    return null;
  }
  const reculer = (date, p) => (p.jours !== undefined && !p.mois ? ajout(date, -(p.jours || 0)) : ajoutMois(date, -p.mois));
  const dureeReconduction = (c, etat) => (c.dureeReconductionMois > 0 ? c.dureeReconductionMois : (categorie(etat, c.categorie).dureeMois || 12));

  // Coût annuel : montant × nombre de paiements par an (paiement unique : 0, montré à part).
  const coutAnnuel = (c) => arrondi((Number(c.montant) || 0) * periodicite(c.periodicite).parAn);

  // Échéance de la période en cours : la date de fin saisie, avancée d'une durée de reconduction tant
  // qu'elle est passée (reconduction tacite). Renvoie aussi les dates de reconduction déjà intervenues.
  function echeance(c, etat, auj) {
    if (!estDate(c.fin)) return { fin: null, reconductions: [] };
    let fin = c.fin;
    const reconductions = [];
    if (c.reconduction === 'tacite' && c.statut !== 'resilie') {
      const d = dureeReconduction(c, etat);
      for (let i = 0; i < 600 && fin < auj; i++) { reconductions.push(fin); fin = ajoutMois(fin, d); }
    }
    return { fin, reconductions };
  }

  // Date limite de réception de la résiliation (échéance − préavis) et date conseillée d'envoi (− marge).
  function limites(fin, p, marge) {
    if (!fin || !p) return { limite: null, envoi: null };
    const limite = reculer(fin, p);
    return { limite, envoi: ajout(limite, -Math.max(0, marge || 0)) };
  }

  function situation(c, etat, auj) {
    const r = etat.reglages || {};
    const longue = r.alerteLongue ?? 60, courte = r.alerteCourte ?? 30, marge = r.margeEnvoi ?? 7;
    const cat = categorie(etat, c.categorie);
    const p = preavis(c, etat);
    const { fin, reconductions } = echeance(c, etat, auj);
    const { limite, envoi } = limites(fin, p, marge);
    // La décision ne vaut que pour l'échéance où elle a été prise : à la reconduction, on redécide.
    const decision = c.decision !== 'a-decider' && c.decisionPour && c.decisionPour === fin ? c.decision : 'a-decider';
    const tacite = c.reconduction === 'tacite';
    let statut, jours = null;
    if (c.statut === 'resilie') {
      const effet = c.resiliation?.effetLe || fin;
      statut = effet && effet < auj ? 'termine' : 'resilie';
    } else if (!fin) statut = 'inconnue';
    else if (!tacite && fin < auj) statut = 'termine';
    else {
      // Sans reconduction tacite, le contrat s'arrête seul : l'alerte porte sur la fin (renouveler ou remplacer).
      const cle = tacite ? (envoi || fin) : fin;
      jours = ecart(auj, cle);
      statut = jours < 0 ? 'depassee' : jours <= courte ? 'j30' : jours <= longue ? 'j60' : 'ok';
    }
    // Préavis dépassé sur une reconduction tacite : la prochaine vraie occasion est l'échéance suivante.
    let suivante = null;
    if (statut === 'depassee' && tacite && fin) {
      const finSuivante = ajoutMois(fin, dureeReconduction(c, etat));
      suivante = { fin: finSuivante, ...limites(finSuivante, p, marge) };
    }
    return {
      c, categorie: cat, preavis: p, fin, reconductions, limite, envoi, statut, jours, decision, tacite, suivante,
      joursFin: fin ? ecart(auj, fin) : null,
      sansPreavis: !p, coutAnnuel: coutAnnuel(c), periodicite: periodicite(c.periodicite),
      actif: statut !== 'termine' && statut !== 'resilie',
    };
  }

  const ordreStatut = (s) => STATUTS.indexOf(s);
  const trier = (liste) => liste.sort((a, b) => ordreStatut(a.statut) - ordreStatut(b.statut) || (a.envoi || a.fin || '9999').localeCompare(b.envoi || b.fin || '9999') || a.c.nom.localeCompare(b.c.nom));
  const situations = (etat, auj) => trier((etat.contrats || []).map((c) => situation(c, etat, auj)));

  // Alertes : préavis dépassé (contrat reconduit malgré soi), J-30, J-60, dates manquantes.
  // Une décision « Renouveler » pour l'échéance en cours éteint l'alerte.
  function alertes(etat, auj) {
    return situations(etat, auj).filter((s) => {
      if (s.statut === 'inconnue') return true;
      if (!['depassee', 'j30', 'j60'].includes(s.statut)) return false;
      if (s.decision === 'renouveler') return false;
      // Préavis dépassé : on le signale jusqu'à l'échéance (après, c'est une reconduction faite).
      return true;
    });
  }

  // Indicateurs : coûts annuels des contrats en cours, alertes, économies.
  function synthese(etat, auj) {
    const sits = situations(etat, auj);
    const actifs = sits.filter((s) => s.actif);
    const compte = (st) => alertes(etat, auj).filter((s) => s.statut === st).length;
    const depuis = ajoutMois(auj, -12);
    const evts = (etat.historique || []).filter((h) => h.date >= depuis && h.date <= auj && Number.isFinite(h.coutAvant) && Number.isFinite(h.coutApres));
    return {
      nb: actifs.length,
      coutAnnuel: arrondi(actifs.reduce((t, s) => t + s.coutAnnuel, 0)),
      uniques: arrondi(actifs.filter((s) => s.periodicite.parAn === 0).reduce((t, s) => t + (Number(s.c.montant) || 0), 0)),
      depassee: compte('depassee'), j30: compte('j30'), j60: compte('j60'), inconnue: compte('inconnue'),
      tacites: actifs.filter((s) => s.tacite).length,
      aResilier: actifs.filter((s) => s.decision === 'resilier'),
      economiesPrevues: arrondi(actifs.filter((s) => s.decision === 'resilier').reduce((t, s) => t + s.coutAnnuel, 0)),
      economiesObtenues: arrondi(evts.reduce((t, h) => t + Math.max(0, h.coutAvant - h.coutApres), 0)),
      nbEconomies: evts.filter((h) => h.coutAvant > h.coutApres).length,
    };
  }

  // Coût annuel par catégorie (contrats en cours), trié du plus cher au moins cher.
  function parCategorie(etat, auj) {
    const actifs = situations(etat, auj).filter((s) => s.actif);
    return (etat.categories || []).map((cat) => {
      const l = actifs.filter((s) => s.categorie.id === cat.id);
      return { categorie: cat, nb: l.length, cout: arrondi(l.reduce((t, s) => t + s.coutAnnuel, 0)) };
    }).filter((x) => x.nb).sort((a, b) => b.cout - a.cout || a.categorie.nom.localeCompare(b.categorie.nom));
  }
  function parFournisseur(etat, auj) {
    const m = new Map();
    for (const s of situations(etat, auj).filter((x) => x.actif)) {
      const cle = s.c.fournisseur || 'Fournisseur non renseigné';
      const x = m.get(cle) || { fournisseur: cle, nb: 0, cout: 0, categories: new Set() };
      x.nb++; x.cout = arrondi(x.cout + s.coutAnnuel); x.categories.add(s.categorie.nom);
      m.set(cle, x);
    }
    return [...m.values()].map((x) => ({ ...x, categories: [...x.categories] })).sort((a, b) => b.cout - a.cout || a.fournisseur.localeCompare(b.fournisseur));
  }

  // Calendrier des 12 prochains mois : dates d'envoi conseillées et échéances, reconductions comprises.
  function calendrier(etat, auj, nbMois = 12) {
    const debut = `${auj.slice(0, 7)}-01`;
    const fin = finMois(ajoutMois(debut, nbMois - 1));
    const mois = Array.from({ length: nbMois }, (_, i) => ({ mois: ajoutMois(debut, i).slice(0, 7), lignes: [] }));
    const sansDate = [];
    const place = (date, genre, s) => { const m = mois.find((x) => x.mois === date.slice(0, 7)); if (m && date >= auj) m.lignes.push({ date, genre, situation: s }); };
    for (const s of situations(etat, auj)) {
      if (!s.actif && s.statut !== 'resilie') continue;
      if (!s.fin) { sansDate.push(s); continue; }
      if (s.statut === 'resilie') { const effet = s.c.resiliation?.effetLe || s.fin; if (effet <= fin) place(effet, 'fin-resilie', s); continue; }
      let f = s.fin;
      const d = dureeReconduction(s.c, etat);
      for (let i = 0; i < 400 && f; i++) {
        const { envoi } = limites(f, s.preavis, etat.reglages?.margeEnvoi ?? 7);
        if (f > fin && (!envoi || envoi > fin)) break;
        if (s.tacite && envoi && envoi <= fin) place(envoi, 'envoi', s);
        if (f <= fin) place(f, s.tacite ? 'reconduction' : 'fin', s);
        if (!s.tacite) break;
        f = ajoutMois(f, d);
      }
    }
    const poids = { envoi: 0, fin: 1, 'fin-resilie': 1, reconduction: 2 };
    for (const m of mois) m.lignes.sort((a, b) => a.date.localeCompare(b.date) || poids[a.genre] - poids[b.genre] || a.situation.c.nom.localeCompare(b.situation.c.nom));
    return { mois, sansDate };
  }

  // Historique : événements enregistrés + reconductions tacites déduites des dates, du plus récent au plus ancien.
  function historique(etat, auj, contratId = '') {
    const liste = (etat.historique || []).filter((h) => !contratId || h.contrat === contratId).map((h) => ({ ...h }));
    for (const c of etat.contrats || []) {
      if (contratId && c.id !== contratId) continue;
      const { reconductions } = echeance(c, etat, auj);
      for (const d of reconductions) liste.push({ id: `rec-${c.id}-${d}`, contrat: c.id, date: d, type: 'reconduction', texte: `Reconduit tacitement pour ${dureeReconduction(c, etat)} mois.`, derive: true });
    }
    return liste.sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  }

  // ---------- Actions (modifient l'état, renvoient l'objet ou une chaîne d'erreur) ----------
  const contrat = (etat, id) => (etat.contrats || []).find((c) => c.id === id);
  function journal(etat, evt, nouvel = nouvelId) {
    const h = normaliserEvenement({ id: nouvel(), ...evt });
    etat.historique = [...(etat.historique || []), h];
    return h;
  }

  function decider(etat, id, decision, auj, note = '', nouvel = nouvelId) {
    const c = contrat(etat, id);
    if (!c) return 'Ce contrat n\'existe plus.';
    if (!(B.decisions || []).some((d) => d.id === decision)) return 'Choisis une décision.';
    const { fin } = echeance(c, etat, auj);
    c.decision = decision;
    c.decisionPour = decision === 'a-decider' ? null : fin;
    const nom = (B.decisions || []).find((d) => d.id === decision).nom;
    journal(etat, { contrat: c.id, date: auj, type: 'decision', texte: `${nom}${fin ? ` (échéance du ${fin.split('-').reverse().join('/')})` : ''}${texte(note, 300) ? ` : ${texte(note, 300)}` : ''}` }, nouvel);
    return c;
  }

  // Renégociation : nouveau montant (et périodicité), nouvelle date de fin facultative ; l'écart de coût
  // annuel est gardé dans l'historique (économies obtenues).
  function renegocier(etat, id, { date, montant, periodicite: per, fin, note = '' }, auj, nouvel = nouvelId) {
    const c = contrat(etat, id);
    if (!c) return 'Ce contrat n\'existe plus.';
    if (!estDate(date)) return 'Indique la date de l\'accord.';
    if (auj && date > auj) return 'La date de l\'accord ne peut pas être dans le futur.';
    const m = lireMontant(montant);
    if (m === null || Number.isNaN(m)) return 'Indique le nouveau montant (par exemple 120 ou 120,50).';
    if (fin && !estDate(fin)) return 'Nouvelle date de fin illisible.';
    const avant = coutAnnuel(c);
    c.montant = m;
    if (per && (B.periodicites || []).some((p) => p.id === per)) c.periodicite = per;
    if (fin) c.fin = fin;
    const apres = coutAnnuel(c);
    const { fin: f } = echeance(c, etat, auj || date);
    c.decision = 'renouveler';
    c.decisionPour = f;
    journal(etat, { contrat: c.id, date, type: 'renegociation', texte: texte(note, 300) || 'Nouvelles conditions obtenues.', coutAvant: avant, coutApres: apres }, nouvel);
    return c;
  }

  // Résiliation envoyée : prend effet à l'échéance en cours si elle part au plus tard à la date limite,
  // sinon à l'échéance suivante (reconduction tacite) : l'utilisateur peut corriger la date d'effet.
  function resilier(etat, id, { envoyeeLe, mode = '', reference = '', effetLe = '' }, auj, nouvel = nouvelId) {
    const c = contrat(etat, id);
    if (!c) return 'Ce contrat n\'existe plus.';
    if (!estDate(envoyeeLe)) return 'Indique la date d\'envoi.';
    if (auj && envoyeeLe > auj) return 'La date d\'envoi ne peut pas être dans le futur.';
    const s = situation(c, etat, envoyeeLe);
    let effet = estDate(effetLe) ? effetLe : null, tardive = false;
    if (!effet) {
      if (s.fin && s.limite && envoyeeLe > s.limite && s.tacite) { tardive = true; effet = ajoutMois(s.fin, dureeReconduction(c, etat)); } else effet = s.fin;
    }
    if (!effet) return 'Indique la date de fin effective du contrat.';
    if (effet < envoyeeLe) return 'La fin effective ne peut pas précéder l\'envoi.';
    c.statut = 'resilie';
    c.decision = 'resilier';
    c.decisionPour = s.fin;
    c.resiliation = { envoyeeLe, effetLe: effet, mode: texte(mode, 80), reference: texte(reference, 80) };
    journal(etat, { contrat: c.id, date: envoyeeLe, type: 'resiliation', texte: `Fin effective le ${effet.split('-').reverse().join('/')}${tardive ? ' (envoi après la date limite : échéance suivante)' : ''}${c.resiliation.mode ? ` · ${c.resiliation.mode}` : ''}${c.resiliation.reference ? ` · réf. ${c.resiliation.reference}` : ''}.`, coutAvant: coutAnnuel(c), coutApres: 0 }, nouvel);
    return { contrat: c, effetLe: effet, tardive };
  }

  function annulerResiliation(etat, id, auj, nouvel = nouvelId) {
    const c = contrat(etat, id);
    if (!c || c.statut !== 'resilie') return 'Ce contrat n\'est pas résilié.';
    c.statut = 'actif';
    c.resiliation = null;
    c.decision = 'a-decider';
    c.decisionPour = null;
    journal(etat, { contrat: c.id, date: auj, type: 'annulation', texte: 'Résiliation annulée : le contrat continue.' }, nouvel);
    return c;
  }

  function supprimerContrat(etat, id) {
    return { ...etat, contrats: (etat.contrats || []).filter((c) => c.id !== id), historique: (etat.historique || []).filter((h) => h.contrat !== id) };
  }

  // ---------- Lettre de résiliation (modèle à adapter) ----------
  const dateFr = (s) => (estDate(s) ? versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '[date]');
  function lettre(etat, c, auj) {
    const s = situation(c, etat, auj);
    const L = etat.lettre || {};
    const cible = s.statut === 'depassee' && s.suivante ? s.suivante.fin : s.fin;
    const lignes = [
      etat.structure || '[Raison sociale]',
      L.adresse || '[Adresse de l\'entreprise]',
      '',
      c.fournisseur || '[Fournisseur]',
      '[Service résiliation, adresse indiquée au contrat]',
      '',
      `${L.ville ? `${L.ville}, le ` : 'Le '}${dateFr(auj)}`,
      '',
      `Objet : résiliation du contrat${c.reference ? ` n° ${c.reference}` : ''} (${c.nom})`,
      `${(B.modesEnvoi || [])[0]} (ou la forme prévue au contrat)`,
      '',
      'Madame, Monsieur,',
      '',
      `Par la présente, nous vous notifions notre décision de résilier le contrat${c.reference ? ` n° ${c.reference}` : ''} relatif à : ${c.nom}${estDate(c.debut) ? `, souscrit le ${dateFr(c.debut)}` : ''}. Cette résiliation prendra effet à l'échéance du ${dateFr(cible)}${s.preavis && (s.preavis.mois || s.preavis.jours) ? `, dans le respect du préavis de ${libellePreavis(s.preavis)} prévu au contrat` : ''}.`,
      '',
      'Nous vous remercions de nous confirmer par écrit la bonne réception de ce courrier et la date de fin effective du contrat, ainsi que les modalités de clôture (dernière facture, restitution du matériel le cas échéant). Aucun prélèvement ne devra intervenir après cette date.',
      '',
      'Nous vous prions d\'agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.',
      '',
      L.signataire || '[Nom du signataire]',
      L.fonction || '[Fonction]',
    ];
    return lignes.join('\n');
  }

  // ---------- Saisie ----------
  function lireMontant(v) {
    const s = String(v ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n < 1e9 ? arrondi(n) : NaN;
  }
  // Préavis saisi : nombre + unité ('mois' | 'jours'). null si vide (catégorie), NaN si illisible.
  function lirePreavis(nombre, unite) {
    const s = String(nombre ?? '').trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    if (!Number.isInteger(n) || n < 0) return NaN;
    if (unite === 'jours') return n > 730 ? NaN : { jours: n };
    return n > 36 ? NaN : (n === 0 ? { jours: 0 } : { mois: n });
  }
  function lireLien(saisie) {
    const s = String(saisie ?? '').trim();
    if (!s) return '';
    return /^https?:\/\/[^\s<>"'`]+$/i.test(s) && s.length <= 500 ? s : null;
  }

  // ---------- Normalisation ----------
  function normaliserCategorie(c, i = 0) {
    const pm = c.preavisMois === null || c.preavisMois === '' || c.preavisMois === undefined ? null : Math.round(Number(c.preavisMois));
    return {
      id: texte(c.id, 40) || nouvelId(), nom: texte(c.nom, 60) || 'Catégorie',
      preavisMois: Number.isInteger(pm) && pm >= 0 && pm <= 36 ? pm : null,
      reconduction: c.reconduction === 'aucune' ? 'aucune' : 'tacite',
      dureeMois: Math.round(Number(c.dureeMois)) >= 1 && Math.round(Number(c.dureeMois)) <= 120 ? Math.round(Number(c.dureeMois)) : 12,
      couleur: Number.isInteger(c.couleur) ? c.couleur : i % ((B.couleurs || []).length || 1),
    };
  }
  const categoriesBase = () => (B.categories || []).map((c, i) => normaliserCategorie({ ...c, couleur: i }, i));
  function normaliserContrat(c) {
    const p = c.preavis;
    let pv = null;
    if (p && Number(p.jours) >= 0 && p.jours !== undefined && p.jours !== null && !(Number(p.mois) > 0)) pv = { jours: Math.round(Number(p.jours)) };
    else if (p && Number(p.mois) > 0) pv = { mois: Math.round(Number(p.mois)) };
    const r = c.resiliation;
    return {
      id: String(c.id || nouvelId()), nom: texte(c.nom, 100) || 'Contrat', fournisseur: texte(c.fournisseur, 80), categorie: texte(c.categorie, 40) || 'autre',
      reference: texte(c.reference, 60), montant: Number.isFinite(Number(c.montant)) && Number(c.montant) >= 0 ? arrondi(Number(c.montant)) : 0,
      periodicite: (B.periodicites || []).some((x) => x.id === c.periodicite) ? c.periodicite : 'mensuel',
      debut: estDate(c.debut) ? c.debut : null, fin: estDate(c.fin) ? c.fin : null,
      reconduction: c.reconduction === 'aucune' ? 'aucune' : 'tacite',
      dureeReconductionMois: Math.round(Number(c.dureeReconductionMois)) >= 1 && Math.round(Number(c.dureeReconductionMois)) <= 120 ? Math.round(Number(c.dureeReconductionMois)) : null,
      preavis: pv,
      decision: (B.decisions || []).some((d) => d.id === c.decision) ? c.decision : 'a-decider',
      decisionPour: estDate(c.decisionPour) ? c.decisionPour : null,
      statut: c.statut === 'resilie' ? 'resilie' : 'actif',
      resiliation: c.statut === 'resilie' && r && estDate(r.envoyeeLe) ? { envoyeeLe: r.envoyeeLe, effetLe: estDate(r.effetLe) ? r.effetLe : null, mode: texte(r.mode, 80), reference: texte(r.reference, 80) } : null,
      contact: texte(c.contact, 100), lien: lireLien(c.lien) || '', note: texte(c.note, 500),
    };
  }
  const TYPES_EVT = Object.keys(LIB_EVT);
  const normaliserEvenement = (h) => ({
    id: String(h.id || nouvelId()), contrat: String(h.contrat || ''), date: estDate(h.date) ? h.date : null,
    type: TYPES_EVT.includes(h.type) && h.type !== 'reconduction' ? h.type : 'note', texte: texte(h.texte, 400),
    ...(Number.isFinite(h.coutAvant) && Number.isFinite(h.coutApres) ? { coutAvant: arrondi(h.coutAvant), coutApres: arrondi(h.coutApres) } : {}),
  });

  function etatVide() {
    return { version: 1, initialise: false, structure: '', reglages: { ...(B.reglages || {}) }, lettre: { adresse: '', ville: '', signataire: '', fonction: '' }, categories: categoriesBase(), contrats: [], historique: [] };
  }
  function normaliser(d) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.structure = texte(d.structure, 80);
    const r = d.reglages || {};
    const ent = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
    const lg = ent(r.alerteLongue, 1, 365), ct = ent(r.alerteCourte, 0, 365), mg = ent(r.margeEnvoi, 0, 60);
    if (lg !== null) e.reglages.alerteLongue = lg;
    if (ct !== null) e.reglages.alerteCourte = Math.min(ct, e.reglages.alerteLongue);
    if (mg !== null) e.reglages.margeEnvoi = mg;
    if (r.mention === 'TTC' || r.mention === 'HT') e.reglages.mention = r.mention;
    const L = d.lettre || {};
    e.lettre = { adresse: texte(L.adresse, 200), ville: texte(L.ville, 60), signataire: texte(L.signataire, 80), fonction: texte(L.fonction, 80) };
    if (Array.isArray(d.categories) && d.categories.length) {
      const vues = new Set();
      e.categories = d.categories.map(normaliserCategorie).filter((c) => !vues.has(c.id) && vues.add(c.id));
      if (!e.categories.some((c) => c.id === 'autre')) e.categories.push(normaliserCategorie({ id: 'autre', nom: 'Autre', preavisMois: null, couleur: e.categories.length }));
    }
    const ids = new Set(e.categories.map((c) => c.id));
    e.contrats = Array.isArray(d.contrats) ? d.contrats.map(normaliserContrat).map((c) => (ids.has(c.categorie) ? c : { ...c, categorie: 'autre' })) : [];
    const cs = new Set(e.contrats.map((c) => c.id));
    e.historique = Array.isArray(d.historique) ? d.historique.map(normaliserEvenement).filter((h) => h.date && cs.has(h.contrat)) : [];
    e.initialise = !!d.initialise || e.contrats.length > 0;
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
  const nombreCsv = (n) => String(arrondi(n)).replace('.', ',');
  const libDecision = (id) => (B.decisions || []).find((d) => d.id === id)?.nom || id;

  function versCsvContrats(etat, auj) {
    const tete = ['Contrat', 'Fournisseur', 'Catégorie', 'Référence', `Montant (${etat.reglages?.mention || 'HT'})`, 'Périodicité', 'Coût annuel', 'Début', 'Échéance en cours', 'Reconduction', 'Préavis', 'Origine du préavis', 'Date limite de réception', 'Envoi conseillé avant le', 'Statut', 'Décision', 'Fin effective (résiliation)', 'Interlocuteur', 'Lien', 'Note'];
    const l = situations(etat, auj).map((s) => [s.c.nom, s.c.fournisseur, s.categorie.nom, s.c.reference, nombreCsv(s.c.montant), s.periodicite.nom, nombreCsv(s.coutAnnuel), s.c.debut || '', s.fin || '', s.tacite ? `Tacite, ${dureeReconduction(s.c, etat)} mois` : 'Aucune', libellePreavis(s.preavis), s.preavis ? (s.preavis.origine === 'contrat' ? 'Contrat' : 'Défaut de la catégorie') : '', s.limite || '', s.envoi || '', LIB_STATUT[s.statut], libDecision(s.decision), s.c.resiliation?.effetLe || '', s.c.contact, s.c.lien, s.c.note]);
    return csv([tete, ...l]);
  }
  function versCsvHistorique(etat, auj) {
    const tete = ['Date', 'Contrat', 'Fournisseur', 'Événement', 'Détail', 'Coût annuel avant', 'Coût annuel après'];
    const l = historique(etat, auj).map((h) => { const c = contrat(etat, h.contrat) || {}; return [h.date, c.nom || '', c.fournisseur || '', LIB_EVT[h.type], h.texte, Number.isFinite(h.coutAvant) ? nombreCsv(h.coutAvant) : '', Number.isFinite(h.coutApres) ? nombreCsv(h.coutApres) : '']; });
    return csv([tete, ...l]);
  }

  racine.CTR = {
    STATUTS, LIB_STATUT, LIB_EVT,
    iso, versDate, estDate, ajout, ecart, finMois, ajoutMois, nouvelId,
    periodicite, categorie, sourceCategorie, libellePreavis, preavis, dureeReconduction, coutAnnuel, echeance, limites,
    situation, situations, alertes, synthese, parCategorie, parFournisseur, calendrier, historique,
    decider, renegocier, resilier, annulerResiliation, supprimerContrat, journal, lettre, libDecision,
    lireMontant, lirePreavis, lireLien, normaliserCategorie, categoriesBase, normaliserContrat, normaliserEvenement, etatVide, normaliser,
    versCsvContrats, versCsvHistorique,
  };
})(typeof window !== 'undefined' ? window : globalThis);
