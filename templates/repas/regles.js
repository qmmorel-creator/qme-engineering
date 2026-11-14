// Repas de la semaine et liste de courses QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RPS) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » ; une semaine est identifiée par la date de son lundi. Une case de la
// semaine est « j-repas » (j = 0 lundi … 6 dimanche, repas = midi ou soir).
// Le moteur de liste de courses (fusionner, appliquerStock, regrouper) ne dépend que d'une liste
// d'ingrédients {nom, qte, unite, rayon} : il peut servir à un autre template.
(function (racine) {
  'use strict';

  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const REPAS = [['midi', 'Midi'], ['soir', 'Soir']];
  const TYPES_CASE = ['recette', 'restes', 'dehors', 'note'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const lundiDe = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));
  // Saison météorologique : mars-mai printemps, juin-août été, septembre-novembre automne, décembre-février hiver.
  const saisonDe = (s) => 'hhpppeeeaaah'[Number(s.slice(5, 7)) - 1] || 'h';
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const cleCase = (j, r) => `${j}-${r}`;
  const jourCase = (cle) => Number(String(cle).split('-')[0]);
  const repasCase = (cle) => String(cle).split('-')[1];
  const dateCase = (lundi, cle) => ajout(lundi, jourCase(cle));
  // Ordre chronologique des cases d'une semaine (midi avant soir).
  const ordreCase = (a, b) => jourCase(a) - jourCase(b) || REPAS.findIndex(([k]) => k === repasCase(a)) - REPAS.findIndex(([k]) => k === repasCase(b));

  // ---------- Nombres ----------
  const arrondi = (x, pas = 0.01) => Math.round((x + Number.EPSILON) / pas) * pas;
  const nombre = (x, dec = 2) => { const v = Math.round((x + Number.EPSILON) * 10 ** dec) / 10 ** dec; return String(v).replace('.', ',').replace('-', '−'); };
  const plafondPas = (x, pas) => Math.ceil(x / pas - 1e-9) * pas;
  // « 2,5 », « 1/2 », « ½ » → nombre ; null si vide ou illisible.
  function lireNombre(saisie) {
    let s = String(saisie ?? '').trim().replace(/[\s ]/g, '').replace(',', '.');
    const fractions = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
    if (fractions[s] !== undefined) return fractions[s];
    let m = s.match(/^(\d+)([½¼¾⅓⅔])$/);
    if (m) return Number(m[1]) + fractions[m[2]];
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }

  // ---------- Textes ----------
  // Clé de comparaison d'un nom d'ingrédient : minuscules, sans accents ni espaces superflus.
  const cleNom = (s) => String(s ?? '').trim().toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, '\'').replace(/\s+/g, ' ');
  const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // ---------- Unités ----------
  // Dimension et facteur vers l'unité de base : masse en grammes (m), volume en millilitres (v),
  // cuillères en cuillères à café (cuil : 1 c. à s. = 3 c. à c.), le reste à l'unité.
  const UNITES = {
    g: ['m', 1], kg: ['m', 1000], ml: ['v', 1], cl: ['v', 10], l: ['v', 1000],
    'pièce': ['pièce', 1], 'c. à s.': ['cuil', 3], 'c. à c.': ['cuil', 1], gousse: ['gousse', 1], botte: ['botte', 1],
    tranche: ['tranche', 1], 'pincée': ['pincée', 1], brin: ['brin', 1], feuille: ['feuille', 1], cube: ['cube', 1],
    sachet: ['sachet', 1], 'boîte': ['boîte', 1], paquet: ['paquet', 1],
  };
  const LISTE_UNITES = Object.keys(UNITES);
  const ALIAS = {
    g: 'g', gr: 'g', gramme: 'g', grammes: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', ml: 'ml', cl: 'cl', l: 'l', litre: 'l', litres: 'l',
    'pièce': 'pièce', 'pièces': 'pièce', piece: 'pièce', pieces: 'pièce', pc: 'pièce', pcs: 'pièce',
    'c. à s.': 'c. à s.', 'c.à.s.': 'c. à s.', 'c.à.s': 'c. à s.', 'c. a s.': 'c. à s.', cs: 'c. à s.', 'càs': 'c. à s.', cas: 'c. à s.',
    'cuillère à soupe': 'c. à s.', 'cuillères à soupe': 'c. à s.', 'cuillere a soupe': 'c. à s.', 'cuilleres a soupe': 'c. à s.', 'cuil. à soupe': 'c. à s.',
    'c. à c.': 'c. à c.', 'c.à.c.': 'c. à c.', 'c.à.c': 'c. à c.', 'c. a c.': 'c. à c.', cc: 'c. à c.', 'càc': 'c. à c.', cac: 'c. à c.',
    'cuillère à café': 'c. à c.', 'cuillères à café': 'c. à c.', 'cuillere a cafe': 'c. à c.', 'cuilleres a cafe': 'c. à c.', 'cuil. à café': 'c. à c.',
    gousse: 'gousse', gousses: 'gousse', botte: 'botte', bottes: 'botte', tranche: 'tranche', tranches: 'tranche',
    'pincée': 'pincée', 'pincées': 'pincée', pincee: 'pincée', pincees: 'pincée', brin: 'brin', brins: 'brin',
    feuille: 'feuille', feuilles: 'feuille', cube: 'cube', cubes: 'cube', sachet: 'sachet', sachets: 'sachet',
    'boîte': 'boîte', 'boîtes': 'boîte', boite: 'boîte', boites: 'boîte', paquet: 'paquet', paquets: 'paquet',
  };
  const ALIAS_TRIES = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
  const uniteValide = (u) => (UNITES[u] ? u : 'pièce');
  // Quantité exprimée dans l'unité de base de sa dimension. Sans quantité : dimension « sans ».
  function versBase(qte, unite) {
    if (qte === null || qte === undefined || !(qte > 0)) return { dim: 'sans', val: 0 };
    const [dim, f] = UNITES[uniteValide(unite)];
    return { dim, val: qte * f };
  }
  const PLURIELS = { gousse: 'gousses', botte: 'bottes', tranche: 'tranches', 'pincée': 'pincées', brin: 'brins', feuille: 'feuilles', cube: 'cubes', sachet: 'sachets', 'boîte': 'boîtes', paquet: 'paquets' };
  const COMPTES = ['pièce', 'gousse', 'botte', 'tranche', 'pincée', 'brin', 'feuille', 'cube', 'sachet', 'boîte', 'paquet'];
  // Arrondi pour les courses : on achète un peu plus, jamais moins.
  function arrondiCourses(dim, val) {
    if (!(val > 0)) return 0;
    if (dim === 'm' || dim === 'v') return val < 100 ? plafondPas(val, 5) : val < 1000 ? plafondPas(val, 10) : plafondPas(val, 50);
    if (dim === 'cuil') return val >= 3 ? plafondPas(val / 3, 0.5) * 3 : plafondPas(val, 0.5);
    return Math.ceil(val - 1e-9);
  }
  // Arrondi pour l'affichage d'une recette mise à l'échelle.
  function arrondiRecette(dim, val) {
    if (!(val > 0)) return 0;
    if (dim === 'm' || dim === 'v') return val < 20 ? Math.max(1, Math.round(val)) : val < 1000 ? Math.round(val / 5) * 5 : Math.round(val / 10) * 10;
    if (dim === 'cuil') return val >= 3 ? Math.max(0.5, Math.round(val / 1.5) / 2) * 3 : Math.max(0.5, Math.round(val * 2) / 2);
    return Math.max(0.5, Math.round(val * 2) / 2);
  }
  // Texte d'une quantité de base : « 350 g », « 1,25 kg », « 750 ml », « 1,5 l », « 3 », « 2 gousses », « 1,5 c. à s. ».
  function texteQuantite(dim, val) {
    if (dim === 'sans' || !(val > 0)) return '';
    if (dim === 'm') return val >= 1000 ? `${nombre(val / 1000)} kg` : `${nombre(val)} g`;
    if (dim === 'v') return val >= 1000 ? `${nombre(val / 1000)} l` : `${nombre(val)} ml`;
    if (dim === 'cuil') return val >= 3 ? `${nombre(val / 3)} c. à s.` : `${nombre(val)} c. à c.`;
    if (dim === 'pièce') return nombre(val);
    return `${nombre(val)} ${val > 1 ? (PLURIELS[dim] || dim) : dim}`;
  }
  const texteQuantites = (qs, mode = 'courses') => qs.filter((q) => q.dim !== 'sans' && q.val > 0)
    .map((q) => texteQuantite(q.dim, mode === 'courses' ? arrondiCourses(q.dim, q.val) : mode === 'recette' ? arrondiRecette(q.dim, q.val) : q.val)).join(' + ');

  // ---------- Lignes d'ingrédients ----------
  // « 400 g de spaghetti », « 2 gousses d'ail », « 1/2 botte persil », « 3 œufs », « sel » → {nom, qte, unite}.
  function lireLigneIngredient(ligne) {
    let s = String(ligne ?? '').trim().replace(/^[-•*▪]\s*/, '');
    if (!s) return null;
    let qte = null;
    const m = s.match(/^(\d+\s*[½¼¾⅓⅔]|\d+(?:[.,]\d+)?(?:\/\d+)?|[½¼¾⅓⅔])\s*/);
    if (m) { qte = lireNombre(m[1].replace(/\s+/g, '')); s = s.slice(m[0].length); }
    let unite = 'pièce';
    const bas = s.toLowerCase();
    for (const a of ALIAS_TRIES) {
      if (bas.startsWith(a) && (bas.length === a.length || /[\s.']/.test(bas[a.length]) || a.endsWith('.'))) {
        if (qte === null && a.length <= 2) break; // « l » ou « g » sans quantité : c'est le début du nom
        unite = ALIAS[a]; s = s.slice(a.length).trim();
        break;
      }
    }
    s = s.replace(/^(de |d'|d’|des |du )/i, '').trim();
    if (!s) return null;
    return { nom: s, qte: qte !== null && qte > 0 ? qte : null, unite };
  }
  function ecrireLigneIngredient(i) {
    if (!i.qte) return i.nom;
    const q = nombre(i.qte, 3);
    if (i.unite === 'pièce') return `${q} ${i.nom}`;
    return `${q} ${i.unite} ${i.nom}`;
  }

  // ---------- Recettes ----------
  const nouvelId = (p = 'r') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const entierBorne = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  function normaliserIngredient(i) {
    if (!i || typeof i !== 'object') return null;
    const nom = String(i.nom ?? '').trim().slice(0, 80);
    if (!nom) return null;
    const q = Number(i.qte);
    return { nom, qte: q > 0 && q < 100000 ? q : null, unite: uniteValide(i.unite), ...(i.rayon ? { rayon: String(i.rayon) } : {}) };
  }
  function normaliserRecette(r) {
    const s = r && typeof r === 'object' ? r : {};
    const saisons = Array.isArray(s.saisons) ? s.saisons.filter((x) => 'peah'.includes(x) && x.length === 1) : [];
    return {
      id: String(s.id || nouvelId()),
      nom: String(s.nom ?? '').trim().slice(0, 100) || 'Recette sans nom',
      categorie: String(s.categorie || 'perso'),
      personnes: entierBorne(s.personnes, 1, 40, 4),
      preparation: entierBorne(s.preparation, 0, 1440, 0),
      cuisson: entierBorne(s.cuisson, 0, 1440, 0),
      saisons: saisons.length ? [...new Set(saisons)] : ['p', 'e', 'a', 'h'],
      etiquettes: Array.isArray(s.etiquettes) ? [...new Set(s.etiquettes.map(String))].filter((e) => !['vegetarien', 'poisson', 'rapide'].includes(e)) : [],
      ingredients: (Array.isArray(s.ingredients) ? s.ingredients : []).map(normaliserIngredient).filter(Boolean).slice(0, 60),
      etapes: (Array.isArray(s.etapes) ? s.etapes : String(s.etapes || '').split('\n')).map((x) => String(x).trim()).filter(Boolean).slice(0, 30),
      note: String(s.note ?? '').slice(0, 300),
    };
  }
  // Recettes disponibles : base (moins les masquées, remplacées par la version modifiée) puis les recettes perso.
  function recettesDe(etat, base) {
    const perso = new Map((etat.recettes || []).map((r) => [r.id, r]));
    const masquees = new Set(etat.masquees || []);
    const liste = [];
    for (const r of base.recettes) {
      if (masquees.has(r.id)) continue;
      const m = perso.get(r.id);
      liste.push(m ? { ...m, base: true, modifiee: true } : { ...r, base: true, modifiee: false });
      perso.delete(r.id);
    }
    for (const r of perso.values()) liste.push({ ...r, base: false, modifiee: false });
    return liste;
  }
  // Rayon d'un ingrédient : choix de l'utilisateur, puis celui de la ligne, puis la base, sinon « Autres ».
  function indexBase(base) {
    if (!base._index) Object.defineProperty(base, '_index', { value: new Map(Object.entries(base.ingredients).map(([n, v]) => [cleNom(n), v])), enumerable: false });
    return base._index;
  }
  function rayonDe(nom, base, etat = {}, rayonLigne = '') {
    const c = cleNom(nom);
    return etat.rayonsPerso?.[c] || rayonLigne || indexBase(base).get(c)?.[0] || 'au';
  }
  const tempsTotal = (r) => (r.preparation || 0) + (r.cuisson || 0);
  // Ce qui se déduit d'une recette : végétarien (aucune viande ni poisson), poisson, rapide, allergènes indicatifs.
  function infos(r, base) {
    const idx = indexBase(base);
    const nat = r.ingredients.map((i) => idx.get(cleNom(i.nom))?.[2] || '');
    const allergenes = [...new Set(r.ingredients.flatMap((i) => (idx.get(cleNom(i.nom))?.[1] || '').split(' ').filter(Boolean)))].sort();
    const connus = r.ingredients.filter((i) => idx.has(cleNom(i.nom))).length;
    const vegetarien = !nat.includes('v') && !nat.includes('p') && connus === r.ingredients.length && r.ingredients.length > 0;
    const poisson = nat.includes('p');
    const rapide = tempsTotal(r) > 0 && tempsTotal(r) <= (base.tempsRapide || 30);
    const etiquettes = [...(vegetarien ? ['vegetarien'] : []), ...(poisson ? ['poisson'] : []), ...(rapide ? ['rapide'] : []), ...r.etiquettes.filter((e) => !['vegetarien', 'poisson', 'rapide'].includes(e))];
    return { vegetarien, poisson, rapide, temps: tempsTotal(r), allergenes, inconnus: r.ingredients.length - connus, etiquettes };
  }
  // Ingrédients d'une recette pour un nombre de portions.
  const echelle = (r, portions) => r.ingredients.map((i) => ({ ...i, qte: i.qte ? i.qte * portions / (r.personnes || 1) : null }));

  // ---------- Semaine ----------
  function normaliserCase(c) {
    if (!c || typeof c !== 'object' || !TYPES_CASE.includes(c.type)) return null;
    const n = { type: c.type };
    if (c.type === 'recette') { if (!c.recette) return null; n.recette = String(c.recette); n.personnes = entierBorne(c.personnes, 1, 40, 4); }
    if (c.type === 'restes') { n.source = String(c.source || ''); n.personnes = entierBorne(c.personnes, 1, 40, 4); }
    if (c.type === 'note' || c.type === 'dehors') n.texte = String(c.texte ?? '').slice(0, 80);
    return n;
  }
  const casesValides = (cases) => Object.fromEntries(Object.entries(cases && typeof cases === 'object' ? cases : {})
    .filter(([k]) => /^[0-6]-(midi|soir)$/.test(k)).map(([k, v]) => [k, normaliserCase(v)]).filter(([, v]) => v));
  function normaliserSemaine(s) {
    const x = s && typeof s === 'object' ? s : {};
    const stock = {};
    for (const [k, v] of Object.entries(x.stock && typeof x.stock === 'object' ? x.stock : {})) {
      if (v === 'tout' || v === 'manque') stock[k] = v;
      else if (v && typeof v === 'object' && v.val > 0 && typeof v.dim === 'string') stock[k] = { dim: v.dim, val: Number(v.val) };
    }
    return {
      cases: casesValides(x.cases),
      stock,
      coches: Object.fromEntries(Object.entries(x.coches && typeof x.coches === 'object' ? x.coches : {}).filter(([, v]) => v === true)),
      libres: (Array.isArray(x.libres) ? x.libres : []).map((l) => { const i = normaliserIngredient(l); return i ? { id: String(l.id || nouvelId('l')), ...i } : null; }).filter(Boolean),
    };
  }
  const semaineVide = () => ({ cases: {}, stock: {}, coches: {}, libres: [] });
  // Portions à cuisiner pour chaque case « recette » : les convives du repas plus ceux des repas
  // « restes de… » qui la désignent (dans la même semaine).
  function portions(semaine) {
    const p = {};
    for (const [k, c] of Object.entries(semaine.cases)) if (c.type === 'recette') p[k] = c.personnes;
    for (const c of Object.values(semaine.cases)) if (c.type === 'restes' && p[c.source] !== undefined) p[c.source] += c.personnes;
    return p;
  }
  // Ingrédients de la semaine (avant fusion), chacun avec sa source.
  function besoinsSemaine(semaine, recettes, base, etat = {}, habituels = []) {
    const parId = new Map(recettes.map((r) => [r.id, r]));
    const p = portions(semaine);
    const besoins = [];
    for (const k of Object.keys(p).sort(ordreCase)) {
      const r = parId.get(semaine.cases[k].recette);
      if (!r) continue;
      for (const i of echelle(r, p[k])) besoins.push({ nom: i.nom, qte: i.qte, unite: i.unite, rayon: rayonDe(i.nom, base, etat, i.rayon), source: { type: 'recette', cle: k, recette: r.id, nom: r.nom } });
    }
    for (const l of [...habituels.map((h) => ({ ...h, habituel: true })), ...semaine.libres]) {
      besoins.push({ nom: l.nom, qte: l.qte, unite: l.unite, rayon: rayonDe(l.nom, base, etat, l.rayon), source: { type: l.habituel ? 'habituel' : 'libre', id: l.id } });
    }
    return besoins;
  }

  // ---------- Moteur de liste de courses ----------
  // Fusionne les besoins par ingrédient (nom sans accents ni casse) et additionne les quantités de même
  // dimension (g et kg, ml, cl et l, c. à s. et c. à c.) ; les dimensions différentes restent côte à côte.
  function fusionner(besoins) {
    const lignes = new Map();
    for (const b of besoins) {
      const cle = cleNom(b.nom);
      if (!cle) continue;
      let l = lignes.get(cle);
      if (!l) { l = { cle, nom: majuscule(String(b.nom).trim()), rayon: b.rayon || 'au', quantites: [], sources: [] }; lignes.set(cle, l); }
      const q = versBase(b.qte, b.unite);
      const ex = l.quantites.find((x) => x.dim === q.dim);
      if (ex) ex.val += q.val; else l.quantites.push({ ...q });
      if (b.source) l.sources.push(b.source);
    }
    for (const l of lignes.values()) {
      l.quantites = l.quantites.filter((q) => q.dim === 'sans' ? l.quantites.length === 1 : q.val > 0);
      const rang = (d) => { const i = ['m', 'v', 'pièce', 'cuil'].indexOf(d); return i < 0 ? 9 : i; };
      l.quantites.sort((a, b) => rang(a.dim) - rang(b.dim));
    }
    return [...lignes.values()];
  }
  // Retire ce qui est déjà là : « tout » (en stock), une quantité (déduite), ou un article du placard
  // (supposé en stock sauf s'il est marqué « à racheter » cette semaine).
  function appliquerStock(lignes, stock = {}, placard = []) {
    const auPlacard = new Set(placard.map(cleNom));
    return lignes.map((l) => {
      const s = stock[l.cle];
      let reste = l.quantites.map((q) => ({ ...q }));
      let raison = '';
      if (s === 'tout') { reste = []; raison = 'stock'; }
      else if (s && typeof s === 'object') {
        reste = reste.map((q) => (q.dim === s.dim ? { ...q, val: Math.max(0, q.val - s.val) } : q)).filter((q) => q.val > 0 || q.dim === 'sans');
        raison = reste.length ? 'partiel' : 'stock';
      } else if (auPlacard.has(l.cle) && s !== 'manque') { reste = []; raison = 'placard'; }
      return { ...l, reste, raison, enStock: raison === 'stock' || raison === 'placard', aRacheter: s === 'manque' };
    });
  }
  // Groupes de rayons dans l'ordre du magasin, articles triés par nom.
  function regrouper(lignes, rayons, ordre = null) {
    const ids = rayons.map(([id]) => id);
    const rang = (ordre && ordre.length ? [...ordre.filter((x) => ids.includes(x)), ...ids.filter((x) => !ordre.includes(x))] : ids);
    const nomRayon = Object.fromEntries(rayons);
    const groupes = rang.map((id) => ({ id, nom: nomRayon[id], lignes: lignes.filter((l) => (ids.includes(l.rayon) ? l.rayon : 'au') === id).sort((a, b) => a.cle.localeCompare(b.cle)) }));
    return groupes.filter((g) => g.lignes.length);
  }
  // Liste complète d'une semaine.
  function listeCourses(etat, base, lundi) {
    const semaine = etat.semaines[lundi] || semaineVide();
    const recettes = recettesDe(etat, base);
    const lignes = appliquerStock(fusionner(besoinsSemaine(semaine, recettes, base, etat, etat.habituels || [])), semaine.stock, etat.placard || []);
    const aAcheter = lignes.filter((l) => !l.enStock).map((l) => ({ ...l, coche: !!semaine.coches[l.cle] }));
    const enStock = lignes.filter((l) => l.enStock).sort((a, b) => a.cle.localeCompare(b.cle));
    return { lignes, aAcheter, enStock, rayons: regrouper(aAcheter, base.rayons, etat.reglages?.ordreRayons), nbCoches: aAcheter.filter((l) => l.coche).length };
  }
  // Texte à copier : rayon par rayon, articles restant à acheter (les cochés en magasin sont exclus si demandé).
  function texteListe(liste, { titre = 'Liste de courses', sansCoches = false } = {}) {
    const blocs = liste.rayons.map((g) => {
      const ls = g.lignes.filter((l) => !(sansCoches && l.coche));
      if (!ls.length) return '';
      return `${g.nom.toUpperCase()}\n${ls.map((l) => { const q = texteQuantites(l.reste); return `- ${l.nom}${q ? ` : ${q}` : ''}`; }).join('\n')}`;
    }).filter(Boolean);
    return [titre, '', ...blocs.flatMap((b) => [b, ''])].join('\n').trim() + '\n';
  }
  // Export CSV (point-virgule, BOM UTF-8).
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function versCsv(liste, base) {
    const nomRayon = Object.fromEntries(base.rayons);
    const tete = ['Rayon', 'Article', 'Quantité', 'Déjà là', 'Coché'];
    const lignes = [...liste.rayons.flatMap((g) => g.lignes.map((l) => [g.nom, l.nom, texteQuantites(l.reste), l.raison === 'partiel' ? 'en partie' : '', l.coche ? 'oui' : ''])),
      ...liste.enStock.map((l) => [nomRayon[l.rayon] || 'Autres', l.nom, texteQuantites(l.quantites), l.raison === 'placard' ? 'placard' : 'oui', ''])];
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  // ---------- Budget (seulement avec les prix saisis par l'utilisateur) ----------
  // Prix : {prix, qte, unite} = « prix pour qte unite » (ex. 2,40 € pour 1 kg). Coût de la ligne à acheter,
  // ou null si aucune quantité n'est dans la dimension du prix.
  function coutLigne(quantites, p) {
    if (!p || !(p.prix >= 0) || !(p.qte > 0)) return null;
    const ref = versBase(p.qte, p.unite);
    const q = quantites.find((x) => x.dim === ref.dim && x.dim !== 'sans');
    if (!q) return null;
    return arrondiCourses(q.dim, q.val) / ref.val * p.prix;
  }
  function budget(lignes, prix = {}) {
    let total = 0, avec = 0, sans = 0;
    for (const l of lignes) {
      const c = coutLigne(l.reste || l.quantites, prix[l.cle]);
      if (c === null) sans += 1; else { total += c; avec += 1; }
    }
    return { total: Math.round(total * 100) / 100, avecPrix: avec, sansPrix: sans };
  }

  // ---------- Historique ----------
  // Dates où chaque recette a été au menu (cases « recette », toutes semaines).
  function historique(etat) {
    const h = new Map();
    for (const [lundi, s] of Object.entries(etat.semaines || {})) {
      for (const [k, c] of Object.entries(s.cases)) {
        if (c.type !== 'recette') continue;
        if (!h.has(c.recette)) h.set(c.recette, []);
        h.get(c.recette).push(dateCase(lundi, k));
      }
    }
    for (const v of h.values()) v.sort();
    return h;
  }
  // Dernière date strictement avant « avant » (ou null).
  function derniereFois(hist, id, avant) {
    const d = (hist.get(id) || []).filter((x) => !avant || x < avant);
    return d.length ? d.at(-1) : null;
  }
  // Recettes les plus servies depuis une date.
  function frequences(etat, depuis, jusqua) {
    const h = historique(etat);
    return [...h.entries()].map(([id, dates]) => { const d = dates.filter((x) => (!depuis || x >= depuis) && (!jusqua || x <= jusqua)); return { id, n: d.length, derniere: d.at(-1) || null }; })
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n || String(b.derniere).localeCompare(String(a.derniere)));
  }

  // ---------- Suggestions et tirage ----------
  // Générateur pseudo-aléatoire reproductible (mulberry32).
  function aleatoire(graine = Date.now()) {
    let a = (Number(graine) >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // Candidates pour un repas daté. Contraintes : saison du jour, végétarien ou poisson imposé, temps
  // maximum, étiquettes requises, allergènes exclus (indicatif), recettes exclues, et pas de recette
  // servie il y a moins de « eviterJours ». Score : ancienneté (plafonnée à 120 jours, jamais servie = 150)
  // plus une part de hasard ; les mieux notées d'abord.
  function proposer(recettes, base, opts = {}, alea = Math.random, n = 3) {
    const { date, hist = new Map(), eviterJours = 21, exclure = new Set(), vegetarien = false, poisson = false, tempsMax = null, etiquettes = [], sansAllergenes = [], saison = true } = opts;
    const sai = date ? saisonDe(date) : null;
    const ok = recettes.filter((r) => {
      if (exclure.has(r.id) || !r.ingredients.length) return false;
      const inf = infos(r, base);
      if (vegetarien && !inf.vegetarien) return false;
      if (poisson && !inf.poisson) return false;
      if (tempsMax && (!inf.temps || inf.temps > tempsMax)) return false;
      if (etiquettes.some((e) => !inf.etiquettes.includes(e))) return false;
      if (sansAllergenes.some((a) => inf.allergenes.includes(a))) return false;
      if (saison && sai && !r.saisons.includes(sai)) return false;
      const der = derniereFois(hist, r.id, date);
      if (der && date && ecart(der, date) < eviterJours) return false;
      return true;
    });
    return ok.map((r) => { const der = derniereFois(hist, r.id, date); return { recette: r, derniere: der, score: (der && date ? Math.min(120, ecart(der, date)) : 150) + alea() * 80 }; })
      .sort((a, b) => b.score - a.score).slice(0, n);
  }
  // Remplit les cases vides demandées. Options : nbVegetariens, nbPoisson (au moins, si possible),
  // soirsRapides (soirs du lundi au vendredi en moins de tempsRapide minutes), personnes, contraintes de proposer().
  // Si une contrainte ne laisse aucune recette, elle est relâchée dans l'ordre : temps, saison, répétitions.
  function remplirSemaine(semaine, lundi, recettes, base, opts = {}, alea = Math.random) {
    const s = copie(semaine);
    const vides = (opts.cases || []).filter((k) => !s.cases[k]).sort(ordreCase);
    const melange = [...vides];
    for (let i = melange.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [melange[i], melange[j]] = [melange[j], melange[i]]; }
    const imposes = {};
    const nbV = Math.max(0, opts.nbVegetariens || 0), nbP = Math.max(0, opts.nbPoisson || 0);
    melange.slice(0, nbV).forEach((k) => { imposes[k] = 'vegetarien'; });
    melange.slice(nbV, nbV + nbP).forEach((k) => { imposes[k] = 'poisson'; });
    const exclure = new Set([...(opts.exclure || []), ...Object.values(s.cases).filter((c) => c.type === 'recette').map((c) => c.recette)]);
    const ajoutees = [];
    for (const k of vides) {
      const date = dateCase(lundi, k);
      const rapide = opts.soirsRapides && jourCase(k) < 5 && repasCase(k) === 'soir' ? (base.tempsRapide || 30) : null;
      const base0 = { ...opts, date, exclure, vegetarien: imposes[k] === 'vegetarien', poisson: imposes[k] === 'poisson', tempsMax: rapide };
      const essais = [base0, { ...base0, tempsMax: null }, { ...base0, tempsMax: null, saison: false }, { ...base0, tempsMax: null, saison: false, eviterJours: 0 }, { ...base0, tempsMax: null, saison: false, eviterJours: 0, vegetarien: false, poisson: false }];
      let choix = null;
      for (const e of essais) { choix = proposer(recettes, base, e, alea, 1)[0]; if (choix) break; }
      if (!choix) continue;
      s.cases[k] = { type: 'recette', recette: choix.recette.id, personnes: opts.personnes || 4 };
      exclure.add(choix.recette.id);
      ajoutees.push(k);
    }
    return { semaine: s, ajoutees };
  }

  // ---------- Semaines types ----------
  // Une semaine type garde les cases (recettes, restes, dehors, notes) sans le stock ni les courses.
  const semaineTypeDepuis = (semaine) => copie(casesValides(semaine.cases));
  function appliquerType(semaine, cases, remplacer = false) {
    const s = copie(semaine);
    if (remplacer) s.cases = {};
    for (const [k, c] of Object.entries(casesValides(cases))) if (remplacer || !s.cases[k]) s.cases[k] = copie(c);
    // Une case « restes » dont la source n'est plus une recette devient une note.
    for (const [k, c] of Object.entries(s.cases)) if (c.type === 'restes' && s.cases[c.source]?.type !== 'recette') s.cases[k] = { type: 'note', texte: 'Restes' };
    return s;
  }
  // Supprime une case ; les repas « restes » qui en dépendaient deviennent des notes.
  function viderCase(semaine, cle) {
    const s = copie(semaine);
    delete s.cases[cle];
    for (const [k, c] of Object.entries(s.cases)) if (c.type === 'restes' && c.source === cle) s.cases[k] = { type: 'note', texte: 'Restes' };
    return s;
  }

  // ---------- État ----------
  function normaliserReglages(r, defaut) {
    const x = r && typeof r === 'object' ? r : {};
    const repas = Array.isArray(x.repas) ? REPAS.map(([k]) => k).filter((k) => x.repas.includes(k)) : defaut.repas;
    return {
      personnes: entierBorne(x.personnes, 1, 20, defaut.personnes),
      repas: repas.length ? repas : ['soir'],
      eviterJours: entierBorne(x.eviterJours, 0, 120, defaut.eviterJours),
      ordreRayons: Array.isArray(x.ordreRayons) ? x.ordreRayons.map(String) : null,
      monnaie: String(x.monnaie || defaut.monnaie || '€').slice(0, 4),
    };
  }
  function etatVide(base) {
    return { version: 1, foyer: '', reglages: normaliserReglages({}, base.reglages), recettes: [], masquees: [], semaines: {}, semainesTypes: [], placard: [...base.placard], habituels: [], prix: {}, rayonsPerso: {} };
  }
  const MAX_SEMAINES = 60;
  function normaliser(d, base) {
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.foyer = String(d.foyer ?? '').slice(0, 80);
    e.reglages = normaliserReglages(d.reglages, base.reglages);
    const vus = new Set();
    e.recettes = (Array.isArray(d.recettes) ? d.recettes : []).map(normaliserRecette).filter((r) => !vus.has(r.id) && vus.add(r.id));
    e.masquees = Array.isArray(d.masquees) ? [...new Set(d.masquees.map(String))] : [];
    const lundis = Object.keys(d.semaines && typeof d.semaines === 'object' ? d.semaines : {}).filter((k) => estDate(k) && lundiDe(k) === k).sort().slice(-MAX_SEMAINES);
    e.semaines = Object.fromEntries(lundis.map((k) => [k, normaliserSemaine(d.semaines[k])]));
    e.semainesTypes = (Array.isArray(d.semainesTypes) ? d.semainesTypes : []).filter((t) => t && typeof t === 'object').map((t) => ({ id: String(t.id || nouvelId('t')), nom: String(t.nom ?? '').trim().slice(0, 60) || 'Semaine type', cases: casesValides(t.cases) })).slice(0, 20);
    if (Array.isArray(d.placard)) e.placard = [...new Map(d.placard.map((x) => String(x).trim()).filter(Boolean).map((x) => [cleNom(x), x])).values()];
    e.habituels = (Array.isArray(d.habituels) ? d.habituels : []).map((l) => { const i = normaliserIngredient(l); return i ? { id: String(l.id || nouvelId('h')), ...i } : null; }).filter(Boolean);
    e.prix = {};
    for (const [k, p] of Object.entries(d.prix && typeof d.prix === 'object' ? d.prix : {})) if (p && Number(p.prix) >= 0 && Number(p.qte) > 0) e.prix[cleNom(k)] = { prix: Number(p.prix), qte: Number(p.qte), unite: uniteValide(p.unite) };
    e.rayonsPerso = {};
    const ids = base.rayons.map(([id]) => id);
    for (const [k, v] of Object.entries(d.rayonsPerso && typeof d.rayonsPerso === 'object' ? d.rayonsPerso : {})) if (ids.includes(v)) e.rayonsPerso[cleNom(k)] = v;
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }

  racine.RPS = {
    JOURS, REPAS, TYPES_CASE, UNITES, LISTE_UNITES,
    iso, versDate, ajout, ecart, estDate, lundiDe, saisonDe, cleCase, jourCase, repasCase, dateCase, ordreCase,
    arrondi, nombre, lireNombre, cleNom, majuscule,
    versBase, arrondiCourses, arrondiRecette, texteQuantite, texteQuantites, lireLigneIngredient, ecrireLigneIngredient,
    nouvelId, normaliserIngredient, normaliserRecette, recettesDe, rayonDe, tempsTotal, infos, echelle,
    normaliserCase, normaliserSemaine, semaineVide, portions, besoinsSemaine,
    fusionner, appliquerStock, regrouper, listeCourses, texteListe, versCsv, coutLigne, budget,
    historique, derniereFois, frequences, aleatoire, proposer, remplirSemaine, semaineTypeDepuis, appliquerType, viderCase,
    normaliserReglages, etatVide, normaliser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
