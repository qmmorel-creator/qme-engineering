// Registre des non-conformités QME : constat, analyse des causes, actions, vérification, indicateurs.
// Données synchronisées par clé de licence ou code d'accès (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'NCF';
  const CLE_CODE = 'qme-ncf-code';
  const CLE_CACHE = 'qme-ncf-cache';
  const CLE_DEMO = 'qme-ncf-demo';
  const CODE_DEMO = 'DEMO';
  const NOM = 'Registre des non-conformités';

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
  const { iso, ajout, ecart, versDate } = R;
  const auj = () => iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const fmtAn = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return versDate(s).getFullYear() === new Date().getFullYear() ? fmt(s) : fmtAn(s);
  };
  const euros = (n) => `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;

  const gravite = (id) => B.gravites.find((g) => g.id === Number(id)) || B.gravites[1];
  const typeDe = (id) => B.types.find((t) => t.id === id);
  const causeDe = (id) => B.causes.find((c) => c.id === id);
  const decisionDe = (id) => B.decisions.find((d) => d.id === id);
  const origineDe = (id) => B.origines.find((o) => o.id === id);

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code NCF) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'registre';
  let ncOuverte = null;
  let filtres = { etape: 'ouvertes', gravite: '', type: '', zone: '', texte: '' };
  let periode = '12';
  let filtreResp = '';
  let annulation = null;

  const reglagesVides = () => ({ libelleZone: 'Lot', libelleLieu: 'Chantier', zones: [], delais: { 1: 30, 2: 15, 3: 7, 4: 2 }, delaiVerif: B.delaiVerification });
  const etatVide = () => ({ version: 1, entreprise: '', profil: null, reglages: reglagesVides(), ncs: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const reg = { ...v.reglages, ...(d.reglages || {}) };
    reg.delais = { ...v.reglages.delais, ...((d.reglages || {}).delais || {}) };
    if (!Array.isArray(reg.zones)) reg.zones = [];
    const ncs = (Array.isArray(d.ncs) ? d.ncs : []).filter((n) => n && n.id && n.date).map((n) => ({
      titre: '', description: '', lieu: '', zone: '', type: 'execution', gravite: 2, origine: 'interne', detectePar: '', quantite: '', photo: '', decision: '', traitement: '', cout: null, echeance: null,
      verifPrevue: null, cloture: null, ...n,
      gravite: Number(n.gravite) || 2,
      analyse: { pourquoi: [], racine: '', cause: '', ...(n.analyse || {}) },
      actions: Array.isArray(n.actions) ? n.actions : [],
      verifications: Array.isArray(n.verifications) ? n.verifications : [],
    }));
    return { ...v, ...d, reglages: reg, ncs };
  };
  const nc = (id) => E.ncs.find((n) => n.id === id);
  const reg = () => E.reglages;

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
        toast('Un autre appareil a modifié le registre entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code NCF-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('NCF')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('NCF') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    document.body.classList.remove('app');
    history.replaceState(null, '', location.pathname);
    ecranConnexion(message);
  }

  // ---------- Démo : PME du bâtiment fictive, un an d'historique relatif à aujourd'hui ----------
  function donneesDemo() {
    const d = etatVide();
    const t = auj();
    const p = B.profils[0];
    Object.assign(d, { entreprise: 'Entreprise exemple (fictive)', profil: 'btp' });
    Object.assign(d.reglages, { libelleZone: p.zone, libelleLieu: p.lieu, zones: [...p.zones] });
    const CH = ['Chantier A · groupe scolaire', 'Chantier B · 24 logements', 'Chantier C · extension d\'atelier', 'Dépôt'];
    // [jours avant, titre, type, gravité, lot, chantier, origine, cause, pourquoi, scénario, coût]
    const liste = [
      [340, 'Aplomb de voile hors tolérance au R+1', 'dimension', 2, 'Gros œuvre', 1, 'autocontrole', 'materiel', ['Le voile penche de 18 mm sur 2,70 m.', 'Une banche a bougé pendant le coulage.', 'Un étai tire-pousse était mal serré.', 'Aucune vérification des étais avant coulage.'], 'close:19', 900],
      [318, 'Isolant livré d\'une autre résistance thermique', 'materiau', 3, 'Plâtrerie et cloisons', 0, 'fournisseur', 'matiere', ['La référence livrée diffère de la commande.', 'Le bon de livraison n\'a pas été comparé à la commande.', 'Pas de contrôle à réception prévu pour l\'isolant.'], 'close:9', 450],
      [297, 'Joints de carrelage irréguliers en salle d\'eau', 'aspect', 1, 'Revêtements de sols', 1, 'interne', 'maindoeuvre', ['Croisillons de deux tailles utilisés.', 'Deux équipes sur la même pièce sans consigne commune.'], 'close:24', 0],
      [271, 'Plan d\'exécution périmé affiché au bungalow', 'documentaire', 2, 'Gros œuvre', 0, 'audit', 'methode', ['Le nouvel indice est arrivé par e-mail.', 'Personne n\'est chargé de mettre à jour l\'affichage.', 'Circuit de diffusion des plans non défini.'], 'close:12', 0],
      [244, 'Garde-corps provisoire retiré sans remplacement', 'securite', 4, 'Charpente', 2, 'interne', 'methode', ['Retiré pour lever une ferme.', 'Le mode opératoire de levage ne prévoit pas la remise en place.', 'Mode opératoire rédigé sans le chef d\'équipe.'], 'close:3', 0],
      [221, 'Réservation de gaine oubliée dans un voile', 'execution', 3, 'Gros œuvre', 1, 'autocontrole', 'methode', ['La réservation n\'était pas dans le coffrage.', 'Plan de l\'indice précédent utilisé.', 'Le nouvel indice n\'a pas été imprimé pour le chantier.'], 'close-inefficace:41', 2400],
      [196, 'Menuiseries livrées 2 cm plus étroites', 'fournisseur', 3, 'Menuiseries extérieures', 1, 'fournisseur', 'mesure', ['Les cotes de commande sont celles des plans, pas des baies réelles.', 'Pas de relevé de cotes avant commande.'], 'close:16', 1800],
      [170, 'Pente d\'évacuation inversée en terrasse', 'execution', 3, 'Couverture et étanchéité', 2, 'interne', 'mesure', ['Le support n\'avait pas la pente prévue.', 'Pente non contrôlée avant pose.', 'Aucun point d\'arrêt entre gros œuvre et étanchéité.'], 'close:21', 3200],
      [142, 'Gaines électriques non repérées', 'documentaire', 1, 'Électricité', 0, 'soustraitant', 'methode', ['Repérage prévu en fin de lot.', 'Le cahier des charges du sous-traitant ne fixe pas le moment.'], 'close:28', 0],
      [118, 'Fissure sur dalle de compression', 'execution', 2, 'Gros œuvre', 1, 'interne', 'milieu', ['Le béton a séché trop vite.', 'Coulage par forte chaleur sans cure.', 'Pas de consigne de cure par temps chaud.'], 'close:14', 650],
      [96, 'Laser de chantier déréglé', 'equipement', 2, 'Plâtrerie et cloisons', 0, 'autocontrole', 'materiel', ['Écart de 6 mm constaté sur rails.', 'Laser tombé la semaine précédente.', 'Pas de vérification du laser après une chute.'], 'close:79', 300],
      [74, 'Peinture : reprises visibles en lumière rasante', 'aspect', 1, 'Peinture', 1, 'client', 'maindoeuvre', ['Reprises faites au rouleau sec.', 'Consigne de reprise absente.'], 'close:68', 400],
      [58, 'Traitement de fissure non fait par le sous-traitant', 'soustraitance', 2, 'Revêtements de sols', 2, 'interne', 'methode', ['Le sous-traitant n\'a pas reçu la réserve.', 'Réserves transmises oralement.'], 'verif:20', 0],
      [44, 'Infiltration au pied d\'une menuiserie', 'client', 3, 'Menuiseries extérieures', 1, 'client', 'methode', ['La bavette n\'est pas raccordée à l\'étanchéité.', 'Ordre de pose inversé entre deux lots.'], 'reanalyse', 1100],
      [35, 'Enrobage d\'armatures insuffisant en rive', 'execution', 3, 'Gros œuvre', 2, 'autocontrole', 'materiel', ['Les cales d\'enrobage se sont écrasées.', 'Cales en plastique trop petites pour les barres.'], 'actions-retard', 1500],
      [26, 'Bloc-porte coupe-feu sans étiquette de classement', 'materiau', 3, 'Menuiseries intérieures', 0, 'interne', 'matiere', ['Étiquette absente à la livraison.', 'Contrôle à réception sans liste des marquages attendus.'], 'verif-due', 0],
      [17, 'Tri des déchets non respecté sur la benne bois', 'securite', 1, 'Gros œuvre', 1, 'audit', 'milieu', [], 'actions', 0],
      [11, 'Cloison décalée de 4 cm par rapport au plan', 'dimension', 2, 'Plâtrerie et cloisons', 1, 'autocontrole', 'mesure', ['Traçage fait depuis un axe non vérifié.'], 'actions', 600],
      [6, 'Autocontrôle de ferraillage non signé', 'documentaire', 2, 'Gros œuvre', 2, 'audit', '', [], 'analyse', 0],
      [2, 'Lot de parpaings épaufrés à la livraison', 'fournisseur', 1, 'Gros œuvre', 3, 'fournisseur', '', [], 'analyse', 0],
      [0, 'Absence de calfeutrement autour d\'un fourreau', 'execution', 3, 'Plomberie et CVC', 0, 'interne', '', [], 'analyse', 0],
    ];
    const resp = { 'Gros œuvre': 'Chef de chantier gros œuvre', 'Plâtrerie et cloisons': 'Chef d\'équipe plâtrerie', 'Menuiseries extérieures': 'Conducteur de travaux', 'Couverture et étanchéité': 'Conducteur de travaux' };
    const decisions = { dimension: 'reprise', materiau: 'retour', aspect: 'reprise', documentaire: 'aucune', securite: 'aucune', execution: 'reprise', fournisseur: 'retour', equipement: 'tri', soustraitance: 'reprise', client: 'reparation' };
    liste.forEach(([j, titre, type, g, zone, ch, origine, cause, pq, scenario, cout]) => {
      const date = ajout(t, -j);
      const n = {
        id: uid(), numero: R.numeroSuivant(d.ncs, date), date, titre, description: `${titre}. Constat fait lors du passage sur zone ; écart photographié.`, lieu: CH[ch], zone, type, gravite: g, origine,
        detectePar: origine === 'client' ? 'Maître d\'ouvrage' : origine === 'audit' ? 'Responsable qualité' : 'Conducteur de travaux', quantite: '', photo: pq.length ? `Photo ${1000 + j}, dossier ${CH[ch].split(' · ')[0]}` : '',
        decision: decisions[type] || 'reprise', traitement: g >= 3 ? 'Zone balisée, travaux arrêtés sur la partie concernée en attendant la décision.' : '', cout: cout || null, echeance: null,
        analyse: { pourquoi: pq, racine: pq.length > 1 ? pq[pq.length - 1] : '', cause }, actions: [], verifications: [], verifPrevue: null, cloture: null,
      };
      const qui = resp[zone] || 'Conducteur de travaux';
      const [sc, arg] = scenario.split(':');
      const act = (nature, quoi, ech, faite = null, r = qui) => n.actions.push({ id: uid(), nature, quoi, responsable: r, echeance: ech, faite });
      if (sc === 'close' || sc === 'close-inefficace') {
        const fin = ajout(date, Number(arg));
        const mi = ajout(date, Math.max(1, Math.round(Number(arg) / 3)));
        act('corrective', 'Reprendre l\'ouvrage et contrôler la reprise', mi, mi);
        act('preventive', 'Ajouter le point à l\'autocontrôle du lot', ajout(mi, 3), ajout(mi, 2), 'Responsable qualité');
        if (sc === 'close-inefficace') {
          R.verifier(n, { date: ajout(mi, 10), efficace: false, commentaire: 'Le même écart est réapparu sur un autre niveau.', par: 'Responsable qualité' });
          act('preventive', 'Afficher la liste des plans en vigueur, mise à jour à chaque indice', ajout(mi, 15), ajout(mi, 14), 'Conducteur de travaux');
        }
        R.verifier(n, { date: fin, efficace: true, commentaire: 'Contrôle sur les ouvrages suivants : aucun nouvel écart.', par: 'Responsable qualité' });
      } else if (sc === 'verif') {
        act('corrective', 'Faire réaliser le traitement de fissure', ajout(date, 10), ajout(date, 9));
        act('preventive', 'Transmettre les réserves par écrit, avec accusé de lecture', ajout(date, 14), ajout(date, 12), 'Conducteur de travaux');
        n.verifPrevue = ajout(t, 5);
      } else if (sc === 'verif-due') {
        act('corrective', 'Obtenir le certificat et l\'étiquette du fabricant', ajout(date, 7), ajout(date, 5), 'Acheteur');
        act('preventive', 'Liste des marquages à contrôler à réception', ajout(date, 10), ajout(date, 8), 'Responsable qualité');
        n.verifPrevue = ajout(t, -3);
      } else if (sc === 'reanalyse') {
        act('corrective', 'Reprendre le raccord de la bavette', ajout(date, 5), ajout(date, 4), 'Conducteur de travaux');
        R.verifier(n, { date: ajout(date, 25), efficace: false, commentaire: 'Nouvelle trace d\'humidité après forte pluie : la cause n\'était pas la bonne.', par: 'Responsable qualité' });
      } else if (sc === 'actions-retard') {
        act('corrective', 'Repiquer et ragréer les zones à faible enrobage', ajout(date, 14), ajout(date, 13));
        act('preventive', 'Commander des cales adaptées aux diamètres utilisés', ajout(t, -4), null, 'Acheteur');
      } else if (sc === 'actions') {
        act('corrective', type === 'securite' ? 'Rappel des consignes de tri au quart d\'heure sécurité' : 'Démonter et reposer la cloison à la cote', ajout(t, type === 'securite' ? 2 : 9));
        if (type !== 'securite') act('preventive', 'Vérifier les axes de traçage avec le géomètre avant chaque niveau', ajout(t, 20), null, 'Conducteur de travaux');
      }
      if (sc === 'analyse' && j === 0) n.analyse = { pourquoi: [], racine: '', cause: '' };
      d.ncs.push(n);
    });
    return d;
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
          <rect x="10" y="20" width="260" height="260" fill="#F0EDE6"/>
          <path d="M140 50 250 260H30Z" fill="#F5B400"/>
          <rect x="128" y="120" width="24" height="80" fill="#141414"/>
          <rect x="128" y="214" width="24" height="24" fill="#141414"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M420 20 A130 130 0 0 1 550 150 H420 Z" fill="#1D4E89"/>
          <circle cx="420" cy="150" r="40" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Registre des non-conformités · actions correctives</p>
          <h1>Chaque écart traité jusqu'au bout.</h1>
          <p>Constat en 30 secondes sur le terrain, cause trouvée avec les 5 pourquoi, actions suivies, efficacité vérifiée, indicateurs prêts pour la revue.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton registre</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton registre est enregistré en ligne et te suit sur tous tes appareils, au bureau comme sur le terrain.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon registre</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de registre ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a>.</p>
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
      const brut = champ.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (/^[A-Z]{3}[0-9A-Z]{16}$/.test(brut) && !brut.startsWith(PRODUIT) && !/^[0-9A-F]+$/.test(brut)) { err.textContent = 'Ce code ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.'; champ.focus(); return; }
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon registre'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', profil: null, choisies: new Set(), libres: [] };

  function ecranAccueil() {
    const a = accueil;
    const p = B.profils.find((x) => x.id === a.profil);
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton registre.</h1>
        <p class="intro">Deux questions, puis tu pourras saisir ta première non-conformité. Tout reste modifiable dans les réglages.</p>
        <label class="champ" style="max-width:420px">Entreprise ou site <small>Affiché sur les fiches imprimées.</small>
          <input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80">
        </label>
        <h2 class="titre-section">Ton activité <span>Les lots ou ateliers sont proposés selon ton choix.</span></h2>
        <div class="filieres" role="group" aria-label="Activité">
          ${B.profils.map((x, i) => `<button type="button" class="filiere" style="--c:${['#D9302A', '#1D4E89'][i]}" data-action="profil" data-id="${x.id}" aria-pressed="${a.profil === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="profil" data-id="libre" aria-pressed="${a.profil === 'libre'}"><b>Autre</b><span>Je crée mes zones moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.profil ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const liste = [...(p ? p.zones : []), ...a.libres];
      const lib = p ? p.zone.toLowerCase() : 'zone';
      corps = `
        <p class="surtitre">${esc(p ? p.nom : 'Personnalisé')}</p>
        <h1>Quels ${p ? `${lib}s` : 'zones'} suis-tu ?</h1>
        <p class="intro">Décoche ceux qui ne te concernent pas. Chaque non-conformité sera rattachée à un ${esc(lib)} : c'est ce qui permet de voir où les écarts se concentrent.</p>
        ${liste.length ? `<div class="choix-matieres">${liste.map((nom) => `<label class="case"><input type="checkbox" data-action="choix-zone" value="${esc(nom)}" ${a.choisies.has(nom) ? 'checked' : ''}> ${esc(nom)}</label>`).join('')}</div>` : ''}
        <form class="ajout-libre" id="form-libre">
          <label class="champ">Ajouter ${p ? `un ${esc(lib)}` : 'une zone'}<input id="libre" maxlength="60" placeholder="${p?.id === 'industrie' ? 'Ex. : Pliage' : 'Ex. : Façades'}"></label>
          <button class="btn" style="align-self:flex-end">Ajouter</button>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.choisies.size ? '' : 'disabled'}>Créer mon registre (${a.choisies.size})</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#form-libre')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = $('#libre').value.trim();
      if (nom && !accueil.libres.includes(nom)) { accueil.libres.push(nom); accueil.choisies.add(nom); }
      ecranAccueil();
      $('#libre').focus();
    });
  }

  function terminerAccueil() {
    const p = B.profils.find((x) => x.id === accueil.profil);
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.profil = accueil.profil;
    E.reglages.libelleZone = p ? p.zone : 'Zone';
    E.reglages.libelleLieu = p ? p.lieu : 'Lieu';
    E.reglages.zones = [...accueil.choisies];
    accueil = { etape: 1, entreprise: '', profil: null, choisies: new Set(), libres: [] };
    sauver();
    demarrer();
    setTimeout(() => modaleConstat(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    registre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    actions: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    indicateurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    methode: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['registre', 'Registre'], ['actions', 'Actions'], ['indicateurs', 'Indicateurs'], ['methode', 'Méthode']];

  function lireHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('nc-') && nc(h.slice(3))) { vue = 'nc'; ncOuverte = h.slice(3); return; }
    if (ONGLETS.some(([id]) => id === h)) vue = h;
    else if (vue === 'nc' && !nc(ncOuverte)) vue = 'registre';
  }

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Entreprise et chantiers fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Registre des<br>non-conformités</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    if (vue === 'nc' && !nc(ncOuverte)) vue = 'registre';
    const onglet = vue === 'nc' ? 'registre' : vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === onglet) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { registre: 'Registre', actions: 'Actions', indicateurs: 'Indicateurs', methode: 'Méthode', nc: nc(ncOuverte)?.numero };
    document.title = `${titres[vue]} · ${NOM}`;
    $('#vue').innerHTML = { registre: vueRegistre, actions: vueActions, indicateurs: vueIndicateurs, methode: vueMethode, nc: vueFiche }[vue]();
    if (vue === 'indicateurs') brancherGraphique();
    if (vue === 'registre') brancherFiltres();
  }

  function changerVue(v, id) {
    vue = v;
    if (v === 'nc') ncOuverte = id;
    history.replaceState(null, '', `#${v === 'nc' ? `nc-${id}` : v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const etiquetteGravite = (g) => { const x = gravite(g); return `<span class="etiquette" style="background:${x.couleur};color:${x.texte}">${esc(x.nom)}</span>`; };
  const CLASSE_ETAPE = { analyse: 'jaune', actions: 'bleu', verification: 'vert', cloturee: '' };
  const etiquetteEtape = (n) => { const e = R.etape(n); return `<span class="etiquette ${CLASSE_ETAPE[e]} ${e === 'cloturee' ? 'creuse' : ''}">${esc(R.nomEtape(e))}</span>`; };

  // Phrase « prochaine étape » d'une NC.
  function prochaine(n, t) {
    const e = R.etape(n);
    const r = reg();
    if (e === 'cloturee') return `Clôturée ${quand(n.cloture.date)} · ${pluriel(R.delaiCloture(n), 'jour')}`;
    if (e === 'analyse') {
      const v = n.verifications.at(-1);
      if (v && !v.efficace) return 'Inefficace : nouvelle action à définir';
      return n.analyse.racine ? 'Définir les actions' : 'Analyser les causes';
    }
    if (e === 'actions') {
      const ouv = n.actions.filter((a) => !a.faite);
      const retard = ouv.filter((a) => R.actionEnRetard(a, t)).length;
      return `${pluriel(ouv.length, 'action')} à faire${retard ? ` · ${retard} en retard` : ''}`;
    }
    const pv = R.verifPrevue(n, r);
    return pv ? `Vérification ${pv <= t ? `due${pv < t ? ` depuis ${quand(pv)}` : ' aujourd\'hui'}` : `prévue ${quand(pv)}`}` : 'À vérifier';
  }

  // ---------- Registre ----------
  function vueRegistre() {
    const t = auj();
    const r = reg();
    const k = R.indicateurs(E.ncs, t, r, ajout(t, -29));
    const tuiles = [
      ['ouvertes', 'Ouvertes', k.ouvertes, 'var(--encre)', 'rond'],
      ['retard', 'En retard', k.retard, 'var(--rouge)', ''],
      ['verification', 'À vérifier', k.aVerifier, 'var(--jaune)', 'rond'],
      ['cloturee', 'Clôturées · 30 j', k.cloturees, 'var(--bleu)', ''],
    ].map(([f, lib, v, c, forme]) => `<button class="tuile cliquable ${forme} ${filtres.etape === f ? 'choisie' : ''}" style="--c:${c}" data-action="filtre-etape" data-id="${f}"><p class="surtitre">${lib}</p><b ${f === 'retard' && v ? 'style="color:var(--rouge)"' : ''}>${v}</b></button>`).join('');
    const liste = R.trier(R.filtrer(E.ncs, filtres, t, r), t, r);
    const zones = [...new Set([...r.zones, ...E.ncs.map((n) => n.zone).filter(Boolean)])];
    const opt = (v, lib, cour) => `<option value="${esc(v)}" ${String(cour) === String(v) ? 'selected' : ''}>${esc(lib)}</option>`;
    const filtresHtml = `
      <div class="filtres" role="search">
        <label class="champ recherche">Rechercher<input type="search" id="f-texte" value="${esc(filtres.texte)}" placeholder="Numéro, titre, cause, responsable…"></label>
        <label class="champ">Étape<select id="f-etape">${[['ouvertes', 'Ouvertes'], ['retard', 'En retard'], ['analyse', 'À analyser'], ['actions', 'Actions en cours'], ['verification', 'À vérifier'], ['cloturee', 'Clôturées'], ['tout', 'Toutes']].map(([v, l]) => opt(v, l, filtres.etape)).join('')}</select></label>
        <label class="champ">Gravité<select id="f-gravite">${opt('', 'Toutes', filtres.gravite)}${B.gravites.map((g) => opt(g.id, g.nom, filtres.gravite)).join('')}</select></label>
        <label class="champ">Type<select id="f-type">${opt('', 'Tous', filtres.type)}${B.types.map((x) => opt(x.id, x.nom, filtres.type)).join('')}</select></label>
        <label class="champ">${esc(r.libelleZone)}<select id="f-zone">${opt('', 'Tous', filtres.zone)}${zones.map((z) => opt(z, z, filtres.zone)).join('')}</select></label>
      </div>`;
    const lignes = liste.map((n) => {
      const retard = R.enRetard(n, t, r);
      const g = gravite(n.gravite);
      return `<li><button class="nc-ligne" data-action="ouvrir" data-id="${n.id}" style="--c:${g.couleur}">
        <span class="nc-bande"></span>
        <span class="nc-corps">
          <span class="nc-haut"><b class="nc-num">${esc(n.numero)}</b><span>${fmtAn(n.date)}</span>${etiquetteGravite(n.gravite)}${etiquetteEtape(n)}${retard ? '<span class="etiquette rouge">En retard</span>' : ''}</span>
          <span class="nc-titre">${esc(n.titre)}</span>
          <span class="nc-meta">${[n.zone, n.lieu, typeDe(n.type)?.nom].filter(Boolean).map(esc).join(' · ')}</span>
        </span>
        <span class="nc-suite ${retard ? 'retard' : ''}">${esc(prochaine(n, t))}${!n.cloture ? `<small>Échéance ${quand(R.echeance(n, r))}</small>` : ''}</span>
      </button></li>`;
    }).join('');
    const vide = !E.ncs.length
      ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune non-conformité enregistrée</h3><p>Note le premier écart constaté : date, lieu, ${esc(r.libelleZone.toLowerCase())}, gravité. L'analyse et les actions viendront ensuite.</p><div class="actions"><button class="btn primaire" data-action="nc-nouvelle">${ICONES.plus}Nouvelle non-conformité</button></div></div></div>`
      : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune non-conformité pour ces filtres</h3><p>${filtres.etape === 'retard' ? 'Rien en retard : tout est dans les délais.' : filtres.etape === 'verification' ? 'Aucune vérification d\'efficacité en attente.' : 'Change l\'étape ou efface la recherche.'}</p><div class="actions"><button class="btn" data-action="filtres-raz">Afficher toutes les non-conformités</button></div></div></div>`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.entreprise || 'Mon entreprise')}</p><h1>Registre</h1><p>${pluriel(E.ncs.length, 'non-conformité', 'non-conformités')} enregistrées. Retards et vérifications dues en tête de liste.</p></div>
        <div class="actions"><button class="btn" data-action="csv" data-id="registre">Export CSV</button><button class="btn primaire" data-action="nc-nouvelle">${ICONES.plus}Nouvelle non-conformité</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${filtresHtml}
      <p class="compte-liste" aria-live="polite">${pluriel(liste.length, 'résultat')}</p>
      ${liste.length ? `<ul class="nc-liste">${lignes}</ul>` : vide}`;
  }

  function brancherFiltres() {
    const maj = (cle, el) => el?.addEventListener(el.type === 'search' ? 'input' : 'change', () => {
      filtres[cle] = el.value;
      const pos = el.type === 'search' ? el.selectionStart : null;
      rendre();
      if (pos !== null) { const c = $('#f-texte'); c.focus(); c.setSelectionRange(pos, pos); }
    });
    maj('texte', $('#f-texte')); maj('etape', $('#f-etape')); maj('gravite', $('#f-gravite')); maj('type', $('#f-type')); maj('zone', $('#f-zone'));
  }

  // ---------- Fiche d'une non-conformité ----------
  function vueFiche() {
    const n = nc(ncOuverte);
    const t = auj();
    const r = reg();
    const e = R.etape(n);
    const retard = R.enRetard(n, t, r);
    const ordre = ['constat', 'analyse', 'actions', 'verification', 'cloturee'];
    const analyseFaite = !!n.analyse.racine || n.analyse.pourquoi.some(Boolean);
    const fait = { constat: true, analyse: analyseFaite || n.actions.length > 0, actions: n.actions.length > 0 && n.actions.every((a) => a.faite), verification: !!n.cloture, cloturee: !!n.cloture };
    const courant = e === 'analyse' && analyseFaite && !n.verifications.length ? 'actions' : e;
    const frise = `<ol class="frise" aria-label="Avancement">${ordre.map((id, i) => `<li class="${fait[id] && id !== courant ? 'fait' : ''} ${id === courant ? 'courant' : ''}"><span>${i + 1}</span>${['Constat', 'Analyse', 'Actions', 'Vérification', 'Clôture'][i]}</li>`).join('')}</ol>`;

    const v = n.verifications.at(-1);
    let suite;
    if (e === 'cloturee') suite = `<p><b>Non-conformité clôturée</b> le ${fmtAn(n.cloture.date)}${n.cloture.par ? ` par ${esc(n.cloture.par)}` : ''}, ${pluriel(R.delaiCloture(n), 'jour')} après le constat.</p><div class="actions"><button class="btn" data-action="rouvrir" data-id="${n.id}">Rouvrir</button></div>`;
    else if (e === 'analyse' && v && !v.efficace) suite = `<p><b>Vérification inefficace</b> le ${fmtAn(v.date)} : ${esc(v.commentaire || 'l\'écart persiste')}. Reprends l'analyse si besoin, puis ajoute une nouvelle action.</p><div class="actions"><button class="btn primaire" data-action="action-nouvelle" data-id="${n.id}">${ICONES.plus}Nouvelle action</button><button class="btn" data-action="analyse" data-id="${n.id}">Reprendre l'analyse</button></div>`;
    else if (e === 'analyse' && !analyseFaite) suite = `<p><b>Prochaine étape : trouver la cause.</b> Pose-toi 5 fois la question « pourquoi ? », chaque réponse expliquant la précédente.</p><div class="actions"><button class="btn primaire" data-action="analyse" data-id="${n.id}">Analyser avec les 5 pourquoi</button><button class="btn" data-action="action-nouvelle" data-id="${n.id}">Ajouter une action directement</button></div>`;
    else if (e === 'analyse') suite = `<p><b>Prochaine étape : décider des actions.</b> Une action corrective qui traite la cause racine, et si besoin une action préventive pour les autres ${esc(r.libelleZone.toLowerCase())}s ou chantiers.</p><div class="actions"><button class="btn primaire" data-action="action-nouvelle" data-id="${n.id}">${ICONES.plus}Ajouter une action</button></div>`;
    else if (e === 'actions') suite = `<p><b>Actions en cours.</b> ${prochaine(n, t)}. Coche chaque action quand elle est faite : la vérification d'efficacité sera alors programmée.</p><div class="actions"><button class="btn" data-action="action-nouvelle" data-id="${n.id}">${ICONES.plus}Ajouter une action</button></div>`;
    else {
      const pv = R.verifPrevue(n, r);
      suite = `<p><b>Toutes les actions sont faites.</b> Vérification d'efficacité ${pv ? (pv <= t ? '<mark>à faire maintenant</mark>' : `prévue ${quand(pv)}`) : 'à faire'} : l'écart a-t-il disparu, sans réapparaître ailleurs ?</p><div class="actions"><button class="btn primaire" data-action="verifier" data-id="${n.id}">Vérifier l'efficacité</button></div>`;
    }

    const dl = (lignes) => `<dl class="infos">${lignes.filter(([, val]) => val !== '' && val != null).map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('')}</dl>`;
    const constat = dl([
      ['Date', fmt(n.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
      [esc(r.libelleLieu), esc(n.lieu)], [esc(r.libelleZone), esc(n.zone)], ['Type', esc(typeDe(n.type)?.nom || '')], ['Gravité', esc(gravite(n.gravite).nom)],
      ['Origine', esc(origineDe(n.origine)?.nom || '')], ['Détecté par', esc(n.detectePar)], ['Quantité ou étendue', esc(n.quantite)], ['Référence photo', esc(n.photo)],
      ['Échéance de traitement', `${fmtAn(R.echeance(n, r))}${n.echeance ? '' : ` <small>(gravité : ${R.delaiGravite(r, n.gravite)} j)</small>`}`],
    ]);
    const pq = n.analyse.pourquoi.filter(Boolean);
    const analyse = pq.length || n.analyse.racine
      ? `<ol class="chaine">${pq.map((x, i) => `<li><span>Pourquoi ${i + 1}</span>${esc(x)}</li>`).join('')}</ol>
         ${n.analyse.racine ? `<p class="racine"><span class="surtitre">Cause racine</span>${esc(n.analyse.racine)}${causeDe(n.analyse.cause) ? ` <span class="etiquette" style="background:${causeDe(n.analyse.cause).couleur};color:${n.analyse.cause === 'materiel' ? 'var(--encre)' : '#fff'}">${esc(causeDe(n.analyse.cause).nom)}</span>` : ''}</p>` : ''}`
      : '<p class="discret">Pas encore d\'analyse.</p>';
    const actions = n.actions.length
      ? `<ul class="actions-liste">${n.actions.map((a) => ligneAction(n, a, t)).join('')}</ul>`
      : '<p class="discret">Aucune action.</p>';
    const verifs = n.verifications.length
      ? `<ul class="verifs">${n.verifications.map((x) => `<li class="${x.efficace ? 'ok' : 'ko'}"><b>${x.efficace ? 'Efficace' : 'Inefficace'}</b> · ${fmtAn(x.date)}${x.par ? ` · ${esc(x.par)}` : ''}${x.commentaire ? `<span>${esc(x.commentaire)}</span>` : ''}</li>`).join('')}</ul>`
      : `<p class="discret">${e === 'verification' ? `Prévue ${quand(R.verifPrevue(n, r) || t)}.` : 'Après la dernière action faite.'}</p>`;

    return `
      <button class="retour" data-action="vue" data-vue="registre">← Registre</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${esc(n.numero)} · ${fmtAn(n.date)}</p>
          <h1>${esc(n.titre)}</h1>
          <p class="etiquettes">${etiquetteGravite(n.gravite)}${etiquetteEtape(n)}${retard ? '<span class="etiquette rouge">En retard</span>' : ''}</p>
        </div>
        <div class="actions"><button class="btn" data-action="imprimer" data-id="${n.id}">Imprimer la fiche</button><button class="btn" data-action="nc-modifier" data-id="${n.id}">Modifier le constat</button></div></div>
      ${frise}
      <section class="suite-etape ${e}">${suite}</section>
      <div class="fiche">
        <section class="bloc"><h2>1 · Constat</h2>${n.description ? `<p class="texte">${esc(n.description)}</p>` : ''}${constat}</section>
        <section class="bloc"><h2>Traitement immédiat</h2>${dl([['Décision sur le produit', esc(decisionDe(n.decision)?.nom || '')], ['Mesures prises', esc(n.traitement)], ['Coût estimé', n.cout ? euros(n.cout) : '']]) || ''}${!n.decision && !n.traitement && !n.cout ? '<p class="discret">Rien de renseigné.</p>' : ''}</section>
        <section class="bloc"><div class="bloc-tete"><h2>2 · Analyse des causes</h2><button class="btn petit" data-action="analyse" data-id="${n.id}">${pq.length ? 'Modifier' : 'Analyser'}</button></div>${analyse}</section>
        <section class="bloc"><div class="bloc-tete"><h2>3 · Actions</h2><button class="btn petit" data-action="action-nouvelle" data-id="${n.id}">${ICONES.plus}Action</button></div>${actions}</section>
        <section class="bloc"><div class="bloc-tete"><h2>4 · Vérification d'efficacité</h2>${e === 'verification' ? `<button class="btn petit" data-action="verifier" data-id="${n.id}">Vérifier</button>` : ''}</div>${verifs}</section>
        <section class="bloc"><h2>5 · Clôture</h2>${n.cloture ? dl([['Date', fmtAn(n.cloture.date)], ['Par', esc(n.cloture.par)], ['Délai', pluriel(R.delaiCloture(n), 'jour')]]) : '<p class="discret">Clôture automatique quand la vérification est jugée efficace.</p>'}</section>
      </div>`;
  }

  function ligneAction(n, a, t, avecNc = false) {
    const retard = R.actionEnRetard(a, t) && !n.cloture;
    return `<li class="action-ligne ${a.faite ? 'faite' : ''}">
      <button class="coche" data-action="action-faite" data-id="${n.id}" data-action-id="${a.id}" aria-pressed="${!!a.faite}" aria-label="${a.faite ? 'Marquer comme à faire' : 'Marquer comme faite'} : ${esc(a.quoi)}" ${n.cloture ? 'disabled' : ''}></button>
      <div><span class="etiquette ${a.nature === 'preventive' ? 'bleu' : ''} mini">${a.nature === 'preventive' ? 'Préventive' : 'Corrective'}</span><b>${esc(a.quoi)}</b>
        <span class="meta">${esc(a.responsable || 'Sans responsable')} · ${a.faite ? `faite ${quand(a.faite)}` : a.echeance ? `<span class="${retard ? 'retard' : ''}">échéance ${quand(a.echeance)}${retard ? ` (retard ${pluriel(ecart(a.echeance, t), 'jour')})` : ''}</span>` : 'sans échéance'}</span>
        ${avecNc ? `<button class="lien-nc" data-action="ouvrir" data-id="${n.id}">${esc(n.numero)} · ${esc(n.titre)}</button>` : ''}
      </div>
      <button class="btn petit lien" data-action="action-modifier" data-id="${n.id}" data-action-id="${a.id}">Modifier</button>
    </li>`;
  }

  // ---------- Actions ----------
  function vueActions() {
    const t = auj();
    const toutes = R.actionsOuvertes(E.ncs);
    const resps = [...new Set(toutes.map((x) => x.a.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (filtreResp && !resps.includes(filtreResp)) filtreResp = '';
    const liste = toutes.filter((x) => !filtreResp || x.a.responsable === filtreResp);
    const groupes = [
      ['En retard', liste.filter((x) => x.a.echeance && x.a.echeance < t), 'rouge'],
      ['Cette semaine', liste.filter((x) => x.a.echeance && x.a.echeance >= t && x.a.echeance <= ajout(t, 7)), 'jaune'],
      ['Plus tard', liste.filter((x) => x.a.echeance && x.a.echeance > ajout(t, 7)), 'bleu'],
      ['Sans échéance', liste.filter((x) => !x.a.echeance), ''],
    ].filter(([, l]) => l.length);
    const faites7 = E.ncs.flatMap((n) => n.actions.filter((a) => a.faite && a.faite >= ajout(t, -6)).map((a) => ({ n, a })));
    return `
      <div class="vue-tete"><div><h1>Actions</h1><p>Toutes les actions correctives et préventives encore à faire, par échéance. Coche une action quand elle est faite.</p></div>
        <div class="actions"><button class="btn" data-action="csv" data-id="actions">Export CSV</button></div></div>
      ${resps.length > 1 ? `<div class="filtres filtres-resp"><label class="champ">Responsable<select data-action-change="resp"><option value="">Tous (${toutes.length})</option>${resps.map((r) => `<option ${r === filtreResp ? 'selected' : ''} value="${esc(r)}">${esc(r)} (${toutes.filter((x) => x.a.responsable === r).length})</option>`).join('')}</select></label></div>` : ''}
      ${groupes.length ? groupes.map(([titre, l, c]) => `<h2 class="titre-section"><i class="carre ${c}"></i>${titre} <span>${pluriel(l.length, 'action')}</span></h2><ul class="actions-liste carte-liste">${l.map(({ nc: n, a }) => ligneAction(n, a, t, true)).join('')}</ul>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune action à faire</h3><p>${E.ncs.some((n) => !n.cloture) ? 'Les non-conformités ouvertes attendent une analyse ou une vérification : voir le registre.' : 'Toutes les actions sont faites.'}</p><div class="actions"><button class="btn" data-action="vue" data-vue="registre">Voir le registre</button></div></div></div>`}
      ${faites7.length ? `<details class="faites"><summary>Faites ces 7 derniers jours (${faites7.length})</summary><ul class="actions-liste">${faites7.map(({ n, a }) => ligneAction(n, a, t, true)).join('')}</ul></details>` : ''}`;
  }

  // ---------- Indicateurs ----------
  const SERIES = [['constatees', 'Constatées', '#D9302A'], ['cloturees', 'Clôturées', '#1D4E89']];

  function graphique(mois) {
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 230, g = 28, b = 24, hz = H - b - 8;
    const max = Math.max(4, ...mois.flatMap((m) => [m.constatees, m.cloturees]));
    const pas = Math.ceil(max / 4), haut = pas * 4;
    const larg = (L - g) / mois.length;
    const y = (v) => 8 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const w = Math.max(4, Math.min(18, (larg - 8) / 2 - 1));
    const colonnes = mois.map((m, i) => {
      const x0 = g + i * larg + larg / 2 - w - 1;
      const rects = SERIES.map(([k, , c], j) => (m[k] ? `<rect x="${x0 + j * (w + 2)}" y="${y(m[k])}" width="${w}" height="${Math.max(1, y(0) - y(m[k]))}" fill="${c}" stroke="#141414" stroke-width="1.5"/>` : '')).join('');
      const pasEtiq = L < 500 ? 3 : 2;
      const etiquette = (mois.length - 1 - i) % pasEtiq === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${esc(m.libelle)}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne" data-i="${i}">${rects}</g>${etiquette}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Non-conformités constatées et clôturées par mois sur 12 mois, détail dans le tableau">${grilles}${colonnes}</svg>`;
  }

  // Barres horizontales étiquetées (une seule mesure : le nombre de non-conformités).
  function barres(titre, lignes, total, note = '') {
    const max = Math.max(1, ...lignes.map((l) => l.n));
    return `<figure class="barres"><figcaption><h3>${titre}</h3>${note ? `<span>${note}</span>` : ''}</figcaption>
      ${lignes.length ? `<ul>${lignes.map((l) => `<li><span class="lib">${l.pastille ? `<i style="background:${l.pastille}"></i>` : ''}${esc(l.nom)}</span><span class="piste"><span style="width:${(l.n / max) * 100}%;${l.pastille ? `background:${l.pastille}` : ''}"></span></span><b>${l.n}<small>${total ? ` · ${Math.round((l.n / total) * 100)} %` : ''}</small></b></li>`).join('')}</ul>` : '<p class="discret">Aucune donnée sur la période.</p>'}
    </figure>`;
  }

  function debutPeriode(t) { return periode === 'tout' ? null : ajout(t, -Math.round(Number(periode) * 30.44) + 1); }

  function vueIndicateurs() {
    const t = auj();
    const r = reg();
    const k = R.indicateurs(E.ncs, t, r, debutPeriode(t));
    const mois = R.parMois(E.ncs, t, 12);
    const tuiles = [
      ['Ouvertes', k.ouvertes, '', 'Non-conformités non clôturées, à ce jour.', 'var(--encre)', 'rond'],
      ['En retard', k.retard, '', 'Échéance de traitement ou d\'action dépassée.', 'var(--rouge)', ''],
      ['Délai moyen de clôture', k.delaiMoyen === null ? '–' : String(k.delaiMoyen).replace('.', ','), k.delaiMoyen === null ? '' : 'j', `Du constat à la clôture, sur ${pluriel(k.cloturees, 'clôture')} de la période.`, 'var(--jaune)', 'rond'],
      ['Efficaces du 1er coup', k.efficacite === null ? '–' : k.efficacite, k.efficacite === null ? '' : '%', 'Clôturées sans vérification jugée inefficace.', 'var(--bleu)', ''],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const tri = (obj, base, coul) => Object.entries(obj).map(([id, n]) => { const x = base.find((y) => String(y.id) === String(id)); return { nom: x ? x.nom : id, n, pastille: coul ? coul(x) : null }; }).sort((a, b) => b.n - a.n);
    const parGravite = B.gravites.map((g) => ({ nom: g.nom, n: k.parGravite[g.id] || 0, pastille: g.couleur })).reverse();
    const parCause = tri(k.parCause, B.causes, (x) => x?.couleur);
    const parType = tri(k.parType, B.types);
    const parZone = Object.entries(k.parZone).map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n).slice(0, 8);
    const opt = (v, l) => `<option value="${v}" ${periode === v ? 'selected' : ''}>${l}</option>`;
    return `
      <div class="vue-tete"><div><h1>Indicateurs</h1><p>Pour la revue de direction ou un audit client : où en sont les non-conformités, à quelle vitesse elles se ferment, d'où elles viennent.</p></div>
        <div class="actions"><label class="champ periode">Période<select data-action-change="periode">${opt('3', '3 derniers mois')}${opt('12', '12 derniers mois')}${opt('tout', 'Tout l\'historique')}</select></label></div></div>
      <div class="tuiles">${tuiles}</div>
      <p class="resume-periode">${pluriel(k.constatees, 'non-conformité constatée', 'non-conformités constatées')} et ${pluriel(k.cloturees, 'clôturée')} sur la période${k.nbCouts ? ` · coût estimé de non-qualité : <b>${euros(k.cout)}</b> (${pluriel(k.nbCouts, 'fiche chiffrée', 'fiches chiffrées')})` : ''}.</p>
      <h2 class="titre-section">12 derniers mois</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Constatées et clôturées par mois</h2><div class="legende">${SERIES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(mois)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Non-conformités par mois</caption><thead><tr><th>Mois</th><th>Constatées</th><th>Clôturées</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${m.mois}</td><td>${m.constatees}</td><td>${m.cloturees}</td></tr>`).join('')}</tbody></table>
      </figure>
      <h2 class="titre-section">Répartition <span>Non-conformités constatées sur la période choisie.</span></h2>
      <div class="repartitions">
        ${barres('Par gravité', parGravite, k.constatees)}
        ${barres('Par famille de cause (6M)', parCause, k.constatees - k.sansCause, k.sansCause ? `${pluriel(k.sansCause, 'non analysée', 'non analysées')}, non comptées` : '')}
        ${barres('Par type d\'écart', parType, k.constatees)}
        ${barres(`Par ${esc(r.libelleZone.toLowerCase())}`, parZone, k.constatees, Object.keys(k.parZone).length > 8 ? '8 premiers' : '')}
      </div>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const mois = R.parMois(E.ncs, auj(), 12);
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), m = mois[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>${esc(m.mois)}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${m[k]}</div>`).join('')}`;
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

  // ---------- Méthode (base intégrée) ----------
  function vueMethode() {
    const P = B.cinqPourquoi;
    return `
      <div class="vue-tete"><div><h1>Méthode</h1><p>Les repères intégrés au registre : grille de gravité, typologie des écarts, 5 pourquoi, familles de causes. Ce sont des propositions de méthode, à adapter à ton propre système qualité : aucune norme n'impose ces seuils.</p></div></div>
      <nav class="sommaire" aria-label="Sommaire"><a href="#m-gravite">Gravité</a><a href="#m-types">Types d'écarts</a><a href="#m-pourquoi">5 pourquoi</a><a href="#m-6m">Familles de causes</a><a href="#m-decisions">Décisions sur le produit</a></nav>
      <h2 class="titre-section" id="m-gravite">Grille de gravité <span>Délai de traitement proposé, réglable dans les réglages.</span></h2>
      <div class="methodes grille-gravite">${B.gravites.map((g) => `
        <article class="methode" style="--c:${g.couleur};--t:${g.texte}">
          <div class="methode-tete"><h2>${g.id} · ${esc(g.nom)}</h2><span>${R.delaiGravite(reg(), g.id)} j</span></div>
          <p>${esc(g.definition)}</p>
          <ul class="puces">${g.criteres.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          <p class="note">${esc(g.verification)}</p>
        </article>`).join('')}</div>
      <h2 class="titre-section" id="m-types">Typologie des écarts <span>${B.types.length} types, avec des exemples fictifs.</span></h2>
      <div class="defile"><table class="tableau types"><thead><tr><th>Type</th><th>Bâtiment et travaux</th><th>Industrie</th></tr></thead><tbody>${B.types.map((x) => `<tr><td><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></td><td>${esc(x.btp)}</td><td>${esc(x.industrie)}</td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section" id="m-pourquoi">Les 5 pourquoi <span>Remonter du symptôme à la cause sur laquelle agir.</span></h2>
      <div class="regles">${P.regles.map(([t, d], i) => `<div class="regle"><span>${i + 1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
      <div class="aide relances"><b>Questions de relance quand on bloque :</b><ul class="puces">${P.relances.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div>
      <div class="exemples">${P.exemples.map((x) => `
        <article class="exemple">
          <h3>${esc(x.titre)}</h3>
          <p class="probleme"><span class="surtitre">Problème</span>${esc(x.probleme)}</p>
          <ol class="chaine">${x.pourquoi.map((q, i) => `<li><span>Pourquoi ${i + 1}</span>${esc(q)}</li>`).join('')}</ol>
          <p class="racine"><span class="surtitre">Cause racine · ${esc(causeDe(x.cause).nom)}</span>${esc(x.racine)}</p>
          <ul class="puces">${x.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        </article>`).join('')}</div>
      <h2 class="titre-section" id="m-6m">Familles de causes (6M) <span>Pour classer la cause racine et voir les tendances.</span></h2>
      <div class="familles">${B.causes.map((c) => `<div class="famille" style="--c:${c.couleur}"><b>${esc(c.nom)}</b><p>${esc(c.questions)}</p></div>`).join('')}</div>
      <h2 class="titre-section" id="m-decisions">Décisions sur le produit <span>Le traitement immédiat, avant l'analyse.</span></h2>
      <div class="defile"><table class="tableau"><tbody>${B.decisions.map((d) => `<tr><td><b>${esc(d.nom)}</b></td><td>${esc(d.detail)}</td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section">Une bonne action corrective</h2>
      <ul class="puces large">${B.bonnesActions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="avertissement">Outil d'aide au suivi : il ne remplace pas ton système de management de la qualité, ni l'avis d'un professionnel pour un écart touchant la sécurité ou la structure. Exemples fictifs. Personnes : privilégie les fonctions (« chef de chantier ») plutôt que les noms.</p>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, large = false) {
    const d = modale();
    d.classList.toggle('large', large);
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=date]),select,textarea')?.focus();
  }

  const memoriserAnnulation = (texte) => { annulation = structuredClone(E.ncs); return { libelle: 'Annuler', faire: annuler, texte }; };
  function annuler() {
    if (!annulation) return;
    E.ncs = annulation; annulation = null;
    sauver(); rendre(); toast('Modification annulée.');
  }

  function listeDatalist(id, valeurs) { return `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`; }

  function modaleConstat(id) {
    const n = id ? nc(id) : null;
    const t = auj();
    const r = reg();
    const g0 = n?.gravite || 2;
    const opt = (liste, cour, vide) => `${vide ? `<option value="">${vide}</option>` : ''}${liste.map((x) => `<option value="${esc(x.id)}" ${String(x.id) === String(cour) ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}`;
    const corps = `
      <div class="deux"><label class="champ">Date du constat<input type="date" name="date" value="${n?.date || t}" max="${t}" required></label>
      <label class="champ">${esc(r.libelleZone)}<input name="zone" list="dl-zones" maxlength="60" value="${esc(n?.zone || '')}" placeholder="Choisis ou saisis"></label></div>
      ${listeDatalist('dl-zones', [...r.zones, ...E.ncs.map((x) => x.zone)])}
      <label class="champ">Titre<small>Ce qui ne va pas, en une ligne : quoi, où.</small><input name="titre" required maxlength="120" value="${esc(n?.titre || '')}" placeholder="Ex. : Réservation oubliée dans le voile R+1, axe C"></label>
      <label class="champ">Description<small>Le fait constaté, mesuré si possible. Pas de coupable.</small><textarea name="description" maxlength="2000">${esc(n?.description || '')}</textarea></label>
      <div class="deux"><label class="champ">${esc(r.libelleLieu)}<input name="lieu" list="dl-lieux" maxlength="80" value="${esc(n?.lieu || '')}"></label>
      <label class="champ">Type d'écart<select name="type">${opt(B.types, n?.type || 'execution')}</select></label></div>
      ${listeDatalist('dl-lieux', E.ncs.map((x) => x.lieu))}
      <fieldset class="champ gravites"><legend>Gravité</legend>${B.gravites.map((g) => `<label class="gravite-choix" style="--c:${g.couleur};--t:${g.texte}"><input type="radio" name="gravite" value="${g.id}" ${g.id === g0 ? 'checked' : ''}><span><b>${esc(g.nom)}</b><small>${esc(g.definition)} Traitement : ${R.delaiGravite(r, g.id)} j.</small></span></label>`).join('')}</fieldset>
      <div class="deux"><label class="champ">Origine<select name="origine">${opt(B.origines, n?.origine || 'interne')}</select></label>
      <label class="champ">Détecté par<input name="detectePar" list="dl-personnes" maxlength="80" value="${esc(n?.detectePar || '')}" placeholder="Fonction de préférence"></label></div>
      ${listeDatalist('dl-personnes', [...E.ncs.map((x) => x.detectePar), ...E.ncs.flatMap((x) => x.actions.map((a) => a.responsable))])}
      <div class="deux"><label class="champ">Quantité ou étendue<input name="quantite" maxlength="80" value="${esc(n?.quantite || '')}" placeholder="Ex. : 120 pièces, 3 m²"></label>
      <label class="champ">Référence photo<small>Les photos ne sont pas stockées ici : note où elle est rangée.</small><input name="photo" maxlength="160" value="${esc(n?.photo || '')}" placeholder="Ex. : Photo 0412, dossier chantier"></label></div>
      <h3 class="sous-titre">Traitement immédiat</h3>
      <label class="champ">Décision sur le produit ou l'ouvrage<select name="decision">${opt(B.decisions, n?.decision || '', 'À décider')}</select></label>
      <label class="champ">Mesures prises<textarea name="traitement" maxlength="1000" placeholder="Ex. : zone balisée, lot isolé, client prévenu">${esc(n?.traitement || '')}</textarea></label>
      <div class="deux"><label class="champ">Coût estimé (€)<small>Facultatif : reprise, rebut, temps passé.</small><input type="number" name="cout" min="0" step="1" inputmode="decimal" value="${n?.cout ?? ''}"></label>
      <label class="champ">Échéance de traitement<small>Vide : date + délai de la gravité.</small><input type="date" name="echeance" value="${n?.echeance || ''}"></label></div>
      <p class="erreur" role="alert"></p>`;
    const pied = n
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Enregistrer le constat</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(n ? `Modifier ${esc(n.numero)}` : 'Nouvelle non-conformité', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer ${n.numero} « ${n.titre} » avec son analyse et ses actions ?`)) return '';
        const act = memoriserAnnulation();
        E.ncs = E.ncs.filter((x) => x.id !== n.id);
        sauver(); changerVue('registre'); toast(`${n.numero} supprimée.`, act);
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      const date = f.get('date');
      if (!titre) return 'Indique un titre.';
      if (!date || date > t) return 'La date du constat ne peut pas être dans le futur.';
      const cout = f.get('cout') === '' ? null : Number(f.get('cout'));
      if (cout !== null && (!Number.isFinite(cout) || cout < 0)) return 'Coût : un montant positif.';
      const val = {
        date, titre, description: String(f.get('description') || '').trim(), lieu: String(f.get('lieu') || '').trim(), zone: String(f.get('zone') || '').trim(),
        type: f.get('type'), gravite: Number(f.get('gravite')) || 2, origine: f.get('origine'), detectePar: String(f.get('detectePar') || '').trim(),
        quantite: String(f.get('quantite') || '').trim(), photo: String(f.get('photo') || '').trim(), decision: f.get('decision') || '', traitement: String(f.get('traitement') || '').trim(),
        cout, echeance: f.get('echeance') || null,
      };
      if (n) { Object.assign(n, val); sauver(); rendre(); toast('Constat enregistré.'); return; }
      const nouvelle = { id: uid(), numero: R.numeroSuivant(E.ncs, date), ...val, analyse: { pourquoi: [], racine: '', cause: '' }, actions: [], verifications: [], verifPrevue: null, cloture: null };
      E.ncs.push(nouvelle);
      if (val.zone && !r.zones.includes(val.zone)) r.zones.push(val.zone);
      sauver(); changerVue('nc', nouvelle.id);
      toast(`${nouvelle.numero} enregistrée. Échéance de traitement ${quand(R.echeance(nouvelle, r))}.`);
    }, true);
  }

  function modaleAnalyse(id) {
    const n = nc(id);
    const P = B.cinqPourquoi;
    const rep = [0, 1, 2, 3, 4].map((i) => n.analyse.pourquoi[i] || '');
    const corps = `
      <p class="probleme"><span class="surtitre">Problème · ${esc(n.numero)}</span>${esc(n.titre)}</p>
      <p class="aide">Chaque réponse explique la précédente, et se vérifie sur le terrain. Arrête-toi quand la cause est à ta portée et que la traiter éviterait la récurrence. Ne t'arrête pas à « erreur humaine » : demande pourquoi elle était possible.</p>
      <div class="pourquois">${rep.map((v, i) => `<label class="champ pourquoi"><span class="num">${i + 1}</span><span class="q" id="q${i}">${esc(R.questionPourquoi(n.titre, rep, i))}</span><textarea name="p${i}" rows="2" maxlength="400" placeholder="${esc(P.relances[i])}">${esc(v)}</textarea></label>`).join('')}</div>
      <label class="champ">Cause racine<small>Proposée à partir de ta dernière réponse ; reformule-la si besoin.</small><textarea name="racine" rows="2" maxlength="400">${esc(n.analyse.racine)}</textarea></label>
      <fieldset class="champ"><legend>Famille de cause (6M)</legend><div class="pills">${B.causes.map((c) => `<label class="pill" title="${esc(c.questions)}"><input type="radio" name="cause" value="${c.id}" ${n.analyse.cause === c.id ? 'checked' : ''}><span style="--c:${c.couleur}">${esc(c.nom)}</span></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Analyse des causes · 5 pourquoi', corps, '<button class="btn primaire" value="ok">Enregistrer l\'analyse</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const pq = [0, 1, 2, 3, 4].map((i) => String(f.get(`p${i}`) || '').trim());
      const dernier = pq.reduce((m, v, i) => (v ? i : m), -1);
      if (pq.slice(0, dernier).some((v) => !v)) return 'Réponds aux pourquoi dans l\'ordre, sans en sauter.';
      n.analyse = { pourquoi: pq.slice(0, dernier + 1), racine: String(f.get('racine') || '').trim() || R.racineProposee(pq), cause: f.get('cause') || '' };
      sauver(); rendre();
      toast(n.actions.length ? 'Analyse enregistrée.' : 'Analyse enregistrée. Ajoute maintenant l\'action qui traite la cause.');
    }, true);
    // Questions guidées : chaque question reprend la réponse précédente ; la cause racine suit la dernière réponse.
    const d = modale();
    const racine = d.querySelector('[name=racine]');
    let racineLibre = !!n.analyse.racine;
    racine.addEventListener('input', () => { racineLibre = !!racine.value.trim(); });
    d.querySelectorAll('.pourquoi textarea').forEach((ta) => ta.addEventListener('input', () => {
      const vals = [0, 1, 2, 3, 4].map((i) => d.querySelector(`[name=p${i}]`).value);
      for (let i = 1; i < 5; i++) d.querySelector(`#q${i}`).textContent = R.questionPourquoi(n.titre, vals, i);
      if (!racineLibre) racine.value = R.racineProposee(vals);
    }));
  }

  function modaleAction(ncId, actionId) {
    const n = nc(ncId);
    const a = actionId ? n.actions.find((x) => x.id === actionId) : null;
    const t = auj();
    const r = reg();
    const defaut = R.echeance(n, r) > t ? R.echeance(n, r) : ajout(t, 7);
    const corps = `
      <p class="probleme"><span class="surtitre">${esc(n.numero)}</span>${esc(n.titre)}${n.analyse.racine ? `<small>Cause racine : ${esc(n.analyse.racine)}</small>` : ''}</p>
      <fieldset class="champ"><legend>Nature</legend><div class="pills">
        <label class="pill"><input type="radio" name="nature" value="corrective" ${a?.nature !== 'preventive' ? 'checked' : ''}><span style="--c:#141414">Corrective</span></label>
        <label class="pill"><input type="radio" name="nature" value="preventive" ${a?.nature === 'preventive' ? 'checked' : ''}><span style="--c:#1D4E89">Préventive</span></label>
      </div><small>Corrective : supprime la cause ici. Préventive : évite l'écart ailleurs (autres chantiers, postes, produits).</small></fieldset>
      <label class="champ">Action<textarea name="quoi" required rows="2" maxlength="400" placeholder="Ex. : Ajouter le contrôle de l'indice des plans à l'autocontrôle avant coulage">${esc(a?.quoi || '')}</textarea></label>
      <div class="deux"><label class="champ">Responsable<small>Une seule personne, par sa fonction de préférence.</small><input name="responsable" list="dl-resp" maxlength="80" value="${esc(a?.responsable || '')}"></label>
      <label class="champ">Échéance<input type="date" name="echeance" value="${a ? (a.echeance || '') : defaut}"></label></div>
      ${listeDatalist('dl-resp', [...E.ncs.flatMap((x) => x.actions.map((y) => y.responsable)), ...E.ncs.map((x) => x.detectePar)])}
      ${a ? `<label class="champ">Faite le<small>Vide : encore à faire.</small><input type="date" name="faite" value="${a.faite || ''}" max="${t}"></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter l\'action</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'action' : 'Nouvelle action', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const act = memoriserAnnulation();
        n.actions = n.actions.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Action supprimée.', act); return;
      }
      const quoi = String(f.get('quoi') || '').trim();
      if (!quoi) return 'Décris l\'action.';
      const faite = a ? (f.get('faite') || null) : null;
      if (faite && faite > t) return 'La date de réalisation ne peut pas être dans le futur.';
      const val = { nature: f.get('nature') === 'preventive' ? 'preventive' : 'corrective', quoi, responsable: String(f.get('responsable') || '').trim(), echeance: f.get('echeance') || null };
      if (a) Object.assign(a, val, { faite }); else n.actions.push({ id: uid(), ...val, faite: null });
      sauver(); rendre(); toast(a ? 'Action enregistrée.' : 'Action ajoutée.');
    });
  }

  function modaleVerification(id) {
    const n = nc(id);
    const t = auj();
    const pv = R.verifPrevue(n, reg());
    const corps = `
      <p class="probleme"><span class="surtitre">${esc(n.numero)}</span>${esc(n.titre)}${n.analyse.racine ? `<small>Cause traitée : ${esc(n.analyse.racine)}</small>` : ''}</p>
      <p class="aide">L'écart a-t-il disparu, et n'est-il pas réapparu ailleurs depuis les actions ? Regarde sur le terrain ou dans les enregistrements, pas seulement que les actions sont faites.</p>
      <fieldset class="champ"><legend>Résultat</legend><div class="verdicts">
        <label class="verdict ok"><input type="radio" name="verdict" value="efficace"><span><b>Efficace</b><small>La non-conformité est clôturée.</small></span></label>
        <label class="verdict ko"><input type="radio" name="verdict" value="inefficace"><span><b>Inefficace</b><small>Retour à l'analyse : une nouvelle action sera demandée.</small></span></label>
        <label class="verdict"><input type="radio" name="verdict" value="reporter"><span><b>Trop tôt pour juger</b><small>Reporter la vérification à la date ci-dessous.</small></span></label>
      </div></fieldset>
      <div class="deux"><label class="champ">Date<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Vérifié par<input name="par" list="dl-par" maxlength="80" value="${esc(n.verifications.at(-1)?.par || '')}"></label></div>
      ${listeDatalist('dl-par', E.ncs.flatMap((x) => x.verifications.map((v) => v.par)))}
      <label class="champ">Constat de vérification<textarea name="commentaire" rows="2" maxlength="600" placeholder="Ex. : 3 voiles coulés depuis, réservations conformes au plan en vigueur"></textarea></label>
      <label class="champ">Nouvelle date prévue<small>Seulement pour « trop tôt pour juger ».</small><input type="date" name="report" value="${pv && pv > t ? pv : ajout(t, 14)}" min="${ajout(t, 1)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Vérification d\'efficacité', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const verdict = f.get('verdict');
      if (!verdict) return 'Choisis un résultat.';
      const date = f.get('date') || t;
      if (date > t) return 'La date ne peut pas être dans le futur.';
      const act = memoriserAnnulation();
      if (verdict === 'reporter') {
        const rep = f.get('report');
        if (!rep || rep <= t) return 'Choisis une date après aujourd\'hui.';
        n.verifPrevue = rep; sauver(); rendre(); toast(`Vérification reportée ${quand(rep)}.`, act); return;
      }
      R.verifier(n, { date, efficace: verdict === 'efficace', commentaire: String(f.get('commentaire') || '').trim(), par: String(f.get('par') || '').trim() });
      sauver(); rendre();
      toast(verdict === 'efficace' ? `${n.numero} clôturée en ${pluriel(R.delaiCloture(n), 'jour')}.` : `${n.numero} : retour à l'analyse. Ajoute une nouvelle action.`, act);
    });
  }

  function modaleReglages() {
    const r = reg();
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Entreprise ou site<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
      <div class="deux"><label class="champ">Libellé des zones<input name="libelleZone" maxlength="30" value="${esc(r.libelleZone)}" placeholder="Lot, Atelier, Service…"></label>
      <label class="champ">Libellé du lieu<input name="libelleLieu" maxlength="30" value="${esc(r.libelleLieu)}" placeholder="Chantier, Site, Ligne…"></label></div>
      <label class="champ">Liste des ${esc(r.libelleZone.toLowerCase())}s<small>Un par ligne. Proposés à la saisie d'un constat.</small><textarea name="zones" rows="5" maxlength="3000">${esc(r.zones.join('\n'))}</textarea></label>
      <fieldset class="champ"><legend>Délai de traitement par gravité (jours)</legend><div class="delais">${B.gravites.map((g) => `<label><span>${esc(g.nom)}</span><input type="number" name="d${g.id}" min="0" max="365" value="${R.delaiGravite(r, g.id)}" inputmode="numeric"></label>`).join('')}</div></fieldset>
      <label class="champ">Vérification d'efficacité<small>Jours après la dernière action faite.</small><input type="number" name="delaiVerif" min="1" max="365" value="${r.delaiVerif}" inputmode="numeric"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports</h3><p class="aide">CSV au point-virgule pour un tableur (accents conservés).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv" data-id="registre">Registre (CSV)</button><button class="btn petit" type="button" data-action="csv" data-id="actions">Actions (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton registre est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <p class="mention">Base intégrée (grille de gravité, typologie, 5 pourquoi, 6M) : repères de méthode rédigés par QME, sans référence normative ni donnée datée. Outil d'aide au suivi, il ne remplace pas ton système de management de la qualité.</p>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const delais = {};
      for (const g of B.gravites) {
        const v = Number(f.get(`d${g.id}`));
        if (!Number.isInteger(v) || v < 0 || v > 365) return 'Délais : nombres entiers entre 0 et 365.';
        delais[g.id] = v;
      }
      const dv = Number(f.get('delaiVerif'));
      if (!Number.isInteger(dv) || dv < 1 || dv > 365) return 'Vérification : entre 1 et 365 jours.';
      E.entreprise = String(f.get('entreprise') || '').trim();
      r.libelleZone = String(f.get('libelleZone') || '').trim() || 'Zone';
      r.libelleLieu = String(f.get('libelleLieu') || '').trim() || 'Lieu';
      r.zones = [...new Set(String(f.get('zones') || '').split('\n').map((s) => s.trim()).filter(Boolean))];
      r.delais = delais; r.delaiVerif = dv;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.ncs)) throw new Error();
        if (!confirm(`Remplacer ton registre actuel par cette copie (${pluriel(d.ncs.length, 'non-conformité', 'non-conformités')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du registre.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), `registre-non-conformites-${auj()}.json`, 'application/json');
  function exporterCsv(quoi) {
    const t = auj();
    if (quoi === 'actions') telecharger(R.csvActions(E, t), `actions-non-conformites-${t}.csv`, 'text/csv;charset=utf-8');
    else telecharger(R.csvRegistre(E, B, t), `registre-non-conformites-${t}.csv`, 'text/csv;charset=utf-8');
    toast('Fichier CSV téléchargé.');
  }

  // ---------- Fiche imprimable ----------
  function imprimer(id) {
    const n = nc(id);
    const t = auj();
    const r = reg();
    const ligne = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');
    $('#impression').innerHTML = `
      <header><p>${esc(E.entreprise || '')} · Fiche de non-conformité</p><h1>${esc(n.numero)} · ${esc(n.titre)}</h1><p>Gravité : ${esc(gravite(n.gravite).nom)} · Étape : ${esc(R.nomEtape(R.etape(n)))}${R.enRetard(n, t, r) ? ' · en retard' : ''}</p></header>
      <h2>1. Constat</h2>
      <table>${ligne('Date', R.dateLongue(n.date))}${ligne(esc(r.libelleLieu), esc(n.lieu))}${ligne(esc(r.libelleZone), esc(n.zone))}${ligne('Type d\'écart', esc(typeDe(n.type)?.nom || ''))}${ligne('Origine', esc(origineDe(n.origine)?.nom || ''))}${ligne('Détecté par', esc(n.detectePar))}${ligne('Quantité ou étendue', esc(n.quantite))}${ligne('Référence photo', esc(n.photo))}${ligne('Description', esc(n.description).replace(/\n/g, '<br>'))}${ligne('Échéance de traitement', R.dateLongue(R.echeance(n, r)))}</table>
      <h2>Traitement immédiat</h2>
      <table>${ligne('Décision', esc(decisionDe(n.decision)?.nom || 'À décider'))}${ligne('Mesures prises', esc(n.traitement))}${ligne('Coût estimé', n.cout ? euros(n.cout) : '')}</table>
      <h2>2. Analyse des causes (5 pourquoi)</h2>
      ${n.analyse.pourquoi.length ? `<ol>${n.analyse.pourquoi.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : '<p class="vierge">Pourquoi 1 :<br>Pourquoi 2 :<br>Pourquoi 3 :<br>Pourquoi 4 :<br>Pourquoi 5 :</p>'}
      <table>${ligne('Cause racine', esc(n.analyse.racine) || '&nbsp;')}${ligne('Famille de cause', esc(causeDe(n.analyse.cause)?.nom || '') || '&nbsp;')}</table>
      <h2>3. Actions</h2>
      <table><thead><tr><th>Nature</th><th>Action</th><th>Responsable</th><th>Échéance</th><th>Faite le</th></tr></thead><tbody>${n.actions.map((a) => `<tr><td>${a.nature === 'preventive' ? 'Préventive' : 'Corrective'}</td><td>${esc(a.quoi)}</td><td>${esc(a.responsable)}</td><td>${R.dateFr(a.echeance)}</td><td>${R.dateFr(a.faite)}</td></tr>`).join('')}${n.actions.length ? '' : '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'}</tbody></table>
      <h2>4. Vérification d'efficacité</h2>
      ${n.verifications.length ? `<table><thead><tr><th>Date</th><th>Résultat</th><th>Par</th><th>Constat</th></tr></thead><tbody>${n.verifications.map((v) => `<tr><td>${R.dateFr(v.date)}</td><td>${v.efficace ? 'Efficace' : 'Inefficace'}</td><td>${esc(v.par)}</td><td>${esc(v.commentaire)}</td></tr>`).join('')}</tbody></table>` : `<p class="vierge">Date prévue : ${R.verifPrevue(n, r) ? R.dateFr(R.verifPrevue(n, r)) : '……'} · Résultat : ☐ efficace ☐ inefficace · Constat :</p>`}
      <h2>5. Clôture</h2>
      <div class="visas"><div><b>Clôturée le</b>${n.cloture ? R.dateFr(n.cloture.date) : ''}</div><div><b>Par</b>${n.cloture ? esc(n.cloture.par) : ''}</div><div><b>Visa</b></div></div>
      <footer>Fiche imprimée le ${R.dateLongue(t)}.</footer>`;
    window.print();
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
  function basculerAction(ncId, actionId) {
    const n = nc(ncId);
    const a = n?.actions.find((x) => x.id === actionId);
    if (!a || n.cloture) return;
    const act = memoriserAnnulation();
    a.faite = a.faite ? null : auj();
    sauver(); rendre();
    const e = R.etape(n);
    toast(a.faite ? (e === 'verification' ? `Toutes les actions de ${n.numero} sont faites : vérification ${quand(R.verifPrevue(n, reg()))}.` : 'Action faite.') : 'Action remise à faire.', act);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); changerVue('registre'); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'profil': {
        accueil.profil = id;
        const p = B.profils.find((x) => x.id === id);
        accueil.choisies = new Set([...(p ? p.zones : []), ...accueil.libres]);
        ecranAccueil(); break;
      }
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'choix-zone': if (el.checked) accueil.choisies.add(el.value); else accueil.choisies.delete(el.value); {
        const b = $('[data-action="accueil-fin"]');
        b.disabled = !accueil.choisies.size; b.textContent = `Créer mon registre (${accueil.choisies.size})`;
      } break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'ouvrir': changerVue('nc', id); break;
      case 'reglages': modaleReglages(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(id); break;
      case 'fermer': modale().close(); break;
      case 'nc-nouvelle': modaleConstat(); break;
      case 'nc-modifier': modaleConstat(id); break;
      case 'analyse': modaleAnalyse(id); break;
      case 'action-nouvelle': modaleAction(id); break;
      case 'action-modifier': modaleAction(id, el.dataset.actionId); break;
      case 'action-faite': basculerAction(id, el.dataset.actionId); break;
      case 'verifier': modaleVerification(id); break;
      case 'rouvrir': { const n = nc(id); const act = memoriserAnnulation(); n.cloture = null; sauver(); rendre(); toast(`${n.numero} rouverte.`, act); break; }
      case 'imprimer': imprimer(id); break;
      case 'filtre-etape': filtres.etape = filtres.etape === id ? 'ouvertes' : id; rendre(); break;
      case 'filtres-raz': filtres = { etape: 'tout', gravite: '', type: '', zone: '', texte: '' }; rendre(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action-change]');
    if (!el) return;
    if (el.dataset.actionChange === 'periode') { periode = el.value; rendre(); }
    if (el.dataset.actionChange === 'resp') { filtreResp = el.value; rendre(); }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('hashchange', () => { if (E && $('#vue')) { lireHash(); rendre(); } });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // changement de jour : retards à jour
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname + location.hash);
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
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__ncf = { etat: () => E };
  init();
})();
