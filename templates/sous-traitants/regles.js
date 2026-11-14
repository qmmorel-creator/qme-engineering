// Règles métier de la conformité des sous-traitants : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/sous-traitants.test.mjs).
// Toutes les fonctions qui dépendent du jour reçoivent la date de référence `auj` (AAAA-MM-JJ).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  // Ajoute n mois ; le jour est borné à la fin du mois (31 août + 6 mois = 28 ou 29 février).
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const t = (m - 1) + n;
    const an = a + Math.floor(t / 12), mo = ((t % 12) + 12) % 12;
    const fin = new Date(an, mo + 1, 0).getDate();
    return `${an}-${deux(mo + 1)}-${deux(Math.min(j, fin))}`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nombre = (v) => { const n = Number(String(v ?? '').replace(/[\s  €]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const arrondi = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const txt = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const dt = (v) => (estDate(v) ? v : '');
  const choix = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
  const entier = (v, min, max, defaut) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : defaut; };

  function typesDefaut(base) {
    return base.typesPieces.map((t) => ({ code: t.code, nom: t.nom, court: t.court, validiteMois: t.validiteMois, depart: t.depart, portee: t.portee, source: t.source || '', aide: t.aide || '', base: true }));
  }
  function reglagesDefaut(base) {
    return { j30: base.alerteJ30, j15: base.alerteJ15, seuil: base.seuilVigilance, relanceJours: base.relanceJours, modele: { ...base.modeleRelance }, types: typesDefaut(base) };
  }
  const etatVide = (base) => ({ version: 1, structure: '', reglages: reglagesDefaut(base), operations: [], entreprises: [], intervenants: [], pieces: [], relances: [] });

  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const portees = base.portees.map((p) => p.code);
    const r = d.reglages && typeof d.reglages === 'object' ? d.reglages : {};
    const types = Array.isArray(r.types) && r.types.length ? r.types : v.reglages.types;
    const n = {
      ...d,
      version: 1,
      structure: txt(d.structure, 80),
      reglages: {
        j30: entier(r.j30, 1, 180, v.reglages.j30),
        j15: entier(r.j15, 0, 180, v.reglages.j15),
        seuil: Number.isFinite(Number(r.seuil)) && Number(r.seuil) >= 0 ? Number(r.seuil) : v.reglages.seuil,
        relanceJours: entier(r.relanceJours, 0, 90, v.reglages.relanceJours),
        modele: { objet: txt(r.modele?.objet, 200) || v.reglages.modele.objet, corps: String(r.modele?.corps ?? '').slice(0, 4000) || v.reglages.modele.corps },
        types: types.filter((t) => t && t.code).map((t) => ({ code: txt(t.code, 8), nom: txt(t.nom, 120) || t.code, court: txt(t.court, 30) || txt(t.nom, 30) || t.code,
          validiteMois: entier(t.validiteMois, 1, 120, 6), depart: choix(t.depart, ['emission', 'fin'], 'emission'), portee: choix(t.portee, portees, 'facultatif'),
          source: txt(t.source, 30), aide: txt(t.aide, 400), base: !!t.base })),
      },
    };
    if (n.reglages.j15 > n.reglages.j30) n.reglages.j15 = n.reglages.j30;
    const liste = (k) => (Array.isArray(d[k]) ? d[k] : []).filter((x) => x && typeof x === 'object' && x.id);
    n.operations = liste('operations').map((o) => ({ nom: 'Opération', maitreOuvrage: '', reference: '', ville: '', debut: '', fin: '', marchePublic: false, close: false, notes: '', ...o }));
    n.entreprises = liste('entreprises').map((e) => ({ nom: 'Entreprise', siret: '', ville: '', etranger: false, employeur: true, contact: '', email: '', telephone: '', notes: '', ...e }));
    n.intervenants = liste('intervenants').map((i) => ({ operationId: '', entrepriseId: '', lot: '', donneurId: '', objet: '', montantHT: '', debut: '', fin: '', decennale: true,
      acceptation: 'a-declarer', dateDemande: '', dateAcceptation: '', paiementAgree: false, paiementDirect: false, notes: '', ...i }));
    n.pieces = liste('pieces').map((p) => ({ entrepriseId: '', type: '', date: '', fin: '', recueLe: '', verifiee: false, reference: '', notes: '', ...p }));
    n.relances = liste('relances').map((x) => ({ entrepriseId: '', date: '', types: [], canal: 'E-mail', notes: '', ...x, types: Array.isArray(x.types) ? x.types : [] }));
    return n;
  }

  // ---------- Pièces ----------
  const typeDe = (etat, code) => (etat.reglages.types || []).find((t) => t.code === code) || null;

  // Échéance d'une pièce : date de fin saisie (prioritaire), sinon délivrance + validité du type.
  function echeancePiece(piece, type) {
    if (estDate(piece.fin)) return piece.fin;
    if (!type || !estDate(piece.date)) return '';
    return ajoutMois(piece.date, type.validiteMois);
  }

  // État d'une échéance : expirée (dépassée), j15, j30 (dans les seuils), valide.
  function etatEcheance(echeance, auj, rg) {
    if (!echeance) return 'manquante';
    const n = ecart(auj, echeance);
    if (n < 0) return 'expiree';
    if (n <= rg.j15) return 'j15';
    if (n <= rg.j30) return 'j30';
    return 'valide';
  }

  // Pièce en cours d'un type pour une entreprise : celle dont l'échéance est la plus tardive.
  function pieceCourante(etat, entrepriseId, code) {
    const type = typeDe(etat, code);
    const l = etat.pieces.filter((p) => p.entrepriseId === entrepriseId && p.type === code)
      .map((p) => ({ p, ech: echeancePiece(p, type) })).filter((x) => x.ech)
      .sort((a, b) => b.ech.localeCompare(a.ech) || String(b.p.date).localeCompare(String(a.p.date)));
    return l[0] || null;
  }

  // ---------- Intervenants ----------
  const operation = (etat, id) => etat.operations.find((o) => o.id === id);
  const entreprise = (etat, id) => etat.entreprises.find((e) => e.id === id);
  const intervenant = (etat, id) => etat.intervenants.find((i) => i.id === id);

  // Rang dans la chaîne : 0 = titulaire (contrat avec le maître d'ouvrage), 1 = sous-traitant direct…
  function rang(etat, it) {
    let n = 0, cur = it;
    const vus = new Set([it.id]);
    while (cur && cur.donneurId) {
      const p = intervenant(etat, cur.donneurId);
      if (!p || vus.has(p.id)) break;
      vus.add(p.id); n++; cur = p;
    }
    return n;
  }

  // Une intervention compte tant que l'opération n'est pas close et que sa date de fin n'est pas passée.
  function actif(etat, it, auj) {
    const op = operation(etat, it.operationId);
    if (!op || op.close) return false;
    return !estDate(it.fin) || it.fin >= auj;
  }

  // Pièces exigées pour une intervention, selon la portée de chaque type. Montant inconnu : exigé (prudence).
  function piecesExigees(etat, it) {
    const e = entreprise(etat, it.entrepriseId);
    const montant = it.montantHT === '' || it.montantHT === null || it.montantHT === undefined ? null : nombre(it.montantHT);
    const auSeuil = montant === null || montant >= etat.reglages.seuil;
    return (etat.reglages.types || []).filter((t) => {
      if (t.portee === 'vigilance') return auSeuil;
      if (t.portee === 'employeur') return auSeuil && (!e || e.employeur !== false);
      if (t.portee === 'travaux') return it.decennale !== false;
      if (t.portee === 'toujours') return true;
      return false;
    });
  }

  // État de chaque pièce exigée pour une entreprise.
  function etatPieces(etat, entrepriseId, types, auj) {
    return types.map((t) => {
      const c = pieceCourante(etat, entrepriseId, t.code);
      const ech = c ? c.ech : '';
      return { type: t, piece: c ? c.p : null, echeance: ech, etat: etatEcheance(ech, auj, etat.reglages), jours: ech ? ecart(auj, ech) : null };
    });
  }

  // Acceptation du sous-traitant et agrément des conditions de paiement (titulaire : sans objet).
  // ok ; partielle (accepté, paiement non agréé) ; attente (demande avant le début) ;
  // manquante (non accepté alors que l'intervention a commencé) ; refuse.
  function etatAcceptation(etat, it, auj) {
    if (!it.donneurId) return 'sans-objet';
    if (it.acceptation === 'refuse') return 'refuse';
    if (it.acceptation === 'accepte') return it.paiementAgree ? 'ok' : 'partielle';
    const commence = estDate(it.debut) ? it.debut <= auj : true;
    return commence ? 'manquante' : 'attente';
  }

  const ROUGE = new Set(['manquante', 'expiree']);
  const JAUNE = new Set(['j15', 'j30']);

  // Conformité d'une intervention : non-conforme, a-surveiller, conforme, ou terminee (hors suivi).
  function conformite(etat, it, auj) {
    const types = piecesExigees(etat, it);
    const pieces = etatPieces(etat, it.entrepriseId, types, auj);
    const acc = etatAcceptation(etat, it, auj);
    const enCours = actif(etat, it, auj);
    let niveau = 'conforme';
    if (pieces.some((p) => ROUGE.has(p.etat)) || acc === 'manquante' || acc === 'refuse') niveau = 'non-conforme';
    else if (pieces.some((p) => JAUNE.has(p.etat)) || acc === 'attente' || acc === 'partielle') niveau = 'a-surveiller';
    if (!enCours) niveau = 'terminee';
    const prochaine = pieces.filter((p) => p.echeance && p.etat !== 'expiree').map((p) => p.echeance).sort()[0] || '';
    return { intervenant: it, niveau, pieces, acceptation: acc, rang: rang(etat, it), prochaine, manques: pieces.filter((p) => ROUGE.has(p.etat)).length };
  }

  // Tableau de conformité d'une opération : lignes triées par lot puis chaîne de sous-traitance.
  function tableauOperation(etat, operationId, auj) {
    const its = etat.intervenants.filter((i) => i.operationId === operationId);
    const ordre = [];
    const ajouter = (it) => { ordre.push(it); its.filter((x) => x.donneurId === it.id).sort((a, b) => nomE(etat, a).localeCompare(nomE(etat, b), 'fr')).forEach(ajouter); };
    const racines = its.filter((i) => !i.donneurId || !its.some((x) => x.id === i.donneurId))
      .sort((a, b) => String(a.lot).localeCompare(String(b.lot), 'fr', { numeric: true }) || nomE(etat, a).localeCompare(nomE(etat, b), 'fr'));
    racines.forEach(ajouter);
    for (const i of its) if (!ordre.includes(i)) ordre.push(i); // cycles éventuels
    const lignes = ordre.map((it) => conformite(etat, it, auj));
    const suivies = lignes.filter((l) => l.niveau !== 'terminee');
    const compte = (n) => suivies.filter((l) => l.niveau === n).length;
    return { lignes, total: suivies.length, conformes: compte('conforme'), surveiller: compte('a-surveiller'), nonConformes: compte('non-conforme'),
      taux: suivies.length ? compte('conforme') / suivies.length : null };
  }
  const nomE = (etat, it) => entreprise(etat, it.entrepriseId)?.nom || '';

  // ---------- Alertes ----------
  // Une alerte par pièce et par entreprise (toutes opérations confondues), plus une par acceptation.
  function alertes(etat, auj) {
    const parPiece = new Map();
    const acc = [];
    for (const it of etat.intervenants) {
      if (!actif(etat, it, auj)) continue;
      const c = conformite(etat, it, auj);
      for (const p of c.pieces) {
        if (p.etat === 'valide') continue;
        const cle = `${it.entrepriseId}:${p.type.code}`;
        const a = parPiece.get(cle) || { cle, genre: 'piece', entrepriseId: it.entrepriseId, code: p.type.code, etat: p.etat, echeance: p.echeance, jours: p.jours, intervenantIds: [], operationIds: [] };
        a.intervenantIds.push(it.id);
        if (!a.operationIds.includes(it.operationId)) a.operationIds.push(it.operationId);
        parPiece.set(cle, a);
      }
      if (['manquante', 'refuse', 'attente', 'partielle'].includes(c.acceptation)) {
        acc.push({ cle: `acc:${it.id}`, genre: 'acceptation', entrepriseId: it.entrepriseId, etat: c.acceptation, intervenantIds: [it.id], operationIds: [it.operationId], debut: it.debut, jours: estDate(it.debut) ? ecart(auj, it.debut) : null });
      }
    }
    const poids = { expiree: 0, manquante: 0, refuse: 0, j15: 1, j30: 2, partielle: 3, attente: 3 };
    const liste = [...parPiece.values(), ...acc].map((a) => ({ ...a, gravite: poids[a.etat] === 0 ? 'rouge' : 'jaune', derniereRelance: derniereRelance(etat, a.entrepriseId) }));
    return liste.sort((a, b) => poids[a.etat] - poids[b.etat] || (a.jours ?? -9999) - (b.jours ?? -9999) || nomEnt(etat, a.entrepriseId).localeCompare(nomEnt(etat, b.entrepriseId), 'fr'));
  }
  const nomEnt = (etat, id) => entreprise(etat, id)?.nom || '';

  // ---------- Relances ----------
  function derniereRelance(etat, entrepriseId) {
    return etat.relances.filter((r) => r.entrepriseId === entrepriseId && estDate(r.date)).map((r) => r.date).sort().pop() || '';
  }
  // Entreprises à relancer : au moins une pièce manquante, expirée ou à J-15 / J-30, sans relance
  // depuis relanceJours. Renvoie [{ entrepriseId, codes, operationIds, derniere, pire }].
  function aRelancer(etat, auj) {
    const m = new Map();
    for (const a of alertes(etat, auj)) {
      if (a.genre !== 'piece') continue;
      const x = m.get(a.entrepriseId) || { entrepriseId: a.entrepriseId, codes: [], operationIds: [], derniere: a.derniereRelance, pire: 'jaune' };
      x.codes.push(a.code);
      a.operationIds.forEach((o) => { if (!x.operationIds.includes(o)) x.operationIds.push(o); });
      if (a.gravite === 'rouge') x.pire = 'rouge';
      m.set(a.entrepriseId, x);
    }
    return [...m.values()].filter((x) => !x.derniere || ecart(x.derniere, auj) >= etat.reglages.relanceJours)
      .sort((a, b) => (a.pire === b.pire ? 0 : a.pire === 'rouge' ? -1 : 1) || nomEnt(etat, a.entrepriseId).localeCompare(nomEnt(etat, b.entrepriseId), 'fr'));
  }

  // Texte de relance à partir du modèle : {entreprise}, {pieces}, {operations}, {structure}, {date}.
  function texteRelance(etat, entrepriseId, codes, operationIds, auj) {
    const e = entreprise(etat, entrepriseId);
    const lignes = codes.map((c) => {
      const t = typeDe(etat, c);
      const cur = pieceCourante(etat, entrepriseId, c);
      const quoi = !cur ? 'à transmettre' : cur.ech < auj ? `expirée le ${dateFr(cur.ech)}` : `expire le ${dateFr(cur.ech)}`;
      return `- ${t ? t.nom : c} (${quoi})`;
    }).join('\n');
    const ops = operationIds.map((o) => operation(etat, o)?.nom).filter(Boolean).join(', ') || '—';
    const remplir = (s) => String(s).replace(/\{entreprise\}/g, e?.nom || '').replace(/\{pieces\}/g, lignes).replace(/\{operations\}/g, ops)
      .replace(/\{structure\}/g, etat.structure || '').replace(/\{date\}/g, dateFr(auj));
    return { objet: remplir(etat.reglages.modele.objet), corps: remplir(etat.reglages.modele.corps).replace(/\n{3,}/g, '\n\n').trim() };
  }

  // ---------- CSV (point-virgule, UTF-8 avec BOM, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;

  const LIB_NIVEAU = { conforme: 'Conforme', 'a-surveiller': 'À surveiller', 'non-conforme': 'Non conforme', terminee: 'Terminée' };
  const LIB_PIECE = { valide: 'Valide', j30: 'Expire bientôt', j15: 'Expire très bientôt', expiree: 'Expirée', manquante: 'Manquante' };
  const LIB_ACC = { 'sans-objet': 'Titulaire', ok: 'Accepté, paiement agréé', partielle: 'Accepté, paiement à agréer', attente: 'Demande en cours', manquante: 'Non accepté', refuse: 'Refusé' };

  const COLONNES_REGISTRE = ['Opération', 'Lot', 'Entreprise', 'SIRET', 'Rang', 'Donneur d\'ordre', 'Objet', 'Montant HT', 'Début', 'Fin', 'Acceptation', 'Demande le', 'Acceptée le', 'Paiement agréé', 'Paiement direct', 'Pièces manquantes ou expirées', 'Prochaine échéance', 'Conformité'];
  function csvRegistre(etat, auj, operationId = '') {
    const ops = etat.operations.filter((o) => !operationId || o.id === operationId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const lignes = [];
    for (const op of ops) {
      for (const l of tableauOperation(etat, op.id, auj).lignes) {
        const it = l.intervenant, e = entreprise(etat, it.entrepriseId);
        const donneur = it.donneurId ? nomE(etat, intervenant(etat, it.donneurId) || {}) : 'Maître d\'ouvrage';
        lignes.push([op.nom, it.lot, e?.nom || '', e?.siret || '', l.rang === 0 ? 'Titulaire' : `Rang ${l.rang}`, donneur, it.objet,
          it.montantHT === '' || it.montantHT == null ? '' : nombre(it.montantHT), dateFr(it.debut), dateFr(it.fin), LIB_ACC[l.acceptation],
          dateFr(it.dateDemande), dateFr(it.dateAcceptation), it.donneurId ? (it.paiementAgree ? 'oui' : 'non') : '', it.donneurId ? (it.paiementDirect ? 'oui' : 'non') : '',
          l.pieces.filter((p) => ROUGE.has(p.etat)).map((p) => `${p.type.court} (${LIB_PIECE[p.etat].toLowerCase()})`).join(', '), dateFr(l.prochaine), LIB_NIVEAU[l.niveau]]);
      }
    }
    return versCsv([COLONNES_REGISTRE, ...lignes]);
  }

  const COLONNES_PIECES = ['Entreprise', 'Pièce', 'Délivrée le', 'Valable jusqu\'au', 'État', 'Reçue le', 'Authenticité vérifiée', 'Référence', 'Notes'];
  function csvPieces(etat, auj) {
    const lignes = etat.pieces.map((p) => {
      const t = typeDe(etat, p.type);
      const ech = echeancePiece(p, t);
      return [entreprise(etat, p.entrepriseId)?.nom || '', t ? t.nom : p.type, dateFr(p.date), dateFr(ech), LIB_PIECE[etatEcheance(ech, auj, etat.reglages)], dateFr(p.recueLe), p.verifiee ? 'oui' : 'non', p.reference, p.notes];
    }).sort((a, b) => a[0].localeCompare(b[0], 'fr') || a[1].localeCompare(b[1], 'fr'));
    return versCsv([COLONNES_PIECES, ...lignes]);
  }

  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = {
    iso, versDate, ajout, ecart, estDate, dateFr, ajoutMois, plat, nombre, arrondi,
    etatVide, reglagesDefaut, typesDefaut, normaliser, typeDe, echeancePiece, etatEcheance, pieceCourante,
    rang, actif, piecesExigees, etatPieces, etatAcceptation, conformite, tableauOperation, alertes,
    derniereRelance, aRelancer, texteRelance, champCsv, csvRegistre, csvPieces, COLONNES_REGISTRE, COLONNES_PIECES,
    LIB_NIVEAU, LIB_PIECE, LIB_ACC, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
