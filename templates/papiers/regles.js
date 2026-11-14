// Papiers du foyer QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.DCS) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes).
(function (racine) {
  'use strict';

  const CONSERVATIONS = ['base', 'date', 'toujours'];
  const HORIZON_JETER = 90; // jours : « bientôt jetable »
  const RAPPEL_DEFAUT = 3; // mois avant l'échéance de renouvellement

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Ajout de mois borné à la fin du mois (31 janvier + 1 mois = 28 ou 29 février ; 29 février + 1 an = 28 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = (a * 12 + (m - 1)) + n;
    const an = Math.floor(total / 12); const mois = total - an * 12;
    const dernier = new Date(an, mois + 1, 0).getDate();
    return `${an}-${deux(mois + 1)}-${deux(Math.min(j, dernier))}`;
  }

  // ---------- Textes ----------
  const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

  // Refus des données sensibles dans les champs libres : un numéro long (9 chiffres ou plus, espaces et
  // tirets compris : numéro de sécurité sociale, de carte, de compte, de passeport à chiffres), un IBAN, ou un
  // mot de passe ou code annoncé. L'application note où est le document, jamais son contenu.
  function contientNumeroSensible(texte) {
    const s = String(texte ?? '');
    if (/(?:\d[\s.-]?){9,}/.test(s)) return 'numero';
    if (/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/i.test(s)) return 'iban';
    if (/\b(?:mot de passe|mdp|password|code (?:pin|secret|confidentiel)|pin)\s*[:=]/i.test(sansAccents(s))) return 'secret';
    // Numéro de passeport ou de carte (lettres et chiffres mêlés, 9 caractères ou plus)
    if (/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{9,}\b/.test(s)) return 'numero';
    return '';
  }
  const MESSAGES_SENSIBLES = {
    numero: 'Pas de numéro complet ici (sécurité sociale, compte, carte, passeport) : note seulement où est le document.',
    iban: 'Pas d\'IBAN ici : note seulement où est le document.',
    secret: 'Pas de mot de passe ni de code ici : l\'application ne garde que l\'emplacement des papiers.',
  };

  // ---------- Règles de conservation ----------
  const typeDe = (base, id) => (base.documents || []).find((t) => t.id === id) || null;

  // Texte court de la règle d'un type : « Permanent », « 5 ans », « 3 ans après la fin de la location »…
  function libelleRegle(t) {
    if (!t) return 'Durée à choisir';
    const r = t.r;
    if (r === 'P') return 'Conservation permanente';
    if (r.valide) return 'Tant qu\'il est valable';
    if (r.aucune) return 'Durée à choisir';
    if (r.dec) return `Jusqu'au 31 décembre de la ${r.dec === 1 ? 'l\'année suivante' : `${r.dec}e année suivante`}`.replace('de la l\'', 'de l\'');
    const parts = [];
    if (r.a) parts.push(pluriel(r.a, 'an'));
    if (r.m) parts.push(`${r.m} mois`);
    if (r.j) parts.push(pluriel(r.j, 'jour'));
    const duree = parts.join(' et ');
    if (r.fin) return duree ? `${duree} après ${r.fin}` : `Jusqu'à ${r.fin}`;
    return duree;
  }

  // Date jusqu'à laquelle garder un document.
  // → { mode: 'toujours' } | { mode: 'attente', raison } | { mode: 'adater' } | { mode: 'date', date }
  //   attente : la règle dépend d'un événement pas encore daté (fin du bail, retraite…), d'une pièce valable
  //   ou d'une durée que la fiche ne chiffre pas ; adater : la règle part de la date du document, non saisie.
  function garderJusqua(doc, t) {
    if (doc.conservation === 'toujours') return { mode: 'toujours', choisi: true };
    if (doc.conservation === 'date') return doc.garder ? { mode: 'date', date: doc.garder, choisi: true } : { mode: 'attente', raison: 'choix' };
    if (!t) return { mode: 'attente', raison: 'choix' };
    const r = t.r;
    if (r === 'P') return { mode: 'toujours' };
    if (r.valide) return { mode: 'attente', raison: 'valide' };
    if (r.aucune) return { mode: 'attente', raison: 'choix' };
    let depart;
    if (r.fin) {
      if (!doc.fin) return { mode: 'attente', raison: 'fin', evenement: r.fin };
      depart = doc.fin;
    } else {
      if (!doc.date) return { mode: 'adater' };
      depart = doc.date;
    }
    if (r.dec) return { mode: 'date', date: `${Number(depart.slice(0, 4)) + r.dec}-12-31` };
    let d = ajoutMois(depart, (r.a || 0) * 12 + (r.m || 0));
    if (r.j) d = ajout(d, r.j);
    return { mode: 'date', date: d };
  }

  // Statut de conservation : jete, toujours, attente, adater, garder, bientot (jetable sous 90 jours), jeter.
  function statutConservation(doc, t, auj) {
    if (doc.jete) return 'jete';
    const g = garderJusqua(doc, t);
    if (g.mode !== 'date') return g.mode;
    const n = ecart(auj, g.date);
    if (n < 0) return 'jeter';
    if (n <= HORIZON_JETER) return 'bientot';
    return 'garder';
  }
  // Date à partir de laquelle le document peut être jeté (le lendemain du dernier jour de conservation).
  const jetableLe = (doc, t) => { const g = garderJusqua(doc, t); return g.mode === 'date' ? ajout(g.date, 1) : null; };

  // ---------- Renouvellements ----------
  // Échéance saisie par l'utilisateur (fin de validité, contrôle technique, échéance annuelle).
  // → null | { date, jours, statut: 'expire' | 'arenouveler' | 'ok', alerte (date du rappel) }
  function renouvellement(doc, auj) {
    if (!doc.echeance || doc.jete) return null;
    const jours = ecart(auj, doc.echeance);
    const alerte = ajoutMois(doc.echeance, -(doc.rappel ?? RAPPEL_DEFAUT));
    const statut = jours < 0 ? 'expire' : auj >= alerte ? 'arenouveler' : 'ok';
    return { date: doc.echeance, jours, statut, alerte };
  }
  // Échéances à surveiller, les plus proches d'abord (expirées en tête).
  function echeances(docs, auj, { toutes = false } = {}) {
    return docs.map((doc) => ({ doc, r: renouvellement(doc, auj) }))
      .filter((x) => x.r && (toutes || x.r.statut !== 'ok'))
      .sort((x, y) => x.r.date.localeCompare(y.r.date) || x.doc.titre.localeCompare(y.doc.titre, 'fr'));
  }
  // Documents jetables (ou bientôt), triés par date.
  function aTrier(docs, typeDeDoc, auj, { bientot = false } = {}) {
    return docs.map((doc) => ({ doc, statut: statutConservation(doc, typeDeDoc(doc), auj), g: garderJusqua(doc, typeDeDoc(doc)) }))
      .filter((x) => x.statut === 'jeter' || (bientot && x.statut === 'bientot'))
      .sort((x, y) => x.g.date.localeCompare(y.g.date));
  }

  // ---------- Recherche « où est… » ----------
  // Tous les mots cherchés (sans accents ni casse, pluriel en -s/-x toléré) présents dans le titre, le type,
  // la catégorie, la personne, l'emplacement, la précision ou la note. Les titres qui contiennent le mot
  // passent devant.
  const racineMot = (m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m);
  function rechercher(docs, q, ctx = {}, { jetes = false } = {}) {
    const mots = sansAccents(q).split(/[\s,;'’]+/).filter((m) => m.length > 1).map(racineMot);
    const vivants = jetes ? docs : docs.filter((d) => !d.jete);
    if (!mots.length) return vivants;
    const texteDe = (d) => sansAccents([d.titre, ctx.nomType?.(d.type), ctx.nomCat?.(d.cat), ctx.nomPersonne?.(d.personne), ctx.nomLieu?.(d.lieu), d.precision, d.note].filter(Boolean).join(' '));
    const trouves = vivants.filter((d) => { const t = texteDe(d); return mots.every((m) => t.includes(m)); });
    const score = (d) => mots.filter((m) => sansAccents(d.titre).includes(m)).length;
    return trouves.sort((x, y) => score(y) - score(x) || x.titre.localeCompare(y.titre, 'fr'));
  }

  // ---------- Regroupements ----------
  function parLieu(docs, lieux) {
    const vivants = docs.filter((d) => !d.jete);
    const groupes = lieux.map((l) => ({ lieu: l, docs: vivants.filter((d) => d.lieu === l.id) }));
    const sans = vivants.filter((d) => !lieux.some((l) => l.id === d.lieu));
    if (sans.length) groupes.push({ lieu: null, docs: sans });
    for (const g of groupes) g.docs.sort((x, y) => (x.precision || '').localeCompare(y.precision || '', 'fr') || x.titre.localeCompare(y.titre, 'fr'));
    return groupes;
  }
  function parCategorie(docs, categories) {
    return categories.map((c) => ({ cat: c, docs: docs.filter((d) => d.cat === c.id).sort((x, y) => x.titre.localeCompare(y.titre, 'fr')) })).filter((g) => g.docs.length);
  }
  // Mode « en cas d'urgence » : documents marqués essentiels, par personne (le foyer d'abord) puis catégorie.
  function urgence(docs, personnes, categories) {
    const ordreCat = new Map(categories.map((c, i) => [c.id, i]));
    const ess = docs.filter((d) => d.essentiel && !d.jete);
    const groupes = [{ personne: null, docs: ess.filter((d) => !personnes.some((p) => p.id === d.personne)) }, ...personnes.map((p) => ({ personne: p, docs: ess.filter((d) => d.personne === p.id) }))];
    for (const g of groupes) g.docs.sort((x, y) => (ordreCat.get(x.cat) ?? 99) - (ordreCat.get(y.cat) ?? 99) || x.titre.localeCompare(y.titre, 'fr'));
    return groupes.filter((g) => g.docs.length);
  }

  // Bilan pour le tableau de bord.
  function bilan(docs, typeDeDoc, auj) {
    const r = { total: 0, jetes: 0, essentiels: 0, sansLieu: 0, jeter: 0, bientot: 0, toujours: 0, attente: 0, adater: 0, expire: 0, arenouveler: 0, aEcheance: 0 };
    for (const d of docs) {
      if (d.jete) { r.jetes++; continue; }
      r.total++;
      if (d.essentiel) r.essentiels++;
      if (!d.lieu) r.sansLieu++;
      const s = statutConservation(d, typeDeDoc(d), auj);
      if (s in r) r[s]++;
      const re = renouvellement(d, auj);
      if (re) { r.aEcheance++; if (re.statut !== 'ok') r[re.statut]++; }
    }
    return r;
  }

  // ---------- Normalisation ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);

  function normaliserDoc(x, base = {}) {
    const d = x && typeof x === 'object' ? x : {};
    const t = d.type ? typeDe(base, d.type) : null;
    const cats = (base.categories || []).map((c) => c.id);
    const cat = cats.length ? (cats.includes(d.cat) ? d.cat : (t?.cat || cats[0])) : texte(d.cat, 20) || 'identite';
    const conservation = CONSERVATIONS.includes(d.conservation) ? d.conservation : 'base';
    return {
      id: String(d.id || nouvelId()),
      type: t ? t.id : (d.type && !cats.length ? String(d.type) : null),
      cat,
      titre: texte(d.titre, 120) || t?.nom || 'Document',
      personne: d.personne ? String(d.personne) : null,
      lieu: d.lieu ? String(d.lieu) : null,
      precision: texte(d.precision, 80),
      date: dateOuNull(d.date),
      fin: dateOuNull(d.fin),
      conservation,
      garder: conservation === 'date' ? dateOuNull(d.garder) : null,
      echeance: dateOuNull(d.echeance),
      rappel: entier(d.rappel, 0, 12, RAPPEL_DEFAUT),
      essentiel: Boolean(d.essentiel),
      note: texte(d.note, 200),
      jete: dateOuNull(d.jete),
    };
  }
  function normaliserLieu(x, i = 0, couleurs = ['#2E5A88']) {
    const l = x && typeof x === 'object' ? x : {};
    return { id: String(l.id || nouvelId()), nom: texte(l.nom, 50) || 'Emplacement', type: texte(l.type, 20) || 'autre', couleur: /^#[0-9A-Fa-f]{6}$/.test(l.couleur || '') ? l.couleur : couleurs[i % couleurs.length], note: texte(l.note, 120) };
  }
  function normaliserPersonne(x) {
    const p = x && typeof x === 'object' ? x : {};
    return { id: String(p.id || nouvelId()), nom: texte(p.nom, 40) || 'Personne' };
  }

  function etatVide() {
    return { version: 1, foyer: '', personnes: [], lieux: [], documents: [], urgence: { message: '', contact: '' } };
  }
  function normaliser(d, base = {}) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const couleurs = base.couleurs || ['#2E5A88'];
    const u = d.urgence && typeof d.urgence === 'object' ? d.urgence : {};
    return {
      ...v, ...d,
      foyer: texte(d.foyer, 60),
      personnes: (Array.isArray(d.personnes) ? d.personnes : []).map(normaliserPersonne).slice(0, 12),
      lieux: (Array.isArray(d.lieux) ? d.lieux : []).map((l, i) => normaliserLieu(l, i, couleurs)),
      documents: (Array.isArray(d.documents) ? d.documents : []).map((x) => normaliserDoc(x, base)),
      urgence: { message: texte(u.message, 600), contact: texte(u.contact, 160) },
    };
  }

  // Inventaire de départ : un document par type coché (et par personne pour les pièces personnelles).
  const PERSONNELS = new Set(['identite']);
  function documentsDepart(base, ids, { lieu = null, personnes = [] } = {}) {
    const out = [];
    for (const id of ids) {
      const t = typeDe(base, id);
      if (!t) continue;
      const pour = PERSONNELS.has(t.cat) && personnes.length ? personnes : [null];
      for (const p of pour) out.push(normaliserDoc({ type: t.id, cat: t.cat, titre: t.nom, personne: p ? p.id : null, lieu, essentiel: t.e }, base));
    }
    return out;
  }

  // ---------- Export ----------
  const LIB_STATUT = { toujours: 'À garder toujours', attente: 'À garder', adater: 'Date à saisir', garder: 'À garder', bientot: 'Jetable bientôt', jeter: 'Peut être jeté', jete: 'Jeté' };
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  function versCsv(docs, ctx, auj) {
    const tete = ['Document', 'Catégorie', 'Personne', 'Emplacement', 'Précision', 'Date du document', 'Garder jusqu\'au', 'Statut', 'Échéance', 'Essentiel', 'Note'];
    return csv([tete, ...docs.map((d) => {
      const t = ctx.type(d);
      const g = garderJusqua(d, t);
      return [d.titre, ctx.nomCat(d.cat), ctx.nomPersonne(d.personne), ctx.nomLieu(d.lieu), d.precision, d.date || '', g.mode === 'date' ? g.date : g.mode === 'toujours' ? 'Toujours' : '', LIB_STATUT[statutConservation(d, t, auj)], d.echeance || '', d.essentiel ? 'Oui' : '', d.note];
    })]);
  }

  racine.DCS = {
    CONSERVATIONS, HORIZON_JETER, RAPPEL_DEFAUT, LIB_STATUT, MESSAGES_SENSIBLES,
    iso, versDate, ajout, ajoutMois, ecart, estDate, sansAccents, pluriel,
    contientNumeroSensible, typeDe, libelleRegle, garderJusqua, statutConservation, jetableLe,
    renouvellement, echeances, aTrier, rechercher, parLieu, parCategorie, urgence, bilan,
    nouvelId, normaliserDoc, normaliserLieu, normaliserPersonne, etatVide, normaliser, documentsDepart, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
