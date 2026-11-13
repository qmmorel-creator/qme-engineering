// Règles métier du circuit de visa : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/visa.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const lundi = (s) => ajout(s, -((versDate(s).getDay() + 6) % 7));
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // ---------- Jours fériés (Code du travail, art. L3133-1, métropole) ----------
  // Pâques : algorithme de Meeus (calendrier grégorien).
  function paques(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
    const g2 = Math.floor((c + 8) / 25), h = Math.floor((c - g2 + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
    const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mois = Math.floor((i + m - 7 * n + 114) / 31), jour = ((i + m - 7 * n + 114) % 31) + 1;
    return `${a}-${deux(mois)}-${deux(jour)}`;
  }
  const cacheFeries = new Map();
  function joursFeries(a) {
    if (!cacheFeries.has(a)) {
      const p = paques(a);
      cacheFeries.set(a, new Set([
        `${a}-01-01`, ajout(p, 1), `${a}-05-01`, `${a}-05-08`, ajout(p, 39), ajout(p, 50),
        `${a}-07-14`, `${a}-08-15`, `${a}-11-01`, `${a}-11-11`, `${a}-12-25`,
      ]));
    }
    return cacheFeries.get(a);
  }
  const estOuvre = (s) => { const j = versDate(s).getDay(); return j !== 0 && j !== 6 && !joursFeries(Number(s.slice(0, 4))).has(s); };

  // Date + n jours (calendaires, ou ouvrés : lundi à vendredi hors fériés). Le jour de départ ne compte pas.
  function ajouterJours(s, n, ouvres = false) {
    if (!ouvres) return ajout(s, n);
    let d = s, reste = n;
    while (reste > 0) { d = ajout(d, 1); if (estOuvre(d)) reste--; }
    return d;
  }
  // Nombre de jours de « de » (exclu) à « a » (inclus) ; négatif si a < de.
  function joursEntre(de, a, ouvres = false) {
    if (!ouvres) return ecart(de, a);
    if (a < de) return -joursEntre(a, de, true);
    let n = 0;
    for (let d = ajout(de, 1); d <= a; d = ajout(d, 1)) if (estOuvre(d)) n++;
    return n;
  }

  // ---------- Indices et numéros ----------
  // A → B, Z → AA, AZ → BA ; 0 → 1, 09 → 10 ; vide → A ; « B2 » → « B3 ».
  function indiceSuivant(i) {
    const s = String(i ?? '').trim().toUpperCase();
    if (!s) return 'A';
    const chiffres = s.match(/^(.*?)(\d+)$/);
    if (chiffres) return chiffres[1] + String(Number(chiffres[2]) + 1).padStart(chiffres[2].length, '0');
    if (!/^[A-Z]+$/.test(s)) return `${s}1`;
    const t = s.split('');
    let k = t.length - 1;
    while (k >= 0 && t[k] === 'Z') { t[k] = 'A'; k--; }
    if (k < 0) return `A${t.join('')}`;
    t[k] = String.fromCharCode(t[k].charCodeAt(0) + 1);
    return t.join('');
  }
  // Prochain numéro « PREFIXE-NNN » parmi les numéros existants.
  function numeroSuivant(numeros, prefixe) {
    const p = `${prefixe}-`;
    const max = numeros.reduce((m, n) => {
      if (!String(n).toUpperCase().startsWith(p.toUpperCase())) return m;
      const x = Number(String(n).slice(p.length));
      return Number.isInteger(x) && x > m ? x : m;
    }, 0);
    return `${prefixe}-${String(max + 1).padStart(3, '0')}`;
  }

  // ---------- Avis ----------
  const SEVERITE = { VSO: 0, VAO: 1, REF: 2 };
  const plusSevere = (a, b) => (!a ? b : !b ? a : SEVERITE[b] > SEVERITE[a] ? b : a);

  // Synthèse d'un indice : avis le plus sévère, complet quand tous les viseurs du circuit ont répondu
  // (sans viseur désigné : complet au premier avis). Date de synthèse = date du dernier avis.
  function synthese(indice, viseurIds = []) {
    const avis = indice?.avis || [];
    const attendus = viseurIds.length ? viseurIds : null;
    const utiles = attendus ? avis.filter((a) => attendus.includes(a.viseurId)) : avis;
    const manquants = attendus ? attendus.filter((v) => !avis.some((a) => a.viseurId === v)) : [];
    const complet = attendus ? manquants.length === 0 : avis.length > 0;
    const code = utiles.reduce((c, a) => plusSevere(c, a.code), null);
    const date = utiles.reduce((d, a) => (!d || a.date > d ? a.date : d), null);
    return { complet, code, date, manquants, nbAvis: utiles.length };
  }

  // Réglages effectifs d'une opération (ses délais propres priment).
  function reglagesOperation(reglages, op) {
    const r = { ...reglages };
    if (op && Number.isInteger(op.delaiVisa) && op.delaiVisa > 0) r.delaiVisa = op.delaiVisa;
    if (op && Number.isInteger(op.delaiResoumission) && op.delaiResoumission > 0) r.delaiResoumission = op.delaiResoumission;
    return r;
  }

  // ---------- État d'un document ----------
  const STATUTS = {
    attendu: { nom: 'Attendu', court: 'Attendu' },
    visa: { nom: 'En cours de visa', court: 'En visa' },
    resoumettre: { nom: 'Nouvel indice attendu', court: 'À resoumettre' },
    vao: { nom: 'Visé avec observations', court: 'Visé (VAO)' },
    vso: { nom: 'Bon pour exécution', court: 'Visé (VSO)' },
  };

  function etatDocument(doc, r, auj) {
    const indices = doc.indices || [];
    const base = { statut: 'attendu', clos: false, code: null, indice: null, echeance: doc.prevuLe || null, retard: 0, restants: null, cible: 'emetteur', manquants: [], dateSynthese: null };
    const fin = (e) => {
      if (!e.clos && e.echeance) {
        if (auj > e.echeance) e.retard = joursEntre(e.echeance, auj, r.ouvres);
        else e.restants = joursEntre(auj, e.echeance, r.ouvres);
      }
      e.alerte = !e.clos && e.retard === 0 && e.restants !== null && e.restants <= r.alerte;
      return e;
    };
    if (!indices.length) return fin(base);
    const der = indices[indices.length - 1];
    const s = synthese(der, doc.viseurIds || []);
    const e = { ...base, indice: der.indice, code: s.complet ? s.code : null, manquants: s.manquants, dateSynthese: s.complet ? s.date : null };
    if (!s.complet) return fin({ ...e, statut: 'visa', cible: 'viseurs', echeance: ajouterJours(der.recuLe, r.delaiVisa, r.ouvres), avisPartiel: s.code });
    if (s.code === 'VSO') return fin({ ...e, statut: 'vso', clos: true, echeance: null, cible: null });
    if (s.code === 'VAO' && !r.vaoNouvelIndice) return fin({ ...e, statut: 'vao', clos: true, echeance: null, cible: null });
    return fin({ ...e, statut: 'resoumettre', cible: 'emetteur', echeance: ajouterJours(s.date, r.delaiResoumission, r.ouvres) });
  }

  // Délai de visa constaté pour chaque indice dont la synthèse est connue.
  function cycles(doc, r) {
    return (doc.indices || []).map((ind, rang) => {
      const s = synthese(ind, doc.viseurIds || []);
      if (!s.complet) return null;
      const delai = joursEntre(ind.recuLe, s.date, r.ouvres);
      return { rang, indice: ind.indice, recuLe: ind.recuLe, date: s.date, code: s.code, delai, horsDelai: delai > r.delaiVisa };
    }).filter(Boolean);
  }

  // ---------- Relances ----------
  // Une relance est due pour tout document en retard, sauf si la même cible a déjà été relancée pour
  // le même indice il y a moins de « frequenceRelance » jours calendaires.
  function derniereRelance(doc, cible, indice) {
    return (doc.relances || []).filter((x) => x.cible === cible && (x.indice || null) === (indice || null))
      .reduce((d, x) => (!d || x.date > d ? x.date : d), null);
  }
  function relancesAFaire(docs, r, auj) {
    return docs.map((doc) => {
      const e = etatDocument(doc, r, auj);
      if (e.clos || e.retard <= 0 || !e.cible) return null;
      const derniere = derniereRelance(doc, e.cible, e.statut === 'resoumettre' ? `>${e.indice}` : e.indice);
      const due = !derniere || ecart(derniere, auj) >= r.frequenceRelance;
      return { doc, etat: e, cible: e.cible, derniere, due, prochaine: derniere ? ajout(derniere, r.frequenceRelance) : auj };
    }).filter(Boolean).sort((a, b) => b.etat.retard - a.etat.retard || a.doc.numero.localeCompare(b.doc.numero));
  }
  // Indice concerné par une relance : celui en visa, ou « >B » pour le nouvel indice attendu après B.
  const indiceRelance = (e) => (e.statut === 'resoumettre' ? `>${e.indice}` : e.indice);

  function texteRelance({ operation, lot, doc, etat, viseurs = [], auj }) {
    const ref = `${doc.numero}${etat.indice ? ` indice ${etat.indice}` : ''}`;
    const objet = `Relance – ${operation?.nom || 'Opération'} – Lot ${lot?.numero || ''} ${lot?.nom || ''} – ${ref}`.replace(/\s+/g, ' ').trim();
    const L = ['Bonjour,', ''];
    if (etat.statut === 'visa') {
      const noms = viseurs.filter((v) => etat.manquants.includes(v.id)).map((v) => v.nom);
      L.push(`Sauf erreur de notre part, ${noms.length > 1 ? 'vos avis' : 'votre avis'} sur le document ${ref} « ${doc.titre} », reçu le ${dateFr((doc.indices || []).at(-1)?.recuLe)}, ${noms.length > 1 ? 'sont attendus' : 'est attendu'} depuis le ${dateFr(etat.echeance)} (${etat.retard} j de retard).`);
      if (noms.length) L.push(`Avis en attente : ${noms.join(', ')}.`);
      L.push('', 'Merci de nous le transmettre au plus vite afin de ne pas retarder l\'exécution.');
    } else if (etat.statut === 'resoumettre') {
      L.push(`Le document ${doc.numero} « ${doc.titre} » a reçu l'avis ${etat.code} à l'indice ${etat.indice} le ${dateFr(etat.dateSynthese)}. Le nouvel indice était attendu pour le ${dateFr(etat.echeance)} (${etat.retard} j de retard).`);
      L.push('', 'Merci de nous transmettre l\'indice suivant, intégrant les observations formulées.');
    } else {
      L.push(`Le document ${doc.numero} « ${doc.titre} » était attendu pour le ${dateFr(etat.echeance)} et ne nous est pas parvenu (${etat.retard} j de retard).`);
      L.push('', 'Merci de nous indiquer sa date de remise ou de nous le transmettre au plus vite.');
    }
    L.push('', 'Cordialement');
    return { objet, corps: L.join('\n'), date: auj };
  }

  // ---------- Statistiques ----------
  function statistiques(docs, r, auj, semaines = 12) {
    const etats = docs.map((d) => ({ d, e: etatDocument(d, r, auj) }));
    const tous = docs.flatMap((d) => cycles(d, r));
    const premiers = docs.map((d) => cycles(d, r).find((c) => c.rang === 0)).filter(Boolean);
    const debut = ajout(lundi(auj), -7 * (semaines - 1));
    const parSemaine = Array.from({ length: semaines }, (_, i) => ({ debut: ajout(debut, 7 * i), VSO: 0, VAO: 0, REF: 0 }));
    tous.forEach((c) => { if (c.date >= debut && c.date <= auj) parSemaine[Math.floor(ecart(debut, c.date) / 7)][c.code]++; });
    return {
      total: docs.length,
      attendus: etats.filter((x) => x.e.statut === 'attendu').length,
      enVisa: etats.filter((x) => x.e.statut === 'visa').length,
      aResoumettre: etats.filter((x) => x.e.statut === 'resoumettre').length,
      clos: etats.filter((x) => x.e.clos).length,
      retards: etats.filter((x) => x.e.retard > 0).length,
      alertes: etats.filter((x) => x.e.alerte).length,
      tauxVSO1: premiers.length ? Math.round((premiers.filter((c) => c.code === 'VSO').length / premiers.length) * 100) : null,
      delaiMoyen: tous.length ? Math.round((tous.reduce((s, c) => s + c.delai, 0) / tous.length) * 10) / 10 : null,
      horsDelai: tous.filter((c) => c.horsDelai).length,
      cycles: tous.length,
      parSemaine,
    };
  }

  // ---------- Export CSV du registre ----------
  function champCSV(v) {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function registreCSV({ docs, lots, viseurs, r, auj }) {
    const lot = (id) => lots.find((l) => l.id === id);
    const nomViseur = (id) => viseurs.find((v) => v.id === id)?.nom || '';
    const entetes = ['Lot', 'Intitulé du lot', 'Entreprise', 'Numéro', 'Titre', 'Type', 'Indice', 'Reçu le', 'Échéance', 'Avis', 'Statut', 'Retard (j)', 'Avis en attente', 'Nombre d\'indices', 'Dernière relance'];
    const lignes = docs.map((d) => {
      const e = etatDocument(d, r, auj);
      const l = lot(d.lotId);
      const der = (d.indices || []).at(-1);
      const relance = (d.relances || []).reduce((x, y) => (!x || y.date > x ? y.date : x), null);
      return [l?.numero, l?.nom, l?.entreprise, d.numero, d.titre, d.type, e.indice || '', dateFr(der?.recuLe), dateFr(e.echeance), e.code || '', STATUTS[e.statut].nom, e.retard || '', e.manquants.map(nomViseur).join(', '), (d.indices || []).length, dateFr(relance)];
    });
    return `﻿${[entetes, ...lignes].map((l) => l.map(champCSV).join(';')).join('\r\n')}\r\n`;
  }

  // Ordre du registre : lot, puis numéro.
  function trierDocuments(docs, lots) {
    const rang = (id) => { const l = lots.find((x) => x.id === id); return l ? String(l.numero).padStart(4, '0') : '9999'; };
    return [...docs].sort((a, b) => rang(a.lotId).localeCompare(rang(b.lotId)) || a.numero.localeCompare(b.numero, 'fr', { numeric: true }));
  }

  g.REGLES = {
    iso, versDate, ajout, ecart, lundi, dateFr, paques, joursFeries, estOuvre, ajouterJours, joursEntre,
    indiceSuivant, numeroSuivant, SEVERITE, plusSevere, synthese, reglagesOperation,
    STATUTS, etatDocument, cycles, derniereRelance, relancesAFaire, indiceRelance, texteRelance,
    statistiques, champCSV, registreCSV, trierDocuments,
  };
})(typeof window !== 'undefined' ? window : globalThis);
