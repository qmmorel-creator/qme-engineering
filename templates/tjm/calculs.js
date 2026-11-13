// Règles métier du calculateur de TJM : fonctions pures, sans accès au DOM ni au stockage.
// Chargé par le navigateur (window.TJM_CALCUL) et par les tests (outils/templates/tjm.test.mjs).
// Montants en euros, taux en pourcentage (21.2 = 21,2 %), dates au format AAAA-MM-JJ.
(function (racine) {
  'use strict';

  const deux = (n) => String(n).padStart(2, '0');
  const isoUTC = (d) => `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
  const plusJours = (iso, n) => { const [a, m, j] = iso.split('-').map(Number); return isoUTC(new Date(Date.UTC(a, m - 1, j + n))); };
  const jourSemaine = (iso) => { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)).getUTCDay(); }; // 0 = dimanche
  const nombre = (v, defaut = 0) => { const n = Number(v); return Number.isFinite(n) ? n : defaut; };

  // Dimanche de Pâques (calendrier grégorien), algorithme de Meeus / Jones / Butcher.
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }

  // Les 11 jours fériés nationaux (hors Alsace-Moselle et outre-mer), triés par date.
  function feries(annee) {
    const p = paques(annee);
    return [
      [`${annee}-01-01`, 'Jour de l\'an'], [plusJours(p, 1), 'Lundi de Pâques'], [`${annee}-05-01`, 'Fête du Travail'],
      [`${annee}-05-08`, 'Victoire 1945'], [plusJours(p, 39), 'Ascension'], [plusJours(p, 50), 'Lundi de Pentecôte'],
      [`${annee}-07-14`, 'Fête nationale'], [`${annee}-08-15`, 'Assomption'], [`${annee}-11-01`, 'Toussaint'],
      [`${annee}-11-11`, 'Armistice 1918'], [`${annee}-12-25`, 'Noël'],
    ].map(([date, nom]) => ({ date, nom, ouvre: ![0, 6].includes(jourSemaine(date)) }))
      .sort((x, y) => x.date.localeCompare(y.date));
  }

  // Jours ouvrés (lundi au vendredi, hors fériés) d'une année.
  function joursOuvres(annee) {
    const fer = new Set(feries(annee).map((f) => f.date));
    let semaine = 0, n = 0;
    for (let d = `${annee}-01-01`; d.startsWith(String(annee)); d = plusJours(d, 1)) {
      if ([0, 6].includes(jourSemaine(d))) continue;
      semaine++;
      if (!fer.has(d)) n++;
    }
    return { semaine, feriesOuvres: semaine - n, ouvres: n };
  }

  // Jours facturables = jours ouvrés − congés − jours non facturables (jamais négatif).
  function joursFacturables(annee, conges = 0, nonFacturables = 0) {
    return Math.max(0, joursOuvres(annee).ouvres - Math.max(0, nombre(conges)) - Math.max(0, nombre(nonFacturables)));
  }

  // Taux prélevés sur le chiffre d'affaires d'une micro-entreprise (en %).
  // statut : bic | bnc | cipav ; activite (BIC seulement) : commercant | artisan ; vl : versement libératoire.
  function tauxMicro(statut, taux, { vl = false, activite = 'commercant' } = {}) {
    if (!['bic', 'bnc', 'cipav'].includes(statut)) return null;
    const cotisations = nombre(taux.cotisations[statut]);
    const cfp = nombre(statut === 'bic' ? taux.cfp[activite === 'artisan' ? 'artisan' : 'commercant'] : taux.cfp.liberal);
    const versement = vl ? nombre(statut === 'bic' ? taux.vl.bic : taux.vl.bnc) : 0;
    return { cotisations, cfp, vl: versement, total: Math.round((cotisations + cfp + versement) * 1000) / 1000 };
  }

  // Chiffre d'affaires annuel (hors taxes) nécessaire pour toucher un revenu net annuel donné.
  // Micro : les frais réels ne sont pas déductibles, cotisations, CFP et VL portent sur tout le CA :
  //   net = CA × (1 − taux) − frais  ⇒  CA = (net + frais) / (1 − taux).
  // Société : les frais sont payés d'abord, puis le taux de charges saisi s'applique au reste :
  //   net = (CA − frais) × (1 − taux)  ⇒  CA = net / (1 − taux) + frais.
  // Renvoie null si le calcul est impossible (taux de société absent, taux ≥ 100 %).
  function caNecessaire({ netAnnuel, fraisAnnuels = 0, statut, taux, vl = false, activite = 'commercant', tauxSociete = null }) {
    const net = Math.max(0, nombre(netAnnuel)), frais = Math.max(0, nombre(fraisAnnuels));
    if (statut === 'societe') {
      if (tauxSociete === null || tauxSociete === '' || !Number.isFinite(Number(tauxSociete))) return null;
      const t = Number(tauxSociete);
      if (t < 0 || t >= 100) return null;
      const avantCharges = net / (1 - t / 100);
      return { ca: avantCharges + frais, net, frais, charges: avantCharges - net, cotisations: 0, cfp: 0, vl: 0, taux: { total: t } };
    }
    const tm = tauxMicro(statut, taux, { vl, activite });
    if (!tm || tm.total >= 100) return null;
    const ca = (net + frais) / (1 - tm.total / 100);
    return { ca, net, frais, charges: ca * tm.total / 100, cotisations: ca * tm.cotisations / 100, cfp: ca * tm.cfp / 100, vl: ca * tm.vl / 100, taux: tm };
  }

  // TJM minimum (couvre juste le CA nécessaire) et conseillé (avec la marge de sécurité), arrondis à l'euro supérieur.
  function tjm(ca, jours, margePct = 0) {
    if (!(jours > 0) || !Number.isFinite(ca)) return null;
    const exact = ca / jours;
    const minimum = Math.ceil(exact - 1e-9);
    const conseille = Math.ceil(exact * (1 + Math.max(0, nombre(margePct)) / 100) - 1e-9);
    return { exact, minimum, conseille, caConseille: conseille * jours };
  }

  // Alertes de seuils sur un chiffre d'affaires annuel (HT).
  // niveau : 'depasse' (rouge) ou 'proche' (au-delà de 90 % du seuil).
  function alertes(ca, statut, taux) {
    const liste = [];
    if (!Number.isFinite(ca)) return liste;
    const micro = statut !== 'societe';
    if (micro && ca > taux.plafondServices) liste.push({ code: 'plafond', niveau: 'depasse', seuil: taux.plafondServices });
    else if (micro && ca > taux.plafondServices * 0.9) liste.push({ code: 'plafond', niveau: 'proche', seuil: taux.plafondServices });
    if (ca > taux.tvaMajore) liste.push({ code: 'tva-majore', niveau: 'depasse', seuil: taux.tvaMajore });
    else if (ca > taux.tvaBase) liste.push({ code: 'tva-base', niveau: 'depasse', seuil: taux.tvaBase });
    else if (ca > taux.tvaBase * 0.9) liste.push({ code: 'tva-base', niveau: 'proche', seuil: taux.tvaBase });
    return liste;
  }

  // Frais annuels à partir d'une liste { montant, periode: 'mois' | 'an' }.
  const fraisAnnuels = (frais = []) => frais.reduce((s, f) => s + Math.max(0, nombre(f.montant)) * (f.periode === 'mois' ? 12 : 1), 0);
  const netAnnuel = (objectif) => Math.max(0, nombre(objectif.montant)) * (objectif.periode === 'mois' ? 12 : 1);

  // Calcul complet d'un scénario.
  function calculer(sc, taux) {
    const jours = joursFacturables(sc.annee, sc.conges, sc.nonFacturables);
    const ouvres = joursOuvres(sc.annee);
    const besoin = caNecessaire({
      netAnnuel: netAnnuel(sc.objectif), fraisAnnuels: fraisAnnuels(sc.frais), statut: sc.statut, taux,
      vl: !!sc.vl, activite: sc.activite, tauxSociete: sc.tauxSociete,
    });
    const t = besoin ? tjm(besoin.ca, jours, sc.marge) : null;
    return {
      jours, ouvres, besoin, tjm: t,
      alertesMinimum: besoin ? alertes(besoin.ca, sc.statut, taux) : [],
      alertesConseille: t ? alertes(t.caConseille, sc.statut, taux) : [],
    };
  }

  // Courbe : TJM minimum selon le nombre de jours facturables (de `de` à `a`, par pas).
  function courbe(sc, taux, de = 100, a = 240, pas = 5) {
    const besoin = caNecessaire({
      netAnnuel: netAnnuel(sc.objectif), fraisAnnuels: fraisAnnuels(sc.frais), statut: sc.statut, taux,
      vl: !!sc.vl, activite: sc.activite, tauxSociete: sc.tauxSociete,
    });
    if (!besoin) return [];
    const points = [];
    for (let j = de; j <= a; j += pas) points.push({ jours: j, tjm: besoin.ca / j });
    return points;
  }

  racine.TJM_CALCUL = { paques, feries, joursOuvres, joursFacturables, tauxMicro, caNecessaire, tjm, alertes, fraisAnnuels, netAnnuel, calculer, courbe };
})(typeof window !== 'undefined' ? window : globalThis);
