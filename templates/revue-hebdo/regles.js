// Revue hebdomadaire et journal de bord QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.RVH) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ » (comparables comme des chaînes). Semaines ISO (lundi → dimanche), clé
// « AAAA-Www » (année ISO, qui peut différer de l'année civile autour du 1er janvier). Jours : lundi = 1.
//
// État :
//  prenom, jourRevue (1…7, vendredi = 5 par défaut), creeLe (date)
//  revues    [{ id, semaine, date, tete: [texte], reussites: [texte], difficultes: [texte], apprentissages,
//               priorites: [{ id, texte, etat: null|'faite'|'partielle'|'non' }]  ← pour la semaine SUIVANTE,
//               energie: 1…5|null, humeur: 1…5|null, mot, questions: { etape: { question, reponse } } }]
//  journal   { 'AAAA-MM-JJ': { texte, humeur: 1…5|null } }
//  echeances [{ id, date, texte, fait, revue }]   rendez-vous et échéances à venir
//  questionsPerso { etape: [texte] }, questionsMasquees [texte]
//  brouillon revue en cours (même forme qu'une revue + etape, decalages), ou null
(function (racine) {
  'use strict';

  const ETATS_PRIO = [null, 'faite', 'partielle', 'non'];
  const MAX_PRIORITES = 3;
  const MAX_LIGNE = 280; // caractères d'une ligne de journal

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const dateValide = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  // Jour de la semaine : lundi = 1 … dimanche = 7.
  const jourSemaine = (s) => ((versDate(s).getDay() + 6) % 7) + 1;
  const lundiDe = (s) => ajout(s, 1 - jourSemaine(s));
  // Semaine ISO : celle qui contient le jeudi détermine l'année ; la semaine 1 contient le 4 janvier.
  function cleSemaine(s) {
    const jeudi = ajout(lundiDe(s), 3);
    const annee = Number(jeudi.slice(0, 4));
    const n = 1 + Math.floor(ecart(lundiDe(`${annee}-01-04`), lundiDe(s)) / 7);
    return `${annee}-W${deux(n)}`;
  }
  const cleValide = (c) => typeof c === 'string' && /^\d{4}-W\d{2}$/.test(c) && cleSemaine(lundiDeCle(c)) === c;
  function lundiDeCle(c) {
    const annee = Number(c.slice(0, 4)), n = Number(c.slice(6));
    return ajout(lundiDe(`${annee}-01-04`), (n - 1) * 7);
  }
  const numeroSemaine = (c) => Number(c.slice(6));
  const semaineSuivante = (c, k = 1) => cleSemaine(ajout(lundiDeCle(c), 7 * k));
  const joursDe = (c) => { const l = lundiDeCle(c); return Array.from({ length: 7 }, (_, i) => ajout(l, i)); };
  const dimancheDeCle = (c) => ajout(lundiDeCle(c), 6);
  // Nombre de semaines de a vers b (positif si b est après a).
  const ecartSemaines = (a, b) => Math.round(ecart(lundiDeCle(a), lundiDeCle(b)) / 7);

  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // ---------- Petits outils ----------
  const arrondi1 = (x) => Math.round(x * 10) / 10;
  const moyenne = (l) => { const v = l.filter((x) => typeof x === 'number' && !Number.isNaN(x)); return v.length ? arrondi1(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const nombreTexte = (n) => (n === null || n === undefined || Number.isNaN(n) ? '' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 }));
  const noteValide = (n) => Number.isInteger(n) && n >= 1 && n <= 5;
  // Texte saisi sur plusieurs lignes → liste de lignes non vides (puces « - » ou « • » retirées).
  const lignes = (t) => String(t ?? '').split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  // Recherche insensible à la casse et aux accents.
  const plier = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- Revues ----------
  const revuesTriees = (e) => [...e.revues].sort((a, b) => (a.semaine < b.semaine ? -1 : a.semaine > b.semaine ? 1 : 0));
  const revueDe = (e, semaine) => e.revues.find((r) => r.semaine === semaine) || null;
  const derniereRevue = (e) => revuesTriees(e).at(-1) || null;
  // Priorités de la semaine donnée : choisies à la revue de la semaine précédente.
  const prioritesDe = (e, semaine) => revueDe(e, semaineSuivante(semaine, -1))?.priorites || [];
  const etatPrioSuivant = (x) => ETATS_PRIO[(ETATS_PRIO.indexOf(x ?? null) + 1) % ETATS_PRIO.length];
  // Taux des priorités tenues : faite = 1, en partie = ½, non = 0 ; les priorités sans état ne comptent pas.
  function tauxPriorites(prios) {
    const notees = (prios || []).filter((p) => p.etat);
    if (!notees.length) return null;
    const pts = notees.reduce((s, p) => s + (p.etat === 'faite' ? 1 : p.etat === 'partielle' ? 0.5 : 0), 0);
    return Math.round((pts / notees.length) * 100);
  }

  // Semaine à revoir et rappel du jour choisi (affichage dans l'application, aucune notification).
  // - à partir du jour de revue : la semaine en cours est à faire (« jour » le jour même, « due » ensuite) ;
  // - avant : la semaine précédente reste rattrapable (« retard ») si elle n'a pas été revue et que l'outil
  //   existait déjà pendant cette semaine ;
  // - sinon « ok », avec la date de la prochaine revue.
  function rappel(e, jour) {
    const j = jourSemaine(jour), cur = cleSemaine(jour), prev = semaineSuivante(cur, -1);
    const jr = e.jourRevue;
    const dateRevue = (c) => ajout(lundiDeCle(c), jr - 1);
    if (j >= jr && !revueDe(e, cur)) return { type: j === jr ? 'jour' : 'due', semaine: cur, date: dateRevue(cur) };
    if (j < jr && !revueDe(e, prev) && e.creeLe && e.creeLe <= dimancheDeCle(prev)) return { type: 'retard', semaine: prev, date: dateRevue(prev), avant: ajout(dateRevue(cur), -1) };
    const prochaine = revueDe(e, cur) ? semaineSuivante(cur) : cur;
    return { type: 'ok', semaine: prochaine, date: dateRevue(prochaine) };
  }
  // Semaine que couvre une revue commencée aujourd'hui (en avance : la semaine en cours).
  function semaineACommencer(e, jour) {
    const r = rappel(e, jour);
    if (r.type !== 'ok') return r.semaine;
    const cur = cleSemaine(jour);
    return revueDe(e, cur) ? null : cur;
  }

  // ---------- Journal ----------
  function ecrireJournal(e, date, { texte, humeur } = {}) {
    if (!dateValide(date)) return false;
    const t = String(texte ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LIGNE);
    const h = noteValide(humeur) ? humeur : null;
    if (!t && h === null) delete e.journal[date];
    else e.journal[date] = { texte: t, humeur: h };
    return true;
  }
  const journalDe = (e, semaine) => joursDe(semaine).map((date) => ({ date, ...(e.journal[date] || { texte: '', humeur: null }) }));
  // Humeur de la semaine : moyenne des humeurs du journal ; à défaut, celle notée à la revue.
  function humeurSemaine(e, semaine) {
    const m = moyenne(joursDe(semaine).map((d) => e.journal[d]?.humeur ?? null).filter((x) => x !== null));
    return m ?? revueDe(e, semaine)?.humeur ?? null;
  }

  // ---------- Tendance ----------
  // Point de départ des séries : la semaine en cours si sa revue est faite, sinon la précédente (la semaine en
  // cours ne casse pas la série avant d'être passée).
  const departSerie = (e, jour) => { const cur = cleSemaine(jour); return revueDe(e, cur) ? cur : semaineSuivante(cur, -1); };
  function serie(e, jour) {
    let k = departSerie(e, jour), n = 0;
    while (revueDe(e, k)) { n++; k = semaineSuivante(k, -1); }
    return n;
  }
  function meilleureSerie(e) {
    const ks = revuesTriees(e).map((r) => r.semaine);
    let best = 0, n = 0;
    ks.forEach((k, i) => { n = i && ecartSemaines(ks[i - 1], k) === 1 ? n + 1 : 1; best = Math.max(best, n); });
    return best;
  }
  // Semaines tenues sur les n dernières semaines écoulées (depuis la création de l'outil au plus).
  function tenue(e, jour, n = 12) {
    const fin = departSerie(e, jour);
    const debutOutil = e.creeLe ? cleSemaine(e.creeLe) : fin;
    const total = Math.max(0, Math.min(n, ecartSemaines(debutOutil, fin) + 1));
    let tenues = 0;
    for (let i = 0; i < total; i++) if (revueDe(e, semaineSuivante(fin, -i))) tenues++;
    return { tenues, total, taux: total ? Math.round((tenues / total) * 100) : null };
  }
  // Les n dernières semaines jusqu'à la semaine en cours incluse, de la plus ancienne à la plus récente.
  function historiqueSemaines(e, jour, n = 12) {
    const cur = cleSemaine(jour);
    return Array.from({ length: n }, (_, i) => semaineSuivante(cur, i - n + 1)).map((semaine) => {
      const r = revueDe(e, semaine);
      const jours = journalDe(e, semaine).filter((x) => x.texte || x.humeur);
      return {
        semaine, tenue: Boolean(r), enCours: semaine === cur, avantOutil: Boolean(e.creeLe && dimancheDeCle(semaine) < e.creeLe),
        humeur: humeurSemaine(e, semaine), energie: r?.energie ?? null, priorites: tauxPriorites(prioritesDe(e, semaine)), joursJournal: jours.length,
      };
    });
  }
  const humeurMoyenne = (e, jour, n = 4) => moyenne(historiqueSemaines(e, jour, n).map((s) => s.humeur));
  // Repère bienveillant (pas un diagnostic) : les 3 dernières semaines notées sont toutes à 2 ou moins.
  function semainesDifficiles(e, jour) {
    const notees = historiqueSemaines(e, jour, 6).filter((s) => s.humeur !== null);
    return notees.length >= 3 && notees.slice(-3).every((s) => s.humeur <= 2);
  }

  // ---------- Échéances ----------
  function echeancesAVenir(e, jour, jours = 30) {
    const fin = ajout(jour, jours);
    return e.echeances.filter((x) => !x.fait && x.date >= jour && x.date <= fin).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  const echeancesPassees = (e, jour) => e.echeances.filter((x) => !x.fait && x.date < jour && x.date >= ajout(jour, -14)).sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---------- Questions ----------
  function questionsEtape(e, B, etape) {
    const masquees = new Set(e.questionsMasquees);
    return [...(B.questions[etape] || []).filter((q) => !masquees.has(q)), ...(e.questionsPerso[etape] || [])];
  }
  // Question proposée pour une étape et une semaine : rotation par le numéro de semaine, décalée par
  // « Autre question ». Les étapes sont décalées entre elles pour varier les combinaisons.
  function questionDe(e, B, etape, semaine, decalage = 0) {
    const l = questionsEtape(e, B, etape);
    if (!l.length) return null;
    const k = B.etapes.findIndex((x) => x.id === etape);
    const n = numeroSemaine(semaine) + Number(semaine.slice(0, 4)) + Math.max(0, k) * 3 + decalage;
    return l[((n % l.length) + l.length) % l.length];
  }

  // ---------- Recherche ----------
  function texteDeRevue(r) {
    return [...r.tete, ...r.reussites, ...r.difficultes, r.apprentissages, ...r.priorites.map((p) => p.texte), r.mot, ...Object.values(r.questions || {}).map((q) => q.reponse)].filter(Boolean).join('\n');
  }
  function extrait(texte, terme, largeur = 70) {
    const plat = String(texte).replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ');
    const i = plier(plat).indexOf(plier(terme));
    if (i < 0) return plat.slice(0, largeur * 2);
    const d = Math.max(0, i - largeur), f = Math.min(plat.length, i + terme.length + largeur);
    return `${d ? '…' : ''}${plat.slice(d, f)}${f < plat.length ? '…' : ''}`;
  }
  // Résultats triés du plus récent au plus ancien : revues (par semaine) et jours du journal.
  function rechercher(e, terme) {
    const t = plier(terme).trim();
    if (t.length < 2) return [];
    const res = [];
    for (const r of e.revues) { const txt = texteDeRevue(r); if (plier(txt).includes(t)) res.push({ type: 'revue', id: r.id, semaine: r.semaine, date: dimancheDeCle(r.semaine), extrait: extrait(txt, terme) }); }
    for (const [date, j] of Object.entries(e.journal)) if (plier(j.texte).includes(t)) res.push({ type: 'jour', date, semaine: cleSemaine(date), extrait: extrait(j.texte, terme) });
    return res.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.type === 'revue' ? -1 : 1));
  }

  // ---------- Export texte ----------
  const dateLongue = (s) => versDate(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => versDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const libelleSemaine = (c) => `Semaine ${numeroSemaine(c)}, du ${dateCourte(lundiDeCle(c))} au ${dateCourte(dimancheDeCle(c))} ${dimancheDeCle(c).slice(0, 4)}`;
  const LIB_ETAT = { faite: 'faite', partielle: 'en partie', non: 'pas faite' };

  function texteRevue(e, B, r) {
    const l = [`REVUE · ${libelleSemaine(r.semaine).toUpperCase()}`, `Faite le ${dateLongue(r.date)}`, ''];
    const liste = (titre, items) => { if (items.length) l.push(titre, ...items.map((x) => `- ${x}`), ''); };
    const q = (etape) => { const x = r.questions?.[etape]; if (x?.reponse) l.push(`  ${x.question}`, `  → ${x.reponse}`, ''); };
    liste('Vider la tête', r.tete); q('tete');
    const prev = prioritesDe(e, r.semaine);
    liste('Priorités de la semaine', prev.map((p) => `${p.texte}${p.etat ? ` (${LIB_ETAT[p.etat]})` : ''}`)); q('semaine');
    const jours = journalDe(e, r.semaine).filter((x) => x.texte || x.humeur);
    liste('Journal', jours.map((x) => `${B.jours[jourSemaine(x.date)]} : ${x.texte || ''}${x.humeur ? ` [${B.humeurs[x.humeur]}]` : ''}`.trim()));
    liste('Réussites', r.reussites); liste('Difficultés', r.difficultes); q('bilan');
    if (r.apprentissages) l.push('Apprentissages', r.apprentissages, ''); q('apprentissages');
    liste('Priorités pour la semaine suivante', r.priorites.map((p) => p.texte)); q('priorites');
    liste('Rendez-vous et échéances', e.echeances.filter((x) => x.revue === r.id).map((x) => `${dateCourte(x.date)} : ${x.texte}`)); q('agenda');
    const notes = [r.energie ? `énergie ${r.energie}/5 (${B.energies[r.energie]})` : '', r.humeur ? `humeur ${r.humeur}/5 (${B.humeurs[r.humeur]})` : ''].filter(Boolean).join(', ');
    if (notes || r.mot) l.push(`Énergie et humeur : ${notes || 'non notées'}${r.mot ? ` · mot de la semaine : ${r.mot}` : ''}`, ''); q('energie');
    return l.join('\n').trim() + '\n';
  }
  function texteHistorique(e, B, jour) {
    const t = tenue(e, jour);
    const tete = [`REVUE HEBDOMADAIRE ET JOURNAL DE BORD${e.prenom ? ` · ${e.prenom}` : ''}`, `Export du ${dateLongue(jour)} · ${e.revues.length} revue(s), ${Object.keys(e.journal).length} jour(s) de journal`, `Série en cours : ${serie(e, jour)} semaine(s) · semaines tenues : ${t.tenues} sur ${t.total}`, ''];
    const revues = [...revuesTriees(e)].reverse().map((r) => texteRevue(e, B, r));
    const couvertes = new Set(e.revues.map((r) => r.semaine));
    const seul = Object.keys(e.journal).filter((d) => !couvertes.has(cleSemaine(d))).sort().reverse();
    const journal = seul.length ? ['JOURNAL (semaines sans revue)', ...seul.map((d) => `${dateCourte(d)} ${d.slice(0, 4)} : ${e.journal[d].texte}${e.journal[d].humeur ? ` [${B.humeurs[e.journal[d].humeur]}]` : ''}`), ''] : [];
    return [...tete, ...revues.flatMap((x) => [x, '----------', '']), ...journal].join('\n').trim() + '\n';
  }

  // ---------- Normalisation ----------
  const listeTextes = (l) => (Array.isArray(l) ? l : typeof l === 'string' ? lignes(l) : []).map((x) => String(x).trim()).filter(Boolean);
  function normaliserRevue(r) {
    return {
      id: r.id || nouvelId(), semaine: r.semaine, date: dateValide(r.date) ? r.date : lundiDeCle(r.semaine),
      tete: listeTextes(r.tete), reussites: listeTextes(r.reussites), difficultes: listeTextes(r.difficultes), apprentissages: String(r.apprentissages || ''),
      priorites: (Array.isArray(r.priorites) ? r.priorites : []).filter((p) => p && String(p.texte || '').trim()).slice(0, MAX_PRIORITES).map((p) => ({ id: p.id || nouvelId(), texte: String(p.texte).trim(), etat: ETATS_PRIO.includes(p.etat) ? p.etat : null })),
      energie: noteValide(r.energie) ? r.energie : null, humeur: noteValide(r.humeur) ? r.humeur : null, mot: String(r.mot || ''),
      questions: Object.fromEntries(Object.entries(r.questions || {}).filter(([, q]) => q && q.question).map(([k, q]) => [k, { question: String(q.question), reponse: String(q.reponse || '') }])),
    };
  }
  function normaliserEtat(d, jour) {
    d = d && typeof d === 'object' ? d : {};
    const jr = Number(d.jourRevue);
    const revues = [];
    for (const r of Array.isArray(d.revues) ? d.revues : []) if (r && cleValide(r.semaine) && !revues.some((x) => x.semaine === r.semaine)) revues.push(normaliserRevue(r));
    const journal = {};
    for (const [date, j] of Object.entries(d.journal && typeof d.journal === 'object' ? d.journal : {})) {
      if (!dateValide(date) || !j) continue;
      const texte = String(j.texte || '').slice(0, MAX_LIGNE), humeur = noteValide(j.humeur) ? j.humeur : null;
      if (texte || humeur) journal[date] = { texte, humeur };
    }
    const echeances = (Array.isArray(d.echeances) ? d.echeances : []).filter((x) => x && dateValide(x.date) && String(x.texte || '').trim()).map((x) => ({ id: x.id || nouvelId(), date: x.date, texte: String(x.texte).trim(), fait: Boolean(x.fait), revue: x.revue || null }));
    const perso = {};
    for (const [k, l] of Object.entries(d.questionsPerso || {})) if (Array.isArray(l)) perso[k] = l.map((q) => String(q).trim()).filter(Boolean);
    return {
      ...d, version: 1, prenom: String(d.prenom || ''), jourRevue: Number.isInteger(jr) && jr >= 1 && jr <= 7 ? jr : 5,
      creeLe: dateValide(d.creeLe) ? d.creeLe : jour, revues, journal, echeances, questionsPerso: perso,
      questionsMasquees: Array.isArray(d.questionsMasquees) ? d.questionsMasquees.map(String) : [],
      brouillon: d.brouillon && typeof d.brouillon === 'object' && cleValide(d.brouillon.semaine) ? d.brouillon : null,
    };
  }

  racine.RVH = {
    ETATS_PRIO, MAX_PRIORITES, MAX_LIGNE,
    iso, versDate, ajout, ecart, dateValide, jourSemaine, lundiDe, cleSemaine, cleValide, lundiDeCle, numeroSemaine, semaineSuivante, joursDe, dimancheDeCle, ecartSemaines, nouvelId,
    arrondi1, moyenne, nombreTexte, noteValide, lignes, plier,
    revuesTriees, revueDe, derniereRevue, prioritesDe, etatPrioSuivant, tauxPriorites, rappel, semaineACommencer,
    ecrireJournal, journalDe, humeurSemaine,
    departSerie, serie, meilleureSerie, tenue, historiqueSemaines, humeurMoyenne, semainesDifficiles,
    echeancesAVenir, echeancesPassees, questionsEtape, questionDe, texteDeRevue, extrait, rechercher,
    dateLongue, dateCourte, libelleSemaine, texteRevue, texteHistorique, normaliserRevue, normaliserEtat,
  };
})(typeof window !== 'undefined' ? window : globalThis);
