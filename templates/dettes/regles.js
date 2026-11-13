// Remboursement de dettes QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.DTT) et par les tests Node (vm).
// Montants en centimes entiers ; taux en pourcentage annuel (21.5 = 21,5 %) ; mois « AAAA-MM ».
(function (racine) {
  'use strict';

  const METHODES = ['boule', 'avalanche', 'perso'];
  const MAX_MOIS = 600; // 50 ans : au-delà, le plan est déclaré sans fin

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
  function euros(c, { signe = false } = {}) {
    const n = Math.abs(Math.round(c));
    const s = `${milliers(Math.floor(n / 100))},${String(n % 100).padStart(2, '0')}\u00a0€`;
    if (c < 0) return `−${s}`;
    return signe && c > 0 ? `+${s}` : s;
  }
  function eurosRonds(c, { signe = false } = {}) {
    const n = Math.round(Math.abs(c) / 100);
    const s = `${milliers(n)}\u00a0€`;
    if (c < 0 && n) return `−${s}`;
    return signe && n && c > 0 ? `+${s}` : s;
  }
  // Valeur d'un montant pour un champ de saisie : 1234,5 → « 1234,50 ».
  const versSaisie = (c) => (Number.isInteger(c) ? `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}` : '');

  // « 21,5 », « 21.5 % », « 0 » → 21.5 ; null si illisible, négatif ou au-delà de 100 %.
  function lireTaux(saisie) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) && saisie >= 0 && saisie <= 100 ? Math.round(saisie * 1000) / 1000 : null;
    const s = String(saisie ?? '').replace(/[\s  %]/g, '');
    if (!/^\d{1,3}(?:[.,]\d{0,3})?$/.test(s)) return null;
    const v = Number(s.replace(',', '.'));
    return v <= 100 ? v : null;
  }
  const tauxTexte = (t) => `${String(Math.round(t * 1000) / 1000).replace('.', ',')} %`;

  // ---------- Mois ----------
  const deux = (n) => String(n).padStart(2, '0');
  const moisDe = (d) => (d && typeof d.getFullYear === 'function' ? `${d.getFullYear()}-${deux(d.getMonth() + 1)}` : String(d).slice(0, 7));
  function ajoutMois(mois, n) {
    const [a, m] = mois.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${deux((t % 12) + 1)}`;
  }
  function ecartMois(de, a) {
    const [a1, m1] = de.split('-').map(Number);
    const [a2, m2] = a.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  }
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  // « 37 mois » → « 3 ans et 1 mois ».
  function dureeTexte(n) {
    if (n <= 0) return '0 mois';
    const a = Math.floor(n / 12), m = n % 12;
    const ta = a ? `${a} an${a > 1 ? 's' : ''}` : '';
    const tm = m ? `${m} mois` : '';
    return ta && tm ? `${ta} et ${tm}` : ta || tm;
  }

  // ---------- Intérêts ----------
  // Calcul mensuel simple : capital restant × taux annuel ÷ 12, arrondi au centime.
  const interetsMois = (solde, taux) => (solde > 0 && taux > 0 ? Math.round((solde * taux) / 1200) : 0);

  // La mensualité minimale couvre-t-elle les intérêts du premier mois ?
  function couvreInterets(dette) {
    const interet = interetsMois(dette.capital, dette.taux);
    if (dette.capital <= 0) return { ok: true, interet: 0, manque: 0 };
    // manque : ce qu'il faut ajouter à la mensualité pour que le capital commence à baisser.
    return { ok: dette.mensualite > interet, interet, manque: Math.max(0, interet + 1 - dette.mensualite) };
  }

  const actives = (dettes) => dettes.filter((d) => d.capital > 0);
  const totalMinimums = (dettes) => actives(dettes).reduce((s, d) => s + Math.min(d.mensualite, d.capital + interetsMois(d.capital, d.taux)), 0);

  // Ordre de priorité du surplus, figé au départ du plan.
  // Boule de neige : plus petit solde, puis taux le plus élevé. Avalanche : taux le plus élevé, puis plus petit solde.
  // Personnalisé : l'ordre donné ; les dettes absentes de la liste suivent, en boule de neige.
  function ordrePriorite(dettes, methode, ordre = []) {
    const boule = (a, b) => a.capital - b.capital || b.taux - a.taux || String(a.id).localeCompare(String(b.id));
    const avalanche = (a, b) => b.taux - a.taux || a.capital - b.capital || String(a.id).localeCompare(String(b.id));
    const liste = [...dettes];
    if (methode === 'avalanche') return liste.sort(avalanche).map((d) => d.id);
    if (methode === 'perso') {
      const rang = new Map(ordre.map((id, i) => [id, i]));
      const dans = liste.filter((d) => rang.has(d.id)).sort((a, b) => rang.get(a.id) - rang.get(b.id));
      const hors = liste.filter((d) => !rang.has(d.id)).sort(boule);
      return [...dans, ...hors].map((d) => d.id);
    }
    return liste.sort(boule).map((d) => d.id);
  }

  // ---------- Simulation ----------
  // dettes : [{ id, nom, capital, taux, mensualite }] au début du mois `debut` (avant les intérêts du mois).
  // opts : { budget, methode ('boule' | 'avalanche' | 'perso' | 'minimums'), ordre, versements: [{ mois, montant, detteId }], debut, max }
  // Retour : { ok, erreur, manque, mois: [...], fin, duree, totalInterets, totalPaye, soldees, ordre, nonTermine, inutilise }
  function simuler(dettes, opts = {}) {
    const { budget = 0, methode = 'boule', ordre = [], versements = [], debut, max = MAX_MOIS } = opts;
    const liste = dettes.map((d) => ({ id: d.id, capital: Math.max(0, d.capital | 0), taux: d.taux || 0, mensualite: Math.max(0, d.mensualite | 0) }));
    const res = { ok: true, methode, debut, mois: [], fin: null, duree: 0, totalInterets: 0, totalPaye: 0, soldees: {}, ordre: [], nonTermine: false, inutilise: 0, interetsParDette: {}, payeParDette: {} };
    for (const d of liste) { res.interetsParDette[d.id] = 0; res.payeParDette[d.id] = 0; if (d.capital === 0) res.soldees[d.id] = null; }
    const act = actives(liste);
    if (!act.length) return res;
    const minimums = totalMinimums(act);
    if (methode !== 'minimums' && budget < minimums) return { ...res, ok: false, erreur: 'budget', manque: minimums - budget };
    res.ordre = ordrePriorite(act, methode === 'minimums' ? 'boule' : methode, ordre);
    const solde = new Map(liste.map((d) => [d.id, d.capital]));
    const parId = new Map(liste.map((d) => [d.id, d]));
    const extras = methode === 'minimums' ? [] : versements.filter((v) => v && estMois(v.mois) && v.montant > 0 && v.mois >= debut);

    for (let i = 0; i < max; i++) {
      const mois = ajoutMois(debut, i);
      const enCours = res.ordre.filter((id) => solde.get(id) > 0);
      if (!enCours.length) break;
      const lignes = {};
      let interetsMoisTotal = 0;
      for (const id of enCours) {
        const d = parId.get(id);
        const s0 = solde.get(id);
        const it = interetsMois(s0, d.taux);
        solde.set(id, s0 + it);
        lignes[id] = { avant: s0, interet: it, paye: 0, capital: 0, solde: 0, extra: 0 };
        interetsMoisTotal += it;
      }
      const duMois = extras.filter((v) => v.mois === mois);
      const extraTotal = duMois.reduce((s, v) => s + v.montant, 0);
      let dispo = (methode === 'minimums' ? enCours.reduce((s, id) => s + parId.get(id).mensualite, 0) : budget) + extraTotal;
      const payer = (id, montant) => {
        const p = Math.min(montant, solde.get(id), dispo);
        if (p <= 0) return 0;
        solde.set(id, solde.get(id) - p);
        lignes[id].paye += p;
        dispo -= p;
        return p;
      };
      // 1. Mensualités minimales.
      for (const id of enCours) payer(id, parId.get(id).mensualite);
      if (methode !== 'minimums') {
        // 2. Versements exceptionnels fléchés vers une dette précise.
        for (const v of duMois) if (v.detteId && lignes[v.detteId]) lignes[v.detteId].extra += payer(v.detteId, v.montant);
        // 3. Le reste (surplus du budget, mensualités libérées, versements non fléchés) suit l'ordre de priorité.
        for (const id of enCours) { if (dispo <= 0) break; payer(id, dispo); }
      }
      let totalSolde = 0, payeMois = 0;
      for (const id of enCours) {
        const l = lignes[id];
        l.solde = solde.get(id);
        l.capital = l.paye - l.interet;
        payeMois += l.paye;
        res.interetsParDette[id] += l.interet;
        res.payeParDette[id] += l.paye;
        if (l.solde === 0) res.soldees[id] = mois;
      }
      for (const id of res.ordre) totalSolde += solde.get(id);
      res.totalInterets += interetsMoisTotal;
      res.totalPaye += payeMois;
      res.mois.push({ mois, index: i, lignes, interets: interetsMoisTotal, paye: payeMois, extra: extraTotal, totalSolde, reste: Math.max(0, dispo) });
      if (totalSolde === 0) { res.inutilise = Math.max(0, dispo); break; }
    }
    const dernier = res.mois[res.mois.length - 1];
    if (dernier.totalSolde > 0) { res.nonTermine = true; res.fin = null; res.duree = null; }
    else { res.fin = dernier.mois; res.duree = res.mois.length; }
    return res;
  }

  // Les trois méthodes et le repère « minimums seuls », avec les mêmes dettes et le même budget.
  function comparer(dettes, opts) {
    const r = {};
    for (const m of [...METHODES, 'minimums']) r[m] = simuler(dettes, { ...opts, methode: m });
    return r;
  }

  // Effet des versements exceptionnels : même plan avec et sans eux.
  function effetVersements(dettes, opts) {
    const avec = simuler(dettes, opts);
    const sans = simuler(dettes, { ...opts, versements: [] });
    if (!avec.ok || !sans.ok) return null;
    const total = (opts.versements || []).filter((v) => v && v.montant > 0 && v.mois >= opts.debut).reduce((s, v) => s + v.montant, 0);
    return {
      total,
      interetsEconomises: sans.totalInterets - avec.totalInterets,
      moisGagnes: avec.nonTermine || sans.nonTermine ? null : sans.duree - avec.duree,
      finAvec: avec.fin, finSans: sans.fin,
    };
  }

  // Paiement prévu d'une dette pour un mois du plan (0 si soldée ou hors plan).
  function prevuDuMois(sim, mois) {
    const m = sim.mois.find((x) => x.mois === mois);
    if (!m) return {};
    return Object.fromEntries(Object.entries(m.lignes).map(([id, l]) => [id, l.paye]));
  }

  // ---------- Suivi réel (pointage) ----------
  // paiements : [{ id, mois, detteId, montant }]. Rejoue les soldes avec les paiements réellement faits.
  // Rend, pour chaque mois de `debut` à `jusqua` inclus : soldes par dette, total, payé, intérêts.
  function suiviReel(dettes, paiements, debut, jusqua) {
    const solde = new Map(dettes.map((d) => [d.id, Math.max(0, d.capital | 0)]));
    const out = [];
    const n = ecartMois(debut, jusqua);
    for (let i = 0; i <= n; i++) {
      const mois = ajoutMois(debut, i);
      let paye = 0, interets = 0;
      const soldes = {};
      for (const d of dettes) {
        let s = solde.get(d.id);
        const it = interetsMois(s, d.taux);
        s += it; interets += it;
        const p = paiements.filter((x) => x.mois === mois && x.detteId === d.id).reduce((t, x) => t + (x.montant | 0), 0);
        s = Math.max(0, s - p);
        paye += p;
        solde.set(d.id, s);
        soldes[d.id] = s;
      }
      out.push({ mois, soldes, total: Object.values(soldes).reduce((a, b) => a + b, 0), paye, interets });
    }
    return out;
  }

  // Dette « pointée » pour un mois : au moins une ligne de paiement (même à 0 €, « pas payé »).
  const estPointe = (paiements, mois, detteId) => paiements.some((p) => p.mois === mois && p.detteId === detteId);

  // Dernier mois entièrement pointé depuis le début du plan (toutes les dettes prévues ce mois-là), ou null.
  function dernierMoisPointe(sim, paiements) {
    let dernier = null;
    for (const m of sim.mois) {
      const ids = Object.keys(m.lignes).filter((id) => m.lignes[id].paye > 0);
      if (!ids.length || !ids.every((id) => estPointe(paiements, m.mois, id))) break;
      dernier = m.mois;
    }
    return dernier;
  }

  // Mois passés (avant `courant`) du plan qui ont encore des paiements prévus non pointés.
  function moisAPointer(sim, paiements, courant) {
    return sim.mois.filter((m) => m.mois < courant).map((m) => ({
      mois: m.mois,
      dettes: Object.keys(m.lignes).filter((id) => m.lignes[id].paye > 0 && !estPointe(paiements, m.mois, id)),
    })).filter((x) => x.dettes.length);
  }

  // Écart au plan, mois par mois, jusqu'à `jusqua` inclus : payé contre prévu, solde réel contre solde prévu.
  function ecartPlan(dettes, sim, paiements, jusqua) {
    if (!sim.ok || !sim.mois.length || jusqua < sim.debut) return [];
    const reel = suiviReel(dettes, paiements, sim.debut, jusqua);
    let cumulPrevu = 0, cumulPaye = 0;
    return reel.map((r, i) => {
      const m = sim.mois[i];
      const prevu = m ? m.paye : 0;
      const soldePrevu = m ? m.totalSolde : 0;
      cumulPrevu += prevu; cumulPaye += r.paye;
      return { mois: r.mois, prevu, paye: r.paye, ecart: r.paye - prevu, cumulEcart: cumulPaye - cumulPrevu, soldePrevu, soldeReel: r.total, avance: soldePrevu - r.total };
    });
  }

  // Recale le plan sur les soldes réels : nouveau départ le mois suivant `jusqua`, capitaux = soldes réels.
  // Rend un nouvel état (les paiements et versements passés sont gardés comme historique).
  function recaler(etat, jusqua) {
    const e = JSON.parse(JSON.stringify(etat));
    const reel = suiviReel(e.dettes, e.paiements, e.debut, jusqua);
    const fin = reel[reel.length - 1];
    if (!fin) return e;
    for (const d of e.dettes) d.capital = fin.soldes[d.id] ?? d.capital;
    e.recalages = [...(e.recalages || []), { le: ajoutMois(jusqua, 1), ancienDebut: etat.debut }];
    e.debut = ajoutMois(jusqua, 1);
    return e;
  }

  // ---------- Export ----------
  const csvNombre = (c) => (c / 100).toFixed(2).replace('.', ',');
  const csvTexte = (s) => (/[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  function csvEcheancier(sim, dettes) {
    const nom = new Map(dettes.map((d) => [d.id, d.nom]));
    const lignes = [['Mois', 'Dette', 'Solde de début', 'Intérêts', 'Paiement', 'dont versement exceptionnel', 'Capital remboursé', 'Solde de fin'].join(';')];
    for (const m of sim.mois) {
      for (const [id, l] of Object.entries(m.lignes)) {
        lignes.push([m.mois, csvTexte(nom.get(id) || id), csvNombre(l.avant), csvNombre(l.interet), csvNombre(l.paye), csvNombre(l.extra), csvNombre(l.capital), csvNombre(l.solde)].join(';'));
      }
    }
    return lignes.join('\r\n');
  }

  // ---------- État ----------
  const etatVide = () => ({ version: 1, prenom: '', debut: null, budget: 0, methode: 'boule', ordre: [], dettes: [], versements: [], paiements: [], recalages: [] });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const cent = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
    return {
      ...v, ...d,
      prenom: typeof d.prenom === 'string' ? d.prenom : '',
      debut: estMois(d.debut) ? d.debut : null,
      budget: cent(d.budget),
      methode: [...METHODES].includes(d.methode) ? d.methode : 'boule',
      ordre: tab(d.ordre).filter((x) => typeof x === 'string'),
      dettes: tab(d.dettes).filter((x) => x && x.id).map((x) => ({
        type: 'autre', nom: 'Dette', note: '', ...x,
        capital: cent(x.capital), mensualite: cent(x.mensualite), taux: lireTaux(x.taux) ?? 0,
      })),
      versements: tab(d.versements).filter((x) => x && x.id && estMois(x.mois)).map((x) => ({ detteId: null, note: '', ...x, montant: cent(x.montant) })),
      paiements: tab(d.paiements).filter((x) => x && x.id && estMois(x.mois) && x.detteId).map((x) => ({ ...x, montant: cent(x.montant) })),
      recalages: tab(d.recalages),
    };
  }

  racine.DTT = {
    METHODES, MAX_MOIS,
    versCentimes, euros, eurosRonds, versSaisie, lireTaux, tauxTexte,
    moisDe, ajoutMois, ecartMois, estMois, dureeTexte,
    interetsMois, couvreInterets, totalMinimums, ordrePriorite,
    simuler, comparer, effetVersements, prevuDuMois,
    suiviReel, estPointe, dernierMoisPointe, moisAPointer, ecartPlan, recaler,
    csvEcheancier, etatVide, normaliser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
