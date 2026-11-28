// Suivi culturel QME (code PGS, anciennement « Suivi de lecture », renommé le 28/11/2026) : livres, livres audio, films, séries (saisons et
// épisodes) et podcasts ; statuts, sessions qui donnent la progression, le rythme et la date de fin estimée, note,
// avis et citations, objectifs annuels par média avec l'avance ou le retard au jour près, statistiques (mois, médias,
// genres, créateurs, séries de jours) et liste « à découvrir » par priorité.
// Données synchronisées par clé de licence ou code d'accès. La recherche en ligne passe par /api/oeuvres (proxy du
// site : Open Library, TMDB, iTunes) et ne fait que préremplir une fiche ; rien de la bibliothèque n'y est envoyé.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PGS;
  const API = '/api/templates';
  const PRODUIT = 'PGS';
  const CLE_CODE = 'qme-pgs-code';
  const CLE_CACHE = 'qme-pgs-cache';
  const CLE_DEMO = 'qme-pgs-demo';
  const CLE_PREF = 'qme-pgs-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-pgs-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${R.nombreTexte(n)} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const anneeCourante = () => Number(auj().slice(0, 4));
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const N = R.nombreTexte;
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateCourte = (d) => R.versDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const dateMoy = (d) => `${R.versDate(d).getDate()} ${MOIS_C[R.versDate(d).getMonth()]}${d.slice(0, 4) !== auj().slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}`;
  const qte = (q, u) => R.quantiteTexte(q, u);
  // Durée saisie : « 135 », « 2:15 », « 2h15 », « 2 h 15 » → minutes ; null si illisible.
  function lireDuree(v) {
    const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return 0;
    if (/^\d+$/.test(s)) return Number(s);
    const m = s.match(/^(\d+)(?:h|:)(\d{0,2})(?:min|m)?$/);
    if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
    const m2 = s.match(/^(\d+)(?:min|m)$/);
    return m2 ? Number(m2[1]) : null;
  }
  const dureeSaisie = (min) => (min ? `${Math.floor(min / 60)}h${R.deux(min % 60)}` : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'lecture';
  const pref = stock.lire(CLE_PREF) || {};
  const filtre = { statut: ['tous', 'encours', 'alire', 'lu', 'abandonne'].includes(pref.statut) ? pref.statut : 'tous', media: R.MEDIAS[pref.media] ? pref.media : '', genre: '', q: '', tri: pref.tri || 'recents', annee: 0, journal: 40 };
  let annulation = null;

  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, B);
  const livre = (id) => E.livres.find((l) => l.id === id);
  const couleurGenre = (g) => { const i = E.reglages.genres.indexOf(g); return i < 0 ? { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' } : B.couleurs[i % B.couleurs.length]; };
  function sauverPref() { stock.ecrire(CLE_PREF, { statut: filtre.statut, tri: filtre.tri, media: filtre.media }); }
  const NOM = B.nom;
  const MED = R.MEDIAS;
  const dansMedia = (l) => !filtre.media || l.media === filtre.media;
  // Longueur d'une œuvre : « 320 pages », « 1 h 52 », « 2 saisons, 18 épisodes ».
  const longueurTexte = (l) => (l.media === 'serie' && l.saisons?.length ? `${pluriel(l.saisons.length, 'saison')}, ${pluriel(l.total, 'épisode')}` : l.total ? qte(l.total, R.unite(l)) : '');
  // Position dans une œuvre après `n` pages, minutes ou épisodes : « la page 152 », « 1 h 05 », « S2 · É3 ».
  function positionTexte(l, n) {
    const u = R.unite(l);
    if (u === 'pages') return `la page ${N(n)}`;
    if (u === 'minutes') return R.dureeTexte(n);
    const pos = l.saisons?.length ? R.positionEpisode(l.saisons, n) : null;
    return pos ? R.episodeTexte(pos) : `l'épisode ${N(n)}`;
  }

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
        toast('Un autre appareil a modifié ta bibliothèque entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte une copie, puis retire les sessions anciennes (Réglages).');
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
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
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
  // Code interne (PGS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Lecteur fictif : titres et auteurs inventés (aucune œuvre réelle), un peu plus d'un an de lectures à des
  // dates relatives à aujourd'hui, simulées avec les vraies règles (sessions qui font passer les livres en
  // « lu »). Couvre chaque état : deux livres en cours (papier lu chaque jour, audio), un en cours sans lecture
  // depuis trois semaines (pas de date estimée), un abandonné, des livres notés lus sans sessions, une liste à
  // lire sur trois priorités (dont un livre sans nombre de pages), des avis et des citations, un objectif en
  // léger retard.
  function donneesDemo() {
    const t = auj();
    const a0 = Number(t.slice(0, 4));
    let graine = 7;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    let e = etatVide();
    e.reglages = R.normaliserReglages({ genres: B.genres, objectifs: { [a0]: { livres: 24, pages: 7000, films: 40, episodes: 250 }, [a0 - 1]: { livres: 20, pages: 0 } } }, B);
    const sessions = [];
    // Répartit `total` sur des jours de lecture entre deux dates (quelques jours sautés).
    const etaler = (id, debut, fin, total, saut = 5) => {
      const jours = [];
      for (let d = debut; d <= fin; d = R.ajout(d, 1)) if (d === debut || d === fin || Math.floor(alea() * saut) !== 0) jours.push(d);
      const poids = jours.map(() => 0.6 + alea());
      const somme = poids.reduce((x, y) => x + y, 0);
      let reste = total;
      jours.forEach((d, i) => {
        const q = i === jours.length - 1 ? reste : Math.max(1, Math.min(reste - (jours.length - 1 - i), Math.round(total * poids[i] / somme)));
        if (q > 0) { sessions.push({ id: uid(), livre: id, date: d, quantite: q }); reste -= q; }
      });
    };
    const L = (x) => { const l = R.normaliserLivre({ id: uid(), ...x }); e.livres.push(l); return l; };
    // Livres terminés : un tous les 16 jours en remontant depuis avant-hier.
    const finis = [
      ['Le Phare des brumes', 'Lise Arnavel', 'Roman', 'papier', 312, 4],
      ['Neuf nuits à Valcourt', 'Théo Brunaud', 'Policier et thriller', 'papier', 388, 5],
      ['Les Jardins suspendus de Méra', 'Inès Vallorge', 'Fantasy', 'numerique', 524, 4],
      ['Orbite basse', 'Samuel Kerjan', 'Science-fiction', 'audio', 610, 3],
      ['Petit traité du temps libre', 'Claire Dumesnil-Haut', 'Essai', 'papier', 176, 4],
      ['La Maison aux volets bleus', 'Lise Arnavel', 'Roman', 'papier', 268, 5],
      ['Le Cartographe d\'Ys', 'Inès Vallorge', 'Fantasy', 'papier', 456, 4],
      ['Mémoires d\'un horloger', 'Joseph Altmayer', 'Biographie et mémoires', 'audio', 495, 4],
      ['Marée froide', 'Théo Brunaud', 'Policier et thriller', 'numerique', 342, 3],
      ['Une histoire des ponts', 'Hélène Sarrazy', 'Histoire', 'papier', 290, 4],
      ['Les Abeilles de novembre', 'Nora Belcastel', 'Sciences et nature', 'papier', 214, 5],
      ['Station Hélios', 'Samuel Kerjan', 'Science-fiction', 'papier', 402, 4],
      ['Le Silence des forges', 'Paul Ravignan', 'Historique', 'numerique', 478, 3],
      ['Carnets du col', 'Anouk Terrasson', 'Voyage', 'papier', 198, 4],
      ['Le Bureau des objets trouvés', 'Lise Arnavel', 'Roman', 'audio', 420, 5],
      ['L\'Été des cerfs-volants', 'Mila Fontrieu', 'Jeunesse', 'papier', 132, 4],
      ['Vingt poèmes pour la route', 'Bastien Lorquin', 'Poésie', 'papier', 96, 3],
      ['Quai numéro sept', 'Théo Brunaud', 'Policier et thriller', 'papier', 356, 4],
      ['La Cuisine des restes', 'Odile Prévanne', 'Pratique et loisirs', 'papier', 160, 3],
      ['Apprendre à ne rien faire', 'Claire Dumesnil-Haut', 'Développement personnel', 'numerique', 224, 2],
      ['Le Ciel de Kerlann', 'Inès Vallorge', 'Fantasy', 'papier', 512, 5],
      ['Les Héritiers du sel', 'Paul Ravignan', 'Historique', 'papier', 434, 4],
      ['Bulles de quartier, tome 2', 'Yann Ferraudi', 'Bande dessinée et manga', 'papier', 64, 4],
      ['Bulles de quartier, tome 1', 'Yann Ferraudi', 'Bande dessinée et manga', 'papier', 64, 4],
      ['La Comédie des parapluies', 'Roseline Vaudrey', 'Théâtre', 'papier', 112, 3],
      ['Le Sentier des crêtes', 'Anouk Terrasson', 'Voyage', 'audio', 380, 4],
    ];
    const sansSessions = new Set([5, 17, 22]); // notés « lu » après coup, sans détail des sessions
    finis.forEach(([titre, auteur, genre, format, total, note], k) => {
      const fin = R.ajout(t, -3 - 16 * k);
      const duree = 9 + ((k * 7) % 6);
      const debut = R.ajout(fin, 1 - duree);
      const l = L({ titre, auteur, genre, format, total, note, statut: 'lu', debut, fin, ajoute: R.ajout(debut, -30 - ((k * 13) % 50)) });
      if (!sansSessions.has(k)) etaler(l.id, debut, fin, total);
    });
    // Avis et citations (textes écrits pour la démo).
    const avec = (titre, x) => Object.assign(e.livres.find((l) => l.titre === titre), x);
    avec('Le Phare des brumes', { avis: 'Lent au début, puis impossible à lâcher. La dernière partie, sur l\'île, est la plus belle.', citations: [{ id: uid(), texte: 'On ne garde pas la lumière, on la passe à ceux qui naviguent après nous.', page: 214 }, { id: uid(), texte: 'La brume n\'efface rien : elle oblige seulement à regarder de plus près.', page: 37 }] });
    avec('Neuf nuits à Valcourt', { avis: 'Enquête serrée, fin vraiment inattendue. À conseiller.', citations: [{ id: uid(), texte: 'Un alibi trop parfait est déjà un aveu.', page: 302 }] });
    avec('Apprendre à ne rien faire', { avis: 'Quelques bonnes idées, beaucoup de répétitions.' });
    avec('Les Abeilles de novembre', { citations: [{ id: uid(), texte: 'Une ruche est une ville qui n\'a jamais connu le mot « seul ».', page: 88 }] });
    // En cours : papier lu chaque jour depuis 12 jours, audio depuis 6 jours, numérique en pause.
    const lanternes = L({ titre: 'Les Lanternes du port', auteur: 'Lise Arnavel', genre: 'Roman', format: 'papier', total: 384, statut: 'alire', ajoute: R.ajout(t, -40) });
    for (let i = 11; i >= 0; i--) sessions.push({ id: uid(), livre: lanternes.id, date: R.ajout(t, -i), quantite: 16 + Math.round(alea() * 14) });
    const cartes = L({ titre: 'Une brève histoire des cartes', auteur: 'Hélène Sarrazy', genre: 'Histoire', format: 'audio', total: 540, statut: 'alire', ajoute: R.ajout(t, -20) });
    for (let i = 6; i >= 1; i--) if (i !== 4) sessions.push({ id: uid(), livre: cartes.id, date: R.ajout(t, -i), quantite: 30 + Math.round(alea() * 20) });
    const marees = L({ titre: 'Le Code des marées', auteur: 'Samuel Kerjan', genre: 'Science-fiction', format: 'numerique', total: 466, statut: 'alire', ajoute: R.ajout(t, -90) });
    etaler(marees.id, R.ajout(t, -34), R.ajout(t, -21), 128);
    // Abandonné à la page 85.
    const tableurs = L({ titre: 'Le Grand Livre des tableaux', auteur: 'Didier Monclar', genre: 'Pratique et loisirs', format: 'papier', total: 520, statut: 'alire', ajoute: R.ajout(t, -120), avis: 'Trop technique pour moi, je le reprendrai peut-être.' });
    etaler(tableurs.id, R.ajout(t, -70), R.ajout(t, -64), 85);
    // À lire, sur trois priorités.
    [
      ['Les Sept Portes de Méra', 'Inès Vallorge', 'Fantasy', 'papier', 498, 1],
      ['Le Voyageur immobile', 'Anouk Terrasson', 'Voyage', 'papier', 240, 1],
      ['Nuit blanche à Valcourt', 'Théo Brunaud', 'Policier et thriller', 'numerique', 360, 2],
      ['La Forêt qui marche', 'Nora Belcastel', 'Sciences et nature', 'papier', 280, 2],
      ['Lettres à une jeune lectrice', 'Joseph Altmayer', 'Essai', 'audio', 300, 2],
      ['L\'Atlas des îles oubliées', 'Hélène Sarrazy', 'Histoire', 'papier', 330, 3],
      ['Le Théorème du jardinier', 'Mila Fontrieu', 'Roman', 'papier', 0, 3],
      ['Contes du phare', 'Bastien Lorquin', 'Jeunesse', 'papier', 120, 3],
    ].forEach(([titre, auteur, genre, format, total, priorite], i) => L({ titre, auteur, genre, format, total, priorite, ordre: i + 1, statut: 'alire', ajoute: R.ajout(t, -10 - i * 17) }));
    // Les sessions sont appliquées dans l'ordre avec les vraies règles (statuts « en cours » puis « lu »).
    for (const s of sessions.sort((x, y) => x.date.localeCompare(y.date))) {
      const l = e.livres.find((x) => x.id === s.livre);
      if (l.statut === 'lu') { e.sessions.push(s); continue; } // livres terminés : dates déjà fixées
      e = R.appliquerSession(e, s).etat;
    }
    e = R.changerStatut(e, tableurs.id, 'abandonne', R.ajout(t, -60));
    // Films, séries et podcasts (titres et créateurs inventés) : un film vu tous les 9 jours en remontant, une série
    // en cours (saison 2), une série terminée, un podcast écouté régulièrement, une liste « à voir ».
    const films = [
      ['Le Dernier Bac', 'Ana Ferrandi', 'Drame', 2023, 104, 4], ['Opération Sardine', 'Marc Olivo', 'Comédie', 2024, 96, 3],
      ['Les Glaciers parlent', 'Inès Kowal', 'Documentaire', 2022, 88, 5], ['Nuit sur Arles', 'Ana Ferrandi', 'Policier et thriller', 2021, 118, 4],
      ['Le Robot jardinier', 'Studio Pivert', 'Animation', 2024, 92, 4], ['Comme un lundi', 'Marc Olivo', 'Comédie', 2020, 101, 3],
      ['La Traversée', 'Yuna Sabatier', 'Drame', 2019, 126, 5], ['Orbite 7', 'Léon Darmand', 'Science-fiction', 2023, 132, 4],
      ['Les Oubliés du rail', 'Inès Kowal', 'Documentaire', 2021, 79, 4], ['Café des Halles', 'Yuna Sabatier', 'Comédie', 2022, 94, 3],
    ];
    films.forEach(([titre, auteur, genre, annee, total, note], k) => {
      const fin = R.ajout(t, -1 - 9 * k);
      const f = L({ media: 'film', titre, auteur, genre, annee, total, note, statut: 'alire', ajoute: R.ajout(fin, -20) });
      e = R.changerStatut(e, f.id, 'lu', fin);
      Object.assign(e.livres.find((x) => x.id === f.id), { note });
    });
    Object.assign(e.livres.find((x) => x.titre === 'La Traversée'), { avis: 'Le plus beau film de l\'année pour moi. La dernière scène, sur le quai, reste longtemps en tête.' });
    [['Les Marées de juin', 'Yuna Sabatier', 'Drame', 2025, 108, 1], ['Opération Sardine 2', 'Marc Olivo', 'Comédie', 2025, 99, 2], ['Le Ciel des cartographes', 'Léon Darmand', 'Science-fiction', 2024, 141, 3]]
      .forEach(([titre, auteur, genre, annee, total, priorite], i) => L({ media: 'film', titre, auteur, genre, annee, total, priorite, ordre: 20 + i, statut: 'alire', ajoute: R.ajout(t, -5 - i * 11) }));
    // Série en cours : saison 1 vue, saison 2 commencée (un épisode presque chaque soir).
    const phares = L({ media: 'serie', titre: 'Les Gardiens du phare', auteur: 'Clara Mendès', genre: 'Policier et thriller', annee: 2024, saisons: [{ n: 1, episodes: 8 }, { n: 2, episodes: 10 }], statut: 'alire', ajoute: R.ajout(t, -30) });
    const sesSerie = [];
    for (let i = 20; i >= 0; i--) if (i % 3 !== 2) sesSerie.push({ id: uid(), livre: phares.id, date: R.ajout(t, -i), quantite: 1 });
    const bureau = L({ media: 'serie', titre: 'Bureau 404', auteur: 'Hugo Lemarchand', genre: 'Comédie', annee: 2022, saisons: [{ n: 1, episodes: 6 }, { n: 2, episodes: 6 }], statut: 'alire', note: 4, ajoute: R.ajout(t, -120) });
    for (let i = 0; i < 12; i++) sesSerie.push({ id: uid(), livre: bureau.id, date: R.ajout(t, -95 + i * 2), quantite: 1 });
    L({ media: 'serie', titre: 'La Vallée des loups', auteur: 'Clara Mendès', genre: 'Drame', annee: 2025, saisons: [{ n: 1, episodes: 6 }], priorite: 1, ordre: 30, statut: 'alire', ajoute: R.ajout(t, -8) });
    // Podcast : deux épisodes par semaine environ, sans nombre total.
    const pod = L({ media: 'podcast', titre: 'Les Petites Questions', auteur: 'Studio Mélisse', genre: 'Sciences et nature', statut: 'alire', ajoute: R.ajout(t, -70) });
    for (let i = 63; i >= 0; i -= 3 + (i % 2)) sesSerie.push({ id: uid(), livre: pod.id, date: R.ajout(t, -i), quantite: 1 });
    L({ media: 'podcast', titre: 'Histoires de quartier', auteur: 'Radio Pivert', genre: 'Société et actualité', priorite: 2, ordre: 31, statut: 'alire', ajoute: R.ajout(t, -15) });
    for (const x of sesSerie.sort((a, b) => a.date.localeCompare(b.date))) e = R.appliquerSession(e, x).etat;
    Object.assign(e.livres.find((x) => x.id === bureau.id), { note: 4, avis: 'Courte et drôle, parfaite le soir.' });
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="44" height="220" rx="10" fill="#1D4E89"/>
          <rect x="72" y="80" width="36" height="180" rx="10" fill="#F5B400"/>
          <rect x="116" y="20" width="52" height="240" rx="10" fill="#F0EDE6"/>
          <rect x="176" y="100" width="40" height="160" rx="10" fill="#D9302A"/>
          <rect x="224" y="60" width="48" height="200" rx="10" fill="#1D4E89"/>
          <rect x="20" y="268" width="252" height="14" rx="7" fill="#141414"/>
          <circle cx="420" cy="110" r="80" fill="#D9302A"/>
          <path d="M330 282 L420 200 L510 282 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">${NOM}</p>
          <h1>Lis, regarde, écoute : on compte.</h1>
          <p>Tes livres, livres audio, films, séries et podcasts : où tu en es, ton rythme, la date où tu finiras, tes objectifs de l'année au jour près et tes statistiques.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton ${NOM.toLowerCase()}</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat${NOM === 'Suivi de lecture' ? '' : ' (une clé du Suivi de lecture fonctionne aussi)'}. Ta bibliothèque est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon ${NOM.toLowerCase()}</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/lecture/">Voir le ${NOM.toLowerCase()}</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = `Ouvrir mon ${NOM.toLowerCase()}`; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, livres: String(B.objectif.livres), pages: '', films: '', episodes: '', titre: '', auteur: '', total: '', position: '' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes livres, tes films, tes séries, ton rythme.</h1>
        <p class="intro">Tu ajoutes tes œuvres et, après chaque lecture, film ou épisode, tu notes où tu en es. Le suivi calcule ta progression, ton rythme, la date à laquelle tu finiras, ton avance ou ton retard sur tes objectifs de l'année et tes statistiques. La recherche en ligne ne fait que préremplir les fiches : rien de ta bibliothèque n'est partagé.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes objectifs ${anneeCourante()} et ton livre du moment</h1>
        <p class="intro">Tout se modifie ensuite. Laisse vide ce qui ne te concerne pas.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Livres à lire en ${anneeCourante()}<input id="a-livres" inputmode="numeric" value="${esc(a.livres)}" maxlength="4"></label>
            <label class="champ">Pages à lire en ${anneeCourante()} <small>facultatif</small><input id="a-pages" inputmode="numeric" value="${esc(a.pages)}" maxlength="6"></label>
          </div>
          <div class="rang-champs">
            <label class="champ">Films à voir en ${anneeCourante()} <small>facultatif</small><input id="a-films" inputmode="numeric" value="${esc(a.films)}" maxlength="4"></label>
            <label class="champ">Épisodes à voir ou écouter <small>facultatif</small><input id="a-episodes" inputmode="numeric" value="${esc(a.episodes)}" maxlength="5"></label>
          </div>
          <p class="aide">Films, séries et podcasts s'ajoutent ensuite dans la Bibliothèque.</p>
          <fieldset class="cadre-champs"><legend>Le livre que tu lis en ce moment <small>facultatif, en papier ou numérique</small></legend>
            <div class="rang-champs">
              <label class="champ">Titre<input id="a-titre" value="${esc(a.titre)}" maxlength="140"></label>
              <label class="champ">Auteur<input id="a-auteur" value="${esc(a.auteur)}" maxlength="100"></label>
            </div>
            <div class="rang-champs" style="margin-top:12px">
              <label class="champ">Nombre de pages<input id="a-total" inputmode="numeric" value="${esc(a.total)}" maxlength="5"></label>
              <label class="champ">Page où tu en es<input id="a-position" inputmode="numeric" value="${esc(a.position)}" maxlength="5"></label>
            </div>
          </fieldset>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['livres', 'pages', 'films', 'episodes', 'titre', 'auteur', 'total', 'position']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
  }

  function terminerAccueil() {
    const a = accueil;
    const ent = (v) => (String(v).trim() === '' ? 0 : /^\d+$/.test(String(v).trim()) ? Number(v) : null);
    const [livres, pages, total, position, films, episodes] = [a.livres, a.pages, a.total, a.position, a.films, a.episodes].map(ent);
    if ([livres, pages, total, position, films, episodes].includes(null)) return ecranAccueil('Indique des nombres entiers (ou laisse vide).');
    if (a.titre.trim() && total && position > total) return ecranAccueil('La page où tu en es dépasse le nombre de pages.');
    E = etatVide();
    E.reglages.objectifs[anneeCourante()] = R.normaliserReglages({ objectifs: { [anneeCourante()]: { livres, pages, films, episodes } } }, B).objectifs[anneeCourante()];
    if (a.titre.trim()) {
      const l = R.normaliserLivre({ id: uid(), media: 'livre', titre: a.titre, auteur: a.auteur, total, statut: 'encours', debut: auj(), ajoute: auj() });
      E.livres.push(l);
      if (position) E = R.appliquerSession(E, { id: uid(), livre: l.id, date: auj(), quantite: position }).etat;
    }
    accueil = accueilVide();
    vue = E.livres.length ? 'lecture' : 'bibliotheque';
    sauver();
    demarrer();
    toast(E.livres.length ? 'Ton suivi est prêt : ajoute tes autres œuvres dans la Bibliothèque.' : 'Ton suivi est prêt : ajoute tes livres, films, séries et podcasts.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5c3-1 6-1 9 1v14c-3-2-6-2-9-1Z" fill="currentColor"/><path d="M22 5c-3-1-6-1-9 1v14c3-2 6-2 9-1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    bibliotheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="9" y="7" width="4" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 6.5 3.6-1 3.4 13.5-3.6 1Z" fill="currentColor"/></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="5" rx="2" fill="currentColor"/><circle cx="12" cy="15.5" r="2.5" fill="currentColor"/></svg>',
    objectif: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['lecture', 'En cours'], ['bibliotheque', 'Bibliothèque'], ['journal', 'Journal'], ['objectif', 'Objectifs'], ['stats', 'Statistiques']];
  const AVERTISSEMENT = '<p class="mention avertissement">Les statistiques, le rythme et les dates estimées sont calculés sur cet appareil à partir de ce que tu saisis. La recherche en ligne ne sert qu\'à préremplir une fiche (titre, créateur, année, longueur) : ta bibliothèque, tes notes et tes avis ne sont envoyés à aucun service.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="8" width="22" height="80" rx="6" fill="#1D4E89"/><rect x="26" y="24" width="18" height="64" rx="6" fill="#F5B400"/><circle cx="72" cy="40" r="24" fill="#D9302A"/><rect x="0" y="88" width="96" height="8" rx="4" fill="#141414"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${petit ? '' : FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ST_ETIQ = { encours: 'ciel', alire: 'jaune', lu: 'vert', abandonne: 'sable' };
  const etiquetteStatut = (l) => `<span class="etiquette ${ST_ETIQ[l.statut]}">${R.statutTexte(l.statut, l.media)}</span>`;
  const etiquetteMedia = (l) => `<span class="etiquette media m-${l.media}">${MED[l.media].nom}</span>`;
  const etoiles = (n) => (n ? `<span class="etoiles" role="img" aria-label="${n} sur 5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>` : '');
  const pastilleGenre = (g) => { const c = couleurGenre(g); return `<span class="pastille-genre" style="--f:${c.fond};--b:${c.bord};--t:${c.texte}">${esc(g || 'Sans genre')}</span>`; };
  const auteurFormat = (l) => [l.auteur, l.media === 'livre' ? R.FORMATS[l.format].nom : MED[l.media].nom, l.annee ? String(l.annee) : '', longueurTexte(l)].filter(Boolean).map(esc).join(' · ');
  // Puces de filtre par média (avec le nombre d'œuvres), communes à plusieurs vues.
  function choixMedia() {
    const nb = (m) => E.livres.filter((l) => !m || l.media === m).length;
    return `<div class="filtres filtres-media" role="group" aria-label="Média">${[['', 'Tout'], ...Object.entries(MED).map(([c, m]) => [c, m.pluriel])].map(([c, nom]) => `<button type="button" class="filtre" data-action="filtre-media" data-m="${c}" aria-pressed="${filtre.media === c}">${nom} <small>${nb(c)}</small></button>`).join('')}</div>`;
  }

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Profil fictif, œuvres inventées, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">${esc(NOM).replace(' ', '<br>')}</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · ${NOM}`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { lecture: vueLecture, bibliotheque: vueBibliotheque, journal: vueJournal, objectif: vueObjectif, stats: vueStats }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function brancherVue() {
    $('#recherche')?.addEventListener('input', (e) => { filtre.q = e.target.value; const p = e.target.selectionStart; rendre(); const c = $('#recherche'); c.focus(); c.setSelectionRange(p, p); });
    $('#filtre-genre')?.addEventListener('change', (e) => { filtre.genre = e.target.value; rendre(); });
    $('#tri')?.addEventListener('change', (e) => { filtre.tri = e.target.value; sauverPref(); rendre(); });
    $('#choix-annee')?.addEventListener('change', (e) => { filtre.annee = Number(e.target.value); rendre(); });
    brancherInfobulles();
  }

  // ---------- Graphiques (colonnes, une série, infobulle) ----------
  // Colonnes à une seule série (bleu), valeur écrite sur la plus haute et la dernière, infobulle au survol
  // ou au toucher, tableau pour les lecteurs d'écran. `repere` : trait de valeur attendue sur chaque colonne.
  function colonnes(points, { titre, valeur, info, etiquette, repere, actif }) {
    const max = Math.max(1, ...points.map((p) => Math.max(valeur(p), repere ? repere(p) : 0)));
    const vals = points.map(valeur);
    const iMax = vals.indexOf(Math.max(...vals));
    return `<figure class="graphique">
      <div class="projection" style="grid-template-columns:repeat(${points.length},minmax(0,1fr))">${points.map((p, i) => `<div class="col-proj ${i === actif ? 'actif' : ''} ${i === iMax && vals[i] ? 'max' : ''}" tabindex="0" data-info="${esc(info(p))}">
        <span class="cp-val">${(i === iMax || i === actif) && vals[i] ? N(vals[i]) : ''}</span>
        <span class="cp-zone"><span class="cp-barre" style="height:${vals[i] ? Math.max(2, (vals[i] / max) * 100) : 0}%"></span>${repere ? `<span class="cp-repere" style="bottom:${(repere(p) / max) * 100}%"></span>` : ''}</span>
        <span class="cp-mois">${etiquette(p, i)}</span></div>`).join('')}</div>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>${esc(titre)}</caption><tbody>${points.map((p, i) => `<tr><th>${info(p).match(/<b>(.*?)<\/b>/)?.[1] || etiquette(p, i)}</th><td>${N(vals[i])}</td></tr>`).join('')}</tbody></table></div>
    </figure>`;
  }
  // Barres horizontales à une série : une ligne par catégorie (genre, format).
  function barres(lignes, { titre, valeur, texte, info, nom }) {
    const max = Math.max(1, ...lignes.map(valeur));
    return `<figure class="graphique"><div class="barres-cats">${lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(info(x))}">
        <span class="bc-nom">${nom(x)}</span>
        <span class="bc-piste"><span class="bc-barre" style="width:${Math.max(0.5, (valeur(x) / max) * 100)}%"></span></span>
        <span class="bc-val"><b>${texte(x)}</b></span></div>`).join('')}</div>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>${esc(titre)}</caption><tbody>${lignes.map((x) => `<tr><th>${esc(info(x).replace(/<[^>]+>/g, ' '))}</th></tr>`).join('')}</tbody></table></div></figure>`;
  }
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- En cours ----------
  // Texte d'avance ou de retard : « 14 jours de retard », « 3 jours d'avance », « Pile à l'heure ».
  function avanceTexte(o) {
    if (o.joursAvance === null) return '';
    if (o.atteint) return 'Objectif atteint';
    if (o.joursAvance === 0) return 'Pile dans les temps';
    return o.joursAvance > 0 ? `${pluriel(o.joursAvance, 'jour')} d'avance` : `${pluriel(-o.joursAvance, 'jour')} de retard`;
  }
  function rythmeTexte(l) {
    const t = auj();
    const p = R.progression(E, l);
    const u = { minutes: 'min', pages: 'p.', episodes: 'ép.' }[p.unite];
    const r = R.rythmeLivre(E, l, t);
    const f = R.finEstimee(E, l, t);
    const der = R.sessionsDe(E, l.id).filter((s) => s.date <= t).at(-1);
    if (!der) return 'Aucune session encore : note où tu en es.';
    if (!r) return `Rien noté depuis ${pluriel(R.ecart(der.date, t), 'jour')} : pas de date de fin estimée.`;
    const rythme = `${N(r, r < 10 ? 1 : 0)} ${u} par jour`;
    if (!p.total) return `Rythme : ${rythme}.${l.media === 'podcast' ? '' : ` Indique ${{ pages: 'le nombre de pages', minutes: 'la durée', episodes: 'les épisodes par saison' }[p.unite]} pour estimer la fin.`}`;
    if (!f) return `Rythme : ${rythme}.`;
    return `Rythme : ${rythme} · fin estimée <b>${f.jours <= 1 ? 'demain' : `le ${R.dateFr(f.date)}${f.date.slice(0, 4) !== t.slice(0, 4) ? ` ${f.date.slice(0, 4)}` : ''}`}</b>${f.jours > 1 ? ` (dans ${pluriel(f.jours, 'jour')})` : ''}`;
  }
  function barreProgres(p) {
    return `<div class="progres" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.part === null ? 0 : Math.round(p.part * 100)}" aria-label="Progression"><span style="width:${p.part === null ? 0 : Math.round(p.part * 1000) / 10}%"></span></div>`;
  }
  function progresTexte(p, l) {
    const pct = p.total ? ` · <b>${Math.floor(p.part * 100)} %</b>` : '';
    if (p.unite === 'episodes') {
      const pos = l?.saisons?.length && p.fait ? R.positionEpisode(l.saisons, p.fait) : null;
      const vu = l?.media === 'podcast' ? 'écouté' : 'vu';
      const base = p.total ? `${N(p.fait)} épisode${p.fait > 1 ? 's' : ''} sur ${N(p.total)}` : `${pluriel(p.fait, 'épisode')} ${vu}${p.fait > 1 ? 's' : ''}`;
      return `${pos ? `Dernier ${vu} : <b>${R.episodeTexte(pos)}</b> · ` : ''}${base}${pct}`;
    }
    if (!p.total) return `${qte(p.fait, p.unite)} ${p.unite === 'minutes' ? (l?.media === 'film' ? 'regardées' : 'écoutées') : 'lues'}`;
    return p.unite === 'minutes' ? `${R.dureeTexte(p.fait)} sur ${R.dureeTexte(p.total)}${pct}` : `Page ${N(p.fait)} sur ${N(p.total)}${pct}`;
  }
  // Boutons rapides d'une œuvre en cours : un épisode de plus, film vu en entier, ou session libre.
  function boutonsRapides(l) {
    if (l.media === 'serie' || l.media === 'podcast') return `<button class="btn petit primaire" data-action="episode-suivant" data-livre="${l.id}">${ICONES.plus}1 épisode</button><button class="btn petit" data-action="session" data-livre="${l.id}">Session</button>`;
    if (l.media === 'film') return `<button class="btn petit primaire" data-action="vu" data-id="${l.id}">Vu en entier</button><button class="btn petit" data-action="session" data-livre="${l.id}">Session</button>`;
    return `<button class="btn petit primaire" data-action="session" data-livre="${l.id}">${ICONES.plus}Session</button>`;
  }
  function carteLivre(l) {
    const p = R.progression(E, l);
    return `<article class="carte-livre">
      <button type="button" class="cl-tete" data-action="fiche" data-id="${l.id}"><span class="ligne-etiquettes">${etiquetteMedia(l)}${pastilleGenre(l.genre)}</span><b>${esc(l.titre)}</b><span>${auteurFormat(l)}</span></button>
      ${barreProgres(p)}
      <p class="cl-progres">${progresTexte(p, l)}</p>
      <p class="cl-rythme">${rythmeTexte(l)}</p>
      <div class="rang">${boutonsRapides(l)}<button class="btn petit" data-action="fiche" data-id="${l.id}">Fiche</button></div>
    </article>`;
  }
  // Quantités d'une journée, en texte : « 32 p. », « 45 min d'écoute », « 1 h 50 de film », « 3 épisodes ».
  const partsJour = (j) => [j.pages ? `${N(j.pages)} p.` : '', j.minutes ? `${R.dureeTexte(j.minutes)} d'écoute` : '', j.minutesFilms ? `${R.dureeTexte(j.minutesFilms)} de film` : '', j.episodes ? pluriel(j.episodes, 'épisode') : ''].filter(Boolean);
  // Unité du graphique des 14 jours : celle du média filtré, sinon la plus présente sur la période.
  function uniteGraphe(j14) {
    if (filtre.media) return { pages: 'pages', minutes: filtre.media === 'film' ? 'minutesFilms' : 'minutes', episodes: 'episodes' }[MED[filtre.media].unite];
    const tot = (k) => j14.reduce((x, j) => x + j[k], 0);
    return ['pages', 'episodes', 'minutes', 'minutesFilms'].find((k) => tot(k) > 0) || 'pages';
  }
  const LIB_GRAPHE = { pages: ['Pages lues par jour'], minutes: ['Minutes d\'écoute par jour (livres audio)'], minutesFilms: ['Minutes de film par jour'], episodes: ['Épisodes vus ou écoutés par jour'] };
  // Premier objectif fixé pour l'année (livres d'abord, comme en v1).
  const NOMS_OBJ = { livres: ['livre', 'Livres'], pages: ['page', 'Pages'], films: ['film', 'Films'], series: ['série', 'Séries'], podcasts: ['podcast', 'Podcasts'], episodes: ['épisode', 'Épisodes'] };

  function vueLecture() {
    const t = auj(), an = anneeCourante();
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(R.dateFrLongue(t))}</p><h1>En cours</h1></div><div class="actions"><button class="btn" data-action="livre">${ICONES.plus}Œuvre</button><button class="btn primaire" data-action="session">${ICONES.plus}Session</button></div></div>`;
    if (!E.livres.length) return `${tete}${videEtat('Ta bibliothèque est vide', 'Ajoute ce que tu lis, regardes ou écoutes en ce moment, puis ce que tu veux découvrir ensuite. Après chaque session, note où tu en es.', `<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter une œuvre en cours</button><button class="btn" data-action="livre" data-statut="alire">Ajouter à ma liste</button>`)}${AVERTISSEMENT}`;
    const o = R.objectifAnnee(E, an, t);
    const s = R.series(E, t);
    const j14 = R.derniersJours(E, t, 14);
    const ajd = j14.at(-1);
    const semaine = partsJour(j14.slice(-7).reduce((x, j) => ({ pages: x.pages + j.pages, minutes: x.minutes + j.minutes, minutesFilms: x.minutesFilms + j.minutesFilms, episodes: x.episodes + j.episodes }), { pages: 0, minutes: 0, minutesFilms: 0, episodes: 0 }));
    const cle = R.OBJECTIFS.find((k) => o[k]);
    const tuileObj = cle
      ? `<div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Objectif ${an} · ${NOMS_OBJ[cle][1].toLowerCase()}</p><b>${N(o[cle].fait)} / ${N(o[cle].cible)}</b><span>${avanceTexte(o[cle])}</span></div>`
      : `<div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Objectif ${an}</p><b>${N(o.bilan.nbOeuvres)}</b><span><button class="btn lien" data-action="objectif">Fixer un objectif</button></span></div>`;
    const jour = partsJour(ajd);
    const termines = o.bilan.parMedia.filter((m) => m.termines).map((m) => `${N(m.termines)} ${(m.termines > 1 ? MED[m.media].pluriel : MED[m.media].nom).toLowerCase()}`);
    const tuiles = `<div class="tuiles">
      ${tuileObj}
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Série</p><b>${pluriel(s.actuelle, 'jour')}</b><span>${s.aujourdhui ? 'déjà noté aujourd\'hui' : s.actuelle ? 'note ta session du jour' : 'rien noté hier'} · record ${N(s.record)}</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Aujourd'hui</p><b>${jour[0] || 'Rien'}</b><span>${jour.slice(1).map((x) => `+ ${x} · `).join('')}7 jours : ${semaine.join(', ') || 'rien'}</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Terminés en ${an}</p><b>${N(o.bilan.nbOeuvres)}</b><span>${termines.join(' · ') || 'rien encore cette année'}</span></div>
    </div>`;
    const recent = (l) => R.sessionsDe(E, l.id).at(-1)?.date || l.debut || '';
    const encours = E.livres.filter((l) => l.statut === 'encours' && dansMedia(l)).sort((a, b) => recent(b).localeCompare(recent(a)));
    const blocEnCours = encours.length
      ? `<div class="cartes-livres">${encours.map(carteLivre).join('')}</div>`
      : videEtat(filtre.media ? `Aucun ${MED[filtre.media].nom.toLowerCase()} en cours` : 'Rien en cours', 'Commence la première œuvre de ta liste, ou ajoute celle que tu as commencée.', `<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter une œuvre en cours</button>`, true);
    const liste = R.aLire(E).filter(dansMedia);
    const prochains = liste.slice(0, 3);
    const blocProchains = prochains.length ? `<h2 class="titre-section">Ensuite <span>${pluriel(liste.length, 'œuvre')} dans ta liste</span></h2>
      <ul class="prochains">${prochains.map((l) => `<li><span class="rang-prio">${R.PRIORITES[l.priorite]}</span><button class="lien-ligne" data-action="fiche" data-id="${l.id}"><b>${esc(l.titre)}</b><span>${auteurFormat(l)}</span></button><button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button></li>`).join('')}</ul>
      <p style="margin-top:10px"><button class="btn lien" data-action="filtre-statut" data-f="alire">Voir toute la liste</button></p>` : '';
    const k = uniteGraphe(j14);
    const [libG] = LIB_GRAPHE[k];
    const graph = colonnes(j14, {
      titre: `${libG} sur les 14 derniers jours`, valeur: (j) => j[k],
      info: (j) => `<b>${esc(dateCourte(j.date))}</b>${partsJour(j).join('<br>') || 'Rien noté'}`,
      etiquette: (j, i) => (i % 2 === 1 || !estTel() ? String(R.versDate(j.date).getDate()) : ''), actif: 13,
    });
    return `${tete}${tuiles}${choixMedia()}<h2 class="titre-section">En cours <span>${pluriel(encours.length, 'œuvre')}</span></h2>${blocEnCours}
      <div class="colonnes-apercu"><section><h2 class="titre-section">14 derniers jours <span>${libG}</span></h2>${graph}</section><section>${blocProchains || `<h2 class="titre-section">Ensuite</h2>${videEtat('Liste vide', 'Ajoute ce que tu veux lire, voir ou écouter, avec sa priorité.', '<button class="btn" data-action="livre" data-statut="alire">Ajouter à ma liste</button>', true)}`}</section></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Bibliothèque ----------
  function livresFiltres() {
    const q = filtre.q.trim();
    let l = E.livres.filter((x) => dansMedia(x) && (filtre.statut === 'tous' || x.statut === filtre.statut) && (!filtre.genre || x.genre === filtre.genre));
    // Recherche tolérante (accents, fautes) : les meilleures correspondances d'abord.
    if (q) {
      const sc = new Map(l.map((x) => [x.id, R.scoreRecherche(q, `${x.titre} ${x.auteur} ${x.annee || ''}`)]));
      return l.filter((x) => sc.get(x.id) > 0).sort((a, b) => sc.get(b.id) - sc.get(a.id) || a.titre.localeCompare(b.titre, 'fr'));
    }
    if (filtre.statut === 'alire' && !filtre.genre) return R.aLire(E).filter(dansMedia);
    const cmp = {
      recents: (a, b) => (b.fin || b.debut || b.ajoute || '').localeCompare(a.fin || a.debut || a.ajoute || ''),
      titre: (a, b) => a.titre.localeCompare(b.titre, 'fr'),
      auteur: (a, b) => a.auteur.localeCompare(b.auteur, 'fr') || a.titre.localeCompare(b.titre, 'fr'),
      note: (a, b) => b.note - a.note || a.titre.localeCompare(b.titre, 'fr'),
    }[filtre.tri] || (() => 0);
    const ordreStatut = { encours: 0, alire: 1, lu: 2, abandonne: 3 };
    l = l.sort((a, b) => (filtre.statut === 'tous' && filtre.tri === 'recents' ? ordreStatut[a.statut] - ordreStatut[b.statut] : 0) || cmp(a, b));
    return l;
  }
  function ligneLivre(l, rangAlire, fleches = true) {
    const p = R.progression(E, l);
    const droite = l.statut === 'lu' ? `${etoiles(l.note) || '<span class="mention">Pas de note</span>'}${l.fin ? `<span class="ligne-proch">Fini le ${esc(dateMoy(l.fin))}</span>` : ''}`
      : l.statut === 'encours' ? `<span class="ligne-cout"><b>${p.part === null ? qte(p.fait, p.unite) : `${Math.floor(p.part * 100)} %`}</b></span><button class="btn petit" data-action="${l.media === 'serie' || l.media === 'podcast' ? 'episode-suivant' : 'session'}" data-livre="${l.id}">${ICONES.plus}${l.media === 'serie' || l.media === 'podcast' ? '1 épisode' : 'Session'}</button>`
      : l.statut === 'abandonne' ? `<span class="ligne-proch">Arrêté ${p.total ? `à ${Math.floor((p.part || 0) * 100)} %` : ''}${l.fin ? ` le ${esc(dateMoy(l.fin))}` : ''}</span>`
      : rangAlire && fleches ? `<span class="rang deplacer"><button class="btn-suppr" data-action="monter" data-id="${l.id}" aria-label="Monter ${esc(l.titre)}">↑</button><button class="btn-suppr" data-action="descendre" data-id="${l.id}" aria-label="Descendre ${esc(l.titre)}">↓</button></span><button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button>`
      : `<button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button>`;
    return `<li class="ligne-abs ligne-livre st-${l.statut}" style="--b:${couleurGenre(l.genre).bord}">
      <button type="button" class="ligne-info" data-action="fiche" data-id="${l.id}"><b>${rangAlire ? `<span class="numero-rang">${rangAlire}</span>` : ''}${esc(l.titre)}</b><span class="ligne-detail">${auteurFormat(l)}</span>
        <span class="ligne-etiquettes">${etiquetteMedia(l)}${etiquetteStatut(l)}${pastilleGenre(l.genre)}${l.citations?.length ? `<span class="etiquette sable">${pluriel(l.citations.length, 'citation')}</span>` : ''}</span></button>
      <div class="ligne-droite">${droite}</div></li>`;
  }
  function vueBibliotheque() {
    const m = filtre.media;
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.livres.length, 'œuvre')}</p><h1>Bibliothèque</h1></div><div class="actions"><button class="btn" data-action="csv-livres">Exporter (CSV)</button><button class="btn primaire" data-action="livre" data-statut="${filtre.statut === 'tous' ? 'alire' : filtre.statut}">${ICONES.plus}Œuvre</button></div></div>`;
    if (!E.livres.length) return `${tete}${videEtat('Bibliothèque vide', 'Ajoute ce que tu lis, regardes ou écoutes, ce que tu as terminé cette année et ce que tu veux découvrir. Cherche le titre : la fiche se remplit (ou saisis-la à la main).', '<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter une œuvre</button>')}${AVERTISSEMENT}`;
    const nb = (st) => E.livres.filter((l) => dansMedia(l) && (st === 'tous' || l.statut === st)).length;
    const genres = [...new Set(E.reglages.genres.concat(E.livres.map((l) => l.genre)).filter(Boolean))];
    const libSt = [['tous', 'Tous'], ['encours', 'En cours'], ['alire', R.statutTexte('alire', m)], ['lu', m ? `${R.statutTexte('lu', m)}s` : 'Terminés'], ['abandonne', MED[m]?.fem ? 'Abandonnées' : 'Abandonnés']];
    const outils = `${choixMedia()}<div class="outils-liste">
      <div class="filtres" role="group" aria-label="Statut">${libSt.map(([f, nom]) => `<button type="button" class="filtre" data-action="filtre-statut" data-f="${f}" aria-pressed="${filtre.statut === f}">${nom} <small>${nb(f)}</small></button>`).join('')}</div>
      <div class="rang-champs outils-droite">
        <label class="champ recherche"><span class="sr-only">Chercher un titre ou un créateur</span><input id="recherche" type="search" placeholder="Titre, auteur, réalisation…" value="${esc(filtre.q)}"></label>
        <label class="champ"><span class="sr-only">Genre</span><select id="filtre-genre"><option value="">Tous les genres</option>${genres.map((g) => `<option ${g === filtre.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        ${filtre.statut === 'alire' ? '' : `<label class="champ"><span class="sr-only">Trier</span><select id="tri">${[['recents', 'Plus récents'], ['titre', 'Titre'], ['auteur', 'Créateur'], ['note', 'Note']].map(([v, n]) => `<option value="${v}" ${v === filtre.tri ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
      </div></div>`;
    const l = livresFiltres();
    const alire = filtre.statut === 'alire' && !filtre.q.trim() && !filtre.genre;
    let corps;
    if (!l.length) corps = videEtat('Rien ici', filtre.q || filtre.genre ? 'Aucune œuvre ne correspond à ta recherche.' : 'Aucune œuvre avec ce statut pour l\'instant.', '', true);
    else if (alire) {
      // Les flèches déplacent dans la liste complète : masquées quand un média est filtré.
      corps = `<p class="resume-liste">${m ? 'Classés par priorité. Affiche « Tout » pour changer l\'ordre avec les flèches.' : 'Classés par priorité : les flèches changent l\'ordre, et font passer une œuvre d\'une priorité à l\'autre en bout de groupe.'}</p>${[1, 2, 3].map((pr) => { const g = l.filter((x) => x.priorite === pr); return g.length ? `<section class="groupe-cat"><h2 class="titre-cat">${R.PRIORITES[pr]} <span>${pluriel(g.length, 'œuvre')}</span></h2><ul class="lignes-abs">${g.map((x) => ligneLivre(x, l.indexOf(x) + 1, !m)).join('')}</ul></section>` : ''; }).join('')}`;
    } else corps = `<p class="resume-liste">${pluriel(l.length, 'œuvre')}</p><ul class="lignes-abs">${l.map((x) => ligneLivre(x)).join('')}</ul>`;
    return `${tete}${outils}${corps}${AVERTISSEMENT}`;
  }

  // ---------- Journal ----------
  function vueJournal() {
    const t = auj();
    const tete = `<div class="vue-tete"><div><p class="surtitre">Sessions</p><h1>Journal</h1></div><div class="actions"><button class="btn" data-action="csv-sessions">Exporter (CSV)</button><button class="btn primaire" data-action="session">${ICONES.plus}Session</button></div></div>`;
    if (!E.sessions.length) return `${tete}${videEtat('Aucune session', 'Après chaque lecture, film ou épisode, note où tu en es : page atteinte, minutes, épisode vu. Le journal, ton rythme et tes séries se remplissent tout seuls.', E.livres.length ? '<button class="btn primaire" data-action="session">Noter une session</button>' : '<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter une œuvre</button>')}${AVERTISSEMENT}`;
    const s = R.series(E, t);
    const tri = E.sessions.slice().sort((a, b) => b.date.localeCompare(a.date));
    const jours = [...new Set(tri.map((x) => x.date))];
    const visibles = jours.slice(0, filtre.journal);
    const tuiles = `<div class="tuiles tuiles-3">
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Série actuelle</p><b>${pluriel(s.actuelle, 'jour')}</b><span>${s.aujourdhui ? 'avec aujourd\'hui' : 'jusqu\'à hier'}</span></div>
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Record</p><b>${pluriel(s.record, 'jour')}</b><span>d'affilée</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Jours actifs</p><b>${N(R.bilanAnnee(E, anneeCourante(), t).joursLus)}</b><span>en ${anneeCourante()}</span></div></div>`;
    const blocs = visibles.map((d) => {
      const ses = tri.filter((x) => x.date === d);
      return `<section class="jour-journal"><h2 class="titre-cat">${esc(R.dateFrLongue(d).replace(/^./, (c) => c.toUpperCase()))}${d === t ? ' <span>aujourd\'hui</span>' : ''}</h2>
        <ul class="mini-liste">${ses.map((x) => { const l = livre(x.livre); return `<li><span><b>${esc(l?.titre || 'Œuvre supprimée')}</b><span class="mention">${esc([l ? MED[l.media].nom : '', l?.auteur || ''].filter(Boolean).join(' · '))}</span></span><span class="nb">${qte(x.quantite, R.unite(l))}</span><button class="btn petit" data-action="session-modif" data-id="${x.id}" aria-label="Modifier la session">Modifier</button></li>`; }).join('')}</ul></section>`;
    }).join('');
    const plus = jours.length > visibles.length ? `<p style="margin-top:16px"><button class="btn" data-action="journal-plus">Voir les jours précédents (${N(jours.length - visibles.length)})</button></p>` : '';
    return `${tete}${tuiles}<h2 class="titre-section">Par jour <span>${pluriel(jours.length, 'jour')} notés</span></h2><div class="journal">${blocs}</div>${plus}${AVERTISSEMENT}`;
  }

  // ---------- Objectif ----------
  const anneeChoisie = () => filtre.annee || anneeCourante();
  function choixAnnee() {
    const l = R.annees(E, auj());
    return `<label class="champ choix-annee"><span class="sr-only">Année</span><select id="choix-annee">${l.map((a) => `<option value="${a}" ${a === anneeChoisie() ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;
  }
  // Bloc d'un objectif : `cle` parmi R.OBJECTIFS. Pages et épisodes se comptent par jour ; les œuvres en « une tous les N jours ».
  function blocObjectif(o, cle) {
    const [sing, nom] = NOMS_OBJ[cle];
    const fait = (n) => pluriel(n, sing);
    const quantite = cle === 'pages' || cle === 'episodes';
    const enCours = o.ecoules > 0 && o.restants > 0;
    const partAttendu = Math.min(100, (o.attendu / o.cible) * 100);
    const lignes = [];
    const dec = quantite ? 0 : 1;
    if (enCours) lignes.push(`Attendu aujourd'hui au rythme régulier : <b>${N(o.attendu, dec)}</b>. ${o.ecart >= 0 ? `Tu en as <b>${N(o.ecart, dec)}</b> de plus.` : `Il t'en manque <b>${N(-o.ecart, dec)}</b>.`}`);
    if (enCours && o.projection !== null) lignes.push(`À ton rythme de l'année : environ <b>${fait(Math.round(o.projection))}</b> au 31 décembre.`);
    if (o.parJour !== null) lignes.push(quantite ? `Pour tenir l'objectif : <b>${pluriel(Math.ceil(o.parJour), sing)} par jour</b> d'ici la fin de l'année (${pluriel(o.restants, 'jour')}).` : `Pour tenir l'objectif : <b>${fait(o.cible - o.fait)}</b> en ${pluriel(o.restants, 'jour')}, soit un${sing === 'série' ? 'e' : ''} ${sing} tous les <b>${N(o.restants / (o.cible - o.fait), 1)} jours</b>.`);
    if (o.atteint) lignes.push(`Objectif atteint${o.fait > o.cible ? `, et dépassé de ${fait(o.fait - o.cible)}` : ''}.`);
    if (!o.ecoules) lignes.push('L\'année n\'a pas commencé.');
    const etat = o.atteint ? 'vert' : o.joursAvance === null ? 'sable' : o.joursAvance >= 0 ? 'vert' : o.joursAvance >= -7 ? 'jaune' : 'rose';
    return `<section class="bloc-objectif">
      <div class="bo-tete"><h2>${nom}</h2>${o.joursAvance !== null || o.atteint ? `<span class="etiquette ${etat}">${avanceTexte(o)}</span>` : ''}</div>
      <p class="bo-chiffre"><b>${N(o.fait)}</b> sur ${fait(o.cible)} · ${N(Math.floor(o.part * 100))} %</p>
      <div class="jauge" role="img" aria-label="${esc(`${N(o.fait)} sur ${N(o.cible)}, attendu aujourd'hui ${N(o.attendu, dec)}`)}"><span class="jauge-rempli" style="width:${Math.min(100, o.part * 100)}%"></span>${enCours ? `<span class="jauge-repere" style="left:${partAttendu}%"><i>attendu</i></span>` : ''}</div>
      <ul class="bo-lignes">${lignes.map((x) => `<li>${x}</li>`).join('')}</ul>
    </section>`;
  }
  function vueObjectif() {
    const t = auj(), an = anneeChoisie();
    const o = R.objectifAnnee(E, an, t);
    const fixes = R.OBJECTIFS.filter((k) => o[k]);
    const tete = `<div class="vue-tete"><div><p class="surtitre">Objectifs</p><h1>Objectifs ${an}</h1></div><div class="actions">${choixAnnee()}<button class="btn primaire" data-action="objectif">${fixes.length ? 'Modifier les objectifs' : 'Fixer un objectif'}</button></div></div>`;
    const b = o.bilan;
    if (!fixes.length) return `${tete}${videEtat(`Pas d'objectif pour ${an}`, `Fixe un nombre de livres, de pages, de films, de séries ou d'épisodes : tu verras au jour près si tu es en avance ou en retard, et le rythme qu'il faut pour finir à temps. Déjà ${pluriel(b.nbOeuvres, 'œuvre')} terminée${b.nbOeuvres > 1 ? 's' : ''} en ${an}.`, '<button class="btn primaire" data-action="objectif">Fixer un objectif</button>')}${listeLus(b)}${AVERTISSEMENT}`;
    // Cumul mois par mois de la première cible « œuvres » fixée, avec le cumul attendu en fin de mois (repère).
    const cleG = ['livres', 'films', 'series', 'podcasts'].find((k) => o[k]);
    const valMois = { livres: (m) => m.livres, films: (m) => b.finis.filter((l) => l.media === 'film' && Number(l.fin.slice(5, 7)) === m.mois).length, series: (m) => b.finis.filter((l) => l.media === 'serie' && Number(l.fin.slice(5, 7)) === m.mois).length, podcasts: (m) => b.finis.filter((l) => l.media === 'podcast' && Number(l.fin.slice(5, 7)) === m.mois).length };
    const n = R.joursAnnee(an);
    let cumulL = 0;
    const moisCourant = an === anneeCourante() ? Number(t.slice(5, 7)) : an < anneeCourante() ? 12 : 0;
    let graph = '';
    if (cleG) {
      const [sing, nomG] = NOMS_OBJ[cleG];
      const cumulMois = b.parMois.map((m) => { const v = valMois[cleG](m); cumulL += v; const finMois = R.jourDeLAnnee(R.iso(new Date(an, m.mois, 0))); return { ...m, v, cumul: m.mois <= moisCourant ? cumulL : 0, attendu: o[cleG].cible * finMois / n }; });
      graph = `<h2 class="titre-section">${nomG} terminés, en cumul <span>Barres : ton cumul à la fin de chaque mois · trait : le cumul attendu au rythme régulier</span></h2>${colonnes(cumulMois, {
        titre: `${nomG} terminés en cumul, ${an}`, valeur: (m) => m.cumul, repere: (m) => m.attendu, actif: moisCourant - 1,
        info: (m) => `<b>${R.MOIS[m.mois - 1].replace(/^./, (c) => c.toUpperCase())} ${an}</b>${m.mois <= moisCourant ? `${pluriel(m.cumul, sing)} en cumul (${N(m.v)} ce mois-ci)<br>` : ''}Attendu fin ${MOIS_C[m.mois - 1]} : ${N(m.attendu, 1)}`,
        etiquette: (m) => (estTel() ? MOIS_C[m.mois - 1].slice(0, 1).toUpperCase() : MOIS_C[m.mois - 1]),
      })}<p class="legende"><span class="lg-barre"></span>Ton cumul <span class="lg-trait"></span>Attendu</p>`;
    }
    return `${tete}<div class="objectifs">${fixes.map((k) => blocObjectif(o[k], k)).join('')}</div>
      <p class="mention" style="margin-top:10px">Les livres comptent aussi les livres audio ; les pages, les livres papier et numériques ; les épisodes, ceux des séries et des podcasts. Une œuvre marquée terminée sans sessions compte sa longueur entière à sa date de fin.</p>
      ${graph}${listeLus(b)}${AVERTISSEMENT}`;
  }
  function listeLus(b) {
    if (!b.finis.length) return '';
    return `<h2 class="titre-section">Terminés en ${b.annee} <span>${pluriel(b.nbOeuvres, 'œuvre')}</span></h2>
      <ol class="liste-lus">${b.finis.slice().reverse().map((l, i) => `<li><span class="numero-rang">${b.nbOeuvres - i}</span><button class="lien-ligne" data-action="fiche" data-id="${l.id}"><b>${esc(l.titre)}</b><span>${auteurFormat(l)} · fini le ${esc(dateMoy(l.fin))}</span></button>${etoiles(l.note)}</li>`).join('')}</ol>`;
  }

  // ---------- Statistiques ----------
  function vueStats() {
    const t = auj(), an = anneeChoisie();
    const b = R.bilanAnnee(E, an, t);
    const s = R.series(E, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">Statistiques</p><h1>Ton année ${an}</h1></div><div class="actions">${choixAnnee()}</div></div>`;
    if (!b.nbOeuvres && !b.pages && !b.minutes && !b.minutesFilms && !b.episodes) return `${tete}${videEtat(`Rien de noté en ${an}`, 'Les statistiques se remplissent avec tes sessions et les œuvres que tu termines.', '<button class="btn primaire" data-action="session">Noter une session</button>')}${AVERTISSEMENT}`;
    const parMediaTexte = b.parMedia.filter((m) => m.termines).map((m) => `${N(m.termines)} ${(m.termines > 1 ? MED[m.media].pluriel : MED[m.media].nom).toLowerCase()}`).join(' · ');
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Œuvres terminées</p><b>${N(b.nbOeuvres)}</b><span>${parMediaTexte || 'aucune'}${b.abandons ? ` · ${pluriel(b.abandons, 'abandon')}` : ''}</span></div>
      <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Pages lues</p><b>${N(b.pages)}</b><span>${N(b.pagesParJour, b.pagesParJour < 10 ? 1 : 0)} par jour en moyenne</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Écoute et films</p><b>${R.dureeTexte(b.minutes + b.minutesFilms)}</b><span>${R.dureeTexte(b.minutes)} de livres audio · ${R.dureeTexte(b.minutesFilms)} de films</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Épisodes</p><b>${N(b.episodes)}</b><span>séries et podcasts</span></div>
    </div>`;
    const moisEt = (m) => (estTel() ? MOIS_C[m.mois - 1].slice(0, 1).toUpperCase() : MOIS_C[m.mois - 1]);
    const nomMois = (m) => `${R.MOIS[m.mois - 1].replace(/^./, (c) => c.toUpperCase())} ${an}`;
    const actif = an === anneeCourante() ? Number(t.slice(5, 7)) - 1 : -1;
    const gOeuvres = colonnes(b.parMois, { titre: `Œuvres terminées par mois, ${an}`, valeur: (m) => m.oeuvres, info: (m) => `<b>${nomMois(m)}</b>${pluriel(m.oeuvres, 'œuvre terminée', 'œuvres terminées')}${m.livres ? `<br>dont ${pluriel(m.livres, 'livre')}` : ''}`, etiquette: moisEt, actif });
    const gPages = colonnes(b.parMois, { titre: `Pages lues par mois, ${an}`, valeur: (m) => m.pages, info: (m) => `<b>${nomMois(m)}</b>${partsJour(m).join('<br>') || 'Rien noté'}`, etiquette: moisEt, actif });
    const gMedias = barres(b.parMedia.filter((m) => m.termines || m.quantite), { titre: `Par média, ${an}`, valeur: (x) => x.termines, texte: (x) => N(x.termines), nom: (x) => esc(MED[x.media].pluriel), info: (x) => `<b>${esc(MED[x.media].pluriel)}</b>${pluriel(x.termines, 'œuvre terminée', 'œuvres terminées')}<br>${qte(x.quantite, x.unite)} en ${an}` });
    const genres = b.parGenre.slice(0, 10);
    const gGenres = genres.length ? barres(genres, { titre: `Œuvres terminées par genre, ${an}`, valeur: (x) => x.oeuvres, texte: (x) => N(x.oeuvres), nom: (x) => pastilleGenre(x.nom), info: (x) => `<b>${esc(x.nom || 'Sans genre')}</b>${Object.entries(x.medias).map(([m, k]) => `${N(k)} ${(k > 1 ? MED[m].pluriel : MED[m].nom).toLowerCase()}`).join(' · ')}${x.note ? `<br>Note moyenne ${N(x.note, 1)} / 5` : ''}` }) : '';
    const gFormats = b.nbLivres ? barres(b.parFormat, { titre: `Livres terminés par format, ${an}`, valeur: (x) => x.livres, texte: (x) => N(x.livres), nom: (x) => esc(R.FORMATS[x.format].nom), info: (x) => `<b>${esc(R.FORMATS[x.format].nom)}</b>${pluriel(x.livres, 'livre')}` }) : '';
    const auteurs = b.parAuteur.filter((x) => x.nom).slice(0, 10);
    const tAuteurs = auteurs.length ? `<div class="defile"><table class="tableau"><caption class="sr-only">Auteurs et créateurs les plus suivis en ${an}</caption><thead><tr><th>Auteur ou créateur</th><th class="nb">Œuvres</th><th class="nb">Pages</th><th class="nb">Note</th></tr></thead><tbody>${auteurs.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${N(x.oeuvres)}</td><td class="nb">${x.pages ? N(x.pages) : '–'}${x.minutes ? ` <small>+ ${R.dureeTexte(x.minutes)}</small>` : ''}</td><td class="nb">${x.note ? N(x.note, 1) : '–'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mention">Aucun auteur ni créateur renseigné.</p>';
    const faits = [
      b.noteMoyenne ? `Note moyenne : <b>${N(b.noteMoyenne, 1)} / 5</b>${b.dureeMoyenne ? ` · ${N(b.dureeMoyenne, 0)} jours par livre en moyenne` : ''}` : '',
      b.plusLong ? `Le livre le plus long : <b>${esc(b.plusLong.titre)}</b> (${pluriel(b.plusLong.total, 'page')})` : '',
      `Jours actifs : <b>${N(b.joursLus)}</b> sur ${N(b.ecoules)}${b.ecoules ? ` (${N(Math.round(b.joursLus / b.ecoules * 100))} %)` : ''}`,
      `Série record (toutes années) : <b>${pluriel(s.record, 'jour')}</b> d'affilée · série actuelle : <b>${pluriel(s.actuelle, 'jour')}</b>`,
    ].filter(Boolean);
    return `${tete}${tuiles}<ul class="faits">${faits.map((x) => `<li>${x}</li>`).join('')}</ul>
      <div class="colonnes-stats">
        <section><h2 class="titre-section">Œuvres terminées par mois</h2>${gOeuvres}</section>
        <section><h2 class="titre-section">Pages lues par mois <span>papier et numérique</span></h2>${gPages}</section>
        <section><h2 class="titre-section">Par média <span>œuvres terminées</span></h2>${gMedias}${gFormats ? `<h2 class="titre-section">Livres par format</h2>${gFormats}` : ''}</section>
        <section><h2 class="titre-section">Par genre <span>œuvres terminées</span></h2>${gGenres || '<p class="mention">Aucune œuvre terminée.</p>'}<h2 class="titre-section">Auteurs et créateurs</h2>${tAuteurs}</section>
      </div>${AVERTISSEMENT}`;
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
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const entier = (v) => { const s = String(v ?? '').trim().replace(/\s/g, ''); return s === '' ? 0 : /^\d+$/.test(s) ? Number(s) : null; };

  function modifier(fn, message) {
    retenir();
    E = fn(E);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }

  // Œuvre : création ou modification. `prerempli` : statut, média, ou fiche trouvée par la recherche en ligne.
  // Saisie de la longueur selon le média : pages (livre), durée (livre audio, film), épisodes par saison (série,
  // « 8, 10, 6 »), nombre d'épisodes (podcast, facultatif).
  const saisonsTexte = (sa) => (sa || []).map((x) => x.episodes).join(', ');
  function lireSaisons(v) {
    const t = String(v ?? '').trim();
    if (!t) return [];
    const parts = t.split(/[\s,;]+/).filter(Boolean);
    if (!parts.every((x) => /^\d+$/.test(x) && Number(x) > 0)) return null;
    return parts.map((x, i) => ({ n: i + 1, episodes: Number(x) }));
  }
  const LIB_TOTAL = {
    livre: ['Nombre de pages', 'facultatif, mais nécessaire pour la progression', 'numeric'],
    livreaudio: ['Durée', 'par exemple 9h30 ou 570 (minutes)', 'text'],
    film: ['Durée', 'par exemple 1h52 ou 112 (minutes)', 'text'],
    serie: ['Épisodes par saison', 'par exemple 8, 10, 6 pour trois saisons', 'text'],
    podcast: ['Nombre d\'épisodes', 'facultatif : un podcast continue souvent', 'numeric'],
  };
  const valeurTotal = (l) => (l.media === 'serie' ? saisonsTexte(l.saisons) || (l.total ? String(l.total) : '') : !l.total ? '' : R.unite(l) === 'minutes' ? dureeSaisie(l.total) : String(l.total));
  function modaleLivre(id, prerempli = {}) {
    const l0 = id ? livre(id) : null;
    const l = l0 || R.normaliserLivre({ media: prerempli.media || filtre.media || 'livre', statut: prerempli.statut || 'alire', ajoute: auj(), genre: '', ...(prerempli.fiche || {}) });
    const genres = [...new Set(E.reglages.genres.concat(l.genre ? [l.genre] : []))];
    const pre = !!prerempli.fiche;
    const corps = `
      <fieldset class="champ"><legend>Média</legend><div class="choix-statut cinq">${Object.entries(MED).map(([c, m]) => `<label><input type="radio" name="media" value="${c}" ${c === l.media ? 'checked' : ''}><span>${m.nom}</span></label>`).join('')}</div></fieldset>
      ${l0 ? '' : '<div class="recherche-oeuvre" data-zone="recherche"></div>'}
      <label class="champ">Titre<input name="titre" value="${l0 || pre ? esc(l.titre) : ''}" maxlength="140" required autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ"><span class="lib-createur">${MED[l.media].createur}</span><input name="auteur" value="${esc(l.auteur)}" maxlength="100" list="auteurs-connus"></label>
        <label class="champ">Année <small>facultatif</small><input name="annee" inputmode="numeric" value="${l.annee || ''}" maxlength="4"></label>
      </div>
      <label class="champ">Genre<select name="genre"><option value="">Sans genre</option>${genres.map((g) => `<option ${g === l.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <datalist id="auteurs-connus">${[...new Set(E.livres.map((x) => x.auteur).filter(Boolean))].sort().map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
      <fieldset class="champ" data-m="livre"><legend>Format</legend><div class="choix-statut deux">${['papier', 'numerique'].map((c) => `<label><input type="radio" name="format" value="${c}" ${c === (l.format || 'papier') ? 'checked' : ''}><span>${R.FORMATS[c].nom}</span></label>`).join('')}</div></fieldset>
      <label class="champ"><span class="lib-total"></span> <small class="aide-total"></small><input name="total" value="${esc(valeurTotal(l))}" maxlength="80" autocomplete="off"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${['alire', 'encours', 'lu', 'abandonne'].map((st) => `<label><input type="radio" name="statut" value="${st}" ${st === l.statut ? 'checked' : ''}><span data-st="${st}">${R.statutTexte(st, l.media)}</span></label>`).join('')}</div></fieldset>
      <label class="champ" data-si="alire">Priorité<select name="priorite">${Object.entries(R.PRIORITES).map(([v, n]) => `<option value="${v}" ${Number(v) === l.priorite ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="rang-champs" data-si="encours lu abandonne">
        <label class="champ">Commencé le<input type="date" name="debut" value="${l.debut}"></label>
        <label class="champ" data-si="lu abandonne"><span class="lib-fin">Fini le</span><input type="date" name="fin" value="${l.fin}"></label>
      </div>
      <fieldset class="champ" data-si="lu abandonne encours"><legend>Ta note</legend><div class="choix-note">${[0, 1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="note" value="${n}" ${n === l.note ? 'checked' : ''}><span>${n ? `${'★'.repeat(n)}<span class="sr-only"> ${n} sur 5</span>` : 'Aucune'}</span></label>`).join('')}</div></fieldset>
      <label class="champ" data-si="lu abandonne encours">Ton avis <small>pour toi seul</small><textarea name="avis" maxlength="4000">${esc(l.avis || '')}</textarea></label>
      <input type="hidden" name="source" value="${l.source ? esc(`${l.source.s}:${l.source.id}`) : ''}">
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(l0 ? 'Modifier l\'œuvre' : 'Nouvelle œuvre', corps, PIED(!!l0), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = R.sessionsDe(E, l.id).length;
        if (!confirm(`Supprimer « ${l.titre} »${n > 1 ? ` et ses ${n} sessions` : n ? ' et sa session' : ''} ?`)) return '';
        modifier((e) => R.supprimerLivre(e, l.id), 'Œuvre supprimée.');
        return undefined;
      }
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Indique le titre.';
      const media = fd.get('media');
      const u = MED[media].unite;
      const brut = fd.get('total');
      let total, saisons = [];
      if (media === 'serie') { saisons = lireSaisons(brut); if (saisons === null) return 'Écris le nombre d\'épisodes de chaque saison, séparés par des virgules : par exemple 8, 10, 6.'; total = R.totalSaisons(saisons); }
      else total = u === 'minutes' ? lireDuree(brut) : entier(brut);
      if (total === null) return u === 'minutes' ? 'Durée illisible : écris par exemple 1h52 ou 112.' : 'Indique un nombre entier positif, par exemple 320.';
      const annee = entier(fd.get('annee'));
      if (annee === null || (annee && (annee < 1000 || annee > anneeCourante() + 5))) return 'L\'année doit compter 4 chiffres, par exemple 2019.';
      const statut = fd.get('statut');
      const debut = String(fd.get('debut') || ''), fin = String(fd.get('fin') || '');
      if ((statut === 'lu' || statut === 'abandonne') && debut && fin && fin < debut) return 'La date de fin précède le début.';
      const [ss, sid] = String(fd.get('source') || '').split(/:(.*)/s);
      const n = R.normaliserLivre({ ...l, media, titre, auteur: fd.get('auteur'), genre: fd.get('genre'), format: media === 'livre' ? fd.get('format') : '', total, saisons, annee,
        source: ss ? { s: ss, id: sid } : null, statut, priorite: fd.get('priorite'),
        debut: statut === 'alire' ? l.debut : (debut || (statut !== l.statut ? auj() : '')),
        fin: statut === 'lu' || statut === 'abandonne' ? (fin || auj()) : '',
        note: fd.get('note'), avis: fd.get('avis'), ordre: l0 ? l.ordre : Math.max(0, ...E.livres.map((x) => x.ordre)) + 1 });
      const fait = R.cumul(E, l.id);
      if (n.total && fait > n.total && n.statut !== 'lu') return `Tes sessions totalisent déjà ${qte(fait, R.unite(n))} : la longueur ne peut pas être plus petite.`;
      if (l0 && fait && R.unite(n) !== R.unite(l0)) return `Cette œuvre a déjà des sessions en ${R.unite(l0) === 'pages' ? 'pages' : R.unite(l0) === 'minutes' ? 'minutes' : 'épisodes'} : garde un média de la même unité, ou crée une nouvelle fiche.`;
      if (!l0) ajouterAuCache(n);
      modifier((e) => { const i = e.livres.findIndex((x) => x.id === n.id); const livres = e.livres.slice(); if (i >= 0) livres[i] = n; else livres.push(n); return { ...e, livres }; }, l0 ? 'Œuvre modifiée.' : `« ${n.titre} » ajouté.`);
      return undefined;
    });
    const d = modale();
    const maj = () => {
      const st = d.querySelector('[name=statut]:checked').value;
      const m = d.querySelector('[name=media]:checked').value;
      d.querySelectorAll('[data-si]').forEach((x) => { x.hidden = !x.dataset.si.split(' ').includes(st); });
      d.querySelectorAll('[data-m]').forEach((x) => { x.hidden = x.dataset.m !== m; });
      const [lib, aide, mode] = LIB_TOTAL[m];
      d.querySelector('.lib-total').textContent = lib;
      d.querySelector('.aide-total').textContent = aide;
      d.querySelector('[name=total]').inputMode = mode;
      d.querySelector('.lib-createur').textContent = MED[m].createur;
      d.querySelectorAll('[data-st]').forEach((x) => { x.textContent = R.statutTexte(x.dataset.st, m); });
      d.querySelector('.lib-fin').textContent = st === 'abandonne' ? 'Arrêté le' : 'Fini le';
      d.dispatchEvent(new CustomEvent('media', { detail: m }));
    };
    d.querySelectorAll('[name=statut],[name=media]').forEach((r) => r.addEventListener('change', maj));
    maj();
    if (!l0) brancherRecherche(d);
  }
  // ---------- Recherche en ligne (préremplissage d'une fiche) ----------
  // Au fil de la frappe (300 ms après la dernière touche, requête précédente annulée), dans le média choisi, par le
  // proxy du site /api/oeuvres. Les œuvres déjà dans la bibliothèque qui ressemblent sont signalées (tolérance aux
  // fautes, règles locales). Hors ligne, sans clé TMDB ou à la limite de la démo : un message, et la saisie à la main.
  const SOURCES_NOMS = { ol: 'Open Library', tmdb: 'TMDB', itunes: 'Apple Podcasts et Livres' };
  const MENTION_TMDB = 'Films et séries : données de TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.';
  // Logo officiel de TMDB (themoviedb.org, « Logos & Attribution »), sans déformation, plus discret que la marque QME.
  const LOGO_TMDB = '<img class="logo-tmdb" src="tmdb-logo.svg" width="70" height="9" alt="TMDB">';
  async function appelOeuvres(chemin, options = {}) {
    const r = await fetch(`/api/oeuvres/${chemin}`, { ...options, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}) } });
    let corps = null;
    try { corps = await r.json(); } catch { /* corps vide */ }
    return { statut: r.status, corps };
  }
  function brancherRecherche(d) {
    const zone = d.querySelector('[data-zone=recherche]');
    if (!zone) return;
    zone.innerHTML = `<label class="champ">Chercher l'œuvre <small class="aide-recherche">titre, auteur ou créateur</small><input type="search" name="q-oeuvre" autocomplete="off" placeholder="Par exemple : les miserables"></label>
      <ul class="resultats-oeuvres" role="listbox" aria-label="Résultats"></ul><p class="mention etat-recherche" aria-live="polite"></p>`;
    const champ = zone.querySelector('[name=q-oeuvre]'), liste = zone.querySelector('.resultats-oeuvres'), etat = zone.querySelector('.etat-recherche');
    let minuterie = null, ctrl = null, resultats = [];
    const media = () => d.querySelector('[name=media]:checked').value;
    const ligne = (f, i, deja) => `<li><button type="button" class="resultat-oeuvre" data-i="${i}" ${deja ? 'disabled' : ''}><b>${esc(f.titre)}</b><span>${esc([f.auteur, f.annee, f.saisons ? pluriel(f.saisons.length, 'saison') : f.total ? qte(f.total, MED[f.media].unite) : '', deja ? 'déjà dans ta bibliothèque' : ''].filter(Boolean).join(' · '))}</span></button></li>`;
    const lancer = async () => {
      const q = champ.value.trim(), m = media();
      ctrl?.abort();
      if (q.length < 2) { liste.innerHTML = ''; etat.textContent = ''; return; }
      // Déjà dans la bibliothèque : correspondance tolérante, même média.
      const locaux = E.livres.filter((l) => l.media === m && R.scoreRecherche(q, `${l.titre} ${l.auteur}`) > 0).slice(0, 3);
      ctrl = new AbortController();
      etat.textContent = 'Recherche…';
      try {
        const r = await fetch(`/api/oeuvres/recherche?media=${m}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal, headers: session.jeton ? { 'x-code': session.jeton } : {} });
        const corps = await r.json().catch(() => ({}));
        if (r.status === 429 || r.status >= 400) throw new Error(corps.erreur || 'indisponible');
        resultats = corps.resultats || [];
        const cles = new Set(E.livres.filter((l) => l.source).map((l) => `${l.media}:${l.source.s}:${l.source.id}`));
        liste.innerHTML = resultats.map((f, i) => ligne(f, i, cles.has(`${f.media}:${f.source.s}:${f.source.id}`))).join('');
        const msg = [];
        if (locaux.length) msg.push(`Déjà chez toi : ${locaux.map((l) => `« ${l.titre} »`).join(', ')}.`);
        if (corps.indisponible) msg.push(m === 'film' || m === 'serie' ? 'Recherche de films et séries indisponible pour l\'instant : remplis la fiche à la main.' : 'Source injoignable : remplis la fiche à la main.');
        else if (!resultats.length) msg.push('Rien trouvé : vérifie l\'orthographe, ou remplis la fiche à la main.');
        const tmdb = resultats.some((f) => f.source.s === 'tmdb');
        if (tmdb) msg.push(MENTION_TMDB);
        etat.innerHTML = `${esc(msg.join(' '))}${tmdb ? ` ${LOGO_TMDB}` : ''}`;
      } catch (x) {
        if (x.name === 'AbortError') return;
        liste.innerHTML = '';
        etat.textContent = `${navigator.onLine === false ? 'Hors ligne' : x.message !== 'indisponible' && x.message !== 'Failed to fetch' ? x.message : 'Recherche indisponible'} : remplis la fiche à la main.`;
      }
    };
    champ.addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(lancer, 300); });
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(minuterie); lancer(); } });
    d.addEventListener('media', () => { if (champ.value.trim().length >= 2) lancer(); });
    liste.addEventListener('click', async (e) => {
      const b = e.target.closest('.resultat-oeuvre');
      if (!b) return;
      let f = resultats[Number(b.dataset.i)];
      // Films et séries : durée, réalisation et saisons viennent du détail.
      if (f.source.s === 'tmdb') {
        etat.textContent = 'Chargement de la fiche…';
        try { const { corps } = await appelOeuvres(`detail?media=${f.media}&s=${f.source.s}&id=${encodeURIComponent(f.source.id)}`); if (corps?.fiche) f = corps.fiche; } catch { /* fiche de recherche gardée */ }
      }
      const val = (n, v) => { const c = d.querySelector(`[name=${n}]`); if (c) c.value = v ?? ''; };
      val('titre', f.titre);
      val('auteur', f.auteur);
      val('annee', f.annee || '');
      val('total', f.saisons ? saisonsTexte(f.saisons) : !f.total ? '' : MED[f.media].unite === 'minutes' ? dureeSaisie(f.total) : f.total);
      val('source', `${f.source.s}:${f.source.id}`);
      liste.innerHTML = '';
      etat.innerHTML = `${esc(`Fiche préremplie depuis ${SOURCES_NOMS[f.source.s]} : vérifie et complète.${f.source.s === 'tmdb' ? ` ${MENTION_TMDB}` : ''}`)}${f.source.s === 'tmdb' ? ` ${LOGO_TMDB}` : ''}`;
      d.querySelector('[name=titre]').focus();
    });
    // Un titre modifié à la main ne garde pas la référence de la source.
    d.querySelector('[name=titre]').addEventListener('input', () => { d.querySelector('[name=source]').value = ''; });
  }
  // Une œuvre ajoutée depuis la recherche enrichit l'index partagé (le serveur relit la fiche chez la source).
  function ajouterAuCache(n) {
    if (!n.source || session.demo) return;
    appelOeuvres('ajout', { method: 'POST', body: JSON.stringify({ media: n.media, s: n.source.s, id: n.source.id }) }).catch(() => {});
  }
  async function afficherSources() {
    const z = modale().querySelector('[data-zone=sources]');
    if (!z) return;
    let tmdb = null;
    try { tmdb = (await appelOeuvres('sources')).corps?.tmdb ?? null; } catch { /* hors ligne */ }
    z.innerHTML = `<p class="mention">Livres : Open Library (Internet Archive). Livres audio et podcasts : recherche iTunes d'Apple. Films et séries : TMDB${tmdb === false ? ' (pas encore activé : saisie à la main)' : ''}. Seuls les mots tapés sont envoyés ; tu peux toujours remplir une fiche à la main.</p><p class="mention mention-tmdb">${LOGO_TMDB} ${MENTION_TMDB}</p>`;
  }

  // Fiche d'une œuvre : progression, rythme, dates, note, avis, citations, sessions.
  function modaleFiche(id) {
    const l = livre(id);
    if (!l) return;
    const p = R.progression(E, l);
    const ses = R.sessionsDe(E, l.id).reverse();
    const dates = [l.ajoute ? `Ajoutée le ${dateMoy(l.ajoute)}` : '', l.debut ? `commencé le ${dateMoy(l.debut)}` : '', l.fin ? `${l.statut === 'abandonne' ? 'arrêté' : 'fini'} le ${dateMoy(l.fin)}` : '', l.debut && l.fin ? `en ${pluriel(R.ecart(l.debut, l.fin) + 1, 'jour')}` : ''].filter(Boolean).join(' · ');
    const corps = `
      <div class="fiche-tete"><div class="ligne-etiquettes">${etiquetteMedia(l)}${etiquetteStatut(l)}${pastilleGenre(l.genre)}${l.statut === 'alire' ? `<span class="etiquette sable">${R.PRIORITES[l.priorite]}</span>` : ''}</div>
        <h3>${esc(l.titre)}</h3><p>${auteurFormat(l)}</p>${dates ? `<p class="mention">${esc(dates.replace(/^./, (c) => c.toUpperCase()))}</p>` : ''}</div>
      ${l.statut !== 'alire' || p.fait ? `<div class="bloc-detail">${barreProgres(p)}<p>${progresTexte(p, l)}</p>${l.statut === 'encours' ? `<p class="mention">${rythmeTexte(l)}</p>` : ''}</div>` : ''}
      ${l.note || l.avis ? `<div class="bloc-detail"><h3>Ton avis ${etoiles(l.note)}</h3>${l.avis ? `<p class="avis">${esc(l.avis).replace(/\n/g, '<br>')}</p>` : ''}</div>` : ''}
      <div class="bloc-detail"><h3>Citations <button type="button" class="btn petit" data-action="citation" data-livre="${l.id}">${ICONES.plus}Citation</button></h3>
        ${l.citations?.length ? `<ul class="citations">${l.citations.map((c) => `<li><blockquote>${esc(c.texte).replace(/\n/g, '<br>')}</blockquote><span>${c.page && l.media === 'livre' ? `p. ${N(c.page)}` : ''}<button type="button" class="btn-suppr" data-action="citation-suppr" data-livre="${l.id}" data-id="${c.id}" aria-label="Supprimer la citation">×</button></span></li>`).join('')}</ul>` : '<p class="mention">Aucune citation notée.</p>'}</div>
      <div class="bloc-detail"><h3>Sessions <span>${pluriel(ses.length, 'session')}</span></h3>
        ${ses.length ? `<ul class="mini-liste">${ses.slice(0, 12).map((s) => `<li><span>${esc(dateCourte(s.date))}</span><span class="nb">${qte(s.quantite, p.unite)}</span><button type="button" class="btn petit" data-action="session-modif" data-id="${s.id}">Modifier</button></li>`).join('')}</ul>${ses.length > 12 ? `<p class="mention">Et ${pluriel(ses.length - 12, 'session')} plus ancienne${ses.length - 12 > 1 ? 's' : ''} (voir le Journal).</p>` : ''}` : '<p class="mention">Aucune session notée.</p>'}</div>`;
    const pied = `${l.statut === 'lu' ? '' : l.statut === 'encours' && l.media === 'film' ? `<button type="button" class="btn primaire" data-action="vu" data-id="${l.id}">Vu en entier</button>` : l.statut === 'encours' && (l.media === 'serie' || l.media === 'podcast') ? `<button type="button" class="btn primaire" data-action="episode-suivant" data-livre="${l.id}">${ICONES.plus}1 épisode</button>` : `<button type="button" class="btn primaire" data-action="${l.statut === 'alire' ? 'commencer' : 'session'}" data-livre="${l.id}" data-id="${l.id}">${l.statut === 'alire' ? 'Commencer' : 'Noter une session'}</button>`}<button type="button" class="btn" data-action="livre" data-id="${l.id}">Modifier</button>${l.statut === 'encours' ? `<button type="button" class="btn gauche" data-action="abandonner" data-id="${l.id}">Abandonner</button>` : ''}`;
    ouvrirModale(esc(l.titre.length > 40 ? `${l.titre.slice(0, 38)}…` : l.titre), corps, pied, () => undefined);
  }

  // Session : quantité faite ou position atteinte, selon l'unité de l'œuvre (page, minute, épisode ; pour une série
  // avec saisons, « saison et épisode »), aperçu de la progression.
  function libelles(l) {
    const u = R.unite(l), film = l.media === 'film', pod = l.media === 'podcast';
    if (u === 'pages') return { position: 'La page atteinte', quantite: 'Les pages lues', valPos: 'Page atteinte', valQ: 'Pages lues' };
    if (u === 'minutes') return { position: 'La position atteinte', quantite: film ? 'La durée regardée' : 'La durée écoutée', valPos: 'Position atteinte (par exemple 1h05)', valQ: `Durée ${film ? 'regardée' : 'écoutée'} (par exemple 45 ou 1h15)` };
    return { position: 'L\'épisode atteint', quantite: pod ? 'Les épisodes écoutés' : 'Les épisodes vus', valPos: 'Numéro de l\'épisode atteint', valQ: pod ? 'Épisodes écoutés' : 'Épisodes vus' };
  }
  function modaleSession(id, livreId) {
    const s0 = id ? E.sessions.find((x) => x.id === id) : null;
    const choix = E.livres.filter((l) => l.statut !== 'lu' || l.id === s0?.livre || l.id === livreId);
    if (!choix.length) { toast('Ajoute d\'abord une œuvre.'); modaleLivre(null, { statut: 'encours' }); return; }
    const ordre = { encours: 0, alire: 1, abandonne: 2, lu: 3 };
    choix.sort((a, b) => ordre[a.statut] - ordre[b.statut] || (a.statut === 'alire' ? R.aLire(E).indexOf(a) - R.aLire(E).indexOf(b) : a.titre.localeCompare(b.titre, 'fr')));
    const lid = s0?.livre || livreId || choix[0].id;
    const groupes = ['encours', 'alire', 'abandonne', 'lu'].map((st) => { const g = choix.filter((l) => l.statut === st); return g.length ? `<optgroup label="${R.STATUTS_TOUS[st]}">${g.map((l) => `<option value="${l.id}" ${l.id === lid ? 'selected' : ''}>${esc(l.titre)} · ${esc(MED[l.media].nom)}</option>`).join('')}</optgroup>` : ''; }).join('');
    const corps = `
      <label class="champ">Œuvre<select name="livre" ${s0 ? 'disabled' : ''}>${groupes}</select></label>
      <label class="champ">Date<input type="date" name="date" value="${s0?.date || auj()}" max="${R.ajout(auj(), 1)}"></label>
      ${s0 ? '' : '<fieldset class="champ"><legend>Je note</legend><div class="choix-statut deux"><label><input type="radio" name="mode" value="position" checked><span class="lib-position"></span></label><label><input type="radio" name="mode" value="quantite"><span class="lib-quantite"></span></label></div></fieldset>'}
      <div class="rang-champs champ-se" hidden><label class="champ">Saison<input name="saison" inputmode="numeric" maxlength="3" autocomplete="off"></label><label class="champ">Épisode<input name="episode" inputmode="numeric" maxlength="4" autocomplete="off"></label></div>
      <label class="champ champ-valeur"><span class="lib-valeur"></span><input name="valeur" inputmode="numeric" value="${s0 ? (R.unite(livre(s0.livre)) === 'minutes' ? dureeSaisie(s0.quantite) : s0.quantite) : ''}" maxlength="8" autocomplete="off"></label>
      <p class="apercu-session" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s0 ? 'Modifier la session' : 'Noter une session', corps, PIED(!!s0), (fd, v) => {
      if (v === 'supprimer') { modifier((e) => ({ ...e, sessions: e.sessions.filter((x) => x.id !== s0.id) }), 'Session supprimée.'); return undefined; }
      const r = calculSession();
      if (typeof r === 'string') return r;
      enregistrerSession(r.livre, r.date, r.quantite, s0);
      return undefined;
    });
    const d = modale();
    const sansS0 = () => (s0 ? { ...E, sessions: E.sessions.filter((x) => x.id !== s0.id) } : E);
    const parSaison = (l, mode) => mode === 'position' && R.unite(l) === 'episodes' && l.saisons?.length;
    function calculSession() {
      const l = livre(s0?.livre || d.querySelector('[name=livre]').value);
      const date = d.querySelector('[name=date]').value;
      if (!R.estDate(date)) return 'Choisis une date.';
      if (date > R.ajout(auj(), 1)) return 'La date est dans le futur.';
      const u = R.unite(l);
      const mode = s0 ? 'quantite' : d.querySelector('[name=mode]:checked').value;
      let val;
      if (parSaison(l, mode)) {
        const sa = entier(d.querySelector('[name=saison]').value), ep = entier(d.querySelector('[name=episode]').value);
        if (!sa || !ep) return 'Indique la saison et l\'épisode.';
        val = R.rangEpisode(l.saisons, sa, ep);
        if (val === null) return `La saison ${N(sa)} n'a pas d'épisode ${N(ep)} (${l.saisons.map((x) => `S${x.n} : ${x.episodes}`).join(', ')}). Corrige les saisons dans la fiche si besoin.`;
      } else {
        const brut = d.querySelector('[name=valeur]').value;
        val = u === 'minutes' ? lireDuree(brut) : entier(brut);
        if (val === null) return u === 'minutes' ? 'Durée illisible : écris par exemple 45, 1h15 ou 1:15.' : 'Indique un nombre entier.';
        if (!val) return u === 'minutes' ? 'Indique une durée.' : u === 'episodes' ? 'Indique un nombre d\'épisodes.' : 'Indique un nombre de pages.';
      }
      const fait = R.progression(sansS0(), l).fait;
      const quantite = mode === 'position' ? val - fait : val;
      if (quantite <= 0) return `Tu en étais déjà à ${positionTexte(l, fait)} : indique une position plus loin, ou choisis « ${libelles(l).quantite.toLowerCase()} ».`;
      if (l.total && fait + quantite > l.total * 1.5) return `C'est bien plus que la longueur de l'œuvre (${qte(l.total, R.unite(l))}) : vérifie la saisie ou corrige la longueur dans sa fiche.`;
      return { livre: l, date, quantite, fait };
    }
    const maj = () => {
      const l = livre(s0?.livre || d.querySelector('[name=livre]').value);
      const u = R.unite(l), lib = libelles(l);
      const mode = s0 ? 'quantite' : d.querySelector('[name=mode]:checked').value;
      if (!s0) { d.querySelector('.lib-position').textContent = lib.position; d.querySelector('.lib-quantite').textContent = lib.quantite; }
      const se = parSaison(l, mode);
      d.querySelector('.champ-se').hidden = !se;
      d.querySelector('.champ-valeur').hidden = !!se;
      d.querySelector('.lib-valeur').textContent = mode === 'position' ? lib.valPos : lib.valQ;
      d.querySelector('[name=valeur]').inputMode = u === 'minutes' ? 'text' : 'numeric';
      const ap = d.querySelector('.apercu-session');
      const r = calculSession();
      const p = R.progression(sansS0(), l);
      if (typeof r === 'string') { ap.innerHTML = `Jusqu'ici : ${p.fait ? positionTexte(l, p.fait) : 'rien noté'}${p.total ? ` sur ${qte(p.total, p.unite)}` : ''}.`; return; }
      const apres = r.fait + r.quantite;
      ap.innerHTML = `${qte(r.quantite, p.unite)} → ${p.total ? `${positionTexte(l, Math.min(apres, p.total))} sur ${qte(p.total, p.unite)} (<b>${Math.min(100, Math.floor(apres / p.total * 100))} %</b>)` : `${qte(apres, p.unite)} au total`}${p.total && apres >= p.total && l.statut !== 'lu' ? `. <b>Passera en « ${R.statutTexte('lu', l.media)} ».</b>` : ''}${l.statut === 'alire' || l.statut === 'abandonne' ? '. Passera « En cours ».' : ''}`;
    };
    // Série : propose l'épisode qui suit le dernier vu.
    const proposerEpisode = () => {
      const l = livre(s0?.livre || d.querySelector('[name=livre]').value);
      if (!l?.saisons?.length) return;
      const pos = R.positionEpisode(l.saisons, R.progression(sansS0(), l).fait + 1);
      if (pos) { d.querySelector('[name=saison]').value = pos.saison; d.querySelector('[name=episode]').value = pos.episode; }
    };
    d.querySelectorAll('[name=livre],[name=mode],[name=valeur],[name=date],[name=saison],[name=episode]').forEach((x) => x.addEventListener('input', maj));
    d.querySelectorAll('[name=livre],[name=mode]').forEach((x) => x.addEventListener('change', maj));
    d.querySelector('[name=livre]').addEventListener('change', proposerEpisode);
    proposerEpisode();
    maj();
    if (!estTel()) (d.querySelector('.champ-valeur').hidden ? d.querySelector('[name=episode]') : d.querySelector('[name=valeur]')).focus();
  }
  // Enregistre une session (nouvelle ou modifiée), avec annulation ; à la fin de l'œuvre, propose de la noter.
  function enregistrerSession(l, date, quantite, s0 = null) {
    retenir();
    const base = s0 ? { ...E, sessions: E.sessions.filter((x) => x.id !== s0.id) } : E;
    const res = R.appliquerSession(base, { id: s0?.id || uid(), livre: l.id, date, quantite });
    if (res.refus) { annulation = null; return; }
    E = res.etat;
    sauver(); rendre();
    const apres = R.progression(E, livre(l.id)).fait;
    const ou = R.unite(l) === 'episodes' ? ` (${positionTexte(l, apres)})` : '';
    toast(res.termine ? `Bravo, « ${l.titre} » est terminé${MED[l.media].fem ? 'e' : ''} ! Pense à lui donner une note.` : s0 ? 'Session modifiée.' : `Session notée : ${qte(quantite, R.unite(l))}${ou}.`, { libelle: 'Annuler', faire: annuler });
    if (res.termine) setTimeout(() => modaleLivre(l.id), 50);
  }

  function modaleCitation(livreId) {
    const l = livre(livreId);
    const corps = `<p class="mention">${esc(l.titre)}</p>
      <label class="champ">Citation<textarea name="texte" maxlength="1000" required></textarea></label>
      <label class="champ" ${l.media === 'livre' ? '' : 'hidden'}>Page <small>facultatif</small><input name="page" inputmode="numeric" maxlength="6"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle citation', corps, PIED(false), (fd) => {
      const texte = String(fd.get('texte') || '').trim();
      if (!texte) return 'Écris la citation.';
      const page = entier(fd.get('page'));
      if (page === null) return 'La page doit être un nombre entier positif, par exemple 42.';
      modifier((e) => ({ ...e, livres: e.livres.map((x) => (x.id === l.id ? R.normaliserLivre({ ...x, citations: (x.citations || []).concat([{ id: uid(), texte, page }]) }) : x)) }), 'Citation ajoutée.');
      d2(() => modaleFiche(l.id));
      return '';
    });
  }
  // Rouvre une autre modale juste après la fermeture de la courante.
  const d2 = (f) => setTimeout(f, 30);

  function modaleObjectif() {
    const an = vue === 'objectif' || vue === 'stats' ? anneeChoisie() : anneeCourante();
    const o = E.reglages.objectifs[an] || {};
    const b = R.bilanAnnee(E, an, auj());
    const champ = (k, max) => `<label class="champ">${NOMS_OBJ[k][1]} <small>facultatif</small><input name="${k}" inputmode="numeric" value="${o[k] || ''}" maxlength="${max}"></label>`;
    const corps = `<p>Pour <b>${an}</b> : déjà ${pluriel(b.nbLivres, 'livre')}, ${pluriel(b.pages, 'page')}, ${pluriel(b.nbFilms, 'film')}, ${pluriel(b.nbSeries, 'série')} et ${pluriel(b.episodes, 'épisode')}.</p>
      <div class="rang-champs">${champ('livres', 4)}${champ('pages', 6)}</div>
      <div class="rang-champs">${champ('films', 4)}${champ('series', 3)}</div>
      <div class="rang-champs">${champ('episodes', 5)}${champ('podcasts', 3)}</div>
      <p class="aide">Laisse vide ce que tu ne veux pas suivre. Les livres comptent aussi les livres audio ; les pages, les livres papier et numériques ; les épisodes, ceux des séries et des podcasts.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Objectifs ${an}`, corps, PIED(false), (fd) => {
      const v = Object.fromEntries(R.OBJECTIFS.map((k) => [k, entier(fd.get(k))]));
      if (Object.values(v).includes(null)) return 'Indique des nombres entiers.';
      modifier((e) => {
        const objectifs = { ...e.reglages.objectifs };
        if (Object.values(v).some(Boolean)) objectifs[an] = v; else delete objectifs[an];
        return { ...e, reglages: R.normaliserReglages({ ...e.reglages, objectifs }, B) };
      }, 'Objectifs enregistrés.');
      return undefined;
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const corps = `
      <div class="groupe"><h3>Genres</h3><p class="aide">Renomme un genre (les œuvres suivent), retire-le ou ajoute les tiens. Un genre retiré reste sur les œuvres qui l'ont déjà.</p>
        <ul class="mini-liste liste-genres">${E.reglages.genres.map((g, i) => `<li><label class="champ"><span class="sr-only">Genre ${i + 1}</span><input name="genre-${i}" data-ancien="${esc(g)}" value="${esc(g)}" maxlength="40"></label><button type="button" class="btn-suppr" data-action="genre-suppr" aria-label="Retirer ${esc(g)}">×</button></li>`).join('')}</ul>
        <div class="rang-champs"><label class="champ">Nouveau genre<input name="genre-nouveau" maxlength="40"></label></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule) : la bibliothèque avec notes, avis et citations, ou toutes les sessions.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-livres">Bibliothèque</button><button class="btn petit" type="button" data-action="csv-sessions">Sessions</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ta bibliothèque est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${N(Math.round(t / 1000))} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte une copie, puis retire les sessions anciennes.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer les sessions avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div>
        <p class="mention">Les œuvres et leurs dates restent ; seules les sessions détaillées sont retirées (les œuvres terminées gardent leur longueur à leur date de fin).</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le suivi à ton écran d'accueil pour noter ta page ou ton épisode d'un geste.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ta bibliothèque est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Tes avis et citations restent privés : il n'y a ni profil public ni partage.</p></div>
      <div class="groupe"><h3>Sources de la recherche</h3><div data-zone="sources"></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${esc(NOM)}${NOM === 'Suivi de lecture' ? '' : ' (anciennement Suivi de lecture)'}, version ${B.version}. Genres proposés modifiables. La recherche n'envoie que les mots tapés, jamais ta bibliothèque ; pas de couverture téléchargée, aucun lien avec une liseuse, une plateforme ou une librairie. Calculs faits sur cet appareil : rythme sur les 14 derniers jours, objectifs répartis uniformément sur les jours de l'année.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const champs = [...modale().querySelectorAll('.liste-genres input')];
      const vus = new Set();
      for (const c of champs) { const v = c.value.trim(); if (!v) return 'Un genre ne peut pas être vide (retire-le avec ×).'; if (vus.has(R.plat(v))) return `Le genre « ${v} » apparaît deux fois.`; vus.add(R.plat(v)); }
      const nouveau = String(fd.get('genre-nouveau') || '').trim();
      if (nouveau && vus.has(R.plat(nouveau))) return `Le genre « ${nouveau} » existe déjà.`;
      modifier((e) => {
        let x = { ...e, reglages: { ...e.reglages, genres: champs.map((c) => c.dataset.ancien) } };
        for (const c of champs) if (c.value.trim() !== c.dataset.ancien) x = R.renommerGenre(x, c.dataset.ancien, c.value);
        const genres = champs.map((c) => c.value.trim()).concat(nouveau ? [nouveau] : []);
        return { ...x, reglages: R.normaliserReglages({ ...x.reglages, genres }, B) };
      }, 'Réglages enregistrés.');
      return undefined;
    });
    afficherSources();
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.livres) || !Array.isArray(donnees.sessions)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.livres.length, 'œuvre')}, ${pluriel(donnees.sessions.length, 'session')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(donnees); delete E.majLe; E.tutorielVu = vu || E.tutorielVu === true;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast(`Ce fichier n'est pas une copie valide du ${NOM.toLowerCase()}.`); }
    });
  }
  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.sessions.filter((s) => s.date < d).length;
    if (!n) { toast('Aucune session avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'session')} antérieure${n > 1 ? 's' : ''} au ${R.dateFrLongue(d)} ? Pense à exporter une copie avant.`)) return;
    retenir();
    E = { ...E, sessions: E.sessions.filter((s) => s.date >= d) };
    modale().close(); sauver(); rendre();
    toast(`${pluriel(n, 'session retirée', 'sessions retirées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const CSV = 'text/csv;charset=utf-8';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-lecture-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const S = R.STATUTS, P = R.PRIORITES;
    const an = anneeCourante();
    const o = E.reglages.objectifs[an];
    const cibles = o ? R.OBJECTIFS.filter((k) => o[k]).map((k) => pluriel(o[k], NOMS_OBJ[k][0])) : [];
    const cible = cibles.length ? ` Tes objectifs ${an}&nbsp;: ${cibles.join(', ')}.` : '';
    const blocs = [
      ['rose', 'Ta bibliothèque', `Livres papier ou numériques, livres audio, films, séries et podcasts. Cherche le titre : le créateur, l'année et la longueur se remplissent (ou saisis tout à la main). Une œuvre est <b>${S.encours}</b>, <b>à découvrir</b> (à lire, à voir, à écouter), <b>terminée</b> ou <b>${S.abandonne.toLowerCase()}</b>. Ta liste se range par priorité&nbsp;: ${P[1].toLowerCase()}, ${P[2].toLowerCase()}, ${P[3].toLowerCase()}.`],
      ['beurre', 'Note où tu en es', `Touche <b>Session</b> et note la page atteinte, les minutes écoutées ou regardées, l'épisode vu (saison et épisode pour une série). <b>1 épisode</b> et <b>Vu en entier</b> le font d'un geste. Une œuvre passe en cours à sa première session, et terminée à la dernière page, minute ou épisode.`],
      ['ciel', 'Ton rythme et ta date de fin', `Ton rythme, c'est ce que tu as fait d'une œuvre ces 14 derniers jours, ramené à une moyenne par jour. À ce rythme, l'outil estime la date à laquelle tu la finiras. Sans session depuis 14 jours, il n'estime rien.`],
      ['sable', 'Tes objectifs de l\'année', `Fixe des livres, des pages, des films, des séries, des podcasts ou des épisodes. <b>Objectifs</b> compare ce que tu as fait à ce qui est attendu au rythme régulier&nbsp;: ton avance ou ton retard au jour près, et ce qu'il faut par jour pour finir à temps.${cible}`],
      ['rose', 'Ta série et tes statistiques', `Chaque jour avec au moins une session allonge ta série&nbsp;; elle n'est pas perdue tant que la journée n'est pas finie. <b>Statistiques</b> résume ton année&nbsp;: œuvres par mois et par média, pages, écoute, films, épisodes, genres, créateurs.`],
    ];
    const corps = `
      <p>Le suivi calcule ta progression, ton rythme et la date à laquelle tu finiras chaque œuvre, et te dit où tu en es de tes objectifs. Ton rôle&nbsp;: ajouter tes œuvres, puis noter tes sessions.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Journal</b> liste tes sessions jour par jour&nbsp;: touche-en une pour la corriger. La recherche ne fait que préremplir une fiche&nbsp;; ta bibliothèque n'est envoyée à aucun service. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton suivi est enregistré en ligne avec ta clé&nbsp;: tu le retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.livres.length;
    const pied = premier
      ? '<button class="btn primaire" value="livre">Ajouter ma première œuvre</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'livre') setTimeout(() => modaleLivre(null, { statut: 'encours' }), 0); });
  }

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
      <p>Enregistre ton ${NOM.toLowerCase()} sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-livres': telecharger(R.csvLivres(E), CSV, `bibliotheque-${auj()}.csv`); break;
      case 'csv-sessions': telecharger(R.csvSessions(E), CSV, `sessions-${auj()}.csv`); break;
      case 'purger': purger(); break;
      case 'fermer': modale().close(); break;
      case 'livre': modaleLivre(id || null, { statut: el.dataset.statut }); break;
      case 'fiche': modaleFiche(id); break;
      case 'session': modaleSession(null, el.dataset.livre); break;
      case 'session-modif': modaleSession(id); break;
      case 'commencer': {
        const l = livre(id || el.dataset.livre);
        if (!l) break;
        modifier((x) => R.changerStatut(x, l.id, 'encours', auj()), `« ${l.titre} » est en cours.`);
        if (modale().open) modale().close();
        d2(() => modaleSession(null, l.id));
        break;
      }
      case 'abandonner': { const l = livre(id); if (!l || !confirm(`Abandonner « ${l.titre} » ? Tu pourras reprendre en notant une session.`)) break; modale().close(); modifier((x) => R.changerStatut(x, l.id, 'abandonne', auj()), `${R.statutTexte('abandonne', l.media)}.`); break; }
      case 'episode-suivant': {
        const l = livre(el.dataset.livre);
        if (!l) break;
        if (modale().open) modale().close();
        enregistrerSession(l, auj(), 1);
        break;
      }
      case 'vu': {
        const l = livre(id);
        if (!l) break;
        if (modale().open) modale().close();
        modifier((x) => R.changerStatut(x, l.id, 'lu', auj()), `« ${l.titre} » : vu.`);
        d2(() => modaleLivre(l.id));
        break;
      }
      case 'filtre-media': filtre.media = el.dataset.m; sauverPref(); rendre(); break;
      case 'citation': modaleCitation(el.dataset.livre); break;
      case 'citation-suppr': { const lid = el.dataset.livre; modifier((x) => ({ ...x, livres: x.livres.map((l) => (l.id === lid ? R.normaliserLivre({ ...l, citations: (l.citations || []).filter((c) => c.id !== id) }) : l)) }), 'Citation supprimée.'); modaleFiche(lid); break; }
      case 'monter': modifier((x) => R.deplacer(x, id, -1), 'Ordre modifié.'); break;
      case 'descendre': modifier((x) => R.deplacer(x, id, 1), 'Ordre modifié.'); break;
      case 'objectif': modaleObjectif(); break;
      case 'filtre-statut': filtre.statut = el.dataset.f; sauverPref(); if (vue !== 'bibliotheque') changerVue('bibliotheque'); else rendre(); break;
      case 'journal-plus': filtre.journal += 40; rendre(); break;
      case 'genre-suppr': el.closest('li').remove(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Passage ordinateur ↔ téléphone : les étiquettes des graphiques changent.
  MQ_TEL.addEventListener('change', () => { if (E && !modale().open) rendre(); });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname + location.hash);
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
  window.__pgs = { etat: () => E, regles: R };
  init();
})();
