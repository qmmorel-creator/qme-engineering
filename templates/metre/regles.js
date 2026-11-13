// MétréPro · règles métier pures (aucun accès au DOM ni au stockage). window.MTR, testé par
// outils/templates/metre.test.mjs. Dimensions en mètres (épaisseur en cm), quantités en nombres décimaux
// arrondis au millième pour le stockage et l'affichage ; aucune perte dans la quantité théorique.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const LIMITE_DIM = 10000; // m (ou cm pour l'épaisseur) : au-delà, saisie suspecte refusée
  const LIMITE_NOMBRE = 100000;
  const UNITES = ['m', 'm2', 'm3', 'kg', 't', 'u', 'l'];

  const f = (n) => O.fmtNombre(O.arrondi(n, 3), { dec: 3 });
  const nomUnite = (u) => (B().unites[u] || u || '');

  // ---------- Formes ----------
  // Chaque forme renvoie la valeur unitaire et son expression lisible (avant multiplication par le nombre).
  const FORMULES = {
    rect: ({ L, l }) => ({ v: L * l, x: `${f(L)} × ${f(l)}` }),
    mur: ({ L, H }) => ({ v: L * H, x: `${f(L)} × ${f(H)}` }),
    triangle: ({ b, h }) => ({ v: (b * h) / 2, x: `${f(b)} × ${f(h)} ÷ 2` }),
    disque: ({ d }) => ({ v: (Math.PI * d * d) / 4, x: `π × ${f(d)}² ÷ 4` }),
    volume: ({ L, l, e }) => ({ v: L * l * (e / 100), x: `${f(L)} × ${f(l)} × ${f(e / 100)}` }),
    cylindre: ({ d, H }) => ({ v: ((Math.PI * d * d) / 4) * H, x: `π × ${f(d)}² ÷ 4 × ${f(H)}` }),
    lineaire: ({ L }) => ({ v: L, x: `${f(L)}` }),
    perimetre: ({ L, l }) => ({ v: 2 * (L + l), x: `2 × (${f(L)} + ${f(l)})` }),
    unite: () => ({ v: 1, x: '1' }),
    direct: ({ q }) => ({ v: q, x: `${f(q)}` }),
  };
  const forme = (id) => B().formes.find((x) => x.id === id) || null;

  // Déduction : { nombre, a, b } ; surface = nombre × a × b, longueur = nombre × a.
  function valeurDeduction(type, d) {
    const n = d.nombre ?? 1;
    return type === 'surface' ? n * d.a * d.b : n * d.a;
  }
  const texteDeduction = (type, d) => {
    const n = d.nombre ?? 1;
    const coeur = type === 'surface' ? `${f(d.a)} × ${f(d.b)}` : f(d.a);
    return n === 1 ? (type === 'surface' ? `(${coeur})` : coeur) : `${f(n)} × ${type === 'surface' ? `(${coeur})` : coeur}`;
  };

  // ---------- Calcul d'une ligne ----------
  // Renvoie { ok, erreur?, brut, deduction, theorique, perte, avecPertes, retenue, ecart, ecartPct, unite, formule }.
  function calculerLigne(ligne, ouvrage) {
    const fo = forme(ligne.forme);
    const vide = (erreur) => ({ ok: false, erreur, brut: 0, deduction: 0, theorique: 0, perte: 0, avecPertes: 0, retenue: 0, ecart: 0, ecartPct: null, unite: ouvrage?.unite || fo?.unite || 'u', formule: '' });
    if (!fo) return vide('Forme de calcul inconnue.');
    const unite = ouvrage ? ouvrage.unite : (fo.unite || 'u');
    if (fo.unite && fo.unite !== unite) return vide(`La forme « ${fo.nom} » donne des ${nomUnite(fo.unite)}, mais l'ouvrage se compte en ${nomUnite(unite)}. Choisis une forme adaptée.`);
    const dims = {};
    for (const c of fo.champs) {
      const v = ligne.dims?.[c];
      const nomC = B().champs[c].nom.toLowerCase();
      if (v === null || v === undefined || v === '' || Number.isNaN(v)) return vide(`Dimension manquante : ${nomC}.`);
      if (typeof v !== 'number' || !Number.isFinite(v)) return vide(`Dimension illisible : ${nomC}.`);
      if (v < 0) return vide(`Dimension négative refusée : ${nomC}.`);
      if (v === 0 && c !== 'q') return vide(`Dimension nulle : ${nomC}. Une ligne sans quantité n'a pas d'intérêt ; supprime-la ou corrige-la.`);
      if (v > LIMITE_DIM) return vide(`Dimension trop grande (${nomC} > ${O.fmtNombre(LIMITE_DIM)}) : vérifie l'unité (mètres, épaisseur en centimètres).`);
      dims[c] = v;
    }
    const nombre = ligne.nombre ?? 1;
    if (!(typeof nombre === 'number' && nombre > 0 && nombre <= LIMITE_NOMBRE)) return vide('Le nombre doit être strictement positif (1 si l\'élément est unique).');
    const { v, x } = FORMULES[fo.id](dims);
    const brut = v * nombre;
    let expr = fo.id === 'unite' ? `${f(nombre)}` : nombre === 1 ? x : `${f(nombre)} × (${x})`;
    let deduction = 0;
    const deds = fo.deduction ? (ligne.deductions || []) : [];
    for (const d of deds) {
      const nd = d.nombre ?? 1;
      if (!(nd > 0) || !(d.a > 0) || (fo.deduction === 'surface' && !(d.b > 0))) return vide(`Déduction « ${d.libelle || 'sans nom'} » incomplète : dimensions et nombre strictement positifs.`);
      deduction += valeurDeduction(fo.deduction, d);
      expr += ` − ${texteDeduction(fo.deduction, d)}`;
    }
    const net = brut - deduction;
    if (net < -1e-9) return vide(`Les déductions (${f(deduction)} ${nomUnite(unite)}) dépassent la quantité brute (${f(brut)} ${nomUnite(unite)}).`);
    const theorique = O.arrondi(Math.max(0, net), 3);
    const perte = ligne.perte ?? ouvrage?.perte ?? 0;
    const avecPertes = O.arrondi(theorique * (1 + perte / 100), 3);
    const retenue = ligne.retenue ?? avecPertes;
    const ecart = O.arrondi(retenue - theorique, 3);
    return {
      ok: true, brut: O.arrondi(brut, 3), deduction: O.arrondi(deduction, 3), theorique, perte, avecPertes, retenue, ecart,
      ecartPct: theorique > 0 ? O.arrondi((ecart / theorique) * 100, 1) : null,
      unite, formule: `${expr} = ${f(theorique)} ${nomUnite(unite)}`,
    };
  }

  // ---------- Projet ----------
  const ouvrageDe = (biblio, id) => biblio.find((o) => o.id === id) || null;
  const dansVariante = (ligne, varianteId) => !ligne.variantes.length || ligne.variantes.includes(varianteId);
  const ordreFamille = (id) => { const i = B().familles.findIndex((x) => x.id === id); return i < 0 ? 999 : i; };

  // Synthèse d'un projet pour une variante : lignes calculées, totaux par famille et par ouvrage,
  // composants à commander (arrondis au conditionnement supérieur).
  function synthese(projet, biblio, varianteId) {
    const v = varianteId || projet.varianteActive || projet.variantes[0]?.id;
    const lignes = projet.lignes.filter((l) => dansVariante(l, v)).map((l) => {
      const ouvrage = ouvrageDe(biblio, l.ouvrageId);
      return { ligne: l, ouvrage, calc: calculerLigne(l, ouvrage), zone: projet.zones.find((z) => z.id === l.zoneId) || null };
    });
    const erreurs = lignes.filter((x) => !x.calc.ok);
    const parOuvrage = new Map();
    for (const x of lignes) {
      if (!x.calc.ok) continue;
      const cle = `${x.ligne.ouvrageId}|${x.calc.unite}`;
      const o = parOuvrage.get(cle) || { ouvrageId: x.ligne.ouvrageId, nom: x.ouvrage?.nom || 'Ouvrage supprimé de la bibliothèque', famille: x.ouvrage?.famille || 'divers', unite: x.calc.unite, theorique: 0, avecPertes: 0, retenue: 0, nbLignes: 0, zones: new Map() };
      o.theorique += x.calc.theorique; o.avecPertes += x.calc.avecPertes; o.retenue += x.calc.retenue; o.nbLignes++;
      const nz = x.zone?.nom || 'Sans zone';
      o.zones.set(nz, (o.zones.get(nz) || 0) + x.calc.retenue);
      parOuvrage.set(cle, o);
    }
    const ouvrages = [...parOuvrage.values()].map((o) => ({ ...o, theorique: O.arrondi(o.theorique, 3), avecPertes: O.arrondi(o.avecPertes, 3), retenue: O.arrondi(o.retenue, 3), ecart: O.arrondi(o.retenue - o.theorique, 3), zones: [...o.zones].map(([zone, q]) => ({ zone, q: O.arrondi(q, 3) })) }))
      .sort((a, b) => ordreFamille(a.famille) - ordreFamille(b.famille) || a.nom.localeCompare(b.nom, 'fr'));
    const familles = [];
    for (const o of ouvrages) {
      let g = familles.find((x) => x.famille === o.famille);
      if (!g) { g = { famille: o.famille, ouvrages: [] }; familles.push(g); }
      g.ouvrages.push(o);
    }
    // Composants
    const comp = new Map();
    for (const x of lignes) {
      if (!x.calc.ok || !x.ouvrage) continue;
      for (const c of x.ouvrage.composants) {
        const cle = `${c.nom}|${c.unite}|${c.cond ?? ''}`;
        const k = comp.get(cle) || { nom: c.nom, unite: c.unite, cond: c.cond, uc: c.uc, besoin: 0, famille: x.ouvrage.famille, sources: new Set() };
        k.besoin += x.calc.retenue * c.ratio;
        k.sources.add(x.ouvrage.nom);
        comp.set(cle, k);
      }
    }
    const composants = [...comp.values()].map((k) => commande(k)).sort((a, b) => ordreFamille(a.famille) - ordreFamille(b.famille) || a.nom.localeCompare(b.nom, 'fr'));
    return { varianteId: v, lignes, erreurs, ouvrages, familles, composants };
  }

  // Quantité à commander d'un composant : arrondi au conditionnement supérieur (tolérance d'arrondi 1e-9).
  function commande(k) {
    const besoin = O.arrondi(k.besoin, 3);
    const nbCond = k.cond ? Math.max(besoin > 0 ? 1 : 0, Math.ceil(besoin / k.cond - 1e-9)) : null;
    const qte = k.cond ? O.arrondi(nbCond * k.cond, 3) : O.arrondi(besoin, 2);
    return { ...k, sources: [...(k.sources || [])], besoin, nbCond, commande: qte, surplus: O.arrondi(qte - besoin, 3) };
  }

  // Comparaison des variantes : quantité retenue de chaque ouvrage et commande de chaque composant par variante.
  function comparaison(projet, biblio) {
    const syn = projet.variantes.map((v) => synthese(projet, biblio, v.id));
    const cles = new Map();
    syn.forEach((s, i) => s.ouvrages.forEach((o) => {
      const cle = `${o.ouvrageId}|${o.unite}`;
      const r = cles.get(cle) || { nom: o.nom, famille: o.famille, unite: o.unite, q: projet.variantes.map(() => 0) };
      r.q[i] = o.retenue;
      cles.set(cle, r);
    }));
    const ouvrages = [...cles.values()].map((r) => ({ ...r, differe: r.q.some((q) => Math.abs(q - r.q[0]) > 1e-9) }))
      .sort((a, b) => ordreFamille(a.famille) - ordreFamille(b.famille) || a.nom.localeCompare(b.nom, 'fr'));
    return { variantes: projet.variantes, ouvrages, erreurs: syn.map((s) => s.erreurs.length) };
  }

  // Bordereau quantitatif : postes numérotés par famille (1.1, 1.2…), quantité retenue, détail par zone.
  function bordereau(projet, biblio, varianteId) {
    const s = synthese(projet, biblio, varianteId);
    return s.familles.map((g, i) => ({
      numero: String(i + 1), famille: g.famille,
      postes: g.ouvrages.map((o, j) => ({ numero: `${i + 1}.${j + 1}`, designation: o.nom, unite: o.unite, quantite: o.retenue, theorique: o.theorique, zones: o.zones })),
    }));
  }

  const usages = (etat, ouvrageId) => etat.projets.reduce((n, p) => n + p.lignes.filter((l) => l.ouvrageId === ouvrageId).length, 0);

  // ---------- Normalisation (sauvegarde ancienne, abîmée ou importée) ----------
  const DIMS = ['L', 'l', 'H', 'b', 'h', 'd', 'e', 'q'];
  const num = (v, min, max) => { const n = typeof v === 'number' ? v : O.lireNombre(v); return n !== null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
  function normaliserOuvrage(o) {
    o = o && typeof o === 'object' ? o : {};
    const fam = B().familles.map((x) => x.id);
    const unite = O.choix(o.unite, UNITES, 'u');
    const fo = forme(o.forme);
    return {
      id: O.idValide(o.id), nom: O.texte(o.nom, 120) || 'Ouvrage sans nom', famille: O.choix(o.famille, fam, 'divers'), unite,
      forme: fo && (!fo.unite || fo.unite === unite) ? fo.id : (B().formes.find((x) => x.unite === unite)?.id || 'direct'),
      perte: num(o.perte, 0, 100) ?? 0,
      composants: O.tableau(o.composants).slice(0, 30).map((c) => ({
        nom: O.texte(c?.nom, 120) || 'Composant', ratio: num(c?.ratio, 0, 1e6) ?? 0, unite: O.choix(c?.unite, UNITES, 'u'),
        cond: num(c?.cond, 0.000001, 1e6), uc: O.texte(c?.uc, 60),
      })),
      note: O.texte(o.note, 400), perso: !!o.perso,
    };
  }
  function normaliserLigne(l, zones, variantes) {
    l = l && typeof l === 'object' ? l : {};
    const dims = {};
    for (const k of DIMS) { const v = num(l.dims?.[k], 0, 1e9); if (v !== null) dims[k] = v; }
    return {
      id: O.idValide(l.id), zoneId: zones.some((z) => z.id === l.zoneId) ? l.zoneId : (zones[0]?.id ?? null),
      ouvrageId: O.texte(l.ouvrageId, 40), precision: O.texte(l.precision, 120), forme: forme(l.forme) ? l.forme : 'direct', dims,
      nombre: num(l.nombre, 0.000001, LIMITE_NOMBRE) ?? 1,
      deductions: O.tableau(l.deductions).slice(0, 40).map((d) => ({ id: O.idValide(d?.id), libelle: O.texte(d?.libelle, 80), nombre: num(d?.nombre, 0.000001, 10000) ?? 1, a: num(d?.a, 0, 1e6) ?? 0, b: num(d?.b, 0, 1e6) ?? 0 })),
      perte: num(l.perte, 0, 100), retenue: num(l.retenue, 0, 1e9),
      variantes: O.tableau(l.variantes).filter((v) => variantes.some((x) => x.id === v)),
      note: O.texte(l.note, 400),
    };
  }
  function normaliserProjet(p) {
    p = p && typeof p === 'object' ? p : {};
    const variantes = O.tableau(p.variantes).slice(0, 8).map((v) => ({ id: O.idValide(v?.id), nom: O.texte(v?.nom, 60) || 'Variante' }));
    if (!variantes.length) variantes.push({ id: 'base', nom: 'Solution de base' });
    const zones = O.tableau(p.zones).slice(0, 200).map((z) => ({ id: O.idValide(z?.id), nom: O.texte(z?.nom, 80) || 'Zone', note: O.texte(z?.note, 300) }));
    return {
      id: O.idValide(p.id), nom: O.texte(p.nom, 120) || 'Projet sans nom', client: O.texte(p.client, 120), adresse: O.texte(p.adresse, 200),
      date: O.dateOuNull(p.date), note: O.texte(p.note, 1000),
      hypotheses: O.tableau(p.hypotheses).slice(0, 60).map((h) => ({ id: O.idValide(h?.id), texte: O.texte(h?.texte, 300) })).filter((h) => h.texte),
      variantes, varianteActive: variantes.some((v) => v.id === p.varianteActive) ? p.varianteActive : variantes[0].id,
      zones, lignes: O.tableau(p.lignes).slice(0, 3000).map((l) => normaliserLigne(l, zones, variantes)),
    };
  }
  const bibliothequeInitiale = () => B().ouvrages.map((o) => normaliserOuvrage(structuredClone(o)));
  const etatVide = () => ({ version: 1, projets: [], projetActif: null, bibliotheque: bibliothequeInitiale() });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const projets = O.tableau(d.projets).slice(0, 100).map(normaliserProjet);
    const biblio = Array.isArray(d.bibliotheque) && d.bibliotheque.length ? d.bibliotheque.slice(0, 500).map(normaliserOuvrage) : v.bibliotheque;
    return { ...d, version: 1, projets, projetActif: projets.some((p) => p.id === d.projetActif) ? d.projetActif : (projets[0]?.id ?? null), bibliotheque: biblio };
  }

  // ---------- Exports CSV ----------
  const nomFamille = (id) => B().familles.find((x) => x.id === id)?.nom || 'Divers';
  const nomsVariantes = (p, l) => (l.variantes.length ? l.variantes.map((id) => p.variantes.find((v) => v.id === id)?.nom).filter(Boolean).join(' + ') : 'Toutes');
  function csvMetre(p, biblio) {
    const tete = ['Projet', 'Zone', 'Famille', 'Ouvrage', 'Précision', 'Variantes', 'Forme', 'Longueur (m)', 'Largeur (m)', 'Hauteur (m)', 'Base (m)', 'Hauteur triangle (m)', 'Diamètre (m)', 'Épaisseur (cm)', 'Quantité directe', 'Nombre', 'Déductions', 'Formule', 'Unité', 'Quantité théorique', 'Perte (%)', 'Quantité avec pertes', 'Quantité retenue', 'Écart retenu - théorique', 'Note', 'Erreur'];
    const lignes = p.lignes.map((l) => {
      const o = ouvrageDe(biblio, l.ouvrageId);
      const c = calculerLigne(l, o);
      const fo = forme(l.forme);
      return [p.nom, p.zones.find((z) => z.id === l.zoneId)?.nom || '', nomFamille(o?.famille), o?.nom || 'Ouvrage supprimé', l.precision, nomsVariantes(p, l), fo?.nom || '',
        ...['L', 'l', 'H', 'b', 'h', 'd', 'e', 'q'].map((k) => (fo?.champs.includes(k) ? O.nombreCsv(l.dims[k], 3) : '')),
        O.nombreCsv(l.nombre, 3), l.deductions.map((d) => `${d.libelle || 'déduction'} : ${texteDeduction(fo?.deduction || 'surface', d)}`).join(' | '),
        c.formule, nomUnite(c.unite), c.ok ? O.nombreCsv(c.theorique, 3) : '', c.ok ? O.nombreCsv(c.perte, 2) : '', c.ok ? O.nombreCsv(c.avecPertes, 3) : '', c.ok ? O.nombreCsv(c.retenue, 3) : '', c.ok ? O.nombreCsv(c.ecart, 3) : '', l.note, c.erreur || ''];
    });
    return [tete, ...lignes];
  }
  function csvCommande(p, biblio, varianteId) {
    const s = synthese(p, biblio, varianteId);
    return [['Famille', 'Composant', 'Unité', 'Besoin', 'Conditionnement', 'Nombre de conditionnements', 'Quantité à commander', 'Surplus', 'Utilisé par'],
      ...s.composants.map((k) => [nomFamille(k.famille), k.nom, nomUnite(k.unite), O.nombreCsv(k.besoin, 3), k.uc || '', k.nbCond ?? '', O.nombreCsv(k.commande, 3), O.nombreCsv(k.surplus, 3), k.sources.join(' | ')])];
  }
  function csvBordereau(p, biblio, varianteId) {
    const rows = [['N°', 'Désignation', 'Unité', 'Quantité retenue', 'Quantité théorique', 'Détail par zone']];
    for (const g of bordereau(p, biblio, varianteId)) {
      rows.push([g.numero, nomFamille(g.famille).toUpperCase(), '', '', '', '']);
      for (const x of g.postes) rows.push([x.numero, x.designation, nomUnite(x.unite), O.nombreCsv(x.quantite, 3), O.nombreCsv(x.theorique, 3), x.zones.map((z) => `${z.zone} : ${O.fmtNombre(z.q, { dec: 3 })}`).join(' | ')]);
    }
    return rows;
  }

  racine.MTR = {
    FORMULES, LIMITE_DIM, UNITES, forme, nomUnite, nomFamille, valeurDeduction, texteDeduction,
    calculerLigne, synthese, commande, comparaison, bordereau, dansVariante, ouvrageDe, usages,
    normaliserOuvrage, normaliserLigne, normaliserProjet, bibliothequeInitiale, etatVide, normaliser,
    csvMetre, csvCommande, csvBordereau,
  };
})(typeof window !== 'undefined' ? window : globalThis);
