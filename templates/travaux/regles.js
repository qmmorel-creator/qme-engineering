// Règles métier du pilote de travaux maison : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/travaux.test.mjs).
// Toute fonction qui dépend du jour reçoit la date de référence en paramètre (auj).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Un an plus tard, le 29 février devient le 28 février.
  function unAnApres(s) {
    const [a, m, j] = s.split('-').map(Number);
    const fin = new Date(a + 1, m, 0).getDate();
    return `${a + 1}-${deux(m)}-${deux(Math.min(j, fin))}`;
  }

  // ---------- Montants (en euros, arrondis au centime) ----------
  const cent = (x) => Math.round((Number(x) || 0) * 100) / 100;
  const somme = (liste, f = (x) => x) => cent(liste.reduce((s, x) => s + (Number(f(x)) || 0), 0));
  const montant = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? cent(v) : null;
    const t = String(v ?? '').replace(/\s| |€/g, '').replace(',', '.');
    if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
    return cent(Number(t));
  };

  // Taux de TVA déduit des montants HT et TTC du devis (arrondi à 0,1 point).
  function tauxImplicite(ht, ttc) {
    if (!(ht > 0) || !(ttc >= 0)) return null;
    return Math.round((ttc / ht - 1) * 1000) / 10;
  }
  // Le taux correspond-il à l'un des taux connus (tolérance d'arrondi de 0,1 point) ?
  const tauxConnu = (t, taux) => t !== null && taux.some((x) => Math.abs(x - t) <= 0.1);

  // ---------- Comparateur de devis d'un poste ----------
  // Renvoie les devis triés par TTC croissant avec écart au moins cher et alertes.
  function comparer(devis, taux) {
    const valides = devis.filter((d) => d.ttc > 0);
    const min = valides.length ? Math.min(...valides.map((d) => d.ttc)) : null;
    return [...devis].sort((a, b) => (a.ttc || Infinity) - (b.ttc || Infinity)).map((d) => {
      const t = tauxImplicite(d.ht, d.ttc);
      const alertes = [];
      if (d.assurance === false) alertes.push('assurance');
      else if (d.assurance !== true) alertes.push('assurance-inconnue');
      if (t !== null && !tauxConnu(t, taux)) alertes.push('tva');
      if (d.ht > 0 && d.ttc > 0 && d.ttc < d.ht) alertes.push('montants');
      if (!String(d.inclus || '').trim()) alertes.push('inclus');
      return {
        ...d,
        taux: t,
        moinsCher: min !== null && d.ttc === min && valides.length > 1,
        ecart: min !== null && d.ttc > 0 ? cent(d.ttc - min) : null,
        ecartPct: min && d.ttc > 0 ? Math.round(((d.ttc - min) / min) * 1000) / 10 : null,
        alertes,
      };
    });
  }

  // ---------- Budget ----------
  function budgetPoste(poste, E) {
    const retenu = poste.retenuId ? E.devis.find((d) => d.id === poste.retenuId) : null;
    const imprevus = somme(E.imprevus.filter((i) => i.posteId === poste.id), (i) => i.montant);
    const prevu = cent(poste.budget);
    const engage = cent((retenu ? retenu.ttc : 0) + imprevus);
    const paye = somme(E.paiements.filter((p) => p.posteId === poste.id), (p) => p.montant);
    return {
      prevu, engage, paye, imprevus,
      devis: retenu ? cent(retenu.ttc) : 0,
      reste: cent(Math.max(0, engage - paye)),
      ecart: cent(engage - prevu),
      tropPaye: paye > engage + 0.005 && engage > 0,
      retenu: !!retenu,
    };
  }

  function budgetGlobal(E) {
    const postes = E.postes.map((p) => ({ poste: p, ...budgetPoste(p, E) }));
    const generaux = E.imprevus.filter((i) => !i.posteId || !E.postes.some((p) => p.id === i.posteId));
    const imprevusGeneraux = somme(generaux, (i) => i.montant);
    const prevu = somme(postes, (x) => x.prevu);
    const imprevusReels = cent(somme(postes, (x) => x.imprevus) + imprevusGeneraux);
    const engage = cent(somme(postes, (x) => x.engage) + imprevusGeneraux);
    const payeGeneral = somme(E.paiements.filter((p) => !p.posteId || !E.postes.some((x) => x.id === p.posteId)), (p) => p.montant);
    const paye = cent(somme(postes, (x) => x.paye) + payeGeneral);
    const pct = Number(E.reglages?.imprevus) || 0;
    const provision = cent(prevu * pct / 100);
    return {
      postes, prevu, engage, paye, provision, imprevusReels, imprevusGeneraux,
      reste: cent(Math.max(0, engage - paye)),
      enveloppe: cent(prevu + provision),
      consommation: provision > 0 ? Math.round((imprevusReels / provision) * 100) : null,
      depasse: engage > prevu + provision + 0.005,
      aChiffrer: postes.filter((x) => !x.retenu).length,
      // Écart engagé − prévu sur les seuls postes dont un devis est retenu (les autres ne sont pas chiffrés).
      ecartRetenus: somme(postes.filter((x) => x.retenu), (x) => x.ecart),
    };
  }

  // ---------- Planning ----------
  function etatIntervention(i, auj) {
    if (i.fin < auj) return 'terminee';
    if (i.debut <= auj) return 'en-cours';
    return 'a-venir';
  }
  const seChevauchent = (a, b) => a.debut <= b.fin && b.debut <= a.fin;
  const joursCommuns = (a, b) => (seChevauchent(a, b) ? ecart(a.debut > b.debut ? a.debut : b.debut, a.fin < b.fin ? a.fin : b.fin) + 1 : 0);

  // pieceDe(i) : identifiant de la pièce de l'intervention (null = tout le logement, qui touche
  // toutes les pièces). rangDe(i), facultatif : rang du poste dans l'ordre habituel ; deux postes de
  // même rang (plomberie et électricité) avancent ensemble sans alerte de pièce.
  // Renvoie toutes les paires qui se chevauchent, typées.
  function chevauchements(interventions, pieceDe, rangDe) {
    const res = [];
    const l = [...interventions].sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin));
    for (let x = 0; x < l.length; x++) {
      for (let y = x + 1; y < l.length; y++) {
        const a = l[x], b = l[y];
        if (b.debut > a.fin) break; // trié par début : plus aucun chevauchement possible avec a
        if (!seChevauchent(a, b)) continue;
        const pa = pieceDe(a), pb = pieceDe(b);
        let type = 'parallele';
        if (a.artisanId && a.artisanId === b.artisanId) type = 'meme-artisan';
        else if ((pa === null || pb === null || pa === pb) && !(rangDe && rangDe(a) === rangDe(b))) type = 'meme-piece';
        res.push({ a: a.id, b: b.id, type, jours: joursCommuns(a, b) });
      }
    }
    return res;
  }

  // Ordre inhabituel : dans une même pièce (ou si l'une couvre tout le logement), un poste de rang
  // supérieur (ex. peinture) commence avant le début d'un poste de rang inférieur (ex. plâtrerie).
  function ordreInhabituel(interventions, rangDe, pieceDe) {
    const res = [];
    for (const a of interventions) {
      for (const b of interventions) {
        if (a === b) continue;
        const ra = rangDe(a), rb = rangDe(b);
        if (!(ra < rb)) continue; // a doit normalement précéder b
        const pa = pieceDe(a), pb = pieceDe(b);
        if (!(pa === null || pb === null || pa === pb)) continue;
        if (b.debut < a.debut) res.push({ avant: a.id, apres: b.id });
      }
    }
    return res;
  }

  // Bornes de la frise : du plus tôt au plus tard (au moins 7 jours).
  function bornes(interventions) {
    if (!interventions.length) return null;
    const debut = interventions.reduce((m, i) => (i.debut < m ? i.debut : m), interventions[0].debut);
    let fin = interventions.reduce((m, i) => (i.fin > m ? i.fin : m), interventions[0].fin);
    if (ecart(debut, fin) < 6) fin = ajout(debut, 6);
    return { debut, fin, jours: ecart(debut, fin) + 1 };
  }

  // Applique un modèle de planning à partir de la date de début.
  // Renvoie { pieces, postes, interventions } avec des identifiants fournis par uid().
  function appliquerModele(modele, debut, base, uid) {
    const pieces = modele.pieces.map((nom) => ({ id: uid(), nom }));
    const postes = [], interventions = [];
    let curseur = debut, precedent = null;
    modele.etapes.forEach((e) => {
      const type = base.postes.find((p) => p.code === e.code);
      const piece = e.piece === null || e.piece === undefined ? null : pieces[e.piece];
      const poste = { id: uid(), code: e.code, nom: type ? type.nom : e.code, pieceId: piece ? piece.id : null, budget: 0, retenuId: null, notes: '', reception: null };
      postes.push(poste);
      const d = e.avec && precedent ? precedent.debut : curseur;
      const i = { id: uid(), posteId: poste.id, artisanId: null, debut: d, fin: ajout(d, Math.max(1, e.duree) - 1), provisoire: true };
      interventions.push(i);
      const lendemain = ajout(i.fin, 1);
      curseur = lendemain > curseur ? lendemain : curseur;
      precedent = i;
    });
    return { pieces, postes, interventions };
  }

  // ---------- Réserves ----------
  function compteReserves(reserves) {
    const ouvertes = reserves.filter((r) => r.statut !== 'levee').length;
    return { total: reserves.length, ouvertes, levees: reserves.length - ouvertes };
  }
  // Garantie de parfait achèvement : un an à compter de la réception.
  function garantie(reception, auj) {
    if (!estDate(reception)) return null;
    const fin = unAnApres(reception);
    return { fin, restants: ecart(auj, fin), active: auj <= fin };
  }

  const plat = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, unAnApres,
    cent, somme, montant, tauxImplicite, tauxConnu, comparer,
    budgetPoste, budgetGlobal,
    etatIntervention, seChevauchent, joursCommuns, chevauchements, ordreInhabituel, bornes, appliquerModele,
    compteReserves, garantie, plat, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
