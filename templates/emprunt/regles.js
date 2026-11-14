// Capacité d'emprunt et comparateur de prêts QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CPT) et par les tests Node (vm).
// Montants en centimes entiers, taux en pour cent par an (3.45 = 3,45 %), durées en mois.
// Mêmes formules que le simulateur leasing (templates/leasing/regles.js) : annuité, capital restant dû.
(function (racine) {
  'use strict';

  // Couleurs des offres, dans cet ordre fixe (palette validée par le script du skill dataviz,
  // reprise du simulateur leasing ; complétée par la légende, les noms et les tableaux).
  const COULEURS = ['#2F6DB5', '#C2502F', '#1E9467', '#C9A000', '#7A4FB8'];
  const MIN_OFFRES = 2, MAX_OFFRES = COULEURS.length;
  const DUREE_MAX_ANS = 35;
  const MAX_EMPRUNTEURS = 2;

  // ---------- Saisie et affichage ----------
  const deux = (n) => String(n).padStart(2, '0');
  // « 1 234,56 », « 1234.5 € » → centimes entiers ; null si vide ou illisible.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // « 3,45 », « 3.45 % » → 3.45 ; borné à 0–100, trois décimales.
  function lireTaux(saisie) {
    const s = String(saisie ?? '').replace(/[\s  %]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,3})?$/.test(s)) return null;
    const n = Number(s);
    return n <= 100 ? Math.round(n * 1000) / 1000 : null;
  }
  function lireEntier(saisie, min, max) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '');
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= min && n <= max ? n : null;
  }
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function euros(c, { centimes = true } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < -0.5;
    const n = Math.abs(Math.round(c));
    if (!centimes) return `${neg ? '−' : ''}${milliers(Math.round(n / 100))} €`;
    return `${neg ? '−' : ''}${milliers(Math.floor(n / 100))},${deux(n % 100)} €`;
  }
  const pct = (t, dec = 2) => (t === null || t === undefined || Number.isNaN(t) ? '–' : `${String(Math.round(t * 10 ** dec) / 10 ** dec).replace('.', ',')} %`);
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)));
  const saisieTaux = (t) => (t === null || t === undefined ? '' : String(t).replace('.', ','));
  function duree(mois) {
    if (!(mois > 0)) return '–';
    const a = Math.floor(mois / 12), m = mois % 12;
    if (!a) return `${mois} mois`;
    return `${a} an${a > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`;
  }

  // ---------- Formules financières ----------
  // Mensualité hors assurance d'un crédit amortissable : M = C × r / (1 − (1 + r)^−n), r = taux / 12.
  function mensualite(capital, tauxAnnuel, n) {
    if (!(capital > 0) || !(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital / n);
    return Math.round((capital * r) / (1 - (1 + r) ** -n));
  }
  // Coefficient d'annuité (mensualité pour 1 centime emprunté).
  function coefAnnuite(tauxAnnuel, n) {
    if (!(n > 0)) return 0;
    const r = (tauxAnnuel || 0) / 1200;
    return r ? r / (1 - (1 + r) ** -n) : 1 / n;
  }
  // Capital restant dû après k mensualités (mensualité exacte, non arrondie).
  function capitalRestant(capital, tauxAnnuel, n, k) {
    if (!(capital > 0) || k >= n) return 0;
    if (k <= 0) return capital;
    const r = (tauxAnnuel || 0) / 1200;
    if (!r) return Math.round(capital * (1 - k / n));
    const m = (capital * r) / (1 - (1 + r) ** -n);
    return Math.max(0, Math.round(capital * (1 + r) ** k - (m * ((1 + r) ** k - 1)) / r));
  }
  // Cotisation mensuelle d'assurance emprunteur : taux annuel × base × quotité / 12.
  const assuranceMois = (base, tauxAss, quotite = 100) => (base > 0 && tauxAss > 0 ? Math.round((base * tauxAss * (quotite || 0)) / 120000) : 0);

  // Capital empruntable pour une mensualité donnée (assurance comprise, comptée sur le capital initial).
  function capitalPour(mensu, tauxAnnuel, n, tauxAss = 0, quotite = 100) {
    if (!(mensu > 0) || !(n > 0)) return 0;
    const k = coefAnnuite(tauxAnnuel, n) + ((tauxAss || 0) * (quotite || 0)) / 120000;
    return Math.max(0, Math.floor(mensu / k / 100) * 100); // arrondi à l'euro inférieur
  }

  // ---------- Profil et capacité ----------
  // Revenus retenus : revenus nets mensuels des emprunteurs + autres revenus + loyers × pondération.
  function revenus(profil) {
    const e = (profil.emprunteurs || []).reduce((s, x) => s + (x.revenus || 0) + (x.autres || 0), 0);
    return e + Math.round(((profil.loyers || 0) * (profil.ponderationLoyers ?? 100)) / 100);
  }
  const chargesCredits = (profil) => (profil.credits || []).reduce((s, c) => s + (c.mensualite || 0), 0);
  const chargesRetenues = (profil) => chargesCredits(profil) + (profil.autresCharges || 0);

  // Capacité : mensualité maximale (taux d'effort saisi) et montant empruntable aux conditions saisies.
  function capacite(profil, hyp = {}) {
    const rev = revenus(profil);
    const charges = chargesRetenues(profil);
    const max = profil.tauxEffortMax ?? 35;
    const effortActuel = rev > 0 ? (charges / rev) * 100 : null;
    const mensualiteMax = Math.max(0, Math.floor((rev * max) / 100) - charges);
    const taux = hyp.taux ?? profil.tauxSimulation;
    const n = hyp.dureeMois ?? profil.dureeSimulation;
    const tauxAss = hyp.tauxAssurance ?? profil.assuranceSimulation ?? 0;
    const quotite = hyp.quotite ?? profil.quotite ?? 100;
    const complet = rev > 0 && taux !== null && taux !== undefined && n > 0;
    const capital = complet ? capitalPour(mensualiteMax, taux, n, tauxAss, quotite) : null;
    const horsAss = capital ? mensualite(capital, taux, n) : 0;
    const ass = capital ? assuranceMois(capital, tauxAss, quotite) : 0;
    const resteAVivre = rev - charges - mensualiteMax;
    const personnes = Math.max(1, profil.personnes || 1);
    return {
      revenus: rev, charges, effortActuel, tauxEffortMax: max, mensualiteMax, complet, capital,
      mensualiteHorsAss: horsAss, assurance: ass, mensualiteTotale: horsAss + ass,
      resteAVivre, resteParPersonne: Math.round(resteAVivre / personnes), personnes,
      sousSeuil: profil.resteAVivreMin > 0 ? resteAVivre / personnes < profil.resteAVivreMin : false,
      depasseDejaMax: effortActuel !== null && effortActuel >= max,
    };
  }
  // Montant empruntable pour plusieurs durées (années), aux mêmes taux.
  function capaciteParDuree(profil, annees) {
    return annees.map((a) => ({ ans: a, ...capacite(profil, { dureeMois: a * 12 }) }));
  }

  // ---------- Projet ----------
  function fraisNotaire(projet, base = {}) {
    if (projet.notaireMode === 'saisi') return projet.notaireMontant || 0;
    const pctN = projet.notairePct ?? base[projet.type] ?? 0;
    return Math.round(((projet.prix || 0) * pctN) / 100);
  }
  function budget(projet, base = {}) {
    const notaire = fraisNotaire(projet, base);
    const postes = [
      ['prix', 'Prix du bien', projet.prix || 0],
      ['notaire', projet.notaireMode === 'saisi' ? 'Frais de notaire (montant saisi)' : `Frais de notaire estimés (${pct(projet.notairePct ?? base[projet.type] ?? 0, 1)} du prix, hypothèse)`, notaire],
      ['travaux', 'Travaux', projet.travaux || 0],
      ['autres', 'Autres frais (agence, mobilier, déménagement…)', projet.autresFrais || 0],
    ];
    const total = postes.reduce((s, p) => s + p[2], 0);
    const apport = projet.apport || 0;
    const besoin = Math.max(0, total - apport);
    return { postes, notaire, total, apport, besoin, partApport: total > 0 ? (apport / total) * 100 : 0, apportCouvreFrais: apport >= notaire + (projet.autresFrais || 0), excedentApport: Math.max(0, apport - total) };
  }

  // ---------- Offres de prêt ----------
  const fraisOffre = (o) => (o.fraisDossier || 0) + (o.garantie || 0) + (o.courtage || 0);
  function manques(o) {
    const m = [];
    if (!(o.montant > 0)) m.push('le montant');
    if (o.taux === null || o.taux === undefined) m.push('le taux');
    if (!(o.dureeMois > 0)) m.push('la durée');
    if (o.tauxAssurance === null || o.tauxAssurance === undefined) m.push('le taux d\'assurance (0 si aucune)');
    return m;
  }

  // Échéancier mois par mois. Options : remboursement anticipé { mois, montant, mode: 'duree' | 'mensualite' }
  // versé après l'échéance du mois indiqué. L'assurance sur capital initial reste calculée sur le capital
  // emprunté (cotisation inchangée jusqu'à la fin du prêt) ; sur capital restant dû, elle suit le capital.
  function echeancier(o, opts = {}) {
    const C = o.montant || 0;
    let n = o.dureeMois || 0;
    if (!(C > 0) || !(n > 0)) return { lignes: [], totaux: { interets: 0, assurance: 0, capital: 0, mensualites: 0 }, dureeMois: 0 };
    const r = (o.taux || 0) / 1200;
    let m = mensualite(C, o.taux, n);
    const ra = opts.anticipe && opts.anticipe.montant > 0 && opts.anticipe.mois >= 1 && opts.anticipe.mois < n ? opts.anticipe : null;
    const lignes = [];
    let crd = C, interets = 0, assurance = 0, k = 0;
    while (crd > 0 && k < 1200) {
      k++;
      const debut = crd;
      const i = Math.round(crd * r);
      let principal = m - i;
      if (principal >= crd || k >= n) principal = crd; // dernière échéance : solde exact
      if (principal < 0) principal = 0;
      const ass = o.assuranceMode === 'crd' ? assuranceMois(debut, o.tauxAssurance, o.quotite) : assuranceMois(C, o.tauxAssurance, o.quotite);
      crd -= principal;
      let verse = 0;
      if (ra && k === ra.mois && crd > 0) {
        verse = Math.min(crd, ra.montant);
        crd -= verse;
        if (ra.mode === 'mensualite' && crd > 0) m = mensualite(crd, o.taux, n - k);
        if (ra.mode === 'duree' && crd > 0) {
          // Mensualité inchangée : nombre de mois restant pour solder le capital.
          n = k + (r ? Math.ceil(-Math.log(1 - (crd * r) / m) / Math.log(1 + r)) : Math.ceil(crd / m));
        }
      }
      interets += i; assurance += ass;
      lignes.push({ mois: k, debut, interets: i, capital: principal, assurance: ass, echeance: principal + i, total: principal + i + ass, anticipe: verse, crd });
    }
    const mensualites = lignes.reduce((s, l) => s + l.echeance, 0);
    return { lignes, totaux: { interets, assurance, capital: C, mensualites }, dureeMois: lignes.length, mensualiteInitiale: lignes[0]?.echeance ?? 0, mensualiteFinale: m };
  }

  // Lignes annuelles (année de prêt 1, 2…) d'un échéancier.
  function parAnnee(lignes) {
    const res = [];
    for (const l of lignes) {
      const a = Math.ceil(l.mois / 12);
      if (!res[a - 1]) res[a - 1] = { annee: a, capital: 0, interets: 0, assurance: 0, anticipe: 0, crd: 0 };
      const x = res[a - 1];
      x.capital += l.capital; x.interets += l.interets; x.assurance += l.assurance; x.anticipe += l.anticipe; x.crd = l.crd;
    }
    return res;
  }

  // TAEG approché : taux actuariel annuel i tel que montant − frais = Σ (mensualité + assurance)_k / (1 + i)^(k/12).
  // Estimation (le TAEG de l'offre de prêt fait foi) ; null si incalculable.
  function taeg(o, lignes) {
    const recu = (o.montant || 0) - fraisOffre(o);
    if (!(recu > 0) || !lignes.length) return null;
    const flux = lignes.map((l) => l.total + l.anticipe);
    const va = (t) => flux.reduce((s, f, j) => s + f / (1 + t) ** (j + 1), 0) - recu;
    let lo = 0, hi = 0.05; // taux mensuel
    if (va(lo) < 0) return 0;
    while (va(hi) > 0 && hi < 1) hi *= 2;
    for (let it = 0; it < 200; it++) { const mi = (lo + hi) / 2; if (va(mi) > 0) lo = mi; else hi = mi; }
    return ((1 + (lo + hi) / 2) ** 12 - 1) * 100;
  }

  // Calcul complet d'une offre ; profil facultatif (taux d'effort avec cette mensualité).
  function calculerOffre(o, profil = null) {
    const manque = manques(o);
    const r = { id: o.id, complet: !manque.length, manque };
    if (manque.length) return r;
    const e = echeancier(o);
    const frais = fraisOffre(o);
    const assurance1 = e.lignes[0].assurance;
    const mensualiteHors = e.mensualiteInitiale;
    const coutTotal = e.totaux.interets + e.totaux.assurance + frais;
    const t = taeg(o, e.lignes);
    let effort = null;
    if (profil) { const rev = revenus(profil); effort = rev > 0 ? ((chargesRetenues(profil) + mensualiteHors + assurance1) / rev) * 100 : null; }
    return Object.assign(r, {
      montant: o.montant, dureeMois: o.dureeMois, mensualiteHors, assurance1, mensualiteTotale: mensualiteHors + assurance1,
      interets: e.totaux.interets, assurance: e.totaux.assurance, frais, fraisDossier: o.fraisDossier || 0, garantie: o.garantie || 0, courtage: o.courtage || 0,
      coutTotal, coutParMois: Math.round(coutTotal / o.dureeMois), taeg: t, effort, totalRembourse: o.montant + coutTotal,
    });
  }

  // Toutes les offres complètes, de la moins chère (coût total du crédit) à la plus chère.
  function comparer(offres, profil = null) {
    const tous = offres.map((o) => calculerOffre(o, profil));
    const complets = tous.filter((x) => x.complet).sort((a, b) => a.coutTotal - b.coutTotal);
    const min = complets[0]?.coutTotal ?? null;
    complets.forEach((x, i) => { x.rang = i + 1; x.ecart = x.coutTotal - min; });
    const durees = new Set(complets.map((x) => x.dureeMois));
    const montants = new Set(complets.map((x) => x.montant));
    return { tous, complets, moinsCher: complets[0] || null, incomplets: tous.filter((x) => !x.complet), memesConditions: durees.size <= 1 && montants.size <= 1 };
  }

  // Alertes d'une offre au regard du profil (seuils saisis : taux d'effort et durée maximale).
  function alertes(o, x, profil) {
    const l = [];
    if (!x.complet) return l;
    const max = profil?.tauxEffortMax ?? null;
    if (max !== null && x.effort !== null && x.effort > max) l.push({ niveau: 'alerte', texte: `Taux d'effort de ${pct(x.effort, 1)} avec cette offre, au-dessus de ton seuil de ${pct(max, 0)}.` });
    if (profil?.dureeMaxAns && o.dureeMois > profil.dureeMaxAns * 12) l.push({ niveau: 'alerte', texte: `Durée de ${duree(o.dureeMois)}, au-delà de ton seuil de ${profil.dureeMaxAns} ans.` });
    if (o.assuranceMode === 'initial' && o.tauxAssurance > 0) l.push({ niveau: 'info', texte: 'Assurance sur le capital initial : la cotisation reste la même jusqu\'à la fin.' });
    if (o.tauxAssurance === 0) l.push({ niveau: 'info', texte: 'Aucune assurance comptée : la banque l\'exige en général pour un crédit immobilier.' });
    return l;
  }

  // ---------- Remboursement anticipé ----------
  // Indemnités : plafond légal (le plus faible de « moisInterets » mois d'intérêts sur le montant remboursé
  // au taux du prêt et de « pctCrd » % du capital restant dû avant le remboursement) ou montant saisi.
  function indemnites(o, montant, crdAvant, ira = {}) {
    if (ira.mode === 'saisi') return ira.montant || 0;
    if (ira.mode === 'aucune') return 0;
    const mois = ira.moisInterets ?? 6, p = ira.pctCrd ?? 3;
    const a = Math.round((montant * (o.taux || 0) * mois) / 1200);
    const b = Math.round((crdAvant * p) / 100);
    return Math.min(a, b);
  }
  function remboursementAnticipe(o, ra) {
    if (manques(o).length) return null;
    const base = echeancier(o);
    if (!(ra.mois >= 1 && ra.mois < base.dureeMois) || !(ra.montant > 0)) return { valide: false, base };
    const crdAvant = base.lignes[ra.mois - 1].crd;
    const montant = Math.min(ra.montant, crdAvant);
    const apres = echeancier(o, { anticipe: { mois: ra.mois, montant, mode: ra.mode } });
    const ira = indemnites(o, montant, crdAvant, ra.ira || {});
    const ecoInterets = base.totaux.interets - apres.totaux.interets;
    const ecoAssurance = base.totaux.assurance - apres.totaux.assurance;
    return {
      valide: true, base, apres, montant, crdAvant, ira, ecoInterets, ecoAssurance,
      gainNet: ecoInterets + ecoAssurance - ira,
      moisGagnes: base.dureeMois - apres.dureeMois,
      nouvelleMensualite: apres.mensualiteFinale,
      ancienneMensualite: base.mensualiteInitiale,
      solde: montant >= crdAvant,
    };
  }

  // ---------- Identifiants et normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const centimes = (v) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== null && v !== '' && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const tauxOuNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(100, Math.max(0, Number(v))));

  function normaliserOffre(x, i = 0, utilisees = []) {
    const o = x && typeof x === 'object' ? x : {};
    let couleur = entier(o.couleur, 0, COULEURS.length - 1, null);
    if (couleur !== null && utilisees.includes(couleur)) couleur = null;
    if (couleur === null) couleur = [...COULEURS.keys()].find((k) => !utilisees.includes(k)) ?? (i % COULEURS.length);
    return {
      id: String(o.id || nouvelId()), couleur,
      nom: texte(o.nom, 60) || `Offre ${String.fromCharCode(65 + i)}`,
      montant: centimes(o.montant),
      taux: tauxOuNull(o.taux),
      dureeMois: entier(o.dureeMois, 0, DUREE_MAX_ANS * 12, 0),
      tauxAssurance: tauxOuNull(o.tauxAssurance),
      assuranceMode: o.assuranceMode === 'crd' ? 'crd' : 'initial',
      quotite: entier(o.quotite, 0, 200, 100),
      fraisDossier: centimes(o.fraisDossier) ?? 0,
      garantieType: ['caution', 'hypotheque', 'ppd', 'aucune'].includes(o.garantieType) ? o.garantieType : 'caution',
      garantie: centimes(o.garantie) ?? 0,
      courtage: centimes(o.courtage) ?? 0,
      note: texte(o.note, 300),
    };
  }

  function normaliserProfil(x, defauts = {}) {
    const p = x && typeof x === 'object' ? x : {};
    const emp = (Array.isArray(p.emprunteurs) ? p.emprunteurs : [{}]).slice(0, MAX_EMPRUNTEURS).map((e, i) => ({
      nom: texte(e?.nom, 40) || `Emprunteur ${i + 1}`,
      revenus: centimes(e?.revenus) ?? 0,
      autres: centimes(e?.autres) ?? 0,
    }));
    if (!emp.length) emp.push({ nom: 'Emprunteur 1', revenus: 0, autres: 0 });
    const credits = (Array.isArray(p.credits) ? p.credits : []).slice(0, 10).map((c) => ({ id: String(c?.id || nouvelId()), nom: texte(c?.nom, 60) || 'Crédit en cours', mensualite: centimes(c?.mensualite) ?? 0 }));
    return {
      emprunteurs: emp,
      loyers: centimes(p.loyers) ?? 0,
      ponderationLoyers: entier(p.ponderationLoyers, 0, 100, defauts.ponderationLoyers ?? 70),
      credits,
      autresCharges: centimes(p.autresCharges) ?? 0,
      personnes: entier(p.personnes, 1, 12, emp.length),
      resteAVivreMin: centimes(p.resteAVivreMin) ?? 0,
      tauxEffortMax: tauxOuNull(p.tauxEffortMax) ?? defauts.tauxEffort ?? 35,
      dureeMaxAns: entier(p.dureeMaxAns, 1, DUREE_MAX_ANS, defauts.dureeAns ?? 25),
      tauxSimulation: tauxOuNull(p.tauxSimulation),
      dureeSimulation: entier(p.dureeSimulation, 12, DUREE_MAX_ANS * 12, (defauts.dureeAns ?? 25) * 12),
      assuranceSimulation: tauxOuNull(p.assuranceSimulation) ?? 0,
      quotite: entier(p.quotite, 0, 200, 100),
    };
  }

  function normaliserProjet(x, notaireBase = {}) {
    const p = x && typeof x === 'object' ? x : {};
    const type = ['ancien', 'neuf', 'terrain'].includes(p.type) ? p.type : 'ancien';
    return {
      nom: texte(p.nom, 60) || 'Mon projet',
      usage: p.usage === 'locatif' ? 'locatif' : 'residence',
      type,
      prix: centimes(p.prix) ?? 0,
      notaireMode: p.notaireMode === 'saisi' ? 'saisi' : 'estime',
      notairePct: tauxOuNull(p.notairePct) ?? notaireBase[type === 'terrain' ? 'ancien' : type] ?? null,
      notaireMontant: centimes(p.notaireMontant) ?? 0,
      travaux: centimes(p.travaux) ?? 0,
      autresFrais: centimes(p.autresFrais) ?? 0,
      apport: centimes(p.apport) ?? 0,
    };
  }

  function normaliserAnticipe(x, offres = []) {
    const a = x && typeof x === 'object' ? x : {};
    const ira = a.ira && typeof a.ira === 'object' ? a.ira : {};
    return {
      offreId: offres.some((o) => o.id === a.offreId) ? a.offreId : (offres[0]?.id ?? null),
      mois: entier(a.mois, 1, DUREE_MAX_ANS * 12, 60),
      montant: centimes(a.montant) ?? 1000000,
      mode: a.mode === 'mensualite' ? 'mensualite' : 'duree',
      ira: {
        mode: ['plafond', 'saisi', 'aucune'].includes(ira.mode) ? ira.mode : 'plafond',
        montant: centimes(ira.montant) ?? 0,
        moisInterets: entier(ira.moisInterets, 0, 24, 6),
        pctCrd: tauxOuNull(ira.pctCrd) ?? 3,
      },
    };
  }

  function etatVide() { return { version: 1, profil: null, projet: null, offres: [], anticipe: null, questions: {} }; }

  function normaliser(d, base = {}) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const offres = [];
    for (const [i, o] of (Array.isArray(d.offres) ? d.offres : []).slice(0, MAX_OFFRES).entries()) offres.push(normaliserOffre(o, i, offres.map((y) => y.couleur)));
    const questions = {};
    if (d.questions && typeof d.questions === 'object') for (const [k, val] of Object.entries(d.questions)) if (val) questions[texte(k, 40)] = true;
    return {
      ...v, ...d, version: 1,
      profil: d.profil ? normaliserProfil(d.profil, { ...(base.hcsf || {}), ...(base.defauts || {}) }) : null,
      projet: d.projet ? normaliserProjet(d.projet, base.notaire || {}) : null,
      offres,
      anticipe: normaliserAnticipe(d.anticipe, offres),
      questions,
    };
  }

  // Nouvelle offre : montant = besoin de financement du projet, durée = celle de la simulation.
  function offreDefaut(etat, utilisees = []) {
    const besoin = etat.projet ? budget(etat.projet).besoin : null;
    return normaliserOffre({ montant: besoin || null, dureeMois: etat.profil?.dureeSimulation || 300, taux: null, tauxAssurance: null, quotite: etat.profil?.emprunteurs?.length > 1 ? 100 : 100 }, utilisees.length, utilisees);
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function csvEcheancier(o, e) {
    const l = [['Mois', 'Capital restant dû au début', 'Intérêts', 'Capital amorti', 'Assurance', 'Échéance assurance comprise', 'Remboursement anticipé', 'Capital restant dû à la fin']];
    for (const x of e.lignes) l.push([x.mois, nombreCsv(x.debut), nombreCsv(x.interets), nombreCsv(x.capital), nombreCsv(x.assurance), nombreCsv(x.total), x.anticipe ? nombreCsv(x.anticipe) : '', nombreCsv(x.crd)]);
    l.push([]);
    l.push(['Offre', `${o.nom} ; ${nombreCsv(o.montant)} € ; ${String(o.taux).replace('.', ',')} % ; ${o.dureeMois} mois ; assurance ${String(o.tauxAssurance).replace('.', ',')} % sur ${o.assuranceMode === 'crd' ? 'capital restant dû' : 'capital initial'}`]);
    l.push(['Totaux', '', nombreCsv(e.totaux.interets), nombreCsv(e.totaux.capital), nombreCsv(e.totaux.assurance)]);
    return csv(l);
  }
  function csvComparaison(offres, profil) {
    const c = comparer(offres, profil);
    const l = [['', ...offres.map((o) => o.nom)]];
    const ligne = (lib, f) => l.push([lib, ...c.tous.map((x) => (x.complet ? f(x) : 'à compléter'))]);
    const of = (x) => offres.find((o) => o.id === x.id);
    ligne('Montant emprunté', (x) => nombreCsv(x.montant));
    ligne('Taux nominal (%)', (x) => String(of(x).taux).replace('.', ','));
    ligne('Durée (mois)', (x) => x.dureeMois);
    ligne('Mensualité hors assurance', (x) => nombreCsv(x.mensualiteHors));
    ligne('Assurance (1er mois)', (x) => nombreCsv(x.assurance1));
    ligne('Mensualité assurance comprise', (x) => nombreCsv(x.mensualiteTotale));
    ligne('Intérêts', (x) => nombreCsv(x.interets));
    ligne('Assurance totale', (x) => nombreCsv(x.assurance));
    ligne('Frais de dossier', (x) => nombreCsv(x.fraisDossier));
    ligne('Garantie', (x) => nombreCsv(x.garantie));
    ligne('Courtage', (x) => nombreCsv(x.courtage));
    ligne('Coût total du crédit', (x) => nombreCsv(x.coutTotal));
    ligne('TAEG approché (%, estimation)', (x) => (x.taeg === null ? '' : x.taeg.toFixed(2).replace('.', ',')));
    ligne('Taux d\'effort (%)', (x) => (x.effort === null ? '' : x.effort.toFixed(1).replace('.', ',')));
    return csv(l);
  }

  racine.CPT = {
    COULEURS, MIN_OFFRES, MAX_OFFRES, DUREE_MAX_ANS, MAX_EMPRUNTEURS,
    lireMontant, lireTaux, lireEntier, euros, pct, duree, milliers, saisieMontant, saisieTaux,
    mensualite, coefAnnuite, capitalRestant, assuranceMois, capitalPour,
    revenus, chargesCredits, chargesRetenues, capacite, capaciteParDuree,
    fraisNotaire, budget, fraisOffre, manques, echeancier, parAnnee, taeg, calculerOffre, comparer, alertes,
    indemnites, remboursementAnticipe,
    nouvelId, normaliserOffre, normaliserProfil, normaliserProjet, normaliserAnticipe, normaliser, etatVide, offreDefaut,
    csvEcheancier, csvComparaison,
  };
})(typeof window !== 'undefined' ? window : globalThis);
