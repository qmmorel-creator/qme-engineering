// Planner horaire QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.PHR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), heures en minutes depuis minuit.
(function (racine) {
  'use strict';

  const PAS = 30;          // grille de 30 minutes
  const JOUR = 24 * 60;    // un bloc ne déborde jamais sur le lendemain
  const STATUTS = ['prevu', 'fait', 'raccourci', 'deplace', 'pasfait'];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const jourIndex = (s) => (versDate(s).getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  const lundiDe = (s) => ajout(s, -jourIndex(s));
  const joursSemaine = (lundi, n = 7) => Array.from({ length: n }, (_, i) => ajout(lundi, i));

  // ---------- Heures et durées ----------
  // « 9 », « 9h », « 9 h 30 », « 9:30 », « 09h05 » → minutes ; null si illisible ou hors de la journée.
  function lireHeure(saisie) {
    const s = String(saisie ?? '').trim().toLowerCase().replace(/\s+/g, '');
    const m = /^(\d{1,2})(?:[h:](\d{2})?)?$/.exec(s);
    if (!m) return null;
    const h = Number(m[1]), mn = Number(m[2] || 0);
    if (h > 24 || mn > 59 || (h === 24 && mn > 0)) return null;
    return h * 60 + mn;
  }
  const hhmm = (min) => `${deux(Math.floor(min / 60))}:${deux(min % 60)}`;
  const heure = (min) => `${Math.floor(min / 60)} h${min % 60 ? ` ${deux(min % 60)}` : ''}`;
  function duree(min) {
    const n = Math.round(Math.abs(min));
    const h = Math.floor(n / 60), m = n % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${deux(m)}` : `${h} h`;
  }
  const arrondir = (min, pas = PAS) => Math.round(min / pas) * pas;

  // Garde un bloc dans la journée : durée de 30 min à 24 h, début entre minuit et (minuit − durée).
  function borner(debut, d) {
    const dur = Math.min(JOUR, Math.max(PAS, arrondir(d)));
    const deb = Math.min(JOUR - dur, Math.max(0, arrondir(debut)));
    return { debut: deb, duree: dur };
  }

  // ---------- Séries récurrentes ----------
  // serie : { id, titre, cat, jours: [0..6], debut, duree, depuis, jusqua|null, exceptions: {date: true}, note }
  function occurrenceDe(serie, date) {
    if (date < serie.depuis || (serie.jusqua && date > serie.jusqua)) return false;
    if (serie.exceptions && serie.exceptions[date]) return false;
    return serie.jours.includes(jourIndex(date));
  }

  const idOccurrence = (serieId, date) => `s:${serieId}:${date}`;
  const estOccurrence = (id) => typeof id === 'string' && id.startsWith('s:');

  // Blocs à afficher entre deux dates incluses : blocs ponctuels + occurrences calculées des séries.
  function occurrences(etat, de, a) {
    const liste = etat.blocs.filter((b) => b.date >= de && b.date <= a).map((b) => ({ ...b, virtuel: false }));
    for (const s of etat.series) {
      for (let d = de; d <= a; d = ajout(d, 1)) {
        if (!occurrenceDe(s, d)) continue;
        liste.push({ id: idOccurrence(s.id, d), serieId: s.id, date: d, debut: s.debut, duree: s.duree, titre: s.titre, cat: s.cat, note: s.note || '', statut: 'prevu', virtuel: true });
      }
    }
    return liste.sort((x, y) => x.date.localeCompare(y.date) || x.debut - y.debut || y.duree - x.duree || String(x.titre).localeCompare(String(y.titre)));
  }

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // Transforme une occurrence calculée en bloc ponctuel (exception sur sa série). Renvoie le bloc.
  function materialiser(etat, id) {
    if (!estOccurrence(id)) return etat.blocs.find((b) => b.id === id) || null;
    const [, serieId, date] = id.split(':');
    const s = etat.series.find((x) => x.id === serieId);
    if (!s || !occurrenceDe(s, date)) return null;
    s.exceptions = { ...(s.exceptions || {}), [date]: true };
    const b = { id: nouvelId(), serieId, date, debut: s.debut, duree: s.duree, titre: s.titre, cat: s.cat, note: s.note || '', statut: 'prevu' };
    etat.blocs.push(b);
    return b;
  }

  // Supprime un bloc ou une seule occurrence d'une série.
  function supprimer(etat, id) {
    if (estOccurrence(id)) {
      const [, serieId, date] = id.split(':');
      const s = etat.series.find((x) => x.id === serieId);
      if (s) s.exceptions = { ...(s.exceptions || {}), [date]: true };
      return;
    }
    const b = etat.blocs.find((x) => x.id === id);
    etat.blocs = etat.blocs.filter((x) => x.id !== id);
    // Une copie déplacée supprimée rend son origine « pas faite » plutôt que de la laisser pointer dans le vide.
    if (b?.deId) { const o = etat.blocs.find((x) => x.id === b.deId); if (o && o.statut === 'deplace') { o.statut = 'pasfait'; delete o.versId; } }
  }

  // Arrête une série à partir d'une date (exclue de la série) ; les occurrences détachées encore
  // « prévues » à partir de cette date disparaissent, l'historique marqué reste.
  function arreterSerie(etat, serieId, date) {
    const s = etat.series.find((x) => x.id === serieId);
    if (!s) return;
    if (date <= s.depuis) etat.series = etat.series.filter((x) => x.id !== serieId);
    else s.jusqua = ajout(date, -1);
    etat.blocs = etat.blocs.filter((b) => !(b.serieId === serieId && b.date >= date && b.statut === 'prevu'));
  }

  // Modifie une série à partir d'une date : l'ancienne s'arrête la veille, une nouvelle prend le relais.
  function modifierSerieDepuis(etat, serieId, date, changements) {
    const s = etat.series.find((x) => x.id === serieId);
    if (!s) return null;
    const exceptions = Object.fromEntries(Object.entries(s.exceptions || {}).filter(([d]) => d >= date));
    const nouvelle = { ...s, ...changements, id: nouvelId(), depuis: date < s.depuis ? s.depuis : date, exceptions };
    if (date <= s.depuis) etat.series = etat.series.filter((x) => x.id !== serieId);
    else {
      s.jusqua = ajout(date, -1);
      s.exceptions = Object.fromEntries(Object.entries(s.exceptions || {}).filter(([d]) => d < date));
    }
    // Les occurrences détachées encore prévues suivent la nouvelle série.
    etat.blocs.filter((b) => b.serieId === serieId && b.date >= date).forEach((b) => { b.serieId = nouvelle.id; });
    etat.series.push(nouvelle);
    return nouvelle;
  }

  // ---------- Disposition des chevauchements ----------
  // Pour les blocs d'un même jour : couloir (0..n-1) et nombre de couloirs du groupe qui se recouvre.
  function disposer(blocs) {
    const tri = [...blocs].sort((a, b) => a.debut - b.debut || b.duree - a.duree);
    const res = {};
    let groupe = [], finGroupe = -1, fins = [];
    const clore = () => { const n = fins.length; groupe.forEach((id) => { res[id].couloirs = n; }); groupe = []; fins = []; };
    for (const b of tri) {
      if (b.debut >= finGroupe) { clore(); finGroupe = -1; }
      let c = fins.findIndex((f) => f <= b.debut);
      if (c < 0) { c = fins.length; fins.push(0); }
      fins[c] = b.debut + b.duree;
      res[b.id] = { couloir: c, couloirs: 1 };
      groupe.push(b.id);
      finGroupe = Math.max(finGroupe, b.debut + b.duree);
    }
    clore();
    return res;
  }

  const chevauche = (a, b) => a.date === b.date && a.debut < b.debut + b.duree && b.debut < a.debut + a.duree;

  // ---------- Marques et bilan ----------
  // maintenant : { date, min }. Un bloc se marque dès qu'il a commencé.
  const commence = (b, maintenant) => b.date < maintenant.date || (b.date === maintenant.date && b.debut <= maintenant.min);

  function realise(b) {
    if (b.statut === 'fait') return b.duree;
    if (b.statut === 'raccourci') return Math.max(0, Math.min(b.duree, b.dureeReelle || 0));
    return 0;
  }

  // Applique une marque à un bloc ponctuel (déjà matérialisé).
  function marquer(b, statut, dureeReelle) {
    if (!STATUTS.includes(statut)) return 'Marque inconnue.';
    if (statut === 'raccourci') {
      const d = Number(dureeReelle);
      if (!Number.isFinite(d) || d <= 0 || d >= b.duree || d % 15) return `Durée réelle : un multiple de 15 min, inférieur à ${duree(b.duree)}.`;
      b.dureeReelle = d;
    } else delete b.dureeReelle;
    b.statut = statut;
    return null;
  }

  // « Déplacé » : l'original reste (fantôme) et une copie prévue est posée au nouveau créneau.
  function deplacerVers(etat, id, date, debut) {
    const o = materialiser(etat, id);
    if (!o) return null;
    const p = borner(debut, o.duree);
    const copie = { id: nouvelId(), date, debut: p.debut, duree: p.duree, titre: o.titre, cat: o.cat, note: o.note || '', statut: 'prevu', deId: o.id };
    o.statut = 'deplace'; o.versId = copie.id; delete o.dureeReelle;
    etat.blocs.push(copie);
    return copie;
  }

  function vide() { return { prevu: 0, prevuAJour: 0, realise: 0, deplaces: 0, pasFaits: 0, aMarquer: 0, blocs: 0 }; }

  // Bilan d'une semaine (lundi → dimanche), par catégorie, dans l'ordre des catégories de l'état.
  function bilan(etat, lundi, maintenant) {
    const liste = occurrences(etat, lundi, ajout(lundi, 6));
    const parCat = new Map(etat.categories.map((c) => [c.id, { id: c.id, nom: c.nom, couleur: c.couleur, ...vide() }]));
    const total = vide();
    for (const b of liste) {
      if (!parCat.has(b.cat)) parCat.set(b.cat, { id: b.cat, nom: 'Sans catégorie', couleur: null, ...vide() });
      const c = parCat.get(b.cat);
      for (const x of [c, total]) {
        if (b.statut === 'deplace') { x.deplaces++; continue; }
        x.blocs++;
        x.prevu += b.duree;
        if (commence(b, maintenant)) {
          x.prevuAJour += b.duree;
          if (b.statut === 'prevu') x.aMarquer++;
        }
        if (b.statut === 'pasfait') x.pasFaits++;
        x.realise += realise(b);
      }
    }
    const taux = (x) => (x.prevuAJour ? Math.round((x.realise / x.prevuAJour) * 100) : null);
    const categories = [...parCat.values()].map((c) => ({ ...c, taux: taux(c) }));
    return { lundi, categories, total: { ...total, taux: taux(total) } };
  }

  // Tendance des n semaines qui finissent par la semaine de « lundi ».
  function tendance(etat, lundi, n, maintenant) {
    return Array.from({ length: n }, (_, i) => {
      const l = ajout(lundi, -7 * (n - 1 - i));
      const t = bilan(etat, l, maintenant).total;
      return { lundi: l, prevu: t.prevu, prevuAJour: t.prevuAJour, realise: t.realise, taux: t.taux };
    });
  }

  // ---------- Modèles de semaine ----------
  // modele.blocs : [{ titre, cat, jours: [0..6], debut, duree }]. presets : catégories de la base.
  // Ajoute à l'état les catégories manquantes (couleur préréglée si libre, sinon la première libre ;
  // au-delà de 8, le bloc rejoint la première catégorie existante). Renvoie la table cat → id réel.
  function assurerCategories(etat, ids, presets, couleurs) {
    const table = {};
    for (const id of ids) {
      if (etat.categories.some((c) => c.id === id)) { table[id] = id; continue; }
      const p = presets.find((x) => x.id === id) || { id, nom: id, couleur: couleurs[0] };
      const prises = new Set(etat.categories.map((c) => c.couleur));
      const couleur = !prises.has(p.couleur) ? p.couleur : couleurs.find((c) => !prises.has(c));
      if (!couleur) { table[id] = etat.categories[0]?.id ?? id; continue; }
      etat.categories.push({ id: p.id, nom: p.nom, couleur });
      table[id] = p.id;
    }
    return table;
  }

  // Pose un modèle sur la semaine de « lundi » : blocs ponctuels, ou séries répétées chaque semaine.
  function appliquerModele(etat, modele, lundi, { recurrent = false, presets = [], couleurs = [] } = {}) {
    const table = assurerCategories(etat, [...new Set(modele.blocs.map((b) => b.cat))], presets, couleurs);
    let n = 0;
    for (const m of modele.blocs) {
      const p = borner(m.debut, m.duree);
      if (recurrent) {
        etat.series.push({ id: nouvelId(), titre: m.titre, cat: table[m.cat], jours: [...m.jours].sort(), debut: p.debut, duree: p.duree, depuis: lundi, jusqua: null, exceptions: {}, note: '' });
        n += m.jours.length;
      } else {
        for (const j of m.jours) { etat.blocs.push({ id: nouvelId(), date: ajout(lundi, j), debut: p.debut, duree: p.duree, titre: m.titre, cat: table[m.cat], note: '', statut: 'prevu' }); n++; }
      }
    }
    return n;
  }

  // Copie les blocs ponctuels d'une semaine vers une autre (les séries se répètent déjà seules ;
  // les fantômes « déplacé » ne sont pas copiés). Les copies repartent « prévues ».
  function copierSemaine(etat, lundiSource, lundiCible) {
    const k = ecart(lundiSource, lundiCible);
    const fin = ajout(lundiSource, 6);
    const src = etat.blocs.filter((b) => b.date >= lundiSource && b.date <= fin && !b.serieId && b.statut !== 'deplace');
    for (const b of src) etat.blocs.push({ id: nouvelId(), date: ajout(b.date, k), debut: b.debut, duree: b.duree, titre: b.titre, cat: b.cat, note: b.note || '', statut: 'prevu' });
    return src.length;
  }

  // Enregistre la semaine affichée comme modèle : blocs identiques regroupés sur leurs jours.
  function semaineVersModele(etat, lundi, nom) {
    const groupes = new Map();
    for (const b of occurrences(etat, lundi, ajout(lundi, 6))) {
      if (b.statut === 'deplace') continue;
      const cle = [b.titre, b.cat, b.debut, b.duree].join('|');
      if (!groupes.has(cle)) groupes.set(cle, { titre: b.titre, cat: b.cat, jours: [], debut: b.debut, duree: b.duree });
      const g = groupes.get(cle);
      const j = jourIndex(b.date);
      if (!g.jours.includes(j)) g.jours.push(j);
    }
    const blocs = [...groupes.values()].map((g) => ({ ...g, jours: g.jours.sort() }));
    return { id: nouvelId(), nom, blocs };
  }

  // Total prévu d'un modèle (minutes par semaine), pour l'aperçu.
  const totalModele = (modele) => modele.blocs.reduce((s, b) => s + b.duree * b.jours.length, 0);

  racine.PHR = {
    PAS, JOUR, STATUTS,
    iso, versDate, ajout, ecart, jourIndex, lundiDe, joursSemaine,
    lireHeure, hhmm, heure, duree, arrondir, borner,
    occurrenceDe, idOccurrence, estOccurrence, occurrences, materialiser, supprimer, arreterSerie, modifierSerieDepuis,
    disposer, chevauche, commence, realise, marquer, deplacerVers, bilan, tendance,
    assurerCategories, appliquerModele, copierSemaine, semaineVersModele, totalModele,
  };
})(typeof window !== 'undefined' ? window : globalThis);
