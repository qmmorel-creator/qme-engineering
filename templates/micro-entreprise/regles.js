// Règles métier du livre recettes-dépenses : fonctions pures, sans DOM ni état global.
// Chargé dans le navigateur avant app.js (globalThis.MCE_REGLES) et dans les tests Node.
// Estimations seulement : ce n'est ni un logiciel comptable certifié ni un conseil.
(() => {
  'use strict';

  const CATEGORIES = ['vente', 'bic', 'bnc'];
  const SERVICES = ['bic', 'bnc'];

  const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const montant = (x) => (Number.isFinite(Number(x?.montant)) ? Number(x.montant) : 0);
  const anneeDe = (date) => Number(String(date).slice(0, 4));
  const moisDe = (date) => Number(String(date).slice(5, 7)) - 1;
  const bissextile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const joursAnnee = (a) => (bissextile(a) ? 366 : 365);
  const deux = (n) => String(n).padStart(2, '0');
  const finDuMois = (a, m) => `${a}-${deux(m + 1)}-${deux(new Date(Date.UTC(a, m + 1, 0)).getUTCDate())}`;
  const zero = () => ({ vente: 0, bic: 0, bnc: 0, total: 0 });

  const dansAnnee = (liste, annee) => (liste || []).filter((x) => x && anneeDe(x.date) === Number(annee));
  const entre = (liste, debut, fin) => (liste || []).filter((x) => x && x.date >= debut && x.date <= fin);

  // Somme par catégorie d'activité (vente, bic, bnc) et total.
  function sommeParActivite(recettes) {
    const s = zero();
    for (const r of recettes || []) {
      const c = CATEGORIES.includes(r.categorie) ? r.categorie : 'bic';
      s[c] += montant(r);
      s.total += montant(r);
    }
    for (const k of Object.keys(s)) s[k] = arrondi(s[k]);
    return s;
  }

  // Totaux par mois (12 entrées) d'une année.
  function totauxParMois(recettes, annee) {
    const mois = Array.from({ length: 12 }, () => []);
    for (const r of dansAnnee(recettes, annee)) mois[moisDe(r.date)]?.push(r);
    return mois.map((l, i) => ({ mois: i, ...sommeParActivite(l) }));
  }

  // Totaux par trimestre (4 entrées) d'une année.
  function totauxParTrimestre(recettes, annee) {
    const m = totauxParMois(recettes, annee);
    return [0, 1, 2, 3].map((t) => {
      const s = zero();
      for (const x of m.slice(t * 3, t * 3 + 3)) for (const k of Object.keys(s)) s[k] += x[k];
      for (const k of Object.keys(s)) s[k] = arrondi(s[k]);
      return { trimestre: t + 1, ...s };
    });
  }

  // Totaux d'une liste par valeur d'un champ (catégorie de dépense, mode de règlement…), triés décroissants.
  function totauxParCategorie(liste, annee, champ = 'categorie') {
    const t = new Map();
    for (const x of annee == null ? (liste || []) : dansAnnee(liste, annee)) {
      const k = x[champ] || 'Autre';
      t.set(k, (t.get(k) || 0) + montant(x));
    }
    return [...t].map(([categorie, total]) => ({ categorie, total: arrondi(total) })).sort((a, b) => b.total - a.total || a.categorie.localeCompare(b.categorie));
  }

  const total = (liste) => arrondi((liste || []).reduce((s, x) => s + montant(x), 0));

  // Périodes de déclaration d'une année : 12 mois ou 4 trimestres.
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function periodes(annee, periodicite) {
    const a = Number(annee);
    if (periodicite === 'mensuelle') {
      return MOIS.map((nom, m) => ({ id: `${a}-M${deux(m + 1)}`, libelle: `${nom[0].toUpperCase()}${nom.slice(1)} ${a}`, debut: `${a}-${deux(m + 1)}-01`, fin: finDuMois(a, m) }));
    }
    return [0, 1, 2, 3].map((t) => ({ id: `${a}-T${t + 1}`, libelle: `${t + 1}${t ? 'e' : 'er'} trimestre ${a}`, debut: `${a}-${deux(t * 3 + 1)}-01`, fin: finDuMois(a, t * 3 + 2) }));
  }

  // Taux de cotisations sociales (en %) applicable à une recette.
  // BNC : caisse SSI (25,6 %) ou Cipav (23,2 %). ACRE : taux réduits saisis par l'utilisateur,
  // appliqués aux recettes encaissées jusqu'à la date de fin saisie (incluse).
  function tauxCotisation(categorie, date, profil = {}, taux) {
    const acre = profil.acre;
    if (acre && acre.fin && date <= acre.fin) {
      const reduit = Number(acre.taux?.[categorie]);
      if (acre.taux?.[categorie] !== null && acre.taux?.[categorie] !== '' && Number.isFinite(reduit)) return reduit;
    }
    if (categorie === 'bnc' && profil.caisseBnc === 'cipav') return taux.cotisations.cipav;
    return taux.cotisations[categorie] ?? 0;
  }

  // Estimation pour une période : chiffre d'affaires, cotisations, formation professionnelle,
  // versement libératoire (si l'option est choisie) et total.
  function estimerPeriode(recettes, debut, fin, profil = {}, taux) {
    const liste = entre(recettes, debut, fin);
    const ca = sommeParActivite(liste);
    const cotisations = { vente: 0, bic: 0, bnc: 0 };
    for (const r of liste) {
      const c = CATEGORIES.includes(r.categorie) ? r.categorie : 'bic';
      cotisations[c] += montant(r) * tauxCotisation(c, r.date, profil, taux) / 100;
    }
    for (const c of CATEGORIES) cotisations[c] = arrondi(cotisations[c]);
    const totalCotisations = arrondi(CATEGORIES.reduce((s, c) => s + cotisations[c], 0));
    const tauxFormation = taux.formation[profil.statutFormation] ?? 0;
    const formation = arrondi(ca.total * tauxFormation / 100);
    const versementLiberatoire = { vente: 0, bic: 0, bnc: 0 };
    if (profil.versementLiberatoire) for (const c of CATEGORIES) versementLiberatoire[c] = arrondi(ca[c] * (taux.versementLiberatoire[c] ?? 0) / 100);
    const totalVL = arrondi(CATEGORIES.reduce((s, c) => s + versementLiberatoire[c], 0));
    return { debut, fin, nombre: liste.length, ca, cotisations, totalCotisations, tauxFormation, formation, versementLiberatoire, totalVL, totalAPayer: arrondi(totalCotisations + formation + totalVL) };
  }

  // Jours d'activité dans l'année (du début d'activité au 31 décembre inclus).
  function joursActivite(debutActivite, annee) {
    const a = Number(annee);
    const total = joursAnnee(a);
    if (!debutActivite || anneeDe(debutActivite) < a) return total;
    if (anneeDe(debutActivite) > a) return 0;
    const [y, m, j] = debutActivite.split('-').map(Number);
    const debut = Date.UTC(y, m - 1, j);
    const fin = Date.UTC(a, 11, 31);
    return Math.round((fin - debut) / 86400000) + 1;
  }

  // Plafonds de chiffre d'affaires de l'année, proratisés au nombre de jours l'année du début d'activité.
  function plafondsAnnee(profil = {}, annee, taux) {
    const jours = joursActivite(profil.debut, annee);
    const ja = joursAnnee(Number(annee));
    const premiere = !!profil.debut && anneeDe(profil.debut) === Number(annee);
    const ratio = premiere ? jours / ja : 1;
    return { premiere, jours, joursAnnee: ja, ratio, vente: Math.round(taux.plafonds.vente * ratio), services: Math.round(taux.plafonds.services * ratio) };
  }

  // Position d'un montant par rapport à un seuil de base et un seuil majoré.
  // 'ok' < 80 % du seuil de base ≤ 'proche' ≤ seuil de base < 'base' ≤ seuil majoré < 'majore'.
  function etatSeuil(valeur, base, majore = base, proche = 0.8) {
    if (valeur > majore) return 'majore';
    if (valeur > base) return 'base';
    if (valeur >= base * proche) return 'proche';
    return 'ok';
  }

  // Seuils applicables selon les activités exercées (activité mixte : total ET part services).
  function seuils(recettes, annee, profil = {}, taux) {
    const ca = sommeParActivite(dansAnnee(recettes, annee));
    const services = arrondi(ca.bic + ca.bnc);
    const activites = Array.isArray(profil.activites) && profil.activites.length ? profil.activites : CATEGORIES.filter((c) => ca[c] > 0);
    const aVente = activites.includes('vente');
    const aServices = activites.some((c) => SERVICES.includes(c));
    const p = plafondsAnnee(profil, annee, taux);
    const plafonds = [];
    const tva = [];
    const ligne = (id, libelle, valeur, base, majore) => ({ id, libelle, valeur, base, majore, ratio: base ? valeur / base : 0, etat: etatSeuil(valeur, base, majore) });
    if (aVente) {
      plafonds.push(ligne('total', aServices ? 'Chiffre d\'affaires total' : 'Ventes', ca.total, p.vente, p.vente));
      tva.push(ligne('total', aServices ? 'Chiffre d\'affaires total' : 'Ventes', ca.total, taux.tva.vente.base, taux.tva.vente.majore));
    }
    if (aServices || !aVente) {
      const lib = aVente ? 'Dont prestations de services' : 'Prestations de services';
      const v = aVente ? services : ca.total;
      plafonds.push(ligne('services', lib, v, p.services, p.services));
      tva.push(ligne('services', lib, v, taux.tva.services.base, taux.tva.services.majore));
    }
    // Plafond : pas de seuil majoré, un dépassement est signalé par l'état 'depasse'.
    for (const l of plafonds) if (l.valeur > l.base) l.etat = 'depasse';
    return { ca, services, prorata: p, plafonds, tva };
  }

  // ---------- Export CSV (tableurs français) ----------
  const montantCsv = (n) => arrondi(n).toFixed(2).replace('.', ',');
  const dateCsv = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : String(s ?? ''));
  function celluleCsv(v) {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) s = `'${s}`; // neutralise les formules
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  // colonnes : [[titre, (ligne) => valeur], …] ; séparateur point-virgule, fins de ligne CRLF, BOM UTF-8.
  function csv(lignes, colonnes) {
    const corps = [colonnes.map(([t]) => celluleCsv(t)).join(';'), ...lignes.map((l) => colonnes.map(([, f]) => celluleCsv(f(l))).join(';'))];
    return `﻿${corps.join('\r\n')}\r\n`;
  }

  const nomCategorie = (id) => ({ vente: 'Vente de marchandises (BIC)', bic: 'Prestations de services (BIC)', bnc: 'Prestations libérales (BNC)' }[id] || id);
  const chrono = (liste) => [...(liste || [])].sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));

  function csvRecettes(recettes, annee) {
    return csv(chrono(dansAnnee(recettes, annee)), [
      ['Date d\'encaissement', (r) => dateCsv(r.date)], ['Client', (r) => r.client], ['Nature de la prestation ou de la vente', (r) => r.nature],
      ['Catégorie', (r) => nomCategorie(r.categorie)], ['Mode de règlement', (r) => r.mode], ['Pièce justificative', (r) => r.piece], ['Montant encaissé (€)', (r) => montantCsv(montant(r))],
    ]);
  }
  function csvAchats(achats, annee) {
    return csv(chrono(dansAnnee(achats, annee)), [
      ['Date', (r) => dateCsv(r.date)], ['Fournisseur', (r) => r.fournisseur], ['Nature de l\'achat', (r) => r.nature],
      ['Mode de règlement', (r) => r.mode], ['Pièce justificative', (r) => r.piece], ['Montant (€)', (r) => montantCsv(montant(r))],
    ]);
  }
  function csvDepenses(depenses, annee) {
    return csv(chrono(dansAnnee(depenses, annee)), [
      ['Date', (r) => dateCsv(r.date)], ['Fournisseur', (r) => r.fournisseur], ['Nature', (r) => r.nature], ['Catégorie', (r) => r.categorie],
      ['Mode de règlement', (r) => r.mode], ['Pièce justificative', (r) => r.piece], ['Montant (€)', (r) => montantCsv(montant(r))],
    ]);
  }
  // Tout en un fichier : une ligne par écriture, avec son type.
  function csvAnnuel(etat, annee) {
    const lignes = chrono([
      ...dansAnnee(etat.recettes, annee).map((r) => ({ ...r, type: 'Recette', tiers: r.client, cat: nomCategorie(r.categorie) })),
      ...dansAnnee(etat.achats, annee).map((r) => ({ ...r, type: 'Achat', tiers: r.fournisseur, cat: 'Achat de marchandises' })),
      ...dansAnnee(etat.depenses, annee).map((r) => ({ ...r, type: 'Dépense', tiers: r.fournisseur, cat: r.categorie })),
    ]);
    return csv(lignes, [
      ['Date', (r) => dateCsv(r.date)], ['Type', (r) => r.type], ['Client ou fournisseur', (r) => r.tiers], ['Nature', (r) => r.nature], ['Catégorie', (r) => r.cat],
      ['Mode de règlement', (r) => r.mode], ['Pièce justificative', (r) => r.piece], ['Montant (€)', (r) => montantCsv(montant(r))],
    ]);
  }

  globalThis.MCE_REGLES = {
    CATEGORIES, arrondi, joursAnnee, dansAnnee, sommeParActivite, totauxParMois, totauxParTrimestre, totauxParCategorie, total,
    periodes, tauxCotisation, estimerPeriode, joursActivite, plafondsAnnee, etatSeuil, seuils,
    celluleCsv, montantCsv, dateCsv, csv, csvRecettes, csvAchats, csvDepenses, csvAnnuel,
  };
})();
