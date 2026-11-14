// Revue hebdomadaire et journal de bord QME : revue guidée en 7 étapes chaque semaine (le jour choisi),
// journal d'une ligne par jour avec humeur facultative, priorités de la semaine, rendez-vous et échéances,
// historique avec recherche, tendance (semaines tenues, série, humeur), export texte. Données synchronisées
// par clé de licence. Aucune notification, aucune connexion à une autre application.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RVH;
  const API = '/api/templates';
  const PRODUIT = 'RVH';
  const CLE_CODE = 'qme-rvh-code';
  const CLE_CACHE = 'qme-rvh-cache';
  const CLE_DEMO = 'qme-rvh-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rvh-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'long' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const nb = R.nombreTexte;
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const nomJour = (s) => B.jours[R.jourSemaine(s)];
  const semCourte = (c) => `du ${fmt(R.lundiDeCle(c))} au ${fmt(R.dimancheDeCle(c))}`;
  const LIB_PRIO = { faite: 'Faite', partielle: 'En partie', non: 'Pas faite' };
  const libHumeur = (n) => (n ? B.humeurs[Math.round(n)] : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  let moisVue = auj().slice(0, 7);
  let recherche = '';
  let annulation = null;

  const etatVide = () => R.normaliserEtat(null, auj());
  const normaliser = (d) => R.normaliserEtat(d, auj());

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
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
        toast('Un autre appareil a modifié ton journal entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open && !saisieEnCours()) rendre();
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
  // Code interne (RVH-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Personne fictive (« Alex », cadre). Onze semaines d'historique relatives à aujourd'hui : revues faites
  // chaque vendredi sauf une semaine sautée (série cassée puis reprise), journal tenu la plupart des jours
  // avec humeur, priorités dans tous les états, rendez-vous à venir et une échéance passée non cochée.
  // La revue de la semaine en cours reste à faire : le rappel s'affiche à partir du vendredi.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const cur = R.cleSemaine(t);
    e.prenom = 'Alex';
    e.jourRevue = 5;
    e.creeLe = R.lundiDeCle(R.semaineSuivante(cur, -10));
    const alea = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const LIGNES = [
      'Atelier de lancement avec l\'équipe projet, bonne énergie.', 'Journée de réunions, peu avancé sur le dossier de fond.', 'Deux heures de concentration le matin : plan du rapport bouclé.',
      'Point difficile avec un fournisseur, à reprendre lundi.', 'Course à pied le midi, après-midi plus productive.', 'Beaucoup d\'interruptions, rien de terminé.',
      'Présentation au comité de direction : questions utiles.', 'Déjeuner avec une ancienne collègue, bonnes idées.', 'Boîte de réception vidée, enfin.',
      'Fatigué(e), journée courte.', 'Entretien individuel avec un membre de l\'équipe.', 'Devis envoyé au client Atelier Exemple.',
      'Formation en ligne d\'une heure, notes prises.', 'Soirée sans écran, bien dormi.', 'Réunion annulée : temps récupéré pour le budget.',
      'Visite d\'un site client, long trajet.', 'Bonne discussion sur l\'organisation de l\'équipe.', 'Relances faites, trois réponses reçues.',
      'Journée à la maison, travail de fond.', 'Problème informatique, une heure perdue.', 'Week-end en famille, vraie coupure.',
    ];
    // Journal : de la création à hier (et aujourd'hui une fois sur deux), environ 4 jours sur 5.
    const courbe = [3, 3, 4, 4, 3, 2, 3, 4, 4, 5, 4];
    for (let d = e.creeLe, i = 0; d <= t; d = ajout(d, 1), i++) {
      if (d === t && alea(i) < 0.5) continue;
      if (alea(i + 100) < 0.2) continue;
      const k = R.ecartSemaines(R.cleSemaine(e.creeLe), R.cleSemaine(d));
      const h = Math.max(1, Math.min(5, (courbe[k] ?? 4) + (alea(i + 7) < 0.25 ? -1 : alea(i + 9) < 0.2 ? 1 : 0)));
      R.ecrireJournal(e, d, { texte: LIGNES[(i * 8) % LIGNES.length], humeur: alea(i + 5) < 0.12 ? null : h });
    }
    const PRIOS = [
      ['Finaliser le plan du rapport annuel', 'Préparer l\'entretien avec la direction', 'Bloquer deux matinées sans réunion'],
      ['Envoyer la proposition au client Atelier Exemple', 'Faire le point budget avec la comptabilité', 'Trois séances de sport'],
      ['Recruter un stagiaire : trier les candidatures', 'Clore le dossier fournisseur', 'Dîner avec des amis'],
      ['Rédiger la note de cadrage du projet', 'Former la nouvelle recrue à l\'outil', 'Ranger le bureau et les fichiers'],
      ['Présenter le budget au comité', 'Relancer les trois devis en attente', 'Une soirée sans écran'],
      ['Préparer le séminaire d\'équipe', 'Mettre à jour le planning du trimestre', 'Appeler mes parents'],
      ['Boucler les entretiens individuels', 'Lire le rapport d\'audit', 'Marcher à midi trois fois'],
      ['Lancer la consultation des prestataires', 'Écrire le compte rendu du séminaire', 'Réserver les vacances d\'hiver'],
      ['Valider le cahier des charges', 'Déléguer le suivi des factures', 'Finir le livre commencé'],
      ['Préparer la revue de projet de fin de mois', 'Faire le tri de la boîte de réception', 'Deux séances de sport'],
    ];
    const REUSSITES = ['Rapport livré dans les temps', 'Bonne réunion d\'équipe', 'Client satisfait de la proposition', 'Deux matinées de travail de fond tenues', 'Budget validé', 'Séance de sport tenue trois fois', 'Dossier fournisseur clos', 'Recrutement lancé'];
    const DIFFICULTES = ['Trop de réunions le mardi', 'Un dossier bloqué en attente de validation', 'Fatigue en fin de semaine', 'Interruptions permanentes', 'Désaccord avec un fournisseur', 'Peu de sommeil'];
    const APPRENTISSAGES = ['Je travaille mieux le matin : protéger les créneaux avant 11 h.', 'Dire non plus tôt évite de rattraper le soir.', 'Préparer la réunion la veille la raccourcit de moitié.', 'Une pause à midi change l\'après-midi.', 'Écrire les trois priorités le vendredi rend le lundi plus simple.', 'Déléguer demande d\'expliquer une fois, bien.'];
    const MOTS = ['Dense', 'Calme', 'Productive', 'Chargée', 'Équilibrée', 'Courte', 'Utile', 'Solide', 'Fatigante', 'Fluide'];
    const ETATS = [['faite', 'faite', 'partielle'], ['faite', 'non', 'faite'], ['partielle', 'faite', 'faite'], ['faite', 'faite', 'faite'], ['non', 'partielle', 'faite']];
    for (let k = 10; k >= 1; k--) {
      if (k === 6) continue; // semaine sautée
      const s = R.semaineSuivante(cur, -k);
      const i = 10 - k;
      const date = ajout(R.lundiDeCle(s), 4);
      const q = (etape, reponse) => ({ question: R.questionDe(e, B, etape, s), reponse });
      e.revues.push(R.normaliserRevue({
        id: `demo${i}`, semaine: s, date,
        tete: ['Rappeler le garage pour la révision', 'Idée : un point hebdo de 15 minutes avec l\'équipe', 'Commander des cartouches d\'encre'].slice(0, 1 + (i % 3)),
        reussites: [REUSSITES[i % 8], REUSSITES[(i + 3) % 8]], difficultes: [DIFFICULTES[i % 6]], apprentissages: APPRENTISSAGES[i % 6],
        priorites: PRIOS[i].map((texte, j) => ({ id: `p${i}${j}`, texte, etat: k > 1 ? ETATS[i % 5][j] : null })),
        energie: [3, 3, 4, 2, 3, 4, 4, 5, 4, 4][i], humeur: [3, 4, 4, 2, 3, 3, 4, 5, 4, 4][i], mot: MOTS[i],
        questions: i % 2 ? { bilan: q('bilan', 'Avoir tenu les matinées sans réunion.') } : { apprentissages: q('apprentissages', 'Bloquer le vendredi après-midi pour la revue.') },
      }));
    }
    // Priorités de la semaine en cours (revue de la semaine dernière) : une faite, une en partie, une ouverte.
    const der = R.revueDe(e, R.semaineSuivante(cur, -1));
    if (der) { der.priorites[0].etat = 'faite'; der.priorites[1].etat = R.jourSemaine(t) >= 3 ? 'partielle' : null; }
    const ech = (j, texte, revue = null, fait = false) => e.echeances.push({ id: R.nouvelId(), date: ajout(t, j), texte, fait, revue });
    ech(-3, 'Envoyer le bilan trimestriel à la direction', der?.id);
    ech(-8, 'Renouveler l\'abonnement au transport', der?.id, true);
    ech(2, 'Rendez-vous chez le dentiste, 9 h', der?.id);
    ech(5, 'Comité de pilotage du projet', der?.id);
    ech(9, 'Date limite : réponse à l\'appel d\'offres');
    ech(16, 'Anniversaire de Sam');
    ech(24, 'Séminaire d\'équipe, journée entière');
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Revue hebdomadaire · QME';
    // Semaine décorative : sept jours, le vendredi en cercle plein.
    const jours = Array.from({ length: 7 }, (_, i) => (i === 4 ? `<circle cx="${30 + i * 36}" cy="100" r="17" fill="#F5B400"/>` : `<rect x="${16 + i * 36}" y="86" width="28" height="28" rx="6" fill="${i > 4 ? '#D8E4F0' : '#1D4E89'}"/>`)).join('');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 200" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          ${jours}
          <path d="M290 40 L290 160 A120 120 0 0 0 410 40 Z" fill="#D9302A"/>
          <circle cx="480" cy="100" r="64" fill="#141414"/>
          <rect x="452" y="72" width="56" height="56" rx="10" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Revue hebdomadaire · journal de bord</p>
          <h1>Ta semaine, revue en 20 minutes.</h1>
          <p>Une ligne de journal par jour, puis chaque vendredi une revue guidée : ce qui a marché, ce que tu retiens, tes 3 priorités et ce qui arrive. Tu vois ta régularité et ton humeur semaine après semaine.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta revue</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton journal est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma revue</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de revue ? <a href="/catalogue/revue-hebdo/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma revue'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { prenom: '', jour: 5 };

  function ecranAccueil() {
    const a = accueil;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On installe ton rituel.</h1>
      <p class="intro">Choisis le jour de ta revue : l'outil te la rappelle ce jour-là, à l'ouverture (aucune notification). Beaucoup la font le vendredi en fin de journée, d'autres le dimanche soir. Tout reste modifiable dans les réglages.</p>
      <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
        <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
      </label>
      <h2 class="titre-section">Jour de la revue</h2>
      <div class="choix-jour" role="radiogroup" aria-label="Jour de la revue">${[1, 2, 3, 4, 5, 6, 7].map((j) => `<button type="button" role="radio" aria-checked="${a.jour === j}" data-action="choix-jour" data-j="${j}">${majuscule(B.jours[j])}</button>`).join('')}</div>
      <div class="accueil-pied"><span class="aide-pied">Ensuite : une ligne de journal par jour, et ta première revue le ${B.jours[a.jour]}.</span><button class="btn primaire" data-action="accueil-fin">Commencer</button></div>
    </div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    E.jourRevue = accueil.jour;
    accueil = { prenom: '', jour: 5 };
    sauver();
    demarrer();
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 9h19" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="15" r="2.6" fill="currentColor"/></svg>',
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    historique: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    tendance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 11l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M3 21h18" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    demi: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg>',
    croix: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  const ONGLETS = [['semaine', 'Semaine'], ['journal', 'Journal'], ['historique', 'Historique'], ['tendance', 'Tendance']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/revue-hebdo/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Revue<br>hebdo</span>
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
    if (vue === 'revue' && !E.brouillon) vue = 'semaine';
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { semaine: 'Semaine', journal: 'Journal', historique: 'Historique', tendance: 'Tendance', revue: 'Revue' };
    document.title = `${titres[vue]} · Revue hebdomadaire`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, journal: vueJournal, historique: vueHistorique, tendance: vueTendance, revue: vueRevue }[vue]();
    brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', v === 'revue' ? location.pathname : `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const saisieEnCours = () => { const a = document.activeElement; return Boolean(a && a.matches?.('input,textarea') && a.closest('#vue')); };
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const largeurVue = () => Math.min(($('#vue')?.clientWidth || window.innerWidth) - 24, 1180);

  // ---------- Composants ----------
  // Humeur : cinq pastilles numérotées, le libellé écrit à côté (jamais la couleur seule).
  function choixHumeur(date, h, compact = false) {
    return `<div class="humeurs${compact ? ' compact' : ''}" role="radiogroup" aria-label="Humeur du ${esc(fmt(date, { weekday: 'long', day: 'numeric', month: 'long' }))} (facultatif)">${[1, 2, 3, 4, 5].map((v) => `<button type="button" role="radio" aria-checked="${h === v}" data-action="humeur" data-date="${date}" data-v="${v}" title="${B.humeurs[v]}" aria-label="${v} sur 5 : ${B.humeurs[v]}">${v}</button>`).join('')}<span class="humeur-lib">${h ? esc(B.humeurs[h]) : '<span class="discret">humeur</span>'}</span></div>`;
  }
  // Ligne de journal modifiable sur place : texte enregistré à la sortie du champ (ou après une pause).
  function ligneJournal(x, t) {
    const futur = x.date > t;
    const etiquette = `<span class="jl-jour${x.date === t ? ' auj' : ''}"><b>${majuscule(nomJour(x.date))}</b><small>${fmt(x.date, { day: 'numeric', month: 'short' })}${x.date === t ? ' · aujourd\'hui' : ''}</small></span>`;
    if (futur) return `<li class="jl futur">${etiquette}<span class="discret jl-vide">à venir</span></li>`;
    return `<li class="jl${x.texte || x.humeur ? ' rempli' : ''}">${etiquette}
      <label class="sr-only" for="j-${x.date}">Journal du ${esc(fmt(x.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</label>
      <input id="j-${x.date}" class="jl-texte" data-journal="${x.date}" value="${esc(x.texte)}" maxlength="${R.MAX_LIGNE}" placeholder="${x.date === t ? 'Une ligne sur ta journée…' : 'Une ligne…'}" autocomplete="off" enterkeyhint="done">
      ${choixHumeur(x.date, x.humeur, true)}</li>`;
  }
  function blocPriorites(prios, editable = true) {
    if (!prios.length) return '';
    return `<ul class="prios">${prios.map((p, i) => `<li class="prio-ligne etat-${p.etat || 'ouverte'}">
      <span class="prio-num" aria-hidden="true">${i + 1}</span><span class="prio-texte">${esc(p.texte)}</span>
      ${editable ? `<button class="btn petit prio-etat" data-action="prio-etat" data-id="${p.id}" aria-label="${esc(p.texte)} : ${p.etat ? LIB_PRIO[p.etat] : 'à faire'}. Changer l'état">${p.etat === 'faite' ? ICONES.coche : p.etat === 'partielle' ? ICONES.demi : p.etat === 'non' ? ICONES.croix : ''}<span>${p.etat ? LIB_PRIO[p.etat] : 'À faire'}</span></button>` : `<span class="pastille">${p.etat ? LIB_PRIO[p.etat] : 'À faire'}</span>`}</li>`).join('')}</ul>`;
  }
  function ligneEcheance(x, t) {
    const dans = R.ecart(t, x.date);
    const quand = dans === 0 ? 'aujourd\'hui' : dans === 1 ? 'demain' : dans < 0 ? `il y a ${pluriel(-dans, 'jour')}` : `dans ${pluriel(dans, 'jour')}`;
    return `<li class="ech${dans < 0 ? ' passee' : dans <= 2 ? ' proche' : ''}"><span class="ech-date"><b>${fmt(x.date, { day: 'numeric' })}</b><small>${fmt(x.date, { month: 'short' }).replace('.', '')}</small></span><span class="ech-texte"><b>${esc(x.texte)}</b><small>${majuscule(nomJour(x.date))}, ${quand}</small></span>
      <button class="btn-icone petit" data-action="ech-fait" data-id="${x.id}" aria-label="Marquer « ${esc(x.texte)} » comme passé ou fait" title="Fait">${ICONES.coche}</button></li>`;
  }

  // ---------- Semaine ----------
  function bandeauRappel() {
    const t = auj();
    if (E.brouillon) return `<div class="bandeau-revue"><div><b>Ta revue est commencée.</b><span>${esc(R.libelleSemaine(E.brouillon.semaine))} : reprends là où tu t'étais arrêté(e).</span></div><button class="btn primaire" data-action="revue-reprendre">Reprendre ma revue</button></div>`;
    const r = R.rappel(E, t);
    if (r.type === 'jour') return `<div class="bandeau-revue jour-revue"><div><b>C'est ${B.jours[E.jourRevue]} : jour de ta revue.</b><span>20 minutes pour boucler la semaine ${R.numeroSemaine(r.semaine)} et préparer la suivante.</span></div><button class="btn primaire" data-action="revue">Faire ma revue</button></div>`;
    if (r.type === 'due') return `<div class="bandeau-revue"><div><b>Ta revue de la semaine ${R.numeroSemaine(r.semaine)} t'attend.</b><span>Prévue ${B.jours[E.jourRevue]} ${fmt(r.date)} : il est encore temps, avant lundi.</span></div><button class="btn primaire" data-action="revue">Faire ma revue</button></div>`;
    if (r.type === 'retard') return `<div class="bandeau-revue retard"><div><b>Revue de la semaine dernière à rattraper.</b><span>Semaine ${R.numeroSemaine(r.semaine)}, ${semCourte(r.semaine)} : rattrapable jusqu'au ${fmt(r.avant, { weekday: 'long', day: 'numeric', month: 'long' })}.</span></div><button class="btn primaire" data-action="revue">Rattraper ma revue</button></div>`;
    return '';
  }

  function tuilesTendance(t) {
    const se = R.serie(E, t), te = R.tenue(E, t), hm = R.humeurMoyenne(E, t);
    const prev = R.semaineSuivante(R.cleSemaine(t), -1);
    const tp = R.tauxPriorites(R.prioritesDe(E, prev));
    return [
      ['Série', `${se}<small>${se > 1 ? 'semaines' : 'semaine'}</small>`, se ? 'de revues d\'affilée' : 'fais ta revue pour la lancer', 'var(--rouge)', 'rond'],
      ['Semaines tenues', te.total ? `${te.tenues}<small>/${te.total}</small>` : '–', te.total ? `sur les ${pluriel(te.total, 'dernière semaine', 'dernières semaines')}` : 'depuis le début', 'var(--bleu)', ''],
      ['Humeur', hm === null ? '–' : `${nb(hm)}<small>/5</small>`, hm === null ? 'note-la dans le journal' : `${libHumeur(hm).toLowerCase()}, moyenne sur 4 semaines`, 'var(--jaune)', 'rond'],
      ['Priorités tenues', tp === null ? '–' : `${tp}<small>%</small>`, tp === null ? 'semaine dernière, pas encore notées' : 'la semaine dernière', 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
  }

  function vueSemaine() {
    const t = auj();
    const cur = R.cleSemaine(t);
    const prios = R.prioritesDe(E, cur);
    const jours = R.journalDe(E, cur);
    const remplis = jours.filter((x) => x.texte || x.humeur).length;
    const avenir = R.echeancesAVenir(E, t, 30), passees = R.echeancesPassees(E, t);
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const rev = R.revueDe(E, cur);
    const r = R.rappel(E, t);
    return `
      <section class="jour">
        <p class="surtitre">Semaine ${R.numeroSemaine(cur)} · ${semCourte(cur)}</p>
        <h1>${salut}${rev ? 'Ta revue de la semaine est <mark>faite</mark>.' : r.type === 'ok' ? `Prochaine revue <mark>${esc(B.jours[E.jourRevue])}</mark>.` : 'C\'est le moment de ta <mark>revue</mark>.'}</h1>
      </section>
      ${bandeauRappel()}
      ${R.semainesDifficiles(E, t) ? `<div class="bandeau-revue doux"><div><b>Plusieurs semaines difficiles d'affilée.</b><span>Ce n'est qu'un repère personnel. Prends soin de toi, et n'hésite pas à en parler à un proche ou à un professionnel de santé.</span></div></div>` : ''}
      <div class="tuiles">${tuilesTendance(t)}</div>
      <div class="deux-colonnes">
        <section>
          <h2 class="titre-section">Mes 3 priorités <span>choisies à la dernière revue</span></h2>
          ${prios.length ? blocPriorites(prios) : `<p class="aide">Pas de priorité pour cette semaine : tu les choisiras à ta prochaine revue (étape « 3 priorités »).</p>`}
          ${rev ? `<div class="carte-revue"><p class="surtitre">Revue faite le ${fmt(rev.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>${rev.mot ? `<p class="mot">« ${esc(rev.mot)} »</p>` : ''}<div class="rang-actions"><button class="btn petit" data-action="voir-revue" data-id="${rev.id}">Relire</button><button class="btn petit lien" data-action="revue-modifier" data-id="${rev.id}">Modifier</button></div></div>`
            : r.type === 'ok' ? `<div class="carte-revue"><p class="surtitre">Prochaine revue</p><p>${majuscule(fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long' }))}. Tu peux aussi la faire en avance.</p><div class="rang-actions"><button class="btn petit" data-action="revue">Faire ma revue maintenant</button></div></div>` : ''}
        </section>
        <section>
          <h2 class="titre-section">À venir <span>30 prochains jours</span></h2>
          ${avenir.length ? `<ul class="echeances">${avenir.map((x) => ligneEcheance(x, t)).join('')}</ul>` : '<p class="aide">Rien de noté pour les 30 prochains jours.</p>'}
          ${passees.length ? `<h3 class="mini-titre" style="margin-top:14px">Passé, pas encore coché</h3><ul class="echeances">${passees.map((x) => ligneEcheance(x, t)).join('')}</ul>` : ''}
          <div class="rang-actions"><button class="btn petit" data-action="echeance-nouvelle">${ICONES.plus}Rendez-vous ou échéance</button></div>
        </section>
      </div>
      <h2 class="titre-section">Journal de la semaine <span>${remplis} jour${remplis > 1 ? 's' : ''} sur 7 · une ligne suffit, l'humeur est facultative</span></h2>
      <ul class="journal-lignes">${jours.map((x) => ligneJournal(x, t)).join('')}</ul>`;
  }

  // ---------- Journal ----------
  function vueJournal() {
    const t = auj();
    const [a, m] = moisVue.split('-').map(Number);
    const premier = `${moisVue}-01`;
    const nbJours = new Date(a, m, 0).getDate();
    const fin = `${moisVue}-${String(nbJours).padStart(2, '0')}`;
    const jusqua = fin < t ? fin : t;
    const dates = [];
    for (let d = jusqua; d >= premier; d = ajout(d, -1)) dates.push(d);
    const remplis = dates.filter((d) => E.journal[d]).length;
    const hm = R.moyenne(dates.map((d) => E.journal[d]?.humeur ?? null).filter((x) => x !== null));
    // Regroupement par semaine (de la plus récente à la plus ancienne), avec l'état de la revue.
    const groupes = [];
    for (const d of dates) { const s = R.cleSemaine(d); let g = groupes.at(-1); if (!g || g.s !== s) groupes.push(g = { s, l: [] }); g.l.push(d); }
    const futurMois = premier > t;
    return `
      <div class="vue-tete"><div><h1>Journal</h1><p>${majuscule(fmt(premier, { month: 'long', year: 'numeric' }))} · ${pluriel(remplis, 'jour noté', 'jours notés')}${hm !== null ? ` · humeur moyenne ${nb(hm)}/5 (${libHumeur(hm).toLowerCase()})` : ''}</p></div>
        <div class="actions"><div class="nav-mois"><button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">${ICONES.gauche}</button><button class="btn petit" data-action="mois-auj">Ce mois-ci</button><button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant" ${moisVue >= t.slice(0, 7) ? 'disabled' : ''}>${ICONES.droite}</button></div></div></div>
      <details class="methode"><summary>Pourquoi une ligne par jour ?</summary><p>${esc(B.methode.journal)}</p><p>${esc(B.methode.humeur)}</p></details>
      ${futurMois || !dates.length ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à écrire ici</h3><p>Ce mois n'a pas encore commencé.</p></div></div>`
        : groupes.map(({ s, l }) => { const rv = R.revueDe(E, s); return `<section class="groupe-semaine"><h2 class="theme-titre">Semaine ${R.numeroSemaine(s)} <small>${semCourte(s)}</small>${rv ? `<button class="btn petit lien" data-action="voir-revue" data-id="${rv.id}">Revue faite · relire</button>` : '<small class="discret"> · sans revue</small>'}</h2>
          <ul class="journal-lignes">${l.map((d) => ligneJournal({ date: d, ...(E.journal[d] || { texte: '', humeur: null }) }, t)).join('')}</ul></section>`; }).join('')}`;
  }

  // ---------- Historique ----------
  function vueHistorique() {
    const revues = [...R.revuesTriees(E)].reverse();
    const res = recherche.trim().length >= 2 ? R.rechercher(E, recherche) : null;
    const surligner = (s) => { if (!recherche.trim()) return esc(s); const i = R.plier(s).indexOf(R.plier(recherche.trim())); return i < 0 ? esc(s) : `${esc(s.slice(0, i))}<mark>${esc(s.slice(i, i + recherche.trim().length))}</mark>${esc(s.slice(i + recherche.trim().length))}`; };
    const carte = (r) => {
      const prios = R.prioritesDe(E, r.semaine);
      const tp = R.tauxPriorites(prios);
      return `<li><button class="carte-ligne carte-revue-h" data-action="voir-revue" data-id="${r.id}"><span><b>Semaine ${R.numeroSemaine(r.semaine)}${r.mot ? ` · « ${esc(r.mot)} »` : ''}</b><small>${semCourte(r.semaine)} ${r.semaine.slice(0, 4)}</small></span>
        <span class="h-notes">${r.humeur ? `<span>Humeur <b>${r.humeur}</b>/5</span>` : ''}${r.energie ? `<span>Énergie <b>${r.energie}</b>/5</span>` : ''}${tp !== null ? `<span>Priorités <b>${tp}</b> %</span>` : ''}</span>
        <span class="h-extrait">${esc([...r.reussites.slice(0, 1), r.apprentissages].filter(Boolean).join(' · ').slice(0, 160))}</span></button></li>`;
    };
    return `
      <div class="vue-tete"><div><h1>Historique</h1><p>${pluriel(revues.length, 'revue')} · ${pluriel(Object.keys(E.journal).length, 'jour', 'jours')} de journal</p></div>
        <div class="actions"><button class="btn" data-action="export-texte" ${revues.length || Object.keys(E.journal).length ? '' : 'disabled'}>Exporter en texte</button></div></div>
      <form class="recherche" role="search" data-recherche><label class="sr-only" for="recherche">Rechercher dans les revues et le journal</label>
        <input id="recherche" type="search" value="${esc(recherche)}" placeholder="Rechercher un mot : client, sport, budget…" autocomplete="off" enterkeyhint="search"></form>
      <div id="resultats">${res ? blocResultats(res, surligner)
        : revues.length ? `<ul class="liste-revues">${revues.map(carte).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune revue pour l'instant</h3><p>Chaque revue enregistrée s'ajoute ici, avec ses réussites, ses apprentissages et ses priorités. Le journal est cherchable aussi.</p><div class="actions"><button class="btn primaire" data-action="revue">Faire ma première revue</button></div></div></div>`}</div>`;
  }
  function blocResultats(res, surligner) {
    if (!res.length) return `<p class="aide">Aucun résultat pour « ${esc(recherche.trim())} ».</p>`;
    return `<p class="discret" role="status">${pluriel(res.length, 'résultat')}</p><ul class="liste-resultats">${res.slice(0, 80).map((x) => `<li><button class="carte-ligne" ${x.type === 'revue' ? `data-action="voir-revue" data-id="${x.id}"` : `data-action="voir-jour" data-date="${x.date}"`}><span><b>${x.type === 'revue' ? `Revue · semaine ${R.numeroSemaine(x.semaine)}` : majuscule(fmt(x.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b><small>${surligner(x.extrait)}</small></span><span class="pastille">${x.type === 'revue' ? 'Revue' : 'Journal'}</span></button></li>`).join('')}</ul>`;
  }

  // ---------- Tendance ----------
  // Deux séries (humeur, énergie) sur la même échelle 1 à 5 : un seul axe. Palette validée avec le script du
  // skill dataviz (bleu #2B5DA3 et orange #D5732F sur blanc : tous les contrôles passent) ; l'énergie est en
  // plus en pointillés, et les deux séries sont nommées en légende et au bout de leur courbe.
  const C_HUMEUR = '#2B5DA3', C_ENERGIE = '#D5732F';
  function courbeSvg(semaines, largeur) {
    const W = Math.max(280, largeur), H = estTel() ? 210 : 240;
    const g = { h: 18, b: 34, gch: 30, d: estTel() ? 84 : 96 };
    const n = semaines.length;
    const x = (i) => g.gch + (n <= 1 ? 0 : (i * (W - g.gch - g.d)) / (n - 1));
    const y = (v) => g.h + (1 - (v - 1) / 4) * (H - g.h - g.b);
    const grille = [1, 2, 3, 4, 5].map((v) => `<line x1="${g.gch}" x2="${W - g.d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--trait)"/><text x="${g.gch - 8}" y="${y(v) + 4}" text-anchor="end" class="c-axe">${v}</text>`).join('');
    const pas = Math.max(1, Math.ceil((n * 46) / Math.max(1, W - g.gch - g.d)));
    const etiquettes = semaines.map((s, i) => ((n - 1 - i) % pas === 0 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="c-axe">S${R.numeroSemaine(s.semaine)}</text>` : '')).join('');
    const serie = (cle, couleur, tirets, nom) => {
      const segs = []; let seg = [];
      semaines.forEach((s, i) => { if (s[cle] === null) { if (seg.length) segs.push(seg); seg = []; } else seg.push([x(i), y(s[cle])]); });
      if (seg.length) segs.push(seg);
      const trace = segs.map((sg) => (sg.length > 1 ? `<path d="M${sg.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L')}" fill="none" stroke="${couleur}" stroke-width="2" ${tirets ? 'stroke-dasharray="6 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>` : '')).join('');
      const points = semaines.map((s, i) => (s[cle] === null ? '' : `<circle cx="${x(i)}" cy="${y(s[cle])}" r="4.5" fill="${couleur}" stroke="var(--surface)" stroke-width="2"/>`)).join('');
      return trace + points;
    };
    // Étiquettes de fin dans la marge droite, à hauteur de la dernière valeur, écartées si elles se touchent.
    const fins = [['humeur', 'Humeur'], ['energie', 'Énergie']].map(([cle, nom]) => {
      const der = semaines.map((s) => s[cle]).filter((v) => v !== null).at(-1);
      return der === undefined ? null : { nom, v: der, y: y(der) + 4 };
    }).filter(Boolean).sort((a, b) => a.y - b.y);
    if (fins.length === 2 && fins[1].y - fins[0].y < 16) { const m = (fins[0].y + fins[1].y) / 2; fins[0].y = m - 8; fins[1].y = m + 8; }
    const etiquettesFin = fins.map((f) => `<text x="${W - g.d + 10}" y="${f.y}" class="c-fin">${f.nom} ${nb(f.v)}</text>`).join('');
    const cibles = semaines.map((s, i) => {
      const l = n <= 1 ? W - g.gch - g.d : (W - g.gch - g.d) / (n - 1);
      const info = `<b>Semaine ${R.numeroSemaine(s.semaine)}</b>${esc(semCourte(s.semaine))}<br>Humeur : ${s.humeur === null ? 'non notée' : `${nb(s.humeur)}/5 (${libHumeur(s.humeur).toLowerCase()})`}<br>Énergie : ${s.energie === null ? 'non notée' : `${s.energie}/5 (${B.energies[s.energie].toLowerCase()})`}<br>${s.tenue ? 'Revue faite' : s.enCours ? 'Revue à venir' : 'Pas de revue'}`;
      return `<rect x="${Math.max(0, x(i) - l / 2)}" y="0" width="${l}" height="${H - g.b + 6}" fill="transparent" class="c-cible" tabindex="0" data-info="${esc(info)}"/>`;
    }).join('');
    return `<svg class="courbe" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Humeur et énergie par semaine, de 1 à 5 ; détail dans le tableau des données">${grille}${etiquettes}${serie('humeur', C_HUMEUR, false, 'Humeur')}${serie('energie', C_ENERGIE, true, 'Énergie')}${etiquettesFin}${cibles}</svg>`;
  }

  function vueTendance() {
    const t = auj();
    const N = estTel() ? 8 : 12;
    const sem = R.historiqueSemaines(E, t, 12);
    const vues = sem.slice(-N);
    const W = Math.min(largeurVue() - 34, 1100);
    const te = R.tenue(E, t);
    const bande = `<ol class="bande-semaines" aria-label="Revues des ${sem.length} dernières semaines">${sem.map((s) => {
      const etat = s.tenue ? 'tenue' : s.enCours ? 'encours' : s.avantOutil ? 'avant' : 'manquee';
      const lib = { tenue: 'revue faite', encours: 'semaine en cours', avant: 'avant tes débuts', manquee: 'pas de revue' }[etat];
      return `<li class="bs-${etat}" title="Semaine ${R.numeroSemaine(s.semaine)} : ${lib}"><span class="bs-case" aria-hidden="true">${s.tenue ? ICONES.coche : ''}</span><small>S${R.numeroSemaine(s.semaine)}</small><span class="sr-only">Semaine ${R.numeroSemaine(s.semaine)} : ${lib}</span></li>`;
    }).join('')}</ol>`;
    const barres = vues.map((s) => `<div class="bp" title="Semaine ${R.numeroSemaine(s.semaine)} : ${s.priorites === null ? 'non notées' : `${s.priorites} %`}"><span class="bp-zone"><span class="bp-barre" style="height:${s.priorites ?? 0}%"></span></span><b>${s.priorites === null ? '–' : `${s.priorites}`}</b><small>S${R.numeroSemaine(s.semaine)}</small></div>`).join('');
    const tableau = `<table class="tableau tableau-evo"><thead><tr><th>Semaine</th><th>Revue</th><th class="nb">Humeur</th><th class="nb">Énergie</th><th class="nb">Priorités tenues</th><th class="nb">Jours de journal</th></tr></thead><tbody>${[...sem].reverse().map((s) => `<tr><td>S${R.numeroSemaine(s.semaine)} <small class="discret">${semCourte(s.semaine)}</small></td><td>${s.tenue ? 'faite' : s.enCours ? 'en cours' : s.avantOutil ? '–' : 'non'}</td><td class="nb">${s.humeur === null ? '–' : nb(s.humeur)}</td><td class="nb">${s.energie ?? '–'}</td><td class="nb">${s.priorites === null ? '–' : `${s.priorites} %`}</td><td class="nb">${s.joursJournal}</td></tr>`).join('')}</tbody></table>`;
    const aucuneNote = vues.every((s) => s.humeur === null && s.energie === null);
    return `
      <div class="vue-tete"><div><h1>Tendance</h1><p>Ta régularité et ton humeur, semaine après semaine.</p></div></div>
      <div class="tuiles">
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Série en cours</p><b>${R.serie(E, t)}<small>sem.</small></b><span>meilleure série : ${pluriel(R.meilleureSerie(E), 'semaine')}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Semaines tenues</p><b>${te.taux === null ? '–' : `${te.taux}<small>%</small>`}</b><span>${te.tenues} sur ${te.total}, 12 semaines au plus</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Humeur moyenne</p><b>${R.humeurMoyenne(E, t) === null ? '–' : `${nb(R.humeurMoyenne(E, t))}<small>/5</small>`}</b><span>4 dernières semaines</span></div>
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Revues</p><b>${E.revues.length}</b><span>depuis le ${fmt(E.creeLe, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      </div>
      <h2 class="titre-section">Revues des 12 dernières semaines <span>une case par semaine</span></h2>
      ${bande}
      <p class="legende-bande"><span><i class="bs-tenue"></i>Revue faite</span><span><i class="bs-manquee"></i>Pas de revue</span><span><i class="bs-encours"></i>Semaine en cours</span>${sem.some((s) => s.avantOutil) ? '<span><i class="bs-avant"></i>Avant tes débuts</span>' : ''}</p>
      <div class="graphique" style="margin-top:20px">
        <div class="graphique-tete"><h2>Humeur et énergie</h2><span class="discret">de 1 à 5, ${N} dernières semaines</span></div>
        <p class="legende-courbe"><span><i style="background:${C_HUMEUR}"></i>Humeur <small>moyenne du journal</small></span><span><i class="tirets" style="border-color:${C_ENERGIE}"></i>Énergie <small>notée à la revue</small></span></p>
        ${aucuneNote ? '<p class="aide">Pas encore de note : ajoute une humeur à tes lignes de journal et note ton énergie à la revue.</p>' : courbeSvg(vues, W)}
      </div>
      <div class="graphique" style="margin-top:20px">
        <div class="graphique-tete"><h2>Priorités tenues</h2><span class="discret">% par semaine (faite = 1, en partie = ½)</span></div>
        <div class="barres-prio">${barres}</div>
      </div>
      <details class="donnees"><summary>Voir les données en tableau</summary><div class="defile">${tableau}</div></details>
      <p class="aide" style="margin-top:16px">${esc(B.methode.humeur)}</p>`;
  }

  // ---------- Revue guidée ----------
  const ETAPES = () => [...B.etapes, { id: 'fin', nom: 'Fin' }];
  const vides = (l, n) => [...l, ...Array(Math.max(0, n - l.length)).fill('')].slice(0, Math.max(n, l.length));

  function commencerRevue(id) {
    const t = auj();
    const ex = id ? E.revues.find((r) => r.id === id) : null;
    const semaine = ex ? ex.semaine : R.semaineACommencer(E, t);
    if (!semaine) { toast('Ta revue de la semaine est déjà faite : tu peux la relire ou la modifier depuis la page Semaine.'); return false; }
    const src = ex || R.normaliserRevue({ semaine, date: t });
    E.brouillon = {
      id: src.id, semaine, edition: Boolean(ex), etape: 0,
      tete: src.tete.join('\n'), reussites: vides(src.reussites, 3), difficultes: vides(src.difficultes, 2), apprentissages: src.apprentissages,
      priorites: vides(src.priorites.map((p) => p.texte), 3), prioIds: src.priorites.map((p) => p.id), agenda: [],
      energie: src.energie, humeur: src.humeur, mot: src.mot, questions: structuredClone(src.questions), decalages: {},
    };
    return true;
  }
  function questionBloc(b, etape) {
    const q = b.questions[etape]?.question || R.questionDe(E, B, etape, b.semaine, b.decalages[etape] || 0);
    if (!q) return '';
    return `<div class="question-semaine"><p class="surtitre">Question de la semaine</p><p class="q-texte">${esc(q)}</p>
      <label class="sr-only" for="q-${etape}">Ta réponse (facultatif)</label><textarea id="q-${etape}" rows="2" maxlength="600" data-q="${etape}" data-question="${esc(q)}" placeholder="Ta réponse, si elle t'aide (facultatif)">${esc(b.questions[etape]?.reponse || '')}</textarea>
      <button type="button" class="btn petit lien" data-action="autre-question" data-etape="${etape}">Autre question</button></div>`;
  }
  const champsListe = (cle, l, lib, ph) => `<div class="champs-liste">${l.map((v, i) => `<label class="champ"><span class="sr-only">${lib} ${i + 1}</span><input data-b="${cle}" data-i="${i}" value="${esc(v)}" maxlength="160" placeholder="${esc(ph[i] || ph.at(-1))}" autocomplete="off"></label>`).join('')}<button type="button" class="btn petit lien" data-action="ligne-plus" data-cle="${cle}">${ICONES.plus}Une ligne de plus</button></div>`;

  function vueRevue() {
    const b = E.brouillon;
    const t = auj();
    const etapes = ETAPES();
    b.etape = Math.max(0, Math.min(b.etape, etapes.length - 1));
    const et = etapes[b.etape];
    const prog = `<div class="etapes-revue" aria-label="Étape ${b.etape + 1} sur ${etapes.length} : ${esc(et.nom)}">${etapes.map((x, i) => `<span class="${i < b.etape ? 'fait' : i === b.etape ? 'actif' : ''}" title="${esc(x.nom)}"></span>`).join('')}</div>`;
    const tete = (x) => `<p class="surtitre">Étape ${b.etape + 1} sur ${etapes.length} · ${esc(x.nom)}</p><h1>${esc(x.titre)}</h1><p class="intro">${esc(x.aide)}</p>`;
    let corps = '';
    if (et.id === 'tete') {
      corps = `${tete(et)}<label class="champ"><span class="sr-only">Ce qui traîne dans ta tête, une idée par ligne</span><textarea data-b="tete" rows="7" maxlength="3000" placeholder="Rappeler le garage&#10;Idée pour la réunion de lundi&#10;Répondre au message de …">${esc(b.tete)}</textarea></label>
        <p class="aide">${pluriel(R.lignes(b.tete).length, 'ligne')}. Rien n'est envoyé ailleurs : recopie ensuite ce qui doit l'être dans ton gestionnaire de tâches.</p>${questionBloc(b, 'tete')}`;
    } else if (et.id === 'semaine') {
      const prios = R.prioritesDe(E, b.semaine);
      corps = `${tete(et)}
        <h2 class="titre-section">Tes priorités de la semaine ${R.numeroSemaine(b.semaine)}</h2>
        ${prios.length ? `<ul class="prios">${prios.map((p, i) => `<li class="prio-ligne etat-${p.etat || 'ouverte'}"><span class="prio-num" aria-hidden="true">${i + 1}</span><span class="prio-texte">${esc(p.texte)}</span>
          <span class="choix-etat" role="radiogroup" aria-label="${esc(p.texte)}">${['faite', 'partielle', 'non'].map((s) => `<button type="button" role="radio" aria-checked="${p.etat === s}" data-action="prio-fixer" data-id="${p.id}" data-etat="${s}">${LIB_PRIO[s]}</button>`).join('')}</span></li>`).join('')}</ul>`
          : '<p class="aide">Pas de priorité fixée pour cette semaine (c\'est peut-être ta première revue).</p>'}
        <h2 class="titre-section">Ton journal <span>${semCourte(b.semaine)} · complète les jours manquants si tu veux</span></h2>
        <ul class="journal-lignes">${R.journalDe(E, b.semaine).map((x) => ligneJournal(x, t)).join('')}</ul>${questionBloc(b, 'semaine')}`;
    } else if (et.id === 'bilan') {
      corps = `${tete(et)}<div class="deux-colonnes" style="margin-top:0"><div><h2 class="titre-section" style="margin-top:0">Réussites</h2>${champsListe('reussites', b.reussites, 'Réussite', ['Une chose qui a marché', 'Une autre, même petite', 'Encore une ?'])}</div>
        <div><h2 class="titre-section" style="margin-top:0">Difficultés</h2>${champsListe('difficultes', b.difficultes, 'Difficulté', ['Ce qui a coincé', 'Autre chose ?'])}</div></div>${questionBloc(b, 'bilan')}`;
    } else if (et.id === 'apprentissages') {
      corps = `${tete(et)}<label class="champ"><span class="sr-only">Ce que tu retiens</span><textarea data-b="apprentissages" rows="4" maxlength="1200" placeholder="Ce que je retiens de la semaine…">${esc(b.apprentissages)}</textarea></label>${questionBloc(b, 'apprentissages')}`;
    } else if (et.id === 'priorites') {
      const suiv = R.semaineSuivante(b.semaine);
      const prev = R.prioritesDe(E, b.semaine).filter((p) => p.etat !== 'faite');
      corps = `${tete(et)}<p class="surtitre">Semaine ${R.numeroSemaine(suiv)} · ${semCourte(suiv)}</p>
        <div class="champs-prio">${[0, 1, 2].map((i) => `<label class="champ prio-champ"><span class="prio-num" aria-hidden="true">${i + 1}</span><span class="sr-only">Priorité ${i + 1}</span><input data-b="priorites" data-i="${i}" value="${esc(b.priorites[i] || '')}" maxlength="140" placeholder="${['La plus importante', 'La deuxième', 'La troisième'][i]}" autocomplete="off"></label>`).join('')}</div>
        ${prev.length ? `<p class="mini-titre" style="margin-top:14px">Reprendre une priorité pas terminée</p><div class="routines-rapides">${prev.map((p) => `<button type="button" class="btn petit" data-action="prio-reprendre" data-texte="${esc(p.texte)}">${ICONES.plus}${esc(p.texte)}</button>`).join('')}</div>` : ''}
        ${questionBloc(b, 'priorites')}`;
    } else if (et.id === 'agenda') {
      const avenir = R.echeancesAVenir(E, t, 30);
      corps = `${tete(et)}
        <form class="ajout-echeance" data-ajout-agenda><label class="champ">Date<input type="date" name="date" min="${t}" value="${ajout(t, 3)}" required></label><label class="champ">Rendez-vous ou échéance<input name="texte" maxlength="120" placeholder="Ex. : comité de pilotage, 14 h" autocomplete="off" required></label><button class="btn" type="submit">${ICONES.plus}Ajouter</button></form>
        ${b.agenda.length ? `<h2 class="titre-section">Ajoutés à cette revue</h2><ul class="echeances">${[...b.agenda].sort((x, y) => (x.date < y.date ? -1 : 1)).map((x) => `<li class="ech"><span class="ech-date"><b>${fmt(x.date, { day: 'numeric' })}</b><small>${fmt(x.date, { month: 'short' }).replace('.', '')}</small></span><span class="ech-texte"><b>${esc(x.texte)}</b><small>${majuscule(nomJour(x.date))}</small></span><button type="button" class="btn-icone petit" data-action="agenda-retirer" data-id="${x.id}" aria-label="Retirer « ${esc(x.texte)} »">${ICONES.croix}</button></li>`).join('')}</ul>` : ''}
        <h2 class="titre-section">Déjà noté <span>30 prochains jours</span></h2>
        ${avenir.length ? `<ul class="echeances">${avenir.map((x) => ligneEcheance(x, t)).join('')}</ul>` : '<p class="aide">Rien d\'autre de noté.</p>'}
        ${questionBloc(b, 'agenda')}`;
    } else if (et.id === 'energie') {
      const echelle = (cle, libs, nom) => `<fieldset class="question"><legend>${nom}</legend><div class="echelle cinq" role="radiogroup" aria-label="${nom}">${[1, 2, 3, 4, 5].map((v) => `<button type="button" role="radio" aria-checked="${b[cle] === v}" data-action="note-revue" data-cle="${cle}" data-v="${v}"><b>${v}</b><small>${libs[v]}</small></button>`).join('')}</div></fieldset>`;
      const hj = R.humeurSemaine({ ...E, revues: [] }, b.semaine);
      corps = `${tete(et)}<div class="questions">${echelle('energie', B.energies, 'Ton énergie cette semaine')}${echelle('humeur', B.humeurs, 'Ton humeur cette semaine')}</div>
        ${hj !== null ? `<p class="aide">Ton journal donne une humeur moyenne de ${nb(hj)}/5 (${libHumeur(hj).toLowerCase()}) cette semaine.</p>` : ''}
        <label class="champ" style="max-width:420px;margin-top:14px">Un mot pour la semaine <small>facultatif</small><input data-b="mot" value="${esc(b.mot)}" maxlength="40" placeholder="Ex. : dense, calme, utile" autocomplete="off"></label>
        ${questionBloc(b, 'energie')}<p class="aide">${esc(B.methode.humeur)}</p>`;
    } else {
      const prios = b.priorites.filter((x) => x.trim());
      const nR = b.reussites.filter((x) => x.trim()).length, nD = b.difficultes.filter((x) => x.trim()).length;
      const nQ = Object.values(b.questions).filter((q) => q.reponse?.trim()).length;
      corps = `<p class="surtitre">Dernière étape</p><h1>Semaine ${R.numeroSemaine(b.semaine)}, <mark>bouclée</mark>.</h1>
        <ul class="resume">
          <li><b>${R.lignes(b.tete).length}</b> ${R.lignes(b.tete).length > 1 ? 'idées sorties de ta tête' : 'idée sortie de ta tête'}</li>
          <li><b>${nR}</b> ${nR > 1 ? 'réussites' : 'réussite'} et <b>${nD}</b> ${nD > 1 ? 'difficultés' : 'difficulté'}</li>
          <li><b>${prios.length}</b> ${prios.length > 1 ? 'priorités' : 'priorité'} pour la semaine ${R.numeroSemaine(R.semaineSuivante(b.semaine))}${prios.length ? ` : ${prios.map(esc).join(' · ')}` : ''}</li>
          <li><b>${b.agenda.length}</b> ${b.agenda.length > 1 ? 'rendez-vous ajoutés' : 'rendez-vous ajouté'}</li>
          <li>Énergie <b>${b.energie ?? '–'}</b>/5 · humeur <b>${b.humeur ?? '–'}</b>/5${b.mot ? ` · « ${esc(b.mot)} »` : ''}</li>
          <li><b>${nQ}</b> ${nQ > 1 ? 'réponses' : 'réponse'} aux questions de la semaine</li>
        </ul>
        <p class="aide">${esc(B.methode.revue)}</p>`;
    }
    const derniere = b.etape === etapes.length - 1;
    return `<div class="revue">
      <div class="revue-tete"><div><p class="surtitre">${b.edition ? 'Modification · ' : ''}Revue · ${esc(R.libelleSemaine(b.semaine))}</p>${prog}</div><button class="btn petit" data-action="revue-quitter">Continuer plus tard</button></div>
      ${corps}
      <p class="erreur" id="erreur-revue" role="alert"></p>
      <div class="accueil-pied">
        ${b.etape ? '<button class="btn" data-action="revue-prec">Retour</button>' : `<button class="btn lien" data-action="revue-abandon">${b.edition ? 'Annuler la modification' : 'Abandonner cette revue'}</button>`}
        ${derniere ? '<button class="btn primaire" data-action="revue-fin">Enregistrer la revue</button>' : '<button class="btn primaire" data-action="revue-suiv">Continuer</button>'}
      </div></div>`;
  }

  function lireChampsRevue() {
    const b = E.brouillon;
    if (!b) return;
    document.querySelectorAll('.revue [data-b]').forEach((el) => {
      const cle = el.dataset.b;
      if (el.dataset.i !== undefined) b[cle][Number(el.dataset.i)] = el.value;
      else b[cle] = el.value;
    });
    document.querySelectorAll('.revue [data-q]').forEach((el) => {
      const reponse = el.value.trim();
      if (reponse || b.questions[el.dataset.q]) b.questions[el.dataset.q] = { question: el.dataset.question, reponse: el.value };
    });
  }

  function terminerRevue() {
    lireChampsRevue();
    const b = E.brouillon;
    retenir();
    const ancien = E.revues.find((r) => r.id === b.id);
    const prios = b.priorites.map((x) => x.trim()).filter(Boolean).slice(0, R.MAX_PRIORITES).map((texte, i) => {
      const garde = ancien?.priorites.find((p) => p.texte === texte) || (ancien && ancien.priorites[i]?.id === b.prioIds[i] && ancien.priorites[i].texte === texte ? ancien.priorites[i] : null);
      return { id: garde?.id || R.nouvelId(), texte, etat: garde?.etat ?? null };
    });
    const questions = Object.fromEntries(Object.entries(b.questions).filter(([, q]) => q.reponse?.trim()).map(([k, q]) => [k, { question: q.question, reponse: q.reponse.trim() }]));
    const revue = R.normaliserRevue({
      id: b.id, semaine: b.semaine, date: ancien?.date || auj(), tete: R.lignes(b.tete), reussites: b.reussites, difficultes: b.difficultes,
      apprentissages: b.apprentissages.trim(), priorites: prios, energie: b.energie, humeur: b.humeur, mot: b.mot.trim(), questions,
    });
    if (ancien) Object.assign(ancien, revue); else E.revues.push(revue);
    for (const x of b.agenda) E.echeances.push({ id: x.id, date: x.date, texte: x.texte, fait: false, revue: revue.id });
    E.brouillon = null;
    sauver();
    changerVue('semaine');
    toast(ancien ? 'Revue modifiée.' : `Revue de la semaine ${R.numeroSemaine(revue.semaine)} enregistrée. Bonne semaine !`, { libelle: 'Annuler', faire: annuler });
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  function modaleRevue(id) {
    const r = E.revues.find((x) => x.id === id);
    if (!r) return;
    const texte = R.texteRevue(E, B, r);
    const prios = R.prioritesDe(E, r.semaine);
    const liste = (titre, l) => (l.length ? `<dt>${titre}</dt><dd><ul class="puces-texte">${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>` : '');
    const qs = B.etapes.filter((x) => r.questions[x.id]?.reponse).map((x) => `<dt>${esc(r.questions[x.id].question)}</dt><dd>${esc(r.questions[x.id].reponse)}</dd>`).join('');
    const corps = `
      <p>${esc(R.libelleSemaine(r.semaine))} · faite le ${fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <p class="h-notes">${r.humeur ? `<span>Humeur <b>${r.humeur}</b>/5 · ${esc(B.humeurs[r.humeur])}</span>` : ''}${r.energie ? `<span>Énergie <b>${r.energie}</b>/5 · ${esc(B.energies[r.energie])}</span>` : ''}${r.mot ? `<span>« ${esc(r.mot)} »</span>` : ''}</p>
      <dl class="bilan-lu">
        ${liste('Priorités de la semaine', prios.map((p) => `${p.texte} (${p.etat ? LIB_PRIO[p.etat].toLowerCase() : 'non notée'})`))}
        ${liste('Réussites', r.reussites)}${liste('Difficultés', r.difficultes)}
        ${r.apprentissages ? `<dt>Apprentissages</dt><dd>${esc(r.apprentissages)}</dd>` : ''}
        ${liste('Priorités pour la semaine suivante', r.priorites.map((p) => p.texte))}
        ${liste('Vider la tête', r.tete)}
        ${qs}
      </dl>`;
    ouvrirModale(`Revue · semaine ${R.numeroSemaine(r.semaine)}`, corps, '<button class="btn primaire" value="copier">Copier le texte</button><button class="btn" value="modifier">Modifier</button><button class="btn" value="telecharger">Fichier .txt</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (_, bouton) => {
      if (bouton === 'copier') { copier(texte, 'Revue copiée : colle-la où tu veux.'); return; }
      if (bouton === 'telecharger') { telecharger(texte, 'text/plain;charset=utf-8', `revue-${r.semaine}.txt`); return ''; }
      if (bouton === 'modifier') { if (commencerRevue(r.id)) { sauver(); changerVue('revue'); } return; }
      if (bouton !== 'supprimer') return;
      if (!confirm(`Supprimer la revue de la semaine ${R.numeroSemaine(r.semaine)} ? Le journal est gardé.`)) return '';
      retenir(); E.revues = E.revues.filter((x) => x.id !== r.id); sauver(); rendre();
      toast('Revue supprimée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleJour(date) {
    const x = { date, ...(E.journal[date] || { texte: '', humeur: null }) };
    const corps = `<label class="champ">Ta ligne<input name="texte" maxlength="${R.MAX_LIGNE}" value="${esc(x.texte)}" autocomplete="off"></label>
      <fieldset class="champ"><legend>Humeur <small>facultatif</small></legend>${choixHumeur(date, x.humeur)}</fieldset>`;
    ouvrirModale(majuscule(fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Fermer</button>', (f) => {
      retenir(); R.ecrireJournal(E, date, { texte: f.get('texte'), humeur: E.journal[date]?.humeur ?? null }); sauver(); rendre(); toast('Journal enregistré.');
    });
  }

  function modaleEcheance() {
    const t = auj();
    const corps = `<label class="champ">Date<input type="date" name="date" value="${ajout(t, 1)}" required></label>
      <label class="champ">Rendez-vous ou échéance<input name="texte" maxlength="120" placeholder="Ex. : rendu du rapport" required autocomplete="off"></label><p class="erreur" role="alert"></p>`;
    ouvrirModale('Rendez-vous ou échéance', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = String(f.get('date') || ''), texte = String(f.get('texte') || '').trim();
      if (!R.dateValide(date)) return 'Choisis une date.';
      if (!texte) return 'Décris le rendez-vous en quelques mots.';
      retenir(); E.echeances.push({ id: R.nouvelId(), date, texte, fait: false, revue: null }); sauver(); rendre();
      toast('Ajouté à « À venir ».', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleQuestions() {
    const masquees = new Set(E.questionsMasquees);
    const corps = `<p class="aide">Chaque semaine, la revue propose une question par étape, à tour de rôle. Décoche celles qui ne te parlent pas et ajoute les tiennes (une par ligne).</p>
      ${B.etapes.map((x) => `<fieldset class="choix-theme"><legend>${esc(x.nom)}</legend>
        ${B.questions[x.id].map((q, i) => `<label class="case"><input type="checkbox" name="q-${x.id}-${i}" ${masquees.has(q) ? '' : 'checked'}> ${esc(q)}</label>`).join('')}
        <label class="champ">Mes questions <small>une par ligne</small><textarea name="perso-${x.id}" rows="2" maxlength="1200">${esc((E.questionsPerso[x.id] || []).join('\n'))}</textarea></label></fieldset>`).join('')}`;
    ouvrirModale('Questions de revue', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      E.questionsMasquees = B.etapes.flatMap((x) => B.questions[x.id].filter((q, i) => f.get(`q-${x.id}-${i}`) !== 'on'));
      E.questionsPerso = Object.fromEntries(B.etapes.map((x) => [x.id, R.lignes(f.get(`perso-${x.id}`))]).filter(([, l]) => l.length));
      sauver(); rendre(); toast('Questions enregistrées.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const nbPerso = Object.values(E.questionsPerso).reduce((s, l) => s + l.length, 0);
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Jour de la revue <small>rappelé à l'ouverture ce jour-là, aucune notification</small><select name="jour">${[1, 2, 3, 4, 5, 6, 7].map((j) => `<option value="${j}" ${E.jourRevue === j ? 'selected' : ''}>${majuscule(B.jours[j])}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Questions de revue <small class="discret">${E.questionsMasquees.length} masquée${E.questionsMasquees.length > 1 ? 's' : ''}, ${nbPerso} personnelle${nbPerso > 1 ? 's' : ''}</small></h3>
        <div class="rang"><button class="btn petit" type="button" data-action="questions">Choisir mes questions</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="export-texte">Tout en texte (.txt)</button><button class="btn petit" type="button" data-action="exporter">Copie complète (JSON)</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(B.methode.revue)} ${esc(B.methode.humeur)}</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      const j = Number(f.get('jour'));
      if (j >= 1 && j <= 7) E.jourRevue = j;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.revues) || !d.journal || typeof d.journal !== 'object') throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.revues.length, 'revue')}, ${pluriel(Object.keys(d.journal).length, 'jour')} de journal) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de la revue hebdomadaire.'); }
    });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function copier(texte, message) {
    (navigator.clipboard?.writeText(texte) || Promise.reject()).then(() => toast(message), () => ouvrirModale('Texte à copier', `<label class="champ">Sélectionne et copie ce texte<textarea rows="14" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>'));
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `revue-hebdo-${auj()}.json`);
  const exporterTexte = () => telecharger(R.texteHistorique(E, B, auj()), 'text/plain;charset=utf-8', `revue-hebdo-${auj()}.txt`);

  // ---------- Infobulles des graphiques ----------
  let infobulle = null;
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((zone) => {
      const montrer = (el) => {
        document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol'));
        el.classList.add('survol');
        if (!infobulle) { infobulle = document.createElement('div'); infobulle.className = 'infobulle'; infobulle.setAttribute('role', 'tooltip'); }
        zone.appendChild(infobulle);
        infobulle.innerHTML = el.dataset.info;
        const rz = zone.getBoundingClientRect(), re = el.getBoundingClientRect();
        const cx = re.left - rz.left + re.width / 2;
        const x = Math.min(rz.width - infobulle.offsetWidth - 8, Math.max(8, cx - infobulle.offsetWidth / 2));
        infobulle.style.left = `${x}px`;
        infobulle.style.top = `${Math.max(8, re.top - rz.top + 20)}px`;
      };
      const cacher = () => { infobulle?.remove(); document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      zone.querySelectorAll('[data-info]').forEach((el) => {
        if (!el.dataset.info) return;
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('pointerleave', cacher);
        el.addEventListener('blur', cacher);
      });
    });
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
      <p>Enregistre ta revue sur ton écran d'accueil : ton journal s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    minuterieToast = setTimeout(() => { el.hidden = true; }, act ? 7000 : 5000);
  }

  // ---------- Actions ----------
  const decalerMois = (k) => { const [a, m] = moisVue.split('-').map(Number); const d = new Date(a, m - 1 + k, 1); moisVue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; rendre(); };
  const trouverPrio = (id) => { for (const r of E.revues) { const p = r.priorites.find((x) => x.id === id); if (p) return p; } return null; };
  const etape = (k) => { lireChampsRevue(); E.brouillon.etape += k; sauver(); rendre(); window.scrollTo({ top: 0 }); };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    const b = E?.brouillon;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); vue = 'semaine'; rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'choix-jour': accueil.jour = Number(el.dataset.j); ecranAccueil(); document.querySelector(`[data-action="choix-jour"][data-j="${accueil.jour}"]`)?.focus(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); if (vue === 'revue') { lireChampsRevue(); sauver(); } changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'questions': modaleQuestions(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'export-texte': exporterTexte(); break;
      case 'fermer': modale().close(); break;
      // Journal
      case 'humeur': {
        const date = el.dataset.date, v = Number(el.dataset.v);
        const champ = document.querySelector(`[data-journal="${date}"]`);
        const x = E.journal[date] || { texte: '', humeur: null };
        R.ecrireJournal(E, date, { texte: champ ? champ.value : x.texte, humeur: x.humeur === v ? null : v });
        sauver();
        if (modale().open) { const g = el.closest('.humeurs'); g.outerHTML = choixHumeur(date, E.journal[date]?.humeur ?? null); }
        else { if (vue === 'revue') lireChampsRevue(); rendre(); document.querySelector(`[data-action="humeur"][data-date="${date}"][data-v="${v}"]`)?.focus({ preventScroll: true }); }
        break;
      }
      case 'mois-prec': decalerMois(-1); break;
      case 'mois-suiv': decalerMois(1); break;
      case 'mois-auj': moisVue = auj().slice(0, 7); rendre(); break;
      case 'voir-jour': modaleJour(el.dataset.date); break;
      // Priorités et échéances
      case 'prio-etat': { const p = trouverPrio(id); if (p) { retenir(); p.etat = R.etatPrioSuivant(p.etat); sauver(); rendre(); document.querySelector(`[data-action="prio-etat"][data-id="${id}"]`)?.focus({ preventScroll: true }); } break; }
      case 'prio-fixer': { const p = trouverPrio(id); if (p) { lireChampsRevue(); p.etat = p.etat === el.dataset.etat ? null : el.dataset.etat; sauver(); rendre(); document.querySelector(`[data-action="prio-fixer"][data-id="${id}"][data-etat="${el.dataset.etat}"]`)?.focus({ preventScroll: true }); } break; }
      case 'echeance-nouvelle': modaleEcheance(); break;
      case 'ech-fait': { const x = E.echeances.find((y) => y.id === id); if (x) { retenir(); x.fait = true; if (vue === 'revue') lireChampsRevue(); sauver(); rendre(); toast(`« ${x.texte} » retiré de la liste.`, { libelle: 'Annuler', faire: annuler }); } break; }
      // Revue guidée
      case 'revue': if (b) changerVue('revue'); else if (commencerRevue()) { sauver(); changerVue('revue'); } break;
      case 'revue-reprendre': changerVue('revue'); break;
      case 'revue-modifier': if (commencerRevue(id)) { sauver(); changerVue('revue'); } break;
      case 'revue-suiv': etape(1); break;
      case 'revue-prec': etape(-1); break;
      case 'revue-quitter': lireChampsRevue(); sauver(); changerVue('semaine'); toast('Revue gardée : reprends-la quand tu veux depuis la page Semaine.'); break;
      case 'revue-abandon': if (b.edition || confirm('Abandonner cette revue ? Ce que tu as écrit sera perdu (le journal est gardé).')) { E.brouillon = null; sauver(); changerVue('semaine'); } break;
      case 'revue-fin': terminerRevue(); break;
      case 'autre-question': { lireChampsRevue(); const k = el.dataset.etape; b.decalages[k] = (b.decalages[k] || 0) + 1; if (b.questions[k] && !b.questions[k].reponse?.trim()) delete b.questions[k]; else if (b.questions[k]) { toast('Efface ta réponse pour changer de question.'); break; } sauver(); rendre(); break; }
      case 'ligne-plus': { lireChampsRevue(); b[el.dataset.cle].push(''); sauver(); rendre(); document.querySelector(`[data-b="${el.dataset.cle}"][data-i="${b[el.dataset.cle].length - 1}"]`)?.focus(); break; }
      case 'prio-reprendre': { lireChampsRevue(); const i = b.priorites.findIndex((x) => !x.trim()); if (i < 0) { $('#erreur-revue').textContent = 'Tes 3 priorités sont déjà remplies : efface-en une pour la remplacer.'; break; } b.priorites[i] = el.dataset.texte; sauver(); rendre(); break; }
      case 'note-revue': { lireChampsRevue(); const v = Number(el.dataset.v); b[el.dataset.cle] = b[el.dataset.cle] === v ? null : v; sauver(); rendre(); document.querySelector(`[data-action="note-revue"][data-cle="${el.dataset.cle}"][data-v="${v}"]`)?.focus({ preventScroll: true }); break; }
      case 'agenda-retirer': lireChampsRevue(); b.agenda = b.agenda.filter((x) => x.id !== id); sauver(); rendre(); break;
      // Historique
      case 'voir-revue': if (modale().open) modale().close(); modaleRevue(id); break;
      default: break;
    }
  });

  // Ajout d'un rendez-vous pendant la revue ; recherche dans l'historique.
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-ajout-agenda]');
    if (f && E?.brouillon) {
      e.preventDefault();
      const date = f.date.value, texte = f.texte.value.trim();
      if (!R.dateValide(date) || !texte) { $('#erreur-revue').textContent = 'Choisis une date et décris le rendez-vous.'; return; }
      lireChampsRevue();
      E.brouillon.agenda.push({ id: R.nouvelId(), date, texte });
      sauver(); rendre();
      document.querySelector('[data-ajout-agenda] [name="texte"]')?.focus();
      return;
    }
    if (e.target.closest('[data-recherche]')) e.preventDefault();
  });

  // Journal : enregistré à la sortie du champ et après une pause de frappe (sans re-rendu, le focus reste).
  const minuteriesJournal = {};
  function garderJournal(champ) {
    const date = champ.dataset.journal;
    const avant = E.journal[date]?.texte || '';
    if (avant === champ.value.replace(/\s+/g, ' ').trim()) return;
    R.ecrireJournal(E, date, { texte: champ.value, humeur: E.journal[date]?.humeur ?? null });
    champ.closest('.jl')?.classList.toggle('rempli', Boolean(E.journal[date]));
    sauver();
  }
  document.addEventListener('input', (e) => {
    if (e.target.matches('#recherche')) { recherche = e.target.value; const res = recherche.trim().length >= 2 ? R.rechercher(E, recherche) : null; if (res) { const s = (x) => { const i = R.plier(x).indexOf(R.plier(recherche.trim())); return i < 0 ? esc(x) : `${esc(x.slice(0, i))}<mark>${esc(x.slice(i, i + recherche.trim().length))}</mark>${esc(x.slice(i + recherche.trim().length))}`; }; $('#resultats').innerHTML = blocResultats(res, s); } else if (!recherche.trim()) { rendre(); $('#recherche').focus(); } return; }
    if (e.target.matches('[data-journal]')) { const c = e.target; clearTimeout(minuteriesJournal[c.dataset.journal]); minuteriesJournal[c.dataset.journal] = setTimeout(() => garderJournal(c), 800); return; }
    if (E?.brouillon && e.target.closest('.revue')) { clearTimeout(minuteriesJournal.revue); minuteriesJournal.revue = setTimeout(() => { lireChampsRevue(); sauver(); }, 500); }
  });
  document.addEventListener('change', (e) => { if (e.target.matches('[data-journal]')) { clearTimeout(minuteriesJournal[e.target.dataset.journal]); garderJournal(e.target); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-journal]')) { e.preventDefault(); garderJournal(e.target); const l = [...document.querySelectorAll('[data-journal]')]; const i = l.indexOf(e.target); (l[i + 1] || e.target).focus(); }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  let largeurAvant = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeurAvant) > 40 && E && $('#vue') && !modale().open && vue === 'tendance') { largeurAvant = window.innerWidth; rendre(); } });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'revue' && !saisieEnCours()) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

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
  window.__revueHebdo = { etat: () => E, regles: R };
  init();
})();
