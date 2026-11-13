// WattBudget · règles métier pures (aucun accès au DOM ni au stockage). window.WTT, testé par
// outils/templates/watt-budget.test.mjs. Énergie en kWh (décimaux), prix en €/kWh saisis par
// l'utilisateur, coûts en centimes entiers. Aucun tarif par défaut.
(function (racine) {
  'use strict';
  const O = racine.QME_OUTILS;
  const B = () => racine.BASE;
  const SEMAINES = 365 / 7; // semaines par an
  const MODES = ['duree', 'cycles', 'annuel', 'mesure'];
  const f = (n, d = 2) => O.fmtNombre(O.arrondi(n, d), { dec: d });

  // ---------- Validation d'un appareil ----------
  // Renvoie un message d'erreur clair, ou null si l'appareil est calculable.
  function valider(a) {
    const borne = (v, min, max, libelle, strict = true) => {
      if (v === null || v === undefined || Number.isNaN(v)) return `${libelle} : valeur manquante.`;
      if (typeof v !== 'number' || !Number.isFinite(v)) return `${libelle} : valeur illisible.`;
      if (v < 0) return `${libelle} : valeur négative refusée.`;
      if (strict ? v <= min : v < min) return `${libelle} : doit être ${strict ? 'supérieure à' : 'au moins'} ${f(min)}.`;
      if (v > max) return `${libelle} : ${f(max)} au maximum (vérifie l'unité).`;
      return null;
    };
    if (!O.texte(a.nom)) return 'Donne un nom à l\'appareil.';
    if (!MODES.includes(a.mode)) return 'Mode de calcul inconnu.';
    if (!Number.isInteger(a.quantite) || a.quantite < 1 || a.quantite > 1000) return 'Quantité : nombre entier de 1 à 1 000.';
    let e = null;
    if (a.mode === 'duree') {
      e = borne(a.puissance, 0, 50000, 'Puissance (W)') || borne(a.heures, 0, 24, 'Durée par jour (h)') || borne(a.jours, 0, 7, 'Jours par semaine');
    } else if (a.mode === 'cycles') {
      e = borne(a.kwhCycle, 0, 50, 'Consommation par cycle (kWh)') || borne(a.cycles, 0, 100, 'Cycles par semaine');
    } else if (a.mode === 'annuel') {
      e = borne(a.kwhAn, 0, 100000, 'Consommation annuelle (kWh)');
    } else {
      e = borne(a.mesureKwh, 0, 100000, 'Énergie mesurée (kWh)') || borne(a.mesureJours, 0, 3650, 'Durée de la mesure (jours)');
    }
    if (e) return e;
    if (a.mode !== 'annuel') e = borne(a.mois, 1, 12, 'Mois d\'utilisation par an', false);
    if (e) return e;
    if (a.mode === 'duree' || a.mode === 'cycles') {
      e = borne(a.veille ?? 0, 0, 500, 'Puissance de veille (W)', false) || borne(a.veilleH ?? 0, 0, 24, 'Heures de veille par jour', false);
      if (e) return e;
      if (a.mode === 'duree' && a.heures + (a.veille > 0 ? a.veilleH : 0) > 24 + 1e-9) return 'Durée d\'utilisation + heures de veille : 24 h par jour au maximum.';
    }
    return null;
  }

  // ---------- Consommation annuelle ----------
  // { ok, erreur?, usage, veille, total (kWh/an, quantité comprise), formule, fiabilite }
  function consommation(a) {
    const err = valider(a);
    if (err) return { ok: false, erreur: err, usage: 0, veille: 0, total: 0, formule: '', fiabilite: fiabilite(a) };
    const saison = a.mode === 'annuel' ? 1 : a.mois / 12;
    const facteur = a.facteur ?? 1; // réduction appliquée par un scénario
    let usage = 0, x = '';
    const s = a.mode !== 'annuel' && a.mois < 12 ? ` × ${f(a.mois, 0)}/12 mois` : '';
    if (a.mode === 'duree') { usage = (a.puissance * a.heures * a.jours * SEMAINES * saison) / 1000; x = `${f(a.puissance, 0)} W × ${f(a.heures)} h × ${f(a.jours)} j/sem × 52,14 sem${s}`; }
    else if (a.mode === 'cycles') { usage = a.kwhCycle * a.cycles * SEMAINES * saison; x = `${f(a.kwhCycle, 3)} kWh × ${f(a.cycles)} cycles/sem × 52,14 sem${s}`; }
    else if (a.mode === 'annuel') { usage = a.kwhAn; x = `${f(a.kwhAn)} kWh/an (étiquette)`; }
    else { usage = (a.mesureKwh / a.mesureJours) * 365 * saison; x = `${f(a.mesureKwh, 3)} kWh ÷ ${f(a.mesureJours, 1)} j × 365 j${s}`; }
    usage *= facteur;
    const veille = (a.mode === 'duree' || a.mode === 'cycles') && a.veille > 0 ? (a.veille * a.veilleH * 365) / 1000 : 0;
    const q = a.quantite;
    const total = O.arrondi((usage + veille) * q, 3);
    let formule = facteur !== 1 ? `(${x}) × ${f(facteur, 2)}` : x;
    if (veille) formule += ` + veille ${f(a.veille, 1)} W × ${f(a.veilleH, 1)} h × 365 j`;
    if (q > 1) formule = `${q} × (${formule})`;
    return { ok: true, usage: O.arrondi(usage * q, 3), veille: O.arrondi(veille * q, 3), total, formule: `${formule} = ${f(total)} kWh/an`, fiabilite: fiabilite(a) };
  }
  const fiabilite = (a) => (a.mode === 'mesure' ? 'mesuree' : a.mode === 'annuel' ? 'etiquette' : 'estimee');

  // ---------- Prix ----------
  // Prix du kWh applicable à un appareil (null si le tarif n'est pas saisi).
  function prixKwh(a, r) {
    if (r.option === 'hphc') return a.horaire === 'hc' ? r.prixHC : r.prixHP;
    return r.prix;
  }
  const tarifComplet = (r) => (r.option === 'hphc' ? r.prixHP > 0 && r.prixHC > 0 : r.prix > 0);
  const cout = (kwh, prix) => (prix > 0 ? Math.round(kwh * prix * 100) : null);

  // ---------- Totaux ----------
  function totaux(appareils, r) {
    const lignes = appareils.map((a) => { const c = consommation(a); const p = prixKwh(a, r); return { a, c, prix: p, cout: c.ok ? cout(c.total, p) : null }; });
    const valides = lignes.filter((x) => x.c.ok);
    const kwh = O.arrondi(valides.reduce((s, x) => s + x.c.total, 0), 3);
    const complet = tarifComplet(r);
    const coutAn = complet ? valides.reduce((s, x) => s + (x.cout || 0), 0) : null;
    const parCat = B().categories.map((c) => {
      const ls = valides.filter((x) => x.a.cat === c.id);
      return { cat: c.id, nb: ls.length, kwh: O.arrondi(ls.reduce((s, x) => s + x.c.total, 0), 3), cout: complet ? ls.reduce((s, x) => s + (x.cout || 0), 0) : null };
    }).filter((c) => c.nb).sort((a, b) => b.kwh - a.kwh);
    // Principaux postes (Pareto) : classés par kWh, part et part cumulée.
    let cumul = 0;
    const postes = [...valides].sort((x, y) => y.c.total - x.c.total).map((x) => {
      const part = kwh > 0 ? x.c.total / kwh : 0;
      cumul += part;
      return { id: x.a.id, nom: x.a.nom, cat: x.a.cat, kwh: x.c.total, cout: x.cout, part: O.arrondi(part * 100, 1), cumul: O.arrondi(Math.min(1, cumul) * 100, 1), fiabilite: x.c.fiabilite };
    });
    const abonnement = r.abonnement ?? null;
    const veille = O.arrondi(valides.reduce((s, x) => s + x.c.veille, 0), 3);
    return {
      lignes, erreurs: lignes.filter((x) => !x.c.ok).length, kwh, cout: coutAn, complet,
      parJour: coutAn === null ? null : Math.round(coutAn / 365), parMois: coutAn === null ? null : Math.round(coutAn / 12),
      abonnement, facture: coutAn === null ? null : coutAn + (abonnement || 0),
      parCat, postes, veille, coutVeille: complet ? Math.round(valides.reduce((s, x) => s + x.c.veille * (prixKwh(x.a, r) || 0), 0) * 100) : null,
      fiabilite: { mesuree: valides.filter((x) => x.c.fiabilite === 'mesuree').length, etiquette: valides.filter((x) => x.c.fiabilite === 'etiquette').length, estimee: valides.filter((x) => x.c.fiabilite === 'estimee').length },
      // Part de la consommation facturée expliquée par l'inventaire (si la consommation de la facture est saisie).
      couverture: r.factureKwh > 0 ? O.arrondi((kwh / r.factureKwh) * 100, 1) : null,
    };
  }

  // ---------- Remplacement d'un équipement ----------
  // Économie annuelle et temps de retour : prix d'achat ÷ économie annuelle. null si aucune économie.
  function remplacement({ kwhAvant, kwhApres, prix, prixAchat, dureeVie }) {
    const positif = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0; // null >= 0 vaut true en JavaScript
    if (!positif(kwhAvant) || !positif(kwhApres)) return { ok: false, erreur: 'Consommations manquantes.' };
    if (!(typeof prix === 'number' && prix > 0)) return { ok: false, erreur: 'Saisis d\'abord ton prix du kWh (Réglages).' };
    if (!positif(prixAchat)) return { ok: false, erreur: 'Prix d\'achat manquant (0 si l\'appareil est déjà payé).' };
    const economieKwh = O.arrondi(kwhAvant - kwhApres, 3);
    const economieAn = Math.round(economieKwh * prix * 100);
    const retourAns = economieAn > 0 ? O.arrondi(prixAchat / economieAn, 2) : null;
    const vie = dureeVie > 0 ? dureeVie : null;
    return {
      ok: true, economieKwh, economieAn, retourAns,
      retourMois: retourAns === null ? null : Math.ceil(retourAns * 12 - 1e-9),
      rentableSurVie: vie && retourAns !== null ? retourAns <= vie : null,
      bilanVie: vie ? economieAn * vie - prixAchat : null,
    };
  }

  // ---------- Scénarios de réduction ----------
  // Applique les actions d'un scénario à une copie des appareils (jamais à l'original).
  function appliquer(appareils, actions) {
    const res = [];
    for (const a0 of appareils) {
      let a = { ...a0 };
      let retire = false;
      for (const ac of actions.filter((x) => x.appareilId === a0.id)) {
        if (ac.type === 'duree') a.facteur = O.arrondi((a.facteur ?? 1) * (1 - Math.min(100, Math.max(0, ac.valeur || 0)) / 100), 6);
        else if (ac.type === 'veille') a.veille = 0;
        else if (ac.type === 'hc') a.horaire = 'hc';
        else if (ac.type === 'retirer') retire = true;
        else if (ac.type === 'remplacer' && ac.valeur > 0) a = { ...a, mode: 'annuel', kwhAn: ac.valeur, veille: 0, facteur: 1 };
      }
      if (!retire) res.push(a);
    }
    return res;
  }
  function resultatScenario(appareils, scenario, r) {
    const avant = totaux(appareils, r);
    const apres = totaux(appliquer(appareils, scenario.actions), r);
    return {
      avant, apres,
      economieKwh: O.arrondi(avant.kwh - apres.kwh, 3),
      economie: avant.cout !== null && apres.cout !== null ? avant.cout - apres.cout : null,
      economiePct: avant.kwh > 0 ? O.arrondi(((avant.kwh - apres.kwh) / avant.kwh) * 100, 1) : 0,
      investissement: scenario.actions.reduce((s, ac) => s + (ac.investissement || 0), 0),
    };
  }

  // ---------- Normalisation ----------
  const num = (v, min, max) => { const n = typeof v === 'number' ? v : O.lireNombre(v); return n !== null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
  function normaliserAppareil(a) {
    a = a && typeof a === 'object' ? a : {};
    const cats = B().categories.map((c) => c.id);
    return {
      id: O.idValide(a.id), nom: O.texte(a.nom, 80) || 'Appareil', cat: O.choix(a.cat, cats, 'autre'), mode: O.choix(a.mode, MODES, 'duree'),
      quantite: O.entier(a.quantite, 1, 1000, 1),
      puissance: num(a.puissance, 0, 1e6), heures: num(a.heures, 0, 1e6), jours: num(a.jours, 0, 1e6), mois: num(a.mois, 0, 1e6) ?? 12,
      veille: num(a.veille, 0, 1e6) ?? 0, veilleH: num(a.veilleH, 0, 1e6) ?? 0,
      kwhCycle: num(a.kwhCycle, 0, 1e6), cycles: num(a.cycles, 0, 1e6), kwhAn: num(a.kwhAn, 0, 1e7),
      mesureKwh: num(a.mesureKwh, 0, 1e7), mesureJours: num(a.mesureJours, 0, 1e6), mesureLe: O.dateOuNull(a.mesureLe),
      horaire: O.choix(a.horaire, ['standard', 'hc'], 'standard'), note: O.texte(a.note, 300), catalogueId: O.texte(a.catalogueId, 40),
    };
  }
  // Appareil prêt à l'emploi depuis le catalogue (valeurs indicatives, toujours modifiables).
  function depuisCatalogue(id, extra = {}) {
    const c = B().appareils.find((x) => x.id === id);
    if (!c) return null;
    return normaliserAppareil({
      nom: c.nom, cat: c.cat, mode: c.mode, quantite: 1, puissance: c.puissance ?? null, heures: c.heures ?? null, jours: c.jours ?? null, mois: c.mois ?? 12,
      veille: c.veille ?? 0, veilleH: c.veilleH ?? 0, kwhCycle: c.kwhCycle ?? null, cycles: c.cycles ?? null, kwhAn: c.kwhAn ?? null, catalogueId: c.id, ...extra,
    });
  }
  function normaliserReglages(r) {
    r = r && typeof r === 'object' ? r : {};
    return {
      option: O.choix(r.option, ['base', 'hphc'], 'base'),
      prix: num(r.prix, 0.0001, 5), prixHP: num(r.prixHP, 0.0001, 5), prixHC: num(r.prixHC, 0.0001, 5),
      abonnement: r.abonnement === null || r.abonnement === undefined ? null : O.entier(r.abonnement, 0, 10000000, null),
      dateTarif: O.dateOuNull(r.dateTarif), factureKwh: num(r.factureKwh, 1, 1e7), tarifFictif: !!r.tarifFictif,
    };
  }
  function normaliserScenario(s, ids) {
    s = s && typeof s === 'object' ? s : {};
    const types = B().actions.map((x) => x.id);
    return {
      id: O.idValide(s.id), nom: O.texte(s.nom, 80) || 'Scénario',
      actions: O.tableau(s.actions).slice(0, 200).filter((ac) => ids.includes(ac?.appareilId) && types.includes(ac?.type))
        .map((ac) => ({ id: O.idValide(ac.id), appareilId: ac.appareilId, type: ac.type, valeur: num(ac.valeur, 0, 1e6), investissement: O.entier(ac.investissement, 0, 1e9, 0) })),
    };
  }
  const etatVide = () => ({ version: 1, reglages: normaliserReglages({}), appareils: [], scenarios: [] });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const appareils = O.tableau(d.appareils).slice(0, 500).map(normaliserAppareil);
    const ids = appareils.map((a) => a.id);
    return { ...d, version: 1, reglages: normaliserReglages(d.reglages), appareils, scenarios: O.tableau(d.scenarios).slice(0, 30).map((s) => normaliserScenario(s, ids)) };
  }

  // ---------- Export CSV ----------
  const LIB_FIAB = { mesuree: 'Mesurée', etiquette: 'Étiquette énergie', estimee: 'Estimée' };
  function csvAppareils(e) {
    const t = totaux(e.appareils, e.reglages);
    const nomCat = (id) => B().categories.find((c) => c.id === id)?.nom || '';
    const tete = ['Appareil', 'Catégorie', 'Quantité', 'Mode', 'Puissance (W)', 'Heures par jour', 'Jours par semaine', 'Mois par an', 'Veille (W)', 'Heures de veille par jour', 'kWh par cycle', 'Cycles par semaine', 'kWh par an (étiquette)', 'kWh mesurés', 'Jours de mesure', 'Horaire', 'Fiabilité', 'Consommation (kWh/an)', 'dont veille (kWh/an)', 'Prix du kWh (€)', 'Coût annuel (€)', 'Coût mensuel (€)', 'Formule', 'Note', 'Erreur'];
    const lignes = t.lignes.map(({ a, c, prix, cout: co }) => [a.nom, nomCat(a.cat), a.quantite, B().modes.find((m) => m.id === a.mode)?.nom, O.nombreCsv(a.puissance), O.nombreCsv(a.heures), O.nombreCsv(a.jours), O.nombreCsv(a.mois), O.nombreCsv(a.veille), O.nombreCsv(a.veilleH), O.nombreCsv(a.kwhCycle, 3), O.nombreCsv(a.cycles), O.nombreCsv(a.kwhAn), O.nombreCsv(a.mesureKwh, 3), O.nombreCsv(a.mesureJours), a.horaire === 'hc' ? 'Heures creuses' : 'Standard', LIB_FIAB[c.fiabilite], c.ok ? O.nombreCsv(c.total, 3) : '', c.ok ? O.nombreCsv(c.veille, 3) : '', prix ? O.nombreCsv(prix, 4) : '', O.centimesCsv(co), co === null ? '' : O.centimesCsv(Math.round(co / 12)), c.formule, a.note, c.erreur || '']);
    return [tete, ...lignes];
  }

  racine.WTT = {
    SEMAINES, MODES, LIB_FIAB, valider, consommation, fiabilite, prixKwh, tarifComplet, cout, totaux, remplacement, appliquer, resultatScenario,
    normaliserAppareil, depuisCatalogue, normaliserReglages, normaliserScenario, etatVide, normaliser, csvAppareils,
  };
})(typeof window !== 'undefined' ? window : globalThis);
