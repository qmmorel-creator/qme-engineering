// Budget commun QME : dépenses partagées d'un foyer, soldes et équilibrage, synchronisés par clé.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.BCM;
  const API = '/api/templates';
  const PRODUIT = 'BCM';
  const CLE_CODE = 'qme-bcm-code';
  const CLE_CACHE = 'qme-bcm-cache';
  const CLE_DEMO = 'qme-bcm-demo';
  const CODE_DEMO = 'DEMO';
  const MAX_MEMBRES = 6;

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const maintenant = () => new Date().toISOString();
  const eur = (c, o) => R.euros(c, o);
  // Valeur d'un champ montant : 1234,5 (sans symbole), pour la saisie.
  const versSaisie = (c) => (Number.isInteger(c) ? `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}` : '');
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  // Dates locales AAAA-MM-JJ (comparables comme des chaînes).
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j || 1); };
  const auj = () => iso(new Date());
  const moisCourant = () => auj().slice(0, 7);
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const nomMois = (m, court = false) => versDate(`${m}-01`).toLocaleDateString('fr-FR', court ? { month: 'short' } : { month: 'long', year: 'numeric' });
  const quand = (s) => {
    const t = auj();
    if (s === t) return 'aujourd\'hui';
    if (s === iso(new Date(Date.now() - 86400000))) return 'hier';
    return fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const hex = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[6]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const modeInfo = (id) => B.modes.find((m) => m.id === id) || B.modes[0];

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code BCM) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'soldes';
  let moisVue = null;
  let filtres = { mois: null, payeur: '', categorie: '' };
  let annulation = null;

  const etatVide = () => ({
    version: 1, foyer: { nom: '', modele: null, modifLe: '' }, reglages: { modeDefaut: 'egale', modifLe: '' },
    membres: [], categories: [], depenses: [], recurrentes: [], virements: [], supprimes: {},
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return {
      ...v, ...d,
      foyer: { ...v.foyer, ...(d.foyer || {}) }, reglages: { ...v.reglages, ...(d.reglages || {}) },
      membres: tab(d.membres), categories: tab(d.categories), depenses: tab(d.depenses).filter((x) => Number.isInteger(x?.montant)),
      recurrentes: tab(d.recurrentes), virements: tab(d.virements), supprimes: d.supprimes && typeof d.supprimes === 'object' ? d.supprimes : {},
    };
  };
  const membre = (id) => E.membres.find((m) => m.id === id);
  const nom = (id) => membre(id)?.nom || 'Ancien membre';
  const categorie = (id) => E.categories.find((c) => c.id === id);
  const nomCat = (id) => categorie(id)?.nom || 'Sans catégorie';
  const toucher = (x) => { x.modifLe = maintenant(); return x; };
  function supprimer(cle, id) {
    E[cle] = E[cle].filter((x) => x.id !== id);
    E.supprimes[id] = maintenant();
  }

  // Dépenses récurrentes dues jusqu'à aujourd'hui (au lancement et au retour sur l'onglet).
  function generer() {
    if (!E) return 0;
    const n = R.genererRecurrentes(E.recurrentes, E.depenses, E.supprimes, auj(), E.membres);
    if (n.length) E.depenses.push(...n);
    return n.length;
  }

  const soldesActuels = () => R.soldes(E.membres, E.depenses, E.virements);
  const moisAvecDonnees = () => [...new Set([...E.depenses.map((d) => R.moisDe(d.date)), moisCourant()])].sort().reverse();

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

  // Conflit : un autre appareil du foyer a écrit entre-temps. On fusionne les deux versions
  // (aucune dépense perdue), on prévient, puis on renvoie la version fusionnée.
  function fusionnerAvec(serveur) {
    const { etat, conflits } = R.fusionner(E, serveur);
    E = normaliser(etat);
    session.base = serveur.majLe;
    generer();
    cache(true);
    rendre();
    const texte = conflits
      ? `Un autre appareil a modifié le budget en même temps. Les deux versions sont réunies ; pour ${pluriel(conflits, 'élément modifié')} des deux côtés, la modification la plus récente est gardée.`
      : 'Un autre appareil a enregistré en même temps : ses modifications sont réunies aux tiennes.';
    toast(texte);
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409 && corps?.donnees) {
        fusionnerAvec(corps.donnees);
        aRenvoyer = true;
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        cache(false);
        majSync('ok');
      }
    } catch {
      majSync('horsligne');
    } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; envoyer(); }
    }
  }

  async function rafraichir() {
    // Retour sur l'onglet ou relève périodique : récupère la version d'un autre appareil du foyer.
    if (session.demo || !session.jeton || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut !== 200 || !corps?.donnees || corps.donnees.majLe === session.base) return;
      if (etatSync === 'attente' || etatSync === 'horsligne') { fusionnerAvec(corps.donnees); envoyer(); return; }
      E = normaliser(corps.donnees);
      session.base = corps.donnees.majLe;
      const n = generer();
      cache(n > 0);
      if (!modale().open) rendre();
      if (n) sauver();
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
  // Code BCM-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  // Code interne QME (BCM, REV…) : 3 lettres dont au moins une hors A-F (une clé Gumroad est hexadécimale).
  // Les codes d'autres templates sont reconnus pour être refusés avec un message clair.
  const interne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (interne(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (interne(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après l\'achat.');
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
    // Modifications faites hors ligne : gardées telles quelles si le serveur n'a pas bougé,
    // sinon fusionnées avec la version d'un autre appareil (rien n'est perdu).
    if (c && c.code === session.code && c.nonEnvoye && c.etat) {
      if (!donnees || c.base === donnees.majLe) { E = normaliser(c.etat); session.base = donnees?.majLe ?? null; }
      else { E = normaliser(R.fusionner(normaliser(c.etat), donnees).etat); session.base = donnees.majLe; }
      generer();
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.membres.length) {
      const n = generer();
      cache(n > 0); demarrer();
      if (n) sauver();
    } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    generer();
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

  // ---------- Données de démonstration (relatives à aujourd'hui) ----------
  // Couple au prorata des revenus ; loyer et factures récurrents depuis 3 mois ; un week-end
  // partagé en parts ; un restaurant en montants ; un virement d'équilibrage fait au début du mois ;
  // le mois le plus ancien du graphique est vide (avant l'installation).
  function donneesDemo() {
    E = etatVide();
    const t = auj(), m0 = moisCourant();
    const m = (n) => R.ajoutMois(m0, n);
    const jour = (mois, j) => `${mois}-${deux(Math.min(j, R.joursDansMois(mois)))}`;
    E.foyer = { nom: 'Camille et Sami', modele: 'couple', modifLe: '' };
    E.reglages = { modeDefaut: 'prorata', modifLe: '' };
    E.membres = [
      { id: 'cam', nom: 'Camille', couleur: 'bleu', revenu: 260000, modifLe: '' },
      { id: 'sam', nom: 'Sami', couleur: 'jaune', revenu: 190000, modifLe: '' },
    ];
    const modele = B.modeles[0];
    E.categories = modele.categories.map((id) => ({ id, nom: B.categories.find((c) => c.id === id).nom, modifLe: '' }));
    const tous = ['cam', 'sam'];
    E.recurrentes = [
      { id: 'loyer', libelle: 'Loyer et charges', montant: 98000, payeur: 'cam', categorie: 'logement', jour: 5, debut: m(-3), fin: null, actif: true, repartition: { mode: 'prorata', participants: tous }, modifLe: '' },
      { id: 'elec', libelle: 'Électricité', montant: 7400, payeur: 'sam', categorie: 'energie', jour: 10, debut: m(-3), fin: null, actif: true, repartition: { mode: 'prorata', participants: tous }, modifLe: '' },
      { id: 'box', libelle: 'Internet', montant: 2999, payeur: 'sam', categorie: 'abonnements', jour: 8, debut: m(-3), fin: null, actif: true, repartition: { mode: 'egale', participants: tous }, modifLe: '' },
      { id: 'assu', libelle: 'Assurance habitation', montant: 1840, payeur: 'cam', categorie: 'assurances', jour: 15, debut: m(-3), fin: null, actif: true, repartition: { mode: 'egale', participants: tous }, modifLe: '' },
    ];
    const ajouter = (date, libelle, montant, payeur, cat, repartition = { mode: 'prorata', participants: tous }) => {
      if (date > t) return;
      const res = R.repartir(montant, E.membres.filter((x) => repartition.participants.includes(x.id)), repartition.mode, repartition);
      E.depenses.push({ id: uid(), date, libelle, montant, payeur, categorie: cat, repartition, quotes: res.quotes, modifLe: '' });
    };
    // Installation (mois −4) : achats ponctuels, aucune récurrente encore.
    ajouter(jour(m(-4), 18), 'Meubles de cuisine', 62000, 'cam', 'maison', { mode: 'egale', participants: tous });
    ajouter(jour(m(-4), 22), 'Déménagement (location du camion)', 14900, 'sam', 'transport', { mode: 'egale', participants: tous });
    ajouter(jour(m(-4), 27), 'Premières courses', 11870, 'sam', 'courses');
    // Courses régulières, payées à tour de rôle.
    const courses = [8420, 6315, 10290, 4785, 9160, 7340, 5590, 11205, 6880, 8045, 7710, 9930, 5240, 10480];
    let k = 0;
    for (let i = -3; i <= 0; i++) {
      for (const j of [3, 11, 19, 26]) ajouter(jour(m(i), j), k % 3 === 2 ? 'Marché' : 'Courses de la semaine', courses[k % courses.length], k++ % 2 ? 'sam' : 'cam', 'courses');
    }
    ajouter(jour(m(-2), 14), 'Week-end à la mer (avec le frère de Sami)', 45000, 'sam', 'sorties', { mode: 'parts', participants: tous, parts: { cam: 1, sam: 2 } });
    ajouter(jour(m(-1), 21), 'Restaurant', 6400, 'cam', 'sorties', { mode: 'montants', participants: tous, montants: { cam: 4000, sam: 2400 } });
    ajouter(jour(m(-1), 9), 'Pharmacie', 2360, 'cam', 'sante', { mode: 'egale', participants: tous });
    ajouter(jour(m(-3), 24), 'Lampe du salon', 8900, 'sam', 'maison', { mode: 'egale', participants: tous });
    ajouter(jour(m(0), 2), 'Cinéma', 2380, 'sam', 'sorties', { mode: 'egale', participants: tous });
    ajouter(t, 'Boulangerie', 840, 'cam', 'courses', { mode: 'egale', participants: tous });
    // Récurrentes jusqu'à aujourd'hui, avec les vraies règles.
    E.depenses.push(...R.genererRecurrentes(E.recurrentes, E.depenses, {}, t, E.membres));
    // Virement d'équilibrage : solde de fin du mois dernier réglé le 1er du mois.
    const avant = E.depenses.filter((d) => d.date < `${m0}-01`);
    for (const v of R.equilibrer(R.soldes(E.membres, avant, []))) {
      E.virements.push({ id: uid(), date: `${m0}-01`, de: v.de, a: v.a, montant: v.montant, note: 'Équilibrage du mois dernier', modifLe: '' });
    }
    E.depenses.sort((a, b) => a.date.localeCompare(b.date));
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Budget commun · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="120" cy="150" r="120" fill="#1D4E89"/>
          <circle cx="250" cy="150" r="120" fill="#F5B400"/>
          <path d="M185 49.1 A120 120 0 0 1 185 250.9 A120 120 0 0 1 185 49.1 Z" fill="#141414"/>
          <rect x="390" y="30" width="160" height="240" fill="#D9302A"/>
          <rect x="390" y="140" width="160" height="20" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Budget commun · couple, colocation, famille</p>
          <h1>Qui doit combien à qui, sans calculette.</h1>
          <p>Chacun note ce qu'il paie, à parts égales, au prorata des revenus ou en parts. Les soldes se tiennent à jour et l'équilibrage tient en un virement.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton budget commun</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après l'achat. Chaque membre du foyer peut l'ouvrir sur son téléphone avec la même clé : tout le foyer voit les mêmes comptes.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir le budget</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de budget commun ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans l'e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const fin = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (fin) champ.setSelectionRange(champ.value.length, champ.value.length);
    });
    $('#form-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = formaterCode(champ.value);
      const err = $('#erreur-code');
      const bouton = e.target.querySelector('button[type=submit]');
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = interne(code) ? 'Code incomplet : 3 lettres suivies de 4 blocs de 4 caractères.' : 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir le budget'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, modele: null, nomFoyer: '', membres: [], mode: 'egale' };

  function choisirModele(id) {
    const mo = B.modeles.find((x) => x.id === id);
    accueil.modele = id;
    accueil.mode = mo ? mo.mode : 'egale';
    const noms = mo ? mo.membres : ['Personne 1', 'Personne 2'];
    accueil.membres = noms.map((n, i) => ({ nom: accueil.membres[i]?.nom || '', place: n, revenu: accueil.membres[i]?.revenu || '' }));
  }

  function ecranAccueil() {
    document.body.classList.remove('app');
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton budget commun.</h1>
        <p class="intro">Choisis le modèle le plus proche de ton foyer : il règle le nombre de personnes, la répartition par défaut et les catégories. Tout reste modifiable.</p>
        <div class="filieres" role="group" aria-label="Modèle de foyer">
          ${B.modeles.map((x, i) => `<button type="button" class="filiere" style="--c:${['#1D4E89', '#F5B400', '#D9302A'][i]}" data-action="modele" data-id="${x.id}" aria-pressed="${a.modele === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="modele" data-id="libre" aria-pressed="${a.modele === 'libre'}"><b>Autre foyer</b><span>Je règle tout moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.modele ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(B.modeles.find((x) => x.id === a.modele)?.nom || 'Foyer personnalisé')}</p>
        <h1>Qui partage les dépenses ?</h1>
        <p class="intro">De 2 à ${MAX_MEMBRES} personnes. Les revenus sont facultatifs : ils servent seulement à la répartition au prorata.</p>
        <form id="form-accueil" novalidate>
          <div class="membres-saisie">
            ${a.membres.map((m, i) => `
              <div class="membre-saisie" style="--c:${B.couleurs[i].hex}">
                <i aria-hidden="true"></i>
                <label class="champ">Prénom<input name="nom-${i}" data-i="${i}" data-champ="nom" value="${esc(m.nom)}" placeholder="${esc(m.place)}" maxlength="30" autocomplete="off"></label>
                <label class="champ">Revenu mensuel net<small>Facultatif</small><input name="revenu-${i}" data-i="${i}" data-champ="revenu" value="${esc(m.revenu)}" inputmode="decimal" placeholder="Ex. : 2 100" autocomplete="off"></label>
                ${a.membres.length > 2 ? `<button type="button" class="btn-icone" data-action="accueil-retirer" data-i="${i}" aria-label="Retirer ${esc(m.nom || m.place)}">×</button>` : '<span></span>'}
              </div>`).join('')}
          </div>
          ${a.membres.length < MAX_MEMBRES ? '<button type="button" class="btn petit" data-action="accueil-ajouter">+ Ajouter une personne</button>' : ''}
          <fieldset class="champ choix-mode"><legend>Répartition par défaut des nouvelles dépenses</legend>
            <div class="segments">${B.modes.filter((x) => x.id !== 'montants').map((x) => `<label><input type="radio" name="mode" value="${x.id}" ${a.mode === x.id ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div>
            <small>Modifiable pour chaque dépense, et à tout moment dans l'onglet Foyer.</small>
          </fieldset>
          <p class="erreur" id="erreur-accueil" role="alert"></p>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer le budget commun</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#form-accueil')?.addEventListener('input', (e) => {
      const el = e.target;
      if (el.name === 'mode') accueil.mode = el.value;
      else if (el.dataset.champ) accueil.membres[Number(el.dataset.i)][el.dataset.champ] = el.value;
    });
    $('#form-accueil')?.addEventListener('submit', (e) => { e.preventDefault(); terminerAccueil(); });
  }

  function terminerAccueil() {
    const a = accueil;
    const err = $('#erreur-accueil');
    const membres = [];
    for (const [i, m] of a.membres.entries()) {
      const revenu = String(m.revenu).trim() ? R.versCentimes(m.revenu) : null;
      if (revenu !== null && (revenu === null || revenu < 0)) { err.textContent = `Revenu illisible pour la personne ${i + 1}.`; return; }
      if (String(m.revenu).trim() && revenu === null) { err.textContent = `Revenu illisible pour la personne ${i + 1}.`; return; }
      membres.push({ id: uid(), nom: (m.nom.trim() || m.place).slice(0, 30), couleur: B.couleurs[i].id, revenu, modifLe: maintenant() });
    }
    if (new Set(membres.map((m) => m.nom.toLowerCase())).size !== membres.length) { err.textContent = 'Deux personnes portent le même prénom : différencie-les.'; return; }
    const mo = B.modeles.find((x) => x.id === a.modele);
    E = etatVide();
    E.foyer = { nom: '', modele: a.modele, modifLe: maintenant() };
    E.reglages = { modeDefaut: a.mode, modifLe: maintenant() };
    E.membres = membres;
    E.categories = (mo ? mo.categories : B.categories.map((c) => c.id)).map((id) => ({ id, nom: B.categories.find((c) => c.id === id).nom, modifLe: maintenant() }));
    accueil = { etape: 1, modele: null, nomFoyer: '', membres: [], mode: 'egale' };
    sauver();
    demarrer();
    setTimeout(() => modaleDepense(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    soldes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="6" fill="currentColor"/><circle cx="16" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    depenses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    mois: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    recurrentes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    foyer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['soldes', 'Soldes'], ['depenses', 'Dépenses'], ['mois', 'Mois'], ['recurrentes', 'Récurrentes'], ['foyer', 'Foyer']];
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="30" cy="48" r="30" fill="#1D4E89"/><circle cx="62" cy="48" r="30" fill="#F5B400"/><path d="M46 22.6a30 30 0 0 1 0 50.8a30 30 0 0 1 0-50.8Z" fill="#141414"/></svg>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Budget<br>commun</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, n]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${n}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Budget commun`;
    $('#vue').innerHTML = { soldes: vueSoldes, depenses: vueDepenses, mois: vueMois, recurrentes: vueRecurrentes, foyer: vueFoyer }[vue]();
    if (vue === 'mois') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const pastille = (id) => `<i class="pastille" style="--c:${hex(membre(id)?.couleur)}" aria-hidden="true"></i>`;
  const AVERTISSEMENT = '<p class="avertissement"><b>À savoir.</b> Les soldes sont calculés uniquement à partir de ce que le foyer saisit : vérifie-les avant tout virement. Cet outil ne se connecte à aucune banque et ne donne pas de conseil financier.</p>';

  // Soldes
  function vueSoldes() {
    const s = soldesActuels();
    const plan = R.equilibrer(s);
    const t = auj();
    const total = (id) => E.depenses.filter((d) => d.payeur === id).reduce((x, d) => x + d.montant, 0);
    const titre = !E.depenses.length ? 'Ajoute ta première dépense.'
      : !plan.length ? '<mark>Tout est équilibré.</mark>'
        : plan.length === 1 ? `${esc(nom(plan[0].de))} doit <mark>${eur(plan[0].montant)}</mark> à ${esc(nom(plan[0].a))}.`
          : `<mark>${pluriel(plan.length, 'virement')}</mark> pour tout équilibrer.`;
    const max = Math.max(1, ...Object.values(s).map(Math.abs));
    const cartes = E.membres.map((m) => {
      const v = s[m.id] || 0;
      return `<li class="solde ${v > 0 ? 'credit' : v < 0 ? 'dette' : ''}" style="--c:${hex(m.couleur)}">
        <div class="solde-nom"><i></i><b>${esc(m.nom)}</b></div>
        <div class="solde-montant">${v === 0 ? '0,00 €' : eur(v, { signe: true })}</div>
        <p>${v > 0 ? 'Le foyer lui doit cette somme.' : v < 0 ? 'Doit cette somme au foyer.' : 'À jour.'} A payé ${eur(total(m.id))} en tout.</p>
        <div class="jauge" aria-hidden="true"><span style="${v >= 0 ? 'left:50%' : `right:50%`};width:${(Math.abs(v) / max) * 50}%"></span></div>
      </li>`;
    }).join('');
    const virements = plan.map((v, i) => `<li class="virement-prevu">
        <span class="de">${pastille(v.de)}${esc(nom(v.de))}</span><span class="fleche" aria-label="paie à">→</span><span class="a">${pastille(v.a)}${esc(nom(v.a))}</span>
        <b>${eur(v.montant)}</b>
        <button class="btn petit" data-action="virement-fait" data-i="${i}">C'est fait</button></li>`).join('');
    const mc = R.bilanMois(E.depenses, moisCourant(), E.membres);
    const recents = [...E.virements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${esc(E.foyer.nom || 'Budget commun')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          <p class="sous">Ce mois-ci : ${eur(mc.total)} de dépenses communes (${pluriel(mc.nb, 'dépense')}).</p>
          <div class="actions">
            <button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Ajouter une dépense</button>
            <button class="btn" data-action="virement-nouveau">Noter un virement</button>
          </div>
        </div>
        <aside class="equilibre-carte ${plan.length ? '' : 'calme'}">
          <p class="surtitre">Pour équilibrer</p>
          ${plan.length ? `<ul>${virements}</ul><p class="petit-texte">Le moins de virements possible. « C'est fait » l'enregistre et remet les soldes à zéro.</p>` : '<p class="vide-equilibre">Aucun virement à faire : les comptes sont à jour.</p>'}
        </aside>
      </section>
      <h2 class="titre-section">Soldes <span>Positif : on lui doit de l'argent. Négatif : il ou elle en doit.</span></h2>
      <ul class="soldes">${cartes}</ul>
      <h2 class="titre-section">Virements enregistrés <span>${E.virements.length ? pluriel(E.virements.length, 'virement') : ''}</span></h2>
      ${recents.length ? `<div class="liste">${recents.map((v) => `
        <div class="ligne"><i style="--c:${hex(membre(v.de)?.couleur)}"></i><div><b>${esc(nom(v.de))} → ${esc(nom(v.a))}</b><span>${quand(v.date)}${v.note ? ` · ${esc(v.note)}` : ''}</span></div>
        <div class="ligne-droite"><b class="montant">${eur(v.montant)}</b><button class="btn lien" data-action="virement-suppr" data-id="${v.id}" aria-label="Supprimer ce virement">Supprimer</button></div></div>`).join('')}</div>`
        : '<p class="vide-texte">Aucun virement pour l\'instant. Quand quelqu\'un rembourse, note-le ici ou touche « C\'est fait ».</p>'}
      ${AVERTISSEMENT}`;
  }

  // Dépenses
  function vueDepenses() {
    const mois = moisAvecDonnees();
    if (filtres.mois === null) filtres.mois = moisCourant();
    const liste = E.depenses.filter((d) => (filtres.mois === 'tout' || R.moisDe(d.date) === filtres.mois)
      && (!filtres.payeur || d.payeur === filtres.payeur) && (!filtres.categorie || d.categorie === filtres.categorie))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.modifLe || '').localeCompare(a.modifLe || ''));
    const total = liste.reduce((s, d) => s + d.montant, 0);
    const parJour = {};
    liste.forEach((d) => { (parJour[d.date] ||= []).push(d); });
    const lignes = Object.entries(parJour).map(([j, ds]) => `
      <h3 class="jour-groupe">${quand(j)}</h3>
      ${ds.map((d) => `<button class="ligne depense" data-action="depense-modifier" data-id="${d.id}">
        <i style="--c:${hex(membre(d.payeur)?.couleur)}"></i>
        <div><b>${esc(d.libelle)}</b><span>${esc(nomCat(d.categorie))} · payé par ${esc(nom(d.payeur))} · ${esc(modeInfo(d.repartition?.mode).court)}${d.recurrente ? ' · récurrente' : ''}</span></div>
        <b class="montant">${eur(d.montant)}</b></button>`).join('')}`).join('');
    return `
      <div class="vue-tete"><div><h1>Dépenses</h1><p>Tout ce qui est payé pour le foyer. Touche une dépense pour la modifier ou changer sa répartition.</p></div>
        <div class="actions"><button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Dépense</button></div></div>
      <form class="filtres" id="filtres" aria-label="Filtres">
        <label class="champ">Mois<select name="mois"><option value="tout" ${filtres.mois === 'tout' ? 'selected' : ''}>Tous les mois</option>${mois.map((m) => `<option value="${m}" ${filtres.mois === m ? 'selected' : ''}>${nomMois(m)}</option>`).join('')}</select></label>
        <label class="champ">Payé par<select name="payeur"><option value="">Tout le monde</option>${E.membres.map((m) => `<option value="${m.id}" ${filtres.payeur === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select name="categorie"><option value="">Toutes</option>${E.categories.map((c) => `<option value="${c.id}" ${filtres.categorie === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </form>
      <p class="total-filtre"><b>${eur(total)}</b> · ${pluriel(liste.length, 'dépense')}</p>
      ${liste.length ? `<div class="liste">${lignes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune dépense ici</h3><p>${filtres.mois !== 'tout' && filtres.mois ? `Rien n'est noté pour ${nomMois(filtres.mois)} avec ces filtres.` : 'Rien ne correspond à ces filtres.'}</p><div class="actions"><button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Ajouter une dépense</button></div></div></div>`}`;
  }

  // Mois
  function vueMois() {
    const m = moisVue || moisCourant();
    const b = R.bilanMois(E.depenses, m, E.membres);
    const cats = Object.entries(b.parCategorie).sort((x, y) => y[1] - x[1]);
    const maxCat = Math.max(1, ...cats.map(([, v]) => v));
    const nav = `<div class="nav-mois"><button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">‹</button><h2>${nomMois(m)}</h2><button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant" ${m >= moisCourant() ? 'disabled' : ''}>›</button></div>`;
    const tuiles = [
      ['Dépensé ensemble', eur(b.total), `${pluriel(b.nb, 'dépense')}`, 'var(--rouge)', 'rond'],
      ['Première catégorie', cats[0] ? esc(nomCat(cats[0][0])) : '–', cats[0] ? `${eur(cats[0][1])} · ${Math.round((cats[0][1] / b.total) * 100)} %` : 'Aucune dépense', 'var(--jaune)', ''],
      ['Virements du mois', eur(E.virements.filter((v) => R.moisDe(v.date) === m).reduce((s, v) => s + v.montant, 0)), pluriel(E.virements.filter((v) => R.moisDe(v.date) === m).length, 'virement'), 'var(--bleu)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const parPersonne = E.membres.map((mb) => {
      const p = b.parMembre[mb.id] || { paye: 0, part: 0 };
      const ecart = p.paye - p.part;
      return `<tr><td><span class="nom-matiere" style="--c:${hex(mb.couleur)}"><i></i>${esc(mb.nom)}</span></td><td class="nb">${eur(p.paye)}</td><td class="nb">${eur(p.part)}</td><td class="nb ${ecart < 0 ? 'neg' : ''}">${ecart === 0 ? '0,00 €' : eur(ecart, { signe: true })}</td></tr>`;
    }).join('');
    const corps = b.nb ? `
      <div class="deux-colonnes">
        <section class="bloc"><h2 class="bloc-titre">Par personne</h2>
          <div class="defile"><table class="tableau"><thead><tr><th>Personne</th><th class="nb">A payé</th><th class="nb">Sa part</th><th class="nb">Écart</th></tr></thead><tbody>${parPersonne}</tbody></table></div>
          <p class="petit-texte">Écart positif : a avancé plus que sa part ce mois-ci. Le solde global, virements compris, est dans l'onglet Soldes.</p>
        </section>
        <section class="bloc"><h2 class="bloc-titre">Par catégorie</h2>
          <ul class="barres-cat">${cats.map(([id, v]) => `<li><span class="cat-nom">${esc(nomCat(id))}</span><span class="cat-barre" aria-hidden="true"><i style="width:${(v / maxCat) * 100}%"></i></span><b>${eur(v)}</b></li>`).join('')}</ul>
        </section>
      </div>`
      : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune dépense en ${nomMois(m)}</h3><p>Rien n'a été noté ce mois-là. Les dépenses récurrentes apparaissent d'elles-mêmes à leur date.</p><div class="actions"><button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Ajouter une dépense</button></div></div></div>`;
    return `
      <div class="vue-tete"><div><h1>Bilan du mois</h1><p>Combien le foyer a dépensé, qui a payé quoi et où va l'argent.</p></div></div>
      ${nav}
      <div class="tuiles trois">${tuiles}</div>
      ${corps}
      <h2 class="titre-section">6 derniers mois <span>Dépenses communes, par personne qui a payé</span></h2>
      ${graphique(m)}`;
  }

  function serieMois(fin) {
    return Array.from({ length: 6 }, (_, i) => {
      const m = R.ajoutMois(fin, i - 5);
      const parPayeur = {};
      E.membres.forEach((mb) => { parPayeur[mb.id] = 0; });
      E.depenses.filter((d) => R.moisDe(d.date) === m).forEach((d) => { parPayeur[d.payeur] = (parPayeur[d.payeur] || 0) + d.montant; });
      return { m, parPayeur, total: Object.values(parPayeur).reduce((s, c) => s + c, 0) };
    });
  }

  // Colonnes empilées par payeur : couleurs fixes des membres, contour encre, écart de 2 px,
  // légende, infobulle au survol et tableau accessible (la palette Bauhaus sort de la bande de
  // luminance : contours, légende et tableau compensent).
  function graphique(fin) {
    const serie = serieMois(fin);
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 210 : 240, g = L < 500 ? 46 : 60, b = 26, hz = H - b - 10;
    const maxV = Math.max(10000, ...serie.map((x) => x.total));
    // Graduations rondes en euros.
    const brut = maxV / 4 / 100;
    const puiss = 10 ** Math.floor(Math.log10(brut));
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * puiss).find((v) => v >= brut) * 100;
    const haut = pas * 4;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 6}" y="${y(i * pas) + 4}" text-anchor="end">${Math.round((i * pas) / 100).toLocaleString('fr-FR')} €</text>`).join('');
    const larg = (L - g) / serie.length;
    const w = Math.min(64, larg * 0.62);
    const cols = serie.map((s, i) => {
      const x = g + i * larg + (larg - w) / 2;
      let cumul = 0;
      const rects = E.membres.map((mb) => {
        const v = s.parPayeur[mb.id];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y1 - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${hex(mb.couleur)}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const vide = s.total ? '' : `<text class="axe" x="${x + w / 2}" y="${y(0) - 6}" text-anchor="middle">0</text>`;
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne ${s.m === fin ? 'courante' : ''}" data-i="${i}">${rects}</g>${vide}<text class="axe ${s.m === fin ? 'fort' : ''}" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${nomMois(s.m, true).replace('.', '')}</text>`;
    }).join('');
    return `<figure class="graphique" id="graphique">
      <div class="graphique-tete"><h2>Dépenses par mois</h2><div class="legende">${E.membres.map((mb) => `<span><i style="background:${hex(mb.couleur)}"></i>Payé par ${esc(mb.nom)}</span>`).join('')}</div></div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Dépenses communes par mois sur 6 mois, détail dans le tableau ci-dessous">${grilles}${cols}</svg>
      <div class="infobulle" hidden></div>
      <table class="sr-only"><caption>Dépenses par mois et par personne qui a payé</caption><thead><tr><th>Mois</th>${E.membres.map((mb) => `<th>${esc(mb.nom)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${serie.map((s) => `<tr><td>${nomMois(s.m)}</td>${E.membres.map((mb) => `<td>${eur(s.parPayeur[mb.id] || 0)}</td>`).join('')}<td>${eur(s.total)}</td></tr>`).join('')}</tbody></table>
    </figure>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const serie = serieMois(moisVue || moisCourant());
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), s = serie[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>${nomMois(s.m)} · ${eur(s.total)}</b>${s.total ? E.membres.map((mb) => `<div><i style="background:${hex(mb.couleur)}"></i>${esc(mb.nom)} : ${eur(s.parPayeur[mb.id] || 0)}</div>`).join('') : 'Aucune dépense'}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth + rz.width / 2 - 12;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '52px';
    };
    fig.querySelectorAll('.zone').forEach((z) => {
      z.addEventListener('pointerenter', () => montrer(z));
      z.addEventListener('click', () => montrer(z));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((g) => g.classList.remove('active')); });
  }

  // Récurrentes
  function vueRecurrentes() {
    const total = E.recurrentes.filter((r) => r.actif !== false).reduce((s, r) => s + r.montant, 0);
    const cartes = E.recurrentes.map((r) => {
      const derniere = E.depenses.filter((d) => d.recurrente === r.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      return `<button class="recurrente ${r.actif === false ? 'pause' : ''}" data-action="recurrente-modifier" data-id="${r.id}" style="--c:${hex(membre(r.payeur)?.couleur)}">
        <span class="rec-jour"><b>${r.jour}</b><small>du mois</small></span>
        <span class="rec-texte"><b>${esc(r.libelle)}</b><span>${esc(nomCat(r.categorie))} · payé par ${esc(nom(r.payeur))} · ${esc(modeInfo(r.repartition?.mode).nom.toLowerCase())}</span>
        <span>${r.actif === false ? 'En pause' : `Depuis ${nomMois(r.debut)}${r.fin ? ` jusqu'à ${nomMois(r.fin)}` : ''}`}${derniere ? ` · dernière le ${fmt(derniere.date)}` : ''}</span></span>
        <b class="montant">${eur(r.montant)}</b></button>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Récurrentes</h1><p>Loyer, énergie, abonnements : chaque dépense récurrente est ajoutée d'elle-même à sa date, chaque mois. Tu peux ensuite corriger le montant d'un mois dans Dépenses.</p></div>
        <div class="actions"><button class="btn primaire" data-action="recurrente-nouvelle">${ICONES.plus}Récurrente</button></div></div>
      ${E.recurrentes.length ? `<p class="total-filtre"><b>${eur(total)}</b> par mois · ${pluriel(E.recurrentes.filter((r) => r.actif !== false).length, 'récurrente active', 'récurrentes actives')}</p><div class="recurrentes">${cartes}</div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune dépense récurrente</h3><p>Ajoute le loyer ou les factures une fois : ils seront notés chaque mois à leur date, avec la bonne répartition.</p><div class="actions"><button class="btn primaire" data-action="recurrente-nouvelle">${ICONES.plus}Ajouter une récurrente</button></div></div></div>`}`;
  }

  // Foyer
  function vueFoyer() {
    const revTotal = E.membres.reduce((s, m) => s + (m.revenu || 0), 0);
    const tousRevenus = E.membres.every((m) => m.revenu > 0);
    const cartes = E.membres.map((m) => `
      <article class="matiere" style="--c:${hex(m.couleur)};--t:${texteSur(m.couleur)}">
        <div class="matiere-tete"><div><h2>${esc(m.nom)}</h2><p>${m.revenu ? `Revenu : ${eur(m.revenu)} par mois` : 'Revenu non renseigné'}</p></div><button data-action="membre-modifier" data-id="${m.id}">Modifier</button></div>
        <div class="matiere-chiffres"><div><b>${tousRevenus ? `${Math.round((m.revenu / revTotal) * 1000) / 10} %`.replace('.', ',') : '–'}</b><span>part au prorata</span></div><div><b>${E.depenses.filter((d) => d.payeur === m.id).length}</b><span>dépenses payées</span></div></div>
      </article>`).join('');
    return `
      <div class="vue-tete"><div><h1>Foyer</h1><p>Les personnes qui partagent les dépenses, leurs revenus (pour le prorata) et les catégories.</p></div>
        <div class="actions">${E.membres.length < MAX_MEMBRES ? `<button class="btn" data-action="membre-nouveau">${ICONES.plus}Personne</button>` : ''}<button class="btn" data-action="reglages">Réglages</button></div></div>
      <div class="matieres">${cartes}</div>
      ${!tousRevenus && E.membres.length ? '<p class="aide" style="margin-top:16px">Il manque au moins un revenu : les dépenses « au prorata » sont partagées à parts égales tant qu\'il n\'est pas renseigné.</p>' : ''}
      <section class="partage">
        <div><p class="surtitre">Partager avec ton foyer</p>
        <h2>Une clé, les mêmes comptes pour tous.</h2>
        <p>Chaque membre ouvre <b>qm-engineering.fr/connexion</b> sur son téléphone et saisit la même clé de licence : tout le monde voit et modifie les mêmes dépenses. Si deux personnes enregistrent en même temps, les deux versions sont réunies.</p>
        <p><b>Attention :</b> partager la clé donne un accès complet (ajouter, modifier, supprimer). Ne la donne qu'aux personnes du foyer.</p></div>
        ${session.demo ? '' : `<button class="btn jaune" data-action="copier-cle">Copier la clé</button>`}
      </section>
      <h2 class="titre-section">Catégories <span>${pluriel(E.categories.length, 'catégorie')}</span></h2>
      <div class="puces">${E.categories.map((c) => `<button class="puce" data-action="categorie-modifier" data-id="${c.id}">${esc(c.nom)}</button>`).join('')}<button class="puce ajout" data-action="categorie-nouvelle">+ Catégorie</button></div>
      <h2 class="titre-section">Règles de répartition <span>Par défaut : ${esc(modeInfo(E.reglages.modeDefaut).nom.toLowerCase())}</span></h2>
      <div class="methodes">${B.modes.map((x, i) => `
        <article class="methode" style="--c:${['#1D4E89', '#F5B400', '#D9302A', '#141414'][i]};--t:${i === 1 ? 'var(--encre)' : '#fff'}">
          <div class="methode-tete"><h2>${esc(x.nom)}</h2>${E.reglages.modeDefaut === x.id ? '<span>Par défaut</span>' : ''}</div>
          <p>${esc(x.principe)}</p><p class="exemple">${esc(x.exemple)}</p>
        </article>`).join('')}</div>
      ${AVERTISSEMENT}`;
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
    return d.querySelector('form');
  }

  // Bloc de répartition partagé par les dépenses et les récurrentes.
  function champsRepartition(rep) {
    const mode = rep?.mode || E.reglages.modeDefaut;
    const participants = rep?.participants?.length ? rep.participants : E.membres.map((m) => m.id);
    return `
      <fieldset class="champ repartition"><legend>Répartition</legend>
        <div class="segments">${B.modes.map((x) => `<label><input type="radio" name="mode" value="${x.id}" ${mode === x.id ? 'checked' : ''}><span>${esc(x.court)}</span></label>`).join('')}</div>
        <p class="mode-explication">${esc(modeInfo(mode).principe)}</p>
        <div class="participants">${E.membres.map((m) => `
          <div class="participant" style="--c:${hex(m.couleur)}">
            <label class="case"><input type="checkbox" name="participant" value="${m.id}" ${participants.includes(m.id) ? 'checked' : ''}><i class="pastille"></i>${esc(m.nom)}</label>
            <label class="si-parts" ${mode === 'parts' ? '' : 'hidden'}><span class="sr-only">Parts de ${esc(m.nom)}</span><input name="parts-${m.id}" inputmode="decimal" value="${esc(String(rep?.parts?.[m.id] ?? 1).replace('.', ','))}" aria-label="Parts de ${esc(m.nom)}"><small>part(s)</small></label>
            <label class="si-montants" ${mode === 'montants' ? '' : 'hidden'}><input name="montant-${m.id}" inputmode="decimal" value="${rep?.montants?.[m.id] !== undefined ? versSaisie(rep.montants[m.id]) : ''}" placeholder="0,00" aria-label="Montant pour ${esc(m.nom)}"><small>€</small></label>
            <output class="quote" data-quote="${m.id}"></output>
          </div>`).join('')}</div>
        <p class="apercu" aria-live="polite"></p>
      </fieldset>`;
  }

  function lireRepartition(form) {
    const fd = new FormData(form);
    const mode = fd.get('mode') || 'egale';
    const participants = fd.getAll('participant');
    const parts = {}, montants = {};
    for (const id of participants) {
      const p = Number(String(fd.get(`parts-${id}`) || '1').replace(',', '.'));
      parts[id] = Number.isFinite(p) ? p : 0;
      const c = R.versCentimes(fd.get(`montant-${id}`) || '0');
      montants[id] = c ?? -1;
    }
    const rep = { mode, participants };
    if (mode === 'parts') rep.parts = parts;
    if (mode === 'montants') rep.montants = montants;
    return rep;
  }

  function calculer(form, montant) {
    const rep = lireRepartition(form);
    const res = R.repartir(montant, E.membres.filter((m) => rep.participants.includes(m.id)), rep.mode, rep);
    return { rep, res };
  }

  function brancherRepartition(form) {
    const maj = () => {
      const montant = R.versCentimes(form.elements.montant.value);
      const mode = new FormData(form).get('mode');
      form.querySelectorAll('.si-parts').forEach((x) => { x.hidden = mode !== 'parts'; });
      form.querySelectorAll('.si-montants').forEach((x) => { x.hidden = mode !== 'montants'; });
      form.querySelector('.mode-explication').textContent = modeInfo(mode).principe;
      const ap = form.querySelector('.apercu');
      form.querySelectorAll('.quote').forEach((o) => { o.textContent = ''; });
      if (!montant || montant <= 0) { ap.textContent = 'Indique le montant pour voir la part de chacun.'; ap.className = 'apercu'; return; }
      const { res } = calculer(form, montant);
      if (res.erreur) { ap.textContent = res.erreur; ap.className = 'apercu ko'; return; }
      Object.entries(res.quotes).forEach(([id, c]) => { const o = form.querySelector(`[data-quote="${id}"]`); if (o) o.textContent = eur(c); });
      ap.textContent = res.note || `Total réparti : ${eur(montant)}, au centime près.`;
      ap.className = res.note ? 'apercu ko' : 'apercu ok';
    };
    form.addEventListener('input', maj);
    form.addEventListener('change', maj);
    maj();
  }

  function champsCommuns(x, avecDate) {
    const t = auj();
    return `
      <label class="champ">Libellé<input name="libelle" required maxlength="80" value="${esc(x?.libelle || '')}" placeholder="Ex. : Courses de la semaine" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Montant (€)<input name="montant" required inputmode="decimal" value="${versSaisie(x?.montant)}" placeholder="0,00" autocomplete="off"></label>
        ${avecDate ? `<label class="champ">Date<input type="date" name="date" value="${x?.date || t}" required></label>`
          : `<label class="champ">Jour du mois<input type="number" name="jour" min="1" max="31" value="${x?.jour || 1}" required></label>`}
      </div>
      <div class="rang-champs">
        <label class="champ">Payé par<select name="payeur">${E.membres.map((m) => `<option value="${m.id}" ${(x?.payeur || E.membres[0].id) === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select name="categorie">${E.categories.map((c) => `<option value="${c.id}" ${(x?.categorie || E.categories[0]?.id) === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>`;
  }

  function lireCommuns(fd, form) {
    const libelle = String(fd.get('libelle') || '').trim();
    const montant = R.versCentimes(fd.get('montant'));
    if (!libelle) return 'Indique un libellé.';
    if (!montant || montant <= 0) return 'Montant illisible : écris par exemple 42,50.';
    if (montant > 100000000) return 'Montant trop élevé.';
    const { rep, res } = calculer(form, montant);
    if (res.erreur) return res.erreur;
    return { libelle: libelle.slice(0, 80), montant, payeur: fd.get('payeur'), categorie: fd.get('categorie'), repartition: rep, quotes: res.quotes };
  }

  function modaleDepense(id) {
    if (!E.membres.length) return;
    const d = id ? E.depenses.find((x) => x.id === id) : null;
    const corps = `${champsCommuns(d, true)}${champsRepartition(d?.repartition)}
      ${d?.recurrente ? '<p class="aide">Générée par une dépense récurrente : la modifier ici ne change que ce mois-ci.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = d ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    const form = ouvrirModale(d ? 'Modifier la dépense' : 'Nouvelle dépense', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        annulable(() => supprimer('depenses', d.id));
        sauver(); rendre(); toast(`« ${d.libelle} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = lireCommuns(fd, form);
      if (typeof v === 'string') return v;
      const date = fd.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Indique la date.';
      annulable(() => {
        if (d) Object.assign(d, v, { date }, { modifLe: maintenant() });
        else E.depenses.push({ id: uid(), date, ...v, modifLe: maintenant() });
      });
      sauver(); rendre();
      toast(d ? 'Dépense enregistrée.' : `Ajoutée : ${eur(v.montant)} payés par ${nom(v.payeur)}.`, { libelle: 'Annuler', faire: annuler });
    });
    brancherRepartition(form);
  }

  function modaleRecurrente(id) {
    const r = id ? E.recurrentes.find((x) => x.id === id) : null;
    const m0 = moisCourant();
    const corps = `${champsCommuns(r, false)}
      <div class="rang-champs">
        <label class="champ">À partir de<input type="month" name="debut" value="${r?.debut || m0}" required></label>
        <label class="champ">Jusqu'à<small>Facultatif</small><input type="month" name="fin" value="${r?.fin || ''}"></label>
      </div>
      ${champsRepartition(r?.repartition)}
      ${r ? `<label class="case"><input type="checkbox" name="actif" ${r.actif !== false ? 'checked' : ''}> Active (décoche pour la mettre en pause)</label>` : ''}
      <p class="aide">Les mois passés depuis la date de début sont ajoutés aussitôt ; ensuite, une dépense par mois à sa date. Les mois déjà notés ne sont pas modifiés.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = r ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    const form = ouvrirModale(r ? 'Modifier la récurrente' : 'Nouvelle dépense récurrente', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        annulable(() => supprimer('recurrentes', r.id));
        sauver(); rendre(); toast(`« ${r.libelle} » ne sera plus ajoutée. Les mois déjà notés restent.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = lireCommuns(fd, form);
      if (typeof v === 'string') return v;
      const jour = Number(fd.get('jour'));
      if (!Number.isInteger(jour) || jour < 1 || jour > 31) return 'Jour du mois : entre 1 et 31.';
      const debut = fd.get('debut'), fin = fd.get('fin') || null;
      if (!/^\d{4}-\d{2}$/.test(debut || '')) return 'Indique le mois de début.';
      if (debut < R.ajoutMois(m0, -24)) return 'Début : pas plus de 24 mois en arrière.';
      if (fin && fin < debut) return 'La fin doit suivre le début.';
      const { quotes, ...sansQuotes } = v;
      annulable(() => {
        const champs = { ...sansQuotes, jour, debut, fin, actif: r ? fd.get('actif') === 'on' : true, modifLe: maintenant() };
        if (r) Object.assign(r, champs); else E.recurrentes.push({ id: uid(), ...champs });
        generer();
      });
      sauver(); rendre(); toast(r ? 'Récurrente enregistrée.' : 'Récurrente ajoutée.', { libelle: 'Annuler', faire: annuler });
    });
    brancherRepartition(form);
  }

  function modaleVirement(prevu) {
    if (E.membres.length < 2) return;
    const de = prevu?.de || E.membres[1].id, a = prevu?.a || E.membres[0].id;
    const corps = `
      <div class="rang-champs">
        <label class="champ">De<select name="de">${E.membres.map((m) => `<option value="${m.id}" ${m.id === de ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
        <label class="champ">À<select name="a">${E.membres.map((m) => `<option value="${m.id}" ${m.id === a ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${versSaisie(prevu?.montant)}" placeholder="0,00" required autocomplete="off"></label>
        <label class="champ">Date<input type="date" name="date" value="${auj()}" required></label>
      </div>
      <label class="champ">Note<small>Facultative</small><input name="note" maxlength="80" value="${prevu ? 'Équilibrage' : ''}" autocomplete="off"></label>
      <p class="aide">Un remboursement entre membres du foyer : il ne compte pas comme une dépense, il ajuste seulement les soldes.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Noter un virement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const montant = R.versCentimes(fd.get('montant'));
      if (!montant || montant <= 0) return 'Montant illisible : écris par exemple 42,50.';
      if (fd.get('de') === fd.get('a')) return 'Choisis deux personnes différentes.';
      const date = fd.get('date');
      if (!date) return 'Indique la date.';
      annulable(() => E.virements.push({ id: uid(), date, de: fd.get('de'), a: fd.get('a'), montant, note: String(fd.get('note') || '').trim(), modifLe: maintenant() }));
      sauver(); rendre(); toast(`Virement de ${eur(montant)} enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMembre(id) {
    const m = id ? membre(id) : null;
    const utilisees = new Set(E.membres.map((x) => x.couleur));
    const defaut = m?.couleur || (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[0]).id;
    const lie = m && (E.depenses.some((d) => d.payeur === m.id || d.quotes?.[m.id]) || E.virements.some((v) => v.de === m.id || v.a === m.id) || E.recurrentes.some((r) => r.payeur === m.id));
    const corps = `
      <label class="champ">Prénom<input name="nom" required maxlength="30" value="${esc(m?.nom || '')}" autocomplete="off"></label>
      <label class="champ">Revenu mensuel net (€)<small>Facultatif. Sert seulement à la répartition au prorata ; visible par tout le foyer.</small><input name="revenu" inputmode="decimal" value="${versSaisie(m?.revenu)}" placeholder="Ex. : 2 100" autocomplete="off"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      ${m ? '<p class="aide">Changer un revenu ne modifie pas les dépenses déjà notées : seules les nouvelles (et les récurrentes à venir) suivent le nouveau prorata.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = m ? `<button class="btn primaire" value="ok">Enregistrer</button>${E.membres.length > 2 ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(m ? `Modifier ${esc(m.nom)}` : 'Nouvelle personne', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (lie) return `${m.nom} apparaît dans des dépenses, des récurrentes ou des virements : impossible de le retirer sans fausser les soldes.`;
        annulable(() => supprimer('membres', m.id));
        sauver(); rendre(); toast(`${m.nom} retiré du foyer.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const n = String(fd.get('nom') || '').trim();
      if (!n) return 'Indique le prénom.';
      if (E.membres.some((x) => x.id !== m?.id && x.nom.toLowerCase() === n.toLowerCase())) return 'Ce prénom existe déjà dans le foyer.';
      const brut = String(fd.get('revenu') || '').trim();
      const revenu = brut ? R.versCentimes(brut) : null;
      if (brut && (revenu === null || revenu < 0)) return 'Revenu illisible : écris par exemple 2 100.';
      annulable(() => {
        if (m) Object.assign(m, { nom: n, revenu, couleur: fd.get('couleur'), modifLe: maintenant() });
        else E.membres.push({ id: uid(), nom: n, revenu, couleur: fd.get('couleur'), modifLe: maintenant() });
      });
      sauver(); rendre(); toast(m ? 'Enregistré.' : `${n} ajouté au foyer.`);
    });
  }

  function modaleCategorie(id) {
    const c = id ? categorie(id) : null;
    const nb = c ? E.depenses.filter((d) => d.categorie === c.id).length : 0;
    const libres = B.categories.filter((x) => !E.categories.some((y) => y.id === x.id));
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(c?.nom || '')}" list="sugg-cat" autocomplete="off"></label>
      ${!c && libres.length ? `<datalist id="sugg-cat">${libres.map((x) => `<option value="${esc(x.nom)}">`).join('')}</datalist>` : ''}
      ${c ? `<p class="aide">${pluriel(nb, 'dépense')} dans cette catégorie.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = c ? `<button class="btn primaire" value="ok">Enregistrer</button>${nb ? '' : '<button class="btn danger gauche" value="supprimer">Supprimer</button>'}`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier la catégorie' : 'Nouvelle catégorie', corps, pied, (fd, action) => {
      if (action === 'supprimer') { annulable(() => supprimer('categories', c.id)); sauver(); rendre(); toast(`« ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return; }
      const n = String(fd.get('nom') || '').trim();
      if (!n) return 'Indique un nom.';
      if (E.categories.some((x) => x.id !== c?.id && x.nom.toLowerCase() === n.toLowerCase())) return 'Cette catégorie existe déjà.';
      if (c) Object.assign(c, { nom: n, modifLe: maintenant() });
      else {
        const base = B.categories.find((x) => x.nom.toLowerCase() === n.toLowerCase());
        E.categories.push({ id: base && !categorie(base.id) ? base.id : uid(), nom: n, modifLe: maintenant() });
      }
      sauver(); rendre(); toast('Catégorie enregistrée.');
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Nom du foyer<small>Facultatif, affiché en haut des soldes.</small><input name="nomFoyer" maxlength="40" value="${esc(E.foyer.nom)}" placeholder="Ex. : Appartement rue des Lilas" autocomplete="off"></label>
      <label class="champ">Répartition par défaut<select name="modeDefaut">${B.modes.filter((x) => x.id !== 'montants').map((x) => `<option value="${x.id}" ${E.reglages.modeDefaut === x.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Les données du foyer sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.foyer = { ...E.foyer, nom: String(f.get('nomFoyer') || '').trim().slice(0, 40), modifLe: maintenant() };
      E.reglages = { ...E.reglages, modeDefaut: f.get('modeDefaut'), modifLe: maintenant() };
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.membres) || !Array.isArray(d.depenses)) throw new Error();
        if (!confirm(`Remplacer le budget actuel par cette copie (${pluriel(d.membres.length, 'personne')}, ${pluriel(d.depenses.length, 'dépense')}) ? Tout le foyer verra la copie.`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du budget commun.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-commun-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Toast et annulation ----------
  let minuterieToast = null;
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4500);
  }

  // Photographie l'état avant une action ; « Annuler » le rétablit. Les éléments ainsi restaurés
  // reçoivent une date de modification récente pour l'emporter sur leur suppression.
  function annulable(faire) {
    annulation = structuredClone(E);
    faire();
  }
  function annuler() {
    if (!annulation) return;
    const avant = annulation;
    annulation = null;
    const t = maintenant();
    for (const cle of ['membres', 'categories', 'depenses', 'recurrentes', 'virements']) {
      const actuels = new Map(E[cle].map((x) => [x.id, x]));
      avant[cle].forEach((x) => { const y = actuels.get(x.id); if (!y || JSON.stringify(x) !== JSON.stringify(y)) { x.modifLe = t; delete avant.supprimes[x.id]; } });
    }
    E = avant;
    sauver(); rendre();
    toast('Action annulée.');
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'modele': choisirModele(id); ecranAccueil(); break;
      case 'accueil-suivant': if (!accueil.membres.length) choisirModele(accueil.modele); accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-ajouter': if (accueil.membres.length < MAX_MEMBRES) accueil.membres.push({ nom: '', place: `Personne ${accueil.membres.length + 1}`, revenu: '' }); ecranAccueil(); $(`[name="nom-${accueil.membres.length - 1}"]`)?.focus(); break;
      case 'accueil-retirer': accueil.membres.splice(Number(el.dataset.i), 1); ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'depense-nouvelle': modaleDepense(); break;
      case 'depense-modifier': modaleDepense(id); break;
      case 'recurrente-nouvelle': modaleRecurrente(); break;
      case 'recurrente-modifier': modaleRecurrente(id); break;
      case 'virement-nouveau': modaleVirement(); break;
      case 'virement-fait': {
        const v = R.equilibrer(soldesActuels())[Number(el.dataset.i)];
        if (!v) break;
        annulable(() => E.virements.push({ id: uid(), date: auj(), de: v.de, a: v.a, montant: v.montant, note: 'Équilibrage', modifLe: maintenant() }));
        sauver(); rendre(); toast(`${nom(v.de)} → ${nom(v.a)} : ${eur(v.montant)} enregistré.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'virement-suppr': { const v = E.virements.find((x) => x.id === id); if (!v) break; annulable(() => supprimer('virements', id)); sauver(); rendre(); toast(`Virement de ${eur(v.montant)} supprimé.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'membre-nouveau': modaleMembre(); break;
      case 'membre-modifier': modaleMembre(id); break;
      case 'categorie-nouvelle': modaleCategorie(); break;
      case 'categorie-modifier': modaleCategorie(id); break;
      case 'mois-prec': moisVue = R.ajoutMois(moisVue || moisCourant(), -1); rendre(); break;
      case 'mois-suiv': moisVue = R.ajoutMois(moisVue || moisCourant(), 1); if (moisVue > moisCourant()) moisVue = moisCourant(); rendre(); break;
      case 'copier-cle': navigator.clipboard?.writeText(session.code || '').then(() => toast('Clé copiée : envoie-la seulement aux membres du foyer.'), () => toast(`Ta clé : ${session.code}`)); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.closest('#filtres')) {
      const f = new FormData($('#filtres'));
      filtres = { mois: f.get('mois'), payeur: f.get('payeur'), categorie: f.get('categorie') };
      rendre();
    }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (generer()) { sauver(); if (!modale().open) rendre(); }
  });
  // Relève toutes les 30 s quand l'onglet est visible : les ajouts du reste du foyer arrivent seuls.
  setInterval(() => { if (document.visibilityState === 'visible' && E && etatSync === 'ok') rafraichir(); }, 30000);
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    session.code = code;
    try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
    try {
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
        generer();
        demarrer(); majSync(c.nonEnvoye ? 'attente' : 'horsligne');
        if (c.nonEnvoye) majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__budget = { etat: () => E, regles: R };
  init();
})();
