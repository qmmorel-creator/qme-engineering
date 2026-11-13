// Compte rendu et plan d'actions QME : réunions par série, actions reprises d'une réunion à l'autre,
// données synchronisées par code d'accès. Règles métier pures dans regles.js (window.REGLES).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'CRA';
  const CLE_CODE = 'qme-cra-code';
  const CLE_CACHE = 'qme-cra-cache';
  const CLE_DEMO = 'qme-cra-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cra-ecran-accueil';
  const NOM_PRODUIT = 'Compte rendu et plan d\'actions';

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
  const { ajout, ecart, dateLongue, dateCourte } = R;
  const auj = () => R.iso(new Date());
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return R.JOURS[R.jourSemaine(s)];
    return dateCourte(s);
  };
  const couleurHex = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const modele = (id) => B.modeles.find((m) => m.id === id) || null;

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code CRA) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'reunions';
  let reunionId = null;
  let filtre = 'ouvertes';
  let annulation = null;

  const etatVide = () => ({ version: 1, moi: null, personnes: [], series: [], reunions: [], actions: [] });
  const tableau = (x) => (Array.isArray(x) ? x : []);
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, personnes: tableau(d.personnes), series: tableau(d.series), reunions: tableau(d.reunions), actions: tableau(d.actions) };
    n.reunions = n.reunions.map((r) => ({ lieu: '', participants: [], points: [], decisions: [], suivi: [], ...r }));
    n.actions = n.actions.map((a) => ({ statut: 'afaire', echeance: null, responsableId: null, reunionId: null, ...a }));
    return n;
  };
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const serie = (id) => E.series.find((s) => s.id === id);
  const reunion = (id) => E.reunions.find((r) => r.id === id);
  const action = (id) => E.actions.find((a) => a.id === id);
  const couleurReunion = (r) => couleurHex(serie(r?.serieId)?.couleur || 'encre');
  const nomDe = (id) => personne(id)?.nom || 'Sans responsable';
  const ouvertes = () => E.actions.filter(R.estOuverte);

  // Réunion affichée par défaut : la plus récente déjà tenue, sinon la prochaine.
  function reunionParDefaut() {
    const t = auj();
    const tri = [...E.reunions].sort((a, b) => a.date.localeCompare(b.date));
    return tri.filter((r) => r.date <= t).at(-1) || tri[0] || null;
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
        toast('Un autre appareil a modifié tes comptes rendus entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    if (document.activeElement && document.activeElement.matches('#vue input, #vue textarea')) return;
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
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Code CRA-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('CRA')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('CRA') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
    reunionId = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Une équipe projet fictive : trois séries et une réunion ponctuelle, simulées avec les vraies règles
  // (report des actions ouvertes) à des dates relatives à aujourd'hui. Tous les états sont présents :
  // en retard, échéance aujourd'hui, cette semaine, plus tard, sans date, en cours, fait, abandonnée,
  // et une réunion à venir encore vide.
  function donneesDemo() {
    E = etatVide();
    const t = auj();
    const lundi = ajout(t, -((R.jourSemaine(t) + 6) % 7));
    const P = [
      ['Camille Rousseau', 'Cheffe de projet'], ['Marie Lefèvre', 'Achats'], ['Thomas Girard', 'Développeur'],
      ['Inès Moreau', 'Graphiste'], ['Hugo Lambert', 'Commercial'], ['Sarah Benali', 'Cliente, marketing'], ['Julien Faure', 'Direction'],
    ].map(([nom, role]) => { const p = { id: uid(), nom, role }; E.personnes.push(p); return p; });
    const [camille, marie, thomas, ines, hugo, sarah, julien] = P;
    E.moi = camille.id;
    const nouvelleSerie = (nom, modeleId, couleur, participants) => { const s = { id: uid(), nom, modeleId, couleur, participants: participants.map((p) => p.id) }; E.series.push(s); return s; };
    // Réunions tenues un jour ouvré (un samedi ou un dimanche recule au vendredi).
    const ouvre = (d) => { const j = R.jourSemaine(d); return j === 6 ? ajout(d, -1) : j === 0 ? ajout(d, -2) : d; };
    const tenir = (s, jour, { titre, lieu, notes = [], decisions = [], presents } = {}) => {
      const date = ouvre(jour);
      const r = R.preparerReunion(E, { serieId: s?.id || null, date, titre, modele: modele(s?.modeleId || 'retro'), lieu }, uid);
      if (presents) r.participants = presents.map((p) => p.id);
      notes.forEach((n, i) => { if (r.points[i]) r.points[i].notes = n; });
      r.decisions = decisions.map((texte) => ({ id: uid(), texte }));
      E.reunions.push(r);
      return r;
    };
    const act = (r, p, texte, echeance, statut = 'afaire', faitLe = null) => {
      const a = { id: uid(), reunionId: r.id, responsableId: p?.id || null, texte, echeance, statut, creeLe: r.date, faitLe };
      E.actions.push(a);
      return a;
    };
    const clore = (a, statut, date) => R.changerStatut(a, statut, date);

    // Série 1 : point d'équipe du lundi (trois réunions tenues, une à venir).
    const equipe = nouvelleSerie('Point d\'équipe du lundi', 'equipe', 'rouge', [camille, marie, thomas, ines, hugo]);
    const m1 = tenir(equipe, ajout(lundi, -14), { lieu: 'Salle Atelier', decisions: ['Toutes les demandes clients passent par le formulaire de contact.'],
      notes: ['Marie : salon professionnel confirmé. Thomas : export PDF instable sur les gros fichiers.', 'Préparer le salon, stabiliser l\'export.'] });
    const a1 = act(m1, marie, 'Demander trois devis d\'imprimeur pour les plaquettes', ajout(lundi, -9));
    const a2 = act(m1, thomas, 'Corriger l\'export PDF des gros fichiers', ajout(lundi, -7));
    const a3 = act(m1, ines, 'Proposer deux pistes de visuel pour le salon', ajout(lundi, -4));
    clore(a1, 'fait', ajout(lundi, -10));
    a2.statut = 'encours';
    const m2 = tenir(equipe, ajout(lundi, -7), { decisions: ['Budget salon plafonné, validé par la direction.'],
      notes: ['Inès : deux pistes presque prêtes. Hugo : douze contacts pris au salon régional.', 'Relancer les prospects, préparer le budget formation.'] });
    act(m2, hugo, 'Relancer les prospects rencontrés au salon', ajout(lundi, -3), 'encours');
    act(m2, camille, 'Valider le budget formation avec la direction', t);
    const a6 = act(m2, marie, 'Commander les badges visiteurs', ajout(lundi, -1));
    clore(a3, 'fait', ajout(lundi, -5));
    clore(a6, 'fait', ajout(lundi, -2));
    const m3 = tenir(equipe, lundi, { lieu: 'Salle Atelier',
      decisions: ['La page tarifs passe en ligne avant le salon.', 'Point d\'équipe avancé à 9 h à partir de la semaine prochaine.'],
      notes: [
        'Camille : planning du salon bouclé.\nThomas : export PDF corrigé en partie, reste les fichiers de plus de 50 pages.\nInès : visuels validés.\nHugo : 4 rendez-vous pris sur 12 contacts.',
        'Mettre la page tarifs en ligne.\nPréparer les visuels du salon.',
        'Contrat de maintenance : le prestataire ne répond plus, piste abandonnée.',
        'Thomas absent vendredi.',
      ] });
    act(m3, thomas, 'Mettre en ligne la page tarifs', ajout(t, 1));
    act(m3, ines, 'Préparer les visuels du stand', ajout(t, 12));
    act(m3, camille, 'Envoyer le compte rendu au client', null);
    act(m3, hugo, 'Mettre à jour le fichier prospects', t, 'fait', t);
    act(m3, marie, 'Négocier le contrat de maintenance', ajout(t, 6), 'abandonnee', t);
    tenir(equipe, ajout(lundi, 7), { lieu: 'Salle Atelier' }); // à venir : encore vide

    // Série 2 : comité de pilotage d'un projet client.
    const copil = nouvelleSerie('Comité de pilotage · refonte du site', 'copil', 'bleu', [camille, hugo, sarah, julien]);
    const c1 = tenir(copil, ajout(t, -20), { lieu: 'Visio', notes: ['Maquettes validées, développement lancé.', 'Mise en ligne visée dans six semaines.'] });
    const b1 = act(c1, sarah, 'Valider l\'arborescence du site', ajout(t, -13));
    act(c1, hugo, 'Chiffrer l\'option boutique en ligne', ajout(t, -6), 'encours');
    act(c1, camille, 'Planifier les tests utilisateurs', ajout(t, 5), 'encours');
    clore(b1, 'fait', ajout(t, -14));
    const c2 = tenir(copil, ajout(t, -2), { lieu: 'Visio',
      decisions: ['La boutique en ligne passe en phase 2.', 'Budget complémentaire accordé pour les tests utilisateurs.'],
      notes: ['Pages principales développées. Retard sur les contenus.', 'Jalon « contenus » décalé d\'une semaine.', 'Consommé conforme au prévu.', 'Contenus fournis en retard par le client : risque sur la date de mise en ligne.', 'Faut-il intégrer la boutique dès la mise en ligne ? Réponse : non, phase 2.'] });
    act(c2, sarah, 'Fournir les textes de la page À propos', ajout(t, 3));
    act(c2, julien, 'Signer l\'avenant pour les tests utilisateurs', ajout(t, 1));

    // Série 3 : point client.
    const client = nouvelleSerie('Point client · boutique de thé', 'client', 'encre', [camille, ines, sarah]);
    const k1 = tenir(client, ajout(t, -9), { lieu: 'Chez le client', notes: ['Refonte de la vitrine en ligne, sans changer de catalogue.', 'Maquette de l\'accueil présentée.', 'Couleurs jugées trop froides.'] });
    const k = act(k1, camille, 'Envoyer la maquette de la page d\'accueil corrigée', ajout(t, -8));
    clore(k, 'fait', ajout(t, -8));
    act(k1, ines, 'Ajuster la charte couleurs', ajout(t, 2), 'encours');

    // Réunion ponctuelle : rétrospective.
    const retro = tenir(null, ajout(t, -4), { titre: 'Rétrospective du sprint 12', presents: [camille, thomas, ines],
      decisions: ['Revue de code à deux pour chaque mise en ligne.'],
      notes: ['Démo client fluide, entraide sur les maquettes.', 'Trop d\'interruptions en fin de sprint.', 'Créneau sans réunion le jeudi matin.'] });
    act(retro, thomas, 'Mettre en place la revue de code systématique', null, 'encours');
    act(retro, camille, 'Bloquer le jeudi matin dans les agendas', ajout(t, -1));

    reunionId = m3.id;
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM_PRODUIT} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="200" height="260" fill="#FBFAF6"/>
          <rect x="40" y="60" width="140" height="14" fill="#141414"/>
          <rect x="40" y="100" width="110" height="10" fill="#D9D4C8"/>
          <rect x="40" y="128" width="130" height="10" fill="#D9D4C8"/>
          <rect x="40" y="170" width="24" height="24" fill="#D9302A"/>
          <rect x="76" y="176" width="100" height="10" fill="#D9D4C8"/>
          <rect x="40" y="214" width="24" height="24" fill="#F5B400"/>
          <rect x="76" y="220" width="80" height="10" fill="#D9D4C8"/>
          <circle cx="360" cy="150" r="110" fill="#1D4E89"/>
          <path d="M440 280 A130 130 0 0 1 550 150 V280 Z" fill="#F5B400"/>
          <path d="M318 150 l30 30 l58 -64" fill="none" stroke="#F0EDE6" stroke-width="22"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Compte rendu · plan d'actions</p>
          <h1>Chaque réunion repart des actions de la précédente.</h1>
          <p>Note pendant la réunion, tape « Marie : envoyer le devis avant vendredi » : l'action est créée, datée et suivie jusqu'à ce qu'elle soit faite.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes comptes rendus</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes réunions et tes actions sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes comptes rendus</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/#compte-rendu">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes comptes rendus'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, nom: '', role: '', modele: null, serie: '' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton cahier de réunions.</h1>
        <p class="intro">Deux questions, puis tu pourras ouvrir ton premier compte rendu. Tout reste modifiable ensuite.</p>
        <form id="form-moi" class="form-moi">
          <label class="champ">Ton nom <small>Facultatif. Il sert au filtre « Mes actions » et à la saisie « moi : … ».</small>
            <input id="moi-nom" value="${esc(a.nom)}" autocomplete="name" maxlength="60" placeholder="Ex. : Camille Rousseau">
          </label>
          <label class="champ">Ton rôle <small>Facultatif. Il apparaît dans la liste des participants.</small>
            <input id="moi-role" value="${esc(a.role)}" maxlength="60" placeholder="Ex. : Cheffe de projet">
          </label>
        </form>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Ta première série</p>
        <h1>Quelle réunion animes-tu le plus souvent ?</h1>
        <p class="intro">Choisis un modèle : son ordre du jour sert à chaque nouvelle réunion de la série, et les actions encore ouvertes sont reprises d'une réunion à la suivante.</p>
        <div class="filieres" role="group" aria-label="Modèle de réunion">
          ${B.modeles.map((m) => `<button type="button" class="filiere" style="--c:${couleurHex(m.couleur)}" data-action="accueil-modele" data-id="${m.id}" aria-pressed="${a.modele === m.id}"><b>${esc(m.nom)}</b><span>${esc(m.frequence)} · ${esc(m.duree)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="accueil-modele" data-id="libre" aria-pressed="${a.modele === 'libre'}"><b>Sans modèle</b><span>Je construis mon ordre du jour</span></button>
        </div>
        <label class="champ nom-serie">Nom de la série <small>Ex. : « Point d'équipe du lundi », « Comité de pilotage · projet Alpha ».</small>
          <input id="accueil-serie" value="${esc(a.serie)}" maxlength="80">
        </label>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.modele ? '' : 'disabled'}>Ouvrir mon premier compte rendu</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#moi-nom')?.addEventListener('input', (e) => { accueil.nom = e.target.value; });
    $('#moi-role')?.addEventListener('input', (e) => { accueil.role = e.target.value; });
    $('#accueil-serie')?.addEventListener('input', (e) => { accueil.serie = e.target.value; });
    $('#form-moi')?.addEventListener('submit', (e) => { e.preventDefault(); accueil.etape = 2; ecranAccueil(); });
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    if (a.nom.trim()) { const p = { id: uid(), nom: a.nom.trim(), role: a.role.trim() }; E.personnes.push(p); E.moi = p.id; }
    const m = modele(a.modele);
    const s = { id: uid(), nom: a.serie.trim() || m?.nom || 'Mes réunions', modeleId: m?.id || null, couleur: m?.couleur || 'rouge', participants: E.moi ? [E.moi] : [] };
    E.series.push(s);
    const r = R.preparerReunion(E, { serieId: s.id, date: auj(), modele: m }, uid);
    E.reunions.push(r);
    reunionId = r.id;
    vue = 'compte-rendu';
    accueil = { etape: 1, nom: '', role: '', modele: null, serie: '' };
    history.replaceState(null, '', '#compte-rendu');
    sauver();
    demarrer();
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    reunions: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    'compte-rendu': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="6" width="10" height="2.5" fill="currentColor"/><rect x="7" y="11" width="10" height="2" fill="currentColor"/><rect x="7" y="15" width="6" height="2" fill="currentColor"/></svg>',
    actions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    personnes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4.5" fill="currentColor"/><path d="M3 22a9 9 0 0 1 18 0Z" fill="currentColor"/></svg>',
    modeles: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['reunions', 'Réunions'], ['compte-rendu', 'Compte rendu'], ['actions', 'Actions'], ['personnes', 'Personnes'], ['modeles', 'Modèles']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Compte rendu<br>et plan d'actions</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
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
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { reunions: 'Réunions', 'compte-rendu': 'Compte rendu', actions: 'Actions', personnes: 'Personnes', modeles: 'Modèles' };
    document.title = `${titres[vue]} · ${NOM_PRODUIT}`;
    $('#vue').innerHTML = { reunions: vueReunions, 'compte-rendu': vueCompteRendu, actions: vueActions, personnes: vuePersonnes, modeles: vueModeles }[vue]();
    document.querySelectorAll('#vue textarea').forEach(ajuster);
    if (vue === 'compte-rendu') apercuSaisie();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function ouvrirReunion(id) {
    reunionId = id;
    changerVue('compte-rendu');
  }

  const ajuster = (el) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 4}px`; };
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, boutons = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${boutons ? `<div class="actions">${boutons}</div>` : ''}</div></div>`;

  // ---------- Action (ligne réutilisée partout) ----------
  const LIB_STATUT = Object.fromEntries(R.STATUTS.map((s) => [s.id, s.nom]));
  function libelleEcheance(a) {
    const t = auj();
    const e = R.etatAction(a, t);
    if (e === 'fait') return a.faitLe ? `Fait ${quand(a.faitLe)}` : 'Fait';
    if (e === 'abandonnee') return 'Abandonnée';
    if (e === 'sansdate') return 'Sans échéance';
    if (e === 'retard') return `En retard · ${pluriel(ecart(a.echeance, t), 'jour')}`;
    if (e === 'aujourdhui') return 'Pour aujourd\'hui';
    return `Pour ${quand(a.echeance)}`;
  }

  function ligneAction(a, { origine = true, qui = true } = {}) {
    const t = auj();
    const etat = R.etatAction(a, t);
    const r = reunion(a.reunionId);
    const suivant = LIB_STATUT[R.STATUT_SUIVANT[a.statut]];
    return `
      <li class="action" data-etat="${etat}" data-statut="${a.statut}" style="--c:${couleurReunion(r)}">
        <button class="statut" data-action="statut" data-id="${a.id}" aria-label="${esc(LIB_STATUT[a.statut])} : passer à « ${esc(suivant)} »" title="${esc(LIB_STATUT[a.statut])} · clic : ${esc(suivant)}"><i></i></button>
        <div class="action-corps">
          <p class="action-texte">${esc(a.texte)}</p>
          <p class="action-meta">${qui ? `<span class="qui">${esc(nomDe(a.responsableId))}</span>` : ''}<span class="ech">${esc(libelleEcheance(a))}</span>${a.statut === 'encours' ? '<span class="etiquette jaune">En cours</span>' : ''}${origine && r ? `<button class="lien-reunion" data-action="ouvrir-reunion" data-id="${r.id}">${esc(r.titre)} · ${esc(dateCourte(r.date))}</button>` : ''}</p>
        </div>
        <button class="action-modifier" data-action="action-modifier" data-id="${a.id}" aria-label="Modifier l'action ${esc(a.texte)}">Modifier</button>
      </li>`;
  }

  // ---------- Vue Réunions ----------
  function vueReunions() {
    const t = auj();
    const carte = (s, liste) => {
      const ids = new Set(liste.map((r) => r.id));
      const acts = E.actions.filter((a) => ids.has(a.reunionId));
      const ouv = acts.filter(R.estOuverte);
      const ret = ouv.filter((a) => R.enRetard(a, t));
      const tri = [...liste].sort((a, b) => b.date.localeCompare(a.date));
      const c = s ? s.couleur : 'encre';
      const m = s ? modele(s.modeleId) : null;
      return `
      <article class="serie" style="--c:${couleurHex(c)};--t:${texteSur(c)}">
        <div class="serie-tete"><div><h2>${esc(s ? s.nom : 'Réunions ponctuelles')}</h2><p>${s ? esc(m ? m.nom : 'Sans modèle') : 'Hors série, sans report d\'actions'}</p></div>${s ? `<button data-action="serie-modifier" data-id="${s.id}">Modifier</button>` : ''}</div>
        <div class="serie-chiffres"><div><b>${liste.length}</b><span>${liste.length > 1 ? 'réunions' : 'réunion'}</span></div><div><b>${ouv.length}</b><span>${ouv.length > 1 ? 'actions ouvertes' : 'action ouverte'}</span></div><div><b class="${ret.length ? 'rouge' : ''}">${ret.length}</b><span>en retard</span></div></div>
        <ul class="reunions-liste">${tri.length ? tri.map((r) => {
          const n = E.actions.filter((a) => a.reunionId === r.id).length;
          const avenir = r.date > t;
          return `<li><button class="reunion-ligne" data-action="ouvrir-reunion" data-id="${r.id}"><span class="date-bloc${avenir ? ' avenir' : ''}"><b>${R.versDate(r.date).getDate()}</b><small>${MOIS_COURTS[R.versDate(r.date).getMonth()]}</small></span><span class="reunion-info"><b>${esc(r.titre)}</b><span>${esc(dateLongue(r.date))}${avenir ? ' · à venir' : ''} · ${n ? pluriel(n, 'action') : 'aucune action'}${r.suivi.length ? ` · ${r.suivi.length} en suivi` : ''}</span></span></button></li>`;
        }).join('') : '<li class="matiere-vide">Aucune réunion pour l\'instant.</li>'}</ul>
        <div class="serie-pied"><button class="btn petit" data-action="reunion-nouvelle" data-serie="${s ? s.id : 'ponctuelle'}">${ICONES.plus}${s ? 'Réunion suivante' : 'Réunion ponctuelle'}</button></div>
      </article>`;
    };
    const ponctuelles = E.reunions.filter((r) => !r.serieId || !serie(r.serieId));
    const cartes = [...E.series.map((s) => carte(s, E.reunions.filter((r) => r.serieId === s.id))), ponctuelles.length ? carte(null, ponctuelles) : ''].join('');
    const prochaine = [...E.reunions].filter((r) => r.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `
      <div class="vue-tete"><div><h1>Réunions</h1><p>Classées par série. Une nouvelle réunion d'une série reprend son ordre du jour, ses participants et les actions encore ouvertes.</p></div>
        <div class="actions"><button class="btn primaire" data-action="reunion-nouvelle">${ICONES.plus}Nouvelle réunion</button></div></div>
      ${prochaine ? `<p class="prochaine">Prochaine réunion : <button class="lien-reunion" data-action="ouvrir-reunion" data-id="${prochaine.id}">${esc(prochaine.titre)}, ${esc(quand(prochaine.date))}</button></p>` : ''}
      ${E.reunions.length || E.series.length ? `<div class="series">${cartes}</div>` : vide('Aucune réunion pour l\'instant', 'Crée ta première réunion : choisis un modèle d\'ordre du jour, ou pars d\'une page blanche.', `<button class="btn primaire" data-action="reunion-nouvelle">${ICONES.plus}Nouvelle réunion</button>`)}`;
  }

  // ---------- Vue Compte rendu ----------
  function vueCompteRendu() {
    let r = reunion(reunionId);
    if (!r) { r = reunionParDefaut(); reunionId = r?.id || null; }
    if (!r) return `<div class="vue-tete"><div><h1>Compte rendu</h1></div></div>${vide('Aucune réunion ouverte', 'Crée une réunion pour prendre des notes, noter les décisions et répartir les actions.', `<button class="btn primaire" data-action="reunion-nouvelle">${ICONES.plus}Nouvelle réunion</button>`)}`;
    const t = auj();
    const s = serie(r.serieId);
    const liste = s ? R.reunionsDeSerie(E, s.id) : [];
    const i = liste.findIndex((x) => x.id === r.id);
    const prec = i > 0 ? liste[i - 1] : null, suiv = i >= 0 && i < liste.length - 1 ? liste[i + 1] : null;
    const suivi = r.suivi.map(action).filter(Boolean);
    const acts = R.trierActions(E.actions.filter((a) => a.reunionId === r.id), t);
    const presents = new Set(r.participants);
    const autres = E.personnes.filter((p) => !presents.has(p.id));
    const c = s ? s.couleur : 'encre';
    return `
      <div class="cr-tete" style="--c:${couleurHex(c)}">
        <div class="cr-nav">
          <p class="surtitre"><i></i>${esc(s ? s.nom : 'Réunion ponctuelle')}${r.date > t ? ' · <span class="etiquette bleu">À venir</span>' : ''}</p>
          ${s ? `<div class="cr-fleches"><button class="btn petit" data-action="ouvrir-reunion" data-id="${prec?.id || ''}" ${prec ? '' : 'disabled'} aria-label="Réunion précédente de la série">‹ Précédente</button><button class="btn petit" data-action="ouvrir-reunion" data-id="${suiv?.id || ''}" ${suiv ? '' : 'disabled'} aria-label="Réunion suivante de la série">Suivante ›</button></div>` : ''}
        </div>
        <h1>${esc(r.titre)}</h1>
        <p class="cr-meta">${esc(dateLongue(r.date))}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</p>
        <div class="actions">
          <button class="btn petit" data-action="reunion-modifier" data-id="${r.id}">Modifier</button>
          <button class="btn petit" data-action="copier" data-id="${r.id}">Copier le texte</button>
          <button class="btn petit" data-action="imprimer" data-id="${r.id}">Imprimer</button>
          ${s ? `<button class="btn petit jaune" data-action="reunion-nouvelle" data-serie="${s.id}">${ICONES.plus}Réunion suivante</button>` : ''}
        </div>
      </div>
      <div class="cr-grille">
        <div class="cr-col">
          <section class="bloc bloc-points">
            <h2 class="bloc-titre">Ordre du jour <span>${pluriel(r.points.length, 'point')}</span></h2>
            <ol class="points-liste">${r.points.map((p, k) => `
              <li class="point">
                <span class="point-num">${k + 1}</span>
                <div class="point-corps">
                  <input class="point-titre" data-maj="point-titre" data-id="${p.id}" value="${esc(p.titre)}" maxlength="120" aria-label="Titre du point ${k + 1}" placeholder="Titre du point">
                  <textarea data-maj="point-notes" data-id="${p.id}" rows="2" aria-label="Notes du point ${k + 1}" placeholder="${esc(p.aide || 'Notes')}">${esc(p.notes)}</textarea>
                </div>
                <button class="suppr" data-action="point-suppr" data-id="${p.id}" aria-label="Retirer le point ${esc(p.titre)}">×</button>
              </li>`).join('')}</ol>
            <form class="ajout-ligne" data-form="point"><input name="texte" maxlength="120" placeholder="Ajouter un point à l'ordre du jour" aria-label="Nouveau point"><button class="btn petit">Ajouter</button></form>
          </section>
          <section class="bloc">
            <h2 class="bloc-titre">Décisions <span>${r.decisions.length ? pluriel(r.decisions.length, 'décision') : ''}</span></h2>
            ${r.decisions.length ? `<ul class="decisions">${r.decisions.map((d) => `<li><i></i><span>${esc(d.texte)}</span><button class="suppr" data-action="decision-suppr" data-id="${d.id}" aria-label="Retirer la décision">×</button></li>`).join('')}</ul>` : '<p class="bloc-vide">Aucune décision notée.</p>'}
            <form class="ajout-ligne" data-form="decision"><input name="texte" maxlength="300" placeholder="Ex. : la mise en ligne est décalée d'une semaine" aria-label="Nouvelle décision"><button class="btn petit">Ajouter</button></form>
          </section>
        </div>
        <div class="cr-col">
          <section class="bloc bloc-participants">
            <h2 class="bloc-titre">Participants <span>${pluriel(presents.size, 'présent')}</span></h2>
            <div class="puces">${E.personnes.filter((p) => presents.has(p.id)).concat(autres).map((p) => `<button class="puce" data-action="participant" data-id="${p.id}" aria-pressed="${presents.has(p.id)}">${esc(p.nom)}</button>`).join('')}<button class="puce ajout" data-action="personne-nouvelle" data-reunion="${r.id}">${ICONES.plus}Personne</button></div>
          </section>
          ${suivi.length ? `<section class="bloc bloc-suivi">
            <h2 class="bloc-titre">Suivi des actions <span>${suivi.filter(R.estOuverte).length} encore ouvertes sur ${suivi.length}</span></h2>
            <p class="bloc-aide">Reprises des réunions précédentes de la série. Coche ce qui est fait.</p>
            <ul class="actions-liste">${R.trierActions(suivi, t).map((a) => ligneAction(a)).join('')}</ul>
          </section>` : ''}
          <section class="bloc bloc-actions">
            <h2 class="bloc-titre">Actions décidées <span>${acts.length ? pluriel(acts.length, 'action') : ''}</span></h2>
            <form class="saisie-rapide" data-form="action-rapide">
              <label class="champ" for="saisie-action">Nouvelle action <small>Responsable, deux-points, quoi, échéance. Une action par ligne.</small></label>
              <div class="saisie-ligne"><textarea id="saisie-action" name="texte" rows="1" maxlength="1000" placeholder="Marie : envoyer le devis avant vendredi"></textarea><button class="btn primaire">Ajouter</button></div>
              <div class="apercu" id="apercu" aria-live="polite"></div>
            </form>
            ${acts.length ? `<ul class="actions-liste">${acts.map((a) => ligneAction(a, { origine: false })).join('')}</ul>` : '<p class="bloc-vide">Aucune action pour l\'instant. Exemples : « Thomas : corriger le bug demain », « moi : appeler le client J+7 », « Inès et Hugo : préparer le stand fin du mois ».</p>'}
          </section>
        </div>
      </div>
      <p class="cr-pied"><button class="btn lien danger-lien" data-action="reunion-suppr" data-id="${r.id}">Supprimer cette réunion</button></p>`;
  }

  // Aperçu de la saisie rapide : ce que l'application a compris, avant d'ajouter.
  function apercuSaisie() {
    const champ = $('#saisie-action'), zone = $('#apercu');
    if (!champ || !zone) return;
    const lignes = champ.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lignes.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = lignes.slice(0, 5).map((l) => {
      const p = R.analyserAction(l, auj(), E.personnes);
      const qui = p.responsables.length ? p.responsables.map((n) => {
        const id = resoudre(n, false);
        return id ? esc(nomDe(id)) : `${esc(n)} <small>(nouvelle personne)</small>`;
      }).join(', ') : 'Sans responsable';
      return `<p><span><em>Qui</em>${qui}</span><span><em>Quoi</em>${esc(p.quoi) || '…'}</span><span><em>Pour</em>${p.echeance ? esc(dateCourte(p.echeance)) : 'sans échéance'}</span></p>`;
    }).join('');
  }

  // Nom saisi → id de personne (« moi » = toi). Crée la personne si demandé et inconnue.
  function resoudre(nom, creer) {
    if (/^(moi|je)$/i.test(nom.trim())) return E.moi || null;
    const p = R.trouverPersonne(nom, E.personnes);
    if (p) return p.id;
    if (!creer) return null;
    const nouv = { id: uid(), nom: nom.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase()), role: '' };
    E.personnes.push(nouv);
    return nouv.id;
  }

  function ajouterActionsRapides(texte, rid) {
    const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lignes.length) return 0;
    annulation = structuredClone(E);
    const avant = E.personnes.length;
    let n = 0;
    for (const l of lignes) {
      const p = R.analyserAction(l, auj(), E.personnes);
      if (!p.quoi) continue;
      const qui = p.responsables.length ? p.responsables.map((x) => resoudre(x, true)) : [null];
      for (const id of qui) { E.actions.push({ id: uid(), reunionId: rid, responsableId: id, texte: p.quoi, echeance: p.echeance, statut: 'afaire', creeLe: auj(), faitLe: null }); n++; }
    }
    const nouveaux = E.personnes.slice(avant).map((p) => p.nom);
    sauver(); rendre();
    $('#saisie-action')?.focus();
    toast(`${n > 1 ? `${n} actions ajoutées` : n ? 'Action ajoutée' : 'Rien à ajouter'}${nouveaux.length ? ` · ajouté au carnet : ${nouveaux.join(', ')}` : ''}.`, n ? { libelle: 'Annuler', faire: annuler } : null);
    return n;
  }

  // ---------- Vue Actions ----------
  function vueActions() {
    const t = auj();
    const ouv = ouvertes();
    const tuiles = [
      ['Ouvertes', ouv.length, 'À faire ou en cours, toutes réunions.', 'var(--encre)', 'rond'],
      ['En retard', ouv.filter((a) => R.enRetard(a, t)).length, 'Échéance dépassée.', 'var(--rouge)', ''],
      ['7 prochains jours', ouv.filter((a) => a.echeance && a.echeance >= t && a.echeance <= ajout(t, 7)).length, 'Échéance d\'ici une semaine.', 'var(--jaune)', ''],
      ['Faites · 30 jours', E.actions.filter((a) => a.statut === 'fait' && a.faitLe && a.faitLe >= ajout(t, -29)).length, 'Clôturées sur les 30 derniers jours.', 'var(--bleu)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const FILTRES = [['ouvertes', 'Ouvertes'], ['miennes', 'Mes actions'], ['retard', 'En retard'], ['closes', 'Terminées']];
    let liste = E.actions;
    if (filtre === 'ouvertes') liste = ouv;
    if (filtre === 'miennes') liste = E.actions.filter((a) => a.responsableId && a.responsableId === E.moi && (R.estOuverte(a) || (a.faitLe && a.faitLe >= ajout(t, -7))));
    if (filtre === 'retard') liste = ouv.filter((a) => R.enRetard(a, t));
    if (filtre === 'closes') liste = E.actions.filter((a) => !R.estOuverte(a));
    // Regroupement par responsable, les plus chargés en retard d'abord.
    const groupes = new Map();
    for (const a of liste) { const k = a.responsableId && personne(a.responsableId) ? a.responsableId : ''; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(a); }
    const ordre = [...groupes.entries()].sort(([ka, la], [kb, lb]) => {
      const ra = la.filter((a) => R.enRetard(a, t)).length, rb = lb.filter((a) => R.enRetard(a, t)).length;
      if (ka === E.moi && filtre !== 'miennes') return -1;
      if (kb === E.moi && filtre !== 'miennes') return 1;
      return rb - ra || nomDe(ka).localeCompare(nomDe(kb), 'fr');
    });
    const vides = {
      ouvertes: ['Aucune action ouverte', 'Tout est fait. Les actions se créent depuis un compte rendu, ou ici avec « Nouvelle action ».'],
      miennes: E.moi ? ['Rien à faire pour toi', 'Aucune action ouverte à ton nom.'] : ['Qui es-tu ?', 'Indique ton nom dans Personnes (« C\'est moi ») pour retrouver tes actions ici.'],
      retard: ['Aucun retard', 'Toutes les actions ouvertes sont dans les temps.'],
      closes: ['Aucune action terminée', 'Les actions faites ou abandonnées s\'afficheront ici.'],
    }[filtre];
    return `
      <div class="vue-tete"><div><h1>Actions</h1><p>Toutes les actions de toutes les réunions, par personne. Un clic sur la case fait avancer le statut : à faire, en cours, fait.</p></div>
        <div class="actions"><button class="btn primaire" data-action="action-nouvelle">${ICONES.plus}Nouvelle action</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="filtres" role="group" aria-label="Filtrer les actions">${FILTRES.map(([id, nom]) => `<button class="filtre" data-action="filtre" data-id="${id}" aria-pressed="${filtre === id}">${nom}</button>`).join('')}</div>
      ${liste.length ? ordre.map(([k, l]) => {
        const p = personne(k);
        const r = l.filter((a) => R.enRetard(a, t)).length;
        return `<section class="groupe-personne"><h2><span class="avatar">${esc((p?.nom || '?').slice(0, 1))}</span><span class="gp-nom"><span>${esc(p ? p.nom : 'Sans responsable')}${k && k === E.moi ? ' <span class="etiquette">Moi</span>' : ''}</span><small>${esc(p?.role || '')}</small></span><span class="gp-nb">${pluriel(l.length, 'action')}${r ? ` · <b>${r} en retard</b>` : ''}</span></h2><ul class="actions-liste">${R.trierActions(l, t).map((a) => ligneAction(a, { qui: false })).join('')}</ul></section>`;
      }).join('') : vide(vides[0], vides[1], filtre === 'miennes' && !E.moi ? '<button class="btn" data-action="vue" data-vue="personnes">Ouvrir Personnes</button>' : '')}`;
  }

  // ---------- Vue Personnes ----------
  function vuePersonnes() {
    const t = auj();
    const lignes = [...E.personnes].sort((a, b) => (b.id === E.moi) - (a.id === E.moi) || a.nom.localeCompare(b.nom, 'fr')).map((p) => {
      const acts = E.actions.filter((a) => a.responsableId === p.id);
      const ouv = acts.filter(R.estOuverte);
      const ret = ouv.filter((a) => R.enRetard(a, t)).length;
      const nbR = E.reunions.filter((r) => r.participants.includes(p.id)).length;
      return `<li><button class="personne" data-action="personne-modifier" data-id="${p.id}"><span class="avatar">${esc(p.nom.slice(0, 1))}</span><span class="personne-nom"><b>${esc(p.nom)}${p.id === E.moi ? ' <span class="etiquette">Moi</span>' : ''}</b><span>${esc(p.role || 'Rôle non précisé')}</span></span><span class="personne-chiffres"><span><b>${ouv.length}</b> ouvertes</span><span class="${ret ? 'rouge' : ''}"><b>${ret}</b> en retard</span><span><b>${nbR}</b> réunions</span></span></button></li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Personnes</h1><p>Le carnet des participants : un nom et un rôle suffisent. Les personnes nommées dans la saisie rapide y sont ajoutées automatiquement.</p></div>
        <div class="actions"><button class="btn primaire" data-action="personne-nouvelle">${ICONES.plus}Personne</button></div></div>
      ${E.personnes.length ? `<ul class="personnes">${lignes}</ul>` : vide('Carnet vide', 'Ajoute les personnes qui participent à tes réunions, ou tape simplement « Marie : … » dans un compte rendu.', `<button class="btn primaire" data-action="personne-nouvelle">${ICONES.plus}Personne</button>`)}
      <p class="aide rgpd"><b>Données personnelles.</b> Ne note que ce qui est utile au suivi : nom, rôle, actions. Évite les informations sensibles (santé, vie privée) dans les notes. Les personnes citées peuvent te demander ce qui les concerne ; tu peux tout exporter ou supprimer depuis les réglages.</p>`;
  }

  // ---------- Vue Modèles ----------
  function vueModeles() {
    return `
      <div class="vue-tete"><div><h1>Modèles</h1><p>${B.modeles.length} ordres du jour types. Chaque point a une aide qui rappelle quoi noter ; tout reste modifiable dans le compte rendu.</p></div></div>
      <div class="modeles">${B.modeles.map((m) => `
        <article class="modele" style="--c:${couleurHex(m.couleur)};--t:${texteSur(m.couleur)}">
          <div class="modele-tete"><h2>${esc(m.nom)}</h2><span>${esc(m.duree)}</span></div>
          <p class="modele-desc">${esc(m.description)}</p>
          <p class="modele-freq">${esc(m.frequence)}</p>
          <ol>${m.points.map((p) => `<li><b>${esc(p.titre)}</b>${p.aide ? `<span>${esc(p.aide)}</span>` : ''}</li>`).join('')}</ol>
          <div class="modele-pied"><button class="btn petit" data-action="reunion-nouvelle" data-modele="${m.id}">${ICONES.plus}Utiliser ce modèle</button></div>
        </article>`).join('')}</div>`;
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
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const optionsModeles = (choix) => `<option value="">Sans modèle (ordre du jour libre)</option>${B.modeles.map((m) => `<option value="${m.id}" ${m.id === choix ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}`;
  const pastilles = (choix) => `<fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === choix ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>`;

  // Nouvelle réunion : dans une série existante, une nouvelle série, ou ponctuelle.
  function modaleReunion({ serieId, modeleId } = {}) {
    const t = auj();
    const choix = serieId || (modeleId ? 'nouvelle' : (E.series[0]?.id || 'nouvelle'));
    const utilisees = new Set(E.series.map((s) => s.couleur));
    const coul = modele(modeleId)?.couleur && !utilisees.has(modele(modeleId).couleur) ? modele(modeleId).couleur : (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[0]).id;
    const prochaineDate = (sid) => { const der = R.reunionsDeSerie(E, sid).at(-1); return der && der.date >= t ? ajout(der.date, 7) : t; };
    const corps = `
      <label class="champ">Série<select name="serie" id="choix-serie">
        ${E.series.map((s) => `<option value="${s.id}" ${s.id === choix ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}
        <option value="nouvelle" ${choix === 'nouvelle' ? 'selected' : ''}>Nouvelle série…</option>
        <option value="ponctuelle" ${choix === 'ponctuelle' ? 'selected' : ''}>Réunion ponctuelle (hors série)</option>
      </select></label>
      <div class="groupe-nouvelle" ${choix === 'nouvelle' ? '' : 'hidden'}>
        <label class="champ">Nom de la série<input name="nomSerie" maxlength="80" placeholder="Ex. : Point d'équipe du lundi" value="${esc(modele(modeleId)?.nom || '')}"></label>
        ${pastilles(coul)}
      </div>
      <label class="champ groupe-modele" ${choix === 'nouvelle' || choix === 'ponctuelle' ? '' : 'hidden'}>Modèle d'ordre du jour<select name="modele">${optionsModeles(modeleId || '')}</select></label>
      <label class="champ groupe-titre" ${choix === 'ponctuelle' ? '' : 'hidden'}>Titre<input name="titre" maxlength="100" placeholder="Ex. : Rétrospective du sprint 12"></label>
      <label class="champ">Date<input type="date" name="date" id="date-reunion" value="${choix !== 'nouvelle' && choix !== 'ponctuelle' ? prochaineDate(choix) : t}" required></label>
      <p class="aide" id="aide-reunion"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle réunion', corps, '<button class="btn primaire" value="ok">Créer la réunion</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date');
      if (!date) return 'Indique la date de la réunion.';
      let sid = f.get('serie');
      let m = modele(f.get('modele'));
      let titre = '';
      if (sid === 'nouvelle') {
        const nom = String(f.get('nomSerie') || '').trim();
        if (!nom) return 'Donne un nom à la série.';
        const s = { id: uid(), nom, modeleId: m?.id || null, couleur: f.get('couleur') || 'rouge', participants: E.moi ? [E.moi] : [] };
        E.series.push(s);
        sid = s.id;
      } else if (sid === 'ponctuelle') {
        sid = null;
        titre = String(f.get('titre') || '').trim();
      } else m = modele(serie(sid)?.modeleId);
      const r = R.preparerReunion(E, { serieId: sid, date, titre, modele: m }, uid);
      if (!r.participants.length && E.moi) r.participants = [E.moi];
      E.reunions.push(r);
      sauver();
      ouvrirReunion(r.id);
      toast(r.suivi.length ? `Réunion créée : ${pluriel(r.suivi.length, 'action ouverte reprise', 'actions ouvertes reprises')} en suivi.` : 'Réunion créée.');
    });
    const sel = $('#choix-serie');
    const maj = () => {
      const v = sel.value;
      $('.groupe-nouvelle').hidden = v !== 'nouvelle';
      $('.groupe-modele').hidden = !(v === 'nouvelle' || v === 'ponctuelle');
      $('.groupe-titre').hidden = v !== 'ponctuelle';
      const aide = $('#aide-reunion');
      if (v !== 'nouvelle' && v !== 'ponctuelle') {
        const n = R.actionsAReprendre(E, v, $('#date-reunion').value || t).length;
        const m = modele(serie(v)?.modeleId);
        aide.textContent = `${m ? `Ordre du jour du modèle « ${m.nom} »` : 'Ordre du jour de la réunion précédente'}, mêmes participants${n ? `, ${pluriel(n, 'action ouverte reprise', 'actions ouvertes reprises')} en suivi` : ''}.`;
        aide.hidden = false;
      } else if (v === 'nouvelle') { aide.textContent = 'Les réunions suivantes de la série reprendront l\'ordre du jour, les participants et les actions encore ouvertes.'; aide.hidden = false; }
      else aide.hidden = true;
    };
    sel.addEventListener('change', () => { if (sel.value !== 'nouvelle' && sel.value !== 'ponctuelle') $('#date-reunion').value = prochaineDate(sel.value); maj(); });
    $('#date-reunion').addEventListener('change', maj);
    maj();
  }

  function modaleModifierReunion(id) {
    const r = reunion(id);
    const corps = `
      <label class="champ">Titre<input name="titre" required maxlength="100" value="${esc(r.titre)}"></label>
      <label class="champ">Date<input type="date" name="date" value="${r.date}" required></label>
      <label class="champ">Lieu <small>Facultatif : salle, visio, adresse du chantier…</small><input name="lieu" maxlength="100" value="${esc(r.lieu)}"></label>
      <label class="champ">Série<select name="serie">${E.series.map((s) => `<option value="${s.id}" ${s.id === r.serieId ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}<option value="" ${r.serieId ? '' : 'selected'}>Réunion ponctuelle</option></select></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Modifier la réunion', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique un titre.';
      if (!f.get('date')) return 'Indique la date.';
      Object.assign(r, { titre, date: f.get('date'), lieu: String(f.get('lieu') || '').trim(), serieId: f.get('serie') || null });
      sauver(); rendre(); toast('Réunion enregistrée.');
    });
  }

  function supprimerReunion(id) {
    const r = reunion(id);
    if (!r) return;
    annulation = structuredClone(E);
    const n = E.actions.filter((a) => a.reunionId === id).length;
    E.reunions = E.reunions.filter((x) => x.id !== id);
    E.actions = E.actions.filter((a) => a.reunionId !== id);
    E.reunions.forEach((x) => { x.suivi = x.suivi.filter((aid) => action(aid)); });
    reunionId = null;
    sauver();
    changerVue('reunions');
    toast(`« ${r.titre} » supprimée${n ? ` avec ${pluriel(n, 'action')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleSerie(id) {
    const s = serie(id);
    const nb = E.reunions.filter((r) => r.serieId === id).length;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(s.nom)}"></label>
      <label class="champ">Modèle d'ordre du jour <small>Utilisé pour les prochaines réunions de la série.</small><select name="modele">${optionsModeles(s.modeleId || '')}</select></label>
      ${pastilles(s.couleur)}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Modifier la série', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer la série</button>', (f, act) => {
      if (act === 'supprimer') {
        annulation = structuredClone(E);
        E.series = E.series.filter((x) => x.id !== id);
        E.reunions.forEach((r) => { if (r.serieId === id) r.serieId = null; });
        sauver(); rendre();
        toast(`Série supprimée${nb ? ` : ses ${pluriel(nb, 'réunion')} deviennent ponctuelles` : ''}.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la série.';
      Object.assign(s, { nom, modeleId: f.get('modele') || null, couleur: f.get('couleur') || s.couleur });
      sauver(); rendre(); toast('Série enregistrée.');
    });
  }

  function modaleAction(id, rid) {
    const a = id ? action(id) : null;
    const t = auj();
    const reunions = [...E.reunions].sort((x, y) => y.date.localeCompare(x.date));
    const choixR = a ? a.reunionId : rid || reunionParDefaut()?.id || '';
    const corps = `
      <label class="champ">Action<textarea name="texte" required maxlength="300" rows="2">${esc(a?.texte || '')}</textarea></label>
      <label class="champ">Responsable<select name="responsable"><option value="">Sans responsable</option>${E.personnes.map((p) => `<option value="${p.id}" ${p.id === (a ? a.responsableId : E.moi) ? 'selected' : ''}>${esc(p.nom)}${p.id === E.moi ? ' (moi)' : ''}</option>`).join('')}</select></label>
      <label class="champ">Échéance <small>Facultative.</small><input type="date" name="echeance" value="${a?.echeance || ''}"></label>
      <fieldset class="champ statuts" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Statut</legend><div class="segments">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s.id}" ${s.id === (a?.statut || 'afaire') ? 'checked' : ''}><span>${s.nom}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Réunion d'origine<select name="reunion"><option value="">Hors réunion</option>${reunions.map((r) => `<option value="${r.id}" ${r.id === choixR ? 'selected' : ''}>${esc(r.titre)} · ${esc(dateCourte(r.date))}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    const pied = a ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'action' : 'Nouvelle action', corps, pied, (f, act) => {
      if (act === 'supprimer') {
        annulation = structuredClone(E);
        E.actions = E.actions.filter((x) => x.id !== a.id);
        E.reunions.forEach((r) => { r.suivi = r.suivi.filter((x) => x !== a.id); });
        sauver(); rendre(); toast('Action supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const texte = String(f.get('texte') || '').replace(/\s+/g, ' ').trim();
      if (!texte) return 'Décris l\'action.';
      annulation = structuredClone(E);
      const cible = a || { id: uid(), creeLe: t, faitLe: null };
      Object.assign(cible, { texte, responsableId: f.get('responsable') || null, echeance: f.get('echeance') || null, reunionId: f.get('reunion') || null });
      R.changerStatut(cible, f.get('statut') || 'afaire', t);
      if (!a) E.actions.push(cible);
      sauver(); rendre(); toast(a ? 'Action enregistrée.' : 'Action ajoutée.');
    });
  }

  function modalePersonne(id, rid) {
    const p = id ? personne(id) : null;
    const nb = p ? E.actions.filter((a) => a.responsableId === p.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(p?.nom || '')}" placeholder="Ex. : Marie Lefèvre"></label>
      <label class="champ">Rôle <small>Facultatif : fonction, service, entreprise.</small><input name="role" maxlength="60" value="${esc(p?.role || '')}"></label>
      <label class="case"><input type="checkbox" name="moi" ${p && p.id === E.moi ? 'checked' : ''}> C'est moi (pour le filtre « Mes actions » et la saisie « moi : … »)</label>
      ${rid ? '<p class="aide">La personne est ajoutée aux participants de la réunion.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier la personne' : 'Nouvelle personne', corps, pied, (f, act) => {
      if (act === 'supprimer') {
        annulation = structuredClone(E);
        E.personnes = E.personnes.filter((x) => x.id !== p.id);
        E.actions.forEach((a) => { if (a.responsableId === p.id) a.responsableId = null; });
        E.reunions.forEach((r) => { r.participants = r.participants.filter((x) => x !== p.id); });
        E.series.forEach((s) => { s.participants = (s.participants || []).filter((x) => x !== p.id); });
        if (E.moi === p.id) E.moi = null;
        sauver(); rendre();
        toast(`${p.nom} retiré du carnet${nb ? ` ; ${pluriel(nb, 'action passe', 'actions passent')} sans responsable` : ''}.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      const doublon = E.personnes.find((x) => x.id !== p?.id && R.plat(x.nom) === R.plat(nom));
      if (doublon) return `${doublon.nom} est déjà dans le carnet.`;
      const cible = p || { id: uid() };
      Object.assign(cible, { nom, role: String(f.get('role') || '').trim() });
      if (!p) E.personnes.push(cible);
      if (f.get('moi')) E.moi = cible.id; else if (E.moi === cible.id) E.moi = null;
      if (rid) { const r = reunion(rid); if (r && !r.participants.includes(cible.id)) r.participants.push(cible.id); }
      sauver(); rendre(); toast(p ? 'Personne enregistrée.' : `${nom} ajouté au carnet.`);
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Qui es-tu ? <small>Pour « Mes actions » et la saisie « moi : … ».</small><select name="moi"><option value="">Non précisé</option>${E.personnes.map((p) => `<option value="${p.id}" ${p.id === E.moi ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      <div class="groupe"><h3>Saisie rapide d'une action</h3><p class="aide">« Responsable : quoi échéance ». Échéances comprises : aujourd'hui, demain, après-demain, lundi… dimanche, fin de semaine, semaine prochaine, fin du mois, J+7, dans 3 jours, dans 2 semaines, 20/11, 20 novembre. Plusieurs responsables : « Marie et Paul : … ».</p></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.moi = f.get('moi') || null;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.reunions) || !Array.isArray(d.actions)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.reunions.length, 'réunion')}, ${pluriel(d.actions.length, 'action')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        reunionId = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide des comptes rendus.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `comptes-rendus-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Partage : texte à copier, impression A4 (aucun lien vers une application externe) ----------
  async function copier(id) {
    const texte = R.texteCompteRendu(E, reunion(id), auj());
    try { await navigator.clipboard.writeText(texte); toast('Compte rendu copié : colle-le dans ton e-mail.'); }
    catch {
      ouvrirModale('Copier le compte rendu', `<label class="champ">Sélectionne le texte puis copie-le<textarea id="texte-cr" rows="12" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>');
      $('#texte-cr').select();
    }
  }


  function imprimer(id) {
    const r = reunion(id);
    const t = auj();
    const s = serie(r.serieId);
    const presents = r.participants.map(personne).filter(Boolean);
    const suivi = R.trierActions(r.suivi.map(action).filter(Boolean), t);
    const acts = R.trierActions(E.actions.filter((a) => a.reunionId === r.id), t);
    const tab = (liste, statut) => `<table><thead><tr>${statut ? '<th>Statut</th>' : ''}<th>Responsable</th><th>Action</th><th>Échéance</th></tr></thead><tbody>${liste.map((a) => `<tr>${statut ? `<td>${esc(LIB_STATUT[a.statut])}</td>` : ''}<td>${esc(nomDe(a.responsableId))}</td><td>${esc(a.texte)}</td><td>${a.echeance ? esc(dateCourte(a.echeance)) : '–'}${R.enRetard(a, t) ? ' (retard)' : ''}</td></tr>`).join('')}</tbody></table>`;
    $('#impression').innerHTML = `
      <header><p>${esc(s ? s.nom : 'Réunion ponctuelle')}</p><h1>${esc(r.titre)}</h1><p>${esc(dateLongue(r.date))}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</p></header>
      ${presents.length ? `<p><b>Participants :</b> ${presents.map((p) => esc(p.role ? `${p.nom} (${p.role})` : p.nom)).join(', ')}</p>` : ''}
      ${suivi.length ? `<h2>Suivi des actions</h2>${tab(suivi, true)}` : ''}
      <h2>Ordre du jour</h2><ol>${r.points.map((p) => `<li><b>${esc(p.titre)}</b>${p.notes ? `<p>${esc(p.notes).replace(/\n/g, '<br>')}</p>` : ''}</li>`).join('')}</ol>
      ${r.decisions.length ? `<h2>Décisions</h2><ul>${r.decisions.map((d) => `<li>${esc(d.texte)}</li>`).join('')}</ul>` : ''}
      ${acts.length ? `<h2>Actions</h2>${tab(acts, true)}` : ''}
      <footer>Compte rendu établi le ${esc(dateLongue(t))}</footer>`;
    window.print();
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

  // ---------- Toast ----------
  let minuterieToast = null;
  function toast(texte, act) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${act ? `<button type="button">${esc(act.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (act) el.querySelector('button').onclick = () => { el.hidden = true; act.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, act ? 7000 : 4000);
  }

  function annuler() {
    if (!annulation) return;
    E = annulation;
    annulation = null;
    sauver(); rendre();
  }

  // ---------- Événements ----------
  function changerStatutAction(id) {
    const a = action(id);
    if (!a) return;
    annulation = structuredClone(E);
    R.changerStatut(a, R.STATUT_SUIVANT[a.statut], auj());
    sauver(); rendre();
    toast(`« ${a.texte} » : ${LIB_STATUT[a.statut].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    const r = E ? reunion(reunionId) : null;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-modele': {
        const ancien = modele(accueil.modele)?.nom || '';
        accueil.modele = id;
        if (!accueil.serie || accueil.serie === ancien) accueil.serie = modele(id)?.nom || '';
        ecranAccueil(); break;
      }
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'filtre': filtre = id; rendre(); break;
      case 'ouvrir-reunion': if (id) ouvrirReunion(id); break;
      case 'reunion-nouvelle': modaleReunion({ serieId: el.dataset.serie, modeleId: el.dataset.modele }); break;
      case 'reunion-modifier': modaleModifierReunion(id); break;
      case 'reunion-suppr': supprimerReunion(id); break;
      case 'serie-modifier': modaleSerie(id); break;
      case 'statut': changerStatutAction(id); break;
      case 'action-modifier': modaleAction(id); break;
      case 'action-nouvelle': modaleAction(null); break;
      case 'personne-nouvelle': modalePersonne(null, el.dataset.reunion); break;
      case 'personne-modifier': modalePersonne(id); break;
      case 'participant': if (r) { r.participants = r.participants.includes(id) ? r.participants.filter((x) => x !== id) : [...r.participants, id]; sauver(); rendre(); } break;
      case 'point-suppr': if (r) { annulation = structuredClone(E); const p = r.points.find((x) => x.id === id); r.points = r.points.filter((x) => x.id !== id); sauver(); rendre(); toast(`Point « ${p?.titre || ''} » retiré.`, { libelle: 'Annuler', faire: annuler }); } break;
      case 'decision-suppr': if (r) { annulation = structuredClone(E); r.decisions = r.decisions.filter((x) => x.id !== id); sauver(); rendre(); toast('Décision retirée.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'copier': copier(id); break;
      case 'imprimer': imprimer(id); break;
      default: break;
    }
  });

  // Saisie dans le compte rendu : enregistrée au fil de l'eau, sans redessiner (le curseur reste en place).
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'saisie-action') { ajuster(el); apercuSaisie(); return; }
    const champ = el.dataset?.maj;
    if (!champ || !E) return;
    const r = reunion(reunionId);
    const p = r?.points.find((x) => x.id === el.dataset.id);
    if (!p) return;
    if (champ === 'point-titre') p.titre = el.value;
    if (champ === 'point-notes') { p.notes = el.value; ajuster(el); }
    sauver();
  });

  // Entrée valide la saisie rapide ; Maj + Entrée passe à la ligne (plusieurs actions d'un coup).
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'saisie-action' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const r = E ? reunion(reunionId) : null;
    if (!r) return;
    const texte = String(new FormData(f).get('texte') || '').trim();
    const sorte = f.dataset.form;
    if (!texte) { f.querySelector('input,textarea')?.focus(); return; }
    if (sorte === 'action-rapide') { ajouterActionsRapides(texte, r.id); return; }
    if (sorte === 'point') r.points.push({ id: uid(), titre: texte.slice(0, 120), aide: '', notes: '' });
    if (sorte === 'decision') r.decisions.push({ id: uid(), texte: texte.slice(0, 300) });
    sauver(); rendre();
    $(`form[data-form="${sorte}"] input`)?.focus();
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

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
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
      if (statut === 401 || statut === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
      if (statut !== 200) throw new Error();
      // Clé d'un autre template : refusée aussi à la reconnexion automatique.
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
  window.__compteRendu = { etat: () => E };
  init();
})();
