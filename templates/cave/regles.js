// CaveManager · règles métier pures (aucun accès au DOM ni au stockage). window.CVM, testé par
// outils/templates/cave.test.mjs. Montants en centimes, années entières.
// Stock = entrées − sorties (une sortie ne peut jamais rendre le stock négatif, à aucune date).
// Fenêtre de consommation : saisie pour la bouteille, sinon millésime + règle indicative de la catégorie
// (modifiable dans les réglages), sinon inconnue (vin sans millésime).
// Suggestions : vins en stock et ouvrables (fenêtre commencée), score = 100 − 15 × années restantes
// avant la fin (plancher 0), +20 à l'apogée, +25 si la fin est dépassée (à boire vite), +5 par bouteille
// au-delà de deux (5 au plus), +4 par point de note ; filtres catégorie et valeur maximale.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const CATS = () => B().categories.map((c) => c.id);

  // ---------- Stock et mouvements ----------
  const delta = (m) => (m.type === 'entree' ? m.quantite : -m.quantite);
  function stock(e, vinId, jusquA = null) {
    return e.mouvements.filter((m) => m.vinId === vinId && (!jusquA || m.date <= jusquA)).reduce((s, m) => s + delta(m), 0);
  }
  // Vérifie l'historique d'un vin : renvoie la première date où le stock deviendrait négatif, ou null.
  function premierNegatif(mouvements) {
    const tri = [...mouvements].sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'entree' ? -1 : 1));
    let s = 0;
    for (const m of tri) { s += delta(m); if (s < 0) return m.date; }
    return null;
  }
  // Contrôle d'un nouveau mouvement (ou d'une modification) avant enregistrement.
  function validerMouvement(e, m, remplace = null) {
    if (!O.estDate(m.date)) return 'Date invalide.';
    if (!Number.isInteger(m.quantite) || m.quantite < 1 || m.quantite > 10000) return 'Quantité : nombre entier de bouteilles, au moins 1.';
    const autres = e.mouvements.filter((x) => x.vinId === m.vinId && x.id !== remplace);
    const neg = premierNegatif([...autres, m]);
    if (neg) return `Stock insuffisant : le ${O.versDate(neg).toLocaleDateString('fr-FR')}, il manquerait des bouteilles. Vérifie la quantité ou la date.`;
    return null;
  }

  // ---------- Fenêtre de consommation ----------
  function fenetre(vin, garde) {
    if (vin.fenetre && Number.isInteger(vin.fenetre.debut) && Number.isInteger(vin.fenetre.fin)) return { ...vin.fenetre, apogee: vin.fenetre.apogee ?? Math.round((vin.fenetre.debut + vin.fenetre.fin) / 2), source: 'saisie' };
    const g = garde[vin.categorie];
    if (!vin.millesime || !g) return { debut: null, apogee: null, fin: null, source: 'inconnue' };
    return { debut: vin.millesime + g.debut, apogee: vin.millesime + g.apogee, fin: vin.millesime + g.fin, source: 'regle' };
  }
  // 'trop-jeune', 'a-boire', 'apogee', 'fin-proche' (dernière année), 'passee', 'inconnu'.
  function etatGarde(vin, garde, annee) {
    const f = fenetre(vin, garde);
    if (f.debut === null) return 'inconnu';
    if (annee < f.debut) return 'trop-jeune';
    if (annee > f.fin) return 'passee';
    if (annee === f.fin) return 'fin-proche';
    if (annee === f.apogee) return 'apogee';
    return 'a-boire';
  }

  // ---------- Valeur ----------
  // Prix moyen d'achat pondéré par les entrées « achat » qui ont un prix ; valeur = valeur déclarée,
  // sinon prix moyen d'achat, sinon prix d'achat saisi sur la fiche.
  function prixMoyen(e, vinId) {
    const l = e.mouvements.filter((m) => m.vinId === vinId && m.type === 'entree' && m.prixUnitaire !== null);
    const q = l.reduce((s, m) => s + m.quantite, 0);
    return q ? Math.round(l.reduce((s, m) => s + m.quantite * m.prixUnitaire, 0) / q) : null;
  }
  const valeurUnitaire = (e, v) => v.valeur ?? prixMoyen(e, v.id) ?? v.prixAchat ?? null;

  // ---------- Cave ----------
  function inventaire(e, annee) {
    return e.vins.map((v) => ({ vin: v, stock: stock(e, v.id), fenetre: fenetre(v, e.reglages.garde), etat: etatGarde(v, e.reglages.garde, annee), valeur: valeurUnitaire(e, v) }));
  }
  function statistiques(e, auj) {
    const annee = Number(auj.slice(0, 4));
    const inv = inventaire(e, annee).filter((x) => x.stock > 0);
    const bouteilles = inv.reduce((s, x) => s + x.stock, 0);
    const grouper = (cle) => {
      const m = new Map();
      for (const x of inv) { const k = cle(x) || 'Non renseigné'; m.set(k, (m.get(k) || 0) + x.stock); }
      return [...m].map(([nom, nb]) => ({ nom, nb, part: bouteilles ? O.arrondi((nb / bouteilles) * 100, 1) : 0 })).sort((a, b) => b.nb - a.nb || String(a.nom).localeCompare(String(b.nom)));
    };
    const sorties12 = e.mouvements.filter((m) => m.type === 'sortie' && m.date >= O.ajout(auj, -365));
    const mois = [];
    for (let i = 11; i >= 0; i--) { const cle = O.ajoutMois(`${auj.slice(0, 7)}-01`, -i).slice(0, 7); mois.push({ mois: cle, sorties: sorties12.filter((m) => m.date.slice(0, 7) === cle).reduce((s, m) => s + m.quantite, 0) }); }
    const nomCat = (id) => B().categories.find((c) => c.id === id)?.nom;
    return {
      references: inv.length, bouteilles,
      valeur: inv.reduce((s, x) => s + (x.valeur || 0) * x.stock, 0), sansValeur: inv.filter((x) => x.valeur === null).reduce((s, x) => s + x.stock, 0),
      parCategorie: grouper((x) => nomCat(x.vin.categorie)), parRegion: grouper((x) => x.vin.region), parMillesime: grouper((x) => (x.vin.millesime ? String(x.vin.millesime) : 'Sans millésime')).sort((a, b) => String(b.nom).localeCompare(String(a.nom))),
      parEmplacement: grouper((x) => x.vin.emplacement),
      parEtat: Object.fromEntries(['trop-jeune', 'a-boire', 'apogee', 'fin-proche', 'passee', 'inconnu'].map((k) => [k, inv.filter((x) => x.etat === k).reduce((s, x) => s + x.stock, 0)])),
      consommees12: sorties12.filter((m) => m.motif === 'consommee').reduce((s, m) => s + m.quantite, 0), mois,
    };
  }
  // Alertes : vins en stock à boire avant la fin de l'année, ou dont la fenêtre est passée.
  function alertes(e, auj) {
    const annee = Number(auj.slice(0, 4));
    const inv = inventaire(e, annee).filter((x) => x.stock > 0);
    return { passes: inv.filter((x) => x.etat === 'passee'), finProche: inv.filter((x) => x.etat === 'fin-proche'), apogee: inv.filter((x) => x.etat === 'apogee') };
  }
  function suggestions(e, criteres, auj) {
    const annee = Number(auj.slice(0, 4));
    const c = criteres || {};
    return inventaire(e, annee).filter((x) => x.stock > 0 && !['trop-jeune', 'inconnu'].includes(x.etat)
      && (!c.categorie || x.vin.categorie === c.categorie) && (!c.valeurMax || (x.valeur ?? 0) <= c.valeurMax))
      .map((x) => {
        const reste = x.fenetre.fin - annee;
        let score = Math.max(0, 100 - 15 * Math.max(0, reste));
        const raisons = [];
        if (x.etat === 'passee') { score += 25; raisons.push(`fenêtre terminée en ${x.fenetre.fin} : à ouvrir vite`); }
        else if (x.etat === 'fin-proche') raisons.push('dernière année de sa fenêtre');
        else raisons.push(`à boire jusqu'en ${x.fenetre.fin}`);
        if (x.etat === 'apogee') { score += 20; raisons.push('à son apogée cette année'); }
        if (x.stock > 2) { score += Math.min(5, x.stock - 2) * 5; raisons.push(`${x.stock} bouteilles en stock`); }
        if (x.vin.note) { score += 4 * x.vin.note; if (x.vin.note >= 4) raisons.push(`ta note : ${x.vin.note}/5`); }
        if (x.fenetre.source === 'regle') raisons.push('fenêtre indicative de la catégorie');
        return { ...x, score, raisons };
      })
      .sort((a, b) => b.score - a.score || a.vin.nom.localeCompare(b.vin.nom, 'fr'));
  }

  // ---------- Validation d'une fiche ----------
  function validerVin(v, anneeCourante) {
    if (!O.texte(v.nom)) return 'Donne un nom au vin (cuvée ou appellation).';
    if (v.millesime !== null && !(Number.isInteger(v.millesime) && v.millesime >= 1850 && v.millesime <= anneeCourante + 1)) return `Millésime : année entre 1850 et ${anneeCourante + 1}, ou vide pour un vin sans millésime.`;
    const f = v.fenetre;
    if (f) {
      if (!Number.isInteger(f.debut) || !Number.isInteger(f.fin)) return 'Fenêtre : années « à partir de » et « jusqu\'à » toutes deux renseignées, ou toutes deux vides.';
      if (f.fin < f.debut) return 'Fenêtre : « jusqu\'à » doit suivre « à partir de ».';
      if (f.apogee !== null && f.apogee !== undefined && (f.apogee < f.debut || f.apogee > f.fin)) return 'Apogée : entre le début et la fin de la fenêtre.';
      if (v.millesime && f.debut < v.millesime) return 'Fenêtre : elle ne peut pas commencer avant le millésime.';
    }
    for (const [k, l] of [['prixAchat', 'Prix d\'achat'], ['valeur', 'Valeur déclarée']]) if (v[k] !== null && !(Number.isInteger(v[k]) && v[k] >= 0)) return `${l} : montant positif.`;
    return null;
  }

  // ---------- Normalisation ----------
  function normaliserGarde(g) {
    const out = {};
    for (const [k, d] of Object.entries(B().garde)) {
      const x = g?.[k] || {};
      const debut = O.entier(x.debut, 0, 100, d.debut), fin = Math.max(debut, O.entier(x.fin, 0, 100, d.fin));
      out[k] = { debut, apogee: Math.min(fin, Math.max(debut, O.entier(x.apogee, 0, 100, d.apogee))), fin };
    }
    return out;
  }
  function normaliserVin(v, anneeMax) {
    v = v && typeof v === 'object' ? v : {};
    const mill = O.entier(v.millesime, 1850, anneeMax, null);
    let f = null;
    if (v.fenetre && Number.isInteger(v.fenetre.debut) && Number.isInteger(v.fenetre.fin) && v.fenetre.fin >= v.fenetre.debut) {
      const ap = Number.isInteger(v.fenetre.apogee) && v.fenetre.apogee >= v.fenetre.debut && v.fenetre.apogee <= v.fenetre.fin ? v.fenetre.apogee : null;
      f = { debut: v.fenetre.debut, apogee: ap, fin: v.fenetre.fin };
    }
    const m = (x) => (x === null || x === undefined || x === '' ? null : O.entier(x, 0, 1e9, null));
    return {
      id: O.idValide(v.id), nom: O.texte(v.nom, 100) || 'Vin sans nom', producteur: O.texte(v.producteur, 100), categorie: O.choix(v.categorie, CATS(), 'rouge'),
      region: O.texte(v.region, 60), appellation: O.texte(v.appellation, 80), cepages: O.texte(v.cepages, 120), millesime: mill,
      format: O.choix(v.format, B().formats.map((x) => x.id), '75'), emplacement: O.texte(v.emplacement, 80), prixAchat: m(v.prixAchat), valeur: m(v.valeur),
      fenetre: f, note: O.entier(v.note, 0, 5, 0), commentaire: O.texte(v.commentaire, 500),
    };
  }
  const etatVide = () => ({ version: 1, reglages: { garde: normaliserGarde({}) }, vins: [], mouvements: [] });
  function normaliser(d, auj = O.iso(new Date())) {
    if (!d || typeof d !== 'object') return etatVide();
    const anneeMax = Number(auj.slice(0, 4)) + 1;
    const vins = O.tableau(d.vins).slice(0, 3000).map((v) => normaliserVin(v, anneeMax));
    const ids = new Set(vins.map((v) => v.id));
    const motifs = { entree: B().motifsEntree.map((x) => x[0]), sortie: B().motifsSortie.map((x) => x[0]) };
    let mouvements = O.tableau(d.mouvements).slice(0, 30000).filter((m) => ids.has(m?.vinId) && O.estDate(m?.date) && ['entree', 'sortie'].includes(m?.type)).map((m) => ({
      id: O.idValide(m.id), vinId: m.vinId, date: m.date, type: m.type, motif: O.choix(m.motif, motifs[m.type], motifs[m.type][0]), quantite: O.entier(m.quantite, 1, 10000, 1),
      prixUnitaire: m.type === 'entree' && m.prixUnitaire !== null && m.prixUnitaire !== undefined ? O.entier(m.prixUnitaire, 0, 1e9, null) : null,
      noteDegustation: m.type === 'sortie' ? O.entier(m.noteDegustation, 0, 5, 0) : 0, commentaire: O.texte(m.commentaire, 300),
    }));
    // Historique impossible (sortie avant entrée) : on écarte les sorties qui rendent le stock négatif.
    for (const v of vins) {
      const ms = mouvements.filter((m) => m.vinId === v.id).sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'entree' ? -1 : 1));
      let s = 0;
      for (const m of ms) { if (m.type === 'sortie' && s - m.quantite < 0) { mouvements = mouvements.filter((x) => x !== m); continue; } s += delta(m); }
    }
    return { ...d, version: 1, reglages: { garde: normaliserGarde(d.reglages?.garde) }, vins, mouvements };
  }

  // ---------- Exports CSV ----------
  function csvCave(e, auj) {
    const annee = Number(auj.slice(0, 4));
    const nomCat = (id) => B().categories.find((c) => c.id === id)?.nom || '';
    const LIB = { 'trop-jeune': 'Trop jeune', 'a-boire': 'À boire', apogee: 'Apogée', 'fin-proche': 'Dernière année', passee: 'Fenêtre passée', inconnu: 'Inconnue' };
    return [['Vin', 'Producteur', 'Catégorie', 'Région', 'Appellation', 'Cépages', 'Millésime', 'Format', 'Emplacement', 'Stock', 'Prix d\'achat moyen (€)', 'Valeur unitaire (€)', 'Valeur du stock (€)', 'À partir de', 'Apogée', 'Jusqu\'à', 'Origine de la fenêtre', 'État', 'Note (0-5)', 'Commentaire'],
      ...inventaire(e, annee).map((x) => [x.vin.nom, x.vin.producteur, nomCat(x.vin.categorie), x.vin.region, x.vin.appellation, x.vin.cepages, x.vin.millesime ?? 'Sans millésime', B().formats.find((f) => f.id === x.vin.format)?.nom, x.vin.emplacement, x.stock, O.centimesCsv(prixMoyen(e, x.vin.id) ?? x.vin.prixAchat), O.centimesCsv(x.valeur), O.centimesCsv(x.valeur === null ? null : x.valeur * x.stock), x.fenetre.debut ?? '', x.fenetre.apogee ?? '', x.fenetre.fin ?? '', { saisie: 'Saisie', regle: 'Règle indicative', inconnue: '' }[x.fenetre.source], LIB[x.etat], x.vin.note || '', x.vin.commentaire])];
  }
  function csvMouvements(e) {
    const nom = (id) => e.vins.find((v) => v.id === id);
    const motif = (m) => [...B().motifsEntree, ...B().motifsSortie].find((x) => x[0] === m)?.[1] || m;
    return [['Date', 'Vin', 'Millésime', 'Sens', 'Motif', 'Quantité', 'Prix unitaire (€)', 'Note de dégustation', 'Commentaire'],
      ...[...e.mouvements].sort((a, b) => b.date.localeCompare(a.date)).map((m) => [m.date, nom(m.vinId)?.nom, nom(m.vinId)?.millesime ?? '', m.type === 'entree' ? 'Entrée' : 'Sortie', motif(m.motif), m.quantite, O.centimesCsv(m.prixUnitaire), m.noteDegustation || '', m.commentaire])];
  }

  racine.CVM = { stock, premierNegatif, validerMouvement, fenetre, etatGarde, prixMoyen, valeurUnitaire, inventaire, statistiques, alertes, suggestions, validerVin, normaliserGarde, normaliserVin, etatVide, normaliser, csvCave, csvMouvements };
})(typeof window !== 'undefined' ? window : globalThis);
