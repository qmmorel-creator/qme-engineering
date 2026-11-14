// Règles métier du registre du DOE : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/doe.test.mjs).
// Contexte de calcul `ctx` : { auj: 'AAAA-MM-JJ', ops: { [id]: opération }, alerte: jours }.
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Minuscules sans accents, pour la recherche et les doublons.
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  // ---------- Statuts ----------
  // attendue : pas encore remise ; recue : remise, à vérifier ; a-reprendre : vérification négative,
  // à renvoyer ; validee : vérifiée et acceptée, entre dans le DOE.
  const STATUTS = ['attendue', 'recue', 'a-reprendre', 'validee'];
  const LIBELLES = { attendue: 'Attendue', recue: 'Reçue, à vérifier', 'a-reprendre': 'À reprendre', validee: 'Validée' };
  const TRANSITIONS = { attendue: ['recue'], recue: ['validee', 'a-reprendre', 'attendue'], 'a-reprendre': ['recue', 'attendue'], validee: ['a-reprendre', 'attendue'] };

  const aCharge = (p) => p.statut === 'attendue' || p.statut === 'a-reprendre';
  // Date limite d'une pièce : la sienne, sinon celle de l'opération (date limite de remise du DOE).
  const echeance = (p, ctx = {}) => p.echeance || ctx.ops?.[p.operationId]?.dateLimite || '';
  const enRetard = (p, ctx) => { const e = echeance(p, ctx); return aCharge(p) && !!e && e < ctx.auj; };
  const joursRetard = (p, ctx) => (enRetard(p, ctx) ? ecart(echeance(p, ctx), ctx.auj) : 0);
  const proche = (p, ctx) => { const e = echeance(p, ctx); return aCharge(p) && !!e && e >= ctx.auj && ecart(ctx.auj, e) <= (ctx.alerte ?? 7); };
  const etat = (p, ctx) => (enRetard(p, ctx) ? 'retard' : p.statut);

  // Applique une transition et renvoie une NOUVELLE pièce (l'originale n'est pas modifiée).
  // opts : { date, note, echeance, reference, format, delai }.
  function transition(p, vers, opts = {}) {
    if (!STATUTS.includes(vers)) throw new Error('Statut inconnu.');
    if (!(TRANSITIONS[p.statut] || []).includes(vers)) throw new Error(`Passage impossible : « ${LIBELLES[p.statut]} » vers « ${LIBELLES[vers]} ».`);
    const date = opts.date;
    if (!estDate(date)) throw new Error('Date invalide.');
    const note = String(opts.note || '').trim();
    const n = { ...p, historique: [...(p.historique || [])] };
    if (vers === 'recue') {
      n.recueLe = date; n.valideeLe = null;
      if (opts.reference !== undefined) n.reference = String(opts.reference || '').trim();
      if (opts.format) n.format = opts.format;
    } else if (vers === 'validee') {
      if (p.recueLe && date < p.recueLe) throw new Error('La validation ne peut pas précéder la réception.');
      n.valideeLe = date;
    } else if (vers === 'a-reprendre') {
      if (!note) throw new Error('Indique le motif : l\'entreprise doit savoir quoi reprendre.');
      if (p.recueLe && date < p.recueLe) throw new Error('La vérification ne peut pas précéder la réception.');
      const ech = opts.echeance || ajout(date, Math.max(0, Math.round(Number(opts.delai ?? 15) || 0)));
      if (!estDate(ech) || ech < date) throw new Error('La nouvelle date doit suivre la date de vérification.');
      n.motif = note; n.echeance = ech; n.valideeLe = null;
    } else if (vers === 'attendue') {
      n.recueLe = null; n.valideeLe = null;
    }
    n.statut = vers;
    n.historique.push({ date, statut: vers, note });
    return n;
  }

  // Numéro suivant dans une opération : P-001, P-002… (le plus grand + 1, sans réutiliser un trou).
  function prochainNumero(pieces, operationId) {
    const max = pieces.filter((p) => p.operationId === operationId)
      .reduce((m, p) => Math.max(m, Number(String(p.numero || '').replace(/\D/g, '')) || 0), 0);
    return `P-${String(max + 1).padStart(3, '0')}`;
  }

  // ---------- Pièces types ----------
  // Pièces types d'un lot : celles modifiées par l'utilisateur (modeles[code]) sinon celles de la base.
  function piecesTypes(code, modeles, base) {
    if (modeles && Array.isArray(modeles[code])) return modeles[code];
    return base.lots.find((l) => l.code === code)?.pieces || [];
  }

  // Pièces à créer pour un lot : pièces types (+ DIUO si l'opération en comporte un), sans doublon avec
  // les pièces déjà présentes sur le lot (même intitulé). Renvoie des objets sans id ni numéro.
  function aCreer(lot, { modeles, base, existantes = [], diuo = false }) {
    const deja = new Set(existantes.filter((p) => p.lotId === lot.id).map((p) => plat(p.intitule)));
    const liste = [...piecesTypes(lot.code, modeles, base)];
    if (diuo) liste.push([base.pieceDiuo.famille, base.pieceDiuo.intitule]);
    const sortie = [];
    for (const [famille, intitule] of liste) {
      const k = plat(intitule);
      if (!k || deja.has(k)) continue;
      deja.add(k);
      sortie.push({ operationId: lot.operationId, lotId: lot.id, famille, intitule, statut: 'attendue', echeance: '', recueLe: null, valideeLe: null, reference: '', format: '', motif: '', historique: [] });
    }
    return sortie;
  }

  // ---------- Indicateurs et complétude ----------
  function indicateurs(liste, ctx) {
    const i = { total: liste.length, attendues: 0, recues: 0, aReprendre: 0, validees: 0, retard: 0, proches: 0, plusAncienRetard: 0, completude: null, remises: null };
    for (const p of liste) {
      if (p.statut === 'attendue') i.attendues++;
      else if (p.statut === 'recue') i.recues++;
      else if (p.statut === 'a-reprendre') i.aReprendre++;
      else if (p.statut === 'validee') i.validees++;
      if (enRetard(p, ctx)) { i.retard++; i.plusAncienRetard = Math.max(i.plusAncienRetard, joursRetard(p, ctx)); }
      else if (proche(p, ctx)) i.proches++;
    }
    // Complétude : part des pièces validées. Remises : part des pièces reçues ou validées.
    i.completude = i.total ? Math.floor((i.validees / i.total) * 100) : null;
    i.remises = i.total ? Math.floor(((i.validees + i.recues) / i.total) * 100) : null;
    return i;
  }

  // Regroupe selon cle(p) : [{ cle, ...indicateurs }], le moins complet d'abord.
  function parCle(liste, cle, ctx) {
    const groupes = new Map();
    for (const p of liste) {
      const k = cle(p) || '';
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(p);
    }
    return [...groupes].map(([k, l]) => ({ cle: k, ...indicateurs(l, ctx) }))
      .sort((a, b) => b.retard - a.retard || (a.completude ?? 101) - (b.completude ?? 101) || b.total - a.total);
  }

  // ---------- Relances ----------
  // Entreprises à relancer : pour chaque couple (opération, entreprise) ayant des pièces en retard,
  // { operationId, entrepriseId, pieces, nb (relances déjà faites), derniere, due }.
  // due : aucune relance, ou la dernière date d'au moins `intervalle` jours.
  // entrepriseDe(p) renvoie l'entreprise de la pièce (titulaire de son lot).
  function relancesDues(pieces, relances, entrepriseDe, ctx, intervalle = 7) {
    const groupes = new Map();
    for (const p of pieces) {
      if (!enRetard(p, ctx)) continue;
      const e = entrepriseDe(p) || '';
      const k = `${p.operationId}|${e}`;
      if (!groupes.has(k)) groupes.set(k, { operationId: p.operationId, entrepriseId: e, pieces: [] });
      groupes.get(k).pieces.push(p);
    }
    return [...groupes.values()].map((x) => {
      const faites = relances.filter((r) => r.operationId === x.operationId && r.entrepriseId === x.entrepriseId && r.date <= ctx.auj)
        .sort((a, b) => b.date.localeCompare(a.date));
      const derniere = faites[0]?.date || null;
      const depuis = derniere ? ecart(derniere, ctx.auj) : null;
      return { ...x, nb: faites.length, derniere, depuis, due: !derniere || depuis >= intervalle, plusAncien: Math.max(...x.pieces.map((p) => joursRetard(p, ctx))) };
    }).sort((a, b) => Number(b.due) - Number(a.due) || b.plusAncien - a.plusAncien || b.pieces.length - a.pieces.length);
  }

  // Texte du courrier de relance (modèle à relire et adapter ; aucun envoi par l'outil).
  // d : { structure, operation:{nom,moa,dateLimite}, entreprise:{nom,contact}, pieces:[{numero,lot,intitule,statut,motif,echeance}],
  //       date, rang (1 = première relance), nouvelleDate }
  function texteRelance(d) {
    const rang = d.rang > 1 ? `${d.rang}e relance` : 'Relance';
    const lignes = d.pieces.map((p) => `- ${p.numero} · ${p.lot} · ${p.intitule}${p.statut === 'a-reprendre' ? ` (à reprendre : ${p.motif || 'voir observations'})` : ''}${p.echeance ? `, attendue le ${dateFr(p.echeance)}` : ''}`);
    return [
      `${d.structure || 'Maîtrise d\'œuvre'}`,
      `Le ${dateFr(d.date)}`,
      '',
      `À l'attention de : ${d.entreprise.nom}${d.entreprise.contact ? `, ${d.entreprise.contact}` : ''}`,
      `Opération : ${d.operation.nom}${d.operation.moa ? ` (maître d'ouvrage : ${d.operation.moa})` : ''}`,
      `Objet : ${rang} · pièces du dossier des ouvrages exécutés (DOE)`,
      '',
      'Madame, Monsieur,',
      '',
      `Sauf erreur de notre part, les pièces suivantes du DOE de votre lot ne nous sont pas parvenues ou sont à reprendre (${d.pieces.length} pièce${d.pieces.length > 1 ? 's' : ''}) :`,
      '',
      ...lignes,
      '',
      `Nous vous remercions de nous les transmettre${d.nouvelleDate ? ` au plus tard le ${dateFr(d.nouvelleDate)}` : ' dans les meilleurs délais'}, conformément aux pièces de votre marché.`,
      '',
      'Nous restons à votre disposition pour toute précision et vous prions d\'agréer, Madame, Monsieur, nos salutations distinguées.',
      '',
      `${d.structure || 'La maîtrise d\'œuvre'}`,
    ].join('\n');
  }

  // ---------- Tri et filtres ----------
  // Rang : 0 retard, 1 reçue à vérifier, 2 à reprendre, 3 date proche, 4 attendue, 5 validée.
  function rang(p, ctx) {
    if (enRetard(p, ctx)) return 0;
    if (p.statut === 'recue') return 1;
    if (p.statut === 'a-reprendre') return 2;
    if (proche(p, ctx)) return 3;
    if (p.statut === 'attendue') return 4;
    return 5;
  }
  function trier(liste, ctx, ordreLot = () => 0) {
    return [...liste].sort((a, b) => rang(a, ctx) - rang(b, ctx)
      || (rang(a, ctx) === 0 ? echeance(a, ctx).localeCompare(echeance(b, ctx)) : 0)
      || (rang(a, ctx) === 1 ? (a.recueLe || '').localeCompare(b.recueLe || '') : 0)
      || ordreLot(a) - ordreLot(b)
      || String(a.numero).localeCompare(String(b.numero)));
  }

  // f : { operationId, lotIds:Set|null, entrepriseId, famille, statut, texte } ;
  // statut ∈ tous | manquantes (attendues + à reprendre) | retard | attendue | recue | a-reprendre | validee | a-traiter (hors validées).
  function filtrer(liste, f = {}, ctx, extra = () => '', entrepriseDe = () => '') {
    const mots = plat(f.texte || '').split(' ').filter(Boolean);
    return liste.filter((p) => {
      if (f.operationId && p.operationId !== f.operationId) return false;
      if (f.lotIds && !f.lotIds.has(p.lotId)) return false;
      if (f.entrepriseId && entrepriseDe(p) !== f.entrepriseId) return false;
      if (f.famille && p.famille !== f.famille) return false;
      const s = f.statut || 'tous';
      if (s === 'a-traiter' && p.statut === 'validee') return false;
      if (s === 'manquantes' && !aCharge(p)) return false;
      if (s === 'retard' && !enRetard(p, ctx)) return false;
      if (STATUTS.includes(s) && p.statut !== s) return false;
      if (mots.length) {
        const texte = plat([p.numero, p.intitule, p.reference, p.motif, extra(p)].join(' '));
        if (!mots.every((m) => texte.includes(m))) return false;
      }
      return true;
    });
  }

  // ---------- Bordereau de transmission ----------
  // Pièces à transmettre : validées (et reçues si avecRecues), regroupées dans l'ordre des lots puis des numéros.
  function bordereau(pieces, { avecRecues = false, ordreLot = () => 0 } = {}) {
    return pieces.filter((p) => p.statut === 'validee' || (avecRecues && p.statut === 'recue'))
      .sort((a, b) => ordreLot(a) - ordreLot(b) || String(a.numero).localeCompare(String(b.numero)));
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  // etat : { operations, lots, entreprises, pieces, relances } ; liste : pièces à exporter (défaut : toutes).
  function csv(etat, auj, liste = etat.pieces, familles = []) {
    const ops = Object.fromEntries(etat.operations.map((o) => [o.id, o]));
    const ctx = { auj, ops };
    const lot = (id) => etat.lots.find((l) => l.id === id);
    const ent = (id) => etat.entreprises.find((e) => e.id === id);
    const nomFamille = (c) => familles.find((x) => x.code === c)?.nom || c || '';
    const entetes = ['Opération', 'Numéro', 'Lot', 'Entreprise', 'Famille', 'Pièce', 'Statut', 'Date limite', 'Jours de retard', 'Reçue le', 'Validée le', 'Référence', 'Format', 'Motif de reprise', 'Relances', 'Dernière relance'];
    const ordre = [...liste].sort((a, b) => (ops[a.operationId]?.nom || '').localeCompare(ops[b.operationId]?.nom || '') || String(a.numero).localeCompare(String(b.numero)));
    const lignes = ordre.map((p) => {
      const l = lot(p.lotId);
      const r = (etat.relances || []).filter((x) => x.operationId === p.operationId && x.entrepriseId === l?.entrepriseId && (x.pieces || []).includes(p.id)).map((x) => x.date).sort();
      return [ops[p.operationId]?.nom || '', p.numero, l ? `${l.code} ${l.nom}`.trim() : '', ent(l?.entrepriseId)?.nom || '', nomFamille(p.famille), p.intitule,
        enRetard(p, ctx) ? 'En retard' : LIBELLES[p.statut], dateFr(echeance(p, ctx)), joursRetard(p, ctx) || '', dateFr(p.recueLe), dateFr(p.valideeLe), p.reference || '', p.format || '',
        p.statut === 'a-reprendre' ? p.motif || '' : '', r.length || '', dateFr(r.at(-1))];
    });
    return `﻿${[entetes, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, plat, STATUTS, LIBELLES, TRANSITIONS, aCharge, echeance, enRetard, joursRetard, proche, etat,
    transition, prochainNumero, piecesTypes, aCreer, indicateurs, parCle, relancesDues, texteRelance, rang, trier, filtrer, bordereau, champCsv, csv, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
