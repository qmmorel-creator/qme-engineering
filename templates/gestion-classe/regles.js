// Gestion de classe QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.CSE) et par les tests Node (outils/templates/gestion-classe.test.mjs).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; les fonctions qui dépendent du jour
// reçoivent la date de référence `auj`.
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // ---------- Nombres et textes ----------
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // « 12,5 » → 12.5 ; null si vide ou illisible (jamais négatif, deux décimales au plus).
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Number(s);
  }
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Année scolaire et périodes ----------
  // Année scolaire qui contient `auj` : elle commence le 1er septembre (août compte pour la suivante).
  function anneeScolaire(auj) {
    const a = Number(auj.slice(0, 4)), m = Number(auj.slice(5, 7));
    const debut = m >= 8 ? a : a - 1;
    return { nom: `${debut}-${debut + 1}`, debut: `${debut}-09-01` };
  }
  // Périodes proposées d'un découpage (trimestres ou semestres), dates de fin à ajuster.
  function periodesParDefaut(base, code, debut) {
    const d = base.decoupages.find((x) => x.code === code) || base.decoupages[0];
    const an = Number(debut.slice(0, 4));
    return d.periodes.map(([nom, mj]) => ({ id: nouvelId(), nom, fin: `${Number(mj.slice(0, 2)) >= 8 ? an : an + 1}-${mj}` }));
  }
  // Périodes triées avec leur début : le lendemain de la fin précédente (la première : début de l'année).
  function bornes(annee) {
    const ps = [...(annee?.periodes || [])].filter((p) => estDate(p.fin)).sort((a, b) => a.fin.localeCompare(b.fin));
    return ps.map((p, i) => ({ ...p, debut: i ? ajout(ps[i - 1].fin, 1) : annee.debut }));
  }
  // Période d'une date ; avant la première : la première ; après la dernière : la dernière.
  function periodeDe(annee, date) {
    const b = bornes(annee);
    if (!b.length) return null;
    return b.find((p) => date <= p.fin) || b[b.length - 1];
  }

  // ---------- Notes ----------
  const SPECIALES = ['ABS', 'NN', 'DISP'];
  const estSpeciale = (v) => SPECIALES.includes(v);
  const estNote = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  // Saisie rapide d'une note : « 15,5 », « abs » ou « a », « nn » ou « n », « disp » ou « d ».
  // Retourne { vide } | { valeur } | { erreur }.
  function lireNote(saisie, bareme, base) {
    const s = plat(saisie).replace(/[\s.]+$/g, '').trim();
    if (!s) return { vide: true };
    const sp = (base?.speciales || []).find((x) => x.saisie.includes(s) || plat(x.code) === s);
    if (sp) return { valeur: sp.code };
    const n = lireNombre(s);
    if (n === null) return { erreur: 'Note illisible : un nombre (ex. 14,5), ou a, n, d.' };
    if (bareme > 0 && n > bareme) return { erreur: `Au-dessus du barème (sur ${bareme}).` };
    return { valeur: n };
  }
  const sur20 = (v, bareme) => (estNote(v) && bareme > 0 ? (v / bareme) * 20 : null);
  // Moyenne pondérée de { s20, coef } ; null sans coefficient.
  function moyennePonderee(items) {
    const c = items.reduce((s, x) => s + x.coef, 0);
    return c > 0 ? items.reduce((s, x) => s + x.s20 * x.coef, 0) / c : null;
  }
  // Moyenne d'un élève sur des évaluations. Les notes spéciales ne comptent pas. Une évaluation « bonus »
  // ne compte que si elle fait monter la moyenne (examinées dans l'ordre des dates).
  function moyenneEleve(evals, eleveId) {
    const items = [];
    for (const e of evals) {
      const s = sur20(e.notes?.[eleveId], e.bareme);
      if (s !== null && e.coef > 0) items.push({ s20: s, coef: e.coef, bonus: !!e.bonus, date: e.date, id: e.id });
    }
    const retenus = items.filter((x) => !x.bonus);
    let m = moyennePonderee(retenus);
    const bonusRetenus = [];
    if (m !== null) {
      for (const b of items.filter((x) => x.bonus).sort((a, c) => a.date.localeCompare(c.date))) {
        const m2 = moyennePonderee([...retenus, b]);
        if (m2 > m) { retenus.push(b); m = m2; bonusRetenus.push(b.id); }
      }
    }
    return { moyenne: m, nb: retenus.length, bonusRetenus };
  }
  // Statistiques d'une liste de valeurs (moyennes ou notes sur 20).
  function stats(valeurs) {
    const v = valeurs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return { n: 0, moyenne: null, min: null, max: null, mediane: null };
    const mi = Math.floor(v.length / 2);
    return { n: v.length, moyenne: v.reduce((s, x) => s + x, 0) / v.length, min: v[0], max: v[v.length - 1], mediane: v.length % 2 ? v[mi] : (v[mi - 1] + v[mi]) / 2 };
  }
  // Répartition en tranches de notes sur 20 (bornes basses incluses, 20 dans la dernière).
  const TRANCHES = [[0, 8, 'moins de 8'], [8, 10, '8 à 10'], [10, 12, '10 à 12'], [12, 14, '12 à 14'], [14, 16, '14 à 16'], [16, 20, '16 et plus']];
  function repartition(valeurs) {
    return TRANCHES.map(([de, a, nom], i) => ({ de, a, nom, n: valeurs.filter((x) => typeof x === 'number' && x >= de && (i === TRANCHES.length - 1 ? x <= 20 : x < a)).length }));
  }

  // ---------- Accès à l'état ----------
  const elevesDe = (etat, classeId, tous = false) => etat.eleves.filter((e) => e.classeId === classeId && (tous || e.actif !== false)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const evalsDe = (etat, classeId) => etat.evaluations.filter((e) => e.classeId === classeId).sort((a, b) => a.date.localeCompare(b.date) || a.titre.localeCompare(b.titre));
  // Évaluations d'une classe dans une période (selon leur date).
  function evalsPeriode(etat, classeId, annee, periodeId) {
    return evalsDe(etat, classeId).filter((e) => periodeDe(annee, e.date)?.id === periodeId);
  }
  // Moyennes de la classe sur une période : { [eleveId]: moyenne|null } et statistiques.
  function moyennesPeriode(etat, classeId, annee, periodeId) {
    const evs = evalsPeriode(etat, classeId, annee, periodeId);
    const par = {};
    for (const el of elevesDe(etat, classeId)) par[el.id] = moyenneEleve(evs, el.id).moyenne;
    return { evals: evs, par, stats: stats(Object.values(par)) };
  }
  // Moyenne annuelle : moyenne des moyennes de périodes connues, chaque période pesant autant.
  function moyenneAnnuelle(etat, classeId, annee, eleveId) {
    const ms = bornes(annee).map((p) => moyenneEleve(evalsPeriode(etat, classeId, annee, p.id), eleveId).moyenne).filter((m) => m !== null);
    return ms.length ? ms.reduce((s, x) => s + x, 0) / ms.length : null;
  }
  // Statistiques d'une évaluation (notes ramenées sur 20) et décompte des saisies.
  function statsEvaluation(ev, eleves) {
    const v = [], sp = { ABS: 0, NN: 0, DISP: 0 };
    let manquantes = 0;
    for (const el of eleves) {
      const n = ev.notes?.[el.id];
      if (estSpeciale(n)) sp[n]++;
      else if (estNote(n)) v.push(sur20(n, ev.bareme));
      else manquantes++;
    }
    return { ...stats(v), valeurs: v, speciales: sp, manquantes: ev.bareme > 0 ? manquantes : 0 };
  }

  // ---------- Compétences ----------
  // Bilan d'une compétence : moyenne des niveaux (1 à 4) arrondie, ,5 vers le haut ; null sans évaluation.
  const niveauBilan = (niveaux) => { const l = niveaux.filter((n) => n >= 1 && n <= 4); return l.length ? Math.min(4, Math.floor(l.reduce((s, x) => s + x, 0) / l.length + 0.5)) : null; };
  function bilanCompetence(evals, eleveId, compId) {
    const l = evals.filter((e) => e.niveaux?.[eleveId]?.[compId]).sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.niveaux[eleveId][compId]);
    return { niveau: niveauBilan(l), nb: l.length, dernier: l.length ? l[l.length - 1] : null };
  }
  // Compétences évaluées au moins une fois dans ces évaluations, dans l'ordre du référentiel.
  const competencesVues = (etat, evals) => etat.competences.filter((c) => evals.some((e) => (e.competences || []).includes(c.id)));

  // ---------- Appréciations ----------
  const prenom = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';
  const composer = (phrase, eleve) => String(phrase).replace(/\{prenom\}/g, prenom(eleve?.nom));
  function ajouterPhrase(actuel, phrase) {
    const a = String(actuel || '').trim();
    return a ? `${a}${/[.!?]$/.test(a) ? '' : '.'} ${phrase}` : phrase;
  }
  // Niveau de formulation suggéré d'après la moyenne (simple aide au choix des phrases).
  const niveauSuggere = (m) => (m === null || m === undefined ? null : m < 8 ? 1 : m < 12 ? 2 : m < 15 ? 3 : 4);
  const appreciationDe = (etat, eleveId, periodeId) => etat.appreciations.find((a) => a.eleveId === eleveId && a.periodeId === periodeId)?.texte || '';
  function ecrireAppreciation(etat, eleveId, periodeId, t, max = 2000) {
    const reste = etat.appreciations.filter((a) => !(a.eleveId === eleveId && a.periodeId === periodeId));
    const tx = texte(t, max);
    return { ...etat, appreciations: tx ? [...reste, { id: nouvelId(), eleveId, periodeId, texte: tx }] : reste };
  }

  // ---------- À faire ----------
  // Notes à saisir (évaluations passées incomplètes), évaluations des 14 prochains jours, appréciations à
  // rédiger quand la fin de la période approche (fenêtre de jours des réglages) ou est passée.
  function aFaire(etat, annee, auj, fenetre = 21) {
    const out = [];
    const classes = etat.classes.filter((c) => c.anneeId === annee?.id);
    const p = periodeDe(annee, auj);
    for (const c of classes) {
      const els = elevesDe(etat, c.id);
      if (!els.length) continue;
      for (const e of evalsDe(etat, c.id)) {
        if (e.bareme > 0 && e.date <= auj) {
          const n = statsEvaluation(e, els).manquantes;
          if (n) out.push({ type: 'notes', classeId: c.id, evalId: e.id, date: e.date, nb: n, etat: ecart(e.date, auj) > 14 ? 'retard' : 'proche' });
        } else if (e.date > auj && ecart(auj, e.date) <= 14) out.push({ type: 'avenir', classeId: c.id, evalId: e.id, date: e.date, nb: 0, etat: 'avenir' });
      }
      if (p && ecart(auj, p.fin) <= fenetre) {
        const n = els.filter((el) => !appreciationDe(etat, el.id, p.id)).length;
        if (n) out.push({ type: 'appreciations', classeId: c.id, periodeId: p.id, date: p.fin, nb: n, etat: p.fin < auj ? 'retard' : 'proche' });
      }
    }
    const rang = { retard: 0, proche: 1, avenir: 2 };
    return out.sort((a, b) => rang[a.etat] - rang[b.etat] || a.date.localeCompare(b.date));
  }

  // ---------- Bulletin ----------
  function bulletin(etat, base, eleveId, periodeId) {
    const el = etat.eleves.find((x) => x.id === eleveId);
    if (!el) return null;
    const classe = etat.classes.find((c) => c.id === el.classeId);
    const annee = etat.annees.find((a) => a.id === classe?.anneeId);
    const periode = bornes(annee).find((p) => p.id === periodeId);
    if (!classe || !annee || !periode) return null;
    const mp = moyennesPeriode(etat, classe.id, annee, periodeId);
    const m = moyenneEleve(mp.evals, eleveId);
    const evals = mp.evals.map((e) => {
      const n = e.notes?.[eleveId];
      return { titre: e.titre, date: e.date, bareme: e.bareme, coef: e.coef, bonus: !!e.bonus, note: n ?? null, s20: sur20(n, e.bareme), bonusRetenu: m.bonusRetenus.includes(e.id), moyenneClasse: stats(elevesDe(etat, classe.id).map((x) => sur20(e.notes?.[x.id], e.bareme))).moyenne };
    });
    const competences = competencesVues(etat, mp.evals).map((c) => ({ ...bilanCompetence(mp.evals, eleveId, c.id), competence: c }));
    return { eleve: el, classe, annee, periode, moyenne: m.moyenne, classeStats: mp.stats, evals, competences, appreciation: appreciationDe(etat, eleveId, periodeId), niveaux: base.niveaux };
  }
  const fmtNote = (n, d = 2) => (n === null || n === undefined ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  function texteBulletin(b, d = 2) {
    const lib = (n) => (estSpeciale(n) ? n : estNote(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '–');
    const t = [`${b.eleve.nom} · ${b.classe.nom}${b.classe.matiere ? ` · ${b.classe.matiere}` : ''}`, `${b.periode.nom} · ${b.annee.nom}`, '',
      `Moyenne : ${fmtNote(b.moyenne, d)} / 20 (classe : ${fmtNote(b.classeStats.moyenne, d)}, de ${fmtNote(b.classeStats.min, d)} à ${fmtNote(b.classeStats.max, d)})`];
    if (b.evals.length) { t.push('', 'Évaluations :'); for (const e of b.evals) t.push(`- ${dateFr(e.date)} · ${e.titre} : ${lib(e.note)}${e.bareme ? ` / ${e.bareme}` : ''}${e.coef !== 1 ? ` (coef. ${String(e.coef).replace('.', ',')})` : ''}${e.bonus ? (e.bonusRetenu ? ' · bonus retenu' : ' · bonus non retenu') : ''}`); }
    if (b.competences.length) { t.push('', 'Compétences :'); for (const c of b.competences) t.push(`- ${c.competence.code ? `${c.competence.code} ` : ''}${c.competence.nom} : ${c.niveau ? b.niveaux[c.niveau - 1].nom : 'non évaluée'}`); }
    t.push('', `Appréciation : ${b.appreciation || '(à rédiger)'}`);
    return t.join('\n');
  }

  // ---------- Export CSV (point-virgule, BOM UTF-8, tableurs français) ----------
  function champCsv(v) {
    let s = typeof v === 'number' ? String(arrondi(v, 2)).replace('.', ',') : String(v ?? '');
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // formules neutralisées
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const versCsv = (lignes) => `﻿${lignes.map((l) => l.map(champCsv).join(';')).join('\r\n')}\r\n`;
  // Carnet de notes d'une classe sur une période : une ligne par élève, une colonne par évaluation.
  function csvClasse(etat, classeId, annee, periodeId) {
    const mp = moyennesPeriode(etat, classeId, annee, periodeId);
    const tete = ['Élève', ...mp.evals.map((e) => `${e.titre} (${dateFr(e.date)}, sur ${e.bareme}, coef. ${String(e.coef).replace('.', ',')})`), 'Moyenne sur 20'];
    const lignes = elevesDe(etat, classeId).map((el) => [el.nom, ...mp.evals.map((e) => e.notes?.[el.id] ?? ''), mp.par[el.id] ?? '']);
    return versCsv([tete, ...lignes, ['Moyenne de la classe', ...mp.evals.map((e) => statsEvaluation(e, elevesDe(etat, classeId)).moyenne ?? ''), mp.stats.moyenne ?? '']]);
  }
  // Toutes les notes, une ligne par note (reprise dans un tableur).
  function csvTout(etat) {
    const lignes = [];
    for (const e of [...etat.evaluations].sort((a, b) => a.date.localeCompare(b.date))) {
      const c = etat.classes.find((x) => x.id === e.classeId);
      const an = etat.annees.find((x) => x.id === c?.anneeId);
      if (!c || !an) continue;
      const p = periodeDe(an, e.date);
      for (const el of elevesDe(etat, c.id, true)) {
        const n = e.notes?.[el.id];
        if (n === undefined) continue;
        lignes.push([an.nom, c.nom, c.matiere, p?.nom || '', el.nom, e.titre, dateFr(e.date), e.bareme, e.coef, n, sur20(n, e.bareme) ?? '']);
      }
    }
    return versCsv([['Année', 'Classe', 'Matière', 'Période', 'Élève', 'Évaluation', 'Date', 'Barème', 'Coefficient', 'Note', 'Note sur 20'], ...lignes]);
  }

  // ---------- Fin d'année et suppressions ----------
  // Efface élèves, notes, niveaux et appréciations d'une année ; garde l'année, ses périodes, ses classes,
  // les évaluations (sans notes), le référentiel et la banque.
  function effacerAnnee(etat, anneeId) {
    const cl = new Set(etat.classes.filter((c) => c.anneeId === anneeId).map((c) => c.id));
    const partis = new Set(etat.eleves.filter((e) => cl.has(e.classeId)).map((e) => e.id));
    return {
      ...etat,
      eleves: etat.eleves.filter((e) => !partis.has(e.id)),
      evaluations: etat.evaluations.map((e) => (cl.has(e.classeId) ? { ...e, notes: {}, niveaux: {} } : e)),
      appreciations: etat.appreciations.filter((a) => !partis.has(a.eleveId)),
    };
  }
  function supprimerClasse(etat, classeId) {
    const partis = new Set(etat.eleves.filter((e) => e.classeId === classeId).map((e) => e.id));
    return { ...etat, classes: etat.classes.filter((c) => c.id !== classeId), eleves: etat.eleves.filter((e) => !partis.has(e.id)), evaluations: etat.evaluations.filter((e) => e.classeId !== classeId), appreciations: etat.appreciations.filter((a) => !partis.has(a.eleveId)) };
  }
  function supprimerAnnee(etat, anneeId) {
    let e = etat;
    for (const c of etat.classes.filter((x) => x.anneeId === anneeId)) e = supprimerClasse(e, c.id);
    return { ...e, annees: e.annees.filter((a) => a.id !== anneeId), anneeId: e.anneeId === anneeId ? null : e.anneeId };
  }
  function supprimerEleve(etat, eleveId) {
    const sans = (o) => { const c = { ...(o || {}) }; delete c[eleveId]; return c; };
    return { ...etat, eleves: etat.eleves.filter((e) => e.id !== eleveId), evaluations: etat.evaluations.map((e) => ({ ...e, notes: sans(e.notes), niveaux: sans(e.niveaux) })), appreciations: etat.appreciations.filter((a) => a.eleveId !== eleveId) };
  }
  // Reprend les classes d'une année (noms, matières, types) dans une autre, sans élèves ni évaluations.
  function reprendreClasses(etat, deId, versId) {
    const existants = new Set(etat.classes.filter((c) => c.anneeId === versId).map((c) => plat(c.nom)));
    const neuves = etat.classes.filter((c) => c.anneeId === deId && !existants.has(plat(c.nom))).map((c) => ({ ...c, id: nouvelId(), anneeId: versId }));
    return { ...etat, classes: [...etat.classes, ...neuves] };
  }
  // Liste d'élèves collée (un par ligne, ou séparés par des points-virgules) : noms nettoyés, sans doublon.
  function lireListe(t) {
    const vus = new Set();
    return String(t || '').split(/[\r\n;]+/).map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 40)).filter((x) => x && !vus.has(plat(x)) && vus.add(plat(x)));
  }

  // ---------- Normalisation (tolérante aux anciennes versions et aux imports) ----------
  const entier = (v, min, max, dv) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dv; };
  const dateOuNull = (v) => (estDate(v) ? v : null);
  function normaliserReglages(r, dv) {
    r = r || {};
    return { decimales: r.decimales === 1 ? 1 : dv.decimales === 1 && r.decimales === undefined ? 1 : 2, longueurAppreciation: entier(r.longueurAppreciation, 80, 2000, dv.longueurAppreciation), alerteJours: entier(r.alerteJours, 0, 120, dv.alerteJours), rgpdLu: dateOuNull(r.rgpdLu) };
  }
  const normaliserPeriode = (p) => ({ id: texte(p?.id, 40) || nouvelId(), nom: texte(p?.nom, 40) || 'Période', fin: dateOuNull(p?.fin) || '2027-06-30' });
  const normaliserAnnee = (a) => ({ id: texte(a?.id, 40) || nouvelId(), nom: texte(a?.nom, 30) || 'Année', debut: dateOuNull(a?.debut) || '2026-09-01', periodes: (Array.isArray(a?.periodes) ? a.periodes : []).map(normaliserPeriode) });
  const normaliserClasse = (c) => ({ id: texte(c?.id, 40) || nouvelId(), anneeId: texte(c?.anneeId, 40), nom: texte(c?.nom, 40) || 'Classe', matiere: texte(c?.matiere, 40), type: c?.type === 'groupe' ? 'groupe' : 'classe' });
  const normaliserEleve = (e) => ({ id: texte(e?.id, 40) || nouvelId(), classeId: texte(e?.classeId, 40), nom: texte(e?.nom, 40) || 'Élève', remarque: texte(e?.remarque, 200), actif: e?.actif !== false });
  function normaliserEvaluation(e) {
    const notes = {}, niveaux = {};
    for (const [k, v] of Object.entries(e?.notes || {})) if (estSpeciale(v) || (estNote(v) && v <= 1000)) notes[texte(k, 40)] = estNote(v) ? arrondi(v, 2) : v;
    for (const [k, o] of Object.entries(e?.niveaux || {})) {
      const l = {};
      for (const [c, n] of Object.entries(o || {})) if ([1, 2, 3, 4].includes(n)) l[texte(c, 40)] = n;
      if (Object.keys(l).length) niveaux[texte(k, 40)] = l;
    }
    const b = Number(e?.bareme);
    const coef = Number(e?.coef);
    return { id: texte(e?.id, 40) || nouvelId(), classeId: texte(e?.classeId, 40), titre: texte(e?.titre, 80) || 'Évaluation', date: dateOuNull(e?.date) || '2026-09-01', bareme: Number.isFinite(b) && b >= 0 ? Math.min(1000, arrondi(b, 2)) : 20, coef: Number.isFinite(coef) && coef >= 0 ? Math.min(100, arrondi(coef, 2)) : 1, bonus: !!e?.bonus, competences: Array.isArray(e?.competences) ? e.competences.map((x) => texte(x, 40)).filter(Boolean) : [], notes, niveaux };
  }
  const normaliserCompetence = (c) => ({ id: texte(c?.id, 40) || nouvelId(), code: texte(c?.code, 12), nom: texte(c?.nom, 120) || 'Compétence', domaine: texte(c?.domaine, 60) });
  const normaliserAppreciation = (a) => ({ id: texte(a?.id, 40) || nouvelId(), eleveId: texte(a?.eleveId, 40), periodeId: texte(a?.periodeId, 40), texte: texte(a?.texte, 2000) });
  const normaliserPhrase = (p) => ({ id: texte(p?.id, 40) || nouvelId(), axe: ['resultats', 'travail', 'attitude', 'conseil'].includes(p?.axe) ? p.axe : 'resultats', niveau: entier(p?.niveau, 1, 4, 3), texte: texte(p?.texte, 300) || '…' });
  // Référentiel de la base (socle ou générique) prêt à l'emploi.
  const referentiel = (base, code) => (base.referentiels.find((r) => r.code === code) || base.referentiels[0]).competences.map(([c, nom, domaine]) => ({ id: nouvelId(), code: c, nom, domaine }));
  const banqueDefaut = (base) => base.banque.map(([axe, niveau, t]) => ({ id: nouvelId(), axe, niveau, texte: t }));
  function etatVide(base) {
    return { version: 1, reglages: normaliserReglages({}, base.reglages), anneeId: null, annees: [], classes: [], eleves: [], evaluations: [], competences: referentiel(base, 'socle'), appreciations: [], banque: banqueDefaut(base) };
  }
  function normaliser(d, base) {
    const v = etatVide(base);
    if (!d || typeof d !== 'object') return v;
    const liste = (l, f) => (Array.isArray(l) ? l : []).map(f);
    const n = {
      ...v, ...d,
      reglages: normaliserReglages(d.reglages, base.reglages),
      annees: liste(d.annees, normaliserAnnee), classes: liste(d.classes, normaliserClasse), eleves: liste(d.eleves, normaliserEleve),
      evaluations: liste(d.evaluations, normaliserEvaluation),
      competences: Array.isArray(d.competences) ? d.competences.map(normaliserCompetence) : v.competences,
      appreciations: liste(d.appreciations, normaliserAppreciation),
      banque: Array.isArray(d.banque) ? d.banque.map(normaliserPhrase) : v.banque,
    };
    if (!n.annees.some((a) => a.id === n.anneeId)) n.anneeId = n.annees.length ? [...n.annees].sort((a, b) => b.debut.localeCompare(a.debut))[0].id : null;
    return n;
  }
  // Taille en octets de l'état sérialisé (le service accepte environ 900 000 octets par compte).
  const taille = (etat) => new TextEncoder().encode(JSON.stringify(etat)).length;

  g.CSE = {
    iso, versDate, ajout, ecart, estDate, dateFr, arrondi, plat, lireNombre, nouvelId,
    anneeScolaire, periodesParDefaut, bornes, periodeDe,
    SPECIALES, estSpeciale, estNote, lireNote, sur20, moyennePonderee, moyenneEleve, stats, TRANCHES, repartition,
    elevesDe, evalsDe, evalsPeriode, moyennesPeriode, moyenneAnnuelle, statsEvaluation,
    niveauBilan, bilanCompetence, competencesVues,
    prenom, composer, ajouterPhrase, niveauSuggere, appreciationDe, ecrireAppreciation,
    aFaire, bulletin, fmtNote, texteBulletin, champCsv, versCsv, csvClasse, csvTout,
    effacerAnnee, supprimerClasse, supprimerAnnee, supprimerEleve, reprendreClasses, lireListe,
    normaliserReglages, normaliserAnnee, normaliserPeriode, normaliserClasse, normaliserEleve, normaliserEvaluation,
    normaliserCompetence, normaliserAppreciation, normaliserPhrase, referentiel, banqueDefaut, etatVide, normaliser, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
