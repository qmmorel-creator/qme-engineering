// Règles métier du template « Coût de revient et prix par client » : fonctions pures, sans DOM.
// Chargé dans le navigateur (globalThis.CALCULS) et dans les tests Node (outils/templates/cout-revient.test.mjs).
// Aucun taux de cotisations, aucune date fériée écrite en dur : tout est calculé ou saisi.
globalThis.CALCULS = (() => {
  'use strict';

  // ---------- Dates (chaînes AAAA-MM-JJ, heure locale) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const bissextile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

  // Dimanche de Pâques (calendrier grégorien), algorithme de Meeus, Jones et Butcher.
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31);
    const jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }

  // Jours fériés français d'une année (métropole ; option Alsace-Moselle), triés par date.
  function joursFeries(annee, { alsaceMoselle = false } = {}) {
    const p = paques(annee);
    const liste = [
      [`${annee}-01-01`, 'Jour de l\'an'],
      [ajout(p, 1), 'Lundi de Pâques'],
      [`${annee}-05-01`, 'Fête du Travail'],
      [`${annee}-05-08`, 'Victoire 1945'],
      [ajout(p, 39), 'Ascension'],
      [ajout(p, 50), 'Lundi de Pentecôte'],
      [`${annee}-07-14`, 'Fête nationale'],
      [`${annee}-08-15`, 'Assomption'],
      [`${annee}-11-01`, 'Toussaint'],
      [`${annee}-11-11`, 'Armistice 1918'],
      [`${annee}-12-25`, 'Noël'],
    ];
    if (alsaceMoselle) liste.push([ajout(p, -2), 'Vendredi saint'], [`${annee}-12-26`, 'Saint-Étienne']);
    return liste.map(([date, nom]) => ({ date, nom })).sort((x, y) => x.date.localeCompare(y.date));
  }

  // Jours ouvrés d'une année : jours de la semaine travaillés (0 = dimanche … 6 = samedi), hors fériés.
  // pentecoteTravaillee : le lundi de Pentecôte compte comme un jour travaillé.
  function joursOuvres(annee, { joursSemaine = [1, 2, 3, 4, 5], alsaceMoselle = false, pentecoteTravaillee = false } = {}) {
    const travailles = new Set(joursSemaine);
    const feries = joursFeries(annee, { alsaceMoselle }).filter((f) => !(pentecoteTravaillee && f.nom === 'Lundi de Pentecôte'));
    const dates = new Set(feries.map((f) => f.date));
    const calendaires = bissextile(annee) ? 366 : 365;
    let nonTravailles = 0, feriesChomes = 0, ouvres = 0;
    for (let d = new Date(annee, 0, 1); d.getFullYear() === annee; d.setDate(d.getDate() + 1)) {
      if (!travailles.has(d.getDay())) nonTravailles++;
      else if (dates.has(iso(d))) feriesChomes++;
      else ouvres++;
    }
    return {
      annee, calendaires, nonTravailles, feriesChomes, ouvres,
      feries: feries.map((f) => ({ ...f, chome: travailles.has(versDate(f.date).getDay()) })),
    };
  }

  // ---------- Capacité : temps réellement facturable ----------
  // p : { annee, joursSemaine, alsaceMoselle, pentecoteTravaillee, conges, absences, partNonFacturable (%), heuresJour, personnes }
  function capacite(p) {
    const o = joursOuvres(p.annee, p);
    const conges = Math.max(0, Number(p.conges) || 0);
    const absences = Math.max(0, Number(p.absences) || 0);
    const travailles = Math.max(0, o.ouvres - conges - absences);
    const part = Math.min(100, Math.max(0, Number(p.partNonFacturable) || 0));
    const joursParPersonne = travailles * (1 - part / 100);
    const personnes = Math.max(1, Math.round(Number(p.personnes) || 1));
    const heuresJour = Math.max(0, Number(p.heuresJour) || 0);
    return {
      ...o, conges, absences, travailles, partNonFacturable: part,
      nonFacturables: travailles - joursParPersonne,
      joursParPersonne, heuresParPersonne: joursParPersonne * heuresJour,
      personnes, heuresJour,
      joursFacturables: joursParPersonne * personnes,
      heuresFacturables: joursParPersonne * heuresJour * personnes,
    };
  }

  // ---------- Charges et coût de revient ----------
  const annuel = (montant, periode) => (Number(montant) || 0) * (periode === 'mois' ? 12 : 1);
  const chargesFixes = (charges) => (charges || []).reduce((s, c) => s + annuel(c.montant, c.periode), 0);

  // Cotisations saisies : pourcentage de la rémunération visée, ou montant (mois ou an).
  function cotisations(remunerationAnnuelle, c = {}) {
    if (c.mode === 'pourcentage') return remunerationAnnuelle * Math.max(0, Number(c.valeur) || 0) / 100;
    return annuel(c.valeur, c.periode || 'an');
  }

  // Coût de revient : total annuel à couvrir ÷ temps facturable. null si aucun temps facturable.
  function coutRevient({ chargesFixes: cf = 0, remuneration = 0, cotisations: co = 0, heuresFacturables = 0, joursFacturables = 0 }) {
    const total = cf + remuneration + co;
    return {
      total, chargesFixes: cf, remuneration, cotisations: co,
      parHeure: heuresFacturables > 0 ? total / heuresFacturables : null,
      parJour: joursFacturables > 0 ? total / joursFacturables : null,
    };
  }

  // Prix plancher = coût ; prix conseillé = coût ÷ (1 − marge cible) : la marge est une part du prix.
  function prix(cout, margeCible) {
    if (cout === null || cout === undefined || !Number.isFinite(cout)) return { plancher: null, conseille: null };
    const m = Math.min(90, Math.max(0, Number(margeCible) || 0)) / 100;
    return { plancher: cout, conseille: cout / (1 - m) };
  }

  // ---------- Saisies (durées et montants) ----------
  // « 1h30 », « 1 h 30 », « 1:30 », « 1,5 », « 90 min », « 2 » → heures décimales ; null si illisible.
  function lireDuree(texte) {
    const s = String(texte ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    let m = s.match(/^(\d+)(?:h|:)(\d{1,2})?(?:min|m)?$/);
    if (m) { const min = Number(m[2] || 0); return min < 60 ? Number(m[1]) + min / 60 : null; }
    m = s.match(/^(\d+)(?:min|mn|m)$/);
    if (m) return Number(m[1]) / 60;
    m = s.match(/^(\d+(?:[.,]\d+)?)h?$/);
    return m ? Number(m[1].replace(',', '.')) : null;
  }

  // « 1 200,50 », « 1200.5 », « 1 200 € » → 1200.5 ; null si illisible.
  function lireMontant(texte) {
    let s = String(texte ?? '').replace(/[\s  €]/g, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }

  // ---------- Rentabilité par client ----------
  // saisies : [{ clientId, type: 'temps' | 'frais' | 'facture', date, valeur }]
  // Période : { du, au } (dates incluses, facultatives).
  const dansPeriode = (s, periode = {}) => (!periode.du || s.date >= periode.du) && (!periode.au || s.date <= periode.au);

  function bilanClient(saisies, { coutHeure = null, conseilleHeure = null, periode = {} } = {}) {
    const t = { heures: 0, frais: 0, facture: 0 };
    for (const s of saisies) {
      if (!dansPeriode(s, periode)) continue;
      if (s.type === 'temps') t.heures += Number(s.valeur) || 0;
      else if (s.type === 'frais') t.frais += Number(s.valeur) || 0;
      else if (s.type === 'facture') t.facture += Number(s.valeur) || 0;
    }
    const coutTemps = coutHeure === null ? null : t.heures * coutHeure;
    const coutTotal = coutTemps === null ? null : coutTemps + t.frais;
    const marge = coutTotal === null ? null : t.facture - coutTotal;
    const tauxMarge = marge !== null && t.facture > 0 ? marge / t.facture : null;
    const tauxHoraireReel = t.heures > 0 ? (t.facture - t.frais) / t.heures : null;
    const ecartPlancher = tauxHoraireReel !== null && coutHeure !== null ? tauxHoraireReel - coutHeure : null;
    let statut;
    if (t.heures === 0) statut = 'sans-temps';
    else if (t.facture === 0) statut = 'non-facture';
    else if (coutHeure === null) statut = 'sans-cout';
    else if (tauxHoraireReel < coutHeure) statut = 'sous-plancher';
    else if (conseilleHeure !== null && tauxHoraireReel < conseilleHeure) statut = 'sous-conseille';
    else statut = 'rentable';
    return { ...t, coutTemps, coutTotal, marge, tauxMarge, tauxHoraireReel, ecartPlancher, statut };
  }

  // Classement : rentables d'abord par taux horaire réel décroissant, puis sans facture, puis sans temps.
  const RANG = { rentable: 0, 'sous-conseille': 0, 'sous-plancher': 0, 'sans-cout': 1, 'non-facture': 2, 'sans-temps': 3 };
  function classer(bilans) {
    return [...bilans].sort((a, b) => (RANG[a.statut] - RANG[b.statut]) || ((b.tauxHoraireReel ?? -Infinity) - (a.tauxHoraireReel ?? -Infinity)) || String(a.nom || '').localeCompare(String(b.nom || '')));
  }

  // Part du temps de chaque client sur le total (0 à 1), dans l'ordre reçu.
  function repartitionTemps(bilans) {
    const total = bilans.reduce((s, b) => s + b.heures, 0);
    return bilans.map((b) => ({ ...b, part: total > 0 ? b.heures / total : 0 }));
  }

  // Prix d'une mission : nombre de jours × prix journalier plancher et conseillé.
  function prixMission(jours, coutJour, margeCible) {
    const p = prix(coutJour, margeCible);
    const n = Math.max(0, Number(jours) || 0);
    return { plancher: p.plancher === null ? null : p.plancher * n, conseille: p.conseille === null ? null : p.conseille * n };
  }

  return { iso, versDate, ajout, paques, joursFeries, joursOuvres, capacite, annuel, chargesFixes, cotisations, coutRevient, prix, lireDuree, lireMontant, dansPeriode, bilanClient, classer, repartitionTemps, prixMission };
})();
