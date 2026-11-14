// Garde-manger et dates de péremption QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.GRD) et par les tests Node (outils/templates/garde-manger.test.mjs).
// Dates locales « AAAA-MM-JJ ». Tout ce qui dépend du jour présent reçoit `auj` : rien n'est lu dans l'horloge ici.
//
// Un produit est rangé dans un lieu (réfrigérateur, congélateur, placard ou autre), appartient à une catégorie et
// porte le type de date imprimé sur son emballage :
//   - DLC « à consommer jusqu'au » : date de sécurité, au-delà on ne consomme pas ;
//   - DDM « à consommer de préférence avant » : date de qualité, au-delà on vérifie l'aspect et l'odeur ;
//   - aucune date (fruits, restes, traiteur à la coupe…).
// Son échéance est la plus proche de ces dates : celle de l'emballage, celle qui suit l'ouverture (délai indiqué sur
// l'emballage), celle qui suit l'achat pour un produit sans date (durée de la catégorie), celle qui suit la
// décongélation (3 jours, Anses), ou celle fixée pour le congélateur. Seules la DDM et la date fixée pour le
// congélateur sont « de qualité » ; toutes les autres sont « de sécurité ».
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajoutMois = (s, n) => { const d = versDate(s); return iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateCourte = (s) => { const d = versDate(s); return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; };
  // « aujourd'hui », « demain », « dans 5 jours », « hier », « il y a 3 jours ».
  function relatif(date, auj) {
    const n = ecart(auj, date);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const arrondi2 = (n) => Math.round(n * 100) / 100;
  const nombreFr = (n, dec = 2) => {
    const r = Math.round(n * 10 ** dec) / 10 ** dec;
    return String(r).replace('.', ',');
  };
  const euros = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // ---------- Types de date et niveaux ----------
  const TYPES_DATE = {
    DLC: { court: 'DLC', libelle: 'À consommer jusqu\'au', aide: 'date de sécurité : au-delà, ne pas consommer' },
    DDM: { court: 'DDM', libelle: 'À consommer de préférence avant', aide: 'date de qualité : au-delà, vérifier l\'aspect et l\'odeur' },
    aucune: { court: 'Sans date', libelle: 'Pas de date sur l\'emballage', aide: 'fruits, légumes, restes, traiteur à la coupe' },
  };
  // Nature de l'échéance retenue : d'où elle vient et si elle relève de la sécurité.
  const NATURES = {
    DLC: { securite: true, libelle: 'DLC' },
    DDM: { securite: false, libelle: 'DDM' },
    ouverture: { securite: true, libelle: 'après ouverture' },
    sansDate: { securite: true, libelle: 'depuis l\'achat' },
    decongele: { securite: true, libelle: 'décongelé' },
    congel: { securite: false, libelle: 'au congélateur' },
  };
  // Niveaux d'alerte, du plus urgent au plus lointain.
  const NIVEAUX = ['perime', 'depasse', 'aujourdhui', 'trois', 'semaine', 'ok', 'sans'];
  const LIBELLES_NIVEAU = {
    perime: 'Ne pas consommer',
    depasse: 'Date de qualité dépassée',
    aujourdhui: 'Aujourd\'hui',
    trois: 'Sous 3 jours',
    semaine: 'Cette semaine',
    ok: 'Plus tard',
    sans: 'Sans échéance',
  };

  const lieuDe = (etat, id) => (etat.lieux || []).find((l) => l.id === id) || null;
  const categorieDe = (etat, id) => (etat.categories || []).find((c) => c.id === id) || null;
  const typeLieu = (etat, p) => lieuDe(etat, p.lieu)?.type || 'autre';

  // Échéance d'un produit : { date, nature, indicative, source } ou null (aucune date connue).
  // `indicative` : la durée vient de la catégorie (valeur saisie par l'utilisateur ou sourcée), pas de l'emballage.
  function echeance(etat, p, base) {
    const cat = categorieDe(etat, p.categorie) || {};
    const t = typeLieu(etat, p);
    const candidats = [];
    if (p.decongeleLe && estDate(p.decongeleLe)) {
      // Décongelé : l'Anses recommande de consommer sous trois jours, sans recongeler.
      const n = Number(base?.dureeDecongele) || 3;
      return { date: ajout(p.decongeleLe, n), nature: 'decongele', indicative: false, source: 'anses-dlc' };
    }
    if (t === 'congel') {
      // Au congélateur, la DLC de l'emballage ne s'applique plus (produit congelé avant elle) ; la DDM d'un surgelé
      // reste une date de qualité. La date fixée par l'utilisateur, ou la durée de sa catégorie, s'ajoute.
      if (p.typeDate === 'DDM' && estDate(p.date)) candidats.push({ date: p.date, nature: 'DDM', indicative: false });
      if (estDate(p.limiteCongel)) candidats.push({ date: p.limiteCongel, nature: 'congel', indicative: false });
      else if (cat.congel > 0 && estDate(p.congeleLe)) candidats.push({ date: ajout(p.congeleLe, cat.congel), nature: 'congel', indicative: true });
    } else {
      if ((p.typeDate === 'DLC' || p.typeDate === 'DDM') && estDate(p.date)) candidats.push({ date: p.date, nature: p.typeDate, indicative: false });
      if (estDate(p.ouvertLe)) {
        if (p.joursOuverture > 0) candidats.push({ date: ajout(p.ouvertLe, p.joursOuverture), nature: 'ouverture', indicative: false });
        else if (cat.apresOuverture > 0) candidats.push({ date: ajout(p.ouvertLe, cat.apresOuverture), nature: 'ouverture', indicative: true });
      }
      if (p.typeDate === 'aucune' && cat.sansDate > 0 && estDate(p.achat)) candidats.push({ date: ajout(p.achat, cat.sansDate), nature: 'sansDate', indicative: true, source: cat.source || '' });
    }
    if (!candidats.length) return null;
    // La plus proche ; à égalité, celle de sécurité.
    candidats.sort((a, b) => a.date.localeCompare(b.date) || (NATURES[b.nature].securite - NATURES[a.nature].securite));
    return { source: '', ...candidats[0] };
  }

  // Niveau d'alerte d'un produit au jour `auj`.
  function niveau(etat, p, auj, base) {
    const e = echeance(etat, p, base);
    if (!e) return 'sans';
    const n = ecart(auj, e.date);
    if (n < 0) return NATURES[e.nature].securite ? 'perime' : 'depasse';
    if (n === 0) return 'aujourdhui';
    if (n <= 3) return 'trois';
    if (n <= 7) return 'semaine';
    return 'ok';
  }

  // Message d'alerte selon la nature de l'échéance (affiché sur la ligne du produit).
  function messageAlerte(etat, p, auj, base) {
    const e = echeance(etat, p, base);
    const nv = niveau(etat, p, auj, base);
    if (!e) return { niveau: nv, texte: '' };
    const quand = relatif(e.date, auj);
    const textes = {
      DLC: { passe: `DLC dépassée (${dateFr(e.date)}) : ne pas consommer.`, futur: `DLC ${quand}` },
      DDM: { passe: `DDM dépassée (${dateFr(e.date)}) : encore consommable si l'emballage est intact, l'aspect et l'odeur normaux ; qualité moindre.`, futur: `DDM ${quand}` },
      ouverture: { passe: `Délai après ouverture dépassé (${dateFr(e.date)}) : ne pas consommer.`, futur: `Ouvert : à finir ${quand}` },
      sansDate: { passe: `Acheté il y a plus de ${ecart(p.achat, e.date)} jours, sans date : ne pas consommer.`, futur: `Sans date : à finir ${quand}` },
      decongele: { passe: 'Décongelé depuis plus de 3 jours : ne pas consommer, ne pas recongeler.', futur: `Décongelé : à finir ${quand}, sans recongeler` },
      congel: { passe: `Date fixée pour le congélateur dépassée (${dateFr(e.date)}) : vérifier l'aspect avant de cuisiner.`, futur: `Congélateur : avant ${quand === 'aujourd\'hui' ? 'ce soir' : dateFr(e.date)}` },
    };
    const t = textes[e.nature];
    return { niveau: nv, texte: nv === 'perime' || nv === 'depasse' ? t.passe : t.futur, echeance: e };
  }

  // Vue « à consommer en priorité » : produits en stock classés par niveau, du plus urgent au plus lointain.
  function priorites(etat, auj, base) {
    const groupes = { perime: [], depasse: [], aujourdhui: [], trois: [], semaine: [] };
    for (const p of etat.produits || []) {
      const nv = niveau(etat, p, auj, base);
      if (groupes[nv]) groupes[nv].push(p);
    }
    for (const k of Object.keys(groupes)) groupes[k].sort((a, b) => (echeance(etat, a, base)?.date || '').localeCompare(echeance(etat, b, base)?.date || '') || a.nom.localeCompare(b.nom, 'fr'));
    return groupes;
  }

  // Compte des produits par niveau (pour les tuiles et les lieux).
  function compteNiveaux(etat, auj, base, filtre = () => true) {
    const c = Object.fromEntries(NIVEAUX.map((n) => [n, 0]));
    for (const p of (etat.produits || []).filter(filtre)) c[niveau(etat, p, auj, base)]++;
    return c;
  }

  // Tri du stock : échéance la plus proche d'abord, sans échéance à la fin, puis par nom.
  function trierStock(etat, produits, base) {
    return [...produits].sort((a, b) => {
      const ea = echeance(etat, a, base)?.date || '9999-12-31', eb = echeance(etat, b, base)?.date || '9999-12-31';
      return ea.localeCompare(eb) || a.nom.localeCompare(b.nom, 'fr');
    });
  }

  function rechercher(etat, produits, texte) {
    const q = plat(texte);
    if (!q) return produits;
    return produits.filter((p) => plat(`${p.nom} ${categorieDe(etat, p.categorie)?.nom || ''} ${p.note || ''}`).includes(q));
  }

  // ---------- Sorties : consommé ou jeté ----------
  // Retire `quantite` (tout par défaut) du produit et note la sortie dans l'historique. La valeur saisie à l'achat
  // est répartie au prorata de la quantité. Renvoie { etat, sortie, epuise } ; l'état reçu n'est pas modifié.
  function sortir(etat, id, { type, quantite, motif = '', date, niveauAuMoment = '' }) {
    const p = (etat.produits || []).find((x) => x.id === id);
    if (!p) return { etat, sortie: null, epuise: false };
    if (type !== 'consomme' && type !== 'jete') throw new Error('type de sortie inconnu');
    const dispo = Number(p.quantite) || 0;
    let q = quantite === undefined || quantite === null || quantite === '' ? dispo : Number(quantite);
    if (!Number.isFinite(q) || q <= 0) q = dispo;
    if (dispo > 0) q = Math.min(q, dispo);
    const part = dispo > 0 ? q / dispo : 1;
    const valeur = p.valeur > 0 ? arrondi2(p.valeur * part) : 0;
    const sortie = {
      id: nouvelId(), date, type, produit: p.nom, categorie: p.categorie, lieu: p.lieu,
      quantite: q, unite: p.unite || '', valeur, motif: type === 'jete' ? (motif || 'autre') : '', niveau: niveauAuMoment,
    };
    const reste = arrondi2(dispo - q);
    const epuise = reste <= 0;
    const produits = epuise
      ? etat.produits.filter((x) => x.id !== id)
      : etat.produits.map((x) => (x.id === id ? { ...x, quantite: reste, valeur: x.valeur > 0 ? arrondi2(x.valeur - valeur) : x.valeur } : x));
    return { etat: { ...etat, produits, sorties: [...(etat.sorties || []), sortie] }, sortie, epuise };
  }

  // ---------- Liste de courses ----------
  // Ajoute un article s'il n'est pas déjà sur la liste (non coché, même nom sans accents ni casse).
  function ajouterCourse(etat, nom, x = {}) {
    const n = String(nom || '').trim().slice(0, 80);
    if (!n) return { etat, ajoute: false };
    const deja = (etat.courses || []).some((c) => !c.fait && plat(c.nom) === plat(n));
    if (deja) return { etat, ajoute: false };
    const c = { id: nouvelId(), nom: n, categorie: x.categorie || '', fait: false, ajouteLe: x.date || '', origine: x.origine || 'main' };
    return { etat: { ...etat, courses: [...(etat.courses || []), c] }, ajoute: true };
  }
  // Liste à copier : par catégorie, articles non cochés.
  function texteCourses(etat) {
    const restants = (etat.courses || []).filter((c) => !c.fait);
    if (!restants.length) return '';
    const groupes = new Map();
    for (const c of restants) {
      const nom = categorieDe(etat, c.categorie)?.nom || 'Divers';
      if (!groupes.has(nom)) groupes.set(nom, []);
      groupes.get(nom).push(c.nom);
    }
    return [...groupes.entries()].map(([nom, l]) => `${nom}\n${l.map((x) => `- ${x}`).join('\n')}`).join('\n\n');
  }
  // Produits finis récemment qui ne sont ni en stock ni sur la liste (même cochés) : suggestions.
  function suggestionsCourses(etat, auj, jours = 30) {
    const enStock = new Set((etat.produits || []).map((p) => plat(p.nom)));
    const surListe = new Set((etat.courses || []).map((c) => plat(c.nom))); // cochés compris : déjà achetés
    const vus = new Set();
    const l = [];
    for (const s of [...(etat.sorties || [])].sort((a, b) => b.date.localeCompare(a.date))) {
      if (s.type !== 'consomme' || ecart(s.date, auj) > jours) continue;
      const k = plat(s.produit);
      if (vus.has(k) || enStock.has(k) || surListe.has(k)) continue;
      vus.add(k);
      l.push({ nom: s.produit, categorie: s.categorie, date: s.date });
    }
    return l;
  }

  // ---------- Gaspillage ----------
  // Bilan des sorties entre deux dates incluses : nombres de produits consommés et jetés, part jetée, valeur
  // jetée (seulement pour les produits dont la valeur a été saisie), répartition par motif, catégorie et mois.
  function bilan(etat, debut, fin) {
    const l = (etat.sorties || []).filter((s) => s.date >= debut && s.date <= fin);
    const jetes = l.filter((s) => s.type === 'jete');
    const consommes = l.filter((s) => s.type === 'consomme');
    const parMotif = {};
    const parCategorie = {};
    for (const s of jetes) {
      parMotif[s.motif || 'autre'] = (parMotif[s.motif || 'autre'] || 0) + 1;
      const c = s.categorie || '';
      if (!parCategorie[c]) parCategorie[c] = { nombre: 0, valeur: 0 };
      parCategorie[c].nombre++;
      parCategorie[c].valeur = arrondi2(parCategorie[c].valeur + (s.valeur || 0));
    }
    const total = jetes.length + consommes.length;
    return {
      jetes: jetes.length,
      consommes: consommes.length,
      part: total ? jetes.length / total : 0,
      valeurJetee: arrondi2(jetes.reduce((t, s) => t + (s.valeur || 0), 0)),
      jetesSansValeur: jetes.filter((s) => !(s.valeur > 0)).length,
      parMotif,
      parCategorie,
    };
  }
  // Série mensuelle (n derniers mois, mois en cours compris) : { mois: 'AAAA-MM', jetes, consommes, valeur }.
  function serieMensuelle(etat, auj, n = 6) {
    const debut = ajoutMois(`${auj.slice(0, 7)}-01`, -(n - 1));
    const l = [];
    for (let i = 0; i < n; i++) {
      const m = ajoutMois(debut, i).slice(0, 7);
      const s = (etat.sorties || []).filter((x) => x.date.slice(0, 7) === m);
      const j = s.filter((x) => x.type === 'jete');
      l.push({ mois: m, jetes: j.length, consommes: s.length - j.length, valeur: arrondi2(j.reduce((t, x) => t + (x.valeur || 0), 0)) });
    }
    return l;
  }
  // Début de période pour un filtre (« 30 », « 90 », « 365 » jours, ou « tout »).
  const debutPeriode = (periode, auj) => (periode === 'tout' ? '0000-01-01' : ajout(auj, -(Number(periode) || 30) + 1));

  // ---------- Suppression d'un lieu ou d'une catégorie ----------
  function impactLieu(etat, id) { return (etat.produits || []).filter((p) => p.lieu === id).length; }
  function impactCategorie(etat, id) { return (etat.produits || []).filter((p) => p.categorie === id).length; }

  // ---------- Export CSV (séparateur point-virgule, pour un tableur français) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvStock(etat, auj, base) {
    const lignes = [['Produit', 'Lieu', 'Catégorie', 'Quantité', 'Unité', 'Type de date', 'Date emballage', 'Ouvert le', 'Échéance', 'Origine de l\'échéance', 'Alerte', 'Valeur (€)', 'Note']];
    for (const p of trierStock(etat, etat.produits || [], base)) {
      const e = echeance(etat, p, base);
      lignes.push([p.nom, lieuDe(etat, p.lieu)?.nom || '', categorieDe(etat, p.categorie)?.nom || '', nombreFr(p.quantite), p.unite, TYPES_DATE[p.typeDate]?.court || '', p.date, p.ouvertLe, e?.date || '', e ? NATURES[e.nature].libelle : '', LIBELLES_NIVEAU[niveau(etat, p, auj, base)], p.valeur > 0 ? nombreFr(p.valeur) : '', p.note]);
    }
    return versCsv(lignes);
  }
  function csvSorties(etat, motifs = []) {
    const nomMotif = Object.fromEntries(motifs);
    const lignes = [['Date', 'Sortie', 'Produit', 'Catégorie', 'Lieu', 'Quantité', 'Unité', 'Motif', 'Valeur (€)']];
    for (const s of [...(etat.sorties || [])].sort((a, b) => a.date.localeCompare(b.date))) {
      lignes.push([s.date, s.type === 'jete' ? 'Jeté' : 'Consommé', s.produit, categorieDe(etat, s.categorie)?.nom || '', lieuDe(etat, s.lieu)?.nom || '', nombreFr(s.quantite), s.unite, s.motif ? (nomMotif[s.motif] || s.motif) : '', s.valeur > 0 ? nombreFr(s.valeur) : '']);
    }
    return versCsv(lignes);
  }

  // Retire les sorties antérieures à une date (historique trop long).
  function purgerAvant(etat, date) {
    const avant = (etat.sorties || []).length;
    const sorties = (etat.sorties || []).filter((s) => s.date >= date);
    return { etat: { ...etat, sorties }, retirees: avant - sorties.length };
  }

  // ---------- Normalisation (tolère les anciennes versions et les saisies incomplètes) ----------
  const texte = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const entierPos = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n <= 3650 ? n : null; };
  const nombrePos = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? arrondi2(n) : 0; };
  const dateOuVide = (v) => (estDate(v) ? v : '');

  function normaliserLieu(l) {
    return { id: texte(l?.id, 40) || nouvelId(), nom: texte(l?.nom, 60) || 'Lieu', type: ['frigo', 'congel', 'placard', 'autre'].includes(l?.type) ? l.type : 'autre' };
  }
  function normaliserCategorie(c, i = 0) {
    return {
      id: texte(c?.id, 40) || nouvelId(),
      nom: texte(c?.nom, 60) || 'Catégorie',
      couleur: Number.isInteger(c?.couleur) && c.couleur >= 0 ? c.couleur : i,
      typeDate: ['DLC', 'DDM', 'aucune'].includes(c?.typeDate) ? c.typeDate : 'DLC',
      lieuType: ['frigo', 'congel', 'placard', 'autre'].includes(c?.lieuType) ? c.lieuType : 'frigo',
      sansDate: entierPos(c?.sansDate),
      apresOuverture: entierPos(c?.apresOuverture),
      congel: entierPos(c?.congel),
      source: texte(c?.source, 40),
    };
  }
  function normaliserProduit(p) {
    const q = Number(String(p?.quantite ?? 1).replace(',', '.'));
    return {
      id: texte(p?.id, 40) || nouvelId(),
      nom: texte(p?.nom, 80) || 'Produit',
      lieu: texte(p?.lieu, 40),
      categorie: texte(p?.categorie, 40),
      quantite: Number.isFinite(q) && q >= 0 ? arrondi2(q) : 1,
      unite: texte(p?.unite, 20),
      typeDate: ['DLC', 'DDM', 'aucune'].includes(p?.typeDate) ? p.typeDate : 'DLC',
      date: dateOuVide(p?.date),
      achat: dateOuVide(p?.achat),
      ouvertLe: dateOuVide(p?.ouvertLe),
      joursOuverture: entierPos(p?.joursOuverture),
      congeleLe: dateOuVide(p?.congeleLe),
      decongeleLe: dateOuVide(p?.decongeleLe),
      limiteCongel: dateOuVide(p?.limiteCongel),
      valeur: nombrePos(p?.valeur),
      note: texte(p?.note, 200),
    };
  }
  function normaliserSortie(s) {
    return {
      id: texte(s?.id, 40) || nouvelId(), date: dateOuVide(s?.date), type: s?.type === 'jete' ? 'jete' : 'consomme',
      produit: texte(s?.produit, 80) || 'Produit', categorie: texte(s?.categorie, 40), lieu: texte(s?.lieu, 40),
      quantite: nombrePos(s?.quantite), unite: texte(s?.unite, 20), valeur: nombrePos(s?.valeur), motif: texte(s?.motif, 20), niveau: texte(s?.niveau, 20),
    };
  }
  function normaliserCourse(c) {
    return { id: texte(c?.id, 40) || nouvelId(), nom: texte(c?.nom, 80) || 'Article', categorie: texte(c?.categorie, 40), fait: !!c?.fait, ajouteLe: dateOuVide(c?.ajouteLe), origine: texte(c?.origine, 20) || 'main' };
  }
  function normaliserReglages(r) {
    return { foyer: texte(r?.foyer, 60), rappelVu: !!r?.rappelVu };
  }

  // Lieux et catégories de départ, à partir de la base (lieux choisis par leur code).
  function lieuxDepart(base, codes) {
    const choisis = codes && codes.length ? base.lieux.filter((l) => codes.includes(l.code)) : base.lieux.filter((l) => l.defaut);
    return choisis.map((l) => normaliserLieu({ id: l.code, nom: l.nom, type: l.type }));
  }
  function categoriesDepart(base) {
    return base.categories.map((c, i) => normaliserCategorie({ id: c.code, nom: c.nom, couleur: i % base.couleurs.length, typeDate: c.date, lieuType: base.lieux.find((l) => l.code === c.lieu)?.type || 'frigo', sansDate: c.sansDate, apresOuverture: c.apresOuverture, congel: c.congel, source: c.source }, i));
  }

  function etatVide(base, codesLieux) {
    return { version: 1, reglages: normaliserReglages({}), lieux: lieuxDepart(base, codesLieux), categories: categoriesDepart(base), produits: [], sorties: [], courses: [] };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l.map(f) : []);
    const lieux = liste(d.lieux, normaliserLieu);
    const categories = liste(d.categories, normaliserCategorie);
    return {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages),
      lieux: lieux.length ? lieux : v.lieux,
      categories: categories.length ? categories : v.categories,
      produits: liste(d.produits, normaliserProduit),
      sorties: liste(d.sorties, normaliserSortie).filter((s) => s.date),
      courses: liste(d.courses, normaliserCourse),
    };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  // Contrôle d'une saisie de produit : message d'erreur ou chaîne vide.
  function validerProduit(etat, p) {
    if (!String(p.nomSaisi ?? p.nom ?? '').trim()) return 'Donne un nom au produit.';
    if (!lieuDe(etat, p.lieu)) return 'Choisis un lieu de rangement.';
    if ((p.typeDate === 'DLC' || p.typeDate === 'DDM') && !p.date) return `Indique la date imprimée (${p.typeDate}), ou choisis « Pas de date ».`;
    if (p.ouvertLe && p.achat && p.ouvertLe < p.achat) return 'La date d\'ouverture est avant la date d\'achat.';
    return '';
  }

  g.GRD = {
    deux, iso, versDate, ajout, ajoutMois, ecart, estDate, JOURS, MOIS, MOIS_COURTS, dateFr, dateFrLongue, dateCourte, relatif, plat, nouvelId, arrondi2, nombreFr, euros,
    TYPES_DATE, NATURES, NIVEAUX, LIBELLES_NIVEAU,
    lieuDe, categorieDe, typeLieu, echeance, niveau, messageAlerte, priorites, compteNiveaux, trierStock, rechercher,
    sortir, ajouterCourse, texteCourses, suggestionsCourses, bilan, serieMensuelle, debutPeriode,
    impactLieu, impactCategorie, champCsv, versCsv, csvStock, csvSorties, purgerAvant,
    normaliserLieu, normaliserCategorie, normaliserProduit, normaliserSortie, normaliserCourse, normaliserReglages,
    lieuxDepart, categoriesDepart, etatVide, normaliser, taille, validerProduit,
  };
})(typeof window !== 'undefined' ? window : globalThis);
