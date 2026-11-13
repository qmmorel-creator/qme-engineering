// Règles métier de l'inventaire valorisé : fonctions pures, sans accès au DOM ni au stockage.
// Chargé par le navigateur (window.PTM_CALCUL) et par les tests (outils/templates/patrimoine.test.mjs).
// Montants en euros, taux en pourcentage (30 = 30 %), dates d'achat au format AAAA-MM (ou AAAA).
//
// Trois valeurs, jamais confondues :
//  - prix d'achat historique : ce qui a été payé (donnée saisie) ;
//  - valeur actuelle estimée : estimation algorithmique de ce que vaut l'objet aujourd'hui dans son état
//    (décote selon l'âge, l'état, la famille et le prix), ou valeur saisie par l'utilisateur ;
//  - valeur de revente potentielle : ce qu'une vente rapide entre particuliers pourrait rapporter, avant frais.
// Aucune de ces valeurs n'est une valeur comptable, une valeur d'assurance ni une cotation vérifiée.
(function (racine) {
  'use strict';

  const nombre = (v, defaut = 0) => { const n = Number(v); return Number.isFinite(n) ? n : defaut; };
  const positif = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const arrondi = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
  const borne = (n, min, max) => Math.min(max, Math.max(min, n));

  // Date d'achat approximative AAAA-MM ou AAAA → nombre de mois écoulés à la date de référence (AAAA-MM-JJ).
  function moisDepuis(dateAchat, ref) {
    const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(String(dateAchat || ''));
    if (!m) return null;
    const [ra, rm, rj] = String(ref).split('-').map(Number);
    const a = Number(m[1]), mo = m[2] ? Number(m[2]) : 7; // année seule : milieu d'année
    const mois = (ra - a) * 12 + (rm - mo) + ((rj || 1) - 1) / 31;
    return Math.max(0, mois);
  }

  // Durée de possession en années (0 si date inconnue ou future).
  const anneesPossession = (dateAchat, ref) => { const m = moisDepuis(dateAchat, ref); return m === null ? 0 : m / 12; };

  // Multiplicateur de décote selon le prix d'achat unitaire (tranches triées, la dernière sans plafond).
  function multiplicateurPrix(prixUnitaire, tranches) {
    const p = positif(prixUnitaire);
    for (const t of tranches || []) if (t.jusqua === null || t.jusqua === undefined || p < t.jusqua) return nombre(t.mult, 1);
    return 1;
  }

  // Part de la valeur à neuf conservée après t années (courbe continue) :
  // perte linéaire de an1 % la première année, puis perte de annuel % par an sur la valeur restante,
  // jamais sous le plancher. mult accélère (> 1) ou ralentit (< 1) la décote.
  function retention(t, famille, mult = 1) {
    const a1 = borne(nombre(famille.an1) / 100 * mult, 0, 0.95);
    const an = borne(nombre(famille.annuel) / 100 * mult, 0, 0.95);
    const plancher = borne(nombre(famille.plancher) / 100, 0, 1);
    const age = Math.max(0, nombre(t));
    const r = age <= 1 ? 1 - a1 * age : (1 - a1) * (1 - an) ** (age - 1);
    return Math.max(plancher, r);
  }

  const familleDe = (id, coefs) => coefs.familles.find((f) => f.id === id) || coefs.familles.find((f) => f.id === 'loisirs') || coefs.familles[0];
  const etatDe = (id, coefs) => coefs.etats.find((e) => e.id === id) || coefs.etats.find((e) => e.id === 'bon');
  const sousCategorie = (base, catId, sousId) => base.categories.find((c) => c.id === catId)?.sous.find((s) => s.id === sousId) || null;
  // Famille de valorisation d'un objet : choix explicite, sinon celle de sa sous-catégorie, sinon « loisirs ».
  const familleObjet = (o, base) => o.famille || sousCategorie(base, o.categorie, o.sousCategorie)?.famille || 'loisirs';

  // Facilité de revente : famille assez liquide et état au moins égal au seuil.
  function facileARevendre(familleLiquidite, etatId, coefs) {
    const seuil = (coefs.reventeFacile || {})[familleLiquidite];
    if (!seuil) return false;
    const rang = (id) => coefs.etats.findIndex((e) => e.id === id);
    const r = rang(etatId);
    return r >= 0 && r <= rang(seuil);
  }

  // Valorise un objet à la date ref. coefs = { familles, etats, tranchesPrix, reventeFacile }.
  function valoriser(o, coefs, base, ref) {
    const q = Math.max(1, Math.round(nombre(o.quantite, 1)) || 1);
    const prix = positif(o.prixAchat);
    const fam = familleDe(familleObjet(o, base), coefs);
    const etat = etatDe(o.etat, coefs);
    const mult = multiplicateurPrix(prix, coefs.tranchesPrix);
    const ageAchat = Math.max(0, nombre(o.ageAchat));
    const possession = anneesPossession(o.dateAchat, ref);
    const age = ageAchat + possession;
    // Objet acheté d'occasion : la décote déjà subie avant l'achat n'est pas comptée une seconde fois.
    const partAge = retention(age, fam, mult) / retention(ageAchat, fam, mult);
    const estimeeUnitaire = prix * partAge * nombre(etat.coef, 1);
    const reventeAuto = (v) => v * (1 - borne(nombre(fam.revente) / 100, 0, 1));
    const manuelleA = o.valeurManuelle !== null && o.valeurManuelle !== undefined && o.valeurManuelle !== '' && Number.isFinite(Number(o.valeurManuelle));
    const manuelleR = o.reventeManuelle !== null && o.reventeManuelle !== undefined && o.reventeManuelle !== '' && Number.isFinite(Number(o.reventeManuelle));
    const actuelleU = manuelleA ? Math.max(0, Number(o.valeurManuelle)) : estimeeUnitaire;
    const reventeU = manuelleR ? Math.max(0, Number(o.reventeManuelle)) : reventeAuto(actuelleU);
    const achat = prix * q, actuelle = actuelleU * q, revente = reventeU * q;
    const perte = Math.max(0, achat - actuelle);
    return {
      id: o.id, quantite: q, achat, actuelle, revente, perte,
      // Perte moyenne par année de possession (au moins un mois pour éviter les divisions extrêmes).
      perteParAn: possession > 0 ? perte / Math.max(possession, 1 / 12) : 0,
      estimeeUnitaire, partConservee: prix > 0 ? actuelle / achat : null,
      source: manuelleA ? 'manuelle' : 'estimee', sourceRevente: manuelleR ? 'manuelle' : 'estimee',
      age, possession, famille: fam.id, liquidite: fam.liquidite, multiplicateur: mult, coefEtat: nombre(etat.coef, 1),
      aCompleter: !prix && !manuelleA,
      facile: facileARevendre(fam.liquidite, etat.id, coefs) && revente > 0,
    };
  }

  const usageDe = (id, base) => base.usages.find((u) => u.id === id) || null;

  // Valorise tout l'inventaire et produit les agrégats du bilan.
  function bilan(objets, coefs, base, ref, seuilValeur = 100) {
    const lignes = (objets || []).map((o) => ({ objet: o, v: valoriser(o, coefs, base, ref) }));
    const somme = (f, liste = lignes) => liste.reduce((s, l) => s + f(l), 0);
    const total = { achat: somme((l) => l.v.achat), actuelle: somme((l) => l.v.actuelle), revente: somme((l) => l.v.revente) };
    total.perte = Math.max(0, total.achat - total.actuelle);
    const nbObjets = somme((l) => l.v.quantite);
    const parCat = new Map();
    for (const l of lignes) {
      const id = l.objet.categorie || 'autres';
      const c = parCat.get(id) || { id, achat: 0, actuelle: 0, revente: 0, perte: 0, nb: 0, lignes: 0 };
      c.achat += l.v.achat; c.actuelle += l.v.actuelle; c.revente += l.v.revente; c.perte += l.v.perte; c.nb += l.v.quantite; c.lignes += 1;
      parCat.set(id, c);
    }
    const categories = [...parCat.values()].map((c) => ({ ...c, part: total.actuelle > 0 ? c.actuelle / total.actuelle : 0 }))
      .sort((a, b) => b.actuelle - a.actuelle || b.achat - a.achat);
    const parValeur = [...lignes].sort((a, b) => b.v.actuelle - a.v.actuelle);
    const peu = lignes.filter((l) => usageDe(l.objet.usage, base)?.peu);
    const jamais = lignes.filter((l) => l.objet.usage === 'jamais');
    const facile = lignes.filter((l) => l.v.facile);
    return {
      lignes, total, nbObjets, nbLignes: lignes.length,
      moyenne: nbObjets ? total.actuelle / nbObjets : 0,
      tauxDepreciation: total.achat > 0 ? total.perte / total.achat : 0,
      categories,
      top10: parValeur.slice(0, 10),
      peuUtilisesDeValeur: peu.filter((l) => l.v.actuelle >= seuilValeur).sort((a, b) => b.v.actuelle - a.v.actuelle),
      valeurPeuUtilises: somme((l) => l.v.actuelle, peu),
      reventePeuUtilises: somme((l) => l.v.revente, peu),
      valeurJamais: somme((l) => l.v.actuelle, jamais),
      nbJamais: jamais.length,
      pertesTop: [...lignes].filter((l) => l.v.perte > 0).sort((a, b) => b.v.perte - a.v.perte).slice(0, 10),
      categoriesCouteuses: [...categories].sort((a, b) => b.achat - a.achat),
      reventeFacile: somme((l) => l.v.revente, facile),
      partFacile: total.revente > 0 ? somme((l) => l.v.revente, facile) / total.revente : 0,
      aCompleter: lignes.filter((l) => l.v.aCompleter).length,
      manuelles: lignes.filter((l) => l.v.source === 'manuelle').length,
    };
  }

  // Projection de la valeur actuelle estimée totale dans k années (k = 0 … n), à état constant.
  function projection(objets, coefs, base, ref, n = 5) {
    const [a, m, j] = String(ref).split('-');
    const points = [];
    for (let k = 0; k <= n; k += 1) {
      const date = `${Number(a) + k}-${m}-${j}`;
      const b = bilan(objets, coefs, base, date);
      points.push({ annee: Number(a) + k, k, actuelle: b.total.actuelle, revente: b.total.revente });
    }
    return points;
  }

  // ---------- Simulateur de revente ----------
  // Périmètres : tous, categorie (cible = id), inutilises (usage « peu »), seuil (revente unitaire >= cible),
  // nombre (les cible objets à la plus forte revente), selection (cible = liste d'id).
  function selectionner(lignes, sim, base) {
    const p = sim.perimetre || 'tous';
    if (p === 'categorie') return lignes.filter((l) => l.objet.categorie === sim.cible);
    if (p === 'inutilises') return lignes.filter((l) => usageDe(l.objet.usage, base)?.peu);
    if (p === 'jamais') return lignes.filter((l) => l.objet.usage === 'jamais');
    if (p === 'seuil') return lignes.filter((l) => l.v.revente / l.v.quantite >= nombre(sim.cible));
    if (p === 'nombre') return [...lignes].sort((a, b) => b.v.revente - a.v.revente).slice(0, Math.max(0, Math.round(nombre(sim.cible))));
    if (p === 'selection') { const ids = new Set(Array.isArray(sim.cible) ? sim.cible : []); return lignes.filter((l) => ids.has(l.objet.id)); }
    return lignes;
  }

  // Montant net estimé d'une revente : pour chaque unité,
  //   prix espéré = revente × (1 − décote supplémentaire) × (1 − marge de négociation)
  //   net = prix espéré × (1 − commission) − frais fixes − frais d'expédition × part expédiée.
  // Une unité dont le net serait négatif ou nul n'est pas vendue (comptée à part).
  function simuler(lignes, sim, base) {
    const choisies = selectionner(lignes, sim, base);
    const t = (v) => borne(nombre(v) / 100, 0, 1);
    const decote = t(sim.decote), nego = t(sim.negociation), commission = t(sim.commission), part = t(sim.partExpediee);
    const fixe = Math.max(0, nombre(sim.fraisFixes)), expe = Math.max(0, nombre(sim.expedition));
    const r = { nbObjets: 0, nbVendus: 0, nbNonRentables: 0, reventeBrute: 0, decote: 0, negociation: 0, commission: 0, fraisFixes: 0, expedition: 0, net: 0, details: [] };
    for (const l of choisies) {
      const q = l.v.quantite, unitaire = l.v.revente / q;
      const apresDecote = unitaire * (1 - decote);
      const espere = apresDecote * (1 - nego);
      const com = espere * commission;
      const exp = expe * part;
      const net = espere - com - fixe - exp;
      r.nbObjets += q;
      if (net <= 0) { r.nbNonRentables += q; r.details.push({ id: l.objet.id, nom: l.objet.nom, quantite: q, brut: l.v.revente, net: 0, rentable: false }); continue; }
      r.nbVendus += q;
      r.reventeBrute += unitaire * q;
      r.decote += (unitaire - apresDecote) * q;
      r.negociation += (apresDecote - espere) * q;
      r.commission += com * q;
      r.fraisFixes += fixe * q;
      r.expedition += exp * q;
      r.net += net * q;
      r.details.push({ id: l.objet.id, nom: l.objet.nom, quantite: q, brut: unitaire * q, net: net * q, rentable: true });
    }
    r.details.sort((a, b) => b.net - a.net);
    r.tauxNet = r.reventeBrute > 0 ? r.net / r.reventeBrute : 0;
    return r;
  }

  // ---------- Historique ----------
  // Photographie datée des totaux (et par catégorie), stockée dans l'historique des valorisations.
  function instantane(b, date, id) {
    const parCategorie = {};
    for (const c of b.categories) parCategorie[c.id] = { achat: arrondi(c.achat), actuelle: arrondi(c.actuelle), revente: arrondi(c.revente), nb: c.nb };
    return { id, date, achat: arrondi(b.total.achat), actuelle: arrondi(b.total.actuelle), revente: arrondi(b.total.revente), nb: b.nbObjets, parCategorie };
  }

  // Faut-il enregistrer automatiquement une valorisation ? (aucune ce mois-ci)
  function instantaneDu(historique, ref) {
    const mois = String(ref).slice(0, 7);
    return (historique || []).some((h) => String(h.date).slice(0, 7) === mois);
  }

  // Écart entre deux photographies (b - a), au total et par catégorie.
  function comparer(a, b) {
    const ecart = (x, y) => ({ avant: x, apres: y, ecart: y - x, taux: x ? (y - x) / x : null });
    const ids = new Set([...Object.keys(a.parCategorie || {}), ...Object.keys(b.parCategorie || {})]);
    const vide = { achat: 0, actuelle: 0, revente: 0, nb: 0 };
    return {
      achat: ecart(a.achat, b.achat), actuelle: ecart(a.actuelle, b.actuelle), revente: ecart(a.revente, b.revente), nb: ecart(a.nb, b.nb),
      categories: [...ids].map((id) => {
        const x = a.parCategorie?.[id] || vide, y = b.parCategorie?.[id] || vide;
        return { id, actuelle: ecart(x.actuelle, y.actuelle), nb: ecart(x.nb, y.nb) };
      }).sort((p, q) => Math.abs(q.actuelle.ecart) - Math.abs(p.actuelle.ecart)),
    };
  }

  // ---------- Export CSV ----------
  const celluleCSV = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCSV = (n) => (n === null || n === undefined || n === '' ? '' : String(arrondi(Number(n))).replace('.', ','));
  function csv(b, base, coefs) {
    const nomCat = (id) => base.categories.find((c) => c.id === id)?.nom || id || '';
    const nomSous = (c, s) => sousCategorie(base, c, s)?.nom || s || '';
    const nomEtat = (id) => coefs.etats.find((e) => e.id === id)?.nom || '';
    const nomUsage = (id) => usageDe(id, base)?.nom || '';
    const entetes = ['Nom', 'Catégorie', 'Sous-catégorie', 'Marque', 'Description', 'Quantité', 'Date d\'achat', 'Prix d\'achat unitaire', 'État', 'Utilisation',
      'Prix d\'achat total', 'Valeur actuelle estimée', 'Origine de la valeur', 'Valeur de revente potentielle', 'Perte de valeur', 'Facilement revendable', 'Commentaires'];
    const lignes = b.lignes.map(({ objet: o, v }) => [o.nom, nomCat(o.categorie), nomSous(o.categorie, o.sousCategorie), o.marque, o.description, v.quantite, o.dateAchat,
      nombreCSV(o.prixAchat), nomEtat(o.etat), nomUsage(o.usage), nombreCSV(v.achat), nombreCSV(v.actuelle), v.source === 'manuelle' ? 'saisie' : 'estimation',
      nombreCSV(v.revente), nombreCSV(v.perte), v.facile ? 'oui' : 'non', o.commentaires].map(celluleCSV).join(';'));
    return `﻿${entetes.map(celluleCSV).join(';')}\r\n${lignes.join('\r\n')}\r\n`;
  }

  racine.PTM_CALCUL = { moisDepuis, anneesPossession, multiplicateurPrix, retention, familleObjet, facileARevendre, valoriser, bilan, projection, selectionner, simuler, instantane, instantaneDu, comparer, csv };
})(typeof window !== 'undefined' ? window : globalThis);
