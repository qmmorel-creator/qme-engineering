// Règles métier du dossier sinistre habitation : fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/sinistre.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ (comparables comme des chaînes) ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ajoutMois = (s, n) => { const [a, m, j] = s.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(j, fin)); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (estDate(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // ---------- Jours fériés (calculés, métropole) et jours ouvrés ----------
  // Dimanche de Pâques (algorithme de Meeus / Jones / Butcher, calendrier grégorien).
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - gg + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  // Les 11 jours fériés légaux (article L3133-1 du Code du travail), hors jours propres à l'Alsace-Moselle et à l'outre-mer.
  function feries(annee) {
    const p = paques(annee);
    return new Set([`${annee}-01-01`, ajout(p, 1), `${annee}-05-01`, `${annee}-05-08`, ajout(p, 39), ajout(p, 50),
      `${annee}-07-14`, `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`]);
  }
  const estFerie = (s) => feries(Number(s.slice(0, 4))).has(s);
  // Jour ouvré : du lundi au vendredi, hors jour férié.
  const estOuvre = (s) => { const j = versDate(s).getDay(); return j !== 0 && j !== 6 && !estFerie(s); };
  // n-ième jour ouvré après la date de départ (le jour de départ ne compte pas).
  function ajoutOuvres(s, n) {
    let d = s, reste = Math.max(0, Math.round(n));
    while (reste > 0) { d = ajout(d, 1); if (estOuvre(d)) reste -= 1; }
    return d;
  }

  // ---------- Base ----------
  const B = () => g.BASE;
  const typeDe = (code) => B().types.find((t) => t.code === code) || B().types.at(-1);
  const evenementDe = (code) => B().evenements.find((e) => e.code === code) || B().evenements.at(-1);
  const LIBELLE_STATUT = (code) => (B().statuts.find(([c]) => c === code) || [code, code])[1];
  const nombre = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  const arrondi = (v) => Math.round(v * 100) / 100;

  // ---------- Statut et progression (déduits de la chronologie) ----------
  // Le statut est celui de l'événement le plus avancé ; à égalité d'étape, le plus récent l'emporte
  // (une acceptation après une contestation rend le dossier « Accepté »).
  function evenementsTries(dossier) {
    return [...(dossier.evenements || [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || evenementDe(a.type).etape - evenementDe(b.type).etape);
  }
  function statut(dossier) {
    let meilleur = null;
    for (const ev of evenementsTries(dossier)) {
      const e = evenementDe(ev.type);
      if (!e.statut) continue;
      if (!meilleur || e.etape >= meilleur.etape) meilleur = e;
    }
    if (!meilleur || meilleur.etape < 2) return dossier.declareLe ? 'declare' : 'a-declarer';
    return meilleur.statut;
  }
  function etapeAtteinte(dossier) {
    let n = 0;
    for (const ev of dossier.evenements || []) n = Math.max(n, evenementDe(ev.type).etape);
    if (dossier.declareLe) n = Math.max(n, 2);
    return n;
  }
  const progression = (dossier) => Math.round((etapeAtteinte(dossier) / B().etapes.length) * 100);

  // ---------- Échéances ----------
  // Renvoie les échéances datées du dossier : délais indicatifs de la base (avec source) et échéances
  // saisies. etat : 'faite', 'depassee', 'proche' (dans les `alerte` jours) ou 'a-venir'.
  function echeances(dossier, auj, alerte = B().alerteDefaut) {
    const D = B().delais || {};
    const liste = [];
    const etat = (date, fait) => (fait ? 'faite' : date < auj ? 'depassee' : ecart(auj, date) <= alerte ? 'proche' : 'a-venir');
    const t = typeDe(dossier.type);
    const regle = D[t.delai];
    const depart = dossier.decouvert || dossier.survenu;
    if (regle && estDate(depart) && !(t.catnat && dossier.catnat && D.catnat)) {
      const date = regle.unite === 'ouvres' ? ajoutOuvres(depart, regle.jours) : ajout(depart, regle.jours);
      liste.push({ code: 'declaration', libelle: regle.libelle, date, fait: !!dossier.declareLe, regle, depart });
    }
    if (t.catnat && dossier.catnat && D.catnat) {
      if (estDate(dossier.arreteLe)) liste.push({ code: 'catnat', libelle: D.catnat.libelle, date: ajout(dossier.arreteLe, D.catnat.jours), fait: !!dossier.declareLe, regle: D.catnat, depart: dossier.arreteLe });
      else liste.push({ code: 'catnat', libelle: D.catnat.libelle, date: null, fait: !!dossier.declareLe, regle: D.catnat, depart: null, attente: 'Saisis la date de publication de l\'arrêté au Journal officiel pour calculer ce délai.' });
    }
    const secheresse = t.catnat && dossier.catnat && /^Sécheresse/.test(dossier.sousType || '');
    const pres = (secheresse && D.prescriptionSecheresse) || D.prescription;
    if (pres && estDate(dossier.survenu)) {
      liste.push({ code: 'prescription', libelle: pres.libelle, date: ajoutMois(dossier.survenu, pres.mois), fait: statut(dossier) === 'clos', regle: pres, depart: dossier.survenu });
    }
    for (const e of dossier.echeances || []) {
      if (estDate(e.date)) liste.push({ code: 'perso', id: e.id, libelle: e.libelle || 'Échéance', date: e.date, fait: !!e.fait, note: e.note || '' });
    }
    return liste.map((e) => ({ ...e, etat: e.date ? etat(e.date, e.fait) : (e.fait ? 'faite' : 'a-venir') }))
      .sort((a, b) => (a.etat === 'faite') - (b.etat === 'faite') || String(a.date || '9999').localeCompare(String(b.date || '9999')));
  }
  const echeancesActives = (dossier, auj, alerte) => echeances(dossier, auj, alerte).filter((e) => e.etat !== 'faite');

  // ---------- Vétusté et montants ----------
  // Âge en années : années calendaires entières, puis fraction de l'année en cours (2 ans pile = 2).
  function age(de, a) {
    if (!estDate(de) || !estDate(a) || a <= de) return 0;
    let n = 0;
    while (ajoutMois(de, 12 * (n + 1)) <= a) n += 1;
    const debut = ajoutMois(de, 12 * n), fin = ajoutMois(de, 12 * (n + 1));
    return n + ecart(debut, a) / ecart(debut, fin);
  }

  // Taux de vétusté (%) d'un dommage : celui saisi sur le bien, sinon taux annuel de sa catégorie ×
  // âge à la date du sinistre (années entières ou non), plafonné. Aucun taux par défaut : sans saisie, 0.
  function vetuste(dommage, reglages = {}, dateSinistre = null) {
    const saisi = nombre(dommage.vetuste);
    if (saisi !== null) return { taux: Math.min(100, Math.max(0, saisi)), source: 'saisie' };
    const annuel = nombre(reglages.vetuste?.[dommage.categorie]);
    if (!annuel || !estDate(dommage.achatLe)) return { taux: 0, source: annuel ? 'age-inconnu' : 'aucune' };
    const fin = estDate(dateSinistre) ? dateSinistre : dommage.achatLe;
    const ans = age(dommage.achatLe, fin);
    const plafond = nombre(reglages.plafondVetuste) ?? 100;
    return { taux: arrondi(Math.min(plafond, Math.max(0, annuel * ans))), source: 'categorie', ans: arrondi(ans), annuel, plafond };
  }

  // Méthode de calcul : forcée sur le bien, sinon déduite des montants saisis.
  function methode(d) {
    if (['reparation', 'remplacement', 'valeur'].includes(d.methode)) return d.methode;
    if (d.reparable === 'oui' && nombre(d.coutReparation) !== null) return 'reparation';
    if (nombre(d.coutRemplacement) !== null || nombre(d.prixAchat) !== null) return 'remplacement';
    if (nombre(d.valeurEstimee) !== null) return 'valeur';
    return 'remplacement';
  }

  // Montants d'un dommage, avec l'explication du calcul (affichée telle quelle : moteur transparent).
  function montants(d, reglages = {}, dateSinistre = null) {
    const m = methode(d);
    const v = vetuste(d, reglages, dateSinistre);
    let base = null, vetusteMontant = 0, estime = null, detail = '';
    if (m === 'reparation') {
      base = nombre(d.coutReparation);
      estime = base;
      detail = base === null ? 'Coût de réparation à saisir.' : 'Coût de réparation (aucune vétusté appliquée à une réparation dans ce calcul).';
    } else if (m === 'valeur') {
      base = nombre(d.valeurEstimee);
      estime = base;
      detail = base === null ? 'Valeur actuelle à saisir.' : 'Valeur actuelle estimée, déjà usure comprise : pas de vétusté en plus.';
    } else {
      const remplacement = nombre(d.coutRemplacement);
      base = remplacement ?? nombre(d.prixAchat);
      if (base === null) detail = 'Coût de remplacement ou prix d\'achat à saisir.';
      else {
        vetusteMontant = arrondi(base * v.taux / 100);
        estime = arrondi(base - vetusteMontant);
        detail = `${remplacement !== null ? 'Coût de remplacement' : 'Prix d\'achat'} − vétusté ${v.taux} %`;
      }
    }
    const declare = nombre(d.montantDeclare) ?? estime;
    return { methode: m, base, vetuste: v, vetusteMontant, estime, declare, detail };
  }

  // Totaux du dossier : estimé, déclaré, vétusté ; indemnisation (proposition, franchise, versements).
  function totaux(dossier, reglages = {}) {
    const dommages = dossier.dommages || [];
    let estime = 0, declare = 0, vetusteMontant = 0, aChiffrer = 0;
    const parCategorie = {}, parPiece = {};
    for (const d of dommages) {
      const m = montants(d, reglages, dossier.survenu);
      if (m.estime === null && m.declare === null) { aChiffrer += 1; continue; }
      estime += m.estime ?? 0; declare += m.declare ?? 0; vetusteMontant += m.vetusteMontant;
      parCategorie[d.categorie || 'autre'] = (parCategorie[d.categorie || 'autre'] || 0) + (m.declare ?? 0);
      parPiece[d.piece || 'Non précisée'] = (parPiece[d.piece || 'Non précisée'] || 0) + (m.declare ?? 0);
    }
    const ind = dossier.indemnisation || {};
    const reconnu = nombre(ind.proposition);
    const franchise = nombre(ind.franchise);
    const verse = (ind.versements || []).reduce((s, x) => s + (nombre(x.montant) ?? 0), 0);
    const net = reconnu === null ? null : arrondi(reconnu - (ind.franchiseIncluse ? 0 : franchise ?? 0));
    return {
      nombre: dommages.length, aChiffrer, estime: arrondi(estime), declare: arrondi(declare), vetuste: arrondi(vetusteMontant),
      reconnu, franchise, net, verse: arrondi(verse), resteAVerser: net === null ? null : arrondi(Math.max(0, net - verse)),
      ecart: reconnu === null ? null : arrondi(declare - reconnu), parCategorie, parPiece,
    };
  }

  // ---------- Justificatifs ----------
  function preuvesInitiales(typeCode, uid) {
    const t = typeDe(typeCode);
    return t.justificatifs.map((code) => {
      const j = B().justificatifs[code];
      return { id: uid(), code, type: j.type, libelle: j.nom, statut: 'a-fournir', dommageId: null, evenementId: null, reference: '', note: '', photos: [], date: null };
    });
  }
  function bilanPreuves(preuves = []) {
    const n = Object.fromEntries(B().statutsPreuve.map(([c]) => [c, 0]));
    for (const p of preuves) n[p.statut] = (n[p.statut] || 0) + 1;
    return { ...n, total: preuves.length, collectees: n.recu + n.verifie, aTraiter: n['a-fournir'] + n.manquant + n.refuse };
  }

  // ---------- Recherche ----------
  const plat = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function filtrerDommages(dommages, f = {}) {
    const mots = plat(f.texte).split(/\s+/).filter(Boolean);
    return dommages.filter((d) => (!f.piece || d.piece === f.piece) && (!f.categorie || d.categorie === f.categorie)
      && mots.every((m) => plat([d.designation, d.marque, d.piece, d.commentaire, d.etatApres].join(' ')).includes(m)));
  }

  // ---------- Courriers ----------
  // Remplace {{cle}} par la valeur fournie ; une valeur vide devient « [à compléter] ».
  const remplir = (texte, valeurs) => String(texte).replace(/\{\{(\w+)\}\}/g, (_, k) => (valeurs[k] === undefined || valeurs[k] === null || valeurs[k] === '' ? '[à compléter]' : String(valeurs[k])));

  // ---------- Exports ----------
  const euros = (v) => (v === null || v === undefined ? '' : String(arrondi(v)).replace('.', ','));
  const cellule = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const ligneCsv = (t) => t.map(cellule).join(';');
  function csvDommages(dossier, reglages = {}) {
    const cat = (c) => B().categories.find((x) => x.code === c)?.nom || c || '';
    const rep = (c) => (B().reparabilite.find(([k]) => k === c) || ['', ''])[1];
    const lignes = [ligneCsv(['Pièce', 'Catégorie', 'Désignation', 'Marque', 'Date d\'achat', 'Prix d\'achat (€)', 'Valeur actuelle (€)', 'Coût de réparation (€)', 'Coût de remplacement (€)', 'Vétusté (%)', 'Vétusté (€)', 'Méthode', 'Montant estimé (€)', 'Montant déclaré (€)', 'État avant', 'État après', 'Réparabilité', 'Justificatifs', 'Commentaires'])];
    for (const d of dossier.dommages || []) {
      const m = montants(d, reglages, dossier.survenu);
      const nbPreuves = (dossier.preuves || []).filter((p) => p.dommageId === d.id).length;
      lignes.push(ligneCsv([d.piece, cat(d.categorie), d.designation, d.marque, dateFr(d.achatLe), euros(nombre(d.prixAchat)), euros(nombre(d.valeurEstimee)), euros(nombre(d.coutReparation)), euros(nombre(d.coutRemplacement)),
        String(m.vetuste.taux).replace('.', ','), euros(m.vetusteMontant), { reparation: 'Réparation', remplacement: 'Remplacement', valeur: 'Valeur actuelle' }[m.methode], euros(m.estime), euros(m.declare), d.etatAvant, d.etatApres, rep(d.reparable), nbPreuves, d.commentaire]));
    }
    return '﻿' + lignes.join('\r\n') + '\r\n';
  }
  function csvPreuves(dossier) {
    const st = (c) => (B().statutsPreuve.find(([k]) => k === c) || ['', c])[1];
    const ty = (c) => (B().typesPreuve.find(([k]) => k === c) || ['', c])[1];
    const lignes = [ligneCsv(['Justificatif', 'Type', 'Statut', 'Date', 'Dommage associé', 'Étape associée', 'Référence du fichier', 'Photos sur l\'appareil', 'Note'])];
    for (const p of dossier.preuves || []) {
      const d = (dossier.dommages || []).find((x) => x.id === p.dommageId);
      const e = (dossier.evenements || []).find((x) => x.id === p.evenementId);
      lignes.push(ligneCsv([p.libelle, ty(p.type), st(p.statut), dateFr(p.date), d?.designation || '', e ? evenementDe(e.type).nom : '', p.reference, (p.photos || []).length, p.note]));
    }
    return '﻿' + lignes.join('\r\n') + '\r\n';
  }
  function csvChronologie(dossier) {
    const lignes = [ligneCsv(['Date', 'Étape', 'Description', 'Justificatifs'])];
    for (const e of evenementsTries(dossier)) {
      const n = (dossier.preuves || []).filter((p) => p.evenementId === e.id).length;
      lignes.push(ligneCsv([dateFr(e.date), evenementDe(e.type).nom, e.description, n]));
    }
    return '﻿' + lignes.join('\r\n') + '\r\n';
  }

  // ---------- État (tolérant aux anciennes versions et aux copies importées) ----------
  const tab = (x) => (Array.isArray(x) ? x : []);
  function normaliserDossier(d) {
    return {
      id: d.id, type: d.type || 'autre', sousType: d.sousType || '', titre: d.titre || '', lieu: d.lieu || '', survenu: estDate(d.survenu) ? d.survenu : null,
      decouvert: estDate(d.decouvert) ? d.decouvert : null, circonstances: d.circonstances || '', pieces: tab(d.pieces), tiers: tab(d.tiers), tiersNote: d.tiersNote || '',
      catnat: !!d.catnat, arreteLe: estDate(d.arreteLe) ? d.arreteLe : null,
      assureur: d.assureur || '', contrat: d.contrat || '', numero: d.numero || '', declareLe: estDate(d.declareLe) ? d.declareLe : null,
      mesures: d.mesures && typeof d.mesures === 'object' ? d.mesures : {}, observations: d.observations || '',
      indemnisation: { proposition: null, franchise: null, franchiseIncluse: false, versements: [], ...(d.indemnisation || {}), versements: tab(d.indemnisation?.versements) },
      dommages: tab(d.dommages).map((x) => ({ piece: '', categorie: '', designation: '', marque: '', achatLe: null, prixAchat: null, valeurEstimee: null, coutReparation: null, coutRemplacement: null, vetuste: null, methode: '', montantDeclare: null, etatAvant: '', etatApres: '', reparable: 'inconnu', commentaire: '', ...x })),
      preuves: tab(d.preuves).map((x) => ({ type: 'autre', statut: 'a-fournir', dommageId: null, evenementId: null, reference: '', note: '', date: null, ...x, photos: tab(x.photos) })),
      evenements: tab(d.evenements).map((x) => ({ description: '', ...x })),
      echeances: tab(d.echeances), creeLe: d.creeLe || null,
    };
  }
  const etatVide = () => ({ version: 1, reglages: { alerte: B().alerteDefaut, vetuste: {}, plafondVetuste: null }, dossiers: [], actif: null });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const dossiers = tab(d.dossiers).filter((x) => x && x.id).map(normaliserDossier);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}), vetuste: { ...(d.reglages?.vetuste || {}) } }, dossiers,
      actif: dossiers.some((x) => x.id === d.actif) ? d.actif : dossiers[0]?.id || null };
  }

  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.REGLES = { iso, versDate, ajout, ajoutMois, ecart, estDate, dateFr, paques, feries, estFerie, estOuvre, ajoutOuvres,
    typeDe, evenementDe, LIBELLE_STATUT, nombre, arrondi, evenementsTries, statut, etapeAtteinte, progression,
    echeances, echeancesActives, vetuste, methode, montants, totaux, preuvesInitiales, bilanPreuves, plat, filtrerDommages,
    remplir, euros, csvDommages, csvPreuves, csvChronologie, normaliser, normaliserDossier, etatVide, taille };
})(typeof window !== 'undefined' ? window : globalThis);
