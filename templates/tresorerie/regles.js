// Trésorerie prévisionnelle QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.TRS) et par les tests Node (vm).
// Tous les montants sont des centimes entiers : aucune erreur d'arrondi dans les calculs.
(function (racine) {
  'use strict';

  const PAS = { ponctuel: 0, mensuel: 1, trimestriel: 3, annuel: 12 };
  const SCENARIOS = ['prudent', 'central', 'optimiste'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ---------- Montants ----------
  // « 1 234,56 », « 12.5 », « 12 € », « -300 » (si negatif) → centimes entiers ; null si illisible.
  function versCentimes(saisie, { negatif = false } = {}) {
    if (typeof saisie === 'number') {
      if (!Number.isFinite(saisie) || (!negatif && saisie < 0)) return null;
      return Math.round(saisie * 100);
    }
    let s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(/^\+/, '').replace(/^[−–]/, '-');
    let signe = 1;
    if (s.startsWith('-')) { if (!negatif) return null; signe = -1; s = s.slice(1); }
    if (!/^\d+(?:[.,]\d{0,2})?$/.test(s)) return null;
    const [ent, dec = ''] = s.split(/[.,]/);
    const c = Number(ent) * 100 + Number((dec + '00').slice(0, 2));
    return c === 0 ? 0 : signe * c;
  }

  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // 1 234,56 € (espace fine insécable entre les milliers) ; signe : « + » devant un positif.
  function euros(c, { signe = false } = {}) {
    const n = Math.abs(Math.round(c));
    const s = `${milliers(Math.floor(n / 100))},${String(n % 100).padStart(2, '0')} €`;
    if (c < 0) return `−${s}`;
    return signe && c > 0 ? `+${s}` : s;
  }

  // Arrondi à l'euro, pour les tuiles, le tableau et le graphique : 1 235 €.
  function eurosRonds(c, { signe = false } = {}) {
    const n = Math.round(Math.abs(c) / 100);
    if (c < 0 && n) return `−${milliers(n)} €`;
    return `${signe && n ? '+' : ''}${milliers(n)} €`;
  }

  // Pour l'export CSV : 1234,56 ou -12,00 (aucun séparateur de milliers).
  function eurosCsv(c) {
    const n = Math.abs(Math.round(c));
    return `${c < 0 ? '-' : ''}${Math.floor(n / 100)},${String(n % 100).padStart(2, '0')}`;
  }

  // ---------- Mois (AAAA-MM) ----------
  const deux = (n) => String(n).padStart(2, '0');
  function ajoutMois(mois, n) {
    const [a, m] = mois.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`;
  }
  function ecartMois(de, a) {
    const [a1, m1] = de.split('-').map(Number);
    const [a2, m2] = a.split('-').map(Number);
    return (a2 * 12 + m2) - (a1 * 12 + m1);
  }
  const moisValide = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  function libelleMois(mois, { court = false, annee = true } = {}) {
    const [a, m] = mois.split('-').map(Number);
    const nom = (court ? MOIS_COURTS : MOIS_LONGS)[m - 1];
    return annee ? `${nom} ${court ? String(a).slice(2) : a}` : nom;
  }

  // ---------- Échéances ----------
  // La ligne tombe-t-elle ce mois-ci ?
  function tombe(ligne, mois) {
    if (!ligne || !moisValide(ligne.mois) || mois < ligne.mois) return false;
    if (ligne.fin && mois > ligne.fin) return false;
    const pas = PAS[ligne.recurrence] ?? 0;
    const e = ecartMois(ligne.mois, mois);
    return pas === 0 ? e === 0 : e % pas === 0;
  }

  // Prévu d'une échéance : ajustement propre au mois, sinon montant de la ligne.
  function prevuDu(etat, ligne, mois) {
    const a = etat.ajustements?.[ligne.id]?.[mois];
    return Number.isInteger(a) ? a : ligne.montant;
  }
  function realiseDu(etat, ligne, mois) {
    const r = etat.realise?.[ligne.id]?.[mois];
    return Number.isInteger(r) ? r : null;
  }

  // Écart de scénario en % appliqué à un encaissement prévu (centimes entiers).
  function appliquerEcart(c, pct) {
    return Math.round((c * (100 + (Number(pct) || 0))) / 100);
  }
  function ecartScenario(etat, scenario) {
    if (scenario === 'prudent') return Number(etat.ecarts?.prudent) || 0;
    if (scenario === 'optimiste') return Number(etat.ecarts?.optimiste) || 0;
    return 0;
  }

  // Échéances d'un mois : [{ ligne, prevu, realise, retenu, ajuste }].
  function echeancesDuMois(etat, mois, scenario = 'central') {
    const pct = ecartScenario(etat, scenario);
    return (etat.lignes || []).filter((l) => tombe(l, mois)).map((ligne) => {
      const prevu = prevuDu(etat, ligne, mois);
      const realise = realiseDu(etat, ligne, mois);
      const retenu = realise !== null ? realise : ligne.type === 'enc' ? appliquerEcart(prevu, pct) : prevu;
      const ajuste = Number.isInteger(etat.ajustements?.[ligne.id]?.[mois]);
      return { ligne, prevu, realise, retenu, ajuste };
    });
  }

  // Fenêtre de 12 mois : depuis le mois en cours, ou depuis le départ s'il est plus tard.
  const debutFenetre = (etat, moisCourant) => (etat.debut > moisCourant ? etat.debut : moisCourant);

  // Calcul complet : chaque mois du départ à la fin de la fenêtre.
  function calculer(etat, { scenario = 'central', moisCourant, nb = 12 } = {}) {
    const debut = etat.debut;
    const fenetre = debutFenetre(etat, moisCourant);
    const fin = ajoutMois(fenetre, nb - 1);
    const seuil = Number.isInteger(etat.seuil) ? etat.seuil : 0;
    const mois = [];
    let solde = etat.soldeDepart || 0;
    for (let m = debut; m <= fin; m = ajoutMois(m, 1)) {
      const ech = echeancesDuMois(etat, m, scenario);
      const parCategorie = {};
      let enc = 0, dec = 0, encPrevu = 0, decPrevu = 0, aPointer = 0, pointees = 0, ecartRealise = 0;
      for (const e of ech) {
        const k = e.ligne.categorie;
        if (e.ligne.type === 'enc') { enc += e.retenu; encPrevu += e.prevu; parCategorie[k] = (parCategorie[k] || 0) + e.retenu; }
        else { dec += e.retenu; decPrevu += e.prevu; parCategorie[k] = (parCategorie[k] || 0) + e.retenu; }
        if (e.realise !== null) { pointees++; ecartRealise += (e.ligne.type === 'enc' ? 1 : -1) * (e.realise - e.prevu); }
        else if (m < moisCourant) aPointer++;
      }
      const soldeDebut = solde;
      solde = soldeDebut + enc - dec;
      mois.push({
        mois: m, passe: m < moisCourant, courant: m === moisCourant, dansFenetre: m >= fenetre,
        soldeDebut, enc, dec, net: enc - dec, solde, encPrevu, decPrevu, parCategorie,
        aPointer, pointees, ecartRealise, sousSeuil: solde < seuil, decouvert: solde < 0,
      });
    }
    const vus = mois.filter((x) => x.dansFenetre);
    const pointBas = vus.reduce((b, x) => (!b || x.solde < b.solde ? x : b), null);
    return {
      scenario, debut, fenetre, fin, seuil, mois, vus,
      pointBas: pointBas ? { mois: pointBas.mois, solde: pointBas.solde } : null,
      premierSousSeuil: vus.find((x) => x.sousSeuil)?.mois || null,
      premierDecouvert: vus.find((x) => x.decouvert)?.mois || null,
      moisSousSeuil: vus.filter((x) => x.sousSeuil).length,
      totalEnc: vus.reduce((s, x) => s + x.enc, 0),
      totalDec: vus.reduce((s, x) => s + x.dec, 0),
      aPointer: mois.reduce((s, x) => s + x.aPointer, 0),
    };
  }

  // Les trois scénarios d'un coup (graphique : fourchette prudent ↔ optimiste).
  function calculerTous(etat, options) {
    return Object.fromEntries(SCENARIOS.map((s) => [s, calculer(etat, { ...options, scenario: s })]));
  }

  // ---------- Export CSV ----------
  // Plan de trésorerie : catégories en lignes, mois en colonnes ; « ; » et virgule décimale.
  function csv(etat, calc, categories) {
    const champ = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const mois = calc.vus;
    const nomCat = (id) => categories.find((c) => c.id === id)?.nom || id;
    const utilisees = (type) => {
      const ids = new Set((etat.lignes || []).filter((l) => l.type === type).map((l) => l.categorie));
      return categories.filter((c) => ids.has(c.id)).map((c) => c.id).concat([...ids].filter((id) => !categories.some((c) => c.id === id)));
    };
    const lignes = [];
    lignes.push(['Poste', ...mois.map((x) => x.mois)]);
    lignes.push(['Solde de début', ...mois.map((x) => eurosCsv(x.soldeDebut))]);
    for (const id of utilisees('enc')) lignes.push([`Encaissement · ${nomCat(id)}`, ...mois.map((x) => eurosCsv(x.parCategorie[id] || 0))]);
    lignes.push(['Total encaissements', ...mois.map((x) => eurosCsv(x.enc))]);
    for (const id of utilisees('dec')) lignes.push([`Décaissement · ${nomCat(id)}`, ...mois.map((x) => eurosCsv(x.parCategorie[id] || 0))]);
    lignes.push(['Total décaissements', ...mois.map((x) => eurosCsv(x.dec))]);
    lignes.push(['Flux net', ...mois.map((x) => eurosCsv(x.net))]);
    lignes.push(['Solde de fin', ...mois.map((x) => eurosCsv(x.solde))]);
    lignes.push(['Sous le seuil', ...mois.map((x) => (x.sousSeuil ? 'oui' : 'non'))]);
    return '﻿' + lignes.map((l) => l.map(champ).join(';')).join('\r\n') + '\r\n';
  }

  racine.TRS = {
    PAS, SCENARIOS, versCentimes, euros, eurosRonds, eurosCsv, ajoutMois, ecartMois, moisValide, libelleMois,
    tombe, prevuDu, realiseDu, appliquerEcart, ecartScenario, echeancesDuMois, debutFenetre, calculer, calculerTous, csv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
