// Suivi de lecture QME : bibliothèque (papier, numérique, audio), statuts, sessions de lecture qui donnent la
// progression, le rythme et la date de fin estimée, note, avis et citations, objectif annuel en livres et en
// pages avec l'avance ou le retard au jour près, statistiques (mois, genres, auteurs, pages par jour, séries)
// et liste « à lire » par priorité.
// Données synchronisées par clé de licence ou code d'accès. Aucune couverture téléchargée, aucun service de
// livres en ligne, aucune connexion à une application externe : tout se saisit à la main.
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
  const filtre = { statut: ['tous', 'encours', 'alire', 'lu', 'abandonne'].includes(pref.statut) ? pref.statut : 'tous', genre: '', q: '', tri: pref.tri || 'recents', annee: 0, journal: 40 };
  let annulation = null;

  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, B);
  const livre = (id) => E.livres.find((l) => l.id === id);
  const couleurGenre = (g) => { const i = E.reglages.genres.indexOf(g); return i < 0 ? { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' } : B.couleurs[i % B.couleurs.length]; };
  function sauverPref() { stock.ecrire(CLE_PREF, { statut: filtre.statut, tri: filtre.tri }); }

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
    e.reglages = R.normaliserReglages({ genres: B.genres, objectifs: { [a0]: { livres: 24, pages: 7000 }, [a0 - 1]: { livres: 20, pages: 0 } } }, B);
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
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi de lecture · QME';
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
          <p class="surtitre">Suivi de lecture</p>
          <h1>Lis, on compte.</h1>
          <p>Ta bibliothèque, tes sessions de lecture, ton rythme et la date où tu finiras ton livre, ton objectif de l'année au jour près et tes statistiques.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi de lecture</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta bibliothèque est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi de lecture</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/lecture/">Voir le suivi de lecture</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi de lecture'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, livres: String(B.objectif.livres), pages: '', titre: '', auteur: '', total: '', position: '' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes lectures, ton rythme, ton objectif.</h1>
        <p class="intro">Tu notes tes livres et, après chaque lecture, les pages lues. Le suivi calcule ta progression, ton rythme, la date à laquelle tu finiras ton livre, ton avance ou ton retard sur l'objectif de l'année et tes statistiques. Rien n'est cherché en ligne : tu restes maître de ta bibliothèque.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton objectif ${anneeCourante()} et ton livre du moment</h1>
        <p class="intro">Tout se modifie ensuite. Laisse vide ce qui ne te concerne pas.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Livres à lire en ${anneeCourante()}<input id="a-livres" inputmode="numeric" value="${esc(a.livres)}" maxlength="4"></label>
            <label class="champ">Pages à lire en ${anneeCourante()} <small>facultatif</small><input id="a-pages" inputmode="numeric" value="${esc(a.pages)}" maxlength="6"></label>
          </div>
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
    for (const k of ['livres', 'pages', 'titre', 'auteur', 'total', 'position']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
  }

  function terminerAccueil() {
    const a = accueil;
    const ent = (v) => (String(v).trim() === '' ? 0 : /^\d+$/.test(String(v).trim()) ? Number(v) : null);
    const [livres, pages, total, position] = [a.livres, a.pages, a.total, a.position].map(ent);
    if ([livres, pages, total, position].includes(null)) return ecranAccueil('Indique des nombres entiers (ou laisse vide).');
    if (a.titre.trim() && total && position > total) return ecranAccueil('La page où tu en es dépasse le nombre de pages.');
    E = etatVide();
    E.reglages.objectifs[anneeCourante()] = { livres, pages };
    if (a.titre.trim()) {
      const l = R.normaliserLivre({ id: uid(), titre: a.titre, auteur: a.auteur, total, statut: 'encours', debut: auj(), ajoute: auj() });
      E.livres.push(l);
      if (position) E = R.appliquerSession(E, { id: uid(), livre: l.id, date: auj(), quantite: position }).etat;
    }
    accueil = accueilVide();
    vue = E.livres.length ? 'lecture' : 'bibliotheque';
    sauver();
    demarrer();
    toast(E.livres.length ? 'Ton suivi est prêt : ajoute les autres livres dans la Bibliothèque.' : 'Ton suivi est prêt : ajoute tes livres.');
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
  const ONGLETS = [['lecture', 'En cours'], ['bibliotheque', 'Bibliothèque'], ['journal', 'Journal'], ['objectif', 'Objectif'], ['stats', 'Statistiques']];
  const AVERTISSEMENT = '<p class="mention avertissement">Les statistiques, le rythme et les dates estimées sont calculés sur cet appareil à partir de ce que tu saisis. Aucun livre n\'est cherché en ligne : pas de couverture, pas de base de livres, pas de lien avec une liseuse ou une librairie.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="8" width="22" height="80" rx="6" fill="#1D4E89"/><rect x="26" y="24" width="18" height="64" rx="6" fill="#F5B400"/><circle cx="72" cy="40" r="24" fill="#D9302A"/><rect x="0" y="88" width="96" height="8" rx="4" fill="#141414"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${petit ? '' : FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ST_ETIQ = { encours: 'ciel', alire: 'jaune', lu: 'vert', abandonne: 'sable' };
  const etiquetteStatut = (l) => `<span class="etiquette ${ST_ETIQ[l.statut]}">${R.STATUTS[l.statut]}</span>`;
  const etoiles = (n) => (n ? `<span class="etoiles" role="img" aria-label="${n} sur 5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>` : '');
  const pastilleGenre = (g) => { const c = couleurGenre(g); return `<span class="pastille-genre" style="--f:${c.fond};--b:${c.bord};--t:${c.texte}">${esc(g || 'Sans genre')}</span>`; };
  const auteurFormat = (l) => [l.auteur, R.FORMATS[l.format].nom, l.total ? qte(l.total, R.unite(l)) : ''].filter(Boolean).map(esc).join(' · ');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/lecture/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Lecteur fictif, livres inventés, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi<br>de lecture</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Suivi de lecture`;
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
      <div class="sr-only"><table><caption>${esc(titre)}</caption><tbody>${points.map((p, i) => `<tr><th>${etiquette(p, i)}</th><td>${N(vals[i])}</td></tr>`).join('')}</tbody></table></div>
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
    const u = p.unite === 'minutes' ? 'min' : 'p.';
    const r = R.rythmeLivre(E, l, t);
    const f = R.finEstimee(E, l, t);
    const der = R.sessionsDe(E, l.id).filter((s) => s.date <= t).at(-1);
    if (!der) return 'Aucune session encore : note ta première lecture.';
    if (!r) return `Pas de lecture depuis ${pluriel(R.ecart(der.date, t), 'jour')} : pas de date de fin estimée.`;
    const rythme = `${N(r, r < 10 ? 1 : 0)} ${u} par jour`;
    if (!p.total) return `Rythme : ${rythme}. Indique le nombre de ${p.unite === 'minutes' ? 'minutes' : 'pages'} pour estimer la fin.`;
    if (!f) return `Rythme : ${rythme}.`;
    return `Rythme : ${rythme} · fin estimée <b>${f.jours <= 1 ? 'demain' : `le ${R.dateFr(f.date)}${f.date.slice(0, 4) !== t.slice(0, 4) ? ` ${f.date.slice(0, 4)}` : ''}`}</b>${f.jours > 1 ? ` (dans ${pluriel(f.jours, 'jour')})` : ''}`;
  }
  function barreProgres(p) {
    return `<div class="progres" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.part === null ? 0 : Math.round(p.part * 100)}" aria-label="Progression"><span style="width:${p.part === null ? 0 : Math.round(p.part * 1000) / 10}%"></span></div>`;
  }
  function progresTexte(p) {
    if (!p.total) return `${qte(p.fait, p.unite)} ${p.unite === 'minutes' ? 'écoutées' : 'lues'}`;
    return p.unite === 'minutes' ? `${R.dureeTexte(p.fait)} sur ${R.dureeTexte(p.total)} · <b>${Math.floor(p.part * 100)} %</b>` : `Page ${N(p.fait)} sur ${N(p.total)} · <b>${Math.floor(p.part * 100)} %</b>`;
  }
  function carteLivre(l) {
    const p = R.progression(E, l);
    return `<article class="carte-livre">
      <button type="button" class="cl-tete" data-action="fiche" data-id="${l.id}">${pastilleGenre(l.genre)}<b>${esc(l.titre)}</b><span>${auteurFormat(l)}</span></button>
      ${barreProgres(p)}
      <p class="cl-progres">${progresTexte(p)}</p>
      <p class="cl-rythme">${rythmeTexte(l)}</p>
      <div class="rang"><button class="btn petit primaire" data-action="session" data-livre="${l.id}">${ICONES.plus}Session</button><button class="btn petit" data-action="fiche" data-id="${l.id}">Fiche</button></div>
    </article>`;
  }

  function vueLecture() {
    const t = auj(), an = anneeCourante();
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(R.dateFrLongue(t))}</p><h1>En cours</h1></div><div class="actions"><button class="btn" data-action="livre">${ICONES.plus}Livre</button><button class="btn primaire" data-action="session">${ICONES.plus}Session</button></div></div>`;
    if (!E.livres.length) return `${tete}${videEtat('Ta bibliothèque est vide', 'Ajoute le livre que tu lis en ce moment, puis ceux que tu veux lire ensuite. Après chaque lecture, note la page où tu es arrivé.', `<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter mon livre en cours</button><button class="btn" data-action="livre" data-statut="alire">Ajouter un livre à lire</button>`)}${AVERTISSEMENT}`;
    const o = R.objectifAnnee(E, an, t);
    const s = R.series(E, t);
    const j14 = R.derniersJours(E, t, 14);
    const semaine = j14.slice(-7).reduce((x, j) => x + j.pages, 0);
    const minSemaine = j14.slice(-7).reduce((x, j) => x + j.minutes, 0);
    const ajd = j14.at(-1);
    const tuileObj = o.livres
      ? `<div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Objectif ${an}</p><b>${N(o.livres.fait)} / ${N(o.livres.cible)}</b><span>${avanceTexte(o.livres)}</span></div>`
      : `<div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Objectif ${an}</p><b>${N(o.bilan.nbLivres)}</b><span><button class="btn lien" data-action="objectif">Fixer un objectif</button></span></div>`;
    const tuiles = `<div class="tuiles">
      ${tuileObj}
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Série</p><b>${pluriel(s.actuelle, 'jour')}</b><span>${s.aujourdhui ? 'lu aujourd\'hui' : s.actuelle ? 'note ta lecture du jour' : 'aucune lecture hier'} · record ${N(s.record)}</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Aujourd'hui</p><b>${N(ajd.pages)} p.</b><span>${ajd.minutes ? `+ ${R.dureeTexte(ajd.minutes)} d'écoute · ` : ''}7 jours : ${N(semaine)} p.${minSemaine ? ` et ${R.dureeTexte(minSemaine)}` : ''}</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Rythme ${an}</p><b>${N(o.bilan.pagesParJour, o.bilan.pagesParJour < 10 ? 1 : 0)} p./jour</b><span>${pluriel(o.bilan.pages, 'page')} depuis le 1er janvier</span></div>
    </div>`;
    const encours = E.livres.filter((l) => l.statut === 'encours').sort((a, b) => (R.sessionsDe(E, b.id).at(-1)?.date || b.debut || '').localeCompare(R.sessionsDe(E, a.id).at(-1)?.date || a.debut || ''));
    const blocEnCours = encours.length
      ? `<div class="cartes-livres">${encours.map(carteLivre).join('')}</div>`
      : videEtat('Aucun livre en cours', 'Commence le premier de ta liste à lire, ou ajoute le livre que tu as entre les mains.', `<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter un livre en cours</button>`, true);
    const prochains = R.aLire(E).slice(0, 3);
    const blocProchains = prochains.length ? `<h2 class="titre-section">À lire ensuite <span>${pluriel(R.aLire(E).length, 'livre')} dans ta liste</span></h2>
      <ul class="prochains">${prochains.map((l) => `<li><span class="rang-prio">${R.PRIORITES[l.priorite]}</span><button class="lien-ligne" data-action="fiche" data-id="${l.id}"><b>${esc(l.titre)}</b><span>${auteurFormat(l)}</span></button><button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button></li>`).join('')}</ul>
      <p style="margin-top:10px"><button class="btn lien" data-action="filtre-statut" data-f="alire">Voir toute la liste</button></p>` : '';
    const graph = colonnes(j14, {
      titre: 'Pages lues sur les 14 derniers jours', valeur: (j) => j.pages,
      info: (j) => `<b>${esc(dateCourte(j.date))}</b>${pluriel(j.pages, 'page')}${j.minutes ? `<br>${R.dureeTexte(j.minutes)} d'écoute` : ''}`,
      etiquette: (j, i) => (i % 2 === 1 || !estTel() ? String(R.versDate(j.date).getDate()) : ''), actif: 13,
    });
    return `${tete}${tuiles}<h2 class="titre-section">Livres en cours <span>${pluriel(encours.length, 'livre')}</span></h2>${blocEnCours}
      <div class="colonnes-apercu"><section><h2 class="titre-section">14 derniers jours <span>Pages lues par jour (papier et numérique)</span></h2>${graph}</section><section>${blocProchains || `<h2 class="titre-section">À lire ensuite</h2>${videEtat('Liste à lire vide', 'Ajoute les livres que tu veux lire, avec leur priorité.', '<button class="btn" data-action="livre" data-statut="alire">Ajouter un livre à lire</button>', true)}`}</section></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Bibliothèque ----------
  function livresFiltres() {
    const q = R.plat(filtre.q.trim());
    let l = E.livres.filter((x) => (filtre.statut === 'tous' || x.statut === filtre.statut) && (!filtre.genre || x.genre === filtre.genre) && (!q || R.plat(`${x.titre} ${x.auteur}`).includes(q)));
    if (filtre.statut === 'alire' && !q && !filtre.genre) return R.aLire(E);
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
  function ligneLivre(l, rangAlire) {
    const p = R.progression(E, l);
    const droite = l.statut === 'lu' ? `${etoiles(l.note) || '<span class="mention">Pas de note</span>'}<span class="ligne-proch">Fini le ${esc(dateMoy(l.fin))}</span>`
      : l.statut === 'encours' ? `<span class="ligne-cout"><b>${p.part === null ? qte(p.fait, p.unite) : `${Math.floor(p.part * 100)} %`}</b></span><button class="btn petit" data-action="session" data-livre="${l.id}">${ICONES.plus}Session</button>`
      : l.statut === 'abandonne' ? `<span class="ligne-proch">Arrêté ${p.total ? `à ${Math.floor((p.part || 0) * 100)} %` : ''}${l.fin ? ` le ${esc(dateMoy(l.fin))}` : ''}</span>`
      : rangAlire ? `<span class="rang deplacer"><button class="btn-suppr" data-action="monter" data-id="${l.id}" aria-label="Monter ${esc(l.titre)}">↑</button><button class="btn-suppr" data-action="descendre" data-id="${l.id}" aria-label="Descendre ${esc(l.titre)}">↓</button></span><button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button>`
      : `<button class="btn petit" data-action="commencer" data-id="${l.id}">Commencer</button>`;
    return `<li class="ligne-abs ligne-livre st-${l.statut}" style="--b:${couleurGenre(l.genre).bord}">
      <button type="button" class="ligne-info" data-action="fiche" data-id="${l.id}"><b>${rangAlire ? `<span class="numero-rang">${rangAlire}</span>` : ''}${esc(l.titre)}</b><span class="ligne-detail">${auteurFormat(l)}</span>
        <span class="ligne-etiquettes">${etiquetteStatut(l)}${pastilleGenre(l.genre)}${l.citations?.length ? `<span class="etiquette sable">${pluriel(l.citations.length, 'citation')}</span>` : ''}</span></button>
      <div class="ligne-droite">${droite}</div></li>`;
  }
  function vueBibliotheque() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.livres.length, 'livre')}</p><h1>Bibliothèque</h1></div><div class="actions"><button class="btn" data-action="csv-livres">Exporter (CSV)</button><button class="btn primaire" data-action="livre" data-statut="${filtre.statut === 'tous' ? 'alire' : filtre.statut}">${ICONES.plus}Livre</button></div></div>`;
    if (!E.livres.length) return `${tete}${videEtat('Aucun livre', 'Ajoute ton livre en cours, ceux que tu as lus cette année et ceux que tu veux lire. Rien n\'est cherché en ligne : titre, auteur et nombre de pages se saisissent à la main.', '<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter un livre</button>')}${AVERTISSEMENT}`;
    const nb = (s) => E.livres.filter((l) => s === 'tous' || l.statut === s).length;
    const genres = [...new Set(E.reglages.genres.concat(E.livres.map((l) => l.genre)).filter(Boolean))];
    const outils = `<div class="outils-liste">
      <div class="filtres" role="group" aria-label="Statut">${[['tous', 'Tous'], ['encours', 'En cours'], ['alire', 'À lire'], ['lu', 'Lus'], ['abandonne', 'Abandonnés']].map(([f, nom]) => `<button type="button" class="filtre" data-action="filtre-statut" data-f="${f}" aria-pressed="${filtre.statut === f}">${nom} <small>${nb(f)}</small></button>`).join('')}</div>
      <div class="rang-champs outils-droite">
        <label class="champ recherche"><span class="sr-only">Chercher un titre ou un auteur</span><input id="recherche" type="search" placeholder="Titre ou auteur" value="${esc(filtre.q)}"></label>
        <label class="champ"><span class="sr-only">Genre</span><select id="filtre-genre"><option value="">Tous les genres</option>${genres.map((g) => `<option ${g === filtre.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        ${filtre.statut === 'alire' ? '' : `<label class="champ"><span class="sr-only">Trier</span><select id="tri">${[['recents', 'Plus récents'], ['titre', 'Titre'], ['auteur', 'Auteur'], ['note', 'Note']].map(([v, n]) => `<option value="${v}" ${v === filtre.tri ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
      </div></div>`;
    const l = livresFiltres();
    const alire = filtre.statut === 'alire' && !filtre.q.trim() && !filtre.genre;
    let corps;
    if (!l.length) corps = videEtat('Aucun livre ici', filtre.q || filtre.genre ? 'Aucun livre ne correspond à ta recherche.' : 'Aucun livre avec ce statut pour l\'instant.', '', true);
    else if (alire) {
      corps = `<p class="resume-liste">Classés par priorité : les flèches changent l'ordre, et font passer un livre d'une priorité à l'autre en bout de groupe.</p>${[1, 2, 3].map((p) => { const g = l.filter((x) => x.priorite === p); return g.length ? `<section class="groupe-cat"><h2 class="titre-cat">${R.PRIORITES[p]} <span>${pluriel(g.length, 'livre')}</span></h2><ul class="lignes-abs">${g.map((x) => ligneLivre(x, l.indexOf(x) + 1)).join('')}</ul></section>` : ''; }).join('')}`;
    } else corps = `<p class="resume-liste">${pluriel(l.length, 'livre')}</p><ul class="lignes-abs">${l.map((x) => ligneLivre(x)).join('')}</ul>`;
    return `${tete}${outils}${corps}${AVERTISSEMENT}`;
  }

  // ---------- Journal ----------
  function vueJournal() {
    const t = auj();
    const tete = `<div class="vue-tete"><div><p class="surtitre">Sessions de lecture</p><h1>Journal</h1></div><div class="actions"><button class="btn" data-action="csv-sessions">Exporter (CSV)</button><button class="btn primaire" data-action="session">${ICONES.plus}Session</button></div></div>`;
    if (!E.sessions.length) return `${tete}${videEtat('Aucune session', 'Après chaque lecture, note les pages lues ou la page où tu es arrivé (les minutes pour un livre audio). Le journal, ton rythme et tes séries se remplissent tout seuls.', E.livres.length ? '<button class="btn primaire" data-action="session">Noter une session</button>' : '<button class="btn primaire" data-action="livre" data-statut="encours">Ajouter un livre</button>')}${AVERTISSEMENT}`;
    const s = R.series(E, t);
    const tri = E.sessions.slice().sort((a, b) => b.date.localeCompare(a.date));
    const jours = [...new Set(tri.map((x) => x.date))];
    const visibles = jours.slice(0, filtre.journal);
    const tuiles = `<div class="tuiles tuiles-3">
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Série actuelle</p><b>${pluriel(s.actuelle, 'jour')}</b><span>${s.aujourdhui ? 'avec aujourd\'hui' : 'jusqu\'à hier'}</span></div>
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Record</p><b>${pluriel(s.record, 'jour')}</b><span>d'affilée</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Jours de lecture</p><b>${N(R.bilanAnnee(E, anneeCourante(), t).joursLus)}</b><span>en ${anneeCourante()}</span></div></div>`;
    const blocs = visibles.map((d) => {
      const ses = tri.filter((x) => x.date === d);
      return `<section class="jour-journal"><h2 class="titre-cat">${esc(R.dateFrLongue(d).replace(/^./, (c) => c.toUpperCase()))}${d === t ? ' <span>aujourd\'hui</span>' : ''}</h2>
        <ul class="mini-liste">${ses.map((x) => { const l = livre(x.livre); return `<li><span><b>${esc(l?.titre || 'Livre supprimé')}</b><span class="mention">${esc(l?.auteur || '')}</span></span><span class="nb">${qte(x.quantite, R.unite(l))}</span><button class="btn petit" data-action="session-modif" data-id="${x.id}" aria-label="Modifier la session">Modifier</button></li>`; }).join('')}</ul></section>`;
    }).join('');
    const plus = jours.length > visibles.length ? `<p style="margin-top:16px"><button class="btn" data-action="journal-plus">Voir les jours précédents (${N(jours.length - visibles.length)})</button></p>` : '';
    return `${tete}${tuiles}<h2 class="titre-section">Par jour <span>${pluriel(jours.length, 'jour')} de lecture notés</span></h2><div class="journal">${blocs}</div>${plus}${AVERTISSEMENT}`;
  }

  // ---------- Objectif ----------
  const anneeChoisie = () => filtre.annee || anneeCourante();
  function choixAnnee() {
    const l = R.annees(E, auj());
    return `<label class="champ choix-annee"><span class="sr-only">Année</span><select id="choix-annee">${l.map((a) => `<option value="${a}" ${a === anneeChoisie() ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;
  }
  function blocObjectif(o, nom, unite) {
    const fait = unite === 'pages' ? (n) => pluriel(n, 'page') : (n) => pluriel(n, 'livre');
    const enCours = o.ecoules > 0 && o.restants > 0;
    const partAttendu = Math.min(100, (o.attendu / o.cible) * 100);
    const lignes = [];
    const dec = unite === 'pages' ? 0 : 1;
    if (enCours) lignes.push(`Attendu aujourd'hui au rythme régulier : <b>${N(o.attendu, dec)}</b> ${unite === 'pages' ? 'pages' : 'livres'}. ${o.ecart >= 0 ? `Tu en as <b>${N(o.ecart, dec)}</b> de plus.` : `Il t'en manque <b>${N(-o.ecart, dec)}</b>.`}`);
    if (enCours && o.projection !== null) lignes.push(`À ton rythme de l'année : environ <b>${fait(Math.round(o.projection))}</b> au 31 décembre.`);
    if (o.parJour !== null) lignes.push(unite === 'pages' ? `Pour tenir l'objectif : <b>${N(Math.ceil(o.parJour))} pages par jour</b> d'ici la fin de l'année (${pluriel(o.restants, 'jour')}).` : `Pour tenir l'objectif : <b>${fait(o.cible - o.fait)}</b> en ${pluriel(o.restants, 'jour')}, soit un livre tous les <b>${N(o.restants / (o.cible - o.fait), 1)} jours</b>.`);
    if (o.atteint) lignes.push(`Objectif atteint${o.fait > o.cible ? `, et dépassé de ${fait(o.fait - o.cible)}` : ''}.`);
    if (!o.ecoules) lignes.push('L\'année n\'a pas commencé.');
    const etat = o.atteint ? 'vert' : o.joursAvance === null ? 'sable' : o.joursAvance >= 0 ? 'vert' : o.joursAvance >= -7 ? 'jaune' : 'rose';
    return `<section class="bloc-objectif">
      <div class="bo-tete"><h2>${nom}</h2>${o.joursAvance !== null || o.atteint ? `<span class="etiquette ${etat}">${avanceTexte(o)}</span>` : ''}</div>
      <p class="bo-chiffre"><b>${N(o.fait)}</b> sur ${fait(o.cible)} · ${N(Math.floor(o.part * 100))} %</p>
      <div class="jauge" role="img" aria-label="${esc(`${N(o.fait)} sur ${N(o.cible)}, attendu aujourd'hui ${N(o.attendu, unite === 'pages' ? 0 : 1)}`)}"><span class="jauge-rempli" style="width:${Math.min(100, o.part * 100)}%"></span>${enCours ? `<span class="jauge-repere" style="left:${partAttendu}%"><i>attendu</i></span>` : ''}</div>
      <ul class="bo-lignes">${lignes.map((x) => `<li>${x}</li>`).join('')}</ul>
    </section>`;
  }
  function vueObjectif() {
    const t = auj(), an = anneeChoisie();
    const o = R.objectifAnnee(E, an, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">Objectif de lecture</p><h1>Objectif ${an}</h1></div><div class="actions">${choixAnnee()}<button class="btn primaire" data-action="objectif">${o.livres || o.pages ? 'Modifier l\'objectif' : 'Fixer un objectif'}</button></div></div>`;
    const b = o.bilan;
    if (!o.livres && !o.pages) return `${tete}${videEtat(`Pas d'objectif pour ${an}`, `Fixe un nombre de livres et, si tu veux, de pages : tu verras au jour près si tu es en avance ou en retard, et le rythme qu'il faut pour finir à temps. Déjà ${pluriel(b.nbLivres, 'livre')} et ${pluriel(b.pages, 'page')} en ${an}.`, '<button class="btn primaire" data-action="objectif">Fixer un objectif</button>')}${listeLus(b)}${AVERTISSEMENT}`;
    // Cumul des livres terminés mois par mois, avec le cumul attendu en fin de mois (repère).
    const n = R.joursAnnee(an);
    let cumulL = 0;
    const moisCourant = an === anneeCourante() ? Number(t.slice(5, 7)) : an < anneeCourante() ? 12 : 0;
    const cumulMois = b.parMois.map((m) => { cumulL += m.livres; const finMois = R.jourDeLAnnee(R.iso(new Date(an, m.mois, 0))); return { ...m, cumul: m.mois <= moisCourant ? cumulL : 0, attendu: o.livres ? o.livres.cible * finMois / n : 0 }; });
    const graph = o.livres ? `<h2 class="titre-section">Livres terminés, en cumul <span>Barres : ton cumul à la fin de chaque mois · trait : le cumul attendu au rythme régulier</span></h2>${colonnes(cumulMois, {
      titre: `Livres terminés en cumul, ${an}`, valeur: (m) => m.cumul, repere: (m) => m.attendu, actif: moisCourant - 1,
      info: (m) => `<b>${R.MOIS[m.mois - 1].replace(/^./, (c) => c.toUpperCase())} ${an}</b>${m.mois <= moisCourant ? `${pluriel(m.cumul, 'livre')} en cumul (${N(m.livres)} ce mois-ci)<br>` : ''}Attendu fin ${MOIS_C[m.mois - 1]} : ${N(m.attendu, 1)}`,
      etiquette: (m) => (estTel() ? MOIS_C[m.mois - 1].slice(0, 1).toUpperCase() : MOIS_C[m.mois - 1]),
    })}<p class="legende"><span class="lg-barre"></span>Ton cumul <span class="lg-trait"></span>Attendu</p>` : '';
    return `${tete}<div class="objectifs">${o.livres ? blocObjectif(o.livres, 'Livres', 'livres') : ''}${o.pages ? blocObjectif(o.pages, 'Pages', 'pages') : ''}</div>
      ${o.pages ? '<p class="mention" style="margin-top:10px">Les pages comptent les livres papier et numériques : sessions notées et, pour un livre marqué lu sans sessions, ses pages à la date de fin. Les livres audio comptent dans l\'objectif en livres.</p>' : ''}
      ${graph}${listeLus(b)}${AVERTISSEMENT}`;
  }
  function listeLus(b) {
    if (!b.finis.length) return '';
    return `<h2 class="titre-section">Livres lus en ${b.annee} <span>${pluriel(b.nbLivres, 'livre')}</span></h2>
      <ol class="liste-lus">${b.finis.slice().reverse().map((l, i) => `<li><span class="numero-rang">${b.nbLivres - i}</span><button class="lien-ligne" data-action="fiche" data-id="${l.id}"><b>${esc(l.titre)}</b><span>${auteurFormat(l)} · fini le ${esc(dateMoy(l.fin))}</span></button>${etoiles(l.note)}</li>`).join('')}</ol>`;
  }

  // ---------- Statistiques ----------
  function vueStats() {
    const t = auj(), an = anneeChoisie();
    const b = R.bilanAnnee(E, an, t);
    const s = R.series(E, t);
    const tete = `<div class="vue-tete"><div><p class="surtitre">Statistiques</p><h1>Ton année ${an}</h1></div><div class="actions">${choixAnnee()}</div></div>`;
    if (!b.nbLivres && !b.pages && !b.minutes) return `${tete}${videEtat(`Rien de noté en ${an}`, 'Les statistiques se remplissent avec tes sessions de lecture et les livres que tu termines.', '<button class="btn primaire" data-action="session">Noter une session</button>')}${AVERTISSEMENT}`;
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Livres lus</p><b>${N(b.nbLivres)}</b><span>${b.abandons ? `${pluriel(b.abandons, 'abandon')}` : 'aucun abandon'}</span></div>
      <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Pages lues</p><b>${N(b.pages)}</b><span>${N(b.pagesParJour, b.pagesParJour < 10 ? 1 : 0)} par jour en moyenne</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Écoute</p><b>${R.dureeTexte(b.minutes)}</b><span>de livres audio</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Note moyenne</p><b>${b.noteMoyenne ? `${N(b.noteMoyenne, 1)} / 5` : '–'}</b><span>${b.dureeMoyenne ? `${N(b.dureeMoyenne, 0)} jours par livre en moyenne` : 'sur les livres notés'}</span></div>
    </div>`;
    const moisEt = (m) => (estTel() ? MOIS_C[m.mois - 1].slice(0, 1).toUpperCase() : MOIS_C[m.mois - 1]);
    const nomMois = (m) => `${R.MOIS[m.mois - 1].replace(/^./, (c) => c.toUpperCase())} ${an}`;
    const actif = an === anneeCourante() ? Number(t.slice(5, 7)) - 1 : -1;
    const gLivres = colonnes(b.parMois, { titre: `Livres terminés par mois, ${an}`, valeur: (m) => m.livres, info: (m) => `<b>${nomMois(m)}</b>${pluriel(m.livres, 'livre terminé', 'livres terminés')}`, etiquette: moisEt, actif });
    const gPages = colonnes(b.parMois, { titre: `Pages lues par mois, ${an}`, valeur: (m) => m.pages, info: (m) => `<b>${nomMois(m)}</b>${pluriel(m.pages, 'page')}${m.minutes ? `<br>${R.dureeTexte(m.minutes)} d'écoute` : ''}`, etiquette: moisEt, actif });
    const genres = b.parGenre.slice(0, 10);
    const gGenres = genres.length ? barres(genres, { titre: `Livres lus par genre, ${an}`, valeur: (x) => x.livres, texte: (x) => N(x.livres), nom: (x) => pastilleGenre(x.nom), info: (x) => `<b>${esc(x.nom || 'Sans genre')}</b>${pluriel(x.livres, 'livre')}${x.pages ? ` · ${pluriel(x.pages, 'page')}` : ''}${x.minutes ? ` · ${R.dureeTexte(x.minutes)} d'écoute` : ''}${x.note ? `<br>Note moyenne ${N(x.note, 1)} / 5` : ''}` }) : '';
    const gFormats = barres(b.parFormat, { titre: `Livres lus par format, ${an}`, valeur: (x) => x.livres, texte: (x) => N(x.livres), nom: (x) => esc(R.FORMATS[x.format].nom), info: (x) => `<b>${esc(R.FORMATS[x.format].nom)}</b>${pluriel(x.livres, 'livre')}` });
    const auteurs = b.parAuteur.filter((x) => x.nom).slice(0, 10);
    const tAuteurs = auteurs.length ? `<div class="defile"><table class="tableau"><caption class="sr-only">Auteurs les plus lus en ${an}</caption><thead><tr><th>Auteur</th><th class="nb">Livres</th><th class="nb">Pages</th><th class="nb">Note</th></tr></thead><tbody>${auteurs.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${N(x.livres)}</td><td class="nb">${x.pages ? N(x.pages) : '–'}${x.minutes ? ` <small>+ ${R.dureeTexte(x.minutes)}</small>` : ''}</td><td class="nb">${x.note ? N(x.note, 1) : '–'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mention">Aucun auteur renseigné.</p>';
    const faits = [
      b.plusLong ? `Le plus long : <b>${esc(b.plusLong.titre)}</b> (${pluriel(b.plusLong.total, 'page')})` : '',
      `Jours de lecture : <b>${N(b.joursLus)}</b> sur ${N(b.ecoules)}${b.ecoules ? ` (${N(Math.round(b.joursLus / b.ecoules * 100))} %)` : ''}`,
      `Série record (toutes années) : <b>${pluriel(s.record, 'jour')}</b> d'affilée · série actuelle : <b>${pluriel(s.actuelle, 'jour')}</b>`,
    ].filter(Boolean);
    return `${tete}${tuiles}<ul class="faits">${faits.map((x) => `<li>${x}</li>`).join('')}</ul>
      <div class="colonnes-stats">
        <section><h2 class="titre-section">Livres terminés par mois</h2>${gLivres}</section>
        <section><h2 class="titre-section">Pages lues par mois <span>papier et numérique</span></h2>${gPages}</section>
        <section><h2 class="titre-section">Par genre <span>livres terminés</span></h2>${gGenres || '<p class="mention">Aucun livre terminé.</p>'}</section>
        <section><h2 class="titre-section">Par format</h2>${gFormats}<h2 class="titre-section">Auteurs les plus lus</h2>${tAuteurs}</section>
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

  // Livre : création ou modification.
  function modaleLivre(id, prerempli = {}) {
    const l0 = id ? livre(id) : null;
    const l = l0 || R.normaliserLivre({ statut: prerempli.statut || 'alire', ajoute: auj(), genre: '' });
    const genres = [...new Set(E.reglages.genres.concat(l.genre ? [l.genre] : []))];
    const audio = l.format === 'audio';
    const corps = `
      <label class="champ">Titre<input name="titre" value="${l0 ? esc(l.titre) : ''}" maxlength="140" required></label>
      <div class="rang-champs">
        <label class="champ">Auteur<input name="auteur" value="${esc(l.auteur)}" maxlength="100" list="auteurs-connus"></label>
        <label class="champ">Genre<select name="genre"><option value="">Sans genre</option>${genres.map((g) => `<option ${g === l.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      </div>
      <datalist id="auteurs-connus">${[...new Set(E.livres.map((x) => x.auteur).filter(Boolean))].sort().map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
      <fieldset class="champ"><legend>Format</legend><div class="choix-statut trois">${Object.entries(R.FORMATS).map(([c, f]) => `<label><input type="radio" name="format" value="${c}" ${c === l.format ? 'checked' : ''}><span>${f.nom}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-total"><span class="lib-total">${audio ? 'Durée' : 'Nombre de pages'}</span> <small class="aide-total">${audio ? 'par exemple 9h30 ou 570 (minutes)' : 'facultatif, mais nécessaire pour la progression'}</small><input name="total" inputmode="${audio ? 'text' : 'numeric'}" value="${l.total ? (audio ? dureeSaisie(l.total) : l.total) : ''}" maxlength="8"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${['alire', 'encours', 'lu', 'abandonne'].map((s) => `<label><input type="radio" name="statut" value="${s}" ${s === l.statut ? 'checked' : ''}><span>${R.STATUTS[s]}</span></label>`).join('')}</div></fieldset>
      <label class="champ" data-si="alire">Priorité<select name="priorite">${Object.entries(R.PRIORITES).map(([v, n]) => `<option value="${v}" ${Number(v) === l.priorite ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="rang-champs" data-si="encours lu abandonne">
        <label class="champ">Commencé le<input type="date" name="debut" value="${l.debut}"></label>
        <label class="champ" data-si="lu abandonne">${l.statut === 'abandonne' ? 'Arrêté le' : 'Fini le'}<input type="date" name="fin" value="${l.fin}"></label>
      </div>
      <fieldset class="champ" data-si="lu abandonne encours"><legend>Ta note</legend><div class="choix-note">${[0, 1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="note" value="${n}" ${n === l.note ? 'checked' : ''}><span>${n ? `${'★'.repeat(n)}<span class="sr-only"> ${n} sur 5</span>` : 'Aucune'}</span></label>`).join('')}</div></fieldset>
      <label class="champ" data-si="lu abandonne encours">Ton avis <small>pour toi seul</small><textarea name="avis" maxlength="4000">${esc(l.avis || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(l0 ? 'Modifier le livre' : 'Nouveau livre', corps, PIED(!!l0), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = R.sessionsDe(E, l.id).length;
        if (!confirm(`Supprimer « ${l.titre} »${n ? ` et ses ${pluriel(n, 'session')}` : ''} ?`)) return '';
        modifier((e) => R.supprimerLivre(e, l.id), 'Livre supprimé.');
        return undefined;
      }
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Indique le titre.';
      const format = fd.get('format');
      const total = format === 'audio' ? lireDuree(fd.get('total')) : entier(fd.get('total'));
      if (total === null) return format === 'audio' ? 'Durée illisible : écris par exemple 9h30 ou 570.' : 'Le nombre de pages doit être un nombre entier.';
      const statut = fd.get('statut');
      const debut = String(fd.get('debut') || ''), fin = String(fd.get('fin') || '');
      if ((statut === 'lu' || statut === 'abandonne') && debut && fin && fin < debut) return 'La date de fin précède le début.';
      const n = R.normaliserLivre({ ...l, titre, auteur: fd.get('auteur'), genre: fd.get('genre'), format, total, statut, priorite: fd.get('priorite'),
        debut: statut === 'alire' ? l.debut : (debut || (statut !== l.statut ? auj() : '')),
        fin: statut === 'lu' || statut === 'abandonne' ? (fin || auj()) : '',
        note: fd.get('note'), avis: fd.get('avis'), ordre: l0 ? l.ordre : Math.max(0, ...E.livres.map((x) => x.ordre)) + 1 });
      const fait = R.cumul(E, l.id);
      if (n.total && fait > n.total && n.statut !== 'lu') return `Tes sessions totalisent déjà ${qte(fait, R.unite(n))} : le total ne peut pas être plus petit.`;
      modifier((e) => { const i = e.livres.findIndex((x) => x.id === n.id); const livres = e.livres.slice(); if (i >= 0) livres[i] = n; else livres.push(n); return { ...e, livres }; }, l0 ? 'Livre modifié.' : `« ${n.titre} » ajouté.`);
      return undefined;
    });
    const d = modale();
    const maj = () => {
      const st = d.querySelector('[name=statut]:checked').value;
      d.querySelectorAll('[data-si]').forEach((x) => { x.hidden = !x.dataset.si.split(' ').includes(st); });
      const au = d.querySelector('[name=format]:checked').value === 'audio';
      d.querySelector('.lib-total').textContent = au ? 'Durée' : 'Nombre de pages';
      d.querySelector('.aide-total').textContent = au ? 'par exemple 9h30 ou 570 (minutes)' : 'facultatif, mais nécessaire pour la progression';
      d.querySelector('[name=total]').inputMode = au ? 'text' : 'numeric';
      const lf = d.querySelector('[name=fin]')?.closest('label');
      if (lf) lf.firstChild.textContent = st === 'abandonne' ? 'Arrêté le' : 'Fini le';
    };
    d.querySelectorAll('[name=statut],[name=format]').forEach((r) => r.addEventListener('change', maj));
    maj();
  }

  // Fiche d'un livre : progression, rythme, dates, note, avis, citations, sessions.
  function modaleFiche(id) {
    const l = livre(id);
    if (!l) return;
    const p = R.progression(E, l);
    const ses = R.sessionsDe(E, l.id).reverse();
    const dates = [l.ajoute ? `Ajouté le ${dateMoy(l.ajoute)}` : '', l.debut ? `commencé le ${dateMoy(l.debut)}` : '', l.fin ? `${l.statut === 'abandonne' ? 'arrêté' : 'fini'} le ${dateMoy(l.fin)}` : '', l.debut && l.fin ? `en ${pluriel(R.ecart(l.debut, l.fin) + 1, 'jour')}` : ''].filter(Boolean).join(' · ');
    const corps = `
      <div class="fiche-tete"><div class="ligne-etiquettes">${etiquetteStatut(l)}${pastilleGenre(l.genre)}${l.statut === 'alire' ? `<span class="etiquette sable">${R.PRIORITES[l.priorite]}</span>` : ''}</div>
        <h3>${esc(l.titre)}</h3><p>${auteurFormat(l)}</p>${dates ? `<p class="mention">${esc(dates.replace(/^./, (c) => c.toUpperCase()))}</p>` : ''}</div>
      ${l.statut !== 'alire' || p.fait ? `<div class="bloc-detail">${barreProgres(p)}<p>${progresTexte(p)}</p>${l.statut === 'encours' ? `<p class="mention">${rythmeTexte(l)}</p>` : ''}</div>` : ''}
      ${l.note || l.avis ? `<div class="bloc-detail"><h3>Ton avis ${etoiles(l.note)}</h3>${l.avis ? `<p class="avis">${esc(l.avis).replace(/\n/g, '<br>')}</p>` : ''}</div>` : ''}
      <div class="bloc-detail"><h3>Citations <button type="button" class="btn petit" data-action="citation" data-livre="${l.id}">${ICONES.plus}Citation</button></h3>
        ${l.citations?.length ? `<ul class="citations">${l.citations.map((c) => `<li><blockquote>${esc(c.texte).replace(/\n/g, '<br>')}</blockquote><span>${c.page ? `p. ${N(c.page)}` : ''}<button type="button" class="btn-suppr" data-action="citation-suppr" data-livre="${l.id}" data-id="${c.id}" aria-label="Supprimer la citation">×</button></span></li>`).join('')}</ul>` : '<p class="mention">Aucune citation notée.</p>'}</div>
      <div class="bloc-detail"><h3>Sessions <span>${pluriel(ses.length, 'session')}</span></h3>
        ${ses.length ? `<ul class="mini-liste">${ses.slice(0, 12).map((s) => `<li><span>${esc(dateCourte(s.date))}</span><span class="nb">${qte(s.quantite, p.unite)}</span><button type="button" class="btn petit" data-action="session-modif" data-id="${s.id}">Modifier</button></li>`).join('')}</ul>${ses.length > 12 ? `<p class="mention">Et ${pluriel(ses.length - 12, 'session')} plus ancienne${ses.length - 12 > 1 ? 's' : ''} (voir le Journal).</p>` : ''}` : '<p class="mention">Aucune session notée.</p>'}</div>`;
    const pied = `${l.statut === 'lu' ? '' : `<button type="button" class="btn primaire" data-action="${l.statut === 'alire' ? 'commencer' : 'session'}" data-livre="${l.id}" data-id="${l.id}">${l.statut === 'alire' ? 'Commencer' : 'Noter une session'}</button>`}<button type="button" class="btn" data-action="livre" data-id="${l.id}">Modifier</button>${l.statut === 'encours' ? `<button type="button" class="btn gauche" data-action="abandonner" data-id="${l.id}">Abandonner</button>` : ''}`;
    ouvrirModale(esc(l.titre.length > 40 ? `${l.titre.slice(0, 38)}…` : l.titre), corps, pied, () => undefined);
  }

  // Session : pages lues ou page atteinte (minutes pour l'audio), aperçu de la progression.
  function modaleSession(id, livreId) {
    const s0 = id ? E.sessions.find((x) => x.id === id) : null;
    const choix = E.livres.filter((l) => l.statut !== 'lu' || l.id === s0?.livre || l.id === livreId);
    if (!choix.length) { toast('Ajoute d\'abord un livre.'); modaleLivre(null, { statut: 'encours' }); return; }
    const ordre = { encours: 0, alire: 1, abandonne: 2, lu: 3 };
    choix.sort((a, b) => ordre[a.statut] - ordre[b.statut] || (a.statut === 'alire' ? R.aLire(E).indexOf(a) - R.aLire(E).indexOf(b) : a.titre.localeCompare(b.titre, 'fr')));
    const lid = s0?.livre || livreId || choix[0].id;
    const groupes = ['encours', 'alire', 'abandonne', 'lu'].map((st) => { const g = choix.filter((l) => l.statut === st); return g.length ? `<optgroup label="${R.STATUTS[st]}">${g.map((l) => `<option value="${l.id}" ${l.id === lid ? 'selected' : ''}>${esc(l.titre)}${l.auteur ? ` · ${esc(l.auteur)}` : ''}</option>`).join('')}</optgroup>` : ''; }).join('');
    const corps = `
      <label class="champ">Livre<select name="livre" ${s0 ? 'disabled' : ''}>${groupes}</select></label>
      <label class="champ">Date<input type="date" name="date" value="${s0?.date || auj()}" max="${R.ajout(auj(), 1)}"></label>
      ${s0 ? '' : '<fieldset class="champ"><legend>Je note</legend><div class="choix-statut deux"><label><input type="radio" name="mode" value="position" checked><span class="lib-position">La page atteinte</span></label><label><input type="radio" name="mode" value="quantite"><span class="lib-quantite">Les pages lues</span></label></div></fieldset>'}
      <label class="champ"><span class="lib-valeur">Pages lues</span><input name="valeur" inputmode="numeric" value="${s0 ? (R.unite(livre(s0.livre)) === 'minutes' ? dureeSaisie(s0.quantite) : s0.quantite) : ''}" maxlength="8" autocomplete="off"></label>
      <p class="apercu-session" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s0 ? 'Modifier la session' : 'Noter une session', corps, PIED(!!s0), (fd, v) => {
      if (v === 'supprimer') { modifier((e) => ({ ...e, sessions: e.sessions.filter((x) => x.id !== s0.id) }), 'Session supprimée.'); return undefined; }
      const r = calculSession();
      if (typeof r === 'string') return r;
      retenir();
      const base = s0 ? { ...E, sessions: E.sessions.filter((x) => x.id !== s0.id) } : E;
      const res = R.appliquerSession(base, { id: s0?.id || uid(), livre: r.livre.id, date: r.date, quantite: r.quantite });
      E = res.etat;
      sauver(); rendre();
      toast(res.termine ? `Bravo, « ${r.livre.titre} » est terminé ! Pense à lui donner une note.` : s0 ? 'Session modifiée.' : `Session notée : ${qte(r.quantite, R.unite(r.livre))}.`, { libelle: 'Annuler', faire: annuler });
      if (res.termine) { setTimeout(() => modaleLivre(r.livre.id), 50); }
      return undefined;
    });
    const d = modale();
    function calculSession() {
      const l = livre(s0?.livre || d.querySelector('[name=livre]').value);
      const date = d.querySelector('[name=date]').value;
      if (!R.estDate(date)) return 'Choisis une date.';
      if (date > R.ajout(auj(), 1)) return 'La date est dans le futur.';
      const au = R.unite(l) === 'minutes';
      const brut = d.querySelector('[name=valeur]').value;
      const val = au ? lireDuree(brut) : entier(brut);
      if (val === null) return au ? 'Durée illisible : écris par exemple 45, 1h15 ou 1:15.' : 'Indique un nombre entier.';
      if (!val) return au ? 'Indique la durée écoutée.' : 'Indique un nombre de pages.';
      const mode = s0 ? 'quantite' : d.querySelector('[name=mode]:checked').value;
      const e = s0 ? { ...E, sessions: E.sessions.filter((x) => x.id !== s0.id) } : E;
      const fait = R.progression(e, l).fait;
      const quantite = mode === 'position' ? val - fait : val;
      if (quantite <= 0) return au ? `Tu en étais déjà à ${R.dureeTexte(fait)} : indique une position plus loin, ou choisis « durée écoutée ».` : `Tu en étais déjà à la page ${N(fait)} : indique une page plus loin, ou choisis « les pages lues ».`;
      if (l.total && fait + quantite > l.total * 1.5) return `C'est bien plus que la longueur du livre (${qte(l.total, R.unite(l))}) : vérifie la saisie ou corrige le total dans la fiche du livre.`;
      return { livre: l, date, quantite, fait };
    }
    const maj = () => {
      const l = livre(s0?.livre || d.querySelector('[name=livre]').value);
      const au = R.unite(l) === 'minutes';
      const mode = s0 ? 'quantite' : d.querySelector('[name=mode]:checked').value;
      if (!s0) { d.querySelector('.lib-position').textContent = au ? 'La position atteinte' : 'La page atteinte'; d.querySelector('.lib-quantite').textContent = au ? 'La durée écoutée' : 'Les pages lues'; }
      d.querySelector('.lib-valeur').textContent = mode === 'position' ? (au ? 'Position atteinte (par exemple 3h40)' : 'Page atteinte') : (au ? 'Durée écoutée (par exemple 45 ou 1h15)' : 'Pages lues');
      d.querySelector('[name=valeur]').inputMode = au ? 'text' : 'numeric';
      const ap = d.querySelector('.apercu-session');
      const r = calculSession();
      const p = R.progression(s0 ? { ...E, sessions: E.sessions.filter((x) => x.id !== s0.id) } : E, l);
      if (typeof r === 'string') { ap.innerHTML = `${au ? 'Écouté' : 'Lu'} jusqu'ici : ${p.total ? `${au ? R.dureeTexte(p.fait) : `page ${N(p.fait)}`} sur ${qte(p.total, p.unite)}` : qte(p.fait, p.unite)}.`; return; }
      const apres = r.fait + r.quantite;
      ap.innerHTML = `${qte(r.quantite, p.unite)} → ${p.total ? `${au ? R.dureeTexte(Math.min(apres, p.total)) : `page ${N(Math.min(apres, p.total))}`} sur ${qte(p.total, p.unite)} (<b>${Math.min(100, Math.floor(apres / p.total * 100))} %</b>)` : `${qte(apres, p.unite)} au total`}${p.total && apres >= p.total && l.statut !== 'lu' ? '. <b>Le livre passera en « Lu ».</b>' : ''}${l.statut === 'alire' ? '. Il passera « En cours ».' : ''}${l.statut === 'abandonne' ? '. Il reprendra « En cours ».' : ''}`;
    };
    d.querySelectorAll('[name=livre],[name=mode],[name=valeur],[name=date]').forEach((x) => x.addEventListener('input', maj));
    d.querySelectorAll('[name=livre],[name=mode]').forEach((x) => x.addEventListener('change', maj));
    maj();
    if (!estTel()) d.querySelector('[name=valeur]').focus();
  }

  function modaleCitation(livreId) {
    const l = livre(livreId);
    const corps = `<p class="mention">${esc(l.titre)}</p>
      <label class="champ">Citation<textarea name="texte" maxlength="1000" required></textarea></label>
      <label class="champ">Page <small>facultatif</small><input name="page" inputmode="numeric" maxlength="6"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle citation', corps, PIED(false), (fd) => {
      const texte = String(fd.get('texte') || '').trim();
      if (!texte) return 'Écris la citation.';
      const page = entier(fd.get('page'));
      if (page === null) return 'La page doit être un nombre entier.';
      modifier((e) => ({ ...e, livres: e.livres.map((x) => (x.id === l.id ? R.normaliserLivre({ ...x, citations: (x.citations || []).concat([{ id: uid(), texte, page }]) }) : x)) }), 'Citation ajoutée.');
      d2(() => modaleFiche(l.id));
      return '';
    });
  }
  // Rouvre une autre modale juste après la fermeture de la courante.
  const d2 = (f) => setTimeout(f, 30);

  function modaleObjectif() {
    const an = vue === 'objectif' || vue === 'stats' ? anneeChoisie() : anneeCourante();
    const o = E.reglages.objectifs[an] || { livres: 0, pages: 0 };
    const b = R.bilanAnnee(E, an, auj());
    const corps = `<p>Pour <b>${an}</b> : déjà ${pluriel(b.nbLivres, 'livre')} et ${pluriel(b.pages, 'page')}.</p>
      <div class="rang-champs"><label class="champ">Livres<input name="livres" inputmode="numeric" value="${o.livres || ''}" maxlength="4"></label>
      <label class="champ">Pages <small>facultatif</small><input name="pages" inputmode="numeric" value="${o.pages || ''}" maxlength="6"></label></div>
      <p class="aide">Laisse un champ vide pour ne pas suivre cette mesure. Les pages comptent les livres papier et numériques ; un livre audio compte dans l'objectif en livres.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Objectif ${an}`, corps, PIED(false), (fd) => {
      const livres = entier(fd.get('livres')), pages = entier(fd.get('pages'));
      if (livres === null || pages === null) return 'Indique des nombres entiers.';
      modifier((e) => { const objectifs = { ...e.reglages.objectifs }; if (livres || pages) objectifs[an] = { livres, pages }; else delete objectifs[an]; return { ...e, reglages: { ...e.reglages, objectifs } }; }, 'Objectif enregistré.');
      return undefined;
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const corps = `
      <div class="groupe"><h3>Genres</h3><p class="aide">Renomme un genre (les livres suivent), retire-le ou ajoute les tiens. Un genre retiré reste sur les livres qui l'ont déjà.</p>
        <ul class="mini-liste liste-genres">${E.reglages.genres.map((g, i) => `<li><label class="champ"><span class="sr-only">Genre ${i + 1}</span><input name="genre-${i}" data-ancien="${esc(g)}" value="${esc(g)}" maxlength="40"></label><button type="button" class="btn-suppr" data-action="genre-suppr" aria-label="Retirer ${esc(g)}">×</button></li>`).join('')}</ul>
        <div class="rang-champs"><label class="champ">Nouveau genre<input name="genre-nouveau" maxlength="40"></label></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule) : la bibliothèque avec notes, avis et citations, ou toutes les sessions.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-livres">Bibliothèque</button><button class="btn petit" type="button" data-action="csv-sessions">Sessions</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ta bibliothèque est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${N(Math.round(t / 1000))} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte une copie, puis retire les sessions anciennes.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer les sessions avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div>
        <p class="mention">Les livres et leurs dates restent ; seules les sessions détaillées sont retirées (les livres lus gardent leurs pages à leur date de fin).</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le suivi à ton écran d'accueil pour noter ta page d'un geste, le soir, le livre encore ouvert.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ta bibliothèque est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Tes avis et citations restent privés : il n'y a ni profil public ni partage.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Genres proposés modifiables. Aucun livre n'est cherché en ligne (pas de base de livres, pas de couverture, pas de numéro ISBN consulté), aucun lien avec une liseuse, une application de lecture ou une librairie. Calculs faits sur cet appareil : rythme sur les 14 derniers jours, objectif réparti uniformément sur les jours de l'année.</p></div>`;
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
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.livres) || !Array.isArray(donnees.sessions)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.livres.length, 'livre')}, ${pluriel(donnees.sessions.length, 'session')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(donnees); delete E.majLe; E.tutorielVu = vu || E.tutorielVu === true;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi de lecture.'); }
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
    const cible = o && (o.livres || o.pages) ? ` Ton objectif ${an}&nbsp;: ${[o.livres ? pluriel(o.livres, 'livre') : '', o.pages ? pluriel(o.pages, 'page') : ''].filter(Boolean).join(' et ')}.` : '';
    const blocs = [
      ['rose', 'Ta bibliothèque', `Ajoute chaque livre, papier, numérique ou audio, avec son nombre de pages (de minutes pour un livre audio). Il est <b>${S.encours}</b>, <b>${S.alire}</b>, <b>${S.lu}</b> ou <b>${S.abandonne}</b>. Ta liste à lire se range par priorité&nbsp;: ${P[1].toLowerCase()}, ${P[2].toLowerCase()}, ${P[3].toLowerCase()}.`],
      ['beurre', 'Note chaque session', `Après une lecture, touche <b>Session</b> et note la page atteinte ou les pages lues (les minutes pour un livre audio). Un livre passe en cours à sa première session, et en lu quand tu atteins sa dernière page.`],
      ['ciel', 'Ton rythme et ta date de fin', `Ton rythme sur un livre, c'est ce que tu en as lu ces 14 derniers jours, ramené à une moyenne par jour. À ce rythme, l'outil estime la date à laquelle tu le finiras. Sans lecture de ce livre depuis 14 jours, il n'estime rien.`],
      ['sable', 'Ton objectif de l\'année', `Fixe un nombre de livres et, si tu veux, de pages. <b>Objectif</b> compare ce que tu as lu à ce qui est attendu au rythme régulier&nbsp;: tu vois ton avance ou ton retard au jour près, et ce qu'il faut lire par jour pour finir à temps.${cible}`],
      ['rose', 'Ta série et tes statistiques', `Chaque jour avec au moins une session allonge ta série&nbsp;; elle n'est pas perdue tant que la journée n'est pas finie. <b>Statistiques</b> résume ton année&nbsp;: livres et pages par mois, genres, formats, auteurs les plus lus.`],
    ];
    const corps = `
      <p>Le suivi calcule ta progression, ton rythme et la date à laquelle tu finiras ton livre, et te dit où tu en es de ton objectif de l'année. Ton rôle&nbsp;: ajouter tes livres, puis noter tes sessions de lecture.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Journal</b> liste tes sessions jour par jour&nbsp;: touche-en une pour la corriger. Rien n'est cherché en ligne&nbsp;: titre, auteur et nombre de pages se saisissent à la main. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton suivi est enregistré en ligne avec ta clé&nbsp;: tu le retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.livres.length;
    const pied = premier
      ? '<button class="btn primaire" value="livre">Ajouter mon premier livre</button><button class="btn" value="ok">Fermer</button>'
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
      <p>Enregistre ton suivi de lecture sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
      case 'csv-sessions': telecharger(R.csvSessions(E), CSV, `sessions-lecture-${auj()}.csv`); break;
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
      case 'abandonner': { const l = livre(id); if (!l || !confirm(`Abandonner « ${l.titre} » ? Tu pourras le reprendre en notant une session.`)) break; modale().close(); modifier((x) => R.changerStatut(x, l.id, 'abandonne', auj()), 'Livre abandonné.'); break; }
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
