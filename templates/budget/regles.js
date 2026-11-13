// Budget du foyer QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.BDG) et par les tests Node (vm).
// Tous les montants sont des centimes entiers : aucune erreur d'arrondi dans les calculs.
(function (racine) {
  'use strict';

  const GROUPES = ['besoins', 'envies', 'epargne'];

  // ---------- Montants ----------
  // « 1 234,56 », « 12.5 », « 12 € », « 0,05 » → centimes entiers ; null si illisible ou négatif.
  function versCentimes(saisie) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) && saisie >= 0 ? Math.round(saisie * 100) : null;
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(/^\+/, '');
    if (!/^\d+(?:[.,]\d{0,2})?$/.test(s)) return null;
    const [ent, dec = ''] = s.split(/[.,]/);
    return Number(ent) * 100 + Number((dec + '00').slice(0, 2));
  }

  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // 1 234,56 € (espace fine insécable entre les milliers) ; signe : « + » devant un positif.
  function euros(c, { signe = false } = {}) {
    const n = Math.abs(Math.round(c));
    const s = `${milliers(Math.floor(n / 100))},${String(n % 100).padStart(2, '0')} €`;
    if (c < 0) return `−${s}`;
    return signe && c > 0 ? `+${s}` : s;
  }

  // Arrondi à l'euro, pour les graphiques et les tuiles : 1 235 €.
  function eurosRonds(c) {
    const n = Math.round(Math.abs(c) / 100);
    return `${c < 0 && n ? '−' : ''}${milliers(n)} €`;
  }

  // ---------- Mois ----------
  const deux = (n) => String(n).padStart(2, '0');
  const moisDe = (date) => String(date).slice(0, 7);
  function ajoutMois(mois, n) {
    const [a, m] = mois.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`;
  }
  const joursDansMois = (mois) => { const [a, m] = mois.split('-').map(Number); return new Date(a, m, 0).getDate(); };
  function ecartMois(de, a) {
    const [a1, m1] = de.split('-').map(Number), [a2, m2] = a.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  }

  // ---------- Répartition exacte ----------
  // Partage un montant selon des poids positifs, méthode du plus fort reste : la somme vaut exactement le montant.
  function repartirPoids(montant, poids) {
    const W = poids.reduce((s, p) => s + p, 0);
    if (!poids.length || W <= 0) return poids.map(() => 0);
    const base = poids.map((p) => Math.floor((montant * p) / W));
    const restes = poids.map((p, i) => ({ i, r: (montant * p) % W }));
    let manque = montant - base.reduce((s, b) => s + b, 0);
    restes.sort((a, b) => b.r - a.r || a.i - b.i);
    for (let k = 0; manque > 0; k++, manque--) base[restes[k % restes.length].i] += 1;
    return base;
  }

  // ---------- Enveloppes ----------
  const categorie = (E, id) => E.categories.find((c) => c.id === id);

  // Montant de l'enveloppe d'une catégorie pour un mois : montant propre au mois, sinon montant par défaut.
  function enveloppeDu(E, catId, mois) {
    const a = E.ajustements?.[mois];
    if (a && Number.isInteger(a[catId])) return a[catId];
    return Number.isInteger(categorie(E, catId)?.enveloppe) ? categorie(E, catId).enveloppe : 0;
  }

  // Dépenses par mois et par catégorie (un seul passage sur les opérations).
  function indexDepenses(E) {
    const idx = {};
    for (const o of E.operations) {
      if (o.type !== 'depense') continue;
      const m = moisDe(o.date);
      const x = (idx[m] ||= {});
      x[o.categorieId] = (x[o.categorieId] || 0) + o.montant;
    }
    return idx;
  }

  function depensesDuMois(E, mois) {
    const parCat = {}, parSous = {};
    let total = 0;
    for (const o of E.operations) {
      if (o.type !== 'depense' || moisDe(o.date) !== mois) continue;
      parCat[o.categorieId] = (parCat[o.categorieId] || 0) + o.montant;
      const cle = `${o.categorieId}/${o.sousId || ''}`;
      parSous[cle] = (parSous[cle] || 0) + o.montant;
      total += o.montant;
    }
    return { parCat, parSous, total };
  }

  function revenusDuMois(E, mois) {
    const parSource = {};
    let total = 0;
    for (const o of E.operations) {
      if (o.type !== 'revenu' || moisDe(o.date) !== mois) continue;
      const s = E.sources.some((x) => x.id === o.sourceId) ? o.sourceId : 'autre';
      parSource[s] = (parSource[s] || 0) + o.montant;
      total += o.montant;
    }
    return { parSource, total };
  }

  const revenusPrevus = (E) => E.sources.reduce((s, x) => s + (Number.isInteger(x.prevu) ? x.prevu : 0), 0);

  // Statut d'une enveloppe : dépassée, presque vide (≥ 90 %), hors budget (dépense sans enveloppe), ok.
  function statutEnveloppe(disponible, depense) {
    if (disponible < 0) return 'depasse';
    if (disponible === 0) return depense > 0 ? 'hors' : 'aucune';
    if (depense > disponible) return 'depasse';
    if (depense * 10 >= disponible * 9) return 'presque';
    return 'ok';
  }

  // État de chaque enveloppe pour un mois, report des restes compris (depuis le mois de départ du budget).
  function etatEnveloppes(E, mois, idx = indexDepenses(E)) {
    const debut = E.debut && E.debut <= mois ? E.debut : mois;
    const n = Math.min(ecartMois(debut, mois), 240);
    return E.categories.map((c) => {
      let report = 0;
      if (c.report) {
        for (let i = n; i >= 1; i--) {
          const m = ajoutMois(mois, -i);
          report = report + enveloppeDu(E, c.id, m) - (idx[m]?.[c.id] || 0);
        }
      }
      const enveloppe = enveloppeDu(E, c.id, mois);
      const disponible = enveloppe + report;
      const depense = idx[mois]?.[c.id] || 0;
      return { id: c.id, groupe: c.groupe, enveloppe, report, disponible, depense, reste: disponible - depense,
        taux: disponible > 0 ? depense / disponible : (depense > 0 ? Infinity : 0), statut: statutEnveloppe(disponible, depense) };
    });
  }

  // Totaux par groupe d'une liste { groupe, valeur }.
  function parGroupe(liste, cle = 'valeur') {
    const t = { besoins: 0, envies: 0, epargne: 0 };
    for (const x of liste) if (x.groupe in t) t[x.groupe] += x[cle];
    return t;
  }

  // Repère 50/30/20 : part réelle de chaque groupe dans la base (revenus), cible et écart, en centimes.
  function repere503020(montants, base, reperes = { besoins: 50, envies: 30, epargne: 20 }) {
    return GROUPES.map((g) => {
      const montant = montants[g] || 0;
      const cible = Math.round((base * reperes[g]) / 100);
      return { groupe: g, montant, repere: reperes[g], cible, ecart: montant - cible,
        part: base > 0 ? Math.round((montant * 1000) / base) / 10 : null };
    });
  }

  // ---------- Flux (diagramme de Sankey) ----------
  // sources (revenus réels) → groupes (besoins, envies, épargne, non dépensé) → catégories.
  // Si les sorties dépassent les revenus, une source « manque » équilibre le diagramme.
  function fluxSankey(E, mois, { maxParGroupe = 6 } = {}) {
    const dep = depensesDuMois(E, mois);
    const rev = revenusDuMois(E, mois);
    const sources = [...E.sources, { id: 'autre', nom: 'Autres revenus' }]
      .map((s) => ({ id: s.id, nom: s.nom, valeur: rev.parSource[s.id] || 0 })).filter((s) => s.valeur > 0);
    const categories = [];
    for (const g of GROUPES) {
      const liste = E.categories.filter((c) => c.groupe === g).map((c) => ({ id: c.id, nom: c.nom, groupe: g, valeur: dep.parCat[c.id] || 0 }))
        .filter((c) => c.valeur > 0).sort((a, b) => b.valeur - a.valeur);
      if (liste.length > maxParGroupe) {
        const autres = liste.splice(maxParGroupe - 1);
        liste.push({ id: `autres-${g}`, nom: `Autres (${autres.length})`, groupe: g, valeur: autres.reduce((s, c) => s + c.valeur, 0), regroupe: autres.map((c) => c.id) });
      }
      categories.push(...liste);
    }
    // Dépenses dans une catégorie supprimée : comptées en besoins, « Sans catégorie ».
    const connues = new Set(E.categories.map((c) => c.id));
    const orphelines = Object.entries(dep.parCat).filter(([id]) => !connues.has(id)).reduce((s, [, v]) => s + v, 0);
    if (orphelines) categories.push({ id: 'sans', nom: 'Sans catégorie', groupe: 'besoins', valeur: orphelines });
    const tg = parGroupe(categories);
    const groupes = GROUPES.map((g) => ({ id: g, valeur: tg[g] })).filter((g) => g.valeur > 0);
    const sorties = dep.total;
    if (rev.total > sorties) groupes.push({ id: 'reste', valeur: rev.total - sorties });
    if (sorties > rev.total) sources.push({ id: 'manque', nom: 'Pris sur l\'épargne ou le découvert', valeur: sorties - rev.total });

    // Liens sources → groupes : chaque groupe est financé au prorata des sources.
    // Le plus gros groupe est traité en dernier et prend le reste de chaque source : sommes exactes des deux côtés.
    const liensSG = [];
    if (sources.length && groupes.length) {
      const ordre = groupes.map((g, i) => i).sort((a, b) => groupes[a].valeur - groupes[b].valeur);
      const restant = sources.map((s) => s.valeur);
      const parts = {};
      ordre.forEach((gi, k) => {
        const g = groupes[gi];
        const v = k === ordre.length - 1 ? [...restant] : repartirPoids(g.valeur, sources.map((s) => s.valeur));
        v.forEach((x, si) => { restant[si] -= x; });
        parts[gi] = v;
      });
      groupes.forEach((g, gi) => sources.forEach((s, si) => { if (parts[gi][si] > 0) liensSG.push({ de: s.id, vers: g.id, valeur: parts[gi][si] }); }));
    }
    const liensGC = categories.map((c) => ({ de: c.groupe, vers: c.id, valeur: c.valeur }));
    return { sources, groupes, categories, liensSG, liensGC, revenus: rev.total, sorties };
  }

  // Disposition du Sankey pour une largeur donnée (pixels réels : le texte reste lisible sur téléphone).
  // Chaque nœud occupe au moins `ligne` pixels de haut (deux lignes de texte), sans chevauchement.
  function dispositionSankey(flux, { largeur = 720, ligne = 34, ecart = 8, hauteurUtile } = {}) {
    const L = Math.max(280, Math.round(largeur));
    const compact = L < 560;
    const bloc = compact ? 84 : 132;
    const xs = [0, Math.round(compact ? L * 0.34 : L * 0.36), L - 12];
    const ws = [bloc, bloc, 12];
    const total = Math.max(flux.revenus, flux.sorties);
    const Hv = hauteurUtile || (compact ? 240 : 320);
    const k = total > 0 ? Hv / total : 0;
    const colonnes = [flux.sources, flux.groupes, flux.categories];
    const noeuds = [];
    let H = 0;
    colonnes.forEach((col, ci) => {
      let y = 0;
      col.forEach((n) => {
        const h = Math.max(2, n.valeur * k);
        const slot = Math.max(h, ligne);
        noeuds.push({ col: ci, id: n.id, nom: n.nom, groupe: n.groupe, valeur: n.valeur, x: xs[ci], w: ws[ci], y: y + (slot - h) / 2, h, haut: y, slot });
        y += slot + ecart;
      });
      H = Math.max(H, y - ecart);
    });
    const parId = (col, id) => noeuds.find((n) => n.col === col && n.id === id);
    const curseurs = new Map(noeuds.map((n) => [n, { sortie: n.y, entree: n.y }]));
    const liens = [];
    const tracer = (liste, c0, c1) => {
      for (const l of liste) {
        const a = parId(c0, l.de), b = parId(c1, l.vers);
        if (!a || !b) continue;
        const e = Math.max(1, l.valeur * k);
        const y0 = curseurs.get(a).sortie, y1 = curseurs.get(b).entree;
        curseurs.get(a).sortie += l.valeur * k; curseurs.get(b).entree += l.valeur * k;
        const x0 = a.x + a.w, x1 = b.x, xm = (x0 + x1) / 2;
        const r = (v) => Math.round(v * 10) / 10;
        liens.push({ de: l.de, vers: l.vers, valeur: l.valeur, groupe: c0 === 0 ? l.vers : l.de,
          d: `M${r(x0)},${r(y0)}C${r(xm)},${r(y0)} ${r(xm)},${r(y1)} ${r(x1)},${r(y1)}L${r(x1)},${r(y1 + e)}C${r(xm)},${r(y1 + e)} ${r(xm)},${r(y0 + e)} ${r(x0)},${r(y0 + e)}Z` });
      }
    };
    tracer(flux.liensSG, 0, 1);
    tracer(flux.liensGC, 1, 2);
    return { L, H: Math.ceil(H), compact, noeuds, liens };
  }

  // ---------- Opérations fixes ----------
  // Opérations à créer pour un mois : une seule par fixe et par mois, jour ramené à la fin des mois courts.
  function genererFixes(E, mois) {
    const deja = new Set(E.operations.filter((o) => o.fixeId && moisDe(o.date) === mois).map((o) => o.fixeId));
    return E.fixes.filter((f) => !deja.has(f.id) && Number.isInteger(f.montant) && f.montant > 0).map((f) => ({
      id: `fx-${f.id}-${mois}`, fixeId: f.id, type: f.type, montant: f.montant, libelle: f.libelle,
      categorieId: f.type === 'depense' ? f.categorieId : null, sousId: f.type === 'depense' ? (f.sousId || null) : null,
      sourceId: f.type === 'revenu' ? f.sourceId : null,
      date: `${mois}-${deux(Math.min(Math.max(1, f.jour || 1), joursDansMois(mois)))}`,
    }));
  }

  // ---------- Bilan ----------
  // Série des n derniers mois jusqu'à `fin` : revenus, dépenses par groupe, total des enveloppes.
  function serieMois(E, fin, n = 12) {
    const idx = indexDepenses(E);
    const groupeDe = Object.fromEntries(E.categories.map((c) => [c.id, c.groupe]));
    return Array.from({ length: n }, (_, i) => {
      const m = ajoutMois(fin, i - n + 1);
      const d = { besoins: 0, envies: 0, epargne: 0 };
      for (const [id, v] of Object.entries(idx[m] || {})) d[groupeDe[id] || 'besoins'] += v;
      return { mois: m, revenus: revenusDuMois(E, m).total, depenses: d, total: d.besoins + d.envies + d.epargne,
        enveloppes: E.categories.reduce((s, c) => s + enveloppeDu(E, c.id, m), 0) };
    });
  }

  // Écart au budget par catégorie sur une liste de mois (sans report) : positif = dépensé de plus que prévu.
  function ecartsCategories(E, mois) {
    const idx = indexDepenses(E);
    return E.categories.map((c) => {
      const budget = mois.reduce((s, m) => s + enveloppeDu(E, c.id, m), 0);
      const total = mois.reduce((s, m) => s + (idx[m]?.[c.id] || 0), 0);
      return { id: c.id, groupe: c.groupe, budget, total, ecart: total - budget, moyenne: mois.length ? Math.round(total / mois.length) : 0 };
    });
  }

  racine.BDG = {
    GROUPES, versCentimes, euros, eurosRonds, moisDe, ajoutMois, joursDansMois, ecartMois, repartirPoids,
    enveloppeDu, indexDepenses, depensesDuMois, revenusDuMois, revenusPrevus, statutEnveloppe, etatEnveloppes,
    parGroupe, repere503020, fluxSankey, dispositionSankey, genererFixes, serieMois, ecartsCategories,
  };
})(typeof window !== 'undefined' ? window : globalThis);
