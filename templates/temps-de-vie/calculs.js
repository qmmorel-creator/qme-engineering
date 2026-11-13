// Règles métier du calculateur de temps de vie : fonctions pures, sans accès au DOM ni au stockage.
// Chargé par le navigateur (window.TDV_CALCUL) et par les tests (outils/templates/temps-de-vie.test.mjs).
//
// Formule de base : temps nécessaire = montant de la dépense / revenu net horaire.
// Le résultat est une ÉQUIVALENCE monétaire et temporelle : il ne dit pas combien d'heures tu travailles
// réellement pour une dépense, mais combien d'heures de revenu net elle représente. Le revenu horaire calculé
// est une estimation, pas un salaire horaire contractuel.
(function (racine) {
  'use strict';

  const nombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  const positif = (v) => { const n = nombre(v); return n !== null && n > 0 ? n : null; };
  const borne = (n, min, max) => Math.min(max, Math.max(min, n));

  // Complète un profil partiel par les valeurs par défaut et liste les hypothèses utilisées.
  function completer(profil, defauts) {
    const p = profil || {};
    const hyp = [];
    const champ = (cle, test = positif) => { const v = test(p[cle]); if (v === null) { hyp.push(cle); return defauts[cle]; } return v; };
    const zeroOk = (v) => { const n = nombre(v); return n !== null && n >= 0 ? n : null; };
    return {
      revenuMensuel: positif(p.revenuMensuel), revenuAnnuel: positif(p.revenuAnnuel),
      moisTravailles: borne(champ('moisTravailles'), 1, 12),
      heuresSemaine: borne(champ('heuresSemaine'), 1, 100),
      joursSemaine: borne(champ('joursSemaine'), 1, 7),
      conges: champ('conges', zeroOk), nonTravailles: champ('nonTravailles', zeroOk),
      trajetMinutes: champ('trajetMinutes', zeroOk), fraisPro: champ('fraisPro', zeroOk),
      inclureTransport: p.inclureTransport !== false,
      hypotheses: hyp,
    };
  }

  // Revenu net annuel : revenu annuel saisi, sinon revenu mensuel × 12.
  function revenuAnnuel(p) {
    if (positif(p.revenuAnnuel)) return { montant: p.revenuAnnuel, source: 'annuel' };
    if (positif(p.revenuMensuel)) return { montant: p.revenuMensuel * 12, source: 'mensuel' };
    return { montant: null, source: null };
  }

  // Temps de travail annuel et revenus unitaires selon la convention (contrat, reel, effectif).
  function taux(profil, convention, defauts) {
    const p = completer(profil, defauts);
    const rev = revenuAnnuel(p);
    const heuresJour = p.heuresSemaine / p.joursSemaine;
    const semainesTravaillees = 52 * p.moisTravailles / 12;
    const joursEffectifs = Math.max(1, semainesTravaillees * p.joursSemaine - p.conges - p.nonTravailles);
    let heuresAn, joursAn, revenu = rev.montant, heuresTravail, heuresTransport = 0;
    if (convention === 'contrat') {
      heuresTravail = heuresAn = p.heuresSemaine * 52;
      joursAn = p.joursSemaine * 52;
    } else {
      heuresTravail = joursEffectifs * heuresJour;
      joursAn = joursEffectifs;
      if (convention === 'reel') {
        heuresTransport = p.inclureTransport ? p.trajetMinutes / 60 * joursEffectifs : 0;
        if (revenu !== null) revenu = revenu - p.fraisPro * 12;
      }
      heuresAn = heuresTravail + heuresTransport;
    }
    const ok = revenu !== null && revenu > 0;
    const heuresParJour = heuresAn / joursAn;
    const heuresParSemaine = heuresParJour * p.joursSemaine;
    return {
      convention, profil: p, revenuAnnuel: ok ? revenu : null, revenuBrutSaisi: rev.montant, sourceRevenu: rev.source,
      heuresAn, joursAn, heuresTravail, heuresTransport, heuresParJour, heuresParSemaine, semainesAn: joursAn / p.joursSemaine,
      horaire: ok ? revenu / heuresAn : null,
      journalier: ok ? revenu / joursAn : null,
      hebdomadaire: ok ? revenu / heuresAn * heuresParSemaine : null,
      mensuel: ok ? revenu / 12 : null,
      negatif: revenu !== null && revenu <= 0,
    };
  }

  // Convertit un montant en temps de travail : heures, jours, semaines et mois de travail.
  function convertir(montant, t) {
    const m = nombre(montant);
    if (m === null || !t || !t.horaire) return null;
    const heures = m / t.horaire;
    return { montant: m, heures, jours: heures / t.heuresParJour, semaines: heures / t.heuresParSemaine, mois: heures / (t.heuresAn / 12) };
  }

  const parAn = (periode, periodicites) => periodicites.find((x) => x.id === periode)?.parAn ?? null;
  // Montant annuel d'une dépense récurrente (null pour une dépense unique).
  const annuel = (montant, periode, periodicites) => { const f = parAn(periode, periodicites); const m = nombre(montant); return f && m !== null ? m * f : null; };

  // Calculateur instantané : coût d'une dépense, et pour une récurrente, coût annuel, sur 5 et 10 ans.
  function instantane(montant, periode, t, periodicites) {
    const unite = convertir(montant, t);
    if (!unite) return null;
    const a = annuel(montant, periode, periodicites);
    if (a === null) return { unite, recurrent: false };
    return { unite, recurrent: true, mensuel: convertir(a / 12, t), annuel: convertir(a, t), cinqAns: convertir(a * 5, t), dixAns: convertir(a * 10, t) };
  }

  // Ajoute n jours à une date AAAA-MM-JJ (UTC).
  const plusJours = (iso, n) => { const [a, m, j] = iso.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1, j + n)); return d.toISOString().slice(0, 10); };

  // Coût annuel retenu dans le mode de vie : récurrentes actives annualisées, achats uniques des 12 derniers mois.
  function coutAnnuelDepense(d, periodicites, ref) {
    if (d.actif === false) return 0;
    const a = annuel(d.montant, d.periode, periodicites);
    if (a !== null) return Math.max(0, a);
    const debut = plusJours(ref, -365);
    return d.date && d.date > debut && d.date <= ref ? Math.max(0, nombre(d.montant) || 0) : 0;
  }

  // Bilan du mode de vie converti en temps, par catégorie et au total.
  function modeDeVie(depenses, t, periodicites, ref) {
    const lignes = (depenses || []).map((d) => ({ depense: d, annuel: coutAnnuelDepense(d, periodicites, ref) })).filter((l) => l.annuel > 0);
    const total = lignes.reduce((s, l) => s + l.annuel, 0);
    const parCat = new Map();
    for (const l of lignes) {
      const id = l.depense.categorie || 'autre';
      const c = parCat.get(id) || { id, annuel: 0, nb: 0 };
      c.annuel += l.annuel; c.nb += 1;
      parCat.set(id, c);
    }
    const h = (montant) => (t && t.horaire ? montant / t.horaire : null);
    const categories = [...parCat.values()].map((c) => ({
      ...c, mensuel: c.annuel / 12, part: total ? c.annuel / total : 0,
      heuresMois: h(c.annuel / 12), heuresAn: h(c.annuel), joursAn: t && t.horaire ? h(c.annuel) / t.heuresParJour : null,
      heuresSemaine: h(c.annuel / 52),
    })).sort((a, b) => b.annuel - a.annuel);
    const heuresAn = h(total);
    return {
      lignes, total, mensuel: total / 12, categories,
      heuresAn, heuresMois: heuresAn === null ? null : heuresAn / 12, heuresSemaine: heuresAn === null ? null : heuresAn / 52,
      joursAn: heuresAn === null ? null : heuresAn / t.heuresParJour,
      // Part du temps de travail annuel (selon la convention) que représente le mode de vie.
      partDuTravail: heuresAn === null ? null : heuresAn / t.heuresAn,
      top10: [...lignes].sort((a, b) => b.annuel - a.annuel).slice(0, 10).map((l) => ({ ...l, heuresAn: h(l.annuel) })),
      premiere: categories[0] || null,
    };
  }

  // ---------- Simulateur de choix de vie ----------
  // Une ligne compare un montant avant et après. Récurrente : économie annuelle = écart × occurrences par an.
  // Unique (achat) : écart amorti linéairement sur sa durée d'utilisation (années) ; l'économie cumulée sur
  // n années vaut donc l'économie annuelle × n, comme pour une dépense récurrente.
  function economieLigne(l, periodicites, n = 1) {
    const ecart = (nombre(l.avant) || 0) - (nombre(l.apres) || 0);
    const f = parAn(l.periode, periodicites);
    if (f) return { annuelle: ecart * f, cumul: ecart * f * n };
    const duree = Math.max(1, nombre(l.duree) || 1);
    return { annuelle: ecart / duree, cumul: ecart / duree * n };
  }
  function scenario(sc, t, periodicites, annees = [1, 3, 5, 10]) {
    const lignes = (sc.lignes || []).map((l) => ({ ligne: l, ...economieLigne(l, periodicites) }));
    const annuelle = lignes.reduce((s, l) => s + l.annuelle, 0);
    const heures = t && t.horaire ? annuelle / t.horaire : null;
    return {
      lignes, mensuelle: annuelle / 12, annuelle,
      heuresAn: heures, joursAn: heures === null ? null : heures / t.heuresParJour, heuresMois: heures === null ? null : heures / 12,
      cumuls: annees.map((n) => {
        const montant = (sc.lignes || []).reduce((s, l) => s + economieLigne(l, periodicites, n).cumul, 0);
        return { annees: n, montant, heures: t && t.horaire ? montant / t.horaire : null };
      }),
    };
  }

  // ---------- Coût total de possession d'un achat ----------
  function possession(a, t) {
    const mois = Math.max(1, nombre(a.dureeMois) || 1);
    const prix = Math.max(0, nombre(a.prix) || 0), frais = Math.max(0, nombre(a.frais) || 0);
    const entretien = Math.max(0, nombre(a.entretienAn) || 0) * mois / 12;
    const usage = Math.max(0, nombre(a.utilisationMois) || 0) * mois;
    const revente = Math.max(0, nombre(a.revente) || 0);
    const total = prix + frais + entretien + usage;
    const net = total - revente;
    const mensuel = net / mois;
    const h = (m) => (t && t.horaire ? m / t.horaire : null);
    return { mois, prix, frais, entretien, usage, revente, total, net, mensuel, journalier: net / (mois * 365.25 / 12),
      heures: h(net), heuresMois: h(mensuel), jours: t && t.horaire ? h(net) / t.heuresParJour : null };
  }

  // ---------- Export CSV ----------
  const cellule = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nb = (n, p = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '' : String(Math.round(n * 10 ** p) / 10 ** p).replace('.', ','));
  function csv(depenses, t, base, ref) {
    const nomCat = (id) => base.categories.find((c) => c.id === id)?.nom || id || '';
    const nomSous = (c, s) => base.categories.find((x) => x.id === c)?.sous.find((x) => x.id === s)?.nom || s || '';
    const nomPer = (id) => base.periodicites.find((p) => p.id === id)?.nom || '';
    const entetes = ['Libellé', 'Catégorie', 'Sous-catégorie', 'Montant', 'Périodicité', 'Date', 'Active', 'Coût annuel retenu', 'Heures de travail', 'Heures par an', 'Revenu horaire au moment de la saisie', 'Note'];
    const lignes = (depenses || []).map((d) => {
      const c = convertir(d.montant, t);
      const a = coutAnnuelDepense(d, base.periodicites, ref);
      return [d.libelle, nomCat(d.categorie), nomSous(d.categorie, d.sousCategorie), nb(Number(d.montant)), nomPer(d.periode), d.date, d.actif === false ? 'non' : 'oui',
        nb(a), nb(c?.heures, 1), t?.horaire ? nb(a / t.horaire, 1) : '', nb(d.horaireAuMoment), d.note].map(cellule).join(';');
    });
    return `﻿${entetes.map(cellule).join(';')}\r\n${lignes.join('\r\n')}\r\n`;
  }

  racine.TDV_CALCUL = { completer, revenuAnnuel, taux, convertir, annuel, instantane, coutAnnuelDepense, modeDeVie, economieLigne, scenario, possession, csv, plusJours };
})(typeof window !== 'undefined' ? window : globalThis);
