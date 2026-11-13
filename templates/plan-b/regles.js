// PlanB · règles métier pures (aucun accès au DOM ni au stockage). window.PNB, testé par
// outils/templates/plan-b.test.mjs.
// Besoins = quantité du référentiel × composition du foyer × jours d'objectif (selon la règle de l'article).
// Stock utile = lots non périmés à la date du jour. Autonomie théorique (jours) = stock utile ÷ besoin
// quotidien du foyer, pour l'eau potable et les repas ; autonomie globale = la plus faible des deux.
// Niveau de préparation (0 à 100) = 50 % réserves (couverture moyenne des articles, plafonnée à 100 %
// par article) + 40 % actions de préparation faites (« avant ») + 10 % contact personnel renseigné.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const REGLES = ['personneJour', 'personne', 'foyer', 'bebeJour', 'animalJour', 'besoinJour'];
  const POIDS = { reserves: 0.5, plan: 0.4, contacts: 0.1 };

  // ---------- Foyer ----------
  function composition(e) {
    const parProfil = Object.fromEntries(B().profils.map((p) => [p.id, e.membres.filter((m) => m.profil === p.id).length]));
    const parBesoin = Object.fromEntries(B().besoins.map((b) => [b.id, e.membres.filter((m) => m.besoins.includes(b.id)).length]));
    return { personnes: e.membres.length, bebes: parProfil.bebe, parProfil, parBesoin, animaux: e.animaux.reduce((s, a) => s + a.nombre, 0) };
  }

  // Quantité nécessaire d'un article pour l'objectif de jours (arrondie au centième).
  function besoin(a, comp, jours) {
    const q = a.q || 0;
    const v = {
      personneJour: q * comp.personnes * jours,
      personne: q * comp.personnes,
      foyer: comp.personnes > 0 || comp.animaux > 0 ? q : 0,
      bebeJour: q * comp.bebes * jours,
      animalJour: q * comp.animaux * jours,
      besoinJour: q * (comp.parBesoin[a.besoin] || 0) * jours,
    }[a.regle] ?? 0;
    return O.arrondi(v, 2);
  }

  // ---------- Stock ----------
  const estPerime = (lot, auj) => !!lot.peremption && lot.peremption < auj;
  function stockArticle(e, articleId, auj) {
    const lots = e.stock.filter((s) => s.articleId === articleId);
    return {
      lots,
      utile: O.arrondi(lots.filter((l) => !estPerime(l, auj)).reduce((s, l) => s + l.quantite, 0), 2),
      perime: O.arrondi(lots.filter((l) => estPerime(l, auj)).reduce((s, l) => s + l.quantite, 0), 2),
    };
  }
  function bilanArticles(e, auj) {
    const comp = composition(e);
    return e.articles.filter((a) => a.actif).map((a) => {
      const b = besoin(a, comp, e.reglages.jours);
      const st = stockArticle(e, a.id, auj);
      return { article: a, besoin: b, stock: st.utile, perime: st.perime, lots: st.lots.length, manquant: O.arrondi(Math.max(0, b - st.utile), 2), couverture: b > 0 ? Math.min(1, st.utile / b) : null };
    });
  }

  // ---------- Autonomie ----------
  function autonomie(e, auj) {
    const comp = composition(e);
    if (!comp.personnes) return { eau: null, nourriture: null, global: null, limitant: null };
    const calc = (type) => {
      const a = e.articles.find((x) => x.actif && x.autonomie === type);
      if (!a || !(a.q > 0)) return null;
      const parJour = a.q * comp.personnes;
      return O.arrondi(stockArticle(e, a.id, auj).utile / parJour, 1);
    };
    const eau = calc('eau'), nourriture = calc('nourriture');
    const vals = [eau, nourriture].filter((x) => x !== null);
    const global = vals.length ? Math.min(...vals) : null;
    return { eau, nourriture, global, limitant: global === null ? null : eau === global ? 'eau' : 'nourriture' };
  }

  // ---------- Péremptions ----------
  function peremptions(e, auj, alerteJours) {
    const res = e.stock.filter((l) => l.peremption).map((l) => ({ lot: l, jours: O.ecart(auj, l.peremption) }))
      .filter((x) => x.jours <= alerteJours).sort((a, b) => a.jours - b.jours);
    return { perimes: res.filter((x) => x.jours < 0), proches: res.filter((x) => x.jours >= 0) };
  }

  // ---------- Situations et préparation ----------
  // Actions d'une situation (référentiel + actions personnelles), par moment.
  function actions(e, situationId) {
    const s = B().situations.find((x) => x.id === situationId);
    const perso = (m) => e.persos.filter((p) => p.situationId === situationId && p.moment === m).map((p) => ({ id: p.id, texte: p.texte, perso: true }));
    const base = (m) => (s?.[m] || []).map(([id, texte]) => ({ id, texte, perso: false }));
    return { avant: [...base('avant'), ...perso('avant')], pendant: [...base('pendant'), ...perso('pendant')], apres: [...base('apres'), ...perso('apres')] };
  }
  // Actions liées aux besoins spécifiques des membres (une par besoin présent).
  function actionsBesoins(e) {
    const comp = composition(e);
    return B().besoins.filter((b) => comp.parBesoin[b.id] > 0).map((b) => ({ id: `besoin-${b.id}`, texte: b.conseil, besoin: b.id, membres: e.membres.filter((m) => m.besoins.includes(b.id)).map((m) => m.prenom) }));
  }
  function preparation(e, auj) {
    const bilan = bilanArticles(e, auj).filter((x) => x.besoin > 0);
    const reserves = bilan.length ? bilan.reduce((s, x) => s + x.couverture, 0) / bilan.length : 0;
    const avant = [...B().situations.flatMap((s) => actions(e, s.id).avant), ...actionsBesoins(e)];
    const faits = avant.filter((a) => e.faits[a.id]).length;
    const plan = avant.length ? faits / avant.length : 0;
    const contacts = e.contacts.length > 0 ? 1 : 0;
    const score = Math.round((reserves * POIDS.reserves + plan * POIDS.plan + contacts * POIDS.contacts) * 100);
    const niveau = score >= 90 ? 'Très bien préparé' : score >= 70 ? 'Bien préparé' : score >= 40 ? 'En cours' : 'À démarrer';
    return { score, niveau, reserves: Math.round(reserves * 100), plan: Math.round(plan * 100), actionsFaites: faits, actionsTotal: avant.length, contacts: !!contacts };
  }
  // Liste des éléments manquants (achats, actions, contacts).
  function manques(e, auj) {
    const res = [];
    if (!e.membres.length) res.push({ type: 'foyer', texte: 'Décrire les membres du foyer (les quantités en dépendent)' });
    // Ordre d'urgence : périmés à remplacer, besoins spécifiques, contact, puis achats.
    const bilan = bilanArticles(e, auj);
    for (const x of bilan) if (x.perime > 0) res.push({ type: 'remplacer', articleId: x.article.id, texte: `${x.article.nom} : ${O.fmtNombre(x.perime)} ${x.article.unite} périmé(s) à remplacer` });
    for (const b of actionsBesoins(e)) if (!e.faits[b.id]) res.push({ type: 'action', id: b.id, texte: b.texte });
    if (!e.contacts.length) res.push({ type: 'contact', texte: 'Ajouter au moins un contact personnel (proche, voisin, contact hors de la zone)' });
    for (const x of bilan) if (x.manquant > 0) res.push({ type: 'achat', articleId: x.article.id, texte: x.article.nom, quantite: x.manquant, unite: x.article.unite, categorie: x.article.categorie });
    return res;
  }

  // ---------- Normalisation ----------
  const num = (v, min, max) => { const n = typeof v === 'number' ? v : O.lireNombre(v); return n !== null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
  function normaliserArticle(a) {
    a = a && typeof a === 'object' ? a : {};
    const cats = B().categories.map((c) => c.id);
    return {
      id: O.idValide(a.id), nom: O.texte(a.nom, 120) || 'Article', categorie: O.choix(a.categorie, cats, 'equipement'), unite: O.texte(a.unite, 20) || 'u',
      regle: O.choix(a.regle, REGLES, 'foyer'), q: num(a.q, 0, 1000) ?? 0, besoin: a.regle === 'besoinJour' ? O.choix(a.besoin, B().besoins.map((b) => b.id), 'traitement') : null,
      autonomie: O.choix(a.autonomie, ['eau', 'nourriture'], null), peremption: !!a.peremption, aide: O.texte(a.aide, 200), actif: a.actif !== false, perso: !!a.perso,
    };
  }
  const articlesInitiaux = () => B().articles.map((a) => normaliserArticle(structuredClone(a)));
  const etatVide = () => ({ version: 1, reglages: { nomFoyer: '', jours: 3, alerteJours: 60 }, membres: [], animaux: [], contacts: [], stock: [], articles: articlesInitiaux(), faits: {}, persos: [], plans: {} });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const articles = Array.isArray(d.articles) && d.articles.length ? d.articles.slice(0, 200).map(normaliserArticle) : v.articles;
    // Un seul article par type d'autonomie (le premier), pour un calcul sans ambiguïté.
    for (const t of ['eau', 'nourriture']) articles.filter((a) => a.autonomie === t).slice(1).forEach((a) => { a.autonomie = null; });
    const ids = new Set(articles.map((a) => a.id));
    const situations = B().situations.map((s) => s.id);
    const faits = {};
    for (const [k, val] of Object.entries(d.faits && typeof d.faits === 'object' ? d.faits : {})) if (/^[\w-]{1,40}$/.test(k) && O.estDate(val)) faits[k] = val;
    const plans = {};
    for (const s of situations) if (d.plans?.[s]) plans[s] = { rassemblement: O.texte(d.plans[s].rassemblement, 200), consignes: O.texte(d.plans[s].consignes, 1000) };
    return {
      ...d, version: 1,
      reglages: { nomFoyer: O.texte(d.reglages?.nomFoyer, 80), jours: O.entier(d.reglages?.jours, 1, 30, 3), alerteJours: O.entier(d.reglages?.alerteJours, 7, 365, 60) },
      membres: O.tableau(d.membres).slice(0, 30).map((m) => ({ id: O.idValide(m?.id), prenom: O.texte(m?.prenom, 40) || 'Membre', profil: O.choix(m?.profil, B().profils.map((p) => p.id), 'adulte'), besoins: O.tableau(m?.besoins).filter((b) => B().besoins.some((x) => x.id === b)), note: O.texte(m?.note, 300) })),
      animaux: O.tableau(d.animaux).slice(0, 30).map((a) => ({ id: O.idValide(a?.id), nom: O.texte(a?.nom, 40), espece: O.choix(a?.espece, B().especes.map((x) => x.id), 'autre'), nombre: O.entier(a?.nombre, 1, 50, 1) })),
      contacts: O.tableau(d.contacts).slice(0, 60).map((c) => ({ id: O.idValide(c?.id), nom: O.texte(c?.nom, 80) || 'Contact', role: O.texte(c?.role, 80), telephone: O.texte(c?.telephone, 40), note: O.texte(c?.note, 200) })),
      stock: O.tableau(d.stock).slice(0, 600).filter((l) => ids.has(l?.articleId)).map((l) => ({ id: O.idValide(l.id), articleId: l.articleId, quantite: num(l.quantite, 0, 1e6) ?? 0, peremption: O.dateOuNull(l.peremption), emplacement: O.texte(l.emplacement, 80) })),
      articles, faits,
      persos: O.tableau(d.persos).slice(0, 200).filter((p) => situations.includes(p?.situationId) && ['avant', 'pendant', 'apres'].includes(p?.moment)).map((p) => ({ id: O.idValide(p.id), situationId: p.situationId, moment: p.moment, texte: O.texte(p.texte, 200) || 'Action' })),
      plans,
    };
  }

  // ---------- Exports CSV ----------
  const nomCat = (id) => B().categories.find((c) => c.id === id)?.nom || '';
  function csvReserves(e, auj) {
    const rows = [['Catégorie', 'Article', 'Unité', 'Besoin pour l\'objectif', 'Stock utile', 'Manquant', 'Couverture (%)', 'Lot : quantité', 'Lot : péremption', 'Lot : emplacement', 'Lot périmé']];
    for (const x of bilanArticles(e, auj)) {
      const lots = e.stock.filter((l) => l.articleId === x.article.id);
      const base = [nomCat(x.article.categorie), x.article.nom, x.article.unite, O.nombreCsv(x.besoin), O.nombreCsv(x.stock), O.nombreCsv(x.manquant), x.couverture === null ? '' : Math.round(x.couverture * 100)];
      if (!lots.length) rows.push([...base, '', '', '', '']);
      for (const l of lots) rows.push([...base, O.nombreCsv(l.quantite), l.peremption || '', l.emplacement, estPerime(l, auj) ? 'oui' : 'non']);
    }
    return rows;
  }
  function csvCourses(e, auj) {
    return [['Catégorie', 'Article', 'Quantité à acheter', 'Unité'], ...manques(e, auj).filter((m) => m.type === 'achat').map((m) => [nomCat(m.categorie), m.texte, O.nombreCsv(m.quantite), m.unite])];
  }

  racine.PNB = {
    REGLES, POIDS, composition, besoin, estPerime, stockArticle, bilanArticles, autonomie, peremptions, actions, actionsBesoins, preparation, manques,
    normaliserArticle, articlesInitiaux, etatVide, normaliser, csvReserves, csvCourses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
