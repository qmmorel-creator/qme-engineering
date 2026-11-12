// Règles métier du planning Gantt : calendrier (jours fériés calculés, jours ouvrés), ordonnancement,
// chemin critique (CPM), avancement, saisie rapide. Fonctions pures, sans DOM ni stockage.
// Chargé par l'application (window.REGLES) et par les tests (outils/templates/gantt.test.mjs).
(function (g) {
  'use strict';

  // ---------- Dates locales au format AAAA-MM-JJ ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const jourSemaine = (s) => versDate(s).getDay(); // 0 = dimanche
  const dateValide = (a, m, j) => { const d = new Date(a, m - 1, j); return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j; };
  const estIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateValide(...s.split('-').map(Number));

  // ---------- Jours fériés (Code du travail, art. L3133-1 ; Alsace-Moselle : Vendredi saint et 26 décembre) ----------
  // Dimanche de Pâques, algorithme grégorien anonyme (Meeus / Jones / Butcher).
  function paques(an) {
    const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - gg + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${an}-${deux(mois)}-${deux(jour)}`;
  }

  function feries(an, alsace = false) {
    const p = paques(an);
    const l = [
      [`${an}-01-01`, 'Jour de l\'an'],
      [ajout(p, 1), 'Lundi de Pâques'],
      [`${an}-05-01`, 'Fête du Travail'],
      [`${an}-05-08`, 'Victoire 1945'],
      [ajout(p, 39), 'Ascension'],
      [ajout(p, 50), 'Lundi de Pentecôte'],
      [`${an}-07-14`, 'Fête nationale'],
      [`${an}-08-15`, 'Assomption'],
      [`${an}-11-01`, 'Toussaint'],
      [`${an}-11-11`, 'Armistice 1918'],
      [`${an}-12-25`, 'Noël'],
    ];
    if (alsace) l.push([ajout(p, -2), 'Vendredi saint (Alsace-Moselle)'], [`${an}-12-26`, 'Saint-Étienne (Alsace-Moselle)']);
    return l.map(([date, nom]) => ({ date, nom })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- Calendrier : index de jour (calendaires ou ouvrés) ----------
  // L'origine est un lundi. En jours ouvrés, l'index compte les jours du lundi au vendredi hors fériés ;
  // une date non ouvrée prend l'index du jour ouvré suivant.
  const ORIGINE = '1990-01-01';
  const AN_MIN = 1990, AN_MAX = 2200;
  const tablesFeries = {};
  function tableFeries(alsace) {
    const cle = alsace ? 'a' : 'n';
    if (tablesFeries[cle]) return tablesFeries[cle];
    const dates = new Map();
    const decalages = [];
    for (let an = AN_MIN; an <= AN_MAX; an++) {
      for (const f of feries(an, alsace)) {
        dates.set(f.date, f.nom);
        const n = ecart(ORIGINE, f.date);
        if (((n % 7) + 7) % 7 < 5) decalages.push(n);
      }
    }
    decalages.sort((a, b) => a - b);
    tablesFeries[cle] = { dates, decalages };
    return tablesFeries[cle];
  }
  const avant = (t, n) => { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < n) lo = m + 1; else hi = m; } return lo; };

  function calendrier(options = {}) {
    const ouvres = !!options.ouvres;
    const alsace = !!options.alsace;
    const T = tableFeries(alsace);
    const memoDate = new Map();
    const indexDecalage = (n) => {
      if (!ouvres) return n;
      const r = ((n % 7) + 7) % 7;
      return Math.floor(n / 7) * 5 + Math.min(r, 5) - avant(T.decalages, n);
    };
    const idx = (date) => indexDecalage(ecart(ORIGINE, date));
    const date = (i) => {
      if (!ouvres) return ajout(ORIGINE, i);
      if (memoDate.has(i)) return memoDate.get(i);
      let lo = Math.min(i, 2 * i) - 400, hi = Math.max(i, 2 * i) + 400;
      while (lo < hi) { const m = Math.floor((lo + hi) / 2); if (indexDecalage(m) >= i) hi = m; else lo = m + 1; }
      // Les jours non ouvrés portent l'index du jour ouvré suivant : on avance jusqu'à lui.
      let d = ajout(ORIGINE, lo);
      while (!estOuvre(d)) d = ajout(d, 1);
      memoDate.set(i, d);
      return d;
    };
    const ferie = (d) => T.dates.get(d) || null;
    const estOuvre = (d) => { if (!ouvres) return true; const j = jourSemaine(d); return j !== 0 && j !== 6 && !T.dates.has(d); };
    return { ouvres, alsace, idx, date, ferie, estOuvre };
  }

  // Fériés tombant dans un intervalle [de, a] (pour l'affichage en périodes hachurées).
  function feriesEntre(de, a, alsace = false) {
    const l = [];
    for (let an = Number(de.slice(0, 4)); an <= Number(a.slice(0, 4)); an++) for (const f of feries(an, alsace)) if (f.date >= de && f.date <= a) l.push(f);
    return l;
  }

  // Fin d'une tâche (inclusive) : durée en jours du calendrier, début compris.
  function finTache(debut, duree, cal) {
    const i = cal.idx(debut);
    return duree > 0 ? cal.date(i + duree - 1) : cal.date(i);
  }

  // ---------- Dépendances ----------
  // FD fin → début, DD début → début, FF fin → fin, DF début → fin ; décalage en jours (négatif = chevauchement).
  const TYPES = ['FD', 'DD', 'FF', 'DF'];
  const ANGLAIS = { FS: 'FD', SS: 'DD', FF: 'FF', SF: 'DF' };
  const NOMS_TYPES = { FD: 'fin → début', DD: 'début → début', FF: 'fin → fin', DF: 'début → fin' };

  // Contrainte sur le début au plus tôt du successeur.
  function contrainteDebut(type, L, p, durSucc) {
    if (type === 'DD') return p.es + L;
    if (type === 'FF') return p.ef + L - durSucc;
    if (type === 'DF') return p.es + L - durSucc;
    return p.ef + L;
  }
  // Contrainte sur la fin au plus tard du prédécesseur.
  function contrainteFinTard(type, L, s, durPred) {
    if (type === 'DD') return s.ls - L + durPred;
    if (type === 'FF') return s.lf - L;
    if (type === 'DF') return s.lf - L + durPred;
    return s.ls - L;
  }
  // Marge libre laissée par un lien.
  function jeuLien(type, L, p, s) {
    if (type === 'DD') return s.es - (p.es + L);
    if (type === 'FF') return s.ef - (p.ef + L);
    if (type === 'DF') return s.ef - (p.es + L);
    return s.es - (p.ef + L);
  }

  // « 3, 5DD+2, 7FF-1 » → [{ num, type, decalage }]. Codes anglais acceptés (FS, SS, SF).
  function lireDeps(texte) {
    const deps = [], erreurs = [];
    for (const brut of String(texte || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
      const m = brut.replace(/\s+/g, '').match(/^(\d+)([A-Za-z]{2})?([+-]\d+)?j?$/i);
      const code = m?.[2]?.toUpperCase();
      const type = !code ? 'FD' : TYPES.includes(code) ? code : ANGLAIS[code];
      if (!m || !type) { erreurs.push(brut); continue; }
      deps.push({ num: Number(m[1]), type, decalage: m[3] ? Number(m[3]) : 0 });
    }
    return { deps, erreurs };
  }
  function ecrireDep(num, type, decalage) {
    return `${num}${type === 'FD' && decalage ? 'FD' : type === 'FD' ? '' : type}${decalage > 0 ? `+${decalage}` : decalage < 0 ? decalage : ''}`;
  }

  // Ajouter le lien pred → succ créerait-il une boucle ? (succ précède déjà pred, ou lien sur soi-même)
  function creeBoucle(taches, predId, succId) {
    if (predId === succId) return true;
    const parId = new Map(taches.map((t) => [t.id, t]));
    const vus = new Set();
    const pile = [predId];
    while (pile.length) {
      const id = pile.pop();
      if (id === succId) return true;
      if (vus.has(id)) continue;
      vus.add(id);
      for (const d of parId.get(id)?.deps || []) pile.push(d.id);
    }
    return false;
  }

  // ---------- Ordonnancement et chemin critique (CPM) ----------
  // taches : [{ id, debut|null, duree, deps:[{ id, type, decalage }] }] d'un même planning.
  // debut : « pas avant le » (contrainte) ; sans date ni lien, la tâche démarre au début du planning.
  // Index en jours du calendrier : [es, ef[ ; un jalon (durée 0) a es = ef.
  function ordonnancer(taches, cal, debutPlanning) {
    const parId = new Map(taches.map((t) => [t.id, t]));
    const succs = new Map(taches.map((t) => [t.id, []]));
    const nbPreds = new Map(taches.map((t) => [t.id, 0]));
    for (const t of taches) {
      for (const d of t.deps || []) {
        if (!parId.has(d.id) || d.id === t.id) continue;
        succs.get(d.id).push({ id: t.id, type: d.type, decalage: d.decalage || 0 });
        nbPreds.set(t.id, nbPreds.get(t.id) + 1);
      }
    }
    // Tri topologique (Kahn) ; ce qui reste est pris dans une boucle (liens ignorés).
    const ordre = [];
    const file = taches.filter((t) => !nbPreds.get(t.id)).map((t) => t.id);
    const reste = new Map(nbPreds);
    while (file.length) {
      const id = file.shift();
      ordre.push(id);
      for (const s of succs.get(id)) { reste.set(s.id, reste.get(s.id) - 1); if (!reste.get(s.id)) file.push(s.id); }
    }
    const boucles = taches.filter((t) => !ordre.includes(t.id)).map((t) => t.id);
    ordre.push(...boucles);
    const enBoucle = new Set(boucles);

    const R = new Map();
    const base = cal.idx(debutPlanning);
    for (const id of ordre) {
      const t = parId.get(id);
      const dur = Math.max(0, Math.round(t.duree || 0));
      const liens = (t.deps || []).filter((d) => parId.has(d.id) && d.id !== id && R.has(d.id) && !enBoucle.has(id));
      let es = t.debut ? cal.idx(t.debut) : liens.length ? -Infinity : base;
      for (const d of liens) es = Math.max(es, contrainteDebut(d.type, d.decalage || 0, R.get(d.id), dur));
      if (!Number.isFinite(es)) es = base;
      R.set(id, { id, dur, es, ef: es + dur });
    }
    const finProjet = taches.length ? Math.max(...[...R.values()].map((r) => r.ef)) : base;
    for (const id of [...ordre].reverse()) {
      const r = R.get(id);
      let lf = finProjet;
      let libre = finProjet - r.ef;
      for (const s of succs.get(id)) {
        if (enBoucle.has(s.id)) continue;
        const rs = R.get(s.id);
        lf = Math.min(lf, contrainteFinTard(s.type, s.decalage, rs, r.dur));
        libre = Math.min(libre, jeuLien(s.type, s.decalage, r, rs));
      }
      r.lf = lf; r.ls = lf - r.dur;
      r.margeTotale = r.ls - r.es;
      r.margeLibre = Math.max(0, Math.min(libre, r.margeTotale));
      r.critique = r.margeTotale <= 0;
    }
    for (const r of R.values()) {
      r.debut = cal.date(r.es);
      r.fin = r.dur > 0 ? cal.date(r.ef - 1) : cal.date(r.es);
      r.debutTard = cal.date(r.ls);
      r.finTard = r.dur > 0 ? cal.date(r.lf - 1) : cal.date(r.ls);
    }
    return { taches: R, ordre, boucles, debut: taches.length ? Math.min(...[...R.values()].map((r) => r.es)) : base, fin: finProjet };
  }

  // ---------- Avancement et retard ----------
  // Avancement attendu au matin de « aujourd'hui » : part des jours du calendrier déjà écoulés.
  function attendu(r, aujIdx) {
    if (r.dur === 0) return aujIdx > r.es ? 1 : 0;
    return Math.min(1, Math.max(0, (aujIdx - r.es) / r.dur));
  }
  function statut(r, avancement, aujIdx) {
    const av = Math.min(100, Math.max(0, Number(avancement) || 0)) / 100;
    const att = attendu(r, aujIdx);
    if (av >= 1) return { code: 'termine', attendu: att, retard: 0 };
    if (av + 1e-9 < att) return { code: 'retard', attendu: att, retard: r.dur === 0 ? aujIdx - r.es : Math.ceil((att - av) * r.dur - 1e-9) };
    if (av > 0 || att > 0) return { code: 'encours', attendu: att, retard: 0 };
    return { code: 'avenir', attendu: att, retard: 0 };
  }
  // Avancement global pondéré par les durées (un jalon compte pour 1 jour).
  function avancementGlobal(liste) {
    let poids = 0, fait = 0;
    for (const { dur, avancement } of liste) { const p = Math.max(1, dur); poids += p; fait += p * Math.min(100, Math.max(0, avancement || 0)); }
    return poids ? Math.round(fait / poids) : 0;
  }
  // Écart de fin par rapport au planning de référence, en jours du calendrier (positif = en retard).
  function ecartReference(r, ref, cal) {
    if (!ref?.fin) return null;
    return cal.idx(r.fin) - cal.idx(ref.fin);
  }
  // Jalon à plage : position de la date calculée par rapport à la fenêtre [debut, fin].
  function etatPlage(date, plage) {
    if (!plage?.debut || !plage?.fin) return null;
    if (date < plage.debut) return { code: 'avance', jours: ecart(date, plage.debut) };
    if (date > plage.fin) return { code: 'depasse', jours: ecart(plage.fin, date) };
    return { code: 'dans', jours: ecart(date, plage.fin) };
  }

  // ---------- Saisie rapide ----------
  // « Maquette accueil 12/11 5j 40% après 2 » ; « Réception jalon plage 10/12-18/12 après 5 » ; « _Lot_1 » = section.
  const RE_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
  function lireDate(txt, aujourdhui) {
    const m = String(txt).match(RE_DATE);
    if (!m) return null;
    const j = Number(m[1]), mo = Number(m[2]);
    if (m[3]) { const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return dateValide(a, mo, j) ? `${a}-${deux(mo)}-${deux(j)}` : null; }
    // Sans année : l'occurrence la plus proche d'aujourd'hui.
    const a0 = Number(aujourdhui.slice(0, 4));
    const cand = [a0 - 1, a0, a0 + 1].filter((a) => dateValide(a, mo, j)).map((a) => `${a}-${deux(mo)}-${deux(j)}`);
    if (!cand.length) return null;
    return cand.sort((x, y) => Math.abs(ecart(aujourdhui, x)) - Math.abs(ecart(aujourdhui, y)))[0];
  }
  const RE_DEP = /^(\d+)(FD|DD|FF|DF|FS|SS|SF)?([+-]\d+j?)?,?$/i;

  function lireSaisie(ligne, options = {}) {
    const aujourdhui = options.aujourdhui;
    const texte = String(ligne || '').trim();
    if (!texte) return { vide: true };
    if (texte.startsWith('_')) {
      const nom = texte.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      return nom ? { section: nom } : { vide: true };
    }
    const mots = texte.split(/\s+/);
    const res = { nom: '', debut: null, duree: null, avancement: null, deps: [], jalon: false, plage: null, erreurs: [] };
    const nom = [];
    for (let i = 0; i < mots.length; i++) {
      const m = mots[i];
      const bas = m.toLowerCase();
      if (bas === 'après' || bas === 'apres') {
        let k = i + 1, pris = 0;
        while (k < mots.length && RE_DEP.test(mots[k]) && !/^\d+j$/i.test(mots[k])) {
          const { deps, erreurs } = lireDeps(mots[k]);
          res.deps.push(...deps); res.erreurs.push(...erreurs);
          k++; pris++;
          if (!mots[k - 1].endsWith(',') && !(mots[k] && /^\d+(FD|DD|FF|DF|FS|SS|SF)/i.test(mots[k]))) break;
        }
        if (pris) { i = k - 1; continue; }
      }
      if (bas === 'plage' && i + 1 < mots.length) {
        const deuxDates = mots[i + 1].split(/[-–→]/);
        let d1 = null, d2 = null, saut = 0;
        if (deuxDates.length === 2) { d1 = lireDate(deuxDates[0], aujourdhui); d2 = lireDate(deuxDates[1], aujourdhui); saut = 1; }
        else if (i + 2 < mots.length) {
          const s = ['au', 'à', 'a', '-', '–'].includes(mots[i + 2].toLowerCase()) ? 1 : 0;
          d1 = lireDate(mots[i + 1], aujourdhui); d2 = lireDate(mots[i + 2 + s] || '', aujourdhui); saut = 2 + s;
        }
        if (d1 && d2) {
          if (d2 < d1) [d1, d2] = [d2, d1];
          res.plage = { debut: d1, fin: d2 };
          res.jalon = true; i += saut; continue;
        }
      }
      if (bas === 'jalon') { res.jalon = true; continue; }
      if ((bas === 'le' || bas === 'dès' || bas === 'des') && mots[i + 1] && RE_DATE.test(mots[i + 1]) && !res.debut) continue;
      if (RE_DATE.test(m) && !res.debut) {
        const d = lireDate(m, aujourdhui);
        if (d) { res.debut = d; continue; }
        res.erreurs.push(m); continue;
      }
      let dm = m.match(/^(\d+)(j|jours?|s|sem|semaines?)$/i);
      if (!dm && /^\d+$/.test(m) && /^(j|jours?|sem|semaines?)$/i.test(mots[i + 1] || '')) { dm = [m, m, mots[i + 1]]; i++; }
      if (dm && res.duree === null) {
        const n = Number(dm[1]);
        res.duree = /^s/i.test(dm[2]) ? n * (options.ouvres ? 5 : 7) : n;
        continue;
      }
      const pc = m.match(/^(\d{1,3})%$/);
      if (pc && res.avancement === null) { res.avancement = Math.min(100, Number(pc[1])); continue; }
      nom.push(m);
    }
    res.nom = nom.join(' ').trim();
    if (res.jalon) res.duree = 0;
    if (res.duree === 0) res.jalon = true;
    return res;
  }

  // ---------- Échelle de temps ----------
  // Pas de graduation selon le zoom (pixels par jour).
  function niveauEchelle(zoom) {
    if (zoom >= 18) return 'jour';
    if (zoom >= 3.5) return 'semaine';
    if (zoom >= 0.9) return 'mois';
    if (zoom >= 0.28) return 'trimestre';
    return 'annee';
  }
  // Zoom pour faire tenir [de, a] dans une largeur donnée (bornes du zoom continu).
  const ZOOM_MIN = 0.12, ZOOM_MAX = 60;
  function zoomPourAjuster(de, a, largeur) {
    const jours = Math.max(1, ecart(de, a) + 1);
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, largeur / jours));
  }
  // Numéro de semaine ISO 8601.
  function semaineIso(s) {
    const d = versDate(s);
    const j = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - j + 3);
    const premier = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - premier) / 86400000 - 3 + ((premier.getDay() + 6) % 7)) / 7);
  }

  // ---------- Plannings ----------
  // Ordre d'affichage : tâches hors section d'abord, puis chaque section dans son ordre.
  function ordreAffichage(planning, taches) {
    const miennes = taches.filter((t) => t.planningId === planning.id);
    const ids = new Set((planning.sections || []).map((s) => s.id));
    const l = miennes.filter((t) => !t.sectionId || !ids.has(t.sectionId));
    for (const s of planning.sections || []) l.push(...miennes.filter((t) => t.sectionId === s.id));
    return l;
  }

  // Modèle → sections et tâches neuves ; les liens du modèle (n° de ligne) deviennent des identifiants.
  function instancierModele(modele, debut, uid) {
    const sections = modele.sections.map((nom) => ({ id: uid(), nom, replie: false }));
    const ids = modele.taches.map(() => uid());
    const taches = modele.taches.map(([s, nom, duree, deps, opt = {}], i) => ({
      id: ids[i], sectionId: sections[s]?.id ?? null, nom, debut: null, duree, avancement: 0,
      deps: lireDeps(deps).deps.filter((x) => x.num >= 1 && x.num <= ids.length && x.num !== i + 1).map((x) => ({ id: ids[x.num - 1], type: x.type, decalage: x.decalage })),
      plage: opt.plage ? { debut: ajout(debut, opt.plage[0]), fin: ajout(debut, opt.plage[1]) } : null,
      reference: null, note: '',
    }));
    return { sections, taches };
  }

  g.REGLES = {
    iso, versDate, ajout, ecart, jourSemaine, dateValide, estIso,
    paques, feries, feriesEntre, calendrier, finTache, ORIGINE,
    TYPES, NOMS_TYPES, lireDeps, ecrireDep, creeBoucle,
    ordonnancer, attendu, statut, avancementGlobal, ecartReference, etatPlage,
    lireDate, lireSaisie, ordreAffichage, instancierModele, niveauEchelle, zoomPourAjuster, ZOOM_MIN, ZOOM_MAX, semaineIso,
  };
})(typeof window !== 'undefined' ? window : globalThis);
