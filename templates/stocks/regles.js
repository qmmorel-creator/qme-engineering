// Stocks et inventaire QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.STK) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Prix en centimes HT (nombres, fractions de
// centime admises pour les petits prix unitaires : 0,035 € = 3,5 centimes). Quantités décimales (3 chiffres).
// Le stock n'est jamais saisi : il se calcule en rejouant les mouvements datés, dans l'ordre (date, puis
// ordre de saisie).
(function (racine) {
  'use strict';

  const TYPES = {
    entree: { nom: 'Entrée', sens: 1 },
    sortie: { nom: 'Sortie', sens: -1 },
    perte: { nom: 'Perte', sens: -1 },
    retourClient: { nom: 'Retour client', sens: 1 },
    retourFournisseur: { nom: 'Retour fournisseur', sens: -1 },
    ajustement: { nom: 'Ajustement', sens: 0 },
  };
  const METHODES = { cmup: 'Coût moyen pondéré (CMUP)', dernier: 'Dernier prix d\'achat' };
  const STATUTS = ['rupture', 'sousSeuil', 'dormant', 'ok', 'nouveau', 'inactif'];
  const LIB_STATUT = { rupture: 'Rupture', sousSeuil: 'Sous le seuil', dormant: 'Dormant', ok: 'En stock', nouveau: 'Jamais en stock', inactif: 'Archivé' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // ---------- Nombres ----------
  const arrondiQ = (q) => Math.round((Number(q) || 0) * 1000) / 1000;
  const arrondiC = (c) => Math.round(c * 100) / 100; // centimes, au centième de centime
  // « 1 234,56 », « 0,035 € » → centimes (jusqu'à 4 décimales d'euro) ; null si vide, négatif ou illisible.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,4})?$/.test(s)) return null;
    return arrondiC(Number(s) * 100);
  }
  // Quantité décimale (3 chiffres après la virgule). signe : accepte un nombre négatif (ajustement).
  function lireQuantite(saisie, { signe = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-');
    if (!s || !(signe ? /^[-+]?\d+(\.\d{0,3})?$/ : /^\+?\d+(\.\d{0,3})?$/).test(s)) return null;
    return arrondiQ(Number(s));
  }
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Affichage en euros. unitaire : jusqu'à 4 décimales pour un prix inférieur à 1 € (0,035 €).
  function euros(c, { centimes = true, unitaire = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const e = Math.abs(c) / 100;
    if (!centimes) return `${neg ? '−' : ''}${milliers(Math.round(e))} €`;
    let dec = 2;
    if (unitaire && e < 1) { while (dec < 4 && Math.abs(Math.round(e * 10 ** dec) - e * 10 ** dec) > 1e-6) dec++; }
    const [ent, fr] = (Math.round(e * 10 ** dec) / 10 ** dec).toFixed(dec).split('.');
    return `${neg ? '−' : ''}${milliers(ent)},${fr} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (Math.round(c * 100) / 10000).toFixed(4).replace(/0{1,2}$/, '').replace('.', ','));
  function nombre(q) {
    const v = arrondiQ(q);
    const [ent, fr] = String(Math.abs(v)).split('.');
    return `${v < 0 ? '−' : ''}${milliers(ent)}${fr ? `,${fr}` : ''}`;
  }
  const saisieQuantite = (q) => (q === null || q === undefined ? '' : String(arrondiQ(q)).replace('.', ','));
  const pct = (t) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${(Math.round(t * 10) / 10).toString().replace('.', ',')} %`);

  // ---------- Mouvements ----------
  // Variation de stock d'un mouvement : quantité signée pour un ajustement, sinon sens du type × quantité.
  function delta(m) {
    const t = TYPES[m.type];
    if (!t) return 0;
    if (t.sens === 0) return arrondiQ(m.quantite);
    return arrondiQ(t.sens * Math.abs(Number(m.quantite) || 0));
  }
  // Tri stable : date, puis ordre de saisie (position dans le tableau).
  const mouvementsTries = (liste) => liste.map((m, i) => [m, i]).sort((x, y) => x[0].date.localeCompare(y[0].date) || x[1] - y[1]).map((x) => x[0]);

  // Rejoue les mouvements d'un article jusqu'à une date incluse (toutes dates si absente).
  //  CMUP : à chaque entrée, (stock × coût moyen + quantité × prix) ÷ (stock + quantité) ; si le stock avant
  //  l'entrée est nul ou négatif, le coût moyen repart du prix de l'entrée. Avant toute entrée : prix d'achat
  //  de la fiche article. Sorties, pertes, retours et ajustements ne changent pas le coût moyen (retour
  //  fournisseur compris : simplification, signalée dans l'aide).
  function historique(article, mouvements, jusqua) {
    const propres = mouvementsTries(mouvements.filter((m) => m.article === article.id && (!jusqua || m.date <= jusqua)));
    let stock = 0;
    let cmup = Number.isFinite(article.prixAchat) ? article.prixAchat : null;
    let dernierPrix = Number.isFinite(article.prixAchat) ? article.prixAchat : null;
    let derniereEntree = null, derniereSortie = null, premier = null;
    const lignes = [];
    for (const m of propres) {
      const d = delta(m);
      if (!premier) premier = m.date;
      const coutAvant = cmup;
      if (m.type === 'entree') {
        const pu = Number.isFinite(m.prix) ? m.prix : (Number.isFinite(article.prixAchat) ? article.prixAchat : null);
        if (pu !== null) {
          cmup = stock <= 0 || cmup === null ? pu : (stock * cmup + d * pu) / (stock + d);
          dernierPrix = pu;
        }
        derniereEntree = m.date;
      }
      if (m.type === 'sortie') derniereSortie = m.date;
      stock = arrondiQ(stock + d);
      lignes.push({ m, delta: d, stock, cmup, cout: m.type === 'entree' ? null : coutAvant });
    }
    return { lignes, stock, cmup, dernierPrix, derniereEntree, derniereSortie, premier };
  }
  const stockA = (article, mouvements, jour) => historique(article, mouvements, jour).stock;

  // Coût unitaire retenu selon la méthode affichée.
  const coutUnitaire = (h, methode) => (methode === 'dernier' ? h.dernierPrix : h.cmup);
  // Valeur d'un stock : un stock nul ou négatif ne vaut rien (le négatif est une anomalie à corriger).
  const valeur = (stock, cout) => (stock > 0 && Number.isFinite(cout) ? arrondiC(stock * cout) : 0);

  // Marge théorique sur prix de vente HT : marge unitaire, taux de marque (marge ÷ prix de vente),
  // coefficient (prix de vente ÷ coût).
  function marge(prixVente, cout) {
    if (!Number.isFinite(prixVente) || !Number.isFinite(cout) || prixVente <= 0) return { unitaire: null, tauxMarque: null, coefficient: null };
    const u = prixVente - cout;
    return { unitaire: arrondiC(u), tauxMarque: (u / prixVente) * 100, coefficient: cout > 0 ? Math.round((prixVente / cout) * 100) / 100 : null };
  }

  // Quantité à commander quand le stock est au seuil ou dessous. Avec une quantité de réapprovisionnement :
  // le plus petit multiple de cette quantité qui remet le stock au-dessus du seuil. Sans : de quoi revenir
  // au double du seuil. 0 si le stock est au-dessus du seuil ou sans seuil.
  function quantiteACommander(stock, seuil, reappro) {
    if (!(seuil > 0) || stock > seuil) return 0;
    if (reappro > 0) {
      const n = Math.max(1, Math.floor(arrondiQ((seuil - stock) / reappro) + 1e-9) + 1);
      return arrondiQ(n * reappro);
    }
    return arrondiQ(Math.max(0, 2 * seuil - stock));
  }

  // Rotation sur une période de n jours se terminant aujourd'hui : quantité sortie (ventes et consommations)
  // ÷ stock moyen ((stock au début + stock actuel) ÷ 2). Couverture : jours de stock au rythme des sorties.
  function rotation(article, mouvements, auj, jours) {
    const debut = ajout(auj, -jours);
    const sorties = arrondiQ(mouvements.filter((m) => m.article === article.id && m.type === 'sortie' && m.date > debut && m.date <= auj).reduce((s, m) => s + Math.abs(Number(m.quantite) || 0), 0));
    const sDebut = Math.max(0, stockA(article, mouvements, debut));
    const sFin = Math.max(0, stockA(article, mouvements, auj));
    const moyen = (sDebut + sFin) / 2;
    const rot = moyen > 0 ? Math.round((sorties / moyen) * 100) / 100 : null;
    const couverture = sorties > 0 ? Math.round(sFin / (sorties / jours)) : null;
    return { sorties, stockMoyen: arrondiQ(moyen), rotation: rot, couverture };
  }

  // Dormant : en stock, sans aucune sortie depuis n jours (ou jamais vendu, alors que le premier mouvement
  // date de plus de n jours).
  function estDormant(h, auj, jours) {
    if (!(h.stock > 0)) return false;
    const ref = h.derniereSortie || h.premier;
    return !!ref && ecart(ref, auj) > jours;
  }

  // Situation complète d'un article à une date.
  function situation(article, etat, auj) {
    const r = etat.reglages;
    const h = historique(article, etat.mouvements, auj);
    const cout = coutUnitaire(h, r.methode);
    const dormant = estDormant(h, auj, r.joursDormant);
    let statut;
    if (article.inactif) statut = 'inactif';
    else if (!h.lignes.length && h.stock <= 0) statut = 'nouveau';
    else if (h.stock <= 0) statut = 'rupture';
    else if (article.seuil > 0 && h.stock <= article.seuil) statut = 'sousSeuil';
    else if (dormant) statut = 'dormant';
    else statut = 'ok';
    const aCommander = article.inactif ? 0 : quantiteACommander(h.stock, article.seuil, article.reappro);
    return {
      article, statut, dormant, stock: h.stock, cmup: h.cmup, dernierPrix: h.dernierPrix, cout,
      valeur: valeur(h.stock, cout), valeurCmup: valeur(h.stock, h.cmup), valeurDernier: valeur(h.stock, h.dernierPrix),
      valeurVente: valeur(h.stock, article.prixVente), marge: marge(article.prixVente, cout),
      aCommander, coutCommande: aCommander && Number.isFinite(h.dernierPrix) ? arrondiC(aCommander * h.dernierPrix) : 0,
      derniereSortie: h.derniereSortie, derniereEntree: h.derniereEntree, premier: h.premier,
      negatif: h.stock < 0, historique: h,
    };
  }

  // Ventes théoriques d'une période : quantité sortie × prix de vente de la fiche, et marge au coût moyen du
  // moment de chaque sortie (moins les retours clients de la période, au même prix).
  function ventesPeriode(etat, auj, jours) {
    const debut = ajout(auj, -jours);
    let ca = 0, cout = 0, nb = 0;
    for (const a of etat.articles) {
      if (!Number.isFinite(a.prixVente)) continue;
      for (const l of historique(a, etat.mouvements, auj).lignes) {
        if (l.m.date <= debut || (l.m.type !== 'sortie' && l.m.type !== 'retourClient')) continue;
        const q = -l.delta; // sortie : positif ; retour client : négatif
        ca += q * a.prixVente;
        cout += q * (Number.isFinite(l.cout) ? l.cout : 0);
        if (l.m.type === 'sortie') nb++;
      }
    }
    return { ca: arrondiC(ca), marge: arrondiC(ca - cout), nb };
  }

  // Synthèse pour le tableau de bord.
  function synthese(etat, auj) {
    const sit = etat.articles.map((a) => situation(a, etat, auj));
    const actifs = sit.filter((s) => s.statut !== 'inactif');
    const somme = (l, k) => arrondiC(l.reduce((t, s) => t + (s[k] || 0), 0));
    const par = (st) => actifs.filter((s) => s.statut === st);
    const aCommander = actifs.filter((s) => s.aCommander > 0).sort((x, y) => (x.stock - x.article.seuil) - (y.stock - y.article.seuil));
    const dormants = actifs.filter((s) => s.dormant);
    const ordreCat = new Map((etat.categories || []).map((c, i) => [c, i]));
    const cats = new Map();
    for (const s of actifs) {
      const c = s.article.categorie || 'Sans catégorie';
      const x = cats.get(c) || { nom: c, valeur: 0, nb: 0 };
      x.valeur = arrondiC(x.valeur + s.valeur); x.nb++;
      cats.set(c, x);
    }
    const parCategorie = [...cats.values()].sort((a, b) => b.valeur - a.valeur || (ordreCat.get(a.nom) ?? 99) - (ordreCat.get(b.nom) ?? 99));
    const valeurTotale = somme(actifs, 'valeur');
    const valeurVente = somme(actifs.filter((s) => Number.isFinite(s.article.prixVente)), 'valeurVente');
    const coutVendable = somme(actifs.filter((s) => Number.isFinite(s.article.prixVente)), 'valeur');
    return {
      situations: sit, nbActifs: actifs.length,
      valeur: valeurTotale, valeurCmup: somme(actifs, 'valeurCmup'), valeurDernier: somme(actifs, 'valeurDernier'),
      valeurVente, margeStock: arrondiC(valeurVente - coutVendable),
      ruptures: par('rupture'), sousSeuil: par('sousSeuil'), negatifs: actifs.filter((s) => s.negatif),
      aCommander, coutCommande: somme(aCommander, 'coutCommande'),
      dormants, valeurDormante: somme(dormants, 'valeur'),
      parCategorie,
      ventes: ventesPeriode(etat, auj, etat.reglages.joursVentes),
    };
  }

  // Liste « à commander » regroupée par fournisseur (texte libre de la fiche ; vide → « Sans fournisseur »).
  function commandesParFournisseur(aCommander) {
    const g = new Map();
    for (const s of aCommander) {
      const f = (s.article.fournisseur || '').trim() || 'Sans fournisseur';
      const x = g.get(f) || { fournisseur: f, lignes: [], total: 0 };
      x.lignes.push(s); x.total = arrondiC(x.total + s.coutCommande);
      g.set(f, x);
    }
    return [...g.values()].sort((a, b) => (a.fournisseur === 'Sans fournisseur') - (b.fournisseur === 'Sans fournisseur') || a.fournisseur.localeCompare(b.fournisseur));
  }
  // Texte à copier pour une commande (rien n'est envoyé).
  function texteCommande(groupe, entreprise = '') {
    const l = groupe.lignes.map((s) => `- ${s.article.ref ? `${s.article.ref} · ` : ''}${s.article.nom} : ${nombre(s.aCommander)} ${s.article.unite}`);
    return `Bonjour,\n\nPourriez-vous nous faire parvenir :\n${l.join('\n')}\n\nMerci de nous confirmer le délai et le prix.\n\nCordialement,${entreprise ? `\n${entreprise}` : ''}`;
  }

  // ---------- Inventaire ----------
  // Articles d'un nouvel inventaire. complet : tous les articles actifs. tournant : selon un critère
  // { categorie } | { emplacement } | { anciens: n } (les n articles comptés le moins récemment, jamais
  // comptés d'abord) | { articles: [ids] }.
  function dernierComptage(articleId, inventaires) {
    let d = null;
    for (const inv of inventaires || []) {
      if (inv.statut !== 'valide') continue;
      const l = inv.lignes.find((x) => x.article === articleId);
      if (l && l.compte !== null && l.compte !== undefined && (!d || inv.date > d)) d = inv.date;
    }
    return d;
  }
  function articlesInventaire(etat, type, critere = {}) {
    const actifs = etat.articles.filter((a) => !a.inactif);
    if (type === 'complet') return actifs.map((a) => a.id);
    if (critere.categorie) return actifs.filter((a) => a.categorie === critere.categorie).map((a) => a.id);
    if (critere.emplacement) return actifs.filter((a) => a.emplacement === critere.emplacement).map((a) => a.id);
    if (critere.anciens) {
      return actifs.map((a) => ({ a, d: dernierComptage(a.id, etat.inventaires) || '' }))
        .sort((x, y) => x.d.localeCompare(y.d) || x.a.nom.localeCompare(y.a.nom)).slice(0, critere.anciens).map((x) => x.a.id);
    }
    if (Array.isArray(critere.articles)) return actifs.filter((a) => critere.articles.includes(a.id)).map((a) => a.id);
    return [];
  }
  function creerInventaire(etat, { id, nom, date, type, critere }) {
    return { id, nom: nom || (type === 'complet' ? 'Inventaire complet' : 'Inventaire tournant'), date, type: type === 'complet' ? 'complet' : 'tournant', statut: 'enCours', lignes: articlesInventaire(etat, type, critere).map((a) => ({ article: a, compte: null })), valideLe: null };
  }
  // Écarts d'un inventaire : stock théorique à la date du comptage (fin de journée), compte saisi, écart
  // (compte − théorique) et sa valeur au coût moyen de cette date. Pour un inventaire validé, les valeurs
  // figées à la validation sont reprises.
  function ecartsInventaire(inv, etat) {
    const lignes = inv.lignes.map((l) => {
      const a = etat.articles.find((x) => x.id === l.article);
      if (!a) return null;
      let theorique, cout;
      if (inv.statut === 'valide' && Number.isFinite(l.theorique)) { theorique = l.theorique; cout = l.cout ?? null; } else {
        const h = historique(a, etat.mouvements.filter((m) => m.inventaire !== inv.id), inv.date);
        theorique = h.stock; cout = h.cmup;
      }
      const compte = l.compte === null || l.compte === undefined ? null : arrondiQ(l.compte);
      const ec = compte === null ? null : arrondiQ(compte - theorique);
      return { article: a, theorique, compte, ecart: ec, cout, valeurEcart: ec === null || !Number.isFinite(cout) ? 0 : arrondiC(ec * cout) };
    }).filter(Boolean);
    const comptees = lignes.filter((l) => l.compte !== null);
    const justes = comptees.filter((l) => l.ecart === 0);
    const plus = arrondiC(comptees.filter((l) => l.valeurEcart > 0).reduce((s, l) => s + l.valeurEcart, 0));
    const moins = arrondiC(comptees.filter((l) => l.valeurEcart < 0).reduce((s, l) => s + l.valeurEcart, 0));
    return {
      lignes, nb: lignes.length, comptees: comptees.length, restantes: lignes.length - comptees.length,
      avecEcart: comptees.length - justes.length, exactitude: comptees.length ? (justes.length / comptees.length) * 100 : null,
      valeurPlus: plus, valeurMoins: moins, valeurNette: arrondiC(plus + moins),
    };
  }
  // Validation : un ajustement daté du jour du comptage pour chaque écart non nul ; les lignes non comptées
  // restent inchangées. Renvoie un nouvel état ; l'inventaire est figé (théorique, coût, écart).
  function validerInventaire(etat, invId, auj, nouvelIdFn = nouvelId) {
    const e = JSON.parse(JSON.stringify(etat));
    const inv = e.inventaires.find((x) => x.id === invId);
    if (!inv || inv.statut === 'valide') return e;
    const r = ecartsInventaire(inv, e);
    for (const l of r.lignes) {
      const ligne = inv.lignes.find((x) => x.article === l.article.id);
      ligne.theorique = l.theorique; ligne.cout = l.cout;
      if (l.compte === null || l.ecart === 0) continue;
      e.mouvements.push({ id: nouvelIdFn(), article: l.article.id, date: inv.date, type: 'ajustement', quantite: l.ecart, prix: null, note: `${inv.nom} : compté ${nombre(l.compte)}, attendu ${nombre(l.theorique)}`, inventaire: inv.id });
    }
    inv.statut = 'valide'; inv.valideLe = auj;
    return e;
  }

  // ---------- Normalisation ----------
  function nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const prixOuNull = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' && Number(v) >= 0 ? arrondiC(Number(v)) : null);
  const qteOuZero = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? arrondiQ(Number(v)) : 0);
  const entier = (v, min, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : d; };
  function normaliserArticle(a = {}) {
    return {
      id: String(a.id || nouvelId()), ref: texte(a.ref, 30), nom: texte(a.nom, 100) || 'Article sans nom', categorie: texte(a.categorie, 60),
      unite: texte(a.unite, 20) || 'pièce', emplacement: texte(a.emplacement, 60), fournisseur: texte(a.fournisseur, 80),
      prixAchat: prixOuNull(a.prixAchat), prixVente: prixOuNull(a.prixVente), seuil: qteOuZero(a.seuil), reappro: qteOuZero(a.reappro),
      note: texte(a.note, 300), inactif: !!a.inactif,
    };
  }
  function normaliserMouvement(m = {}) {
    const type = TYPES[m.type] ? m.type : 'sortie';
    const q = Number(m.quantite);
    return {
      id: String(m.id || nouvelId()), article: String(m.article || ''), date: estDate(m.date) ? m.date : '1970-01-01', type,
      quantite: type === 'ajustement' ? arrondiQ(Number.isFinite(q) ? q : 0) : arrondiQ(Math.abs(Number.isFinite(q) ? q : 0)),
      prix: type === 'entree' ? prixOuNull(m.prix) : null, note: texte(m.note, 200), ...(m.inventaire ? { inventaire: String(m.inventaire) } : {}),
    };
  }
  function normaliserInventaire(i = {}) {
    return {
      id: String(i.id || nouvelId()), nom: texte(i.nom, 80) || 'Inventaire', date: estDate(i.date) ? i.date : '1970-01-01',
      type: i.type === 'complet' ? 'complet' : 'tournant', statut: i.statut === 'valide' ? 'valide' : 'enCours', valideLe: estDate(i.valideLe) ? i.valideLe : null,
      lignes: (Array.isArray(i.lignes) ? i.lignes : []).map((l) => ({
        article: String(l.article || ''), compte: l.compte === null || l.compte === undefined || l.compte === '' || !Number.isFinite(Number(l.compte)) ? null : arrondiQ(Number(l.compte)),
        ...(Number.isFinite(l.theorique) ? { theorique: arrondiQ(l.theorique) } : {}), ...(l.cout !== undefined ? { cout: prixOuNull(l.cout) } : {}),
      })),
    };
  }
  function etatVide(defauts = {}) {
    const r = defauts.reglages || {};
    return { version: 1, entreprise: '', categories: [...(defauts.categories || [])], reglages: { methode: 'cmup', joursDormant: 90, joursRotation: 90, joursVentes: 30, ...JSON.parse(JSON.stringify(r)) }, articles: [], mouvements: [], inventaires: [] };
  }
  function normaliser(d, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    const r = d.reglages || {};
    const articles = (Array.isArray(d.articles) ? d.articles : []).map(normaliserArticle);
    const ids = new Set(articles.map((a) => a.id));
    return {
      version: 1, entreprise: texte(d.entreprise, 80), ...(d.majLe ? { majLe: d.majLe } : {}),
      categories: Array.isArray(d.categories) ? [...new Set(d.categories.map((c) => texte(c, 60)).filter(Boolean))] : v.categories,
      reglages: {
        methode: r.methode === 'dernier' ? 'dernier' : 'cmup',
        joursDormant: entier(r.joursDormant, 7, 730, v.reglages.joursDormant),
        joursRotation: entier(r.joursRotation, 7, 730, v.reglages.joursRotation),
        joursVentes: entier(r.joursVentes, 1, 365, v.reglages.joursVentes),
      },
      articles,
      mouvements: (Array.isArray(d.mouvements) ? d.mouvements : []).map(normaliserMouvement).filter((m) => ids.has(m.article)),
      inventaires: (Array.isArray(d.inventaires) ? d.inventaires : []).map(normaliserInventaire),
    };
  }
  // Suppression d'un article : ses mouvements et ses lignes d'inventaire partent avec lui.
  function supprimerArticle(etat, id) {
    const e = JSON.parse(JSON.stringify(etat));
    e.articles = e.articles.filter((a) => a.id !== id);
    e.mouvements = e.mouvements.filter((m) => m.article !== id);
    e.inventaires.forEach((i) => { i.lignes = i.lignes.filter((l) => l.article !== id); });
    return e;
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, nombres à la française) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const euroCsv = (c) => (c === null || c === undefined || !Number.isFinite(c) ? '' : (Math.round(c * 100) / 10000).toFixed(4).replace(/0{1,2}$/, '').replace('.', ','));
  const qteCsv = (q) => String(arrondiQ(q)).replace('.', ',');
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsvArticles(etat, auj) {
    const tete = ['Référence', 'Article', 'Catégorie', 'Unité', 'Emplacement', 'Fournisseur', 'Stock', 'Seuil', 'Réappro', 'À commander', 'Prix d\'achat HT fiche', 'CMUP', 'Dernier prix d\'achat', 'Valeur CMUP', 'Valeur dernier prix', 'Prix de vente HT', 'Taux de marque (%)', 'Statut', 'Dormant', 'Dernière sortie'];
    const l = etat.articles.map((a) => {
      const s = situation(a, etat, auj);
      return [a.ref, a.nom, a.categorie, a.unite, a.emplacement, a.fournisseur, qteCsv(s.stock), qteCsv(a.seuil), qteCsv(a.reappro), qteCsv(s.aCommander), euroCsv(a.prixAchat), euroCsv(s.cmup), euroCsv(s.dernierPrix), euroCsv(s.valeurCmup), euroCsv(s.valeurDernier), euroCsv(a.prixVente), s.marge.tauxMarque === null ? '' : String(Math.round(s.marge.tauxMarque * 10) / 10).replace('.', ','), LIB_STATUT[s.statut], s.dormant ? 'oui' : 'non', s.derniereSortie || ''];
    });
    return csv([tete, ...l]);
  }
  function versCsvMouvements(etat) {
    const tete = ['Date', 'Référence', 'Article', 'Type', 'Quantité (signée)', 'Unité', 'Prix unitaire HT', 'Note'];
    const l = mouvementsTries(etat.mouvements).map((m) => {
      const a = etat.articles.find((x) => x.id === m.article) || {};
      return [m.date, a.ref || '', a.nom || '', TYPES[m.type].nom, qteCsv(delta(m)), a.unite || '', euroCsv(m.prix), m.note];
    });
    return csv([tete, ...l]);
  }

  racine.STK = {
    TYPES, METHODES, STATUTS, LIB_STATUT,
    iso, versDate, ajout, ecart, estDate,
    arrondiQ, lireMontant, lireQuantite, euros, saisieMontant, nombre, saisieQuantite, pct,
    delta, mouvementsTries, historique, stockA, coutUnitaire, valeur, marge, quantiteACommander, rotation, estDormant,
    situation, ventesPeriode, synthese, commandesParFournisseur, texteCommande,
    dernierComptage, articlesInventaire, creerInventaire, ecartsInventaire, validerInventaire,
    nouvelId, normaliserArticle, normaliserMouvement, normaliserInventaire, normaliser, etatVide, supprimerArticle,
    versCsvArticles, versCsvMouvements,
  };
})(typeof window !== 'undefined' ? window : globalThis);
