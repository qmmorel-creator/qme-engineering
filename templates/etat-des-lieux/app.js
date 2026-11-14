// État des lieux d'entrée et de sortie QME : un dossier par bail (logement, parties, dates, dépôt de garantie),
// pièces types modifiables et leurs éléments (sols, murs, plafonds, menuiseries, électricité, équipements, mobilier
// en meublé), état codé (neuf, bon, usage normal, dégradé, hors service) avec commentaire et vignette photo, relevés
// de compteurs et clés remises, sortie comparée à l'entrée, vétusté d'après la grille saisie, retenues proposées,
// délai de restitution du dépôt de garantie, document imprimable à signer à la main et export CSV.
// Données synchronisées par clé de licence ou code d'accès. Outil d'aide : pas un document juridique certifié.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ETD;
  const API = '/api/templates';
  const PRODUIT = 'ETD';
  const CLE_CODE = 'qme-etd-code';
  const CLE_CACHE = 'qme-etd-cache';
  const CLE_DEMO = 'qme-etd-demo';
  const CLE_PREF = 'qme-etd-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-etd-ecran-accueil';
  const TAILLE_MAX = 900000;

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escBr = (s) => esc(s).replace(/\n/g, '<br>');
  const uid = () => R.nouvelId();
  const N = R.nombreTexte;
  const euros = R.euros;
  const pluriel = (n, s, p) => `${N(n)} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateCourte = (d) => (d ? `${R.versDate(d).getDate()} ${MOIS_C[R.versDate(d).getMonth()]}${d.slice(0, 4) !== auj().slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}` : '');
  const dateLongue = (d) => (d ? R.dateFr(d) : '');
  const ETAT = Object.fromEntries(B.etats.map((x) => [x.code, x]));
  const CAT = Object.fromEntries(B.categories.map((x) => [x.code, x.nom]));
  const PHASES = { entree: 'Entrée', sortie: 'Sortie' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'dossiers';
  const pref = stock.lire(CLE_PREF) || {};
  const sel = { dossier: pref.dossier || '', phase: pref.phase === 'sortie' ? 'sortie' : 'entree', doc: ['entree', 'sortie', 'complet'].includes(pref.doc) ? pref.doc : 'complet', identiques: false };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  function sauverPref() { stock.ecrire(CLE_PREF, { dossier: sel.dossier, phase: sel.phase, doc: sel.doc }); }
  const actifs = () => E.dossiers.filter((d) => !d.archive);
  // Dossier affiché : celui choisi s'il existe encore, sinon le premier dossier en cours.
  function dossier() {
    if (!E.dossiers.length) return null;
    let d = E.dossiers.find((x) => x.id === sel.dossier);
    if (!d) { d = actifs()[0] || E.dossiers[0]; sel.dossier = d.id; }
    return d;
  }
  const piece = (d, id) => d.pieces.find((p) => p.id === id);
  const element = (d, pid, xid) => piece(d, pid)?.elements.find((x) => x.id === xid);

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
        toast('Un autre appareil a modifié tes états des lieux entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : retire des photos ou exporte puis supprime les dossiers terminés (Réglages).');
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
  // Code interne (ETD-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.dossiers.length) { cache(false); demarrer(); } else { E = null; ecranAccueil(); }
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    if (!E.dossiers.some((d) => d.id === sel.dossier)) { sel.dossier = E.dossiers[0]?.id || ''; vue = 'comparaison'; }
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

  // ---------- Photos ----------
  // Vignette réduite dans le navigateur (JPEG), assez légère pour être synchronisée avec le reste du dossier :
  // côté 480 px puis moins, qualité décroissante, jusqu'à passer sous ~20 000 caractères. L'original n'est pas gardé.
  const CIBLE_PHOTO = 20000;
  async function vignette(fichier) {
    if (!fichier.type.startsWith('image/')) throw new Error('Choisis une photo (JPEG, PNG, HEIC selon le navigateur).');
    const url = URL.createObjectURL(fichier);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Photo illisible par ce navigateur : essaie en JPEG.')); i.src = url; });
      for (const cote of [480, 400, 320, 240]) {
        const k = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.62, 0.5, 0.4]) {
          const d = c.toDataURL('image/jpeg', q);
          if (d.length <= CIBLE_PHOTO) return d;
        }
      }
      throw new Error('Photo trop chargée pour être réduite : essaie un cadrage plus simple.');
    } finally { URL.revokeObjectURL(url); }
  }
  // Une nouvelle photo est-elle permise (nombre et taille du compte) ? `remplace` : une photo existante est remplacée.
  function placePhoto(remplace = false, ajoutCar = CIBLE_PHOTO) {
    const n = R.nbPhotos(E) - (remplace ? 1 : 0);
    if (n >= E.reglages.photosMax) return `Tu as atteint ${pluriel(E.reglages.photosMax, 'photo')} sur ce compte : retire des photos d'anciens dossiers (ou exporte-les puis supprime-les), ou change la limite dans les Réglages.`;
    if (R.taille(E) + ajoutCar > TAILLE_MAX - 20000) return 'Plus assez de place pour une photo (900 Ko par compte) : retire des photos ou supprime les dossiers terminés après les avoir exportés.';
    return '';
  }
  // Photos d'exemple dessinées pour la démo (aucune vraie photo).
  function photoDemo(titre, fond, dessin) {
    try {
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const x = c.getContext('2d');
      x.fillStyle = fond; x.fillRect(0, 0, 400, 300);
      dessin(x);
      x.fillStyle = 'rgba(36,34,31,.75)'; x.fillRect(0, 252, 400, 48);
      x.fillStyle = '#fff'; x.font = '600 17px Outfit, system-ui, sans-serif'; x.fillText(titre, 14, 274);
      x.font = '400 12px Outfit, system-ui, sans-serif'; x.fillText('Photo d\'exemple (démo)', 14, 291);
      const d = c.toDataURL('image/jpeg', 0.6);
      return d.length <= R.PHOTO_MAX_CAR ? d : '';
    } catch { return ''; }
  }

  // ---------- Données de démonstration ----------
  // Bailleuse fictive, trois dossiers à des dates relatives à aujourd'hui :
  //  A. T2 meublé, bail de trois ans terminé il y a 6 jours : sortie faite, murs du séjour tachés, plaques hors
  //     service, parquet rayé, joints noircis (sans grille), fenêtre améliorée, une clé manquante, grille de vétusté
  //     convenue dans le bail, dépôt de garantie de 1 300 €.
  //  B. Studio loué vide par une agence, entrée faite il y a 4 jours (délai de rectification encore ouvert).
  //  C. Le T2 de A pour le prochain locataire, entrée dans 3 jours, préparée à partir de la sortie de A.
  function donneesDemo() {
    const t = auj();
    const e = etatVide();
    const bailleur = { nom: 'Claire Exemple', adresse: '5 place de la Démo\n00000 Ville-Exemple' };
    const peint = R.normaliserLigneGrille({ id: 'g-peint', nom: 'Peintures et papiers peints', franchise: 2, abattement: 12, residuel: 10 });
    const sols = R.normaliserLigneGrille({ id: 'g-sols', nom: 'Parquet et revêtements de sol', franchise: 3, abattement: 8, residuel: 20 });
    const elec = R.normaliserLigneGrille({ id: 'g-elec', nom: 'Électroménager', franchise: 1, abattement: 15, residuel: 10 });
    const debutA = R.ajout(t, -3 * 365 - 25), sortieA = R.ajout(t, -6);
    const A = R.normaliserDossier({
      id: 'demo-a', cree: debutA,
      logement: { adresse: '12 allée des Tilleuls\n00000 Ville-Exemple', complement: '3e étage, porte gauche', type: 'meuble', surface: 42, modele: 't2' },
      bailleur, locataires: 'Léa Fictive et Hugo Démo',
      bail: { debut: debutA, fin: sortieA, depot: 1300, loyer: 650 },
      entree: { date: debutA, lieu: 'Ville-Exemple', observations: 'Logement repeint avant l\'entrée. Chaudière entretenue (attestation remise).' },
      sortie: { date: sortieA, lieu: 'Ville-Exemple', adresse: '8 rue du Nouveau Départ\n00000 Autre-Ville', observations: 'Logement rendu nettoyé. Une clé de la porte d\'entrée non rendue.' },
      grille: [peint, sols, elec],
      pieces: R.piecesModele('t2', true, B),
      compteurs: [
        { type: 'eau-froide', nom: 'Eau froide', numero: 'EF-48 213', unite: 'm³', entree: 112.4, sortie: 247.9 },
        { type: 'elec-hp', nom: 'Électricité heures pleines', numero: 'PDL 0000 0000 0000 01', unite: 'kWh', entree: 18240, sortie: 23116 },
        { type: 'elec-hc', nom: 'Électricité heures creuses', numero: 'PDL 0000 0000 0000 01', unite: 'kWh', entree: 9310, sortie: 12874 },
      ],
      cles: [
        { type: 'porte', nom: 'Clé de la porte d\'entrée', entree: 3, sortie: 2, com: 'Une clé non rendue.' },
        { type: 'immeuble', nom: 'Badge de l\'immeuble', entree: 2, sortie: 2 },
        { type: 'boite', nom: 'Clé de la boîte aux lettres', entree: 1, sortie: 1 },
      ],
    });
    // Entrée : bon état partout, neuf pour les peintures refaites, usage normal par endroits.
    const anneeA = Number(debutA.slice(0, 4));
    for (const p of A.pieces) for (const x of p.elements) {
      x.entree.etat = x.cat === 'murs' || x.cat === 'plafonds' ? 'neuf' : x.cat === 'mobilier' && /Canapé|Rangements/.test(x.nom) ? 'usage' : 'bon';
      x.sortie.etat = x.cat === 'murs' || x.cat === 'plafonds' ? 'bon' : x.entree.etat === 'usage' ? 'usage' : 'bon';
      if (x.cat === 'murs' || x.cat === 'plafonds') { x.grille = peint.id; x.pose = String(anneeA); }
    }
    const trouver = (pn, xn) => A.pieces.find((p) => p.nom === pn).elements.find((x) => x.nom === xn);
    const mursSejour = trouver('Séjour', 'Murs');
    Object.assign(mursSejour.entree, { etat: 'neuf', com: 'Peinture blanche refaite avant l\'entrée.' });
    Object.assign(mursSejour.sortie, { etat: 'degrade', com: 'Traces et trous de chevilles derrière le canapé, mur de gauche.', cout: 420, imputable: true });
    mursSejour.entree.photo = photoDemo('Séjour · murs (entrée)', '#F4F1EA', (x) => { x.fillStyle = '#E9E3D6'; x.fillRect(0, 210, 400, 42); x.strokeStyle = '#D8CFBF'; x.lineWidth = 2; x.strokeRect(250, 60, 90, 120); });
    mursSejour.sortie.photo = photoDemo('Séjour · murs (sortie)', '#EFEADF', (x) => { x.fillStyle = '#E2DACB'; x.fillRect(0, 210, 400, 42); x.fillStyle = '#9C8E78'; for (const [a, b] of [[90, 90], [130, 96], [170, 88], [110, 140]]) { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); } x.fillStyle = 'rgba(120,100,70,.25)'; x.beginPath(); x.ellipse(220, 150, 70, 30, 0.2, 0, 7); x.fill(); });
    const plaques = trouver('Cuisine', 'Plaques de cuisson');
    Object.assign(plaques, { grille: elec.id, pose: String(anneeA - 2) });
    Object.assign(plaques.entree, { etat: 'bon', com: 'Plaques vitrocéramiques, 4 feux.' });
    Object.assign(plaques.sortie, { etat: 'hs', com: 'Vitre fêlée, un foyer ne chauffe plus.', cout: 380, imputable: true });
    plaques.sortie.photo = photoDemo('Cuisine · plaques (sortie)', '#2E2C29', (x) => { x.strokeStyle = '#6E685F'; x.lineWidth = 3; for (const [a, b] of [[110, 90], [270, 90], [110, 180], [270, 180]]) { x.beginPath(); x.arc(a, b, 42, 0, 7); x.stroke(); } x.strokeStyle = '#E8E4DA'; x.lineWidth = 2; x.beginPath(); x.moveTo(180, 40); x.lineTo(205, 110); x.lineTo(190, 150); x.lineTo(230, 230); x.stroke(); });
    const parquet = trouver('Chambre', 'Sol');
    Object.assign(parquet, { grille: sols.id, pose: `03/${anneeA - 6}` });
    Object.assign(parquet.entree, { etat: 'bon', com: 'Parquet chêne vitrifié.' });
    Object.assign(parquet.sortie, { etat: 'degrade', com: 'Rayures profondes sous le bureau.', cout: 350, imputable: true });
    const joints = trouver('Salle de bains', 'Joints');
    Object.assign(joints.sortie, { etat: 'degrade', com: 'Joints de la douche noircis.', cout: 90, imputable: true });
    const fenetre = trouver('Séjour', 'Fenêtres');
    Object.assign(fenetre.entree, { etat: 'usage', com: 'Joint de la fenêtre de droite fatigué.' });
    Object.assign(fenetre.sortie, { etat: 'bon', com: 'Joints remplacés par le bailleur en cours de bail.' });
    const plafondSdb = trouver('Salle de bains', 'Plafond');
    Object.assign(plafondSdb.sortie, { etat: 'usage', com: 'Légères traces d\'humidité au-dessus de la douche.' });
    const literie = trouver('Chambre', 'Literie (matelas, couette, oreillers)');
    Object.assign(literie.sortie, { etat: 'degrade', com: 'Matelas taché.', cout: 220, imputable: false });
    literie.sortie.com = 'Matelas taché : usure du matelas d\'origine, non retenue d\'un commun accord.';

    // B. Studio loué vide par une agence, entrée faite il y a 4 jours.
    const entreeB = R.ajout(t, -4);
    const B2 = R.normaliserDossier({
      id: 'demo-b', cree: R.ajout(t, -12),
      logement: { adresse: '27 boulevard de l\'Exemple\n00000 Ville-Exemple', complement: 'Bâtiment B, 1er étage', type: 'nu', surface: 24, modele: 'studio' },
      bailleur: { nom: 'SCI Démo Patrimoine', adresse: '40 avenue Fictive\n00000 Ville-Exemple' },
      mandataire: { nom: 'Agence Démo Immobilier', adresse: '3 rue des Agences\n00000 Ville-Exemple' },
      locataires: 'Nina Exemple',
      bail: { debut: entreeB, depot: 540, loyer: 540 },
      entree: { date: entreeB, lieu: 'Ville-Exemple', observations: 'Cuisine équipée (plaques, hotte, réfrigérateur sous plan fourni par le bailleur).' },
      pieces: R.piecesModele('studio', false, B),
      compteurs: R.compteursDefaut(B).map((c, i) => ({ ...c, numero: i ? 'PDL 0000 0000 0000 02' : 'EF-10 552', entree: i ? 4210 : 31.2 })),
      cles: [{ type: 'porte', nom: 'Clé de la porte d\'entrée', entree: 2 }, { type: 'immeuble', nom: 'Badge de l\'immeuble', entree: 1 }, { type: 'boite', nom: 'Clé de la boîte aux lettres', entree: 1 }],
    });
    for (const p of B2.pieces) for (const x of p.elements) x.entree.etat = x.cat === 'sols' ? 'usage' : 'bon';
    const solB = B2.pieces[1].elements.find((x) => x.cat === 'sols');
    solB.entree.com = 'Lino : petite brûlure près de la fenêtre (2 cm).';
    const hotte = B2.pieces[2].elements.find((x) => x.nom === 'Hotte');
    Object.assign(hotte.entree, { etat: 'hs', com: 'Ne s\'allume pas : signalé à l\'agence, réparation prévue.' });

    // C. Le T2 pour le locataire suivant, préparé à partir de la sortie de A.
    const C = R.reprendreDossier(A, t);
    C.id = 'demo-c';
    C.locataires = 'Sam Exemple';
    C.bail.debut = R.ajout(t, 3);
    C.grille = [peint, sols, elec].map((l) => ({ ...l }));
    // Le bailleur a remis en état ce qui était dégradé : l'entrée repart de « bon état » sur ces éléments.
    for (const p of C.pieces) for (const x of p.elements) { if (['degrade', 'hs'].includes(x.entree.etat)) { x.entree.etat = ''; x.entree.com = ''; x.entree.photo = ''; } }
    for (const p of C.pieces) for (const x of p.elements) if (x.entree.photo) x.entree.photo = '';
    C.cles[0].entree = 3;

    e.dossiers.push(A, B2, C);
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'État des lieux · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M30 150 L150 60 L270 150 Z" fill="#D9302A"/>
          <rect x="52" y="150" width="196" height="130" rx="10" fill="#F0EDE6"/>
          <rect x="72" y="172" width="70" height="52" rx="8" fill="#1D4E89"/>
          <rect x="160" y="172" width="70" height="108" rx="8" fill="#F5B400"/>
          <rect x="30" y="280" width="240" height="12" rx="6" fill="#141414"/>
          <rect x="330" y="70" width="190" height="210" rx="16" fill="#F0EDE6"/>
          <rect x="352" y="100" width="20" height="20" rx="5" fill="#1D4E89"/><rect x="384" y="104" width="112" height="12" rx="6" fill="#141414"/>
          <rect x="352" y="140" width="20" height="20" rx="5" fill="#1D4E89"/><rect x="384" y="144" width="90" height="12" rx="6" fill="#141414"/>
          <rect x="352" y="180" width="20" height="20" rx="5" fill="#D9302A"/><rect x="384" y="184" width="104" height="12" rx="6" fill="#141414"/>
          <circle cx="470" cy="245" r="22" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">État des lieux</p>
          <h1>Entrée, sortie, et ce qui a changé.</h1>
          <p>Pièce par pièce, un état pour chaque élément avec un commentaire et une photo, les compteurs et les clés, puis la sortie comparée à l'entrée et un document prêt à signer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes états des lieux</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes dossiers sont enregistrés en ligne et te suivent sur tous tes appareils : la tablette le jour de la visite, l'ordinateur pour imprimer.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes états des lieux</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/etat-des-lieux/">Voir État des lieux</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes états des lieux'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, adresse: '', complement: '', type: 'nu', modele: 't2' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Un état des lieux clair, à l'entrée comme à la sortie.</h1>
        <p class="intro">Tu crées un dossier par bail. Les pièces arrivent avec leurs éléments types, tu notes l'état de chacun en un toucher, avec un commentaire et une photo si besoin. À la sortie, ce qui a changé ressort tout seul.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="mention" style="margin-top:20px">Outil d'aide à la rédaction : il ne remplace ni le bail, ni un constat de commissaire de justice, ni un conseil juridique.</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton premier logement</h1>
        <p class="intro">Choisis la forme la plus proche : pièces et éléments se renomment, s'ajoutent et se retirent ensuite.</p>
        <div class="form-accueil">
          <label class="champ">Adresse du logement<textarea id="a-adresse" rows="2" maxlength="200" placeholder="12 rue de l'Exemple&#10;00000 Ville">${esc(a.adresse)}</textarea></label>
          <label class="champ">Complément <small>facultatif : étage, porte, numéro de lot</small><input id="a-complement" value="${esc(a.complement)}" maxlength="120"></label>
          <fieldset class="cadre-champs"><legend>Location</legend>
            <div class="choix-statut deux">${[['nu', 'Vide (nue)'], ['meuble', 'Meublée']].map(([c, n]) => `<label><input type="radio" name="a-type" value="${c}" ${a.type === c ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
            <p class="aide" style="margin-top:10px">En meublée, chaque pièce reçoit aussi ses éléments de mobilier (lit, literie, vaisselle…).</p>
          </fieldset>
          <fieldset class="cadre-champs"><legend>Logement</legend>
            <div class="choix-modeles">${B.modeles.map((m) => `<label><input type="radio" name="a-modele" value="${m.code}" ${m.code === a.modele ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.aide)}</small></span></label>`).join('')}</div>
          </fieldset>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer le dossier</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#a-adresse')?.addEventListener('input', (e) => { accueil.adresse = e.target.value; });
    $('#a-complement')?.addEventListener('input', (e) => { accueil.complement = e.target.value; });
    document.querySelectorAll('[name=a-type]').forEach((r) => r.addEventListener('change', (e) => { accueil.type = e.target.value; }));
    document.querySelectorAll('[name=a-modele]').forEach((r) => r.addEventListener('change', (e) => { accueil.modele = e.target.value; }));
  }

  function creerDossier(champs, modele) {
    const meuble = champs.logement.type === 'meuble';
    return R.normaliserDossier({ ...champs, logement: { ...champs.logement, modele }, cree: auj(), pieces: R.piecesModele(modele, meuble, B), compteurs: R.compteursDefaut(B), cles: R.clesDefaut(B) });
  }

  function terminerAccueil() {
    const a = accueil;
    if (!a.adresse.trim()) return ecranAccueil('Indique l\'adresse du logement (elle figure sur le document).');
    E = etatVide();
    const d = creerDossier({ logement: { adresse: a.adresse, complement: a.complement, type: a.type } }, a.modele);
    E.dossiers.push(d);
    sel.dossier = d.id; sel.phase = 'entree';
    accueil = accueilVide();
    vue = 'pieces';
    sauver(); sauverPref();
    demarrer();
    toast('Dossier créé : complète les parties et le bail (Dossiers), puis note l\'état de chaque élément.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    dossiers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3l9 8v10H3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="9.5" y="14" width="5" height="7" fill="currentColor"/></svg>',
    pieces: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    compteurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12 17 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>',
    comparaison: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="2" fill="currentColor"/><rect x="14" y="4" width="7" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 12h7" stroke="currentColor" stroke-width="2"/></svg>',
    document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2h10l4 4v16H5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="10" width="8" height="2" fill="currentColor"/><rect x="8" y="14" width="8" height="2" fill="currentColor"/><path d="M8 19h3" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    photo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v13H4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['dossiers', 'Dossiers'], ['pieces', 'Pièces'], ['compteurs', 'Compteurs'], ['comparaison', 'Comparaison'], ['document', 'Document']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la rédaction d\'un état des lieux, pas un document juridique certifié. Comparaison, vétusté et retenues sont calculées à partir de tes saisies et de la grille que tu entres ; elles ne tranchent pas un désaccord (commission départementale de conciliation, puis juge). Délais rappelés d\'après service-public.gouv.fr, relevés le 14/11/2026 : vérifie-les avant de t\'en servir.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M4 46 L40 14 L76 46 Z" fill="#D9302A"/><rect x="12" y="46" width="56" height="42" rx="6" fill="#1D4E89"/><circle cx="80" cy="74" r="14" fill="#F5B400"/><rect x="0" y="88" width="96" height="8" rx="4" fill="#141414"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${petit ? '' : FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ST_ETIQ = { preparer: 'sable', entree: 'jaune', occupe: 'ciel', sortie: 'jaune', 'sortie-faite': 'vert' };
  const etiquetteStatut = (d) => { const s = R.statut(d); return `<span class="etiquette ${ST_ETIQ[s]}">${R.STATUTS[s]}</span>`; };
  const pastilleEtat = (code, long = false) => (code ? `<span class="pastille-etat e-${code}" title="${esc(ETAT[code].nom)}">${long ? esc(ETAT[code].nom) : esc(ETAT[code].court)}</span>` : '<span class="pastille-etat e-vide" title="Pas encore constaté">–</span>');
  const DIFF = { degrade: ['rouge', 'Dégradé'], ameliore: ['vert', 'Amélioré'], usure: ['jaune', 'Usure normale'], identique: ['sable', 'Identique'], sansEntree: ['jaune', 'Sans état d\'entrée'], entree: ['sable', 'À constater'], vide: ['sable', 'À constater'] };
  const etiquetteDiff = (diff) => { const [c, t] = DIFF[diff]; return `<span class="etiquette ${c}">${t}</span>`; };
  const typeLoc = (d) => (d.logement.type === 'meuble' ? 'Meublé' : 'Vide');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/etat-des-lieux/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Logements, personnes et photos fictifs, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">État<br>des lieux</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · État des lieux`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { dossiers: vueDossiers, pieces: vuePieces, compteurs: vueCompteurs, comparaison: vueComparaison, document: vueDocument }[vue]();
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
    $('#choix-dossier')?.addEventListener('change', (e) => { sel.dossier = e.target.value; sauverPref(); rendre(); });
    $('#choix-doc')?.addEventListener('change', (e) => { sel.doc = e.target.value; sauverPref(); rendre(); });
    $('#choix-conformite')?.addEventListener('change', (e) => { const v = e.target.value; modifier(() => { dossier().conformite = v; return E; }, 'Conformité de la sortie enregistrée.'); });
  }

  // En-tête commun des vues d'un dossier : choix du dossier, titre.
  function choixDossier(d) {
    if (E.dossiers.length < 2) return '';
    return `<label class="champ choix-dossier"><span class="sr-only">Dossier</span><select id="choix-dossier">${E.dossiers.map((x) => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(R.titreDossier(x))}${x.locataires ? ` · ${esc(x.locataires)}` : ''}${x.archive ? ' (archivé)' : ''}</option>`).join('')}</select></label>`;
  }
  const teteDossier = (d, titre, actions = '') => `<div class="vue-tete"><div><p class="surtitre">${esc(R.titreDossier(d))}${d.locataires ? ` · ${esc(d.locataires)}` : ''}</p><h1>${titre}</h1></div><div class="actions">${choixDossier(d)}${actions}</div></div>`;
  const sansDossier = (titre) => `<div class="vue-tete"><div><p class="surtitre">État des lieux</p><h1>${titre}</h1></div></div>${videEtat('Aucun dossier', 'Crée un dossier pour ton logement : adresse, type de location et pièces.', `<button class="btn primaire" data-action="dossier-nouveau">${ICONES.plus}Nouveau dossier</button>`)}${AVERTISSEMENT}`;

  // ---------- Dossiers ----------
  function carteDossier(d) {
    const ae = R.avancement(d, 'entree'), as = R.avancement(d, 'sortie');
    const t = auj();
    const rest = R.restitution(d, E.reglages, t);
    const rect = R.rectification(d, E.reglages, t);
    const bilan = R.bilanRetenues(d);
    const lignes = [];
    if (d.entree.date) lignes.push(`Entrée : <b>${esc(dateLongue(d.entree.date))}</b>`);
    else if (d.bail.debut) lignes.push(`Début du bail : <b>${esc(dateLongue(d.bail.debut))}</b>`);
    if (d.sortie.date) lignes.push(`Sortie : <b>${esc(dateLongue(d.sortie.date))}</b>`);
    const alertes = [];
    if (rect && rect.ouvert && !d.sortie.date) alertes.push(`<p class="cd-note">Le locataire peut demander à compléter l'état des lieux d'entrée jusqu'au <b>${esc(dateLongue(rect.limite))}</b> (${N(E.reglages.rectificationJours)} jours).</p>`);
    if (rest) alertes.push(`<p class="${rest.joursRestants < 0 ? 'cd-alerte' : 'cd-note'}">Dépôt de garantie${d.bail.depot !== null ? ` de ${euros(d.bail.depot)}` : ''} à rendre au plus tard le <b>${esc(dateLongue(rest.limite))}</b> (sortie ${rest.conforme ? 'conforme' : 'non conforme'} : ${pluriel(rest.mois, 'mois', 'mois')})${bilan.total ? ` · retenues proposées ${euros(bilan.total)}` : ''}.</p>`);
    const barre = (a, nom) => `<div class="avance"><span>${nom}</span><div class="progres" role="img" aria-label="${nom} : ${a.faits} éléments sur ${a.total}"><span style="width:${a.pct}%"></span></div><b>${a.faits}/${a.total}</b></div>`;
    return `<li class="carte-dossier ${d.id === sel.dossier ? 'actif' : ''}">
      <div class="cdo-tete"><button class="lien-ligne" data-action="dossier-ouvrir" data-id="${d.id}"><b>${esc(R.titreDossier(d))}</b><span>${esc(typeLoc(d))}${d.logement.surface ? ` · ${N(d.logement.surface, 1)} m²` : ''} · ${pluriel(d.pieces.length, 'pièce')} · ${esc(d.locataires || 'Locataire à renseigner')}</span></button>${etiquetteStatut(d)}</div>
      <div class="cdo-avance">${barre(ae, 'Entrée')}${barre(as, 'Sortie')}</div>
      ${lignes.length ? `<p class="cdo-dates">${lignes.join(' · ')}</p>` : ''}
      ${alertes.join('')}
      <div class="rang"><button class="btn petit primaire" data-action="dossier-ouvrir" data-id="${d.id}">Ouvrir</button><button class="btn petit" data-action="dossier" data-id="${d.id}">Logement, parties, bail</button>${as.faits || d.sortie.date ? `<button class="btn petit" data-action="dossier-reprendre" data-id="${d.id}">Nouveau locataire</button>` : ''}</div>
    </li>`;
  }

  function vueDossiers() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">État des lieux d'entrée et de sortie</p><h1>Dossiers</h1><p>Un dossier par bail : le logement, les parties, l'entrée et la sortie au même endroit.</p></div><div class="actions"><button class="btn primaire" data-action="dossier-nouveau">${ICONES.plus}Nouveau dossier</button></div></div>`;
    if (!E.dossiers.length) return `${tete}${videEtat('Aucun dossier', 'Crée un dossier pour ton logement : adresse, type de location et pièces types.', `<button class="btn primaire" data-action="dossier-nouveau">${ICONES.plus}Nouveau dossier</button>`)}${AVERTISSEMENT}`;
    const en = actifs(), arch = E.dossiers.filter((d) => d.archive);
    const photos = R.nbPhotos(E);
    return `${tete}
      <ul class="cartes-dossiers">${en.map(carteDossier).join('')}</ul>
      ${en.length ? '' : videEtat('Tous les dossiers sont archivés', 'Ouvre un dossier archivé ci-dessous, ou crée un nouveau dossier.', '', true)}
      ${arch.length ? `<details class="plus-tard"><summary>Dossiers archivés (${arch.length})</summary><ul class="cartes-dossiers">${arch.map(carteDossier).join('')}</ul></details>` : ''}
      <ul class="faits"><li><b>${pluriel(E.dossiers.length, 'dossier')}</b></li><li><b>${N(photos)}</b> photo${photos > 1 ? 's' : ''} sur ${N(E.reglages.photosMax)} permises</li><li>Données : <b>${N(Math.round(R.taille(E) / 1000))} Ko</b> sur 900</li></ul>
      ${AVERTISSEMENT}`;
  }

  // ---------- Pièces (constat) ----------
  function ligneElement(d, p, x) {
    const ph = sel.phase;
    const c = x[ph];
    const diff = R.difference(x);
    const ref = ph === 'sortie' ? `<span class="le-ref">Entrée : ${x.entree.etat ? esc(ETAT[x.entree.etat].nom) : 'non constatée'}${x.sortie.etat && diff !== 'identique' ? ` ${etiquetteDiff(diff)}` : ''}</span>` : '';
    const boutons = B.etats.map((s) => `<button type="button" class="b-etat e-${s.code}" data-action="etat" data-p="${p.id}" data-x="${x.id}" data-etat="${s.code}" aria-pressed="${c.etat === s.code}" aria-label="${esc(x.nom)} : ${esc(s.nom)}" title="${esc(s.nom)}">${esc(s.court)}</button>`).join('');
    return `<li class="ligne-element ${ph === 'sortie' && diff === 'degrade' ? 'degrade' : ''} ${c.etat ? '' : 'a-faire'}">
      <button class="le-info" data-action="element" data-p="${p.id}" data-x="${x.id}">
        ${c.photo ? `<img class="le-photo" src="${c.photo}" alt="">` : ''}
        <span class="le-texte"><b>${esc(x.nom)}</b><span class="le-cat">${esc(CAT[x.cat] || '')}${c.etat ? ` · ${esc(ETAT[c.etat].nom)}` : ''}</span>${c.com ? `<span class="le-com">${esc(c.com)}</span>` : ''}${ref}</span>
      </button>
      <div class="le-etats" role="group" aria-label="État de ${esc(x.nom)}">${boutons}</div>
    </li>`;
  }

  function vuePieces() {
    const d = dossier();
    if (!d) return sansDossier('Pièces');
    const ph = sel.phase;
    const av = R.avancement(d, ph);
    const date = d[ph].date;
    const bascule = `<div class="filtres bascule" role="group" aria-label="Constat">${Object.entries(PHASES).map(([k, n]) => { const a = R.avancement(d, k); return `<button class="filtre" data-action="phase" data-phase="${k}" aria-pressed="${ph === k}">${n} <small>${a.faits}/${a.total}</small></button>`; }).join('')}</div>`;
    const tete = teteDossier(d, `Pièces · ${PHASES[ph].toLowerCase()}`, `<button class="btn" data-action="phase-infos">${date ? `${PHASES[ph]} le ${esc(dateCourte(date))}` : `Date de l'${ph === 'entree' ? 'entrée' : 'état de sortie'}`}</button><button class="btn primaire" data-action="piece">${ICONES.plus}Pièce</button>`);
    const infos = [];
    if (ph === 'sortie' && R.avancement(d, 'entree').faits === 0) infos.push('<p class="aide">L\'entrée n\'a pas été constatée dans ce dossier : la sortie ne pourra pas être comparée. Tu peux d\'abord saisir l\'état d\'entrée (bascule « Entrée »).</p>');
    if (!date) infos.push(`<p class="aide">Indique la date de l'état des lieux ${ph === 'entree' ? 'd\'entrée' : 'de sortie'} : elle figure sur le document${ph === 'sortie' ? ' et fait partir le délai de restitution du dépôt de garantie' : ''}.</p>`);
    const legende = `<p class="legende-etats">${B.etats.map((s) => `<span>${pastilleEtat(s.code)} ${esc(s.nom)}</span>`).join('')}</p>`;
    const pieces = d.pieces.map((p, i) => {
      const faits = p.elements.filter((x) => x[ph].etat).length;
      const degr = ph === 'sortie' ? p.elements.filter((x) => R.difference(x) === 'degrade').length : 0;
      return `<section class="carte-piece" id="piece-${p.id}">
        <div class="cp-tete">
          <button class="lien-ligne" data-action="piece" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${faits}/${p.elements.length} constatés${degr ? ` · <b class="negatif">${pluriel(degr, 'dégradation')}</b>` : ''}</span></button>
          <div class="rang">
            ${p.elements.some((x) => !x[ph].etat) ? (ph === 'entree' ? `<button class="btn petit" data-action="remplir" data-id="${p.id}">Le reste en bon état</button>` : `<button class="btn petit" data-action="remplir" data-id="${p.id}">Le reste comme à l'entrée</button>`) : ''}
            <span class="deplacer"><button class="btn-suppr" data-action="piece-monter" data-id="${p.id}" aria-label="Monter ${esc(p.nom)}" ${i ? '' : 'disabled'}>↑</button><button class="btn-suppr" data-action="piece-descendre" data-id="${p.id}" aria-label="Descendre ${esc(p.nom)}" ${i < d.pieces.length - 1 ? '' : 'disabled'}>↓</button></span>
          </div>
        </div>
        <ul class="lignes-elements">${p.elements.map((x) => ligneElement(d, p, x)).join('')}</ul>
        <button class="btn petit lien" data-action="element" data-p="${p.id}">${ICONES.plus}Élément</button>
      </section>`;
    }).join('');
    return `${tete}${bascule}<div class="avance-phase"><div class="progres"><span style="width:${av.pct}%"></span></div><span><b>${av.faits}</b> élément${av.faits > 1 ? 's' : ''} constaté${av.faits > 1 ? 's' : ''} sur ${av.total}</span></div>${infos.join('')}${legende}
      ${d.pieces.length ? `<div class="pieces">${pieces}</div>` : videEtat('Aucune pièce', 'Ajoute les pièces du logement : chacune arrive avec ses éléments types.', `<button class="btn primaire" data-action="piece">${ICONES.plus}Pièce</button>`)}
      ${AVERTISSEMENT}`;
  }

  // ---------- Compteurs et clés ----------
  function vueCompteurs() {
    const d = dossier();
    if (!d) return sansDossier('Compteurs et clés');
    const tete = teteDossier(d, 'Compteurs et clés');
    const nbr = (v, dec = 3) => (v === null ? '<span class="manque">à relever</span>' : N(v, dec));
    const compteurs = d.compteurs.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Compteur</th><th class="tel-masque">Numéro</th><th class="nb">Entrée</th><th class="nb">Sortie</th><th class="nb">Consommation</th></tr></thead><tbody>${d.compteurs.map((c) => { const k = R.consommation(c); return `<tr><td><button class="lien-ligne" data-action="compteur" data-id="${c.id}"><b>${esc(c.nom)}</b><span>${esc(c.unite)}${c.numero ? `<span class="tel-seul"> · ${esc(c.numero)}</span>` : ''}</span></button></td><td class="tel-masque">${esc(c.numero)}</td><td class="nb">${nbr(c.entree)}</td><td class="nb">${c.sortie === null && !d.sortie.date ? '–' : nbr(c.sortie)}</td><td class="nb">${k === null ? '–' : k < 0 ? '<span class="etiquette rouge">Relevé à vérifier</span>' : `<b>${N(k, 3)}</b> ${esc(c.unite)}`}</td></tr>`; }).join('')}</tbody></table></div>` : videEtat('Aucun compteur', 'Ajoute les compteurs individuels (eau, électricité, gaz, chauffage) quand les charges ne sont pas au forfait.', '', true);
    const cles = d.cles.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Clés et accès</th><th class="nb">Remis à l'entrée</th><th class="nb">Rendus à la sortie</th><th class="nb">Manquants</th></tr></thead><tbody>${d.cles.map((c) => { const k = R.clesManquantes(c); return `<tr><td><button class="lien-ligne" data-action="cle" data-id="${c.id}"><b>${esc(c.nom)}</b>${c.com ? `<span>${esc(c.com)}</span>` : ''}</button></td><td class="nb">${c.entree === null ? '<span class="manque">à compter</span>' : N(c.entree)}</td><td class="nb">${c.sortie === null ? '–' : N(c.sortie)}</td><td class="nb">${k === null ? '–' : k ? `<span class="etiquette rouge">${N(k)}</span>` : '<span class="etiquette vert">Aucun</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : videEtat('Aucune clé', 'Liste les clés, badges et télécommandes remis au locataire.', '', true);
    return `${tete}
      <h2 class="titre-section">Relevés de compteurs <span>index relevés le jour de l'état des lieux</span><button class="btn petit" data-action="compteur">${ICONES.plus}Compteur</button></h2>${compteurs}
      <h2 class="titre-section">Clés et moyens d'accès <span>nombre remis et rendu</span><button class="btn petit" data-action="cle">${ICONES.plus}Clé ou accès</button></h2>${cles}
      ${AVERTISSEMENT}`;
  }

  // ---------- Comparaison ----------
  const vignettes = (x) => (x.entree.photo || x.sortie.photo ? `<div class="avant-apres">${x.entree.photo ? `<figure><img src="${x.entree.photo}" alt="${esc(x.nom)} à l'entrée"><figcaption>Entrée</figcaption></figure>` : ''}${x.sortie.photo ? `<figure><img src="${x.sortie.photo}" alt="${esc(x.nom)} à la sortie"><figcaption>Sortie</figcaption></figure>` : ''}</div>` : '');

  function vueComparaison() {
    const d = dossier();
    if (!d) return sansDossier('Comparaison');
    const tete = teteDossier(d, 'Sortie comparée à l\'entrée', `<button class="btn" data-action="grille">Grille de vétusté${d.grille.length ? ` (${d.grille.length})` : ''}</button>`);
    const as = R.avancement(d, 'sortie');
    if (!as.faits) return `${tete}${videEtat('La sortie n\'a pas commencé', 'Note l\'état de sortie de chaque élément (Pièces, bascule « Sortie ») : les différences avec l\'entrée apparaîtront ici, avec les retenues proposées.', '<button class="btn primaire" data-action="aller-sortie">Commencer la sortie</button>')}${AVERTISSEMENT}`;
    const diffs = R.differences(d);
    const compte = (k) => diffs.filter((x) => x.diff === k).length;
    const bilan = R.bilanRetenues(d);
    const rest = R.restitution(d, E.reglages, auj());
    const manquantes = d.cles.reduce((s, c) => s + (R.clesManquantes(c) || 0), 0);
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Dégradés</p><b>${compte('degrade')}</b><span>dégradé${compte('degrade') > 1 ? 's' : ''} ou hors service depuis l'entrée</span></div>
      <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">Usure normale</p><b>${compte('usure')}</b><span>${pluriel(compte('ameliore'), 'amélioré')}, ${pluriel(compte('identique'), 'identique')}${as.total - as.faits ? `, ${as.total - as.faits} à constater` : ''}</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Retenues proposées</p><b>${euros(bilan.total)}</b><span>${bilan.depot === null ? 'dépôt de garantie non renseigné' : `sur ${euros(bilan.depot)} de dépôt de garantie`}</span></div>
      <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Dépôt à rendre</p><b>${bilan.aRendre === null ? '–' : euros(bilan.aRendre)}</b><span>${rest ? `au plus tard le ${esc(dateCourte(rest.limite))}` : 'date de sortie à indiquer'}</span></div>
    </div>`;
    const lignesDiff = (liste) => liste.map(({ piece: p, x, diff }) => {
      const r = R.retenueElement(d, x);
      return `<li class="ligne-diff d-${diff}">
        <div class="ld-tete"><button class="lien-ligne" data-action="element-sortie" data-p="${p.id}" data-x="${x.id}"><b>${esc(p.nom)} · ${esc(x.nom)}</b><span>${esc(CAT[x.cat] || '')}</span></button>${etiquetteDiff(diff)}</div>
        <div class="ld-etats"><div><span class="surtitre">Entrée</span>${pastilleEtat(x.entree.etat, true)}${x.entree.com ? `<p>${esc(x.entree.com)}</p>` : ''}</div><div><span class="surtitre">Sortie</span>${pastilleEtat(x.sortie.etat, true)}${x.sortie.com ? `<p>${esc(x.sortie.com)}</p>` : ''}</div></div>
        ${vignettes(x)}
        ${diff === 'degrade' ? `<p class="ld-retenue">${!r.imputable ? 'Non imputée au locataire.' : r.cout === null ? '<span class="manque">Coût de remise en état à saisir</span>' : `Remise en état ${euros(r.cout)}${r.taux !== null ? ` · vétusté ${N(r.taux, 1)} % (${r.age} an${r.age > 1 ? 's' : ''}, ${esc(r.ligne.nom)})` : r.incomplet ? ' · <span class="manque">date de pose à saisir pour la vétusté</span>' : ''} · retenue proposée <b>${euros(r.retenue)}</b>`}</p>` : ''}
      </li>`;
    }).join('');
    const notables = diffs.filter((x) => ['degrade', 'ameliore', 'sansEntree'].includes(x.diff));
    const autres = diffs.filter((x) => x.diff === 'identique' || x.diff === 'usure');
    const restants = diffs.filter((x) => x.diff === 'entree' || x.diff === 'vide');
    const tableau = bilan.lignes.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Élément dégradé</th><th class="nb tel-masque">Âge</th><th class="nb">Vétusté</th><th class="nb">Remise en état</th><th class="nb">Retenue</th></tr></thead><tbody>${bilan.lignes.map((l) => `<tr><td>${esc(l.piece.nom)} · ${esc(l.x.nom)}${l.imputable ? '' : ' <span class="etiquette sable">non imputé</span>'}</td><td class="nb tel-masque">${l.age === null ? '–' : `${l.age} an${l.age > 1 ? 's' : ''}`}</td><td class="nb">${l.taux === null ? (l.ligne ? '?' : 'sans grille') : `${N(l.taux, 1)} %`}</td><td class="nb">${l.cout === null ? '<span class="manque">à saisir</span>' : euros(l.cout)}</td><td class="nb"><b>${euros(l.retenue)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3" class="tel-masque">Total des retenues proposées</td><td colspan="2" class="tel-seul-cellule">Total</td><td></td><td class="nb">${euros(bilan.total)}</td></tr>${bilan.depot !== null ? `<tr><td colspan="3" class="tel-masque">Dépôt de garantie</td><td colspan="2" class="tel-seul-cellule">Dépôt</td><td></td><td class="nb">${euros(bilan.depot)}</td></tr><tr><td colspan="3" class="tel-masque">${bilan.depassement ? 'Retenues au-delà du dépôt' : 'À rendre au locataire'}</td><td colspan="2" class="tel-seul-cellule">${bilan.depassement ? 'Au-delà' : 'À rendre'}</td><td></td><td class="nb">${euros(bilan.depassement || bilan.aRendre)}</td></tr>` : ''}</tfoot></table></div>` : '<p class="mention">Aucun élément dégradé : rien à retenir au titre de l\'état du logement.</p>';
    const conf = `<div class="bloc-conformite">
      <label class="champ">Sortie conforme à l'entrée ?<select id="choix-conformite"><option value="auto" ${d.conformite === 'auto' ? 'selected' : ''}>Automatique : ${R.conforme({ ...d, conformite: 'auto' }) ? 'conforme' : 'non conforme'} (dégradations, clés)</option><option value="conforme" ${d.conformite === 'conforme' ? 'selected' : ''}>Conforme (choix des parties)</option><option value="non" ${d.conformite === 'non' ? 'selected' : ''}>Non conforme (choix des parties)</option></select></label>
      <p>${rest ? `Clés rendues le <b>${esc(dateLongue(d.sortie.date))}</b> : dépôt de garantie à rendre au plus tard le <b>${esc(dateLongue(rest.limite))}</b> (${pluriel(rest.mois, 'mois', 'mois')}, sortie ${rest.conforme ? 'conforme' : 'non conforme'}).` : 'Indique la date de sortie (remise des clés) pour calculer la date limite de restitution du dépôt de garantie.'}</p>
      <p class="mention">D'après service-public.gouv.fr (fiche F31269, consultée le 14/11/2026) : 1 mois si l'état des lieux de sortie est conforme à celui d'entrée, 2 mois sinon, à compter de la remise des clés ; les différences dues à la vétusté ne justifient pas de retenue. Délais modifiables dans les Réglages.</p>
    </div>`;
    const compteurs = d.compteurs.filter((c) => R.consommation(c) !== null);
    return `${tete}${tuiles}
      ${bilan.sansCout ? `<p class="aide" style="margin-top:16px">${pluriel(bilan.sansCout, 'élément dégradé')} sans coût de remise en état : touche-le pour saisir le montant (devis ou facture).</p>` : ''}
      <h2 class="titre-section">Ce qui a changé <span>${pluriel(notables.length, 'élément')} · ${pluriel(restants.length, 'élément')} à constater</span></h2>
      ${notables.length ? `<ul class="lignes-diff">${lignesDiff(notables)}</ul>` : '<p class="mention">Aucune différence avec l\'entrée pour l\'instant.</p>'}
      ${autres.length ? `<details class="plus-tard"><summary>Usure normale ou identique à l'entrée (${autres.length})</summary><ul class="mini-liste">${autres.map(({ piece: p, x, diff }) => `<li><span>${esc(p.nom)} · ${esc(x.nom)}${diff === 'usure' ? ` <span class="mention">${esc(ETAT[x.entree.etat].nom)} → ${esc(ETAT[x.sortie.etat].nom)}</span>` : ''}</span>${pastilleEtat(x.sortie.etat, true)}</li>`).join('')}</ul></details>` : ''}
      <h2 class="titre-section">Vétusté et retenues <span>${d.grille.length ? `grille convenue : ${pluriel(d.grille.length, 'ligne')}` : 'aucune grille saisie : le coût entier est proposé'}</span></h2>
      ${tableau}
      ${conf}
      ${manquantesTexte(d, manquantes)}
      ${compteurs.length ? `<h2 class="titre-section">Consommations pendant le bail</h2><ul class="faits">${compteurs.map((c) => `<li>${esc(c.nom)} : <b>${N(R.consommation(c), 3)} ${esc(c.unite)}</b></li>`).join('')}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }
  const manquantesTexte = (d, n) => (n ? `<p class="cd-alerte" style="margin-top:16px">${pluriel(n, 'clé ou accès non rendu', 'clés ou accès non rendus')} : ${d.cles.filter((c) => R.clesManquantes(c)).map((c) => `${esc(c.nom)} (${N(R.clesManquantes(c))})`).join(', ')}.</p>` : '');

  // ---------- Document ----------
  function vueDocument() {
    const d = dossier();
    if (!d) return sansDossier('Document');
    const type = sel.doc;
    const phases = type === 'complet' ? ['entree', 'sortie'] : [type];
    const titres = { entree: 'État des lieux d\'entrée', sortie: 'État des lieux de sortie', complet: 'État des lieux d\'entrée et de sortie' };
    const tete = teteDossier(d, 'Document à signer', `<label class="champ choix-dossier"><span class="sr-only">Type de document</span><select id="choix-doc">${Object.entries(titres).map(([k, n]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn" data-action="csv">Exporter (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button>`);
    const manque = phases.flatMap((ph) => R.manques(d, ph).map((m) => (phases.length > 1 ? `${PHASES[ph]} : ${m}` : m)));
    const aide = manque.length ? `<div class="aide manques"><b>À compléter avant d'imprimer</b> (repères tirés du contenu minimal indiqué sur service-public.gouv.fr) :<ul>${manque.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : '<p class="aide">Toutes les rubriques sont renseignées. Relis le document avec l\'autre partie avant de le signer.</p>';
    const etatTxt = (c) => (c.etat ? `<b>${esc(ETAT[c.etat].nom)}</b>${c.com ? `<br>${escBr(c.com)}` : ''}` : '<span class="manque">non constaté</span>');
    const partie = (titre, p) => (p.nom || p.adresse ? `<div><span class="surtitre">${titre}</span><b>${esc(p.nom || '')}</b>${p.adresse ? `<span>${escBr(p.adresse)}</span>` : ''}</div>` : '');
    const infos = `<div class="doc-infos">
      <div><span class="surtitre">Logement</span><b>${escBr(d.logement.adresse || 'Adresse à renseigner')}</b><span>${esc([d.logement.complement, `location ${d.logement.type === 'meuble' ? 'meublée' : 'vide'}`, d.logement.surface ? `${N(d.logement.surface, 1)} m²` : ''].filter(Boolean).join(' · '))}</span></div>
      ${partie('Bailleur', d.bailleur) || '<div><span class="surtitre">Bailleur</span><span class="manque">à renseigner</span></div>'}
      ${partie('Mandataire (représentant du bailleur)', d.mandataire)}
      <div><span class="surtitre">Locataire${/ et |,/.test(d.locataires) ? 's' : ''}</span><b>${esc(d.locataires || '')}</b>${!d.locataires ? '<span class="manque">à renseigner</span>' : ''}${phases.includes('sortie') && d.sortie.adresse ? `<span>Nouvelle adresse : ${escBr(d.sortie.adresse)}</span>` : ''}</div>
      <div><span class="surtitre">Bail et dates</span><span>${d.bail.debut ? `Bail du ${esc(dateLongue(d.bail.debut))}${d.bail.fin ? ` au ${esc(dateLongue(d.bail.fin))}` : ''}` : 'Dates du bail à renseigner'}</span>${phases.map((ph) => `<span>État des lieux ${ph === 'entree' ? 'd\'entrée' : 'de sortie'} : <b>${d[ph].date ? esc(dateLongue(d[ph].date)) : '…'}</b></span>`).join('')}${type === 'sortie' && d.entree.date ? '' : ''}</div>
    </div>`;
    const nbCols = phases.length;
    const tete2 = phases.map((ph) => `<th>${ph === 'entree' ? 'À l\'entrée du locataire' : 'À la sortie du locataire'}</th>`).join('');
    const piecesDoc = d.pieces.map((p) => {
      const photos = p.elements.flatMap((x) => phases.filter((ph) => x[ph].photo).map((ph) => `<figure><img src="${x[ph].photo}" alt="${esc(x.nom)}, ${ph === 'entree' ? 'entrée' : 'sortie'}"><figcaption>${esc(x.nom)} · ${ph === 'entree' ? 'entrée' : 'sortie'}</figcaption></figure>`));
      return `<section class="doc-piece"><h3>${esc(p.nom)}</h3><div class="defile"><table class="tableau doc-table"><thead><tr><th>Élément</th>${tete2}</tr></thead><tbody>${p.elements.map((x) => `<tr class="${nbCols > 1 && R.difference(x) === 'degrade' ? 'doc-degrade' : ''}"><td><b>${esc(x.nom)}</b><br><small>${esc(CAT[x.cat] || '')}</small></td>${phases.map((ph) => `<td>${etatTxt(x[ph])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${nbCols + 1}">Aucun élément.</td></tr>`}</tbody></table></div>${photos.length ? `<div class="doc-photos">${photos.join('')}</div>` : ''}</section>`;
    }).join('');
    const compteurs = d.compteurs.length ? `<div class="defile"><table class="tableau doc-table"><thead><tr><th>Compteur</th><th class="tel-masque">Numéro</th>${phases.map((ph) => `<th class="nb">Relevé ${ph === 'entree' ? 'd\'entrée' : 'de sortie'}</th>`).join('')}</tr></thead><tbody>${d.compteurs.map((c) => `<tr><td>${esc(c.nom)}${c.unite ? ` (${esc(c.unite)})` : ''}</td><td class="tel-masque">${esc(c.numero)}</td>${phases.map((ph) => `<td class="nb">${c[ph] === null ? '' : N(c[ph], 3)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>Aucun compteur individuel (charges au forfait ou compteurs collectifs).</p>';
    const cles = d.cles.length ? `<div class="defile"><table class="tableau doc-table"><thead><tr><th>Clés et moyens d'accès</th>${phases.map((ph) => `<th class="nb">${ph === 'entree' ? 'Remis' : 'Rendus'}</th>`).join('')}</tr></thead><tbody>${d.cles.map((c) => `<tr><td>${esc(c.nom)}${c.com ? `<br><small>${esc(c.com)}</small>` : ''}</td>${phases.map((ph) => `<td class="nb">${c[ph] === null ? '' : N(c[ph])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="manque">Clés à renseigner.</p>';
    const obs = phases.map((ph) => (d[ph].observations ? `<p><b>Observations ${ph === 'entree' ? 'à l\'entrée' : 'à la sortie'} :</b> ${escBr(d[ph].observations)}</p>` : '')).join('');
    const signatures = phases.map((ph) => `<div class="doc-signatures"><h3>${ph === 'entree' ? 'Entrée' : 'Sortie'} · fait à ${esc(d[ph].lieu || '……………………')}, le ${d[ph].date ? esc(dateLongue(d[ph].date)) : '……………………'}, en autant d'exemplaires que de parties</h3><div class="cases-signature"><div><span>Le bailleur ou son mandataire</span><small>${esc(d.mandataire.nom || d.bailleur.nom || '')}</small></div><div><span>Le ou les locataires</span><small>${esc(d.locataires || '')}</small></div></div></div>`).join('');
    const legende = `<p class="doc-legende"><b>États :</b> ${B.etats.map((s) => `${esc(s.nom)} (${esc(s.aide.replace(/\.$/, '').toLowerCase())})`).join(' ; ')}.</p>`;
    const vet = phases.includes('sortie') && d.grille.length ? `<p class="doc-legende"><b>Grille de vétusté convenue :</b> ${d.grille.map((l) => `${esc(l.nom)} (franchise ${N(l.franchise, 1)} an${l.franchise > 1 ? 's' : ''}, abattement ${N(l.abattement, 1)} % par an, part résiduelle ${N(l.residuel, 1)} %)`).join(' ; ')}.</p>` : '';
    return `${tete}${aide}
      <article class="doc-feuille">
        <header class="doc-titre"><div><h2>${titres[type]}</h2><span>Logement loué à usage de résidence principale · document contradictoire établi en présence des parties</span></div><div class="doc-marque">${SYMBOLE}</div></header>
        ${infos}
        <h3 class="doc-h">Relevés des compteurs</h3>${compteurs}
        <h3 class="doc-h">Clés et moyens d'accès</h3>${cles}
        <h3 class="doc-h">Description pièce par pièce</h3>${legende}${piecesDoc || '<p class="manque">Aucune pièce.</p>'}
        ${obs ? `<h3 class="doc-h">Observations et réserves</h3>${obs}` : ''}
        ${vet}
        ${signatures}
        <p class="doc-pied">Document établi le ${esc(dateLongue(auj()))} avec l'outil État des lieux QME, à partir des constats saisis par les parties. Il ne remplace pas un constat de commissaire de justice. Chaque page est à parapher par les parties.</p>
      </article>${AVERTISSEMENT}`;
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
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea')?.focus();
  }
  const PIED = (suppr, libelle = 'Supprimer') => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? `<button class="btn danger gauche" value="supprimer">${libelle}</button>` : ''}`;
  const d2 = (f) => setTimeout(f, 30);

  function modifier(fn, message) {
    retenir();
    E = fn(E) || E;
    sauver(); rendre();
    if (message) toast(message, { libelle: 'Annuler', faire: annuler });
  }
  const lireNombre = (v) => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); return s === '' ? '' : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
  const valNb = (v, dec = 2) => (v === null || v === undefined ? '' : N(v, dec).replace(/\s/g, ''));

  // Dossier : logement, parties, bail. Nouveau : avec le choix du modèle de logement.
  function modaleDossier(id) {
    const d = id ? E.dossiers.find((x) => x.id === id) : null;
    const v = d || R.normaliserDossier({});
    const corps = `
      <fieldset class="cadre-champs"><legend>Logement</legend>
        <label class="champ">Adresse<textarea name="adresse" rows="2" maxlength="200" placeholder="12 rue de l'Exemple&#10;00000 Ville">${esc(v.logement.adresse)}</textarea></label>
        <div class="rang-champs"><label class="champ">Complément <small>étage, porte, lot</small><input name="complement" value="${esc(v.logement.complement)}" maxlength="120"></label><label class="champ">Surface habitable <small>m², facultatif</small><input name="surface" inputmode="decimal" value="${valNb(v.logement.surface, 1)}" maxlength="8"></label></div>
        <div class="choix-statut deux" style="margin-top:12px">${[['nu', 'Location vide'], ['meuble', 'Location meublée']].map(([c, n]) => `<label><input type="radio" name="type" value="${c}" ${v.logement.type === c ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        ${d ? '' : `<label class="champ" style="margin-top:12px">Pièces de départ<select name="modele">${B.modeles.map((m) => `<option value="${m.code}" ${m.code === 't2' ? 'selected' : ''}>${esc(m.nom)} : ${esc(m.aide)}</option>`).join('')}</select></label>`}
      </fieldset>
      <fieldset class="cadre-champs"><legend>Parties</legend>
        <label class="champ">Locataire(s)<input name="locataires" value="${esc(v.locataires)}" maxlength="160" placeholder="Prénom Nom et Prénom Nom"></label>
        <div class="rang-champs"><label class="champ">Bailleur<input name="bailleur-nom" value="${esc(v.bailleur.nom)}" maxlength="100" placeholder="Nom ou dénomination"></label><label class="champ">Domicile du bailleur<textarea name="bailleur-adresse" rows="2" maxlength="200">${esc(v.bailleur.adresse)}</textarea></label></div>
        <details class="champs-aide" ${v.mandataire.nom ? 'open' : ''}><summary>Mandataire (agence, notaire) qui représente le bailleur</summary><div class="rang-champs"><label class="champ">Nom<input name="mandataire-nom" value="${esc(v.mandataire.nom)}" maxlength="100"></label><label class="champ">Domicile ou siège<textarea name="mandataire-adresse" rows="2" maxlength="200">${esc(v.mandataire.adresse)}</textarea></label></div></details>
      </fieldset>
      <fieldset class="cadre-champs"><legend>Bail</legend>
        <div class="rang-champs"><label class="champ">Début du bail<input type="date" name="debut" value="${v.bail.debut}"></label><label class="champ">Fin <small>si connue</small><input type="date" name="fin" value="${v.bail.fin}"></label></div>
        <div class="rang-champs" style="margin-top:12px"><label class="champ">Dépôt de garantie <small>€</small><input name="depot" inputmode="decimal" value="${valNb(v.bail.depot)}" maxlength="10"></label><label class="champ">Loyer hors charges <small>€, facultatif</small><input name="loyer" inputmode="decimal" value="${valNb(v.bail.loyer)}" maxlength="10"></label></div>
      </fieldset>
      ${d ? `<label class="case"><input type="checkbox" name="archive" ${d.archive ? 'checked' : ''}> Archiver ce dossier (il reste consultable, sous les dossiers en cours)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(d ? 'Logement, parties et bail' : 'Nouveau dossier', corps, PIED(!!d, 'Supprimer le dossier'), (fd, bouton) => {
      if (bouton === 'supprimer') {
        if (!confirm(`Supprimer le dossier « ${R.titreDossier(d)} » et toutes ses photos ?`)) return '';
        modifier((e) => { e.dossiers = e.dossiers.filter((x) => x.id !== d.id); return e; }, 'Dossier supprimé.');
        return undefined;
      }
      const adresse = String(fd.get('adresse') || '').trim();
      if (!adresse) return 'Indique l\'adresse du logement.';
      const nums = {};
      for (const [k, nom] of [['surface', 'La surface'], ['depot', 'Le dépôt de garantie'], ['loyer', 'Le loyer']]) {
        const n = lireNombre(fd.get(k));
        if (n === null || (n !== '' && n < 0)) return `${nom} est un nombre positif.`;
        nums[k] = n === '' ? null : n;
      }
      const debut = String(fd.get('debut') || ''), fin = String(fd.get('fin') || '');
      if (debut && fin && fin < debut) return 'La fin du bail est avant son début.';
      const champs = {
        logement: { adresse, complement: fd.get('complement'), type: fd.get('type'), surface: nums.surface },
        locataires: fd.get('locataires'), bailleur: { nom: fd.get('bailleur-nom'), adresse: fd.get('bailleur-adresse') }, mandataire: { nom: fd.get('mandataire-nom'), adresse: fd.get('mandataire-adresse') },
        bail: { debut, fin, depot: nums.depot, loyer: nums.loyer },
      };
      if (d) {
        const versMeuble = d.logement.type !== 'meuble' && champs.logement.type === 'meuble';
        modifier(() => {
          Object.assign(d, R.normaliserDossier({ ...d, ...champs, logement: { ...d.logement, ...champs.logement }, archive: fd.has('archive') }));
          return E;
        }, versMeuble ? 'Location meublée : ajoute le mobilier de chaque pièce (Pièce > « Ajouter les éléments types manquants »).' : 'Dossier enregistré.');
      } else {
        const n = creerDossier(champs, fd.get('modele'));
        modifier((e) => { e.dossiers.unshift(n); return e; }, 'Dossier créé.');
        sel.dossier = n.id; sel.phase = 'entree'; sauverPref();
        d2(() => changerVue('pieces'));
      }
      return undefined;
    });
  }

  // Nouveau locataire : nouveau dossier qui reprend le logement et l'état de sortie comme état d'entrée.
  function reprendre(id) {
    const d = E.dossiers.find((x) => x.id === id);
    if (!d) return;
    const n = R.reprendreDossier(d, auj());
    const sansPhotos = n.pieces.reduce((s, p) => s + p.elements.filter((x) => x.entree.photo).length, 0);
    if (sansPhotos && R.nbPhotos(E) + sansPhotos > E.reglages.photosMax) for (const p of n.pieces) for (const x of p.elements) x.entree.photo = '';
    modifier((e) => { e.dossiers.unshift(n); if (!d.archive && R.statut(d) === 'sortie-faite') d.archive = true; return e; }, 'Dossier du nouveau locataire créé : l\'état d\'entrée reprend l\'état de sortie. Vérifie chaque élément le jour de l\'entrée.');
    sel.dossier = n.id; sel.phase = 'entree'; sauverPref();
    d2(() => { changerVue('dossiers'); modaleDossier(n.id); });
  }

  // Date, lieu et observations d'une phase ; nouvelle adresse du locataire à la sortie.
  function modalePhase() {
    const d = dossier();
    const ph = sel.phase;
    const p = d[ph];
    const rect = ph === 'entree' ? R.rectification(d, E.reglages, auj()) : null;
    const corps = `
      <div class="rang-champs"><label class="champ">Date de l'état des lieux${ph === 'sortie' ? ' <small>jour de la remise des clés</small>' : ''}<input type="date" name="date" value="${p.date}"></label><label class="champ">Fait à <small>ville, pour les signatures</small><input name="lieu" value="${esc(p.lieu)}" maxlength="80"></label></div>
      ${ph === 'sortie' ? `<label class="champ">Nouvelle adresse du locataire<textarea name="adresse" rows="2" maxlength="200">${esc(p.adresse)}</textarea></label>` : ''}
      <label class="champ">Observations et réserves <small>générales, figurent sur le document</small><textarea name="observations" rows="4" maxlength="1200">${esc(p.observations)}</textarea></label>
      ${ph === 'entree' ? `<p class="aide">Le locataire peut demander à compléter l'état des lieux d'entrée dans les ${N(E.reglages.rectificationJours)} jours qui suivent${rect ? ` (jusqu'au ${esc(dateLongue(rect.limite))})` : ''}, et pendant le premier mois de la période de chauffe pour les éléments de chauffage (service-public.gouv.fr, fiche F31270, consultée le 14/11/2026).</p>` : '<p class="aide">Le délai de restitution du dépôt de garantie court à partir de la remise des clés : 1 mois si la sortie est conforme à l\'entrée, 2 mois sinon (fiche F31269, consultée le 14/11/2026).</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(ph === 'entree' ? 'Entrée : date et observations' : 'Sortie : date, adresse, observations', corps, PIED(false), (fd) => {
      const date = String(fd.get('date') || '');
      if (ph === 'sortie' && date && d.entree.date && date < d.entree.date) return 'La sortie est avant l\'entrée.';
      modifier(() => { Object.assign(d[ph], { date, lieu: String(fd.get('lieu') || '').trim(), observations: String(fd.get('observations') || '').trim(), ...(ph === 'sortie' ? { adresse: String(fd.get('adresse') || '').trim() } : {}) }); d[ph] = R.normaliserDossier(d)[ph]; return E; }, `${PHASES[ph]} enregistrée.`);
      return undefined;
    });
  }

  // Pièce : nouvelle (type, nom, éléments types) ou modification (nom, type, suppression).
  function modalePiece(id) {
    const d = dossier();
    const p = id ? piece(d, id) : null;
    const meuble = d.logement.type === 'meuble';
    const corps = `
      <div class="rang-champs"><label class="champ">Type de pièce<select name="type">${B.pieces.map((t) => `<option value="${t.code}" ${(p?.type || 'chambre') === t.code ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Nom <small>tel qu'il figure sur le document</small><input name="nom" value="${esc(p?.nom || '')}" maxlength="60" placeholder="par exemple Chambre 2"></label></div>
      ${p ? `<p class="mention">${pluriel(p.elements.length, 'élément')} · touche un élément dans la liste pour le renommer ou le retirer.</p><label class="case"><input type="checkbox" name="completer"> Ajouter les éléments types manquants de ce type de pièce${meuble ? ' (mobilier compris)' : ''}</label>` : `<label class="case"><input type="checkbox" name="types" checked> Ajouter les éléments types${meuble ? ' et le mobilier (location meublée)' : ''}</label>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Pièce' : 'Nouvelle pièce', corps, PIED(!!p, 'Supprimer la pièce'), (fd, bouton) => {
      if (bouton === 'supprimer') {
        const ph = p.elements.filter((x) => x.entree.etat || x.sortie.etat).length;
        if (ph && !confirm(`Supprimer « ${p.nom} » et ses ${p.elements.length} éléments (dont ${ph} déjà constatés) ?`)) return '';
        modifier(() => { d.pieces = d.pieces.filter((x) => x.id !== p.id); return E; }, 'Pièce supprimée.');
        return undefined;
      }
      const type = String(fd.get('type'));
      const nom = String(fd.get('nom') || '').trim() || B.pieces.find((t) => t.code === type)?.nom;
      if (p) {
        modifier(() => {
          p.nom = nom; p.type = type;
          if (fd.has('completer')) { const noms = new Set(p.elements.map((x) => R.plat(x.nom))); p.elements.push(...R.elementsType(type, meuble, B).filter((x) => !noms.has(R.plat(x.nom)))); }
          return E;
        }, 'Pièce enregistrée.');
      } else {
        const n = fd.has('types') ? R.nouvellePiece(type, nom, meuble, B) : R.normaliserPiece({ type, nom, elements: [] });
        modifier(() => { d.pieces.push(n); return E; }, `${nom} ajoutée.`);
        d2(() => document.getElementById(`piece-${n.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      }
      return undefined;
    });
  }

  // Élément : nom, catégorie, constat de la phase (état, commentaire, photo), et à la sortie le coût de remise en
  // état, l'imputation au locataire et la vétusté (ligne de grille, date de pose).
  function modaleElement(pid, xid, phaseForcee) {
    const d = dossier();
    const p = piece(d, pid);
    if (!p) return;
    const x = xid ? p.elements.find((y) => y.id === xid) : null;
    const ph = phaseForcee || sel.phase;
    const c = x ? x[ph] : { etat: '', com: '', photo: '', cout: null, imputable: true };
    let photo = c.photo;
    const ref = ph === 'sortie' && x ? `<div class="ref-entree"><span class="surtitre">À l'entrée</span><div>${pastilleEtat(x.entree.etat, true)}${x.entree.com ? `<p>${esc(x.entree.com)}</p>` : ''}</div>${x.entree.photo ? `<img src="${x.entree.photo}" alt="${esc(x.nom)} à l'entrée">` : ''}</div>` : '';
    const grille = ph === 'sortie' ? `<fieldset class="cadre-champs"><legend>Remise en état et vétusté<small>Seulement si l'élément est moins bon qu'à l'entrée.</small></legend>
        <div class="rang-champs"><label class="champ">Coût de remise en état <small>€, devis ou facture</small><input name="cout" inputmode="decimal" value="${valNb(c.cout)}" maxlength="10"></label></div>
        <label class="case"><input type="checkbox" name="imputable" ${c.imputable !== false ? 'checked' : ''}> Imputable au locataire (dégradation, pas usure normale)</label>
        ${d.grille.length ? `<div class="rang-champs"><label class="champ">Ligne de la grille de vétusté<select name="grille"><option value="">Aucune (pas de vétusté)</option>${d.grille.map((l) => `<option value="${l.id}" ${x?.grille === l.id ? 'selected' : ''}>${esc(l.nom)}</option>`).join('')}</select></label><label class="champ">Posé ou refait en <small>année ou mois/année</small><input name="pose" value="${esc(R.poseTexte(x?.pose || ''))}" maxlength="10" placeholder="2019 ou 03/2019"></label></div>` : '<p class="mention">Pas de grille de vétusté dans ce dossier : le coût entier est proposé en retenue. Ajoute la grille convenue dans le bail depuis l\'onglet Comparaison.</p>'}
      </fieldset>` : '';
    const corps = `
      ${ref}
      <fieldset class="champ"><legend>État ${ph === 'entree' ? 'à l\'entrée' : 'à la sortie'}</legend>
        <div class="choix-etats">${B.etats.map((s) => `<label><input type="radio" name="etat" value="${s.code}" ${c.etat === s.code ? 'checked' : ''}><span class="e-${s.code}"><b>${esc(s.court)}</b>${esc(s.nom)}</span></label>`).join('')}<label><input type="radio" name="etat" value="" ${c.etat ? '' : 'checked'}><span class="e-vide"><b>–</b>À constater</span></label></div>
      </fieldset>
      <label class="champ">Commentaire <small>localisation, nature, dimensions, marque…</small><textarea name="com" rows="3" maxlength="400">${esc(c.com)}</textarea></label>
      <div class="champ"><span>Photo <small>une vignette par élément et par constat, réduite sur l'appareil</small></span>
        <div class="bloc-photo"><div id="apercu-photo">${photo ? `<img src="${photo}" alt="Photo de l'élément">` : '<span class="mention">Aucune photo.</span>'}</div>
        <div class="rang"><label class="btn petit" style="cursor:pointer">${ICONES.photo}${photo ? 'Remplacer' : 'Prendre ou choisir'}<input type="file" accept="image/*" capture="environment" id="fichier-photo" hidden></label><button type="button" class="btn petit" id="retirer-photo" ${photo ? '' : 'hidden'}>Retirer</button></div></div>
        <p class="mention" id="info-photo">${N(R.nbPhotos(E))} photo${R.nbPhotos(E) > 1 ? 's' : ''} sur ${N(E.reglages.photosMax)} sur ce compte. Garde aussi tes photos d'origine.</p>
      </div>
      ${grille}
      <details class="champs-aide" ${x ? '' : 'open'}><summary>Nom et catégorie de l'élément</summary><div class="rang-champs"><label class="champ">Nom<input name="nom" value="${esc(x?.nom || '')}" maxlength="80" placeholder="par exemple Placard"></label><label class="champ">Catégorie<select name="cat">${B.categories.map((k) => `<option value="${k.code}" ${(x?.cat || 'equipements') === k.code ? 'selected' : ''}>${esc(k.nom)}</option>`).join('')}</select></label></div></details>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? `${esc(p.nom)} · ${esc(x.nom)}` : `${esc(p.nom)} · nouvel élément`, corps, PIED(!!x, 'Retirer l\'élément'), (fd, bouton) => {
      if (bouton === 'supprimer') {
        modifier(() => { p.elements = p.elements.filter((y) => y.id !== x.id); return E; }, `${x.nom} retiré.`);
        return undefined;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'élément.';
      const champs = { etat: String(fd.get('etat') || ''), com: String(fd.get('com') || '').trim(), photo };
      let pose = '';
      if (ph === 'sortie') {
        const cout = lireNombre(fd.get('cout'));
        if (cout === null || (cout !== '' && cout < 0)) return 'Le coût de remise en état est un montant positif.';
        champs.cout = cout === '' ? null : cout;
        champs.imputable = fd.has('imputable');
        if (fd.has('pose')) { pose = R.lirePose(fd.get('pose')); if (pose === null) return 'Date de pose : une année (2019), un mois (03/2019) ou une date.'; }
      }
      modifier(() => {
        const cible = x || R.normaliserElement({ nom });
        cible.nom = nom; cible.cat = String(fd.get('cat') || cible.cat);
        Object.assign(cible[ph], champs);
        if (ph === 'sortie' && fd.has('grille')) { cible.grille = String(fd.get('grille') || ''); cible.pose = pose || ''; }
        if (!x) p.elements.push(cible);
        return E;
      }, x ? 'Élément enregistré.' : `${nom} ajouté.`);
      return undefined;
    });
    const majApercu = () => {
      $('#apercu-photo').innerHTML = photo ? `<img src="${photo}" alt="Photo de l'élément">` : '<span class="mention">Aucune photo.</span>';
      $('#retirer-photo').hidden = !photo;
    };
    $('#retirer-photo').addEventListener('click', () => { photo = ''; majApercu(); });
    $('#fichier-photo').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const err = modale().querySelector('.modale-corps > .erreur');
      const refus = placePhoto(!!c.photo);
      if (refus) { err.textContent = refus; return; }
      $('#info-photo').textContent = 'Réduction de la photo…';
      try { photo = await vignette(f); majApercu(); $('#info-photo').textContent = `Vignette prête (${N(Math.round(photo.length * 0.75 / 1000))} Ko). Enregistre pour la garder.`; err.textContent = ''; } catch (x2) { err.textContent = x2.message; $('#info-photo').textContent = ''; }
    });
  }

  // Changement rapide d'état depuis la liste (un toucher) ; retoucher l'état choisi l'efface.
  function changerEtat(pid, xid, etat) {
    const d = dossier();
    const x = element(d, pid, xid);
    if (!x) return;
    const ph = sel.phase;
    retenir();
    x[ph].etat = x[ph].etat === etat ? '' : etat;
    sauver();
    // Le rendu complet garde la position de défilement ; le focus revient sur le bouton touché (clavier).
    const avaitFocus = document.activeElement?.dataset?.x === xid;
    rendre();
    if (avaitFocus) document.querySelector(`.b-etat[data-x="${xid}"][data-etat="${etat}"]`)?.focus({ preventScroll: true });
  }

  // Remplit les éléments sans état d'une pièce : « bon état » à l'entrée, « comme à l'entrée » à la sortie.
  function remplir(pid) {
    const d = dossier();
    const p = piece(d, pid);
    const ph = sel.phase;
    let n = 0;
    modifier(() => {
      for (const x of p.elements) {
        if (x[ph].etat) continue;
        const v = ph === 'entree' ? 'bon' : x.entree.etat;
        if (v) { x[ph].etat = v; n++; }
      }
      return E;
    }, null);
    toast(n ? `${pluriel(n, 'élément')} de « ${p.nom} » ${ph === 'entree' ? 'en bon état' : 'comme à l\'entrée'} : corrige ceux qui diffèrent.` : 'Aucun élément à remplir (état d\'entrée manquant).', n ? { libelle: 'Annuler', faire: annuler } : undefined);
  }

  function deplacerPiece(id, sens) {
    const d = dossier();
    const i = d.pieces.findIndex((p) => p.id === id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= d.pieces.length) return;
    modifier(() => { [d.pieces[i], d.pieces[j]] = [d.pieces[j], d.pieces[i]]; return E; }, null);
    d2(() => document.querySelector(`[data-action="${sens < 0 ? 'piece-monter' : 'piece-descendre'}"][data-id="${id}"]`)?.focus({ preventScroll: false }));
  }

  function modaleCompteur(id) {
    const d = dossier();
    const c = id ? d.compteurs.find((x) => x.id === id) : null;
    const corps = `
      <div class="rang-champs"><label class="champ">Type<select name="type">${B.compteurs.map((t) => `<option value="${t.code}" ${(c?.type || 'eau-froide') === t.code ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Numéro du compteur <small>facultatif</small><input name="numero" value="${esc(c?.numero || '')}" maxlength="40"></label></div>
      <div class="rang-champs"><label class="champ">Relevé à l'entrée<input name="entree" inputmode="decimal" value="${valNb(c?.entree, 3)}" maxlength="14"></label><label class="champ">Relevé à la sortie<input name="sortie" inputmode="decimal" value="${valNb(c?.sortie, 3)}" maxlength="14"></label></div>
      <label class="champ">Remarque <small>compteur non branché, emplacement…</small><input name="com" value="${esc(c?.com || '')}" maxlength="200"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? esc(c.nom) : 'Nouveau compteur', corps, PIED(!!c), (fd, bouton) => {
      if (bouton === 'supprimer') { modifier(() => { d.compteurs = d.compteurs.filter((x) => x.id !== c.id); return E; }, 'Compteur retiré.'); return undefined; }
      const v = {};
      for (const k of ['entree', 'sortie']) { const n = lireNombre(fd.get(k)); if (n === null || (n !== '' && n < 0)) return 'Un relevé est un nombre positif (virgule acceptée).'; v[k] = n === '' ? null : n; }
      if (v.entree !== null && v.sortie !== null && v.sortie < v.entree && !confirm('Le relevé de sortie est plus petit que celui d\'entrée (compteur remplacé ?). Enregistrer quand même ?')) return '';
      const t = B.compteurs.find((x) => x.code === fd.get('type'));
      const n = R.normaliserCompteur({ ...(c || {}), type: t.code, nom: c && c.type === t.code ? c.nom : t.nom, unite: t.unite, numero: fd.get('numero'), com: fd.get('com'), ...v });
      modifier(() => { if (c) Object.assign(c, n); else d.compteurs.push(n); return E; }, 'Compteur enregistré.');
      return undefined;
    });
  }

  function modaleCle(id) {
    const d = dossier();
    const c = id ? d.cles.find((x) => x.id === id) : null;
    const corps = `
      <div class="rang-champs"><label class="champ">Type<select name="type">${B.cles.map((t) => `<option value="${t.code}" ${(c?.type || 'porte') === t.code ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Libellé <small>tel qu'il figure sur le document</small><input name="nom" value="${esc(c?.nom || '')}" maxlength="60" placeholder="par défaut, le type"></label></div>
      <div class="rang-champs"><label class="champ">Nombre remis à l'entrée<input name="entree" type="number" min="0" max="99" value="${c?.entree ?? ''}"></label><label class="champ">Nombre rendu à la sortie<input name="sortie" type="number" min="0" max="99" value="${c?.sortie ?? ''}"></label></div>
      <label class="champ">Remarque<input name="com" value="${esc(c?.com || '')}" maxlength="200"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? esc(c.nom) : 'Nouvelle clé ou accès', corps, PIED(!!c), (fd, bouton) => {
      if (bouton === 'supprimer') { modifier(() => { d.cles = d.cles.filter((x) => x.id !== c.id); return E; }, 'Accès retiré.'); return undefined; }
      const t = B.cles.find((x) => x.code === fd.get('type'));
      const v = {};
      for (const k of ['entree', 'sortie']) { const n = lireNombre(fd.get(k)); if (n === null || (n !== '' && (n < 0 || !Number.isInteger(n)))) return 'Un nombre de clés est un entier positif.'; v[k] = n === '' ? null : n; }
      const n = R.normaliserCle({ ...(c || {}), type: t.code, nom: String(fd.get('nom') || '').trim() || t.nom, com: fd.get('com'), ...v });
      modifier(() => { if (c) Object.assign(c, n); else d.cles.push(n); return E; }, 'Clés enregistrées.');
      return undefined;
    });
  }

  // Grille de vétusté convenue dans le bail : lignes saisies (aucune grille intégrée).
  function modaleGrille() {
    const d = dossier();
    const autres = E.dossiers.filter((x) => x.id !== d.id && x.grille.length);
    const lignes = d.grille.concat([{ id: '', nom: '', franchise: '', abattement: '', residuel: '' }]);
    const corps = `
      <p class="aide">Aucune grille n'est intégrée : saisis celle convenue dans le bail, si les parties en ont convenu une (décret n° 2016-382 du 30 mars 2016, rappelé par service-public.gouv.fr, fiche F33671, consultée le 14/11/2026). Pour chaque ligne : années sans abattement (franchise), pourcentage retiré par année au-delà, et part qui reste toujours à la charge du locataire.</p>
      <p class="mention">Calcul : vétusté = (âge − franchise) × abattement, plafonnée à 100 % − part résiduelle ; retenue proposée = coût de remise en état × (1 − vétusté). L'âge compte les années pleines entre la pose (ou la dernière rénovation) et la date de sortie.</p>
      <ul class="mini-liste lignes-grille">${lignes.map((l, i) => `<li><input type="hidden" name="g-id-${i}" value="${l.id}"><label class="champ"><span>Ligne</span><input name="g-nom-${i}" value="${esc(l.nom)}" maxlength="60" placeholder="${i === d.grille.length ? 'Nouvelle ligne : Peintures, Sols…' : ''}"></label><label class="champ"><span>Franchise <small>ans</small></span><input name="g-franchise-${i}" inputmode="decimal" value="${l.franchise === '' ? '' : valNb(l.franchise, 1)}" maxlength="4"></label><label class="champ"><span>Abattement <small>%/an</small></span><input name="g-abattement-${i}" inputmode="decimal" value="${l.abattement === '' ? '' : valNb(l.abattement, 1)}" maxlength="5"></label><label class="champ"><span>Résiduel <small>%</small></span><input name="g-residuel-${i}" inputmode="decimal" value="${l.residuel === '' ? '' : valNb(l.residuel, 1)}" maxlength="5"></label></li>`).join('')}</ul>
      <p class="mention">Vide le nom d'une ligne pour la retirer. Enregistre pour ajouter une autre ligne.</p>
      ${autres.length ? `<label class="champ">Ou reprendre la grille d'un autre dossier<select name="reprendre"><option value="">Non</option>${autres.map((x) => `<option value="${x.id}">${esc(R.titreDossier(x))} (${pluriel(x.grille.length, 'ligne')})</option>`).join('')}</select></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Grille de vétusté', corps, PIED(false), (fd) => {
      const rep = String(fd.get('reprendre') || '');
      if (rep) {
        const src = E.dossiers.find((x) => x.id === rep);
        modifier(() => { d.grille = src.grille.map((l) => ({ ...l })); return E; }, 'Grille reprise : associe chaque élément dégradé à sa ligne (et sa date de pose).');
        return undefined;
      }
      const g = [];
      for (let i = 0; fd.has(`g-nom-${i}`); i++) {
        const nom = String(fd.get(`g-nom-${i}`)).trim();
        if (!nom) continue;
        const v = {};
        for (const [k, max, lib] of [['franchise', 50, 'La franchise'], ['abattement', 100, 'L\'abattement'], ['residuel', 100, 'La part résiduelle']]) {
          const n = lireNombre(fd.get(`g-${k}-${i}`));
          if (n === null || (n !== '' && (n < 0 || n > max))) return `${lib} de « ${nom} » : un nombre entre 0 et ${max}.`;
          v[k] = n === '' ? 0 : n;
        }
        g.push(R.normaliserLigneGrille({ id: String(fd.get(`g-id-${i}`) || '') || undefined, nom, ...v }));
      }
      const ids = new Set(g.map((l) => l.id));
      modifier(() => { d.grille = g; for (const p of d.pieces) for (const x of p.elements) if (x.grille && !ids.has(x.grille)) x.grille = ''; return E; }, 'Grille de vétusté enregistrée.');
      return undefined;
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / TAILLE_MAX) * 100);
    const r = E.reglages;
    const photos = R.nbPhotos(E);
    const corps = `
      <div class="groupe"><h3>Délais rappelés</h3><p class="aide">${esc(B.sourceRegles)}</p>
        <div class="rang-champs"><label class="champ">Restitution, sortie conforme <small>mois</small><input name="restitutionConforme" type="number" min="0" max="12" value="${r.restitutionConforme}"></label><label class="champ">Sortie non conforme <small>mois</small><input name="restitutionNonConforme" type="number" min="0" max="12" value="${r.restitutionNonConforme}"></label><label class="champ">Rectification de l'entrée <small>jours</small><input name="rectificationJours" type="number" min="0" max="60" value="${r.rectificationJours}"></label></div>
        <ul class="sources">${B.sources.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul></div>
      <div class="groupe"><h3>Photos</h3><p class="aide">Chaque photo est réduite en vignette sur ton appareil (côté 480 px au plus, environ 15 Ko) puis enregistrée avec le dossier : elle te suit sur tous tes appareils et figure sur le document. L'original n'est pas gardé ici : conserve tes photos d'origine (elles font foi en cas de désaccord).</p>
        <div class="rang-champs"><label class="champ">Nombre de photos permis <small>sur ce compte, 60 au plus</small><input name="photosMax" type="number" min="0" max="60" value="${r.photosMax}"></label></div>
        <p class="mention">${N(photos)} photo${photos > 1 ? 's' : ''} enregistrée${photos > 1 ? 's' : ''}.</p></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Le dossier affiché en tableur (CSV, séparateur point-virgule) : éléments, états, différences, vétusté, retenues, compteurs et clés.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Dossier en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes dossiers sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie complète (photos comprises) sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${N(Math.round(t / 1000))} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte une copie, puis supprime les dossiers terminés ou des photos.' : '.'}</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute l'état des lieux à ton écran d'accueil pour le remplir pièce par pièce le jour de la visite, photos comprises.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les noms, adresses et photos que tu saisis sont enregistrés en ligne, liés à ta clé, et ne sont ni lus ni partagés par QME. Ne photographie ni personnes ni papiers d'identité ; informe le locataire que l'état des lieux est tenu avec cet outil. Supprime les dossiers dont tu n'as plus besoin.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Outil d'aide : il ne remplace ni le bail, ni un constat de commissaire de justice, ni un conseil juridique. Aucune grille de vétusté intégrée. Pièces et éléments types proposés par QME, tous modifiables.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const v = {};
      for (const [k, max] of [['restitutionConforme', 12], ['restitutionNonConforme', 12], ['rectificationJours', 60], ['photosMax', 60]]) {
        const n = lireNombre(fd.get(k));
        if (n === null || n === '' || n < 0 || n > max || !Number.isInteger(n)) return 'Délais et nombre de photos : des nombres entiers positifs.';
        v[k] = n;
      }
      modifier((e) => { e.reglages = R.normaliserReglages(v, B); return e; }, 'Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.dossiers)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.dossiers.length, 'dossier')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide d\'État des lieux.'); }
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
  const CSV = 'text/csv;charset=utf-8';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `etat-des-lieux-${auj()}.json`);
  const nomFichier = (d) => R.plat(R.titreDossier(d)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'dossier';

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
      <p>Enregistre l'état des lieux sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Pratique le jour de la visite, pièce par pièce.</p>
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
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4500);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const fermerPuis = (f) => { if (modale().open) { modale().close(); d2(f); } else f(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); sel.dossier = E.dossiers[0].id; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': fermerPuis(() => modaleEcranAccueil()); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': { const d = dossier(); if (d) telecharger(R.csvDossier(d, B), CSV, `etat-des-lieux-${nomFichier(d)}-${auj()}.csv`); break; }
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'dossier-nouveau': fermerPuis(() => modaleDossier(null)); break;
      case 'dossier': modaleDossier(id); break;
      case 'dossier-ouvrir': sel.dossier = id; sauverPref(); changerVue(R.statut(E.dossiers.find((x) => x.id === id)) === 'sortie-faite' ? 'comparaison' : 'pieces'); break;
      case 'dossier-reprendre': if (confirm('Créer le dossier du prochain locataire ? L\'état d\'entrée reprendra l\'état constaté à la sortie (à vérifier le jour de l\'entrée).')) reprendre(id); break;
      case 'phase': sel.phase = el.dataset.phase; sauverPref(); rendre(); break;
      case 'phase-infos': modalePhase(); break;
      case 'aller-sortie': sel.phase = 'sortie'; sauverPref(); changerVue('pieces'); break;
      case 'piece': modalePiece(id || null); break;
      case 'piece-monter': deplacerPiece(id, -1); break;
      case 'piece-descendre': deplacerPiece(id, 1); break;
      case 'remplir': remplir(id); break;
      case 'etat': changerEtat(el.dataset.p, el.dataset.x, el.dataset.etat); break;
      case 'element': modaleElement(el.dataset.p, el.dataset.x || null); break;
      case 'element-sortie': modaleElement(el.dataset.p, el.dataset.x, 'sortie'); break;
      case 'compteur': modaleCompteur(id || null); break;
      case 'cle': modaleCle(id || null); break;
      case 'grille': modaleGrille(); break;
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
  window.__etd = { etat: () => E, regles: R };
  init();
})();
