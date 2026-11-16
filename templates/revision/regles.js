// Planning de révision QME · règles métier pures (aucun accès au DOM ni au stockage).
// Chargé tel quel par le navigateur (window.REVR) et par les tests Node (vm).
// Dates locales « AAAA-MM-JJ », comparables comme des chaînes. L'état est toujours passé en paramètre.
(function (racine) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);

  const matiereDe = (etat, id) => etat.matieres.find((m) => m.id === id);
  const examenFutur = (m, depuis) => (m?.examen && m.examen > depuis ? m.examen : null);
  // Un chapitre « à venir » vient d'un programme importé : pas encore vu en cours, donc pas encore planifié.
  const estVu = (c) => !!c.appris;

  // ---------- Planification (répétition espacée) ----------
  // etape = nombre de révisions réussies ; l'intervalle suivant est intervalles[etape].
  // Après la dernière étape, le chapitre est « maîtrisé » ; s'il a un examen, une révision
  // finale est placée 2 jours avant. Aucune révision n'est placée le jour de l'examen ou après.
  function chargeDu(etat, date, sauf) {
    return etat.chapitres.reduce((n, c) => n + (c.id !== sauf && c.prochaine === date ? 1 : 0), 0);
  }

  function placer(etat, date, depuis, exam, sauf) {
    // Décale d'un ou deux jours si la journée dépasse la charge maximale.
    let d = date;
    for (let i = 0; i < 2 && chargeDu(etat, d, sauf) >= etat.reglages.chargeMax; i++) {
      const suivant = ajout(d, 1);
      if (exam && suivant >= exam) break;
      d = suivant;
    }
    return d;
  }

  function planifier(etat, ch, depuis, etape) {
    const I = etat.reglages.intervalles;
    const exam = examenFutur(matiereDe(etat, ch.matiereId), depuis);
    ch.finale = false;
    if (etape >= I.length) {
      ch.etape = I.length;
      const fin = exam ? ajout(exam, -2) : null;
      if (fin && fin > depuis && !ch.finaleFaite) { ch.prochaine = placer(etat, fin, depuis, exam, ch.id); ch.finale = true; } else ch.prochaine = null;
      return;
    }
    ch.etape = etape;
    let date = ajout(depuis, I[etape]);
    if (exam && date >= exam) date = ajout(exam, -1);
    if (date <= depuis) date = exam && ajout(depuis, 1) >= exam ? null : ajout(depuis, 1);
    ch.prochaine = date ? placer(etat, date, depuis, exam, ch.id) : null;
  }

  const ETAPE_SUIVANTE = { difficile: (e) => Math.max(0, e - 1), moyen: (e) => e + 1, facile: (e) => e + 2 };

  function appliquerEvaluation(etat, ch, ev, date) {
    ch.historique.push({ date, eval: ev, etape: ch.finale ? 'finale' : ch.etape });
    if (ch.finale) { ch.finaleFaite = true; ch.finale = false; ch.prochaine = null; return; }
    planifier(etat, ch, date, ETAPE_SUIVANTE[ev](ch.etape));
  }

  // Replanifie les révisions à venir après un changement d'examen ou de réglages. Les retards restent visibles.
  function replanifier(etat, aujourdhui, filtre = () => true) {
    for (const ch of etat.chapitres.filter((c) => estVu(c) && filtre(c))) {
      if (ch.prochaine && ch.prochaine < aujourdhui) continue;
      const derniere = ch.historique.at(-1)?.date || ch.appris;
      const depuis = derniere > aujourdhui ? aujourdhui : derniere;
      planifier(etat, ch, depuis, ch.etape);
      if (ch.prochaine && ch.prochaine < aujourdhui) ch.prochaine = aujourdhui;
    }
  }

  // Marque un chapitre « à venir » comme vu en cours à la date donnée : sa première révision se planifie.
  function marquerVu(etat, ch, date, aujourdhui) {
    ch.appris = date;
    ch.historique = []; ch.etape = 0; ch.finaleFaite = false;
    planifier(etat, ch, date, 0);
    if (ch.prochaine && ch.prochaine < aujourdhui) ch.prochaine = aujourdhui;
  }

  // ---------- 1. Jauge « Prêt pour le jour J » ----------
  // Un chapitre est « solide » quand il a franchi au moins `seuil` étapes (par défaut J+1, J+3 et J+7 réussis)
  // ou qu'il est maîtrisé. La projection simule le planning jusqu'à la veille de l'examen en supposant
  // chaque révision faite le jour prévu avec la réponse « Moyen » : ce n'est pas une probabilité de réussite.
  const seuilSolide = (etat) => Math.min(3, etat.reglages.intervalles.length);
  const estSolide = (etat, c) => estVu(c) && c.etape >= seuilSolide(etat);

  function jauge(etat, matiereId, aujourdhui) {
    const m = matiereDe(etat, matiereId);
    const chs = etat.chapitres.filter((c) => c.matiereId === matiereId);
    const res = { total: chs.length, aVenir: chs.filter((c) => !estVu(c)).length, solidesAujourdhui: chs.filter((c) => estSolide(etat, c)).length, solidesJourJ: null, revisions: 0, examen: m?.examen || null, jours: null };
    const exam = examenFutur(m, aujourdhui);
    if (!exam) return res;
    res.jours = ecart(aujourdhui, exam);
    // Simulation sur une copie de tout l'état : la charge maximale dépend aussi des autres matières.
    const copie = { ...etat, chapitres: structuredClone(etat.chapitres.filter(estVu)) };
    for (let d = aujourdhui; d < exam; d = ajout(d, 1)) {
      const dus = copie.chapitres.filter((c) => c.prochaine && c.prochaine <= d);
      for (const c of dus) {
        if (c.matiereId === matiereId) res.revisions++;
        appliquerEvaluation(copie, c, 'moyen', d);
      }
    }
    res.solidesJourJ = copie.chapitres.filter((c) => c.matiereId === matiereId && estSolide(etat, c)).length;
    return res;
  }

  // ---------- 2. Plan de rattrapage ----------
  // Répartit les révisions en retard à partir d'aujourd'hui sans dépasser la charge maximale :
  // d'abord les matières dont l'examen est le plus proche, puis les retards les plus anciens.
  // Une révision ne tombe jamais le jour de l'examen ou après ; faute de place, elle reste aujourd'hui.
  function planRattrapage(etat, aujourdhui) {
    const retards = etat.chapitres.filter((c) => c.prochaine && c.prochaine < aujourdhui);
    if (!retards.length) return { affectations: [], jours: [] };
    const examDe = (c) => examenFutur(matiereDe(etat, c.matiereId), aujourdhui) || '9999-12-31';
    retards.sort((a, b) => examDe(a).localeCompare(examDe(b)) || a.prochaine.localeCompare(b.prochaine));
    const ids = new Set(retards.map((c) => c.id));
    const charge = new Map();
    const chargeJour = (d) => {
      if (!charge.has(d)) charge.set(d, etat.chapitres.filter((c) => !ids.has(c.id) && c.prochaine === d).length);
      return charge.get(d);
    };
    const max = etat.reglages.chargeMax;
    const affectations = [];
    for (const c of retards) {
      const exam = examDe(c);
      // Premier jour qui a de la place, sans atteindre l'examen ; sinon la veille de l'examen (ou aujourd'hui).
      let d = aujourdhui;
      for (let i = 0; i < 60 && chargeJour(d) >= max && ajout(d, 1) < exam; i++) d = ajout(d, 1);
      charge.set(d, chargeJour(d) + 1);
      affectations.push({ id: c.id, date: d });
    }
    const parJour = {};
    for (const a of affectations) parJour[a.date] = (parJour[a.date] || 0) + 1;
    const jours = Object.keys(parJour).sort().map((d) => ({ date: d, n: parJour[d] }));
    return { affectations, jours };
  }

  function appliquerRattrapage(etat, plan) {
    for (const a of plan.affectations) {
      const c = etat.chapitres.find((x) => x.id === a.id);
      if (c) c.prochaine = a.date;
    }
  }

  // ---------- 5. Import d'un programme par copier-coller ----------
  // Une ligne = un chapitre. Une ligne qui finit par « : », commence par « # » ou est écrite en
  // majuscules ouvre une nouvelle matière. Puces, numéros et « Chapitre 3 : » sont retirés.
  const PUCE = /^\s*(?:[-*•–—·▪◦>]+|\(?\d+(?:\.\d+)*[.)°]?|\(?[ivxlc]+[.)]|\(?[a-z][.)])\s+/i;
  const PREFIXE = /^(?:chapitre|chap\.?|ch\.?|partie|thème|theme|séquence|sequence|module|leçon|lecon|ue|item)\s*[\divxlc]*\s*[:.\-–—)]?\s*/i;

  function nettoyerLigne(l) {
    let s = String(l).replace(/\t/g, ' ').trim();
    for (let i = 0; i < 3; i++) s = s.replace(PUCE, '').trim();
    const sansPrefixe = s.replace(PREFIXE, '').trim();
    if (sansPrefixe) s = sansPrefixe;
    return s.replace(/\s+/g, ' ').slice(0, 120);
  }

  function estTitreMatiere(brut) {
    const s = String(brut).trim();
    if (/^#+\s*\S/.test(s)) return true;
    if (/:\s*$/.test(s) && s.length <= 70) return true;
    const lettres = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    return lettres.length >= 3 && lettres === lettres.toUpperCase() && s.length <= 60;
  }

  function analyserProgramme(texte) {
    const groupes = [];
    let courant = { matiere: null, chapitres: [] };
    for (const brut of String(texte || '').split(/\r?\n/)) {
      if (!brut.trim()) continue;
      if (estTitreMatiere(brut)) {
        if (courant.matiere || courant.chapitres.length) groupes.push(courant);
        let nom = nettoyerLigne(brut.replace(/^\s*#+/, '').replace(/:\s*$/, ''));
        // « BIOCHIMIE » devient « Biochimie » ; une casse déjà soignée est gardée telle quelle.
        if (nom && nom === nom.toUpperCase()) nom = nom.charAt(0) + nom.slice(1).toLowerCase();
        courant = { matiere: nom || null, chapitres: [] };
        continue;
      }
      const titre = nettoyerLigne(brut);
      if (titre && !courant.chapitres.some((c) => c.toLowerCase() === titre.toLowerCase())) courant.chapitres.push(titre);
    }
    if (courant.matiere || courant.chapitres.length) groupes.push(courant);
    return groupes.filter((g) => g.chapitres.length);
  }

  // ---------- 4. Feuille blanche : comparer le rappel aux mots-clés du chapitre ----------
  const normaliserTexte = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
  const mots = (s) => normaliserTexte(s).split(/[^a-z0-9]+/).filter(Boolean);
  const racineMot = (m) => (m.length > 5 ? m.slice(0, Math.max(5, m.length - 2)) : m);
  const VIDES = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'en', 'au', 'aux', 'a', 'l', 'd', 'par', 'pour', 'sur', 'dans', 'avec', 'the', 'of', 'and']);

  const listeMotsCles = (motsCles) => String(motsCles || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  function comparerRappel(texte, motsCles) {
    const liste = listeMotsCles(motsCles);
    const jetons = mots(texte);
    const present = (cle) => {
      const parties = mots(cle).filter((m) => !VIDES.has(m));
      if (!parties.length) return false;
      return parties.every((p) => jetons.some((j) => j === p || (p.length > 3 && j.startsWith(racineMot(p)))));
    };
    const trouves = liste.filter(present);
    const manques = liste.filter((c) => !trouves.includes(c));
    const taux = liste.length ? trouves.length / liste.length : null;
    const suggestion = taux === null ? null : taux >= 0.8 ? 'facile' : taux >= 0.5 ? 'moyen' : 'difficile';
    return { trouves, manques, taux, suggestion };
  }

  // ---------- 16. Force du souvenir (estimation) ----------
  // Modèle simple et assumé : le souvenir baisse de façon exponentielle depuis la dernière révision et
  // vaut 90 % le jour où le planning reprogramme le chapitre (l'intervalle de son étape).
  function forceSouvenir(etat, c, date) {
    if (!estVu(c)) return null;
    const I = etat.reglages.intervalles;
    const derniere = c.historique.at(-1)?.date || c.appris;
    const t = Math.max(0, ecart(derniere, date));
    const stabilite = c.etape >= I.length ? I.at(-1) * 2 : I[Math.min(c.etape, I.length - 1)];
    return Math.round(100 * Math.pow(0.9, t / Math.max(1, stabilite)));
  }

  // ---------- 17. Examens blancs ----------
  // Pour chaque matière avec une date d'examen : un sujet complet en conditions réelles à J-10 et à J-4.
  const DECALAGES_BLANC = [10, 4];
  const cleBlanc = (matiereId, date) => `${matiereId}|${date}`;

  function examensBlancs(etat, aujourdhui) {
    if (etat.reglages.examensBlancs === false) return [];
    const res = [];
    for (const m of etat.matieres) {
      const exam = examenFutur(m, aujourdhui);
      if (!exam) continue;
      for (const n of DECALAGES_BLANC) {
        const date = ajout(exam, -n);
        const cle = cleBlanc(m.id, date);
        const etatBlanc = etat.blancs?.[cle] || null;
        res.push({ matiereId: m.id, date, cle, etat: etatBlanc, jMoins: n, du: date <= aujourdhui && !etatBlanc });
      }
    }
    return res.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- 13. Régularité et paliers ----------
  const PALIERS = [3, 7, 14, 30, 60, 100, 200];

  function joursRevises(etat) {
    const parJour = {};
    for (const c of etat.chapitres) for (const h of c.historique) parJour[h.date] = (parJour[h.date] || 0) + 1;
    for (const [d, n] of Object.entries(etat.focus || {})) if (n > 0 && !parJour[d]) parJour[d] = 0.5;
    return parJour;
  }

  function serie(etat, aujourdhui) {
    const j = joursRevises(etat);
    let n = 0;
    for (let d = j[aujourdhui] ? aujourdhui : ajout(aujourdhui, -1); j[d]; d = ajout(d, -1)) n++;
    return n;
  }

  function meilleureSerie(etat) {
    const jours = Object.keys(joursRevises(etat)).sort();
    let best = 0, n = 0, prec = null;
    for (const d of jours) { n = prec && ajout(prec, 1) === d ? n + 1 : 1; best = Math.max(best, n); prec = d; }
    return best;
  }

  function paliers(meilleure, actuelle) {
    return { atteints: PALIERS.filter((p) => meilleure >= p), prochain: PALIERS.find((p) => actuelle < p) || null };
  }

  // Bilan d'une semaine glissante (7 jours se terminant à `date`), pour l'image à partager.
  function bilanSemaine(etat, date) {
    const debut = ajout(date, -6);
    const histo = etat.chapitres.flatMap((c) => c.historique.filter((h) => h.date >= debut && h.date <= date));
    const jours = new Set(histo.map((h) => h.date));
    const minutes = Object.entries(etat.focus || {}).filter(([d]) => d >= debut && d <= date).reduce((s, [, n]) => s + n, 0);
    const reussies = histo.filter((h) => h.eval !== 'difficile').length;
    return {
      debut, fin: date, revisions: histo.length, jours: jours.size, minutes,
      taux: histo.length ? Math.round((reussies / histo.length) * 100) : null,
      parJour: Array.from({ length: 7 }, (_, i) => { const d = ajout(debut, i); return { d, n: histo.filter((h) => h.date === d).length }; }),
    };
  }

  // ---------- 14. Export agenda (.ics, RFC 5545) ----------
  const echapperIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function plier(ligne) {
    // Lignes de 75 octets au plus, suite précédée d'une espace.
    const morceaux = [];
    let courant = '';
    for (const car of ligne) {
      if (new TextEncoder().encode(courant + car).length > (morceaux.length ? 74 : 75)) { morceaux.push(courant); courant = car; } else courant += car;
    }
    morceaux.push(courant);
    return morceaux.join('\r\n ');
  }
  const compacte = (d) => d.replace(/-/g, '');

  // Une séance par jour de révision (à l'heure choisie, avec rappel), et les examens sur la journée entière.
  function exportIcs(etat, aujourdhui, { heure = '18:00', jours = 28, horodatage = '20260101T000000Z' } = {}) {
    const [h, mn] = heure.split(':').map(Number);
    const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QME//Planning de revision//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Révisions'];
    const nomM = (c) => matiereDe(etat, c.matiereId)?.nom || 'Sans matière';
    for (let i = 0; i < jours; i++) {
      const d = ajout(aujourdhui, i);
      const liste = etat.chapitres.filter((c) => c.prochaine && (i === 0 ? c.prochaine <= d : c.prochaine === d));
      const blancs = examensBlancs(etat, aujourdhui).filter((b) => b.date === d && !b.etat);
      if (!liste.length && !blancs.length) continue;
      const duree = Math.min(240, Math.max(30, liste.length * 20 + blancs.length * 90));
      const fin = h * 60 + mn + duree;
      const nomsBlancs = blancs.map((b) => matiereDe(etat, b.matiereId)?.nom).join(', ');
      const titre = liste.length ? `Révisions : ${liste.length} chapitre${liste.length > 1 ? 's' : ''}${blancs.length ? ' + examen blanc' : ''}` : `Examen blanc : ${nomsBlancs}`;
      const detail = [...liste.map((c) => `• ${c.titre} (${nomM(c)})`), ...blancs.map((b) => `• Examen blanc : ${matiereDe(etat, b.matiereId)?.nom}`)].join('\n');
      lignes.push('BEGIN:VEVENT', `UID:revision-${compacte(d)}@qm-engineering.fr`, `DTSTAMP:${horodatage}`,
        `DTSTART:${compacte(d)}T${deux(h)}${deux(mn)}00`, `DTEND:${compacte(d)}T${deux(Math.min(23, Math.floor(fin / 60)))}${deux(fin >= 24 * 60 ? 59 : fin % 60)}00`,
        `SUMMARY:${echapperIcs(titre)}`, `DESCRIPTION:${echapperIcs(`${detail}\n\nOuvre ton planning pour noter chaque révision.`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echapperIcs(titre)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
    for (const m of etat.matieres) {
      if (!m.examen || m.examen < aujourdhui) continue;
      lignes.push('BEGIN:VEVENT', `UID:examen-${m.id}-${compacte(m.examen)}@qm-engineering.fr`, `DTSTAMP:${horodatage}`,
        `DTSTART;VALUE=DATE:${compacte(m.examen)}`, `DTEND;VALUE=DATE:${compacte(ajout(m.examen, 1))}`, `SUMMARY:${echapperIcs(`Examen : ${m.nom}`)}`, 'END:VEVENT');
    }
    lignes.push('END:VCALENDAR');
    return lignes.map(plier).join('\r\n') + '\r\n';
  }

  // ---------- Pack Étudiant : données des autres templates sur le même appareil ----------
  // Rapprochement des matières par le nom, sans accents ni casse : mêmes mots, ou tous les mots de l'un
  // présents en mots entiers dans l'autre (« UE1 Biochimie » ↔ « Biochimie », mais pas « Chimie » ↔ « Biochimie »).
  const motsCles2 = (s) => mots(s).filter((m) => !VIDES.has(m));
  function memeMatiere(a, b) {
    const x = motsCles2(a), y = motsCles2(b);
    if (!x.length || !y.length) return false;
    const [court, long] = x.length <= y.length ? [x, y] : [y, x];
    return court.join(' ').length >= 4 && court.every((m) => long.includes(m));
  }

  // 6. Notes et moyennes : moyenne sur 20 de chaque matière et poids de son coefficient dans la moyenne.
  // Seules les notes chiffrées comptent (les notes en lettres et les notes neutralisées sont ignorées).
  function prioritesNotes(etat, notes) {
    if (!notes || !Array.isArray(notes.matieres) || !Array.isArray(notes.notes)) return [];
    const res = [];
    for (const m of etat.matieres) {
      const nm = notes.matieres.filter((x) => memeMatiere(x.nom, m.nom));
      if (!nm.length) continue;
      const ids = new Set(nm.map((x) => x.id));
      const ns = notes.notes.filter((n) => ids.has(n.matiere) && !n.prevue && !n.neutre && typeof n.valeur === 'number' && n.sur > 0);
      const somme = ns.reduce((s, n) => s + n.coef, 0);
      const moyenne = somme ? ns.reduce((s, n) => s + (n.valeur / n.sur) * 20 * n.coef, 0) / somme : null;
      const prevues = notes.notes.filter((n) => ids.has(n.matiere) && n.prevue && n.date).map((n) => n.date).sort();
      res.push({ matiereId: m.id, coef: nm.reduce((s, x) => s + (Number(x.coef) || 0), 0), moyenne, nbNotes: ns.length, prochaine: prevues[0] || null });
    }
    const total = notes.matieres.reduce((s, x) => s + (Number(x.coef) || 0), 0) || 1;
    for (const r of res) {
      r.poids = r.coef / total; // +1 point dans la matière = +poids point sur la moyenne générale
      r.score = r.poids * (r.moyenne === null ? 10 : Math.max(0.5, 20 - r.moyenne));
    }
    return res.sort((a, b) => b.score - a.score);
  }

  // 7. Planner horaire : créneaux libres d'une journée (blocs ponctuels + séries récurrentes).
  function creneauxLibres(planner, date, { minimum = 30, depuis = null } = {}) {
    if (!planner || !Array.isArray(planner.blocs)) return [];
    const jourIdx = (versDate(date).getDay() + 6) % 7;
    const debut = Math.max(planner.reglages?.debut ?? 7 * 60, depuis ?? 0);
    const fin = planner.reglages?.fin ?? 21 * 60;
    const occupes = planner.blocs.filter((b) => b.date === date).map((b) => [b.debut, b.debut + b.duree]);
    for (const s of planner.series || []) {
      if (date < s.depuis || (s.jusqua && date > s.jusqua) || s.exceptions?.[date] || !s.jours?.includes(jourIdx)) continue;
      occupes.push([s.debut, s.debut + s.duree]);
    }
    occupes.sort((a, b) => a[0] - b[0]);
    const libres = [];
    let t = debut;
    for (const [a, b] of occupes) {
      if (a > t && Math.min(a, fin) - t >= minimum) libres.push({ debut: t, fin: Math.min(a, fin) });
      t = Math.max(t, b);
    }
    if (fin - t >= minimum) libres.push({ debut: t, fin });
    return libres;
  }

  // 8. Habitudes : sommeil de la nuit (heures saisies ce jour-là) et réussite des révisions du même jour.
  // Ne conclut rien sous 10 jours renseignés, ni sous 3 jours dans chaque groupe.
  function sommeilEtReussite(etat, habitudes, { seuil = 7, cle = 'sommeil-heures' } = {}) {
    if (!habitudes || !habitudes.journal) return null;
    const parJour = {};
    for (const c of etat.chapitres) for (const h of c.historique) {
      parJour[h.date] ||= { n: 0, ok: 0 };
      parJour[h.date].n++;
      if (h.eval !== 'difficile') parJour[h.date].ok++;
    }
    const groupes = { court: { jours: 0, n: 0, ok: 0 }, long: { jours: 0, n: 0, ok: 0 } };
    for (const [d, r] of Object.entries(parJour)) {
      const h = habitudes.journal[d]?.[cle];
      if (typeof h !== 'number') continue;
      const g = groupes[h < seuil ? 'court' : 'long'];
      g.jours++; g.n += r.n; g.ok += r.ok;
    }
    const total = groupes.court.jours + groupes.long.jours;
    const taux = (g) => (g.n ? Math.round((g.ok / g.n) * 100) : null);
    return { seuil, total, suffisant: total >= 10 && groupes.court.jours >= 3 && groupes.long.jours >= 3,
      court: { ...groupes.court, taux: taux(groupes.court) }, long: { ...groupes.long, taux: taux(groupes.long) } };
  }

  racine.REVR = {
    iso, versDate, ajout, ecart, examenFutur, estVu,
    chargeDu, placer, planifier, appliquerEvaluation, replanifier, marquerVu, ETAPE_SUIVANTE,
    seuilSolide, estSolide, jauge, planRattrapage, appliquerRattrapage,
    nettoyerLigne, estTitreMatiere, analyserProgramme,
    normaliserTexte, listeMotsCles, comparerRappel, forceSouvenir,
    examensBlancs, cleBlanc, DECALAGES_BLANC,
    PALIERS, joursRevises, serie, meilleureSerie, paliers, bilanSemaine,
    exportIcs, memeMatiere, prioritesNotes, creneauxLibres, sommeilEtReussite,
  };
})(typeof window !== 'undefined' ? window : globalThis);
