// Suivi de lecture QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.PGS) et par les tests Node (outils/templates/lecture.test.mjs).
// Dates locales « AAAA-MM-JJ ». Un livre se mesure en pages (papier, numérique) ou en minutes (audio).
// Une session de lecture est datée et porte une quantité lue (pages ou minutes). Tout ce qui dépend du jour
// présent reçoit `auj` en paramètre : rien n'est lu dans l'horloge ici.
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const bissextile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  const joursAnnee = (a) => (bissextile(a) ? 366 : 365);
  // Rang du jour dans l'année : 1er janvier = 1.
  const jourDeLAnnee = (s) => ecart(`${s.slice(0, 4)}-01-01`, s) + 1;
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  // « 1 h 30 », « 45 min », « 12 h ».
  function dureeTexte(minutes) {
    const n = Math.round(Math.abs(Number(minutes) || 0));
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60), r = n % 60;
    return `${h} h${r ? ` ${deux(r)}` : ''}`;
  }
  // Nombre lisible à la française : 1234,5 → « 1 234,5 » (espace fine insécable).
  function nombreTexte(n, decimales = 0) {
    const v = Number(n) || 0;
    const f = Math.pow(10, decimales);
    const r = Math.round(Math.abs(v) * f) / f;
    const [ent, dec] = r.toFixed(decimales).split('.');
    const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${v < 0 && r !== 0 ? '−' : ''}${groupes}${dec && Number(dec) ? `,${dec.replace(/0+$/, '')}` : ''}`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // ---------- Référentiels ----------
  const FORMATS = { papier: { nom: 'Papier', unite: 'pages' }, numerique: { nom: 'Numérique', unite: 'pages' }, audio: { nom: 'Audio', unite: 'minutes' } };
  const STATUTS = { encours: 'En cours', alire: 'À lire', lu: 'Lu', abandonne: 'Abandonné' };
  const PRIORITES = { 1: 'Prioritaire', 2: 'Bientôt', 3: 'Un jour' };
  const unite = (livre) => FORMATS[livre?.format]?.unite || 'pages';
  // « 320 pages », « 9 h 30 ».
  const quantiteTexte = (q, u) => (u === 'minutes' ? dureeTexte(q) : `${nombreTexte(q)} page${Math.abs(q) > 1 ? 's' : ''}`);

  // ---------- Normalisation ----------
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const txtLong = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
  const ent = (v, min, max, def = min) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const idOk = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());

  function normaliserReglages(r, base) {
    const genres = Array.isArray(r?.genres) ? r.genres : (base?.genres || []);
    const objectifs = {};
    if (r?.objectifs && typeof r.objectifs === 'object') {
      for (const [a, o] of Object.entries(r.objectifs)) {
        if (!/^\d{4}$/.test(a)) continue;
        objectifs[a] = { livres: ent(o?.livres, 0, 1000), pages: ent(o?.pages, 0, 500000) };
      }
    }
    return { genres: [...new Set(genres.map((x) => txt(x, 40)).filter(Boolean))].slice(0, 60), objectifs };
  }
  function normaliserCitation(c) {
    const o = { id: idOk(c?.id), texte: txtLong(c?.texte, 1000) };
    const p = ent(c?.page, 0, 100000, 0);
    if (p) o.page = p;
    return o;
  }
  function normaliserLivre(x) {
    const l = {
      id: idOk(x?.id),
      titre: txt(x?.titre, 140) || 'Sans titre',
      auteur: txt(x?.auteur, 100),
      genre: txt(x?.genre, 40),
      format: FORMATS[x?.format] ? x.format : 'papier',
      total: ent(x?.total, 0, 100000, 0),
      statut: STATUTS[x?.statut] ? x.statut : 'alire',
      priorite: ent(x?.priorite, 1, 3, 2),
      ordre: Number.isFinite(Number(x?.ordre)) ? Number(x.ordre) : 0,
      ajoute: estDate(x?.ajoute) ? x.ajoute : '',
      debut: estDate(x?.debut) ? x.debut : '',
      fin: estDate(x?.fin) ? x.fin : '',
      note: ent(x?.note, 0, 5, 0),
    };
    if (l.fin && l.debut && l.fin < l.debut) l.fin = l.debut;
    const avis = txtLong(x?.avis, 4000);
    if (avis) l.avis = avis; // champs vides omis : les données restent légères
    const cit = Array.isArray(x?.citations) ? x.citations.map(normaliserCitation).filter((c) => c.texte) : [];
    if (cit.length) l.citations = cit.slice(0, 200);
    return l;
  }
  const normaliserSession = (x) => ({ id: idOk(x?.id), livre: txt(x?.livre, 40), date: estDate(x?.date) ? x.date : '', quantite: ent(x?.quantite, 0, 100000, 0) });
  const etatVide = (base) => ({ version: 1, reglages: normaliserReglages({}, base), livres: [], sessions: [] });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const livres = (Array.isArray(d.livres) ? d.livres : []).map(normaliserLivre);
    const ids = new Set(livres.map((l) => l.id));
    const sessions = (Array.isArray(d.sessions) ? d.sessions : []).map(normaliserSession).filter((s) => s.date && s.quantite > 0 && ids.has(s.livre));
    return { ...v, ...d, reglages: normaliserReglages(d.reglages || {}, base), livres, sessions };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  // ---------- Progression d'un livre ----------
  const sessionsDe = (etat, id) => etat.sessions.filter((s) => s.livre === id).sort((a, b) => a.date.localeCompare(b.date));
  const cumul = (etat, id) => etat.sessions.reduce((t, s) => (s.livre === id ? t + s.quantite : t), 0);
  // Fait, total, part lue (0 → 1, null sans total), reste. Un livre « lu » est complet par définition.
  function progression(etat, livre) {
    const total = livre.total;
    let fait = cumul(etat, livre.id);
    if (livre.statut === 'lu' && total) fait = total;
    if (total) fait = Math.min(fait, total);
    return { fait, total, part: total ? fait / total : null, reste: total ? Math.max(0, total - fait) : null, unite: unite(livre) };
  }
  // Rythme actuel d'un livre : quantité lue sur les `fenetre` derniers jours (aujourd'hui compris), divisée par
  // le nombre de ces jours écoulés depuis la première session du livre (au plus `fenetre`). Null sans lecture récente.
  function rythmeLivre(etat, livre, auj, fenetre = 14) {
    const ses = sessionsDe(etat, livre.id).filter((s) => s.date <= auj);
    if (!ses.length) return null;
    const depuis = ajout(auj, 1 - fenetre);
    const q = ses.filter((s) => s.date >= depuis).reduce((t, s) => t + s.quantite, 0);
    if (!q) return null;
    const jours = Math.min(fenetre, ecart(ses[0].date, auj) + 1);
    return q / jours;
  }
  // Date de fin estimée au rythme actuel : demain au plus tôt si on ne finit pas aujourd'hui.
  function finEstimee(etat, livre, auj, fenetre = 14) {
    const p = progression(etat, livre);
    if (!p.reste || livre.statut === 'lu' || livre.statut === 'abandonne') return null;
    const r = rythmeLivre(etat, livre, auj, fenetre);
    if (!r) return null;
    const jours = Math.ceil(p.reste / r);
    return { jours, date: ajout(auj, jours), rythme: r };
  }
  // Quantité d'une session saisie comme « arrivé à la page (ou à la minute) N ».
  const quantiteDepuisPosition = (etat, livre, position) => Math.max(0, Math.round(Number(position) || 0) - progression(etat, livre).fait);

  // Ajoute une session et fait suivre le statut du livre : « à lire » ou « abandonné » → « en cours » (début =
  // date de la première session), total atteint → « lu » (fin = date de la session). Renvoie un nouvel état.
  function appliquerSession(etat, session) {
    const s = normaliserSession(session);
    const livres = etat.livres.map((l) => ({ ...l }));
    const l = livres.find((x) => x.id === s.livre);
    if (!l || !s.date || s.quantite <= 0) return { etat, termine: false, refus: true };
    const sessions = etat.sessions.filter((x) => x.id !== s.id).concat([s]);
    const e = { ...etat, livres, sessions };
    const premiere = sessionsDe(e, l.id)[0]?.date || s.date;
    if (!l.debut || premiere < l.debut) l.debut = premiere;
    if (l.statut === 'alire' || l.statut === 'abandonne') { l.statut = 'encours'; l.fin = ''; }
    let termine = false;
    if (l.statut === 'encours' && l.total && cumul(e, l.id) >= l.total) {
      l.statut = 'lu';
      l.fin = sessionsDe(e, l.id).at(-1).date;
      termine = true;
    }
    return { etat: e, termine };
  }
  // Passe un livre à un statut et date le changement (début, fin) sans effacer l'historique.
  function changerStatut(etat, id, statut, date) {
    const livres = etat.livres.map((l) => {
      if (l.id !== id) return l;
      const n = { ...l, statut };
      if (statut === 'encours') { n.debut = n.debut || date; n.fin = ''; }
      if (statut === 'lu' || statut === 'abandonne') { n.debut = n.debut || date; n.fin = date; }
      if (statut === 'alire') { n.fin = ''; }
      return n;
    });
    return { ...etat, livres };
  }
  function supprimerLivre(etat, id) {
    return { ...etat, livres: etat.livres.filter((l) => l.id !== id), sessions: etat.sessions.filter((s) => s.livre !== id) };
  }
  function renommerGenre(etat, ancien, nouveau) {
    const n = txt(nouveau, 40);
    if (!n) return etat;
    const genres = [...new Set(etat.reglages.genres.map((x) => (x === ancien ? n : x)))];
    return { ...etat, reglages: { ...etat.reglages, genres }, livres: etat.livres.map((l) => (l.genre === ancien ? { ...l, genre: n } : l)) };
  }

  // ---------- Liste « à lire » ----------
  function aLire(etat) {
    return etat.livres.filter((l) => l.statut === 'alire')
      .sort((a, b) => a.priorite - b.priorite || a.ordre - b.ordre || (a.ajoute || '').localeCompare(b.ajoute || '') || a.titre.localeCompare(b.titre, 'fr'));
  }
  // Monte (sens -1) ou descend (sens 1) un livre dans la liste ; en franchissant le bord de sa priorité, il
  // passe à la priorité voisine. Les rangs sont renumérotés de 1 à n.
  function deplacer(etat, id, sens) {
    const liste = aLire(etat).map((l) => ({ ...l }));
    const i = liste.findIndex((l) => l.id === id);
    if (i < 0) return etat;
    const j = i + sens;
    if (j >= 0 && j < liste.length && liste[j].priorite === liste[i].priorite) [liste[i], liste[j]] = [liste[j], liste[i]];
    // Bord de sa priorité : il change de priorité sans changer de place (fin du groupe du dessus, début de celui du dessous).
    else if (sens < 0 && liste[i].priorite > 1) liste[i].priorite -= 1;
    else if (sens > 0 && liste[i].priorite < 3) liste[i].priorite += 1;
    else return etat;
    const parId = new Map(liste.map((l, k) => [l.id, { priorite: l.priorite, ordre: k + 1 }]));
    return { ...etat, livres: etat.livres.map((l) => (parId.has(l.id) ? { ...l, ...parId.get(l.id) } : l)) };
  }

  // ---------- Lectures datées ----------
  // Toutes les quantités lues, datées : les sessions, plus pour un livre « lu » la part non couverte par des
  // sessions (livre noté lu sans détail), comptée à sa date de fin.
  function lectures(etat) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const l = etat.sessions.filter((s) => parId.has(s.livre)).map((s) => ({ date: s.date, livre: s.livre, quantite: s.quantite, unite: unite(parId.get(s.livre)) }));
    for (const b of etat.livres) {
      if (b.statut !== 'lu' || !b.fin || !b.total) continue;
      const reste = b.total - cumul(etat, b.id);
      if (reste > 0) l.push({ date: b.fin, livre: b.id, quantite: reste, unite: unite(b), complement: true });
    }
    return l.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- Séries de jours de lecture ----------
  // Jours avec au moins une session. Série actuelle : jours consécutifs jusqu'à aujourd'hui, ou jusqu'à hier si
  // rien n'est encore noté aujourd'hui (la série n'est pas perdue avant la fin de la journée).
  function series(etat, auj) {
    const jours = [...new Set(etat.sessions.filter((s) => s.date <= auj).map((s) => s.date))].sort();
    const ens = new Set(jours);
    let record = 0, courant = 0, prec = '';
    for (const d of jours) {
      courant = prec && ajout(prec, 1) === d ? courant + 1 : 1;
      record = Math.max(record, courant);
      prec = d;
    }
    let actuelle = 0;
    let d = ens.has(auj) ? auj : ajout(auj, -1);
    while (ens.has(d)) { actuelle++; d = ajout(d, -1); }
    return { actuelle, record, aujourdhui: ens.has(auj), jours: jours.length };
  }

  // ---------- Objectif annuel ----------
  // Pour une cible (livres ou pages) : réalisé, attendu au jour près (cible × jours écoulés / jours de l'année),
  // écart, avance ou retard en jours (date à laquelle le réalisé aurait dû être atteint au rythme régulier),
  // projection au rythme de l'année et quantité nécessaire par jour pour finir à temps.
  function suiviObjectif(cible, fait, annee, auj) {
    const n = joursAnnee(annee);
    const a = Number(auj.slice(0, 4));
    const ecoules = annee < a ? n : annee > a ? 0 : jourDeLAnnee(auj);
    const restants = n - ecoules;
    const attendu = cible * ecoules / n;
    const r = { cible, fait, ecoules, restants, attendu, ecart: fait - attendu, atteint: cible > 0 && fait >= cible };
    r.part = cible ? fait / cible : null;
    r.joursAvance = cible && ecoules ? Math.round(fait * n / cible - ecoules) : null;
    r.projection = ecoules ? fait / ecoules * n : null;
    r.parJour = cible && restants > 0 && fait < cible ? (cible - fait) / restants : null;
    return r;
  }
  function objectifAnnee(etat, annee, auj) {
    const o = etat.reglages.objectifs[String(annee)] || { livres: 0, pages: 0 };
    const b = bilanAnnee(etat, annee, auj);
    return { annee, livres: o.livres ? suiviObjectif(o.livres, b.nbLivres, annee, auj) : null, pages: o.pages ? suiviObjectif(o.pages, b.pages, annee, auj) : null, bilan: b };
  }

  // ---------- Statistiques ----------
  const moyenne = (l) => (l.length ? l.reduce((t, x) => t + x, 0) / l.length : null);
  // Bilan d'une année : livres terminés (statut « lu », date de fin dans l'année), pages et minutes lues
  // (sessions et compléments datés dans l'année), par mois, par genre, par auteur, par format ; pages par jour
  // sur les jours écoulés de l'année.
  function bilanAnnee(etat, annee, auj) {
    const an = String(annee);
    const finis = etat.livres.filter((l) => l.statut === 'lu' && l.fin.slice(0, 4) === an).sort((a, b) => a.fin.localeCompare(b.fin));
    const abandons = etat.livres.filter((l) => l.statut === 'abandonne' && l.fin.slice(0, 4) === an);
    const lec = lectures(etat).filter((x) => x.date.slice(0, 4) === an && x.date <= auj);
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, livres: 0, pages: 0, minutes: 0 }));
    for (const l of finis) parMois[Number(l.fin.slice(5, 7)) - 1].livres++;
    let pages = 0, minutes = 0;
    for (const x of lec) {
      const m = parMois[Number(x.date.slice(5, 7)) - 1];
      if (x.unite === 'minutes') { m.minutes += x.quantite; minutes += x.quantite; } else { m.pages += x.quantite; pages += x.quantite; }
    }
    const grouper = (cle) => {
      const map = new Map();
      for (const l of finis) {
        const k = l[cle] || '';
        if (!map.has(k)) map.set(k, { nom: k, livres: 0, pages: 0, minutes: 0, notes: [] });
        const o = map.get(k);
        o.livres++;
        if (unite(l) === 'minutes') o.minutes += l.total; else o.pages += l.total;
        if (l.note) o.notes.push(l.note);
      }
      return [...map.values()].map((o) => ({ ...o, note: moyenne(o.notes) }))
        .sort((a, b) => b.livres - a.livres || b.pages - a.pages || a.nom.localeCompare(b.nom, 'fr'));
    };
    const parFormat = Object.keys(FORMATS).map((f) => ({ format: f, livres: finis.filter((l) => l.format === f).length }));
    const n = joursAnnee(Number(an));
    const a = Number(auj.slice(0, 4));
    const ecoules = Number(an) < a ? n : Number(an) > a ? 0 : jourDeLAnnee(auj);
    const joursLus = new Set(etat.sessions.filter((s) => s.date.slice(0, 4) === an && s.date <= auj).map((s) => s.date)).size;
    const notes = finis.map((l) => l.note).filter(Boolean);
    const durees = finis.filter((l) => l.debut).map((l) => ecart(l.debut, l.fin) + 1);
    const plusLong = finis.filter((l) => unite(l) === 'pages').sort((x, y) => y.total - x.total)[0] || null;
    return {
      annee: Number(an), finis, nbLivres: finis.length, abandons: abandons.length, pages, minutes, parMois,
      parGenre: grouper('genre'), parAuteur: grouper('auteur'), parFormat,
      pagesParJour: ecoules ? pages / ecoules : 0, joursLus, ecoules,
      noteMoyenne: moyenne(notes), dureeMoyenne: moyenne(durees), plusLong,
      livresIds: new Set(lec.map((x) => x.livre).filter((id) => parId.has(id))).size,
    };
  }
  // Années qui ont des lectures ou un objectif, plus l'année en cours, de la plus récente à la plus ancienne.
  function annees(etat, auj) {
    const s = new Set([Number(auj.slice(0, 4))]);
    for (const l of etat.livres) if (l.fin) s.add(Number(l.fin.slice(0, 4)));
    for (const x of etat.sessions) s.add(Number(x.date.slice(0, 4)));
    for (const a of Object.keys(etat.reglages.objectifs)) s.add(Number(a));
    return [...s].filter((a) => a > 1900 && a < 3000).sort((a, b) => b - a);
  }
  // Pages et minutes lues sur les `n` derniers jours (aujourd'hui compris), jour par jour.
  function derniersJours(etat, auj, n = 14) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const jours = Array.from({ length: n }, (_, i) => ({ date: ajout(auj, i - n + 1), pages: 0, minutes: 0 }));
    const idx = new Map(jours.map((j, i) => [j.date, i]));
    for (const s of etat.sessions) {
      if (!idx.has(s.date) || !parId.has(s.livre)) continue;
      const j = jours[idx.get(s.date)];
      if (unite(parId.get(s.livre)) === 'minutes') j.minutes += s.quantite; else j.pages += s.quantite;
    }
    return jours;
  }

  // ---------- Export CSV ----------
  // Point-virgule, BOM, formules neutralisées (une cellule qui commence par = + - @ est préfixée d'une apostrophe).
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  function csvLivres(etat) {
    const tete = ['Titre', 'Auteur', 'Genre', 'Format', 'Pages ou minutes', 'Unité', 'Statut', 'Priorité', 'Ajouté le', 'Début', 'Fin', 'Lu (pages ou minutes)', 'Note sur 5', 'Avis', 'Citations'];
    const lignes = etat.livres.slice().sort((a, b) => a.titre.localeCompare(b.titre, 'fr')).map((l) => {
      const p = progression(etat, l);
      return [l.titre, l.auteur, l.genre, FORMATS[l.format].nom, l.total || '', unite(l), STATUTS[l.statut], l.statut === 'alire' ? PRIORITES[l.priorite] : '', l.ajoute, l.debut, l.fin, p.fait, l.note || '', l.avis || '',
        (l.citations || []).map((c) => `${c.texte}${c.page ? ` (p. ${c.page})` : ''}`).join(' | ')];
    });
    return versCsv([tete, ...lignes]);
  }
  function csvSessions(etat) {
    const parId = new Map(etat.livres.map((l) => [l.id, l]));
    const lignes = etat.sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => { const l = parId.get(s.livre); return [s.date, l?.titre || '', l?.auteur || '', s.quantite, unite(l)]; });
    return versCsv([['Date', 'Titre', 'Auteur', 'Quantité', 'Unité'], ...lignes]);
  }

  g.PGS = {
    deux, iso, versDate, ajout, ecart, estDate, bissextile, joursAnnee, jourDeLAnnee, JOURS, MOIS, dateFrLongue, dateFr, dureeTexte, nombreTexte, plat, nouvelId,
    FORMATS, STATUTS, PRIORITES, unite, quantiteTexte,
    normaliserReglages, normaliserLivre, normaliserSession, normaliserCitation, etatVide, normaliser, taille,
    sessionsDe, cumul, progression, rythmeLivre, finEstimee, quantiteDepuisPosition, appliquerSession, changerStatut, supprimerLivre, renommerGenre,
    aLire, deplacer, lectures, series, suiviObjectif, objectifAnnee, bilanAnnee, annees, derniersJours, moyenne,
    champCsv, versCsv, csvLivres, csvSessions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
