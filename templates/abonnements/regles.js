// Suivi des abonnements QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.ABN) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers).
(function (racine) {
  'use strict';

  // Pas de chaque périodicité : en jours (hebdo) ou en mois ; nombre de prélèvements par an.
  const PERIODES = {
    hebdo: { jours: 7, parAn: 52 },
    mensuel: { mois: 1, parAn: 12 },
    bimestriel: { mois: 2, parAn: 6 },
    trimestriel: { mois: 3, parAn: 4 },
    semestriel: { mois: 6, parAn: 2 },
    annuel: { mois: 12, parAn: 1 },
  };
  const STATUTS = ['actif', 'aResilier', 'resilie'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const joursDansMois = (annee, mois) => new Date(annee, mois, 0).getDate(); // mois de 1 à 12
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // Ajoute n mois en gardant le jour d'ancrage, ramené au dernier jour des mois trop courts
  // (31/01 → 28/02 → 31/03 : on revient au 31 dès que le mois le permet).
  function ajoutMois(s, n, jourAncre) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    const jour = Math.min(jourAncre ?? j, joursDansMois(an, mo));
    return `${an}-${deux(mo)}-${deux(jour)}`;
  }
  const moisDe = (s) => s.slice(0, 7);
  const ajoutMoisCle = (cle, n) => ajoutMois(`${cle}-01`, n).slice(0, 7);

  // ---------- Montants ----------
  // « 12,99 », « 12.99 € », « 1 234,5 », « 9 » → centimes ; null si vide, illisible ou négatif.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // 1299 → « 12,99 € » ; 120000 → « 1 200,00 € » (espace fine insécable) ; options : sans centimes.
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const ent = Math.floor(n / 100), dec = n % 100;
    const arrondi = centimes ? ent : Math.round(n / 100);
    const milliers = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const texte = centimes ? `${milliers},${deux(dec)}` : milliers;
    return `${neg ? '−' : signe ? '+' : ''}${texte} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${Math.floor(c / 100)},${deux(c % 100)}`);

  // ---------- Coûts ----------
  // Ce que je paie à chaque prélèvement : ma part saisie, sinon le montant divisé par le nombre de parts.
  function maPart(a) {
    if (a.montant === null || a.montant === undefined) return null;
    if (a.maPart !== null && a.maPart !== undefined) return Math.min(a.maPart, a.montant);
    return Math.round(a.montant / Math.max(1, a.parts || 1));
  }
  const parAn = (a) => (PERIODES[a.periodicite] || PERIODES.mensuel).parAn;
  function coutAnnuel(a) { const p = maPart(a); return p === null ? null : p * parAn(a); }
  function coutMensuel(a) { const c = coutAnnuel(a); return c === null ? null : Math.round(c / 12); }
  const estPartage = (a) => (a.parts || 1) > 1 || (a.maPart !== null && a.maPart !== undefined && a.montant !== null && a.maPart < a.montant);
  // Compte dans les dépenses en cours : actif ou à résilier (on paie encore).
  const compte = (a) => a.statut !== 'resilie';

  // ---------- Prélèvements ----------
  // k-ième prélèvement depuis la date de référence (k peut être négatif).
  function echeance(a, k) {
    const p = PERIODES[a.periodicite] || PERIODES.mensuel;
    if (p.jours) return ajout(a.debut, k * p.jours);
    return ajoutMois(a.debut, k * p.mois, Number(a.debut.slice(8, 10)));
  }
  // Plus petit rang k dont le prélèvement tombe le jour « depuis » ou après.
  function rangDepuis(a, depuis) {
    const p = PERIODES[a.periodicite] || PERIODES.mensuel;
    let k = p.jours ? Math.floor(ecart(a.debut, depuis) / p.jours) : Math.floor(((Number(depuis.slice(0, 4)) - Number(a.debut.slice(0, 4))) * 12 + Number(depuis.slice(5, 7)) - Number(a.debut.slice(5, 7))) / p.mois);
    while (echeance(a, k) < depuis) k++;
    while (echeance(a, k - 1) >= depuis) k--;
    return k;
  }
  // Un prélèvement a lieu à la date d s'il est au plus tôt à la date de référence (premier prélèvement)
  // et, pour un abonnement résilié, avant la date d'effet de la résiliation.
  const actifLe = (a, d) => d >= a.debut && !(a.statut === 'resilie' && (!a.resilieLe || d >= a.resilieLe));

  function prochainPrelevement(a, depuis) {
    if (!a.debut) return null;
    const d = a.debut >= depuis ? a.debut : echeance(a, rangDepuis(a, depuis));
    return actifLe(a, d) ? d : null;
  }

  function echeancesEntre(a, de, fin) {
    if (!a.debut || fin < de) return [];
    const liste = [];
    for (let k = rangDepuis(a, de < a.debut ? a.debut : de); ; k++) {
      const d = echeance(a, k);
      if (d > fin) break;
      if (actifLe(a, d)) liste.push(d);
      if (liste.length > 400) break;
    }
    return liste;
  }

  // ---------- Décisions : essai, engagement, renouvellement ----------
  // Chaque échéance qui engage donne une date limite « à décider avant le … » :
  //  essai : la date de fin d'essai (le premier prélèvement payant tombe ce jour-là) ;
  //  engagement : fin d'engagement moins le préavis ;
  //  renouvellement annuel ou semestriel sans engagement en cours : prochain prélèvement moins le préavis.
  // Niveau : « depasse » si la date limite est passée (l'échéance est encore à venir), « proche » si elle
  // tombe dans le délai d'alerte, sinon « plus-tard ».
  function decisions(a, auj, alerteJours = 30) {
    if (a.statut === 'resilie') return [];
    const pre = Math.max(0, Number(a.preavisJours) || 0);
    const liste = [];
    const niveau = (limite) => (limite < auj ? 'depasse' : ecart(auj, limite) <= alerteJours ? 'proche' : 'plus-tard');
    if (a.essaiFin && a.essaiFin >= auj) liste.push({ type: 'essai', date: a.essaiFin, limite: a.essaiFin });
    const engage = a.engagementFin && a.engagementFin >= auj;
    if (engage) liste.push({ type: 'engagement', date: a.engagementFin, limite: ajout(a.engagementFin, -pre) });
    if (!engage && (a.periodicite === 'annuel' || a.periodicite === 'semestriel')) {
      const p = prochainPrelevement(a, auj);
      if (p && !(a.essaiFin && a.essaiFin >= auj && p <= a.essaiFin)) liste.push({ type: 'renouvellement', date: p, limite: ajout(p, -pre) });
    }
    return liste.map((x) => ({ ...x, niveau: niveau(x.limite), joursRestants: ecart(auj, x.limite) })).sort((x, y) => x.limite.localeCompare(y.limite));
  }

  // Toutes les décisions à prendre, abonnement compris, triées par date limite.
  function aDecider(abos, auj, alerteJours = 30) {
    return abos.flatMap((a) => decisions(a, auj, alerteJours).map((d) => ({ ...d, id: a.id, nom: a.nom }))).sort((x, y) => x.limite.localeCompare(y.limite) || x.nom.localeCompare(y.nom));
  }

  // ---------- Totaux ----------
  // Dépenses en cours (actifs et à résilier) ; les abonnements sans montant sont comptés « à compléter ».
  function totaux(abos) {
    const t = { mensuel: 0, annuel: 0, nb: 0, aCompleter: 0, parCat: new Map() };
    for (const a of abos) {
      if (!compte(a)) continue;
      t.nb++;
      const an = coutAnnuel(a);
      if (an === null) { t.aCompleter++; continue; }
      t.annuel += an;
      if (!t.parCat.has(a.cat)) t.parCat.set(a.cat, { cat: a.cat, annuel: 0, nb: 0 });
      const c = t.parCat.get(a.cat); c.annuel += an; c.nb++;
    }
    t.mensuel = Math.round(t.annuel / 12);
    const parCat = [...t.parCat.values()].map((c) => ({ ...c, mensuel: Math.round(c.annuel / 12) })).sort((x, y) => y.annuel - x.annuel || x.cat.localeCompare(y.cat));
    return { ...t, parCat };
  }

  // Économie annuelle : potentielle (à résilier) et obtenue (résiliés).
  function economies(abos) {
    const r = { potentielle: 0, obtenue: 0, aResilier: [], resilies: [] };
    for (const a of abos) {
      const an = coutAnnuel(a) || 0;
      if (a.statut === 'aResilier') { r.potentielle += an; r.aResilier.push(a); }
      if (a.statut === 'resilie') { r.obtenue += an; r.resilies.push(a); }
    }
    r.total = r.potentielle + r.obtenue;
    return r;
  }

  // ---------- Calendrier ----------
  // Prélèvements d'un mois (« AAAA-MM ») : jours avec leurs prélèvements (ma part) et total du mois.
  function prelevementsMois(abos, cle) {
    const de = `${cle}-01`;
    const fin = `${cle}-${deux(joursDansMois(Number(cle.slice(0, 4)), Number(cle.slice(5, 7))))}`;
    const parJour = new Map();
    let total = 0, aCompleter = 0;
    for (const a of abos) {
      for (const d of echeancesEntre(a, de, fin)) {
        const m = maPart(a);
        if (!parJour.has(d)) parJour.set(d, []);
        parJour.get(d).push({ id: a.id, nom: a.nom, montant: m });
        if (m === null) aCompleter++; else total += m;
      }
    }
    const jours = [...parJour.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, items]) => ({ date, items: items.sort((x, y) => x.nom.localeCompare(y.nom)), total: items.reduce((s, i) => s + (i.montant || 0), 0) }));
    return { mois: cle, de, fin, jours, total, nb: jours.reduce((s, j) => s + j.items.length, 0), aCompleter };
  }

  // Montant réellement prélevé chaque mois sur n mois à partir du mois de « depuis » (pics des annuels).
  function projection(abos, depuis, n = 12) {
    const cle0 = moisDe(depuis);
    return Array.from({ length: n }, (_, i) => {
      const p = prelevementsMois(abos, ajoutMoisCle(cle0, i));
      return { mois: p.mois, total: p.total, nb: p.nb };
    });
  }

  // Prochains prélèvements entre deux dates, toutes lignes confondues.
  function prochains(abos, de, fin) {
    return abos.flatMap((a) => echeancesEntre(a, de, fin).map((d) => ({ date: d, id: a.id, nom: a.nom, montant: maPart(a) })))
      .sort((x, y) => x.date.localeCompare(y.date) || x.nom.localeCompare(y.nom));
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const centimes = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
  const dateOuNull = (v) => (estDate(v) ? v : null);

  function normaliserAbonnement(x, auj) {
    const a = x && typeof x === 'object' ? x : {};
    const montant = centimes(a.montant);
    return {
      id: String(a.id || nouvelId()),
      nom: String(a.nom || 'Abonnement').slice(0, 80),
      cat: String(a.cat || 'autres'),
      montant,
      periodicite: PERIODES[a.periodicite] ? a.periodicite : 'mensuel',
      debut: dateOuNull(a.debut) || auj,
      essaiFin: dateOuNull(a.essaiFin),
      engagementFin: dateOuNull(a.engagementFin),
      preavisJours: entier(a.preavisJours, 0, 365, 0),
      paiement: String(a.paiement || '').slice(0, 60),
      parts: entier(a.parts, 1, 20, 1),
      maPart: montant === null ? null : (centimes(a.maPart) === null ? null : Math.min(centimes(a.maPart), montant)),
      statut: STATUTS.includes(a.statut) ? a.statut : 'actif',
      resilieLe: dateOuNull(a.resilieLe),
      note: String(a.note || '').slice(0, 300),
    };
  }

  const etatVide = () => ({ version: 1, prenom: '', reglages: { alerteJours: 30 }, abonnements: [] });
  function normaliser(d, auj) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d,
      prenom: String(d.prenom || '').slice(0, 40),
      reglages: { ...v.reglages, ...(d.reglages || {}), alerteJours: entier(d.reglages?.alerteJours, 1, 120, 30) },
      abonnements: (Array.isArray(d.abonnements) ? d.abonnements : []).map((a) => normaliserAbonnement(a, auj)),
    };
  }

  // ---------- Exports ----------
  const LIB_STATUT = { actif: 'Actif', aResilier: 'À résilier', resilie: 'Résilié' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(abos, nomCat, nomPeriode, auj) {
    const tete = ['Abonnement', 'Catégorie', 'Statut', 'Montant', 'Périodicité', 'Parts', 'Ma part', 'Coût mensuel', 'Coût annuel', 'Prochain prélèvement', 'Fin d\'essai', 'Fin d\'engagement', 'Préavis (jours)', 'Paiement', 'Résilié le', 'Note'];
    const lignes = abos.map((a) => [a.nom, nomCat(a.cat), LIB_STATUT[a.statut], nombreCsv(a.montant), nomPeriode(a.periodicite), a.parts, nombreCsv(maPart(a)), nombreCsv(coutMensuel(a)), nombreCsv(coutAnnuel(a)), prochainPrelevement(a, auj) || '', a.essaiFin || '', a.engagementFin || '', a.preavisJours, a.paiement, a.resilieLe || '', a.note]);
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.ABN = {
    PERIODES, STATUTS, LIB_STATUT,
    iso, versDate, ajout, ecart, ajoutMois, joursDansMois, estDate, moisDe, ajoutMoisCle,
    lireMontant, euros, saisieMontant,
    maPart, parAn, coutAnnuel, coutMensuel, estPartage, compte,
    echeance, rangDepuis, prochainPrelevement, echeancesEntre,
    decisions, aDecider, totaux, economies, prelevementsMois, projection, prochains,
    nouvelId, normaliserAbonnement, etatVide, normaliser, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
