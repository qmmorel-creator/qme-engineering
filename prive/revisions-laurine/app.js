// Révisions QME X Laurine : version privée du planning de révision QME (copie de templates/revision/,
// qui reste le template vendu et n'est pas modifié). Produit RVX, données et stockage local séparés du template
// de base. Ajouts issus de la visio du 26/11/2026 avec Laurine Mebs (Optimind Formation) : modèles Pomodoro,
// ordre du jour suggéré mais réordonnable, horaires par jour, thème clair / sombre / automatique, niveaux
// d'énergie, ressources (liens), feuille blanche sur les mots-clés, centre de notifications interne,
// auto-évaluation des séances, objectifs, import CSV, tutoriel en écrans.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REVR;
  const API = '/api/templates';
  const PRODUIT = 'RVX';
  const CLE_CODE = 'qme-rvx-code';
  const CLE_CACHE = 'qme-rvx-cache';
  const CLE_DEMO = 'qme-rvx-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rvx-ecran-accueil';
  const CLE_THEME = 'qme-rvx-theme';
  const NOM_PRODUIT = 'Révisions QME X Laurine';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  // Dates locales au format AAAA-MM-JJ (comparables comme des chaînes).
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return fmt(s);
  };

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  // Texte foncé sur les couleurs claires (jaune, orange, bleu ciel) : le blanc n'y atteint pas le contraste 4,5:1.
  const texteSur = (id) => (['jaune', 'orange', 'ciel'].includes(id) ? '#24221F' : '#fff');
  const methode = (id) => B.methodes.find((m) => m.id === id);

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code REV) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let jourChoisi = null;
  let annulation = null;

  // blancs : examens blancs faits ou passés ({ 'matiere|date': 'fait' | 'passe' }) ; focus : minutes de session guidée par jour.
  // Modèles Pomodoro de départ (les trois minuteurs du template de base), modifiables et supprimables.
  // travail 0 = sans minuteur (chronomètre).
  const POMODOROS_DEPART = () => [
    { id: 'pomo-25', nom: 'Pomodoro classique', travail: 25, pauseCourte: 5, pauseLongue: 15, cycles: 4 },
    { id: 'pomo-50', nom: 'Concentration longue', travail: 50, pauseCourte: 5, pauseLongue: 20, cycles: 3 },
    { id: 'pomo-0', nom: 'Sans minuteur (chronomètre)', travail: 0, pauseCourte: 0, pauseLongue: 0, cycles: 0 },
  ];
  const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];
  // Horaires de révision par jour de la semaine (clé = getDay(), 0 = dimanche).
  const HORAIRES_DEPART = () => ({
    1: { actif: true, debut: '18:00', fin: '20:00' }, 2: { actif: true, debut: '18:00', fin: '20:00' }, 3: { actif: true, debut: '14:00', fin: '17:00' },
    4: { actif: true, debut: '18:00', fin: '20:00' }, 5: { actif: true, debut: '18:00', fin: '19:30' }, 6: { actif: true, debut: '10:00', fin: '12:00' }, 0: { actif: false, debut: '10:00', fin: '12:00' },
  });
  const NIVEAUX = [['forte', 'Forte'], ['moyenne', 'Moyenne'], ['faible', 'Faible']];
  const RANG_NIVEAU = { forte: 0, moyenne: 1, faible: 2 };
  const libNiveau = (n) => (NIVEAUX.find(([id]) => id === n) || NIVEAUX[1])[1];
  // Créneaux d'énergie de la journée (« HH:MM »), définis par l'étudiant.
  const ENERGIE_DEPART = () => [
    { debut: '08:00', fin: '12:00', niveau: 'forte' }, { debut: '12:00', fin: '14:00', niveau: 'faible' },
    { debut: '14:00', fin: '18:00', niveau: 'moyenne' }, { debut: '18:00', fin: '23:00', niveau: 'faible' },
  ];
  const reglagesVides = () => ({ intervalles: [...B.intervalles], chargeMax: 8, examensBlancs: true, lecture: false, heureAgenda: '18:00', pomodoro: 25,
    pomodoros: POMODOROS_DEPART(), pomodoroDefaut: 'pomo-25', horaires: HORAIRES_DEPART(), energie: ENERGIE_DEPART(), theme: 'auto', objectifJours: 5, objectifJour: 6 });
  // ordre : ordre choisi par l'étudiant pour un jour ({ 'AAAA-MM-JJ': [ids] }) ; seances : auto-évaluations 1 à 5.
  const etatVide = () => ({ version: 2, prenom: '', filiere: null, tutorielVu: false, reglages: reglagesVides(), matieres: [], chapitres: [], blancs: {}, focus: {}, ordre: {}, seances: [], notifsLues: {} });
  const objet = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const enListe = (x) => (Array.isArray(x) ? x : []);
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const chapitres = enListe(d.chapitres).map((c) => ({ motsCles: '', historique: [], ressources: [], energie: null, ...c, appris: c.appris || null }));
    const matieres = enListe(d.matieres).map((m) => ({ energie: 'moyenne', ressources: [], ...m }));
    const reglages = { ...v.reglages, ...objet(d.reglages) };
    // Ancien réglage numérique (25, 50, 0) : devient le modèle par défaut correspondant.
    if (!Array.isArray(objet(d.reglages).pomodoros)) reglages.pomodoroDefaut = `pomo-${[25, 50, 0].includes(Number(reglages.pomodoro)) ? Number(reglages.pomodoro) : 25}`;
    if (!reglages.pomodoros.length) reglages.pomodoros = POMODOROS_DEPART();
    if (!reglages.pomodoros.some((p) => p.id === reglages.pomodoroDefaut)) reglages.pomodoroDefaut = reglages.pomodoros[0].id;
    reglages.horaires = { ...HORAIRES_DEPART(), ...objet(reglages.horaires) };
    if (!Array.isArray(reglages.energie)) reglages.energie = ENERGIE_DEPART();
    return { ...v, ...d, version: 2, reglages, matieres, chapitres, blancs: objet(d.blancs), focus: objet(d.focus), ordre: objet(d.ordre), seances: enListe(d.seances), notifsLues: objet(d.notifsLues) };
  };
  const matiere = (id) => E.matieres.find((m) => m.id === id);
  const chapitre = (id) => E.chapitres.find((c) => c.id === id);
  const examenFutur = (m, depuis = auj()) => (m?.examen && m.examen > depuis ? m.examen : null);

  // ---------- Planification ----------
  // Règles pures dans regles.js (window.REVR), testées par outils/templates/revision.test.mjs.
  const chargeDu = (date, sauf) => R.chargeDu(E, date, sauf);
  const planifier = (ch, depuis, etape) => R.planifier(E, ch, depuis, etape);
  const appliquerEvaluation = (ch, ev, date = auj()) => { delete ch.suggeree; return R.appliquerEvaluation(E, ch, ev, date); };
  const replanifier = (filtre) => R.replanifier(E, auj(), filtre);

  function apercu(ch, ev) {
    if (ch.finale) return 'terminé';
    const copie = structuredClone(ch);
    appliquerEvaluation(copie, ev);
    if (!copie.prochaine) return copie.etape >= E.reglages.intervalles.length ? 'maîtrisé' : 'avant l\'examen';
    return `dans ${ecart(auj(), copie.prochaine)} j`;
  }

  // appris = null : chapitre « à venir » (programme importé, pas encore vu en cours).
  function nouveauChapitre(matiereId, titre, appris, motsCles = '') {
    const ch = { id: uid(), matiereId, titre, appris: appris || null, etape: 0, prochaine: null, finale: false, finaleFaite: false, historique: [], motsCles };
    if (appris) planifier(ch, appris, 0);
    E.chapitres.push(ch);
    return ch;
  }

  // ---------- Énergie ----------
  const minutesDe = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const energieDe = (c) => c.energie || matiere(c.matiereId)?.energie || 'moyenne';
  // Niveau d'énergie du créneau en cours (null hors des créneaux définis).
  function creneauEnergie(date = new Date()) {
    const n = date.getHours() * 60 + date.getMinutes();
    return enListe(E.reglages.energie).find((x) => minutesDe(x.debut) <= n && n < minutesDe(x.fin)) || null;
  }

  // Suggestion du jour : retards d'abord ; puis les chapitres dont l'énergie requise correspond au créneau en cours
  // (à défaut, les plus proches) ; à égalité, matières prioritaires selon les notes (pack) et ordre alphabétique.
  // L'étudiant peut ensuite réordonner : E.ordre[jour] garde son ordre, « Revenir à la suggestion » l'efface.
  const suggestionDuJour = () => {
    const t = auj();
    const rang = new Map(prioritesPack().map((p, i) => [p.matiereId, i]));
    const r = (c) => (rang.has(c.matiereId) ? rang.get(c.matiereId) : 99);
    const cr = creneauEnergie();
    const e = (c) => (cr ? Math.abs(RANG_NIVEAU[energieDe(c)] - RANG_NIVEAU[cr.niveau]) : 0);
    const retard = (c) => (c.prochaine < t ? 0 : 1);
    return E.chapitres.filter((c) => c.prochaine && c.prochaine <= t)
      .sort((a, b) => retard(a) - retard(b) || e(a) - e(b) || a.prochaine.localeCompare(b.prochaine) || r(a) - r(b) || (matiere(a.matiereId)?.nom || '').localeCompare(matiere(b.matiereId)?.nom || ''));
  };
  const ordrePerso = () => Array.isArray(E.ordre?.[auj()]) && E.ordre[auj()].length > 0;
  const aReviser = () => {
    const sugg = suggestionDuJour();
    if (!ordrePerso()) return sugg;
    const pos = new Map(E.ordre[auj()].map((id, i) => [id, i]));
    // Chapitres ajoutés après le réordonnancement : à la fin, dans l'ordre suggéré.
    return [...sugg].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e3 + sugg.indexOf(a)) - (pos.has(b.id) ? pos.get(b.id) : 1e3 + sugg.indexOf(b)));
  };
  const faitsAujourdhui = () => {
    const t = auj();
    return E.chapitres.flatMap((c) => c.historique.filter((h) => h.date === t).map((h) => ({ c, h })));
  };

  // ---------- Pack Étudiant ----------
  // Les autres templates du pack ouverts sur cet appareil partagent le domaine : le planning lit leur
  // dernière copie locale (puis la version en ligne, avec leur propre jeton). Lecture seule : rien n'est écrit chez eux.
  const PACK = [
    { cle: 'notes', pre: 'nts', nom: 'Notes et moyennes', url: '/templates/notes/' },
    { cle: 'planner', pre: 'phr', nom: 'Planner horaire', url: '/templates/planner/' },
    { cle: 'habitudes', pre: 'hbt', nom: 'Suivi d\'habitudes', url: '/templates/habitudes/' },
  ];
  let pack = {};
  let packEnLigne = false;
  function lirePack() {
    pack = {};
    if (session.demo) { Object.assign(pack, E?.demoPack || {}); return; }
    for (const p of PACK) {
      const c = stock.lire(`qme-${p.pre}-cache`);
      if (c?.etat && c.jeton) pack[p.cle] = c.etat;
    }
  }
  async function rafraichirPack() {
    if (session.demo || packEnLigne) return;
    packEnLigne = true;
    let change = false;
    await Promise.all(PACK.map(async (p) => {
      const c = stock.lire(`qme-${p.pre}-cache`);
      if (!c?.jeton) return;
      try {
        const r = await fetch(`${API}/donnees`, { headers: { 'x-code': c.jeton } });
        const j = r.ok ? await r.json() : null;
        if (j?.donnees) { pack[p.cle] = j.donnees; change = true; }
      } catch { /* hors ligne : la copie locale suffit */ }
    }));
    if (change && E) rendre();
  }
  const prioritesPack = () => (pack.notes ? R.prioritesNotes(E, pack.notes) : []);

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }

  function sauver() {
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
        cache(false);
        rendre();
        toast('Un autre appareil a modifié ton planning entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
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
    // Au retour sur l'onglet : récupère la version d'un autre appareil, sauf modification en attente.
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
      }
    } catch { majSync('horsligne'); }
  }

  function majSync(etat) {
    if (etat === 'demo' && demoDiscrete()) etat = 'ok';
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Clé de bêta-test RVX-XXXX-XXXX-XXXX-XXXX (même mécanisme que les codes du template de base, produit dédié),
  // code administrateur ADM-…, ou clé de licence XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  const PREFIXES = [PRODUIT, 'ADM'];
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (PREFIXES.some((x) => n.startsWith(x))) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (PREFIXES.some((x) => n.startsWith(x)) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé inconnue. Copie-la telle qu\'elle t\'a été transmise par ton école ou par QME.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    // Clé d'un autre template : ne jamais écrire nos données dans son espace.
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre outil QME : elle ne donne pas accès à cette version privée.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    // Modifications faites hors ligne sur la version encore à jour du serveur : on les garde.
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E) { cache(false); demarrer(); } else ecranAccueil();
  }

  // Démo demandée par l'adresse (?demo, ?demo=pass&prenom=…) ; null = bouton de démo : on garde la démo déjà sur l'appareil.
  // `&reinit` repart des données de départ. Profils « discrets » (démo d'un partenaire, filmée comme son propre
  // espace) : ni bandeau « Mode démo », ni indicateur « Démo locale ».
  let demoDemandee = null;
  const PROFILS_DISCRETS = new Set(['droit-l1']);
  const demoDiscrete = () => session.demo && PROFILS_DISCRETS.has(E?.demoProfil);
  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const garde = stock.lire(CLE_DEMO);
    const voulue = demoDemandee || { profil: garde?.demoProfil || 'pass', prenom: '' };
    const memeDemo = garde && !voulue.reinit && (garde.demoProfil || 'pass') === voulue.profil && (!voulue.prenom || garde.prenom === voulue.prenom);
    E = memeDemo ? normaliser(garde) : donneesDemo(voulue.profil, voulue.prenom);
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app', 'lecture');
    ecranConnexion(message);
  }

  // ---------- Démonstration ----------
  // Trois profils simulés jour par jour depuis la rentrée (dates relatives à aujourd'hui) : `?demo` (Terminale),
  // `?demo=pass` (première année de santé) et `?demo=concours` (concours d'attaché territorial). `&prenom=` personnalise l'accueil. Tirages pseudo-aléatoires
  // à graine fixe : la même démo à chaque ouverture. Couvre tous les états : retards, révisions du jour,
  // faites ce matin, chapitres à venir, examen blanc dû, série en cours, données du Pack Étudiant.
  const DEMOS = {
    terminale: {
      prenom: 'Léa', filiere: 'terminale', debut: -70, pauses: [-31, -30, -45], retards: 2, manquees: 3,
      matieres: [
        ['Philosophie', 'rouge', 38, 4, ['La conscience|-60|conscience, réflexivité, Descartes, cogito, Husserl', 'L\'inconscient|-48|Freud, refoulement, lapsus, rêve, ça moi surmoi', 'Le devoir|-30|Kant, impératif catégorique, autonomie, morale', 'La justice|-12|Platon, Rawls, équité, égalité, loi', 'L\'art|']],
        ['Mathématiques', 'bleu', 52, 16, ['Suites numériques|-62|récurrence, suite géométrique, limite, monotone', 'Limites de fonctions|-50|asymptote, croissance comparée, forme indéterminée', 'Dérivation et convexité|-35|dérivée seconde, point d\'inflexion, convexe, tangente', 'Logarithme népérien|-14|ln, propriétés algébriques, dérivée 1/x, croissance comparée', 'Fonction exponentielle|-3|exp, e^x, dérivée, équation différentielle', 'Intégration|', 'Probabilités conditionnelles|']],
        ['SES', 'jaune', 52, 16, ['Croissance économique|-58|PGF, progrès technique, capital, institutions', 'Commerce international|-44|avantage comparatif, Ricardo, dotations factorielles, firmes multinationales', 'Chômage|-25|chômage structurel, conjoncturel, salaire minimum, appariement', 'Inégalités et justice sociale|-4|']],
        ['Histoire-géographie', 'encre', 61, 6, ['Guerre froide|-55|bipolarisation, Berlin, Cuba, détente, dissuasion', 'La Ve République|-33|Constitution 1958, de Gaulle, cohabitation, référendum', 'La décolonisation|-9|Algérie, Indochine, Bandung, tiers-monde']],
        ['Anglais', 'vert', null, 0, ['Irregular verbs|-50|', 'Essay writing|-20|thesis, linking words, conclusion']],
      ],
      notes: { 'Philosophie': [9, 11.5], 'Mathématiques': [12, 13.5], 'SES': [10.5], 'Histoire-géographie': [14], 'Anglais': [15] },
      planner: { cours: [[0, 8 * 60, 9 * 60], [1, 8 * 60, 9 * 60], [2, 8 * 60, 4 * 60], [3, 8 * 60, 9 * 60], [4, 8 * 60, 8 * 60]], autres: [[2, 14 * 60, 120, 'Sport']] },
    },
    pass: {
      prenom: 'Inès', filiere: 'pass', debut: -75, pauses: [-24, -41, -42, -57], retards: 3, manquees: 9,
      matieres: [
        ['Biochimie', 'rouge', 29, 4, ['Acides aminés et protéines|-70|acide aminé, liaison peptidique, structure primaire, hélice alpha, feuillet bêta', 'Enzymologie|-56|site actif, énergie d\'activation, Michaelis-Menten, Km, Vmax, inhibition compétitive', 'Glucides|-45|aldose, cétose, forme cyclique, liaison osidique, glycogène', 'Lipides|-33|acide gras, triglycéride, phospholipide, cholestérol, bicouche', 'Glycolyse|-19|hexokinase, phosphofructokinase, ATP, NADH, pyruvate', 'Cycle de Krebs|-6|acétyl-CoA, citrate, NADH, FADH2, GTP', 'Chaîne respiratoire|', 'Néoglucogenèse|']],
        ['Biologie cellulaire', 'bleu', 29, 4, ['Membrane plasmique|-71|bicouche lipidique, protéines membranaires, fluidité, glycocalyx', 'Transports membranaires|-58|diffusion facilitée, transport actif, pompe Na/K, canal, gradient', 'Cytosquelette|-42|actine, microtubules, filaments intermédiaires, kinésine, dynéine', 'Noyau et chromatine|-28|enveloppe nucléaire, pore nucléaire, euchromatine, hétérochromatine, nucléole', 'Cycle cellulaire et mitose|-12|phase G1, phase S, prophase, métaphase, anaphase, télophase', 'Méiose|-2|', 'Mort cellulaire|']],
        ['Anatomie', 'jaune', 30, 3, ['Généralités et plans anatomiques|-72|plan sagittal, plan frontal, plan transversal, proximal, distal', 'Ostéologie du membre supérieur|-60|scapula, clavicule, humérus, radius, ulna', 'Myologie du membre supérieur|-46|deltoïde, biceps brachial, triceps, coiffe des rotateurs', 'Ostéologie du membre inférieur|-30|os coxal, fémur, tibia, fibula, patella', 'Arthrologie de la hanche|-13|acétabulum, tête fémorale, labrum, ligament ilio-fémoral', 'Cœur : configuration externe|']],
        ['Physiologie', 'vert', 30, 3, ['Compartiments liquidiens|-66|secteur intracellulaire, secteur extracellulaire, osmolarité, pression oncotique', 'Potentiel de membrane|-52|potentiel de repos, Nernst, potassium, pompe Na/K', 'Potentiel d\'action|-38|dépolarisation, canaux sodiques, seuil, repolarisation, période réfractaire', 'Transmission synaptique|-17|neurotransmetteur, exocytose, récepteur, potentiel post-synaptique', 'Physiologie cardiaque|']],
        ['Biophysique', 'encre', 31, 3, ['États de la matière et solutions|-68|molarité, osmolalité, pression osmotique, Van\'t Hoff', 'Thermodynamique|-50|enthalpie, entropie, enthalpie libre, premier principe', 'Radioactivité|-35|désintégration, période radioactive, activité, becquerel', 'Rayonnements ionisants|-21|effet photoélectrique, effet Compton, dose absorbée, gray']],
        ['Biostatistiques', 'ciel', 10, 2, ['Probabilités|-64|événement, probabilité conditionnelle, indépendance, Bayes', 'Variables aléatoires|-49|espérance, variance, loi binomiale, loi de Poisson', 'Loi normale|-31|centrée réduite, écart-type, table, 1,96', 'Estimation et intervalles de confiance|-15|estimateur, intervalle de confiance, risque alpha', 'Tests d\'hypothèse|-4|']],
        ['Chimie', 'orange', 31, 3, ['Atomistique|-69|orbitale, nombres quantiques, configuration électronique, Klechkowski', 'Liaisons chimiques|-54|liaison covalente, électronégativité, VSEPR, hybridation', 'Stéréochimie|-37|chiralité, énantiomère, Cahn-Ingold-Prelog, configuration R S', 'Acides et bases|-20|pKa, pH, Henderson-Hasselbalch, solution tampon', 'Cinétique chimique|-8|']],
        ['Sciences humaines et sociales', 'prune', 32, 2, ['Histoire de la médecine|-62|Hippocrate, Vésale, Pasteur, méthode anatomo-clinique', 'Éthique et bioéthique|-27|autonomie, bienfaisance, non-malfaisance, justice, consentement', 'Santé publique|']],
      ],
      notes: { 'Biochimie': [9.5, 11], 'Biologie cellulaire': [13], 'Anatomie': [14.5], 'Physiologie': [10], 'Biophysique': [8.5], 'Biostatistiques': [12], 'Chimie': [11.5], 'Sciences humaines et sociales': [13] },
      planner: { cours: [[0, 8 * 60, 8 * 60 + 30], [1, 8 * 60, 9 * 60], [2, 8 * 60, 4 * 60], [3, 8 * 60, 9 * 60], [4, 8 * 60, 8 * 60]], autres: [[1, 18 * 60, 120, 'Tutorat'], [3, 18 * 60, 120, 'Tutorat'], [2, 17 * 60 + 30, 90, 'Natation']] },
    },
    // Candidate au concours externe d'attaché territorial, en poste : écrits dans sept semaines, oral ensuite.
    concours: {
      prenom: 'Claire', filiere: 'concours', graine: 2028, debut: -75, pauses: [-27, -28, -48, -62], retards: 3, manquees: 7,
      matieres: [
        ['Note de synthèse', 'rouge', 51, 4, ['Méthode : lecture du dossier|-70|tri des documents, idées clés, grille de lecture, documents secondaires', 'Plan et problématique|-56|problématique, plan en deux parties, titres apparents, annonce de plan', 'Rédaction en temps limité|-41|gestion du temps, citation des documents, neutralité, introduction courte', 'Dossier : politique de la ville|-25|quartiers prioritaires, contrat de ville, rénovation urbaine, mixité sociale', 'Dossier : accueil de la petite enfance|-9|crèche, CAF, schéma départemental, assistantes maternelles', 'Dossier : mobilités du quotidien|']],
        ['Culture générale', 'bleu', 52, 4, ['Méthode de la composition|-72|problématique, plan, transitions, exemples, conclusion ouverte', 'État et décentralisation|-58|actes de décentralisation, libre administration, déconcentration, subsidiarité', 'Laïcité|-44|loi de 1905, neutralité du service public, liberté de conscience, Conseil d\'État', 'Transition écologique|-29|neutralité carbone, sobriété, adaptation, accord de Paris', 'Numérique et services publics|-13|dématérialisation, fracture numérique, inclusion, données personnelles', 'Santé et territoires|']],
        ['Droit public', 'encre', 52, 3, ['Sources du droit administratif|-69|hiérarchie des normes, bloc de constitutionnalité, loi, règlement, jurisprudence', 'Actes administratifs unilatéraux|-54|décision, règlement, retrait, abrogation, motivation', 'Contrats administratifs|-39|marché public, concession, clauses exorbitantes, commande publique', 'Responsabilité administrative|-23|faute de service, faute personnelle, responsabilité sans faute, arrêt Blanco', 'Collectivités territoriales|-7|commune, département, région, contrôle de légalité, compétences', 'Contentieux administratif|']],
        ['Finances publiques', 'jaune', 52, 3, ['Principes budgétaires|-66|annualité, unité, universalité, spécialité, sincérité', 'La LOLF|-50|mission, programme, action, performance, fongibilité asymétrique', 'Budget des collectivités|-34|section de fonctionnement, section d\'investissement, équilibre réel, débat d\'orientation budgétaire', 'Fiscalité et dotations locales|-17|taxe foncière, CFE, dotation globale de fonctionnement, péréquation', 'Dette publique et règles européennes|']],
        ['Questions sociales', 'vert', 52, 2, ['Protection sociale|-63|sécurité sociale, branches, assurance, assistance, solidarité', 'Action sociale du département|-37|RSA, APA, aide sociale à l\'enfance, PCH', 'Emploi et insertion|-14|France Travail, insertion par l\'activité économique, contrat d\'engagement jeune']],
        ['Oral d\'entretien', 'prune', 115, 5, ['Présentation de parcours (3 min)|-31|parcours, fil conducteur, compétences, motivation, conclusion', 'Motivation et projection dans le poste|-18|métier d\'attaché, encadrement, service public, projet professionnel', 'Environnement territorial|-4|intercommunalité, élus, directeur général des services, budget de la collectivité', 'Mises en situation|']],
      ],
      notes: { 'Note de synthèse': [9, 11.5], 'Culture générale': [10, 12], 'Droit public': [13], 'Finances publiques': [11], 'Questions sociales': [12.5] },
      planner: { titre: 'Travail', cours: [[0, 9 * 60, 8 * 60], [1, 9 * 60, 8 * 60], [2, 9 * 60, 5 * 60], [3, 9 * 60, 8 * 60], [4, 9 * 60, 7 * 60]], autres: [[2, 18 * 60, 90, 'Coaching oral (visio)'], [5, 9 * 60, 240, 'Concours blanc']] },
    },
    // Élève de première, spécialité maths (pages /demo/corinne et /demo/ines) : bac blanc de maths la deuxième
    // semaine de janvier, automatismes de l'épreuve anticipée le lundi, spécialité le mercredi.
    maths: {
      prenom: 'Sarah', filiere: 'premiere', graine: 2032, partiels: true, debut: -72, pauses: [-22, -23, -40], retards: 2, manquees: 4,
      matieres: [
        ['Automatismes', 'rouge', 0, 2, ['Calcul fractionnaire|-68|somme de fractions, produit, inverse, simplification', 'Puissances et racines carrées|-58|puissance d\'un produit, exposant négatif, notation scientifique, racine carrée', 'Pourcentages et évolutions|-47|coefficient multiplicateur, taux d\'évolution, évolutions successives, évolution réciproque', 'Équations et inéquations|-34|équation produit nul, inéquation, changement de sens, ensemble de solutions', 'Lecture graphique|-20|image, antécédent, signe d\'une fonction, coefficient directeur', 'Proportionnalité et conversions|-7|produit en croix, échelle, vitesse, unités', 'Statistiques descriptives|']],
        ['Analyse', 'bleu', 2, 6, ['Second degré|-70|discriminant, racines, forme canonique, signe du trinôme', 'Suites numériques|-55|suite arithmétique, suite géométrique, terme général, somme des termes', 'Dérivation|-41|nombre dérivé, tangente, dérivée d\'un produit, dérivée d\'un quotient', 'Variations et extremums|-26|signe de la dérivée, tableau de variations, maximum, minimum', 'Fonction exponentielle|-9|exp, e^x, dérivée de e^x, croissance, e^(a+b)', 'Trigonométrie|', 'Algorithmique et Python|']],
        ['Géométrie', 'jaune', 2, 3, ['Produit scalaire|-49|projeté orthogonal, cosinus, norme, orthogonalité', 'Géométrie repérée|-29|équation cartésienne, vecteur normal, équation de cercle', 'Applications du produit scalaire|-3|Al-Kashi, formule de la médiane, ensemble de points']],
        ['Probabilités', 'vert', 2, 3, ['Probabilités conditionnelles|-44|arbre pondéré, probabilité de B sachant A, probabilités totales, indépendance', 'Variables aléatoires|-15|loi de probabilité, espérance, variance, écart-type', 'Répétition d\'épreuves indépendantes|']],
      ],
      notes: { 'Automatismes': [14, 15.5], 'Analyse': [9.5, 11], 'Géométrie': [12], 'Probabilités': [13.5] },
      planner: { cours: [[0, 8 * 60, 9 * 60], [1, 8 * 60, 8 * 60], [2, 8 * 60, 4 * 60], [3, 8 * 60, 9 * 60], [4, 8 * 60, 7 * 60]], autres: [[2, 14 * 60, 90, 'Défi maths de la semaine'], [5, 10 * 60, 120, 'Annales d\'automatismes']] },
    },
    // Étudiante en L1 de droit (page /demo/odelia) : partiels du semestre 1 la deuxième semaine de janvier
    // (`partiels` : examens en jours décalés depuis le lundi des partiels, voir datePartiels).
    'droit-l1': {
      prenom: 'Jade', filiere: 'droit', graine: 2030, partiels: true, debut: -72, pauses: [-23, -24, -44], retards: 2, manquees: 4,
      matieres: [
        ['Introduction au droit', 'rouge', 0, 4, ['La notion de droit|-70|règle de droit, caractères, sanction, droit objectif, droits subjectifs', 'Les sources du droit|-58|loi, règlement, hiérarchie des normes, Constitution, traités', 'La jurisprudence|-44|Cour de cassation, arrêt, revirement, article 5 du Code civil', 'La coutume et la doctrine|-30|usage, opinio necessitatis, doctrine, autorité', 'Application de la loi dans le temps|-16|non-rétroactivité, article 2 du Code civil, effet immédiat, survie de la loi ancienne', 'La preuve des droits|-5|charge de la preuve, article 1353, acte authentique, acte sous signature privée', 'Les personnes juridiques|', 'Le patrimoine|']],
        ['Droit constitutionnel', 'bleu', 2, 4, ['L\'État|-68|territoire, population, souveraineté, État unitaire, État fédéral', 'La Constitution|-55|constitution souple, constitution rigide, pouvoir constituant, révision', 'La séparation des pouvoirs|-41|Montesquieu, régime parlementaire, régime présidentiel, responsabilité politique', 'Le contrôle de constitutionnalité|-27|Conseil constitutionnel, bloc de constitutionnalité, QPC, contrôle a priori', 'Le régime britannique|-12|Parlement, Premier ministre, cabinet, bipartisme', 'Le régime américain|', 'Les modes de scrutin|']],
        ['Histoire du droit', 'jaune', 4, 3, ['Le droit romain|-66|Loi des XII Tables, Justinien, Corpus juris civilis, ius civile', 'Le droit franc|-50|personnalité des lois, loi salique, capitulaires', 'La féodalité|-36|seigneurie, vassalité, fief, hommage', 'La renaissance du droit romain|-20|Bologne, glossateurs, droit savant, commentateurs', 'L\'affirmation du pouvoir royal|-6|', 'La rédaction des coutumes|']],
        ['Économie politique', 'vert', 7, 2, ['Les grands courants|-62|Smith, Ricardo, Marx, Keynes', 'Le marché|-40|offre, demande, prix d\'équilibre, élasticité', 'La monnaie|-18|fonctions de la monnaie, création monétaire, banque centrale', 'La croissance|']],
      ],
      notes: { 'Introduction au droit': [8.5, 8], 'Droit constitutionnel': [10, 9], 'Histoire du droit': [10.5], 'Économie politique': [9.5] },
      planner: { cours: [[0, 8 * 60 + 30, 4 * 60], [1, 8 * 60 + 30, 6 * 60 + 30], [2, 8 * 60 + 30, 4 * 60], [3, 8 * 60 + 30, 6 * 60 + 30], [4, 10 * 60 + 45, 90]], autres: [[0, 14 * 60, 180, 'BU · fiches'], [2, 14 * 60, 180, 'BU · fiches'], [1, 19 * 60 + 45, 60, 'Sport'], [3, 19 * 60 + 45, 60, 'Sport']] },
    },
  };
  // Profil `partiels` : lundi de la deuxième semaine de janvier qui suit (ni pendant les fêtes, ni un week-end) ;
  // à défaut (moins de deux semaines avant), dans six semaines.
  const jourOuvre = (s) => { const j = versDate(s).getDay(); return j === 6 ? ajout(s, 2) : j === 0 ? ajout(s, 1) : s; };
  function datePartiels(t) {
    let d = `${Number(t.slice(0, 4)) + (Number(t.slice(5, 7)) >= 8 ? 1 : 0)}-01-05`;
    while (versDate(d).getDay() !== 1) d = ajout(d, 1);
    return d > ajout(t, 14) ? d : jourOuvre(ajout(t, 41));
  }

  function aleatoire(graine) {
    let a = graine >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }

  function donneesDemo(profil = 'pass', prenom = '') {
    const def = DEMOS[profil] || DEMOS.pass;
    const hasard = aleatoire(def.graine || (profil === 'pass' ? 2027 : 2026));
    E = etatVide();
    E.prenom = prenom || def.prenom; E.filiere = def.filiere; E.demoProfil = profil;
    E.tutorielVu = false;
    const t = auj();
    // Sommeil simulé (pack Habitudes), qui influence légèrement la réussite des révisions du lendemain.
    const sommeil = {};
    for (let i = def.debut; i <= 0; i++) sommeil[ajout(t, i)] = Math.round((5.5 + hasard() * 3) * 2) / 2;
    const prevus = []; // [matiereId, titre, jourAppris, motsCles]
    def.matieres.forEach(([nom, c, examen, , chapitres]) => {
      const date = examen === null ? null : def.partiels ? jourOuvre(ajout(datePartiels(t), examen)) : ajout(t, examen);
      const m = { id: uid(), nom, couleur: c, examen: date };
      E.matieres.push(m);
      chapitres.forEach((ligne) => {
        const [titre, jour, cles] = ligne.split('|');
        if (jour === '' || jour === undefined) nouveauChapitre(m.id, titre, null);
        else prevus.push([m.id, titre, Number(jour), cles || '']);
      });
    });
    const avenir = E.chapitres.splice(0);
    for (let i = def.debut; i < 0; i++) {
      const d = ajout(t, i);
      prevus.filter((x) => x[2] === i).forEach(([mid, titre, , cles]) => nouveauChapitre(mid, titre, d, cles));
      if (def.pauses.includes(i)) continue;
      let dus = E.chapitres.filter((c) => c.prochaine && c.prochaine <= d);
      if (i >= -3) dus = dus.slice(0, Math.max(1, dus.length - def.retards)); // quelques révisions laissées en retard
      // Jour sans révision prévue : l'élève avance la suivante (bouton « Réviser aujourd'hui »).
      if (!dus.length) dus = E.chapitres.filter((c) => c.prochaine && c.prochaine > d).sort((x, y) => x.prochaine.localeCompare(y.prochaine)).slice(0, 1);
      if (!dus.length) continue;
      const fatigue = sommeil[d] < 7 ? 0.15 : 0;
      dus.forEach((c) => {
        const r = hasard();
        appliquerEvaluation(c, r < 0.1 + fatigue ? 'difficile' : r < 0.62 + fatigue / 2 ? 'moyen' : 'facile', d);
      });
      if (i > -35 && hasard() < 0.7) E.focus[d] = Math.round(dus.length * (10 + hasard() * 8));
    }
    // Un week-end chargé : quelques révisions des jours suivants n'ont pas été faites samedi et dimanche.
    E.chapitres.filter((c) => c.prochaine && c.prochaine > t && c.prochaine <= ajout(t, 14)).slice(0, def.manquees || 0)
      .forEach((c, k) => { c.prochaine = ajout(t, k % 2 ? -1 : -2); });
    // Aujourd'hui : deux révisions faites ce matin, en session guidée.
    E.chapitres.filter((c) => c.prochaine && c.prochaine === t).slice(-2).forEach((c) => appliquerEvaluation(c, 'facile', t));
    if (E.chapitres.some((c) => c.historique.some((h) => h.date === t))) E.focus[t] = 24;
    E.chapitres.push(...avenir);
    E.demoPack = demoPack(def, E, sommeil, t, hasard);
    enrichirDemo(def, t, hasard);
    return E;
  }

  // Ajouts de la version privée sur les données d'exemple : énergie requise par matière (et quelques cours),
  // liens de ressources fictifs, auto-évaluations des séances passées. Profil PASS : énergie détaillée.
  const ENERGIE_DEMO = { 'Biochimie': 'forte', 'Biophysique': 'forte', 'Biostatistiques': 'forte', 'Chimie': 'moyenne', 'Anatomie': 'moyenne', 'Physiologie': 'moyenne', 'Biologie cellulaire': 'moyenne', 'Sciences humaines et sociales': 'faible' };
  function enrichirDemo(def, t, hasard) {
    const lien = (m) => m.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    E.matieres.forEach((m, i) => {
      m.energie = ENERGIE_DEMO[m.nom] || ['forte', 'moyenne', 'faible'][i % 3];
      m.ressources = [
        { titre: `Cours de ${m.nom} (Drive)`, url: `https://drive.google.com/drive/folders/exemple-${lien(m)}` },
        ...(i % 2 ? [] : [{ titre: 'Fiches Notion', url: `https://www.notion.so/exemple-fiches-${lien(m)}` }]),
      ];
    });
    E.chapitres.forEach((c, k) => {
      if (/Michaelis|Glycolyse|Krebs|Potentiel d'action|Loi normale|Tests d'hypothèse/.test(c.titre)) c.energie = 'forte';
      if (/Histoire de la médecine|Généralités/.test(c.titre)) c.energie = 'faible';
      if (k % 7 === 0 && c.appris) c.ressources = [{ titre: 'Annales corrigées', url: 'https://drive.google.com/drive/folders/exemple-annales' }];
    });
    // Séances passées auto-évaluées (1 à 5) : une par jour de session guidée.
    E.seances = Object.entries(E.focus).filter(([d]) => d < t).map(([d, minutes]) => ({ date: d, note: Math.min(5, Math.max(1, Math.round(2.5 + hasard() * 2.6))), minutes, n: Math.max(1, Math.round(minutes / 14)) }));
    E.reglages.theme = 'auto';
  }

  // Données d'exemple des autres templates du Pack Étudiant (format réduit de leurs états).
  function demoPack(def, etat, sommeil, t, hasard) {
    const notes = { matieres: [], notes: [] };
    def.matieres.forEach(([nom, , examen, coef]) => {
      const id = uid();
      notes.matieres.push({ id, nom, coef: coef || 1 });
      (def.notes[nom] || []).forEach((v, k) => notes.notes.push({ id: uid(), matiere: id, valeur: v, sur: 20, coef: 1, date: ajout(t, -40 + k * 18), prevue: false }));
      if (examen && examen < 15) notes.notes.push({ id: uid(), matiere: id, sur: 20, coef: 1, date: ajout(etat.matieres.find((m) => m.nom === nom).examen, 0), prevue: true });
    });
    const depuis = ajout(t, -120);
    const series = [
      ...def.planner.cours.map(([j, debut, duree]) => ({ id: uid(), titre: def.planner.titre || 'Cours', jours: [j], debut, duree, depuis, jusqua: null, exceptions: {} })),
      ...def.planner.autres.map(([j, debut, duree, titre]) => ({ id: uid(), titre, jours: [j], debut, duree, depuis, jusqua: null, exceptions: {} })),
    ];
    const journal = {};
    Object.entries(sommeil).forEach(([d, h]) => { if (d >= ajout(t, -40) && hasard() < 0.85) journal[d] = { 'sommeil-heures': h }; });
    return { notes, planner: { reglages: { debut: 7 * 60, fin: 22 * 60 }, blocs: [], series }, habitudes: { journal } };
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = NOM_PRODUIT;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="130" cy="150" r="130" fill="#D9302A"/>
          <circle cx="130" cy="150" r="48" fill="#141414"/>
          <rect x="290" y="20" width="260" height="260" fill="#1D4E89"/>
          <path d="M290 280 A260 260 0 0 1 550 20 V280 Z" fill="#F5B400"/>
          <rect x="250" y="262" width="40" height="18" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Révisions QME X Laurine · version bêta privée</p>
          <h1>Dernière ligne droite de l'année.</h1>
          <p>Le second semestre se joue maintenant&nbsp;: chaque cours revient au bon moment (J+1, J+3, J+7, J+14, J+30), à ton rythme, selon ton énergie et tes horaires, jusqu'au jour de l'examen.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès bêta-testeur</p>
          <h2>Ouvre ton planning</h2>
        </div>
        <p>Saisis la clé d'accès transmise par ton école ou par QME. Tes révisions sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="RVX-XXXX-XXXX-XXXX-XXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon planning</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec un exemple PASS médecine</button>
        <p class="mention">La démo utilise des données fictives, reste sur cet appareil et n'envoie rien. Clé perdue ou retour de bêta-test&nbsp;: écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle a la forme RVX-XXXX-XXXX-XXXX-XXXX.'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon planning'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', filiere: null, choisies: new Set(), libres: [] };

  function ecranAccueil() {
    const a = accueil;
    const f = B.filieres.find((x) => x.id === a.filiere);
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Dernière ligne droite de l'année</p>
        <h1>On prépare ton planning.</h1>
        <p class="intro">Deux questions, puis tu pourras ajouter tes premiers chapitres. Tout reste modifiable ensuite.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Ta formation <span>Les matières sont préremplies selon ton choix.</span></h2>
        <div class="filieres" role="group" aria-label="Formation">
          ${B.filieres.map((x, i) => `<button type="button" class="filiere" style="--c:${couleur(['rouge', 'bleu', 'jaune', 'encre'][i % 4])}" data-action="filiere" data-id="${x.id}" aria-pressed="${a.filiere === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="filiere" data-id="libre" aria-pressed="${a.filiere === 'libre'}"><b>Autre / personnalisé</b><span>Je crée mes matières moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.filiere ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const liste = [...(f ? f.matieres : []), ...a.libres];
      corps = `
        <p class="surtitre">${esc(f ? f.nom : 'Personnalisé')}</p>
        <h1>Quelles matières révises-tu ?</h1>
        <p class="intro">Décoche celles qui ne te concernent pas. Tu ajouteras les dates d'examen depuis l'onglet Matières : les révisions se caleront dessus.</p>
        ${liste.length ? `<div class="choix-matieres">${liste.map((nom) => `<label class="case"><input type="checkbox" data-action="choix-matiere" value="${esc(nom)}" ${a.choisies.has(nom) ? 'checked' : ''}> ${esc(nom)}</label>`).join('')}</div>` : ''}
        <form class="ajout-libre" id="form-libre">
          <label class="champ">Ajouter une matière<input id="libre" maxlength="60" placeholder="Ex. : Économie approfondie"></label>
          <button class="btn" style="align-self:flex-end">Ajouter</button>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.choisies.size ? '' : 'disabled'}>Créer mon planning (${pluriel(a.choisies.size, 'matière')})</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#form-libre')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = $('#libre').value.trim();
      if (nom && !accueil.libres.includes(nom)) { accueil.libres.push(nom); accueil.choisies.add(nom); }
      ecranAccueil();
      $('#libre').focus();
    });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    E.filiere = accueil.filiere;
    [...accueil.choisies].forEach((nom, i) => E.matieres.push({ id: uid(), nom, couleur: B.couleurs[i % B.couleurs.length].id, examen: null }));
    accueil = { etape: 1, prenom: '', filiere: null, choisies: new Set(), libres: [] };
    sauver();
    demarrer(); // le guide « Comment ça marche » s'ouvre, puis propose d'ajouter le premier chapitre
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    matieres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    methodes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    agenda: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2"/></svg>',
    cloche: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    lien: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    poignee: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="9" cy="6" r="1.6" fill="currentColor"/><circle cx="15" cy="6" r="1.6" fill="currentColor"/><circle cx="9" cy="12" r="1.6" fill="currentColor"/><circle cx="15" cy="12" r="1.6" fill="currentColor"/><circle cx="9" cy="18" r="1.6" fill="currentColor"/><circle cx="15" cy="18" r="1.6" fill="currentColor"/></svg>',
    partage: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 13v7h14v-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['planning', 'Planning'], ['matieres', 'Matières'], ['methodes', 'Méthodes'], ['bilan', 'Bilan']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo && !demoDiscrete() ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Révisions QME<br>X Laurine</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone cloche" data-action="notifications" aria-label="Notifications" title="Notifications" aria-haspopup="dialog">${ICONES.cloche}<span class="pastille-notif" hidden></span></button>
        <button class="btn-icone" data-action="tutoriel" aria-label="Tutoriel" title="Tutoriel">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    document.body.classList.toggle('lecture', !!E.reglages.lecture);
    appliquerTheme(E.reglages.theme);
    lirePack();
    rendre();
    rafraichirPack();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { aujourdhui: 'Aujourd\'hui', planning: 'Planning', matieres: 'Matières', methodes: 'Méthodes', bilan: 'Bilan' };
    document.title = `${titres[vue]} · ${NOM_PRODUIT}`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, planning: vuePlanning, matieres: vueMatieres, methodes: vueMethodes, bilan: vueBilan }[vue]();
    if (vue === 'bilan') brancherGraphique();
    if (vue === 'aujourdhui') brancherGlisser();
    majPastilleNotifs();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const points = (etape) => `<span class="points" role="img" aria-label="Étape ${Math.min(etape, E.reglages.intervalles.length)} sur ${E.reglages.intervalles.length}">${E.reglages.intervalles.map((_, i) => `<i class="${i < etape ? 'plein' : ''}"></i>`).join('')}</span>`;

  function prochainExamen() {
    const t = auj();
    return E.matieres.filter((m) => m.examen && m.examen >= t).sort((a, b) => a.examen.localeCompare(b.examen))[0];
  }

  // Durée indicative d'une révision en minutes (« 10 à 20 min » → 10, « 25 + 5 min » → 25), plafonnée à
  // 30 min : un sujet d'annales complet relève de l'examen blanc, pas de la révision d'un chapitre.
  function dureeMethode(m) {
    const x = /(\d+)\s*(?:à\s*\d+\s*)?(h|min)/.exec(m?.duree || '');
    return x ? Math.min(30, Number(x[1]) * (x[2] === 'h' ? 60 : 1)) : 15;
  }
  const methodeDe = (c) => methode(c.finale ? 'fiche' : B.methodeParEtape[Math.min(c.etape, B.methodeParEtape.length - 1)]);
  const dureeSession = (liste) => liste.reduce((s, c) => s + dureeMethode(methodeDe(c)), 0);
  const heureTexte = (min) => `${Math.floor(min / 60)} h${min % 60 ? ` ${deux(min % 60)}` : ''}`;
  const dureeTexte = (min) => (min < 60 ? `${min} min` : heureTexte(min).replace(/ h$/, ' h'));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  // Jauge « Prêt pour le jour J » (carte d'examen et matières).
  function blocJauge(m, compact = false) {
    const j = R.jauge(E, m.id, auj());
    if (j.solidesJourJ === null || !j.total) return '';
    const vus = j.total;
    return `<div class="jauge ${compact ? 'compacte' : ''}">
      <div class="jauge-barre" role="img" aria-label="${j.solidesAujourdhui} chapitres solides aujourd'hui, ${j.solidesJourJ} projetés le jour de l'examen, sur ${vus}"><i style="width:${pct(j.solidesAujourdhui, vus)}%"></i><i class="projete" style="width:${pct(j.solidesJourJ - j.solidesAujourdhui, vus)}%"></i></div>
      <p><b>${j.solidesJourJ}/${vus}</b> chapitres solides le jour J si tu suis le planning <span>(${j.solidesAujourdhui} aujourd'hui${j.aVenir ? `, ${j.aVenir} pas encore vu${j.aVenir > 1 ? 's' : ''}` : ''})</span></p>
      ${compact ? '' : '<button type="button" class="jauge-info" data-action="jauge-info">Comment c\'est calculé</button>'}
    </div>`;
  }

  // Aujourd'hui
  function vueAujourdhui() {
    const t = auj();
    const liste = aReviser();
    const faits = faitsAujourdhui();
    const retards = liste.filter((c) => c.prochaine < t).length;
    const blancs = R.examensBlancs(E, t).filter((b) => b.du);
    const total = liste.length + faits.length;
    const ex = prochainExamen();
    const jours = ex ? ecart(t, ex.examen) : null;
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const titre = !E.matieres.length ? `${salut}Commence par tes matières.`
      : liste.length ? `${salut}<mark>${pluriel(liste.length, 'révision')}</mark> ${faits.length ? 'restantes' : 'aujourd\'hui'}.`
        : faits.length ? `${salut}<mark>Tout est fait</mark> pour aujourd'hui.` : `${salut}Rien à réviser aujourd'hui.`;

    const carteExamen = ex
      ? `<aside class="examen-carte ${jours > 30 ? 'calme' : ''}"><p class="surtitre">Prochain examen</p><div class="compte">${jours === 0 ? 'Jour J' : `J-${jours}`}</div><p>${esc(ex.nom)} · ${fmt(ex.examen, { weekday: 'long', day: 'numeric', month: 'long' })}</p>${jours > 0 ? blocJauge(ex) : ''}</aside>`
      : `<aside class="examen-carte vide"><p class="surtitre">Prochain examen</p><p>Aucune date d'examen. Ajoute-la dans une matière : les révisions se termineront la veille.</p><button class="btn petit" data-action="vue" data-vue="matieres">Ajouter une date</button></aside>`;

    // Plan de rattrapage : proposé dès que les retards ne tiennent plus dans la journée.
    const plan = retards ? R.planRattrapage(E, t) : null;
    const alerteRattrapage = plan && plan.jours.length > 1
      ? `<div class="alerte rattrapage"><div><b>${pluriel(retards, 'révision')} en retard.</b> Inutile de tout faire aujourd'hui : je peux les répartir sur ${pluriel(plan.jours.length, 'jour')}, sans dépasser ${E.reglages.chargeMax} par jour, en commençant par l'examen le plus proche.</div><button class="btn petit primaire" data-action="rattrapage">Voir le plan</button></div>` : '';

    // Créneau libre d'après le Planner horaire du pack.
    let creneau = '';
    if (pack.planner && liste.length) {
      const maintenant = new Date();
      const besoin = Math.min(90, Math.max(30, dureeSession(liste)));
      const libre = R.creneauxLibres(pack.planner, t, { minimum: besoin, depuis: maintenant.getHours() * 60 + maintenant.getMinutes() })[0]
        || R.creneauxLibres(pack.planner, t, { minimum: 30, depuis: maintenant.getHours() * 60 + maintenant.getMinutes() })[0];
      creneau = libre ? `<p class="creneau">${ICONES.horloge}<span>Créneau libre aujourd'hui dans ton planner&nbsp;: <b>${heureTexte(libre.debut)} – ${heureTexte(libre.fin)}</b></span></p>` : '';
    }

    const cartesBlancs = blancs.map((b) => {
      const m = matiere(b.matiereId);
      return `<li class="carte blanc" style="--c:${couleur(m?.couleur)}"><div class="carte-bande"></div><div class="carte-corps">
        <p class="carte-matiere">${esc(m?.nom)}<span class="etiquette jaune">Examen blanc · J-${b.jMoins}</span></p>
        <h3>Un sujet complet, en conditions réelles</h3>
        <p class="carte-texte">Sujet des années précédentes, durée réelle, téléphone éteint. Corrige-le avec le barème, puis avance la révision des chapitres qui ont coincé.</p>
      </div><div class="carte-eval deux" role="group" aria-label="Examen blanc de ${esc(m?.nom)}"><button class="ev facile" data-action="blanc" data-cle="${esc(b.cle)}" data-etat="fait">C'est fait<small>bien joué</small></button><button class="ev" data-action="blanc" data-cle="${esc(b.cle)}" data-etat="passe">Passer<small>pas cette fois</small></button></div></li>`;
    }).join('');

    const cartes = liste.map((c, i) => carteRevision(c, t, i, liste.length)).join('');
    // Horaires du jour, créneau d'énergie en cours et objectif du jour (version privée).
    const h = E.reglages.horaires[versDate(t).getDay()];
    const cr = creneauEnergie();
    const objectif = Number(E.reglages.objectifJour) || 0;
    const infosJour = `<div class="infos-jour">
      <p class="info-jour">${ICONES.horloge}<span>${h?.actif ? `Révisions prévues aujourd'hui&nbsp;: <b>${esc(h.debut)} – ${esc(h.fin)}</b>` : 'Pas de révision prévue aujourd\'hui dans tes horaires&nbsp;: <b>jour de repos</b>'}</span><button type="button" class="btn lien" data-action="horaires">Modifier</button></p>
      <p class="info-jour energie-${cr ? cr.niveau : 'aucune'}"><i class="jauge-energie" aria-hidden="true"></i><span>${cr ? `Créneau en cours (${esc(cr.debut)} – ${esc(cr.fin)})&nbsp;: <b>énergie ${libNiveau(cr.niveau).toLowerCase()}</b>. Les cours qui demandent ce niveau passent en tête.` : 'Hors de tes créneaux d\'énergie&nbsp;: ordre classique (retards puis dates).'}</span><button type="button" class="btn lien" data-action="energie">Mes créneaux</button></p>
      ${objectif ? `<p class="info-jour objectif"><span class="anneau" style="--p:${Math.min(100, pct(faits.length, objectif))}" aria-hidden="true"></span><span>Objectif du jour&nbsp;: <b>${Math.min(faits.length, objectif)}/${objectif}</b> révisions${faits.length >= objectif ? ' · atteint' : ''}</span></p>` : ''}
    </div>`;
    const feuille = propositionFeuilleBlanche();
    const vide = !E.matieres.length
      ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune matière pour l'instant</h3><p>Crée au moins une matière pour y ranger tes chapitres, ou colle directement ton programme.</p><div class="actions"><button class="btn primaire" data-action="matiere-nouvelle">Créer une matière</button><button class="btn" data-action="importer">Coller mon programme</button></div></div></div>`
      : !E.chapitres.length
        ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton premier chapitre</h3><p>Dès qu'un chapitre est vu en cours, ajoute-le ici : sa première révision tombera demain, puis à J+3, J+7, J+14 et J+30.</p><div class="actions"><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}J'ai appris un chapitre</button><button class="btn" data-action="importer">Coller mon programme</button></div></div></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${faits.length ? 'Journée terminée.' : 'Journée libre.'}</h3><p>${prochaineRevision()}</p><div class="actions"><button class="btn" data-action="vue" data-vue="planning">Voir le planning</button></div></div></div>`;

    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${total ? `<p class="sous">${pluriel(faits.length, 'faite')} sur ${total}${retards ? ` · <b style="color:var(--rouge)">${retards} en retard</b>` : ''}${liste.length ? ` · environ ${dureeTexte(dureeSession(liste))}` : ''}</p>
          <div class="progression" aria-hidden="true">${Array.from({ length: Math.min(total, 24) }, (_, i) => `<span class="${i < faits.length ? 'fait' : i < faits.length + retards ? 'retard' : ''}"></span>`).join('')}</div>` : ''}
          <div class="actions">
            ${liste.length ? `<button class="btn primaire" data-action="session">${ICONES.lecture}Lancer ma session</button><button class="btn" data-action="chapitre-nouveau">${ICONES.plus}J'ai appris un chapitre</button>`
              : `<button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}J'ai appris un chapitre</button>`}
          </div>
          ${creneau}
          ${infosJour}
        </div>
        ${carteExamen}
      </section>
      ${alerteRattrapage}
      ${blancs.length ? `<h2 class="titre-section">Examen blanc <span>Prévu automatiquement à J-10 et J-4 de chaque examen (désactivable dans les réglages).</span></h2><ul class="cartes">${cartesBlancs}</ul>` : ''}
      <h2 class="titre-section">À réviser <span>${liste.length ? (ordrePerso() ? 'Ton ordre personnalisé. ' : 'Ordre suggéré, à toi de le changer&nbsp;: glisse les cartes ou utilise les flèches. ') : ''}</span></h2>
      ${liste.length > 1 ? `<div class="barre-ordre">${ordrePerso() ? '<button type="button" class="btn petit" data-action="ordre-suggestion">Revenir à la suggestion</button>' : '<span class="aide-ordre">Suggestion&nbsp;: retards, puis énergie du créneau en cours, puis dates.</span>'}</div>` : ''}
      ${liste.length ? `<ul class="cartes" id="cartes-jour">${cartes}</ul>` : vide}
      ${feuille}
      ${faits.length ? `<details class="faites"><summary>Faites aujourd'hui (${faits.length})</summary>${faits.map(({ c, h }) => {
        const m = matiere(c.matiereId);
        const lib = { difficile: ['rouge', 'Difficile'], moyen: ['jaune', 'Moyen'], facile: ['bleu', 'Facile'] }[h.eval];
        return `<div class="ligne-faite" style="--c:${couleur(m?.couleur)}"><i></i><span><b>${esc(c.titre)}</b> · ${esc(m?.nom)} · ${c.prochaine ? `prochaine ${quand(c.prochaine)}` : 'maîtrisé'}</span><span class="etiquette ${lib[0]}">${lib[1]}</span></div>`;
      }).join('')}</details>` : ''}`;
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  function prochaineRevision() {
    const t = auj();
    const p = E.chapitres.filter((c) => c.prochaine && c.prochaine > t).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0];
    if (!p) return 'Aucune révision programmée. Ajoute un chapitre dès que tu en termines un en cours.';
    const n = chargeDu(p.prochaine);
    return `Prochaine révision ${quand(p.prochaine)} : ${pluriel(n, 'chapitre')} au programme.`;
  }

  // Liens de ressources (Google Drive, Notion ou autre adresse https), ouverts dans un nouvel onglet.
  const urlSure = (u) => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
  const typeLien = (u) => (/(^|\.)google\.com$/.test(new URL(u).hostname) ? 'Drive' : /notion\.(so|site)$/.test(new URL(u).hostname) ? 'Notion' : 'Lien');
  const ressourcesDe = (c) => [...enListe(c.ressources), ...enListe(matiere(c.matiereId)?.ressources)].filter((r) => urlSure(r.url));
  const liensRessources = (l, cls = '') => (l.length ? `<ul class="ressources ${cls}" aria-label="Ressources">${l.map((r) => `<li><a href="${esc(urlSure(r.url))}" target="_blank" rel="noopener noreferrer"><span class="type-lien">${typeLien(urlSure(r.url))}</span>${esc(r.titre || urlSure(r.url))}${ICONES.lien}<span class="sr-only"> (nouvel onglet)</span></a></li>`).join('')}</ul>` : '');
  // Saisie : une ressource par ligne, « titre | adresse » ou l'adresse seule.
  const ressourcesVersTexte = (l) => enListe(l).map((r) => (r.titre && r.titre !== r.url ? `${r.titre} | ${r.url}` : r.url)).join('\n');
  function lireRessources(texte) {
    const ok = [], erreurs = [];
    String(texte || '').split('\n').map((x) => x.trim()).filter(Boolean).forEach((ligne) => {
      const [a, b] = ligne.includes('|') ? ligne.split('|').map((x) => x.trim()) : ['', ligne];
      const url = urlSure(b);
      if (url) ok.push({ titre: (a || '').slice(0, 80), url }); else erreurs.push(ligne);
    });
    return { ok: ok.slice(0, 12), erreurs };
  }

  function carteRevision(c, t, i = 0, nb = 1) {
    const m = matiere(c.matiereId);
    const retard = ecart(c.prochaine, t);
    const meth = methodeDe(c);
    const n = c.historique.length + 1;
    const souvenir = R.forceSouvenir(E, c, t);
    const prio = prioritesPack().slice(0, 2).find((p) => p.matiereId === c.matiereId);
    const ordre = nb > 1 ? `<div class="ordre-carte" role="group" aria-label="Position de ${esc(c.titre)} : ${i + 1} sur ${nb}">
        <span class="poignee" title="Glisser pour réordonner" aria-hidden="true">${ICONES.poignee}</span>
        <button type="button" class="btn-ordre" data-action="monter" data-id="${c.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${esc(c.titre)}">↑</button>
        <button type="button" class="btn-ordre" data-action="descendre" data-id="${c.id}" ${i === nb - 1 ? 'disabled' : ''} aria-label="Descendre ${esc(c.titre)}">↓</button></div>` : '';
    return `
      <li class="carte" style="--c:${couleur(m?.couleur)}" data-carte="${c.id}" ${nb > 1 ? 'draggable="true"' : ''}>
        <div class="carte-bande"></div>${ordre}
        <div class="carte-corps">
          <p class="carte-matiere">${esc(m?.nom || 'Sans matière')}${retard > 0 ? `<span class="etiquette rouge">En retard · ${retard} j</span>` : ''}${c.finale ? '<span class="etiquette">Révision finale</span>' : ''}${prio ? '<span class="etiquette bleu" title="D\'après tes notes : coefficient élevé et marge de progression">Priorité notes</span>' : ''}<span class="etiquette energie ${energieDe(c)}">Énergie ${libNiveau(energieDe(c)).toLowerCase()}</span>${c.suggeree && c.suggeree !== c.prochaine ? '<span class="etiquette">Déplacée</span>' : ''}</p>
          <h3>${esc(c.titre)}</h3>
          <p class="carte-meta">${points(c.etape)}<span>Révision n° ${n} · appris ${quand(c.appris)}${souvenir !== null ? ` · souvenir estimé ${souvenir}&nbsp;%` : ''}</span></p>
          <button class="methode-puce" data-action="methode" data-id="${meth.id}"><span>Méthode conseillée : <b>${esc(meth.nom)}</b> · ${esc(meth.duree)}</span></button>
          ${liensRessources(ressourcesDe(c))}
        </div>
        <div class="carte-eval" role="group" aria-label="Comment s'est passée la révision de ${esc(c.titre)} ?">
          <button class="ev difficile" data-action="evaluer" data-id="${c.id}" data-eval="difficile">Difficile<small>${apercu(c, 'difficile')}</small></button>
          <button class="ev moyen" data-action="evaluer" data-id="${c.id}" data-eval="moyen">Moyen<small>${apercu(c, 'moyen')}</small></button>
          <button class="ev facile" data-action="evaluer" data-id="${c.id}" data-eval="facile">Facile<small>${apercu(c, 'facile')}</small></button>
        </div>
        <div class="carte-plus"><button data-action="reporter" data-id="${c.id}">Reporter à demain</button><button data-action="deplacer" data-id="${c.id}">Déplacer ou regrouper</button><button data-action="chapitre-modifier" data-id="${c.id}">Modifier</button></div>
      </li>`;
  }

  // Planning : 4 semaines à partir du lundi courant
  function vuePlanning() {
    const t = auj();
    const d0 = versDate(t);
    const lundi = ajout(t, -((d0.getDay() + 6) % 7));
    jourChoisi = jourChoisi && jourChoisi >= lundi ? jourChoisi : t;
    const jours = Array.from({ length: 28 }, (_, i) => ajout(lundi, i));
    const max = E.reglages.chargeMax;
    const parJour = (j) => E.chapitres.filter((c) => c.prochaine && (j === t ? c.prochaine <= t : c.prochaine === j));
    const examens = (j) => E.matieres.filter((m) => m.examen === j);
    const blancsTous = R.examensBlancs(E, t);
    const blancsDu = (j) => blancsTous.filter((b) => b.date === j && b.etat !== 'passe');
    const cellules = jours.map((j) => {
      const liste = parJour(j);
      const ex = examens(j);
      const passe = j < t;
      const etiquette = `${fmt(j, { weekday: 'long', day: 'numeric', month: 'long' })} : ${pluriel(liste.length, 'révision')}${ex.length ? `, examen de ${ex.map((m) => m.nom).join(', ')}` : ''}${blancsDu(j).length ? `, examen blanc de ${blancsDu(j).map((b) => matiere(b.matiereId)?.nom).join(', ')}` : ''}`;
      return `<button class="cellule ${j === t ? 'aujourdhui' : ''} ${passe ? 'passe' : ''} ${liste.length >= max ? 'charge' : ''}" data-action="jour" data-jour="${j}" aria-pressed="${j === jourChoisi}"><span class="sr-only">${esc(etiquette)}</span>
        <span class="num" aria-hidden="true">${versDate(j).getDate()}${versDate(j).getDate() === 1 || j === lundi ? ` ${fmt(j, { month: 'short' })}` : ''}</span>
        ${ex.length ? '<span class="exam" aria-hidden="true">Examen</span>' : blancsDu(j).length ? '<span class="exam blanc" aria-hidden="true">Blanc</span>' : ''}
        ${!passe && liste.length ? `<span class="nb" aria-hidden="true">${liste.length}<small>rév.</small></span>` : ''}
        ${!passe ? `<span class="carres">${liste.slice(0, 12).map((c) => `<i style="--c:${couleur(matiere(c.matiereId)?.couleur)}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('');
    const detail = parJour(jourChoisi);
    const ex = examens(jourChoisi);
    const passe = jourChoisi < t;
    const faitsCeJour = passe ? E.chapitres.flatMap((c) => c.historique.filter((h) => h.date === jourChoisi).map(() => c)) : [];
    const lignesBlancs = blancsDu(jourChoisi).map((b) => `<div class="ligne" style="--c:${couleur(matiere(b.matiereId)?.couleur)}"><i></i><div><b>Examen blanc · ${esc(matiere(b.matiereId)?.nom)}</b><span>Sujet complet en conditions réelles · J-${b.jMoins}${b.etat === 'fait' ? ' · fait' : ''}</span></div><span></span></div>`).join('');
    const lignes = passe
      ? (faitsCeJour.length ? faitsCeJour.map((c) => ligneChapitre(c, 'Révisé ce jour-là')).join('') : '<p class="ligne"><span class="vide">Aucune révision faite ce jour-là.</span></p>')
      : detail.length ? detail.map((c) => ligneChapitre(c, `${c.finale ? 'Révision finale' : `Étape ${c.etape + 1} sur ${E.reglages.intervalles.length}`}${c.prochaine < t ? ` · en retard depuis ${quand(c.prochaine)}` : ''}`, true)).join('')
        : '<p class="ligne"><span class="vide">Aucune révision ce jour-là.</span></p>';
    return `
      <div class="vue-tete"><div><h1>Planning</h1><p>Les 4 prochaines semaines. Au-delà de ${max} révisions par jour, les suivantes sont décalées au lendemain (réglable).</p></div>
        <div class="actions"><button class="btn" data-action="agenda">${ICONES.agenda}Ajouter à mon agenda</button><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}Chapitre</button></div></div>
      <div class="legende-planning"><span><i style="background:var(--jaune)"></i>Aujourd'hui (retards compris)</span><span><i style="background:var(--rouge)"></i>Examen</span><span><i style="background:var(--beurre);border:1px solid var(--jaune)"></i>Examen blanc</span><span>Un carré = une révision, à la couleur de la matière</span></div>
      <div class="calendrier" role="group" aria-label="Calendrier des révisions">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => `<span class="jsem" aria-hidden="true">${j}</span>`).join('')}${cellules}</div>
      <section class="jour-detail" aria-live="polite">
        <h2>${fmt(jourChoisi, { weekday: 'long', day: 'numeric', month: 'long' })}<span>${passe ? pluriel(faitsCeJour.length, 'révision faite', 'révisions faites') : pluriel(detail.length, 'révision')}${ex.length ? ` · examen : ${esc(ex.map((m) => m.nom).join(', '))}` : ''}</span></h2>
        ${lignesBlancs}${lignes}
      </section>`;
  }

  function ligneChapitre(c, sous, actions = false) {
    const m = matiere(c.matiereId);
    const t = auj();
    return `<div class="ligne" style="--c:${couleur(m?.couleur)}"><i></i><div><b>${esc(c.titre)}</b><span>${esc(m?.nom)} · ${sous}</span></div>
      ${actions ? `<div class="actions-ligne">${c.prochaine > t ? `<button class="btn petit" data-action="avancer" data-id="${c.id}">Réviser aujourd'hui</button>` : `<button class="btn petit" data-action="reporter" data-id="${c.id}">Reporter</button>`}<button class="btn petit" data-action="deplacer" data-id="${c.id}">Déplacer</button>${c.suggeree && c.suggeree !== c.prochaine ? `<button class="btn petit lien" data-action="revenir-suggestion" data-id="${c.id}">Date suggérée</button>` : ''}</div>` : '<span></span>'}</div>`;
  }

  // Matières
  function vueMatieres() {
    const t = auj();
    const I = E.reglages.intervalles.length;
    const cartes = E.matieres.map((m) => {
      const chs = E.chapitres.filter((c) => c.matiereId === m.id).sort((a, b) => (a.appris || '9999').localeCompare(b.appris || '9999'));
      const aVenir = chs.filter((c) => !c.appris).length;
      const maitrises = chs.filter((c) => c.etape >= I).length;
      const dus = chs.filter((c) => c.prochaine && c.prochaine <= t).length;
      const j = m.examen ? ecart(t, m.examen) : null;
      const examen = m.examen ? (j >= 0 ? `Examen ${fmt(m.examen, { day: 'numeric', month: 'long' })} · ${j === 0 ? 'aujourd\'hui' : `J-${j}`}` : `Examen passé (${fmt(m.examen, { day: 'numeric', month: 'long' })})`) : 'Pas de date d\'examen';
      return `
      <article class="matiere" style="--c:${couleur(m.couleur)};--t:${texteSur(m.couleur)}">
        <div class="matiere-tete"><div><h2>${esc(m.nom)}</h2><p>${examen}</p></div><button data-action="matiere-modifier" data-id="${m.id}">Modifier</button></div>
        ${m.examen && m.examen > t ? blocJauge(m, true) : ''}
        <div class="matiere-infos"><span class="etiquette energie ${m.energie || 'moyenne'}">Énergie ${libNiveau(m.energie).toLowerCase()}</span>${liensRessources(enListe(m.ressources).filter((r) => urlSure(r.url)), 'compactes')}</div>
        <div class="matiere-chiffres"><div><b>${chs.length}</b><span>chapitres${aVenir ? ` dont ${aVenir} à venir` : ''}</span></div><div><b>${maitrises}</b><span>maîtrisés</span></div><div><b style="${dus ? 'color:var(--rouge)' : ''}">${dus}</b><span>à réviser</span></div></div>
        <div class="maitrise" role="img" aria-label="Maîtrise : ${chs.length ? Math.round((chs.reduce((s, c) => s + Math.min(c.etape, I), 0) / (chs.length * I)) * 100) : 0} %"><i style="width:${chs.length ? (chs.reduce((s, c) => s + Math.min(c.etape, I), 0) / (chs.length * I)) * 100 : 0}%"></i></div>
        <div class="chapitres">${chs.length ? chs.map((c) => {
          const souvenir = R.forceSouvenir(E, c, t);
          const etat = !c.appris ? 'Pas encore vu en cours'
            : c.prochaine ? `${c.finale ? 'Révision finale' : 'Prochaine révision'} ${quand(c.prochaine)}${c.prochaine < t ? ' (en retard)' : ''}` : c.etape >= I ? 'Maîtrisé' : 'Plus de révision avant l\'examen';
          return `<button class="chapitre ${c.appris ? '' : 'a-venir'}" data-action="chapitre-modifier" data-id="${c.id}"><b>${esc(c.titre)}</b>${c.appris ? points(c.etape) : '<span class="etiquette">À venir</span>'}<span class="${c.prochaine && c.prochaine < t ? 'retard' : ''}">${etat}${souvenir !== null && c.prochaine ? ` · souvenir ${souvenir}&nbsp;%` : ''}</span></button>`;
        }).join('') : '<p class="matiere-vide">Aucun chapitre. Ajoute-le dès qu\'il est vu en cours.</p>'}</div>
        <div class="matiere-pied"><button class="btn petit" data-action="chapitre-nouveau" data-matiere="${m.id}">${ICONES.plus}Chapitre</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Matières</h1><p>Indique la date d'examen de chaque matière : aucune révision n'est programmée après, et chaque chapitre maîtrisé a une révision finale deux jours avant. L'énergie requise et les liens de ressources se règlent dans « Modifier ».</p></div>
        <div class="actions"><button class="btn" data-action="import-csv">Importer un CSV</button><button class="btn" data-action="importer">Coller un programme</button><button class="btn" data-action="matiere-nouvelle">${ICONES.plus}Matière</button><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}Chapitre</button></div></div>
      ${E.matieres.length ? `<div class="matieres">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune matière</h3><p>Crée tes matières une par une, ou choisis-les dans le catalogue de ta formation.</p><div class="actions"><button class="btn primaire" data-action="matiere-nouvelle">Créer une matière</button></div></div></div>`}`;
  }

  // Méthodes
  function vueMethodes() {
    const etapes = {};
    B.methodeParEtape.forEach((id, i) => { (etapes[id] ||= []).push(i + 1); });
    return `
      <div class="vue-tete"><div><h1>Méthodes</h1><p>${B.methodes.length} façons de réviser activement. Le planning en conseille une à chaque révision, de la plus simple (rappel de mémoire) à la plus exigeante (annales chronométrées).</p></div></div>
      <div class="methodes">${B.methodes.map((m) => `
        <article class="methode" id="methode-${m.id}" style="--c:${couleur(m.couleur)};--t:${texteSur(m.couleur)}">
          <div class="methode-tete"><h2>${esc(m.nom)}</h2><span>${esc(m.duree)}</span></div>
          ${etapes[m.id] ? `<div class="conseil">${etapes[m.id].map((e) => `<span class="etiquette">Conseillée à la révision ${e}</span>`).join('')}</div>` : ''}
          <p>${esc(m.principe)}</p>
          <ol>${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
        </article>`).join('')}</div>`;
  }

  // Bilan
  function statistiques() {
    const t = auj();
    const histo = E.chapitres.flatMap((c) => c.historique.map((h) => ({ ...h, c })));
    const jours = new Set(histo.map((h) => h.date));
    let serie = 0;
    for (let j = jours.has(t) ? t : ajout(t, -1); jours.has(j); j = ajout(j, -1)) serie++;
    const depuis7 = ajout(t, -6), depuis30 = ajout(t, -29);
    const sur30 = histo.filter((h) => h.date >= depuis30);
    const reussies = sur30.filter((h) => h.eval !== 'difficile').length;
    return {
      serie,
      semaine: histo.filter((h) => h.date >= depuis7).length,
      taux: sur30.length ? Math.round((reussies / sur30.length) * 100) : null,
      maitrises: E.chapitres.filter((c) => c.etape >= E.reglages.intervalles.length).length,
      jours30: Array.from({ length: 30 }, (_, i) => {
        const d = ajout(depuis30, i);
        const h = histo.filter((x) => x.date === d);
        return { d, difficile: h.filter((x) => x.eval === 'difficile').length, moyen: h.filter((x) => x.eval === 'moyen').length, facile: h.filter((x) => x.eval === 'facile').length };
      }),
    };
  }

  const EVALS = [['facile', 'Facile', '#1D4E89'], ['moyen', 'Moyen', '#F5B400'], ['difficile', 'Difficile', '#D9302A']];

  function graphique(jours) {
    const L = Math.round(Math.min(720, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 190 : 220, g = 28, b = 24, hz = H - b - 8;
    const max = Math.max(4, ...jours.map((j) => j.difficile + j.moyen + j.facile));
    const pas = Math.ceil(max / 4);
    const haut = pas * 4;
    const larg = (L - g) / jours.length;
    const y = (v) => 8 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const colonnes = jours.map((j, i) => {
      const x = g + i * larg + 2;
      const w = Math.max(3, larg - (larg > 14 ? 6 : 3));
      let cumul = 0;
      const rects = EVALS.map(([k, , c]) => {
        const v = j[k];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y(cumul + v) - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${c}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const etiquette = (jours.length - 1 - i) % 7 === 0 ? `<text class="axe" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmt(j.d, { day: 'numeric', month: 'short' })}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne" data-i="${i}">${rects}</g>${etiquette}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Révisions faites par jour sur 30 jours, détail dans le tableau ci-dessous">${grilles}${colonnes}</svg>`;
  }

  function vueBilan() {
    const s = statistiques();
    const t = auj();
    const I = E.reglages.intervalles.length;
    const tuiles = [
      ['Série en cours', s.serie, s.serie > 1 ? 'jours' : 'jour', 'Jours consécutifs avec au moins une révision.', 'var(--rouge)', 'rond'],
      ['Cette semaine', s.semaine, '', 'Révisions faites sur les 7 derniers jours.', 'var(--jaune)', ''],
      ['Bien sues', s.taux === null ? '–' : s.taux, s.taux === null ? '' : '%', 'Révisions « moyen » ou « facile » sur 30 jours.', 'var(--bleu)', ''],
      ['Maîtrisés', s.maitrises, `/ ${E.chapitres.length}`, `Chapitres ayant franchi les ${I} étapes.`, 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const lignes = E.matieres.map((m) => {
      const chs = E.chapitres.filter((c) => c.matiereId === m.id);
      const j = m.examen && m.examen >= t ? ecart(t, m.examen) : null;
      return `<tr style="--c:${couleur(m.couleur)}"><td><span class="nom-matiere"><i></i>${esc(m.nom)}</span></td><td class="nb">${chs.length}</td><td class="nb">${chs.filter((c) => c.etape >= I).length}</td><td class="nb">${chs.filter((c) => c.prochaine && c.prochaine <= t).length}</td><td class="nb">${j === null ? '–' : j === 0 ? 'Aujourd\'hui' : `J-${j}`}</td></tr>`;
    }).join('');
    const meilleure = R.meilleureSerie(E);
    const pal = R.paliers(meilleure, s.serie);
    const minutes30 = Object.entries(E.focus).filter(([d]) => d > ajout(t, -30)).reduce((x, [, n]) => x + n, 0);
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Ta régularité et l'avancement de chaque matière.</p></div>
        <div class="actions"><button class="btn primaire" data-action="partager">${ICONES.partage}Partager ma semaine</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Régularité jour par jour <span>${minutes30 ? `${dureeTexte(minutes30)} de session guidée sur 30 jours · ` : ''}meilleure série : ${pluriel(meilleure, 'jour')}</span></h2>
      <div class="regularite">
        ${carteRegularite()}
        <div class="paliers" aria-label="Paliers de série">${R.PALIERS.map((p) => `<span class="palier ${pal.atteints.includes(p) ? 'atteint' : ''} ${pal.prochain === p ? 'prochain' : ''}" title="${pal.atteints.includes(p) ? 'Atteint' : 'Pas encore atteint'}"><b>${p}</b><small>jours</small></span>`).join('')}
          <p>${pal.prochain ? `Prochain palier : <b>${pal.prochain} jours</b> d'affilée, encore ${pluriel(pal.prochain - s.serie, 'jour')}.` : 'Tous les paliers sont atteints.'}</p></div>
      </div>
      ${blocObjectifsBilan()}
      <h2 class="titre-section">30 derniers jours</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Révisions par jour</h2><div class="legende">${EVALS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(s.jours30)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Révisions par jour</caption><thead><tr><th>Jour</th><th>Facile</th><th>Moyen</th><th>Difficile</th></tr></thead><tbody>${s.jours30.map((j) => `<tr><td>${fmt(j.d)}</td><td>${j.facile}</td><td>${j.moyen}</td><td>${j.difficile}</td></tr>`).join('')}</tbody></table>
      </figure>
      <h2 class="titre-section">Par matière</h2>
      ${E.matieres.length ? `<div class="defile" tabindex="0" role="region" aria-label="Tableau par matière, défilant"><table class="tableau"><thead><tr><th>Matière</th><th class="nb">Chapitres</th><th class="nb">Maîtrisés</th><th class="nb">À réviser</th><th class="nb">Examen</th></tr></thead><tbody>${lignes}</tbody></table></div>` : '<p>Aucune matière.</p>'}
      ${sectionPack()}`;
  }

  // Carte de régularité : une case par jour sur 20 semaines, du lundi au dimanche.
  function carteRegularite() {
    const t = auj();
    const parJour = R.joursRevises(E);
    const lundi = ajout(t, -((versDate(t).getDay() + 6) % 7));
    // De la première semaine active (8 semaines au moins, 20 au plus) à aujourd'hui.
    const premier = Object.keys(parJour).sort()[0] || t;
    const semaines = Math.min(20, Math.max(8, Math.ceil((ecart(premier, lundi) + 1) / 7) + 1));
    const debut = ajout(lundi, -7 * (semaines - 1));
    const niveau = (n) => (!n ? 0 : n < 1 ? 1 : n <= 3 ? 2 : n <= 7 ? 3 : 4);
    const colonnes = Array.from({ length: semaines }, (_, sem) => `<div class="col">${Array.from({ length: 7 }, (_, j) => {
      const d = ajout(debut, sem * 7 + j);
      if (d > t) return '<i class="futur"></i>';
      const n = parJour[d] || 0;
      return `<i class="n${niveau(n)}" title="${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })} : ${n >= 1 ? pluriel(n, 'révision') : n ? 'session guidée' : 'rien'}"></i>`;
    }).join('')}</div>`).join('');
    const actifs = Object.keys(parJour).filter((d) => d >= debut && d <= t).length;
    return `<figure class="carte-regu"><div class="grille-regu" style="--n:${semaines}" role="img" aria-label="${actifs} jours de révision sur les ${semaines} dernières semaines">${colonnes}</div>
      <figcaption><span>${semaines} dernières semaines</span><span class="echelle">Moins <i class="n0"></i><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i> Plus</span></figcaption></figure>`;
  }

  // Pack Étudiant : ce que les autres templates ouverts sur cet appareil apportent au planning.
  function sectionPack() {
    const t = auj();
    const etat = (cle) => (pack[cle] ? '<span class="etiquette bleu">Relié</span>' : '<span class="etiquette">Non trouvé sur cet appareil</span>');
    const lien = (p) => `<a class="btn petit" href="${p.url}">Ouvrir ${esc(p.nom)}</a>`;
    // Notes
    const prio = prioritesPack();
    const blocNotes = pack.notes
      ? (prio.length ? `<div class="defile" tabindex="0" role="region" aria-label="Priorités selon tes notes, tableau défilant"><table class="tableau"><thead><tr><th>Matière</th><th class="nb">Moy.</th><th class="nb" title="Effet d'un point de plus dans la matière sur la moyenne générale">+1 pt</th></tr></thead><tbody>${prio.map((p, i) => {
        const m = matiere(p.matiereId);
        return `<tr style="--c:${couleur(m?.couleur)}"><td><span class="nom-matiere"><i></i>${esc(m?.nom)}${i < 2 ? ' <span class="etiquette bleu">Priorité</span>' : ''}</span></td><td class="nb">${p.moyenne === null ? '–' : p.moyenne.toFixed(1).replace('.', ',')}</td><td class="nb">+${p.poids.toFixed(2).replace('.', ',')}</td></tr>`;
      }).join('')}</tbody></table></div>${(() => { const n = prio.filter((p) => p.prochaine).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0]; return n ? `<p>Prochaine note prévue&nbsp;: <b>${esc(matiere(n.matiereId)?.nom)}</b>, ${fmt(n.prochaine, { weekday: 'long', day: 'numeric', month: 'long' })}.</p>` : ''; })()}<p class="aide">« +1 pt »&nbsp;: ce que gagne ta moyenne générale avec un point de plus dans la matière. Priorité = coefficient élevé et marge de progression&nbsp;: ces chapitres passent en tête dans Aujourd'hui, à date égale.</p>`
        : '<p class="aide">Aucune matière commune trouvée : donne le même nom à tes matières dans les deux outils.</p>')
      : `<p>Tes moyennes et tes coefficients indiquent quelles matières rapportent le plus de points. Les révisions de ces matières passent alors en tête.</p>${lien(PACK[0])}`;
    // Planner
    let blocPlanner;
    if (pack.planner) {
      const jours = [t, ajout(t, 1)].map((d) => ({ d, l: R.creneauxLibres(pack.planner, d, { minimum: 45 }).slice(0, 3) }));
      blocPlanner = jours.map(({ d, l }) => `<p><b>${quand(d).replace(/^./, (x) => x.toUpperCase())}</b> : ${l.length ? l.map((c) => `${heureTexte(c.debut)} – ${heureTexte(c.fin)}`).join(' · ') : 'aucun créneau de 45 min'}</p>`).join('') + '<p class="aide">Créneaux d\'au moins 45 minutes sans bloc dans ton planner. Le créneau du jour s\'affiche aussi dans Aujourd\'hui.</p>';
    } else blocPlanner = `<p>Ton emploi du temps montre où placer la session du jour : le planning t'indique le premier créneau libre assez long.</p>${lien(PACK[1])}`;
    // Habitudes
    let blocHabitudes;
    const so = pack.habitudes ? R.sommeilEtReussite(E, pack.habitudes) : null;
    if (so?.suffisant) {
      blocHabitudes = `<div class="comparaison-sommeil"><div><span>Moins de ${so.seuil} h de sommeil</span><b>${so.court.taux}&nbsp;%</b><small>bien sues · ${pluriel(so.court.jours, 'jour')}</small></div><div><span>${so.seuil} h ou plus</span><b>${so.long.taux}&nbsp;%</b><small>bien sues · ${pluriel(so.long.jours, 'jour')}</small></div></div>
        <p class="aide">Révisions « Moyen » ou « Facile », selon les heures de sommeil notées ce jour-là. C'est une observation sur tes propres données, pas une preuve&nbsp;: d'autres choses changent d'un jour à l'autre.</p>`;
    } else if (pack.habitudes) blocHabitudes = `<p>Il faut au moins 10 jours avec révisions et heures de sommeil notées (et 3 de chaque côté de ${so?.seuil ?? 7} h) pour comparer. Pour l'instant : ${pluriel(so?.total || 0, 'jour')}.</p>`;
    else blocHabitudes = `<p>Note tes heures de sommeil : le bilan compare ta réussite après une nuit courte et après une vraie nuit.</p>${lien(PACK[2])}`;
    return `<h2 class="titre-section">Pack Étudiant <span>${session.demo ? 'Démo : données d\'exemple des autres outils du pack.' : 'Lecture des autres outils du pack ouverts sur cet appareil, rien n\'est modifié chez eux.'}</span></h2>
      <div class="pack">
        <article class="pack-carte"><div class="pack-tete"><h3>Notes et moyennes</h3>${etat('notes')}</div>${blocNotes}</article>
        <article class="pack-carte"><div class="pack-tete"><h3>Planner horaire</h3>${etat('planner')}</div>${blocPlanner}</article>
        <article class="pack-carte"><div class="pack-tete"><h3>Sommeil et réussite</h3>${etat('habitudes')}</div>${blocHabitudes}</article>
      </div>`;
  }

  // Image de la semaine (format story 1080 × 1920), partagée ou téléchargée.
  async function partagerSemaine() {
    const t = auj();
    const b = R.bilanSemaine(E, t);
    const serieNow = R.serie(E, t);
    try { await document.fonts?.ready; } catch { /* police système */ }
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    const x = c.getContext('2d');
    const F = (poids, taille) => `${poids} ${taille}px Outfit, system-ui, sans-serif`;
    x.fillStyle = '#FBF7F1'; x.fillRect(0, 0, 1080, 1920);
    // Formes Bauhaus
    x.fillStyle = '#D8E4F0'; x.fillRect(0, 0, 1080, 700);
    x.fillStyle = '#2E5A88'; x.fillRect(620, 160, 360, 360);
    x.fillStyle = '#E8B93A'; x.beginPath(); x.moveTo(620, 520); x.arc(980, 520, 360, Math.PI, Math.PI * 1.5); x.closePath(); x.fill();
    x.fillStyle = '#E58C74'; x.beginPath(); x.arc(300, 360, 190, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#24221F'; x.beginPath(); x.arc(300, 360, 70, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#24221F';
    x.font = F(700, 34); x.fillText('MA SEMAINE DE RÉVISION', 90, 800);
    x.font = F(700, 96); x.fillText(E.prenom ? `${E.prenom},` : 'Cette semaine,', 90, 910);
    x.fillText(serieNow > 1 ? `${serieNow} jours d'affilée.` : `${b.revisions} révisions.`, 90, 1015);
    const chiffres = [[b.revisions, 'révisions'], [`${b.jours}/7`, 'jours actifs'], [b.taux === null ? '–' : `${b.taux} %`, 'bien sues'], [b.minutes ? dureeTexte(b.minutes) : '–', 'de concentration']];
    chiffres.forEach(([v, l], i) => {
      const cx = 90 + (i % 2) * 460, cy = 1110 + Math.floor(i / 2) * 230;
      x.fillStyle = '#FFFFFF'; x.strokeStyle = '#E4DCCE'; x.lineWidth = 2;
      x.beginPath(); x.roundRect(cx, cy, 430, 200, 28); x.fill(); x.stroke();
      x.fillStyle = ['#B84A34', '#E8B93A', '#2E5A88', '#24221F'][i]; x.beginPath(); x.arc(cx + 390, cy + 40, 16, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#24221F'; x.font = F(800, 76); x.fillText(String(v), cx + 30, cy + 110);
      x.fillStyle = '#514C44'; x.font = F(500, 32); x.fillText(l, cx + 30, cy + 162);
    });
    // Barres des 7 jours
    const max = Math.max(1, ...b.parJour.map((j) => j.n));
    b.parJour.forEach((j, i) => {
      const bx = 90 + i * 132, h = Math.round((j.n / max) * 150);
      x.fillStyle = j.n ? '#2E5A88' : '#E4DCCE';
      x.beginPath(); x.roundRect(bx, 1720 - Math.max(10, h), 100, Math.max(10, h), 14); x.fill();
      x.fillStyle = '#6E685F'; x.font = F(600, 26); x.textAlign = 'center';
      x.fillText(versDate(j.d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), bx + 50, 1765); x.textAlign = 'left';
    });
    x.fillStyle = '#6E685F'; x.font = F(500, 28); x.fillText('Planning de révision · qm-engineering.fr', 90, 1850);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const fichier = new File([blob], `ma-semaine-${t}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: 'Ma semaine de révision' }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    telecharger(blob, fichier.name);
    toast('Image de ta semaine téléchargée : partage-la en story.');
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const jours = statistiques().jours30;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), j = jours[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      const total = j.facile + j.moyen + j.difficile;
      bulle.innerHTML = `<b>${fmt(j.d, { weekday: 'long', day: 'numeric', month: 'long' })}</b>${total ? EVALS.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${j[k]}</div>`).join('') : 'Aucune révision'}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => {
      z.addEventListener('pointerenter', () => montrer(z));
      z.addEventListener('click', () => montrer(z));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((g) => g.classList.remove('active')); });
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
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]),select,textarea')?.focus();
  }

  function modaleChapitre(matiereId, id) {
    if (!E.matieres.length) { modaleMatiere(); toast('Crée d\'abord une matière.'); return; }
    const c = id ? chapitre(id) : null;
    const choix = c?.matiereId || matiereId || E.matieres[0].id;
    const t = auj();
    // Chapitres « à venir » (programme collé) de la matière : on les coche au lieu de les retaper.
    const listeProgramme = (mid) => {
      const l = E.chapitres.filter((x) => x.matiereId === mid && !x.appris);
      return l.length ? `<fieldset class="programme"><legend>Dans ton programme <small>Coche ce qui a été vu en cours.</small></legend>${l.map((x) => `<label class="case"><input type="checkbox" name="vus" value="${x.id}"> ${esc(x.titre)}</label>`).join('')}</fieldset>` : '';
    };
    const aVenir = c && !c.appris;
    const corps = `
      <label class="champ">Matière<select name="matiere">${E.matieres.map((m) => `<option value="${m.id}" ${m.id === choix ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      ${c ? `<label class="champ">Titre du chapitre<input name="titre" required maxlength="120" value="${esc(c.titre)}"></label>`
        : `<div id="programme">${listeProgramme(choix)}</div><label class="champ">Nouveau chapitre<small>Plusieurs chapitres d'un coup : un par ligne.</small><textarea name="titre" maxlength="2000" placeholder="Ex. : Les fonctions exponentielles"></textarea></label>`}
      <label class="champ">${aVenir ? 'Vu en cours le<small>Laisse vide tant que le chapitre n\'a pas été vu : il attend dans ton programme.</small>' : 'Appris le'}<input type="date" name="appris" value="${c ? (c.appris || '') : t}" max="${t}" ${aVenir ? '' : 'required'}></label>
      ${c ? `<label class="champ">Énergie requise<small>Par défaut, celle de la matière (${libNiveau(matiere(c.matiereId)?.energie).toLowerCase()}).</small><select name="energie"><option value="">Comme la matière</option>${NIVEAUX.map(([v, l]) => `<option value="${v}" ${c.energie === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ">Ressources du cours<small>Une par ligne&nbsp;: « titre | adresse » ou l'adresse seule (Google Drive, Notion ou autre lien https). Les liens de la matière s'ajoutent automatiquement.</small><textarea name="ressources" rows="2" maxlength="3000" placeholder="Poly du cours | https://drive.google.com/…">${esc(ressourcesVersTexte(c.ressources))}</textarea></label>
        <details class="details-cles"><summary>Mots-clés pour la feuille blanche</summary><label class="champ">Mots-clés<small>Les notions à retrouver de mémoire, séparées par des virgules. Ils servent aux sessions « feuille blanche »&nbsp;: tu écris de mémoire, puis tu compares.</small><textarea name="motsCles" maxlength="1000" rows="2" placeholder="Ex. : enzyme, énergie d'activation, Michaelis-Menten">${esc(c.motsCles || '')}</textarea></label></details>` : ''}
      ${c ? `<p class="aide">${aVenir ? 'Pas encore vu en cours : aucune révision programmée.' : `${c.historique.length ? `${pluriel(c.historique.length, 'révision faite')}. ` : ''}${c.prochaine ? `Prochaine révision ${quand(c.prochaine)}.` : 'Aucune révision programmée.'}${R.forceSouvenir(E, c, t) !== null ? ` Souvenir estimé aujourd'hui&nbsp;: ${R.forceSouvenir(E, c, t)}&nbsp;% (modèle simple&nbsp;: 90&nbsp;% le jour prévu de la révision).` : ''}`}</p>`
        : `<p class="aide">Première révision le lendemain de la date indiquée, puis à J+${E.reglages.intervalles.slice(1).join(', J+')}.</p>`}
      <p class="erreur" role="alert"></p>`;
    const pied = c
      ? `<button class="btn primaire" value="ok">Enregistrer</button>${c.etape > 0 || c.historique.length ? '<button class="btn" value="recommencer">Recommencer à zéro</button>' : ''}<button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le chapitre' : 'Nouveau chapitre', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${c.titre} » et son historique de révisions ?`)) return '';
        E.chapitres = E.chapitres.filter((x) => x.id !== c.id);
        sauver(); rendre(); toast(`« ${c.titre} » supprimé.`);
        return;
      }
      const titres = String(f.get('titre') || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const appris = f.get('appris') || null;
      if (appris && appris > t) return 'La date ne peut pas être dans le futur.';
      if (c) {
        if (!titres.length) return 'Indique le titre du chapitre.';
        if (!appris && c.appris && c.historique.length) return 'Indique la date à laquelle le chapitre a été appris.';
        const changeDate = c.appris !== appris;
        const res = lireRessources(f.get('ressources'));
        if (res.erreurs.length) return `Lien non reconnu (adresse https attendue) : ${res.erreurs[0].slice(0, 60)}`;
        c.titre = titres.join(' '); c.matiereId = f.get('matiere'); c.motsCles = String(f.get('motsCles') || '').trim();
        c.energie = f.get('energie') || null; c.ressources = res.ok;
        if (!appris) { Object.assign(c, { appris: null, prochaine: null, etape: 0, finale: false, finaleFaite: false, historique: [] }); }
        else if (!c.appris) R.marquerVu(E, c, appris, t);
        else {
          c.appris = appris;
          if (action === 'recommencer') { c.historique = []; c.finaleFaite = false; planifier(c, t, 0); c.prochaine = ajout(t, E.reglages.intervalles[0]); }
          else if (changeDate && !c.historique.length) { planifier(c, appris, 0); if (c.prochaine < t) c.prochaine = t; }
        }
        sauver(); rendre(); toast('Chapitre enregistré.');
        return;
      }
      const vus = f.getAll('vus').map(chapitre).filter(Boolean);
      if (!titres.length && !vus.length) return 'Coche un chapitre du programme ou indique un titre.';
      if (!appris) return 'Indique la date à laquelle tu as vu ce chapitre.';
      vus.forEach((x) => R.marquerVu(E, x, appris, t));
      const ajoutes = titres.map((ti) => { const ch = nouveauChapitre(f.get('matiere'), ti.slice(0, 120), appris); if (ch.prochaine && ch.prochaine < t) ch.prochaine = t; return ch; });
      const tous = [...vus, ...ajoutes];
      sauver(); rendre();
      toast(tous.length > 1 ? `${tous.length} chapitres ajoutés au planning.` : `Ajouté. Première révision ${quand(tous[0].prochaine)}.`);
    });
    if (!c) modale().querySelector('select[name=matiere]').addEventListener('change', (e) => { $('#programme').innerHTML = listeProgramme(e.target.value); });
  }

  // Coller un programme : matières et chapitres « à venir », planifiés au fur et à mesure qu'ils sont vus.
  function modaleImport() {
    const t = auj();
    const corps = `
      <p>Colle le plan de ton cours, ton syllabus ou le sommaire du polycopié. <b>Une ligne = un chapitre.</b> Une ligne en MAJUSCULES, qui commence par «&nbsp;#&nbsp;» ou qui finit par «&nbsp;:&nbsp;» ouvre une nouvelle matière. Puces et numéros sont retirés.</p>
      <label class="champ">Ton programme<textarea name="texte" rows="9" maxlength="20000" placeholder="BIOCHIMIE&#10;1. Les glucides&#10;2. Les lipides&#10;3. Enzymologie&#10;&#10;ANATOMIE&#10;- Ostéologie du membre supérieur"></textarea></label>
      <label class="champ">Sans titre de matière, ranger dans<select name="defaut">${E.matieres.map((m) => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}<option value="">Une nouvelle matière « Programme »</option></select></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Ces chapitres sont</legend>
        <label class="case"><input type="radio" name="statut" value="avenir" checked> Pas encore vus : ils attendent dans ton programme</label>
        <label class="case"><input type="radio" name="statut" value="vus"> Déjà vus en cours, le <input type="date" name="appris" value="${t}" max="${t}" style="min-height:44px;width:auto"></label>
      </fieldset>
      <div class="apercu-import" aria-live="polite"><p class="aide">L'aperçu s'affiche ici.</p></div>
      <p class="erreur" role="alert"></p>`;
    const analyse = () => R.analyserProgramme(modale().querySelector('[name=texte]').value);
    const cible = (g, defaut) => (g.matiere ? E.matieres.find((m) => R.memeMatiere(m.nom, g.matiere)) : matiere(defaut)) || null;
    ouvrirModale('Coller un programme', corps, '<button class="btn primaire" value="ok">Importer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const groupes = analyse();
      if (!groupes.length) return 'Aucun chapitre trouvé : colle au moins une ligne.';
      const vus = f.get('statut') === 'vus';
      const appris = vus ? f.get('appris') : null;
      if (vus && (!appris || appris > t)) return 'Indique une date passée ou aujourd\'hui.';
      let n = 0, nouvelles = 0;
      for (const g of groupes) {
        let m = cible(g, f.get('defaut'));
        if (!m) {
          const utilisees = new Set(E.matieres.map((x) => x.couleur));
          m = { id: uid(), nom: g.matiere || 'Programme', couleur: (B.couleurs.find((x) => !utilisees.has(x.id)) || B.couleurs[E.matieres.length % B.couleurs.length]).id, examen: null };
          E.matieres.push(m); nouvelles++;
        }
        for (const titre of g.chapitres) {
          if (E.chapitres.some((x) => x.matiereId === m.id && x.titre.toLowerCase() === titre.toLowerCase())) continue;
          const ch = nouveauChapitre(m.id, titre, appris);
          if (ch.prochaine && ch.prochaine < t) ch.prochaine = t;
          n++;
        }
      }
      sauver(); rendre();
      toast(`${pluriel(n, 'chapitre importé', 'chapitres importés')}${nouvelles ? `, ${pluriel(nouvelles, 'matière créée', 'matières créées')}` : ''}.`);
    });
    const zone = modale().querySelector('.apercu-import');
    const maj = () => {
      const g = analyse();
      const defaut = modale().querySelector('[name=defaut]').value;
      zone.innerHTML = g.length ? `<p class="surtitre">Aperçu</p><ul>${g.map((x) => { const m = cible(x, defaut); return `<li><b>${esc(m ? m.nom : (x.matiere || 'Programme'))}</b> ${m ? '' : '<span class="etiquette jaune">nouvelle</span>'} · ${pluriel(x.chapitres.length, 'chapitre')}<span>${esc(x.chapitres.slice(0, 4).join(' · '))}${x.chapitres.length > 4 ? ' …' : ''}</span></li>`; }).join('')}</ul>` : '<p class="aide">L\'aperçu s\'affiche ici.</p>';
    };
    modale().querySelector('[name=texte]').addEventListener('input', maj);
    modale().querySelector('[name=defaut]').addEventListener('change', maj);
  }

  function modaleMatiere(id) {
    const m = id ? matiere(id) : null;
    const utilisees = new Set(E.matieres.map((x) => x.couleur));
    const defaut = m?.couleur || (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[E.matieres.length % B.couleurs.length]).id;
    const f = B.filieres.find((x) => x.id === E.filiere);
    const suggestions = f ? f.matieres.filter((n) => !E.matieres.some((x) => x.nom === n)) : [];
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(m?.nom || '')}" list="suggestions"></label>
      ${suggestions.length && !m ? `<datalist id="suggestions">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` : ''}
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Date de l'examen<small>Facultative. Les révisions s'arrêtent la veille.</small><input type="date" name="examen" value="${m?.examen || ''}"></label>
      <label class="champ">Énergie requise<small>Le niveau d'énergie qu'il te faut pour bien réviser cette matière. Modifiable cours par cours.</small><select name="energie">${NIVEAUX.map(([v, l]) => `<option value="${v}" ${(m?.energie || 'moyenne') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="champ">Ressources de la matière<small>Une par ligne&nbsp;: « titre | adresse » ou l'adresse seule (Google Drive, Notion ou autre lien https). Elles s'affichent sur chaque cours de la matière.</small><textarea name="ressources" rows="3" maxlength="3000" placeholder="Dossier Drive | https://drive.google.com/…&#10;https://www.notion.so/…">${esc(ressourcesVersTexte(m?.ressources))}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const nb = m ? E.chapitres.filter((c) => c.matiereId === m.id).length : 0;
    const pied = m ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(m ? 'Modifier la matière' : 'Nouvelle matière', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${m.nom} »${nb ? ` et ses ${pluriel(nb, 'chapitre')}` : ''} ?`)) return '';
        E.matieres = E.matieres.filter((x) => x.id !== m.id);
        E.chapitres = E.chapitres.filter((c) => c.matiereId !== m.id);
        sauver(); rendre(); toast(`« ${m.nom} » supprimée.`);
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la matière.';
      const examen = fd.get('examen') || null;
      const res = lireRessources(fd.get('ressources'));
      if (res.erreurs.length) return `Lien non reconnu (adresse https attendue) : ${res.erreurs[0].slice(0, 60)}`;
      const energie = NIVEAUX.some(([v]) => v === fd.get('energie')) ? fd.get('energie') : 'moyenne';
      if (m) {
        const examenChange = m.examen !== examen;
        Object.assign(m, { nom, couleur: fd.get('couleur'), examen, energie, ressources: res.ok });
        if (examenChange) replanifier((c) => c.matiereId === m.id);
      } else E.matieres.push({ id: uid(), nom, couleur: fd.get('couleur'), examen, energie, ressources: res.ok });
      sauver(); rendre(); toast(m ? 'Matière enregistrée.' : `« ${nom} » créée.`);
    });
  }

  function modaleMethode(id) {
    const m = methode(id);
    ouvrirModale(esc(m.nom), `<p class="surtitre" style="margin:0">Durée : ${esc(m.duree)}</p><p>${esc(m.principe)}</p><div class="methode" style="border:0;background:none"><ol>${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div>`,
      '<button class="btn primaire" value="ok">Compris</button><button class="btn" type="button" data-action="vue" data-vue="methodes">Toutes les méthodes</button>');
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Intervalles entre les révisions (jours)<small>Séparés par des virgules, croissants. Par défaut : ${B.intervalles.join(', ')}.</small><input name="intervalles" value="${r.intervalles.join(', ')}" inputmode="numeric"></label>
      <label class="champ">Révisions maximum par jour<small>Au-delà, les révisions sont décalées d'un ou deux jours.</small><input type="number" name="chargeMax" min="2" max="40" value="${r.chargeMax}"></label>
      <fieldset class="champ choix-theme"><legend>Thème</legend><div class="segments">${[['auto', 'Automatique'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${(r.theme || 'auto') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div><small>Automatique suit le réglage clair ou sombre de ton appareil.</small></fieldset>
      <label class="champ">Minuteur par défaut de la session guidée<select name="pomodoroDefaut">${r.pomodoros.map((x) => `<option value="${esc(x.id)}" ${x.id === r.pomodoroDefaut ? 'selected' : ''}>${esc(libPomodoro(x))}</option>`).join('')}</select></label>
      <div class="rang"><button class="btn petit" type="button" data-action="pomodoros">Gérer mes minuteurs</button><button class="btn petit" type="button" data-action="horaires">Horaires de révision</button><button class="btn petit" type="button" data-action="energie">Créneaux d'énergie</button></div>
      <div class="deux-champs"><label class="champ">Objectif de jours de révision par semaine<input type="number" name="objectifJours" min="1" max="7" value="${Number(r.objectifJours) || 5}"></label>
      <label class="champ">Objectif de révisions par jour<small>0 = sans objectif.</small><input type="number" name="objectifJour" min="0" max="40" value="${Number(r.objectifJour) || 0}"></label></div>
      <label class="case"><input type="checkbox" name="examensBlancs" ${r.examensBlancs !== false ? 'checked' : ''}> Examens blancs automatiques à J-10 et J-4 de chaque examen</label>
      <label class="case"><input type="checkbox" name="lecture" ${r.lecture ? 'checked' : ''}> Lecture facilitée (texte plus grand et plus espacé, utile en cas de dyslexie)</label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Rappels</h3><p class="aide">Ajoute tes séances de révision à l'agenda de ton téléphone : il te prévient chaque jour de révision, à l'heure choisie.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="agenda">Ajouter à mon agenda</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Importer mes matières</h3><p class="aide">Un fichier CSV (modèle fourni), avec aperçu avant validation. Un prompt prêt à copier convertit le PDF de ton programme au bon format.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="import-csv">Importer un CSV</button></div></div>
      <div class="groupe"><h3>Tutoriel</h3><p class="aide">Les 5 écrans de présentation du premier lancement.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le tutoriel</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const I = String(f.get('intervalles')).split(/[,;\s]+/).filter(Boolean).map(Number);
      if (!I.length || I.length > 10 || I.some((n) => !Number.isInteger(n) || n < 1 || n > 365) || I.some((n, i) => i && n <= I[i - 1])) return 'Intervalles : nombres entiers croissants entre 1 et 365, 10 au maximum.';
      const charge = Number(f.get('chargeMax'));
      if (!Number.isInteger(charge) || charge < 2 || charge > 40) return 'Révisions par jour : entre 2 et 40.';
      const changeI = I.join() !== r.intervalles.join();
      E.prenom = String(f.get('prenom') || '').trim();
      r.intervalles = I; r.chargeMax = charge;
      const oj = Number(f.get('objectifJours')), od = Number(f.get('objectifJour'));
      if (!Number.isInteger(oj) || oj < 1 || oj > 7) return 'Objectif hebdomadaire : entre 1 et 7 jours.';
      if (!Number.isInteger(od) || od < 0 || od > 40) return 'Objectif du jour : entre 0 et 40 révisions.';
      r.objectifJours = oj; r.objectifJour = od;
      if (r.pomodoros.some((x) => x.id === f.get('pomodoroDefaut'))) r.pomodoroDefaut = f.get('pomodoroDefaut');
      r.theme = ['auto', 'clair', 'sombre'].includes(f.get('theme')) ? f.get('theme') : 'auto';
      appliquerTheme(r.theme);
      r.examensBlancs = f.get('examensBlancs') === 'on';
      r.lecture = f.get('lecture') === 'on';
      document.body.classList.toggle('lecture', r.lecture);
      if (changeI) { E.chapitres.forEach((c) => { c.etape = Math.min(c.etape, I.length); }); replanifier(); }
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.matieres) || !Array.isArray(d.chapitres)) throw new Error();
        if (!confirm(`Remplacer ton planning actuel par cette copie (${pluriel(d.matieres.length, 'matière')}, ${pluriel(d.chapitres.length, 'chapitre')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
    });
  }

  function exporter() {
    telecharger(new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' }), `revisions-qme-laurine-${auj()}.json`);
  }

  // ---------- Session guidée ----------
  // Enchaîne les révisions du jour : méthode conseillée, minuteur Pomodoro, feuille blanche comparée aux
  // mots-clés du chapitre, puis évaluation. Le temps de travail compte dans le bilan (E.focus, minutes par jour).
  let S = null;
  const mmss = (sec) => `${deux(Math.floor(sec / 60))}:${deux(sec % 60)}`;
  // Modèles Pomodoro de l'étudiant (réglages) : travail, pause courte, pause longue toutes les `cycles` séances.
  const modelePomodoro = (id) => E.reglages.pomodoros.find((x) => x.id === id) || E.reglages.pomodoros.find((x) => x.id === E.reglages.pomodoroDefaut) || E.reglages.pomodoros[0] || POMODOROS_DEPART()[2];
  const libPomodoro = (x) => (x.travail ? `${x.nom} · ${x.travail} min, pause ${x.pauseCourte} min${x.cycles && x.pauseLongue ? `, longue ${x.pauseLongue} min toutes les ${x.cycles}` : ''}` : `${x.nom} · chronomètre`);
  const minute = () => (S?.modele?.travail || 0);

  // mode : 'travail' | 'pause' (courte ou longue, S.pauseLongue) ; feuille : session « feuille blanche » sur les mots-clés.
  function lancerSession(ids = aReviser().map((c) => c.id), feuille = false) {
    if (!ids.length) return;
    const modele = modelePomodoro();
    S = { ids, i: -1, faits: [], travail: 0, mode: 'travail', modele, cycle: 0, pauseLongue: false, restant: modele.travail * 60, tic: null, verrou: null, texte: '', comparaison: null, jour: auj(), feuille, note: null };
    const d = modale();
    d.classList.add('session');
    rendreSession();
    if (!d.open) d.showModal();
    d.addEventListener('close', fermerSession, { once: true });
  }

  function demarrerMinuteur() {
    clearInterval(S.tic);
    S.tic = setInterval(() => {
      if (!S) return;
      if (S.mode === 'travail') S.travail++;
      if (minute()) {
        S.restant = Math.max(0, S.restant - 1);
        if (S.restant === 0) {
          sonnerie();
          if (S.mode === 'travail') {
            S.cycle++;
            S.pauseLongue = S.modele.cycles > 0 && S.modele.pauseLongue > 0 && S.cycle % S.modele.cycles === 0;
            const pause = S.pauseLongue ? S.modele.pauseLongue : S.modele.pauseCourte;
            if (pause > 0) { S.mode = 'pause'; S.restant = pause * 60; } else S.restant = minute() * 60;
          } else { S.mode = 'travail'; S.restant = minute() * 60; }
          rendreSession();
          return;
        }
      }
      const el = $('#session-temps');
      if (el) el.textContent = minute() ? mmss(S.restant) : mmss(S.travail);
    }, 1000);
    navigator.wakeLock?.request('screen').then((v) => { if (S) S.verrou = v; }).catch(() => {});
  }

  function sonnerie() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = [660, 880, 990][i]; g.gain.value = 0.08;
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
      });
    } catch { /* son indisponible */ }
    navigator.vibrate?.([120, 80, 120]);
  }

  function fermerSession() {
    const d = modale();
    d.classList.remove('session');
    if (!S) return;
    clearInterval(S.tic);
    S.verrou?.release?.().catch?.(() => {});
    const minutes = Math.round(S.travail / 60);
    if (minutes > 0) { E.focus[S.jour] = (E.focus[S.jour] || 0) + minutes; sauver(); }
    if (S.note) { E.seances.push({ date: S.jour, note: S.note, minutes, n: S.faits.length, feuille: !!S.feuille }); E.seances = E.seances.slice(-400); sauver(); }
    S = null;
    rendre();
  }

  function rendreSession() {
    const d = modale();
    const total = S.ids.length;
    const chrono = minute() ? mmss(S.restant) : mmss(S.travail);
    const tete = (titre) => `<div class="session-tete"><div><p class="surtitre">${titre}</p>${S.i >= 0 && S.i < total ? `<div class="session-points" aria-label="Chapitre ${S.i + 1} sur ${total}">${S.ids.map((_, k) => `<i class="${k < S.i ? 'fait' : k === S.i ? 'actif' : ''}"></i>`).join('')}</div>` : ''}</div>
      ${S.i >= 0 && S.i < total ? `<div class="session-chrono ${S.mode}"><span>${S.mode === 'pause' ? (S.pauseLongue ? 'Pause longue' : 'Pause') : minute() ? `Concentration${S.modele.cycles ? ` · ${(S.cycle % S.modele.cycles) + 1}/${S.modele.cycles}` : ''}` : 'Temps'}</span><b id="session-temps" role="timer">${chrono}</b></div>` : ''}
      <button type="button" class="session-fermer" data-action="session-fermer" aria-label="Terminer la session">×</button></div>`;
    let corps;
    if (S.i < 0) {
      const liste = S.ids.map(chapitre);
      corps = `${tete(S.feuille ? 'Feuille blanche sur tes mots-clés' : 'Session guidée')}
        <div class="session-corps">
          <h2>${pluriel(total, 'chapitre')} · environ ${dureeTexte(S.feuille ? total * 8 : dureeSession(liste))}</h2>
          ${S.feuille ? '<p class="intro-feuille">Pour chaque cours&nbsp;: écris tout ce dont tu te souviens, cours fermé, puis compare avec tes mots-clés. Rien n\'est noté dans le planning tant que tu ne choisis pas « Difficile », « Moyen » ou « Facile ».</p>' : ''}
          <div class="session-conseils">
            <p><b>Téléphone en mode avion</b> ou « Ne pas déranger », notifications coupées.</p>
            <p><b>Une seule chose à la fois</b> : le chapitre affiché, rien d'autre.</p>
            <p><b>Feuille blanche d'abord</b> : écris ce dont tu te souviens avant de rouvrir le cours.</p>
          </div>
          <label class="champ session-pomodoro">Minuteur<select data-action="session-pomodoro">${E.reglages.pomodoros.map((x) => `<option value="${esc(x.id)}" ${x.id === S.modele.id ? 'selected' : ''}>${esc(libPomodoro(x))}</option>`).join('')}</select><small>Tes modèles se créent et se modifient dans Réglages, « Gérer mes minuteurs ».</small></label>
          <button type="button" class="btn primaire grand" data-action="session-suivant">${ICONES.lecture}Commencer</button>
          <ul class="session-liste" aria-label="Au programme">${liste.map((c) => `<li style="--c:${couleur(matiere(c.matiereId)?.couleur)}"><i></i><b>${esc(c.titre)}</b><span>${esc(matiere(c.matiereId)?.nom)} · ${esc(methodeDe(c).nom)}</span></li>`).join('')}</ul>
        </div>`;
    } else if (S.mode === 'pause') {
      corps = `${tete('Pause')}
        <div class="session-corps session-pause">
          <svg width="120" height="120" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="#D8E4F0"/><path d="M48 2 A46 46 0 0 1 94 48 H48Z" fill="#E8B93A"/></svg>
          <h2>${S.pauseLongue ? 'Pause longue' : 'Pause'} : ${mmss(S.restant)}</h2>
          <p>Lève-toi, bois un verre d'eau, regarde au loin. Pas d'écran : ton cerveau consolide pendant la pause.</p>
          <button type="button" class="btn primaire grand" data-action="session-reprendre">Reprendre maintenant</button>
        </div>`;
    } else if (S.i >= total) {
      const minutes = Math.round(S.travail / 60);
      const n = S.faits.length;
      const serieMaintenant = R.serie(E, auj());
      corps = `${tete('Session terminée')}
        <div class="session-corps session-fin">
          <svg width="120" height="120" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>
          <h2>${n ? 'Bien joué.' : 'Session terminée.'}</h2>
          <div class="session-chiffres"><div><b>${n}</b><span>${n > 1 ? 'chapitres révisés' : 'chapitre révisé'}</span></div><div><b>${dureeTexte(Math.max(1, minutes))}</b><span>de concentration</span></div><div><b>${serieMaintenant}</b><span>${serieMaintenant > 1 ? 'jours de suite' : 'jour de suite'}</span></div></div>
          <fieldset class="auto-eval"><legend>Comment évalues-tu cette séance&nbsp;?</legend>
            <div class="notes-seance">${[1, 2, 3, 4, 5].map((k) => `<button type="button" class="note-seance" data-action="session-note" data-note="${k}" aria-pressed="${S.note === k}" aria-label="${k} sur 5 : ${['très difficile', 'difficile', 'correcte', 'bonne', 'excellente'][k - 1]}">${k}</button>`).join('')}</div>
            <p class="aide">${S.note ? `Noté ${S.note}/5. Tu retrouves l'évolution de tes séances dans le Bilan.` : '1 = très difficile, 5 = excellente. Facultatif.'}</p></fieldset>
          <div class="rang"><button type="button" class="btn" data-action="partager">${ICONES.partage}Partager ma semaine</button><button type="button" class="btn primaire" data-action="session-fermer">Terminer</button></div>
        </div>`;
    } else {
      const c = chapitre(S.ids[S.i]);
      const m = matiere(c.matiereId);
      const meth = methodeDe(c);
      const cles = R.listeMotsCles(c.motsCles);
      const cmp = S.comparaison;
      corps = `${tete(`Chapitre ${S.i + 1} sur ${total}`)}
        <div class="session-corps session-chapitre" style="--c:${couleur(m?.couleur)}">
          <p class="carte-matiere">${esc(m?.nom)}${c.prochaine < auj() ? '<span class="etiquette rouge">En retard</span>' : ''}${c.finale ? '<span class="etiquette">Révision finale</span>' : ''}</p>
          <h2>${esc(c.titre)}</h2>
          <details class="session-methode"><summary>Méthode : <b>${esc(meth.nom)}</b> · ${esc(meth.duree)}</summary><p>${esc(meth.principe)}</p><ol>${meth.etapes.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
          <label class="champ feuille">Feuille blanche<small>Cours fermé : écris tout ce dont tu te souviens (plan, définitions, formules). Rien n'est envoyé ailleurs.</small><textarea id="feuille" rows="6" placeholder="Ce dont je me souviens…">${esc(S.texte)}</textarea></label>
          ${cles.length ? `<button type="button" class="btn petit" data-action="session-comparer">Comparer avec mes ${cles.length} mots-clés</button>`
            : `<label class="champ">Mots-clés du chapitre<small>Facultatif. Note les notions à retrouver (séparées par des virgules) : la prochaine fois, ta feuille blanche sera comparée à cette liste.</small><input id="session-cles" maxlength="1000" placeholder="Ex. : enzyme, site actif, Michaelis-Menten"></label>`}
          ${cmp ? `<div class="comparaison"><p><b>${cmp.trouves.length}/${cles.length}</b> mots-clés retrouvés de mémoire.</p>${cmp.trouves.length ? `<p class="mots">${cmp.trouves.map((x) => `<span class="mot ok">${esc(x)}</span>`).join('')}</p>` : ''}${cmp.manques.length ? `<p class="mots">${cmp.manques.map((x) => `<span class="mot manque">${esc(x)}</span>`).join('')}</p><p class="aide">Rouvre le cours sur les mots en rouge : ce sont eux qui feront la différence le jour J.</p>` : ''}</div>` : ''}
          <p class="session-question">Comment ça s'est passé ?${cmp?.suggestion ? ' <span>Suggestion d\'après tes mots-clés en surbrillance.</span>' : ''}</p>
          <div class="carte-eval session-eval" role="group" aria-label="Comment s'est passée la révision de ${esc(c.titre)} ?">
            ${['difficile', 'moyen', 'facile'].map((ev) => `<button type="button" class="ev ${ev} ${cmp?.suggestion === ev ? 'suggere' : ''}" data-action="session-evaluer" data-eval="${ev}">${{ difficile: 'Difficile', moyen: 'Moyen', facile: 'Facile' }[ev]}<small>${apercu(c, ev)}</small></button>`).join('')}
          </div>
          <button type="button" class="btn lien" data-action="session-passer">Passer ce chapitre</button>
        </div>`;
    }
    d.innerHTML = `<div class="session-cadre">${corps}</div>`;
    d.querySelector('[data-action="session-pomodoro"]')?.addEventListener('change', (e) => actionSession('session-pomodoro', e.target));
    const zone = $('#feuille');
    if (zone) zone.addEventListener('input', () => { S.texte = zone.value; });
    const champCles = $('#session-cles');
    if (champCles) champCles.addEventListener('change', () => { const c = chapitre(S.ids[S.i]); c.motsCles = champCles.value.trim(); sauver(); });
  }

  function actionSession(action, el) {
    if (!S) return;
    switch (action) {
      case 'session-pomodoro': S.modele = modelePomodoro(el.value); S.cycle = 0; S.restant = minute() * 60; break;
      case 'session-suivant': S.i = 0; S.mode = 'travail'; S.restant = minute() * 60; demarrerMinuteur(); rendreSession(); break;
      case 'session-reprendre': S.mode = 'travail'; S.restant = minute() * 60; rendreSession(); break;
      case 'session-note': S.note = Number(el.dataset.note); rendreSession(); modale().querySelector(`[data-note="${S.note}"]`)?.focus(); break;
      case 'session-comparer': { const c = chapitre(S.ids[S.i]); S.comparaison = R.comparerRappel(S.texte, c.motsCles); rendreSession(); break; }
      case 'session-evaluer': {
        const c = chapitre(S.ids[S.i]);
        if (c) { appliquerEvaluation(c, el.dataset.eval); S.faits.push(c.id); sauver(); }
        S.i++; S.texte = ''; S.comparaison = null; rendreSession(); modale().scrollTop = 0; break;
      }
      case 'session-passer': S.i++; S.texte = ''; S.comparaison = null; rendreSession(); modale().scrollTop = 0; break;
      case 'session-fermer': modale().close(); break;
      default: break;
    }
  }

  // ---------- Rattrapage, jauge, examens blancs, agenda ----------
  function modaleRattrapage() {
    const t = auj();
    const plan = R.planRattrapage(E, t);
    if (!plan.affectations.length) return;
    const lignes = plan.jours.map((j) => {
      const noms = plan.affectations.filter((a) => a.date === j.date).map((a) => chapitre(a.id));
      return `<div class="ligne"><i style="background:var(--jaune)"></i><div><b>${quand(j.date).replace(/^./, (x) => x.toUpperCase())} · ${pluriel(j.n, 'révision')} rattrapée${j.n > 1 ? 's' : ''}</b><span>${esc(noms.slice(0, 4).map((c) => c.titre).join(' · '))}${noms.length > 4 ? ' …' : ''}</span></div><span></span></div>`;
    }).join('');
    ouvrirModale('Plan de rattrapage', `
      <p>Tes ${pluriel(plan.affectations.length, 'révision')} en retard sont réparties à partir d'aujourd'hui, sans dépasser <b>${E.reglages.chargeMax} révisions par jour</b> (en comptant celles déjà prévues). Les matières dont l'examen approche passent en premier, et rien ne tombe le jour d'un examen.</p>
      <div class="jour-detail" style="padding:0;border:0;background:none">${lignes}</div>
      <p class="aide">Tu pourras annuler juste après.</p>`,
    '<button class="btn primaire" value="ok">Répartir</button><button class="btn" value="annuler">Annuler</button>', () => {
      annulation = { chapitres: structuredClone(E.chapitres) };
      R.appliquerRattrapage(E, plan);
      sauver(); rendre();
      toast(`Retards répartis sur ${pluriel(plan.jours.length, 'jour')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleJauge() {
    const I = E.reglages.intervalles;
    const n = R.seuilSolide(E);
    ouvrirModale('Prêt pour le jour J', `
      <p>Un chapitre est <b>solide</b> quand il a passé au moins ${n} étapes de révision (J+${I.slice(0, n).join(', J+')}) ou qu'il est maîtrisé.</p>
      <p>La jauge foncée compte les chapitres solides aujourd'hui. La partie claire montre ce que donnera le planning le jour de l'examen <b>si tu fais chaque révision prévue</b>, avec la réponse « Moyen » à chaque fois. Le calcul rejoue jour par jour tout ton planning, avec la limite de ${E.reglages.chargeMax} révisions par jour.</p>
      <p class="aide">C'est une projection de ton avancement, pas une note ni une probabilité de réussite. Un chapitre pas encore vu en cours ne peut pas être solide&nbsp;: ajoute vite ceux que tu as vus.</p>`,
    '<button class="btn primaire" value="ok">Compris</button>');
  }

  function marquerBlanc(cle, etatBlanc) {
    annulation = { blancs: { ...E.blancs } };
    E.blancs[cle] = etatBlanc;
    sauver(); rendre();
    toast(etatBlanc === 'fait' ? 'Examen blanc noté. Avance la révision des chapitres qui ont coincé.' : 'Examen blanc passé.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleAgenda() {
    const t = auj();
    const nb = new Set(E.chapitres.filter((c) => c.prochaine && c.prochaine <= ajout(t, 27)).map((c) => (c.prochaine < t ? t : c.prochaine))).size;
    ouvrirModale('Ajouter à mon agenda', `
      <p>Un fichier agenda (.ics) avec <b>une séance par jour de révision</b> sur les 4 prochaines semaines (${pluriel(nb, 'jour')}), la liste des chapitres dans la description et <b>un rappel à l'heure choisie</b>, plus tes dates d'examen.</p>
      <label class="champ">Heure de la séance et du rappel<small>Proposée d'après tes horaires du jour.</small><input type="time" name="heure" value="${esc(E.reglages.horaires[versDate(t).getDay()]?.actif ? E.reglages.horaires[versDate(t).getDay()].debut : (E.reglages.heureAgenda || '18:00'))}" required></label>
      <p class="aide">Sur iPhone, ouvre le fichier puis « Ajouter tout ». Sur Android ou ordinateur, importe-le dans Google Agenda (Paramètres &gt; Importer). C'est une photo de ton planning à cette date&nbsp;: refais l'export quand il change beaucoup.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Télécharger le fichier</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const heure = String(f.get('heure') || '');
      if (!/^\d{2}:\d{2}$/.test(heure)) return 'Choisis une heure.';
      E.reglages.heureAgenda = heure; sauver();
      const maintenant = new Date();
      const horodatage = `${maintenant.getUTCFullYear()}${deux(maintenant.getUTCMonth() + 1)}${deux(maintenant.getUTCDate())}T${deux(maintenant.getUTCHours())}${deux(maintenant.getUTCMinutes())}00Z`;
      telecharger(new Blob([R.exportIcs(E, t, { heure, horodatage })], { type: 'text/calendar;charset=utf-8' }), `revisions-${t}.ics`);
      toast('Fichier agenda téléchargé.');
    });
  }

  function telecharger(blob, nom) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  const joursListe = (L) => (L.length > 1 ? `${L.slice(0, -1).join(', ')} et ${L.at(-1)}` : String(L[0]));

  // Premier lancement : le guide d'abord, puis (sur téléphone) la fenêtre « Comme une application ».
  function premiersPas() {
    if (E.tutorielVu) return proposerEcranAccueil();
    setTimeout(() => {
      if (!E || E.tutorielVu || modale().open) return;
      E.tutorielVu = true; sauver();
      modaleTutoriel(true);
      modale().addEventListener('close', proposerEcranAccueil, { once: true });
    }, 300);
  }

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
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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

  // =====================================================================================================
  // Version privée « Révisions QME X Laurine » : fonctionnalités validées après la visio du 26/11/2026.
  // =====================================================================================================
  const X = window.RVXR;

  // ---------- Thème clair / sombre / automatique ----------
  // Mémorisé dans les réglages (synchronisés) et dans ce navigateur (appliqué avant le premier rendu, index.html).
  function appliquerTheme(theme = 'auto') {
    const t = ['clair', 'sombre'].includes(theme) ? theme : 'auto';
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    stock.ecrire(CLE_THEME, t);
    const sombre = t === 'sombre' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', sombre ? '#17181C' : '#FBF7F1'));
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!E || (E.reglages.theme || 'auto') === 'auto') appliquerTheme('auto'); });
  appliquerTheme(stock.lire(CLE_THEME) || 'auto');

  // ---------- Ordre du jour : suggéré, réordonnable ----------
  function reordonner(id, vers) {
    const ids = aReviser().map((c) => c.id);
    const nouvel = X.deplacerDans(ids, id, vers);
    if (nouvel.join() === ids.join()) return;
    E.ordre = Object.fromEntries(Object.entries(E.ordre || {}).filter(([d]) => d >= ajout(auj(), -7))); // purge des vieux jours
    E.ordre[auj()] = nouvel;
    sauver(); rendre();
    const c = chapitre(id);
    annoncer(`« ${c?.titre} » en position ${nouvel.indexOf(id) + 1} sur ${nouvel.length}.`);
    const bouton = $(`[data-carte="${id}"] [data-action="${typeof vers === 'number' && vers < 0 ? 'monter' : 'descendre'}"]:not(:disabled)`) || $(`[data-carte="${id}"] .btn-ordre:not(:disabled)`);
    bouton?.focus({ preventScroll: true });
  }
  // Glisser-déposer des cartes (souris et tactile par Pointer Events, sans bibliothèque).
  function brancherGlisser() {
    const ul = $('#cartes-jour');
    if (!ul || ul.children.length < 2) return;
    let tire = null;
    ul.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li.carte');
      if (!li) return;
      tire = li.dataset.carte; li.classList.add('tiree');
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tire);
    });
    ul.addEventListener('dragend', () => { ul.querySelectorAll('.tiree,.cible').forEach((x) => x.classList.remove('tiree', 'cible')); tire = null; });
    ul.addEventListener('dragover', (e) => {
      if (!tire) return;
      e.preventDefault();
      const li = e.target.closest('li.carte');
      ul.querySelectorAll('.cible').forEach((x) => x.classList.remove('cible'));
      if (li && li.dataset.carte !== tire) li.classList.add('cible');
    });
    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      const li = e.target.closest('li.carte');
      if (tire && li && li.dataset.carte !== tire) reordonner(tire, li.dataset.carte);
    });
    // Tactile : appui long sur la poignée puis glisser.
    ul.querySelectorAll('.poignee').forEach((p) => p.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const li = p.closest('li.carte');
      const id = li.dataset.carte;
      li.classList.add('tiree');
      p.setPointerCapture(e.pointerId);
      const bouge = (ev) => {
        ul.querySelectorAll('.cible').forEach((x) => x.classList.remove('cible'));
        const sous = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('li.carte');
        if (sous && sous !== li) sous.classList.add('cible');
      };
      const fin = (ev) => {
        p.removeEventListener('pointermove', bouge); p.removeEventListener('pointerup', fin); p.removeEventListener('pointercancel', fin);
        const sous = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('li.carte');
        li.classList.remove('tiree'); ul.querySelectorAll('.cible').forEach((x) => x.classList.remove('cible'));
        if (ev.type === 'pointerup' && sous && sous !== li) reordonner(id, sous.dataset.carte);
      };
      p.addEventListener('pointermove', bouge); p.addEventListener('pointerup', fin); p.addEventListener('pointercancel', fin);
      e.preventDefault();
    }));
  }
  // Annonce pour les lecteurs d'écran (zone polie du toast).
  function annoncer(texte) { const z = $('#annonce'); if (z) { z.textContent = ''; setTimeout(() => { z.textContent = texte; }, 30); } }

  // ---------- Déplacer ou regrouper une révision ----------
  // La date calculée reste une suggestion : c.suggeree la garde pour « Revenir à la date suggérée ».
  function modaleDeplacer(id) {
    const c = chapitre(id);
    if (!c?.prochaine) return;
    const t = auj();
    const m = matiere(c.matiereId);
    const jours = X.joursDeplacement(c.prochaine, t, examenFutur(m, t));
    const prevue = c.prochaine < t ? t : c.prochaine;
    const proches = X.aRegrouper(E.chapitres, c.matiereId, prevue, t, c.id);
    const suggeree = c.suggeree && c.suggeree !== c.prochaine ? c.suggeree : null;
    const corps = `
      <p><b>${esc(c.titre)}</b> · ${esc(m?.nom)}. Révision prévue ${quand(prevue)}${suggeree ? ` (date suggérée par le planning&nbsp;: ${quand(suggeree < t ? t : suggeree)})` : ''}.</p>
      <fieldset class="choix-jours"><legend>Déplacer vers un jour proche</legend>
        ${jours.length ? `<div class="jours-proches">${jours.map((j) => `<label><input type="radio" name="jour" value="${j.date}"><span><b>${quand(j.date).replace(/^./, (x) => x.toUpperCase())}</b><small>${j.ecart > 0 ? `+${j.ecart}` : j.ecart} j · ${pluriel(chargeDu(j.date), 'révision')}</small></span></label>`).join('')}</div>` : '<p class="aide">Aucun jour possible (examen trop proche).</p>'}
      </fieldset>
      ${proches.length ? `<label class="case"><input type="checkbox" name="regrouper"> Regrouper aussi ${pluriel(proches.length, 'autre cours', 'autres cours')} de ${esc(m?.nom)} prévus à ±3 jours (${esc(proches.slice(0, 3).map((x) => x.titre).join(', '))}${proches.length > 3 ? '…' : ''}) le même jour</label>` : ''}
      <p class="aide">Le planning propose, tu décides&nbsp;: les dates suivantes se recalculeront après ta révision, comme d'habitude.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Déplacer</button>${suggeree ? '<button class="btn" value="suggestion">Revenir à la date suggérée</button>' : ''}<button class="btn" value="annuler">Annuler</button>`;
    ouvrirModale('Déplacer ou regrouper', corps, pied, (f, action) => {
      if (action === 'suggestion') { revenirSuggestion(c.id); return; }
      const jour = f.get('jour');
      if (!jour) return 'Choisis un jour.';
      annulation = { chapitres: structuredClone(E.chapitres) };
      const groupe = f.get('regrouper') === 'on' ? [c, ...proches] : [c];
      groupe.forEach((x) => { if (!x.suggeree) x.suggeree = x.prochaine; x.prochaine = jour; if (x.suggeree === jour) delete x.suggeree; });
      if (E.ordre?.[auj()]) delete E.ordre[auj()];
      sauver(); rendre();
      toast(groupe.length > 1 ? `${groupe.length} cours de ${m?.nom} regroupés ${quand(jour)}.` : `« ${c.titre} » déplacé ${quand(jour)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }
  function revenirSuggestion(id) {
    const c = chapitre(id);
    if (!c?.suggeree) return;
    annulation = { id, avant: structuredClone(c) };
    c.prochaine = c.suggeree; delete c.suggeree;
    sauver(); rendre();
    toast(`« ${c.titre} » revient à la date suggérée (${quand(c.prochaine < auj() ? auj() : c.prochaine)}).`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Feuille blanche sur les mots-clés ----------
  // Les mots-clés ne sont plus mis en avant sur les cartes : ils servent à proposer une session « feuille blanche »
  // sur les cours qui en ont, du souvenir le plus faible au plus fort (5 cours au plus).
  function coursFeuilleBlanche() {
    const t = auj();
    return E.chapitres.filter((c) => c.appris && R.listeMotsCles(c.motsCles).length >= 2)
      .map((c) => ({ c, s: R.forceSouvenir(E, c, t) ?? 100 }))
      .sort((a, b) => a.s - b.s).slice(0, 5).map((x) => x.c);
  }
  function propositionFeuilleBlanche() {
    const l = coursFeuilleBlanche();
    if (!l.length) return '';
    const n = l.reduce((s, c) => s + R.listeMotsCles(c.motsCles).length, 0);
    return `<aside class="feuille-blanche-carte"><div><p class="surtitre">Feuille blanche · ${pluriel(l.length, 'cours')}</p>
      <h3>Teste ta mémoire sur ${n} mots-clés</h3>
      <p>Cours fermé, écris tout ce dont tu te souviens sur ${esc(l.slice(0, 3).map((c) => c.titre).join(', '))}${l.length > 3 ? '…' : ''}, puis compare avec tes mots-clés. Les cours au souvenir le plus fragile d'abord.</p></div>
      <button type="button" class="btn primaire" data-action="feuille-blanche">Lancer la feuille blanche</button></aside>`;
  }

  // ---------- Centre de notifications (interne à l'appli, aucune notification push) ----------
  function notifications() {
    const t = auj();
    const l = [];
    const dus = aReviser();
    const retards = dus.filter((c) => c.prochaine < t);
    const faits = faitsAujourdhui().length;
    const h = E.reglages.horaires[versDate(t).getDay()];
    if (retards.length) l.push({ id: `retard-${t}`, type: 'rouge', titre: `${pluriel(retards.length, 'révision')} en retard`, texte: 'Le plan de rattrapage les répartit sur les prochains jours sans dépasser ta limite quotidienne.', action: ['rattrapage', 'Voir le plan'] });
    if (dus.length - retards.length > 0) l.push({ id: `dues-${t}`, type: 'jaune', titre: `${pluriel(dus.length - retards.length, 'révision due', 'révisions dues')} aujourd'hui`, texte: h?.actif ? `Ton créneau de révision : ${h.debut} – ${h.fin}.` : 'Aujourd\'hui est un jour de repos dans tes horaires : déplace-les si tu préfères.', action: ['session', 'Lancer ma session'] });
    const serie = R.serie(E, t);
    if (serie > 0 && !faits && dus.length) l.push({ id: `serie-${t}`, type: 'jaune', titre: `Ta série de ${pluriel(serie, 'jour')} est en jeu`, texte: 'Une seule révision aujourd\'hui suffit à la prolonger.', action: ['session', 'Réviser maintenant'] });
    if (serie > 0 && faits) l.push({ id: `serie-ok-${t}`, type: 'bleu', titre: `Série de ${pluriel(serie, 'jour')} prolongée`, texte: `${pluriel(faits, 'révision faite', 'révisions faites')} aujourd'hui.` });
    const s = objectifSemaine();
    if (s.reste > 0 && s.joursRestants < s.reste + 1) l.push({ id: `objectif-${s.lundi}`, type: 'rouge', titre: `Objectif de la semaine : ${s.fait}/${s.objectif} jours`, texte: `Encore ${pluriel(s.reste, 'jour')} de révision à faire d'ici dimanche.` });
    else if (s.reste <= 0) l.push({ id: `objectif-ok-${s.lundi}`, type: 'bleu', titre: 'Objectif de la semaine atteint', texte: `${s.fait} jours de révision cette semaine. Bravo.` });
    const ex = prochainExamen();
    if (ex) { const j = ecart(t, ex.examen); if (j <= 14) l.push({ id: `examen-${ex.id}-${t}`, type: 'rouge', titre: j === 0 ? `Examen de ${ex.nom} aujourd'hui` : `${ex.nom} : examen dans ${pluriel(j, 'jour')}`, texte: fmt(ex.examen, { weekday: 'long', day: 'numeric', month: 'long' }) }); }
    R.examensBlancs(E, t).filter((b) => b.du).forEach((b) => l.push({ id: `blanc-${b.cle}`, type: 'jaune', titre: `Examen blanc de ${matiere(b.matiereId)?.nom}`, texte: `Prévu à J-${b.jMoins} de l'examen.`, action: ['vue-aujourdhui', 'Voir'] }));
    return l;
  }
  const nonLues = () => notifications().filter((n) => !E.notifsLues?.[n.id]);
  function majPastilleNotifs() {
    const b = $('.cloche');
    if (!b || !E) return;
    const n = nonLues().length;
    const p = b.querySelector('.pastille-notif');
    p.hidden = !n; p.textContent = n > 9 ? '9+' : String(n);
    b.setAttribute('aria-label', n ? `Notifications, ${n} non lue${n > 1 ? 's' : ''}` : 'Notifications');
  }
  function modaleNotifications() {
    const l = notifications();
    const corps = l.length ? `<ul class="notifs">${l.map((n) => `<li class="notif ${n.type} ${E.notifsLues?.[n.id] ? 'lue' : ''}"><i aria-hidden="true"></i><div><b>${esc(n.titre)}</b><span>${esc(n.texte)}</span></div>${n.action ? `<button type="button" class="btn petit" data-action="${n.action[0]}">${esc(n.action[1])}</button>` : ''}</li>`).join('')}</ul>
      <p class="aide">Ces rappels restent dans l'appli : aucune notification n'est envoyée sur ton téléphone.</p>`
      : '<p>Rien à signaler pour l\'instant. Reviens demain&nbsp;!</p>';
    ouvrirModale('Notifications', corps, '<button class="btn primaire" value="ok">Fermer</button>');
    // Ouvrir le centre marque les notifications comme lues (gardées 30 jours).
    const lim = ajout(auj(), -30);
    E.notifsLues = Object.fromEntries(Object.entries(E.notifsLues || {}).filter(([, d]) => d >= lim));
    l.forEach((n) => { E.notifsLues[n.id] = auj(); });
    sauver(); majPastilleNotifs();
  }

  // ---------- Objectifs et auto-évaluation ----------
  function objectifSemaine() {
    const t = auj();
    const lundi = ajout(t, -((versDate(t).getDay() + 6) % 7));
    const jours = R.joursRevises(E);
    const fait = Object.keys(jours).filter((d) => d >= lundi && d <= t && jours[d] >= 1).length;
    const objectif = Number(E.reglages.objectifJours) || 5;
    return { lundi, fait, objectif, reste: objectif - fait, joursRestants: 6 - ecart(lundi, t) };
  }
  function blocObjectifsBilan() {
    const s = objectifSemaine();
    const seances = enListe(E.seances).filter((x) => x.date > ajout(auj(), -30));
    const moyenne = seances.length ? seances.reduce((a, x) => a + x.note, 0) / seances.length : null;
    const dernieres = enListe(E.seances).slice(-10);
    return `<h2 class="titre-section">Objectifs et séances <span>Objectif réglable dans les réglages.</span></h2>
      <div class="objectifs">
        <div class="objectif-carte"><p class="surtitre">Objectif de la semaine</p><div class="anneau grand" style="--p:${Math.min(100, pct(s.fait, s.objectif))}" role="img" aria-label="${s.fait} jours de révision sur ${s.objectif} cette semaine"><b>${s.fait}/${s.objectif}</b></div><p>${s.reste > 0 ? `Encore ${pluriel(s.reste, 'jour')} de révision d'ici dimanche.` : 'Objectif atteint cette semaine.'}</p></div>
        <div class="objectif-carte"><p class="surtitre">Auto-évaluation des séances</p><b class="grand-chiffre">${moyenne === null ? '–' : moyenne.toFixed(1).replace('.', ',')}<small>/5</small></b><p>${seances.length ? `Moyenne de ${pluriel(seances.length, 'séance notée', 'séances notées')} sur 30 jours.` : 'Note chaque séance de 1 à 5 à la fin de la session guidée.'}</p>
          ${dernieres.length ? `<div class="barres-notes" role="img" aria-label="Dix dernières notes : ${dernieres.map((x) => x.note).join(', ')}">${dernieres.map((x) => `<i style="--h:${x.note * 20}%" title="${fmt(x.date)} : ${x.note}/5"></i>`).join('')}</div>` : ''}</div>
      </div>`;
  }

  // ---------- Modèles Pomodoro ----------
  function modalePomodoros(editer = null) {
    const r = E.reglages;
    const x = editer === 'nouveau' ? { id: '', nom: '', travail: 30, pauseCourte: 5, pauseLongue: 15, cycles: 4 } : r.pomodoros.find((p) => p.id === editer);
    if (x) {
      const corps = `
        <label class="champ">Nom du modèle<input name="nom" required maxlength="40" value="${esc(x.nom)}" placeholder="Ex. : Matin concentré"></label>
        <div class="deux-champs"><label class="champ">Travail (min)<small>0 = chronomètre, sans pauses.</small><input type="number" name="travail" min="0" max="180" value="${x.travail}" required></label>
        <label class="champ">Pause courte (min)<input type="number" name="pauseCourte" min="0" max="60" value="${x.pauseCourte}" required></label></div>
        <div class="deux-champs"><label class="champ">Pause longue (min)<input type="number" name="pauseLongue" min="0" max="90" value="${x.pauseLongue}" required></label>
        <label class="champ">Cycles avant la pause longue<small>0 = jamais de pause longue.</small><input type="number" name="cycles" min="0" max="12" value="${x.cycles}" required></label></div>
        <label class="case"><input type="checkbox" name="defaut" ${r.pomodoroDefaut === x.id ? 'checked' : ''}> Modèle par défaut</label>
        <p class="erreur" role="alert"></p>`;
      const pied = `<button class="btn primaire" value="ok">Enregistrer</button>${x.id && r.pomodoros.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}<button class="btn" value="retour">Retour</button>`;
      ouvrirModale(x.id ? 'Modifier le minuteur' : 'Nouveau minuteur', corps, pied, (f, action) => {
        if (action === 'retour') { setTimeout(() => modalePomodoros(), 0); return; }
        if (action === 'supprimer') {
          r.pomodoros = r.pomodoros.filter((p) => p.id !== x.id);
          if (r.pomodoroDefaut === x.id) r.pomodoroDefaut = r.pomodoros[0].id;
          sauver(); setTimeout(() => modalePomodoros(), 0); toast(`Minuteur « ${x.nom} » supprimé.`); return;
        }
        const nom = String(f.get('nom') || '').trim();
        const v = (k, max) => { const n = Number(f.get(k)); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; };
        const travail = v('travail', 180), pauseCourte = v('pauseCourte', 60), pauseLongue = v('pauseLongue', 90), cycles = v('cycles', 12);
        if (!nom) return 'Donne un nom au modèle.';
        if ([travail, pauseCourte, pauseLongue, cycles].includes(null)) return 'Durées : nombres entiers (travail 0 à 180 min, pauses 0 à 90 min, cycles 0 à 12).';
        const modele = { id: x.id || `pomo-${uid()}`, nom, travail, pauseCourte: travail ? pauseCourte : 0, pauseLongue: travail ? pauseLongue : 0, cycles: travail ? cycles : 0 };
        if (x.id) Object.assign(x, modele); else r.pomodoros.push(modele);
        if (f.get('defaut') === 'on') r.pomodoroDefaut = modele.id;
        sauver(); setTimeout(() => modalePomodoros(), 0); toast('Minuteur enregistré.');
      });
      return;
    }
    const corps = `<p>Crée tes propres minuteurs&nbsp;: durée de travail, pause courte, pause longue et nombre de cycles avant la pause longue. Le modèle par défaut est proposé au lancement de chaque session.</p>
      <ul class="liste-pomodoros">${r.pomodoros.map((p) => `<li><div><b>${esc(p.nom)}</b>${p.id === r.pomodoroDefaut ? ' <span class="etiquette bleu">Par défaut</span>' : ''}<span>${p.travail ? `${p.travail} min · pause ${p.pauseCourte} min${p.cycles && p.pauseLongue ? ` · pause longue ${p.pauseLongue} min toutes les ${p.cycles} séances` : ''}` : 'Chronomètre, sans pause imposée'}</span></div>
        <div class="rang">${p.id !== r.pomodoroDefaut ? `<button type="button" class="btn petit" data-action="pomodoro-defaut" data-id="${esc(p.id)}">Par défaut</button>` : ''}<button type="button" class="btn petit" data-action="pomodoro-modifier" data-id="${esc(p.id)}" aria-label="Modifier ${esc(p.nom)}">Modifier</button></div></li>`).join('')}</ul>`;
    ouvrirModale('Mes minuteurs', corps, '<button class="btn primaire" value="nouveau">Nouveau minuteur</button><button class="btn" value="ok">Fermer</button>', (_, action) => {
      if (action === 'nouveau') setTimeout(() => modalePomodoros('nouveau'), 0);
    });
  }

  // ---------- Horaires de révision par jour ----------
  function modaleHoraires() {
    const h = E.reglages.horaires;
    const corps = `<p>Tes plages de révision pour chaque jour de la semaine. Elles s'affichent dans Aujourd'hui, dans les notifications, et servent d'heure de rappel pour l'export agenda.</p>
      <div class="horaires">${ORDRE_JOURS.map((j) => `<fieldset class="horaire"><legend>${JOURS_SEMAINE[j]}</legend>
        <label class="case"><input type="checkbox" name="actif-${j}" ${h[j]?.actif ? 'checked' : ''}> Je révise</label>
        <label class="champ">De<input type="time" name="debut-${j}" value="${esc(h[j]?.debut || '18:00')}"></label>
        <label class="champ">À<input type="time" name="fin-${j}" value="${esc(h[j]?.fin || '20:00')}"></label></fieldset>`).join('')}</div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Horaires de révision', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = {};
      for (const j of ORDRE_JOURS) {
        const debut = String(f.get(`debut-${j}`) || ''), fin = String(f.get(`fin-${j}`) || '');
        const actif = f.get(`actif-${j}`) === 'on';
        if (actif && (!/^\d{2}:\d{2}$/.test(debut) || !/^\d{2}:\d{2}$/.test(fin) || minutesDe(fin) <= minutesDe(debut))) return `${JOURS_SEMAINE[j]} : l'heure de fin doit suivre l'heure de début.`;
        n[j] = { actif, debut: debut || '18:00', fin: fin || '20:00' };
      }
      E.reglages.horaires = n;
      sauver(); rendre(); toast('Horaires enregistrés.');
    });
  }

  // ---------- Créneaux d'énergie ----------
  function modaleEnergie() {
    const l = enListe(E.reglages.energie).length ? E.reglages.energie : ENERGIE_DEPART();
    const ligne = (x, k) => `<fieldset class="creneau-energie"><legend class="sr-only">Créneau ${k + 1}</legend>
      <label class="champ">De<input type="time" name="debut" value="${esc(x.debut)}"></label>
      <label class="champ">À<input type="time" name="fin" value="${esc(x.fin)}"></label>
      <label class="champ">Énergie<select name="niveau">${NIVEAUX.map(([v, lib]) => `<option value="${v}" ${x.niveau === v ? 'selected' : ''}>${lib}</option>`).join('')}</select></label>
      <button type="button" class="btn petit" data-action="energie-suppr" aria-label="Supprimer le créneau ${k + 1}">Retirer</button></fieldset>`;
    const corps = `<p>Découpe ta journée selon ton énergie habituelle. Chaque matière (et, si besoin, chaque cours) indique l'énergie qu'elle demande&nbsp;: dans Aujourd'hui, les cours adaptés au créneau en cours passent en tête.</p>
      <div id="creneaux-energie">${l.map(ligne).join('')}</div>
      <button type="button" class="btn petit" data-action="energie-ajout">Ajouter un créneau</button>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Créneaux d\'énergie', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = f.getAll('debut'), fi = f.getAll('fin'), nv = f.getAll('niveau');
      const n = d.map((x, i) => ({ debut: String(x), fin: String(fi[i]), niveau: NIVEAUX.some(([v]) => v === nv[i]) ? nv[i] : 'moyenne' })).filter((x) => x.debut && x.fin);
      if (n.some((x) => minutesDe(x.fin) <= minutesDe(x.debut))) return 'Chaque créneau doit finir après son début.';
      n.sort((a, b) => minutesDe(a.debut) - minutesDe(b.debut));
      if (n.some((x, i) => i && minutesDe(x.debut) < minutesDe(n[i - 1].fin))) return 'Deux créneaux se chevauchent.';
      E.reglages.energie = n;
      sauver(); rendre(); toast('Créneaux d\'énergie enregistrés.');
    });
    const zone = $('#creneaux-energie');
    modale().querySelector('[data-action="energie-ajout"]').addEventListener('click', () => {
      zone.insertAdjacentHTML('beforeend', ligne({ debut: '20:00', fin: '22:00', niveau: 'faible' }, zone.children.length));
      zone.lastElementChild.querySelector('input').focus();
    });
    zone.addEventListener('click', (e) => { const b = e.target.closest('[data-action="energie-suppr"]'); if (b) { b.closest('fieldset').remove(); modale().querySelector('[data-action="energie-ajout"]').focus(); } });
  }

  // ---------- Import CSV des matières ----------
  function modaleImportCsv() {
    const t = auj();
    let analyse = null;
    const corps = `
      <p>Un fichier CSV, <b>une ligne par cours</b>&nbsp;: <code>${X.COLONNES.join(';')}</code>. Seules les colonnes <b>matiere</b> et <b>cours</b> sont obligatoires. Un aperçu s'affiche avant tout import.</p>
      <div class="rang"><button type="button" class="btn petit" data-action="csv-modele">Télécharger le modèle CSV</button><button type="button" class="btn petit" data-action="csv-prompt">Copier le prompt « PDF vers CSV »</button></div>
      <details class="prompt-pdf"><summary>Voir le prompt pour convertir un PDF</summary><p class="aide">Colle ce texte dans un assistant (ChatGPT, Claude…) avec le PDF de ton programme, puis enregistre sa réponse dans un fichier .csv.</p><pre id="prompt-pdf" tabindex="0">${esc(X.PROMPT_PDF)}</pre></details>
      <label class="champ">Fichier CSV<input type="file" id="csv-fichier" accept=".csv,text/csv,text/plain"></label>
      <label class="champ">ou colle le contenu<textarea name="csv" rows="5" maxlength="400000" placeholder="matiere;cours;examen;energie;vu_le;mots_cles;ressources"></textarea></label>
      <div class="apercu-import" aria-live="polite"><p class="aide">L'aperçu s'affiche ici.</p></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Importer mes matières (CSV)', corps, '<button class="btn primaire" value="ok">Importer</button><button class="btn" value="annuler">Annuler</button>', () => {
      if (!analyse?.lignes.length) return 'Rien à importer : choisis un fichier ou colle un CSV valide.';
      const groupes = X.grouperCsv(analyse.lignes);
      let n = 0, nouvelles = 0, doublons = 0;
      for (const g of groupes) {
        let m = E.matieres.find((x) => R.memeMatiere(x.nom, g.matiere));
        if (!m) {
          const utilisees = new Set(E.matieres.map((x) => x.couleur));
          m = { id: uid(), nom: g.matiere, couleur: (B.couleurs.find((x) => !utilisees.has(x.id)) || B.couleurs[E.matieres.length % B.couleurs.length]).id, examen: null, energie: g.energie || 'moyenne', ressources: [] };
          E.matieres.push(m); nouvelles++;
        }
        if (g.examen && g.examen !== m.examen) { m.examen = g.examen; replanifier((c) => c.matiereId === m.id); }
        for (const l of g.cours) {
          if (E.chapitres.some((x) => x.matiereId === m.id && x.titre.toLowerCase() === l.cours.toLowerCase())) { doublons++; continue; }
          const ch = nouveauChapitre(m.id, l.cours, l.vuLe, l.motsCles);
          if (ch.prochaine && ch.prochaine < t) ch.prochaine = t;
          if (l.energie && l.energie !== m.energie) ch.energie = l.energie;
          ch.ressources = l.ressources;
          n++;
        }
      }
      sauver(); rendre();
      toast(`${pluriel(n, 'cours importé', 'cours importés')}${nouvelles ? `, ${pluriel(nouvelles, 'matière créée', 'matières créées')}` : ''}${doublons ? `, ${doublons} déjà présent${doublons > 1 ? 's' : ''}` : ''}.`);
    });
    const zone = modale().querySelector('.apercu-import');
    const champ = modale().querySelector('[name=csv]');
    const maj = () => {
      analyse = champ.value.trim() ? X.analyserCsv(champ.value, t) : null;
      if (!analyse) { zone.innerHTML = '<p class="aide">L\'aperçu s\'affiche ici.</p>'; return; }
      const g = X.grouperCsv(analyse.lignes);
      zone.innerHTML = `<p class="surtitre">Aperçu · ${pluriel(analyse.lignes.length, 'cours')} dans ${pluriel(g.length, 'matière')}</p>
        ${analyse.erreurs.length ? `<div class="erreurs-import" role="alert"><b>${pluriel(analyse.erreurs.length, 'ligne ignorée', 'lignes ignorées')}</b><ul>${analyse.erreurs.slice(0, 8).map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>${analyse.erreurs.length > 8 ? '<p class="aide">…</p>' : ''}</div>` : ''}
        ${g.length ? `<div class="defile" tabindex="0" role="region" aria-label="Aperçu de l'import, tableau défilant"><table class="tableau"><thead><tr><th>Matière</th><th class="nb">Cours</th><th>Examen</th><th>Énergie</th><th>Exemples</th></tr></thead><tbody>${g.map((x) => { const m = E.matieres.find((y) => R.memeMatiere(y.nom, x.matiere)); return `<tr><td>${esc(x.matiere)} ${m ? '<span class="etiquette">existante</span>' : '<span class="etiquette jaune">nouvelle</span>'}</td><td class="nb">${x.cours.length}</td><td>${x.examen ? fmt(x.examen, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</td><td>${x.energie ? libNiveau(x.energie) : '–'}</td><td>${esc(x.cours.slice(0, 3).map((c) => c.cours).join(' · '))}${x.cours.length > 3 ? ' …' : ''}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`;
    };
    champ.addEventListener('input', maj);
    $('#csv-fichier').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 400000) { modale().querySelector('.erreur').textContent = 'Fichier trop gros (400 Ko au maximum).'; return; }
      champ.value = await f.text(); maj();
    });
    modale().querySelector('[data-action="csv-modele"]').addEventListener('click', () => {
      telecharger(new Blob(['﻿' + X.MODELE_CSV], { type: 'text/csv;charset=utf-8' }), 'modele-matieres-revisions-qme.csv');
      toast('Modèle CSV téléchargé.');
    });
    modale().querySelector('[data-action="csv-prompt"]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(X.PROMPT_PDF); toast('Prompt copié : colle-le avec ton PDF dans un assistant.'); } catch {
        const d = modale().querySelector('.prompt-pdf'); d.open = true; const pre = $('#prompt-pdf'); pre.focus();
        const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        toast('Copie automatique impossible : le prompt est sélectionné, copie-le.');
      }
    });
  }

  // ---------- Tutoriel de premier lancement (5 écrans) ----------
  let tutoEtape = 0;
  const ECRANS_TUTO = [
    ['rose', 'Dernière ligne droite de l\'année', 'Bienvenue dans ta version privée du planning QME, préparée avec Laurine (Optimind Formation). Tu ajoutes tes cours, le planning te dit <b>quand</b> les revoir (J+1, J+3, J+7, J+14, J+30) jusqu\'au jour de l\'examen.'],
    ['beurre', 'Range tes matières en un geste', 'Crée tes matières avec leur date d\'examen, ou <b>importe un CSV</b> (modèle et prompt « PDF vers CSV » fournis dans Matières). Pour chaque matière&nbsp;: l\'<b>énergie</b> qu\'elle demande et tes <b>liens</b> Drive ou Notion.'],
    ['ciel', 'Le planning suggère, tu décides', 'Dans <b>Aujourd\'hui</b>, l\'ordre est suggéré selon tes retards et ton <b>créneau d\'énergie</b>. Glisse les cartes ou utilise les flèches pour le changer, <b>déplace ou regroupe</b> une révision sur un jour proche, et reviens à la suggestion quand tu veux.'],
    ['sable', 'Ta session, ton rythme', '<b>Lancer ma session</b> enchaîne les cours avec <b>tes propres minuteurs Pomodoro</b> (travail, pauses courte et longue, cycles), une feuille blanche, puis une <b>note de 1 à 5</b> sur ta séance. Les mots-clés servent aux sessions <b>feuille blanche</b>.'],
    ['rose', 'Garde le cap', 'La <b>cloche</b> regroupe tes rappels (révisions dues, retards, série, objectif), sans notification sur ton téléphone. Le <b>Bilan</b> montre ta régularité jour par jour et tes objectifs. Horaires, thème clair ou sombre et tutoriel&nbsp;: dans les <b>réglages</b>.'],
  ];
  function modaleTutoriel(auto = false) {
    tutoEtape = 0;
    rendreTutoriel(auto);
  }
  function rendreTutoriel(auto) {
    const k = tutoEtape, [f, titre, texte] = ECRANS_TUTO[k], dernier = k === ECRANS_TUTO.length - 1;
    const premierChapitre = auto && E.matieres.length && !E.chapitres.length;
    const corps = `<div class="tuto-ecran" style="--f:var(--${f})">
        <div class="tuto-forme" aria-hidden="true"><svg viewBox="0 0 96 96" width="88" height="88">${[
          '<circle cx="48" cy="48" r="44" fill="#D9302A"/><circle cx="48" cy="48" r="16" fill="#141414"/>',
          '<rect x="8" y="8" width="80" height="80" fill="#1D4E89"/><path d="M8 88 A80 80 0 0 1 88 8 V88Z" fill="#F5B400"/>',
          '<path d="M48 6 92 88H4Z" fill="#F5B400"/><circle cx="48" cy="62" r="14" fill="#141414"/>',
          '<circle cx="48" cy="48" r="44" fill="#D8E4F0"/><path d="M48 4 A44 44 0 0 1 92 48 H48Z" fill="#E8B93A"/>',
          '<rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="30" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/>',
        ][k]}</svg></div>
        <p class="surtitre" id="tuto-etape">Écran ${k + 1} sur ${ECRANS_TUTO.length}</p>
        <h3>${titre}</h3><p>${texte}</p>
        <div class="tuto-points" aria-hidden="true">${ECRANS_TUTO.map((_, i) => `<i class="${i === k ? 'actif' : i < k ? 'fait' : ''}"></i>`).join('')}</div>
      </div>`;
    const pied = `${dernier ? (premierChapitre ? '<button class="btn primaire" value="chapitre">Ajouter mon premier cours</button><button class="btn" value="csv">Importer un CSV</button>' : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Terminer'}</button>`) : '<button class="btn primaire" value="suivant">Suivant</button>'}
      ${k > 0 ? '<button class="btn" value="precedent">Précédent</button>' : ''}${!dernier ? '<button class="btn lien gauche" value="ok">Passer le tutoriel</button>' : ''}`;
    ouvrirModale('Tutoriel', corps, pied, (_, choix) => {
      if (choix === 'suivant' || choix === 'precedent') {
        tutoEtape += choix === 'suivant' ? 1 : -1;
        rendreTutoriel(auto);
        // Le focus reste sur le même bouton s'il existe encore, sinon sur le bouton principal.
        (modale().querySelector(`.modale-pied [value="${choix}"]`) || modale().querySelector('.modale-pied .btn.primaire'))?.focus();
        return '';
      }
      if (choix === 'chapitre') setTimeout(() => modaleChapitre(), 0);
      if (choix === 'csv') setTimeout(() => modaleImportCsv(), 0);
    });
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
  function evaluer(id, ev, bouton) {
    const c = chapitre(id);
    if (!c) return;
    const avant = structuredClone(c);
    appliquerEvaluation(c, ev);
    annulation = { id, avant };
    sauver();
    const carte = bouton.closest('.carte');
    const suite = () => {
      rendre();
      const restant = $('.carte .ev');
      if (restant) restant.closest('.carte').querySelector('.ev.moyen').focus({ preventScroll: true });
      toast(c.prochaine ? `« ${c.titre} » : prochaine révision ${quand(c.prochaine)}.` : `« ${c.titre} » maîtrisé.`, { libelle: 'Annuler', faire: annuler });
    };
    if (carte && !matchMedia('(prefers-reduced-motion: reduce)').matches) { carte.classList.add('sortie'); setTimeout(suite, 220); } else suite();
  }

  function annuler() {
    if (!annulation) return;
    if (annulation.chapitres) E.chapitres = annulation.chapitres;
    else if (annulation.blancs) E.blancs = annulation.blancs;
    else {
      const i = E.chapitres.findIndex((c) => c.id === annulation.id);
      if (i >= 0) E.chapitres[i] = annulation.avant;
    }
    annulation = null;
    sauver(); rendre();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(E?.demoProfil || 'pass', E?.demoProfil && E.demoProfil !== 'pass' ? E.prenom : ''); E.tutorielVu = true; cache(); lirePack(); rendre(); } break;
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'filiere': {
        accueil.filiere = id;
        const f = B.filieres.find((x) => x.id === id);
        accueil.choisies = new Set([...(f ? f.matieres : []), ...accueil.libres]);
        ecranAccueil(); break;
      }
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'choix-matiere': el.checked ? accueil.choisies.add(el.value) : accueil.choisies.delete(el.value); {
        const b = $('[data-action="accueil-fin"]');
        b.disabled = !accueil.choisies.size; b.textContent = `Créer mon planning (${pluriel(accueil.choisies.size, 'matière')})`;
      } break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'chapitre-nouveau': modaleChapitre(el.dataset.matiere); break;
      case 'chapitre-modifier': modaleChapitre(null, id); break;
      case 'matiere-nouvelle': modaleMatiere(); break;
      case 'matiere-modifier': modaleMatiere(id); break;
      case 'methode': modaleMethode(id); break;
      case 'evaluer': evaluer(id, el.dataset.eval, el); break;
      case 'reporter': { const c = chapitre(id); annulation = { id, avant: structuredClone(c) }; c.prochaine = ajout(auj(), 1); sauver(); rendre(); toast(`« ${c.titre} » reporté à demain.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'avancer': { const c = chapitre(id); annulation = { id, avant: structuredClone(c) }; c.prochaine = auj(); sauver(); rendre(); toast(`« ${c.titre} » ajouté aux révisions du jour.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'session': if (modale().open) modale().close(); lancerSession(); break;
      case 'session-suivant': case 'session-reprendre': case 'session-comparer': case 'session-evaluer': case 'session-passer': case 'session-fermer': case 'session-note': actionSession(action, el); break;
      case 'rattrapage': modaleRattrapage(); break; // remplace la modale ouverte (notifications)
      case 'jauge-info': modaleJauge(); break;
      case 'blanc': marquerBlanc(el.dataset.cle, el.dataset.etat); break;
      case 'agenda': modaleAgenda(); break;
      case 'importer': modaleImport(); break;
      case 'partager': partagerSemaine(); break;
      case 'notifications': modaleNotifications(); break;
      case 'vue-aujourdhui': if (modale().open) modale().close(); changerVue('aujourdhui'); break;
      case 'monter': reordonner(id, -1); break;
      case 'descendre': reordonner(id, 1); break;
      case 'ordre-suggestion': delete E.ordre[auj()]; sauver(); rendre(); toast('Ordre suggéré rétabli.'); $('#cartes-jour .carte')?.focus?.(); break;
      case 'deplacer': modaleDeplacer(id); break;
      case 'revenir-suggestion': revenirSuggestion(id); break;
      case 'feuille-blanche': lancerSession(coursFeuilleBlanche().map((c) => c.id), true); break;
      case 'pomodoros': modalePomodoros(); break;
      case 'pomodoro-modifier': modalePomodoros(id); break;
      case 'pomodoro-defaut': E.reglages.pomodoroDefaut = id; sauver(); modalePomodoros(); toast('Minuteur par défaut changé.'); break;
      case 'horaires': modaleHoraires(); break;
      case 'energie': modaleEnergie(); break;
      case 'import-csv': modaleImportCsv(); break;
      case 'jour': jourChoisi = el.dataset.jour; rendre(); $('.jour-detail')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); break;
      default: break;
    }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale() && !S) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'aujourdhui' && !modale().open) rendre(); // changement de jour
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    const params = new URLSearchParams(location.search);
    if (params.has('demo')) {
      demoDemandee = { profil: DEMOS[params.get('demo')] ? params.get('demo') : 'pass', prenom: String(params.get('prenom') || '').trim().slice(0, 40), reinit: params.has('reinit') };
      // Démo personnalisée : l'adresse garde ses paramètres, pour qu'un rechargement rouvre la même démo.
      if (demoDemandee.profil === 'pass' && !demoDemandee.prenom) history.replaceState(null, '', location.pathname + location.hash);
      if (!code) return ouvrirDemo(false);
    }
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
      // Hors ligne : on reprend la dernière version gardée sur l'appareil.
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__revision = { planifier: (...a) => planifier(...a), appliquerEvaluation: (...a) => appliquerEvaluation(...a), etat: () => E };
  init();
})();
