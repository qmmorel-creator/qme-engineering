// Remboursements santé QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RBS) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes (entiers).
// Aucun taux de remboursement : les montants attendus viennent de la saisie (décompte, devis, estimation).
(function (racine) {
  'use strict';

  const ORGANISMES = ['ss', 'mut'];
  const MODES = ['attendu', 'tiers', 'aucun'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // ---------- Montants ----------
  // « 12,99 », « 12.99 € », « 1 234,5 », « 9 » → centimes ; null si vide, illisible ou négatif.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  // 1299 → « 12,99 € » ; 120000 → « 1 200,00 € » (espace fine insécable) ; options : sans centimes, signe.
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const ent = Math.floor(n / 100), dec = n % 100;
    const arrondi = centimes ? ent : Math.round(n / 100);
    const milliers = String(arrondi).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const texte = centimes ? `${milliers},${deux(dec)}` : milliers;
    return `${neg ? '−' : signe && c > 0 ? '+' : ''}${texte} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${Math.floor(c / 100)},${deux(c % 100)}`);

  // ---------- Base : index des types ----------
  // { type → { nom, famille, nomFamille } } depuis BASE.familles.
  function indexTypes(base) {
    const idx = {};
    for (const f of base.familles) for (const [id, nom] of f.types) idx[id] = { id, nom, famille: f.id, nomFamille: f.nom };
    return idx;
  }

  // ---------- Un organisme (Sécurité sociale ou mutuelle) pour un soin ----------
  const recu = (o) => o.mode === 'attendu' && !!o.recuLe;
  // Ce que l'organisme a réellement pris en charge : reçu, ou payé directement au praticien (tiers payant).
  function couvert(o) {
    if (o.mode === 'aucun') return 0;
    if (o.mode === 'tiers') return o.attendu || 0;
    return o.recuLe ? (o.recu ?? o.attendu ?? 0) : 0;
  }
  // Idem, en comptant aussi ce qui est encore attendu.
  const couvertPrevu = (o) => (o.mode === 'attendu' && !o.recuLe ? (o.attendu || 0) : couvert(o));
  const enAttente = (o) => o.mode === 'attendu' && !o.recuLe;

  // État d'un organisme à la date « auj » :
  //  aucun | tiers | recu (avec écart reçu − attendu) | attente | retard.
  // Retard : en attente depuis plus de « delai » jours depuis la transmission (sinon la date du soin) ;
  // après une relance, de nouveau en retard « delaiRelance » jours après la dernière relance.
  function etat(o, dateSoin, auj, delai, delaiRelance) {
    if (o.mode === 'aucun') return { etat: 'aucun' };
    if (o.mode === 'tiers') return { etat: 'tiers' };
    if (o.recuLe) {
      const montant = o.recu ?? o.attendu;
      return { etat: 'recu', le: o.recuLe, montant, ecart: o.attendu === null || montant === null ? 0 : montant - o.attendu };
    }
    const depuis = o.transmisLe || dateSoin;
    const derniere = o.relances.length ? o.relances[o.relances.length - 1] : null;
    const echeance = derniere && derniere >= depuis ? ajout(derniere, delaiRelance) : ajout(depuis, delai);
    return {
      etat: auj > echeance ? 'retard' : 'attente',
      depuis, jours: Math.max(0, ecart(depuis, auj)), echeance,
      relance: derniere, nbRelances: o.relances.length,
    };
  }
  const delaiDe = (org, reglages) => (org === 'ss' ? reglages.delaiSS : reglages.delaiMut);
  const etatOrg = (s, org, auj, reglages) => etat(s[org], s.date, auj, delaiDe(org, reglages), reglages.delaiRelance);

  // ---------- Un soin ----------
  // Avancé : ce que j'ai sorti de ma poche (le tiers payant est réglé directement au praticien).
  const avance = (s) => Math.max(0, s.montant - ORGANISMES.reduce((t, k) => t + (s[k].mode === 'tiers' ? (s[k].attendu || 0) : 0), 0));
  const rembourse = (s) => ORGANISMES.reduce((t, k) => t + (recu(s[k]) ? couvert(s[k]) : 0), 0);
  const resteACharge = (s) => s.montant - couvert(s.ss) - couvert(s.mut);
  const resteAChargePrevu = (s) => s.montant - couvertPrevu(s.ss) - couvertPrevu(s.mut);
  const incoherent = (s) => couvertPrevu(s.ss) + couvertPrevu(s.mut) > s.montant;
  const solde = (s) => !enAttente(s.ss) && !enAttente(s.mut);
  // État résumé du soin : retard si un organisme est en retard, attente si l'un attend, sinon solde.
  function etatSoin(s, auj, reglages) {
    const e = ORGANISMES.map((k) => etatOrg(s, k, auj, reglages).etat);
    return e.includes('retard') ? 'retard' : e.includes('attente') ? 'attente' : 'solde';
  }

  // Tous les remboursements attendus non reçus, triés : retards d'abord (le plus ancien en tête), puis par échéance.
  function attentes(soins, auj, reglages) {
    const l = [];
    for (const s of soins) for (const org of ORGANISMES) {
      if (!enAttente(s[org])) continue;
      const e = etatOrg(s, org, auj, reglages);
      l.push({ id: s.id, org, ...e, attendu: s[org].attendu, soin: s });
    }
    return l.sort((x, y) => (x.etat === y.etat ? 0 : x.etat === 'retard' ? -1 : 1) || x.echeance.localeCompare(y.echeance) || x.soin.date.localeCompare(y.soin.date));
  }

  // ---------- Totaux ----------
  const zero = () => ({ nb: 0, paye: 0, avance: 0, ss: 0, mut: 0, rembourse: 0, attente: 0, rac: 0, racPrevu: 0 });
  function cumuler(t, s) {
    t.nb++;
    t.paye += s.montant;
    t.avance += avance(s);
    t.ss += couvert(s.ss);
    t.mut += couvert(s.mut);
    t.rembourse += rembourse(s);
    t.attente += ORGANISMES.reduce((x, k) => x + (enAttente(s[k]) ? (s[k].attendu || 0) : 0), 0);
    t.rac += resteACharge(s);
    t.racPrevu += resteAChargePrevu(s);
    return t;
  }
  // Part prise en charge (Sécurité sociale + mutuelle, tiers payant compris) sur le montant payé, en % entier.
  const partPriseEnCharge = (t) => (t.paye ? Math.round(((t.ss + t.mut) / t.paye) * 100) : 0);

  // Totaux d'une année (date du soin), par membre et par famille de soins. annee null : toutes les années.
  function totaux(soins, annee, types) {
    const garde = soins.filter((s) => !annee || s.date.slice(0, 4) === String(annee));
    const t = zero();
    const parMembre = new Map(), parFamille = new Map();
    for (const s of garde) {
      cumuler(t, s);
      if (!parMembre.has(s.membre)) parMembre.set(s.membre, { membre: s.membre, ...zero() });
      cumuler(parMembre.get(s.membre), s);
      const f = types[s.type]?.famille || 'autres';
      if (!parFamille.has(f)) parFamille.set(f, { famille: f, ...zero() });
      cumuler(parFamille.get(f), s);
    }
    const tri = (x, y) => y.paye - x.paye;
    return { ...t, parMembre: [...parMembre.values()].sort(tri), parFamille: [...parFamille.values()].sort(tri) };
  }

  // Années présentes dans les soins, plus l'année en cours, de la plus récente à la plus ancienne.
  function annees(soins, auj) {
    const a = new Set(soins.map((s) => s.date.slice(0, 4)));
    a.add(auj.slice(0, 4));
    return [...a].sort().reverse();
  }

  // Comparaison de la complémentaire : remboursements de la mutuelle (tiers payant compris) face aux cotisations saisies.
  function bilanMutuelle(t, cotisation) {
    if (!cotisation) return null;
    return { cotisation, rembourse: t.mut, solde: t.mut - cotisation, ratio: Math.round((t.mut / cotisation) * 100) };
  }

  // ---------- Relance ----------
  // Remplace les champs {x} d'un modèle ; une valeur vide supprime sa ligne si elle n'a que ce champ.
  function remplir(modele, valeurs) {
    return modele.replace(/\{(\w+)\}/g, (_, k) => (valeurs[k] ?? '')).replace(/\n{3,}/g, '\n\n');
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== null && v !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const centimes = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  function normaliserOrganisme(x) {
    const o = x && typeof x === 'object' ? x : {};
    const mode = MODES.includes(o.mode) ? o.mode : 'attendu';
    const recuLe = mode === 'attendu' ? dateOuNull(o.recuLe) : null;
    return {
      mode,
      attendu: mode === 'aucun' ? 0 : centimes(o.attendu),
      transmisLe: mode === 'attendu' ? dateOuNull(o.transmisLe) : null,
      recu: recuLe ? centimes(o.recu) : null,
      recuLe,
      relances: mode === 'attendu' ? (Array.isArray(o.relances) ? o.relances.filter(estDate).sort().slice(-20) : []) : [],
    };
  }

  function normaliserSoin(x, auj) {
    const s = x && typeof x === 'object' ? x : {};
    return {
      id: String(s.id || nouvelId()),
      membre: String(s.membre || ''),
      type: String(s.type || 'autre'),
      date: dateOuNull(s.date) || auj,
      praticien: texte(s.praticien, 60),
      reference: texte(s.reference, 40),
      montant: centimes(s.montant) ?? 0,
      ss: normaliserOrganisme(s.ss),
      mut: normaliserOrganisme(s.mut),
    };
  }

  const reglagesVides = () => ({ delaiSS: 30, delaiMut: 30, delaiRelance: 15, nomMutuelle: '' });
  const etatVide = () => ({ version: 1, consentement: null, prenom: '', membres: [], soins: [], reglages: reglagesVides(), cotisations: {} });

  function normaliser(d, auj) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const r = d.reglages || {};
    const membres = (Array.isArray(d.membres) ? d.membres : []).filter((m) => m && m.id).map((m) => ({ id: String(m.id), prenom: texte(m.prenom, 30) || 'Membre' })).slice(0, 12);
    const cotisations = {};
    for (const [an, c] of Object.entries(d.cotisations || {})) if (/^\d{4}$/.test(an) && centimes(c)) cotisations[an] = centimes(c);
    const soins = (Array.isArray(d.soins) ? d.soins : []).map((s) => normaliserSoin(s, auj));
    // Un soin dont le membre a disparu est rattaché au premier membre (aucune donnée perdue).
    if (membres.length) for (const s of soins) if (!membres.some((m) => m.id === s.membre)) s.membre = membres[0].id;
    return {
      ...v,
      majLe: d.majLe,
      consentement: d.consentement && typeof d.consentement === 'object' ? d.consentement : null,
      prenom: texte(d.prenom, 40),
      membres,
      soins,
      reglages: {
        delaiSS: entier(r.delaiSS, 1, 180, 30),
        delaiMut: entier(r.delaiMut, 1, 180, 30),
        delaiRelance: entier(r.delaiRelance, 1, 180, 15),
        nomMutuelle: texte(r.nomMutuelle, 40),
      },
      cotisations,
    };
  }

  // ---------- Export CSV ----------
  const LIB_MODE = { attendu: 'Remboursement attendu', tiers: 'Tiers payant', aucun: 'Pas de prise en charge' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  function versCsv(soins, nomMembre, types, auj, reglages) {
    const tete = ['Date', 'Personne', 'Type de soin', 'Famille', 'Praticien', 'Référence', 'Montant payé', 'Avancé',
      'Sécurité sociale : cas', 'Sécurité sociale : attendu', 'Sécurité sociale : transmis le', 'Sécurité sociale : reçu', 'Sécurité sociale : reçu le', 'Sécurité sociale : état',
      'Mutuelle : cas', 'Mutuelle : attendu', 'Mutuelle : transmis le', 'Mutuelle : reçu', 'Mutuelle : reçu le', 'Mutuelle : état',
      'Reste à charge', 'Reste à charge prévu'];
    const LIB_ETAT = { aucun: 'Sans objet', tiers: 'Tiers payant', recu: 'Reçu', attente: 'En attente', retard: 'En retard' };
    const org = (s, k) => {
      const o = s[k];
      return [LIB_MODE[o.mode], nombreCsv(o.mode === 'aucun' ? null : o.attendu), o.transmisLe || '', nombreCsv(o.recuLe ? (o.recu ?? o.attendu) : null), o.recuLe || '', LIB_ETAT[etatOrg(s, k, auj, reglages).etat]];
    };
    const lignes = [...soins].sort((x, y) => x.date.localeCompare(y.date)).map((s) => [s.date, nomMembre(s.membre), types[s.type]?.nom || s.type, types[s.type]?.nomFamille || '', s.praticien, s.reference, nombreCsv(s.montant), nombreCsv(avance(s)), ...org(s, 'ss'), ...org(s, 'mut'), nombreCsv(resteACharge(s)), nombreCsv(resteAChargePrevu(s))]);
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.RBS = {
    ORGANISMES, MODES, LIB_MODE,
    iso, versDate, ajout, ecart, estDate,
    lireMontant, euros, saisieMontant, indexTypes,
    couvert, couvertPrevu, enAttente, recu, etat, etatOrg, delaiDe,
    avance, rembourse, resteACharge, resteAChargePrevu, incoherent, solde, etatSoin, attentes,
    totaux, partPriseEnCharge, annees, bilanMutuelle, remplir,
    nouvelId, normaliserOrganisme, normaliserSoin, etatVide, normaliser, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
