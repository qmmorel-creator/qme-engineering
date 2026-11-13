// Règles métier de la levée de réserves : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/reserves.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;

  // ---------- Statuts ----------
  // ouverte : à lever par l'entreprise ; levee : levée déclarée, à contrôler ;
  // controlee : levée contrôlée et acceptée (soldée) ; refusee : contrôle négatif, à reprendre.
  const STATUTS = ['ouverte', 'levee', 'controlee', 'refusee'];
  const LIBELLES = { ouverte: 'Ouverte', levee: 'Levée, à contrôler', controlee: 'Contrôlée', refusee: 'Refusée' };
  const TRANSITIONS = { ouverte: ['levee'], refusee: ['levee', 'ouverte'], levee: ['controlee', 'refusee', 'ouverte'], controlee: ['ouverte'] };

  const aCharge = (r) => r.statut === 'ouverte' || r.statut === 'refusee';
  const enRetard = (r, auj) => aCharge(r) && !!r.echeance && r.echeance < auj;
  const joursRetard = (r, auj) => (enRetard(r, auj) ? ecart(r.echeance, auj) : 0);
  const proche = (r, auj, alerte) => aCharge(r) && !!r.echeance && r.echeance >= auj && ecart(auj, r.echeance) <= alerte;
  // Jours depuis la levée déclarée (réserve à contrôler).
  const attenteControle = (r, auj) => (r.statut === 'levee' && r.leveeLe ? Math.max(0, ecart(r.leveeLe, auj)) : 0);

  // État affiché : le retard prime sur le statut.
  function etat(r, auj) {
    if (enRetard(r, auj)) return 'retard';
    return r.statut;
  }

  const echeanceDefaut = (depuis, delai) => ajout(depuis, Math.max(0, Math.round(Number(delai) || 0)));

  // Applique une transition et renvoie une NOUVELLE réserve (l'originale n'est pas modifiée).
  // opts : { date, note, echeance, delai }. Lève une erreur lisible si la transition est interdite.
  function transition(r, vers, opts = {}) {
    if (!STATUTS.includes(vers)) throw new Error('Statut inconnu.');
    if (!(TRANSITIONS[r.statut] || []).includes(vers)) throw new Error(`Passage impossible : « ${LIBELLES[r.statut]} » vers « ${LIBELLES[vers]} ».`);
    const date = opts.date;
    if (!estDate(date)) throw new Error('Date invalide.');
    const note = String(opts.note || '').trim();
    const n = { ...r, historique: [...(r.historique || [])] };
    if (vers === 'levee') {
      if (date < r.constat) throw new Error('La levée ne peut pas précéder le constat.');
      n.leveeLe = date; n.controleLe = null;
    } else if (vers === 'controlee') {
      if (r.leveeLe && date < r.leveeLe) throw new Error('Le contrôle ne peut pas précéder la levée.');
      n.controleLe = date;
    } else if (vers === 'refusee') {
      if (!note) throw new Error('Indique le motif du refus : l\'entreprise doit savoir quoi reprendre.');
      if (r.leveeLe && date < r.leveeLe) throw new Error('Le contrôle ne peut pas précéder la levée.');
      const ech = opts.echeance || echeanceDefaut(date, opts.delai ?? 15);
      if (!estDate(ech) || ech < date) throw new Error('La nouvelle échéance doit suivre la date du contrôle.');
      n.motifRefus = note; n.echeance = ech; n.controleLe = null; n.leveeLe = null;
    } else if (vers === 'ouverte') {
      if (opts.echeance) {
        if (!estDate(opts.echeance)) throw new Error('Échéance invalide.');
        n.echeance = opts.echeance;
      }
      n.leveeLe = null; n.controleLe = null;
    }
    n.statut = vers;
    n.historique.push({ date, statut: vers, note });
    return n;
  }

  // Numéro suivant dans une opération : R-001, R-002… (le plus grand + 1, sans réutiliser un trou).
  function prochainNumero(reserves, operationId) {
    const max = reserves.filter((r) => r.operationId === operationId)
      .reduce((m, r) => Math.max(m, Number(String(r.numero || '').replace(/\D/g, '')) || 0), 0);
    return `R-${String(max + 1).padStart(3, '0')}`;
  }

  // ---------- Tri et filtres ----------
  // Rang : 0 retard, 1 à contrôler, 2 échéance proche, 3 à lever, 4 contrôlée.
  function rang(r, auj, alerte) {
    if (enRetard(r, auj)) return 0;
    if (r.statut === 'levee') return 1;
    if (proche(r, auj, alerte)) return 2;
    if (aCharge(r)) return 3;
    return 4;
  }
  function trier(liste, auj, alerte = 7) {
    return [...liste].sort((a, b) => rang(a, auj, alerte) - rang(b, auj, alerte)
      || (rang(a, auj, alerte) === 1 ? (a.leveeLe || '').localeCompare(b.leveeLe || '') : 0)
      || (rang(a, auj, alerte) === 4 ? (b.controleLe || '').localeCompare(a.controleLe || '') : 0)
      || (a.echeance || '9999').localeCompare(b.echeance || '9999')
      || String(a.numero).localeCompare(String(b.numero)));
  }

  // Minuscules sans accents pour la recherche.
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // f : { operationId, lotId, entrepriseId, statut, texte } ;
  // statut ∈ tous | en-cours (hors contrôlées) | a-lever | retard | levee | controlee | refusee | ouverte.
  // noms(r) renvoie le texte indexé en plus de la réserve (lot, entreprise) ; facultatif.
  function filtrer(liste, f = {}, auj, noms = () => '') {
    const mots = plat(f.texte || '').split(/\s+/).filter(Boolean);
    return liste.filter((r) => {
      if (f.operationId && r.operationId !== f.operationId) return false;
      if (f.lotId && r.lotId !== f.lotId) return false;
      if (f.entrepriseId && r.entrepriseId !== f.entrepriseId) return false;
      const s = f.statut || 'tous';
      if (s === 'en-cours' && r.statut === 'controlee') return false;
      if (s === 'a-lever' && !aCharge(r)) return false;
      if (s === 'retard' && !enRetard(r, auj)) return false;
      if (['levee', 'controlee', 'refusee', 'ouverte'].includes(s) && r.statut !== s) return false;
      if (mots.length) {
        const texte = plat([r.numero, r.batiment, r.niveau, r.local, r.description, r.nature, r.photo, noms(r)].join(' '));
        if (!mots.every((m) => texte.includes(m))) return false;
      }
      return true;
    });
  }

  // ---------- Indicateurs ----------
  function indicateurs(liste, auj) {
    const i = { total: liste.length, ouvertes: 0, refusees: 0, aControler: 0, controlees: 0, retard: 0, restantes: 0, taux: null, plusAncienRetard: 0 };
    for (const r of liste) {
      if (r.statut === 'ouverte') i.ouvertes++;
      else if (r.statut === 'refusee') i.refusees++;
      else if (r.statut === 'levee') i.aControler++;
      else if (r.statut === 'controlee') i.controlees++;
      if (enRetard(r, auj)) { i.retard++; i.plusAncienRetard = Math.max(i.plusAncienRetard, joursRetard(r, auj)); }
    }
    i.restantes = i.ouvertes + i.refusees;
    i.taux = i.total ? Math.round((i.controlees / i.total) * 100) : null;
    return i;
  }

  // Regroupe par clé (lotId, entrepriseId…) : [{ cle, ...indicateurs }], triés par restantes puis retard.
  function parCle(liste, cle, auj) {
    const groupes = new Map();
    for (const r of liste) {
      const k = r[cle] || '';
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(r);
    }
    return [...groupes].map(([k, l]) => ({ cle: k, ...indicateurs(l, auj) }))
      .sort((a, b) => b.retard - a.retard || b.restantes - a.restantes || b.aControler - a.aControler || b.total - a.total);
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // etat : { operations, lots, entreprises, reserves } ; liste : réserves à exporter (défaut : toutes).
  function csv(etat, auj, liste = etat.reserves) {
    const op = (id) => etat.operations.find((o) => o.id === id);
    const lot = (id) => etat.lots.find((l) => l.id === id);
    const ent = (id) => etat.entreprises.find((e) => e.id === id);
    const entetes = ['Opération', 'Numéro', 'Bâtiment', 'Niveau', 'Local', 'Lot', 'Entreprise', 'Nature', 'Description', 'Constat', 'Échéance', 'Statut', 'Jours de retard', 'Levée le', 'Contrôlée le', 'Motif du dernier refus', 'Référence photo'];
    const ordre = [...liste].sort((a, b) => (op(a.operationId)?.nom || '').localeCompare(op(b.operationId)?.nom || '') || String(a.numero).localeCompare(String(b.numero)));
    const lignes = ordre.map((r) => {
      const l = lot(r.lotId);
      return [op(r.operationId)?.nom || '', r.numero, r.batiment, r.niveau, r.local, l ? `${l.code} ${l.nom}`.trim() : '', ent(r.entrepriseId)?.nom || '', r.nature, r.description,
        dateFr(r.constat), dateFr(r.echeance), enRetard(r, auj) ? 'En retard' : LIBELLES[r.statut], joursRetard(r, auj) || '', dateFr(r.leveeLe), dateFr(r.controleLe), r.motifRefus || '', r.photo || ''];
    });
    return `﻿${[entetes, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, STATUTS, LIBELLES, TRANSITIONS, aCharge, enRetard, joursRetard, proche, attenteControle, etat,
    echeanceDefaut, transition, prochainNumero, rang, trier, plat, filtrer, indicateurs, parCle, champCsv, dateFr, csv, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
