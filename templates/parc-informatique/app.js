// Gestion de parc informatique QME : inventaire, affectations nominatives, licences, alertes, fiches imprimables.
// Données synchronisées par clé de licence (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'PRC';
  const CLE_CODE = 'qme-prc-code';
  const CLE_CACHE = 'qme-prc-cache';
  const CLE_DEMO = 'qme-prc-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-prc-ecran-accueil';
  const TAILLE_MAX = 900000;
  const NOM = 'Gestion de parc informatique';

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

  const { ajout, ecart, versDate, ajoutMois } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? R.dateFr(s) : '–');
  const euros = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? '–' : `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`);
  const txt = (f, k) => String(f.get(k) || '').trim();

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'alertes';
  let annulation = null;
  const filtre = { categorie: '', statut: 'parc', garantie: 'toutes', texte: '' };
  const filtreP = { vue: 'presents', texte: '' };
  const ficheChoix = { personneId: '', type: 'remise' };

  const reglagesDefaut = () => ({ alertes: { ...B.alertes }, categories: Object.fromEntries(B.categories.map((c) => [c.id, { garantie: c.garantie, renouvellement: c.renouvellement }])) });
  const etatVide = () => ({ version: 1, structure: '', demarre: false, reglages: reglagesDefaut(), materiels: [], personnes: [], affectations: [], licences: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const rg = d.reglages || {};
    const cats = { ...v.reglages.categories };
    for (const [k, c] of Object.entries(rg.categories || {})) cats[k] = { ...(cats[k] || {}), ...c };
    return { ...v, ...d, reglages: { alertes: { ...v.reglages.alertes, ...(rg.alertes || {}) }, categories: cats },
      materiels: tab(d.materiels), personnes: tab(d.personnes), affectations: tab(d.affectations),
      licences: tab(d.licences).map((l) => ({ attributions: [], historique: [], ...l })) };
  };
  const materiel = (id) => E.materiels.find((m) => m.id === id);
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const licence = (id) => E.licences.find((l) => l.id === id);
  const affectation = (id) => E.affectations.find((a) => a.id === id);
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || 'Autre matériel';
  const collectif = (m) => !!B.categories.find((c) => c.id === m.categorie)?.collectif;
  const libStatut = (m, s) => (s === 'stock' && collectif(m) ? 'En place' : R.LIBELLES_STATUT[s]);
  const nomEtat = (id) => B.etats.find((e) => e.id === id)?.nom || '–';
  const typeL = (id) => R.typeLicence(B.typesLicence, id);
  const A = () => E.reglages.alertes;
  const detenteur = (m) => { const a = R.affectationOuverte(E.affectations, m.id); return a ? personne(a.personneId) : null; };
  const libMat = (m) => (m ? `${m.inventaire} · ${m.designation}` : 'Matériel supprimé');
  const nomCible = (a) => (a.cible === 'personne' ? personne(a.cibleId)?.nom || 'Personne supprimée' : libMat(materiel(a.cibleId)));
  const ctxCsv = () => ({ categories: B.categories, etats: B.etats, types: B.typesLicence, fenetre: A().garantie });

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
        toast('Un autre appareil a modifié ton parc entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime le matériel sorti du parc depuis longtemps.');
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
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && (E.demarre || E.materiels.length)) { cache(false); demarrer(); } else ecranAccueil();
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
  function donneesDemo() {
    E = etatVide();
    E.structure = 'Atelier Horizon (PME fictive)';
    E.demarre = true;
    const t = auj();
    const mois = (n, j = 0) => ajout(ajoutMois(t, n), j);
    const P = {};
    [
      ['camille', 'Camille R.', 'Direction', mois(-80), null],
      ['hugo', 'Hugo M.', 'Commercial', mois(-38), ajout(t, -6)],
      ['ines', 'Inès T.', 'Comptabilité', mois(-44), ajout(t, 9)],
      ['jules', 'Jules B.', 'Atelier', mois(-26), null],
      ['lena', 'Léna P.', 'Commercial', ajout(t, -20), null],
      ['malik', 'Malik D.', 'Support', mois(-15), null],
      ['nora', 'Nora S.', 'Administration', mois(-50), ajout(t, -120)],
      ['paul', 'Paul V.', 'Bureau d\'études', mois(-60), null],
      ['sarah', 'Sarah K.', 'Comptabilité', mois(-9), null],
      ['yanis', 'Yanis L.', 'Atelier', mois(-30), null],
    ].forEach(([k, nom, service, arrivee, depart]) => { P[k] = { id: uid(), nom, service, arrivee, depart, note: '' }; E.personnes.push(P[k]); });
    const M = {};
    // [clé, catégorie, désignation, série, fournisseur, achat, prix, garantie (mois), statut, état, localisation]
    const FR = ['Revendeur informatique local', 'Grossiste en ligne', 'Intégrateur réseau', 'Opérateur mobile'];
    [
      ['p1', 'portable', 'Portable 14 pouces · direction', 'PX4K-21877-A', FR[0], mois(-14), 1290, 36, 'actif', 'bon', 'Siège'],
      ['p2', 'portable', 'Portable 15 pouces · commercial', 'PX5R-30412-C', FR[0], mois(-24, 29), 1090, 24, 'actif', 'bon', 'Itinérant'],
      ['p3', 'portable', 'Portable 14 pouces · commercial', 'PX4K-19934-B', FR[1], mois(-34), 980, 24, 'actif', 'use', 'Itinérant'],
      ['p4', 'portable', 'Portable 14 pouces · comptabilité', 'PX4K-26018-D', FR[0], mois(-27), 1040, 36, 'actif', 'bon', 'Siège'],
      ['p5', 'portable', 'Portable 15 pouces · support', 'PX5R-31175-E', FR[1], mois(-11), 1150, 24, 'actif', 'bon', 'Siège'],
      ['p6', 'portable', 'Portable 13 pouces · comptabilité', 'PX3L-10452-F', FR[0], mois(-58), 890, 24, 'actif', 'use', 'Siège'],
      ['p7', 'portable', 'Portable 15 pouces · réserve', 'PX5R-33901-G', FR[1], mois(-2), 1120, 24, 'actif', 'neuf', 'Armoire informatique'],
      ['p8', 'portable', 'Portable 14 pouces · atelier', 'PX4K-24410-H', FR[0], mois(-20), 1010, 24, 'reparation', 'hs', 'Chez le réparateur'],
      ['f1', 'fixe', 'Station de travail · bureau d\'études', 'WS-88213-K', FR[2], mois(-70), 2390, 36, 'actif', 'bon', 'Bureau d\'études'],
      ['f2', 'fixe', 'Poste fixe · accueil atelier', 'PC-55120-L', FR[0], mois(-45), 760, 24, 'actif', 'bon', 'Atelier'],
      ['e1', 'ecran', 'Écran 27 pouces', 'EC27-40021', FR[1], mois(-70), 340, 36, 'actif', 'bon', 'Bureau d\'études'],
      ['e2', 'ecran', 'Écran 27 pouces', 'EC27-40022', FR[1], mois(-70), 340, 36, 'actif', 'bon', 'Bureau d\'études'],
      ['e3', 'ecran', 'Écran 24 pouces', 'EC24-61207', FR[1], mois(-27), 190, 36, 'actif', 'bon', 'Siège'],
      ['e4', 'ecran', 'Écran 24 pouces', 'EC24-61208', FR[1], mois(-27), 190, 36, 'actif', 'neuf', 'Armoire informatique'],
      ['s1', 'station', 'Station d\'accueil USB-C', 'DK-77310', FR[1], mois(-14), 210, 24, 'actif', 'bon', 'Siège'],
      ['t1', 'smartphone', 'Smartphone professionnel', 'MB-35-0911', FR[3], mois(-30), 420, 24, 'actif', 'use', 'Itinérant'],
      ['t2', 'smartphone', 'Smartphone professionnel', 'MB-35-1420', FR[3], mois(-13), 450, 24, 'actif', 'bon', 'Itinérant'],
      ['t3', 'smartphone', 'Smartphone professionnel', 'MB-33-0274', FR[3], mois(-41), 390, 24, 'actif', 'use', 'Atelier'],
      ['t4', 'smartphone', 'Smartphone professionnel', 'MB-35-1588', FR[3], mois(-8), 450, 24, 'perdu', 'bon', ''],
      ['tb', 'tablette', 'Tablette 11 pouces · atelier', 'TB-11-5530', FR[1], mois(-5), 520, 24, 'actif', 'neuf', 'Armoire informatique'],
      ['i1', 'imprimante', 'Multifonction couleur A3', 'MF-A3-80014', FR[0], mois(-23, 20), 1890, 12, 'actif', 'bon', 'Accueil'],
      ['sv', 'serveur', 'Serveur de fichiers', 'SRV-2209-77', FR[2], mois(-62), 3400, 36, 'actif', 'bon', 'Baie informatique'],
      ['n1', 'stockage', 'Stockage réseau 4 disques', 'NAS-4B-1203', FR[2], mois(-25), 690, 24, 'actif', 'bon', 'Baie informatique'],
      ['r1', 'reseau', 'Commutateur 24 ports', 'SW24-90311', FR[2], mois(-62), 450, 24, 'actif', 'bon', 'Baie informatique'],
      ['r2', 'reseau', 'Borne Wi-Fi plafond', 'AP-44-7720', FR[2], mois(-1, -10), 260, 24, 'actif', 'neuf', 'Open space'],
      ['o1', 'onduleur', 'Onduleur de baie', 'UPS-15-3381', FR[2], mois(-62), 580, 24, 'actif', 'use', 'Baie informatique'],
      ['x1', 'portable', 'Portable 13 pouces (ancien)', 'PX3L-08821-Z', FR[0], mois(-78), 870, 24, 'sorti', 'hs', ''],
      ['x2', 'ecran', 'Écran 22 pouces', 'EC22-11902', FR[1], mois(-96), 160, 36, 'sorti', 'use', ''],
    ].forEach(([k, categorie, designation, serie, fournisseur, achat, prix, garantie, statut, etat, localisation], i) => {
      // Statut final appliqué après l'historique des affectations (un matériel perdu ou sorti ne peut pas être affecté).
      M[k] = { id: uid(), inventaire: `INV-${String(i + 1).padStart(3, '0')}`, categorie, designation, serie, fournisseur, achat, prix, garantie, statut: 'actif', final: statut, etat, localisation, note: '', statutDepuis: null, sortie: null };
      E.materiels.push(M[k]);
    });
    M.p8.statutDepuis = ajout(t, -41); M.p8.note = 'Écran fissuré, devis de réparation demandé';
    M.t4.statutDepuis = ajout(t, -35); M.t4.note = 'Perte déclarée en déplacement, ligne suspendue';
    M.x1.sortie = { date: mois(-6), motif: B.motifsSortie[0] };
    M.x2.sortie = { date: mois(-10), motif: B.motifsSortie[2] };
    M.i1.note = 'Contrat de maintenance à étudier';
    let affs = [];
    const donner = (m, p, debut, etat = 'neuf', note = '') => { affs = R.affecter(affs, M[m], { id: uid(), personneId: P[p].id, date: debut, etat, note }); return affs.at(-1).id; };
    const rendu = (id, fin, etat = 'bon', note = '') => { affs = R.restituer(affs, id, { date: fin, etat, note }); };
    // Historique : le portable p3 a d'abord été à Nora (partie), puis remis à Léna à son arrivée.
    rendu(donner('p3', 'nora', ajout(M.p3.achat, 2)), ajout(t, -120), 'use', 'Batterie fatiguée');
    donner('p3', 'lena', ajout(t, -20), 'use', 'Batterie remplacée');
    rendu(donner('t1', 'nora', ajout(M.t1.achat, 1)), ajout(t, -120), 'use');
    donner('t1', 'lena', ajout(t, -20), 'use');
    rendu(donner('x1', 'camille', ajout(M.x1.achat, 3)), mois(-14, 2), 'use', 'Remplacé par INV-001');
    donner('p1', 'camille', ajout(M.p1.achat, 2));
    donner('s1', 'camille', ajout(M.s1.achat, 2));
    donner('p2', 'hugo', ajout(M.p2.achat, 4));
    donner('t2', 'hugo', ajout(M.t2.achat, 1));
    donner('p4', 'ines', ajout(M.p4.achat, 2));
    donner('e3', 'ines', ajout(M.e3.achat, 2));
    donner('p5', 'malik', ajout(M.p5.achat, 1));
    donner('p6', 'sarah', ajout(t, -270), 'bon', 'Réattribué après remise à neuf');
    donner('f1', 'paul', ajout(M.f1.achat, 3));
    donner('e1', 'paul', ajout(M.e1.achat, 3));
    donner('e2', 'paul', ajout(M.e2.achat, 3));
    donner('t3', 'yanis', ajout(M.t3.achat, 2), 'neuf');
    donner('f2', 'jules', ajout(M.f2.achat, 2));
    rendu(donner('p8', 'jules', ajout(M.p8.achat, 2)), ajout(t, -41), 'hs', 'Écran fissuré');
    rendu(donner('t4', 'malik', ajout(M.t4.achat, 1)), ajout(t, -35), 'bon', 'Déclaré perdu');
    E.affectations = affs;
    for (const m of Object.values(M)) { m.statut = m.final; delete m.final; }
    // Licences (noms génériques, aucune marque).
    const L = (nom, categorie, type, postes, echeance, cout, fournisseur, contrat, cibles) => {
      const l = { id: uid(), nom, categorie, type, postes, echeance, cout, fournisseur, contrat, note: '', historique: [], attributions: [] };
      const mode = typeLicence(type).mode;
      l.attributions = cibles.map((k) => ({ id: uid(), cible: mode, cibleId: (mode === 'personne' ? P[k] : M[k]).id, depuis: mois(-6) }));
      E.licences.push(l);
      return l;
    };
    const tous = ['camille', 'hugo', 'ines', 'jules', 'lena', 'malik', 'paul', 'sarah', 'yanis'];
    L('Suite bureautique en ligne', 'Suite bureautique', 'abo-an-util', 8, mois(5, 3), 1056, 'Revendeur informatique local', 'CT-2025-014', tous);
    L('Messagerie et agenda partagés', 'Messagerie et collaboration', 'abo-mois-util', 10, ajout(t, 18), 60, 'Revendeur informatique local', 'CT-2025-015', tous);
    L('Protection des postes', 'Sécurité des postes', 'abo-an-poste', 12, ajout(t, 45), 480, 'Intégrateur réseau', 'SEC-0931', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'f1', 'f2', 'p8']);
    L('Sauvegarde externalisée', 'Sauvegarde', 'serveur', 1, ajout(t, -4), 720, 'Intégrateur réseau', 'SAV-118', ['sv']);
    L('Conception 2D et 3D', 'Conception assistée (CAO, DAO)', 'perp-poste', 2, '', 3200, 'Éditeur (achat direct)', 'LIC-77-2019', ['f1']);
    L('Gestionnaire de mots de passe', 'Gestion des mots de passe', 'abo-an-util', 12, mois(8, 11), 360, 'Grossiste en ligne', 'MDP-552', ['camille', 'ines', 'malik', 'paul', 'sarah']);
    L('Comptabilité et paie', 'Comptabilité et paie', 'abo-an-util', 3, mois(7), 1440, 'Éditeur (achat direct)', 'CPT-2024-03', ['ines', 'sarah']);
    return E;
  }
  function typeLicence(id) { return typeL(id); }

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
          <rect x="10" y="20" width="300" height="190" fill="#1D4E89"/>
          <rect x="34" y="44" width="252" height="142" fill="#141414" stroke="#F0EDE6" stroke-width="4"/>
          <rect x="120" y="210" width="80" height="40" fill="#F0EDE6"/>
          <rect x="70" y="250" width="180" height="30" fill="#F5B400"/>
          <circle cx="440" cy="150" r="110" fill="#D9302A"/>
          <path d="M440 40 A110 110 0 0 1 550 150 H440 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion de parc informatique</p>
          <h1>Qui a quoi, jusqu'à quand.</h1>
          <p>Inventaire, affectations nominatives, licences et garanties, avec les alertes qui comptent et les fiches de remise prêtes à signer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton parc</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton inventaire est enregistré en ligne et te suit sur tous tes appareils.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  function ecranAccueil() {
    document.title = `Bienvenue · ${NOM}`;
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ton parc, en trois temps.</h1>
        <p class="intro">1. Ajoute ton matériel (numéro de série, date d'achat : la fin de garantie se calcule). 2. Ajoute les personnes et affecte-leur le matériel. 3. Saisis tes licences logicielles. Tout reste modifiable.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Ta structure <small>En-tête des fiches de remise et de restitution.</small><input name="structure" maxlength="80" placeholder="Ex. : Cabinet Durand et associés"></label>
          </div>
          <h2 class="titre-section">Garanties et renouvellement <span>Valeurs proposées à la saisie, modifiables ici et dans les réglages. Ta facture fait foi.</span></h2>
          ${tableCategories()}
          <p class="aide">Données personnelles : tu vas saisir des noms de salariés. Ne garde que le nécessaire (nom, service, dates) et informe-les de ce fichier. Détails dans le Guide.</p>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Commencer l'inventaire</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const n = etatVide();
      const err = lireCategories(f, n.reglages);
      if (err) { e.target.querySelector('.erreur').textContent = err; return; }
      E = n;
      E.structure = txt(f, 'structure');
      E.demarre = true;
      sauver();
      vue = 'materiel';
      demarrer();
      setTimeout(() => modaleMateriel(), 250);
    });
  }

  function tableCategories() {
    const c = E ? E.reglages.categories : reglagesDefaut().categories;
    return `<div class="defile"><table class="tableau cats"><thead><tr><th>Catégorie</th><th class="nb">Garantie (mois)</th><th class="nb">Renouveler après (ans)</th></tr></thead><tbody>${B.categories.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb"><input type="number" name="g-${x.id}" min="0" max="120" value="${c[x.id]?.garantie ?? x.garantie}" aria-label="Garantie en mois : ${esc(x.nom)}"></td><td class="nb"><input type="number" name="r-${x.id}" min="1" max="20" value="${c[x.id]?.renouvellement ?? x.renouvellement}" aria-label="Renouveler après (ans) : ${esc(x.nom)}"></td></tr>`).join('')}</tbody></table></div>`;
  }
  function lireCategories(f, reglages) {
    for (const x of B.categories) {
      const g = Number(f.get(`g-${x.id}`)), r = Number(f.get(`r-${x.id}`));
      if (!Number.isInteger(g) || g < 0 || g > 120) return `Garantie de « ${x.nom} » : entre 0 et 120 mois.`;
      if (!Number.isInteger(r) || r < 1 || r > 20) return `Renouvellement de « ${x.nom} » : entre 1 et 20 ans.`;
      reglages.categories[x.id] = { garantie: g, renouvellement: r };
    }
    return '';
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    alertes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 23 21H1Z" fill="currentColor"/><rect x="11" y="9" width="2" height="6" fill="#F0EDE6"/><rect x="11" y="16.5" width="2" height="2" fill="#F0EDE6"/></svg>',
    materiel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="13" fill="currentColor"/><rect x="5" y="6" width="14" height="7" fill="#F0EDE6"/><rect x="8" y="18" width="8" height="3" fill="currentColor"/></svg>',
    personnes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5" fill="currentColor"/><path d="M3 22a9 9 0 0 1 18 0Z" fill="currentColor"/></svg>',
    licences: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    fiches: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="6" width="10" height="2" fill="currentColor"/><rect x="7" y="10" width="10" height="2" fill="currentColor"/><rect x="7" y="16" width="5" height="3" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/><circle cx="8" cy="16" r="3" fill="#F5B400"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['alertes', 'Alertes'], ['materiel', 'Matériel'], ['personnes', 'Personnes'], ['licences', 'Licences'], ['fiches', 'Fiches']];
  const TITRES = { ...Object.fromEntries(ONGLETS), guide: 'Guide' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (TITRES[depuisUrl]) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Parc<br>informatique</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et rappel RGPD" title="Guide">${ICONES.guide}</button>
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
    document.querySelector('[data-vue="guide"].btn-icone')?.setAttribute('aria-pressed', String(vue === 'guide'));
    document.title = `${TITRES[vue]} · ${NOM}`;
    $('#vue').innerHTML = { alertes: vueAlertes, materiel: vueMateriel, personnes: vuePersonnes, licences: vueLicences, fiches: vueFiches, guide: vueGuide }[vue]();
    if (vue === 'materiel') brancherFiltres();
    if (vue === 'personnes') brancherFiltresP();
    if (vue === 'alertes') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  // ---------- Vue Alertes ----------
  const GRAVITES = [['rouge', 'Urgent'], ['jaune', 'À prévoir'], ['bleu', 'À surveiller']];
  const SEGMENTS = [['affecte', 'Affecté', '#1D4E89'], ['stock', 'Non affecté', '#F5B400'], ['reparation', 'En réparation', '#D9302A']];

  function vueAlertes() {
    const t = auj();
    const al = R.alertes(E, t, E.reglages);
    const i = R.indicateurs(E, t, A().garantie);
    const stockPostes = E.materiels.filter((m) => !collectif(m) && R.statut(m, E.affectations) === 'stock').length;
    const urg = al.filter((a) => a.gravite === 0).length, prev = al.filter((a) => a.gravite === 1).length;
    const titre = !E.materiels.length && !E.licences.length ? 'Ton parc est vide pour l\'instant.'
      : urg ? `<mark>${pluriel(urg, 'alerte urgente', 'alertes urgentes')}</mark>${prev ? `, ${prev} à prévoir` : ''}.`
        : prev ? `Rien d'urgent, <mark>${prev} à prévoir</mark>.` : '<mark>Aucune alerte</mark> : tout est en ordre.';
    const tuiles = [
      ['Dans le parc', i.total, `${euros(i.valeur)} d'achat`, 'var(--encre)', 'rond', 'materiel'],
      ['Affectés', i.affecte, `${pluriel(E.personnes.filter((p) => R.presente(p, t)).length, 'personne présente', 'personnes présentes')}`, 'var(--bleu)', '', 'materiel'],
      ['En stock', stockPostes, `${i.stock - stockPostes} équipement${i.stock - stockPostes > 1 ? 's' : ''} en place${i.reparation ? `, ${i.reparation} en réparation` : ''}`, 'var(--jaune)', '', 'materiel'],
      ['Licences', `${i.attribuees}<small>/ ${i.postes}</small>`, `postes attribués, ${pluriel(i.licences, 'logiciel')}`, 'var(--rouge)', 'rond', 'licences'],
    ].map(([lib, v, d, c, f, cible]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></button>`).join('');
    const parCat = R.parCategorie(E);
    const max = Math.max(1, ...parCat.map((x) => x.total));
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Ton parc')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="materiel-nouveau">${ICONES.plus}Matériel</button><button class="btn primaire" data-action="affecter">Remettre du matériel</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Alertes <span>Départs, licences, garanties sous ${A().garantie} jours, matériel ancien. Touche une ligne pour agir.</span></h2>
      ${al.length ? `<div class="bloc-liste">${al.map((a) => `<button class="ligne-alerte" data-action="alerte" data-ref='${esc(JSON.stringify(a.ref))}'><span class="etiquette ${GRAVITES[a.gravite][0]}">${GRAVITES[a.gravite][1]}</span><span><b>${esc(a.titre)}</b><small>${esc(a.detail)}</small></span></button>`).join('')}</div>`
        : vide('Aucune alerte', E.materiels.length ? 'Pas de départ en attente, de licence à renouveler ni de garantie qui se termine.' : 'Ajoute ton matériel et tes licences : les alertes apparaîtront ici.', E.materiels.length ? '' : `<button class="btn primaire" data-action="materiel-nouveau">${ICONES.plus}Premier matériel</button>`, true)}
      <h2 class="titre-section">Parc par catégorie <span>Matériel actif ou en réparation. Survole ou touche une barre pour le détail.</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Statut du matériel par catégorie</h2><div class="legende">${SEGMENTS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${parCat.length ? `<div class="piles">${parCat.map((x, k) => `<div class="pile" data-i="${k}" tabindex="0" aria-label="${esc(nomCat(x.categorie))} : ${SEGMENTS.map(([c, l]) => `${l} ${x[c]}`).join(', ')}">
          <div class="pile-tete"><b>${esc(nomCat(x.categorie))}</b><span>${[x.affecte && `${x.affecte} affecté${x.affecte > 1 ? 's' : ''}`, x.stock && `${x.stock} non affecté${x.stock > 1 ? 's' : ''}`, x.reparation && `<em>${x.reparation} en réparation</em>`].filter(Boolean).join(' · ')}</span></div>
          <div class="pile-barre"><div class="pile-segments" style="width:${(x.total / max) * 100}%">${SEGMENTS.map(([c, , coul]) => (x[c] ? `<i style="flex:${x[c]};background:${coul}"></i>` : '')).join('')}</div><span class="pile-total">${x.total}</span></div></div>`).join('')}</div>` : '<p class="vide-graph">Aucun matériel dans le parc.</p>'}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Matériel par catégorie et par statut</caption><thead><tr><th>Catégorie</th>${SEGMENTS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${parCat.map((x) => `<tr><td>${esc(nomCat(x.categorie))}</td>${SEGMENTS.map(([k]) => `<td>${x[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </figure>
      <p class="note">${i.sousGarantie} matériel${i.sousGarantie > 1 ? 's' : ''} sous garantie, ${i.horsGarantie} hors garantie ou non renseigné${i.horsGarantie > 1 ? 's' : ''}${i.perdu ? ` · ${i.perdu} perdu${i.perdu > 1 ? 's' : ''} ou volé${i.perdu > 1 ? 's' : ''}` : ''}${i.sorti ? ` · ${i.sorti} sorti${i.sorti > 1 ? 's' : ''} du parc` : ''}.</p>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const parCat = R.parCategorie(E);
    const montrer = (el) => {
      const x = parCat[Number(el.dataset.i)];
      fig.querySelectorAll('.pile').forEach((p) => p.classList.toggle('active', p === el));
      bulle.innerHTML = `<b>${esc(nomCat(x.categorie))}</b>${SEGMENTS.map(([c, l, coul]) => `<div><i style="background:${coul}"></i>${l} : ${x[c]}</div>`).join('')}<div>Total : ${x.total}</div>`;
      bulle.hidden = false;
      const rp = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      bulle.style.left = `${Math.max(8, Math.min(rf.width - bulle.offsetWidth - 8, rp.left - rf.left + 40))}px`;
      bulle.style.top = `${rp.bottom - rf.top + 4}px`;
    };
    fig.querySelectorAll('.pile').forEach((p) => {
      p.addEventListener('pointerenter', () => montrer(p));
      p.addEventListener('click', () => montrer(p));
      p.addEventListener('focus', () => montrer(p));
    });
    const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.pile').forEach((p) => p.classList.remove('active')); };
    fig.addEventListener('pointerleave', cacher);
    fig.addEventListener('focusout', cacher);
  }

  // ---------- Vue Matériel ----------
  const COULEUR_STATUT = { affecte: 'var(--bleu)', stock: 'var(--jaune)', reparation: 'var(--rouge)', perdu: 'var(--rouge)', sorti: 'var(--gris)' };
  const CLASSE_STATUT = { affecte: 'bleu', stock: 'jaune', reparation: 'rouge', perdu: 'rouge', sorti: 'gris' };
  const nomsRecherche = (m) => `${detenteur(m)?.nom || ''} ${nomCat(m.categorie)}`;
  const listeMateriel = () => R.filtrer(E.materiels, E.affectations, filtre, auj(), A().garantie, nomsRecherche)
    .sort((a, b) => String(a.inventaire).localeCompare(String(b.inventaire), 'fr', { numeric: true }));

  function vueMateriel() {
    const t = auj();
    const i = R.indicateurs(E, t, A().garantie);
    const proches = E.materiels.filter((m) => R.enParc(m) && R.garantie(m, t, A().garantie).etat === 'proche').length;
    const titre = !E.materiels.length ? 'Aucun matériel pour l\'instant.' : `${pluriel(i.total, 'matériel')} dans le parc${proches ? `, <mark>${pluriel(proches, 'garantie se termine', 'garanties se terminent')}</mark>` : ''}.`;
    return `
      <div class="vue-tete"><div><h1>${titre}</h1><p>Garantie calculée depuis la date d'achat, détenteur actuel, historique des affectations dans chaque fiche.</p></div>
        <div class="actions"><button class="btn" data-action="csv">Export CSV</button><button class="btn primaire" data-action="materiel-nouveau">${ICONES.plus}Nouveau matériel</button></div></div>
      <form class="filtres filtres-mat" id="filtres" role="search" onsubmit="return false">
        <label class="champ">Catégorie<select id="f-cat"><option value="">Toutes</option>${B.categories.filter((c) => E.materiels.some((m) => m.categorie === c.id)).map((c) => `<option value="${c.id}" ${filtre.categorie === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Statut<select id="f-statut">${[['parc', 'Dans le parc'], ['affecte', 'Affecté'], ['stock', 'Non affecté (stock, en place)'], ['reparation', 'En réparation'], ['perdu', 'Perdu ou volé'], ['sorti', 'Sorti du parc'], ['tous', 'Tout']].map(([v, l]) => `<option value="${v}" ${filtre.statut === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ">Garantie<select id="f-gar">${[['toutes', 'Toutes'], ['ok', 'Sous garantie'], ['proche', 'Se termine bientôt'], ['expiree', 'Expirée'], ['aucune', 'Non renseignée']].map(([v, l]) => `<option value="${v}" ${filtre.garantie === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ recherche">Rechercher<input id="f-texte" type="search" value="${esc(filtre.texte)}" placeholder="N° de série, inventaire, personne…" autocomplete="off"></label>
      </form>
      <div id="liste">${listeMaterielHtml()}</div>`;
  }

  function listeMaterielHtml() {
    const t = auj();
    if (!E.materiels.length) return vide('Ajoute ton premier matériel', 'Catégorie, désignation, numéro de série, date d\'achat et prix : la fin de garantie se calcule toute seule et tu peux l\'affecter à quelqu\'un dans la foulée.', `<button class="btn primaire" data-action="materiel-nouveau">${ICONES.plus}Nouveau matériel</button>`);
    const liste = listeMateriel();
    if (!liste.length) return vide('Aucun matériel pour ces filtres', 'Change de statut ou efface la recherche.', '<button class="btn" data-action="filtres-effacer">Effacer les filtres</button>');
    const MAX = 200;
    return `<p class="compteur">${pluriel(liste.length, 'matériel')}${liste.length > MAX ? ` · ${MAX} premiers affichés, affine les filtres` : ''}</p><ul class="cartes">${liste.slice(0, MAX).map((m) => carteMateriel(m, t)).join('')}</ul>`;
  }

  function carteMateriel(m, t) {
    const s = R.statut(m, E.affectations);
    const a = R.affectationOuverte(E.affectations, m.id);
    const p = a ? personne(a.personneId) : null;
    const gar = R.garantie(m, t, A().garantie);
    const place = s === 'stock' && collectif(m);
    const et = [`<span class="etiquette ${place ? 'contour' : CLASSE_STATUT[s]}">${libStatut(m, s)}</span>`];
    if (R.enParc(m)) {
      if (gar.etat === 'proche') et.push(`<span class="etiquette jaune">Garantie : ${gar.jours} j</span>`);
      if (gar.etat === 'expiree') et.push('<span class="etiquette contour">Hors garantie</span>');
      if (R.ancien(m, t, E.reglages.categories[m.categorie]?.renouvellement)) et.push('<span class="etiquette bleu">Ancien</span>');
    }
    if (p && R.partie(p, t)) et.push('<span class="etiquette rouge">Détenteur parti</span>');
    const garTxt = gar.etat === 'aucune' ? 'Garantie non renseignée' : `${gar.etat === 'expiree' ? 'Garantie terminée le' : 'Garanti jusqu\'au'} ${fmtCourt(gar.fin)}`;
    const action = s === 'affecte' ? `<button class="act" data-action="restituer" data-id="${a.id}">Restituer<small>retour en stock</small></button>`
      : s === 'stock' && !place ? `<button class="act accepter" data-action="affecter" data-materiel="${m.id}">Affecter<small>à une personne</small></button>` : '';
    return `
      <li class="carte res mat ${R.enParc(m) ? '' : 'soldee'}" style="--c:${place ? 'var(--encre)' : COULEUR_STATUT[s]}" data-carte="${m.id}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere"><span class="numero">${esc(m.inventaire)}</span><span>${esc(nomCat(m.categorie))}</span>${et.join('')}</p>
          <h3>${esc(m.designation)}</h3>
          <p class="res-loc">${s === 'affecte' ? `${esc(p?.nom || 'Personne supprimée')}${p?.service ? ` · ${esc(p.service)}` : ''} <span class="depuis">depuis le ${fmtCourt(a.debut)}</span>` : s === 'sorti' ? `Sorti le ${fmtCourt(m.sortie?.date)}${m.sortie?.motif ? ` · ${esc(m.sortie.motif)}` : ''}` : esc(m.localisation || 'Emplacement non précisé')}</p>
          <p class="carte-meta"><span>N° de série <b>${esc(m.serie || '–')}</b></span><span>Achat ${fmtCourt(m.achat)}${m.prix !== '' && m.prix !== null && m.prix !== undefined ? ` · ${euros(m.prix)}` : ''}</span><span>${garTxt}</span><span>${nomEtat(m.etat)}</span></p>
          ${m.note ? `<p class="motif note-mat">${esc(m.note)}</p>` : ''}
        </div>
        ${action ? `<div class="carte-actions">${action}</div>` : ''}
        <div class="carte-plus"><button data-action="materiel-modifier" data-id="${m.id}">Fiche, historique, statut</button><span>${pluriel(R.historiqueMateriel(E.affectations, m.id).length, 'affectation')}</span></div>
      </li>`;
  }

  function brancherFiltres() {
    const maj = () => { $('#liste').innerHTML = listeMaterielHtml(); };
    $('#f-cat').addEventListener('change', (e) => { filtre.categorie = e.target.value; maj(); });
    $('#f-statut').addEventListener('change', (e) => { filtre.statut = e.target.value; maj(); });
    $('#f-gar').addEventListener('change', (e) => { filtre.garantie = e.target.value; maj(); });
    $('#f-texte').addEventListener('input', (e) => { filtre.texte = e.target.value; maj(); });
  }

  // ---------- Vue Personnes ----------
  function vuePersonnes() {
    const t = auj();
    const presentes = E.personnes.filter((p) => R.presente(p, t)).length;
    const departs = E.personnes.filter((p) => p.depart && p.depart >= t).length;
    return `
      <div class="vue-tete"><div><h1>${pluriel(presentes, 'personne présente', 'personnes présentes')}${departs ? `, <mark>${pluriel(departs, 'départ prévu', 'départs prévus')}</mark>` : ''}.</h1><p>Qui détient quoi, depuis quand. Au départ d'une personne : fiche de restitution et « Tout restituer ».</p></div>
        <div class="actions"><button class="btn primaire" data-action="personne-nouvelle">${ICONES.plus}Nouvelle personne</button></div></div>
      <form class="filtres filtres-p" role="search" onsubmit="return false">
        <fieldset class="champ bascule trois"><legend>Afficher</legend><div>${[['presents', 'Présentes'], ['partis', 'Parties'], ['tous', 'Toutes']].map(([v, l]) => `<label><input type="radio" name="fp-vue" value="${v}" ${filtreP.vue === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <label class="champ recherche">Rechercher<input id="fp-texte" type="search" value="${esc(filtreP.texte)}" placeholder="Nom, service…" autocomplete="off"></label>
      </form>
      <div id="liste-p">${listePersonnesHtml()}</div>
      <p class="note rgpd-note">Données personnelles de salariés : ne garde que le nécessaire et informe les personnes concernées (voir le Guide).</p>`;
  }

  function listePersonnesHtml() {
    const t = auj();
    if (!E.personnes.length) return vide('Ajoute les personnes', 'Nom, service, date d\'arrivée : c\'est tout ce qu\'il faut pour suivre qui détient quel matériel.', `<button class="btn primaire" data-action="personne-nouvelle">${ICONES.plus}Nouvelle personne</button>`);
    const mots = R.plat(filtreP.texte).split(/\s+/).filter(Boolean);
    const liste = E.personnes.filter((p) => (filtreP.vue === 'tous' || (filtreP.vue === 'partis' ? R.partie(p, t) : R.presente(p, t)))
      && mots.every((x) => R.plat(`${p.nom} ${p.service}`).includes(x)))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (!liste.length) return vide('Personne pour ce filtre', filtreP.vue === 'partis' ? 'Aucun départ enregistré.' : 'Efface la recherche.', '', true);
    return `<div class="personnes">${liste.map((p) => cartePersonne(p, t)).join('')}</div>`;
  }

  function cartePersonne(p, t) {
    const r = R.restitution(E, p.id);
    const lic = E.licences.filter((l) => l.attributions.some((a) => a.cible === 'personne' && a.cibleId === p.id));
    const parti = R.partie(p, t);
    const j = p.depart ? ecart(t, p.depart) : null;
    const etiq = parti ? `<span class="etiquette ${r.materiels.length || r.licences.length ? 'rouge' : 'gris'}">Parti(e) le ${fmtCourt(p.depart)}</span>`
      : p.depart ? `<span class="etiquette jaune">Départ ${j === 0 ? 'aujourd\'hui' : `dans ${pluriel(j, 'jour')}`}</span>`
        : p.arrivee && ecart(p.arrivee, t) <= 30 && p.arrivee <= t ? '<span class="etiquette bleu">Arrivée récente</span>' : '';
    const coul = parti ? (r.materiels.length || r.licences.length ? 'var(--rouge)' : 'var(--gris)') : p.depart ? 'var(--jaune)' : 'var(--bleu)';
    return `
      <article class="personne" style="--c:${coul}">
        <div class="personne-tete"><div><h2>${esc(p.nom)}</h2><p>${esc(p.service || 'Service non précisé')}${p.arrivee ? ` · arrivée le ${fmtCourt(p.arrivee)}` : ''}</p></div>${etiq}</div>
        <ul class="detenus">${r.materiels.length ? r.materiels.map((a) => { const m = materiel(a.materielId); return `<li><button data-action="materiel-modifier" data-id="${m?.id}"><b>${esc(m?.inventaire || '?')}</b><span>${esc(m?.designation || 'Matériel supprimé')}</span><small>depuis le ${fmtCourt(a.debut)}</small></button></li>`; }).join('') : '<li class="aucun">Aucun matériel détenu.</li>'}</ul>
        ${lic.length ? `<p class="licences-p"><b>Licences :</b> ${lic.map((l) => esc(l.nom)).join(', ')}</p>` : ''}
        <div class="matiere-pied">
          ${!parti ? `<button class="btn petit" data-action="affecter" data-personne="${p.id}">${ICONES.plus}Remettre</button>` : ''}
          ${p.depart && (r.materiels.length || r.licences.length) ? `<button class="btn petit ${parti ? 'jaune' : ''}" data-action="tout-restituer" data-id="${p.id}">Tout restituer</button>` : ''}
          <button class="btn petit" data-action="fiche" data-id="${p.id}" data-type="${p.depart ? 'restitution' : 'remise'}">${p.depart ? 'Fiche de restitution' : 'Fiche de remise'}</button>
          <button class="btn petit lien" data-action="personne-modifier" data-id="${p.id}">Modifier</button>
        </div>
      </article>`;
  }

  function brancherFiltresP() {
    document.querySelectorAll('[name=fp-vue]').forEach((r) => r.addEventListener('change', (e) => { filtreP.vue = e.target.value; $('#liste-p').innerHTML = listePersonnesHtml(); }));
    $('#fp-texte').addEventListener('input', (e) => { filtreP.texte = e.target.value; $('#liste-p').innerHTML = listePersonnesHtml(); });
  }

  // ---------- Vue Licences ----------
  function vueLicences() {
    const t = auj();
    const tri = [...E.licences].sort((a, b) => rangLicence(a, t) - rangLicence(b, t) || a.nom.localeCompare(b.nom, 'fr'));
    const total = E.licences.reduce((s, l) => s + (Number(l.cout) || 0) * (typeL(l.type).periode === 1 ? 12 : typeL(l.type).periode ? 1 : 0), 0);
    return `
      <div class="vue-tete"><div><h1>${pluriel(E.licences.length, 'licence')}${E.licences.length ? `, ${E.licences.reduce((s, l) => s + R.attribuees(l), 0)} postes attribués` : ''}.</h1><p>Postes achetés contre postes attribués, échéances de renouvellement, attributions à libérer au départ d'une personne.${total ? ` Coût récurrent estimé : ${euros(total)} par an (abonnements, d'après les coûts saisis).` : ''}</p></div>
        <div class="actions"><button class="btn" data-action="csv-licences">Export CSV</button><button class="btn primaire" data-action="licence-nouvelle">${ICONES.plus}Nouvelle licence</button></div></div>
      ${tri.length ? `<div class="licences">${tri.map((l) => carteLicence(l, t)).join('')}</div>` : vide('Saisis tes licences', 'Un logiciel, son type (abonnement par utilisateur, par poste, licence perpétuelle…), le nombre de postes achetés et l\'échéance : l\'outil compte les attributions et te prévient avant le renouvellement.', `<button class="btn primaire" data-action="licence-nouvelle">${ICONES.plus}Nouvelle licence</button>`)}`;
  }
  function rangLicence(l, t) {
    const e = R.echeance(l, t, A().licence).etat;
    if (R.surAttribuee(l) || e === 'expiree') return 0;
    if (e === 'proche' || R.aLiberer(l, E, t).length) return 1;
    return 2;
  }
  function carteLicence(l, t) {
    const ty = typeL(l.type);
    const e = R.echeance(l, t, A().licence);
    const n = R.attribuees(l), postes = Number(l.postes) || 0;
    const lib = new Set(R.aLiberer(l, E, t).map((a) => a.id));
    const et = [];
    if (R.surAttribuee(l)) et.push(`<span class="etiquette rouge">Dépassement : ${n - postes}</span>`);
    if (e.etat === 'expiree') et.push('<span class="etiquette rouge">Échéance dépassée</span>');
    if (e.etat === 'proche') et.push(`<span class="etiquette jaune">À renouveler · ${e.jours} j</span>`);
    if (lib.size) et.push(`<span class="etiquette jaune">${lib.size} à libérer</span>`);
    const pct = postes ? Math.min(100, (n / postes) * 100) : (n ? 100 : 0);
    const coul = R.surAttribuee(l) || e.etat === 'expiree' ? 'var(--rouge)' : e.etat === 'proche' || lib.size ? 'var(--jaune)' : 'var(--bleu)';
    return `
      <article class="licence" style="--c:${coul}" data-carte="${l.id}">
        <div class="licence-tete"><div><h2>${esc(l.nom)}</h2><p>${esc(l.categorie)} · ${esc(ty.nom)}</p></div><button data-action="licence-modifier" data-id="${l.id}">Modifier</button></div>
        <div class="licence-corps">
          ${et.length ? `<p class="carte-matiere">${et.join('')}</p>` : ''}
          <div class="jauge" role="img" aria-label="${n} postes attribués sur ${postes}"><i style="width:${pct}%"></i></div>
          <p class="jauge-txt"><b>${n} / ${postes}</b> poste${postes > 1 ? 's' : ''} attribué${n > 1 ? 's' : ''} · ${R.disponibles(l) >= 0 ? `${R.disponibles(l)} disponible${R.disponibles(l) > 1 ? 's' : ''}` : '<em>aucun disponible</em>'}</p>
          <p class="carte-meta"><span>${e.etat === 'sans' ? 'Sans échéance' : `Échéance ${fmtCourt(l.echeance)}`}</span>${l.cout !== '' && l.cout !== undefined && l.cout !== null ? `<span>${euros(l.cout)} ${ty.periode === 1 ? 'par mois' : ty.periode === 12 ? 'par an' : 'à l\'achat'}</span>` : ''}${l.contrat ? `<span>Contrat ${esc(l.contrat)}</span>` : ''}</p>
          <ul class="attributions">${(l.attributions || []).map((a) => `<li class="${lib.has(a.id) ? 'a-liberer' : ''}"><span>${esc(nomCible(a))}${lib.has(a.id) ? ' <small>à libérer</small>' : ''}</span><button data-action="liberer" data-licence="${l.id}" data-id="${a.id}" aria-label="Libérer : ${esc(nomCible(a))}">Libérer</button></li>`).join('') || '<li class="aucun">Aucune attribution.</li>'}</ul>
        </div>
        <div class="matiere-pied"><button class="btn petit" data-action="attribuer" data-id="${l.id}">${ICONES.plus}Attribuer ${ty.mode === 'personne' ? 'à une personne' : 'à un poste'}</button>${ty.periode && l.echeance ? `<button class="btn petit" data-action="renouveler" data-id="${l.id}">Renouvelée</button>` : ''}</div>
      </article>`;
  }

  // ---------- Vue Fiches ----------
  function vueFiches() {
    const t = auj();
    const pers = [...E.personnes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (!personne(ficheChoix.personneId)) ficheChoix.personneId = pers.find((p) => R.restitution(E, p.id).materiels.length)?.id || pers[0]?.id || '';
    const p = personne(ficheChoix.personneId);
    const types = [['remise', 'Fiche de remise'], ['restitution', 'Fiche de restitution']];
    return `
      <div class="vue-tete"><div><h1>Fiches à signer</h1><p>Fiche de remise à l'arrivée ou à chaque nouveau matériel ; fiche de restitution au départ (liste du matériel à récupérer, à cocher). Imprime-les ou enregistre-les en PDF.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer" ${p ? '' : 'disabled'}>Imprimer ou PDF</button></div></div>
      <div class="filtres pv-choix">
        <label class="champ">Personne<select data-fiche="personneId" ${pers.length ? '' : 'disabled'}>${pers.length ? pers.map((x) => { const n = R.restitution(E, x.id).materiels.length; return `<option value="${x.id}" ${x.id === ficheChoix.personneId ? 'selected' : ''}>${esc(x.nom)} (${n} matériel${n > 1 ? 's' : ''}${R.partie(x, t) ? ', partie' : ''})</option>`; }).join('') : '<option>Aucune personne</option>'}</select></label>
        <fieldset class="champ bascule"><legend>Document</legend><div>${types.map(([v, l]) => `<label><input type="radio" name="fiche-type" data-fiche="type" value="${v}" ${ficheChoix.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        ${p && ficheChoix.type === 'restitution' && (R.restitution(E, p.id).materiels.length || R.restitution(E, p.id).licences.length) ? `<div class="champ"><span>Une fois le matériel récupéré</span><button class="btn" type="button" data-action="tout-restituer" data-id="${p.id}">Enregistrer la restitution</button></div>` : ''}
      </div>
      ${p ? `<div class="pv-cadre"><article class="pv-doc" id="fiche-doc">${documentFiche(p, ficheChoix.type)}</article></div>`
        : vide('Aucune personne', 'Ajoute une personne et affecte-lui du matériel pour éditer sa fiche.', `<button class="btn primaire" data-action="personne-nouvelle">${ICONES.plus}Nouvelle personne</button>`)}`;
  }

  function documentFiche(p, type) {
    const t = auj();
    const r = R.restitution(E, p.id);
    const tete = `
      <header>
        <p class="pv-structure">${esc(E.structure || 'Structure')}</p>
        <h2>${type === 'remise' ? 'Fiche de remise de matériel' : 'Fiche de restitution de matériel'}</h2>
        <dl>
          <div><dt>Collaborateur</dt><dd>${esc(p.nom)}</dd></div>
          <div><dt>Service</dt><dd>${esc(p.service || '–')}</dd></div>
          ${p.arrivee ? `<div><dt>Arrivée</dt><dd>${fmtCourt(p.arrivee)}</dd></div>` : ''}
          ${type === 'restitution' ? `<div><dt>Départ</dt><dd>${p.depart ? fmtCourt(p.depart) : 'Non renseigné'}</dd></div>` : ''}
          <div><dt>Établie le</dt><dd>${fmtCourt(t)}</dd></div>
        </dl>
      </header>`;
    const signatures = `<div class="signatures"><div><p>Le collaborateur</p><p class="sig-lignes">Date et signature</p></div><div><p>Pour ${esc(E.structure || 'la structure')}</p><p class="sig-lignes">Nom, fonction, date et signature</p></div></div>`;
    const pied = '<footer>Modèle à adapter à la charte informatique ou au règlement intérieur de la structure ; ne constitue pas un conseil juridique. Données personnelles limitées au nécessaire à la gestion du matériel.</footer>';
    const ligneMat = (a, cols) => { const m = materiel(a.materielId) || {}; return `<tr><td class="num">${esc(m.inventaire || '?')}</td><td>${esc(nomCat(m.categorie))}<br><b>${esc(m.designation || 'Matériel supprimé')}</b></td><td>${esc(m.serie || '–')}</td>${cols.map((f) => `<td class="date">${f(a, m)}</td>`).join('')}</tr>`; };
    const licTab = (cocher) => (r.licences.length ? `<table><thead><tr><th>Logiciel</th><th>Attribuée à</th>${cocher ? '<th>Libérée</th>' : ''}</tr></thead><tbody>${r.licences.map(({ licence: l, attribution: a }) => `<tr><td>${esc(l.nom)}</td><td>${a.cible === 'personne' ? 'Collaborateur' : esc(nomCible(a))}</td>${cocher ? '<td class="case-vide">☐</td>' : ''}</tr>`).join('')}</tbody></table>` : '<p class="pv-vide">Aucune licence attribuée.</p>');
    if (type === 'remise') {
      return `${tete}
        <h3>Matériel remis (${r.materiels.length})</h3>
        ${r.materiels.length ? `<table><thead><tr><th>N° inv.</th><th>Matériel</th><th>N° de série</th><th>Remis le</th><th>État</th></tr></thead><tbody>${r.materiels.map((a) => ligneMat(a, [(x) => fmtCourt(x.debut), (x) => nomEtat(x.etatRemise)])).join('')}</tbody></table>` : '<p class="pv-vide">Aucun matériel détenu à ce jour.</p>'}
        <h3>Accès logiciels</h3>
        ${licTab(false)}
        <p class="pv-texte">Je reconnais avoir reçu le matériel ci-dessus, dans l'état indiqué, pour un usage professionnel. Je m'engage à en prendre soin, à signaler sans délai toute panne, perte ou vol, et à le restituer à la demande de la structure ou à mon départ.</p>
        ${signatures}${pied}`;
    }
    const rendus = R.historiquePersonne(E.affectations, p.id).filter((a) => a.fin).slice(0, 6);
    return `${tete}
      <h3>Matériel à récupérer (${r.materiels.length})</h3>
      ${r.materiels.length ? `<table><thead><tr><th>N° inv.</th><th>Matériel</th><th>N° de série</th><th>Remis le</th><th>Rendu</th><th>État constaté</th></tr></thead><tbody>${r.materiels.map((a) => ligneMat(a, [(x) => fmtCourt(x.debut), () => '<span class="case-vide">☐</span>', () => ''])).join('')}</tbody></table>` : '<p class="pv-vide">Rien à récupérer : tout le matériel a été restitué.</p>'}
      <h3>Licences à libérer</h3>
      ${licTab(true)}
      ${rendus.length ? `<h3>Déjà restitué</h3><table><thead><tr><th>N° inv.</th><th>Matériel</th><th>N° de série</th><th>Remis le</th><th>Rendu le</th><th>État au retour</th></tr></thead><tbody>${rendus.map((a) => ligneMat(a, [(x) => fmtCourt(x.debut), (x) => fmtCourt(x.fin), (x) => nomEtat(x.etatRetour)])).join('')}</tbody></table>` : ''}
      <p class="pv-texte">À vérifier aussi : badges, clés, codes d'accès et comptes à désactiver selon tes procédures.</p>
      ${signatures}${pied}`;
  }

  function imprimer() {
    const doc = $('#fiche-doc');
    if (!doc) return;
    $('#impression').innerHTML = doc.innerHTML;
    window.print();
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const G = B.rgpd;
    const c = E.reglages.categories;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Comment l'outil calcule, la base intégrée et le rappel sur les données personnelles.</p></div></div>
      <h2 class="titre-section">Le cycle d'un matériel</h2>
      <ol class="cycle">${[['Achat', 'Catégorie, numéro de série, date d\'achat, prix. La fin de garantie se calcule (achat + durée − 1 jour).'], ['Remise', 'Affectation à une personne à une date, avec l\'état. Fiche de remise à signer.'], ['Restitution', 'Retour en stock avec l\'état constaté. L\'historique garde qui l\'a eu et quand.'], ['Sortie', 'Réparation, perte ou sortie du parc (recyclage, revente, don). Le matériel sorti ne compte plus.']].map(([tt, d], k) => `<li style="--c:${['var(--jaune)', 'var(--bleu)', 'var(--gris)', 'var(--rouge)'][k]}"><b>${tt}</b><p>${d}</p></li>`).join('')}</ol>
      <h2 class="titre-section">Règles des alertes</h2>
      <ul class="limites">
        <li><b>Départ</b> : urgent si la date de départ est passée et que du matériel ou une licence n'est pas restitué ; à prévoir dans les ${A().depart} jours qui précèdent.</li>
        <li><b>Licences</b> : urgent si plus de postes attribués qu'achetés ou si l'échéance est dépassée ; à prévoir dans les ${A().licence} jours avant l'échéance, ou si une attribution concerne une personne partie ou un matériel sorti.</li>
        <li><b>Garantie</b> : à prévoir dans les ${A().garantie} jours avant le dernier jour couvert (date d'achat + durée en mois − 1 jour).</li>
        <li><b>Réparation longue</b> : au-delà de ${A().reparationLongue} jours. <b>Matériel ancien</b> : âge égal ou supérieur à la durée de renouvellement de sa catégorie.</li>
      </ul>
      <h2 class="titre-section">Données personnelles (RGPD) <span>Rappel, pas un conseil juridique.</span></h2>
      <div class="legal">
        <p>Les affectations nominatives sont des données personnelles de tes salariés. D'après la ${esc(G.source)} (publiée le ${esc(G.publie)}, consultée le ${esc(G.consulte)}), en substance :</p>
        <ul>${G.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p><a href="${G.url}" target="_blank" rel="noopener">Lire la page de la CNIL</a>. Tes données sont hébergées en ligne pour la synchronisation entre tes appareils ; seule ta clé y donne accès. Une personne partie qui a tout restitué peut être anonymisée depuis sa fiche.</p>
      </div>
      <h2 class="titre-section">Catégories de matériel <span>Valeurs proposées à la saisie, indicatives : la facture ou le contrat fait foi. Modifiables dans les réglages.</span></h2>
      <div class="lots-types">${B.categories.map((x) => `<span><b>${c[x.id]?.garantie ?? x.garantie} m</b>${esc(x.nom)} · renouveler après ${c[x.id]?.renouvellement ?? x.renouvellement} ans</span>`).join('')}</div>
      <h2 class="titre-section">Types de licence</h2>
      <div class="lots-types">${B.typesLicence.map((x) => `<span><b>${x.periode === 12 ? '1 an' : x.periode === 1 ? '1 mois' : '–'}</b>${esc(x.nom)}</span>`).join('')}</div>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Saisie manuelle</b> : pas d'agent d'inventaire automatique ni de découverte réseau.</li>
        <li><b>Pas de pièces jointes</b> : note la référence de la facture ou du contrat dans la note du matériel ou de la licence.</li>
        <li><b>Un compte, une clé</b> : les mêmes données sur tous tes appareils ; pas de comptes séparés pour les salariés.</li>
        <li><b>Prix</b> : tels que saisis (HT ou TTC, au choix, garde la même convention) ; aucun calcul d'amortissement comptable.</li>
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
      let err;
      try { err = auValider?.(new FormData(e.target), e.submitter?.value); } catch (x) { err = x.message; }
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (err === false) return;
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const pied2 = (ok, suppr) => (suppr ? `<button class="btn primaire" value="ok">${ok}</button><button class="btn danger gauche" value="supprimer">${suppr}</button>` : `<button class="btn primaire" value="ok">${ok}</button><button class="btn" value="annuler">Annuler</button>`);

  // Applique une modification avec possibilité d'annuler (copie de l'état avant).
  function modifier(fn, message, annulable = true) {
    const avant = structuredClone(E);
    fn();
    annulation = annulable ? () => { E = avant; } : null;
    sauver(); rendre();
    toast(message, annulable ? { libelle: 'Annuler', faire: annuler } : undefined);
  }

  const optionsPersonnes = (choisi, t = auj()) => `<option value="">Choisir…</option>${[...E.personnes].filter((p) => R.presente(p, t) || p.id === choisi).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((p) => `<option value="${p.id}" ${p.id === choisi ? 'selected' : ''}>${esc(p.nom)}${p.service ? ` · ${esc(p.service)}` : ''}</option>`).join('')}`;
  const optionsEtats = (choisi) => B.etats.map((e) => `<option value="${e.id}" ${e.id === choisi ? 'selected' : ''}>${e.nom}</option>`).join('');

  function modaleMateriel(id) {
    const m = id ? materiel(id) : null;
    const t = auj();
    const cat = m?.categorie || filtre.categorie || 'portable';
    const fournisseurs = [...new Set(E.materiels.map((x) => x.fournisseur).filter(Boolean))].sort();
    const hist = m ? R.historiqueMateriel(E.affectations, m.id) : [];
    const gar = m ? R.garantie(m, t, A().garantie) : null;
    const a = m ? R.affectationOuverte(E.affectations, m.id) : null;
    const corps = `
      <div class="grille-2">
        <label class="champ">Catégorie<select name="categorie" id="m-cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === cat ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">N° d'inventaire<small>Étiquette collée sur le matériel.</small><input name="inventaire" maxlength="30" value="${esc(m?.inventaire || R.prochainInventaire(E.materiels))}" required></label>
      </div>
      <label class="champ">Désignation<small>Description courte (ex. : Portable 14 pouces · compta).</small><input name="designation" maxlength="80" required value="${esc(m?.designation || '')}"></label>
      <div class="grille-2">
        <label class="champ">N° de série<input name="serie" maxlength="60" value="${esc(m?.serie || '')}" autocapitalize="characters" spellcheck="false"></label>
        <label class="champ">Fournisseur<input name="fournisseur" maxlength="80" list="dl-fourn" value="${esc(m?.fournisseur || '')}" placeholder="Ex. : Revendeur informatique"></label>
      </div>
      <datalist id="dl-fourn">${fournisseurs.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="grille-3">
        <label class="champ">Date d'achat<input type="date" name="achat" value="${m?.achat || t}" max="${t}"></label>
        <label class="champ">Prix (€)<input type="number" name="prix" min="0" step="0.01" inputmode="decimal" value="${m?.prix ?? ''}"></label>
        <label class="champ">Garantie (mois)<input type="number" name="garantie" id="m-gar" min="0" max="120" value="${m?.garantie ?? E.reglages.categories[cat]?.garantie ?? 12}"></label>
      </div>
      <p class="aide" id="m-gar-txt">${garantieTexte(m || { achat: t, garantie: E.reglages.categories[cat]?.garantie })}</p>
      <div class="grille-2">
        <label class="champ">Statut<select name="statut" id="m-statut">${B.statuts.map((s) => `<option value="${s.id}" ${s.id === (m?.statut || 'actif') ? 'selected' : ''}>${s.nom}</option>`).join('')}</select></label>
        <label class="champ">État<select name="etat">${optionsEtats(m?.etat || 'neuf')}</select></label>
      </div>
      <div class="grille-2" id="m-sortie" ${m?.statut === 'sorti' ? '' : 'hidden'}>
        <label class="champ">Sorti le<input type="date" name="sortieDate" value="${m?.sortie?.date || t}" max="${t}"></label>
        <label class="champ">Motif<select name="sortieMotif">${B.motifsSortie.map((x) => `<option ${x === m?.sortie?.motif ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Emplacement<small>Quand il n'est pas affecté (armoire, baie, salle…).</small><input name="localisation" maxlength="60" value="${esc(m?.localisation || '')}"></label>
      <label class="champ">Note<small>Facture, contrat de maintenance, panne… Factuel, sans appréciation sur une personne.</small><input name="note" maxlength="200" value="${esc(m?.note || '')}"></label>
      ${m ? `<div class="groupe"><h3>${a ? `Affecté à ${esc(personne(a.personneId)?.nom || '?')} depuis le ${fmtCourt(a.debut)}` : 'Non affecté'}${gar.etat !== 'aucune' ? ` · ${gar.etat === 'expiree' ? 'hors garantie' : `garanti ${gar.jours} j encore`}` : ''}</h3>
        ${hist.length ? `<ol class="historique">${hist.map((h) => `<li><b>${fmtCourt(h.debut)} → ${h.fin ? fmtCourt(h.fin) : 'aujourd\'hui'}</b> ${esc(personne(h.personneId)?.nom || 'Personne supprimée')}${h.etatRetour ? ` · rendu ${nomEtat(h.etatRetour).toLowerCase()}` : ''}${h.note ? ` · ${esc(h.note)}` : ''}</li>`).join('')}</ol>` : '<p class="aide">Jamais affecté.</p>'}
        <div class="rang">${a ? `<button class="btn petit" type="button" data-action="restituer" data-id="${a.id}">Restituer</button>` : R.enParc(m) && m.statut === 'actif' ? `<button class="btn petit" type="button" data-action="affecter" data-materiel="${m.id}">Affecter</button>` : ''}</div></div>`
        : `<div class="groupe"><h3>Affecter tout de suite <small>(facultatif)</small></h3><div class="grille-2"><label class="champ">À<select name="personneId">${optionsPersonnes('')}</select></label><label class="champ">Remis le<input type="date" name="debut" value="${t}" max="${t}"></label></div></div>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? `${esc(m.inventaire)} · ${esc(m.designation)}` : 'Nouveau matériel', corps, pied2(m ? 'Enregistrer' : 'Ajouter', m ? 'Supprimer' : ''), (f, action) => {
      if (action === 'supprimer') {
        if (a) return 'Ce matériel est affecté : enregistre d\'abord sa restitution.';
        if (!confirm(`Supprimer ${m.inventaire} et son historique (${pluriel(hist.length, 'affectation')}) ? Pour garder la trace, préfère le statut « Sorti du parc ».`)) return '';
        modifier(() => {
          E.materiels = E.materiels.filter((x) => x.id !== m.id);
          E.affectations = E.affectations.filter((x) => x.materielId !== m.id);
          E.licences = E.licences.map((l) => ({ ...l, attributions: l.attributions.filter((x) => !(x.cible === 'materiel' && x.cibleId === m.id)) }));
        }, `${m.inventaire} supprimé.`);
        return;
      }
      const designation = txt(f, 'designation');
      const inventaire = txt(f, 'inventaire').toUpperCase();
      if (!designation) return 'Indique la désignation.';
      if (!inventaire) return 'Indique le numéro d\'inventaire.';
      const d1 = R.doublon(E.materiels, 'inventaire', inventaire, m?.id);
      if (d1) return `Le n° d'inventaire ${inventaire} est déjà utilisé (${d1.designation}).`;
      const serie = txt(f, 'serie').toUpperCase();
      const d2 = R.doublon(E.materiels, 'serie', serie, m?.id);
      if (d2) return `Ce numéro de série est déjà enregistré : ${d2.inventaire} · ${d2.designation}.`;
      const achat = f.get('achat') || '';
      if (achat && (!R.estDate(achat) || achat > t)) return 'La date d\'achat ne peut pas être dans le futur.';
      const prixBrut = String(f.get('prix') ?? '').replace(',', '.').trim();
      const prix = prixBrut === '' ? '' : Number(prixBrut);
      if (prix !== '' && (!Number.isFinite(prix) || prix < 0)) return 'Prix invalide.';
      const garantie = Number(f.get('garantie'));
      if (!Number.isInteger(garantie) || garantie < 0 || garantie > 120) return 'Garantie : nombre entier de mois, de 0 à 120.';
      const statut = f.get('statut');
      if (a && statut !== 'actif' && statut !== 'reparation') return 'Ce matériel est affecté : enregistre d\'abord sa restitution avant de le déclarer perdu ou sorti.';
      if (statut === 'reparation' && a) return 'Restitue d\'abord le matériel (état : hors service), puis passe-le en réparation.';
      let sortie = null;
      if (statut === 'sorti') {
        const sd = f.get('sortieDate');
        if (!R.estDate(sd) || sd > t || (achat && sd < achat)) return 'Date de sortie invalide.';
        sortie = { date: sd, motif: f.get('sortieMotif') };
      }
      const champs = { categorie: f.get('categorie'), inventaire, designation, serie, fournisseur: txt(f, 'fournisseur'), achat, prix, garantie, statut, etat: f.get('etat'), localisation: txt(f, 'localisation'), note: txt(f, 'note'), sortie };
      if (m) {
        champs.statutDepuis = statut !== m.statut ? t : m.statutDepuis || null;
        modifier(() => { Object.assign(materiel(m.id), champs); }, `${inventaire} enregistré.`);
        return;
      }
      const n = { id: uid(), ...champs, statutDepuis: statut !== 'actif' ? t : null };
      const pid = f.get('personneId');
      let affs = E.affectations;
      if (pid) {
        const debut = f.get('debut');
        affs = R.affecter(affs, n, { id: uid(), personneId: pid, date: debut, etat: champs.etat, personne: personne(pid) });
      }
      modifier(() => { E.materiels.push(n); E.affectations = affs; }, pid ? `${inventaire} ajouté et remis à ${personne(pid).nom}.` : `${inventaire} ajouté au stock.`);
    });
    const d = modale();
    let garManuelle = !!m;
    const champGar = $('#m-gar', d);
    const majTxt = () => { $('#m-gar-txt', d).textContent = garantieTexte({ achat: $('[name=achat]', d).value, garantie: champGar.value }); };
    champGar.addEventListener('input', () => { garManuelle = true; majTxt(); });
    $('[name=achat]', d).addEventListener('change', majTxt);
    $('#m-cat', d).addEventListener('change', (e) => { if (!garManuelle) { champGar.value = E.reglages.categories[e.target.value]?.garantie ?? 12; majTxt(); } });
    $('#m-statut', d).addEventListener('change', (e) => { $('#m-sortie', d).hidden = e.target.value !== 'sorti'; });
    if (!m) $('[name=designation]', d).focus();
  }
  function garantieTexte(m) {
    const fin = R.finGarantie({ achat: m.achat, garantie: Number(m.garantie) });
    if (!fin) return 'Sans date d\'achat ou sans garantie : aucune alerte de fin de garantie.';
    const j = ecart(auj(), fin);
    return `Dernier jour couvert : ${fmt(fin, { day: 'numeric', month: 'long', year: 'numeric' })}${j < 0 ? ' (terminée)' : ` (dans ${pluriel(j, 'jour')})`}. Vérifie la durée sur la facture.`;
  }

  // Affectation : depuis un matériel (choix de la personne) ou une personne (choix du matériel en stock).
  function modaleAffecter(o = {}) {
    const t = auj();
    const enStock = E.materiels.filter((m) => R.statut(m, E.affectations) === 'stock' && !collectif(m)).sort((a, b) => String(a.inventaire).localeCompare(String(b.inventaire), 'fr', { numeric: true }));
    if (!o.materielId && !enStock.length) { toast('Aucun matériel en stock : ajoute du matériel ou enregistre une restitution.'); return; }
    if (!E.personnes.some((p) => R.presente(p, t))) { toast('Ajoute d\'abord une personne.'); modalePersonne(); return; }
    const m = o.materielId ? materiel(o.materielId) : null;
    const corps = `
      ${m ? `<p class="aide"><b>${esc(m.inventaire)}</b> · ${esc(m.designation)}${m.serie ? ` · n° ${esc(m.serie)}` : ''}</p><input type="hidden" name="materielId" value="${m.id}">`
        : `<label class="champ">Matériel en stock<select name="materielId">${enStock.map((x) => `<option value="${x.id}">${esc(x.inventaire)} · ${esc(x.designation)}${x.serie ? ` · ${esc(x.serie)}` : ''}</option>`).join('')}</select></label>`}
      <label class="champ">Personne<select name="personneId">${optionsPersonnes(o.personneId || '')}</select></label>
      <div class="grille-2">
        <label class="champ">Remis le<input type="date" name="debut" value="${t}" max="${t}"></label>
        <label class="champ">État à la remise<select name="etat">${optionsEtats(m?.etat || 'bon')}</select></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="160" placeholder="Ex. : avec chargeur et sacoche"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Remettre du matériel', corps, pied2('Enregistrer la remise'), (f) => {
      const mat = materiel(f.get('materielId'));
      const pid = f.get('personneId');
      if (!pid) return 'Choisis la personne.';
      if (!R.estDate(f.get('debut')) || f.get('debut') > t) return 'La date de remise ne peut pas être dans le futur.';
      const affs = R.affecter(E.affectations, mat, { id: uid(), personneId: pid, date: f.get('debut'), etat: f.get('etat'), note: f.get('note'), personne: personne(pid) });
      modifier(() => { E.affectations = affs; const x = materiel(mat.id); x.etat = f.get('etat'); }, `${mat.inventaire} remis à ${personne(pid).nom}. Pense à la fiche de remise.`);
    });
  }

  function modaleRestituer(affId) {
    const a = affectation(affId);
    if (!a) return;
    const m = materiel(a.materielId), p = personne(a.personneId);
    const t = auj();
    const corps = `
      <p class="aide"><b>${esc(m?.inventaire)}</b> · ${esc(m?.designation)} · détenu par ${esc(p?.nom || '?')} depuis le ${fmtCourt(a.debut)}</p>
      <div class="grille-2">
        <label class="champ">Rendu le<input type="date" name="fin" value="${p?.depart && p.depart < t ? p.depart : t}" min="${a.debut}" max="${t}"></label>
        <label class="champ">État constaté<select name="etat">${optionsEtats(m?.etat === 'neuf' ? 'bon' : m?.etat || 'bon')}</select></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="160" placeholder="Ex. : chargeur manquant"></label>
      <label class="case"><input type="checkbox" name="reparation"> Envoyer en réparation</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Restitution', corps, pied2('Enregistrer le retour'), (f) => {
      if (f.get('fin') > t) return 'La date de retour ne peut pas être dans le futur.';
      const affs = R.restituer(E.affectations, affId, { date: f.get('fin'), etat: f.get('etat'), note: f.get('note') });
      modifier(() => {
        E.affectations = affs;
        const x = materiel(a.materielId);
        if (x) { x.etat = f.get('etat'); if (f.get('reparation')) { x.statut = 'reparation'; x.statutDepuis = f.get('fin'); } }
      }, `${m?.inventaire} rendu par ${p?.nom || '?'}${f.get('reparation') ? ', parti en réparation' : ', de retour en stock'}.`);
    });
  }

  function modaleToutRestituer(pid) {
    const p = personne(pid);
    const t = auj();
    const r = R.restitution(E, pid);
    const corps = `
      <p class="aide">${esc(p.nom)}${p.depart ? ` · départ le ${fmtCourt(p.depart)}` : ''} · coche ce qui a été récupéré.</p>
      <label class="champ">Rendu le<input type="date" name="fin" value="${p.depart && p.depart < t ? p.depart : t}" max="${t}"></label>
      ${r.materiels.length ? `<div class="restit">${r.materiels.map((a) => { const m = materiel(a.materielId); return `<div class="restit-ligne"><label class="case"><input type="checkbox" name="aff" value="${a.id}" checked> <span><b>${esc(m?.inventaire)}</b> ${esc(m?.designation)}</span></label><select name="etat-${a.id}" aria-label="État constaté : ${esc(m?.inventaire)}">${optionsEtats('bon')}</select></div>`; }).join('')}</div>` : '<p class="aide">Aucun matériel détenu.</p>'}
      ${r.licences.length ? `<fieldset class="champ sans-cadre"><legend>Licences à libérer</legend>${r.licences.map(({ licence: l, attribution: a }) => `<label class="case"><input type="checkbox" name="lib" value="${l.id}|${a.id}" ${a.cible === 'personne' ? 'checked' : ''}> ${esc(l.nom)}${a.cible === 'materiel' ? ` <small>(${esc(nomCible(a))}, suit le poste)</small>` : ''}</label>`).join('')}</fieldset>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Tout restituer', corps, pied2('Enregistrer'), (f) => {
      const fin = f.get('fin');
      if (!R.estDate(fin) || fin > t) return 'Date invalide.';
      let affs = E.affectations;
      const ids = f.getAll('aff');
      for (const id of ids) affs = R.restituer(affs, id, { date: fin, etat: f.get(`etat-${id}`) });
      const libs = f.getAll('lib').map((x) => x.split('|'));
      if (!ids.length && !libs.length) return 'Coche au moins un élément.';
      modifier(() => {
        E.affectations = affs;
        for (const id of ids) { const a = affs.find((x) => x.id === id); const m = materiel(a.materielId); if (m) m.etat = f.get(`etat-${id}`); }
        for (const [lid, aid] of libs) { const i = E.licences.findIndex((l) => l.id === lid); if (i >= 0) E.licences[i] = R.liberer(E.licences[i], aid); }
      }, `${pluriel(ids.length, 'matériel rendu', 'matériels rendus')}, ${pluriel(libs.length, 'licence libérée', 'licences libérées')}.`);
    });
  }

  function modalePersonne(id) {
    const p = id ? personne(id) : null;
    const t = auj();
    const hist = p ? R.historiquePersonne(E.affectations, p.id) : [];
    const r = p ? R.restitution(E, p.id) : null;
    const anonymisable = p && R.partie(p, t) && !r.materiels.length && !r.licences.length && !p.anonyme;
    const corps = `
      <label class="champ">Nom<small>Prénom et initiale suffisent souvent.</small><input name="nom" maxlength="60" required value="${esc(p?.nom || '')}" autocomplete="off"></label>
      <label class="champ">Service ou fonction<input name="service" maxlength="60" value="${esc(p?.service || '')}" list="dl-serv"></label>
      <datalist id="dl-serv">${[...new Set(E.personnes.map((x) => x.service).filter(Boolean))].sort().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="grille-2">
        <label class="champ">Arrivée<input type="date" name="arrivee" value="${p?.arrivee || ''}"></label>
        <label class="champ">Départ<small>Date de fin, même prévue.</small><input type="date" name="depart" value="${p?.depart || ''}"></label>
      </div>
      <label class="champ">Note<small>Factuelle et utile à la gestion du matériel uniquement.</small><input name="note" maxlength="160" value="${esc(p?.note || '')}"></label>
      <p class="aide">RGPD : ne saisis ni adresse, ni téléphone personnel, ni appréciation. Informe la personne de ce suivi.</p>
      ${p ? `<div class="groupe"><h3>Qui a eu quoi, quand</h3>${hist.length ? `<ol class="historique">${hist.map((h) => { const m = materiel(h.materielId); return `<li><b>${fmtCourt(h.debut)} → ${h.fin ? fmtCourt(h.fin) : 'aujourd\'hui'}</b> ${esc(m ? `${m.inventaire} · ${m.designation}` : 'Matériel supprimé')}</li>`; }).join('')}</ol>` : '<p class="aide">Aucun matériel remis.</p>'}
        ${anonymisable ? '<div class="rang"><button class="btn petit" type="button" data-action="anonymiser" data-id="' + p.id + '">Anonymiser (RGPD)</button></div>' : ''}</div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? esc(p.nom) : 'Nouvelle personne', corps, pied2(p ? 'Enregistrer' : 'Ajouter', p ? 'Supprimer' : ''), (f, action) => {
      if (action === 'supprimer') {
        if (r.materiels.length) return 'Cette personne détient du matériel : enregistre d\'abord sa restitution.';
        if (!confirm(`Supprimer ${p.nom} et son historique (${pluriel(hist.length, 'affectation')}) ? Pour garder l'historique sans le nom, préfère « Anonymiser ».`)) return '';
        modifier(() => {
          E.personnes = E.personnes.filter((x) => x.id !== p.id);
          E.affectations = E.affectations.filter((x) => x.personneId !== p.id);
          E.licences = E.licences.map((l) => ({ ...l, attributions: l.attributions.filter((x) => !(x.cible === 'personne' && x.cibleId === p.id)) }));
        }, `${p.nom} supprimé(e).`);
        return;
      }
      const nom = txt(f, 'nom');
      if (!nom) return 'Indique le nom.';
      const arrivee = f.get('arrivee') || null, depart = f.get('depart') || null;
      if (arrivee && depart && depart < arrivee) return 'Le départ ne peut pas précéder l\'arrivée.';
      if (p && depart && hist.some((h) => h.debut > depart)) return 'Une remise de matériel est postérieure à cette date de départ.';
      const champs = { nom, service: txt(f, 'service'), arrivee, depart, note: txt(f, 'note') };
      if (p) modifier(() => Object.assign(personne(p.id), champs), `${nom} enregistré(e).`);
      else modifier(() => E.personnes.push({ id: uid(), ...champs }), `${nom} ajouté(e).`);
    });
  }

  function modaleLicence(id) {
    const l = id ? licence(id) : null;
    const t = auj();
    const ty = l?.type || 'abo-an-util';
    const corps = `
      <label class="champ">Logiciel<small>Nom générique ou usage (ex. : Suite bureautique en ligne).</small><input name="nom" maxlength="80" required value="${esc(l?.nom || '')}"></label>
      <div class="grille-2">
        <label class="champ">Catégorie<select name="categorie">${B.categoriesLogiciel.map((c) => `<option ${c === l?.categorie ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label class="champ">Type<select name="type" id="m-type">${B.typesLicence.map((x) => `<option value="${x.id}" ${x.id === ty ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="grille-3">
        <label class="champ">Postes achetés<input type="number" name="postes" min="0" max="100000" value="${l?.postes ?? 1}" required></label>
        <label class="champ" id="m-ech">Échéance<input type="date" name="echeance" value="${l?.echeance || ajoutMois(t, 12)}"></label>
        <label class="champ">Coût (€)<small id="m-cout-aide">par période</small><input type="number" name="cout" min="0" step="0.01" value="${l?.cout ?? ''}"></label>
      </div>
      <div class="grille-2">
        <label class="champ">Fournisseur<input name="fournisseur" maxlength="80" value="${esc(l?.fournisseur || '')}"></label>
        <label class="champ">Référence du contrat<input name="contrat" maxlength="60" value="${esc(l?.contrat || '')}"></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(l?.note || '')}"></label>
      ${l?.historique?.length ? `<div class="groupe"><h3>Renouvellements</h3><ol class="historique">${l.historique.map((h) => `<li><b>${fmtCourt(h.date)}</b> ${esc(h.action)}</li>`).join('')}</ol></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(l ? esc(l.nom) : 'Nouvelle licence', corps, pied2(l ? 'Enregistrer' : 'Ajouter', l ? 'Supprimer' : ''), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la licence « ${l.nom} » et ses ${pluriel(R.attribuees(l), 'attribution')} ?`)) return '';
        modifier(() => { E.licences = E.licences.filter((x) => x.id !== l.id); }, `« ${l.nom} » supprimée.`);
        return;
      }
      const nom = txt(f, 'nom');
      if (!nom) return 'Indique le logiciel.';
      const postes = Number(f.get('postes'));
      if (!Number.isInteger(postes) || postes < 0) return 'Postes achetés : nombre entier.';
      const type = f.get('type');
      const tl = typeL(type);
      const echeance = tl.periode ? (f.get('echeance') || '') : '';
      if (tl.periode && !R.estDate(echeance)) return 'Indique la date d\'échéance de l\'abonnement.';
      const coutBrut = String(f.get('cout') ?? '').trim();
      const cout = coutBrut === '' ? '' : Number(coutBrut);
      if (cout !== '' && (!Number.isFinite(cout) || cout < 0)) return 'Coût invalide.';
      const champs = { nom, categorie: f.get('categorie'), type, postes, echeance, cout, fournisseur: txt(f, 'fournisseur'), contrat: txt(f, 'contrat'), note: txt(f, 'note') };
      if (l) {
        const ancien = typeL(l.type).mode;
        if (ancien !== tl.mode && l.attributions.length) return 'Ce changement de type change le mode d\'attribution (personne ou poste) : libère d\'abord les attributions.';
        modifier(() => Object.assign(licence(l.id), champs), `« ${nom} » enregistrée.`);
      } else modifier(() => E.licences.push({ id: uid(), ...champs, attributions: [], historique: [] }), `« ${nom} » ajoutée.`);
    });
    const d = modale();
    const maj = () => { const tl = typeL($('#m-type', d).value); $('#m-ech', d).hidden = !tl.periode; $('#m-cout-aide', d).textContent = tl.periode === 1 ? 'par mois' : tl.periode === 12 ? 'par an' : 'à l\'achat'; };
    $('#m-type', d).addEventListener('change', maj);
    maj();
  }

  function modaleAttribuer(lid) {
    const l = licence(lid);
    const t = auj();
    const tl = typeL(l.type);
    const deja = new Set(l.attributions.map((a) => a.cibleId));
    const cibles = tl.mode === 'personne'
      ? E.personnes.filter((p) => R.presente(p, t) && !deja.has(p.id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((p) => [p.id, `${p.nom}${p.service ? ` · ${p.service}` : ''}`])
      : E.materiels.filter((m) => R.enParc(m) && !deja.has(m.id) && ['portable', 'fixe', 'serveur', 'tablette', 'smartphone', 'stockage', 'autre'].includes(m.categorie)).sort((a, b) => String(a.inventaire).localeCompare(String(b.inventaire), 'fr', { numeric: true })).map((m) => [m.id, `${m.inventaire} · ${m.designation}${detenteur(m) ? ` (${detenteur(m).nom})` : ''}`]);
    if (!cibles.length) { toast(tl.mode === 'personne' ? 'Toutes les personnes présentes ont déjà cette licence.' : 'Aucun poste disponible pour cette licence.'); return; }
    const dispo = R.disponibles(l);
    const corps = `
      <p class="aide">${esc(l.nom)} · ${R.attribuees(l)} / ${l.postes} poste(s) attribué(s). ${dispo > 0 ? `${pluriel(dispo, 'poste disponible', 'postes disponibles')}.` : '<b>Aucun poste disponible : une attribution de plus crée un dépassement.</b>'}</p>
      <fieldset class="champ sans-cadre"><legend>${tl.mode === 'personne' ? 'Personnes' : 'Postes'}</legend><div class="choix-cibles">${cibles.map(([v, lib]) => `<label class="case"><input type="checkbox" name="cible" value="${v}"> ${esc(lib)}</label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Attribuer la licence', corps, pied2('Attribuer'), (f) => {
      const ids = f.getAll('cible');
      if (!ids.length) return 'Coche au moins une case.';
      let n = l;
      for (const id of ids) n = R.attribuer(n, tl.mode, id, t, uid());
      modifier(() => { E.licences = E.licences.map((x) => (x.id === l.id ? n : x)); }, `${pluriel(ids.length, 'attribution')} ajoutée${ids.length > 1 ? 's' : ''}${R.surAttribuee(n) ? ' : attention, dépassement du nombre de postes' : ''}.`);
    });
  }

  function modaleReglages() {
    const r = E.reglages.alertes;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En-tête des fiches de remise et de restitution.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-2">
        <label class="champ">Alerte garantie (j avant)<input type="number" name="garantie" min="0" max="365" value="${r.garantie}"></label>
        <label class="champ">Alerte licence (j avant)<input type="number" name="licence" min="0" max="365" value="${r.licence}"></label>
        <label class="champ">Alerte départ (j avant)<input type="number" name="depart" min="0" max="120" value="${r.depart}"></label>
        <label class="champ">Réparation longue (j)<input type="number" name="reparationLongue" min="1" max="365" value="${r.reparationLongue}"></label>
      </div>
      <div class="groupe"><h3>Catégories de matériel</h3><p class="aide">Garantie proposée à la saisie d'un nouveau matériel et âge à partir duquel il est signalé « ancien ». Valeurs indicatives : ta facture fait foi.</p>${tableCategories()}</div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton parc est enregistré en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-tout">Inventaire (CSV)</button><button class="btn petit" type="button" data-action="csv-affectations">Affectations (CSV)</button><button class="btn petit" type="button" data-action="csv-licences">Licences (CSV)</button></div>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, pied2('Enregistrer'), (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const al = { garantie: n('garantie', 0, 365), licence: n('licence', 0, 365), depart: n('depart', 0, 120), reparationLongue: n('reparationLongue', 1, 365) };
      if (Object.values(al).some((v) => v === null)) return 'Fenêtres d\'alerte : nombres entiers de jours (garantie et licence jusqu\'à 365, départ jusqu\'à 120).';
      const copie = structuredClone(E.reglages);
      const err = lireCategories(f, copie);
      if (err) return err;
      modifier(() => { E.structure = txt(f, 'structure'); E.reglages = { ...copie, alertes: al }; }, 'Réglages enregistrés.', false);
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.materiels) || !Array.isArray(d.personnes)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.materiels.length, 'matériel')}, ${pluriel(d.personnes.length, 'personne')}) ?`)) return;
        E = normaliser(d); delete E.majLe; E.demarre = true;
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
  function exporterCsv(quoi) {
    const t = auj();
    if (quoi === 'affectations') { telecharger(R.csvAffectations(E, ctxCsv()), `parc-affectations-${t}.csv`, CSV); toast(`${pluriel(E.affectations.length, 'affectation')} exportée${E.affectations.length > 1 ? 's' : ''} (CSV, point-virgule).`); return; }
    if (quoi === 'licences') { telecharger(R.csvLicences(E, t, ctxCsv()), `parc-licences-${t}.csv`, CSV); toast(`${pluriel(E.licences.length, 'licence')} exportée${E.licences.length > 1 ? 's' : ''} (CSV).`); return; }
    const liste = quoi === 'tout' ? E.materiels : listeMateriel();
    telecharger(R.csvInventaire(E, t, ctxCsv(), liste), `parc-inventaire-${t}.csv`, CSV);
    toast(`${pluriel(liste.length, 'matériel')} exporté${liste.length > 1 ? 's' : ''} (CSV, point-virgule).`);
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
    texte = String(texte).replace(/\.\.(\s|$)/g, '.$1'); // nom terminé par une initiale (« Alex T. »)
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    sauver(); rendre();
    toast('Action annulée.');
  }

  function ouvrirAlerte(ref) {
    if (ref.materiel) modaleMateriel(ref.materiel);
    else if (ref.licence) { changerVue('licences'); setTimeout(() => { const c = document.querySelector(`[data-carte="${ref.licence}"]`); c?.scrollIntoView({ block: 'center' }); c?.classList.add('surligne'); }, 50); }
    else if (ref.personne) { ficheChoix.personneId = ref.personne; ficheChoix.type = 'restitution'; changerVue('fiches'); }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `parc-informatique-${auj()}.json`, 'application/json'); break;
      case 'csv': exporterCsv('filtre'); break;
      case 'csv-tout': exporterCsv('tout'); break;
      case 'csv-affectations': exporterCsv('affectations'); break;
      case 'csv-licences': exporterCsv('licences'); break;
      case 'fermer': modale().close(); break;
      case 'alerte': ouvrirAlerte(JSON.parse(el.dataset.ref)); break;
      case 'materiel-nouveau': modaleMateriel(); break;
      case 'materiel-modifier': if (materiel(id)) modaleMateriel(id); break;
      case 'affecter': fermer(); modaleAffecter({ materielId: el.dataset.materiel, personneId: el.dataset.personne }); break;
      case 'restituer': fermer(); modaleRestituer(id); break;
      case 'tout-restituer': modaleToutRestituer(id); break;
      case 'personne-nouvelle': modalePersonne(); break;
      case 'personne-modifier': modalePersonne(id); break;
      case 'anonymiser': {
        const p = personne(id);
        if (!confirm(`Remplacer le nom de ${p.nom} par une mention anonyme ? L'historique du matériel est conservé.`)) break;
        try { const n = R.anonymiser(E, id, auj()); fermer(); modifier(() => { Object.assign(personne(id), n); }, 'Personne anonymisée.'); } catch (x) { toast(x.message); }
        break;
      }
      case 'fiche': ficheChoix.personneId = id; ficheChoix.type = el.dataset.type; changerVue('fiches'); break;
      case 'licence-nouvelle': modaleLicence(); break;
      case 'licence-modifier': modaleLicence(id); break;
      case 'attribuer': modaleAttribuer(id); break;
      case 'liberer': {
        const l = licence(el.dataset.licence);
        const a = l?.attributions.find((x) => x.id === id);
        if (a) modifier(() => { E.licences = E.licences.map((x) => (x.id === l.id ? R.liberer(x, id) : x)); }, `${l.nom} : attribution de ${nomCible(a)} libérée.`);
        break;
      }
      case 'renouveler': {
        const l = licence(id);
        try { const n = R.renouveler(l, B.typesLicence); modifier(() => { E.licences = E.licences.map((x) => (x.id === l.id ? n : x)); }, `${l.nom} renouvelée : prochaine échéance le ${fmtCourt(n.echeance)}.`); } catch (x) { toast(x.message); }
        break;
      }
      case 'filtres-effacer': Object.assign(filtre, { categorie: '', statut: 'parc', garantie: 'toutes', texte: '' }); rendre(); break;
      case 'imprimer': imprimer(); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.fiche;
    if (!k) return;
    ficheChoix[k] = e.target.value;
    rendre();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !['materiel', 'personnes'].includes(vue)) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    // Lien ?demo : n'écrase jamais le code d'un acheteur enregistré ; démo ouverte par lien non mémorisée.
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
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__parc = { etat: () => E };
  init();
})();
