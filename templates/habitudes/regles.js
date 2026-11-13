// Suivi d'habitudes QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.HBT) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; jours : 0 = lundi … 6 = dimanche.
//
// Journal : etat.journal[date][idHabitude] = true (fait) | false (pas fait) | nombre | 'na' (non applicable).
// Thème « une seule par jour » : etat.journal[date]['@' + idTheme] = idHabitude choisie | 'na'.
// Une case absente = rien de saisi : « en attente » aujourd'hui, « manqué » les jours passés.
(function (racine) {
  'use strict';

  const NA = 'na';
  const TOUS = [0, 1, 2, 3, 4, 5, 6];

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const jourIndex = (s) => (versDate(s).getDay() + 6) % 7;
  const lundiDe = (s) => ajout(s, -jourIndex(s));
  const premierDuMois = (s) => `${s.slice(0, 8)}01`;
  const joursDuMois = (s) => {
    const [a, m] = s.split('-').map(Number);
    const n = new Date(a, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${a}-${deux(m)}-${deux(i + 1)}`);
  };
  const moisSuivant = (s, k = 1) => { const [a, m] = s.split('-').map(Number); return iso(new Date(a, m - 1 + k, 1)); };

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Nombres ----------
  // « 1,5 », « 2 », « 0.5 » → nombre ≥ 0 arrondi au centième ; null si illisible ou négatif.
  function lireNombre(saisie) {
    const s = String(saisie ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
    return Math.round(Number(s) * 100) / 100;
  }
  const arrondi = (x) => Math.round(x * 100) / 100;
  const nombreTexte = (x) => String(arrondi(x)).replace('.', ',');

  // ---------- Habitudes et thèmes ----------
  const MOTS_SANTE = /(m[ée]dic|traitement|comprim|pilule|g[ée]lule|cachet|ordonnance|insuline|injection|glyc[ée]mie|tension art|inhalateur|collyre|antibio|posologie)/i;
  // Habitude de santé : marquée dans la base, ou dont le nom évoque un traitement.
  const estSante = (h) => !!(h && (h.sante || MOTS_SANTE.test(h.nom || '')));

  function normaliserHabitude(h, aujourdhui) {
    const type = h.type === 'nombre' ? 'nombre' : 'case';
    const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Math.max(0, Number(x)));
    const jours = Array.isArray(h.jours) ? [...new Set(h.jours.map(Number).filter((j) => j >= 0 && j <= 6))].sort() : [...TOUS];
    const res = {
      id: String(h.id || nouvelId()), theme: String(h.theme || ''), nom: String(h.nom || 'Habitude').slice(0, 60), type,
      unite: type === 'nombre' ? String(h.unite || 'fois').slice(0, 12) : '',
      min: type === 'nombre' ? num(h.min) : null, max: type === 'nombre' ? num(h.max) : null,
      pas: type === 'nombre' ? (num(h.pas) || 1) : 1,
      jours: jours.length ? jours : [...TOUS],
      depuis: /^\d{4}-\d{2}-\d{2}$/.test(h.depuis || '') ? h.depuis : aujourdhui,
      archive: /^\d{4}-\d{2}-\d{2}$/.test(h.archive || '') ? h.archive : null,
      sante: !!h.sante, note: String(h.note || ''),
    };
    // Bornes incohérentes (min > max) : on garde le minimum, le maximum devient le minimum.
    if (res.min !== null && res.max !== null && res.min > res.max) res.max = res.min;
    return res;
  }

  // Erreur de saisie d'une habitude chiffrée, ou null.
  function verifierHabitude(h) {
    if (!String(h.nom || '').trim()) return 'Donne un nom à l\'habitude.';
    if (!h.jours || !h.jours.length) return 'Choisis au moins un jour.';
    if (h.type === 'nombre') {
      if (h.min === null && h.max === null) return 'Fixe un minimum, un maximum, ou les deux.';
      if (h.min !== null && h.max !== null && h.min > h.max) return 'Le minimum dépasse le maximum.';
      if (!(h.pas > 0)) return 'Le pas doit être supérieur à 0.';
    }
    return null;
  }

  function objectifTexte(h) {
    if (h.type !== 'nombre') return '';
    const u = h.unite ? ` ${h.unite}` : '';
    if (h.min !== null && h.max !== null) return h.min === h.max ? `${nombreTexte(h.min)}${u} pile` : `${nombreTexte(h.min)} à ${nombreTexte(h.max)}${u}`;
    if (h.min !== null) return `au moins ${nombreTexte(h.min)}${u}`;
    if (h.max === 0) return 'aucun';
    return `au plus ${nombreTexte(h.max)}${u}`;
  }

  const themeDe = (etat, h) => etat.themes.find((t) => t.id === h.theme) || null;
  const estUnique = (etat, h) => themeDe(etat, h)?.mode === 'unique';
  const cleTheme = (idTheme) => `@${idTheme}`;

  // L'habitude est-elle attendue ce jour-là ? (jours prévus, depuis sa création, avant son archivage)
  const prevue = (h, d) => d >= h.depuis && (!h.archive || d < h.archive) && h.jours.includes(jourIndex(d));
  const active = (h, d) => d >= h.depuis && (!h.archive || d < h.archive);
  const habitudesDuJour = (etat, d) => etat.habitudes.filter((h) => active(h, d));

  // ---------- Valeurs ----------
  const entree = (etat, d, cle) => etat.journal[d]?.[cle];
  function valeur(etat, d, h) {
    if (estUnique(etat, h)) {
      const v = entree(etat, d, cleTheme(h.theme));
      if (v === undefined) return undefined;
      return v === NA ? NA : v === h.id;
    }
    return entree(etat, d, h.id);
  }

  function reussiValeur(h, v) {
    if (h.type === 'case') return v === true;
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    return (h.min === null || v >= h.min) && (h.max === null || v <= h.max);
  }

  // Statut d'une habitude un jour donné :
  // libre (pas prévue) · na · reussi · partiel (chiffre saisi mais objectif non atteint) · manque ·
  // attente (aujourd'hui, rien saisi) · futur. Thème « une seule par jour » : choisi · autre.
  function statut(etat, h, d, aujourdhui) {
    if (d > aujourdhui) return 'futur';
    const v = valeur(etat, d, h);
    if (!prevue(h, d)) {
      if (v === true || (typeof v === 'number' && reussiValeur(h, v))) return 'bonus';
      return 'libre';
    }
    if (v === NA) return 'na';
    if (estUnique(etat, h)) {
      if (v === true) return 'choisi';
      if (v === false) return 'autre';
      return d === aujourdhui ? 'attente' : 'manque';
    }
    if (reussiValeur(h, v)) return 'reussi';
    if (typeof v === 'number') return 'partiel';
    if (v === false) return 'manque';
    return d === aujourdhui ? 'attente' : 'manque';
  }

  const COMPTE = new Set(['reussi', 'partiel', 'manque']);

  // Enregistre une valeur (undefined ou null efface). Thème « une seule par jour » : `valeurVoulue`
  // true choisit cette habitude (et remplace l'ancien choix), 'na' marque tout le thème non applicable.
  function regler(etat, d, h, valeurVoulue) {
    const unique = estUnique(etat, h);
    const cle = unique ? cleTheme(h.theme) : h.id;
    let v = valeurVoulue;
    if (unique && v === true) v = h.id;
    else if (unique && v !== NA) v = undefined;
    if (!unique && h.type === 'nombre' && typeof v === 'number') v = arrondi(Math.max(0, v));
    if (!unique && h.type === 'case' && ![true, false, NA, undefined, null].includes(v)) v = undefined;
    if (v === undefined || v === null) {
      if (etat.journal[d]) { delete etat.journal[d][cle]; if (!Object.keys(etat.journal[d]).length) delete etat.journal[d]; }
      return;
    }
    etat.journal[d] = { ...(etat.journal[d] || {}), [cle]: v };
  }

  // Cochage rapide d'une case : rien → fait → pas fait → non applicable → rien.
  // Thème « une seule par jour » : rien ou autre choix → ce choix → non applicable → rien.
  function basculer(etat, d, h) {
    const v = valeur(etat, d, h);
    if (estUnique(etat, h)) {
      const suivant = v === true ? NA : v === NA ? undefined : true;
      regler(etat, d, h, suivant);
      return valeur(etat, d, h);
    }
    if (h.type === 'nombre') {
      const suivant = v === undefined ? (h.min ?? 0) : v === NA ? undefined : NA;
      regler(etat, d, h, suivant);
      return valeur(etat, d, h);
    }
    const suivant = v === undefined ? true : v === true ? false : v === false ? NA : undefined;
    regler(etat, d, h, suivant);
    return valeur(etat, d, h);
  }

  // Bouton + / − d'une habitude chiffrée : ajoute ou retire un pas, jamais sous 0.
  function ajuster(h, v, sens) {
    const base = typeof v === 'number' ? v : 0;
    return arrondi(Math.max(0, base + sens * (h.pas || 1)));
  }

  // ---------- Séries et taux ----------
  // Série en cours : jours réussis consécutifs jusqu'à aujourd'hui. Les jours non prévus et « non
  // applicables » ne cassent pas la série (ils ne comptent pas non plus) ; aujourd'hui, tant que rien
  // n'est saisi, ne casse pas la série. Thème « une seule par jour » : pas de série (null).
  function serie(etat, h, aujourdhui) {
    if (estUnique(etat, h)) return null;
    let n = 0;
    for (let d = aujourdhui; d >= h.depuis; d = ajout(d, -1)) {
      const s = statut(etat, h, d, aujourdhui);
      if (s === 'reussi') n++;
      else if (s === 'libre' || s === 'na' || s === 'attente' || s === 'bonus') continue;
      else break;
    }
    return n;
  }

  function meilleureSerie(etat, h, aujourdhui) {
    if (estUnique(etat, h)) return null;
    let n = 0, meilleure = 0;
    const fin = h.archive && h.archive <= aujourdhui ? ajout(h.archive, -1) : aujourdhui;
    for (let d = h.depuis; d <= fin; d = ajout(d, 1)) {
      const s = statut(etat, h, d, aujourdhui);
      if (s === 'reussi') { n++; meilleure = Math.max(meilleure, n); } else if (COMPTE.has(s)) n = 0;
    }
    return meilleure;
  }

  // Taux de réussite entre deux dates incluses : réussis ÷ jours comptés (réussi, partiel, manqué).
  function taux(etat, h, de, a, aujourdhui) {
    const r = { reussis: 0, partiels: 0, manques: 0, na: 0, comptes: 0, taux: null };
    if (estUnique(etat, h)) return r;
    const fin = a < aujourdhui ? a : aujourdhui;
    for (let d = de < h.depuis ? h.depuis : de; d <= fin; d = ajout(d, 1)) {
      const s = statut(etat, h, d, aujourdhui);
      if (s === 'reussi') r.reussis++;
      else if (s === 'partiel') r.partiels++;
      else if (s === 'manque') r.manques++;
      else if (s === 'na') r.na++;
    }
    r.comptes = r.reussis + r.partiels + r.manques;
    r.taux = r.comptes ? Math.round((r.reussis / r.comptes) * 100) : null;
    return r;
  }

  // Taux global (toutes habitudes indépendantes) sur une période.
  function tauxGlobal(etat, de, a, aujourdhui) {
    let reussis = 0, comptes = 0;
    for (const h of etat.habitudes) {
      if (estUnique(etat, h)) continue;
      const t = taux(etat, h, de, a, aujourdhui);
      reussis += t.reussis; comptes += t.comptes;
    }
    return { reussis, comptes, taux: comptes ? Math.round((reussis / comptes) * 100) : null };
  }

  // Tendance : taux global des n semaines (lundi → dimanche) qui finissent par celle de « lundi ».
  function tendance(etat, lundi, n, aujourdhui) {
    return Array.from({ length: n }, (_, i) => {
      const l = ajout(lundi, -7 * (n - 1 - i));
      return { lundi: l, ...tauxGlobal(etat, l, ajout(l, 6), aujourdhui) };
    });
  }

  // Avancement d'un jour : habitudes indépendantes prévues (hors non applicables) et réussies.
  function avancementJour(etat, d, aujourdhui) {
    let prevues = 0, faites = 0;
    for (const h of etat.habitudes) {
      if (estUnique(etat, h) || !prevue(h, d)) continue;
      const s = statut(etat, h, d, aujourdhui);
      if (s === 'na') continue;
      prevues++;
      if (s === 'reussi') faites++;
    }
    return { prevues, faites, parfait: prevues > 0 && faites === prevues };
  }

  // Jours parfaits (toutes les habitudes prévues réussies) entre deux dates incluses.
  function joursParfaits(etat, de, a, aujourdhui) {
    let n = 0;
    for (let d = de; d <= a && d <= aujourdhui; d = ajout(d, 1)) if (avancementJour(etat, d, aujourdhui).parfait) n++;
    return n;
  }

  // Thème « une seule par jour » : nombre de jours par choix sur une période.
  function repartition(etat, idTheme, de, a, aujourdhui) {
    const options = etat.habitudes.filter((h) => h.theme === idTheme);
    const res = { options: options.map((h) => ({ id: h.id, nom: h.nom, jours: 0 })), na: 0, vides: 0, total: 0 };
    const fin = a < aujourdhui ? a : aujourdhui;
    for (let d = de; d <= fin; d = ajout(d, 1)) {
      if (!options.some((h) => prevue(h, d))) continue;
      const v = entree(etat, d, cleTheme(idTheme));
      if (v === NA) res.na++;
      else if (v && res.options.find((o) => o.id === v)) { res.options.find((o) => o.id === v).jours++; res.total++; } else if (d < aujourdhui) res.vides++;
    }
    return res;
  }

  // ---------- Création depuis la base ----------
  // Ajoute les thèmes manquants (couleur préréglée si libre, sinon la première libre ; au-delà des
  // couleurs disponibles, les habitudes rejoignent le premier thème existant). Renvoie la table thème → id.
  function assurerThemes(etat, ids, presets, couleurs) {
    const table = {};
    for (const id of ids) {
      if (etat.themes.some((t) => t.id === id)) { table[id] = id; continue; }
      const p = presets.find((x) => x.id === id) || { id, nom: id, couleur: couleurs[0], mode: 'independant' };
      const prises = new Set(etat.themes.map((t) => t.couleur));
      const couleur = !prises.has(p.couleur) ? p.couleur : couleurs.find((c) => !prises.has(c));
      if (!couleur) { table[id] = etat.themes[0]?.id ?? id; continue; }
      etat.themes.push({ id: p.id, nom: p.nom, couleur, mode: p.mode || 'independant' });
      table[id] = p.id;
    }
    return table;
  }

  // Ajoute des habitudes de la base (ids) à l'état, depuis une date. Ignore celles déjà présentes.
  function ajouterDepuisBase(etat, ids, base, depuis) {
    const choisies = base.habitudes.filter((h) => ids.includes(h.id) && !etat.habitudes.some((x) => x.modele === h.id && !x.archive));
    const table = assurerThemes(etat, [...new Set(choisies.map((h) => h.theme))], base.themes, base.couleurs.map((c) => c.id));
    for (const m of choisies) {
      const h = normaliserHabitude({ ...m, id: nouvelId(), theme: table[m.theme], depuis }, depuis);
      h.modele = m.id;
      etat.habitudes.push(h);
    }
    return choisies.length;
  }

  // ---------- Export ----------
  const LIB = { reussi: 'réussi', partiel: 'partiel', manque: 'manqué', na: 'non applicable', choisi: 'choisi', autre: '', attente: 'en attente', libre: '', bonus: 'en plus', futur: '' };
  const champCsv = (x) => { const s = String(x ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function versCsv(etat, de, a, aujourdhui) {
    const lignes = [['date', 'theme', 'habitude', 'valeur', 'unite', 'statut']];
    for (let d = de; d <= a && d <= aujourdhui; d = ajout(d, 1)) {
      for (const h of habitudesDuJour(etat, d)) {
        const s = statut(etat, h, d, aujourdhui);
        if (s === 'libre' || s === 'autre' || s === 'futur') continue;
        const v = valeur(etat, d, h);
        const texte = v === NA ? 'na' : v === true ? 'oui' : v === false ? 'non' : typeof v === 'number' ? nombreTexte(v) : '';
        lignes.push([d, themeDe(etat, h)?.nom || '', h.nom, texte, h.unite, LIB[s]]);
      }
    }
    return lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  }

  // Normalise un état chargé (anciennes versions, champs manquants, valeurs invalides).
  function normaliserEtat(d, aujourdhui, couleurs = []) {
    const v = { version: 1, prenom: '', themes: [], habitudes: [], journal: {}, reglages: { debutSemaine: 0 } };
    if (!d || typeof d !== 'object') return v;
    const themes = (Array.isArray(d.themes) ? d.themes : []).filter((t) => t && t.id).map((t) => ({
      id: String(t.id), nom: String(t.nom || 'Thème').slice(0, 40),
      couleur: couleurs.length && !couleurs.includes(t.couleur) ? couleurs[0] : String(t.couleur || couleurs[0] || 'bleu'),
      mode: t.mode === 'unique' ? 'unique' : 'independant',
    }));
    const habitudes = (Array.isArray(d.habitudes) ? d.habitudes : []).filter((h) => h && typeof h === 'object').map((h) => ({ ...normaliserHabitude(h, aujourdhui), ...(h.modele ? { modele: String(h.modele) } : {}) }));
    const journal = {};
    if (d.journal && typeof d.journal === 'object') {
      for (const [date, jour] of Object.entries(d.journal)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !jour || typeof jour !== 'object') continue;
        const propre = {};
        for (const [cle, val] of Object.entries(jour)) {
          if (val === true || val === false || val === NA || (typeof val === 'number' && Number.isFinite(val) && val >= 0) || (cle.startsWith('@') && typeof val === 'string')) propre[cle] = val;
        }
        if (Object.keys(propre).length) journal[date] = propre;
      }
    }
    return { ...v, ...d, prenom: String(d.prenom || ''), themes, habitudes, journal, reglages: { ...v.reglages, ...(d.reglages || {}) } };
  }

  racine.HBT = {
    NA, TOUS,
    iso, versDate, ajout, ecart, jourIndex, lundiDe, premierDuMois, joursDuMois, moisSuivant, nouvelId,
    lireNombre, nombreTexte, estSante, normaliserHabitude, verifierHabitude, objectifTexte,
    themeDe, estUnique, cleTheme, prevue, active, habitudesDuJour,
    valeur, reussiValeur, statut, regler, basculer, ajuster,
    serie, meilleureSerie, taux, tauxGlobal, tendance, avancementJour, joursParfaits, repartition,
    assurerThemes, ajouterDepuisBase, versCsv, normaliserEtat,
  };
})(typeof window !== 'undefined' ? window : globalThis);
