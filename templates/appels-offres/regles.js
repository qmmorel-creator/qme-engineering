// Règles métier du suivi des appels d'offres et candidatures : fonctions pures, sans DOM ni stockage.
// Chargé par le navigateur (window.CND_REGLES) et par les tests (outils/templates/appels-offres.test.mjs).
// Dates au format AAAA-MM-JJ, calculées en UTC pour éviter les décalages d'heure d'été.
(function (racine) {
  'use strict';

  const deux = (n) => String(n).padStart(2, '0');
  const isoUTC = (d) => `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
  const versUTC = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)); };
  const plusJours = (s, n) => { const d = versUTC(s); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d); };
  const ecartJours = (de, a) => Math.round((versUTC(a) - versUTC(de)) / 86400000);
  // 0 = lundi … 6 = dimanche.
  const jourSemaine = (s) => (versUTC(s).getUTCDay() + 6) % 7;
  const lundi = (s) => plusJours(s, -jourSemaine(s));
  // Une échéance interne qui tombe un samedi ou un dimanche est avancée au vendredi.
  const ouvreAvant = (s) => { const j = jourSemaine(s); return j >= 5 ? plusJours(s, -(j - 4)) : s; };
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

  // ---------- Statuts ----------
  const GO = ['preparation', 'deposee', 'gagnee', 'perdue', 'sanssuite', 'abandon'];
  const DEPOSES = ['deposee', 'gagnee', 'perdue', 'sanssuite'];
  const FINS = ['gagnee', 'perdue', 'sanssuite', 'nogo', 'abandon'];
  const estGo = (c) => GO.includes(c.statut);
  const estDepose = (c) => DEPOSES.includes(c.statut);
  const estFini = (c) => FINS.includes(c.statut);

  // ---------- Grille go/no-go ----------
  // notes : { idCritère: 0..3 }. Score en % des points possibles sur les critères notés.
  function scoreGrille(criteres, notes, seuils = { go: 65, discuter: 45 }) {
    let points = 0, max = 0, notes_ = 0;
    const eliminatoires = [];
    for (const c of criteres) {
      const v = notes?.[c.id];
      if (v === undefined || v === null || v === '') continue;
      const n = Math.max(0, Math.min(3, Number(v)));
      notes_ += 1;
      points += n * c.poids;
      max += 3 * c.poids;
      if (c.eliminatoire && n === 0) eliminatoires.push(c.id);
    }
    const complet = notes_ === criteres.length;
    const pct = max ? Math.round((points / max) * 100) : null;
    let recommandation = null;
    if (eliminatoires.length) recommandation = 'nogo';
    else if (complet) recommandation = pct >= seuils.go ? 'go' : pct >= seuils.discuter ? 'discuter' : 'nogo';
    return { pct, notes: notes_, total: criteres.length, complet, eliminatoires, recommandation };
  }

  // ---------- Pièces et rétroplanning ----------
  function creerPieces(modele, prefixe = 'pc') {
    return (modele?.pieces || []).map((p, i) => ({ id: `${prefixe}${i + 1}`, libelle: p.libelle, delai: Number(p.delai) || 0,
      type: p.type || null, statut: 'afaire', responsable: '', biblio: null, echeance: null }));
  }

  // Échéance d'une pièce : date fixée à la main, sinon date limite moins son délai (avancée au vendredi).
  function echeancePiece(p, dateLimite) {
    if (p.echeance) return p.echeance;
    if (!dateLimite) return null;
    const d = Number(p.delai) || 0;
    return d > 0 ? ouvreAvant(plusJours(dateLimite, -d)) : dateLimite;
  }

  // Dépôt visé : date limite moins la marge choisie (les dépôts de dernière heure échouent parfois).
  function depotVise(c, marge = 1) {
    if (!c.dateLimite) return null;
    return marge > 0 ? plusJours(c.dateLimite, -marge) : c.dateLimite;
  }

  // État d'une pièce de la bibliothèque à une date : sans date de validité, valide, bientôt expirée, expirée.
  function etatBiblio(b, date, seuil = 30) {
    if (!b) return null;
    if (!b.valideJusquau) return { etat: 'sansdate', jours: null };
    const j = ecartJours(date, b.valideJusquau);
    return { etat: j < 0 ? 'expiree' : j <= seuil ? 'bientot' : 'valide', jours: j };
  }

  // État d'une pièce du dossier. alerte : la pièce liée de la bibliothèque n'est plus valide à la date limite.
  function etatPiece(p, c, aujourdhui, biblio = []) {
    const echeance = echeancePiece(p, c.dateLimite);
    const b = p.biblio ? biblio.find((x) => x.id === p.biblio) || null : null;
    let alerte = null;
    if (b && b.valideJusquau) {
      if (b.valideJusquau < aujourdhui) alerte = 'expiree';
      else if (c.dateLimite && b.valideJusquau < c.dateLimite) alerte = 'expire-avant';
    }
    if (p.statut === 'sansobjet') return { etat: 'sansobjet', echeance, b, alerte: null, retard: 0 };
    if (p.statut === 'pret') return { etat: 'pret', echeance, b, alerte, retard: 0 };
    const retard = echeance && echeance < aujourdhui ? ecartJours(echeance, aujourdhui) : 0;
    const etat = retard > 0 ? 'retard' : echeance && ecartJours(aujourdhui, echeance) <= 2 ? 'bientot' : p.statut === 'encours' ? 'encours' : 'afaire';
    return { etat, echeance, b, alerte, retard };
  }

  function avancement(c) {
    const utiles = (c.pieces || []).filter((p) => p.statut !== 'sansobjet');
    const prets = utiles.filter((p) => p.statut === 'pret').length;
    return { prets, utiles: utiles.length, pct: utiles.length ? Math.round((prets / utiles.length) * 100) : 0 };
  }

  // ---------- Transitions ----------
  function decider(consultation, choix, { date, motif = '', modele = null }) {
    const c = copie(consultation);
    c.decision = { choix, date, ...(motif ? { motif } : {}) };
    if (choix === 'go') {
      c.statut = 'preparation';
      if (!c.pieces || !c.pieces.length) c.pieces = creerPieces(modele);
    } else c.statut = 'nogo';
    return c;
  }

  // Dépôt : relance prévue après le délai du type (modifiable ensuite dans le dossier).
  function deposer(consultation, { date, delaiRelance = 21, montantOffre = null }) {
    const c = copie(consultation);
    c.statut = 'deposee';
    c.depot = date;
    c.relancerLe = plusJours(date, delaiRelance);
    if (montantOffre !== null && montantOffre !== '') c.montantOffre = Number(montantOffre);
    return c;
  }

  function noterRelance(consultation, { date, note = '', intervalle = 15 }) {
    const c = copie(consultation);
    (c.relances ||= []).push({ date, note });
    c.relancerLe = plusJours(date, intervalle);
    return c;
  }

  // Résultat : gagnée, perdue, sans suite ou abandonnée. Plus de relance ensuite.
  function cloturer(consultation, statut, { date, montant = null, motif = null, note = '', rang = null }) {
    const c = copie(consultation);
    c.statut = statut;
    c.resultat = { date, ...(montant !== null && montant !== '' ? { montant: Number(montant) } : {}),
      ...(statut === 'perdue' ? { motif: motif || 'inconnu' } : {}), ...(note ? { note } : {}), ...(rang ? { rang: Number(rang) } : {}) };
    c.relancerLe = null;
    return c;
  }

  // Temps passé, en heures (pas d'un quart d'heure), jamais négatif.
  const ajouterTemps = (heures, delta) => Math.max(0, Math.round(((Number(heures) || 0) + Number(delta)) * 4) / 4);

  // ---------- Ce qui est à faire ----------
  // Éléments datés jusqu'à aujourd'hui + horizon : décisions, questions, pièces, dépôts, relances, validité
  // des offres, pièces de la bibliothèque qui expirent. Les retards en premier.
  function aFaire(consultations, biblio, aujourdhui, { horizon = 7, marge = 1, delaiDecision = 7, seuilBiblio = 30 } = {}) {
    const fin = plusJours(aujourdhui, horizon);
    const items = [];
    const pousser = (o) => { if (o.date && o.date <= fin) items.push({ ...o, retard: o.date < aujourdhui ? ecartJours(o.date, aujourdhui) : 0 }); };
    for (const c of consultations) {
      if (c.statut === 'reperee' && c.dateLimite && c.dateLimite >= aujourdhui) pousser({ genre: 'decision', date: plusJours(c.dateLimite, -delaiDecision) < aujourdhui ? aujourdhui : plusJours(c.dateLimite, -delaiDecision), c });
      if (['reperee', 'preparation'].includes(c.statut) && c.dateQuestions && c.dateQuestions >= aujourdhui) pousser({ genre: 'questions', date: c.dateQuestions, c });
      if (c.statut === 'preparation') {
        for (const p of c.pieces || []) {
          const e = etatPiece(p, c, aujourdhui, biblio);
          if (['pret', 'sansobjet'].includes(e.etat)) continue;
          pousser({ genre: 'piece', date: e.echeance, c, piece: p });
        }
        pousser({ genre: 'depot', date: depotVise(c, marge), c });
      }
      if (c.statut === 'deposee') {
        pousser({ genre: 'relance', date: c.relancerLe, c });
        if (c.offreValable && c.offreValable >= aujourdhui) pousser({ genre: 'validite', date: c.offreValable, c });
      }
    }
    for (const b of biblio) {
      const e = etatBiblio(b, aujourdhui, seuilBiblio);
      if (e && ['bientot', 'expiree'].includes(e.etat)) items.push({ genre: 'biblio', date: b.valideJusquau, b, retard: e.etat === 'expiree' ? -e.jours : 0 });
    }
    const ordre = { depot: 0, piece: 1, questions: 2, decision: 3, relance: 4, validite: 5, biblio: 6 };
    return items.sort((a, b) => (b.retard > 0) - (a.retard > 0) || a.date.localeCompare(b.date) || ordre[a.genre] - ordre[b.genre]);
  }

  // Regroupe les pièces d'un même dossier en une ligne (date la plus proche, plus grand retard), ordre conservé.
  function regrouperPieces(items) {
    const sortie = [];
    const parDossier = new Map();
    for (const x of items) {
      if (x.genre !== 'piece') { sortie.push(x); continue; }
      const g = parDossier.get(x.c.id);
      if (g) { g.pieces.push(x.piece); g.retards += x.retard > 0 ? 1 : 0; g.retard = Math.max(g.retard, x.retard); continue; }
      const n = { genre: 'pieces', c: x.c, date: x.date, retard: x.retard, retards: x.retard > 0 ? 1 : 0, pieces: [x.piece] };
      parDossier.set(x.c.id, n);
      sortie.push(n);
    }
    return sortie;
  }

  // ---------- Calendrier ----------
  // Semaines (lundi → dimanche) qui couvrent le mois « AAAA-MM ».
  function grilleMois(mois) {
    const premier = `${mois}-01`;
    const [a, m] = mois.split('-').map(Number);
    const dernier = isoUTC(new Date(Date.UTC(a, m, 0)));
    const semaines = [];
    for (let d = lundi(premier); d <= dernier; d = plusJours(d, 7)) semaines.push(Array.from({ length: 7 }, (_, i) => plusJours(d, i)));
    return semaines;
  }
  const moisSuivant = (mois, n) => { const [a, m] = mois.split('-').map(Number); const t = a * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`; };

  // Événements datés des consultations en cours, entre deux dates incluses.
  function evenements(consultations, debut, fin, marge = 1) {
    const ev = [];
    const ajout = (date, genre, c) => { if (date && date >= debut && date <= fin) ev.push({ date, genre, c }); };
    for (const c of consultations) {
      if (!['reperee', 'preparation', 'deposee'].includes(c.statut)) continue;
      if (c.statut !== 'deposee') { ajout(c.dateLimite, 'limite', c); ajout(c.dateQuestions, 'questions', c); }
      if (c.statut === 'preparation' && depotVise(c, marge) !== c.dateLimite) ajout(depotVise(c, marge), 'depot', c);
      if (c.statut === 'deposee') { ajout(c.relancerLe, 'relance', c); ajout(c.offreValable, 'validite', c); }
    }
    const ordre = { limite: 0, depot: 1, questions: 2, relance: 3, validite: 4 };
    return ev.sort((a, b) => a.date.localeCompare(b.date) || ordre[a.genre] - ordre[b.genre]);
  }

  // ---------- Statistiques ----------
  // Date de référence d'une consultation pour la période : repérage (ou date limite à défaut).
  const dateRef = (c) => c.reperee || c.dateLimite || '';

  function compter(liste) {
    const n = (f) => liste.filter(f).length;
    const gagnees = liste.filter((c) => c.statut === 'gagnee');
    const perdues = n((c) => c.statut === 'perdue');
    const decidees = n((c) => c.statut !== 'reperee');
    const go = n(estGo);
    const deposees = n(estDepose);
    const montantGagne = gagnees.reduce((s, c) => s + (Number(c.resultat?.montant ?? c.montantOffre) || 0), 0);
    const temps = liste.reduce((s, c) => s + (Number(c.temps) || 0), 0);
    const tempsGo = liste.filter(estGo).reduce((s, c) => s + (Number(c.temps) || 0), 0);
    return {
      total: liste.length, decidees, go, nogo: n((c) => c.statut === 'nogo'), deposees, gagnees: gagnees.length, perdues,
      sansSuite: n((c) => c.statut === 'sanssuite'), enAttente: n((c) => c.statut === 'deposee'), abandons: n((c) => c.statut === 'abandon'),
      tauxGo: decidees ? go / decidees : null,
      tauxReussite: gagnees.length + perdues ? gagnees.length / (gagnees.length + perdues) : null,
      montantGagne, montantMoyen: gagnees.length ? montantGagne / gagnees.length : null,
      temps: arrondi(temps), tempsMoyen: go ? arrondi(tempsGo / go, 1) : null,
      heuresParGain: gagnees.length ? arrondi(tempsGo / gagnees.length, 1) : null,
      euroParHeure: tempsGo ? Math.round(montantGagne / tempsGo) : null,
    };
  }

  function statistiques(consultations, { depuis = null, types = [], motifs = [], aujourdhui = null, mois = 12 } = {}) {
    const liste = depuis ? consultations.filter((c) => dateRef(c) >= depuis) : consultations;
    const global = compter(liste);
    const parType = types.map((t) => ({ id: t.id, nom: t.nom, ...compter(liste.filter((c) => c.type === t.id)) })).filter((x) => x.total);
    const perdues = liste.filter((c) => c.statut === 'perdue');
    const parMotif = motifs.map((m) => ({ id: m.id, nom: m.nom, n: perdues.filter((c) => (c.resultat?.motif || 'inconnu') === m.id).length })).filter((m) => m.n);
    // Mois glissants (sur toutes les consultations) : dépôts du mois et résultats gagnés / perdus du mois.
    let parMois = [];
    if (aujourdhui) {
      const fin = aujourdhui.slice(0, 7);
      parMois = Array.from({ length: mois }, (_, i) => moisSuivant(fin, i - mois + 1)).map((m) => ({
        mois: m,
        deposees: consultations.filter((c) => (c.depot || '').startsWith(m)).length,
        gagnees: consultations.filter((c) => c.statut === 'gagnee' && (c.resultat?.date || '').startsWith(m)).length,
        perdues: consultations.filter((c) => c.statut === 'perdue' && (c.resultat?.date || '').startsWith(m)).length,
      }));
    }
    return { global, parType, parMotif, parMois };
  }

  // ---------- Export CSV (point-virgule, pour Excel ou LibreOffice) ----------
  function csv(consultations, B, criteres = B.criteres) {
    const nom = (liste, id) => liste.find((x) => x.id === id)?.nom || '';
    const champ = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const tete = ['Intitulé', 'Acheteur ou client', 'Type', 'Statut', 'Référence', 'Source', 'Repérée le', 'Date limite', 'Score go/no-go (%)',
      'Déposée le', 'Montant estimé', 'Montant de l\'offre', 'Résultat le', 'Montant attribué', 'Motif de perte', 'Temps passé (h)', 'Pièces prêtes'];
    const lignes = consultations.map((c) => {
      const a = avancement(c);
      return [c.titre, c.acheteur, nom(B.types, c.type), nom(B.statuts, c.statut), c.reference, c.source, c.reperee, c.dateLimite,
        c.notes && Object.keys(c.notes).length ? scoreGrille(criteres, c.notes).pct : '', c.depot, c.montantEstime, c.montantOffre, c.resultat?.date, c.resultat?.montant, c.resultat?.motif ? nom(B.motifsPerte, c.resultat.motif) : '',
        String(c.temps ?? '').replace('.', ','), a.utiles ? `${a.prets}/${a.utiles}` : ''].map(champ).join(';');
    });
    return [tete.map(champ).join(';'), ...lignes].join('\r\n');
  }

  racine.CND_REGLES = {
    plusJours, ecartJours, jourSemaine, lundi, ouvreAvant, estGo, estDepose, estFini, scoreGrille, creerPieces, echeancePiece,
    depotVise, etatBiblio, etatPiece, avancement, decider, deposer, noterRelance, cloturer, ajouterTemps, aFaire, regrouperPieces, grilleMois,
    moisSuivant, evenements, statistiques, csv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
