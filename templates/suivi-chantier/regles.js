// Suivi de chantier par lot QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CHT) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), mois « AAAA-MM ». Montants en centimes HT
// (entiers). Rien de réglementaire n'est calculé : taux de retenue de garantie, délai de paiement, coefficient
// de révision et pénalités par jour sont saisis par l'utilisateur, d'après son marché.
(function (racine) {
  'use strict';

  const STATUTS_AVENANT = { projet: 'En projet', signe: 'Signé', refuse: 'Refusé' };
  const STATUTS_SITUATION = { recue: 'Reçue', validee: 'Validée', payee: 'Payée' };
  const GRAVITES = { mineure: 'Mineure', majeure: 'Majeure', critique: 'Critique' };
  const STATUTS_NC = { ouverte: 'Ouverte', traitement: 'En traitement', levee: 'Levée, à vérifier', close: 'Close' };
  const STATUTS_ST = { demande: 'Demande déposée', accepte: 'Accepté et agréé', refuse: 'Refusé' };
  const STATUTS_RISQUE = { ouvert: 'Ouvert', clos: 'Clos' };
  const REPONSES_RISQUE = { reduire: 'Réduire', eviter: 'Éviter', transferer: 'Transférer', accepter: 'Accepter' };
  const TYPES_COURRIER = { os: 'Ordre de service', courrier: 'Courrier', miseEnDemeure: 'Mise en demeure', pv: 'Procès-verbal', cr: 'Compte rendu', autre: 'Autre' };
  const NIVEAUX = { faible: 'Faible', modere: 'Modéré', eleve: 'Élevé', critique: 'Critique' };
  const ETATS_JALON = { atteint: 'Atteint', atteintRetard: 'Atteint en retard', retard: 'En retard', proche: 'Proche', aVenir: 'À venir' };

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j || 1); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estMois = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const moisDe = (s) => s.slice(0, 7);
  const moisSuivant = (m) => { const [a, n] = m.split('-').map(Number); return n === 12 ? `${a + 1}-01` : `${a}-${deux(n + 1)}`; };
  const finDeMois = (m) => { const [a, n] = m.split('-').map(Number); return iso(new Date(a, n, 0)); };
  function listeMois(de, a) {
    const l = [];
    if (!estMois(de) || !estMois(a) || de > a) return l;
    for (let m = de; m <= a && l.length < 240; m = moisSuivant(m)) l.push(m);
    return l;
  }

  // ---------- Nombres ----------
  const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  // « 1 234,56 », « −2 500 » → centimes ; null si vide ou illisible. signe : accepte un montant négatif.
  function lireMontant(saisie, { signe = false } = {}) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.').replace('−', '-');
    if (!s || !(signe ? /^[-+]?\d+(\.\d{0,2})?$/ : /^\+?\d+(\.\d{0,2})?$/).test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // Coefficient de révision (K) : « 1,0234 » → 1.0234 ; null si illisible ou hors de 0,5 à 2.
  function lireCoefficient(saisie) {
    const s = String(saisie ?? '').replace(/\s/g, '').replace(',', '.');
    if (!s) return 1;
    if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
    const k = Number(s);
    return k >= 0.5 && k <= 2 ? k : null;
  }
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const e = Math.abs(c) / 100;
    const pre = neg ? '−' : (signe && c > 0 ? '+' : '');
    if (!centimes) return `${pre}${milliers(Math.round(e))}\u00A0€`;
    const [ent, fr] = e.toFixed(2).split('.');
    return `${pre}${milliers(ent)},${fr}\u00A0€`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const pct = (v, dec = 1) => `${(Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('fr-FR')}\u00A0%`;
  const arrondi = (x) => Math.round(x);

  // ---------- Marché par lot ----------
  const lotDe = (op, id) => op.lots.find((l) => l.id === id) || null;
  function marcheLot(op, lotId) {
    const lot = lotDe(op, lotId);
    const av = op.avenants.filter((a) => a.lot === lotId);
    const signes = av.filter((a) => a.statut === 'signe');
    const projets = av.filter((a) => a.statut === 'projet');
    const initial = lot ? lot.montant : 0;
    const avenantsSignes = signes.reduce((s, a) => s + a.montant, 0);
    return {
      initial, avenantsSignes, actualise: initial + avenantsSignes,
      avenantsProjet: projets.reduce((s, a) => s + a.montant, 0),
      nbSignes: signes.length, nbProjets: projets.length, nbRefuses: av.length - signes.length - projets.length,
      delaiAvenants: signes.reduce((s, a) => s + a.delai, 0),
      ecartPct: initial ? ((avenantsSignes / initial) * 100) : 0,
    };
  }

  // Numéro d'avenant suivant pour un lot (1, 2, 3…).
  const prochainAvenant = (op, lotId) => Math.max(0, ...op.avenants.filter((a) => a.lot === lotId).map((a) => Number(a.numero) || 0)) + 1;

  // ---------- Intempéries et prolongations ----------
  const intemperies = (op) => op.journal.filter((j) => j.intemperie).map((j) => ({ ...j.intemperie, date: j.date, id: j.id }));
  function bilanIntemperies(op) {
    const l = intemperies(op);
    const parNature = {};
    for (const i of l) parNature[i.nature] = (parNature[i.nature] || 0) + i.jours;
    return {
      liste: l.sort((a, b) => (a.date < b.date ? 1 : -1)),
      constates: l.reduce((s, i) => s + i.jours, 0),
      retenus: l.filter((i) => i.retenue).reduce((s, i) => s + i.jours, 0),
      parNature,
    };
  }
  // Jours de prolongation d'un lot : délais des avenants signés + intempéries retenues du lot, et intempéries
  // retenues de toute l'opération tombées pendant la période du lot (toutes, si ses dates ne sont pas saisies).
  // Les jours d'intempéries sont arrondis au jour supérieur. jusqua (facultatif) : seuls les intempéries et les
  // avenants datés jusqu'à ce jour comptent (un événement postérieur à un jalon ne le décale pas ; un avenant
  // sans date compte toujours).
  function prolongationLot(op, lotId, jusqua = '') {
    const avant = (d) => !jusqua || !d || d <= jusqua;
    const av = op.avenants.filter((a) => a.lot === lotId && a.statut === 'signe' && avant(a.date)).reduce((s, a) => s + a.delai, 0);
    const l = lotDe(op, lotId);
    const pendant = (d) => !l || !estDate(l.debut) || !estDate(l.fin) || (d >= l.debut && d <= l.fin);
    const int = intemperies(op).filter((i) => i.retenue && avant(i.date) && (i.lot === lotId || (!i.lot && pendant(i.date)))).reduce((s, i) => s + i.jours, 0);
    return { avenants: av, intemperies: int, total: av + Math.ceil(int) };
  }
  // Opération : la plus longue prolongation des lots (ou les intempéries générales s'il n'y a aucun lot).
  function prolongationOperation(op, jusqua = '') {
    if (!op.lots.length) { const int = Math.ceil(intemperies(op).filter((i) => i.retenue && !i.lot && (!jusqua || i.date <= jusqua)).reduce((s, i) => s + i.jours, 0)); return { total: int, lot: null }; }
    let max = { total: 0, lot: null };
    for (const l of op.lots) { const p = prolongationLot(op, l.id, jusqua).total; if (p > max.total) max = { total: p, lot: l.id }; }
    return max;
  }

  // ---------- Jalons ----------
  function etatJalon(j, op, auj) {
    const prol = j.prolonger === false ? 0 : (j.lot ? prolongationLot(op, j.lot, j.date).total : prolongationOperation(op, j.date).total);
    const dateRecalee = ajout(j.date, prol);
    const alerte = op.reglages.alerteJours;
    let etat, retard = 0;
    if (j.dateReelle) {
      retard = Math.max(0, ecart(dateRecalee, j.dateReelle));
      etat = retard > 0 ? 'atteintRetard' : 'atteint';
    } else if (auj > dateRecalee) {
      retard = ecart(dateRecalee, auj); etat = 'retard';
    } else etat = ecart(auj, dateRecalee) <= alerte ? 'proche' : 'aVenir';
    const penalites = j.type === 'contractuel' && j.penaliteJour > 0 ? retard * j.penaliteJour : 0;
    return { jalon: j, prolongation: prol, dateRecalee, etat, retard, penalites, joursRestants: j.dateReelle ? null : ecart(auj, dateRecalee) };
  }
  const jalonsTries = (op, auj) => op.jalons.map((j) => etatJalon(j, op, auj)).sort((a, b) => (a.dateRecalee < b.dateRecalee ? -1 : a.dateRecalee > b.dateRecalee ? 1 : 0));
  // Pénalités encourues par lot (indicatives) : somme des jalons du lot, plafonnée au pourcentage du marché
  // actualisé saisi pour le lot (0 : sans plafond).
  function penalitesLot(op, lotId, auj) {
    const brut = op.jalons.filter((j) => j.lot === lotId).map((j) => etatJalon(j, op, auj).penalites).reduce((s, p) => s + p, 0);
    const lot = lotDe(op, lotId);
    const plafond = lot && lot.plafond > 0 ? arrondi(marcheLot(op, lotId).actualise * lot.plafond / 100) : null;
    return { brut, plafond, retenu: plafond === null ? brut : Math.min(brut, plafond), plafonne: plafond !== null && brut > plafond };
  }

  // ---------- Situations de travaux ----------
  // Chaque situation porte le montant CUMULÉ des travaux exécutés (HT, hors révision) à la fin du mois.
  // Travaux du mois = cumul − cumul précédent ; révision = travaux du mois × (K − 1), K saisi ;
  // retenue de garantie = (travaux du mois + révision) × taux saisi ; net HT = montant − retenue − pénalités.
  function situationsLot(op, lotId, auj) {
    const tri = op.situations.filter((s) => s.lot === lotId).sort((a, b) => (a.mois < b.mois ? -1 : a.mois > b.mois ? 1 : (a.numero || 0) - (b.numero || 0)));
    const taux = op.reglages.rg;
    let prec = 0;
    return tri.map((s) => {
      const travaux = s.cumul - prec;
      prec = s.cumul;
      const revision = arrondi(travaux * (s.k - 1));
      const montant = travaux + revision;
      const rg = arrondi(montant * taux / 100);
      const net = montant - rg - s.penalites;
      const echeance = s.dateReception ? ajout(s.dateReception, op.reglages.delaiPaiement) : null;
      let retardPaiement = 0;
      if (echeance) {
        if (s.statut === 'payee' && s.datePaiement) retardPaiement = Math.max(0, ecart(echeance, s.datePaiement));
        else if (s.statut !== 'payee' && auj > echeance) retardPaiement = ecart(echeance, auj);
      }
      return { situation: s, travaux, revision, montant, rg, net, echeance, retardPaiement, enRetard: s.statut !== 'payee' && retardPaiement > 0 };
    });
  }
  const prochaineSituation = (op, lotId) => Math.max(0, ...op.situations.filter((s) => s.lot === lotId).map((s) => Number(s.numero) || 0)) + 1;
  // Dernier cumul connu à la fin d'un mois donné (0 sans situation).
  function cumulAuMois(op, lotId, mois) {
    let c = 0, m0 = '';
    for (const s of op.situations) if (s.lot === lotId && s.mois <= mois && s.mois >= m0) { c = s.cumul; m0 = s.mois; }
    return c;
  }

  // ---------- Synthèse financière ----------
  function syntheseLot(op, lotId, auj) {
    const lot = lotDe(op, lotId);
    const m = marcheLot(op, lotId);
    const sit = situationsLot(op, lotId, auj);
    const somme = (f, filtre = () => true) => sit.filter(filtre).reduce((s, x) => s + f(x), 0);
    const cumul = sit.length ? sit[sit.length - 1].situation.cumul : 0;
    const st = op.sousTraitants.filter((s) => s.lot === lotId && s.statut !== 'refuse');
    const sousTraite = st.reduce((s, x) => s + x.montant, 0);
    const pen = penalitesLot(op, lotId, auj);
    return {
      lot, ...m, cumul,
      avancement: m.actualise > 0 ? cumul / m.actualise * 100 : 0,
      resteAFacturer: m.actualise - cumul,
      depassement: cumul > m.actualise ? cumul - m.actualise : 0,
      revision: somme((x) => x.revision),
      rg: somme((x) => x.rg),
      penalitesSituations: somme((x) => x.situation.penalites),
      net: somme((x) => x.net),
      paye: somme((x) => x.net, (x) => x.situation.statut === 'payee'),
      aPayer: somme((x) => x.net, (x) => x.situation.statut === 'validee'),
      aValider: somme((x) => x.net, (x) => x.situation.statut === 'recue'),
      nbAValider: sit.filter((x) => x.situation.statut === 'recue').length,
      paiementsEnRetard: sit.filter((x) => x.enRetard),
      sousTraite, partSousTraitee: m.actualise > 0 ? sousTraite / m.actualise * 100 : 0,
      penalitesEncourues: pen,
      prolongation: prolongationLot(op, lotId).total,
      derniereSituation: sit.length ? sit[sit.length - 1] : null,
    };
  }
  function syntheseFinanciere(op, auj) {
    const lots = op.lots.map((l) => syntheseLot(op, l.id, auj));
    const t = (k) => lots.reduce((s, x) => s + x[k], 0);
    const actualise = t('actualise');
    const cumul = t('cumul');
    return {
      lots,
      total: {
        initial: t('initial'), avenantsSignes: t('avenantsSignes'), actualise, avenantsProjet: t('avenantsProjet'),
        cumul, avancement: actualise > 0 ? cumul / actualise * 100 : 0, resteAFacturer: t('resteAFacturer'),
        revision: t('revision'), rg: t('rg'), penalitesSituations: t('penalitesSituations'), net: t('net'), paye: t('paye'),
        aPayer: t('aPayer'), aValider: t('aValider'), sousTraite: t('sousTraite'),
        penalitesEncourues: lots.reduce((s, x) => s + x.penalitesEncourues.retenu, 0),
        ecartPct: t('initial') ? t('avenantsSignes') / t('initial') * 100 : 0,
        paiementsEnRetard: lots.flatMap((x) => x.paiementsEnRetard),
      },
    };
  }

  // ---------- Échéancier prévisionnel ----------
  // Répartit un montant entre deux dates au prorata des jours de chaque mois ; la somme tombe juste.
  function echeancierLineaire(montant, debut, fin) {
    if (!estDate(debut) || !estDate(fin) || fin < debut || !montant) return [];
    const total = ecart(debut, fin) + 1;
    const res = [];
    let reparti = 0;
    for (const m of listeMois(moisDe(debut), moisDe(fin))) {
      const d = m === moisDe(debut) ? debut : `${m}-01`;
      const f = m === moisDe(fin) ? fin : finDeMois(m);
      const jours = ecart(d, f) + 1;
      res.push({ mois: m, jours });
    }
    let cumulJours = 0;
    return res.map((x) => {
      cumulJours += x.jours;
      const cible = Math.round(montant * cumulJours / total);
      const v = cible - reparti;
      reparti = cible;
      return { mois: x.mois, montant: v };
    });
  }
  // Courbe d'avancement financier : cumul prévu (échéancier) et cumul réalisé (situations) par mois.
  function courbe(op, auj) {
    const moisEch = op.echeancier.map((e) => e.mois);
    const moisSit = op.situations.map((s) => s.mois);
    const moisLots = op.lots.flatMap((l) => [l.debut, l.fin].filter(estDate).map(moisDe));
    const tous = [...moisEch, ...moisSit, ...moisLots].filter(estMois).sort();
    if (!tous.length) return { mois: [], prevu: [], reel: [], dernierReel: -1 };
    const mois = listeMois(tous[0], tous[tous.length - 1]);
    const prevu = [], reel = [];
    let cp = 0;
    const dernierSit = moisSit.length ? moisSit.sort()[moisSit.length - 1] : null;
    const limite = dernierSit && dernierSit > moisDe(auj) ? dernierSit : moisDe(auj);
    for (const m of mois) {
      cp += op.echeancier.filter((e) => e.mois === m).reduce((s, e) => s + e.montant, 0);
      prevu.push(cp);
      reel.push(m <= limite && dernierSit && m <= dernierSit ? op.lots.reduce((s, l) => s + cumulAuMois(op, l.id, m), 0) : null);
    }
    let dernierReel = -1;
    reel.forEach((v, i) => { if (v !== null) dernierReel = i; });
    return { mois, prevu, reel, dernierReel };
  }
  // Écart au prévisionnel à la date de la dernière situation : réalisé − prévu (négatif : en retard).
  function ecartPrevisionnel(op, auj) {
    const c = courbe(op, auj);
    if (c.dernierReel < 0) return null;
    const i = c.dernierReel;
    return { mois: c.mois[i], prevu: c.prevu[i], reel: c.reel[i], ecart: c.reel[i] - c.prevu[i], pct: c.prevu[i] ? (c.reel[i] - c.prevu[i]) / c.prevu[i] * 100 : 0 };
  }

  // ---------- Non-conformités (registre simplifié) ----------
  const ncOuverte = (n) => n.statut === 'ouverte' || n.statut === 'traitement';
  function etatNC(n, auj) {
    const retard = ncOuverte(n) && n.echeance && auj > n.echeance ? ecart(n.echeance, auj) : 0;
    return { nc: n, ouverte: ncOuverte(n), retard, enRetard: retard > 0, age: ecart(n.date, n.dateCloture || auj) };
  }
  function bilanNC(op, auj) {
    const l = op.nc.map((n) => etatNC(n, auj));
    const ouvertes = l.filter((x) => x.ouverte);
    return {
      total: l.length, ouvertes: ouvertes.length, enRetard: l.filter((x) => x.enRetard).length,
      aVerifier: l.filter((x) => x.nc.statut === 'levee').length,
      closes: l.filter((x) => x.nc.statut === 'close').length,
      parGravite: Object.fromEntries(Object.keys(GRAVITES).map((g) => [g, ouvertes.filter((x) => x.nc.gravite === g).length])),
      parLot: op.lots.map((lt) => ({ lot: lt, ouvertes: ouvertes.filter((x) => x.nc.lot === lt.id).length, total: l.filter((x) => x.nc.lot === lt.id).length })),
      liste: l,
    };
  }
  // Échéance proposée selon la gravité (délais de départ de la base, modifiables).
  const echeanceNC = (date, gravite, delais) => ajout(date, delais[gravite] ?? 15);

  // ---------- Risques ----------
  const criticite = (r) => r.probabilite * r.impact;
  function niveau(c) { return c >= 12 ? 'critique' : c >= 8 ? 'eleve' : c >= 4 ? 'modere' : 'faible'; }
  function bilanRisques(op, auj) {
    const ouverts = op.risques.filter((r) => r.statut === 'ouvert').map((r) => ({ risque: r, criticite: criticite(r), niveau: niveau(criticite(r)), actionEnRetard: !!(r.echeance && auj > r.echeance) }));
    ouverts.sort((a, b) => b.criticite - a.criticite || (a.risque.titre < b.risque.titre ? -1 : 1));
    const matrice = [];
    for (let p = 4; p >= 1; p--) for (let i = 1; i <= 4; i++) matrice.push({ p, i, niveau: niveau(p * i), n: ouverts.filter((x) => x.risque.probabilite === p && x.risque.impact === i).length });
    return {
      ouverts, matrice, clos: op.risques.filter((r) => r.statut === 'clos').length,
      parNiveau: Object.fromEntries(Object.keys(NIVEAUX).map((n) => [n, ouverts.filter((x) => x.niveau === n).length])),
      exposition: ouverts.reduce((s, x) => s + (x.risque.montant || 0) * x.risque.probabilite / 4, 0),
    };
  }

  // ---------- Courriers et ordres de service ----------
  const prochainNumero = (op, type) => Math.max(0, ...op.courriers.filter((c) => c.type === type).map((c) => Number(c.numero) || 0)) + 1;
  function etatCourrier(c, op, auj) {
    const attente = !!c.reponseAttendue && !c.dateReponse;
    const retard = attente && auj > c.reponseAttendue ? ecart(c.reponseAttendue, auj) : 0;
    const proche = attente && !retard && ecart(auj, c.reponseAttendue) <= op.reglages.alerteJours;
    return { courrier: c, attente, retard, enRetard: retard > 0, proche };
  }
  const courriersTries = (op, auj) => op.courriers.map((c) => etatCourrier(c, op, auj)).sort((a, b) => (a.courrier.date < b.courrier.date ? 1 : a.courrier.date > b.courrier.date ? -1 : (b.courrier.numero || 0) - (a.courrier.numero || 0)));
  const libCourrier = (c) => `${c.type === 'os' ? 'OS' : TYPES_COURRIER[c.type]}${c.numero ? ` n° ${c.numero}` : ''}`;

  // ---------- Sous-traitants ----------
  function etatSousTraitant(s, op, auj) {
    const attente = s.statut === 'demande' ? ecart(s.dateDemande, auj) : 0;
    return { st: s, attente, aRelancer: s.statut === 'demande' && attente > op.reglages.relanceSousTraitance };
  }

  // ---------- Pièces contractuelles ----------
  const piecesManquantes = (op) => op.pieces.filter((p) => !p.present);

  // ---------- Alertes consolidées ----------
  // Chaque alerte : { niveau: 'rouge' | 'jaune', domaine, texte, vue, id }. Rouge d'abord.
  function alertes(op, auj) {
    const a = [];
    const nomLot = (id) => { const l = lotDe(op, id); return l ? `${l.code} ${l.nom}` : 'Opération'; };
    for (const j of jalonsTries(op, auj)) {
      if (j.etat === 'retard') a.push({ niveau: 'rouge', domaine: 'Délais', texte: `${j.jalon.nom} (${nomLot(j.jalon.lot)}) : ${j.retard} j de retard sur la date recalée`, vue: 'planning', id: j.jalon.id });
      else if (j.etat === 'proche') a.push({ niveau: 'jaune', domaine: 'Délais', texte: `${j.jalon.nom} (${nomLot(j.jalon.lot)}) dans ${j.joursRestants} j`, vue: 'planning', id: j.jalon.id });
    }
    const f = syntheseFinanciere(op, auj);
    for (const x of f.lots) {
      if (x.depassement > 0) a.push({ niveau: 'rouge', domaine: 'Finances', texte: `${x.lot.code} : situations au-delà du marché actualisé de ${euros(x.depassement)} (avenant à formaliser ?)`, vue: 'finances', id: x.lot.id });
      for (const p of x.paiementsEnRetard) a.push({ niveau: 'rouge', domaine: 'Paiements', texte: `${x.lot.code} · situation n° ${p.situation.numero} : paiement attendu le ${dateFr(p.echeance)}, ${p.retardPaiement} j de retard`, vue: 'finances', id: p.situation.id });
      if (x.nbAValider) a.push({ niveau: 'jaune', domaine: 'Paiements', texte: `${x.lot.code} : ${x.nbAValider} situation${x.nbAValider > 1 ? 's' : ''} à valider`, vue: 'finances', id: x.lot.id });
    }
    const nbProj = op.avenants.filter((v) => v.statut === 'projet');
    if (nbProj.length) a.push({ niveau: 'jaune', domaine: 'Avenants', texte: `${nbProj.length} avenant${nbProj.length > 1 ? 's' : ''} en projet : ${euros(nbProj.reduce((s, v) => s + v.montant, 0), { signe: true })} à arbitrer`, vue: 'lots', id: '' });
    for (const n of op.nc.map((x) => etatNC(x, auj))) {
      if (n.enRetard) a.push({ niveau: 'rouge', domaine: 'Non-conformités', texte: `${n.nc.titre} (${nomLot(n.nc.lot)}) : ${n.retard} j après l'échéance`, vue: 'registres', id: n.nc.id });
      else if (n.ouverte && n.nc.gravite === 'critique') a.push({ niveau: 'rouge', domaine: 'Non-conformités', texte: `Critique ouverte : ${n.nc.titre} (${nomLot(n.nc.lot)})`, vue: 'registres', id: n.nc.id });
    }
    for (const r of bilanRisques(op, auj).ouverts) {
      if (r.niveau === 'critique') a.push({ niveau: 'rouge', domaine: 'Risques', texte: `Risque critique : ${r.risque.titre}`, vue: 'registres', id: r.risque.id });
      else if (r.niveau === 'eleve') a.push({ niveau: 'jaune', domaine: 'Risques', texte: `Risque élevé : ${r.risque.titre}`, vue: 'registres', id: r.risque.id });
    }
    for (const c of op.courriers.map((x) => etatCourrier(x, op, auj))) {
      if (c.enRetard) a.push({ niveau: 'rouge', domaine: 'Courriers', texte: `${libCourrier(c.courrier)} « ${c.courrier.objet} » : réponse attendue depuis ${c.retard} j`, vue: 'registres', id: c.courrier.id });
      else if (c.proche) a.push({ niveau: 'jaune', domaine: 'Courriers', texte: `${libCourrier(c.courrier)} « ${c.courrier.objet} » : réponse attendue le ${dateFr(c.courrier.reponseAttendue)}`, vue: 'registres', id: c.courrier.id });
    }
    for (const s of op.sousTraitants.map((x) => etatSousTraitant(x, op, auj))) {
      if (s.aRelancer) a.push({ niveau: 'jaune', domaine: 'Sous-traitance', texte: `${s.st.entreprise} (${nomLot(s.st.lot)}) : demande d'acceptation déposée il y a ${s.attente} j`, vue: 'lots', id: s.st.lot });
    }
    const manquantes = piecesManquantes(op);
    if (manquantes.length) a.push({ niveau: 'jaune', domaine: 'Pièces', texte: `${manquantes.length} pièce${manquantes.length > 1 ? 's' : ''} du marché à réunir : ${manquantes.slice(0, 3).map((p) => p.nom).join(', ')}${manquantes.length > 3 ? '…' : ''}`, vue: 'reglages-op', id: '' });
    return a.sort((x, y) => (x.niveau === y.niveau ? 0 : x.niveau === 'rouge' ? -1 : 1));
  }

  // ---------- Revue de projet ----------
  // Texte brut à copier (compte rendu, e-mail), dans l'ordre du modèle de revue.
  function texteRevue(op, auj, { nomLot = (id) => { const l = lotDe(op, id); return l ? `${l.code} ${l.nom}` : 'Opération'; } } = {}) {
    const f = syntheseFinanciere(op, auj).total;
    const j = jalonsTries(op, auj);
    const nc = bilanNC(op, auj);
    const r = bilanRisques(op, auj);
    const c = op.courriers.map((x) => etatCourrier(x, op, auj)).filter((x) => x.attente);
    const int = bilanIntemperies(op);
    const ep = ecartPrevisionnel(op, auj);
    const l = [];
    l.push(`REVUE DE PROJET · ${op.nom}${op.reference ? ` (${op.reference})` : ''}`);
    l.push(`Date : ${dateFr(auj)}`);
    if (op.maitreOuvrage) l.push(`Maître d'ouvrage : ${op.maitreOuvrage}`);
    l.push('');
    l.push('1. DÉLAIS');
    const prochains = j.filter((x) => !x.jalon.dateReelle).slice(0, 5);
    if (!prochains.length) l.push('- Aucun jalon à venir.');
    for (const x of prochains) l.push(`- ${x.jalon.nom} (${nomLot(x.jalon.lot)}) : prévu le ${dateFr(x.jalon.date)}${x.prolongation ? `, recalé au ${dateFr(x.dateRecalee)} (+${x.prolongation} j)` : ''} · ${ETATS_JALON[x.etat]}${x.retard ? ` (${x.retard} j)` : ''}`);
    l.push(`- Intempéries : ${int.constates} j constatés, ${int.retenus} j retenus pour prolongation.`);
    l.push('');
    l.push('2. FINANCES (HT)');
    l.push(`- Marché initial ${euros(f.initial)} · avenants signés ${euros(f.avenantsSignes, { signe: true })} (${pct(f.ecartPct)}) · marché actualisé ${euros(f.actualise)}`);
    l.push(`- Avenants en projet : ${euros(f.avenantsProjet, { signe: true })}`);
    l.push(`- Travaux cumulés ${euros(f.cumul)} (${pct(f.avancement)} du marché actualisé) · reste à facturer ${euros(f.resteAFacturer)}`);
    if (ep) l.push(`- Écart au prévisionnel (${ep.mois.slice(5)}/${ep.mois.slice(0, 4)}) : ${euros(ep.ecart, { signe: true })} (${pct(ep.pct)})`);
    l.push(`- Payé ${euros(f.paye)} net · à payer ${euros(f.aPayer)} · à valider ${euros(f.aValider)} · retenue de garantie ${euros(f.rg)}`);
    if (f.penalitesEncourues) l.push(`- Pénalités de retard encourues (indicatif) : ${euros(f.penalitesEncourues)}`);
    l.push('');
    l.push('3. QUALITÉ');
    l.push(`- Non-conformités : ${nc.ouvertes} ouverte(s) dont ${nc.parGravite.critique} critique(s), ${nc.enRetard} en retard, ${nc.aVerifier} à vérifier, ${nc.closes} close(s).`);
    for (const x of nc.liste.filter((y) => y.ouverte).slice(0, 5)) l.push(`  · ${x.nc.titre} (${nomLot(x.nc.lot)}, ${GRAVITES[x.nc.gravite].toLowerCase()})${x.nc.echeance ? `, échéance ${dateFr(x.nc.echeance)}` : ''}`);
    l.push('');
    l.push('4. RISQUES');
    if (!r.ouverts.length) l.push('- Aucun risque ouvert.');
    for (const x of r.ouverts.slice(0, 5)) l.push(`- ${x.risque.titre} : ${NIVEAUX[x.niveau].toLowerCase()} (${x.criticite}/16)${x.risque.action ? ` · ${x.risque.action}` : ''}`);
    l.push('');
    l.push('5. COURRIERS ET OS EN ATTENTE');
    if (!c.length) l.push('- Aucune réponse attendue.');
    for (const x of c) l.push(`- ${libCourrier(x.courrier)} du ${dateFr(x.courrier.date)} « ${x.courrier.objet} » : réponse attendue le ${dateFr(x.courrier.reponseAttendue)}${x.retard ? ` (${x.retard} j de retard)` : ''}`);
    l.push('');
    l.push('6. POINTS À ARBITRER');
    const arb = alertes(op, auj).filter((x) => x.niveau === 'rouge');
    if (!arb.length) l.push('- Aucun point bloquant.');
    for (const x of arb.slice(0, 8)) l.push(`- [${x.domaine}] ${x.texte}`);
    return l.join('\n');
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const euroCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsvSynthese(op, auj) {
    const f = syntheseFinanciere(op, auj);
    const tete = ['Lot', 'Intitulé', 'Entreprise', 'Marché initial HT', 'Avenants signés HT', 'Marché actualisé HT', 'Avenants en projet HT', 'Travaux cumulés HT', 'Avancement (%)', 'Reste à facturer HT', 'Révision cumulée HT', 'Retenue de garantie', 'Pénalités déduites', 'Net HT cumulé', 'Payé', 'À payer', 'À valider', 'Sous-traité HT', 'Pénalités encourues (indicatif)', 'Prolongation (j)'];
    const l = f.lots.map((x) => [x.lot.code, x.lot.nom, x.lot.entreprise, euroCsv(x.initial), euroCsv(x.avenantsSignes), euroCsv(x.actualise), euroCsv(x.avenantsProjet), euroCsv(x.cumul), String(Math.round(x.avancement * 10) / 10).replace('.', ','), euroCsv(x.resteAFacturer), euroCsv(x.revision), euroCsv(x.rg), euroCsv(x.penalitesSituations), euroCsv(x.net), euroCsv(x.paye), euroCsv(x.aPayer), euroCsv(x.aValider), euroCsv(x.sousTraite), euroCsv(x.penalitesEncourues.retenu), x.prolongation]);
    const t = f.total;
    l.push(['Total', '', '', euroCsv(t.initial), euroCsv(t.avenantsSignes), euroCsv(t.actualise), euroCsv(t.avenantsProjet), euroCsv(t.cumul), String(Math.round(t.avancement * 10) / 10).replace('.', ','), euroCsv(t.resteAFacturer), euroCsv(t.revision), euroCsv(t.rg), euroCsv(t.penalitesSituations), euroCsv(t.net), euroCsv(t.paye), euroCsv(t.aPayer), euroCsv(t.aValider), euroCsv(t.sousTraite), euroCsv(t.penalitesEncourues), '']);
    return csv([tete, ...l]);
  }
  function versCsvSituations(op, auj) {
    const tete = ['Lot', 'N°', 'Mois', 'Cumul travaux HT', 'Travaux du mois HT', 'Coefficient K', 'Révision HT', 'Retenue de garantie', 'Pénalités', 'Net HT', 'Reçue le', 'Statut', 'Paiement attendu', 'Payée le', 'Retard (j)'];
    const l = [];
    for (const lt of op.lots) for (const x of situationsLot(op, lt.id, auj)) {
      const s = x.situation;
      l.push([lt.code, s.numero, s.mois, euroCsv(s.cumul), euroCsv(x.travaux), String(s.k).replace('.', ','), euroCsv(x.revision), euroCsv(x.rg), euroCsv(s.penalites), euroCsv(x.net), s.dateReception, STATUTS_SITUATION[s.statut], x.echeance || '', s.datePaiement, x.retardPaiement || '']);
    }
    return csv([tete, ...l]);
  }

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const txt = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const ent = (v, def = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : def);
  const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const date = (v) => (estDate(v) ? v : '');
  const choix = (v, liste, def) => (Object.prototype.hasOwnProperty.call(liste, v) ? v : def);
  const borne = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
  const id = (v) => txt(v, 40) || nouvelId();

  function normaliserOperation(o = {}, defauts = {}) {
    const r = { ...(defauts.reglages || {}), ...(o.reglages || {}) };
    const op = {
      id: id(o.id), nom: txt(o.nom, 120) || 'Opération sans nom', reference: txt(o.reference, 60),
      maitreOuvrage: txt(o.maitreOuvrage, 120), maitreOeuvre: txt(o.maitreOeuvre, 120), lieu: txt(o.lieu, 120),
      dateOS: date(o.dateOS), dateFin: date(o.dateFin), notes: txt(o.notes, 2000),
      reglages: {
        rg: borne(r.rg, 0, 100, 5), delaiPaiement: Math.round(borne(r.delaiPaiement, 0, 365, 30)),
        alerteJours: Math.round(borne(r.alerteJours, 0, 120, 7)), relanceSousTraitance: Math.round(borne(r.relanceSousTraitance, 1, 365, 15)),
        delaisNC: { mineure: 30, majeure: 15, critique: 7, ...(r.delaisNC || {}) },
      },
    };
    op.lots = (Array.isArray(o.lots) ? o.lots : []).map((l) => ({ id: id(l.id), code: txt(l.code, 12) || 'LOT', nom: txt(l.nom, 120), entreprise: txt(l.entreprise, 120), montant: ent(l.montant), debut: date(l.debut), fin: date(l.fin), plafond: borne(l.plafond, 0, 100, 0) }));
    const lotOk = (v) => (op.lots.some((l) => l.id === v) ? v : '');
    const lotOblig = (x) => op.lots.some((l) => l.id === x.lot);
    op.avenants = (Array.isArray(o.avenants) ? o.avenants : []).map((a) => ({ id: id(a.id), lot: lotOk(a.lot), numero: ent(a.numero, 1), objet: txt(a.objet, 300), montant: ent(a.montant), delai: ent(a.delai), date: date(a.date), statut: choix(a.statut, STATUTS_AVENANT, 'projet') })).filter(lotOblig);
    op.situations = (Array.isArray(o.situations) ? o.situations : []).map((s) => ({ id: id(s.id), lot: lotOk(s.lot), numero: ent(s.numero, 1), mois: estMois(s.mois) ? s.mois : '', cumul: ent(s.cumul), k: borne(s.k, 0.5, 2, 1), penalites: Math.max(0, ent(s.penalites)), dateReception: date(s.dateReception), statut: choix(s.statut, STATUTS_SITUATION, 'recue'), dateValidation: date(s.dateValidation), datePaiement: date(s.datePaiement), note: txt(s.note, 500) })).filter((s) => lotOblig(s) && s.mois);
    op.echeancier = (Array.isArray(o.echeancier) ? o.echeancier : []).map((e) => ({ id: id(e.id), lot: lotOk(e.lot), mois: estMois(e.mois) ? e.mois : '', montant: ent(e.montant) })).filter((e) => lotOblig(e) && e.mois);
    op.jalons = (Array.isArray(o.jalons) ? o.jalons : []).map((j) => ({ id: id(j.id), lot: lotOk(j.lot), nom: txt(j.nom, 120) || 'Jalon', type: j.type === 'interne' ? 'interne' : 'contractuel', date: date(j.date), dateReelle: date(j.dateReelle), prolonger: j.prolonger !== false, penaliteJour: Math.max(0, ent(j.penaliteJour)), note: txt(j.note, 500) })).filter((j) => j.date);
    op.journal = (Array.isArray(o.journal) ? o.journal : []).map((j) => ({ id: id(j.id), date: date(j.date), meteo: txt(j.meteo, 40), effectif: Math.max(0, ent(j.effectif)), faits: txt(j.faits, 3000), intemperie: j.intemperie ? { jours: borne(j.intemperie.jours, 0.5, 31, 1), retenue: !!j.intemperie.retenue, lot: lotOk(j.intemperie.lot), nature: txt(j.intemperie.nature, 40) || 'Autre' } : null })).filter((j) => j.date);
    op.nc = (Array.isArray(o.nc) ? o.nc : []).map((n) => ({ id: id(n.id), lot: lotOk(n.lot), date: date(n.date), titre: txt(n.titre, 200) || 'Non-conformité', type: txt(n.type, 60), gravite: choix(n.gravite, GRAVITES, 'mineure'), statut: choix(n.statut, STATUTS_NC, 'ouverte'), echeance: date(n.echeance), action: txt(n.action, 1000), dateCloture: date(n.dateCloture) })).filter((n) => n.date);
    op.risques = (Array.isArray(o.risques) ? o.risques : []).map((r2) => ({ id: id(r2.id), lot: lotOk(r2.lot), titre: txt(r2.titre, 200) || 'Risque', categorie: txt(r2.categorie, 60), probabilite: Math.round(borne(r2.probabilite, 1, 4, 2)), impact: Math.round(borne(r2.impact, 1, 4, 2)), reponse: choix(r2.reponse, REPONSES_RISQUE, 'reduire'), action: txt(r2.action, 1000), porteur: txt(r2.porteur, 120), echeance: date(r2.echeance), statut: choix(r2.statut, STATUTS_RISQUE, 'ouvert'), montant: Math.max(0, ent(r2.montant)) }));
    op.courriers = (Array.isArray(o.courriers) ? o.courriers : []).map((c) => ({ id: id(c.id), type: choix(c.type, TYPES_COURRIER, 'courrier'), numero: Math.max(0, ent(c.numero)), date: date(c.date), lot: lotOk(c.lot), sens: c.sens === 'recu' ? 'recu' : 'emis', objet: txt(c.objet, 300) || 'Sans objet', reponseAttendue: date(c.reponseAttendue), dateReponse: date(c.dateReponse), incidenceDelai: ent(c.incidenceDelai), incidenceMontant: ent(c.incidenceMontant), note: txt(c.note, 1000) })).filter((c) => c.date);
    op.sousTraitants = (Array.isArray(o.sousTraitants) ? o.sousTraitants : []).map((s) => ({ id: id(s.id), lot: lotOk(s.lot), entreprise: txt(s.entreprise, 120) || 'Sous-traitant', objet: txt(s.objet, 300), montant: Math.max(0, ent(s.montant)), dateDemande: date(s.dateDemande), statut: choix(s.statut, STATUTS_ST, 'demande'), dateAcceptation: date(s.dateAcceptation), paiementDirect: !!s.paiementDirect })).filter((s) => lotOblig(s) && s.dateDemande);
    op.intervenants = (Array.isArray(o.intervenants) ? o.intervenants : []).map((p) => ({ id: id(p.id), nom: txt(p.nom, 120), societe: txt(p.societe, 120), role: txt(p.role, 80), email: txt(p.email, 160), telephone: txt(p.telephone, 40) })).filter((p) => p.nom || p.societe);
    op.pieces = (Array.isArray(o.pieces) ? o.pieces : (defauts.pieces || []).map((n) => ({ nom: n }))).map((p) => ({ id: id(p.id), nom: txt(p.nom, 120) || 'Pièce', present: !!p.present, version: txt(p.version, 60) }));
    return op;
  }
  function etatVide() { return { version: 1, operations: [], actif: '' }; }
  function normaliser(d, defauts = {}) {
    const e = etatVide();
    if (!d || typeof d !== 'object') return e;
    e.operations = (Array.isArray(d.operations) ? d.operations : []).map((o) => normaliserOperation(o, defauts));
    e.actif = e.operations.some((o) => o.id === d.actif) ? d.actif : (e.operations[0]?.id || '');
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  // Supprime un lot et tout ce qui lui est rattaché (avenants, situations, échéancier, sous-traitants) ;
  // les jalons, non-conformités, risques, courriers et intempéries du lot passent à l'opération.
  function supprimerLot(op, lotId) {
    const o = structuredCloneSur(op);
    o.lots = o.lots.filter((l) => l.id !== lotId);
    for (const k of ['avenants', 'situations', 'echeancier', 'sousTraitants']) o[k] = o[k].filter((x) => x.lot !== lotId);
    for (const k of ['jalons', 'nc', 'risques', 'courriers']) o[k].forEach((x) => { if (x.lot === lotId) x.lot = ''; });
    o.journal.forEach((j) => { if (j.intemperie && j.intemperie.lot === lotId) j.intemperie.lot = ''; });
    return o;
  }
  const structuredCloneSur = (x) => JSON.parse(JSON.stringify(x));

  racine.CHT = {
    STATUTS_AVENANT, STATUTS_SITUATION, GRAVITES, STATUTS_NC, STATUTS_ST, STATUTS_RISQUE, REPONSES_RISQUE, TYPES_COURRIER, NIVEAUX, ETATS_JALON,
    iso, versDate, ajout, ecart, estDate, dateFr, estMois, moisDe, moisSuivant, finDeMois, listeMois,
    lireMontant, lireCoefficient, euros, saisieMontant, pct,
    lotDe, marcheLot, prochainAvenant, intemperies, bilanIntemperies, prolongationLot, prolongationOperation,
    etatJalon, jalonsTries, penalitesLot, situationsLot, prochaineSituation, cumulAuMois, syntheseLot, syntheseFinanciere,
    echeancierLineaire, courbe, ecartPrevisionnel, ncOuverte, etatNC, bilanNC, echeanceNC, criticite, niveau, bilanRisques,
    prochainNumero, etatCourrier, courriersTries, libCourrier, etatSousTraitant, piecesManquantes, alertes, texteRevue,
    versCsvSynthese, versCsvSituations, nouvelId, normaliserOperation, normaliser, etatVide, supprimerLot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
