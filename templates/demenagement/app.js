// Déménagement QME : rétroplanning relatif au jour J (de « bien avant » à un mois après), démarches de
// changement d'adresse et contrats sans délai légal chiffré, inventaire des cartons par pièce avec recherche
// « dans quel carton est… », étiquettes imprimables, volume estimé, devis de déménageurs comparés et budget.
// Données synchronisées par clé de licence ou code d'accès. Aucun lien vers un service externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.DMN;
  const API = '/api/templates';
  const PRODUIT = 'DMN';
  const CLE_CODE = 'qme-dmn-code';
  const CLE_CACHE = 'qme-dmn-cache';
  const CLE_DEMO = 'qme-dmn-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-dmn-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, ecart, libJ } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const eur = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }));
  const m3 = (n) => `${String(n ?? 0).replace('.', ',')} m³`;
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const cat = (id) => B.categories.find((c) => c.id === id) || B.categories[3];
  const nomCat = (id) => cat(id).nom;
  const pillCat = (id) => `<span class="cat cat-${esc(cat(id).id)}">${esc(nomCat(id))}</span>`;
  const piece = (id) => E.pieces.find((p) => p.id === id) || null;
  const nomPiece = (id) => piece(id)?.nom || 'Sans pièce';
  const pastille = (id) => `<i class="pastille-piece" style="--p:${esc(piece(id)?.couleur || '#B8B0A2')}" aria-hidden="true"></i>`;
  const LIB_CARTON = Object.fromEntries(B.statutsCarton.map((s) => [s.id, s.court]));
  const SUIVANT = { remplir: ['ferme', 'Fermer'], ferme: ['arrive', 'Arrivé'], arrive: ['deballe', 'Déballé'], deballe: null };
  const nomFormule = (id) => (B.formules.find((f) => f.id === id) || { nom: id }).nom;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { cat: 'toutes', faites: false, q: '', piece: 'toutes', devis: 'devis' };
  let annulation = null;

  const etatVide = () => R.etatVide(B, auj());
  const normaliser = (d) => R.normaliser(d, auj(), B);

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
        toast('Un autre appareil a modifié ton déménagement entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (DMN-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Famille fictive qui quitte une location pour une autre, déménageur professionnel, J dans 12 jours.
  // Tâches passées cochées sauf trois retards voulus ; une sans objet ; une faite en avance ; une ajoutée à
  // la main. Cartons dans tous les états (quelques-uns apportés en avance), trois devis, budget en cours.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    e.date = ajout(t, 12);
    e.depuis = 'Appartement en ville';
    e.vers = 'Maison à 40 km';
    e.situation = R.normaliserSituation({ depart: 'locataire', arrivee: 'locataire', mode: 'pro', enfants: true, animaux: true, vehicule: true });
    e.taches = R.genererTaches(B.taches, e.situation);
    const retards = new Set(['a02', 'l09', 'o07']);
    for (const k of e.taches) {
      const ech = R.echeance(e.date, k);
      if (k.ref === 'c03') { k.statut = 'so'; k.faitLe = ajout(t, -20); k.note = 'Pas de gaz dans la maison.'; continue; }
      if (ech < t && !retards.has(k.ref)) { k.statut = 'fait'; k.faitLe = ech; }
      if (k.ref === 'a08') { k.statut = 'fait'; k.faitLe = t; }
    }
    const devisA = e.taches.find((k) => k.ref === 'o03');
    if (devisA) devisA.note = 'Déménageur A retenu, acompte versé.';
    e.taches = R.trierTaches([...e.taches, R.normaliserTache({ titre: 'Réserver l\'ascenseur de service auprès du gardien', cat: 'logement', j: -4 })]);

    const c = (num, piece, statut, contenu, x = {}) => R.normaliserCarton({ id: uid(), num, piece, statut, contenu, ...x });
    e.cartons = [
      c(1, 'cave', 'ferme', 'Outils : perceuse, tournevis, niveau à bulle, mètre ruban', { lourd: true }),
      c(2, 'cave', 'ferme', 'Décorations de Noël, guirlandes lumineuses'),
      c(3, 'cave', 'arrive', 'Matériel de camping : tente, duvets, lampes frontales', { note: 'Apporté en avance avec la voiture.' }),
      c(4, 'cave', 'deballe', 'Pots de fleurs, gants et petits outils de jardin', { note: 'Déjà rangé dans l\'abri de jardin.' }),
      c(5, 'salon', 'ferme', 'Livres de poche, romans, bandes dessinées', { lourd: true }),
      c(6, 'salon', 'ferme', 'Beaux livres et albums photo', { lourd: true }),
      c(7, 'salon', 'ferme', 'Cadres photo, vases, bougeoirs', { fragile: true }),
      c(8, 'salon', 'remplir', 'Câbles HDMI, multiprises, console de jeux et manettes', { note: 'Télécommandes dans la pochette du dessus.' }),
      c(9, 'cuisine', 'ferme', 'Vaisselle : assiettes plates et creuses, bols', { fragile: true, lourd: true }),
      c(10, 'cuisine', 'ferme', 'Verres à pied, carafes', { fragile: true }),
      c(11, 'cuisine', 'remplir', 'Casseroles, poêles, couvercles'),
      c(12, 'cuisine', 'remplir', 'Épicerie : épices, pâtes, riz, conserves'),
      c(13, 'cuisine', 'ferme', 'Robot, mixeur, bouilloire, grille-pain'),
      c(14, 'ch1', 'ferme', 'Vêtements d\'hiver : manteaux, écharpes, bonnets'),
      c(15, 'ch1', 'remplir', 'Linge de lit, couette, oreillers'),
      c(16, 'ch2', 'ferme', 'Jouets : briques de construction, puzzles, jeux de société'),
      c(17, 'ch2', 'ferme', 'Livres d\'enfants et cahiers de coloriage'),
      c(18, 'ch2', 'remplir', 'Doudous, veilleuse, pyjamas, gourde', { prioritaire: true }),
      c(19, 'sdb', 'remplir', 'Serviettes, trousses de toilette, sèche-cheveux', { prioritaire: true }),
      c(20, 'bureau', 'ferme', 'Classeurs de notices et de garanties'),
      c(21, 'bureau', 'ferme', 'Imprimante, câbles, ramettes de papier', { lourd: true }),
      c(22, 'entree', 'remplir', 'Carton premier jour : draps, chargeurs, papier toilette, café, tournevis', { prioritaire: true }),
      c(23, 'salon', 'remplir', 'Plaids, coussins, rideaux'),
      c(24, 'entree', 'ferme', 'Chaussures d\'été, parapluies, sacs réutilisables'),
    ];

    e.devis = [
      R.normaliserDevis({ id: uid(), entreprise: 'Déménageur A', formule: 'standard', montant: 1450, volume: 28, date: e.date, validite: ajout(t, 18), acompte: 435, visite: true, inclus: ['cartons', 'fragile', 'demontage', 'stationnement', 'assurance'], note: 'Visite faite. Deux déménageurs et un camion de 30 m³.' }),
      R.normaliserDevis({ id: uid(), entreprise: 'Déménageur B', formule: 'economique', montant: 980, volume: null, date: e.date, validite: ajout(t, -3), acompte: null, visite: false, inclus: ['assurance'], note: 'Devis sur déclaration, sans visite.' }),
      R.normaliserDevis({ id: uid(), entreprise: 'Déménageur C', formule: 'confort', montant: 2190, volume: 27, date: ajout(e.date, 1), validite: ajout(t, 25), acompte: 650, visite: true, inclus: ['cartons', 'fragile', 'emballage', 'demontage', 'deballage', 'stationnement', 'assurance'] }),
    ];
    const L = (poste, libelle, prevu, reel = null, paye = false) => R.normaliserLigne({ id: uid(), poste, libelle, prevu, reel, paye });
    e.budget = [
      L('cartons', 'Cartons, adhésif et papier de protection', 120, 96.5, true),
      L('double', 'Chevauchement des deux loyers', 650),
      L('menage', 'Ménage de fin de bail', 180),
      L('reparations', 'Joints et rebouchage avant l\'état des lieux', 60, 42.9, true),
      L('courrier', 'Réexpédition du courrier', null),
      L('aide', 'Repas pour l\'équipe et les voisins qui aident', 80),
      L('mobilier', 'Rideaux et luminaires de la maison', 400),
    ];
    const r = R.retenirDevis(e.devis, e.budget, e.devis[0].id);
    e.devis = r.devis; e.budget = r.budget;
    e.budget[0].paye = false;
    e.volume = R.normaliserVolume({
      items: { canape3: 1, fauteuil: 1, tablebasse: 1, meubletv: 1, tele: 1, biblio: 2, table6: 1, chaise: 6, litdouble: 1, litsimple: 1, armoire2: 2, commode: 2, chevet: 2, bureau: 2, chaisebureau: 1, frigo: 1, lavelinge: 1, lavevaisselle: 1, microondes: 1, velo: 3, miroir: 4, tapis: 2, lampadaire: 2, valise: 3 },
      extras: [{ id: uid(), nom: 'Trampoline démonté', vol: 0.8, qte: 1 }],
      cartons: 45, marge: 10,
    });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Déménagement · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <rect x="160" y="20" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="160" y="160" width="120" height="120" fill="#F5B400"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <rect x="370" y="90" width="120" height="120" fill="#141414"/>
          <circle cx="430" cy="150" r="24" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Déménagement</p>
          <h1>Chaque carton à sa place.</h1>
          <p>Un rétroplanning calé sur ta date, les démarches et les contrats à prévenir, chaque carton numéroté avec son contenu, les devis comparés et le budget du déménagement.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton déménagement</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton déménagement est enregistré en ligne et te suit sur tous tes appareils, téléphone compris le jour J.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon déménagement</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de clé ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon déménagement'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, date: ajout(auj(), 56), depuis: '', vers: '', situation: R.normaliserSituation({}) });
  let accueil = accueilVide();

  function champsSituation(s) {
    const radios = (nom, liste) => `<div class="choix-liste">${liste.map((x) => `<label class="choix-ligne"><input type="radio" name="${nom}" value="${x.id}" ${s[nom] === x.id ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div>`;
    return `
      <fieldset class="champ cadre-champs"><legend>Ton logement actuel</legend>${radios('depart', B.situations.depart)}</fieldset>
      <fieldset class="champ cadre-champs"><legend>Ton nouveau logement</legend>${radios('arrivee', B.situations.arrivee)}</fieldset>
      <fieldset class="champ cadre-champs"><legend>Le transport</legend>${radios('mode', B.situations.mode)}</fieldset>
      <fieldset class="champ cadre-champs"><legend>Et aussi <small>Ajoute les tâches qui vont avec.</small></legend><div class="choix-liste">${B.situations.options.map((o) => `<label class="choix-ligne"><input type="checkbox" name="${o.id}" ${s[o.id] ? 'checked' : ''}><span>${esc(o.nom)}</span></label>`).join('')}</div></fieldset>`;
  }
  const lireSituation = (racine) => R.normaliserSituation({
    depart: racine.querySelector('[name=depart]:checked')?.value, arrivee: racine.querySelector('[name=arrivee]:checked')?.value, mode: racine.querySelector('[name=mode]:checked')?.value,
    ...Object.fromEntries(B.situations.options.map((o) => [o.id, racine.querySelector(`[name=${o.id}]`)?.checked])),
  });

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton déménagement, semaine après semaine.</h1>
        <p class="intro">Indique la date : le rétroplanning (${B.taches.length} tâches types, de la relecture du bail au premier mois dans le nouveau logement) se cale dessus. Si la date change, tout suit.</p>
        <form id="form-accueil" novalidate>
          <label class="champ" style="max-width:280px">Date du déménagement<small>Le jour J : le jour où le camion part.</small><input type="date" name="date" value="${a.date}" required></label>
          <div class="rang-champs" style="max-width:620px">
            <label class="champ">Tu quittes<small>Facultatif, par exemple « Appartement en ville ».</small><input name="depuis" maxlength="60" value="${esc(a.depuis)}"></label>
            <label class="champ">Tu emménages<small>Facultatif, par exemple « Maison à 40 km ».</small><input name="vers" maxlength="60" value="${esc(a.vers)}"></label>
          </div>
          <p class="erreur" role="alert"></p>
        </form>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta situation</h1>
        <p class="intro">La checklist ne garde que ce qui te concerne : état des lieux si tu es locataire, devis si tu passes par un déménageur, école si tu as des enfants. Tu pourras changer ces choix dans les réglages.</p>
        <div id="situation-accueil" class="situation">${champsSituation(a.situation)}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma checklist</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#situation-accueil')?.addEventListener('change', () => { accueil.situation = lireSituation($('#situation-accueil')); });
  }

  function accueilSuivant() {
    const f = $('#form-accueil');
    const date = f.querySelector('[name=date]').value;
    if (!R.estDate(date)) { f.querySelector('.erreur').textContent = 'Indique la date du déménagement.'; return; }
    Object.assign(accueil, { etape: 2, date, depuis: f.querySelector('[name=depuis]').value.trim(), vers: f.querySelector('[name=vers]').value.trim() });
    ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    accueil.situation = lireSituation($('#situation-accueil'));
    E = etatVide();
    Object.assign(E, { date: accueil.date, depuis: accueil.depuis, vers: accueil.vers, situation: accueil.situation });
    E.taches = R.genererTaches(B.taches, E.situation);
    E.budget = [R.normaliserLigne({ poste: E.situation.mode === 'pro' ? 'demenageur' : 'utilitaire', libelle: E.situation.mode === 'pro' ? 'Déménageur' : 'Utilitaire et carburant' }), R.normaliserLigne({ poste: 'cartons', libelle: 'Cartons et fournitures' })];
    const n = E.taches.length;
    accueil = accueilVide();
    vue = 'checklist';
    sauver();
    demarrer();
    toast(`Ta checklist est prête : ${n} tâches calées sur le ${dateLongue(E.date)}.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    checklist: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    cartons: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    devis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    loupe: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.5"/></svg>',
  };
  const COURTS = { tableau: 'Tableau', devis: 'Devis' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['checklist', 'Checklist'], ['cartons', 'Cartons'], ['devis', 'Devis et volume'], ['budget', 'Budget']];
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)} Montants et volumes : tes saisies et des ordres de grandeur, pas un devis.</p>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/demenagement/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Déménagement</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Déménagement`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, checklist: vueChecklist, cartons: vueCartons, devis: vueDevis, budget: vueBudget }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="72" cy="20" r="16" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  function etiquetteStatut(k, t) {
    const s = R.statutTache(k, E.date, t);
    if (s === 'fait') return `<span class="etiquette ciel">Fait${k.faitLe ? ` le ${dateCourte(k.faitLe)}` : ''}</span>`;
    if (s === 'so') return '<span class="etiquette sable">Sans objet</span>';
    if (s === 'retard') return `<span class="etiquette rouge">En retard · ${pluriel(ecart(R.echeance(E.date, k), t), 'jour')}</span>`;
    if (s === 'bientot') { const n = ecart(t, R.echeance(E.date, k)); return `<span class="etiquette jaune">${n === 0 ? 'Aujourd\'hui' : n === 1 ? 'Demain' : `Dans ${n} jours`}</span>`; }
    return '<span class="etiquette">À venir</span>';
  }
  const barre = (pct, retard) => `<span class="progres ${retard ? 'avec-retard' : ''}" role="img" aria-label="${pct} % fait"><span style="width:${pct}%"></span></span>`;
  const position = () => { const n = ecart(E.date, auj()); return n === 0 ? 'Jour J' : libJ(n); };

  function ligneTache(k, t, { compacte = false } = {}) {
    const s = R.statutTache(k, E.date, t);
    const e = R.echeance(E.date, k);
    return `<li class="ligne-tache st-${s}">
      <button class="case-fait ${k.statut === 'fait' ? 'coche' : ''}" data-action="cocher" data-tache="${k.id}" aria-pressed="${k.statut === 'fait'}" aria-label="${k.statut === 'fait' ? 'Remettre à faire' : 'Marquer fait'} : ${esc(k.titre)}">${ICONES.coche}</button>
      <div class="lt-corps">
        <button class="lien-ligne" data-action="tache" data-tache="${k.id}"><b>${esc(k.titre)}</b><span>${libJ(k.j)} · ${fmt(e)}${k.note ? ` · ${esc(k.note)}` : ''}${!compacte && k.aide ? ' · <u>conseil</u>' : ''}</span></button>
        <span class="lt-etiquettes">${pillCat(k.cat)}${etiquetteStatut(k, t)}</span>
      </div>
      ${compacte ? '' : `<button class="btn petit so ${k.statut === 'so' ? 'actif' : ''}" data-action="sans-objet" data-tache="${k.id}" aria-pressed="${k.statut === 'so'}" title="Sans objet pour ton déménagement">S. O.</button>`}
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const pr = R.progression(E.taches, E.date, t);
    const bientot = R.aFaireBientot(E.taches, E.date, t);
    const ca = R.avancementCartons(E.cartons);
    const bu = R.totauxBudget(E.budget);
    const n = ecart(t, E.date);
    const manquants = R.cartonsManquants(E.cartons, E.date, t);
    const retenu = E.devis.find((d) => d.retenu);
    const tuiles = [
      ['Jour J', n === 0 ? 'Jour J' : n > 0 ? `J−${n}` : `J+${-n}`, `${R.compteRebours(E.date, t)} · ${dateCourte(E.date)}`, 'var(--rouge)', 'rond', 'checklist'],
      ['Checklist', `${pr.pct} %`, pr.retard ? `${pluriel(pr.retard, 'tâche')} en retard` : `${pr.fait} faites sur ${pr.total - pr.so}`, 'var(--bleu)', '', 'checklist'],
      ['Cartons', `${ca.total - ca.remplir}/${ca.total}`, ca.total ? (n > 0 ? 'fermés, prêts à partir' : `${ca.arrive + ca.deballe} arrivés, ${ca.deballe} déballés`) : 'aucun carton noté', 'var(--jaune)', '', 'cartons'],
      ['Budget', eur(bu.estime), bu.prevu ? `prévu ${eur(bu.prevu)} · payé ${eur(bu.paye)}` : 'aucun montant saisi', 'var(--encre)', 'rond', 'budget'],
    ].map(([lib, v, d, c, f, cible]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></button>`).join('');
    const pieces = R.parPiece(E.cartons, E.pieces);
    return `
      <div class="vue-tete"><div><h1>${E.depuis || E.vers ? `${esc(E.depuis || 'Ici')} → ${esc(E.vers || 'ailleurs')}` : 'Mon déménagement'}</h1><p>Le ${dateLongue(E.date)}, ${R.compteRebours(E.date, t)}. Ce qui est en retard, ce qui tombe dans les 7 jours, les cartons et le budget.</p></div>
        <div class="actions"><button class="btn" data-action="changer-date">Changer la date</button></div></div>
      <form class="cherche-carton" id="form-cherche" role="search"><label class="champ"><span class="sr-only">Dans quel carton est…</span><input id="cherche-tableau" type="search" placeholder="Dans quel carton est… la perceuse ?" autocomplete="off"></label><button class="btn primaire" type="submit">${ICONES.loupe}<span>Chercher</span></button></form>
      <div class="tuiles">${tuiles}</div>
      ${manquants.length ? `<div class="alerte-carton"><div><b>${pluriel(manquants.length, 'carton')} pas encore pointé${manquants.length > 1 ? 's' : ''} à l'arrivée</b><span>N° ${manquants.slice(0, 12).map((c) => c.num).join(', ')}${manquants.length > 12 ? '…' : ''} : vérifie le camion et l'ancien logement.</span></div><button class="btn petit" data-action="vue" data-vue="cartons">Voir</button></div>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire maintenant <span>${bientot.length ? 'Retards puis 7 prochains jours' : ''}</span></h2>
          ${bientot.length ? `<ul class="liste-taches">${bientot.slice(0, 8).map((k) => ligneTache(k, t, { compacte: true })).join('')}</ul>${bientot.length > 8 ? `<button class="btn lien" data-action="vue" data-vue="checklist">Voir les ${bientot.length} tâches</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien d\'urgent</h3><p>Aucune tâche en retard ni d\'échéance dans les 7 jours. La suite est dans la checklist.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Cartons par pièce <span>${pluriel(ca.total, 'carton')}</span></h2>
          ${pieces.length ? `<ul class="barres-pieces">${pieces.map((g) => `<li><button class="lien-ligne" data-action="voir-piece" data-piece="${g.piece || ''}"><b>${pastille(g.piece)}${esc(g.piece ? nomPiece(g.piece) : 'Sans pièce')}</b><span>${pluriel(g.total, 'carton')} · ${g.remplir ? `${g.remplir} à remplir` : 'tous fermés'}</span></button>${barre(g.pctPrets, false)}</li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun carton</h3><p>Numérote tes cartons et note leur contenu : tu les retrouves d\'une recherche.</p><div class="actions"><button class="btn primaire petit" data-action="nouveau-carton">${ICONES.plus}Premier carton</button></div></div></div>'}
        </section>
      </div>
      ${E.devis.length ? `<h2 class="titre-section">Devis <span>${pluriel(E.devis.length, 'devis', 'devis')}</span></h2><p class="aide">${retenu ? `Retenu : <b>${esc(retenu.entreprise)}</b>, ${eur(retenu.montant)}${retenu.acompte ? `, acompte ${eur(retenu.acompte)}` : ''}.` : 'Aucun devis retenu pour l\'instant.'} <button class="btn lien" data-action="vue" data-vue="devis">Comparer les devis</button></p>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Checklist ----------
  function vueChecklist() {
    const t = auj();
    const pr = R.progression(E.taches, E.date, t);
    const actuelle = R.phaseDuJour(E.date, t).id;
    const garde = (k) => (filtre.cat === 'toutes' || k.cat === filtre.cat) && (!filtre.faites || k.statut === 'afaire');
    const liste = E.taches.filter(garde);
    const nb = (c) => E.taches.filter((k) => (c === 'toutes' || k.cat === c) && (!filtre.faites || k.statut === 'afaire')).length;
    const phases = R.PHASES.map((ph) => ({ ph, taches: liste.filter((k) => R.phase(k.j).id === ph.id) })).filter((g) => g.taches.length);
    return `
      <div class="vue-tete"><div><h1>Checklist</h1><p>Ton rétroplanning jusqu'au ${dateLongue(E.date)} et après : chaque échéance se calcule depuis le jour J. Les démarches renvoient à ton bail, tes contrats ou service-public.fr, sans délai légal inventé.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-tache">${ICONES.plus}Tâche</button><button class="btn" data-action="changer-date">Changer la date</button></div></div>
      <div class="bilan-fiche">
        <div class="bf-progres"><b>${pr.pct} %</b>${barre(pr.pct, pr.retard)}<span>${pr.fait} faites sur ${pr.total - pr.so}${pr.so ? ` · ${pr.so} sans objet` : ''}</span></div>
        <div class="bf-compteurs"><span class="etiquette">${position()}</span>${pr.retard ? `<span class="etiquette rouge">${pluriel(pr.retard, 'tâche')} en retard</span>` : ''}${pr.bientot ? `<span class="etiquette jaune">${pr.bientot} dans les 7 jours</span>` : ''}</div>
      </div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par catégorie">${[['toutes', 'Toutes'], ...B.categories.map((c) => [c.id, c.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-cat" data-cat="${id}" aria-pressed="${filtre.cat === id}">${esc(lib)} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="case bascule"><input type="checkbox" data-action="masquer-faites" ${filtre.faites ? 'checked' : ''}> Masquer les tâches faites</label>
      </div>
      ${phases.length ? phases.map(({ ph, taches }) => {
        const de = R.echeance(E.date, taches[0]); const a = R.echeance(E.date, taches[taches.length - 1]);
        return `<section class="phase ${ph.id === actuelle ? 'phase-actuelle' : ''}"><h3 class="titre-phase">${ph.nom}${ph.id === actuelle ? ' <em>Maintenant</em>' : ''}<span>${dateCourte(de)}${a !== de ? ` – ${dateCourte(a)}` : ''}</span></h3><ul class="liste-taches">${taches.map((k) => ligneTache(k, t)).join('')}</ul></section>`;
      }).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.taches.length ? 'Aucune tâche ne correspond' : 'Aucune tâche'}</h3><p>${E.taches.length ? 'Change de catégorie ou affiche les tâches faites.' : 'Ajoute une tâche, ou choisis ta situation dans les réglages pour reprendre le rétroplanning type.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Cartons ----------
  const surligner = (texte, q) => {
    const mots = R.sansAccents(q).split(/[\s,;]+/).filter((m) => m.length > 1 && !/^\d+$/.test(m));
    if (!mots.length) return esc(texte);
    const brut = String(texte);
    const plat = R.sansAccents(brut);
    const marques = new Array(brut.length).fill(false);
    for (const m of mots) { let i = plat.indexOf(m); while (i >= 0) { for (let k = i; k < i + m.length; k++) marques[k] = true; i = plat.indexOf(m, i + 1); } }
    let out = ''; let ouvert = false;
    for (let i = 0; i < brut.length; i++) { if (marques[i] && !ouvert) { out += '<mark>'; ouvert = true; } if (!marques[i] && ouvert) { out += '</mark>'; ouvert = false; } out += esc(brut[i]); }
    return out + (ouvert ? '</mark>' : '');
  };

  function carteCarton(c, q = '') {
    const s = SUIVANT[c.statut];
    const drapeaux = [c.fragile ? '<span class="etiquette rose">Fragile</span>' : '', c.lourd ? '<span class="etiquette">Lourd</span>' : '', c.prioritaire ? '<span class="etiquette jaune">À ouvrir en premier</span>' : ''].join('');
    const cl = { remplir: 'sable', ferme: 'ciel', arrive: 'ciel', deballe: 'ciel' }[c.statut];
    return `<li class="carton st-${c.statut}">
      <button class="carton-corps" data-action="carton" data-id="${c.id}" aria-label="Carton ${c.num}, ${esc(nomPiece(c.piece))} : modifier">
        <span class="carton-num" style="--p:${esc(piece(c.piece)?.couleur || '#B8B0A2')}">${c.num}</span>
        <span class="carton-texte"><b>${c.contenu ? surligner(c.contenu, q) : '<i>Contenu à noter</i>'}</b><span>${pastille(c.piece)}${surligner(nomPiece(c.piece), q)}${c.note ? ` · ${surligner(c.note, q)}` : ''}</span><span class="carton-drapeaux">${drapeaux}<span class="etiquette ${cl}">${LIB_CARTON[c.statut]}</span></span></span>
      </button>
      ${s ? `<button class="btn petit ${c.statut === 'remplir' ? '' : 'primaire'}" data-action="avancer-carton" data-id="${c.id}">${s[1]}</button>` : ''}
    </li>`;
  }

  function vueCartons() {
    const t = auj();
    const ca = R.avancementCartons(E.cartons);
    const q = filtre.q.trim();
    const dansPiece = (c) => filtre.piece === 'toutes' || (filtre.piece === 'sans' ? !piece(c.piece) : c.piece === filtre.piece);
    const nbPiece = (id) => E.cartons.filter((c) => (id === 'toutes' ? true : id === 'sans' ? !piece(c.piece) : c.piece === id)).length;
    const manquants = R.cartonsManquants(E.cartons, E.date, t);
    const apres = t >= E.date;
    const outils = `
      <div class="vue-tete"><div><h1>Cartons</h1><p>Un numéro par carton, sa pièce d'arrivée et son contenu. Le numéro et la couleur de la pièce vont sur l'étiquette ; la recherche retrouve n'importe quel objet.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-carton">${ICONES.plus}Carton<span class="nb-carton"> n° ${R.numeroSuivant(E.cartons)}</span></button>${E.cartons.length ? '<button class="btn" data-action="etiquettes">Étiquettes</button><button class="btn" data-action="imprimer-liste">Liste à imprimer</button>' : ''}</div></div>`;
    if (!E.cartons.length) return `${outils}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun carton pour l'instant</h3><p>Ajoute chaque carton au moment de le fermer : pièce d'arrivée, contenu en quelques mots, fragile ou lourd. Le numéro suit tout seul.</p><div class="actions"><button class="btn primaire" data-action="nouveau-carton">${ICONES.plus}Premier carton</button><button class="btn" data-action="pieces">Mes pièces</button></div></div></div>`;
    const liste = R.rechercherCartons(E.cartons.filter(dansPiece), q, nomPiece);
    const filtres = [['toutes', 'Toutes'], ...E.pieces.map((p) => [p.id, p.nom]), ...(nbPiece('sans') ? [['sans', 'Sans pièce']] : [])];
    return `${outils}
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">${apres ? 'Arrivés' : 'Prêts à partir'}</p><b>${apres ? ca.arrive + ca.deballe : ca.total - ca.remplir}<small>/${ca.total}</small></b><span>${apres ? 'pointés au nouveau logement' : `${ca.remplir} encore à remplir`}</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">À part</p><b>${ca.fragiles + ca.prioritaires}</b><span>${pluriel(ca.fragiles, 'fragile')} · ${ca.prioritaires} à ouvrir en premier</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Déballés</p><b>${ca.pctDeballes} %</b><span>${pluriel(ca.deballe, 'carton')} vidé${ca.deballe > 1 ? 's' : ''}</span></div>
      </div>
      ${manquants.length ? `<div class="alerte-carton"><div><b>${pluriel(manquants.length, 'carton')} pas encore pointé${manquants.length > 1 ? 's' : ''} « arrivé »</b><span>N° ${manquants.map((c) => c.num).join(', ')}. Touche « Arrivé » sur chaque carton déchargé.</span></div></div>` : ''}
      <form class="cherche-carton" role="search" onsubmit="return false"><label class="champ"><span class="sr-only">Dans quel carton est…</span><input id="recherche" type="search" placeholder="Dans quel carton est… ? Un objet, une pièce ou un numéro" value="${esc(filtre.q)}" autocomplete="off"></label></form>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par pièce">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre-piece" data-piece="${id}" aria-pressed="${filtre.piece === id}">${id !== 'toutes' && id !== 'sans' ? pastille(id) : ''}${esc(lib)} <small>${nbPiece(id)}</small></button>`).join('')}</div>
        <button class="btn petit" data-action="pieces">Mes pièces</button>
      </div>
      ${q ? `<h2 class="titre-section">${liste.length ? `${pluriel(liste.length, 'carton trouvé', 'cartons trouvés')}` : 'Aucun carton trouvé'} <span>« ${esc(q)} »</span></h2>${liste.length ? `<ul class="cartons">${liste.map((c) => carteCarton(c, q)).join('')}</ul>` : '<p class="aide">Essaie un autre mot (sans accents, le pluriel compte), le nom d\'une pièce ou un numéro de carton.</p>'}`
        : R.parPiece(liste, E.pieces).map((g) => `<section class="groupe-piece"><h2 class="titre-cat">${pastille(g.piece)}${esc(g.piece ? nomPiece(g.piece) : 'Sans pièce')}<span>${pluriel(g.total, 'carton')}${g.remplir ? ` · ${g.remplir} à remplir` : ''}${g.fragiles ? ` · ${pluriel(g.fragiles, 'fragile')}` : ''}</span></h2><ul class="cartons">${g.cartons.map((c) => carteCarton(c)).join('')}</ul></section>`).join('')}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv-cartons">Exporter en CSV</button></div>`;
  }

  // ---------- Devis et volume ----------
  function vueDevis() {
    const t = auj();
    const vol = R.volumeEstime(E.volume, B.meubles, E.cartons.length, { volumeCarton: B.volumeCarton });
    const bascule = `<div class="choix-statut choix-sens" role="group" aria-label="Devis ou volume">${[['devis', `Devis (${E.devis.length})`], ['volume', `Volume (${m3(vol.total)})`]].map(([id, lib]) => `<button type="button" data-action="devis-vue" data-sous="${id}" aria-pressed="${filtre.devis === id}"><span>${lib}</span></button>`).join('')}</div>`;
    if (filtre.devis === 'volume') return vueVolume(vol, bascule);
    const comp = R.comparerDevis(E.devis, vol.total, t);
    const parId = new Map(comp.lignes.map((l) => [l.id, l]));
    const ordre = comp.ordre.map((id) => E.devis.find((d) => d.id === id));
    const tete = `<div class="vue-tete"><div><h1>Devis</h1><p>Reporte chaque devis reçu : prix, volume, prestations incluses. Le prix au m³ et ce qui manque se lisent côte à côte. Retenir un devis l'inscrit au budget.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-devis">${ICONES.plus}Devis</button></div></div>${bascule}`;
    if (!E.devis.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun devis</h3><p>${E.situation.mode === 'soi' ? 'Tu déménages par tes propres moyens : note ici les offres de location d\'utilitaire si tu veux les comparer.' : `Commence par estimer ton volume (${m3(vol.total)} pour l'instant), puis demande des devis sur la même base pour pouvoir les comparer.`}</p><div class="actions"><button class="btn primaire" data-action="nouveau-devis">${ICONES.plus}Premier devis</button><button class="btn" data-action="devis-vue" data-sous="volume">Estimer le volume</button></div></div></div>`;
    return `${tete}
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Volume estimé</p><b>${m3(vol.total)}</b><span>meubles, ${pluriel(vol.nbCartons, 'carton')} et ${vol.marge} % de marge</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Moins cher</p><b>${eur(comp.min)}</b><span>${comp.min !== null ? esc(E.devis.find((d) => d.montant === comp.min)?.entreprise || '') : 'aucun montant'}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Écart</p><b>${comp.min !== null ? eur(comp.max - comp.min) : '—'}</b><span>entre le moins cher et le plus cher</span></div>
      </div>
      <ul class="devis-grille">${ordre.map((d) => {
        const l = parId.get(d.id);
        return `<li class="devis-carte ${d.retenu ? 'retenu' : ''} ${l.expire ? 'expire' : ''}">
          <div class="dc-tete"><span class="etiquette ${d.retenu ? 'ciel' : ''}">${d.retenu ? 'Retenu' : esc(nomFormule(d.formule))}</span>${l.moinsCher ? '<span class="etiquette jaune">Le moins cher</span>' : ''}${l.expire ? '<span class="etiquette rouge">Validité dépassée</span>' : ''}</div>
          <h3>${esc(d.entreprise)}</h3>
          <p class="dc-prix">${eur(d.montant)}${l.ecart ? ` <small>+${eur(l.ecart)}</small>` : ''}</p>
          <dl class="dc-infos">
            <div><dt>Prix au m³</dt><dd>${l.prixM3 !== null ? `${eur(l.prixM3)}${l.volumeEstime ? ' <small>(ton volume)</small>' : ''}` : '—'}</dd></div>
            <div><dt>Volume du devis</dt><dd>${d.volume ? m3(d.volume) : 'non précisé'}</dd></div>
            <div><dt>Date proposée</dt><dd>${d.date ? dateCourte(d.date) : '—'}${d.date && d.date !== E.date ? ' <small>(≠ jour J)</small>' : ''}</dd></div>
            <div><dt>Valable jusqu'au</dt><dd>${d.validite ? dateCourte(d.validite) : '—'}</dd></div>
            <div><dt>Acompte</dt><dd>${d.acompte ? `${eur(d.acompte)} · reste ${eur(l.resteAPayer)}` : '—'}</dd></div>
            <div><dt>Visite</dt><dd>${d.visite ? 'Faite' : 'Sans visite'}</dd></div>
          </dl>
          <ul class="dc-inclus" aria-label="Prestations">${B.prestations.map((p) => `<li class="${d.inclus.includes(p.id) ? 'oui' : 'non'}"><span aria-hidden="true">${d.inclus.includes(p.id) ? '✓' : '—'}</span>${esc(p.nom)}<span class="sr-only">${d.inclus.includes(p.id) ? ' : inclus' : ' : non inclus'}</span></li>`).join('')}</ul>
          ${d.note ? `<p class="aide">${esc(d.note)}</p>` : ''}
          <div class="rang"><button class="btn petit ${d.retenu ? '' : 'primaire'}" data-action="retenir-devis" data-id="${d.id}">${d.retenu ? 'Ne plus retenir' : 'Retenir ce devis'}</button><button class="btn petit" data-action="devis" data-id="${d.id}">Modifier</button></div>
        </li>`;
      }).join('')}</ul>
      <p class="mention" style="margin-top:16px">Avant de signer, relis les conditions générales du devis : assurance et valeur déclarée, réserves à la livraison, acompte et annulation. Le devis signé fait foi.</p>`;
  }

  function vueVolume(vol, bascule) {
    const groupes = [...new Set(B.meubles.map((m) => m.g))];
    const q = (id) => E.volume.items[id] || 0;
    const stepper = (id, nom, v, qte, type = 'meuble') => `<li class="ligne-volume ${qte ? 'pris' : ''}"><span class="lv-nom"><b>${esc(nom)}</b><span>${m3(v)}${qte ? ` × ${qte} = ${m3(Math.round(v * qte * 100) / 100)}` : ''}</span></span>
      <span class="stepper"><button class="btn-icone petit" data-action="volume-moins" data-type="${type}" data-id="${id}" aria-label="Retirer un : ${esc(nom)}" ${qte ? '' : 'disabled'}>−</button><b aria-live="polite">${qte}</b><button class="btn-icone petit" data-action="volume-plus" data-type="${type}" data-id="${id}" aria-label="Ajouter un : ${esc(nom)}">+</button></span></li>`;
    return `
      <div class="vue-tete"><div><h1>Volume</h1><p>Compte tes meubles et tes cartons : le volume estimé sert à demander des devis sur la même base et à choisir la taille d'un utilitaire. Volumes indicatifs, à confirmer par le déménageur.</p></div>
        <div class="actions"><button class="btn" data-action="copier-volume">Copier l'inventaire</button></div></div>${bascule}
      <div class="volume-bilan">
        <div><p class="surtitre">Volume estimé</p><b>${m3(vol.total)}</b></div>
        <dl><div><dt>Meubles et objets</dt><dd>${m3(vol.mobilier)}</dd></div><div><dt>${pluriel(vol.nbCartons, 'carton')} × ${String(B.volumeCarton).replace('.', ',')} m³</dt><dd>${m3(vol.cartons)}</dd></div><div><dt>Marge</dt><dd>${vol.marge} %</dd></div></dl>
      </div>
      <form class="rang-champs volume-reglages" id="form-volume" onsubmit="return false">
        <label class="champ">Nombre de cartons<small>Vide : les ${pluriel(E.cartons.length, 'carton')} de l'inventaire.</small><input type="number" name="cartons" min="0" max="999" step="1" inputmode="numeric" value="${E.volume.cartons ?? ''}" placeholder="${E.cartons.length}"></label>
        <label class="champ">Marge<small>Pour ce qu'on oublie, de 0 à 50 %.</small><input type="number" name="marge" min="0" max="50" step="1" inputmode="numeric" value="${E.volume.marge}"></label>
      </form>
      ${groupes.map((g) => `<section class="groupe-volume"><h2 class="titre-cat">${esc(g)}<span>${m3(Math.round(B.meubles.filter((m) => m.g === g).reduce((s, m) => s + m.v * q(m.id), 0) * 10) / 10)}</span></h2><ul class="liste-volume">${B.meubles.filter((m) => m.g === g).map((m) => stepper(m.id, m.nom, m.v, q(m.id))).join('')}</ul></section>`).join('')}
      <section class="groupe-volume"><h2 class="titre-cat">Autres objets<span>ajoutés par toi</span></h2>
        ${E.volume.extras.length ? `<ul class="liste-volume">${E.volume.extras.map((x) => stepper(x.id, x.nom, x.vol, x.qte, 'extra')).join('')}</ul>` : '<p class="aide">Un objet qui n\'est pas dans la liste (aquarium, vélo cargo, trampoline…) : ajoute-le avec son volume approximatif.</p>'}
        <div class="rang"><button class="btn petit" data-action="nouvel-extra">${ICONES.plus}Ajouter un objet</button></div></section>
      <p class="mention" style="margin-top:16px">Volumes indicatifs (ordres de grandeur pour un meuble courant), modifiables par objet ajouté. Carton standard de 55 × 35 × 30 cm ≈ ${String(B.volumeCarton).replace('.', ',')} m³. Seule la visite ou l'inventaire du déménageur fait foi.</p>`;
  }

  function texteVolume() {
    const vol = R.volumeEstime(E.volume, B.meubles, E.cartons.length, { volumeCarton: B.volumeCarton });
    const lignes = B.meubles.filter((m) => E.volume.items[m.id]).map((m) => `- ${m.nom} × ${E.volume.items[m.id]}`);
    const extras = E.volume.extras.filter((x) => x.qte).map((x) => `- ${x.nom} × ${x.qte} (≈ ${m3(x.vol)} l'unité)`);
    return [`Inventaire pour devis de déménagement · ${dateLongue(E.date)}`, E.depuis || E.vers ? `${E.depuis || '…'} → ${E.vers || '…'}` : '', '', 'Meubles et objets :', ...lignes, ...extras, '', `Cartons : ${vol.nbCartons} (standard 55 × 35 × 30 cm)`, `Volume estimé : ${m3(vol.total)} (dont ${vol.marge} % de marge)`, '', 'Merci de préciser dans le devis : volume retenu, prestations incluses, assurance et valeur déclarée, acompte et validité.'].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  }

  // ---------- Budget ----------
  function vueBudget() {
    const bu = R.totauxBudget(E.budget);
    const tete = `<div class="vue-tete"><div><h1>Budget</h1><p>Ce que coûte le déménagement : prévu, réel et payé, poste par poste. Le devis retenu s'inscrit tout seul sur la ligne « Déménageur ».</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle-ligne">${ICONES.plus}Dépense</button>${E.budget.length ? '<button class="btn" data-action="csv-budget">Exporter en CSV</button>' : ''}</div></div>`;
    if (!E.budget.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune dépense</h3><p>Déménageur ou utilitaire, cartons, ménage, double loyer, garde-meubles… Note le prévu, puis le réel une fois payé.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-ligne">${ICONES.plus}Première dépense</button></div></div></div>`;
    const ecartTexte = bu.reel ? (bu.ecart > 0 ? `${eur(bu.ecart)} de plus que prévu sur les dépenses réglées` : bu.ecart < 0 ? `${eur(-bu.ecart)} de moins que prévu sur les dépenses réglées` : 'conforme au prévu sur les dépenses réglées') : 'aucune dépense réelle saisie';
    return `${tete}
      <div class="tuiles">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Prévu</p><b>${eur(bu.prevu)}</b><span>${pluriel(bu.lignes, 'poste')}${bu.sansMontant ? `, dont ${bu.sansMontant} sans montant` : ''}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Estimé</p><b>${eur(bu.estime)}</b><span>réel quand il est connu, sinon prévu</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Écart</p><b>${bu.reel ? `${bu.ecart > 0 ? '+' : bu.ecart < 0 ? '−' : ''}${eur(Math.abs(bu.ecart))}` : '—'}</b><span>${esc(ecartTexte)}</span></div>
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Reste à payer</p><b>${eur(bu.resteAPayer)}</b><span>payé : ${eur(bu.paye)}</span></div>
      </div>
      <div class="defile"><table class="tableau tableau-budget">
        <thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Réel</th><th>Payé</th><th><span class="sr-only">Modifier</span></th></tr></thead>
        <tbody>${E.budget.map((l) => {
          const dep = l.reel > 0 && l.prevu > 0 && l.reel > l.prevu;
          return `<tr class="${l.paye ? 'paye' : ''}"><td><button class="lien-ligne" data-action="ligne" data-id="${l.id}"><b>${esc(l.libelle)}</b>${l.devis ? '<span>Lié au devis retenu</span>' : ''}</button></td><td class="nb">${eur(l.prevu)}</td><td class="nb ${dep ? 'depasse' : ''}">${eur(l.reel)}</td><td><label class="case"><input type="checkbox" data-action="payer" data-id="${l.id}" ${l.paye ? 'checked' : ''}><span class="sr-only">Payé : ${esc(l.libelle)}</span></label></td><td><button class="btn petit" data-action="ligne" data-id="${l.id}">Modifier</button></td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${eur(bu.prevu)}</td><td class="nb">${eur(bu.reel)}</td><td colspan="2">${eur(bu.paye)} payés</td></tr></tfoot>
      </table></div>
      <p class="mention" style="margin-top:14px">Les aides au déménagement éventuelles (employeur, caisse d'allocations…) dépendent de ta situation : renseigne-toi auprès de chaque organisme. Outil de suivi, pas un conseil financier.</p>`;
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
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const optionsCat = (v) => B.categories.map((c) => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>${esc(c.long)}</option>`).join('');

  function modaleTache(tid) {
    const k = tid ? E.taches.find((x) => x.id === tid) : null;
    if (tid && !k) return;
    const v = k || { titre: '', cat: filtre.cat !== 'toutes' ? filtre.cat : 'organisation', j: Math.min(0, ecart(E.date, auj())), note: '', statut: 'afaire', faitLe: null, aide: '' };
    const corps = `
      ${k?.aide ? `<p class="conseil-tache"><b>Conseil</b>${esc(k.aide)}</p>` : ''}
      <label class="champ">Tâche<input name="titre" required maxlength="160" value="${esc(v.titre)}" placeholder="Ex. : Réserver l'ascenseur de service"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="cat">${optionsCat(v.cat)}</select></label>
        <label class="champ">Échéance<small>J−30, J, J+7… (J = ${dateCourte(E.date)})</small><input name="j" required value="${libJ(v.j).replace('−', '-')}" inputmode="text" autocomplete="off"></label>
      </div>
      <p class="aide" id="apercu-ech">Échéance : ${dateLongue(R.echeance(E.date, v))}</p>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${[['afaire', 'À faire'], ['fait', 'Fait'], ['so', 'Sans objet']].map(([s, l]) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-fait" ${v.statut === 'fait' ? '' : 'hidden'}>Fait le<input type="date" name="faitLe" value="${v.faitLe || auj()}"></label>
      <label class="champ">Note<small>Facultative : numéro de dossier, interlocuteur, référence.</small><input name="note" maxlength="200" value="${esc(v.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = k
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Retirer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(k ? 'Tâche' : 'Nouvelle tâche', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        retenir();
        E.taches = E.taches.filter((x) => x.id !== k.id);
        if (k.ref && !E.masquees.includes(k.ref)) E.masquees.push(k.ref);
        sauver(); rendre(); toast('Tâche retirée de ta checklist.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique la tâche.';
      const j = R.lireJ(f.get('j'));
      if (j === null || Math.abs(j) > 365) return 'Échéance illisible : écris par exemple J-30, J ou J+7.';
      const statut = f.get('statut') || 'afaire';
      retenir();
      const donnees = R.normaliserTache({ id: k?.id || uid(), ref: k?.ref || null, aide: k?.aide || '', ordre: k?.ordre, titre, cat: f.get('cat'), j, statut, faitLe: statut === 'fait' ? (f.get('faitLe') || auj()) : statut === 'so' ? auj() : null, note: f.get('note') });
      if (k) Object.assign(k, donnees); else E.taches.push(donnees);
      E.taches = R.trierTaches(E.taches);
      sauver(); rendre();
      toast(k ? 'Tâche enregistrée.' : `Tâche ajoutée pour le ${dateLongue(R.echeance(E.date, donnees))}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', () => { d.querySelector('#champ-fait').hidden = d.querySelector('[name=statut]:checked').value !== 'fait'; }));
    d.querySelector('[name=j]').addEventListener('input', (e) => { const j = R.lireJ(e.target.value); d.querySelector('#apercu-ech').textContent = j === null ? 'Échéance : à préciser (J-30, J, J+7…)' : `Échéance : ${dateLongue(R.echeance(E.date, { j }))}`; });
  }

  function modaleDate() {
    ouvrirModale('Date du déménagement', `
      <p>Toutes les échéances sont relatives au jour J : elles suivent la nouvelle date. Les tâches déjà faites gardent leur date.</p>
      <label class="champ">Jour J<input type="date" name="date" value="${E.date}" required></label>
      <p class="aide" id="apercu-date"></p><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Changer la date</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date');
      if (!R.estDate(date)) return 'Choisis une date.';
      if (date === E.date) return;
      const dec = R.decalage(E.date, date, E.taches);
      retenir();
      E.date = date;
      E.devis.forEach((d) => { if (d.date === annulation.date) d.date = date; });
      sauver(); rendre();
      toast(`Jour J le ${dateLongue(date)} : ${pluriel(dec.taches, 'échéance déplacée', 'échéances déplacées')} de ${pluriel(Math.abs(dec.jours), 'jour')}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const v = d.querySelector('[name=date]').value; const dec = R.estDate(v) ? R.decalage(E.date, v, E.taches) : null; d.querySelector('#apercu-date').textContent = dec && dec.jours ? `${dec.jours > 0 ? 'Report' : 'Avance'} de ${pluriel(Math.abs(dec.jours), 'jour')} : ${pluriel(dec.taches, 'tâche')} à faire changent d'échéance.` : ''; };
    d.querySelector('[name=date]').addEventListener('input', maj);
  }

  function modaleCarton(cid, pieceParDefaut = null) {
    const c = cid ? E.cartons.find((x) => x.id === cid) : null;
    if (cid && !c) return;
    const dernier = E.cartons[E.cartons.length - 1];
    const v = c || { num: R.numeroSuivant(E.cartons), piece: pieceParDefaut || (filtre.piece !== 'toutes' && filtre.piece !== 'sans' ? filtre.piece : dernier?.piece || E.pieces[0]?.id), contenu: '', note: '', fragile: false, lourd: false, prioritaire: false, statut: 'remplir' };
    const corps = `
      <div class="rang-champs">
        <label class="champ champ-num">Numéro<input type="number" name="num" min="1" max="9999" step="1" inputmode="numeric" value="${v.num}" required></label>
        <label class="champ">Pièce d'arrivée<select name="piece">${E.pieces.map((p) => `<option value="${p.id}" ${p.id === v.piece ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}<option value="" ${!piece(v.piece) ? 'selected' : ''}>Sans pièce</option></select></label>
      </div>
      <label class="champ">Contenu<small>Quelques mots qui serviront à le retrouver : « perceuse, tournevis, niveau ».</small><textarea name="contenu" rows="3" maxlength="400" placeholder="Ex. : Vaisselle, assiettes plates et creuses">${esc(v.contenu)}</textarea></label>
      <div class="cases-ligne">${[['fragile', 'Fragile'], ['lourd', 'Lourd'], ['prioritaire', 'À ouvrir en premier']].map(([n, l]) => `<label class="case"><input type="checkbox" name="${n}" ${v[n] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <fieldset class="champ"><legend>Où en est-il ?</legend><div class="choix-statut">${B.statutsCarton.map((s) => `<label><input type="radio" name="statut" value="${s.id}" ${v.statut === s.id ? 'checked' : ''}><span>${s.court}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Note<small>Facultative.</small><input name="note" maxlength="120" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = c
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? `Carton n° ${c.num}` : 'Nouveau carton', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        retenir(); E.cartons = E.cartons.filter((x) => x.id !== c.id);
        sauver(); rendre(); toast(`Carton n° ${c.num} supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const num = Math.round(Number(f.get('num')));
      if (!(num >= 1 && num <= 9999)) return 'Numéro entre 1 et 9999.';
      if (E.cartons.some((x) => x.num === num && x.id !== c?.id)) return `Le numéro ${num} est déjà pris (prochain libre : ${R.numeroSuivant(E.cartons)}).`;
      retenir();
      const donnees = R.normaliserCarton({ id: c?.id || uid(), num, piece: f.get('piece') || null, contenu: f.get('contenu'), note: f.get('note'), fragile: f.get('fragile') === 'on', lourd: f.get('lourd') === 'on', prioritaire: f.get('prioritaire') === 'on', statut: f.get('statut') });
      if (c) Object.assign(c, donnees); else E.cartons.push(donnees);
      sauver(); rendre();
      if (action === 'encore') {
        toast(`Carton n° ${num} ajouté.`, { libelle: 'Annuler', faire: annuler });
        modale().dataset.garder = '1';
        setTimeout(() => modaleCarton(null, donnees.piece), 0);
        return;
      }
      toast(c ? `Carton n° ${num} enregistré.` : `Carton n° ${num} ajouté : écris « ${num} » sur le carton, ou imprime son étiquette.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function avancerCarton(cid) {
    const c = E.cartons.find((x) => x.id === cid);
    const s = c && SUIVANT[c.statut];
    if (!s) return;
    retenir();
    c.statut = s[0];
    sauver(); rendre();
    toast(`Carton n° ${c.num} : ${LIB_CARTON[c.statut].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modalePieces() {
    const lignes = () => E.pieces.map((p, i) => `<li class="ligne-piece"><span class="pastille-piece grande" style="--p:${esc(p.couleur)}" aria-hidden="true"></span><label class="champ"><span class="sr-only">Nom de la pièce ${i + 1}</span><input name="nom-${p.id}" maxlength="40" value="${esc(p.nom)}"></label><select name="couleur-${p.id}" aria-label="Couleur de l'étiquette : ${esc(p.nom)}">${B.couleurs.map((c, k) => `<option value="${c}" ${c === p.couleur ? 'selected' : ''}>${esc(B.nomsCouleurs[k] || `Couleur ${k + 1}`)}</option>`).join('')}</select><button type="button" class="btn-icone petit" data-action="retirer-piece" data-piece="${p.id}" aria-label="Retirer : ${esc(p.nom)}">×</button></li>`).join('');
    ouvrirModale('Mes pièces', `
      <p class="aide">Les pièces du nouveau logement : chaque carton y est rangé, son étiquette en prend la couleur. Colle le même nom sur chaque porte le jour J.</p>
      <ul class="liste-pieces">${lignes()}</ul>
      <div class="rang-champs"><label class="champ">Ajouter une pièce<input name="nouvelle" maxlength="40" list="autres-pieces" placeholder="Ex. : Chambre 3"></label></div>
      <datalist id="autres-pieces">${B.autresPieces.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      const retirees = new Set(String(modale().dataset.retirees || '').split(',').filter(Boolean));
      const avec = E.pieces.filter((p) => retirees.has(p.id) && E.cartons.some((c) => c.piece === p.id));
      if (avec.length && !confirm(`${avec.map((p) => p.nom).join(', ')} : des cartons y sont rangés. Ils passeront « sans pièce ». Continuer ?`)) { annulation = null; return 'Pièce gardée.'; }
      E.pieces = E.pieces.filter((p) => !retirees.has(p.id)).map((p) => ({ ...p, nom: String(f.get(`nom-${p.id}`) || p.nom).trim() || p.nom, couleur: f.get(`couleur-${p.id}`) || p.couleur }));
      const nv = String(f.get('nouvelle') || '').trim();
      if (nv) E.pieces.push(R.normaliserPiece({ id: uid(), nom: nv }, E.pieces.length, B.couleurs));
      sauver(); rendre(); toast('Pièces enregistrées.', { libelle: 'Annuler', faire: annuler });
      delete modale().dataset.retirees;
    });
  }

  function modaleDevis(did) {
    const d = did ? E.devis.find((x) => x.id === did) : null;
    if (did && !d) return;
    const vol = R.volumeEstime(E.volume, B.meubles, E.cartons.length, { volumeCarton: B.volumeCarton });
    const v = d || { entreprise: '', formule: 'standard', montant: null, volume: null, date: E.date, validite: null, acompte: null, visite: false, inclus: [], note: '' };
    const n = (x) => (x === null || x === undefined ? '' : String(x));
    const corps = `
      <label class="champ">Déménageur<small>Le nom de l'entreprise, tel qu'il figure sur le devis.</small><input name="entreprise" required maxlength="60" value="${esc(v.entreprise)}" placeholder="Ex. : Déménageur A"></label>
      <div class="rang-champs">
        <label class="champ">Formule<select name="formule">${B.formules.map((f) => `<option value="${f.id}" ${f.id === v.formule ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label>
        <label class="champ">Montant TTC (€)<input name="montant" inputmode="decimal" value="${n(v.montant)}" placeholder="Ex. : 1450"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Volume du devis (m³)<small>Vide : ton estimation (${m3(vol.total)}).</small><input name="volume" inputmode="decimal" value="${n(v.volume)}"></label>
        <label class="champ">Acompte (€)<input name="acompte" inputmode="decimal" value="${n(v.acompte)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Date proposée<input type="date" name="date" value="${v.date || ''}"></label>
        <label class="champ">Valable jusqu'au<input type="date" name="validite" value="${v.validite || ''}"></label>
      </div>
      <label class="case"><input type="checkbox" name="visite" ${v.visite ? 'checked' : ''}> Devis établi après une visite ou un inventaire précis</label>
      <fieldset class="champ cadre-champs"><legend>Compris dans le prix</legend><div class="profils-cases">${B.prestations.map((p) => `<label class="case"><input type="checkbox" name="inclus" value="${p.id}" ${v.inclus.includes(p.id) ? 'checked' : ''}> <span>${esc(p.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Note<small>Facultative : nombre de déménageurs, taille du camion, conditions particulières.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(d ? esc(d.entreprise) : 'Nouveau devis', corps,
      `<button class="btn primaire" value="ok">${d ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${d ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
        if (action === 'supprimer') {
          retenir(); E.devis = E.devis.filter((x) => x.id !== d.id);
          E.budget.forEach((l) => { if (l.devis === d.id) l.devis = null; });
          sauver(); rendre(); toast(`Devis « ${d.entreprise} » supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
        }
        const entreprise = String(f.get('entreprise') || '').trim();
        if (!entreprise) return 'Indique le nom du déménageur.';
        for (const champ of ['montant', 'volume', 'acompte']) if (String(f.get(champ) || '').trim() && R.montant(f.get(champ)) === null) return `${champ === 'montant' ? 'Montant' : champ === 'volume' ? 'Volume' : 'Acompte'} illisible : écris un nombre, par exemple 1450 ou 28,5.`;
        retenir();
        const donnees = R.normaliserDevis({ id: d?.id || uid(), entreprise, formule: f.get('formule'), montant: f.get('montant'), volume: f.get('volume'), acompte: f.get('acompte'), date: f.get('date'), validite: f.get('validite'), visite: f.get('visite') === 'on', inclus: f.getAll('inclus'), note: f.get('note'), retenu: d?.retenu });
        if (d) Object.assign(d, donnees); else E.devis.push(donnees);
        if (d?.retenu) E.budget.forEach((l) => { if (l.devis === d.id) { l.prevu = donnees.montant || 0; l.libelle = `Déménageur · ${entreprise}`; } });
        sauver(); rendre(); toast(d ? 'Devis enregistré.' : `Devis « ${entreprise} » ajouté.`, { libelle: 'Annuler', faire: annuler });
      });
  }

  function retenirDevis(id) {
    const d = E.devis.find((x) => x.id === id);
    if (!d) return;
    retenir();
    const r = R.retenirDevis(E.devis, E.budget, id);
    E.devis = r.devis; E.budget = r.budget;
    sauver(); rendre();
    toast(d.retenu ? `« ${d.entreprise} » n'est plus retenu (la ligne de budget reste).` : `« ${d.entreprise} » retenu : ${eur(d.montant)} inscrits au budget.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleLigne(lid) {
    const l = lid ? E.budget.find((x) => x.id === lid) : null;
    if (lid && !l) return;
    const v = l || { poste: 'autre', libelle: '', prevu: null, reel: null, paye: false };
    const n = (x) => (x === null || x === undefined ? '' : String(x));
    ouvrirModale(l ? 'Dépense' : 'Nouvelle dépense', `
      <div class="rang-champs">
        <label class="champ">Poste<select name="poste">${B.postes.map((p) => `<option value="${p.id}" ${p.id === v.poste ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Libellé<small>Vide : le nom du poste.</small><input name="libelle" maxlength="80" value="${esc(v.libelle)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Prévu (€)${l?.devis ? '<small>Repris du devis retenu.</small>' : ''}<input name="prevu" inputmode="decimal" value="${n(v.prevu)}"></label>
        <label class="champ">Réel (€)<small>Une fois la dépense connue.</small><input name="reel" inputmode="decimal" value="${n(v.reel)}"></label>
      </div>
      <label class="case"><input type="checkbox" name="paye" ${v.paye ? 'checked' : ''}> Payé</label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${l ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${l ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { retenir(); E.budget = E.budget.filter((x) => x.id !== l.id); sauver(); rendre(); toast('Dépense supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      for (const champ of ['prevu', 'reel']) if (String(f.get(champ) || '').trim() && R.montant(f.get(champ)) === null) return 'Montant illisible : écris un nombre, par exemple 180 ou 96,50.';
      const poste = f.get('poste');
      retenir();
      const donnees = R.normaliserLigne({ id: l?.id || uid(), poste, libelle: String(f.get('libelle') || '').trim() || (B.postes.find((p) => p.id === poste) || {}).nom, prevu: f.get('prevu'), reel: f.get('reel'), paye: f.get('paye') === 'on', devis: l?.devis });
      if (l) Object.assign(l, donnees); else E.budget.push(donnees);
      sauver(); rendre(); toast(l ? 'Dépense enregistrée.' : `« ${donnees.libelle} » ajouté au budget.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleExtra(xid) {
    const x = xid ? E.volume.extras.find((e) => e.id === xid) : null;
    ouvrirModale(x ? esc(x.nom) : 'Ajouter un objet', `
      <label class="champ">Objet<input name="nom" required maxlength="60" value="${esc(x?.nom || '')}" placeholder="Ex. : Aquarium"></label>
      <div class="rang-champs"><label class="champ">Volume d'un objet (m³)<small>Longueur × largeur × hauteur en mètres.</small><input name="vol" inputmode="decimal" value="${x ? String(x.vol).replace('.', ',') : ''}" required></label>
      <label class="champ">Quantité<input type="number" name="qte" min="1" max="99" step="1" value="${x?.qte || 1}"></label></div>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { retenir(); E.volume.extras = E.volume.extras.filter((e) => e.id !== x.id); sauver(); rendre(); return; }
      const nom = String(f.get('nom') || '').trim();
      const vol = R.montant(f.get('vol'));
      if (!nom) return 'Indique l\'objet.';
      if (!(vol > 0 && vol < 20)) return 'Volume illisible : par exemple 0,4 pour un objet de 1 m × 0,5 m × 0,8 m.';
      retenir();
      const donnees = { id: x?.id || uid(), nom, vol, qte: Math.max(1, Math.min(99, Math.round(Number(f.get('qte')) || 1))) };
      if (x) Object.assign(x, donnees); else E.volume.extras.push(donnees);
      sauver(); rendre(); toast(`« ${nom} » ajouté au volume.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function changerVolume(type, id, delta) {
    if (type === 'extra') {
      const x = E.volume.extras.find((e) => e.id === id);
      if (!x) return;
      if (x.qte + delta <= 0) { modaleExtra(id); return; }
      x.qte = Math.min(99, x.qte + delta);
    } else {
      const q = Math.max(0, Math.min(99, (E.volume.items[id] || 0) + delta));
      if (q) E.volume.items[id] = q; else delete E.volume.items[id];
    }
    sauver(); rendre();
  }

  function cocher(tid, statut) {
    const k = E.taches.find((x) => x.id === tid);
    if (!k) return;
    retenir();
    const avant = k.statut;
    k.statut = k.statut === statut ? 'afaire' : statut;
    k.faitLe = k.statut === 'afaire' ? null : auj();
    sauver(); rendre();
    const pr = R.progression(E.taches, E.date, auj());
    const msg = k.statut === 'fait' ? `Fait : ${k.titre.slice(0, 60)}${k.titre.length > 60 ? '…' : ''} (${pr.pct} %).` : k.statut === 'so' ? 'Tâche sans objet pour ton déménagement.' : `Tâche remise à faire${avant === 'so' ? ' (elle compte de nouveau)' : ''}.`;
    toast(msg, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Impressions ----------
  function imprimer(html, classe) {
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    el.className = classe;
    el.innerHTML = html;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });

  function etiquette(c) {
    const p = piece(c.piece);
    const drapeaux = [c.fragile ? '<span>Fragile</span>' : '', c.lourd ? '<span>Lourd</span>' : '', c.prioritaire ? '<span>À ouvrir en premier</span>' : ''].join('');
    return `<div class="etiq" style="--p:${esc(p?.couleur || '#6E685F')}"><div class="etiq-bande"></div><div class="etiq-corps"><b class="etiq-num">${c.num}</b><div><p class="etiq-piece">${esc(p?.nom || 'Sans pièce')}</p><p class="etiq-contenu">${esc(c.contenu.slice(0, 90))}${c.contenu.length > 90 ? '…' : ''}</p></div></div><div class="etiq-pied"><span class="haut">↑ Haut</span>${drapeaux}</div></div>`;
  }

  function modaleEtiquettes() {
    ouvrirModale('Étiquettes des cartons', `
      <p>Huit étiquettes par page A4 : grand numéro, pièce d'arrivée et sa couleur, contenu, mentions « Fragile », « Lourd » et « À ouvrir en premier ». Découpe-les et colle-les sur deux faces du carton.</p>
      <fieldset class="champ"><legend>Quels cartons ?</legend><div class="choix-liste">
        <label class="choix-ligne"><input type="radio" name="quels" value="tous" checked><span>Tous (${E.cartons.length})</span></label>
        <label class="choix-ligne"><input type="radio" name="quels" value="fermes"><span>Fermés seulement (${E.cartons.filter((c) => c.statut === 'ferme').length})</span></label>
        <label class="choix-ligne"><input type="radio" name="quels" value="plage"><span>Du numéro… au numéro…</span></label>
      </div></fieldset>
      <div class="rang-champs"><label class="champ">Du n°<input type="number" name="de" min="1" value="1"></label><label class="champ">Au n°<input type="number" name="a" min="1" value="${Math.max(1, R.numeroSuivant(E.cartons) - 1)}"></label></div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Imprimer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const quels = f.get('quels');
      const de = Number(f.get('de')) || 1; const a = Number(f.get('a')) || 9999;
      const liste = [...E.cartons].sort((x, y) => x.num - y.num).filter((c) => quels === 'tous' || (quels === 'fermes' && c.statut === 'ferme') || (quels === 'plage' && c.num >= de && c.num <= a));
      if (!liste.length) return 'Aucun carton à imprimer avec ce choix.';
      const pages = [];
      for (let i = 0; i < liste.length; i += 8) pages.push(`<div class="planche">${liste.slice(i, i + 8).map(etiquette).join('')}</div>`);
      imprimer(pages.join(''), 'impr-etiquettes');
    });
  }

  function imprimerListe() {
    const t = auj();
    const groupes = R.parPiece(E.cartons, E.pieces);
    imprimer(`
      <header><p>Déménagement du ${dateLongue(E.date)}${E.depuis || E.vers ? ` · ${esc(E.depuis || '…')} → ${esc(E.vers || '…')}` : ''} · liste au ${dateCourte(t)}</p><h1>Cartons par pièce</h1><p>${pluriel(E.cartons.length, 'carton')} · ${pluriel(R.avancementCartons(E.cartons).fragiles, 'fragile')}</p></header>
      ${groupes.map((g) => `<h2><i class="pastille-piece" style="--p:${esc(piece(g.piece)?.couleur || '#6E685F')}"></i>${esc(g.piece ? nomPiece(g.piece) : 'Sans pièce')} · ${pluriel(g.total, 'carton')}</h2><table><thead><tr><th>N°</th><th>Contenu</th><th>Mentions</th><th>Arrivé</th></tr></thead><tbody>${g.cartons.map((c) => `<tr><td><b>${c.num}</b></td><td>${esc(c.contenu)}${c.note ? `<br><small>${esc(c.note)}</small>` : ''}</td><td>${[c.fragile ? 'Fragile' : '', c.lourd ? 'Lourd' : '', c.prioritaire ? 'En premier' : ''].filter(Boolean).join(', ')}</td><td>${c.statut === 'arrive' || c.statut === 'deballe' ? '✓' : '☐'}</td></tr>`).join('')}</tbody></table>`).join('')}
      <p class="mention">Liste à remettre au déménageur ou à garder sur soi : cocher « Arrivé » au déchargement.</p>`, 'impr-liste');
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="rang-champs">
        <label class="champ">Tu quittes<input name="depuis" maxlength="60" value="${esc(E.depuis)}"></label>
        <label class="champ">Tu emménages<input name="vers" maxlength="60" value="${esc(E.vers)}"></label>
      </div>
      <p class="aide">Jour J : <b>${dateLongue(E.date)}</b>. <button class="btn lien" type="button" data-action="changer-date">Changer la date</button></p>
      <details class="plus-tard"><summary>Ma situation <small>ajoute ou retire les tâches qui vont avec</small></summary><div id="situation-reglages" class="situation">${champsSituation(E.situation)}</div></details>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique ni lien vers un service : exporte en tableur, ou imprime les étiquettes et la liste des cartons depuis l'onglet Cartons.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-taches">Checklist en CSV</button><button class="btn petit" type="button" data-action="csv-cartons">Cartons en CSV</button><button class="btn petit" type="button" data-action="csv-budget">Budget en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, pratique le jour J pour pointer les cartons.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Base intégrée version ${B.version}, rédigée pour QME : ${B.taches.length} tâches types en ${B.categories.length} catégories, ${B.meubles.length} meubles avec un volume indicatif, ${B.postes.length} postes de budget. Aucune démarche datée ni délai légal chiffré : les délais qui dépendent des textes renvoient à ton bail, à tes contrats ou à service-public.fr. Volumes : ordres de grandeur, pas une mesure. Aucun déménageur, aucun fournisseur ni aucune administration n'est connecté.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const situation = lireSituation($('#situation-reglages'));
      retenir();
      E.depuis = String(f.get('depuis') || '').trim();
      E.vers = String(f.get('vers') || '').trim();
      const change = JSON.stringify(situation) !== JSON.stringify(E.situation);
      if (change) {
        const r = R.appliquerSituation(E.taches, B.taches, situation, E.masquees);
        E.situation = situation; E.taches = r.taches;
        sauver(); rendre();
        toast(`Situation enregistrée : ${pluriel(r.ajoutees.length, 'tâche ajoutée', 'tâches ajoutées')}, ${pluriel(r.retirees.length, 'retirée')}.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.taches) || !Array.isArray(d.cartons)) throw new Error();
        if (!confirm(`Remplacer ton déménagement actuel par cette copie (${pluriel(d.taches.length, 'tâche')}, ${pluriel(d.cartons.length, 'carton')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ton déménagement.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `demenagement-${auj()}.json`);
  const exporterCsv = (type) => {
    const contenu = type === 'taches' ? R.versCsvTaches(E.taches, E.date, nomCat, auj()) : type === 'cartons' ? R.versCsvCartons(E.cartons, (id) => (piece(id) ? nomPiece(id) : '')) : R.versCsvBudget(E.budget);
    telecharger(contenu, 'text/csv;charset=utf-8', `demenagement-${type}-${auj()}.csv`);
  };
  async function copierVolume() {
    const texte = texteVolume();
    try { await navigator.clipboard.writeText(texte); toast('Inventaire copié : colle-le dans ta demande de devis.'); } catch {
      ouvrirModale('Inventaire pour les devis', `<p class="aide">Sélectionne le texte et copie-le.</p><textarea class="texte-copie" rows="14" readonly>${esc(texte)}</textarea>`, '<button class="btn primaire" value="ok">Fermer</button>');
    }
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.situation = lireSituation($('#situation-accueil')); accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'voir-piece': filtre.piece = el.dataset.piece || 'sans'; filtre.q = ''; changerVue('cartons'); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-taches': exporterCsv('taches'); break;
      case 'csv-cartons': exporterCsv('cartons'); break;
      case 'csv-budget': exporterCsv('budget'); break;
      case 'fermer': modale().close(); break;
      case 'changer-date': modaleDate(); break;
      case 'cocher': cocher(el.dataset.tache, 'fait'); break;
      case 'sans-objet': cocher(el.dataset.tache, 'so'); break;
      case 'tache': modaleTache(el.dataset.tache); break;
      case 'nouvelle-tache': modaleTache(null); break;
      case 'filtre-cat': filtre.cat = el.dataset.cat; rendre(); break;
      case 'masquer-faites': filtre.faites = el.checked; rendre(); break;
      case 'nouveau-carton': modaleCarton(null); break;
      case 'carton': modaleCarton(id); break;
      case 'avancer-carton': avancerCarton(id); break;
      case 'filtre-piece': filtre.piece = el.dataset.piece; rendre(); break;
      case 'pieces': modalePieces(); break;
      case 'retirer-piece': { const li = el.closest('li'); const d = modale(); d.dataset.retirees = [d.dataset.retirees, el.dataset.piece].filter(Boolean).join(','); li.remove(); break; }
      case 'etiquettes': modaleEtiquettes(); break;
      case 'imprimer-liste': imprimerListe(); break;
      case 'devis-vue': filtre.devis = el.dataset.sous; rendre(); break;
      case 'nouveau-devis': modaleDevis(null); break;
      case 'devis': modaleDevis(id); break;
      case 'retenir-devis': retenirDevis(id); break;
      case 'volume-plus': changerVolume(el.dataset.type, id, 1); break;
      case 'volume-moins': changerVolume(el.dataset.type, id, -1); break;
      case 'nouvel-extra': modaleExtra(null); break;
      case 'copier-volume': copierVolume(); break;
      case 'nouvelle-ligne': modaleLigne(null); break;
      case 'ligne': modaleLigne(id); break;
      case 'payer': { const l = E.budget.find((x) => x.id === id); if (l) { retenir(); l.paye = el.checked; sauver(); rendre(); toast(l.paye ? `« ${l.libelle} » payé.` : `« ${l.libelle} » à payer.`, { libelle: 'Annuler', faire: annuler }); } break; }
      default: break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-cherche') return;
    e.preventDefault();
    filtre.q = $('#cherche-tableau').value; filtre.piece = 'toutes';
    changerVue('cartons');
    const n = $('#recherche'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('#form-volume');
    if (!f) return;
    const cartons = f.querySelector('[name=cartons]').value;
    const marge = Number(f.querySelector('[name=marge]').value);
    E.volume.cartons = cartons === '' ? null : Math.max(0, Math.min(999, Math.round(Number(cartons)) || 0));
    E.volume.marge = Number.isFinite(marge) ? Math.max(0, Math.min(50, Math.round(marge))) : 10;
    sauver(); rendre();
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
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
  window.__demenagement = { etat: () => E, regles: R };
  init();
})();
