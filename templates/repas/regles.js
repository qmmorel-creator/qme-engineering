// Repas de la semaine QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RPS) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ ». Semaine = du lundi au dimanche. Quantités en unité de base de l'ingrédient.
//
// Moteur de liste de courses (partageable avec le template Nutrition) : listeCourses(lignes, catalogue)
// ne connaît que des lignes { ingredient, qte, unite, source } et un catalogue d'ingrédients
// { id, nom, rayon, unite, poids?, u?, placard?, cuillere?, achat? } ; il ignore tout du planning.
(function (racine) {
  'use strict';

  const MOMENTS = ['midi', 'soir'];
  const LIB_MOMENT = { midi: 'Midi', soir: 'Soir' };
  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const SAISONS = { 1: 'hi', 2: 'hi', 3: 'pr', 4: 'pr', 5: 'pr', 6: 'et', 7: 'et', 8: 'et', 9: 'au', 10: 'au', 11: 'au', 12: 'hi' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Lundi de la semaine d'une date (la semaine commence le lundi).
  const lundi = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));
  const joursSemaine = (l) => Array.from({ length: 7 }, (_, k) => ajout(l, k));
  const indiceJour = (s) => (versDate(s).getDay() + 6) % 7; // 0 = lundi
  const saisonDe = (s) => SAISONS[versDate(s).getMonth() + 1];

  // ---------- Texte ----------
  const sansAccents = (s) => String(s ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, '\'').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const singulierMot = (m) => (m.length > 3 && /[sx]$/.test(m) && !/ss$/.test(m) ? m.slice(0, -1) : m);
  // Forme de comparaison : minuscules, sans accents, chaque mot au singulier, sans article en tête.
  const cleNom = (s) => sansAccents(s).replace(/^(?:de la |de l'|des |du |de |d'|la |le |les |l'|un |une )/, '').split(/\s+/).filter(Boolean).map(singulierMot).join(' ');
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ---------- Unités ----------
  // dim : masse (g), volume (ml), piece (pc). f : facteur vers l'unité de base de la dimension.
  const UNITES = {
    g: { dim: 'masse', f: 1 }, kg: { dim: 'masse', f: 1000 },
    ml: { dim: 'volume', f: 1 }, cl: { dim: 'volume', f: 10 }, dl: { dim: 'volume', f: 100 }, l: { dim: 'volume', f: 1000 },
    cas: { dim: 'volume', f: 15 }, cac: { dim: 'volume', f: 5 },
    pc: { dim: 'piece', f: 1 },
  };
  const DIM_BASE = { g: 'masse', ml: 'volume', pc: 'piece' };
  const dimIngredient = (ing) => (ing && ing.unite ? DIM_BASE[ing.unite] || null : null);

  // Convertit une quantité saisie dans une unité vers la dimension de l'ingrédient quand c'est possible
  // (pièces ↔ grammes avec le poids moyen d'une pièce). Sinon, garde sa propre dimension : la ligne de
  // courses reste séparée plutôt que d'additionner des grammes et des pièces.
  function versBase(qte, unite, ing) {
    const dimI = dimIngredient(ing);
    if (qte === null || qte === undefined || !Number.isFinite(Number(qte))) return { dim: null, qte: null };
    const u = UNITES[unite || ing?.unite] || null;
    if (!u) return { dim: dimI, qte: Number(qte) };
    let v = Number(qte) * u.f;
    if (!dimI || u.dim === dimI) return { dim: u.dim, qte: v };
    if (ing.poids > 0 && u.dim === 'masse' && dimI === 'piece') return { dim: 'piece', qte: v / ing.poids };
    if (ing.poids > 0 && u.dim === 'piece' && dimI === 'masse') return { dim: 'masse', qte: v * ing.poids };
    return { dim: u.dim, qte: v };
  }

  // Arrondi d'achat : pièces entières (on n'achète pas 2,4 oignons), grammes et millilitres arrondis au-dessus.
  function arrondiAchat(qte, dim) {
    if (qte === null || !(qte > 0)) return qte;
    const plafond = (x, pas) => Math.ceil(x / pas - 1e-9) * pas;
    if (dim === 'piece') return plafond(qte, 1);
    if (qte >= 1000) return plafond(qte, 50);
    if (qte >= 100) return plafond(qte, 10);
    return plafond(qte, 5);
  }

  const nombre = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  // Quarts lisibles pour les recettes : 0,5 → ½, 1,25 → 1 ¼.
  function fraction(n) {
    const q = Math.round(n * 4) / 4;
    if (q === 0) return n > 0 ? '¼' : '0';
    const ent = Math.floor(q); const reste = q - ent;
    const f = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[reste] || '';
    return ent ? `${ent}${f ? ` ${f}` : ''}` : f;
  }
  const plurielU = (u, n) => (n > 1 && !/[sx]$/.test(u) ? `${u}s` : u);

  // Texte d'une quantité. mode 'achat' (liste de courses, déjà arrondie) ou 'recette' (quarts, cuillères).
  function formatQte(qte, dim, ing = {}, mode = 'achat') {
    if (qte === null || qte === undefined) return '';
    if (dim === 'masse') {
      if (qte >= 1000) return `${nombre(Math.round(qte / 10) / 100)} kg`;
      return `${mode === 'recette' ? Math.round(qte) : Math.round(qte)} g`;
    }
    if (dim === 'volume') {
      if (ing.cuillere && qte < 100) {
        if (qte >= 15) { const c = Math.round(qte / 15 * 2) / 2; return `${fraction(c)} c. à soupe`; }
        const c = Math.max(0.5, Math.round(qte / 5 * 2) / 2); return `${fraction(c)} c. à café`;
      }
      if (qte >= 1000) return `${nombre(Math.round(qte / 10) / 100)} L`;
      if (qte >= 100) return `${nombre(Math.round(qte / 10))} cl`;
      return `${Math.round(qte)} ml`;
    }
    if (dim === 'piece') {
      const n = mode === 'recette' ? fraction(qte) : String(Math.round(qte));
      return ing.u ? `${n} ${plurielU(ing.u, qte)}` : n;
    }
    return nombre(qte);
  }

  // Conditionnement indicatif : « 2 × boîte de 400 g ».
  function conditionnement(qte, dim, ing) {
    if (!ing?.achat || !(qte > 0) || dim !== dimIngredient(ing)) return null;
    const n = Math.ceil(qte / ing.achat.par - 1e-9);
    return { n, lib: ing.achat.lib, texte: `${n} × ${ing.achat.lib}` };
  }

  // Ligne de recette → texte modifiable qui se relit à l'identique avec lireLigne : « 2 c. à soupe Huile d'olive ».
  function ligneEnTexte([id, qte, unite], parId) {
    const ing = parId.get(id) || { id, nom: id, unite: null };
    if (qte === undefined || qte === null) return ing.nom;
    const b = versBase(qte, unite, ing);
    let q;
    if (b.dim === 'masse') q = b.qte >= 1000 ? `${nombre(b.qte / 1000)} kg` : `${nombre(b.qte)} g`;
    else if (b.dim === 'volume') {
      const demi = (x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;
      q = ing.cuillere && b.qte < 100 && b.qte >= 15 && demi(b.qte / 15) ? `${nombre(b.qte / 15)} c. à soupe`
        : ing.cuillere && b.qte < 100 && demi(b.qte / 5) ? `${nombre(b.qte / 5)} c. à café`
        : b.qte >= 1000 ? `${nombre(b.qte / 1000)} l` : b.qte % 10 ? `${nombre(b.qte)} ml` : `${nombre(b.qte / 10)} cl`;
    }
    else q = `${nombre(b.qte)}${ing.u ? ` ${plurielU(ing.u, b.qte)}` : ''}`;
    return `${q} ${ing.nom}`;
  }

  // ---------- Lecture d'une ligne d'ingrédient saisie ----------
  const MOTS_UNITE = [
    [/^(?:kg|kilos?|kilogrammes?)$/, 'kg'], [/^(?:g|gr|grammes?)$/, 'g'],
    [/^(?:l|litres?)$/, 'l'], [/^(?:dl)$/, 'dl'], [/^(?:cl|centilitres?)$/, 'cl'], [/^(?:ml|millilitres?)$/, 'ml'],
    [/^(?:cas|cs|c\.?a\.?s\.?|cuilleres? a soupe|c\. a soupe|cuil\. a soupe)$/, 'cas'],
    [/^(?:cac|cc|c\.?a\.?c\.?|cuilleres? a cafe|c\. a cafe|cuil\. a cafe)$/, 'cac'],
  ];
  // Mots de pièce : « 2 gousses d'ail », « 1 tranche de jambon ».
  const MOTS_PIECE = /^(?:pieces?|gousses?|tranches?|bouquets?|branches?|feuilles?|cubes?|rouleaux?|boules?|paves?|sachets?|pots?|bottes?|tetes?|filets?)$/;
  // Contenants convertis avec le conditionnement de l'ingrédient quand il le précise.
  const MOTS_CONTENANT = /^(?:boites?|briques?|paquets?|barquettes?|plaquettes?|tablettes?|bocaux|bocal|sachets?|pots?|blocs?|lots?)$/;

  function lireNombre(s) {
    const t = String(s).replace(',', '.');
    let m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
    m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
    if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
    const v = { '½': 0.5, '¼': 0.25, '¾': 0.75 }[t];
    if (v) return v;
    return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
  }

  // « 200 g de farine », « 2 oignons », « 1/2 citron », « 3 c. à soupe d'huile d'olive », « sel » →
  // { qte, unite ('g', 'kg', 'ml', 'cl', 'l', 'cas', 'cac', 'pc' ou null), contenant, nom }
  function lireLigne(saisie) {
    let s = String(saisie ?? '').trim().replace(/^[-•*]\s*/, '').replace(/\s+/g, ' ');
    if (!s) return null;
    // Même longueur que la saisie (œ et ’ gardés) : le nom d'origine se retrouve par position.
    const plat = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, '\'');
    let qte = null; let unite = null; let contenant = null;
    const m = /^((?:\d+\s+)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[½¼¾])\s*(.*)$/.exec(plat);
    let reste = plat;
    if (m) {
      qte = lireNombre(m[1].replace(/\s*\/\s*/g, '/'));
      reste = m[2];
      // Unité collée ou séparée : « 200g », « 200 g », « 2 c. à soupe »
      for (const [re, u] of MOTS_UNITE) {
        const mots = reste.split(' ');
        for (let n = Math.min(4, mots.length); n >= 1; n--) {
          if (re.test(mots.slice(0, n).join(' '))) { unite = u; reste = mots.slice(n).join(' '); break; }
        }
        if (unite) break;
      }
      if (!unite) {
        const [premier, ...suite] = reste.split(' ');
        if (MOTS_PIECE.test(premier) && !MOTS_CONTENANT.test(premier)) { unite = 'pc'; reste = suite.join(' '); }
        else if (MOTS_CONTENANT.test(premier)) { contenant = premier; unite = 'pc'; reste = suite.join(' '); }
        else unite = 'pc';
      }
    }
    reste = reste.replace(/^(?:de la |de l'|des |du |de |d'|d’)/, '').trim();
    if (!reste) return null;
    // Garde le nom tel que saisi (accents compris) : on retire du début autant de caractères que de texte consommé.
    const nom = s.slice(s.length - reste.length).trim() || reste;
    return { qte, unite, contenant, nom };
  }

  // Ingrédient du catalogue qui correspond à un nom saisi, ou null.
  function trouverIngredient(nom, catalogue) {
    const c = cleNom(nom);
    if (!c) return null;
    let meilleur = null;
    for (const ing of catalogue) {
      const k = cleNom(ing.nom);
      if (k === c || (ing.alias || []).some((a) => cleNom(a) === c)) return ing;
      // Inclusion mot à mot : « poulet » trouve « filets de poulet », jamais « bœuf » → « œuf ».
      const mk = k.split(' '); const mc = c.split(' ');
      const contient = mc.every((m) => mk.includes(m)) || mk.filter((m) => m.length > 2).every((m) => mc.includes(m));
      if (contient && (!meilleur || Math.abs(k.length - c.length) < Math.abs(cleNom(meilleur.nom).length - c.length))) meilleur = ing;
    }
    return meilleur;
  }

  // Ligne saisie → ligne de recette [id, qte, unite] ; crée un ingrédient perso si besoin.
  function ligneRecette(lu, catalogue, rayonParDefaut = 'au') {
    if (!lu) return null;
    let ing = trouverIngredient(lu.nom, catalogue);
    let nouveau = null;
    if (!ing) {
      const dim = lu.unite ? UNITES[lu.unite].dim : null;
      nouveau = { id: `perso-${cleNom(lu.nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || nouvelId()}`, nom: lu.nom.charAt(0).toUpperCase() + lu.nom.slice(1), rayon: rayonParDefaut, unite: dim === 'masse' ? 'g' : dim === 'volume' ? 'ml' : dim === 'piece' ? 'pc' : null, perso: true };
      ing = nouveau;
    }
    let qte = lu.qte; let unite = lu.unite;
    if (lu.contenant && ing.achat && sansAccents(ing.achat.lib).startsWith(lu.contenant.replace(/x$/, '').replace(/s$/, ''))) {
      qte = (qte ?? 1) * ing.achat.par; unite = ing.unite;
    }
    if (qte === null) return { ligne: [ing.id], nouveau };
    return { ligne: unite && unite !== ing.unite ? [ing.id, qte, unite] : [ing.id, qte], nouveau };
  }

  // ---------- Recettes ----------
  const tempsTotal = (r) => (Number(r.prep) || 0) + (Number(r.cuisson) || 0);
  const estRapide = (r) => tempsTotal(r) <= 30;
  const listeSaisons = (r) => String(r.saisons || '').split(/\s+/).filter(Boolean);
  const deSaison = (r, saison) => { const l = listeSaisons(r); return !l.length || l.includes(saison); };
  const indexer = (liste) => new Map(liste.map((x) => [x.id, x]));

  // Régimes calculés depuis les ingrédients, jamais déclarés.
  function regimes(r, parId) {
    const ings = r.ingredients.map(([id]) => parId.get(id)).filter(Boolean);
    const viande = ings.some((i) => i.viande);
    const poisson = ings.some((i) => i.poisson);
    return { vegetarien: !viande && !poisson, sansPorc: !ings.some((i) => i.porc), poisson, viande };
  }
  const respecte = (r, parId, voulus = []) => {
    if (!voulus.length) return true;
    const g = regimes(r, parId);
    return voulus.every((v) => (v === 'vegetarien' ? g.vegetarien : v === 'sans-porc' ? g.sansPorc : true));
  };

  // Quantités d'une recette pour n personnes : [{ ing, qte, dim, texte }]
  function quantitesPour(r, personnes, parId) {
    const f = personnes / (r.portions || 4);
    return r.ingredients.map(([id, qte, unite]) => {
      const ing = parId.get(id) || { id, nom: id, unite: null };
      if (qte === undefined || qte === null) return { ing, qte: null, dim: null, texte: 'selon le goût' };
      const b = versBase(qte * f, unite, ing);
      return { ing, qte: b.qte, dim: b.dim, texte: formatQte(b.qte, b.dim, ing, 'recette') };
    });
  }

  // Filtre de la bibliothèque. f = { q, cat, vegetarien, sansPorc, rapide, saison, favoris, perso }
  function filtrerRecettes(recettes, f, parId, ctx = {}) {
    const q = sansAccents(f.q || '');
    const mots = q.split(/\s+/).filter((m) => m.length > 1);
    return recettes.filter((r) => {
      if (f.cat && f.cat !== 'toutes' && r.cat !== f.cat) return false;
      if (f.rapide && !estRapide(r)) return false;
      if (f.saison && !deSaison(r, f.saison)) return false;
      if (f.favoris && !(ctx.favoris || []).includes(r.id)) return false;
      if (f.perso && !r.perso) return false;
      const g = (f.vegetarien || f.sansPorc) ? regimes(r, parId) : null;
      if (f.vegetarien && !g.vegetarien) return false;
      if (f.sansPorc && !g.sansPorc) return false;
      if (mots.length) {
        const texte = sansAccents([r.nom, ...r.ingredients.map(([id]) => parId.get(id)?.nom || '')].join(' '));
        if (!mots.every((m) => texte.includes(m) || texte.includes(singulierMot(m)))) return false;
      }
      return true;
    }).sort((a, b) => sansAccents(a.nom).localeCompare(sansAccents(b.nom), 'fr'));
  }

  // ---------- Planning ----------
  const repasDuJour = (repas, date, moment) => repas.filter((x) => x.date === date && x.moment === moment);
  const repasSemaine = (repas, l) => { const fin = ajout(l, 6); return repas.filter((x) => x.date >= l && x.date <= fin); };

  // Lignes de courses des repas planifiés (les textes libres « restes », « dehors » n'en donnent pas).
  function lignesDepuisRepas(repas, recettesParId) {
    const lignes = [];
    for (const x of repas) {
      const r = x.recette && recettesParId.get(x.recette);
      if (!r) continue;
      const f = (x.personnes || r.portions || 4) / (r.portions || 4);
      for (const [id, qte, unite] of r.ingredients) lignes.push({ ingredient: id, qte: qte === undefined || qte === null ? null : qte * f, unite: unite || null, source: r.nom });
    }
    return lignes;
  }

  // ---------- Moteur de liste de courses ----------
  // lignes : [{ ingredient, qte, unite?, source? }] ; catalogue : Map id → ingrédient (ou tableau).
  // options : { ordreRayons: [ids], rayonsPerso: { id: rayon } }
  // → articles [{ cle, id, nom, rayon, dim, qte (arrondie), brut, texte, achat, sources, placard, sansQuantite }]
  function listeCourses(lignes, catalogue, options = {}) {
    const parId = catalogue instanceof Map ? catalogue : indexer(catalogue);
    const ordre = options.ordreRayons || [];
    const perso = options.rayonsPerso || {};
    const groupes = new Map();
    for (const l of lignes) {
      const ing = parId.get(l.ingredient) || { id: l.ingredient, nom: l.ingredient, rayon: 'au', unite: null };
      const b = versBase(l.qte, l.unite, ing);
      const cle = `${ing.id}|${b.qte === null ? 'aucune' : b.dim}`;
      const g = groupes.get(cle) || { cle, id: ing.id, nom: ing.nom, rayon: perso[ing.id] || ing.rayon || 'au', dim: b.qte === null ? null : b.dim, brut: null, sources: [], placard: Boolean(ing.placard), ing };
      if (b.qte !== null) g.brut = (g.brut || 0) + b.qte;
      if (l.source && !g.sources.includes(l.source)) g.sources.push(l.source);
      groupes.set(cle, g);
    }
    // Un ingrédient sans quantité (« sel ») disparaît si une ligne chiffrée existe pour lui.
    const chiffres = new Set([...groupes.values()].filter((g) => g.brut !== null).map((g) => g.id));
    const rangRayon = (id) => { const k = ordre.indexOf(id); return k < 0 ? 999 : k; };
    return [...groupes.values()]
      .filter((g) => g.brut !== null || !chiffres.has(g.id))
      .map((g) => {
        const qte = g.brut === null ? null : (g.dim === 'volume' && g.ing.cuillere && g.brut < 100 ? g.brut : arrondiAchat(g.brut, g.dim));
        const { ing, ...reste } = g;
        return { ...reste, qte, sansQuantite: qte === null, texte: qte === null ? '' : formatQte(qte, g.dim, ing), achat: conditionnement(qte, g.dim, ing) };
      })
      .sort((a, b) => rangRayon(a.rayon) - rangRayon(b.rayon) || sansAccents(a.nom).localeCompare(sansAccents(b.nom), 'fr'));
  }

  // Regroupe des articles par rayon dans l'ordre du magasin : [{ rayon, articles }]
  function parRayon(articles, ordreRayons) {
    const m = new Map();
    for (const a of articles) { if (!m.has(a.rayon)) m.set(a.rayon, []); m.get(a.rayon).push(a); }
    const rang = (id) => { const k = ordreRayons.indexOf(id); return k < 0 ? 999 : k; };
    return [...m.entries()].sort((a, b) => rang(a[0]) - rang(b[0])).map(([rayon, liste]) => ({ rayon, articles: liste }));
  }

  // Avancement en magasin : seuls les articles à acheter comptent (pas ceux déjà à la maison).
  function avancement(articles, etat) {
    const coches = new Set(etat.coches || []); const maison = new Set(etat.maison || []);
    const aAcheter = articles.filter((a) => !maison.has(a.cle));
    const pris = aAcheter.filter((a) => coches.has(a.cle)).length;
    return { total: aAcheter.length, pris, reste: aAcheter.length - pris, pct: aAcheter.length ? Math.round(pris / aAcheter.length * 100) : 0, maison: articles.length - aAcheter.length };
  }

  // Texte à partager (SMS, messagerie) : rayons, articles non cochés et non présents à la maison.
  function texteListe(groupes, nomsRayons, etat, titre) {
    const coches = new Set(etat.coches || []); const maison = new Set(etat.maison || []);
    const lignes = [titre];
    for (const g of groupes) {
      const restants = g.articles.filter((a) => !coches.has(a.cle) && !maison.has(a.cle));
      if (!restants.length) continue;
      lignes.push('', nomsRayons[g.rayon] || 'Autres');
      for (const a of restants) lignes.push(`- ${a.nom}${a.texte ? ` : ${a.texte}` : ''}`);
    }
    return lignes.join('\n');
  }

  // ---------- Avec ce qu'il me reste ----------
  // dispo : identifiants d'ingrédients présents. Les ingrédients du placard (sel, huile, épices) ne comptent pas.
  // → [{ recette, ont, manque, pct }] trié : le moins d'ingrédients manquants, les plats avant les desserts, puis le
  // plus d'ingrédients utilisés.
  function avecCeQuiReste(recettes, dispo, parId, { maxManque = 3 } = {}) {
    const a = new Set(dispo);
    if (!a.size) return [];
    const res = [];
    for (const r of recettes) {
      if (r.cat === 'dessert' && !r.ingredients.some(([id]) => a.has(id))) continue;
      const utiles = [...new Set(r.ingredients.map(([id]) => id))].filter((id) => !parId.get(id)?.placard);
      if (!utiles.length) continue;
      const ont = utiles.filter((id) => a.has(id));
      if (!ont.length) continue;
      const manque = utiles.filter((id) => !a.has(id));
      if (manque.length > maxManque) continue;
      res.push({ recette: r, ont, manque, pct: Math.round(ont.length / utiles.length * 100) });
    }
    const dessert = (x) => (x.recette.cat === 'dessert' ? 1 : 0);
    return res.sort((x, y) => x.manque.length - y.manque.length || dessert(x) - dessert(y) || y.ont.length - x.ont.length || tempsTotal(x.recette) - tempsTotal(y.recette));
  }

  // ---------- Propositions de repas ----------
  // Générateur pseudo-aléatoire déterministe (mêmes entrées → mêmes propositions, testable).
  function alea(graine) {
    let h = 1779033703 ^ String(graine).length;
    for (const c of String(graine)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  // creneaux : [{ date, moment }] à remplir ; recentes : identifiants servis récemment (évités si possible).
  // Règles : pas de dessert ; régimes respectés ; de saison d'abord ; soupe le soir seulement ; soirs du lundi au
  // vendredi en 40 minutes au plus ; jamais deux fois la même recette dans la proposition.
  function proposer(recettes, creneaux, parId, { saison, regimes: voulus = [], recentes = [], graine = 1, favoris = [] } = {}) {
    const hasard = alea(graine);
    const vus = new Set(recentes);
    const pris = new Set();
    const res = [];
    for (const c of creneaux) {
      const semaineSoir = c.moment === 'soir' && indiceJour(c.date) < 5;
      const candidats = recettes.filter((r) => r.cat !== 'dessert' && respecte(r, parId, voulus) && !pris.has(r.id)
        && (r.cat !== 'soupe' || c.moment === 'soir') && (!semaineSoir || tempsTotal(r) <= 40));
      if (!candidats.length) continue;
      let meilleur = null; let note = -Infinity;
      for (const r of candidats) {
        const s = hasard() + (deSaison(r, saison) ? 1 : 0) + (vus.has(r.id) ? -2 : 0) + (favoris.includes(r.id) ? 0.4 : 0) + (r.cat === 'plat' ? 0.3 : 0);
        if (s > note) { note = s; meilleur = r; }
      }
      pris.add(meilleur.id);
      res.push({ date: c.date, moment: c.moment, recette: meilleur.id });
    }
    return res;
  }

  // Créneaux vides d'une semaine. moments : ['midi', 'soir'] ; jours : indices 0 (lundi) à 6.
  function creneauxVides(repas, l, moments = MOMENTS, jours = [0, 1, 2, 3, 4, 5, 6]) {
    const out = [];
    joursSemaine(l).forEach((d, k) => { if (!jours.includes(k)) return; for (const m of moments) if (!repasDuJour(repas, d, m).length) out.push({ date: d, moment: m }); });
    return out;
  }

  // Copie des repas d'une semaine sur une autre (mêmes jours, nouveaux identifiants), sans écraser un créneau rempli.
  function copierSemaine(repas, de, vers) {
    const ajoutes = [];
    for (const x of repasSemaine(repas, de)) {
      const date = ajout(vers, ecart(de, x.date));
      if (repasDuJour(repas, date, x.moment).length) continue;
      ajoutes.push({ ...x, id: nouvelId(), date });
    }
    return ajoutes;
  }

  // ---------- Normalisation ----------
  const entier = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; };
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  function montant(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function normaliserRepas(x) {
    const o = x && typeof x === 'object' ? x : {};
    return { id: o.id || nouvelId(), date: estDate(o.date) ? o.date : null, moment: MOMENTS.includes(o.moment) ? o.moment : 'soir', recette: o.recette ? String(o.recette) : null, texte: texte(o.texte, 60), personnes: entier(o.personnes, 1, 30, 4) };
  }
  function normaliserIngredient(x, rayons) {
    const o = x && typeof x === 'object' ? x : {};
    return { id: String(o.id || `perso-${nouvelId()}`), nom: texte(o.nom, 60) || 'Ingrédient', rayon: rayons.includes(o.rayon) ? o.rayon : 'au', unite: ['g', 'ml', 'pc'].includes(o.unite) ? o.unite : null, perso: true };
  }
  function normaliserRecette(x, cats) {
    const o = x && typeof x === 'object' ? x : {};
    const ings = (Array.isArray(o.ingredients) ? o.ingredients : []).filter((l) => Array.isArray(l) && l[0]).map(([id, qte, unite]) => {
      const q = montant(qte);
      return q === null ? [String(id)] : unite && UNITES[unite] ? [String(id), q, unite] : [String(id), q];
    });
    return {
      id: String(o.id || `p-${nouvelId()}`), nom: texte(o.nom, 80) || 'Ma recette', cat: cats.includes(o.cat) ? o.cat : 'plat',
      prep: entier(o.prep, 0, 600, 0), cuisson: entier(o.cuisson, 0, 600, 0),
      saisons: String(o.saisons || '').split(/\s+/).filter((s) => ['pr', 'et', 'au', 'hi'].includes(s)).join(' '),
      portions: entier(o.portions, 1, 30, 4), ingredients: ings,
      etapes: (Array.isArray(o.etapes) ? o.etapes : []).map((e) => texte(e, 400)).filter(Boolean).slice(0, 20),
      note: texte(o.note, 300), origine: o.origine ? String(o.origine) : null, perso: true,
    };
  }
  function normaliserCourses(x) {
    const o = x && typeof x === 'object' ? x : {};
    const liste = (v) => [...new Set((Array.isArray(v) ? v : []).map(String))];
    return {
      coches: liste(o.coches), maison: liste(o.maison), placard: liste(o.placard),
      extras: (Array.isArray(o.extras) ? o.extras : []).filter((e) => e && e.nom).map((e) => ({ id: e.id || nouvelId(), nom: texte(e.nom, 60), qte: texte(e.qte, 30), rayon: String(e.rayon || 'au') })),
    };
  }

  const etatVide = (B) => ({
    version: 1, personnes: 4, regimes: [], repas: [], recettes: [], ingredients: [], favoris: [],
    courses: {}, habituels: [], rayonsPerso: {}, ordreRayons: B.rayons.map((r) => r.id), frigo: [],
  });

  function normaliser(d, B) {
    const e = etatVide(B);
    if (!d || typeof d !== 'object') return e;
    const rayons = B.rayons.map((r) => r.id);
    const cats = B.categories.map((c) => c.id);
    e.personnes = entier(d.personnes, 1, 30, 4);
    e.regimes = (Array.isArray(d.regimes) ? d.regimes : []).filter((r) => B.regimes.some((x) => x.id === r));
    e.repas = (Array.isArray(d.repas) ? d.repas : []).map(normaliserRepas).filter((x) => x.date && (x.recette || x.texte));
    e.recettes = (Array.isArray(d.recettes) ? d.recettes : []).map((r) => normaliserRecette(r, cats));
    e.ingredients = (Array.isArray(d.ingredients) ? d.ingredients : []).map((x) => normaliserIngredient(x, rayons));
    e.favoris = [...new Set((Array.isArray(d.favoris) ? d.favoris : []).map(String))];
    if (d.courses && typeof d.courses === 'object') for (const [k, v] of Object.entries(d.courses)) if (estDate(k)) e.courses[k] = normaliserCourses(v);
    e.habituels = (Array.isArray(d.habituels) ? d.habituels : []).filter((h) => h && h.nom).map((h) => ({ id: h.id || nouvelId(), nom: texte(h.nom, 60), rayon: rayons.includes(h.rayon) ? h.rayon : 'au' }));
    if (d.rayonsPerso && typeof d.rayonsPerso === 'object') for (const [k, v] of Object.entries(d.rayonsPerso)) if (rayons.includes(v)) e.rayonsPerso[k] = v;
    const ordre = (Array.isArray(d.ordreRayons) ? d.ordreRayons : []).filter((r) => rayons.includes(r));
    e.ordreRayons = [...new Set([...ordre, ...rayons])];
    e.frigo = [...new Set((Array.isArray(d.frigo) ? d.frigo : []).map(String))];
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  // Les listes de courses de plus de 8 semaines ne servent plus : on les retire pour garder un état léger.
  function purgerCourses(courses, aujourdhui) {
    const limite = ajout(lundi(aujourdhui), -56);
    return Object.fromEntries(Object.entries(courses).filter(([k]) => k >= limite));
  }

  racine.RPS = {
    MOMENTS, LIB_MOMENT, JOURS, UNITES,
    iso, versDate, ajout, ecart, estDate, lundi, joursSemaine, indiceJour, saisonDe,
    sansAccents, cleNom, nouvelId, montant,
    versBase, arrondiAchat, formatQte, fraction, conditionnement, dimIngredient,
    lireLigne, trouverIngredient, ligneRecette, ligneEnTexte,
    tempsTotal, estRapide, deSaison, regimes, respecte, quantitesPour, filtrerRecettes, indexer,
    repasDuJour, repasSemaine, lignesDepuisRepas, listeCourses, parRayon, avancement, texteListe,
    avecCeQuiReste, proposer, creneauxVides, copierSemaine, alea,
    normaliserRepas, normaliserRecette, normaliserIngredient, normaliserCourses, etatVide, normaliser, purgerCourses,
  };
})(typeof window !== 'undefined' ? window : globalThis);
