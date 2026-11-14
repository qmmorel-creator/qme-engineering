// Progression pédagogique QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.PRG) et par les tests Node (outils/templates/progression.test.mjs).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes) ; les fonctions qui dépendent du jour
// reçoivent la date de référence `auj`. Durées en heures (pas de 0,5 h).
(function (g) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const jourSemaine = (s) => { const j = versDate(s).getDay(); return j === 0 ? 7 : j; }; // 1 = lundi … 7 = dimanche
  const lundi = (s) => ajout(s, 1 - jourSemaine(s));
  const dateFr = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');

  // ---------- Nombres et textes ----------
  const arrondi = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  const demi = (n) => Math.round(n * 2) / 2;
  const plat = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // « 1,5 » → 1.5 ; null si vide ou illisible (jamais négatif).
  function lireNombre(saisie) {
    const s = String(saisie ?? '').replace(/[\s  ]/g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Number(s);
  }
  const texte = (v, n) => String(v ?? '').trim().slice(0, n);
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const heures = (h) => { const v = arrondi(Math.abs(h), 1); const e = Math.floor(v); const m = Math.round((v - e) * 60); return `${h < 0 ? '−' : ''}${e} h${m ? ` ${deux(m)}` : ''}`; };

  // ---------- Année scolaire ----------
  // Année qui contient `auj` : du 1er septembre au 30 juin (août compte pour la suivante).
  function anneeScolaire(auj) {
    const a = Number(auj.slice(0, 4)), m = Number(auj.slice(5, 7));
    const debut = m >= 8 ? a : a - 1;
    return { nom: `${debut}-${debut + 1}`, debut: `${debut}-09-01`, fin: `${debut + 1}-06-30` };
  }

  // ---------- Jours fériés (France) ----------
  // Dimanche de Pâques, calendrier grégorien (algorithme dit « de Meeus / Jones / Butcher »).
  function paques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), h0 = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - h0 + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${annee}-${deux(mois)}-${deux(jour)}`;
  }
  // Les 11 fêtes légales de l'article L3133-1 du Code du travail ; Alsace-Moselle : Vendredi saint, 26 décembre.
  const FERIES = [
    ['jan1', 'Jour de l\'an'], ['lundiPaques', 'Lundi de Pâques'], ['mai1', 'Fête du Travail'], ['mai8', 'Victoire 1945'],
    ['ascension', 'Ascension'], ['lundiPentecote', 'Lundi de Pentecôte'], ['juil14', 'Fête nationale'], ['aout15', 'Assomption'],
    ['nov1', 'Toussaint'], ['nov11', 'Armistice 1918'], ['dec25', 'Noël'], ['vendrediSaint', 'Vendredi saint'], ['dec26', 'Saint-Étienne'],
  ];
  const ALSACE = ['vendrediSaint', 'dec26'];
  function feries(annee, alsaceMoselle = false) {
    const p = paques(annee);
    const fixe = (m, j) => `${annee}-${deux(m)}-${deux(j)}`;
    const dates = {
      jan1: fixe(1, 1), lundiPaques: ajout(p, 1), mai1: fixe(5, 1), mai8: fixe(5, 8), ascension: ajout(p, 39),
      lundiPentecote: ajout(p, 50), juil14: fixe(7, 14), aout15: fixe(8, 15), nov1: fixe(11, 1), nov11: fixe(11, 11),
      dec25: fixe(12, 25), vendrediSaint: ajout(p, -2), dec26: fixe(12, 26),
    };
    return FERIES.filter(([id]) => alsaceMoselle || !ALSACE.includes(id)).map(([id, nom]) => ({ id, nom, date: dates[id] })).sort((x, y) => x.date.localeCompare(y.date));
  }
  // Fériés compris entre deux dates (incluses).
  function feriesEntre(debut, fin, alsaceMoselle = false) {
    const l = [];
    for (let a = Number(debut.slice(0, 4)); a <= Number(fin.slice(0, 4)); a++) l.push(...feries(a, alsaceMoselle));
    return l.filter((f) => f.date >= debut && f.date <= fin);
  }

  // ---------- Calendrier d'une année ----------
  // Contexte de calcul : jours sans cours (fériés retenus, vacances, jours fermés) indexés par date.
  function contexte(annee, reg = {}) {
    const fermes = new Map();
    if (!annee || !estDate(annee.debut) || !estDate(annee.fin)) return { annee, fermes, sauteVacances: reg.sauteVacances !== false, ouvertes: new Map() };
    const ignores = new Set(reg.feriesIgnores || []);
    for (const f of feriesEntre(annee.debut, annee.fin, reg.alsaceMoselle)) if (!ignores.has(f.id)) fermes.set(f.date, { type: 'ferie', nom: f.nom });
    for (const x of annee.fermetures || []) {
      if (!estDate(x.debut) || !estDate(x.fin) || x.fin < x.debut) continue;
      for (let d = x.debut; d <= x.fin; d = ajout(d, 1)) if (!fermes.has(d) || x.type === 'vacances') fermes.set(d, { type: x.type === 'ferme' ? 'ferme' : 'vacances', nom: x.nom });
    }
    return { annee, fermes, sauteVacances: reg.sauteVacances !== false, ouvertes: new Map() };
  }
  const ferme = (ctx, date) => ctx.fermes.get(date) || null;
  // Une semaine « a des cours » si au moins un jour du lundi au vendredi n'est pas fermé.
  function semaineOuverte(ctx, l) {
    if (!ctx.ouvertes.has(l)) { let o = false; for (let i = 0; i < 5; i++) if (!ctx.fermes.has(ajout(l, i))) { o = true; break; } ctx.ouvertes.set(l, o); }
    return ctx.ouvertes.get(l);
  }
  // Semaine A ou B d'une date. La semaine de référence est A. Avec `sauteVacances`, seules les semaines
  // avec des cours comptent (l'alternance reprend après les vacances là où elle s'était arrêtée).
  function semaineAB(ctx, ref, date) {
    const l0 = lundi(ref), l1 = lundi(date);
    if (l1 === l0) return 'A';
    if (!ctx.sauteVacances || l1 < l0) return (Math.abs(ecart(l0, l1) / 7) % 2 === 0) ? 'A' : 'B';
    let n = 0;
    for (let l = l0; l < l1; l = ajout(l, 7)) if (semaineOuverte(ctx, l)) n++;
    return n % 2 === 0 ? 'A' : 'B';
  }

  // Créneaux d'une classe entre deux dates (incluses), dans les bornes de la classe et de l'année.
  // Chaque créneau : { date, duree, creneauId }.
  function creneaux(prog, ctx, de, a) {
    const an = ctx.annee;
    if (!prog || !an) return [];
    const debut = [de, prog.debut, an.debut].filter(estDate).sort().pop();
    const fin = [a, prog.fin, an.fin].filter(estDate).sort()[0];
    const res = [];
    if (!debut || !fin || fin < debut) return res;
    const parJour = {};
    for (const c of prog.creneaux || []) (parJour[c.jour] = parJour[c.jour] || []).push(c);
    const ref = estDate(prog.refA) ? prog.refA : (prog.debut || an.debut);
    for (let d = debut; d <= fin; d = ajout(d, 1)) {
      const cs = parJour[jourSemaine(d)];
      if (!cs || ctx.fermes.has(d)) continue;
      let ab = null;
      for (const c of cs) {
        if (c.semaine === 'A' || c.semaine === 'B') { ab = ab || semaineAB(ctx, ref, d); if (ab !== c.semaine) continue; }
        res.push({ date: d, duree: c.duree, creneauId: c.id });
      }
    }
    return res;
  }
  const somme = (l, f = (x) => x.duree) => arrondi(l.reduce((s, x) => s + (Number(f(x)) || 0), 0), 2);
  // Volume horaire hebdomadaire moyen (un créneau A ou B compte pour moitié).
  const heuresHebdo = (prog) => somme(prog?.creneaux || [], (c) => (c.semaine === 'A' || c.semaine === 'B' ? c.duree / 2 : c.duree));

  // Périodes de cours entre deux plages de vacances (pour le modèle « une séquence par période »).
  function periodes(ctx) {
    const an = ctx.annee;
    if (!an) return [];
    const vac = (an.fermetures || []).filter((x) => x.type === 'vacances' && estDate(x.debut) && estDate(x.fin)).sort((x, y) => x.debut.localeCompare(y.debut));
    const res = [];
    let d = an.debut;
    for (const v of vac) {
      if (v.debut > d) res.push({ debut: d, fin: ajout(v.debut, -1), apres: v.nom });
      if (ajout(v.fin, 1) > d) d = ajout(v.fin, 1);
    }
    if (d <= an.fin) res.push({ debut: d, fin: an.fin, apres: null });
    return res.map((p, i) => ({ ...p, nom: `Période ${i + 1}` }));
  }

  // ---------- Séquences et séances ----------
  const sequencesDe = (E, pid) => E.sequences.filter((s) => s.progressionId === pid).sort((a, b) => a.ordre - b.ordre);
  const seancesDe = (E, pid) => E.seances.filter((s) => s.progressionId === pid).sort((a, b) => a.date.localeCompare(b.date) || (a.cree || '').localeCompare(b.cree || ''));
  const faitesDe = (E, sid) => E.seances.filter((s) => s.sequenceId === sid && s.statut === 'faite');
  const heuresFaites = (E, sid) => somme(faitesDe(E, sid));

  // Répartit des durées (dans l'ordre) sur une liste de créneaux : date de début et de fin de chacune.
  // Une durée qui ne tient pas a `fin` à null et `manque` > 0. Une durée nulle prend la date du créneau suivant.
  function repartir(durees, cr) {
    let i = 0, reste = cr.length ? cr[0].duree : 0;
    const res = [];
    for (const d0 of durees) {
      let d = Math.max(0, Number(d0) || 0);
      while (i < cr.length && reste <= 1e-9) { i++; reste = i < cr.length ? cr[i].duree : 0; }
      const debut = i < cr.length ? cr[i].date : null;
      if (d <= 1e-9) { res.push({ debut, fin: debut, manque: 0 }); continue; }
      let fin = null;
      while (i < cr.length && d > 1e-9) {
        const pris = Math.min(reste, d);
        d -= pris; reste -= pris;
        if (d <= 1e-9) { fin = cr[i].date; break; }
        i++; reste = i < cr.length ? cr[i].duree : 0;
      }
      res.push({ debut, fin, manque: fin ? 0 : arrondi(d, 2) });
    }
    return res;
  }

  // Bilan complet d'une classe à la date `auj` : heures disponibles, plan prévu (chaque créneau sert au
  // programme, séquences à la suite depuis le début des cours), avancement réel (une séquence terminée
  // compte pour sa durée prévue, une séquence en cours pour ses heures faites dans la limite de sa durée),
  // retard, projection des heures restantes sur les créneaux à venir, marge, fenêtres (jalons à plage).
  function bilan(E, prog, ctx, auj) {
    const seqs = sequencesDe(E, prog.id);
    const tous = creneaux(prog, ctx);
    const passes = tous.filter((c) => c.date < auj);
    const seances = seancesDe(E, prog.id);
    // Créneaux du jour déjà consignés (quel que soit le statut) : retirés des créneaux à venir.
    const duJour = seances.filter((s) => s.date === auj && s.statut !== 'prevue').length;
    let retires = 0;
    const avenir = tous.filter((c) => c.date > auj || (c.date === auj && retires++ >= duJour));
    const dispo = somme(tous), dispoRestant = somme(avenir);
    const prevues = seqs.map((s) => s.heures);
    const total = somme(seqs, (s) => s.heures);
    const plan = repartir(prevues, tous);
    // Attendu aujourd'hui : heures des créneaux passés et du jour, plafonnées au total prévu.
    const ecoule = somme(tous.filter((c) => c.date <= auj));
    const attendu = Math.min(total, ecoule);
    const lignes = seqs.map((s, i) => {
      const faites = heuresFaites(E, s.id);
      const terminee = !!s.terminee;
      const credit = terminee ? s.heures : Math.min(faites, s.heures);
      const reste = terminee ? 0 : Math.max(0, arrondi(s.heures - faites, 2));
      return { sequence: s, index: i, faites, credit, reste, terminee, depasse: !terminee && faites > s.heures + 1e-9, prevu: plan[i] };
    });
    const courante = lignes.find((l) => !l.terminee) || null;
    lignes.forEach((l) => { l.etat = l.terminee ? 'terminee' : (l.faites > 0 || l === courante) ? 'en-cours' : 'a-venir'; });
    const proj = repartir(lignes.map((l) => l.reste), avenir);
    lignes.forEach((l, i) => {
      const p = proj[i];
      const derniere = faitesDe(E, l.sequence.id).map((x) => x.date).sort().pop() || null;
      l.fin = l.terminee ? (estDate(l.sequence.terminee) ? l.sequence.terminee : derniere) : (l.reste <= 1e-9 ? (derniere || p.debut) : p.fin);
      l.debutReel = faitesDe(E, l.sequence.id).map((x) => x.date).sort()[0] || null;
      l.debutProjete = l.debutReel || p.debut;
      l.manque = p.manque;
      l.plage = etatPlage(l.fin, l.sequence.fenetre);
    });
    const reel = somme(lignes, (l) => l.credit);
    const resteTotal = somme(lignes, (l) => l.reste);
    const moyenne = tous.length ? dispo / tous.length : (heuresHebdo(prog) || 1);
    const retard = arrondi(attendu - reel, 2);
    const marge = arrondi(dispoRestant - resteTotal, 2);
    const nonRenseignes = nonRenseignesDe(passes, seances);
    return {
      progression: prog, sequences: lignes, courante,
      dispo, dispoRestant, total, attendu, reel, resteTotal, retard, marge,
      retardSeances: arrondi(retard / moyenne, 1), margeSeances: arrondi(marge / moyenne, 1), dureeMoyenne: arrondi(moyenne, 2),
      avancement: total ? reel / total : 0, attenduPart: total ? attendu / total : 0,
      finProjetee: lignes.length && lignes.every((l) => l.fin) ? lignes.map((l) => l.fin).sort().pop() : null,
      finPrevue: plan.length && plan.every((p) => p.fin) ? plan[plan.length - 1].fin : null,
      tient: marge >= -1e-9, nbCreneaux: tous.length, passes: passes.length, avenir, nonRenseignes,
      faites: seances.filter((s) => s.statut === 'faite').length,
      annulees: seances.filter((s) => s.statut === 'annulee').length,
      reportees: seances.filter((s) => s.statut === 'reportee').length,
      heuresPerdues: somme(seances.filter((s) => s.statut === 'annulee' || s.statut === 'reportee')),
    };
  }
  // Créneaux passés sans séance consignée ce jour-là (une séance « prévue » ne compte pas).
  function nonRenseignesDe(passes, seances) {
    const parDate = {};
    for (const s of seances) if (s.statut !== 'prevue') parDate[s.date] = (parDate[s.date] || 0) + 1;
    const vus = {};
    return passes.filter((c) => { vus[c.date] = (vus[c.date] || 0) + 1; return vus[c.date] > (parDate[c.date] || 0); });
  }

  // Jalon à plage : position d'une date par rapport à la fenêtre [debut, fin] (repris du planning Gantt).
  function etatPlage(date, plage) {
    if (!plage || !estDate(plage.debut) || !estDate(plage.fin)) return null;
    if (!date) return { code: 'depasse', jours: null };
    if (date < plage.debut) return { code: 'avance', jours: ecart(date, plage.debut) };
    if (date > plage.fin) return { code: 'depasse', jours: ecart(plage.fin, date) };
    return { code: 'dans', jours: ecart(date, plage.fin) };
  }

  // Séquence à associer par défaut à une séance du jour `date` : celle en cours (première non terminée).
  function sequenceParDefaut(E, pid) {
    const s = sequencesDe(E, pid).find((x) => !x.terminee);
    return s ? s.id : '';
  }
  // Prochain créneau libre après une date (aucune séance consignée ni prévue ce jour-là).
  function prochainCreneauLibre(E, prog, ctx, apres) {
    const occupes = {};
    for (const s of seancesDe(E, prog.id)) occupes[s.date] = (occupes[s.date] || 0) + 1;
    const vus = {};
    return creneaux(prog, ctx, ajout(apres, 1)).find((c) => { vus[c.date] = (vus[c.date] || 0) + 1; return vus[c.date] > (occupes[c.date] || 0); }) || null;
  }
  // Reporter une séance : elle passe « reportée », son contenu est replacé au prochain créneau libre.
  function reporter(E, seanceId, ctx, auj) {
    const s = E.seances.find((x) => x.id === seanceId);
    if (!s) return { E, nouvelle: null };
    const prog = E.progressions.find((p) => p.id === s.progressionId);
    const c = prog ? prochainCreneauLibre(E, prog, ctx, s.date < auj ? auj : s.date) : null;
    const E2 = { ...E, seances: E.seances.map((x) => (x.id === seanceId ? { ...x, statut: 'reportee' } : x)) };
    if (!c) return { E: E2, nouvelle: null };
    const nouvelle = normaliserSeance({ ...s, id: nouvelId(), date: c.date, duree: c.duree, statut: 'prevue', motif: '', cree: undefined });
    E2.seances = [...E2.seances, nouvelle];
    return { E: E2, nouvelle };
  }

  // ---------- Objectifs et taxonomie de Bloom ----------
  // Niveau de Bloom d'un objectif d'après son premier verbe ({ niveau, verbe }), ou { vague } si le verbe
  // est difficile à observer, ou { inconnu } si aucun verbe de la banque n'est reconnu.
  function analyserObjectif(t, base) {
    let s = plat(t).replace(/[’]/g, '\'').replace(/^[\s\-–•*·]+/, '').trim();
    if (!s) return { vide: true };
    for (const a of base.amorces.map(plat).sort((x, y) => y.length - x.length)) if (s.startsWith(a + ' ') || s.startsWith(a + '\'')) { s = s.slice(a.length).replace(/^[\s:']+/, ''); break; }
    s = s.replace(/^(s'|se )/, '');
    for (const v of base.verbesVagues.map(plat).sort((x, y) => y.length - x.length)) if (s === v || s.startsWith(v + ' ') || s.startsWith(v + '\'')) return { vague: true, verbe: v };
    for (const niv of base.bloom) for (const v of [...niv.verbes].sort((x, y) => y.length - x.length)) { const p = plat(v); if (s === p || s.startsWith(p + ' ') || s.startsWith(p + '\'')) return { niveau: niv.n, verbe: v }; }
    return { inconnu: true };
  }
  // Niveaux de Bloom couverts par une liste d'objectifs (comptage par niveau 1…6).
  function couvertureBloom(objectifs, base) {
    const n = [0, 0, 0, 0, 0, 0, 0];
    let vagues = 0;
    for (const o of objectifs || []) { const r = analyserObjectif(o, base); if (r.niveau) n[r.niveau]++; else if (r.vague) vagues++; }
    return { parNiveau: n.slice(1), vagues };
  }

  // ---------- Modèles de progression ----------
  // Séquences proposées par un modèle pour une classe : durées en parts des heures disponibles après la
  // réserve (arrondies à la demi-heure), ou une séquence par période de cours pour le modèle « periodes ».
  function sequencesModele(modele, prog, ctx, reservePct = 10) {
    const dispo = somme(creneaux(prog, ctx));
    const utile = dispo * (1 - Math.min(50, Math.max(0, reservePct)) / 100);
    if (modele.periodes) {
      const ps = periodes(ctx).map((p) => ({ ...p, h: somme(creneaux(prog, ctx, p.debut, p.fin)) })).filter((p) => p.h > 0);
      return ps.map((p, i) => ({ titre: `Séquence ${i + 1}`, heures: Math.max(0.5, demi(p.h * (1 - Math.min(50, Math.max(0, reservePct)) / 100))), note: `${p.nom} : ${heures(p.h)} de cours du ${dateFr(p.debut)} au ${dateFr(p.fin)}.` }));
    }
    const tot = modele.sequences.reduce((s, [, p]) => s + p, 0) || 1;
    return modele.sequences.map(([titre, p]) => ({ titre, heures: Math.max(0.5, demi(utile * p / tot)), note: '' }));
  }

  // ---------- Duplication ----------
  // Copie la structure d'une classe (créneaux, séquences, objectifs, durées, fenêtres décalées d'autant)
  // vers une année : ni séances ni séquences terminées. Retourne le nouvel état.
  function dupliquer(E, progId, anneeCible, nom) {
    const p = E.progressions.find((x) => x.id === progId);
    if (!p || !anneeCible) return E;
    const an = E.annees.find((a) => a.id === p.anneeId);
    const decal = an && an.id !== anneeCible.id ? ecart(an.debut, anneeCible.debut) : 0;
    const dec = (d) => (estDate(d) ? ajout(d, decal) : d);
    const np = normaliserProgression({ ...structuredCloneSimple(p), id: nouvelId(), anneeId: anneeCible.id, nom: texte(nom || p.nom, 40),
      debut: an && an.id !== anneeCible.id ? anneeCible.debut : p.debut, fin: an && an.id !== anneeCible.id ? anneeCible.fin : p.fin, refA: an && an.id !== anneeCible.id ? anneeCible.debut : p.refA,
      creneaux: p.creneaux.map((c) => ({ ...c, id: nouvelId() })), couleur: E.progressions.filter((x) => x.anneeId === anneeCible.id).length });
    const ns = sequencesDe(E, p.id).map((s) => normaliserSequence({ ...structuredCloneSimple(s), id: nouvelId(), progressionId: np.id, terminee: null,
      fenetre: s.fenetre ? { debut: dec(s.fenetre.debut), fin: dec(s.fenetre.fin) } : null }));
    return { ...E, progressions: [...E.progressions, np], sequences: [...E.sequences, ...ns] };
  }
  const structuredCloneSimple = (o) => JSON.parse(JSON.stringify(o));
  // Nouvelle année avec la structure de toutes les classes d'une autre année.
  function reprendreAnnee(E, deId, anneeCible) {
    let e = E;
    for (const p of E.progressions.filter((x) => x.anneeId === deId)) e = dupliquer(e, p.id, anneeCible, p.nom);
    return e;
  }
  // Supprime une classe avec ses séquences et ses séances.
  function supprimerProgression(E, pid) {
    return { ...E, progressions: E.progressions.filter((p) => p.id !== pid), sequences: E.sequences.filter((s) => s.progressionId !== pid), seances: E.seances.filter((s) => s.progressionId !== pid) };
  }
  function supprimerAnnee(E, aid) {
    const pids = new Set(E.progressions.filter((p) => p.anneeId === aid).map((p) => p.id));
    const annees = E.annees.filter((a) => a.id !== aid);
    return { ...E, annees, anneeId: E.anneeId === aid ? (annees[annees.length - 1]?.id || null) : E.anneeId,
      progressions: E.progressions.filter((p) => !pids.has(p.id)), sequences: E.sequences.filter((s) => !pids.has(s.progressionId)), seances: E.seances.filter((s) => !pids.has(s.progressionId)) };
  }
  // Déplace une séquence d'un cran (sens -1 ou +1) et renumérote.
  function deplacerSequence(E, sid, sens) {
    const s = E.sequences.find((x) => x.id === sid);
    if (!s) return E;
    const l = sequencesDe(E, s.progressionId);
    const i = l.findIndex((x) => x.id === sid), j = i + sens;
    if (j < 0 || j >= l.length) return E;
    [l[i], l[j]] = [l[j], l[i]];
    const ordre = new Map(l.map((x, k) => [x.id, k + 1]));
    return { ...E, sequences: E.sequences.map((x) => (ordre.has(x.id) ? { ...x, ordre: ordre.get(x.id) } : x)) };
  }

  // ---------- Exports ----------
  const cellule = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const ligneCsv = (l) => l.map(cellule).join(';');
  const nbCsv = (n) => String(arrondi(n, 2)).replace('.', ',');
  const NOMS_STATUT = { faite: 'Faite', prevue: 'Prévue', reportee: 'Reportée', annulee: 'Annulée' };
  // Séances d'une année (toutes les classes), pour un tableur : point-virgule, UTF-8 avec BOM.
  function csvSeances(E, anneeId) {
    const progs = E.progressions.filter((p) => p.anneeId === anneeId);
    const l = [['Date', 'Classe ou groupe', 'Matière', 'Séquence', 'Durée (h)', 'Statut', 'Motif', 'Contenu', 'Travail donné']];
    for (const p of progs) for (const s of seancesDe(E, p.id)) {
      const q = E.sequences.find((x) => x.id === s.sequenceId);
      l.push([dateFr(s.date), p.nom, p.matiere, q ? q.titre : '', nbCsv(s.duree), NOMS_STATUT[s.statut], s.motif, s.contenu, s.travail]);
    }
    return '﻿' + l.map(ligneCsv).join('\r\n');
  }
  // Séquences d'une classe avec leur bilan.
  function csvSequences(E, b) {
    const l = [['N°', 'Séquence', 'Objectifs', 'Compétences visées', 'Heures prévues', 'Heures faites', 'État', 'Début prévu', 'Fin prévue', 'Fin réelle ou projetée', 'Fenêtre : du', 'Fenêtre : au']];
    const etat = { terminee: 'Terminée', 'en-cours': 'En cours', 'a-venir': 'À venir' };
    b.sequences.forEach((x, i) => {
      const s = x.sequence;
      l.push([i + 1, s.titre, s.objectifs.join(' | '), s.competences, nbCsv(s.heures), nbCsv(x.faites), etat[x.etat], dateFr(x.prevu.debut), dateFr(x.prevu.fin), dateFr(x.fin), dateFr(s.fenetre?.debut), dateFr(s.fenetre?.fin)]);
    });
    return '﻿' + l.map(ligneCsv).join('\r\n');
  }
  // Cahier de textes : séances consignées d'une classe entre deux dates (prévues exclues).
  const cahier = (E, pid, de, a) => seancesDe(E, pid).filter((s) => s.statut !== 'prevue' && (!de || s.date >= de) && (!a || s.date <= a));

  // ---------- État et normalisation ----------
  function etatVide(base) {
    return { version: 1, reglages: { ...base.reglages, feriesIgnores: [...base.reglages.feriesIgnores] }, annees: [], anneeId: null, progressions: [], sequences: [], seances: [] };
  }
  const STATUTS = ['faite', 'prevue', 'reportee', 'annulee'];
  function normaliserFermeture(x) {
    const debut = estDate(x?.debut) ? x.debut : null;
    const fin = estDate(x?.fin) && (!debut || x.fin >= debut) ? x.fin : debut;
    return { id: x?.id || nouvelId(), nom: texte(x?.nom, 60) || (x?.type === 'ferme' ? 'Jour sans cours' : 'Vacances'), type: x?.type === 'ferme' ? 'ferme' : 'vacances', debut, fin };
  }
  function normaliserAnnee(a) {
    const sc = anneeScolaire(estDate(a?.debut) ? a.debut : iso(new Date()));
    const debut = estDate(a?.debut) ? a.debut : sc.debut;
    const fin = estDate(a?.fin) && a.fin > debut ? a.fin : sc.fin;
    return { id: a?.id || nouvelId(), nom: texte(a?.nom, 30) || sc.nom, debut, fin, fermetures: (Array.isArray(a?.fermetures) ? a.fermetures : []).map(normaliserFermeture).filter((x) => x.debut) };
  }
  function normaliserCreneau(c) {
    const jour = Math.round(Number(c?.jour));
    const duree = Number(c?.duree);
    return { id: c?.id || nouvelId(), jour: jour >= 1 && jour <= 6 ? jour : 1, duree: duree > 0 && duree <= 8 ? demi(duree) || 0.5 : 1, semaine: c?.semaine === 'A' || c?.semaine === 'B' ? c.semaine : 'toutes' };
  }
  function normaliserProgression(p) {
    return { id: p?.id || nouvelId(), anneeId: p?.anneeId || null, nom: texte(p?.nom, 40) || 'Classe', matiere: texte(p?.matiere, 40), public: texte(p?.public, 60),
      creneaux: (Array.isArray(p?.creneaux) ? p.creneaux : []).map(normaliserCreneau).slice(0, 20),
      debut: estDate(p?.debut) ? p.debut : null, fin: estDate(p?.fin) ? p.fin : null, refA: estDate(p?.refA) ? p.refA : null,
      couleur: Number.isInteger(p?.couleur) && p.couleur >= 0 ? p.couleur : 0 };
  }
  function normaliserSequence(s) {
    const h = Number(s?.heures);
    const f = s?.fenetre && estDate(s.fenetre.debut) && estDate(s.fenetre.fin) && s.fenetre.fin >= s.fenetre.debut ? { debut: s.fenetre.debut, fin: s.fenetre.fin } : null;
    return { id: s?.id || nouvelId(), progressionId: s?.progressionId || null, ordre: Number.isFinite(Number(s?.ordre)) ? Number(s.ordre) : 0, titre: texte(s?.titre, 90) || 'Séquence',
      objectifs: (Array.isArray(s?.objectifs) ? s.objectifs : String(s?.objectifs ?? '').split('\n')).map((o) => texte(o, 200)).filter(Boolean).slice(0, 12),
      competences: texte(s?.competences, 400), heures: h >= 0 && h <= 400 ? demi(h) : 6, fenetre: f, terminee: estDate(s?.terminee) ? s.terminee : null, note: texte(s?.note, 600) };
  }
  function normaliserSeance(s) {
    const d = Number(s?.duree);
    return { id: s?.id || nouvelId(), progressionId: s?.progressionId || null, sequenceId: s?.sequenceId || null, date: estDate(s?.date) ? s.date : iso(new Date()),
      duree: d > 0 && d <= 8 ? demi(d) || 0.5 : 1, statut: STATUTS.includes(s?.statut) ? s.statut : 'faite', motif: texte(s?.motif, 80),
      contenu: texte(s?.contenu, 1000), travail: texte(s?.travail, 500), cree: typeof s?.cree === 'string' ? s.cree : new Date().toISOString() };
  }
  function normaliserReglages(r, defaut) {
    const x = { ...defaut, ...(r || {}) };
    return { alsaceMoselle: !!x.alsaceMoselle, sauteVacances: x.sauteVacances !== false,
      feriesIgnores: (Array.isArray(x.feriesIgnores) ? x.feriesIgnores : []).filter((id) => FERIES.some(([f]) => f === id)),
      reserve: Number.isFinite(Number(x.reserve)) ? Math.min(50, Math.max(0, Math.round(Number(x.reserve)))) : 10 };
  }
  // Tolérant aux anciennes versions et aux fichiers importés : tout champ manquant reprend sa valeur par défaut,
  // les éléments orphelins (classe ou séquence supprimée) sont retirés.
  function normaliser(d, base) {
    const e = etatVide(base);
    if (!d || typeof d !== 'object') return e;
    e.reglages = normaliserReglages(d.reglages, base.reglages);
    e.annees = (Array.isArray(d.annees) ? d.annees : []).map(normaliserAnnee);
    const aids = new Set(e.annees.map((a) => a.id));
    e.anneeId = aids.has(d.anneeId) ? d.anneeId : (e.annees[e.annees.length - 1]?.id || null);
    e.progressions = (Array.isArray(d.progressions) ? d.progressions : []).map(normaliserProgression).filter((p) => aids.has(p.anneeId));
    const pids = new Set(e.progressions.map((p) => p.id));
    e.sequences = (Array.isArray(d.sequences) ? d.sequences : []).map(normaliserSequence).filter((s) => pids.has(s.progressionId));
    const sids = new Set(e.sequences.map((s) => s.id));
    e.seances = (Array.isArray(d.seances) ? d.seances : []).map(normaliserSeance).filter((s) => pids.has(s.progressionId)).map((s) => (s.sequenceId && !sids.has(s.sequenceId) ? { ...s, sequenceId: null } : s));
    if (d.majLe) e.majLe = d.majLe;
    return e;
  }
  const taille = (E) => new TextEncoder().encode(JSON.stringify(E)).length;

  g.PRG = {
    iso, versDate, ajout, ecart, estDate, jourSemaine, lundi, dateFr, arrondi, demi, plat, lireNombre, texte, nouvelId, heures,
    anneeScolaire, paques, feries, feriesEntre, FERIES, ALSACE, contexte, ferme, semaineAB, creneaux, somme, heuresHebdo, periodes,
    sequencesDe, seancesDe, heuresFaites, repartir, bilan, nonRenseignesDe, etatPlage, sequenceParDefaut, prochainCreneauLibre, reporter,
    analyserObjectif, couvertureBloom, sequencesModele, dupliquer, reprendreAnnee, supprimerProgression, supprimerAnnee, deplacerSequence,
    csvSeances, csvSequences, cahier, etatVide, normaliser, normaliserAnnee, normaliserFermeture, normaliserCreneau, normaliserProgression,
    normaliserSequence, normaliserSeance, normaliserReglages, taille,
  };
})(typeof window !== 'undefined' ? window : globalThis);
