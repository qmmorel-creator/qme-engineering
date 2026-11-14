// Réservation de salles et bureaux QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.SDR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ », heures « HH:MM » (comparables comme des chaînes), durées en minutes.
// Une réservation occupe [début, fin[ dans une seule journée : deux créneaux bout à bout ne se chevauchent pas.
(function (racine) {
  'use strict';

  const TYPES = ['salle', 'bureau', 'equipement'];
  const LIB_TYPE = { salle: 'Salle', bureau: 'Bureau', equipement: 'Équipement' };
  const PAS = [15, 30, 60];
  const MAX_RESSOURCES = 40;
  const MAX_OCCURRENCES = 52;
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ---------- Dates et heures ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const jourSemaine = (s) => versDate(s).getDay();
  const lundi = (s) => ajout(s, -((jourSemaine(s) + 6) % 7));
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const minutes = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const heure = (m) => `${deux(Math.floor(m / 60))}:${deux(m % 60)}`;
  const minuteDe = (d) => d.getHours() * 60 + d.getMinutes();
  const duree = (r) => minutes(r.fin) - minutes(r.debut);
  // « 1 h 30 », « 45 min », « 2 h »
  function texteDuree(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return `${r} min`;
    return r ? `${h} h ${deux(r)}` : `${h} h`;
  }
  const pct = (t, dec = 0) => (t === null || t === undefined || !Number.isFinite(t) ? '–' : `${t.toFixed(dec).replace('.', ',')} %`);

  // ---------- Jours fériés (France) ----------
  // Dimanche de Pâques (algorithme grégorien anonyme, dit de Meeus/Jones/Butcher).
  function paques(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4;
    const g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4;
    const m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mois = Math.floor((i + m - 7 * n + 114) / 31), jour = ((i + m - 7 * n + 114) % 31) + 1;
    return `${a}-${deux(mois)}-${deux(jour)}`;
  }
  // Jours fériés d'une année : { 'AAAA-MM-JJ': nom }. Liste de l'article L3133-1 du Code du travail.
  function feries(annee, { alsaceMoselle = false } = {}) {
    const p = paques(annee);
    const l = {
      [`${annee}-01-01`]: 'Jour de l\'an', [ajout(p, 1)]: 'Lundi de Pâques', [`${annee}-05-01`]: 'Fête du Travail',
      [`${annee}-05-08`]: 'Victoire 1945', [ajout(p, 39)]: 'Ascension', [ajout(p, 50)]: 'Lundi de Pentecôte',
      [`${annee}-07-14`]: 'Fête nationale', [`${annee}-08-15`]: 'Assomption', [`${annee}-11-01`]: 'Toussaint',
      [`${annee}-11-11`]: 'Armistice 1918', [`${annee}-12-25`]: 'Noël',
    };
    if (alsaceMoselle) { l[ajout(p, -2)] = 'Vendredi saint'; l[`${annee}-12-26`] = 'Saint-Étienne'; }
    return l;
  }
  const nomFerie = (date, reglages) => (reglages?.feries ? feries(Number(date.slice(0, 4)), { alsaceMoselle: !!reglages.alsaceMoselle })[date] || null : null);
  // Le lieu est-il ouvert ce jour-là ? { ouvert, raison : 'jour' | 'ferie' | null, nom }
  function jourOuvert(date, reglages) {
    if (!(reglages?.jours || []).includes(jourSemaine(date))) return { ouvert: false, raison: 'jour', nom: null };
    const f = nomFerie(date, reglages);
    return f ? { ouvert: false, raison: 'ferie', nom: f } : { ouvert: true, raison: null, nom: null };
  }
  // Prochain jour ouvert à partir de date (incluse), au plus 31 jours plus loin.
  function prochainJourOuvert(date, reglages) {
    for (let i = 0; i <= 31; i++) { const d = ajout(date, i); if (jourOuvert(d, reglages).ouvert) return d; }
    return null;
  }

  // ---------- Chevauchements ----------
  const chevauche = (a, b) => a.id !== b.id && a.ressource === b.ressource && a.date === b.date && a.debut < b.fin && b.debut < a.fin;
  const conflitsAvec = (candidat, reservations) => (reservations || []).filter((x) => chevauche(candidat, x)).sort((x, y) => x.debut.localeCompare(y.debut));
  // Chevauchements présents dans les données (import, ancienne version) : paires.
  function conflits(reservations) {
    const l = [...(reservations || [])].sort((x, y) => x.date.localeCompare(y.date) || x.debut.localeCompare(y.debut) || x.id.localeCompare(y.id));
    const res = [];
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length && l[j].date === l[i].date; j++) if (chevauche(l[i], l[j])) res.push({ a: l[i], b: l[j] });
    }
    return res;
  }

  // ---------- Validation d'une réservation ----------
  // ctx : { ressources, reservations, reglages } ; options : { auj, nouvelle } (nouvelle : délai à l'avance contrôlé).
  // Renvoie { ok, erreur, conflits }. Les conflits sont toujours refusés.
  function valider(r, ctx, { auj = null, nouvelle = true } = {}) {
    const g = ctx.reglages;
    const non = (erreur, extra = {}) => ({ ok: false, erreur, conflits: [], ...extra });
    const res = (ctx.ressources || []).find((x) => x.id === r.ressource);
    if (!res) return non('Choisis une ressource.');
    if (res.archive) return non(`${res.nom} est archivée : réactive-la dans les Réglages pour la réserver.`);
    if (!estDate(r.date)) return non('Indique la date.');
    if (!estHeure(r.debut) || !estHeure(r.fin)) return non('Indique l\'heure de début et l\'heure de fin.');
    if (r.fin <= r.debut) return non('La fin doit être après le début.');
    const j = jourOuvert(r.date, g);
    if (!j.ouvert) return non(j.raison === 'ferie' ? `Le ${r.date.split('-').reverse().join('/')} est férié (${j.nom}) : le lieu est fermé.` : `Le lieu est fermé le ${JOURS[jourSemaine(r.date)]} (voir les Réglages).`);
    if (r.debut < g.ouverture || r.fin > g.fermeture) return non(`Les réservations vont de ${g.ouverture} à ${g.fermeture}.`);
    if (minutes(r.debut) % g.pas || minutes(r.fin) % g.pas) return non(`Les créneaux se réservent par ${g.pas} minutes (ex. ${heure(minutes(g.ouverture) + g.pas)}).`);
    if (g.dureeMax && duree(r) > g.dureeMax) return non(`Une réservation dure ${texteDuree(g.dureeMax)} au plus.`);
    if (nouvelle && auj && g.avanceMax && r.date > ajout(auj, g.avanceMax)) return non(`On réserve ${g.avanceMax} jours à l'avance au plus.`);
    if (res.type === 'salle' && r.personnes > res.capacite) return non(`${res.nom} accueille ${res.capacite} personne${res.capacite > 1 ? 's' : ''} au plus.`);
    const c = conflitsAvec(r, ctx.reservations);
    if (c.length) return non(`${res.nom} est déjà réservée de ${c[0].debut} à ${c[0].fin}${c[0].par ? ` par ${c[0].par}` : ''}${c[0].objet ? ` (${c[0].objet})` : ''}.`, { conflits: c });
    return { ok: true, erreur: null, conflits: [] };
  }

  // ---------- Récurrence « chaque semaine » ----------
  // Dates d'une série hebdomadaire de date (incluse) à jusqua (incluse), 52 au plus.
  function datesHebdo(date, jusqua) {
    const l = [];
    if (!estDate(date) || !estDate(jusqua)) return l;
    for (let d = date; d <= jusqua && l.length < MAX_OCCURRENCES; d = ajout(d, 7)) l.push(d);
    return l;
  }
  // Plan d'une série : chaque date est validée contre les réservations existantes ET les dates déjà retenues.
  // Renvoie { retenues: [réservations], refusees: [{ date, erreur }] }.
  function planSerie(modele, jusqua, ctx, options = {}) {
    const retenues = [], refusees = [];
    for (const date of datesHebdo(modele.date, jusqua)) {
      const r = { ...modele, id: `${modele.id}-${date}`, date };
      const v = valider(r, { ...ctx, reservations: [...(ctx.reservations || []), ...retenues] }, options);
      if (v.ok) retenues.push(r); else refusees.push({ date, erreur: v.erreur });
    }
    return { retenues, refusees };
  }

  // ---------- État d'une ressource à un instant ----------
  const duJour = (reservations, ressource, date) => (reservations || []).filter((r) => r.ressource === ressource && r.date === date).sort((a, b) => a.debut.localeCompare(b.debut));
  // statut : 'libre' (jusqua = heure de la prochaine réservation ou de la fermeture), 'occupee' (resa en cours,
  // libreA = fin de la suite de réservations bout à bout), 'fermee' (jour fermé ou hors horaires, ouvreA si plus
  // tard dans la journée). prochaine : prochaine réservation du jour après l'instant.
  function etatRessource(ressourceId, ctx, date, minute) {
    const g = ctx.reglages;
    const l = duJour(ctx.reservations, ressourceId, date);
    const h = heure(minute);
    const prochaine = l.find((r) => r.debut > h) || null;
    const j = jourOuvert(date, g);
    if (!j.ouvert) return { statut: 'fermee', raison: j.raison, nomFerie: j.nom, prochaine: null, ouvreA: null };
    if (h < g.ouverture) return { statut: 'fermee', raison: 'avant', ouvreA: g.ouverture, prochaine: l[0] || null };
    if (h >= g.fermeture) return { statut: 'fermee', raison: 'apres', ouvreA: null, prochaine: null };
    const enCours = l.find((r) => r.debut <= h && h < r.fin);
    if (enCours) {
      let libreA = enCours.fin;
      for (const r of l) if (r.debut <= libreA && r.fin > libreA) libreA = r.fin;
      return { statut: 'occupee', resa: enCours, libreA, prochaine: l.find((r) => r.debut >= libreA) || null };
    }
    return { statut: 'libre', jusqua: prochaine ? prochaine.debut : g.fermeture, prochaine };
  }
  // Créneau de réservation rapide « maintenant » : début arrondi au pas inférieur, durée voulue, raccourci par la
  // prochaine réservation ou la fermeture. null si moins d'un pas disponible.
  function creneauMaintenant(ressourceId, ctx, date, minute, dureeVoulue) {
    const e = etatRessource(ressourceId, ctx, date, minute);
    if (e.statut !== 'libre') return null;
    const g = ctx.reglages;
    const debut = Math.max(minutes(g.ouverture), minute - (minute % g.pas));
    // Le créneau arrondi ne doit pas empiéter sur une réservation qui vient de se terminer.
    const precedente = duJour(ctx.reservations, ressourceId, date).filter((r) => r.fin <= heure(minute)).pop();
    const d = precedente ? Math.max(debut, minutes(precedente.fin)) : debut;
    const f = Math.min(d + dureeVoulue, minutes(e.jusqua), g.dureeMax ? d + g.dureeMax : Infinity);
    const fArr = f - ((f - minutes(g.ouverture)) % g.pas);
    return fArr - d >= g.pas ? { debut: heure(d), fin: heure(fArr) } : null;
  }
  // « Libérer maintenant » : la fin passe au pas supérieur à l'instant. null : la réservation est à supprimer
  // (pas encore commencée ou sans durée restante).
  function finLiberee(r, minute, pas) {
    if (minute < minutes(r.debut)) return null;
    const f = Math.ceil((minute + 1) / pas) * pas;
    if (f >= minutes(r.fin)) return r.fin;
    return f > minutes(r.debut) ? heure(f) : null;
  }

  // ---------- Occupation ----------
  // Sur [debut, fin[ (dates) : minutes réservées dans les horaires d'ouverture / minutes d'ouverture des jours
  // ouverts (jours fermés et fériés exclus). Par ressource, par jour de la semaine et carte jour × heure.
  function occupation(ctx, debut, fin, { ressources = null } = {}) {
    const g = ctx.reglages;
    const o = minutes(g.ouverture), f = minutes(g.fermeture);
    const ouvMin = Math.max(0, f - o);
    const ids = (ressources || ctx.ressources.filter((x) => !x.archive).map((x) => x.id));
    const parRessource = Object.fromEntries(ids.map((id) => [id, { reserve: 0, ouvert: 0, nb: 0 }]));
    const parJour = Array.from({ length: 7 }, () => ({ reserve: 0, ouvert: 0 }));
    const heures = [];
    for (let h = Math.floor(o / 60); h * 60 < f; h++) heures.push(h);
    const carte = Array.from({ length: 7 }, () => heures.map(() => ({ reserve: 0, ouvert: 0 })));
    let joursOuverts = 0;
    for (let d = debut; d < fin; d = ajout(d, 1)) {
      if (!jourOuvert(d, g).ouvert) continue;
      joursOuverts++;
      const w = jourSemaine(d);
      for (const id of ids) { parRessource[id].ouvert += ouvMin; parJour[w].ouvert += ouvMin; }
      heures.forEach((h, i) => { const a = Math.max(o, h * 60), b = Math.min(f, h * 60 + 60); carte[w][i].ouvert += Math.max(0, b - a) * ids.length; });
    }
    for (const r of ctx.reservations || []) {
      if (r.date < debut || r.date >= fin || !parRessource[r.ressource] || !jourOuvert(r.date, g).ouvert) continue;
      const a = Math.max(o, minutes(r.debut)), b = Math.min(f, minutes(r.fin));
      if (b <= a) continue;
      const w = jourSemaine(r.date);
      parRessource[r.ressource].reserve += b - a; parRessource[r.ressource].nb++;
      parJour[w].reserve += b - a;
      heures.forEach((h, i) => { const x = Math.max(a, h * 60), y = Math.min(b, h * 60 + 60); if (y > x) carte[w][i].reserve += y - x; });
    }
    const taux = (c) => (c.ouvert ? (c.reserve / c.ouvert) * 100 : null);
    const lignes = ids.map((id) => ({ ressource: id, ...parRessource[id], taux: taux(parRessource[id]) }));
    const total = lignes.reduce((s, l) => ({ reserve: s.reserve + l.reserve, ouvert: s.ouvert + l.ouvert, nb: s.nb + l.nb }), { reserve: 0, ouvert: 0, nb: 0 });
    return {
      debut, fin, joursOuverts, ...total, taux: taux(total),
      parRessource: lignes,
      parJour: parJour.map((c, w) => ({ jour: w, ...c, taux: taux(c) })),
      heures, carte: carte.map((l) => l.map((c) => ({ ...c, taux: taux(c) }))),
    };
  }

  // ---------- Synchronisation : rejouer les actions locales sur la version du serveur ----------
  // ops : [{ type: 'ajout' | 'modif', resa }, { type: 'suppr', id }] dans l'ordre. Une réservation qui chevauche
  // désormais une réservation du serveur est refusée ; une modification d'une réservation supprimée ailleurs
  // aussi. Renvoie { etat, refusees: [{ resa, raison: 'conflit' | 'supprimee', avec }] }. Ne modifie pas l'entrée.
  function rejouer(serveur, ops) {
    const e = JSON.parse(JSON.stringify(serveur));
    const refusees = [];
    for (const op of ops || []) {
      if (op.type === 'suppr') { e.reservations = e.reservations.filter((r) => r.id !== op.id); continue; }
      const r = op.resa;
      const i = e.reservations.findIndex((x) => x.id === r.id);
      if (op.type === 'modif' && i < 0) { refusees.push({ resa: r, raison: 'supprimee', avec: null }); continue; }
      const c = conflitsAvec(r, e.reservations);
      if (c.length) { refusees.push({ resa: r, raison: 'conflit', avec: c[0] }); continue; }
      if (i >= 0) e.reservations[i] = r; else e.reservations.push(r);
    }
    return { etat: e, refusees };
  }

  // ---------- Normalisation (tolérante aux anciennes versions) ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? Math.min(max, Math.max(min, n)) : defaut; };
  const texte = (v, n) => String(v ?? '').slice(0, n);
  const entierOuNull = (v, min, max) => (v === null || v === undefined || v === '' ? null : entier(v, min, max, null));

  function normaliserRessource(x, i = 0) {
    const r = x && typeof x === 'object' ? x : {};
    const type = TYPES.includes(r.type) ? r.type : 'salle';
    return {
      id: texte(r.id, 40) || nouvelId(), nom: texte(r.nom, 60).trim() || `Ressource ${i + 1}`, type,
      capacite: entier(r.capacite, 1, 500, type === 'salle' ? 6 : 1), lieu: texte(r.lieu, 60),
      equipements: (Array.isArray(r.equipements) ? r.equipements : []).map((e) => texte(e, 40).trim()).filter(Boolean).slice(0, 20),
      couleur: entier(r.couleur, 0, 7, i % 8), note: texte(r.note, 300), archive: !!r.archive,
    };
  }
  function normaliserReservation(x, auj) {
    const r = x && typeof x === 'object' ? x : {};
    const debut = estHeure(r.debut) ? r.debut : '09:00';
    let fin = estHeure(r.fin) ? r.fin : heure(Math.min(minutes(debut) + 60, 23 * 60 + 59));
    if (fin <= debut) fin = heure(Math.min(minutes(debut) + 30, 23 * 60 + 59));
    return {
      id: texte(r.id, 60) || nouvelId(), ressource: texte(r.ressource, 40), date: estDate(r.date) ? r.date : auj,
      debut, fin, objet: texte(r.objet, 80), par: texte(r.par, 60), personnes: entier(r.personnes, 1, 500, 1),
      serie: r.serie ? texte(r.serie, 40) : null, note: texte(r.note, 300), creeLe: estDate(r.creeLe) ? r.creeLe : null,
    };
  }
  function reglagesDe(g = {}, d = {}) {
    const ouv = estHeure(g.ouverture) ? g.ouverture : d.ouverture;
    let fer = estHeure(g.fermeture) ? g.fermeture : d.fermeture;
    if (fer <= ouv) fer = d.fermeture > ouv ? d.fermeture : '23:30';
    const jours = Array.isArray(g.jours) ? [...new Set(g.jours.map(Number).filter((n) => n >= 0 && n <= 6))].sort() : [...d.jours];
    return {
      ouverture: ouv, fermeture: fer, jours: jours.length ? jours : [...d.jours],
      pas: PAS.includes(Number(g.pas)) ? Number(g.pas) : d.pas,
      dureeMax: g.dureeMax === undefined ? d.dureeMax : entierOuNull(g.dureeMax, 15, 24 * 60),
      avanceMax: g.avanceMax === undefined ? d.avanceMax : entierOuNull(g.avanceMax, 1, 730),
      feries: g.feries === undefined ? d.feries : !!g.feries,
      alsaceMoselle: g.alsaceMoselle === undefined ? d.alsaceMoselle : !!g.alsaceMoselle,
    };
  }
  const DEFAUT_REGLAGES = { ouverture: '08:00', fermeture: '19:00', jours: [1, 2, 3, 4, 5], pas: 30, dureeMax: null, avanceMax: 90, feries: true, alsaceMoselle: false };
  function etatVide(defauts = {}) {
    return { version: 1, organisation: '', reglages: reglagesDe(defauts.reglages || {}, DEFAUT_REGLAGES), equipementsPerso: [], ressources: [], reservations: [] };
  }
  function normaliser(d, auj, defauts = {}) {
    const v = etatVide(defauts);
    if (!d || typeof d !== 'object') return v;
    return {
      version: 1, ...(d.majLe ? { majLe: d.majLe } : {}),
      organisation: texte(d.organisation, 80),
      reglages: reglagesDe(d.reglages || {}, v.reglages),
      equipementsPerso: (Array.isArray(d.equipementsPerso) ? d.equipementsPerso : []).map((e) => texte(e, 40).trim()).filter(Boolean).slice(0, 30),
      ressources: (Array.isArray(d.ressources) ? d.ressources : []).slice(0, MAX_RESSOURCES).map(normaliserRessource),
      reservations: (Array.isArray(d.reservations) ? d.reservations : []).map((x) => normaliserReservation(x, auj)),
    };
  }

  // ---------- Listes ----------
  const memeNom = (a, b) => !!a && !!b && a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');
  const triChrono = (a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut);
  // Réservations à venir (fin pas encore passée) à partir de l'instant donné.
  const aVenir = (reservations, date, minute) => (reservations || []).filter((r) => r.date > date || (r.date === date && r.fin > heure(minute))).sort(triChrono);
  const occurrencesSuivantes = (reservations, r) => (reservations || []).filter((x) => r.serie && x.serie === r.serie && x.date >= r.date).sort(triChrono);

  // ---------- RGPD ----------
  // Efface le nom, l'objet et la note des réservations antérieures à « avant » : le créneau reste pour les taux.
  function anonymiser(etat, avant) {
    const e = JSON.parse(JSON.stringify(etat));
    let n = 0;
    for (const r of e.reservations) if (r.date < avant && (r.par || r.objet || r.note)) { r.par = ''; r.objet = ''; r.note = ''; n++; }
    return { etat: e, n };
  }

  // ---------- Export CSV ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function versCsv(etat) {
    const tete = ['Date', 'Jour', 'Début', 'Fin', 'Durée (min)', 'Ressource', 'Type', 'Objet', 'Réservé par', 'Personnes', 'Chaque semaine', 'Note'];
    const lignes = [...etat.reservations].sort(triChrono).map((r) => {
      const res = etat.ressources.find((x) => x.id === r.ressource);
      return [r.date, JOURS[jourSemaine(r.date)], r.debut, r.fin, duree(r), res?.nom || 'Ressource supprimée', LIB_TYPE[res?.type] || '', r.objet, r.par, r.personnes, r.serie ? 'oui' : '', r.note];
    });
    return '﻿' + [tete, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  racine.SDR = {
    TYPES, LIB_TYPE, PAS, MAX_RESSOURCES, MAX_OCCURRENCES, JOURS,
    iso, versDate, ajout, ecart, estDate, jourSemaine, lundi, estHeure, minutes, heure, minuteDe, duree, texteDuree, pct,
    paques, feries, nomFerie, jourOuvert, prochainJourOuvert,
    chevauche, conflitsAvec, conflits, valider, datesHebdo, planSerie,
    duJour, etatRessource, creneauMaintenant, finLiberee, occupation, rejouer,
    nouvelId, normaliserRessource, normaliserReservation, reglagesDe, etatVide, normaliser,
    memeNom, triChrono, aVenir, occurrencesSuivantes, anonymiser, versCsv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
