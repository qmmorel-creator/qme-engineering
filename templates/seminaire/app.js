// Séminaire et offsite QME : participants et réponses, transports (qui voyage avec qui), chambres et répartition,
// programme en salles parallèles, budget et coût par participant, comptage agrégé pour le traiteur (RGPD).
// Données synchronisées par clé de licence (socle commun des templates QME, repris du pilote événementiel).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.SMN;
  const API = '/api/templates';
  const PRODUIT = 'SMN';
  const CLE_CODE = 'qme-smn-code';
  const CLE_CACHE = 'qme-smn-cache';
  const CLE_DEMO = 'qme-smn-demo';
  const CLE_UI = 'qme-smn-ui';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-smn-ecran-accueil';
  const NOM = 'Séminaire et offsite';

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
  const { ajout, ecart, versDate, eur } = R;
  const auj = () => R.iso(new Date());
  const maintenant = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => (s && R.estDate(s) ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return `le ${fmt(s, { day: 'numeric', month: 'long' })}`;
  };
  const heureFr = (h) => (h ? h.replace(':', ' h ') : '');
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const typeSession = (id) => B.sessions.find((t) => t.id === id) || B.sessions[0];
  const mode = (id) => B.modes.find((m) => m.id === id) || B.modes.at(-1);
  const typeChambre = (id) => B.chambres.find((c) => c.id === id) || B.chambres[0];
  const role = (id) => B.roles.find((r) => r.id === id) || B.roles[0];
  const statutDep = (id) => B.statutsDepense.find((s) => s.id === id) || B.statutsDepense[0];
  const REP = { oui: 'Oui', attente: 'En attente', non: 'Non' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let annulation = null;
  const ui = Object.assign({ semId: null, volet: 'transports', rep: '', svc: '', q: '', jour: 1 }, stock.lire(CLE_UI) || {});
  const memoUi = () => stock.ecrire(CLE_UI, { semId: ui.semId, volet: ui.volet });

  const etatVide = () => ({ version: 1, structure: '', tutorielVu: false, reglages: { convention: 'TTC' },
    seminaires: [], participants: [], trajets: [], chambres: [], sessions: [], postes: [], depenses: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) },
      seminaires: tab(d.seminaires).map((s) => ({ nbJours: 1, lieu: '', depart: '', limite: '', budgetCible: 0, notes: '', ...s })),
      participants: tab(d.participants).map((p) => ({ prenom: '', service: '', email: '', role: 'participant', reponse: 'attente', hebergement: true, allerId: '', retourId: '', chambreId: '', regime: '', allergie: false, accessibilite: false, note: '', ...p })),
      trajets: tab(d.trajets).map((t) => ({ sens: 'aller', mode: 'train', libelle: '', depart: '', arrivee: '', date: '', heureDepart: '', heureArrivee: '', places: 0, reference: '', ...t })),
      chambres: tab(d.chambres).map((c) => ({ hebergement: '', type: 'individuelle', capacite: 1, note: '', ...c })),
      sessions: tab(d.sessions).map((x) => ({ jour: 1, duree: 0, type: 'pleniere', salle: '', animateur: '', notes: '', ...x })),
      postes: tab(d.postes),
      depenses: tab(d.depenses).map((x) => ({ fournisseur: '', objet: '', posteId: null, montant: 0, statut: 'devis', paye: 0, echeance: '', ...x })) };
  };
  const sem = (id) => E.seminaires.find((x) => x.id === id);
  const seminairesTries = () => [...E.seminaires].sort((a, b) => a.date.localeCompare(b.date));
  const aVenir = () => seminairesTries().filter((s) => !R.seminairePasse(s, auj()));
  function semCourant() {
    let s = sem(ui.semId);
    if (!s) { s = aVenir()[0] || seminairesTries().at(-1) || null; ui.semId = s?.id || null; }
    return s;
  }
  const deSem = (liste, id) => liste.filter((x) => x.semId === id);
  const trajet = (id) => E.trajets.find((t) => t.id === id);
  const chambre = (id) => E.chambres.find((c) => c.id === id);
  const nomTrajet = (t) => (t ? (t.libelle || `${mode(t.mode).nom} ${t.depart || '?'} → ${t.arrivee || '?'}`) : '');
  const horaireTrajet = (t) => [t.heureDepart && heureFr(t.heureDepart), t.heureArrivee && `arrivée ${heureFr(t.heureArrivee)}`].filter(Boolean).join(', ');
  const libTransport = (v) => (v === 'perso' ? 'Par ses propres moyens' : trajet(v) ? `${nomTrajet(trajet(v))}${trajet(v).heureDepart ? ` (${heureFr(trajet(v).heureDepart)})` : ''}` : '');
  const nomChambre = (c) => (c ? `${c.nom}${c.hebergement ? ` · ${c.hebergement}` : ''}` : '');

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
        toast('Un autre appareil a modifié les données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Les données dépassent la taille autorisée : supprime des séminaires terminés.');
        throw new Error('413');
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
    // Code interne (le nôtre ou celui d'un autre template, refusé ensuite avec un message clair) : 3 lettres + 16 caractères.
    if (n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n))) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}[0-9A-Z]{16}$/.test(n) && c.split('-').length === 5) || (/^[0-9A-F]{32}$/.test(n)); };

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

  // ---------- Création d'un séminaire (premier lancement, bouton, démo) ----------
  // options : { programme: 'journee' | 'deuxjours' | '', postes: bool }
  function creerSeminaire(d, options = {}) {
    const s = { id: uid(), nom: d.nom, date: d.date, nbJours: d.nbJours || 1, lieu: d.lieu || '', depart: d.depart || '', limite: d.limite || '', budgetCible: d.budgetCible || 0, notes: d.notes || '' };
    E.seminaires.push(s);
    if (options.programme && B.programmes[options.programme]) ajouterProgrammeType(s, options.programme);
    if (options.postes) ajouterPostesTypes(s, B.postes);
    return s;
  }
  function ajouterPostesTypes(s, noms) {
    const deja = new Set(deSem(E.postes, s.id).map((p) => p.nom.toLowerCase()));
    let n = 0;
    for (const nom of noms) if (!deja.has(nom.toLowerCase())) { E.postes.push({ id: uid(), semId: s.id, nom, prevu: 0 }); n++; }
    return n;
  }
  function ajouterProgrammeType(s, cle) {
    const nb = Math.max(1, s.nbJours || 1);
    const lignes = B.programmes[cle].sessions.filter(([jour]) => jour <= nb);
    lignes.forEach(([jour, heure, duree, titre, type, salle]) => E.sessions.push({ id: uid(), semId: s.id, jour, heure, duree, titre, type, salle, animateur: '', notes: '' }));
    return lignes.length;
  }
  const programmeParDefaut = (s) => (Math.max(1, s.nbJours || 1) > 1 ? 'deuxjours' : 'journee');

  // ---------- Données de démonstration (relatives à aujourd'hui, entièrement fictives) ----------
  function donneesDemo() {
    E = etatVide();
    E.structure = 'Maison Tilleul (exemple)';
    E.reglages.convention = 'HT';
    const t = auj();
    const annuel = creerSeminaire({ nom: 'Séminaire annuel des managers', date: ajout(t, 26), nbJours: 2, lieu: 'Domaine des Grands Chênes', depart: 'Paris', limite: ajout(t, -2), budgetCible: 4200000 }, { programme: 'deuxjours', postes: true });
    const integration = creerSeminaire({ nom: 'Journée d\'intégration des nouveaux', date: ajout(t, 61), nbJours: 1, lieu: 'Tiers-lieu Les Ateliers', depart: 'Paris', limite: ajout(t, 40), budgetCible: 0 }, { programme: 'journee', postes: true });
    const offsite = creerSeminaire({ nom: 'Offsite de l\'équipe Produit', date: ajout(t, -40), nbJours: 2, lieu: 'Gîte du Val Clair', depart: 'Lyon', limite: ajout(t, -60), budgetCible: 0 }, { programme: 'deuxjours', postes: false });

    // Personnes fictives (prénoms et noms courants, aucune personne réelle visée).
    const prenoms = ['Léa', 'Hugo', 'Chloé', 'Nathan', 'Camille', 'Louis', 'Manon', 'Jules', 'Sarah', 'Adam', 'Inès', 'Paul', 'Emma', 'Noah', 'Jade', 'Arthur', 'Alice', 'Lucas', 'Rose', 'Victor', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Anna', 'Tom', 'Julia', 'Maël', 'Eva', 'Sacha', 'Nina', 'Hélène', 'Yanis', 'Clara', 'Malo', 'Lou', 'Théo', 'Margaux'];
    const noms = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel'];
    const services = ['Direction', 'Ventes', 'Ventes', 'Marketing', 'Finance', 'Ressources humaines', 'Produit', 'Produit', 'Service client', 'Ventes'];
    const T = (s, o) => { const x = { id: uid(), semId: s.id, libelle: '', reference: '', places: 0, ...o }; E.trajets.push(x); return x; };
    const C = (s, o) => { const x = { id: uid(), semId: s.id, note: '', ...o }; E.chambres.push(x); return x; };
    const Pt = (s, o) => { const x = { id: uid(), semId: s.id, prenom: '', service: '', email: '', role: 'participant', reponse: 'oui', hebergement: true, allerId: '', retourId: '', chambreId: '', regime: '', allergie: false, accessibilite: false, note: '', ...o }; E.participants.push(x); return x; };

    // --- Séminaire annuel : 38 invités, 3 trajets aller, 3 retours, 22 chambres ---
    const j1 = annuel.date, j2 = ajout(annuel.date, 1);
    const trainA = T(annuel, { sens: 'aller', mode: 'train', libelle: 'Train du matin', depart: 'Paris', arrivee: 'Gare de Valmont', date: j1, heureDepart: '07:12', heureArrivee: '09:05', places: 20, reference: 'Réservation de groupe GR-4471' });
    const trainB = T(annuel, { sens: 'aller', mode: 'train', libelle: 'Train de 8 h 46', depart: 'Paris', arrivee: 'Gare de Valmont', date: j1, heureDepart: '08:46', heureArrivee: '10:38', places: 8, reference: 'Billets individuels' });
    const car = T(annuel, { sens: 'aller', mode: 'car', libelle: 'Car depuis l\'agence de Lyon', depart: 'Lyon', arrivee: 'Domaine des Grands Chênes', date: j1, heureDepart: '07:30', heureArrivee: '09:40', places: 8, reference: 'Devis autocariste n° 58' });
    const retA = T(annuel, { sens: 'retour', mode: 'train', libelle: 'Train de l\'après-midi', depart: 'Gare de Valmont', arrivee: 'Paris', date: j2, heureDepart: '14:52', heureArrivee: '16:45', places: 22, reference: 'Réservation de groupe GR-4472' });
    const retB = T(annuel, { sens: 'retour', mode: 'train', libelle: 'Train de 13 h 05', depart: 'Gare de Valmont', arrivee: 'Paris', date: j2, heureDepart: '13:05', heureArrivee: '14:58', places: 6, reference: 'Billets individuels' });
    const retCar = T(annuel, { sens: 'retour', mode: 'car', libelle: 'Car vers l\'agence de Lyon', depart: 'Domaine des Grands Chênes', arrivee: 'Lyon', date: j2, heureDepart: '14:20', heureArrivee: '16:30', places: 10, reference: 'Devis autocariste n° 58' });
    const chambres = [];
    for (let i = 1; i <= 14; i++) chambres.push(C(annuel, { hebergement: 'Domaine des Grands Chênes', nom: `Chambre ${100 + i}`, type: 'twin', capacite: 2 }));
    for (let i = 1; i <= 6; i++) chambres.push(C(annuel, { hebergement: 'Domaine des Grands Chênes', nom: `Chambre ${200 + i}`, type: 'individuelle', capacite: 1 }));
    chambres.push(C(annuel, { hebergement: 'Domaine des Grands Chênes', nom: 'Chambre 001', type: 'individuelle', capacite: 1, note: 'Rez-de-chaussée, accès de plain-pied' }));
    chambres.push(C(annuel, { hebergement: 'Domaine des Grands Chênes', nom: 'Suite 300', type: 'double', capacite: 2 }));
    const regimes = { 2: 'Végétarien', 9: 'Végétarien', 14: 'Végétalien', 17: 'Sans porc', 21: 'Végétarien', 25: 'Sans alcool', 30: 'Végétarien', 33: 'Sans porc' };
    const reponses = { 6: 'attente', 13: 'attente', 27: 'attente', 34: 'attente', 11: 'non', 23: 'non', 36: 'non' };
    const lyon = new Set([4, 8, 15, 19, 26, 29, 31, 35, 37]);
    const tardifs = new Set([3, 12, 20, 32]);
    prenoms.forEach((prenom, i) => {
      const reponse = reponses[i] || 'oui';
      const p = Pt(annuel, { prenom, nom: noms[i], service: services[i % services.length], reponse, role: i === 0 ? 'organisation' : i === 5 ? 'intervenant' : 'participant',
        email: '', regime: regimes[i] || '', allergie: i === 7 || i === 22, accessibilite: i === 16, hebergement: i !== 10 });
      if (reponse === 'non') return;
      if (lyon.has(i)) { p.allerId = car.id; p.retourId = retCar.id; }
      else if (tardifs.has(i)) { p.allerId = trainB.id; p.retourId = i === 32 ? retA.id : retB.id; }
      else { p.allerId = trainA.id; p.retourId = retA.id; }
      if (i === 1 || i === 24) { p.allerId = 'perso'; p.retourId = 'perso'; }
      if (i === 6 || i === 27) { p.allerId = ''; p.retourId = ''; } // pas encore réservés
      if (i === 13) p.retourId = '';
    });
    E.participants.find((p) => p.semId === annuel.id && p.accessibilite).chambreId = chambres[20].id;
    const rep = R.repartir(annuel, deSem(E.participants, annuel.id), deSem(E.chambres, annuel.id));
    Object.entries(rep.affectations).forEach(([pid, cid]) => { E.participants.find((p) => p.id === pid).chambreId = cid; });
    // Deux confirmations tardives encore à loger.
    deSem(E.participants, annuel.id).filter((p) => p.reponse === 'oui' && p.chambreId).slice(-2).forEach((p) => { p.chambreId = ''; });
    // Car de Lyon : une personne de plus que de places (surcharge visible).
    Pt(annuel, { prenom: 'Basile', nom: 'Perrin', service: 'Ventes', reponse: 'oui', allerId: car.id, retourId: retCar.id });
    // Programme : animateurs et une visio qui chevauche l'atelier A dans la même salle.
    const S = deSem(E.sessions, annuel.id);
    const anim = { 'Ouverture par la direction': 'Léa Martin', 'Intervention invitée': 'Camille Robert', 'Ateliers (groupe A)': 'Manon Petit', 'Ateliers (groupe B)': 'Hugo Bernard', 'Ateliers (groupe C)': 'Sarah Leroy', 'Activité de cohésion': 'Prestataire d\'activités' };
    S.forEach((x) => { x.animateur = anim[x.titre] || ''; });
    S.find((x) => x.titre === 'Intervention invitée').titre = 'Intervention invitée : travailler en mode projet';
    S.find((x) => x.titre === 'Activité de cohésion').titre = 'Activité de cohésion : course d\'orientation';
    E.sessions.push({ id: uid(), semId: annuel.id, jour: 1, heure: '15:00', duree: 30, titre: 'Visio avec l\'équipe du siège', type: 'pleniere', salle: 'Salle 1', animateur: 'Louis Richard', notes: 'À déplacer : la salle 1 est prise par l\'atelier A.' });
    // Budget (montants d'exemple, fictifs).
    const prevus = (s, m) => deSem(E.postes, s.id).forEach((p) => { p.prevu = (m[p.nom] || 0) * 100; });
    prevus(annuel, { 'Lieu et salles': 10000, Hébergement: 7600, Restauration: 9000, Boissons: 1200, Transports: 5200, 'Activités et cohésion': 2000, 'Intervenants et animation': 2000, 'Technique (son, vidéo)': 900, 'Kits et cadeaux participants': 1100, Imprévus: 1500 });
    const poste = (s, nom) => deSem(E.postes, s.id).find((p) => p.nom === nom)?.id || null;
    const D = (s, posteNom, fournisseur, objet, montant, statut, paye, echeance) => E.depenses.push({ id: uid(), semId: s.id, posteId: poste(s, posteNom), fournisseur, objet, montant: montant * 100, statut, paye: paye * 100, echeance });
    D(annuel, 'Lieu et salles', 'Domaine des Grands Chênes', 'Plénière, 3 salles d\'atelier, 2 jours', 9800, 'engage', 2940, ajout(t, 12));
    D(annuel, 'Hébergement', 'Domaine des Grands Chênes', '22 chambres, 1 nuit', 7260, 'engage', 2178, ajout(t, 12));
    D(annuel, 'Restauration', 'Domaine des Grands Chênes', 'Déjeuners, dîner, petit déjeuner', 8640, 'engage', 0, ajout(t, 26));
    D(annuel, 'Transports', 'Agence de voyages', 'Billets de train de groupe aller et retour', 3120, 'engage', 3120, '');
    D(annuel, 'Transports', 'Autocariste', 'Car Lyon aller et retour', 1480, 'devis', 0, '');
    D(annuel, 'Activités et cohésion', 'Prestataire d\'activités', 'Course d\'orientation encadrée', 2450, 'engage', 0, ajout(t, -3));
    D(annuel, 'Intervenants et animation', 'Intervenante indépendante', 'Intervention et support', 1800, 'engage', 0, ajout(t, 5));
    D(annuel, 'Kits et cadeaux participants', 'Atelier de sérigraphie', 'Gourdes et carnets marqués', 940, 'devis', 0, '');
    D(annuel, 'Boissons', 'Domaine des Grands Chênes', 'Apéritif et boissons du dîner', 1600, 'annule', 300, '');

    // --- Journée d'intégration : peu de réponses, pas de nuit ---
    ['Ambre Colin', 'Bilal Noël', 'Céline Royer', 'Damien Lucas', 'Élise Brun', 'Félix Caron', 'Gaëlle Picard', 'Ilan Marchand', 'Jeanne Aubert', 'Kevin Renard', 'Laura Gauthier', 'Mehdi Perrot'].forEach((n, i) => {
      const [prenom, nom] = n.split(' ');
      Pt(integration, { prenom, nom, service: services[(i + 3) % services.length], reponse: i < 5 ? 'oui' : 'attente', hebergement: false, allerId: 'perso', retourId: 'perso' });
    });
    prevus(integration, { 'Lieu et salles': 1500, Restauration: 1400, 'Activités et cohésion': 900, Imprévus: 200 });
    D(integration, 'Lieu et salles', 'Tiers-lieu Les Ateliers', 'Grande salle et deux salles, une journée', 1450, 'engage', 435, ajout(t, 30));

    // --- Offsite passé : données sensibles encore présentes (alerte d'effacement) ---
    ['Olivia Fabre', 'Pierre Masson', 'Quentin Lemoine', 'Romane Dumas', 'Simon Barbier', 'Tess Hubert', 'Ugo Leclerc', 'Valentin Rey'].forEach((n, i) => {
      const [prenom, nom] = n.split(' ');
      Pt(offsite, { prenom, nom, service: 'Produit', reponse: i === 7 ? 'non' : 'oui', allerId: 'perso', retourId: 'perso', regime: i === 2 ? 'Végétarien' : '', allergie: i === 4 });
    });

    ui.semId = annuel.id; memoUi();
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const FORME_VIDE = '<svg class="forme-vide" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><rect x="8" y="40" width="48" height="48" fill="#1D4E89"/><circle cx="58" cy="34" r="26" fill="#D9302A"/><path d="M40 88 A48 48 0 0 1 88 40 V88 Z" fill="#F5B400"/></svg>';

  function ecranConnexion(message = '') {
    document.title = `${NOM} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="440" cy="90" r="70" fill="#F5B400"/>
          <path d="M10 280 L170 70 L330 280 Z" fill="#1D4E89"/>
          <path d="M250 280 L380 130 L520 280 Z" fill="#D9302A"/>
          <rect x="10" y="286" width="510" height="14" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Séminaire et offsite · assistants de direction, RH, office managers</p>
          <h1>Tout le monde au bon endroit, au bon moment.</h1>
          <p>Participants et réponses, qui voyage avec qui, qui dort où, programme en salles parallèles, budget et coût par participant.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton séminaire</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes séminaires sont enregistrés en ligne et suivent l'équipe d'organisation sur tous ses appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon séminaire</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/seminaire/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : une clé de licence compte 4 blocs de 8 caractères, un code d\'accès SMN 5 blocs (copie-la depuis l\'e-mail reçu).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon séminaire'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, structure: '', convention: 'TTC' };
  function champsSeminaire(s = {}, creation = true) {
    const t = auj();
    return `
      <label class="champ">Nom du séminaire<input name="nom" required maxlength="80" value="${esc(s.nom || '')}" placeholder="Ex. : Séminaire annuel des managers"></label>
      <div class="deux">
        <label class="champ">Premier jour<input type="date" name="date" required value="${esc(s.date || ajout(t, 60))}"></label>
        <label class="champ">Nombre de jours<small>2 jours = 1 nuit</small><input type="number" name="nbJours" min="1" max="7" value="${s.nbJours || 2}"></label>
      </div>
      <div class="deux">
        <label class="champ">Lieu<small>Facultatif</small><input name="lieu" maxlength="80" value="${esc(s.lieu || '')}"></label>
        <label class="champ">Ville de départ<small>Facultative</small><input name="depart" maxlength="60" value="${esc(s.depart || '')}" placeholder="Ex. : Paris"></label>
      </div>
      <div class="deux">
        <label class="champ">Date limite de réponse<small>Facultative : relance signalée après</small><input type="date" name="limite" value="${esc(s.limite || '')}"></label>
        <label class="champ">Budget cible (${esc(E?.reglages.convention || accueil.convention)})<small>Facultatif</small><input name="budgetCible" inputmode="decimal" value="${R.champMontant(s.budgetCible || null)}" placeholder="Ex. : 35 000"></label>
      </div>
      ${creation ? `<fieldset class="choix-base"><legend>Partir de la base intégrée <small>Tout reste modifiable.</small></legend>
        <label class="case"><input type="checkbox" name="programme" checked> Programme type (horaires d'exemple à adapter)</label>
        <label class="case"><input type="checkbox" name="postes" checked> Postes de budget types (sans montant)</label>
      </fieldset>` : ''}
      <p class="erreur" role="alert"></p>`;
  }
  function lireSeminaire(f) {
    const nom = String(f.get('nom') || '').trim();
    const date = f.get('date');
    if (!nom) return 'Indique le nom du séminaire.';
    if (!R.estDate(date)) return 'Indique une date valide.';
    const nbJours = Number(f.get('nbJours')) || 1;
    if (!Number.isInteger(nbJours) || nbJours < 1 || nbJours > 7) return 'Nombre de jours : entre 1 et 7.';
    const limite = f.get('limite') || '';
    if (limite && !R.estDate(limite)) return 'Date limite invalide.';
    const budgetCible = R.lireMontant(f.get('budgetCible'));
    if (budgetCible === null || budgetCible < 0) return 'Budget cible illisible (ex. : 35 000 ou 35000,50).';
    return { nom, date, nbJours, limite, budgetCible, lieu: String(f.get('lieu') || '').trim(), depart: String(f.get('depart') || '').trim() };
  }

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-lancement" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton séminaire.</h1>
        <p class="intro">Deux réglages, puis ton premier séminaire. Tout reste modifiable ensuite dans les réglages.</p>
        <form id="form-accueil" class="pile" style="max-width:520px">
          <label class="champ">Nom de ton entreprise ou de ton service<small>Facultatif : il s'affiche sur le tableau de bord.</small><input id="structure" maxlength="60" value="${esc(a.structure)}" autocomplete="organization"></label>
          <fieldset class="choix-base"><legend>Tu saisis tes montants… <small>Simple libellé : garde la même convention partout.</small></legend>
            <label class="case"><input type="radio" name="convention" value="HT" ${a.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
            <label class="case"><input type="radio" name="convention" value="TTC" ${a.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC)</label>
          </fieldset>
        </form>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Premier séminaire</p>
        <h1>Quel est ton prochain séminaire ?</h1>
        <p class="intro">Ensuite : ajoute les participants, les trajets et les chambres. Le programme type se cale sur le nombre de jours.</p>
        <form id="form-premier" class="pile" style="max-width:640px" novalidate>${champsSeminaire()}
          <div class="accueil-pied">
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
            <span class="rang"><button class="btn" type="button" data-action="accueil-vide">Partir de zéro</button><button class="btn primaire" type="submit">Créer le séminaire</button></span>
          </div>
        </form>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#structure')?.addEventListener('input', (e) => { accueil.structure = e.target.value; });
    document.querySelectorAll('[name=convention]').forEach((r) => r.addEventListener('change', () => { accueil.convention = r.value; }));
    $('#form-premier')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      E = etatVide();
      E.reglages.convention = accueil.convention;
      const d = lireSeminaire(f);
      if (typeof d === 'string') { E = null; $('#form-premier .erreur').textContent = d; return; }
      E.structure = accueil.structure.trim();
      const s = creerSeminaire(d, { programme: f.has('programme') ? programmeParDefaut(d) : '', postes: f.has('postes') });
      ui.semId = s.id; memoUi();
      accueil = { etape: 1, structure: '', convention: 'TTC' };
      sauver(); vue = 'participants'; demarrer();
      toast(`« ${s.nom} » créé. Ajoute maintenant les participants.`);
    });
  }
  function terminerAccueilVide() {
    E = etatVide();
    E.structure = accueil.structure.trim();
    E.reglages.convention = accueil.convention;
    accueil = { etape: 1, structure: '', convention: 'TTC' };
    sauver(); vue = 'bord'; demarrer();
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    participants: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    logistique: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    programme: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="10" height="4" fill="currentColor"/><rect x="7" y="10" width="10" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="16" width="10" height="4" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['participants', 'Participants'], ['logistique', 'Transports et chambres'], ['programme', 'Programme'], ['budget', 'Budget']];
  const COURTS = { bord: 'Bord', participants: 'Inscrits', logistique: 'Logistique', programme: 'Programme', budget: 'Budget' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/seminaire/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Entreprise et participants fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Séminaire<br>et offsite</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span data-court="${COURTS[id]}">${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>
      <div id="impression" aria-hidden="true"></div>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · ${NOM}`;
    const s = semCourant();
    if (!s) { $('#vue').innerHTML = vueSansSeminaire(); return; }
    $('#vue').innerHTML = { bord: vueBord, participants: vueParticipants, logistique: vueLogistique, programme: vueProgramme, budget: vueBudget }[vue](s);
    if (vue === 'budget') brancherGraphique();
    if (vue === 'participants') brancherRecherche();
  }
  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  const vueSansSeminaire = () => `<div class="vue-tete"><div><p class="surtitre">${esc(E.structure || NOM)}</p><h1>Aucun séminaire.</h1></div></div><div class="vide-etat">${FORME_VIDE}<div><h3>Crée ton premier séminaire</h3><p>Participants, trajets, chambres, programme et budget s'y rattachent.</p><div class="actions"><button class="btn primaire" data-action="sem-nouveau">${ICONES.plus}Nouveau séminaire</button></div></div></div>`;

  // Bandeau du séminaire choisi, en tête de chaque vue.
  function enteteSeminaire(s, titre, actions = '', surtitre = '') {
    const t = auj();
    const jours = s.nbJours > 1 ? ` au ${fmt(R.finSeminaire(s), { day: 'numeric', month: 'long' })}` : '';
    return `
      <div class="evt-bandeau" style="--c:var(--ciel);--t:var(--encre)">
        <label class="evt-choix"><span class="sr-only">Séminaire</span><select data-action="choisir-sem" aria-label="Séminaire affiché">${seminairesTries().map((x) => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.nom)} · ${R.dateFr(x.date)}${R.seminairePasse(x, t) ? ' (terminé)' : ''}</option>`).join('')}</select></label>
        <span class="evt-info"><b class="rebours">${R.compteRebours(s, t)}</b><span>${fmtLong(s.date)}${jours}${s.lieu ? ` · ${esc(s.lieu)}` : ''}</span></span>
        <span class="rang"><button class="btn petit" data-action="sem-modifier" data-id="${s.id}">Modifier</button><button class="btn petit" data-action="sem-nouveau" aria-label="Nouveau séminaire">${ICONES.plus}<span class="masque-tel">Séminaire</span></button></span>
      </div>
      <div class="vue-tete"><div>${surtitre ? `<p class="surtitre">${surtitre}</p>` : ''}<h1>${titre}</h1></div><div class="actions">${actions}</div></div>`;
  }

  // ----- Tableau de bord -----
  function vueBord(s) {
    const t = auj();
    const r = R.resume(E, s, t, B.regimes);
    const al = R.alertes(E, s, t, B.regimes);
    const st = r.stats;
    const sansT = new Set([...r.sansAller, ...r.sansRetour].map((p) => p.id)).size;
    const conv = E.reglages.convention;
    const tuiles = [
      ['Confirmés', `${st.oui}<small>/ ${st.total}</small>`, st.tauxReponse === null ? 'Aucun invité.' : `${st.tauxReponse} % de réponses · ${st.attente} en attente`, 'var(--bleu)', 'rond'],
      ['À loger', r.aLoger.length, r.nuits ? `${pluriel(r.placesLibres, 'place libre', 'places libres')} sur ${r.places}` : 'Pas de nuit sur place.', 'var(--jaune)', ''],
      ['Sans trajet', sansT, `${r.sansAller.length} sans aller · ${r.sansRetour.length} sans retour`, 'var(--rouge)', 'rond'],
      [`Par personne (${conv})`, r.cout ? `<span class="montant">${eur(r.cout.engage, 0)}</span>` : '–', r.cout ? `Engagé par confirmé ; prévu ${eur(r.cout.prevu, 0)}` : 'Aucun confirmé.', 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const tr = R.traiteur(s, deSem(E.participants, s.id), deSem(E.sessions, s.id), B.regimes);
    const pct = (n) => (st.total ? (n / st.total) * 100 : 0);
    const autres = seminairesTries().filter((x) => x.id !== s.id);
    const titre = r.passe ? 'Séminaire terminé.' : `${pluriel(st.oui, 'participant confirmé', 'participants confirmés')}${st.attente ? `, ${st.attente} en attente` : ''}.`;
    return `
      ${enteteSeminaire(s, titre, `<button class="btn" data-action="fiche-traiteur">Fiche traiteur</button><button class="btn primaire" data-action="participant-nouveau">${ICONES.plus}Participant</button>`, `${esc(E.structure || 'Tableau de bord')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}`)}
      <div class="tuiles">${tuiles}</div>
      <div class="bord-bas">
        <section><h2 class="titre-section">À traiter <span>${al.length ? 'Le plus urgent d\'abord.' : ''}</span></h2>${al.length ? `<ul class="alertes">${al.map((a) => ligneAlerte(a, s)).join('')}</ul>` : `<p class="ligne-vide">${r.passe ? 'Séminaire terminé : rien à traiter, aucune donnée sensible restante.' : 'Rien à traiter : tout le monde a son trajet, sa chambre et sa place au programme.'}</p>`}</section>
        <section>
          <h2 class="titre-section">Réponses <span>${st.total ? `${st.oui + st.non} sur ${st.total}` : ''}</span></h2>
          <div class="bloc">
            <div class="jauge-rep" role="img" aria-label="${st.oui} oui, ${st.attente} en attente, ${st.non} non"><i class="r-oui" style="width:${pct(st.oui)}%"></i><i class="r-attente" style="width:${pct(st.attente)}%"></i><i class="r-non" style="width:${pct(st.non)}%"></i></div>
            <ul class="legende legende-rep"><li><i class="r-oui"></i>Oui ${st.oui}</li><li><i class="r-attente"></i>En attente ${st.attente}</li><li><i class="r-non"></i>Non ${st.non}</li></ul>
            ${s.limite ? `<p class="note">Date limite de réponse : ${fmt(s.limite, { day: 'numeric', month: 'long' })}.</p>` : ''}
          </div>
          <h2 class="titre-section">Pour le traiteur <span>Nombres seulement, sans nom</span></h2>
          ${blocTraiteur(tr)}
        </section>
      </div>
      ${autres.length ? `<details class="faites"><summary>Autres séminaires (${autres.length})</summary>${autres.map((x) => { const st2 = R.statsParticipants(deSem(E.participants, x.id), B.regimes); return `<div class="ligne-faite" style="--c:var(--bleu)"><i></i><span><b>${esc(x.nom)}</b> · ${R.dateFr(x.date)} · ${R.compteRebours(x, t)} · ${st2.oui}/${st2.total} confirmés</span><button class="btn petit" data-action="ouvrir-sem" data-id="${x.id}" data-vue="bord">Ouvrir</button></div>`; }).join('')}</details>` : ''}`;
  }
  function blocTraiteur(tr) {
    return `<div class="bloc">
      <ul class="compteurs">${tr.regimes.length ? tr.regimes.map(([nom, n]) => `<li><span>${esc(nom)}</span><b>${n}</b></li>`).join('') : '<li><span>Aucun couvert</span><b>0</b></li>'}
        <li><span>Allergie ou intolérance à signaler</span><b>${tr.allergies}</b></li></ul>
      <p class="note">Sur ${pluriel(tr.couverts, 'couvert')} (oui + en attente${tr.attente ? `, dont ${tr.attente} en attente` : ''}). Les personnes concernées par une allergie contactent elles-mêmes le traiteur : aucun détail n'est saisi ici.</p>
    </div>`;
  }
  function ligneAlerte(a, s) {
    const txt = {
      relance: () => `${pluriel(a.n, 'réponse')} en attente : la date limite (${fmt(s.limite, { day: 'numeric', month: 'long' })}) est passée, relance.`,
      'relance-proche': () => `${pluriel(a.n, 'réponse')} en attente, date limite ${quand(s.limite)}.`,
      'sans-aller': () => `${pluriel(a.n, 'participant')} sans trajet aller.`,
      'sans-retour': () => `${pluriel(a.n, 'participant')} sans trajet retour.`,
      'a-loger': () => `${pluriel(a.n, 'participant')} à loger${a.manque ? ` : il manque ${pluriel(a.manque, 'place')}` : ', des places sont libres'}.`,
      chambre: () => `${esc(a.o.chambre.nom)} : ${a.o.occupants.length} occupants pour ${pluriel(a.o.capacite, 'place')}.`,
      trajet: () => `${esc(nomTrajet(a.o.trajet))} : ${a.o.n} passagers pour ${a.o.places} places.`,
      horaire: () => (a.h.type === 'arrivee'
        ? `${esc(nomTrajet(a.h.trajet))} arrive à ${heureFr(a.h.trajet.heureArrivee)}, ${a.h.minutes} min après le début du programme (jour ${a.h.jour}, ${heureFr(a.h.heure)}).`
        : `${esc(nomTrajet(a.h.trajet))} part à ${heureFr(a.h.trajet.heureDepart)}, avant la fin du programme (${heureFr(a.h.heure)}).`),
      chevauchement: () => `${pluriel(a.n, 'session chevauche', 'sessions chevauchent')} une autre dans la même salle.`,
      budget: () => `Dépassement de ${eur(a.l.ecart)} sur « ${esc(a.l.poste.nom)} ».`,
      cible: () => `Engagé au-delà du budget cible de ${eur(a.ecart)}.`,
      paiement: () => `${a.p.etat === 'retard' ? 'Paiement en retard' : 'À payer'} : ${esc(a.p.depense.fournisseur || 'fournisseur')}, ${eur(a.p.reste)} ${a.p.etat === 'retard' ? `dus depuis ${pluriel(-a.p.jours, 'jour')}` : `à régler ${quand(a.p.depense.echeance)}`}.`,
      sensibles: () => `Séminaire terminé depuis ${pluriel(a.jours, 'jour')} : ${pluriel(a.n, 'participant a', 'participants ont')} encore un régime, une allergie ou un besoin d'accessibilité enregistré. Efface-les.`,
    }[a.type]();
    const bouton = a.type === 'sensibles'
      ? `<button class="btn petit danger" data-action="effacer-sensibles">Effacer</button>`
      : `<button class="btn petit" data-action="aller" data-vue="${a.vue}">Voir</button>`;
    return `<li class="alerte ${a.gravite ? '' : 'grave'}"><i></i><span>${txt}</span>${bouton}</li>`;
  }

  // ----- Participants -----
  function vueParticipants(s) {
    const tous = deSem(E.participants, s.id);
    const st = R.statsParticipants(tous, B.regimes);
    const q = ui.q.trim().toLowerCase();
    const services = [...new Set(tous.map((p) => (p.service || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const liste = R.trier(tous.filter((p) => (!ui.rep || p.reponse === ui.rep) && (!ui.svc || (p.service || '').trim() === ui.svc)));
    const tuiles = [
      ['Invités', st.total, `${st.couverts} à prévoir (oui + en attente).`, 'var(--encre)', ''],
      ['Oui', st.oui, st.tauxReponse === null ? '' : `${st.tauxReponse} % de réponses reçues.`, 'var(--bleu)', 'rond'],
      ['En attente', st.attente, s.limite ? `Date limite : ${fmt(s.limite, { day: 'numeric', month: 'long' })}.` : 'À relancer.', 'var(--jaune)', ''],
      ['Non', st.non, 'Retirés des trajets et des chambres.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const svcs = Object.entries(st.parService).sort((a, z) => z[1].total - a[1].total);
    return `
      ${enteteSeminaire(s, 'Participants', `<button class="btn" data-action="participants-rapide">Saisie rapide</button><button class="btn primaire" data-action="participant-nouveau">${ICONES.plus}Participant</button>`)}
      ${rappelRgpd()}
      <div class="tuiles">${tuiles}</div>
      <div class="invites-synthese">
        <section class="bloc"><h3>Pour le traiteur</h3><ul class="compteurs">${Object.entries(st.regimes).filter(([, n]) => n).map(([r, n]) => `<li><span>${esc(r)}</span><b>${n}</b></li>`).join('') || '<li><span>Aucun couvert</span><b>0</b></li>'}</ul><p class="note">Non renseigné compté « sans restriction ».</p></section>
        <section class="bloc"><h3>À signaler, sans détail</h3><ul class="compteurs"><li><span>Allergie ou intolérance</span><b>${st.allergies}</b></li><li><span>Besoin d'accessibilité</span><b>${st.accessibilite}</b></li></ul><p class="note">Nombres seulement : le détail se règle directement avec le traiteur et le lieu.</p></section>
        <section class="bloc"><h3>Par service</h3>${svcs.length ? `<ul class="compteurs">${svcs.map(([n, v]) => `<li><span>${esc(n)}</span><b>${v.oui}/${v.total}</b></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun participant.</p>'}<p class="note">Oui / invités.</p></section>
      </div>
      <div class="filtres">
        <label class="champ compact grand">Rechercher<input type="search" id="recherche" value="${esc(ui.q)}" placeholder="Nom, service…"></label>
        <label class="champ compact">Réponse<select data-action="filtre-rep"><option value="">Toutes</option>${['oui', 'attente', 'non'].map((v) => `<option value="${v}" ${ui.rep === v ? 'selected' : ''}>${REP[v]}</option>`).join('')}</select></label>
        <label class="champ compact">Service<select data-action="filtre-svc"><option value="">Tous</option>${services.map((n) => `<option ${ui.svc === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <span class="rang"><button class="btn petit" data-action="csv" ${tous.length ? '' : 'disabled'}>Exporter (CSV)</button></span>
      </div>
      <p class="compte-liste" id="compte-liste">${pluriel(liste.filter((p) => !q || texteRecherche(p).includes(q)).length, 'participant affiché', 'participants affichés')}</p>
      ${tous.length ? `<ul class="invites" id="liste-participants">${liste.map((p) => ligneParticipant(p, s, q)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun participant</h3><p>Colle ta liste d'un coup (un participant par ligne : « Prénom Nom ; Service ; e-mail ») ou ajoute-les un par un.</p><div class="actions"><button class="btn primaire" data-action="participants-rapide">Saisie rapide</button></div></div></div>`}`;
  }
  const texteRecherche = (p) => `${p.prenom} ${p.nom} ${p.service} ${p.email}`.toLowerCase();
  function rappelRgpd() {
    return `<div class="rgpd"><b>Données sensibles</b> Régimes alimentaires et allergies sont des <strong>données sensibles</strong> (convictions, santé) : saisie facultative, seulement avec l'accord explicite du participant et si c'est utile. Aucun détail médical ici : une case suffit, le participant précise lui-même au traiteur. Partage la clé avec l'équipe d'organisation uniquement et efface ces données après le séminaire (Réglages). <a href="${B.rgpd.url}" target="_blank" rel="noopener">Définition CNIL</a>.</div>`;
  }
  function ligneParticipant(p, s, q) {
    const nuits = R.nuits(s);
    const aller = p.reponse === 'non' ? '' : (p.allerId === 'perso' ? 'propres moyens' : trajet(p.allerId) ? `${esc(nomTrajet(trajet(p.allerId)))}` : '<em>sans aller</em>');
    const retour = p.reponse === 'non' ? '' : (p.retourId === 'perso' ? 'propres moyens' : trajet(p.retourId) ? `${esc(nomTrajet(trajet(p.retourId)))}` : '<em>sans retour</em>');
    const ch = p.reponse === 'non' || !nuits ? '' : p.hebergement === false ? 'pas de chambre' : chambre(p.chambreId) ? esc(chambre(p.chambreId).nom) : '<em>à loger</em>';
    const logi = [aller && `Aller : ${aller}`, retour && `Retour : ${retour}`, ch && `Chambre : ${ch}`].filter(Boolean).join(' · ');
    const sensible = p.regime || p.allergie || p.accessibilite;
    return `<li class="invite" data-texte="${esc(texteRecherche(p))}" ${q && !texteRecherche(p).includes(q) ? 'hidden' : ''}>
      <span class="cat-bande" style="--c:${p.reponse === 'oui' ? 'var(--bleu)' : p.reponse === 'non' ? 'var(--rouge)' : 'var(--jaune)'}"></span>
      <button class="invite-corps" data-action="participant-modifier" data-id="${p.id}"><b>${esc(p.prenom)} ${esc(p.nom)}</b><span>${[p.service, p.role !== 'participant' ? role(p.role).nom : ''].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}${sensible ? ' · <span class="marque-sensible">infos repas ou accès renseignées</span>' : ''}</span>${logi ? `<span class="logi">${logi}</span>` : ''}</button>
      <div class="reponse" role="group" aria-label="Réponse de ${esc(p.prenom)} ${esc(p.nom)}">${[['oui', 'Oui'], ['attente', '?'], ['non', 'Non']].map(([v, l]) => `<button data-action="repondre" data-id="${p.id}" data-v="${v}" class="r-${v}" aria-pressed="${p.reponse === v}" ${v === 'attente' ? 'aria-label="En attente"' : ''}>${l}</button>`).join('')}</div>
    </li>`;
  }
  function brancherRecherche() {
    const champ = $('#recherche');
    if (!champ) return;
    champ.addEventListener('input', () => {
      ui.q = champ.value;
      const q = ui.q.trim().toLowerCase();
      let n = 0;
      document.querySelectorAll('#liste-participants .invite').forEach((li) => { const ok = !q || li.dataset.texte.includes(q); li.hidden = !ok; if (ok) n++; });
      $('#compte-liste').textContent = pluriel(n, 'participant affiché', 'participants affichés');
    });
  }

  // ----- Logistique : transports et hébergement -----
  function vueLogistique(s) {
    const volet = ui.volet === 'chambres' ? 'chambres' : 'transports';
    const seg = `<div class="segment volets" role="group" aria-label="Volet"><button data-action="volet" data-v="transports" aria-pressed="${volet === 'transports'}">Transports</button><button data-action="volet" data-v="chambres" aria-pressed="${volet === 'chambres'}">Hébergement</button></div>`;
    const actions = volet === 'transports'
      ? `<button class="btn primaire" data-action="trajet-nouveau">${ICONES.plus}Trajet</button>`
      : `<button class="btn" data-action="repartir">Répartir automatiquement</button><button class="btn primaire" data-action="chambres-nouvelles">${ICONES.plus}Chambres</button>`;
    return `${enteteSeminaire(s, volet === 'transports' ? 'Transports' : 'Hébergement', actions)}${seg}${volet === 'transports' ? voletTransports(s) : voletChambres(s)}`;
  }
  function voletTransports(s) {
    const P = deSem(E.participants, s.id), T = deSem(E.trajets, s.id);
    const occ = R.occupationTrajets(T, P);
    const sans = R.sansTransport(P, T);
    const hor = R.horairesTrajets(s, T, deSem(E.sessions, s.id));
    const perso = P.filter((p) => R.concerne(p) && (p.allerId === 'perso' || p.retourId === 'perso')).length;
    const carte = (o) => {
      const t = o.trajet;
      const h = hor.find((x) => x.trajet.id === t.id);
      const pct = o.places ? Math.min(100, (o.n / o.places) * 100) : 0;
      return `<article class="log ${o.surcharge ? 'surcharge' : ''}">
        <div class="log-tete"><div><p class="log-type">${esc(mode(t.mode).nom)} · ${t.sens === 'retour' ? 'Retour' : 'Aller'}</p><h3>${esc(nomTrajet(t))}</h3><p>${fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' })}${t.heureDepart ? ` · ${heureFr(t.heureDepart)}` : ''}${t.heureArrivee ? ` → ${heureFr(t.heureArrivee)}` : ''}${t.depart || t.arrivee ? ` · ${esc(t.depart)} → ${esc(t.arrivee)}` : ''}</p></div><b class="occ">${o.n}${o.places ? `<small>/${o.places}</small>` : ''}</b></div>
        <div class="log-corps">
          ${o.places ? `<div class="jauge ${o.surcharge ? 'pleine' : ''}" role="img" aria-label="${o.n} passagers sur ${o.places} places"><i style="width:${pct}%"></i></div><p class="note">${o.surcharge ? `<b class="rouge-t">${pluriel(o.n - o.places, 'passager')} de trop</b>` : `${pluriel(o.libres, 'place libre', 'places libres')}`}</p>` : '<p class="note">Places non précisées.</p>'}
          ${h ? `<p class="avert">${h.type === 'arrivee' ? `Arrive ${h.minutes} min après le début du programme (${heureFr(h.heure)}).` : `Part avant la fin du programme (${heureFr(h.heure)}).`}</p>` : ''}
          ${o.passagers.length ? `<ul class="noms">${o.passagers.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}" title="${p.reponse === 'attente' ? 'En attente de réponse' : ''}">${esc(p.prenom)} ${esc(p.nom)}</li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun passager.</p>'}
          ${t.reference ? `<p class="doc">Référence : ${esc(t.reference)}</p>` : ''}
        </div>
        <div class="log-pied"><button class="btn petit primaire" data-action="passagers" data-id="${t.id}">Passagers</button><button class="btn petit" data-action="trajet-modifier" data-id="${t.id}">Modifier</button></div>
      </article>`;
    };
    const groupe = (sens, titre) => {
      const l = occ.filter((o) => (o.trajet.sens === 'retour') === (sens === 'retour')).sort((a, z) => `${a.trajet.date}${a.trajet.heureDepart}`.localeCompare(`${z.trajet.date}${z.trajet.heureDepart}`));
      return `<h2 class="titre-section">${titre} <span>${pluriel(l.length, 'trajet')} · ${l.reduce((n, o) => n + o.n, 0)} passagers</span></h2>${l.length ? `<div class="cartes-log">${l.map(carte).join('')}</div>` : `<p class="ligne-vide">Aucun trajet ${sens === 'retour' ? 'retour' : 'aller'}.</p>`}`;
    };
    const listeSans = (l, lib) => (l.length ? `<section class="bloc"><h3>${lib} <span class="compte">${l.length}</span></h3><ul class="noms">${l.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}"><button class="lien-nom" data-action="participant-modifier" data-id="${p.id}">${esc(p.prenom)} ${esc(p.nom)}</button></li>`).join('')}</ul></section>` : `<section class="bloc"><h3>${lib}</h3><p class="ligne-vide">Personne.</p></section>`);
    return `
      <p class="aide">Pour chaque trajet, « Passagers » coche qui voyage ensemble. Les « non » sont retirés ; les « en attente » restent comptés (en pointillé). ${perso ? `${pluriel(perso, 'participant vient', 'participants viennent')} par ses propres moyens sur au moins un trajet.` : ''}</p>
      ${T.length ? '' : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun trajet</h3><p>Ajoute le train, l'avion, le car ou la navette de l'aller puis du retour, avec les places réservées.</p><div class="actions"><button class="btn primaire" data-action="trajet-nouveau">${ICONES.plus}Trajet</button></div></div></div>`}
      ${T.length ? groupe('aller', 'Aller') + groupe('retour', 'Retour') : ''}
      <h2 class="titre-section">Sans trajet <span>Participants confirmés ou en attente</span></h2>
      <div class="invites-synthese deux-col">${listeSans(sans.aller, 'Sans aller')}${listeSans(sans.retour, 'Sans retour')}</div>`;
  }
  function voletChambres(s) {
    const P = deSem(E.participants, s.id), C = deSem(E.chambres, s.id);
    const occ = R.occupationChambres(C, P);
    const loger = R.aLoger(s, P, C);
    const places = occ.reduce((n, o) => n + o.capacite, 0);
    const occupees = occ.reduce((n, o) => n + o.occupants.length, 0);
    const libres = occ.reduce((n, o) => n + Math.max(0, o.libres), 0);
    if (!R.nuits(s)) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Pas de nuit sur place</h3><p>Ce séminaire dure une journée : aucune chambre à prévoir. Passe-le à 2 jours ou plus dans « Modifier » pour gérer l'hébergement.</p></div></div>`;
    const tuiles = [
      ['Places', places, `${pluriel(C.length, 'chambre')} · ${R.nuits(s) > 1 ? `${R.nuits(s)} nuits` : '1 nuit'}`, 'var(--encre)', ''],
      ['Occupées', occupees, occ.some((o) => o.surcharge) ? 'Dont des chambres en surcharge.' : 'Confirmés et en attente.', 'var(--bleu)', 'rond'],
      ['Libres', libres, '', 'var(--jaune)', ''],
      ['À loger', loger.length, loger.length > libres ? `Il manque ${pluriel(loger.length - libres, 'place')}.` : loger.length ? 'Assez de places libres.' : 'Tout le monde a sa chambre.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const parHeb = new Map();
    occ.forEach((o) => { const k = o.chambre.hebergement || 'Hébergement'; if (!parHeb.has(k)) parHeb.set(k, []); parHeb.get(k).push(o); });
    const carte = (o) => `<button class="chambre ${o.surcharge ? 'surcharge' : o.libres === 0 ? 'pleine' : o.occupants.length ? 'partielle' : 'vide'}" data-action="occupants" data-id="${o.chambre.id}">
        <span class="ch-tete"><b>${esc(o.chambre.nom)}</b><small>${esc(typeChambre(o.chambre.type).nom)} · ${o.occupants.length}/${o.capacite}</small></span>
        <span class="ch-lits">${Array.from({ length: Math.max(o.capacite, o.occupants.length) }, (_, i) => `<i class="${i >= o.capacite ? 'trop' : i < o.occupants.length ? 'pris' : ''}"></i>`).join('')}</span>
        <span class="ch-noms">${o.occupants.length ? o.occupants.map((p) => `${esc(p.prenom)} ${esc(p.nom)}`).join('<br>') : '<em>Libre</em>'}</span>
        ${o.chambre.note ? `<span class="ch-note">${esc(o.chambre.note)}</span>` : ''}
      </button>`;
    return `
      <div class="tuiles">${tuiles}</div>
      ${loger.length ? `<h2 class="titre-section">À loger <span>Sans chambre : touche un nom pour l'affecter, ou « Répartir automatiquement » (confirmés seulement, par service)</span></h2><ul class="noms grand">${loger.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}"><button class="lien-nom" data-action="participant-modifier" data-id="${p.id}">${esc(p.prenom)} ${esc(p.nom)}${p.service ? ` <small>${esc(p.service)}</small>` : ''}</button></li>`).join('')}</ul>` : ''}
      ${C.length ? [...parHeb.entries()].map(([heb, l]) => `<h2 class="titre-section">${esc(heb)} <span>${pluriel(l.length, 'chambre')} · touche une chambre pour choisir ses occupants</span></h2><div class="chambres">${l.map(carte).join('')}</div>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune chambre</h3><p>Ajoute les chambres réservées d'un coup (par exemple 14 twins numérotées à partir de 101), puis répartis les participants.</p><div class="actions"><button class="btn primaire" data-action="chambres-nouvelles">${ICONES.plus}Chambres</button></div></div></div>`}
      ${C.length ? `<p class="rang-actions"><button class="btn petit" data-action="imprimer-chambres">Imprimer la liste pour l'hébergement</button></p>` : ''}`;
  }

  // ----- Programme -----
  function vueProgramme(s) {
    const t = auj();
    const nb = Math.max(1, s.nbJours || 1);
    if (ui.jour > nb) ui.jour = 1;
    const items = deSem(E.sessions, s.id);
    const c = R.programme(items).filter((x) => x.jour === ui.jour);
    const jourDate = ajout(s.date, ui.jour - 1);
    const estAujourdhui = jourDate === t;
    const ec = estAujourdhui ? R.enCours(items, ui.jour, maintenant()) : null;
    const chev = c.filter((x) => x.chevauche).length;
    const salles = new Set(c.map((x) => (x.salle || '').trim()).filter(Boolean)).size;
    const direct = estAujourdhui ? `<div class="direct">
        <div class="direct-bloc rouge"><p class="surtitre">En cours · ${R.hm(maintenant())}</p>${ec.courantes.length ? ec.courantes.map((x) => `<h3>${esc(x.titre)}</h3><p>${R.hm(x.debut)} – ${R.hm(x.fin)}${x.salle ? ` · ${esc(x.salle)}` : ''}</p>`).join('') : '<h3>Aucune session</h3><p>Rien au programme à cette heure.</p>'}</div>
        <div class="direct-bloc"><p class="surtitre">Ensuite</p>${ec.suivante ? `<h3>${esc(ec.suivante.titre)}</h3><p>à ${R.hm(ec.suivante.debut)}${ec.suivante.salle ? ` · ${esc(ec.suivante.salle)}` : ''}</p>` : '<h3>Fin du programme</h3><p>Plus de session aujourd\'hui.</p>'}</div>
      </div>` : '';
    const types = B.sessions.filter((ty) => c.some((x) => x.type === ty.id));
    return `
      ${enteteSeminaire(s, 'Programme', `<button class="btn" data-action="fiche-traiteur">Fiche traiteur</button><button class="btn" data-action="imprimer-programme" ${items.length ? '' : 'disabled'}>Imprimer</button><button class="btn primaire" data-action="session-nouvelle">${ICONES.plus}Session</button>`)}
      ${direct}
      ${nb > 1 ? `<div class="segment jours" role="group" aria-label="Jour">${Array.from({ length: nb }, (_, i) => `<button data-action="jour" data-v="${i + 1}" aria-pressed="${ui.jour === i + 1}">Jour ${i + 1} · ${fmt(ajout(s.date, i), { day: 'numeric', month: 'short' })}</button>`).join('')}</div>` : ''}
      <h2 class="titre-section">${fmt(jourDate, { weekday: 'long', day: 'numeric', month: 'long' })} <span>${pluriel(c.length, 'session')}${salles ? ` · ${pluriel(salles, 'salle')}` : ''}${chev ? ` · <b class="rouge-t">${pluriel(chev, 'chevauchement')}</b>` : ''}</span></h2>
      ${types.length ? `<ul class="legende legende-types">${types.map((ty) => `<li><i style="background:${couleur(ty.couleur)}"></i>${esc(ty.nom)}</li>`).join('')}</ul>` : ''}
      ${c.length ? `<ol class="conducteur programme">${c.map((x) => {
        const passe = estAujourdhui && x.fin <= maintenant();
        const actif = estAujourdhui && ec.courantes.some((y) => y.id === x.id);
        const ty = typeSession(x.type);
        const paralleles = c.filter((y) => y.id !== x.id && y.debut < x.fin && x.debut < y.fin && !y.chevauche && !x.chevauche && (y.salle || '').trim().toLowerCase() !== (x.salle || '').trim().toLowerCase()).length;
        return `<li class="${x.chevauche ? 'chevauche' : ''} ${passe ? 'passe' : ''} ${actif ? 'actif' : ''}" style="--c:${couleur(ty.couleur)}">
          <span class="heure"><b>${R.hm(x.debut)}</b><small>${R.hm(x.fin)}</small></span>
          <button class="seq-corps" data-action="session-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span><span class="type-session">${esc(ty.nom)}</span> · ${x.duree} min${x.salle ? ` · ${esc(x.salle)}` : ''}${x.animateur ? ` · <strong>${esc(x.animateur)}</strong>` : ''}${paralleles ? ` · en parallèle de ${pluriel(paralleles, 'autre session', 'autres sessions')}` : ''}</span>${x.notes ? `<span class="notes">${esc(x.notes)}</span>` : ''}${x.chevauche ? `<span class="etiquette rouge">Même salle que « ${esc(c.find((y) => y.id === x.chevauche)?.titre || '')} »</span>` : ''}</button>
          <button class="btn petit" data-action="decaler" data-id="${x.id}" aria-label="Décaler ${esc(x.titre)} et les suivantes">Décaler</button>
        </li>`;
      }).join('')}</ol>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Programme vide pour ce jour</h3><p>Ajoute les sessions (plénières, ateliers en parallèle, repas, activités) ou pars d'un programme type.</p><div class="actions"><button class="btn primaire" data-action="programme-type">Ajouter un programme type</button></div></div></div>`}
      ${c.length ? '<p class="rang-actions"><button class="btn petit" data-action="programme-type">Ajouter un programme type</button></p>' : ''}
      <p class="aide">Les sessions en parallèle dans des salles différentes sont normales ; deux sessions qui se recouvrent dans la même salle sont signalées. « Décaler » repousse la session et toutes les suivantes du jour. Les repas alimentent la fiche traiteur.</p>`;
  }

  // ----- Budget -----
  function vueBudget(s) {
    const t = auj();
    const b = R.budget(E, s.id);
    const conv = E.reglages.convention;
    const st = R.statsParticipants(deSem(E.participants, s.id), B.regimes);
    const cout = R.coutParticipant(b.total, st.oui);
    const deps = deSem(E.depenses, s.id);
    const pa = R.paiements(E, t, s.id);
    const cible = s.budgetCible ? `<p class="aide">Budget cible : <b>${eur(s.budgetCible)}</b> · engagé ${eur(b.total.engage)} (${Math.round((b.total.engage / s.budgetCible) * 100)} %) · prévu ${eur(b.total.prevu)}${b.total.prevu > s.budgetCible ? ` · <b class="rouge-t">le prévu dépasse la cible de ${eur(b.total.prevu - s.budgetCible)}</b>` : ''}.</p>` : '';
    const tuiles = [
      ['Prévu', eur(b.total.prevu), cout ? `Soit ${eur(cout.prevu, 0)} par confirmé.` : 'Somme des postes.', 'var(--jaune)', ''],
      ['Engagé', eur(b.total.engage), cout ? `Soit ${eur(cout.engage, 0)} par confirmé.` : 'Dépenses engagées.', 'var(--bleu)', 'rond'],
      ['Payé', eur(b.total.paye), 'Acomptes et soldes réglés.', 'var(--encre)', ''],
      ['Reste à payer', eur(b.total.reste), pa.some((x) => x.etat === 'retard') ? 'Dont des paiements en retard.' : 'Sur les dépenses engagées.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib} (${conv})</p><b class="montant">${v}</b><span>${d}</span></div>`).join('');
    const lignes = [...b.lignes, ...(b.nonAffecte ? [b.nonAffecte] : [])];
    const ordre = ['engage', 'devis', 'annule'];
    return `
      ${enteteSeminaire(s, 'Budget', `<button class="btn" data-action="poste-nouveau">${ICONES.plus}Poste</button><button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Dépense</button>`)}
      <div class="tuiles">${tuiles}</div>
      <p class="aide">Coût par participant = total divisé par les ${pluriel(st.oui, 'confirmé')} (réponse « oui »)${st.attente ? ` ; avec les ${st.attente} en attente, il baisserait à ${eur(Math.round(b.total.engage / Math.max(1, st.oui + st.attente)), 0)} engagés par personne` : ''}.</p>
      ${cible}
      <h2 class="titre-section">Par poste <span>Engagé = dépenses engagées ; payé = montants déjà réglés.</span></h2>
      ${lignes.length ? `<figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Payé, engagé et prévu par poste</h2><div class="legende"><span><i style="background:var(--encre)"></i>Payé</span><span><i style="background:var(--bleu)"></i>Engagé non payé</span><span><i class="repere"></i>Prévu</span></div></div>
        ${barresBudget(lignes)}
        <div class="infobulle" hidden></div>
      </figure>
      <div class="defile"><table class="tableau budget-table"><caption class="sr-only">Budget par poste</caption><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Engagé</th><th class="nb">Payé</th><th class="nb">Reste à payer</th><th class="nb">Écart</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${lignes.map((l) => `<tr class="${l.depassement ? 'depasse' : ''}"><td>${l.poste ? esc(l.poste.nom) : '<em>Non affecté</em>'}</td><td class="nb">${l.poste ? eur(l.prevu) : '–'}</td><td class="nb">${eur(l.engage)}</td><td class="nb">${eur(l.paye)}</td><td class="nb">${eur(l.reste)}</td><td class="nb ${l.depassement ? 'rouge-t' : ''}">${l.poste && l.prevu ? `${l.ecart > 0 ? '+' : ''}${eur(l.ecart)}` : '–'}</td><td>${l.poste ? `<button class="btn lien" data-action="poste-modifier" data-id="${l.poste.id}">Modifier</button>` : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th>Total</th><th class="nb">${eur(b.total.prevu)}</th><th class="nb">${eur(b.total.engage)}</th><th class="nb">${eur(b.total.paye)}</th><th class="nb">${eur(b.total.reste)}</th><th class="nb">${b.total.ecart > 0 ? '+' : ''}${eur(b.total.ecart)}</th><th></th></tr></tfoot></table></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun poste</h3><p>Ajoute les postes types (sans montant) puis saisis ton prévu.</p><div class="actions"><button class="btn primaire" data-action="postes-types">Ajouter les postes types</button></div></div></div>`}
      ${lignes.length && deSem(E.postes, s.id).length < B.postes.length ? '<p class="rang-actions"><button class="btn petit" data-action="postes-types">Ajouter des postes types</button></p>' : ''}
      <h2 class="titre-section">Dépenses <span>${pluriel(deps.length, 'dépense')}</span></h2>
      ${deps.length ? `<div class="contrats">${[...deps].sort((a, z) => ordre.indexOf(a.statut) - ordre.indexOf(z.statut) || (a.echeance || '9').localeCompare(z.echeance || '9')).map((d) => carteDepense(d, t)).join('')}</div>` : '<p class="ligne-vide">Aucune dépense. Ajoute un devis, puis passe-le en « engagée » quand il est signé.</p>'}
      <h2 class="titre-section">Paiements à venir <span>Reste à payer avec une échéance</span></h2>
      ${pa.length ? `<ul class="alertes">${pa.map((x) => `<li class="alerte ${x.etat === 'retard' ? 'grave' : x.etat === 'proche' ? 'proche' : 'calme'}"><i></i><span><b>${fmt(x.depense.echeance)}</b> · ${esc(x.depense.fournisseur || 'Fournisseur')} · ${esc(x.depense.objet)} · <b>${eur(x.reste)}</b>${x.etat === 'retard' ? ` · <em class="rouge-t">en retard de ${pluriel(-x.jours, 'jour')}</em>` : ''}</span><button class="btn petit" data-action="solder" data-id="${x.depense.id}">Payé</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun paiement daté à venir.</p>'}
      <p class="aide">Outil de suivi : les montants sont ceux que tu saisis (${conv}) ; les devis et factures font foi.</p>`;
  }
  function carteDepense(d, t) {
    const poste = E.postes.find((x) => x.id === d.posteId);
    const cl = { devis: 'jaune', engage: 'bleu', annule: 'rouge' }[d.statut];
    const reste = d.statut === 'engage' ? Math.max(0, d.montant - d.paye) : 0;
    return `<article class="contrat ${d.statut === 'annule' ? 'annule' : ''}">
      <div class="contrat-tete"><div><h3>${esc(d.fournisseur || 'Fournisseur')}</h3><p>${esc(d.objet || 'Sans objet')}${poste ? ` · ${esc(poste.nom)}` : ' · non affecté'}</p></div><span class="etiquette ${cl}">${statutDep(d.statut).nom}</span></div>
      <div class="contrat-corps">
        <p class="contrat-montant"><b>${eur(d.montant)}</b>${d.paye ? ` · payé ${eur(d.paye)}` : ''}</p>
        ${reste ? `<p class="doc">Reste ${eur(reste)}${d.echeance ? `, échéance ${R.dateFr(d.echeance)}${d.echeance < t ? ' <b class="rouge-t">dépassée</b>' : ''}` : ''}</p>` : ''}
        ${d.statut === 'annule' && d.paye ? '<p class="doc">Acompte versé compté dans « payé ».</p>' : ''}
      </div>
      <div class="contrat-pied"><button class="btn petit" data-action="depense-modifier" data-id="${d.id}">Modifier</button></div>
    </article>`;
  }
  function barresBudget(lignes) {
    const max = Math.max(1, ...lignes.map((l) => Math.max(l.prevu, l.engage, l.paye)));
    const pc = (v) => `${(v / max) * 100}%`;
    return `<div class="barres" role="img" aria-label="Budget par poste : détail dans le tableau ci-dessous">${lignes.map((l, i) => `
      <div class="barre-l" data-i="${i}" tabindex="0">
        <span class="barre-nom">${l.poste ? esc(l.poste.nom) : 'Non affecté'}</span>
        <span class="barre-piste">
          <i class="eng" style="width:${pc(Math.max(l.engage, l.paye))}"></i><i class="paye" style="width:${pc(l.paye)}"></i>
          ${l.prevu ? `<i class="prevu ${l.depassement ? 'depasse' : ''}" style="left:${pc(l.prevu)}"></i>` : ''}
        </span>
        <span class="barre-val">${eur(Math.max(l.engage, l.paye))}${l.prevu ? ` / ${eur(l.prevu)}` : ''}</span>
      </div>`).join('')}</div>`;
  }
  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const b = R.budget(E, semCourant().id);
    const lignes = [...b.lignes, ...(b.nonAffecte ? [b.nonAffecte] : [])];
    const bulle = fig.querySelector('.infobulle');
    const montrer = (el) => {
      const l = lignes[Number(el.dataset.i)];
      bulle.innerHTML = `<b>${l.poste ? esc(l.poste.nom) : 'Non affecté'}</b><div>Prévu : ${eur(l.prevu)}</div><div><i style="background:var(--bleu)"></i>Engagé : ${eur(l.engage)}</div><div><i style="background:var(--encre)"></i>Payé : ${eur(l.paye)}</div><div>Reste à payer : ${eur(l.reste)}</div>`;
      bulle.hidden = false;
      const rz = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      bulle.style.top = `${rz.bottom - rf.top + 4}px`;
      bulle.style.left = `${Math.min(Math.max(8, rf.width - bulle.offsetWidth - 8), 120)}px`;
    };
    fig.querySelectorAll('.barre-l').forEach((el) => {
      el.addEventListener('pointerenter', () => montrer(el));
      el.addEventListener('focus', () => montrer(el));
      el.addEventListener('click', () => montrer(el));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; });
    fig.addEventListener('focusout', () => { bulle.hidden = true; });
  }

  // ---------- Impression et exports ----------
  function imprimer(html) {
    const zone = $('#impression');
    zone.innerHTML = html;
    document.body.classList.add('impression', 'imp-liste');
    const fin = () => { document.body.classList.remove('impression', 'imp-liste'); zone.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 1000); }, 50);
  }
  function imprimerProgramme(s) {
    const nb = Math.max(1, s.nbJours || 1);
    const p = R.programme(deSem(E.sessions, s.id));
    imprimer(`<h1>${esc(s.nom)} · programme</h1><p>${fmtLong(s.date)}${nb > 1 ? ` au ${fmtLong(R.finSeminaire(s))}` : ''}${s.lieu ? ` · ${esc(s.lieu)}` : ''}</p>${Array.from({ length: nb }, (_, i) => {
      const l = p.filter((x) => x.jour === i + 1);
      return l.length ? `<h2>Jour ${i + 1} · ${fmtLong(ajout(s.date, i))}</h2><table><thead><tr><th>Début</th><th>Fin</th><th>Session</th><th>Type</th><th>Salle</th><th>Animation</th></tr></thead><tbody>${l.map((x) => `<tr><td>${R.hm(x.debut)}</td><td>${R.hm(x.fin)}</td><td>${esc(x.titre)}</td><td>${esc(typeSession(x.type).nom)}</td><td>${esc(x.salle)}</td><td>${esc(x.animateur)}</td></tr>`).join('')}</tbody></table>` : '';
    }).join('')}`);
  }
  function imprimerChambres(s) {
    const occ = R.occupationChambres(deSem(E.chambres, s.id), deSem(E.participants, s.id));
    imprimer(`<h1>${esc(s.nom)} · chambres</h1><p>${fmtLong(s.date)} · ${pluriel(R.nuits(s), 'nuit')}${s.lieu ? ` · ${esc(s.lieu)}` : ''}</p><table><thead><tr><th>Hébergement</th><th>Chambre</th><th>Type</th><th>Occupants</th></tr></thead><tbody>${occ.map((o) => `<tr><td>${esc(o.chambre.hebergement)}</td><td>${esc(o.chambre.nom)}</td><td>${esc(typeChambre(o.chambre.type).nom)}</td><td>${o.occupants.map((p) => `${esc(p.prenom)} ${esc(p.nom)}`).join(', ')}</td></tr>`).join('')}</tbody></table><p>Liste nominative sans aucune donnée de santé. Les besoins particuliers se règlent directement entre la personne et l'hébergement.</p>`);
  }
  const fichier = (s) => s.nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function telecharger(blob, nom) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  const piedSimple = (existe, libelle = 'Enregistrer') => (existe
    ? `<button class="btn primaire" value="ok">${libelle}</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`
    : `<button class="btn primaire" value="ok">${existe === false ? 'Ajouter' : libelle}</button><button class="btn" value="annuler">Annuler</button>`);
  const memo = () => { annulation = structuredClone(E); };
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre(); toast('Action annulée.');
  }
  const fait = (message, avecAnnuler = true) => { sauver(); rendre(); toast(message, avecAnnuler ? { libelle: 'Annuler', faire: annuler } : null); };

  function modaleSeminaire(id) {
    const s = id ? sem(id) : null;
    const lies = ['participants', 'trajets', 'chambres', 'sessions', 'postes', 'depenses'];
    const nbLie = s ? lies.reduce((n, k) => n + deSem(E[k], s.id).length, 0) : 0;
    ouvrirModale(s ? 'Modifier le séminaire' : 'Nouveau séminaire', `${champsSeminaire(s || {}, !s)}${s ? `<label class="champ">Notes<textarea name="notes" maxlength="2000">${esc(s.notes)}</textarea></label><p class="aide">Les trajets gardent leurs dates : pense à les modifier si tu déplaces le séminaire.</p>` : ''}`,
      s ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : piedSimple(null, 'Créer'),
      (f, action) => {
        if (action === 'supprimer') {
          if (!confirm(`Supprimer « ${s.nom} » et tout ce qui s'y rattache (${pluriel(nbLie, 'élément')}) ?`)) return '';
          memo();
          E.seminaires = E.seminaires.filter((x) => x.id !== s.id);
          for (const k of lies) E[k] = E[k].filter((x) => x.semId !== s.id);
          ui.semId = null; memoUi();
          fait(`« ${s.nom} » supprimé.`);
          return;
        }
        const d = lireSeminaire(f);
        if (typeof d === 'string') return d;
        if (s && action === 'dupliquer') {
          memo();
          const copie = { ...s, ...d, id: uid(), nom: `${d.nom} (copie)` };
          E.seminaires.push(copie);
          const idsC = {};
          deSem(E.chambres, s.id).forEach((c) => { const n = { ...structuredClone(c), id: uid(), semId: copie.id }; idsC[c.id] = n.id; E.chambres.push(n); });
          for (const k of ['sessions', 'postes']) E[k].push(...deSem(E[k], s.id).map((x) => ({ ...structuredClone(x), id: uid(), semId: copie.id })));
          ui.semId = copie.id; memoUi();
          fait('Copie créée (programme, postes et chambres ; ni participants, ni trajets, ni dépenses). Pense à changer sa date.');
          return;
        }
        if (s) {
          memo();
          Object.assign(s, d, { notes: String(f.get('notes') || '') });
          fait('Séminaire enregistré.');
          return;
        }
        memo();
        const n = creerSeminaire(d, { programme: f.has('programme') ? programmeParDefaut(d) : '', postes: f.has('postes') });
        ui.semId = n.id; memoUi();
        fait(`« ${n.nom} » créé.`);
      });
  }

  // Options de trajet pour un participant.
  const optionsTrajet = (s, sens, val) => `<option value="">Non affecté</option><option value="perso" ${val === 'perso' ? 'selected' : ''}>Par ses propres moyens</option>${deSem(E.trajets, s.id).filter((t) => (t.sens === 'retour') === (sens === 'retour')).map((t) => `<option value="${t.id}" ${t.id === val ? 'selected' : ''}>${esc(nomTrajet(t))}${t.heureDepart ? ` · ${t.heureDepart}` : ''}</option>`).join('')}`;
  function modaleParticipant(id) {
    const s = semCourant();
    const p = id ? E.participants.find((x) => x.id === id) : null;
    const occ = R.occupationChambres(deSem(E.chambres, s.id), deSem(E.participants, s.id));
    const nuits = R.nuits(s);
    const corps = `
      <div class="deux">
        <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(p?.prenom || '')}"></label>
        <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(p?.nom || '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Service<input name="service" maxlength="60" list="liste-services" value="${esc(p?.service || '')}"><datalist id="liste-services">${[...new Set(E.participants.map((x) => (x.service || '').trim()).filter(Boolean))].sort().map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="champ">Rôle<select name="role">${B.roles.map((r) => `<option value="${r.id}" ${r.id === (p?.role || 'participant') ? 'selected' : ''}>${esc(r.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="deux">
        <label class="champ">E-mail professionnel<small>Facultatif</small><input name="email" type="email" maxlength="80" value="${esc(p?.email || '')}"></label>
        <label class="champ">Réponse<select name="reponse">${['attente', 'oui', 'non'].map((v) => `<option value="${v}" ${v === (p?.reponse || 'attente') ? 'selected' : ''}>${REP[v]}</option>`).join('')}</select></label>
      </div>
      <fieldset class="choix-base"><legend>Logistique <small>Un « non » libère son trajet et sa chambre.</small></legend>
        <div class="deux">
          <label class="champ">Aller<select name="allerId">${optionsTrajet(s, 'aller', p?.allerId || '')}</select></label>
          <label class="champ">Retour<select name="retourId">${optionsTrajet(s, 'retour', p?.retourId || '')}</select></label>
        </div>
        ${nuits ? `<label class="case"><input type="checkbox" name="hebergement" ${p?.hebergement === false ? '' : 'checked'}> A besoin d'une chambre</label>
        <label class="champ">Chambre<select name="chambreId"><option value="">À loger</option>${occ.map((o) => `<option value="${o.chambre.id}" ${o.chambre.id === p?.chambreId ? 'selected' : ''} ${o.libres <= 0 && o.chambre.id !== p?.chambreId ? 'disabled' : ''}>${esc(o.chambre.nom)} · ${o.occupants.length}/${o.capacite}${o.libres <= 0 && o.chambre.id !== p?.chambreId ? ' (pleine)' : ''}</option>`).join('')}</select></label>` : ''}
      </fieldset>
      <div class="sensible">
        <p><b>Données sensibles, facultatives</b> · seulement avec l'accord explicite du participant, si c'est utile au repas ou à l'accès. Aucun détail médical : le participant précise lui-même au traiteur ou au lieu.</p>
        <label class="champ">Régime alimentaire<select name="regime"><option value="">Non renseigné</option>${B.regimes.map((r) => `<option ${r === p?.regime ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="case"><input type="checkbox" name="allergie" ${p?.allergie ? 'checked' : ''}> Allergie ou intolérance à signaler au traiteur (sans détail)</label>
        <label class="case"><input type="checkbox" name="accessibilite" ${p?.accessibilite ? 'checked' : ''}> Besoin d'accessibilité (chambre, accès), sans détail</label>
      </div>
      <label class="champ">Note<small>Logistique uniquement (pas de santé).</small><input name="note" maxlength="200" value="${esc(p?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le participant' : 'Nouveau participant', corps, piedSimple(p ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.participants = E.participants.filter((x) => x.id !== p.id); fait(`${R.nomComplet(p)} retiré de la liste.`); return; }
      const v = { prenom: String(f.get('prenom') || '').trim(), nom: String(f.get('nom') || '').trim(), service: String(f.get('service') || '').trim(), role: f.get('role'), email: String(f.get('email') || '').trim(), reponse: f.get('reponse'),
        allerId: f.get('allerId') || '', retourId: f.get('retourId') || '', hebergement: nuits ? f.has('hebergement') : (p?.hebergement ?? true), chambreId: nuits ? (f.get('chambreId') || '') : (p?.chambreId || ''),
        regime: B.regimes.includes(f.get('regime')) ? f.get('regime') : '', allergie: f.has('allergie'), accessibilite: f.has('accessibilite'), note: String(f.get('note') || '').trim() };
      if (!v.nom) return 'Indique au moins le nom.';
      if (v.hebergement === false) v.chambreId = '';
      if (v.reponse === 'non') Object.assign(v, { allerId: '', retourId: '', chambreId: '' });
      memo();
      if (p) Object.assign(p, v); else E.participants.push({ id: uid(), semId: s.id, ...v });
      fait(p ? 'Participant enregistré.' : `${R.nomComplet(v)} ajouté.`);
    });
  }
  function modaleParticipantsRapides() {
    const s = semCourant();
    ouvrirModale('Saisie rapide de participants', `
      <label class="champ">Un participant par ligne<small>« Prénom Nom ; Service ; e-mail » (service et e-mail facultatifs). Copier-coller depuis un tableur accepté (tabulations).</small><textarea name="liste" rows="8" required placeholder="Léa Martin ; Ventes ; lea.martin@exemple.fr&#10;Hugo Bernard ; Finance"></textarea></label>
      <label class="champ">Réponse<select name="reponse"><option value="attente">En attente</option><option value="oui">Oui</option></select></label>
      <p class="aide">Aucune donnée sensible n'est importée : les régimes et cases se renseignent un par un, avec l'accord de chacun.</p>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const l = R.lireParticipantsRapides(f.get('liste'));
      if (!l.length) return 'Aucun nom reconnu.';
      memo();
      l.forEach((x) => E.participants.push({ id: uid(), semId: s.id, ...x, role: 'participant', reponse: f.get('reponse'), hebergement: true, allerId: '', retourId: '', chambreId: '', regime: '', allergie: false, accessibilite: false, note: '' }));
      fait(`${pluriel(l.length, 'participant ajouté', 'participants ajoutés')}.`);
    });
  }
  function modaleCsv() {
    const s = semCourant();
    ouvrirModale('Exporter les participants', `<p>Fichier CSV (point-virgule, UTF-8) pour un tableur : nom, service, réponse, aller, retour, chambre.</p>
      <label class="case"><input type="checkbox" name="sensibles"> Inclure régime, allergie et accessibilité (données sensibles)</label>
      <p class="aide">Le fichier sort de l'application : range-le dans un dossier protégé, ne le transmets qu'à qui en a besoin et supprime-le après le séminaire. Pour le traiteur, préfère la fiche traiteur (nombres seulement).</p>`,
    '<button class="btn primaire" value="ok">Télécharger</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const csv = R.csvParticipants(deSem(E.participants, s.id), { avecSensibles: f.has('sensibles'), role: (id) => role(id).nom, trajet: libTransport, chambre: (id) => nomChambre(chambre(id)) });
      telecharger(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `participants-${fichier(s)}.csv`);
    });
  }
  function modaleTraiteur() {
    const s = semCourant();
    const tr = R.traiteur(s, deSem(E.participants, s.id), deSem(E.sessions, s.id), B.regimes);
    ouvrirModale('Fiche traiteur', `
      <p>À transmettre au traiteur ou au lieu : <b>nombres seulement</b>, aucun nom, aucun détail de santé.</p>
      ${blocTraiteur(tr)}
      ${tr.repas.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Repas</th><th>Jour</th><th class="nb">Couverts</th></tr></thead><tbody>${tr.repas.map((r) => `<tr><td>${esc(r.titre)}<br><small>${r.heure.replace(':', ' h ')}${r.salle ? ` · ${esc(r.salle)}` : ''}</small></td><td>${fmt(r.date)}</td><td class="nb">${r.couverts}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ligne-vide">Aucun repas au programme : ajoute des sessions de type « Repas ».</p>'}
      <p class="aide">Tous les participants sont comptés sur toute la durée. Mets à jour la fiche après les dernières réponses.</p>`,
    '<button class="btn primaire" value="ok">Télécharger (CSV)</button><button class="btn" value="annuler">Fermer</button>', () => {
      telecharger(new Blob([R.csvTraiteur(s, tr)], { type: 'text/csv;charset=utf-8' }), `traiteur-${fichier(s)}.csv`);
    });
  }

  function modaleTrajet(id) {
    const s = semCourant();
    const t = id ? E.trajets.find((x) => x.id === id) : null;
    const sens = t?.sens || 'aller';
    const corps = `
      <div class="deux">
        <label class="champ">Sens<select name="sens"><option value="aller" ${sens === 'aller' ? 'selected' : ''}>Aller</option><option value="retour" ${sens === 'retour' ? 'selected' : ''}>Retour</option></select></label>
        <label class="champ">Mode<select name="mode">${B.modes.map((m) => `<option value="${m.id}" ${m.id === (t?.mode || 'train') ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Libellé<small>Facultatif, ex. : « Train du matin », « Navette 2 »</small><input name="libelle" maxlength="60" value="${esc(t?.libelle || '')}"></label>
      <div class="deux">
        <label class="champ">Départ<input name="depart" maxlength="60" value="${esc(t?.depart ?? (sens === 'aller' ? s.depart : s.lieu) ?? '')}"></label>
        <label class="champ">Arrivée<input name="arrivee" maxlength="60" value="${esc(t?.arrivee ?? (sens === 'aller' ? s.lieu : s.depart) ?? '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Date<input type="date" name="date" required value="${esc(t?.date || (sens === 'retour' ? R.finSeminaire(s) : s.date))}"></label>
        <label class="champ">Places réservées<small>0 = non précisé</small><input type="number" name="places" min="0" max="999" value="${t?.places || 0}"></label>
      </div>
      <div class="deux">
        <label class="champ">Heure de départ<input type="time" name="heureDepart" value="${esc(t?.heureDepart || '')}"></label>
        <label class="champ">Heure d'arrivée<input type="time" name="heureArrivee" value="${esc(t?.heureArrivee || '')}"></label>
      </div>
      <label class="champ">Référence<small>N° de réservation, dossier, contact (en texte)</small><input name="reference" maxlength="120" value="${esc(t?.reference || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(t ? 'Modifier le trajet' : 'Nouveau trajet', corps, piedSimple(t ? true : false), (f, action) => {
      if (action === 'supprimer') {
        memo();
        E.trajets = E.trajets.filter((x) => x.id !== t.id);
        E.participants.forEach((p) => { if (p.allerId === t.id) p.allerId = ''; if (p.retourId === t.id) p.retourId = ''; });
        fait('Trajet supprimé : ses passagers repassent « sans trajet ».');
        return;
      }
      const v = { sens: f.get('sens') === 'retour' ? 'retour' : 'aller', mode: f.get('mode'), libelle: String(f.get('libelle') || '').trim(), depart: String(f.get('depart') || '').trim(), arrivee: String(f.get('arrivee') || '').trim(),
        date: f.get('date'), places: Number(f.get('places')) || 0, heureDepart: f.get('heureDepart') || '', heureArrivee: f.get('heureArrivee') || '', reference: String(f.get('reference') || '').trim() };
      if (!R.estDate(v.date)) return 'Indique la date du trajet.';
      if (!Number.isInteger(v.places) || v.places < 0) return 'Places : nombre entier.';
      memo();
      if (t) {
        if (t.sens !== v.sens) E.participants.forEach((p) => { if (p.allerId === t.id) p.allerId = ''; if (p.retourId === t.id) p.retourId = ''; });
        Object.assign(t, v);
      } else E.trajets.push({ id: uid(), semId: s.id, ...v });
      fait(t ? 'Trajet enregistré.' : 'Trajet ajouté : coche ses passagers.');
    });
  }
  // Coche les participants d'un trajet (passagers) ou d'une chambre (occupants).
  function modaleAffectation(type, id) {
    const s = semCourant();
    const cible = type === 'trajet' ? E.trajets.find((x) => x.id === id) : E.chambres.find((x) => x.id === id);
    if (!cible) return;
    const cle = type === 'trajet' ? (cible.sens === 'retour' ? 'retourId' : 'allerId') : 'chambreId';
    const liste = R.trier(deSem(E.participants, s.id).filter((p) => R.concerne(p) && (type === 'trajet' || p.hebergement !== false)));
    const limite = type === 'trajet' ? Number(cible.places) || 0 : Math.max(1, Number(cible.capacite) || 1);
    const ailleurs = (p) => (p[cle] && p[cle] !== id ? (type === 'trajet' ? (p[cle] === 'perso' ? 'propres moyens' : nomTrajet(trajet(p[cle]))) : nomChambre(chambre(p[cle]))) : '');
    const corps = `
      <p>${type === 'trajet' ? `${esc(nomTrajet(cible))} · ${limite ? pluriel(limite, 'place') : 'places non précisées'}` : `${esc(cible.nom)} · ${esc(typeChambre(cible.type).nom)} · ${pluriel(limite, 'place')}`}. <span id="compte-coches"></span></p>
      ${type === 'chambre' ? `<p class="rang-actions"><button type="button" class="btn lien" data-action="chambre-modifier" data-id="${cible.id}">Modifier la chambre (nom, type, places, note)</button></p>` : ''}
      ${liste.length ? `<label class="champ compact">Filtrer<input type="search" id="filtre-coches" placeholder="Nom, service…"></label><div class="choix-postes coches">${liste.map((p) => `<label class="case" data-texte="${esc(texteRecherche(p))}"><input type="checkbox" name="p" value="${p.id}" ${p[cle] === id ? 'checked' : ''}> <span>${esc(p.prenom)} ${esc(p.nom)}${p.reponse === 'attente' ? ' <small>(en attente)</small>' : ''}${ailleurs(p) ? ` <small>· actuellement : ${esc(ailleurs(p))}</small>` : ''}${p.service ? ` <small>· ${esc(p.service)}</small>` : ''}</span></label>`).join('')}</div>` : '<p class="ligne-vide">Aucun participant confirmé ou en attente.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(type === 'trajet' ? 'Passagers du trajet' : 'Occupants de la chambre', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${type === 'chambre' ? '<button class="btn danger gauche" value="supprimer">Supprimer la chambre</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        memo();
        E.chambres = E.chambres.filter((x) => x.id !== id);
        E.participants.forEach((p) => { if (p.chambreId === id) p.chambreId = ''; });
        fait(`${cible.nom} supprimée : ses occupants sont à loger.`);
        return;
      }
      const coches = new Set(f.getAll('p'));
      memo();
      let n = 0;
      liste.forEach((p) => { if (coches.has(p.id)) { if (p[cle] !== id) n++; p[cle] = id; } else if (p[cle] === id) p[cle] = ''; });
      const total = liste.filter((p) => p[cle] === id).length;
      fait(`${type === 'trajet' ? nomTrajet(cible) : cible.nom} : ${total}${limite ? `/${limite}` : ''}${limite && total > limite ? ' (au-delà des places)' : ''}.`);
    });
    const maj = () => { const n = modale().querySelectorAll('input[name=p]:checked').length; const el = $('#compte-coches'); if (el) { el.textContent = `${n} coché${n > 1 ? 's' : ''}${limite ? ` sur ${limite}` : ''}.`; el.className = limite && n > limite ? 'rouge-t' : ''; } };
    modale().querySelectorAll('input[name=p]').forEach((c) => c.addEventListener('change', maj));
    $('#filtre-coches')?.addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); modale().querySelectorAll('.coches .case').forEach((l) => { l.hidden = Boolean(q) && !l.dataset.texte.includes(q); }); });
    maj();
  }
  function modaleChambres() {
    const s = semCourant();
    const heb = deSem(E.chambres, s.id).at(-1)?.hebergement || s.lieu || '';
    ouvrirModale('Ajouter des chambres', `
      <label class="champ">Hébergement<small>Nom de l'hôtel ou du lieu</small><input name="hebergement" maxlength="80" value="${esc(heb)}"></label>
      <div class="deux">
        <label class="champ">Type<select name="type">${B.chambres.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Places par chambre<input type="number" name="capacite" min="1" max="6" value="1"></label>
      </div>
      <div class="deux">
        <label class="champ">Nombre de chambres<input type="number" name="n" min="1" max="200" value="10"></label>
        <label class="champ">Numéroter à partir de<small>Vide : Chambre 1, 2…</small><input type="number" name="debut" min="0" max="9999" placeholder="Ex. : 101"></label>
      </div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = Number(f.get('n'));
      const capacite = Number(f.get('capacite'));
      if (!Number.isInteger(n) || n < 1 || n > 200) return 'Nombre de chambres : entre 1 et 200.';
      if (!Number.isInteger(capacite) || capacite < 1 || capacite > 6) return 'Places : entre 1 et 6.';
      const debut = f.get('debut') === '' ? deSem(E.chambres, s.id).length + 1 : Number(f.get('debut'));
      memo();
      for (let i = 0; i < n; i++) E.chambres.push({ id: uid(), semId: s.id, hebergement: String(f.get('hebergement') || '').trim(), nom: `Chambre ${debut + i}`, type: f.get('type'), capacite, note: '' });
      fait(`${pluriel(n, 'chambre ajoutée', 'chambres ajoutées')} (${pluriel(n * capacite, 'place')}).`);
    });
    const typeSel = modale().querySelector('[name=type]');
    typeSel.addEventListener('change', () => { modale().querySelector('[name=capacite]').value = typeChambre(typeSel.value).capacite; });
  }
  function modaleChambre(id) {
    const c = E.chambres.find((x) => x.id === id);
    ouvrirModale('Modifier la chambre', `
      <div class="deux"><label class="champ">Nom ou numéro<input name="nom" required maxlength="40" value="${esc(c.nom)}"></label><label class="champ">Hébergement<input name="hebergement" maxlength="80" value="${esc(c.hebergement)}"></label></div>
      <div class="deux"><label class="champ">Type<select name="type">${B.chambres.map((t) => `<option value="${t.id}" ${t.id === c.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Places<input type="number" name="capacite" min="1" max="6" value="${c.capacite}"></label></div>
      <label class="champ">Note<small>Étage, vue, accès de plain-pied… (aucune donnée de santé)</small><input name="note" maxlength="120" value="${esc(c.note)}"></label>
      <p class="erreur" role="alert"></p>`, piedSimple(true), (f, action) => {
      if (action === 'supprimer') { memo(); E.chambres = E.chambres.filter((x) => x.id !== id); E.participants.forEach((p) => { if (p.chambreId === id) p.chambreId = ''; }); fait(`${c.nom} supprimée.`); return; }
      const nom = String(f.get('nom') || '').trim();
      const capacite = Number(f.get('capacite'));
      if (!nom) return 'Indique le nom ou le numéro.';
      if (!Number.isInteger(capacite) || capacite < 1 || capacite > 6) return 'Places : entre 1 et 6.';
      memo();
      Object.assign(c, { nom, hebergement: String(f.get('hebergement') || '').trim(), type: f.get('type'), capacite, note: String(f.get('note') || '').trim() });
      fait('Chambre enregistrée.');
    });
  }
  function repartirAuto() {
    const s = semCourant();
    const P = deSem(E.participants, s.id);
    const r = R.repartir(s, P, deSem(E.chambres, s.id));
    const n = Object.keys(r.affectations).length;
    if (!n) { toast(r.restants.length ? `Aucune place libre pour ${pluriel(r.restants.length, 'confirmé')} à loger : ajoute des chambres.` : 'Aucun confirmé à loger.'); return; }
    memo();
    Object.entries(r.affectations).forEach(([pid, cid]) => { E.participants.find((p) => p.id === pid).chambreId = cid; });
    fait(`${pluriel(n, 'participant placé', 'participants placés')}${r.restants.length ? ` ; ${r.restants.length} sans place` : ''}. Vérifie et ajuste chambre par chambre.`);
  }

  function modaleSession(id) {
    const s = semCourant();
    const x = id ? E.sessions.find((y) => y.id === id) : null;
    const nb = Math.max(1, s.nbJours || 1);
    const derniere = R.programme(deSem(E.sessions, s.id)).filter((y) => y.jour === ui.jour).at(-1);
    const salles = [...new Set(deSem(E.sessions, s.id).map((y) => (y.salle || '').trim()).filter(Boolean))].sort();
    const corps = `
      <label class="champ">Session<input name="titre" required maxlength="100" value="${esc(x?.titre || '')}" placeholder="Ex. : Atelier stratégie commerciale"></label>
      <div class="deux">
        <label class="champ">Type<select name="type">${B.sessions.map((t) => `<option value="${t.id}" ${t.id === (x?.type || 'pleniere') ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        ${nb > 1 ? `<label class="champ">Jour<select name="jour">${Array.from({ length: nb }, (_, i) => `<option value="${i + 1}" ${(x?.jour || ui.jour) === i + 1 ? 'selected' : ''}>Jour ${i + 1} · ${fmt(ajout(s.date, i))}</option>`).join('')}</select></label>` : '<span></span>'}
      </div>
      <div class="deux">
        <label class="champ">Début<input type="time" name="heure" required value="${esc(x?.heure || (derniere ? R.hm(Math.min(derniere.fin, 23 * 60 + 59)) : '09:00'))}"></label>
        <label class="champ">Durée (minutes)<input type="number" name="duree" min="0" max="1440" value="${x ? x.duree : 60}"></label>
      </div>
      <div class="deux">
        <label class="champ">Salle<small>Les chevauchements sont signalés par salle.</small><input name="salle" maxlength="60" list="liste-salles" value="${esc(x?.salle || '')}"><datalist id="liste-salles">${salles.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="champ">Animation<input name="animateur" maxlength="60" value="${esc(x?.animateur || '')}"></label>
      </div>
      <label class="champ">Notes<small>Matériel, support, consignes…</small><input name="notes" maxlength="200" value="${esc(x?.notes || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier la session' : 'Nouvelle session', corps, piedSimple(x ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.sessions = E.sessions.filter((y) => y.id !== x.id); fait('Session supprimée.'); return; }
      const titre = String(f.get('titre') || '').trim();
      const debut = R.minutes(f.get('heure'));
      const duree = Number(f.get('duree'));
      if (!titre) return 'Indique la session.';
      if (debut === null) return 'Heure de début invalide.';
      if (!Number.isInteger(duree) || duree < 0 || debut + duree > 1440) return 'Durée : minutes entières, sans dépasser minuit.';
      memo();
      const v = { titre, type: f.get('type'), heure: R.hm(debut), duree, salle: String(f.get('salle') || '').trim(), animateur: String(f.get('animateur') || '').trim(), notes: String(f.get('notes') || '').trim(), jour: Number(f.get('jour') || x?.jour || ui.jour) };
      if (x) Object.assign(x, v); else E.sessions.push({ id: uid(), semId: s.id, ...v });
      ui.jour = v.jour;
      fait(x ? 'Session enregistrée.' : 'Session ajoutée.');
    });
  }
  function modaleDecaler(id) {
    const s = semCourant();
    const x = E.sessions.find((y) => y.id === id);
    const n = deSem(E.sessions, s.id).filter((y) => y.jour === x.jour && R.minutes(y.heure) >= R.minutes(x.heure)).length;
    ouvrirModale('Décaler le programme', `<p>« ${esc(x.titre)} » (${esc(x.heure)}) et les sessions suivantes du même jour : <b>${pluriel(n, 'session')}</b>.</p>
      <label class="champ">Décalage (minutes)<small>Négatif pour avancer.</small><input type="number" name="n" value="15" min="-600" max="600" required></label>
      <div class="rang">${[-15, -5, 5, 10, 15, 30].map((v) => `<button type="button" class="btn petit" data-action="choisir-decalage" data-v="${v}">${v > 0 ? '+' : ''}${v} min</button>`).join('')}</div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Décaler</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const r = R.decaler(deSem(E.sessions, s.id), id, Number(f.get('n')));
      if (typeof r === 'string') return r;
      memo();
      E.sessions.forEach((y) => { if (r[y.id]) y.heure = r[y.id]; });
      fait(`${pluriel(Object.keys(r).length, 'session décalée', 'sessions décalées')}.`);
    });
  }
  function modaleProgrammeType() {
    const s = semCourant();
    const nb = Math.max(1, s.nbJours || 1);
    ouvrirModale('Ajouter un programme type', `
      <fieldset class="choix-base"><legend>Programme <small>Horaires d'exemple, rédigés pour le template : adapte-les.</small></legend>
        ${Object.entries(B.programmes).map(([k, p]) => `<label class="case"><input type="radio" name="modele" value="${k}" ${k === programmeParDefaut(s) ? 'checked' : ''}> ${esc(p.nom)} (${pluriel(p.sessions.filter(([j]) => j <= nb).length, 'session')})</label>`).join('')}
      </fieldset>
      <p class="aide">Les sessions s'ajoutent à celles qui existent déjà${nb > 2 ? ' ; les jours au-delà du deuxième restent à composer' : ''}.</p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memo();
      fait(`${pluriel(ajouterProgrammeType(s, f.get('modele')), 'session ajoutée', 'sessions ajoutées')}.`);
    });
  }

  function modalePoste(id) {
    const s = semCourant();
    const p = id ? E.postes.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Poste<input name="nom" required maxlength="60" list="postes-types" value="${esc(p?.nom || '')}"><datalist id="postes-types">${B.postes.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="champ">Montant prévu (${E.reglages.convention})<small>Ton estimation pour ce séminaire.</small><input name="prevu" inputmode="decimal" value="${R.champMontant(p?.prevu ?? null)}" placeholder="Ex. : 8 000"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le poste' : 'Nouveau poste', corps, piedSimple(p ? true : false), (f, action) => {
      if (action === 'supprimer') {
        const n = E.depenses.filter((d) => d.posteId === p.id).length;
        if (n && !confirm(`${pluriel(n, 'dépense')} rattachée(s) à ce poste passera(ont) en « Non affecté ». Continuer ?`)) return '';
        memo(); E.postes = E.postes.filter((x) => x.id !== p.id); E.depenses.forEach((d) => { if (d.posteId === p.id) d.posteId = null; });
        fait(`Poste « ${p.nom} » supprimé.`); return;
      }
      const nom = String(f.get('nom') || '').trim();
      const prevu = R.lireMontant(f.get('prevu'));
      if (!nom) return 'Indique le nom du poste.';
      if (prevu === null || prevu < 0) return 'Montant illisible (ex. : 8 000 ou 8000,50).';
      memo();
      if (p) Object.assign(p, { nom, prevu }); else E.postes.push({ id: uid(), semId: s.id, nom, prevu });
      fait(p ? 'Poste enregistré.' : `Poste « ${nom} » ajouté.`);
    });
  }
  function modalePostesTypes() {
    const s = semCourant();
    const deja = new Set(deSem(E.postes, s.id).map((p) => p.nom.toLowerCase()));
    const dispo = B.postes.filter((n) => !deja.has(n.toLowerCase()));
    if (!dispo.length) { toast('Tous les postes types sont déjà présents.'); return; }
    ouvrirModale('Ajouter des postes types', `<p class="aide">Postes sans montant : saisis ensuite ton prévu, poste par poste.</p><div class="choix-postes">${dispo.map((n) => `<label class="case"><input type="checkbox" name="p" value="${esc(n)}" checked> ${esc(n)}</label>`).join('')}</div>`,
      '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const noms = f.getAll('p');
        if (!noms.length) return;
        memo();
        fait(`${pluriel(ajouterPostesTypes(s, noms), 'poste ajouté', 'postes ajoutés')}.`);
      });
  }
  function modaleDepense(id) {
    const s = semCourant();
    const d = id ? E.depenses.find((x) => x.id === id) : null;
    const postes = deSem(E.postes, s.id);
    const fournisseurs = [...new Set(E.depenses.map((x) => (x.fournisseur || '').trim()).filter(Boolean))].sort();
    const corps = `
      <div class="deux">
        <label class="champ">Fournisseur<input name="fournisseur" maxlength="80" list="liste-fournisseurs" value="${esc(d?.fournisseur || '')}"><datalist id="liste-fournisseurs">${fournisseurs.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="champ">Poste<select name="poste"><option value="">Non affecté</option>${postes.map((p) => `<option value="${p.id}" ${p.id === d?.posteId ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Objet<input name="objet" maxlength="120" value="${esc(d?.objet || '')}" placeholder="Ex. : 22 chambres, une nuit"></label>
      <div class="deux">
        <label class="champ">Montant (${E.reglages.convention})<input name="montant" inputmode="decimal" value="${R.champMontant(d?.montant ?? null)}"></label>
        <label class="champ">Statut<small>Engagée = devis signé, commande passée</small><select name="statut">${B.statutsDepense.map((x) => `<option value="${x.id}" ${x.id === (d?.statut || 'devis') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="deux">
        <label class="champ">Déjà payé<small>Acomptes et règlements cumulés</small><input name="paye" inputmode="decimal" value="${R.champMontant(d?.paye ?? null)}"></label>
        <label class="champ">Prochaine échéance<small>Facultative</small><input type="date" name="echeance" value="${esc(d?.echeance || '')}"></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(d ? 'Modifier la dépense' : 'Nouvelle dépense', corps, piedSimple(d ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.depenses = E.depenses.filter((x) => x.id !== d.id); fait('Dépense supprimée.'); return; }
      const montant = R.lireMontant(f.get('montant'));
      const paye = R.lireMontant(f.get('paye'));
      if (montant === null || montant < 0) return 'Montant illisible (ex. : 4 500 ou 4500,50).';
      if (paye === null || paye < 0) return 'Montant payé illisible.';
      memo();
      const v = { fournisseur: String(f.get('fournisseur') || '').trim(), posteId: f.get('poste') || null, objet: String(f.get('objet') || '').trim(), montant, statut: f.get('statut'), paye, echeance: f.get('echeance') || '' };
      if (d) Object.assign(d, v); else E.depenses.push({ id: uid(), semId: s.id, ...v });
      fait(v.statut === 'engage' && paye > montant ? 'Dépense enregistrée : le payé dépasse le montant, vérifie.' : 'Dépense enregistrée.');
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const s = semCourant();
    const nbSens = s ? R.aSensibles(E.participants, s.id) : 0;
    const corps = `
      <label class="champ">Nom de ton entreprise ou de ton service<input name="structure" maxlength="60" value="${esc(E.structure)}"></label>
      <fieldset class="choix-base"><legend>Montants saisis <small>Simple libellé affiché à côté des montants.</small></legend>
        <label class="case"><input type="radio" name="convention" value="HT" ${E.reglages.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
        <label class="case"><input type="radio" name="convention" value="TTC" ${E.reglages.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC)</label>
      </fieldset>
      <div class="groupe"><h3>Données sensibles des participants</h3>
        <p class="aide">Régimes alimentaires, allergies et besoins d'accessibilité sont des données sensibles : saisie facultative, avec l'accord explicite de chacun, aucun détail médical (une case suffit), comptage agrégé pour le traiteur. Efface-les dès que le séminaire est passé. ${esc(B.rgpd.source)} Outil d'aide, pas un conseil juridique.</p>
        ${s ? `<div class="rang"><button class="btn petit danger" type="button" data-action="effacer-sensibles" ${nbSens ? '' : 'disabled'}>Effacer régimes, allergies et accessibilité de « ${esc(s.nom)} » (${nbSens})</button></div>` : ''}</div>
      <div class="groupe"><h3>Sauvegarde et export</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé ; toute personne qui a la clé les voit.'} La copie complète (JSON) répond aussi à une demande d'accès d'un participant. Taille actuelle : ${Math.ceil(R.taille(E) / 1024)} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Base intégrée</h3><p class="aide">Programmes types, postes de budget, types de chambre et de session rédigés pour ce template : horaires indicatifs, aucun prix de référence, aucun horaire de transporteur.</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de l'outil, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.structure = String(f.get('structure') || '').trim();
      E.reglages.convention = f.get('convention') === 'HT' ? 'HT' : 'TTC';
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (ev) => {
      const fichierJson = ev.target.files[0];
      if (!fichierJson) return;
      try {
        const d = JSON.parse(await fichierJson.text());
        if (!Array.isArray(d.seminaires) || !Array.isArray(d.participants)) throw new Error();
        if (!confirm(`Remplacer toutes tes données par cette copie (${pluriel(d.seminaires.length, 'séminaire')}) ?`)) return;
        memo();
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = vu || E.tutorielVu === true;
        modale().close(); fait('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du template séminaire.'); }
    });
  }
  function exporter() {
    telecharger(new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' }), `seminaire-offsite-${auj()}.json`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Un séminaire, ses participants', `Chaque séminaire a sa date, son nombre de jours et sa date limite de réponse. Dans <b>Participants</b>, note la réponse de chacun&nbsp;: ${REP.oui.toLowerCase()}, ${REP.attente.toLowerCase()} ou ${REP.non.toLowerCase()}. Les réponses en attente remontent dans le <b>Tableau de bord</b> 7&nbsp;jours avant la date limite, puis en urgence une fois celle-ci passée.`],
      ['beurre', 'Transports et chambres', `Dans <b>Transports et chambres</b>, crée les trajets aller et retour et les chambres, puis affecte chaque participant. L'outil signale qui n'a pas de trajet ou reste à loger, les trajets et chambres trop pleins, et un trajet qui arrive après le début du programme ou part avant la fin. La répartition automatique loge les confirmés en regroupant les collègues d'un même service.`],
      ['ciel', 'Le programme', `<b>Programme</b> place les sessions jour par jour, chacune dans sa salle&nbsp;: plusieurs sessions peuvent avoir lieu en même temps dans des salles différentes. Deux sessions qui se chevauchent dans la même salle sont signalées.`],
      ['sable', 'Le budget', `<b>Budget</b> compare, poste par poste, le prévu aux dépenses engagées et payées, en ${esc(E.reglages.convention)} comme choisi dans les réglages. Le coût par participant divise le total par le nombre de confirmés. Un poste dépassé, le budget cible dépassé et les paiements à régler dans les 14&nbsp;jours sont signalés.`],
      ['rose', 'Le traiteur et les données sensibles', `La <b>Fiche traiteur</b> ne donne que des nombres&nbsp;: couverts (confirmés et en attente), régimes et allergies, sans aucun nom. Une fois le séminaire terminé, l'outil te rappelle d'effacer régimes, allergies et besoins d'accessibilité.`],
    ];
    const corps = `
      <p>L'outil réunit l'organisation de ton séminaire&nbsp;: participants, transports, chambres, programme et budget, et te signale ce qui reste à régler. Ton rôle&nbsp;: saisir les participants et leurs réponses, puis la logistique et les dépenses.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">Le <b>Tableau de bord</b> liste ce qui est à traiter, le plus urgent d'abord. Le menu en haut de chaque onglet passe d'un séminaire à l'autre. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.seminaires.length;
    const pied = premier
      ? '<button class="btn primaire" value="seminaire">Créer mon premier séminaire</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'seminaire') setTimeout(() => modaleSeminaire(), 0); });
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
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-vide': terminerAccueilVide(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'aller': {
        const v = el.dataset.vue;
        if (v === 'hebergement') { ui.volet = 'chambres'; memoUi(); changerVue('logistique'); } else if (v === 'logistique') { ui.volet = 'transports'; memoUi(); changerVue('logistique'); } else changerVue(v);
        break;
      }
      case 'ouvrir-sem': ui.semId = id; ui.jour = 1; memoUi(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'sem-nouveau': modaleSeminaire(); break;
      case 'sem-modifier': modaleSeminaire(id); break;
      case 'participant-nouveau': modaleParticipant(); break;
      case 'participant-modifier': modaleParticipant(id); break;
      case 'participants-rapide': modaleParticipantsRapides(); break;
      case 'repondre': {
        const p = E.participants.find((y) => y.id === id);
        if (p.reponse === el.dataset.v) break;
        memo(); p.reponse = el.dataset.v;
        if (p.reponse === 'non') { p.allerId = ''; p.retourId = ''; p.chambreId = ''; }
        fait(`${R.nomComplet(p)} : ${REP[p.reponse].toLowerCase()}${p.reponse === 'non' ? ' (trajets et chambre libérés)' : ''}.`);
        break;
      }
      case 'csv': modaleCsv(); break;
      case 'fiche-traiteur': modaleTraiteur(); break;
      case 'volet': ui.volet = el.dataset.v; memoUi(); rendre(); break;
      case 'trajet-nouveau': modaleTrajet(); break;
      case 'trajet-modifier': modaleTrajet(id); break;
      case 'passagers': modaleAffectation('trajet', id); break;
      case 'occupants': modaleAffectation('chambre', id); break;
      case 'chambre-modifier': modaleChambre(id); break;
      case 'chambres-nouvelles': modaleChambres(); break;
      case 'repartir': repartirAuto(); break;
      case 'imprimer-chambres': imprimerChambres(semCourant()); break;
      case 'session-nouvelle': modaleSession(); break;
      case 'session-modifier': modaleSession(id); break;
      case 'decaler': modaleDecaler(id); break;
      case 'choisir-decalage': el.closest('form').n.value = el.dataset.v; break;
      case 'programme-type': modaleProgrammeType(); break;
      case 'imprimer-programme': imprimerProgramme(semCourant()); break;
      case 'jour': ui.jour = Number(el.dataset.v); rendre(); break;
      case 'poste-nouveau': modalePoste(); break;
      case 'poste-modifier': modalePoste(id); break;
      case 'postes-types': modalePostesTypes(); break;
      case 'depense-nouvelle': modaleDepense(); break;
      case 'depense-modifier': modaleDepense(id); break;
      case 'solder': { const d = E.depenses.find((x) => x.id === id); memo(); d.paye = d.montant; d.echeance = ''; fait(`${eur(d.montant)} payés à ${d.fournisseur || 'ce fournisseur'}.`); break; }
      case 'effacer-sensibles': {
        const s = semCourant();
        if (!confirm(`Effacer définitivement régimes, allergies et besoins d'accessibilité des participants de « ${s.nom} » ?`)) break;
        const n = R.effacerSensibles(E.participants, s.id);
        if (modale().open) modale().close();
        sauver(); rendre(); toast(`Données sensibles effacées pour ${pluriel(n, 'participant')}.`);
        break;
      }
      default: break;
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('select[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'choisir-sem') { ui.semId = el.value; ui.jour = 1; ui.svc = ''; memoUi(); rendre(); }
    if (a === 'filtre-rep') { ui.rep = el.value; rendre(); }
    if (a === 'filtre-svc') { ui.svc = el.value; rendre(); }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Pendant le séminaire, la session en cours se met à jour chaque minute.
  setInterval(() => { if (E && vue === 'programme' && !modale().open && document.visibilityState === 'visible') rendre(); }, 60000);

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
  window.__seminaire = { etat: () => E, regles: R };
  init();
})();
