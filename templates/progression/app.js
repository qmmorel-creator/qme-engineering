// Progression pédagogique QME : calendrier de l'année (vacances saisies, jours fériés calculés), classes et
// groupes avec leurs créneaux (semaines A et B), séquences ordonnées avec objectifs et durée prévue, séances
// consignées (faite, prévue, reportée, annulée), avancement réel face au prévu, retard, date de fin projetée,
// frise des séquences avec fenêtres (jalons à plage), cahier de textes imprimable, duplication, export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PRG;
  const API = '/api/templates';
  const PRODUIT = 'PRG';
  const CLE_CODE = 'qme-prg-code';
  const CLE_CACHE = 'qme-prg-cache';
  const CLE_DEMO = 'qme-prg-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-prg-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${String(n).replace('.', ',')} ${Math.abs(n) >= 2 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => (s ? fmt(s, { day: 'numeric', month: 'long', year: 'numeric' }) : '…');
  const dateCourte = (s) => (s ? fmt(s, { day: 'numeric', month: 'short' }) : '…');
  const dateJour = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const h = (n) => R.heures(n);
  const nb = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const quand = (s) => { const n = ecart(s, auj()); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : n === -1 ? 'demain' : n > 0 ? `il y a ${pluriel(n, 'jour')}` : `dans ${pluriel(-n, 'jour')}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const filtre = { prog: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const annee = () => E.annees.find((a) => a.id === E.anneeId) || null;
  const progsAnnee = () => E.progressions.filter((p) => p.anneeId === E.anneeId);
  const prog = (id) => E.progressions.find((p) => p.id === id);
  const sequence = (id) => E.sequences.find((s) => s.id === id);
  const seance = (id) => E.seances.find((s) => s.id === id);
  const nomProg = (p) => (p ? `${p.nom}${p.matiere ? ` · ${p.matiere}` : ''}` : 'Classe supprimée');
  const couleur = (p) => B.couleurs[(p?.couleur || 0) % B.couleurs.length];
  const progChoisie = () => { const l = progsAnnee(); return (l.find((p) => p.id === filtre.prog) || l[0])?.id || ''; };
  // Calculs mis en mémoire pendant un rendu (contexte du calendrier, bilans des classes).
  let memo = null;
  const oublier = () => { memo = null; };
  const ctx = () => { if (!memo) memo = { ctx: R.contexte(annee(), E.reglages), bilans: {} }; return memo.ctx; };
  const bilanDe = (pid) => { ctx(); if (!memo.bilans[pid]) memo.bilans[pid] = R.bilan(E, prog(pid), memo.ctx, auj()); return memo.bilans[pid]; };

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }

  function sauver() {
    oublier();
    cache(true);
    if (session.demo) return;
    majSync('attente');
    clearTimeout(minuterie);
    minuterie = setTimeout(envoyer, 600);
  }

  async function appel(chemin, options = {}) {
    const r = await fetch(API + chemin, { ...options, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(options.headers || {}) } });
    let corps = null;
    try { corps = await r.json(); } catch { /* corps vide */ }
    return { statut: r.status, corps };
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false); oublier();
        rendre();
        toast('Un autre appareil a modifié ta progression entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Trop de données pour un seul compte : exporte puis supprime une année terminée (onglet Calendrier).');
        throw new Error('413');
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        cache(false);
      }
      majSync('ok');
    } catch {
      majSync('horsligne');
    } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; envoyer(); }
    }
  }

  async function rafraichir() {
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false); oublier();
        if (!modale().open) rendre();
      }
    } catch { majSync('horsligne'); }
  }

  function majSync(etat) {
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Code interne (PRG-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
  // 3 lettres dont au moins une hors de A–F, ce qu'une clé Gumroad hexadécimale ne peut pas être.
  const estCodeInterne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (estCodeInterne(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    // Clé d'un autre template : ne jamais écrire nos données dans son espace.
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; oublier();
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Enseignant et formateur fictifs : une classe de collège (créneau du vendredi en semaine A seulement),
  // une classe de lycée dont le programme ne tient plus, un groupe de formation continue en avance.
  // Calendrier fictif relatif à aujourd'hui (vacances inventées, fériés calculés). Historique simulé avec
  // les vraies règles : séances faites, annulées, reportées, créneaux passés non renseignés, séances
  // préparées, séquences terminées, en cours et à venir, fenêtres dans la plage, avant et dépassée,
  // séquence sans objectifs, objectif à préciser.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const sc = R.anneeScolaire(t);
    const debut = ecart(sc.debut, t) >= 60 ? sc.debut : j(-75);
    const fin = ajout(debut, 302);
    const ouvre = (d) => { let x = d; while (R.jourSemaine(x) > 5) x = ajout(x, 1); return x; };
    const vac = (nom, d) => { const a = ajout(R.lundi(d), -2); return { nom, type: 'vacances', debut: a, fin: ajout(a, 15) }; };
    const an = R.normaliserAnnee({ id: uid(), nom: sc.nom, debut, fin, fermetures: [
      vac('Vacances d\'automne', j(-24)), vac('Vacances de fin d\'année', j(37)), vac('Vacances d\'hiver', j(100)), vac('Vacances de printemps', j(156)),
      { nom: 'Journée pédagogique', type: 'ferme', debut: ouvre(j(-40)), fin: ouvre(j(-40)) },
      { nom: 'Journée banalisée', type: 'ferme', debut: ouvre(j(10)), fin: ouvre(j(10)) },
    ] });
    e.annees.push(an); e.anneeId = an.id;
    const c = R.contexte(an, e.reglages);
    const travaux = ['Exercices de la fiche', '', 'Revoir la trace écrite', '', 'Terminer l\'activité commencée', 'Préparer les questions du dossier', ''];
    const etape = (f) => B.etapes[f < 0.1 ? 0 : f < 0.3 ? 1 : f < 0.45 ? 2 : f < 0.75 ? 3 : f < 0.88 ? 4 : 5];
    let k = 0;

    const classe = (x, sequences, total, sim) => {
      const p = R.normaliserProgression({ id: uid(), anneeId: an.id, couleur: e.progressions.length, ...x });
      e.progressions.push(p);
      const dispo = R.somme(R.creneaux(p, c));
      const poids = sequences.reduce((s, q) => s + q.p, 0);
      const seqs = sequences.map((q, i) => R.normaliserSequence({ id: uid(), progressionId: p.id, ordre: i + 1, titre: q.titre, objectifs: q.objectifs || [], competences: q.competences || '', heures: Math.max(1, R.demi(dispo * total * q.p / poids)), note: q.note || '' }));
      e.sequences.push(...seqs);
      // Historique : chaque créneau passé devient une séance (sauf les derniers, laissés à renseigner).
      const passes = R.creneaux(p, c, null, sim.aujourdhui ? t : j(-1));
      const garder = passes.slice(0, passes.length - (sim.vides || 0));
      let cur = 0, cumul = 0;
      garder.forEach((cr, i) => {
        const q = seqs[cur];
        const base = { id: uid(), progressionId: p.id, date: cr.date, duree: cr.duree, cree: `${cr.date}T08:00:00.000Z` };
        const r = sim.annulees?.[i];
        if (r) { e.seances.push(R.normaliserSeance({ ...base, statut: 'annulee', motif: r, sequenceId: q?.id || null })); return; }
        if (!q) return;
        const besoin = q.heures * (sim.facteurs?.[cur] || 1);
        if (sim.reportees?.includes(i)) { e.seances.push(R.normaliserSeance({ ...base, statut: 'reportee', motif: 'Absence', sequenceId: q.id, contenu: etape(cumul / besoin) })); return; }
        e.seances.push(R.normaliserSeance({ ...base, statut: 'faite', sequenceId: q.id, contenu: etape(cumul / besoin), travail: travaux[k++ % travaux.length] }));
        cumul += cr.duree;
        if (cumul >= besoin - 1e-9) { q.terminee = cr.date; cur++; cumul = 0; }
      });
      // Séances préparées pour les prochains créneaux.
      const q = seqs[cur];
      R.creneaux(p, c, j(1)).slice(0, sim.prevues || 0).forEach((cr, i) => {
        e.seances.push(R.normaliserSeance({ id: uid(), progressionId: p.id, sequenceId: q?.id || null, date: cr.date, duree: cr.duree, statut: 'prevue', contenu: i ? 'Entraînement par groupes de besoin' : 'Correction de l\'évaluation et bilan', travail: i ? '' : 'Apporter le matériel de géométrie' }));
      });
      return { p, seqs };
    };

    const c4 = classe({ nom: '4e B', matiere: 'Mathématiques', public: 'Collège', creneaux: [{ jour: 1, duree: 1 }, { jour: 2, duree: 1 }, { jour: 4, duree: 1 }, { jour: 5, duree: 1, semaine: 'A' }] }, [
      { titre: 'Nombres relatifs', p: 11, objectifs: ['Calculer une somme et une différence de nombres relatifs', 'Calculer un produit et un quotient de nombres relatifs', 'Expliquer la règle des signes avec ses mots'], competences: 'Calculer, raisonner' },
      { titre: 'Fractions', p: 13, objectifs: ['Comparer deux fractions', 'Calculer avec des fractions', 'Résoudre un problème qui mobilise des fractions'], competences: 'Calculer, modéliser' },
      { titre: 'Puissances', p: 9, objectifs: ['Utiliser les puissances de 10 pour écrire un nombre', 'Connaître les règles de calcul sur les puissances'], competences: 'Calculer' },
      { titre: 'Calcul littéral', p: 13, objectifs: ['Développer et réduire une expression littérale', 'Justifier qu\'une égalité est vraie ou fausse'], competences: 'Calculer, raisonner, communiquer' },
      { titre: 'Théorème de Pythagore', p: 13, objectifs: ['Calculer une longueur dans un triangle rectangle', 'Démontrer qu\'un triangle est rectangle ou non', 'Rédiger une démonstration courte'], competences: 'Raisonner, communiquer', note: 'Évaluation commune avec les autres classes du niveau.' },
      { titre: 'Proportionnalité', p: 11, objectifs: ['Reconnaître une situation de proportionnalité', 'Calculer une quatrième proportionnelle', 'Appliquer un pourcentage'], competences: 'Modéliser, calculer' },
      { titre: 'Statistiques', p: 9 },
      { titre: 'Géométrie dans l\'espace', p: 11, objectifs: ['Représenter une pyramide et un cône', 'Calculer le volume d\'un solide'], competences: 'Représenter, calculer' },
      { titre: 'Révisions et bilan', p: 10, objectifs: ['Choisir une méthode adaptée à un problème', 'Évaluer son travail à l\'aide d\'une grille'], competences: 'Toutes' },
    ], 0.92, { aujourdhui: true, facteurs: { 1: 1.1 }, annulees: { 9: 'Sortie ou voyage' }, reportees: [17], vides: 2, prevues: 2 });

    const c1 = classe({ nom: '1re G2', matiere: 'Histoire-géographie', public: 'Lycée', creneaux: [{ jour: 2, duree: 2 }, { jour: 5, duree: 1 }] }, [
      { titre: 'Histoire 1 · Un monde en mutation', p: 11, objectifs: ['Situer les grandes étapes d\'une période', 'Analyser un document en le confrontant à ses connaissances'], competences: 'Se repérer dans le temps, analyser un document' },
      { titre: 'Géographie 1 · Dynamiques des espaces', p: 11, objectifs: ['Décrire une organisation spatiale à partir d\'une carte', 'Réaliser un croquis simple'], competences: 'Se repérer dans l\'espace, réaliser un croquis' },
      { titre: 'Histoire 2 · Ruptures et continuités', p: 12, objectifs: ['Comprendre les enjeux d\'une période', 'Rédiger un paragraphe argumenté'], competences: 'Raisonner, rédiger' },
      { titre: 'Géographie 2 · Territoires et acteurs', p: 12, objectifs: ['Comparer deux territoires', 'Justifier un choix d\'aménagement'], competences: 'Analyser, argumenter', note: 'À terminer avant l\'examen blanc.' },
      { titre: 'Histoire 3 · Sociétés et cultures', p: 12, objectifs: ['Expliquer un changement social à partir de documents'], competences: 'Analyser un document' },
      { titre: 'Géographie 3 · Mobilités', p: 11, objectifs: ['Schématiser des flux', 'Interpréter une carte par anamorphose'], competences: 'Représenter, analyser' },
      { titre: 'Histoire 4 · Mémoires', p: 11, objectifs: ['Distinguer histoire et mémoire', 'Argumenter à l\'oral'], competences: 'Raisonner, s\'exprimer à l\'oral' },
      { titre: 'Méthodes et révisions', p: 9, objectifs: ['Planifier une réponse organisée', 'Vérifier sa production avec une grille'], competences: 'Toutes' },
    ], 1.07, { facteurs: { 0: 0.8 }, annulees: { 6: 'Examen ou épreuve' }, vides: 1, prevues: 1 });

    const ft = classe({ nom: 'Groupe du mercredi', matiere: 'Tableur', public: 'Formation continue', fin: j(118), creneaux: [{ jour: 3, duree: 3 }] }, [
      { titre: 'Accueil et positionnement', p: 6, objectifs: ['Situer son niveau à l\'aide d\'un questionnaire', 'Formuler ses objectifs de formation'] },
      { titre: 'Module 1 · Saisie et mise en forme', p: 18, objectifs: ['Saisir et mettre en forme un tableau', 'Utiliser les formats de nombre et de date'] },
      { titre: 'Module 2 · Formules et fonctions', p: 22, objectifs: ['Écrire une formule avec des références relatives et absolues', 'Utiliser les fonctions de calcul courantes'] },
      { titre: 'Module 3 · Tris, filtres et synthèses', p: 22, objectifs: ['Trier et filtrer une liste', 'Construire un tableau de synthèse'] },
      { titre: 'Module 4 · Graphiques', p: 16, objectifs: ['Choisir un graphique adapté aux données', 'Créer un tableau de bord simple'] },
      { titre: 'Évaluation finale et bilan', p: 16, objectifs: ['Réaliser un cas pratique complet', 'Évaluer sa progression depuis le positionnement'] },
    ], 0.88, { facteurs: { 0: 0.6, 1: 0.85, 2: 0.85 }, vides: 0, prevues: 1 });

    // Fenêtres (jalons à plage) placées d'après la projection : dans la plage, avant, dépassée.
    const placer = (cl, i, de, a) => { const b = R.bilan(e, cl.p, c, t); const f = b.sequences[i].fin || fin; cl.seqs[i].fenetre = { debut: ajout(f, de), fin: ajout(f, a) }; };
    placer(c4, 4, -6, 9);
    placer(c1, 3, -24, -10);
    placer(ft, 3, 10, 24);
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Progression pédagogique · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="300" y="40" width="240" height="240" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="320" y="70" width="90" height="26" fill="#1D4E89"/>
          <rect x="380" y="120" width="110" height="26" fill="#D9302A"/>
          <rect x="440" y="170" width="80" height="26" fill="#F5B400"/>
          <rect x="320" y="220" width="200" height="26" fill="none" stroke="#141414" stroke-width="4"/>
          <rect x="190" y="180" width="80" height="80" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Progression pédagogique</p>
          <h1>Ton programme, séance après séance.</h1>
          <p>Séquences, objectifs et heures prévues posés sur ton vrai calendrier, séances consignées en un geste : l'avancement, le retard et la date de fin projetée se calculent seuls, jusqu'à la fin de l'année.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta progression</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta progression est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma progression</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/progression/">Voir la progression pédagogique</a>. La démo, avec des classes fictives, reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const pos = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (pos) champ.setSelectionRange(champ.value.length, champ.value.length);
    });
    $('#form-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = formaterCode(champ.value);
      const err = $('#erreur-code');
      const bouton = e.target.querySelector('button[type=submit]');
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma progression'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => { const sc = R.anneeScolaire(auj()); const t = auj(); return { etape: 1, debut: sc.debut, fin: sc.fin, suivi: t > sc.debut && t < sc.fin ? t : '', nom: '', matiere: '', jours: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' } }; };
  let accueil = accueilVide();
  const optionsDuree = (val, vide = true) => `${vide ? '<option value="">—</option>' : ''}${B.durees.map((d) => `<option value="${d}" ${Number(val) === d ? 'selected' : ''}>${h(d)}</option>`).join('')}`;

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton programme, séance après séance.</h1>
        <p class="intro">Tu poses tes séquences sur ton vrai calendrier : vacances, jours fériés et créneaux de chaque classe. Après chaque cours, un geste suffit : l'outil te dit où tu en es par rapport au prévu et si le programme tiendra jusqu'à la fin de l'année.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="aide" style="margin-top:20px">Aucune donnée d'élève : la progression planifie le contenu de tes cours, pas tes élèves.</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton année et ta première classe</h1>
        <p class="intro">Les vacances de ta zone et les autres classes s'ajoutent ensuite dans l'onglet Calendrier. Les jours fériés sont déjà calculés.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Début des cours<input type="date" id="a-debut" value="${a.debut}"></label>
            <label class="champ">Fin des cours<input type="date" id="a-fin" value="${a.fin}"></label>
          </div>
          <label class="champ">Suivi à partir du<small>L'année a déjà commencé ? Les cours passés ne sont pas comptés : tu planifies ce qui reste à faire. Vide : depuis le début des cours.</small><input type="date" id="a-suivi" value="${a.suivi}"></label>
          <div class="rang-champs">
            <label class="champ">Classe ou groupe<small>Ex. : 4e B, 1re G2, groupe du mardi.</small><input id="a-nom" value="${esc(a.nom)}" maxlength="40" placeholder="4e B"></label>
            <label class="champ">Matière ou module<small>Facultatif.</small><input id="a-matiere" value="${esc(a.matiere)}" maxlength="40" placeholder="Mathématiques"></label>
          </div>
          <fieldset><legend>Ses créneaux chaque semaine <small>Durée du cours, jour par jour. Les semaines A et B se règlent ensuite.</small></legend>
            <div class="jours-accueil">${[1, 2, 3, 4, 5, 6].map((d) => `<label class="champ">${B.jours[d]}<select data-jour="${d}">${optionsDuree(a.jours[d])}</select></label>`).join('')}</div></fieldset>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma progression</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-matiere', 'matiere'); lier('#a-debut', 'debut'); lier('#a-fin', 'fin'); lier('#a-suivi', 'suivi');
    document.querySelectorAll('[data-jour]').forEach((el) => el.addEventListener('change', () => { accueil.jours[el.dataset.jour] = el.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    if (!R.estDate(a.debut) || !R.estDate(a.fin) || a.fin <= a.debut) return ecranAccueil('Vérifie les dates : la fin des cours vient après leur début.');
    if (a.suivi && (!R.estDate(a.suivi) || a.suivi < a.debut || a.suivi > a.fin)) return ecranAccueil('La date de début du suivi doit être comprise dans l\'année.');
    if (!a.nom.trim()) return ecranAccueil('Indique le nom de ta première classe ou de ton groupe.');
    const creneaux = Object.entries(a.jours).filter(([, d]) => d).map(([jour, duree]) => ({ jour: Number(jour), duree: Number(duree) }));
    if (!creneaux.length) return ecranAccueil('Choisis au moins un créneau (la durée du cours sur un jour).');
    E = etatVide();
    const sc = R.anneeScolaire(a.debut);
    const an = R.normaliserAnnee({ id: uid(), nom: sc.nom, debut: a.debut, fin: a.fin });
    E.annees.push(an); E.anneeId = an.id;
    const p = R.normaliserProgression({ id: uid(), anneeId: an.id, nom: a.nom, matiere: a.matiere, creneaux, couleur: 0, debut: a.suivi && a.suivi > a.debut ? a.suivi : null, refA: a.suivi && a.suivi > a.debut ? a.debut : null });
    E.progressions.push(p);
    filtre.prog = p.id;
    accueil = accueilVide();
    vue = 'sequences';
    sauver();
    demarrer();
    toast('Ta progression est créée. Ajoute les vacances de ta zone dans l\'onglet Calendrier.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    seances: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="3" fill="currentColor"/><rect x="3" y="10.5" width="12" height="3" fill="currentColor"/><rect x="3" y="17" width="15" height="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sequences: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    frise: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['seances', 'Séances'], ['sequences', 'Séquences'], ['frise', 'Frise'], ['calendrier', 'Calendrier']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil personnel de planification : il calcule à partir de ton calendrier et de tes saisies (vacances saisies par toi, jours fériés calculés, créneaux, séances consignées). Il ne contient aucun programme officiel et ne remplace pas le cahier de textes de ton établissement. Aucune donnée d\'élève.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const STATUT_NOM = Object.fromEntries(B.statuts.map((s) => [s.code, s.nom]));
  const STATUT_COUL = { faite: 'ciel', prevue: 'sable', reportee: 'jaune', annulee: 'rouge' };
  const ETAT_SEQ = { terminee: ['ciel', 'Terminée'], 'en-cours': ['jaune', 'En cours'], 'a-venir': ['sable', 'À venir'] };
  const pastilleBloom = (o) => { const r = R.analyserObjectif(o, B); return r.niveau ? `<span class="bloom b${r.niveau}" title="${esc(B.bloom[r.niveau - 1].nom)}">${r.niveau}</span>` : r.vague ? '<span class="bloom vague" title="Verbe difficile à observer : à préciser">?</span>' : '<span class="bloom inconnu" title="Verbe non reconnu dans la banque">·</span>'; };
  const etiquettePlage = (pl) => (pl ? `<span class="etiquette ${pl.code === 'depasse' ? 'rouge' : pl.code === 'dans' ? 'ciel' : 'sable'}">${pl.code === 'depasse' ? `Fenêtre dépassée${pl.jours ? ` de ${pluriel(pl.jours, 'jour')}` : ''}` : pl.code === 'dans' ? 'Dans sa fenêtre' : `Avant sa fenêtre (${pluriel(pl.jours, 'jour')})`}</span>` : '');
  const texteRetard = (b) => (Math.abs(b.retard) < 0.25 ? 'À l\'heure' : b.retard > 0 ? `${h(b.retard)} de retard (≈ ${pluriel(b.retardSeances, 'séance')})` : `${h(-b.retard)} d'avance (≈ ${pluriel(-b.retardSeances, 'séance')})`);
  const creneauxTexte = (p) => p.creneaux.map((c) => `${B.joursCourts[c.jour]} ${h(c.duree)}${c.semaine !== 'toutes' ? ` (sem. ${c.semaine})` : ''}`).join(' · ') || 'aucun créneau';

  function demarrer() {
    document.body.classList.add('app');
    oublier();
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/progression/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Classes et calendrier fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Progression<br>pédagogique</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}${id === 'bord' ? '<span class="long">Tableau de bord</span><span class="court">Accueil</span>' : `<span>${nom}</span>`}</button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    oublier();
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Progression pédagogique`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, seances: vueSeances, sequences: vueSequences, frise: vueFrise, calendrier: vueCalendrier }[vue]();
    $('#filtre-prog')?.addEventListener('change', (e) => { filtre.prog = e.target.value; rendre(); });
    $('#filtre-annee')?.addEventListener('change', (e) => { if (e.target.value === '+') { e.target.value = E.anneeId; modaleAnnee(null); return; } E.anneeId = e.target.value; filtre.prog = ''; sauver(); rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function choixProg() {
    const l = progsAnnee();
    if (!l.length) return '';
    const pid = progChoisie();
    return `<label class="champ choix-classe"><span class="sr-only">Classe ou groupe</span><select id="filtre-prog">${l.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(nomProg(p))}</option>`).join('')}</select></label>`;
  }
  function choixAnnee() {
    const l = [...E.annees].sort((a, b) => b.debut.localeCompare(a.debut));
    return `<label class="champ choix-annee"><span class="sr-only">Année</span><select id="filtre-annee">${l.map((a) => `<option value="${a.id}" ${a.id === E.anneeId ? 'selected' : ''}>Année ${esc(a.nom)}</option>`).join('')}<option value="+">Nouvelle année…</option></select></label>`;
  }
  const sansAnnee = (titre) => `${titre}${videEtat('Aucune année', 'Crée ton année : ses dates, ses vacances et ses jours sans cours donnent les heures réellement disponibles.', `<button class="btn primaire" data-action="annee">${ICONES.plus}Nouvelle année</button>`)}${AVERTISSEMENT}`;
  const sansProg = (titre) => `${titre}${videEtat('Aucune classe cette année', 'Ajoute une classe ou un groupe avec ses créneaux de la semaine.', `<button class="btn primaire" data-action="progression">${ICONES.plus}Nouvelle classe ou groupe</button>`)}${AVERTISSEMENT}`;
  const tuile = ([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;

  // ---------- Tableau de bord ----------
  function vueBord() {
    const a = annee();
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${a ? `Année ${esc(a.nom)} · ${esc(dateJour(t))}${R.ferme(ctx(), t) ? ` · ${esc(R.ferme(ctx(), t).nom)}` : ''}` : 'Où tu en es dans chaque classe.'}</p></div>
        <div class="actions">${E.annees.length ? choixAnnee() : ''}${a && progsAnnee().length ? `<button class="btn primaire" data-action="seance">${ICONES.plus}Consigner une séance</button>` : ''}</div></div>`;
    if (!a) return sansAnnee(titre);
    const ps = progsAnnee();
    if (!ps.length) return sansProg(titre);
    const bs = ps.map((p) => bilanDe(p.id));
    const alertes = [];
    if (!a.fermetures.some((x) => x.type === 'vacances')) alertes.push({ etat: 'proche', date: t, titre: 'Aucune période de vacances saisie', detail: 'Les heures disponibles sont surestimées tant que les vacances de ta zone ne sont pas dans le calendrier.', bouton: '<button class="btn petit" data-action="vue" data-vue="calendrier">Calendrier</button>' });
    for (const b of bs) {
      const p = b.progression;
      if (b.nonRenseignes.length) alertes.push({ etat: 'retard', date: b.nonRenseignes[b.nonRenseignes.length - 1].date, titre: `${pluriel(b.nonRenseignes.length, 'créneau passé', 'créneaux passés')} à renseigner`, detail: `${nomProg(p)} · faite, reportée ou annulée ? L'avancement en dépend.`, bouton: `<button class="btn petit" data-action="renseigner" data-id="${p.id}">Renseigner</button>` });
      if (!b.sequences.length) alertes.push({ etat: 'avenir', date: t, titre: 'Aucune séquence', detail: `${nomProg(p)} · pose tes séquences ou pars d'un modèle.`, bouton: `<button class="btn petit" data-action="aller-sequences" data-id="${p.id}">Séquences</button>` });
      else if (!b.tient) alertes.push({ etat: 'retard', date: p.fin || a.fin, titre: 'Le programme ne tient pas', detail: `${nomProg(p)} · il manque ${h(-b.marge)} (≈ ${pluriel(-b.margeSeances, 'séance')}) avant la fin des cours, le ${dateLongue(p.fin || a.fin)}.`, bouton: `<button class="btn petit" data-action="aller-sequences" data-id="${p.id}">Ajuster</button>` });
      for (const l of b.sequences) if (l.plage?.code === 'depasse' && !l.terminee) alertes.push({ etat: 'proche', date: l.sequence.fenetre.fin, titre: `Fenêtre dépassée : ${l.sequence.titre}`, detail: `${nomProg(p)} · à terminer au plus tard le ${dateLongue(l.sequence.fenetre.fin)}, fin projetée ${l.fin ? `le ${dateLongue(l.fin)}` : 'après la fin des cours'}.`, bouton: `<button class="btn petit" data-action="aller-frise" data-id="${p.id}">Frise</button>` });
    }
    const aRens = bs.reduce((s, b) => s + b.nonRenseignes.length, 0);
    const pire = [...bs].filter((b) => b.sequences.length).sort((x, y) => y.retard - x.retard)[0];
    const faitesH = R.somme(E.seances.filter((s) => s.statut === 'faite' && ps.some((p) => p.id === s.progressionId)));
    const tuiles = [
      ['Classes et groupes', String(ps.length), `${h(ps.reduce((s, p) => s + R.heuresHebdo(p), 0))} par semaine`, 'var(--bleu)', 'rond'],
      ['Heures faites', h(faitesH), `sur ${h(bs.reduce((s, b) => s + b.dispo, 0))} de cours dans l'année`, 'var(--jaune)', ''],
      ['Plus fort retard', pire && pire.retard > 0.24 ? h(pire.retard) : '0 h', pire && pire.retard > 0.24 ? esc(pire.progression.nom) : 'tout est à l\'heure', 'var(--rouge)', 'rond'],
      ['À renseigner', String(aRens), aRens ? 'créneaux passés sans séance' : 'tout est consigné', 'var(--encre)', ''],
    ].map(tuile).join('');
    // Prochains créneaux, toutes classes confondues.
    const prochains = bs.flatMap((b) => b.avenir.slice(0, 6).map((c) => ({ ...c, b }))).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 6);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${alertes.length ? `<section><h2 class="titre-section">À regarder <span>${pluriel(alertes.length, 'point')}</span></h2><ul class="alertes-liste">${alertes.map(ligneAlerte).join('')}</ul></section>` : ''}
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Mes classes <span>avancement réel et attendu aujourd'hui</span></h2><ul class="mini-progs">${bs.map(carteBilan).join('')}</ul></section>
        <section><h2 class="titre-section">Prochains cours</h2>${prochains.length ? `<ul class="alertes-liste prochains-cours">${prochains.map(ligneProchain).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Plus de cours à venir</h3><p>La fin des cours est passée pour toutes les classes.</p></div></div>'}</section>
      </div>
      ${AVERTISSEMENT}`;
  }

  const pastilleDate = (d, alerte = false) => `<span class="date-pastille ${alerte ? 'alerte' : ''}"><b>${versDate(d).getDate()}</b>${fmt(d, { month: 'short' }).replace('.', '')}</span>`;
  function ligneAlerte(x) {
    const etiq = { retard: '<span class="etiquette rouge">À traiter</span>', proche: '<span class="etiquette jaune">À vérifier</span>', avenir: '<span class="etiquette ciel">À préparer</span>' }[x.etat];
    return `<li class="${x.etat}">${pastilleDate(x.date, x.etat === 'retard')}<div class="lien-ligne"><b>${esc(x.titre)}</b><span>${esc(x.detail)}</span></div><span class="alerte-droite">${etiq}${x.bouton}</span></li>`;
  }
  // Séquence qui occupera un créneau à venir d'après la projection.
  const sequenceA = (b, date) => (b.sequences.find((l) => !l.terminee && l.reste > 0 && l.debutProjete && l.debutProjete <= date && (!l.fin || l.fin >= date)) || b.courante)?.sequence || null;
  function ligneProchain(c) {
    const p = c.b.progression;
    const s = E.seances.find((x) => x.progressionId === p.id && x.date === c.date && x.statut === 'prevue');
    const q = s ? sequence(s.sequenceId) : sequenceA(c.b, c.date);
    return `<li class="avenir" style="--c:${couleur(p)}">${pastilleDate(c.date)}<div class="lien-ligne"><b>${esc(nomProg(p))} · ${h(c.duree)}</b><span>${q ? esc(q.titre) : 'Hors séquence'}${s?.contenu ? ` · ${esc(s.contenu)}` : ''} · ${quand(c.date)}</span></div>
      <span class="alerte-droite">${s ? '<span class="etiquette sable">Préparée</span>' : ''}<button class="btn petit" data-action="${s ? 'seance' : 'preparer'}" data-id="${s ? s.id : ''}" data-prog="${p.id}" data-date="${c.date}" data-duree="${c.duree}">${s ? 'Voir' : 'Préparer'}</button></span></li>`;
  }
  function barreAvancement(b) {
    return `<span class="piste-av" role="img" aria-label="Avancement ${Math.round(b.avancement * 100)} %, attendu ${Math.round(b.attenduPart * 100)} %"><span class="av-reel" style="width:${Math.min(100, b.avancement * 100)}%;background:${couleur(b.progression)}"></span><span class="av-attendu" style="left:${Math.min(100, b.attenduPart * 100)}%"></span></span>`;
  }
  function carteBilan(b) {
    const p = b.progression;
    const fin = p.fin || annee().fin;
    const etat = !b.sequences.length ? '<span class="etiquette sable">Sans séquence</span>' : !b.tient ? '<span class="etiquette rouge">Ne tient pas</span>' : b.retard > 0.24 ? '<span class="etiquette jaune">En retard</span>' : b.retard < -0.24 ? '<span class="etiquette ciel">En avance</span>' : '<span class="etiquette ciel">À l\'heure</span>';
    return `<li style="--c:${couleur(p)}"><button class="lien-ligne" data-action="aller-sequences" data-id="${p.id}"><b>${esc(nomProg(p))} ${etat}</b>
      <span>${esc(creneauxTexte(p))} · ${h(R.heuresHebdo(p))} par semaine</span>
      ${b.sequences.length ? `${barreAvancement(b)}
      <span class="mp-chiffres"><b>${Math.round(b.avancement * 100)} %</b> du programme · attendu ${Math.round(b.attenduPart * 100)} % · ${esc(texteRetard(b))}</span>
      <span>${b.courante ? `En cours : <b>${esc(b.courante.sequence.titre)}</b> (${h(b.courante.faites)} sur ${h(b.courante.sequence.heures)})` : 'Toutes les séquences sont terminées'}</span>
      <span>${b.tient ? `Fin projetée ${b.finProjetee ? `le ${dateLongue(b.finProjetee)}` : '…'} · fin des cours le ${dateLongue(fin)} · marge ${h(b.marge)}` : `<b class="negatif">Il manque ${h(-b.marge)}</b> avant le ${dateLongue(fin)}`}</span>` : '<span>Aucune séquence posée.</span>'}</button></li>`;
  }

  // ---------- Séances ----------
  function vueSeances() {
    const titre = (pid) => `<div class="vue-tete"><div><h1>Séances</h1><p>Après chaque cours : faite, reportée ou annulée. Seules les séances faites comptent dans l'avancement ; une séance reportée peut être replacée au prochain créneau libre.</p></div>
        <div class="actions">${choixProg()}${pid ? `<button class="btn" data-action="cahier">Cahier de textes</button><button class="btn primaire" data-action="seance" data-prog="${pid}">${ICONES.plus}Nouvelle séance</button>` : ''}</div></div>`;
    if (!annee()) return sansAnnee(titre(''));
    const pid = progChoisie();
    if (!pid) return sansProg(titre(''));
    const b = bilanDe(pid);
    const p = b.progression;
    const ss = R.seancesDe(E, pid);
    const prevues = ss.filter((s) => s.statut === 'prevue' && s.date >= auj());
    const avenir = b.avenir.slice(0, 8);
    const tuiles = [
      ['Faites', String(b.faites), h(R.somme(ss.filter((s) => s.statut === 'faite'))), 'var(--bleu)', 'rond'],
      ['Annulées · reportées', `${b.annulees} · ${b.reportees}`, `${h(b.heuresPerdues)} sans cours`, 'var(--rouge)', ''],
      ['À renseigner', String(b.nonRenseignes.length), 'créneaux passés', 'var(--jaune)', 'rond'],
      ['À venir', String(b.avenir.length), `créneaux d'ici le ${dateCourte(p.fin || annee().fin)}`, 'var(--encre)', ''],
    ].map(tuile).join('');
    const rens = b.nonRenseignes.length ? `<section><h2 class="titre-section">À renseigner <span>${pluriel(b.nonRenseignes.length, 'créneau passé', 'créneaux passés')}</span></h2>
      <ul class="alertes-liste">${[...b.nonRenseignes].reverse().map((c) => `<li class="retard">${pastilleDate(c.date, true)}<div class="lien-ligne"><b>${esc(dateJour(c.date))}</b><span>Créneau de ${h(c.duree)} · ${quand(c.date)}</span></div>
        <span class="alerte-droite"><button class="btn petit primaire" data-action="rens-ouvrir" data-statut="faite" data-prog="${pid}" data-date="${c.date}" data-duree="${c.duree}">Faite</button><button class="btn petit" data-action="rens-ouvrir" data-statut="annulee" data-prog="${pid}" data-date="${c.date}" data-duree="${c.duree}">Annulée</button></span></li>`).join('')}</ul></section>` : '';
    const lignesAvenir = avenir.map((c) => {
      const s = prevues.find((x) => x.date === c.date);
      const q = s ? sequence(s.sequenceId) : sequenceA(b, c.date);
      return `<li class="${s ? 'prete' : ''}">${pastilleDate(c.date)}<div class="lien-ligne"><b>${esc(dateJour(c.date))} · ${h(c.duree)}</b><span>${q ? esc(q.titre) : 'Hors séquence'}${s?.contenu ? ` · ${esc(s.contenu)}` : ''}</span>${s?.travail ? `<span>Travail : ${esc(s.travail)}</span>` : ''}</div>
        <span class="alerte-droite">${s ? '<span class="etiquette sable">Préparée</span>' : ''}<button class="btn petit" data-action="${s ? 'seance' : 'preparer'}" data-id="${s ? s.id : ''}" data-prog="${pid}" data-date="${c.date}" data-duree="${c.duree}">${s ? 'Modifier' : 'Préparer'}</button></span></li>`;
    }).join('');
    const passees = ss.filter((s) => s.statut !== 'prevue' || s.date < auj()).reverse();
    return `${titre(pid)}<div class="tuiles">${tuiles}</div>${rens}
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Prochains créneaux <span>${esc(creneauxTexte(p))}</span></h2>${avenir.length ? `<ul class="alertes-liste a-venir">${lignesAvenir}</ul>` : '<p class="aide">Plus de créneau d\'ici la fin des cours.</p>'}</section>
        <section><h2 class="titre-section">Cahier de textes <span>${pluriel(passees.length, 'séance')}</span></h2>
          ${passees.length ? `<ul class="journal">${passees.map(ligneJournal).join('')}</ul>` : videEtat('Aucune séance consignée', 'Après un cours, consigne-le ici ou depuis le tableau de bord : contenu, travail donné, statut.', `<button class="btn primaire" data-action="seance" data-prog="${pid}">${ICONES.plus}Nouvelle séance</button>`)}</section>
      </div>
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv-seances">Export CSV des séances de l'année</button></div>
      ${AVERTISSEMENT}`;
  }
  function ligneJournal(s) {
    const q = sequence(s.sequenceId);
    return `<li class="st-${s.statut}"><button class="lien-ligne" data-action="seance" data-id="${s.id}"><span class="jl-tete"><b>${esc(dateCourte(s.date))}</b><span class="etiquette ${STATUT_COUL[s.statut]}">${STATUT_NOM[s.statut]}${s.motif ? ` · ${esc(s.motif)}` : ''}</span><small>${h(s.duree)}</small></span>
      <span class="jl-seq">${q ? esc(q.titre) : 'Hors séquence'}</span>${s.contenu ? `<span>${esc(s.contenu)}</span>` : ''}${s.travail ? `<span class="jl-travail">Travail : ${esc(s.travail)}</span>` : ''}</button></li>`;
  }

  // ---------- Séquences ----------
  function vueSequences() {
    const titre = (pid) => `<div class="vue-tete"><div><h1>Séquences</h1><p>Dans l'ordre, avec leurs objectifs et leur durée en heures. Le prévu pose les séquences à la suite sur tous les créneaux de l'année ; le projeté repart des heures restantes sur les créneaux à venir.</p></div>
        <div class="actions">${choixProg()}${pid ? `<button class="btn" data-action="modele">Partir d'un modèle</button><button class="btn" data-action="dupliquer" data-id="${pid}">Dupliquer</button><button class="btn primaire" data-action="sequence" data-prog="${pid}">${ICONES.plus}Nouvelle séquence</button>` : ''}</div></div>`;
    if (!annee()) return sansAnnee(titre(''));
    const pid = progChoisie();
    if (!pid) return sansProg(titre(''));
    const b = bilanDe(pid);
    const p = b.progression;
    const fin = p.fin || annee().fin;
    if (!b.sequences.length) {
      return `${titre(pid)}${videEtat('Aucune séquence', `${esc(nomProg(p))} a ${h(b.dispo)} de cours sur l'année (${pluriel(b.nbCreneaux, 'créneau', 'créneaux')}). Pars d'un modèle de structure ou ajoute tes séquences une à une.`, `<button class="btn primaire" data-action="modele">Partir d'un modèle</button><button class="btn" data-action="sequence" data-prog="${pid}">${ICONES.plus}Nouvelle séquence</button>`)}${banqueVerbes()}${AVERTISSEMENT}`;
    }
    const tuiles = [
      ['Prévu', h(b.total), `pour ${h(b.dispo)} de cours dans l'année`, 'var(--bleu)', 'rond'],
      ['Avancement', `${Math.round(b.avancement * 100)} %`, `attendu aujourd'hui : ${Math.round(b.attenduPart * 100)} %`, 'var(--jaune)', ''],
      [b.retard >= 0 ? 'Retard' : 'Avance', h(Math.abs(b.retard)), Math.abs(b.retard) < 0.25 ? 'à l\'heure' : `≈ ${pluriel(Math.abs(b.retardSeances), 'séance')}`, 'var(--rouge)', 'rond'],
      ['Marge', h(b.marge), b.tient ? `fin projetée le ${dateCourte(b.finProjetee)}` : 'le programme ne tient pas', b.tient ? 'var(--encre)' : 'var(--rouge)', ''],
    ].map(tuile).join('');
    const alerte = !b.tient ? `<div class="encart-alerte"><b>Le programme ne tient pas avant le ${dateLongue(fin)}.</b><span>Il reste ${h(b.resteTotal)} à faire pour ${h(b.dispoRestant)} de cours (${pluriel(b.avenir.length, 'créneau', 'créneaux')}). Il manque ${h(-b.marge)}, soit environ ${pluriel(-b.margeSeances, 'séance')} : raccourcis ou regroupe des séquences, ou marque comme terminée une séquence que tu arrêtes.</span></div>` : '';
    const max = Math.max(...b.sequences.map((l) => Math.max(l.sequence.heures, l.faites)), 1);
    return `${titre(pid)}<div class="tuiles">${tuiles}</div>${alerte}
      <ol class="sequences">${b.sequences.map((l, i) => carteSequence(l, i, b.sequences.length, max)).join('')}</ol>
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv-sequences">Export CSV des séquences</button></div>
      ${banqueVerbes()}
      ${AVERTISSEMENT}`;
  }
  function carteSequence(l, i, n, max) {
    const s = l.sequence;
    const [coul, lib] = ETAT_SEQ[l.etat];
    const cv = R.couvertureBloom(s.objectifs, B);
    return `<li class="seq-carte etat-${l.etat}">
      <div class="sq-tete"><span class="sq-num">${i + 1}</span><div><b>${esc(s.titre)}</b><span class="rang-etiq"><span class="etiquette ${coul}">${lib}</span>${etiquettePlage(l.plage)}${l.depasse ? '<span class="etiquette jaune">Dépasse sa durée</span>' : ''}${l.manque > 0 ? '<span class="etiquette rouge">Au-delà de la fin des cours</span>' : ''}</span></div></div>
      <div class="sq-heures"><span class="sq-piste"><span class="sq-prevu" style="width:${s.heures / max * 100}%"></span><span class="sq-fait" style="width:${Math.min(l.faites, max) / max * 100}%"></span></span><span><b>${h(l.faites)}</b> faites sur ${h(s.heures)} prévues${l.reste && !l.terminee ? ` · reste ${h(l.reste)}` : ''}</span></div>
      <dl class="sq-dates"><div><dt>Prévu</dt><dd>${l.prevu.debut ? `${dateCourte(l.prevu.debut)} → ${l.prevu.fin ? dateCourte(l.prevu.fin) : 'au-delà'}` : 'au-delà de la fin des cours'}</dd></div>
        <div><dt>${l.terminee ? 'Réel' : 'Projeté'}</dt><dd>${l.debutProjete ? `${dateCourte(l.debutProjete)} → ${l.fin ? dateCourte(l.fin) : 'au-delà'}` : 'au-delà de la fin des cours'}</dd></div>
        ${s.fenetre ? `<div><dt>Fenêtre</dt><dd>${dateCourte(s.fenetre.debut)} → ${dateCourte(s.fenetre.fin)}</dd></div>` : ''}</dl>
      ${s.objectifs.length ? `<ul class="objectifs">${s.objectifs.map((o) => `<li>${pastilleBloom(o)}<span>${esc(o)}</span></li>`).join('')}</ul>${cv.vagues ? `<p class="aide">${pluriel(cv.vagues, 'objectif', 'objectifs')} à préciser : choisis un verbe observable (banque de verbes ci-dessous).</p>` : ''}` : '<p class="aide sq-vide">Objectifs à rédiger.</p>'}
      ${s.competences ? `<p class="sq-comp"><b>Compétences visées :</b> ${esc(s.competences)}</p>` : ''}
      ${s.note ? `<p class="sq-comp">${esc(s.note)}</p>` : ''}
      <div class="rang sq-actions"><button class="btn petit" data-action="seq-haut" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${esc(s.titre)}">↑</button><button class="btn petit" data-action="seq-bas" data-id="${s.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre ${esc(s.titre)}">↓</button><button class="btn petit" data-action="sequence" data-id="${s.id}">Modifier</button><button class="btn petit ${l.etat === 'en-cours' ? 'primaire' : ''}" data-action="seq-terminer" data-id="${s.id}">${l.terminee ? 'Reprendre' : 'Terminer'}</button></div></li>`;
  }
  function banqueVerbes() {
    return `<details class="banque-verbes"><summary>Banque de verbes d'objectifs <span>taxonomie de Bloom révisée, six niveaux</span></summary>
      <div class="niveaux-bloom">${B.bloom.map((n) => `<div class="niv-bloom"><p><span class="bloom b${n.n}">${n.n}</span><b>${esc(n.nom)}</b></p><small>${esc(n.aide)}</small><p class="verbes">${n.verbes.map(esc).join(', ')}</p></div>`).join('')}</div>
      <p class="mention">À éviter en début d'objectif, car difficiles à observer : ${B.verbesVagues.slice(0, 9).map(esc).join(', ')}… ${esc(B.sources.bloom)}</p></details>`;
  }

  // ---------- Frise ----------
  function vueFrise() {
    const titre = `<div class="vue-tete"><div><h1>Frise</h1><p>Chaque séquence sur l'année : la barre claire est le prévu, la barre foncée le réalisé puis le projeté (hachuré). Le crochet marque la fenêtre dans laquelle la séquence doit se terminer.</p></div>
        <div class="actions">${choixProg()}</div></div>`;
    if (!annee()) return sansAnnee(titre);
    const pid = progChoisie();
    if (!pid) return sansProg(titre);
    const b = bilanDe(pid);
    if (!b.sequences.length) return `${titre}${videEtat('Aucune séquence', 'La frise apparaît dès que la classe a des séquences.', `<button class="btn primaire" data-action="aller-sequences" data-id="${pid}">Séquences</button>`)}${AVERTISSEMENT}`;
    const legende = `<p class="legende-frise"><span><i class="lg-prevu"></i>Prévu</span><span><i class="lg-reel" style="background:${couleur(b.progression)}"></i>Réalisé</span><span><i class="lg-proj" style="--c:${couleur(b.progression)}"></i>Projeté</span><span><i class="lg-fenetre"></i>Fenêtre</span><span><i class="lg-vac"></i>Vacances et jours sans cours</span><span><i class="lg-auj"></i>Aujourd'hui</span></p>`;
    const table = `<details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>N°</th><th>Séquence</th><th>Prévu</th><th>Réel ou projeté</th><th>Fenêtre</th></tr></thead><tbody>${b.sequences.map((l, i) => `<tr><td class="nb">${i + 1}</td><td>${esc(l.sequence.titre)}</td><td>${dateCourte(l.prevu.debut)} → ${l.prevu.fin ? dateCourte(l.prevu.fin) : 'au-delà'}</td><td>${dateCourte(l.debutProjete)} → ${l.fin ? dateCourte(l.fin) : 'au-delà'}</td><td>${l.sequence.fenetre ? `${dateCourte(l.sequence.fenetre.debut)} → ${dateCourte(l.sequence.fenetre.fin)} ${etiquettePlage(l.plage)}` : '–'}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `${titre}${legende}<figure class="graphique frise-cadre"><figcaption class="sr-only">Frise des séquences de ${esc(nomProg(b.progression))}</figcaption><div class="defile frise-defile">${frise(b)}</div></figure>${table}${AVERTISSEMENT}`;
  }
  function frise(b) {
    const a = annee();
    const p = b.progression;
    const t = auj();
    const d0 = a.debut, d1 = a.fin;
    const n = Math.max(1, ecart(d0, d1) + 1);
    // Largeur réelle de l'écran : texte lisible sur téléphone (défilement horizontal au-delà).
    const W = Math.max(640, Math.min(1140, (document.documentElement.clientWidth || 1000) - 48));
    const G = 8, L = 3, HAUT = 34, RANG = 50;
    const x = (d) => G + (ecart(d0, d) / n) * (W - 2 * G);
    const xf = (d) => x(ajout(d, 1));
    const H = HAUT + b.sequences.length * RANG + 10;
    const coul = couleur(p);
    const parts = [];
    // Vacances et jours fermés (bandes), mois (repères).
    for (const f of a.fermetures) parts.push(`<rect x="${x(f.debut)}" y="${HAUT - 6}" width="${Math.max(2, xf(f.fin) - x(f.debut))}" height="${H - HAUT}" class="fr-vac"><title>${esc(f.nom)} · ${dateCourte(f.debut)} → ${dateCourte(f.fin)}</title></rect>`);
    for (let m = versDate(d0); R.iso(m) <= d1; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const d = R.iso(new Date(m.getFullYear(), m.getMonth(), 1));
      const xm = x(d < d0 ? d0 : d);
      parts.push(`<line x1="${xm}" x2="${xm}" y1="${HAUT - 10}" y2="${H}" class="fr-mois"/><text x="${xm + 4}" y="${HAUT - 16}" class="fr-txt-mois">${esc(fmt(d < d0 ? d0 : d, { month: 'short' }).replace('.', ''))}</text>`);
    }
    b.sequences.forEach((l, i) => {
      const y = HAUT + i * RANG;
      const s = l.sequence;
      parts.push(`<text x="${G}" y="${y + 13}" class="fr-txt"><tspan class="fr-num">${i + 1}</tspan> ${esc(s.titre.length > 60 ? s.titre.slice(0, 58) + '…' : s.titre)}</text>`);
      if (l.prevu.debut) parts.push(`<rect x="${x(l.prevu.debut)}" y="${y + 19}" width="${Math.max(L, xf(l.prevu.fin || d1) - x(l.prevu.debut))}" height="8" rx="4" class="fr-prevu"><title>Prévu : ${dateCourte(l.prevu.debut)} → ${l.prevu.fin ? dateCourte(l.prevu.fin) : 'au-delà de la fin'}</title></rect>`);
      // Réalisé : du premier cours à la fin (terminée) ou à aujourd'hui ; projeté ensuite.
      const finReel = l.terminee ? l.fin : (l.debutReel ? t : null);
      if (l.debutReel && finReel) parts.push(`<rect x="${x(l.debutReel)}" y="${y + 30}" width="${Math.max(L, xf(finReel) - x(l.debutReel))}" height="11" rx="5.5" fill="${coul}"><title>Réalisé : ${dateCourte(l.debutReel)} → ${dateCourte(finReel)} · ${h(l.faites)}</title></rect>`);
      if (!l.terminee && l.reste > 0) {
        const dp = l.debutReel ? (t > l.debutProjete ? t : l.debutProjete) : l.debutProjete;
        if (dp) parts.push(`<rect x="${x(dp)}" y="${y + 30}" width="${Math.max(L, xf(l.fin || d1) - x(dp))}" height="11" rx="5.5" fill="url(#hachure)" stroke="${coul}" stroke-width="1"><title>Projeté : ${dateCourte(dp)} → ${l.fin ? dateCourte(l.fin) : 'au-delà de la fin des cours'} · reste ${h(l.reste)}</title></rect>`);
        if (!l.fin) parts.push(`<text x="${W - G}" y="${y + 13}" text-anchor="end" class="fr-alerte">au-delà de la fin des cours</text>`);
      }
      if (s.fenetre) {
        const fx0 = x(s.fenetre.debut), fx1 = xf(s.fenetre.fin), fy = y + 46;
        parts.push(`<path d="M${fx0} ${fy - 5}V${fy}H${fx1}V${fy - 5}" class="fr-fenetre ${l.plage?.code === 'depasse' ? 'depasse' : ''}"><title>Fenêtre : ${dateCourte(s.fenetre.debut)} → ${dateCourte(s.fenetre.fin)}</title></path>`);
      }
    });
    if (t >= d0 && t <= d1) parts.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${HAUT - 10}" y2="${H}" class="fr-auj"/>`);
    if (p.fin && p.fin < d1) parts.push(`<line x1="${xf(p.fin)}" x2="${xf(p.fin)}" y1="${HAUT - 10}" y2="${H}" class="fr-fin"/>`);
    return `<svg class="frise" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Frise des séquences"><defs><pattern id="hachure" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><rect width="2.5" height="6" fill="${coul}" opacity=".55"/></pattern></defs>${parts.join('')}</svg>`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const a = annee();
    const titre = `<div class="vue-tete"><div><h1>Calendrier</h1><p>Dates de l'année, vacances de ta zone et jours sans cours (à saisir), jours fériés (calculés), classes et groupes avec leurs créneaux. Tout le reste en découle.</p></div>
        <div class="actions">${E.annees.length ? choixAnnee() : ''}${a ? `<button class="btn primaire" data-action="progression">${ICONES.plus}Nouvelle classe</button>` : ''}</div></div>`;
    if (!a) return sansAnnee(titre);
    const c = ctx();
    const ps = progsAnnee();
    const fer = R.feriesEntre(a.debut, a.fin, E.reglages.alsaceMoselle).filter((f) => R.jourSemaine(f.date) <= (ps.some((p) => p.creneaux.some((x) => x.jour === 6)) ? 6 : 5));
    const ign = new Set(E.reglages.feriesIgnores);
    const semaines = new Set();
    for (let d = R.lundi(a.debut); d <= a.fin; d = ajout(d, 7)) { let o = false; for (let i = 0; i < 5; i++) { const x = ajout(d, i); if (x >= a.debut && x <= a.fin && !c.fermes.has(x)) o = true; } if (o) semaines.add(d); }
    const fs = [...a.fermetures].sort((x, y) => x.debut.localeCompare(y.debut));
    const pers = R.periodes(c);
    return `${titre}
      <section class="annee-carte"><div class="an-tete"><div><p class="surtitre">Année</p><h2>${esc(a.nom)}</h2><span>Du ${dateLongue(a.debut)} au ${dateLongue(a.fin)} · ${pluriel(semaines.size, 'semaine')} avec des cours</span></div>
        <div class="rang"><button class="btn petit" data-action="annee" data-id="${a.id}">Modifier l'année</button><button class="btn petit" data-action="annee">Nouvelle année</button></div></div></section>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Vacances et jours sans cours <span>à saisir : les dates de ta zone</span></h2>
          ${fs.length ? `<ul class="liste-fermetures">${fs.map((f) => `<li class="${f.type}"><button class="lien-ligne" data-action="fermeture" data-id="${f.id}"><b>${esc(f.nom)}</b><span>${f.debut === f.fin ? esc(dateJour(f.debut)) : `Du ${dateLongue(f.debut)} au ${dateLongue(f.fin)}`}</span></button><span class="etiquette ${f.type === 'vacances' ? 'jaune' : 'sable'}">${f.type === 'vacances' ? 'Vacances' : 'Sans cours'}</span></li>`).join('')}</ul>` : '<p class="aide">Aucune date saisie : sans les vacances, les heures disponibles sont surestimées.</p>'}
          <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="fermeture" data-type="vacances">${ICONES.plus}Vacances</button><button class="btn petit" data-action="fermeture" data-type="ferme">${ICONES.plus}Jour sans cours</button></div>
          <p class="mention">${esc(B.sources.vacances)}</p></section>
        <section><h2 class="titre-section">Jours fériés <span>calculés · décoche ceux où tu as cours</span></h2>
          <ul class="feries-liste">${fer.map((f) => `<li><label class="case"><input type="checkbox" data-action="ferie" data-id="${f.id}" ${ign.has(f.id) ? '' : 'checked'}> <b>${esc(f.nom)}</b> <span>${esc(dateJour(f.date))}</span></label></li>`).join('') || '<li class="aide">Aucun férié en semaine sur cette période.</li>'}</ul>
          <p class="mention">${esc(B.sources.feries)}${E.reglages.alsaceMoselle ? ' Alsace-Moselle activé.' : ' Alsace-Moselle : voir les Réglages.'}</p></section>
      </div>
      <h2 class="titre-section">Classes et groupes <span>${pluriel(ps.length, 'classe')}</span></h2>
      ${ps.length ? `<ul class="classes">${ps.map(carteProg).join('')}</ul>` : videEtat('Aucune classe cette année', 'Ajoute une classe ou un groupe avec ses créneaux.', `<button class="btn primaire" data-action="progression">${ICONES.plus}Nouvelle classe</button>`)}
      ${ps.length && pers.length > 1 ? `<h2 class="titre-section">Heures de cours par période <span>entre deux vacances</span></h2><div class="defile"><table class="tableau petit"><thead><tr><th>Classe</th>${pers.map((x) => `<th class="nb">${esc(x.nom)}<br><small>${dateCourte(x.debut)} → ${dateCourte(x.fin)}</small></th>`).join('')}<th class="nb">Année</th></tr></thead><tbody>${ps.map((p) => `<tr><td>${esc(p.nom)}</td>${pers.map((x) => `<td class="nb">${h(R.somme(R.creneaux(p, c, x.debut, x.fin)))}</td>`).join('')}<td class="nb"><b>${h(bilanDe(p.id).dispo)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
      <section class="fin-annee"><h2 class="titre-section">Sauvegarde et fin d'année</h2>
        <p class="aide">Pour l'année suivante : <b>Nouvelle année</b> reprend la structure de tes classes (créneaux, séquences, objectifs, durées) sans les séances. Garde une copie avant de supprimer une année.</p>
        <div class="rang"><button class="btn petit" data-action="csv-seances">Export CSV des séances</button><button class="btn petit" data-action="exporter">Télécharger une copie</button><button class="btn petit danger" data-action="supprimer-annee">Supprimer l'année</button></div></section>
      ${AVERTISSEMENT}`;
  }
  function carteProg(p) {
    const b = bilanDe(p.id);
    const a = annee();
    return `<li class="classe-carte" style="--c:${couleur(p)}"><div class="cl-tete"><div><b>${esc(p.nom)}</b><small>${esc([p.matiere, p.public].filter(Boolean).join(' · ') || 'Matière non précisée')}</small></div><span class="pastille-coul" style="background:${couleur(p)}"></span></div>
      <p class="cl-creneaux">${esc(creneauxTexte(p))}</p>
      <div class="vt-chiffres"><div><b>${h(R.heuresHebdo(p))}</b><span>par semaine</span></div><div><b>${h(b.dispo)}</b><span>dans l'année</span></div><div><b>${h(b.dispoRestant)}</b><span>restantes</span></div></div>
      <p class="aide">Cours du ${dateCourte(p.debut || a.debut)} au ${dateCourte(p.fin || a.fin)} · ${pluriel(R.sequencesDe(E, p.id).length, 'séquence')}</p>
      <div class="rang vt-actions"><button class="btn petit" data-action="progression" data-id="${p.id}">Modifier</button><button class="btn petit" data-action="aller-sequences" data-id="${p.id}">Séquences</button><button class="btn petit" data-action="dupliquer" data-id="${p.id}">Dupliquer</button></div></li>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider) {
    const d = modale();
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    d.classList.remove('large');
    editionListe = null;
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  let editionListe = null;
  function modifier(f, message) {
    retenir();
    f();
    sauver(); rendre();
    toast(typeof message === 'function' ? message() : message, { libelle: 'Annuler', faire: annuler });
  }

  // Année : nom, dates, reprise des classes d'une autre année (structure seulement).
  function modaleAnnee(id) {
    const a = id ? E.annees.find((x) => x.id === id) : null;
    const der = [...E.annees].sort((x, y) => y.debut.localeCompare(x.debut))[0];
    const sc = R.anneeScolaire(der ? ajout(der.fin, 70) : auj());
    const x = a || { nom: sc.nom, debut: sc.debut, fin: sc.fin };
    const autres = E.annees.filter((y) => y.id !== a?.id);
    const corps = `<label class="champ">Nom<input name="nom" maxlength="30" value="${esc(x.nom)}"></label>
      <div class="rang-champs"><label class="champ">Début des cours<input type="date" name="debut" value="${x.debut}"></label><label class="champ">Fin des cours<input type="date" name="fin" value="${x.fin}"></label></div>
      ${!a && autres.length ? `<label class="champ">Reprendre les classes de<small>Créneaux, séquences, objectifs et durées : aucune séance. Les vacances sont à saisir pour la nouvelle année.</small><select name="reprendre"><option value="">Ne rien reprendre</option>${autres.map((y) => `<option value="${y.id}" ${y.id === E.anneeId ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select></label>` : ''}
      ${a ? '<p class="aide">Les classes dont les dates de cours sortent de l\'année sont ramenées à ses bornes dans les calculs.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Modifier l\'année' : 'Nouvelle année', corps, PIED(false), (fd) => {
      const debut = fd.get('debut'), fin = fd.get('fin');
      if (!R.estDate(debut) || !R.estDate(fin)) return 'Dates illisibles.';
      if (fin <= debut) return 'La fin des cours vient après leur début.';
      if (ecart(debut, fin) > 400) return 'Une année dure au plus 400 jours.';
      const n = R.normaliserAnnee({ ...(a || {}), id: a?.id || uid(), nom: fd.get('nom') || x.nom, debut, fin });
      modifier(() => {
        if (a) E.annees = E.annees.map((y) => (y.id === a.id ? n : y));
        else { E.annees.push(n); E.anneeId = n.id; if (fd.get('reprendre')) E = R.reprendreAnnee(E, fd.get('reprendre'), n); filtre.prog = ''; }
      }, a ? 'Année enregistrée : tout est recalculé.' : `Année ${n.nom} créée${fd.get('reprendre') ? ' avec la structure de tes classes' : ''}. Ajoute ses vacances.`);
      return undefined;
    });
  }

  // Vacances ou jour sans cours.
  function modaleFermeture(id, type) {
    const a = annee();
    if (!a) return modaleAnnee(null);
    const f = id ? a.fermetures.find((x) => x.id === id) : null;
    const x = f || { nom: type === 'ferme' ? '' : '', type: type === 'ferme' ? 'ferme' : 'vacances', debut: auj() >= a.debut && auj() <= a.fin ? auj() : a.debut, fin: '' };
    const corps = `<fieldset class="champ"><legend>Type</legend><div class="choix-statut deux"><label><input type="radio" name="type" value="vacances" ${x.type === 'vacances' ? 'checked' : ''}><span>Vacances</span></label><label><input type="radio" name="type" value="ferme" ${x.type === 'ferme' ? 'checked' : ''}><span>Jour sans cours</span></label></div></fieldset>
      <label class="champ">Nom<small>Ex. : vacances d'automne, journée banalisée, épreuves.</small><input name="nom" maxlength="60" value="${esc(x.nom)}" placeholder="${x.type === 'ferme' ? 'Journée banalisée' : 'Vacances d\'automne'}"></label>
      <div class="rang-champs"><label class="champ">Du<input type="date" name="debut" value="${x.debut}"></label><label class="champ">Au<small>Vide : un seul jour.</small><input type="date" name="fin" value="${x.fin}"></label></div>
      <p class="aide">Saisis les dates officielles de ta zone, vérifiées pour l'année : elles changent chaque année et ne sont pas intégrées.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(f ? 'Modifier' : x.type === 'ferme' ? 'Jour sans cours' : 'Vacances', corps, PIED(!!f), (fd, choix) => {
      if (choix === 'supprimer') { modifier(() => { a.fermetures = a.fermetures.filter((y) => y.id !== f.id); }, `${f.nom} supprimé.`); return undefined; }
      const debut = fd.get('debut'), fin = fd.get('fin') || debut;
      if (!R.estDate(debut) || !R.estDate(fin)) return 'Dates illisibles.';
      if (fin < debut) return 'La fin vient après le début.';
      if (fin < a.debut || debut > a.fin) return 'Ces dates sont en dehors de l\'année.';
      const n = R.normaliserFermeture({ id: f?.id || uid(), nom: fd.get('nom'), type: fd.get('type'), debut, fin });
      modifier(() => { a.fermetures = f ? a.fermetures.map((y) => (y.id === f.id ? n : y)) : [...a.fermetures, n]; }, `${n.nom} enregistré : heures recalculées.`);
      return undefined;
    });
  }

  // Classe ou groupe : nom, matière, public, dates des cours, créneaux (jour, durée, semaines A/B).
  function modaleProgression(id) {
    const a = annee();
    if (!a) return modaleAnnee(null);
    const p = id ? prog(id) : null;
    const x = p || { nom: '', matiere: '', public: '', debut: null, fin: null, refA: null, creneaux: [] };
    let cr = x.creneaux.map((c) => ({ ...c }));
    if (!cr.length) cr = [{ id: uid(), jour: 1, duree: 1, semaine: 'toutes' }];
    const corps = `<div class="rang-champs"><label class="champ">Classe ou groupe<input name="nom" maxlength="40" value="${esc(x.nom)}" required placeholder="4e B"></label>
        <label class="champ">Matière ou module<small>Facultatif.</small><input name="matiere" maxlength="40" value="${esc(x.matiere)}"></label></div>
      <label class="champ">Niveau ou public<small>Facultatif : collège, lycée, formation continue…</small><input name="public" maxlength="60" value="${esc(x.public)}"></label>
      <fieldset class="champ cadre-champs"><legend>Créneaux de la semaine <small>Un créneau en semaine A ou B n'a lieu qu'une semaine sur deux.</small></legend><ul class="plan-edit creneaux-edit"></ul>
        <div class="rang"><button type="button" class="btn petit" data-action="cr-ajout">${ICONES.plus}Ajouter un créneau</button></div></fieldset>
      <label class="champ">Une semaine A<small>Une date de n'importe quelle semaine A (sert à l'alternance). Vide : la première semaine des cours.</small><input type="date" name="refA" value="${x.refA || ''}"></label>
      <div class="rang-champs"><label class="champ">Premier cours<small>Vide : début de l'année.</small><input type="date" name="debut" value="${x.debut || ''}"></label><label class="champ">Dernier cours<small>Vide : fin de l'année.</small><input type="date" name="fin" value="${x.fin || ''}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier la classe' : 'Nouvelle classe ou groupe', corps, PIED(!!p), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = R.seancesDe(E, p.id).length;
        if (!confirm(`Supprimer ${p.nom}, ses ${pluriel(R.sequencesDe(E, p.id).length, 'séquence')} et ses ${pluriel(n, 'séance')} ?`)) return 'Rien n\'a été supprimé.';
        modifier(() => { E = R.supprimerProgression(E, p.id); }, `${p.nom} supprimée.`);
        return undefined;
      }
      if (!String(fd.get('nom')).trim()) return 'Indique le nom de la classe ou du groupe.';
      if (!cr.length) return 'Ajoute au moins un créneau.';
      const debut = fd.get('debut') || null, fin = fd.get('fin') || null;
      if ((debut && !R.estDate(debut)) || (fin && !R.estDate(fin))) return 'Dates illisibles.';
      if (debut && fin && fin < debut) return 'Le dernier cours vient après le premier.';
      const n = R.normaliserProgression({ ...(p || {}), id: p?.id || uid(), anneeId: p?.anneeId || a.id, nom: fd.get('nom'), matiere: fd.get('matiere'), public: fd.get('public'), creneaux: cr, debut, fin, refA: fd.get('refA') || null, couleur: p ? p.couleur : progsAnnee().length });
      modifier(() => { if (p) E.progressions = E.progressions.map((y) => (y.id === p.id ? n : y)); else E.progressions.push(n); filtre.prog = n.id; }, p ? `${n.nom} enregistrée : heures recalculées.` : `${n.nom} créée. Pose maintenant ses séquences.`);
      return undefined;
    });
    const dessiner = () => {
      const ul = modale().querySelector('.creneaux-edit');
      ul.innerHTML = cr.map((c, i) => `<li class="plan-ligne"><div class="rang-champs"><label class="champ">Jour<select data-c="${i}" data-k="jour">${[1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${c.jour === d ? 'selected' : ''}>${B.jours[d]}</option>`).join('')}</select></label>
        <label class="champ">Durée<select data-c="${i}" data-k="duree">${optionsDuree(c.duree, false)}</select></label>
        <label class="champ">Semaines<select data-c="${i}" data-k="semaine"><option value="toutes" ${c.semaine === 'toutes' ? 'selected' : ''}>Toutes</option><option value="A" ${c.semaine === 'A' ? 'selected' : ''}>A</option><option value="B" ${c.semaine === 'B' ? 'selected' : ''}>B</option></select></label>
        <button type="button" class="btn-suppr" data-action="cr-suppr" data-i="${i}" aria-label="Retirer ce créneau">×</button></div></li>`).join('');
      ul.querySelectorAll('[data-c]').forEach((el) => el.addEventListener('change', () => { const c = cr[Number(el.dataset.c)]; c[el.dataset.k] = el.dataset.k === 'semaine' ? el.value : Number(el.value); }));
    };
    dessiner();
    editionListe = (action, i) => {
      if (action === 'cr-suppr') { cr.splice(Number(i), 1); dessiner(); }
      if (action === 'cr-ajout') { cr.push({ id: uid(), jour: Math.min(6, (cr[cr.length - 1]?.jour || 0) + 1), duree: cr[cr.length - 1]?.duree || 1, semaine: 'toutes' }); dessiner(); }
    };
  }

  // Séquence : titre, durée, objectifs (avec la banque de verbes), compétences, fenêtre, terminée.
  function modaleSequence(id, progId) {
    const s = id ? sequence(id) : null;
    const pid = s ? s.progressionId : (progId || progChoisie());
    if (!pid) return;
    const x = s || { titre: '', heures: 6, objectifs: [], competences: '', fenetre: null, terminee: null, note: '' };
    const corps = `<div class="rang-champs"><label class="champ pl-nom">Titre<input name="titre" maxlength="90" value="${esc(x.titre)}" required></label>
        <label class="champ">Durée prévue (h)<input name="heures" inputmode="decimal" value="${String(x.heures).replace('.', ',')}"></label></div>
      <label class="champ">Objectifs<small>Un par ligne, commençant par un verbe d'action observable.</small><textarea name="objectifs" rows="4" id="m-objectifs">${esc(x.objectifs.join('\n'))}</textarea></label>
      <ul class="analyse-objectifs" id="m-analyse"></ul>
      <div class="cadre-champs batisseur"><p class="surtitre">Banque de verbes</p>
        <div class="choix-bloom">${B.bloom.map((n) => `<label><input type="radio" name="niv" value="${n.n}" ${n.n === 3 ? 'checked' : ''}><span>${n.n} · ${esc(n.nom)}</span></label>`).join('')}</div>
        <div class="verbes-choix" id="m-verbes"></div></div>
      <label class="champ">Compétences visées<small>Texte libre : celles de ton référentiel.</small><textarea name="competences" rows="2" maxlength="400">${esc(x.competences)}</textarea></label>
      <fieldset class="champ cadre-champs"><legend>Fenêtre de fin <small>Jalon à plage, facultatif : la séquence doit se terminer entre ces deux dates (avant une évaluation commune, un examen blanc…).</small></legend>
        <div class="rang-champs"><label class="champ">Entre le<input type="date" name="fdebut" value="${x.fenetre?.debut || ''}"></label><label class="champ">et le<input type="date" name="ffin" value="${x.fenetre?.fin || ''}"></label></div></fieldset>
      <label class="champ">Note<small>Facultatif.</small><textarea name="note" rows="2" maxlength="600">${esc(x.note)}</textarea></label>
      ${s ? `<label class="case"><input type="checkbox" name="terminee" ${x.terminee ? 'checked' : ''}> Séquence terminée${x.terminee ? ` le ${dateLongue(x.terminee)}` : ''}</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier la séquence' : 'Nouvelle séquence', corps, PIED(!!s), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = E.seances.filter((y) => y.sequenceId === s.id).length;
        if (n && !confirm(`${pluriel(n, 'séance est rattachée', 'séances sont rattachées')} à cette séquence : elles restent dans le cahier de textes, hors séquence. Supprimer ?`)) return 'Rien n\'a été supprimé.';
        modifier(() => { E.sequences = E.sequences.filter((y) => y.id !== s.id); E.seances = E.seances.map((y) => (y.sequenceId === s.id ? { ...y, sequenceId: null } : y)); }, `${s.titre} supprimée.`);
        return undefined;
      }
      const hh = R.lireNombre(fd.get('heures'));
      if (!String(fd.get('titre')).trim()) return 'Donne un titre à la séquence.';
      if (hh === null || hh > 400) return 'Durée : un nombre d\'heures entre 0 et 400 (pas d\'une demi-heure).';
      const fdb = fd.get('fdebut'), ffn = fd.get('ffin');
      if ((fdb && !ffn) || (!fdb && ffn)) return 'Fenêtre : indique les deux dates, ou aucune.';
      if (fdb && ffn && ffn < fdb) return 'Fenêtre : la seconde date vient après la première.';
      const derniere = s ? E.seances.filter((y) => y.sequenceId === s.id && y.statut === 'faite').map((y) => y.date).sort().pop() : null;
      const term = s && fd.get('terminee') ? (x.terminee || derniere || auj()) : null;
      const ordre = s ? s.ordre : Math.max(0, ...R.sequencesDe(E, pid).map((y) => y.ordre)) + 1;
      const n = R.normaliserSequence({ ...(s || {}), id: s?.id || uid(), progressionId: pid, ordre, titre: fd.get('titre'), heures: hh, objectifs: String(fd.get('objectifs')).split('\n'), competences: fd.get('competences'), fenetre: fdb ? { debut: fdb, fin: ffn } : null, note: fd.get('note'), terminee: term });
      modifier(() => { if (s) E.sequences = E.sequences.map((y) => (y.id === s.id ? n : y)); else E.sequences.push(n); }, `${n.titre} enregistrée : projection recalculée.`);
      return undefined;
    });
    const zone = $('#m-objectifs');
    const analyser = () => {
      const l = zone.value.split('\n').map((o) => o.trim()).filter(Boolean);
      $('#m-analyse').innerHTML = l.map((o) => { const r = R.analyserObjectif(o, B); return `<li>${pastilleBloom(o)}<span>${r.niveau ? `${esc(B.bloom[r.niveau - 1].nom)} · « ${esc(r.verbe)} »` : r.vague ? 'Verbe difficile à observer : à préciser' : 'Verbe non reconnu dans la banque'}</span></li>`; }).join('');
    };
    const verbes = () => {
      const n = Number(modale().querySelector('[name=niv]:checked')?.value || 3);
      $('#m-verbes').innerHTML = B.bloom[n - 1].verbes.map((v) => `<button type="button" class="code verbe" data-action="verbe-ajout" data-i="${esc(v)}">${esc(v)}</button>`).join('');
    };
    zone.addEventListener('input', analyser);
    modale().querySelectorAll('[name=niv]').forEach((el) => el.addEventListener('change', verbes));
    analyser(); verbes();
    editionListe = (action, v) => {
      if (action !== 'verbe-ajout') return;
      const debut = v.charAt(0).toUpperCase() + v.slice(1) + ' ';
      zone.value = zone.value.replace(/\s*$/, '') + (zone.value.trim() ? '\n' : '') + debut;
      zone.focus(); zone.setSelectionRange(zone.value.length, zone.value.length);
      analyser();
    };
  }

  // Séance : date, durée, statut, séquence, contenu (étapes proposées), travail donné, motif.
  function modaleSeance(id, opts = {}) {
    const s = id ? seance(id) : null;
    const pid = s ? s.progressionId : (opts.prog || progChoisie());
    const p = prog(pid);
    if (!p) return;
    const b = bilanDe(pid);
    const date = opts.date || auj();
    const prochain = b.avenir[0];
    const x = s ? { ...s, statut: opts.statut || s.statut } : { date: opts.date || (prochain && opts.statut === 'prevue' ? prochain.date : date), duree: Number(opts.duree) || p.creneaux[0]?.duree || 1, statut: opts.statut || (date > auj() ? 'prevue' : 'faite'), sequenceId: sequenceA(b, date)?.id || R.sequenceParDefaut(E, pid), contenu: '', travail: '', motif: '' };
    const seqs = R.sequencesDe(E, pid);
    const corps = `<p class="aide"><b>${esc(nomProg(p))}</b></p>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${x.date}"></label><label class="champ">Durée<select name="duree">${optionsDuree(x.duree, false)}</select></label></div>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${B.statuts.map((st) => `<label title="${esc(st.aide)}"><input type="radio" name="statut" value="${st.code}" ${x.statut === st.code ? 'checked' : ''}><span>${esc(st.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ champ-motif">Motif<select name="motif"><option value="">—</option>${B.motifs.map((m) => `<option ${x.motif === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="champ">Séquence<select name="sequenceId"><option value="">Hors séquence</option>${seqs.map((q, i) => `<option value="${q.id}" ${q.id === x.sequenceId ? 'selected' : ''}>${i + 1}. ${esc(q.titre)}${q.terminee ? ' (terminée)' : ''}</option>`).join('')}</select></label>
      <div class="etapes-choix">${B.etapes.map((t) => `<button type="button" class="code" data-action="etape-ajout" data-i="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <label class="champ">Contenu<small>Ce qui a été fait ou est prévu.</small><textarea name="contenu" rows="3" maxlength="1000" id="m-contenu">${esc(x.contenu)}</textarea></label>
      <label class="champ">Travail donné<small>Facultatif.</small><textarea name="travail" rows="2" maxlength="500">${esc(x.travail)}</textarea></label>
      ${s && s.statut !== 'reportee' ? '<label class="case champ-replacer"><input type="checkbox" name="replacer" checked> Replacer ce contenu au prochain créneau libre</label>' : !s ? '<label class="case champ-replacer"><input type="checkbox" name="replacer" checked> Replacer ce contenu au prochain créneau libre</label>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier la séance' : 'Séance', corps, PIED(!!s), (fd, choix) => {
      if (choix === 'supprimer') { modifier(() => { E.seances = E.seances.filter((y) => y.id !== s.id); }, 'Séance supprimée.'); return undefined; }
      const d = fd.get('date');
      if (!R.estDate(d)) return 'Date illisible.';
      const st = fd.get('statut');
      if (st === 'faite' && d > auj()) return 'Une séance future ne peut pas être faite : choisis « Prévue ».';
      const n = R.normaliserSeance({ ...(s || {}), id: s?.id || uid(), progressionId: pid, date: d, duree: Number(fd.get('duree')), statut: st, sequenceId: fd.get('sequenceId') || null, contenu: fd.get('contenu'), travail: fd.get('travail'), motif: st === 'annulee' || st === 'reportee' ? fd.get('motif') : '' });
      let message = st === 'faite' ? 'Séance consignée : avancement recalculé.' : st === 'prevue' ? 'Séance préparée.' : st === 'annulee' ? 'Séance annulée : le créneau est perdu, projection recalculée.' : 'Séance reportée.';
      modifier(() => {
        if (s) E.seances = E.seances.map((y) => (y.id === s.id ? n : y)); else E.seances.push(n);
        if (st === 'reportee' && fd.get('replacer') && (!s || s.statut !== 'reportee')) {
          const r = R.reporter(E, n.id, ctx(), auj());
          E = r.E;
          message = r.nouvelle ? `Séance reportée : contenu replacé le ${dateLongue(r.nouvelle.date)}.` : 'Séance reportée : aucun créneau libre d\'ici la fin des cours.';
        }
      }, () => message);
      return undefined;
    });
    const majStatut = () => {
      const st = modale().querySelector('[name=statut]:checked')?.value;
      modale().querySelector('.champ-motif').hidden = !(st === 'annulee' || st === 'reportee');
      const rp = modale().querySelector('.champ-replacer');
      if (rp) rp.hidden = st !== 'reportee';
    };
    modale().querySelectorAll('[name=statut]').forEach((el) => el.addEventListener('change', majStatut));
    majStatut();
    editionListe = (action, t) => {
      if (action !== 'etape-ajout') return;
      const z = $('#m-contenu');
      z.value = z.value.trim() ? `${z.value.replace(/\s*$/, '')}\n${t}` : t;
      z.focus();
    };
  }
  // Un créneau passé : faite ou annulée (reprend la séance préparée ce jour-là s'il y en a une).
  function renseigner(pid, date, duree, statut) {
    const prete = E.seances.find((s) => s.progressionId === pid && s.date === date && s.statut === 'prevue');
    if (prete) return modaleSeance(prete.id, { statut });
    modaleSeance(null, { prog: pid, date, duree, statut });
  }
  // Rattrapage : tous les créneaux passés non renseignés d'une classe, en un geste chacun.
  function modaleRenseigner(pid) {
    const p = prog(pid);
    const dessiner = () => {
      oublier();
      const l = [...bilanDe(pid).nonRenseignes].reverse();
      modale().querySelector('.rens-liste').innerHTML = l.length ? l.map((c) => `<li><span><b>${esc(dateJour(c.date))}</b><small>${h(c.duree)} · ${esc(sequenceA(bilanDe(pid), c.date)?.titre || 'Hors séquence')}</small></span><span class="rang"><button type="button" class="btn petit primaire" data-action="rens-faite" data-i="${c.date}|${c.duree}">Faite</button><button type="button" class="btn petit" data-action="rens-annulee" data-i="${c.date}|${c.duree}">Annulée</button><button type="button" class="btn petit" data-action="rens-detail" data-i="${c.date}|${c.duree}">Détails</button></span></li>`).join('') : '<li class="aide">Tout est renseigné.</li>';
    };
    ouvrirModale(`À renseigner · ${esc(p.nom)}`, `<p class="aide">« Faite » rattache le cours à la séquence en cours ; « Détails » permet d'écrire le contenu et le travail donné.</p><ul class="rens-liste mini-liste"></ul>`, '<button class="btn primaire" value="ok">Fermer</button>');
    dessiner();
    editionListe = (action, v) => {
      const [date, duree] = String(v).split('|');
      if (action === 'rens-detail') { renseigner(pid, date, Number(duree), 'faite'); return; }
      const statut = action === 'rens-faite' ? 'faite' : 'annulee';
      const prete = E.seances.find((s) => s.progressionId === pid && s.date === date && s.statut === 'prevue');
      retenir();
      if (prete) prete.statut = statut;
      else E.seances.push(R.normaliserSeance({ id: uid(), progressionId: pid, date, duree: Number(duree), statut, sequenceId: R.sequenceParDefaut(E, pid) || null, motif: statut === 'annulee' ? 'Autre' : '' }));
      sauver(); rendre(); dessiner();
      toast(statut === 'faite' ? `Cours du ${dateCourte(date)} consigné.` : `Cours du ${dateCourte(date)} annulé.`, { libelle: 'Annuler', faire: annuler });
    };
  }

  // Modèle de structure : séquences proposées d'après les heures disponibles de la classe.
  function modaleModele() {
    const pid = progChoisie();
    const p = prog(pid);
    if (!p) return;
    const existantes = R.sequencesDe(E, pid).length;
    const corps = `<p class="aide">${esc(nomProg(p))} : <b>${h(bilanDe(pid).dispo)}</b> de cours sur l'année. Les durées proposées laissent une réserve pour les imprévus ; les titres sont des repères à renommer.</p>
      <fieldset class="champ"><legend>Structure</legend><div class="choix-modeles">${B.modeles.map((m, i) => `<label><input type="radio" name="modele" value="${m.code}" ${i === 0 ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.description)}</small></span></label>`).join('')}</div></fieldset>
      <label class="champ">Réserve pour les imprévus (%)<input name="reserve" inputmode="numeric" value="${E.reglages.reserve}"></label>
      <div class="apercu-modele" id="m-apercu"></div>
      ${existantes ? `<fieldset class="champ"><legend>Séquences existantes (${existantes})</legend><div class="choix-statut deux"><label><input type="radio" name="mode" value="suite" checked><span>Ajouter à la suite</span></label><label><input type="radio" name="mode" value="remplacer"><span>Remplacer</span></label></div></fieldset>` : ''}
      <p class="erreur" role="alert"></p>`;
    const proposition = () => {
      const m = B.modeles.find((y) => y.code === modale().querySelector('[name=modele]:checked').value);
      const r = R.lireNombre(modale().querySelector('[name=reserve]').value);
      return R.sequencesModele(m, p, ctx(), r === null ? E.reglages.reserve : r);
    };
    ouvrirModale('Partir d\'un modèle', corps, '<button class="btn primaire" value="ok">Créer les séquences</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = R.lireNombre(fd.get('reserve'));
      if (r === null || r > 50) return 'Réserve : un pourcentage entre 0 et 50.';
      const l = proposition();
      if (!l.length) return 'Aucune heure de cours : vérifie les créneaux et les dates de la classe.';
      const remplacer = fd.get('mode') === 'remplacer';
      if (remplacer && E.seances.some((s) => s.progressionId === pid && s.sequenceId) && !confirm('Les séances déjà rattachées à des séquences resteront dans le cahier de textes, hors séquence. Remplacer ?')) return 'Rien n\'a été changé.';
      modifier(() => {
        if (remplacer) { const ids = new Set(R.sequencesDe(E, pid).map((s) => s.id)); E.sequences = E.sequences.filter((s) => !ids.has(s.id)); E.seances = E.seances.map((s) => (ids.has(s.sequenceId) ? { ...s, sequenceId: null } : s)); }
        const o = Math.max(0, ...R.sequencesDe(E, pid).map((s) => s.ordre));
        l.forEach((q, i) => E.sequences.push(R.normaliserSequence({ id: uid(), progressionId: pid, ordre: o + i + 1, titre: q.titre, heures: q.heures, note: q.note })));
      }, `${pluriel(l.length, 'séquence créée', 'séquences créées')} : renomme-les et ajoute leurs objectifs.`);
      return undefined;
    });
    const apercu = () => { const l = proposition(); $('#m-apercu').innerHTML = l.length ? `<ol>${l.map((q) => `<li><span>${esc(q.titre)}</span><b>${h(q.heures)}</b></li>`).join('')}</ol><p class="aide">Total ${h(R.somme(l, (q) => q.heures))}.</p>` : '<p class="aide">Aucune heure de cours sur l\'année : vérifie les créneaux.</p>'; };
    modale().querySelectorAll('[name=modele],[name=reserve]').forEach((el) => el.addEventListener('input', apercu));
    modale().querySelectorAll('[name=modele]').forEach((el) => el.addEventListener('change', apercu));
    apercu();
  }

  // Duplication d'une classe : vers la même année (autre groupe) ou une autre année.
  function modaleDupliquer(pid) {
    const p = prog(pid);
    if (!p) return;
    const l = [...E.annees].sort((x, y) => y.debut.localeCompare(x.debut));
    const corps = `<p class="aide">Copie les créneaux, les séquences, leurs objectifs, leurs durées et leurs fenêtres (décalées d'une année à l'autre). Aucune séance n'est copiée.</p>
      <label class="champ">Nom de la copie<input name="nom" maxlength="40" value="${esc(p.nom)}${l.length === 1 ? ' (copie)' : ''}"></label>
      <label class="champ">Vers l'année<select name="annee">${l.map((a) => `<option value="${a.id}" ${a.id === E.anneeId ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></label>
      <p class="aide">Pour une année qui n'existe pas encore : crée-la (onglet Calendrier, Nouvelle année), elle peut reprendre toutes tes classes.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Dupliquer ${esc(p.nom)}`, corps, '<button class="btn primaire" value="ok">Dupliquer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const a = E.annees.find((y) => y.id === fd.get('annee'));
      if (!a) return 'Choisis une année.';
      modifier(() => { E = R.dupliquer(E, pid, a, fd.get('nom')); E.anneeId = a.id; filtre.prog = E.progressions[E.progressions.length - 1].id; }, `${fd.get('nom') || p.nom} créée dans l'année ${a.nom}.`);
      return undefined;
    });
  }

  // Cahier de textes imprimable d'une classe sur une période.
  function modaleCahier() {
    const pid = progChoisie();
    const p = prog(pid);
    if (!p) return;
    const a = annee();
    const corps = `<p class="aide">${esc(nomProg(p))} : séances consignées, dans l'ordre des dates, avec le contenu et le travail donné.</p>
      <div class="rang-champs"><label class="champ">Du<input type="date" name="de" value="${p.debut || a.debut}"></label><label class="champ">Au<input type="date" name="a" value="${auj() < a.fin ? auj() : a.fin}"></label></div>
      <label class="case"><input type="checkbox" name="annulees" checked> Inclure les séances annulées et reportées</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Cahier de textes', corps, '<button class="btn primaire" value="ok">Imprimer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const de = fd.get('de'), au = fd.get('a');
      if (!R.estDate(de) || !R.estDate(au) || au < de) return 'Vérifie les dates.';
      const l = R.cahier(E, pid, de, au).filter((s) => fd.get('annulees') || s.statut === 'faite');
      if (!l.length) return 'Aucune séance sur cette période.';
      imprimer(pageCahier(p, de, au, l));
      return undefined;
    });
  }
  function pageCahier(p, de, au, l) {
    return `<section class="cahier-page"><header class="imp-tete"><div><p class="surtitre">Cahier de textes · ${esc(annee().nom)}</p><h1>${esc(nomProg(p))}</h1><p>Du ${dateLongue(de)} au ${dateLongue(au)}</p></div>
        <div class="imp-km"><b>${pluriel(l.filter((s) => s.statut === 'faite').length, 'séance faite', 'séances faites')}</b><span>${h(R.somme(l.filter((s) => s.statut === 'faite')))} de cours</span></div></header>
      <table class="tableau"><thead><tr><th>Date</th><th>Séquence</th><th>Contenu</th><th>Travail donné</th></tr></thead>
      <tbody>${l.map((s) => `<tr class="${s.statut !== 'faite' ? 'imp-annulee' : ''}"><td>${esc(fmt(s.date, { weekday: 'short', day: 'numeric', month: 'short' }))}<br><small>${h(s.duree)}${s.statut !== 'faite' ? ` · ${STATUT_NOM[s.statut]}` : ''}</small></td><td>${esc(sequence(s.sequenceId)?.titre || '–')}</td><td>${esc(s.contenu || (s.statut !== 'faite' ? s.motif : ''))}</td><td>${esc(s.travail)}</td></tr>`).join('')}</tbody></table>
      <p class="mention">Document établi le ${dateLongue(auj())} à partir de la progression tenue par l'enseignant. Le cahier de textes officiel est celui de l'établissement.</p></section>`;
  }
  function imprimer(html) {
    const el = $('#impression');
    el.innerHTML = html;
    el.hidden = false;
    document.body.classList.add('imprime');
    if (modale().open) modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  function supprimerAnnee() {
    const a = annee();
    if (!a) return;
    const r = prompt(`Supprimer l'année ${a.nom} entière : calendrier, classes, séquences et séances ?\nÉcris SUPPRIMER pour confirmer.`);
    if (String(r || '').trim().toUpperCase() !== 'SUPPRIMER') return toast('Rien n\'a été supprimé.');
    modifier(() => { E = R.supprimerAnnee(E, a.id); filtre.prog = ''; }, `Année ${a.nom} supprimée.`);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const ko = Math.round(R.taille(E) / 1000);
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Calendrier</h3>
        <label class="case"><input type="checkbox" name="alsaceMoselle" ${r.alsaceMoselle ? 'checked' : ''}> Alsace-Moselle : Vendredi saint et 26 décembre sans cours</label>
        <label class="case"><input type="checkbox" name="sauteVacances" ${r.sauteVacances ? 'checked' : ''}> Semaines A et B : l'alternance ne compte que les semaines avec des cours</label>
        <p class="aide">Décoché : l'alternance suit le calendrier, vacances comprises. Vérifie la règle de ton établissement.</p>
        <label class="champ">Réserve proposée par les modèles (%)<input name="reserve" inputmode="numeric" value="${r.reserve}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les séances de l'année (date, classe, séquence, durée, statut, contenu, travail donné), pour un tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-seances">Exporter les séances en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde et reprise</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : `Ta progression est enregistrée en ligne avec ta clé (${ko} Ko utilisés sur environ 900). Garde aussi une copie complète sur ton ordinateur.`}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute la progression à ton écran d'accueil pour l'ouvrir comme une application et consigner tes séances à la sortie du cours.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${esc(B.sources.feries)} ${esc(B.sources.vacances)} ${esc(B.sources.bloom)} Modèles de structure, déroulé de séquence et banque de verbes : rédigés pour QME (version ${B.version}), à adapter. Aucun programme officiel intégré. Aucune connexion à un logiciel de l'établissement ni à une autre application.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const res = R.lireNombre(fd.get('reserve'));
      if (res === null || res > 50) return 'Réserve : un pourcentage entre 0 et 50.';
      E.reglages = R.normaliserReglages({ ...r, alsaceMoselle: !!fd.get('alsaceMoselle'), sauteVacances: !!fd.get('sauteVacances'), reserve: res }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés : tout est recalculé.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.progressions) || !Array.isArray(donnees.sequences)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.progressions.length, 'classe')}, ${pluriel(donnees.sequences.length, 'séquence')}) ?`)) return;
        retenir();
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide de la progression pédagogique.'); }
    });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fichier = (s) => R.plat(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `progression-${auj()}.json`);
  const exporterSeances = () => { if (annee()) telecharger(R.csvSeances(E, E.anneeId), 'text/csv;charset=utf-8', `seances-${fichier(annee().nom)}.csv`); };
  const exporterSequences = () => { const pid = progChoisie(); if (pid) telecharger(R.csvSequences(E, bilanDe(pid)), 'text/csv;charset=utf-8', `sequences-${fichier(prog(pid).nom)}.csv`); };

  // ---------- Ajout à l'écran d'accueil ----------
  // Explique comment enregistrer le template comme une application sur téléphone ou tablette.
  const appareil = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'autre';
  };
  const dejaInstalle = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let inviteInstallation = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); inviteInstallation = e; });
  window.addEventListener('appinstalled', () => { inviteInstallation = null; stock.ecrire(CLE_ACCUEIL, 'installe'); });

  const ETAPES_IOS = `<ol class="etapes-accueil">
      <li>Ouvre cette page dans <b>Safari</b>.</li>
      <li>Touche le bouton <b>Partager</b> (carré avec une flèche vers le haut). S'il n'est pas visible, touche d'abord <b>···</b>.</li>
      <li>Fais défiler et choisis <b>Sur l'écran d'accueil</b>.</li>
      <li>Laisse <b>Ouvrir comme app web</b> activé si l'option s'affiche, puis touche <b>Ajouter</b>.</li>
    </ol>`;
  const ETAPES_ANDROID = `<ol class="etapes-accueil">
      <li>Ouvre cette page dans <b>Chrome</b>.</li>
      <li>Touche le menu <b>⋮</b> en haut à droite.</li>
      <li>Choisis <b>Ajouter à l'écran d'accueil</b> (ou <b>Installer l'application</b>), puis <b>Installer</b>.</li>
    </ol>
    <p class="aide">Autre navigateur : cherche la même option dans son menu.</p>`;

  function modaleEcranAccueil(auto = false) {
    const a = appareil();
    const installable = a !== 'ios' && inviteInstallation;
    const blocs = a === 'ios' ? ETAPES_IOS
      : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre ta progression sur ton écran d'accueil : elle s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
    const pied = auto
      ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>'
      : '<button class="btn primaire" value="ok">Fermer</button>';
    ouvrirModale('Comme une application', corps, pied, (_, choix) => { if (choix === 'jamais') stock.ecrire(CLE_ACCUEIL, 'masque'); });
  }

  function proposerEcranAccueil() {
    if (dejaInstalle() || stock.lire(CLE_ACCUEIL)) return;
    if (appareil() === 'autre' && !matchMedia('(max-width:720px)').matches) return;
    setTimeout(() => { if (!modale().open && !dejaInstalle()) modaleEcranAccueil(true); }, 900);
  }

  async function installer() {
    if (!inviteInstallation) return;
    const invite = inviteInstallation; inviteInstallation = null;
    if (modale().open) modale().close();
    invite.prompt();
    const { outcome } = await invite.userChoice.catch(() => ({}));
    if (outcome === 'accepted') stock.ecrire(CLE_ACCUEIL, 'installe');
  }

  // ---------- Toast ----------
  let minuterieToast = null;
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  const LISTES = ['cr-', 'verbe-', 'etape-', 'rens-faite', 'rens-annulee', 'rens-detail'];
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    // Les boutons propres aux listes modifiables d'une modale sont gérés par la modale elle-même.
    if (LISTES.some((p) => action.startsWith(p))) { if (editionListe && modale().open) editionListe(action, el.dataset.i); return; }
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); oublier(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-seances': exporterSeances(); break;
      case 'csv-sequences': exporterSequences(); break;
      case 'fermer': modale().close(); break;
      case 'annee': modaleAnnee(id || null); break;
      case 'fermeture': modaleFermeture(id || null, el.dataset.type); break;
      case 'progression': modaleProgression(id || null); break;
      case 'sequence': modaleSequence(id || null, el.dataset.prog); break;
      case 'seance': modaleSeance(id || null, { prog: el.dataset.prog, date: el.dataset.date, duree: el.dataset.duree }); break;
      case 'preparer': modaleSeance(null, { prog: el.dataset.prog, date: el.dataset.date, duree: el.dataset.duree, statut: 'prevue' }); break;
      case 'rens-ouvrir': renseigner(el.dataset.prog, el.dataset.date, Number(el.dataset.duree), el.dataset.statut); break;
      case 'renseigner': modaleRenseigner(id); break;
      case 'modele': modaleModele(); break;
      case 'dupliquer': modaleDupliquer(id); break;
      case 'cahier': modaleCahier(); break;
      case 'supprimer-annee': supprimerAnnee(); break;
      case 'seq-haut': case 'seq-bas': retenir(); E = R.deplacerSequence(E, id, action === 'seq-haut' ? -1 : 1); sauver(); rendre(); break;
      case 'seq-terminer': {
        const s = sequence(id);
        if (!s) break;
        const der = E.seances.filter((y) => y.sequenceId === id && y.statut === 'faite').map((y) => y.date).sort().pop();
        modifier(() => { s.terminee = s.terminee ? null : (der || auj()); }, s.terminee ? `${s.titre} reprise.` : `${s.titre} terminée : la suite est recalculée.`);
        break;
      }
      case 'ferie': {
        const ign = new Set(E.reglages.feriesIgnores);
        if (el.checked) ign.delete(id); else ign.add(id);
        E.reglages.feriesIgnores = [...ign];
        sauver(); rendre();
        toast(el.checked ? 'Férié sans cours : heures recalculées.' : 'Férié compté comme un jour de cours.');
        break;
      }
      case 'aller-sequences': filtre.prog = id; changerVue('sequences'); break;
      case 'aller-frise': filtre.prog = id; changerVue('frise'); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (vue === 'frise' && E && Math.abs(window.innerWidth - largeur) > 60 && !modale().open) { largeur = window.innerWidth; rendre(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    session.code = code;
    try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
    try {
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
      if (statut === 401 || statut === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
      if (statut !== 200) throw new Error();
      if (corps.produit !== PRODUIT) return deconnecter('Cette clé ouvre un autre template QME.');
      session.jeton = corps.jeton;
      chargerDepuisServeur(corps.donnees);
    } catch {
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__progression = { etat: () => E, regles: R, bilan: (pid) => bilanDe(pid) };
  init();
})();
