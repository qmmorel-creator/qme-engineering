// Papiers du foyer QME : inventaire des documents du foyer et de leur emplacement (classeur, boîte, cloud…),
// durée de conservation reprise de service-public.gouv.fr (datée, modifiable document par document), « peut
// être jeté » calculé, échéances de renouvellement saisies par l'utilisateur, recherche « où est… »,
// inventaire imprimable et fiche « en cas d'urgence » pour un proche.
// Aucune pièce d'identité stockée : on note où est le document, jamais son contenu ni son numéro.
// Données synchronisées par clé de licence ou code d'accès. Aucun service externe connecté.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.DCS;
  const API = '/api/templates';
  const PRODUIT = 'DCS';
  const CLE_CODE = 'qme-dcs-code';
  const CLE_CACHE = 'qme-dcs-cache';
  const CLE_DEMO = 'qme-dcs-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-dcs-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const { pluriel, ajout, ajoutMois, versDate, ecart } = R;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const fmt = (s, o) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const moisAn = (s) => fmt(s, { month: 'long', year: 'numeric' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const cat = (id) => B.categories.find((c) => c.id === id) || B.categories[0];
  const nomCat = (id) => cat(id).nom;
  const pillCat = (id) => `<span class="cat cat-${esc(cat(id).id)}">${esc(nomCat(id))}</span>`;
  const typeDoc = (d) => (d && d.type ? R.typeDe(B, d.type) : null);
  const lieu = (id) => E.lieux.find((l) => l.id === id) || null;
  const nomLieu = (id) => lieu(id)?.nom || 'Pas encore rangé';
  const personne = (id) => E.personnes.find((p) => p.id === id) || null;
  const nomPersonne = (id) => personne(id)?.nom || 'Tout le foyer';
  const pastille = (id) => `<i class="pastille-lieu" style="--p:${esc(lieu(id)?.couleur || '#B8B0A2')}" aria-hidden="true"></i>`;
  const nomTypeLieu = (id) => (B.typesLieu.find((t) => t.id === id) || { nom: 'Autre' }).nom;
  const ctxRecherche = () => ({ nomType: (id) => R.typeDe(B, id)?.nom, nomCat, nomPersonne: (id) => personne(id)?.nom, nomLieu: (id) => lieu(id)?.nom });
  const SOURCE_COURTE = `service-public.gouv.fr, fiche « ${B.source.titre} » vérifiée le ${B.source.verifiePar}, consultée le ${dateLongue(B.source.consulte)}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { cat: 'toutes', statut: 'tous', personne: 'tous', q: '', echeances: false };
  let annulation = null;

  // tutorielVu (guide « Comment ça marche » déjà vu) est gardé tel quel par R.normaliser.
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => ({ tutorielVu: false, ...R.normaliser(d, B) });

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
        toast('Un autre appareil a modifié tes papiers entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (DCS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Foyer fictif de trois personnes. Dates relatives à aujourd'hui : une carte d'identité expirée, un passeport
  // et un contrôle technique à renouveler, des factures et relevés qui peuvent être jetés, d'autres bientôt,
  // une facture sans date, un bail en cours (en attente de la fin de la location), un document libre, un
  // document jeté, un document pas encore rangé.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const an = Number(t.slice(0, 4));
    e.foyer = 'Famille Martin';
    e.personnes = [{ id: 'p-camille', nom: 'Camille' }, { id: 'p-sacha', nom: 'Sacha' }, { id: 'p-lea', nom: 'Léa' }];
    const L = (id, nom, type, i, note = '') => R.normaliserLieu({ id, nom, type, note }, i, B.couleurs);
    e.lieux = [
      L('l-classeur', 'Classeur bleu', 'classeur', 0, 'Bureau, étagère de gauche'),
      L('l-archives', 'Boîte à archives', 'boite', 1, 'Placard de l\'entrée, en haut'),
      L('l-pochette', 'Pochette rouge', 'tiroir', 2, 'Tiroir de la commode, chambre'),
      L('l-cloud', 'Dossier « Papiers » du cloud', 'numerique', 3, 'Sous-dossiers par année'),
      L('l-notaire', 'Étude du notaire', 'ailleurs', 4, 'Originaux des actes'),
    ];
    const D = (type, x) => R.normaliserDoc({ type, id: uid(), ...x }, B);
    e.documents = [
      D('cni', { titre: 'Carte d\'identité', personne: 'p-camille', lieu: 'l-pochette', precision: 'Portefeuille rouge', echeance: ajoutMois(t, 50), essentiel: true }),
      D('cni', { titre: 'Carte d\'identité', personne: 'p-sacha', lieu: 'l-pochette', precision: 'Portefeuille rouge', echeance: ajout(t, -20), essentiel: true, note: 'Rendez-vous à prendre en mairie.' }),
      D('passeport', { titre: 'Passeport', personne: 'p-camille', lieu: 'l-pochette', echeance: ajout(t, 70), rappel: 4, essentiel: true }),
      D('passeport', { titre: 'Passeport', personne: 'p-lea', lieu: 'l-pochette', echeance: ajoutMois(t, 26), essentiel: true }),
      D('vitale', { titre: 'Carte Vitale', personne: 'p-sacha', lieu: 'l-pochette', essentiel: true }),
      D('livret', { titre: 'Livret de famille', lieu: 'l-classeur', precision: 'Onglet Famille, en premier', essentiel: true }),
      D('etatcivil', { titre: 'Actes de naissance (copies intégrales)', lieu: 'l-classeur', precision: 'Onglet Famille', essentiel: true }),
      D('pacs', { titre: 'Convention de Pacs', lieu: 'l-notaire' }),
      D('diplome', { titre: 'Diplôme d\'ingénieur', personne: 'p-camille', lieu: 'l-archives', precision: 'Chemise « Études »', essentiel: true }),
      D('scolfact', { titre: 'Factures de cantine', personne: 'p-lea', lieu: 'l-cloud', precision: 'École', date: ajoutMois(t, -61) }),
      D('bail', { titre: 'Bail et état des lieux de l\'appartement', lieu: 'l-classeur', precision: 'Onglet Logement', date: ajoutMois(t, -40), essentiel: true }),
      D('bail', { titre: 'Bail de l\'ancien studio', lieu: 'l-archives', precision: 'Chemise « Ancien logement »', date: ajoutMois(t, -110), fin: ajoutMois(t, -38) }),
      D('energie', { titre: 'Factures d\'électricité', lieu: 'l-cloud', precision: 'Énergie', date: ajoutMois(t, -62) }),
      D('energie', { titre: 'Factures d\'électricité (année suivante)', lieu: 'l-cloud', precision: 'Énergie', date: ajout(ajoutMois(t, -60), 45) }),
      D('telecom', { titre: 'Factures internet et mobile', lieu: 'l-cloud', precision: 'Internet', date: ajoutMois(t, -30) }),
      D('chaudiere', { titre: 'Attestations d\'entretien de la chaudière', lieu: 'l-classeur', precision: 'Onglet Logement', date: ajoutMois(t, -2), conservation: 'date', garder: ajoutMois(t, 58), note: 'Gardées 5 ans comme conseillé.' }),
      D('achat', { titre: 'Facture du lave-linge', lieu: 'l-classeur', precision: 'Pochette « Garanties »' }),
      D('garantie', { titre: 'Ticket de caisse de l\'ordinateur portable', lieu: 'l-classeur', precision: 'Pochette « Garanties »', date: ajoutMois(t, -14), echeance: ajoutMois(t, 10), rappel: 1 }),
      D('ir', { titre: 'Avis d\'impôt sur le revenu', lieu: 'l-cloud', precision: 'Impôts', date: `${an - 2}-07-31`, essentiel: true }),
      D('ir', { titre: 'Avis d\'impôt sur le revenu (plus ancien)', lieu: 'l-archives', precision: 'Chemise « Impôts »', date: `${an - 4}-07-31` }),
      D('releve', { titre: 'Relevés de compte courant', lieu: 'l-archives', precision: 'Chemise « Banque »', date: ajoutMois(t, -64) }),
      D('credit', { titre: 'Contrat du prêt auto', lieu: 'l-classeur', precision: 'Onglet Banque', date: ajoutMois(t, -30), essentiel: true }),
      D('assvie', { titre: 'Contrat d\'assurance-vie', personne: 'p-camille', lieu: 'l-notaire', essentiel: true }),
      D('carnetsante', { titre: 'Carnet de santé', personne: 'p-lea', lieu: 'l-pochette', essentiel: true }),
      D('ordonnance', { titre: 'Ordonnances de l\'an dernier', lieu: 'l-classeur', precision: 'Onglet Santé', date: ajoutMois(t, -14) }),
      D('feuillesoins', { titre: 'Feuilles de soins papier', lieu: 'l-classeur', precision: 'Onglet Santé', date: ajout(ajoutMois(t, -24), 40) }),
      D('mutuelle', { titre: 'Carte de complémentaire santé', lieu: 'l-pochette', echeance: `${an}-12-31`, rappel: 1, essentiel: true, conservation: 'date', garder: `${an}-12-31` }),
      D('salaire', { titre: 'Bulletins de salaire', personne: 'p-sacha', lieu: 'l-cloud', precision: 'Travail, un dossier par employeur', essentiel: true }),
      D('cartegrise', { titre: 'Carte grise de la voiture', lieu: 'l-pochette', precision: 'Boîte à gants : copie seulement', essentiel: true }),
      D('controle', { titre: 'Contrôle technique de la voiture', lieu: 'l-classeur', precision: 'Onglet Voiture', date: ajoutMois(t, -23), echeance: ajout(t, 40), rappel: 2 }),
      D('permis', { titre: 'Permis de conduire', personne: 'p-sacha', lieu: 'l-pochette', echeance: ajoutMois(t, 80), essentiel: true }),
      D('assurhab', { titre: 'Assurance habitation', lieu: 'l-classeur', precision: 'Onglet Assurances', date: ajoutMois(t, -30), echeance: ajoutMois(t, 6), rappel: 2, essentiel: true }),
      D('avisecheance', { titre: 'Avis d\'échéance assurance auto', lieu: 'l-cloud', precision: 'Assurances', date: ajoutMois(t, -26) }),
      D('energie', { titre: 'Factures de gaz', lieu: 'l-archives', date: ajoutMois(t, -70), jete: ajout(t, -30) }),
      R.normaliserDoc({ id: uid(), type: null, cat: 'logement', titre: 'Plans et notices de la cuisine', lieu: null, conservation: 'toujours', note: 'À ranger avec les garanties.' }, B),
    ];
    e.urgence = {
      message: 'Le classeur bleu est dans le bureau, sur l\'étagère de gauche : un onglet par sujet. Les papiers d\'identité sont dans la pochette rouge, tiroir de la commode. Les originaux des actes sont à l\'étude du notaire.',
      contact: 'Notaire : étude du centre-ville (coordonnées sur son site)',
    };
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Papiers du foyer · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="160" fill="#1D4E89"/>
          <rect x="40" y="44" width="80" height="10" fill="#F0EDE6"/>
          <rect x="160" y="20" width="120" height="160" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M20 280 L20 200 A80 80 0 0 1 100 280 Z" fill="#D9302A"/>
          <rect x="160" y="200" width="120" height="80" fill="#F5B400"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <rect x="370" y="80" width="120" height="140" fill="#141414"/>
          <circle cx="430" cy="150" r="24" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Papiers du foyer</p>
          <h1>Chaque papier a sa place.</h1>
          <p>Où est chaque document, combien de temps le garder, quand renouveler les pièces d'identité, et une fiche pour un proche en cas d'urgence.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes papiers</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton inventaire est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes papiers</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes papiers'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, foyer: '', personnes: ['', '', ''], lieu: '', typeLieu: 'classeur', choix: [...B.depart] });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes papiers, rangés et retrouvés.</h1>
        <p class="intro">Pour chaque document, tu notes où il est rangé. L'application calcule jusqu'à quand le garder (${B.documents.length} documents types, durées reprises de service-public.gouv.fr) et te prévient avant qu'une pièce expire.</p>
        <form id="form-accueil" novalidate>
          <label class="champ" style="max-width:420px">Nom du foyer<small>Facultatif, par exemple « Famille Martin ».</small><input name="foyer" maxlength="60" value="${esc(a.foyer)}"></label>
          <fieldset class="champ cadre-champs" style="max-width:620px"><legend>Les personnes du foyer <small>Prénoms seulement, pour savoir à qui est chaque carte. Facultatif.</small></legend>
            <div class="rang-champs rang-3">${a.personnes.map((p, i) => `<label class="champ"><span class="sr-only">Prénom ${i + 1}</span><input name="personne" maxlength="40" value="${esc(p)}" placeholder="${['Ex. : Camille', 'Ex. : Sacha', 'Ex. : Léa'][i] || 'Prénom'}"></label>`).join('')}</div>
          </fieldset>
          <div class="rang-champs" style="max-width:620px">
            <label class="champ">Ton premier emplacement<small>Là où sont la plupart de tes papiers.</small><input name="lieu" maxlength="50" value="${esc(a.lieu)}" placeholder="Ex. : Classeur bleu"></label>
            <label class="champ">C'est…<small>Tu pourras en ajouter d'autres.</small><select name="typeLieu">${B.typesLieu.map((t) => `<option value="${t.id}" ${t.id === a.typeLieu ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
          </div>
          <p class="erreur" role="alert"></p>
        </form>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton inventaire de départ</h1>
        <p class="intro">Coche ce que tu as : chaque document est créé dans ton premier emplacement (une carte par personne pour les pièces d'identité). Tu préciseras ensuite les dates et l'endroit exact. Tu peux aussi tout décocher et partir de zéro.</p>
        <div id="choix-depart" class="choix-types">${B.categories.map((c) => `<fieldset class="groupe-types"><legend>${esc(c.long)}</legend>${B.documents.filter((t) => t.cat === c.id).map((t) => `<label class="case"><input type="checkbox" name="depart" value="${t.id}" ${a.choix.includes(t.id) ? 'checked' : ''}> <span>${esc(t.nom)}</span></label>`).join('')}</fieldset>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon inventaire</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
  }
  const lireChoix = () => [...document.querySelectorAll('#choix-depart [name=depart]:checked')].map((x) => x.value);

  function accueilSuivant() {
    const f = $('#form-accueil');
    Object.assign(accueil, {
      etape: 2, foyer: f.querySelector('[name=foyer]').value.trim(),
      personnes: [...f.querySelectorAll('[name=personne]')].map((x) => x.value.trim()),
      lieu: f.querySelector('[name=lieu]').value.trim(), typeLieu: f.querySelector('[name=typeLieu]').value,
    });
    const sensible = [accueil.foyer, ...accueil.personnes, accueil.lieu].map(R.contientNumeroSensible).find(Boolean);
    if (sensible) { accueil.etape = 1; f.querySelector('.erreur').textContent = R.MESSAGES_SENSIBLES[sensible]; return; }
    ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    accueil.choix = lireChoix();
    E = etatVide();
    E.foyer = accueil.foyer;
    E.personnes = accueil.personnes.filter(Boolean).map((nom) => R.normaliserPersonne({ id: uid(), nom }));
    E.lieux = [R.normaliserLieu({ id: uid(), nom: accueil.lieu || 'Classeur des papiers', type: accueil.typeLieu }, 0, B.couleurs)];
    E.documents = R.documentsDepart(B, accueil.choix, { lieu: E.lieux[0].id, personnes: E.personnes });
    const n = E.documents.length;
    accueil = accueilVide();
    vue = 'documents';
    sauver();
    demarrer();
    toast(n ? `Ton inventaire est prêt : ${pluriel(n, 'document')}. Complète les dates pour savoir jusqu'à quand les garder.` : 'Ton inventaire est prêt : ajoute ton premier document.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    rangements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    urgence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    loupe: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.5"/></svg>',
  };
  const COURTS = { tableau: 'Accueil', rangements: 'Rangements' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['documents', 'Documents'], ['rangements', 'Rangements'], ['echeances', 'Échéances'], ['urgence', 'Urgence']];
  const AVERTISSEMENT = () => `<p class="mention avertissement">${esc(B.avertissement)} Source : ${esc(SOURCE_COURTE)}.</p>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/papiers/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Papiers du foyer</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Papiers du foyer`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, documents: vueDocuments, rangements: vueRangements, echeances: vueEcheances, urgence: vueUrgence }[vue]();
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
  const surligner = (texte, q) => {
    const mots = R.sansAccents(q).split(/[\s,;'’]+/).filter((m) => m.length > 1).map((m) => (m.length > 3 ? m.replace(/[sx]$/, '') : m));
    if (!mots.length) return esc(texte);
    const brut = String(texte);
    const plat = R.sansAccents(brut);
    if (plat.length !== brut.length) return esc(texte);
    const marques = new Array(brut.length).fill(false);
    for (const m of mots) { let i = plat.indexOf(m); while (i >= 0) { for (let k = i; k < i + m.length; k++) marques[k] = true; i = plat.indexOf(m, i + 1); } }
    let out = ''; let ouvert = false;
    for (let i = 0; i < brut.length; i++) { if (marques[i] && !ouvert) { out += '<mark>'; ouvert = true; } if (!marques[i] && ouvert) { out += '</mark>'; ouvert = false; } out += esc(brut[i]); }
    return out + (ouvert ? '</mark>' : '');
  };

  // Étiquette de conservation d'un document.
  function etiquetteConservation(d, t = auj()) {
    const ty = typeDoc(d);
    const s = R.statutConservation(d, ty, t);
    const g = R.garderJusqua(d, ty);
    if (s === 'jete') return `<span class="etiquette sable">Jeté le ${dateCourte(d.jete)}</span>`;
    if (s === 'jeter') return `<span class="etiquette rouge">Peut être jeté depuis le ${dateCourte(R.jetableLe(d, ty))}</span>`;
    if (s === 'bientot') return `<span class="etiquette jaune">Jetable le ${dateCourte(R.jetableLe(d, ty))}</span>`;
    if (s === 'garder') return `<span class="etiquette">À garder jusqu'au ${dateCourte(g.date)}</span>`;
    if (s === 'toujours') return '<span class="etiquette ciel">À garder toujours</span>';
    if (s === 'adater') return '<span class="etiquette rose">Date du document à saisir</span>';
    if (g.raison === 'fin') { const duree = ty.r.a || ty.r.m || ty.r.j ? R.libelleRegle(ty).replace(/ après .*$/, '') : ''; return `<span class="etiquette">À garder jusqu'à ${esc(g.evenement)}${duree ? ` + ${esc(duree)}` : ''}</span>`; }
    if (g.raison === 'valide') return '<span class="etiquette">À garder tant qu\'il est valable</span>';
    return '<span class="etiquette">Durée à choisir</span>';
  }
  function etiquetteRenouvellement(d, t = auj()) {
    const r = R.renouvellement(d, t);
    if (!r) return '';
    const lib = typeDoc(d)?.ech || 'Échéance';
    if (r.statut === 'expire') return `<span class="etiquette rouge">${esc(lib)} dépassée · ${dateCourte(r.date)}</span>`;
    if (r.statut === 'arenouveler') return `<span class="etiquette jaune">${esc(lib)} : ${r.jours === 0 ? 'aujourd\'hui' : `dans ${pluriel(r.jours, 'jour')}`}</span>`;
    return `<span class="etiquette ciel">${esc(lib)} : ${dateCourte(r.date)}</span>`;
  }
  const ou = (d, q = '') => `${pastille(d.lieu)}${surligner(nomLieu(d.lieu), q)}${d.precision ? ` · ${surligner(d.precision, q)}` : ''}`;

  function ligneDoc(d, { q = '', action = '', compacte = false } = {}) {
    const t = auj();
    const qui = personne(d.personne) ? `<span class="qui">${surligner(nomPersonne(d.personne), q)}</span>` : '';
    const bouton = action === 'jeter' ? `<button class="btn petit" data-action="jeter" data-id="${d.id}">Jeté</button>`
      : action === 'renouveler' ? `<button class="btn petit primaire" data-action="renouvele" data-id="${d.id}">Renouvelé</button>` : '';
    return `<li class="ligne-doc ${d.jete ? 'jete' : ''}">
      <button class="ld-corps" data-action="doc" data-id="${d.id}">
        <span class="ld-titre"><b>${surligner(d.titre, q)}</b>${qui}${d.essentiel ? '<span class="essentiel" title="Essentiel en cas d\'urgence">Essentiel</span>' : ''}</span>
        <span class="ld-ou">${ou(d, q)}</span>
        ${compacte ? '' : `<span class="ld-etiquettes">${pillCat(d.cat)}${etiquetteConservation(d, t)}${etiquetteRenouvellement(d, t)}</span>`}
      </button>
      ${bouton}
    </li>`;
  }

  const formeRecherche = (id, valeur = '') => `<form class="cherche-doc" ${id === 'cherche-tableau' ? 'id="form-cherche"' : 'onsubmit="return false"'} role="search"><label class="champ"><span class="sr-only">Où est…</span><input id="${id}" type="search" placeholder="Où est… le passeport de Léa ? la taxe foncière ?" value="${esc(valeur)}" autocomplete="off"></label>${id === 'cherche-tableau' ? `<button class="btn primaire" type="submit">${ICONES.loupe}<span>Chercher</span></button>` : ''}</form>`;

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const b = R.bilan(E.documents, typeDoc, t);
    const ech = R.echeances(E.documents, t);
    const tri = R.aTrier(E.documents, typeDoc, t, { bientot: true });
    const tuiles = [
      ['Documents', b.total, b.sansLieu ? `${b.sansLieu} pas encore rangé${b.sansLieu > 1 ? 's' : ''}` : `dans ${pluriel(E.lieux.length, 'emplacement')}`, 'var(--bleu)', '', 'documents', ''],
      ['À renouveler', b.expire + b.arenouveler, b.expire ? `dont ${b.expire} dépassée${b.expire > 1 ? 's' : ''}` : b.arenouveler ? 'échéance proche' : `${pluriel(b.aEcheance, 'échéance')} suivie${b.aEcheance > 1 ? 's' : ''}`, 'var(--rouge)', 'rond', 'echeances', 'renouveler'],
      ['Peut être jeté', b.jeter, b.bientot ? `et ${b.bientot} dans les 90 jours` : 'durée de conservation passée', 'var(--jaune)', '', 'echeances', 'jeter'],
      ['Essentiels', b.essentiels, 'fiche « en cas d\'urgence »', 'var(--encre)', 'rond', 'urgence', ''],
    ].map(([lib, v, d, c, f, cible, st]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}" ${st ? `data-statut="${st}"` : ''}><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></button>`).join('');
    const vide = !E.documents.length;
    return `
      <div class="vue-tete"><div><h1>${esc(E.foyer || 'Papiers du foyer')}</h1><p>Où est chaque document, ce qui expire bientôt et ce que tu peux jeter. Tape un mot pour retrouver un papier.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-doc">${ICONES.plus}Document</button></div></div>
      ${formeRecherche('cherche-tableau')}
      <div class="tuiles">${tuiles}</div>
      ${b.adater ? `<div class="alerte-doc"><div><b>${pluriel(b.adater, 'document')} sans date</b><span>Leur durée de conservation part de la date du document : saisis-la pour savoir jusqu'à quand les garder.</span></div><button class="btn petit" data-action="vue" data-vue="echeances">Compléter</button></div>` : ''}
      ${vide ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun document pour l'instant</h3><p>Commence par les papiers que tu cherches le plus souvent : pièces d'identité, livret de famille, bail ou titre de propriété, avis d'impôt.</p><div class="actions"><button class="btn primaire" data-action="nouveau-doc">${ICONES.plus}Premier document</button></div></div></div>` : `
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À renouveler <span>${ech.length ? 'échéances dépassées ou proches' : ''}</span></h2>
          ${ech.length ? `<ul class="liste-docs">${ech.slice(0, 5).map(({ doc }) => ligneDoc(doc, { compacte: false })).join('')}</ul>${ech.length > 5 ? `<button class="btn lien" data-action="vue" data-vue="echeances">Voir les ${ech.length} échéances</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien à renouveler</h3><p>Aucune échéance dépassée ni proche. Note la fin de validité de tes pièces pour être prévenu à temps.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">À trier <span>${tri.length ? 'peut être jeté, ou bientôt' : ''}</span></h2>
          ${tri.length ? `<ul class="liste-docs">${tri.slice(0, 5).map(({ doc, statut }) => ligneDoc(doc, { action: statut === 'jeter' ? 'jeter' : '' })).join('')}</ul>${tri.length > 5 ? `<button class="btn lien" data-action="vue" data-vue="echeances">Voir les ${tri.length} documents</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien à jeter</h3><p>Aucun document n\'a dépassé sa durée de conservation.</p></div></div>'}
        </section>
      </div>
      <h2 class="titre-section">Rangements <span>${pluriel(E.lieux.length, 'emplacement')}</span></h2>
      <ul class="resume-lieux">${R.parLieu(E.documents, E.lieux).map((g) => `<li><button class="lien-ligne" data-action="voir-lieu" data-lieu="${g.lieu?.id || ''}"><b>${g.lieu ? pastille(g.lieu.id) : pastille(null)}${esc(g.lieu?.nom || 'Pas encore rangé')}</b><span>${pluriel(g.docs.length, 'document')}${g.lieu?.note ? ` · ${esc(g.lieu.note)}` : ''}</span></button></li>`).join('')}</ul>`}
      ${AVERTISSEMENT()}`;
  }

  // ---------- Documents ----------
  const STATUTS_FILTRE = [['tous', 'Tous'], ['jeter', 'Peut être jeté'], ['renouveler', 'À renouveler'], ['essentiels', 'Essentiels'], ['adater', 'Sans date'], ['jetes', 'Jetés']];
  function garderStatut(d, t) {
    const s = R.statutConservation(d, typeDoc(d), t);
    switch (filtre.statut) {
      case 'jetes': return s === 'jete';
      case 'jeter': return s === 'jeter';
      case 'renouveler': return !d.jete && ['expire', 'arenouveler'].includes(R.renouvellement(d, t)?.statut);
      case 'essentiels': return !d.jete && d.essentiel;
      case 'adater': return s === 'adater';
      default: return !d.jete;
    }
  }
  function vueDocuments() {
    const t = auj();
    const q = filtre.q.trim();
    const tete = `<div class="vue-tete"><div><h1>Documents</h1><p>Chaque papier, à qui il est, où il est rangé, et jusqu'à quand le garder. Touche un document pour le compléter.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-doc">${ICONES.plus}Document</button>${E.documents.length ? '<button class="btn" data-action="imprimer-inventaire">Imprimer l\'inventaire</button>' : ''}</div></div>`;
    if (!E.documents.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun document</h3><p>Ajoute un document type (la durée de conservation est reprise de service-public.gouv.fr) ou un document libre.</p><div class="actions"><button class="btn primaire" data-action="nouveau-doc">${ICONES.plus}Premier document</button></div></div></div>`;
    const dePersonne = (d) => filtre.personne === 'tous' || (filtre.personne === 'foyer' ? !personne(d.personne) : d.personne === filtre.personne);
    const base = R.rechercher(E.documents, q, ctxRecherche(), { jetes: true }).filter(dePersonne);
    const sansCat = base.filter((d) => garderStatut(d, t));
    const liste = sansCat.filter((d) => filtre.cat === 'toutes' || d.cat === filtre.cat);
    const nbCat = (c) => sansCat.filter((d) => c === 'toutes' || d.cat === c).length;
    const nbStatut = (s) => { const avant = filtre.statut; filtre.statut = s; const n = base.filter((d) => garderStatut(d, t)).length; filtre.statut = avant; return n; };
    const resultats = q
      ? `<h2 class="titre-section">${liste.length ? pluriel(liste.length, 'document trouvé', 'documents trouvés') : 'Aucun document trouvé'} <span>« ${esc(q)} »</span></h2>${liste.length ? `<ul class="liste-docs">${liste.map((d) => ligneDoc(d, { q })).join('')}</ul>` : '<p class="aide">Essaie un autre mot (les accents et le pluriel ne comptent pas), un prénom, un emplacement ou une catégorie.</p>'}`
      : R.parCategorie(liste, B.categories).map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(g.cat.long)}<span>${pluriel(g.docs.length, 'document')}</span></h2><ul class="liste-docs">${g.docs.map((d) => ligneDoc(d, { action: filtre.statut === 'jeter' ? 'jeter' : filtre.statut === 'renouveler' ? 'renouveler' : '' })).join('')}</ul></section>`).join('') || `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun document ne correspond</h3><p>Change de catégorie, de statut ou de personne.</p></div></div>`;
    return `${tete}
      ${formeRecherche('recherche', filtre.q)}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${STATUTS_FILTRE.map(([id, lib]) => `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${esc(lib)} <small>${nbStatut(id)}</small></button>`).join('')}</div>
        ${E.personnes.length ? `<label class="champ champ-personne"><span class="sr-only">Personne</span><select data-action="filtre-personne">${[['tous', 'Toutes les personnes'], ['foyer', 'Tout le foyer'], ...E.personnes.map((p) => [p.id, p.nom])].map(([id, lib]) => `<option value="${esc(id)}" ${filtre.personne === id ? 'selected' : ''}>${esc(lib)}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="filtres filtres-cat" role="group" aria-label="Filtrer par catégorie">${[['toutes', 'Toutes'], ...B.categories.map((c) => [c.id, c.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-cat" data-cat="${id}" aria-pressed="${filtre.cat === id}">${esc(lib)} <small>${nbCat(id)}</small></button>`).join('')}</div>
      ${resultats}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>
      ${AVERTISSEMENT()}`;
  }

  // ---------- Rangements ----------
  function vueRangements() {
    const groupes = R.parLieu(E.documents, E.lieux);
    return `
      <div class="vue-tete"><div><h1>Rangements</h1><p>Tes classeurs, boîtes, tiroirs et dossiers numériques, avec ce que chacun contient. Un nom que toute la famille comprend, et où le trouver.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-lieu">${ICONES.plus}Emplacement</button>${E.documents.length ? '<button class="btn" data-action="imprimer-inventaire">Imprimer l\'inventaire</button>' : ''}</div></div>
      ${groupes.length ? `<div class="cartes-lieux">${groupes.map((g) => `
        <section class="carte-lieu" ${g.lieu ? `style="--p:${esc(g.lieu.couleur)}"` : ''}>
          <div class="cl-tete">
            <span class="pastille-lieu grande" style="--p:${esc(g.lieu?.couleur || '#B8B0A2')}" aria-hidden="true"></span>
            <div><h2>${esc(g.lieu?.nom || 'Pas encore rangé')}</h2><p>${g.lieu ? `${esc(nomTypeLieu(g.lieu.type))}${g.lieu.note ? ` · ${esc(g.lieu.note)}` : ''}` : 'Documents sans emplacement : range-les, puis note où.'}</p></div>
            ${g.lieu ? `<button class="btn petit" data-action="lieu" data-id="${g.lieu.id}">Modifier</button>` : ''}
          </div>
          ${g.docs.length ? `<ul class="liste-docs compacte">${g.docs.map((d) => `<li><button class="lien-ligne" data-action="doc" data-id="${d.id}"><b>${esc(d.titre)}${personne(d.personne) ? ` · ${esc(nomPersonne(d.personne))}` : ''}</b><span>${d.precision ? esc(d.precision) : esc(nomCat(d.cat))}</span></button></li>`).join('')}</ul>` : '<p class="aide">Vide pour l\'instant.</p>'}
          ${g.lieu ? `<div class="rang"><button class="btn petit" data-action="nouveau-doc" data-lieu="${g.lieu.id}">${ICONES.plus}Document ici</button></div>` : ''}
        </section>`).join('')}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun emplacement</h3><p>Classeur, boîte à archives, tiroir, dossier du cloud, coffre ou chez le notaire : crée l'endroit, puis range-y tes documents.</p><div class="actions"><button class="btn primaire" data-action="nouveau-lieu">${ICONES.plus}Premier emplacement</button></div></div></div>`}
      <p class="mention" style="margin-top:16px">Pour un dossier numérique, note son nom et son chemin, jamais l'identifiant ni le mot de passe du compte.</p>`;
  }

  // ---------- Échéances et tri ----------
  function vueEcheances() {
    const t = auj();
    const toutes = R.echeances(E.documents, t, { toutes: true });
    const ech = filtre.echeances ? toutes : toutes.filter((x) => x.r.statut !== 'ok');
    const jeter = R.aTrier(E.documents, typeDoc, t);
    const bientot = R.aTrier(E.documents, typeDoc, t, { bientot: true }).filter((x) => x.statut === 'bientot');
    const adater = E.documents.filter((d) => R.statutConservation(d, typeDoc(d), t) === 'adater');
    const attente = E.documents.filter((d) => !d.jete && R.garderJusqua(d, typeDoc(d)).raison === 'fin');
    return `
      <div class="vue-tete"><div><h1>Échéances</h1><p>Les pièces à renouveler, selon les dates que tu as saisies, et les documents dont la durée de conservation est passée. Rien n'est jeté sans toi.</p></div>
        <div class="actions"><button class="btn" data-action="imprimer-tri">Imprimer la liste à trier</button></div></div>
      <h2 class="titre-section">Renouvellements <span>${toutes.length ? `${pluriel(toutes.length, 'échéance')} suivie${toutes.length > 1 ? 's' : ''}` : ''}</span></h2>
      <p class="aide">Rappel par défaut ${R.RAPPEL_DEFAUT} mois avant l'échéance, réglable par document. Les délais d'obtention d'une carte d'identité ou d'un passeport varient selon la période et la commune : vérifie-les sur service-public.gouv.fr avant de prendre rendez-vous.</p>
      ${toutes.length ? `<label class="case bascule"><input type="checkbox" data-action="toutes-echeances" ${filtre.echeances ? 'checked' : ''}> Afficher aussi les échéances lointaines</label>` : ''}
      ${ech.length ? `<ul class="liste-docs">${ech.map(({ doc, r }) => ligneDoc(doc, { action: r.statut === 'ok' ? '' : 'renouveler' })).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>${toutes.length ? 'Rien à renouveler pour l\'instant' : 'Aucune échéance saisie'}</h3><p>${toutes.length ? 'Tes échéances sont lointaines : coche la case pour les voir.' : 'Ouvre une carte d\'identité, un passeport ou un contrat et note sa date de fin de validité ou d\'échéance.'}</p></div></div>`}
      <h2 class="titre-section">Peut être jeté <span>${jeter.length ? pluriel(jeter.length, 'document') : ''}</span></h2>
      ${jeter.length ? `<ul class="liste-docs">${jeter.map(({ doc }) => ligneDoc(doc, { action: 'jeter' })).join('')}</ul><p class="mention" style="margin-top:8px">Déchire ou passe au broyeur ce qui porte ton nom, ton adresse ou un numéro de compte. « Jeté » garde une trace ici (filtre « Jetés » des documents).</p>` : '<div class="vide-etat petit"><div><h3>Rien à jeter</h3><p>Aucun document n\'a dépassé sa durée de conservation.</p></div></div>'}
      ${bientot.length ? `<h2 class="titre-section">Jetable dans les ${R.HORIZON_JETER} jours <span>${pluriel(bientot.length, 'document')}</span></h2><ul class="liste-docs">${bientot.map(({ doc }) => ligneDoc(doc)).join('')}</ul>` : ''}
      ${adater.length ? `<h2 class="titre-section">Date à saisir <span>${pluriel(adater.length, 'document')}</span></h2><p class="aide">La durée de conservation part de la date du document (facture, avis, relevé) : sans elle, impossible de savoir quand le jeter.</p><ul class="liste-docs">${adater.map((d) => ligneDoc(d)).join('')}</ul>` : ''}
      ${attente.length ? `<h2 class="titre-section">En attente d'un événement <span>${pluriel(attente.length, 'document')}</span></h2><p class="aide">Leur durée part d'un événement (fin de la location, clôture du compte, fin du contrat, retraite…) : saisis sa date quand il arrive.</p><ul class="liste-docs">${attente.map((d) => ligneDoc(d)).join('')}</ul>` : ''}
      ${AVERTISSEMENT()}`;
  }

  // ---------- En cas d'urgence ----------
  function vueUrgence() {
    const groupes = R.urgence(E.documents, E.personnes, B.categories);
    const presents = new Set(E.documents.filter((d) => !d.jete).map((d) => d.type));
    const manquants = B.documents.filter((t) => t.e && !presents.has(t.id));
    return `
      <div class="vue-tete"><div><h1>En cas d'urgence</h1><p>La fiche à laisser à un proche : les documents essentiels et où ils sont. Hospitalisation, décès, sinistre : il sait où chercher, sans connaître le contenu.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer-urgence">Imprimer la fiche</button></div></div>
      <form class="carte-message" id="form-urgence" onsubmit="return false">
        <label class="champ">Mot pour ton proche<small>Où sont les clés du classeur, qui prévenir, ce qui est chez le notaire. Jamais de mot de passe ni de code.</small><textarea name="message" rows="4" maxlength="600">${esc(E.urgence.message)}</textarea></label>
        <label class="champ">Personne ou organisme à contacter<small>Facultatif : notaire, conseiller, proche de confiance.</small><input name="contact" maxlength="160" value="${esc(E.urgence.contact)}"></label>
        <p class="erreur" role="alert"></p>
        <div class="rang"><button class="btn petit" data-action="enregistrer-urgence">Enregistrer le mot</button></div>
      </form>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-urgence"><h2 class="titre-cat">${esc(g.personne?.nom || 'Tout le foyer')}<span>${pluriel(g.docs.length, 'document')}</span></h2>
        <ul class="liste-urgence">${g.docs.map((d) => `<li><button class="lien-ligne" data-action="doc" data-id="${d.id}"><b>${esc(d.titre)}</b><span>${ou(d)}</span></button>${pillCat(d.cat)}</li>`).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun document essentiel</h3><p>Coche « Essentiel en cas d'urgence » sur les documents à retrouver vite : pièces d'identité, livret de famille, carte Vitale, contrats d'assurance.</p></div></div>`}
      ${manquants.length ? `<h2 class="titre-section">Essentiels pas encore notés <span>${pluriel(manquants.length, 'document type')}</span></h2>
        <ul class="suggestions">${manquants.map((t) => `<li><span><b>${esc(t.nom)}</b><small>${esc(nomCat(t.cat))}</small></span><button class="btn petit" data-action="nouveau-doc" data-type="${t.id}">${ICONES.plus}Ajouter</button></li>`).join('')}</ul>` : ''}
      <p class="mention" style="margin-top:16px">La fiche n'indique que le nom des documents et leur emplacement : aucun numéro, aucune copie. Range-la avec tes papiers ou confie-la à la personne choisie.</p>`;
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const optionsTypes = (v) => `<option value="">Autre document (durée à choisir)</option>${B.categories.map((c) => `<optgroup label="${esc(c.long)}">${B.documents.filter((t) => t.cat === c.id).map((t) => `<option value="${t.id}" ${t.id === v ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</optgroup>`).join('')}`;
  const optionsLieux = (v) => `${E.lieux.map((l) => `<option value="${l.id}" ${l.id === v ? 'selected' : ''}>${esc(l.nom)}</option>`).join('')}<option value="" ${!lieu(v) ? 'selected' : ''}>Pas encore rangé</option>`;
  const optionsPersonnes = (v) => `<option value="">Tout le foyer</option>${E.personnes.map((p) => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}`;
  const RAPPELS = [0, 1, 2, 3, 4, 6, 9, 12];

  // Lecture du formulaire de document (brouillon tolérant, avant validation).
  const lireDoc = (racine) => {
    const v = (n) => racine.querySelector(`[name=${n}]`)?.value ?? '';
    const typeId = v('type');
    const t = typeId ? R.typeDe(B, typeId) : null;
    return {
      type: typeId || null, cat: t ? t.cat : v('cat'), titre: v('titre').trim(), personne: v('personne') || null, lieu: v('lieu') || null,
      precision: v('precision').trim(), date: v('date') || null, fin: v('fin') || null,
      conservation: racine.querySelector('[name=conservation]:checked')?.value || 'base', garder: v('garder') || null,
      echeance: v('echeance') || null, rappel: Number(v('rappel') || R.RAPPEL_DEFAUT), essentiel: Boolean(racine.querySelector('[name=essentiel]')?.checked), note: v('note').trim(),
    };
  };

  function apercuConservation(brouillon) {
    const d = R.normaliserDoc(brouillon, B);
    const t = typeDoc(d);
    const g = R.garderJusqua(d, t);
    if (g.mode === 'toujours') return 'À garder toujours.';
    if (g.mode === 'adater') return 'Saisis la date du document pour calculer jusqu\'à quand le garder.';
    if (g.mode === 'attente') {
      if (g.raison === 'valide') return 'À garder tant que la pièce est valable : aucune date pour la jeter.';
      if (g.raison !== 'fin') return 'Choisis une date ou « garder toujours ».';
      const duree = t.r.a || t.r.m || t.r.j ? R.libelleRegle(t).replace(/ après .*$/, '') : '';
      return `À garder jusqu'à ${g.evenement}${duree ? `, puis ${duree}` : ''} : saisis sa date quand elle arrive.`;
    }
    const jetable = ajout(g.date, 1);
    return `À garder jusqu'au ${dateLongue(g.date)}${jetable <= auj() ? ' : peut être jeté.' : `, jetable le ${dateLongue(jetable)}.`}`;
  }

  function modaleDoc(did, brouillon = null) {
    const existant = did ? E.documents.find((x) => x.id === did) : null;
    if (did && !existant) return;
    const v = brouillon || existant || R.normaliserDoc({ type: null, cat: filtre.cat !== 'toutes' ? filtre.cat : 'identite', titre: '', lieu: E.lieux[0]?.id || null }, B);
    const t = v.type ? R.typeDe(B, v.type) : null;
    const r = t?.r || {};
    const titreAffiche = !existant && !t && v.titre === 'Document' ? '' : v.titre;
    const finLib = r.fin ? `Date de ${r.fin}` : '';
    const corps = `
      <label class="champ">Type de document<small>Il fixe la catégorie et la durée de conservation.</small><select name="type" data-role="type">${optionsTypes(v.type)}</select></label>
      ${t ? `<p class="regle-doc"><b>${esc(R.libelleRegle(t))}</b><span>${t.src ? `Selon service-public.gouv.fr : ${esc(t.src)}.` : 'Pas de durée dans la fiche de service-public.gouv.fr.'}${t.aide ? ` ${esc(t.aide)}` : ''}</span></p>` : ''}
      <div class="rang-champs">
        <label class="champ">Nom<small>Tel que tu le cherches : « Passeport de Léa », « Factures EDF ».</small><input name="titre" required maxlength="120" value="${esc(titreAffiche)}" placeholder="${esc(t?.nom || 'Ex. : Notices et garanties')}"></label>
        ${t ? `<input type="hidden" name="cat" value="${esc(t.cat)}">` : `<label class="champ">Catégorie<select name="cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.cat ? 'selected' : ''}>${esc(c.long)}</option>`).join('')}</select></label>`}
      </div>
      <div class="rang-champs">
        <label class="champ">Emplacement<select name="lieu">${optionsLieux(v.lieu)}</select></label>
        <label class="champ">À qui<select name="personne">${optionsPersonnes(v.personne)}</select></label>
      </div>
      <label class="champ">Précision<small>Onglet, pochette, nom du sous-dossier. Pas de numéro du document.</small><input name="precision" maxlength="80" value="${esc(v.precision)}" placeholder="Ex. : Onglet Banque, pochette verte"></label>
      <div class="rang-champs">
        <label class="champ">Date du document${t?.r?.dec ? '<small>Date de mise en recouvrement (sur l\'avis).</small>' : '<small>Facture, avis, relevé, signature.</small>'}<input type="date" name="date" value="${v.date || ''}"></label>
        ${r.fin ? `<label class="champ">${esc(finLib.charAt(0).toUpperCase() + finLib.slice(1))}<small>Vide tant que ce n'est pas arrivé.</small><input type="date" name="fin" value="${v.fin || ''}"></label>` : ''}
      </div>
      <fieldset class="champ"><legend>Conservation</legend><div class="choix-statut">${[['base', t && !r.aucune ? 'Durée indiquée' : 'À décider'], ['date', 'Je choisis la date'], ['toujours', 'Garder toujours']].map(([s, l]) => `<label><input type="radio" name="conservation" value="${s}" ${v.conservation === s ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-garder" ${v.conservation === 'date' ? '' : 'hidden'}>Garder jusqu'au<input type="date" name="garder" value="${v.garder || ''}"></label>
      <p class="aide" id="apercu-garde">${esc(apercuConservation(v))}</p>
      <div class="rang-champs">
        <label class="champ">${esc(t?.ech || 'Échéance de renouvellement')}<small>${t?.ech ? 'Lis-la sur le document.' : 'Facultative : fin de validité, échéance du contrat.'}</small><input type="date" name="echeance" value="${v.echeance || ''}"></label>
        <label class="champ">Me prévenir<select name="rappel">${RAPPELS.map((m) => `<option value="${m}" ${m === (v.rappel ?? R.RAPPEL_DEFAUT) ? 'selected' : ''}>${m === 0 ? 'le jour même' : `${m} mois avant`}</option>`).join('')}</select></label>
      </div>
      <label class="case"><input type="checkbox" name="essentiel" ${v.essentiel ? 'checked' : ''}> Essentiel en cas d'urgence (sur la fiche pour un proche)</label>
      <label class="champ">Note<small>Facultative. Jamais de numéro complet, d'IBAN ni de mot de passe.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = existant
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${existant.jete ? '<button class="btn" value="restaurer">Pas jeté</button>' : '<button class="btn" value="jeter">Jeté</button>'}<button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(existant ? esc(existant.titre) : 'Nouveau document', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        retenir(); E.documents = E.documents.filter((x) => x.id !== existant.id);
        sauver(); rendre(); toast(`« ${existant.titre} » supprimé de l'inventaire.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      if (action === 'jeter' || action === 'restaurer') { marquerJete(existant.id, action === 'jeter'); return; }
      const b = lireDoc(modale());
      if (!b.titre) b.titre = t?.nom || '';
      if (!b.titre) return 'Donne un nom au document.';
      const sensible = [b.titre, b.precision, b.note].map(R.contientNumeroSensible).find(Boolean);
      if (sensible) return R.MESSAGES_SENSIBLES[sensible];
      if (b.conservation === 'date' && !b.garder) return 'Choisis la date jusqu\'à laquelle garder ce document.';
      if (b.fin && b.date && b.fin < b.date) return 'La date de fin est avant la date du document.';
      retenir();
      const donnees = R.normaliserDoc({ ...b, id: existant?.id || uid(), jete: existant?.jete || null }, B);
      if (existant) Object.assign(existant, donnees); else E.documents.push(donnees);
      sauver(); rendre();
      if (action === 'encore') {
        toast(`« ${donnees.titre} » ajouté.`, { libelle: 'Annuler', faire: annuler });
        modale().dataset.garder = '1';
        setTimeout(() => modaleDoc(null, R.normaliserDoc({ cat: donnees.cat, lieu: donnees.lieu, personne: donnees.personne, titre: '' }, B)), 0);
        return;
      }
      toast(existant ? 'Document enregistré.' : `« ${donnees.titre} » ajouté : ${nomLieu(donnees.lieu).toLowerCase() === 'pas encore rangé' ? 'pas encore rangé' : `rangé dans ${nomLieu(donnees.lieu)}`}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.dataset.doc = existant?.id || '';
    const majApercu = () => { const b = lireDoc(d); d.querySelector('#champ-garder').hidden = b.conservation !== 'date'; d.querySelector('#apercu-garde').textContent = apercuConservation(b); };
    d.querySelector('[data-role=type]').addEventListener('change', () => {
      const b = lireDoc(d);
      const ancien = v.type ? R.typeDe(B, v.type)?.nom : '';
      const nouveau = b.type ? R.typeDe(B, b.type) : null;
      if (!b.titre || b.titre === ancien || b.titre === 'Document') b.titre = nouveau?.nom || '';
      if (nouveau && !existant) b.essentiel = nouveau.e;
      modaleDoc(existant?.id || null, R.normaliserDoc({ ...b, id: existant?.id, jete: existant?.jete }, B));
    });
    d.querySelectorAll('input,select').forEach((x) => { if (x.name !== 'type') x.addEventListener('input', majApercu); if (x.type === 'radio') x.addEventListener('change', majApercu); });
  }

  function marquerJete(id, jete) {
    const d = E.documents.find((x) => x.id === id);
    if (!d) return;
    retenir();
    d.jete = jete ? auj() : null;
    sauver(); rendre();
    toast(jete ? `« ${d.titre} » noté comme jeté.` : `« ${d.titre} » remis dans l'inventaire.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleRenouvele(id) {
    const d = E.documents.find((x) => x.id === id);
    if (!d) return;
    const lib = typeDoc(d)?.ech || 'Nouvelle échéance';
    ouvrirModale(`${esc(d.titre)} renouvelé`, `
      <p>Note la nouvelle date indiquée sur le document : le rappel repart de là.${typeDoc(d)?.r?.valide ? ' L\'ancienne pièce n\'est pas gardée en double dans l\'inventaire.' : ''}</p>
      <label class="champ">${esc(lib)}<input type="date" name="echeance" required value=""></label>
      <label class="champ">Date du nouveau document<small>Facultative.</small><input type="date" name="date" value="${auj()}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const ech = f.get('echeance');
      if (!R.estDate(ech)) return 'Indique la nouvelle date.';
      if (ech <= auj()) return 'La nouvelle échéance doit être dans le futur.';
      retenir();
      d.echeance = ech;
      if (R.estDate(f.get('date'))) d.date = f.get('date');
      sauver(); rendre();
      toast(`« ${d.titre} » : prochaine échéance le ${dateLongue(ech)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleLieu(lid) {
    const l = lid ? E.lieux.find((x) => x.id === lid) : null;
    if (lid && !l) return;
    const v = l || { nom: '', type: 'classeur', couleur: B.couleurs[E.lieux.length % B.couleurs.length], note: '' };
    const nb = l ? E.documents.filter((d) => d.lieu === l.id && !d.jete).length : 0;
    ouvrirModale(l ? esc(l.nom) : 'Nouvel emplacement', `
      <label class="champ">Nom<small>Ce que la famille comprend : « Classeur bleu », « Boîte à archives », « Dossier Papiers du cloud ».</small><input name="nom" required maxlength="50" value="${esc(v.nom)}"></label>
      <div class="rang-champs">
        <label class="champ">C'est…<select name="type">${B.typesLieu.map((t) => `<option value="${t.id}" ${t.id === v.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${c}" ${c === v.couleur ? 'checked' : ''} aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      </div>
      <label class="champ">Où le trouver<small>Facultatif : « Bureau, étagère de gauche », « Sous-dossiers par année ». Jamais d'identifiant ni de mot de passe.</small><input name="note" maxlength="120" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${l ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${l ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        if (nb && !confirm(`${pluriel(nb, 'document')} y ${nb > 1 ? 'sont rangés' : 'est rangé'} : ${nb > 1 ? 'ils passeront' : 'il passera'} « Pas encore rangé ». Supprimer l'emplacement ?`)) return 'Emplacement gardé.';
        retenir();
        E.lieux = E.lieux.filter((x) => x.id !== l.id);
        E.documents.forEach((d) => { if (d.lieu === l.id) d.lieu = null; });
        sauver(); rendre(); toast(`« ${l.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'emplacement.';
      const sensible = [nom, f.get('note')].map(R.contientNumeroSensible).find(Boolean);
      if (sensible) return R.MESSAGES_SENSIBLES[sensible];
      retenir();
      const donnees = R.normaliserLieu({ id: l?.id || uid(), nom, type: f.get('type'), couleur: f.get('couleur') || v.couleur, note: f.get('note') }, E.lieux.length, B.couleurs);
      if (l) Object.assign(l, donnees); else E.lieux.push(donnees);
      sauver(); rendre(); toast(l ? 'Emplacement enregistré.' : `« ${nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function enregistrerUrgence() {
    const f = $('#form-urgence');
    const message = f.querySelector('[name=message]').value.trim();
    const contact = f.querySelector('[name=contact]').value.trim();
    const sensible = R.contientNumeroSensible(message);
    if (sensible) { f.querySelector('.erreur').textContent = R.MESSAGES_SENSIBLES[sensible]; return; }
    f.querySelector('.erreur').textContent = '';
    retenir();
    E.urgence = { message: message.slice(0, 600), contact: contact.slice(0, 160) };
    sauver(); toast('Mot pour ton proche enregistré.', { libelle: 'Annuler', faire: annuler });
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
  const conservationTexte = (d) => {
    const g = R.garderJusqua(d, typeDoc(d));
    return g.mode === 'date' ? dateCourte(g.date) : g.mode === 'toujours' ? 'Toujours' : g.mode === 'adater' ? 'Date à saisir' : g.raison === 'fin' ? `Après ${g.evenement}` : g.raison === 'valide' ? 'Tant que valable' : 'À choisir';
  };

  function imprimerInventaire() {
    const t = auj();
    const groupes = R.parLieu(E.documents, E.lieux).filter((g) => g.docs.length);
    imprimer(`
      <header><p>${esc(E.foyer || 'Papiers du foyer')} · inventaire au ${dateLongue(t)}</p><h1>Où sont nos papiers</h1><p>${pluriel(E.documents.filter((d) => !d.jete).length, 'document')} dans ${pluriel(E.lieux.length, 'emplacement')}</p></header>
      ${groupes.map((g) => `<h2><i class="pastille-lieu" style="--p:${esc(g.lieu?.couleur || '#6E685F')}"></i>${esc(g.lieu?.nom || 'Pas encore rangé')}${g.lieu?.note ? ` · <small>${esc(g.lieu.note)}</small>` : ''}</h2><table><thead><tr><th>Document</th><th>À qui</th><th>Précision</th><th>Garder jusqu'au</th><th>Échéance</th></tr></thead><tbody>${g.docs.map((d) => `<tr class="${R.statutConservation(d, typeDoc(d), t) === 'jeter' ? 'retard' : ''}"><td><b>${esc(d.titre)}</b>${d.essentiel ? ' ★' : ''}</td><td>${esc(personne(d.personne) ? nomPersonne(d.personne) : '')}</td><td>${esc(d.precision)}</td><td>${esc(conservationTexte(d))}</td><td>${d.echeance ? dateCourte(d.echeance) : ''}</td></tr>`).join('')}</tbody></table>`).join('')}
      <p class="mention">★ essentiel en cas d'urgence. Durées de conservation : ${esc(SOURCE_COURTE)} ; durées minimales indicatives, pas un conseil juridique.</p>`, 'impr-liste');
  }

  function imprimerTri() {
    const t = auj();
    const liste = R.aTrier(E.documents, typeDoc, t, { bientot: true });
    imprimer(`
      <header><p>${esc(E.foyer || 'Papiers du foyer')} · liste au ${dateLongue(t)}</p><h1>Papiers à trier</h1><p>${pluriel(liste.length, 'document')} dont la durée de conservation est passée ou se termine dans les ${R.HORIZON_JETER} jours</p></header>
      <table><thead><tr><th>Document</th><th>Où</th><th>Gardé jusqu'au</th><th>Jeté</th></tr></thead><tbody>${liste.map(({ doc: d, g }) => `<tr><td><b>${esc(d.titre)}</b></td><td>${esc(nomLieu(d.lieu))}${d.precision ? ` · ${esc(d.precision)}` : ''}</td><td>${dateCourte(g.date)}</td><td>☐</td></tr>`).join('')}</tbody></table>
      <p class="mention">Déchire ou passe au broyeur ce qui porte des données personnelles. ${esc(B.avertissement)}</p>`, 'impr-liste');
  }

  function imprimerUrgence() {
    const groupes = R.urgence(E.documents, E.personnes, B.categories);
    imprimer(`
      <header><p>${esc(E.foyer || 'Papiers du foyer')} · fiche au ${dateLongue(auj())}</p><h1>En cas d'urgence : où sont nos papiers</h1></header>
      ${E.urgence.message ? `<p class="message-urgence">${esc(E.urgence.message)}</p>` : ''}
      ${E.urgence.contact ? `<p><b>À contacter :</b> ${esc(E.urgence.contact)}</p>` : ''}
      ${groupes.map((g) => `<h2>${esc(g.personne?.nom || 'Tout le foyer')}</h2><table><thead><tr><th>Document</th><th>Où</th><th>Précision</th></tr></thead><tbody>${g.docs.map((d) => `<tr><td><b>${esc(d.titre)}</b></td><td>${esc(nomLieu(d.lieu))}</td><td>${esc(d.precision)}</td></tr>`).join('')}</tbody></table>`).join('')}
      <h2>Les emplacements</h2><table><thead><tr><th>Emplacement</th><th>Où le trouver</th></tr></thead><tbody>${E.lieux.map((l) => `<tr><td><b>${esc(l.nom)}</b></td><td>${esc(l.note || nomTypeLieu(l.type))}</td></tr>`).join('')}</tbody></table>
      <p class="mention">Cette fiche indique où sont les documents, pas leur contenu : aucun numéro, aucune copie.</p>`, 'impr-liste');
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const s = B.source;
    const corps = `
      <label class="champ">Nom du foyer<input name="foyer" maxlength="60" value="${esc(E.foyer)}" placeholder="Ex. : Famille Martin"></label>
      <fieldset class="champ cadre-champs"><legend>Les personnes du foyer <small>Prénoms seulement. Retirer une personne passe ses documents à « Tout le foyer ».</small></legend>
        <ul class="liste-personnes">${E.personnes.map((p, i) => `<li><label class="champ"><span class="sr-only">Prénom ${i + 1}</span><input name="nom-${p.id}" maxlength="40" value="${esc(p.nom)}"></label><button type="button" class="btn-icone petit" data-action="retirer-personne" data-personne="${p.id}" aria-label="Retirer : ${esc(p.nom)}">×</button></li>`).join('')}</ul>
        <label class="champ">Ajouter une personne<input name="nouvelle" maxlength="40" placeholder="Prénom"></label>
      </fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique : exporte l'inventaire en tableur, ou imprime-le depuis les onglets Documents, Échéances et Urgence.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Inventaire en CSV</button><button class="btn petit" type="button" data-action="imprimer-inventaire">Imprimer l'inventaire</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes des papiers du foyer, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application : pratique pour retrouver un papier depuis n'importe où.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Sources et à propos</h3><p class="mention">Durées de conservation : fiche « ${esc(s.titre)} » de ${esc(s.editeur)} (${esc(s.reference)}), vérifiée par l'administration le ${esc(s.verifiePar)}, consultée par QME le ${dateLongue(s.consulte)} : <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace('https://', ''))}</a>. Durées minimales indicatives, pas un conseil juridique ; une procédure en cours peut imposer de garder un document plus longtemps. Chaque durée est modifiable document par document. Les pièces d'identité, permis et titres de séjour n'ont pas de durée dans cette fiche : l'application suit leur validité, que tu saisis. Base intégrée version ${B.version} : ${B.documents.length} documents types en ${B.categories.length} catégories. Aucune pièce d'identité ni aucun numéro n'est stocké : seulement le nom du document et son emplacement.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const retirees = new Set(String(modale().dataset.retirees || '').split(',').filter(Boolean));
      const noms = [f.get('foyer'), f.get('nouvelle'), ...E.personnes.map((p) => f.get(`nom-${p.id}`))];
      const sensible = noms.map(R.contientNumeroSensible).find(Boolean);
      if (sensible) return R.MESSAGES_SENSIBLES[sensible];
      retenir();
      E.foyer = String(f.get('foyer') || '').trim().slice(0, 60);
      E.personnes = E.personnes.filter((p) => !retirees.has(p.id)).map((p) => ({ ...p, nom: String(f.get(`nom-${p.id}`) || p.nom).trim().slice(0, 40) || p.nom }));
      E.documents.forEach((d) => { if (retirees.has(d.personne)) d.personne = null; });
      const nv = String(f.get('nouvelle') || '').trim();
      if (nv && E.personnes.length < 12) E.personnes.push(R.normaliserPersonne({ id: uid(), nom: nv }));
      delete modale().dataset.retirees;
      if (filtre.personne !== 'tous' && filtre.personne !== 'foyer' && !personne(filtre.personne)) filtre.personne = 'tous';
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.documents) || !Array.isArray(d.lieux)) throw new Error();
        if (!confirm(`Remplacer ton inventaire actuel par cette copie (${pluriel(d.documents.length, 'document')}, ${pluriel(d.lieux.length, 'emplacement')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = E.tutorielVu || vu;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de tes papiers.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `papiers-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E.documents, { type: typeDoc, nomCat, nomPersonne: (id) => (personne(id) ? nomPersonne(id) : 'Foyer'), nomLieu }, auj()), 'text/csv;charset=utf-8', `papiers-inventaire-${auj()}.csv`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Note où il est rangé', `Chaque document a son emplacement (classeur, boîte, tiroir, dossier numérique), avec une précision si besoin. Tape un mot dans la recherche pour retrouver un papier en un instant. Aucun numéro complet, IBAN ni mot de passe n'est accepté&nbsp;: seulement l'endroit.`],
      ['beurre', 'La durée de conservation se calcule', `Pour les ${B.documents.length} documents types, la durée proposée vient de service-public.gouv.fr. Selon le type, elle part de la date du document (facture, avis…) ou d'un événement (fin de la location…), à saisir. Tu peux aussi choisir une date, ou garder toujours.`],
      ['ciel', 'Rien n\'est jeté sans toi', `Une fois la durée passée, le document passe en «&nbsp;Peut être jeté&nbsp;»&nbsp;; ceux jetables dans les ${R.HORIZON_JETER}&nbsp;jours sont signalés à part. Quand tu l'as détruit, touche <b>Jeté</b>&nbsp;: il reste visible avec le filtre «&nbsp;Jetés&nbsp;».`],
      ['sable', 'Les renouvellements', `Saisis l'échéance d'une pièce (fin de validité, échéance annuelle)&nbsp;: un rappel s'affiche ${R.RAPPEL_DEFAUT}&nbsp;mois avant, réglable pour chaque document. <b>Échéances</b> réunit ce qui est à renouveler et ce qui peut être jeté.`],
      ['rose', 'En cas d\'urgence', `Coche «&nbsp;Essentiel en cas d'urgence&nbsp;» sur les papiers à retrouver vite. <b>Urgence</b> imprime la fiche à laisser à un proche&nbsp;: le nom des documents et leur emplacement, sans aucun numéro.`],
    ];
    const corps = `
      <p>L'application calcule pour toi jusqu'à quand garder chaque papier et te prévient avant qu'une pièce expire. Ton rôle&nbsp;: noter où chaque document est rangé, avec ses dates.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Rangements</b> montre ce que contient chaque emplacement, avec un inventaire à imprimer. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.documents.length;
    const pied = premier
      ? '<button class="btn primaire" value="document">Ajouter mon premier document</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => {
      if (choix === 'document') setTimeout(() => modaleDoc(null, R.normaliserDoc({ type: null, cat: 'identite', titre: '', lieu: E.lieux[0]?.id || null, essentiel: false }, B)), 0);
    });
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.choix = lireChoix(); accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue':
        if (modale().open) modale().close();
        if (el.dataset.statut && el.dataset.vue === 'documents') { filtre.statut = el.dataset.statut; filtre.cat = 'toutes'; filtre.q = ''; }
        changerVue(el.dataset.vue); break;
      case 'voir-lieu': changerVue('rangements'); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-doc': {
        const type = el.dataset.type ? R.typeDe(B, el.dataset.type) : null;
        modaleDoc(null, R.normaliserDoc({ type: type?.id || null, cat: type?.cat || (filtre.cat !== 'toutes' ? filtre.cat : 'identite'), titre: type?.nom || '', lieu: el.dataset.lieu || E.lieux[0]?.id || null, essentiel: type ? type.e : false }, B));
        break;
      }
      case 'doc': modaleDoc(id); break;
      case 'jeter': marquerJete(id, true); break;
      case 'renouvele': modaleRenouvele(id); break;
      case 'filtre-cat': filtre.cat = el.dataset.cat; rendre(); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; rendre(); break;
      case 'toutes-echeances': filtre.echeances = el.checked; rendre(); break;
      case 'nouveau-lieu': modaleLieu(null); break;
      case 'lieu': modaleLieu(id); break;
      case 'retirer-personne': { const li = el.closest('li'); const d = modale(); d.dataset.retirees = [d.dataset.retirees, el.dataset.personne].filter(Boolean).join(','); li.remove(); break; }
      case 'enregistrer-urgence': enregistrerUrgence(); break;
      case 'imprimer-inventaire': imprimerInventaire(); break;
      case 'imprimer-tri': imprimerTri(); break;
      case 'imprimer-urgence': imprimerUrgence(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action=filtre-personne]');
    if (el) { filtre.personne = el.value; rendre(); }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-cherche') return;
    e.preventDefault();
    filtre.q = $('#cherche-tableau').value; filtre.cat = 'toutes'; filtre.statut = 'tous'; filtre.personne = 'tous';
    changerVue('documents');
    const n = $('#recherche'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
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
  window.__papiers = { etat: () => E, regles: R };
  init();
})();
