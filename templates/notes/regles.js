// Notes et moyennes QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.NTS) et par les tests Node (outils/templates/notes.test.mjs).
//
// Modèle : années → périodes (semestres, trimestres) → unités d'enseignement (UE, facultatives) → matières → notes.
// Chaque note porte sa valeur, son barème (« sur ») et son coefficient dans la matière ; une note « prévue » n'a pas
// encore de valeur (épreuve à venir, utilisée par le simulateur). Les calculs se font sur la fraction de la note
// (valeur / sur, entre 0 et 1), puis s'affichent dans l'échelle de la période (sur 20, sur 10, sur 100, lettres).
// Seuil de validation, compensation, note éliminatoire, rattrapage et mentions sont des réglages saisis par
// l'utilisateur : aucune règle de diplôme n'est codée ici. Les moyennes sont comparées aux seuils une fois
// arrondies au centième. Tout ce qui dépend du jour présent reçoit `auj` en paramètre.
(function (g) {
  'use strict';

  // ---------- Dates et textes ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dateFr = (s) => { const d = versDate(s); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  const dateFrLongue = (s) => { const d = versDate(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
  // Nombre à la française : 1234,5 → « 1 234,5 » ; `fixe` garde les zéros (13,50).
  function nombreTexte(n, decimales = 0, fixe = false) {
    const v = Number(n) || 0;
    const f = Math.pow(10, decimales);
    const r = Math.round(Math.abs(v) * f) / f;
    const [e, d] = r.toFixed(decimales).split('.');
    const groupes = e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const dec = d ? (fixe ? d : d.replace(/0+$/, '')) : '';
    return `${v < 0 && r !== 0 ? '−' : ''}${groupes}${dec ? `,${dec}` : ''}`;
  }
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36).slice(-5)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const EPS = 1e-9;
  const arrondi = (v, d = 2) => Math.round(v * Math.pow(10, d) + EPS) / Math.pow(10, d);

  // ---------- Normalisation ----------
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const nb = (v, min, max, def = min) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const nbOuNul = (v, min, max) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.min(max, Math.max(min, Number(v))));
  const idOk = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());
  const CODES_SYS = ['sur20', 'sur10', 'sur100', 'lettres'];
  const MODES = ['totale', 'ue', 'aucune'];
  const TYPES = ['controle', 'cc', 'partiel', 'oral', 'tp', 'projet', 'concours', 'rattrapage', 'autre'];

  function normaliserReglages(r, base) {
    const lettres = (Array.isArray(r?.lettres) && r.lettres.length ? r.lettres : base?.lettres || [])
      .map((x) => ({ lettre: txt(x?.lettre, 3).toUpperCase(), points: nb(x?.points, 0, 100, 0) })).filter((x) => x.lettre);
    const vues = new Set();
    const lettresUniques = lettres.filter((x) => (vues.has(x.lettre) ? false : vues.add(x.lettre))).sort((a, b) => b.points - a.points).slice(0, 20);
    const mentions = (Array.isArray(r?.mentions) ? r.mentions : base?.mentions || [])
      .map((x) => ({ nom: txt(x?.nom, 40), seuil: nb(x?.seuil, 0, 20, 0) })).filter((x) => x.nom).sort((a, b) => a.seuil - b.seuil).slice(0, 8);
    const identite = { nom: txt(r?.identite?.nom, 80), formation: txt(r?.identite?.formation, 100), etablissement: txt(r?.identite?.etablissement, 100) };
    return { lettres: lettresUniques, mentions, identite };
  }
  function normaliserAnnee(a, i = 0) {
    return { id: idOk(a?.id), nom: txt(a?.nom, 60) || 'Année', ordre: Number.isFinite(Number(a?.ordre)) ? Number(a.ordre) : i, compensation: a?.compensation === 'periodes' ? 'periodes' : 'aucune' };
  }
  function normaliserPeriode(p, base, i = 0) {
    const systeme = CODES_SYS.includes(p?.systeme) ? p.systeme : 'sur20';
    const s = (base?.systemes || []).find((x) => x.code === systeme) || { max: 20, seuil: 10, objectif: 12 };
    const max = systeme === 'lettres' ? 100 : s.max;
    return {
      id: idOk(p?.id), annee: txt(p?.annee, 40), nom: txt(p?.nom, 60) || 'Période', ordre: Number.isFinite(Number(p?.ordre)) ? Number(p.ordre) : i,
      systeme, poids: p?.poids === 'credits' ? 'credits' : 'coef', mode: MODES.includes(p?.mode) ? p.mode : 'totale',
      seuil: nb(p?.seuil, 0, max, s.seuil), objectif: nbOuNul(p?.objectif, 0, max) ?? s.objectif,
      eliminatoire: nbOuNul(p?.eliminatoire, 0, max), rattrapage: p?.rattrapage === 'meilleure' ? 'meilleure' : 'remplace',
    };
  }
  function normaliserUe(u, i = 0) {
    return { id: idOk(u?.id), periode: txt(u?.periode, 40), nom: txt(u?.nom, 80) || 'UE', coef: nb(u?.coef, 0, 100, 0), credits: nb(u?.credits, 0, 120, 0), ordre: Number.isFinite(Number(u?.ordre)) ? Number(u.ordre) : i };
  }
  function normaliserMatiere(m, i = 0) {
    return {
      id: idOk(m?.id), periode: txt(m?.periode, 40), ue: txt(m?.ue, 40), nom: txt(m?.nom, 80) || 'Matière',
      coef: nb(m?.coef, 0, 100, 1), credits: nb(m?.credits, 0, 60, 0), ordre: Number.isFinite(Number(m?.ordre)) ? Number(m.ordre) : i,
      couleur: Math.round(nb(m?.couleur, 0, 7, i % 8)),
    };
  }
  function normaliserNote(n) {
    const o = {
      id: idOk(n?.id), matiere: txt(n?.matiere, 40), date: estDate(n?.date) ? n.date : '', intitule: txt(n?.intitule, 80),
      type: TYPES.includes(n?.type) ? n.type : 'controle', coef: nb(n?.coef, 0, 100, 1), sur: nb(n?.sur, 1, 1000, 20),
      prevue: !!n?.prevue,
    };
    if (!o.prevue) {
      const l = txt(n?.lettre, 3).toUpperCase();
      if (l) o.lettre = l;
      else { const v = nbOuNul(n?.valeur, 0, o.sur); if (v === null) o.prevue = true; else o.valeur = v; }
    }
    if (n?.neutre) o.neutre = true; // absence justifiée, note neutralisée : gardée mais hors moyenne
    return o;
  }
  const etatVide = (base) => ({ version: 1, reglages: normaliserReglages({}, base), annees: [], periodes: [], ues: [], matieres: [], notes: [] });
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const annees = (Array.isArray(d.annees) ? d.annees : []).map(normaliserAnnee);
    const idsA = new Set(annees.map((a) => a.id));
    const periodes = (Array.isArray(d.periodes) ? d.periodes : []).map((p, i) => normaliserPeriode(p, base, i)).filter((p) => idsA.has(p.annee));
    const idsP = new Set(periodes.map((p) => p.id));
    const ues = (Array.isArray(d.ues) ? d.ues : []).map(normaliserUe).filter((u) => idsP.has(u.periode));
    const ueParId = new Map(ues.map((u) => [u.id, u]));
    const matieres = (Array.isArray(d.matieres) ? d.matieres : []).map(normaliserMatiere).filter((m) => idsP.has(m.periode))
      .map((m) => (m.ue && ueParId.get(m.ue)?.periode !== m.periode ? { ...m, ue: '' } : m));
    const idsM = new Set(matieres.map((m) => m.id));
    const notes = (Array.isArray(d.notes) ? d.notes : []).map(normaliserNote).filter((n) => idsM.has(n.matiere));
    return { ...v, ...d, reglages: normaliserReglages(d.reglages || {}, base), annees, periodes, ues, matieres, notes };
  }
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  // ---------- Accès ----------
  const trier = (l) => l.slice().sort((a, b) => a.ordre - b.ordre);
  const anneesTriees = (e) => trier(e.annees);
  const periodesDe = (e, anneeId) => trier(e.periodes.filter((p) => p.annee === anneeId));
  const periodesTriees = (e) => anneesTriees(e).flatMap((a) => periodesDe(e, a.id));
  const uesDe = (e, pid) => trier(e.ues.filter((u) => u.periode === pid));
  const matieresDe = (e, pid) => trier(e.matieres.filter((m) => m.periode === pid));
  const matieresUe = (e, ueId) => trier(e.matieres.filter((m) => m.ue === ueId));
  const matieresLibres = (e, pid) => { const ids = new Set(uesDe(e, pid).map((u) => u.id)); return matieresDe(e, pid).filter((m) => !m.ue || !ids.has(m.ue)); };
  const notesDe = (e, mid) => e.notes.filter((n) => n.matiere === mid).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const periodeDe = (e, m) => e.periodes.find((p) => p.id === m.periode);

  // ---------- Systèmes de notation ----------
  // Pour le système « Lettres », la note maximale est le plus grand nombre de points de la table.
  function systeme(e, p, base) {
    const s = (base?.systemes || []).find((x) => x.code === p?.systeme) || { code: 'sur20', nom: 'Sur 20', max: 20 };
    if (s.code !== 'lettres') return { ...s };
    const max = Math.max(0, ...e.reglages.lettres.map((l) => l.points)) || 4;
    return { ...s, max, lettres: e.reglages.lettres };
  }
  // Lettre correspondant à des points : la plus haute dont les points sont atteints.
  function lettreDe(points, lettres) {
    const l = lettres.slice().sort((a, b) => b.points - a.points).find((x) => points + EPS >= x.points);
    return l ? l.lettre : (lettres.at(-1)?.lettre || '');
  }
  // Valeur affichée d'une fraction dans une échelle, arrondie au centième.
  const valeur = (frac, sys) => (frac === null || frac === undefined ? null : arrondi(frac * sys.max));
  function noteTexte(frac, sys, decimales = 2) {
    if (frac === null || frac === undefined) return '–';
    const v = valeur(frac, sys);
    if (sys.code === 'lettres') return `${nombreTexte(v, decimales, true)} (${lettreDe(v, sys.lettres)})`;
    return nombreTexte(v, decimales, true);
  }
  // Lecture d'une note saisie : « 14,5 », « 14.5/20 », « 7/10 », « 85 % », ou une lettre de la table.
  function lireNote(texte, sys, surDefaut) {
    const s = String(texte ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if (!s) return { vide: true };
    if (sys.code === 'lettres' && /^[a-z][+-]?$/i.test(s)) {
      const l = sys.lettres.find((x) => x.lettre === s.toUpperCase());
      return l ? { lettre: l.lettre } : { erreur: `La lettre « ${s.toUpperCase()} » n'est pas dans ta table (Réglages).` };
    }
    const m = s.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?)|(%))?$/);
    if (!m) return { erreur: sys.code === 'lettres' ? 'Écris une lettre de ta table ou une note, par exemple 14/20.' : 'Écris une note, par exemple 14,5 ou 7/10.' };
    const sur = m[3] ? 100 : m[2] ? Number(m[2]) : Number(surDefaut) || sys.max;
    const v = Number(m[1]);
    if (!(sur > 0)) return { erreur: 'Le barème doit être supérieur à 0.' };
    if (v > sur) return { erreur: `La note dépasse le barème (${nombreTexte(v, 2)} sur ${nombreTexte(sur, 2)}).` };
    return { valeur: v, sur };
  }

  // ---------- Moyennes ----------
  // ctx : { surcharge: Map(id de note → fraction), jusqua: date } — la surcharge donne une valeur à une note prévue
  // (simulateur), `jusqua` ignore les notes postérieures (évolution).
  function fracNote(e, n, ctx = {}) {
    if (ctx.surcharge && ctx.surcharge.has(n.id)) return ctx.surcharge.get(n.id);
    if (n.prevue || n.neutre) return null;
    if (ctx.jusqua && (!n.date || n.date > ctx.jusqua)) return null;
    if (n.lettre) {
      const l = e.reglages.lettres.find((x) => x.lettre === n.lettre);
      const max = Math.max(0, ...e.reglages.lettres.map((x) => x.points));
      return l && max ? l.points / max : null;
    }
    return n.valeur === undefined ? null : Math.min(1, Math.max(0, n.valeur / n.sur));
  }
  // Moyenne pondérée de [fraction, poids] ; si tous les poids sont nuls, moyenne simple. Null sans valeur.
  function moyennePonderee(paires) {
    const l = paires.filter(([f]) => f !== null && f !== undefined);
    if (!l.length) return null;
    const total = l.reduce((t, [, w]) => t + w, 0);
    if (total <= 0) return l.reduce((t, [f]) => t + f, 0) / l.length;
    const parts = l.filter(([, w]) => w > 0);
    return parts.reduce((t, [f, w]) => t + f * w, 0) / total;
  }
  // Moyenne d'une matière : notes pondérées par leur coefficient. Les notes de rattrapage forment une seconde
  // moyenne qui remplace la première, ou ne compte que si elle est meilleure, selon le réglage de la période.
  function moyenneMatiere(e, m, ctx = {}) {
    const ns = e.notes.filter((n) => n.matiere === m.id);
    const p = periodeDe(e, m);
    const init = moyennePonderee(ns.filter((n) => n.type !== 'rattrapage').map((n) => [fracNote(e, n, ctx), n.coef]));
    const ratt = moyennePonderee(ns.filter((n) => n.type === 'rattrapage').map((n) => [fracNote(e, n, ctx), n.coef]));
    if (ratt === null) return init;
    return p?.rattrapage === 'meilleure' ? Math.max(init ?? 0, ratt) : ratt;
  }
  const poidsMatiere = (p, m) => (p.poids === 'credits' ? m.credits : m.coef);
  function poidsUe(e, p, u) {
    const mats = matieresUe(e, u.id);
    return p.poids === 'credits' ? (u.credits || mats.reduce((t, m) => t + m.credits, 0)) : (u.coef || mats.reduce((t, m) => t + m.coef, 0));
  }
  function moyenneUe(e, u, ctx = {}) {
    const p = e.periodes.find((x) => x.id === u.periode);
    return moyennePonderee(matieresUe(e, u.id).map((m) => [moyenneMatiere(e, m, ctx), poidsMatiere(p, m)]));
  }
  // Moyenne d'une période : ses UE (pondérées par leur coefficient ou leurs crédits, ou à défaut la somme de ceux
  // de leurs matières) et ses matières hors UE.
  function moyennePeriode(e, p, ctx = {}) {
    const paires = uesDe(e, p.id).map((u) => [moyenneUe(e, u, ctx), poidsUe(e, p, u)])
      .concat(matieresLibres(e, p.id).map((m) => [moyenneMatiere(e, m, ctx), poidsMatiere(p, m)]));
    return moyennePonderee(paires);
  }
  const creditsUe = (e, u) => u.credits || matieresUe(e, u.id).reduce((t, m) => t + m.credits, 0);
  const creditsPeriode = (e, p) => uesDe(e, p.id).reduce((t, u) => t + creditsUe(e, u), 0) + matieresLibres(e, p.id).reduce((t, m) => t + m.credits, 0);
  // Moyenne d'une année : ses périodes pondérées par leurs crédits si toutes en ont, sinon à parts égales.
  function moyenneAnnee(e, a, ctx = {}) {
    const ps = periodesDe(e, a.id);
    const avecCredits = ps.length && ps.every((p) => creditsPeriode(e, p) > 0);
    return moyennePonderee(ps.map((p) => [moyennePeriode(e, p, ctx), avecCredits ? creditsPeriode(e, p) : 1]));
  }

  // ---------- Validation, crédits, mentions ----------
  const atteint = (frac, seuil, sys) => frac !== null && valeur(frac, sys) + EPS >= seuil;
  function mention(e, frac) {
    if (frac === null || frac === undefined) return null;
    const v20 = arrondi(frac * 20);
    return e.reglages.mentions.filter((m) => v20 + EPS >= m.seuil).at(-1)?.nom || null;
  }
  // Bilan d'une période selon ses règles saisies : statut de chaque matière (acquise, compensée, non acquise, en
  // attente de notes), de chaque UE et de la période, crédits acquis (une UE ou une période validée donne tous
  // ses crédits ; sinon les matières au-dessus du seuil gardent les leurs), notes éliminatoires, mention.
  function bilanPeriode(e, p, base, ctx = {}) {
    const sys = systeme(e, p, base);
    const s = p.seuil;
    const elim = (f) => p.eliminatoire !== null && f !== null && valeur(f, sys) + EPS < p.eliminatoire;
    const mat = (m) => { const moy = moyenneMatiere(e, m, ctx); return { m, moy, ok: atteint(moy, s, sys), eliminatoire: elim(moy), credits: m.credits, prevues: e.notes.filter((n) => n.matiere === m.id && n.prevue).length }; };
    const ues = uesDe(e, p.id).map((u) => {
      const ms = matieresUe(e, u.id).map(mat);
      const moy = moyenneUe(e, u, ctx);
      const ok = p.mode === 'aucune' ? ms.length > 0 && ms.every((x) => x.ok) : atteint(moy, s, sys) && !ms.some((x) => x.eliminatoire);
      return { u, moy, ok, matieres: ms, credits: creditsUe(e, u) };
    });
    const libres = matieresLibres(e, p.id).map(mat);
    const toutes = ues.flatMap((x) => x.matieres).concat(libres);
    const moy = moyennePeriode(e, p, ctx);
    const aucuneElim = !toutes.some((x) => x.eliminatoire);
    let ok;
    if (p.mode === 'aucune') ok = toutes.length > 0 && toutes.every((x) => x.ok);
    else if (p.mode === 'ue') ok = (ues.length + libres.length) > 0 && ues.every((x) => x.ok) && libres.every((x) => x.ok);
    else ok = atteint(moy, s, sys) && aucuneElim;
    const complet = toutes.length > 0 && toutes.every((x) => x.moy !== null && !x.prevues);
    return finaliserPeriode({ p, sys, moy, ok, complet, ues, libres, aucuneElim, creditsTotal: creditsPeriode(e, p), mention: ok ? mention(e, moy) : null }, false);
  }
  // Statuts et crédits, avec `force` quand la période est validée par compensation annuelle.
  function finaliserPeriode(b, force) {
    const ok = b.ok || force;
    const statutMat = (x, parent) => (x.ok ? 'acquise' : (parent && x.moy !== null) ? 'compensee' : x.moy === null ? 'attente' : 'non');
    for (const u of b.ues) {
      u.statut = u.ok ? 'acquise' : (ok && u.moy !== null) ? 'compensee' : u.moy === null ? 'attente' : 'non';
      for (const x of u.matieres) x.statut = statutMat(x, u.statut === 'acquise' || u.statut === 'compensee');
      u.acquis = u.statut === 'acquise' || u.statut === 'compensee' ? u.credits : u.matieres.filter((x) => x.ok).reduce((t, x) => t + x.credits, 0);
    }
    for (const x of b.libres) x.statut = statutMat(x, ok && (b.p.mode === 'totale' || force));
    const acquisLibres = b.libres.filter((x) => x.statut === 'acquise' || x.statut === 'compensee').reduce((t, x) => t + x.credits, 0);
    const creditsAcquis = ok ? b.creditsTotal : b.ues.reduce((t, u) => t + u.acquis, 0) + acquisLibres;
    const statut = ok ? (b.ok ? 'validee' : 'compensee') : b.moy === null ? 'attente' : 'non';
    return { ...b, statut, creditsAcquis, provisoire: !b.complet };
  }
  // Bilan d'une année : moyenne, bilans des périodes, compensation entre périodes si elle est activée (moyenne de
  // l'année au seuil de la première période, sans note éliminatoire, toutes les périodes notées).
  function bilanAnnee(e, a, base, ctx = {}) {
    let periodes = periodesDe(e, a.id).map((p) => bilanPeriode(e, p, base, ctx));
    const moy = moyenneAnnee(e, a, ctx);
    const p0 = periodes[0];
    let compensee = false;
    if (a.compensation === 'periodes' && p0 && periodes.every((b) => b.moy !== null && b.aucuneElim) && atteint(moy, p0.p.seuil, p0.sys) && periodes.some((b) => !b.ok)) {
      compensee = true;
      periodes = periodes.map((b) => (b.ok ? b : finaliserPeriode(b, true)));
    }
    const ok = periodes.length > 0 && periodes.every((b) => b.statut === 'validee' || b.statut === 'compensee');
    const creditsTotal = periodes.reduce((t, b) => t + b.creditsTotal, 0);
    return {
      a, moy, sys: p0?.sys || { code: 'sur20', max: 20 }, periodes, compensee, ok, statut: ok ? 'validee' : moy === null ? 'attente' : 'non',
      creditsTotal, creditsAcquis: periodes.reduce((t, b) => t + b.creditsAcquis, 0), mention: ok ? mention(e, moy) : null,
      provisoire: periodes.some((b) => b.provisoire),
    };
  }

  // ---------- Simulateur ----------
  // Cible : { type: 'matiere' | 'ue' | 'periode' | 'annee', id }.
  function moyenneCible(e, cible, ctx = {}) {
    const trouve = (l) => l.find((x) => x.id === cible.id);
    if (cible.type === 'matiere') { const m = trouve(e.matieres); return m ? moyenneMatiere(e, m, ctx) : null; }
    if (cible.type === 'ue') { const u = trouve(e.ues); return u ? moyenneUe(e, u, ctx) : null; }
    if (cible.type === 'periode') { const p = trouve(e.periodes); return p ? moyennePeriode(e, p, ctx) : null; }
    const a = trouve(e.annees); return a ? moyenneAnnee(e, a, ctx) : null;
  }
  // Périodes concernées par une cible (pour l'échelle et les notes prévues).
  function periodesCible(e, cible) {
    if (cible.type === 'annee') return periodesDe(e, cible.id);
    if (cible.type === 'periode') return e.periodes.filter((p) => p.id === cible.id);
    if (cible.type === 'ue') { const u = e.ues.find((x) => x.id === cible.id); return e.periodes.filter((p) => p.id === u?.periode); }
    const m = e.matieres.find((x) => x.id === cible.id); return e.periodes.filter((p) => p.id === m?.periode);
  }
  // Notes prévues qui comptent dans une cible.
  function prevuesCible(e, cible) {
    let mats;
    if (cible.type === 'matiere') mats = e.matieres.filter((m) => m.id === cible.id);
    else if (cible.type === 'ue') mats = matieresUe(e, cible.id);
    else { const ids = new Set(periodesCible(e, cible).map((p) => p.id)); mats = e.matieres.filter((m) => ids.has(m.periode)); }
    const ids = new Set(mats.map((m) => m.id));
    return e.notes.filter((n) => n.prevue && ids.has(n.matiere)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }
  // Moyenne de la cible si toutes les notes `ids` valent la fraction x.
  const simuler = (e, cible, ids, x) => moyenneCible(e, cible, { surcharge: new Map(ids.map((id) => [id, x])) });
  // Note nécessaire, la même à chaque épreuve `ids`, pour que la cible atteigne `objectif` (dans l'échelle `sys`).
  // La moyenne croît avec x : on cherche la plus petite fraction qui suffit, par dichotomie (exacte même avec un
  // rattrapage « meilleure note »). Statuts : « acquis » (même 0 suffit), « impossible » (même la note maximale ne
  // suffit pas : `max` donne la meilleure moyenne possible), « possible » (`frac`), « aucune » (pas d'épreuve).
  function noteNecessaire(e, cible, ids, objectif, sys) {
    if (!ids.length) return { statut: 'aucune' };
    const T = objectif / sys.max;
    const bas = simuler(e, cible, ids, 0), haut = simuler(e, cible, ids, 1);
    if (haut === null) return { statut: 'aucune' };
    if (bas + EPS >= T) return { statut: 'acquis', frac: 0, min: bas, max: haut };
    if (haut + EPS < T) return { statut: 'impossible', min: bas, max: haut };
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (simuler(e, cible, ids, mid) + EPS >= T) hi = mid; else lo = mid; }
    return { statut: 'possible', frac: hi, min: bas, max: haut };
  }
  // Note à viser, sur le barème d'une épreuve, arrondie au centième supérieur.
  const noteAViser = (frac, sur) => Math.ceil(frac * sur * 100 - 1e-6) / 100;

  // ---------- Évolution ----------
  // Moyenne de la cible après chaque date où une note a été obtenue.
  function evolution(e, cible) {
    const ps = new Set(periodesCible(e, cible).map((p) => p.id));
    const mats = new Set((cible.type === 'matiere' ? e.matieres.filter((m) => m.id === cible.id) : cible.type === 'ue' ? matieresUe(e, cible.id) : e.matieres.filter((m) => ps.has(m.periode))).map((m) => m.id));
    const notes = e.notes.filter((n) => mats.has(n.matiere) && !n.prevue && !n.neutre && n.date);
    const dates = [...new Set(notes.map((n) => n.date))].sort();
    return dates.map((d) => ({ date: d, moy: moyenneCible(e, cible, { jusqua: d }), notes: notes.filter((n) => n.date === d) })).filter((x) => x.moy !== null);
  }
  // Épreuves prévues à partir d'aujourd'hui (et celles sans date), toutes périodes.
  const aVenir = (e, auj) => e.notes.filter((n) => n.prevue && (!n.date || n.date >= auj)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  // Période « du moment » : celle qui a une épreuve à venir la plus proche, sinon la dernière notée, sinon la dernière.
  function periodeCourante(e, auj) {
    const ps = periodesTriees(e);
    if (!ps.length) return null;
    const prochaine = aVenir(e, auj).find((n) => n.date);
    if (prochaine) return e.matieres.find((m) => m.id === prochaine.matiere)?.periode || ps.at(-1).id;
    const notees = ps.filter((p) => e.notes.some((n) => !n.prevue && e.matieres.find((m) => m.id === n.matiere)?.periode === p.id));
    return (notees.at(-1) || ps.at(-1)).id;
  }

  // ---------- Modifications de structure ----------
  function supprimerMatiere(e, id) { return { ...e, matieres: e.matieres.filter((m) => m.id !== id), notes: e.notes.filter((n) => n.matiere !== id) }; }
  function supprimerUe(e, id) { return { ...e, ues: e.ues.filter((u) => u.id !== id), matieres: e.matieres.map((m) => (m.ue === id ? { ...m, ue: '' } : m)) }; }
  function supprimerPeriode(e, id) {
    const mats = new Set(e.matieres.filter((m) => m.periode === id).map((m) => m.id));
    return { ...e, periodes: e.periodes.filter((p) => p.id !== id), ues: e.ues.filter((u) => u.periode !== id), matieres: e.matieres.filter((m) => !mats.has(m.id)), notes: e.notes.filter((n) => !mats.has(n.matiere)) };
  }
  function supprimerAnnee(e, id) { let x = e; for (const p of e.periodes.filter((q) => q.annee === id)) x = supprimerPeriode(x, p.id); return { ...x, annees: x.annees.filter((a) => a.id !== id) }; }
  // Copie la structure d'une période (UE et matières, sans les notes) dans une autre, par exemple d'un semestre
  // au même semestre de l'année suivante.
  function copierStructure(e, source, cible) {
    const mapUe = new Map();
    const ues = uesDe(e, source).map((u) => { const n = { ...u, id: nouvelId(), periode: cible }; mapUe.set(u.id, n.id); return n; });
    const mats = matieresDe(e, source).map((m) => ({ ...m, id: nouvelId(), periode: cible, ue: m.ue ? mapUe.get(m.ue) || '' : '' }));
    return { ...e, ues: e.ues.concat(ues), matieres: e.matieres.concat(mats) };
  }

  // ---------- Export CSV ----------
  function champCsv(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  const csvNombre = (v) => (v === null || v === undefined || v === '' ? '' : String(arrondi(v)).replace('.', ','));
  function csvNotes(e, base, NOMS_TYPES = {}) {
    const tete = ['Année', 'Période', 'UE', 'Matière', 'Date', 'Épreuve', 'Type', 'Note', 'Sur', 'Coefficient', 'Note dans l\'échelle', 'Statut'];
    const lignes = [];
    for (const a of anneesTriees(e)) for (const p of periodesDe(e, a.id)) {
      const sys = systeme(e, p, base);
      for (const m of matieresDe(e, p.id)) for (const n of notesDe(e, m.id)) {
        const u = e.ues.find((x) => x.id === m.ue);
        const f = fracNote(e, n);
        lignes.push([a.nom, p.nom, u?.nom || '', m.nom, n.date, n.intitule, NOMS_TYPES[n.type] || n.type, n.lettre || csvNombre(n.valeur), n.lettre ? '' : csvNombre(n.sur), csvNombre(n.coef), f === null ? '' : csvNombre(f * sys.max), n.prevue ? 'prévue' : n.neutre ? 'neutralisée' : '']);
      }
    }
    return versCsv([tete, ...lignes]);
  }
  const STATUTS = { acquise: 'Acquise', compensee: 'Compensée', non: 'Non acquise', attente: 'En attente', validee: 'Validée' };
  function csvReleve(e, base) {
    const tete = ['Année', 'Période', 'UE', 'Matière', 'Coefficient', 'Crédits', 'Moyenne', 'Statut', 'Crédits acquis'];
    const lignes = [];
    for (const a of anneesTriees(e)) {
      const b = bilanAnnee(e, a, base);
      for (const bp of b.periodes) {
        const v = (f) => (f === null ? '' : csvNombre(f * bp.sys.max));
        for (const u of bp.ues) {
          for (const x of u.matieres) lignes.push([a.nom, bp.p.nom, u.u.nom, x.m.nom, csvNombre(x.m.coef), csvNombre(x.m.credits), v(x.moy), STATUTS[x.statut], '']);
          lignes.push([a.nom, bp.p.nom, u.u.nom, '(moyenne de l\'UE)', csvNombre(u.u.coef), csvNombre(u.credits), v(u.moy), STATUTS[u.statut], csvNombre(u.acquis)]);
        }
        for (const x of bp.libres) lignes.push([a.nom, bp.p.nom, '', x.m.nom, csvNombre(x.m.coef), csvNombre(x.m.credits), v(x.moy), STATUTS[x.statut], x.statut === 'acquise' || x.statut === 'compensee' ? csvNombre(x.credits) : '0']);
        lignes.push([a.nom, bp.p.nom, '', '(moyenne de la période)', '', csvNombre(bp.creditsTotal), v(bp.moy), STATUTS[bp.statut] || 'Non validée', csvNombre(bp.creditsAcquis)]);
      }
      lignes.push([a.nom, '(moyenne de l\'année)', '', '', '', csvNombre(b.creditsTotal), b.moy === null ? '' : csvNombre(b.moy * b.sys.max), b.ok ? 'Validée' : 'Non validée', csvNombre(b.creditsAcquis)]);
    }
    return versCsv([tete, ...lignes]);
  }

  g.NTS = {
    deux, iso, versDate, ajout, ecart, estDate, MOIS, JOURS, dateFr, dateFrLongue, nombreTexte, plat, nouvelId, arrondi,
    normaliserReglages, normaliserAnnee, normaliserPeriode, normaliserUe, normaliserMatiere, normaliserNote, etatVide, normaliser, taille,
    anneesTriees, periodesDe, periodesTriees, uesDe, matieresDe, matieresUe, matieresLibres, notesDe, periodeDe,
    systeme, lettreDe, valeur, noteTexte, lireNote,
    fracNote, moyennePonderee, moyenneMatiere, poidsMatiere, poidsUe, moyenneUe, moyennePeriode, creditsUe, creditsPeriode, moyenneAnnee,
    atteint, mention, bilanPeriode, bilanAnnee, STATUTS,
    moyenneCible, periodesCible, prevuesCible, simuler, noteNecessaire, noteAViser, evolution, aVenir, periodeCourante,
    supprimerMatiere, supprimerUe, supprimerPeriode, supprimerAnnee, copierStructure,
    champCsv, versCsv, csvNotes, csvReleve,
  };
})(typeof window !== 'undefined' ? window : globalThis);
