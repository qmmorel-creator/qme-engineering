// Pilotage de parcs multi-sites QME : sites, équipements, interventions préventives et correctives,
// indicateurs par site et consolidés, alertes, liste et carte schématique, import et export CSV.
// Données synchronisées par clé de licence. Aucun fond de carte ni service externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'PRK';
  const CLE_CODE = 'qme-prk-code';
  const CLE_CACHE = 'qme-prk-cache';
  const CLE_DEMO = 'qme-prk-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-prk-ecran-accueil';
  const CLE_AFFICHAGE = 'qme-prk-affichage';
  const TAILLE_MAX = 900000;

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

  const { ajout, ecart, versDate, ajoutMois, dateFr, nombre } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? dateFr(s) : '–');
  const eur = (n, d = 0) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
  const pct = (x, d = 1) => (x === null || x === undefined ? '–' : `${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n < 0) return `il y a ${pluriel(-n, 'jour')}`;
    if (n < 45) return `dans ${pluriel(n, 'jour')}`;
    return `le ${fmtCourt(s)}`;
  };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let siteOuvert = null; // site ouvert dans l'onglet Sites
  let annulation = null;
  const pref = stock.lire(CLE_AFFICHAGE) || {};
  const affichage = { mode: pref.mode === 'carte' ? 'carte' : 'liste', tri: { cle: 'etat', sens: 1 }, filtre: { texte: '', region: '', type: '', etat: '' },
    eq: { site: '', categorie: '', etat: '' }, it: { type: '', site: '', ouverts: false } };
  const memoAffichage = () => stock.ecrire(CLE_AFFICHAGE, { mode: affichage.mode });

  const reglagesDefaut = () => ({ alerteJours: B.alerteJours, arretJours: B.arretJours, visiteMois: B.visiteMois, periodeJours: B.periodeJours });
  const COLLECTIONS = ['sites', 'equipements', 'interventions'];
  const etatVide = () => ({ version: 1, structure: '', reglages: reglagesDefaut(), ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])) });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) } };
    for (const c of COLLECTIONS) n[c] = Array.isArray(d[c]) ? d[c] : [];
    n.sites = n.sites.map((x) => ({ type: 'AUT', adresse: '', ville: '', region: '', responsable: '', lat: null, lon: null, notes: '', ...x }));
    n.equipements = n.equipements.map((x) => ({ categorie: 'AUT', marque: '', modele: '', miseEnService: '', criticite: 'moyenne', periodiciteMois: 12, reforme: false, notes: '', ...x }));
    return n;
  };
  const site = (id) => E.sites.find((s) => s.id === id);
  const equipement = (id) => E.equipements.find((e) => e.id === id);
  const intervention = (id) => E.interventions.find((i) => i.id === id);
  const sitesTries = () => [...E.sites].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const nomS = (id) => site(id)?.nom || 'Site supprimé';
  const lib = (liste, code) => liste.find((x) => x.code === code)?.nom || code || '';
  const typeCourt = (c) => B.typesSites.find((t) => t.code === c)?.court || c;
  const categorie = (c) => (c === 'SITE' ? B.categorieSite.nom : lib(B.categories, c));
  const optsInd = (siteIds = null) => ({ auj: auj(), periodeJours: E.reglages.periodeJours, alerteJours: E.reglages.alerteJours, siteIds });
  const periodeTexte = () => (E.reglages.periodeJours === 365 ? '12 derniers mois' : `${E.reglages.periodeJours} derniers jours`);

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
        toast('Un autre appareil a modifié le parc entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime les interventions les plus anciennes.');
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
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    if (E && E.sites.length) { cache(false); demarrer(); } else ecranAccueil();
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

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  // Exploitant fictif mêlant immobilier et équipements. Noms de sites inventés, villes servant
  // seulement de repère, coordonnées approximatives d'un centre-ville, aucun chiffre réel.
  // Couvre : préventif en retard et proche, arrêt au-delà du seuil et arrêt récent, équipement
  // dégradé, site sans visite depuis 8 mois, site sans aucune visite, sites sans coordonnées,
  // équipement réformé, préventifs réalisés en retard (taux à temps < 100 %).
  function donneesDemo() {
    const D = etatVide();
    D.structure = 'Exploitation multi-sites (exemple)';
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n) => ajoutMois(t, n);
    // [clé, nom, type, ville, région, responsable, lat, lon]
    const defs = [
      ['til', 'Résidence des Tilleuls', 'RES', 'Rennes', 'Bretagne', 'Claire M.', 48.112, -1.68],
      ['nord', 'Entrepôt Nord', 'ENT', 'Lille', 'Hauts-de-France', 'Thomas R.', 50.63, 3.06],
      ['hor', 'Immeuble Horizon', 'BUR', 'Lyon', 'Auvergne-Rhône-Alpes', 'Inès B.', 45.76, 4.84],
      ['parc', 'Centre commercial du Parc', 'COM', 'Toulouse', 'Occitanie', 'Hugo L.', 43.6, 1.44],
      ['sud', 'Plateforme Sud', 'ENT', 'Marseille', 'Provence-Alpes-Côte d\'Azur', 'Nadia K.', 43.3, 5.37],
      ['mar', 'Résidence Les Marronniers', 'RES', 'Nantes', 'Pays de la Loire', 'Claire M.', 47.218, -1.553],
      ['era', 'Groupe scolaire des Érables', 'ERP', 'Strasbourg', 'Grand Est', 'Julien P.', 48.573, 7.752],
      ['gare', 'Atelier de la Gare', 'IND', 'Dijon', 'Bourgogne-Franche-Comté', 'Sami D.', 47.322, 5.041],
      ['est', 'Local technique Est', 'TEC', '', 'Grand Est', 'Julien P.', null, null],
      ['port', 'Bureaux du Port', 'BUR', '', 'Nouvelle-Aquitaine', 'Léa F.', null, null],
    ];
    const S = {};
    for (const [k, nom, type, ville, region, responsable, lat, lon] of defs) {
      const s = { id: uid(), nom, type, adresse: '', ville, region, responsable, lat, lon, notes: '' };
      S[k] = s; D.sites.push(s);
    }
    S.til.notes = 'Gardien sur place le matin.';
    S.est.notes = 'Accès avec badge, prévenir 48 h avant.';
    const PREST = { CHA: 'Prestataire chauffage (fictif)', CVC: 'Prestataire climatisation (fictif)', ASC: 'Ascensoriste (fictif)', ELE: 'Électricien du secteur (fictif)', GEN: 'Prestataire énergie (fictif)',
      INC: 'Prestataire sécurité incendie (fictif)', ACC: 'Installateur sûreté (fictif)', POR: 'Prestataire portes automatiques (fictif)', PLO: 'Plombier du secteur (fictif)', MAN: 'Prestataire manutention (fictif)', FRO: 'Frigoriste (fictif)', ENR: 'Installateur énergie (fictif)', AUT: 'Équipe interne' };
    const COUT = { CHA: 380, CVC: 450, ASC: 290, ELE: 220, GEN: 340, INC: 180, ACC: 160, POR: 210, PLO: 150, MAN: 260, FRO: 320, ENR: 240, AUT: 90 };
    // [site, désignation, catégorie, mise en service (mois), criticité, périodicité, scénario]
    // scénario : 'ok' (à jour), 'retard' (dernier préventif non fait), 'proche' (échéance dans moins de 30 jours), 'vieux' (rien depuis 8 mois).
    const E2 = [
      ['til', 'Chaudière collective', 'CHA', -96, 'haute', 12, 'proche'],
      ['til', 'Ascenseur bâtiment A', 'ASC', -140, 'haute', 3, 'ok'],
      ['til', 'Porte de parking', 'POR', -70, 'moyenne', 6, 'retard'],
      ['til', 'Éclairage des parties communes', 'ELE', -60, 'basse', 12, 'ok'],
      ['nord', 'Porte sectionnelle quai 1', 'POR', -50, 'haute', 6, 'ok'],
      ['nord', 'Niveleur de quai 1', 'MAN', -50, 'moyenne', 12, 'ok'],
      ['nord', 'Sprinklers', 'INC', -80, 'haute', 6, 'ok'],
      ['nord', 'Chauffage par aérothermes', 'CHA', -80, 'moyenne', 12, 'retard'],
      ['hor', 'Ascenseur principal', 'ASC', -110, 'haute', 3, 'ok'],
      ['hor', 'Centrale de traitement d\'air', 'CVC', -62, 'haute', 6, 'ok'],
      ['hor', 'Contrôle d\'accès du hall', 'ACC', -36, 'moyenne', 12, 'proche'],
      ['hor', 'Onduleur de la salle serveurs', 'GEN', -30, 'haute', 12, 'ok'],
      ['parc', 'Climatisation de la galerie', 'CVC', -72, 'haute', 6, 'ok'],
      ['parc', 'Portes automatiques entrée', 'POR', -40, 'haute', 6, 'ok'],
      ['parc', 'Système de sécurité incendie', 'INC', -90, 'haute', 12, 'ok'],
      ['parc', 'Vitrines réfrigérées', 'FRO', -28, 'moyenne', 6, 'proche'],
      ['sud', 'Chariot élévateur électrique', 'MAN', -44, 'moyenne', 12, 'vieux'],
      ['sud', 'Portail coulissant', 'POR', -60, 'basse', 12, 'vieux'],
      ['mar', 'Chaufferie gaz', 'CHA', -150, 'haute', 12, 'ok'],
      ['mar', 'Surpresseur d\'eau', 'PLO', -84, 'moyenne', 12, 'ok'],
      ['mar', 'VMC collective', 'CVC', -84, 'moyenne', 12, 'retard'],
      ['era', 'Chaudière', 'CHA', -120, 'haute', 12, 'ok'],
      ['era', 'Alarme incendie', 'INC', -66, 'haute', 6, 'ok'],
      ['era', 'Panneaux solaires', 'ENR', -20, 'basse', 12, 'ok'],
      ['gare', 'Compresseur d\'air', 'AUT', -48, 'moyenne', 6, 'ok'],
      ['gare', 'Groupe électrogène', 'GEN', -100, 'haute', 12, 'ok'],
      ['gare', 'Pont roulant', 'MAN', -130, 'haute', 6, 'reforme'],
      ['est', 'Armoire électrique principale', 'ELE', -90, 'haute', 12, 'ok'],
      ['est', 'Climatisation du local', 'CVC', -40, 'moyenne', 12, 'ok'],
      ['port', 'Borne de recharge', 'ENR', -2, 'basse', 12, 'neuf'],
    ];
    const Q = {};
    E2.forEach(([sk, designation, cat, mes, criticite, periodiciteMois, scen], k) => {
      const e = { id: uid(), siteId: S[sk].id, designation, categorie: cat, marque: '', modele: '', miseEnService: m(mes), criticite, periodiciteMois, reforme: scen === 'reforme', notes: '' };
      if (scen === 'reforme') e.notes = 'Remplacé par un palan, sorti du parc.';
      D.equipements.push(e);
      Q[`${sk}:${designation}`] = e;
      if (scen === 'neuf') return;
      // Dernier préventif réalisé selon le scénario, puis historique reconstitué à rebours sur 26 mois
      // au plus : chaque préventif est noté avec l'échéance calculée ce jour-là (avance ou retard de
      // -20 à +6 jours, déterministe), comme le ferait la vraie saisie.
      const base0 = ajoutMois(t, -periodiciteMois);
      const L = { ok: ajout(base0, 45 + ((k * 17) % Math.max(1, periodiciteMois * 30 - 55))), proche: ajout(base0, 8 + (k % 15)),
        retard: ajout(base0, -(20 + ((k * 7) % 40))), vieux: ajout(m(-8), -(k % 10)), reforme: m(-10) }[scen];
      const limite = e.miseEnService > m(-26) ? e.miseEnService : m(-26);
      const dates = [L];
      for (let n = 1; n < 40; n++) {
        const jit = ((k * 7 + n * 11) % 27) - 20;
        const prec = ajout(ajoutMois(dates[0], -periodiciteMois), -jit);
        if (prec < limite) break;
        dates.unshift(prec);
      }
      dates.forEach((date, n) => {
        if (date <= e.miseEnService) return;
        const echeance = n ? ajoutMois(dates[n - 1], periodiciteMois) : ajout(date, -(((k * 7) % 27) - 20));
        D.interventions.push({ id: uid(), type: 'preventif', siteId: e.siteId, equipementId: e.id, date, echeance, prestataire: PREST[cat], cout: COUT[cat] + (n % 3) * 15, libelle: periodiciteMois <= 3 ? 'Visite d\'entretien périodique' : 'Visite préventive' });
      });
    });
    // Correctifs : résolus (délais variés), un arrêt au-delà du seuil, un arrêt récent, un équipement dégradé.
    const cor = (cle, signale, resolu, arret, libelle, cout) => {
      const e = Q[cle];
      D.interventions.push({ id: uid(), type: 'correctif', siteId: e.siteId, equipementId: e.id, signale: j(signale), resolu: resolu === null ? '' : j(resolu), arret, libelle, prestataire: PREST[e.categorie], cout: cout === null ? '' : cout });
    };
    cor('nord:Porte sectionnelle quai 1', -12, null, true, 'Moteur bloqué, porte en position fermée', null);
    cor('hor:Ascenseur principal', -3, null, true, 'Arrêt en défaut de porte palière', null);
    cor('mar:Surpresseur d\'eau', -6, null, false, 'Pression faible aux étages hauts', null);
    cor('til:Ascenseur bâtiment A', -48, -46, true, 'Bouton d\'appel hors service', 140);
    cor('til:Chaudière collective', -230, -226, true, 'Brûleur en sécurité', 420);
    cor('nord:Niveleur de quai 1', -95, -80, true, 'Vérin hydraulique à remplacer', 1260);
    cor('nord:Sprinklers', -150, -149, false, 'Fuite sur une tête', 190);
    cor('hor:Centrale de traitement d\'air', -60, -57, false, 'Courroie usée', 230);
    cor('hor:Contrôle d\'accès du hall', -20, -19, false, 'Lecteur de badge défaillant', 160);
    cor('parc:Climatisation de la galerie', -130, -121, true, 'Compresseur en panne', 2350);
    cor('parc:Portes automatiques entrée', -35, -34, true, 'Radar d\'ouverture déréglé', 175);
    cor('parc:Vitrines réfrigérées', -70, -68, false, 'Dégivrage défaillant', 310);
    cor('mar:Chaufferie gaz', -300, -296, true, 'Circulateur bloqué', 380);
    cor('era:Chaudière', -40, -38, true, 'Sonde de température défectueuse', 210);
    cor('era:Alarme incendie', -180, -180, false, 'Détecteur encrassé', 90);
    cor('gare:Compresseur d\'air', -110, -103, true, 'Fuite sur le réservoir', 640);
    cor('gare:Groupe électrogène', -25, -22, false, 'Batterie de démarrage faible', 260);
    cor('est:Armoire électrique principale', -160, -158, true, 'Disjoncteur différentiel déclenché', 180);
    cor('sud:Chariot élévateur électrique', -330, -320, true, 'Batterie de traction', 1850);
    // Visites de site (tournées du responsable).
    for (const [k2, d] of [['til', -15], ['nord', -30], ['hor', -9], ['parc', -22], ['mar', -40], ['era', -60], ['gare', -18], ['est', -75], ['sud', -250]]) {
      D.interventions.push({ id: uid(), type: 'visite', siteId: S[k2].id, equipementId: '', date: j(d), libelle: 'Tournée de site', prestataire: 'Équipe interne', cout: '' });
    }
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Pilotage de parcs multi-sites · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="110" height="220" fill="#1D4E89"/>
          <rect x="40" y="70" width="24" height="24" fill="#F0EDE6"/><rect x="86" y="70" width="24" height="24" fill="#F0EDE6"/><rect x="40" y="120" width="24" height="24" fill="#F0EDE6"/><rect x="86" y="120" width="24" height="24" fill="#F0EDE6"/>
          <rect x="160" y="130" width="150" height="130" fill="#F5B400"/>
          <path d="M160 130 L235 70 L310 130 Z" fill="#141414"/>
          <circle cx="420" cy="110" r="70" fill="#D9302A"/><circle cx="420" cy="110" r="22" fill="#F0EDE6"/>
          <path d="M420 180 L420 260" stroke="#141414" stroke-width="10"/>
          <rect x="340" y="250" width="200" height="10" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Pilotage de parcs multi-sites</p>
          <h1>Tous tes sites, une seule vue.</h1>
          <p>Sites, équipements, préventif et correctif, disponibilité, coûts par site, alertes et carte schématique. Import et export pour ton tableur.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton parc</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon parc</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/parcs-multi-sites/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon parc'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const options = (liste, choisi) => liste.map((x) => `<option value="${x.code}" ${x.code === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const listeRegions = () => `<datalist id="regions">${[...new Set([...B.regions, ...E.sites.map((s) => s.region).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'fr')).map((r) => `<option value="${esc(r)}"></option>`).join('')}</datalist>`;

  function ecranAccueil() {
    document.title = 'Bienvenue · Pilotage de parcs multi-sites';
    E = E || etatVide();
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ton premier site.</h1>
        <p class="intro">Commence par un site : tu y ajouteras ses équipements, puis les interventions. Tu as déjà une liste dans un tableur ? Crée ce premier site, puis importe les autres depuis l'onglet Sites (modèle CSV fourni).</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Ta structure <small>Facultatif : en tête des exports.</small><input name="structure" maxlength="80" placeholder="Ex. : Service patrimoine"></label>
            <label class="champ">Nom du site<input name="nom" required maxlength="80" placeholder="Ex. : Résidence des Tilleuls"></label>
            <label class="champ">Type<select name="type">${options(B.typesSites, 'BUR')}</select></label>
            <label class="champ">Ville<input name="ville" maxlength="60"></label>
            <label class="champ">Région <small>Ou secteur, agence : texte libre.</small><input name="region" maxlength="60" list="regions"></label>
            <label class="champ">Responsable<input name="responsable" maxlength="60" placeholder="Ex. : Claire M."></label>
          </div>
          ${listeRegions()}
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer le site</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const err = e.target.querySelector('.erreur');
      const nom = texte(f, 'nom');
      if (!nom) { err.textContent = 'Indique le nom du site.'; return; }
      E = etatVide();
      E.structure = texte(f, 'structure');
      const s = { id: uid(), nom, type: f.get('type'), adresse: '', ville: texte(f, 'ville'), region: texte(f, 'region'), responsable: texte(f, 'responsable'), lat: null, lon: null, notes: '' };
      E.sites.push(s);
      sauver();
      siteOuvert = s.id; vue = 'sites';
      demarrer();
      toast(`${nom} créé : ajoute ses équipements.`);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    sites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="var(--papier)"/></svg>',
    equipements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    interventions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    indicateurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#D9302A"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Alertes'], ['sites', 'Sites'], ['equipements', 'Équipements'], ['interventions', 'Interventions'], ['indicateurs', 'Indicateurs']];
  const COURTS = { equipements: 'Équip.', interventions: 'Journal', indicateurs: 'Chiffres' };
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    if (siteOuvert && !site(siteOuvert)) siteOuvert = null;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/parcs-multi-sites/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Sites et chiffres fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Parcs<br>multi-sites</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide" title="Guide">${ICONES.guide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, import et export" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { ...Object.fromEntries(ONGLETS), guide: 'Guide' };
    document.title = `${vue === 'sites' && siteOuvert ? site(siteOuvert)?.nom : titres[vue]} · Parcs multi-sites`;
    $('#vue').innerHTML = { bord: vueBord, sites: () => (siteOuvert ? vueSite(site(siteOuvert)) : vueSites()), equipements: vueEquipements, interventions: vueInterventions, indicateurs: vueIndicateurs, guide: vueGuide }[vue]();
    brancherBulles();
    brancherCarte();
  }

  function changerVue(v) {
    vue = v;
    if (v !== 'sites') siteOuvert = null;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  function ouvrirSite(id) { siteOuvert = id; vue = 'sites'; history.replaceState(null, '', '#sites'); rendre(); window.scrollTo({ top: 0 }); $('#vue').focus({ preventScroll: true }); }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texteV, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${FORME_VIDE}<div><h3>${titre}</h3><p>${texteV}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ETAT_SITE = { retard: ['rouge', 'En retard'], proche: ['jaune', 'À surveiller'], ok: ['bleu', 'À jour'] };
  const ETAT_EQ = { service: ['bleu', 'En service'], degrade: ['jaune', 'Dégradé'], arret: ['rouge', 'À l\'arrêt'], reforme: ['gris', 'Réformé'] };
  const ETAT_PREV = { retard: ['rouge', 'En retard'], proche: ['jaune', 'À prévoir'], ok: ['gris', 'À jour'], sans: ['gris', 'Sans préventif'] };
  const tuile = (libT, v, d, c, forme = '', act = '') => `<${act ? `button data-action="${act}"` : 'div'} class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${libT}</p><b>${v}</b><span>${d}</span></${act ? 'button' : 'div'}>`;
  const nbJ = (x) => (x === null ? '–' : x.toLocaleString('fr-FR', { maximumFractionDigits: 1 }));

  // ---------- Vue Alertes (tableau de bord) ----------
  function vueBord() {
    const t = auj();
    const al = R.alertes(E, B, t);
    const ind = R.indicateurs(E, B, optsInd());
    const retards = al.filter((a) => a.etat === 'retard').length;
    const ouverts = E.interventions.filter((i) => i.type === 'correctif' && !i.resolu).sort((a, b) => a.signale.localeCompare(b.signale));
    const titre = !al.length ? '<mark>Rien à signaler</mark> : tous les sites sont à jour.'
      : retards ? `<mark>${pluriel(retards, 'alerte', 'alertes')} en retard</mark>, ${pluriel(al.length - retards, 'autre à surveiller', 'autres à surveiller')}.` : `${pluriel(al.length, 'point')} à surveiller, <mark>aucun retard</mark>.`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Ton parc')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="intervention-nouvelle" data-type="visite">Visite</button><button class="btn primaire" data-action="intervention-nouvelle" data-type="correctif">${ICONES.plus}Signaler une panne</button></div></div>
      <div class="tuiles">
        ${tuile('Sites', E.sites.filter((s) => !s.inactif).length, `${pluriel(ind.equipements, 'équipement')} suivis`, 'var(--encre)', 'rond', 'aller-sites')}
        ${tuile('À l\'arrêt', ind.arret, ind.degrade ? `${pluriel(ind.degrade, 'autre dégradé', 'autres dégradés')}` : 'Aucun équipement dégradé', 'var(--rouge)', '', 'aller-equipements-arret')}
        ${tuile('Préventifs en retard', ind.enRetard, `${pluriel(ind.proches, 'autre', 'autres')} dans les ${E.reglages.alerteJours} jours`, 'var(--jaune)')}
        ${tuile('Disponibilité', ind.disponibilite === null ? '–' : `${(ind.disponibilite * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small>%</small>`, `Moyenne du parc, ${periodeTexte()}`, 'var(--bleu)', 'rond', 'aller-indicateurs')}
      </div>
      <h2 class="titre-section">Alertes <span>Retards d'abord, puis par date. Touche une ligne pour agir.</span></h2>
      ${al.length ? `<div class="bloc-liste">${al.map((a) => ligneAlerte(a, t)).join('')}</div>` : vide('Tout est à jour', 'Aucun préventif dû, aucun arrêt, aucun site oublié.', '', true)}
      <h2 class="titre-section">Correctifs ouverts <span>${pluriel(ouverts.length, 'panne')} en cours de traitement.</span></h2>
      ${ouverts.length ? `<div class="bloc-liste">${ouverts.map(ligneIntervention).join('')}</div>` : '<p class="note">Aucune panne en cours.</p>'}`;
  }

  function ligneAlerte(a, t) {
    const eq = a.equipementId ? equipement(a.equipementId) : null;
    const n = a.date ? ecart(t, a.date) : null;
    const pastille = a.etat === 'retard'
      ? `<span class="etiquette rouge">${a.type === 'visite' ? `${E.reglages.visiteMois + Math.floor(Math.max(0, -n) / 30)} m` : n !== null && n < 0 ? `${-n} j` : 'dû'}</span>`
      : `<span class="etiquette jaune">${a.type === 'visite' ? 'visite' : a.type === 'arret' ? 'arrêt' : n === 0 ? 'auj.' : `${n} j`}</span>`;
    const act = a.type === 'preventif' ? `data-action="intervention-nouvelle" data-type="preventif" data-equipement="${a.equipementId}"`
      : a.type === 'arret' ? `data-action="intervention-modifier" data-id="${a.interventionId}"`
      : `data-action="site" data-id="${a.siteId}"`;
    const quoi = eq ? `${esc(eq.designation)} · ${esc(nomS(a.siteId))}` : esc(nomS(a.siteId));
    return `<button class="ligne-retard" ${act}>${pastille}<span><b>${esc(a.titre)} · ${quoi}</b><small>${esc(a.detail)}${eq ? ` · ${esc(categorie(eq.categorie))}` : ''}</small></span></button>`;
  }

  function ligneIntervention(i) {
    const eq = i.equipementId ? equipement(i.equipementId) : null;
    const t = auj();
    let etiq, date, detail;
    if (i.type === 'correctif') {
      const ouvert = !i.resolu;
      etiq = ouvert ? `<span class="etiquette ${i.arret ? 'rouge' : 'jaune'}">${i.arret ? 'arrêt' : 'ouvert'}</span>` : '<span class="etiquette gris">résolu</span>';
      date = ouvert ? i.signale : i.resolu;
      detail = ouvert ? `Signalé le ${fmtCourt(i.signale)}, ouvert depuis ${pluriel(Math.max(0, ecart(i.signale, t)), 'jour')}` : `Signalé le ${fmtCourt(i.signale)}, résolu en ${pluriel(Math.max(0, ecart(i.signale, i.resolu)), 'jour')}`;
    } else if (i.type === 'preventif') {
      const enRetard = i.echeance && i.date > i.echeance;
      etiq = `<span class="etiquette ${enRetard ? 'jaune' : 'bleu'}">prév.</span>`;
      date = i.date;
      detail = `Réalisé le ${fmtCourt(i.date)}${i.echeance ? (enRetard ? `, ${pluriel(ecart(i.echeance, i.date), 'jour')} après l'échéance` : ', dans les temps') : ''}`;
    } else {
      etiq = '<span class="etiquette contour">visite</span>';
      date = i.date;
      detail = `Visite le ${fmtCourt(i.date)}`;
    }
    return `<button class="ligne-int" data-action="intervention-modifier" data-id="${i.id}">${etiq}<span><b>${eq ? `${esc(eq.designation)} · ` : ''}${esc(nomS(i.siteId))}</b><small>${esc(i.libelle || lib(B.typesInterventions, i.type))} · ${detail}${i.prestataire ? ` · ${esc(i.prestataire)}` : ''}</small></span><span class="nb">${i.cout !== '' && i.cout != null ? eur(nombre(i.cout)) : ''}<small>${fmt(date)}</small></span></button>`;
  }

  // ---------- Vue Sites : liste triable et filtrable, ou carte schématique ----------
  function lignesSites() {
    const al = R.alertes(E, B, auj());
    return E.sites.map((s) => ({ site: s, ind: R.indicateurs(E, B, optsInd([s.id])), etat: R.etatSite(al, s.id), alertes: al.filter((a) => a.siteId === s.id) }));
  }

  function vueSites() {
    const toutes = lignesSites();
    const f = affichage.filtre;
    const lignes = R.trierSites(R.filtrerSites(toutes, f), affichage.tri);
    const regions = [...new Set(E.sites.map((s) => s.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const types = B.typesSites.filter((ty) => E.sites.some((s) => s.type === ty.code));
    const filtres = `
      <div class="filtres filtres-sites" role="search">
        <label class="champ recherche">Rechercher<input type="search" id="f-texte" value="${esc(f.texte)}" placeholder="Nom, ville, responsable…"></label>
        <label class="champ">Région<select id="f-region"><option value="">Toutes</option>${regions.map((r) => `<option ${r === f.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="champ">Type<select id="f-type"><option value="">Tous</option>${types.map((ty) => `<option value="${ty.code}" ${ty.code === f.type ? 'selected' : ''}>${esc(ty.court)}</option>`).join('')}</select></label>
        <label class="champ">État<select id="f-etat"><option value="">Tous</option><option value="alerte" ${f.etat === 'alerte' ? 'selected' : ''}>Avec alerte</option><option value="retard" ${f.etat === 'retard' ? 'selected' : ''}>En retard</option><option value="ok" ${f.etat === 'ok' ? 'selected' : ''}>À jour</option></select></label>
        <label class="champ tri-petit">Trier par<select id="f-tri">${COLS_SITES.map(([k, l2]) => `<option value="${k}" ${k === affichage.tri.cle ? 'selected' : ''}>${l2}</option>`).join('')}</select></label>
      </div>`;
    const bascule = `<div class="bascule-vue" role="group" aria-label="Affichage"><button class="btn petit" data-action="mode-sites" data-mode="liste" aria-pressed="${affichage.mode === 'liste'}">Liste</button><button class="btn petit" data-action="mode-sites" data-mode="carte" aria-pressed="${affichage.mode === 'carte'}">Carte</button></div>`;
    return `
      <div class="vue-tete"><div><h1>Sites</h1><p>${pluriel(E.sites.length, 'site')} · état, disponibilité et coût sur les ${periodeTexte()}. Ouvre un site pour ses équipements et son historique.</p></div>
        <div class="actions"><button class="btn" data-action="import">Importer (CSV)</button><button class="btn" data-action="csv-sites">Exporter</button><button class="btn primaire" data-action="site-nouveau">${ICONES.plus}Site</button></div></div>
      ${E.sites.length ? `${bascule}${filtres}
      <p class="note compte-filtre">${lignes.length === toutes.length ? pluriel(lignes.length, 'site affiché', 'sites affichés') : `${lignes.length} sur ${toutes.length} sites (filtres actifs) · <button class="btn lien" data-action="filtres-raz">Tout afficher</button>`}</p>
      ${affichage.mode === 'carte' ? vueCarte(lignes) : listeSites(lignes)}` : vide('Aucun site', 'Ajoute ton premier site, ou importe ta liste depuis un tableur.', `<button class="btn" data-action="import">Importer (CSV)</button><button class="btn primaire" data-action="site-nouveau">${ICONES.plus}Site</button>`)}`;
  }
  const COLS_SITES = [['etat', 'État'], ['nom', 'Site'], ['ville', 'Ville'], ['region', 'Région'], ['equipements', 'Équipements'], ['disponibilite', 'Disponibilité'], ['retards', 'Préventifs en retard'], ['delai', 'Délai de résolution'], ['cout', 'Coût']];

  function listeSites(lignes) {
    if (!lignes.length) return vide('Aucun site ne correspond', 'Change ou efface les filtres.', '<button class="btn" data-action="filtres-raz">Tout afficher</button>', true);
    const th = ([k, l2], cls = '') => {
      const actif = affichage.tri.cle === k;
      return `<th class="${cls}" aria-sort="${actif ? (affichage.tri.sens > 0 ? 'ascending' : 'descending') : 'none'}"><button class="tri" data-action="tri" data-cle="${k}">${l2}<i aria-hidden="true">${actif ? (affichage.tri.sens > 0 ? '▲' : '▼') : ''}</i></button></th>`;
    };
    const nbCols = new Set(['equipements', 'disponibilite', 'retards', 'delai', 'cout']);
    return `
      <div class="defile seulement-grand"><table class="tableau sites"><thead><tr>${COLS_SITES.map((c) => th(c, nbCols.has(c[0]) ? 'nb' : '')).join('')}</tr></thead><tbody>
        ${lignes.map(({ site: s, ind, etat }) => `<tr>
          <td><span class="etiquette ${ETAT_SITE[etat][0]}">${ETAT_SITE[etat][1]}</span></td>
          <td><button class="lien-v" data-action="site" data-id="${s.id}"><b>${esc(s.nom)}</b><small>${esc(typeCourt(s.type))}${s.responsable ? ` · ${esc(s.responsable)}` : ''}</small></button></td>
          <td>${esc(s.ville || '–')}</td><td>${esc(s.region || '–')}</td>
          <td class="nb">${ind.equipements}${ind.arret ? ` <small class="txt-rouge">${ind.arret} à l'arrêt</small>` : ''}</td>
          <td class="nb">${pct(ind.disponibilite)}</td>
          <td class="nb">${ind.enRetard ? `<b class="txt-rouge">${ind.enRetard}</b>` : '0'}</td>
          <td class="nb">${ind.delaiMoyen === null ? '–' : `${nbJ(ind.delaiMoyen)} j`}</td>
          <td class="nb">${eur(ind.cout)}</td></tr>`).join('')}
      </tbody></table></div>
      <ul class="cartes-sites seulement-petit">${lignes.map(carteSite).join('')}</ul>`;
  }

  function carteSite({ site: s, ind, etat, alertes: al }) {
    return `<li><button class="carte-site" data-action="site" data-id="${s.id}" style="--c:${COUL[etat]}">
      <span class="cs-tete"><span class="etiquette ${ETAT_SITE[etat][0]}">${ETAT_SITE[etat][1]}</span><small>${esc([typeCourt(s.type), s.ville, s.region].filter(Boolean).join(' · '))}</small></span>
      <b>${esc(s.nom)}</b>
      <span class="cs-chiffres"><span><b>${ind.equipements}</b> équip.</span><span><b>${pct(ind.disponibilite, 0)}</b> dispo.</span><span><b>${eur(ind.cout)}</b></span></span>
      ${al.length ? `<small class="cs-alerte">${esc(al[0].titre)}${al[0].equipementId ? ` · ${esc(equipement(al[0].equipementId)?.designation || '')}` : ''}${al.length > 1 ? ` (+${al.length - 1})` : ''}</small>` : ''}
    </button></li>`;
  }
  const COUL = { retard: 'var(--rouge)', proche: 'var(--jaune)', ok: 'var(--bleu)' };

  // Carte schématique : points placés par leurs coordonnées (aucun fond de carte), forme et couleur
  // selon l'état ; sites sans coordonnées en grille par région.
  const FORME_ETAT = {
    ok: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2E5A88" stroke="#FFFFFF" stroke-width="2"/>`,
    proche: (x, y, r) => `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" fill="#E8B93A" stroke="#24221F" stroke-width="1.5"/>`,
    retard: (x, y, r) => `<path d="M${x} ${y - r * 1.15} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8} Z" fill="#B84A34" stroke="#FFFFFF" stroke-width="2"/>`,
  };
  function legendeCarte() {
    return `<div class="legende carte-legende">${[['ok', 'À jour'], ['proche', 'À surveiller'], ['retard', 'En retard']].map(([k, l2]) => `<span><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${FORME_ETAT[k](10, 10.5, 7)}</svg>${l2}</span>`).join('')}</div>`;
  }
  function vueCarte(lignes) {
    if (!lignes.length) return vide('Aucun site ne correspond', 'Change ou efface les filtres.', '<button class="btn" data-action="filtres-raz">Tout afficher</button>', true);
    const etroit = matchMedia('(max-width:640px)').matches;
    const L = Math.round(Math.max(320, Math.min(1140, (document.querySelector("#vue")?.clientWidth || innerWidth) - (etroit ? 26 : 50)))), H = Math.round(etroit ? L * 1.2 : Math.min(560, L * 0.56));
    const p = R.projeter(lignes.map((x) => x.site), L, H, etroit ? 36 : 56);
    const sans = lignes.filter((x) => !R.aCoordonnees(x.site));
    let svg = '';
    if (p) {
      const par = Object.fromEntries(lignes.map((x) => [x.site.id, x]));
      // Quadrillage discret tous les degrés (repère, pas un fond de carte).
      const k = Math.cos(((p.bornes.latMin + p.bornes.latMax) / 2) * Math.PI / 180);
      const pts = p.points.map((q) => ({ ...q, l: par[q.id] }));
      const ref = pts[0];
      const lon2x = (lon) => ref.x + (lon - ref.l.site.lon) * k * p.echelle;
      const lat2y = (lat) => ref.y - (lat - ref.l.site.lat) * p.echelle;
      const grille = [];
      for (let lon = Math.floor(p.bornes.lonMin) - 12; lon <= Math.ceil(p.bornes.lonMax) + 12; lon++) { const x = lon2x(lon); if (x > 0 && x < L) grille.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"/>`); }
      for (let lat = Math.floor(p.bornes.latMin) - 8; lat <= Math.ceil(p.bornes.latMax) + 8; lat++) { const y = lat2y(lat); if (y > 0 && y < H) grille.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${L}" y2="${y.toFixed(1)}"/>`); }
      // Étiquettes : à droite du point, sinon à gauche, sinon masquées (visibles au survol).
      const pris = [];
      const libre = (b) => b.x0 >= 2 && b.x1 <= L - 2 && b.y0 >= 2 && b.y1 <= H - 2 && !pris.some((q) => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1);
      const tailleTxt = etroit ? 11.5 : 13;
      pts.sort((a, b) => ({ retard: 0, proche: 1, ok: 2 }[a.l.etat] - { retard: 0, proche: 1, ok: 2 }[b.l.etat]));
      for (const q of pts) pris.push({ x0: q.x - 10, x1: q.x + 10, y0: q.y - 10, y1: q.y + 10 });
      const marques = pts.map((q) => {
        const nom = q.l.site.nom;
        const w = nom.length * tailleTxt * 0.55 + 4, h = tailleTxt + 4;
        const droite = { x0: q.x + 12, x1: q.x + 12 + w, y0: q.y - h / 2, y1: q.y + h / 2 };
        const gauche = { x0: q.x - 12 - w, x1: q.x - 12, y0: q.y - h / 2, y1: q.y + h / 2 };
        const dessous = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y + 12, y1: q.y + 12 + h };
        const dessus = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - 12 - h, y1: q.y - 12 };
        const place = [droite, gauche, dessous, dessus].find(libre);
        if (place) pris.push(place);
        const txt = place ? `<text x="${place === droite ? place.x0 + 2 : place === gauche ? place.x1 - 2 : q.x}" y="${(place.y0 + place.y1) / 2 + tailleTxt * 0.35}" text-anchor="${place === droite ? 'start' : place === gauche ? 'end' : 'middle'}" font-size="${tailleTxt}">${esc(nom)}</text>` : '';
        const etat = q.l.etat;
        return `<g class="point" data-action="site" data-id="${q.id}" data-bulle="${esc(bulleSite(q.l))}" tabindex="0" role="button" aria-label="${esc(nom)}, ${ETAT_SITE[etat][1]}">
          <circle cx="${q.x}" cy="${q.y}" r="20" fill="transparent"/>${FORME_ETAT[etat](q.x, q.y, etroit ? 9 : 11)}${txt}</g>`;
      }).join('');
      svg = `<figure class="carte-svg bulles">
        <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Carte schématique de ${pluriel(pts.length, 'site')} placés par leurs coordonnées">
          <rect width="${L}" height="${H}" fill="var(--surface)"/>
          <g class="quadrillage">${grille.join('')}</g>
          <g class="boussole" transform="translate(${L - 30} 34)"><path d="M0 -16 L6 4 L0 0 L-6 4 Z" fill="#24221F"/><text y="16" text-anchor="middle" font-size="11">N</text></g>
          ${marques}
        </svg>
        <div class="infobulle" hidden></div>
        <figcaption>Carte schématique : chaque site est placé selon la latitude et la longitude saisies, sans fond de carte. Touche un point pour ouvrir le site.</figcaption>
      </figure>`;
    }
    const grille = sans.length ? `<h2 class="titre-section">${p ? 'Sites sans coordonnées' : 'Sites par région'} <span>${p ? 'Ajoute latitude et longitude dans la fiche du site pour les placer sur la carte.' : 'Aucun site n\'a de coordonnées : ils sont regroupés par région. Ajoute latitude et longitude pour la carte.'}</span></h2>
      <div class="grille-regions">${R.grilleRegions(sans.map((x) => x.site)).map((g) => `<section class="region"><h3>${esc(g.region)}</h3><ul>${g.sites.map((s) => { const l = sans.find((x) => x.site.id === s.id); return `<li><button class="pastille-site" data-action="site" data-id="${s.id}"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${FORME_ETAT[l.etat](10, 10.5, 7)}</svg><span><b>${esc(s.nom)}</b><small>${ETAT_SITE[l.etat][1]}${s.ville ? ` · ${esc(s.ville)}` : ''}</small></span></button></li>`; }).join('')}</ul></section>`).join('')}</div>` : '';
    return `${legendeCarte()}${svg}${grille}`;
  }
  function bulleSite(l) {
    const i = l.ind;
    return [`<b>${esc(l.site.nom)}</b>`, `${ETAT_SITE[l.etat][1]}${l.alertes.length ? ` · ${pluriel(l.alertes.length, 'alerte')}` : ''}`, `${pluriel(i.equipements, 'équipement')} · disponibilité ${pct(i.disponibilite)}`, `Coût : ${eur(i.cout)}`].map((x) => `<div>${x}</div>`).join('');
  }

  // ---------- Fiche site ----------
  function vueSite(s) {
    if (!s) { siteOuvert = null; return vueSites(); }
    const t = auj();
    const ind = R.indicateurs(E, B, optsInd([s.id]));
    const al = R.alertes(E, B, t).filter((a) => a.siteId === s.id);
    const eqs = E.equipements.filter((e) => e.siteId === s.id).sort((a, b) => !!a.reforme - !!b.reforme || a.designation.localeCompare(b.designation, 'fr'));
    const its = E.interventions.filter((i) => i.siteId === s.id).sort((a, b) => (dateI(b)).localeCompare(dateI(a)));
    const visite = R.derniereVisite(E, s.id, t);
    const cats = Object.entries(ind.parCategorie).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    return `
      <p class="fil"><button class="btn lien" data-action="vue" data-vue="sites">← Tous les sites</button></p>
      <div class="vue-tete fiche-tete"><div><p class="surtitre">${esc([typeCourt(s.type), s.ville, s.region].filter(Boolean).join(' · '))}${s.inactif ? ' · inactif' : ''}</p>
        <h1>${esc(s.nom)}</h1>
        <p>${[s.adresse && esc(s.adresse), s.responsable && `Responsable : <b>${esc(s.responsable)}</b>`, `Dernière visite : <b>${visite ? fmtCourt(visite) : 'aucune'}</b>`, R.aCoordonnees(s) ? `GPS ${String(s.lat).replace('.', ',')} ; ${String(s.lon).replace('.', ',')}` : ''].filter(Boolean).join(' · ')}</p></div>
        <div class="actions"><button class="btn" data-action="site-modifier" data-id="${s.id}">Modifier</button><button class="btn" data-action="intervention-nouvelle" data-type="visite" data-site="${s.id}">Visite</button><button class="btn primaire" data-action="intervention-nouvelle" data-type="correctif" data-site="${s.id}">${ICONES.plus}Panne</button></div></div>
      <div class="tuiles">
        ${tuile('Disponibilité', ind.disponibilite === null ? '–' : `${(ind.disponibilite * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small>%</small>`, `${pluriel(ind.equipements, 'équipement')}, ${periodeTexte()}`, 'var(--bleu)', 'rond')}
        ${tuile('Préventifs en retard', ind.enRetard, `Taux à temps : ${pct(ind.tauxATemps, 0)}`, 'var(--rouge)')}
        ${tuile('Délai de résolution', ind.delaiMoyen === null ? '–' : `${nbJ(ind.delaiMoyen)}<small>j</small>`, `${pluriel(ind.resolus, 'panne résolue', 'pannes résolues')} · ${pluriel(ind.correctifsOuverts, 'ouverte')}`, 'var(--jaune)')}
        ${tuile('Coût', `${Math.round(ind.cout).toLocaleString('fr-FR')}<small>€</small>`, `Préventif ${eur(ind.parType.preventif)} · correctif ${eur(ind.parType.correctif)}`, 'var(--encre)', 'rond')}
      </div>
      ${al.length ? `<h2 class="titre-section">Alertes du site</h2><div class="bloc-liste">${al.map((a) => ligneAlerte(a, t)).join('')}</div>` : ''}
      <h2 class="titre-section">Équipements <span>${pluriel(eqs.filter((e) => !e.reforme).length, 'actif')}${eqs.some((e) => e.reforme) ? `, ${pluriel(eqs.filter((e) => e.reforme).length, 'réformé')}` : ''}. Touche un équipement pour le modifier.</span></h2>
      ${eqs.length ? `<div class="bloc-liste">${eqs.map((e) => ligneEquipement(e)).join('')}</div>` : vide('Aucun équipement', 'Ajoute les équipements de ce site pour suivre préventif et pannes.', '', true)}
      <div class="rang-actions"><button class="btn primaire petit" data-action="equipement-nouveau" data-site="${s.id}">${ICONES.plus}Équipement</button><button class="btn petit" data-action="intervention-nouvelle" data-type="preventif" data-site="${s.id}">${ICONES.plus}Préventif fait</button></div>
      ${cats.length ? `<h2 class="titre-section">Coût par catégorie <span>${periodeTexte()}, montants tels que saisis.</span></h2>${barres(cats.map(([c, v]) => ({ nom: categorie(c), valeur: v, detail: eur(v) })), 'Coût par catégorie du site')}` : ''}
      <h2 class="titre-section">Historique <span>${pluriel(its.length, 'intervention')}, de la plus récente à la plus ancienne.</span></h2>
      ${its.length ? `<div class="bloc-liste">${its.slice(0, 30).map(ligneIntervention).join('')}</div>${its.length > 30 ? '<p class="note">30 dernières interventions affichées ; l\'onglet Interventions et l\'export CSV contiennent tout.</p>' : ''}` : '<p class="note">Aucune intervention enregistrée.</p>'}
      ${s.notes ? `<h2 class="titre-section">Notes</h2><p class="aide">${esc(s.notes)}</p>` : ''}`;
  }
  const dateI = (i) => (i.type === 'correctif' ? (i.resolu || i.signale) : i.date) || '';

  function ligneEquipement(e, avecSite = false) {
    const st = R.etatEquipement(E, e);
    const p = R.echeancePreventif(E, e, auj(), E.reglages.alerteJours);
    const droite = e.reforme ? '' : p.echeance ? `<span class="etiquette ${ETAT_PREV[p.etat][0]}">${ETAT_PREV[p.etat][1]}</span><small>${p.etat === 'retard' ? `depuis le ${fmtCourt(p.echeance)}` : `préventif ${quand(p.echeance)}`}</small>` : '<small>sans préventif</small>';
    return `<button class="ligne-eq" data-action="equipement-modifier" data-id="${e.id}"><span class="etiquette ${ETAT_EQ[st.code][0]}">${ETAT_EQ[st.code][1]}</span>
      <span><b>${esc(e.designation)}${avecSite ? ` · ${esc(nomS(e.siteId))}` : ''}</b><small>${esc(categorie(e.categorie))} · criticité ${esc(lib(B.criticites, e.criticite).toLowerCase())}${e.periodiciteMois ? ` · préventif tous les ${e.periodiciteMois} mois` : ''}${[e.marque, e.modele].filter(Boolean).length ? ` · ${esc([e.marque, e.modele].filter(Boolean).join(' '))}` : ''}${st.depuis ? ` · ${st.code === 'arret' ? 'à l\'arrêt' : 'dégradé'} depuis le ${fmtCourt(st.depuis)}` : ''}</small></span>
      <span class="eq-ech">${droite}</span></button>`;
  }

  // ---------- Vue Équipements ----------
  function vueEquipements() {
    const f = affichage.eq;
    const t = auj();
    const l = E.equipements.filter((e) => (!f.site || e.siteId === f.site) && (!f.categorie || e.categorie === f.categorie)
      && (!f.etat || (f.etat === 'retard' ? R.echeancePreventif(E, e, t, E.reglages.alerteJours).etat === 'retard' : f.etat === 'actifs' ? !e.reforme : R.etatEquipement(E, e).code === f.etat)))
      .sort((a, b) => nomS(a.siteId).localeCompare(nomS(b.siteId), 'fr') || !!a.reforme - !!b.reforme || a.designation.localeCompare(b.designation, 'fr'));
    const cats = B.categories.filter((c) => E.equipements.some((e) => e.categorie === c.code));
    return `
      <div class="vue-tete"><div><h1>Équipements</h1><p>État calculé d'après les pannes ouvertes, prochaine échéance de préventif d'après la dernière réalisée.</p></div>
        <div class="actions"><button class="btn" data-action="import" data-quoi="equipements">Importer (CSV)</button><button class="btn" data-action="csv-equipements">Exporter</button><button class="btn primaire" data-action="equipement-nouveau">${ICONES.plus}Équipement</button></div></div>
      <div class="filtres filtres-3">
        <label class="champ">Site<select id="fe-site"><option value="">Tous</option>${sitesTries().map((s) => `<option value="${s.id}" ${s.id === f.site ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select id="fe-categorie"><option value="">Toutes</option>${cats.map((c) => `<option value="${c.code}" ${c.code === f.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">État<select id="fe-etat"><option value="">Tous</option>${[['actifs', 'Actifs (hors réformés)'], ['arret', 'À l\'arrêt'], ['degrade', 'Dégradés'], ['retard', 'Préventif en retard'], ['reforme', 'Réformés']].map(([k, l2]) => `<option value="${k}" ${k === f.etat ? 'selected' : ''}>${l2}</option>`).join('')}</select></label>
      </div>
      <p class="note compte-filtre">${pluriel(l.length, 'équipement')}${l.length !== E.equipements.length ? ` sur ${E.equipements.length} · <button class="btn lien" data-action="filtres-eq-raz">Tout afficher</button>` : ''}</p>
      ${l.length ? `<div class="bloc-liste">${l.map((e) => ligneEquipement(e, true)).join('')}</div>` : vide(E.equipements.length ? 'Aucun équipement ne correspond' : 'Aucun équipement', E.equipements.length ? 'Change ou efface les filtres.' : 'Ajoute un équipement à un site, ou importe ta liste depuis un tableur.', '', true)}`;
  }

  // ---------- Vue Interventions (journal) ----------
  function vueInterventions() {
    const f = affichage.it;
    const l = E.interventions.filter((i) => (!f.type || i.type === f.type) && (!f.site || i.siteId === f.site) && (!f.ouverts || (i.type === 'correctif' && !i.resolu)))
      .sort((a, b) => dateI(b).localeCompare(dateI(a)));
    const MAX = 60;
    return `
      <div class="vue-tete"><div><h1>Interventions</h1><p>Préventifs réalisés, pannes (signalement et résolution) et visites de site. Le prestataire est celui que tu indiques.</p></div>
        <div class="actions"><button class="btn" data-action="csv-interventions">Exporter</button><button class="btn" data-action="intervention-nouvelle" data-type="preventif">${ICONES.plus}Préventif fait</button><button class="btn primaire" data-action="intervention-nouvelle" data-type="correctif">${ICONES.plus}Panne</button></div></div>
      <div class="filtres filtres-3">
        <label class="champ">Type<select id="fi-type"><option value="">Tous</option>${B.typesInterventions.map((x) => `<option value="${x.code}" ${x.code === f.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Site<select id="fi-site"><option value="">Tous</option>${sitesTries().map((s) => `<option value="${s.id}" ${s.id === f.site ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
        <label class="case case-filtre"><input type="checkbox" id="fi-ouverts" ${f.ouverts ? 'checked' : ''}> Pannes ouvertes seulement</label>
      </div>
      <p class="note compte-filtre">${pluriel(l.length, 'intervention')}${l.length > MAX ? `, ${MAX} plus récentes affichées (l'export CSV contient tout)` : ''}</p>
      ${l.length ? `<div class="bloc-liste">${l.slice(0, MAX).map(ligneIntervention).join('')}</div>` : vide('Aucune intervention', 'Note un préventif réalisé, une panne ou une visite.', '', true)}`;
  }

  // ---------- Vue Indicateurs ----------
  function vueIndicateurs() {
    const ind = R.indicateurs(E, B, optsInd());
    const l = lignesSites();
    const cats = Object.entries(ind.parCategorie).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const parSite = [...l].sort((a, b) => b.ind.cout - a.ind.cout);
    const parDispo = l.filter((x) => x.ind.disponibilite !== null).sort((a, b) => a.ind.disponibilite - b.ind.disponibilite);
    return `
      <div class="vue-tete"><div><h1>Indicateurs</h1><p>Consolidés sur tout le parc, puis par site. Période : ${periodeTexte()} (modifiable dans les Réglages).</p></div>
        <div class="actions"><button class="btn" data-action="csv-sites">Exporter par site</button></div></div>
      <div class="tuiles tuiles-5">
        ${tuile('Disponibilité', ind.disponibilite === null ? '–' : `${(ind.disponibilite * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small>%</small>`, 'Moyenne des équipements actifs', 'var(--bleu)', 'rond')}
        ${tuile('Préventif à temps', ind.tauxATemps === null ? '–' : `${Math.round(ind.tauxATemps * 100)}<small>%</small>`, `${pluriel(ind.preventifsRealises, 'préventif réalisé', 'préventifs réalisés')}`, 'var(--jaune)')}
        ${tuile('En retard', ind.enRetard, `Préventifs dus non faits · ${ind.correctifsOuverts} panne${ind.correctifsOuverts > 1 ? 's' : ''} ouverte${ind.correctifsOuverts > 1 ? 's' : ''}`, 'var(--rouge)')}
        ${tuile('Délai de résolution', ind.delaiMoyen === null ? '–' : `${nbJ(ind.delaiMoyen)}<small>j</small>`, `Moyenne sur ${pluriel(ind.resolus, 'panne résolue', 'pannes résolues')}`, 'var(--encre)', 'rond')}
        ${tuile('Coût total', `${Math.round(ind.cout).toLocaleString('fr-FR')}<small>€</small>`, `Préventif ${eur(ind.parType.preventif)} · correctif ${eur(ind.parType.correctif)}`, 'var(--encre)')}
      </div>
      <h2 class="titre-section">Coût par site <span>Survole ou touche une barre pour le détail.</span></h2>
      ${barres(parSite.map((x) => ({ nom: x.site.nom, valeur: x.ind.cout, detail: eur(x.ind.cout), bulle: `<b>${esc(x.site.nom)}</b><div>Préventif : ${eur(x.ind.parType.preventif)}</div><div>Correctif : ${eur(x.ind.parType.correctif)}</div>${x.ind.parType.visite ? `<div>Visites : ${eur(x.ind.parType.visite)}</div>` : ''}<div>Total : ${eur(x.ind.cout)}</div>` })), 'Coût par site')}
      <h2 class="titre-section">Coût par catégorie d'équipement</h2>
      ${cats.length ? barres(cats.map(([c, v]) => ({ nom: categorie(c), valeur: v, detail: eur(v) })), 'Coût par catégorie') : '<p class="note">Aucun coût saisi sur la période.</p>'}
      <h2 class="titre-section">Disponibilité par site <span>Du moins disponible au plus disponible. Arrêts = pannes notées « à l'arrêt ».</span></h2>
      ${parDispo.length ? barres(parDispo.map((x) => ({ nom: x.site.nom, valeur: x.ind.disponibilite, detail: pct(x.ind.disponibilite), max: 1 })), 'Disponibilité par site', true) : '<p class="note">Aucun équipement actif.</p>'}
      <h2 class="titre-section">Tableau par site</h2>
      <div class="defile"><table class="tableau indic"><thead><tr><th>Site</th><th class="nb">Équip.</th><th class="nb">Dispo.</th><th class="nb">Retards</th><th class="nb">Préventif à temps</th><th class="nb">Délai moyen</th><th class="nb">Coût</th></tr></thead>
        <tbody>${[...l].sort((a, b) => a.site.nom.localeCompare(b.site.nom, 'fr')).map(({ site: s, ind: i }) => `<tr><td><button class="lien-v" data-action="site" data-id="${s.id}"><b>${esc(s.nom)}</b><small>${esc(s.region || '')}</small></button></td><td class="nb">${i.equipements}</td><td class="nb">${pct(i.disponibilite)}</td><td class="nb">${i.enRetard}</td><td class="nb">${pct(i.tauxATemps, 0)}</td><td class="nb">${i.delaiMoyen === null ? '–' : `${nbJ(i.delaiMoyen)} j`}</td><td class="nb">${eur(i.cout)}</td></tr>`).join('')}
        <tr class="total"><td>Parc</td><td class="nb">${ind.equipements}</td><td class="nb">${pct(ind.disponibilite)}</td><td class="nb">${ind.enRetard}</td><td class="nb">${pct(ind.tauxATemps, 0)}</td><td class="nb">${ind.delaiMoyen === null ? '–' : `${nbJ(ind.delaiMoyen)} j`}</td><td class="nb">${eur(ind.cout)}</td></tr></tbody></table></div>
      <p class="note">Disponibilité : 1 − jours d'arrêt ÷ jours de la période (depuis la mise en service si elle est plus récente), moyenne des équipements actifs. Préventif à temps : préventifs réalisés au plus tard à leur échéance. Coûts : montants tels que saisis (HT ou TTC : reste cohérent), datés de la réalisation ou de la résolution.</p>`;
  }

  // Barres horizontales à une seule série (bleu), valeur écrite au bout, infobulle au survol,
  // tableau accessible. max : borne de l'échelle (sinon la plus grande valeur).
  function barres(lignes, titre, pourcent = false) {
    const max = pourcent ? 1 : Math.max(1, ...lignes.map((x) => x.valeur));
    return `<figure class="graphique bulles" aria-label="${esc(titre)}">
      <div class="piles">${lignes.map((x) => `<div class="pile" tabindex="0" data-bulle="${esc(x.bulle || `<b>${esc(x.nom)}</b><div>${esc(x.detail)}</div>`)}" aria-label="${esc(x.nom)} : ${esc(x.detail)}">
        <div class="pile-tete"><b>${esc(x.nom)}</b></div>
        <div class="pile-barre"><div class="pile-segments" style="width:calc((100% - 110px) * ${Math.max(0, x.valeur / max).toFixed(4)})">${x.valeur > 0 ? '<i></i>' : ''}</div><span class="pile-total">${esc(x.detail)}</span></div></div>`).join('')}</div>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>${esc(titre)}</caption><tbody>${lignes.map((x) => `<tr><th>${esc(x.nom)}</th><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>
    </figure>`;
  }

  // Infobulles des graphiques et de la carte (survol, toucher, focus clavier).
  function brancherBulles() {
    document.querySelectorAll('#vue .bulles').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const cibles = fig.querySelectorAll('[data-bulle]');
      const montrer = (el) => {
        cibles.forEach((p) => p.classList.toggle('active', p === el));
        bulle.innerHTML = el.dataset.bulle;
        bulle.hidden = false;
        const rp = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        const x = el.classList.contains('point') ? rp.left - rf.left + rp.width / 2 - bulle.offsetWidth / 2 : rp.left - rf.left + 40;
        bulle.style.left = `${Math.max(8, Math.min(rf.width - bulle.offsetWidth - 8, x))}px`;
        const bas = rp.bottom - rf.top + 4;
        bulle.style.top = `${el.classList.contains('point') && bas + bulle.offsetHeight > rf.height ? rp.top - rf.top - bulle.offsetHeight - 4 : bas}px`;
      };
      cibles.forEach((p) => {
        p.addEventListener('pointerenter', () => montrer(p));
        p.addEventListener('focus', () => montrer(p));
        if (!p.dataset.action) p.addEventListener('click', () => montrer(p));
      });
      const cacher = () => { bulle.hidden = true; cibles.forEach((p) => p.classList.remove('active')); };
      fig.addEventListener('pointerleave', cacher);
      fig.addEventListener('focusout', cacher);
    });
  }
  // Points de la carte : ouverture au clavier (Entrée, Espace).
  function brancherCarte() {
    document.querySelectorAll('#vue .point').forEach((g) => g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirSite(g.dataset.id); } }));
    const lier = (sel, fn) => { const el = $(sel); if (el) el.addEventListener(el.type === 'search' ? 'input' : 'change', fn); };
    const f = affichage.filtre;
    lier('#f-texte', (e) => { f.texte = e.target.value; const pos = e.target.selectionStart; rendre(); const c = $('#f-texte'); c.focus(); c.setSelectionRange(pos, pos); });
    lier('#f-region', (e) => { f.region = e.target.value; rendre(); });
    lier('#f-type', (e) => { f.type = e.target.value; rendre(); });
    lier('#f-etat', (e) => { f.etat = e.target.value; rendre(); });
    lier('#f-tri', (e) => { affichage.tri = { cle: e.target.value, sens: ['equipements', 'retards', 'cout', 'delai'].includes(e.target.value) ? -1 : 1 }; rendre(); });
    lier('#fe-site', (e) => { affichage.eq.site = e.target.value; rendre(); });
    lier('#fe-categorie', (e) => { affichage.eq.categorie = e.target.value; rendre(); });
    lier('#fe-etat', (e) => { affichage.eq.etat = e.target.value; rendre(); });
    lier('#fi-type', (e) => { affichage.it.type = e.target.value; rendre(); });
    lier('#fi-site', (e) => { affichage.it.site = e.target.value; rendre(); });
    lier('#fi-ouverts', (e) => { affichage.it.ouverts = e.target.checked; rendre(); });
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const rg = E.reglages;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Comment l'outil calcule, comment passer par ton tableur, et ce qu'il ne fait pas.</p></div></div>
      <h2 class="titre-section">Démarrer en trois temps</h2>
      <ul class="limites">
        <li><b>Sites</b> : nom, type, ville, région (ou secteur), responsable ; latitude et longitude si tu veux la carte.</li>
        <li><b>Équipements</b> de chaque site : catégorie, marque et modèle (texte libre), mise en service, criticité, <b>périodicité du préventif</b> (celle de ton contrat ou de ta réglementation).</li>
        <li><b>Interventions</b> : coche « Préventif fait » après chaque visite d'entretien, note les pannes (signalement, résolution, arrêt ou non) et les visites de site. L'outil calcule le reste.</li>
      </ul>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Échéance du préventif</b> : dernier préventif réalisé (ou mise en service) + périodicité. En retard après la date ; « à prévoir » dans les ${rg.alerteJours} jours.</li>
        <li><b>État d'un équipement</b> : à l'arrêt si une panne notée « à l'arrêt » est ouverte, dégradé si une autre panne est ouverte, sinon en service. « Réformé » se coche dans la fiche.</li>
        <li><b>Disponibilité</b> : 1 − jours d'arrêt ÷ jours de la période (${periodeTexte()}), arrêts superposés comptés une fois ; moyenne des équipements actifs du site ou du parc.</li>
        <li><b>Délai de résolution</b> : jours entre signalement et résolution des pannes résolues sur la période.</li>
        <li><b>Préventif à temps</b> : part des préventifs réalisés au plus tard à l'échéance qui était calculée ce jour-là.</li>
        <li><b>Coût</b> : somme des coûts saisis, datés de la réalisation (préventif, visite) ou de la résolution (panne).</li>
        <li><b>Alertes</b> : préventif dépassé ou proche ; équipement à l'arrêt depuis ${rg.arretJours} jours ou plus ; site sans visite depuis plus de ${rg.visiteMois} mois (préventif, panne résolue ou visite). Seuils dans les Réglages.</li>
      </ul>
      <h2 class="titre-section">Carte schématique</h2>
      <div class="legal"><p>Les sites sont placés d'après la latitude et la longitude que tu saisis (format décimal, par exemple 45,76 et 4,84), sans fond de carte ni service en ligne : aucune adresse n'est envoyée nulle part. Les sites sans coordonnées sont regroupés par région. Les coordonnées d'un lieu se lisent dans n'importe quelle application de cartes (appui long sur le lieu).</p></div>
      <h2 class="titre-section">Avec ton tableur (modèle CSV)</h2>
      <ul class="limites">
        <li><b>Format</b> : CSV séparé par des points-virgules, encodé en UTF-8 avec BOM : il s'ouvre directement dans Excel, LibreOffice ou Numbers. Dates au format JJ/MM/AAAA.</li>
        <li><b>Modèles vides</b> : Réglages ou bouton « Importer », « Modèle des sites » et « Modèle des équipements ». Garde la ligne d'en-tête ; l'ordre des colonnes est libre.</li>
        <li><b>Import</b> : un site de même nom est mis à jour, sinon ajouté ; un équipement est rattaché au site de la colonne « Site » (importe d'abord les sites) et mis à jour s'il a la même désignation sur ce site. Un aperçu indique les ajouts, mises à jour et lignes ignorées avant d'importer.</li>
        <li><b>Export</b> : sites (avec leurs indicateurs), équipements (avec état et échéance), interventions. Les colonnes calculées en fin de fichier sont ignorées à l'import.</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Aucune périodicité réglementaire en base</b> : ascenseurs, sécurité incendie, installations électriques ou de gaz ont des obligations propres ; saisis la périodicité de ton contrat ou de ta réglementation.</li>
        <li><b>Pas de pièces jointes</b> : rapports et bons d'intervention restent dans tes dossiers ; note leur référence dans le libellé.</li>
        <li><b>Un compte, une clé</b> : les prestataires ne saisissent pas eux-mêmes ; la personne qui pilote le parc enregistre les interventions.</li>
        <li><b>Pas de géocodage</b> ni de fond de carte : c'est voulu, rien ne sort de ton espace.</li>
      </ul>`;
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
      if (err === false) return;
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea')?.focus();
  }
  const PIED_NOUVEAU = (l2 = 'Ajouter') => `<button class="btn primaire" value="ok">${l2}</button><button class="btn" value="annuler">Annuler</button>`;
  const PIED_MODIF = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>';
  const choixSite = (choisi, nom = 'siteId') => `<label class="champ">Site<select name="${nom}" required>${sitesTries().map((s) => `<option value="${s.id}" ${s.id === choisi ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>`;
  const texte = (f, k) => String(f.get(k) || '').trim();
  const montant = (f, k) => { const s = texte(f, k); if (!s) return ''; const n = nombre(s); return n >= 0 && /\d/.test(s) ? R.arrondi(n) : null; };

  // Modifie l'état avec annulation possible depuis le toast.
  function modifier(fn, message, annulable = true) {
    const avant = structuredClone(E);
    const r = fn();
    if (typeof r === 'string') return r;
    annulation = annulable ? () => { E = avant; } : null;
    sauver(); rendre();
    if (message) toast(message, annulable ? { libelle: 'Annuler', faire: annuler } : null);
    return undefined;
  }

  function modaleSite(id) {
    const s = id ? site(id) : null;
    const corps = `
      <div class="grille-2">
        <label class="champ">Nom du site<input name="nom" required maxlength="80" value="${esc(s?.nom || '')}" placeholder="Ex. : Entrepôt Nord"></label>
        <label class="champ">Type<select name="type">${options(B.typesSites, s?.type || 'BUR')}</select></label>
      </div>
      <label class="champ">Adresse <small>Texte libre, facultatif.</small><input name="adresse" maxlength="140" value="${esc(s?.adresse || '')}"></label>
      <div class="grille-2">
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(s?.ville || '')}"></label>
        <label class="champ">Région <small>Ou secteur, agence.</small><input name="region" maxlength="60" list="regions" value="${esc(s?.region || '')}"></label>
        <label class="champ">Responsable<input name="responsable" maxlength="60" value="${esc(s?.responsable || '')}"></label>
      </div>
      ${listeRegions()}
      <div class="grille-2">
        <label class="champ">Latitude <small>Facultatif, décimal (ex. 45,76).</small><input name="lat" inputmode="decimal" value="${esc(Number.isFinite(s?.lat) ? String(s.lat).replace('.', ',') : '')}"></label>
        <label class="champ">Longitude <small>Ouest : négatif (ex. −1,68).</small><input name="lon" inputmode="decimal" value="${esc(Number.isFinite(s?.lon) ? String(s.lon).replace('.', ',') : '')}"></label>
      </div>
      <label class="champ">Notes<textarea name="notes" maxlength="500" placeholder="Ex. : accès, horaires, gardien">${esc(s?.notes || '')}</textarea></label>
      ${s ? `<label class="case"><input type="checkbox" name="inactif" ${s.inactif ? 'checked' : ''}> Site inactif (vendu, fermé) : plus d'alerte de visite</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier le site' : 'Nouveau site', corps, s ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const ne = E.equipements.filter((e) => e.siteId === s.id).length, ni = E.interventions.filter((i) => i.siteId === s.id).length;
        if (!confirm(`Supprimer ${s.nom}${ne + ni ? ` avec ${pluriel(ne, 'équipement')} et ${pluriel(ni, 'intervention')}` : ''} ? Pour garder l'historique, coche plutôt « Site inactif ».`)) return '';
        siteOuvert = null;
        modifier(() => { E.sites = E.sites.filter((x) => x.id !== s.id); E.equipements = E.equipements.filter((e) => e.siteId !== s.id); E.interventions = E.interventions.filter((i) => i.siteId !== s.id); }, `${s.nom} supprimé.`);
        return undefined;
      }
      const nom = texte(f, 'nom');
      if (!nom) return 'Indique le nom du site.';
      if (E.sites.some((x) => R.plat(x.nom) === R.plat(nom) && x.id !== s?.id)) return 'Un site porte déjà ce nom (les imports s\'appuient sur le nom).';
      const lat = R.coord(f.get('lat'), 90), lon = R.coord(f.get('lon'), 180);
      if (lat === undefined || lon === undefined) return 'Coordonnées : nombres décimaux (latitude −90 à 90, longitude −180 à 180).';
      if ((lat === null) !== (lon === null)) return 'Indique la latitude et la longitude, ou aucune des deux.';
      const champs = { nom, type: f.get('type'), adresse: texte(f, 'adresse'), ville: texte(f, 'ville'), region: texte(f, 'region'), responsable: texte(f, 'responsable'), lat, lon, notes: texte(f, 'notes') };
      if (s) return modifier(() => { Object.assign(s, champs, { inactif: !!f.get('inactif') }); }, `${nom} enregistré.`);
      const n = { id: uid(), ...champs };
      modifier(() => { E.sites.push(n); }, `${nom} ajouté : ajoute ses équipements.`, false);
      ouvrirSite(n.id);
      return undefined;
    });
  }

  function modaleEquipement(id, siteId) {
    const e = id ? equipement(id) : null;
    if (!E.sites.length) { toast('Ajoute d\'abord un site.'); return; }
    const t = auj();
    let resume = '';
    if (e) {
      const st = R.etatEquipement(E, e);
      const p = R.echeancePreventif(E, e, t, E.reglages.alerteJours);
      const d = R.disponibilite(E, e, t, E.reglages.periodeJours);
      const its = E.interventions.filter((i) => i.equipementId === e.id).sort((a, b) => dateI(b).localeCompare(dateI(a)));
      resume = `<div class="resume-eq"><span class="etiquette ${ETAT_EQ[st.code][0]}">${ETAT_EQ[st.code][1]}</span>
        <span>${p.echeance ? `Prochain préventif : <b>${fmtCourt(p.echeance)}</b> (${p.etat === 'retard' ? 'dépassé' : quand(p.echeance)})` : 'Aucun préventif programmé'}${d !== null ? ` · disponibilité ${pct(d)}` : ''}</span>
        <span class="rang">${e.reforme ? '' : `<button class="btn petit" type="button" data-action="intervention-nouvelle" data-type="preventif" data-equipement="${e.id}">Préventif fait</button>${st.code === 'arret' || st.code === 'degrade' ? `<button class="btn petit" type="button" data-action="intervention-modifier" data-id="${E.interventions.find((i) => i.equipementId === e.id && i.type === 'correctif' && !i.resolu)?.id}">Résoudre la panne</button>` : `<button class="btn petit" type="button" data-action="intervention-nouvelle" data-type="correctif" data-equipement="${e.id}">Signaler une panne</button>`}`}</span>
        ${its.length ? `<details><summary>Historique (${its.length})</summary><div class="bloc-liste">${its.slice(0, 12).map(ligneIntervention).join('')}</div></details>` : ''}</div>`;
    }
    const corps = `${resume}
      <div class="grille-2">
        ${choixSite(e?.siteId || siteId || siteOuvert || sitesTries()[0]?.id)}
        <label class="champ">Désignation<input name="designation" required maxlength="80" value="${esc(e?.designation || '')}" placeholder="Ex. : Chaudière collective"></label>
        <label class="champ">Catégorie<select name="categorie">${options(B.categories, e?.categorie || 'CHA')}</select></label>
        <label class="champ">Criticité<select name="criticite">${options(B.criticites, e?.criticite || 'moyenne')}</select></label>
        <label class="champ">Marque <small>Texte libre.</small><input name="marque" maxlength="60" value="${esc(e?.marque || '')}"></label>
        <label class="champ">Modèle<input name="modele" maxlength="60" value="${esc(e?.modele || '')}"></label>
        <label class="champ">Mise en service<input type="date" name="miseEnService" max="${t}" value="${e?.miseEnService || ''}"></label>
        <label class="champ">Préventif tous les (mois) <small>0 : pas de préventif.</small><input type="number" name="periodiciteMois" min="0" max="120" list="periodicites" value="${esc(e ? e.periodiciteMois : 12)}"></label>
      </div>
      <datalist id="periodicites">${B.periodicites.map((p) => `<option value="${p}"></option>`).join('')}</datalist>
      ${e ? '' : '<label class="champ">Dernier préventif connu <small>Facultatif : l\'échéance part de cette date (sinon de la mise en service).</small><input type="date" name="depuis" max="' + t + '"></label>'}
      <label class="champ">Notes<textarea name="notes" maxlength="500">${esc(e?.notes || '')}</textarea></label>
      ${e ? `<label class="case"><input type="checkbox" name="reforme" ${e.reforme ? 'checked' : ''}> Réformé (hors service définitif) : plus d'alerte, historique conservé</label>` : ''}
      <p class="aide">La périodicité est la tienne (contrat, notice, réglementation) : l'outil ne connaît aucune périodicité légale.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? `${esc(e.designation)}` : 'Nouvel équipement', corps, e ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const n = E.interventions.filter((i) => i.equipementId === e.id).length;
        if (!confirm(`Supprimer ${e.designation}${n ? ` et ses ${pluriel(n, 'intervention')}` : ''} ? Pour garder l'historique, coche plutôt « Réformé ».`)) return '';
        modifier(() => { E.equipements = E.equipements.filter((x) => x.id !== e.id); E.interventions = E.interventions.filter((i) => i.equipementId !== e.id); }, `${e.designation} supprimé.`);
        return undefined;
      }
      const designation = texte(f, 'designation');
      if (!designation) return 'Indique la désignation.';
      const per = Number(f.get('periodiciteMois'));
      if (!Number.isInteger(per) || per < 0 || per > 120) return 'Périodicité : nombre entier de mois, de 0 à 120.';
      if (f.get('miseEnService') && !R.estDate(f.get('miseEnService'))) return 'Date de mise en service invalide.';
      const champs = { siteId: f.get('siteId'), designation, categorie: f.get('categorie'), criticite: f.get('criticite'), marque: texte(f, 'marque'), modele: texte(f, 'modele'), miseEnService: f.get('miseEnService') || '', periodiciteMois: per, notes: texte(f, 'notes') };
      if (E.equipements.some((x) => x.siteId === champs.siteId && R.plat(x.designation) === R.plat(designation) && x.id !== e?.id)) return 'Un équipement de ce site porte déjà cette désignation.';
      if (e) {
          return modifier(() => { const ancien = e.siteId; Object.assign(e, champs, { reforme: !!f.get('reforme') }); if (ancien !== e.siteId) E.interventions.forEach((i) => { if (i.equipementId === e.id) i.siteId = e.siteId; }); }, `${designation} enregistré.`);
      }
      const depuis = f.get('depuis') && R.estDate(f.get('depuis')) ? f.get('depuis') : '';
      return modifier(() => { E.equipements.push({ id: uid(), ...champs, reforme: false, ...(depuis ? { depuis } : {}) }); }, `${designation} ajouté.`);
    });
  }

  function modaleIntervention(id, defauts = {}) {
    const i = id ? intervention(id) : null;
    if (!E.sites.length) { toast('Ajoute d\'abord un site.'); return; }
    const t = auj();
    const eq0 = defauts.equipementId ? equipement(defauts.equipementId) : i?.equipementId ? equipement(i.equipementId) : null;
    const type = i?.type || defauts.type || 'correctif';
    const siteId = i?.siteId || eq0?.siteId || defauts.siteId || siteOuvert || sitesTries()[0].id;
    const prestataires = [...new Set(E.interventions.map((x) => x.prestataire).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const corps = `
      <fieldset class="champ bascule trois"><legend>Type</legend><div>${B.typesInterventions.map((x) => `<label><input type="radio" name="type" value="${x.code}" ${x.code === type ? 'checked' : ''}><span>${x.nom}</span></label>`).join('')}</div></fieldset>
      <div class="grille-2">${choixSite(siteId)}
        <label class="champ">Équipement<select name="equipementId" id="m-eq"></select></label></div>
      <div class="grille-2" data-pour="preventif visite">
        <label class="champ">Date de réalisation<input type="date" name="date" max="${t}" value="${i?.date || t}"></label>
        <label class="champ" data-pour="preventif">Échéance prévue <small>Calculée : modifie-la si besoin.</small><input type="date" name="echeance" id="m-ech" value="${i?.echeance || ''}"></label>
      </div>
      <div class="grille-2" data-pour="correctif">
        <label class="champ">Signalée le<input type="date" name="signale" max="${t}" value="${i?.signale || t}"></label>
        <label class="champ">Résolue le <small>Vide tant que la panne est ouverte.</small><input type="date" name="resolu" max="${t}" value="${i?.resolu || ''}"></label>
      </div>
      <label class="case" data-pour="correctif"><input type="checkbox" name="arret" ${i ? (i.arret ? 'checked' : '') : 'checked'}> Équipement à l'arrêt pendant la panne (compte dans la disponibilité)</label>
      <label class="champ">Libellé<input name="libelle" maxlength="140" value="${esc(i?.libelle || '')}" placeholder="Ex. : visite semestrielle, moteur bloqué, n° de bon"></label>
      <div class="grille-2">
        <label class="champ">Prestataire <small>Nom que tu choisis.</small><input name="prestataire" maxlength="80" list="prestataires" value="${esc(i?.prestataire || '')}"></label>
        <label class="champ">Coût (€)<input name="cout" inputmode="decimal" value="${esc(i?.cout ?? '')}"></label>
      </div>
      <datalist id="prestataires">${prestataires.map((p) => `<option value="${esc(p)}"></option>`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`;
    const titres = { preventif: 'Préventif réalisé', correctif: 'Panne', visite: 'Visite de site' };
    ouvrirModale(i ? titres[i.type] : 'Nouvelle intervention', corps, i ? PIED_MODIF : PIED_NOUVEAU('Enregistrer'), (f, action) => {
      if (action === 'supprimer') { modifier(() => { E.interventions = E.interventions.filter((x) => x.id !== i.id); }, 'Intervention supprimée.'); return undefined; }
      const ty = f.get('type');
      const equipementId = f.get('equipementId') || '';
      if (ty !== 'visite' && !equipementId) return 'Choisis l\'équipement (ou le type « Visite de site »).';
      const cout = montant(f, 'cout');
      if (cout === null) return 'Coût : nombre positif.';
      const champs = { type: ty, siteId: f.get('siteId'), equipementId, libelle: texte(f, 'libelle'), prestataire: texte(f, 'prestataire'), cout };
      if (ty === 'correctif') {
        if (!R.estDate(f.get('signale'))) return 'Indique la date de signalement.';
        if (f.get('resolu') && (!R.estDate(f.get('resolu')) || f.get('resolu') < f.get('signale'))) return 'La résolution ne peut pas précéder le signalement.';
        Object.assign(champs, { signale: f.get('signale'), resolu: f.get('resolu') || '', arret: !!f.get('arret'), date: '', echeance: '' });
      } else {
        if (!R.estDate(f.get('date'))) return 'Indique la date de réalisation.';
        Object.assign(champs, { date: f.get('date'), echeance: ty === 'preventif' && R.estDate(f.get('echeance')) ? f.get('echeance') : '', signale: '', resolu: '', arret: false });
      }
      const eqN = equipement(equipementId);
      const msg = ty === 'correctif' ? (champs.resolu ? 'Panne enregistrée comme résolue.' : `Panne ouverte${champs.arret ? ' : équipement à l\'arrêt' : ''}.`)
        : ty === 'preventif' ? `Préventif enregistré${eqN && eqN.periodiciteMois ? ` : prochain le ${fmtCourt(ajoutMois(champs.date, eqN.periodiciteMois))}` : ''}.` : 'Visite enregistrée.';
      if (i) return modifier(() => { Object.assign(i, champs); }, msg);
      return modifier(() => { E.interventions.push({ id: uid(), ...champs }); }, msg);
    });
    const d = modale();
    const majEq = () => {
      const sid = d.querySelector('[name=siteId]').value;
      const ty = d.querySelector('[name=type]:checked').value;
      const sel = $('#m-eq', d);
      const garde = sel.value || eq0?.id || '';
      const eqs = E.equipements.filter((e) => e.siteId === sid && (!e.reforme || e.id === garde)).sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
      sel.innerHTML = `${ty === 'visite' ? '<option value="">Tout le site</option>' : eqs.length ? '' : '<option value="">Aucun équipement sur ce site</option>'}${eqs.map((e) => `<option value="${e.id}" ${e.id === garde ? 'selected' : ''}>${esc(e.designation)}</option>`).join('')}`;
    };
    const majType = () => {
      const ty = d.querySelector('[name=type]:checked').value;
      d.querySelectorAll('[data-pour]').forEach((el) => { el.hidden = !el.dataset.pour.split(' ').includes(ty); });
      majEq(); majEch();
    };
    // Échéance proposée : celle calculée avant ce préventif (dernier préventif antérieur + périodicité).
    const majEch = () => {
      if (i && i.type === 'preventif') return;
      const e = equipement($('#m-eq', d).value);
      const champ = $('#m-ech', d);
      if (!e || d.querySelector('[name=type]:checked').value !== 'preventif') return;
      const p = R.echeancePreventif(E, e, t, E.reglages.alerteJours);
      champ.value = p.echeance || '';
    };
    d.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', majType));
    d.querySelector('[name=siteId]').addEventListener('change', () => { $('#m-eq', d).value = ''; majEq(); majEch(); });
    $('#m-eq', d).addEventListener('change', majEch);
    majType();
  }

  // ---------- Import CSV ----------
  function modaleImport(quoi = 'sites') {
    let resultat = null;
    const corps = `
      <p>Importe ta liste depuis un tableur : enregistre-la en <b>CSV</b> (point-virgule ou virgule), en partant du modèle. Un aperçu s'affiche avant tout changement.</p>
      <fieldset class="champ bascule"><legend>Contenu du fichier</legend><div>${[['sites', 'Sites'], ['equipements', 'Équipements']].map(([k, l2]) => `<label><input type="radio" name="quoi" value="${k}" ${k === quoi ? 'checked' : ''}><span>${l2}</span></label>`).join('')}</div></fieldset>
      <div class="rang"><button class="btn petit" type="button" data-action="modele-sites">Modèle des sites</button><button class="btn petit" type="button" data-action="modele-equipements">Modèle des équipements</button></div>
      <label class="champ">Fichier CSV<input type="file" id="m-fichier" accept=".csv,text/csv,text/plain"></label>
      <div id="m-apercu" class="apercu" hidden></div>
      <p class="aide">Sites : un site de même nom est mis à jour. Équipements : le site doit déjà exister ; même désignation sur le même site = mise à jour. Les interventions ne s'importent pas (l'historique se saisit dans l'outil).</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Importer depuis un tableur', corps, PIED_NOUVEAU('Importer'), (f) => {
      if (!resultat) return 'Choisis d\'abord un fichier CSV.';
      if (resultat.quoi !== f.get('quoi')) return 'Le type a changé : choisis à nouveau le fichier.';
      const r = resultat;
      if (!r.ajouts && !r.majs) return 'Aucune ligne à importer.';
      modifier(() => { if (r.quoi === 'sites') E.sites = r.sites; else E.equipements = r.equipements; }, `Import : ${pluriel(r.ajouts, 'ajout')}, ${pluriel(r.majs, 'mise à jour', 'mises à jour')}${r.erreurs.length ? `, ${pluriel(r.erreurs.length, 'remarque')}` : ''}.`);
      return undefined;
    });
    const d = modale();
    const analyser = async () => {
      const fichier = $('#m-fichier', d).files[0];
      const ap = $('#m-apercu', d);
      if (!fichier) { resultat = null; ap.hidden = true; return; }
      const q = d.querySelector('[name=quoi]:checked').value;
      const txt = await fichier.text();
      const r = q === 'sites' ? R.importerSites(E, B, txt, uid) : R.importerEquipements(E, B, txt, uid);
      resultat = { ...r, quoi: q };
      ap.hidden = false;
      ap.innerHTML = `<p><b>${pluriel(r.ajouts, 'ajout')}</b>, <b>${pluriel(r.majs, 'mise à jour', 'mises à jour')}</b>${r.erreurs.length ? `, ${pluriel(r.erreurs.length, 'remarque')}` : ''}.</p>${r.erreurs.length ? `<ul>${r.erreurs.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}${r.erreurs.length > 8 ? `<li>… et ${r.erreurs.length - 8} autres.</li>` : ''}</ul>` : ''}`;
      d.querySelector('.erreur').textContent = '';
    };
    $('#m-fichier', d).addEventListener('change', analyser);
    d.querySelectorAll('[name=quoi]').forEach((r) => r.addEventListener('change', analyser));
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En tête du tableau de bord.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-2">
        <label class="champ">Préventif « à prévoir » (jours)<input type="number" name="alerteJours" min="0" max="180" value="${r.alerteJours}"></label>
        <label class="champ">Alerte d'arrêt après (jours)<input type="number" name="arretJours" min="1" max="365" value="${r.arretJours}"></label>
        <label class="champ">Site sans visite après (mois)<input type="number" name="visiteMois" min="1" max="36" value="${r.visiteMois}"></label>
        <label class="champ">Période des indicateurs (jours)<input type="number" name="periodeJours" min="30" max="1095" value="${r.periodeJours}"></label>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Tableur (CSV) et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-sites">Sites (CSV)</button><button class="btn petit" type="button" data-action="csv-equipements">Équipements (CSV)</button><button class="btn petit" type="button" data-action="csv-interventions">Interventions (CSV)</button></div>
        <div class="rang"><button class="btn petit" type="button" data-action="import">Importer (CSV)</button><button class="btn petit" type="button" data-action="modele-sites">Modèle des sites</button><button class="btn petit" type="button" data-action="modele-equipements">Modèle des équipements</button></div>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import-json" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const vals = { alerteJours: n('alerteJours', 0, 180), arretJours: n('arretJours', 1, 365), visiteMois: n('visiteMois', 1, 36), periodeJours: n('periodeJours', 30, 1095) };
      if (Object.values(vals).some((x) => x === null)) return 'Réglages : nombres entiers dans les limites indiquées.';
      return modifier(() => { E.structure = texte(f, 'structure'); Object.assign(r, vals); }, 'Réglages enregistrés.');
    });
    $('#import-json').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.sites)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.sites.length, 'site')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const CSV = 'text/csv;charset=utf-8';

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
  function toast(texteT, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteT)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    if (siteOuvert && !site(siteOuvert)) siteOuvert = null;
    sauver(); rendre();
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const ferme = () => { if (modale().open) modale().close(); };
    const nomFichier = (q) => `parcs-${q}-${auj()}.csv`;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); siteOuvert = null; rendre(); } break;
      case 'deconnexion': ferme(); deconnecter(); break;
      case 'vue': ferme(); if (el.dataset.vue === 'sites') siteOuvert = null; changerVue(el.dataset.vue); break;
      case 'aller-sites': changerVue('sites'); break;
      case 'aller-indicateurs': changerVue('indicateurs'); break;
      case 'aller-equipements-arret': affichage.eq = { site: '', categorie: '', etat: 'arret' }; changerVue('equipements'); break;
      case 'site': ferme(); ouvrirSite(id); break;
      case 'mode-sites': affichage.mode = el.dataset.mode; memoAffichage(); rendre(); break;
      case 'tri': { const k = el.dataset.cle; affichage.tri = affichage.tri.cle === k ? { cle: k, sens: -affichage.tri.sens } : { cle: k, sens: ['equipements', 'retards', 'cout'].includes(k) ? -1 : 1 }; rendre(); break; }
      case 'filtres-raz': affichage.filtre = { texte: '', region: '', type: '', etat: '' }; rendre(); break;
      case 'filtres-eq-raz': affichage.eq = { site: '', categorie: '', etat: '' }; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `parcs-multi-sites-${auj()}.json`, 'application/json'); break;
      case 'csv-sites': telecharger(R.csvSites(E, B, auj()), nomFichier('sites'), CSV); toast('Sites exportés (CSV, point-virgule).'); break;
      case 'csv-equipements': telecharger(R.csvEquipements(E, B, auj()), nomFichier('equipements'), CSV); toast('Équipements exportés (CSV, point-virgule).'); break;
      case 'csv-interventions': telecharger(R.csvInterventions(E, B), nomFichier('interventions'), CSV); toast('Interventions exportées (CSV, point-virgule).'); break;
      case 'modele-sites': telecharger(R.csvModele('sites'), 'modele-sites.csv', CSV); toast('Modèle des sites téléchargé : remplis-le dans ton tableur, enregistre en CSV, puis importe-le.'); break;
      case 'modele-equipements': telecharger(R.csvModele('equipements'), 'modele-equipements.csv', CSV); toast('Modèle des équipements téléchargé : la colonne « Site » reprend le nom exact du site.'); break;
      case 'import': modaleImport(el.dataset.quoi || 'sites'); break;
      case 'fermer': modale().close(); break;
      case 'site-nouveau': modaleSite(); break;
      case 'site-modifier': modaleSite(id); break;
      case 'equipement-nouveau': modaleEquipement(null, el.dataset.site); break;
      case 'equipement-modifier': modaleEquipement(id); break;
      case 'intervention-nouvelle': modaleIntervention(null, { type: el.dataset.type, equipementId: el.dataset.equipement, siteId: el.dataset.site }); break;
      case 'intervention-modifier': if (id && intervention(id)) modaleIntervention(id); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // La carte se redessine au changement d'orientation (largeur du viewBox adaptée à l'écran).
  let largeurPrec = innerWidth;
  window.addEventListener('resize', () => { if (vue === 'sites' && affichage.mode === 'carte' && Math.abs(innerWidth - largeurPrec) > 80 && E && !modale().open) { largeurPrec = innerWidth; rendre(); } });

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
  window.__parcs = { etat: () => E };
  init();
})();
