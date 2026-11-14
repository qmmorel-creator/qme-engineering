// Préparateur d'appel découverte QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.APD) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes), heures « HH:MM », durées en minutes.
(function (racine) {
  'use strict';

  const STATUTS = ['prevu', 'fait', 'annule'];
  const NIVEAUX = ['inconnu', 'non', 'partiel', 'oui'];
  const POINTS = { inconnu: 0, non: 0, partiel: 1, oui: 2 };
  const SIGNAUX = ['besoin', 'budget', 'decideur', 'echeance'];
  const RESULTATS = ['a-verifier', 'confirmee', 'infirmee'];
  const MIN_PAR_QUESTION = 2;

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const estHeure = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j, new Date(an, mo, 0).getDate()))}`;
  }
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  // « 2026-11-13 » → « vendredi 13 novembre 2026 » (1er pour le premier du mois).
  function dateLongue(s, { jour = true, annee = true } = {}) {
    if (!estDate(s)) return '';
    const d = versDate(s);
    const n = d.getDate();
    return `${jour ? `${JOURS[d.getDay()]} ` : ''}${n === 1 ? '1er' : n} ${MOIS[d.getMonth()]}${annee ? ` ${d.getFullYear()}` : ''}`;
  }
  // 45 → « 45 min » ; 90 → « 1 h 30 » ; 60 → « 1 h ».
  function duree(min) {
    const m = Math.max(0, Math.round(Number(min) || 0));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${deux(r)}` : `${h} h`;
  }
  // Chronomètre : secondes écoulées → « 12:05 » (ou « 1:02:05 » au-delà d'une heure).
  function chrono(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h}:${deux(m)}:${deux(r)}` : `${deux(m)}:${deux(r)}`;
  }

  // ---------- Qualification ----------
  // Règle explicite : oui = 2 points, partiel = 1, non ou inconnu = 0, total sur 8 (4 signaux).
  //  hors-cible : besoin « non » (quel que soit le reste) ;
  //  qualifié   : total ≥ 6 et besoin « oui » ;
  //  à creuser  : total ≥ 3 ;
  //  froid      : sinon.
  const niveauSignal = (s) => {
    const v = s && typeof s === 'object' ? s.niveau : s;
    return NIVEAUX.includes(v) ? v : 'inconnu';
  };
  function qualification(signaux = {}) {
    const n = Object.fromEntries(SIGNAUX.map((k) => [k, niveauSignal(signaux[k])]));
    const total = SIGNAUX.reduce((s, k) => s + POINTS[n[k]], 0);
    const inconnus = SIGNAUX.filter((k) => n[k] === 'inconnu');
    let niveau;
    if (n.besoin === 'non') niveau = 'hors-cible';
    else if (total >= 6 && n.besoin === 'oui') niveau = 'qualifie';
    else if (total >= 3) niveau = 'a-creuser';
    else niveau = 'froid';
    return { total, max: 8, niveau, inconnus, niveaux: n };
  }

  // ---------- Préparation et états ----------
  // Un appel est « prêt » quand l'objectif est écrit, la fonction de l'interlocuteur connue et au moins
  // 3 questions retenues. Sinon il est « à préparer », avec la liste de ce qui manque.
  function preparation(a) {
    const manques = [];
    if (!String(a.objectif || '').trim()) manques.push('objectif');
    if (!String(a.fonction || '').trim()) manques.push('fonction');
    if ((a.questions || []).length < 3) manques.push('questions');
    return { pret: manques.length === 0, manques };
  }

  // État affiché : annule, fait, a-cloturer (date passée, pas marqué fait), pret, a-preparer.
  function etat(a, auj) {
    if (a.statut === 'annule') return 'annule';
    if (a.statut === 'fait') return 'fait';
    if (a.date && a.date < auj) return 'a-cloturer';
    return preparation(a).pret ? 'pret' : 'a-preparer';
  }

  const aEtape = (a) => !!(a.prochaine && String(a.prochaine.texte || '').trim());
  // Prochaine étape en retard : datée, pas faite, date passée (un appel annulé n'a plus d'étape à suivre).
  const etapeEnRetard = (a, auj) => a.statut !== 'annule' && aEtape(a) && !a.prochaine.faite && !!a.prochaine.date && a.prochaine.date < auj;
  // Un appel fait sans prochaine étape datée (ni faite) : à compléter.
  const sansEtapeDatee = (a) => a.statut === 'fait' && !(aEtape(a) && (a.prochaine.date || a.prochaine.faite));

  const cleTri = (a) => `${a.date || '9999-99-99'} ${a.heure || '99:99'}`;
  // Classement de la liste : étapes en retard, à venir (à préparer ou prêts, du plus proche au plus
  // lointain), à clôturer, faits (du plus récent), annulés.
  function classer(appels, auj) {
    const r = { enRetard: [], aVenir: [], aCloturer: [], faits: [], annules: [] };
    for (const a of appels) {
      if (etapeEnRetard(a, auj)) r.enRetard.push(a);
      const e = etat(a, auj);
      if (e === 'annule') r.annules.push(a);
      else if (e === 'fait') r.faits.push(a);
      else if (e === 'a-cloturer') r.aCloturer.push(a);
      else r.aVenir.push(a);
    }
    r.enRetard.sort((x, y) => x.prochaine.date.localeCompare(y.prochaine.date));
    r.aVenir.sort((x, y) => cleTri(x).localeCompare(cleTri(y)));
    r.aCloturer.sort((x, y) => cleTri(x).localeCompare(cleTri(y)));
    r.faits.sort((x, y) => cleTri(y).localeCompare(cleTri(x)));
    r.annules.sort((x, y) => cleTri(y).localeCompare(cleTri(x)));
    return r;
  }

  // Compteurs du tableau de bord.
  function compteurs(appels, auj) {
    const c = classer(appels, auj);
    const semaine = ajout(auj, 6);
    return {
      aPreparer: c.aVenir.filter((a) => etat(a, auj) === 'a-preparer').length,
      prets: c.aVenir.filter((a) => etat(a, auj) === 'pret').length,
      semaine: c.aVenir.filter((a) => a.date && a.date <= semaine).length,
      enRetard: c.enRetard.length,
      aCloturer: c.aCloturer.length,
      faits: c.faits.length,
      qualifies: c.faits.filter((a) => qualification(a.signaux).niveau === 'qualifie').length,
    };
  }

  // ---------- Questions ----------
  const ordrePhases = (phases) => new Map(phases.map((p, i) => [p.id, i]));
  // Questions regroupées par phase, dans l'ordre des phases puis dans l'ordre saisi.
  function parPhase(questions, phases) {
    return phases.map((p) => ({ phase: p, questions: questions.filter((q) => q.phase === p.id) })).filter((g) => g.questions.length);
  }
  // Monte (sens −1) ou descend (+1) une question parmi celles de sa phase ; renvoie un nouveau tableau.
  function deplacer(questions, id, sens) {
    const i = questions.findIndex((q) => q.id === id);
    if (i < 0) return questions.slice();
    const phase = questions[i].phase;
    let j = i + sens;
    while (j >= 0 && j < questions.length && questions[j].phase !== phase) j += sens;
    if (j < 0 || j >= questions.length) return questions.slice();
    const r = questions.slice();
    [r[i], r[j]] = [r[j], r[i]];
    return r;
  }
  // Ajoute une question de la banque (pas de doublon sur la référence) ; renvoie un nouveau tableau.
  function ajouterQuestion(questions, q, id) {
    if (q.ref && questions.some((x) => x.ref === q.ref)) return questions.slice();
    return [...questions, { id, ref: q.ref || null, texte: String(q.texte).trim(), phase: q.phase, posee: false, reponse: '' }];
  }
  function avancement(questions) {
    const total = questions.length;
    const posees = questions.filter((q) => q.posee).length;
    return { posees, total, pourcent: total ? Math.round((posees / total) * 100) : 0 };
  }

  // ---------- Plan minuté ----------
  // La durée est répartie entre les phases qui ont au moins une question, au prorata de leur poids,
  // en minutes entières (méthode du plus fort reste : la somme fait exactement la durée). Chaque phase
  // retenue a au moins 1 minute si la durée le permet. Capacité conseillée : 1 question pour 2 minutes.
  function plan(questions, dureeMin, phases, minParQuestion = MIN_PAR_QUESTION) {
    const D = Math.max(0, Math.round(Number(dureeMin) || 0));
    const capacite = Math.floor(D / minParQuestion);
    const nb = questions.length;
    const alerte = nb === 0 ? 'vide' : nb > capacite ? 'trop' : null;
    const presentes = phases.filter((p) => questions.some((q) => q.phase === p.id));
    if (!presentes.length || !D) return { duree: D, nb, capacite, alerte, phases: [] };
    const poids = presentes.reduce((s, p) => s + p.poids, 0) || presentes.length;
    const parts = presentes.map((p, i) => {
      const brut = (D * (p.poids || 1)) / poids;
      return { p, i, brut, min: Math.floor(brut) };
    });
    if (D >= parts.length) parts.forEach((x) => { x.min = Math.max(1, x.min); });
    let reste = D - parts.reduce((s, x) => s + x.min, 0);
    const parReste = [...parts].sort((x, y) => (y.brut - Math.floor(y.brut)) - (x.brut - Math.floor(x.brut)) || x.i - y.i);
    for (let k = 0; reste > 0; k++, reste--) parReste[k % parReste.length].min++;
    while (reste < 0) {
      const plusGrand = [...parts].sort((x, y) => y.min - x.min || x.i - y.i)[0];
      if (plusGrand.min <= 1) break;
      plusGrand.min--; reste++;
    }
    let t = 0;
    const lignes = parts.map((x) => {
      const n = questions.filter((q) => q.phase === x.p.id).length;
      const l = { phase: x.p.id, nom: x.p.nom, debut: t, fin: t + x.min, minutes: x.min, nb: n, parQuestion: Math.round((x.min / n) * 10) / 10 };
      t += x.min;
      return l;
    });
    return { duree: D, nb, capacite, alerte, phases: lignes };
  }
  // Phase prévue à la minute m de l'appel ; « depasse » au-delà de la durée.
  function phaseA(p, minutes) {
    if (!p.phases.length) return null;
    if (minutes >= p.duree) return { ...p.phases[p.phases.length - 1], depasse: true };
    return { ...(p.phases.find((l) => minutes >= l.debut && minutes < l.fin) || p.phases[0]), depasse: false };
  }

  // ---------- Conservation (RGPD) ----------
  // Dernière activité d'un appel : la plus tardive de sa date et de la date de prochaine étape.
  const derniereActivite = (a) => [a.date, a.prochaine?.date].filter(estDate).sort().pop() || null;
  // Appels faits ou annulés dont la dernière activité date de plus de « mois » mois : à effacer.
  function aEffacer(appels, auj, mois = 36) {
    const limite = ajoutMois(auj, -mois);
    // Un appel prévu, ou dont la prochaine étape n'est pas faite, reste une relation en cours : jamais proposé.
    return appels.filter((a) => a.statut !== 'prevu' && !(aEtape(a) && !a.prochaine.faite) && (derniereActivite(a) || auj) < limite);
  }

  // ---------- Compte rendu (texte à copier) ----------
  function compteRendu(a, B) {
    const nomPhase = (id) => (B.phases.find((p) => p.id === id) || { nom: id }).nom;
    const taille = (B.tailles.find((t) => t.id === a.taille) || {}).nom;
    const canal = (B.canaux.find((c) => c.id === a.canal) || {}).nom;
    const q = qualification(a.signaux);
    const L = [];
    L.push(`Compte rendu · appel découverte${a.date ? ` du ${dateLongue(a.date)}` : ''}`);
    L.push(`Organisation : ${a.organisation}${[a.secteur, a.taille ? taille : ''].filter(Boolean).length ? ` (${[a.secteur, a.taille ? taille : ''].filter(Boolean).join(', ')})` : ''}`);
    if (a.fonction || a.prenom) L.push(`Interlocuteur : ${[a.prenom, a.fonction].filter(Boolean).join(', ')}`);
    L.push(`Format : ${[canal, duree(a.duree)].filter(Boolean).join(', ')}`);
    if (a.objectif) L.push(`Objectif : ${a.objectif}`);
    L.push('');
    if (String(a.synthese || '').trim()) { L.push('Synthèse'); L.push(a.synthese.trim()); L.push(''); }
    L.push(`Qualification : ${q.total}/8, ${B.niveauxQualif[q.niveau].nom.toLowerCase()}`);
    for (const s of B.signaux) {
      const sig = a.signaux?.[s.id] || {};
      L.push(`- ${s.nom} : ${s.niveaux[q.niveaux[s.id]]}${sig.note ? ` (${sig.note})` : ''}`);
    }
    const rep = (a.questions || []).filter((x) => x.posee && String(x.reponse || '').trim());
    if (rep.length) {
      L.push('');
      L.push('Ce que nous avons appris');
      for (const g of parPhase(rep, B.phases)) {
        L.push(`${nomPhase(g.phase.id)}`);
        for (const x of g.questions) L.push(`- ${x.texte} ${x.reponse.trim()}`);
      }
    }
    const hyp = (a.hypotheses || []).filter((h) => String(h.texte || '').trim());
    if (hyp.length) {
      L.push('');
      L.push('Hypothèses');
      const lib = { 'a-verifier': 'à vérifier', confirmee: 'confirmée', infirmee: 'infirmée' };
      for (const h of hyp) L.push(`- ${h.texte} : ${lib[h.resultat] || 'à vérifier'}`);
    }
    if ((a.objections || []).length) {
      L.push('');
      L.push('Objections entendues');
      for (const ob of a.objections) L.push(`- ${ob.texte}${ob.note ? ` ${ob.note}` : ''}`);
    }
    if (String(a.notes || '').trim()) { L.push(''); L.push('Notes'); L.push(a.notes.trim()); }
    L.push('');
    if (aEtape(a)) L.push(`Prochaine étape : ${a.prochaine.texte.trim()}${a.prochaine.date ? `, le ${dateLongue(a.prochaine.date)}` : ', date à fixer'}${a.prochaine.faite ? ' (faite)' : ''}`);
    else L.push('Prochaine étape : à définir');
    return L.join('\n').trim();
  }

  // ---------- État ----------
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const texte = (v, max) => String(v ?? '').slice(0, max);
  const entier = (v, min, max, defaut) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut; };
  const dateOuNull = (v) => (estDate(v) ? v : null);

  function normaliserAppel(x, auj) {
    const a = x && typeof x === 'object' ? x : {};
    const sig = a.signaux && typeof a.signaux === 'object' ? a.signaux : {};
    const pro = a.prochaine && typeof a.prochaine === 'object' ? a.prochaine : {};
    return {
      id: String(a.id || nouvelId()),
      organisation: texte(a.organisation || 'Organisation', 120),
      secteur: texte(a.secteur, 60),
      taille: texte(a.taille, 20),
      fonction: texte(a.fonction, 80),
      prenom: texte(a.prenom, 40),
      canal: ['telephone', 'visio', 'sur-place'].includes(a.canal) ? a.canal : 'telephone',
      date: dateOuNull(a.date) || auj,
      heure: estHeure(a.heure) ? a.heure : '',
      duree: entier(a.duree, 5, 240, 30),
      objectif: texte(a.objectif, 400),
      hypotheses: (Array.isArray(a.hypotheses) ? a.hypotheses : []).slice(0, 20).map((h) => ({ id: String(h?.id || nouvelId()), texte: texte(h?.texte, 200), resultat: RESULTATS.includes(h?.resultat) ? h.resultat : 'a-verifier' })),
      questions: (Array.isArray(a.questions) ? a.questions : []).slice(0, 200).map((q) => ({ id: String(q?.id || nouvelId()), ref: q?.ref ? String(q.ref) : null, texte: texte(q?.texte || 'Question', 300), phase: String(q?.phase || 'situation'), posee: !!q?.posee, reponse: texte(q?.reponse, 2000) })),
      signaux: Object.fromEntries(SIGNAUX.map((k) => [k, { niveau: niveauSignal(sig[k]), note: texte(sig[k]?.note, 200) }])),
      objections: (Array.isArray(a.objections) ? a.objections : []).slice(0, 50).map((ob) => ({ id: String(ob?.id || nouvelId()), ref: ob?.ref ? String(ob.ref) : null, texte: texte(ob?.texte || 'Objection', 200), note: texte(ob?.note, 500) })),
      notes: texte(a.notes, 5000),
      synthese: texte(a.synthese, 3000),
      prochaine: { texte: texte(pro.texte, 200), date: dateOuNull(pro.date), faite: !!pro.faite },
      statut: STATUTS.includes(a.statut) ? a.statut : 'prevu',
      chronoDebut: Number.isFinite(a.chronoDebut) ? a.chronoDebut : null,
    };
  }

  const etatVide = () => ({ version: 1, prenom: '', reglages: { dureeDefaut: 30 }, appels: [], mesQuestions: [] });
  function normaliser(d, auj) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d,
      prenom: texte(d.prenom, 40),
      reglages: { ...v.reglages, ...(d.reglages || {}), dureeDefaut: entier(d.reglages?.dureeDefaut, 5, 240, 30) },
      appels: (Array.isArray(d.appels) ? d.appels : []).map((a) => normaliserAppel(a, auj)),
      mesQuestions: (Array.isArray(d.mesQuestions) ? d.mesQuestions : []).slice(0, 200).map((q) => ({ id: String(q?.id || nouvelId()), texte: texte(q?.texte || 'Question', 300), phase: String(q?.phase || 'situation') })),
    };
  }

  racine.APD = {
    STATUTS, NIVEAUX, POINTS, SIGNAUX, RESULTATS, MIN_PAR_QUESTION,
    iso, versDate, ajout, ecart, estDate, estHeure, ajoutMois, dateLongue, duree, chrono,
    qualification, preparation, etat, etapeEnRetard, sansEtapeDatee, classer, compteurs,
    parPhase, deplacer, ajouterQuestion, avancement, plan, phaseA,
    derniereActivite, aEffacer, compteRendu,
    nouvelId, normaliserAppel, etatVide, normaliser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
